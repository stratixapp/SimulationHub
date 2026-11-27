/* =============================================================================
   DOT ERP — pages/stock-transfer.js
   Phase 7, Module 04: Stock Transfer

   Same live add/remove line-table shape as stock-adjustment.js, simplified:
   no reason, no unit cost input (the destination's cost is worked out
   automatically by data/stock-transfer-data.js's own complete(), via the
   FIFO engine's weighted-average — see that file's own header). Each
   line shows how much of the item is actually available in the currently
   selected From warehouse, live, so a trainee can see a shortfall before
   even trying to complete the transfer.
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
  let formLines = [];
  let rowCounter = 0;

  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function itemLabel(id) { const i = ERP_ItemRepository.findById(id); return i ? i.itemName : "Unknown item"; }
  function warehouseLabel(id) { const w = ERP_WarehouseRepository.findById(id); return w ? w.warehouseName : "Unknown warehouse"; }
  function statusBadge(status) {
    const tone = status === "Completed" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY / LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_StockTransferRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    return rows;
  }

  function renderSummary() {
    const all = ERP_StockTransferRepository.getAllForCompany(company.id);
    $("#stSummaryTotal").textContent = String(all.length);
    const completed = all.filter((r) => r.status === "Completed");
    $("#stSummaryCompleted").textContent = String(completed.length);
    $("#stSummaryDraft").textContent = String(all.filter((r) => r.status === "Draft").length);
    const totalQty = completed.reduce((sum, r) => sum + (r.lineItems || []).reduce((s, l) => s + (Number(l.quantity) || 0), 0), 0);
    $("#stSummaryQuantity").textContent = formatQty(totalQty);
  }

  function renderPagination(totalPages) {
    const container = $("#stPagination");
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

    $("#stEmptyState").hidden = all.length !== 0;
    $("#stTable").hidden = all.length === 0;

    $("#stTableBody").innerHTML = pageItems.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.transferNumber)}</code></td>
        <td>${escapeHtml(warehouseLabel(r.fromWarehouseId))}</td>
        <td>${escapeHtml(warehouseLabel(r.toWarehouseId))}</td>
        <td class="text-right">${(r.lineItems || []).length}</td>
        <td>${r.transferDate || "—"}</td>
        <td>${statusBadge(r.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">View</button></td>
      </tr>
    `).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#stStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#stStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#stExportCsvBtn").addEventListener("click", exportCsv);
    $("#stPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Transfer #", "From", "To", "Lines", "Date", "Status"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([r.transferNumber, `"${warehouseLabel(r.fromWarehouseId)}"`, `"${warehouseLabel(r.toWarehouseId)}"`, (r.lineItems || []).length, r.transferDate, r.status].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `stock-transfers-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Stock Transfer")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#stActivityEmptyState").hidden = relevant.length !== 0;
    $("#stActivityList").innerHTML = relevant.map((e) => `
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
     LINE TABLE (add modal)
     --------------------------------------------------------------------- */
  function itemOptionsHtml(selectedId) {
    const items = ERP_ItemRepository.getActiveForCompany(company.id);
    const options = items.map((i) => `<option value="${i.id}"${i.id === selectedId ? " selected" : ""}>${escapeHtml(i.itemName)}</option>`).join("");
    return `<option value="">Select item…</option>` + options;
  }

  function availableFor(itemId) {
    const fromWarehouseId = $("#stFormFromWarehouse").value;
    if (!itemId || !fromWarehouseId || typeof ERP_StockLedgerRepository === "undefined") return null;
    return ERP_StockLedgerRepository.getBalance(company.id, itemId, fromWarehouseId);
  }

  function renderLineRows() {
    $("#stLineTableBody").innerHTML = formLines.map((line) => {
      const available = availableFor(line.itemId);
      const qty = Number(line.quantity) || 0;
      const short = available !== null && qty > available;
      return `
      <tr data-row-id="${line.rowId}">
        <td><select class="select-field st-line-item">${itemOptionsHtml(line.itemId)}</select></td>
        <td class="text-right">${available === null ? "—" : formatQty(available)}</td>
        <td><div class="input-wrap"><input type="number" class="st-line-qty" min="0" step="0.01" value="${line.quantity}" /></div>${short ? `<p class="field-error" style="margin:4px 0 0;">More than what's available — this line will be skipped.</p>` : ""}</td>
        <td><button type="button" class="link-btn st-remove-line">Remove</button></td>
      </tr>`;
    }).join("");
  }

  function addLine() {
    rowCounter += 1;
    formLines.push({ rowId: "row-" + rowCounter, itemId: "", quantity: 0 });
    renderLineRows();
  }

  function removeLine(rowId) {
    formLines = formLines.filter((l) => l.rowId !== rowId);
    renderLineRows();
  }

  function syncLineFromRow(tr) {
    const rowId = tr.dataset.rowId;
    const line = formLines.find((l) => l.rowId === rowId);
    if (!line) return;
    line.itemId = tr.querySelector(".st-line-item").value;
    line.quantity = tr.querySelector(".st-line-qty").value;
  }

  function bindLineTable() {
    $("#stAddLineBtn").addEventListener("click", addLine);
    $("#stLineTableBody").addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".st-remove-line");
      if (!removeBtn) return;
      removeLine(removeBtn.closest("tr").dataset.rowId);
    });
    $("#stLineTableBody").addEventListener("change", (e) => {
      const tr = e.target.closest("tr");
      if (!tr) return;
      syncLineFromRow(tr);
      renderLineRows();
    });
    $("#stLineTableBody").addEventListener("input", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || !e.target.classList.contains("st-line-qty")) return;
      syncLineFromRow(tr);
      renderLineRows();
    });
    $("#stFormFromWarehouse").addEventListener("change", renderLineRows);
  }


  /* -----------------------------------------------------------------------
     ADD MODAL
     --------------------------------------------------------------------- */
  function populateWarehouseOptions(selectId) {
    const warehouses = ERP_WarehouseRepository.getAllForCompany(company.id).filter((w) => w.status === "Active");
    $(selectId).innerHTML = `<option value="">Select a warehouse</option>` + warehouses.map((w) => `<option value="${w.id}">${escapeHtml(w.warehouseName)}</option>`).join("");
  }

  function clearFormErrors() {
    ["stFormFromWarehouseError", "stFormToWarehouseError", "stFormLinesError"].forEach((id) => { $("#" + id).textContent = ""; });
  }

  function openAddModal() {
    formLines = [];
    rowCounter = 0;
    populateWarehouseOptions("#stFormFromWarehouse");
    populateWarehouseOptions("#stFormToWarehouse");
    $("#stFormFromWarehouse").value = "";
    $("#stFormToWarehouse").value = "";
    $("#stFormDate").value = new Date().toISOString().slice(0, 10);
    $("#stFormNotes").value = "";
    renderLineRows();
    clearFormErrors();
    openModal("stFormModal");
  }

  function buildLinePayload() {
    return formLines.filter((l) => l.itemId).map((l) => ({ id: l.rowId, itemId: l.itemId, quantity: Number(l.quantity) || 0 }));
  }

  function validateForm(lines) {
    let valid = true;
    clearFormErrors();
    const fromId = $("#stFormFromWarehouse").value;
    const toId = $("#stFormToWarehouse").value;
    if (!fromId) { $("#stFormFromWarehouseError").textContent = "Select a From warehouse."; valid = false; }
    if (!toId) { $("#stFormToWarehouseError").textContent = "Select a To warehouse."; valid = false; }
    if (fromId && toId && fromId === toId) { $("#stFormToWarehouseError").textContent = "From and To must be different warehouses."; valid = false; }
    if (lines.length === 0) { $("#stFormLinesError").textContent = "Add at least one item."; valid = false; }
    else if (!lines.every((l) => ERP_StockTransferRepository.isLineValid(l))) { $("#stFormLinesError").textContent = "Every line needs an item and a quantity greater than zero."; valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#stAddBtn").addEventListener("click", openAddModal);
    $("#stFormSaveBtn").addEventListener("click", () => {
      const lines = buildLinePayload();
      if (!validateForm(lines)) return;
      const payload = {
        fromWarehouseId: $("#stFormFromWarehouse").value,
        toWarehouseId: $("#stFormToWarehouse").value,
        transferDate: $("#stFormDate").value || new Date().toISOString().slice(0, 10),
        notes: $("#stFormNotes").value.trim(),
        lineItems: lines
      };
      const created = ERP_StockTransferRepository.create(company, payload, session.username);
      logSystemActivity({ module: "Stock Transfer", action: "Create", description: `Created stock transfer "${created.transferNumber}" for ${company.name}` });
      closeModal("stFormModal");
      renderAll();
      renderActivity();
      showToast("Stock transfer saved as Draft — complete it to update the Stock Ledger.", "success");
    });
    bindLineTable();
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function renderDetailFooter(record) {
    const footer = $("#stDetailFooter");
    footer.innerHTML = "";
    if (record.status === "Draft") {
      const completeBtn = document.createElement("button");
      completeBtn.type = "button";
      completeBtn.className = "btn btn--primary";
      completeBtn.textContent = "Complete (updates Stock Ledger)";
      completeBtn.disabled = !ERP_StockTransferRepository.canComplete(company.id, record);
      completeBtn.addEventListener("click", () => requestComplete(record));
      footer.appendChild(completeBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn--ghost";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => requestCancel(record));
      footer.appendChild(cancelBtn);
    }
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn btn--ghost";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => closeModal("stDetailModal"));
    footer.appendChild(closeBtn);
  }

  function openDetailModal(record) {
    const shortfall = record.status === "Draft" ? ERP_StockTransferRepository.getShortfallLines(company.id, record) : [];
    $("#stDetailTitle").textContent = `Stock Transfer — ${record.transferNumber}`;
    $("#stDetailBody").innerHTML = `
      <div><dt>Transfer #</dt><dd><code>${escapeHtml(record.transferNumber)}</code></dd></div>
      <div><dt>From Warehouse</dt><dd>${escapeHtml(warehouseLabel(record.fromWarehouseId))}</dd></div>
      <div><dt>To Warehouse</dt><dd>${escapeHtml(warehouseLabel(record.toWarehouseId))}</dd></div>
      <div><dt>Date</dt><dd>${record.transferDate || "—"}</dd></div>
      <div><dt>Notes</dt><dd>${record.notes ? escapeHtml(record.notes) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(record.status)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(record.createdAt))} by ${escapeHtml(record.createdByUsername)}</dd></div>
      ${record.status === "Completed" ? `<div><dt>Completed</dt><dd>${formatDateTime(new Date(record.completedAt))} by ${escapeHtml(record.completedByUsername)}</dd></div>` : ""}
      ${record.status === "Completed" && record.skippedLineCount ? `<div><dt>Skipped Lines</dt><dd>${record.skippedLineCount} line(s) had insufficient stock at the time and were not moved</dd></div>` : ""}
      ${shortfall.length ? `<div><dt>Warning</dt><dd>${shortfall.length} line(s) currently exceed what's available in the From warehouse — completing now will skip them.</dd></div>` : ""}
    `;
    $("#stDetailLineTableBody").innerHTML = (record.lineItems || []).map((l) => `
      <tr>
        <td>${escapeHtml(itemLabel(l.itemId))}</td>
        <td class="text-right">${formatQty(l.quantity)}</td>
      </tr>
    `).join("");
    renderDetailFooter(record);
    openModal("stDetailModal");
  }

  function requestComplete(record) {
    if (!ERP_StockTransferRepository.canComplete(company.id, record)) return;
    openConfirm({
      title: "Complete this stock transfer?",
      message: "This writes a matched Transfer Out / Transfer In pair to the Stock Ledger for every line that has enough stock, and locks the transfer for good.",
      confirmLabel: "Complete",
      onConfirm: () => {
        const updated = ERP_StockTransferRepository.complete(record.id, company, session.username);
        if (updated) {
          logSystemActivity({ module: "Stock Transfer", action: "Complete", description: `Completed stock transfer "${record.transferNumber}" (${company.name})` });
          closeModal("stDetailModal");
          renderAll();
          renderActivity();
          const skipNote = updated.skippedLineCount ? ` (${updated.skippedLineCount} line${updated.skippedLineCount === 1 ? "" : "s"} skipped — insufficient stock)` : "";
          showToast(`Transfer completed${skipNote}.`, "success");
        }
      }
    });
  }

  function requestCancel(record) {
    openConfirm({
      title: "Cancel this draft?",
      message: "This draft was never completed, so nothing has been written to the Stock Ledger — cancelling is safe.",
      confirmLabel: "Cancel Transfer",
      onConfirm: () => {
        ERP_StockTransferRepository.cancel(record.id, session.username);
        logSystemActivity({ module: "Stock Transfer", action: "Cancel", description: `Cancelled stock transfer "${record.transferNumber}" (${company.name})` });
        closeModal("stDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#stTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const record = ERP_StockTransferRepository.findById(viewBtn.dataset.id);
      if (record) openDetailModal(record);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "stock-transfer")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading stock transfers…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#stContent").hidden = true;
      $("#stSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#stContent").hidden = false;
      $("#stHeaderActions").hidden = false;
      $("#stSubtitle").textContent = `Managing stock transfers for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
