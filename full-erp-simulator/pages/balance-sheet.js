/* =============================================================================
   DOT ERP — pages/balance-sheet.js
   Phase 6, Module 06: Balance Sheet

   READ-ONLY, same as General Ledger/Trial Balance/Profit & Loss — no
   Add, no lifecycle, `#confirmDialog` present but unused. "As of" a
   single date, like Trial Balance, not a From/To period like Profit &
   Loss — see data/balance-sheet-data.js's own header for why Assets/
   Liabilities/Equity are point-in-time concepts.

   THE DIFFERENCE KPI IS THE MAIN CHARACTER AGAIN, SAME AS TRIAL BALANCE:
   colored green at zero (which should be always — Assets = Liabilities +
   Equity is the whole point of a balance sheet), red otherwise, because a
   nonzero difference here is exactly as serious a signal as one on Trial
   Balance would be.
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
  let currentBS = null;


  /* -----------------------------------------------------------------------
     COMPUTE + RENDER
     --------------------------------------------------------------------- */
  function visibleRows(rows) {
    return showAllAccounts ? rows : rows.filter((r) => r.amount !== 0);
  }

  function renderSummary() {
    $("#bsSummaryAssets").textContent = formatCurrency(currentBS.totalAssets);
    $("#bsSummaryLiabEquity").textContent = formatCurrency(currentBS.totalLiabilitiesAndEquity);

    const diffEl = $("#bsSummaryDifference");
    const iconEl = $("#bsDifferenceIcon");
    diffEl.textContent = formatCurrency(Math.abs(currentBS.difference));
    diffEl.style.color = currentBS.isBalanced ? "var(--color-success)" : "var(--color-danger)";
    iconEl.className = "kpi-card__icon " + (currentBS.isBalanced ? "kpi-card__icon--success" : "kpi-card__icon--danger");

    const earningsEl = $("#bsSummaryEarnings");
    earningsEl.textContent = formatCurrency(Math.abs(currentBS.currentEarnings));
    earningsEl.style.color = currentBS.currentEarnings >= 0 ? "var(--color-success)" : "var(--color-danger)";
  }

  function accountRowsHtml(rows) {
    return rows.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.account.accountCode)}</code></td>
        <td>${escapeHtml(r.account.accountName)}</td>
        <td class="text-right">${formatCurrency(r.amount)}</td>
      </tr>
    `).join("");
  }

  function renderTable() {
    const assets = visibleRows(currentBS.assets);
    const liabilities = visibleRows(currentBS.liabilities);
    const equity = visibleRows(currentBS.equity);
    const hasAny = assets.length > 0 || liabilities.length > 0 || equity.length > 0 || currentBS.currentEarnings !== 0;

    $("#bsEmptyState").hidden = hasAny;
    $("#bsTable").hidden = !hasAny;

    let html = "";
    if (assets.length) {
      html += `<tr class="tb-type-header"><td colspan="3">ASSETS</td></tr>`;
      html += accountRowsHtml(assets);
      html += `<tr class="je-totals-row"><td colspan="2">Total Assets</td><td class="text-right">${formatCurrency(currentBS.totalAssets)}</td></tr>`;
    }
    if (liabilities.length) {
      html += `<tr class="tb-type-header"><td colspan="3">LIABILITIES</td></tr>`;
      html += accountRowsHtml(liabilities);
      html += `<tr class="je-totals-row"><td colspan="2">Total Liabilities</td><td class="text-right">${formatCurrency(currentBS.totalLiabilities)}</td></tr>`;
    }
    if (equity.length || currentBS.currentEarnings !== 0) {
      html += `<tr class="tb-type-header"><td colspan="3">EQUITY</td></tr>`;
      html += accountRowsHtml(equity);
      html += `<tr>
        <td>—</td>
        <td>Current Earnings (unclosed) <span class="profile-subtle">— computed, not a Ledger account</span></td>
        <td class="text-right">${formatCurrency(currentBS.currentEarnings)}</td>
      </tr>`;
      html += `<tr class="je-totals-row"><td colspan="2">Total Equity</td><td class="text-right">${formatCurrency(currentBS.totalEquity)}</td></tr>`;
    }
    if (hasAny) {
      html += `<tr class="je-totals-row"><td colspan="2">Total Liabilities &amp; Equity</td><td class="text-right">${formatCurrency(currentBS.totalLiabilitiesAndEquity)}</td></tr>`;
    }
    $("#bsTableBody").innerHTML = html;
  }

  function recompute() {
    const asOfDate = $("#bsAsOfDate").value || new Date().toISOString().slice(0, 10);
    currentBS = ERP_BalanceSheetRepository.getBalanceSheet(company.id, asOfDate);
    renderSummary();
    renderTable();
  }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $("#bsAsOfDate").addEventListener("change", recompute);

    $$("#bsActivityChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#bsActivityChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        showAllAccounts = chip.dataset.activity === "all";
        renderTable();
      });
    });

    $("#bsExportCsvBtn").addEventListener("click", exportCsv);
    $("#bsPrintBtn").addEventListener("click", printReport);
  }

  function exportCsv() {
    const assets = visibleRows(currentBS.assets);
    const liabilities = visibleRows(currentBS.liabilities);
    const equity = visibleRows(currentBS.equity);
    if (!assets.length && !liabilities.length && !equity.length) { showToast("Nothing to export yet.", "warning"); return; }

    const header = ["Section", "Code", "Account", "Amount"];
    const csvRows = [header.join(",")];
    const addRow = (section, code, name, amount) =>
      csvRows.push([section, code, name, amount].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

    assets.forEach((r) => addRow("Asset", r.account.accountCode, r.account.accountName, r.amount.toFixed(2)));
    addRow("Asset", "", "Total Assets", currentBS.totalAssets.toFixed(2));
    liabilities.forEach((r) => addRow("Liability", r.account.accountCode, r.account.accountName, r.amount.toFixed(2)));
    addRow("Liability", "", "Total Liabilities", currentBS.totalLiabilities.toFixed(2));
    equity.forEach((r) => addRow("Equity", r.account.accountCode, r.account.accountName, r.amount.toFixed(2)));
    addRow("Equity", "", "Current Earnings (unclosed)", currentBS.currentEarnings.toFixed(2));
    addRow("Equity", "", "Total Equity", currentBS.totalEquity.toFixed(2));
    addRow("Total", "", "Total Liabilities & Equity", currentBS.totalLiabilitiesAndEquity.toFixed(2));

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-balance-sheet-${company.companyCode}-${currentBS.asOfDate}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Balance Sheet exported as CSV.", "success", { title: "Export complete" });
  }

  function printReport() {
    const assets = visibleRows(currentBS.assets);
    const liabilities = visibleRows(currentBS.liabilities);
    const equity = visibleRows(currentBS.equity);
    if (!assets.length && !liabilities.length && !equity.length) { showToast("Nothing to print yet.", "warning"); return; }

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }

    const rowHtml = (r) => `<tr><td>${escapeHtml(r.account.accountCode)}</td><td>${escapeHtml(r.account.accountName)}</td><td>${formatCurrency(r.amount)}</td></tr>`;
    let body = `<tr><td colspan="3" style="font-weight:700;background:#F1F5F9;">ASSETS</td></tr>`;
    body += assets.map(rowHtml).join("");
    body += `<tr style="font-weight:700;"><td colspan="2">Total Assets</td><td>${formatCurrency(currentBS.totalAssets)}</td></tr>`;
    body += `<tr><td colspan="3" style="font-weight:700;background:#F1F5F9;">LIABILITIES</td></tr>`;
    body += liabilities.map(rowHtml).join("");
    body += `<tr style="font-weight:700;"><td colspan="2">Total Liabilities</td><td>${formatCurrency(currentBS.totalLiabilities)}</td></tr>`;
    body += `<tr><td colspan="3" style="font-weight:700;background:#F1F5F9;">EQUITY</td></tr>`;
    body += equity.map(rowHtml).join("");
    body += `<tr><td>—</td><td>Current Earnings (unclosed)</td><td>${formatCurrency(currentBS.currentEarnings)}</td></tr>`;
    body += `<tr style="font-weight:700;"><td colspan="2">Total Equity</td><td>${formatCurrency(currentBS.totalEquity)}</td></tr>`;
    body += `<tr style="font-weight:700;"><td colspan="2">Total Liabilities &amp; Equity</td><td>${formatCurrency(currentBS.totalLiabilitiesAndEquity)}</td></tr>`;

    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Balance Sheet</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#1E3A8A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Balance Sheet</h1>
        <p>As of ${escapeHtml(currentBS.asOfDate)} · Generated ${escapeHtml(formatDateTime(new Date()))} · ${currentBS.isBalanced ? "Balanced" : "OUT OF BALANCE by " + formatCurrency(Math.abs(currentBS.difference))}</p>
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
    if (!window.ERP.enforcePageAccess(session, "balance-sheet")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Computing balance sheet…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    const hasPostedEntries = company && ERP_JournalEntryRepository.getAllForCompany(company.id).some((e) => e.status === "Posted");

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#bsContent").hidden = true;
      $("#bsSubtitle").textContent = "No active company yet.";
    } else if (!hasPostedEntries) {
      $("#noPostingsState").hidden = false;
      $("#bsContent").hidden = true;
      $("#bsSubtitle").textContent = `Nothing posted yet for ${company.name}.`;
    } else {
      $("#noCompanyState").hidden = true;
      $("#noPostingsState").hidden = true;
      $("#bsContent").hidden = false;
      $("#bsHeaderActions").hidden = false;
      $("#bsSubtitle").textContent = `Balance sheet for ${company.name} (${company.companyCode}).`;
      $("#bsAsOfDate").value = new Date().toISOString().slice(0, 10);
      recompute();
      bindToolbar();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
