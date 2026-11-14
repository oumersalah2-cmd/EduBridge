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

const app = express();

// Disable x-powered-by for security
app.disable('x-powered-by');

// CORS: allow Studio, Player, and Partner origins
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Studio-Key', 'Last-Event-ID']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: ['text/vtt', 'text/plain'], limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads with accessible MIME types
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(__dirname, '../../uploads');
app.use('/uploads', express.static(UPLOADS_DIR, {
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
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Swagger UI documentation endpoint
const candidatePaths = [
  path.resolve(__dirname, '../../docs/openapi.yaml'),
  path.resolve(__dirname, '../docs/openapi.yaml'),
  path.resolve(process.cwd(), 'docs/openapi.yaml'),
  path.resolve(process.cwd(), '../docs/openapi.yaml'),
];
const openApiPath = candidatePaths.find((p) => fs.existsSync(p));

if (openApiPath) {
  try {
    const swaggerDocument = YAML.load(openApiPath);
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
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
  message: {
    error: 'Too many requests. Please wait a moment before trying again.'
  }
});

const questionRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 questions per 5 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'You have submitted several questions recently. Please wait a few minutes before submitting another.'
  }
});

// Attach rate limiters
app.use('/api/public', publicRateLimiter);
app.use('/api/live/sessions/:pin/questions', questionRateLimiter);

// Mount core routers
app.use('/api/videos', videosRouter);
app.use('/api/public/videos', publicVideosRouter);
app.use('/api/live', liveRouter);
app.use('/api/jobs', jobsRouter);

// Plain-language 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: `The requested endpoint "${req.method} ${req.originalUrl}" was not found.`
  });
});

// Plain-language error handler (accessible, no stack traces or jargon)
app.use((err, req, res, next) => {
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  let message = err.message || 'An unexpected error occurred. Please try again.';

  if (err.code === 'LIMIT_FILE_SIZE') {
    message = 'The uploaded file exceeds the maximum allowed size limit.';
  }

  res.status(status).json({
    error: message
  });
});

module.exports = app;
