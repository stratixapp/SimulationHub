/* =========================================================================
   SKELORA INSTITUTE LOGISTICS SIMULATOR — SERVICE WORKER
   Caches the whole app shell so it works fully offline once installed.
   Bump CACHE_VERSION whenever any file changes, so returning users get
   the new version instead of a stale cached copy.
   ========================================================================= */

const CACHE_VERSION = "skelora-v84";
const APP_SHELL = [
  "./index.html",
  "./intro.html",
  "./login.html",
  "./skelora-institute-dashboard.html",
  "./workstation.html",
  "./engine.js",
  "./customs-forms-config.js",
  "./customs-forms.js",
  "./customs-forms-boe.js",
  "./bill-of-lading-forms-config.js",
  "./bill-of-lading-forms.js",
  "./multi-consistency.js",
  "./field-references.js",
  "./customs-forms.css",
  "./job-engine.js",
  "./documents-data.js",
  "./air-patches.js",
  "./workflow-rules.js",
  "./dot-ecosystem.js",
  "./styles.css",
  "./ship-loader.css",
  /* Boot loader (night-ship 3D scene shown by index.html before the dashboard).
     Everything it needs is vendored so it runs fully offline. */
  "./boot-loader/boot-loader.css",
  "./boot-loader/night-ship-scene.js",
  "./boot-loader/vendor/three.min.js",
  "./boot-loader/vendor/CopyShader.js",
  "./boot-loader/vendor/LuminosityHighPassShader.js",
  "./boot-loader/vendor/EffectComposer.js",
  "./boot-loader/vendor/RenderPass.js",
  "./boot-loader/vendor/ShaderPass.js",
  "./boot-loader/vendor/UnrealBloomPass.js",
  "./boot-loader/fonts/montserrat-latin-300-normal.woff2",
  "./boot-loader/fonts/montserrat-latin-500-normal.woff2",
  "./boot-loader/fonts/montserrat-latin-600-normal.woff2",
  "./boot-loader/fonts/montserrat-latin-800-normal.woff2",
  "./fonts/dancing-script-latin-600-normal.woff2",
  "./assistant.js",
  "./lyra-lock.js",
  "./lyra-knowledge.js",
  "./lyra-web.js",
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
  "../shared/vendor/chart.umd.min.js",
  "../shared/tcos-bridge.js",
  "../shared/access-id.js",
  "../shared/file-origin-guard.js"
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
      Promise.all(keys.filter((k) => /^skelora-v\d+$/.test(k) && k !== CACHE_VERSION).map((k) => caches.delete(k)))
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
  // Cross-origin requests (Lyra's optional web lookup, Google Fonts) go straight to the network.
  // Handling them here made an offline lookup "succeed" with the cached login page instead of failing cleanly.
  try { if (new URL(req.url).origin !== self.location.origin) return; } catch (e) { return; }

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
