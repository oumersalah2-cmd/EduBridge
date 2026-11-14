const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates an accessible, zero-dependency offline HTML lesson page.
 */
function generateLessonHtml(video) {
  const title = escapeHtml(video.title || 'Accessible Lesson');
  const transcript = escapeHtml(video.transcript || video.transcriptText || 'No transcript text available for this lesson.');
  const language = escapeHtml(video.language || 'en');

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — EduBridge Offline Lesson</title>
  <style>
    :root {
      --bg: #ffffff;
      --text: #1b1b1b;
      --surface: #f7f9fa;
      --border: #d0d7de;
      --accent: #0969da;
      --focus: #005a9c;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --text: #e6edf3;
        --surface: #161b22;
        --border: #30363d;
        --accent: #58a6ff;
        --focus: #79c0ff;
      }
    }
    body {
      margin: 0;
      padding: 1.5rem;
      background-color: var(--bg);
      color: var(--text);
      /* Safe fallback stack for Ethiopic script, system fonts, zero external requests */
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Ethiopic', 'Abyssinica SIL', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }
    a:focus-visible, button:focus-visible, audio:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 3px;
    }
    header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }
    h1 {
      font-size: 1.75rem;
      margin-top: 0.25rem;
      margin-bottom: 0.5rem;
    }
    h2 {
      font-size: 1.25rem;
      margin-top: 1.75rem;
      margin-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.25rem;
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      font-size: 0.8rem;
      font-weight: 600;
      border-radius: 4px;
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--accent);
    }
    audio {
      width: 100%;
      margin: 1rem 0;
    }
    .content-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1rem;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .image-descriptions-box {
      background: var(--surface);
      border-left: 4px solid var(--accent);
      border-radius: 0 6px 6px 0;
      padding: 0.75rem 1rem;
      margin: 1rem 0;
    }
    footer {
      margin-top: 2.5rem;
      border-top: 1px solid var(--border);
      padding-top: 1rem;
      font-size: 0.875rem;
      color: var(--text);
      opacity: 0.85;
    }
  </style>
</head>
<body>
  <header>
    <span class="badge">EduBridge 3G Offline Lesson</span>
    <h1>${title}</h1>
    <p>This accessible offline lesson works with zero internet connection. All media and notes are stored locally.</p>
  </header>

  <main>
    <section aria-labelledby="audio-section-title">
      <h2 id="audio-section-title">Lesson Audio (64 kbps Mono)</h2>
      <audio controls src="audio.mp3" preload="metadata">
        Your device browser does not support the audio player tag. You can play <code>audio.mp3</code> directly in any audio player app.
      </audio>
    </section>

    <section aria-labelledby="transcript-section-title">
      <h2 id="transcript-section-title">Full Lesson Transcript</h2>
      <div class="content-box" role="region" aria-label="Lesson transcription text">
${transcript}
      </div>
    </section>

    <section aria-labelledby="image-desc-section-title">
      <h2 id="image-desc-section-title">Image descriptions</h2>
      <div class="image-descriptions-box">
        <p>No visual images or slides are attached to this lesson audio.</p>
      </div>
    </section>
  </main>

  <footer>
    <p>EduBridge — Accessible Learning Media (Digital Bridge Hackathon 2026)</p>
  </footer>
</body>
</html>`;
}

/**
 * Builds or streams the 3G offline ZIP package for a video.
 * Contains: audio.mp3, transcript.txt, lesson.html, and optional .brf.
 */
function packLessonZip(video, outputStream) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => reject(err));
    outputStream.on('close', () => resolve());
    outputStream.on('finish', () => resolve());

    archive.pipe(outputStream);

    // 1. lesson.html (zero-dependency accessible HTML)
    const htmlContent = generateLessonHtml(video);
    archive.append(htmlContent, { name: 'lesson.html' });

    // 2. transcript.txt (plain text)
    const transcriptText = video.transcript || video.transcriptText || 'EduBridge Lesson Transcript';
    archive.append(transcriptText, { name: 'transcript.txt' });

    // 3. audio.mp3 (64 kbps mono audio)
    const demoAudio = path.resolve(__dirname, '../../assets/demo/demo_lesson_64k.mp3');
    const audioCandidates = [video.mp3Path, video.audioPath, demoAudio].filter(Boolean);
    const resolvedAudio = audioCandidates.find((p) => fs.existsSync(p));

    if (resolvedAudio) {
      archive.file(resolvedAudio, { name: 'audio.mp3' });
    } else {
      archive.append(Buffer.from([]), { name: 'audio.mp3' });
    }

    // 4. lesson.brf (Braille file if exists)
    const demoBraille = path.resolve(__dirname, '../../assets/demo/demo_lesson.brf');
    const brailleCandidates = [video.braillePath, demoBraille].filter(Boolean);
    const resolvedBraille = brailleCandidates.find((p) => fs.existsSync(p));

    if (resolvedBraille) {
      archive.file(resolvedBraille, { name: 'lesson.brf' });
    }

    archive.finalize();
  });
}

module.exports = {
  generateLessonHtml,
  packLessonZip
};
