/* =========================================================================
   DOT ECOSYSTEM HUB — SERVICE WORKER
   Caches only the hub's own shell (this launcher page, its manifest, and
   its icons) so the portal itself opens offline/installed. Each
   simulator folder (emirates-tax-portal/, logistics-simulator/, etc.) ships its own
   service worker scoped to its own directory — a more specific scope
   always wins over this one, so this file deliberately does NOT try to
   cache or intercept anything under those subfolders. Any request this
   worker doesn't recognise as part of its own shell is passed straight
   through to the network, exactly as if no service worker were present.
   Bump CACHE_VERSION whenever a shell file changes so returning users
   get the new version instead of a stale cached copy.
   ========================================================================= */

const CACHE_VERSION = "dot-ecosystem-hub-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon.ico",
  "./favicon-192.png",
  "./favicon-512.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests for files at the hub root
  // (no extra path segments). Anything with a subpath — e.g.
  // /emirates-tax-portal/..., /logistics-simulator/... — is left completely alone
  // so each simulator's own service worker (or the network) handles it.
  const isSameOrigin = url.origin === self.location.origin;
  const pathAfterScope = url.pathname.replace(self.registration.scope.replace(url.origin, ""), "");
  const isRootLevelFile = isSameOrigin && !pathAfterScope.includes("/");

  if (event.request.method !== "GET" || !isRootLevelFile) {
    return; // not our concern — default browser behaviour applies
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached || caches.match("./index.html"));
      return cached || network;
    })
  );
});
