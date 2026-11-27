/* ==========================================================================
   demo-company.js — Read-only Demo Taxable Person view
   Created By Ananthu Shaji
   ========================================================================== */

(function () {
  "use strict";

  const session = VATSIM.requireSession("../login.html");
  if (!session) return;
  if (!VATSIM.getAccount()) {
    window.location.href = "../index.html";
    return;
  }
  VATSIM.wireChrome();

  const params = new URLSearchParams(window.location.search);
  const company = VATSIM.getDemoCompany(params.get("id"));
  if (!company) {
    VATSIM.toast("Demo company not found.", "error");
    setTimeout(() => (window.location.href = "taxable-person.html"), 900);
    return;
  }

  document.getElementById("crumbName").textContent = company.name;
  document.getElementById("companyNameOut").textContent = company.name;
  document.getElementById("dTrn").textContent = company.trn;
  document.getElementById("dActivity").textContent = company.activity + " — " + company.emirate;

  const body = document.getElementById("filingsBody");
  body.innerHTML = company.filings
    .map((f) => {
      const isOverdue = f.status === "Overdue";
      const dot = f.status === "Submitted" ? "submitted" : "overdue";
      const netLabel = f.box14 < 0 ? "AED " + VATSIM.fmtAED(Math.abs(f.box14)) + " (Refundable)" : "AED " + VATSIM.fmtAED(f.box14);
      return (
        "<tr><td>" + f.period + "</td><td" + (isOverdue ? ' style="color:var(--danger)"' : "") + ">" + VATSIM.fmtDate(f.dueDate) + "</td>" +
        '<td><span class="status-pill"><span class="status-dot ' + dot + '"></span> ' + f.status + "</td>" +
        "<td>AED " + VATSIM.fmtAED(f.box12) + "</td><td>AED " + VATSIM.fmtAED(f.box13) + "</td><td>" + netLabel + "</td></tr>"
      );
    })
    .join("");

  document.getElementById("btnGoOwn").addEventListener("click", () => {
    VATSIM.setSelectedTaxablePerson("own");
    window.location.href = "dashboard.html";
  });
})();
