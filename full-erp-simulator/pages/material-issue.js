/* =============================================================================
   DOT ERP — pages/material-issue.js
   Phase 10, Module 03: Material Issue for Production

   Lines are DERIVED from the picked Work Order's own BOM — no add/remove
   line buttons at all, the same "table re-renders whole, no free-form
   add" shape Delivery Schedule/Goods Receipt already established for a
   derived line array. Only the picked Work Order and each line's own
   quantity are genuinely editable.
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
  let formLines = [];
  let selectedWorkOrder = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function itemLabel(id) { const i = ERP_ItemRepository.findById(id); return i ? i.itemName : "Unknown item"; }
  function warehouseLabel(id) { const w = ERP_WarehouseRepository.findById(id); return w ? w.warehouseName : "Unknown warehouse"; }
  function woLabel(id) { const w = ERP_WorkOrderRepository.findById(id); return w ? w.workOrderCode : "Unknown work order"; }
  function statusBadge(status) {
    const tone = status === "Issued" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }

  function inProgressWorkOrders() {
    return ERP_WorkOrderRepository.getInProgressForCompany(company.id);
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY / LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_MaterialIssueRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    const btn = $("#miSortBtn");
    if (btn && btn.dataset.order === "asc") rows = [...rows].reverse();
    return rows;
  }

  function renderSummary() {
    const all = ERP_MaterialIssueRepository.getAllForCompany(company.id);
    $("#miSummaryTotal").textContent = String(all.length);
    $("#miSummaryDraft").textContent = String(all.filter((r) => r.status === "Draft").length);
    $("#miSummaryIssued").textContent = String(all.filter((r) => r.status === "Issued").length);
    $("#miSummaryCancelled").textContent = String(all.filter((r) => r.status === "Cancelled").length);
  }

  function renderPagination(totalPages) {
    const container = $("#miPagination");
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

    $("#miEmptyState").hidden = all.length !== 0;
    $("#miTable").hidden = all.length === 0;

    $("#miTableBody").innerHTML = pageItems.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.materialIssueCode)}</code></td>
        <td>${escapeHtml(woLabel(r.workOrderId))}</td>
        <td>${escapeHtml(warehouseLabel(r.warehouseId))}</td>
        <td class="text-right">${(r.lines || []).length}</td>
        <td class="text-right">${r.status === "Issued" ? formatMoney(r.totalMaterialCost) : "—"}</td>
        <td>${r.issueDate || "—"}</td>
        <td>${statusBadge(r.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">View</button></td>
      </tr>`).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#miStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#miStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#miSortBtn").addEventListener("click", () => {
      const btn = $("#miSortBtn");
      const asc = btn.dataset.order === "asc";
      btn.dataset.order = asc ? "desc" : "asc";
      btn.textContent = asc ? "Newest First" : "Oldest First";
      renderTable();
    });
    $("#miExportCsvBtn").addEventListener("click", exportCsv);
    $("#miPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["MI Code", "Work Order", "Warehouse", "Lines", "Total Cost", "Issue Date", "Status"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([r.materialIssueCode, woLabel(r.workOrderId), `"${warehouseLabel(r.warehouseId)}"`, (r.lines || []).length, r.status === "Issued" ? r.totalMaterialCost.toFixed(2) : "", r.issueDate || "", r.status].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `material-issues-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Material Issue")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#miActivityEmptyState").hidden = relevant.length !== 0;
    $("#miActivityList").innerHTML = relevant.map((e) => `
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
     ADD MODAL — lines derived from the picked Work Order's own BOM
     --------------------------------------------------------------------- */
  function renderLineRows() {
    $("#miFormLineTableBody").innerHTML = formLines.map((line, i) => `
      <tr>
        <td>${escapeHtml(itemLabel(line.itemId))}</td>
        <td class="text-right">${formatQty(line.requiredQty)}</td>
        <td class="text-right">${formatQty(line.alreadyIssued)}</td>
        <td><div class="input-wrap"><input type="number" class="mi-line-qty" data-index="${i}" min="0" step="0.01" value="${line.quantity}" /></div></td>
      </tr>`).join("");
  }

  function bindLineTable() {
    $("#miFormLineTableBody").addEventListener("input", (e) => {
      if (!e.target.classList.contains("mi-line-qty")) return;
      const idx = Number(e.target.dataset.index);
      if (formLines[idx]) formLines[idx].quantity = e.target.value;
    });
  }

  function populateWorkOrderOptions(selectedId) {
    const wos = inProgressWorkOrders();
    $("#miFormWorkOrder").innerHTML = `<option value="">Select an In Progress Work Order…</option>` +
      wos.map((w) => `<option value="${w.id}"${w.id === selectedId ? " selected" : ""}>${escapeHtml(w.workOrderCode)}</option>`).join("");
  }

  function populateIssuedByOptions() {
    const employees = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status === "Active");
    $("#miFormIssuedBy").innerHTML = `<option value="">Not specified</option>` +
      employees.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)}</option>`).join("");
  }

  function onWorkOrderPicked() {
    const woId = $("#miFormWorkOrder").value;
    selectedWorkOrder = woId ? ERP_WorkOrderRepository.findById(woId) : null;
    if (!selectedWorkOrder) {
      formLines = [];
      $("#miFormWorkOrderInfo").textContent = "";
      renderLineRows();
      return;
    }
    formLines = ERP_MaterialIssueRepository.buildSuggestedLines(company.id, selectedWorkOrder);
    const bom = ERP_BomRepository.findById(selectedWorkOrder.bomId);
    $("#miFormWorkOrderInfo").textContent = bom
      ? `Producing ${escapeHtml(itemLabel(bom.finishedItemId))}, planned quantity ${formatQty(selectedWorkOrder.plannedQuantity)}.`
      : "";
    renderLineRows();
  }

  function clearFormErrors() {
    ["miFormWorkOrderError", "miFormLinesError"].forEach((id) => { $("#" + id).textContent = ""; });
  }

  function openAddModal() {
    if (inProgressWorkOrders().length === 0) {
      showToast("No In Progress work orders yet — start one first.", "warning");
      return;
    }
    formLines = [];
    selectedWorkOrder = null;
    $("#miFormIntro").textContent = "This saves as a Draft — post it once the quantities are right.";
    populateWorkOrderOptions("");
    populateIssuedByOptions();
    $("#miFormIssueDate").value = new Date().toISOString().slice(0, 10);
    $("#miFormRemarks").value = "";
    renderLineRows();
    clearFormErrors();
    openModal("miFormModal");
  }

  function buildLinePayload() {
    return formLines.filter((l) => Number(l.quantity) > 0).map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) || 0 }));
  }

  function validateForm(lines) {
    let valid = true;
    clearFormErrors();
    if (!selectedWorkOrder) { $("#miFormWorkOrderError").textContent = "Select a Work Order."; valid = false; }
    else if (lines.length === 0) { $("#miFormLinesError").textContent = "At least one line needs a quantity greater than zero."; valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#miAddBtn").addEventListener("click", openAddModal);
    $("#miFormWorkOrder").addEventListener("change", onWorkOrderPicked);
    $("#miFormSaveBtn").addEventListener("click", () => {
      const lines = buildLinePayload();
      if (!validateForm(lines)) return;
      const payload = {
        issueDate: $("#miFormIssueDate").value || new Date().toISOString().slice(0, 10),
        issuedByEmployeeId: $("#miFormIssuedBy").value || null,
        remarks: $("#miFormRemarks").value.trim(),
        lines
      };
      const created = ERP_MaterialIssueRepository.create(company, selectedWorkOrder, payload, session.username);
      logSystemActivity({ module: "Material Issue", action: "Create", description: `Created material issue "${created.materialIssueCode}" for ${company.name}` });
      closeModal("miFormModal");
      renderAll();
      renderActivity();
      showToast("Material issue saved as Draft — post it to update the Stock Ledger.", "success");
    });
    bindLineTable();
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function renderDetailFooter(record) {
    const footer = $("#miDetailFooter");
    footer.innerHTML = "";
    if (record.status === "Draft") {
      const postBtn = document.createElement("button");
      postBtn.type = "button";
      postBtn.className = "btn btn--primary";
      postBtn.textContent = "Post (issues stock)";
      postBtn.disabled = !ERP_MaterialIssueRepository.canPost(record);
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
    closeBtn.addEventListener("click", () => closeModal("miDetailModal"));
    footer.appendChild(closeBtn);
  }

  function openDetailModal(record) {
    const issuedBy = record.issuedByEmployeeId ? ERP_EmployeeRepository.findById(record.issuedByEmployeeId) : null;
    $("#miDetailTitle").textContent = `Material Issue — ${record.materialIssueCode}`;
    $("#miDetailBody").innerHTML = `
      <div><dt>MI Code</dt><dd><code>${escapeHtml(record.materialIssueCode)}</code></dd></div>
      <div><dt>Work Order</dt><dd>${escapeHtml(woLabel(record.workOrderId))}</dd></div>
      <div><dt>Warehouse</dt><dd>${escapeHtml(warehouseLabel(record.warehouseId))}</dd></div>
      <div><dt>Issue Date</dt><dd>${record.issueDate || "—"}</dd></div>
      <div><dt>Issued By</dt><dd>${issuedBy ? escapeHtml(issuedBy.fullName) : "<span class=\"profile-subtle\">Not specified</span>"}</dd></div>
      <div><dt>Remarks</dt><dd>${record.remarks ? escapeHtml(record.remarks) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(record.status)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(record.createdAt))} by ${escapeHtml(actorLabel(record.createdByUsername))}</dd></div>
      ${record.status === "Issued" ? `<div><dt>Posted</dt><dd>${formatDateTime(new Date(record.postedAt))} by ${escapeHtml(actorLabel(record.postedByUsername))}</dd></div>` : ""}
    `;
    $("#miLineTableBody").innerHTML = (record.lines || []).map((l) => `
      <tr>
        <td>${escapeHtml(itemLabel(l.itemId))}${l.skipped ? ' <span class="status-badge status-badge--warning">Skipped — insufficient stock</span>' : ""}</td>
        <td class="text-right">${formatQty(l.quantity)}</td>
        <td class="text-right">${l.unitCostAtIssue != null ? formatMoney(l.unitCostAtIssue) : "—"}</td>
        <td class="text-right">${l.unitCostAtIssue != null ? formatMoney(l.quantity * l.unitCostAtIssue) : "—"}</td>
      </tr>`).join("");
    $("#miGrandTotalLine").textContent = record.status === "Issued" ? `Total material cost: ${formatMoney(record.totalMaterialCost)}` : "";
    renderDetailFooter(record);
    openModal("miDetailModal");
  }

  function requestPost(record) {
    if (!ERP_MaterialIssueRepository.canPost(record)) return;
    openConfirm({
      title: "Post this material issue?",
      message: "This writes one Stock Ledger entry per line that has enough stock behind it and locks the issue for good. There's no un-posting — a correction needs its own Stock Adjustment.",
      confirmLabel: "Post",
      onConfirm: () => {
        const result = ERP_MaterialIssueRepository.post(record.id, company, session.username);
        if (result.success) {
          logSystemActivity({ module: "Material Issue", action: "Post", description: `Posted material issue "${result.record.materialIssueCode}" (${company.name})` });

          // Auto-post to the General Ledger (Phase 10 retrofit pass) — see
          // data/gl-posting-data.js's own header. Typeof-guarded since not
          // every page loads the GL posting layer.
          if (typeof ERP_GlPostingRepository !== "undefined") {
            const glResult = ERP_GlPostingRepository.postMaterialIssue(company, result.record, session.username);
            if (glResult.success) {
              logSystemActivity({ module: "Material Issue", action: "Auto-Post", description: `Auto-posted journal entry ${glResult.entry.entryNumber} for material issue "${result.record.materialIssueCode}" (${company.name})` });
            } else {
              showToast(glResult.reason, "warning", { title: "Not posted to the books" });
            }
          }

          closeModal("miDetailModal");
          renderAll();
          renderActivity();
          showToast(result.skippedCount > 0 ? `Posted ${result.postedCount} line(s); ${result.skippedCount} skipped for insufficient stock.` : `Posted ${result.postedCount} line(s).`, result.skippedCount > 0 ? "warning" : "success");
        } else {
          showToast(result.reason || "Couldn't post this material issue.", "danger");
        }
      }
    });
  }

  function requestCancel(record) {
    openConfirm({
      title: "Cancel this draft?",
      message: "This draft was never posted, so nothing has been written to the Stock Ledger — cancelling is safe.",
      confirmLabel: "Cancel Issue",
      onConfirm: () => {
        ERP_MaterialIssueRepository.cancel(record.id, session.username);
        logSystemActivity({ module: "Material Issue", action: "Cancel", description: `Cancelled material issue "${record.materialIssueCode}" (${company.name})` });
        closeModal("miDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#miTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const record = ERP_MaterialIssueRepository.findById(viewBtn.dataset.id);
      if (record) openDetailModal(record);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "material-issue")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading material issues…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#miContent").hidden = true;
      $("#miSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#miContent").hidden = false;
      $("#miHeaderActions").hidden = false;
      $("#miSubtitle").textContent = `Managing material issues for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
