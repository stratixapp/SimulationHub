/* =============================================================================
   DOT ERP — pages/theme.js
   Module 08: Theme Switcher

   Thin by design: all the real logic (persisting the choice, resolving
   "system", applying it, and the topbar quick-toggle) lives in the shared
   ../script.js so every page benefits, not just this one. This page is
   just a nicer way to choose among the same three options.
   ========================================================================== */

(function () {
  "use strict";

  const { $, $$, showToast, requireSession, runBootSequence, getThemePreference, applyTheme } = window.ERP;

  function syncSelectedCard() {
    const current = getThemePreference();
    $$(".theme-option-card").forEach((card) => {
      card.classList.toggle("is-selected", card.dataset.themeChoice === current);
    });
  }

  function bindThemeCards() {
    $$(".theme-option-card").forEach((card) => {
      card.addEventListener("click", () => {
        const choice = card.dataset.themeChoice;
        applyTheme(choice);
        syncSelectedCard();
        const label = choice.charAt(0).toUpperCase() + choice.slice(1);
        showToast(`Theme set to ${label}.`, "success");
      });
    });

    $("#resetThemeBtn").addEventListener("click", () => {
      applyTheme("system");
      syncSelectedCard();
      showToast("Theme reset to System default.", "info");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "theme")) return;

    runBootSequence([
      { p: 40, t: "Authenticating session…" },
      { p: 100, t: "Ready." }
    ]);

    syncSelectedCard();
    bindThemeCards();

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
