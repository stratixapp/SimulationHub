/* =============================================================================
   DOT ERP — pages/attendance.js
   Phase 9, Module 01: Attendance

   Plain CRUD list (no lifecycle — see data/attendance-data.js's own
   header for why) plus a Bulk Mark modal reusing RFQ Creation's own
   `.checkbox-list`/`.checkbox-field` multi-select pattern.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, requireSession, runBootSequence, showToast,
    openModal, closeModal, openConfirm, logSystemActivity, actorLabel
  } = window.ERP;
  const PAGE_SIZE = 10;

  let session = null;
  let company = null;
  let page = 1;
  let editingId = null; // if set, the Mark Attendance modal is editing this existing record

  const STATUS_TONE = { Present: "success", Absent: "danger", "Half Day": "warning", "Week Off": "neutral", Holiday: "info" };

  function statusBadge(status) {
    return `<span class="status-badge status-badge--${STATUS_TONE[status] || "neutral"}">${escapeHtml(status)}</span>`;
  }

  function employeeName(id) {
    const e = ERP_EmployeeRepository.findById(id);
    return e ? e.fullName : "Removed employee";
  }

  function activeEmployees() {
    return ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status !== "Inactive");
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /* -----------------------------------------------------------------------
     FILTERS + TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function currentFilters() {
    return {
      fromDate: $("#atFromDate").value || "",
      toDate: $("#atToDate").value || "",
      employeeId: $("#atEmployeeFilter").value || "",
      status: $("#atStatusFilter").value || ""
    };
  }

  function getFilteredRows() {
    const f = currentFilters();
    let rows = ERP_AttendanceRepository.getAllForCompany(company.id);
    if (f.fromDate) rows = rows.filter((r) => r.date >= f.fromDate);
    if (f.toDate) rows = rows.filter((r) => r.date <= f.toDate);
    if (f.employeeId) rows = rows.filter((r) => r.employeeId === f.employeeId);
    if (f.status) rows = rows.filter((r) => r.status === f.status);
    return rows;
  }

  function renderPagination(totalPages) {
    const container = $("#atPagination");
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
    const rows = getFilteredRows();
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);

    $("#atEmptyState").hidden = rows.length !== 0;
    $("#atTable").hidden = rows.length === 0;

    $("#atTableBody").innerHTML = pageRows.map((r) => `
      <tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(employeeName(r.employeeId))}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${escapeHtml(r.notes || "—")}</td>
        <td>${escapeHtml(r.markedByUsername || "—")}</td>
        <td class="text-right">
          <button type="button" class="btn btn--ghost btn--sm" data-edit="${r.id}">Edit</button>
          <button type="button" class="btn btn--ghost btn--sm" data-delete="${r.id}">Delete</button>
        </td>
      </tr>`).join("");

    $$("#atTableBody [data-edit]").forEach((btn) => btn.addEventListener("click", () => openMarkModal(ERP_AttendanceRepository.findById(btn.dataset.edit))));
    $$("#atTableBody [data-delete]").forEach((btn) => btn.addEventListener("click", () => confirmDelete(btn.dataset.delete)));

    renderPagination(totalPages);
    renderTodaySummary();
  }

  function renderTodaySummary() {
    const today = todayISO();
    const todaysRows = ERP_AttendanceRepository.getAllForCompany(company.id).filter((r) => r.date === today);
    const employees = activeEmployees();
    const markedIds = new Set(todaysRows.map((r) => r.employeeId));
    $("#atSummaryPresent").textContent = String(todaysRows.filter((r) => r.status === "Present").length);
    $("#atSummaryAbsent").textContent = String(todaysRows.filter((r) => r.status === "Absent").length);
    $("#atSummaryUnmarked").textContent = String(employees.filter((e) => !markedIds.has(e.id)).length);
  }

  /* -----------------------------------------------------------------------
     MARK ATTENDANCE MODAL (add or edit — markAttendance() upserts either way)
     --------------------------------------------------------------------- */
  function populateEmployeeSelects() {
    const employees = activeEmployees().sort((a, b) => a.fullName.localeCompare(b.fullName));
    const options = employees.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)} (${escapeHtml(e.employeeCode)})</option>`).join("");
    $("#atFormEmployee").innerHTML = options;
    $("#atEmployeeFilter").insertAdjacentHTML("beforeend", options);
  }

  function populateStatusSelects() {
    const options = ERP_AttendanceRepository.statuses.map((s) => `<option value="${s}">${s}</option>`).join("");
    $("#atFormStatus").innerHTML = options;
    $("#atBulkStatus").innerHTML = options;
    $("#atStatusFilter").insertAdjacentHTML("beforeend", ERP_AttendanceRepository.statuses.map((s) => `<option value="${s}">${s}</option>`).join(""));
  }

  function openMarkModal(existing) {
    editingId = existing ? existing.id : null;
    $("#atFormTitle").textContent = existing ? "Edit Attendance" : "Mark Attendance";
    $("#atFormEmployee").value = existing ? existing.employeeId : ($("#atFormEmployee").options[0] ? $("#atFormEmployee").options[0].value : "");
    $("#atFormDate").value = existing ? existing.date : todayISO();
    $("#atFormStatus").value = existing ? existing.status : "Present";
    $("#atFormNotes").value = existing ? existing.notes || "" : "";
    $("#atFormEmployeeError").textContent = "";
    $("#atFormDateError").textContent = "";
    checkUpsertNote();
    openModal("attendanceFormModal");
  }

  function checkUpsertNote() {
    const employeeId = $("#atFormEmployee").value;
    const date = $("#atFormDate").value;
    const existing = employeeId && date ? ERP_AttendanceRepository.getForEmployeeAndDate(company.id, employeeId, date) : null;
    $("#atFormUpsertNote").hidden = !(existing && existing.id !== editingId);
  }

  function saveMarkForm() {
    const employeeId = $("#atFormEmployee").value;
    const date = $("#atFormDate").value;
    const status = $("#atFormStatus").value;
    const notes = $("#atFormNotes").value.trim();

    let valid = true;
    if (!employeeId) { $("#atFormEmployeeError").textContent = "Choose an employee."; valid = false; } else { $("#atFormEmployeeError").textContent = ""; }
    if (!date) { $("#atFormDateError").textContent = "Choose a date."; valid = false; } else { $("#atFormDateError").textContent = ""; }
    if (!valid) return;

    const record = ERP_AttendanceRepository.markAttendance(company, employeeId, date, status, notes, actorLabel(session.username));
    logSystemActivity({ module: "Attendance", action: "Mark", description: `Marked ${employeeName(employeeId)} ${status} on ${date} for ${company.name}` });
    closeModal("attendanceFormModal");
    showToast(`${employeeName(employeeId)} marked ${status} on ${date}.`, "success");
    renderTable();
  }

  function confirmDelete(id) {
    const record = ERP_AttendanceRepository.findById(id);
    if (!record) return;
    openConfirm({
      title: "Delete attendance record?",
      message: `The ${record.status} record for ${employeeName(record.employeeId)} on ${record.date} will be permanently removed.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_AttendanceRepository.remove(id);
        logSystemActivity({ module: "Attendance", action: "Delete", description: `Deleted attendance record for ${employeeName(record.employeeId)} on ${record.date}`, severity: "warning" });
        showToast("Attendance record deleted.", "info");
        renderTable();
      }
    });
  }

  /* -----------------------------------------------------------------------
     BULK MARK MODAL
     --------------------------------------------------------------------- */
  function populateBulkEmployeeList() {
    const employees = activeEmployees().sort((a, b) => a.fullName.localeCompare(b.fullName));
    if (!employees.length) {
      $("#atBulkEmployeeList").innerHTML = `<p class="profile-subtle">No active employees yet.</p>`;
      return;
    }
    $("#atBulkEmployeeList").innerHTML = employees.map((e) => `
      <label class="checkbox-field">
        <input type="checkbox" value="${e.id}" checked />
        ${escapeHtml(e.fullName)} (${escapeHtml(e.employeeCode)})
      </label>`).join("");
  }

  function getBulkCheckedIds() {
    return $$("#atBulkEmployeeList input[type=checkbox]").filter((el) => el.checked).map((el) => el.value);
  }

  function openBulkModal() {
    $("#atBulkDate").value = todayISO();
    $("#atBulkStatus").value = "Present";
    populateBulkEmployeeList();
    openModal("bulkMarkModal");
  }

  function saveBulkMark() {
    const date = $("#atBulkDate").value;
    const status = $("#atBulkStatus").value;
    const ids = getBulkCheckedIds();
    if (!date) { showToast("Choose a date first.", "warning"); return; }
    if (!ids.length) { showToast("Select at least one employee.", "warning"); return; }

    ERP_AttendanceRepository.bulkMark(company, ids, date, status, actorLabel(session.username));
    logSystemActivity({ module: "Attendance", action: "Bulk Mark", description: `Bulk-marked ${ids.length} employee(s) ${status} on ${date} for ${company.name}` });
    closeModal("bulkMarkModal");
    showToast(`${ids.length} employee(s) marked ${status} on ${date}.`, "success");
    renderTable();
  }

  /* -----------------------------------------------------------------------
     CSV EXPORT
     --------------------------------------------------------------------- */
  function exportCsv() {
    const rows = getFilteredRows();
    if (!rows.length) { showToast("Nothing to export — no records match the current filters.", "warning"); return; }
    const lines = [["Date", "Employee", "Status", "Notes", "Marked By"].join(",")];
    rows.forEach((r) => {
      lines.push([r.date, `"${employeeName(r.employeeId).replace(/"/g, '""')}"`, r.status, `"${(r.notes || "").replace(/"/g, '""')}"`, r.markedByUsername || ""].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `attendance-${company.companyCode}.csv`;
    link.click();
  }

  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "attendance")) return;

    runBootSequence([
      { p: 40, t: "Loading employees…" },
      { p: 80, t: "Loading attendance records…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#atContent").hidden = true;
      $("#atSubtitle").textContent = "No active company yet.";
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    if (!activeEmployees().length) {
      $("#noCompanyState").hidden = true;
      $("#noEmployeesState").hidden = false;
      $("#atContent").hidden = true;
      $("#atSubtitle").textContent = `No employees yet for ${company.name} (${company.companyCode}).`;
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    $("#noCompanyState").hidden = true;
    $("#noEmployeesState").hidden = true;
    $("#atContent").hidden = false;
    $("#atHeaderActions").hidden = false;
    $("#atSubtitle").textContent = `Daily attendance for ${company.name} (${company.companyCode}).`;

    populateEmployeeSelects();
    populateStatusSelects();

    ["#atFromDate", "#atToDate", "#atEmployeeFilter", "#atStatusFilter"].forEach((sel) => {
      $(sel).addEventListener("change", () => { page = 1; renderTable(); });
    });
    $("#atClearFiltersBtn").addEventListener("click", () => {
      $("#atFromDate").value = ""; $("#atToDate").value = ""; $("#atEmployeeFilter").value = ""; $("#atStatusFilter").value = "";
      page = 1; renderTable();
    });

    $("#atAddBtn").addEventListener("click", () => openMarkModal(null));
    $("#atFormSaveBtn").addEventListener("click", saveMarkForm);
    $("#atFormEmployee").addEventListener("change", checkUpsertNote);
    $("#atFormDate").addEventListener("change", checkUpsertNote);

    $("#atBulkMarkBtn").addEventListener("click", openBulkModal);
    $("#atBulkSaveBtn").addEventListener("click", saveBulkMark);
    $("#atBulkSelectAllBtn").addEventListener("click", () => $$("#atBulkEmployeeList input[type=checkbox]").forEach((el) => { el.checked = true; }));
    $("#atBulkSelectNoneBtn").addEventListener("click", () => $$("#atBulkEmployeeList input[type=checkbox]").forEach((el) => { el.checked = false; }));

    $("#atExportCsvBtn").addEventListener("click", exportCsv);

    renderTable();
    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
