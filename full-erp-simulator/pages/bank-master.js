/* =============================================================================
   DOT ERP — pages/bank-master.js
   Phase 3, Module 10: Bank Master (final Phase 3 module)

   Flat list, same complexity tier as Tax Master / Payment Terms. See
   data/bank-data.js's header for why this module is a deliberate exception
   to the "cross-module references never hard-block" convention (its
   delete guard checks Vendor Master), and for the IFSC pattern ownership
   move from Vendor Master to here.
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


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_BankRepository.getAllForCompany(company.id);

    if (filterType !== "all") rows = rows.filter((b) => b.accountType === filterType);
    if (filterStatus !== "all") rows = rows.filter((b) => b.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((b) =>
        b.bankName.toLowerCase().includes(term) ||
        b.bankCode.toLowerCase().includes(term) ||
        b.accountNumber.toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.bankName.localeCompare(b.bankName);
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  function renderSummary() {
    const all = ERP_BankRepository.getAllForCompany(company.id);
    $("#bankSummaryTotal").textContent = String(all.length);
    $("#bankSummaryActive").textContent = String(all.filter((b) => b.status === "Active").length);
    $("#bankSummaryLinked").textContent = String(all.filter((b) => ERP_BankRepository.isLinkedByVendor(company.id, b.id)).length);
    const def = ERP_BankRepository.getDefault(company.id);
    $("#bankSummaryDefault").textContent = def ? def.bankName : "— none set —";
  }


  /* -----------------------------------------------------------------------
     TYPE CHIPS (built from the fixed reference list)
     --------------------------------------------------------------------- */
  function buildTypeChips() {
    const container = $("#bankTypeChips");
    const extra = ERP_BankRepository.accountTypes.map((type) =>
      `<button type="button" class="chip" data-type="${escapeHtml(type)}">${escapeHtml(type)}</button>`
    ).join("");
    container.insertAdjacentHTML("beforeend", extra);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#bankPagination");
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

    $("#bankEmptyState").hidden = all.length !== 0;
    $("#bankTable").hidden = all.length === 0;

    $("#bankTableBody").innerHTML = pageItems.map((b) => {
      const statusBadge = `<span class="status-badge status-badge--${b.status === "Active" ? "success" : "danger"}">${b.status}</span>`;
      const quickAction = `<button type="button" class="link-btn" data-action="toggle" data-id="${b.id}">${b.status === "Active" ? "Deactivate" : "Reactivate"}</button>`;
      const defaultBadge = b.isDefault ? `<span class="status-badge status-badge--info">Default</span>` : `<span class="profile-subtle">—</span>`;
      const last4 = String(b.accountNumber || "").slice(-4).padStart(4, "•");

      return `
      <tr>
        <td><code>${escapeHtml(b.bankCode)}</code></td>
        <td>${escapeHtml(b.bankName)}</td>
        <td>•••• ${escapeHtml(last4)}</td>
        <td>${escapeHtml(b.accountType)}</td>
        <td><code>${escapeHtml(b.ifscCode)}</code></td>
        <td>${defaultBadge}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${b.id}">View</button>
          ${quickAction}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#bankTypeChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#bankTypeChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterType = chip.dataset.type;
        page = 1;
        renderTable();
      });
    });

    $$("#bankStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#bankStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#bankSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#bankSortBtn").textContent = sortOrder === "asc" ? "Name A-Z" : "Name Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#bankExportCsvBtn").addEventListener("click", exportCsv);
    $("#bankPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Bank Name", "Account Holder", "Account Number", "Type", "IFSC", "Branch", "UPI", "Default", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((b) => {
      const line = [b.bankCode, b.bankName, b.accountHolderName, b.accountNumber, b.accountType, b.ifscCode, b.branchName || "", b.upiId || "", b.isDefault ? "Yes" : "No", b.status]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-bank-accounts-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Bank accounts exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((b) => {
      const last4 = String(b.accountNumber || "").slice(-4).padStart(4, "•");
      return `<tr><td>${escapeHtml(b.bankCode)}</td><td>${escapeHtml(b.bankName)}</td><td>•••• ${escapeHtml(last4)}</td><td>${escapeHtml(b.accountType)}</td><td>${escapeHtml(b.ifscCode)}</td><td>${b.isDefault ? "Yes" : ""}</td><td>${escapeHtml(b.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Bank Account Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Bank Account Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s) · account numbers masked</p>
        <table><thead><tr><th>Code</th><th>Bank</th><th>Account</th><th>Type</th><th>IFSC</th><th>Default</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Bank Master")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#bankActivityEmptyState").hidden = relevant.length !== 0;
    $("#bankActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT BANK ACCOUNT MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["bankFormName", "bankFormAccountHolder", "bankFormAccountNumber", "bankFormIfsc"].forEach((f) => setFormError(f, ""));
  }

  function populateTypeOptions() {
    $("#bankFormAccountType").innerHTML = ERP_BankRepository.accountTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
  }

  /** Only Active, postable Ledger accounts — the same "Group accounts
      can never be posted to" rule Journal Entry's own account picker
      enforces, since this field exists purely so gl-posting-data.js can
      find a real postable account for this bank. */
  function populateLinkedAccountOptions(currentId) {
    let accounts = typeof ERP_ChartOfAccountsRepository !== "undefined" ? ERP_ChartOfAccountsRepository.getPostableForCompany(company.id) : [];
    if (currentId && !accounts.some((a) => a.id === currentId)) {
      const current = ERP_ChartOfAccountsRepository.findById(currentId);
      if (current) accounts = [...accounts, current];
    }
    $("#bankFormLinkedAccount").innerHTML = `<option value="">Not linked</option>` +
      accounts.map((a) => `<option value="${a.id}">${escapeHtml(ERP_ChartOfAccountsRepository.getBreadcrumbLabel(company.id, a.id))}</option>`).join("");
  }

  function openAddModal() {
    editingId = null;
    $("#bankFormTitle").textContent = "Add bank account";
    $("#bankFormIntro").textContent = "Add a company bank account other modules can link to.";
    $("#bankFormSaveBtn").textContent = "Add Bank Account";
    $("#bankFormName").value = "";
    populateTypeOptions();
    $("#bankFormAccountHolder").value = company.name || "";
    $("#bankFormAccountNumber").value = "";
    $("#bankFormIfsc").value = "";
    $("#bankFormBranch").value = "";
    $("#bankFormUpi").value = "";
    populateLinkedAccountOptions(null);
    $("#bankFormIsDefault").checked = ERP_BankRepository.getAllForCompany(company.id).length === 0;
    $("#bankFormDescription").value = "";
    clearFormErrors();
    openModal("bankFormModal");
  }

  function openEditModal(b) {
    editingId = b.id;
    $("#bankFormTitle").textContent = "Edit bank account";
    $("#bankFormIntro").textContent = "Update this bank account's details.";
    $("#bankFormSaveBtn").textContent = "Save Changes";
    $("#bankFormName").value = b.bankName;
    populateTypeOptions();
    $("#bankFormAccountType").value = b.accountType;
    $("#bankFormAccountHolder").value = b.accountHolderName || "";
    $("#bankFormAccountNumber").value = b.accountNumber;
    $("#bankFormIfsc").value = b.ifscCode;
    $("#bankFormBranch").value = b.branchName || "";
    $("#bankFormUpi").value = b.upiId || "";
    populateLinkedAccountOptions(b.linkedAccountId);
    $("#bankFormLinkedAccount").value = b.linkedAccountId || "";
    $("#bankFormIsDefault").checked = !!b.isDefault;
    $("#bankFormDescription").value = b.description || "";
    clearFormErrors();
    openModal("bankFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#bankFormName").value.trim();
    if (!name) { setFormError("bankFormName", "Bank name is required."); valid = false; }
    else if (name.length > 60) { setFormError("bankFormName", "Maximum 60 characters allowed."); valid = false; }

    const holder = $("#bankFormAccountHolder").value.trim();
    if (!holder) { setFormError("bankFormAccountHolder", "Account holder name is required."); valid = false; }

    const acct = $("#bankFormAccountNumber").value.trim();
    if (!acct) { setFormError("bankFormAccountNumber", "Account number is required."); valid = false; }
    else if (ERP_BankRepository.hasDuplicateAccountNumber(company.id, acct, editingId)) { setFormError("bankFormAccountNumber", "This account number is already on record."); valid = false; }

    const ifsc = $("#bankFormIfsc").value.trim().toUpperCase();
    if (!ifsc) { setFormError("bankFormIfsc", "IFSC code is required."); valid = false; }
    else if (!ERP_BankRepository.ifscPattern.test(ifsc)) { setFormError("bankFormIfsc", "That doesn't look like a valid IFSC code (e.g. HDFC0001234)."); valid = false; }

    return valid;
  }

  function bindFormModal() {
    $("#bankAddBtn").addEventListener("click", openAddModal);

    $("#bankFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        bankName: $("#bankFormName").value.trim(),
        accountType: $("#bankFormAccountType").value,
        accountHolderName: $("#bankFormAccountHolder").value.trim(),
        accountNumber: $("#bankFormAccountNumber").value.trim(),
        ifscCode: $("#bankFormIfsc").value.trim().toUpperCase(),
        branchName: $("#bankFormBranch").value.trim(),
        upiId: $("#bankFormUpi").value.trim(),
        linkedAccountId: $("#bankFormLinkedAccount").value || null,
        isDefault: $("#bankFormIsDefault").checked,
        description: $("#bankFormDescription").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this bank account?",
          message: `"${payload.bankName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_BankRepository.update(editingId, payload);
            logSystemActivity({ module: "Bank Master", action: "Update", description: `Updated bank account "${payload.bankName}" for ${company.name}` });
            closeModal("bankFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_BankRepository.findById(editingId));
            showToast("Bank account updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this bank account?",
          message: `"${payload.bankName}" will be added.`,
          confirmLabel: "Add Bank Account",
          onConfirm: () => {
            const created = ERP_BankRepository.create(company, payload);
            logSystemActivity({ module: "Bank Master", action: "Create", description: `Added bank account "${created.bankName}" (${created.bankCode}) for ${company.name}` });
            closeModal("bankFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.bankName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (two-state: Active / Inactive)
     --------------------------------------------------------------------- */
  function requestToggleStatus(b) {
    const activating = b.status !== "Active";
    const message = activating
      ? `"${b.bankName}" will become Active again.`
      : `"${b.bankName}" will be marked Inactive. It stays on record — and any vendor still linked to it stays linked — but won't be offered for new links.`;

    openConfirm({
      title: activating ? "Reactivate this account?" : "Deactivate this account?",
      message,
      confirmLabel: activating ? "Reactivate" : "Deactivate",
      onConfirm: () => {
        ERP_BankRepository.toggleStatus(b.id);
        logSystemActivity({ module: "Bank Master", action: activating ? "Reactivate" : "Deactivate", description: `${activating ? "Reactivated" : "Deactivated"} bank account "${b.bankName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === b.id) openDetailModal(ERP_BankRepository.findById(b.id));
        showToast(`"${b.bankName}" is now ${activating ? "Active" : "Inactive"}.`, "success");
      }
    });
  }

  /** Refuses up front if a vendor still links to this account — the one
      hard delete-guard exception documented in data/bank-data.js's header. */
  function requestDelete(b) {
    if (ERP_BankRepository.isLinkedByVendor(company.id, b.id)) {
      showToast(`"${b.bankName}" is linked by at least one vendor and can't be deleted until that link is removed first.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this bank account?",
      message: `"${b.bankName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_BankRepository.remove(b.id, company.id);
        logSystemActivity({ module: "Bank Master", action: "Delete", description: `Deleted bank account "${b.bankName}" for ${company.name}`, severity: "warning" });
        if (detailId === b.id) closeModal("bankDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${b.bankName}" deleted.`, "info");
      }
    });
  }

  function requestSetDefault(b) {
    openConfirm({
      title: "Set as default bank account?",
      message: `"${b.bankName}" will become the company's default bank account, replacing whichever one was set before.`,
      confirmLabel: "Set Default",
      onConfirm: () => {
        ERP_BankRepository.setDefault(b.id, company.id);
        logSystemActivity({ module: "Bank Master", action: "Update", description: `Set "${b.bankName}" as the default bank account for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === b.id) openDetailModal(ERP_BankRepository.findById(b.id));
        showToast(`"${b.bankName}" is now the default bank account.`, "success");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(b) {
    const footer = $("#bankDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(b));
    if (!b.isDefault) addBtn("Set as Default", "btn btn--ghost", () => requestSetDefault(b));
    addBtn(b.status === "Active" ? "Deactivate" : "Reactivate", "btn btn--ghost", () => requestToggleStatus(b));
    addBtn("Edit", "btn btn--primary", () => { closeModal("bankDetailModal"); openEditModal(b); });
  }

  function openDetailModal(b) {
    detailId = b.id;
    const linkedCount = ERP_VendorRepository.getAllForCompany(company.id).filter((v) => v.bankId === b.id).length;

    $("#bankDetailTitle").textContent = `${b.bankName} · ${b.bankCode}`;
    $("#bankDetailBody").innerHTML = `
      <div><dt>Bank Name</dt><dd>${escapeHtml(b.bankName)}</dd></div>
      <div><dt>Bank Code</dt><dd>${escapeHtml(b.bankCode)}</dd></div>
      <div><dt>Account Holder</dt><dd>${escapeHtml(b.accountHolderName || "—")}</dd></div>
      <div><dt>Account Number</dt><dd>${escapeHtml(b.accountNumber)}</dd></div>
      <div><dt>Account Type</dt><dd>${escapeHtml(b.accountType)}</dd></div>
      <div><dt>IFSC Code</dt><dd><code>${escapeHtml(b.ifscCode)}</code></dd></div>
      <div><dt>Branch</dt><dd>${b.branchName ? escapeHtml(b.branchName) : "—"}</dd></div>
      <div><dt>UPI ID</dt><dd>${b.upiId ? escapeHtml(b.upiId) : "—"}</dd></div>
      <div><dt>Linked Ledger Account</dt><dd>${b.linkedAccountId && typeof ERP_ChartOfAccountsRepository !== "undefined" && ERP_ChartOfAccountsRepository.findById(b.linkedAccountId) ? escapeHtml(ERP_ChartOfAccountsRepository.getBreadcrumbLabel(company.id, b.linkedAccountId)) : "— not linked —"}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${b.status === "Active" ? "success" : "danger"}">${b.status}</span></dd></div>
      <div><dt>Default</dt><dd>${b.isDefault ? "Yes" : "No"}</dd></div>
      <div><dt>Linked Vendors</dt><dd>${linkedCount}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(b.createdAt))}</dd></div>
      ${b.description ? `<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(b.description)}</dd></div>` : ""}
    `;
    renderDetailFooter(b);
    openModal("bankDetailModal");
  }

  function bindDetailModal() {
    $("#bankTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const b = ERP_BankRepository.findById(viewBtn.dataset.id);
        if (b) openDetailModal(b);
        return;
      }
      if (actionBtn) {
        const b = ERP_BankRepository.findById(actionBtn.dataset.id);
        if (b) requestToggleStatus(b);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "bank-master")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading bank accounts…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#bankContent").hidden = true;
      $("#bankSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#bankContent").hidden = false;
      $("#bankHeaderActions").hidden = false;
      $("#bankSubtitle").textContent = `Managing bank accounts for ${company.name} (${company.companyCode}).`;
      buildTypeChips();
      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
