const mongoose = require('mongoose');

const WebhookSchema = new mongoose.Schema({
  url: { type: String, required: true },
  events: [{ type: String, required: true }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Webhook || mongoose.model('Webhook', WebhookSchema);

