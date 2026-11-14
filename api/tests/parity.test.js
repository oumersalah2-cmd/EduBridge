const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const Video = require('../src/models/Video');
const { validateProductionSecurity } = require('../src/server');

/**
 * Extracts recursive shape of an object: { key: type }
 */
function getShape(val) {
  if (val === null) return 'null';
  if (Array.isArray(val)) {
    return val.length > 0 ? [getShape(val[0])] : [];
  }
  if (typeof val === 'object') {
    const shape = {};
    for (const key of Object.keys(val).sort()) {
      shape[key] = getShape(val[key]);
    }
    return shape;
  }
  return typeof val;
}

describe('Contract Parity & Security Tests (Mock vs Real Mode)', () => {
  const TEST_KEY = 'test-studio-key-for-parity';
  const testObjectId = '507f1f77bcf86cd799439011';
  const sampleVtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nAccessible parity cue.';
  const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
  const sampleVideoFile = path.join(FIXTURES_DIR, 'parity_dummy.mp4');

  beforeAll(() => {
    process.env.STUDIO_KEY = TEST_KEY;
    process.env.PUBLIC_BASE_URL = 'http://localhost:4000';

    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
    fs.writeFileSync(sampleVideoFile, Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]));
  });

  afterAll(() => {
    try {
      if (fs.existsSync(sampleVideoFile)) fs.unlinkSync(sampleVideoFile);
      if (fs.existsSync(FIXTURES_DIR)) fs.rmdirSync(FIXTURES_DIR);
    } catch (e) {}
  });

  describe('1. Response Shape Parity (Mock Mode vs Real Mode)', () => {
    it('POST /api/videos response shapes match identically', async () => {
      // 1. Mock Mode
      process.env.MOCK_API = 'true';
      const mockRes = await request(app)
        .post('/api/videos')
        .set('X-Studio-Key', TEST_KEY)
        .attach('video', sampleVideoFile);
      expect(mockRes.status).toBe(202);
      const mockShape = getShape(mockRes.body);

      // 2. Real Mode
      process.env.MOCK_API = 'false';
      jest.spyOn(Video.prototype, 'save').mockResolvedValue(true);
      const realRes = await request(app)
        .post('/api/videos')
        .set('X-Studio-Key', TEST_KEY)
        .attach('video', sampleVideoFile);
      expect(realRes.status).toBe(202);
      const realShape = getShape(realRes.body);

      expect(realShape).toEqual(mockShape);
    });

    it('GET /api/videos/:id response shapes match identically', async () => {
      // 1. Mock Mode
      process.env.MOCK_API = 'true';
      const mockRes = await request(app).get('/api/videos/mock-video-demo-01');
      expect(mockRes.status).toBe(200);
      const mockShape = getShape(mockRes.body);

      // 2. Real Mode
      process.env.MOCK_API = 'false';
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(testObjectId),
        status: 'review',
        progress: 100,
        step: 'Transcription complete. Human review ready.',
        error: null
      };
      jest.spyOn(Video, 'findById').mockResolvedValue(mockDoc);

      const realRes = await request(app).get(`/api/videos/${testObjectId}`);
      expect(realRes.status).toBe(200);
      const realShape = getShape(realRes.body);

      expect(realShape).toEqual(mockShape);
    });

    it('PUT /api/videos/:id/captions/en response shapes match identically', async () => {
      // 1. Mock Mode
      process.env.MOCK_API = 'true';
      const mockRes = await request(app)
        .put('/api/videos/mock-video-demo-01/captions/en')
        .set('X-Studio-Key', TEST_KEY)
        .set('Content-Type', 'text/vtt')
        .send(sampleVtt);
      expect(mockRes.status).toBe(200);
      const mockShape = getShape(mockRes.body);

      // 2. Real Mode
      process.env.MOCK_API = 'false';
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(testObjectId),
        captions: {},
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(Video, 'findById').mockResolvedValue(mockDoc);

      const realRes = await request(app)
        .put(`/api/videos/${testObjectId}/captions/en`)
        .set('X-Studio-Key', TEST_KEY)
        .set('Content-Type', 'text/vtt')
        .send(sampleVtt);
      expect(realRes.status).toBe(200);
      const realShape = getShape(realRes.body);

      expect(realShape).toEqual(mockShape);
    });

    it('POST /api/videos/:id/approve/en response shapes match identically', async () => {
      // 1. Mock Mode
      process.env.MOCK_API = 'true';
      const mockRes = await request(app)
        .post('/api/videos/mock-video-demo-01/approve/en')
        .set('X-Studio-Key', TEST_KEY);
      expect(mockRes.status).toBe(200);
      const mockShape = getShape(mockRes.body);

      // 2. Real Mode
      process.env.MOCK_API = 'false';
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(testObjectId),
        captions: {
          en: {
            vttPath: '/tmp/test.vtt',
            status: 'machine-generated'
          }
        },
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(Video, 'findById').mockResolvedValue(mockDoc);

      const realRes = await request(app)
        .post(`/api/videos/${testObjectId}/approve/en`)
        .set('X-Studio-Key', TEST_KEY);
      expect(realRes.status).toBe(200);
      const realShape = getShape(realRes.body);

      expect(realShape).toEqual(mockShape);
    });

    it('POST /api/videos/:id/publish response shapes match identically', async () => {
      // 1. Mock Mode
      process.env.MOCK_API = 'true';
      const mockRes = await request(app)
        .post('/api/videos/mock-video-demo-01/publish')
        .set('X-Studio-Key', TEST_KEY);
      expect(mockRes.status).toBe(200);
      const mockShape = getShape(mockRes.body);

      // 2. Real Mode
      process.env.MOCK_API = 'false';
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(testObjectId),
        status: 'review',
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(Video, 'findById').mockResolvedValue(mockDoc);

      const realRes = await request(app)
        .post(`/api/videos/${testObjectId}/publish`)
        .set('X-Studio-Key', TEST_KEY);
      expect(realRes.status).toBe(200);
      const realShape = getShape(realRes.body);

      expect(realShape).toEqual(mockShape);
    });

    it('GET /api/public/videos/:id response shapes match identically', async () => {
      // 1. Mock Mode
      process.env.MOCK_API = 'true';
      const mockRes = await request(app).get('/api/public/videos/mock-video-demo-01');
      expect(mockRes.status).toBe(200);
      const mockShape = getShape(mockRes.body);

      // 2. Real Mode
      process.env.MOCK_API = 'false';
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(testObjectId),
        title: 'Accessible Renewable Energy (Parity Test)',
        status: 'published',
        videoUrl: '/assets/demo/demo_lesson_sign.mp4',
        audioUrl: '/assets/demo/demo_lesson_64k.mp3',
        signVideoUrl: '/assets/demo/demo_lesson_sign.mp4',
        captions: {
          en: {
            vttUrl: '/assets/demo/demo_lesson_en.vtt',
            reviewStatus: 'human-reviewed'
          },
          am: {
            vttUrl: '/assets/demo/demo_lesson_am.vtt',
            reviewStatus: 'machine-generated'
          }
        },
        transcript: 'Full transcript for accessibility.',
        chatLog: [],
        offlinePackUrl: `/api/public/videos/${testObjectId}/offlinepack`,
        brailleUrl: '/assets/demo/demo_lesson.brf'
      };
      jest.spyOn(Video, 'findById').mockResolvedValue(mockDoc);

      const realRes = await request(app).get(`/api/public/videos/${testObjectId}`);
      expect(realRes.status).toBe(200);
      const realShape = getShape(realRes.body);

      expect(realShape).toEqual(mockShape);
    });

    it('GET /api/videos/:id/preview response shapes match identically (including rawCaptions)', async () => {
      // 1. Mock Mode
      process.env.MOCK_API = 'true';
      const mockRes = await request(app)
        .get('/api/videos/mock-video-demo-01/preview')
        .set('X-Studio-Key', TEST_KEY);
      expect(mockRes.status).toBe(200);
      const mockShape = getShape(mockRes.body);

      // 2. Real Mode
      process.env.MOCK_API = 'false';
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(testObjectId),
        title: 'Accessible Renewable Energy (Parity Test)',
        status: 'review',
        videoUrl: '/assets/demo/demo_lesson_sign.mp4',
        audioUrl: '/assets/demo/demo_lesson_64k.mp3',
        signVideoUrl: '/assets/demo/demo_lesson_sign.mp4',
        captions: {
          en: {
            vttUrl: '/assets/demo/demo_lesson_en.vtt',
            reviewStatus: 'human-reviewed'
          },
          am: {
            vttUrl: '/assets/demo/demo_lesson_am.vtt',
            reviewStatus: 'machine-generated'
          }
        },
        transcript: 'Full transcript for accessibility.',
        chatLog: [],
        offlinePackUrl: `/api/public/videos/${testObjectId}/offlinepack`,
        brailleUrl: '/assets/demo/demo_lesson.brf'
      };
      jest.spyOn(Video, 'findById').mockResolvedValue(mockDoc);

      const realRes = await request(app)
        .get(`/api/videos/${testObjectId}/preview`)
        .set('X-Studio-Key', TEST_KEY);
      expect(realRes.status).toBe(200);
      const realShape = getShape(realRes.body);

      expect(realShape).toEqual(mockShape);
      expect(realRes.body).toHaveProperty('rawCaptions');
      expect(typeof realRes.body.rawCaptions).toBe('object');
    });
  });

  describe('2. Real Mode Conflict (409) & Not Found (404) Guards', () => {
    beforeEach(() => {
      process.env.MOCK_API = 'false';
    });

    it('POST /api/videos/:id/publish returns 409 if video is not in review status', async () => {
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(testObjectId),
        status: 'processing',
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(Video, 'findById').mockResolvedValue(mockDoc);

      const res = await request(app)
        .post(`/api/videos/${testObjectId}/publish`)
        .set('X-Studio-Key', TEST_KEY);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Only lessons in "review" status can be published');
    });

    it('GET /api/public/videos/:id returns 409 if video is not published (e.g. in review)', async () => {
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(testObjectId),
        status: 'review'
      };
      jest.spyOn(Video, 'findById').mockResolvedValue(mockDoc);

      const res = await request(app).get(`/api/public/videos/${testObjectId}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('is not yet available for public access');
    });

    it('GET /api/videos/:id/preview rejects missing X-Studio-Key with 401', async () => {
      const res = await request(app).get(`/api/videos/${testObjectId}/preview`);
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('X-Studio-Key');
    });

    it('GET /api/videos/:id/preview returns 409 if video status is failed', async () => {
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(testObjectId),
        status: 'failed'
      };
      jest.spyOn(Video, 'findById').mockResolvedValue(mockDoc);

      const res = await request(app)
        .get(`/api/videos/${testObjectId}/preview`)
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Preview is not available because processing failed');
    });

    it('GET /api/public/videos/:id returns 404 for unknown video ID', async () => {
      jest.spyOn(Video, 'findById').mockResolvedValue(null);

      const res = await request(app).get(`/api/public/videos/${testObjectId}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('was not found');
    });
  });

  describe('3. Production Security Startup Check', () => {
    it('refuses to start when NODE_ENV=production and STUDIO_KEY is default or empty', () => {
      const defaultEnv = {
        NODE_ENV: 'production',
        STUDIO_KEY: 'change-me-to-a-long-random-string'
      };
      expect(() => validateProductionSecurity(defaultEnv)).toThrow(
        /Production security requirement failed/
      );

      const emptyEnv = {
        NODE_ENV: 'production',
        STUDIO_KEY: ''
      };
      expect(() => validateProductionSecurity(emptyEnv)).toThrow(
        /STUDIO_KEY must be set to a secure custom secret/
      );
    });

    it('allows server to start when NODE_ENV=production and a secure STUDIO_KEY is provided', () => {
      const secureEnv = {
        NODE_ENV: 'production',
        STUDIO_KEY: 'super-secret-random-prod-key-9876543210'
      };
      expect(() => validateProductionSecurity(secureEnv)).not.toThrow();
    });

    it('allows server to start in development mode even with default STUDIO_KEY', () => {
      const devEnv = {
        NODE_ENV: 'development',
        STUDIO_KEY: 'change-me-to-a-long-random-string'
      };
      expect(() => validateProductionSecurity(devEnv)).not.toThrow();
    });
  });

  describe('4. 3G Offline Pack ZIP Verification Test', () => {
    const zlib = require('zlib');

    function readZipArchive(buf) {
      const files = {};
      let offset = 0;
      while (offset < buf.length - 4) {
        // Central directory file header signature: 0x02014b50 ("PK\x01\x02")
        if (buf.readUInt32LE(offset) === 0x02014b50) {
          const compSize = buf.readUInt32LE(offset + 20);
          const uncompSize = buf.readUInt32LE(offset + 24);
          const nameLen = buf.readUInt16LE(offset + 28);
          const extraLen = buf.readUInt16LE(offset + 30);
          const commentLen = buf.readUInt16LE(offset + 32);
          const localOffset = buf.readUInt32LE(offset + 42);
          const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);

          const localNameLen = buf.readUInt16LE(localOffset + 26);
          const localExtraLen = buf.readUInt16LE(localOffset + 28);
          const dataStart = localOffset + 30 + localNameLen + localExtraLen;
          const compData = buf.subarray(dataStart, dataStart + compSize);

          if (compSize === uncompSize) {
            files[name] = compData;
          } else {
            try {
              files[name] = zlib.inflateRawSync(compData);
            } catch (e) {
              files[name] = compData;
            }
          }
          offset += 46 + nameLen + extraLen + commentLen;
        } else {
          offset++;
        }
      }
      return {
        entries: Object.keys(files),
        files
      };
    }

    it('GET /api/public/videos/:id/offlinepack streams valid zip containing audio.mp3, transcript.txt, lesson.html, and lesson.brf', async () => {
      process.env.MOCK_API = 'true';
      const res = await request(app)
        .get('/api/public/videos/mock-video-demo-01/offlinepack')
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/zip');
      expect(Buffer.isBuffer(res.body)).toBe(true);

      const zip = readZipArchive(res.body);
      expect(zip.entries).toContain('lesson.html');
      expect(zip.entries).toContain('transcript.txt');
      expect(zip.entries).toContain('audio.mp3');
      expect(zip.entries).toContain('lesson.brf');

      // Verify lesson.html content inside zip: semantic headings, offline-only, Ethiopic font fallback
      const htmlString = zip.files['lesson.html'].toString('utf8');
      expect(htmlString).toContain('<!DOCTYPE html>');
      expect(htmlString).toContain('<html lang=');
      expect(htmlString).toContain('Full Lesson Transcript');
      expect(htmlString).toContain('Image descriptions');
      expect(htmlString).toContain('Noto Sans Ethiopic');
      expect(htmlString).not.toContain('http://');
      expect(htmlString).not.toContain('https://');
    });

    it('real mode offline pack uses real lesson transcript and never returns hardcoded demo text', async () => {
      process.env.MOCK_API = 'false';
      const realTestId = '507f191e810c19729de860ea';
      const customTranscript = 'Photosynthesis is the biological process by which green plants convert light into chemical energy.';
      const mockRealDoc = {
        _id: new mongoose.Types.ObjectId(realTestId),
        title: 'Photosynthesis and Energy Conversion',
        status: 'published',
        transcript: customTranscript,
        audioUrl: '/assets/demo/demo_lesson_64k.mp3',
        captions: {}
      };
      jest.spyOn(Video, 'findById').mockResolvedValue(mockRealDoc);

      const res = await request(app)
        .get(`/api/public/videos/${realTestId}/offlinepack`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/zip');

      const zip = readZipArchive(res.body);
      expect(zip.entries).toContain('lesson.html');
      expect(zip.entries).toContain('transcript.txt');

      const htmlContent = zip.files['lesson.html'].toString('utf8');
      const textContent = zip.files['transcript.txt'].toString('utf8');

      // Must contain real lesson transcript
      expect(htmlContent).toContain(customTranscript);
      expect(textContent).toContain(customTranscript);

      // Must NEVER contain the hardcoded demo text
      const hardcodedDemoText = 'Welcome to this accessible lesson on renewable energy';
      expect(htmlContent).not.toContain(hardcodedDemoText);
      expect(textContent).not.toContain(hardcodedDemoText);
    });
  });
});
