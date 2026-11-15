const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Video = require('../models/Video');
const Webhook = require('../models/Webhook');
const studioKey = require('../middleware/studioKey');
const { getPublicBaseUrl, toAbsoluteUrl } = require('../services/urlHelper');
const { packLessonZip } = require('../services/offlinePackService');
const { getMockPublicVideo } = require('./mockData');
const {
  validateWebhookUrl,
  fireWebhook,
  registerMemoryWebhook,
  removeMemoryWebhook,
  getMemoryWebhooks
} = require('../services/webhookService');
const { createSignedCertificate, verifyCertificate } = require('../services/certificateService');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads');
const PACKS_DIR = path.join(UPLOADS_DIR, 'packs');
const CAPTIONS_DIR = path.join(UPLOADS_DIR, 'captions');

function isValidWebVTT(content) {
  if (!content || typeof content !== 'string') return false;
  const trimmed = content.trim();
  return trimmed.startsWith('WEBVTT') || trimmed.startsWith('\ufeffWEBVTT');
}

// -------------------------------------------------------------
// Lessons Endpoints (/api/v1/lessons)
// -------------------------------------------------------------

// POST /api/v1/lessons - Alias to video upload
router.post('/lessons', (req, res, next) => {
  const { videosRouter } = require('./videos');
  req.url = '/';
  return videosRouter.handle(req, res, next);
});

// GET /api/v1/lessons - Alias to video list
router.get('/lessons', (req, res, next) => {
  const { videosRouter } = require('./videos');
  req.url = '/';
  return videosRouter.handle(req, res, next);
});

// POST /api/v1/lessons/:id/approve/:lang - Alias to approve
router.post('/lessons/:id/approve/:lang', (req, res, next) => {
  const { videosRouter } = require('./videos');
  req.url = `/${req.params.id}/approve/${req.params.lang}`;
  return videosRouter.handle(req, res, next);
});

// POST /api/v1/lessons/:id/publish - Alias to publish
router.post('/lessons/:id/publish', (req, res, next) => {
  const { videosRouter } = require('./videos');
  req.url = `/${req.params.id}/publish`;
  return videosRouter.handle(req, res, next);
});

// POST /api/v1/lessons/:id/retry - Alias to retry
router.post('/lessons/:id/retry', (req, res, next) => {
  const { videosRouter } = require('./videos');
  req.url = `/${req.params.id}/retry`;
  return videosRouter.handle(req, res, next);
});

// GET /api/v1/lessons/:id/captions/:lang - Alias to caption download
router.get('/lessons/:id/captions/:lang', (req, res, next) => {
  const { videosRouter } = require('./videos');
  req.url = `/${req.params.id}/captions/${req.params.lang}`;
  return videosRouter.handle(req, res, next);
});

// GET /api/v1/lessons/:id - Published lesson metadata with tracks and offlinePackSizeBytes
router.get('/lessons/:id', async (req, res, next) => {
  const { id } = req.params;

  if (process.env.MOCK_API === 'true') {
    const mock = getMockPublicVideo(id, req);
    const tracks = [];
    ['en', 'am', 'om', 'ti'].forEach((lang) => {
      if (mock.captions && mock.captions[lang]) {
        tracks.push({
          kind: 'captions',
          lang,
          url: mock.captions[lang].url,
          reviewStatus: mock.captions[lang].reviewStatus
        });
      }
    });
    tracks.push(
      { kind: 'sign', url: mock.signVideoUrl },
      { kind: 'audio', url: mock.audioUrl }
    );
    if (mock.audioDescriptionUrl) {
      tracks.push({ kind: 'audio-description', url: mock.audioDescriptionUrl });
    }
    const captionUrls = ['en', 'am', 'om', 'ti']
      .map((l) => mock.captions?.[l]?.url)
      .filter(Boolean);
    const approved = {
      en: mock.captions?.en?.reviewStatus === 'human-reviewed',
      am: mock.captions?.am?.reviewStatus === 'human-reviewed',
      om: mock.captions?.om?.reviewStatus === 'human-reviewed',
      ti: mock.captions?.ti?.reviewStatus === 'human-reviewed'
    };
    return res.json({
      ...mock,
      captionUrls,
      approved,
      tracks,
      offlinePackSizeBytes: 1048576 // 1MB mock size
    });
  }

  try {
    let video = null;
    try {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        video = await Video.findById(id);
      } else {
        video = await Video.findOne({ $or: [{ _id: id }, { customId: id }] });
      }
    } catch (e) {
      // Mongo offline
    }

    if (!video) {
      return res.status(404).json({
        error: `Lesson with ID "${id}" was not found.`,
        code: 'LESSON_NOT_FOUND'
      });
    }

    if (video.status !== 'published') {
      const isStudio = Boolean(req.header('X-Studio-Key') || req.query.status === 'all' || req.query.preview === 'true');
      if (!isStudio) {
        return res.status(409).json({
          error: `This lesson is currently "${video.status}" and is not yet available for public access.`,
          code: 'LESSON_NOT_PUBLISHED'
        });
      }
    }

    const captions = {};
    const captionUrls = [];
    const tracks = [];

    ['en', 'am', 'om', 'ti'].forEach((lang) => {
      const track = video.captions && video.captions[lang];
      if (track && (track.vttUrl || track.vttPath || track.url)) {
        const absoluteUrl = toAbsoluteUrl(track.vttUrl || track.url || `/uploads/captions/${video._id}_${lang}.vtt`, req);
        const reviewStatus = track.reviewStatus || track.status || 'machine-generated';
        captions[lang] = { url: absoluteUrl, reviewStatus };
        captionUrls.push(absoluteUrl);
        tracks.push({
          kind: 'captions',
          lang,
          url: absoluteUrl,
          reviewStatus
        });
      }
    });

    if (video.signVideoUrl || video.signVideoPath) {
      tracks.push({
        kind: 'sign',
        url: toAbsoluteUrl(video.signVideoUrl || `/uploads/videos/${path.basename(video.signVideoPath)}`, req)
      });
    }

    if (video.audioUrl || video.audioPath || video.mp3Path) {
      tracks.push({
        kind: 'audio',
        url: toAbsoluteUrl(video.audioUrl || `/uploads/audio/${video._id}_64k.mp3`, req)
      });
    }

    if (video.audioDescriptionUrl || video.audioDescriptionPath) {
      tracks.push({
        kind: 'audio-description',
        url: toAbsoluteUrl(video.audioDescriptionUrl || `/uploads/audio/${path.basename(video.audioDescriptionPath)}`, req)
      });
    }

    let offlinePackSizeBytes = video.offlinePackSizeBytes || 0;
    const zipName = `edubridge-lesson-${video._id}-offline.zip`;
    const cachedPack = video.offlinePackPath || path.join(PACKS_DIR, zipName);
    if (fs.existsSync(cachedPack)) {
      try {
        offlinePackSizeBytes = fs.statSync(cachedPack).size;
      } catch (e) {}
    }

    const relVideo = video.videoUrl || (video.sourcePath ? `/uploads/videos/${path.basename(video.sourcePath)}` : null);
    const videoUrl = relVideo ? toAbsoluteUrl(relVideo, req) : null;

    res.json({
      id: video._id.toString(),
      title: video.title,
      status: video.status,
      progress: video.progress,
      step: video.step,
      error: video.error || video.errorMessage || null,
      errorMessage: video.error || video.errorMessage || null,
      videoUrl,
      audioUrl: toAbsoluteUrl(video.audioUrl || video.audioPath || '', req),
      signUrl: video.signVideoUrl ? toAbsoluteUrl(video.signVideoUrl, req) : null,
      signVideoUrl: video.signVideoUrl ? toAbsoluteUrl(video.signVideoUrl, req) : null,
      audioDescriptionUrl: video.audioDescriptionUrl ? toAbsoluteUrl(video.audioDescriptionUrl, req) : null,
      captions,
      captionUrls,
      approved: {
        en: video.captions?.en?.reviewStatus === 'human-reviewed',
        am: video.captions?.am?.reviewStatus === 'human-reviewed',
        om: video.captions?.om?.reviewStatus === 'human-reviewed',
        ti: video.captions?.ti?.reviewStatus === 'human-reviewed'
      },
      tracks,
      transcript: video.transcript || video.transcriptText || '',
      chatLog: Array.isArray(video.chatLog) ? video.chatLog.map((c) => ({
        id: c.id || c._id?.toString(),
        type: c.type || 'question',
        text: c.text,
        ts: c.ts || (c.createdAt ? c.createdAt.getTime() : Date.now())
      })) : [],
      offlinePackUrl: toAbsoluteUrl(video.offlinePackUrl || `/api/public/videos/${video._id}/offlinepack`, req),
      offlinePackSizeBytes,
      brailleUrl: video.brailleUrl ? toAbsoluteUrl(video.brailleUrl, req) : null
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/lessons/:id/transcript?lang=en|am|om|ti - Raw text/plain transcript
router.get('/lessons/:id/transcript', async (req, res, next) => {
  const { id } = req.params;
  const lang = (req.query.lang || 'en').toLowerCase();
  const allowed = ['en', 'am', 'om', 'ti'];

  if (!allowed.includes(lang)) {
    return res.status(400).json({
      error: `Invalid transcript language "${lang}". Supported languages are: ${allowed.join(', ')}.`,
      code: 'INVALID_LANGUAGE'
    });
  }

  if (process.env.MOCK_API === 'true') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (lang === 'am') {
      return res.send('እንኳን ወደዚህ ተደራሽ የታዳሽ ኃይል ትምህርት በደህና መጡ። ዛሬ የፀሐይ የፎቶቮልታይክ ሴሎችን እንመረምራለን።');
    }
    if (lang === 'om') {
      return res.send("Baga gara barnoota anniisaa haaromfamuu qaqqabamaa kanaatti nagaan dhuftan. Har'a seelota soolaarii footoovooltaayikii fi akkamitti elektirikii qulqulluu akka maddisiisan ni qoranna.");
    }
    if (lang === 'ti') {
      return res.send('እንቋዕ ናብዚ ተበጻሒ ናይ ዝሕደስ ሓይሊ ትምህርቲ ብደሓን መጻእኩም። ሎሚ ናይ ፀሓይ ፎቶቮልታይክ ሴላትን ከመይ ጌሮም ጽሩይ ኤሌክትሪክ ከም ዘመንጩን ክንምሃር ኢና።');
    }
    return res.send('Welcome to this accessible lesson on renewable energy. Today we will explore solar photovoltaic cells and how they generate clean electricity.');
  }

  try {
    let video = null;
    try {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        video = await Video.findById(id);
      } else {
        video = await Video.findOne({ $or: [{ _id: id }, { customId: id }] });
      }
    } catch (e) {}

    if (!video) {
      return res.status(404).json({
        error: `Lesson with ID "${id}" was not found.`,
        code: 'LESSON_NOT_FOUND'
      });
    }

    if (lang === 'en') {
      const text = video.transcript || video.transcriptText;
      if (!text) {
        return res.status(404).json({
          error: 'No English transcript exists for this lesson.',
          code: 'TRANSCRIPT_NOT_FOUND'
        });
      }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(text);
    }

    const track = video.captions && video.captions[lang];
    let langText = null;
    if (track && track.vttPath && fs.existsSync(track.vttPath)) {
      try {
        const vtt = fs.readFileSync(track.vttPath, 'utf8');
        langText = vtt.replace(/^WEBVTT[^\n]*\n+/i, '').replace(/\d{2}:\d{2}:[^\n]+/g, '').trim();
      } catch (e) {}
    }
    if (!langText) {
      return res.status(404).json({
        error: `No ${lang} transcript exists for this lesson.`,
        code: 'TRANSCRIPT_NOT_FOUND'
      });
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(langText);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/lessons/:id/offline-pack - Alias to offline pack zip download
router.get('/lessons/:id/offline-pack', (req, res, next) => {
  req.url = `/${req.params.id}/offlinepack`;
  const { publicVideosRouter } = require('./videos');
  return publicVideosRouter.handle(req, res, next);
});

// POST /api/v1/lessons/:id/captions - Add/edit captions via JSON { lang, vtt } (X-Studio-Key)
router.post('/lessons/:id/captions', studioKey, async (req, res, next) => {
  const { id } = req.params;
  const { lang, vtt } = req.body;
  const allowedLangs = ['en', 'am', 'om', 'ti'];

  if (!allowedLangs.includes(lang)) {
    return res.status(400).json({
      error: `Invalid language code "${lang}". Supported caption languages are: ${allowedLangs.join(', ')}.`,
      code: 'INVALID_LANGUAGE'
    });
  }

  if (!isValidWebVTT(vtt)) {
    return res.status(400).json({
      error: 'Invalid WebVTT captions format. Caption files must begin with the "WEBVTT" header.',
      code: 'INVALID_VTT'
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
    try {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        video = await Video.findById(id);
      } else {
        video = await Video.findOne({ $or: [{ _id: id }, { customId: id }] });
      }
    } catch (e) {}

    if (!video) {
      return res.status(404).json({
        error: `Lesson video with ID "${id}" was not found.`,
        code: 'LESSON_NOT_FOUND'
      });
    }

    if (!fs.existsSync(CAPTIONS_DIR)) {
      try { fs.mkdirSync(CAPTIONS_DIR, { recursive: true }); } catch (e) {}
    }

    const vttFilename = `${video._id}_${lang}.vtt`;
    const vttPath = path.join(CAPTIONS_DIR, vttFilename);
    fs.writeFileSync(vttPath, vtt.trim(), 'utf8');

    video.captions = video.captions || {};
    video.captions[lang] = {
      vttPath,
      vttUrl: `/uploads/captions/${vttFilename}`,
      status: 'machine-generated',
      reviewStatus: 'machine-generated',
      approvedAt: null
    };

    if (typeof video.markModified === 'function') {
      video.markModified('captions');
    }
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

// DELETE /api/v1/lessons/:id - Delete lesson and all associated files (X-Studio-Key)
router.delete('/lessons/:id', studioKey, async (req, res, next) => {
  const { id } = req.params;

  if (process.env.MOCK_API === 'true') {
    return res.status(204).send();
  }

  try {
    let video = null;
    try {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        video = await Video.findById(id);
      } else {
        video = await Video.findOne({ $or: [{ _id: id }, { customId: id }] });
      }
    } catch (e) {}

    if (!video) {
      return res.status(404).json({
        error: `Lesson with ID "${id}" was not found.`,
        code: 'LESSON_NOT_FOUND'
      });
    }

    // Collect all associated files
    const filesToDelete = [
      video.sourcePath,
      video.videoPath,
      video.signPath,
      video.signVideoPath,
      video.wavPath,
      video.mp3Path,
      video.audioPath,
      video.audioDescriptionPath,
      video.offlinePackPath,
      video.braillePath,
      video.transcriptPath,
      video.captions?.en?.vttPath,
      video.captions?.am?.vttPath,
      video.captions?.om?.vttPath,
      video.captions?.ti?.vttPath
    ].filter(Boolean);

    // Delete files safely
    filesToDelete.forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.warn(`[DeleteLesson] Failed to unlink file "${filePath}":`, e.message);
      }
    });

    try {
      await Video.deleteOne({ _id: video._id });
    } catch (e) {}

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// Webhooks Endpoints (/api/v1/webhooks)
// -------------------------------------------------------------

router.post('/webhooks', studioKey, async (req, res, next) => {
  const { url, events } = req.body;

  if (!url || !events || !Array.isArray(events) || events.length === 0) {
    return res.status(400).json({
      error: 'Webhook requires "url" and non-empty "events" array.',
      code: 'WEBHOOK_INVALID'
    });
  }

  const validation = validateWebhookUrl(url);
  if (!validation.valid) {
    return res.status(400).json({
      error: validation.reason,
      code: 'WEBHOOK_INVALID'
    });
  }

  const generatedId = `wh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const hookData = {
    url,
    events,
    createdAt: new Date().toISOString()
  };

  // Register in memory store
  registerMemoryWebhook(generatedId, hookData);

  try {
    const hook = new Webhook({ url, events });
    await hook.save();
    registerMemoryWebhook(hook._id.toString(), hookData);
  } catch (err) {
    // Mongo offline - in-memory registration active
  }

  res.status(201).json({
    id: generatedId,
    url: hookData.url,
    events: hookData.events,
    createdAt: hookData.createdAt
  });
});

router.get('/webhooks', studioKey, async (req, res, next) => {
  if (process.env.MOCK_API === 'true') {
    return res.json([
      { id: 'wh-mock-1', url: 'https://example.com/webhook', events: ['lesson.published'], createdAt: new Date().toISOString() }
    ]);
  }

  try {
    let hooks = [];
    try {
      hooks = await Webhook.find().sort({ createdAt: -1 });
    } catch (e) {}

    if (!hooks || hooks.length === 0) {
      hooks = getMemoryWebhooks();
      return res.json(hooks);
    }

    res.json(hooks.map((h) => ({
      id: h._id.toString(),
      url: h.url,
      events: h.events,
      createdAt: h.createdAt
    })));
  } catch (err) {
    next(err);
  }
});

router.delete('/webhooks/:id', studioKey, async (req, res, next) => {
  const { id } = req.params;

  removeMemoryWebhook(id);

  try {
    await Webhook.findByIdAndDelete(id);
  } catch (err) {}

  return res.status(204).send();
});

// -------------------------------------------------------------
// Certificates Endpoints (/api/v1/certificates)
// -------------------------------------------------------------

router.post('/certificates', studioKey, async (req, res, next) => {
  try {
    const cert = createSignedCertificate(req.body);
    res.status(201).json(cert);
  } catch (err) {
    next(err);
  }
});

router.get('/certificates/:id/verify', async (req, res, next) => {
  const { id } = req.params;
  const result = verifyCertificate(id);
  res.json(result);
});

module.exports = router;
