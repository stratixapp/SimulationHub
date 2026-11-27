/* =============================================================================
   DOT ERP — pages/gst-summary.js
   Phase 8, Module 03: GST Summary

   Ungrouped-table shape (no pagination) — same reasoning AP Aging used:
   this report's own row count is bounded by distinct tax rates and HSN
   codes in use, not by transaction volume, so there's nothing to paginate.
   ========================================================================== */

(function () {
  "use strict";

  const { $, escapeHtml, requireSession, runBootSequence, showToast } = window.ERP;

  let session = null;
  let company = null;
  let currentSummary = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function formatSigned(n) {
    const v = Number(n) || 0;
    return (v < 0 ? "-₹" : "₹") + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

  function currentFilters() {
    return { fromDate: $("#gsFromDate").value || "", toDate: $("#gsToDate").value || "" };
  }

  /* -----------------------------------------------------------------------
     SUMMARY + TABLES
     --------------------------------------------------------------------- */
  function renderSummary(summary) {
    $("#gsSummaryOutput").textContent = formatMoney(summary.outputTax);
    $("#gsSummaryInput").textContent = formatMoney(summary.inputTax);
    $("#gsSummaryCounts").textContent = `${summary.salesLineCount} / ${summary.purchaseLineCount}`;

    const netEl = $("#gsSummaryNet");
    const netIcon = $("#gsNetIcon");
    const netLabel = $("#gsNetLabel");
    if (summary.netTax >= 0) {
      netEl.textContent = formatMoney(summary.netTax);
      netLabel.textContent = "Net Tax Payable";
      netIcon.className = "kpi-card__icon kpi-card__icon--danger";
    } else {
      netEl.textContent = formatMoney(Math.abs(summary.netTax));
      netLabel.textContent = "Net Credit Carried Forward";
      netIcon.className = "kpi-card__icon kpi-card__icon--success";
    }
  }

  function renderRateTable(summary) {
    const rows = summary.byRate;
    $("#gsRateEmptyState").hidden = rows.length !== 0;
    $("#gsRateTable").hidden = rows.length === 0;
    $("#gsRateTableBody").innerHTML = rows.map((r) => `
      <tr>
        <td>${r.ratePct}%</td>
        <td class="text-right">${formatMoney(r.outputTaxableValue)}</td>
        <td class="text-right">${r.outputCgst ? formatMoney(r.outputCgst) : "—"}</td>
        <td class="text-right">${r.outputSgst ? formatMoney(r.outputSgst) : "—"}</td>
        <td class="text-right">${r.outputIgst ? formatMoney(r.outputIgst) : "—"}</td>
        <td class="text-right">${formatMoney(r.inputTaxableValue)}</td>
        <td class="text-right">${r.inputCgst ? formatMoney(r.inputCgst) : "—"}</td>
        <td class="text-right">${r.inputSgst ? formatMoney(r.inputSgst) : "—"}</td>
        <td class="text-right">${r.inputIgst ? formatMoney(r.inputIgst) : "—"}</td>
        <td class="text-right"><strong>${formatSigned(r.netTax)}</strong></td>
      </tr>`).join("");
  }

  function renderHsnTable(summary) {
    const rows = summary.byHsn;
    $("#gsHsnEmptyState").hidden = rows.length !== 0;
    $("#gsHsnTable").hidden = rows.length === 0;
    $("#gsHsnTableBody").innerHTML = rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.hsnCode)}</td>
        <td class="text-right">${formatMoney(r.outputTaxableValue)}</td>
        <td class="text-right">${formatMoney(r.outputTax)}</td>
        <td class="text-right">${formatMoney(r.inputTaxableValue)}</td>
        <td class="text-right">${formatMoney(r.inputTax)}</td>
        <td class="text-right"><strong>${formatSigned(r.netTax)}</strong></td>
      </tr>`).join("");
  }

  function renderAll() {
    currentSummary = ERP_GstSummaryRepository.getSummary(company.id, currentFilters());
    renderSummary(currentSummary);
    renderRateTable(currentSummary);
    renderHsnTable(currentSummary);
  }

  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function thisMonthRange() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const iso = (d) => d.toISOString().slice(0, 10);
    return { from: iso(first), to: iso(last) };
  }

  function bindToolbar() {
    ["#gsFromDate", "#gsToDate"].forEach((sel) => $(sel).addEventListener("change", renderAll));
    $("#gsThisMonthBtn").addEventListener("click", () => {
      const { from, to } = thisMonthRange();
      $("#gsFromDate").value = from;
      $("#gsToDate").value = to;
      renderAll();
    });
    $("#gsClearFiltersBtn").addEventListener("click", () => {
      $("#gsFromDate").value = "";
      $("#gsToDate").value = "";
      renderAll();
    });
    $("#gsExportCsvBtn").addEventListener("click", exportCsv);
    $("#gsPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    if (!currentSummary || (!currentSummary.byRate.length && !currentSummary.byHsn.length)) {
      showToast("Nothing to export — no output or input tax in this period.", "warning");
      return;
    }
    const lines = ["Reconciliation by Tax Rate"];
    lines.push(["Rate", "Output Taxable", "Output CGST", "Output SGST", "Output IGST", "Input Taxable", "Input CGST", "Input SGST", "Input IGST", "Net Tax"].join(","));
    currentSummary.byRate.forEach((r) => {
      lines.push([r.ratePct, r.outputTaxableValue.toFixed(2), r.outputCgst.toFixed(2), r.outputSgst.toFixed(2), r.outputIgst.toFixed(2),
        r.inputTaxableValue.toFixed(2), r.inputCgst.toFixed(2), r.inputSgst.toFixed(2), r.inputIgst.toFixed(2), r.netTax.toFixed(2)].join(","));
    });
    lines.push("");
    lines.push("Reconciliation by HSN Code");
    lines.push(["HSN", "Output Taxable", "Output Tax", "Input Taxable", "Input Tax", "Net Tax"].join(","));
    currentSummary.byHsn.forEach((r) => {
      lines.push([r.hsnCode, r.outputTaxableValue.toFixed(2), r.outputTax.toFixed(2), r.inputTaxableValue.toFixed(2), r.inputTax.toFixed(2), r.netTax.toFixed(2)].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `gst-summary-${company.companyCode}.csv`;
    link.click();
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "gst-summary")) return;

    runBootSequence([
      { p: 30, t: "Reading Sales Register…" },
      { p: 60, t: "Reading Purchase Register…" },
      { p: 90, t: "Reconciling output vs. input tax…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#gsContent").hidden = true;
      $("#gsSubtitle").textContent = "No active company yet.";
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    $("#noCompanyState").hidden = true;
    $("#gsContent").hidden = false;
    $("#gsHeaderActions").hidden = false;
    $("#gsSubtitle").textContent = `Output vs. input tax for ${company.name} (${company.companyCode}).`;

    bindToolbar();
    renderAll();

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
