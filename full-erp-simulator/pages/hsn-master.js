/* =============================================================================
   DOT ERP — pages/hsn-master.js
   Phase 3, Module 08: HSN Master

   See data/hsn-data.js's header for why the reference-list picker is a
   convenience, not a constraint (unlike Currency Master's), and for the
   Default Tax Code chain this sets up for Item Master's retrofit.
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
    let rows = ERP_HsnRepository.getAllForCompany(company.id);

    if (filterType !== "all") rows = rows.filter((h) => h.hsnType === filterType);
    if (filterStatus !== "all") rows = rows.filter((h) => h.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((h) =>
        h.hsnCode.toLowerCase().includes(term) ||
        h.description.toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.hsnCode.localeCompare(b.hsnCode);
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  function renderSummary() {
    const all = ERP_HsnRepository.getAllForCompany(company.id);
    $("#hsnSummaryTotal").textContent = String(all.length);
    $("#hsnSummaryActive").textContent = String(all.filter((h) => h.status === "Active").length);
    $("#hsnSummaryGoods").textContent = String(all.filter((h) => h.hsnType === "Goods").length);
    $("#hsnSummaryServices").textContent = String(all.filter((h) => h.hsnType === "Services").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#hsnPagination");
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

    $("#hsnEmptyState").hidden = all.length !== 0;
    $("#hsnTable").hidden = all.length === 0;

    $("#hsnTableBody").innerHTML = pageItems.map((h) => {
      const statusBadge = `<span class="status-badge status-badge--${h.status === "Active" ? "success" : "danger"}">${h.status}</span>`;
      const quickAction = `<button type="button" class="link-btn" data-action="toggle" data-id="${h.id}">${h.status === "Active" ? "Deactivate" : "Reactivate"}</button>`;

      return `
      <tr>
        <td><code>${escapeHtml(h.hsnCode)}</code></td>
        <td>${escapeHtml(h.description)}</td>
        <td>${escapeHtml(h.hsnType)}</td>
        <td class="profile-subtle">${escapeHtml(ERP_HsnRepository.getEffectiveTaxLabel(h))}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${h.id}">View</button>
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
    $$("#hsnTypeChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#hsnTypeChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterType = chip.dataset.type;
        page = 1;
        renderTable();
      });
    });

    $$("#hsnStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#hsnStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#hsnSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#hsnSortBtn").textContent = sortOrder === "asc" ? "Code A-Z" : "Code Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#hsnExportCsvBtn").addEventListener("click", exportCsv);
    $("#hsnPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Description", "Type", "Default Tax", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((h) => {
      const line = [h.hsnCode, h.description, h.hsnType, ERP_HsnRepository.getEffectiveTaxLabel(h), h.status]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-hsn-codes-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("HSN/SAC codes exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((h) => `<tr><td>${escapeHtml(h.hsnCode)}</td><td>${escapeHtml(h.description)}</td><td>${escapeHtml(h.hsnType)}</td><td>${escapeHtml(ERP_HsnRepository.getEffectiveTaxLabel(h))}</td><td>${escapeHtml(h.status)}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - HSN/SAC Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — HSN/SAC Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Description</th><th>Type</th><th>Default Tax</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "HSN Master")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#hsnActivityEmptyState").hidden = relevant.length !== 0;
    $("#hsnActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT HSN CODE MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["hsnFormCode", "hsnFormDescription"].forEach((f) => setFormError(f, ""));
  }

  function populateTypeOptions() {
    $("#hsnFormType").innerHTML = ERP_HsnRepository.hsnTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
  }

  function populateCommonCodePicker() {
    const available = ERP_HsnRepository.availableToAdd(company.id);
    $("#hsnFormPickCommon").innerHTML = `<option value="">— Type your own below instead —</option>` +
      available.map((r) => `<option value="${escapeHtml(r.code)}">${escapeHtml(r.code)} — ${escapeHtml(r.description)} (${escapeHtml(r.hsnType)})</option>`).join("");
  }

  /** Only Active Tax Master codes at, or near, the picked reference entry's
      suggestedRatePct are highlighted first — but every Active tax code is
      offered, since the suggestion is only a hint (see file header). */
  function populateTaxCodeOptions(selectedTaxCodeId) {
    const options = ERP_TaxRepository.getActiveForCompany(company.id);
    $("#hsnFormTaxCode").innerHTML = `<option value="">None set</option>` +
      options.map((t) => `<option value="${t.id}">${escapeHtml(t.taxName)} (${t.ratePct}%)</option>`).join("");
    if (selectedTaxCodeId) $("#hsnFormTaxCode").value = selectedTaxCodeId;
    if (!options.length) {
      $("#hsnFormTaxCodeHint").textContent = "No Active tax codes exist yet — set one up in Tax Master first if you want a default here.";
    }
  }

  function openAddModal() {
    editingId = null;
    $("#hsnFormTitle").textContent = "Add HSN/SAC code";
    $("#hsnFormIntro").textContent = "Add an HSN (goods) or SAC (services) classification code.";
    $("#hsnFormSaveBtn").textContent = "Add Code";
    populateCommonCodePicker();
    $("#hsnFormPickCommon").value = "";
    $("#hsnFormCode").value = "";
    populateTypeOptions();
    $("#hsnFormType").value = "Goods";
    $("#hsnFormDescription").value = "";
    populateTaxCodeOptions(null);
    clearFormErrors();
    openModal("hsnFormModal");
  }

  function openEditModal(h) {
    editingId = h.id;
    $("#hsnFormTitle").textContent = "Edit HSN/SAC code";
    $("#hsnFormIntro").textContent = "Update this code's details.";
    $("#hsnFormSaveBtn").textContent = "Save Changes";
    populateCommonCodePicker();
    $("#hsnFormPickCommon").value = "";
    $("#hsnFormCode").value = h.hsnCode;
    populateTypeOptions();
    $("#hsnFormType").value = h.hsnType;
    $("#hsnFormDescription").value = h.description;
    populateTaxCodeOptions(h.defaultTaxCodeId);
    clearFormErrors();
    openModal("hsnFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const code = $("#hsnFormCode").value.trim();
    if (!code) { setFormError("hsnFormCode", "HSN/SAC code is required."); valid = false; }
    else if (!ERP_HsnRepository.codePattern.test(code)) { setFormError("hsnFormCode", "Enter 4-8 digits only (e.g. 8471)."); valid = false; }
    else if (ERP_HsnRepository.hasDuplicateCode(company.id, code, editingId)) { setFormError("hsnFormCode", "This code already exists in your HSN Master."); valid = false; }

    const description = $("#hsnFormDescription").value.trim();
    if (!description) { setFormError("hsnFormDescription", "Description is required."); valid = false; }
    else if (description.length > 120) { setFormError("hsnFormDescription", "Maximum 120 characters allowed."); valid = false; }

    return valid;
  }

  function bindFormModal() {
    $("#hsnAddBtn").addEventListener("click", openAddModal);

    $("#hsnFormPickCommon").addEventListener("change", () => {
      const picked = $("#hsnFormPickCommon").value;
      if (!picked) return;
      const ref = ERP_HsnRepository.referenceList.find((r) => r.code === picked);
      if (!ref) return;
      $("#hsnFormCode").value = ref.code;
      $("#hsnFormType").value = ref.hsnType;
      $("#hsnFormDescription").value = ref.description;
      // Suggest an Active tax code at the reference's suggested rate, if one exists.
      const suggestion = ERP_TaxRepository.getActiveForCompany(company.id).find((t) => t.ratePct === ref.suggestedRatePct);
      if (suggestion) $("#hsnFormTaxCode").value = suggestion.id;
    });

    $("#hsnFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        hsnCode: $("#hsnFormCode").value.trim(),
        hsnType: $("#hsnFormType").value,
        description: $("#hsnFormDescription").value.trim(),
        defaultTaxCodeId: $("#hsnFormTaxCode").value || null
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this code?",
          message: `"${payload.hsnCode}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_HsnRepository.update(editingId, payload);
            logSystemActivity({ module: "HSN Master", action: "Update", description: `Updated HSN/SAC code "${payload.hsnCode}" for ${company.name}` });
            closeModal("hsnFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_HsnRepository.findById(editingId));
            showToast("Code updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this code?",
          message: `"${payload.hsnCode}" (${payload.hsnType}) will be added.`,
          confirmLabel: "Add Code",
          onConfirm: () => {
            const created = ERP_HsnRepository.create(company, payload);
            logSystemActivity({ module: "HSN Master", action: "Create", description: `Added HSN/SAC code "${created.hsnCode}" for ${company.name}` });
            closeModal("hsnFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.hsnCode}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (two-state: Active / Inactive)
     --------------------------------------------------------------------- */
  function requestToggleStatus(h) {
    const activating = h.status !== "Active";
    const message = activating
      ? `"${h.hsnCode}" will become Active again.`
      : `"${h.hsnCode}" will be marked Inactive. It stays on record and can be reactivated any time.`;

    openConfirm({
      title: activating ? "Reactivate this code?" : "Deactivate this code?",
      message,
      confirmLabel: activating ? "Reactivate" : "Deactivate",
      onConfirm: () => {
        ERP_HsnRepository.toggleStatus(h.id);
        logSystemActivity({ module: "HSN Master", action: activating ? "Reactivate" : "Deactivate", description: `${activating ? "Reactivated" : "Deactivated"} HSN/SAC code "${h.hsnCode}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === h.id) openDetailModal(ERP_HsnRepository.findById(h.id));
        showToast(`"${h.hsnCode}" is now ${activating ? "Active" : "Inactive"}.`, "success");
      }
    });
  }

  function requestDelete(h) {
    openConfirm({
      title: "Delete this code?",
      message: `"${h.hsnCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_HsnRepository.remove(h.id);
        logSystemActivity({ module: "HSN Master", action: "Delete", description: `Deleted HSN/SAC code "${h.hsnCode}" for ${company.name}`, severity: "warning" });
        if (detailId === h.id) closeModal("hsnDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${h.hsnCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(h) {
    const footer = $("#hsnDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(h));
    addBtn(h.status === "Active" ? "Deactivate" : "Reactivate", "btn btn--ghost", () => requestToggleStatus(h));
    addBtn("Edit", "btn btn--primary", () => { closeModal("hsnDetailModal"); openEditModal(h); });
  }

  function openDetailModal(h) {
    detailId = h.id;
    $("#hsnDetailTitle").textContent = `${h.hsnCode} · ${h.hsnType}`;
    $("#hsnDetailBody").innerHTML = `
      <div><dt>HSN/SAC Code</dt><dd>${escapeHtml(h.hsnCode)}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(h.hsnType)}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${h.status === "Active" ? "success" : "danger"}">${h.status}</span></dd></div>
      <div><dt>Description</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(h.description)}</dd></div>
      <div><dt>Default Tax Code</dt><dd>${escapeHtml(ERP_HsnRepository.getEffectiveTaxLabel(h))}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(h.createdAt))}</dd></div>
    `;
    renderDetailFooter(h);
    openModal("hsnDetailModal");
  }

  function bindDetailModal() {
    $("#hsnTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const h = ERP_HsnRepository.findById(viewBtn.dataset.id);
        if (h) openDetailModal(h);
        return;
      }
      if (actionBtn) {
        const h = ERP_HsnRepository.findById(actionBtn.dataset.id);
        if (h) requestToggleStatus(h);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "hsn-master")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading HSN/SAC codes…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#hsnContent").hidden = true;
      $("#hsnSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#hsnContent").hidden = false;
      $("#hsnHeaderActions").hidden = false;
      $("#hsnSubtitle").textContent = `Managing HSN/SAC codes for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
