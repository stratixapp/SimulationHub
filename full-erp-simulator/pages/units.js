/* =============================================================================
   DOT ERP — pages/units.js
   Phase 3, Module 05: Unit Master

   Flat list — no Tree View, unlike Category Master, because a base-unit
   link is a single optional relationship, not a browsable hierarchy. See
   data/unit-data.js's header for the full reasoning on the lightweight
   conversion-chain model and the fourth duplicate-check resolution
   (both Name AND Symbol hard-blocked).
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
    let rows = ERP_UnitRepository.getAllForCompany(company.id);

    if (filterType !== "all") rows = rows.filter((u) => u.unitType === filterType);
    if (filterStatus !== "all") rows = rows.filter((u) => u.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((u) =>
        u.unitName.toLowerCase().includes(term) ||
        u.unitSymbol.toLowerCase().includes(term) ||
        u.unitCode.toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.unitName.localeCompare(b.unitName);
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  function renderSummary() {
    const all = ERP_UnitRepository.getAllForCompany(company.id);
    $("#uomSummaryTotal").textContent = String(all.length);
    $("#uomSummaryActive").textContent = String(all.filter((u) => u.status === "Active").length);
    $("#uomSummaryConverted").textContent = String(all.filter((u) => u.baseUnitId).length);
    $("#uomSummaryTypes").textContent = String(new Set(all.map((u) => u.unitType)).size);
  }


  /* -----------------------------------------------------------------------
     TYPE CHIPS (built from the fixed reference list)
     --------------------------------------------------------------------- */
  function buildTypeChips() {
    const container = $("#uomTypeChips");
    const extra = ERP_UnitRepository.unitTypes.map((type) =>
      `<button type="button" class="chip" data-type="${escapeHtml(type)}">${escapeHtml(type)}</button>`
    ).join("");
    container.insertAdjacentHTML("beforeend", extra);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#uomPagination");
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

  function conversionLabel(u) {
    const desc = ERP_UnitRepository.describeConversion(u);
    return desc ? escapeHtml(desc) : `<span class="profile-subtle">— base unit —</span>`;
  }

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#uomEmptyState").hidden = all.length !== 0;
    $("#uomTable").hidden = all.length === 0;

    $("#uomTableBody").innerHTML = pageItems.map((u) => {
      const statusBadge = `<span class="status-badge status-badge--${u.status === "Active" ? "success" : "danger"}">${u.status}</span>`;
      const quickAction = `<button type="button" class="link-btn" data-action="toggle" data-id="${u.id}">${u.status === "Active" ? "Deactivate" : "Reactivate"}</button>`;

      return `
      <tr>
        <td><code>${escapeHtml(u.unitCode)}</code></td>
        <td>${escapeHtml(u.unitName)}</td>
        <td><code>${escapeHtml(u.unitSymbol)}</code></td>
        <td>${escapeHtml(u.unitType)}</td>
        <td>${conversionLabel(u)}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${u.id}">View</button>
          ${quickAction}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     TOOLBAR: type + status chips, sort, search, export, print
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#uomTypeChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#uomTypeChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterType = chip.dataset.type;
        page = 1;
        renderTable();
      });
    });

    $$("#uomStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#uomStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#uomSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#uomSortBtn").textContent = sortOrder === "asc" ? "Name A-Z" : "Name Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#uomExportCsvBtn").addEventListener("click", exportCsv);
    $("#uomPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Symbol", "Type", "Conversion", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((u) => {
      const conv = ERP_UnitRepository.describeConversion(u);
      const line = [u.unitCode, u.unitName, u.unitSymbol, u.unitType, conv, u.status]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-units-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Units exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((u) => {
      const conv = ERP_UnitRepository.describeConversion(u) || "— base unit —";
      return `<tr><td>${escapeHtml(u.unitCode)}</td><td>${escapeHtml(u.unitName)}</td><td>${escapeHtml(u.unitSymbol)}</td><td>${escapeHtml(u.unitType)}</td><td>${escapeHtml(conv)}</td><td>${escapeHtml(u.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Unit Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Unit Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Symbol</th><th>Type</th><th>Conversion</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Unit Master")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#uomActivityEmptyState").hidden = relevant.length !== 0;
    $("#uomActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT UNIT MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["uomFormName", "uomFormSymbol", "uomFormBase", "uomFormFactor"].forEach((f) => setFormError(f, ""));
  }

  function populateTypeOptions() {
    $("#uomFormType").innerHTML = ERP_UnitRepository.unitTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
  }

  /** Base Unit options are filtered to the SAME unit type as the form's
      current selection (converting across types is meaningless — see
      data/unit-data.js's header), and exclude anything that would create a
      cycle via wouldCreateCycle — reusing that check directly rather than
      re-deriving an "excluded set" the way Category Master's tree needs to,
      since a single-parent chain only has one thing to check per candidate. */
  function populateBaseOptions(excludeUnitId) {
    const selectedType = $("#uomFormType").value;
    const all = ERP_UnitRepository.getAllForCompany(company.id);
    const candidates = all.filter((u) =>
      u.id !== excludeUnitId &&
      u.unitType === selectedType &&
      !(excludeUnitId && ERP_UnitRepository.wouldCreateCycle(company.id, excludeUnitId, u.id))
    );
    $("#uomFormBase").innerHTML = `<option value="">None (this is a base unit)</option>` +
      candidates.map((u) => `<option value="${u.id}">${escapeHtml(u.unitName)} (${escapeHtml(u.unitSymbol)})</option>`).join("");
  }

  function refreshFactorFieldState() {
    const hasBase = !!$("#uomFormBase").value;
    $("#uomFormFactor").disabled = !hasBase;
    if (!hasBase) {
      $("#uomFormFactor").value = "1";
      $("#uomFormFactorHint").textContent = "Only meaningful once a Base Unit is selected.";
    } else {
      const baseUnit = ERP_UnitRepository.findById($("#uomFormBase").value);
      $("#uomFormFactorHint").textContent = `1 of this unit equals this many ${baseUnit ? escapeHtml(baseUnit.unitName) : "of the Base Unit"}.`;
    }
  }

  function openAddModal() {
    editingId = null;
    $("#uomFormTitle").textContent = "Add unit";
    $("#uomFormIntro").textContent = "Add a unit of measure — e.g. Pieces, Kilogram, Box.";
    $("#uomFormSaveBtn").textContent = "Add Unit";
    $("#uomFormName").value = "";
    $("#uomFormSymbol").value = "";
    populateTypeOptions();
    $("#uomFormType").value = "Count";
    populateBaseOptions(null);
    $("#uomFormBase").value = "";
    $("#uomFormFactor").value = "1";
    $("#uomFormDescription").value = "";
    clearFormErrors();
    refreshFactorFieldState();
    openModal("uomFormModal");
  }

  function openEditModal(u) {
    editingId = u.id;
    $("#uomFormTitle").textContent = "Edit unit";
    $("#uomFormIntro").textContent = "Update this unit's details.";
    $("#uomFormSaveBtn").textContent = "Save Changes";
    $("#uomFormName").value = u.unitName;
    $("#uomFormSymbol").value = u.unitSymbol;
    populateTypeOptions();
    $("#uomFormType").value = u.unitType;
    populateBaseOptions(u.id);
    $("#uomFormBase").value = u.baseUnitId || "";
    $("#uomFormFactor").value = String(u.conversionFactor || 1);
    $("#uomFormDescription").value = u.description || "";
    clearFormErrors();
    refreshFactorFieldState();
    openModal("uomFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#uomFormName").value.trim();
    if (!name) { setFormError("uomFormName", "Unit name is required."); valid = false; }
    else if (name.length > 40) { setFormError("uomFormName", "Maximum 40 characters allowed."); valid = false; }
    else if (ERP_UnitRepository.hasDuplicateName(company.id, name, editingId)) { setFormError("uomFormName", "A unit with this name already exists."); valid = false; }

    const symbol = $("#uomFormSymbol").value.trim();
    if (!symbol) { setFormError("uomFormSymbol", "Symbol is required."); valid = false; }
    else if (symbol.length > 10) { setFormError("uomFormSymbol", "Maximum 10 characters allowed."); valid = false; }
    else if (ERP_UnitRepository.hasDuplicateSymbol(company.id, symbol, editingId)) { setFormError("uomFormSymbol", "A unit with this symbol already exists."); valid = false; }

    const baseUnitId = $("#uomFormBase").value || null;
    if (baseUnitId && editingId && ERP_UnitRepository.wouldCreateCycle(company.id, editingId, baseUnitId)) {
      setFormError("uomFormBase", "A unit can't (even indirectly) base its conversion on itself — choose a different base.");
      valid = false;
    }

    if (baseUnitId) {
      const factor = parseFloat($("#uomFormFactor").value);
      if ($("#uomFormFactor").value === "" || isNaN(factor) || factor <= 0) {
        setFormError("uomFormFactor", "Enter a conversion factor greater than 0.");
        valid = false;
      }
    }

    return valid;
  }

  function bindFormModal() {
    $("#uomAddBtn").addEventListener("click", openAddModal);
    $("#uomFormType").addEventListener("change", () => { populateBaseOptions(editingId); refreshFactorFieldState(); });
    $("#uomFormBase").addEventListener("change", refreshFactorFieldState);

    $("#uomFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const baseUnitId = $("#uomFormBase").value || null;
      const payload = {
        unitName: $("#uomFormName").value.trim(),
        unitSymbol: $("#uomFormSymbol").value.trim(),
        unitType: $("#uomFormType").value,
        baseUnitId,
        conversionFactor: baseUnitId ? (parseFloat($("#uomFormFactor").value) || 1) : 1,
        description: $("#uomFormDescription").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this unit?",
          message: `"${payload.unitName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_UnitRepository.update(editingId, payload);
            logSystemActivity({ module: "Unit Master", action: "Update", description: `Updated unit "${payload.unitName}" for ${company.name}` });
            closeModal("uomFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_UnitRepository.findById(editingId));
            showToast("Unit updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this unit?",
          message: `"${payload.unitName}" (${payload.unitSymbol}) will be added.`,
          confirmLabel: "Add Unit",
          onConfirm: () => {
            const created = ERP_UnitRepository.create(company, payload);
            logSystemActivity({ module: "Unit Master", action: "Create", description: `Added unit "${created.unitName}" (${created.unitCode}) for ${company.name}` });
            closeModal("uomFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.unitName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (two-state: Active / Inactive)
     --------------------------------------------------------------------- */
  function requestToggleStatus(u) {
    const activating = u.status !== "Active";
    const message = activating
      ? `"${u.unitName}" will become Active again.`
      : `"${u.unitName}" will be marked Inactive. It stays on record and can be reactivated any time.`;

    openConfirm({
      title: activating ? "Reactivate this unit?" : "Deactivate this unit?",
      message,
      confirmLabel: activating ? "Reactivate" : "Deactivate",
      onConfirm: () => {
        ERP_UnitRepository.toggleStatus(u.id);
        logSystemActivity({ module: "Unit Master", action: activating ? "Reactivate" : "Deactivate", description: `${activating ? "Reactivated" : "Deactivated"} unit "${u.unitName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === u.id) openDetailModal(ERP_UnitRepository.findById(u.id));
        showToast(`"${u.unitName}" is now ${activating ? "Active" : "Inactive"}.`, "success");
      }
    });
  }

  /** Refuses up front if another unit still bases its conversion on this
      one — same "don't orphan what points at you" rule Category Master
      enforces for sub-categories. */
  function requestDelete(u) {
    if (ERP_UnitRepository.isBaseUnitOf(company.id, u.id)) {
      showToast(`"${u.unitName}" is used as the Base Unit by another unit and can't be deleted until that's reassigned first.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this unit?",
      message: `"${u.unitName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_UnitRepository.remove(u.id, company.id);
        logSystemActivity({ module: "Unit Master", action: "Delete", description: `Deleted unit "${u.unitName}" for ${company.name}`, severity: "warning" });
        if (detailId === u.id) closeModal("uomDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${u.unitName}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDependentsList(u) {
    const dependents = ERP_UnitRepository.getAllForCompany(company.id).filter((k) => k.baseUnitId === u.id);
    $("#uomDetailNoChildren").hidden = dependents.length !== 0;
    $("#uomDetailChildrenList").innerHTML = dependents.map((k) => `
      <li class="activity-item">
        <span class="activity-item__icon">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 4v16M17 4v16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M7 8h10M7 16h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </span>
        <div style="flex:1 1 auto;">
          <p class="activity-item__text">${escapeHtml(k.unitName)} <span class="profile-subtle">(${escapeHtml(k.unitCode)})</span></p>
          <p class="activity-item__time">${ERP_UnitRepository.describeConversion(k)}</p>
        </div>
        <button type="button" class="row-detail-btn" data-drill-id="${k.id}">View</button>
      </li>
    `).join("");
  }

  function renderDetailFooter(u) {
    const footer = $("#uomDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(u));
    addBtn(u.status === "Active" ? "Deactivate" : "Reactivate", "btn btn--ghost", () => requestToggleStatus(u));
    addBtn("Edit", "btn btn--primary", () => { closeModal("uomDetailModal"); openEditModal(u); });
  }

  function openDetailModal(u) {
    detailId = u.id;
    const base = u.baseUnitId ? ERP_UnitRepository.findById(u.baseUnitId) : null;
    const conv = ERP_UnitRepository.describeConversion(u);

    $("#uomDetailTitle").textContent = `${u.unitName} · ${u.unitCode}`;
    $("#uomDetailBody").innerHTML = `
      <div><dt>Unit Name</dt><dd>${escapeHtml(u.unitName)}</dd></div>
      <div><dt>Unit Code</dt><dd>${escapeHtml(u.unitCode)}</dd></div>
      <div><dt>Symbol</dt><dd><code>${escapeHtml(u.unitSymbol)}</code></dd></div>
      <div><dt>Unit Type</dt><dd>${escapeHtml(u.unitType)}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${u.status === "Active" ? "success" : "danger"}">${u.status}</span></dd></div>
      <div><dt>Base Unit</dt><dd>${base ? escapeHtml(base.unitName) : "— this is a base unit —"}</dd></div>
      <div><dt>Conversion</dt><dd>${conv ? escapeHtml(conv) : "—"}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(u.createdAt))}</dd></div>
      ${u.description ? `<div><dt>Description</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(u.description)}</dd></div>` : ""}
    `;
    renderDependentsList(u);
    renderDetailFooter(u);
    openModal("uomDetailModal");
  }

  function bindDetailModal() {
    $("#uomTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const u = ERP_UnitRepository.findById(viewBtn.dataset.id);
        if (u) openDetailModal(u);
        return;
      }
      if (actionBtn) {
        const u = ERP_UnitRepository.findById(actionBtn.dataset.id);
        if (u) requestToggleStatus(u);
      }
    });

    // Dependent-units list drills within the same open modal.
    $("#uomDetailModal").addEventListener("click", (e) => {
      const drillBtn = e.target.closest("[data-drill-id]");
      if (!drillBtn) return;
      const u = ERP_UnitRepository.findById(drillBtn.dataset.drillId);
      if (u) openDetailModal(u);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "units")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading units…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#uomContent").hidden = true;
      $("#uomSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#uomContent").hidden = false;
      $("#uomHeaderActions").hidden = false;
      $("#uomSubtitle").textContent = `Managing units for ${company.name} (${company.companyCode}).`;
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
