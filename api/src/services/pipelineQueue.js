const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const ffmpegService = require('./ffmpegService');
const whisperService = require('./whisperService');
const vttConverter = require('./vttConverter');
const { translateSegments } = require('./translationService');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads');
const AUDIO_DIR = path.join(UPLOADS_DIR, 'audio');
const CAPTIONS_DIR = path.join(UPLOADS_DIR, 'captions');

class PipelineQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  enqueue(videoId) {
    this.queue.push(videoId);
    if (!this.isProcessing) {
      this.processNext();
    }
  }

  async updateVideoState(video, fields) {
    Object.assign(video, fields);
    console.log(`[Pipeline] Status: ${video.status} | Progress: ${video.progress}% | Step: "${video.step}"`);
    try {
      if (video.save && typeof video.save === 'function') {
        await video.save();
      }
    } catch (err) {
      // offline or testing
    }
  }

  async processNext() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const videoId = this.queue.shift();

    try {
      await this.processVideo(videoId);
    } catch (err) {
      console.error(`Pipeline job error for video ${videoId}:`, err);
    } finally {
      this.processNext();
    }
  }

  async processVideo(videoIdOrDoc) {
    let video = null;
    if (typeof videoIdOrDoc === 'object' && videoIdOrDoc !== null) {
      video = videoIdOrDoc;
    } else {
      try {
        video = await Video.findById(videoIdOrDoc);
      } catch (e) {
        // offline or testing
      }
    }

    if (!video) {
      console.warn(`Video with id "${videoIdOrDoc}" not found in database. Skipping.`);
      return;
    }

    const sourcePath = video.sourcePath || video.videoPath;
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      await this.updateVideoState(video, {
        status: 'failed',
        progress: 0,
        step: 'Processing failed: Source video file not found.',
        error: 'The uploaded video file could not be located on the server disk.'
      });
      return;
    }

    // Step 1: Checking your file (ffprobe validation)
    await this.updateVideoState(video, {
      status: 'processing',
      progress: 10,
      step: 'Checking your file'
    });

    try {
      await ffmpegService.probeVideo(sourcePath);
    } catch (probeErr) {
      console.error('[Pipeline] Video probe failed:', probeErr.message);
      await this.updateVideoState(video, {
        status: 'failed',
        progress: 0,
        step: 'Processing failed: Unsupported or corrupted video file.',
        error: 'The uploaded video file appears to be corrupted or in an unsupported format. Please try re-encoding or exporting as MP4, WebM, or MOV.'
      });
      return;
    }

    // Step 2: Extracting audio (16 kHz mono WAV)
    await this.updateVideoState(video, {
      status: 'processing',
      progress: 30,
      step: 'Extracting audio'
    });

    const wavFilename = `${video._id}_16k.wav`;
    const wavPath = path.join(AUDIO_DIR, wavFilename);

    try {
      await ffmpegService.extractWav(sourcePath, wavPath);
      video.wavPath = wavPath;
    } catch (wavErr) {
      console.error('[Pipeline] Audio extraction failed:', wavErr.message);
      await this.updateVideoState(video, {
        status: 'failed',
        progress: 0,
        step: 'Processing failed: Could not extract audio.',
        error: 'We could not extract an audio track from this video. Please make sure the video includes an audio stream.'
      });
      return;
    }

    // Step 3: Compressing audio for slow connections (64 kbps mono MP3)
    await this.updateVideoState(video, {
      status: 'processing',
      progress: 55,
      step: 'Compressing audio for slow connections'
    });

    const mp3Filename = `${video._id}_64k.mp3`;
    const mp3Path = path.join(AUDIO_DIR, mp3Filename);

    try {
      await ffmpegService.compressToMp3(sourcePath, mp3Path);
      video.mp3Path = mp3Path;
      video.audioPath = mp3Path;
      video.audioUrl = `/uploads/audio/${mp3Filename}`;
    } catch (mp3Err) {
      console.error('[Pipeline] Audio compression failed:', mp3Err.message);
      await this.updateVideoState(video, {
        status: 'failed',
        progress: 0,
        step: 'Processing failed: Could not compress audio.',
        error: 'We could not compress the audio for slow connections. Please try uploading the video again.'
      });
      return;
    }

    // Step 4: Writing English captions (Whisper)
    await this.updateVideoState(video, {
      status: 'processing',
      progress: 75,
      step: 'Writing English captions'
    });

    let transcriptionResult;
    try {
      transcriptionResult = await whisperService.transcribeAudio(wavPath, {
        model: process.env.WHISPER_MODEL || 'base',
        language: 'en'
      });
    } catch (whisperErr) {
      console.error('[Pipeline] Speech recognition failed:', whisperErr.message);
      await this.updateVideoState(video, {
        status: 'failed',
        progress: 0,
        step: 'Processing failed: Speech recognition failed.',
        error: 'Automatic captioning could not be completed for this video. Please verify the speech is audible and try again.'
      });
      return;
    }

    // Step 5: Preparing your captions (VTT and transcript)
    await this.updateVideoState(video, {
      status: 'processing',
      progress: 90,
      step: 'Preparing your captions'
    });

    const segments = transcriptionResult.segments || [];
    const transcriptText = vttConverter.segmentsToTranscript(segments);
    video.transcript = transcriptText;
    video.transcriptText = transcriptText;

    // Never overwrite human-edited captions automatically
    const isEnHumanReviewed = video.captions?.en?.reviewStatus === 'human-reviewed';
    const vttFilename = `${video._id}_en.vtt`;
    const vttPath = path.join(CAPTIONS_DIR, vttFilename);

    if (!isEnHumanReviewed || !fs.existsSync(vttPath)) {
      const vttContent = vttConverter.segmentsToWebVTT(segments);
      fs.writeFileSync(vttPath, vttContent, 'utf8');

      video.captions = video.captions || {};
      video.captions.en = {
        vttPath,
        vttUrl: `/uploads/captions/${vttFilename}`,
        status: 'machine-generated',
        reviewStatus: 'machine-generated'
      };
    }

    // Multilingual Caption Generation (Amharic 'am', Afaan Oromoo 'om', Tigrinya 'ti')
    const additionalLangs = ['am', 'om', 'ti'];
    for (const targetLang of additionalLangs) {
      const isReviewed = video.captions?.[targetLang]?.reviewStatus === 'human-reviewed';
      const langVttFilename = `${video._id}_${targetLang}.vtt`;
      const langVttPath = path.join(CAPTIONS_DIR, langVttFilename);

      if (!isReviewed) {
        try {
          console.log(`[Pipeline] Translating English segments into ${targetLang} preserving timestamps...`);
          const langSegments = segments.length > 0 ? await translateSegments(segments, targetLang, 'en') : [];
          const langVttContent = vttConverter.segmentsToWebVTT(langSegments);
          fs.writeFileSync(langVttPath, langVttContent, 'utf8');

          video.captions = video.captions || {};
          video.captions[targetLang] = {
            vttPath: langVttPath,
            vttUrl: `/uploads/captions/${langVttFilename}`,
            status: 'machine-generated',
            reviewStatus: 'machine-generated'
          };
        } catch (transErr) {
          console.warn(`[Pipeline] ${targetLang} translation skipped or failed:`, transErr.message);
        }
      }
    }

    if (typeof video.markModified === 'function') {
      video.markModified('captions');
    }

    // Populate helper captionUrls array
    video.captionUrls = [
      video.captions?.en?.vttUrl,
      video.captions?.am?.vttUrl,
      video.captions?.om?.vttUrl,
      video.captions?.ti?.vttUrl
    ].filter(Boolean);

    // Step 6: Review ready at 100%
    await this.updateVideoState(video, {
      status: 'review',
      progress: 100,
      step: 'Transcription complete. Human review ready.',
      error: null,
      errorMessage: null
    });
  }

  async retryVideo(videoId) {
    let video = await Video.findById(videoId);
    if (!video) {
      throw new Error(`Video with id "${videoId}" not found.`);
    }

    const sourcePath = video.sourcePath || video.videoPath;
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new Error('Cannot retry: Original source video file is no longer on disk.');
    }

    await this.updateVideoState(video, {
      status: 'uploaded',
      progress: 0,
      step: 'Retrying video processing...',
      error: null,
      errorMessage: null
    });

    this.enqueue(video._id.toString());
    return video;
  }

  async resumePendingJobs() {
    try {
      const pendingVideos = await Video.find({ status: { $in: ['uploaded', 'processing'] } });
      if (pendingVideos.length > 0) {
        console.log(`[PipelineQueue] Resuming ${pendingVideos.length} pending video jobs...`);
        for (const vid of pendingVideos) {
          this.enqueue(vid._id.toString());
        }
      }
    } catch (err) {
      console.warn('[PipelineQueue] Could not resume pending jobs:', err.message);
    }
  }
}

module.exports = new PipelineQueue();
