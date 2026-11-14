const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function resolveCommand(binName, fallbackBins = []) {
  if (process.env[`${binName.toUpperCase()}_PATH`]) {
    return process.env[`${binName.toUpperCase()}_PATH`];
  }
  for (const b of [binName, ...fallbackBins]) {
    try {
      if (fs.existsSync(b)) return b;
    } catch (e) {}
  }
  return binName;
}

const FFMPEG_BIN = resolveCommand('ffmpeg', ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/home/ab/.local/bin/ffmpeg']);
const FFPROBE_BIN = resolveCommand('ffprobe', ['/usr/bin/ffprobe', '/usr/local/bin/ffprobe', '/home/ab/.local/bin/ffprobe']);

/**
 * Validates whether the video file is readable and not corrupt.
 */
function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error('The uploaded video file was not found on the server.'));
    }

    // Try ffprobe first
    execFile(
      FFPROBE_BIN,
      ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type', '-of', 'json', inputPath],
      (err, stdout, stderr) => {
        if (!err && stdout) {
          try {
            const data = JSON.parse(stdout);
            return resolve(data);
          } catch (e) {}
        }

        // Fallback to gst-discoverer-1.0 if ffprobe is not installed or failed
        execFile('gst-discoverer-1.0', [inputPath], (gstErr, gstStdout) => {
          if (!gstErr && gstStdout && !gstStdout.includes('An error occurred')) {
            return resolve({ valid: true, raw: gstStdout });
          }

          // If file is empty or corrupted
          const stats = fs.statSync(inputPath);
          if (stats.size === 0) {
            return reject(new Error('The uploaded file is empty (0 bytes). Please upload a valid video.'));
          }

          reject(new Error('The uploaded video file appears to be corrupted or in an unsupported format. Please try re-encoding or exporting as MP4/WebM.'));
        });
      }
    );
  });
}

/**
 * Extracts 16 kHz mono WAV for speech recognition.
 */
function extractWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile(
      FFMPEG_BIN,
      ['-y', '-i', inputPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outputPath],
      (err) => {
        if (!err && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          return resolve(outputPath);
        }

        // GStreamer fallback
        const gstArgs = [
          '-e',
          'filesrc', `location=${inputPath}`,
          '!', 'decodebin',
          '!', 'audioconvert',
          '!', 'audioresample',
          '!', 'audio/x-raw,rate=16000,channels=1',
          '!', 'wavenc',
          '!', 'filesink', `location=${outputPath}`
        ];
        execFile('gst-launch-1.0', gstArgs, (gstErr) => {
          if (!gstErr && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            return resolve(outputPath);
          }
          reject(new Error('Failed to extract audio track from video. Please verify the video has an audio stream.'));
        });
      }
    );
  });
}

/**
 * Compresses audio to 64 kbps mono MP3 for low-bandwidth 3G streaming.
 */
function compressToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile(
      FFMPEG_BIN,
      ['-y', '-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-b:a', '64k', '-ac', '1', outputPath],
      (err) => {
        if (!err && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          return resolve(outputPath);
        }

        // GStreamer fallback
        const gstArgs = [
          '-e',
          'filesrc', `location=${inputPath}`,
          '!', 'decodebin',
          '!', 'audioconvert',
          '!', 'audioresample',
          '!', 'audio/x-raw,rate=44100,channels=1',
          '!', 'lamemp3enc', 'target=1', 'bitrate=64', 'cbr=true', 'mono=true',
          '!', 'id3v2mux',
          '!', 'filesink', `location=${outputPath}`
        ];
        execFile('gst-launch-1.0', gstArgs, (gstErr) => {
          if (!gstErr && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            return resolve(outputPath);
          }
          reject(new Error('Failed to compress audio into 64 kbps MP3 format.'));
        });
      }
    );
  });
}

module.exports = {
  probeVideo,
  extractWav,
  compressToMp3
};

