// Always-fresh service worker. GitHub Pages lets browsers cache files for 10 minutes, so right
// after an update a browser could mix new modules with stale ones and fail to start. This worker
// makes every same-origin file request re-check with the server (a cheap 304 when unchanged).
// It caches nothing itself, so the game never gets stuck on an old version.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode === 'navigate' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }));
});
