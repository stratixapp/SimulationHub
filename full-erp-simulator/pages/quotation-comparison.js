/* =============================================================================
   DOT ERP — pages/quotation-comparison.js
   Phase 4, Module 7: Quotation Comparison

   Reads and writes ERP_QuotationRepository (data/quotation-data.js)
   exclusively — see its header for why isRecommended lives on the
   quotation record. Third module (after PR Approval, Vendor Selection)
   with no data file of its own.

   SCOPE: THIS PAGE OPERATES ON RFQs, NOT INDIVIDUAL QUOTATIONS. The main
   list is "RFQs that have at least one Received quotation" — opening one
   shows every Received quotation for THAT RFQ side by side. Recommend
   saves immediately per row, the same "quick, individually-reversible
   working decision" shape as Vendor Selection, not a form.

   DELIBERATELY SUMMARY-LEVEL, NOT PER-LINE. The comparison table shows
   quoted total / delivery days / validity per vendor — not a per-line
   price breakdown. A full line-by-line view is one click away in
   Quotation Receipt's own Detail modal; duplicating that here would
   crowd out the actual comparison this module exists for.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime, formatCurrency,
    showToast, openModal, closeModal, requireSession, runBootSequence,
    logSystemActivity
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let filterMode = "all"; // all | undecided | decided
  let sortOrder = "desc";
  let searchTerm = "";
  let page = 1;
  let detailRfqId = null;


  function getReceivedQuotationsForRfq(rfqId) {
    return ERP_QuotationRepository.getAllForRfq(rfqId).filter((q) => q.status === "Received");
  }

  /** Every RFQ (any status) with at least one Received quotation. */
  function getComparableRfqs(companyId) {
    return ERP_RfqRepository.getAllForCompany(companyId)
      .filter((r) => getReceivedQuotationsForRfq(r.id).length > 0);
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = getComparableRfqs(company.id);

    if (filterMode !== "all") {
      rows = rows.filter((r) => {
        const hasRecommendation = getReceivedQuotationsForRfq(r.id).some((q) => q.isRecommended);
        return filterMode === "decided" ? hasRecommendation : !hasRecommendation;
      });
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((r) => {
        const pr = ERP_PurchaseRequisitionRepository.findById(r.linkedPrId);
        return r.rfqCode.toLowerCase().includes(term) || (pr && pr.prCode.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = getComparableRfqs(company.id);
    let recommended = 0;
    all.forEach((r) => { if (getReceivedQuotationsForRfq(r.id).some((q) => q.isRecommended)) recommended++; });
    $("#qcSummaryReady").textContent = String(all.length);
    $("#qcSummaryRecommended").textContent = String(recommended);
    $("#qcSummaryUndecided").textContent = String(all.length - recommended);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#qcPagination");
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
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#qcEmptyState").hidden = all.length !== 0;
    $("#qcTable").hidden = all.length === 0;

    $("#qcTableBody").innerHTML = pageItems.map((r) => {
      const pr = ERP_PurchaseRequisitionRepository.findById(r.linkedPrId);
      const quotations = getReceivedQuotationsForRfq(r.id);
      const recommended = quotations.find((q) => q.isRecommended);
      const recommendedVendor = recommended ? ERP_VendorRepository.findById(recommended.vendorId) : null;
      const statusBadge = `<span class="status-badge status-badge--${r.status === "Closed" ? "success" : "warning"}">${r.status}</span>`;

      return `
      <tr>
        <td><code>${escapeHtml(r.rfqCode)}</code></td>
        <td>${pr ? `<code>${escapeHtml(pr.prCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${quotations.length}</td>
        <td>${recommendedVendor ? escapeHtml(recommendedVendor.vendorName) : `<span class="profile-subtle">Not yet</span>`}</td>
        <td>${statusBadge}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">Compare</button></td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#qcFilterChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#qcFilterChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterMode = chip.dataset.filter;
        page = 1;
        renderTable();
      });
    });

    $("#qcSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#qcSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#qcExportCsvBtn").addEventListener("click", exportCsv);
    $("#qcPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["RFQ Code", "Linked PR", "Quotations Received", "Recommended Vendor", "RFQ Status"];
    const csvRows = [header.join(",")];
    rows.forEach((r) => {
      const pr = ERP_PurchaseRequisitionRepository.findById(r.linkedPrId);
      const quotations = getReceivedQuotationsForRfq(r.id);
      const recommended = quotations.find((q) => q.isRecommended);
      const recommendedVendor = recommended ? ERP_VendorRepository.findById(recommended.vendorId) : null;
      const line = [r.rfqCode, pr ? pr.prCode : "", quotations.length, recommendedVendor ? recommendedVendor.vendorName : "", r.status]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-quotation-comparison-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Comparison summary exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((r) => {
      const pr = ERP_PurchaseRequisitionRepository.findById(r.linkedPrId);
      const quotations = getReceivedQuotationsForRfq(r.id);
      const recommended = quotations.find((q) => q.isRecommended);
      const recommendedVendor = recommended ? ERP_VendorRepository.findById(recommended.vendorId) : null;
      return `<tr><td>${escapeHtml(r.rfqCode)}</td><td>${pr ? escapeHtml(pr.prCode) : ""}</td><td>${quotations.length}</td><td>${recommendedVendor ? escapeHtml(recommendedVendor.vendorName) : ""}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Quotation Comparison Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Quotation Comparison Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>RFQ Code</th><th>Linked PR</th><th>Quotations</th><th>Recommended Vendor</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast('Opened the print dialog — choose "Save as PDF" to export.', "info", { title: "Export PDF" });
  }


  /* -----------------------------------------------------------------------
     RECENT CHANGES
     --------------------------------------------------------------------- */
  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Quotation Comparison")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#qcActivityEmptyState").hidden = relevant.length !== 0;
    $("#qcActivityList").innerHTML = relevant.map((e) => `
      <li class="activity-item">
        <span class="activity-item__icon">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </span>
        <div>
          <p class="activity-item__text">${escapeHtml(e.description)}</p>
          <p class="activity-item__time">${formatDateTime(new Date(e.timestamp))}</p>
        </div>
      </li>
    `).join("");
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL — Recommend saves immediately, see file header.
     --------------------------------------------------------------------- */
  function renderCompareRows(rfqId) {
    const quotations = getReceivedQuotationsForRfq(rfqId);
    $("#qcCompareEmptyState").hidden = quotations.length !== 0;
    $("#qcCompareTable").hidden = quotations.length === 0;

    $("#qcCompareTableBody").innerHTML = quotations.map((q) => {
      const vendor = ERP_VendorRepository.findById(q.vendorId);
      const { total, pricedCount, totalCount } = ERP_QuotationRepository.computeQuotedTotal(q);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);
      const actionCell = q.isRecommended
        ? `<span class="status-badge status-badge--success">Recommended</span>`
        : `<button type="button" class="link-btn" data-recommend="${q.id}">Recommend</button>`;

      return `
      <tr>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${totalLabel}</td>
        <td>${q.deliveryDays != null ? escapeHtml(String(q.deliveryDays)) : `<span class="profile-subtle">—</span>`}</td>
        <td>${q.validUntil ? escapeHtml(q.validUntil) : `<span class="profile-subtle">—</span>`}</td>
        <td>${actionCell}</td>
      </tr>`;
    }).join("");
  }

  function openDetailModal(rfq) {
    detailRfqId = rfq.id;
    const pr = ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId);

    $("#qcDetailTitle").textContent = `${rfq.rfqCode} · Compare Quotations`;

    const rows = [];
    rows.push(`<div><dt>RFQ Code</dt><dd><code>${escapeHtml(rfq.rfqCode)}</code></dd></div>`);
    rows.push(`<div><dt>Linked Requisition</dt><dd>${pr ? `<code>${escapeHtml(pr.prCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>RFQ Status</dt><dd><span class="status-badge status-badge--${rfq.status === "Closed" ? "success" : "warning"}">${rfq.status}</span></dd></div>`);
    $("#qcDetailBody").innerHTML = rows.join("");

    renderCompareRows(rfq.id);
    openModal("qcDetailModal");
  }

  function bindDetailModal() {
    $("#qcTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (viewBtn) {
        const rfq = ERP_RfqRepository.findById(viewBtn.dataset.id);
        if (rfq) openDetailModal(rfq);
      }
    });

    $("#qcCompareTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-recommend]");
      if (!btn) return;
      const quotation = ERP_QuotationRepository.findById(btn.dataset.recommend);
      if (!quotation) return;
      const vendor = ERP_VendorRepository.findById(quotation.vendorId);

      ERP_QuotationRepository.recommend(quotation.id, session.username);
      logSystemActivity({
        module: "Quotation Comparison",
        action: "Recommend",
        description: `Recommended ${vendor ? vendor.vendorName : "a vendor"}'s quotation (${company.name})`
      });

      renderAll();
      renderActivity();
      renderCompareRows(detailRfqId);
      showToast(`${vendor ? vendor.vendorName : "Quotation"} recommended.`, "success");
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "quotation-comparison")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading quotations to compare…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#qcContent").hidden = true;
      $("#qcSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#qcContent").hidden = false;
      $("#qcHeaderActions").hidden = false;
      $("#qcSubtitle").textContent = `Comparing quotations for ${company.name} (${company.companyCode}).`;

      renderAll();
      renderActivity();
      bindToolbar();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
