/* =============================================================================
   DOT ERP — assets/pwa.js
   Loaded on every page. Registers the service worker (see service-worker.js
   for what it actually caches and why), shows a small banner when a newer
   version has finished downloading in the background, and remembers the
   browser's install prompt so any page can offer an "Install app" button
   instead of waiting for the browser's own menu.
   ========================================================================== */
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  const inPages = /\/pages\//.test(location.pathname);
  const root = inPages ? "../" : "./";

  /* ---------- install prompt: captured once, offered wherever the page wants ---------- */
  window.ERP_PWA = { deferredInstallPrompt: null, canInstall: false };
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    window.ERP_PWA.deferredInstallPrompt = event;
    window.ERP_PWA.canInstall = true;
    document.dispatchEvent(new CustomEvent("erp:install-available"));
  });
  window.addEventListener("appinstalled", () => {
    window.ERP_PWA.deferredInstallPrompt = null;
    window.ERP_PWA.canInstall = false;
  });
  window.ERP_PWA.promptInstall = function () {
    const promptEvent = window.ERP_PWA.deferredInstallPrompt;
    if (!promptEvent) return Promise.resolve({ outcome: "unavailable" });
    promptEvent.prompt();
    return promptEvent.userChoice.then((choice) => {
      window.ERP_PWA.deferredInstallPrompt = null;
      window.ERP_PWA.canInstall = false;
      return choice;
    });
  };

  /* ---------- update-ready banner (plain DOM — no dependency on script.js) ---------- */
  // Set true only by the "Reload to update" click below — a controllerchange also fires
  // the first time a worker ever takes control of an already-open page, which must NOT
  // trigger a reload, only one we ourselves asked for via that click.
  let updateRequested = false;
  function showUpdateBanner(registration) {
    if (document.getElementById("erpUpdateBanner")) return;
    const bar = document.createElement("div");
    bar.id = "erpUpdateBanner";
    bar.setAttribute("role", "status");
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#0F172A;color:#fff;"
      + "padding:12px 16px;font:500 13.5px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;"
      + "display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;"
      + "box-shadow:0 -2px 12px rgba(0,0,0,.25)";
    const text = document.createElement("span");
    text.textContent = "A new version of Dot ERP is ready.";
    const reload = document.createElement("button");
    reload.type = "button";
    reload.textContent = "Reload to update";
    reload.style.cssText = "background:#2563EB;color:#fff;border:0;border-radius:8px;padding:6px 14px;"
      + "font-weight:650;cursor:pointer;font-size:13px";
    reload.addEventListener("click", () => {
      reload.disabled = true; reload.textContent = "Updating…";
      updateRequested = true;
      if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    });
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = "Later";
    dismiss.setAttribute("aria-label", "Dismiss update notice");
    dismiss.style.cssText = "background:transparent;color:#94A3B8;border:0;cursor:pointer;font-size:13px;text-decoration:underline";
    dismiss.addEventListener("click", () => bar.remove());
    bar.appendChild(text); bar.appendChild(reload); bar.appendChild(dismiss);
    (document.body || document.documentElement).appendChild(bar);
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateRequested) return;
    updateRequested = false;
    location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(root + "service-worker.js", { scope: root })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner(registration);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) showUpdateBanner(registration);
          });
        });
      })
      .catch(() => { /* offline support just won't be available this session — the app still works online */ });
  });
})();
