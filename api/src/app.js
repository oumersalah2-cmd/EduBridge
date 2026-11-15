const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');
const { rateLimit } = require('express-rate-limit');

// Disable Mongoose command buffering so queries fail fast when offline
mongoose.set('bufferCommands', false);

// Routes
const { videosRouter, publicVideosRouter } = require('./routes/videos');
const liveRouter = require('./routes/live');
const jobsRouter = require('./routes/jobs');
const v1Router = require('./routes/v1');

const app = express();

// Trust reverse proxies (ngrok, localtunnel, Cloudflare, NGINX) to resolve real client IP and proto/host
app.set('trust proxy', true);

// Disable x-powered-by for security
app.disable('x-powered-by');

// CORS: allow Studio, Player, and Partner origins
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Studio-Key', 'Last-Event-ID', 'X-EduBridge-Signature']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: ['text/vtt', 'text/plain'], limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads and tracked demo assets with accessible MIME types
const staticHeaderOptions = {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.vtt')) {
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    } else if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (filePath.endsWith('.brf')) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    } else if (filePath.endsWith('.zip')) {
      res.setHeader('Content-Type', 'application/zip');
    } else if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    }
  }
};

const UPLOADS_DIR = process.env.UPLOADS_DIR || (fs.existsSync(path.resolve(__dirname, '../uploads')) ? path.resolve(__dirname, '../uploads') : path.resolve(__dirname, '../../uploads'));
app.use('/uploads', express.static(UPLOADS_DIR, staticHeaderOptions));

const DEMO_ASSETS_DIR = path.resolve(__dirname, '../assets/demo');
app.use('/assets/demo', express.static(DEMO_ASSETS_DIR, staticHeaderOptions));

const PLAYER_DIR = path.resolve(__dirname, '../../player');
if (fs.existsSync(PLAYER_DIR)) {
  app.use('/player', express.static(PLAYER_DIR, staticHeaderOptions));
  app.use('/module', express.static(PLAYER_DIR, staticHeaderOptions));
}

const DEMO_DIR = path.resolve(__dirname, '../../demo');
if (fs.existsSync(DEMO_DIR)) {
  app.use('/demo', express.static(DEMO_DIR, staticHeaderOptions));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Swagger UI documentation endpoint (root openapi.yaml single source of truth)
const candidatePaths = [
  process.env.OPENAPI_PATH,
  path.resolve(__dirname, '../../openapi.yaml'),
  path.resolve(__dirname, '../openapi.yaml'),
  path.resolve(process.cwd(), 'openapi.yaml'),
  path.resolve(process.cwd(), '../openapi.yaml'),
  path.resolve(__dirname, '../../docs/openapi.yaml'),
  path.resolve(__dirname, '../docs/openapi.yaml'),
  path.resolve(process.cwd(), 'docs/openapi.yaml')
].filter(Boolean);

const openApiPath = candidatePaths.find((p) => fs.existsSync(p));

if (openApiPath) {
  try {
    const swaggerDocument = YAML.load(openApiPath);
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    app.get('/openapi.json', (req, res) => {
      res.json(swaggerDocument);
    });
    app.get('/api/openapi.json', (req, res) => {
      res.json(swaggerDocument);
    });
  } catch (err) {
    console.error('Failed to load OpenAPI spec from:', openApiPath, err.message);
  }
} else {
  console.warn('OpenAPI specification file not found in search paths.');
}

// Rate limiting for public and live question endpoints
const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    error: 'Too many requests. Please wait a moment before trying again.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

const questionRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 questions per 5 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    error: 'You have submitted several questions recently. Please wait a few minutes before submitting another.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Attach rate limiters
app.use('/api/public', publicRateLimiter);
app.use('/api/v1/lessons', publicRateLimiter);
app.use('/api/live/sessions/:pin/questions', questionRateLimiter);
app.use('/api/v1/live/sessions/:pin/questions', questionRateLimiter);

// Mount core routers at /api
app.use('/api/videos', videosRouter);
app.use('/api/public/videos', publicVideosRouter);
app.use('/api/live', liveRouter);
app.use('/api/jobs', jobsRouter);

// Mount existing routers at /api/v1 too (additive aliases)
app.use('/api/v1/videos', videosRouter);
app.use('/api/v1/public/videos', publicVideosRouter);
app.use('/api/v1/live', liveRouter);
app.use('/api/v1/jobs', jobsRouter);

// Mount /api/v1 layer routes (lessons, webhooks, certificates)
app.use('/api/v1', v1Router);

// Plain-language 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: `The requested endpoint "${req.method} ${req.originalUrl}" was not found.`,
    code: 'NOT_FOUND'
  });
});

// Plain-language error handler (accessible, no stack traces or jargon)
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let code = err.code || 'SERVER_ERROR';

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      code = 'FILE_TOO_LARGE';
    } else {
      status = 400;
      code = 'UPLOAD_ERROR';
    }
  } else if (err.message && err.message.toLowerCase().includes('unsupported video format')) {
    status = 400;
    code = 'FILE_TYPE_NOT_ALLOWED';
  } else if (err.message && err.message.toLowerCase().includes('unsupported audio format')) {
    status = 400;
    code = 'FILE_TYPE_NOT_ALLOWED';
  }

  let message = err.message || 'An unexpected error occurred. Please try again.';

  if (err.code === 'LIMIT_FILE_SIZE') {
    message = 'The uploaded file exceeds the maximum allowed size limit.';
  }

  res.status(status).json({
    error: message,
    code: code
  });
});

module.exports = app;
