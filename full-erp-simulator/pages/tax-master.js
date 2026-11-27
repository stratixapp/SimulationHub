/* =============================================================================
   DOT ERP — pages/tax-master.js
   Phase 3, Module 07: Tax Master

   Flat list, same complexity tier as Unit Master. See data/tax-data.js's
   header for why the Rate options come from GST Details rather than being
   redefined here, and why CGST/SGST/IGST are derived, not stored.
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
    let rows = ERP_TaxRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((t) => t.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((t) =>
        t.taxName.toLowerCase().includes(term) ||
        t.taxCode.toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.ratePct - b.ratePct;
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  function renderSummary() {
    const all = ERP_TaxRepository.getAllForCompany(company.id);
    $("#taxSummaryTotal").textContent = String(all.length);
    $("#taxSummaryActive").textContent = String(all.filter((t) => t.status === "Active").length);
    $("#taxSummarySlabs").textContent = String(new Set(all.map((t) => t.ratePct)).size);
    const def = ERP_TaxRepository.getDefault(company.id);
    $("#taxSummaryDefault").textContent = def ? def.taxName : "— none set —";
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#taxPagination");
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

    $("#taxEmptyState").hidden = all.length !== 0;
    $("#taxTable").hidden = all.length === 0;

    $("#taxTableBody").innerHTML = pageItems.map((t) => {
      const statusBadge = `<span class="status-badge status-badge--${t.status === "Active" ? "success" : "danger"}">${t.status}</span>`;
      const quickAction = `<button type="button" class="link-btn" data-action="toggle" data-id="${t.id}">${t.status === "Active" ? "Deactivate" : "Reactivate"}</button>`;
      const defaultBadge = t.isDefault ? `<span class="status-badge status-badge--info">Default</span>` : `<span class="profile-subtle">—</span>`;

      return `
      <tr>
        <td><code>${escapeHtml(t.taxCode)}</code></td>
        <td>${escapeHtml(t.taxName)}</td>
        <td>${t.ratePct}%</td>
        <td class="profile-subtle">${escapeHtml(ERP_TaxRepository.describeSplit(t))}</td>
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
    $$("#taxStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#taxStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#taxSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#taxSortBtn").textContent = sortOrder === "asc" ? "Rate Low-High" : "Rate High-Low";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#taxExportCsvBtn").addEventListener("click", exportCsv);
    $("#taxPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Rate %", "CGST %", "SGST %", "IGST %", "Default", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((t) => {
      const intra = ERP_TaxRepository.getIntraStateSplit(t);
      const inter = ERP_TaxRepository.getInterStateSplit(t);
      const line = [t.taxCode, t.taxName, t.ratePct, intra.cgstPct, intra.sgstPct, inter.igstPct, t.isDefault ? "Yes" : "No", t.status]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-tax-codes-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Tax codes exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((t) => `<tr><td>${escapeHtml(t.taxCode)}</td><td>${escapeHtml(t.taxName)}</td><td>${t.ratePct}%</td><td>${escapeHtml(ERP_TaxRepository.describeSplit(t))}</td><td>${t.isDefault ? "Yes" : ""}</td><td>${escapeHtml(t.status)}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Tax Code Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Tax Code Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Rate</th><th>Split</th><th>Default</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Tax Master")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#taxActivityEmptyState").hidden = relevant.length !== 0;
    $("#taxActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT TAX CODE MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["taxFormName", "taxFormRate"].forEach((f) => setFormError(f, ""));
  }

  function populateRateOptions(selectedRate) {
    const rates = ERP_TaxRepository.getAvailableRates(company.id);
    $("#taxFormRate").innerHTML = rates.map((r) => `<option value="${r.rate}">${r.rate}% — ${escapeHtml(r.label)}</option>`).join("");
    if (selectedRate !== undefined && rates.some((r) => r.rate === selectedRate)) {
      $("#taxFormRate").value = String(selectedRate);
    }
    updateSplitPreview();
  }

  function updateSplitPreview() {
    const rate = parseFloat($("#taxFormRate").value);
    if (isNaN(rate)) { $("#taxFormSplitPreview").textContent = ""; return; }
    const half = rate / 2;
    $("#taxFormSplitPreview").textContent = `${half}% CGST + ${half}% SGST (intra-state) / ${rate}% IGST (inter-state)`;
  }

  function openAddModal() {
    editingId = null;
    $("#taxFormTitle").textContent = "Add tax code";
    $("#taxFormIntro").textContent = "Add a named tax code built on one of GST Details' enabled rate slabs.";
    $("#taxFormSaveBtn").textContent = "Add Tax Code";
    $("#taxFormName").value = "";
    populateRateOptions(undefined);
    $("#taxFormIsDefault").checked = ERP_TaxRepository.getAllForCompany(company.id).length === 0;
    $("#taxFormDescription").value = "";
    clearFormErrors();
    openModal("taxFormModal");
  }

  function openEditModal(t) {
    editingId = t.id;
    $("#taxFormTitle").textContent = "Edit tax code";
    $("#taxFormIntro").textContent = "Update this tax code's details.";
    $("#taxFormSaveBtn").textContent = "Save Changes";
    $("#taxFormName").value = t.taxName;
    populateRateOptions(t.ratePct);
    $("#taxFormIsDefault").checked = !!t.isDefault;
    $("#taxFormDescription").value = t.description || "";
    clearFormErrors();
    openModal("taxFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#taxFormName").value.trim();
    if (!name) { setFormError("taxFormName", "Tax name is required."); valid = false; }
    else if (name.length > 60) { setFormError("taxFormName", "Maximum 60 characters allowed."); valid = false; }
    else if (ERP_TaxRepository.hasDuplicateName(company.id, name, editingId)) { setFormError("taxFormName", "A tax code with this name already exists."); valid = false; }

    if (!$("#taxFormRate").value) { setFormError("taxFormRate", "Select a rate."); valid = false; }

    return valid;
  }

  function bindFormModal() {
    $("#taxAddBtn").addEventListener("click", openAddModal);
    $("#taxFormRate").addEventListener("change", updateSplitPreview);

    $("#taxFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        taxName: $("#taxFormName").value.trim(),
        ratePct: parseFloat($("#taxFormRate").value),
        isDefault: $("#taxFormIsDefault").checked,
        description: $("#taxFormDescription").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this tax code?",
          message: `"${payload.taxName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_TaxRepository.update(editingId, payload);
            logSystemActivity({ module: "Tax Master", action: "Update", description: `Updated tax code "${payload.taxName}" for ${company.name}` });
            closeModal("taxFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_TaxRepository.findById(editingId));
            showToast("Tax code updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this tax code?",
          message: `"${payload.taxName}" (${payload.ratePct}%) will be added.`,
          confirmLabel: "Add Tax Code",
          onConfirm: () => {
            const created = ERP_TaxRepository.create(company, payload);
            logSystemActivity({ module: "Tax Master", action: "Create", description: `Added tax code "${created.taxName}" (${created.taxCode}) for ${company.name}` });
            closeModal("taxFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.taxName}" added.`, "success");
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
      ? `"${t.taxName}" will become Active again.`
      : `"${t.taxName}" will be marked Inactive. It stays on record and can be reactivated any time.`;

    openConfirm({
      title: activating ? "Reactivate this tax code?" : "Deactivate this tax code?",
      message,
      confirmLabel: activating ? "Reactivate" : "Deactivate",
      onConfirm: () => {
        ERP_TaxRepository.toggleStatus(t.id);
        logSystemActivity({ module: "Tax Master", action: activating ? "Reactivate" : "Deactivate", description: `${activating ? "Reactivated" : "Deactivated"} tax code "${t.taxName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === t.id) openDetailModal(ERP_TaxRepository.findById(t.id));
        showToast(`"${t.taxName}" is now ${activating ? "Active" : "Inactive"}.`, "success");
      }
    });
  }

  function requestDelete(t) {
    openConfirm({
      title: "Delete this tax code?",
      message: `"${t.taxName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_TaxRepository.remove(t.id);
        logSystemActivity({ module: "Tax Master", action: "Delete", description: `Deleted tax code "${t.taxName}" for ${company.name}`, severity: "warning" });
        if (detailId === t.id) closeModal("taxDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${t.taxName}" deleted.`, "info");
      }
    });
  }

  function requestSetDefault(t) {
    openConfirm({
      title: "Set as default tax code?",
      message: `"${t.taxName}" will become the company's default tax code, replacing whichever one was set before.`,
      confirmLabel: "Set Default",
      onConfirm: () => {
        ERP_TaxRepository.setDefault(t.id, company.id);
        logSystemActivity({ module: "Tax Master", action: "Update", description: `Set "${t.taxName}" as the default tax code for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === t.id) openDetailModal(ERP_TaxRepository.findById(t.id));
        showToast(`"${t.taxName}" is now the default tax code.`, "success");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(t) {
    const footer = $("#taxDetailFooter");
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
    addBtn("Edit", "btn btn--primary", () => { closeModal("taxDetailModal"); openEditModal(t); });
  }

  function openDetailModal(t) {
    detailId = t.id;
    const intra = ERP_TaxRepository.getIntraStateSplit(t);
    const inter = ERP_TaxRepository.getInterStateSplit(t);

    $("#taxDetailTitle").textContent = `${t.taxName} · ${t.taxCode}`;
    $("#taxDetailBody").innerHTML = `
      <div><dt>Tax Name</dt><dd>${escapeHtml(t.taxName)}</dd></div>
      <div><dt>Tax Code</dt><dd>${escapeHtml(t.taxCode)}</dd></div>
      <div><dt>Rate</dt><dd>${t.ratePct}%</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${t.status === "Active" ? "success" : "danger"}">${t.status}</span></dd></div>
      <div><dt>Default</dt><dd>${t.isDefault ? "Yes" : "No"}</dd></div>
      <div><dt>Intra-State (CGST + SGST)</dt><dd>${intra.cgstPct}% + ${intra.sgstPct}%</dd></div>
      <div><dt>Inter-State (IGST)</dt><dd>${inter.igstPct}%</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(t.createdAt))}</dd></div>
      ${t.description ? `<div><dt>Description</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(t.description)}</dd></div>` : ""}
    `;
    renderDetailFooter(t);
    openModal("taxDetailModal");
  }

  function bindDetailModal() {
    $("#taxTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const t = ERP_TaxRepository.findById(viewBtn.dataset.id);
        if (t) openDetailModal(t);
        return;
      }
      if (actionBtn) {
        const t = ERP_TaxRepository.findById(actionBtn.dataset.id);
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
    if (!window.ERP.enforcePageAccess(session, "tax-master")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading tax codes…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#noRatesState").hidden = true;
      $("#taxContent").hidden = true;
      $("#taxSubtitle").textContent = "No active company yet.";
    } else {
      // Only reads GST Details' rate reference/prefs — no need to touch
      // registrations, which are a separate concern this module doesn't use.
      const availableRates = ERP_TaxRepository.getAvailableRates(company.id);

      if (!availableRates.length) {
        $("#noCompanyState").hidden = true;
        $("#noRatesState").hidden = false;
        $("#taxContent").hidden = true;
        $("#taxSubtitle").textContent = `Managing tax codes for ${company.name} (${company.companyCode}).`;
      } else {
        $("#noCompanyState").hidden = true;
        $("#noRatesState").hidden = true;
        $("#taxContent").hidden = false;
        $("#taxHeaderActions").hidden = false;
        $("#taxSubtitle").textContent = `Managing tax codes for ${company.name} (${company.companyCode}).`;
        renderAll();
        renderActivity();
        bindToolbar();
        bindFormModal();
        bindDetailModal();
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
