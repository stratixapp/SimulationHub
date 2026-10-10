/* =============================================================================
   DOT ERP — pages/sales-register.js
   Phase 8, Module 01: Sales Register

   Full "list module" mechanics (search-free here, but filters + pagination
   + CSV export + Print) laid over a read-only report — the shape this file
   uses is deliberately closer to a transactional list page (Tax Invoice's
   own filter/paginate pattern) than to AP Aging's small, ungrouped table,
   because this report's own row count scales with invoice-line history,
   not with a bounded master list. See data/sales-register-data.js's own
   header for why the report itself is built the way it is.
   ========================================================================== */

(function () {
  "use strict";

  const { $, escapeHtml, requireSession, runBootSequence, showToast } = window.ERP;
  const PAGE_SIZE = 10;

  let session = null;
  let company = null;
  let page = 1;
  let currentSummary = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

  function currentFilters() {
    return {
      fromDate: $("#srFromDate").value || "",
      toDate: $("#srToDate").value || "",
      customerId: $("#srCustomerFilter").value || "",
      itemId: $("#srItemFilter").value || ""
    };
  }

  function populateFilterDropdowns() {
    const customers = ERP_CustomerRepository.getAllForCompany(company.id).slice()
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
    $("#srCustomerFilter").insertAdjacentHTML("beforeend",
      customers.map((c) => `<option value="${c.id}">${escapeHtml(c.customerName)}</option>`).join(""));

    const items = ERP_ItemRepository.getAllForCompany(company.id).slice()
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
    $("#srItemFilter").insertAdjacentHTML("beforeend",
      items.map((i) => `<option value="${i.id}">${escapeHtml(i.itemName)}</option>`).join(""));
  }

  /* -----------------------------------------------------------------------
     SUMMARY + TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderSummary(summary) {
    $("#srSummaryTaxable").textContent = formatMoney(summary.totalTaxableValue);
    $("#srSummaryTax").textContent = formatMoney(summary.totalTax);
    $("#srSummaryTotal").textContent = formatMoney(summary.totalValue);
    $("#srSummaryCounts").textContent = `${summary.invoiceCount} / ${summary.lineCount}`;

    const note = $("#srSkippedNote");
    if (summary.skippedLineCount > 0) {
      note.hidden = false;
      note.textContent = `${summary.skippedLineCount} invoice line(s) omitted — unpriced, so no taxable value to report.`;
    } else {
      note.hidden = true;
    }
  }

  function renderPagination(totalPages) {
    const container = $("#srPagination");
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
    currentSummary = ERP_SalesRegisterRepository.getSummary(company.id, currentFilters());
    renderSummary(currentSummary);

    const rows = currentSummary.rows;
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);

    $("#srEmptyState").hidden = rows.length !== 0;
    $("#srTable").hidden = rows.length === 0;

    $("#srTableBody").innerHTML = pageRows.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.invoiceCode)}</code></td>
        <td>${escapeHtml(r.invoiceDate || "—")}</td>
        <td>${escapeHtml(r.customerName)}</td>
        <td>${escapeHtml(r.itemName)}</td>
        <td>${escapeHtml(r.hsnCode)}</td>
        <td class="text-right">${formatQty(r.quantity)}</td>
        <td class="text-right">${formatMoney(r.unitPrice)}</td>
        <td class="text-right">${formatMoney(r.taxableValue)}</td>
        <td class="text-right">${r.cgstAmount ? formatMoney(r.cgstAmount) : "—"}</td>
        <td class="text-right">${r.sgstAmount ? formatMoney(r.sgstAmount) : "—"}</td>
        <td class="text-right">${r.igstAmount ? formatMoney(r.igstAmount) : "—"}</td>
        <td class="text-right"><strong>${formatMoney(r.lineTotal)}</strong></td>
      </tr>`).join("");

    renderPagination(totalPages);
  }

  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function thisMonthRange() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const iso = (d) => d.toISOString().slice(0, 10);
    return { from: iso(first), to: iso(last) };
  }

  function bindToolbar() {
    ["#srFromDate", "#srToDate", "#srCustomerFilter", "#srItemFilter"].forEach((sel) => {
      $(sel).addEventListener("change", () => { page = 1; renderTable(); });
    });
    $("#srThisMonthBtn").addEventListener("click", () => {
      const { from, to } = thisMonthRange();
      $("#srFromDate").value = from;
      $("#srToDate").value = to;
      page = 1;
      renderTable();
    });
    $("#srClearFiltersBtn").addEventListener("click", () => {
      $("#srFromDate").value = "";
      $("#srToDate").value = "";
      $("#srCustomerFilter").value = "";
      $("#srItemFilter").value = "";
      page = 1;
      renderTable();
    });
    $("#srExportCsvBtn").addEventListener("click", exportCsv);
    $("#srPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    if (!currentSummary || !currentSummary.rows.length) { showToast("Nothing to export — no invoice lines match the current filters.", "warning"); return; }
    const header = ["Invoice", "Date", "Customer", "Item", "HSN", "Qty", "Rate", "Taxable Value", "CGST", "SGST", "IGST", "Total"];
    const lines = [header.join(",")];
    currentSummary.rows.forEach((r) => {
      lines.push([
        r.invoiceCode, r.invoiceDate, `"${r.customerName.replace(/"/g, '""')}"`, `"${r.itemName.replace(/"/g, '""')}"`,
        r.hsnCode, r.quantity, r.unitPrice.toFixed(2), r.taxableValue.toFixed(2),
        r.cgstAmount.toFixed(2), r.sgstAmount.toFixed(2), r.igstAmount.toFixed(2), r.lineTotal.toFixed(2)
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sales-register-${company.companyCode}.csv`;
    link.click();
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "sales-register")) return;

    runBootSequence([
      { p: 35, t: "Reading Tax Invoices…" },
      { p: 70, t: "Working out CGST / SGST / IGST…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#srContent").hidden = true;
      $("#srSubtitle").textContent = "No active company yet.";
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    const anyRaised = ERP_TaxInvoiceRepository.getAllForCompany(company.id).some((inv) => inv.status === "Raised");
    if (!anyRaised) {
      $("#noCompanyState").hidden = true;
      $("#noPostingsState").hidden = false;
      $("#srContent").hidden = true;
      $("#srSubtitle").textContent = `No Raised Tax Invoices yet for ${company.name} (${company.companyCode}).`;
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    $("#noCompanyState").hidden = true;
    $("#noPostingsState").hidden = true;
    $("#srContent").hidden = false;
    $("#srHeaderActions").hidden = false;
    $("#srSubtitle").textContent = `Every Raised Tax Invoice line for ${company.name} (${company.companyCode}).`;

    populateFilterDropdowns();
    bindToolbar();
    renderTable();

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
