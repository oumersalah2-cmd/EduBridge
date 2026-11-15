import { useRef } from 'react';
import { buildEmbed, publishLesson } from './api.js';

export default function PublishStep({ lesson, onChange, announce }) {
  const boxRef = useRef(null);
  const linkRef = useRef(null);
  const ready = lesson && (lesson.status === 'review' || lesson.status === 'published');
  const published = lesson && lesson.published;

  const origin = window.location.hostname || 'localhost';
  const studentLink = `${window.location.protocol}//${origin}:8000/player/index.html?video=${encodeURIComponent(lesson?.id || '')}`;
  const offlinePackUrl = `/api/public/videos/${lesson?.id || ''}/offlinepack`;

  async function publish() {
    try {
      onChange(await publishLesson(lesson));
      announce('Lesson published. The student link and embed code are below.');
    } catch (err) {
      announce(err.message);
    }
  }

  // Copy direct student link
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(studentLink);
      announce('Direct student link copied to clipboard.');
    } catch {
      linkRef.current?.select();
      announce('Link selected. Press Control and C to copy it.');
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
      <h2 id="publish-h" className="text-2xl font-bold">Step 3: Publish and share</h2>

      {!ready ? (
        <p className="mt-3 text-lg">Finish steps 1 and 2 first.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {!lesson.approved?.am && (
            <p className="text-lg">
              Note: the Amharic captions are not human reviewed yet. Learners will see the label Machine generated.
            </p>
          )}
          {!published && (
            <button
              type="button" onClick={publish}
              className="min-h-11 rounded bg-blue-800 px-6 text-lg font-semibold text-white hover:bg-blue-900"
            >
              Publish lesson
            </button>
          )}
          {published && (
            <div className="space-y-6">
              <div className="rounded border-2 border-green-600 bg-green-50 p-4">
                <h3 className="text-xl font-bold text-green-900">✓ Lesson Published Successfully!</h3>
                <p className="mt-1 text-slate-700">
                  Your accessible lesson is now live. Share the direct link with students, download the offline pack, or embed it into your school LMS.
                </p>
              </div>

              {/* 1. Direct Shareable Link for Students */}
              <div className="rounded border border-slate-300 bg-white p-4">
                <label htmlFor="student-link" className="block text-lg font-bold text-slate-800">
                  🔗 Direct Student Link (Share on Telegram, WhatsApp, or SMS)
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    id="student-link"
                    ref={linkRef}
                    type="text"
                    readOnly
                    value={studentLink}
                    className="min-h-11 flex-1 rounded border-2 border-slate-400 px-3 font-mono text-base text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="min-h-11 rounded bg-blue-800 px-5 text-base font-semibold text-white hover:bg-blue-900"
                  >
                    Copy Link
                  </button>
                  <a
                    href={studentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center rounded border-2 border-blue-800 bg-white px-5 text-base font-semibold text-blue-800 hover:bg-blue-50"
                  >
                    ▶ Open Player in New Tab
                  </a>
                </div>
              </div>

              {/* 2. 3G Offline Package */}
              <div className="rounded border border-slate-300 bg-white p-4">
                <h3 className="text-lg font-bold text-slate-800">
                  📦 3G Offline Pack (.ZIP)
                </h3>
                <p className="mt-1 text-slate-600">
                  Contains zero-dependency offline HTML player, compressed 64k audio, full text transcript, and Braille (.brf) file. Ideal for flash drives or Bluetooth sharing in areas with poor internet.
                </p>
                <div className="mt-3">
                  <a
                    href={offlinePackUrl}
                    download
                    className="inline-flex min-h-11 items-center rounded bg-emerald-700 px-5 text-base font-semibold text-white hover:bg-emerald-800"
                  >
                    ⬇ Download 3G Offline Pack (.ZIP)
                  </a>
                </div>
              </div>

              {/* 3. Embed Code for LMS / Websites */}
              <div className="rounded border border-slate-300 bg-white p-4">
                <label htmlFor="embed" className="block text-lg font-bold text-slate-800">
                  💻 Embed Code (For ALX Savanna, Moodle, Canvas, or website)
                </label>
                <textarea
                  id="embed"
                  ref={boxRef}
                  readOnly
                  rows={4}
                  value={buildEmbed(lesson)}
                  className="mt-2 w-full rounded border-2 border-slate-400 p-3 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={copy}
                  className="mt-3 min-h-11 rounded bg-slate-800 px-5 text-base font-semibold text-white hover:bg-slate-900"
                >
                  Copy Embed Code
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
