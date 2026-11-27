/* =============================================================================
   DOT ERP — pages/time-tracking.js
   Phase 18, Module 02: Time Tracking

   List + form + detail, the same shape Project's own page uses.
   Lifecycle buttons in the detail modal are built from the entry's own
   status directly (Draft -> Submit/Delete, Submitted -> Approve/Reject/
   Cancel, Rejected -> Resubmit for Correction, Approved -> nothing
   further) rather than a generic getValidNextStatuses() list, because
   unlike Project's own linear-ish transitions, Approve/Reject are two
   DIFFERENT actions off the same Submitted state, not two items in one
   list a trainee picks from.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity, actorLabel
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let filterStatus = "all";
  let searchTerm = "";
  let page = 1;
  let editingId = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function employeeLabel(id) { const e = id && typeof ERP_EmployeeRepository !== "undefined" ? ERP_EmployeeRepository.findById(id) : null; return e ? e.fullName : "Unknown"; }
  function projectLabel(id) { const p = id ? ERP_ProjectRepository.findById(id) : null; return p ? `${p.projectCode} — ${p.projectName}` : "Unknown project"; }

  function statusBadge(status) {
    const tone = { "Draft": "warning", "Submitted": "info", "Approved": "success", "Rejected": "danger", "Cancelled": "neutral" }[status] || "neutral";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY / LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_TimeTrackingRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((t) => t.status === filterStatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((t) =>
        employeeLabel(t.employeeId).toLowerCase().includes(q) ||
        projectLabel(t.projectId).toLowerCase().includes(q) ||
        (t.taskDescription || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }

  function renderSummary() {
    const all = ERP_TimeTrackingRepository.getAllForCompany(company.id);
    $("#ttSummaryTotal").textContent = String(all.length);
    $("#ttSummarySubmitted").textContent = String(all.filter((t) => t.status === "Submitted").length);
    $("#ttSummaryApproved").textContent = String(all.filter((t) => t.status === "Approved").length);
    const approvedHours = all.filter((t) => t.status === "Approved").reduce((s, t) => s + (Number(t.hoursWorked) || 0), 0);
    $("#ttSummaryApprovedHours").textContent = approvedHours.toLocaleString("en-IN", { maximumFractionDigits: 1 });
  }

  function renderPagination(totalPages) {
    const container = $("#ttPagination");
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

    $("#ttEmptyState").hidden = all.length !== 0;
    $("#ttTable").hidden = all.length === 0;

    $("#ttTableBody").innerHTML = pageItems.map((t) => `
      <tr>
        <td>${t.workDate || "—"}</td>
        <td>${escapeHtml(employeeLabel(t.employeeId))}</td>
        <td>${escapeHtml(projectLabel(t.projectId))}</td>
        <td class="text-right">${t.hoursWorked}</td>
        <td>${t.isBillable ? "<span class=\"status-badge status-badge--info\">Billable</span>" : "<span class=\"status-badge status-badge--neutral\">Non-billable</span>"}</td>
        <td>${statusBadge(t.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${t.id}">View</button></td>
      </tr>`).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#ttStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#ttStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value.trim();
      page = 1;
      renderTable();
    });
    $("#ttExportCsvBtn").addEventListener("click", exportCsv);
    $("#ttPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Date", "Employee", "Project", "Hours", "Billable", "Task", "Status"];
    const lines = [header.join(",")];
    rows.forEach((t) => {
      lines.push([
        t.workDate, `"${employeeLabel(t.employeeId)}"`, `"${projectLabel(t.projectId)}"`,
        t.hoursWorked, t.isBillable ? "Yes" : "No", `"${(t.taskDescription || "").replace(/"/g, '""')}"`, t.status
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `time-entries-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Time Tracking")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#ttActivityEmptyState").hidden = relevant.length !== 0;
    $("#ttActivityList").innerHTML = relevant.map((e) => `
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
     FORM MODAL
     --------------------------------------------------------------------- */
  function populateEmployeeOptions(selectedId) {
    const employees = typeof ERP_EmployeeRepository !== "undefined" ? ERP_EmployeeRepository.getAllForCompany(company.id) : [];
    $("#ttFormEmployee").innerHTML =
      `<option value="">Select…</option>` +
      employees.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)}</option>`).join("");
    if (selectedId) $("#ttFormEmployee").value = selectedId;
  }

  function populateProjectOptions(selectedId) {
    const projects = ERP_ProjectRepository.getActiveForCompany(company.id);
    const options = projects.map((p) => `<option value="${p.id}">${escapeHtml(p.projectCode)} — ${escapeHtml(p.projectName)}</option>`);
    if (selectedId && !projects.some((p) => p.id === selectedId)) {
      const p = ERP_ProjectRepository.findById(selectedId);
      if (p) options.unshift(`<option value="${p.id}">${escapeHtml(p.projectCode)} — ${escapeHtml(p.projectName)}</option>`);
    }
    $("#ttFormProject").innerHTML = `<option value="">Select…</option>` + options.join("");
    if (selectedId) $("#ttFormProject").value = selectedId;
  }

  function openAddModal() {
    editingId = null;
    if (!ERP_ProjectRepository.getActiveForCompany(company.id).length) {
      showToast("No Active or On Hold project to log time against yet.", "warning");
      return;
    }
    $("#ttFormTitle").textContent = "New time entry";
    $("#ttFormSaveBtn").textContent = "Save as Draft";
    populateEmployeeOptions(null);
    populateProjectOptions(null);
    $("#ttFormDate").value = new Date().toISOString().slice(0, 10);
    $("#ttFormHours").value = "";
    $("#ttFormBillable").checked = true;
    $("#ttFormTask").value = "";
    $("#ttFormError").textContent = "";
    openModal("ttFormModal");
  }

  function openEditModal(entry) {
    editingId = entry.id;
    $("#ttFormTitle").textContent = "Edit time entry";
    $("#ttFormSaveBtn").textContent = "Save Changes";
    populateEmployeeOptions(entry.employeeId);
    populateProjectOptions(entry.projectId);
    $("#ttFormDate").value = entry.workDate || "";
    $("#ttFormHours").value = String(entry.hoursWorked || "");
    $("#ttFormBillable").checked = !!entry.isBillable;
    $("#ttFormTask").value = entry.taskDescription || "";
    $("#ttFormError").textContent = "";
    closeModal("ttDetailModal");
    openModal("ttFormModal");
  }

  function collectFormPayload() {
    return {
      employeeId: $("#ttFormEmployee").value || null,
      projectId: $("#ttFormProject").value || null,
      workDate: $("#ttFormDate").value || null,
      hoursWorked: Number($("#ttFormHours").value) || 0,
      isBillable: $("#ttFormBillable").checked,
      taskDescription: $("#ttFormTask").value.trim()
    };
  }

  function bindFormModal() {
    $("#ttAddBtn").addEventListener("click", openAddModal);
    $("#ttFormSaveBtn").addEventListener("click", () => {
      const payload = collectFormPayload();
      const check = ERP_TimeTrackingRepository.validateEntry(payload);
      $("#ttFormError").textContent = check.ok ? "" : check.errors[0];
      if (!check.ok) return;

      if (editingId) {
        const updated = ERP_TimeTrackingRepository.update(editingId, payload);
        if (!updated) { showToast("Couldn't save — only a Draft entry can be edited.", "danger"); return; }
        logSystemActivity({ module: "Time Tracking", action: "Update", description: `Updated time entry for ${employeeLabel(updated.employeeId)} on ${updated.workDate} (${company.name})` });
        showToast("Time entry updated.", "success");
      } else {
        const created = ERP_TimeTrackingRepository.create(company, payload, session.username);
        logSystemActivity({ module: "Time Tracking", action: "Create", description: `Logged ${created.hoursWorked}h for ${employeeLabel(created.employeeId)} on ${created.workDate} against ${projectLabel(created.projectId)} (${company.name})` });
        showToast("Time entry saved as Draft — submit it for approval when ready.", "success");
      }
      closeModal("ttFormModal");
      editingId = null;
      renderAll();
      renderActivity();
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function renderDetailFooter(entry) {
    const footer = $("#ttDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (entry.status === "Draft") {
      addBtn("Submit for Approval", "btn btn--primary", () => requestSubmit(entry));
      addBtn("Edit", "btn btn--ghost", () => openEditModal(entry));
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(entry));
    } else if (entry.status === "Submitted") {
      addBtn("Approve", "btn btn--primary", () => requestApprove(entry));
      addBtn("Reject", "btn btn--danger-outline", () => requestReject(entry));
      addBtn("Cancel", "btn btn--ghost", () => requestCancel(entry));
    } else if (entry.status === "Rejected") {
      addBtn("Resubmit for Correction", "btn btn--primary", () => requestResubmit(entry));
    }

    addBtn("Close", "btn btn--ghost", () => closeModal("ttDetailModal"));
  }

  function openDetailModal(entry) {
    const costInfo = ERP_TimeTrackingRepository.computeEntryCost(company.id, entry);

    $("#ttDetailTitle").textContent = `Time Entry — ${entry.workDate}`;
    $("#ttDetailBody").innerHTML = `
      <div><dt>Employee</dt><dd>${escapeHtml(employeeLabel(entry.employeeId))}</dd></div>
      <div><dt>Project</dt><dd>${escapeHtml(projectLabel(entry.projectId))}</dd></div>
      <div><dt>Date</dt><dd>${entry.workDate || "—"}</dd></div>
      <div><dt>Hours</dt><dd>${entry.hoursWorked}</dd></div>
      <div><dt>Billable</dt><dd>${entry.isBillable ? "Yes" : "No"}</dd></div>
      <div><dt>Task</dt><dd>${entry.taskDescription ? escapeHtml(entry.taskDescription) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Cost</dt><dd>${costInfo.hasCostRate ? formatMoney(costInfo.cost) : "<span class=\"profile-subtle\">No salary structure on file for this date</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(entry.status)}</dd></div>
      ${entry.status !== "Draft" && entry.submittedAt ? `<div><dt>Submitted</dt><dd>${formatDateTime(new Date(entry.submittedAt))}</dd></div>` : ""}
      ${entry.approverEmployeeId ? `<div><dt>Approver</dt><dd>${escapeHtml(employeeLabel(entry.approverEmployeeId))}</dd></div>` : (entry.status === "Submitted" || entry.status === "Approved" || entry.status === "Rejected" ? `<div><dt>Approver</dt><dd><span class="profile-subtle">No manager on file</span></dd></div>` : "")}
      ${entry.decidedAt ? `<div><dt>Decided</dt><dd>${formatDateTime(new Date(entry.decidedAt))} by ${escapeHtml(actorLabel(entry.decidedByUsername))}</dd></div>` : ""}
      ${entry.status === "Rejected" && entry.rejectionReason ? `<div><dt>Rejection Reason</dt><dd>${escapeHtml(entry.rejectionReason)}</dd></div>` : ""}
      ${entry.status === "Cancelled" ? `<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(entry.cancelledAt))} by ${escapeHtml(actorLabel(entry.cancelledByUsername))}</dd></div>` : ""}
    `;

    renderDetailFooter(entry);
    openModal("ttDetailModal");
  }

  function requestSubmit(entry) {
    openConfirm({
      title: "Submit this time entry for approval?",
      message: "The approver is set from this employee's own manager at the moment of submission. Once submitted, this entry can no longer be edited directly.",
      confirmLabel: "Submit",
      onConfirm: () => {
        const result = ERP_TimeTrackingRepository.submit(entry.id, session.username);
        if (!result.success) { showToast(result.reason, "danger"); return; }
        logSystemActivity({ module: "Time Tracking", action: "Submit", description: `Submitted time entry for ${employeeLabel(result.record.employeeId)} on ${result.record.workDate} (${company.name})` });
        closeModal("ttDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function requestApprove(entry) {
    openConfirm({
      title: "Approve this time entry?",
      message: "Approving makes this entry's own hours and cost count toward the project's real actuals.",
      confirmLabel: "Approve",
      onConfirm: () => {
        const result = ERP_TimeTrackingRepository.approve(entry.id, session.username);
        if (!result.success) { showToast(result.reason, "danger"); return; }
        logSystemActivity({ module: "Time Tracking", action: "Approve", description: `Approved time entry for ${employeeLabel(result.record.employeeId)} on ${result.record.workDate} (${company.name})` });
        closeModal("ttDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function requestReject(entry) {
    const reason = window.prompt("Reason for rejecting this entry (shown to the employee):", "");
    if (reason === null) return;
    const result = ERP_TimeTrackingRepository.reject(entry.id, reason.trim(), session.username);
    if (!result.success) { showToast(result.reason, "danger"); return; }
    logSystemActivity({ module: "Time Tracking", action: "Reject", description: `Rejected time entry for ${employeeLabel(result.record.employeeId)} on ${result.record.workDate} (${company.name})` });
    closeModal("ttDetailModal");
    renderAll();
    renderActivity();
  }

  function requestResubmit(entry) {
    const result = ERP_TimeTrackingRepository.resubmitForCorrection(entry.id);
    if (!result.success) { showToast(result.reason, "danger"); return; }
    logSystemActivity({ module: "Time Tracking", action: "Resubmit", description: `Sent time entry for ${employeeLabel(result.record.employeeId)} on ${result.record.workDate} back to Draft for correction (${company.name})` });
    closeModal("ttDetailModal");
    renderAll();
    renderActivity();
    showToast("Back in Draft — edit and resubmit when ready.", "success");
  }

  function requestCancel(entry) {
    openConfirm({
      title: "Cancel this time entry?",
      message: "This entry hasn't been approved, so nothing else depends on it — cancelling is safe.",
      confirmLabel: "Cancel Entry",
      onConfirm: () => {
        const result = ERP_TimeTrackingRepository.cancel(entry.id, session.username);
        if (!result.success) { showToast(result.reason, "danger"); return; }
        logSystemActivity({ module: "Time Tracking", action: "Cancel", description: `Cancelled time entry for ${employeeLabel(result.record.employeeId)} on ${result.record.workDate} (${company.name})` });
        closeModal("ttDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function requestDelete(entry) {
    openConfirm({
      title: "Delete this time entry?",
      message: "This Draft entry hasn't been submitted, so deleting it is safe.",
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_TimeTrackingRepository.remove(entry.id);
        logSystemActivity({ module: "Time Tracking", action: "Delete", description: `Deleted time entry for ${employeeLabel(entry.employeeId)} on ${entry.workDate} (${company.name})` });
        closeModal("ttDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#ttTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const entry = ERP_TimeTrackingRepository.findById(viewBtn.dataset.id);
      if (entry) openDetailModal(entry);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "time-tracking")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading time entries…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#ttContent").hidden = true;
      $("#ttSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#ttContent").hidden = false;
      $("#ttHeaderActions").hidden = false;
      $("#ttSubtitle").textContent = `Logging time for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
