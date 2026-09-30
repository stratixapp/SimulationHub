/* =============================================================================
   DOT ERP — pages/purchase-register.js
   Phase 8, Module 02: Purchase Register

   Same "list module" mechanics as sales-register.js. See
   data/purchase-register-data.js's own header for why this reads Invoice
   Verification (not GRN) and why its tax figures are labeled estimated.
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
      fromDate: $("#prFromDate").value || "",
      toDate: $("#prToDate").value || "",
      vendorId: $("#prVendorFilter").value || "",
      itemId: $("#prItemFilter").value || ""
    };
  }

  function populateFilterDropdowns() {
    const vendors = ERP_VendorRepository.getAllForCompany(company.id).slice()
      .sort((a, b) => a.vendorName.localeCompare(b.vendorName));
    $("#prVendorFilter").insertAdjacentHTML("beforeend",
      vendors.map((v) => `<option value="${v.id}">${escapeHtml(v.vendorName)}</option>`).join(""));

    const items = ERP_ItemRepository.getAllForCompany(company.id).slice()
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
    $("#prItemFilter").insertAdjacentHTML("beforeend",
      items.map((i) => `<option value="${i.id}">${escapeHtml(i.itemName)}</option>`).join(""));
  }

  /* -----------------------------------------------------------------------
     SUMMARY + TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderSummary(summary) {
    $("#prSummaryTaxable").textContent = formatMoney(summary.totalTaxableValue);
    $("#prSummaryTax").textContent = formatMoney(summary.totalTax);
    $("#prSummaryTotal").textContent = formatMoney(summary.totalValue);
    $("#prSummaryCounts").textContent = `${summary.verificationCount} / ${summary.lineCount}`;

    const note = $("#prSkippedNote");
    const bits = [];
    if (summary.skippedLineCount > 0) bits.push(`${summary.skippedLineCount} line(s) omitted — unpriced.`);
    if (summary.unresolvedLineCount > 0) bits.push(`${summary.unresolvedLineCount} line(s) shown as "Unresolved line" — their procurement chain couldn't be traced back to a catalog item.`);
    if (bits.length) { note.hidden = false; note.textContent = bits.join(" "); }
    else note.hidden = true;
  }

  function renderPagination(totalPages) {
    const container = $("#prPagination");
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
    currentSummary = ERP_PurchaseRegisterRepository.getSummary(company.id, currentFilters());
    renderSummary(currentSummary);

    const rows = currentSummary.rows;
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);

    $("#prEmptyState").hidden = rows.length !== 0;
    $("#prTable").hidden = rows.length === 0;

    $("#prTableBody").innerHTML = pageRows.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.verificationCode)}</code></td>
        <td>${escapeHtml(r.vendorInvoiceNumber || "—")}</td>
        <td>${escapeHtml(r.invoiceDate || "—")}</td>
        <td>${escapeHtml(r.vendorName)}</td>
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
    ["#prFromDate", "#prToDate", "#prVendorFilter", "#prItemFilter"].forEach((sel) => {
      $(sel).addEventListener("change", () => { page = 1; renderTable(); });
    });
    $("#prThisMonthBtn").addEventListener("click", () => {
      const { from, to } = thisMonthRange();
      $("#prFromDate").value = from;
      $("#prToDate").value = to;
      page = 1;
      renderTable();
    });
    $("#prClearFiltersBtn").addEventListener("click", () => {
      $("#prFromDate").value = "";
      $("#prToDate").value = "";
      $("#prVendorFilter").value = "";
      $("#prItemFilter").value = "";
      page = 1;
      renderTable();
    });
    $("#prExportCsvBtn").addEventListener("click", exportCsv);
    $("#prPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    if (!currentSummary || !currentSummary.rows.length) { showToast("Nothing to export — no invoice lines match the current filters.", "warning"); return; }
    const header = ["Verification", "Vendor Bill #", "Date", "Vendor", "Item", "HSN", "Qty", "Rate", "Taxable Value", "CGST (est.)", "SGST (est.)", "IGST (est.)", "Total"];
    const lines = [header.join(",")];
    currentSummary.rows.forEach((r) => {
      lines.push([
        r.verificationCode, r.vendorInvoiceNumber || "", r.invoiceDate, `"${r.vendorName.replace(/"/g, '""')}"`, `"${r.itemName.replace(/"/g, '""')}"`,
        r.hsnCode, r.quantity, r.unitPrice.toFixed(2), r.taxableValue.toFixed(2),
        r.cgstAmount.toFixed(2), r.sgstAmount.toFixed(2), r.igstAmount.toFixed(2), r.lineTotal.toFixed(2)
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `purchase-register-${company.companyCode}.csv`;
    link.click();
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "purchase-register")) return;

    runBootSequence([
      { p: 35, t: "Reading Invoice Verifications…" },
      { p: 70, t: "Walking the procurement chain…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#prContent").hidden = true;
      $("#prSubtitle").textContent = "No active company yet.";
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    const anyVerified = ERP_InvoiceVerificationRepository.getAllForCompany(company.id).some((v) => v.status === "Verified");
    if (!anyVerified) {
      $("#noCompanyState").hidden = true;
      $("#noPostingsState").hidden = false;
      $("#prContent").hidden = true;
      $("#prSubtitle").textContent = `No Verified invoices yet for ${company.name} (${company.companyCode}).`;
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    $("#noCompanyState").hidden = true;
    $("#noPostingsState").hidden = true;
    $("#prContent").hidden = false;
    $("#prHeaderActions").hidden = false;
    $("#prSubtitle").textContent = `Every Verified Invoice Verification line for ${company.name} (${company.companyCode}).`;

    populateFilterDropdowns();
    bindToolbar();
    renderTable();

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
