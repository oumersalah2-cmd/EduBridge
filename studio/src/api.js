import { API, PLAYER } from './config.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Plain-language messages for the teacher. No codes.
function friendly(status) {
  if (status === 413) return 'This file is too large for the server. Choose a smaller video.';
  if (status === 400 || status === 415) return 'The server could not read this file. Check that it is a video (MP4, WebM or MOV).';
  return 'Something went wrong. Check your connection and try again.';
}

// Make any backend answer look like the shape the Studio expects.
function normalize(d) {
  return {
    id: d.id,
    title: d.title || '',
    status: d.status || 'processing',
    errorMessage: d.errorMessage || null,
    videoUrl: d.videoUrl || '',
    captionUrls: d.captionUrls || [],
    signUrl: d.signUrl || null,
    approved: d.approved || { en: false, am: false },
    published: d.status === 'published',
  };
}

async function request(path, options) {
  let res;
  try { res = await fetch(API.base + path, options); }
  catch { throw new Error(friendly(0)); }
  if (!res.ok) throw new Error(friendly(res.status));
  return res.json();
}

// The two lines a partner website pastes in.
export function buildEmbed(lesson) {
  const attrs = [`src="${lesson.videoUrl}"`, `captions="${lesson.captionUrls.join(',')}"`];
  if (lesson.signUrl) attrs.push(`sign="${lesson.signUrl}"`);
  attrs.push('lang="am"');
  return `<script src="${PLAYER.scriptUrl}" defer></script>\n<${PLAYER.tag} ${attrs.join(' ')}></${PLAYER.tag}>`;
}

// Send the video. onProgress gets a number from 0 to 100.
export async function uploadLesson({ title, video, sign }, onProgress) {
  if (API.mock) {
    for (let p = 0; p <= 100; p += 20) { onProgress(p); await wait(250); }
    return normalize({
      id: 'demo-1', title, status: 'processing',
      videoUrl: '/mock/lesson.mp4',
      captionUrls: ['/mock/lesson.en.vtt', '/mock/lesson.am.vtt'],
      signUrl: sign ? '/mock/lesson.ethsl.mp4' : null,
    });
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', API.base + API.upload);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(normalize(JSON.parse(xhr.responseText))); } catch { reject(new Error(friendly(0))); }
      } else reject(new Error(friendly(xhr.status)));
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
export async function waitForReview(lesson) {
  if (API.mock) { await wait(1500); return { ...lesson, status: 'review' }; }
  for (let i = 0; i < 150; i++) {
    const d = normalize(await request(API.lesson(lesson.id)));
    if (d.status === 'review' || d.status === 'published') return d;
    if (d.status === 'failed') throw new Error(d.errorMessage || 'The server could not make captions for this video.');
    await wait(2000);
  }
  throw new Error('Making captions is taking too long. Try again later.');
}

export async function approveLanguage(lesson, lang) {
  if (API.mock) { await wait(300); return { ...lesson, approved: { ...lesson.approved, [lang]: true } }; }
  await request(API.approve(lesson.id, lang), { method: 'POST' });
  return { ...lesson, approved: { ...lesson.approved, [lang]: true } };
}

export async function publishLesson(lesson) {
  if (API.mock) { await wait(300); return { ...lesson, status: 'published', published: true }; }
  const d = normalize(await request(API.publish(lesson.id), { method: 'POST' }));
  return { ...lesson, ...d, captionUrls: d.captionUrls.length ? d.captionUrls : lesson.captionUrls };
}
