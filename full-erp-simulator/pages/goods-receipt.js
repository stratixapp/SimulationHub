/* =============================================================================
   DOT ERP — pages/goods-receipt.js
   Phase 4, Module 13: Goods Receipt

   See data/goods-receipt-data.js's header for the full design rationale
   (built from a Finalized schedule, exclusivity, the 3-state lifecycle
   named `Logged` to avoid colliding with `Finalized`/`Confirmed` one and
   two modules up the chain). This file is the UI layer's own decisions
   on top of that:

   - THE RECEIPT-LINE TABLE IS DYNAMIC, ONE ROW PER SCHEDULE LINE.
     Choosing a Finalized schedule resolves its own `scheduleLines`, and
     renders one editable received-qty/condition-notes row per line,
     pre-filled with the PLANNED quantity — genuinely meant to be
     overwritten, unlike every earlier "starting point" in this session
     which usually stayed close to its default. A receiving discrepancy
     is the normal case this module exists to catch, not an edge case.
   - Vendor/warehouse info is read-only, resolved by walking schedule ->
     PO, the same "derived, not chosen" treatment every downstream module
     this session has given fields that already have an answer further
     up the chain.
   - Received By and Received At Warehouse ARE independently editable
     (unlike vendor) — the PO's own delivery warehouse is a sensible
     DEFAULT for where receiving happened, but real receiving sometimes
     lands somewhere else (a different dock, an emergency drop point),
     so this module lets it diverge rather than locking it.
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
  let sortOrder = "desc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;


  function statusBadgeClass(status) {
    if (status === "Logged") return "success";
    if (status === "Cancelled") return "neutral";
    return "warning"; // Draft
  }

  function quickActionFor(receipt) {
    if (receipt.status === "Draft") return { action: "log", label: "Log Receipt" };
    return null;
  }

  /** schedule -> PO -> quotation -> RFQ -> PR, the same chain-walk every
      downstream module this session resolves line descriptions through. */
  function getSourceLinesForSchedule(schedule) {
    if (!schedule) return [];
    const po = ERP_PurchaseOrderRepository.findById(schedule.linkedPoId);
    if (!po) return [];
    const quotation = ERP_QuotationRepository.findById(po.linkedQuotationId);
    const rfq = quotation ? ERP_RfqRepository.findById(quotation.rfqId) : null;
    const pr = rfq ? ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId) : null;
    return pr ? (pr.lineItems || []) : [];
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_GoodsReceiptRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((r) => {
        const schedule = r.linkedScheduleId ? ERP_DeliveryScheduleRepository.findById(r.linkedScheduleId) : null;
        return r.receiptCode.toLowerCase().includes(term) || (schedule && schedule.scheduleCode.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_GoodsReceiptRepository.getAllForCompany(company.id);
    $("#grSummaryTotal").textContent = String(all.length);
    $("#grSummaryDraft").textContent = String(all.filter((r) => r.status === "Draft").length);
    $("#grSummaryLogged").textContent = String(all.filter((r) => r.status === "Logged").length);
    $("#grSummaryCancelled").textContent = String(all.filter((r) => r.status === "Cancelled").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#grPagination");
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

    $("#grEmptyState").hidden = all.length !== 0;
    $("#grTable").hidden = all.length === 0;

    $("#grTableBody").innerHTML = pageItems.map((r) => {
      const schedule = r.linkedScheduleId ? ERP_DeliveryScheduleRepository.findById(r.linkedScheduleId) : null;
      const po = schedule ? ERP_PurchaseOrderRepository.findById(schedule.linkedPoId) : null;
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const receivedBy = r.receivedByEmployeeId ? ERP_EmployeeRepository.findById(r.receivedByEmployeeId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(r.status)}">${r.status}</span>`;
      const qa = quickActionFor(r);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${r.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(r.receiptCode)}</code></td>
        <td>${schedule ? `<code>${escapeHtml(schedule.scheduleCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${(r.receiptLines || []).length}</td>
        <td>${receivedBy ? escapeHtml(receivedBy.fullName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${r.receivedDate ? escapeHtml(r.receivedDate) : `<span class="profile-subtle">—</span>`}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${r.id}">View</button>
          ${quickActionHtml}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#grStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#grStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#grSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#grSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#grExportCsvBtn").addEventListener("click", exportCsv);
    $("#grPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Receipt Code", "Schedule Code", "Vendor", "Lines", "Received By", "Received Date", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((r) => {
      const schedule = r.linkedScheduleId ? ERP_DeliveryScheduleRepository.findById(r.linkedScheduleId) : null;
      const po = schedule ? ERP_PurchaseOrderRepository.findById(schedule.linkedPoId) : null;
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const receivedBy = r.receivedByEmployeeId ? ERP_EmployeeRepository.findById(r.receivedByEmployeeId) : null;
      const line = [
        r.receiptCode, schedule ? schedule.scheduleCode : "", vendor ? vendor.vendorName : "", (r.receiptLines || []).length,
        receivedBy ? receivedBy.fullName : "", r.receivedDate || "", r.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-goods-receipts-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Goods receipts exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((r) => {
      const schedule = r.linkedScheduleId ? ERP_DeliveryScheduleRepository.findById(r.linkedScheduleId) : null;
      return `<tr><td>${escapeHtml(r.receiptCode)}</td><td>${schedule ? escapeHtml(schedule.scheduleCode) : ""}</td><td>${escapeHtml(r.receivedDate || "")}</td><td>${escapeHtml(r.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Goods Receipt Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Goods Receipt Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Receipt Code</th><th>Schedule</th><th>Received Date</th><th>Status</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast('Opened the print dialog — choose "Save as PDF" to export.', "info", { title: "Export PDF" });
  }


  /* -----------------------------------------------------------------------
     RECENT CHANGES
     --------------------------------------------------------------------- */
  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Goods Receipt")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#grActivityEmptyState").hidden = relevant.length !== 0;
    $("#grActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#grFormModal)
     --------------------------------------------------------------------- */
  function populateScheduleOptions(currentId) {
    let schedules = ERP_GoodsReceiptRepository.getAvailableFinalizedSchedulesForCompany(company.id, editingId);
    if (currentId && !schedules.some((s) => s.id === currentId)) {
      const current = ERP_DeliveryScheduleRepository.findById(currentId);
      if (current) schedules = schedules.concat([current]);
    }
    $("#grFormSchedule").innerHTML = schedules.map((s) => {
      const po = ERP_PurchaseOrderRepository.findById(s.linkedPoId);
      const label = `${s.scheduleCode}${po ? ` — ${po.poCode}` : ""}`;
      return `<option value="${s.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function populateEmployeeOptions(currentId) {
    let employees = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status === "Active");
    if (currentId && !employees.some((e) => e.id === currentId)) {
      const current = ERP_EmployeeRepository.findById(currentId);
      if (current) employees = employees.concat([current]);
    }
    $("#grFormReceivedBy").innerHTML = `<option value="">Not set</option>` + employees.map((e) =>
      `<option value="${e.id}">${escapeHtml(e.fullName)} (${escapeHtml(e.employeeCode)})</option>`
    ).join("");
  }

  function populateWarehouseOptions(currentId, defaultId) {
    let whs = ERP_WarehouseRepository.getAllForCompany(company.id).filter((w) => w.status === "Active");
    if (currentId && !whs.some((w) => w.id === currentId)) {
      const current = ERP_WarehouseRepository.findById(currentId);
      if (current) whs = whs.concat([current]);
    }
    whs = whs.slice().sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));
    $("#grFormWarehouse").innerHTML = `<option value="">Same as the PO's delivery warehouse</option>` + whs.map((w) =>
      `<option value="${w.id}">${escapeHtml(w.warehouseName)} (${escapeHtml(w.warehouseCode)})</option>`
    ).join("");
    $("#grFormWarehouse").value = currentId || "";
  }

  function renderScheduleInfo(schedule) {
    const box = $("#grFormScheduleInfo");
    if (!schedule) { box.textContent = ""; return; }
    const po = ERP_PurchaseOrderRepository.findById(schedule.linkedPoId);
    const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
    box.textContent = `Vendor: ${vendor ? vendor.vendorName : "Removed"}${po ? ` — from ${po.poCode}` : ""}.`;
  }

  function renderFormLineTable(schedule, existingLines) {
    const scheduleLines = schedule ? (schedule.scheduleLines || []) : [];
    const existingByLine = {};
    (existingLines || []).forEach((l) => { existingByLine[l.prLineItemId] = l; });

    if (!scheduleLines.length) {
      $("#grFormLineTableBody").innerHTML = `<tr><td colspan="4"><span class="profile-subtle">Pick a delivery schedule to load its lines.</span></td></tr>`;
      return;
    }
    const prLineById = {};
    getSourceLinesForSchedule(schedule).forEach((l) => { prLineById[l.id] = l; });
    $("#grFormLineTableBody").innerHTML = scheduleLines.map((line) => {
      const prLine = prLineById[line.prLineItemId];
      const item = prLine && prLine.itemId ? ERP_ItemRepository.findById(prLine.itemId) : null;
      const label = item
        ? `${escapeHtml(item.itemName)}${prLine.lineDescription ? " — " + escapeHtml(prLine.lineDescription) : ""}`
        : escapeHtml((prLine && prLine.lineDescription) || "—");
      const existing = existingByLine[line.prLineItemId];
      const receivedQty = existing ? existing.receivedQuantity : line.plannedQuantity;
      const conditionNotes = existing ? existing.conditionNotes || "" : "";
      return `
      <tr>
        <td>${label}</td>
        <td>${escapeHtml(String(line.plannedQuantity))}</td>
        <td><div class="input-wrap"><input type="number" class="gr-line-qty" data-line-id="${line.prLineItemId}" min="0" step="1" value="${receivedQty}" /></div></td>
        <td><div class="input-wrap"><input type="text" class="gr-line-notes" data-line-id="${line.prLineItemId}" maxlength="120" value="${escapeHtml(conditionNotes)}" placeholder="e.g. 2 units damaged" /></div></td>
      </tr>`;
    }).join("");
  }

  function collectReceiptLines() {
    return $$(".gr-line-qty").map((qtyInput) => {
      const lineId = qtyInput.dataset.lineId;
      const notesInput = document.querySelector(`.gr-line-notes[data-line-id="${lineId}"]`);
      return {
        prLineItemId: lineId,
        receivedQuantity: qtyInput.value === "" ? 0 : Number(qtyInput.value),
        conditionNotes: notesInput ? notesInput.value.trim() : ""
      };
    });
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("grFormSchedule", ""); }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function openAddModal() {
    const available = ERP_GoodsReceiptRepository.getAvailableFinalizedSchedulesForCompany(company.id, null);
    if (!available.length) {
      showToast("No Finalized delivery schedules are currently available to log a receipt against. Finalize one in Delivery Schedule first.", "warning");
      return;
    }
    editingId = null;
    $("#grFormTitle").textContent = "New goods receipt";
    $("#grFormIntro").textContent = "Pick the Finalized delivery schedule to log a receipt against — each line starts on its planned quantity.";
    $("#grFormSaveBtn").textContent = "Create Goods Receipt";
    populateScheduleOptions(null);
    const firstSchedule = ERP_DeliveryScheduleRepository.findById($("#grFormSchedule").value);
    renderScheduleInfo(firstSchedule);
    renderFormLineTable(firstSchedule, []);
    populateEmployeeOptions(null);
    populateWarehouseOptions(null, null);
    $("#grFormReceivedDate").value = todayISO();
    $("#grFormNotes").value = "";
    clearFormErrors();
    openModal("grFormModal");
  }

  function openEditModal(receipt) {
    if (!ERP_GoodsReceiptRepository.canEdit(receipt)) {
      showToast(`"${receipt.receiptCode}" is ${receipt.status} and can't be edited directly. Reopen it to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = receipt.id;
    $("#grFormTitle").textContent = "Edit goods receipt";
    $("#grFormIntro").textContent = "Update which schedule this receipt is logged against, or adjust received quantities and condition notes.";
    $("#grFormSaveBtn").textContent = "Save Changes";
    populateScheduleOptions(receipt.linkedScheduleId);
    $("#grFormSchedule").value = receipt.linkedScheduleId || "";
    const schedule = ERP_DeliveryScheduleRepository.findById(receipt.linkedScheduleId);
    renderScheduleInfo(schedule);
    renderFormLineTable(schedule, receipt.receiptLines);
    populateEmployeeOptions(receipt.receivedByEmployeeId);
    $("#grFormReceivedBy").value = receipt.receivedByEmployeeId || "";
    populateWarehouseOptions(receipt.receivedWarehouseId, null);
    $("#grFormReceivedDate").value = receipt.receivedDate || todayISO();
    $("#grFormNotes").value = receipt.notes || "";
    clearFormErrors();
    openModal("grFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#grFormSchedule").value) { setFormError("grFormSchedule", "Select the Finalized delivery schedule to log a receipt against."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#grAddBtn").addEventListener("click", openAddModal);

    $("#grFormSchedule").addEventListener("change", (e) => {
      const schedule = ERP_DeliveryScheduleRepository.findById(e.target.value);
      renderScheduleInfo(schedule);
      renderFormLineTable(schedule, []);
    });

    $("#grFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const schedule = ERP_DeliveryScheduleRepository.findById($("#grFormSchedule").value);
      const payload = {
        linkedScheduleId: $("#grFormSchedule").value,
        receiptLines: collectReceiptLines(),
        receivedByEmployeeId: $("#grFormReceivedBy").value || null,
        receivedWarehouseId: $("#grFormWarehouse").value || null,
        receivedDate: $("#grFormReceivedDate").value || null,
        notes: $("#grFormNotes").value.trim()
      };

      const label = schedule ? schedule.scheduleCode : "this schedule";

      if (editingId) {
        openConfirm({
          title: "Save changes to this goods receipt?",
          message: `This goods receipt for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_GoodsReceiptRepository.update(editingId, payload);
            logSystemActivity({ module: "Goods Receipt", action: "Update", description: `Updated goods receipt for ${label} (${company.name})` });
            closeModal("grFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_GoodsReceiptRepository.findById(editingId));
            showToast("Goods receipt updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this goods receipt?",
          message: `A new goods receipt will be created as a Draft for ${label}.`,
          confirmLabel: "Create Goods Receipt",
          onConfirm: () => {
            const created = ERP_GoodsReceiptRepository.create(company, payload);
            logSystemActivity({ module: "Goods Receipt", action: "Create", description: `Created goods receipt "${created.receiptCode}" for ${label} (${company.name})` });
            closeModal("grFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.receiptCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestLog(receipt) {
    openConfirm({
      title: "Log this goods receipt?",
      message: `"${receipt.receiptCode}" will be marked Logged — treat this as an accurate record of what physically arrived.`,
      confirmLabel: "Log Receipt",
      onConfirm: () => {
        ERP_GoodsReceiptRepository.logReceipt(receipt.id, session.username);
        logSystemActivity({ module: "Goods Receipt", action: "Log", description: `Logged goods receipt "${receipt.receiptCode}" (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === receipt.id) openDetailModal(ERP_GoodsReceiptRepository.findById(receipt.id));
        showToast(`"${receipt.receiptCode}" logged.`, "success");
      }
    });
  }

  function requestReopen(receipt) {
    openConfirm({
      title: "Reopen this goods receipt?",
      message: `"${receipt.receiptCode}" will move back to Draft so you can correct it.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_GoodsReceiptRepository.reopen(receipt.id);
        logSystemActivity({ module: "Goods Receipt", action: "Reopen", description: `Reopened goods receipt "${receipt.receiptCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === receipt.id) openDetailModal(ERP_GoodsReceiptRepository.findById(receipt.id));
        showToast(`"${receipt.receiptCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(receipt) {
    openConfirm({
      title: "Cancel this goods receipt?",
      message: `"${receipt.receiptCode}" will be marked Cancelled and its schedule freed up for a different receipt.`,
      confirmLabel: "Cancel Receipt",
      onConfirm: () => {
        ERP_GoodsReceiptRepository.cancel(receipt.id, session.username);
        logSystemActivity({ module: "Goods Receipt", action: "Cancel", description: `Cancelled goods receipt "${receipt.receiptCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === receipt.id) openDetailModal(ERP_GoodsReceiptRepository.findById(receipt.id));
        showToast(`"${receipt.receiptCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(receipt) {
    if (!ERP_GoodsReceiptRepository.canDelete(receipt)) {
      showToast(`"${receipt.receiptCode}" is ${receipt.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this goods receipt?",
      message: `"${receipt.receiptCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_GoodsReceiptRepository.remove(receipt.id);
        logSystemActivity({ module: "Goods Receipt", action: "Delete", description: `Deleted goods receipt "${receipt.receiptCode}" (${company.name})`, severity: "warning" });
        if (detailId === receipt.id) closeModal("grDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${receipt.receiptCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderLineItemsTable(receipt) {
    const schedule = ERP_DeliveryScheduleRepository.findById(receipt.linkedScheduleId);
    const scheduleLineById = {};
    (schedule ? schedule.scheduleLines || [] : []).forEach((l) => { scheduleLineById[l.prLineItemId] = l; });
    const prLineById = {};
    getSourceLinesForSchedule(schedule).forEach((l) => { prLineById[l.id] = l; });

    const lines = receipt.receiptLines || [];
    $("#grLineTableBody").innerHTML = lines.length
      ? lines.map((line) => {
          const prLine = prLineById[line.prLineItemId];
          const item = prLine && prLine.itemId ? ERP_ItemRepository.findById(prLine.itemId) : null;
          const label = item
            ? `${escapeHtml(item.itemName)}${prLine.lineDescription ? " — " + escapeHtml(prLine.lineDescription) : ""}`
            : escapeHtml((prLine && prLine.lineDescription) || "—");
          const plannedQty = scheduleLineById[line.prLineItemId] ? scheduleLineById[line.prLineItemId].plannedQuantity : "—";
          const shortfall = scheduleLineById[line.prLineItemId] && Number(line.receivedQuantity) < Number(scheduleLineById[line.prLineItemId].plannedQuantity);
          const receivedCell = shortfall
            ? `<span class="status-badge status-badge--warning">${escapeHtml(String(line.receivedQuantity))}</span>`
            : escapeHtml(String(line.receivedQuantity));
          return `<tr><td>${label}</td><td>${escapeHtml(String(plannedQty))}</td><td>${receivedCell}</td><td>${line.conditionNotes ? escapeHtml(line.conditionNotes) : `<span class="profile-subtle">—</span>`}</td></tr>`;
        }).join("")
      : `<tr><td colspan="4"><span class="profile-subtle">This receipt has no lines.</span></td></tr>`;

    const shortLines = lines.filter((line) => {
      const planned = scheduleLineById[line.prLineItemId];
      return planned && Number(line.receivedQuantity) < Number(planned.plannedQuantity);
    });
    if (!lines.length) {
      $("#grGrandTotalLine").textContent = "";
    } else if (shortLines.length) {
      $("#grGrandTotalLine").textContent = `${shortLines.length} of ${lines.length} line(s) received short of plan.`;
    } else {
      $("#grGrandTotalLine").textContent = `All ${lines.length} line(s) received at or above plan.`;
    }
  }

  function renderDetailFooter(receipt) {
    const footer = $("#grDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (receipt.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(receipt));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("grDetailModal"); openEditModal(receipt); });
      addBtn("Log Receipt", "btn btn--primary", () => requestLog(receipt));
    } else if (receipt.status === "Logged") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(receipt));
      addBtn("Reopen to Draft", "btn btn--ghost", () => requestReopen(receipt));
    } else if (receipt.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(receipt));
    }
  }

  function openDetailModal(receipt) {
    detailId = receipt.id;
    const schedule = ERP_DeliveryScheduleRepository.findById(receipt.linkedScheduleId);
    const po = schedule ? ERP_PurchaseOrderRepository.findById(schedule.linkedPoId) : null;
    const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
    const receivedBy = receipt.receivedByEmployeeId ? ERP_EmployeeRepository.findById(receipt.receivedByEmployeeId) : null;
    const receivedWarehouse = receipt.receivedWarehouseId ? ERP_WarehouseRepository.findById(receipt.receivedWarehouseId) : (po && po.deliveryWarehouseId ? ERP_WarehouseRepository.findById(po.deliveryWarehouseId) : null);

    $("#grDetailTitle").textContent = `${receipt.receiptCode} · ${receipt.status}`;

    const rows = [];
    rows.push(`<div><dt>Receipt Code</dt><dd><code>${escapeHtml(receipt.receiptCode)}</code></dd></div>`);
    rows.push(`<div><dt>Delivery Schedule</dt><dd>${schedule ? `<code>${escapeHtml(schedule.scheduleCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Received By</dt><dd>${receivedBy ? escapeHtml(receivedBy.fullName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Received At</dt><dd>${receivedWarehouse ? escapeHtml(receivedWarehouse.warehouseName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Received Date</dt><dd>${receipt.receivedDate ? escapeHtml(receipt.receivedDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(receipt.status)}">${receipt.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(receipt.createdAt))}</dd></div>`);
    if (receipt.loggedAt) rows.push(`<div><dt>Logged</dt><dd>${formatDateTime(new Date(receipt.loggedAt))} by ${escapeHtml(ERP_GoodsReceiptRepository.actorLabel(receipt.loggedByUsername))}</dd></div>`);
    if (typeof ERP_GrnRepository !== "undefined") {
      const linkedGrn = ERP_GrnRepository.findGrnForReceipt(company.id, receipt.id);
      if (linkedGrn) {
        const grnBadgeClass = linkedGrn.status === "Posted" ? "success" : linkedGrn.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to GRN</dt><dd><code>${escapeHtml(linkedGrn.grnNumber)}</code> <span class="status-badge status-badge--${grnBadgeClass}">${escapeHtml(linkedGrn.status)}</span></dd></div>`);
      } else if (receipt.status === "Logged") {
        rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Ready for a formal document — see <strong>GRN</strong>.</dd></div>`);
      }
    }
    if (receipt.status === "Cancelled" && receipt.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(receipt.cancelledAt))} by ${escapeHtml(ERP_GoodsReceiptRepository.actorLabel(receipt.cancelledByUsername))}</dd></div>`);
    if (receipt.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(receipt.notes)}</dd></div>`);

    $("#grDetailBody").innerHTML = rows.join("");
    renderLineItemsTable(receipt);
    renderDetailFooter(receipt);
    openModal("grDetailModal");
  }

  function bindDetailModal() {
    $("#grTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const r = ERP_GoodsReceiptRepository.findById(viewBtn.dataset.id);
        if (r) openDetailModal(r);
        return;
      }
      if (actionBtn) {
        const r = ERP_GoodsReceiptRepository.findById(actionBtn.dataset.id);
        if (!r) return;
        if (actionBtn.dataset.action === "log") requestLog(r);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "goods-receipt")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading goods receipts…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#grContent").hidden = true;
      $("#grSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#grContent").hidden = false;
      $("#grHeaderActions").hidden = false;
      $("#grSubtitle").textContent = `Logging goods receipts for ${company.name} (${company.companyCode}).`;

      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();

      if (new URLSearchParams(window.location.search).get("action") === "add") {
        openAddModal();
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
