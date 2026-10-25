/* =============================================================================
   DOT ERP — pages/stock-valuation.js
   Phase 7, Module 05: Stock Valuation Report

   Read-only, same shape as ap-aging.js and stock-ledger.js: no Add, no
   Edit, no Delete. Every row and every layer comes straight from
   data/stock-valuation-data.js's own getValuationReport()/computeFifoState()
   — this file only renders and filters, it does not touch the FIFO math.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, requireSession, runBootSequence
  } = window.ERP;

  let session = null;
  let company = null;
  let filterWarehouseId = "";
  let asOfDate = "";
  let currentReport = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function warehouseLabel(id) { const w = ERP_WarehouseRepository.findById(id); return w ? w.warehouseName : "Unknown warehouse"; }


  /* -----------------------------------------------------------------------
     REPORT TABLE
     --------------------------------------------------------------------- */
  function populateWarehouseFilter() {
    const warehouses = ERP_WarehouseRepository.getAllForCompany(company.id);
    $("#svWarehouseFilter").innerHTML = `<option value="">All Warehouses</option>` + warehouses.map((w) => `<option value="${w.id}">${escapeHtml(w.warehouseName)}</option>`).join("");
  }

  function renderReport() {
    currentReport = ERP_StockValuationRepository.getValuationReport(company.id, asOfDate, filterWarehouseId || null);

    $("#svSummaryItems").textContent = String(currentReport.rows.length);
    $("#svSummaryQuantity").textContent = formatQty(currentReport.grandTotalQuantity);
    $("#svSummaryValue").textContent = formatMoney(currentReport.grandTotalValue);
    $("#svSummaryShortfall").textContent = String(currentReport.rows.filter((r) => r.shortfallQuantity > 0).length);

    $("#svEmptyState").hidden = currentReport.rows.length !== 0;
    $("#svTable").hidden = currentReport.rows.length === 0;

    $("#svTableBody").innerHTML = currentReport.rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.item.itemName)}${r.shortfallQuantity > 0 ? ` <span class="status-badge status-badge--danger" title="Issued before enough was ever received or opened for it">shortfall</span>` : ""}</td>
        <td class="text-right">${formatQty(r.quantity)}</td>
        <td class="text-right">${formatMoney(r.averageUnitCost)}</td>
        <td class="text-right">${formatMoney(r.value)}</td>
        <td><button type="button" class="row-detail-btn" data-item="${r.itemId}">View Layers</button></td>
      </tr>
    `).join("");

    $("#svGrandTotalRow").innerHTML = `<strong style="color:var(--color-text);">Grand total:</strong> ${formatQty(currentReport.grandTotalQuantity)} units, ${formatMoney(currentReport.grandTotalValue)}${filterWarehouseId ? ` (${escapeHtml(warehouseLabel(filterWarehouseId))} only)` : " (all warehouses)"}, as of ${currentReport.asOfDate}.`;
  }

  function bindToolbar() {
    $("#svAsOfDate").addEventListener("change", (e) => { asOfDate = e.target.value; renderReport(); });
    $("#svWarehouseFilter").addEventListener("change", (e) => { filterWarehouseId = e.target.value; renderReport(); });
    $("#svExportCsvBtn").addEventListener("click", exportCsv);
    $("#svPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    if (!currentReport || !currentReport.rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Item", "Quantity On Hand", "Avg Unit Cost", "Total Value", "Shortfall Quantity"];
    const lines = [header.join(",")];
    currentReport.rows.forEach((r) => {
      lines.push([`"${r.item.itemName.replace(/"/g, '""')}"`, r.quantity, r.averageUnitCost.toFixed(2), r.value.toFixed(2), r.shortfallQuantity].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `stock-valuation-${company.companyCode}.csv`;
    link.click();
  }


  /* -----------------------------------------------------------------------
     LAYER DRILL-DOWN MODAL
     --------------------------------------------------------------------- */
  function openLayerModal(itemId) {
    const row = currentReport.rows.find((r) => r.itemId === itemId);
    if (!row) return;

    $("#svLayerTitle").textContent = `FIFO layers — ${row.item.itemName}`;
    $("#svLayerSubtitle").textContent = `${row.layers.length} remaining layer${row.layers.length === 1 ? "" : "s"}, oldest first, as of ${currentReport.asOfDate}.`;

    $("#svLayerEmptyState").hidden = row.layers.length !== 0;
    $("#svLayerTable").hidden = row.layers.length === 0;

    $("#svLayerTableBody").innerHTML = row.layers.map((l) => `
      <tr>
        <td>${escapeHtml(l.entryDate)}</td>
        <td>${escapeHtml(warehouseLabel(l.warehouseId))}</td>
        <td class="text-right">${formatQty(l.quantity)}</td>
        <td class="text-right">${formatMoney(l.unitCost)}</td>
        <td class="text-right">${formatMoney(l.quantity * l.unitCost)}</td>
      </tr>
    `).join("");

    $("#svLayerFooter").innerHTML = `<p class="profile-subtle" style="margin:0;">Total: <strong style="color:var(--color-text);">${formatQty(row.quantity)} units, ${formatMoney(row.value)}</strong></p>`;
    openModal("svLayerModal");
  }

  function bindLayerModal() {
    $("#svTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest(".row-detail-btn");
      if (!btn) return;
      openLayerModal(btn.dataset.item);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "stock-valuation")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Walking stock ledger layers…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    const hasEntries = company && typeof ERP_StockLedgerRepository !== "undefined" && ERP_StockLedgerRepository.getAllForCompany(company.id).length > 0;

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#svContent").hidden = true;
      $("#svSubtitle").textContent = "No active company yet.";
    } else if (!hasEntries) {
      $("#noPostingsState").hidden = false;
      $("#svContent").hidden = true;
      $("#svSubtitle").textContent = `Nothing to value yet for ${company.name}.`;
    } else {
      $("#noCompanyState").hidden = true;
      $("#noPostingsState").hidden = true;
      $("#svContent").hidden = false;
      $("#svHeaderActions").hidden = false;
      $("#svSubtitle").textContent = `Showing FIFO valuation for ${company.name} (${company.companyCode}).`;
      asOfDate = new Date().toISOString().slice(0, 10);
      $("#svAsOfDate").value = asOfDate;
      populateWarehouseFilter();
      renderReport();
      bindToolbar();
      bindLayerModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
