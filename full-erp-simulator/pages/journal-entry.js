/* =============================================================================
   DOT ERP — pages/journal-entry.js
   Phase 6, Module 02: Journal Entry

   THE NEW PIECE THIS PAGE OWNS: a live, single-screen, add/remove-row line
   table with a totals footer that recomputes on every keystroke — see
   data/journal-entry-data.js's header for why no earlier line-item module's
   UI shape fit here. Rows are tracked by a page-local `rowId` (never sent
   to the repository) purely so the DOM can find "this row" again when a
   debit/credit input changes or a Remove button is clicked; the repository
   only ever sees the final `{accountId, debit, credit, lineNarration}`
   array on save.

   ONE INPUT RULE WORTH CALLING OUT: typing into a line's Debit field
   clears that same line's Credit field, and vice versa — enforced live,
   not just at save time — because a line being "one side or the other,
   never both" is Journal Entry's one hard rule, and catching it the
   instant it happens (the way Tally's own entry grid does) teaches the
   rule better than a validation error after the fact would.
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
  let filterStatus = "all";
  let filterSource = "all";
  let sortOrder = "desc"; // by entryDate
  let page = 1;
  let editingId = null;
  let detailId = null;
  let formLines = []; // [{rowId, accountId, debit, credit, lineNarration}]
  let rowCounter = 0;


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_JournalEntryRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((e) => e.status === filterStatus);
    if (filterSource === "Manual") rows = rows.filter((e) => e.source === "Manual");
    if (filterSource === "Auto") rows = rows.filter((e) => e.source !== "Manual");

    rows = rows.slice().sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));
    return sortOrder === "desc" ? rows.reverse() : rows;
  }

  function renderSummary() {
    const all = ERP_JournalEntryRepository.getAllForCompany(company.id);
    $("#jeSummaryTotal").textContent = String(all.length);
    $("#jeSummaryDraft").textContent = String(all.filter((e) => e.status === "Draft").length);
    $("#jeSummaryPosted").textContent = String(all.filter((e) => e.status === "Posted").length);
    $("#jeSummaryReversed").textContent = String(all.filter((e) => e.reversedByEntryId).length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#jePagination");
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

  function statusBadgeFor(status) {
    const tone = status === "Posted" ? "success" : status === "Cancelled" ? "danger" : "neutral";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#jeEmptyState").hidden = all.length !== 0;
    $("#jeTable").hidden = all.length === 0;

    $("#jeTableBody").innerHTML = pageItems.map((e) => {
      const totals = ERP_JournalEntryRepository.computeTotals(e);
      const reversedTag = e.reversedByEntryId ? ` <span class="status-badge status-badge--warning">Reversed</span>` : "";
      return `
      <tr>
        <td><code>${escapeHtml(e.entryNumber)}</code></td>
        <td>${escapeHtml(e.entryDate)}</td>
        <td>${escapeHtml(e.narration || "—")}</td>
        <td class="text-right">${formatCurrency(totals.totalDebit)}</td>
        <td class="text-right">${formatCurrency(totals.totalCredit)}</td>
        <td>${statusBadgeFor(e.status)}${reversedTag}</td>
        <td>${escapeHtml(e.source)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${e.id}">View</button></td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() {
    renderSummary();
    renderTable();
  }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#jeStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#jeStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $$("#jeSourceChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#jeSourceChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterSource = chip.dataset.source;
        page = 1;
        renderTable();
      });
    });

    $("#jeSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#jeSortBtn").textContent = sortOrder === "asc" ? "Date ↑" : "Date ↓";
      page = 1;
      renderTable();
    });

    $("#jeExportCsvBtn").addEventListener("click", exportCsv);
    $("#jePrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Entry #", "Date", "Narration", "Total Debit", "Total Credit", "Status", "Source"];
    const csvRows = [header.join(",")];
    rows.forEach((e) => {
      const t = ERP_JournalEntryRepository.computeTotals(e);
      const line = [e.entryNumber, e.entryDate, e.narration || "", t.totalDebit.toFixed(2), t.totalCredit.toFixed(2), e.status, e.source]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-journal-entries-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Journal entries exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((e) => {
      const t = ERP_JournalEntryRepository.computeTotals(e);
      return `<tr><td>${escapeHtml(e.entryNumber)}</td><td>${escapeHtml(e.entryDate)}</td><td>${escapeHtml(e.narration || "—")}</td><td>${formatCurrency(t.totalDebit)}</td><td>${formatCurrency(t.totalCredit)}</td><td>${e.status}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Journal Entries</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#1E3A8A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Journal Entries</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Entry #</th><th>Date</th><th>Narration</th><th>Debit</th><th>Credit</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Journal Entry")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#jeActivityEmptyState").hidden = relevant.length !== 0;
    $("#jeActivityList").innerHTML = relevant.map((e) => `
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
     LINE TABLE (form) — add/remove rows, live totals, mutually-exclusive
     debit/credit per row. See file header for why this shape is new.
     --------------------------------------------------------------------- */
  function accountOptionsHtml(selectedId) {
    const accounts = ERP_ChartOfAccountsRepository.getPostableForCompany(company.id);
    const options = accounts.map((a) => {
      const label = ERP_ChartOfAccountsRepository.getBreadcrumbLabel(company.id, a.id);
      const sel = a.id === selectedId ? " selected" : "";
      return `<option value="${a.id}"${sel}>${escapeHtml(label)}</option>`;
    }).join("");
    return `<option value="">Select account…</option>` + options;
  }

  function renderLineRows() {
    $("#jeLineTableBody").innerHTML = formLines.map((line) => `
      <tr data-row-id="${line.rowId}">
        <td><select class="select-field je-line-account">${accountOptionsHtml(line.accountId)}</select></td>
        <td><div class="input-wrap"><input type="number" class="je-line-debit" min="0" step="0.01" placeholder="0.00" value="${line.debit || ""}" /></div></td>
        <td><div class="input-wrap"><input type="number" class="je-line-credit" min="0" step="0.01" placeholder="0.00" value="${line.credit || ""}" /></div></td>
        <td><div class="input-wrap"><input type="text" class="je-line-narration" maxlength="100" value="${escapeHtml(line.lineNarration || "")}" /></div></td>
        <td><button type="button" class="link-btn je-remove-line">Remove</button></td>
      </tr>
    `).join("");
    updateTotalsDisplay();
  }

  function updateTotalsDisplay() {
    const totals = ERP_JournalEntryRepository.computeTotals({ lines: formLines });
    $("#jeTotalDebit").textContent = formatCurrency(totals.totalDebit);
    $("#jeTotalCredit").textContent = formatCurrency(totals.totalCredit);
    const statusEl = $("#jeBalanceStatus");
    if (formLines.length === 0) {
      statusEl.textContent = "";
    } else if (totals.isBalanced) {
      statusEl.innerHTML = `<span class="je-balance-ok">Balanced</span>`;
    } else {
      const short = totals.difference > 0 ? "Credit" : "Debit";
      statusEl.innerHTML = `<span class="je-balance-off">Out of balance — ${short} short by ${formatCurrency(Math.abs(totals.difference))}</span>`;
    }
  }

  function addLine() {
    rowCounter += 1;
    formLines.push({ rowId: "row-" + rowCounter, accountId: "", debit: "", credit: "", lineNarration: "" });
    renderLineRows();
  }

  function removeLine(rowId) {
    formLines = formLines.filter((l) => l.rowId !== rowId);
    renderLineRows();
  }

  function syncLineFromRow(tr) {
    const rowId = tr.dataset.rowId;
    const line = formLines.find((l) => l.rowId === rowId);
    if (!line) return;
    line.accountId = tr.querySelector(".je-line-account").value;
    line.debit = tr.querySelector(".je-line-debit").value;
    line.credit = tr.querySelector(".je-line-credit").value;
    line.lineNarration = tr.querySelector(".je-line-narration").value;
  }

  function bindLineTable() {
    $("#jeAddLineBtn").addEventListener("click", addLine);

    $("#jeLineTableBody").addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".je-remove-line");
      if (!removeBtn) return;
      const tr = removeBtn.closest("tr");
      removeLine(tr.dataset.rowId);
    });

    // Debit/Credit are mutually exclusive PER ROW, enforced live — see
    // file header. Delegated on the tbody since rows are re-rendered.
    $("#jeLineTableBody").addEventListener("input", (e) => {
      const tr = e.target.closest("tr");
      if (!tr) return;
      if (e.target.classList.contains("je-line-debit") && Number(e.target.value) > 0) {
        const creditInput = tr.querySelector(".je-line-credit");
        if (Number(creditInput.value) > 0) creditInput.value = "";
      } else if (e.target.classList.contains("je-line-credit") && Number(e.target.value) > 0) {
        const debitInput = tr.querySelector(".je-line-debit");
        if (Number(debitInput.value) > 0) debitInput.value = "";
      }
      syncLineFromRow(tr);
      updateTotalsDisplay();
    });

    $("#jeLineTableBody").addEventListener("change", (e) => {
      const tr = e.target.closest("tr");
      if (tr && e.target.classList.contains("je-line-account")) syncLineFromRow(tr);
    });
  }


  /* -----------------------------------------------------------------------
     ADD / EDIT ENTRY MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["jeFormNarration", "jeFormLines"].forEach((f) => setFormError(f, ""));
  }

  function openAddModal() {
    editingId = null;
    $("#jeFormTitle").textContent = "New journal entry";
    $("#jeFormIntro").textContent = "This saves as a Draft — you can edit it freely and it doesn't need to balance yet. Posting is a separate step from the entry's detail view.";
    $("#jeFormSaveBtn").textContent = "Save Draft";
    $("#jeFormDate").value = new Date().toISOString().slice(0, 10);
    $("#jeFormNarration").value = "";
    formLines = [];
    rowCounter = 0;
    addLine();
    addLine();
    clearFormErrors();
    openModal("jeFormModal");
  }

  function openEditModal(entry) {
    editingId = entry.id;
    $("#jeFormTitle").textContent = `Edit ${entry.entryNumber}`;
    $("#jeFormIntro").textContent = "Still a Draft — free to edit, and it still doesn't need to balance until you post it.";
    $("#jeFormSaveBtn").textContent = "Save Changes";
    $("#jeFormDate").value = entry.entryDate;
    $("#jeFormNarration").value = entry.narration || "";
    rowCounter = 0;
    formLines = (entry.lines || []).map((l) => {
      rowCounter += 1;
      return { rowId: "row-" + rowCounter, accountId: l.accountId, debit: l.debit || "", credit: l.credit || "", lineNarration: l.lineNarration || "" };
    });
    if (formLines.length === 0) { addLine(); addLine(); } else { renderLineRows(); }
    clearFormErrors();
    openModal("jeFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const narration = $("#jeFormNarration").value.trim();
    if (!narration) { setFormError("jeFormNarration", "Narration is required — say what this entry is for."); valid = false; }

    const nonEmptyLines = formLines.filter((l) => l.accountId || Number(l.debit) > 0 || Number(l.credit) > 0);
    if (nonEmptyLines.length < 2) {
      setFormError("jeFormLines", "At least 2 lines are required for a valid double-entry."); valid = false;
    } else {
      const incomplete = nonEmptyLines.some((l) => !l.accountId || (!Number(l.debit) && !Number(l.credit)));
      if (incomplete) { setFormError("jeFormLines", "Every line needs an account and either a debit or a credit amount."); valid = false; }
    }

    return valid;
  }

  function collectPayload() {
    const lines = formLines
      .filter((l) => l.accountId || Number(l.debit) > 0 || Number(l.credit) > 0)
      .map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        lineNarration: (l.lineNarration || "").trim()
      }));
    return {
      entryDate: $("#jeFormDate").value || new Date().toISOString().slice(0, 10),
      narration: $("#jeFormNarration").value.trim(),
      lines
    };
  }

  function bindFormModal() {
    $("#jeAddBtn").addEventListener("click", openAddModal);
    bindLineTable();

    $("#jeFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const payload = collectPayload();

      if (editingId) {
        ERP_JournalEntryRepository.update(editingId, payload);
        logSystemActivity({ module: "Journal Entry", action: "Update", description: `Updated draft entry "${$("#jeFormTitle").textContent}" for ${company.name}` });
        closeModal("jeFormModal");
        renderAll();
        renderActivity();
        if (detailId === editingId) openDetailModal(ERP_JournalEntryRepository.findById(editingId));
        showToast("Draft updated.", "success");
      } else {
        const created = ERP_JournalEntryRepository.create(company, payload, session.username);
        logSystemActivity({ module: "Journal Entry", action: "Create", description: `Created draft entry "${created.entryNumber}" for ${company.name}` });
        closeModal("jeFormModal");
        renderAll();
        renderActivity();
        showToast(`"${created.entryNumber}" saved as Draft.`, "success");
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function requestPost(e) {
    if (!ERP_JournalEntryRepository.canPost(company.id, e)) {
      const totals = ERP_JournalEntryRepository.computeTotals(e);
      const reason = (e.lines || []).length < 2
        ? "it needs at least 2 lines"
        : !totals.isBalanced
          ? `it's out of balance by ${formatCurrency(Math.abs(totals.difference))}`
          : "every line needs a valid Active Ledger account and exactly one of debit/credit";
      showToast(`Can't post "${e.entryNumber}" yet — ${reason}.`, "warning", { title: "Not ready to post" });
      return;
    }
    openConfirm({
      title: "Post this entry?",
      message: `"${e.entryNumber}" will become permanent accounting history. It can no longer be edited or deleted afterward — only reversed.`,
      confirmLabel: "Post Entry",
      onConfirm: () => {
        ERP_JournalEntryRepository.post(e.id, session.username);
        logSystemActivity({ module: "Journal Entry", action: "Post", description: `Posted entry "${e.entryNumber}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === e.id) openDetailModal(ERP_JournalEntryRepository.findById(e.id));
        showToast(`"${e.entryNumber}" posted.`, "success");
      }
    });
  }

  function requestCancel(e) {
    openConfirm({
      title: "Cancel this draft?",
      message: `"${e.entryNumber}" will be marked Cancelled. It stays on record but can never be posted.`,
      confirmLabel: "Cancel Entry",
      onConfirm: () => {
        ERP_JournalEntryRepository.cancel(e.id, session.username);
        logSystemActivity({ module: "Journal Entry", action: "Cancel", description: `Cancelled draft entry "${e.entryNumber}" for ${company.name}`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === e.id) openDetailModal(ERP_JournalEntryRepository.findById(e.id));
        showToast(`"${e.entryNumber}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(e) {
    openConfirm({
      title: "Delete this draft?",
      message: `"${e.entryNumber}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_JournalEntryRepository.remove(e.id);
        logSystemActivity({ module: "Journal Entry", action: "Delete", description: `Deleted draft entry "${e.entryNumber}" for ${company.name}`, severity: "warning" });
        if (detailId === e.id) closeModal("jeDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${e.entryNumber}" deleted.`, "info");
      }
    });
  }

  function requestReverse(e) {
    openConfirm({
      title: "Reverse this entry?",
      message: `A new, already-Posted entry will be created with every debit and credit swapped, linked back to "${e.entryNumber}". The original stays exactly as posted.`,
      confirmLabel: "Reverse Entry",
      onConfirm: () => {
        const reversal = ERP_JournalEntryRepository.reverse(e.id, session.username);
        logSystemActivity({ module: "Journal Entry", action: "Reverse", description: `Reversed entry "${e.entryNumber}" with "${reversal.entryNumber}" for ${company.name}`, severity: "warning" });
        renderAll();
        renderActivity();
        openDetailModal(ERP_JournalEntryRepository.findById(reversal.id));
        showToast(`"${e.entryNumber}" reversed as "${reversal.entryNumber}".`, "success");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(e) {
    const footer = $("#jeDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (e.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(e));
      addBtn("Cancel Entry", "btn btn--ghost", () => requestCancel(e));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("jeDetailModal"); openEditModal(e); });
      addBtn("Post Entry", "btn btn--primary", () => requestPost(e));
    } else if (e.status === "Posted") {
      if (ERP_JournalEntryRepository.canReverse(e)) {
        addBtn("Reverse Entry", "btn btn--danger-outline", () => requestReverse(e));
      }
    }
  }

  function openDetailModal(e) {
    detailId = e.id;
    const totals = ERP_JournalEntryRepository.computeTotals(e);

    $("#jeDetailTitle").textContent = `${e.entryNumber} · ${e.entryDate}`;
    $("#jeDetailBody").innerHTML = `
      <div><dt>Entry Number</dt><dd>${escapeHtml(e.entryNumber)}</dd></div>
      <div><dt>Date</dt><dd>${escapeHtml(e.entryDate)}</dd></div>
      <div><dt>Status</dt><dd>${statusBadgeFor(e.status)}</dd></div>
      <div><dt>Source</dt><dd>${escapeHtml(e.source)}</dd></div>
      <div><dt>Narration</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(e.narration || "—")}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(e.createdAt))} by ${escapeHtml(e.createdByUsername)}</dd></div>
      ${e.postedAt ? `<div><dt>Posted</dt><dd>${formatDateTime(new Date(e.postedAt))} by ${escapeHtml(e.postedByUsername)}</dd></div>` : ""}
      ${e.cancelledAt ? `<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(e.cancelledAt))} by ${escapeHtml(e.cancelledByUsername)}</dd></div>` : ""}
    `;

    $("#jeDetailLineTableBody").innerHTML = (e.lines || []).map((l) => {
      const account = ERP_ChartOfAccountsRepository.findById(l.accountId);
      const label = account ? ERP_ChartOfAccountsRepository.getBreadcrumbLabel(company.id, account.id) : "— account deleted —";
      return `<tr>
        <td>${escapeHtml(label)}</td>
        <td class="text-right">${l.debit ? formatCurrency(l.debit) : "—"}</td>
        <td class="text-right">${l.credit ? formatCurrency(l.credit) : "—"}</td>
        <td>${escapeHtml(l.lineNarration || "—")}</td>
      </tr>`;
    }).join("");
    $("#jeDetailTotalDebit").textContent = formatCurrency(totals.totalDebit);
    $("#jeDetailTotalCredit").textContent = formatCurrency(totals.totalCredit);

    let reversalNote = "";
    if (e.reversalOfEntryId) {
      const original = ERP_JournalEntryRepository.findById(e.reversalOfEntryId);
      reversalNote = `This entry reverses ${original ? escapeHtml(original.entryNumber) : "a deleted entry"}.`;
    }
    if (e.reversedByEntryId) {
      const rev = ERP_JournalEntryRepository.findById(e.reversedByEntryId);
      reversalNote += (reversalNote ? " " : "") + `This entry has been reversed by ${rev ? escapeHtml(rev.entryNumber) : "another entry"}.`;
    }
    $("#jeDetailReversalNote").textContent = reversalNote;

    renderDetailFooter(e);
    openModal("jeDetailModal");
  }

  function bindDetailModal() {
    $("#jeTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest(".row-detail-btn");
      if (!btn) return;
      const entry = ERP_JournalEntryRepository.findById(btn.dataset.id);
      if (entry) openDetailModal(entry);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "journal-entry")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading journal entries…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#jeContent").hidden = true;
      $("#jeSubtitle").textContent = "No active company yet.";
    } else if (ERP_ChartOfAccountsRepository.getPostableForCompany(company.id).length === 0) {
      $("#noAccountsState").hidden = false;
      $("#jeContent").hidden = true;
      $("#jeSubtitle").textContent = `No postable accounts yet for ${company.name}.`;
    } else {
      $("#noCompanyState").hidden = true;
      $("#noAccountsState").hidden = true;
      $("#jeContent").hidden = false;
      $("#jeHeaderActions").hidden = false;
      $("#jeSubtitle").textContent = `Recording journal entries for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
