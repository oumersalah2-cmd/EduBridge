const request = require('supertest');
const express = require('express');
const app = require('../src/app');
const studioKey = require('../src/middleware/studioKey');

describe('API Health Endpoint', () => {
  it('GET /api/health returns 200 with { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('X-Studio-Key Middleware', () => {
  const testApp = express();
  testApp.use(express.json());

  // Attach middleware to a protected test endpoint
  testApp.get('/api/protected-test', studioKey, (req, res) => {
    res.status(200).json({ authorized: true });
  });

  const originalKey = process.env.STUDIO_KEY;

  beforeEach(() => {
    process.env.STUDIO_KEY = 'valid-test-key-12345';
  });

  afterAll(() => {
    process.env.STUDIO_KEY = originalKey;
  });

  it('rejects requests missing X-Studio-Key with 401 and plain-language message', async () => {
    const res = await request(testApp).get('/api/protected-test');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Unauthorized: Invalid or missing X-Studio-Key header');
  });

  it('rejects requests with an incorrect X-Studio-Key with 401', async () => {
    const res = await request(testApp)
      .get('/api/protected-test')
      .set('X-Studio-Key', 'wrong-key');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Unauthorized');
  });

  it('allows requests with the correct X-Studio-Key', async () => {
    const res = await request(testApp)
      .get('/api/protected-test')
      .set('X-Studio-Key', 'valid-test-key-12345');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authorized: true });
  });
});
