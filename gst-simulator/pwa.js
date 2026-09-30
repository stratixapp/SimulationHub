(function () {
  "use strict";

  let deferredPrompt = null;

  function addInstallButton() {
    if (document.getElementById("pwaInstallButton")) return;

    const button = document.createElement("button");
    button.id = "pwaInstallButton";
    button.type = "button";
    button.textContent = "Install App";
    button.setAttribute("aria-label", "Install GST Simulator as an app");
    button.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:99999",
      "display:none",
      "padding:9px 14px",
      "border:1px solid #0b4f8a",
      "border-radius:3px",
      "background:#0b4f8a",
      "color:#fff",
      "font:600 13px Arial,sans-serif",
      "cursor:pointer",
      "box-shadow:0 2px 8px rgba(0,0,0,.18)"
    ].join(";");

    button.addEventListener("click", async function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) {}
      deferredPrompt = null;
      button.style.display = "none";
    });

    document.body.appendChild(button);
  }

  function isSecureAppContext() {
    return location.protocol === "https:" || location.protocol === "http:";
  }

  function registerServiceWorker() {
    if (!isSecureAppContext() || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(function () {
      // Keep the simulator fully functional even if SW registration is unavailable.
    });
  }

  function addManifestForWebApp() {
    if (!isSecureAppContext() || document.querySelector('link[rel="manifest"]')) return;
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "./manifest.webmanifest";
    document.head.appendChild(link);
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    addInstallButton();
    const button = document.getElementById("pwaInstallButton");
    if (button) button.style.display = "block";
  });

  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    const button = document.getElementById("pwaInstallButton");
    if (button) button.style.display = "none";
  });

  function boot() {
    addInstallButton();
    addManifestForWebApp();
    registerServiceWorker();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
