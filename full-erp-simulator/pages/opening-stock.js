/* =============================================================================
   DOT ERP — pages/opening-stock.js
   Phase 7, Module 01: Opening Stock

   A simple list + Add modal, NOT a multi-line document builder — each
   record is exactly one (item, warehouse) pair with one quantity and one
   cost, so there's no line-item table here the way Journal Entry or the
   later Stock Adjustment/Stock Transfer pages need. Closest structural
   template is Warehouse Master's own list+modal shape, with the
   Active/Inactive toggle replaced by a genuine Draft -> Confirmed/
   Cancelled lifecycle (see data/opening-stock-data.js's own header for
   why there's no "reopen" once Confirmed).
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let filterStatus = "all";
  let page = 1;
  let detailId = null;

  function formatMoney(n) {
    return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function itemLabel(itemId) {
    const item = ERP_ItemRepository.findById(itemId);
    return item ? escapeHtml(item.itemName) : `<span class="profile-subtle">Unknown item</span>`;
  }
  function warehouseLabel(warehouseId) {
    const wh = ERP_WarehouseRepository.findById(warehouseId);
    return wh ? escapeHtml(wh.warehouseName) : `<span class="profile-subtle">Unknown warehouse</span>`;
  }
  function statusBadge(status) {
    const tone = status === "Confirmed" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_OpeningStockRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    return rows;
  }

  function renderSummary() {
    const all = ERP_OpeningStockRepository.getAllForCompany(company.id);
    const confirmed = all.filter((r) => r.status === "Confirmed");
    $("#osSummaryTotal").textContent = String(all.length);
    $("#osSummaryConfirmed").textContent = String(confirmed.length);
    $("#osSummaryDraft").textContent = String(all.filter((r) => r.status === "Draft").length);
    const totalValue = confirmed.reduce((sum, r) => sum + (Number(r.openingQuantity) || 0) * (Number(r.unitCost) || 0), 0);
    $("#osSummaryValue").textContent = formatMoney(totalValue);
  }

  function renderPagination(totalPages) {
    const container = $("#osPagination");
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
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#osEmptyState").hidden = all.length !== 0;
    $("#osTable").hidden = all.length === 0;

    $("#osTableBody").innerHTML = pageItems.map((r) => {
      const value = (Number(r.openingQuantity) || 0) * (Number(r.unitCost) || 0);
      return `
      <tr>
        <td>${itemLabel(r.itemId)}</td>
        <td>${warehouseLabel(r.warehouseId)}</td>
        <td class="text-right">${(Number(r.openingQuantity) || 0).toLocaleString("en-IN")}</td>
        <td class="text-right">${formatMoney(r.unitCost)}</td>
        <td class="text-right">${formatMoney(value)}</td>
        <td>${r.asOfDate || "—"}</td>
        <td>${statusBadge(r.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">View</button></td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     STATUS CHIPS
     --------------------------------------------------------------------- */
  function bindChips() {
    $$("#osStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#osStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#osExportCsvBtn").addEventListener("click", exportCsv);
    $("#osPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Item", "Warehouse", "Opening Qty", "Unit Cost", "Value", "As Of", "Status"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      const item = ERP_ItemRepository.findById(r.itemId);
      const wh = ERP_WarehouseRepository.findById(r.warehouseId);
      const value = (Number(r.openingQuantity) || 0) * (Number(r.unitCost) || 0);
      lines.push([
        `"${(item ? item.itemName : "Unknown").replace(/"/g, '""')}"`,
        `"${(wh ? wh.warehouseName : "Unknown").replace(/"/g, '""')}"`,
        r.openingQuantity, r.unitCost, value.toFixed(2), r.asOfDate, r.status
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `opening-stock-${company.companyCode}.csv`;
    link.click();
  }


  /* -----------------------------------------------------------------------
     ACTIVITY LOG
     --------------------------------------------------------------------- */
  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Opening Stock")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#osActivityEmptyState").hidden = relevant.length !== 0;
    $("#osActivityList").innerHTML = relevant.map((e) => `
      <li class="activity-item">
        <span class="activity-item__icon">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </span>
        <div>
          <p class="activity-item__text">${escapeHtml(e.description)}</p>
          <p class="activity-item__time">${formatDateTime(new Date(e.timestamp))}</p>
        </div>
      </li>
    `).join("");
  }


  /* -----------------------------------------------------------------------
     ADD MODAL
     --------------------------------------------------------------------- */
  function populateItemOptions() {
    const items = ERP_ItemRepository.getActiveForCompany(company.id);
    $("#osFormItem").innerHTML = `<option value="">Select an item</option>` +
      items.map((i) => `<option value="${i.id}">${escapeHtml(i.itemName)}</option>`).join("");
  }
  function populateWarehouseOptions() {
    const warehouses = ERP_WarehouseRepository.getAllForCompany(company.id).filter((w) => w.status === "Active");
    $("#osFormWarehouse").innerHTML = `<option value="">Select a warehouse</option>` +
      warehouses.map((w) => `<option value="${w.id}">${escapeHtml(w.warehouseName)}</option>`).join("");
  }

  function clearFormErrors() {
    ["osFormItemError", "osFormWarehouseError", "osFormDuplicateError", "osFormQuantityError", "osFormUnitCostError"].forEach((id) => { $("#" + id).textContent = ""; });
  }

  function openAddModal() {
    $("#osFormTitle").textContent = "Add opening stock";
    $("#osFormIntro").textContent = "Record the starting quantity and cost for one item in one warehouse.";
    $("#osFormSaveBtn").textContent = "Save Draft";
    populateItemOptions();
    populateWarehouseOptions();
    $("#osFormItem").value = "";
    $("#osFormWarehouse").value = "";
    $("#osFormQuantity").value = "0";
    $("#osFormUnitCost").value = "0";
    $("#osFormAsOfDate").value = new Date().toISOString().slice(0, 10);
    $("#osFormNotes").value = "";
    clearFormErrors();
    openModal("osFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const itemId = $("#osFormItem").value;
    const warehouseId = $("#osFormWarehouse").value;
    if (!itemId) { $("#osFormItemError").textContent = "Select an item."; valid = false; }
    if (!warehouseId) { $("#osFormWarehouseError").textContent = "Select a warehouse."; valid = false; }
    if (itemId && warehouseId && ERP_OpeningStockRepository.hasDuplicateForItemWarehouse(company.id, itemId, warehouseId, null)) {
      $("#osFormDuplicateError").textContent = "Opening stock for this item in this warehouse already exists (Draft or Confirmed). Edit or cancel that record instead of adding a duplicate.";
      valid = false;
    }
    const qty = Number($("#osFormQuantity").value);
    if (isNaN(qty) || qty < 0) { $("#osFormQuantityError").textContent = "Enter a quantity of zero or more."; valid = false; }
    const cost = Number($("#osFormUnitCost").value);
    if (isNaN(cost) || cost < 0) { $("#osFormUnitCostError").textContent = "Enter a unit cost of zero or more."; valid = false; }

    return valid;
  }

  function bindFormModal() {
    $("#osAddBtn").addEventListener("click", openAddModal);
    $("#osFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const payload = {
        itemId: $("#osFormItem").value,
        warehouseId: $("#osFormWarehouse").value,
        openingQuantity: Number($("#osFormQuantity").value),
        unitCost: Number($("#osFormUnitCost").value),
        asOfDate: $("#osFormAsOfDate").value || new Date().toISOString().slice(0, 10),
        notes: $("#osFormNotes").value.trim()
      };
      const created = ERP_OpeningStockRepository.create(company, payload, session.username);
      logSystemActivity({ module: "Opening Stock", action: "Create", description: `Added opening stock draft for "${itemLabelPlain(created.itemId)}" in "${warehouseLabelPlain(created.warehouseId)}" (${company.name})` });
      closeModal("osFormModal");
      renderAll();
      renderActivity();
      showToast("Opening stock saved as Draft — Confirm it to post to the Stock Ledger.", "success");
    });
  }

  function itemLabelPlain(id) { const i = ERP_ItemRepository.findById(id); return i ? i.itemName : "Unknown item"; }
  function warehouseLabelPlain(id) { const w = ERP_WarehouseRepository.findById(id); return w ? w.warehouseName : "Unknown warehouse"; }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function renderDetailFooter(record) {
    const footer = $("#osDetailFooter");
    footer.innerHTML = "";
    if (record.status === "Draft") {
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "btn btn--primary";
      confirmBtn.textContent = "Confirm (posts to Stock Ledger)";
      confirmBtn.addEventListener("click", () => requestConfirm(record));
      footer.appendChild(confirmBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn--ghost";
      cancelBtn.textContent = "Cancel Draft";
      cancelBtn.addEventListener("click", () => requestCancel(record));
      footer.appendChild(cancelBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn--danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => requestDelete(record));
      footer.appendChild(deleteBtn);
    }
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn btn--ghost";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => closeModal("osDetailModal"));
    footer.appendChild(closeBtn);
  }

  function openDetailModal(record) {
    detailId = record.id;
    $("#osDetailTitle").textContent = `Opening Stock — ${itemLabelPlain(record.itemId)}`;
    const value = (Number(record.openingQuantity) || 0) * (Number(record.unitCost) || 0);
    $("#osDetailBody").innerHTML = `
      <div><dt>Item</dt><dd>${escapeHtml(itemLabelPlain(record.itemId))}</dd></div>
      <div><dt>Warehouse</dt><dd>${escapeHtml(warehouseLabelPlain(record.warehouseId))}</dd></div>
      <div><dt>Opening Quantity</dt><dd>${(Number(record.openingQuantity) || 0).toLocaleString("en-IN")}</dd></div>
      <div><dt>Unit Cost</dt><dd>${formatMoney(record.unitCost)}</dd></div>
      <div><dt>Value</dt><dd>${formatMoney(value)}</dd></div>
      <div><dt>As Of Date</dt><dd>${record.asOfDate || "—"}</dd></div>
      <div><dt>Notes</dt><dd>${record.notes ? escapeHtml(record.notes) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(record.status)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(record.createdAt))} by ${escapeHtml(record.createdByUsername)}</dd></div>
      ${record.status === "Confirmed" ? `<div><dt>Confirmed</dt><dd>${formatDateTime(new Date(record.confirmedAt))} by ${escapeHtml(record.confirmedByUsername)}</dd></div>` : ""}
      ${record.status === "Cancelled" ? `<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(record.cancelledAt))} by ${escapeHtml(record.cancelledByUsername)}</dd></div>` : ""}
    `;
    renderDetailFooter(record);
    openModal("osDetailModal");
  }

  function requestConfirm(record) {
    openConfirm({
      title: "Confirm this opening stock?",
      message: `This posts one permanent Stock Ledger entry for ${itemLabelPlain(record.itemId)} in ${warehouseLabelPlain(record.warehouseId)}. There is no un-confirm — a wrong quantity afterward is fixed with a Stock Adjustment, not by editing this record.`,
      confirmLabel: "Confirm",
      onConfirm: () => {
        const updated = ERP_OpeningStockRepository.confirm(record.id, company, session.username);
        if (updated) {
          logSystemActivity({ module: "Opening Stock", action: "Confirm", description: `Confirmed opening stock for "${itemLabelPlain(record.itemId)}" in "${warehouseLabelPlain(record.warehouseId)}" (${company.name})` });

          // Books the opening balance to the General Ledger — see
          // gl-posting-data.js's own postOpeningStock().
          if (typeof ERP_GlPostingRepository !== "undefined") {
            const glResult = ERP_GlPostingRepository.postOpeningStock(company, updated, session.username);
            if (glResult.success && !glResult.skipped) {
              logSystemActivity({ module: "Opening Stock", action: "Auto-Post", description: `Posted opening balance (${formatMoney(glResult.amount)}) for "${itemLabelPlain(record.itemId)}" in "${warehouseLabelPlain(record.warehouseId)}" (${company.name})` });
            } else if (!glResult.success) {
              showToast(glResult.reason, "warning", { title: "Not posted to the books" });
            }
          }

          closeModal("osDetailModal");
          renderAll();
          renderActivity();
          showToast("Opening stock confirmed and posted to the Stock Ledger.", "success");
        }
      }
    });
  }

  function requestCancel(record) {
    openConfirm({
      title: "Cancel this draft?",
      message: "This draft was never confirmed, so nothing has been posted to the Stock Ledger — cancelling is safe.",
      confirmLabel: "Cancel Draft",
      onConfirm: () => {
        ERP_OpeningStockRepository.cancel(record.id, session.username);
        logSystemActivity({ module: "Opening Stock", action: "Cancel", description: `Cancelled opening stock draft for "${itemLabelPlain(record.itemId)}" in "${warehouseLabelPlain(record.warehouseId)}" (${company.name})` });
        closeModal("osDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function requestDelete(record) {
    openConfirm({
      title: "Delete this draft?",
      message: "This removes the draft record entirely. This cannot be undone.",
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_OpeningStockRepository.remove(record.id);
        logSystemActivity({ module: "Opening Stock", action: "Delete", description: `Deleted opening stock draft for "${itemLabelPlain(record.itemId)}" in "${warehouseLabelPlain(record.warehouseId)}" (${company.name})` });
        closeModal("osDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#osTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (viewBtn) {
        const record = ERP_OpeningStockRepository.findById(viewBtn.dataset.id);
        if (record) openDetailModal(record);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "opening-stock")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading opening stock records…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#osContent").hidden = true;
      $("#osSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#osContent").hidden = false;
      $("#osHeaderActions").hidden = false;
      $("#osSubtitle").textContent = `Managing opening stock for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
