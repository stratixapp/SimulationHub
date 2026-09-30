/* =============================================================================
   DOT ERP — pages/inventory-valuation.js
   Phase 8, Module 04: Inventory Valuation Report

   Grouped-table shape reusing Trial Balance / Balance Sheet's own
   `tb-type-header` (category header row) and `je-totals-row` (subtotal
   row) CSS classes — an established visual convention, not a new one.
   ========================================================================== */

(function () {
  "use strict";

  const { $, escapeHtml, requireSession, runBootSequence } = window.ERP;

  let session = null;
  let company = null;
  let currentReport = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

  function renderReport() {
    const asOfDate = $("#ivAsOfDate").value || new Date().toISOString().slice(0, 10);
    const warehouseId = $("#ivWarehouseFilter").value || null;
    currentReport = ERP_InventoryValuationRepository.getReport(company.id, asOfDate, warehouseId);

    const hasAny = currentReport.itemCount > 0;
    $("#noPostingsState").hidden = hasAny;
    $("#ivReportBody").hidden = !hasAny;
    if (!hasAny) return;

    $("#ivSummaryTotal").textContent = formatMoney(currentReport.grandTotalValue);
    $("#ivSummaryItems").textContent = String(currentReport.itemCount);
    $("#ivSummaryCategories").textContent = String(currentReport.groups.length);

    let html = "";
    currentReport.groups.forEach((group) => {
      html += `<tr class="tb-type-header"><td colspan="4">${escapeHtml(group.categoryName.toUpperCase())}</td></tr>`;
      group.rows.forEach((row) => {
        html += `
        <tr>
          <td>${escapeHtml(row.item.itemName)}</td>
          <td class="text-right">${formatQty(row.quantity)}</td>
          <td class="text-right">${formatMoney(row.averageUnitCost)}</td>
          <td class="text-right">${formatMoney(row.value)}</td>
        </tr>`;
      });
      html += `<tr class="je-totals-row"><td colspan="3">Subtotal — ${escapeHtml(group.categoryName)}</td><td class="text-right">${formatMoney(group.subtotalValue)}</td></tr>`;
    });
    html += `<tr class="je-totals-row"><td colspan="3">Grand Total</td><td class="text-right">${formatMoney(currentReport.grandTotalValue)}</td></tr>`;

    $("#ivTableBody").innerHTML = html;
  }

  function populateWarehouseFilter() {
    const warehouses = ERP_WarehouseRepository.getAllForCompany(company.id);
    $("#ivWarehouseFilter").insertAdjacentHTML("beforeend",
      warehouses.map((w) => `<option value="${w.id}">${escapeHtml(w.warehouseName)}</option>`).join(""));
  }

  function bindToolbar() {
    $("#ivAsOfDate").addEventListener("change", renderReport);
    $("#ivWarehouseFilter").addEventListener("change", renderReport);
    $("#ivExportCsvBtn").addEventListener("click", exportCsv);
    $("#ivPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    if (!currentReport || !currentReport.itemCount) return;
    const lines = [["Category", "Item", "Qty", "Avg Unit Cost", "Value"].join(",")];
    currentReport.groups.forEach((group) => {
      group.rows.forEach((row) => {
        lines.push([`"${group.categoryName.replace(/"/g, '""')}"`, `"${row.item.itemName.replace(/"/g, '""')}"`,
          row.quantity, row.averageUnitCost.toFixed(2), row.value.toFixed(2)].join(","));
      });
      lines.push([`"${group.categoryName.replace(/"/g, '""')} Subtotal"`, "", "", "", group.subtotalValue.toFixed(2)].join(","));
    });
    lines.push(["Grand Total", "", "", "", currentReport.grandTotalValue.toFixed(2)].join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inventory-valuation-${company.companyCode}.csv`;
    link.click();
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "inventory-valuation")) return;

    runBootSequence([
      { p: 35, t: "Reading Stock Valuation's own FIFO state…" },
      { p: 70, t: "Grouping by category…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#ivContent").hidden = true;
      $("#ivSubtitle").textContent = "No active company yet.";
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    $("#noCompanyState").hidden = true;
    $("#ivContent").hidden = false;
    $("#ivHeaderActions").hidden = false;
    $("#ivSubtitle").textContent = `Category-grouped inventory valuation for ${company.name} (${company.companyCode}).`;
    $("#ivAsOfDate").value = new Date().toISOString().slice(0, 10);

    populateWarehouseFilter();
    bindToolbar();
    renderReport();

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
