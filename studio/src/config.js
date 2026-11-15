// Settings you may need to change. Everything else reads from here.

export const LIMITS = { maxVideoMB: 200 };

// Member 3 embed script and tag
export const PLAYER = {
  scriptUrl: '/module/db-player.js',
  tag: 'db-player',
};

// API routes matching backend contracts (both /api/videos and /api/v1/lessons).
// In development or Docker same-origin, VITE_API_URL is typically empty, using relative paths.
// Set VITE_MOCK_API="true" only if you want offline demo mode without backend.
export const API = {
  base: import.meta.env.VITE_API_URL || '',
  mock: import.meta.env.VITE_MOCK_API === 'true',
  upload: '/api/videos',
  lesson: (id) => `/api/videos/${id}`,
  approve: (id, lang) => `/api/videos/${id}/approve/${lang}`,
  publish: (id) => `/api/videos/${id}/publish`,
  retry: (id) => `/api/videos/${id}/retry`,
  captions: (id, lang) => `/api/videos/${id}/captions/${lang}`,
  list: '/api/videos',
};
