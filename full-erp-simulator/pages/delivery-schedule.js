/* =============================================================================
   DOT ERP — pages/delivery-schedule.js
   Phase 4, Module 12: Delivery Schedule

   See data/delivery-schedule-data.js's header for the full design
   rationale (built from a Confirmed PO, exclusivity, the RFQ-shaped
   3-state lifecycle, no approval split). This file is the UI layer's own
   decisions on top of that:

   - THE SCHEDULE-LINE TABLE IS DYNAMIC, ONE ROW PER PO LINE ITEM. Choosing
     a Confirmed PO resolves its own `lineItems`, and renders one editable
     planned-qty/planned-date row per line, pre-filled with the PO's
     ordered quantity and the vendor's own confirmed delivery date
     (`po.vendorConfirmedDeliveryDate`, falling back to
     `po.expectedDeliveryDate` if the vendor never gave a different one).
     Exactly the same "walk one hop further down the same chain" shape
     Purchase Order's own form used for Quotation Receipt's lineQuotes.
   - NO vendor/warehouse picker — both are entirely determined by which
     PO is picked, shown read-only once one is chosen, the same "derived,
     not chosen" treatment Purchase Order gave its own vendor field.
   - NO Submitted/Approved anywhere on this page — this module has no
     approval split (see delivery-schedule-data.js's header), so its own
     workflow actions are just Finalize/Reopen/Cancel/Delete, all owned
     by this one page.
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
    if (status === "Finalized") return "success";
    if (status === "Cancelled") return "neutral";
    return "warning"; // Draft
  }

  function quickActionFor(schedule) {
    if (schedule.status === "Draft") return { action: "finalize", label: "Finalize" };
    return null;
  }

  /** Earliest/latest planned date across a schedule's own lines — used
      for both the table's summary columns and the Detail modal. */
  function getDateRange(schedule) {
    const dates = (schedule.scheduleLines || []).map((l) => l.plannedDate).filter(Boolean).sort();
    if (!dates.length) return { earliest: null, latest: null };
    return { earliest: dates[0], latest: dates[dates.length - 1] };
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_DeliveryScheduleRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((s) => s.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((s) => {
        const po = s.linkedPoId ? ERP_PurchaseOrderRepository.findById(s.linkedPoId) : null;
        const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
        return s.scheduleCode.toLowerCase().includes(term) ||
          (po && po.poCode.toLowerCase().includes(term)) ||
          (vendor && vendor.vendorName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_DeliveryScheduleRepository.getAllForCompany(company.id);
    $("#dsSummaryTotal").textContent = String(all.length);
    $("#dsSummaryDraft").textContent = String(all.filter((s) => s.status === "Draft").length);
    $("#dsSummaryFinalized").textContent = String(all.filter((s) => s.status === "Finalized").length);
    $("#dsSummaryCancelled").textContent = String(all.filter((s) => s.status === "Cancelled").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#dsPagination");
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

    $("#dsEmptyState").hidden = all.length !== 0;
    $("#dsTable").hidden = all.length === 0;

    $("#dsTableBody").innerHTML = pageItems.map((s) => {
      const po = s.linkedPoId ? ERP_PurchaseOrderRepository.findById(s.linkedPoId) : null;
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(s.status)}">${s.status}</span>`;
      const { earliest, latest } = getDateRange(s);
      const qa = quickActionFor(s);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${s.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(s.scheduleCode)}</code></td>
        <td>${po ? `<code>${escapeHtml(po.poCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${(s.scheduleLines || []).length}</td>
        <td>${earliest ? escapeHtml(earliest) : `<span class="profile-subtle">—</span>`}</td>
        <td>${latest ? escapeHtml(latest) : `<span class="profile-subtle">—</span>`}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${s.id}">View</button>
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
    $$("#dsStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#dsStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#dsSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#dsSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#dsExportCsvBtn").addEventListener("click", exportCsv);
    $("#dsPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Schedule Code", "PO Code", "Vendor", "Lines", "Earliest Planned", "Latest Planned", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((s) => {
      const po = s.linkedPoId ? ERP_PurchaseOrderRepository.findById(s.linkedPoId) : null;
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const { earliest, latest } = getDateRange(s);
      const line = [
        s.scheduleCode, po ? po.poCode : "", vendor ? vendor.vendorName : "", (s.scheduleLines || []).length,
        earliest || "", latest || "", s.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-delivery-schedules-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Delivery schedules exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((s) => {
      const po = s.linkedPoId ? ERP_PurchaseOrderRepository.findById(s.linkedPoId) : null;
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const { earliest, latest } = getDateRange(s);
      return `<tr><td>${escapeHtml(s.scheduleCode)}</td><td>${po ? escapeHtml(po.poCode) : ""}</td><td>${vendor ? escapeHtml(vendor.vendorName) : ""}</td><td>${escapeHtml(earliest || "")}</td><td>${escapeHtml(latest || "")}</td><td>${escapeHtml(s.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Delivery Schedule Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Delivery Schedule Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Schedule Code</th><th>PO Code</th><th>Vendor</th><th>Earliest</th><th>Latest</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Delivery Schedule")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#dsActivityEmptyState").hidden = relevant.length !== 0;
    $("#dsActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#dsFormModal) — picking a PO drives the vendor info line and
     the schedule-line table; carrier/tracking/notes are plain header
     fields.
     --------------------------------------------------------------------- */
  function populatePoOptions(currentId) {
    let pos = ERP_DeliveryScheduleRepository.getAvailableConfirmedPosForCompany(company.id, editingId);
    if (currentId && !pos.some((p) => p.id === currentId)) {
      const current = ERP_PurchaseOrderRepository.findById(currentId);
      if (current) pos = pos.concat([current]);
    }
    $("#dsFormPo").innerHTML = pos.map((po) => {
      const vendor = ERP_VendorRepository.findById(po.vendorId);
      const label = `${po.poCode} — ${vendor ? vendor.vendorName : "Unknown vendor"}`;
      return `<option value="${po.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderPoInfo(po) {
    const box = $("#dsFormPoInfo");
    if (!po) { box.textContent = ""; return; }
    const vendor = ERP_VendorRepository.findById(po.vendorId);
    const warehouse = po.deliveryWarehouseId ? ERP_WarehouseRepository.findById(po.deliveryWarehouseId) : null;
    box.textContent = `Vendor: ${vendor ? vendor.vendorName : "Removed"}${warehouse ? ` — delivering to ${warehouse.warehouseName}` : ""}.`;
  }

  function defaultPlannedDate(po) {
    return po.vendorConfirmedDeliveryDate || po.expectedDeliveryDate || "";
  }

  /** Same three-hop helper Purchase Order's own page uses to resolve a PO
      line back to a PR line's description — po -> quotation -> rfq -> pr. */
  function getSourceLinesForPo(po) {
    if (!po) return [];
    const quotation = ERP_QuotationRepository.findById(po.linkedQuotationId);
    const rfq = quotation ? ERP_RfqRepository.findById(quotation.rfqId) : null;
    const pr = rfq ? ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId) : null;
    return pr ? (pr.lineItems || []) : [];
  }

  function renderFormLineTable(po, existingLines) {
    const poLines = po ? (po.lineItems || []) : [];
    const existingByLine = {};
    (existingLines || []).forEach((l) => { existingByLine[l.prLineItemId] = l; });

    if (!poLines.length) {
      $("#dsFormLineTableBody").innerHTML = `<tr><td colspan="4"><span class="profile-subtle">Pick a purchase order to load its line items.</span></td></tr>`;
      return;
    }
    const prLineById = {};
    getSourceLinesForPo(po).forEach((l) => { prLineById[l.id] = l; });
    const fallbackDate = po ? defaultPlannedDate(po) : "";
    $("#dsFormLineTableBody").innerHTML = poLines.map((line) => {
      const prLine = prLineById[line.prLineItemId];
      const item = prLine && prLine.itemId ? ERP_ItemRepository.findById(prLine.itemId) : null;
      const label = item
        ? `${escapeHtml(item.itemName)}${prLine.lineDescription ? " — " + escapeHtml(prLine.lineDescription) : ""}`
        : escapeHtml((prLine && prLine.lineDescription) || "—");
      const existing = existingByLine[line.prLineItemId];
      const plannedQty = existing ? existing.plannedQuantity : line.quantity;
      const plannedDate = existing ? existing.plannedDate : fallbackDate;
      return `
      <tr>
        <td>${label}</td>
        <td>${escapeHtml(String(line.quantity))}</td>
        <td><div class="input-wrap"><input type="number" class="ds-line-qty" data-line-id="${line.prLineItemId}" min="0" step="1" value="${plannedQty}" /></div></td>
        <td><div class="input-wrap"><input type="date" class="ds-line-date" data-line-id="${line.prLineItemId}" value="${plannedDate}" /></div></td>
      </tr>`;
    }).join("");
  }

  function collectScheduleLines() {
    return $$(".ds-line-qty").map((qtyInput) => {
      const lineId = qtyInput.dataset.lineId;
      const dateInput = document.querySelector(`.ds-line-date[data-line-id="${lineId}"]`);
      return {
        prLineItemId: lineId,
        plannedQuantity: qtyInput.value === "" ? 0 : Number(qtyInput.value),
        plannedDate: dateInput && dateInput.value ? dateInput.value : null
      };
    });
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("dsFormPo", ""); }

  function openAddModal() {
    const available = ERP_DeliveryScheduleRepository.getAvailableConfirmedPosForCompany(company.id, null);
    if (!available.length) {
      showToast("No Confirmed purchase orders are currently available to schedule delivery for. Record a vendor confirmation in Vendor Confirmation first.", "warning");
      return;
    }
    editingId = null;
    $("#dsFormTitle").textContent = "New delivery schedule";
    $("#dsFormIntro").textContent = "Pick the Confirmed purchase order to plan delivery for — each line starts on the vendor's own confirmed date.";
    $("#dsFormSaveBtn").textContent = "Create Delivery Schedule";
    populatePoOptions(null);
    const firstPo = ERP_PurchaseOrderRepository.findById($("#dsFormPo").value);
    renderPoInfo(firstPo);
    renderFormLineTable(firstPo, []);
    $("#dsFormCarrier").value = "";
    $("#dsFormTracking").value = "";
    $("#dsFormNotes").value = "";
    clearFormErrors();
    openModal("dsFormModal");
  }

  function openEditModal(schedule) {
    if (!ERP_DeliveryScheduleRepository.canEdit(schedule)) {
      showToast(`"${schedule.scheduleCode}" is ${schedule.status} and can't be edited directly. Reopen it to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = schedule.id;
    $("#dsFormTitle").textContent = "Edit delivery schedule";
    $("#dsFormIntro").textContent = "Update which purchase order this plans delivery for, or adjust planned quantities and dates.";
    $("#dsFormSaveBtn").textContent = "Save Changes";
    populatePoOptions(schedule.linkedPoId);
    $("#dsFormPo").value = schedule.linkedPoId || "";
    const po = ERP_PurchaseOrderRepository.findById(schedule.linkedPoId);
    renderPoInfo(po);
    renderFormLineTable(po, schedule.scheduleLines);
    $("#dsFormCarrier").value = schedule.carrierName || "";
    $("#dsFormTracking").value = schedule.trackingReference || "";
    $("#dsFormNotes").value = schedule.notes || "";
    clearFormErrors();
    openModal("dsFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#dsFormPo").value) { setFormError("dsFormPo", "Select the Confirmed purchase order to plan delivery for."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#dsAddBtn").addEventListener("click", openAddModal);

    $("#dsFormPo").addEventListener("change", (e) => {
      const po = ERP_PurchaseOrderRepository.findById(e.target.value);
      renderPoInfo(po);
      renderFormLineTable(po, []);
    });

    $("#dsFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const po = ERP_PurchaseOrderRepository.findById($("#dsFormPo").value);
      const payload = {
        linkedPoId: $("#dsFormPo").value,
        scheduleLines: collectScheduleLines(),
        carrierName: $("#dsFormCarrier").value.trim(),
        trackingReference: $("#dsFormTracking").value.trim(),
        notes: $("#dsFormNotes").value.trim()
      };

      const label = po ? po.poCode : "this order";

      if (editingId) {
        openConfirm({
          title: "Save changes to this delivery schedule?",
          message: `This delivery schedule for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_DeliveryScheduleRepository.update(editingId, payload);
            logSystemActivity({ module: "Delivery Schedule", action: "Update", description: `Updated delivery schedule for ${label} (${company.name})` });
            closeModal("dsFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_DeliveryScheduleRepository.findById(editingId));
            showToast("Delivery schedule updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this delivery schedule?",
          message: `A new delivery schedule will be created as a Draft for ${label}.`,
          confirmLabel: "Create Delivery Schedule",
          onConfirm: () => {
            const created = ERP_DeliveryScheduleRepository.create(company, payload);
            logSystemActivity({ module: "Delivery Schedule", action: "Create", description: `Created delivery schedule "${created.scheduleCode}" for ${label} (${company.name})` });
            closeModal("dsFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.scheduleCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestFinalize(schedule) {
    openConfirm({
      title: "Finalize this delivery schedule?",
      message: `"${schedule.scheduleCode}" will be marked Finalized — this is what Goods Receipt will check actual arrivals against.`,
      confirmLabel: "Finalize",
      onConfirm: () => {
        ERP_DeliveryScheduleRepository.finalize(schedule.id, session.username);
        logSystemActivity({ module: "Delivery Schedule", action: "Finalize", description: `Finalized delivery schedule "${schedule.scheduleCode}" (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === schedule.id) openDetailModal(ERP_DeliveryScheduleRepository.findById(schedule.id));
        showToast(`"${schedule.scheduleCode}" finalized.`, "success");
      }
    });
  }

  function requestReopen(schedule) {
    openConfirm({
      title: "Reopen this delivery schedule?",
      message: `"${schedule.scheduleCode}" will move back to Draft so you can adjust it.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_DeliveryScheduleRepository.reopen(schedule.id);
        logSystemActivity({ module: "Delivery Schedule", action: "Reopen", description: `Reopened delivery schedule "${schedule.scheduleCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === schedule.id) openDetailModal(ERP_DeliveryScheduleRepository.findById(schedule.id));
        showToast(`"${schedule.scheduleCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(schedule) {
    openConfirm({
      title: "Cancel this delivery schedule?",
      message: `"${schedule.scheduleCode}" will be marked Cancelled and its purchase order freed up for a different schedule.`,
      confirmLabel: "Cancel Schedule",
      onConfirm: () => {
        ERP_DeliveryScheduleRepository.cancel(schedule.id, session.username);
        logSystemActivity({ module: "Delivery Schedule", action: "Cancel", description: `Cancelled delivery schedule "${schedule.scheduleCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === schedule.id) openDetailModal(ERP_DeliveryScheduleRepository.findById(schedule.id));
        showToast(`"${schedule.scheduleCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(schedule) {
    if (!ERP_DeliveryScheduleRepository.canDelete(schedule)) {
      showToast(`"${schedule.scheduleCode}" is ${schedule.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this delivery schedule?",
      message: `"${schedule.scheduleCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_DeliveryScheduleRepository.remove(schedule.id);
        logSystemActivity({ module: "Delivery Schedule", action: "Delete", description: `Deleted delivery schedule "${schedule.scheduleCode}" (${company.name})`, severity: "warning" });
        if (detailId === schedule.id) closeModal("dsDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${schedule.scheduleCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderLineItemsTable(schedule) {
    const po = ERP_PurchaseOrderRepository.findById(schedule.linkedPoId);
    const poLineById = {};
    (po ? po.lineItems || [] : []).forEach((l) => { poLineById[l.prLineItemId] = l; });
    const prLineById = {};
    getSourceLinesForPo(po).forEach((l) => { prLineById[l.id] = l; });

    const lines = schedule.scheduleLines || [];
    $("#dsLineTableBody").innerHTML = lines.length
      ? lines.map((line) => {
          const prLine = prLineById[line.prLineItemId];
          const item = prLine && prLine.itemId ? ERP_ItemRepository.findById(prLine.itemId) : null;
          const label = item
            ? `${escapeHtml(item.itemName)}${prLine.lineDescription ? " — " + escapeHtml(prLine.lineDescription) : ""}`
            : escapeHtml((prLine && prLine.lineDescription) || "—");
          const orderedQty = poLineById[line.prLineItemId] ? poLineById[line.prLineItemId].quantity : "—";
          return `<tr><td>${label}</td><td>${escapeHtml(String(orderedQty))}</td><td>${escapeHtml(String(line.plannedQuantity))}</td><td>${line.plannedDate ? escapeHtml(line.plannedDate) : `<span class="profile-subtle">—</span>`}</td></tr>`;
        }).join("")
      : `<tr><td colspan="4"><span class="profile-subtle">This schedule has no lines.</span></td></tr>`;

    const { earliest, latest } = getDateRange(schedule);
    if (!lines.length) {
      $("#dsGrandTotalLine").textContent = "";
    } else if (earliest === latest) {
      $("#dsGrandTotalLine").textContent = `All lines planned for ${earliest || "an unset date"}.`;
    } else {
      $("#dsGrandTotalLine").textContent = `Planned across ${earliest} through ${latest}.`;
    }
  }

  function renderDetailFooter(schedule) {
    const footer = $("#dsDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (schedule.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(schedule));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("dsDetailModal"); openEditModal(schedule); });
      addBtn("Finalize", "btn btn--primary", () => requestFinalize(schedule));
    } else if (schedule.status === "Finalized") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(schedule));
      addBtn("Reopen to Draft", "btn btn--ghost", () => requestReopen(schedule));
    } else if (schedule.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(schedule));
    }
  }

  function openDetailModal(schedule) {
    detailId = schedule.id;
    const po = ERP_PurchaseOrderRepository.findById(schedule.linkedPoId);
    const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
    const warehouse = po && po.deliveryWarehouseId ? ERP_WarehouseRepository.findById(po.deliveryWarehouseId) : null;

    $("#dsDetailTitle").textContent = `${schedule.scheduleCode} · ${schedule.status}`;

    const rows = [];
    rows.push(`<div><dt>Schedule Code</dt><dd><code>${escapeHtml(schedule.scheduleCode)}</code></dd></div>`);
    rows.push(`<div><dt>Purchase Order</dt><dd>${po ? `<code>${escapeHtml(po.poCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Delivery Warehouse</dt><dd>${warehouse ? escapeHtml(warehouse.warehouseName) : "— not set on the PO —"}</dd></div>`);
    rows.push(`<div><dt>Carrier / Transporter</dt><dd>${schedule.carrierName ? escapeHtml(schedule.carrierName) : "—"}</dd></div>`);
    rows.push(`<div><dt>Tracking Reference</dt><dd>${schedule.trackingReference ? escapeHtml(schedule.trackingReference) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(schedule.status)}">${schedule.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(schedule.createdAt))}</dd></div>`);
    if (schedule.finalizedAt) rows.push(`<div><dt>Finalized</dt><dd>${formatDateTime(new Date(schedule.finalizedAt))} by ${escapeHtml(ERP_DeliveryScheduleRepository.actorLabel(schedule.finalizedByUsername))}</dd></div>`);
    if (typeof ERP_GoodsReceiptRepository !== "undefined") {
      const linkedReceipt = ERP_GoodsReceiptRepository.findReceiptForSchedule(company.id, schedule.id);
      if (linkedReceipt) {
        const receiptBadgeClass = linkedReceipt.status === "Logged" ? "success" : linkedReceipt.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Goods Receipt</dt><dd><code>${escapeHtml(linkedReceipt.receiptCode)}</code> <span class="status-badge status-badge--${receiptBadgeClass}">${escapeHtml(linkedReceipt.status)}</span></dd></div>`);
      } else if (schedule.status === "Finalized") {
        rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Ready to log what arrives — see <strong>Goods Receipt</strong>.</dd></div>`);
      }
    }
    if (schedule.status === "Cancelled" && schedule.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(schedule.cancelledAt))} by ${escapeHtml(ERP_DeliveryScheduleRepository.actorLabel(schedule.cancelledByUsername))}</dd></div>`);
    if (schedule.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(schedule.notes)}</dd></div>`);

    $("#dsDetailBody").innerHTML = rows.join("");
    renderLineItemsTable(schedule);
    renderDetailFooter(schedule);
    openModal("dsDetailModal");
  }

  function bindDetailModal() {
    $("#dsTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const s = ERP_DeliveryScheduleRepository.findById(viewBtn.dataset.id);
        if (s) openDetailModal(s);
        return;
      }
      if (actionBtn) {
        const s = ERP_DeliveryScheduleRepository.findById(actionBtn.dataset.id);
        if (!s) return;
        if (actionBtn.dataset.action === "finalize") requestFinalize(s);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "delivery-schedule")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading delivery schedules…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#dsContent").hidden = true;
      $("#dsSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#dsContent").hidden = false;
      $("#dsHeaderActions").hidden = false;
      $("#dsSubtitle").textContent = `Planning deliveries for ${company.name} (${company.companyCode}).`;

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
