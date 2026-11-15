// Settings you may need to change. Everything else reads from here.

export const LIMITS = { maxVideoMB: 200 };

// ASK MEMBER 3: the script and tag name of the player.
export const PLAYER = {
  scriptUrl: '/module/db-player.js',
  tag: 'db-player',
};

// ASK MEMBER 1 / read openapi.yaml: match these paths to the real backend.
// With no VITE_API_URL set, the Studio runs in demo (mock) mode and needs no backend.
export const API = {
  base: import.meta.env.VITE_API_URL || '',
  mock: !import.meta.env.VITE_API_URL,
  upload: '/api/v1/lessons',
  lesson: (id) => `/api/v1/lessons/${id}`,
  approve: (id, lang) => `/api/v1/lessons/${id}/approve/${lang}`,
  publish: (id) => `/api/v1/lessons/${id}/publish`,
};
