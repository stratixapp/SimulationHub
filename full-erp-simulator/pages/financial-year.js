/* =============================================================================
   DOT ERP — pages/financial-year.js
   Phase 2, Module 03: Financial Year

   Always works against the ACTIVE company (ERP_CompanyRepository.getActive()),
   the same convention Company Profile established. Every financial year
   belongs to exactly one company and auto-generates its own 12 monthly
   Periods via ERP_FinancialYearRepository — see data/financial-year-data.js
   for the lifecycle rules (Draft -> Current -> Closed -> Locked).
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity, getPreferences
  } = window.ERP;
  const { parseISO, toISO, addDays, suggestName, suggestEndDate } = ERP_FinancialYearRepository.helpers;

  const PAGE_SIZE = 6;
  const STATUS_BADGE = { Draft: "info", Current: "success", Closed: "warning", Locked: "danger" };

  let session = null;
  let company = null;
  let filterStatus = "all";
  let sortOrder = "desc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;   // financial year id being edited, or null when creating
  let detailId = null;    // financial year id currently open in the detail modal


  /* -----------------------------------------------------------------------
     DATE-ONLY FORMATTING (calendar dates, no time-of-day — respects the
     same Settings date-format preference formatDateTime uses, so "Created"
     timestamps and "Start Date" calendar dates still feel consistent).
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
    return `${dd} ${months[m - 1]} ${y}`; // DD_MON_YYYY, the default
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_FinancialYearRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((fy) => fy.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((fy) => fy.name.toLowerCase().includes(term) || fy.fyCode.toLowerCase().includes(term));
    }

    rows = rows.slice().sort((a, b) => {
      const diff = a.startDate.localeCompare(b.startDate);
      return sortOrder === "desc" ? -diff : diff;
    });
    return rows;
  }

  function renderSummary() {
    const all = ERP_FinancialYearRepository.getAllForCompany(company.id);
    const current = ERP_FinancialYearRepository.getCurrent(company.id);
    $("#fySummaryTotal").textContent = String(all.length);
    $("#fySummaryCurrent").textContent = current ? current.name : "None set";
    $("#fySummaryDraft").textContent = String(all.filter((fy) => fy.status === "Draft").length);
    $("#fySummaryClosed").textContent = String(all.filter((fy) => fy.status === "Closed" || fy.status === "Locked").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#fyPagination");
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

  /** The one contextual "quick action" button offered directly in the row,
      matching the status's most likely next step. Deeper/rarer actions
      (Edit, Reopen, Delete) live inside the View details modal instead, so
      the table itself doesn't get crowded with buttons. */
  function quickActionButton(fy) {
    if (fy.status === "Draft") return `<button type="button" class="link-btn" data-action="set-current" data-id="${fy.id}">Set Current</button>`;
    if (fy.status === "Current") return `<button type="button" class="link-btn" data-action="close" data-id="${fy.id}">Close</button>`;
    if (fy.status === "Closed") return `<button type="button" class="link-btn" data-action="lock" data-id="${fy.id}">Lock</button>`;
    return "";
  }

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#fyEmptyState").hidden = all.length !== 0;
    $("#fyTable").hidden = all.length === 0;

    $("#fyTableBody").innerHTML = pageItems.map((fy) => {
      const closedPeriods = fy.periods.filter((p) => p.status === "Closed").length;
      return `
      <tr>
        <td><code>${escapeHtml(fy.fyCode)}</code></td>
        <td>${escapeHtml(fy.name)}</td>
        <td>${formatDateOnly(fy.startDate)}</td>
        <td>${formatDateOnly(fy.endDate)}</td>
        <td><span class="status-badge status-badge--${STATUS_BADGE[fy.status]}">${fy.status}</span></td>
        <td>${fy.periods.length} <span class="profile-subtle">(${closedPeriods} closed)</span></td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${fy.id}">View</button>
          ${quickActionButton(fy)}
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
    $$("#fyStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#fyStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#fySortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#fySortBtn").textContent = sortOrder === "desc" ? "Newest first" : "Oldest first";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#fyExportCsvBtn").addEventListener("click", exportCsv);
    $("#fyPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["FY Code", "Financial Year", "Start Date", "End Date", "Status", "Periods Closed", "Created"];
    const csvRows = [header.join(",")];
    rows.forEach((fy) => {
      const closedPeriods = fy.periods.filter((p) => p.status === "Closed").length;
      const line = [
        fy.fyCode, fy.name, formatDateOnly(fy.startDate), formatDateOnly(fy.endDate), fy.status,
        `${closedPeriods}/${fy.periods.length}`, formatDateTime(new Date(fy.createdAt))
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-financial-years-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Financial years exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((fy) => {
      const closedPeriods = fy.periods.filter((p) => p.status === "Closed").length;
      return `<tr><td>${escapeHtml(fy.fyCode)}</td><td>${escapeHtml(fy.name)}</td><td>${formatDateOnly(fy.startDate)}</td><td>${formatDateOnly(fy.endDate)}</td><td>${fy.status}</td><td>${closedPeriods}/${fy.periods.length}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Financial Year Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Financial Year Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>FY Code</th><th>Financial Year</th><th>Start Date</th><th>End Date</th><th>Status</th><th>Periods Closed</th></tr></thead>
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
      .filter((e) => e.module === "Financial Year")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#fyActivityEmptyState").hidden = relevant.length !== 0;
    $("#fyActivityList").innerHTML = relevant.map((e) => `
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
     CREATE / EDIT MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { ["fyFormStartDate", "fyFormEndDate", "fyFormName"].forEach((f) => setFormError(f, "")); }

  /** Sensible defaults for a brand-new financial year: start the day after
      the latest existing year's end date (so years naturally chain without
      gaps), or today if this is the company's first one. */
  function defaultStartDate() {
    const all = ERP_FinancialYearRepository.getAllForCompany(company.id);
    if (!all.length) return toISO(new Date());
    const latestEnd = all.reduce((max, fy) => (fy.endDate > max ? fy.endDate : max), all[0].endDate);
    return toISO(addDays(parseISO(latestEnd), 1));
  }

  function refreshSuggestions() {
    const start = $("#fyFormStartDate").value;
    if (!start) return;
    const end = suggestEndDate(start);
    $("#fyFormEndDate").value = end;
    $("#fyFormName").value = suggestName(start, end);
  }

  function openCreateModal() {
    editingId = null;
    $("#fyFormTitle").textContent = "Create financial year";
    $("#fyFormIntro").textContent = "Pick a start date — the end date and name are suggested automatically for a standard 12-month year, and 12 monthly periods are generated the moment you save.";
    $("#fyFormSaveBtn").textContent = "Create Financial Year";
    const start = defaultStartDate();
    $("#fyFormStartDate").value = start;
    $("#fyFormEndDate").value = suggestEndDate(start);
    $("#fyFormName").value = suggestName(start, suggestEndDate(start));
    $("#fyFormNotes").value = "";
    clearFormErrors();
    openModal("fyFormModal");
  }

  function openEditModal(fy) {
    editingId = fy.id;
    $("#fyFormTitle").textContent = "Edit financial year";
    $("#fyFormIntro").textContent = "This year is still a Draft, so its dates and name can still be adjusted — periods will be regenerated to match.";
    $("#fyFormSaveBtn").textContent = "Save Changes";
    $("#fyFormStartDate").value = fy.startDate;
    $("#fyFormEndDate").value = fy.endDate;
    $("#fyFormName").value = fy.name;
    $("#fyFormNotes").value = fy.notes || "";
    clearFormErrors();
    openModal("fyFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const start = $("#fyFormStartDate").value;
    const end = $("#fyFormEndDate").value;
    const name = $("#fyFormName").value.trim();

    if (!start) { setFormError("fyFormStartDate", "Start date is required."); valid = false; }
    if (!end) { setFormError("fyFormEndDate", "End date is required."); valid = false; }
    if (start && end && end <= start) { setFormError("fyFormEndDate", "End date must be after the start date."); valid = false; }

    if (!name) { setFormError("fyFormName", "Financial year name is required."); valid = false; }
    else if (name.length > 40) { setFormError("fyFormName", "Maximum 40 characters allowed."); valid = false; }
    else {
      const clash = ERP_FinancialYearRepository.getAllForCompany(company.id)
        .find((fy) => fy.id !== editingId && fy.name.trim().toLowerCase() === name.toLowerCase());
      if (clash) { setFormError("fyFormName", "Another financial year already uses this name."); valid = false; }
    }

    if (valid && start && end) {
      if (ERP_FinancialYearRepository.hasDateOverlap(company.id, start, end, editingId)) {
        setFormError("fyFormEndDate", "This date range overlaps an existing financial year.");
        valid = false;
      }
    }

    return valid;
  }

  function bindFormModal() {
    $("#fyCreateBtn").addEventListener("click", openCreateModal);
    $("#fyFormStartDate").addEventListener("change", refreshSuggestions);

    $("#fyFormResetBtn").addEventListener("click", () => {
      if (editingId) {
        const original = ERP_FinancialYearRepository.findById(editingId);
        if (original) { openEditModal(original); return; }
      }
      openCreateModal();
    });

    $("#fyFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        startDate: $("#fyFormStartDate").value,
        endDate: $("#fyFormEndDate").value,
        name: $("#fyFormName").value.trim(),
        notes: $("#fyFormNotes").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this financial year?",
          message: "Since dates may have changed, its 12 monthly periods will be regenerated to match.",
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_FinancialYearRepository.update(editingId, payload);
            ERP_FinancialYearRepository.regeneratePeriods(editingId);
            logSystemActivity({ module: "Financial Year", action: "Update", description: `Updated financial year "${payload.name}" for ${company.name}` });
            closeModal("fyFormModal");
            renderAll();
            renderActivity();
            showToast("Financial year updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this financial year?",
          message: `"${payload.name}" will be created as a Draft with 12 monthly periods, running ${formatDateOnly(payload.startDate)} to ${formatDateOnly(payload.endDate)}.`,
          confirmLabel: "Create Financial Year",
          onConfirm: () => {
            const created = ERP_FinancialYearRepository.create(company, payload);
            logSystemActivity({ module: "Financial Year", action: "Create", description: `Created financial year "${created.name}" (${created.fyCode}) for ${company.name}` });
            closeModal("fyFormModal");
            renderAll();
            renderActivity();
            showToast("Financial year created as Draft.", "success");

            // Guide new users: if no year is Current yet for this company, offer to activate this one now.
            if (!ERP_FinancialYearRepository.getCurrent(company.id)) {
              openConfirm({
                title: "Set this as the current financial year?",
                message: `No financial year is currently active for ${company.name} yet. Activate "${created.name}" now so future modules have an open year to post against?`,
                confirmLabel: "Set as Current",
                onConfirm: () => activateFY(created.id)
              });
            }
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (shared by row quick-actions and the detail modal)
     --------------------------------------------------------------------- */
  function activateFY(id) {
    const fy = ERP_FinancialYearRepository.findById(id);
    if (!fy) return;
    ERP_FinancialYearRepository.setCurrent(id);
    logSystemActivity({ module: "Financial Year", action: "Activate", description: `Set "${fy.name}" as the current financial year for ${company.name}` });
    renderAll();
    renderActivity();
    showToast(`"${fy.name}" is now the current financial year.`, "success");
  }

  function requestSetCurrent(fy) {
    const existingCurrent = ERP_FinancialYearRepository.getCurrent(company.id);
    if (existingCurrent && existingCurrent.id !== fy.id) {
      showToast(`Close "${existingCurrent.name}" before activating a new financial year — only one can be current at a time.`, "warning", { title: "A year is already current" });
      return;
    }
    openConfirm({
      title: "Set as current financial year?",
      message: `"${fy.name}" will become the open year that future transactions post against.`,
      confirmLabel: "Set as Current",
      onConfirm: () => activateFY(fy.id)
    });
  }

  function requestClose(fy) {
    openConfirm({
      title: "Close this financial year?",
      message: `"${fy.name}" and all 12 of its periods will be marked Closed. You can still reopen it later if needed.`,
      confirmLabel: "Close Financial Year",
      onConfirm: () => {
        ERP_FinancialYearRepository.closeFY(fy.id);
        logSystemActivity({ module: "Financial Year", action: "Close", description: `Closed financial year "${fy.name}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === fy.id) openDetailModal(ERP_FinancialYearRepository.findById(fy.id));
        showToast(`"${fy.name}" has been closed.`, "success");
      }
    });
  }

  function requestReopen(fy) {
    const existingCurrent = ERP_FinancialYearRepository.getCurrent(company.id);
    if (existingCurrent && existingCurrent.id !== fy.id) {
      showToast(`Close "${existingCurrent.name}" first — only one financial year can be current at a time.`, "warning", { title: "A year is already current" });
      return;
    }
    openConfirm({
      title: "Reopen this financial year?",
      message: `"${fy.name}" will become Current again. Its periods stay Closed until you reopen them individually below.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_FinancialYearRepository.reopenFY(fy.id);
        logSystemActivity({ module: "Financial Year", action: "Reopen", description: `Reopened financial year "${fy.name}" for ${company.name}`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === fy.id) openDetailModal(ERP_FinancialYearRepository.findById(fy.id));
        showToast(`"${fy.name}" has been reopened.`, "success");
      }
    });
  }

  function requestLock(fy) {
    openConfirm({
      title: "Permanently lock this financial year?",
      message: `This seals "${fy.name}" for good — locked years can never be reopened or edited again, the same way a real ERP protects audited, filed books. This cannot be undone.`,
      confirmLabel: "Lock Permanently",
      onConfirm: () => {
        ERP_FinancialYearRepository.lockFY(fy.id);
        logSystemActivity({ module: "Financial Year", action: "Lock", description: `Permanently locked financial year "${fy.name}" for ${company.name}`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === fy.id) closeModal("fyDetailModal");
        showToast(`"${fy.name}" is now permanently locked.`, "success");
      }
    });
  }

  function requestDelete(fy) {
    openConfirm({
      title: "Delete this financial year?",
      message: `"${fy.name}" is still a Draft with no activity, so it can be safely removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_FinancialYearRepository.remove(fy.id);
        logSystemActivity({ module: "Financial Year", action: "Delete", description: `Deleted draft financial year "${fy.name}" for ${company.name}`, severity: "warning" });
        if (detailId === fy.id) closeModal("fyDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${fy.name}" has been deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL (view + periods + contextual lifecycle footer)
     --------------------------------------------------------------------- */
  function renderPeriodsTable(fy) {
    $("#fyPeriodsTableBody").innerHTML = fy.periods.map((p) => {
      const canToggle = fy.status === "Current";
      return `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${formatDateOnly(p.startDate)}</td>
        <td>${formatDateOnly(p.endDate)}</td>
        <td><span class="status-badge status-badge--${p.status === "Open" ? "success" : "info"}">${p.status}</span></td>
        <td>${canToggle ? `<button type="button" class="link-btn" data-period-toggle="${p.id}">${p.status === "Open" ? "Close Period" : "Reopen Period"}</button>` : ""}</td>
      </tr>`;
    }).join("");
  }

  function renderDetailFooter(fy) {
    const footer = $("#fyDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
      return btn;
    };

    if (fy.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(fy));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("fyDetailModal"); openEditModal(fy); });
      addBtn("Set as Current", "btn btn--primary", () => requestSetCurrent(fy));
    } else if (fy.status === "Current") {
      addBtn("Close Financial Year", "btn btn--primary", () => requestClose(fy));
    } else if (fy.status === "Closed") {
      addBtn("Lock Permanently", "btn btn--danger-outline", () => requestLock(fy));
      addBtn("Reopen", "btn btn--primary", () => requestReopen(fy));
    } else if (fy.status === "Locked") {
      const note = document.createElement("p");
      note.className = "field-hint";
      note.textContent = "This financial year is permanently locked — no further changes are possible.";
      footer.appendChild(note);
    }
  }

  function openDetailModal(fy) {
    detailId = fy.id;
    $("#fyDetailTitle").textContent = `${fy.name} · ${fy.fyCode}`;
    const closedPeriods = fy.periods.filter((p) => p.status === "Closed").length;
    $("#fyDetailBody").innerHTML = `
      <div><dt>Financial Year</dt><dd>${escapeHtml(fy.name)}</dd></div>
      <div><dt>FY Code</dt><dd>${escapeHtml(fy.fyCode)}</dd></div>
      <div><dt>Start Date</dt><dd>${formatDateOnly(fy.startDate)}</dd></div>
      <div><dt>End Date</dt><dd>${formatDateOnly(fy.endDate)}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${STATUS_BADGE[fy.status]}">${fy.status}</span></dd></div>
      <div><dt>Periods Closed</dt><dd>${closedPeriods} of ${fy.periods.length}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(fy.createdAt))}</dd></div>
      ${fy.closedAt ? `<div><dt>Closed</dt><dd>${formatDateTime(new Date(fy.closedAt))}</dd></div>` : ""}
      ${fy.lockedAt ? `<div><dt>Locked</dt><dd>${formatDateTime(new Date(fy.lockedAt))}</dd></div>` : ""}
      ${fy.notes ? `<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(fy.notes)}</dd></div>` : ""}
    `;
    renderPeriodsTable(fy);
    renderDetailFooter(fy);
    openModal("fyDetailModal");
  }

  function bindDetailModal() {
    $("#fyTableBody").addEventListener("click", (e) => {
      const periodBtn = e.target.closest("[data-period-toggle]");
      if (periodBtn) return; // periods table only exists inside the modal; guard just in case

      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");

      if (viewBtn) {
        const fy = ERP_FinancialYearRepository.findById(viewBtn.dataset.id);
        if (fy) openDetailModal(fy);
        return;
      }
      if (actionBtn) {
        const fy = ERP_FinancialYearRepository.findById(actionBtn.dataset.id);
        if (!fy) return;
        const action = actionBtn.dataset.action;
        if (action === "set-current") requestSetCurrent(fy);
        else if (action === "close") requestClose(fy);
        else if (action === "lock") requestLock(fy);
      }
    });

    $("#fyPeriodsTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-period-toggle]");
      if (!btn) return;
      const fy = ERP_FinancialYearRepository.findById(detailId);
      if (!fy || fy.status !== "Current") return;
      const period = fy.periods.find((p) => p.id === btn.dataset.periodToggle);
      if (!period) return;

      const willClose = period.status === "Open";
      ERP_FinancialYearRepository.togglePeriod(fy.id, period.id);
      logSystemActivity({
        module: "Financial Year",
        action: willClose ? "Close Period" : "Reopen Period",
        description: `${willClose ? "Closed" : "Reopened"} period "${period.name}" in "${fy.name}" for ${company.name}`
      });
      const updated = ERP_FinancialYearRepository.findById(fy.id);
      renderPeriodsTable(updated);
      renderTable();
      renderActivity();
      showToast(`Period "${period.name}" ${willClose ? "closed" : "reopened"}.`, willClose ? "info" : "success");
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "financial-year")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading financial years…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#fyContent").hidden = true;
      $("#fySubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#fyContent").hidden = false;
      $("#fyHeaderActions").hidden = false;
      $("#fySubtitle").textContent = `Managing financial years for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
