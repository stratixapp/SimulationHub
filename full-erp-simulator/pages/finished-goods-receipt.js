/* =============================================================================
   DOT ERP — pages/finished-goods-receipt.js
   Phase 10, Module 04: Finished Goods Receipt

   Header-only form — no line table at all, since a receipt always has
   exactly one output item (the linked Work Order's own finished item).
   The cost-per-unit preview calls the exact same allocation math the
   repository's own post() uses, so what's shown before saving matches
   what actually posts.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity, actorLabel
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let filterStatus = "all";
  let page = 1;
  let selectedWorkOrder = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function itemLabel(id) { const i = id ? ERP_ItemRepository.findById(id) : null; return i ? i.itemName : "Unknown item"; }
  function warehouseLabel(id) { const w = ERP_WarehouseRepository.findById(id); return w ? w.warehouseName : "Unknown warehouse"; }
  function woLabel(id) { const w = ERP_WorkOrderRepository.findById(id); return w ? w.workOrderCode : "Unknown work order"; }
  function statusBadge(status) {
    const tone = status === "Received" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }

  function inProgressWorkOrders() {
    return ERP_WorkOrderRepository.getInProgressForCompany(company.id);
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY / LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_FinishedGoodsReceiptRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    const btn = $("#fgrSortBtn");
    if (btn && btn.dataset.order === "asc") rows = [...rows].reverse();
    return rows;
  }

  function renderSummary() {
    const all = ERP_FinishedGoodsReceiptRepository.getAllForCompany(company.id);
    $("#fgrSummaryTotal").textContent = String(all.length);
    $("#fgrSummaryDraft").textContent = String(all.filter((r) => r.status === "Draft").length);
    $("#fgrSummaryReceived").textContent = String(all.filter((r) => r.status === "Received").length);
    $("#fgrSummaryCancelled").textContent = String(all.filter((r) => r.status === "Cancelled").length);
  }

  function renderPagination(totalPages) {
    const container = $("#fgrPagination");
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

    $("#fgrEmptyState").hidden = all.length !== 0;
    $("#fgrTable").hidden = all.length === 0;

    $("#fgrTableBody").innerHTML = pageItems.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.receiptCode)}</code></td>
        <td>${escapeHtml(woLabel(r.workOrderId))}</td>
        <td>${escapeHtml(itemLabel(r.finishedItemId))}</td>
        <td class="text-right">${formatQty(r.quantityProduced)}</td>
        <td class="text-right">${r.status === "Received" ? formatMoney(r.totalCostCaptured) : "—"}</td>
        <td>${r.receiptDate || "—"}</td>
        <td>${statusBadge(r.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">View</button></td>
      </tr>`).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#fgrStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#fgrStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#fgrSortBtn").addEventListener("click", () => {
      const btn = $("#fgrSortBtn");
      const asc = btn.dataset.order === "asc";
      btn.dataset.order = asc ? "desc" : "asc";
      btn.textContent = asc ? "Newest First" : "Oldest First";
      renderTable();
    });
    $("#fgrExportCsvBtn").addEventListener("click", exportCsv);
    $("#fgrPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["FGR Code", "Work Order", "Finished Item", "Qty Produced", "Total Cost", "Receipt Date", "Status"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([r.receiptCode, woLabel(r.workOrderId), `"${itemLabel(r.finishedItemId)}"`, r.quantityProduced, r.status === "Received" ? r.totalCostCaptured.toFixed(2) : "", r.receiptDate || "", r.status].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `finished-goods-receipts-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Finished Goods Receipt")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#fgrActivityEmptyState").hidden = relevant.length !== 0;
    $("#fgrActivityList").innerHTML = relevant.map((e) => `
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
  function populateWorkOrderOptions(selectedId) {
    const wos = inProgressWorkOrders();
    $("#fgrFormWorkOrder").innerHTML = `<option value="">Select an In Progress Work Order…</option>` +
      wos.map((w) => `<option value="${w.id}"${w.id === selectedId ? " selected" : ""}>${escapeHtml(w.workOrderCode)}</option>`).join("");
  }

  function populateReceivedByOptions() {
    const employees = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status === "Active");
    $("#fgrFormReceivedBy").innerHTML = `<option value="">Not specified</option>` +
      employees.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)}</option>`).join("");
  }

  function updateCostPreview() {
    if (!selectedWorkOrder) { $("#fgrFormCostPreview").textContent = ""; return; }
    const qty = Number($("#fgrFormQuantity").value) || 0;
    const unitCost = ERP_FinishedGoodsReceiptRepository.previewCostPerUnit(selectedWorkOrder);
    $("#fgrFormCostPreview").textContent = `Estimated cost to capitalize: ${formatMoney(unitCost)} / unit × ${formatQty(qty)} = ${formatMoney(unitCost * qty)} (computed from real, posted Work-in-Progress — see the training guide for the allocation logic).`;
  }

  function onWorkOrderPicked() {
    const woId = $("#fgrFormWorkOrder").value;
    selectedWorkOrder = woId ? ERP_WorkOrderRepository.findById(woId) : null;
    if (!selectedWorkOrder) {
      $("#fgrFormWorkOrderInfo").textContent = "";
      $("#fgrFormQuantity").value = "";
      updateCostPreview();
      return;
    }
    const bom = ERP_BomRepository.findById(selectedWorkOrder.bomId);
    $("#fgrFormWorkOrderInfo").textContent = bom
      ? `Producing ${escapeHtml(itemLabel(bom.finishedItemId))}, planned quantity ${formatQty(selectedWorkOrder.plannedQuantity)}.`
      : "";
    $("#fgrFormQuantity").value = ERP_FinishedGoodsReceiptRepository.suggestedQuantity(selectedWorkOrder);
    updateCostPreview();
  }

  function clearFormErrors() {
    ["fgrFormWorkOrderError", "fgrFormQuantityError"].forEach((id) => { $("#" + id).textContent = ""; });
  }

  function openAddModal() {
    if (inProgressWorkOrders().length === 0) {
      showToast("No In Progress work orders yet — start one first.", "warning");
      return;
    }
    selectedWorkOrder = null;
    $("#fgrFormIntro").textContent = "This saves as a Draft — post it once the quantity is right.";
    populateWorkOrderOptions("");
    populateReceivedByOptions();
    $("#fgrFormQuantity").value = "";
    $("#fgrFormReceiptDate").value = new Date().toISOString().slice(0, 10);
    $("#fgrFormRemarks").value = "";
    updateCostPreview();
    clearFormErrors();
    openModal("fgrFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!selectedWorkOrder) { $("#fgrFormWorkOrderError").textContent = "Select a Work Order."; valid = false; }
    if (!(Number($("#fgrFormQuantity").value) > 0)) { $("#fgrFormQuantityError").textContent = "Quantity produced must be greater than zero."; valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#fgrAddBtn").addEventListener("click", openAddModal);
    $("#fgrFormWorkOrder").addEventListener("change", onWorkOrderPicked);
    $("#fgrFormQuantity").addEventListener("input", updateCostPreview);
    $("#fgrFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const payload = {
        quantityProduced: Number($("#fgrFormQuantity").value) || 0,
        receiptDate: $("#fgrFormReceiptDate").value || new Date().toISOString().slice(0, 10),
        receivedByEmployeeId: $("#fgrFormReceivedBy").value || null,
        remarks: $("#fgrFormRemarks").value.trim()
      };
      const created = ERP_FinishedGoodsReceiptRepository.create(company, selectedWorkOrder, payload, session.username);
      logSystemActivity({ module: "Finished Goods Receipt", action: "Create", description: `Created finished goods receipt "${created.receiptCode}" for ${company.name}` });
      closeModal("fgrFormModal");
      renderAll();
      renderActivity();
      showToast("Finished goods receipt saved as Draft — post it to update the Stock Ledger.", "success");
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function renderDetailFooter(record) {
    const footer = $("#fgrDetailFooter");
    footer.innerHTML = "";
    if (record.status === "Draft") {
      const postBtn = document.createElement("button");
      postBtn.type = "button";
      postBtn.className = "btn btn--primary";
      postBtn.textContent = "Post (receives stock)";
      postBtn.disabled = !ERP_FinishedGoodsReceiptRepository.canPost(record);
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
    closeBtn.addEventListener("click", () => closeModal("fgrDetailModal"));
    footer.appendChild(closeBtn);
  }

  function openDetailModal(record) {
    const receivedBy = record.receivedByEmployeeId ? ERP_EmployeeRepository.findById(record.receivedByEmployeeId) : null;
    $("#fgrDetailTitle").textContent = `Finished Goods Receipt — ${record.receiptCode}`;
    $("#fgrDetailBody").innerHTML = `
      <div><dt>FGR Code</dt><dd><code>${escapeHtml(record.receiptCode)}</code></dd></div>
      <div><dt>Work Order</dt><dd>${escapeHtml(woLabel(record.workOrderId))}</dd></div>
      <div><dt>Finished Item</dt><dd>${escapeHtml(itemLabel(record.finishedItemId))}</dd></div>
      <div><dt>Warehouse</dt><dd>${escapeHtml(warehouseLabel(record.warehouseId))}</dd></div>
      <div><dt>Quantity Produced</dt><dd>${formatQty(record.quantityProduced)}</dd></div>
      ${record.status === "Received" ? `<div><dt>Cost per Unit</dt><dd>${formatMoney(record.unitCostCaptured)}</dd></div><div><dt>Total Cost Capitalized</dt><dd>${formatMoney(record.totalCostCaptured)}</dd></div>` : ""}
      <div><dt>Receipt Date</dt><dd>${record.receiptDate || "—"}</dd></div>
      <div><dt>Received By</dt><dd>${receivedBy ? escapeHtml(receivedBy.fullName) : "<span class=\"profile-subtle\">Not specified</span>"}</dd></div>
      <div><dt>Remarks</dt><dd>${record.remarks ? escapeHtml(record.remarks) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(record.status)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(record.createdAt))} by ${escapeHtml(actorLabel(record.createdByUsername))}</dd></div>
      ${record.status === "Received" ? `<div><dt>Posted</dt><dd>${formatDateTime(new Date(record.postedAt))} by ${escapeHtml(actorLabel(record.postedByUsername))}</dd></div>` : ""}
    `;
    renderDetailFooter(record);
    openModal("fgrDetailModal");
  }

  function requestPost(record) {
    if (!ERP_FinishedGoodsReceiptRepository.canPost(record)) return;
    openConfirm({
      title: "Post this finished goods receipt?",
      message: "This writes one Stock Ledger entry for the finished item and locks the receipt for good. There's no un-posting — a correction needs its own separate document.",
      confirmLabel: "Post",
      onConfirm: () => {
        const result = ERP_FinishedGoodsReceiptRepository.post(record.id, company, session.username);
        if (result.success) {
          logSystemActivity({ module: "Finished Goods Receipt", action: "Post", description: `Posted finished goods receipt "${result.record.receiptCode}" (${company.name})` });

          // Auto-post to the General Ledger (Phase 10 retrofit pass) — see
          // data/gl-posting-data.js's own header. Typeof-guarded since not
          // every page loads the GL posting layer.
          if (typeof ERP_GlPostingRepository !== "undefined") {
            const glResult = ERP_GlPostingRepository.postFinishedGoodsReceipt(company, result.record, session.username);
            if (glResult.success) {
              logSystemActivity({ module: "Finished Goods Receipt", action: "Auto-Post", description: `Auto-posted journal entry ${glResult.entry.entryNumber} for finished goods receipt "${result.record.receiptCode}" (${company.name})` });
            } else {
              showToast(glResult.reason, "warning", { title: "Not posted to the books" });
            }
          }

          closeModal("fgrDetailModal");
          renderAll();
          renderActivity();
          showToast(`Received ${formatQty(result.record.quantityProduced)} unit(s) into stock.`, "success");
        } else {
          showToast(result.reason || "Couldn't post this receipt.", "danger");
        }
      }
    });
  }

  function requestCancel(record) {
    openConfirm({
      title: "Cancel this draft?",
      message: "This draft was never posted, so nothing has been written to the Stock Ledger — cancelling is safe.",
      confirmLabel: "Cancel Receipt",
      onConfirm: () => {
        ERP_FinishedGoodsReceiptRepository.cancel(record.id, session.username);
        logSystemActivity({ module: "Finished Goods Receipt", action: "Cancel", description: `Cancelled finished goods receipt "${record.receiptCode}" (${company.name})` });
        closeModal("fgrDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#fgrTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const record = ERP_FinishedGoodsReceiptRepository.findById(viewBtn.dataset.id);
      if (record) openDetailModal(record);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "finished-goods-receipt")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading finished goods receipts…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#fgrContent").hidden = true;
      $("#fgrSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#fgrContent").hidden = false;
      $("#fgrHeaderActions").hidden = false;
      $("#fgrSubtitle").textContent = `Managing finished goods receipts for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
