/* =============================================================================
   DOT ERP — pages/employees.js
   Phase 3, Module 01: Employee Master

   Flat list, like Cost Centers/Warehouses — org structure lives in
   Departments, this module doesn't duplicate a tree view. What IS a real
   tree here is the Reports-To reporting line — see data/employee-data.js's
   header for the full reasoning behind the cycle-guard, the three-state
   lifecycle, the email-based duplicate check, and the deletion guard.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity,
    emailPattern: EMAIL_PATTERN
  } = window.ERP;

  const PAGE_SIZE = 6;

  let session = null;
  let company = null;
  let filterType = "all";
  let filterStatus = "all";
  let sortOrder = "asc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;


  /* -----------------------------------------------------------------------
     HELPERS
     --------------------------------------------------------------------- */
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function departmentLabelFor(emp) {
    if (!emp.departmentId) return `<span class="profile-subtle">Not set</span>`;
    const dept = ERP_DepartmentRepository.findById(emp.departmentId);
    return dept ? escapeHtml(dept.deptName) : `<span class="profile-subtle">—</span>`;
  }
  function managerLabelFor(emp) {
    if (!emp.managerId) return `<span class="profile-subtle">None</span>`;
    const mgr = ERP_EmployeeRepository.findById(emp.managerId);
    return mgr ? escapeHtml(mgr.fullName) : `<span class="profile-subtle">—</span>`;
  }
  function formatTenure(emp) {
    const tenure = ERP_EmployeeRepository.getTenure(emp, todayISO());
    return tenure ? tenure.label : "—";
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_EmployeeRepository.getAllForCompany(company.id);

    if (filterType !== "all") rows = rows.filter((e) => e.employmentType === filterType);
    if (filterStatus !== "all") rows = rows.filter((e) => e.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((e) =>
        e.fullName.toLowerCase().includes(term) ||
        e.employeeCode.toLowerCase().includes(term) ||
        (e.designation || "").toLowerCase().includes(term) ||
        (e.workEmail || "").toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.fullName.localeCompare(b.fullName);
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  function renderSummary() {
    const all = ERP_EmployeeRepository.getAllForCompany(company.id);
    $("#empSummaryTotal").textContent = String(all.length);
    const active = all.filter((e) => e.status === "Active");
    $("#empSummaryActive").textContent = String(active.length);
    $("#empSummaryOnLeave").textContent = String(all.filter((e) => e.status === "On Leave").length);

    if (!active.length) {
      $("#empSummaryTenure").textContent = "—";
    } else {
      const today = todayISO();
      const avgMonths = active.reduce((sum, e) => {
        const t = ERP_EmployeeRepository.getTenure(e, today);
        return sum + (t ? t.totalMonths : 0);
      }, 0) / active.length;
      const years = Math.floor(avgMonths / 12);
      const months = Math.round(avgMonths % 12);
      $("#empSummaryTenure").textContent = years > 0 ? `${years}y ${months}m` : `${months}m`;
    }
  }


  /* -----------------------------------------------------------------------
     TYPE CHIPS (built from the fixed reference list)
     --------------------------------------------------------------------- */
  function buildTypeChips() {
    const container = $("#empTypeChips");
    const extra = ERP_EmployeeRepository.employmentTypes.map((type) =>
      `<button type="button" class="chip" data-type="${escapeHtml(type)}">${escapeHtml(type)}</button>`
    ).join("");
    container.insertAdjacentHTML("beforeend", extra);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#empPagination");
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

  const STATUS_BADGE = { Active: "success", "On Leave": "warning", Inactive: "danger" };

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#empEmptyState").hidden = all.length !== 0;
    $("#empTable").hidden = all.length === 0;

    $("#empTableBody").innerHTML = pageItems.map((e) => {
      const statusBadge = `<span class="status-badge status-badge--${STATUS_BADGE[e.status]}">${e.status}</span>`;
      let quickAction = "";
      if (e.status === "Active") quickAction = `<button type="button" class="link-btn" data-action="On Leave" data-id="${e.id}">Mark On Leave</button>`;
      else if (e.status === "On Leave") quickAction = `<button type="button" class="link-btn" data-action="Active" data-id="${e.id}">Mark Active</button>`;
      else quickAction = `<button type="button" class="link-btn" data-action="Active" data-id="${e.id}">Reactivate</button>`;

      return `
      <tr>
        <td><code>${escapeHtml(e.employeeCode)}</code></td>
        <td>${escapeHtml(e.fullName)}</td>
        <td>${escapeHtml(e.designation)}</td>
        <td>${departmentLabelFor(e)}</td>
        <td>${managerLabelFor(e)}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${e.id}">View</button>
          ${quickAction}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     TOOLBAR: type + status chips, sort, search, export, print
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#empTypeChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#empTypeChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterType = chip.dataset.type;
        page = 1;
        renderTable();
      });
    });

    $$("#empStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#empStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#empSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#empSortBtn").textContent = sortOrder === "asc" ? "Name A-Z" : "Name Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#empExportCsvBtn").addEventListener("click", exportCsv);
    $("#empPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Designation", "Employment Type", "Department", "Branch", "Reports To", "Work Email", "Phone", "Date of Joining", "Date of Exit", "Tenure", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((e) => {
      const dept = e.departmentId ? ERP_DepartmentRepository.findById(e.departmentId) : null;
      const branch = e.branchId ? ERP_BranchRepository.findById(e.branchId) : null;
      const mgr = e.managerId ? ERP_EmployeeRepository.findById(e.managerId) : null;
      const line = [
        e.employeeCode, e.fullName, e.designation, e.employmentType,
        dept ? dept.deptName : "", branch ? branch.branchName : "", mgr ? mgr.fullName : "",
        e.workEmail, e.phone || "", e.dateOfJoining, e.dateOfExit || "", formatTenure(e), e.status
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-employees-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Employees exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((e) => {
      const dept = e.departmentId ? ERP_DepartmentRepository.findById(e.departmentId) : null;
      return `<tr><td>${escapeHtml(e.employeeCode)}</td><td>${escapeHtml(e.fullName)}</td><td>${escapeHtml(e.designation)}</td><td>${escapeHtml(dept ? dept.deptName : "—")}</td><td>${escapeHtml(formatTenure(e))}</td><td>${escapeHtml(e.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Employee Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Employee Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Department</th><th>Tenure</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Employee Master")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#empActivityEmptyState").hidden = relevant.length !== 0;
    $("#empActivityList").innerHTML = relevant.map((e) => `
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
     FORM OPTION LISTS
     --------------------------------------------------------------------- */
  function populateTypeOptions() {
    $("#empFormType").innerHTML = ERP_EmployeeRepository.employmentTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
  }
  function populateDepartmentOptions() {
    const depts = ERP_DepartmentRepository.getAllForCompany(company.id);
    $("#empFormDepartment").innerHTML = `<option value="">Not set</option>` +
      depts.map((d) => `<option value="${d.id}">${escapeHtml(d.deptName)}</option>`).join("");
  }
  function populateBranchOptions() {
    const branches = ERP_BranchRepository.getAllForCompany(company.id).filter((b) => b.isPrimary || b.status === "Active");
    $("#empFormBranch").innerHTML = `<option value="">Not linked</option>` +
      branches.map((b) => `<option value="${b.id}">${escapeHtml(b.branchName)}</option>`).join("");
  }

  /** Excludes this employee and everyone already in their own reporting
      chain (direct or indirect) from the Reports To picker — the same
      shape as Departments' populateParentOptions excluding a department's
      own descendants. Defense in depth alongside the wouldCreateManager-
      Cycle check on save; this just keeps the UI from ever offering an
      obviously-cyclic choice in the first place. If the currently-assigned
      manager has since gone Inactive, they're kept in the list anyway so
      editing doesn't silently discard a valid existing assignment. */
  function populateManagerOptions(excludeEmployeeId) {
    const all = ERP_EmployeeRepository.getAllForCompany(company.id);
    const excluded = new Set();
    if (excludeEmployeeId) {
      excluded.add(excludeEmployeeId);
      ERP_EmployeeRepository.getAllReports(company.id, excludeEmployeeId).forEach((e) => excluded.add(e.id));
    }
    let candidates = all.filter((e) => !excluded.has(e.id) && e.status !== "Inactive");

    const current = excludeEmployeeId ? ERP_EmployeeRepository.findById(excludeEmployeeId) : null;
    if (current && current.managerId && !candidates.some((e) => e.id === current.managerId) && !excluded.has(current.managerId)) {
      const currentManager = ERP_EmployeeRepository.findById(current.managerId);
      if (currentManager) candidates.push(currentManager);
    }

    candidates.sort((a, b) => a.fullName.localeCompare(b.fullName));
    $("#empFormManager").innerHTML = `<option value="">None (top of the reporting line)</option>` +
      candidates.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)} — ${escapeHtml(e.designation || "")}</option>`).join("");
  }


  /* -----------------------------------------------------------------------
     ADD / EDIT EMPLOYEE MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["empFormName", "empFormDesignation", "empFormDoj", "empFormEmail", "empFormDoe"].forEach((f) => setFormError(f, ""));
  }

  function openAddModal() {
    editingId = null;
    $("#empFormTitle").textContent = "Add employee";
    $("#empFormIntro").textContent = "Add an employee to your Employee Master.";
    $("#empFormSaveBtn").textContent = "Add Employee";
    $("#empFormName").value = "";
    $("#empFormDesignation").value = "";
    populateTypeOptions();
    $("#empFormDoj").value = todayISO();
    populateDepartmentOptions();
    $("#empFormDepartment").value = "";
    populateBranchOptions();
    $("#empFormBranch").value = "";
    populateManagerOptions(null);
    $("#empFormManager").value = "";
    $("#empFormEmail").value = "";
    $("#empFormPhone").value = "";
    $("#empFormDoe").value = "";
    $("#empFormNotes").value = "";
    clearFormErrors();
    openModal("empFormModal");
  }

  function openEditModal(emp) {
    editingId = emp.id;
    $("#empFormTitle").textContent = "Edit employee";
    $("#empFormIntro").textContent = "Update this employee's details.";
    $("#empFormSaveBtn").textContent = "Save Changes";
    $("#empFormName").value = emp.fullName;
    $("#empFormDesignation").value = emp.designation;
    populateTypeOptions();
    $("#empFormType").value = emp.employmentType;
    $("#empFormDoj").value = emp.dateOfJoining;
    populateDepartmentOptions();
    $("#empFormDepartment").value = emp.departmentId || "";
    populateBranchOptions();
    $("#empFormBranch").value = emp.branchId || "";
    populateManagerOptions(emp.id);
    $("#empFormManager").value = emp.managerId || "";
    $("#empFormEmail").value = emp.workEmail;
    $("#empFormPhone").value = emp.phone || "";
    $("#empFormDoe").value = emp.dateOfExit || "";
    $("#empFormNotes").value = emp.notes || "";
    clearFormErrors();
    openModal("empFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#empFormName").value.trim();
    if (!name) { setFormError("empFormName", "Full name is required."); valid = false; }
    else if (name.length > 60) { setFormError("empFormName", "Maximum 60 characters allowed."); valid = false; }

    const designation = $("#empFormDesignation").value.trim();
    if (!designation) { setFormError("empFormDesignation", "Designation is required."); valid = false; }

    const doj = $("#empFormDoj").value;
    if (!doj) { setFormError("empFormDoj", "Date of joining is required."); valid = false; }

    const email = $("#empFormEmail").value.trim();
    if (!email) { setFormError("empFormEmail", "Work email is required."); valid = false; }
    else if (!EMAIL_PATTERN.test(email)) { setFormError("empFormEmail", "Enter a valid email address."); valid = false; }
    else if (ERP_EmployeeRepository.hasDuplicateEmail(company.id, email, editingId)) { setFormError("empFormEmail", "Another employee already uses this email."); valid = false; }

    const doe = $("#empFormDoe").value;
    if (doe && doj && doe < doj) { setFormError("empFormDoe", "Date of exit can't be before date of joining."); valid = false; }

    const proposedManagerId = $("#empFormManager").value || null;
    if (proposedManagerId && editingId && ERP_EmployeeRepository.wouldCreateManagerCycle(company.id, editingId, proposedManagerId)) {
      showToast("That manager assignment would create a reporting loop — pick someone outside this person's own reporting chain.", "warning");
      valid = false;
    }

    return valid;
  }

  function bindFormModal() {
    $("#empAddBtn").addEventListener("click", openAddModal);

    $("#empFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        fullName: $("#empFormName").value.trim(),
        designation: $("#empFormDesignation").value.trim(),
        employmentType: $("#empFormType").value,
        dateOfJoining: $("#empFormDoj").value,
        departmentId: $("#empFormDepartment").value || null,
        branchId: $("#empFormBranch").value || null,
        managerId: $("#empFormManager").value || null,
        workEmail: $("#empFormEmail").value.trim(),
        phone: $("#empFormPhone").value.trim(),
        dateOfExit: $("#empFormDoe").value || null,
        notes: $("#empFormNotes").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this employee?",
          message: `"${payload.fullName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_EmployeeRepository.update(editingId, payload);
            logSystemActivity({ module: "Employee Master", action: "Update", description: `Updated employee "${payload.fullName}" for ${company.name}` });
            closeModal("empFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_EmployeeRepository.findById(editingId));
            showToast("Employee updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this employee?",
          message: `"${payload.fullName}" (${payload.designation}) will be added.`,
          confirmLabel: "Add Employee",
          onConfirm: () => {
            const created = ERP_EmployeeRepository.create(company, payload);
            logSystemActivity({ module: "Employee Master", action: "Create", description: `Added employee "${created.fullName}" (${created.employeeCode}) for ${company.name}` });
            closeModal("empFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.fullName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (three-state: Active / On Leave / Inactive)
     --------------------------------------------------------------------- */
  function requestSetStatus(emp, newStatus) {
    const labels = {
      Active: emp.status === "On Leave" ? "Mark Active" : "Reactivate",
      "On Leave": "Mark On Leave",
      Inactive: "Mark as Exited"
    };
    const pastTense = {
      Active: emp.status === "On Leave" ? "Marked Active" : "Reactivated",
      "On Leave": "Marked On Leave",
      Inactive: "Marked as Exited"
    };
    const willSetExitDate = newStatus === "Inactive" && !emp.dateOfExit;
    const messages = {
      Active: `"${emp.fullName}" will become Active again.`,
      "On Leave": `"${emp.fullName}" will be marked On Leave — a temporary status. It stays visible everywhere and can be reversed any time.`,
      Inactive: `"${emp.fullName}" will be marked as exited.${willSetExitDate ? " Since no Date of Exit was set, today's date will be recorded as their exit date." : ""} They stay on record and can be reactivated any time (e.g. a rehire).`
    };
    openConfirm({
      title: `${labels[newStatus]}?`,
      message: messages[newStatus],
      confirmLabel: labels[newStatus],
      onConfirm: () => {
        const updates = { status: newStatus };
        if (willSetExitDate) updates.dateOfExit = todayISO();
        ERP_EmployeeRepository.update(emp.id, updates);
        logSystemActivity({ module: "Employee Master", action: labels[newStatus], description: `${pastTense[newStatus]} employee "${emp.fullName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === emp.id) openDetailModal(ERP_EmployeeRepository.findById(emp.id));
        showToast(`"${emp.fullName}" is now ${newStatus}.`, "success");
      }
    });
  }

  function requestDelete(emp) {
    if (ERP_EmployeeRepository.hasDirectReports(company.id, emp.id)) {
      showToast(`"${emp.fullName}" has direct reports and can't be deleted until they're reassigned to someone else first.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this employee?",
      message: `"${emp.fullName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_EmployeeRepository.remove(emp.id, company.id);
        logSystemActivity({ module: "Employee Master", action: "Delete", description: `Deleted employee "${emp.fullName}" for ${company.name}`, severity: "warning" });
        if (detailId === emp.id) closeModal("empDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${emp.fullName}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(emp) {
    const footer = $("#empDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(emp));
    if (emp.status === "Active") {
      addBtn("Mark On Leave", "btn btn--ghost", () => requestSetStatus(emp, "On Leave"));
      addBtn("Mark as Exited", "btn btn--ghost", () => requestSetStatus(emp, "Inactive"));
    } else if (emp.status === "On Leave") {
      addBtn("Mark Active", "btn btn--ghost", () => requestSetStatus(emp, "Active"));
      addBtn("Mark as Exited", "btn btn--ghost", () => requestSetStatus(emp, "Inactive"));
    } else {
      addBtn("Reactivate", "btn btn--ghost", () => requestSetStatus(emp, "Active"));
    }
    addBtn("Edit", "btn btn--primary", () => { closeModal("empDetailModal"); openEditModal(emp); });
  }

  function openDetailModal(emp) {
    detailId = emp.id;
    const dept = emp.departmentId ? ERP_DepartmentRepository.findById(emp.departmentId) : null;
    const branch = emp.branchId ? ERP_BranchRepository.findById(emp.branchId) : null;
    const manager = emp.managerId ? ERP_EmployeeRepository.findById(emp.managerId) : null;
    const tenure = ERP_EmployeeRepository.getTenure(emp, todayISO());

    $("#empDetailTitle").textContent = `${emp.fullName} · ${emp.employeeCode}`;

    const chain = ERP_EmployeeRepository.getManagerChain(company.id, emp.id);
    $("#empDetailReportingLine").textContent = chain.length
      ? `Reporting line: ${chain.map((m) => m.fullName).join(" → ")} → ${emp.fullName}`
      : "Top of their reporting line — no one above them.";

    $("#empDetailBody").innerHTML = `
      <div><dt>Full Name</dt><dd>${escapeHtml(emp.fullName)}</dd></div>
      <div><dt>Employee Code</dt><dd>${escapeHtml(emp.employeeCode)}</dd></div>
      <div><dt>Designation</dt><dd>${escapeHtml(emp.designation)}</dd></div>
      <div><dt>Employment Type</dt><dd>${escapeHtml(emp.employmentType)}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${STATUS_BADGE[emp.status]}">${emp.status}</span></dd></div>
      <div><dt>Department</dt><dd>${dept ? escapeHtml(dept.deptName) : "Not set"}</dd></div>
      <div><dt>Branch</dt><dd>${branch ? escapeHtml(branch.branchName) : "Not linked"}</dd></div>
      <div><dt>Reports To</dt><dd>${manager ? escapeHtml(manager.fullName) : "None"}</dd></div>
      <div><dt>Work Email</dt><dd>${escapeHtml(emp.workEmail)}</dd></div>
      <div><dt>Phone</dt><dd>${escapeHtml(emp.phone || "—")}</dd></div>
      <div><dt>Date of Joining</dt><dd>${escapeHtml(emp.dateOfJoining)}</dd></div>
      ${emp.dateOfExit ? `<div><dt>Date of Exit</dt><dd>${escapeHtml(emp.dateOfExit)}</dd></div>` : ""}
      <div><dt>Tenure</dt><dd>${tenure ? escapeHtml(tenure.label) : "—"}${tenure && tenure.asOf === "exit" ? ` <span class="profile-subtle">(as of exit)</span>` : ""}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(emp.createdAt))}</dd></div>
      ${emp.notes ? `<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(emp.notes)}</dd></div>` : ""}
    `;

    const reports = ERP_EmployeeRepository.getDirectReports(company.id, emp.id);
    $("#empDetailReportsEmpty").hidden = reports.length !== 0;
    $("#empDetailReports").innerHTML = reports.map((r) => `<span class="chip">${escapeHtml(r.fullName)} <span class="profile-subtle">(${escapeHtml(r.designation || "")})</span></span>`).join("");

    renderDetailFooter(emp);
    openModal("empDetailModal");
  }

  function bindDetailModal() {
    $("#empTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const emp = ERP_EmployeeRepository.findById(viewBtn.dataset.id);
        if (emp) openDetailModal(emp);
        return;
      }
      if (actionBtn) {
        const emp = ERP_EmployeeRepository.findById(actionBtn.dataset.id);
        if (emp) requestSetStatus(emp, actionBtn.dataset.action);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "employees")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading employees…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#empContent").hidden = true;
      $("#empSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#empContent").hidden = false;
      $("#empHeaderActions").hidden = false;
      $("#empSubtitle").textContent = `Managing employees for ${company.name} (${company.companyCode}).`;
      buildTypeChips();
      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();

      // Dashboard's "Add Employee" quick action deep-links here with
      // ?action=add so it opens straight to the form, not just the list.
      if (new URLSearchParams(window.location.search).get("action") === "add") {
        openAddModal();
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
