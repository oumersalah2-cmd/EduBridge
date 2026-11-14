const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const studioKey = require('../middleware/studioKey');
const sseHub = require('../services/sseHub');
const LiveSession = require('../models/LiveSession');
const Video = require('../models/Video');
const { getPublicBaseUrl } = require('../services/urlHelper');
const { packLessonZip } = require('../services/offlinePackService');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads');
const CAPTIONS_DIR = path.join(UPLOADS_DIR, 'captions');
const PACKS_DIR = path.join(UPLOADS_DIR, 'packs');

[CAPTIONS_DIR, PACKS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {}
  }
});

function formatVttTime(seconds) {
  const s = Math.max(0, seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function buildVttFromFinalCaptions(finalCaptions, sessionStartMs) {
  if (!finalCaptions || finalCaptions.length === 0) return null;
  const sorted = [...finalCaptions].sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const baseMs = sessionStartMs || sorted[0].ts || Date.now();

  const lines = ['WEBVTT\n'];
  let lastEndSec = 0;

  sorted.forEach((cap, idx) => {
    const rawStartSec = cap.ts ? Math.max(0, (cap.ts - baseMs) / 1000) : lastEndSec;
    const startSec = Math.max(rawStartSec, lastEndSec);
    const words = (cap.text || '').trim().split(/\s+/).filter(Boolean).length;
    const estimatedDuration = Math.min(6, Math.max(2, words * 0.4));
    const endSec = Number((startSec + estimatedDuration).toFixed(3));
    lastEndSec = endSec;

    lines.push(String(idx + 1));
    lines.push(`${formatVttTime(startSec)} --> ${formatVttTime(endSec)}`);
    lines.push(cap.text.trim());
    lines.push('');
  });

  return lines.join('\n');
}

// Helper to generate a non-guessable 6-digit PIN
function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// In-memory fallback sessions store for offline/mock operation
const inMemorySessions = new Map();
const inMemoryArchivedLessons = new Map();

function getArchivedLesson(id) {
  return inMemoryArchivedLessons.get(id) || null;
}

// POST /api/live/sessions - Create live classroom session (X-Studio-Key)
router.post('/sessions', studioKey, async (req, res, next) => {
  try {
    let pin = generatePin();
    let collision = true;
    let attempts = 0;

    while (collision && attempts < 10) {
      attempts++;
      if (inMemorySessions.has(pin)) {
        pin = generatePin();
        continue;
      }
      try {
        const existing = await LiveSession.findOne({ pin, status: 'active' });
        if (existing) {
          pin = generatePin();
          continue;
        }
      } catch (e) {
        // Mongo offline
      }
      collision = false;
    }

    const createdAt = new Date();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4-hour session
    const baseUrl = getPublicBaseUrl(req);
    const joinUrl = `${baseUrl}/live/${pin}`;

    const sessionData = {
      pin,
      joinUrl,
      createdAt,
      expiresAt,
      status: 'active',
      captions: [],
      boardNotes: [],
      questions: []
    };

    inMemorySessions.set(pin, sessionData);

    try {
      const session = new LiveSession(sessionData);
      await session.save();
    } catch (e) {
      // Running offline
    }

    res.status(201).json({
      pin,
      joinUrl,
      expiresAt: expiresAt.toISOString()
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/live/sessions/:pin/stream - Public SSE stream
router.get('/sessions/:pin/stream', async (req, res, next) => {
  const { pin } = req.params;
  const lastEventId = req.header('Last-Event-ID') || req.query.lastEventId;

  let exists = inMemorySessions.has(pin);
  if (!exists) {
    try {
      const dbSession = await LiveSession.findOne({ pin, status: 'active' });
      if (dbSession) exists = true;
    } catch (e) {
      // Mongo offline
    }
  }

  // In mock mode, allow any 6-digit pin or mock session
  if (!exists && process.env.MOCK_API !== 'true') {
    return res.status(404).json({
      error: `Live session with PIN "${pin}" was not found or has already concluded.`,
      code: 'SESSION_NOT_FOUND'
    });
  }

  sseHub.addClient(pin, res, lastEventId);
});

// POST /api/live/sessions/:pin/captions - Teacher speech captions (X-Studio-Key)
router.post('/sessions/:pin/captions', studioKey, async (req, res, next) => {
  const { pin } = req.params;
  const { text, isFinal, ts } = req.body;

  let session = inMemorySessions.get(pin);
  if (!session) {
    try {
      session = await LiveSession.findOne({ pin, status: 'active' });
    } catch (e) {}
  }

  if (!session && process.env.MOCK_API !== 'true') {
    return res.status(404).json({
      error: `Live session with PIN "${pin}" was not found or has already concluded.`,
      code: 'SESSION_NOT_FOUND'
    });
  }

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      error: 'Caption text is required and must be a valid string.',
      code: 'INVALID_CAPTION'
    });
  }

  const captionData = {
    text: text.trim(),
    isFinal: Boolean(isFinal),
    ts: ts || Date.now()
  };

  sseHub.broadcast(pin, 'caption', captionData);

  if (captionData.isFinal) {
    const mem = inMemorySessions.get(pin);
    if (mem) {
      mem.captions.push(captionData);
    }
    try {
      await LiveSession.updateOne(
        { pin, status: 'active' },
        { $push: { captions: captionData } }
      );
    } catch (e) {
      // Mongo offline
    }
  }

  res.json({ status: 'broadcasted' });
});

// POST /api/live/sessions/:pin/board - Teacher board / slide notes (X-Studio-Key)
router.post('/sessions/:pin/board', studioKey, async (req, res, next) => {
  const { pin } = req.params;
  const { text } = req.body;

  let session = inMemorySessions.get(pin);
  if (!session) {
    try {
      session = await LiveSession.findOne({ pin, status: 'active' });
    } catch (e) {}
  }

  if (!session && process.env.MOCK_API !== 'true') {
    return res.status(404).json({
      error: `Live session with PIN "${pin}" was not found or has already concluded.`,
      code: 'SESSION_NOT_FOUND'
    });
  }

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      error: 'Board note text is required and must be a valid string.',
      code: 'INVALID_BOARD_NOTE'
    });
  }

  const boardData = {
    id: `board-${Date.now()}`,
    text: text.trim(),
    ts: Date.now()
  };

  sseHub.broadcast(pin, 'board', boardData);

  const mem = inMemorySessions.get(pin);
  if (mem) {
    mem.boardNotes.push(boardData);
  }
  try {
    await LiveSession.updateOne(
      { pin, status: 'active' },
      { $push: { boardNotes: boardData } }
    );
  } catch (e) {
    // Mongo offline
  }

  res.json({ status: 'broadcasted' });
});

// POST /api/live/sessions/:pin/questions - Public student question (Rate Limited)
router.post('/sessions/:pin/questions', async (req, res, next) => {
  const { pin } = req.params;
  const { text } = req.body;

  let session = inMemorySessions.get(pin);
  if (!session) {
    try {
      session = await LiveSession.findOne({ pin, status: 'active' });
    } catch (e) {}
  }

  if (!session && process.env.MOCK_API !== 'true') {
    return res.status(404).json({
      error: `Live session with PIN "${pin}" was not found or has already concluded.`,
      code: 'SESSION_NOT_FOUND'
    });
  }

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      error: 'Question text is required and must be a valid string.',
      code: 'INVALID_QUESTION'
    });
  }

  if (text.length > 500) {
    return res.status(400).json({
      error: 'Question text exceeds maximum length of 500 characters.',
      code: 'QUESTION_TOO_LONG'
    });
  }

  const sanitizedText = text.replace(/<[^>]*>/g, '').trim();

  const questionId = `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const questionData = {
    id: questionId,
    text: sanitizedText,
    dismissed: false,
    createdAt: new Date(),
    ts: Date.now()
  };

  const mem = inMemorySessions.get(pin);
  if (mem) {
    mem.questions.push(questionData);
  }
  try {
    await LiveSession.updateOne(
      { pin, status: 'active' },
      { $push: { questions: questionData } }
    );
  } catch (e) {
    // Mongo offline
  }

  sseHub.broadcast(pin, 'question-status', {
    action: 'new',
    question: questionData
  });

  res.status(201).json({
    id: questionId,
    status: 'received'
  });
});

// GET /api/live/sessions/:pin/questions - Teacher view of questions (X-Studio-Key)
router.get('/sessions/:pin/questions', studioKey, async (req, res, next) => {
  const { pin } = req.params;

  if (process.env.MOCK_API === 'true') {
    return res.json([
      {
        id: 'q-mock-1',
        text: 'Could you re-explain the circuit voltage loop?',
        dismissed: false,
        createdAt: new Date().toISOString()
      }
    ]);
  }

  const mem = inMemorySessions.get(pin);
  if (mem) {
    return res.json(mem.questions.filter((q) => !q.dismissed));
  }

  try {
    const session = await LiveSession.findOne({ pin });
    if (!session) {
      return res.status(404).json({
        error: `Live session with PIN "${pin}" was not found.`,
        code: 'SESSION_NOT_FOUND'
      });
    }

    res.json(session.questions.filter((q) => !q.dismissed));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/live/sessions/:pin/questions/:qid - Teacher dismiss question (X-Studio-Key)
router.delete('/sessions/:pin/questions/:qid', studioKey, async (req, res, next) => {
  const { pin, qid } = req.params;

  const mem = inMemorySessions.get(pin);
  if (mem) {
    const q = mem.questions.find((item) => item.id === qid);
    if (q) q.dismissed = true;
  }
  try {
    await LiveSession.updateOne(
      { pin, 'questions.id': qid },
      { $set: { 'questions.$.dismissed': true } }
    );
  } catch (e) {
    // Mongo offline
  }

  sseHub.broadcast(pin, 'question-status', {
    action: 'dismissed',
    questionId: qid
  });

  res.json({ status: 'dismissed', id: qid });
});

// POST /api/live/sessions/:pin/end - End session and archive into video lesson (X-Studio-Key)
router.post('/sessions/:pin/end', studioKey, async (req, res, next) => {
  const { pin } = req.params;

  let session = inMemorySessions.get(pin);
  if (!session) {
    try {
      session = await LiveSession.findOne({ pin });
    } catch (e) {
      // Mongo offline
    }
  }

  if (!session && process.env.MOCK_API !== 'true') {
    return res.status(404).json({
      error: `Live session with PIN "${pin}" was not found or has already concluded.`,
      code: 'SESSION_NOT_FOUND'
    });
  }

  // Final captions check
  const finalCaptions = (session?.captions || []).filter((c) => c.isFinal);
  if (finalCaptions.length === 0 && process.env.MOCK_API !== 'true') {
    return res.status(400).json({
      error: 'Cannot archive live session because no final speech captions were recorded.',
      code: 'NO_FINAL_CAPTIONS'
    });
  }

  try {
    const sessionStartMs = session?.createdAt ? new Date(session.createdAt).getTime() : Date.now();

    // 1. WebVTT from final captions
    const vttContent = buildVttFromFinalCaptions(
      finalCaptions.length > 0 ? finalCaptions : [{ text: 'Live classroom demonstration.', isFinal: true, ts: sessionStartMs }],
      sessionStartMs
    );

    // 2. Plain-text transcript from the same captions
    const transcriptText = finalCaptions.length > 0
      ? finalCaptions.map((c) => c.text.trim()).join(' ')
      : 'Live classroom demonstration.';

    // 3. chatLog with questions AND board notes ordered by time
    const questionItems = (session?.questions || []).map((q) => ({
      id: q.id,
      type: 'question',
      text: q.text,
      ts: q.createdAt ? new Date(q.createdAt).getTime() : (q.ts || Date.now())
    }));

    const boardItems = (session?.boardNotes || []).map((b) => ({
      id: b.id || `board-${b.ts}`,
      type: 'board',
      text: b.text,
      ts: b.ts || Date.now()
    }));

    const chatLog = [...questionItems, ...boardItems].sort((a, b) => a.ts - b.ts);

    // Save VTT to disk
    const vttFilename = `recorded-${pin}-en.vtt`;
    const vttPath = path.join(CAPTIONS_DIR, vttFilename);
    fs.writeFileSync(vttPath, vttContent, 'utf8');

    // 4. Create lesson with status review, English captions machine-generated, videoUrl null
    const video = new Video({
      title: `Recorded Live Classroom Lesson (PIN: ${pin})`,
      status: 'review',
      progress: 100,
      step: 'Live session archived into permanent lesson. Ready for caption review.',
      videoPath: null,
      videoUrl: null,
      sourcePath: null,
      transcript: transcriptText,
      transcriptText: transcriptText,
      captions: {
        en: {
          vttPath,
          vttUrl: `/uploads/captions/${vttFilename}`,
          status: 'machine-generated',
          reviewStatus: 'machine-generated',
          approvedAt: null
        }
      },
      chatLog
    });

    let savedId = `recorded-${pin}`;
    try {
      await video.save();
      savedId = video._id.toString();
    } catch (e) {
      // Mongo offline
    }
    inMemoryArchivedLessons.set(savedId, video);

    // 5. Build the offline pack
    const zipName = `edubridge-lesson-${savedId}-offline.zip`;
    const zipPath = path.join(PACKS_DIR, zipName);
    try {
      await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(zipPath);
        packLessonZip(video, out).then(resolve).catch(reject);
      });
      if (fs.existsSync(zipPath)) {
        const stat = fs.statSync(zipPath);
        video.offlinePackPath = zipPath;
        video.offlinePackSizeBytes = stat.size;
        video.offlinePackUrl = `/api/public/videos/${savedId}/offlinepack`;
        try {
          await video.save();
        } catch (e) {}
      }
    } catch (err) {
      console.warn(`[LiveArchive] Warning: Offline pack generation failed: ${err.message}`);
    }

    // 6. Send session-ended event and close all SSE clients
    sseHub.endSession(pin, savedId);
    inMemorySessions.delete(pin);

    try {
      await LiveSession.updateOne({ pin }, { status: 'ended', recordedVideoId: video._id });
    } catch (e) {}

    // 7. Return { videoId }
    res.json({
      videoId: savedId
    });
  } catch (err) {
    next(err);
  }
});

router.getArchivedLesson = getArchivedLesson;
module.exports = router;
module.exports.getArchivedLesson = getArchivedLesson;
