/* =============================================================================
   DOT ERP — pages/stock-ledger.js
   Phase 7, Module 02: Stock Ledger

   READ-ONLY, ON PURPOSE — the same shape general-ledger.js established:
   no Add, no Edit, no Delete, no status transitions. `#confirmDialog` is
   only still wired up because openModal/closeModal assume it exists
   elsewhere on the page; nothing here ever calls openConfirm(). Unlike
   General Ledger, this page's own repository has genuine storage (see
   data/stock-ledger-data.js's own header) — but the PAGE itself still
   creates nothing; every entry arrived as a side effect of another
   module's own already-final action (Opening Stock confirm(), GRN
   post(), Delivery Challan issue(), Stock Adjustment post(), Stock
   Transfer complete()).
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, requireSession, runBootSequence
  } = window.ERP;

  const PAGE_SIZE = 10;

  let session = null;
  let company = null;
  let filterItemId = "";
  let filterWarehouseId = "";
  let page = 1;
  let ledgerPair = null; // { itemId, warehouseId }

  function itemLabel(id) { const i = ERP_ItemRepository.findById(id); return i ? i.itemName : "Unknown item"; }
  function warehouseLabel(id) { const w = ERP_WarehouseRepository.findById(id); return w ? w.warehouseName : "Unknown warehouse"; }
  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }


  /* -----------------------------------------------------------------------
     PAIR LIST (filter + summary)
     --------------------------------------------------------------------- */
  function getFilteredPairs() {
    let rows = ERP_StockLedgerRepository.getActivePairsForCompany(company.id);
    if (filterItemId) rows = rows.filter((r) => r.itemId === filterItemId);
    if (filterWarehouseId) rows = rows.filter((r) => r.warehouseId === filterWarehouseId);
    return rows.sort((a, b) => itemLabel(a.itemId).localeCompare(itemLabel(b.itemId)) || warehouseLabel(a.warehouseId).localeCompare(warehouseLabel(b.warehouseId)));
  }

  function renderSummary() {
    const all = ERP_StockLedgerRepository.getAllForCompany(company.id);
    const pairs = ERP_StockLedgerRepository.getActivePairsForCompany(company.id);
    $("#slSummaryPairs").textContent = String(pairs.length);
    $("#slSummaryEntries").textContent = String(all.length);
    const totalIn = all.filter((e) => e.quantity > 0).reduce((s, e) => s + e.quantity, 0);
    const totalOut = all.filter((e) => e.quantity < 0).reduce((s, e) => s + Math.abs(e.quantity), 0);
    $("#slSummaryIn").textContent = formatQty(totalIn);
    $("#slSummaryOut").textContent = formatQty(totalOut);
  }

  function renderPagination(totalPages) {
    const container = $("#slPagination");
    container.innerHTML = "";
    if (totalPages <= 1) return;
    const makeBtn = (label, disabled, onClick, active) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "page-btn" + (active ? " is-active" : "");
      btn.textContent = label;
      btn.disabled = !!disabled;
      btn.addEventListener("click", onClick);
      return btn;
    };
    container.appendChild(makeBtn("‹", page === 1, () => { page--; renderTable(); }));
    for (let p = 1; p <= totalPages; p++) {
      container.appendChild(makeBtn(String(p), false, () => { page = p; renderTable(); }, p === page));
    }
    container.appendChild(makeBtn("›", page === totalPages, () => { page++; renderTable(); }));
  }

  function renderTable() {
    const all = getFilteredPairs();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#slEmptyState").hidden = all.length !== 0;
    $("#slTable").hidden = all.length === 0;

    $("#slTableBody").innerHTML = pageItems.map((r) => `
      <tr>
        <td>${escapeHtml(itemLabel(r.itemId))}</td>
        <td>${escapeHtml(warehouseLabel(r.warehouseId))}</td>
        <td class="text-right">${formatQty(r.balance)}${r.balance < 0 ? ' <span class="status-badge status-badge--danger">negative</span>' : ""}</td>
        <td class="text-right">${r.entryCount}</td>
        <td>${escapeHtml(r.lastTransactionType)} · ${escapeHtml(r.lastTransactionDate)}</td>
        <td><button type="button" class="row-detail-btn" data-item="${r.itemId}" data-warehouse="${r.warehouseId}">View Ledger</button></td>
      </tr>
    `).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     FILTERS + TOOLBAR
     --------------------------------------------------------------------- */
  function populateFilters() {
    const pairs = ERP_StockLedgerRepository.getActivePairsForCompany(company.id);
    const itemIds = [...new Set(pairs.map((p) => p.itemId))].sort((a, b) => itemLabel(a).localeCompare(itemLabel(b)));
    const warehouseIds = [...new Set(pairs.map((p) => p.warehouseId))].sort((a, b) => warehouseLabel(a).localeCompare(warehouseLabel(b)));
    $("#slItemFilter").innerHTML = `<option value="">All Items</option>` + itemIds.map((id) => `<option value="${id}">${escapeHtml(itemLabel(id))}</option>`).join("");
    $("#slWarehouseFilter").innerHTML = `<option value="">All Warehouses</option>` + warehouseIds.map((id) => `<option value="${id}">${escapeHtml(warehouseLabel(id))}</option>`).join("");
  }

  function bindToolbar() {
    $("#slItemFilter").addEventListener("change", (e) => { filterItemId = e.target.value; page = 1; renderTable(); });
    $("#slWarehouseFilter").addEventListener("change", (e) => { filterWarehouseId = e.target.value; page = 1; renderTable(); });
    $("#slExportCsvBtn").addEventListener("click", exportCsv);
    $("#slPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredPairs();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Item", "Warehouse", "Current Balance", "Entries", "Last Movement Type", "Last Movement Date"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([
        `"${itemLabel(r.itemId).replace(/"/g, '""')}"`,
        `"${warehouseLabel(r.warehouseId).replace(/"/g, '""')}"`,
        r.balance, r.entryCount, `"${r.lastTransactionType}"`, r.lastTransactionDate
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `stock-ledger-${company.companyCode}.csv`;
    link.click();
  }


  /* -----------------------------------------------------------------------
     DRILL-DOWN MODAL (per item/warehouse pair)
     --------------------------------------------------------------------- */
  function renderLedgerModal() {
    const rows = ERP_StockLedgerRepository.getLedgerRows(company.id, ledgerPair.itemId, ledgerPair.warehouseId);

    $("#slLedgerTitle").textContent = `${itemLabel(ledgerPair.itemId)} · ${warehouseLabel(ledgerPair.warehouseId)}`;
    $("#slLedgerSubtitle").textContent = `${rows.length} entr${rows.length === 1 ? "y" : "ies"} for this item/warehouse pair.`;

    $("#slLedgerEmptyState").hidden = rows.length !== 0;
    $("#slLedgerTable").hidden = rows.length === 0;

    $("#slLedgerTableBody").innerHTML = rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.entry.transactionDate)}</td>
        <td>${escapeHtml(r.entry.transactionType)}</td>
        <td>${escapeHtml(r.entry.referenceId || "—")}${r.entry.narration ? `<br><span class="profile-subtle">${escapeHtml(r.entry.narration)}</span>` : ""}</td>
        <td class="text-right">${r.entry.quantity > 0 ? "+" : ""}${formatQty(r.entry.quantity)}</td>
        <td class="text-right">${r.entry.unitCost === null ? "—" : formatMoney(r.entry.unitCost)}</td>
        <td class="text-right">${formatQty(r.runningBalance)}</td>
      </tr>
    `).join("");

    const closingBalance = rows.length ? rows[rows.length - 1].runningBalance : 0;
    $("#slLedgerFooter").innerHTML = `<p class="profile-subtle" style="margin:0;">Current balance: <strong style="color:var(--color-text);">${formatQty(closingBalance)}</strong></p>`;
  }

  function openLedgerModal(itemId, warehouseId) {
    ledgerPair = { itemId, warehouseId };
    renderLedgerModal();
    openModal("slLedgerModal");
  }

  function bindLedgerModal() {
    $("#slTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest(".row-detail-btn");
      if (!btn) return;
      openLedgerModal(btn.dataset.item, btn.dataset.warehouse);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "stock-ledger")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading stock ledger…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    const hasEntries = company && ERP_StockLedgerRepository.getAllForCompany(company.id).length > 0;

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#slContent").hidden = true;
      $("#slSubtitle").textContent = "No active company yet.";
    } else if (!hasEntries) {
      $("#noPostingsState").hidden = false;
      $("#slContent").hidden = true;
      $("#slSubtitle").textContent = `Nothing posted yet for ${company.name}.`;
    } else {
      $("#noCompanyState").hidden = true;
      $("#noPostingsState").hidden = true;
      $("#slContent").hidden = false;
      $("#slHeaderActions").hidden = false;
      $("#slSubtitle").textContent = `Showing stock activity for ${company.name} (${company.companyCode}).`;
      populateFilters();
      renderAll();
      bindToolbar();
      bindLedgerModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
