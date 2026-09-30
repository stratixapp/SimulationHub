/* =============================================================================
   DOT ERP — pages/quotation-receipt.js
   Phase 4, Module 6: Quotation Receipt

   See data/quotation-data.js's header for the full design rationale
   (per-line pricing, the hard composite-key uniqueness, the "Selected,
   not just invited" vendor pool, the simple 3-state lifecycle). UI notes:

   - THE LINE-PRICING TABLE IS DYNAMIC, POPULATED FROM TWO HOPS UP THE
     CHAIN. Choosing an RFQ resolves its linked PR and renders one input
     row per PR line item; choosing a vendor (after) doesn't change the
     rows, only which existing quotation (if any) is being edited. This
     mirrors Purchase Requisition's own "prefill from the linked need"
     instinct, just walking PR -> RFQ -> here instead of Need -> PR line.
   - The RFQ picker only offers RFQs that still have at least one
     Selected vendor without a logged quotation
     (getRfqsNeedingQuotations()) — the same "consumable resource, toast
     if none available" shape RFQ Creation's own PR picker uses, not a
     blocking empty state.
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


  function statusBadgeClass(status) {
    if (status === "Received") return "success";
    if (status === "Cancelled") return "neutral";
    return "warning"; // Draft
  }

  /** RFQs (Sent/Closed) that still have at least one Selected vendor with
      no logged (non-Cancelled) quotation yet — the pool this module's Add
      flow offers. */
  function getRfqsNeedingQuotations(companyId, excludeQuotationId) {
    const rfqs = ERP_RfqRepository.getAllForCompany(companyId).filter((r) => r.status === "Sent" || r.status === "Closed");
    return rfqs.filter((r) => getAvailableVendorsForRfq(r, companyId, excludeQuotationId).length > 0);
  }

  /** Selected vendor ids on this RFQ that don't already have a logged
      quotation (excluding the quotation currently being edited, if any). */
  function getAvailableVendorsForRfq(rfq, companyId, excludeQuotationId) {
    const selected = ERP_RfqRepository.getSelectedVendorIds(rfq);
    return selected.filter((vendorId) => !ERP_QuotationRepository.hasQuotationForRfqAndVendor(rfq.id, vendorId, excludeQuotationId));
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_QuotationRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((q) => q.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((q) => {
        const rfq = ERP_RfqRepository.findById(q.rfqId);
        const vendor = ERP_VendorRepository.findById(q.vendorId);
        return q.quotationCode.toLowerCase().includes(term) ||
          (rfq && rfq.rfqCode.toLowerCase().includes(term)) ||
          (vendor && vendor.vendorName.toLowerCase().includes(term));
      });
    }
    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_QuotationRepository.getAllForCompany(company.id);
    $("#qtSummaryTotal").textContent = String(all.length);
    $("#qtSummaryDraft").textContent = String(all.filter((q) => q.status === "Draft").length);
    const received = all.filter((q) => q.status === "Received");
    $("#qtSummaryReceived").textContent = String(received.length);

    let lowest = null;
    received.forEach((q) => {
      const { total, pricedCount, totalCount } = ERP_QuotationRepository.computeQuotedTotal(q);
      if (totalCount > 0 && pricedCount === totalCount) {
        if (lowest === null || total < lowest) lowest = total;
      }
    });
    $("#qtSummaryLowest").textContent = lowest === null ? "—" : formatCurrency(lowest);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#qtPagination");
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

    $("#qtEmptyState").hidden = all.length !== 0;
    $("#qtTable").hidden = all.length === 0;

    $("#qtTableBody").innerHTML = pageItems.map((q) => {
      const rfq = ERP_RfqRepository.findById(q.rfqId);
      const vendor = ERP_VendorRepository.findById(q.vendorId);
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(q.status)}">${q.status}</span>`;
      const { total, pricedCount, totalCount } = ERP_QuotationRepository.computeQuotedTotal(q);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);

      return `
      <tr>
        <td><code>${escapeHtml(q.quotationCode)}</code></td>
        <td>${rfq ? `<code>${escapeHtml(rfq.rfqCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${totalLabel}</td>
        <td>${q.validUntil ? escapeHtml(q.validUntil) : `<span class="profile-subtle">—</span>`}</td>
        <td>${statusBadge}</td>
        <td><button type="button" class="row-detail-btn" data-id="${q.id}">View</button></td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#qtStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#qtStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#qtSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#qtSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#qtExportCsvBtn").addEventListener("click", exportCsv);
    $("#qtPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Quotation Code", "RFQ", "Vendor", "Quoted Total", "Valid Until", "Delivery Days", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((q) => {
      const rfq = ERP_RfqRepository.findById(q.rfqId);
      const vendor = ERP_VendorRepository.findById(q.vendorId);
      const { total } = ERP_QuotationRepository.computeQuotedTotal(q);
      const line = [q.quotationCode, rfq ? rfq.rfqCode : "", vendor ? vendor.vendorName : "", total, q.validUntil || "", q.deliveryDays != null ? q.deliveryDays : "", q.status]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-quotations-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Quotations exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((q) => {
      const rfq = ERP_RfqRepository.findById(q.rfqId);
      const vendor = ERP_VendorRepository.findById(q.vendorId);
      const { total } = ERP_QuotationRepository.computeQuotedTotal(q);
      return `<tr><td>${escapeHtml(q.quotationCode)}</td><td>${rfq ? escapeHtml(rfq.rfqCode) : ""}</td><td>${vendor ? escapeHtml(vendor.vendorName) : ""}</td><td>${escapeHtml(formatCurrency(total))}</td><td>${escapeHtml(q.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Quotation Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Quotation Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Quotation Code</th><th>RFQ</th><th>Vendor</th><th>Quoted Total</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Quotation Receipt")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#qtActivityEmptyState").hidden = relevant.length !== 0;
    $("#qtActivityList").innerHTML = relevant.map((e) => `
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
    ["qtFormRfq", "qtFormVendor"].forEach((f) => setFormError(f, ""));
  }

  function getLinkedPrLines(rfq) {
    if (!rfq) return [];
    const pr = ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId);
    return pr ? (pr.lineItems || []) : [];
  }

  function renderFormLineTable(rfq, existingLineQuotes) {
    const lines = getLinkedPrLines(rfq);
    const priceByLine = {};
    (existingLineQuotes || []).forEach((lq) => { priceByLine[lq.prLineItemId] = lq.quotedUnitPrice; });

    if (!lines.length) {
      $("#qtFormLineTableBody").innerHTML = `<tr><td colspan="3"><span class="profile-subtle">This RFQ's requisition has no line items.</span></td></tr>`;
      return;
    }
    $("#qtFormLineTableBody").innerHTML = lines.map((line) => {
      const item = line.itemId ? ERP_ItemRepository.findById(line.itemId) : null;
      const label = item ? `${escapeHtml(item.itemName)}${line.lineDescription ? " — " + escapeHtml(line.lineDescription) : ""}` : escapeHtml(line.lineDescription || "—");
      const existingPrice = priceByLine[line.id];
      return `
      <tr>
        <td>${label}</td>
        <td>${escapeHtml(String(line.quantity))}</td>
        <td><div class="input-wrap"><input type="number" class="qt-line-price" data-line-id="${line.id}" data-quantity="${line.quantity}" min="0" step="0.01" value="${existingPrice != null ? existingPrice : ""}" /></div></td>
      </tr>`;
    }).join("");
  }

  function collectLineQuotes() {
    return $$(".qt-line-price").map((input) => ({
      prLineItemId: input.dataset.lineId,
      quantity: Number(input.dataset.quantity),
      quotedUnitPrice: input.value === "" ? null : Number(input.value)
    }));
  }

  function populateRfqOptions(currentId) {
    let rfqs = getRfqsNeedingQuotations(company.id, editingId);
    if (currentId && !rfqs.some((r) => r.id === currentId)) {
      const current = ERP_RfqRepository.findById(currentId);
      if (current) rfqs = rfqs.concat([current]);
    }
    $("#qtFormRfq").innerHTML = rfqs.map((r) => `<option value="${r.id}">${escapeHtml(r.rfqCode)}</option>`).join("");
  }

  function populateVendorOptions(rfqId, currentVendorId) {
    const rfq = ERP_RfqRepository.findById(rfqId);
    let vendorIds = rfq ? getAvailableVendorsForRfq(rfq, company.id, editingId) : [];
    if (currentVendorId && !vendorIds.includes(currentVendorId)) vendorIds = vendorIds.concat([currentVendorId]);
    const vendors = vendorIds.map((id) => ERP_VendorRepository.findById(id)).filter(Boolean)
      .sort((a, b) => a.vendorName.localeCompare(b.vendorName));
    $("#qtFormVendor").innerHTML = vendors.map((v) => `<option value="${v.id}">${escapeHtml(v.vendorName)}</option>`).join("");
  }

  function openAddModal() {
    const available = getRfqsNeedingQuotations(company.id, null);
    if (!available.length) {
      showToast("No RFQs currently have a Selected vendor still awaiting a quotation.", "warning");
      return;
    }
    editingId = null;
    $("#qtFormTitle").textContent = "Log a quotation";
    $("#qtFormIntro").textContent = "Pick the RFQ and the vendor who quoted, then enter their price for each line.";
    $("#qtFormSaveBtn").textContent = "Log Quotation";
    populateRfqOptions(null);
    const firstRfq = ERP_RfqRepository.findById($("#qtFormRfq").value);
    populateVendorOptions($("#qtFormRfq").value, null);
    renderFormLineTable(firstRfq, []);
    $("#qtFormValidUntil").value = "";
    $("#qtFormDeliveryDays").value = "";
    $("#qtFormNotes").value = "";
    clearFormErrors();
    openModal("qtFormModal");
  }

  function openEditModal(q) {
    if (!ERP_QuotationRepository.canEdit(q)) {
      showToast(`"${q.quotationCode}" is ${q.status} and can't be edited directly.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = q.id;
    $("#qtFormTitle").textContent = "Edit quotation";
    $("#qtFormIntro").textContent = "Update this vendor's pricing or terms.";
    $("#qtFormSaveBtn").textContent = "Save Changes";
    populateRfqOptions(q.rfqId);
    $("#qtFormRfq").value = q.rfqId;
    populateVendorOptions(q.rfqId, q.vendorId);
    $("#qtFormVendor").value = q.vendorId;
    renderFormLineTable(ERP_RfqRepository.findById(q.rfqId), q.lineQuotes);
    $("#qtFormValidUntil").value = q.validUntil || "";
    $("#qtFormDeliveryDays").value = q.deliveryDays != null ? String(q.deliveryDays) : "";
    $("#qtFormNotes").value = q.notes || "";
    clearFormErrors();
    openModal("qtFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#qtFormRfq").value) { setFormError("qtFormRfq", "Select an RFQ."); valid = false; }
    if (!$("#qtFormVendor").value) { setFormError("qtFormVendor", "Select the vendor who quoted."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#qtAddBtn").addEventListener("click", openAddModal);

    $("#qtFormRfq").addEventListener("change", (e) => {
      const rfq = ERP_RfqRepository.findById(e.target.value);
      populateVendorOptions(e.target.value, null);
      renderFormLineTable(rfq, []);
    });

    $("#qtFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        rfqId: $("#qtFormRfq").value,
        vendorId: $("#qtFormVendor").value,
        lineQuotes: collectLineQuotes(),
        validUntil: $("#qtFormValidUntil").value || null,
        deliveryDays: $("#qtFormDeliveryDays").value === "" ? null : Number($("#qtFormDeliveryDays").value),
        notes: $("#qtFormNotes").value.trim()
      };

      const rfq = ERP_RfqRepository.findById(payload.rfqId);
      const vendor = ERP_VendorRepository.findById(payload.vendorId);
      const label = `${vendor ? vendor.vendorName : "this vendor"} on ${rfq ? rfq.rfqCode : "this RFQ"}`;

      if (editingId) {
        openConfirm({
          title: "Save changes to this quotation?",
          message: `The quotation for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_QuotationRepository.update(editingId, payload);
            logSystemActivity({ module: "Quotation Receipt", action: "Update", description: `Updated quotation for ${label} (${company.name})` });
            closeModal("qtFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_QuotationRepository.findById(editingId));
            showToast("Quotation updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Log this quotation?",
          message: `A new quotation will be logged for ${label}.`,
          confirmLabel: "Log Quotation",
          onConfirm: () => {
            const created = ERP_QuotationRepository.create(company, payload);
            logSystemActivity({ module: "Quotation Receipt", action: "Create", description: `Logged quotation "${created.quotationCode}" for ${label} (${company.name})` });
            closeModal("qtFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.quotationCode}" logged.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestMarkReceived(q) {
    openConfirm({
      title: "Mark this quotation Received?",
      message: `"${q.quotationCode}" will be locked from further edits and ready for comparison.`,
      confirmLabel: "Mark Received",
      onConfirm: () => {
        ERP_QuotationRepository.markReceived(q.id, session.username);
        logSystemActivity({ module: "Quotation Receipt", action: "Mark Received", description: `Marked quotation "${q.quotationCode}" Received (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === q.id) openDetailModal(ERP_QuotationRepository.findById(q.id));
        showToast(`"${q.quotationCode}" marked Received.`, "success");
      }
    });
  }

  function requestRevise(q) {
    openConfirm({
      title: "Revise this quotation?",
      message: `"${q.quotationCode}" will move back to Draft so you can correct it.`,
      confirmLabel: "Revise",
      onConfirm: () => {
        ERP_QuotationRepository.reviseToDraft(q.id);
        logSystemActivity({ module: "Quotation Receipt", action: "Revise", description: `Reopened quotation "${q.quotationCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === q.id) openDetailModal(ERP_QuotationRepository.findById(q.id));
        showToast(`"${q.quotationCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(q) {
    openConfirm({
      title: "Cancel this quotation?",
      message: `"${q.quotationCode}" will be marked Cancelled and its vendor freed up to be re-quoted on this RFQ.`,
      confirmLabel: "Cancel Quotation",
      onConfirm: () => {
        ERP_QuotationRepository.cancel(q.id, session.username);
        logSystemActivity({ module: "Quotation Receipt", action: "Cancel", description: `Cancelled quotation "${q.quotationCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === q.id) openDetailModal(ERP_QuotationRepository.findById(q.id));
        showToast(`"${q.quotationCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(q) {
    if (!ERP_QuotationRepository.canDelete(q)) {
      showToast(`"${q.quotationCode}" is ${q.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this quotation?",
      message: `"${q.quotationCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_QuotationRepository.remove(q.id);
        logSystemActivity({ module: "Quotation Receipt", action: "Delete", description: `Deleted quotation "${q.quotationCode}" (${company.name})`, severity: "warning" });
        if (detailId === q.id) closeModal("qtDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${q.quotationCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(q) {
    const footer = $("#qtDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    if (q.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(q));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("qtDetailModal"); openEditModal(q); });
      addBtn("Mark Received", "btn btn--primary", () => requestMarkReceived(q));
    } else if (q.status === "Received") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(q));
      addBtn("Revise", "btn btn--primary", () => requestRevise(q));
    } else if (q.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(q));
    }
  }

  function openDetailModal(q) {
    detailId = q.id;
    const rfq = ERP_RfqRepository.findById(q.rfqId);
    const vendor = ERP_VendorRepository.findById(q.vendorId);

    $("#qtDetailTitle").textContent = `${q.quotationCode} · ${q.status}`;

    const rows = [];
    rows.push(`<div><dt>Quotation Code</dt><dd><code>${escapeHtml(q.quotationCode)}</code></dd></div>`);
    rows.push(`<div><dt>RFQ</dt><dd>${rfq ? `<code>${escapeHtml(rfq.rfqCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Valid Until</dt><dd>${escapeHtml(q.validUntil || "—")}</dd></div>`);
    rows.push(`<div><dt>Delivery Days</dt><dd>${q.deliveryDays != null ? escapeHtml(String(q.deliveryDays)) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(q.status)}">${q.status}</span></dd></div>`);
    if (q.isRecommended) rows.push(`<div><dt>Comparison</dt><dd><span class="status-badge status-badge--success">Recommended</span> in Quotation Comparison</dd></div>`);
    if (typeof ERP_PurchaseOrderRepository !== "undefined") {
      const linkedPo = ERP_PurchaseOrderRepository.findPoForQuotation(company.id, q.id);
      if (linkedPo) {
        const poBadgeClass = linkedPo.status === "Approved" || linkedPo.status === "Confirmed" ? "success"
          : linkedPo.status === "Rejected" || linkedPo.status === "Vendor Declined" ? "danger"
          : linkedPo.status === "Submitted" || linkedPo.status === "Sent" ? "warning" : "neutral";
        rows.push(`<div><dt>Linked to PO</dt><dd><code>${escapeHtml(linkedPo.poCode)}</code> <span class="status-badge status-badge--${poBadgeClass}">${escapeHtml(linkedPo.status)}</span></dd></div>`);
      }
    }
    if (q.receivedAt) rows.push(`<div><dt>Received</dt><dd>${formatDateTime(new Date(q.receivedAt))} by ${escapeHtml(ERP_QuotationRepository.actorLabel(q.receivedByUsername))}</dd></div>`);
    if (q.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(q.cancelledAt))} by ${escapeHtml(ERP_QuotationRepository.actorLabel(q.cancelledByUsername))}</dd></div>`);
    if (q.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(q.notes)}</dd></div>`);
    $("#qtDetailBody").innerHTML = rows.join("");

    const prLines = getLinkedPrLines(rfq);
    const priceByLine = {};
    (q.lineQuotes || []).forEach((lq) => { priceByLine[lq.prLineItemId] = lq.quotedUnitPrice; });

    $("#qtDetailLineTableBody").innerHTML = prLines.length
      ? prLines.map((line) => {
          const item = line.itemId ? ERP_ItemRepository.findById(line.itemId) : null;
          const label = item ? `${escapeHtml(item.itemName)}${line.lineDescription ? " — " + escapeHtml(line.lineDescription) : ""}` : escapeHtml(line.lineDescription || "—");
          const price = priceByLine[line.id];
          const lineTotal = price != null ? Number(price) * Number(line.quantity) : null;
          return `<tr><td>${label}</td><td>${escapeHtml(String(line.quantity))}</td><td>${price != null ? escapeHtml(formatCurrency(price)) : `<span class="profile-subtle">—</span>`}</td><td>${lineTotal != null ? escapeHtml(formatCurrency(lineTotal)) : `<span class="profile-subtle">—</span>`}</td></tr>`;
        }).join("")
      : `<tr><td colspan="4"><span class="profile-subtle">The linked requisition has no line items.</span></td></tr>`;

    const { total, pricedCount, totalCount } = ERP_QuotationRepository.computeQuotedTotal(q);
    if (totalCount === 0) {
      $("#qtGrandTotalLine").textContent = "";
    } else if (pricedCount === totalCount) {
      $("#qtGrandTotalLine").textContent = `Quoted total: ${formatCurrency(total)}`;
    } else {
      $("#qtGrandTotalLine").textContent = `Quoted total: ~${formatCurrency(total)} (${pricedCount} of ${totalCount} lines priced)`;
    }

    renderDetailFooter(q);
    openModal("qtDetailModal");
  }

  function bindDetailModal() {
    $("#qtTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (viewBtn) {
        const q = ERP_QuotationRepository.findById(viewBtn.dataset.id);
        if (q) openDetailModal(q);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "quotation-receipt")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading quotations…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#qtContent").hidden = true;
      $("#qtSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#qtContent").hidden = false;
      $("#qtHeaderActions").hidden = false;
      $("#qtSubtitle").textContent = `Logging quotations for ${company.name} (${company.companyCode}).`;

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
