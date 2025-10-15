const CACHE_NAME = 'anima-cache-v3';
// Resolve asset URLs relative to the SW location to support subpath hosting
const base = new URL('./', self.location);
const url = (p) => new URL(p, base).toString();
const ASSETS = [
  url('./'),
  url('./index.html'),
  url('./assets/css/styles.css'),
  url('./assets/js/app.js'),
  url('./Images/fe48a763-a358-45a5-81bd-77c0a70330ee.webp'),
  url('./Images/icon-192.png'),
  url('./Images/icon-512.png'),
  url('./Images/logo-circular.png')
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  // Network-first for HTML, cache-first for others
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req).then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        return res;
  }).catch(() => caches.match(req).then(r => r || caches.match(url('./index.html'))))
    );
  } else {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        return res;
      }))
    );
  }
});
