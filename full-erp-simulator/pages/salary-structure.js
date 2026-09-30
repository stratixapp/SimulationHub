/* =============================================================================
   DOT ERP — pages/salary-structure.js
   Phase 9, Module 03: Salary Structure
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

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

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

  /** {label, tone} for a given structure record — see file header /
      training guide for the three real states beyond raw storage status:
      Current, Historical (Active but superseded), Scheduled (Active but
      not yet in effect), Cancelled. */
  function stateOf(structure) {
    if (structure.status === "Cancelled") return { label: "Cancelled", tone: "neutral" };
    const today = todayISO();
    if (structure.effectiveFrom > today) return { label: "Scheduled", tone: "info" };
    const current = ERP_SalaryStructureRepository.getEffectiveStructure(company.id, structure.employeeId, today);
    if (current && current.id === structure.id) return { label: "Current", tone: "success" };
    return { label: "Historical", tone: "neutral" };
  }

  /* -----------------------------------------------------------------------
     FILTERS + TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function getFilteredRows() {
    const employeeId = $("#ssEmployeeFilter").value;
    const currentOnly = $("#ssCurrentOnlyToggle").checked;
    let rows = ERP_SalaryStructureRepository.getAllForCompany(company.id);
    if (employeeId) rows = rows.filter((s) => s.employeeId === employeeId);
    if (currentOnly) rows = rows.filter((s) => stateOf(s).label === "Current");
    return rows;
  }

  function renderPagination(totalPages) {
    const container = $("#ssPagination");
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

    $("#ssEmptyState").hidden = rows.length !== 0;
    $("#ssTable").hidden = rows.length === 0;

    $("#ssTableBody").innerHTML = pageRows.map((s) => {
      const figs = ERP_SalaryStructureRepository.computeFigures(s);
      const state = stateOf(s);
      const cancelBtn = s.status === "Active" ? `<button type="button" class="btn btn--ghost btn--sm" data-cancel="${s.id}">Cancel</button>` : "";
      return `
      <tr>
        <td>${escapeHtml(employeeName(s.employeeId))}</td>
        <td>${escapeHtml(s.effectiveFrom)}</td>
        <td class="text-right">${formatMoney(figs.basic)}</td>
        <td class="text-right">${formatMoney(figs.grossEarnings)}</td>
        <td class="text-right">${formatMoney(figs.totalDeductions)}</td>
        <td class="text-right"><strong>${formatMoney(figs.netPay)}</strong></td>
        <td><span class="status-badge status-badge--${state.tone}">${state.label}</span></td>
        <td class="text-right">${cancelBtn}</td>
      </tr>`;
    }).join("");

    $$("#ssTableBody [data-cancel]").forEach((btn) => btn.addEventListener("click", () => confirmCancel(btn.dataset.cancel)));

    renderPagination(totalPages);
    renderSummary();
  }

  function renderSummary() {
    const employees = activeEmployees();
    const today = todayISO();
    const covered = employees.filter((e) => ERP_SalaryStructureRepository.getEffectiveStructure(company.id, e.id, today));
    const missing = employees.filter((e) => !ERP_SalaryStructureRepository.getEffectiveStructure(company.id, e.id, today));

    $("#ssSummaryCovered").textContent = String(covered.length);
    $("#ssSummaryMissing").textContent = String(missing.length);

    const totalGross = covered.reduce((sum, e) => {
      const s = ERP_SalaryStructureRepository.getEffectiveStructure(company.id, e.id, today);
      return sum + ERP_SalaryStructureRepository.computeFigures(s).grossEarnings;
    }, 0);
    $("#ssSummaryGross").textContent = formatMoney(totalGross);

    $("#ssMissingCard").hidden = missing.length === 0;
    if (missing.length) {
      $("#ssMissingList").textContent = missing.map((e) => `${e.fullName} (${e.employeeCode})`).join(", ");
    }
  }

  /* -----------------------------------------------------------------------
     NEW STRUCTURE MODAL
     --------------------------------------------------------------------- */
  function populateEmployeeSelects() {
    const employees = activeEmployees().sort((a, b) => a.fullName.localeCompare(b.fullName));
    const options = employees.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)} (${escapeHtml(e.employeeCode)})</option>`).join("");
    $("#ssFormEmployee").innerHTML = options;
    $("#ssEmployeeFilter").insertAdjacentHTML("beforeend", options);
  }

  function updatePreview() {
    const figs = ERP_SalaryStructureRepository.computeFigures({
      basic: $("#ssFormBasic").value,
      hraPercent: $("#ssFormHraPercent").value,
      specialAllowance: $("#ssFormSpecialAllowance").value,
      pfPercent: $("#ssFormPfPercent").value,
      professionalTax: $("#ssFormProfessionalTax").value,
      tds: $("#ssFormTds").value
    });
    $("#ssPreviewGross").textContent = formatMoney(figs.grossEarnings);
    $("#ssPreviewDeductions").textContent = formatMoney(figs.totalDeductions);
    $("#ssPreviewNet").textContent = formatMoney(figs.netPay);
  }

  function openNewModal() {
    $("#ssFormEmployee").value = $("#ssFormEmployee").options[0] ? $("#ssFormEmployee").options[0].value : "";
    $("#ssFormEffectiveFrom").value = todayISO();
    $("#ssFormBasic").value = "";
    $("#ssFormHraPercent").value = "40";
    $("#ssFormSpecialAllowance").value = "0";
    $("#ssFormPfPercent").value = "12";
    $("#ssFormProfessionalTax").value = "200";
    $("#ssFormTds").value = "0";
    $("#ssFormEmployeeError").textContent = "";
    $("#ssFormEffectiveFromError").textContent = "";
    updatePreview();
    openModal("structureFormModal");
  }

  function saveNewStructure() {
    const employeeId = $("#ssFormEmployee").value;
    const effectiveFrom = $("#ssFormEffectiveFrom").value;

    let valid = true;
    if (!employeeId) { $("#ssFormEmployeeError").textContent = "Choose an employee."; valid = false; } else { $("#ssFormEmployeeError").textContent = ""; }
    if (!effectiveFrom) { $("#ssFormEffectiveFromError").textContent = "Choose an effective date."; valid = false; }
    else if (ERP_SalaryStructureRepository.hasDuplicateEffectiveDate(company.id, employeeId, effectiveFrom)) {
      $("#ssFormEffectiveFromError").textContent = `${employeeName(employeeId)} already has a structure effective from this exact date.`;
      valid = false;
    } else { $("#ssFormEffectiveFromError").textContent = ""; }
    if (!valid) return;

    const record = ERP_SalaryStructureRepository.create(company, {
      employeeId, effectiveFrom,
      basic: $("#ssFormBasic").value, hraPercent: $("#ssFormHraPercent").value, specialAllowance: $("#ssFormSpecialAllowance").value,
      pfPercent: $("#ssFormPfPercent").value, professionalTax: $("#ssFormProfessionalTax").value, tds: $("#ssFormTds").value,
      createdByUsername: actorLabel(session.username)
    });
    if (!record) { showToast("Could not save — a structure already exists for that employee on that exact date.", "danger"); return; }

    logSystemActivity({ module: "Salary Structure", action: "Create", description: `New salary structure for ${employeeName(employeeId)} effective ${effectiveFrom} for ${company.name}` });
    closeModal("structureFormModal");
    showToast(`Salary structure saved for ${employeeName(employeeId)}.`, "success");
    renderTable();
  }

  function confirmCancel(id) {
    const structure = ERP_SalaryStructureRepository.findById(id);
    if (!structure) return;
    const state = stateOf(structure);
    const extraWarning = state.label === "Current" ? " This is currently their ACTIVE structure — cancelling it leaves them with no structure for Payroll to resolve unless another one already covers the date." : "";
    openConfirm({
      title: "Cancel this salary structure?",
      message: `${employeeName(structure.employeeId)}'s structure effective ${structure.effectiveFrom} will be marked Cancelled.${extraWarning}`,
      confirmLabel: "Cancel Structure",
      onConfirm: () => {
        ERP_SalaryStructureRepository.cancel(id, actorLabel(session.username));
        logSystemActivity({ module: "Salary Structure", action: "Cancel", description: `Cancelled ${employeeName(structure.employeeId)}'s structure effective ${structure.effectiveFrom}`, severity: "warning" });
        showToast("Salary structure cancelled.", "info");
        renderTable();
      }
    });
  }

  /* -----------------------------------------------------------------------
     CSV EXPORT
     --------------------------------------------------------------------- */
  function exportCsv() {
    const rows = getFilteredRows();
    if (!rows.length) { showToast("Nothing to export — no structures match the current filters.", "warning"); return; }
    const lines = [["Employee", "Effective From", "Basic", "HRA %", "Special Allowance", "Gross", "PF %", "Professional Tax", "TDS", "Total Deductions", "Net Pay", "State"].join(",")];
    rows.forEach((s) => {
      const figs = ERP_SalaryStructureRepository.computeFigures(s);
      lines.push([
        `"${employeeName(s.employeeId).replace(/"/g, '""')}"`, s.effectiveFrom, figs.basic.toFixed(2), s.hraPercent, figs.specialAllowance.toFixed(2),
        figs.grossEarnings.toFixed(2), s.pfPercent, figs.professionalTax.toFixed(2), figs.tds.toFixed(2), figs.totalDeductions.toFixed(2),
        figs.netPay.toFixed(2), stateOf(s).label
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `salary-structures-${company.companyCode}.csv`;
    link.click();
  }

  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "salary-structure")) return;

    runBootSequence([
      { p: 40, t: "Loading employees…" },
      { p: 80, t: "Loading salary structures…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#ssContent").hidden = true;
      $("#ssSubtitle").textContent = "No active company yet.";
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    if (!activeEmployees().length) {
      $("#noCompanyState").hidden = true;
      $("#noEmployeesState").hidden = false;
      $("#ssContent").hidden = true;
      $("#ssSubtitle").textContent = `No employees yet for ${company.name} (${company.companyCode}).`;
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    $("#noCompanyState").hidden = true;
    $("#noEmployeesState").hidden = true;
    $("#ssContent").hidden = false;
    $("#ssHeaderActions").hidden = false;
    $("#ssSubtitle").textContent = `Salary structures for ${company.name} (${company.companyCode}).`;

    populateEmployeeSelects();

    $("#ssEmployeeFilter").addEventListener("change", () => { page = 1; renderTable(); });
    $("#ssCurrentOnlyToggle").addEventListener("change", () => { page = 1; renderTable(); });

    $("#ssAddBtn").addEventListener("click", openNewModal);
    $("#ssFormSaveBtn").addEventListener("click", saveNewStructure);
    ["#ssFormBasic", "#ssFormHraPercent", "#ssFormSpecialAllowance", "#ssFormPfPercent", "#ssFormProfessionalTax", "#ssFormTds"].forEach((sel) => {
      $(sel).addEventListener("input", updatePreview);
    });

    $("#ssExportCsvBtn").addEventListener("click", exportCsv);

    renderTable();
    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
