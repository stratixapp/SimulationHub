/* =============================================================================
   DOT ERP — pages/purchase-order.js
   Phase 4, Module 9: Purchase Order

   See data/po-data.js's header for the full design rationale (built from
   a Recommended quotation, exclusivity, the richer status lifecycle, the
   Warehouse/Payment Terms retrofit, the centralized actorLabel). This
   file is the UI layer's own decisions on top of that:

   - THE LINE-ITEMS TABLE IS DYNAMIC, POPULATED FROM THREE HOPS UP THE
     CHAIN. Choosing a Recommended quotation resolves quotation -> RFQ ->
     linked PR, and renders one editable qty/price row per PR line item,
     pre-filled from the quotation's own `lineQuotes` pricing. This is the
     exact same shape Quotation Receipt's own form used one hop further
     up (PR -> RFQ), just walking one hop further down the chain. Unlike
     Purchase Requisition's Detail modal (a workspace with its own Add/
     Edit/Remove Line modal), there is no separate line-item modal here —
     matching Quotation Receipt, not Purchase Requisition, because the SET
     of lines is never composed freely by hand.
   - NO vendor picker. The vendor is entirely determined by which
     quotation is picked (`quotation.vendorId`) — `renderQuotationInfo()`
     just displays it, live, as a hint under the picker once one is
     chosen.
   - NO Submitted quick-action beyond a bare "Submit" link, and NO
     Approve/Reject anywhere on this page — same reasoning as Purchase
     Requisition's own page: this module deliberately does NOT own the
     Submitted -> Approved/Rejected transition (see po-data.js's header).
     It DOES own Approved -> Sent (`requestSendToVendor`), unlike PR/PR
     Approval's split, because dispatching your own approved document is
     an administrative action, not a decision — see po-data.js's header
     for the full reasoning.
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
  let sortOrder = "desc"; // newest first by default
  let searchTerm = "";
  let page = 1;
  let editingId = null; // PO being created/edited in #poFormModal
  let detailId = null;  // PO currently open in #poDetailModal


  /* -----------------------------------------------------------------------
     BADGE COLOR MAPPING — the richer 8-status vocabulary po-data.js's
     header explains. Confirmed reads as success (the order has landed
     safely); Vendor Declined reads as danger (a real problem needing
     attention), distinct from internal Rejected which is also danger.
     --------------------------------------------------------------------- */
  function statusBadgeClass(status) {
    if (status === "Approved" || status === "Confirmed") return "success";
    if (status === "Rejected" || status === "Vendor Declined") return "danger";
    if (status === "Submitted" || status === "Sent") return "warning";
    return "neutral"; // Draft, Cancelled
  }

  /** Draft -> Submit, Rejected -> Revise, Approved -> Send to Vendor.
      Every other status gets NO row quick-action — see file header. */
  function quickActionFor(po) {
    if (po.status === "Draft") return { action: "submit", label: "Submit" };
    if (po.status === "Rejected") return { action: "revise", label: "Revise" };
    if (po.status === "Approved") return { action: "send", label: "Send to Vendor" };
    return null;
  }

  /** The PR line items a quotation's pricing (and therefore a PO's own
      lines) are ultimately resolved against — quotation -> RFQ -> linked
      PR's lineItems. Shared by the form's line table and the read-only
      Detail modal's line table. */
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
    let rows = ERP_PurchaseOrderRepository.getAllForCompany(company.id); // newest-first

    if (filterStatus !== "all") rows = rows.filter((p) => p.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((p) => {
        const vendor = p.vendorId ? ERP_VendorRepository.findById(p.vendorId) : null;
        const quotation = p.linkedQuotationId ? ERP_QuotationRepository.findById(p.linkedQuotationId) : null;
        return p.poCode.toLowerCase().includes(term) ||
          (vendor && vendor.vendorName.toLowerCase().includes(term)) ||
          (quotation && quotation.quotationCode.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_PurchaseOrderRepository.getAllForCompany(company.id);
    $("#poSummaryTotal").textContent = String(all.length);
    $("#poSummaryDraft").textContent = String(all.filter((p) => p.status === "Draft").length);
    $("#poSummarySubmitted").textContent = String(all.filter((p) => p.status === "Submitted").length);
    $("#poSummaryApproved").textContent = String(all.filter((p) => p.status === "Approved").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#poPagination");
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

    $("#poEmptyState").hidden = all.length !== 0;
    $("#poTable").hidden = all.length === 0;

    $("#poTableBody").innerHTML = pageItems.map((p) => {
      const vendor = p.vendorId ? ERP_VendorRepository.findById(p.vendorId) : null;
      const quotation = p.linkedQuotationId ? ERP_QuotationRepository.findById(p.linkedQuotationId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(p.status)}">${p.status}</span>`;
      const { total, pricedCount, totalCount } = ERP_PurchaseOrderRepository.computeGrandTotal(p);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);
      const expectedDelivery = p.expectedDeliveryDate ? escapeHtml(p.expectedDeliveryDate) : `<span class="profile-subtle">—</span>`;
      const qa = quickActionFor(p);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${p.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(p.poCode)}</code></td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${quotation ? `<code>${escapeHtml(quotation.quotationCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${totalCount}</td>
        <td>${totalLabel}</td>
        <td>${expectedDelivery}</td>
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
    $$("#poStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#poStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#poSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#poSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#poExportCsvBtn").addEventListener("click", exportCsv);
    $("#poPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["PO Code", "Vendor", "Built From", "Line Items", "Order Total", "Expected Delivery", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((p) => {
      const vendor = p.vendorId ? ERP_VendorRepository.findById(p.vendorId) : null;
      const quotation = p.linkedQuotationId ? ERP_QuotationRepository.findById(p.linkedQuotationId) : null;
      const { total, totalCount } = ERP_PurchaseOrderRepository.computeGrandTotal(p);
      const line = [
        p.poCode, vendor ? vendor.vendorName : "", quotation ? quotation.quotationCode : "", totalCount,
        total, p.expectedDeliveryDate || "", p.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-purchase-orders-${company.companyCode}.csv`;
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
      const quotation = p.linkedQuotationId ? ERP_QuotationRepository.findById(p.linkedQuotationId) : null;
      const { total, totalCount } = ERP_PurchaseOrderRepository.computeGrandTotal(p);
      return `<tr><td>${escapeHtml(p.poCode)}</td><td>${vendor ? escapeHtml(vendor.vendorName) : ""}</td><td>${quotation ? escapeHtml(quotation.quotationCode) : ""}</td><td>${totalCount}</td><td>${escapeHtml(formatCurrency(total))}</td><td>${escapeHtml(p.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Purchase Order Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Purchase Order Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>PO Code</th><th>Vendor</th><th>Built From</th><th>Lines</th><th>Order Total</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Purchase Order")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#poActivityEmptyState").hidden = relevant.length !== 0;
    $("#poActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#poFormModal) — picking a quotation drives the vendor info line
     and the line-items table; delivery warehouse/payment terms/expected
     delivery/notes are plain header fields.
     --------------------------------------------------------------------- */
  function populateQuotationOptions(currentId) {
    let quotations = ERP_PurchaseOrderRepository.getAvailableRecommendedQuotationsForCompany(company.id, editingId);
    if (currentId && !quotations.some((q) => q.id === currentId)) {
      const current = ERP_QuotationRepository.findById(currentId);
      if (current) quotations = quotations.concat([current]);
    }
    $("#poFormQuotation").innerHTML = quotations.map((q) => {
      const vendor = ERP_VendorRepository.findById(q.vendorId);
      const rfq = ERP_RfqRepository.findById(q.rfqId);
      const label = `${q.quotationCode} — ${vendor ? vendor.vendorName : "Unknown vendor"} (${rfq ? rfq.rfqCode : "—"})`;
      return `<option value="${q.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function populateWarehouseOptions(currentId) {
    let whs = ERP_WarehouseRepository.getAllForCompany(company.id).filter((w) => w.status === "Active");
    if (currentId && !whs.some((w) => w.id === currentId)) {
      const current = ERP_WarehouseRepository.findById(currentId);
      if (current) whs = whs.concat([current]);
    }
    whs = whs.slice().sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));
    $("#poFormWarehouse").innerHTML = `<option value="">Not set</option>` + whs.map((w) => `<option value="${w.id}">${escapeHtml(w.warehouseName)} (${escapeHtml(w.warehouseCode)})</option>`).join("");
  }

  function populatePaymentTermsOptions(currentId) {
    let terms = ERP_PaymentTermsRepository.getActiveForCompany(company.id);
    if (currentId && !terms.some((t) => t.id === currentId)) {
      const current = ERP_PaymentTermsRepository.findById(currentId);
      if (current) terms = terms.concat([current]);
    }
    const defaultTerm = ERP_PaymentTermsRepository.getDefault(company.id);
    $("#poFormPaymentTerms").innerHTML = `<option value="">Not set</option>` + terms.map((t) =>
      `<option value="${t.id}">${escapeHtml(t.termName)}${defaultTerm && defaultTerm.id === t.id ? " (Default)" : ""}</option>`
    ).join("");
  }

  function renderQuotationInfo(quotation) {
    const box = $("#poFormQuotationInfo");
    if (!quotation) { box.textContent = ""; return; }
    const vendor = ERP_VendorRepository.findById(quotation.vendorId);
    const rfq = ERP_RfqRepository.findById(quotation.rfqId);
    box.textContent = `Vendor: ${vendor ? vendor.vendorName : "Removed"} — sourced via ${rfq ? rfq.rfqCode : "—"}.`;
  }

  function renderFormLineTable(quotation, existingLineItems) {
    const prLines = getSourceLines(quotation);
    const quotedByLine = {};
    (quotation ? quotation.lineQuotes || [] : []).forEach((lq) => { quotedByLine[lq.prLineItemId] = lq.quotedUnitPrice; });
    const existingByLine = {};
    (existingLineItems || []).forEach((li) => { existingByLine[li.prLineItemId] = li; });

    if (!prLines.length) {
      $("#poFormLineTableBody").innerHTML = `<tr><td colspan="3"><span class="profile-subtle">Pick a quotation to load its line items.</span></td></tr>`;
      return;
    }
    $("#poFormLineTableBody").innerHTML = prLines.map((line) => {
      const item = line.itemId ? ERP_ItemRepository.findById(line.itemId) : null;
      const label = item ? `${escapeHtml(item.itemName)}${line.lineDescription ? " — " + escapeHtml(line.lineDescription) : ""}` : escapeHtml(line.lineDescription || "—");
      const existing = existingByLine[line.id];
      const startQty = existing ? existing.quantity : line.quantity;
      const quotedPrice = quotedByLine[line.id];
      const startPrice = existing ? existing.unitPrice : (quotedPrice != null ? quotedPrice : "");
      return `
      <tr>
        <td>${label}</td>
        <td><div class="input-wrap"><input type="number" class="po-line-qty" data-line-id="${line.id}" min="0" step="1" value="${startQty}" /></div></td>
        <td><div class="input-wrap"><input type="number" class="po-line-price" data-line-id="${line.id}" min="0" step="0.01" value="${startPrice}" /></div></td>
      </tr>`;
    }).join("");
  }

  function collectLineItems() {
    return $$(".po-line-qty").map((qtyInput) => {
      const lineId = qtyInput.dataset.lineId;
      const priceInput = document.querySelector(`.po-line-price[data-line-id="${lineId}"]`);
      return {
        prLineItemId: lineId,
        quantity: qtyInput.value === "" ? 0 : Number(qtyInput.value),
        unitPrice: !priceInput || priceInput.value === "" ? null : Number(priceInput.value)
      };
    });
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("poFormQuotation", ""); }

  function openAddModal() {
    const available = ERP_PurchaseOrderRepository.getAvailableRecommendedQuotationsForCompany(company.id, null);
    if (!available.length) {
      showToast("No Recommended quotations are currently available to build a purchase order from. Recommend one in Quotation Comparison first.", "warning");
      return;
    }
    editingId = null;
    $("#poFormTitle").textContent = "New purchase order";
    $("#poFormIntro").textContent = "Pick the Recommended quotation to build this order from — its vendor and line pricing carry over as a starting point.";
    $("#poFormSaveBtn").textContent = "Create Purchase Order";
    populateQuotationOptions(null);
    const firstQuotation = ERP_QuotationRepository.findById($("#poFormQuotation").value);
    renderQuotationInfo(firstQuotation);
    renderFormLineTable(firstQuotation, []);
    populateWarehouseOptions(null);
    populatePaymentTermsOptions(null);
    const defaultTerm = ERP_PaymentTermsRepository.getDefault(company.id);
    $("#poFormPaymentTerms").value = defaultTerm ? defaultTerm.id : "";
    $("#poFormExpectedDelivery").value = "";
    $("#poFormNotes").value = "";
    clearFormErrors();
    openModal("poFormModal");
  }

  function openEditModal(po) {
    if (!ERP_PurchaseOrderRepository.canEdit(po)) {
      showToast(`"${po.poCode}" is ${po.status} and can't be edited directly. Withdraw or revise it back to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = po.id;
    $("#poFormTitle").textContent = "Edit purchase order";
    $("#poFormIntro").textContent = "Update the quotation this order is built from, delivery details, or line pricing.";
    $("#poFormSaveBtn").textContent = "Save Changes";
    populateQuotationOptions(po.linkedQuotationId);
    $("#poFormQuotation").value = po.linkedQuotationId || "";
    const quotation = ERP_QuotationRepository.findById(po.linkedQuotationId);
    renderQuotationInfo(quotation);
    renderFormLineTable(quotation, po.lineItems);
    populateWarehouseOptions(po.deliveryWarehouseId);
    $("#poFormWarehouse").value = po.deliveryWarehouseId || "";
    populatePaymentTermsOptions(po.paymentTermsId);
    $("#poFormPaymentTerms").value = po.paymentTermsId || "";
    $("#poFormExpectedDelivery").value = po.expectedDeliveryDate || "";
    $("#poFormNotes").value = po.notes || "";
    clearFormErrors();
    openModal("poFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#poFormQuotation").value) { setFormError("poFormQuotation", "Select the Recommended quotation to build this order from."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#poAddBtn").addEventListener("click", openAddModal);

    $("#poFormQuotation").addEventListener("change", (e) => {
      const quotation = ERP_QuotationRepository.findById(e.target.value);
      renderQuotationInfo(quotation);
      renderFormLineTable(quotation, []);
    });

    $("#poFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const quotation = ERP_QuotationRepository.findById($("#poFormQuotation").value);
      const payload = {
        linkedQuotationId: $("#poFormQuotation").value,
        vendorId: quotation ? quotation.vendorId : null,
        lineItems: collectLineItems(),
        deliveryWarehouseId: $("#poFormWarehouse").value || null,
        paymentTermsId: $("#poFormPaymentTerms").value || null,
        expectedDeliveryDate: $("#poFormExpectedDelivery").value || null,
        notes: $("#poFormNotes").value.trim()
      };

      const vendor = quotation ? ERP_VendorRepository.findById(quotation.vendorId) : null;
      const label = vendor ? vendor.vendorName : "this vendor";

      if (editingId) {
        openConfirm({
          title: "Save changes to this purchase order?",
          message: `This purchase order for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_PurchaseOrderRepository.update(editingId, payload);
            logSystemActivity({ module: "Purchase Order", action: "Update", description: `Updated purchase order for ${label} (${company.name})` });
            closeModal("poFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_PurchaseOrderRepository.findById(editingId));
            showToast("Purchase order updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this purchase order?",
          message: `A new purchase order will be created as a Draft for ${label}, built from "${quotation ? quotation.quotationCode : ""}".`,
          confirmLabel: "Create Purchase Order",
          onConfirm: () => {
            const created = ERP_PurchaseOrderRepository.create(company, payload);
            logSystemActivity({ module: "Purchase Order", action: "Create", description: `Created purchase order "${created.poCode}" for ${label} (${company.name})` });
            closeModal("poFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.poCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS — this module owns Draft-side actions, Approved ->
     Sent (dispatch, not a decision), and Cancel. It does NOT own Submitted
     -> Approved/Rejected (PO Approval, Module 10) or Sent -> Confirmed/
     Vendor Declined (Vendor Confirmation, Module 11 — not yet built).
     --------------------------------------------------------------------- */
  function requestSubmit(po) {
    openConfirm({
      title: "Submit for approval?",
      message: `"${po.poCode}" will move to Submitted and await a decision in PO Approval.`,
      confirmLabel: "Submit",
      onConfirm: () => {
        ERP_PurchaseOrderRepository.submit(po.id, session.username);
        logSystemActivity({ module: "Purchase Order", action: "Submit", description: `Submitted purchase order "${po.poCode}" for approval (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === po.id) openDetailModal(ERP_PurchaseOrderRepository.findById(po.id));
        showToast(`"${po.poCode}" submitted for approval.`, "success");
      }
    });
  }

  function requestWithdraw(po) {
    openConfirm({
      title: "Withdraw this purchase order?",
      message: `"${po.poCode}" will move back to Draft so you can make changes.`,
      confirmLabel: "Withdraw",
      onConfirm: () => {
        ERP_PurchaseOrderRepository.withdraw(po.id);
        logSystemActivity({ module: "Purchase Order", action: "Withdraw", description: `Withdrew purchase order "${po.poCode}" back to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === po.id) openDetailModal(ERP_PurchaseOrderRepository.findById(po.id));
        showToast(`"${po.poCode}" withdrawn to Draft.`, "info");
      }
    });
  }

  function requestRevise(po) {
    openConfirm({
      title: "Revise this purchase order?",
      message: `"${po.poCode}" will move back to Draft so you can correct it and resubmit.`,
      confirmLabel: "Revise",
      onConfirm: () => {
        ERP_PurchaseOrderRepository.reopen(po.id);
        logSystemActivity({ module: "Purchase Order", action: "Revise", description: `Reopened purchase order "${po.poCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === po.id) openDetailModal(ERP_PurchaseOrderRepository.findById(po.id));
        showToast(`"${po.poCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestSendToVendor(po) {
    openConfirm({
      title: "Send this order to the vendor?",
      message: `"${po.poCode}" will be marked Sent. The vendor's own confirmation will be tracked once the Vendor Confirmation module is available.`,
      confirmLabel: "Send to Vendor",
      onConfirm: () => {
        ERP_PurchaseOrderRepository.sendToVendor(po.id, session.username);
        logSystemActivity({ module: "Purchase Order", action: "Send to Vendor", description: `Sent purchase order "${po.poCode}" to the vendor (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === po.id) openDetailModal(ERP_PurchaseOrderRepository.findById(po.id));
        showToast(`"${po.poCode}" sent to the vendor.`, "success");
      }
    });
  }

  function requestCancel(po) {
    openConfirm({
      title: "Cancel this purchase order?",
      message: `"${po.poCode}" will be marked Cancelled and its quotation freed up for a different purchase order.`,
      confirmLabel: "Cancel Purchase Order",
      onConfirm: () => {
        ERP_PurchaseOrderRepository.cancel(po.id, session.username);
        logSystemActivity({ module: "Purchase Order", action: "Cancel", description: `Cancelled purchase order "${po.poCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === po.id) openDetailModal(ERP_PurchaseOrderRepository.findById(po.id));
        showToast(`"${po.poCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(po) {
    if (!ERP_PurchaseOrderRepository.canDelete(po)) {
      showToast(`"${po.poCode}" is ${po.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this purchase order?",
      message: `"${po.poCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_PurchaseOrderRepository.remove(po.id);
        logSystemActivity({ module: "Purchase Order", action: "Delete", description: `Deleted purchase order "${po.poCode}" (${company.name})`, severity: "warning" });
        if (detailId === po.id) closeModal("poDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${po.poCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderLineItemsTable(po) {
    const lines = po.lineItems || [];
    const quotation = ERP_QuotationRepository.findById(po.linkedQuotationId);
    const prLines = getSourceLines(quotation);
    const prLineById = {};
    prLines.forEach((l) => { prLineById[l.id] = l; });

    $("#poLineTableBody").innerHTML = lines.length
      ? lines.map((line) => {
          const prLine = prLineById[line.prLineItemId];
          const item = prLine && prLine.itemId ? ERP_ItemRepository.findById(prLine.itemId) : null;
          const label = item
            ? `${escapeHtml(item.itemName)}${prLine.lineDescription ? " — " + escapeHtml(prLine.lineDescription) : ""}`
            : escapeHtml((prLine && prLine.lineDescription) || "—");
          const total = ERP_PurchaseOrderRepository.computeLineTotal(line);
          const priceLabel = line.unitPrice != null ? escapeHtml(formatCurrency(line.unitPrice)) : `<span class="profile-subtle">—</span>`;
          const totalLabel = total != null ? escapeHtml(formatCurrency(total)) : `<span class="profile-subtle">—</span>`;
          return `<tr><td>${label}</td><td>${escapeHtml(String(line.quantity))}</td><td>${priceLabel}</td><td>${totalLabel}</td></tr>`;
        }).join("")
      : `<tr><td colspan="4"><span class="profile-subtle">This order has no line items.</span></td></tr>`;

    const { total, pricedCount, totalCount } = ERP_PurchaseOrderRepository.computeGrandTotal(po);
    if (totalCount === 0) {
      $("#poGrandTotalLine").textContent = "";
    } else if (pricedCount === totalCount) {
      $("#poGrandTotalLine").textContent = `Order total: ${formatCurrency(total)}`;
    } else {
      $("#poGrandTotalLine").textContent = `Order total: ~${formatCurrency(total)} (${pricedCount} of ${totalCount} lines priced)`;
    }
  }

  function renderDetailFooter(po) {
    const footer = $("#poDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (po.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(po));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("poDetailModal"); openEditModal(po); });
      addBtn("Submit for Approval", "btn btn--primary", () => requestSubmit(po));
    } else if (po.status === "Submitted") {
      addBtn("Withdraw", "btn btn--ghost", () => requestWithdraw(po));
    } else if (po.status === "Approved") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(po));
      addBtn("Send to Vendor", "btn btn--primary", () => requestSendToVendor(po));
    } else if (po.status === "Rejected") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(po));
      addBtn("Revise & Resubmit", "btn btn--primary", () => requestRevise(po));
    } else if (po.status === "Sent") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(po));
    } else if (po.status === "Vendor Declined") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(po));
    } else if (po.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(po));
    }
    // Confirmed: no footer BUTTON here — the Detail body itself now shows
    // either a live "Linked to Delivery Schedule" row or a "Next Step"
    // hint pointing at that module (see openDetailModal's retrofit).
  }

  function openDetailModal(po) {
    detailId = po.id;
    const quotation = ERP_QuotationRepository.findById(po.linkedQuotationId);
    const vendor = po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
    const warehouse = po.deliveryWarehouseId ? ERP_WarehouseRepository.findById(po.deliveryWarehouseId) : null;
    const terms = po.paymentTermsId ? ERP_PaymentTermsRepository.findById(po.paymentTermsId) : null;

    $("#poDetailTitle").textContent = `${po.poCode} · ${po.status}`;

    const rows = [];
    rows.push(`<div><dt>PO Code</dt><dd><code>${escapeHtml(po.poCode)}</code></dd></div>`);
    rows.push(`<div><dt>Built From</dt><dd>${quotation ? `<code>${escapeHtml(quotation.quotationCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Delivery Warehouse</dt><dd>${warehouse ? escapeHtml(warehouse.warehouseName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Payment Terms</dt><dd>${terms ? escapeHtml(terms.termName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Expected Delivery</dt><dd>${po.expectedDeliveryDate ? escapeHtml(po.expectedDeliveryDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(po.status)}">${po.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(po.createdAt))}</dd></div>`);
    if (po.submittedAt) rows.push(`<div><dt>Submitted</dt><dd>${formatDateTime(new Date(po.submittedAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.submittedByUsername))}</dd></div>`);
    if (po.status === "Submitted") rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Awaiting a decision in <strong>PO Approval</strong> — see the PO Approval module in the sidebar.</dd></div>`);
    if (po.approvedAt) rows.push(`<div><dt>Approved</dt><dd>${formatDateTime(new Date(po.approvedAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.approvedByUsername))}</dd></div>`);
    if (po.status === "Rejected" && po.rejectedAt) {
      rows.push(`<div><dt>Rejected</dt><dd>${formatDateTime(new Date(po.rejectedAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.rejectedByUsername))}</dd></div>`);
      rows.push(`<div><dt>Rejection Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(po.rejectionReason || "—")}</dd></div>`);
    }
    if (po.sentAt) rows.push(`<div><dt>Sent to Vendor</dt><dd>${formatDateTime(new Date(po.sentAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.sentByUsername))}</dd></div>`);
    if (po.status === "Sent") rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Awaiting the vendor's own confirmation — record their response in <strong>Vendor Confirmation</strong>.</dd></div>`);
    if (po.confirmedAt) rows.push(`<div><dt>Vendor Confirmed</dt><dd>${formatDateTime(new Date(po.confirmedAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.confirmedByUsername))}</dd></div>`);
    if (po.status === "Confirmed" && po.vendorConfirmedDeliveryDate) rows.push(`<div><dt>Vendor's Promised Delivery</dt><dd>${escapeHtml(po.vendorConfirmedDeliveryDate)}</dd></div>`);
    if (typeof ERP_DeliveryScheduleRepository !== "undefined") {
      const linkedSchedule = ERP_DeliveryScheduleRepository.findScheduleForPo(company.id, po.id);
      if (linkedSchedule) {
        const scheduleBadgeClass = linkedSchedule.status === "Finalized" ? "success" : linkedSchedule.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Delivery Schedule</dt><dd><code>${escapeHtml(linkedSchedule.scheduleCode)}</code> <span class="status-badge status-badge--${scheduleBadgeClass}">${escapeHtml(linkedSchedule.status)}</span></dd></div>`);
      } else if (po.status === "Confirmed") {
        rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Ready to plan delivery — see <strong>Delivery Schedule</strong>.</dd></div>`);
      }
    }
    if (typeof ERP_InvoiceVerificationRepository !== "undefined") {
      const linkedInvoice = ERP_InvoiceVerificationRepository.findVerificationForPo(company.id, po.id);
      if (linkedInvoice) {
        const invoiceBadgeClass = linkedInvoice.status === "Verified" ? "success" : linkedInvoice.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Invoice Verification</dt><dd><code>${escapeHtml(linkedInvoice.verificationCode)}</code> <span class="status-badge status-badge--${invoiceBadgeClass}">${escapeHtml(linkedInvoice.status)}</span></dd></div>`);
      }
    }
    if (typeof ERP_PurchaseClosureRepository !== "undefined") {
      const linkedClosure = ERP_PurchaseClosureRepository.findClosureForPo(company.id, po.id);
      if (linkedClosure) {
        const closureBadgeClass = linkedClosure.status === "Closed" ? "success" : linkedClosure.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Purchase Closure</dt><dd><code>${escapeHtml(linkedClosure.closureCode)}</code> <span class="status-badge status-badge--${closureBadgeClass}">${escapeHtml(linkedClosure.status)}</span></dd></div>`);
      }
    }
    if (po.status === "Vendor Declined" && po.vendorDeclinedAt) {
      rows.push(`<div><dt>Vendor Declined</dt><dd>${formatDateTime(new Date(po.vendorDeclinedAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.vendorDeclinedByUsername))}</dd></div>`);
      rows.push(`<div><dt>Decline Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(po.vendorDeclineReason || "—")}</dd></div>`);
    }
    if (po.status === "Cancelled" && po.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(po.cancelledAt))} by ${escapeHtml(ERP_PurchaseOrderRepository.actorLabel(po.cancelledByUsername))}</dd></div>`);
    if (po.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(po.notes)}</dd></div>`);

    $("#poDetailBody").innerHTML = rows.join("");
    renderLineItemsTable(po);
    renderDetailFooter(po);
    openModal("poDetailModal");
  }

  function bindDetailModal() {
    $("#poTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const p = ERP_PurchaseOrderRepository.findById(viewBtn.dataset.id);
        if (p) openDetailModal(p);
        return;
      }
      if (actionBtn) {
        const p = ERP_PurchaseOrderRepository.findById(actionBtn.dataset.id);
        if (!p) return;
        if (actionBtn.dataset.action === "submit") requestSubmit(p);
        else if (actionBtn.dataset.action === "revise") requestRevise(p);
        else if (actionBtn.dataset.action === "send") requestSendToVendor(p);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "purchase-order")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading purchase orders…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#poContent").hidden = true;
      $("#poSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#poContent").hidden = false;
      $("#poHeaderActions").hidden = false;
      $("#poSubtitle").textContent = `Managing purchase orders for ${company.name} (${company.companyCode}).`;

      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();

      // Dashboard-style deep-link precedent (?action=add), same as every
      // earlier module.
      if (new URLSearchParams(window.location.search).get("action") === "add") {
        openAddModal();
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
