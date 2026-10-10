/* =============================================================================
   DOT ERP — pages/chart-of-accounts.js
   Phase 6, Module 01: Chart of Accounts

   Reuses Category Master's Table/Tree toggle, .dept-tree renderer, and the
   detail modal's breadcrumb-up/children-list-down drill navigation end to
   end — see data/chart-of-accounts-data.js's header for the full reasoning
   on why this module gets the same hierarchy shape, and for the one real
   divergence this file's UI has to carry that Category Master's never
   needed: the Group/Ledger split.

   THE ONE UI IDEA WITH NO CATEGORY-MASTER EQUIVALENT: the Add/Edit form's
   "Account Kind" chips (Group vs. Ledger) show or hide the Opening Balance
   row live — a Group account never carries one (see data file header), so
   there is nothing to show. Parent Account's dropdown is also filtered
   down to Group accounts only (via canAddChild), not just cycle-guarded
   the way Category Master's Parent dropdown is — a Ledger account can
   never be a parent, full stop, regardless of cycles.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime, formatCurrency,
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
  let formKind = "group"; // "group" | "ledger" — drives the Add/Edit form's Opening Balance row


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_ChartOfAccountsRepository.getAllForCompany(company.id);

    if (filterType !== "all") rows = rows.filter((a) => a.accountType === filterType);
    if (filterStatus !== "all") rows = rows.filter((a) => a.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((a) =>
        a.accountName.toLowerCase().includes(term) ||
        String(a.accountCode).toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = String(a.accountCode).localeCompare(String(b.accountCode), undefined, { numeric: true });
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  /** Net opening balance across all Ledger accounts, Debit minus Credit —
      the same sign convention Trial Balance will eventually need, shown
      here early as a preview of whether the books "balance to zero" the
      way a freshly-opened set of books should. */
  function renderSummary() {
    const all = ERP_ChartOfAccountsRepository.getAllForCompany(company.id);
    const ledgers = all.filter((a) => !a.isGroup);
    const netOpening = ledgers.reduce((sum, a) => {
      const amt = Number(a.openingBalance) || 0;
      return sum + (a.openingBalanceType === "Credit" ? -amt : amt);
    }, 0);

    $("#coaSummaryTotal").textContent = String(all.length);
    $("#coaSummaryLedger").textContent = String(ledgers.length);
    $("#coaSummaryGroup").textContent = String(all.filter((a) => a.isGroup).length);
    $("#coaSummaryOpeningBalance").textContent = formatCurrency(netOpening);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#coaPagination");
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

  function parentLabel(a) {
    if (!a.parentAccountId) return `<span class="profile-subtle">— top level —</span>`;
    const parent = ERP_ChartOfAccountsRepository.findById(a.parentAccountId);
    return parent ? escapeHtml(parent.accountName) : `<span class="profile-subtle">—</span>`;
  }

  function kindBadge(a) {
    return a.isGroup
      ? `<span class="status-badge status-badge--warning">Group</span>`
      : `<span class="status-badge status-badge--success">Ledger</span>`;
  }

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#coaEmptyState").hidden = all.length !== 0;
    $("#coaTable").hidden = all.length === 0;

    $("#coaTableBody").innerHTML = pageItems.map((a) => {
      const statusBadge = `<span class="status-badge status-badge--${a.status === "Active" ? "success" : "danger"}">${a.status}</span>`;
      const quickAction = `<button type="button" class="link-btn" data-action="toggle" data-id="${a.id}">${a.status === "Active" ? "Deactivate" : "Reactivate"}</button>`;

      return `
      <tr>
        <td><code>${escapeHtml(a.accountCode)}</code></td>
        <td>${escapeHtml(a.accountName)}</td>
        <td>${escapeHtml(a.accountType)}</td>
        <td>${kindBadge(a)}</td>
        <td>${parentLabel(a)}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${a.id}">View</button>
          ${quickAction}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }


  /* -----------------------------------------------------------------------
     TREE VIEW — always the full hierarchy, ignores filters, same rule
     Category Master's tree follows.
     --------------------------------------------------------------------- */
  function renderTreeNode(acc) {
    const children = ERP_ChartOfAccountsRepository.getChildren(company.id, acc.id);
    const cardClass = acc.status === "Active" ? "" : " dept-tree__card--inactive";

    return `
      <li class="dept-tree__item">
        <div class="dept-tree__card${cardClass}">
          <span class="dept-tree__name">${escapeHtml(acc.accountName)}</span>
          <span class="status-badge status-badge--${acc.status === "Active" ? "success" : "danger"}">${acc.status}</span>
          <div class="dept-tree__meta">
            <span><code>${escapeHtml(acc.accountCode)}</code></span>
            <span>${escapeHtml(acc.accountType)}</span>
            <span>${acc.isGroup ? "Group" : "Ledger"}</span>
          </div>
          <button type="button" class="row-detail-btn" data-id="${acc.id}">View</button>
        </div>
        ${children.length ? `<ul class="dept-tree__children">${children.map(renderTreeNode).join("")}</ul>` : ""}
      </li>`;
  }

  function renderTree() {
    const roots = ERP_ChartOfAccountsRepository.getRootAccounts(company.id);
    $("#coaTreeEmptyState").hidden = roots.length !== 0;
    $("#coaTreeRoot").innerHTML = roots.map(renderTreeNode).join("");
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
    $$("#coaViewToggle .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#coaViewToggle .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        currentView = chip.dataset.view;
        const isTree = currentView === "tree";
        $("#coaTableView").hidden = isTree;
        $("#coaTreeView").hidden = !isTree;
        $("#coaTypeChips").hidden = isTree;
        $("#coaStatusChips").hidden = isTree;
        $("#coaSortBtn").hidden = isTree;
        if (isTree) renderTree();
      });
    });
  }


  /* -----------------------------------------------------------------------
     TOOLBAR: type + status chips, sort, search, export, print
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#coaTypeChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#coaTypeChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterType = chip.dataset.type;
        page = 1;
        renderTable();
      });
    });

    $$("#coaStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#coaStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#coaSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#coaSortBtn").textContent = sortOrder === "asc" ? "Code ↑" : "Code ↓";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#coaExportCsvBtn").addEventListener("click", exportCsv);
    $("#coaPrintBtn").addEventListener("click", printList);

    bindViewToggle();
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Type", "Kind", "Parent Account", "Status", "Opening Balance", "Balance Side", "Description"];
    const csvRows = [header.join(",")];
    rows.forEach((a) => {
      const parent = a.parentAccountId ? (ERP_ChartOfAccountsRepository.findById(a.parentAccountId)?.accountName || "") : "";
      const line = [
        a.accountCode, a.accountName, a.accountType, a.isGroup ? "Group" : "Ledger", parent, a.status,
        a.isGroup ? "" : (Number(a.openingBalance) || 0).toFixed(2),
        a.isGroup ? "" : a.openingBalanceType,
        a.description || ""
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a2 = document.createElement("a");
    a2.href = url; a2.download = `erp-chart-of-accounts-${company.companyCode}.csv`;
    document.body.appendChild(a2); a2.click(); a2.remove();
    URL.revokeObjectURL(url);
    showToast("Chart of Accounts exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((a) => {
      const parent = a.parentAccountId ? (ERP_ChartOfAccountsRepository.findById(a.parentAccountId)?.accountName || "—") : "— top level —";
      return `<tr><td>${escapeHtml(a.accountCode)}</td><td>${escapeHtml(a.accountName)}</td><td>${escapeHtml(a.accountType)}</td><td>${a.isGroup ? "Group" : "Ledger"}</td><td>${escapeHtml(parent)}</td><td>${escapeHtml(a.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Chart of Accounts</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#1E3A8A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Chart of Accounts</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Kind</th><th>Parent Account</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Chart of Accounts")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#coaActivityEmptyState").hidden = relevant.length !== 0;
    $("#coaActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT ACCOUNT MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["coaFormName", "coaFormParent", "coaFormCode", "coaFormKind"].forEach((f) => setFormError(f, ""));
  }

  function populateTypeOptions() {
    $("#coaFormType").innerHTML = ERP_ChartOfAccountsRepository.accountTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
  }

  /** Only Group accounts (via canAddChild), excluding the account itself
      and its own descendants when editing — a Ledger account can never be
      a parent regardless of cycles, and a cycle is impossible to create
      through this list anyway since descendants are never Group-eligible
      ancestors of themselves, but excluding them keeps the dropdown honest
      about what a re-parent would actually do. */
  function populateParentOptions(excludeAccId) {
    const all = ERP_ChartOfAccountsRepository.getAllForCompany(company.id);
    const excluded = new Set();
    if (excludeAccId) {
      excluded.add(excludeAccId);
      ERP_ChartOfAccountsRepository.getDescendants(company.id, excludeAccId).forEach((a) => excluded.add(a.id));
    }
    const options = all.filter((a) => a.isGroup && a.status === "Active" && !excluded.has(a.id));
    $("#coaFormParent").innerHTML = `<option value="">None (top-level account)</option>` +
      options.map((a) => `<option value="${a.id}">${escapeHtml(ERP_ChartOfAccountsRepository.getBreadcrumbLabel(company.id, a.id))}</option>`).join("");
  }

  function setFormKind(kind) {
    formKind = kind;
    $$("#coaFormKindChips .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.kind === kind));
    $("#coaFormOpeningBalanceRow").hidden = kind === "group";
  }

  function refreshCodeSuggestion() {
    if (editingId) return; // never silently overwrite a saved account's own code
    const type = $("#coaFormType").value;
    $("#coaFormCode").value = ERP_ChartOfAccountsRepository.nextAccountCode(company, type);
  }

  function openAddModal(defaultParentId) {
    editingId = null;
    $("#coaFormTitle").textContent = "Add account";
    $("#coaFormIntro").textContent = `Add an account — leave Parent Account unset for a top-level account like "Assets."`;
    $("#coaFormSaveBtn").textContent = "Add Account";
    $("#coaFormName").value = "";
    populateTypeOptions();
    $("#coaFormType").value = "Asset";
    populateParentOptions(null);
    $("#coaFormParent").value = defaultParentId || "";
    // Adding a sub-account under a chosen parent almost always means the
    // trainee is building a Ledger leaf under a Group header they already
    // set up — default to Ledger when a parent is pre-filled, Group
    // otherwise (the natural first move is usually "start a new branch").
    setFormKind(defaultParentId ? "ledger" : "group");
    $("#coaFormOpeningBalance").value = "";
    $("#coaFormOpeningSide").value = "Debit";
    $("#coaFormDescription").value = "";
    clearFormErrors();
    refreshCodeSuggestion();
    openModal("coaFormModal");
  }

  function openEditModal(a) {
    editingId = a.id;
    $("#coaFormTitle").textContent = "Edit account";
    $("#coaFormIntro").textContent = "Update this account's details.";
    $("#coaFormSaveBtn").textContent = "Save Changes";
    $("#coaFormName").value = a.accountName;
    populateTypeOptions();
    $("#coaFormType").value = a.accountType;
    populateParentOptions(a.id);
    $("#coaFormParent").value = a.parentAccountId || "";
    $("#coaFormCode").value = a.accountCode;
    setFormKind(a.isGroup ? "group" : "ledger");
    $("#coaFormOpeningBalance").value = a.isGroup ? "" : (a.openingBalance || 0);
    $("#coaFormOpeningSide").value = a.openingBalanceType || "Debit";
    $("#coaFormDescription").value = a.description || "";
    clearFormErrors();
    openModal("coaFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#coaFormName").value.trim();
    if (!name) { setFormError("coaFormName", "Account name is required."); valid = false; }
    else if (name.length > 60) { setFormError("coaFormName", "Maximum 60 characters allowed."); valid = false; }
    else if (ERP_ChartOfAccountsRepository.isDuplicateName(company.id, name, editingId)) { setFormError("coaFormName", "An account with this name already exists."); valid = false; }

    const code = $("#coaFormCode").value.trim();
    if (!code) { setFormError("coaFormCode", "Account code is required."); valid = false; }
    else if (ERP_ChartOfAccountsRepository.isDuplicateCode(company.id, code, editingId)) { setFormError("coaFormCode", "Another account already uses this code."); valid = false; }

    const parentId = $("#coaFormParent").value || null;
    if (parentId) {
      if (!ERP_ChartOfAccountsRepository.canAddChild(parentId)) {
        setFormError("coaFormParent", "Only an Active Group account can be a parent.");
        valid = false;
      } else if (editingId && ERP_ChartOfAccountsRepository.wouldCreateCycle(company.id, editingId, parentId)) {
        setFormError("coaFormParent", "An account can't be its own ancestor — choose a different parent.");
        valid = false;
      }
    }

    if (editingId && formKind === "ledger") {
      const current = ERP_ChartOfAccountsRepository.findById(editingId);
      if (current && current.isGroup && !ERP_ChartOfAccountsRepository.canToggleGroup(company.id, editingId)) {
        setFormError("coaFormKind", "This Group account has sub-accounts and can't become a Ledger — reassign or remove them first.");
        valid = false;
      }
    }

    return valid;
  }

  function bindFormModal() {
    $("#coaAddBtn").addEventListener("click", () => openAddModal(null));

    $("#coaFormType").addEventListener("change", refreshCodeSuggestion);

    $$("#coaFormKindChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => setFormKind(chip.dataset.kind));
    });

    $("#coaFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const isGroup = formKind === "group";
      const payload = {
        accountName: $("#coaFormName").value.trim(),
        accountType: $("#coaFormType").value,
        parentAccountId: $("#coaFormParent").value || null,
        accountCode: $("#coaFormCode").value.trim(),
        isGroup,
        openingBalance: isGroup ? 0 : (parseFloat($("#coaFormOpeningBalance").value) || 0),
        openingBalanceType: isGroup ? "Debit" : $("#coaFormOpeningSide").value,
        description: $("#coaFormDescription").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this account?",
          message: `"${payload.accountName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_ChartOfAccountsRepository.update(editingId, payload);
            logSystemActivity({ module: "Chart of Accounts", action: "Update", description: `Updated account "${payload.accountName}" for ${company.name}` });
            closeModal("coaFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_ChartOfAccountsRepository.findById(editingId));
            showToast("Account updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this account?",
          message: `"${payload.accountName}" (${payload.accountCode}, ${isGroup ? "Group" : "Ledger"}) will be added.`,
          confirmLabel: "Add Account",
          onConfirm: () => {
            const created = ERP_ChartOfAccountsRepository.create(company, payload);
            logSystemActivity({ module: "Chart of Accounts", action: "Create", description: `Added account "${created.accountName}" (${created.accountCode}) for ${company.name}` });
            closeModal("coaFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.accountName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (two-state: Active / Inactive)
     --------------------------------------------------------------------- */
  function requestToggleStatus(a) {
    const activating = a.status !== "Active";
    let message = activating
      ? `"${a.accountName}" will become Active again.`
      : `"${a.accountName}" will be marked Inactive. It stays on record and can be reactivated any time.`;

    if (!activating) {
      const activeChildren = ERP_ChartOfAccountsRepository.getChildren(company.id, a.id).filter((k) => k.status === "Active");
      if (activeChildren.length) {
        message += ` It has ${activeChildren.length} active sub-account${activeChildren.length > 1 ? "s" : ""} that will remain Active — deactivate them separately if needed.`;
      }
    }

    openConfirm({
      title: activating ? "Reactivate this account?" : "Deactivate this account?",
      message,
      confirmLabel: activating ? "Reactivate" : "Deactivate",
      onConfirm: () => {
        ERP_ChartOfAccountsRepository.toggleStatus(a.id);
        logSystemActivity({ module: "Chart of Accounts", action: activating ? "Reactivate" : "Deactivate", description: `${activating ? "Reactivated" : "Deactivated"} account "${a.accountName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === a.id) openDetailModal(ERP_ChartOfAccountsRepository.findById(a.id));
        showToast(`"${a.accountName}" is now ${activating ? "Active" : "Inactive"}.`, "success");
      }
    });
  }

  /** Refuses up front for either of two real reasons: the account still
      has children (would orphan a subtree), or Journal Entry has posted
      to it (deleting it would corrupt real accounting history — see
      chart-of-accounts-data.js's own header for why that's a hard block
      rather than the graceful-degrade Category Master's own delete
      allows). */
  function requestDelete(a) {
    if (ERP_ChartOfAccountsRepository.hasChildren(company.id, a.id)) {
      showToast(`"${a.accountName}" has sub-accounts and can't be deleted until they're reassigned or removed first.`, "warning", { title: "Can't delete" });
      return;
    }
    if (typeof ERP_JournalEntryRepository !== "undefined" && ERP_JournalEntryRepository.hasPostedEntriesForAccount(company.id, a.id)) {
      showToast(`"${a.accountName}" has posted journal entries against it and can't be deleted — that would corrupt real accounting history. Mark it Inactive instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this account?",
      message: `"${a.accountName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_ChartOfAccountsRepository.remove(a.id, company.id);
        logSystemActivity({ module: "Chart of Accounts", action: "Delete", description: `Deleted account "${a.accountName}" for ${company.name}`, severity: "warning" });
        if (detailId === a.id) closeModal("coaDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${a.accountName}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL — breadcrumb (up), children (down), same drill pattern
     Category Master established.
     --------------------------------------------------------------------- */
  function renderBreadcrumb(a) {
    const ancestors = ERP_ChartOfAccountsRepository.getAncestors(company.id, a.id);
    if (!ancestors.length) { $("#coaDetailBreadcrumb").innerHTML = ""; return; }
    $("#coaDetailBreadcrumb").innerHTML = ancestors
      .map((anc) => `<button type="button" class="link-btn" data-drill-id="${anc.id}">${escapeHtml(anc.accountName)}</button>`)
      .join(' <span class="profile-subtle">/</span> ');
  }

  function renderChildrenList(a) {
    const children = ERP_ChartOfAccountsRepository.getChildren(company.id, a.id);
    $("#coaDetailNoChildren").hidden = children.length !== 0;
    $("#coaDetailChildrenList").innerHTML = children.map((k) => `
      <li class="activity-item">
        <span class="activity-item__icon">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5h9a3 3 0 0 1 3 3V19H7a3 3 0 0 1-3-3V5.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </span>
        <div style="flex:1 1 auto;">
          <p class="activity-item__text">${escapeHtml(k.accountName)} <span class="profile-subtle">(${escapeHtml(k.accountCode)})</span></p>
          <p class="activity-item__time">${k.status} · ${k.isGroup ? "Group" : "Ledger"} · ${escapeHtml(k.accountType)}</p>
        </div>
        <button type="button" class="row-detail-btn" data-drill-id="${k.id}">View</button>
      </li>
    `).join("");
  }

  function renderDetailFooter(a) {
    const footer = $("#coaDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler, disabled) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.disabled = !!disabled;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(a));
    addBtn("+ Add Sub-Account", "btn btn--ghost", () => { closeModal("coaDetailModal"); openAddModal(a.id); }, !a.isGroup);
    addBtn(a.status === "Active" ? "Deactivate" : "Reactivate", "btn btn--ghost", () => requestToggleStatus(a));
    addBtn("Edit", "btn btn--primary", () => { closeModal("coaDetailModal"); openEditModal(a); });
  }

  function openDetailModal(a) {
    detailId = a.id;
    const parent = a.parentAccountId ? ERP_ChartOfAccountsRepository.findById(a.parentAccountId) : null;
    const childCount = ERP_ChartOfAccountsRepository.getChildren(company.id, a.id).length;
    const meta = ERP_ACCOUNT_TYPE_META[a.accountType] || {};

    $("#coaDetailTitle").textContent = `${a.accountName} · ${a.accountCode}`;
    renderBreadcrumb(a);
    $("#coaDetailBody").innerHTML = `
      <div><dt>Account Name</dt><dd>${escapeHtml(a.accountName)}</dd></div>
      <div><dt>Account Code</dt><dd>${escapeHtml(a.accountCode)}</dd></div>
      <div><dt>Account Type</dt><dd>${escapeHtml(a.accountType)}</dd></div>
      <div><dt>Kind</dt><dd>${a.isGroup ? "Group (header)" : "Ledger (postable)"}</dd></div>
      <div><dt>Financial Statement</dt><dd>${escapeHtml(meta.statement || "—")}</dd></div>
      <div><dt>Normal Balance</dt><dd>${escapeHtml(meta.normalBalance || "—")}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${a.status === "Active" ? "success" : "danger"}">${a.status}</span></dd></div>
      <div><dt>Parent Account</dt><dd>${parent ? escapeHtml(parent.accountName) : "— top level —"}</dd></div>
      <div><dt>Sub-Accounts</dt><dd>${childCount}</dd></div>
      ${a.isGroup ? "" : `<div><dt>Opening Balance</dt><dd>${formatCurrency(Number(a.openingBalance) || 0)} ${escapeHtml(a.openingBalanceType)}</dd></div>`}
      <div><dt>Created</dt><dd>${formatDateTime(new Date(a.createdAt))}</dd></div>
      ${a.description ? `<div><dt>Description</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(a.description)}</dd></div>` : ""}
    `;
    renderChildrenList(a);
    renderDetailFooter(a);
    openModal("coaDetailModal");
  }

  function bindDetailModal() {
    $("#coaTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const a = ERP_ChartOfAccountsRepository.findById(viewBtn.dataset.id);
        if (a) openDetailModal(a);
        return;
      }
      if (actionBtn) {
        const a = ERP_ChartOfAccountsRepository.findById(actionBtn.dataset.id);
        if (a) requestToggleStatus(a);
      }
    });

    $("#coaTreeRoot").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const a = ERP_ChartOfAccountsRepository.findById(viewBtn.dataset.id);
      if (a) openDetailModal(a);
    });

    $("#coaDetailModal").addEventListener("click", (e) => {
      const drillBtn = e.target.closest("[data-drill-id]");
      if (!drillBtn) return;
      const a = ERP_ChartOfAccountsRepository.findById(drillBtn.dataset.drillId);
      if (a) openDetailModal(a);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "chart-of-accounts")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading chart of accounts…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#coaContent").hidden = true;
      $("#coaSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#coaContent").hidden = false;
      $("#coaHeaderActions").hidden = false;
      $("#coaSubtitle").textContent = `Managing the chart of accounts for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
