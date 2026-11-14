#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const path = require('path');
const Video = require('../src/models/Video');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/edubridge';

async function seedDemoLesson() {
  try {
    console.log(`Connecting to MongoDB at ${MONGO_URL}...`);
    await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB.');

    const demoData = {
      title: 'Accessible Renewable Energy & Photovoltaics (Demo Lesson)',
      status: 'review',
      progress: 100,
      step: 'Transcription complete. Human review ready.',
      error: null,
      audioUrl: '/uploads/audio/demo_lesson_64k.mp3',
      signVideoUrl: '/uploads/sign/demo_lesson_sign.mp4',
      captions: {
        en: {
          vttPath: path.resolve(__dirname, '../../uploads/captions/demo_lesson_en.vtt'),
          vttUrl: '/uploads/captions/demo_lesson_en.vtt',
          status: 'human-reviewed',
          reviewStatus: 'human-reviewed',
          approvedAt: new Date()
        },
        am: {
          vttPath: path.resolve(__dirname, '../../uploads/captions/demo_lesson_am.vtt'),
          vttUrl: '/uploads/captions/demo_lesson_am.vtt',
          status: 'machine-generated',
          reviewStatus: 'machine-generated'
        }
      },
      transcript: 'Welcome to this accessible lesson on renewable energy. Today we will explore solar photovoltaic cells and how they generate clean electricity. Notice how sunlight frees electrons in the semiconductor material.',
      transcriptText: 'Welcome to this accessible lesson on renewable energy. Today we will explore solar photovoltaic cells and how they generate clean electricity. Notice how sunlight frees electrons in the semiconductor material.',
      chatLog: []
    };

    const existing = await Video.findOne({ title: demoData.title });
    let demoVideo;
    if (existing) {
      Object.assign(existing, demoData);
      demoVideo = await existing.save();
      console.log(`Updated existing demo lesson (ID: ${demoVideo._id})`);
    } else {
      demoVideo = new Video(demoData);
      await demoVideo.save();
      console.log(`Seeded new demo lesson (ID: ${demoVideo._id})`);
    }

    console.log('Demo lesson seeding complete.');
    console.log(`Public URL: http://localhost:4000/api/public/videos/${demoVideo._id}`);
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

if (require.main === module) {
  seedDemoLesson();
}

module.exports = { seedDemoLesson };
