/* =============================================================================
   DOT ERP — pages/currency.js
   Phase 2, Module 04: Currency

   Always works against the ACTIVE company. Company Profile owns the single
   `baseCurrency` field; this page reconciles that with the currency master
   on every load via ERP_CurrencyRepository.ensureBaseCurrency(), then lets
   the user add other currencies and maintain their exchange rates over time.
   Rate convention: currentRate = how many units of the base currency equal
   1 unit of this currency (see data/currency-data.js for the full rationale).
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
  let base = null;          // this company's base currency record
  let filterStatus = "all";
  let sortOrder = "asc";
  let searchTerm = "";
  let page = 1;
  let addingCurrencyRef = null; // reference-list entry currently selected in the Add modal
  let rateModalCurrencyId = null;
  let detailId = null;


  /* -----------------------------------------------------------------------
     DATE-ONLY FORMATTING — same convention as financial-year.js, kept local
     to this file rather than shared, since these are two independently
     built modules that each only need a small, self-contained helper.
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
  function formatRate(rate, decimalPlaces) {
    return Number(rate).toFixed(Math.max(2, Math.min(6, decimalPlaces + 2)));
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_CurrencyRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((c) => (c.isBase ? "Active" : c.status) === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((c) => c.code.toLowerCase().includes(term) || c.name.toLowerCase().includes(term));
    }

    const nonBase = rows.filter((c) => !c.isBase).sort((a, b) => {
      const diff = a.code.localeCompare(b.code);
      return sortOrder === "desc" ? -diff : diff;
    });
    const baseRow = rows.find((c) => c.isBase);
    return baseRow ? [baseRow, ...nonBase] : nonBase;
  }

  function lastRateUpdateAcross(all) {
    let latest = null;
    all.forEach((c) => {
      const entry = c.rateHistory[c.rateHistory.length - 1];
      if (entry && (!latest || entry.updatedAt > latest.updatedAt)) latest = entry;
    });
    return latest;
  }

  function renderSummary() {
    const all = ERP_CurrencyRepository.getAllForCompany(company.id);
    $("#curSummaryTotal").textContent = String(all.length);
    $("#curSummaryBase").textContent = base ? `${base.code} — ${base.name}` : "—";
    $("#curSummaryActive").textContent = String(all.filter((c) => c.isBase || c.status === "Active").length);
    const latest = lastRateUpdateAcross(all);
    $("#curSummaryLastUpdate").textContent = latest ? formatDateOnly(latest.effectiveDate) : "Never";
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#curPagination");
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

    $("#curEmptyState").hidden = all.length !== 0;
    $("#curTable").hidden = all.length === 0;

    $("#curTableBody").innerHTML = pageItems.map((c) => {
      const lastEntry = c.rateHistory[c.rateHistory.length - 1];
      const rateCell = c.isBase
        ? `<span class="profile-subtle">1.00 (Base)</span>`
        : `${formatRate(c.currentRate, c.decimalPlaces)} <span class="profile-subtle">${base ? base.code : ""}</span>`;
      const statusBadge = c.isBase
        ? `<span class="status-badge status-badge--info">Base Currency</span>`
        : `<span class="status-badge status-badge--${c.status === "Active" ? "success" : "danger"}">${c.status}</span>`;
      const quickAction = c.isBase ? "" : `<button type="button" class="link-btn" data-action="rate" data-id="${c.id}">Update Rate</button>`;

      return `
      <tr>
        <td><code>${escapeHtml(c.code)}</code></td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.symbol)}</td>
        <td>${rateCell}</td>
        <td>${statusBadge}</td>
        <td>${lastEntry ? formatDateOnly(lastEntry.effectiveDate) : "—"}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${c.id}">View</button>
          ${quickAction}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); renderConverterOptions(); }


  /* -----------------------------------------------------------------------
     QUICK CONVERTER
     --------------------------------------------------------------------- */
  function renderConverterOptions() {
    const all = ERP_CurrencyRepository.getAllForCompany(company.id).filter((c) => c.isBase || c.status === "Active");
    const previousValue = $("#convCurrency").value;
    $("#convCurrency").innerHTML = all.map((c) => `<option value="${c.id}">${escapeHtml(c.code)} — ${escapeHtml(c.name)}</option>`).join("");
    const stillExists = all.some((c) => c.id === previousValue);
    $("#convCurrency").value = stillExists ? previousValue : (all.find((c) => !c.isBase)?.id || all[0]?.id || "");
    updateConverterResult();
  }

  function updateConverterResult() {
    const amount = parseFloat($("#convAmount").value);
    const currency = ERP_CurrencyRepository.findById($("#convCurrency").value);
    if (!currency || isNaN(amount)) {
      $("#convResult").textContent = "—";
      $("#convRateHint").textContent = "";
      return;
    }
    if (currency.isBase) {
      $("#convResult").textContent = `${currency.symbol}${amount.toFixed(currency.decimalPlaces)} ${currency.code}`;
      $("#convRateHint").textContent = `${currency.code} is your base currency — no conversion needed.`;
      return;
    }
    const converted = amount * currency.currentRate;
    $("#convResult").textContent = `${currency.symbol}${amount.toFixed(currency.decimalPlaces)} ${currency.code} = ${base.symbol}${converted.toFixed(base.decimalPlaces)} ${base.code}`;
    $("#convRateHint").textContent = `At the current stored rate: 1 ${currency.code} = ${formatRate(currency.currentRate, currency.decimalPlaces)} ${base.code}.`;
  }

  function bindConverter() {
    $("#convAmount").addEventListener("input", updateConverterResult);
    $("#convCurrency").addEventListener("change", updateConverterResult);
  }


  /* -----------------------------------------------------------------------
     TOOLBAR: status chips, sort, search, export, print
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#curStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#curStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#curSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#curSortBtn").textContent = sortOrder === "asc" ? "Code A-Z" : "Code Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#curExportCsvBtn").addEventListener("click", exportCsv);
    $("#curPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Symbol", "Rate to Base", "Status", "Last Updated"];
    const csvRows = [header.join(",")];
    rows.forEach((c) => {
      const lastEntry = c.rateHistory[c.rateHistory.length - 1];
      const line = [
        c.code, c.name, c.symbol, c.isBase ? "1.00 (Base)" : formatRate(c.currentRate, c.decimalPlaces),
        c.isBase ? "Base Currency" : c.status, lastEntry ? formatDateOnly(lastEntry.effectiveDate) : ""
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-currencies-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Currencies exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((c) => {
      const lastEntry = c.rateHistory[c.rateHistory.length - 1];
      return `<tr><td>${escapeHtml(c.code)}</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.symbol)}</td><td>${c.isBase ? "1.00 (Base)" : formatRate(c.currentRate, c.decimalPlaces)}</td><td>${c.isBase ? "Base Currency" : c.status}</td><td>${lastEntry ? formatDateOnly(lastEntry.effectiveDate) : "—"}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Currency Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Currency Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Symbol</th><th>Rate to Base</th><th>Status</th><th>Last Updated</th></tr></thead>
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
      .filter((e) => e.module === "Currency")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#curActivityEmptyState").hidden = relevant.length !== 0;
    $("#curActivityList").innerHTML = relevant.map((e) => `
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
     ADD CURRENCY MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }

  function refreshAddFieldsForSelection() {
    const ref = ERP_CurrencyRepository.availableToAdd(company.id).find((c) => c.code === $("#curAddSelect").value);
    addingCurrencyRef = ref || null;
    $("#curAddRateLabel").textContent = ref ? `Rate (1 ${ref.code} = ? ${base.code})` : "Rate";
  }

  function openAddModal() {
    const available = ERP_CurrencyRepository.availableToAdd(company.id);
    setFormError("curAddSelect", "");
    setFormError("curAddRate", "");
    setFormError("curAddDate", "");

    if (!available.length) {
      showToast("Every reference currency has already been added for this company.", "info");
      return;
    }

    $("#curAddSelect").innerHTML = available.map((c) => `<option value="${c.code}">${escapeHtml(c.code)} — ${escapeHtml(c.name)}</option>`).join("");
    $("#curAddIntro").textContent = `Pick a currency to add, along with its starting exchange rate against ${base.code}.`;
    $("#curAddRate").value = "";
    $("#curAddDate").value = todayISO();
    $("#curAddNote").value = "";
    refreshAddFieldsForSelection();
    openModal("curAddModal");
  }

  function validateAddForm() {
    let valid = true;
    setFormError("curAddSelect", "");
    setFormError("curAddRate", "");
    setFormError("curAddDate", "");

    if (!addingCurrencyRef) { setFormError("curAddSelect", "Choose a currency."); valid = false; }
    else if (ERP_CurrencyRepository.findByCode(company.id, addingCurrencyRef.code)) {
      setFormError("curAddSelect", "This currency has already been added."); valid = false;
    }

    const rate = parseFloat($("#curAddRate").value);
    if (!$("#curAddRate").value || isNaN(rate) || rate <= 0) { setFormError("curAddRate", "Enter a rate greater than 0."); valid = false; }

    if (!$("#curAddDate").value) { setFormError("curAddDate", "Effective date is required."); valid = false; }

    return valid;
  }

  function bindAddModal() {
    $("#curAddBtn").addEventListener("click", openAddModal);
    $("#curAddSelect").addEventListener("change", refreshAddFieldsForSelection);

    $("#curAddSaveBtn").addEventListener("click", () => {
      if (!validateAddForm()) return;
      const ref = addingCurrencyRef;
      const rate = parseFloat($("#curAddRate").value);
      const effectiveDate = $("#curAddDate").value;
      const note = $("#curAddNote").value.trim();

      openConfirm({
        title: "Add this currency?",
        message: `${ref.code} — ${ref.name} will be added at 1 ${ref.code} = ${rate} ${base.code}.`,
        confirmLabel: "Add Currency",
        onConfirm: () => {
          const created = ERP_CurrencyRepository.create(company, {
            code: ref.code, name: ref.name, symbol: ref.symbol, decimalPlaces: ref.decimalPlaces,
            currentRate: rate, effectiveDate, note
          });
          logSystemActivity({ module: "Currency", action: "Create", description: `Added currency ${created.code} (${created.name}) for ${company.name} at 1 ${created.code} = ${rate} ${base.code}` });
          closeModal("curAddModal");
          renderAll();
          renderActivity();
          showToast(`${created.code} added.`, "success");
        }
      });
    });
  }


  /* -----------------------------------------------------------------------
     UPDATE RATE MODAL
     --------------------------------------------------------------------- */
  function openRateModal(currency) {
    rateModalCurrencyId = currency.id;
    setFormError("curRateNew", "");
    setFormError("curRateDate", "");
    $("#curRateTitle").textContent = `Update rate — ${currency.code}`;
    $("#curRateIntro").textContent = `Current rate: 1 ${currency.code} = ${formatRate(currency.currentRate, currency.decimalPlaces)} ${base.code}.`;
    $("#curRateNewLabel").textContent = `New Rate (1 ${currency.code} = ? ${base.code})`;
    $("#curRateNew").value = "";
    $("#curRateDate").value = todayISO();
    $("#curRateNote").value = "";
    openModal("curRateModal");
  }

  function bindRateModal() {
    $("#curRateSaveBtn").addEventListener("click", () => {
      let valid = true;
      setFormError("curRateNew", "");
      setFormError("curRateDate", "");
      const rate = parseFloat($("#curRateNew").value);
      if (!$("#curRateNew").value || isNaN(rate) || rate <= 0) { setFormError("curRateNew", "Enter a rate greater than 0."); valid = false; }
      if (!$("#curRateDate").value) { setFormError("curRateDate", "Effective date is required."); valid = false; }
      if (!valid) return;

      const currency = ERP_CurrencyRepository.findById(rateModalCurrencyId);
      const effectiveDate = $("#curRateDate").value;
      const note = $("#curRateNote").value.trim();

      openConfirm({
        title: "Update this exchange rate?",
        message: `${currency.code}'s rate will change to 1 ${currency.code} = ${rate} ${base.code}, effective ${formatDateOnly(effectiveDate)}.`,
        confirmLabel: "Update Rate",
        onConfirm: () => {
          ERP_CurrencyRepository.updateRate(currency.id, { rate, effectiveDate, note });
          logSystemActivity({ module: "Currency", action: "Update Rate", description: `Updated ${currency.code}'s rate to 1 ${currency.code} = ${rate} ${base.code} for ${company.name}` });
          closeModal("curRateModal");
          renderAll();
          renderActivity();
          if (detailId === currency.id) openDetailModal(ERP_CurrencyRepository.findById(currency.id));
          showToast(`${currency.code}'s rate has been updated.`, "success");
        }
      });
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (toggle status / delete) — shared by quick actions
     and the detail modal footer.
     --------------------------------------------------------------------- */
  function requestToggleStatus(currency) {
    const activating = currency.status !== "Active";
    openConfirm({
      title: activating ? "Reactivate this currency?" : "Deactivate this currency?",
      message: activating
        ? `${currency.code} will become Active again and available for conversions.`
        : `${currency.code} will be marked Inactive. Its rate history is kept, and it can be reactivated any time.`,
      confirmLabel: activating ? "Reactivate" : "Deactivate",
      onConfirm: () => {
        ERP_CurrencyRepository.toggleStatus(currency.id);
        logSystemActivity({ module: "Currency", action: activating ? "Reactivate" : "Deactivate", description: `${activating ? "Reactivated" : "Deactivated"} currency ${currency.code} for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === currency.id) openDetailModal(ERP_CurrencyRepository.findById(currency.id));
        showToast(`${currency.code} is now ${activating ? "Active" : "Inactive"}.`, "success");
      }
    });
  }

  function requestDelete(currency) {
    openConfirm({
      title: "Delete this currency?",
      message: `${currency.code} — ${currency.name} and its full rate history will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_CurrencyRepository.remove(currency.id);
        logSystemActivity({ module: "Currency", action: "Delete", description: `Deleted currency ${currency.code} for ${company.name}`, severity: "warning" });
        if (detailId === currency.id) closeModal("curDetailModal");
        renderAll();
        renderActivity();
        showToast(`${currency.code} has been deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL (view + rate history + contextual lifecycle footer)
     --------------------------------------------------------------------- */
  function renderRateHistory(currency) {
    const rows = currency.rateHistory.slice().reverse();
    $("#curRateHistoryBody").innerHTML = rows.map((r) => `
      <tr>
        <td>${formatDateOnly(r.effectiveDate)}</td>
        <td>1 ${escapeHtml(currency.code)} = ${formatRate(r.rate, currency.decimalPlaces)} ${base.code}</td>
        <td>${escapeHtml(r.note || "—")}</td>
        <td>${formatDateTime(new Date(r.updatedAt))}</td>
      </tr>`).join("");
  }

  function renderDetailFooter(currency) {
    const footer = $("#curDetailFooter");
    footer.innerHTML = "";
    if (currency.isBase) {
      const note = document.createElement("p");
      note.className = "field-hint";
      note.textContent = "This is the company's base currency — it's managed automatically from Company Profile and can't be deactivated or deleted.";
      footer.appendChild(note);
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
    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(currency));
    addBtn(currency.status === "Active" ? "Deactivate" : "Reactivate", "btn btn--ghost", () => requestToggleStatus(currency));
    addBtn("Update Rate", "btn btn--primary", () => { closeModal("curDetailModal"); openRateModal(currency); });
  }

  function openDetailModal(currency) {
    detailId = currency.id;
    $("#curDetailTitle").textContent = `${currency.code} — ${currency.name}`;
    $("#curDetailBody").innerHTML = `
      <div><dt>Code</dt><dd>${escapeHtml(currency.code)}</dd></div>
      <div><dt>Name</dt><dd>${escapeHtml(currency.name)}</dd></div>
      <div><dt>Symbol</dt><dd>${escapeHtml(currency.symbol)}</dd></div>
      <div><dt>Decimal Places</dt><dd>${currency.decimalPlaces}</dd></div>
      <div><dt>Current Rate</dt><dd>${currency.isBase ? "1.00 (Base)" : `1 ${escapeHtml(currency.code)} = ${formatRate(currency.currentRate, currency.decimalPlaces)} ${base.code}`}</dd></div>
      <div><dt>Status</dt><dd>${currency.isBase ? `<span class="status-badge status-badge--info">Base Currency</span>` : `<span class="status-badge status-badge--${currency.status === "Active" ? "success" : "danger"}">${currency.status}</span>`}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(currency.createdAt))}</dd></div>
    `;
    renderRateHistory(currency);
    renderDetailFooter(currency);
    openModal("curDetailModal");
  }

  function bindDetailModal() {
    $("#curTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");

      if (viewBtn) {
        const currency = ERP_CurrencyRepository.findById(viewBtn.dataset.id);
        if (currency) openDetailModal(currency);
        return;
      }
      if (actionBtn && actionBtn.dataset.action === "rate") {
        const currency = ERP_CurrencyRepository.findById(actionBtn.dataset.id);
        if (currency) openRateModal(currency);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "currency")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading currency master…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#curContent").hidden = true;
      $("#curSubtitle").textContent = "No active company yet.";
    } else {
      base = ERP_CurrencyRepository.ensureBaseCurrency(company);
      $("#noCompanyState").hidden = true;
      $("#curContent").hidden = false;
      $("#curHeaderActions").hidden = false;
      $("#curSubtitle").textContent = `Managing currencies for ${company.name} (${company.companyCode}). Base currency: ${base.code}.`;
      renderAll();
      renderActivity();
      bindToolbar();
      bindConverter();
      bindAddModal();
      bindRateModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
