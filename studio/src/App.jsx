import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-xl font-bold tracking-tight text-blue-900">
            EduBridge Studio
          </div>
          <nav aria-label="Main Navigation">
            <ul className="flex space-x-4 text-sm font-medium text-gray-700">
              <li>
                <a
                  href="#main-content"
                  className="px-3 py-1 rounded hover:bg-gray-100 transition-colors"
                >
                  Dashboard
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex="-1" className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 outline-none">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-4">
          EduBridge Teacher Studio
        </h1>
        <p className="text-lg text-gray-700 leading-relaxed max-w-2xl">
          Welcome to the EduBridge accessible authoring and classroom orchestrator.
          This studio allows educators to record, transcribe, translate, and publish
          learning resources accessible across low-bandwidth 3G, audio, sign language, and Braille.
        </p>
      </main>

      <footer className="border-t border-gray-200 bg-white px-6 py-6 text-center text-sm text-gray-600">
        EduBridge &mdash; Accessible Learning Media Platform (Digital Bridge Hackathon 2026)
      </footer>
    </div>
  );
}
