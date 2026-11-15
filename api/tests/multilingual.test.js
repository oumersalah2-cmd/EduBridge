const request = require('supertest');
const app = require('../src/app');
const {
  TARGET_LANGS,
  translateText,
  translateSegments,
  OFFLINE_DICTIONARY_OM,
  OFFLINE_DICTIONARY_TI
} = require('../src/services/translationService');

describe('Multilingual Architecture Tests (Afaan Oromoo & Tigrinya)', () => {
  const TEST_KEY = 'test-studio-key';

  beforeAll(() => {
    process.env.STUDIO_KEY = TEST_KEY;
    process.env.MOCK_API = 'true';
  });

  describe('1. Translation Service Configuration & Fallbacks', () => {
    it('exports TARGET_LANGS containing am, om, and ti', () => {
      expect(TARGET_LANGS).toContain('am');
      expect(TARGET_LANGS).toContain('om');
      expect(TARGET_LANGS).toContain('ti');
    });

    it('translates educational terms via OFFLINE_DICTIONARY_OM', async () => {
      expect(OFFLINE_DICTIONARY_OM['solar energy']).toBe('Anniisaa biiftuu (soolaarii)');
      expect(OFFLINE_DICTIONARY_OM['software engineering']).toBe('Injinarummaa sooftiweerii');

      const omText = await translateText('solar energy', 'om');
      expect(omText).toBe('Anniisaa biiftuu (soolaarii)');
    });

    it('translates educational terms via OFFLINE_DICTIONARY_TI', async () => {
      expect(OFFLINE_DICTIONARY_TI['solar energy']).toBe('ናይ ፀሓይ ሓይሊ');
      expect(OFFLINE_DICTIONARY_TI['software engineering']).toBe('ሶፍትዌር ምህንድስና');

      const tiText = await translateText('solar energy', 'ti');
      expect(tiText).toBe('ናይ ፀሓይ ሓይሊ');
    });

    it('translateSegments strictly preserves start and end timestamps for om and ti', async () => {
      const segments = [
        { start: 0.5, end: 3.5, text: 'solar energy' },
        { start: 4.0, end: 8.0, text: 'clean electricity' }
      ];

      const omSegments = await translateSegments(segments, 'om', 'en');
      expect(omSegments).toHaveLength(2);
      expect(omSegments[0].start).toBe(0.5);
      expect(omSegments[0].end).toBe(3.5);
      expect(omSegments[0].text).toBe('Anniisaa biiftuu (soolaarii)');

      const tiSegments = await translateSegments(segments, 'ti', 'en');
      expect(tiSegments).toHaveLength(2);
      expect(tiSegments[0].start).toBe(0.5);
      expect(tiSegments[0].end).toBe(3.5);
      expect(tiSegments[0].text).toBe('ናይ ፀሓይ ሓይሊ');
    });
  });

  describe('2. Studio & Public API Routes for om and ti', () => {
    const validVtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nMultilingual test cue.';

    it('accepts and saves human-edited captions in om and ti', async () => {
      const resOm = await request(app)
        .put('/api/videos/mock-video-demo-01/captions/om')
        .set('X-Studio-Key', TEST_KEY)
        .set('Content-Type', 'text/vtt')
        .send(validVtt);
      expect(resOm.status).toBe(200);
      expect(resOm.body.lang).toBe('om');
      expect(resOm.body.reviewStatus).toBe('machine-generated');

      const resTi = await request(app)
        .put('/api/videos/mock-video-demo-01/captions/ti')
        .set('X-Studio-Key', TEST_KEY)
        .set('Content-Type', 'text/vtt')
        .send(validVtt);
      expect(resTi.status).toBe(200);
      expect(resTi.body.lang).toBe('ti');
      expect(resTi.body.reviewStatus).toBe('machine-generated');
    });

    it('approves caption tracks in om and ti', async () => {
      const resOm = await request(app)
        .post('/api/videos/mock-video-demo-01/approve/om')
        .set('X-Studio-Key', TEST_KEY);
      expect(resOm.status).toBe(200);
      expect(resOm.body.lang).toBe('om');
      expect(resOm.body.approved).toBe(true);

      const resTi = await request(app)
        .post('/api/videos/mock-video-demo-01/approve/ti')
        .set('X-Studio-Key', TEST_KEY);
      expect(resTi.status).toBe(200);
      expect(resTi.body.lang).toBe('ti');
      expect(resTi.body.approved).toBe(true);
    });

    it('retrieves WebVTT captions directly for om and ti', async () => {
      const resOm = await request(app).get('/api/videos/mock-video-demo-01/captions/om');
      expect(resOm.status).toBe(200);
      expect(resOm.headers['content-type']).toContain('text/vtt');
      expect(resOm.text).toContain('WEBVTT');

      const resTi = await request(app).get('/api/videos/mock-video-demo-01/captions/ti');
      expect(resTi.status).toBe(200);
      expect(resTi.headers['content-type']).toContain('text/vtt');
      expect(resTi.text).toContain('WEBVTT');
    });

    it('returns raw text/plain transcripts for om and ti', async () => {
      const resOm = await request(app).get('/api/v1/lessons/mock-video-demo-01/transcript?lang=om');
      expect(resOm.status).toBe(200);
      expect(resOm.headers['content-type']).toContain('text/plain');
      expect(resOm.text).toContain('Baga gara');

      const resTi = await request(app).get('/api/v1/lessons/mock-video-demo-01/transcript?lang=ti');
      expect(resTi.status).toBe(200);
      expect(resTi.headers['content-type']).toContain('text/plain');
      expect(resTi.text).toContain('እንቋዕ');
    });

    it('accepts POST /api/v1/lessons/:id/captions for om and ti', async () => {
      const resOm = await request(app)
        .post('/api/v1/lessons/mock-video-demo-01/captions')
        .set('X-Studio-Key', TEST_KEY)
        .send({ lang: 'om', vtt: validVtt });
      expect(resOm.status).toBe(200);
      expect(resOm.body.lang).toBe('om');

      const resTi = await request(app)
        .post('/api/v1/lessons/mock-video-demo-01/captions')
        .set('X-Studio-Key', TEST_KEY)
        .send({ lang: 'ti', vtt: validVtt });
      expect(resTi.status).toBe(200);
      expect(resTi.body.lang).toBe('ti');
    });

    it('still rejects unsupported languages with 400 and INVALID_LANGUAGE', async () => {
      const res = await request(app)
        .get('/api/videos/mock-video-demo-01/captions/de');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_LANGUAGE');
      expect(res.body.error).toContain('om');
      expect(res.body.error).toContain('ti');
    });
  });
});
