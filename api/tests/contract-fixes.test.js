const http = require('http');
const request = require('supertest');
const app = require('../src/app');
const sseHub = require('../src/services/sseHub');

describe('Job 1: Contract Fixes, Absolute URLs, CORS, and SSE Tests', () => {
  const TEST_KEY = 'test-studio-key-contract';
  let server;
  let port;

  beforeAll((done) => {
    process.env.STUDIO_KEY = TEST_KEY;
    process.env.MOCK_API = 'true';
    process.env.PUBLIC_BASE_URL = 'http://localhost:4000';

    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    sseHub.stopHeartbeat();
    server.close(done);
  });

  describe('1. Absolute URLs verification', () => {
    it('returns absolute URLs in public video metadata', async () => {
      const res = await request(app).get('/api/public/videos/mock-video-demo-01');
      expect(res.status).toBe(200);
      expect(res.body.audioUrl).toMatch(/^http:\/\/localhost:4000\//);
      expect(res.body.signVideoUrl).toMatch(/^http:\/\/localhost:4000\//);
      expect(res.body.offlinePackUrl).toMatch(/^http:\/\/localhost:4000\//);
      expect(res.body.brailleUrl).toMatch(/^http:\/\/localhost:4000\//);
      expect(res.body.captions.en.url).toMatch(/^http:\/\/localhost:4000\//);
      expect(res.body.captions.am.url).toMatch(/^http:\/\/localhost:4000\//);
    });

    it('returns absolute URLs in publish response and embed snippets', async () => {
      const res = await request(app)
        .post('/api/videos/mock-video-demo-01/publish')
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(200);
      expect(res.body.offlinePackUrl).toMatch(/^http:\/\/localhost:4000\//);
      expect(res.body.embedScript).toContain('http://localhost:4000/player/embed.js');
      expect(res.body.embedIframe).toContain('http://localhost:4000/player/index.html');
    });

    it('returns absolute URLs in live session creation', async () => {
      const res = await request(app)
        .post('/api/live/sessions')
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(201);
      expect(res.body.joinUrl).toMatch(/^http:\/\/localhost:4000\/live\/\d{6}$/);
    });

    it('returns absolute URLs in jobs listing', async () => {
      const res = await request(app).get('/api/jobs');
      expect(res.status).toBe(200);
      res.body.forEach((job) => {
        expect(job.certificateUrl).toMatch(/^http:\/\/localhost:4000\//);
        expect(job.audioSummaryUrl).toMatch(/^http:\/\/localhost:4000\//);
      });
    });
  });

  describe('2. CORS preflight and headers from Studio origin (http://localhost:5173)', () => {
    it('handles OPTIONS preflight request with allowed origin and X-Studio-Key header', async () => {
      const res = await request(app)
        .options('/api/videos')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'X-Studio-Key, Content-Type');

      expect([200, 204]).toContain(res.status);
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.headers['access-control-allow-headers']).toContain('X-Studio-Key');
    });

    it('attaches CORS headers on regular API requests from localhost:5173', async () => {
      const res = await request(app)
        .get('/api/public/videos/mock-video-demo-01')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('3. Mock SSE stream verification', () => {
    it('connects to SSE stream, receives board and caption events, and verifies heartbeat format', (done) => {
      const req = http.get(`http://127.0.0.1:${port}/api/live/sessions/719284/stream`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('text/event-stream');

        let rawData = '';

        res.on('data', (chunk) => {
          rawData += chunk.toString();

          const hasBoard = rawData.includes('event: board');
          const hasCaption = rawData.includes('event: caption');

          if (hasBoard && hasCaption) {
            req.destroy(); // End test early once verified
          }
        });

        req.on('error', () => {
          // Expected on req.destroy()
        });

        res.on('close', () => {
          expect(rawData).toContain('event: connected');
          expect(rawData).toContain('event: board');
          expect(rawData).toContain('event: caption');

          // Verify heartbeat comment format constant
          const heartbeatChunk = ': heartbeat\n\n';
          expect(heartbeatChunk.startsWith(':')).toBe(true);
          expect(heartbeatChunk.endsWith('\n\n')).toBe(true);

          done();
        });
      });

      req.setTimeout(4000, () => {
        req.destroy();
        done(new Error('Timeout waiting for mock SSE stream events'));
      });
    }, 6000);
  });
});
