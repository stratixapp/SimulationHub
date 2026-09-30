/* =============================================================================
   DOT ERP — pages/customer-inquiry.js
   Phase 5, Module 1: Customer Inquiry (first Sales module)

   See data/customer-inquiry-data.js's header for the full design rationale
   (why this has NO approval gate unlike Department Need, the 5-state
   pipeline-progression workflow, the assignment gate, the soft duplicate
   nudge, live-resolved actor identity via the centralized helper). This
   file is the UI layer on top of that:

   - ACTION MATRIX: same shape as Department Need's — each of the 5
     statuses gets a genuinely different set of Detail-modal footer
     buttons (see renderDetailFooter) and a different single row
     quick-action (see quickActionFor) — New offers Start Follow-up, In
     Progress offers Mark Converted, Lost offers Reopen, Converted/
     Cancelled offer neither (their next move — Cancel, Delete — is
     secondary enough to live only in the Detail modal).
   - MARK LOST gets its OWN small modal (#ciLostModal) instead of reusing
     the generic confirm dialog, for the same "capture free text" reason
     Department Need's Reject modal exists — every other transition
     (Start Follow-up/Return to New/Convert/Reopen/Cancel) is a plain
     openConfirm().
   - The Customer/Assignee/Item pickers all follow Cost Centers'
     "append the record's current value even if it's fallen out of the
     active filter" pattern (populate*Options(currentId)) — editing an
     inquiry shouldn't silently discard a link to something since
     deactivated.
   - Default sort is Newest First (by createdAt), same chronological
     default every Phase 4 transactional module used.
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
  let filterSource = "all";
  let sortOrder = "desc"; // newest first by default
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;
  let losingId = null; // the inquiry awaiting a reason in #ciLostModal


  /* -----------------------------------------------------------------------
     BADGE COLOR MAPPING
     New/Cancelled -> neutral (not currently being worked), In Progress ->
     warning (actively being followed up), Converted -> success, Lost ->
     danger. Source has no severity meaning, so every source gets the same
     neutral info badge — unlike Urgency, it's a channel, not a signal to
     triage on.
     --------------------------------------------------------------------- */
  function statusBadgeClass(status) {
    if (status === "Converted") return "success";
    if (status === "Lost") return "danger";
    if (status === "In Progress") return "warning";
    return "neutral"; // New, Cancelled
  }
  function quickActionFor(n) {
    if (n.status === "New") return { action: "startFollowUp", label: "Start Follow-up" };
    if (n.status === "In Progress") return { action: "convert", label: "Mark Converted" };
    if (n.status === "Lost") return { action: "reopen", label: "Reopen" };
    return null;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_CustomerInquiryRepository.getAllForCompany(company.id); // already newest-first

    if (filterStatus !== "all") rows = rows.filter((n) => n.status === filterStatus);
    if (filterSource !== "all") rows = rows.filter((n) => n.source === filterSource);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((n) => {
        const cust = ERP_CustomerRepository.findById(n.customerId);
        return n.inquiryCode.toLowerCase().includes(term) ||
          n.inquiryDescription.toLowerCase().includes(term) ||
          (cust && cust.customerName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_CustomerInquiryRepository.getAllForCompany(company.id);
    $("#ciSummaryTotal").textContent = String(all.length);
    $("#ciSummaryPending").textContent = String(all.filter((n) => n.status === "In Progress").length);
    $("#ciSummaryConverted").textContent = String(all.filter((n) => n.status === "Converted").length);
    $("#ciSummaryOverdue").textContent = String(all.filter((n) => ERP_CustomerInquiryRepository.isOverdue(n)).length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#ciPagination");
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

    $("#ciEmptyState").hidden = all.length !== 0;
    $("#ciTable").hidden = all.length === 0;

    $("#ciTableBody").innerHTML = pageItems.map((n) => {
      const cust = ERP_CustomerRepository.findById(n.customerId);
      const emp = n.assignedToEmployeeId ? ERP_EmployeeRepository.findById(n.assignedToEmployeeId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(n.status)}">${n.status}</span>`;
      const sourceBadge = `<span class="status-badge status-badge--info">${escapeHtml(n.source)}</span>`;
      const overdue = ERP_CustomerInquiryRepository.isOverdue(n);
      const expectedResponse = n.expectedResponseDate
        ? `${escapeHtml(n.expectedResponseDate)}${overdue ? ' <span class="status-badge status-badge--danger">Overdue</span>' : ""}`
        : `<span class="profile-subtle">—</span>`;
      const qa = quickActionFor(n);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${n.id}">${qa.label}</button>` : "";
      const shortDesc = n.inquiryDescription.length > 44 ? escapeHtml(n.inquiryDescription.slice(0, 44)) + "…" : escapeHtml(n.inquiryDescription);

      return `
      <tr>
        <td><code>${escapeHtml(n.inquiryCode)}</code></td>
        <td>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${emp ? escapeHtml(emp.fullName) : `<span class="profile-subtle">Unassigned</span>`}</td>
        <td>${shortDesc}</td>
        <td>${sourceBadge}</td>
        <td>${expectedResponse}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${n.id}">View</button>
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
    $$("#ciStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#ciStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $$("#ciSourceChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#ciSourceChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterSource = chip.dataset.source;
        page = 1;
        renderTable();
      });
    });

    $("#ciSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#ciSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#ciExportCsvBtn").addEventListener("click", exportCsv);
    $("#ciPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Inquiry Code", "Customer", "Assigned To", "Linked Item", "Description", "Est. Quantity", "Source", "Expected Response", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((n) => {
      const cust = ERP_CustomerRepository.findById(n.customerId);
      const emp = n.assignedToEmployeeId ? ERP_EmployeeRepository.findById(n.assignedToEmployeeId) : null;
      const item = n.itemId ? ERP_ItemRepository.findById(n.itemId) : null;
      const line = [
        n.inquiryCode, cust ? cust.customerName : "", emp ? emp.fullName : "",
        item ? item.itemName : "", n.inquiryDescription, n.estimatedQuantity != null ? n.estimatedQuantity : "",
        n.source, n.expectedResponseDate || "", n.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-customer-inquiries-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Customer inquiries exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((n) => {
      const cust = ERP_CustomerRepository.findById(n.customerId);
      const emp = n.assignedToEmployeeId ? ERP_EmployeeRepository.findById(n.assignedToEmployeeId) : null;
      return `<tr><td>${escapeHtml(n.inquiryCode)}</td><td>${cust ? escapeHtml(cust.customerName) : ""}</td><td>${emp ? escapeHtml(emp.fullName) : ""}</td><td>${escapeHtml(n.inquiryDescription)}</td><td>${escapeHtml(n.source)}</td><td>${escapeHtml(n.expectedResponseDate || "")}</td><td>${escapeHtml(n.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Customer Inquiry Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Customer Inquiry Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Inquiry Code</th><th>Customer</th><th>Assigned To</th><th>Description</th><th>Source</th><th>Expected Response</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Customer Inquiry")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#ciActivityEmptyState").hidden = relevant.length !== 0;
    $("#ciActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT FORM — pickers all follow Cost Centers' "keep the record's
     current value selectable even if it's fallen out of the active
     filter" shape (populate*Options(currentId)).
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["ciFormCustomer", "ciFormDescription", "ciFormQuantity"].forEach((f) => setFormError(f, ""));
  }

  function populateCustomerOptions(currentId) {
    let custs = ERP_CustomerRepository.getAllForCompany(company.id).filter((c) => c.status !== "Inactive");
    if (currentId && !custs.some((c) => c.id === currentId)) {
      const current = ERP_CustomerRepository.findById(currentId);
      if (current) custs = custs.concat([current]);
    }
    custs = custs.slice().sort((a, b) => a.customerName.localeCompare(b.customerName));
    $("#ciFormCustomer").innerHTML = custs.map((c) => `<option value="${c.id}">${escapeHtml(c.customerName)} (${escapeHtml(c.customerCode)})</option>`).join("");
  }

  /** Assigned To is optional (see data/customer-inquiry-data.js's header —
      it's only required before Start Follow-up, not at save time), so this
      picker gets an explicit "Unassigned" option Department Need's
      required Requester picker never needed. */
  function populateAssigneeOptions(currentId) {
    let emps = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status !== "Inactive");
    if (currentId && !emps.some((e) => e.id === currentId)) {
      const current = ERP_EmployeeRepository.findById(currentId);
      if (current) emps = emps.concat([current]);
    }
    emps = emps.slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
    $("#ciFormAssignee").innerHTML = `<option value="">Unassigned</option>` + emps.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)} (${escapeHtml(e.employeeCode)})</option>`).join("");
  }

  function populateItemOptions(currentId) {
    let items = ERP_ItemRepository.getActiveForCompany(company.id);
    if (currentId && !items.some((i) => i.id === currentId)) {
      const current = ERP_ItemRepository.findById(currentId);
      if (current) items = items.concat([current]);
    }
    items = items.slice().sort((a, b) => a.itemName.localeCompare(b.itemName));
    $("#ciFormItem").innerHTML = `<option value="">Not linked — describe below</option>` + items.map((i) => `<option value="${i.id}">${escapeHtml(i.itemName)} (${escapeHtml(i.itemCode)})</option>`).join("");
  }

  function populateSourceOptions() {
    $("#ciFormSource").innerHTML = ERP_CustomerInquiryRepository.sources.map((s) => `<option${s === "Phone" ? " selected" : ""}>${escapeHtml(s)}</option>`).join("");
  }

  /** Soft, non-blocking duplicate nudge — see data/customer-inquiry-data.js's
      header for why this never blocks Save (reuses Department Need's own
      resolution #5 exactly). */
  function checkDuplicateHint() {
    const custId = $("#ciFormCustomer").value;
    const desc = $("#ciFormDescription").value;
    const hint = $("#ciFormDuplicateHint");
    const dup = ERP_CustomerInquiryRepository.findPossibleDuplicate(company.id, custId, desc, editingId);
    if (dup) {
      hint.textContent = `Heads up: ${dup.inquiryCode} looks like the same request, already ${dup.status} for this customer (logged ${formatDateTime(new Date(dup.createdAt))}). You can still save — just confirming this isn't a duplicate entry.`;
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  }

  function openAddModal() {
    const anyCust = ERP_CustomerRepository.getAllForCompany(company.id).some((c) => c.status !== "Inactive");
    if (!anyCust) {
      showToast("Add at least one active Customer before logging an inquiry.", "warning");
      return;
    }
    editingId = null;
    $("#ciFormTitle").textContent = "Log a customer inquiry";
    $("#ciFormIntro").textContent = "Describe what the customer is asking about — a Quotation gets built from this once it converts.";
    $("#ciFormSaveBtn").textContent = "Save Inquiry";
    populateCustomerOptions(null);
    populateAssigneeOptions(null);
    populateItemOptions(null);
    populateSourceOptions();
    $("#ciFormAssignee").value = "";
    $("#ciFormItem").value = "";
    $("#ciFormDescription").value = "";
    $("#ciFormQuantity").value = "";
    $("#ciFormExpectedResponse").value = "";
    clearFormErrors();
    $("#ciFormDuplicateHint").hidden = true;
    openModal("ciFormModal");
  }

  function openEditModal(n) {
    if (!ERP_CustomerInquiryRepository.canEdit(n)) {
      showToast(`"${n.inquiryCode}" is ${n.status} and can't be edited directly. Return it to New first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = n.id;
    $("#ciFormTitle").textContent = "Edit customer inquiry";
    $("#ciFormIntro").textContent = "Update this inquiry's details while it's still New.";
    $("#ciFormSaveBtn").textContent = "Save Changes";
    populateCustomerOptions(n.customerId);
    $("#ciFormCustomer").value = n.customerId;
    populateAssigneeOptions(n.assignedToEmployeeId);
    $("#ciFormAssignee").value = n.assignedToEmployeeId || "";
    populateItemOptions(n.itemId);
    $("#ciFormItem").value = n.itemId || "";
    populateSourceOptions();
    $("#ciFormSource").value = n.source;
    $("#ciFormDescription").value = n.inquiryDescription;
    $("#ciFormQuantity").value = n.estimatedQuantity != null ? String(n.estimatedQuantity) : "";
    $("#ciFormExpectedResponse").value = n.expectedResponseDate || "";
    clearFormErrors();
    $("#ciFormDuplicateHint").hidden = true;
    openModal("ciFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    if (!$("#ciFormCustomer").value) { setFormError("ciFormCustomer", "Select the customer who's asking."); valid = false; }

    const desc = $("#ciFormDescription").value.trim();
    if (!desc) { setFormError("ciFormDescription", "Describe what the customer is asking about."); valid = false; }
    else if (desc.length > 240) { setFormError("ciFormDescription", "Maximum 240 characters allowed."); valid = false; }

    const qtyRaw = $("#ciFormQuantity").value;
    if (qtyRaw !== "" && (isNaN(Number(qtyRaw)) || Number(qtyRaw) < 0)) {
      setFormError("ciFormQuantity", "Enter a positive number, or leave this blank.");
      valid = false;
    }

    return valid;
  }

  function bindFormModal() {
    $("#ciAddBtn").addEventListener("click", openAddModal);
    $("#ciFormCustomer").addEventListener("change", checkDuplicateHint);
    $("#ciFormDescription").addEventListener("input", checkDuplicateHint);

    $("#ciFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const qtyRaw = $("#ciFormQuantity").value;
      const payload = {
        customerId: $("#ciFormCustomer").value,
        assignedToEmployeeId: $("#ciFormAssignee").value || null,
        itemId: $("#ciFormItem").value || null,
        inquiryDescription: $("#ciFormDescription").value.trim(),
        estimatedQuantity: qtyRaw === "" ? null : Number(qtyRaw),
        source: $("#ciFormSource").value,
        expectedResponseDate: $("#ciFormExpectedResponse").value || null
      };

      const cust = ERP_CustomerRepository.findById(payload.customerId);
      const custLabel = cust ? cust.customerName : "this customer";

      if (editingId) {
        openConfirm({
          title: "Save changes to this inquiry?",
          message: `This customer inquiry for ${custLabel} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_CustomerInquiryRepository.update(editingId, payload);
            logSystemActivity({ module: "Customer Inquiry", action: "Update", description: `Updated customer inquiry for ${custLabel} (${company.name})` });
            closeModal("ciFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_CustomerInquiryRepository.findById(editingId));
            showToast("Customer inquiry updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Log this customer inquiry?",
          message: `A new inquiry will be logged for ${custLabel}, starting as New.`,
          confirmLabel: "Log Inquiry",
          onConfirm: () => {
            const created = ERP_CustomerInquiryRepository.create(company, payload);
            logSystemActivity({ module: "Customer Inquiry", action: "Create", description: `Logged customer inquiry "${created.inquiryCode}" for ${custLabel} (${company.name})` });
            closeModal("ciFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.inquiryCode}" logged as New.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS — one function per transition. Every one goes through
     openConfirm() except Mark Lost, which needs a reason first (see
     bindLostModal below).
     --------------------------------------------------------------------- */

  /** New -> In Progress. Refuses up front if nobody's Assigned To yet
      (see data/customer-inquiry-data.js's header) and opens Edit so the
      person can fix it immediately, instead of just a dead-end toast. */
  function requestStartFollowUp(n) {
    if (!n.assignedToEmployeeId) {
      showToast(`"${n.inquiryCode}" needs someone Assigned To it before follow-up can start.`, "warning", { title: "No owner assigned" });
      openEditModal(n);
      return;
    }
    openConfirm({
      title: "Start follow-up on this inquiry?",
      message: `"${n.inquiryCode}" will move to In Progress.`,
      confirmLabel: "Start Follow-up",
      onConfirm: () => {
        ERP_CustomerInquiryRepository.startFollowUp(n.id, session.username);
        logSystemActivity({ module: "Customer Inquiry", action: "Start Follow-up", description: `Started follow-up on inquiry "${n.inquiryCode}" (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === n.id) openDetailModal(ERP_CustomerInquiryRepository.findById(n.id));
        showToast(`"${n.inquiryCode}" is now In Progress.`, "success");
      }
    });
  }

  function requestReturnToNew(n) {
    openConfirm({
      title: "Return this inquiry to New?",
      message: `"${n.inquiryCode}" will move back to New so you can edit it again before restarting follow-up.`,
      confirmLabel: "Return to New",
      onConfirm: () => {
        ERP_CustomerInquiryRepository.returnToNew(n.id);
        logSystemActivity({ module: "Customer Inquiry", action: "Return to New", description: `Returned inquiry "${n.inquiryCode}" back to New (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === n.id) openDetailModal(ERP_CustomerInquiryRepository.findById(n.id));
        showToast(`"${n.inquiryCode}" moved back to New.`, "info");
      }
    });
  }

  function requestConvert(n) {
    openConfirm({
      title: "Mark this inquiry converted?",
      message: `"${n.inquiryCode}" will be marked Converted and become available for a Quotation to be built from.`,
      confirmLabel: "Mark Converted",
      onConfirm: () => {
        ERP_CustomerInquiryRepository.convert(n.id, session.username);
        logSystemActivity({ module: "Customer Inquiry", action: "Convert", description: `Converted inquiry "${n.inquiryCode}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === n.id) openDetailModal(ERP_CustomerInquiryRepository.findById(n.id));
        showToast(`"${n.inquiryCode}" marked Converted.`, "success");
      }
    });
  }

  function requestMarkLost(n) {
    losingId = n.id;
    $("#ciLostReason").value = "";
    $("#ciLostReasonError").textContent = "";
    openModal("ciLostModal");
  }

  function bindLostModal() {
    $("#ciLostConfirmBtn").addEventListener("click", () => {
      const reason = $("#ciLostReason").value.trim();
      if (!reason) { $("#ciLostReasonError").textContent = "A reason is required so the sales team knows why."; return; }
      const n = ERP_CustomerInquiryRepository.findById(losingId);
      if (!n) { closeModal("ciLostModal"); return; }
      ERP_CustomerInquiryRepository.markLost(n.id, session.username, reason);
      logSystemActivity({ module: "Customer Inquiry", action: "Mark Lost", description: `Marked inquiry "${n.inquiryCode}" Lost for ${company.name}: ${reason}`, severity: "warning" });
      closeModal("ciLostModal");
      renderAll();
      renderActivity();
      if (detailId === n.id) openDetailModal(ERP_CustomerInquiryRepository.findById(n.id));
      showToast(`"${n.inquiryCode}" marked Lost.`, "info");
    });
  }

  function requestReopen(n) {
    openConfirm({
      title: "Reopen this inquiry?",
      message: `"${n.inquiryCode}" will move back to In Progress — use this if the customer re-engages.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_CustomerInquiryRepository.reopen(n.id);
        logSystemActivity({ module: "Customer Inquiry", action: "Reopen", description: `Reopened lost inquiry "${n.inquiryCode}" to In Progress (${company.name})` });
        if (detailId === n.id) closeModal("ciDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${n.inquiryCode}" is back In Progress.`, "info");
      }
    });
  }

  function requestCancel(n) {
    openConfirm({
      title: "Cancel this inquiry?",
      message: `"${n.inquiryCode}" will be marked Cancelled. It stays on record but won't be actionable anymore.`,
      confirmLabel: "Cancel Inquiry",
      onConfirm: () => {
        ERP_CustomerInquiryRepository.cancel(n.id, session.username);
        logSystemActivity({ module: "Customer Inquiry", action: "Cancel", description: `Cancelled inquiry "${n.inquiryCode}" for ${company.name}`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === n.id) openDetailModal(ERP_CustomerInquiryRepository.findById(n.id));
        showToast(`"${n.inquiryCode}" cancelled.`, "info");
      }
    });
  }

  /** Refuses up front for In Progress/Converted — see canDelete()/file
      header in data/customer-inquiry-data.js. */
  function requestDelete(n) {
    if (!ERP_CustomerInquiryRepository.canDelete(n)) {
      showToast(`"${n.inquiryCode}" is ${n.status} and can't be deleted while it's still an active workflow record. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this inquiry?",
      message: `"${n.inquiryCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_CustomerInquiryRepository.remove(n.id);
        logSystemActivity({ module: "Customer Inquiry", action: "Delete", description: `Deleted inquiry "${n.inquiryCode}" for ${company.name}`, severity: "warning" });
        if (detailId === n.id) closeModal("ciDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${n.inquiryCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL — footer buttons are genuinely different per status; see
     file header.
     --------------------------------------------------------------------- */
  function renderDetailFooter(n) {
    const footer = $("#ciDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (n.status === "New") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(n));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("ciDetailModal"); openEditModal(n); });
      addBtn("Start Follow-up", "btn btn--primary", () => requestStartFollowUp(n));
    } else if (n.status === "In Progress") {
      addBtn("Return to New", "btn btn--ghost", () => requestReturnToNew(n));
      addBtn("Mark Lost", "btn btn--danger-outline", () => requestMarkLost(n));
      addBtn("Mark Converted", "btn btn--primary", () => requestConvert(n));
    } else if (n.status === "Converted") {
      addBtn("Cancel Inquiry", "btn btn--danger-outline", () => requestCancel(n));
    } else if (n.status === "Lost") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(n));
      addBtn("Reopen", "btn btn--primary", () => requestReopen(n));
    } else if (n.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(n));
    }
  }

  function openDetailModal(n) {
    detailId = n.id;
    const cust = ERP_CustomerRepository.findById(n.customerId);
    const emp = n.assignedToEmployeeId ? ERP_EmployeeRepository.findById(n.assignedToEmployeeId) : null;
    const item = n.itemId ? ERP_ItemRepository.findById(n.itemId) : null;
    const unit = item ? ERP_UnitRepository.findById(item.unitId) : null;
    const overdue = ERP_CustomerInquiryRepository.isOverdue(n);

    $("#ciDetailTitle").textContent = `${n.inquiryCode} · ${n.status}`;

    const rows = [];
    rows.push(`<div><dt>Inquiry Code</dt><dd><code>${escapeHtml(n.inquiryCode)}</code></dd></div>`);
    rows.push(`<div><dt>Customer</dt><dd>${cust ? escapeHtml(cust.customerName) + " (" + escapeHtml(cust.customerCode) + ")" : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Assigned To</dt><dd>${emp ? escapeHtml(emp.fullName) + " (" + escapeHtml(emp.employeeCode) + ")" : `<span class="profile-subtle">Unassigned</span>`}</dd></div>`);
    rows.push(`<div><dt>Linked Item</dt><dd>${item ? escapeHtml(item.itemName) + " (" + escapeHtml(item.itemCode) + (unit ? ", " + escapeHtml(unit.unitSymbol) : "") + ")" : "— not linked —"}</dd></div>`);
    rows.push(`<div><dt>Estimated Quantity</dt><dd>${n.estimatedQuantity != null ? escapeHtml(String(n.estimatedQuantity)) : "—"}</dd></div>`);
    rows.push(`<div><dt>Source</dt><dd><span class="status-badge status-badge--info">${escapeHtml(n.source)}</span></dd></div>`);
    rows.push(`<div><dt>Expected Response</dt><dd>${n.expectedResponseDate ? escapeHtml(n.expectedResponseDate) + (overdue ? ' <span class="status-badge status-badge--danger">Overdue</span>' : "") : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(n.status)}">${n.status}</span></dd></div>`);
    rows.push(`<div><dt>Logged</dt><dd>${formatDateTime(new Date(n.createdAt))}</dd></div>`);
    if (n.inProgressAt) rows.push(`<div><dt>Follow-up Started</dt><dd>${formatDateTime(new Date(n.inProgressAt))} by ${escapeHtml(ERP_CustomerInquiryRepository.actorLabel(n.inProgressByUsername))}</dd></div>`);
    if (n.status === "Converted" && n.convertedAt) rows.push(`<div><dt>Converted</dt><dd>${formatDateTime(new Date(n.convertedAt))} by ${escapeHtml(ERP_CustomerInquiryRepository.actorLabel(n.convertedByUsername))}</dd></div>`);
    if (n.status === "Lost" && n.lostAt) {
      rows.push(`<div><dt>Lost</dt><dd>${formatDateTime(new Date(n.lostAt))} by ${escapeHtml(ERP_CustomerInquiryRepository.actorLabel(n.lostByUsername))}</dd></div>`);
      rows.push(`<div><dt>Lost Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(n.lostReason || "—")}</dd></div>`);
    }
    if (n.status === "Cancelled" && n.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(n.cancelledAt))} by ${escapeHtml(ERP_CustomerInquiryRepository.actorLabel(n.cancelledByUsername))}</dd></div>`);
    if (typeof ERP_SalesQuotationRepository !== "undefined") {
      const linkedQuotation = ERP_SalesQuotationRepository.findQuotationForInquiry(company.id, n.id);
      if (linkedQuotation) {
        const qBadgeClass = linkedQuotation.status === "Accepted" ? "success" : linkedQuotation.status === "Declined" ? "danger" : linkedQuotation.status === "Sent" ? "warning" : "neutral";
        rows.push(`<div><dt>Linked to Quotation</dt><dd><code>${escapeHtml(linkedQuotation.quotationCode)}</code> <span class="status-badge status-badge--${qBadgeClass}">${escapeHtml(linkedQuotation.status)}</span></dd></div>`);
      }
    }
    rows.push(`<div><dt>Description</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(n.inquiryDescription)}</dd></div>`);

    $("#ciDetailBody").innerHTML = rows.join("");
    renderDetailFooter(n);
    openModal("ciDetailModal");
  }

  function bindDetailModal() {
    $("#ciTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const n = ERP_CustomerInquiryRepository.findById(viewBtn.dataset.id);
        if (n) openDetailModal(n);
        return;
      }
      if (actionBtn) {
        const n = ERP_CustomerInquiryRepository.findById(actionBtn.dataset.id);
        if (!n) return;
        if (actionBtn.dataset.action === "startFollowUp") requestStartFollowUp(n);
        else if (actionBtn.dataset.action === "convert") requestConvert(n);
        else if (actionBtn.dataset.action === "reopen") requestReopen(n);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "customer-inquiry")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading customer inquiries…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#noAnchorState").hidden = true;
      $("#ciContent").hidden = true;
      $("#ciSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#ciSubtitle").textContent = `Managing customer inquiries for ${company.name} (${company.companyCode}).`;

      // Unlike Department Need — which needs BOTH an active Department and
      // an active Employee — only an active Customer is hard-required here;
      // Assigned To (Employee) is optional until follow-up starts. See
      // data/customer-inquiry-data.js's header.
      const anyCust = ERP_CustomerRepository.getAllForCompany(company.id).some((c) => c.status !== "Inactive");

      if (!anyCust) {
        $("#noAnchorState").hidden = false;
        $("#ciContent").hidden = true;
        $("#ciHeaderActions").hidden = true;
      } else {
        $("#noAnchorState").hidden = true;
        $("#ciContent").hidden = false;
        $("#ciHeaderActions").hidden = false;
        renderAll();
        renderActivity();
        bindToolbar();
        bindFormModal();
        bindDetailModal();
        bindLostModal();

        // No dashboard tile deep-links here yet (Section 10's discipline —
        // Quick Actions doesn't grow by default), but ?action=add is kept
        // for the same reason later Procurement modules kept it even
        // without one: a future dashboard update, or a direct link, can
        // use it for free.
        if (new URLSearchParams(window.location.search).get("action") === "add") {
          openAddModal();
        }
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
