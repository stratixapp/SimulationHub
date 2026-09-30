/* =============================================================================
   DOT ERP — pages/leave.js
   Phase 9, Module 02: Leave Application & Approval
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
  let statusFilter = "all";
  let decidingId = null; // the application currently open in the decision modal

  const STATUS_TONE = { Pending: "warning", Approved: "success", Rejected: "danger", Cancelled: "neutral" };

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
      employeeId: $("#lvEmployeeFilter").value || "",
      leaveType: $("#lvTypeFilter").value || "",
      status: statusFilter
    };
  }

  function getFilteredRows() {
    const f = currentFilters();
    let rows = ERP_LeaveRepository.getAllForCompany(company.id);
    if (f.employeeId) rows = rows.filter((r) => r.employeeId === f.employeeId);
    if (f.leaveType) rows = rows.filter((r) => r.leaveType === f.leaveType);
    if (f.status !== "all") rows = rows.filter((r) => r.status === f.status);
    return rows;
  }

  function renderPagination(totalPages) {
    const container = $("#lvPagination");
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

    $("#lvEmptyState").hidden = rows.length !== 0;
    $("#lvTable").hidden = rows.length === 0;

    $("#lvTableBody").innerHTML = pageRows.map((r) => {
      const actions = [];
      if (r.status === "Pending") {
        actions.push(`<button type="button" class="btn btn--ghost btn--sm" data-decide="${r.id}">Decide</button>`);
        actions.push(`<button type="button" class="btn btn--ghost btn--sm" data-cancel="${r.id}">Cancel</button>`);
      } else if (r.status === "Approved") {
        actions.push(`<button type="button" class="btn btn--ghost btn--sm" data-cancel="${r.id}">Cancel</button>`);
      }
      return `
      <tr>
        <td>${escapeHtml(employeeName(r.employeeId))}</td>
        <td>${escapeHtml(r.leaveType)}</td>
        <td>${escapeHtml(r.fromDate)}</td>
        <td>${escapeHtml(r.toDate)}</td>
        <td class="text-right">${r.numberOfDays}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${r.approverEmployeeId ? escapeHtml(employeeName(r.approverEmployeeId)) : "—"}</td>
        <td class="text-right">${actions.join(" ")}</td>
      </tr>`;
    }).join("");

    $$("#lvTableBody [data-decide]").forEach((btn) => btn.addEventListener("click", () => openDecisionModal(btn.dataset.decide)));
    $$("#lvTableBody [data-cancel]").forEach((btn) => btn.addEventListener("click", () => confirmCancel(btn.dataset.cancel)));

    renderPagination(totalPages);
    renderSummary();
  }

  function renderSummary() {
    const all = ERP_LeaveRepository.getAllForCompany(company.id);
    const today = todayISO();
    $("#lvSummaryPending").textContent = String(all.filter((r) => r.status === "Pending").length);
    $("#lvSummaryApproved").textContent = String(all.filter((r) => r.status === "Approved").length);
    $("#lvSummaryOnLeaveToday").textContent = String(all.filter((r) => r.status === "Approved" && r.fromDate <= today && r.toDate >= today).length);
  }

  /* -----------------------------------------------------------------------
     APPLY FOR LEAVE MODAL
     --------------------------------------------------------------------- */
  function populateStaticDropdowns() {
    const employees = activeEmployees().sort((a, b) => a.fullName.localeCompare(b.fullName));
    const empOptions = employees.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)} (${escapeHtml(e.employeeCode)})</option>`).join("");
    $("#lvFormEmployee").innerHTML = empOptions;
    $("#lvEmployeeFilter").insertAdjacentHTML("beforeend", empOptions);

    const typeOptions = ERP_LeaveRepository.leaveTypes.map((t) => `<option value="${t}">${t}</option>`).join("");
    $("#lvFormType").innerHTML = typeOptions;
    $("#lvTypeFilter").insertAdjacentHTML("beforeend", typeOptions);
  }

  function updateFormNotes() {
    const employeeId = $("#lvFormEmployee").value;
    const leaveType = $("#lvFormType").value;
    const fromDate = $("#lvFormFrom").value;
    const toDate = $("#lvFormTo").value;

    // Balance note
    const year = fromDate ? Number(fromDate.slice(0, 4)) : new Date().getFullYear();
    const balance = employeeId && leaveType ? ERP_LeaveRepository.getLeaveBalance(company.id, employeeId, leaveType, year) : null;
    $("#lvFormBalanceNote").textContent = balance
      ? `${balance.remaining} of ${balance.entitlement} day(s) remaining for ${year}.`
      : (leaveType === "Unpaid Leave" ? "Unpaid Leave has no balance — it always reduces pay." : "");

    // Days note
    if (fromDate && toDate && toDate >= fromDate) {
      const days = ERP_LeaveRepository.computeNumberOfDays(fromDate, toDate);
      $("#lvFormDaysNote").textContent = `${days} calendar day(s).`;
      $("#lvFormDateError").textContent = "";
    } else if (fromDate && toDate) {
      $("#lvFormDaysNote").textContent = "";
      $("#lvFormDateError").textContent = "\"To\" must be on or after \"From\".";
    } else {
      $("#lvFormDaysNote").textContent = "";
    }

    // Approver note
    const emp = employeeId ? ERP_EmployeeRepository.findById(employeeId) : null;
    if (emp && emp.managerId) {
      $("#lvFormApproverNote").textContent = `Routes to ${employeeName(emp.managerId)} for approval.`;
    } else if (emp) {
      $("#lvFormApproverNote").textContent = "This employee has no manager on file — the application will still be created, with no approver recorded.";
    } else {
      $("#lvFormApproverNote").textContent = "";
    }
  }

  function openApplyModal() {
    $("#lvFormEmployee").value = $("#lvFormEmployee").options[0] ? $("#lvFormEmployee").options[0].value : "";
    $("#lvFormType").value = "Casual Leave";
    $("#lvFormFrom").value = "";
    $("#lvFormTo").value = "";
    $("#lvFormReason").value = "";
    $("#lvFormEmployeeError").textContent = "";
    $("#lvFormDateError").textContent = "";
    updateFormNotes();
    openModal("leaveFormModal");
  }

  function saveApplyForm() {
    const employeeId = $("#lvFormEmployee").value;
    const leaveType = $("#lvFormType").value;
    const fromDate = $("#lvFormFrom").value;
    const toDate = $("#lvFormTo").value;
    const reason = $("#lvFormReason").value.trim();

    let valid = true;
    if (!employeeId) { $("#lvFormEmployeeError").textContent = "Choose an employee."; valid = false; } else { $("#lvFormEmployeeError").textContent = ""; }
    if (!fromDate || !toDate || toDate < fromDate) { $("#lvFormDateError").textContent = "Choose a valid date range."; valid = false; }
    if (!valid) return;

    if (ERP_LeaveRepository.hasOverlap(company.id, employeeId, fromDate, toDate)) {
      $("#lvFormDateError").textContent = `${employeeName(employeeId)} already has a Pending or Approved application overlapping these dates.`;
      return;
    }

    const record = ERP_LeaveRepository.create(company, { employeeId, leaveType, fromDate, toDate, reason, appliedByUsername: actorLabel(session.username) });
    if (!record) { showToast("Could not create the application — overlapping dates.", "danger"); return; }

    logSystemActivity({ module: "Leave", action: "Apply", description: `${employeeName(employeeId)} applied for ${leaveType} (${record.numberOfDays} day(s)) for ${company.name}` });
    closeModal("leaveFormModal");
    showToast(`Leave application submitted for ${employeeName(employeeId)}.`, "success");
    renderTable();
  }

  /* -----------------------------------------------------------------------
     DECISION MODAL (Approve / Reject)
     --------------------------------------------------------------------- */
  function openDecisionModal(id) {
    const app = ERP_LeaveRepository.findById(id);
    if (!app) return;
    decidingId = id;
    $("#lvDecisionSummary").textContent = `${employeeName(app.employeeId)} — ${app.leaveType}, ${app.fromDate} to ${app.toDate} (${app.numberOfDays} day(s)).`;
    $("#lvDecisionNotes").value = "";
    $("#lvDecisionNotesError").textContent = "";
    openModal("leaveDecisionModal");
  }

  function decide(outcome) {
    const notes = $("#lvDecisionNotes").value.trim();
    if (outcome === "reject" && !notes) {
      $("#lvDecisionNotesError").textContent = "A short reason is required when rejecting.";
      return;
    }
    $("#lvDecisionNotesError").textContent = "";

    const app = ERP_LeaveRepository.findById(decidingId);
    if (outcome === "approve") ERP_LeaveRepository.approve(decidingId, actorLabel(session.username), notes);
    else ERP_LeaveRepository.reject(decidingId, actorLabel(session.username), notes);

    logSystemActivity({ module: "Leave", action: outcome === "approve" ? "Approve" : "Reject", description: `${outcome === "approve" ? "Approved" : "Rejected"} ${employeeName(app.employeeId)}'s ${app.leaveType} application` });
    closeModal("leaveDecisionModal");
    showToast(`Application ${outcome === "approve" ? "approved" : "rejected"}.`, outcome === "approve" ? "success" : "info");
    renderTable();
  }

  function confirmCancel(id) {
    const app = ERP_LeaveRepository.findById(id);
    if (!app) return;
    openConfirm({
      title: "Cancel leave application?",
      message: `${employeeName(app.employeeId)}'s ${app.leaveType} application (${app.fromDate} to ${app.toDate}) will be cancelled.`,
      confirmLabel: "Cancel Application",
      onConfirm: () => {
        ERP_LeaveRepository.cancel(id, actorLabel(session.username));
        logSystemActivity({ module: "Leave", action: "Cancel", description: `Cancelled ${employeeName(app.employeeId)}'s ${app.leaveType} application`, severity: "warning" });
        showToast("Leave application cancelled.", "info");
        renderTable();
      }
    });
  }

  /* -----------------------------------------------------------------------
     CSV EXPORT
     --------------------------------------------------------------------- */
  function exportCsv() {
    const rows = getFilteredRows();
    if (!rows.length) { showToast("Nothing to export — no applications match the current filters.", "warning"); return; }
    const lines = [["Employee", "Type", "From", "To", "Days", "Status", "Approver", "Reason", "Decision Notes"].join(",")];
    rows.forEach((r) => {
      lines.push([
        `"${employeeName(r.employeeId).replace(/"/g, '""')}"`, r.leaveType, r.fromDate, r.toDate, r.numberOfDays, r.status,
        r.approverEmployeeId ? `"${employeeName(r.approverEmployeeId).replace(/"/g, '""')}"` : "",
        `"${(r.reason || "").replace(/"/g, '""')}"`, `"${(r.decisionNotes || "").replace(/"/g, '""')}"`
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leave-applications-${company.companyCode}.csv`;
    link.click();
  }

  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "leave")) return;

    runBootSequence([
      { p: 40, t: "Loading employees…" },
      { p: 80, t: "Loading leave applications…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#lvContent").hidden = true;
      $("#lvSubtitle").textContent = "No active company yet.";
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    if (!activeEmployees().length) {
      $("#noCompanyState").hidden = true;
      $("#noEmployeesState").hidden = false;
      $("#lvContent").hidden = true;
      $("#lvSubtitle").textContent = `No employees yet for ${company.name} (${company.companyCode}).`;
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    $("#noCompanyState").hidden = true;
    $("#noEmployeesState").hidden = true;
    $("#lvContent").hidden = false;
    $("#lvHeaderActions").hidden = false;
    $("#lvSubtitle").textContent = `Leave applications for ${company.name} (${company.companyCode}).`;

    populateStaticDropdowns();

    $("#lvEmployeeFilter").addEventListener("change", () => { page = 1; renderTable(); });
    $("#lvTypeFilter").addEventListener("change", () => { page = 1; renderTable(); });
    $$("#lvStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#lvStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        statusFilter = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#lvAddBtn").addEventListener("click", openApplyModal);
    $("#lvFormSaveBtn").addEventListener("click", saveApplyForm);
    ["#lvFormEmployee", "#lvFormType", "#lvFormFrom", "#lvFormTo"].forEach((sel) => $(sel).addEventListener("change", updateFormNotes));

    $("#lvApproveBtn").addEventListener("click", () => decide("approve"));
    $("#lvRejectBtn").addEventListener("click", () => decide("reject"));

    $("#lvExportCsvBtn").addEventListener("click", exportCsv);

    renderTable();
    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
