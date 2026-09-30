/* =============================================================================
   DOT ERP — pages/trial-balance.js
   Phase 6, Module 04: Trial Balance

   READ-ONLY, same as General Ledger — no Add, no Edit, no lifecycle,
   `#confirmDialog` present but never invoked. Simpler than General
   Ledger's own page in one real way: no drill-down modal at all. A trial
   balance is a snapshot report meant to be scanned, exported, and
   printed as a whole — General Ledger already owns the "click into one
   account's transaction history" job, and duplicating that here would
   just be two ways to ask the same question.

   THE DIFFERENCE FIGURE IS THE MAIN CHARACTER, NOT A FOOTNOTE: rendered
   as its own KPI card, colored green when zero (which — per
   trial-balance-data.js's own header — should be always) and red on the
   rare occasion it isn't, because a nonzero difference here is a real
   data-integrity signal worth being impossible to miss, not a subtle
   number in a table.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime, formatCurrency,
    showToast, requireSession, runBootSequence
  } = window.ERP;

  let session = null;
  let company = null;
  let showAllAccounts = false; // false = "With Balance Only" (default)
  let currentTB = null;


  /* -----------------------------------------------------------------------
     COMPUTE + RENDER
     --------------------------------------------------------------------- */
  function getVisibleRows() {
    if (!currentTB) return [];
    return showAllAccounts
      ? currentTB.rows
      : currentTB.rows.filter((r) => r.debitColumn > 0 || r.creditColumn > 0);
  }

  function renderSummary() {
    $("#tbSummaryDebit").textContent = formatCurrency(currentTB.totalDebit);
    $("#tbSummaryCredit").textContent = formatCurrency(currentTB.totalCredit);

    const diffEl = $("#tbSummaryDifference");
    const iconEl = $("#tbDifferenceIcon");
    diffEl.textContent = formatCurrency(Math.abs(currentTB.difference));
    iconEl.className = "kpi-card__icon " + (currentTB.isBalanced ? "kpi-card__icon--success" : "kpi-card__icon--danger");
    diffEl.style.color = currentTB.isBalanced ? "var(--color-success)" : "var(--color-danger)";

    $("#tbSummaryAccounts").textContent = String(getVisibleRows().length);
  }

  function renderTable() {
    const rows = getVisibleRows();
    $("#tbEmptyState").hidden = rows.length !== 0;
    $("#tbTable").hidden = rows.length === 0;

    let currentType = null;
    const rowsHtml = [];
    rows.forEach((r) => {
      if (r.account.accountType !== currentType) {
        currentType = r.account.accountType;
        rowsHtml.push(`<tr class="tb-type-header"><td colspan="4">${escapeHtml(currentType.toUpperCase())}</td></tr>`);
      }
      rowsHtml.push(`
        <tr>
          <td><code>${escapeHtml(r.account.accountCode)}</code></td>
          <td>${escapeHtml(r.account.accountName)}</td>
          <td class="text-right">${r.debitColumn ? formatCurrency(r.debitColumn) : ""}</td>
          <td class="text-right">${r.creditColumn ? formatCurrency(r.creditColumn) : ""}</td>
        </tr>
      `);
    });
    $("#tbTableBody").innerHTML = rowsHtml.join("");

    $("#tbFooterDebit").textContent = formatCurrency(currentTB.totalDebit);
    $("#tbFooterCredit").textContent = formatCurrency(currentTB.totalCredit);
  }

  function recompute() {
    const asOfDate = $("#tbAsOfDate").value || new Date().toISOString().slice(0, 10);
    currentTB = ERP_TrialBalanceRepository.getTrialBalance(company.id, asOfDate);
    renderSummary();
    renderTable();
  }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $("#tbAsOfDate").addEventListener("change", recompute);

    $$("#tbActivityChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#tbActivityChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        showAllAccounts = chip.dataset.activity === "all";
        renderSummary();
        renderTable();
      });
    });

    $("#tbExportCsvBtn").addEventListener("click", exportCsv);
    $("#tbPrintBtn").addEventListener("click", printReport);
  }

  function exportCsv() {
    const rows = getVisibleRows();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Account", "Type", "Debit", "Credit"];
    const csvRows = [header.join(",")];
    rows.forEach((r) => {
      const line = [r.account.accountCode, r.account.accountName, r.account.accountType, r.debitColumn.toFixed(2), r.creditColumn.toFixed(2)]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    csvRows.push(["", "", "Total", currentTB.totalDebit.toFixed(2), currentTB.totalCredit.toFixed(2)].map((v) => `"${v}"`).join(","));
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-trial-balance-${company.companyCode}-${currentTB.asOfDate}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Trial Balance exported as CSV.", "success", { title: "Export complete" });
  }

  function printReport() {
    const rows = getVisibleRows();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }

    let currentType = null;
    const tableRows = [];
    rows.forEach((r) => {
      if (r.account.accountType !== currentType) {
        currentType = r.account.accountType;
        tableRows.push(`<tr><td colspan="4" style="font-weight:700;background:#F1F5F9;">${escapeHtml(currentType.toUpperCase())}</td></tr>`);
      }
      tableRows.push(`<tr><td>${escapeHtml(r.account.accountCode)}</td><td>${escapeHtml(r.account.accountName)}</td><td>${r.debitColumn ? formatCurrency(r.debitColumn) : ""}</td><td>${r.creditColumn ? formatCurrency(r.creditColumn) : ""}</td></tr>`);
    });
    tableRows.push(`<tr style="font-weight:700;"><td colspan="2">Total</td><td>${formatCurrency(currentTB.totalDebit)}</td><td>${formatCurrency(currentTB.totalCredit)}</td></tr>`);

    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Trial Balance</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#1E3A8A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Trial Balance</h1>
        <p>As of ${escapeHtml(currentTB.asOfDate)} · Generated ${escapeHtml(formatDateTime(new Date()))} · ${currentTB.isBalanced ? "Balanced" : "OUT OF BALANCE by " + formatCurrency(Math.abs(currentTB.difference))}</p>
        <table><thead><tr><th>Code</th><th>Account</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody>${tableRows.join("")}</tbody></table>
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
    if (!window.ERP.enforcePageAccess(session, "trial-balance")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Computing trial balance…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    const hasPostedEntries = company && ERP_JournalEntryRepository.getAllForCompany(company.id).some((e) => e.status === "Posted");

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#tbContent").hidden = true;
      $("#tbSubtitle").textContent = "No active company yet.";
    } else if (!hasPostedEntries) {
      $("#noPostingsState").hidden = false;
      $("#tbContent").hidden = true;
      $("#tbSubtitle").textContent = `Nothing posted yet for ${company.name}.`;
    } else {
      $("#noCompanyState").hidden = true;
      $("#noPostingsState").hidden = true;
      $("#tbContent").hidden = false;
      $("#tbHeaderActions").hidden = false;
      $("#tbSubtitle").textContent = `Trial balance for ${company.name} (${company.companyCode}).`;
      $("#tbAsOfDate").value = new Date().toISOString().slice(0, 10);
      recompute();
      bindToolbar();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
