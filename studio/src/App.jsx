import { useState, useEffect } from 'react';
import UploadStep from './UploadStep.jsx';
import CaptionsStep from './CaptionsStep.jsx';
import PublishStep from './PublishStep.jsx';
import { getStudioKey, setStudioKey, listLessons } from './api.js';

export default function App() {
  const [lesson, setLesson] = useState(null);
  const [message, setMessage] = useState('');
  const [studioKey, setKey] = useState(getStudioKey());
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [recentLessons, setRecentLessons] = useState([]);

  // One place that speaks to screen readers and shows the same text on screen.
  const announce = (text) => {
    setMessage('');
    setTimeout(() => setMessage(text), 50);
  };

  useEffect(() => {
    listLessons()
      .then((items) => setRecentLessons(items))
      .catch(() => {});
  }, [lesson]);

  function handleKeyChange(e) {
    const val = e.target.value;
    setKey(val);
    setStudioKey(val);
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <a
        href="#main"
        className="absolute left-2 top-2 -translate-y-20 bg-blue-800 px-4 py-3 text-white focus:translate-y-0 z-50 rounded"
      >
        Skip to main content
      </a>

      <header className="mx-auto max-w-3xl px-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-blue-900">EduBridge Studio</h1>
            <p className="mt-2 text-lg text-slate-700">
              Upload a lesson, check its captions, then copy one line of code to put it on any website.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="min-h-11 rounded border-2 border-slate-500 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              aria-expanded={showKeyConfig}
            >
              ⚙ Teacher Key Settings
            </button>
          </div>
        </div>

        {showKeyConfig && (
          <div className="mt-4 rounded-lg border-2 border-blue-800 bg-blue-50 p-4" role="region" aria-label="Key Settings">
            <label htmlFor="studio-key" className="block text-base font-semibold text-blue-900">
              Teacher Studio Key (X-Studio-Key)
            </label>
            <p className="text-sm text-slate-600 mb-2">
              Used to authorize uploads, caption approval, and publishing.
            </p>
            <input
              id="studio-key"
              type="password"
              value={studioKey}
              onChange={handleKeyChange}
              className="min-h-11 w-full rounded border-2 border-slate-400 bg-white px-3 font-mono text-base"
              placeholder="Enter studio key"
            />
          </div>
        )}

        {recentLessons.length > 0 && (
          <div className="mt-4 rounded border border-slate-300 bg-slate-50 p-3">
            <label htmlFor="load-recent" className="block text-sm font-semibold text-slate-700 mb-1">
              Resume recent lesson:
            </label>
            <select
              id="load-recent"
              className="min-h-11 w-full rounded border border-slate-400 bg-white px-3 text-base"
              onChange={(e) => {
                const found = recentLessons.find((l) => l.id === e.target.value);
                if (found) {
                  setLesson(found);
                  announce(`Loaded lesson "${found.title}".`);
                }
              }}
              value={lesson ? lesson.id : ''}
            >
              <option value="">-- Select a lesson to review or publish --</option>
              {recentLessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <main id="main" tabIndex="-1" className="mx-auto max-w-3xl space-y-8 px-4 py-6 outline-none">
        <p
          role="status"
          aria-live="polite"
          className="min-h-12 rounded border-2 border-slate-500 bg-slate-100 px-4 py-3 text-lg"
        >
          {message}
        </p>

        <UploadStep onReady={setLesson} announce={announce} />
        <CaptionsStep lesson={lesson} onChange={setLesson} announce={announce} />
        <PublishStep lesson={lesson} onChange={setLesson} announce={announce} />
      </main>

      <footer className="mx-auto max-w-3xl px-4 py-6 text-center text-sm text-slate-600 border-t border-slate-200 mt-12">
        EduBridge &mdash; Accessible Learning Media Platform (Track 2, Digital Bridge 2026)
      </footer>
    </div>
  );
}
