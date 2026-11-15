const mongoose = require('mongoose');

const CaptionTrackSchema = new mongoose.Schema({
  vttPath: { type: String, default: '' },
  vttUrl: { type: String, default: '' },
  status: {
    type: String,
    enum: ['machine-generated', 'human-reviewed'],
    default: 'machine-generated'
  },
  reviewStatus: {
    type: String,
    enum: ['machine-generated', 'human-reviewed'],
    default: 'machine-generated'
  },
  approvedAt: { type: Date }
}, { _id: false });

const VideoSchema = new mongoose.Schema({
  customId: { type: String, index: true },
  creatorId: { type: String, default: 'creator-default', index: true },
  isDemo: { type: Boolean, default: false },
  title: { type: String, default: 'Untitled Lesson' },
  description: { type: String, default: '' },
  duration: { type: Number, default: 0 },
  languages: { type: [String], default: ['en', 'am', 'om', 'ti'] },
  status: {
    type: String,
    enum: ['uploaded', 'live', 'processing', 'review', 'published', 'failed'],
    default: 'uploaded',
    required: true
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  step: { type: String, default: 'Video uploaded. Queued for audio extraction and transcription.' },
  error: { type: String, default: null },
  errorMessage: { type: String, default: null },
  publishedAt: { type: Date, default: null },

  // Source and media file paths
  sourcePath: { type: String },
  signPath: { type: String },
  videoPath: { type: String },
  videoUrl: { type: String },
  signVideoPath: { type: String },
  signVideoUrl: { type: String },
  wavPath: { type: String },
  mp3Path: { type: String },
  audioPath: { type: String },
  audioUrl: { type: String },
  audioDescriptionPath: { type: String, default: null },
  audioDescriptionUrl: { type: String, default: null },
  offlinePackPath: { type: String },
  offlinePackUrl: { type: String },
  offlinePackSizeBytes: { type: Number, default: 0 },

  // Captions & Transcripts
  captions: {
    en: { type: CaptionTrackSchema, default: () => ({}) },
    am: { type: CaptionTrackSchema, default: () => ({}) },
    om: { type: CaptionTrackSchema, default: () => ({}) },
    ti: { type: CaptionTrackSchema, default: () => ({}) }
  },
  captionUrls: { type: [String], default: [] },
  transcript: { type: String, default: '' },
  transcriptText: { type: String, default: '' },
  transcriptPath: { type: String },

  chatLog: [{
    id: { type: String },
    type: { type: String, enum: ['question', 'board', 'system'], default: 'question' },
    text: { type: String, required: true },
    ts: { type: Number },
    createdAt: { type: Date, default: Date.now }
  }],

  braillePath: { type: String },
  brailleUrl: { type: String },

  embedSnippet: { type: String },
  iframeSnippet: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.models.Video || mongoose.model('Video', VideoSchema);
