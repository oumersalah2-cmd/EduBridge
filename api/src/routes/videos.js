const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const archiver = require('archiver');

const studioKey = require('../middleware/studioKey');
const Video = require('../models/Video');
const { mockVideo } = require('./mockData');

// Router for studio / processing routes: /api/videos
const videosRouter = express.Router();
// Router for public lesson views: /api/public/videos
const publicVideosRouter = express.Router();

// Ensure upload directories exist
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads');
const VIDEO_DIR = path.join(UPLOADS_DIR, 'videos');
const AUDIO_DIR = path.join(UPLOADS_DIR, 'audio');
const CAPTIONS_DIR = path.join(UPLOADS_DIR, 'captions');
const PACKS_DIR = path.join(UPLOADS_DIR, 'packs');
const BRAILLE_DIR = path.join(UPLOADS_DIR, 'braille');

[UPLOADS_DIR, VIDEO_DIR, AUDIO_DIR, CAPTIONS_DIR, PACKS_DIR, BRAILLE_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      // ignore
    }
  }
});

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VIDEO_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  }
});

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '200', 10);
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.webm', '.mov'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error(`Unsupported video format "${ext}". Please upload an MP4, WebM, or MOV video file.`));
    }
    cb(null, true);
  }
});

// Helper to validate WebVTT content
function isValidWebVTT(content) {
  if (!content || typeof content !== 'string') return false;
  const trimmed = content.trim();
  return trimmed.startsWith('WEBVTT');
}

// ==========================================
// Studio Routes (/api/videos)
// ==========================================

// POST /api/videos - Upload video and optional sign video
videosRouter.post(
  '/',
  studioKey,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'signVideo', maxCount: 1 }
  ]),
  async (req, res, next) => {
    if (process.env.MOCK_API === 'true') {
      return res.status(202).json({
        id: 'mock-video-demo-01',
        status: 'uploaded',
        message: 'Video upload accepted and queued for accessible processing.'
      });
    }

    try {
      if (!req.files || !req.files.video || req.files.video.length === 0) {
        return res.status(400).json({
          error: 'Missing required file: "video". Please provide an MP4, WebM, or MOV video file.'
        });
      }

      const videoFile = req.files.video[0];
      const signFile = req.files.signVideo ? req.files.signVideo[0] : null;

      const videoRecord = new Video({
        title: req.body.title || path.parse(videoFile.originalname).name || 'Accessible Lesson',
        status: 'uploaded',
        progress: 0,
        step: 'Video uploaded. Queued for audio extraction and transcription.',
        videoPath: videoFile.path,
        videoUrl: `/uploads/videos/${videoFile.filename}`,
        signVideoPath: signFile ? signFile.path : null,
        signVideoUrl: signFile ? `/uploads/videos/${signFile.filename}` : null
      });

      await videoRecord.save();

      res.status(202).json({
        id: videoRecord._id.toString(),
        status: videoRecord.status
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/videos/:id - Poll processing progress (for aria-live screen reader updates)
videosRouter.get('/:id', async (req, res, next) => {
  const { id } = req.params;

  if (process.env.MOCK_API === 'true') {
    return res.json({
      id,
      status: mockVideo.status,
      progress: mockVideo.progress,
      step: mockVideo.step,
      error: null
    });
  }

  try {
    let video = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      video = await Video.findById(id);
    }
    if (!video && id === mockVideo.id) {
      video = mockVideo;
    }

    if (!video) {
      return res.status(404).json({
        error: `Lesson video with ID "${id}" was not found.`
      });
    }

    res.json({
      id: video._id ? video._id.toString() : video.id,
      status: video.status,
      progress: video.progress,
      step: video.step,
      error: video.error || null
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/videos/:id/captions/:lang - Save human-edited WebVTT (resets approval)
videosRouter.put('/:id/captions/:lang', studioKey, async (req, res, next) => {
  const { id, lang } = req.params;
  const allowedLangs = ['en', 'am', 'om'];

  if (!allowedLangs.includes(lang)) {
    return res.status(400).json({
      error: `Invalid language code "${lang}". Supported caption languages are: ${allowedLangs.join(', ')}.`
    });
  }

  const vttContent = typeof req.body === 'string' ? req.body : req.body?.vtt;

  if (!isValidWebVTT(vttContent)) {
    return res.status(400).json({
      error: 'Invalid WebVTT captions format. Caption files must begin with the "WEBVTT" header.'
    });
  }

  if (process.env.MOCK_API === 'true') {
    return res.json({
      id,
      lang,
      status: 'saved',
      approved: false,
      message: `Human edits saved for ${lang} captions. Review status has been reset to machine-generated.`
    });
  }

  try {
    let video = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      video = await Video.findById(id);
    }

    if (!video) {
      return res.status(404).json({
        error: `Lesson video with ID "${id}" was not found.`
      });
    }

    const filename = `${video._id}_${lang}.vtt`;
    const filepath = path.join(CAPTIONS_DIR, filename);
    fs.writeFileSync(filepath, vttContent, 'utf8');

    video.captions = video.captions || {};
    video.captions[lang] = {
      vttPath: filepath,
      vttUrl: `/uploads/captions/${filename}`,
      status: 'machine-generated', // Editing a track resets human approval
      approvedAt: null
    };

    await video.save();

    res.json({
      id: video._id.toString(),
      lang,
      status: 'saved',
      approved: false
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/videos/:id/approve/:lang - Mark caption track human-approved
videosRouter.post('/:id/approve/:lang', studioKey, async (req, res, next) => {
  const { id, lang } = req.params;
  const allowedLangs = ['en', 'am', 'om'];

  if (!allowedLangs.includes(lang)) {
    return res.status(400).json({
      error: `Invalid language code "${lang}". Supported caption languages are: ${allowedLangs.join(', ')}.`
    });
  }

  if (process.env.MOCK_API === 'true') {
    return res.json({
      id,
      lang,
      approved: true,
      status: 'human-reviewed'
    });
  }

  try {
    let video = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      video = await Video.findById(id);
    }

    if (!video) {
      return res.status(404).json({
        error: `Lesson video with ID "${id}" was not found.`
      });
    }

    if (!video.captions || !video.captions[lang]) {
      return res.status(400).json({
        error: `No caption track exists for language "${lang}" to approve.`
      });
    }

    video.captions[lang].status = 'human-reviewed';
    video.captions[lang].approvedAt = new Date();
    await video.save();

    res.json({
      id: video._id.toString(),
      lang,
      approved: true,
      status: 'human-reviewed'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/videos/:id/publish - Publish lesson, generate 3G bundle & return embeds
videosRouter.post('/:id/publish', studioKey, async (req, res, next) => {
  const { id } = req.params;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const embedSnippet = `<script src="${baseUrl}/player/embed.js" data-video-id="${id}"></script>`;
  const iframeSnippet = `<iframe src="${baseUrl}/player/index.html?video=${id}" title="EduBridge Accessible Lesson Player" width="100%" height="450" frameborder="0" allowfullscreen></iframe>`;
  const offlinePackUrl = `/api/public/videos/${id}/offlinepack`;

  if (process.env.MOCK_API === 'true') {
    return res.json({
      id,
      status: 'published',
      embedSnippet,
      iframeSnippet,
      offlinePackUrl
    });
  }

  try {
    let video = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      video = await Video.findById(id);
    }

    if (!video) {
      return res.status(404).json({
        error: `Lesson video with ID "${id}" was not found.`
      });
    }

    video.status = 'published';
    video.step = 'Lesson published and ready for accessible distribution.';
    video.embedSnippet = embedSnippet;
    video.iframeSnippet = iframeSnippet;
    video.offlinePackUrl = offlinePackUrl;

    await video.save();

    res.json({
      id: video._id.toString(),
      status: video.status,
      embedSnippet,
      iframeSnippet,
      offlinePackUrl
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// Public Lesson Routes (/api/public/videos)
// ==========================================

// GET /api/public/videos/:id - Public metadata
publicVideosRouter.get('/:id', async (req, res, next) => {
  const { id } = req.params;

  if (process.env.MOCK_API === 'true' || id === mockVideo.id) {
    return res.json({
      ...mockVideo,
      id
    });
  }

  try {
    let video = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      video = await Video.findById(id);
    }

    if (!video) {
      return res.status(404).json({
        error: `Public lesson with ID "${id}" was not found.`
      });
    }

    res.json({
      id: video._id.toString(),
      title: video.title,
      status: video.status,
      audioUrl: video.audioUrl,
      signVideoUrl: video.signVideoUrl,
      captions: {
        en: video.captions?.en?.vttUrl
          ? { url: video.captions.en.vttUrl, status: video.captions.en.status }
          : undefined,
        am: video.captions?.am?.vttUrl
          ? { url: video.captions.am.vttUrl, status: video.captions.am.status }
          : undefined,
        om: video.captions?.om?.vttUrl
          ? { url: video.captions.om.vttUrl, status: video.captions.om.status }
          : undefined
      },
      transcriptText: video.transcriptText,
      chatLog: video.chatLog || [],
      offlinePackUrl: video.offlinePackUrl || `/api/public/videos/${video._id}/offlinepack`,
      brailleUrl: video.brailleUrl
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/videos/:id/offlinepack - Download 3G offline zip package
publicVideosRouter.get('/:id/offlinepack', (req, res, next) => {
  const { id } = req.params;
  const zipName = `edubridge-lesson-${id}-offline.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => next(err));
  archive.pipe(res);

  // Add offline package files
  archive.append('EduBridge Audio-First Offline Lesson\nTranscript:\nWelcome to this accessible lesson.\n', {
    name: 'transcript.txt'
  });
  archive.append(
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Offline Lesson</title></head><body><h1>EduBridge Offline Lesson</h1><p>Accessible offline content.</p></body></html>',
    { name: 'lesson.html' }
  );
  archive.append('EduBridge English Braille Grade 1 Placeholder\n', {
    name: 'lesson.brf'
  });
  archive.append(Buffer.from([]), {
    name: 'audio.mp3'
  });

  archive.finalize();
});

module.exports = {
  videosRouter,
  publicVideosRouter
};
