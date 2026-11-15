import { useState } from 'react';
import { approveLanguage } from './api.js';

const LANGS = [
  { code: 'en', name: 'English', index: 0 },
  { code: 'am', name: 'Amharic', index: 1 },
];

export default function CaptionsStep({ lesson, onChange, announce }) {
  const [busy, setBusy] = useState('');
  const ready = lesson && (lesson.status === 'review' || lesson.status === 'published');

  async function approve(lang) {
    setBusy(lang.code);
    try {
      onChange(await approveLanguage(lesson, lang.code));
      announce(`${lang.name} captions approved. They will show the label Human reviewed.`);
    } catch (err) {
      announce(err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <section aria-labelledby="captions-h" className="rounded-lg border-2 border-slate-500 p-4">
      <h2 id="captions-h" className="text-2xl font-bold">Step 2: Check the captions</h2>

      {!ready ? (
        <p className="mt-3 text-lg">Upload a lesson in step 1 first. Captions will appear here when they are ready.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {LANGS.map((lang) => {
            const url = lesson.captionUrls[lang.index];
            const approved = lesson.approved[lang.code];
            return (
              <li key={lang.code} className="rounded border-2 border-slate-400 p-3">
                <h3 className="text-xl font-semibold">{lang.name} captions</h3>
                <p className="mt-1 text-lg">
                  Status: {approved ? 'Human reviewed' : 'Machine generated, not yet reviewed'}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {url && (
                    <a
                      href={`/editor/index.html?id=${encodeURIComponent(lesson.id)}&lang=${lang.code}&video=${encodeURIComponent(lesson.videoUrl || '')}&src=${encodeURIComponent(url)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded border-2 border-blue-800 px-5 text-lg font-semibold text-blue-800 underline"
                    >
                      Edit {lang.name} captions (opens in a new tab)
                    </a>
                  )}
                  <button
                    type="button" onClick={() => !approved && busy === '' && approve(lang)}
                    className={`min-h-11 rounded bg-blue-800 px-5 text-lg font-semibold text-white ${approved ? 'opacity-60' : ''}`}
                    aria-disabled={approved || busy !== ''}
                  >
                    {approved ? `${lang.name} approved` : `Approve ${lang.name} captions`}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
