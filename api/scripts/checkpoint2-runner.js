const path = require('path');
const fs = require('fs');
const pipelineQueue = require('../src/services/pipelineQueue');

async function runCheckpoint() {
  console.log('=== CHECKPOINT 2: Core Video & Audio Pipeline Execution ===\n');
  process.env.MOCK_API = 'false';

  const videoPath = path.resolve(__dirname, '../../uploads/videos/test-lesson.mp4');
  if (!fs.existsSync(videoPath)) {
    console.error('Test video not found at:', videoPath);
    process.exit(1);
  }

  const videoRecord = {
    _id: 'checkpoint2-test-lesson',
    title: 'Accessible Renewable Energy & Photovoltaics (Real Video Test)',
    sourcePath: videoPath,
    status: 'uploaded',
    progress: 0,
    step: 'Video uploaded. Queued for audio extraction and transcription.',
    captions: {},
    save: async function() {
      // In-memory save callback
      return true;
    }
  };

  console.log('Starting pipeline with video:', videoPath);
  console.log('Initial Status:', videoRecord.status);
  console.log('--------------------------------------------------');

  const startTime = Date.now();
  await pipelineQueue.processVideo(videoRecord);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('--------------------------------------------------');
  console.log(`Pipeline completed in ${elapsed}s!\n`);

  console.log('=== RESULTS VERIFICATION ===\n');
  console.log('1. Final Video State:');
  console.log(`   - Status: ${videoRecord.status}`);
  console.log(`   - Progress: ${videoRecord.progress}%`);
  console.log(`   - Step: "${videoRecord.step}"`);
  console.log(`   - Error: ${videoRecord.error || 'none'}\n`);

  console.log('2. Generated 64 kbps MP3 Audio File:');
  const mp3Path = videoRecord.mp3Path;
  if (mp3Path && fs.existsSync(mp3Path)) {
    const stat = fs.statSync(mp3Path);
    console.log(`   - Path: ${mp3Path}`);
    console.log(`   - Size: ${stat.size} bytes (${(stat.size / 1024).toFixed(2)} KB)`);
  } else {
    console.log('   - File missing!');
  }

  console.log('\n3. Generated en.vtt Caption File (First 15 lines):');
  const vttPath = videoRecord.captions?.en?.vttPath;
  if (vttPath && fs.existsSync(vttPath)) {
    const lines = fs.readFileSync(vttPath, 'utf8').split('\n').slice(0, 15);
    lines.forEach((l, idx) => console.log(`   [${idx + 1}] ${l}`));
  } else {
    console.log('   - File missing!');
  }

  console.log('\n4. Generated Transcript Text:');
  console.log(`   "${videoRecord.transcript}"\n`);
}

runCheckpoint().catch((err) => {
  console.error('Checkpoint failed:', err);
  process.exit(1);
});
