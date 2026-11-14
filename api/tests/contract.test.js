const request = require('supertest');
const app = require('../src/app');
const sseHub = require('../src/services/sseHub');

describe('API Contract & Mock Mode Tests (Phase A)', () => {
  const TEST_KEY = 'test-studio-key-contract';

  beforeAll(() => {
    process.env.STUDIO_KEY = TEST_KEY;
    process.env.MOCK_API = 'true';
  });

  afterAll(() => {
    sseHub.stopHeartbeat();
  });

  describe('GET /api/health and /api/docs', () => {
    it('GET /api/health returns status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('GET /api/docs renders Swagger UI documentation without error', async () => {
      const res = await request(app).get('/api/docs/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Swagger UI');
    });
  });

  describe('Authentication & Authorization Gate', () => {
    it('POST /api/videos rejects missing X-Studio-Key with 401 and plain-language message', async () => {
      const res = await request(app)
        .post('/api/videos')
        .attach('video', Buffer.from('mock video bytes'), 'test.mp4');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unauthorized');
    });

    it('POST /api/videos rejects invalid X-Studio-Key with 401', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set('X-Studio-Key', 'invalid-key')
        .attach('video', Buffer.from('mock video bytes'), 'test.mp4');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unauthorized');
    });

    it('PUT /api/videos/:id/captions/en rejects missing X-Studio-Key with 401', async () => {
      const res = await request(app)
        .put('/api/videos/mock-video-demo-01/captions/en')
        .set('Content-Type', 'text/vtt')
        .send('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unauthorized');
    });

    it('POST /api/live/sessions rejects missing X-Studio-Key with 401', async () => {
      const res = await request(app).post('/api/live/sessions');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unauthorized');
    });
  });

  describe('Video Studio & Public Contract Shapes', () => {
    let uploadedId;

    it('POST /api/videos with valid key returns 202 and shape { id, status: "uploaded" }', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set('X-Studio-Key', TEST_KEY)
        .attach('video', Buffer.from('fake mp4 data'), 'lesson.mp4');
      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('uploaded');
      uploadedId = res.body.id;
    });

    it('GET /api/videos/:id returns polling shape with progress and plain-language step', async () => {
      const res = await request(app).get(`/api/videos/${uploadedId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', uploadedId);
      expect(['uploaded', 'processing', 'review', 'published']).toContain(res.body.status);
      expect(typeof res.body.progress).toBe('number');
      expect(typeof res.body.step).toBe('string');
      expect(res.body.step.length).toBeGreaterThan(5);
    });

    it('PUT /api/videos/:id/captions/en saves valid WebVTT and resets review approval', async () => {
      const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nTeacher: Updated text.';
      const res = await request(app)
        .put('/api/videos/mock-video-demo-01/captions/en')
        .set('X-Studio-Key', TEST_KEY)
        .set('Content-Type', 'text/vtt')
        .send(vtt);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 'mock-video-demo-01',
        lang: 'en',
        status: 'saved',
        reviewStatus: 'machine-generated',
        approved: false
      });
    });

    it('PUT /api/videos/:id/captions/en rejects invalid WebVTT with 400', async () => {
      const res = await request(app)
        .put('/api/videos/mock-video-demo-01/captions/en')
        .set('X-Studio-Key', TEST_KEY)
        .set('Content-Type', 'text/vtt')
        .send('INVALID_HEADER\ntext');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid WebVTT');
    });

    it('POST /api/videos/:id/approve/en marks reviewStatus human-reviewed', async () => {
      const res = await request(app)
        .post('/api/videos/mock-video-demo-01/approve/en')
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: 'mock-video-demo-01',
        lang: 'en',
        approved: true,
        reviewStatus: 'human-reviewed'
      });
    });

    it('POST /api/videos/:id/publish returns { status, embedScript, embedIframe, offlinePackUrl }', async () => {
      const res = await request(app)
        .post('/api/videos/mock-video-demo-01/publish')
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('published');
      expect(res.body.embedScript).toContain('<script');
      expect(res.body.embedIframe).toContain('<iframe');
      expect(res.body.offlinePackUrl).toContain('/offlinepack');
    });

    it('GET /api/public/videos/:id returns metadata, captions with reviewStatus, and transcript', async () => {
      const res = await request(app).get('/api/public/videos/mock-video-demo-01');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('audioUrl');
      expect(res.body).toHaveProperty('signVideoUrl');
      expect(res.body).toHaveProperty('transcript');
      expect(typeof res.body.transcript).toBe('string');
      expect(res.body).toHaveProperty('chatLog');
      expect(Array.isArray(res.body.chatLog)).toBe(true);

      // Verify captions per language
      expect(res.body.captions).toHaveProperty('en');
      expect(res.body.captions.en.reviewStatus).toBe('human-reviewed');
      expect(res.body.captions.en.url).toMatch(/\/uploads\/captions\/demo_lesson_en\.vtt$/);

      expect(res.body.captions).toHaveProperty('am');
      expect(res.body.captions.am.reviewStatus).toBe('machine-generated');
      expect(res.body.captions.am.url).toMatch(/\/uploads\/captions\/demo_lesson_am\.vtt$/);
    });

    it('GET /api/public/videos/:id/offlinepack downloads zip bundle with audio, transcript, lesson.html, brf', async () => {
      const res = await request(app).get('/api/public/videos/mock-video-demo-01/offlinepack');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/zip');
    });
  });

  describe('Live Classroom Companion Contract Shapes', () => {
    let sessionPin;

    it('POST /api/live/sessions creates session returning { pin (6 digits), joinUrl, expiresAt }', async () => {
      const res = await request(app)
        .post('/api/live/sessions')
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(201);
      expect(res.body.pin).toMatch(/^\d{6}$/);
      expect(res.body).toHaveProperty('joinUrl');
      expect(res.body).toHaveProperty('expiresAt');
      sessionPin = res.body.pin;
    });

    it('POST /api/live/sessions/:pin/captions broadcasts speech captions', async () => {
      const res = await request(app)
        .post(`/api/live/sessions/${sessionPin}/captions`)
        .set('X-Studio-Key', TEST_KEY)
        .send({ text: 'Welcome to this live session.', isFinal: true, ts: Date.now() });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'broadcasted' });
    });

    it('POST /api/live/sessions/:pin/board broadcasts board notes', async () => {
      const res = await request(app)
        .post(`/api/live/sessions/${sessionPin}/board`)
        .set('X-Studio-Key', TEST_KEY)
        .send({ text: 'Board Note: PV cells convert solar photons to voltage.' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'broadcasted' });
    });

    it('POST /api/live/sessions/:pin/questions accepts student question and rejects >500 chars', async () => {
      const resValid = await request(app)
        .post(`/api/live/sessions/${sessionPin}/questions`)
        .send({ text: 'How do solar cells handle extreme heat?' });
      expect(resValid.status).toBe(201);
      expect(resValid.body).toHaveProperty('id');
      expect(resValid.body.status).toBe('received');

      const resTooLong = await request(app)
        .post(`/api/live/sessions/${sessionPin}/questions`)
        .send({ text: 'a'.repeat(501) });
      expect(resTooLong.status).toBe(400);
      expect(resTooLong.body.error).toContain('500 characters');
    });

    it('GET /api/live/sessions/:pin/questions returns teacher question queue', async () => {
      const res = await request(app)
        .get(`/api/live/sessions/${sessionPin}/questions`)
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('DELETE /api/live/sessions/:pin/questions/:qid dismisses a question', async () => {
      const res = await request(app)
        .delete(`/api/live/sessions/${sessionPin}/questions/q-mock-1`)
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'dismissed', id: 'q-mock-1' });
    });

    it('POST /api/live/sessions/:pin/end ends session and returns { videoId }', async () => {
      const res = await request(app)
        .post(`/api/live/sessions/${sessionPin}/end`)
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('videoId');
    });
  });

  describe('Accessible Jobs Opportunities Contract & JSON-LD', () => {
    it('GET /api/jobs returns at least 3 Ethiopian job cards with all required fields', async () => {
      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);

      res.body.forEach((job) => {
        expect(job).toHaveProperty('id');
        expect(job).toHaveProperty('title');
        expect(job).toHaveProperty('employer');
        expect(job).toHaveProperty('location');
        expect(job).toHaveProperty('requirements');
        expect(job).toHaveProperty('deadline');
        expect(job).toHaveProperty('applyUrl');
        expect(job).toHaveProperty('certificateUrl');
        expect(job).toHaveProperty('audioSummaryUrl');
        expect(job).toHaveProperty('textSummary');
      });
    });

    it('each job card contains valid schema.org/JobPosting JSON-LD', async () => {
      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(200);

      res.body.forEach((job) => {
        const jsonLd = job.jsonLd;
        expect(jsonLd).toBeDefined();
        expect(jsonLd['@context']).toBe('https://schema.org');
        expect(jsonLd['@type']).toBe('JobPosting');
        expect(jsonLd).toHaveProperty('title');
        expect(jsonLd).toHaveProperty('hiringOrganization');
        expect(jsonLd.hiringOrganization['@type']).toBe('Organization');
        expect(jsonLd.hiringOrganization).toHaveProperty('name');
        expect(jsonLd).toHaveProperty('jobLocation');
        expect(jsonLd.jobLocation['@type']).toBe('Place');
        expect(jsonLd.jobLocation.address['@type']).toBe('PostalAddress');
        expect(jsonLd).toHaveProperty('description');
        expect(jsonLd).toHaveProperty('validThrough');
        expect(jsonLd).toHaveProperty('employmentType');
      });
    });

    it('GET /api/jobs/:id returns single job card with JSON-LD', async () => {
      const res = await request(app).get('/api/jobs/job-eth-01');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('job-eth-01');
      expect(res.body.title).toBe('Junior Accessibility QA Tester');
      expect(res.body.jsonLd['@type']).toBe('JobPosting');
    });

    it('GET /api/jobs/nonexistent-id returns 404 with plain-language message', async () => {
      const res = await request(app).get('/api/jobs/nonexistent-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('was not found');
    });
  });
});
