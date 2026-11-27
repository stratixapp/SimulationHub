/* =============================================================================
   DOT ERP — pages/po-approval.js
   Phase 4, Module 10: PO Approval

   The FOURTH "no data file of its own" module (after PR Approval, Vendor
   Selection, and Quotation Comparison — see CONTINUE_HERE.md Section 9's
   "one repository, multiple pages" note). This page reads and writes
   `ERP_PurchaseOrderRepository` (data/po-data.js) exclusively, calling the
   `approve()`/`reject()` methods Module 9 built but deliberately never
   wired to a button — the exact same split PR/PR Approval established.
   See po-data.js's header for the full reasoning, including why THIS
   split additionally leaves Approved -> Sent to Module 9's own page
   rather than pulling it in here (dispatching an approved document is an
   administrative action, not a decision).

   SAME SCOPE RESTRICTION AS PR APPROVAL: this page only ever concerns
   itself with orders that have reached Submitted at least once (Submitted/
   Approved/Rejected) — a Draft, Sent, Confirmed, Vendor Declined, or
   Cancelled purchase order never appears here, on either the queue or the
   "All" view, because this module has no action to offer on any of them.

   NO ANCHOR EMPTY STATE, DEFAULT FILTER IS THE QUEUE NOT "ALL", ROLE
   REALISM, READ-ONLY DETAIL MODAL — all four carried forward unchanged
   from PR Approval; see that file's own header for the reasoning behind
   each, not re-explained here.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime, formatCurrency,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity
  } = window.ERP;

  const PAGE_SIZE = 8;
  const APPROVER_ROLES = ["Purchase & Sales Manager", "System Administrator"];

  let session = null;
  let company = null;
  let filterStatus = "Submitted"; // the queue, not "all" — see file header
  let sortOrder = "desc";
  let searchTerm = "";
  let page = 1;
  let detailId = null;
  let rejectingId = null;


  function statusBadgeClass(status) {
    if (status === "Approved") return "success";
    if (status === "Rejected") return "danger";
    if (status === "Submitted") return "warning";
    return "neutral";
  }

  /** The PR line items a quotation's pricing (and therefore a PO's own
      lines) are ultimately resolved against — same helper Purchase
      Order's own page uses, duplicated here rather than shared because
      this page has no data file to hang a shared helper off of and the
      whole function is three lines. */
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
      .filter((p) => p.status === "Submitted" || p.status === "Approved" || p.status === "Rejected");

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
    const pending = all.filter((p) => p.status === "Submitted");
    const approved = all.filter((p) => p.status === "Approved");
    const rejected = all.filter((p) => p.status === "Rejected");
    $("#poaSummaryPending").textContent = String(pending.length);
    $("#poaSummaryApproved").textContent = String(approved.length);
    $("#poaSummaryRejected").textContent = String(rejected.length);
    $("#poaSummaryReviewed").textContent = String(approved.length + rejected.length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#poaPagination");
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

    $("#poaEmptyState").hidden = all.length !== 0;
    $("#poaTable").hidden = all.length === 0;

    $("#poaTableBody").innerHTML = pageItems.map((p) => {
      const vendor = p.vendorId ? ERP_VendorRepository.findById(p.vendorId) : null;
      const quotation = p.linkedQuotationId ? ERP_QuotationRepository.findById(p.linkedQuotationId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(p.status)}">${p.status}</span>`;
      const { total, pricedCount, totalCount } = ERP_PurchaseOrderRepository.computeGrandTotal(p);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);
      const submittedOn = p.submittedAt ? formatDateTime(new Date(p.submittedAt)) : `<span class="profile-subtle">—</span>`;
      const quickActionHtml = p.status === "Submitted"
        ? `<button type="button" class="link-btn" data-action="review" data-id="${p.id}">Review</button>`
        : "";

      return `
      <tr>
        <td><code>${escapeHtml(p.poCode)}</code></td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${quotation ? `<code>${escapeHtml(quotation.quotationCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${totalCount}</td>
        <td>${totalLabel}</td>
        <td>${submittedOn}</td>
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
    $$("#poaStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#poaStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#poaSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#poaSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#poaExportCsvBtn").addEventListener("click", exportCsv);
    $("#poaPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["PO Code", "Vendor", "Built From", "Line Items", "Order Total", "Submitted On", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((p) => {
      const vendor = p.vendorId ? ERP_VendorRepository.findById(p.vendorId) : null;
      const quotation = p.linkedQuotationId ? ERP_QuotationRepository.findById(p.linkedQuotationId) : null;
      const { total, totalCount } = ERP_PurchaseOrderRepository.computeGrandTotal(p);
      const line = [
        p.poCode, vendor ? vendor.vendorName : "", quotation ? quotation.quotationCode : "", totalCount,
        total, p.submittedAt || "", p.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-po-approvals-${company.companyCode}.csv`;
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
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - PO Approval Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — PO Approval Register</h1>
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
     with Module 9, so approvals/rejections show up in BOTH pages' feeds
     (they're both actions on the same underlying record).
     --------------------------------------------------------------------- */
  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Purchase Order" && (e.action === "Approve" || e.action === "Reject"))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#poaActivityEmptyState").hidden = relevant.length !== 0;
    $("#poaActivityList").innerHTML = relevant.map((e) => `
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
  function requestApprove(po) {
    openConfirm({
      title: "Approve this purchase order?",
      message: `"${po.poCode}" will be approved and become ready to send to the vendor from Purchase Order.`,
      confirmLabel: "Approve",
      onConfirm: () => {
        ERP_PurchaseOrderRepository.approve(po.id, session.username);
        logSystemActivity({ module: "Purchase Order", action: "Approve", description: `Approved purchase order "${po.poCode}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === po.id) openDetailModal(ERP_PurchaseOrderRepository.findById(po.id));
        showToast(`"${po.poCode}" approved.`, "success");
      }
    });
  }

  function requestReject(po) {
    rejectingId = po.id;
    $("#poaRejectReason").value = "";
    $("#poaRejectReasonError").textContent = "";
    openModal("poaRejectModal");
  }

  function bindRejectModal() {
    $("#poaRejectConfirmBtn").addEventListener("click", () => {
      const reason = $("#poaRejectReason").value.trim();
      if (!reason) { $("#poaRejectReasonError").textContent = "A reason is required so the creator knows what to fix."; return; }
      const po = ERP_PurchaseOrderRepository.findById(rejectingId);
      if (!po) { closeModal("poaRejectModal"); return; }
      ERP_PurchaseOrderRepository.reject(po.id, session.username, reason);
      logSystemActivity({ module: "Purchase Order", action: "Reject", description: `Rejected purchase order "${po.poCode}" for ${company.name}: ${reason}`, severity: "warning" });
      closeModal("poaRejectModal");
      renderAll();
      renderActivity();
      if (detailId === po.id) openDetailModal(ERP_PurchaseOrderRepository.findById(po.id));
      showToast(`"${po.poCode}" rejected.`, "info");
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL (read-only)
     --------------------------------------------------------------------- */
  function renderLineItemsReadOnly(po) {
    const lines = po.lineItems || [];
    $("#poaLineEmptyState").hidden = lines.length !== 0;
    $("#poaLineTable").hidden = lines.length === 0;

    const quotation = ERP_QuotationRepository.findById(po.linkedQuotationId);
    const prLines = getSourceLines(quotation);
    const prLineById = {};
    prLines.forEach((l) => { prLineById[l.id] = l; });

    $("#poaLineTableBody").innerHTML = lines.map((line) => {
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
      $("#poaGrandTotalLine").textContent = "";
    } else if (pricedCount === totalCount) {
      $("#poaGrandTotalLine").textContent = `Order total: ${formatCurrency(total)}`;
    } else {
      $("#poaGrandTotalLine").textContent = `Order total: ~${formatCurrency(total)} (${pricedCount} of ${totalCount} lines priced)`;
    }
  }

  function renderDetailFooter(po) {
    const footer = $("#poaDetailFooter");
    footer.innerHTML = "";
    if (po.status !== "Submitted") return;
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Reject", "btn btn--danger-outline", () => requestReject(po));
    addBtn("Approve", "btn btn--primary", () => requestApprove(po));
  }

  function openDetailModal(po) {
    detailId = po.id;
    const quotation = ERP_QuotationRepository.findById(po.linkedQuotationId);
    const vendor = po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
    const warehouse = po.deliveryWarehouseId ? ERP_WarehouseRepository.findById(po.deliveryWarehouseId) : null;
    const terms = po.paymentTermsId ? ERP_PaymentTermsRepository.findById(po.paymentTermsId) : null;

    $("#poaDetailTitle").textContent = `${po.poCode} · ${po.status}`;

    const rows = [];
    rows.push(`<div><dt>PO Code</dt><dd><code>${escapeHtml(po.poCode)}</code></dd></div>`);
    rows.push(`<div><dt>Built From</dt><dd>${quotation ? `<code>${escapeHtml(quotation.quotationCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Delivery Warehouse</dt><dd>${warehouse ? escapeHtml(warehouse.warehouseName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Payment Terms</dt><dd>${terms ? escapeHtml(terms.termName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Expected Delivery</dt><dd>${po.expectedDeliveryDate ? escapeHtml(po.expectedDeliveryDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(po.status)}">${po.status}</span></dd></div>`);
    if (po.submittedAt) rows.push(`<div><dt>Submitted</dt><dd>${formatDateTime(new Date(po.submittedAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.submittedByUsername))}</dd></div>`);
    if (po.status === "Approved" && po.approvedAt) rows.push(`<div><dt>Approved</dt><dd>${formatDateTime(new Date(po.approvedAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.approvedByUsername))}</dd></div>`);
    if (po.status === "Rejected" && po.rejectedAt) {
      rows.push(`<div><dt>Rejected</dt><dd>${formatDateTime(new Date(po.rejectedAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.rejectedByUsername))}</dd></div>`);
      rows.push(`<div><dt>Rejection Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(po.rejectionReason || "—")}</dd></div>`);
    }
    if (po.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(po.notes)}</dd></div>`);

    $("#poaDetailBody").innerHTML = rows.join("");
    renderLineItemsReadOnly(po);
    renderDetailFooter(po);
    openModal("poaDetailModal");
  }

  function bindDetailModal() {
    $("#poaTableBody").addEventListener("click", (e) => {
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
    if (!window.ERP.enforcePageAccess(session, "po-approval")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading approval queue…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#poaContent").hidden = true;
      $("#poaSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#poaContent").hidden = false;
      $("#poaHeaderActions").hidden = false;
      $("#poaSubtitle").textContent = `Reviewing purchase orders for ${company.name} (${company.companyCode}).`;

      if (!APPROVER_ROLES.includes(session.role)) {
        $("#poaRoleHint").textContent = `You're signed in as ${session.fullName} (${session.role}). In a real company, PO approval is usually restricted to a Purchase & Sales Manager or System Administrator — this screen shows that as a reminder rather than a hard block, so you can still review and decide below.`;
        $("#poaRoleHint").hidden = false;
      }

      renderAll();
      renderActivity();
      bindToolbar();
      bindDetailModal();
      bindRejectModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
