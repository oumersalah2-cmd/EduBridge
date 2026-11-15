const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

function getPythonPath() {
  const venvPython = '/opt/venv/bin/python3';
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  const localApiVenv = path.resolve(__dirname, '../../.venv/bin/python3');
  if (fs.existsSync(localApiVenv)) {
    return localApiVenv;
  }
  const rootVenv = path.resolve(__dirname, '../../../api/.venv/bin/python3');
  if (fs.existsSync(rootVenv)) {
    return rootVenv;
  }
  return process.env.PYTHON_BIN || 'python3';
}

/**
 * Transcribes audio file using faster-whisper via transcribe.py script.
 */
function transcribeAudio(wavPath, options = {}) {
  const model = options.model || process.env.WHISPER_MODEL || 'base';
  const language = options.language || 'en';
  const scriptPath = path.resolve(__dirname, '../../scripts/transcribe.py');
  const pythonBin = getPythonPath();

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(wavPath)) {
      return reject(new Error(`WAV file not found for transcription at "${wavPath}".`));
    }

    const args = [scriptPath, wavPath, '--model', model, '--language', language];

    execFile(
      pythonBin,
      args,
      {
        timeout: 5 * 60 * 1000, // 5 min timeout
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          HF_HOME: process.env.HF_HOME || path.resolve(process.env.HOME || '/root', '.cache/huggingface')
        }
      },
      (err, stdout, stderr) => {
        if (err) {
          console.error('[WhisperService] Technical transcription error:', stderr || err.message);
          return reject(new Error('Automatic captioning could not be completed for this audio.'));
        }

        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch (parseErr) {
          console.error('[WhisperService] JSON parse error:', parseErr.message, stdout);
          reject(new Error('Failed to process speech recognition results.'));
        }
      }
    );
  });
}

module.exports = {
  transcribeAudio
};

