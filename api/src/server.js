require('dotenv').config();
const os = require('os');
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 4000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/edubridge';

// Helper to find local LAN IP for teacher hotspot / LAN mode
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

function validateProductionSecurity(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const studioKey = env.STUDIO_KEY;
  const defaultKey = 'change-me-to-a-long-random-string';

  if (isProduction && (!studioKey || studioKey.trim() === '' || studioKey === defaultKey)) {
    throw new Error('Production security requirement failed: STUDIO_KEY must be set to a secure custom secret in production mode. Refusing to start with missing or default credentials.');
  }
}

async function startServer() {
  validateProductionSecurity();

  if (process.env.MOCK_API === 'true') {
    console.log('⚡ EduBridge Mock API active (MOCK_API=true). Fast standalone mode enabled.');
  } else {
    try {
      await mongoose.connect(MONGO_URL, {
        serverSelectionTimeoutMS: 3000,
      });
      console.log(`Connected to MongoDB at ${MONGO_URL}`);
      const { seedDatabaseIfEmpty } = require('../scripts/seed-demo');
      await seedDatabaseIfEmpty();
    } catch (err) {
      console.warn(`MongoDB connection warning: ${err.message}. Starting in offline/standalone mode.`);
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    const lanIp = getLocalIp();
    console.log(`EduBridge API server running on:`);
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`  LAN:     http://${lanIp}:${PORT}`);
    console.log(`  Docs:    http://${lanIp}:${PORT}/api/docs`);
    console.log(`  Health:  http://${lanIp}:${PORT}/api/health`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, validateProductionSecurity };
