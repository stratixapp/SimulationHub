/* =============================================================================
   DOT ERP — pages/department-need.js
   Phase 4, Module 1: Department Need (first Procurement module)

   See data/department-need-data.js's header for the full design rationale
   (why this is its own record, the 5-state workflow, the new edit/delete
   gates, the soft duplicate nudge, live-resolved actor identity). This file
   is the UI layer on top of that — the parts specific to HOW those
   decisions show up on screen:

   - ACTION MATRIX: unlike Master Data's uniform Edit/Delete/toggle-status
     footer, each of the 5 statuses gets a genuinely different set of
     Detail-modal footer buttons (see renderDetailFooter) and a different
     single row quick-action (see quickActionFor) — Draft offers Submit,
     Submitted offers Approve, Rejected offers Revise, Approved/Cancelled
     offer neither (their next moves — Cancel, Delete — are secondary
     enough to live only in the Detail modal, per the multi-state-lifecycle
     convention).
   - REJECT gets its OWN small modal (#dnRejectModal) instead of reusing
     the generic confirm dialog, because it's the one action here where
     capturing free text (the reason) matters — every other transition
     (Submit/Withdraw/Approve/Revise/Cancel) is a plain openConfirm().
   - The Department/Requester/Cost Center/Item pickers all follow Cost
     Centers' "append the record's current value even if it's fallen out
     of the active filter" pattern (populate*Options(currentId)) — editing
     a need shouldn't silently discard a link to something since
     deactivated.
   - Default sort is Newest First (by createdAt), not alphabetical — see
     data/department-need-data.js's header for why a transactional list's
     natural order is chronological.
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
  let filterUrgency = "all";
  let sortOrder = "desc"; // newest first by default
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;
  let rejectingId = null; // the need awaiting a reason in #dnRejectModal


  /* -----------------------------------------------------------------------
     BADGE COLOR MAPPING
     Draft/Cancelled -> neutral (not currently in the pipeline), Submitted
     -> warning (awaiting a decision), Approved -> success, Rejected ->
     danger. Urgency: Urgent -> danger, High -> warning, Normal -> info,
     Low -> neutral.
     --------------------------------------------------------------------- */
  function statusBadgeClass(status) {
    if (status === "Approved") return "success";
    if (status === "Rejected") return "danger";
    if (status === "Submitted") return "warning";
    return "neutral"; // Draft, Cancelled
  }
  function urgencyBadgeClass(u) {
    if (u === "Urgent") return "danger";
    if (u === "High") return "warning";
    if (u === "Low") return "neutral";
    return "info"; // Normal
  }
  function quickActionFor(n) {
    if (n.status === "Draft") return { action: "submit", label: "Submit" };
    if (n.status === "Submitted") return { action: "approve", label: "Approve" };
    if (n.status === "Rejected") return { action: "revise", label: "Revise" };
    return null;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_DepartmentNeedRepository.getAllForCompany(company.id); // already newest-first

    if (filterStatus !== "all") rows = rows.filter((n) => n.status === filterStatus);
    if (filterUrgency !== "all") rows = rows.filter((n) => n.urgency === filterUrgency);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((n) => {
        const dept = ERP_DepartmentRepository.findById(n.departmentId);
        return n.needCode.toLowerCase().includes(term) ||
          n.needDescription.toLowerCase().includes(term) ||
          (dept && dept.deptName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_DepartmentNeedRepository.getAllForCompany(company.id);
    $("#dnSummaryTotal").textContent = String(all.length);
    $("#dnSummaryPending").textContent = String(all.filter((n) => n.status === "Submitted").length);
    $("#dnSummaryApproved").textContent = String(all.filter((n) => n.status === "Approved").length);
    $("#dnSummaryOverdue").textContent = String(all.filter((n) => ERP_DepartmentNeedRepository.isOverdue(n)).length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#dnPagination");
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

    $("#dnEmptyState").hidden = all.length !== 0;
    $("#dnTable").hidden = all.length === 0;

    $("#dnTableBody").innerHTML = pageItems.map((n) => {
      const dept = ERP_DepartmentRepository.findById(n.departmentId);
      const emp = ERP_EmployeeRepository.findById(n.requestedByEmployeeId);
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(n.status)}">${n.status}</span>`;
      const urgencyBadge = `<span class="status-badge status-badge--${urgencyBadgeClass(n.urgency)}">${n.urgency}</span>`;
      const overdue = ERP_DepartmentNeedRepository.isOverdue(n);
      const requiredBy = n.requiredByDate
        ? `${escapeHtml(n.requiredByDate)}${overdue ? ' <span class="status-badge status-badge--danger">Overdue</span>' : ""}`
        : `<span class="profile-subtle">—</span>`;
      const qa = quickActionFor(n);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${n.id}">${qa.label}</button>` : "";
      const shortDesc = n.needDescription.length > 44 ? escapeHtml(n.needDescription.slice(0, 44)) + "…" : escapeHtml(n.needDescription);

      return `
      <tr>
        <td><code>${escapeHtml(n.needCode)}</code></td>
        <td>${dept ? escapeHtml(dept.deptName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${emp ? escapeHtml(emp.fullName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${shortDesc}</td>
        <td>${urgencyBadge}</td>
        <td>${requiredBy}</td>
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
    $$("#dnStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#dnStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $$("#dnUrgencyChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#dnUrgencyChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterUrgency = chip.dataset.urgency;
        page = 1;
        renderTable();
      });
    });

    $("#dnSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#dnSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#dnExportCsvBtn").addEventListener("click", exportCsv);
    $("#dnPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Need Code", "Department", "Requested By", "Cost Center", "Linked Item", "Description", "Est. Quantity", "Urgency", "Required By", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((n) => {
      const dept = ERP_DepartmentRepository.findById(n.departmentId);
      const emp = ERP_EmployeeRepository.findById(n.requestedByEmployeeId);
      const cc = n.costCenterId ? ERP_CostCenterRepository.findById(n.costCenterId) : null;
      const item = n.itemId ? ERP_ItemRepository.findById(n.itemId) : null;
      const line = [
        n.needCode, dept ? dept.deptName : "", emp ? emp.fullName : "", cc ? cc.ccName : "",
        item ? item.itemName : "", n.needDescription, n.estimatedQuantity != null ? n.estimatedQuantity : "",
        n.urgency, n.requiredByDate || "", n.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-department-needs-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Department needs exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((n) => {
      const dept = ERP_DepartmentRepository.findById(n.departmentId);
      const emp = ERP_EmployeeRepository.findById(n.requestedByEmployeeId);
      return `<tr><td>${escapeHtml(n.needCode)}</td><td>${dept ? escapeHtml(dept.deptName) : ""}</td><td>${emp ? escapeHtml(emp.fullName) : ""}</td><td>${escapeHtml(n.needDescription)}</td><td>${escapeHtml(n.urgency)}</td><td>${escapeHtml(n.requiredByDate || "")}</td><td>${escapeHtml(n.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Department Need Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Department Need Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Need Code</th><th>Department</th><th>Raised By</th><th>Description</th><th>Urgency</th><th>Required By</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Department Need")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#dnActivityEmptyState").hidden = relevant.length !== 0;
    $("#dnActivityList").innerHTML = relevant.map((e) => `
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
    ["dnFormDepartment", "dnFormRequester", "dnFormDescription", "dnFormQuantity"].forEach((f) => setFormError(f, ""));
  }

  function populateDepartmentOptions(currentId) {
    let depts = ERP_DepartmentRepository.getAllForCompany(company.id).filter((d) => d.status === "Active");
    if (currentId && !depts.some((d) => d.id === currentId)) {
      const current = ERP_DepartmentRepository.findById(currentId);
      if (current) depts = depts.concat([current]);
    }
    depts = depts.slice().sort((a, b) => a.deptName.localeCompare(b.deptName));
    $("#dnFormDepartment").innerHTML = depts.map((d) => `<option value="${d.id}">${escapeHtml(d.deptName)}</option>`).join("");
  }

  function populateRequesterOptions(currentId) {
    let emps = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status !== "Inactive");
    if (currentId && !emps.some((e) => e.id === currentId)) {
      const current = ERP_EmployeeRepository.findById(currentId);
      if (current) emps = emps.concat([current]);
    }
    emps = emps.slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
    $("#dnFormRequester").innerHTML = emps.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)} (${escapeHtml(e.employeeCode)})</option>`).join("");
  }

  function populateCostCenterOptions(currentId) {
    let ccs = ERP_CostCenterRepository.getAllForCompany(company.id).filter((c) => c.status === "Active");
    if (currentId && !ccs.some((c) => c.id === currentId)) {
      const current = ERP_CostCenterRepository.findById(currentId);
      if (current) ccs = ccs.concat([current]);
    }
    ccs = ccs.slice().sort((a, b) => a.ccName.localeCompare(b.ccName));
    $("#dnFormCostCenter").innerHTML = `<option value="">Not linked</option>` + ccs.map((c) => `<option value="${c.id}">${escapeHtml(c.ccName)}</option>`).join("");
  }

  function populateItemOptions(currentId) {
    let items = ERP_ItemRepository.getActiveForCompany(company.id);
    if (currentId && !items.some((i) => i.id === currentId)) {
      const current = ERP_ItemRepository.findById(currentId);
      if (current) items = items.concat([current]);
    }
    items = items.slice().sort((a, b) => a.itemName.localeCompare(b.itemName));
    $("#dnFormItem").innerHTML = `<option value="">Not linked — describe below</option>` + items.map((i) => `<option value="${i.id}">${escapeHtml(i.itemName)} (${escapeHtml(i.itemCode)})</option>`).join("");
  }

  function populateUrgencyOptions() {
    $("#dnFormUrgency").innerHTML = ERP_DepartmentNeedRepository.urgencyLevels.map((u) => `<option${u === "Normal" ? " selected" : ""}>${escapeHtml(u)}</option>`).join("");
  }

  /** Cross-module mismatch -> soft inline hint, never a hard block: the
      requester doesn't have to belong to the department the need is FOR
      (a manager can raise a need on another department's behalf). */
  function checkRequesterMismatch() {
    const deptId = $("#dnFormDepartment").value;
    const empId = $("#dnFormRequester").value;
    const hint = $("#dnFormRequesterHint");
    const emp = ERP_EmployeeRepository.findById(empId);
    if (emp && emp.departmentId && deptId && emp.departmentId !== deptId) {
      const empDept = ERP_DepartmentRepository.findById(emp.departmentId);
      hint.textContent = `Heads up: ${emp.fullName} belongs to ${empDept ? empDept.deptName : "a different department"}, not the department selected above. That's fine if they're raising this on another department's behalf.`;
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  }

  /** Soft, non-blocking duplicate nudge — see data/department-need-data.js's
      header for why this never blocks Save. */
  function checkDuplicateHint() {
    const deptId = $("#dnFormDepartment").value;
    const desc = $("#dnFormDescription").value;
    const hint = $("#dnFormDuplicateHint");
    const dup = ERP_DepartmentNeedRepository.findPossibleDuplicate(company.id, deptId, desc, editingId);
    if (dup) {
      hint.textContent = `Heads up: ${dup.needCode} looks like the same request, already ${dup.status} for this department (raised ${formatDateTime(new Date(dup.createdAt))}). You can still save — just confirming this isn't a duplicate entry.`;
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  }

  function openAddModal() {
    const anyDept = ERP_DepartmentRepository.getAllForCompany(company.id).some((d) => d.status === "Active");
    const anyEmp = ERP_EmployeeRepository.getAllForCompany(company.id).some((e) => e.status !== "Inactive");
    if (!anyDept || !anyEmp) {
      showToast("Add at least one active Department and Employee before raising a need.", "warning");
      return;
    }
    editingId = null;
    $("#dnFormTitle").textContent = "Raise a department need";
    $("#dnFormIntro").textContent = "Describe what a department needs — a Purchase Requisition gets built from this once it's approved.";
    $("#dnFormSaveBtn").textContent = "Save as Draft";
    populateDepartmentOptions(null);
    populateRequesterOptions(null);
    populateCostCenterOptions(null);
    populateItemOptions(null);
    populateUrgencyOptions();
    $("#dnFormCostCenter").value = "";
    $("#dnFormItem").value = "";
    $("#dnFormDescription").value = "";
    $("#dnFormQuantity").value = "";
    $("#dnFormRequiredBy").value = "";
    clearFormErrors();
    $("#dnFormRequesterHint").hidden = true;
    $("#dnFormDuplicateHint").hidden = true;
    openModal("dnFormModal");
    checkRequesterMismatch();
  }

  function openEditModal(n) {
    if (!ERP_DepartmentNeedRepository.canEdit(n)) {
      showToast(`"${n.needCode}" is ${n.status} and can't be edited directly. Withdraw or revise it back to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = n.id;
    $("#dnFormTitle").textContent = "Edit department need";
    $("#dnFormIntro").textContent = "Update this need's details while it's still a Draft.";
    $("#dnFormSaveBtn").textContent = "Save Changes";
    populateDepartmentOptions(n.departmentId);
    $("#dnFormDepartment").value = n.departmentId;
    populateRequesterOptions(n.requestedByEmployeeId);
    $("#dnFormRequester").value = n.requestedByEmployeeId;
    populateCostCenterOptions(n.costCenterId);
    $("#dnFormCostCenter").value = n.costCenterId || "";
    populateItemOptions(n.itemId);
    $("#dnFormItem").value = n.itemId || "";
    populateUrgencyOptions();
    $("#dnFormUrgency").value = n.urgency;
    $("#dnFormDescription").value = n.needDescription;
    $("#dnFormQuantity").value = n.estimatedQuantity != null ? String(n.estimatedQuantity) : "";
    $("#dnFormRequiredBy").value = n.requiredByDate || "";
    clearFormErrors();
    $("#dnFormDuplicateHint").hidden = true;
    openModal("dnFormModal");
    checkRequesterMismatch();
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    if (!$("#dnFormDepartment").value) { setFormError("dnFormDepartment", "Select a department."); valid = false; }
    if (!$("#dnFormRequester").value) { setFormError("dnFormRequester", "Select who's raising this need."); valid = false; }

    const desc = $("#dnFormDescription").value.trim();
    if (!desc) { setFormError("dnFormDescription", "Describe what's needed."); valid = false; }
    else if (desc.length > 240) { setFormError("dnFormDescription", "Maximum 240 characters allowed."); valid = false; }

    const qtyRaw = $("#dnFormQuantity").value;
    if (qtyRaw !== "" && (isNaN(Number(qtyRaw)) || Number(qtyRaw) < 0)) {
      setFormError("dnFormQuantity", "Enter a positive number, or leave this blank.");
      valid = false;
    }

    return valid;
  }

  function bindFormModal() {
    $("#dnAddBtn").addEventListener("click", openAddModal);
    $("#dnFormDepartment").addEventListener("change", checkRequesterMismatch);
    $("#dnFormRequester").addEventListener("change", checkRequesterMismatch);
    $("#dnFormDescription").addEventListener("input", checkDuplicateHint);

    $("#dnFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const qtyRaw = $("#dnFormQuantity").value;
      const payload = {
        departmentId: $("#dnFormDepartment").value,
        requestedByEmployeeId: $("#dnFormRequester").value,
        costCenterId: $("#dnFormCostCenter").value || null,
        itemId: $("#dnFormItem").value || null,
        needDescription: $("#dnFormDescription").value.trim(),
        estimatedQuantity: qtyRaw === "" ? null : Number(qtyRaw),
        urgency: $("#dnFormUrgency").value,
        requiredByDate: $("#dnFormRequiredBy").value || null
      };

      const dept = ERP_DepartmentRepository.findById(payload.departmentId);
      const deptLabel = dept ? dept.deptName : "this department";

      if (editingId) {
        openConfirm({
          title: "Save changes to this need?",
          message: `This department need for ${deptLabel} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_DepartmentNeedRepository.update(editingId, payload);
            logSystemActivity({ module: "Department Need", action: "Update", description: `Updated department need for ${deptLabel} (${company.name})` });
            closeModal("dnFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_DepartmentNeedRepository.findById(editingId));
            showToast("Department need updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Raise this department need?",
          message: `A new need will be raised for ${deptLabel}, starting as a Draft.`,
          confirmLabel: "Raise Need",
          onConfirm: () => {
            const created = ERP_DepartmentNeedRepository.create(company, payload);
            logSystemActivity({ module: "Department Need", action: "Create", description: `Raised department need "${created.needCode}" for ${deptLabel} (${company.name})` });
            closeModal("dnFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.needCode}" raised as a Draft.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS — one function per transition. Every one goes through
     openConfirm() except Reject, which needs a reason first (see
     bindRejectModal below).
     --------------------------------------------------------------------- */
  function requestSubmit(n) {
    openConfirm({
      title: "Submit this need for approval?",
      message: `"${n.needCode}" will be locked from further edits and sent for approval.`,
      confirmLabel: "Submit for Approval",
      onConfirm: () => {
        ERP_DepartmentNeedRepository.submit(n.id, session.username);
        logSystemActivity({ module: "Department Need", action: "Submit", description: `Submitted need "${n.needCode}" for approval (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === n.id) openDetailModal(ERP_DepartmentNeedRepository.findById(n.id));
        showToast(`"${n.needCode}" submitted for approval.`, "success");
      }
    });
  }

  function requestWithdraw(n) {
    openConfirm({
      title: "Withdraw this need?",
      message: `"${n.needCode}" will move back to Draft so you can edit it again before resubmitting.`,
      confirmLabel: "Withdraw",
      onConfirm: () => {
        ERP_DepartmentNeedRepository.withdraw(n.id);
        logSystemActivity({ module: "Department Need", action: "Withdraw", description: `Withdrew need "${n.needCode}" back to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === n.id) openDetailModal(ERP_DepartmentNeedRepository.findById(n.id));
        showToast(`"${n.needCode}" moved back to Draft.`, "info");
      }
    });
  }

  function requestApprove(n) {
    openConfirm({
      title: "Approve this need?",
      message: `"${n.needCode}" will be approved and become available for a Purchase Requisition to be built from.`,
      confirmLabel: "Approve",
      onConfirm: () => {
        ERP_DepartmentNeedRepository.approve(n.id, session.username);
        logSystemActivity({ module: "Department Need", action: "Approve", description: `Approved need "${n.needCode}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === n.id) openDetailModal(ERP_DepartmentNeedRepository.findById(n.id));
        showToast(`"${n.needCode}" approved.`, "success");
      }
    });
  }

  function requestReject(n) {
    rejectingId = n.id;
    $("#dnRejectReason").value = "";
    $("#dnRejectReasonError").textContent = "";
    openModal("dnRejectModal");
  }

  function bindRejectModal() {
    $("#dnRejectConfirmBtn").addEventListener("click", () => {
      const reason = $("#dnRejectReason").value.trim();
      if (!reason) { $("#dnRejectReasonError").textContent = "A reason is required so the requester knows what to fix."; return; }
      const n = ERP_DepartmentNeedRepository.findById(rejectingId);
      if (!n) { closeModal("dnRejectModal"); return; }
      ERP_DepartmentNeedRepository.reject(n.id, session.username, reason);
      logSystemActivity({ module: "Department Need", action: "Reject", description: `Rejected need "${n.needCode}" for ${company.name}: ${reason}`, severity: "warning" });
      closeModal("dnRejectModal");
      renderAll();
      renderActivity();
      if (detailId === n.id) openDetailModal(ERP_DepartmentNeedRepository.findById(n.id));
      showToast(`"${n.needCode}" rejected.`, "info");
    });
  }

  function requestRevise(n) {
    openConfirm({
      title: "Revise this need?",
      message: `"${n.needCode}" will move back to Draft so you can update it and resubmit.`,
      confirmLabel: "Revise",
      onConfirm: () => {
        ERP_DepartmentNeedRepository.reopen(n.id);
        logSystemActivity({ module: "Department Need", action: "Revise", description: `Reopened rejected need "${n.needCode}" to Draft for revision (${company.name})` });
        if (detailId === n.id) closeModal("dnDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${n.needCode}" is back in Draft — update and resubmit when ready.`, "info");
      }
    });
  }

  function requestCancel(n) {
    openConfirm({
      title: "Cancel this need?",
      message: `"${n.needCode}" will be marked Cancelled. It stays on record but won't be actionable anymore.`,
      confirmLabel: "Cancel Need",
      onConfirm: () => {
        ERP_DepartmentNeedRepository.cancel(n.id, session.username);
        logSystemActivity({ module: "Department Need", action: "Cancel", description: `Cancelled need "${n.needCode}" for ${company.name}`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === n.id) openDetailModal(ERP_DepartmentNeedRepository.findById(n.id));
        showToast(`"${n.needCode}" cancelled.`, "info");
      }
    });
  }

  /** Refuses up front for Submitted/Approved — see canDelete()/file header
      in data/department-need-data.js. */
  function requestDelete(n) {
    if (!ERP_DepartmentNeedRepository.canDelete(n)) {
      showToast(`"${n.needCode}" is ${n.status} and can't be deleted while it's still an active workflow record. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this need?",
      message: `"${n.needCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_DepartmentNeedRepository.remove(n.id);
        logSystemActivity({ module: "Department Need", action: "Delete", description: `Deleted need "${n.needCode}" for ${company.name}`, severity: "warning" });
        if (detailId === n.id) closeModal("dnDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${n.needCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL — footer buttons are genuinely different per status; see
     file header.
     --------------------------------------------------------------------- */
  function renderDetailFooter(n) {
    const footer = $("#dnDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (n.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(n));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("dnDetailModal"); openEditModal(n); });
      addBtn("Submit for Approval", "btn btn--primary", () => requestSubmit(n));
    } else if (n.status === "Submitted") {
      addBtn("Withdraw", "btn btn--ghost", () => requestWithdraw(n));
      addBtn("Reject", "btn btn--danger-outline", () => requestReject(n));
      addBtn("Approve", "btn btn--primary", () => requestApprove(n));
    } else if (n.status === "Approved") {
      addBtn("Cancel Need", "btn btn--danger-outline", () => requestCancel(n));
    } else if (n.status === "Rejected") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(n));
      addBtn("Revise & Resubmit", "btn btn--primary", () => requestRevise(n));
    } else if (n.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(n));
    }
  }

  function openDetailModal(n) {
    detailId = n.id;
    const dept = ERP_DepartmentRepository.findById(n.departmentId);
    const emp = ERP_EmployeeRepository.findById(n.requestedByEmployeeId);
    const cc = n.costCenterId ? ERP_CostCenterRepository.findById(n.costCenterId) : null;
    const item = n.itemId ? ERP_ItemRepository.findById(n.itemId) : null;
    const unit = item ? ERP_UnitRepository.findById(item.unitId) : null;
    const overdue = ERP_DepartmentNeedRepository.isOverdue(n);

    $("#dnDetailTitle").textContent = `${n.needCode} · ${n.status}`;

    const rows = [];
    rows.push(`<div><dt>Need Code</dt><dd><code>${escapeHtml(n.needCode)}</code></dd></div>`);
    rows.push(`<div><dt>Department</dt><dd>${dept ? escapeHtml(dept.deptName) : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Requested By</dt><dd>${emp ? escapeHtml(emp.fullName) + " (" + escapeHtml(emp.employeeCode) + ")" : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Cost Center</dt><dd>${cc ? escapeHtml(cc.ccName) : "—"}</dd></div>`);
    rows.push(`<div><dt>Linked Item</dt><dd>${item ? escapeHtml(item.itemName) + " (" + escapeHtml(item.itemCode) + (unit ? ", " + escapeHtml(unit.unitSymbol) : "") + ")" : "— not linked —"}</dd></div>`);
    rows.push(`<div><dt>Estimated Quantity</dt><dd>${n.estimatedQuantity != null ? escapeHtml(String(n.estimatedQuantity)) : "—"}</dd></div>`);
    rows.push(`<div><dt>Urgency</dt><dd><span class="status-badge status-badge--${urgencyBadgeClass(n.urgency)}">${escapeHtml(n.urgency)}</span></dd></div>`);
    rows.push(`<div><dt>Required By</dt><dd>${n.requiredByDate ? escapeHtml(n.requiredByDate) + (overdue ? ' <span class="status-badge status-badge--danger">Overdue</span>' : "") : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(n.status)}">${n.status}</span></dd></div>`);
    rows.push(`<div><dt>Raised</dt><dd>${formatDateTime(new Date(n.createdAt))}</dd></div>`);
    if (n.submittedAt) rows.push(`<div><dt>Submitted</dt><dd>${formatDateTime(new Date(n.submittedAt))} by ${escapeHtml(ERP_DepartmentNeedRepository.actorLabel(n.submittedByUsername))}</dd></div>`);
    if (n.status === "Approved" && n.approvedAt) rows.push(`<div><dt>Approved</dt><dd>${formatDateTime(new Date(n.approvedAt))} by ${escapeHtml(ERP_DepartmentNeedRepository.actorLabel(n.approvedByUsername))}</dd></div>`);
    if (n.status === "Rejected" && n.rejectedAt) {
      rows.push(`<div><dt>Rejected</dt><dd>${formatDateTime(new Date(n.rejectedAt))} by ${escapeHtml(ERP_DepartmentNeedRepository.actorLabel(n.rejectedByUsername))}</dd></div>`);
      rows.push(`<div><dt>Rejection Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(n.rejectionReason || "—")}</dd></div>`);
    }
    if (n.status === "Cancelled" && n.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(n.cancelledAt))} by ${escapeHtml(ERP_DepartmentNeedRepository.actorLabel(n.cancelledByUsername))}</dd></div>`);
    if (typeof ERP_PurchaseRequisitionRepository !== "undefined") {
      const linkedPr = ERP_PurchaseRequisitionRepository.findPrForNeed(company.id, n.id);
      if (linkedPr) {
        rows.push(`<div><dt>Linked to PR</dt><dd><code>${escapeHtml(linkedPr.prCode)}</code> <span class="status-badge status-badge--${linkedPr.status === "Approved" ? "success" : linkedPr.status === "Rejected" ? "danger" : linkedPr.status === "Submitted" ? "warning" : "neutral"}">${escapeHtml(linkedPr.status)}</span></dd></div>`);
      }
    }
    rows.push(`<div><dt>Description</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(n.needDescription)}</dd></div>`);

    $("#dnDetailBody").innerHTML = rows.join("");
    renderDetailFooter(n);
    openModal("dnDetailModal");
  }

  function bindDetailModal() {
    $("#dnTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const n = ERP_DepartmentNeedRepository.findById(viewBtn.dataset.id);
        if (n) openDetailModal(n);
        return;
      }
      if (actionBtn) {
        const n = ERP_DepartmentNeedRepository.findById(actionBtn.dataset.id);
        if (!n) return;
        if (actionBtn.dataset.action === "submit") requestSubmit(n);
        else if (actionBtn.dataset.action === "approve") requestApprove(n);
        else if (actionBtn.dataset.action === "revise") requestRevise(n);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "department-need")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading department needs…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#noAnchorState").hidden = true;
      $("#dnContent").hidden = true;
      $("#dnSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#dnSubtitle").textContent = `Managing department needs for ${company.name} (${company.companyCode}).`;

      const anyDept = ERP_DepartmentRepository.getAllForCompany(company.id).some((d) => d.status === "Active");
      const anyEmp = ERP_EmployeeRepository.getAllForCompany(company.id).some((e) => e.status !== "Inactive");

      if (!anyDept || !anyEmp) {
        const missing = [];
        if (!anyDept) missing.push("an active Department");
        if (!anyEmp) missing.push("an active Employee");
        $("#noAnchorMessage").textContent = `Every Department Need names a Department and the Employee raising it — this company doesn't have ${missing.join(" or ")} yet. Add at least one of each first.`;
        $("#noAnchorDeptBtn").hidden = anyDept;
        $("#noAnchorEmpBtn").hidden = anyEmp;
        $("#noAnchorState").hidden = false;
        $("#dnContent").hidden = true;
        $("#dnHeaderActions").hidden = true;
      } else {
        $("#noAnchorState").hidden = true;
        $("#dnContent").hidden = false;
        $("#dnHeaderActions").hidden = false;
        renderAll();
        renderActivity();
        bindToolbar();
        bindFormModal();
        bindDetailModal();
        bindRejectModal();

        // Dashboard's "Raise Department Need" quick action deep-links here
        // with ?action=add, the same precedent Add Employee/Add Item use.
        if (new URLSearchParams(window.location.search).get("action") === "add") {
          openAddModal();
        }
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
