/* =============================================================================
   DOT ERP — pages/budget-vs-actual.js
   Phase 13, Module 02: Budget vs. Actual

   NO `data/` FILE OF ITS OWN, DELIBERATELY — the second module in this
   project to earn that (Depreciation Schedule, Phase 12, was the first,
   and its own header records the same reasoning). This module stores
   nothing and decides nothing: it reads an Approved budget from
   `ERP_BudgetRepository` and actuals from `ERP_GeneralLedgerRepository`,
   and renders the comparison. Creating a repository purely for symmetry
   with its sibling module would add a file with no state, no
   persistence, and no decisions.

   ACTUALS ARE READ FORWARD, NEVER RE-DERIVED: every actual figure comes
   from `ERP_GeneralLedgerRepository.getLedgerForAccount()` with the
   period's own `fromDate`/`toDate` — the exact same call
   `data/profit-and-loss-data.js` already makes, and the period-movement
   formula below (`normalBalance === "Debit" ? debit - credit : credit -
   debit`) is deliberately the SAME formula P&L uses, so the two reports
   can never disagree about what an Income or Expense account did in a
   period. This is the "reuse forward, don't re-derive" discipline the
   roadmap's own Phase 13 brief explicitly asked for, and the thing that
   makes a variance figure trustworthy rather than merely plausible.

   THE VARIANCE CONVENTION — DECIDED DELIBERATELY, WHICH THE ROADMAP
   EXPLICITLY CALLED OUT AS SOMETHING NOT TO GET WRONG BY ACCIDENT:
   a raw "actual minus budget" number means OPPOSITE things depending on
   the account type, and presenting both as one undifferentiated signed
   figure is how a real report misleads people.
     • INCOME:  earning MORE than budgeted is GOOD.
                variance = actual - budget
     • EXPENSE: spending MORE than budgeted is BAD.
                variance = budget - actual
   Both formulas are oriented so that **POSITIVE ALWAYS MEANS FAVORABLE**
   and negative always means unfavorable, regardless of account type —
   the standard management-accounting convention, and the only framing
   under which a single "Total Variance" line across mixed Income and
   Expense rows is arithmetically meaningful. Every row is additionally
   labeled Favorable/Unfavorable in words, because a bare signed number
   in a column still invites the exact misreading this convention exists
   to prevent.

   VARIANCE % GUARDS AGAINST A ZERO BUDGET rather than dividing by it —
   an account with no budget but real spend reports "—" instead of
   Infinity, the same guard `cost-center-data.js`'s own `getVariance()`
   already uses.

   PERIOD SCOPE: "Full Year" (every period in the FY) or one specific
   period. A period's own date range comes straight off the Financial
   Year record's `periods` array — no date math is done here at all, for
   the same one-source-of-truth reason `data/budget-data.js`'s own header
   gives.
   ========================================================================== */

(function () {
  "use strict";

  const { $, $$, escapeHtml, showToast, requireSession, runBootSequence } = window.ERP;

  let session = null;
  let company = null;
  let selectedFyId = null;
  let selectedPeriodId = "ALL";
  let activityOnly = false;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function formatSigned(n) {
    const v = Number(n) || 0;
    return (v < 0 ? "-" : "") + "₹" + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }

  function currentFy() {
    return selectedFyId ? ERP_FinancialYearRepository.findById(selectedFyId) : null;
  }
  function currentBudget() {
    const fy = currentFy();
    return fy ? ERP_BudgetRepository.getApprovedForFy(company.id, fy.id) : null;
  }

  /** The periods in scope for the current selection — all of them, or one. */
  function periodsInScope() {
    const fy = currentFy();
    if (!fy) return [];
    const periods = fy.periods || [];
    return selectedPeriodId === "ALL" ? periods : periods.filter((p) => p.id === selectedPeriodId);
  }

  /** Actual period movement for one account across the in-scope periods —
      the same formula profit-and-loss-data.js uses; see file header. */
  function actualForAccount(account, periods) {
    const normalBalance = ERP_ChartOfAccountsRepository.getNormalBalance(account.accountType);
    let total = 0;
    periods.forEach((p) => {
      const ledger = ERP_GeneralLedgerRepository.getLedgerForAccount(company.id, account.id, { fromDate: p.startDate, toDate: p.endDate });
      const d = ledger.rows.reduce((s, r) => s + r.debit, 0);
      const c = ledger.rows.reduce((s, r) => s + r.credit, 0);
      total += normalBalance === "Debit" ? (d - c) : (c - d);
    });
    return total;
  }

  function budgetForAccount(budget, accountId, periods) {
    const line = (budget.lines || []).find((l) => l.accountId === accountId);
    if (!line) return 0;
    return periods.reduce((s, p) => s + (Number((line.periodAmounts || {})[p.id]) || 0), 0);
  }

  /** The variance convention — see file header. Positive is ALWAYS
      favorable, for both account types. */
  function computeVariance(accountType, budget, actual) {
    const variance = accountType === "Income" ? (actual - budget) : (budget - actual);
    const variancePct = budget !== 0 ? (variance / Math.abs(budget)) * 100 : null;
    return { variance, variancePct, favorable: variance >= 0 };
  }

  function buildRows() {
    const budget = currentBudget();
    if (!budget) return [];
    const periods = periodsInScope();
    return ERP_BudgetRepository.getBudgetableAccounts(company.id).map((account) => {
      const budgeted = budgetForAccount(budget, account.id, periods);
      const actual = actualForAccount(account, periods);
      const v = computeVariance(account.accountType, budgeted, actual);
      return { account, budgeted, actual, ...v };
    }).filter((r) => !activityOnly || r.budgeted !== 0 || r.actual !== 0);
  }

  function renderSummary(rows) {
    const income = rows.filter((r) => r.account.accountType === "Income");
    const expense = rows.filter((r) => r.account.accountType === "Expense");
    const sum = (arr, key) => arr.reduce((s, r) => s + r[key], 0);

    $("#bvaSummaryBudgetIncome").textContent = formatMoney(sum(income, "budgeted"));
    $("#bvaSummaryActualIncome").textContent = formatMoney(sum(income, "actual"));
    $("#bvaSummaryBudgetExpense").textContent = formatMoney(sum(expense, "budgeted"));
    $("#bvaSummaryActualExpense").textContent = formatMoney(sum(expense, "actual"));

    // Total variance is only meaningful BECAUSE both formulas are oriented
    // favorable-positive — see file header.
    const totalVariance = sum(rows, "variance");
    const el = $("#bvaSummaryVariance");
    el.textContent = formatSigned(totalVariance);
    el.style.color = totalVariance >= 0 ? "var(--color-success)" : "var(--color-danger)";
    $("#bvaSummaryVarianceLabel").textContent = totalVariance >= 0 ? "Total Variance (Favorable)" : "Total Variance (Unfavorable)";
  }

  function varianceBadge(row) {
    const tone = row.favorable ? "success" : "danger";
    const word = row.favorable ? "Favorable" : "Unfavorable";
    return `<span class="status-badge status-badge--${tone}">${word}</span>`;
  }

  function renderTable(rows) {
    $("#bvaEmptyState").hidden = rows.length !== 0;
    $("#bvaTable").hidden = rows.length === 0;

    const section = (label, list) => {
      if (!list.length) return "";
      const head = `<tr class="tb-type-header"><td colspan="6">${label.toUpperCase()}</td></tr>`;
      const body = list.map((r) => `
        <tr>
          <td><code>${escapeHtml(String(r.account.accountCode))}</code> ${escapeHtml(r.account.accountName)}</td>
          <td class="text-right">${formatMoney(r.budgeted)}</td>
          <td class="text-right">${formatMoney(r.actual)}</td>
          <td class="text-right">${formatSigned(r.variance)}</td>
          <td class="text-right">${r.variancePct === null ? "—" : r.variancePct.toFixed(1) + "%"}</td>
          <td>${varianceBadge(r)}</td>
        </tr>`).join("");
      return head + body;
    };

    $("#bvaTableBody").innerHTML =
      section("Income", rows.filter((r) => r.account.accountType === "Income")) +
      section("Expense", rows.filter((r) => r.account.accountType === "Expense"));
  }

  function renderContext() {
    const fy = currentFy();
    const budget = currentBudget();
    const periods = periodsInScope();
    const scopeLabel = selectedPeriodId === "ALL"
      ? "Full year"
      : (periods[0] ? periods[0].name : "—");

    $("#bvaContextLine").textContent = budget
      ? `Reporting "${budget.budgetName || budget.budgetCode}" (${budget.budgetCode}) against ${fy ? fy.name || fy.fyCode : "—"} · ${scopeLabel}.`
      : "";
    $("#bvaNoBudgetState").hidden = !!budget;
    $("#bvaReportBody").hidden = !budget;
  }

  function renderAll() {
    renderContext();
    if (!currentBudget()) return;
    const rows = buildRows();
    renderSummary(rows);
    renderTable(rows);
  }

  function populateFyPicker() {
    const years = ERP_FinancialYearRepository.getAllForCompany(company.id);
    $("#bvaFyPicker").innerHTML = years.map((fy) => `<option value="${fy.id}">${escapeHtml(fy.name || fy.fyCode)}</option>`).join("");
    const current = ERP_FinancialYearRepository.getCurrent(company.id);
    selectedFyId = current ? current.id : (years[0] ? years[0].id : null);
    if (selectedFyId) $("#bvaFyPicker").value = selectedFyId;
  }

  function populatePeriodPicker() {
    const fy = currentFy();
    const periods = fy ? fy.periods || [] : [];
    $("#bvaPeriodPicker").innerHTML = `<option value="ALL">Full Year</option>` +
      periods.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    selectedPeriodId = "ALL";
  }

  function bindControls() {
    $("#bvaFyPicker").addEventListener("change", () => {
      selectedFyId = $("#bvaFyPicker").value;
      populatePeriodPicker();
      renderAll();
    });
    $("#bvaPeriodPicker").addEventListener("change", () => {
      selectedPeriodId = $("#bvaPeriodPicker").value;
      renderAll();
    });
    $("#bvaActivityToggle").addEventListener("click", () => {
      activityOnly = !activityOnly;
      $("#bvaActivityToggle").classList.toggle("is-active", activityOnly);
      $("#bvaActivityToggle").textContent = activityOnly ? "With Activity Only" : "All Accounts";
      renderAll();
    });
    $("#bvaExportCsvBtn").addEventListener("click", exportCsv);
    $("#bvaPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = buildRows();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const lines = [["Account Code", "Account", "Type", "Budget", "Actual", "Variance", "Variance %", "Favourability"].join(",")];
    rows.forEach((r) => lines.push([
      r.account.accountCode, `"${r.account.accountName}"`, r.account.accountType,
      r.budgeted.toFixed(2), r.actual.toFixed(2), r.variance.toFixed(2),
      r.variancePct === null ? "" : r.variancePct.toFixed(1),
      r.favorable ? "Favorable" : "Unfavorable"
    ].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `budget-vs-actual-${company.companyCode}.csv`;
    link.click();
  }

  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "budget-vs-actual")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Comparing budget against actuals…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#bvaContent").hidden = true;
      $("#bvaSubtitle").textContent = "No active company yet.";
    } else if (ERP_FinancialYearRepository.getAllForCompany(company.id).length === 0) {
      $("#noCompanyState").hidden = true;
      $("#noFyState").hidden = false;
      $("#bvaContent").hidden = true;
    } else {
      $("#noCompanyState").hidden = true;
      $("#noFyState").hidden = true;
      $("#bvaContent").hidden = false;
      $("#bvaHeaderActions").hidden = false;
      $("#bvaSubtitle").textContent = `Budget performance for ${company.name} (${company.companyCode}).`;
      populateFyPicker();
      populatePeriodPicker();
      renderAll();
      bindControls();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
