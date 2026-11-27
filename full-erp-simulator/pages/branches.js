/* =============================================================================
   DOT ERP — pages/branches.js
   Phase 2, Module 06: Branches

   Always works against the ACTIVE company. Company Profile owns the single
   registered address; this page keeps the Head Office branch in sync with
   it via ERP_BranchRepository.ensurePrimaryBranch() (read-only here — see
   data/branch-data.js for why this sync works differently from Currency's
   or GST Details' "demote old, create new" pattern). Every other branch is
   independently managed and can optionally link to one of the state-wise
   GST registrations Module 5 built.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity,
    emailPattern: EMAIL_RE
  } = window.ERP;

  const PAGE_SIZE = 6;

  let session = null;
  let company = null;
  let headOffice = null;
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
    let rows = ERP_BranchRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((b) => b.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((b) => b.branchName.toLowerCase().includes(term) || b.city.toLowerCase().includes(term) || b.state.toLowerCase().includes(term));
    }

    const nonPrimary = rows.filter((b) => !b.isPrimary).sort((a, b) => {
      const diff = a.branchName.localeCompare(b.branchName);
      return sortOrder === "desc" ? -diff : diff;
    });
    const primaryRow = rows.find((b) => b.isPrimary);
    return primaryRow ? [primaryRow, ...nonPrimary] : nonPrimary;
  }

  function renderSummary() {
    const all = ERP_BranchRepository.getAllForCompany(company.id);
    $("#brSummaryTotal").textContent = String(all.length);
    $("#brSummaryHeadOffice").textContent = headOffice.city ? `${headOffice.city}, ${headOffice.state}` : "Not set yet";
    $("#brSummaryActive").textContent = String(all.filter((b) => b.status === "Active").length);
    const states = new Set(all.map((b) => b.state).filter(Boolean));
    $("#brSummaryStates").textContent = String(states.size);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#brPagination");
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

  function gstLabelFor(branch) {
    if (!branch.gstRegistrationId) return `<span class="profile-subtle">—</span>`;
    const reg = ERP_GstRepository.findById(branch.gstRegistrationId);
    return reg ? `<code>${escapeHtml(reg.gstin)}</code>` : `<span class="profile-subtle">—</span>`;
  }

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#brEmptyState").hidden = all.length !== 0;
    $("#brTable").hidden = all.length === 0;

    $("#brTableBody").innerHTML = pageItems.map((b) => {
      const statusBadge = b.isPrimary
        ? `<span class="status-badge status-badge--info">Head Office</span>`
        : `<span class="status-badge status-badge--${b.status === "Active" ? "success" : "danger"}">${b.status}</span>`;
      const quickAction = (!b.isPrimary && b.status === "Active")
        ? `<button type="button" class="link-btn" data-action="deactivate" data-id="${b.id}">Deactivate</button>`
        : (!b.isPrimary && b.status === "Inactive")
          ? `<button type="button" class="link-btn" data-action="reactivate" data-id="${b.id}">Reactivate</button>`
          : "";

      return `
      <tr>
        <td><code>${escapeHtml(b.branchCode)}</code></td>
        <td>${escapeHtml(b.branchName)}</td>
        <td>${escapeHtml(b.branchType)}</td>
        <td>${b.city ? `${escapeHtml(b.city)}, ${escapeHtml(b.state)}` : "—"}</td>
        <td>${gstLabelFor(b)}</td>
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
     TOOLBAR: status chips, sort, search, export, print
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#brStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#brStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#brSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#brSortBtn").textContent = sortOrder === "asc" ? "Name A-Z" : "Name Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#brExportCsvBtn").addEventListener("click", exportCsv);
    $("#brPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Type", "City", "State", "GSTIN", "Status", "Contact Person", "Contact Phone"];
    const csvRows = [header.join(",")];
    rows.forEach((b) => {
      const reg = b.gstRegistrationId ? ERP_GstRepository.findById(b.gstRegistrationId) : null;
      const line = [
        b.branchCode, b.branchName, b.branchType, b.city, b.state, reg ? reg.gstin : "",
        b.isPrimary ? "Head Office" : b.status, b.contactPerson || "", b.contactPhone || ""
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-branches-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Branches exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((b) => `<tr><td>${escapeHtml(b.branchCode)}</td><td>${escapeHtml(b.branchName)}</td><td>${escapeHtml(b.branchType)}</td><td>${escapeHtml(b.city)}, ${escapeHtml(b.state)}</td><td>${b.isPrimary ? "Head Office" : b.status}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Branch Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Branch Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Location</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Branches")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#brActivityEmptyState").hidden = relevant.length !== 0;
    $("#brActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT BRANCH MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["brFormName", "brFormAddress1", "brFormCity", "brFormState", "brFormContactEmail"].forEach((f) => setFormError(f, ""));
  }

  function populateGstOptions() {
    const regs = ERP_GstRepository.getAllForCompany(company.id).filter((r) => r.status === "Active");
    $("#brFormGst").innerHTML = `<option value="">Not linked</option>` +
      regs.map((r) => `<option value="${r.id}">${escapeHtml(r.gstin)} — ${escapeHtml(r.state)}</option>`).join("");
  }

  function refreshGstHint() {
    const regId = $("#brFormGst").value;
    const branchState = $("#brFormState").value;
    if (!regId) { $("#brFormGstHint").textContent = ""; return; }
    const reg = ERP_GstRepository.findById(regId);
    if (reg && branchState && reg.state !== branchState) {
      $("#brFormGstHint").textContent = `Note: this registration is for ${reg.state}, not ${branchState} — that's allowed, but worth double-checking.`;
    } else {
      $("#brFormGstHint").textContent = "";
    }
  }

  function openAddModal() {
    editingId = null;
    $("#brFormTitle").textContent = "Add branch";
    $("#brFormIntro").textContent = "Add a location beyond your Head Office — a warehouse, sales office, or regional branch.";
    $("#brFormSaveBtn").textContent = "Add Branch";
    $("#brFormType").innerHTML = ERP_BranchRepository.branchTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
    $("#brFormName").value = "";
    $("#brFormAddress1").value = "";
    $("#brFormAddress2").value = "";
    $("#brFormCity").value = "";
    $("#brFormState").value = "";
    $("#brFormPincode").value = "";
    $("#brFormContactPerson").value = "";
    $("#brFormContactPhone").value = "";
    $("#brFormContactEmail").value = "";
    populateGstOptions();
    $("#brFormGst").value = "";
    clearFormErrors();
    refreshGstHint();
    openModal("brFormModal");
  }

  function openEditModal(branch) {
    editingId = branch.id;
    $("#brFormTitle").textContent = "Edit branch";
    $("#brFormIntro").textContent = "Update this branch's details.";
    $("#brFormSaveBtn").textContent = "Save Changes";
    $("#brFormType").innerHTML = ERP_BranchRepository.branchTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
    $("#brFormName").value = branch.branchName;
    $("#brFormType").value = branch.branchType;
    $("#brFormAddress1").value = branch.address1 || "";
    $("#brFormAddress2").value = branch.address2 || "";
    $("#brFormCity").value = branch.city || "";
    $("#brFormState").value = branch.state || "";
    $("#brFormPincode").value = branch.pincode || "";
    $("#brFormContactPerson").value = branch.contactPerson || "";
    $("#brFormContactPhone").value = branch.contactPhone || "";
    $("#brFormContactEmail").value = branch.contactEmail || "";
    populateGstOptions();
    $("#brFormGst").value = branch.gstRegistrationId || "";
    clearFormErrors();
    refreshGstHint();
    openModal("brFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#brFormName").value.trim();
    if (!name) { setFormError("brFormName", "Branch name is required."); valid = false; }
    else if (name.length > 60) { setFormError("brFormName", "Maximum 60 characters allowed."); valid = false; }
    else if (ERP_BranchRepository.hasDuplicateName(company.id, name, editingId)) { setFormError("brFormName", "Another branch already uses this name."); valid = false; }

    if (!$("#brFormAddress1").value.trim()) { setFormError("brFormAddress1", "Address line 1 is required."); valid = false; }
    if (!$("#brFormCity").value.trim()) { setFormError("brFormCity", "City is required."); valid = false; }
    if (!$("#brFormState").value) { setFormError("brFormState", "State is required."); valid = false; }

    const email = $("#brFormContactEmail").value.trim();
    if (email && !EMAIL_RE.test(email)) { setFormError("brFormContactEmail", "Enter a valid email address."); valid = false; }

    return valid;
  }

  function bindFormModal() {
    $("#brAddBtn").addEventListener("click", openAddModal);
    $("#brFormState").addEventListener("change", refreshGstHint);
    $("#brFormGst").addEventListener("change", refreshGstHint);

    $("#brFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        branchName: $("#brFormName").value.trim(),
        branchType: $("#brFormType").value,
        address1: $("#brFormAddress1").value.trim(),
        address2: $("#brFormAddress2").value.trim(),
        city: $("#brFormCity").value.trim(),
        state: $("#brFormState").value,
        pincode: $("#brFormPincode").value.trim(),
        gstRegistrationId: $("#brFormGst").value || null,
        contactPerson: $("#brFormContactPerson").value.trim(),
        contactPhone: $("#brFormContactPhone").value.trim(),
        contactEmail: $("#brFormContactEmail").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this branch?",
          message: `"${payload.branchName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_BranchRepository.update(editingId, payload);
            logSystemActivity({ module: "Branches", action: "Update", description: `Updated branch "${payload.branchName}" for ${company.name}` });
            closeModal("brFormModal");
            renderAll();
            renderActivity();
            showToast("Branch updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this branch?",
          message: `"${payload.branchName}" (${payload.branchType}) in ${payload.city}, ${payload.state} will be added.`,
          confirmLabel: "Add Branch",
          onConfirm: () => {
            const created = ERP_BranchRepository.create(company, payload);
            logSystemActivity({ module: "Branches", action: "Create", description: `Added branch "${created.branchName}" (${created.branchCode}) for ${company.name}` });
            closeModal("brFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.branchName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (toggle status / delete)
     --------------------------------------------------------------------- */
  function requestToggleStatus(branch) {
    const activating = branch.status !== "Active";
    openConfirm({
      title: activating ? "Reactivate this branch?" : "Deactivate this branch?",
      message: activating
        ? `"${branch.branchName}" will become Active again.`
        : `"${branch.branchName}" will be marked Inactive. It stays on record and can be reactivated any time.`,
      confirmLabel: activating ? "Reactivate" : "Deactivate",
      onConfirm: () => {
        ERP_BranchRepository.toggleStatus(branch.id);
        logSystemActivity({ module: "Branches", action: activating ? "Reactivate" : "Deactivate", description: `${activating ? "Reactivated" : "Deactivated"} branch "${branch.branchName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === branch.id) openDetailModal(ERP_BranchRepository.findById(branch.id));
        showToast(`"${branch.branchName}" is now ${activating ? "Active" : "Inactive"}.`, "success");
      }
    });
  }

  function requestDelete(branch) {
    openConfirm({
      title: "Delete this branch?",
      message: `"${branch.branchName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_BranchRepository.remove(branch.id);
        logSystemActivity({ module: "Branches", action: "Delete", description: `Deleted branch "${branch.branchName}" for ${company.name}`, severity: "warning" });
        if (detailId === branch.id) closeModal("brDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${branch.branchName}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(branch) {
    const footer = $("#brDetailFooter");
    footer.innerHTML = "";

    if (branch.isPrimary) {
      const note = document.createElement("p");
      note.className = "field-hint";
      note.textContent = "This is your Head Office — its address always mirrors Company Profile automatically. Edit it there, not here.";
      footer.appendChild(note);
      const link = document.createElement("a");
      link.href = "company-profile.html";
      link.className = "btn btn--primary";
      link.textContent = "Go to Company Profile";
      footer.appendChild(link);
      return;
    }

    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(branch));
    addBtn(branch.status === "Active" ? "Deactivate" : "Reactivate", "btn btn--ghost", () => requestToggleStatus(branch));
    addBtn("Edit", "btn btn--primary", () => { closeModal("brDetailModal"); openEditModal(branch); });
  }

  function openDetailModal(branch) {
    detailId = branch.id;
    $("#brDetailTitle").textContent = `${branch.branchName} · ${branch.branchCode}`;
    const reg = branch.gstRegistrationId ? ERP_GstRepository.findById(branch.gstRegistrationId) : null;
    $("#brDetailBody").innerHTML = `
      <div><dt>Branch Name</dt><dd>${escapeHtml(branch.branchName)}</dd></div>
      <div><dt>Branch Code</dt><dd>${escapeHtml(branch.branchCode)}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(branch.branchType)}</dd></div>
      <div><dt>Status</dt><dd>${branch.isPrimary ? `<span class="status-badge status-badge--info">Head Office</span>` : `<span class="status-badge status-badge--${branch.status === "Active" ? "success" : "danger"}">${branch.status}</span>`}</dd></div>
      <div><dt>Address</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(branch.address1 || "")}${branch.address2 ? ", " + escapeHtml(branch.address2) : ""}, ${escapeHtml(branch.city || "")}, ${escapeHtml(branch.state || "")} ${escapeHtml(branch.pincode || "")}</dd></div>
      <div><dt>GST Registration</dt><dd>${reg ? `${escapeHtml(reg.gstin)} (${escapeHtml(reg.state)})` : "—"}</dd></div>
      <div><dt>Contact Person</dt><dd>${escapeHtml(branch.contactPerson || "—")}</dd></div>
      <div><dt>Contact Phone</dt><dd>${escapeHtml(branch.contactPhone || "—")}</dd></div>
      <div><dt>Contact Email</dt><dd>${escapeHtml(branch.contactEmail || "—")}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(branch.createdAt))}</dd></div>
    `;
    renderDetailFooter(branch);
    openModal("brDetailModal");
  }

  function bindDetailModal() {
    $("#brTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");

      if (viewBtn) {
        const branch = ERP_BranchRepository.findById(viewBtn.dataset.id);
        if (branch) openDetailModal(branch);
        return;
      }
      if (actionBtn) {
        const branch = ERP_BranchRepository.findById(actionBtn.dataset.id);
        if (branch) requestToggleStatus(branch);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "branches")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading branches…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#brContent").hidden = true;
      $("#brSubtitle").textContent = "No active company yet.";
    } else {
      headOffice = ERP_BranchRepository.ensurePrimaryBranch(company);
      $("#noCompanyState").hidden = true;
      $("#brContent").hidden = false;
      $("#brHeaderActions").hidden = false;
      $("#brSubtitle").textContent = `Managing branches for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
