import { useRef } from 'react';
import { buildEmbed, publishLesson } from './api.js';

export default function PublishStep({ lesson, onChange, announce }) {
  const boxRef = useRef(null);
  const ready = lesson && (lesson.status === 'review' || lesson.status === 'published');
  const published = lesson && lesson.published;

  async function publish() {
    try {
      onChange(await publishLesson(lesson));
      announce('Lesson published. The embed code is below.');
    } catch (err) {
      announce(err.message);
    }
  }

  // Copy the embed code. If the browser refuses, select it so Ctrl+C works.
  async function copy() {
    try {
      await navigator.clipboard.writeText(buildEmbed(lesson));
      announce('Embed code copied.');
    } catch {
      boxRef.current.select();
      announce('Could not copy automatically. The code is selected. Press Control and C to copy it.');
    }
  }

  return (
    <section aria-labelledby="publish-h" className="rounded-lg border-2 border-slate-500 p-4">
      <h2 id="publish-h" className="text-2xl font-bold">Step 3: Publish and embed</h2>

      {!ready ? (
        <p className="mt-3 text-lg">Finish steps 1 and 2 first.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {!lesson.approved.am && (
            <p className="text-lg">
              Note: the Amharic captions are not human reviewed yet. Learners will see the label Machine generated.
            </p>
          )}
          {!published && (
            <button
              type="button" onClick={publish}
              className="min-h-11 rounded bg-blue-800 px-6 text-lg font-semibold text-white"
            >
              Publish lesson
            </button>
          )}
          {published && (
            <div>
              <label htmlFor="embed" className="block text-lg font-semibold">Embed code (paste this into any web page)</label>
              <textarea
                id="embed" ref={boxRef} readOnly rows={5} value={buildEmbed(lesson)}
                className="mt-1 w-full rounded border-2 border-slate-500 p-3 font-mono text-base"
              />
              <button
                type="button" onClick={copy}
                className="mt-3 min-h-11 rounded bg-blue-800 px-6 text-lg font-semibold text-white"
              >
                Copy embed code
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
