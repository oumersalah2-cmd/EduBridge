const path = require('path');
const fs = require('fs');
const Video = require('../models/Video');
const ffmpegService = require('./ffmpegService');
const whisperService = require('./whisperService');
const vttConverter = require('./vttConverter');

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
      await this.updateVideoState(video, {
        status: 'failed',
        progress: 0,
        step: 'Processing failed: Unsupported or corrupted video file.',
        error: probeErr.message || 'The video file appears to be corrupted or in an unsupported format.'
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
      await this.updateVideoState(video, {
        status: 'failed',
        progress: 0,
        step: 'Processing failed: Could not extract audio.',
        error: wavErr.message || 'Failed to extract audio track from video.'
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
      await this.updateVideoState(video, {
        status: 'failed',
        progress: 0,
        step: 'Processing failed: Could not compress audio.',
        error: mp3Err.message || 'Failed to compress audio track.'
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
      await this.updateVideoState(video, {
        status: 'failed',
        progress: 0,
        step: 'Processing failed: Speech recognition failed.',
        error: whisperErr.message || 'Automatic speech recognition failed on the extracted audio.'
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
    const vttContent = vttConverter.segmentsToWebVTT(segments);
    const transcriptText = vttConverter.segmentsToTranscript(segments);

    const vttFilename = `${video._id}_en.vtt`;
    const vttPath = path.join(CAPTIONS_DIR, vttFilename);
    fs.writeFileSync(vttPath, vttContent, 'utf8');

    video.captions = video.captions || {};
    video.captions.en = {
      vttPath,
      vttUrl: `/uploads/captions/${vttFilename}`,
      status: 'machine-generated',
      reviewStatus: 'machine-generated'
    };
    video.transcript = transcriptText;
    video.transcriptText = transcriptText;

    // Step 6: Review ready at 100%
    await this.updateVideoState(video, {
      status: 'review',
      progress: 100,
      step: 'Transcription complete. Human review ready.',
      error: null
    });
  }
}

module.exports = new PipelineQueue();
