import { useState } from 'react';
import UploadStep from './UploadStep.jsx';
import CaptionsStep from './CaptionsStep.jsx';
import PublishStep from './PublishStep.jsx';

export default function App() {
  const [lesson, setLesson] = useState(null);
  const [message, setMessage] = useState('');

  // One place that speaks to screen readers and shows the same text on screen.
  const announce = (text) => {
    setMessage('');
    setTimeout(() => setMessage(text), 50);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <a
        href="#main"
        className="absolute left-2 top-2 -translate-y-20 bg-blue-800 px-4 py-3 text-white focus:translate-y-0"
      >
        Skip to main content
      </a>

      <header className="mx-auto max-w-3xl px-4 pt-6">
        <h1 className="text-3xl font-bold">EduBridge Studio</h1>
        <p className="mt-2 text-lg text-slate-700">
          Upload a lesson, check its captions, then copy one line of code to put it on any website.
        </p>
      </header>

      <main id="main" className="mx-auto max-w-3xl space-y-8 px-4 py-6">
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
    </div>
  );
}
