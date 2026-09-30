/* =============================================================================
   DOT ERP — pages/project.js
   Phase 18, Module 01: Project Master

   List + form + detail, the same shape every master-data module in
   this project uses. Status changes go through a dedicated action in
   the detail modal (buttons built from getValidNextStatuses(), never a
   free-form dropdown), the same "the UI can't offer what the
   repository would refuse" discipline the Phase 15/16 lifecycle
   documents already established.
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
  function customerLabel(id) { const c = id && typeof ERP_CustomerRepository !== "undefined" ? ERP_CustomerRepository.findById(id) : null; return c ? c.customerName : null; }
  function employeeLabel(id) { const e = id && typeof ERP_EmployeeRepository !== "undefined" ? ERP_EmployeeRepository.findById(id) : null; return e ? e.fullName : "Unassigned"; }
  function costCenterLabel(id) { const c = id && typeof ERP_CostCenterRepository !== "undefined" ? ERP_CostCenterRepository.findById(id) : null; return c ? c.ccName : null; }

  function statusBadge(status) {
    const tone = { "Planning": "warning", "Active": "success", "On Hold": "warning", "Completed": "neutral", "Cancelled": "danger" }[status] || "neutral";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY / LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_ProjectRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((p) => p.status === filterStatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((p) =>
        (p.projectCode || "").toLowerCase().includes(q) ||
        (p.projectName || "").toLowerCase().includes(q) ||
        (customerLabel(p.customerId) || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }

  function renderSummary() {
    const all = ERP_ProjectRepository.getAllForCompany(company.id);
    $("#pjSummaryTotal").textContent = String(all.length);
    $("#pjSummaryActive").textContent = String(all.filter((p) => p.status === "Active").length);
    $("#pjSummaryOnHold").textContent = String(all.filter((p) => p.status === "On Hold").length);
    $("#pjSummaryOverBudget").textContent = String(all.filter((p) => ERP_ProjectRepository.getUtilizationBand(p) === "over").length);
  }

  function renderPagination(totalPages) {
    const container = $("#pjPagination");
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

    $("#pjEmptyState").hidden = all.length !== 0;
    $("#pjTable").hidden = all.length === 0;

    $("#pjTableBody").innerHTML = pageItems.map((p) => {
      const band = ERP_ProjectRepository.getUtilizationBand(p);
      const bandBadge = p.budgetAmount > 0 || p.actualCost > 0
        ? `<span class="status-badge status-badge--${band === "over" ? "danger" : band === "near" ? "warning" : "success"}">${band}</span>`
        : "<span class=\"profile-subtle\">—</span>";
      return `
      <tr>
        <td><code>${escapeHtml(p.projectCode)}</code></td>
        <td>${escapeHtml(p.projectName)}</td>
        <td>${customerLabel(p.customerId) ? escapeHtml(customerLabel(p.customerId)) : "<span class=\"profile-subtle\">Internal</span>"}</td>
        <td>${escapeHtml(employeeLabel(p.projectManagerId))}</td>
        <td class="text-right">${formatMoney(p.budgetAmount)}</td>
        <td>${bandBadge}</td>
        <td>${statusBadge(p.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${p.id}">View</button></td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#pjStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#pjStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
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
    $("#pjExportCsvBtn").addEventListener("click", exportCsv);
    $("#pjPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Project Code", "Name", "Customer", "Project Manager", "Billing Type", "Start Date", "End Date", "Budget", "Actual Cost", "Status"];
    const lines = [header.join(",")];
    rows.forEach((p) => {
      lines.push([
        p.projectCode, `"${p.projectName}"`, `"${customerLabel(p.customerId) || "Internal"}"`,
        `"${employeeLabel(p.projectManagerId)}"`, p.billingType, p.startDate || "", p.endDate || "",
        p.budgetAmount, p.actualCost, p.status
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `projects-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Project")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#pjActivityEmptyState").hidden = relevant.length !== 0;
    $("#pjActivityList").innerHTML = relevant.map((e) => `
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
  function populateCustomerOptions(selectedId) {
    const customers = typeof ERP_CustomerRepository !== "undefined" ? ERP_CustomerRepository.getAllForCompany(company.id) : [];
    $("#pjFormCustomer").innerHTML =
      `<option value="">Internal project (no customer)</option>` +
      customers.map((c) => `<option value="${c.id}">${escapeHtml(c.customerName)}</option>`).join("");
    if (selectedId) $("#pjFormCustomer").value = selectedId;
  }

  function populateCostCenterOptions(selectedId) {
    const centers = typeof ERP_CostCenterRepository !== "undefined" ? ERP_CostCenterRepository.getAllForCompany(company.id).filter((c) => c.status === "Active") : [];
    $("#pjFormCostCenter").innerHTML =
      `<option value="">Not linked</option>` +
      centers.map((c) => `<option value="${c.id}">${escapeHtml(c.ccName)}</option>`).join("");
    if (selectedId) $("#pjFormCostCenter").value = selectedId;
  }

  function populateManagerOptions(selectedId) {
    const employees = typeof ERP_EmployeeRepository !== "undefined" ? ERP_EmployeeRepository.getAllForCompany(company.id) : [];
    $("#pjFormManager").innerHTML =
      `<option value="">Unassigned</option>` +
      employees.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)}</option>`).join("");
    if (selectedId) $("#pjFormManager").value = selectedId;
  }

  function populateBillingTypeOptions(selected) {
    $("#pjFormBillingType").innerHTML = ERP_ProjectRepository.billingTypes
      .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
    if (selected) $("#pjFormBillingType").value = selected;
  }

  function openAddModal() {
    editingId = null;
    $("#pjFormTitle").textContent = "New project";
    $("#pjFormSaveBtn").textContent = "Create Project";
    $("#pjFormName").value = "";
    populateCustomerOptions(null);
    populateCostCenterOptions(null);
    populateManagerOptions(null);
    populateBillingTypeOptions(null);
    $("#pjFormStartDate").value = new Date().toISOString().slice(0, 10);
    $("#pjFormEndDate").value = "";
    $("#pjFormBudget").value = "0";
    $("#pjFormDescription").value = "";
    $("#pjFormNameError").textContent = "";
    openModal("pjFormModal");
  }

  function openEditModal(project) {
    editingId = project.id;
    $("#pjFormTitle").textContent = `Edit project — ${project.projectCode}`;
    $("#pjFormSaveBtn").textContent = "Save Changes";
    $("#pjFormName").value = project.projectName;
    populateCustomerOptions(project.customerId);
    populateCostCenterOptions(project.costCenterId);
    populateManagerOptions(project.projectManagerId);
    populateBillingTypeOptions(project.billingType);
    $("#pjFormStartDate").value = project.startDate || "";
    $("#pjFormEndDate").value = project.endDate || "";
    $("#pjFormBudget").value = String(project.budgetAmount || 0);
    $("#pjFormDescription").value = project.description || "";
    $("#pjFormNameError").textContent = "";
    closeModal("pjDetailModal");
    openModal("pjFormModal");
  }

  function validateForm() {
    let valid = true;
    $("#pjFormNameError").textContent = "";
    const name = $("#pjFormName").value.trim();
    if (!name) {
      $("#pjFormNameError").textContent = "Project name is required.";
      valid = false;
    } else if (ERP_ProjectRepository.hasDuplicateName(company.id, name, editingId)) {
      $("#pjFormNameError").textContent = "A project with this name already exists.";
      valid = false;
    }
    return valid;
  }

  function bindFormModal() {
    $("#pjAddBtn").addEventListener("click", openAddModal);
    $("#pjFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const payload = {
        projectName: $("#pjFormName").value.trim(),
        customerId: $("#pjFormCustomer").value || null,
        costCenterId: $("#pjFormCostCenter").value || null,
        projectManagerId: $("#pjFormManager").value || null,
        billingType: $("#pjFormBillingType").value,
        startDate: $("#pjFormStartDate").value || null,
        endDate: $("#pjFormEndDate").value || null,
        budgetAmount: Number($("#pjFormBudget").value) || 0,
        description: $("#pjFormDescription").value.trim()
      };
      if (editingId) {
        const updated = ERP_ProjectRepository.update(editingId, payload);
        if (!updated) { showToast("Couldn't save — this project can no longer be edited.", "danger"); return; }
        logSystemActivity({ module: "Project", action: "Update", description: `Updated project "${updated.projectName}" (${company.name})` });
        showToast("Project updated.", "success");
      } else {
        const created = ERP_ProjectRepository.create(company, payload, session.username);
        logSystemActivity({ module: "Project", action: "Create", description: `Created project "${created.projectName}" (${company.name})` });
        showToast("Project created.", "success");
      }
      closeModal("pjFormModal");
      editingId = null;
      renderAll();
      renderActivity();
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + STATUS ACTIONS
     --------------------------------------------------------------------- */
  function renderDetailFooter(project) {
    const footer = $("#pjDetailFooter");
    footer.innerHTML = "";

    ERP_ProjectRepository.getValidNextStatuses(project).forEach((nextStatus) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = nextStatus === "Cancelled" ? "btn btn--danger-outline" : "btn btn--primary";
      btn.textContent = nextStatus === "On Hold" ? "Put On Hold" : (nextStatus === "Active" && project.status === "On Hold") ? "Resume" : `Mark ${nextStatus}`;
      btn.addEventListener("click", () => requestStatusChange(project, nextStatus));
      footer.appendChild(btn);
    });

    if (ERP_ProjectRepository.canEdit(project)) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn--ghost";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openEditModal(project));
      footer.appendChild(editBtn);
    }

    if (ERP_ProjectRepository.canDelete(project)) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn--danger-outline";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => requestDelete(project));
      footer.appendChild(delBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn btn--ghost";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => closeModal("pjDetailModal"));
    footer.appendChild(closeBtn);
  }

  function openDetailModal(project) {
    const variance = ERP_ProjectRepository.getVariance(project);
    const band = ERP_ProjectRepository.getUtilizationBand(project);

    $("#pjDetailTitle").textContent = `${project.projectCode} — ${project.projectName}`;
    $("#pjDetailBody").innerHTML = `
      <div><dt>Project Code</dt><dd><code>${escapeHtml(project.projectCode)}</code></dd></div>
      <div><dt>Name</dt><dd>${escapeHtml(project.projectName)}</dd></div>
      <div><dt>Customer</dt><dd>${customerLabel(project.customerId) ? escapeHtml(customerLabel(project.customerId)) : "<span class=\"profile-subtle\">Internal project</span>"}</dd></div>
      <div><dt>Cost Center</dt><dd>${costCenterLabel(project.costCenterId) ? escapeHtml(costCenterLabel(project.costCenterId)) : "<span class=\"profile-subtle\">Not linked</span>"}</dd></div>
      <div><dt>Project Manager</dt><dd>${escapeHtml(employeeLabel(project.projectManagerId))}</dd></div>
      <div><dt>Billing Type</dt><dd>${escapeHtml(project.billingType)}</dd></div>
      <div><dt>Start Date</dt><dd>${project.startDate || "—"}</dd></div>
      <div><dt>End Date</dt><dd>${project.endDate || "<span class=\"profile-subtle\">Ongoing</span>"}</dd></div>
      <div><dt>Budget</dt><dd>${formatMoney(variance.budget)}</dd></div>
      <div><dt>Actual Cost</dt><dd>${formatMoney(variance.actual)} <span class="status-badge status-badge--${band === "over" ? "danger" : band === "near" ? "warning" : "success"}">${band}</span></dd></div>
      <div><dt>Variance</dt><dd>${formatMoney(variance.variance)}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(project.status)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(project.createdAt))} by ${escapeHtml(actorLabel(project.createdByUsername))}</dd></div>
      ${project.status === "Completed" ? `<div><dt>Completed</dt><dd>${formatDateTime(new Date(project.completedAt))} by ${escapeHtml(actorLabel(project.completedByUsername))}</dd></div>` : ""}
      ${project.status === "Cancelled" ? `<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(project.cancelledAt))} by ${escapeHtml(actorLabel(project.cancelledByUsername))}</dd></div>` : ""}
      <div><dt>Description</dt><dd>${project.description ? escapeHtml(project.description) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
    `;

    // RETROFIT (Phase 18, Module 02): Time Tracking's own rollup is
    // LIVE-COMPUTED, never written back onto this project record — see
    // that file's own header for why. Shown here as an additional row
    // rather than folded into the stored Budget/Actual Cost figures
    // above, which stay exactly what Module 01 left them (a manual,
    // non-labor figure this file never overwrites).
    if (typeof ERP_TimeTrackingRepository !== "undefined") {
      const labor = ERP_TimeTrackingRepository.getActualCostForProject(company.id, project.id);
      if (labor.entryCount > 0) {
        const estimateNote = labor.pctHoursWithoutRate > 0 ? ` (${labor.pctHoursWithoutRate}% of hours have no salary structure on file, so cost is understated)` : "";
        $("#pjDetailBody").insertAdjacentHTML("beforeend",
          `<div><dt>Logged Labor (Approved)</dt><dd>${labor.totalHours}h across ${labor.entryCount} entr${labor.entryCount === 1 ? "y" : "ies"} — ${formatMoney(labor.totalCost)}${escapeHtml(estimateNote)}</dd></div>`
        );
      }
    }

    renderDetailFooter(project);
    openModal("pjDetailModal");
  }

  function requestStatusChange(project, nextStatus) {
    const messages = {
      "Active": project.status === "On Hold" ? "This resumes the project — it becomes available again for time logging and billing." : "This moves the project from Planning into active work.",
      "On Hold": "This pauses the project. It can be resumed later.",
      "Completed": "This marks the project as finished. Completed projects can't be edited or reopened.",
      "Cancelled": "This cancels the project. Cancelled projects can't be edited or reopened."
    };
    openConfirm({
      title: `Mark "${project.projectName}" as ${nextStatus}?`,
      message: messages[nextStatus] || `Move this project to ${nextStatus}?`,
      confirmLabel: nextStatus,
      onConfirm: () => {
        const result = ERP_ProjectRepository.setStatus(project.id, nextStatus, session.username);
        if (!result.success) { showToast(result.reason, "danger"); return; }
        logSystemActivity({ module: "Project", action: "Status Change", description: `Project "${project.projectName}" moved to ${nextStatus} (${company.name})` });
        closeModal("pjDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function requestDelete(project) {
    openConfirm({
      title: "Delete this project?",
      message: `"${project.projectName}" hasn't started yet, so nothing else references it — deleting it is safe.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_ProjectRepository.remove(project.id);
        logSystemActivity({ module: "Project", action: "Delete", description: `Deleted project "${project.projectName}" (${company.name})` });
        closeModal("pjDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#pjTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const project = ERP_ProjectRepository.findById(viewBtn.dataset.id);
      if (project) openDetailModal(project);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "project")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading projects…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#pjContent").hidden = true;
      $("#pjSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#pjContent").hidden = false;
      $("#pjHeaderActions").hidden = false;
      $("#pjSubtitle").textContent = `Managing projects for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
