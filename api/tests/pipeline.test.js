const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const {
  formatTimestamp,
  wrapText,
  segmentsToWebVTT,
  segmentsToTranscript
} = require('../src/services/vttConverter');
const pipelineQueue = require('../src/services/pipelineQueue');
const ffmpegService = require('../src/services/ffmpegService');
const whisperService = require('../src/services/whisperService');
const Video = require('../src/models/Video');

describe('Job 2: Phase B Core Pipeline Tests (MOCK_API=false)', () => {
  const TEST_KEY = 'test-pipeline-key';
  const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
  const validDummyVideo = path.join(FIXTURES_DIR, 'sample_valid.mp4');
  const corruptDummyVideo = path.join(FIXTURES_DIR, 'corrupt.mp4');

  beforeAll(() => {
    process.env.STUDIO_KEY = TEST_KEY;
    process.env.MOCK_API = 'false';
    process.env.PUBLIC_BASE_URL = 'http://localhost:4000';

    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
    // Create valid mock mp4 header
    const mp4Header = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // ftyp
      0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
      0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
      0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31
    ]);
    fs.writeFileSync(validDummyVideo, mp4Header);
    fs.writeFileSync(corruptDummyVideo, Buffer.from('NOT_A_VIDEO_FILE_GARBAGE_BYTES'));
  });

  afterAll(() => {
    try {
      if (fs.existsSync(validDummyVideo)) fs.unlinkSync(validDummyVideo);
      if (fs.existsSync(corruptDummyVideo)) fs.unlinkSync(corruptDummyVideo);
      if (fs.existsSync(FIXTURES_DIR)) fs.rmdirSync(FIXTURES_DIR);
    } catch (e) {}
  });

  describe('1. WebVTT and Transcript Converter Unit Tests', () => {
    it('formatTimestamp formats seconds correctly into HH:MM:SS.mmm', () => {
      expect(formatTimestamp(0)).toBe('00:00:00.000');
      expect(formatTimestamp(1.234)).toBe('00:00:01.234');
      expect(formatTimestamp(65.5)).toBe('00:01:05.500');
      expect(formatTimestamp(3661.05)).toBe('01:01:01.050');
    });

    it('wrapText wraps text to ~42 characters and maximum 2 lines', () => {
      const longText = 'This is an accessible educational video on renewable solar energy and clean technologies.';
      const wrapped = wrapText(longText, 42, 2);
      const lines = wrapped.split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
      expect(lines[0].length).toBeLessThanOrEqual(45);
    });

    it('segmentsToWebVTT produces valid W3C WebVTT header and non-overlapping cues', () => {
      const segments = [
        { start: 0.0, end: 3.5, text: 'Welcome to this lesson.' },
        { start: 3.2, end: 6.0, text: 'Notice how solar cells generate electricity.' } // Intentional overlapping timestamp to test correction
      ];
      const vtt = segmentsToWebVTT(segments);
      expect(vtt.startsWith('WEBVTT')).toBe(true);
      expect(vtt).toContain('00:00:00.000 --> 00:00:03.500');
      // Second cue start should be adjusted to not overlap
      expect(vtt).toContain('00:00:03.500 --> 00:00:06.000');
      expect(vtt).toContain('Welcome to this lesson.');
    });

    it('segmentsToTranscript joins text cleanly into single string', () => {
      const segments = [
        { start: 0.0, end: 2.0, text: 'First sentence.' },
        { start: 2.0, end: 4.0, text: 'Second sentence.' }
      ];
      expect(segmentsToTranscript(segments)).toBe('First sentence. Second sentence.');
    });
  });

  describe('2. POST /api/videos Upload Validation (MOCK_API=false)', () => {
    it('rejects upload missing X-Studio-Key with 401', async () => {
      const res = await request(app)
        .post('/api/videos')
        .attach('video', validDummyVideo);
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unauthorized');
    });

    it('rejects unsupported file extension with 400 and plain-language message', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set('X-Studio-Key', TEST_KEY)
        .attach('video', Buffer.from('text file'), 'document.pdf');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unsupported video format');
      expect(res.body.error).toContain('MP4, WebM, or MOV');
    });

    it('rejects request missing video file with 400', async () => {
      const res = await request(app)
        .post('/api/videos')
        .set('X-Studio-Key', TEST_KEY);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required file: "video"');
    });
  });

  describe('3. In-Process Queue & Pipeline Lifecycle (MOCK_API=false)', () => {
    let probeSpy;
    let wavSpy;
    let mp3Spy;
    let whisperSpy;

    beforeEach(() => {
      // Mock heavy media tools for fast, non-blocking unit tests
      probeSpy = jest.spyOn(ffmpegService, 'probeVideo').mockResolvedValue({ valid: true });
      wavSpy = jest.spyOn(ffmpegService, 'extractWav').mockImplementation((input, out) => {
        fs.writeFileSync(out, 'MOCK_WAV_BYTES');
        return Promise.resolve(out);
      });
      mp3Spy = jest.spyOn(ffmpegService, 'compressToMp3').mockImplementation((input, out) => {
        fs.writeFileSync(out, 'MOCK_MP3_BYTES');
        return Promise.resolve(out);
      });
      whisperSpy = jest.spyOn(whisperService, 'transcribeAudio').mockResolvedValue({
        segments: [
          { start: 0.0, end: 3.0, text: 'Hello class, today we learn about solar energy.' },
          { start: 3.5, end: 7.0, text: 'Solar photons release charge carriers.' }
        ],
        duration: 7.0
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('executes all pipeline steps and reaches status: review at 100%', async () => {
      const testId = '507f191e810c19729de860ea';
      const mockVideoRecord = {
        _id: testId,
        title: 'Renewable Solar Lesson',
        sourcePath: validDummyVideo,
        status: 'uploaded',
        progress: 0,
        step: 'Video uploaded.',
        captions: {},
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Video, 'findById').mockResolvedValue(mockVideoRecord);

      await pipelineQueue.processVideo(testId);

      expect(probeSpy).toHaveBeenCalled();
      expect(wavSpy).toHaveBeenCalled();
      expect(mp3Spy).toHaveBeenCalled();
      expect(whisperSpy).toHaveBeenCalled();

      // Verify final video state
      expect(mockVideoRecord.status).toBe('review');
      expect(mockVideoRecord.progress).toBe(100);
      expect(mockVideoRecord.step).toBe('Transcription complete. Human review ready.');
      expect(mockVideoRecord.captions.en).toBeDefined();
      expect(mockVideoRecord.captions.en.reviewStatus).toBe('machine-generated');
      expect(mockVideoRecord.transcript).toContain('solar energy');
    }, 15000);

    it('handles corrupted video files with status: failed and accessible error message', async () => {
      const corruptId = '507f191e810c19729de860eb';
      probeSpy.mockRejectedValueOnce(new Error('The uploaded video file appears to be corrupted or in an unsupported format.'));

      const corruptVideoRecord = {
        _id: corruptId,
        title: 'Corrupt Video',
        sourcePath: corruptDummyVideo,
        status: 'uploaded',
        progress: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Video, 'findById').mockResolvedValue(corruptVideoRecord);

      await pipelineQueue.processVideo(corruptId);

      expect(corruptVideoRecord.status).toBe('failed');
      expect(corruptVideoRecord.progress).toBe(0);
      expect(corruptVideoRecord.step).toContain('Processing failed');
      expect(corruptVideoRecord.error).toContain('corrupted');

      // Technical terms must not be in the plain-language error
      expect(corruptVideoRecord.error).not.toContain('ffprobe');
      expect(corruptVideoRecord.error).not.toContain('Error:');
      expect(corruptVideoRecord.error).not.toContain('code');
    });

    it('returns a clean plain-language error with no technical jargon when transcription fails', async () => {
      const failedId = '507f191e810c19729de860ec';
      // Simulate underlying runtime / missing package error from whisper service
      whisperSpy.mockRejectedValueOnce(
        new Error("Command failed: python3 scripts/transcribe.py. ModuleNotFoundError: No module named 'faster_whisper'. Error: package missing.")
      );

      const failedVideoRecord = {
        _id: failedId,
        title: 'Transcription Failure Test',
        sourcePath: validDummyVideo,
        status: 'uploaded',
        progress: 0,
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Video, 'findById').mockResolvedValue(failedVideoRecord);

      await pipelineQueue.processVideo(failedId);

      expect(failedVideoRecord.status).toBe('failed');
      expect(failedVideoRecord.progress).toBe(0);
      expect(failedVideoRecord.step).toBe('Processing failed: Speech recognition failed.');
      expect(typeof failedVideoRecord.error).toBe('string');
      expect(failedVideoRecord.error.length).toBeGreaterThan(0);

      // Plain-language requirement: MUST NOT leak technical details, language, or stack terms
      const forbiddenTerms = ['package', 'Python', 'python', 'Error:', 'ModuleNotFoundError', 'traceback', 'stderr', 'spawn', 'child_process'];
      forbiddenTerms.forEach((term) => {
        expect(failedVideoRecord.error).not.toContain(term);
      });

      // Accessible wording check
      expect(failedVideoRecord.error).toContain('Automatic captioning could not be completed');
    });
  });

  describe('4. Human Caption Edit and Approval Flow (MOCK_API=false)', () => {
    it('editing a caption resets reviewStatus to machine-generated', async () => {
      const captionTestId = '507f1f77bcf86cd799439011';
      const mockVideoDoc = {
        _id: captionTestId,
        captions: {
          en: {
            vttPath: '/tmp/test_en.vtt',
            vttUrl: '/uploads/captions/test_en.vtt',
            status: 'human-reviewed',
            approvedAt: new Date()
          }
        },
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Video, 'findById').mockResolvedValue(mockVideoDoc);

      const res = await request(app)
        .put(`/api/videos/${captionTestId}/captions/en`)
        .set('X-Studio-Key', TEST_KEY)
        .set('Content-Type', 'text/vtt')
        .send('WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nHuman edited caption line.');

      expect(res.status).toBe(200);
      expect(res.body.approved).toBe(false);
      expect(res.body.reviewStatus).toBe('machine-generated');
    });

    it('approving a caption sets reviewStatus to human-reviewed', async () => {
      const captionTestId = '507f1f77bcf86cd799439011';
      const mockVideoDoc = {
        _id: captionTestId,
        captions: {
          en: {
            vttPath: '/tmp/test_en.vtt',
            status: 'machine-generated'
          }
        },
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Video, 'findById').mockResolvedValue(mockVideoDoc);

      const res = await request(app)
        .post(`/api/videos/${captionTestId}/approve/en`)
        .set('X-Studio-Key', TEST_KEY);

      expect(res.status).toBe(200);
      expect(res.body.approved).toBe(true);
      expect(res.body.reviewStatus).toBe('human-reviewed');
    });
  });
});
