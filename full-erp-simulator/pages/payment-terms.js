/* =============================================================================
   DOT ERP — pages/payment-terms.js
   Phase 3, Module 09: Payment Terms

   Flat list, same complexity tier as Tax Master. See data/payment-terms-
   data.js's header for why this is safe to share between Vendor Master's
   AP terms and Customer Master's AR credit period despite Section 9's
   direction warning, and why that retrofit is deferred rather than done here.
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
    let rows = ERP_PaymentTermsRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((t) => t.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((t) =>
        t.termName.toLowerCase().includes(term) ||
        t.termCode.toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.days - b.days;
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  function renderSummary() {
    const all = ERP_PaymentTermsRepository.getAllForCompany(company.id);
    $("#ptSummaryTotal").textContent = String(all.length);
    $("#ptSummaryActive").textContent = String(all.filter((t) => t.status === "Active").length);
    const shortest = all.slice().sort((a, b) => a.days - b.days)[0];
    $("#ptSummaryShortest").textContent = shortest ? shortest.termName : "—";
    const def = ERP_PaymentTermsRepository.getDefault(company.id);
    $("#ptSummaryDefault").textContent = def ? def.termName : "— none set —";
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#ptPagination");
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

    $("#ptEmptyState").hidden = all.length !== 0;
    $("#ptTable").hidden = all.length === 0;

    $("#ptTableBody").innerHTML = pageItems.map((t) => {
      const statusBadge = `<span class="status-badge status-badge--${t.status === "Active" ? "success" : "danger"}">${t.status}</span>`;
      const quickAction = `<button type="button" class="link-btn" data-action="toggle" data-id="${t.id}">${t.status === "Active" ? "Deactivate" : "Reactivate"}</button>`;
      const defaultBadge = t.isDefault ? `<span class="status-badge status-badge--info">Default</span>` : `<span class="profile-subtle">—</span>`;

      return `
      <tr>
        <td><code>${escapeHtml(t.termCode)}</code></td>
        <td>${escapeHtml(t.termName)}</td>
        <td class="profile-subtle">${escapeHtml(ERP_PaymentTermsRepository.describeTerm(t))}</td>
        <td>${defaultBadge}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${t.id}">View</button>
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
    $$("#ptStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#ptStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#ptSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#ptSortBtn").textContent = sortOrder === "asc" ? "Days Low-High" : "Days High-Low";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#ptExportCsvBtn").addEventListener("click", exportCsv);
    $("#ptPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Days", "Advance %", "Default", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((t) => {
      const line = [t.termCode, t.termName, t.days, t.advancePct || 0, t.isDefault ? "Yes" : "No", t.status]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-payment-terms-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Payment terms exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((t) => `<tr><td>${escapeHtml(t.termCode)}</td><td>${escapeHtml(t.termName)}</td><td>${escapeHtml(ERP_PaymentTermsRepository.describeTerm(t))}</td><td>${t.isDefault ? "Yes" : ""}</td><td>${escapeHtml(t.status)}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Payment Terms Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Payment Terms Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Terms</th><th>Default</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Payment Terms")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#ptActivityEmptyState").hidden = relevant.length !== 0;
    $("#ptActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT PAYMENT TERM MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["ptFormName", "ptFormDays", "ptFormAdvance"].forEach((f) => setFormError(f, ""));
  }

  function updatePreview() {
    const days = parseFloat($("#ptFormDays").value);
    const advancePct = parseFloat($("#ptFormAdvance").value) || 0;
    if (isNaN(days)) { $("#ptFormPreview").textContent = ""; return; }
    $("#ptFormPreview").textContent = ERP_PaymentTermsRepository.describeTerm({ days, advancePct });
  }

  function openAddModal() {
    editingId = null;
    $("#ptFormTitle").textContent = "Add payment term";
    $("#ptFormIntro").textContent = "Add a named, reusable payment term template.";
    $("#ptFormSaveBtn").textContent = "Add Payment Term";
    $("#ptFormName").value = "";
    $("#ptFormDays").value = "30";
    $("#ptFormAdvance").value = "0";
    $("#ptFormIsDefault").checked = ERP_PaymentTermsRepository.getAllForCompany(company.id).length === 0;
    $("#ptFormDescription").value = "";
    clearFormErrors();
    updatePreview();
    openModal("ptFormModal");
  }

  function openEditModal(t) {
    editingId = t.id;
    $("#ptFormTitle").textContent = "Edit payment term";
    $("#ptFormIntro").textContent = "Update this payment term's details.";
    $("#ptFormSaveBtn").textContent = "Save Changes";
    $("#ptFormName").value = t.termName;
    $("#ptFormDays").value = String(t.days);
    $("#ptFormAdvance").value = String(t.advancePct || 0);
    $("#ptFormIsDefault").checked = !!t.isDefault;
    $("#ptFormDescription").value = t.description || "";
    clearFormErrors();
    updatePreview();
    openModal("ptFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#ptFormName").value.trim();
    if (!name) { setFormError("ptFormName", "Term name is required."); valid = false; }
    else if (name.length > 60) { setFormError("ptFormName", "Maximum 60 characters allowed."); valid = false; }
    else if (ERP_PaymentTermsRepository.hasDuplicateName(company.id, name, editingId)) { setFormError("ptFormName", "A payment term with this name already exists."); valid = false; }

    const days = $("#ptFormDays").value;
    if (days === "" || isNaN(parseFloat(days)) || parseFloat(days) < 0) { setFormError("ptFormDays", "Enter a number 0 or greater."); valid = false; }

    const advance = $("#ptFormAdvance").value;
    if (advance !== "" && (isNaN(parseFloat(advance)) || parseFloat(advance) < 0 || parseFloat(advance) > 100)) {
      setFormError("ptFormAdvance", "Enter a percentage between 0 and 100."); valid = false;
    }

    return valid;
  }

  function bindFormModal() {
    $("#ptAddBtn").addEventListener("click", openAddModal);
    $("#ptFormDays").addEventListener("input", updatePreview);
    $("#ptFormAdvance").addEventListener("input", updatePreview);

    $("#ptFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        termName: $("#ptFormName").value.trim(),
        days: parseFloat($("#ptFormDays").value) || 0,
        advancePct: parseFloat($("#ptFormAdvance").value) || 0,
        isDefault: $("#ptFormIsDefault").checked,
        description: $("#ptFormDescription").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this payment term?",
          message: `"${payload.termName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_PaymentTermsRepository.update(editingId, payload);
            logSystemActivity({ module: "Payment Terms", action: "Update", description: `Updated payment term "${payload.termName}" for ${company.name}` });
            closeModal("ptFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_PaymentTermsRepository.findById(editingId));
            showToast("Payment term updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this payment term?",
          message: `"${payload.termName}" will be added.`,
          confirmLabel: "Add Payment Term",
          onConfirm: () => {
            const created = ERP_PaymentTermsRepository.create(company, payload);
            logSystemActivity({ module: "Payment Terms", action: "Create", description: `Added payment term "${created.termName}" (${created.termCode}) for ${company.name}` });
            closeModal("ptFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.termName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (two-state: Active / Inactive)
     --------------------------------------------------------------------- */
  function requestToggleStatus(t) {
    const activating = t.status !== "Active";
    const message = activating
      ? `"${t.termName}" will become Active again.`
      : `"${t.termName}" will be marked Inactive. It stays on record and can be reactivated any time.`;

    openConfirm({
      title: activating ? "Reactivate this payment term?" : "Deactivate this payment term?",
      message,
      confirmLabel: activating ? "Reactivate" : "Deactivate",
      onConfirm: () => {
        ERP_PaymentTermsRepository.toggleStatus(t.id);
        logSystemActivity({ module: "Payment Terms", action: activating ? "Reactivate" : "Deactivate", description: `${activating ? "Reactivated" : "Deactivated"} payment term "${t.termName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === t.id) openDetailModal(ERP_PaymentTermsRepository.findById(t.id));
        showToast(`"${t.termName}" is now ${activating ? "Active" : "Inactive"}.`, "success");
      }
    });
  }

  function requestDelete(t) {
    openConfirm({
      title: "Delete this payment term?",
      message: `"${t.termName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_PaymentTermsRepository.remove(t.id);
        logSystemActivity({ module: "Payment Terms", action: "Delete", description: `Deleted payment term "${t.termName}" for ${company.name}`, severity: "warning" });
        if (detailId === t.id) closeModal("ptDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${t.termName}" deleted.`, "info");
      }
    });
  }

  function requestSetDefault(t) {
    openConfirm({
      title: "Set as default payment term?",
      message: `"${t.termName}" will become the company's default payment term, replacing whichever one was set before.`,
      confirmLabel: "Set Default",
      onConfirm: () => {
        ERP_PaymentTermsRepository.setDefault(t.id, company.id);
        logSystemActivity({ module: "Payment Terms", action: "Update", description: `Set "${t.termName}" as the default payment term for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === t.id) openDetailModal(ERP_PaymentTermsRepository.findById(t.id));
        showToast(`"${t.termName}" is now the default payment term.`, "success");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(t) {
    const footer = $("#ptDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(t));
    if (!t.isDefault) addBtn("Set as Default", "btn btn--ghost", () => requestSetDefault(t));
    addBtn(t.status === "Active" ? "Deactivate" : "Reactivate", "btn btn--ghost", () => requestToggleStatus(t));
    addBtn("Edit", "btn btn--primary", () => { closeModal("ptDetailModal"); openEditModal(t); });
  }

  function openDetailModal(t) {
    detailId = t.id;
    const sampleDue = ERP_PaymentTermsRepository.getDueDate(t, new Date().toISOString());

    $("#ptDetailTitle").textContent = `${t.termName} · ${t.termCode}`;
    $("#ptDetailBody").innerHTML = `
      <div><dt>Term Name</dt><dd>${escapeHtml(t.termName)}</dd></div>
      <div><dt>Term Code</dt><dd>${escapeHtml(t.termCode)}</dd></div>
      <div><dt>Days</dt><dd>${t.days}</dd></div>
      <div><dt>Advance %</dt><dd>${t.advancePct || 0}%</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${t.status === "Active" ? "success" : "danger"}">${t.status}</span></dd></div>
      <div><dt>Default</dt><dd>${t.isDefault ? "Yes" : "No"}</dd></div>
      <div><dt>If invoiced today</dt><dd>Balance due ${escapeHtml(sampleDue || "—")}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(t.createdAt))}</dd></div>
      ${t.description ? `<div><dt>Description</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(t.description)}</dd></div>` : ""}
    `;
    renderDetailFooter(t);
    openModal("ptDetailModal");
  }

  function bindDetailModal() {
    $("#ptTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const t = ERP_PaymentTermsRepository.findById(viewBtn.dataset.id);
        if (t) openDetailModal(t);
        return;
      }
      if (actionBtn) {
        const t = ERP_PaymentTermsRepository.findById(actionBtn.dataset.id);
        if (t) requestToggleStatus(t);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "payment-terms")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading payment terms…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#ptContent").hidden = true;
      $("#ptSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#ptContent").hidden = false;
      $("#ptHeaderActions").hidden = false;
      $("#ptSubtitle").textContent = `Managing payment terms for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
