import { useRef, useState } from 'react';
import { uploadLesson, waitForReview } from './api.js';
import { LIMITS } from './config.js';

const TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export default function UploadStep({ onReady, announce }) {
  const [title, setTitle] = useState('');
  const [video, setVideo] = useState(null);
  const [sign, setSign] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('idle'); // idle, uploading, processing, done
  const [percent, setPercent] = useState(0);
  const videoRef = useRef(null);
  const busy = phase === 'uploading' || phase === 'processing';

  // Check the chosen video. Returns a plain-language problem, or ''.
  function check(file) {
    if (!file) return 'Choose a video file first.';
    if (!TYPES.includes(file.type)) return 'This file is not a supported video. Choose an MP4, WebM or MOV file.';
    if (file.size > LIMITS.maxVideoMB * 1024 * 1024) return `This video is larger than ${LIMITS.maxVideoMB} MB. Choose a smaller file.`;
    return '';
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const problem = check(video);
    if (problem) {
      setError(problem);
      videoRef.current.focus();
      return;
    }
    setError('');
    setPhase('uploading');
    setPercent(0);
    announce('Uploading your video. 0 percent.');
    let lastSpoken = 0;
    try {
      const lesson = await uploadLesson({ title: title.trim() || video.name, video, sign }, (p) => {
        setPercent(p);
        if (p - lastSpoken >= 25) { lastSpoken = p; announce(`Uploading. ${p} percent.`); }
      });
      setPhase('processing');
      announce('Upload finished. Making captions. This can take a few minutes.');
      const ready = await waitForReview(lesson);
      setPhase('done');
      announce('Captions are ready to review. Go to step 2.');
      onReady(ready);
    } catch (err) {
      setPhase('idle');
      setError(err.message);
      announce('Upload stopped. ' + err.message);
    }
  }

  return (
    <section aria-labelledby="upload-h" className="rounded-lg border-2 border-slate-500 p-4">
      <h2 id="upload-h" className="text-2xl font-bold">Step 1: Upload your lesson</h2>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <div>
          <label htmlFor="title" className="block text-lg font-semibold">Lesson title (optional)</label>
          <input
            id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="mt-1 min-h-11 w-full rounded border-2 border-slate-500 px-3 text-lg"
          />
        </div>

        <div>
          <label htmlFor="video" className="block text-lg font-semibold">Lesson video (MP4, WebM or MOV, up to {LIMITS.maxVideoMB} MB)</label>
          <input
            id="video" ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime"
            aria-invalid={error ? 'true' : undefined} aria-describedby="upload-error"
            onChange={(e) => setVideo(e.target.files[0] || null)}
            className="mt-1 min-h-11 w-full rounded border-2 border-slate-500 p-2 text-lg"
          />
        </div>

        <div>
          <label htmlFor="sign" className="block text-lg font-semibold">Sign language video (optional)</label>
          <input
            id="sign" type="file" accept="video/mp4,video/webm,video/quicktime"
            onChange={(e) => setSign(e.target.files[0] || null)}
            className="mt-1 min-h-11 w-full rounded border-2 border-slate-500 p-2 text-lg"
          />
        </div>

        <p id="upload-error" role="alert" className="min-h-6 text-lg font-semibold text-red-800">{error}</p>

        <button
          type="submit"
          className={`min-h-11 rounded bg-blue-800 px-6 text-lg font-semibold text-white ${busy ? 'cursor-wait opacity-70' : ''}`}
          aria-disabled={busy}
        >
          {busy ? 'Working...' : 'Upload and make captions'}
        </button>

        {phase === 'uploading' && (
          <p className="text-lg">
            <label htmlFor="bar" className="mr-2">Upload progress: {percent}%</label>
            <progress id="bar" max="100" value={percent} className="h-4 w-full" />
          </p>
        )}
        {phase === 'processing' && <p className="text-lg">Making captions. Please wait.</p>}
        {phase === 'done' && <p className="text-lg font-semibold">Done. Captions are ready to review in step 2.</p>}
      </form>
    </section>
  );
}
