/* =============================================================================
   DOT ERP — pages/order-approval.js
   Phase 5, Module 4: Order Approval

   The 8th module in the codebase with NO data file of its own — it reads
   and writes `ERP_SalesOrderRepository` (data/sales-order-data.js)
   exclusively, calling the `approve()`/`reject()` methods Module 3 built
   but deliberately never wired to a button. See sales-order-data.js's
   header for why that split exists, and CONTINUE_HERE.md Section 7 for
   the full "no data file" precedent this continues (PR Approval, Vendor
   Selection, Quotation Comparison, PO Approval, Vendor Confirmation, and
   Payment Request's own inline gate came before it).

   WHY THIS PAGE HAS NO ANCHOR EMPTY STATE.
   Same reasoning as PR Approval's own: this module never creates
   anything — it only reviews sales orders Module 3 already created — so
   the only prerequisite is an active company. No `#noAnchorState` here.

   THE FIRST LIST WHOSE DEFAULT FILTER ISN'T "ALL" — SAME AS PR APPROVAL'S.
   This page's entire purpose is an approval QUEUE, so it defaults to
   "Awaiting Approval" (Submitted) instead of "All" — seeing everything is
   one click away via the "All" chip, but the useful, actionable view is
   the default.

   ROLE REALISM, SAME ROLE AS PR APPROVAL — LITERALLY, NOT BY COINCIDENCE.
   "Purchase & Sales Manager" already covers both sides of this business
   by its own name (see data/users.js) — the same APPROVER_ROLES check
   PR Approval uses applies here unchanged, no new role needed.

   DETAIL MODAL IS READ-ONLY, AND CARRIES OVER SALES ORDER'S OWN CREDIT
   NOTE. Reuses Sales Order's header + line-items Detail modal shape, but
   strips every edit affordance — no Edit Header, no line-item controls
   (Sales Order's own line items were already read-only there too, so
   there's nothing new to strip on that front). The Customer Credit row
   is worth keeping front and center here specifically, since checking it
   IS a meaningful part of what an approver is actually doing.
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


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_SalesOrderRepository.getAllForCompany(company.id)
      .filter((so) => so.status === "Submitted" || so.status === "Approved" || so.status === "Rejected");

    if (filterStatus !== "all") rows = rows.filter((so) => so.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((so) => {
        const cust = so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
        return so.salesOrderCode.toLowerCase().includes(term) || (cust && cust.customerName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_SalesOrderRepository.getAllForCompany(company.id);
    const pending = all.filter((so) => so.status === "Submitted");
    const approved = all.filter((so) => so.status === "Approved");
    const rejected = all.filter((so) => so.status === "Rejected");
    $("#oaSummaryPending").textContent = String(pending.length);
    $("#oaSummaryApproved").textContent = String(approved.length);
    $("#oaSummaryRejected").textContent = String(rejected.length);
    $("#oaSummaryReviewed").textContent = String(approved.length + rejected.length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#oaPagination");
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

    $("#oaEmptyState").hidden = all.length !== 0;
    $("#oaTable").hidden = all.length === 0;

    $("#oaTableBody").innerHTML = pageItems.map((so) => {
      const cust = so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(so.status)}">${so.status}</span>`;
      const { total, pricedCount, totalCount } = ERP_SalesOrderRepository.computeGrandTotal(so);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);
      const submittedOn = so.submittedAt ? formatDateTime(new Date(so.submittedAt)) : `<span class="profile-subtle">—</span>`;
      const quickActionHtml = so.status === "Submitted"
        ? `<button type="button" class="link-btn" data-action="review" data-id="${so.id}">Review</button>`
        : "";

      return `
      <tr>
        <td><code>${escapeHtml(so.salesOrderCode)}</code></td>
        <td>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${totalCount}</td>
        <td>${totalLabel}</td>
        <td>${submittedOn}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${so.id}">View</button>
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
    $$("#oaStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#oaStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#oaSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#oaSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#oaExportCsvBtn").addEventListener("click", exportCsv);
    $("#oaPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Sales Order Code", "Customer", "Line Items", "Total", "Submitted On", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((so) => {
      const cust = so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
      const { total, totalCount } = ERP_SalesOrderRepository.computeGrandTotal(so);
      const line = [
        so.salesOrderCode, cust ? cust.customerName : "", totalCount,
        total, so.submittedAt || "", so.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-order-approvals-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Sales orders exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((so) => {
      const cust = so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
      const { total, totalCount } = ERP_SalesOrderRepository.computeGrandTotal(so);
      return `<tr><td>${escapeHtml(so.salesOrderCode)}</td><td>${cust ? escapeHtml(cust.customerName) : ""}</td><td>${totalCount}</td><td>${escapeHtml(formatCurrency(total))}</td><td>${escapeHtml(so.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Order Approval Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Order Approval Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Sales Order Code</th><th>Customer</th><th>Lines</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast('Opened the print dialog — choose "Save as PDF" to export.', "info", { title: "Export PDF" });
  }


  /* -----------------------------------------------------------------------
     RECENT CHANGES — shares the "Sales Order" activity module name with
     Module 3, so approvals/rejections show up in BOTH pages' feeds
     (they're both actions on the same underlying record).
     --------------------------------------------------------------------- */
  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Sales Order" && (e.action === "Approve" || e.action === "Reject"))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#oaActivityEmptyState").hidden = relevant.length !== 0;
    $("#oaActivityList").innerHTML = relevant.map((e) => `
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
  function requestApprove(so) {
    openConfirm({
      title: "Approve this sales order?",
      message: `"${so.salesOrderCode}" will be approved and become available for delivery to be built from.`,
      confirmLabel: "Approve",
      onConfirm: () => {
        ERP_SalesOrderRepository.approve(so.id, session.username);
        logSystemActivity({ module: "Sales Order", action: "Approve", description: `Approved sales order "${so.salesOrderCode}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === so.id) openDetailModal(ERP_SalesOrderRepository.findById(so.id));
        showToast(`"${so.salesOrderCode}" approved.`, "success");
      }
    });
  }

  function requestReject(so) {
    rejectingId = so.id;
    $("#oaRejectReason").value = "";
    $("#oaRejectReasonError").textContent = "";
    openModal("oaRejectModal");
  }

  function bindRejectModal() {
    $("#oaRejectConfirmBtn").addEventListener("click", () => {
      const reason = $("#oaRejectReason").value.trim();
      if (!reason) { $("#oaRejectReasonError").textContent = "A reason is required so the requester knows what to fix."; return; }
      const so = ERP_SalesOrderRepository.findById(rejectingId);
      if (!so) { closeModal("oaRejectModal"); return; }
      ERP_SalesOrderRepository.reject(so.id, session.username, reason);
      logSystemActivity({ module: "Sales Order", action: "Reject", description: `Rejected sales order "${so.salesOrderCode}" for ${company.name}: ${reason}`, severity: "warning" });
      closeModal("oaRejectModal");
      renderAll();
      renderActivity();
      if (detailId === so.id) openDetailModal(ERP_SalesOrderRepository.findById(so.id));
      showToast(`"${so.salesOrderCode}" rejected.`, "info");
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL (read-only)
     --------------------------------------------------------------------- */
  function renderLineItemsReadOnly(so) {
    const lines = so.lineItems || [];
    $("#oaLineEmptyState").hidden = lines.length !== 0;
    $("#oaLineTable").hidden = lines.length === 0;

    $("#oaLineTableBody").innerHTML = lines.map((line) => {
      const tax = line.taxId && typeof ERP_TaxRepository !== "undefined" ? ERP_TaxRepository.findById(line.taxId) : null;
      const lineTotal = ERP_SalesOrderRepository.computeLineTotal(line);
      const lineTax = ERP_SalesOrderRepository.computeLineTax(line);
      const priceLabel = line.unitPrice != null ? escapeHtml(formatCurrency(line.unitPrice)) : `<span class="profile-subtle">—</span>`;
      const taxLabel = tax ? `${escapeHtml(tax.taxName)} (${tax.ratePct}%)` : `<span class="profile-subtle">—</span>`;
      const totalLabel = lineTotal != null ? escapeHtml(formatCurrency(lineTotal + (lineTax || 0))) : `<span class="profile-subtle">—</span>`;
      return `<tr><td>${escapeHtml(line.lineDescription || "—")}</td><td>${escapeHtml(String(line.quantity))}</td><td>${priceLabel}</td><td>${taxLabel}</td><td>${totalLabel}</td></tr>`;
    }).join("");

    const { subtotal, taxTotal, total, totalCount } = ERP_SalesOrderRepository.computeGrandTotal(so);
    $("#oaGrandTotalLine").textContent = totalCount === 0
      ? ""
      : `Subtotal: ${formatCurrency(subtotal)} + Tax: ${formatCurrency(taxTotal)} = Total: ${formatCurrency(total)}`;
  }

  function renderDetailFooter(so) {
    const footer = $("#oaDetailFooter");
    footer.innerHTML = "";
    if (so.status !== "Submitted") return;
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Reject", "btn btn--danger-outline", () => requestReject(so));
    addBtn("Approve", "btn btn--primary", () => requestApprove(so));
  }

  function openDetailModal(so) {
    detailId = so.id;
    const cust = so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
    const quotation = so.quotationId ? ERP_SalesQuotationRepository.findById(so.quotationId) : null;

    $("#oaDetailTitle").textContent = `${so.salesOrderCode} · ${so.status}`;

    const rows = [];
    rows.push(`<div><dt>Sales Order Code</dt><dd><code>${escapeHtml(so.salesOrderCode)}</code></dd></div>`);
    rows.push(`<div><dt>Customer</dt><dd>${cust ? escapeHtml(cust.customerName) + " (" + escapeHtml(cust.customerCode) + ")" : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>From Quotation</dt><dd>${quotation ? `<code>${escapeHtml(quotation.quotationCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    if (cust) {
      const band = ERP_CustomerRepository.getCreditUtilizationBand(cust);
      const { utilizationPct, available } = ERP_CustomerRepository.getCreditUsage(cust);
      const pctLabel = isFinite(utilizationPct) ? `${utilizationPct.toFixed(0)}%` : "over limit";
      const creditBadgeClass = band === "over" ? "danger" : band === "near" ? "warning" : "success";
      rows.push(`<div><dt>Customer Credit</dt><dd><span class="status-badge status-badge--${creditBadgeClass}">${pctLabel} utilized</span> ${formatCurrency(available)} available</dd></div>`);
    }
    rows.push(`<div><dt>Delivery Date</dt><dd>${so.deliveryDate ? escapeHtml(so.deliveryDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(so.status)}">${so.status}</span></dd></div>`);
    if (so.submittedAt) rows.push(`<div><dt>Submitted</dt><dd>${formatDateTime(new Date(so.submittedAt))} by ${escapeHtml(ERP_SalesOrderRepository.actorLabel(so.submittedByUsername))}</dd></div>`);
    if (so.status === "Approved" && so.approvedAt) rows.push(`<div><dt>Approved</dt><dd>${formatDateTime(new Date(so.approvedAt))} by ${escapeHtml(ERP_SalesOrderRepository.actorLabel(so.approvedByUsername))}</dd></div>`);
    if (so.status === "Rejected" && so.rejectedAt) {
      rows.push(`<div><dt>Rejected</dt><dd>${formatDateTime(new Date(so.rejectedAt))} by ${escapeHtml(ERP_SalesOrderRepository.actorLabel(so.rejectedByUsername))}</dd></div>`);
      rows.push(`<div><dt>Rejection Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(so.rejectionReason || "—")}</dd></div>`);
    }
    if (so.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(so.notes)}</dd></div>`);

    $("#oaDetailBody").innerHTML = rows.join("");
    renderLineItemsReadOnly(so);
    renderDetailFooter(so);
    openModal("oaDetailModal");
  }

  function bindDetailModal() {
    $("#oaTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const so = ERP_SalesOrderRepository.findById(viewBtn.dataset.id);
        if (so) openDetailModal(so);
        return;
      }
      if (actionBtn) {
        const so = ERP_SalesOrderRepository.findById(actionBtn.dataset.id);
        if (so) openDetailModal(so);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "order-approval")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading approval queue…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#oaContent").hidden = true;
      $("#oaSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#oaContent").hidden = false;
      $("#oaHeaderActions").hidden = false;
      $("#oaSubtitle").textContent = `Reviewing sales orders for ${company.name} (${company.companyCode}).`;

      if (!APPROVER_ROLES.includes(session.role)) {
        $("#oaRoleHint").textContent = `You're signed in as ${session.fullName} (${session.role}). In a real company, order approval is usually restricted to a Purchase & Sales Manager or System Administrator — this screen shows that as a reminder rather than a hard block, so you can still review and decide below.`;
        $("#oaRoleHint").hidden = false;
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
