/* =============================================================================
   DOT ERP — pages/low-stock.js
   Phase 7, Module 06: Low Stock / Reorder Report

   The thinnest page in this phase — see data/low-stock-data.js's own
   header. No filters, no drill-down, no lifecycle. Read-only, sorted by
   urgency, nothing more.
   ========================================================================== */

(function () {
  "use strict";

  const { $, escapeHtml, requireSession, runBootSequence, showToast } = window.ERP;

  let session = null;
  let company = null;
  let currentReport = null;

  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

  function renderReport() {
    currentReport = ERP_LowStockRepository.getReport(company.id);

    $("#lsSummaryCritical").textContent = String(currentReport.criticalCount);
    $("#lsSummaryLow").textContent = String(currentReport.lowCount);
    $("#lsSummaryTotal").textContent = String(currentReport.rows.length);

    $("#lsEmptyState").hidden = currentReport.rows.length !== 0;
    $("#lsTable").hidden = currentReport.rows.length === 0;

    $("#lsTableBody").innerHTML = currentReport.rows.map((row) => {
      const gap = row.usage.currentStock - row.usage.reorderLevel;
      const tone = row.band === "critical" ? "danger" : "warning";
      return `
      <tr>
        <td>${escapeHtml(row.item.itemName)}</td>
        <td class="text-right">${formatQty(row.usage.currentStock)}</td>
        <td class="text-right">${formatQty(row.usage.reorderLevel)}</td>
        <td class="text-right ${gap < 0 ? "je-balance-off" : ""}">${gap > 0 ? "+" : ""}${formatQty(gap)}</td>
        <td><span class="status-badge status-badge--${tone}">${row.band === "critical" ? "Critical" : "Low"}</span></td>
      </tr>`;
    }).join("");
  }

  function bindToolbar() {
    $("#lsExportCsvBtn").addEventListener("click", exportCsv);
    $("#lsPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    if (!currentReport || !currentReport.rows.length) { showToast("Nothing to export — no items are currently low.", "warning"); return; }
    const header = ["Item", "Current Stock", "Reorder Level", "Gap", "Status"];
    const lines = [header.join(",")];
    currentReport.rows.forEach((row) => {
      const gap = row.usage.currentStock - row.usage.reorderLevel;
      lines.push([`"${row.item.itemName.replace(/"/g, '""')}"`, row.usage.currentStock, row.usage.reorderLevel, gap, row.band].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `low-stock-${company.companyCode}.csv`;
    link.click();
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "low-stock")) return;

    runBootSequence([
      { p: 40, t: "Checking reorder levels…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#lsContent").hidden = true;
      $("#lsSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#lsContent").hidden = false;
      $("#lsHeaderActions").hidden = false;
      $("#lsSubtitle").textContent = `Showing items at or near their reorder level for ${company.name} (${company.companyCode}).`;
      renderReport();
      bindToolbar();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
