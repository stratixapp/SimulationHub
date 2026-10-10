/* =============================================================================
   DOT ERP — pages/sales-close.js
   Phase 5, Module 10: Sales Close — THE FINAL MODULE OF THE PHASE AND
   THE PROJECT AS ORIGINALLY SCOPED

   See data/sales-close-data.js's header for the full design rationale
   (built from the Sales Order itself, not any downstream artifact; why
   `computeCompletionChecklist()` BRANCHES past Tax Invoice instead of
   continuing Purchase Closure's own linear relay; why closing is never
   gated on the checklist). UI-layer decisions on top of that:

   - THE CHECKLIST TABLE RENDERS IN BOTH THE FORM AND THE DETAIL VIEW,
     always computed fresh, never stored — the same "pure computation,
     recomputed on every read" shape Three-Way Matching's own
     `computeMatchLines()` established, carried through Purchase
     Closure's own checklist and reused here unchanged. Status badges:
     Complete (success), In Progress (warning), Not Started (neutral) —
     a plain, scannable visual summary of this sale's entire journey.
   - NO REOPEN FROM CLOSED — the detail footer offers nothing once a
     closure reaches Closed, matching the data file's own deliberate
     omission of a reopen() transition from that state.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let filterStatus = "all";
  let sortOrder = "desc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;


  function statusBadgeClass(status) {
    if (status === "Closed") return "success";
    if (status === "Cancelled") return "neutral";
    return "warning"; // Draft
  }

  function checklistBadgeClass(stageStatus) {
    if (stageStatus === "Complete") return "success";
    if (stageStatus === "In Progress") return "warning";
    return "neutral"; // Not Started
  }

  function quickActionFor(c) {
    if (c.status === "Draft") return { action: "close", label: "Close" };
    return null;
  }

  function completionSummary(checklist) {
    const complete = checklist.filter((s) => s.status === "Complete").length;
    return `${complete}/${checklist.length}`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_SalesCloseRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((c) => c.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((c) => {
        const so = c.linkedSalesOrderId ? ERP_SalesOrderRepository.findById(c.linkedSalesOrderId) : null;
        const customer = so && so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
        return c.closureCode.toLowerCase().includes(term) ||
          (so && so.salesOrderCode.toLowerCase().includes(term)) ||
          (customer && customer.customerName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_SalesCloseRepository.getAllForCompany(company.id);
    $("#scSummaryTotal").textContent = String(all.length);
    $("#scSummaryDraft").textContent = String(all.filter((c) => c.status === "Draft").length);
    $("#scSummaryClosed").textContent = String(all.filter((c) => c.status === "Closed").length);
    $("#scSummaryCancelled").textContent = String(all.filter((c) => c.status === "Cancelled").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#scPagination");
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

    $("#scEmptyState").hidden = all.length !== 0;
    $("#scTable").hidden = all.length === 0;

    $("#scTableBody").innerHTML = pageItems.map((c) => {
      const so = c.linkedSalesOrderId ? ERP_SalesOrderRepository.findById(c.linkedSalesOrderId) : null;
      const customer = so && so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(c.status)}">${c.status}</span>`;
      const checklist = ERP_SalesCloseRepository.computeCompletionChecklist(company.id, so);
      const qa = quickActionFor(c);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${c.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(c.closureCode)}</code></td>
        <td>${so ? `<code>${escapeHtml(so.salesOrderCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${customer ? escapeHtml(customer.customerName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${completionSummary(checklist)}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${c.id}">View</button>
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
    $$("#scStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#scStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#scSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#scSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#scExportCsvBtn").addEventListener("click", exportCsv);
    $("#scPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Closure Code", "Sales Order Code", "Customer", "Completion", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((c) => {
      const so = c.linkedSalesOrderId ? ERP_SalesOrderRepository.findById(c.linkedSalesOrderId) : null;
      const customer = so && so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
      const checklist = ERP_SalesCloseRepository.computeCompletionChecklist(company.id, so);
      const line = [
        c.closureCode, so ? so.salesOrderCode : "", customer ? customer.customerName : "", completionSummary(checklist), c.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-sales-closures-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Sales closures exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((c) => {
      const so = c.linkedSalesOrderId ? ERP_SalesOrderRepository.findById(c.linkedSalesOrderId) : null;
      const checklist = ERP_SalesCloseRepository.computeCompletionChecklist(company.id, so);
      return `<tr><td>${escapeHtml(c.closureCode)}</td><td>${so ? escapeHtml(so.salesOrderCode) : ""}</td><td>${completionSummary(checklist)}</td><td>${escapeHtml(c.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Sales Close Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Sales Close Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Closure Code</th><th>Sales Order</th><th>Completion</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Sales Close")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#scActivityEmptyState").hidden = relevant.length !== 0;
    $("#scActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#scFormModal)
     --------------------------------------------------------------------- */
  function populateSalesOrderOptions(currentId) {
    let sos = ERP_SalesCloseRepository.getAvailableSalesOrdersForCompany(company.id, editingId);
    if (currentId && !sos.some((p) => p.id === currentId)) {
      const current = ERP_SalesOrderRepository.findById(currentId);
      if (current) sos = sos.concat([current]);
    }
    $("#scFormSalesOrder").innerHTML = sos.map((so) => {
      const customer = ERP_CustomerRepository.findById(so.customerId);
      const label = `${so.salesOrderCode} — ${customer ? customer.customerName : "Unknown customer"} (${so.status})`;
      return `<option value="${so.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderSalesOrderInfo(so) {
    const box = $("#scFormSalesOrderInfo");
    if (!so) { box.textContent = ""; return; }
    const customer = ERP_CustomerRepository.findById(so.customerId);
    box.textContent = `Customer: ${customer ? customer.customerName : "Removed"} — sales order status: ${so.status}.`;
  }

  function renderChecklistTable(targetBodyId, so) {
    const checklist = ERP_SalesCloseRepository.computeCompletionChecklist(company.id, so);
    $("#" + targetBodyId).innerHTML = checklist.map((stage) => {
      const optionalTag = stage.optional ? ` <span class="profile-subtle">(optional)</span>` : "";
      return `<tr><td>${escapeHtml(stage.label)}${optionalTag}</td><td><span class="status-badge status-badge--${checklistBadgeClass(stage.status)}">${escapeHtml(stage.status)}</span></td></tr>`;
    }).join("");
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("scFormSalesOrder", ""); }

  function openAddModal() {
    const available = ERP_SalesCloseRepository.getAvailableSalesOrdersForCompany(company.id, null);
    if (!available.length) {
      showToast("No sales orders are currently available to close. A closure can only be created once a sales order exists and isn't already claimed by another closure.", "warning");
      return;
    }
    editingId = null;
    $("#scFormTitle").textContent = "New sales close";
    $("#scFormIntro").textContent = "Pick the sales order to close out — the completion checklist below is informational only.";
    $("#scFormSaveBtn").textContent = "Create Closure";
    populateSalesOrderOptions(null);
    const firstSo = ERP_SalesOrderRepository.findById($("#scFormSalesOrder").value);
    renderSalesOrderInfo(firstSo);
    renderChecklistTable("scFormLineTableBody", firstSo);
    $("#scFormNotes").value = "";
    clearFormErrors();
    openModal("scFormModal");
  }

  function openEditModal(c) {
    if (!ERP_SalesCloseRepository.canEdit(c)) {
      showToast(`"${c.closureCode}" is ${c.status} and can't be edited.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = c.id;
    $("#scFormTitle").textContent = "Edit sales close";
    $("#scFormIntro").textContent = "Update which sales order this closure covers, or adjust the closure notes.";
    $("#scFormSaveBtn").textContent = "Save Changes";
    populateSalesOrderOptions(c.linkedSalesOrderId);
    $("#scFormSalesOrder").value = c.linkedSalesOrderId || "";
    const so = ERP_SalesOrderRepository.findById(c.linkedSalesOrderId);
    renderSalesOrderInfo(so);
    renderChecklistTable("scFormLineTableBody", so);
    $("#scFormNotes").value = c.closureNotes || "";
    clearFormErrors();
    openModal("scFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#scFormSalesOrder").value) { setFormError("scFormSalesOrder", "Select the sales order to close out."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#scAddBtn").addEventListener("click", openAddModal);

    $("#scFormSalesOrder").addEventListener("change", (e) => {
      const so = ERP_SalesOrderRepository.findById(e.target.value);
      renderSalesOrderInfo(so);
      renderChecklistTable("scFormLineTableBody", so);
    });

    $("#scFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const so = ERP_SalesOrderRepository.findById($("#scFormSalesOrder").value);
      const payload = {
        linkedSalesOrderId: $("#scFormSalesOrder").value,
        closureNotes: $("#scFormNotes").value.trim()
      };

      const label = so ? so.salesOrderCode : "this sales order";

      if (editingId) {
        openConfirm({
          title: "Save changes to this closure?",
          message: `This sales closure for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_SalesCloseRepository.update(editingId, payload);
            logSystemActivity({ module: "Sales Close", action: "Update", description: `Updated sales closure for ${label} (${company.name})` });
            closeModal("scFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_SalesCloseRepository.findById(editingId));
            showToast("Sales closure updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this closure?",
          message: `A new sales closure will be created as a Draft for ${label}.`,
          confirmLabel: "Create Closure",
          onConfirm: () => {
            const created = ERP_SalesCloseRepository.create(company, payload);
            logSystemActivity({ module: "Sales Close", action: "Create", description: `Created sales closure "${created.closureCode}" for ${label} (${company.name})` });
            closeModal("scFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.closureCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestClose(c) {
    const so = ERP_SalesOrderRepository.findById(c.linkedSalesOrderId);
    const checklist = ERP_SalesCloseRepository.computeCompletionChecklist(company.id, so);
    const incomplete = checklist.filter((s) => s.status !== "Complete" && !s.optional);
    const message = incomplete.length
      ? `"${c.closureCode}" will be marked Closed even though ${incomplete.length} stage(s) aren't complete (${incomplete.map((s) => s.label).join(", ")}). This cannot be reopened.`
      : `"${c.closureCode}" will be marked Closed — every stage in the checklist is complete. This cannot be reopened.`;
    openConfirm({
      title: "Close this sale?",
      message,
      confirmLabel: "Close Sale",
      onConfirm: () => {
        ERP_SalesCloseRepository.close(c.id, session.username);
        logSystemActivity({ module: "Sales Close", action: "Close", description: `Closed sale "${c.closureCode}" (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === c.id) openDetailModal(ERP_SalesCloseRepository.findById(c.id));
        showToast(`"${c.closureCode}" closed.`, "success");
      }
    });
  }

  function requestCancel(c) {
    openConfirm({
      title: "Cancel this closure?",
      message: `"${c.closureCode}" will be marked Cancelled and its sales order freed up for a different closure.`,
      confirmLabel: "Cancel Closure",
      onConfirm: () => {
        ERP_SalesCloseRepository.cancel(c.id, session.username);
        logSystemActivity({ module: "Sales Close", action: "Cancel", description: `Cancelled sales closure "${c.closureCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === c.id) openDetailModal(ERP_SalesCloseRepository.findById(c.id));
        showToast(`"${c.closureCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(c) {
    if (!ERP_SalesCloseRepository.canDelete(c)) {
      showToast(`"${c.closureCode}" is ${c.status} and can't be deleted.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this closure?",
      message: `"${c.closureCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_SalesCloseRepository.remove(c.id);
        logSystemActivity({ module: "Sales Close", action: "Delete", description: `Deleted sales closure "${c.closureCode}" (${company.name})`, severity: "warning" });
        if (detailId === c.id) closeModal("scDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${c.closureCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(c) {
    const footer = $("#scDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (c.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(c));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("scDetailModal"); openEditModal(c); });
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(c));
      addBtn("Close Sale", "btn btn--primary", () => requestClose(c));
    } else if (c.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(c));
    }
    // Closed: no footer action — a formally closed sale cannot be
    // reopened from this module, see file header.
  }

  function openDetailModal(c) {
    detailId = c.id;
    const so = ERP_SalesOrderRepository.findById(c.linkedSalesOrderId);
    const customer = so && so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
    const checklist = ERP_SalesCloseRepository.computeCompletionChecklist(company.id, so);

    $("#scDetailTitle").textContent = `${c.closureCode} · ${c.status}`;

    const rows = [];
    rows.push(`<div><dt>Closure Code</dt><dd><code>${escapeHtml(c.closureCode)}</code></dd></div>`);
    rows.push(`<div><dt>Sales Order</dt><dd>${so ? `<code>${escapeHtml(so.salesOrderCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Customer</dt><dd>${customer ? escapeHtml(customer.customerName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Completion</dt><dd>${completionSummary(checklist)} stages complete</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(c.status)}">${c.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(c.createdAt))}</dd></div>`);
    if (c.closedAt) rows.push(`<div><dt>Closed</dt><dd>${formatDateTime(new Date(c.closedAt))} by ${escapeHtml(ERP_SalesCloseRepository.actorLabel(c.closedByUsername))}</dd></div>`);
    if (c.status === "Cancelled" && c.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(c.cancelledAt))} by ${escapeHtml(ERP_SalesCloseRepository.actorLabel(c.cancelledByUsername))}</dd></div>`);
    if (c.closureNotes) rows.push(`<div><dt>Closure Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(c.closureNotes)}</dd></div>`);

    $("#scDetailBody").innerHTML = rows.join("");
    renderChecklistTable("scLineTableBody", so);
    const complete = checklist.filter((s) => s.status === "Complete").length;
    $("#scGrandTotalLine").textContent = complete === checklist.length
      ? "Every stage in this sale's journey is complete."
      : `${checklist.length - complete} stage(s) not yet complete.`;
    renderDetailFooter(c);
    openModal("scDetailModal");
  }

  function bindDetailModal() {
    $("#scTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const c = ERP_SalesCloseRepository.findById(viewBtn.dataset.id);
        if (c) openDetailModal(c);
        return;
      }
      if (actionBtn) {
        const c = ERP_SalesCloseRepository.findById(actionBtn.dataset.id);
        if (!c) return;
        if (actionBtn.dataset.action === "close") requestClose(c);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "sales-close")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading sales closures…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#scContent").hidden = true;
      $("#scSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#scContent").hidden = false;
      $("#scHeaderActions").hidden = false;
      $("#scSubtitle").textContent = `Closing out sales for ${company.name} (${company.companyCode}).`;

      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();

      if (new URLSearchParams(window.location.search).get("action") === "add") {
        openAddModal();
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
