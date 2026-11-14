#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const path = require('path');
const Video = require('../src/models/Video');
const Job = require('../src/models/Job');
const { getMockJobs } = require('../src/routes/mockData');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/edubridge';

async function seedDemoJobs() {
  const jobs = getMockJobs();
  for (const jobData of jobs) {
    const existing = await Job.findOne({ title: jobData.title, employer: jobData.employer });
    if (existing) {
      Object.assign(existing, { ...jobData, _id: existing._id });
      await existing.save();
    } else {
      const newJob = new Job({ ...jobData, _id: undefined });
      await newJob.save();
    }
  }
  console.log(`Seeded ${jobs.length} accessible Ethiopian job postings into MongoDB.`);
}

async function seedDemoLesson() {
  try {
    console.log(`Connecting to MongoDB at ${MONGO_URL}...`);
    await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB.');

    // 1. Seed Accessible Jobs
    await seedDemoJobs();

    // 2. Seed Demo Lesson Video

    const demoData = {
      customId: 'demo',
      isDemo: true,
      title: 'Accessible Renewable Energy & Photovoltaics (Demo Lesson)',
      status: 'published',
      progress: 100,
      step: 'Lesson published and ready for accessible distribution.',
      error: null,
      videoUrl: '/assets/demo/demo_lesson_sign.mp4',
      audioUrl: '/assets/demo/demo_lesson_64k.mp3',
      signVideoUrl: '/assets/demo/demo_lesson_sign.mp4',
      brailleUrl: '/assets/demo/demo_lesson.brf',
      braillePath: path.resolve(__dirname, '../assets/demo/demo_lesson.brf'),
      captions: {
        en: {
          vttPath: path.resolve(__dirname, '../assets/demo/demo_lesson_en.vtt'),
          vttUrl: '/assets/demo/demo_lesson_en.vtt',
          status: 'human-reviewed',
          reviewStatus: 'human-reviewed',
          approvedAt: new Date()
        },
        am: {
          vttPath: path.resolve(__dirname, '../assets/demo/demo_lesson_am.vtt'),
          vttUrl: '/assets/demo/demo_lesson_am.vtt',
          status: 'machine-generated',
          reviewStatus: 'machine-generated'
        }
      },
      transcript: 'Welcome to this accessible lesson on renewable energy. Today we will explore solar photovoltaic cells and how they generate clean electricity. Notice how sunlight frees electrons in the semiconductor material.',
      transcriptText: 'Welcome to this accessible lesson on renewable energy. Today we will explore solar photovoltaic cells and how they generate clean electricity. Notice how sunlight frees electrons in the semiconductor material.',
      chatLog: [],
      offlinePackUrl: '/api/public/videos/demo/offlinepack'
    };

    const existing = await Video.findOne({ $or: [{ customId: 'demo' }, { title: demoData.title }] });
    let demoVideo;
    if (existing) {
      Object.assign(existing, demoData);
      demoVideo = await existing.save();
      console.log(`Updated existing demo lesson (ID: ${demoVideo._id}, customId: demo)`);
    } else {
      demoVideo = new Video(demoData);
      await demoVideo.save();
      console.log(`Seeded new demo lesson (ID: ${demoVideo._id}, customId: demo)`);
    }

    console.log('Demo lesson seeding complete.');
    console.log(`Public URL: http://localhost:4000/api/public/videos/demo`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed demo lesson:', err.message);
    if (err.message.includes('ECONNREFUSED')) {
      console.log('Hint: MongoDB is not reachable. Start MongoDB via "docker compose up mongo" or ensure your MONGO_URL in .env is correct.');
    }
    process.exit(1);
  }
}

async function seedDatabaseIfEmpty() {
  try {
    const videoCount = await Video.countDocuments();
    if (videoCount === 0) {
      console.log('[Server] Database is empty. Seeding initial demo lesson and jobs...');
      const jobs = getMockJobs();
      for (const jobData of jobs) {
        const newJob = new Job({ ...jobData, _id: undefined });
        await newJob.save();
      }

      const demoData = {
        customId: 'demo',
        isDemo: true,
        title: 'Accessible Renewable Energy & Photovoltaics (Demo Lesson)',
        status: 'published',
        progress: 100,
        step: 'Lesson published and ready for accessible distribution.',
        error: null,
        videoUrl: '/assets/demo/demo_lesson_sign.mp4',
        audioUrl: '/assets/demo/demo_lesson_64k.mp3',
        signVideoUrl: '/assets/demo/demo_lesson_sign.mp4',
        brailleUrl: '/assets/demo/demo_lesson.brf',
        braillePath: path.resolve(__dirname, '../assets/demo/demo_lesson.brf'),
        captions: {
          en: {
            vttPath: path.resolve(__dirname, '../assets/demo/demo_lesson_en.vtt'),
            vttUrl: '/assets/demo/demo_lesson_en.vtt',
            status: 'human-reviewed',
            reviewStatus: 'human-reviewed',
            approvedAt: new Date()
          },
          am: {
            vttPath: path.resolve(__dirname, '../assets/demo/demo_lesson_am.vtt'),
            vttUrl: '/assets/demo/demo_lesson_am.vtt',
            status: 'machine-generated',
            reviewStatus: 'machine-generated'
          }
        },
        transcript: 'Welcome to this accessible lesson on renewable energy. Today we will explore solar photovoltaic cells and how they generate clean electricity. Notice how sunlight frees electrons in the semiconductor material.',
        transcriptText: 'Welcome to this accessible lesson on renewable energy. Today we will explore solar photovoltaic cells and how they generate clean electricity. Notice how sunlight frees electrons in the semiconductor material.',
        chatLog: [],
        offlinePackUrl: '/api/public/videos/demo/offlinepack'
      };

      const demoVideo = new Video(demoData);
      await demoVideo.save();
      console.log(`[Server] Seeded demo lesson with stable ID "demo" (MongoDB _id: ${demoVideo._id}).`);
    }
  } catch (err) {
    console.warn('[Server] Auto-seed check failed or skipped:', err.message);
  }
}

if (require.main === module) {
  seedDemoLesson();
}

module.exports = { seedDemoLesson, seedDemoJobs, seedDatabaseIfEmpty };
