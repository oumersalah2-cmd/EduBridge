/**
 * Helper to build consistent absolute URLs across all endpoints
 * based on process.env.PUBLIC_BASE_URL (or request host fallback).
 */

function getPublicBaseUrl(req) {
  let base = process.env.PUBLIC_BASE_URL;
  if (!base && req) {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:4000';
    base = `${proto}://${host}`;
  }
  base = base || 'http://localhost:4000';
  return base.replace(/\/+$/, '');
}

function toAbsoluteUrl(pathOrUrl, req) {
  if (!pathOrUrl) return pathOrUrl;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  const base = getPublicBaseUrl(req);
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${cleanPath}`;
}

module.exports = {
  getPublicBaseUrl,
  toAbsoluteUrl
};
