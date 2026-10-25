/* =============================================================================
   DOT ERP — pages/ar-aging.js
   Phase 6, Module 09: Accounts Receivable Aging

   READ-ONLY, same shape as AP Aging one module back — summary table +
   per-customer drill-down modal, no lifecycle, `#confirmDialog` present
   but unused. The one addition AP Aging's own page didn't need: a "Last
   Follow-Up" column in the drill-down, reading `latestFollowUp` straight
   off each row (already resolved by ar-aging-data.js's own
   getAgingReport()) — genuine AR-only context, since collections
   follow-up has no Accounts Payable equivalent.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime, formatCurrency,
    showToast, openModal, closeModal, requireSession, runBootSequence
  } = window.ERP;

  let session = null;
  let company = null;
  let currentReport = null;

  const OVERDUE_BUCKETS = ["1-30 Days", "31-60 Days", "61-90 Days", "90+ Days"];


  /* -----------------------------------------------------------------------
     COMPUTE + RENDER
     --------------------------------------------------------------------- */
  function renderSummary() {
    $("#araSummaryTotal").textContent = formatCurrency(currentReport.grandTotal);
    $("#araSummaryCurrent").textContent = formatCurrency(currentReport.grandBucketTotals["Current"]);
    const overdue = OVERDUE_BUCKETS.reduce((s, b) => s + currentReport.grandBucketTotals[b], 0);
    $("#araSummaryOverdue").textContent = formatCurrency(overdue);
    $("#araSummaryCustomers").textContent = String(currentReport.customers.length);

    const unresolvedNote = $("#araUnresolvedNote");
    if (currentReport.unresolvedCount > 0) {
      unresolvedNote.hidden = false;
      unresolvedNote.textContent = `${currentReport.unresolvedCount} receivable${currentReport.unresolvedCount > 1 ? "s" : ""} couldn't be traced to a customer record — shown below as "Customer Unknown."`;
    } else {
      unresolvedNote.hidden = true;
    }
  }

  function customerNameCell(c) {
    return c.customer ? escapeHtml(c.customer.customerName) : `<span class="profile-subtle">Customer Unknown</span>`;
  }

  function bucketCell(amount) {
    return amount ? formatCurrency(amount) : `<span class="profile-subtle">—</span>`;
  }

  function renderTable() {
    const customers = currentReport.customers;
    $("#araEmptyState").hidden = customers.length !== 0;
    $("#araTable").hidden = customers.length === 0;

    $("#araTableBody").innerHTML = customers.map((c) => `
      <tr>
        <td>${customerNameCell(c)}</td>
        <td class="text-right">${bucketCell(c.bucketTotals["Current"])}</td>
        <td class="text-right">${bucketCell(c.bucketTotals["1-30 Days"])}</td>
        <td class="text-right">${bucketCell(c.bucketTotals["31-60 Days"])}</td>
        <td class="text-right">${bucketCell(c.bucketTotals["61-90 Days"])}</td>
        <td class="text-right">${bucketCell(c.bucketTotals["90+ Days"])}</td>
        <td class="text-right">${bucketCell(c.bucketTotals["No Due Date"])}</td>
        <td class="text-right"><strong>${formatCurrency(c.total)}</strong></td>
        <td><button type="button" class="row-detail-btn" data-key="${c.customer ? c.customer.id : "__unresolved__"}">View</button></td>
      </tr>
    `).join("");

    const g = currentReport.grandBucketTotals;
    $("#araFooterRow").innerHTML = `
      <td>Total</td>
      <td class="text-right">${formatCurrency(g["Current"])}</td>
      <td class="text-right">${formatCurrency(g["1-30 Days"])}</td>
      <td class="text-right">${formatCurrency(g["31-60 Days"])}</td>
      <td class="text-right">${formatCurrency(g["61-90 Days"])}</td>
      <td class="text-right">${formatCurrency(g["90+ Days"])}</td>
      <td class="text-right">${formatCurrency(g["No Due Date"])}</td>
      <td class="text-right">${formatCurrency(currentReport.grandTotal)}</td>
      <td></td>
    `;
  }

  function recompute() {
    const asOfDate = $("#araAsOfDate").value || new Date().toISOString().slice(0, 10);
    currentReport = ERP_ARAgingRepository.getAgingReport(company.id, asOfDate);
    renderSummary();
    renderTable();
  }


  /* -----------------------------------------------------------------------
     CUSTOMER DRILL-DOWN
     --------------------------------------------------------------------- */
  function followUpCell(latestFollowUp) {
    if (!latestFollowUp) return `<span class="profile-subtle">No follow-up logged</span>`;
    const parts = [escapeHtml(latestFollowUp.followUpDate || "—")];
    if (latestFollowUp.followUpMethod) parts.push(`via ${escapeHtml(latestFollowUp.followUpMethod)}`);
    parts.push(`(${escapeHtml(latestFollowUp.status)})`);
    return parts.join(" ");
  }

  function openCustomerModal(key) {
    const group = currentReport.customers.find((c) => (c.customer ? c.customer.id : "__unresolved__") === key);
    if (!group) return;

    $("#araCustomerTitle").textContent = group.customer ? group.customer.customerName : "Customer Unknown — unresolved receivables";

    const sorted = group.invoices.slice().sort((a, b) => (b.daysOverdue || -9999) - (a.daysOverdue || -9999));
    $("#araCustomerTableBody").innerHTML = sorted.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.invoice.invoiceCode)}</code></td>
        <td>${r.invoice.dueDate ? escapeHtml(r.invoice.dueDate) : "— not set —"}</td>
        <td>${r.daysOverdue === null ? "—" : (r.daysOverdue <= 0 ? "Not yet due" : `${r.daysOverdue} days`)}</td>
        <td><span class="status-badge status-badge--${r.bucket === "Current" ? "success" : r.bucket === "No Due Date" ? "neutral" : "warning"}">${escapeHtml(r.bucket)}</span></td>
        <td>${followUpCell(r.latestFollowUp)}</td>
        <td class="text-right">${formatCurrency(r.outstandingAmount)}</td>
      </tr>
    `).join("");

    openModal("araCustomerModal");
  }

  function bindTable() {
    $("#araTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest(".row-detail-btn");
      if (!btn) return;
      openCustomerModal(btn.dataset.key);
    });
  }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $("#araAsOfDate").addEventListener("change", recompute);
    $("#araExportCsvBtn").addEventListener("click", exportCsv);
    $("#araPrintBtn").addEventListener("click", printReport);
  }

  function exportCsv() {
    if (!currentReport.customers.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Customer", "Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "No Due Date", "Total"];
    const csvRows = [header.join(",")];
    currentReport.customers.forEach((c) => {
      const line = [
        c.customer ? c.customer.customerName : "Customer Unknown",
        c.bucketTotals["Current"].toFixed(2), c.bucketTotals["1-30 Days"].toFixed(2),
        c.bucketTotals["31-60 Days"].toFixed(2), c.bucketTotals["61-90 Days"].toFixed(2),
        c.bucketTotals["90+ Days"].toFixed(2), c.bucketTotals["No Due Date"].toFixed(2),
        c.total.toFixed(2)
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const g = currentReport.grandBucketTotals;
    csvRows.push(["Total", g["Current"], g["1-30 Days"], g["31-60 Days"], g["61-90 Days"], g["90+ Days"], g["No Due Date"], currentReport.grandTotal]
      .map((v) => `"${v}"`).join(","));

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-ar-aging-${company.companyCode}-${currentReport.asOfDate}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("AR Aging exported as CSV.", "success", { title: "Export complete" });
  }

  function printReport() {
    if (!currentReport.customers.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=1000,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }

    const rows = currentReport.customers.map((c) => `<tr>
      <td>${escapeHtml(c.customer ? c.customer.customerName : "Customer Unknown")}</td>
      <td>${formatCurrency(c.bucketTotals["Current"])}</td>
      <td>${formatCurrency(c.bucketTotals["1-30 Days"])}</td>
      <td>${formatCurrency(c.bucketTotals["31-60 Days"])}</td>
      <td>${formatCurrency(c.bucketTotals["61-90 Days"])}</td>
      <td>${formatCurrency(c.bucketTotals["90+ Days"])}</td>
      <td>${formatCurrency(c.bucketTotals["No Due Date"])}</td>
      <td>${formatCurrency(c.total)}</td>
    </tr>`).join("");
    const g = currentReport.grandBucketTotals;

    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Accounts Receivable Aging</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#1E3A8A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:10.5px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:9px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Accounts Receivable Aging</h1>
        <p>As of ${escapeHtml(currentReport.asOfDate)} · Generated ${escapeHtml(formatDateTime(new Date()))}</p>
        <table><thead><tr><th>Customer</th><th>Current</th><th>1-30</th><th>31-60</th><th>61-90</th><th>90+</th><th>No Due Date</th><th>Total</th></tr></thead>
        <tbody>${rows}
          <tr style="font-weight:700;"><td>Total</td><td>${formatCurrency(g["Current"])}</td><td>${formatCurrency(g["1-30 Days"])}</td><td>${formatCurrency(g["31-60 Days"])}</td><td>${formatCurrency(g["61-90 Days"])}</td><td>${formatCurrency(g["90+ Days"])}</td><td>${formatCurrency(g["No Due Date"])}</td><td>${formatCurrency(currentReport.grandTotal)}</td></tr>
        </tbody></table>
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
    if (!window.ERP.enforcePageAccess(session, "ar-aging")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Computing AR aging…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#araContent").hidden = true;
      $("#araSubtitle").textContent = "No active company yet.";
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const preview = ERP_ARAgingRepository.getAgingReport(company.id, today);

      if (preview.customers.length === 0) {
        $("#noPostingsState").hidden = false;
        $("#araContent").hidden = true;
        $("#araSubtitle").textContent = `Nothing outstanding for ${company.name}.`;
      } else {
        $("#noCompanyState").hidden = true;
        $("#noPostingsState").hidden = true;
        $("#araContent").hidden = false;
        $("#araHeaderActions").hidden = false;
        $("#araSubtitle").textContent = `Receivables aging for ${company.name} (${company.companyCode}).`;
        $("#araAsOfDate").value = today;
        currentReport = preview;
        renderSummary();
        renderTable();
        bindToolbar();
        bindTable();
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
