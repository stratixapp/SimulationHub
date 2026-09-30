/* ==========================================================================
   sw.js — Service Worker for offline installability
   UAE VAT Simulator — Created By Ananthu Shaji
   ========================================================================== */

const CACHE_VERSION = "vatsim-cache-v9";

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
  /* jsPDF (downloadable PDFs) and xlsx (the offline VAT return Excel
     template) used to load from cdnjs.cloudflare.com — cached separately
     and best-effort, cross-origin, only fetchable if that CDN happened to
     be reachable the moment this service worker first installed. Now
     vendored locally under ../shared/vendor/ (same origin as every other
     file here), so they belong in the ordinary app shell like anything
     else: no special CORS handling, no separate best-effort branch, and
     install now fails loudly if one is missing instead of silently
     degrading a feature nobody would notice was broken until they clicked
     Download. */
  "../shared/vendor/jspdf.umd.min.js",
  "../shared/vendor/xlsx.full.min.js",
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
  /* Corporate Tax module (ct/) — precached so it works offline from the
     first visit and picks up updates when CACHE_VERSION is bumped. */
  "./ct/assets/css/emaratax.css",
  "./ct/assets/js/ct-core.js",
  "./ct/assets/js/ct-pdf.js",
  "./ct/assets/js/return.js",
  "./ct/assets/js/vendor/jspdf.umd.min.js",
  "./ct/corporate-tax.html",
  "./ct/ct-filings.html",
  "./ct/dashboard.html",
  "./ct/index.html",
  "./ct/return-instructions.html",
  "./ct/return.html",
  "./ct/submitted.html",
  "./ct/uaepass.html",
  "./ct/payment.html",
  "./ct/assets/css/ct-payment.css",
  "./ct/assets/js/ct-payment.js",
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

  // Same-origin app files only — everything here is same-origin now that
  // jsPDF/xlsx are vendored locally too, so this service worker never needs
  // to intercept cross-origin traffic at all.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
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
