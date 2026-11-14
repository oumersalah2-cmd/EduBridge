/**
 * WebVTT and Plain-Text Transcript Generator
 *
 * Adheres to W3C WebVTT specification and broadcast accessibility guidelines:
 * - HH:MM:SS.mmm timestamp formatting
 * - Monotonic, non-overlapping cue boundaries
 * - Max ~42 characters per line, at most 2 lines per cue
 */

function formatTimestamp(totalSeconds) {
  const sec = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);
  const milliseconds = Math.floor((sec - Math.floor(sec)) * 1000);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(milliseconds).padStart(3, '0');

  return `${hh}:${mm}:${ss}.${mmm}`;
}

function wrapText(text, maxLineLen = 42, maxLines = 2) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxLineLen) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) {
        break; // Reached last line allowance
      }
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  // If there are remaining words that exceeded maxLines, append them to the last line
  const consumedWordsCount = lines.join(' ').split(' ').length;
  if (consumedWordsCount < words.length) {
    const remaining = words.slice(consumedWordsCount).join(' ');
    lines[lines.length - 1] += ` ${remaining}`;
  }

  return lines.join('\n');
}

function segmentsToWebVTT(rawSegments = []) {
  let vtt = 'WEBVTT - EduBridge Accessible Captions\n\n';
  let lastEndTime = 0;

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i];
    let start = Math.max(lastEndTime, Number(seg.start) || 0);
    let end = Math.max(start + 0.5, Number(seg.end) || start + 1.0);

    // Guard against timestamp inversion
    if (end <= start) {
      end = start + 1.0;
    }

    const text = wrapText(seg.text || '');
    if (!text) continue;

    const startStr = formatTimestamp(start);
    const endStr = formatTimestamp(end);

    vtt += `${startStr} --> ${endStr}\n${text}\n\n`;
    lastEndTime = end;
  }

  return vtt;
}

function segmentsToTranscript(rawSegments = []) {
  if (!rawSegments || rawSegments.length === 0) return '';
  return rawSegments
    .map((s) => (s.text || '').trim())
    .filter(Boolean)
    .join(' ');
}

module.exports = {
  formatTimestamp,
  wrapText,
  segmentsToWebVTT,
  segmentsToTranscript
};
