/* =============================================================================
   DOT ERP — pages/rfq-creation.js
   Phase 4, Module 4: RFQ Creation

   See data/rfq-data.js's header for the full design rationale (required
   PR link + exclusivity, the simpler 4-state lifecycle, invited vendors
   as a plain array). UI-specific notes:

   - No `#noAnchorState`. An "available Approved PR" is a CONSUMABLE
     resource (see data file header) — the Add button just toasts a
     warning if none are available, rather than blocking the whole page
     the way Department Need/Purchase Requisition's persistent anchors did.
   - The invited-vendors picker is this codebase's first genuine
     multi-select — a `.checkbox-list` of `.checkbox-field` rows, read
     back as an array of checked vendor ids on Save.
   - The Detail modal shows the linked PR's own line items READ-ONLY, for
     reference ("what am I asking vendors to price") — resolved live from
     `ERP_PurchaseRequisitionRepository`, never copied onto the RFQ record.
   - Purchase Requisition's own Detail modal picks up the same small
     retrofit Department Need's did: a "Linked to RFQ" row, resolved live
     via `ERP_RfqRepository.findRfqForPr()`.
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
    if (status === "Sent") return "warning";
    return "neutral"; // Draft
  }

  function quickActionFor(rfq) {
    if (rfq.status === "Draft") return { action: "send", label: "Send" };
    if (rfq.status === "Sent") return { action: "close", label: "Close" };
    return null;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_RfqRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
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
    const all = ERP_RfqRepository.getAllForCompany(company.id);
    $("#rfqSummaryTotal").textContent = String(all.length);
    $("#rfqSummaryDraft").textContent = String(all.filter((r) => r.status === "Draft").length);
    $("#rfqSummarySent").textContent = String(all.filter((r) => r.status === "Sent").length);
    $("#rfqSummaryClosed").textContent = String(all.filter((r) => r.status === "Closed").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#rfqPagination");
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

    $("#rfqEmptyState").hidden = all.length !== 0;
    $("#rfqTable").hidden = all.length === 0;

    $("#rfqTableBody").innerHTML = pageItems.map((r) => {
      const pr = ERP_PurchaseRequisitionRepository.findById(r.linkedPrId);
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(r.status)}">${r.status}</span>`;
      const qa = quickActionFor(r);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${r.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(r.rfqCode)}</code></td>
        <td>${pr ? `<code>${escapeHtml(pr.prCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${r.invitedVendorIds.length}</td>
        <td>${r.dueDate ? escapeHtml(r.dueDate) : `<span class="profile-subtle">—</span>`}</td>
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
    $$("#rfqStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#rfqStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#rfqSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#rfqSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#rfqExportCsvBtn").addEventListener("click", exportCsv);
    $("#rfqPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["RFQ Code", "Linked PR", "Invited Vendors", "Due Date", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((r) => {
      const pr = ERP_PurchaseRequisitionRepository.findById(r.linkedPrId);
      const line = [r.rfqCode, pr ? pr.prCode : "", r.invitedVendorIds.length, r.dueDate || "", r.status]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-rfqs-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("RFQs exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((r) => {
      const pr = ERP_PurchaseRequisitionRepository.findById(r.linkedPrId);
      return `<tr><td>${escapeHtml(r.rfqCode)}</td><td>${pr ? escapeHtml(pr.prCode) : ""}</td><td>${r.invitedVendorIds.length}</td><td>${escapeHtml(r.dueDate || "")}</td><td>${escapeHtml(r.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - RFQ Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — RFQ Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>RFQ Code</th><th>Linked PR</th><th>Invited Vendors</th><th>Due Date</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "RFQ Creation")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#rfqActivityEmptyState").hidden = relevant.length !== 0;
    $("#rfqActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT FORM
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["rfqFormPr", "rfqFormDueDate", "rfqFormVendor"].forEach((f) => setFormError(f, ""));
  }

  function populatePrOptions(currentId) {
    let prs = ERP_RfqRepository.getAvailablePrsForCompany(company.id, editingId);
    if (currentId && !prs.some((p) => p.id === currentId)) {
      const current = ERP_PurchaseRequisitionRepository.findById(currentId);
      if (current) prs = prs.concat([current]);
    }
    $("#rfqFormPr").innerHTML = prs.map((p) => `<option value="${p.id}">${escapeHtml(p.prCode)} (${(p.lineItems || []).length} line${(p.lineItems || []).length === 1 ? "" : "s"})</option>`).join("");
  }

  function populateVendorChecklist(checkedIds) {
    const vendors = ERP_VendorRepository.getAllForCompany(company.id)
      .filter((v) => v.status === "Active")
      .sort((a, b) => a.vendorName.localeCompare(b.vendorName));
    const checked = new Set(checkedIds || []);
    if (!vendors.length) {
      $("#rfqFormVendorList").innerHTML = `<p class="profile-subtle">No active vendors yet — add one in Vendor Master first.</p>`;
      return;
    }
    $("#rfqFormVendorList").innerHTML = vendors.map((v) => `
      <label class="checkbox-field">
        <input type="checkbox" value="${v.id}" ${checked.has(v.id) ? "checked" : ""} />
        ${escapeHtml(v.vendorName)}
      </label>
    `).join("");
  }

  function getCheckedVendorIds() {
    return $$("#rfqFormVendorList input[type=checkbox]").filter((el) => el.checked).map((el) => el.value);
  }

  function openAddModal() {
    const available = ERP_RfqRepository.getAvailablePrsForCompany(company.id, null);
    if (!available.length) {
      showToast("No approved requisitions are available to build an RFQ from — every approved PR is already linked to one, or none have been approved yet.", "warning");
      return;
    }
    editingId = null;
    $("#rfqFormTitle").textContent = "Create a Request for Quotation";
    $("#rfqFormIntro").textContent = "Pick the approved requisition this RFQ is for, then invite one or more vendors to quote.";
    $("#rfqFormSaveBtn").textContent = "Create RFQ";
    populatePrOptions(null);
    populateVendorChecklist([]);
    $("#rfqFormDueDate").value = "";
    $("#rfqFormNotes").value = "";
    clearFormErrors();
    openModal("rfqFormModal");
  }

  function openEditModal(rfq) {
    if (!ERP_RfqRepository.canEdit(rfq)) {
      showToast(`"${rfq.rfqCode}" is ${rfq.status} and can't be edited directly.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = rfq.id;
    $("#rfqFormTitle").textContent = "Edit RFQ";
    $("#rfqFormIntro").textContent = "Update this RFQ's requisition, due date, invited vendors, or notes.";
    $("#rfqFormSaveBtn").textContent = "Save Changes";
    populatePrOptions(rfq.linkedPrId);
    $("#rfqFormPr").value = rfq.linkedPrId;
    populateVendorChecklist(rfq.invitedVendorIds);
    $("#rfqFormDueDate").value = rfq.dueDate || "";
    $("#rfqFormNotes").value = rfq.notes || "";
    clearFormErrors();
    openModal("rfqFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#rfqFormPr").value) { setFormError("rfqFormPr", "Select an approved requisition."); valid = false; }
    if (!$("#rfqFormDueDate").value) { setFormError("rfqFormDueDate", "Set a response due date."); valid = false; }
    if (!getCheckedVendorIds().length) { setFormError("rfqFormVendor", "Invite at least one vendor."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#rfqAddBtn").addEventListener("click", openAddModal);

    $("#rfqFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        linkedPrId: $("#rfqFormPr").value,
        dueDate: $("#rfqFormDueDate").value,
        invitedVendorIds: getCheckedVendorIds(),
        notes: $("#rfqFormNotes").value.trim()
      };
      const pr = ERP_PurchaseRequisitionRepository.findById(payload.linkedPrId);
      const prLabel = pr ? pr.prCode : "the selected requisition";

      if (editingId) {
        openConfirm({
          title: "Save changes to this RFQ?",
          message: `This RFQ (for ${prLabel}) will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_RfqRepository.update(editingId, payload);
            logSystemActivity({ module: "RFQ Creation", action: "Update", description: `Updated RFQ for requisition ${prLabel} (${company.name})` });
            closeModal("rfqFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_RfqRepository.findById(editingId));
            showToast("RFQ updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this RFQ?",
          message: `A new RFQ will be created for ${prLabel}, starting as a Draft.`,
          confirmLabel: "Create RFQ",
          onConfirm: () => {
            const created = ERP_RfqRepository.create(company, payload);
            logSystemActivity({ module: "RFQ Creation", action: "Create", description: `Created RFQ "${created.rfqCode}" for requisition ${prLabel} (${company.name})` });
            closeModal("rfqFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.rfqCode}" created as a Draft.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestSend(rfq) {
    openConfirm({
      title: "Send this RFQ?",
      message: `"${rfq.rfqCode}" will be locked from further edits and marked as sent to its invited vendors.`,
      confirmLabel: "Send RFQ",
      onConfirm: () => {
        ERP_RfqRepository.send(rfq.id, session.username);
        logSystemActivity({ module: "RFQ Creation", action: "Send", description: `Sent RFQ "${rfq.rfqCode}" (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === rfq.id) openDetailModal(ERP_RfqRepository.findById(rfq.id));
        showToast(`"${rfq.rfqCode}" marked as sent.`, "success");
      }
    });
  }

  function requestClose(rfq) {
    openConfirm({
      title: "Close this RFQ?",
      message: `"${rfq.rfqCode}" will be marked Closed, ready for Quotation Comparison.`,
      confirmLabel: "Close RFQ",
      onConfirm: () => {
        ERP_RfqRepository.close(rfq.id, session.username);
        logSystemActivity({ module: "RFQ Creation", action: "Close", description: `Closed RFQ "${rfq.rfqCode}" (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === rfq.id) openDetailModal(ERP_RfqRepository.findById(rfq.id));
        showToast(`"${rfq.rfqCode}" closed.`, "success");
      }
    });
  }

  function requestCancel(rfq) {
    openConfirm({
      title: "Cancel this RFQ?",
      message: `"${rfq.rfqCode}" will be marked Cancelled and its linked requisition freed up for a different RFQ.`,
      confirmLabel: "Cancel RFQ",
      onConfirm: () => {
        ERP_RfqRepository.cancel(rfq.id, session.username);
        logSystemActivity({ module: "RFQ Creation", action: "Cancel", description: `Cancelled RFQ "${rfq.rfqCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === rfq.id) openDetailModal(ERP_RfqRepository.findById(rfq.id));
        showToast(`"${rfq.rfqCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(rfq) {
    if (!ERP_RfqRepository.canDelete(rfq)) {
      showToast(`"${rfq.rfqCode}" is ${rfq.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this RFQ?",
      message: `"${rfq.rfqCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_RfqRepository.remove(rfq.id);
        logSystemActivity({ module: "RFQ Creation", action: "Delete", description: `Deleted RFQ "${rfq.rfqCode}" (${company.name})`, severity: "warning" });
        if (detailId === rfq.id) closeModal("rfqDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${rfq.rfqCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(rfq) {
    const footer = $("#rfqDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    if (rfq.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(rfq));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("rfqDetailModal"); openEditModal(rfq); });
      addBtn("Send", "btn btn--primary", () => requestSend(rfq));
    } else if (rfq.status === "Sent") {
      addBtn("Cancel RFQ", "btn btn--danger-outline", () => requestCancel(rfq));
      addBtn("Close RFQ", "btn btn--primary", () => requestClose(rfq));
    } else if (rfq.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(rfq));
    }
    // Closed is terminal — no footer actions.
  }

  function openDetailModal(rfq) {
    detailId = rfq.id;
    const pr = ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId);
    const vendors = rfq.invitedVendorIds.map((id) => ERP_VendorRepository.findById(id)).filter(Boolean);

    $("#rfqDetailTitle").textContent = `${rfq.rfqCode} · ${rfq.status}`;

    const rows = [];
    rows.push(`<div><dt>RFQ Code</dt><dd><code>${escapeHtml(rfq.rfqCode)}</code></dd></div>`);
    rows.push(`<div><dt>Linked Requisition</dt><dd>${pr ? `<code>${escapeHtml(pr.prCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Due Date</dt><dd>${escapeHtml(rfq.dueDate || "—")}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(rfq.status)}">${rfq.status}</span></dd></div>`);
    rows.push(`<div><dt>Invited Vendors</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${vendors.length ? vendors.map((v) => escapeHtml(v.vendorName)).join(", ") : "—"}</dd></div>`);
    if (rfq.sentAt) rows.push(`<div><dt>Sent</dt><dd>${formatDateTime(new Date(rfq.sentAt))} by ${escapeHtml(ERP_RfqRepository.actorLabel(rfq.sentByUsername))}</dd></div>`);
    if (rfq.closedAt) rows.push(`<div><dt>Closed</dt><dd>${formatDateTime(new Date(rfq.closedAt))} by ${escapeHtml(ERP_RfqRepository.actorLabel(rfq.closedByUsername))}</dd></div>`);
    if (rfq.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(rfq.cancelledAt))} by ${escapeHtml(ERP_RfqRepository.actorLabel(rfq.cancelledByUsername))}</dd></div>`);
    if (rfq.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(rfq.notes)}</dd></div>`);

    $("#rfqDetailBody").innerHTML = rows.join("");

    const lines = pr ? (pr.lineItems || []) : [];
    $("#rfqLineTableBody").innerHTML = lines.length
      ? lines.map((line) => {
          const item = line.itemId ? ERP_ItemRepository.findById(line.itemId) : null;
          const label = item ? `${escapeHtml(item.itemName)}${line.lineDescription ? " — " + escapeHtml(line.lineDescription) : ""}` : escapeHtml(line.lineDescription || "—");
          return `<tr><td>${label}</td><td>${escapeHtml(String(line.quantity))}</td></tr>`;
        }).join("")
      : `<tr><td colspan="2"><span class="profile-subtle">The linked requisition has no line items.</span></td></tr>`;

    renderDetailFooter(rfq);
    openModal("rfqDetailModal");
  }

  function bindDetailModal() {
    $("#rfqTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const r = ERP_RfqRepository.findById(viewBtn.dataset.id);
        if (r) openDetailModal(r);
        return;
      }
      if (actionBtn) {
        const r = ERP_RfqRepository.findById(actionBtn.dataset.id);
        if (!r) return;
        if (actionBtn.dataset.action === "send") requestSend(r);
        else if (actionBtn.dataset.action === "close") requestClose(r);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "rfq-creation")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading RFQs…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#rfqContent").hidden = true;
      $("#rfqSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#rfqContent").hidden = false;
      $("#rfqHeaderActions").hidden = false;
      $("#rfqSubtitle").textContent = `Managing RFQs for ${company.name} (${company.companyCode}).`;

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
