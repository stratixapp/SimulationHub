const CACHE_NAME = "gst-simulator-pwa-v11-github";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./gst-pdf.js",
  "./vendor/jspdf.umd.min.js",
  "./nav-back.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./icons/favicon-16x16.png",
  "./icons/favicon-32x32.png",
  "./icons/favicon-48x48.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => /^gst-simulator-pwa-/.test(key) && key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const reqUrl = new URL(request.url);
  /* Pages, scripts and styles: ask the network first (so a new version is used on the very first load after
     an update) and fall back to the cached copy when offline or slower than 3 seconds. */
  if (reqUrl.origin === self.location.origin && (request.mode === "navigate" || /\.(?:html|js|css)$/.test(reqUrl.pathname))) {
    event.respondWith(new Promise(resolve => {
      let done = false;
      const finish = r => { if (!done && r) { done = true; resolve(r); } };
      const timer = setTimeout(() => { caches.match(request).then(finish); }, 3000);
      fetch(request).then(response => {
        clearTimeout(timer);
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        finish(response);
      }).catch(() => {
        clearTimeout(timer);
        caches.match(request).then(c => finish(c || caches.match("./index.html")));
      });
    }));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
