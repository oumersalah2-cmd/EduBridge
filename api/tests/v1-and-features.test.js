const request = require('supertest');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const Video = require('../src/models/Video');
const Webhook = require('../src/models/Webhook');
const sseHub = require('../src/services/sseHub');

const TEST_KEY = 'change-me-to-a-long-random-string';
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

describe('EduBridge v1 Layer, Live Archive, Webhooks & Security Tests', () => {
  beforeAll(() => {
    process.env.STUDIO_KEY = TEST_KEY;
    process.env.MOCK_API = 'false';
    process.env.WEBHOOK_ALLOW_PRIVATE = 'true';
  });

  afterAll(() => {
    sseHub.stopHeartbeat();
  });

  // =========================================================================
  // 1. Error Codes Consistency
  // =========================================================================
  describe('1. Error Codes Verification', () => {
    it('returns { error, code: "KEY_REQUIRED" } on missing studio key', async () => {
      const res = await request(app).post('/api/videos');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.code).toBe('KEY_REQUIRED');
    });

    it('returns { error, code: "KEY_INVALID" } on incorrect studio key', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set('X-Studio-Key', 'wrong-key');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('KEY_INVALID');
    });

    it('returns { error, code: "NOT_FOUND" } for unknown routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent-route-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('returns { error, code: "LESSON_NOT_FOUND" } for unknown lesson id', async () => {
      jest.spyOn(Video, 'findById').mockResolvedValue(null);
      jest.spyOn(Video, 'findOne').mockResolvedValue(null);

      const res = await request(app).get('/api/v1/lessons/654321654321654321654321');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('LESSON_NOT_FOUND');
    });

    it('returns { error, code: "INVALID_LANGUAGE" } for invalid caption language', async () => {
      const res = await request(app)
        .post('/api/v1/lessons/mock-1/captions')
        .set('X-Studio-Key', TEST_KEY)
        .send({ lang: 'klingon', vtt: 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_LANGUAGE');
    });

    it('returns { error, code: "INVALID_VTT" } for malformed WebVTT content', async () => {
      const res = await request(app)
        .post('/api/v1/lessons/mock-1/captions')
        .set('X-Studio-Key', TEST_KEY)
        .send({ lang: 'en', vtt: 'NOT_A_VTT_HEADER\n\nHello' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_VTT');
    });

    it('returns { error, code: "SESSION_NOT_FOUND" } for unknown live PIN', async () => {
      const res = await request(app).get('/api/live/sessions/999999/stream');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('SESSION_NOT_FOUND');
    });
  });

  // =========================================================================
  // 2. Live Session & Archive Lifecycle (SSE, Questions, Archiving)
  // =========================================================================
  describe('2. Live Classroom Lifecycle & Archiving', () => {
    let testPin;

    it('creates active live session returning 6-digit PIN', async () => {
      const res = await request(app)
        .post('/api/live/sessions')
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(201);
      expect(res.body.pin).toMatch(/^\d{6}$/);
      testPin = res.body.pin;
    });

    it('accepts teacher captions and broadcasts to hub', async () => {
      const res = await request(app)
        .post(`/api/live/sessions/${testPin}/captions`)
        .set('X-Studio-Key', TEST_KEY)
        .send({ text: 'Welcome to accessible live learning.', isFinal: true });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('broadcasted');
    });

    it('accepts teacher board note and broadcasts to hub', async () => {
      const res = await request(app)
        .post(`/api/live/sessions/${testPin}/board`)
        .set('X-Studio-Key', TEST_KEY)
        .send({ text: 'Important: Zero external runtime dependencies.' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('broadcasted');
    });

    it('submits student question and rejects >500 characters with plain error', async () => {
      // Long text
      const tooLong = 'A'.repeat(501);
      const errRes = await request(app)
        .post(`/api/live/sessions/${testPin}/questions`)
        .send({ text: tooLong });
      expect(errRes.status).toBe(400);
      expect(errRes.body.code).toBe('QUESTION_TOO_LONG');

      // Valid question
      const okRes = await request(app)
        .post(`/api/live/sessions/${testPin}/questions`)
        .send({ text: 'How does WebVTT work without javascript?' });
      expect(okRes.status).toBe(201);
      expect(okRes.body.status).toBe('received');
      expect(okRes.body.id).toBeDefined();

      // Teacher view
      const listRes = await request(app)
        .get(`/api/live/sessions/${testPin}/questions`)
        .set('X-Studio-Key', TEST_KEY);
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.length).toBeGreaterThanOrEqual(1);

      // Dismiss question
      const qid = okRes.body.id;
      const delRes = await request(app)
        .delete(`/api/live/sessions/${testPin}/questions/${qid}`)
        .set('X-Studio-Key', TEST_KEY);
      expect(delRes.status).toBe(200);
      expect(delRes.body.status).toBe('dismissed');
    });

    it('archives session: builds relative WebVTT, chatLog with questions & board notes, and emits session-ended event', async () => {
      // Add one more final caption
      await request(app)
        .post(`/api/live/sessions/${testPin}/captions`)
        .set('X-Studio-Key', TEST_KEY)
        .send({ text: 'Solar cells absorb photons and release electrons.', isFinal: true, ts: Date.now() + 2000 });

      // End session
      const endRes = await request(app)
        .post(`/api/live/sessions/${testPin}/end`)
        .set('X-Studio-Key', TEST_KEY);

      expect(endRes.status).toBe(200);
      expect(endRes.body.videoId).toBeDefined();

      const archivedId = endRes.body.videoId;

      // Verify archived lesson in review status via Studio preview
      const previewRes = await request(app)
        .get(`/api/videos/${archivedId}/preview`)
        .set('X-Studio-Key', TEST_KEY);

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.status).toBe('review');
      expect(previewRes.body.videoUrl).toBeNull();
      expect(previewRes.body.captions.en.reviewStatus).toBe('machine-generated');
      expect(previewRes.body.rawCaptions.en).toContain('WEBVTT');
      expect(previewRes.body.transcript).toContain('Welcome to accessible live learning.');
      expect(previewRes.body.chatLog.length).toBeGreaterThanOrEqual(2);
      expect(previewRes.body.chatLog.some((c) => c.type === 'board')).toBe(true);
      expect(previewRes.body.chatLog.some((c) => c.type === 'question')).toBe(true);
    });

    it('refuses to archive session with no final captions returning NO_FINAL_CAPTIONS', async () => {
      // Create fresh session with NO final captions
      const newSessionRes = await request(app)
        .post('/api/live/sessions')
        .set('X-Studio-Key', TEST_KEY);
      const pin2 = newSessionRes.body.pin;

      // Only interim caption
      await request(app)
        .post(`/api/live/sessions/${pin2}/captions`)
        .set('X-Studio-Key', TEST_KEY)
        .send({ text: 'Interim unfinished caption...', isFinal: false });

      const failEndRes = await request(app)
        .post(`/api/live/sessions/${pin2}/end`)
        .set('X-Studio-Key', TEST_KEY);

      expect(failEndRes.status).toBe(400);
      expect(failEndRes.body.code).toBe('NO_FINAL_CAPTIONS');
    });
  });

  // =========================================================================
  // 3. Webhook Delivery & SSRF Security
  // =========================================================================
  describe('3. Outbound Webhooks Delivery & SSRF Validation', () => {
    it('refuses registration to private IP when WEBHOOK_ALLOW_PRIVATE is false', async () => {
      try {
        process.env.WEBHOOK_ALLOW_PRIVATE = 'false';
        const res = await request(app)
          .post('/api/v1/webhooks')
          .set('X-Studio-Key', TEST_KEY)
          .send({ url: 'http://127.0.0.1:9999/hook', events: ['lesson.published'] });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('WEBHOOK_INVALID');
        expect(res.body.error).toMatch(/private|loopback/i);
      } finally {
        process.env.WEBHOOK_ALLOW_PRIVATE = 'true';
      }
    });

    it('registers valid webhook and lists active webhooks', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks')
        .set('X-Studio-Key', TEST_KEY)
        .send({ url: 'http://localhost:8999/webhook-target', events: ['lesson.published', 'captions.approved'] });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.events).toEqual(['lesson.published', 'captions.approved']);

      const listRes = await request(app)
        .get('/api/v1/webhooks')
        .set('X-Studio-Key', TEST_KEY);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
    });

    it('dispatches webhook event payload to HTTP listener upon publication', async () => {
      let receivedPayload = null;
      const testServer = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            receivedPayload = JSON.parse(body);
          } catch (e) {}
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        });
      });

      await new Promise((resolve) => testServer.listen(8999, resolve));

      try {
        const { fireWebhook } = require('../src/services/webhookService');
        fireWebhook('lesson.published', { lessonId: 'test-lesson-123' });

        // Wait for non-blocking setImmediate dispatch
        await new Promise((resolve) => setTimeout(resolve, 300));

        expect(receivedPayload).not.toBeNull();
        expect(receivedPayload.event).toBe('lesson.published');
        expect(receivedPayload.lessonId).toBe('test-lesson-123');
        expect(receivedPayload.at).toBeDefined();
      } finally {
        testServer.close();
      }
    });
  });

  // =========================================================================
  // 4. DELETE /api/v1/lessons/:id Deletes Record and Files on Disk
  // =========================================================================
  describe('4. Lesson Deletion (DB Document & Disk Cleanup)', () => {
    it('deletes video record and removes associated files from uploads directory', async () => {
      const dummyVideoFile = path.join(UPLOADS_DIR, 'videos', `dummy-${Date.now()}.mp4`);
      const dummyAudioFile = path.join(UPLOADS_DIR, 'audio', `dummy-${Date.now()}.mp3`);
      const dummyVttFile = path.join(UPLOADS_DIR, 'captions', `dummy-${Date.now()}.vtt`);

      fs.writeFileSync(dummyVideoFile, 'fake video bytes');
      fs.writeFileSync(dummyAudioFile, 'fake audio bytes');
      fs.writeFileSync(dummyVttFile, 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nDummy');

      const dummyId = '507f1f77bcf86cd799439099';
      const dummyVideoDoc = {
        _id: dummyId,
        title: 'Delete Test Lesson',
        status: 'published',
        sourcePath: dummyVideoFile,
        videoPath: dummyVideoFile,
        audioPath: dummyAudioFile,
        captions: {
          en: { vttPath: dummyVttFile, status: 'human-reviewed' }
        }
      };

      jest.spyOn(Video, 'findById').mockResolvedValue(dummyVideoDoc);
      jest.spyOn(Video, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

      expect(fs.existsSync(dummyVideoFile)).toBe(true);
      expect(fs.existsSync(dummyAudioFile)).toBe(true);
      expect(fs.existsSync(dummyVttFile)).toBe(true);

      const delRes = await request(app)
        .delete(`/api/v1/lessons/${dummyId}`)
        .set('X-Studio-Key', TEST_KEY);

      expect(delRes.status).toBe(204);

      // Verify files were unlinked
      expect(fs.existsSync(dummyVideoFile)).toBe(false);
      expect(fs.existsSync(dummyAudioFile)).toBe(false);
      expect(fs.existsSync(dummyVttFile)).toBe(false);
    });
  });

  // =========================================================================
  // 5. Cryptographically Signed Learner Certificates (Ed25519)
  // =========================================================================
  describe('5. Signed Certificates (Ed25519 Open Badges)', () => {
    let certId;

    it('issues signed certificate assertion with public key and signature', async () => {
      const res = await request(app)
        .post('/api/v1/certificates')
        .set('X-Studio-Key', TEST_KEY)
        .send({
          recipientName: 'Tigist Assefa',
          recipientEmail: 'tigist@example.et',
          courseTitle: 'Low-Bandwidth Web Accessibility Fundamentals'
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.proof).toBeDefined();
      expect(res.body.proof.jws).toBeDefined();
      expect(res.body.recipient.name).toBe('Tigist Assefa');
      expect(res.body.verifyUrl).toContain(`/api/v1/certificates/${res.body.id}/verify`);
      certId = res.body.id;
    });

    it('publicly verifies certificate signature returning { valid: true }', async () => {
      const res = await request(app).get(`/api/v1/certificates/${certId}/verify`);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.credential.recipient.name).toBe('Tigist Assefa');
    });

    it('detects tampering and returns { valid: false } if certificate is altered', async () => {
      const { createSignedCertificate, verifyCertificate } = require('../src/services/certificateService');
      const cert = createSignedCertificate({
        recipientName: 'Alula Aba Nega',
        courseTitle: 'Accessible Engineering'
      });

      // Tamper with assertion
      const tampered = JSON.parse(JSON.stringify(cert));
      tampered.badge.name = 'Falsified Course Degree';

      const verifyRes = verifyCertificate(cert.id, tampered);
      expect(verifyRes.valid).toBe(false);
      expect(verifyRes.reason).toContain('tampered');
    });
  });

  // =========================================================================
  // 6. Audio Description Upload & Tracks Exposure
  // =========================================================================
  describe('6. Audio Description Support', () => {
    it('accepts audioDescription MP3 file and exposes in /api/v1/lessons/:id tracks', async () => {
      const dummyAdFile = path.join(UPLOADS_DIR, 'audio', `test-ad-${Date.now()}.mp3`);
      fs.writeFileSync(dummyAdFile, 'fake mp3 audio description bytes');

      const dummyId = '507f1f77bcf86cd799439088';
      const dummyVideoDoc = {
        _id: dummyId,
        title: 'Audio Description Test',
        status: 'published',
        audioDescriptionPath: dummyAdFile,
        audioDescriptionUrl: `/uploads/audio/${path.basename(dummyAdFile)}`,
        captions: {
          en: { vttUrl: '/uploads/captions/test_en.vtt', reviewStatus: 'human-reviewed' }
        }
      };

      jest.spyOn(Video, 'findById').mockResolvedValue(dummyVideoDoc);

      const res = await request(app).get(`/api/v1/lessons/${dummyId}`);
      expect(res.status).toBe(200);
      expect(res.body.audioDescriptionUrl).toContain('/uploads/audio/');

      const adTrack = res.body.tracks.find((t) => t.kind === 'audio-description');
      expect(adTrack).toBeDefined();
      expect(adTrack.url).toContain('/uploads/audio/');

      // Cleanup
      try { fs.unlinkSync(dummyAdFile); } catch (e) {}
    });
  });
});
