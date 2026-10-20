// Storm Wings offline cache. Bump VERSION when you deploy a new build.
const VERSION = 'storm-wings-v3';
const ASSETS = ['./', './index.html', './icon.png', './icon-192.png', './icon-512.png', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve from cache instantly; refresh the cache in the background when online.
// A failed or non-game response (expired site, password page, 404) never replaces the cached game.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  const key = isPage ? './index.html' : req;

  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(key, { ignoreSearch: true });
    const update = fetch(req, { cache: 'no-store' }).then(async res => {
      if (!res || !res.ok || res.redirected || res.type !== 'basic') return null;
      if (isPage) {
        const text = await res.clone().text();
        if (text.indexOf('__game') === -1) return null; // not our game page
      }
      await cache.put(key, res.clone());
      return res;
    }).catch(() => null);

    if (cached) { e.waitUntil(update); return cached; }
    const fresh = await update;
    return fresh || new Response('Storm Wings is offline and not cached yet. Open it once while online.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }));
});
