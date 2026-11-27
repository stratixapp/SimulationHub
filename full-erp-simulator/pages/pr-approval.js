/* =============================================================================
   DOT ERP — pages/pr-approval.js
   Phase 4, Module 3: PR Approval

   The first module in the codebase with NO data file of its own — it
   reads and writes `ERP_PurchaseRequisitionRepository` (data/pr-data.js)
   exclusively, calling the `approve()`/`reject()` methods Module 2 built
   but deliberately never wired to a button. See pr-data.js's header for
   why that split exists.

   WHY THIS PAGE HAS NO ANCHOR EMPTY STATE.
   Every prior workflow module needed something to exist before its Add
   flow made sense (Department Need needed a Department + Employee;
   Purchase Requisition needed an Employee). This module never creates
   anything — it only reviews requisitions Module 2 already created — so
   the only prerequisite is an active company. No `#noAnchorState` here.

   THE FIRST LIST WHOSE DEFAULT FILTER ISN'T "ALL."
   Every other module's status chips defaulted to "All." This page's
   entire purpose is an approval QUEUE, so it defaults to "Awaiting
   Approval" (Submitted) instead — seeing everything is one click away
   via the "All" chip, but the useful, actionable view is the default.

   ROLE REALISM, MADE CONCRETE.
   Department Need's and Purchase Requisition's headers both flagged that
   real procurement approval is normally role-restricted, and both
   deliberately left it unenforced pending a module that actually needed
   to decide. This is that module: `praRoleHint` shows a soft, non-
   blocking note if the signed-in session's role doesn't look like an
   approver role ("Purchase & Sales Manager" or "System Administrator") —
   informational only, same as `actorLabel()` already was, never a hard
   block on the Approve/Reject buttons. A trainee logged in as, say,
   "Auditor (Read-Only)" can still approve things (this is a training
   simulator, not a live approvals system), but sees a reminder of how it
   would really work.

   DETAIL MODAL IS READ-ONLY.
   Reuses Purchase Requisition's header + line-items Detail modal shape,
   but strips every edit affordance — no Edit Header, no Add/Edit/Remove
   Line — since reviewing, not building, is this module's whole job. The
   footer only ever offers Approve/Reject (Submitted) or nothing (every
   other status, since this module doesn't own Withdraw/Cancel/Delete
   either — those stay with Purchase Requisition's own page).
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
    let rows = ERP_PurchaseRequisitionRepository.getAllForCompany(company.id)
      .filter((p) => p.status === "Submitted" || p.status === "Approved" || p.status === "Rejected");

    if (filterStatus !== "all") rows = rows.filter((p) => p.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((p) => {
        const emp = ERP_EmployeeRepository.findById(p.raisedByEmployeeId);
        return p.prCode.toLowerCase().includes(term) || (emp && emp.fullName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_PurchaseRequisitionRepository.getAllForCompany(company.id);
    const pending = all.filter((p) => p.status === "Submitted");
    const approved = all.filter((p) => p.status === "Approved");
    const rejected = all.filter((p) => p.status === "Rejected");
    $("#praSummaryPending").textContent = String(pending.length);
    $("#praSummaryApproved").textContent = String(approved.length);
    $("#praSummaryRejected").textContent = String(rejected.length);
    $("#praSummaryReviewed").textContent = String(approved.length + rejected.length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#praPagination");
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

    $("#praEmptyState").hidden = all.length !== 0;
    $("#praTable").hidden = all.length === 0;

    $("#praTableBody").innerHTML = pageItems.map((p) => {
      const emp = ERP_EmployeeRepository.findById(p.raisedByEmployeeId);
      const vendor = p.preferredVendorId ? ERP_VendorRepository.findById(p.preferredVendorId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(p.status)}">${p.status}</span>`;
      const { total, pricedCount, totalCount } = ERP_PurchaseRequisitionRepository.computeGrandTotal(p);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);
      const submittedOn = p.submittedAt ? formatDateTime(new Date(p.submittedAt)) : `<span class="profile-subtle">—</span>`;
      const quickActionHtml = p.status === "Submitted"
        ? `<button type="button" class="link-btn" data-action="review" data-id="${p.id}">Review</button>`
        : "";

      return `
      <tr>
        <td><code>${escapeHtml(p.prCode)}</code></td>
        <td>${emp ? escapeHtml(emp.fullName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Not set</span>`}</td>
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
    $$("#praStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#praStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#praSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#praSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#praExportCsvBtn").addEventListener("click", exportCsv);
    $("#praPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["PR Code", "Raised By", "Preferred Vendor", "Line Items", "Est. Total", "Submitted On", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((p) => {
      const emp = ERP_EmployeeRepository.findById(p.raisedByEmployeeId);
      const vendor = p.preferredVendorId ? ERP_VendorRepository.findById(p.preferredVendorId) : null;
      const { total, totalCount } = ERP_PurchaseRequisitionRepository.computeGrandTotal(p);
      const line = [
        p.prCode, emp ? emp.fullName : "", vendor ? vendor.vendorName : "", totalCount,
        total, p.submittedAt || "", p.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-pr-approvals-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Requisitions exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((p) => {
      const emp = ERP_EmployeeRepository.findById(p.raisedByEmployeeId);
      const { total, totalCount } = ERP_PurchaseRequisitionRepository.computeGrandTotal(p);
      return `<tr><td>${escapeHtml(p.prCode)}</td><td>${emp ? escapeHtml(emp.fullName) : ""}</td><td>${totalCount}</td><td>${escapeHtml(formatCurrency(total))}</td><td>${escapeHtml(p.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - PR Approval Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — PR Approval Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>PR Code</th><th>Raised By</th><th>Lines</th><th>Est. Total</th><th>Status</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast('Opened the print dialog — choose "Save as PDF" to export.', "info", { title: "Export PDF" });
  }


  /* -----------------------------------------------------------------------
     RECENT CHANGES — shares the "Purchase Requisition" activity module
     name with Module 2, so approvals/rejections show up in BOTH pages'
     feeds (they're both actions on the same underlying record).
     --------------------------------------------------------------------- */
  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Purchase Requisition" && (e.action === "Approve" || e.action === "Reject"))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#praActivityEmptyState").hidden = relevant.length !== 0;
    $("#praActivityList").innerHTML = relevant.map((e) => `
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
  function requestApprove(pr) {
    openConfirm({
      title: "Approve this requisition?",
      message: `"${pr.prCode}" will be approved and become available for a Purchase Order to be built from.`,
      confirmLabel: "Approve",
      onConfirm: () => {
        ERP_PurchaseRequisitionRepository.approve(pr.id, session.username);
        logSystemActivity({ module: "Purchase Requisition", action: "Approve", description: `Approved requisition "${pr.prCode}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === pr.id) openDetailModal(ERP_PurchaseRequisitionRepository.findById(pr.id));
        showToast(`"${pr.prCode}" approved.`, "success");
      }
    });
  }

  function requestReject(pr) {
    rejectingId = pr.id;
    $("#praRejectReason").value = "";
    $("#praRejectReasonError").textContent = "";
    openModal("praRejectModal");
  }

  function bindRejectModal() {
    $("#praRejectConfirmBtn").addEventListener("click", () => {
      const reason = $("#praRejectReason").value.trim();
      if (!reason) { $("#praRejectReasonError").textContent = "A reason is required so the requester knows what to fix."; return; }
      const pr = ERP_PurchaseRequisitionRepository.findById(rejectingId);
      if (!pr) { closeModal("praRejectModal"); return; }
      ERP_PurchaseRequisitionRepository.reject(pr.id, session.username, reason);
      logSystemActivity({ module: "Purchase Requisition", action: "Reject", description: `Rejected requisition "${pr.prCode}" for ${company.name}: ${reason}`, severity: "warning" });
      closeModal("praRejectModal");
      renderAll();
      renderActivity();
      if (detailId === pr.id) openDetailModal(ERP_PurchaseRequisitionRepository.findById(pr.id));
      showToast(`"${pr.prCode}" rejected.`, "info");
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL (read-only)
     --------------------------------------------------------------------- */
  function renderLineItemsReadOnly(pr) {
    const lines = pr.lineItems || [];
    $("#praLineEmptyState").hidden = lines.length !== 0;
    $("#praLineTable").hidden = lines.length === 0;

    $("#praLineTableBody").innerHTML = lines.map((line) => {
      const item = line.itemId ? ERP_ItemRepository.findById(line.itemId) : null;
      const need = line.departmentNeedId ? ERP_DepartmentNeedRepository.findById(line.departmentNeedId) : null;
      const total = ERP_PurchaseRequisitionRepository.computeLineTotal(line);
      const label = item ? `${escapeHtml(item.itemName)}${line.lineDescription ? " — " + escapeHtml(line.lineDescription) : ""}` : escapeHtml(line.lineDescription || "—");
      const needLabel = need ? `<code>${escapeHtml(need.needCode)}</code>` : `<span class="profile-subtle">—</span>`;
      const priceLabel = line.estimatedUnitPrice != null ? escapeHtml(formatCurrency(line.estimatedUnitPrice)) : `<span class="profile-subtle">—</span>`;
      const totalLabel = total != null ? escapeHtml(formatCurrency(total)) : `<span class="profile-subtle">—</span>`;
      return `<tr><td>${label}</td><td>${needLabel}</td><td>${escapeHtml(String(line.quantity))}</td><td>${priceLabel}</td><td>${totalLabel}</td></tr>`;
    }).join("");

    const { total, pricedCount, totalCount } = ERP_PurchaseRequisitionRepository.computeGrandTotal(pr);
    if (totalCount === 0) {
      $("#praGrandTotalLine").textContent = "";
    } else if (pricedCount === totalCount) {
      $("#praGrandTotalLine").textContent = `Estimated total: ${formatCurrency(total)}`;
    } else {
      $("#praGrandTotalLine").textContent = `Estimated total: ~${formatCurrency(total)} (${pricedCount} of ${totalCount} lines priced)`;
    }
  }

  function renderDetailFooter(pr) {
    const footer = $("#praDetailFooter");
    footer.innerHTML = "";
    if (pr.status !== "Submitted") return;
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Reject", "btn btn--danger-outline", () => requestReject(pr));
    addBtn("Approve", "btn btn--primary", () => requestApprove(pr));
  }

  function openDetailModal(pr) {
    detailId = pr.id;
    const emp = ERP_EmployeeRepository.findById(pr.raisedByEmployeeId);
    const vendor = pr.preferredVendorId ? ERP_VendorRepository.findById(pr.preferredVendorId) : null;

    $("#praDetailTitle").textContent = `${pr.prCode} · ${pr.status}`;

    const rows = [];
    rows.push(`<div><dt>PR Code</dt><dd><code>${escapeHtml(pr.prCode)}</code></dd></div>`);
    rows.push(`<div><dt>Raised By</dt><dd>${emp ? escapeHtml(emp.fullName) + " (" + escapeHtml(emp.employeeCode) + ")" : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Preferred Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Required By</dt><dd>${pr.requiredByDate ? escapeHtml(pr.requiredByDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(pr.status)}">${pr.status}</span></dd></div>`);
    if (pr.submittedAt) rows.push(`<div><dt>Submitted</dt><dd>${formatDateTime(new Date(pr.submittedAt))} by ${escapeHtml(ERP_PurchaseRequisitionRepository.actorLabel(pr.submittedByUsername))}</dd></div>`);
    if (pr.status === "Approved" && pr.approvedAt) rows.push(`<div><dt>Approved</dt><dd>${formatDateTime(new Date(pr.approvedAt))} by ${escapeHtml(ERP_PurchaseRequisitionRepository.actorLabel(pr.approvedByUsername))}</dd></div>`);
    if (pr.status === "Rejected" && pr.rejectedAt) {
      rows.push(`<div><dt>Rejected</dt><dd>${formatDateTime(new Date(pr.rejectedAt))} by ${escapeHtml(ERP_PurchaseRequisitionRepository.actorLabel(pr.rejectedByUsername))}</dd></div>`);
      rows.push(`<div><dt>Rejection Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(pr.rejectionReason || "—")}</dd></div>`);
    }
    if (pr.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(pr.notes)}</dd></div>`);

    $("#praDetailBody").innerHTML = rows.join("");
    renderLineItemsReadOnly(pr);
    renderDetailFooter(pr);
    openModal("praDetailModal");
  }

  function bindDetailModal() {
    $("#praTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const p = ERP_PurchaseRequisitionRepository.findById(viewBtn.dataset.id);
        if (p) openDetailModal(p);
        return;
      }
      if (actionBtn) {
        const p = ERP_PurchaseRequisitionRepository.findById(actionBtn.dataset.id);
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
    if (!window.ERP.enforcePageAccess(session, "pr-approval")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading approval queue…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#praContent").hidden = true;
      $("#praSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#praContent").hidden = false;
      $("#praHeaderActions").hidden = false;
      $("#praSubtitle").textContent = `Reviewing purchase requisitions for ${company.name} (${company.companyCode}).`;

      if (!APPROVER_ROLES.includes(session.role)) {
        $("#praRoleHint").textContent = `You're signed in as ${session.fullName} (${session.role}). In a real company, PR approval is usually restricted to a Purchase & Sales Manager or System Administrator — this screen shows that as a reminder rather than a hard block, so you can still review and decide below.`;
        $("#praRoleHint").hidden = false;
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
