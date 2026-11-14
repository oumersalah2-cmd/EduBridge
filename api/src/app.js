const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Plain-language fallback error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'An unexpected server error occurred. Please try again.'
  });
});

module.exports = app;
