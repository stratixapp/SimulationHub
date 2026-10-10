/* =============================================================================
   DOT ERP — pages/vendor-confirmation.js
   Phase 4, Module 11: Vendor Confirmation

   The FIFTH "no data file of its own" module (after PR Approval, Vendor
   Selection, Quotation Comparison, PO Approval). Reads and writes
   `ERP_PurchaseOrderRepository` (data/po-data.js) exclusively, calling the
   `confirm()`/`declineByVendor()` methods Module 9 built and Module 10
   left untouched — the last of the three unwired-ahead-of-time hooks
   po-data.js's header describes.

   THIS MODULE REPRESENTS AN OUTSIDE PARTY'S DECISION, NOT AN INTERNAL
   ONE — the one real difference from every other decision-queue module
   in this codebase (PR Approval, PO Approval). Those represent someone
   AT THE COMPANY authorizing spend; this represents someone at the
   company RECORDING what a vendor said. Two concrete consequences:
   - No role-restriction hint (`vcInfoBanner` is a plain, always-visible
     explanation of what this module represents, not a soft "you might
     not be the right role" warning like PO Approval's `poaRoleHint`) —
     there's no realistic "wrong person is doing this" case the way
     there is for authorizing spend.
   - Confirming gets its own small modal (`vcConfirmModal`), not a bare
     `openConfirm()` — unlike every other Approve action in this
     codebase, Confirm here can OPTIONALLY capture the vendor's own
     promised delivery date (see po-data.js's `confirm()` header),
     something worth a form field, not just a confirm-dialog message.

   SAME SCOPE RESTRICTION AS PO APPROVAL, ONE TIER FURTHER: this page
   only ever concerns itself with orders that have been Sent — Draft,
   Submitted, Approved, Rejected, and Cancelled purchase orders never
   appear here, on either the queue or the "All" view, because none of
   them have reached a vendor yet (or, for Rejected/Cancelled, never
   will). "All" here means "all of Sent/Confirmed/Vendor Declined," not
   literally every status.

   DECLINE HAS NO REVISE-AND-RESEND. Unlike PO Approval's Reject (which
   sends the SAME record back to Draft via `reopen()`), a vendor decline
   is deliberately treated as a dead end for this specific record — real-
   world, whatever made a vendor say no (price, capacity, stock) usually
   needs actual renegotiation, most realistically a fresh Purchase Order,
   not a silent retry of the same one. So `vcDetailFooter` offers no
   "revise" action on a Vendor Declined order, only Cancel back on
   Purchase Order's own page.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime, formatCurrency,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let filterStatus = "Sent"; // the queue, not "all" — see file header
  let sortOrder = "desc";
  let searchTerm = "";
  let page = 1;
  let detailId = null;
  let decidingId = null; // PO awaiting a Confirm or Decline decision


  function statusBadgeClass(status) {
    if (status === "Confirmed") return "success";
    if (status === "Vendor Declined") return "danger";
    if (status === "Sent") return "warning";
    return "neutral";
  }

  /** Same three-hop helper Purchase Order's and PO Approval's own pages
      use to resolve a PO line back to a PR line's description. */
  function getSourceLines(quotation) {
    if (!quotation) return [];
    const rfq = ERP_RfqRepository.findById(quotation.rfqId);
    const pr = rfq ? ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId) : null;
    return pr ? (pr.lineItems || []) : [];
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_PurchaseOrderRepository.getAllForCompany(company.id)
      .filter((p) => p.status === "Sent" || p.status === "Confirmed" || p.status === "Vendor Declined");

    if (filterStatus !== "all") rows = rows.filter((p) => p.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((p) => {
        const vendor = p.vendorId ? ERP_VendorRepository.findById(p.vendorId) : null;
        return p.poCode.toLowerCase().includes(term) || (vendor && vendor.vendorName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_PurchaseOrderRepository.getAllForCompany(company.id);
    const pending = all.filter((p) => p.status === "Sent");
    const confirmed = all.filter((p) => p.status === "Confirmed");
    const declined = all.filter((p) => p.status === "Vendor Declined");
    $("#vcSummaryPending").textContent = String(pending.length);
    $("#vcSummaryApproved").textContent = String(confirmed.length);
    $("#vcSummaryRejected").textContent = String(declined.length);
    $("#vcSummaryReviewed").textContent = String(confirmed.length + declined.length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#vcPagination");
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

    $("#vcEmptyState").hidden = all.length !== 0;
    $("#vcTable").hidden = all.length === 0;

    $("#vcTableBody").innerHTML = pageItems.map((p) => {
      const vendor = p.vendorId ? ERP_VendorRepository.findById(p.vendorId) : null;
      const quotation = p.linkedQuotationId ? ERP_QuotationRepository.findById(p.linkedQuotationId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(p.status)}">${p.status}</span>`;
      const { total, pricedCount, totalCount } = ERP_PurchaseOrderRepository.computeGrandTotal(p);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);
      const sentOn = p.sentAt ? formatDateTime(new Date(p.sentAt)) : `<span class="profile-subtle">—</span>`;
      const quickActionHtml = p.status === "Sent"
        ? `<button type="button" class="link-btn" data-action="review" data-id="${p.id}">Record Response</button>`
        : "";

      return `
      <tr>
        <td><code>${escapeHtml(p.poCode)}</code></td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${quotation ? `<code>${escapeHtml(quotation.quotationCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${totalCount}</td>
        <td>${totalLabel}</td>
        <td>${sentOn}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${p.id}">View</button>
          ${quickActionHtml}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#vcStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#vcStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#vcSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#vcSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#vcExportCsvBtn").addEventListener("click", exportCsv);
    $("#vcPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["PO Code", "Vendor", "Built From", "Line Items", "Order Total", "Sent On", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((p) => {
      const vendor = p.vendorId ? ERP_VendorRepository.findById(p.vendorId) : null;
      const quotation = p.linkedQuotationId ? ERP_QuotationRepository.findById(p.linkedQuotationId) : null;
      const { total, totalCount } = ERP_PurchaseOrderRepository.computeGrandTotal(p);
      const line = [
        p.poCode, vendor ? vendor.vendorName : "", quotation ? quotation.quotationCode : "", totalCount,
        total, p.sentAt || "", p.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-vendor-confirmations-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Purchase orders exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((p) => {
      const vendor = p.vendorId ? ERP_VendorRepository.findById(p.vendorId) : null;
      const { total, totalCount } = ERP_PurchaseOrderRepository.computeGrandTotal(p);
      return `<tr><td>${escapeHtml(p.poCode)}</td><td>${vendor ? escapeHtml(vendor.vendorName) : ""}</td><td>${totalCount}</td><td>${escapeHtml(formatCurrency(total))}</td><td>${escapeHtml(p.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Vendor Confirmation Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Vendor Confirmation Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>PO Code</th><th>Vendor</th><th>Lines</th><th>Order Total</th><th>Status</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast('Opened the print dialog — choose "Save as PDF" to export.', "info", { title: "Export PDF" });
  }


  /* -----------------------------------------------------------------------
     RECENT CHANGES — shares the "Purchase Order" activity module name
     with Modules 9/10, so a confirm/decline shows up in every relevant
     feed (they're all actions on the same underlying record).
     --------------------------------------------------------------------- */
  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Purchase Order" && (e.action === "Vendor Confirm" || e.action === "Vendor Decline"))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#vcActivityEmptyState").hidden = relevant.length !== 0;
    $("#vcActivityList").innerHTML = relevant.map((e) => `
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
     WORKFLOW ACTIONS — the only two this module owns.
     --------------------------------------------------------------------- */
  function requestConfirm(po) {
    decidingId = po.id;
    $("#vcConfirmDeliveryDate").value = "";
    openModal("vcConfirmModal");
  }

  function bindConfirmModal() {
    $("#vcConfirmSaveBtn").addEventListener("click", () => {
      const po = ERP_PurchaseOrderRepository.findById(decidingId);
      if (!po) { closeModal("vcConfirmModal"); return; }
      const promisedDate = $("#vcConfirmDeliveryDate").value || null;
      ERP_PurchaseOrderRepository.confirm(po.id, session.username, promisedDate);
      const dateNote = promisedDate ? ` (vendor promised ${promisedDate})` : "";
      logSystemActivity({ module: "Purchase Order", action: "Vendor Confirm", description: `Recorded vendor confirmation on purchase order "${po.poCode}"${dateNote} (${company.name})` });
      closeModal("vcConfirmModal");
      renderAll();
      renderActivity();
      if (detailId === po.id) openDetailModal(ERP_PurchaseOrderRepository.findById(po.id));
      showToast(`"${po.poCode}" recorded as Confirmed.`, "success");
    });
  }

  function requestDecline(po) {
    decidingId = po.id;
    $("#vcDeclineReason").value = "";
    $("#vcDeclineReasonError").textContent = "";
    openModal("vcDeclineModal");
  }

  function bindDeclineModal() {
    $("#vcDeclineConfirmBtn").addEventListener("click", () => {
      const reason = $("#vcDeclineReason").value.trim();
      if (!reason) { $("#vcDeclineReasonError").textContent = "Capture what the vendor said — it's the main thing anyone re-sourcing this will have to go on."; return; }
      const po = ERP_PurchaseOrderRepository.findById(decidingId);
      if (!po) { closeModal("vcDeclineModal"); return; }
      ERP_PurchaseOrderRepository.declineByVendor(po.id, session.username, reason);
      logSystemActivity({ module: "Purchase Order", action: "Vendor Decline", description: `Recorded vendor decline on purchase order "${po.poCode}": ${reason} (${company.name})`, severity: "warning" });
      closeModal("vcDeclineModal");
      renderAll();
      renderActivity();
      if (detailId === po.id) openDetailModal(ERP_PurchaseOrderRepository.findById(po.id));
      showToast(`"${po.poCode}" recorded as Vendor Declined.`, "info");
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL (read-only)
     --------------------------------------------------------------------- */
  function renderLineItemsReadOnly(po) {
    const lines = po.lineItems || [];
    $("#vcLineEmptyState").hidden = lines.length !== 0;
    $("#vcLineTable").hidden = lines.length === 0;

    const quotation = ERP_QuotationRepository.findById(po.linkedQuotationId);
    const prLines = getSourceLines(quotation);
    const prLineById = {};
    prLines.forEach((l) => { prLineById[l.id] = l; });

    $("#vcLineTableBody").innerHTML = lines.map((line) => {
      const prLine = prLineById[line.prLineItemId];
      const item = prLine && prLine.itemId ? ERP_ItemRepository.findById(prLine.itemId) : null;
      const label = item
        ? `${escapeHtml(item.itemName)}${prLine.lineDescription ? " — " + escapeHtml(prLine.lineDescription) : ""}`
        : escapeHtml((prLine && prLine.lineDescription) || "—");
      const total = ERP_PurchaseOrderRepository.computeLineTotal(line);
      const priceLabel = line.unitPrice != null ? escapeHtml(formatCurrency(line.unitPrice)) : `<span class="profile-subtle">—</span>`;
      const totalLabel = total != null ? escapeHtml(formatCurrency(total)) : `<span class="profile-subtle">—</span>`;
      return `<tr><td>${label}</td><td>${escapeHtml(String(line.quantity))}</td><td>${priceLabel}</td><td>${totalLabel}</td></tr>`;
    }).join("");

    const { total, pricedCount, totalCount } = ERP_PurchaseOrderRepository.computeGrandTotal(po);
    if (totalCount === 0) {
      $("#vcGrandTotalLine").textContent = "";
    } else if (pricedCount === totalCount) {
      $("#vcGrandTotalLine").textContent = `Order total: ${formatCurrency(total)}`;
    } else {
      $("#vcGrandTotalLine").textContent = `Order total: ~${formatCurrency(total)} (${pricedCount} of ${totalCount} lines priced)`;
    }
  }

  function renderDetailFooter(po) {
    const footer = $("#vcDetailFooter");
    footer.innerHTML = "";
    if (po.status !== "Sent") return;
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Decline", "btn btn--danger-outline", () => requestDecline(po));
    addBtn("Confirm", "btn btn--primary", () => requestConfirm(po));
  }

  function openDetailModal(po) {
    detailId = po.id;
    const quotation = ERP_QuotationRepository.findById(po.linkedQuotationId);
    const vendor = po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
    const warehouse = po.deliveryWarehouseId ? ERP_WarehouseRepository.findById(po.deliveryWarehouseId) : null;
    const terms = po.paymentTermsId ? ERP_PaymentTermsRepository.findById(po.paymentTermsId) : null;

    $("#vcDetailTitle").textContent = `${po.poCode} · ${po.status}`;

    const rows = [];
    rows.push(`<div><dt>PO Code</dt><dd><code>${escapeHtml(po.poCode)}</code></dd></div>`);
    rows.push(`<div><dt>Built From</dt><dd>${quotation ? `<code>${escapeHtml(quotation.quotationCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Delivery Warehouse</dt><dd>${warehouse ? escapeHtml(warehouse.warehouseName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Payment Terms</dt><dd>${terms ? escapeHtml(terms.termName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Requested Delivery</dt><dd>${po.expectedDeliveryDate ? escapeHtml(po.expectedDeliveryDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(po.status)}">${po.status}</span></dd></div>`);
    if (po.sentAt) rows.push(`<div><dt>Sent</dt><dd>${formatDateTime(new Date(po.sentAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.sentByUsername))}</dd></div>`);
    if (po.status === "Confirmed" && po.confirmedAt) {
      rows.push(`<div><dt>Confirmed</dt><dd>${formatDateTime(new Date(po.confirmedAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.confirmedByUsername))}</dd></div>`);
      if (po.vendorConfirmedDeliveryDate) rows.push(`<div><dt>Vendor's Promised Delivery</dt><dd>${escapeHtml(po.vendorConfirmedDeliveryDate)}</dd></div>`);
    }
    if (po.status === "Vendor Declined" && po.vendorDeclinedAt) {
      rows.push(`<div><dt>Vendor Declined</dt><dd>${formatDateTime(new Date(po.vendorDeclinedAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.vendorDeclinedByUsername))}</dd></div>`);
      rows.push(`<div><dt>Decline Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(po.vendorDeclineReason || "—")}</dd></div>`);
    }
    if (po.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(po.notes)}</dd></div>`);

    $("#vcDetailBody").innerHTML = rows.join("");
    renderLineItemsReadOnly(po);
    renderDetailFooter(po);
    openModal("vcDetailModal");
  }

  function bindDetailModal() {
    $("#vcTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const p = ERP_PurchaseOrderRepository.findById(viewBtn.dataset.id);
        if (p) openDetailModal(p);
        return;
      }
      if (actionBtn) {
        const p = ERP_PurchaseOrderRepository.findById(actionBtn.dataset.id);
        if (p) openDetailModal(p);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "vendor-confirmation")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading sent purchase orders…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#vcContent").hidden = true;
      $("#vcSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#vcContent").hidden = false;
      $("#vcHeaderActions").hidden = false;
      $("#vcSubtitle").textContent = `Recording vendor responses for ${company.name} (${company.companyCode}).`;

      renderAll();
      renderActivity();
      bindToolbar();
      bindDetailModal();
      bindConfirmModal();
      bindDeclineModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
