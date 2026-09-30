/* =========================================================================
   SKELORA INSTITUTE LOGISTICS SIMULATOR — SERVICE WORKER
   Caches the whole app shell so it works fully offline once installed.
   Bump CACHE_VERSION whenever any file changes, so returning users get
   the new version instead of a stale cached copy.
   ========================================================================= */

const CACHE_VERSION = "skelora-v54";
const APP_SHELL = [
  "./index.html",
  "./intro.html",
  "./login.html",
  "./skelora-institute-dashboard.html",
  "./workstation.html",
  "./engine.js",
  "./job-engine.js",
  "./documents-data.js",
  "./workflow-rules.js",
  "./dot-ecosystem.js",
  "./styles.css",
  "./auth.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  /* PDF export (html2canvas + jsPDF), bulk-export (jszip) and the progress
     charts (Chart.js) used to load from cdnjs.cloudflare.com — a different
     origin, cached separately and best-effort, since a CDN fetch could fail
     independently of this app's own files. Now vendored locally under
     shared/vendor/ (same origin as everything else here), so they belong in
     the core app shell like any other file: same-origin, cached atomically,
     install fails loudly if one is missing instead of silently degrading. */
  "../shared/vendor/html2canvas.min.js",
  "../shared/vendor/jspdf.umd.min.js",
  "../shared/vendor/jszip.min.js",
  "../shared/vendor/chart.umd.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for app shell files; network-first fallback for anything else,
// so the simulator keeps working even with no connection at all.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only ever handle plain GET requests on http/https. This SW's scope can
  // still receive fetch events for chrome-extension:// requests (injected by
  // browser extensions) and other unsupported schemes — trying to read or
  // cache those throws ("Request scheme 'chrome-extension' is unsupported")
  // and that throw was surfacing as a hard page-load failure.
  if (req.method !== "GET") return;
  if (!req.url.startsWith("http://") && !req.url.startsWith("https://")) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((response) => {
          // Never try to cache an opaque, error, or redirected response.
          // A redirected Response object can't legally be used to satisfy a
          // "follow"-mode request in some browsers, and that mismatch is
          // exactly what produced the "resulted in a network error response:
          // a redirected response was used for a request whose redirect mode
          // is not follow" console errors and the ERR_FAILED page.
          if (!response || response.status !== 200 || response.type !== "basic" || response.redirected) {
            return response;
          }
          const copy = response.clone();
          caches.open(CACHE_VERSION)
            .then((cache) => cache.put(req, copy))
            .catch(() => {});
          return response;
        })
        .catch(() => caches.match("./login.html"));
    })
  );
});
