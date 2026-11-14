const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Job = require('../models/Job');
const { mockJobs } = require('./mockData');

// Ensure at least 3 Ethiopian job postings exist in database if connected
async function seedJobsIfEmpty() {
  if (mongoose.connection.readyState !== 1) {
    return;
  }
  try {
    const count = await Job.countDocuments();
    if (count === 0) {
      await Job.insertMany(mockJobs.map(j => ({ ...j, _id: undefined })));
      console.log('Seeded 3 accessible Ethiopian job postings to database.');
    }
  } catch (err) {
    // If mongo is offline/disconnected, silently proceed
  }
}

// When mongo connects, seed jobs
mongoose.connection.on('connected', () => {
  seedJobsIfEmpty();
});


// GET /api/jobs - List accessible job cards
router.get('/', async (req, res, next) => {
  if (process.env.MOCK_API === 'true') {
    return res.json(mockJobs);
  }

  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    if (!jobs || jobs.length === 0) {
      // Fallback to seeded mock jobs if database has no records
      return res.json(mockJobs);
    }
    return res.json(jobs);
  } catch (err) {
    // Return mock jobs on database disconnect rather than crashing
    return res.json(mockJobs);
  }
});

// GET /api/jobs/:id - Get specific job card
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;

  if (process.env.MOCK_API === 'true') {
    const job = mockJobs.find((j) => j.id === id || j._id?.toString() === id);
    if (!job) {
      return res.status(404).json({
        error: `Job posting with ID "${id}" was not found.`
      });
    }
    return res.json(job);
  }

  try {
    let job = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      job = await Job.findById(id);
    }
    if (!job) {
      job = mockJobs.find((j) => j.id === id);
    }

    if (!job) {
      return res.status(404).json({
        error: `Job posting with ID "${id}" was not found.`
      });
    }

    return res.json(job);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
