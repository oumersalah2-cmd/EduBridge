import { API, PLAYER } from './config.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const STUDIO_KEY_STORAGE = 'edubridge:studio_key';

export function getStudioKey() {
  try {
    const saved = localStorage.getItem(STUDIO_KEY_STORAGE);
    if (saved && saved.trim()) return saved.trim();
  } catch (e) {}
  return import.meta.env.VITE_STUDIO_KEY || 'change-me-to-a-long-random-string';
}

export function setStudioKey(key) {
  try {
    if (key) localStorage.setItem(STUDIO_KEY_STORAGE, key.trim());
    else localStorage.removeItem(STUDIO_KEY_STORAGE);
  } catch (e) {}
}

// Plain-language messages for the teacher. No codes.
function friendly(status, customMsg) {
  if (customMsg) return customMsg;
  if (status === 401) return 'Authentication required: Please configure your Teacher Studio Key.';
  if (status === 404) return 'The requested lesson or caption track was not found.';
  if (status === 409) return 'This lesson is not in review status or is not ready yet.';
  if (status === 413) return 'This file is too large for the server. Choose a smaller video (up to 200 MB).';
  if (status === 400 || status === 415) return 'The server could not read this file. Check that it is an MP4, WebM or MOV video.';
  return 'Something went wrong. Check your connection and try again.';
}

// Make any backend answer look like the shape the Studio expects.
export function normalize(d) {
  if (!d) return null;

  let captionUrls = [];
  if (Array.isArray(d.captionUrls)) {
    captionUrls = d.captionUrls;
  } else if (d.captions) {
    captionUrls = [
      d.captions.en?.url || d.captions.en?.vttUrl,
      d.captions.am?.url || d.captions.am?.vttUrl
    ].filter(Boolean);
  }

  let approved = { en: false, am: false };
  if (d.approved) {
    approved = {
      en: Boolean(d.approved.en),
      am: Boolean(d.approved.am)
    };
  } else if (d.captions) {
    approved = {
      en: d.captions.en?.reviewStatus === 'human-reviewed' || d.captions.en?.status === 'human-reviewed',
      am: d.captions.am?.reviewStatus === 'human-reviewed' || d.captions.am?.status === 'human-reviewed'
    };
  }

  return {
    id: d.id || d._id,
    title: d.title || 'Accessible Lesson',
    status: d.status || 'processing',
    progress: typeof d.progress === 'number' ? d.progress : 0,
    step: d.step || '',
    error: d.error || d.errorMessage || null,
    errorMessage: d.error || d.errorMessage || null,
    videoUrl: d.videoUrl || '',
    captionUrls,
    signUrl: d.signUrl || d.signVideoUrl || null,
    approved,
    published: d.status === 'published',
  };
}

async function request(path, options = {}) {
  const headers = {
    'Accept': 'application/json',
    'X-Studio-Key': getStudioKey(),
    ...(options.headers || {})
  };

  let res;
  try {
    res = await fetch(API.base + path, { ...options, headers });
  } catch (err) {
    throw new Error(friendly(0));
  }

  if (!res.ok) {
    let msg = '';
    try {
      const data = await res.json();
      msg = data.error || data.message || '';
    } catch (e) {}
    throw new Error(friendly(res.status, msg));
  }

  return res.json();
}

// The two lines a partner website pastes in.
export function buildEmbed(lesson) {
  const videoUrl = lesson.videoUrl || '';
  const captions = (lesson.captionUrls || []).join(',');
  const attrs = [`src="${videoUrl}"`, `captions="${captions}"`];
  if (lesson.signUrl) attrs.push(`sign="${lesson.signUrl}"`);
  attrs.push('lang="am"');
  return `<script src="${PLAYER.scriptUrl}" defer></script>\n<${PLAYER.tag} ${attrs.join(' ')}></${PLAYER.tag}>`;
}

// Send the video. onProgress gets a number from 0 to 100.
export async function uploadLesson({ title, video, sign }, onProgress) {
  if (API.mock) {
    for (let p = 0; p <= 100; p += 20) { onProgress(p); await wait(250); }
    return normalize({
      id: 'mock-vid-demo',
      title: title || 'Demo Renewable Energy Lesson',
      status: 'processing',
      videoUrl: '/assets/demo/demo_lesson_sign.mp4',
      captionUrls: ['/assets/demo/demo_lesson_en.vtt', '/assets/demo/demo_lesson_am.vtt'],
      signUrl: sign ? '/assets/demo/demo_lesson_sign.mp4' : null,
    });
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API.base + API.upload);
    xhr.setRequestHeader('X-Studio-Key', getStudioKey());

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && typeof onProgress === 'function') {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(normalize(JSON.parse(xhr.responseText)));
        } catch {
          reject(new Error(friendly(0)));
        }
      } else {
        let errText = '';
        try {
          const body = JSON.parse(xhr.responseText);
          errText = body.error;
        } catch (e) {}
        reject(new Error(friendly(xhr.status, errText)));
      }
    };

    xhr.onerror = () => reject(new Error(friendly(0)));

    const body = new FormData();
    body.append('title', title);
    body.append('video', video);
    if (sign) body.append('signVideo', sign);
    xhr.send(body);
  });
}

// Ask the server every 2 seconds until captions are ready (or it failed).
export async function waitForReview(lesson, onProgressUpdate) {
  if (API.mock) {
    await wait(1500);
    return { ...lesson, status: 'review' };
  }

  for (let i = 0; i < 150; i++) {
    const d = normalize(await request(API.lesson(lesson.id)));
    if (typeof onProgressUpdate === 'function') {
      onProgressUpdate(d);
    }
    if (d.status === 'review' || d.status === 'published') {
      try {
        const preview = normalize(await request(`/api/videos/${lesson.id}/preview`));
        return { ...d, ...preview };
      } catch (e) {
        return d;
      }
    }
    if (d.status === 'failed') throw new Error(d.errorMessage || 'The server could not make captions for this video.');
    await wait(2000);
  }
  throw new Error('Making captions is taking too long. Please check back later.');
}

// Approve caption track for a language
export async function approveLanguage(lesson, lang) {
  if (API.mock) {
    await wait(300);
    return { ...lesson, approved: { ...lesson.approved, [lang]: true } };
  }
  await request(API.approve(lesson.id, lang), { method: 'POST' });
  return { ...lesson, approved: { ...lesson.approved, [lang]: true } };
}

// Publish lesson
export async function publishLesson(lesson) {
  if (API.mock) {
    await wait(300);
    return { ...lesson, status: 'published', published: true };
  }
  const d = normalize(await request(API.publish(lesson.id), { method: 'POST' }));
  return { ...lesson, ...d, published: true, captionUrls: d.captionUrls?.length ? d.captionUrls : lesson.captionUrls };
}

// Retry failed video processing
export async function retryLesson(lesson) {
  if (API.mock) {
    await wait(500);
    return { ...lesson, status: 'processing', error: null, errorMessage: null };
  }
  const d = normalize(await request(API.retry(lesson.id), { method: 'POST' }));
  return { ...lesson, ...d };
}

// List past lessons for teacher dashboard
export async function listLessons() {
  if (API.mock) {
    return [normalize({
      id: 'mock-vid-demo',
      title: 'Accessible Renewable Energy & Photovoltaics',
      status: 'review',
      captionUrls: ['/assets/demo/demo_lesson_en.vtt', '/assets/demo/demo_lesson_am.vtt']
    })];
  }
  const list = await request(API.list);
  return Array.isArray(list) ? list.map(normalize) : [];
}
