/* =============================================================================
   DOT ERP — pages/profit-and-loss.js
   Phase 6, Module 05: Profit & Loss Statement

   READ-ONLY, same as General Ledger and Trial Balance — no Add, no
   lifecycle, `#confirmDialog` present but unused. The one control this
   page has that neither of those two did: a From/To PERIOD, not a single
   "as of" date — see data/profit-and-loss-data.js's own header for why
   that's a real accounting distinction, not a UI variation. Defaults to
   calendar-year-to-date (Jan 1 of the current year through today) since
   this project has no fiscal-year-start concept on Company Master to
   default to instead; "This Month" is offered as a one-click alternative
   for a tighter period.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime, formatCurrency,
    showToast, requireSession, runBootSequence
  } = window.ERP;

  let session = null;
  let company = null;
  let showAllAccounts = false; // false = "With Activity Only" (default)
  let currentPL = null;


  /* -----------------------------------------------------------------------
     COMPUTE + RENDER
     --------------------------------------------------------------------- */
  function visibleRows(rows) {
    return showAllAccounts ? rows : rows.filter((r) => r.transactionCount > 0);
  }

  function renderSummary() {
    $("#plSummaryIncome").textContent = formatCurrency(currentPL.totalIncome);
    $("#plSummaryExpense").textContent = formatCurrency(currentPL.totalExpense);

    const isProfit = currentPL.netProfit >= 0;
    $("#plNetProfitLabel").textContent = isProfit ? "Net Profit" : "Net Loss";
    $("#plSummaryNetProfit").textContent = formatCurrency(Math.abs(currentPL.netProfit));
    $("#plSummaryNetProfit").style.color = isProfit ? "var(--color-success)" : "var(--color-danger)";
    $("#plNetProfitIcon").className = "kpi-card__icon " + (isProfit ? "kpi-card__icon--success" : "kpi-card__icon--danger");

    const marginEl = $("#plSummaryMargin");
    if (currentPL.totalIncome > 0) {
      const margin = (currentPL.netProfit / currentPL.totalIncome) * 100;
      marginEl.textContent = margin.toFixed(1) + "%";
      marginEl.style.color = margin >= 0 ? "var(--color-success)" : "var(--color-danger)";
    } else {
      marginEl.textContent = "—";
      marginEl.style.color = "";
    }
  }

  function accountRowsHtml(rows) {
    return rows.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.account.accountCode)}</code></td>
        <td>${escapeHtml(r.account.accountName)}</td>
        <td class="text-right">${r.periodAmount ? formatCurrency(r.periodAmount) : "—"}</td>
      </tr>
    `).join("");
  }

  function renderTable() {
    const income = visibleRows(currentPL.income);
    const expense = visibleRows(currentPL.expense);
    const hasAny = income.length > 0 || expense.length > 0;

    $("#plEmptyState").hidden = hasAny;
    $("#plTable").hidden = !hasAny;

    let html = "";
    if (income.length) {
      html += `<tr class="tb-type-header"><td colspan="3">INCOME</td></tr>`;
      html += accountRowsHtml(income);
      html += `<tr class="je-totals-row"><td colspan="2">Total Income</td><td class="text-right">${formatCurrency(currentPL.totalIncome)}</td></tr>`;
    }
    if (expense.length) {
      html += `<tr class="tb-type-header"><td colspan="3">EXPENSE</td></tr>`;
      html += accountRowsHtml(expense);
      html += `<tr class="je-totals-row"><td colspan="2">Total Expense</td><td class="text-right">${formatCurrency(currentPL.totalExpense)}</td></tr>`;
    }
    if (hasAny) {
      const isProfit = currentPL.netProfit >= 0;
      html += `<tr class="je-totals-row"><td colspan="2">${isProfit ? "Net Profit" : "Net Loss"}</td><td class="text-right" style="color:${isProfit ? "var(--color-success)" : "var(--color-danger)"};">${formatCurrency(Math.abs(currentPL.netProfit))}</td></tr>`;
    }
    $("#plTableBody").innerHTML = html;
  }

  function recompute() {
    const fromDate = $("#plFromDate").value;
    const toDate = $("#plToDate").value;
    currentPL = ERP_ProfitAndLossRepository.getProfitAndLoss(company.id, fromDate, toDate);
    renderSummary();
    renderTable();
  }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $("#plFromDate").addEventListener("change", recompute);
    $("#plToDate").addEventListener("change", recompute);

    $("#plThisMonthBtn").addEventListener("click", () => {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      $("#plFromDate").value = firstOfMonth.toISOString().slice(0, 10);
      $("#plToDate").value = now.toISOString().slice(0, 10);
      recompute();
    });

    $$("#plActivityChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#plActivityChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        showAllAccounts = chip.dataset.activity === "all";
        renderTable();
      });
    });

    $("#plExportCsvBtn").addEventListener("click", exportCsv);
    $("#plPrintBtn").addEventListener("click", printReport);
  }

  function exportCsv() {
    const income = visibleRows(currentPL.income);
    const expense = visibleRows(currentPL.expense);
    if (!income.length && !expense.length) { showToast("Nothing to export yet.", "warning"); return; }

    const header = ["Section", "Code", "Account", "Amount"];
    const csvRows = [header.join(",")];
    const addRow = (section, code, name, amount) =>
      csvRows.push([section, code, name, amount].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

    income.forEach((r) => addRow("Income", r.account.accountCode, r.account.accountName, r.periodAmount.toFixed(2)));
    addRow("Income", "", "Total Income", currentPL.totalIncome.toFixed(2));
    expense.forEach((r) => addRow("Expense", r.account.accountCode, r.account.accountName, r.periodAmount.toFixed(2)));
    addRow("Expense", "", "Total Expense", currentPL.totalExpense.toFixed(2));
    addRow(currentPL.netProfit >= 0 ? "Result" : "Result", "", currentPL.netProfit >= 0 ? "Net Profit" : "Net Loss", Math.abs(currentPL.netProfit).toFixed(2));

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-profit-and-loss-${company.companyCode}-${currentPL.fromDate}-to-${currentPL.toDate}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Profit & Loss Statement exported as CSV.", "success", { title: "Export complete" });
  }

  function printReport() {
    const income = visibleRows(currentPL.income);
    const expense = visibleRows(currentPL.expense);
    if (!income.length && !expense.length) { showToast("Nothing to print yet.", "warning"); return; }

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }

    const rowHtml = (r) => `<tr><td>${escapeHtml(r.account.accountCode)}</td><td>${escapeHtml(r.account.accountName)}</td><td>${formatCurrency(r.periodAmount)}</td></tr>`;
    const isProfit = currentPL.netProfit >= 0;
    let body = `<tr><td colspan="3" style="font-weight:700;background:#F1F5F9;">INCOME</td></tr>`;
    body += income.map(rowHtml).join("");
    body += `<tr style="font-weight:700;"><td colspan="2">Total Income</td><td>${formatCurrency(currentPL.totalIncome)}</td></tr>`;
    body += `<tr><td colspan="3" style="font-weight:700;background:#F1F5F9;">EXPENSE</td></tr>`;
    body += expense.map(rowHtml).join("");
    body += `<tr style="font-weight:700;"><td colspan="2">Total Expense</td><td>${formatCurrency(currentPL.totalExpense)}</td></tr>`;
    body += `<tr style="font-weight:700;"><td colspan="2">${isProfit ? "Net Profit" : "Net Loss"}</td><td>${formatCurrency(Math.abs(currentPL.netProfit))}</td></tr>`;

    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Profit and Loss Statement</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#1E3A8A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Profit &amp; Loss Statement</h1>
        <p>${escapeHtml(currentPL.fromDate)} to ${escapeHtml(currentPL.toDate)} · Generated ${escapeHtml(formatDateTime(new Date()))}</p>
        <table><thead><tr><th>Code</th><th>Account</th><th>Amount</th></tr></thead>
        <tbody>${body}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast('Opened the print dialog — choose "Save as PDF" to export.', "info", { title: "Export PDF" });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "profit-and-loss")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Computing profit & loss…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    const hasPostedEntries = company && ERP_JournalEntryRepository.getAllForCompany(company.id).some((e) => e.status === "Posted");

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#plContent").hidden = true;
      $("#plSubtitle").textContent = "No active company yet.";
    } else if (!hasPostedEntries) {
      $("#noPostingsState").hidden = false;
      $("#plContent").hidden = true;
      $("#plSubtitle").textContent = `Nothing posted yet for ${company.name}.`;
    } else {
      $("#noCompanyState").hidden = true;
      $("#noPostingsState").hidden = true;
      $("#plContent").hidden = false;
      $("#plHeaderActions").hidden = false;
      $("#plSubtitle").textContent = `Profit & loss for ${company.name} (${company.companyCode}).`;

      const now = new Date();
      $("#plFromDate").value = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      $("#plToDate").value = now.toISOString().slice(0, 10);

      recompute();
      bindToolbar();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
