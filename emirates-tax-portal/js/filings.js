/* ==========================================================================
   filings.js — Step 2: My Filings list
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

  function statusOf(f) {
    return VATSIM.filingStatusBadge(f).label;
  }
  function statusDotClass(f) {
    return VATSIM.filingStatusBadge(f).dotClass;
  }
  function netPosition(f) {
    const t = VATSIM.computeTotals(f.boxes);
    return t.box14;
  }

  function render() {
    const typeFilter = document.getElementById("filterType").value;
    const statusFilter = document.getElementById("filterStatus").value;
    const search = document.getElementById("searchBox").value.trim().toLowerCase();

    let filings = VATSIM.getFilings().sort((a, b) => new Date(b.period.from) - new Date(a.period.from));

    if (typeFilter) filings = filings.filter(() => typeFilter === "VAT Return");
    if (statusFilter) filings = filings.filter((f) => statusOf(f) === statusFilter);
    if (search)
      filings = filings.filter((f) => (f.referenceNumber || "").toLowerCase().includes(search) || f.id.toLowerCase().includes(search));

    const body = document.getElementById("filingsBody");
    body.innerHTML = "";
    document.getElementById("emptyState").style.display = filings.length ? "none" : "block";
    document.getElementById("pageSummary").textContent = "showing " + filings.length + " of " + VATSIM.getFilings().length + " records";

    filings.forEach((f) => {
      const s = statusOf(f);
      const dotClass = statusDotClass(f);
      const tr = document.createElement("tr");
      const netVat = f.status === "Submitted" ? VATSIM.fmtAED(netPosition(f)) : "0.00";
      const penalty = VATSIM.computeFilingPenalty(f);
      const penaltyCell = penalty.total > 0
        ? '<span style="color:var(--danger);font-weight:700" title="' +
          (penalty.isLateFiling ? "Late filing: AED " + VATSIM.fmtAED(penalty.lateFiling) + (penalty.repeat ? " (repeat)" : " (first offence)") : "") +
          (penalty.isLatePayment ? " · Late payment: AED " + VATSIM.fmtAED(penalty.latePayment) + " (" + penalty.monthsLate + " mo.)" : "") +
          '">AED ' + VATSIM.fmtAED(penalty.total) + "</span>"
        : "—";
      tr.innerHTML =
        "<td>VAT Return</td>" +
        "<td>" + (f.referenceNumber || "—") + "</td>" +
        "<td>" + VATSIM.fmtDate(f.period.from) + "</td>" +
        "<td>" + VATSIM.fmtDate(f.period.to) + "</td>" +
        '<td style="color:' + (dotClass === "overdue" ? "var(--danger)" : "inherit") + '">' + VATSIM.fmtDate(f.period.dueDate) + "</td>" +
        "<td>" + VATSIM.fmtDate(f.period.taxYearEnd) + "</td>" +
        "<td>" + (f.submittedAt ? VATSIM.fmtDate(f.submittedAt) : "—") + "</td>" +
        "<td>" + netVat + "</td>" +
        "<td>" + penaltyCell + "</td>" +
        '<td><span class="status-pill"><span class="status-dot ' + dotClass + '"></span> ' + s + "</span></td>" +
        "<td></td>";

      const actionCell = tr.lastElementChild;
      if (f.status === "Submitted" && !VATSIM.canEditFiling(f)) {
        const btn = document.createElement("button");
        btn.className = "btn btn-ghost btn-sm";
        btn.textContent = "👁 View";
        btn.addEventListener("click", () => (window.location.href = "success.html?id=" + encodeURIComponent(f.id)));
        actionCell.appendChild(btn);
        const vdBtn = document.createElement("button");
        vdBtn.className = "btn btn-outline btn-sm";
        vdBtn.style.marginLeft = "6px";
        vdBtn.textContent = "🧮 VD211";
        vdBtn.title = "File a Voluntary Disclosure to correct this return";
        vdBtn.addEventListener("click", () => (window.location.href = "voluntary-disclosure.html?id=" + encodeURIComponent(f.id)));
        actionCell.appendChild(vdBtn);
      } else if (f.status === "Submitted") {
        const btn = document.createElement("button");
        btn.className = "btn btn-outline btn-sm";
        btn.textContent = "✎ Edit";
        btn.title = "Editable until the due date";
        btn.addEventListener("click", () => (window.location.href = "return.html?id=" + encodeURIComponent(f.id)));
        actionCell.appendChild(btn);
      } else {
        const btn = document.createElement("button");
        btn.className = "btn btn-outline btn-sm";
        btn.textContent = "📝 File";
        btn.addEventListener("click", () => (window.location.href = "start.html?id=" + encodeURIComponent(f.id)));
        actionCell.appendChild(btn);
      }
      body.appendChild(tr);
    });
  }

  document.getElementById("filterType").addEventListener("change", render);
  document.getElementById("filterStatus").addEventListener("change", render);
  document.getElementById("searchBox").addEventListener("input", render);

  // "Add Next Period" — for extra practice once all seeded periods are filed.
  // Generates the next sequential quarter after the latest known period,
  // the same way a new period simply appears in EmaraTax once it opens.
  document.getElementById("btnAddPeriod").addEventListener("click", () => {
    const all = VATSIM.getFilings();
    let base;
    if (all.length) {
      base = all.reduce((latest, f) => (new Date(f.period.to) > new Date(latest.period.to) ? f : latest));
    }
    const from = base ? new Date(base.period.to) : new Date();
    from.setDate(from.getDate() + 1);
    const startMonthIdx = from.getMonth();
    const startYear = from.getFullYear();
    const periodFrom = new Date(startYear, startMonthIdx, 1);
    const periodTo = new Date(startYear, startMonthIdx + 3, 0);
    const due = new Date(periodTo.getFullYear(), periodTo.getMonth() + 1, 28);
    const taxYearEnd = new Date(periodTo.getFullYear() + (periodTo.getMonth() >= 11 ? 1 : 0), 11, 31);
    const fmt = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const period = {
      from: fmt(periodFrom), to: fmt(periodTo), dueDate: fmt(due), taxYearEnd: fmt(taxYearEnd),
      stagger: "Stagger 2 – Quarterly (Jan to Dec)",
      taxYear: String(periodFrom.getFullYear()),
      label: MONTHS[periodFrom.getMonth()] + " " + periodFrom.getFullYear() + " – " + MONTHS[periodTo.getMonth()] + " " + periodTo.getFullYear(),
    };
    const exists = all.find((f) => f.period.from === period.from && f.period.to === period.to);
    if (exists) {
      VATSIM.toast("That period already exists in your filings.", "info");
      return;
    }
    const filing = VATSIM.newFilingSkeleton(account, period);
    VATSIM.seedIntegrationFeeds(filing);
    VATSIM.upsertFiling(filing);
    VATSIM.toast("New period added: " + period.label, "success");
    render();
  });
  document.querySelectorAll("[data-static]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      VATSIM.toast("This module is outside the VAT201 training scope of this simulator.", "info");
    })
  );

  render();
  // Live-refresh while any submitted return is still within its ~60s
  // review window, so the Under Review -> Processed -> Approved badge
  // updates (including the final flip to Approved) without a reload.
  setInterval(() => {
    const stillAnimating = VATSIM.getFilings().some(
      (f) => f.status === "Submitted" && f.submittedAt && Date.now() - new Date(f.submittedAt).getTime() < 65000
    );
    if (stillAnimating) render();
  }, 2000);
})();
