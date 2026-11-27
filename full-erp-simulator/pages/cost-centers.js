/* =============================================================================
   DOT ERP — pages/cost-centers.js
   Phase 2, Module 08: Cost Centers

   Always works against the ACTIVE company. Unlike Departments (Module 7),
   this is a flat list — see data/cost-center-data.js's header for why. Each
   cost center can optionally link to a Department and/or a Branch (the same
   "store the id, look it up live" pattern used throughout Phase 2), and
   budgets/actuals are shown in the company's real base currency the same
   defensive way Departments does.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity, getPreferences
  } = window.ERP;

  const PAGE_SIZE = 6;

  let session = null;
  let company = null;
  let baseCurrency = null;
  let filterCategory = "all";
  let filterStatus = "all";
  let sortOrder = "asc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;


  /* -----------------------------------------------------------------------
     FORMATTING HELPERS
     --------------------------------------------------------------------- */
  function formatBudget(amount) {
    const n = Number(amount) || 0;
    const decimals = baseCurrency ? baseCurrency.decimalPlaces : 0;
    return `${baseCurrency ? baseCurrency.symbol : "₹"}${n.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
  }
  function formatDateOnly(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-").map(Number);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const format = getPreferences().dateFormat;
    if (format === "DD_MM_YYYY") return `${dd}/${mm}/${y}`;
    if (format === "MM_DD_YYYY") return `${mm}/${dd}/${y}`;
    return `${dd} ${months[m - 1]} ${y}`;
  }
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function formatPct(pct) {
    if (!isFinite(pct)) return "—";
    return `${Math.round(pct)}%`;
  }
  function budgetBarHtml(cc, extraClass) {
    const { utilizationPct } = ERP_CostCenterRepository.getVariance(cc);
    const band = ERP_CostCenterRepository.getUtilizationBand(cc);
    const fillClass = band === "over" ? "budget-bar__fill--over" : band === "near" ? "budget-bar__fill--near" : "";
    const widthPct = Math.min(100, isFinite(utilizationPct) ? utilizationPct : 100);
    return `<div class="budget-bar ${extraClass || ""}"><div class="budget-bar__fill ${fillClass}" style="width:${widthPct}%"></div></div>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_CostCenterRepository.getAllForCompany(company.id);

    if (filterCategory !== "all") rows = rows.filter((c) => c.category === filterCategory);
    if (filterStatus !== "all") rows = rows.filter((c) => c.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((c) =>
        c.ccName.toLowerCase().includes(term) ||
        c.ccCode.toLowerCase().includes(term) ||
        ERP_CostCenterRepository.getResponsiblePersonLabel(c).toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.ccName.localeCompare(b.ccName);
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  function renderSummary() {
    const all = ERP_CostCenterRepository.getAllForCompany(company.id);
    $("#ccSummaryTotal").textContent = String(all.length);
    const totalBudget = all.reduce((sum, c) => sum + (Number(c.annualBudget) || 0), 0);
    const totalActual = all.reduce((sum, c) => sum + (Number(c.actualSpend) || 0), 0);
    $("#ccSummaryBudget").textContent = formatBudget(totalBudget);
    $("#ccSummaryActual").textContent = formatBudget(totalActual);
    const overallPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
    $("#ccSummaryUtilization").textContent = formatPct(overallPct);
  }


  /* -----------------------------------------------------------------------
     CATEGORY CHIPS (built from the fixed reference list)
     --------------------------------------------------------------------- */
  function buildCategoryChips() {
    const container = $("#ccCategoryChips");
    const extra = ERP_CostCenterRepository.categories.map((cat) =>
      `<button type="button" class="chip" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
    ).join("");
    container.insertAdjacentHTML("beforeend", extra);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#ccPagination");
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

  const STATUS_BADGE = { Active: "success", Blocked: "warning", Inactive: "danger" };

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#ccEmptyState").hidden = all.length !== 0;
    $("#ccTable").hidden = all.length === 0;

    $("#ccTableBody").innerHTML = pageItems.map((c) => {
      const dept = c.departmentId ? ERP_DepartmentRepository.findById(c.departmentId) : null;
      const { utilizationPct } = ERP_CostCenterRepository.getVariance(c);
      const expired = ERP_CostCenterRepository.isExpired(c);
      const statusBadge = `<span class="status-badge status-badge--${STATUS_BADGE[c.status]}">${c.status}</span>${expired ? ` <span class="status-badge status-badge--danger">Expired</span>` : ""}`;

      let quickAction = "";
      if (c.status === "Active") quickAction = `<button type="button" class="link-btn" data-action="Blocked" data-id="${c.id}">Block</button>`;
      else if (c.status === "Blocked") quickAction = `<button type="button" class="link-btn" data-action="Active" data-id="${c.id}">Unblock</button>`;
      else if (c.status === "Inactive") quickAction = `<button type="button" class="link-btn" data-action="Active" data-id="${c.id}">Reactivate</button>`;

      return `
      <tr>
        <td><code>${escapeHtml(c.ccCode)}</code></td>
        <td>${escapeHtml(c.ccName)}</td>
        <td>${escapeHtml(c.category)}</td>
        <td>${dept ? escapeHtml(dept.deptName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${formatBudget(c.annualBudget)}</td>
        <td>${formatBudget(c.actualSpend)}</td>
        <td>${formatPct(utilizationPct)}${budgetBarHtml(c, "budget-bar--sm")}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${c.id}">View</button>
          ${quickAction}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     TOOLBAR: category + status chips, sort, search, export, print
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#ccCategoryChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#ccCategoryChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterCategory = chip.dataset.category;
        page = 1;
        renderTable();
      });
    });

    $$("#ccStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#ccStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#ccSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#ccSortBtn").textContent = sortOrder === "asc" ? "Name A-Z" : "Name Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#ccExportCsvBtn").addEventListener("click", exportCsv);
    $("#ccPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Category", "Department", "Branch", "Valid From", "Valid To", "Annual Budget", "Actual Spend", "Variance", "Utilization %", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((c) => {
      const dept = c.departmentId ? ERP_DepartmentRepository.findById(c.departmentId) : null;
      const branch = c.branchId ? ERP_BranchRepository.findById(c.branchId) : null;
      const { variance, utilizationPct } = ERP_CostCenterRepository.getVariance(c);
      const line = [
        c.ccCode, c.ccName, c.category, dept ? dept.deptName : "", branch ? branch.branchName : "",
        formatDateOnly(c.validFrom), c.validTo ? formatDateOnly(c.validTo) : "Ongoing",
        c.annualBudget, c.actualSpend, variance, isFinite(utilizationPct) ? Math.round(utilizationPct) : "",
        ERP_CostCenterRepository.isExpired(c) ? `${c.status} (Expired)` : c.status
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-cost-centers-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Cost centers exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((c) => {
      const { utilizationPct } = ERP_CostCenterRepository.getVariance(c);
      return `<tr><td>${escapeHtml(c.ccCode)}</td><td>${escapeHtml(c.ccName)}</td><td>${escapeHtml(c.category)}</td><td>${formatBudget(c.annualBudget)}</td><td>${formatBudget(c.actualSpend)}</td><td>${formatPct(utilizationPct)}</td><td>${c.status}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Cost Center Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Cost Center Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Budget</th><th>Actual</th><th>Utilization</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Cost Centers")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#ccActivityEmptyState").hidden = relevant.length !== 0;
    $("#ccActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT COST CENTER MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["ccFormName", "ccFormResponsibleName", "ccFormValidFrom", "ccFormValidTo", "ccFormBudget", "ccFormActual"].forEach((f) => setFormError(f, ""));
  }

  function populateCategoryOptions() {
    $("#ccFormCategory").innerHTML = ERP_CostCenterRepository.categories.map((cat) => `<option>${escapeHtml(cat)}</option>`).join("");
  }
  function populateDepartmentOptions() {
    const depts = ERP_DepartmentRepository.getAllForCompany(company.id).filter((d) => d.status === "Active");
    $("#ccFormDepartment").innerHTML = `<option value="">Not linked</option>` +
      depts.map((d) => `<option value="${d.id}">${escapeHtml(d.deptName)}</option>`).join("");
  }
  function populateBranchOptions() {
    const branches = ERP_BranchRepository.getAllForCompany(company.id).filter((b) => b.isPrimary || b.status === "Active");
    $("#ccFormBranch").innerHTML = `<option value="">Not linked</option>` +
      branches.map((b) => `<option value="${b.id}">${escapeHtml(b.branchName)}</option>`).join("");
  }

  /** RETROFIT (Phase 3, Module 1): lists Active/On Leave employees to pick
      as Responsible Person, plus a "Someone not listed" escape hatch for
      free text. If the record being edited already points at an employee
      who's since gone Inactive, that employee is appended anyway — editing
      a cost center shouldn't silently discard a valid existing assignment
      just because the picker's default filter would otherwise hide them. */
  function populateResponsibleOptions(currentEmployeeId) {
    const employees = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status !== "Inactive");
    if (currentEmployeeId && !employees.some((e) => e.id === currentEmployeeId)) {
      const current = ERP_EmployeeRepository.findById(currentEmployeeId);
      if (current) employees.push(current);
    }
    employees.sort((a, b) => a.fullName.localeCompare(b.fullName));
    const options = employees.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)} — ${escapeHtml(e.designation || "")}</option>`).join("");
    $("#ccFormResponsible").innerHTML = `<option value="">Not set</option>${options}<option value="__custom__">Someone not listed (type a name)</option>`;
  }
  function refreshResponsibleNameVisibility() {
    $("#ccFormResponsibleNameRow").hidden = $("#ccFormResponsible").value !== "__custom__";
  }

  function openAddModal() {
    editingId = null;
    $("#ccFormTitle").textContent = "Add cost center";
    $("#ccFormIntro").textContent = "Add a cost center — a specific place money gets spent, separate from (but optionally linked to) a Department.";
    $("#ccFormSaveBtn").textContent = "Add Cost Center";
    $("#ccFormName").value = "";
    populateCategoryOptions();
    populateDepartmentOptions();
    $("#ccFormDepartment").value = "";
    populateBranchOptions();
    $("#ccFormBranch").value = "";
    populateResponsibleOptions(null);
    $("#ccFormResponsible").value = "";
    $("#ccFormResponsibleName").value = "";
    refreshResponsibleNameVisibility();
    $("#ccFormValidFrom").value = todayISO();
    $("#ccFormValidTo").value = "";
    $("#ccFormBudget").value = "0";
    $("#ccFormActual").value = "0";
    $("#ccFormDescription").value = "";
    clearFormErrors();
    openModal("ccFormModal");
  }

  function openEditModal(cc) {
    editingId = cc.id;
    $("#ccFormTitle").textContent = "Edit cost center";
    $("#ccFormIntro").textContent = "Update this cost center's details.";
    $("#ccFormSaveBtn").textContent = "Save Changes";
    $("#ccFormName").value = cc.ccName;
    populateCategoryOptions();
    $("#ccFormCategory").value = cc.category;
    populateDepartmentOptions();
    $("#ccFormDepartment").value = cc.departmentId || "";
    populateBranchOptions();
    $("#ccFormBranch").value = cc.branchId || "";
    populateResponsibleOptions(cc.responsibleEmployeeId);
    if (cc.responsibleEmployeeId) {
      $("#ccFormResponsible").value = cc.responsibleEmployeeId;
      $("#ccFormResponsibleName").value = "";
    } else if (cc.responsiblePerson) {
      $("#ccFormResponsible").value = "__custom__";
      $("#ccFormResponsibleName").value = cc.responsiblePerson;
    } else {
      $("#ccFormResponsible").value = "";
      $("#ccFormResponsibleName").value = "";
    }
    refreshResponsibleNameVisibility();
    $("#ccFormValidFrom").value = cc.validFrom;
    $("#ccFormValidTo").value = cc.validTo || "";
    $("#ccFormBudget").value = String(cc.annualBudget || 0);
    $("#ccFormActual").value = String(cc.actualSpend || 0);
    $("#ccFormDescription").value = cc.description || "";
    clearFormErrors();
    openModal("ccFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#ccFormName").value.trim();
    if (!name) { setFormError("ccFormName", "Cost center name is required."); valid = false; }
    else if (name.length > 60) { setFormError("ccFormName", "Maximum 60 characters allowed."); valid = false; }
    else if (ERP_CostCenterRepository.hasDuplicateName(company.id, name, editingId)) { setFormError("ccFormName", "Another cost center already uses this name."); valid = false; }

    if ($("#ccFormResponsible").value === "__custom__" && !$("#ccFormResponsibleName").value.trim()) {
      setFormError("ccFormResponsibleName", "Enter a name, or pick someone from the list above.");
      valid = false;
    }

    const validFrom = $("#ccFormValidFrom").value;
    if (!validFrom) { setFormError("ccFormValidFrom", "Valid From is required."); valid = false; }

    const validTo = $("#ccFormValidTo").value;
    if (validTo && validFrom && validTo <= validFrom) { setFormError("ccFormValidTo", "Valid To must be after Valid From."); valid = false; }

    const budget = parseFloat($("#ccFormBudget").value);
    if ($("#ccFormBudget").value === "" || isNaN(budget) || budget < 0) { setFormError("ccFormBudget", "Enter a budget of 0 or more."); valid = false; }

    const actual = parseFloat($("#ccFormActual").value);
    if ($("#ccFormActual").value === "" || isNaN(actual) || actual < 0) { setFormError("ccFormActual", "Enter an actual spend of 0 or more."); valid = false; }

    return valid;
  }

  function bindFormModal() {
    $("#ccAddBtn").addEventListener("click", openAddModal);
    $("#ccFormResponsible").addEventListener("change", refreshResponsibleNameVisibility);

    $("#ccFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const responsibleValue = $("#ccFormResponsible").value;
      const payload = {
        ccName: $("#ccFormName").value.trim(),
        category: $("#ccFormCategory").value,
        departmentId: $("#ccFormDepartment").value || null,
        branchId: $("#ccFormBranch").value || null,
        responsibleEmployeeId: (responsibleValue && responsibleValue !== "__custom__") ? responsibleValue : null,
        responsiblePerson: responsibleValue === "__custom__" ? $("#ccFormResponsibleName").value.trim() : "",
        validFrom: $("#ccFormValidFrom").value,
        validTo: $("#ccFormValidTo").value || null,
        annualBudget: parseFloat($("#ccFormBudget").value) || 0,
        actualSpend: parseFloat($("#ccFormActual").value) || 0,
        description: $("#ccFormDescription").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this cost center?",
          message: `"${payload.ccName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_CostCenterRepository.update(editingId, payload);
            logSystemActivity({ module: "Cost Centers", action: "Update", description: `Updated cost center "${payload.ccName}" for ${company.name}` });
            closeModal("ccFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_CostCenterRepository.findById(editingId));
            showToast("Cost center updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this cost center?",
          message: `"${payload.ccName}" (${payload.category}) will be added with a budget of ${formatBudget(payload.annualBudget)}.`,
          confirmLabel: "Add Cost Center",
          onConfirm: () => {
            const created = ERP_CostCenterRepository.create(company, payload);
            logSystemActivity({ module: "Cost Centers", action: "Create", description: `Added cost center "${created.ccName}" (${created.ccCode}) for ${company.name}` });
            closeModal("ccFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.ccName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (three-state: Active / Blocked / Inactive)
     --------------------------------------------------------------------- */
  function requestSetStatus(cc, newStatus) {
    const labels = {
      Active: cc.status === "Blocked" ? "Unblock" : "Reactivate",
      Blocked: "Block",
      Inactive: "Deactivate"
    };
    const pastTense = {
      Active: cc.status === "Blocked" ? "Unblocked" : "Reactivated",
      Blocked: "Blocked",
      Inactive: "Deactivated"
    };
    const messages = {
      Active: `"${cc.ccName}" will become Active again.`,
      Blocked: `"${cc.ccName}" will be Blocked — temporarily unable to receive new postings, e.g. while under review. It stays visible in reports.`,
      Inactive: `"${cc.ccName}" will be marked Inactive. It stays on record and can be reactivated any time.`
    };
    openConfirm({
      title: `${labels[newStatus]} this cost center?`,
      message: messages[newStatus],
      confirmLabel: labels[newStatus],
      onConfirm: () => {
        ERP_CostCenterRepository.setStatus(cc.id, newStatus);
        logSystemActivity({ module: "Cost Centers", action: labels[newStatus], description: `${pastTense[newStatus]} cost center "${cc.ccName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === cc.id) openDetailModal(ERP_CostCenterRepository.findById(cc.id));
        showToast(`"${cc.ccName}" is now ${newStatus}.`, "success");
      }
    });
  }

  function requestDelete(cc) {
    openConfirm({
      title: "Delete this cost center?",
      message: `"${cc.ccName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_CostCenterRepository.remove(cc.id);
        logSystemActivity({ module: "Cost Centers", action: "Delete", description: `Deleted cost center "${cc.ccName}" for ${company.name}`, severity: "warning" });
        if (detailId === cc.id) closeModal("ccDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${cc.ccName}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(cc) {
    const footer = $("#ccDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(cc));
    if (cc.status === "Active") {
      addBtn("Block", "btn btn--ghost", () => requestSetStatus(cc, "Blocked"));
      addBtn("Deactivate", "btn btn--ghost", () => requestSetStatus(cc, "Inactive"));
    } else if (cc.status === "Blocked") {
      addBtn("Unblock", "btn btn--ghost", () => requestSetStatus(cc, "Active"));
      addBtn("Deactivate", "btn btn--ghost", () => requestSetStatus(cc, "Inactive"));
    } else {
      addBtn("Reactivate", "btn btn--ghost", () => requestSetStatus(cc, "Active"));
    }
    addBtn("Edit", "btn btn--primary", () => { closeModal("ccDetailModal"); openEditModal(cc); });
  }

  function openDetailModal(cc) {
    detailId = cc.id;
    const dept = cc.departmentId ? ERP_DepartmentRepository.findById(cc.departmentId) : null;
    const branch = cc.branchId ? ERP_BranchRepository.findById(cc.branchId) : null;
    const { budget, actual, variance, utilizationPct } = ERP_CostCenterRepository.getVariance(cc);
    const expired = ERP_CostCenterRepository.isExpired(cc);
    const band = ERP_CostCenterRepository.getUtilizationBand(cc);

    $("#ccDetailTitle").textContent = `${cc.ccName} · ${cc.ccCode}`;
    $("#ccDetailBody").innerHTML = `
      <div><dt>Cost Center Name</dt><dd>${escapeHtml(cc.ccName)}</dd></div>
      <div><dt>Cost Center Code</dt><dd>${escapeHtml(cc.ccCode)}</dd></div>
      <div><dt>Category</dt><dd>${escapeHtml(cc.category)}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${STATUS_BADGE[cc.status]}">${cc.status}</span>${expired ? ` <span class="status-badge status-badge--danger">Expired</span>` : ""}</dd></div>
      <div><dt>Department</dt><dd>${dept ? escapeHtml(dept.deptName) : "—"}</dd></div>
      <div><dt>Branch</dt><dd>${branch ? escapeHtml(branch.branchName) : "—"}</dd></div>
      <div><dt>Responsible Person</dt><dd>${escapeHtml(ERP_CostCenterRepository.getResponsiblePersonLabel(cc))}</dd></div>
      <div><dt>Valid From</dt><dd>${formatDateOnly(cc.validFrom)}</dd></div>
      <div><dt>Valid To</dt><dd>${cc.validTo ? formatDateOnly(cc.validTo) : "Ongoing"}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(cc.createdAt))}</dd></div>
      ${cc.description ? `<div><dt>Description</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(cc.description)}</dd></div>` : ""}
    `;

    const fillClass = band === "over" ? "budget-bar__fill--over" : band === "near" ? "budget-bar__fill--near" : "";
    $("#ccDetailBudgetBarFill").className = `budget-bar__fill ${fillClass}`;
    $("#ccDetailBudgetBarFill").style.width = `${Math.min(100, isFinite(utilizationPct) ? utilizationPct : 100)}%`;

    const varianceLabel = variance >= 0 ? "under budget" : "over budget";
    $("#ccDetailVarianceText").textContent =
      `Budget ${formatBudget(budget)} · Actual ${formatBudget(actual)} · ${formatBudget(Math.abs(variance))} ${varianceLabel} (${formatPct(utilizationPct)} utilized)`;

    renderDetailFooter(cc);
    openModal("ccDetailModal");
  }

  function bindDetailModal() {
    $("#ccTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const cc = ERP_CostCenterRepository.findById(viewBtn.dataset.id);
        if (cc) openDetailModal(cc);
        return;
      }
      if (actionBtn) {
        const cc = ERP_CostCenterRepository.findById(actionBtn.dataset.id);
        if (cc) requestSetStatus(cc, actionBtn.dataset.action);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "cost-centers")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading cost centers…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#ccContent").hidden = true;
      $("#ccSubtitle").textContent = "No active company yet.";
    } else {
      baseCurrency = ERP_CurrencyRepository.ensureBaseCurrency(company);
      $("#noCompanyState").hidden = true;
      $("#ccContent").hidden = false;
      $("#ccHeaderActions").hidden = false;
      $("#ccSubtitle").textContent = `Managing cost centers for ${company.name} (${company.companyCode}).`;
      buildCategoryChips();
      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
