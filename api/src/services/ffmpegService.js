const { execFile } = require('child_process');
const fs = require('fs');

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE_BIN = process.env.FFPROBE_PATH || 'ffprobe';

/**
 * Validates whether the video file is readable and not corrupt via ffprobe.
 */
function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error('The uploaded video file was not found on the server.'));
    }

    execFile(
      FFPROBE_BIN,
      ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type', '-of', 'json', inputPath],
      (err, stdout, stderr) => {
        if (err) {
          console.error('[FFprobe] Video probe error:', stderr || err.message);
          return reject(new Error('The uploaded video file appears to be corrupted or in an unsupported format.'));
        }

        try {
          const data = JSON.parse(stdout);
          return resolve(data);
        } catch (parseErr) {
          console.error('[FFprobe] Output parse error:', parseErr.message);
          return reject(new Error('The uploaded video file appears to be corrupted or in an unsupported format.'));
        }
      }
    );
  });
}

/**
 * Extracts 16 kHz mono WAV for speech recognition via ffmpeg.
 */
function extractWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile(
      FFMPEG_BIN,
      ['-y', '-i', inputPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outputPath],
      (err, stdout, stderr) => {
        if (err || !fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
          console.error('[FFmpeg] WAV extraction error:', stderr || err?.message);
          return reject(new Error('Failed to extract audio track from video.'));
        }
        resolve(outputPath);
      }
    );
  });
}

/**
 * Compresses audio to 64 kbps mono MP3 for low-bandwidth 3G streaming via ffmpeg.
 */
function compressToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile(
      FFMPEG_BIN,
      ['-y', '-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-b:a', '64k', '-ac', '1', outputPath],
      (err, stdout, stderr) => {
        if (err || !fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
          console.error('[FFmpeg] MP3 compression error:', stderr || err?.message);
          return reject(new Error('Failed to compress audio into 64 kbps MP3 format.'));
        }
        resolve(outputPath);
      }
    );
  });
}

module.exports = {
  probeVideo,
  extractWav,
  compressToMp3
};

