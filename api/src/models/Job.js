const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  employer: { type: String, required: true },
  location: { type: String, required: true },
  requirements: [{ type: String }],
  deadline: { type: Date, required: true },
  applyLink: { type: String, required: true },
  certificateUrl: { type: String },
  audioSummaryUrl: { type: String },
  textSummary: { type: String, required: true },
  jsonLd: { type: Object }
}, {
  timestamps: true
});

module.exports = mongoose.models.Job || mongoose.model('Job', JobSchema);
