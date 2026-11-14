const request = require('supertest');
const app = require('../src/app');
const sseHub = require('../src/services/sseHub');

describe('API Contract & Mock Mode Tests (Phase A)', () => {
  const TEST_KEY = 'test-studio-key-phase-a';

  beforeAll(() => {
    process.env.STUDIO_KEY = TEST_KEY;
    process.env.MOCK_API = 'true';
  });

  afterAll(() => {
    sseHub.stopHeartbeat();
  });

  describe('GET /api/health and Documentation', () => {
    it('returns status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('serves Swagger documentation at /api/docs/', async () => {
      const res = await request(app).get('/api/docs/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Swagger UI');
    });
  });

  describe('Videos Contract & Lifecycle Endpoints', () => {
    it('POST /api/videos requires X-Studio-Key header', async () => {
      const res = await request(app)
        .post('/api/videos')
        .attach('video', Buffer.from('fake-video-bytes'), 'test.mp4');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unauthorized');
    });

    it('POST /api/videos with valid key returns 202 with id and status', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set('X-Studio-Key', TEST_KEY)
        .attach('video', Buffer.from('fake-video-bytes'), 'lesson.mp4');
      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status');
    });

    it('GET /api/videos/:id returns polling status with plain-language step', async () => {
      const res = await request(app).get('/api/videos/mock-video-demo-01');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('progress');
      expect(res.body).toHaveProperty('step');
      expect(typeof res.body.step).toBe('string');
    });

    it('PUT /api/videos/:id/captions/en saves valid WebVTT and resets approval to false', async () => {
      const validVTT = 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello, welcome to this lesson.';
      const res = await request(app)
        .put('/api/videos/mock-video-demo-01/captions/en')
        .set('X-Studio-Key', TEST_KEY)
        .set('Content-Type', 'text/vtt')
        .send(validVTT);
      expect(res.status).toBe(200);
      expect(res.body.approved).toBe(false);
      expect(res.body.status).toBe('saved');
    });

    it('PUT /api/videos/:id/captions/en rejects invalid WebVTT with 400', async () => {
      const invalidVTT = 'NOT_A_VALID_VTT_HEADER\n00:01 text';
      const res = await request(app)
        .put('/api/videos/mock-video-demo-01/captions/en')
        .set('X-Studio-Key', TEST_KEY)
        .set('Content-Type', 'text/vtt')
        .send(invalidVTT);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid WebVTT');
    });

    it('POST /api/videos/:id/approve/en approves track with human-reviewed status', async () => {
      const res = await request(app)
        .post('/api/videos/mock-video-demo-01/approve/en')
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(200);
      expect(res.body.approved).toBe(true);
    });

    it('POST /api/videos/:id/publish sets status published and returns embed snippets', async () => {
      const res = await request(app)
        .post('/api/videos/mock-video-demo-01/publish')
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('published');
      expect(res.body.embedSnippet).toContain('<script');
      expect(res.body.iframeSnippet).toContain('<iframe');
    });

    it('GET /api/public/videos/:id returns public metadata and review status', async () => {
      const res = await request(app).get('/api/public/videos/mock-video-demo-01');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('captions');
      expect(res.body).toHaveProperty('transcriptText');
    });

    it('GET /api/public/videos/:id/offlinepack downloads zip stream', async () => {
      const res = await request(app).get('/api/public/videos/mock-video-demo-01/offlinepack');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/zip');
    });
  });

  describe('Live Classroom Companion Endpoints', () => {
    let sessionPin;

    it('POST /api/live/sessions creates session with 6-digit PIN', async () => {
      const res = await request(app)
        .post('/api/live/sessions')
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(201);
      expect(res.body.pin).toMatch(/^\d{6}$/);
      expect(res.body).toHaveProperty('joinUrl');
      expect(res.body).toHaveProperty('expiresAt');
      sessionPin = res.body.pin;
    });

    it('POST /api/live/sessions/:pin/captions broadcasts caption', async () => {
      const res = await request(app)
        .post(`/api/live/sessions/${sessionPin}/captions`)
        .set('X-Studio-Key', TEST_KEY)
        .send({ text: 'Testing live teacher speech recognition.', isFinal: true, ts: Date.now() });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('broadcasted');
    });

    it('POST /api/live/sessions/:pin/board broadcasts board note', async () => {
      const res = await request(app)
        .post(`/api/live/sessions/${sessionPin}/board`)
        .set('X-Studio-Key', TEST_KEY)
        .send({ text: 'Theorem: Accessible education scales when zero dependencies are required.' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('broadcasted');
    });

    it('POST /api/live/sessions/:pin/questions accepts student question', async () => {
      const res = await request(app)
        .post(`/api/live/sessions/${sessionPin}/questions`)
        .send({ text: 'What is the minimum bandwidth required for the audio stream?' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('received');
    });

    it('GET /api/live/sessions/:pin/questions returns teacher questions list', async () => {
      const res = await request(app)
        .get(`/api/live/sessions/${sessionPin}/questions`)
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/live/sessions/:pin/end archives session and closes room', async () => {
      const res = await request(app)
        .post(`/api/live/sessions/${sessionPin}/end`)
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ended');
      expect(res.body).toHaveProperty('recordedVideoId');
    });
  });

  describe('Jobs API Endpoints', () => {
    it('GET /api/jobs returns at least 3 Ethiopian job cards', async () => {
      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    it('each job card contains valid schema.org/JobPosting JSON-LD', async () => {
      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(200);
      res.body.forEach((job) => {
        expect(job).toHaveProperty('jsonLd');
        expect(job.jsonLd['@context']).toBe('https://schema.org');
        expect(job.jsonLd['@type']).toBe('JobPosting');
        expect(job.jsonLd).toHaveProperty('title');
        expect(job.jsonLd).toHaveProperty('hiringOrganization');
      });
    });

    it('GET /api/jobs/:id returns single job card', async () => {
      const res = await request(app).get('/api/jobs/job-eth-01');
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Junior Accessibility QA Tester');
    });

    it('GET /api/jobs/nonexistent-id returns 404 with plain-language error', async () => {
      const res = await request(app).get('/api/jobs/nonexistent-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('was not found');
    });
  });
});
