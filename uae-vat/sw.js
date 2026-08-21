/* ==========================================================================
   sw.js — Service Worker for offline installability
   UAE VAT Simulator — Created By Ananthu Shaji
   ========================================================================== */

const CACHE_VERSION = "vatsim-cache-v6";

// Cross-origin CDN scripts this app depends on for optional features
// (downloadable PDFs, the offline VAT return Excel template). Allowlisted
// explicitly so the fetch handler below only ever cache-serves these
// specific known files offline — never arbitrary third-party traffic.
const CDN_SCRIPTS = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
];

const APP_SHELL = [
  "./",
  "./index.html",
  "./login.html",
  "./register.html",
  "./switch-student.html",
  "./uaepass-create.html",
  "./uaepass-login.html",
  "./emirates-id-create.html",
  "./manifest.json",
  "./favicon.ico",
  "./css/style.css",
  "./js/storage.js",
  "./js/login.js",
  "./js/register.js",
  "./js/switch-student.js",
  "./js/uaepass-create.js",
  "./js/uaepass-login.js",
  "./js/emirates-id-create.js",
  "./js/user-type.js",
  "./js/taxable-person.js",
  "./js/demo-company.js",
  "./js/dashboard.js",
  "./js/filings.js",
  "./js/liabilities.js",
  "./js/start.js",
  "./js/return.js",
  "./js/review.js",
  "./js/success.js",
  "./js/payment.js",
  "./js/correspondence.js",
  "./js/authorization.js",
  "./js/other-services.js",
  "./js/excise.js",
  "./js/voluntary-disclosure.js",
  "./js/instructor.js",
  "./js/invoice-generator.js",
  "./js/trial-balance.js",
  "./pages/user-type.html",
  "./pages/taxable-person.html",
  "./pages/demo-company.html",
  "./pages/dashboard.html",
  "./pages/filings.html",
  "./pages/liabilities.html",
  "./pages/start.html",
  "./pages/return.html",
  "./pages/review.html",
  "./pages/success.html",
  "./pages/payment.html",
  "./pages/payment-confirmation.html",
  "./pages/payments.html",
  "./pages/profile.html",
  "./pages/settings.html",
  "./pages/correspondence.html",
  "./pages/authorization.html",
  "./pages/other-services.html",
  "./pages/excise.html",
  "./pages/excise-return.html",
  "./pages/voluntary-disclosure.html",
  "./pages/instructor.html",
  "./pages/invoice-generator.html",
  "./pages/trial-balance.html",
  "./icons/icon-16.png",
  "./icons/icon-32.png",
  "./icons/icon-48.png",
  "./icons/icon-96.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        // addAll() fails atomically if even one URL 404s — cache each file
        // individually instead, so one missing/renamed file in a future
        // edit can never silently break offline support for every other
        // page. Failures are logged, never thrown.
        Promise.all(
          APP_SHELL.map((url) =>
            cache.add(url).catch((err) => console.warn("[sw] failed to precache", url, err))
          ).concat(
            // The jsPDF/XLSX CDN scripts (used for downloadable PDFs and
            // the offline VAT return template) are cross-origin and only
            // fetchable when this install step first runs online — cache
            // them here so PDF/Excel generation still works once the app
            // is installed and later opened offline. If the CDN can't be
            // reached right now, this just quietly no-ops; those buttons
            // fall back to a friendly "check your connection" toast
            // rather than breaking anything.
            CDN_SCRIPTS.map((url) =>
              fetch(url, { mode: "cors" })
                .then((res) => (res && res.ok ? cache.put(url, res) : null))
                .catch((err) => console.warn("[sw] failed to precache CDN script", url, err))
            )
          )
        )
      )
      .then(() => self.skipWaiting())
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
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Same-origin app files, plus the specific allowlisted CDN scripts
  // above, use cache-first-with-background-refresh. Everything else
  // (any other cross-origin request) goes straight to the network,
  // untouched — this service worker never intercepts traffic it doesn't
  // explicitly know about.
  const isKnownCdnScript = CDN_SCRIPTS.includes(req.url);
  if (url.origin !== self.location.origin && !isKnownCdnScript) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.status === 200 || (isKnownCdnScript && res.type === "opaque"))) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
