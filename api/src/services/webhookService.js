const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const mongoose = require('mongoose');
const Webhook = require('../models/Webhook');

// In-memory webhooks fallback store
const inMemoryWebhooks = new Map();

function registerMemoryWebhook(id, data) {
  inMemoryWebhooks.set(id, data);
}

function removeMemoryWebhook(id) {
  return inMemoryWebhooks.delete(id);
}

function getMemoryWebhooks() {
  return Array.from(inMemoryWebhooks.entries()).map(([id, data]) => ({ id, ...data }));
}

function isPrivateIpOrHost(hostname) {
  if (process.env.WEBHOOK_ALLOW_PRIVATE === 'true') {
    return false;
  }
  const clean = hostname.toLowerCase().trim();
  if (clean === 'localhost' || clean === '::1') return true;
  if (/^127\./.test(clean)) return true;
  if (/^10\./.test(clean)) return true;
  if (/^192\.168\./.test(clean)) return true;
  if (/^169\.254\./.test(clean)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)) return true;
  return false;
}

function validateWebhookUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Webhook URL must use http or https protocol.' };
    }
    if (isPrivateIpOrHost(parsed.hostname)) {
      return { valid: false, reason: 'Webhook URL cannot point to a private, loopback, or link-local address.' };
    }
    return { valid: true, parsed };
  } catch (err) {
    return { valid: false, reason: 'Invalid Webhook URL format.' };
  }
}

async function deliverWebhookOnce(url, payloadStr, signature) {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const transport = isHttps ? https : http;

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadStr),
    'User-Agent': 'EduBridge-Webhooks/1.0'
  };

  if (signature) {
    headers['X-EduBridge-Signature'] = `sha256=${signature}`;
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        method: 'POST',
        headers,
        timeout: 5000 // 5-second timeout
      },
      (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.statusCode);
        } else {
          reject(new Error(`Webhook destination returned HTTP ${res.statusCode}`));
        }
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Webhook request timed out after 5000ms'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payloadStr);
    req.end();
  });
}

async function deliverWithRetry(url, payload) {
  const secret = process.env.WEBHOOK_SECRET;
  const payloadStr = JSON.stringify(payload);
  let signature = null;

  if (secret) {
    signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  }

  try {
    await deliverWebhookOnce(url, payloadStr, signature);
  } catch (err1) {
    console.warn(`[Webhooks] Delivery attempt 1 failed to ${url}: ${err1.message}. Retrying in 1s...`);
    await new Promise((r) => setTimeout(r, 1000));
    try {
      await deliverWebhookOnce(url, payloadStr, signature);
    } catch (err2) {
      console.error(`[Webhooks] Delivery attempt 2 failed to ${url}: ${err2.message}. Dropping event.`);
    }
  }
}

function fireWebhook(event, data = {}) {
  const payload = {
    event,
    ...data,
    at: new Date().toISOString()
  };

  // Run in background (never block)
  setImmediate(async () => {
    // 1. Deliver to in-memory registered webhooks
    inMemoryWebhooks.forEach((hook) => {
      if (Array.isArray(hook.events) && hook.events.includes(event)) {
        deliverWithRetry(hook.url, payload).catch(() => {});
      }
    });

    // 2. Deliver to MongoDB registered webhooks if connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const hooks = await Webhook.find({ events: event });
        if (hooks && hooks.length > 0) {
          hooks.forEach((hook) => {
            // Avoid duplicate delivery if already registered in memory
            if (!inMemoryWebhooks.has(hook._id.toString())) {
              deliverWithRetry(hook.url, payload).catch(() => {});
            }
          });
        }
      } catch (err) {
        console.warn('[Webhooks] Lookup error:', err.message);
      }
    }
  });
}

module.exports = {
  isPrivateIpOrHost,
  validateWebhookUrl,
  fireWebhook,
  deliverWithRetry,
  registerMemoryWebhook,
  removeMemoryWebhook,
  getMemoryWebhooks
};
