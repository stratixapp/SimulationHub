/* =============================================================================
   DOT ERP — pages/general-ledger.js
   Phase 6, Module 03: General Ledger

   READ-ONLY, ON PURPOSE. Every earlier page in this project has an Add
   button, a Detail modal footer full of lifecycle actions, and a
   confirm-before-mutating pattern. This page has none of that — no Add,
   no Edit, no Delete, no status transitions. `#confirmDialog` is only
   still wired up because `openModal`/`closeModal` are shared helpers that
   assume it exists elsewhere on the page; nothing here ever calls
   `openConfirm()`. The account list and the per-account ledger drill-down
   are both pure computed views over data/general-ledger-data.js — this
   file's whole job is rendering what that layer already computed, not
   deciding anything new.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime, formatCurrency,
    showToast, openModal, closeModal, requireSession, runBootSequence
  } = window.ERP;

  const PAGE_SIZE = 10;

  let session = null;
  let company = null;
  let filterType = "all";
  let filterActivity = "all";
  let page = 1;
  let ledgerAccountId = null;


  /* -----------------------------------------------------------------------
     ACCOUNT LIST (filter + summary)
     --------------------------------------------------------------------- */
  function getFilteredSummaries() {
    let rows = ERP_GeneralLedgerRepository.getAllAccountSummaries(company.id);
    if (filterType !== "all") rows = rows.filter((r) => r.account.accountType === filterType);
    if (filterActivity === "active") rows = rows.filter((r) => r.transactionCount > 0);
    return rows.sort((a, b) => String(a.account.accountCode).localeCompare(String(b.account.accountCode), undefined, { numeric: true }));
  }

  function renderSummary() {
    const all = ERP_GeneralLedgerRepository.getAllAccountSummaries(company.id);
    const withActivity = all.filter((r) => r.transactionCount > 0);
    const totalDebit = all.reduce((s, r) => s + r.totalDebit, 0);
    const totalCredit = all.reduce((s, r) => s + r.totalCredit, 0);
    const postedCount = ERP_JournalEntryRepository.getAllForCompany(company.id).filter((e) => e.status === "Posted").length;

    $("#glSummaryAccounts").textContent = String(withActivity.length);
    $("#glSummaryEntries").textContent = String(postedCount);
    $("#glSummaryDebit").textContent = formatCurrency(totalDebit);
    $("#glSummaryCredit").textContent = formatCurrency(totalCredit);
  }

  function renderPagination(totalPages) {
    const container = $("#glPagination");
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

  function balanceCell(bal) {
    if (bal.amount === 0) return `<span class="profile-subtle">—</span>`;
    return `${formatCurrency(bal.amount)} <span class="profile-subtle">${bal.side}</span>`;
  }

  function renderTable() {
    const all = getFilteredSummaries();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#glEmptyState").hidden = all.length !== 0;
    $("#glTable").hidden = all.length === 0;

    $("#glTableBody").innerHTML = pageItems.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.account.accountCode)}</code></td>
        <td>${escapeHtml(r.account.accountName)}</td>
        <td>${escapeHtml(r.account.accountType)}</td>
        <td class="text-right">${r.totalDebit ? formatCurrency(r.totalDebit) : "—"}</td>
        <td class="text-right">${r.totalCredit ? formatCurrency(r.totalCredit) : "—"}</td>
        <td class="text-right">${balanceCell(r.closingBalance)}</td>
        <td class="text-right">${r.transactionCount}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.account.id}" ${r.transactionCount === 0 ? "disabled" : ""}>View Ledger</button></td>
      </tr>
    `).join("");

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
    $$("#glTypeChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#glTypeChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterType = chip.dataset.type;
        page = 1;
        renderTable();
      });
    });

    $$("#glActivityChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#glActivityChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterActivity = chip.dataset.activity;
        page = 1;
        renderTable();
      });
    });

    $("#glExportCsvBtn").addEventListener("click", exportCsv);
    $("#glPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSummaries();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Account", "Type", "Total Debit", "Total Credit", "Closing Balance", "Balance Side", "Transactions"];
    const csvRows = [header.join(",")];
    rows.forEach((r) => {
      const line = [
        r.account.accountCode, r.account.accountName, r.account.accountType,
        r.totalDebit.toFixed(2), r.totalCredit.toFixed(2), r.closingBalance.amount.toFixed(2), r.closingBalance.side,
        r.transactionCount
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-general-ledger-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("General Ledger exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSummaries();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((r) => `<tr><td>${escapeHtml(r.account.accountCode)}</td><td>${escapeHtml(r.account.accountName)}</td><td>${escapeHtml(r.account.accountType)}</td><td>${formatCurrency(r.totalDebit)}</td><td>${formatCurrency(r.totalCredit)}</td><td>${r.closingBalance.amount ? formatCurrency(r.closingBalance.amount) + " " + r.closingBalance.side : "—"}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - General Ledger</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#1E3A8A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — General Ledger</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} account(s)</p>
        <table><thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Total Debit</th><th>Total Credit</th><th>Closing Balance</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast('Opened the print dialog — choose "Save as PDF" to export.', "info", { title: "Export PDF" });
  }


  /* -----------------------------------------------------------------------
     LEDGER DRILL-DOWN MODAL
     --------------------------------------------------------------------- */
  function renderLedgerModal() {
    const fromDate = $("#glLedgerFromDate").value || null;
    const toDate = $("#glLedgerToDate").value || null;
    const ledger = ERP_GeneralLedgerRepository.getLedgerForAccount(company.id, ledgerAccountId, { fromDate, toDate });

    $("#glLedgerTitle").textContent = `${ledger.account.accountName} · ${ledger.account.accountCode}`;
    $("#glLedgerSubtitle").textContent = `${ledger.account.accountType} · Normal balance: ${ledger.normalBalance} · Opening balance ${ledger.openingBalance.amount ? formatCurrency(ledger.openingBalance.amount) + " " + ledger.openingBalance.side : "—"}`;

    $("#glLedgerEmptyState").hidden = ledger.rows.length !== 0;
    $("#glLedgerTable").hidden = ledger.rows.length === 0;

    $("#glLedgerTableBody").innerHTML = ledger.rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.entryDate)}</td>
        <td><code>${escapeHtml(r.entryNumber)}</code></td>
        <td>${escapeHtml(r.lineNarration || r.narration || "—")}</td>
        <td class="text-right">${r.debit ? formatCurrency(r.debit) : "—"}</td>
        <td class="text-right">${r.credit ? formatCurrency(r.credit) : "—"}</td>
        <td class="text-right">${formatCurrency(r.runningBalance.amount)} <span class="profile-subtle">${r.runningBalance.side}</span></td>
      </tr>
    `).join("");

    $("#glLedgerFooter").innerHTML = `<p class="profile-subtle" style="margin:0;">Closing balance: <strong style="color:var(--color-text);">${formatCurrency(ledger.closingBalance.amount)} ${escapeHtml(ledger.closingBalance.side)}</strong></p>`;
  }

  function openLedgerModal(accountId) {
    ledgerAccountId = accountId;
    $("#glLedgerFromDate").value = "";
    $("#glLedgerToDate").value = "";
    renderLedgerModal();
    openModal("glLedgerModal");
  }

  function bindLedgerModal() {
    $("#glTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest(".row-detail-btn");
      if (!btn || btn.disabled) return;
      openLedgerModal(btn.dataset.id);
    });

    $("#glLedgerFromDate").addEventListener("change", renderLedgerModal);
    $("#glLedgerToDate").addEventListener("change", renderLedgerModal);
    $("#glLedgerClearRangeBtn").addEventListener("click", () => {
      $("#glLedgerFromDate").value = "";
      $("#glLedgerToDate").value = "";
      renderLedgerModal();
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "general-ledger")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading general ledger…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    const hasPostedEntries = company && ERP_JournalEntryRepository.getAllForCompany(company.id).some((e) => e.status === "Posted");

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#glContent").hidden = true;
      $("#glSubtitle").textContent = "No active company yet.";
    } else if (!hasPostedEntries) {
      $("#noPostingsState").hidden = false;
      $("#glContent").hidden = true;
      $("#glSubtitle").textContent = `Nothing posted yet for ${company.name}.`;
    } else {
      $("#noCompanyState").hidden = true;
      $("#noPostingsState").hidden = true;
      $("#glContent").hidden = false;
      $("#glHeaderActions").hidden = false;
      $("#glSubtitle").textContent = `Showing posted activity for ${company.name} (${company.companyCode}).`;
      renderAll();
      bindToolbar();
      bindLedgerModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
