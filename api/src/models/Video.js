const mongoose = require('mongoose');

const CaptionTrackSchema = new mongoose.Schema({
  vttPath: { type: String, default: '' },
  vttUrl: { type: String, default: '' },
  status: {
    type: String,
    enum: ['machine-generated', 'human-reviewed'],
    default: 'machine-generated'
  },
  approvedAt: { type: Date }
}, { _id: false });

const VideoSchema = new mongoose.Schema({
  title: { type: String, default: 'Untitled Lesson' },
  status: {
    type: String,
    enum: ['uploaded', 'live', 'processing', 'review', 'published', 'failed'],
    default: 'uploaded',
    required: true
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  step: { type: String, default: 'Video uploaded, awaiting processing' },
  error: { type: String },

  videoPath: { type: String },
  videoUrl: { type: String },
  signVideoPath: { type: String },
  signVideoUrl: { type: String },
  audioPath: { type: String },
  audioUrl: { type: String },

  captions: {
    en: { type: CaptionTrackSchema, default: () => ({}) },
    am: { type: CaptionTrackSchema, default: () => ({}) },
    om: { type: CaptionTrackSchema, default: () => ({}) }
  },

  transcriptText: { type: String, default: '' },
  chatLog: [{
    id: { type: String },
    type: { type: String, enum: ['question', 'board', 'system'], default: 'question' },
    text: { type: String, required: true },
    ts: { type: Number },
    createdAt: { type: Date, default: Date.now }
  }],

  offlinePackPath: { type: String },
  offlinePackUrl: { type: String },
  braillePath: { type: String },
  brailleUrl: { type: String },

  embedSnippet: { type: String },
  iframeSnippet: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.models.Video || mongoose.model('Video', VideoSchema);
