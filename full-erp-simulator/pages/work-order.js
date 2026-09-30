/* =============================================================================
   DOT ERP — pages/work-order.js
   Phase 10, Module 02: Work Order / Production Order

   No line-item table of its own — a Work Order's "lines" are its linked
   BOM's own components, shown read-only via the completion checklist.
   The detail view is a hub (the same PO precedent — CONTINUE_HERE.md
   Section 9): it lists Material Issues and Finished Goods Receipts
   raised against this order without either module chaining through the
   other.
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
  let editingId = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function itemLabel(id) { const i = ERP_ItemRepository.findById(id); return i ? i.itemName : "Unknown item"; }
  function warehouseLabel(id) { const w = ERP_WarehouseRepository.findById(id); return w ? w.warehouseName : "Unknown warehouse"; }
  function bomFinishedItemId(bomId) { const b = ERP_BomRepository.findById(bomId); return b ? b.finishedItemId : null; }
  function statusBadge(status) {
    const tone = status === "Completed" ? "success" : status === "Cancelled" ? "danger" : status === "In Progress" ? "info" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY / LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_WorkOrderRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    const btn = $("#woSortBtn");
    if (btn && btn.dataset.order === "asc") rows = [...rows].reverse();
    return rows;
  }

  function renderSummary() {
    const all = ERP_WorkOrderRepository.getAllForCompany(company.id);
    $("#woSummaryTotal").textContent = String(all.length);
    $("#woSummaryPlanned").textContent = String(all.filter((r) => r.status === "Planned").length);
    $("#woSummaryInProgress").textContent = String(all.filter((r) => r.status === "In Progress").length);
    $("#woSummaryCompleted").textContent = String(all.filter((r) => r.status === "Completed").length);
  }

  function renderPagination(totalPages) {
    const container = $("#woPagination");
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

    $("#woEmptyState").hidden = all.length !== 0;
    $("#woTable").hidden = all.length === 0;

    $("#woTableBody").innerHTML = pageItems.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.workOrderCode)}</code></td>
        <td>${escapeHtml(itemLabel(bomFinishedItemId(r.bomId)))}</td>
        <td class="text-right">${formatQty(r.plannedQuantity)}</td>
        <td class="text-right">${formatQty(ERP_WorkOrderRepository.getProducedQuantity(r.id))}</td>
        <td>${r.targetCompletionDate || "—"}</td>
        <td>${statusBadge(r.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">View</button></td>
      </tr>`).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#woStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#woStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#woSortBtn").addEventListener("click", () => {
      const btn = $("#woSortBtn");
      const asc = btn.dataset.order === "asc";
      btn.dataset.order = asc ? "desc" : "asc";
      btn.textContent = asc ? "Newest First" : "Oldest First";
      renderTable();
    });
    $("#woExportCsvBtn").addEventListener("click", exportCsv);
    $("#woPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["WO Code", "Finished Item", "Planned Qty", "Produced Qty", "Target Date", "Status"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([r.workOrderCode, `"${itemLabel(bomFinishedItemId(r.bomId))}"`, r.plannedQuantity, ERP_WorkOrderRepository.getProducedQuantity(r.id), r.targetCompletionDate || "", r.status].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `work-orders-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Work Order")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#woActivityEmptyState").hidden = relevant.length !== 0;
    $("#woActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT MODAL
     --------------------------------------------------------------------- */
  function activeBoms() {
    return ERP_BomRepository.getAllForCompany(company.id).filter((b) => b.status === "Active");
  }

  function populateBomOptions(selectedId) {
    const boms = activeBoms();
    $("#woFormBom").innerHTML = `<option value="">Select an Active BOM…</option>` +
      boms.map((b) => `<option value="${b.id}"${b.id === selectedId ? " selected" : ""}>${escapeHtml(b.bomCode)} — ${escapeHtml(itemLabel(b.finishedItemId))}</option>`).join("");
  }

  function populateWarehouseOptions(selectedId) {
    const warehouses = ERP_WarehouseRepository.getAllForCompany(company.id).filter((w) => w.status === "Active");
    $("#woFormWarehouse").innerHTML = `<option value="">Select a warehouse</option>` +
      warehouses.map((w) => `<option value="${w.id}"${w.id === selectedId ? " selected" : ""}>${escapeHtml(w.warehouseName)}</option>`).join("");
  }

  function updateBomInfo() {
    const bomId = $("#woFormBom").value;
    const bom = bomId ? ERP_BomRepository.findById(bomId) : null;
    $("#woFormBomInfo").textContent = bom
      ? `Produces ${escapeHtml(itemLabel(bom.finishedItemId))}, ${formatQty(bom.outputQuantity)} unit(s) per batch of this recipe.`
      : "";
  }

  function clearFormErrors() {
    ["woFormBomError", "woFormPlannedQtyError", "woFormWarehouseError"].forEach((id) => { $("#" + id).textContent = ""; });
  }

  function openAddModal() {
    editingId = null;
    $("#woFormTitle").textContent = "New Work Order";
    $("#woFormIntro").textContent = "Created as Planned — Start Production once you're ready to issue materials.";
    populateBomOptions("");
    $("#woFormBom").disabled = false;
    populateWarehouseOptions("");
    $("#woFormPlannedQty").value = "";
    $("#woFormTargetDate").value = "";
    $("#woFormRemarks").value = "";
    updateBomInfo();
    clearFormErrors();
    openModal("woFormModal");
  }

  function openEditModal(record) {
    editingId = record.id;
    $("#woFormTitle").textContent = `Edit ${record.workOrderCode}`;
    $("#woFormIntro").textContent = "Only a Planned order can be edited.";
    populateBomOptions(record.bomId);
    $("#woFormBom").disabled = true; // changing the recipe mid-plan would orphan the order's own intent
    populateWarehouseOptions(record.warehouseId);
    $("#woFormPlannedQty").value = record.plannedQuantity;
    $("#woFormTargetDate").value = record.targetCompletionDate || "";
    $("#woFormRemarks").value = record.remarks || "";
    updateBomInfo();
    clearFormErrors();
    openModal("woFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#woFormBom").value) { $("#woFormBomError").textContent = "Select an Active BOM."; valid = false; }
    if (!(Number($("#woFormPlannedQty").value) > 0)) { $("#woFormPlannedQtyError").textContent = "Planned quantity must be greater than zero."; valid = false; }
    if (!$("#woFormWarehouse").value) { $("#woFormWarehouseError").textContent = "Select a warehouse."; valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#woAddBtn").addEventListener("click", openAddModal);
    $("#woFormBom").addEventListener("change", updateBomInfo);
    $("#woFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const payload = {
        bomId: $("#woFormBom").value,
        plannedQuantity: Number($("#woFormPlannedQty").value) || 0,
        targetCompletionDate: $("#woFormTargetDate").value || null,
        warehouseId: $("#woFormWarehouse").value,
        remarks: $("#woFormRemarks").value.trim()
      };
      if (editingId) {
        const updated = ERP_WorkOrderRepository.update(editingId, payload, session.username);
        if (updated) {
          logSystemActivity({ module: "Work Order", action: "Update", description: `Updated work order "${updated.workOrderCode}" for ${company.name}` });
          showToast("Work order updated.", "success");
        }
      } else {
        const created = ERP_WorkOrderRepository.create(company, payload, session.username);
        logSystemActivity({ module: "Work Order", action: "Create", description: `Created work order "${created.workOrderCode}" for ${company.name}` });
        showToast("Work order created as Planned.", "success");
      }
      closeModal("woFormModal");
      renderAll();
      renderActivity();
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function renderRelatedLists(record) {
    const issues = typeof ERP_MaterialIssueRepository !== "undefined" ? ERP_MaterialIssueRepository.getAllForWorkOrder(record.id) : [];
    $("#woRelatedIssuesEmpty").hidden = issues.length !== 0;
    $("#woRelatedIssuesList").innerHTML = issues.map((m) => `
      <li class="activity-item">
        <div>
          <p class="activity-item__text"><code>${escapeHtml(m.materialIssueCode)}</code> — ${statusBadge2(m.status)} ${m.status === "Issued" ? formatMoney(m.totalMaterialCost) : ""}</p>
          <p class="activity-item__time">${m.issueDate || "—"}</p>
        </div>
      </li>`).join("");

    const receipts = typeof ERP_FinishedGoodsReceiptRepository !== "undefined" ? ERP_FinishedGoodsReceiptRepository.getAllForWorkOrder(record.id) : [];
    $("#woRelatedReceiptsEmpty").hidden = receipts.length !== 0;
    $("#woRelatedReceiptsList").innerHTML = receipts.map((r) => `
      <li class="activity-item">
        <div>
          <p class="activity-item__text"><code>${escapeHtml(r.receiptCode)}</code> — ${statusBadge2(r.status)} ${r.status === "Received" ? formatQty(r.quantityProduced) + " units, " + formatMoney(r.totalCostCaptured) : ""}</p>
          <p class="activity-item__time">${r.receiptDate || "—"}</p>
        </div>
      </li>`).join("");
  }
  function statusBadge2(status) {
    const tone = status === "Issued" || status === "Received" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }

  function renderChecklist(record) {
    const checklist = ERP_WorkOrderRepository.computeCompletionChecklist(company.id, record);
    $("#woChecklistTableBody").innerHTML = checklist.materialRows.map((row) => `
      <tr>
        <td>${escapeHtml(itemLabel(row.componentItemId))}</td>
        <td class="text-right">${formatQty(row.requiredQty)}</td>
        <td class="text-right">${formatQty(row.issuedQty)}</td>
        <td>${row.complete ? '<span class="status-badge status-badge--success">Fully Issued</span>' : '<span class="status-badge status-badge--warning">Outstanding</span>'}</td>
      </tr>`).join("");
    $("#woProgressLine").textContent = `Produced ${formatQty(checklist.producedQty)} of ${formatQty(checklist.plannedQty)} planned.`;
    $("#woWipLine").textContent = `Material issued: ${formatMoney(checklist.totalMaterialCostIssued)} · Capitalized to Finished Goods: ${formatMoney(checklist.totalCapitalizedCost)} · Remaining in WIP: ${formatMoney(Math.max(0, checklist.totalMaterialCostIssued - checklist.totalCapitalizedCost))}`;
  }

  function renderDetailFooter(record) {
    const footer = $("#woDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, onClick) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", onClick);
      footer.appendChild(btn);
    };
    if (record.status === "Planned") {
      addBtn("Edit", "btn btn--ghost", () => { closeModal("woDetailModal"); openEditModal(record); });
      addBtn("Start Production", "btn btn--primary", () => requestStart(record));
      addBtn("Cancel Order", "btn btn--danger-outline", () => requestCancel(record));
    } else if (record.status === "In Progress") {
      addBtn("Complete Production", "btn btn--primary", () => requestComplete(record));
      addBtn("Cancel Order", "btn btn--danger-outline", () => requestCancel(record));
    }
    addBtn("Close", "btn btn--ghost", () => closeModal("woDetailModal"));
  }

  function openDetailModal(record) {
    const bom = ERP_BomRepository.findById(record.bomId);
    $("#woDetailTitle").textContent = `Work Order — ${record.workOrderCode}`;
    $("#woDetailBody").innerHTML = `
      <div><dt>WO Code</dt><dd><code>${escapeHtml(record.workOrderCode)}</code></dd></div>
      <div><dt>BOM</dt><dd>${bom ? escapeHtml(bom.bomCode) : "—"}</dd></div>
      <div><dt>Finished Item</dt><dd>${escapeHtml(itemLabel(bomFinishedItemId(record.bomId)))}</dd></div>
      <div><dt>Planned Quantity</dt><dd>${formatQty(record.plannedQuantity)}</dd></div>
      <div><dt>Warehouse</dt><dd>${escapeHtml(warehouseLabel(record.warehouseId))}</dd></div>
      <div><dt>Target Completion</dt><dd>${record.targetCompletionDate || "—"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(record.status)}</dd></div>
      <div><dt>Remarks</dt><dd>${record.remarks ? escapeHtml(record.remarks) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(record.createdAt))} by ${escapeHtml(actorLabel(record.createdByUsername))}</dd></div>
    `;
    renderChecklist(record);
    renderRelatedLists(record);
    renderDetailFooter(record);
    openModal("woDetailModal");
  }

  function requestStart(record) {
    openConfirm({
      title: "Start production?",
      message: "This moves the order to In Progress, opening it up for Material Issue and Finished Goods Receipt.",
      confirmLabel: "Start Production",
      onConfirm: () => {
        const updated = ERP_WorkOrderRepository.start(record.id, session.username);
        if (updated) {
          logSystemActivity({ module: "Work Order", action: "Start", description: `Started work order "${updated.workOrderCode}" (${company.name})` });
          closeModal("woDetailModal");
          renderAll();
          renderActivity();
          showToast("Production started.", "success");
        }
      }
    });
  }

  function requestComplete(record) {
    const checklist = ERP_WorkOrderRepository.computeCompletionChecklist(company.id, record);
    const shortfall = checklist.producedQty < checklist.plannedQty;
    openConfirm({
      title: "Complete production?",
      message: shortfall
        ? `Produced ${checklist.producedQty} of ${checklist.plannedQty} planned — you can still complete with a shortfall if that's genuinely how the run ended.`
        : "This closes the order out. There's no reopening a Completed order.",
      confirmLabel: "Complete Production",
      onConfirm: () => {
        const updated = ERP_WorkOrderRepository.complete(record.id, session.username);
        if (updated) {
          logSystemActivity({ module: "Work Order", action: "Complete", description: `Completed work order "${updated.workOrderCode}" (${company.name})` });
          closeModal("woDetailModal");
          renderAll();
          renderActivity();
          showToast("Work order completed.", "success");
        }
      }
    });
  }

  function requestCancel(record) {
    openConfirm({
      title: "Cancel this work order?",
      message: "Any materials already issued against it stay issued — cancelling doesn't reverse a Stock Ledger entry that's already posted.",
      confirmLabel: "Cancel Order",
      onConfirm: () => {
        const updated = ERP_WorkOrderRepository.cancel(record.id, session.username);
        if (updated) {
          logSystemActivity({ module: "Work Order", action: "Cancel", description: `Cancelled work order "${updated.workOrderCode}" (${company.name})` });
          closeModal("woDetailModal");
          renderAll();
          renderActivity();
        }
      }
    });
  }

  function bindDetailModal() {
    $("#woTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const record = ERP_WorkOrderRepository.findById(viewBtn.dataset.id);
      if (record) openDetailModal(record);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "work-order")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading work orders…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#noBomState").hidden = true;
      $("#woContent").hidden = true;
      $("#woSubtitle").textContent = "No active company yet.";
    } else if (activeBoms().length === 0 && ERP_WorkOrderRepository.getAllForCompany(company.id).length === 0) {
      $("#noCompanyState").hidden = true;
      $("#noBomState").hidden = false;
      $("#woContent").hidden = true;
    } else {
      $("#noCompanyState").hidden = true;
      $("#noBomState").hidden = true;
      $("#woContent").hidden = false;
      $("#woHeaderActions").hidden = false;
      $("#woSubtitle").textContent = `Managing work orders for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
