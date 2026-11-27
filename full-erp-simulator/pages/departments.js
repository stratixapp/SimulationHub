/* =============================================================================
   DOT ERP — pages/departments.js
   Phase 2, Module 07: Departments

   Always works against the ACTIVE company. Unlike the last four modules,
   nothing earlier anchors this one — departments are a clean standalone
   master list, but the first one with real hierarchy. Budgets are shown in
   the company's actual base currency (via ERP_CurrencyRepository, Module 4)
   rather than assuming INR, and a department can optionally link to a
   Branch (Module 6) the same "store the id, look it up live" way Branches
   linked to GST Details.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity
  } = window.ERP;

  const PAGE_SIZE = 6;

  let session = null;
  let company = null;
  let baseCurrency = null;  // { symbol, decimalPlaces, ... } — from ERP_CurrencyRepository
  let currentView = "table"; // "table" | "tree"
  let filterStatus = "all";
  let sortOrder = "asc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;


  /* -----------------------------------------------------------------------
     BUDGET FORMATTING — respects the company's real base currency (Module 4)
     rather than assuming INR, by defensively calling ensureBaseCurrency()
     here too. That call is idempotent, so it's safe regardless of whether
     the user has ever actually visited the Currency page.
     --------------------------------------------------------------------- */
  function formatBudget(amount) {
    const n = Number(amount) || 0;
    const decimals = baseCurrency ? baseCurrency.decimalPlaces : 0;
    return `${baseCurrency ? baseCurrency.symbol : "₹"}${n.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY (table view only — tree view always shows the
     full, unfiltered hierarchy; see the Help Guide for why)
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_DepartmentRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((d) => d.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((d) =>
        d.deptName.toLowerCase().includes(term) ||
        d.deptCode.toLowerCase().includes(term) ||
        (d.headName || "").toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.deptName.localeCompare(b.deptName);
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  /** Company-wide totals are a flat sum across every department — NOT a
      sum of rollups, which would double-count every parent inside its own
      children's rollups too. See data/department-data.js's header comment. */
  function renderSummary() {
    const all = ERP_DepartmentRepository.getAllForCompany(company.id);
    $("#deptSummaryTotal").textContent = String(all.length);
    $("#deptSummaryRoots").textContent = String(all.filter((d) => !d.parentId).length);
    const totalBudget = all.reduce((sum, d) => sum + (Number(d.annualBudget) || 0), 0);
    $("#deptSummaryBudget").textContent = formatBudget(totalBudget);
    const totalHeadcount = all.reduce((sum, d) => sum + (Number(d.headcount) || 0), 0);
    $("#deptSummaryHeadcount").textContent = String(totalHeadcount);
  }


  /* -----------------------------------------------------------------------
     TABLE VIEW + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#deptPagination");
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

    $("#deptEmptyState").hidden = all.length !== 0;
    $("#deptTable").hidden = all.length === 0;

    $("#deptTableBody").innerHTML = pageItems.map((d) => {
      const parent = d.parentId ? ERP_DepartmentRepository.findById(d.parentId) : null;
      const branch = d.branchId ? ERP_BranchRepository.findById(d.branchId) : null;
      const statusBadge = `<span class="status-badge status-badge--${d.status === "Active" ? "success" : "danger"}">${d.status}</span>`;
      const quickAction = d.status === "Active"
        ? `<button type="button" class="link-btn" data-action="deactivate" data-id="${d.id}">Deactivate</button>`
        : `<button type="button" class="link-btn" data-action="reactivate" data-id="${d.id}">Reactivate</button>`;

      return `
      <tr>
        <td><code>${escapeHtml(d.deptCode)}</code></td>
        <td>${escapeHtml(d.deptName)}</td>
        <td>${parent ? escapeHtml(parent.deptName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${escapeHtml(d.headName || "—")}</td>
        <td>${branch ? escapeHtml(branch.branchName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${formatBudget(d.annualBudget)}</td>
        <td>${Number(d.headcount) || 0}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${d.id}">View</button>
          ${quickAction}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }


  /* -----------------------------------------------------------------------
     TREE / ORG CHART VIEW — always the full hierarchy, ignores filters.
     --------------------------------------------------------------------- */
  function renderTreeNode(dept) {
    const children = ERP_DepartmentRepository.getChildren(company.id, dept.id);
    const branch = dept.branchId ? ERP_BranchRepository.findById(dept.branchId) : null;
    const cardClass = dept.status === "Active" ? "" : " dept-tree__card--inactive";

    return `
      <li class="dept-tree__item">
        <div class="dept-tree__card${cardClass}">
          <span class="dept-tree__name">${escapeHtml(dept.deptName)}</span>
          <span class="status-badge status-badge--${dept.status === "Active" ? "success" : "danger"}">${dept.status}</span>
          <div class="dept-tree__meta">
            <span><code>${escapeHtml(dept.deptCode)}</code></span>
            ${dept.headName ? `<span>Head: ${escapeHtml(dept.headName)}</span>` : ""}
            ${branch ? `<span>${escapeHtml(branch.branchName)}</span>` : ""}
            <span>${formatBudget(dept.annualBudget)}</span>
            <span>${Number(dept.headcount) || 0} people</span>
          </div>
          <button type="button" class="row-detail-btn" data-id="${dept.id}">View</button>
        </div>
        ${children.length ? `<ul class="dept-tree__children">${children.map(renderTreeNode).join("")}</ul>` : ""}
      </li>`;
  }

  function renderTree() {
    const roots = ERP_DepartmentRepository.getRootDepartments(company.id);
    $("#deptTreeEmptyState").hidden = roots.length !== 0;
    $("#deptTreeRoot").innerHTML = roots.map(renderTreeNode).join("");
  }

  function renderAll() {
    renderSummary();
    renderTable();
    if (currentView === "tree") renderTree();
  }


  /* -----------------------------------------------------------------------
     VIEW TOGGLE (Table / Org Chart)
     --------------------------------------------------------------------- */
  function bindViewToggle() {
    $$("#deptViewToggle .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#deptViewToggle .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        currentView = chip.dataset.view;
        const isTree = currentView === "tree";
        $("#deptTableView").hidden = isTree;
        $("#deptTreeView").hidden = !isTree;
        // The status filter and sort order only make sense for the flat
        // table — hide them while the tree (always unfiltered) is showing.
        $("#deptStatusChips").hidden = isTree;
        $("#deptSortBtn").hidden = isTree;
        if (isTree) renderTree();
      });
    });
  }


  /* -----------------------------------------------------------------------
     TOOLBAR: status chips, sort, search, export, print
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#deptStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#deptStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#deptSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#deptSortBtn").textContent = sortOrder === "asc" ? "Name A-Z" : "Name Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#deptExportCsvBtn").addEventListener("click", exportCsv);
    $("#deptPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Parent Department", "Head", "Branch", "Annual Budget", "Headcount", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((d) => {
      const parent = d.parentId ? ERP_DepartmentRepository.findById(d.parentId) : null;
      const branch = d.branchId ? ERP_BranchRepository.findById(d.branchId) : null;
      const line = [
        d.deptCode, d.deptName, parent ? parent.deptName : "", d.headName || "",
        branch ? branch.branchName : "", d.annualBudget, d.headcount, d.status
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-departments-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Departments exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((d) => {
      const parent = d.parentId ? ERP_DepartmentRepository.findById(d.parentId) : null;
      return `<tr><td>${escapeHtml(d.deptCode)}</td><td>${escapeHtml(d.deptName)}</td><td>${parent ? escapeHtml(parent.deptName) : "—"}</td><td>${escapeHtml(d.headName || "—")}</td><td>${formatBudget(d.annualBudget)}</td><td>${d.headcount || 0}</td><td>${d.status}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Department Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Department Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Parent</th><th>Head</th><th>Budget</th><th>Headcount</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Departments")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#deptActivityEmptyState").hidden = relevant.length !== 0;
    $("#deptActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT DEPARTMENT MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["deptFormName", "deptFormParent", "deptFormBudget", "deptFormHeadcount"].forEach((f) => setFormError(f, ""));
  }

  /** Excludes the department itself and all of its descendants from the
      Parent dropdown — the one guard that keeps the hierarchy cycle-free. */
  function populateParentOptions(excludeDeptId) {
    const all = ERP_DepartmentRepository.getAllForCompany(company.id);
    const excluded = new Set();
    if (excludeDeptId) {
      excluded.add(excludeDeptId);
      ERP_DepartmentRepository.getDescendants(company.id, excludeDeptId).forEach((d) => excluded.add(d.id));
    }
    const options = all.filter((d) => !excluded.has(d.id));
    $("#deptFormParent").innerHTML = `<option value="">None (top-level department)</option>` +
      options.map((d) => `<option value="${d.id}">${escapeHtml(d.deptName)}</option>`).join("");
  }

  function populateBranchOptions() {
    const branches = ERP_BranchRepository.getAllForCompany(company.id).filter((b) => b.isPrimary || b.status === "Active");
    $("#deptFormBranch").innerHTML = `<option value="">Not linked</option>` +
      branches.map((b) => `<option value="${b.id}">${escapeHtml(b.branchName)}</option>`).join("");
  }

  function openAddModal() {
    editingId = null;
    $("#deptFormTitle").textContent = "Add department";
    $("#deptFormIntro").textContent = "Add a department — leave Parent Department unset for a top-level department like Finance or Sales.";
    $("#deptFormSaveBtn").textContent = "Add Department";
    $("#deptFormName").value = "";
    populateParentOptions(null);
    $("#deptFormParent").value = "";
    $("#deptFormHead").value = "";
    populateBranchOptions();
    $("#deptFormBranch").value = "";
    $("#deptFormBudget").value = "0";
    $("#deptFormHeadcount").value = "0";
    $("#deptFormDescription").value = "";
    clearFormErrors();
    openModal("deptFormModal");
  }

  function openEditModal(dept) {
    editingId = dept.id;
    $("#deptFormTitle").textContent = "Edit department";
    $("#deptFormIntro").textContent = "Update this department's details.";
    $("#deptFormSaveBtn").textContent = "Save Changes";
    $("#deptFormName").value = dept.deptName;
    populateParentOptions(dept.id);
    $("#deptFormParent").value = dept.parentId || "";
    $("#deptFormHead").value = dept.headName || "";
    populateBranchOptions();
    $("#deptFormBranch").value = dept.branchId || "";
    $("#deptFormBudget").value = String(dept.annualBudget || 0);
    $("#deptFormHeadcount").value = String(dept.headcount || 0);
    $("#deptFormDescription").value = dept.description || "";
    clearFormErrors();
    openModal("deptFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#deptFormName").value.trim();
    if (!name) { setFormError("deptFormName", "Department name is required."); valid = false; }
    else if (name.length > 60) { setFormError("deptFormName", "Maximum 60 characters allowed."); valid = false; }
    else if (ERP_DepartmentRepository.hasDuplicateName(company.id, name, editingId)) { setFormError("deptFormName", "Another department already uses this name."); valid = false; }

    const parentId = $("#deptFormParent").value || null;
    if (parentId && editingId && ERP_DepartmentRepository.wouldCreateCycle(company.id, editingId, parentId)) {
      setFormError("deptFormParent", "A department can't be its own ancestor — choose a different parent.");
      valid = false;
    }

    const budget = parseFloat($("#deptFormBudget").value);
    if ($("#deptFormBudget").value === "" || isNaN(budget) || budget < 0) { setFormError("deptFormBudget", "Enter a budget of 0 or more."); valid = false; }

    const headcount = parseInt($("#deptFormHeadcount").value, 10);
    if ($("#deptFormHeadcount").value === "" || isNaN(headcount) || headcount < 0) { setFormError("deptFormHeadcount", "Enter a headcount of 0 or more."); valid = false; }

    return valid;
  }

  function bindFormModal() {
    $("#deptAddBtn").addEventListener("click", openAddModal);

    $("#deptFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        deptName: $("#deptFormName").value.trim(),
        parentId: $("#deptFormParent").value || null,
        headName: $("#deptFormHead").value.trim(),
        branchId: $("#deptFormBranch").value || null,
        annualBudget: parseFloat($("#deptFormBudget").value) || 0,
        headcount: parseInt($("#deptFormHeadcount").value, 10) || 0,
        description: $("#deptFormDescription").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this department?",
          message: `"${payload.deptName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_DepartmentRepository.update(editingId, payload);
            logSystemActivity({ module: "Departments", action: "Update", description: `Updated department "${payload.deptName}" for ${company.name}` });
            closeModal("deptFormModal");
            renderAll();
            renderActivity();
            showToast("Department updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this department?",
          message: `"${payload.deptName}" will be added${payload.parentId ? ` under "${ERP_DepartmentRepository.findById(payload.parentId).deptName}"` : " as a top-level department"}.`,
          confirmLabel: "Add Department",
          onConfirm: () => {
            const created = ERP_DepartmentRepository.create(company, payload);
            logSystemActivity({ module: "Departments", action: "Create", description: `Added department "${created.deptName}" (${created.deptCode}) for ${company.name}` });
            closeModal("deptFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.deptName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (toggle status / delete)
     --------------------------------------------------------------------- */
  function requestToggleStatus(dept) {
    const activating = dept.status !== "Active";
    let message = activating
      ? `"${dept.deptName}" will become Active again.`
      : `"${dept.deptName}" will be marked Inactive. It stays on record and can be reactivated any time.`;

    if (!activating) {
      const activeChildren = ERP_DepartmentRepository.getChildren(company.id, dept.id).filter((c) => c.status === "Active");
      if (activeChildren.length) {
        message += ` It has ${activeChildren.length} active sub-department${activeChildren.length > 1 ? "s" : ""} that will remain Active — deactivate them separately if needed.`;
      }
    }

    openConfirm({
      title: activating ? "Reactivate this department?" : "Deactivate this department?",
      message,
      confirmLabel: activating ? "Reactivate" : "Deactivate",
      onConfirm: () => {
        ERP_DepartmentRepository.toggleStatus(dept.id);
        logSystemActivity({ module: "Departments", action: activating ? "Reactivate" : "Deactivate", description: `${activating ? "Reactivated" : "Deactivated"} department "${dept.deptName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === dept.id) openDetailModal(ERP_DepartmentRepository.findById(dept.id));
        showToast(`"${dept.deptName}" is now ${activating ? "Active" : "Inactive"}.`, "success");
      }
    });
  }

  /** Refuses up front (before even offering a confirm dialog) if the
      department still has children — the same real-world rule a
      filesystem enforces for a non-empty folder. */
  function requestDelete(dept) {
    if (ERP_DepartmentRepository.hasChildren(company.id, dept.id)) {
      showToast(`"${dept.deptName}" has sub-departments and can't be deleted until they're reassigned or removed first.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this department?",
      message: `"${dept.deptName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_DepartmentRepository.remove(dept.id, company.id);
        logSystemActivity({ module: "Departments", action: "Delete", description: `Deleted department "${dept.deptName}" for ${company.name}`, severity: "warning" });
        if (detailId === dept.id) closeModal("deptDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${dept.deptName}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL — breadcrumb (up), own vs. rollup numbers, children (down)
     --------------------------------------------------------------------- */
  function renderBreadcrumb(dept) {
    const ancestors = ERP_DepartmentRepository.getAncestors(company.id, dept.id);
    if (!ancestors.length) { $("#deptDetailBreadcrumb").innerHTML = ""; return; }
    $("#deptDetailBreadcrumb").innerHTML = ancestors
      .map((a) => `<button type="button" class="link-btn" data-drill-id="${a.id}">${escapeHtml(a.deptName)}</button>`)
      .join(' <span class="profile-subtle">/</span> ');
  }

  function renderChildrenList(dept) {
    const children = ERP_DepartmentRepository.getChildren(company.id, dept.id);
    $("#deptDetailNoChildren").hidden = children.length !== 0;
    $("#deptDetailChildrenList").innerHTML = children.map((c) => `
      <li class="activity-item">
        <span class="activity-item__icon">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5h5l2 2h9v9.5H4V7.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </span>
        <div style="flex:1 1 auto;">
          <p class="activity-item__text">${escapeHtml(c.deptName)} <span class="profile-subtle">(${escapeHtml(c.deptCode)})</span></p>
          <p class="activity-item__time">${c.status} · ${formatBudget(c.annualBudget)} · ${Number(c.headcount) || 0} people</p>
        </div>
        <button type="button" class="row-detail-btn" data-drill-id="${c.id}">View</button>
      </li>
    `).join("");
  }

  function renderDetailFooter(dept) {
    const footer = $("#deptDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(dept));
    addBtn(dept.status === "Active" ? "Deactivate" : "Reactivate", "btn btn--ghost", () => requestToggleStatus(dept));
    addBtn("Edit", "btn btn--primary", () => { closeModal("deptDetailModal"); openEditModal(dept); });
  }

  function openDetailModal(dept) {
    detailId = dept.id;
    const branch = dept.branchId ? ERP_BranchRepository.findById(dept.branchId) : null;
    const budgetRollup = ERP_DepartmentRepository.getBudgetRollup(company.id, dept.id);
    const headcountRollup = ERP_DepartmentRepository.getHeadcountRollup(company.id, dept.id);
    const childCount = ERP_DepartmentRepository.getChildren(company.id, dept.id).length;

    $("#deptDetailTitle").textContent = `${dept.deptName} · ${dept.deptCode}`;
    renderBreadcrumb(dept);
    $("#deptDetailBody").innerHTML = `
      <div><dt>Department Name</dt><dd>${escapeHtml(dept.deptName)}</dd></div>
      <div><dt>Department Code</dt><dd>${escapeHtml(dept.deptCode)}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${dept.status === "Active" ? "success" : "danger"}">${dept.status}</span></dd></div>
      <div><dt>Department Head</dt><dd>${escapeHtml(dept.headName || "—")}</dd></div>
      <div><dt>Branch</dt><dd>${branch ? escapeHtml(branch.branchName) : "—"}</dd></div>
      <div><dt>Own Budget</dt><dd>${formatBudget(dept.annualBudget)}</dd></div>
      <div><dt>Budget Rollup${childCount ? " (incl. sub-departments)" : ""}</dt><dd>${formatBudget(budgetRollup)}</dd></div>
      <div><dt>Own Headcount</dt><dd>${Number(dept.headcount) || 0}</dd></div>
      <div><dt>Headcount Rollup${childCount ? " (incl. sub-departments)" : ""}</dt><dd>${headcountRollup}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(dept.createdAt))}</dd></div>
      ${dept.description ? `<div><dt>Description</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(dept.description)}</dd></div>` : ""}
    `;
    renderChildrenList(dept);
    renderDetailFooter(dept);
    openModal("deptDetailModal");
  }

  function bindDetailModal() {
    $("#deptTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const dept = ERP_DepartmentRepository.findById(viewBtn.dataset.id);
        if (dept) openDetailModal(dept);
        return;
      }
      if (actionBtn) {
        const dept = ERP_DepartmentRepository.findById(actionBtn.dataset.id);
        if (dept) requestToggleStatus(dept);
      }
    });

    $("#deptTreeRoot").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const dept = ERP_DepartmentRepository.findById(viewBtn.dataset.id);
      if (dept) openDetailModal(dept);
    });

    // Breadcrumb (navigate up) and children list (navigate down) both drill
    // within the same open modal rather than closing and reopening it.
    $("#deptDetailModal").addEventListener("click", (e) => {
      const drillBtn = e.target.closest("[data-drill-id]");
      if (!drillBtn) return;
      const dept = ERP_DepartmentRepository.findById(drillBtn.dataset.drillId);
      if (dept) openDetailModal(dept);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "departments")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading departments…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#deptContent").hidden = true;
      $("#deptSubtitle").textContent = "No active company yet.";
    } else {
      baseCurrency = ERP_CurrencyRepository.ensureBaseCurrency(company);
      $("#noCompanyState").hidden = true;
      $("#deptContent").hidden = false;
      $("#deptHeaderActions").hidden = false;
      $("#deptSubtitle").textContent = `Managing departments for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindViewToggle();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
