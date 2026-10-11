/* =============================================================================
   DOT ERP — pages/stock-adjustment.js
   Phase 7, Module 03: Stock Adjustment

   Live add/remove line table, the same delegated-event shape journal-
   entry.js established first (rows re-rendered on every change, one
   tbody-level listener rather than per-row listeners that would need
   rebinding). systemQuantity is captured from the LIVE Stock Ledger
   balance the moment an item is picked on a line, using whichever
   warehouse the header currently has selected — see data/stock-
   adjustment-data.js's own header for why that snapshot is never
   re-derived later. Unit Cost only appears on a line once its own
   adjustment quantity is positive (a surplus) — toggled live, not just
   validated at submit time, so the form itself teaches the same "surplus
   needs a cost, shortage doesn't" rule the data layer enforces.
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

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function itemLabel(id) { const i = ERP_ItemRepository.findById(id); return i ? i.itemName : "Unknown item"; }
  function warehouseLabel(id) { const w = ERP_WarehouseRepository.findById(id); return w ? w.warehouseName : "Unknown warehouse"; }
  function statusBadge(status) {
    const tone = status === "Posted" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY / LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_StockAdjustmentRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    return rows;
  }

  function adjustmentValue(record) {
    if (record.status !== "Posted") return 0;
    return (record.lineItems || []).reduce((sum, l) => {
      const adjQty = ERP_StockAdjustmentRepository.computeAdjustmentQuantity(l);
      if (adjQty <= 0) return sum; // shortages consume existing value, not counted as "adjusted value" here
      return sum + adjQty * (Number(l.unitCost) || 0);
    }, 0);
  }

  function renderSummary() {
    const all = ERP_StockAdjustmentRepository.getAllForCompany(company.id);
    $("#saSummaryTotal").textContent = String(all.length);
    $("#saSummaryPosted").textContent = String(all.filter((r) => r.status === "Posted").length);
    $("#saSummaryDraft").textContent = String(all.filter((r) => r.status === "Draft").length);
    const netValue = all.reduce((sum, r) => sum + adjustmentValue(r), 0);
    $("#saSummaryValue").textContent = formatMoney(netValue);
  }

  function renderPagination(totalPages) {
    const container = $("#saPagination");
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

    $("#saEmptyState").hidden = all.length !== 0;
    $("#saTable").hidden = all.length === 0;

    $("#saTableBody").innerHTML = pageItems.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.adjustmentNumber)}</code></td>
        <td>${escapeHtml(warehouseLabel(r.warehouseId))}</td>
        <td>${escapeHtml(r.reason || "—")}</td>
        <td class="text-right">${(r.lineItems || []).length}</td>
        <td>${r.adjustmentDate || "—"}</td>
        <td>${statusBadge(r.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">View</button></td>
      </tr>
    `).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#saStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#saStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#saExportCsvBtn").addEventListener("click", exportCsv);
    $("#saPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Adjustment #", "Warehouse", "Reason", "Lines", "Date", "Status"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([r.adjustmentNumber, `"${warehouseLabel(r.warehouseId)}"`, `"${r.reason}"`, (r.lineItems || []).length, r.adjustmentDate, r.status].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `stock-adjustments-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Stock Adjustment")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#saActivityEmptyState").hidden = relevant.length !== 0;
    $("#saActivityList").innerHTML = relevant.map((e) => `
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

  function renderLineRows() {
    const warehouseId = $("#saFormWarehouse").value;
    $("#saLineTableBody").innerHTML = formLines.map((line) => {
      const adjQty = (Number(line.countedQuantity) || 0) - (Number(line.systemQuantity) || 0);
      const needsCost = adjQty > 0;
      return `
      <tr data-row-id="${line.rowId}">
        <td><select class="select-field sa-line-item">${itemOptionsHtml(line.itemId)}</select></td>
        <td class="text-right sa-line-system">${line.itemId && warehouseId ? formatQty(line.systemQuantity) : "—"}</td>
        <td><div class="input-wrap"><input type="number" class="sa-line-counted" min="0" step="0.01" value="${line.countedQuantity}" /></div></td>
        <td class="text-right ${adjQty < 0 ? "je-balance-off" : adjQty > 0 ? "je-balance-ok" : ""}">${adjQty > 0 ? "+" : ""}${formatQty(adjQty)}</td>
        <td>${needsCost ? `<div class="input-wrap"><input type="number" class="sa-line-cost" min="0" step="0.01" placeholder="Required" title="Defaults to this item's current average cost in the selected warehouse — change it if the found stock was worth a different amount." value="${line.unitCost || ""}" /></div>` : `<span class="profile-subtle">Not needed</span>`}</td>
        <td><button type="button" class="link-btn sa-remove-line">Remove</button></td>
      </tr>`;
    }).join("");
  }

  function addLine() {
    rowCounter += 1;
    formLines.push({ rowId: "row-" + rowCounter, itemId: "", systemQuantity: 0, countedQuantity: 0, unitCost: "" });
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
    const newItemId = tr.querySelector(".sa-line-item").value;
    if (newItemId !== line.itemId) {
      line.itemId = newItemId;
      const warehouseId = $("#saFormWarehouse").value;
      line.systemQuantity = (newItemId && warehouseId && typeof ERP_StockLedgerRepository !== "undefined")
        ? ERP_StockLedgerRepository.getBalance(company.id, newItemId, warehouseId)
        : 0;
    }
    line.countedQuantity = tr.querySelector(".sa-line-counted").value;
    const costInput = tr.querySelector(".sa-line-cost");
    if (costInput) line.unitCost = costInput.value;

    // A surplus line needs a cost, and the usual real-world basis for
    // found stock is what that item currently averages in this warehouse
    // — so derive it live instead of leaving a blank field for someone
    // to type a number that can drift from the Stock Ledger. Only fills
    // a BLANK field (never overwrites what was typed), stays editable,
    // and stays blank when the item has no valued stock to average.
    const adjQty = (Number(line.countedQuantity) || 0) - (Number(line.systemQuantity) || 0);
    const warehouseId = $("#saFormWarehouse").value;
    if (adjQty > 0 && (line.unitCost === "" || line.unitCost == null) && line.itemId && warehouseId
        && typeof ERP_StockValuationRepository !== "undefined") {
      const wac = ERP_StockValuationRepository.getWeightedAverageCost(company.id, line.itemId, warehouseId);
      if (wac != null && !isNaN(Number(wac)) && Number(wac) > 0) line.unitCost = String(Math.round(Number(wac) * 100) / 100);
    }
  }

  function bindLineTable() {
    $("#saAddLineBtn").addEventListener("click", addLine);
    $("#saLineTableBody").addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".sa-remove-line");
      if (!removeBtn) return;
      removeLine(removeBtn.closest("tr").dataset.rowId);
    });
    $("#saLineTableBody").addEventListener("change", (e) => {
      const tr = e.target.closest("tr");
      if (!tr) return;
      syncLineFromRow(tr);
      renderLineRows();
    });
    $("#saLineTableBody").addEventListener("input", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || !e.target.classList.contains("sa-line-counted")) return;
      syncLineFromRow(tr);
      renderLineRows();
    });
    $("#saFormWarehouse").addEventListener("change", () => {
      // Re-snapshot every line's system quantity against the newly
      // chosen warehouse — the form hasn't been saved yet, so this is
      // still "picking," not rewriting settled history.
      const warehouseId = $("#saFormWarehouse").value;
      formLines.forEach((line) => {
        line.systemQuantity = (line.itemId && warehouseId && typeof ERP_StockLedgerRepository !== "undefined")
          ? ERP_StockLedgerRepository.getBalance(company.id, line.itemId, warehouseId)
          : 0;
      });
      renderLineRows();
    });
  }


  /* -----------------------------------------------------------------------
     ADD MODAL
     --------------------------------------------------------------------- */
  function populateWarehouseOptions() {
    const warehouses = ERP_WarehouseRepository.getAllForCompany(company.id).filter((w) => w.status === "Active");
    $("#saFormWarehouse").innerHTML = `<option value="">Select a warehouse</option>` + warehouses.map((w) => `<option value="${w.id}">${escapeHtml(w.warehouseName)}</option>`).join("");
  }
  function populateReasonOptions() {
    $("#saFormReason").innerHTML = `<option value="">Select a reason</option>` + ERP_StockAdjustmentRepository.reasons.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
  }

  function clearFormErrors() {
    ["saFormWarehouseError", "saFormReasonError", "saFormLinesError"].forEach((id) => { $("#" + id).textContent = ""; });
  }

  function openAddModal() {
    formLines = [];
    rowCounter = 0;
    $("#saFormIntro").textContent = "This saves as a Draft — you can edit it freely. Posting is a separate step from the detail view.";
    populateWarehouseOptions();
    populateReasonOptions();
    $("#saFormWarehouse").value = "";
    $("#saFormReason").value = "";
    $("#saFormDate").value = new Date().toISOString().slice(0, 10);
    $("#saFormNotes").value = "";
    renderLineRows();
    clearFormErrors();
    openModal("saFormModal");
  }

  function buildLinePayload() {
    return formLines
      .filter((l) => l.itemId)
      .map((l) => ({ id: l.rowId, itemId: l.itemId, systemQuantity: Number(l.systemQuantity) || 0, countedQuantity: Number(l.countedQuantity) || 0, unitCost: l.unitCost === "" ? null : Number(l.unitCost) }));
  }

  function validateForm(lines) {
    let valid = true;
    clearFormErrors();
    if (!$("#saFormWarehouse").value) { $("#saFormWarehouseError").textContent = "Select a warehouse."; valid = false; }
    if (!$("#saFormReason").value) { $("#saFormReasonError").textContent = "Select a reason."; valid = false; }
    if (lines.length === 0) { $("#saFormLinesError").textContent = "Add at least one item."; valid = false; }
    else if (!lines.every((l) => ERP_StockAdjustmentRepository.isLineValid(l))) {
      $("#saFormLinesError").textContent = "Every surplus line (counted above system) needs a unit cost greater than zero.";
      valid = false;
    }
    return valid;
  }

  function bindFormModal() {
    $("#saAddBtn").addEventListener("click", openAddModal);
    $("#saFormSaveBtn").addEventListener("click", () => {
      const lines = buildLinePayload();
      if (!validateForm(lines)) return;
      const payload = {
        warehouseId: $("#saFormWarehouse").value,
        reason: $("#saFormReason").value,
        adjustmentDate: $("#saFormDate").value || new Date().toISOString().slice(0, 10),
        notes: $("#saFormNotes").value.trim(),
        lineItems: lines
      };
      const created = ERP_StockAdjustmentRepository.create(company, payload, session.username);
      logSystemActivity({ module: "Stock Adjustment", action: "Create", description: `Created stock adjustment "${created.adjustmentNumber}" for ${company.name}` });
      closeModal("saFormModal");
      renderAll();
      renderActivity();
      showToast("Stock adjustment saved as Draft — post it to update the Stock Ledger.", "success");
    });
    bindLineTable();
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function renderDetailFooter(record) {
    const footer = $("#saDetailFooter");
    footer.innerHTML = "";
    if (record.status === "Draft") {
      const postBtn = document.createElement("button");
      postBtn.type = "button";
      postBtn.className = "btn btn--primary";
      postBtn.textContent = "Post (updates Stock Ledger)";
      postBtn.disabled = !ERP_StockAdjustmentRepository.canPost(record);
      postBtn.addEventListener("click", () => requestPost(record));
      footer.appendChild(postBtn);

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
    closeBtn.addEventListener("click", () => closeModal("saDetailModal"));
    footer.appendChild(closeBtn);
  }

  function openDetailModal(record) {
    $("#saDetailTitle").textContent = `Stock Adjustment — ${record.adjustmentNumber}`;
    $("#saDetailBody").innerHTML = `
      <div><dt>Adjustment #</dt><dd><code>${escapeHtml(record.adjustmentNumber)}</code></dd></div>
      <div><dt>Warehouse</dt><dd>${escapeHtml(warehouseLabel(record.warehouseId))}</dd></div>
      <div><dt>Reason</dt><dd>${escapeHtml(record.reason || "—")}</dd></div>
      <div><dt>Date</dt><dd>${record.adjustmentDate || "—"}</dd></div>
      <div><dt>Notes</dt><dd>${record.notes ? escapeHtml(record.notes) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(record.status)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(record.createdAt))} by ${escapeHtml(record.createdByUsername)}</dd></div>
      ${record.status === "Posted" ? `<div><dt>Posted</dt><dd>${formatDateTime(new Date(record.postedAt))} by ${escapeHtml(record.postedByUsername)}</dd></div>` : ""}
    `;
    $("#saDetailLineTableBody").innerHTML = (record.lineItems || []).map((l) => {
      const adjQty = ERP_StockAdjustmentRepository.computeAdjustmentQuantity(l);
      return `
      <tr>
        <td>${escapeHtml(itemLabel(l.itemId))}</td>
        <td class="text-right">${formatQty(l.systemQuantity)}</td>
        <td class="text-right">${formatQty(l.countedQuantity)}</td>
        <td class="text-right ${adjQty < 0 ? "je-balance-off" : adjQty > 0 ? "je-balance-ok" : ""}">${adjQty > 0 ? "+" : ""}${formatQty(adjQty)}</td>
        <td class="text-right">${adjQty > 0 ? formatMoney(l.unitCost) : "—"}</td>
      </tr>`;
    }).join("");
    renderDetailFooter(record);
    openModal("saDetailModal");
  }

  function requestPost(record) {
    if (!ERP_StockAdjustmentRepository.canPost(record)) return;
    openConfirm({
      title: "Post this stock adjustment?",
      message: "This writes one Stock Ledger entry per line that actually moved and locks the adjustment for good. There's no un-posting — a later disagreement needs its own new adjustment.",
      confirmLabel: "Post",
      onConfirm: () => {
        const result = ERP_StockAdjustmentRepository.post(record.id, company, session.username);
        if (result.success) {
          const updated = result.record;
          logSystemActivity({ module: "Stock Adjustment", action: "Post", description: `Posted stock adjustment "${record.adjustmentNumber}" (${company.name})` });

          // Books the shrinkage/surplus net to the General Ledger, at the
          // FIFO cost worked out per shrinkage line above — see
          // gl-posting-data.js's own postStockAdjustment().
          if (typeof ERP_GlPostingRepository !== "undefined" && result.costedLines && result.costedLines.length) {
            const glResult = ERP_GlPostingRepository.postStockAdjustment(company, updated, result.costedLines, session.username);
            if (glResult.success && !glResult.skipped) {
              logSystemActivity({ module: "Stock Adjustment", action: "Auto-Post", description: `Posted stock adjustment variance for "${record.adjustmentNumber}" (${company.name})` });
            } else if (!glResult.success) {
              showToast(glResult.reason, "warning", { title: "Not posted to the books" });
            }
          }

          closeModal("saDetailModal");
          renderAll();
          renderActivity();
          showToast(`Posted ${updated.linkedStockLedgerEntryIds.length} Stock Ledger entr${updated.linkedStockLedgerEntryIds.length === 1 ? "y" : "ies"}.`, "success");
        } else {
          showToast(result.reason, "warning");
        }
      }
    });
  }

  function requestCancel(record) {
    openConfirm({
      title: "Cancel this draft?",
      message: "This draft was never posted, so nothing has been written to the Stock Ledger — cancelling is safe.",
      confirmLabel: "Cancel Adjustment",
      onConfirm: () => {
        ERP_StockAdjustmentRepository.cancel(record.id, session.username);
        logSystemActivity({ module: "Stock Adjustment", action: "Cancel", description: `Cancelled stock adjustment "${record.adjustmentNumber}" (${company.name})` });
        closeModal("saDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#saTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const record = ERP_StockAdjustmentRepository.findById(viewBtn.dataset.id);
      if (record) openDetailModal(record);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "stock-adjustment")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading stock adjustments…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#saContent").hidden = true;
      $("#saSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#saContent").hidden = false;
      $("#saHeaderActions").hidden = false;
      $("#saSubtitle").textContent = `Managing stock adjustments for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
