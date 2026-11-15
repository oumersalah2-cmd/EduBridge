import { useState, useEffect } from 'react';
import { approveLanguage } from './api.js';

const LANGS = [
  { code: 'en', name: 'English', index: 0 },
  { code: 'am', name: 'Amharic', index: 1 },
  { code: 'om', name: 'Afaan Oromoo', index: 2 },
  { code: 'ti', name: 'Tigrinya', index: 3 },
];

function CaptionPreview({ url, rawText, langName }) {
  const [text, setText] = useState(rawText || '');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rawText) setText(rawText);
  }, [rawText]);

  async function handleToggle() {
    if (!open && !text && url) {
      setLoading(true);
      try {
        const res = await fetch(url);
        if (res.ok) {
          const t = await res.text();
          setText(t);
        }
      } catch (e) {}
      setLoading(false);
    }
    setOpen(!open);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex min-h-9 items-center rounded border border-slate-400 bg-slate-100 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-200"
        aria-expanded={open}
      >
        {open ? `▲ Hide ${langName} text` : `👁 View generated ${langName} text`}
      </button>
      {open && (
        <div className="mt-2 max-h-52 overflow-y-auto rounded border-2 border-slate-400 bg-slate-900 p-3 font-mono text-sm text-green-300 whitespace-pre-wrap">
          {loading ? 'Loading caption lines...' : (text || 'No caption text found.')}
        </div>
      )}
    </div>
  );
}

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
            const url = (lesson.captionUrls && (lesson.captionUrls.find((u) => u && (u.includes(`_${lang.code}.`) || u.includes(`.${lang.code}.`))) || lesson.captionUrls[lang.index])) || (lesson.id ? `/api/videos/${lesson.id}/captions/${lang.code}` : '');
            const raw = lesson.rawCaptions && lesson.rawCaptions[lang.code];
            const approved = Boolean(lesson.approved && lesson.approved[lang.code]);
            return (
              <li key={lang.code} className="rounded border-2 border-slate-400 p-3">
                <h3 className="text-xl font-semibold">{lang.name} captions</h3>
                <p className="mt-1 text-lg">
                  Status: <span className={approved ? 'font-bold text-green-800' : 'text-slate-700'}>{approved ? '✓ Human reviewed' : '⚡ Machine generated, not yet reviewed'}</span>
                </p>

                <CaptionPreview url={url} rawText={raw} langName={lang.name} />

                <div className="mt-4 flex flex-wrap gap-3">
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
                    className={`min-h-11 rounded bg-blue-800 px-5 text-lg font-semibold text-white ${approved ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-900'}`}
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
