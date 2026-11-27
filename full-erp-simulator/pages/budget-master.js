/* =============================================================================
   DOT ERP — pages/budget-master.js
   Phase 13, Module 01: Budget Master

   The entry UX is annual-amount-plus-distribution rather than 12 hand-typed
   cells per account — see data/budget-data.js's own header. Each account
   row carries one annual figure; "Distribute Evenly" spreads it across the
   FY's own periods with the remainder landing on the last one (Node-verified
   to sum exactly). The per-period grid stays visible and individually
   editable underneath, so the distribution is a starting point, never a lock.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity, actorLabel
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let filterStatus = "all";
  let page = 1;
  let editingId = null;
  let formLines = [];      // [{ accountId, periodAmounts: {P01: n, ...} }]
  let formFy = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function fyLabel(id) { const fy = ERP_FinancialYearRepository.findById(id); return fy ? (fy.name || fy.fyCode) : "—"; }
  function statusBadge(s) {
    const tone = s === "Approved" ? "success" : s === "Cancelled" ? "danger" : s === "Superseded" ? "neutral" : "warning";
    return `<span class="status-badge status-badge--${tone}">${s}</span>`;
  }

  function getFilteredSorted() {
    let rows = ERP_BudgetRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    return rows;
  }

  function renderSummary() {
    const all = ERP_BudgetRepository.getAllForCompany(company.id);
    $("#bmSummaryTotal").textContent = String(all.length);
    $("#bmSummaryDraft").textContent = String(all.filter((b) => b.status === "Draft").length);
    $("#bmSummaryApproved").textContent = String(all.filter((b) => b.status === "Approved").length);
    const approved = all.filter((b) => b.status === "Approved");
    const netTotal = approved.reduce((s, b) => s + ERP_BudgetRepository.getTotals(b).net, 0);
    $("#bmSummaryNet").textContent = formatMoney(netTotal);
  }

  function renderPagination(totalPages) {
    const c = $("#bmPagination");
    c.innerHTML = "";
    if (totalPages <= 1) return;
    const mk = (label, disabled, onClick, active) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "page-btn" + (active ? " is-active" : ""); b.textContent = label; b.disabled = !!disabled;
      b.addEventListener("click", onClick); return b;
    };
    c.appendChild(mk("‹", page === 1, () => { page--; renderTable(); }));
    for (let p = 1; p <= totalPages; p++) c.appendChild(mk(String(p), false, () => { page = p; renderTable(); }, p === page));
    c.appendChild(mk("›", page === totalPages, () => { page++; renderTable(); }));
  }

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const items = all.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE);

    $("#bmEmptyState").hidden = all.length !== 0;
    $("#bmTable").hidden = all.length === 0;

    $("#bmTableBody").innerHTML = items.map((b) => {
      const t = ERP_BudgetRepository.getTotals(b);
      return `
      <tr>
        <td><code>${escapeHtml(b.budgetCode)}</code></td>
        <td>${escapeHtml(b.budgetName || "—")}</td>
        <td>${escapeHtml(fyLabel(b.financialYearId))}</td>
        <td class="text-right">${formatMoney(t.income)}</td>
        <td class="text-right">${formatMoney(t.expense)}</td>
        <td class="text-right">${formatMoney(t.net)}</td>
        <td>${statusBadge(b.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${b.id}">View</button></td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#bmStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#bmStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#bmExportCsvBtn").addEventListener("click", exportCsv);
    $("#bmPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const lines = [["Budget Code", "Name", "Financial Year", "Income", "Expense", "Net", "Status"].join(",")];
    rows.forEach((b) => {
      const t = ERP_BudgetRepository.getTotals(b);
      lines.push([b.budgetCode, `"${b.budgetName || ""}"`, `"${fyLabel(b.financialYearId)}"`, t.income.toFixed(2), t.expense.toFixed(2), t.net.toFixed(2), b.status].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `budgets-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const rel = log.filter((e) => e.module === "Budget Master").sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8);
    $("#bmActivityEmptyState").hidden = rel.length !== 0;
    $("#bmActivityList").innerHTML = rel.map((e) => `
      <li class="activity-item">
        <span class="activity-item__icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>
        <div><p class="activity-item__text">${escapeHtml(e.description)}</p><p class="activity-item__time">${formatDateTime(new Date(e.timestamp))}</p></div>
      </li>`).join("");
  }

  /* ---------------- Create / edit modal ---------------- */

  function lineAnnualTotal(line) {
    return Object.values(line.periodAmounts || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  }

  function renderFormLines() {
    const periods = formFy ? formFy.periods || [] : [];
    if (!formLines.length) {
      $("#bmFormLinesBody").innerHTML = "";
      $("#bmFormLinesEmpty").hidden = false;
      $("#bmFormTotals").textContent = "";
      return;
    }
    $("#bmFormLinesEmpty").hidden = true;

    $("#bmFormLinesBody").innerHTML = formLines.map((line, i) => {
      const acc = ERP_ChartOfAccountsRepository.findById(line.accountId);
      const periodInputs = periods.map((p) => `
        <div class="budget-period-cell">
          <label>${escapeHtml(p.name)}</label>
          <div class="input-wrap"><input type="number" class="bm-period-input" data-index="${i}" data-period="${p.id}" step="0.01" value="${Number((line.periodAmounts || {})[p.id]) || 0}" /></div>
        </div>`).join("");
      return `
      <tr>
        <td>
          <div><code>${acc ? escapeHtml(String(acc.accountCode)) : "?"}</code> ${acc ? escapeHtml(acc.accountName) : "Unknown account"}</div>
          <div class="profile-subtle">${acc ? escapeHtml(acc.accountType) : ""}</div>
        </td>
        <td>
          <div class="input-wrap"><input type="number" class="bm-annual-input" data-index="${i}" step="0.01" value="${lineAnnualTotal(line).toFixed(2)}" /></div>
          <button type="button" class="link-btn bm-distribute-btn" data-index="${i}">Distribute evenly</button>
        </td>
        <td>
          <details class="budget-period-details">
            <summary>${periods.length} period figures</summary>
            <div class="budget-period-grid">${periodInputs}</div>
          </details>
        </td>
        <td><button type="button" class="link-btn bm-remove-line" data-index="${i}">Remove</button></td>
      </tr>`;
    }).join("");

    let income = 0, expense = 0;
    formLines.forEach((l) => {
      const acc = ERP_ChartOfAccountsRepository.findById(l.accountId);
      if (!acc) return;
      if (acc.accountType === "Income") income += lineAnnualTotal(l);
      else expense += lineAnnualTotal(l);
    });
    $("#bmFormTotals").textContent = `Budgeted income ${formatMoney(income)} · budgeted expense ${formatMoney(expense)} · net ${formatMoney(income - expense)}`;
  }

  function populateAccountPicker() {
    const used = formLines.map((l) => l.accountId);
    const available = ERP_BudgetRepository.getBudgetableAccounts(company.id).filter((a) => !used.includes(a.id));
    $("#bmAddAccountPicker").innerHTML = available.length
      ? `<option value="">Select an account to add…</option>` + available.map((a) => `<option value="${a.id}">${escapeHtml(String(a.accountCode))} — ${escapeHtml(a.accountName)} (${escapeHtml(a.accountType)})</option>`).join("")
      : `<option value="">All budgetable accounts already added</option>`;
  }

  function addAccountLine(accountId) {
    if (!accountId) return;
    if (formLines.some((l) => l.accountId === accountId)) return; // already-added accounts aren't offered, so this is a guard only
    formLines.push({ accountId, periodAmounts: {} });
    populateAccountPicker();
    renderFormLines();
  }

  function bindFormLineEvents() {
    $("#bmFormLinesBody").addEventListener("input", (e) => {
      const annual = e.target.closest(".bm-annual-input");
      if (annual) {
        // Typing an annual figure alone doesn't redistribute — that's an
        // explicit action, so a half-typed number never wipes hand-entered
        // period figures underneath it.
        return;
      }
      const cell = e.target.closest(".bm-period-input");
      if (!cell) return;
      const line = formLines[Number(cell.dataset.index)];
      if (!line) return;
      line.periodAmounts[cell.dataset.period] = Number(cell.value) || 0;
      // Refresh only the annual figure + totals, not the whole table — a
      // full re-render would blur the input mid-typing.
      const row = cell.closest("tr");
      const annualInput = row ? row.querySelector(".bm-annual-input") : null;
      if (annualInput) annualInput.value = lineAnnualTotal(line).toFixed(2);
    });

    $("#bmFormLinesBody").addEventListener("click", (e) => {
      const dist = e.target.closest(".bm-distribute-btn");
      if (dist) {
        const i = Number(dist.dataset.index);
        const line = formLines[i];
        const row = dist.closest("tr");
        const annualInput = row ? row.querySelector(".bm-annual-input") : null;
        const annual = annualInput ? Number(annualInput.value) || 0 : 0;
        const periods = formFy ? formFy.periods || [] : [];
        const parts = ERP_BudgetRepository.buildEvenDistribution(annual, periods.length);
        line.periodAmounts = {};
        periods.forEach((p, idx) => { line.periodAmounts[p.id] = parts[idx]; });
        renderFormLines();
        return;
      }
      const rm = e.target.closest(".bm-remove-line");
      if (rm) {
        formLines.splice(Number(rm.dataset.index), 1);
        populateAccountPicker();
        renderFormLines();
      }
    });

    $("#bmAddAccountPicker").addEventListener("change", () => {
      addAccountLine($("#bmAddAccountPicker").value);
      $("#bmAddAccountPicker").value = "";
    });
  }

  function populateFyPicker(selectedId) {
    const years = ERP_FinancialYearRepository.getAllForCompany(company.id);
    $("#bmFormFy").innerHTML = years.map((fy) => `<option value="${fy.id}"${fy.id === selectedId ? " selected" : ""}>${escapeHtml(fy.name || fy.fyCode)}</option>`).join("");
    const current = ERP_FinancialYearRepository.getCurrent(company.id);
    if (!selectedId && current) $("#bmFormFy").value = current.id;
    formFy = ERP_FinancialYearRepository.findById($("#bmFormFy").value);
  }

  function clearFormErrors() {
    ["bmFormNameError", "bmFormFyError", "bmFormLinesError"].forEach((id) => { $("#" + id).textContent = ""; });
  }

  function openAddModal() {
    if (ERP_FinancialYearRepository.getAllForCompany(company.id).length === 0) {
      showToast("Set up a Financial Year first — a budget is always scoped to one.", "warning");
      return;
    }
    if (ERP_BudgetRepository.getBudgetableAccounts(company.id).length === 0) {
      showToast("No Income or Expense accounts exist yet — add some in Chart of Accounts first.", "warning");
      return;
    }
    editingId = null;
    formLines = [];
    $("#bmFormTitle").textContent = "New Budget";
    $("#bmFormName").value = "";
    $("#bmFormNotes").value = "";
    populateFyPicker(null);
    $("#bmFormFy").disabled = false;
    populateAccountPicker();
    renderFormLines();
    clearFormErrors();
    openModal("bmFormModal");
  }

  function openEditModal(budget) {
    editingId = budget.id;
    formLines = (budget.lines || []).map((l) => ({ accountId: l.accountId, periodAmounts: { ...(l.periodAmounts || {}) } }));
    $("#bmFormTitle").textContent = `Edit ${budget.budgetCode}`;
    $("#bmFormName").value = budget.budgetName || "";
    $("#bmFormNotes").value = budget.notes || "";
    populateFyPicker(budget.financialYearId);
    $("#bmFormFy").disabled = true; // changing the FY would orphan every period figure already entered
    populateAccountPicker();
    renderFormLines();
    clearFormErrors();
    openModal("bmFormModal");
  }

  function validateForm() {
    let ok = true;
    clearFormErrors();
    if (!$("#bmFormName").value.trim()) { $("#bmFormNameError").textContent = "Give this budget a name."; ok = false; }
    if (!$("#bmFormFy").value) { $("#bmFormFyError").textContent = "Select a financial year."; ok = false; }
    if (!formLines.length) { $("#bmFormLinesError").textContent = "Add at least one account."; ok = false; }
    return ok;
  }

  function bindFormModal() {
    $("#bmAddBtn").addEventListener("click", openAddModal);
    $("#bmFormFy").addEventListener("change", () => {
      formFy = ERP_FinancialYearRepository.findById($("#bmFormFy").value);
      // Period ids are stable (P01..P12) across years, so figures carry
      // over cleanly; re-rendering picks up the new year's own period names.
      renderFormLines();
    });
    bindFormLineEvents();

    $("#bmFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const payload = {
        budgetName: $("#bmFormName").value.trim(),
        financialYearId: $("#bmFormFy").value,
        notes: $("#bmFormNotes").value.trim(),
        lines: formLines
      };
      if (editingId) {
        const updated = ERP_BudgetRepository.update(editingId, payload, session.username);
        if (updated) {
          logSystemActivity({ module: "Budget Master", action: "Update", description: `Updated budget "${updated.budgetCode}" for ${company.name}` });
          showToast("Budget updated.", "success");
        } else {
          showToast("Couldn't update — only Draft budgets are editable.", "danger");
        }
      } else {
        const created = ERP_BudgetRepository.create(company, payload, session.username);
        logSystemActivity({ module: "Budget Master", action: "Create", description: `Created budget "${created.budgetCode}" for ${company.name}` });
        showToast("Budget saved as Draft — approve it to report against it.", "success");
      }
      closeModal("bmFormModal");
      renderAll();
      renderActivity();
    });
  }

  /* ---------------- Detail modal ---------------- */

  function renderDetailFooter(b) {
    const f = $("#bmDetailFooter");
    f.innerHTML = "";
    const add = (label, cls, fn) => {
      const btn = document.createElement("button"); btn.type = "button"; btn.className = cls; btn.textContent = label;
      btn.addEventListener("click", fn); f.appendChild(btn);
    };
    if (b.status === "Draft") {
      add("Edit", "btn btn--ghost", () => { closeModal("bmDetailModal"); openEditModal(b); });
      add("Approve", "btn btn--primary", () => requestApprove(b));
      add("Cancel", "btn btn--danger-outline", () => requestCancel(b));
    }
    add("Close", "btn btn--ghost", () => closeModal("bmDetailModal"));
  }

  function openDetailModal(b) {
    const t = ERP_BudgetRepository.getTotals(b);
    const fy = ERP_FinancialYearRepository.findById(b.financialYearId);
    const periods = fy ? fy.periods || [] : [];

    $("#bmDetailTitle").textContent = `Budget — ${b.budgetCode}`;
    $("#bmDetailBody").innerHTML = `
      <div><dt>Budget Code</dt><dd><code>${escapeHtml(b.budgetCode)}</code></dd></div>
      <div><dt>Name</dt><dd>${escapeHtml(b.budgetName || "—")}</dd></div>
      <div><dt>Financial Year</dt><dd>${escapeHtml(fyLabel(b.financialYearId))}</dd></div>
      <div><dt>Budgeted Income</dt><dd>${formatMoney(t.income)}</dd></div>
      <div><dt>Budgeted Expense</dt><dd>${formatMoney(t.expense)}</dd></div>
      <div><dt>Net</dt><dd>${formatMoney(t.net)}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(b.status)}</dd></div>
      <div><dt>Notes</dt><dd>${b.notes ? escapeHtml(b.notes) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(b.createdAt))} by ${escapeHtml(actorLabel(b.createdByUsername))}</dd></div>
      ${b.status === "Approved" ? `<div><dt>Approved</dt><dd>${formatDateTime(new Date(b.approvedAt))} by ${escapeHtml(actorLabel(b.approvedByUsername))}</dd></div>` : ""}
      ${b.status === "Superseded" ? `<div><dt>Superseded</dt><dd>${formatDateTime(new Date(b.supersededAt))}</dd></div>` : ""}
    `;

    $("#bmDetailLineHead").innerHTML = `<tr><th>Account</th>${periods.map((p) => `<th class="text-right">${escapeHtml(p.name)}</th>`).join("")}<th class="text-right">Total</th></tr>`;
    $("#bmDetailLineBody").innerHTML = (b.lines || []).map((l) => {
      const acc = ERP_ChartOfAccountsRepository.findById(l.accountId);
      const cells = periods.map((p) => `<td class="text-right">${formatMoney((l.periodAmounts || {})[p.id] || 0)}</td>`).join("");
      return `<tr>
        <td><code>${acc ? escapeHtml(String(acc.accountCode)) : "?"}</code> ${acc ? escapeHtml(acc.accountName) : "Unknown"}</td>
        ${cells}
        <td class="text-right"><strong>${formatMoney(lineAnnualTotal(l))}</strong></td>
      </tr>`;
    }).join("");

    renderDetailFooter(b);
    openModal("bmDetailModal");
  }

  function requestApprove(b) {
    const existing = ERP_BudgetRepository.getApprovedForFy(company.id, b.financialYearId);
    openConfirm({
      title: "Approve this budget?",
      message: existing && existing.id !== b.id
        ? `This supersedes "${existing.budgetCode}", currently approved for the same financial year, and becomes the budget Budget vs. Actual reports against.`
        : "This becomes the budget Budget vs. Actual reports against. Approved budgets can't be edited afterward.",
      confirmLabel: "Approve",
      onConfirm: () => {
        const updated = ERP_BudgetRepository.approve(b.id, session.username);
        if (!updated) { showToast("Couldn't approve this budget.", "danger"); return; }
        logSystemActivity({ module: "Budget Master", action: "Approve", description: `Approved budget "${updated.budgetCode}" (${company.name})` });
        closeModal("bmDetailModal");
        renderAll();
        renderActivity();
        showToast("Budget approved.", "success");
      }
    });
  }

  function requestCancel(b) {
    openConfirm({
      title: "Cancel this draft budget?",
      message: "It was never approved, so nothing is reporting against it — cancelling is safe.",
      confirmLabel: "Cancel Budget",
      onConfirm: () => {
        ERP_BudgetRepository.cancel(b.id, session.username);
        logSystemActivity({ module: "Budget Master", action: "Cancel", description: `Cancelled budget "${b.budgetCode}" (${company.name})` });
        closeModal("bmDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#bmTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest(".row-detail-btn");
      if (!btn) return;
      const b = ERP_BudgetRepository.findById(btn.dataset.id);
      if (b) openDetailModal(b);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "budget-master")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading budgets…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#bmContent").hidden = true;
      $("#bmSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#bmContent").hidden = false;
      $("#bmHeaderActions").hidden = false;
      $("#bmSubtitle").textContent = `Managing budgets for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
