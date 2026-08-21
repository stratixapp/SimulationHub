/* ==========================================================================
   dashboard.js — Step 2: Home / Dashboard
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
  document.querySelector("[data-first-name]").textContent = account.firstNameEn;

  /* ---------------- Summary tiles: most recent draft ---------------- */
  const filings = VATSIM.getFilings();
  const drafts = filings.filter((f) => f.status === "Draft").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (drafts.length) {
    const f = drafts[0];
    document.getElementById("currentPeriod").textContent = f.period.from + " – " + f.period.to;
    document.getElementById("currentDue").textContent = VATSIM.fmtDate(f.period.dueDate);
    document.getElementById("currentStatus").innerHTML =
      '<span class="status-pill"><span class="status-dot draft"></span> Draft in progress</span>';
  }

  /* ---------------- Outstanding VAT liability ---------------- */
  const unpaidPayable = filings
    .filter((f) => f.status === "Submitted")
    .reduce((sum, f) => {
      const t = VATSIM.computeTotals(f.boxes);
      const isPaid = f.payment && f.payment.status === "Paid";
      return sum + (!isPaid && t.box14 > 0 ? t.box14 : 0);
    }, 0);
  document.getElementById("outstandingLiability").textContent = "AED " + VATSIM.fmtAED(unpaidPayable) + " outstanding";
  if (unpaidPayable > 0) document.getElementById("outstandingLiability").style.color = "var(--danger)";

  /* ---------------- Recent Returns (last 3) ---------------- */
  const recentBody = document.getElementById("recentReturnsBody");
  const recent = filings.slice().sort((a, b) => new Date(b.period.from) - new Date(a.period.from)).slice(0, 3);
  function renderRecent() {
    recentBody.innerHTML = recent.length
      ? recent
          .map((f) => {
            const badge = VATSIM.filingStatusBadge(f);
            const t = VATSIM.computeTotals(f.boxes);
            const net = f.status === "Submitted" ? "AED " + VATSIM.fmtAED(Math.abs(t.box14)) + (t.isRefund ? " (Refundable)" : "") : "—";
            return (
              "<tr><td>" + f.period.label + "</td><td" + (badge.dotClass === "overdue" ? ' style="color:var(--danger)"' : "") + ">" + VATSIM.fmtDate(f.period.dueDate) + "</td>" +
              '<td><span class="status-pill"><span class="status-dot ' + badge.dotClass + '"></span> ' + badge.label + "</td><td>" + net + "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="4" style="text-align:center;color:var(--text-faint);padding:20px">No tax periods yet.</td></tr>';
  }
  renderRecent();
  // Live-refresh in case any of these three are still moving through
  // Under Review -> Processed -> Approved while this page stays open.
  if (recent.some((f) => f.status === "Submitted")) setInterval(renderRecent, 2000);

  /* ---------------- New return flow ----------------
     Matches the real EmaraTax flow: filing periods are already generated
     for the taxable person (at signup, mirroring FTA's own period
     generation) and listed under VAT > My Filings — there is no
     "create a period" step on Home. Both entry points go straight there. */
  document.getElementById("btnNewReturn").addEventListener("click", () => (window.location.href = "filings.html"));
  document.getElementById("cardNewReturn").addEventListener("click", () => (window.location.href = "filings.html"));

  /* ---------------- Penalty summary banner ---------------- */
  const penaltySummary = VATSIM.accountTotalPenalties();
  if (penaltySummary.total > 0) {
    document.getElementById("penaltyBanner").style.display = "flex";
    document.getElementById("penaltyBannerText").innerHTML =
      "You have an estimated <strong>AED " + VATSIM.fmtAED(penaltySummary.total) + "</strong> in FTA penalties across " +
      penaltySummary.count + " return(s) — late filing and/or late payment. " +
      '<a href="filings.html" style="color:inherit;text-decoration:underline">View breakdown in My Filings →</a>';
  }

  document.querySelectorAll("[data-static]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      VATSIM.toast("This module is outside the VAT201 training scope of this simulator.", "info");
    });
  });
})();
