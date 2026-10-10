/* =============================================================================
   DOT ERP — pages/gstr3b.js
   Phase 16, Module 02: GSTR-3B

   Same (year, month) period picker as GSTR-1, the same Payroll-derived
   convention. The one new UI idea this page needs that GSTR-1 didn't:
   surfacing WHERE the output figure came from (a filed GSTR-1 or a
   live, still-changing one) and HOW MUCH of the input tax credit rests
   on an estimate rather than a captured fact — both are named directly
   in the summary, not left for the trainee to infer.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openConfirm, requireSession, runBootSequence,
    logSystemActivity, actorLabel
  } = window.ERP;

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  let session = null;
  let company = null;
  let selectedYear = null;
  let selectedMonth = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function periodLabel(year, month) { return `${MONTH_NAMES[month - 1]} ${year}`; }


  /* -----------------------------------------------------------------------
     PERIOD PICKER — identical convention to GSTR-1 and Payroll
     --------------------------------------------------------------------- */
  function populatePeriodSelects() {
    $("#g3MonthSelect").innerHTML = MONTH_NAMES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [];
    for (let y = currentYear - 2; y <= currentYear + 1; y++) years.push(y);
    $("#g3YearSelect").innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
    selectedMonth = now.getMonth() + 1;
    selectedYear = currentYear;
    $("#g3MonthSelect").value = String(selectedMonth);
    $("#g3YearSelect").value = String(selectedYear);
  }

  function bindPeriodPicker() {
    $("#g3MonthSelect").addEventListener("change", () => { selectedMonth = Number($("#g3MonthSelect").value); renderPeriod(); });
    $("#g3YearSelect").addEventListener("change", () => { selectedYear = Number($("#g3YearSelect").value); renderPeriod(); });
  }


  /* -----------------------------------------------------------------------
     STATUS BANNER
     --------------------------------------------------------------------- */
  function renderStatusBanner(filing, summary) {
    const banner = $("#g3StatusBanner");
    const fileBtn = $("#g3FileBtn");
    if (filing) {
      banner.className = "profile-card gstr1-banner gstr1-banner--filed";
      banner.innerHTML = `
        <div class="gstr1-banner__row">
          <span class="status-badge status-badge--success">Filed</span>
          <div>
            <p class="gstr1-banner__title">${escapeHtml(periodLabel(filing.periodYear, filing.periodMonth))} was filed ${formatDateTime(new Date(filing.filedAt))} by ${escapeHtml(actorLabel(filing.filedByUsername))}.</p>
            <p class="profile-subtle">The figures below are the frozen totals reported at filing time.</p>
          </div>
        </div>`;
      fileBtn.hidden = true;
    } else {
      banner.className = "profile-card gstr1-banner gstr1-banner--draft";
      banner.innerHTML = `
        <div class="gstr1-banner__row">
          <span class="status-badge status-badge--warning">Not Filed</span>
          <div>
            <p class="gstr1-banner__title">${escapeHtml(periodLabel(selectedYear, selectedMonth))} is unfiled — the figures below are live.</p>
          </div>
        </div>`;
      fileBtn.hidden = false;
      fileBtn.disabled = summary.itcLineCount === 0 && summary.outputTax === 0;
    }
  }

  /** The one thing GSTR-1's own banner never needed to say: WHERE the
      output-side number came from. A live, unfiled GSTR-1 for this
      period is a real fact worth surfacing before someone files 3B
      against a number that might still change. */
  function renderOutputSourceNote(summary) {
    const el = $("#g3OutputSourceNote");
    if (summary.outputSource === "filed") {
      el.textContent = `Output tax is taken from this period's own filed GSTR-1.`;
      el.className = "field-hint";
    } else {
      el.textContent = `GSTR-1 for ${periodLabel(selectedYear, selectedMonth)} hasn't been filed yet — output tax below is live and may still change. File GSTR-1 first for a settled figure.`;
      el.className = "field-error";
    }
  }


  /* -----------------------------------------------------------------------
     SUMMARY RENDER
     --------------------------------------------------------------------- */
  function renderSummary(summary) {
    $("#g3OutputTaxable").textContent = formatMoney(summary.outputTaxableValue);
    $("#g3OutputCgst").textContent = formatMoney(summary.outputCgst);
    $("#g3OutputSgst").textContent = formatMoney(summary.outputSgst);
    $("#g3OutputIgst").textContent = formatMoney(summary.outputIgst);
    $("#g3OutputTax").textContent = formatMoney(summary.outputTax);

    $("#g3ItcCgst").textContent = formatMoney(summary.grossItcCgst);
    $("#g3ItcSgst").textContent = formatMoney(summary.grossItcSgst);
    $("#g3ItcIgst").textContent = formatMoney(summary.grossItcIgst);
    $("#g3ItcGross").textContent = formatMoney(summary.grossItcTax);
    $("#g3ItcLineCount").textContent = String(summary.itcLineCount);

    const estBadge = $("#g3ItcEstimatedNote");
    if (summary.itcLineCount === 0) {
      estBadge.textContent = "No purchases recorded this period.";
      estBadge.className = "field-hint";
    } else if (summary.itcPctEstimated === 0) {
      estBadge.textContent = "Every line this period carries a real captured tax rate — nothing here is estimated.";
      estBadge.className = "field-hint";
    } else {
      estBadge.textContent = `${summary.itcPctEstimated}% of this period's input tax is an estimate (no tax captured on the vendor's own bill), not a captured fact — see Purchase Register for the line-by-line breakdown.`;
      estBadge.className = "field-error";
    }

    $("#g3ItcReversedCgst").textContent = formatMoney(summary.itcReversedCgst);
    $("#g3ItcReversedSgst").textContent = formatMoney(summary.itcReversedSgst);
    $("#g3ItcReversedIgst").textContent = formatMoney(summary.itcReversedIgst);
    $("#g3ItcReversed").textContent = formatMoney(summary.itcReversedTax);
    $("#g3ItcReversedNote").textContent = summary.itcReversedNoteCount
      ? `${summary.itcReversedNoteCount} debit note(s) issued this period reversed this credit.`
      : "No debit notes issued this period.";

    $("#g3NetItcCgst").textContent = formatMoney(summary.netItcCgst);
    $("#g3NetItcSgst").textContent = formatMoney(summary.netItcSgst);
    $("#g3NetItcIgst").textContent = formatMoney(summary.netItcIgst);
    $("#g3NetItc").textContent = formatMoney(summary.netItcTax);

    const payableEl = $("#g3NetPayable");
    payableEl.textContent = formatMoney(Math.abs(summary.netTaxPayable));
    const noteEl = $("#g3NetPayableNote");
    if (summary.netTaxPayable > 0) {
      payableEl.className = "kpi-card__value";
      noteEl.textContent = "Net tax payable this period.";
    } else if (summary.netTaxPayable < 0) {
      payableEl.className = "kpi-card__value";
      noteEl.textContent = "Input tax credit exceeds output liability this period — a net credit, not an error. This project has no running electronic credit ledger, so this excess is not automatically carried into next period's own calculation.";
    } else {
      noteEl.textContent = "Output tax and input tax credit exactly offset this period.";
    }

    $("#g3PayableCgst").textContent = formatMoney(summary.netPayableCgst);
    $("#g3PayableSgst").textContent = formatMoney(summary.netPayableSgst);
    $("#g3PayableIgst").textContent = formatMoney(summary.netPayableIgst);
  }


  /* -----------------------------------------------------------------------
     FILING HISTORY
     --------------------------------------------------------------------- */
  function renderFilingHistory() {
    const filings = ERP_Gstr3bRepository.getFilingsForCompany(company.id);
    $("#g3HistoryEmpty").hidden = filings.length !== 0;
    $("#g3HistoryList").innerHTML = filings.map((f) => `
      <li class="activity-item">
        <span class="activity-item__icon">
          <svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/></svg>
        </span>
        <div>
          <p class="activity-item__text">${escapeHtml(periodLabel(f.periodYear, f.periodMonth))} — net ${f.netTaxPayable >= 0 ? "payable" : "credit"} ${formatMoney(Math.abs(f.netTaxPayable))}</p>
          <p class="activity-item__time">Filed ${formatDateTime(new Date(f.filedAt))} by ${escapeHtml(actorLabel(f.filedByUsername))}</p>
        </div>
      </li>
    `).join("");
  }


  /* -----------------------------------------------------------------------
     EXPORT
     --------------------------------------------------------------------- */
  function exportCsv(summary) {
    const lines = [`GSTR-3B — ${periodLabel(selectedYear, selectedMonth)} — ${company.name}`, ""];
    lines.push("Section,CGST,SGST,IGST,Total");
    lines.push(["3.1 Output Tax Liability", summary.outputCgst, summary.outputSgst, summary.outputIgst, summary.outputTax].map((v) => typeof v === "number" ? v.toFixed(2) : v).join(","));
    lines.push(["4(A) ITC Available (Gross)", summary.grossItcCgst, summary.grossItcSgst, summary.grossItcIgst, summary.grossItcTax].map((v) => typeof v === "number" ? v.toFixed(2) : v).join(","));
    lines.push(["4(B) ITC Reversed", summary.itcReversedCgst, summary.itcReversedSgst, summary.itcReversedIgst, summary.itcReversedTax].map((v) => typeof v === "number" ? v.toFixed(2) : v).join(","));
    lines.push(["4(C) Net ITC Available", summary.netItcCgst, summary.netItcSgst, summary.netItcIgst, summary.netItcTax].map((v) => typeof v === "number" ? v.toFixed(2) : v).join(","));
    lines.push(["6.1 Net Tax Payable", summary.netPayableCgst, summary.netPayableSgst, summary.netPayableIgst, summary.netTaxPayable].map((v) => typeof v === "number" ? v.toFixed(2) : v).join(","));
    lines.push("");
    lines.push(`Output source: ${summary.outputSource === "filed" ? "This period's filed GSTR-1" : "Live, unfiled GSTR-1"}`);
    lines.push(`Input tax estimated: ${summary.itcPctEstimated}% of gross ITC`);

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `gstr3b-${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${company.companyCode}.csv`;
    link.click();
  }


  /* -----------------------------------------------------------------------
     FILE ACTION
     --------------------------------------------------------------------- */
  function requestFile() {
    const summary = ERP_Gstr3bRepository.computeSummary(company.id, selectedYear, selectedMonth);
    const payableLine = summary.netTaxPayable >= 0
      ? `net tax payable ${formatMoney(summary.netTaxPayable)}`
      : `a net credit of ${formatMoney(Math.abs(summary.netTaxPayable))} (input tax credit exceeds output liability)`;
    const sourceLine = summary.outputSource === "filed"
      ? "using this period's own filed GSTR-1 figures"
      : "using LIVE, still-unfiled GSTR-1 figures — consider filing GSTR-1 first for a settled number";
    openConfirm({
      title: `File GSTR-3B for ${periodLabel(selectedYear, selectedMonth)}?`,
      message: `This freezes today's figures as the reported return, ${sourceLine}: ${payableLine}. A filed period can't be filed again through this page, and this project has no running credit ledger — a net credit here is not automatically carried into next period's own calculation.`,
      confirmLabel: "File This Return",
      onConfirm: () => {
        const result = ERP_Gstr3bRepository.file(company, selectedYear, selectedMonth, session.username);
        if (!result.success) { showToast(result.reason, "danger"); return; }
        logSystemActivity({ module: "GSTR-3B", action: "File", description: `Filed GSTR-3B for ${periodLabel(selectedYear, selectedMonth)} — ${payableLine} (${company.name})` });
        showToast(`GSTR-3B filed for ${periodLabel(selectedYear, selectedMonth)}.`, "success");
        renderPeriod();
        renderFilingHistory();
      }
    });
  }


  /* -----------------------------------------------------------------------
     RENDER ORCHESTRATION
     --------------------------------------------------------------------- */
  function renderPeriod() {
    const filing = ERP_Gstr3bRepository.findFiling(company.id, selectedYear, selectedMonth);
    const summary = filing || ERP_Gstr3bRepository.computeSummary(company.id, selectedYear, selectedMonth);
    renderStatusBanner(filing, ERP_Gstr3bRepository.computeSummary(company.id, selectedYear, selectedMonth));
    if (!filing) renderOutputSourceNote(summary);
    else { $("#g3OutputSourceNote").textContent = ""; }
    renderSummary(summary);
    $("#g3ExportCsvBtn").onclick = () => exportCsv(summary);
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "gstr3b")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Computing tax position…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#g3Content").hidden = true;
      $("#g3Subtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#g3Content").hidden = false;
      $("#g3HeaderActions").hidden = false;
      $("#g3Subtitle").textContent = `Summary return for ${company.name} (${company.companyCode}).`;
      populatePeriodSelects();
      bindPeriodPicker();
      $("#g3FileBtn").addEventListener("click", requestFile);
      $("#g3PrintBtn").addEventListener("click", () => window.print());
      renderPeriod();
      renderFilingHistory();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
