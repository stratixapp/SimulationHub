/* =============================================================================
   DOT ERP — pages/vendor-selection.js
   Phase 4, Module 5: Vendor Selection

   Reads and writes ERP_RfqRepository (data/rfq-data.js) exclusively — see
   its header for why vendorDecisions lives on the RFQ record rather than
   a new data file. This is the SECOND module (after PR Approval) with no
   data file of its own, reinforcing the "one repository, multiple pages"
   shape rather than it being a one-off.

   DECISIONS SAVE IMMEDIATELY, NOT VIA A FORM.
   Every other module's Detail modal either shows read-only info or hands
   off to a proper Add/Edit form. This one is different on purpose: each
   invited-vendor row has its own Select/Not Selected buttons that call
   recordVendorDecision() the moment they're clicked, optionally reading a
   note typed in that same row. There's no "Save" button for the whole
   modal — these are meant to feel like quick, individually-reversible
   working decisions (see rfq-data.js's header), not a single form
   submission the way a header or line item is.

   SCOPE: ONLY SENT/CLOSED RFQs. A Draft RFQ has invited nobody yet
   (there's nothing to decide on) and a Cancelled one is moot — this page
   filters to Sent/Closed from the start rather than offering status chips
   for statuses that would always be empty here.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, requireSession, runBootSequence,
    logSystemActivity
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let filterMode = "all"; // all | awaiting | decided
  let sortOrder = "desc";
  let searchTerm = "";
  let page = 1;
  let detailId = null;


  /** invited / decided / selected / dropped counts for one RFQ. */
  function getDecisionStats(rfq) {
    const decisions = rfq.vendorDecisions || {};
    const invited = rfq.invitedVendorIds || [];
    let decided = 0, selected = 0, dropped = 0;
    invited.forEach((id) => {
      const d = decisions[id];
      if (d) {
        decided++;
        if (d.selected) selected++; else dropped++;
      }
    });
    return { invited: invited.length, decided, selected, dropped };
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getInScopeRfqs() {
    return ERP_RfqRepository.getAllForCompany(company.id)
      .filter((r) => r.status === "Sent" || r.status === "Closed");
  }

  function getFilteredSorted() {
    let rows = getInScopeRfqs();

    if (filterMode !== "all") {
      rows = rows.filter((r) => {
        const stats = getDecisionStats(r);
        return filterMode === "awaiting" ? stats.decided < stats.invited : stats.decided === stats.invited && stats.invited > 0;
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
    const all = getInScopeRfqs();
    let awaiting = 0, decided = 0, totalSelected = 0, totalDropped = 0;
    all.forEach((r) => {
      const stats = getDecisionStats(r);
      if (stats.decided < stats.invited) awaiting++;
      else if (stats.invited > 0) decided++;
      totalSelected += stats.selected;
      totalDropped += stats.dropped;
    });
    $("#vsSummaryAwaiting").textContent = String(awaiting);
    $("#vsSummaryDecided").textContent = String(decided);
    $("#vsSummarySelected").textContent = String(totalSelected);
    $("#vsSummaryDropped").textContent = String(totalDropped);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#vsPagination");
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

    $("#vsEmptyState").hidden = all.length !== 0;
    $("#vsTable").hidden = all.length === 0;

    $("#vsTableBody").innerHTML = pageItems.map((r) => {
      const pr = ERP_PurchaseRequisitionRepository.findById(r.linkedPrId);
      const stats = getDecisionStats(r);
      const statusBadge = `<span class="status-badge status-badge--${r.status === "Closed" ? "success" : "warning"}">${r.status}</span>`;
      const quickActionHtml = stats.decided < stats.invited
        ? `<button type="button" class="link-btn" data-action="decide" data-id="${r.id}">Decide</button>`
        : "";

      return `
      <tr>
        <td><code>${escapeHtml(r.rfqCode)}</code></td>
        <td>${pr ? `<code>${escapeHtml(pr.prCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${stats.invited}</td>
        <td>${stats.decided} of ${stats.invited}</td>
        <td>${stats.selected}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${r.id}">View</button>
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
    $$("#vsFilterChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#vsFilterChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterMode = chip.dataset.filter;
        page = 1;
        renderTable();
      });
    });

    $("#vsSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#vsSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#vsExportCsvBtn").addEventListener("click", exportCsv);
    $("#vsPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["RFQ Code", "Linked PR", "Invited", "Decided", "Selected", "Not Selected", "RFQ Status"];
    const csvRows = [header.join(",")];
    rows.forEach((r) => {
      const pr = ERP_PurchaseRequisitionRepository.findById(r.linkedPrId);
      const stats = getDecisionStats(r);
      const line = [r.rfqCode, pr ? pr.prCode : "", stats.invited, stats.decided, stats.selected, stats.dropped, r.status]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-vendor-selection-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Vendor selection exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((r) => {
      const pr = ERP_PurchaseRequisitionRepository.findById(r.linkedPrId);
      const stats = getDecisionStats(r);
      return `<tr><td>${escapeHtml(r.rfqCode)}</td><td>${pr ? escapeHtml(pr.prCode) : ""}</td><td>${stats.decided} of ${stats.invited}</td><td>${stats.selected}</td><td>${escapeHtml(r.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Vendor Selection Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Vendor Selection Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>RFQ Code</th><th>Linked PR</th><th>Decided</th><th>Selected</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Vendor Selection")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#vsActivityEmptyState").hidden = relevant.length !== 0;
    $("#vsActivityList").innerHTML = relevant.map((e) => `
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
     DETAIL MODAL — decisions save immediately, see file header.
     --------------------------------------------------------------------- */
  function renderVendorRows(rfq) {
    const decisions = rfq.vendorDecisions || {};
    $("#vsVendorTableBody").innerHTML = (rfq.invitedVendorIds || []).map((vendorId) => {
      const vendor = ERP_VendorRepository.findById(vendorId);
      const decision = decisions[vendorId];
      let badge;
      if (!decision) badge = `<span class="status-badge status-badge--neutral">Undecided</span>`;
      else if (decision.selected) badge = `<span class="status-badge status-badge--success">Selected</span>`;
      else badge = `<span class="status-badge status-badge--danger">Not Selected</span>`;

      return `
      <tr>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${badge}</td>
        <td><div class="input-wrap"><input type="text" class="vs-note-input" data-vendor="${vendorId}" value="${escapeHtml(decision ? decision.note : "")}" placeholder="Optional note" maxlength="140" /></div></td>
        <td>
          <button type="button" class="link-btn" data-decide="select" data-vendor="${vendorId}">Select</button>
          <button type="button" class="link-btn" data-decide="drop" data-vendor="${vendorId}">Not Selected</button>
        </td>
      </tr>`;
    }).join("");
  }

  function openDetailModal(rfq) {
    detailId = rfq.id;
    const pr = ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId);

    $("#vsDetailTitle").textContent = `${rfq.rfqCode} · Select Vendors`;

    const rows = [];
    rows.push(`<div><dt>RFQ Code</dt><dd><code>${escapeHtml(rfq.rfqCode)}</code></dd></div>`);
    rows.push(`<div><dt>Linked Requisition</dt><dd>${pr ? `<code>${escapeHtml(pr.prCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Due Date</dt><dd>${escapeHtml(rfq.dueDate || "—")}</dd></div>`);
    rows.push(`<div><dt>RFQ Status</dt><dd><span class="status-badge status-badge--${rfq.status === "Closed" ? "success" : "warning"}">${rfq.status}</span></dd></div>`);
    $("#vsDetailBody").innerHTML = rows.join("");

    renderVendorRows(rfq);
    openModal("vsDetailModal");
  }

  function bindDetailModal() {
    $("#vsTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const r = ERP_RfqRepository.findById(viewBtn.dataset.id);
        if (r) openDetailModal(r);
        return;
      }
      if (actionBtn) {
        const r = ERP_RfqRepository.findById(actionBtn.dataset.id);
        if (r) openDetailModal(r);
      }
    });

    $("#vsVendorTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-decide]");
      if (!btn) return;

      // PHASE 11 RBAC — this is the one module-specific exception named in
      // data/rbac-data.js's own header: a decision here saves immediately
      // on click, with no openConfirm()/openModal() in between (the same
      // "quick, individually-reversible working decision" shape this
      // module established back in Phase 4), so it can't be reached by
      // the shared runtime's own centralized Viewer lockdown and needs
      // this one direct check instead.
      if (typeof ERP_RbacRepository !== "undefined" && ERP_RbacRepository.isViewer(session.role)) {
        showToast("The read-only role can browse and run reports, but can't save, post, approve or delete anything.", "warning", { title: "Read-only role" });
        return;
      }

      const vendorId = btn.dataset.vendor;
      const selected = btn.dataset.decide === "select";
      const noteInput = $(`.vs-note-input[data-vendor="${vendorId}"]`);
      const note = noteInput ? noteInput.value.trim() : "";
      const vendor = ERP_VendorRepository.findById(vendorId);

      ERP_RfqRepository.recordVendorDecision(detailId, vendorId, selected, note, session.username);
      logSystemActivity({
        module: "Vendor Selection",
        action: selected ? "Select Vendor" : "Drop Vendor",
        description: `${selected ? "Selected" : "Did not select"} ${vendor ? vendor.vendorName : "a vendor"} on RFQ (${company.name})`
      });

      renderAll();
      renderActivity();
      const refreshed = ERP_RfqRepository.findById(detailId);
      if (refreshed) { renderVendorRows(refreshed); }
      showToast(`${vendor ? vendor.vendorName : "Vendor"} marked ${selected ? "Selected" : "Not Selected"}.`, "success");
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "vendor-selection")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading sent RFQs…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#vsContent").hidden = true;
      $("#vsSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#vsContent").hidden = false;
      $("#vsHeaderActions").hidden = false;
      $("#vsSubtitle").textContent = `Deciding invited vendors for ${company.name} (${company.companyCode}).`;

      renderAll();
      renderActivity();
      bindToolbar();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
