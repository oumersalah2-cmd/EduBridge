const express = require('express');
const router = express.Router();

const studioKey = require('../middleware/studioKey');
const sseHub = require('../services/sseHub');
const LiveSession = require('../models/LiveSession');
const Video = require('../models/Video');

// Helper to generate a non-guessable 6-digit PIN
function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// In-memory fallback sessions store for offline/mock operation
const inMemorySessions = new Map();

// POST /api/live/sessions - Create live classroom session (Studio Key)
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

    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4-hour session
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const joinUrl = `${baseUrl}/live/${pin}`;

    const sessionData = {
      pin,
      joinUrl,
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

  // Verify PIN exists
  let exists = inMemorySessions.has(pin);
  if (!exists) {
    try {
      const dbSession = await LiveSession.findOne({ pin, status: 'active' });
      if (dbSession) exists = true;
    } catch (e) {
      // Mongo offline
    }
  }

  if (!exists && process.env.MOCK_API !== 'true') {
    return res.status(404).json({
      error: `Live session with PIN "${pin}" was not found or has already concluded.`
    });
  }

  sseHub.addClient(pin, res, lastEventId);
});

// POST /api/live/sessions/:pin/captions - Teacher speech captions (Studio Key)
router.post('/sessions/:pin/captions', studioKey, async (req, res, next) => {
  const { pin } = req.params;
  const { text, isFinal, ts } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      error: 'Caption text is required and must be a valid string.'
    });
  }

  const captionData = {
    text: text.trim(),
    isFinal: Boolean(isFinal),
    ts: ts || Date.now()
  };

  // Broadcast to all listening student streams
  sseHub.broadcast(pin, 'caption', captionData);

  // Store final captions
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

// POST /api/live/sessions/:pin/board - Teacher board / slide notes (Studio Key)
router.post('/sessions/:pin/board', studioKey, async (req, res, next) => {
  const { pin } = req.params;
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      error: 'Board note text is required and must be a valid string.'
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

  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      error: 'Question text is required and must be a valid string.'
    });
  }

  if (text.length > 500) {
    return res.status(400).json({
      error: 'Question text exceeds maximum length of 500 characters.'
    });
  }

  // Sanitize simple HTML tags to avoid markup injection
  const sanitizedText = text.replace(/<[^>]*>/g, '').trim();

  const questionId = `q-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const questionData = {
    id: questionId,
    text: sanitizedText,
    dismissed: false,
    createdAt: new Date()
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

  // Broadcast question to teacher and learners
  sseHub.broadcast(pin, 'question-status', {
    action: 'new',
    question: questionData
  });

  res.status(201).json({
    id: questionId,
    status: 'received'
  });
});

// GET /api/live/sessions/:pin/questions - Teacher view of questions (Studio Key)
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
        error: `Live session with PIN "${pin}" was not found.`
      });
    }
    res.json(session.questions.filter((q) => !q.dismissed));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/live/sessions/:pin/questions/:qid - Teacher dismiss question (Studio Key)
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

  // Notify clients
  sseHub.broadcast(pin, 'question-status', {
    action: 'dismissed',
    questionId: qid
  });

  res.json({ status: 'dismissed', id: qid });
});

// POST /api/live/sessions/:pin/end - End session and archive into video (Studio Key)
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

  // Create permanent archived video
  let recordedVideoId = `recorded-${pin}`;
  try {
    const video = new Video({
      title: `Recorded Live Classroom Lesson (PIN: ${pin})`,
      status: 'review',
      progress: 100,
      step: 'Live session archived into permanent lesson. Ready for caption review.',
      chatLog: (session?.questions || []).map((q) => ({
        id: q.id,
        type: 'question',
        text: q.text,
        createdAt: q.createdAt
      }))
    });
    await video.save();
    recordedVideoId = video._id.toString();
  } catch (e) {
    // Mongo offline
  }

  // Clean up SSE hub and announce termination
  sseHub.endSession(pin, recordedVideoId);
  inMemorySessions.delete(pin);

  try {
    await LiveSession.updateOne({ pin }, { status: 'ended', recordedVideoId });
  } catch (e) {
    // Mongo offline
  }

  res.json({
    status: 'ended',
    recordedVideoId,
    offlinePackUrl: `/api/public/videos/${recordedVideoId}/offlinepack`
  });
});

module.exports = router;
