/* =============================================================================
   DOT ERP — pages/payment-request.js
   Phase 4, Module 18: Payment Request

   See data/payment-request-data.js's header for the full design
   rationale (built from an Approved match, no line items, the full
   approval gate living on THIS page rather than a separate approval
   module — the Department Need precedent, not the PR/PO one — and bank
   details resolved from the vendor, not chosen). UI-layer decisions on
   top of that:

   - THE FULL 5-STATE LIFECYCLE (Submit/Withdraw/Approve/Reject/Revise/
     Cancel/Delete) LIVES ON THIS ONE PAGE, mirroring department-need.js's
     own shape exactly rather than the PR/PO Approval two-page split —
     see the data file's header for why.
   - "PAY TO" BANK DETAILS render read-only in both the form and detail
     view via `ERP_VendorRepository.getEffectiveBankDetails()`, never as
     an editable field — a real payment request doesn't choose an
     account, it pays into whatever the vendor has on file.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime, formatCurrency,
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
  let rejectingId = null;


  function statusBadgeClass(status) {
    if (status === "Approved") return "success";
    if (status === "Rejected") return "danger";
    if (status === "Submitted") return "warning";
    return "neutral"; // Draft, Cancelled
  }

  function quickActionFor(p) {
    if (p.status === "Draft") return { action: "submit", label: "Submit" };
    if (p.status === "Rejected") return { action: "revise", label: "Revise" };
    return null;
  }

  /** match -> invoice -> PO, for vendor/bank resolution. */
  function resolveVendor(match) {
    if (!match) return null;
    const { po } = ERP_ThreeWayMatchingRepository.computeMatchLines(company, match);
    return po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_PaymentRequestRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((p) => p.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((p) => {
        const match = p.linkedMatchId ? ERP_ThreeWayMatchingRepository.findById(p.linkedMatchId) : null;
        const vendor = match ? resolveVendor(match) : null;
        return p.requestCode.toLowerCase().includes(term) ||
          (match && match.matchCode.toLowerCase().includes(term)) ||
          (vendor && vendor.vendorName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_PaymentRequestRepository.getAllForCompany(company.id);
    $("#pmrSummaryTotal").textContent = String(all.length);
    $("#pmrSummaryDraft").textContent = String(all.filter((p) => p.status === "Draft").length);
    $("#pmrSummarySubmitted").textContent = String(all.filter((p) => p.status === "Submitted").length);
    $("#pmrSummaryApproved").textContent = String(all.filter((p) => p.status === "Approved").length);
    $("#pmrSummaryRejected").textContent = String(all.filter((p) => p.status === "Rejected").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#pmrPagination");
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

    $("#pmrEmptyState").hidden = all.length !== 0;
    $("#pmrTable").hidden = all.length === 0;

    $("#pmrTableBody").innerHTML = pageItems.map((p) => {
      const match = p.linkedMatchId ? ERP_ThreeWayMatchingRepository.findById(p.linkedMatchId) : null;
      const vendor = match ? resolveVendor(match) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(p.status)}">${p.status}</span>`;
      const amountLabel = p.requestedAmount != null ? formatCurrency(p.requestedAmount) : `<span class="profile-subtle">—</span>`;
      const qa = quickActionFor(p);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${p.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(p.requestCode)}</code></td>
        <td>${match ? `<code>${escapeHtml(match.matchCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${amountLabel}</td>
        <td>${p.dueDate ? escapeHtml(p.dueDate) : `<span class="profile-subtle">—</span>`}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${p.id}">View</button>
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
    $$("#pmrStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#pmrStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#pmrSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#pmrSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#pmrExportCsvBtn").addEventListener("click", exportCsv);
    $("#pmrPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Request Code", "Match Code", "Vendor", "Requested Amount", "Due Date", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((p) => {
      const match = p.linkedMatchId ? ERP_ThreeWayMatchingRepository.findById(p.linkedMatchId) : null;
      const vendor = match ? resolveVendor(match) : null;
      const line = [
        p.requestCode, match ? match.matchCode : "", vendor ? vendor.vendorName : "",
        p.requestedAmount != null ? p.requestedAmount : "", p.dueDate || "", p.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-payment-requests-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Payment requests exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((p) => {
      const match = p.linkedMatchId ? ERP_ThreeWayMatchingRepository.findById(p.linkedMatchId) : null;
      const vendor = match ? resolveVendor(match) : null;
      return `<tr><td>${escapeHtml(p.requestCode)}</td><td>${vendor ? escapeHtml(vendor.vendorName) : ""}</td><td>${p.requestedAmount != null ? escapeHtml(formatCurrency(p.requestedAmount)) : ""}</td><td>${escapeHtml(p.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Payment Request Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Payment Request Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Request Code</th><th>Vendor</th><th>Amount</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Payment Request")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#pmrActivityEmptyState").hidden = relevant.length !== 0;
    $("#pmrActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#pmrFormModal)
     --------------------------------------------------------------------- */
  function populateMatchOptions(currentId) {
    let matches = ERP_PaymentRequestRepository.getAvailableApprovedMatchesForCompany(company.id, editingId);
    if (currentId && !matches.some((m) => m.id === currentId)) {
      const current = ERP_ThreeWayMatchingRepository.findById(currentId);
      if (current) matches = matches.concat([current]);
    }
    $("#pmrFormMatch").innerHTML = matches.map((m) => {
      const vendor = resolveVendor(m);
      const label = `${m.matchCode}${vendor ? ` — ${vendor.vendorName}` : ""}`;
      return `<option value="${m.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function populateEmployeeOptions(currentId) {
    let employees = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status === "Active");
    if (currentId && !employees.some((e) => e.id === currentId)) {
      const current = ERP_EmployeeRepository.findById(currentId);
      if (current) employees = employees.concat([current]);
    }
    $("#pmrFormRequestedBy").innerHTML = `<option value="">Not set</option>` + employees.map((e) =>
      `<option value="${e.id}">${escapeHtml(e.fullName)} (${escapeHtml(e.employeeCode)})</option>`
    ).join("");
  }

  function renderMatchInfo(match) {
    const box = $("#pmrFormMatchInfo");
    if (!match) { box.textContent = ""; return; }
    const vendor = resolveVendor(match);
    const bank = vendor ? ERP_VendorRepository.getEffectiveBankDetails(vendor) : null;
    const bankLabel = bank && bank.accountNumber ? `${bank.bankName || "Bank"} · ${bank.accountNumber}` : "no bank details on file";
    box.textContent = `Vendor: ${vendor ? vendor.vendorName : "Removed"} — pays to ${bankLabel}.`;
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("pmrFormMatch", ""); }

  function openAddModal() {
    const available = ERP_PaymentRequestRepository.getAvailableApprovedMatchesForCompany(company.id, null);
    if (!available.length) {
      showToast("No Approved-for-Payment matches are currently available to request payment for. Approve one in Three-Way Matching first.", "warning");
      return;
    }
    editingId = null;
    $("#pmrFormTitle").textContent = "New payment request";
    $("#pmrFormIntro").textContent = "Pick the Approved-for-Payment match to request payment for.";
    $("#pmrFormSaveBtn").textContent = "Create Payment Request";
    populateMatchOptions(null);
    const firstMatch = ERP_ThreeWayMatchingRepository.findById($("#pmrFormMatch").value);
    renderMatchInfo(firstMatch);
    populateEmployeeOptions(null);
    $("#pmrFormAmount").value = firstMatch ? (ERP_PaymentRequestRepository.computeDefaultAmount(firstMatch) ?? "") : "";
    $("#pmrFormDueDate").value = "";
    $("#pmrFormNotes").value = "";
    clearFormErrors();
    openModal("pmrFormModal");
  }

  function openEditModal(p) {
    if (!ERP_PaymentRequestRepository.canEdit(p)) {
      showToast(`"${p.requestCode}" is ${p.status} and can't be edited directly. Withdraw or revise it back to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = p.id;
    $("#pmrFormTitle").textContent = "Edit payment request";
    $("#pmrFormIntro").textContent = "Update which match this request is for, or adjust the requested amount.";
    $("#pmrFormSaveBtn").textContent = "Save Changes";
    populateMatchOptions(p.linkedMatchId);
    $("#pmrFormMatch").value = p.linkedMatchId || "";
    const match = ERP_ThreeWayMatchingRepository.findById(p.linkedMatchId);
    renderMatchInfo(match);
    populateEmployeeOptions(p.requestedByEmployeeId);
    $("#pmrFormRequestedBy").value = p.requestedByEmployeeId || "";
    $("#pmrFormAmount").value = p.requestedAmount != null ? p.requestedAmount : "";
    $("#pmrFormDueDate").value = p.dueDate || "";
    $("#pmrFormNotes").value = p.notes || "";
    clearFormErrors();
    openModal("pmrFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#pmrFormMatch").value) { setFormError("pmrFormMatch", "Select the Approved match to request payment for."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#pmrAddBtn").addEventListener("click", openAddModal);

    $("#pmrFormMatch").addEventListener("change", (e) => {
      const match = ERP_ThreeWayMatchingRepository.findById(e.target.value);
      renderMatchInfo(match);
      $("#pmrFormAmount").value = match ? (ERP_PaymentRequestRepository.computeDefaultAmount(match) ?? "") : "";
    });

    $("#pmrFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const match = ERP_ThreeWayMatchingRepository.findById($("#pmrFormMatch").value);
      const payload = {
        linkedMatchId: $("#pmrFormMatch").value,
        requestedByEmployeeId: $("#pmrFormRequestedBy").value || null,
        requestedAmount: $("#pmrFormAmount").value === "" ? null : Number($("#pmrFormAmount").value),
        dueDate: $("#pmrFormDueDate").value || null,
        notes: $("#pmrFormNotes").value.trim()
      };

      const vendor = match ? resolveVendor(match) : null;
      const label = vendor ? vendor.vendorName : "this vendor";

      if (editingId) {
        openConfirm({
          title: "Save changes to this payment request?",
          message: `This payment request for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_PaymentRequestRepository.update(editingId, payload);
            logSystemActivity({ module: "Payment Request", action: "Update", description: `Updated payment request for ${label} (${company.name})` });
            closeModal("pmrFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_PaymentRequestRepository.findById(editingId));
            showToast("Payment request updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this payment request?",
          message: `A new payment request will be created as a Draft for ${label}.`,
          confirmLabel: "Create Payment Request",
          onConfirm: () => {
            const created = ERP_PaymentRequestRepository.create(company, payload);
            logSystemActivity({ module: "Payment Request", action: "Create", description: `Created payment request "${created.requestCode}" for ${label} (${company.name})` });
            closeModal("pmrFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.requestCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS — the full lifecycle lives on this one page, see
     file header.
     --------------------------------------------------------------------- */
  function requestSubmit(p) {
    openConfirm({
      title: "Submit for approval?",
      message: `"${p.requestCode}" will move to Submitted and await approval.`,
      confirmLabel: "Submit",
      onConfirm: () => {
        ERP_PaymentRequestRepository.submit(p.id, session.username);
        logSystemActivity({ module: "Payment Request", action: "Submit", description: `Submitted payment request "${p.requestCode}" for approval (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === p.id) openDetailModal(ERP_PaymentRequestRepository.findById(p.id));
        showToast(`"${p.requestCode}" submitted for approval.`, "success");
      }
    });
  }

  function requestWithdraw(p) {
    openConfirm({
      title: "Withdraw this payment request?",
      message: `"${p.requestCode}" will move back to Draft so you can make changes.`,
      confirmLabel: "Withdraw",
      onConfirm: () => {
        ERP_PaymentRequestRepository.withdraw(p.id);
        logSystemActivity({ module: "Payment Request", action: "Withdraw", description: `Withdrew payment request "${p.requestCode}" back to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === p.id) openDetailModal(ERP_PaymentRequestRepository.findById(p.id));
        showToast(`"${p.requestCode}" withdrawn to Draft.`, "info");
      }
    });
  }

  function requestApprove(p) {
    openConfirm({
      title: "Approve this payment request?",
      message: `"${p.requestCode}" will be approved and become ready for Vendor Payment to execute.`,
      confirmLabel: "Approve",
      onConfirm: () => {
        ERP_PaymentRequestRepository.approve(p.id, session.username);
        logSystemActivity({ module: "Payment Request", action: "Approve", description: `Approved payment request "${p.requestCode}" (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === p.id) openDetailModal(ERP_PaymentRequestRepository.findById(p.id));
        showToast(`"${p.requestCode}" approved.`, "success");
      }
    });
  }

  function requestReject(p) {
    rejectingId = p.id;
    $("#pmrRejectReason").value = "";
    $("#pmrRejectReasonError").textContent = "";
    openModal("pmrRejectModal");
  }

  function bindRejectModal() {
    $("#pmrRejectConfirmBtn").addEventListener("click", () => {
      const reason = $("#pmrRejectReason").value.trim();
      if (!reason) { $("#pmrRejectReasonError").textContent = "A reason is required so the requester knows what to fix."; return; }
      const p = ERP_PaymentRequestRepository.findById(rejectingId);
      if (!p) { closeModal("pmrRejectModal"); return; }
      ERP_PaymentRequestRepository.reject(p.id, session.username, reason);
      logSystemActivity({ module: "Payment Request", action: "Reject", description: `Rejected payment request "${p.requestCode}": ${reason} (${company.name})`, severity: "warning" });
      closeModal("pmrRejectModal");
      renderAll();
      renderActivity();
      if (detailId === p.id) openDetailModal(ERP_PaymentRequestRepository.findById(p.id));
      showToast(`"${p.requestCode}" rejected.`, "info");
    });
  }

  function requestRevise(p) {
    openConfirm({
      title: "Revise this payment request?",
      message: `"${p.requestCode}" will move back to Draft so you can correct it and resubmit.`,
      confirmLabel: "Revise",
      onConfirm: () => {
        ERP_PaymentRequestRepository.reopen(p.id);
        logSystemActivity({ module: "Payment Request", action: "Revise", description: `Reopened payment request "${p.requestCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === p.id) openDetailModal(ERP_PaymentRequestRepository.findById(p.id));
        showToast(`"${p.requestCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(p) {
    openConfirm({
      title: "Cancel this payment request?",
      message: `"${p.requestCode}" will be marked Cancelled and its match freed up for a different request.`,
      confirmLabel: "Cancel Request",
      onConfirm: () => {
        ERP_PaymentRequestRepository.cancel(p.id, session.username);
        logSystemActivity({ module: "Payment Request", action: "Cancel", description: `Cancelled payment request "${p.requestCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === p.id) openDetailModal(ERP_PaymentRequestRepository.findById(p.id));
        showToast(`"${p.requestCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(p) {
    if (!ERP_PaymentRequestRepository.canDelete(p)) {
      showToast(`"${p.requestCode}" is ${p.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this payment request?",
      message: `"${p.requestCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_PaymentRequestRepository.remove(p.id);
        logSystemActivity({ module: "Payment Request", action: "Delete", description: `Deleted payment request "${p.requestCode}" (${company.name})`, severity: "warning" });
        if (detailId === p.id) closeModal("pmrDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${p.requestCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(p) {
    const footer = $("#pmrDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (p.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(p));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("pmrDetailModal"); openEditModal(p); });
      addBtn("Submit for Approval", "btn btn--primary", () => requestSubmit(p));
    } else if (p.status === "Submitted") {
      addBtn("Reject", "btn btn--danger-outline", () => requestReject(p));
      addBtn("Withdraw", "btn btn--ghost", () => requestWithdraw(p));
      addBtn("Approve", "btn btn--primary", () => requestApprove(p));
    } else if (p.status === "Approved") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(p));
    } else if (p.status === "Rejected") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(p));
      addBtn("Revise & Resubmit", "btn btn--primary", () => requestRevise(p));
    } else if (p.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(p));
    }
  }

  function openDetailModal(p) {
    detailId = p.id;
    const match = ERP_ThreeWayMatchingRepository.findById(p.linkedMatchId);
    const vendor = match ? resolveVendor(match) : null;
    const bank = vendor ? ERP_VendorRepository.getEffectiveBankDetails(vendor) : null;
    const requestedBy = p.requestedByEmployeeId ? ERP_EmployeeRepository.findById(p.requestedByEmployeeId) : null;

    $("#pmrDetailTitle").textContent = `${p.requestCode} · ${p.status}`;

    const rows = [];
    rows.push(`<div><dt>Request Code</dt><dd><code>${escapeHtml(p.requestCode)}</code></dd></div>`);
    rows.push(`<div><dt>Three-Way Match</dt><dd>${match ? `<code>${escapeHtml(match.matchCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Pay To</dt><dd>${bank && bank.accountNumber ? `${escapeHtml(bank.bankName || "Bank")} · ${escapeHtml(bank.accountNumber)}` : "— no bank details on file —"}</dd></div>`);
    rows.push(`<div><dt>Requested By</dt><dd>${requestedBy ? escapeHtml(requestedBy.fullName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Requested Amount</dt><dd>${p.requestedAmount != null ? escapeHtml(formatCurrency(p.requestedAmount)) : "—"}</dd></div>`);
    rows.push(`<div><dt>Due Date</dt><dd>${p.dueDate ? escapeHtml(p.dueDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(p.status)}">${p.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(p.createdAt))}</dd></div>`);
    if (p.submittedAt) rows.push(`<div><dt>Submitted</dt><dd>${formatDateTime(new Date(p.submittedAt))} by ${escapeHtml(ERP_PaymentRequestRepository.actorLabel(p.submittedByUsername))}</dd></div>`);
    if (p.approvedAt) rows.push(`<div><dt>Approved</dt><dd>${formatDateTime(new Date(p.approvedAt))} by ${escapeHtml(ERP_PaymentRequestRepository.actorLabel(p.approvedByUsername))}</dd></div>`);
    if (typeof ERP_VendorPaymentRepository !== "undefined") {
      const linkedPayment = ERP_VendorPaymentRepository.findPaymentForRequest(company.id, p.id);
      if (linkedPayment) {
        const paymentBadgeClass = linkedPayment.status === "Paid" ? "success" : linkedPayment.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Vendor Payment</dt><dd><code>${escapeHtml(linkedPayment.paymentCode)}</code> <span class="status-badge status-badge--${paymentBadgeClass}">${escapeHtml(linkedPayment.status)}</span></dd></div>`);
      } else if (p.status === "Approved") {
        rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Ready to execute — see <strong>Vendor Payment</strong>.</dd></div>`);
      }
    }
    if (p.status === "Rejected" && p.rejectedAt) {
      rows.push(`<div><dt>Rejected</dt><dd>${formatDateTime(new Date(p.rejectedAt))} by ${escapeHtml(ERP_PaymentRequestRepository.actorLabel(p.rejectedByUsername))}</dd></div>`);
      rows.push(`<div><dt>Rejection Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(p.rejectionReason || "—")}</dd></div>`);
    }
    if (p.status === "Cancelled" && p.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(p.cancelledAt))} by ${escapeHtml(ERP_PaymentRequestRepository.actorLabel(p.cancelledByUsername))}</dd></div>`);
    if (p.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(p.notes)}</dd></div>`);

    $("#pmrDetailBody").innerHTML = rows.join("");
    renderDetailFooter(p);
    openModal("pmrDetailModal");
  }

  function bindDetailModal() {
    $("#pmrTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const p = ERP_PaymentRequestRepository.findById(viewBtn.dataset.id);
        if (p) openDetailModal(p);
        return;
      }
      if (actionBtn) {
        const p = ERP_PaymentRequestRepository.findById(actionBtn.dataset.id);
        if (!p) return;
        if (actionBtn.dataset.action === "submit") requestSubmit(p);
        else if (actionBtn.dataset.action === "revise") requestRevise(p);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "payment-request")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading payment requests…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#pmrContent").hidden = true;
      $("#pmrSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#pmrContent").hidden = false;
      $("#pmrHeaderActions").hidden = false;
      $("#pmrSubtitle").textContent = `Managing payment requests for ${company.name} (${company.companyCode}).`;

      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
      bindRejectModal();

      if (new URLSearchParams(window.location.search).get("action") === "add") {
        openAddModal();
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
