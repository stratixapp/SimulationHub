/* =============================================================================
   DOT ERP — pages/ap-aging.js
   Phase 6, Module 08: Accounts Payable Aging

   READ-ONLY, same as every other Phase 6 report — no Add, no lifecycle,
   `#confirmDialog` present but unused. The one interactive piece is the
   per-vendor "View" drill-down, which opens a small modal listing that
   vendor's individual outstanding payment requests — General Ledger
   established this same "summary table + drill-down modal for one row's
   own detail" shape first; this page reuses it rather than inventing a
   third variant.
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
    $("#apaSummaryTotal").textContent = formatCurrency(currentReport.grandTotal);
    $("#apaSummaryCurrent").textContent = formatCurrency(currentReport.grandBucketTotals["Current"]);
    const overdue = OVERDUE_BUCKETS.reduce((s, b) => s + currentReport.grandBucketTotals[b], 0);
    $("#apaSummaryOverdue").textContent = formatCurrency(overdue);
    $("#apaSummaryVendors").textContent = String(currentReport.vendors.length);

    const unresolvedNote = $("#apaUnresolvedNote");
    if (currentReport.unresolvedCount > 0) {
      unresolvedNote.hidden = false;
      unresolvedNote.textContent = `${currentReport.unresolvedCount} payable${currentReport.unresolvedCount > 1 ? "s" : ""} couldn't be traced back to a vendor (a broken link somewhere in the procurement chain) — shown below as "Vendor Unknown."`;
    } else {
      unresolvedNote.hidden = true;
    }
  }

  function vendorNameCell(v) {
    return v.vendor ? escapeHtml(v.vendor.vendorName) : `<span class="profile-subtle">Vendor Unknown</span>`;
  }

  function bucketCell(amount) {
    return amount ? formatCurrency(amount) : `<span class="profile-subtle">—</span>`;
  }

  function renderTable() {
    const vendors = currentReport.vendors;
    $("#apaEmptyState").hidden = vendors.length !== 0;
    $("#apaTable").hidden = vendors.length === 0;

    $("#apaTableBody").innerHTML = vendors.map((v) => `
      <tr>
        <td>${vendorNameCell(v)}</td>
        <td class="text-right">${bucketCell(v.bucketTotals["Current"])}</td>
        <td class="text-right">${bucketCell(v.bucketTotals["1-30 Days"])}</td>
        <td class="text-right">${bucketCell(v.bucketTotals["31-60 Days"])}</td>
        <td class="text-right">${bucketCell(v.bucketTotals["61-90 Days"])}</td>
        <td class="text-right">${bucketCell(v.bucketTotals["90+ Days"])}</td>
        <td class="text-right">${bucketCell(v.bucketTotals["No Due Date"])}</td>
        <td class="text-right"><strong>${formatCurrency(v.total)}</strong></td>
        <td><button type="button" class="row-detail-btn" data-key="${v.vendor ? v.vendor.id : "__unresolved__"}">View</button></td>
      </tr>
    `).join("");

    const g = currentReport.grandBucketTotals;
    $("#apaFooterRow").innerHTML = `
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
    const asOfDate = $("#apaAsOfDate").value || new Date().toISOString().slice(0, 10);
    currentReport = ERP_APAgingRepository.getAgingReport(company.id, asOfDate);
    renderSummary();
    renderTable();
  }


  /* -----------------------------------------------------------------------
     VENDOR DRILL-DOWN
     --------------------------------------------------------------------- */
  function openVendorModal(key) {
    const group = currentReport.vendors.find((v) => (v.vendor ? v.vendor.id : "__unresolved__") === key);
    if (!group) return;

    $("#apaVendorTitle").textContent = group.vendor ? group.vendor.vendorName : "Vendor Unknown — unresolved payables";

    const sorted = group.requests.slice().sort((a, b) => (b.daysOverdue || -9999) - (a.daysOverdue || -9999));
    $("#apaVendorTableBody").innerHTML = sorted.map((p) => `
      <tr>
        <td><code>${escapeHtml(p.request.requestCode)}</code></td>
        <td>${p.request.dueDate ? escapeHtml(p.request.dueDate) : "— not set —"}</td>
        <td>${p.daysOverdue === null ? "—" : (p.daysOverdue <= 0 ? "Not yet due" : `${p.daysOverdue} days`)}</td>
        <td><span class="status-badge status-badge--${p.bucket === "Current" ? "success" : p.bucket === "No Due Date" ? "neutral" : "warning"}">${escapeHtml(p.bucket)}</span></td>
        <td class="text-right">${formatCurrency(p.outstandingAmount)}</td>
      </tr>
    `).join("");

    openModal("apaVendorModal");
  }

  function bindTable() {
    $("#apaTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest(".row-detail-btn");
      if (!btn) return;
      openVendorModal(btn.dataset.key);
    });
  }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $("#apaAsOfDate").addEventListener("change", recompute);
    $("#apaExportCsvBtn").addEventListener("click", exportCsv);
    $("#apaPrintBtn").addEventListener("click", printReport);
  }

  function exportCsv() {
    if (!currentReport.vendors.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Vendor", "Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "No Due Date", "Total"];
    const csvRows = [header.join(",")];
    currentReport.vendors.forEach((v) => {
      const line = [
        v.vendor ? v.vendor.vendorName : "Vendor Unknown",
        v.bucketTotals["Current"].toFixed(2), v.bucketTotals["1-30 Days"].toFixed(2),
        v.bucketTotals["31-60 Days"].toFixed(2), v.bucketTotals["61-90 Days"].toFixed(2),
        v.bucketTotals["90+ Days"].toFixed(2), v.bucketTotals["No Due Date"].toFixed(2),
        v.total.toFixed(2)
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const g = currentReport.grandBucketTotals;
    csvRows.push(["Total", g["Current"], g["1-30 Days"], g["31-60 Days"], g["61-90 Days"], g["90+ Days"], g["No Due Date"], currentReport.grandTotal]
      .map((v) => `"${v}"`).join(","));

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-ap-aging-${company.companyCode}-${currentReport.asOfDate}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("AP Aging exported as CSV.", "success", { title: "Export complete" });
  }

  function printReport() {
    if (!currentReport.vendors.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=1000,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }

    const rows = currentReport.vendors.map((v) => `<tr>
      <td>${escapeHtml(v.vendor ? v.vendor.vendorName : "Vendor Unknown")}</td>
      <td>${formatCurrency(v.bucketTotals["Current"])}</td>
      <td>${formatCurrency(v.bucketTotals["1-30 Days"])}</td>
      <td>${formatCurrency(v.bucketTotals["31-60 Days"])}</td>
      <td>${formatCurrency(v.bucketTotals["61-90 Days"])}</td>
      <td>${formatCurrency(v.bucketTotals["90+ Days"])}</td>
      <td>${formatCurrency(v.bucketTotals["No Due Date"])}</td>
      <td>${formatCurrency(v.total)}</td>
    </tr>`).join("");
    const g = currentReport.grandBucketTotals;

    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Accounts Payable Aging</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#1E3A8A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:10.5px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:9px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Accounts Payable Aging</h1>
        <p>As of ${escapeHtml(currentReport.asOfDate)} · Generated ${escapeHtml(formatDateTime(new Date()))}</p>
        <table><thead><tr><th>Vendor</th><th>Current</th><th>1-30</th><th>31-60</th><th>61-90</th><th>90+</th><th>No Due Date</th><th>Total</th></tr></thead>
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
    if (!window.ERP.enforcePageAccess(session, "ap-aging")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Computing AP aging…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#apaContent").hidden = true;
      $("#apaSubtitle").textContent = "No active company yet.";
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const preview = ERP_APAgingRepository.getAgingReport(company.id, today);

      if (preview.vendors.length === 0) {
        $("#noPostingsState").hidden = false;
        $("#apaContent").hidden = true;
        $("#apaSubtitle").textContent = `Nothing outstanding for ${company.name}.`;
      } else {
        $("#noCompanyState").hidden = true;
        $("#noPostingsState").hidden = true;
        $("#apaContent").hidden = false;
        $("#apaHeaderActions").hidden = false;
        $("#apaSubtitle").textContent = `Payables aging for ${company.name} (${company.companyCode}).`;
        $("#apaAsOfDate").value = today;
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
