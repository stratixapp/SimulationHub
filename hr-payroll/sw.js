// SKELORA service worker — caches the whole app shell so it keeps working
// fully offline once installed (the app itself only ever reads/writes
// LocalStorage, so there is no live data to go stale by caching this).
//
// Bump CACHE_NAME (e.g. 'skelora-v2') whenever you ship changes to
// index.html / script.js / style.css / vendor files, so returning users
// get the new version instead of a stale cached copy.
const CACHE_NAME = 'skelora-v4';

const PRECACHE_URLS = [
  './',
  './index.html',
  './script.js',
  './style.css',
  './manifest.json',
  './assets/js/vendor/html2canvas.min.js',
  './assets/js/vendor/jspdf.umd.min.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      // Cache-first for anything already stored (fast + works offline);
      // otherwise fall through to the network fetch above.
      return cached || network;
    })
  );
});
