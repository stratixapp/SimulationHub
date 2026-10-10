/* =============================================================================
   DOT ERP — pages/purchase-closure.js
   Phase 4, Module 20: Purchase Closure — THE FINAL MODULE OF THE PHASE

   See data/purchase-closure-data.js's header for the full design
   rationale (built from the PO itself, not any downstream artifact, the
   whole-chain `computeCompletionChecklist()`, and why closing is never
   gated on it). UI-layer decisions on top of that:

   - THE CHECKLIST TABLE RENDERS IN BOTH THE FORM AND THE DETAIL VIEW,
     always computed fresh, never stored — the same "pure computation,
     recomputed on every read" shape Three-Way Matching's own
     `computeMatchLines()` established. Status badges: Complete
     (success), In Progress (warning), Not Started (neutral) — a plain,
     scannable visual summary of the entire chain this session built.
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
    let rows = ERP_PurchaseClosureRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((c) => c.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((c) => {
        const po = c.linkedPoId ? ERP_PurchaseOrderRepository.findById(c.linkedPoId) : null;
        const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
        return c.closureCode.toLowerCase().includes(term) ||
          (po && po.poCode.toLowerCase().includes(term)) ||
          (vendor && vendor.vendorName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_PurchaseClosureRepository.getAllForCompany(company.id);
    $("#pcSummaryTotal").textContent = String(all.length);
    $("#pcSummaryDraft").textContent = String(all.filter((c) => c.status === "Draft").length);
    $("#pcSummaryClosed").textContent = String(all.filter((c) => c.status === "Closed").length);
    $("#pcSummaryCancelled").textContent = String(all.filter((c) => c.status === "Cancelled").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#pcPagination");
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

    $("#pcEmptyState").hidden = all.length !== 0;
    $("#pcTable").hidden = all.length === 0;

    $("#pcTableBody").innerHTML = pageItems.map((c) => {
      const po = c.linkedPoId ? ERP_PurchaseOrderRepository.findById(c.linkedPoId) : null;
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(c.status)}">${c.status}</span>`;
      const checklist = ERP_PurchaseClosureRepository.computeCompletionChecklist(company.id, po);
      const qa = quickActionFor(c);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${c.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(c.closureCode)}</code></td>
        <td>${po ? `<code>${escapeHtml(po.poCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</td>
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
    $$("#pcStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#pcStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#pcSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#pcSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#pcExportCsvBtn").addEventListener("click", exportCsv);
    $("#pcPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Closure Code", "PO Code", "Vendor", "Completion", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((c) => {
      const po = c.linkedPoId ? ERP_PurchaseOrderRepository.findById(c.linkedPoId) : null;
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const checklist = ERP_PurchaseClosureRepository.computeCompletionChecklist(company.id, po);
      const line = [
        c.closureCode, po ? po.poCode : "", vendor ? vendor.vendorName : "", completionSummary(checklist), c.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-purchase-closures-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Purchase closures exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((c) => {
      const po = c.linkedPoId ? ERP_PurchaseOrderRepository.findById(c.linkedPoId) : null;
      const checklist = ERP_PurchaseClosureRepository.computeCompletionChecklist(company.id, po);
      return `<tr><td>${escapeHtml(c.closureCode)}</td><td>${po ? escapeHtml(po.poCode) : ""}</td><td>${completionSummary(checklist)}</td><td>${escapeHtml(c.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Purchase Closure Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Purchase Closure Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Closure Code</th><th>PO</th><th>Completion</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Purchase Closure")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#pcActivityEmptyState").hidden = relevant.length !== 0;
    $("#pcActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#pcFormModal)
     --------------------------------------------------------------------- */
  function populatePoOptions(currentId) {
    let pos = ERP_PurchaseClosureRepository.getAvailablePosForCompany(company.id, editingId);
    if (currentId && !pos.some((p) => p.id === currentId)) {
      const current = ERP_PurchaseOrderRepository.findById(currentId);
      if (current) pos = pos.concat([current]);
    }
    $("#pcFormPo").innerHTML = pos.map((po) => {
      const vendor = ERP_VendorRepository.findById(po.vendorId);
      const label = `${po.poCode} — ${vendor ? vendor.vendorName : "Unknown vendor"} (${po.status})`;
      return `<option value="${po.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderPoInfo(po) {
    const box = $("#pcFormPoInfo");
    if (!po) { box.textContent = ""; return; }
    const vendor = ERP_VendorRepository.findById(po.vendorId);
    box.textContent = `Vendor: ${vendor ? vendor.vendorName : "Removed"} — PO status: ${po.status}.`;
  }

  function renderChecklistTable(targetBodyId, po) {
    const checklist = ERP_PurchaseClosureRepository.computeCompletionChecklist(company.id, po);
    $("#" + targetBodyId).innerHTML = checklist.map((stage) => {
      const optionalTag = stage.optional ? ` <span class="profile-subtle">(optional)</span>` : "";
      return `<tr><td>${escapeHtml(stage.label)}${optionalTag}</td><td><span class="status-badge status-badge--${checklistBadgeClass(stage.status)}">${escapeHtml(stage.status)}</span></td></tr>`;
    }).join("");
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("pcFormPo", ""); }

  function openAddModal() {
    const available = ERP_PurchaseClosureRepository.getAvailablePosForCompany(company.id, null);
    if (!available.length) {
      showToast("No purchase orders are currently available to close. A closure can only be created once a PO exists and isn't already claimed by another closure.", "warning");
      return;
    }
    editingId = null;
    $("#pcFormTitle").textContent = "New purchase closure";
    $("#pcFormIntro").textContent = "Pick the purchase order to close out — the completion checklist below is informational only.";
    $("#pcFormSaveBtn").textContent = "Create Closure";
    populatePoOptions(null);
    const firstPo = ERP_PurchaseOrderRepository.findById($("#pcFormPo").value);
    renderPoInfo(firstPo);
    renderChecklistTable("pcFormLineTableBody", firstPo);
    $("#pcFormNotes").value = "";
    clearFormErrors();
    openModal("pcFormModal");
  }

  function openEditModal(c) {
    if (!ERP_PurchaseClosureRepository.canEdit(c)) {
      showToast(`"${c.closureCode}" is ${c.status} and can't be edited.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = c.id;
    $("#pcFormTitle").textContent = "Edit purchase closure";
    $("#pcFormIntro").textContent = "Update which purchase order this closure covers, or adjust the closure notes.";
    $("#pcFormSaveBtn").textContent = "Save Changes";
    populatePoOptions(c.linkedPoId);
    $("#pcFormPo").value = c.linkedPoId || "";
    const po = ERP_PurchaseOrderRepository.findById(c.linkedPoId);
    renderPoInfo(po);
    renderChecklistTable("pcFormLineTableBody", po);
    $("#pcFormNotes").value = c.closureNotes || "";
    clearFormErrors();
    openModal("pcFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#pcFormPo").value) { setFormError("pcFormPo", "Select the purchase order to close out."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#pcAddBtn").addEventListener("click", openAddModal);

    $("#pcFormPo").addEventListener("change", (e) => {
      const po = ERP_PurchaseOrderRepository.findById(e.target.value);
      renderPoInfo(po);
      renderChecklistTable("pcFormLineTableBody", po);
    });

    $("#pcFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const po = ERP_PurchaseOrderRepository.findById($("#pcFormPo").value);
      const payload = {
        linkedPoId: $("#pcFormPo").value,
        closureNotes: $("#pcFormNotes").value.trim()
      };

      const label = po ? po.poCode : "this purchase order";

      if (editingId) {
        openConfirm({
          title: "Save changes to this closure?",
          message: `This purchase closure for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_PurchaseClosureRepository.update(editingId, payload);
            logSystemActivity({ module: "Purchase Closure", action: "Update", description: `Updated purchase closure for ${label} (${company.name})` });
            closeModal("pcFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_PurchaseClosureRepository.findById(editingId));
            showToast("Purchase closure updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this closure?",
          message: `A new purchase closure will be created as a Draft for ${label}.`,
          confirmLabel: "Create Closure",
          onConfirm: () => {
            const created = ERP_PurchaseClosureRepository.create(company, payload);
            logSystemActivity({ module: "Purchase Closure", action: "Create", description: `Created purchase closure "${created.closureCode}" for ${label} (${company.name})` });
            closeModal("pcFormModal");
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
    const po = ERP_PurchaseOrderRepository.findById(c.linkedPoId);
    const checklist = ERP_PurchaseClosureRepository.computeCompletionChecklist(company.id, po);
    const incomplete = checklist.filter((s) => s.status !== "Complete" && !s.optional);
    const message = incomplete.length
      ? `"${c.closureCode}" will be marked Closed even though ${incomplete.length} stage(s) aren't complete (${incomplete.map((s) => s.label).join(", ")}). This cannot be reopened.`
      : `"${c.closureCode}" will be marked Closed — every stage in the checklist is complete. This cannot be reopened.`;
    openConfirm({
      title: "Close this purchase?",
      message,
      confirmLabel: "Close Purchase",
      onConfirm: () => {
        ERP_PurchaseClosureRepository.close(c.id, session.username);
        logSystemActivity({ module: "Purchase Closure", action: "Close", description: `Closed purchase "${c.closureCode}" (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === c.id) openDetailModal(ERP_PurchaseClosureRepository.findById(c.id));
        showToast(`"${c.closureCode}" closed.`, "success");
      }
    });
  }

  function requestCancel(c) {
    openConfirm({
      title: "Cancel this closure?",
      message: `"${c.closureCode}" will be marked Cancelled and its purchase order freed up for a different closure.`,
      confirmLabel: "Cancel Closure",
      onConfirm: () => {
        ERP_PurchaseClosureRepository.cancel(c.id, session.username);
        logSystemActivity({ module: "Purchase Closure", action: "Cancel", description: `Cancelled purchase closure "${c.closureCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === c.id) openDetailModal(ERP_PurchaseClosureRepository.findById(c.id));
        showToast(`"${c.closureCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(c) {
    if (!ERP_PurchaseClosureRepository.canDelete(c)) {
      showToast(`"${c.closureCode}" is ${c.status} and can't be deleted.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this closure?",
      message: `"${c.closureCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_PurchaseClosureRepository.remove(c.id);
        logSystemActivity({ module: "Purchase Closure", action: "Delete", description: `Deleted purchase closure "${c.closureCode}" (${company.name})`, severity: "warning" });
        if (detailId === c.id) closeModal("pcDetailModal");
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
    const footer = $("#pcDetailFooter");
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
      addBtn("Edit", "btn btn--ghost", () => { closeModal("pcDetailModal"); openEditModal(c); });
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(c));
      addBtn("Close Purchase", "btn btn--primary", () => requestClose(c));
    } else if (c.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(c));
    }
    // Closed: no footer action — a formally closed purchase cannot be
    // reopened from this module, see file header.
  }

  function openDetailModal(c) {
    detailId = c.id;
    const po = ERP_PurchaseOrderRepository.findById(c.linkedPoId);
    const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
    const checklist = ERP_PurchaseClosureRepository.computeCompletionChecklist(company.id, po);

    $("#pcDetailTitle").textContent = `${c.closureCode} · ${c.status}`;

    const rows = [];
    rows.push(`<div><dt>Closure Code</dt><dd><code>${escapeHtml(c.closureCode)}</code></dd></div>`);
    rows.push(`<div><dt>Purchase Order</dt><dd>${po ? `<code>${escapeHtml(po.poCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Completion</dt><dd>${completionSummary(checklist)} stages complete</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(c.status)}">${c.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(c.createdAt))}</dd></div>`);
    if (c.closedAt) rows.push(`<div><dt>Closed</dt><dd>${formatDateTime(new Date(c.closedAt))} by ${escapeHtml(ERP_PurchaseClosureRepository.actorLabel(c.closedByUsername))}</dd></div>`);
    if (c.status === "Cancelled" && c.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(c.cancelledAt))} by ${escapeHtml(ERP_PurchaseClosureRepository.actorLabel(c.cancelledByUsername))}</dd></div>`);
    if (c.closureNotes) rows.push(`<div><dt>Closure Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(c.closureNotes)}</dd></div>`);

    $("#pcDetailBody").innerHTML = rows.join("");
    renderChecklistTable("pcLineTableBody", po);
    const complete = checklist.filter((s) => s.status === "Complete").length;
    $("#pcGrandTotalLine").textContent = complete === checklist.length
      ? "Every stage in this purchase's journey is complete."
      : `${checklist.length - complete} stage(s) not yet complete.`;
    renderDetailFooter(c);
    openModal("pcDetailModal");
  }

  function bindDetailModal() {
    $("#pcTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const c = ERP_PurchaseClosureRepository.findById(viewBtn.dataset.id);
        if (c) openDetailModal(c);
        return;
      }
      if (actionBtn) {
        const c = ERP_PurchaseClosureRepository.findById(actionBtn.dataset.id);
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
    if (!window.ERP.enforcePageAccess(session, "purchase-closure")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading purchase closures…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#pcContent").hidden = true;
      $("#pcSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#pcContent").hidden = false;
      $("#pcHeaderActions").hidden = false;
      $("#pcSubtitle").textContent = `Closing out purchases for ${company.name} (${company.companyCode}).`;

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
