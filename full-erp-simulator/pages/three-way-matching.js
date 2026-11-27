/* =============================================================================
   DOT ERP — pages/three-way-matching.js
   Phase 4, Module 17: Three-Way Matching

   See data/three-way-matching-data.js's header for the full design
   rationale (built from one Invoice Verification, the PO/GRN resolved
   live via `resolveChain()`, the unstored `computeMatchLines()`
   comparison, and the real Approve/Hold decision gate). UI-layer
   decisions on top of that:

   - THE FORM HAS NO LINE TABLE — the first module this session where
     picking the parent record doesn't populate an editable or even
     read-only line grid in the create form. There's nothing to fill in;
     `computeMatchLines()` does all the work once the record exists, and
     showing it in the Detail modal (not the create form) keeps the
     create flow to what it actually is: picking which invoice to match.
   - THE INFO HINT SHOWS A LIVE PREVIEW even before saving — selecting an
     invoice in the form immediately computes and displays the overall
     match status, so the person creating this record isn't flying blind
     about what they're about to get.
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
  let filterStatus = "all";
  let sortOrder = "desc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;
  let decidingId = null; // match awaiting a Hold decision


  function statusBadgeClass(status) {
    if (status === "Approved for Payment") return "success";
    if (status === "On Hold") return "danger";
    if (status === "Cancelled") return "neutral";
    return "warning"; // Draft
  }

  function matchResultBadgeClass(overallStatus) {
    if (overallStatus === "Fully Matched") return "success";
    if (overallStatus === "Discrepancies Found") return "warning";
    return "neutral"; // GRN Not Available / PO Not Available
  }

  function quickActionFor(m) {
    if (m.status === "Draft") return { action: "approve", label: "Approve" };
    return null;
  }

  /** Resolves the source-of-truth description for a match line via the
      PO's own upstream PR chain — same helper shape every module this
      session has used. */
  function getSourceLinesForPo(po) {
    if (!po) return [];
    const quotation = ERP_QuotationRepository.findById(po.linkedQuotationId);
    const rfq = quotation ? ERP_RfqRepository.findById(quotation.rfqId) : null;
    const pr = rfq ? ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId) : null;
    return pr ? (pr.lineItems || []) : [];
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_ThreeWayMatchingRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((m) => m.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((m) => {
        const { po, invoiceVerification } = ERP_ThreeWayMatchingRepository.computeMatchLines(company, m);
        return m.matchCode.toLowerCase().includes(term) ||
          (po && po.poCode.toLowerCase().includes(term)) ||
          (invoiceVerification && (invoiceVerification.vendorInvoiceNumber || "").toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_ThreeWayMatchingRepository.getAllForCompany(company.id);
    $("#twSummaryTotal").textContent = String(all.length);
    $("#twSummaryDraft").textContent = String(all.filter((m) => m.status === "Draft").length);
    $("#twSummaryApproved").textContent = String(all.filter((m) => m.status === "Approved for Payment").length);
    $("#twSummaryOnHold").textContent = String(all.filter((m) => m.status === "On Hold").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#twPagination");
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

    $("#twEmptyState").hidden = all.length !== 0;
    $("#twTable").hidden = all.length === 0;

    $("#twTableBody").innerHTML = pageItems.map((m) => {
      const { po, invoiceVerification, overallStatus } = ERP_ThreeWayMatchingRepository.computeMatchLines(company, m);
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(m.status)}">${m.status}</span>`;
      const resultBadge = `<span class="status-badge status-badge--${matchResultBadgeClass(overallStatus)}">${escapeHtml(overallStatus)}</span>`;
      const qa = quickActionFor(m);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${m.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(m.matchCode)}</code></td>
        <td>${invoiceVerification && invoiceVerification.vendorInvoiceNumber ? escapeHtml(invoiceVerification.vendorInvoiceNumber) : `<span class="profile-subtle">—</span>`}</td>
        <td>${po ? `<code>${escapeHtml(po.poCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${resultBadge}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${m.id}">View</button>
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
    $$("#twStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#twStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#twSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#twSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#twExportCsvBtn").addEventListener("click", exportCsv);
    $("#twPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Match Code", "Invoice #", "PO Code", "Vendor", "Match Result", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((m) => {
      const { po, invoiceVerification, overallStatus } = ERP_ThreeWayMatchingRepository.computeMatchLines(company, m);
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const line = [
        m.matchCode, invoiceVerification ? invoiceVerification.vendorInvoiceNumber || "" : "",
        po ? po.poCode : "", vendor ? vendor.vendorName : "", overallStatus, m.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-three-way-matches-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Three-way matches exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((m) => {
      const { po, overallStatus } = ERP_ThreeWayMatchingRepository.computeMatchLines(company, m);
      return `<tr><td>${escapeHtml(m.matchCode)}</td><td>${po ? escapeHtml(po.poCode) : ""}</td><td>${escapeHtml(overallStatus)}</td><td>${escapeHtml(m.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Three-Way Matching Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Three-Way Matching Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Match Code</th><th>PO</th><th>Match Result</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Three-Way Matching")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#twActivityEmptyState").hidden = relevant.length !== 0;
    $("#twActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#twFormModal) — no line table, just a picker + live preview.
     --------------------------------------------------------------------- */
  function populateInvoiceOptions(currentId) {
    let invoices = ERP_ThreeWayMatchingRepository.getAvailableVerifiedInvoicesForCompany(company.id, editingId);
    if (currentId && !invoices.some((v) => v.id === currentId)) {
      const current = ERP_InvoiceVerificationRepository.findById(currentId);
      if (current) invoices = invoices.concat([current]);
    }
    $("#twFormInvoice").innerHTML = invoices.map((v) => {
      const po = ERP_PurchaseOrderRepository.findById(v.linkedPoId);
      const label = `${v.verificationCode}${v.vendorInvoiceNumber ? ` — ${v.vendorInvoiceNumber}` : ""}${po ? ` (${po.poCode})` : ""}`;
      return `<option value="${v.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderInvoicePreview(invoiceVerification) {
    const box = $("#twFormInvoiceInfo");
    if (!invoiceVerification) { box.textContent = ""; return; }
    const fauxRecord = { linkedInvoiceVerificationId: invoiceVerification.id };
    const { overallStatus } = ERP_ThreeWayMatchingRepository.computeMatchLines(company, fauxRecord);
    box.textContent = `Preview: ${overallStatus}.`;
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("twFormInvoice", ""); }

  function openAddModal() {
    const available = ERP_ThreeWayMatchingRepository.getAvailableVerifiedInvoicesForCompany(company.id, null);
    if (!available.length) {
      showToast("No Verified invoices are currently available to match. Verify one in Invoice Verification first.", "warning");
      return;
    }
    editingId = null;
    $("#twFormTitle").textContent = "New three-way match";
    $("#twFormIntro").textContent = "Pick the Verified invoice to match — the PO and GRN are found automatically.";
    $("#twFormSaveBtn").textContent = "Create Match";
    populateInvoiceOptions(null);
    renderInvoicePreview(ERP_InvoiceVerificationRepository.findById($("#twFormInvoice").value));
    $("#twFormNotes").value = "";
    clearFormErrors();
    openModal("twFormModal");
  }

  function openEditModal(m) {
    if (!ERP_ThreeWayMatchingRepository.canEdit(m)) {
      showToast(`"${m.matchCode}" is ${m.status} and can't be edited directly. Reopen it to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = m.id;
    $("#twFormTitle").textContent = "Edit three-way match";
    $("#twFormIntro").textContent = "Update which invoice this match compares.";
    $("#twFormSaveBtn").textContent = "Save Changes";
    populateInvoiceOptions(m.linkedInvoiceVerificationId);
    $("#twFormInvoice").value = m.linkedInvoiceVerificationId || "";
    renderInvoicePreview(ERP_InvoiceVerificationRepository.findById(m.linkedInvoiceVerificationId));
    $("#twFormNotes").value = m.decisionNotes || "";
    clearFormErrors();
    openModal("twFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#twFormInvoice").value) { setFormError("twFormInvoice", "Select the Verified invoice to match."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#twAddBtn").addEventListener("click", openAddModal);

    $("#twFormInvoice").addEventListener("change", (e) => {
      renderInvoicePreview(ERP_InvoiceVerificationRepository.findById(e.target.value));
    });

    $("#twFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const invoiceVerification = ERP_InvoiceVerificationRepository.findById($("#twFormInvoice").value);
      const payload = {
        linkedInvoiceVerificationId: $("#twFormInvoice").value,
        decisionNotes: $("#twFormNotes").value.trim()
      };

      const label = invoiceVerification ? invoiceVerification.verificationCode : "this invoice";

      if (editingId) {
        openConfirm({
          title: "Save changes to this match?",
          message: `This three-way match for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_ThreeWayMatchingRepository.update(editingId, payload);
            logSystemActivity({ module: "Three-Way Matching", action: "Update", description: `Updated three-way match for ${label} (${company.name})` });
            closeModal("twFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_ThreeWayMatchingRepository.findById(editingId));
            showToast("Three-way match updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this match?",
          message: `A new three-way match will be created as a Draft for ${label}.`,
          confirmLabel: "Create Match",
          onConfirm: () => {
            const created = ERP_ThreeWayMatchingRepository.create(company, payload);
            logSystemActivity({ module: "Three-Way Matching", action: "Create", description: `Created three-way match "${created.matchCode}" for ${label} (${company.name})` });
            closeModal("twFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.matchCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestApprove(m) {
    openConfirm({
      title: "Approve this match for payment?",
      message: `"${m.matchCode}" will be marked Approved for Payment, ready for a Payment Request to be built from it.`,
      confirmLabel: "Approve for Payment",
      onConfirm: () => {
        ERP_ThreeWayMatchingRepository.approveForPayment(m.id, session.username);
        logSystemActivity({ module: "Three-Way Matching", action: "Approve", description: `Approved three-way match "${m.matchCode}" for payment (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === m.id) openDetailModal(ERP_ThreeWayMatchingRepository.findById(m.id));
        showToast(`"${m.matchCode}" approved for payment.`, "success");
      }
    });
  }

  function requestHold(m) {
    decidingId = m.id;
    $("#twHoldReason").value = "";
    $("#twHoldReasonError").textContent = "";
    openModal("twHoldModal");
  }

  function bindHoldModal() {
    $("#twHoldConfirmBtn").addEventListener("click", () => {
      const reason = $("#twHoldReason").value.trim();
      if (!reason) { $("#twHoldReasonError").textContent = "A reason is required so whoever investigates knows what to fix."; return; }
      const m = ERP_ThreeWayMatchingRepository.findById(decidingId);
      if (!m) { closeModal("twHoldModal"); return; }
      ERP_ThreeWayMatchingRepository.putOnHold(m.id, session.username, reason);
      logSystemActivity({ module: "Three-Way Matching", action: "Hold", description: `Put three-way match "${m.matchCode}" on hold: ${reason} (${company.name})`, severity: "warning" });
      closeModal("twHoldModal");
      renderAll();
      renderActivity();
      if (detailId === m.id) openDetailModal(ERP_ThreeWayMatchingRepository.findById(m.id));
      showToast(`"${m.matchCode}" put on hold.`, "info");
    });
  }

  function requestReopen(m) {
    openConfirm({
      title: "Reopen this match?",
      message: `"${m.matchCode}" will move back to Draft so you can re-review it.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_ThreeWayMatchingRepository.reopen(m.id);
        logSystemActivity({ module: "Three-Way Matching", action: "Reopen", description: `Reopened three-way match "${m.matchCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === m.id) openDetailModal(ERP_ThreeWayMatchingRepository.findById(m.id));
        showToast(`"${m.matchCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(m) {
    openConfirm({
      title: "Cancel this match?",
      message: `"${m.matchCode}" will be marked Cancelled and its invoice freed up for a different match.`,
      confirmLabel: "Cancel Match",
      onConfirm: () => {
        ERP_ThreeWayMatchingRepository.cancel(m.id, session.username);
        logSystemActivity({ module: "Three-Way Matching", action: "Cancel", description: `Cancelled three-way match "${m.matchCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === m.id) openDetailModal(ERP_ThreeWayMatchingRepository.findById(m.id));
        showToast(`"${m.matchCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(m) {
    if (!ERP_ThreeWayMatchingRepository.canDelete(m)) {
      showToast(`"${m.matchCode}" is ${m.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this match?",
      message: `"${m.matchCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_ThreeWayMatchingRepository.remove(m.id);
        logSystemActivity({ module: "Three-Way Matching", action: "Delete", description: `Deleted three-way match "${m.matchCode}" (${company.name})`, severity: "warning" });
        if (detailId === m.id) closeModal("twDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${m.matchCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderMatchLinesTable(m) {
    const { lines, po, grn, overallStatus } = ERP_ThreeWayMatchingRepository.computeMatchLines(company, m);
    const prLineById = {};
    getSourceLinesForPo(po).forEach((l) => { prLineById[l.id] = l; });

    $("#twLineTableBody").innerHTML = lines.length
      ? lines.map((line) => {
          const prLine = prLineById[line.prLineItemId];
          const item = prLine && prLine.itemId ? ERP_ItemRepository.findById(prLine.itemId) : null;
          const label = item
            ? `${escapeHtml(item.itemName)}${prLine.lineDescription ? " — " + escapeHtml(prLine.lineDescription) : ""}`
            : escapeHtml((prLine && prLine.lineDescription) || "—");
          const orderedCell = `${escapeHtml(String(line.orderedQty))} @ ${line.orderedPrice != null ? escapeHtml(formatCurrency(line.orderedPrice)) : "—"}`;
          const grnCell = line.grnQty != null ? escapeHtml(String(line.grnQty)) : `<span class="profile-subtle">—</span>`;
          const invoicedCell = line.invoicedQty != null ? `${escapeHtml(String(line.invoicedQty))} @ ${line.invoicedPrice != null ? escapeHtml(formatCurrency(line.invoicedPrice)) : "—"}` : `<span class="profile-subtle">—</span>`;
          const qtyBadge = `<span class="status-badge status-badge--${line.qtyStatus === "Matched" ? "success" : "warning"}">${escapeHtml(line.qtyStatus)}</span>`;
          const priceBadge = `<span class="status-badge status-badge--${line.priceStatus === "Matched" ? "success" : "warning"}">${escapeHtml(line.priceStatus)}</span>`;
          return `<tr><td>${label}</td><td>${orderedCell}</td><td>${grnCell}</td><td>${invoicedCell}</td><td>${qtyBadge}</td><td>${priceBadge}</td></tr>`;
        }).join("")
      : `<tr><td colspan="6"><span class="profile-subtle">No purchase order line items to compare.</span></td></tr>`;

    $("#twGrandTotalLine").textContent = grn
      ? `Overall: ${overallStatus}.`
      : `Overall: ${overallStatus} — this PO's receiving chain hasn't produced a GRN yet.`;
  }

  function renderDetailFooter(m) {
    const footer = $("#twDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (m.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(m));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("twDetailModal"); openEditModal(m); });
      addBtn("Put On Hold", "btn btn--danger-outline", () => requestHold(m));
      addBtn("Approve for Payment", "btn btn--primary", () => requestApprove(m));
    } else if (m.status === "Approved for Payment") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(m));
    } else if (m.status === "On Hold") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(m));
      addBtn("Reopen to Draft", "btn btn--ghost", () => requestReopen(m));
    } else if (m.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(m));
    }
  }

  function openDetailModal(m) {
    detailId = m.id;
    const { po, grn, invoiceVerification, overallStatus } = ERP_ThreeWayMatchingRepository.computeMatchLines(company, m);
    const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;

    $("#twDetailTitle").textContent = `${m.matchCode} · ${m.status}`;

    const rows = [];
    rows.push(`<div><dt>Match Code</dt><dd><code>${escapeHtml(m.matchCode)}</code></dd></div>`);
    rows.push(`<div><dt>Invoice</dt><dd>${invoiceVerification ? `<code>${escapeHtml(invoiceVerification.verificationCode)}</code>${invoiceVerification.vendorInvoiceNumber ? ` (${escapeHtml(invoiceVerification.vendorInvoiceNumber)})` : ""}` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Purchase Order</dt><dd>${po ? `<code>${escapeHtml(po.poCode)}</code>` : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>GRN</dt><dd>${grn ? `<code>${escapeHtml(grn.grnNumber)}</code>` : `<span class="profile-subtle">Not available yet</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Match Result</dt><dd><span class="status-badge status-badge--${matchResultBadgeClass(overallStatus)}">${escapeHtml(overallStatus)}</span></dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(m.status)}">${m.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(m.createdAt))}</dd></div>`);
    if (m.approvedAt) rows.push(`<div><dt>Approved for Payment</dt><dd>${formatDateTime(new Date(m.approvedAt))} by ${escapeHtml(ERP_ThreeWayMatchingRepository.actorLabel(m.approvedByUsername))}</dd></div>`);
    if (typeof ERP_PaymentRequestRepository !== "undefined") {
      const linkedRequest = ERP_PaymentRequestRepository.findRequestForMatch(company.id, m.id);
      if (linkedRequest) {
        const requestBadgeClass = linkedRequest.status === "Approved" ? "success" : linkedRequest.status === "Rejected" ? "danger" : linkedRequest.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Payment Request</dt><dd><code>${escapeHtml(linkedRequest.requestCode)}</code> <span class="status-badge status-badge--${requestBadgeClass}">${escapeHtml(linkedRequest.status)}</span></dd></div>`);
      } else if (m.status === "Approved for Payment") {
        rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Ready to request payment — see <strong>Payment Request</strong>.</dd></div>`);
      }
    }
    if (m.status === "On Hold" && m.onHoldAt) {
      rows.push(`<div><dt>Put On Hold</dt><dd>${formatDateTime(new Date(m.onHoldAt))} by ${escapeHtml(ERP_ThreeWayMatchingRepository.actorLabel(m.onHoldByUsername))}</dd></div>`);
      rows.push(`<div><dt>Hold Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(m.holdReason || "—")}</dd></div>`);
    }
    if (m.status === "Cancelled" && m.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(m.cancelledAt))} by ${escapeHtml(ERP_ThreeWayMatchingRepository.actorLabel(m.cancelledByUsername))}</dd></div>`);
    if (m.decisionNotes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(m.decisionNotes)}</dd></div>`);

    $("#twDetailBody").innerHTML = rows.join("");
    renderMatchLinesTable(m);
    renderDetailFooter(m);
    openModal("twDetailModal");
  }

  function bindDetailModal() {
    $("#twTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const m = ERP_ThreeWayMatchingRepository.findById(viewBtn.dataset.id);
        if (m) openDetailModal(m);
        return;
      }
      if (actionBtn) {
        const m = ERP_ThreeWayMatchingRepository.findById(actionBtn.dataset.id);
        if (!m) return;
        if (actionBtn.dataset.action === "approve") requestApprove(m);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "three-way-matching")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading three-way matches…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#twContent").hidden = true;
      $("#twSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#twContent").hidden = false;
      $("#twHeaderActions").hidden = false;
      $("#twSubtitle").textContent = `Matching purchase orders, GRNs, and invoices for ${company.name} (${company.companyCode}).`;

      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
      bindHoldModal();

      if (new URLSearchParams(window.location.search).get("action") === "add") {
        openAddModal();
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
