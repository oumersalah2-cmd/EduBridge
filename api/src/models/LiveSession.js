const mongoose = require('mongoose');

const LiveSessionSchema = new mongoose.Schema({
  pin: {
    type: String,
    required: true,
    unique: true,
    index: true,
    match: /^\d{6}$/
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active'
  },
  joinUrl: { type: String, required: true },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '0s' } // TTL index based on expiresAt
  },
  captions: [{
    id: { type: String },
    text: { type: String, required: true },
    isFinal: { type: Boolean, default: false },
    ts: { type: Number, default: Date.now }
  }],
  boardNotes: [{
    id: { type: String },
    text: { type: String, required: true },
    ts: { type: Number, default: Date.now }
  }],
  questions: [{
    id: { type: String, required: true },
    text: { type: String, required: true, maxlength: 500 },
    ip: { type: String },
    dismissed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  recordedVideoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video'
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.LiveSession || mongoose.model('LiveSession', LiveSessionSchema);
