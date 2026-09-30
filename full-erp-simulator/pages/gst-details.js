/* =============================================================================
   DOT ERP — pages/gst-details.js
   Phase 2, Module 05: GST Details

   Always works against the ACTIVE company. Company Profile owns the single
   `gstin` field; this page reconciles that with the state-wise registration
   list on every load via ERP_GstRepository.ensurePrimaryRegistration(), then
   lets the user add registrations for other states, manage which GST rate
   slabs the business uses, and set return-filing preferences.
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
  let primary = null;       // this company's primary GST registration (may be null if no GSTIN)
  let filterStatus = "all";
  let sortOrder = "asc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;     // registration id being edited, or null when adding
  let detailId = null;


  /* -----------------------------------------------------------------------
     DATE-ONLY FORMATTING — same local convention used by financial-year.js
     and currency.js, kept self-contained rather than shared.
     --------------------------------------------------------------------- */
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


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_GstRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((r) => r.gstin.toLowerCase().includes(term) || r.state.toLowerCase().includes(term));
    }

    const nonPrimary = rows.filter((r) => !r.isPrimary).sort((a, b) => {
      const diff = a.state.localeCompare(b.state);
      return sortOrder === "desc" ? -diff : diff;
    });
    const primaryRow = rows.find((r) => r.isPrimary);
    return primaryRow ? [primaryRow, ...nonPrimary] : nonPrimary;
  }

  function renderSummary() {
    const all = ERP_GstRepository.getAllForCompany(company.id);
    const settings = ERP_GstRepository.getSettings(company.id);
    $("#gstSummaryPrimary").textContent = primary ? primary.gstin : "—";
    $("#gstSummaryTotal").textContent = String(all.length);
    $("#gstSummaryActive").textContent = String(all.filter((r) => r.status === "Active").length);
    $("#gstSummaryFrequency").textContent = settings.returnFrequency === "Quarterly" ? "Quarterly (QRMP)" : "Monthly";
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#gstPagination");
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

    $("#gstEmptyState").hidden = all.length !== 0;
    $("#gstTable").hidden = all.length === 0;

    $("#gstTableBody").innerHTML = pageItems.map((r) => {
      const statusBadge = r.isPrimary
        ? `<span class="status-badge status-badge--info">Primary</span>`
        : `<span class="status-badge status-badge--${r.status === "Active" ? "success" : "danger"}">${r.status}</span>`;
      const quickAction = (!r.isPrimary && r.status === "Active")
        ? `<button type="button" class="link-btn" data-action="cancel" data-id="${r.id}">Cancel</button>`
        : (!r.isPrimary && r.status === "Cancelled")
          ? `<button type="button" class="link-btn" data-action="reactivate" data-id="${r.id}">Reactivate</button>`
          : "";

      return `
      <tr>
        <td><code>${escapeHtml(r.gstin)}</code></td>
        <td>${escapeHtml(r.state)}</td>
        <td>${escapeHtml(r.registrationType)}</td>
        <td>${statusBadge}</td>
        <td>${formatDateOnly(r.effectiveDate)}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${r.id}">View</button>
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
    $$("#gstStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#gstStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#gstSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#gstSortBtn").textContent = sortOrder === "asc" ? "State A-Z" : "State Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#gstExportCsvBtn").addEventListener("click", exportCsv);
    $("#gstPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["GSTIN", "State", "Type", "Status", "Effective Date", "Jurisdiction Ward"];
    const csvRows = [header.join(",")];
    rows.forEach((r) => {
      const line = [
        r.gstin, r.state, r.registrationType, r.isPrimary ? "Primary" : r.status,
        formatDateOnly(r.effectiveDate), r.jurisdictionWard || ""
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-gst-registrations-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("GST registrations exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((r) => `<tr><td>${escapeHtml(r.gstin)}</td><td>${escapeHtml(r.state)}</td><td>${escapeHtml(r.registrationType)}</td><td>${r.isPrimary ? "Primary" : r.status}</td><td>${formatDateOnly(r.effectiveDate)}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - GST Registration Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — GST Registration Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>GSTIN</th><th>State</th><th>Type</th><th>Status</th><th>Effective Date</th></tr></thead>
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
      .filter((e) => e.module === "GST Details")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#gstActivityEmptyState").hidden = relevant.length !== 0;
    $("#gstActivityList").innerHTML = relevant.map((e) => `
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
     FILING PREFERENCES + RATE SLABS
     --------------------------------------------------------------------- */
  function loadSettingsForm() {
    const settings = ERP_GstRepository.getSettings(company.id);
    $("#gstFrequency").value = settings.returnFrequency;
    $("#gstEwayThreshold").value = settings.eWayBillThreshold;
    $("#gstEInvoiceToggle").checked = !!settings.eInvoiceApplicable;
  }

  function bindSettingsForm() {
    $("#gstSettingsSaveBtn").addEventListener("click", () => {
      const threshold = parseFloat($("#gstEwayThreshold").value);
      if (isNaN(threshold) || threshold < 0) {
        showToast("Enter a valid e-Way Bill threshold amount.", "warning");
        return;
      }
      const partial = {
        returnFrequency: $("#gstFrequency").value,
        eWayBillThreshold: threshold,
        eInvoiceApplicable: $("#gstEInvoiceToggle").checked
      };
      ERP_GstRepository.updateSettings(company.id, partial);
      logSystemActivity({ module: "GST Details", action: "Update Settings", description: `Updated GST filing preferences for ${company.name} (${partial.returnFrequency} filing, e-Way Bill threshold ₹${threshold})` });
      renderSummary();
      renderActivity();
      showToast("Filing preferences saved.", "success");
    });
  }

  function renderRateSlabs() {
    const enabled = new Set(ERP_GstRepository.getRatePrefs(company.id));
    $("#gstRateSlabList").innerHTML = ERP_GstRepository.rateReference.map((slab) => `
      <label class="toggle-switch">
        <input type="checkbox" data-rate="${slab.rate}" ${enabled.has(slab.rate) ? "checked" : ""} />
        <span class="toggle-switch__track"><span class="toggle-switch__thumb"></span></span>
        <span class="toggle-switch__label"><strong>${slab.label}</strong> — <span class="profile-subtle">${escapeHtml(slab.description)}</span></span>
      </label>
    `).join("");
  }

  function bindRateSlabs() {
    $("#gstRateSlabList").addEventListener("change", (e) => {
      const input = e.target.closest("input[data-rate]");
      if (!input) return;
      const rate = parseFloat(input.dataset.rate);
      ERP_GstRepository.toggleRate(company.id, rate);
      const slab = ERP_GstRepository.rateReference.find((s) => s.rate === rate);
      logSystemActivity({ module: "GST Details", action: "Toggle Rate Slab", description: `${input.checked ? "Enabled" : "Disabled"} the ${slab.label} GST rate slab for ${company.name}` });
      renderActivity();
      showToast(`${slab.label} slab ${input.checked ? "enabled" : "disabled"}.`, "success");
    });
  }


  /* -----------------------------------------------------------------------
     ADD / EDIT REGISTRATION MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { ["gstAddGstin", "gstAddDate"].forEach((f) => setFormError(f, "")); }

  function refreshStateHint() {
    const gstin = $("#gstAddGstin").value.trim().toUpperCase();
    if (gstin.length >= 2 && /^[0-9]{2}/.test(gstin)) {
      const state = ERP_GstRepository.deriveState(gstin);
      $("#gstAddStateHint").textContent = state === "Unknown" ? "Unrecognized state code." : `State: ${state}`;
    } else {
      $("#gstAddStateHint").textContent = "The state will appear here once a valid GSTIN is entered.";
    }
  }

  function openAddModal() {
    editingId = null;
    $("#gstAddTitle").textContent = "Add GST registration";
    $("#gstAddIntro").textContent = "Enter the GSTIN for another state this business operates in — the state is derived automatically from it.";
    $("#gstAddSaveBtn").textContent = "Add Registration";
    $("#gstAddGstin").value = "";
    $("#gstAddGstin").disabled = false;
    $("#gstAddType").value = "Regular";
    $("#gstAddDate").value = todayISO();
    $("#gstAddWard").value = "";
    $("#gstAddNotes").value = "";
    clearFormErrors();
    refreshStateHint();
    openModal("gstAddModal");
  }

  function openEditModal(reg) {
    editingId = reg.id;
    $("#gstAddTitle").textContent = "Edit GST registration";
    $("#gstAddIntro").textContent = reg.isPrimary
      ? "This is the primary registration — its GSTIN is managed from Company Profile and can't be changed here, but its type, ward and notes can."
      : "The GSTIN itself can't be edited — cancel this registration and add a new one if it was entered incorrectly.";
    $("#gstAddSaveBtn").textContent = "Save Changes";
    $("#gstAddGstin").value = reg.gstin;
    $("#gstAddGstin").disabled = true;
    $("#gstAddType").value = reg.registrationType;
    $("#gstAddDate").value = reg.effectiveDate;
    $("#gstAddWard").value = reg.jurisdictionWard || "";
    $("#gstAddNotes").value = reg.notes || "";
    clearFormErrors();
    refreshStateHint();
    openModal("gstAddModal");
  }

  function validateAddForm() {
    let valid = true;
    clearFormErrors();

    if (!editingId) {
      const gstin = $("#gstAddGstin").value.trim().toUpperCase();
      if (!gstin) { setFormError("gstAddGstin", "GSTIN is required."); valid = false; }
      else if (!ERP_GstRepository.gstinPattern.test(gstin)) { setFormError("gstAddGstin", "GSTIN must look like 33ABCDE1234F1Z5."); valid = false; }
      else if (ERP_GstRepository.hasDuplicateGstin(company.id, gstin)) { setFormError("gstAddGstin", "This GSTIN is already registered for this company."); valid = false; }
    }

    if (!$("#gstAddDate").value) { setFormError("gstAddDate", "Effective date is required."); valid = false; }

    return valid;
  }

  function bindAddModal() {
    $("#gstAddBtn").addEventListener("click", openAddModal);
    $("#gstAddGstin").addEventListener("input", refreshStateHint);

    $("#gstAddSaveBtn").addEventListener("click", () => {
      if (!validateAddForm()) return;

      const registrationType = $("#gstAddType").value;
      const effectiveDate = $("#gstAddDate").value;
      const jurisdictionWard = $("#gstAddWard").value.trim();
      const notes = $("#gstAddNotes").value.trim();

      if (editingId) {
        openConfirm({
          title: "Save changes to this registration?",
          message: "Its registration type, ward and notes will be updated.",
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_GstRepository.update(editingId, { registrationType, effectiveDate, jurisdictionWard, notes });
            logSystemActivity({ module: "GST Details", action: "Update", description: `Updated GST registration details for ${company.name}` });
            closeModal("gstAddModal");
            if (editingId === primary?.id) primary = ERP_GstRepository.findById(editingId);
            renderAll();
            renderActivity();
            showToast("Registration updated.", "success");
          }
        });
      } else {
        const gstin = $("#gstAddGstin").value.trim().toUpperCase();
        const state = ERP_GstRepository.deriveState(gstin);
        openConfirm({
          title: "Add this GST registration?",
          message: `A new ${registrationType} registration for ${state} (${gstin}) will be added.`,
          confirmLabel: "Add Registration",
          onConfirm: () => {
            const created = ERP_GstRepository.create(company, { gstin, registrationType, effectiveDate, jurisdictionWard, notes });
            logSystemActivity({ module: "GST Details", action: "Create", description: `Added GST registration ${created.gstin} (${created.state}) for ${company.name}` });
            closeModal("gstAddModal");
            renderAll();
            renderActivity();
            showToast(`Registration for ${created.state} added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (cancel / reactivate / delete)
     --------------------------------------------------------------------- */
  function requestToggleStatus(reg) {
    const reactivating = reg.status !== "Active";
    openConfirm({
      title: reactivating ? "Reactivate this registration?" : "Cancel this registration?",
      message: reactivating
        ? `The ${reg.state} registration will become Active again.`
        : `The ${reg.state} registration (${reg.gstin}) will be marked Cancelled. It stays on record — cancelling doesn't delete it.`,
      confirmLabel: reactivating ? "Reactivate" : "Cancel Registration",
      onConfirm: () => {
        ERP_GstRepository.toggleStatus(reg.id);
        logSystemActivity({ module: "GST Details", action: reactivating ? "Reactivate" : "Cancel", description: `${reactivating ? "Reactivated" : "Cancelled"} the ${reg.state} GST registration (${reg.gstin}) for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === reg.id) openDetailModal(ERP_GstRepository.findById(reg.id));
        showToast(`${reg.state} registration is now ${reactivating ? "Active" : "Cancelled"}.`, "success");
      }
    });
  }

  function requestDelete(reg) {
    openConfirm({
      title: "Delete this registration?",
      message: `The ${reg.state} registration (${reg.gstin}) will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_GstRepository.remove(reg.id);
        logSystemActivity({ module: "GST Details", action: "Delete", description: `Deleted the ${reg.state} GST registration (${reg.gstin}) for ${company.name}`, severity: "warning" });
        if (detailId === reg.id) closeModal("gstDetailModal");
        renderAll();
        renderActivity();
        showToast(`${reg.state} registration deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(reg) {
    const footer = $("#gstDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (!reg.isPrimary) {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(reg));
      addBtn(reg.status === "Active" ? "Cancel Registration" : "Reactivate", "btn btn--ghost", () => requestToggleStatus(reg));
    }
    addBtn("Edit", "btn btn--primary", () => { closeModal("gstDetailModal"); openEditModal(reg); });
  }

  function openDetailModal(reg) {
    detailId = reg.id;
    $("#gstDetailTitle").textContent = `${reg.state} — ${reg.gstin}`;
    $("#gstDetailBody").innerHTML = `
      <div><dt>GSTIN</dt><dd>${escapeHtml(reg.gstin)}</dd></div>
      <div><dt>State</dt><dd>${escapeHtml(reg.state)}</dd></div>
      <div><dt>Registration Type</dt><dd>${escapeHtml(reg.registrationType)}</dd></div>
      <div><dt>Status</dt><dd>${reg.isPrimary ? `<span class="status-badge status-badge--info">Primary</span>` : `<span class="status-badge status-badge--${reg.status === "Active" ? "success" : "danger"}">${reg.status}</span>`}</dd></div>
      <div><dt>Effective Date</dt><dd>${formatDateOnly(reg.effectiveDate)}</dd></div>
      ${reg.jurisdictionWard ? `<div><dt>Jurisdiction Ward</dt><dd>${escapeHtml(reg.jurisdictionWard)}</dd></div>` : ""}
      <div><dt>Created</dt><dd>${formatDateTime(new Date(reg.createdAt))}</dd></div>
      ${reg.cancelledAt ? `<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(reg.cancelledAt))}</dd></div>` : ""}
      ${reg.notes ? `<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(reg.notes)}</dd></div>` : ""}
    `;
    renderDetailFooter(reg);
    openModal("gstDetailModal");
  }

  function bindDetailModal() {
    $("#gstTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");

      if (viewBtn) {
        const reg = ERP_GstRepository.findById(viewBtn.dataset.id);
        if (reg) openDetailModal(reg);
        return;
      }
      if (actionBtn) {
        const reg = ERP_GstRepository.findById(actionBtn.dataset.id);
        if (reg) requestToggleStatus(reg);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "gst-details")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading GST details…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#noGstinState").hidden = true;
      $("#gstContent").hidden = true;
      $("#gstSubtitle").textContent = "No active company yet.";
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    primary = ERP_GstRepository.ensurePrimaryRegistration(company);

    if (!primary) {
      $("#noCompanyState").hidden = true;
      $("#noGstinState").hidden = false;
      $("#gstContent").hidden = true;
      $("#gstSubtitle").textContent = `${company.name} has no GSTIN on file yet.`;
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    $("#noCompanyState").hidden = true;
    $("#noGstinState").hidden = true;
    $("#gstContent").hidden = false;
    $("#gstHeaderActions").hidden = false;
    $("#gstSubtitle").textContent = `Managing GST registrations for ${company.name} (${company.companyCode}). Primary: ${primary.gstin}.`;
    loadSettingsForm();
    renderRateSlabs();
    renderAll();
    renderActivity();
    bindToolbar();
    bindSettingsForm();
    bindRateSlabs();
    bindAddModal();
    bindDetailModal();

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
