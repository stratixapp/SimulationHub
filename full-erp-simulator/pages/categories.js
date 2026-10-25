/* =============================================================================
   DOT ERP — pages/categories.js
   Phase 3, Module 04: Category Master

   Reuses Departments' hierarchy UI patterns end to end: the Table/Tree view
   toggle, the tree renderer built on .dept-tree (zero new CSS needed), and
   the detail modal's breadcrumb-up/children-list-down drill navigation. See
   data/category-data.js's header for the full reasoning on why this module
   gets real hierarchy where most of Phase 3 stayed flat, and why Category
   Type (Product/Service) exists.
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
  let filterType = "all";
  let filterStatus = "all";
  let sortOrder = "asc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;
  let currentView = "table";


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_CategoryRepository.getAllForCompany(company.id);

    if (filterType !== "all") rows = rows.filter((c) => c.categoryType === filterType);
    if (filterStatus !== "all") rows = rows.filter((c) => c.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((c) =>
        c.categoryName.toLowerCase().includes(term) ||
        c.categoryCode.toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.categoryName.localeCompare(b.categoryName);
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  function renderSummary() {
    const all = ERP_CategoryRepository.getAllForCompany(company.id);
    $("#catSummaryTotal").textContent = String(all.length);
    $("#catSummaryActive").textContent = String(all.filter((c) => c.status === "Active").length);
    $("#catSummaryRoot").textContent = String(all.filter((c) => !c.parentCategoryId).length);
    $("#catSummaryService").textContent = String(all.filter((c) => c.categoryType === "Service").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#catPagination");
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

  function parentLabel(c) {
    if (!c.parentCategoryId) return `<span class="profile-subtle">— top level —</span>`;
    const parent = ERP_CategoryRepository.findById(c.parentCategoryId);
    return parent ? escapeHtml(parent.categoryName) : `<span class="profile-subtle">—</span>`;
  }

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#catEmptyState").hidden = all.length !== 0;
    $("#catTable").hidden = all.length === 0;

    $("#catTableBody").innerHTML = pageItems.map((c) => {
      const statusBadge = `<span class="status-badge status-badge--${c.status === "Active" ? "success" : "danger"}">${c.status}</span>`;
      const quickAction = `<button type="button" class="link-btn" data-action="toggle" data-id="${c.id}">${c.status === "Active" ? "Deactivate" : "Reactivate"}</button>`;

      return `
      <tr>
        <td><code>${escapeHtml(c.categoryCode)}</code></td>
        <td>${escapeHtml(c.categoryName)}</td>
        <td>${escapeHtml(c.categoryType)}</td>
        <td>${parentLabel(c)}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${c.id}">View</button>
          ${quickAction}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }


  /* -----------------------------------------------------------------------
     TREE VIEW — always the full hierarchy, ignores filters (same rule
     Departments' tree follows, for the same reason: a partial tree with
     filtered-out ancestors missing would be confusing, not useful).
     --------------------------------------------------------------------- */
  function renderTreeNode(cat) {
    const children = ERP_CategoryRepository.getChildren(company.id, cat.id);
    const cardClass = cat.status === "Active" ? "" : " dept-tree__card--inactive";

    return `
      <li class="dept-tree__item">
        <div class="dept-tree__card${cardClass}">
          <span class="dept-tree__name">${escapeHtml(cat.categoryName)}</span>
          <span class="status-badge status-badge--${cat.status === "Active" ? "success" : "danger"}">${cat.status}</span>
          <div class="dept-tree__meta">
            <span><code>${escapeHtml(cat.categoryCode)}</code></span>
            <span>${escapeHtml(cat.categoryType)}</span>
          </div>
          <button type="button" class="row-detail-btn" data-id="${cat.id}">View</button>
        </div>
        ${children.length ? `<ul class="dept-tree__children">${children.map(renderTreeNode).join("")}</ul>` : ""}
      </li>`;
  }

  function renderTree() {
    const roots = ERP_CategoryRepository.getRootCategories(company.id);
    $("#catTreeEmptyState").hidden = roots.length !== 0;
    $("#catTreeRoot").innerHTML = roots.map(renderTreeNode).join("");
  }

  function renderAll() {
    renderSummary();
    renderTable();
    if (currentView === "tree") renderTree();
  }


  /* -----------------------------------------------------------------------
     VIEW TOGGLE (Table / Tree)
     --------------------------------------------------------------------- */
  function bindViewToggle() {
    $$("#catViewToggle .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#catViewToggle .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        currentView = chip.dataset.view;
        const isTree = currentView === "tree";
        $("#catTableView").hidden = isTree;
        $("#catTreeView").hidden = !isTree;
        // Type/status filters and sort only make sense for the flat table —
        // hide them while the always-unfiltered tree is showing.
        $("#catTypeChips").hidden = isTree;
        $("#catStatusChips").hidden = isTree;
        $("#catSortBtn").hidden = isTree;
        if (isTree) renderTree();
      });
    });
  }


  /* -----------------------------------------------------------------------
     TOOLBAR: type + status chips, sort, search, export, print
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#catTypeChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#catTypeChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterType = chip.dataset.type;
        page = 1;
        renderTable();
      });
    });

    $$("#catStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#catStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#catSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#catSortBtn").textContent = sortOrder === "asc" ? "Name A-Z" : "Name Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#catExportCsvBtn").addEventListener("click", exportCsv);
    $("#catPrintBtn").addEventListener("click", printList);

    bindViewToggle();
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Type", "Parent Category", "Status", "Description"];
    const csvRows = [header.join(",")];
    rows.forEach((c) => {
      const parent = c.parentCategoryId ? (ERP_CategoryRepository.findById(c.parentCategoryId)?.categoryName || "") : "";
      const line = [c.categoryCode, c.categoryName, c.categoryType, parent, c.status, c.description || ""]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-categories-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Categories exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((c) => {
      const parent = c.parentCategoryId ? (ERP_CategoryRepository.findById(c.parentCategoryId)?.categoryName || "—") : "— top level —";
      return `<tr><td>${escapeHtml(c.categoryCode)}</td><td>${escapeHtml(c.categoryName)}</td><td>${escapeHtml(c.categoryType)}</td><td>${escapeHtml(parent)}</td><td>${escapeHtml(c.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Category Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Category Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Parent Category</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Category Master")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#catActivityEmptyState").hidden = relevant.length !== 0;
    $("#catActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT CATEGORY MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["catFormName", "catFormParent"].forEach((f) => setFormError(f, ""));
  }

  function populateTypeOptions() {
    $("#catFormType").innerHTML = ERP_CategoryRepository.categoryTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
  }

  /** Excludes the category itself and all of its descendants from the
      Parent dropdown — the one guard that keeps the hierarchy cycle-free
      (mirrors Departments' populateParentOptions exactly). */
  function populateParentOptions(excludeCatId) {
    const all = ERP_CategoryRepository.getAllForCompany(company.id);
    const excluded = new Set();
    if (excludeCatId) {
      excluded.add(excludeCatId);
      ERP_CategoryRepository.getDescendants(company.id, excludeCatId).forEach((c) => excluded.add(c.id));
    }
    const options = all.filter((c) => !excluded.has(c.id));
    $("#catFormParent").innerHTML = `<option value="">None (top-level category)</option>` +
      options.map((c) => `<option value="${c.id}">${escapeHtml(ERP_CategoryRepository.getBreadcrumbLabel(company.id, c.id))}</option>`).join("");
  }

  function openAddModal(defaultParentId) {
    editingId = null;
    $("#catFormTitle").textContent = "Add category";
    $("#catFormIntro").textContent = "Add a category — leave Parent Category unset for a top-level category like Electronics or Raw Materials.";
    $("#catFormSaveBtn").textContent = "Add Category";
    $("#catFormName").value = "";
    populateTypeOptions();
    populateParentOptions(null);
    $("#catFormParent").value = defaultParentId || "";
    $("#catFormDescription").value = "";
    clearFormErrors();
    openModal("catFormModal");
  }

  function openEditModal(c) {
    editingId = c.id;
    $("#catFormTitle").textContent = "Edit category";
    $("#catFormIntro").textContent = "Update this category's details.";
    $("#catFormSaveBtn").textContent = "Save Changes";
    $("#catFormName").value = c.categoryName;
    populateTypeOptions();
    $("#catFormType").value = c.categoryType;
    populateParentOptions(c.id);
    $("#catFormParent").value = c.parentCategoryId || "";
    $("#catFormDescription").value = c.description || "";
    clearFormErrors();
    openModal("catFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#catFormName").value.trim();
    if (!name) { setFormError("catFormName", "Category name is required."); valid = false; }
    else if (name.length > 60) { setFormError("catFormName", "Maximum 60 characters allowed."); valid = false; }
    else if (ERP_CategoryRepository.hasDuplicateName(company.id, name, editingId)) { setFormError("catFormName", "A category with this name already exists."); valid = false; }

    const parentId = $("#catFormParent").value || null;
    if (parentId && editingId && ERP_CategoryRepository.wouldCreateCycle(company.id, editingId, parentId)) {
      setFormError("catFormParent", "A category can't be its own ancestor — choose a different parent.");
      valid = false;
    }

    return valid;
  }

  function bindFormModal() {
    $("#catAddBtn").addEventListener("click", () => openAddModal(null));

    $("#catFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        categoryName: $("#catFormName").value.trim(),
        categoryType: $("#catFormType").value,
        parentCategoryId: $("#catFormParent").value || null,
        description: $("#catFormDescription").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this category?",
          message: `"${payload.categoryName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_CategoryRepository.update(editingId, payload);
            logSystemActivity({ module: "Category Master", action: "Update", description: `Updated category "${payload.categoryName}" for ${company.name}` });
            closeModal("catFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_CategoryRepository.findById(editingId));
            showToast("Category updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this category?",
          message: `"${payload.categoryName}" (${payload.categoryType}) will be added.`,
          confirmLabel: "Add Category",
          onConfirm: () => {
            const created = ERP_CategoryRepository.create(company, payload);
            logSystemActivity({ module: "Category Master", action: "Create", description: `Added category "${created.categoryName}" (${created.categoryCode}) for ${company.name}` });
            closeModal("catFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.categoryName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (two-state: Active / Inactive)
     --------------------------------------------------------------------- */
  function requestToggleStatus(c) {
    const activating = c.status !== "Active";
    let message = activating
      ? `"${c.categoryName}" will become Active again.`
      : `"${c.categoryName}" will be marked Inactive. It stays on record and can be reactivated any time.`;

    if (!activating) {
      const activeChildren = ERP_CategoryRepository.getChildren(company.id, c.id).filter((k) => k.status === "Active");
      if (activeChildren.length) {
        message += ` It has ${activeChildren.length} active sub-categor${activeChildren.length > 1 ? "ies" : "y"} that will remain Active — deactivate them separately if needed.`;
      }
    }

    openConfirm({
      title: activating ? "Reactivate this category?" : "Deactivate this category?",
      message,
      confirmLabel: activating ? "Reactivate" : "Deactivate",
      onConfirm: () => {
        ERP_CategoryRepository.toggleStatus(c.id);
        logSystemActivity({ module: "Category Master", action: activating ? "Reactivate" : "Deactivate", description: `${activating ? "Reactivated" : "Deactivated"} category "${c.categoryName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === c.id) openDetailModal(ERP_CategoryRepository.findById(c.id));
        showToast(`"${c.categoryName}" is now ${activating ? "Active" : "Inactive"}.`, "success");
      }
    });
  }

  /** Refuses up front if the category still has children — same real-world
      rule Departments enforces for the same reason. */
  function requestDelete(c) {
    if (ERP_CategoryRepository.hasChildren(company.id, c.id)) {
      showToast(`"${c.categoryName}" has sub-categories and can't be deleted until they're reassigned or removed first.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this category?",
      message: `"${c.categoryName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_CategoryRepository.remove(c.id, company.id);
        logSystemActivity({ module: "Category Master", action: "Delete", description: `Deleted category "${c.categoryName}" for ${company.name}`, severity: "warning" });
        if (detailId === c.id) closeModal("catDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${c.categoryName}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL — breadcrumb (up), children (down), same drill pattern
     Departments established.
     --------------------------------------------------------------------- */
  function renderBreadcrumb(c) {
    const ancestors = ERP_CategoryRepository.getAncestors(company.id, c.id);
    if (!ancestors.length) { $("#catDetailBreadcrumb").innerHTML = ""; return; }
    $("#catDetailBreadcrumb").innerHTML = ancestors
      .map((a) => `<button type="button" class="link-btn" data-drill-id="${a.id}">${escapeHtml(a.categoryName)}</button>`)
      .join(' <span class="profile-subtle">/</span> ');
  }

  function renderChildrenList(c) {
    const children = ERP_CategoryRepository.getChildren(company.id, c.id);
    $("#catDetailNoChildren").hidden = children.length !== 0;
    $("#catDetailChildrenList").innerHTML = children.map((k) => `
      <li class="activity-item">
        <span class="activity-item__icon">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 4h6.5L20.5 7v6.5L13 21 3.5 11.5 11 4Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </span>
        <div style="flex:1 1 auto;">
          <p class="activity-item__text">${escapeHtml(k.categoryName)} <span class="profile-subtle">(${escapeHtml(k.categoryCode)})</span></p>
          <p class="activity-item__time">${k.status} · ${escapeHtml(k.categoryType)}</p>
        </div>
        <button type="button" class="row-detail-btn" data-drill-id="${k.id}">View</button>
      </li>
    `).join("");
  }

  function renderDetailFooter(c) {
    const footer = $("#catDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(c));
    addBtn("+ Add Sub-Category", "btn btn--ghost", () => { closeModal("catDetailModal"); openAddModal(c.id); });
    addBtn(c.status === "Active" ? "Deactivate" : "Reactivate", "btn btn--ghost", () => requestToggleStatus(c));
    addBtn("Edit", "btn btn--primary", () => { closeModal("catDetailModal"); openEditModal(c); });
  }

  function openDetailModal(c) {
    detailId = c.id;
    const parent = c.parentCategoryId ? ERP_CategoryRepository.findById(c.parentCategoryId) : null;
    const childCount = ERP_CategoryRepository.getChildren(company.id, c.id).length;

    $("#catDetailTitle").textContent = `${c.categoryName} · ${c.categoryCode}`;
    renderBreadcrumb(c);
    $("#catDetailBody").innerHTML = `
      <div><dt>Category Name</dt><dd>${escapeHtml(c.categoryName)}</dd></div>
      <div><dt>Category Code</dt><dd>${escapeHtml(c.categoryCode)}</dd></div>
      <div><dt>Category Type</dt><dd>${escapeHtml(c.categoryType)}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${c.status === "Active" ? "success" : "danger"}">${c.status}</span></dd></div>
      <div><dt>Parent Category</dt><dd>${parent ? escapeHtml(parent.categoryName) : "— top level —"}</dd></div>
      <div><dt>Sub-Categories</dt><dd>${childCount}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(c.createdAt))}</dd></div>
      ${c.description ? `<div><dt>Description</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(c.description)}</dd></div>` : ""}
    `;
    renderChildrenList(c);
    renderDetailFooter(c);
    openModal("catDetailModal");
  }

  function bindDetailModal() {
    $("#catTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const c = ERP_CategoryRepository.findById(viewBtn.dataset.id);
        if (c) openDetailModal(c);
        return;
      }
      if (actionBtn) {
        const c = ERP_CategoryRepository.findById(actionBtn.dataset.id);
        if (c) requestToggleStatus(c);
      }
    });

    $("#catTreeRoot").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const c = ERP_CategoryRepository.findById(viewBtn.dataset.id);
      if (c) openDetailModal(c);
    });

    // Breadcrumb (navigate up) and children list (navigate down) both drill
    // within the same open modal rather than closing and reopening it.
    $("#catDetailModal").addEventListener("click", (e) => {
      const drillBtn = e.target.closest("[data-drill-id]");
      if (!drillBtn) return;
      const c = ERP_CategoryRepository.findById(drillBtn.dataset.drillId);
      if (c) openDetailModal(c);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "categories")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading categories…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#catContent").hidden = true;
      $("#catSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#catContent").hidden = false;
      $("#catHeaderActions").hidden = false;
      $("#catSubtitle").textContent = `Managing categories for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
