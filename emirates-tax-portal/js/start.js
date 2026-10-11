/* ==========================================================================
   start.js — Step 3: Service Details / instructions gate
   Created By Ananthu Shaji
   ========================================================================== */

(function () {
  "use strict";

  const session = VATSIM.requireSession("../login.html");
  if (!session) return;
  const account = VATSIM.getAccount();
  if (!account) {
    window.location.href = "../index.html";
    return;
  }
  VATSIM.wireChrome();

  const params = new URLSearchParams(window.location.search);
  const filingId = params.get("id");
  const filing = filingId && VATSIM.getFiling(filingId);
  if (!filing) {
    VATSIM.toast("Filing not found — please start again from My Filings.", "error");
    setTimeout(() => (window.location.href = "filings.html"), 900);
    return;
  }

  // Accordion
  document.querySelectorAll(".review-section-header").forEach((h) => {
    h.addEventListener("click", () => {
      h.classList.toggle("open");
      h.nextElementSibling.classList.toggle("open");
    });
  });

  document.getElementById("linkTutorial").addEventListener("click", (e) => {
    e.preventDefault();
    VATSIM.toast("Video tutorial is illustrative only in this offline simulator.", "info");
  });
  document.getElementById("linkManual").addEventListener("click", (e) => {
    e.preventDefault();
    VATSIM.toast("User manual is illustrative only in this offline simulator.", "info");
  });

  const checkbox = document.getElementById("confirmInstructions");
  const startBtn = document.getElementById("btnStart");
  checkbox.addEventListener("change", () => {
    startBtn.disabled = !checkbox.checked;
  });

  startBtn.addEventListener("click", () => {
    if (!checkbox.checked) return;
    VATSIM.showLoading("Loading VAT 201 Return…", 600).then(() => {
      window.location.href = "return.html?id=" + encodeURIComponent(filing.id);
    });
  });
})();
