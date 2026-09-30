/* =============================================================================
   DOT ERP — pages/gstr1.js
   Phase 16, Module 01: GSTR-1

   Period picker follows Payroll's own established (year, month) select
   pair exactly — same MONTH_NAMES array, same populate function shape,
   same currentYear-2..+1 window — because this is the same kind of
   period a calendar-month return needs, not a from/to date range the
   way GST Summary (an internal reconciliation, not a filing) uses.
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
  let activeTab = "b2b";

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function periodLabel(year, month) { return `${MONTH_NAMES[month - 1]} ${year}`; }


  /* -----------------------------------------------------------------------
     PERIOD PICKER — Payroll's own convention, unchanged
     --------------------------------------------------------------------- */
  function populatePeriodSelects() {
    $("#g1MonthSelect").innerHTML = MONTH_NAMES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [];
    for (let y = currentYear - 2; y <= currentYear + 1; y++) years.push(y);
    $("#g1YearSelect").innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
    selectedMonth = now.getMonth() + 1;
    selectedYear = currentYear;
    $("#g1MonthSelect").value = String(selectedMonth);
    $("#g1YearSelect").value = String(selectedYear);
  }

  function bindPeriodPicker() {
    $("#g1MonthSelect").addEventListener("change", () => { selectedMonth = Number($("#g1MonthSelect").value); renderPeriod(); });
    $("#g1YearSelect").addEventListener("change", () => { selectedYear = Number($("#g1YearSelect").value); renderPeriod(); });
  }


  /* -----------------------------------------------------------------------
     FILED BANNER vs LIVE TOTALS
     --------------------------------------------------------------------- */
  function renderStatusBanner(filing, totals) {
    const banner = $("#g1StatusBanner");
    const fileBtn = $("#g1FileBtn");
    if (filing) {
      banner.className = "profile-card gstr1-banner gstr1-banner--filed";
      banner.innerHTML = `
        <div class="gstr1-banner__row">
          <span class="status-badge status-badge--success">Filed</span>
          <div>
            <p class="gstr1-banner__title">${escapeHtml(periodLabel(filing.periodYear, filing.periodMonth))} was filed ${formatDateTime(new Date(filing.filedAt))} by ${escapeHtml(actorLabel(filing.filedByUsername))}.</p>
            <p class="profile-subtle">The figures below are the frozen totals reported at filing time — they won't change even if later transactions land in this period.</p>
          </div>
        </div>`;
      fileBtn.hidden = true;
    } else {
      banner.className = "profile-card gstr1-banner gstr1-banner--draft";
      banner.innerHTML = `
        <div class="gstr1-banner__row">
          <span class="status-badge status-badge--warning">Not Filed</span>
          <div>
            <p class="gstr1-banner__title">${escapeHtml(periodLabel(selectedYear, selectedMonth))} is unfiled — the figures below are live and will keep changing as more transactions land in this period.</p>
          </div>
        </div>`;
      fileBtn.hidden = false;
      fileBtn.disabled = totals.b2bInvoiceCount === 0 && totals.b2cRowCount === 0 && totals.creditNoteCount === 0;
    }
  }

  function renderTotals(totals) {
    $("#g1TaxableValue").textContent = formatMoney(totals.netTaxableValue);
    $("#g1TotalTax").textContent = formatMoney(totals.netTax);
    $("#g1Cgst").textContent = formatMoney(totals.netCgst);
    $("#g1Sgst").textContent = formatMoney(totals.netSgst);
    $("#g1Igst").textContent = formatMoney(totals.netIgst);
    $("#g1InvoiceCount").textContent = String(totals.b2bInvoiceCount);
    $("#g1B2cCount").textContent = String(totals.b2cRowCount);
    $("#g1CreditNoteCount").textContent = String(totals.creditNoteCount);
    $("#g1GrossVsNet").textContent = totals.creditNoteCount
      ? `Gross ${formatMoney(totals.grossTaxableValue)} taxable, ${formatMoney(totals.grossTax)} tax — less ${formatMoney(totals.creditNoteTaxableValue)} taxable / ${formatMoney(totals.creditNoteTax)} tax from ${totals.creditNoteCount} credit note(s) issued this period.`
      : "No credit notes issued this period — net equals gross.";
  }


  /* -----------------------------------------------------------------------
     TABLES
     --------------------------------------------------------------------- */
  function renderB2B() {
    const rows = ERP_Gstr1Repository.getB2BRows(company.id, selectedYear, selectedMonth);
    $("#g1B2bEmpty").hidden = rows.length !== 0;
    $("#g1B2bTable").hidden = rows.length === 0;
    $("#g1B2bBody").innerHTML = rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.invoiceCode)}</td>
        <td>${r.invoiceDate || "—"}</td>
        <td>${escapeHtml(r.customerName)}</td>
        <td><code>${escapeHtml(r.customerGstin || "—")}</code></td>
        <td class="text-right">${formatMoney(r.invoiceValue)}</td>
        <td class="text-right">${r.ratePct}%</td>
        <td class="text-right">${formatMoney(r.taxableValue)}</td>
        <td class="text-right">${r.isInterState ? formatMoney(r.igstAmount) : "—"}</td>
        <td class="text-right">${r.isInterState ? "—" : formatMoney(r.cgstAmount)}</td>
        <td class="text-right">${r.isInterState ? "—" : formatMoney(r.sgstAmount)}</td>
      </tr>`).join("");
  }

  function renderB2C() {
    const rows = ERP_Gstr1Repository.getB2CSummary(company.id, selectedYear, selectedMonth);
    $("#g1B2cEmpty").hidden = rows.length !== 0;
    $("#g1B2cTable").hidden = rows.length === 0;
    $("#g1B2cBody").innerHTML = rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.placeOfSupply)}</td>
        <td>${r.isInterState ? "Inter-State" : "Intra-State"}</td>
        <td class="text-right">${r.ratePct}%</td>
        <td class="text-right">${formatMoney(r.taxableValue)}</td>
        <td class="text-right">${r.isInterState ? formatMoney(r.igstAmount) : "—"}</td>
        <td class="text-right">${r.isInterState ? "—" : formatMoney(r.cgstAmount)}</td>
        <td class="text-right">${r.isInterState ? "—" : formatMoney(r.sgstAmount)}</td>
      </tr>`).join("");
  }

  function renderNotes() {
    const rows = ERP_Gstr1Repository.getCreditNoteRows(company.id, selectedYear, selectedMonth);
    $("#g1NotesEmpty").hidden = rows.length !== 0;
    $("#g1NotesTable").hidden = rows.length === 0;
    $("#g1NotesBody").innerHTML = rows.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.noteCode)}</code></td>
        <td>${r.noteDate || "—"}</td>
        <td>${escapeHtml(r.invoiceCode)}</td>
        <td>${escapeHtml(r.customerName)}</td>
        <td><span class="status-badge status-badge--${r.registered ? "info" : "neutral"}">${r.registered ? "B2B" : "B2C"}</span></td>
        <td class="text-right">${r.ratePct}%</td>
        <td class="text-right">${formatMoney(r.taxableValue)}</td>
        <td class="text-right">${formatMoney(r.taxAmount)}</td>
      </tr>`).join("");
  }

  function renderHsn() {
    const rows = ERP_Gstr1Repository.getHsnSummary(company.id, selectedYear, selectedMonth);
    $("#g1HsnEmpty").hidden = rows.length !== 0;
    $("#g1HsnTable").hidden = rows.length === 0;
    $("#g1HsnBody").innerHTML = rows.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.hsnCode)}</code></td>
        <td>${escapeHtml(r.unit || "—")}</td>
        <td class="text-right">${formatQty(r.quantity)}</td>
        <td class="text-right">${formatMoney(r.taxableValue)}</td>
        <td class="text-right">${formatMoney(r.igstAmount)}</td>
        <td class="text-right">${formatMoney(r.cgstAmount)}</td>
        <td class="text-right">${formatMoney(r.sgstAmount)}</td>
        <td class="text-right">${formatMoney(r.taxAmount)}</td>
      </tr>`).join("");
  }

  function bindTabs() {
    $$("#g1Tabs .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#g1Tabs .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        activeTab = chip.dataset.tab;
        $$(".gstr1-tab-panel").forEach((p) => { p.hidden = p.dataset.tab !== activeTab; });
      });
    });
  }


  /* -----------------------------------------------------------------------
     FILING HISTORY
     --------------------------------------------------------------------- */
  function renderFilingHistory() {
    const filings = ERP_Gstr1Repository.getFilingsForCompany(company.id);
    $("#g1HistoryEmpty").hidden = filings.length !== 0;
    $("#g1HistoryList").innerHTML = filings.map((f) => `
      <li class="activity-item">
        <span class="activity-item__icon">
          <svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/></svg>
        </span>
        <div>
          <p class="activity-item__text">${escapeHtml(periodLabel(f.periodYear, f.periodMonth))} — net taxable ${formatMoney(f.netTaxableValue)}, net tax ${formatMoney(f.netTax)}</p>
          <p class="activity-item__time">Filed ${formatDateTime(new Date(f.filedAt))} by ${escapeHtml(actorLabel(f.filedByUsername))}</p>
        </div>
      </li>
    `).join("");
  }


  /* -----------------------------------------------------------------------
     EXPORT
     --------------------------------------------------------------------- */
  function exportCsv() {
    const b2b = ERP_Gstr1Repository.getB2BRows(company.id, selectedYear, selectedMonth);
    const b2c = ERP_Gstr1Repository.getB2CSummary(company.id, selectedYear, selectedMonth);
    const notes = ERP_Gstr1Repository.getCreditNoteRows(company.id, selectedYear, selectedMonth);
    if (!b2b.length && !b2c.length && !notes.length) { showToast("Nothing to export for this period.", "warning"); return; }

    const lines = [`GSTR-1 — ${periodLabel(selectedYear, selectedMonth)} — ${company.name}`, ""];
    lines.push("B2B Invoices");
    lines.push(["Invoice", "Date", "Customer", "GSTIN", "Invoice Value", "Rate", "Taxable Value", "IGST", "CGST", "SGST"].join(","));
    b2b.forEach((r) => lines.push([r.invoiceCode, r.invoiceDate, `"${r.customerName}"`, r.customerGstin, r.invoiceValue.toFixed(2), r.ratePct, r.taxableValue.toFixed(2), r.igstAmount.toFixed(2), r.cgstAmount.toFixed(2), r.sgstAmount.toFixed(2)].join(",")));
    lines.push("");
    lines.push("B2C Summary");
    lines.push(["Place of Supply", "Type", "Rate", "Taxable Value", "IGST", "CGST", "SGST"].join(","));
    b2c.forEach((r) => lines.push([r.placeOfSupply, r.isInterState ? "Inter-State" : "Intra-State", r.ratePct, r.taxableValue.toFixed(2), r.igstAmount.toFixed(2), r.cgstAmount.toFixed(2), r.sgstAmount.toFixed(2)].join(",")));
    lines.push("");
    lines.push("Credit Notes Issued");
    lines.push(["Note Code", "Date", "Invoice", "Customer", "Type", "Rate", "Taxable Value", "Tax"].join(","));
    notes.forEach((r) => lines.push([r.noteCode, r.noteDate, r.invoiceCode, `"${r.customerName}"`, r.registered ? "B2B" : "B2C", r.ratePct, r.taxableValue.toFixed(2), r.taxAmount.toFixed(2)].join(",")));

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `gstr1-${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${company.companyCode}.csv`;
    link.click();
  }


  /* -----------------------------------------------------------------------
     FILE ACTION
     --------------------------------------------------------------------- */
  function requestFile() {
    const totals = ERP_Gstr1Repository.computeTotals(company.id, selectedYear, selectedMonth);
    openConfirm({
      title: `File GSTR-1 for ${periodLabel(selectedYear, selectedMonth)}?`,
      message: `This freezes today's figures as the reported return — net taxable value ${formatMoney(totals.netTaxableValue)}, net tax ${formatMoney(totals.netTax)}. A filed period can't be filed again through this page. This doesn't lock the period against later transactions; a correction discovered afterward is reported in a later period's return, the way real GST filing works.`,
      confirmLabel: "File This Return",
      onConfirm: () => {
        const result = ERP_Gstr1Repository.file(company, selectedYear, selectedMonth, session.username);
        if (!result.success) { showToast(result.reason, "danger"); return; }
        logSystemActivity({ module: "GSTR-1", action: "File", description: `Filed GSTR-1 for ${periodLabel(selectedYear, selectedMonth)} — net tax ${formatMoney(result.record.netTax)} (${company.name})` });
        showToast(`GSTR-1 filed for ${periodLabel(selectedYear, selectedMonth)}.`, "success");
        renderPeriod();
        renderFilingHistory();
      }
    });
  }


  /* -----------------------------------------------------------------------
     RENDER ORCHESTRATION
     --------------------------------------------------------------------- */
  function renderPeriod() {
    const filing = ERP_Gstr1Repository.findFiling(company.id, selectedYear, selectedMonth);
    const totals = filing || ERP_Gstr1Repository.computeTotals(company.id, selectedYear, selectedMonth);
    renderStatusBanner(filing, ERP_Gstr1Repository.computeTotals(company.id, selectedYear, selectedMonth));
    renderTotals(totals);
    renderB2B();
    renderB2C();
    renderNotes();
    renderHsn();
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "gstr1")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading outward supplies…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#g1Content").hidden = true;
      $("#g1Subtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#g1Content").hidden = false;
      $("#g1HeaderActions").hidden = false;
      $("#g1Subtitle").textContent = `Outward supply return for ${company.name} (${company.companyCode}).`;
      populatePeriodSelects();
      bindPeriodPicker();
      bindTabs();
      $("#g1FileBtn").addEventListener("click", requestFile);
      $("#g1ExportCsvBtn").addEventListener("click", exportCsv);
      $("#g1PrintBtn").addEventListener("click", () => window.print());
      renderPeriod();
      renderFilingHistory();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
