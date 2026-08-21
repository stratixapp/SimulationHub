/* =========================================================
   sw.js — Service worker: enables offline use & "Install App"
   ========================================================= */
const CACHE_NAME = 'oats-cache-v13';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/core.js',
  './js/storage.js',
  './js/auth.js',
  './js/employees.js',
  './js/attendance.js',
  './js/leave.js',
  './js/documents.js',
  './js/exit.js',
  './js/payroll.js',
  './js/recruitment.js',
  './js/performance.js',
  './js/assets.js',
  './js/orgchart.js',
  './js/reports.js',
  './js/sessions.js',
  './js/app.js',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
