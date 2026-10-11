/* =============================================================================
   DOT ERP — pages/payment-collection.js
   Phase 5, Module 8: Payment Collection

   See data/payment-collection-data.js's header for the full design
   rationale (why this rejects Vendor Payment's shape and reuses Customer
   Inquiry's 5-state pipeline instead, why it's NOT exclusive over its
   parent invoice — the biggest structural difference from every module
   since Delivery Schedule). UI-layer decisions on top of that:

   - ACTION MATRIX mirrors Customer Inquiry's almost exactly: Open offers
     a quick Start Follow-up, In Progress offers a quick Mark Collected,
     Written Off/Cancelled offer neither (secondary enough to live only
     in Detail) — Written Off additionally offers a quick Reopen, the
     same as Customer Inquiry's own Lost row.
   - WRITE OFF gets its own small modal (#pcolWriteOffModal), the exact
     same "capture free text before a negative terminal state" shape as
     Customer Inquiry's own Mark Lost modal — every other transition is
     a plain openConfirm().
   - THE INVOICE PICKER IS NEVER LOCKED, EVEN IN EDIT MODE — a deliberate
     mirror of Customer Inquiry's own choice, not an oversight: edits are
     only permitted while still Open (canEdit()), before any follow-up
     work has actually started, so correcting a wrong invoice pick at
     that early stage is a reasonable data-entry fix, the same as
     Customer Inquiry never locking its own Customer field either.
   - THE INVOICE PICKER OFFERS *EVERY* RAISED INVOICE, ALWAYS — no
     "available" filtering at all, since this module was deliberately
     built with no exclusivity claim over its parent (see file header).
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
  let sortOrder = "desc"; // newest first by default
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;
  let writingOffId = null; // the follow-up awaiting a reason in #pcolWriteOffModal


  /* -----------------------------------------------------------------------
     BADGE COLOR MAPPING
     Collected -> success, Written Off -> danger, In Progress -> warning,
     Open/Cancelled -> neutral. Exactly Customer Inquiry's own mapping,
     status names swapped in.
     --------------------------------------------------------------------- */
  function statusBadgeClass(status) {
    if (status === "Collected") return "success";
    if (status === "Written Off") return "danger";
    if (status === "In Progress") return "warning";
    return "neutral"; // Open, Cancelled
  }
  function quickActionFor(p) {
    if (p.status === "Open") return { action: "startFollowUp", label: "Start Follow-up" };
    if (p.status === "In Progress") return { action: "collect", label: "Mark Collected" };
    if (p.status === "Written Off") return { action: "reopen", label: "Reopen" };
    return null;
  }

  /** The invoice's own stored customerId, direct — no chain-walk. */
  function resolveCustomer(invoice) {
    if (!invoice || !invoice.customerId) return null;
    return ERP_CustomerRepository.findById(invoice.customerId);
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_PaymentCollectionRepository.getAllForCompany(company.id); // already newest-first

    if (filterStatus !== "all") rows = rows.filter((p) => p.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((p) => {
        const invoice = p.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(p.linkedInvoiceId) : null;
        const cust = invoice ? resolveCustomer(invoice) : null;
        return p.collectionCode.toLowerCase().includes(term) ||
          (invoice && invoice.invoiceCode.toLowerCase().includes(term)) ||
          (cust && cust.customerName.toLowerCase().includes(term)) ||
          (p.notes || "").toLowerCase().includes(term);
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_PaymentCollectionRepository.getAllForCompany(company.id);
    $("#pcolSummaryTotal").textContent = String(all.length);
    $("#pcolSummaryPending").textContent = String(all.filter((p) => p.status === "In Progress").length);
    $("#pcolSummaryCollected").textContent = String(all.filter((p) => p.status === "Collected").length);
    $("#pcolSummaryWrittenOff").textContent = String(all.filter((p) => p.status === "Written Off").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#pcolPagination");
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

    $("#pcolEmptyState").hidden = all.length !== 0;
    $("#pcolTable").hidden = all.length === 0;

    $("#pcolTableBody").innerHTML = pageItems.map((p) => {
      const invoice = p.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(p.linkedInvoiceId) : null;
      const cust = invoice ? resolveCustomer(invoice) : null;
      const emp = p.assignedToEmployeeId ? ERP_EmployeeRepository.findById(p.assignedToEmployeeId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(p.status)}">${p.status}</span>`;
      const methodBadge = p.followUpMethod ? `<span class="status-badge status-badge--info">${escapeHtml(p.followUpMethod)}</span>` : `<span class="profile-subtle">—</span>`;
      const qa = quickActionFor(p);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${p.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(p.collectionCode)}</code></td>
        <td>${invoice ? `<code>${escapeHtml(invoice.invoiceCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${emp ? escapeHtml(emp.fullName) : `<span class="profile-subtle">Unassigned</span>`}</td>
        <td>${p.followUpDate ? escapeHtml(p.followUpDate) : `<span class="profile-subtle">—</span>`}</td>
        <td>${methodBadge}</td>
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
    $$("#pcolStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#pcolStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#pcolSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#pcolSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#pcolExportCsvBtn").addEventListener("click", exportCsv);
    $("#pcolPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Collection Code", "Invoice Code", "Customer", "Assigned To", "Follow-Up Date", "Method", "Promised Amount", "Promised Date", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((p) => {
      const invoice = p.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(p.linkedInvoiceId) : null;
      const cust = invoice ? resolveCustomer(invoice) : null;
      const emp = p.assignedToEmployeeId ? ERP_EmployeeRepository.findById(p.assignedToEmployeeId) : null;
      const line = [
        p.collectionCode, invoice ? invoice.invoiceCode : "", cust ? cust.customerName : "",
        emp ? emp.fullName : "", p.followUpDate || "", p.followUpMethod || "",
        p.promisedAmount != null ? p.promisedAmount : "", p.promisedDate || "", p.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-payment-collections-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Payment collections exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((p) => {
      const invoice = p.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(p.linkedInvoiceId) : null;
      const cust = invoice ? resolveCustomer(invoice) : null;
      return `<tr><td>${escapeHtml(p.collectionCode)}</td><td>${cust ? escapeHtml(cust.customerName) : ""}</td><td>${escapeHtml(p.followUpMethod || "")}</td><td>${escapeHtml(p.followUpDate || "")}</td><td>${escapeHtml(p.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Payment Collection Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Payment Collection Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Collection Code</th><th>Customer</th><th>Method</th><th>Follow-Up Date</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Payment Collection")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#pcolActivityEmptyState").hidden = relevant.length !== 0;
    $("#pcolActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT FORM
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["pcolFormInvoice", "pcolFormFollowUpDate", "pcolFormMethod", "pcolFormPromisedAmount"].forEach((f) => setFormError(f, ""));
  }

  /** Every Raised invoice, always — no exclusivity filtering at all. See
      file header and payment-collection-data.js's own header. */
  function populateInvoiceOptions(currentId) {
    let invoices = ERP_TaxInvoiceRepository.getRaisedForCompany(company.id);
    if (currentId && !invoices.some((inv) => inv.id === currentId)) {
      const current = ERP_TaxInvoiceRepository.findById(currentId);
      if (current) invoices = invoices.concat([current]);
    }
    $("#pcolFormInvoice").innerHTML = invoices.map((inv) => {
      const cust = resolveCustomer(inv);
      const label = `${inv.invoiceCode}${cust ? ` — ${cust.customerName}` : ""}`;
      return `<option value="${inv.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  /** Assigned To is optional at save time (only required before Start
      Follow-up — see data/payment-collection-data.js's header), so this
      picker gets an explicit "Unassigned" option. */
  function populateAssigneeOptions(currentId) {
    let emps = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status !== "Inactive");
    if (currentId && !emps.some((e) => e.id === currentId)) {
      const current = ERP_EmployeeRepository.findById(currentId);
      if (current) emps = emps.concat([current]);
    }
    emps = emps.slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
    $("#pcolFormAssignee").innerHTML = `<option value="">Unassigned</option>` + emps.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)} (${escapeHtml(e.employeeCode)})</option>`).join("");
  }

  function populateMethodOptions() {
    $("#pcolFormMethod").innerHTML = `<option value="">Not set</option>` +
      ERP_PaymentCollectionRepository.collectionMethods.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function openAddModal() {
    const anyInvoice = ERP_TaxInvoiceRepository.getRaisedForCompany(company.id).length > 0;
    if (!anyInvoice) {
      showToast("Raise at least one tax invoice before logging a collection follow-up.", "warning");
      return;
    }
    editingId = null;
    $("#pcolFormTitle").textContent = "Log a follow-up";
    $("#pcolFormIntro").textContent = "Pick the Raised tax invoice this follow-up is for — the same invoice can have several follow-ups over time.";
    $("#pcolFormSaveBtn").textContent = "Log Follow-Up";
    populateInvoiceOptions(null);
    populateAssigneeOptions(null);
    populateMethodOptions();
    $("#pcolFormAssignee").value = "";
    $("#pcolFormMethod").value = "";
    $("#pcolFormFollowUpDate").value = todayISO();
    $("#pcolFormPromisedAmount").value = "";
    $("#pcolFormPromisedDate").value = "";
    $("#pcolFormNotes").value = "";
    clearFormErrors();
    openModal("pcolFormModal");
  }

  function openEditModal(p) {
    if (!ERP_PaymentCollectionRepository.canEdit(p)) {
      showToast(`"${p.collectionCode}" is ${p.status} and can't be edited directly. Return it to Open first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = p.id;
    $("#pcolFormTitle").textContent = "Edit follow-up";
    $("#pcolFormIntro").textContent = "Update this follow-up's details while it's still Open.";
    $("#pcolFormSaveBtn").textContent = "Save Changes";
    populateInvoiceOptions(p.linkedInvoiceId);
    $("#pcolFormInvoice").value = p.linkedInvoiceId || "";
    populateAssigneeOptions(p.assignedToEmployeeId);
    $("#pcolFormAssignee").value = p.assignedToEmployeeId || "";
    populateMethodOptions();
    $("#pcolFormMethod").value = p.followUpMethod || "";
    $("#pcolFormFollowUpDate").value = p.followUpDate || todayISO();
    $("#pcolFormPromisedAmount").value = p.promisedAmount != null ? String(p.promisedAmount) : "";
    $("#pcolFormPromisedDate").value = p.promisedDate || "";
    $("#pcolFormNotes").value = p.notes || "";
    clearFormErrors();
    openModal("pcolFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    if (!$("#pcolFormInvoice").value) { setFormError("pcolFormInvoice", "Select the invoice this follow-up is for."); valid = false; }
    if (!$("#pcolFormFollowUpDate").value) { setFormError("pcolFormFollowUpDate", "Follow-up date is required."); valid = false; }
    if (!$("#pcolFormMethod").value) { setFormError("pcolFormMethod", "Select how this follow-up happened."); valid = false; }

    const amtRaw = $("#pcolFormPromisedAmount").value;
    if (amtRaw !== "" && (isNaN(Number(amtRaw)) || Number(amtRaw) < 0)) {
      setFormError("pcolFormPromisedAmount", "Enter a positive amount, or leave this blank.");
      valid = false;
    }

    return valid;
  }

  function bindFormModal() {
    $("#pcolAddBtn").addEventListener("click", openAddModal);

    $("#pcolFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const amtRaw = $("#pcolFormPromisedAmount").value;
      const payload = {
        linkedInvoiceId: $("#pcolFormInvoice").value,
        assignedToEmployeeId: $("#pcolFormAssignee").value || null,
        followUpDate: $("#pcolFormFollowUpDate").value || null,
        followUpMethod: $("#pcolFormMethod").value,
        promisedAmount: amtRaw === "" ? null : Number(amtRaw),
        promisedDate: $("#pcolFormPromisedDate").value || null,
        notes: $("#pcolFormNotes").value.trim()
      };

      const invoice = ERP_TaxInvoiceRepository.findById(payload.linkedInvoiceId);
      const label = invoice ? invoice.invoiceCode : "this invoice";

      if (editingId) {
        openConfirm({
          title: "Save changes to this follow-up?",
          message: `This follow-up for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_PaymentCollectionRepository.update(editingId, payload);
            logSystemActivity({ module: "Payment Collection", action: "Update", description: `Updated collection follow-up for ${label} (${company.name})` });
            closeModal("pcolFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_PaymentCollectionRepository.findById(editingId));
            showToast("Follow-up updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Log this follow-up?",
          message: `A new collection follow-up will be logged for ${label}, starting as Open.`,
          confirmLabel: "Log Follow-Up",
          onConfirm: () => {
            const created = ERP_PaymentCollectionRepository.create(company, payload);
            logSystemActivity({ module: "Payment Collection", action: "Create", description: `Logged collection follow-up "${created.collectionCode}" for ${label} (${company.name})` });
            closeModal("pcolFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.collectionCode}" logged as Open.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */

  /** Open -> In Progress. Refuses up front if nobody's Assigned To yet
      (see data/payment-collection-data.js's header) and opens Edit so
      the person can fix it immediately, the same as Customer Inquiry's
      own requestStartFollowUp(). */
  function requestStartFollowUp(p) {
    if (!p.assignedToEmployeeId) {
      showToast(`"${p.collectionCode}" needs someone Assigned To it before follow-up can start.`, "warning", { title: "No owner assigned" });
      openEditModal(p);
      return;
    }
    openConfirm({
      title: "Start follow-up?",
      message: `"${p.collectionCode}" will move to In Progress.`,
      confirmLabel: "Start Follow-up",
      onConfirm: () => {
        ERP_PaymentCollectionRepository.startFollowUp(p.id, session.username);
        logSystemActivity({ module: "Payment Collection", action: "Start Follow-up", description: `Started follow-up "${p.collectionCode}" (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === p.id) openDetailModal(ERP_PaymentCollectionRepository.findById(p.id));
        showToast(`"${p.collectionCode}" is now In Progress.`, "success");
      }
    });
  }

  function requestReturnToOpen(p) {
    openConfirm({
      title: "Return this follow-up to Open?",
      message: `"${p.collectionCode}" will move back to Open so you can edit it again before restarting.`,
      confirmLabel: "Return to Open",
      onConfirm: () => {
        ERP_PaymentCollectionRepository.returnToOpen(p.id);
        logSystemActivity({ module: "Payment Collection", action: "Return to Open", description: `Returned follow-up "${p.collectionCode}" back to Open (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === p.id) openDetailModal(ERP_PaymentCollectionRepository.findById(p.id));
        showToast(`"${p.collectionCode}" moved back to Open.`, "info");
      }
    });
  }

  function requestMarkCollected(p) {
    openConfirm({
      title: "Mark this follow-up as collected?",
      message: `"${p.collectionCode}" will be marked Collected — this follow-up effort succeeded.`,
      confirmLabel: "Mark Collected",
      onConfirm: () => {
        ERP_PaymentCollectionRepository.markCollected(p.id, session.username);
        logSystemActivity({ module: "Payment Collection", action: "Mark Collected", description: `Marked follow-up "${p.collectionCode}" Collected (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === p.id) openDetailModal(ERP_PaymentCollectionRepository.findById(p.id));
        showToast(`"${p.collectionCode}" marked Collected. Record the formal voucher in Receipt.`, "success");
      }
    });
  }

  function requestWriteOff(p) {
    writingOffId = p.id;
    $("#pcolWriteOffReason").value = "";
    $("#pcolWriteOffReasonError").textContent = "";
    openModal("pcolWriteOffModal");
  }

  function bindWriteOffModal() {
    $("#pcolWriteOffConfirmBtn").addEventListener("click", () => {
      const reason = $("#pcolWriteOffReason").value.trim();
      if (!reason) { $("#pcolWriteOffReasonError").textContent = "A reason is required so the team knows why."; return; }
      const p = ERP_PaymentCollectionRepository.findById(writingOffId);
      if (!p) { closeModal("pcolWriteOffModal"); return; }
      ERP_PaymentCollectionRepository.markWrittenOff(p.id, session.username, reason);
      logSystemActivity({ module: "Payment Collection", action: "Write Off", description: `Wrote off follow-up "${p.collectionCode}" (${company.name}): ${reason}`, severity: "warning" });
      closeModal("pcolWriteOffModal");
      renderAll();
      renderActivity();
      if (detailId === p.id) openDetailModal(ERP_PaymentCollectionRepository.findById(p.id));
      showToast(`"${p.collectionCode}" marked Written Off.`, "info");
    });
  }

  function requestReopen(p) {
    openConfirm({
      title: "Reopen this follow-up?",
      message: `"${p.collectionCode}" will move back to In Progress — use this if the customer re-engages.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_PaymentCollectionRepository.reopen(p.id);
        logSystemActivity({ module: "Payment Collection", action: "Reopen", description: `Reopened written-off follow-up "${p.collectionCode}" to In Progress (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === p.id) openDetailModal(ERP_PaymentCollectionRepository.findById(p.id));
        showToast(`"${p.collectionCode}" is back In Progress.`, "info");
      }
    });
  }

  function requestCancel(p) {
    openConfirm({
      title: "Cancel this follow-up?",
      message: `"${p.collectionCode}" will be marked Cancelled. It stays on record but won't be actionable anymore.`,
      confirmLabel: "Cancel Follow-Up",
      onConfirm: () => {
        ERP_PaymentCollectionRepository.cancel(p.id, session.username);
        logSystemActivity({ module: "Payment Collection", action: "Cancel", description: `Cancelled follow-up "${p.collectionCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === p.id) openDetailModal(ERP_PaymentCollectionRepository.findById(p.id));
        showToast(`"${p.collectionCode}" cancelled.`, "info");
      }
    });
  }

  /** Refuses up front for In Progress/Collected — see canDelete()/file
      header in data/payment-collection-data.js. */
  function requestDelete(p) {
    if (!ERP_PaymentCollectionRepository.canDelete(p)) {
      showToast(`"${p.collectionCode}" is ${p.status} and can't be deleted while it's still active. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this follow-up?",
      message: `"${p.collectionCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_PaymentCollectionRepository.remove(p.id);
        logSystemActivity({ module: "Payment Collection", action: "Delete", description: `Deleted follow-up "${p.collectionCode}" (${company.name})`, severity: "warning" });
        if (detailId === p.id) closeModal("pcolDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${p.collectionCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(p) {
    const footer = $("#pcolDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (p.status === "Open") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(p));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("pcolDetailModal"); openEditModal(p); });
      addBtn("Start Follow-up", "btn btn--primary", () => requestStartFollowUp(p));
    } else if (p.status === "In Progress") {
      addBtn("Return to Open", "btn btn--ghost", () => requestReturnToOpen(p));
      addBtn("Write Off", "btn btn--danger-outline", () => requestWriteOff(p));
      addBtn("Mark Collected", "btn btn--primary", () => requestMarkCollected(p));
    } else if (p.status === "Collected") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(p));
    } else if (p.status === "Written Off") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(p));
      addBtn("Reopen", "btn btn--primary", () => requestReopen(p));
    } else if (p.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(p));
    }
  }

  function openDetailModal(p) {
    detailId = p.id;
    const invoice = p.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(p.linkedInvoiceId) : null;
    const cust = invoice ? resolveCustomer(invoice) : null;
    const emp = p.assignedToEmployeeId ? ERP_EmployeeRepository.findById(p.assignedToEmployeeId) : null;

    $("#pcolDetailTitle").textContent = `${p.collectionCode} · ${p.status}`;

    const rows = [];
    rows.push(`<div><dt>Collection Code</dt><dd><code>${escapeHtml(p.collectionCode)}</code></dd></div>`);
    rows.push(`<div><dt>Tax Invoice</dt><dd>${invoice ? `<code>${escapeHtml(invoice.invoiceCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Customer</dt><dd>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Assigned To</dt><dd>${emp ? escapeHtml(emp.fullName) + " (" + escapeHtml(emp.employeeCode) + ")" : `<span class="profile-subtle">Unassigned</span>`}</dd></div>`);
    rows.push(`<div><dt>Follow-Up Date</dt><dd>${p.followUpDate ? escapeHtml(p.followUpDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Follow-Up Method</dt><dd>${p.followUpMethod ? `<span class="status-badge status-badge--info">${escapeHtml(p.followUpMethod)}</span>` : "—"}</dd></div>`);
    rows.push(`<div><dt>Promised Amount</dt><dd>${p.promisedAmount != null ? escapeHtml(formatCurrency(p.promisedAmount)) : "— not promised —"}</dd></div>`);
    rows.push(`<div><dt>Promised Date</dt><dd>${p.promisedDate ? escapeHtml(p.promisedDate) : "— not promised —"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(p.status)}">${p.status}</span></dd></div>`);
    rows.push(`<div><dt>Logged</dt><dd>${formatDateTime(new Date(p.createdAt))}</dd></div>`);
    if (p.inProgressAt) rows.push(`<div><dt>Follow-up Started</dt><dd>${formatDateTime(new Date(p.inProgressAt))} by ${escapeHtml(ERP_PaymentCollectionRepository.actorLabel(p.inProgressByUsername))}</dd></div>`);
    if (p.status === "Collected" && p.collectedAt) rows.push(`<div><dt>Collected</dt><dd>${formatDateTime(new Date(p.collectedAt))} by ${escapeHtml(ERP_PaymentCollectionRepository.actorLabel(p.collectedByUsername))}</dd></div>`);
    if (p.status === "Written Off" && p.writtenOffAt) {
      rows.push(`<div><dt>Written Off</dt><dd>${formatDateTime(new Date(p.writtenOffAt))} by ${escapeHtml(ERP_PaymentCollectionRepository.actorLabel(p.writtenOffByUsername))}</dd></div>`);
      rows.push(`<div><dt>Write-Off Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(p.writeOffReason || "—")}</dd></div>`);
    }
    if (p.status === "Cancelled" && p.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(p.cancelledAt))} by ${escapeHtml(ERP_PaymentCollectionRepository.actorLabel(p.cancelledByUsername))}</dd></div>`);
    if (p.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(p.notes)}</dd></div>`);

    $("#pcolDetailBody").innerHTML = rows.join("");
    renderDetailFooter(p);
    openModal("pcolDetailModal");
  }

  function bindDetailModal() {
    $("#pcolTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const p = ERP_PaymentCollectionRepository.findById(viewBtn.dataset.id);
        if (p) openDetailModal(p);
        return;
      }
      if (actionBtn) {
        const p = ERP_PaymentCollectionRepository.findById(actionBtn.dataset.id);
        if (!p) return;
        if (actionBtn.dataset.action === "startFollowUp") requestStartFollowUp(p);
        else if (actionBtn.dataset.action === "collect") requestMarkCollected(p);
        else if (actionBtn.dataset.action === "reopen") requestReopen(p);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "payment-collection")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading payment collections…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#noAnchorState").hidden = true;
      $("#pcolContent").hidden = true;
      $("#pcolSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#pcolSubtitle").textContent = `Tracking payment collection for ${company.name} (${company.companyCode}).`;

      const anyInvoice = ERP_TaxInvoiceRepository.getRaisedForCompany(company.id).length > 0;

      if (!anyInvoice) {
        $("#noAnchorState").hidden = false;
        $("#pcolContent").hidden = true;
        $("#pcolHeaderActions").hidden = true;
      } else {
        $("#noAnchorState").hidden = true;
        $("#pcolContent").hidden = false;
        $("#pcolHeaderActions").hidden = false;
        renderAll();
        renderActivity();
        bindToolbar();
        bindFormModal();
        bindDetailModal();
        bindWriteOffModal();

        if (new URLSearchParams(window.location.search).get("action") === "add") {
          openAddModal();
        }
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
