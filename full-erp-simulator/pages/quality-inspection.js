/* =============================================================================
   DOT ERP — pages/quality-inspection.js
   Phase 4, Module 15: Quality Inspection

   See data/quality-inspection-data.js's header for the full design
   rationale (built from a Posted GRN, exclusivity, the Accepted/Rejected
   split, and — importantly — why this module's numbers deliberately do
   NOT feed forward into Three-Way Matching's math). UI-layer decisions
   on top of that:

   - EACH LINE STARTS FULLY ACCEPTED (Rejected = 0), an active default
     that must be overridden, not a neutral blank. The form's own intro
     text says this explicitly for the same reason Goods Receipt's did
     for its received-quantity default — the pre-fill is a starting
     point, never an assumption that everything passed.
   - A LINE-LEVEL RECONCILIATION CHECK: if Accepted + Rejected doesn't
     equal the line's own quantity, both the form and the read-only
     detail view flag it visually (a warning badge), the same treatment
     Goods Receipt gave a quantity shortfall one module back.
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
    if (status === "Completed") return "success";
    if (status === "Cancelled") return "neutral";
    return "warning"; // Draft
  }

  function quickActionFor(inspection) {
    if (inspection.status === "Draft") return { action: "complete", label: "Complete" };
    return null;
  }

  /** grn -> receipt -> schedule -> PO -> quotation -> RFQ -> PR, resolving
      a line's description AND the PO (for vendor display). */
  function resolveChain(grn) {
    const receipt = grn ? ERP_GoodsReceiptRepository.findById(grn.linkedReceiptId) : null;
    const schedule = receipt ? ERP_DeliveryScheduleRepository.findById(receipt.linkedScheduleId) : null;
    const po = schedule ? ERP_PurchaseOrderRepository.findById(schedule.linkedPoId) : null;
    const quotation = po ? ERP_QuotationRepository.findById(po.linkedQuotationId) : null;
    const rfq = quotation ? ERP_RfqRepository.findById(quotation.rfqId) : null;
    const pr = rfq ? ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId) : null;
    return { receipt, po, pr };
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_QualityInspectionRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((q) => q.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((q) => {
        const grn = q.linkedGrnId ? ERP_GrnRepository.findById(q.linkedGrnId) : null;
        return q.inspectionCode.toLowerCase().includes(term) || (grn && grn.grnNumber.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_QualityInspectionRepository.getAllForCompany(company.id);
    $("#qiSummaryTotal").textContent = String(all.length);
    $("#qiSummaryDraft").textContent = String(all.filter((q) => q.status === "Draft").length);
    $("#qiSummaryLogged").textContent = String(all.filter((q) => q.status === "Completed").length);
    $("#qiSummaryCancelled").textContent = String(all.filter((q) => q.status === "Cancelled").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#qiPagination");
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

    $("#qiEmptyState").hidden = all.length !== 0;
    $("#qiTable").hidden = all.length === 0;

    $("#qiTableBody").innerHTML = pageItems.map((q) => {
      const grn = q.linkedGrnId ? ERP_GrnRepository.findById(q.linkedGrnId) : null;
      const { po } = resolveChain(grn);
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(q.status)}">${q.status}</span>`;
      const rejected = ERP_QualityInspectionRepository.computeTotalRejected(q);
      const rejectedCell = rejected > 0 ? `<span class="status-badge status-badge--warning">${rejected}</span>` : "0";
      const qa = quickActionFor(q);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${q.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(q.inspectionCode)}</code></td>
        <td>${grn ? `<code>${escapeHtml(grn.grnNumber)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${(q.inspectionLines || []).length}</td>
        <td>${rejectedCell}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${q.id}">View</button>
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
    $$("#qiStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#qiStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#qiSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#qiSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#qiExportCsvBtn").addEventListener("click", exportCsv);
    $("#qiPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Inspection Code", "GRN Number", "Vendor", "Lines", "Rejected Units", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((q) => {
      const grn = q.linkedGrnId ? ERP_GrnRepository.findById(q.linkedGrnId) : null;
      const { po } = resolveChain(grn);
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const line = [
        q.inspectionCode, grn ? grn.grnNumber : "", vendor ? vendor.vendorName : "",
        (q.inspectionLines || []).length, ERP_QualityInspectionRepository.computeTotalRejected(q), q.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-quality-inspections-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Quality inspections exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((q) => {
      const grn = q.linkedGrnId ? ERP_GrnRepository.findById(q.linkedGrnId) : null;
      return `<tr><td>${escapeHtml(q.inspectionCode)}</td><td>${grn ? escapeHtml(grn.grnNumber) : ""}</td><td>${ERP_QualityInspectionRepository.computeTotalRejected(q)}</td><td>${escapeHtml(q.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Quality Inspection Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Quality Inspection Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Inspection Code</th><th>GRN</th><th>Rejected Units</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Quality Inspection")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#qiActivityEmptyState").hidden = relevant.length !== 0;
    $("#qiActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#qiFormModal)
     --------------------------------------------------------------------- */
  function populateGrnOptions(currentId) {
    let grns = ERP_QualityInspectionRepository.getAvailablePostedGrnsForCompany(company.id, editingId);
    if (currentId && !grns.some((g) => g.id === currentId)) {
      const current = ERP_GrnRepository.findById(currentId);
      if (current) grns = grns.concat([current]);
    }
    $("#qiFormSchedule").innerHTML = grns.map((g) => {
      const { po } = resolveChain(g);
      const label = `${g.grnNumber}${po ? ` — ${po.poCode}` : ""}`;
      return `<option value="${g.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function populateEmployeeOptions(currentId) {
    let employees = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status === "Active");
    if (currentId && !employees.some((e) => e.id === currentId)) {
      const current = ERP_EmployeeRepository.findById(currentId);
      if (current) employees = employees.concat([current]);
    }
    $("#qiFormReceivedBy").innerHTML = `<option value="">Not set</option>` + employees.map((e) =>
      `<option value="${e.id}">${escapeHtml(e.fullName)} (${escapeHtml(e.employeeCode)})</option>`
    ).join("");
  }

  function renderGrnInfo(grn) {
    const box = $("#qiFormScheduleInfo");
    if (!grn) { box.textContent = ""; return; }
    const { po } = resolveChain(grn);
    const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
    box.textContent = `Vendor: ${vendor ? vendor.vendorName : "Removed"}${po ? ` — from ${po.poCode}` : ""}.`;
  }

  function renderFormLineTable(grn, existingLines) {
    const grnLines = grn ? (grn.grnLines || []) : [];
    const existingByLine = {};
    (existingLines || []).forEach((l) => { existingByLine[l.prLineItemId] = l; });

    if (!grnLines.length) {
      $("#qiFormLineTableBody").innerHTML = `<tr><td colspan="5"><span class="profile-subtle">Pick a GRN to load its lines.</span></td></tr>`;
      return;
    }
    const { pr } = resolveChain(grn);
    const prLineById = {};
    (pr ? pr.lineItems || [] : []).forEach((l) => { prLineById[l.id] = l; });

    $("#qiFormLineTableBody").innerHTML = grnLines.map((line) => {
      const prLine = prLineById[line.prLineItemId];
      const item = prLine && prLine.itemId ? ERP_ItemRepository.findById(prLine.itemId) : null;
      const label = item
        ? `${escapeHtml(item.itemName)}${prLine.lineDescription ? " — " + escapeHtml(prLine.lineDescription) : ""}`
        : escapeHtml((prLine && prLine.lineDescription) || "—");
      const existing = existingByLine[line.prLineItemId];
      const acceptedQty = existing ? existing.acceptedQuantity : line.quantity;
      const rejectedQty = existing ? existing.rejectedQuantity : 0;
      const reason = existing ? existing.rejectionReason || "" : "";
      return `
      <tr>
        <td>${label}</td>
        <td>${escapeHtml(String(line.quantity))}</td>
        <td><div class="input-wrap"><input type="number" class="qi-line-accepted" data-line-id="${line.prLineItemId}" data-qty="${line.quantity}" min="0" step="1" value="${acceptedQty}" /></div></td>
        <td><div class="input-wrap"><input type="number" class="qi-line-rejected" data-line-id="${line.prLineItemId}" min="0" step="1" value="${rejectedQty}" /></div></td>
        <td><div class="input-wrap"><input type="text" class="qi-line-reason" data-line-id="${line.prLineItemId}" maxlength="120" value="${escapeHtml(reason)}" placeholder="e.g. 3 units cracked on arrival" /></div></td>
      </tr>`;
    }).join("");
  }

  function collectInspectionLines() {
    return $$(".qi-line-accepted").map((acceptedInput) => {
      const lineId = acceptedInput.dataset.lineId;
      const rejectedInput = document.querySelector(`.qi-line-rejected[data-line-id="${lineId}"]`);
      const reasonInput = document.querySelector(`.qi-line-reason[data-line-id="${lineId}"]`);
      return {
        prLineItemId: lineId,
        quantity: Number(acceptedInput.dataset.qty),
        acceptedQuantity: acceptedInput.value === "" ? 0 : Number(acceptedInput.value),
        rejectedQuantity: rejectedInput && rejectedInput.value !== "" ? Number(rejectedInput.value) : 0,
        rejectionReason: reasonInput ? reasonInput.value.trim() : ""
      };
    });
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("qiFormSchedule", ""); }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function openAddModal() {
    const available = ERP_QualityInspectionRepository.getAvailablePostedGrnsForCompany(company.id, null);
    if (!available.length) {
      showToast("No Posted GRNs are currently available to inspect. Post one in GRN first.", "warning");
      return;
    }
    editingId = null;
    $("#qiFormTitle").textContent = "New quality inspection";
    $("#qiFormIntro").textContent = "Pick the Posted GRN to inspect — each line starts fully Accepted until you say otherwise.";
    $("#qiFormSaveBtn").textContent = "Create Inspection";
    populateGrnOptions(null);
    const firstGrn = ERP_GrnRepository.findById($("#qiFormSchedule").value);
    renderGrnInfo(firstGrn);
    renderFormLineTable(firstGrn, []);
    populateEmployeeOptions(null);
    $("#qiFormReceivedDate").value = todayISO();
    $("#qiFormNotes").value = "";
    clearFormErrors();
    openModal("qiFormModal");
  }

  function openEditModal(inspection) {
    if (!ERP_QualityInspectionRepository.canEdit(inspection)) {
      showToast(`"${inspection.inspectionCode}" is ${inspection.status} and can't be edited directly. Reopen it to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = inspection.id;
    $("#qiFormTitle").textContent = "Edit quality inspection";
    $("#qiFormIntro").textContent = "Update which GRN this inspection covers, or adjust accepted/rejected quantities.";
    $("#qiFormSaveBtn").textContent = "Save Changes";
    populateGrnOptions(inspection.linkedGrnId);
    $("#qiFormSchedule").value = inspection.linkedGrnId || "";
    const grn = ERP_GrnRepository.findById(inspection.linkedGrnId);
    renderGrnInfo(grn);
    renderFormLineTable(grn, inspection.inspectionLines);
    populateEmployeeOptions(inspection.inspectedByEmployeeId);
    $("#qiFormReceivedBy").value = inspection.inspectedByEmployeeId || "";
    $("#qiFormReceivedDate").value = inspection.inspectionDate || todayISO();
    $("#qiFormNotes").value = inspection.notes || "";
    clearFormErrors();
    openModal("qiFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#qiFormSchedule").value) { setFormError("qiFormSchedule", "Select the Posted GRN to inspect."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#qiAddBtn").addEventListener("click", openAddModal);

    $("#qiFormSchedule").addEventListener("change", (e) => {
      const grn = ERP_GrnRepository.findById(e.target.value);
      renderGrnInfo(grn);
      renderFormLineTable(grn, []);
    });

    $("#qiFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const grn = ERP_GrnRepository.findById($("#qiFormSchedule").value);
      const payload = {
        linkedGrnId: $("#qiFormSchedule").value,
        inspectionLines: collectInspectionLines(),
        inspectedByEmployeeId: $("#qiFormReceivedBy").value || null,
        inspectionDate: $("#qiFormReceivedDate").value || null,
        notes: $("#qiFormNotes").value.trim()
      };

      const label = grn ? grn.grnNumber : "this GRN";

      if (editingId) {
        openConfirm({
          title: "Save changes to this inspection?",
          message: `This quality inspection for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_QualityInspectionRepository.update(editingId, payload);
            logSystemActivity({ module: "Quality Inspection", action: "Update", description: `Updated quality inspection for ${label} (${company.name})` });
            closeModal("qiFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_QualityInspectionRepository.findById(editingId));
            showToast("Quality inspection updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this inspection?",
          message: `A new quality inspection will be created as a Draft for ${label}.`,
          confirmLabel: "Create Inspection",
          onConfirm: () => {
            const created = ERP_QualityInspectionRepository.create(company, payload);
            logSystemActivity({ module: "Quality Inspection", action: "Create", description: `Created quality inspection "${created.inspectionCode}" for ${label} (${company.name})` });
            closeModal("qiFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.inspectionCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestComplete(inspection) {
    openConfirm({
      title: "Complete this inspection?",
      message: `"${inspection.inspectionCode}" will be marked Completed — treat this as the final quality record for this delivery.`,
      confirmLabel: "Complete",
      onConfirm: () => {
        ERP_QualityInspectionRepository.complete(inspection.id, session.username);
        logSystemActivity({ module: "Quality Inspection", action: "Complete", description: `Completed quality inspection "${inspection.inspectionCode}" (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === inspection.id) openDetailModal(ERP_QualityInspectionRepository.findById(inspection.id));
        showToast(`"${inspection.inspectionCode}" completed.`, "success");
      }
    });
  }

  function requestReopen(inspection) {
    openConfirm({
      title: "Reopen this inspection?",
      message: `"${inspection.inspectionCode}" will move back to Draft so you can correct it.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_QualityInspectionRepository.reopen(inspection.id);
        logSystemActivity({ module: "Quality Inspection", action: "Reopen", description: `Reopened quality inspection "${inspection.inspectionCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === inspection.id) openDetailModal(ERP_QualityInspectionRepository.findById(inspection.id));
        showToast(`"${inspection.inspectionCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(inspection) {
    openConfirm({
      title: "Cancel this inspection?",
      message: `"${inspection.inspectionCode}" will be marked Cancelled and its GRN freed up for a different inspection.`,
      confirmLabel: "Cancel Inspection",
      onConfirm: () => {
        ERP_QualityInspectionRepository.cancel(inspection.id, session.username);
        logSystemActivity({ module: "Quality Inspection", action: "Cancel", description: `Cancelled quality inspection "${inspection.inspectionCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === inspection.id) openDetailModal(ERP_QualityInspectionRepository.findById(inspection.id));
        showToast(`"${inspection.inspectionCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(inspection) {
    if (!ERP_QualityInspectionRepository.canDelete(inspection)) {
      showToast(`"${inspection.inspectionCode}" is ${inspection.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this inspection?",
      message: `"${inspection.inspectionCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_QualityInspectionRepository.remove(inspection.id);
        logSystemActivity({ module: "Quality Inspection", action: "Delete", description: `Deleted quality inspection "${inspection.inspectionCode}" (${company.name})`, severity: "warning" });
        if (detailId === inspection.id) closeModal("qiDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${inspection.inspectionCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderLineItemsTable(inspection) {
    const grn = ERP_GrnRepository.findById(inspection.linkedGrnId);
    const { pr } = resolveChain(grn);
    const prLineById = {};
    (pr ? pr.lineItems || [] : []).forEach((l) => { prLineById[l.id] = l; });

    const lines = inspection.inspectionLines || [];
    $("#qiLineTableBody").innerHTML = lines.length
      ? lines.map((line) => {
          const prLine = prLineById[line.prLineItemId];
          const item = prLine && prLine.itemId ? ERP_ItemRepository.findById(prLine.itemId) : null;
          const label = item
            ? `${escapeHtml(item.itemName)}${prLine.lineDescription ? " — " + escapeHtml(prLine.lineDescription) : ""}`
            : escapeHtml((prLine && prLine.lineDescription) || "—");
          const reconciled = Number(line.acceptedQuantity) + Number(line.rejectedQuantity) === Number(line.quantity);
          const acceptedCell = reconciled ? escapeHtml(String(line.acceptedQuantity)) : `<span class="status-badge status-badge--warning">${escapeHtml(String(line.acceptedQuantity))}</span>`;
          const rejectedCell = Number(line.rejectedQuantity) > 0 ? `<span class="status-badge status-badge--danger">${escapeHtml(String(line.rejectedQuantity))}</span>` : "0";
          return `<tr><td>${label}</td><td>${escapeHtml(String(line.quantity))}</td><td>${acceptedCell}</td><td>${rejectedCell}</td><td>${line.rejectionReason ? escapeHtml(line.rejectionReason) : `<span class="profile-subtle">—</span>`}</td></tr>`;
        }).join("")
      : `<tr><td colspan="5"><span class="profile-subtle">This inspection has no lines.</span></td></tr>`;

    const totalRejected = ERP_QualityInspectionRepository.computeTotalRejected(inspection);
    const unreconciled = lines.filter((l) => Number(l.acceptedQuantity) + Number(l.rejectedQuantity) !== Number(l.quantity));
    if (!lines.length) {
      $("#qiGrandTotalLine").textContent = "";
    } else if (unreconciled.length) {
      $("#qiGrandTotalLine").textContent = `${unreconciled.length} line(s) don't reconcile (accepted + rejected ≠ quantity) — ${totalRejected} unit(s) rejected overall.`;
    } else if (totalRejected > 0) {
      $("#qiGrandTotalLine").textContent = `${totalRejected} unit(s) rejected across ${lines.length} line(s).`;
    } else {
      $("#qiGrandTotalLine").textContent = `All ${lines.length} line(s) fully accepted.`;
    }
  }

  function renderDetailFooter(inspection) {
    const footer = $("#qiDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (inspection.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(inspection));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("qiDetailModal"); openEditModal(inspection); });
      addBtn("Complete", "btn btn--primary", () => requestComplete(inspection));
    } else if (inspection.status === "Completed") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(inspection));
      addBtn("Reopen to Draft", "btn btn--ghost", () => requestReopen(inspection));
    } else if (inspection.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(inspection));
    }
  }

  function openDetailModal(inspection) {
    detailId = inspection.id;
    const grn = ERP_GrnRepository.findById(inspection.linkedGrnId);
    const { po } = resolveChain(grn);
    const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
    const inspectedBy = inspection.inspectedByEmployeeId ? ERP_EmployeeRepository.findById(inspection.inspectedByEmployeeId) : null;

    $("#qiDetailTitle").textContent = `${inspection.inspectionCode} · ${inspection.status}`;

    const rows = [];
    rows.push(`<div><dt>Inspection Code</dt><dd><code>${escapeHtml(inspection.inspectionCode)}</code></dd></div>`);
    rows.push(`<div><dt>GRN</dt><dd>${grn ? `<code>${escapeHtml(grn.grnNumber)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Inspected By</dt><dd>${inspectedBy ? escapeHtml(inspectedBy.fullName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Inspection Date</dt><dd>${inspection.inspectionDate ? escapeHtml(inspection.inspectionDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(inspection.status)}">${inspection.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(inspection.createdAt))}</dd></div>`);
    if (inspection.completedAt) rows.push(`<div><dt>Completed</dt><dd>${formatDateTime(new Date(inspection.completedAt))} by ${escapeHtml(ERP_QualityInspectionRepository.actorLabel(inspection.completedByUsername))}</dd></div>`);
    if (inspection.status === "Cancelled" && inspection.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(inspection.cancelledAt))} by ${escapeHtml(ERP_QualityInspectionRepository.actorLabel(inspection.cancelledByUsername))}</dd></div>`);
    if (inspection.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(inspection.notes)}</dd></div>`);

    $("#qiDetailBody").innerHTML = rows.join("");
    renderLineItemsTable(inspection);
    renderDetailFooter(inspection);
    openModal("qiDetailModal");
  }

  function bindDetailModal() {
    $("#qiTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const q = ERP_QualityInspectionRepository.findById(viewBtn.dataset.id);
        if (q) openDetailModal(q);
        return;
      }
      if (actionBtn) {
        const q = ERP_QualityInspectionRepository.findById(actionBtn.dataset.id);
        if (!q) return;
        if (actionBtn.dataset.action === "complete") requestComplete(q);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "quality-inspection")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading quality inspections…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#qiContent").hidden = true;
      $("#qiSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#qiContent").hidden = false;
      $("#qiHeaderActions").hidden = false;
      $("#qiSubtitle").textContent = `Running quality inspections for ${company.name} (${company.companyCode}).`;

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
