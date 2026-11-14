const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const archiver = require('archiver');

const studioKey = require('../middleware/studioKey');
const Video = require('../models/Video');
const { getPublicBaseUrl, toAbsoluteUrl } = require('../services/urlHelper');
const { packLessonZip } = require('../services/offlinePackService');
const {
  getMockPublicVideo,
  getMockVideoProgress,
  registerMockVideo
} = require('./mockData');

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
      const err = new Error(`Unsupported video format "${ext}". Please upload an MP4, WebM, or MOV video file.`);
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

function isValidWebVTT(content) {
  if (!content || typeof content !== 'string') return false;
  const trimmed = content.trim();
  return trimmed.startsWith('WEBVTT');
}

// ==========================================
// Studio Routes (/api/videos)
// ==========================================

// POST /api/videos - Upload video and optional sign video (X-Studio-Key)
videosRouter.post(
  '/',
  studioKey,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'signVideo', maxCount: 1 }
  ]),
  async (req, res, next) => {
    if (process.env.MOCK_API === 'true') {
      const mockId = `mock-vid-${Date.now().toString(36)}`;
      registerMockVideo(mockId);
      return res.status(202).json({
        id: mockId,
        status: 'uploaded'
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
        sourcePath: videoFile.path,
        signPath: signFile ? signFile.path : null,
        videoPath: videoFile.path,
        videoUrl: `/uploads/videos/${videoFile.filename}`,
        signVideoPath: signFile ? signFile.path : null,
        signVideoUrl: signFile ? `/uploads/videos/${signFile.filename}` : null
      });

      await videoRecord.save();

      // Trigger pipeline queue if not mock
      const queue = require('../services/pipelineQueue');
      queue.enqueue(videoRecord._id.toString());

      res.status(202).json({
        id: videoRecord._id.toString(),
        status: videoRecord.status
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/videos/:id/preview - Authenticated Studio preview (X-Studio-Key, all statuses except failed)
videosRouter.get('/:id/preview', studioKey, async (req, res, next) => {
  const { id } = req.params;

  if (process.env.MOCK_API === 'true') {
    const mock = getMockPublicVideo(id, req);
    return res.json({
      ...mock,
      status: 'review',
      rawCaptions: {
        en: 'WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nWelcome to this accessible lesson on renewable energy.\n\n00:00:04.500 --> 00:00:09.000\nToday we will explore solar photovoltaic cells and how they generate clean electricity.',
        am: 'WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nእንኳን ወደዚህ ተደራሽ የታዳሽ ኃይል ትምህርት በደህና መጡ።\n\n00:00:04.500 --> 00:00:09.000\nዛሬ የፀሐይ የፎቶቮልታይክ ሴሎችን እና እንዴት ንጹህ ኤሌክትሪክ እንደሚያመነጩ እንመረምራለን።'
      }
    });
  }

  try {
    let video = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      video = await Video.findById(id);
    } else {
      video = await Video.findOne({ $or: [{ _id: id }, { customId: id }] });
    }

    if (!video) {
      return res.status(404).json({
        error: `Lesson with ID "${id}" was not found.`
      });
    }

    if (video.status === 'failed') {
      return res.status(409).json({
        error: 'Preview is not available because processing failed for this lesson.'
      });
    }

    const captions = {};
    const rawCaptions = { en: null, am: null };

    ['en', 'am', 'om'].forEach((lang) => {
      const track = video.captions && video.captions[lang];
      if (track && (track.vttUrl || track.vttPath || track.url)) {
        captions[lang] = {
          url: toAbsoluteUrl(track.vttUrl || track.url || `/uploads/captions/${video._id}_${lang}.vtt`, req),
          reviewStatus: track.reviewStatus || track.status || 'machine-generated'
        };
      }

      // Read raw WebVTT content if present
      if (track && track.vttPath && fs.existsSync(track.vttPath)) {
        try {
          rawCaptions[lang] = fs.readFileSync(track.vttPath, 'utf8');
        } catch (e) {
          rawCaptions[lang] = null;
        }
      } else if (track && (track.vttUrl || track.url)) {
        const candidate = path.resolve(__dirname, `../../${(track.vttUrl || track.url).replace(/^\//, '')}`);
        if (fs.existsSync(candidate)) {
          try {
            rawCaptions[lang] = fs.readFileSync(candidate, 'utf8');
          } catch (e) {}
        }
      }
    });

    let videoUrl = null;
    const relVideo = video.videoUrl || (video.sourcePath ? `/uploads/videos/${path.basename(video.sourcePath)}` : null);
    if (relVideo) {
      videoUrl = toAbsoluteUrl(relVideo, req);
    }

    res.json({
      id: video._id.toString(),
      title: video.title,
      status: video.status,
      videoUrl,
      audioUrl: toAbsoluteUrl(video.audioUrl || video.audioPath || '', req),
      signVideoUrl: video.signVideoUrl ? toAbsoluteUrl(video.signVideoUrl, req) : null,
      captions,
      rawCaptions,
      transcript: video.transcript || video.transcriptText || '',
      chatLog: Array.isArray(video.chatLog) ? video.chatLog.map(c => ({
        id: c.id || c._id?.toString(),
        type: c.type || 'question',
        text: c.text,
        ts: c.ts || (c.createdAt ? c.createdAt.getTime() : Date.now())
      })) : [],
      offlinePackUrl: toAbsoluteUrl(video.offlinePackUrl || `/api/public/videos/${video._id}/offlinepack`, req),
      brailleUrl: video.brailleUrl ? toAbsoluteUrl(video.brailleUrl, req) : null
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/videos/:id - Poll processing progress (for aria-live announcements)
videosRouter.get('/:id', async (req, res, next) => {
  const { id } = req.params;

  if (process.env.MOCK_API === 'true') {
    return res.json(getMockVideoProgress(id));
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

    res.json({
      id: video._id.toString(),
      status: video.status,
      progress: video.progress,
      step: video.step,
      error: video.error || null
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/videos/:id/captions/:lang - Save human-edited WebVTT (X-Studio-Key, resets approval)
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
      reviewStatus: 'machine-generated',
      approved: false
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
      status: 'machine-generated', // Editing resets approval
      approvedAt: null
    };

    await video.save();

    res.json({
      id: video._id.toString(),
      lang,
      status: 'saved',
      reviewStatus: 'machine-generated',
      approved: false
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/videos/:id/approve/:lang - Mark caption track human-approved (X-Studio-Key)
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
      reviewStatus: 'human-reviewed'
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
      reviewStatus: 'human-reviewed'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/videos/:id/publish - Publish lesson, build pack & return embeds (X-Studio-Key)
videosRouter.post('/:id/publish', studioKey, async (req, res, next) => {
  const { id } = req.params;
  const base = getPublicBaseUrl(req);

  const embedScript = `<script src="${base}/player/embed.js" data-video-id="${id}"></script>`;
  const embedIframe = `<iframe src="${base}/player/index.html?video=${id}" title="EduBridge Accessible Lesson Player" width="100%" height="450" frameborder="0" allowfullscreen></iframe>`;
  const offlinePackUrl = `${base}/api/public/videos/${id}/offlinepack`;

  if (process.env.MOCK_API === 'true') {
    return res.json({
      status: 'published',
      embedScript,
      embedIframe,
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

    if (video.status !== 'review') {
      return res.status(409).json({
        error: `Lesson video cannot be published from status "${video.status}". Only lessons in "review" status can be published.`
      });
    }

    // Build 3G offline package
    const zipFilename = `edubridge-lesson-${video._id}-offline.zip`;
    const zipPath = path.join(PACKS_DIR, zipFilename);
    const writeStream = fs.createWriteStream(zipPath);
    await packLessonZip(video, writeStream);

    video.status = 'published';
    video.step = 'Lesson published and ready for accessible distribution.';
    video.embedSnippet = embedScript;
    video.iframeSnippet = embedIframe;
    video.offlinePackPath = zipPath;
    video.offlinePackUrl = offlinePackUrl;

    await video.save();

    res.json({
      status: video.status,
      embedScript,
      embedIframe,
      offlinePackUrl
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// Public Lesson Routes (/api/public/videos)
// ==========================================

// GET /api/public/videos/:id - Public metadata with absolute URLs
publicVideosRouter.get('/:id', async (req, res, next) => {
  const { id } = req.params;

  if (process.env.MOCK_API === 'true') {
    return res.json(getMockPublicVideo(id, req));
  }

  try {
    let video = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      video = await Video.findById(id);
    } else {
      video = await Video.findOne({ $or: [{ _id: id }, { customId: id }] });
    }

    if (!video) {
      return res.status(404).json({
        error: `Public lesson with ID "${id}" was not found.`
      });
    }

    if (video.status !== 'published') {
      return res.status(409).json({
        error: `This lesson is currently "${video.status}" and is not yet available for public access.`
      });
    }

    const captions = {};
    ['en', 'am', 'om'].forEach((lang) => {
      const track = video.captions && video.captions[lang];
      if (track && (track.vttUrl || track.vttPath || track.url)) {
        captions[lang] = {
          url: toAbsoluteUrl(track.vttUrl || track.url || `/uploads/captions/${video._id}_${lang}.vtt`, req),
          reviewStatus: track.reviewStatus || track.status || 'machine-generated'
        };
      }
    });

    let videoUrl = null;
    const relVideo = video.videoUrl || (video.sourcePath ? `/uploads/videos/${path.basename(video.sourcePath)}` : null);
    if (relVideo) {
      videoUrl = toAbsoluteUrl(relVideo, req);
    }

    res.json({
      id: video._id.toString(),
      title: video.title,
      status: video.status,
      videoUrl,
      audioUrl: toAbsoluteUrl(video.audioUrl || video.audioPath || '', req),
      signVideoUrl: video.signVideoUrl ? toAbsoluteUrl(video.signVideoUrl, req) : null,
      captions,
      transcript: video.transcript || video.transcriptText || '',
      chatLog: Array.isArray(video.chatLog) ? video.chatLog.map(c => ({
        id: c.id || c._id?.toString(),
        type: c.type || 'question',
        text: c.text,
        ts: c.ts || (c.createdAt ? c.createdAt.getTime() : Date.now())
      })) : [],
      offlinePackUrl: toAbsoluteUrl(video.offlinePackUrl || `/api/public/videos/${video._id}/offlinepack`, req),
      brailleUrl: video.brailleUrl ? toAbsoluteUrl(video.brailleUrl, req) : null
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/videos/:id/offlinepack - Download 3G offline zip package
publicVideosRouter.get('/:id/offlinepack', async (req, res, next) => {
  const { id } = req.params;
  const zipName = `edubridge-lesson-${id}-offline.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  if (process.env.MOCK_API === 'true') {
    const mockDoc = {
      _id: id,
      title: 'Accessible Renewable Energy & Photovoltaics (Demo Lesson)',
      transcript: 'Welcome to this accessible lesson on renewable energy. Today we will explore solar photovoltaic cells and how they generate clean electricity. Notice how sunlight frees electrons in the semiconductor material.'
    };
    return packLessonZip(mockDoc, res).catch((err) => next(err));
  }

  try {
    let video = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      video = await Video.findById(id);
    } else {
      video = await Video.findOne({ $or: [{ _id: id }, { customId: id }] });
    }

    if (!video) {
      res.status(404).setHeader('Content-Type', 'application/json');
      return res.json({
        error: `Lesson video with ID "${id}" was not found.`
      });
    }

    if (video.status !== 'published' && video.status !== 'review') {
      res.status(409).setHeader('Content-Type', 'application/json');
      return res.json({
        error: `Lesson video with ID "${id}" is not published.`
      });
    }

    // If pre-built zip exists, stream it directly
    const cachedPack = video.offlinePackPath || path.join(PACKS_DIR, zipName);
    if (fs.existsSync(cachedPack) && fs.statSync(cachedPack).size > 0) {
      return fs.createReadStream(cachedPack).pipe(res);
    }

    // Build and stream zip
    await packLessonZip(video, res);
  } catch (err) {
    next(err);
  }
});

module.exports = {
  videosRouter,
  publicVideosRouter
};
