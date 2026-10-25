/* =============================================================================
   DOT ERP — pages/sales-order.js
   Phase 5, Module 3: Sales Order

   See data/sales-order-data.js's header for the full design rationale
   (PR's 5-state shape rather than PO's 8-state one, frozen copied line
   items, the credit-check hook Customer Master was already built for).
   This file is the UI layer specific decisions on top of that:

   - THE DETAIL MODAL SHOWS LINE ITEMS BUT NEVER EDITS THEM. Unlike
     Purchase Requisition's own Detail modal (a genuine workspace with an
     Add/Edit/Remove line-item flow), this one only ever DISPLAYS the
     frozen copy — no #soLineItemModal exists at all here. The header form
     (#soFormModal) is still where Add happens, but "Add" here means
     "link an Accepted Quotation" instead of "set up an empty header for
     the line items to come."
   - CUSTOMER IS NEVER AN INDEPENDENT FIELD, same as Quotation's own
     header form — a read-only display (#soFormCustomerDisplay) that
     updates the moment a quotation is picked, alongside a live credit
     hint pulled straight from `ERP_CustomerRepository.getCreditUsage()`/
     `getCreditUtilizationBand()`. See data/sales-order-data.js's header
     for why this file doesn't duplicate that logic itself.
   - SUBMIT VALIDATES A SET deliveryDate, the same page-level division of
     responsibility as every earlier gate in this codebase.
   - NO Approve/Reject ANYWHERE on this page — not even reserved buttons
     that do nothing. Submitted's Detail-modal footer only offers
     Withdraw, with an explicit "Next Step" note pointing at Order
     Approval, the same shape PR's own Submitted state used to point at
     PR Approval.
   - Quotation's own Detail modal picks up a small addition here (see
     sales-quotation.js's own diff): a "Linked to Sales Order" row,
     resolved live via `ERP_SalesOrderRepository.findSalesOrderForQuotation()`,
     which is why sales-quotation.html now also loads
     `../data/sales-order-data.js`.
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
  let editingId = null;   // sales order header being created/edited in #soFormModal
  let detailId = null;    // sales order currently open in #soDetailModal


  /* -----------------------------------------------------------------------
     BADGE COLOR MAPPING — identical to Department Need's/PR's, same
     5-status vocabulary.
     --------------------------------------------------------------------- */
  function statusBadgeClass(status) {
    if (status === "Approved") return "success";
    if (status === "Rejected") return "danger";
    if (status === "Submitted") return "warning";
    return "neutral"; // Draft, Cancelled
  }

  /** Draft -> Submit, Rejected -> Revise. Submitted/Approved/Cancelled get
      NO row quick-action here — see file header. */
  function quickActionFor(so) {
    if (so.status === "Draft") return { action: "submit", label: "Submit" };
    if (so.status === "Rejected") return { action: "revise", label: "Revise" };
    return null;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_SalesOrderRepository.getAllForCompany(company.id); // newest-first

    if (filterStatus !== "all") rows = rows.filter((so) => so.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((so) => {
        const cust = so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
        return so.salesOrderCode.toLowerCase().includes(term) ||
          (cust && cust.customerName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_SalesOrderRepository.getAllForCompany(company.id);
    $("#soSummaryTotal").textContent = String(all.length);
    $("#soSummaryDraft").textContent = String(all.filter((so) => so.status === "Draft").length);
    $("#soSummarySubmitted").textContent = String(all.filter((so) => so.status === "Submitted").length);
    $("#soSummaryApproved").textContent = String(all.filter((so) => so.status === "Approved").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#soPagination");
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

    $("#soEmptyState").hidden = all.length !== 0;
    $("#soTable").hidden = all.length === 0;

    $("#soTableBody").innerHTML = pageItems.map((so) => {
      const cust = so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(so.status)}">${so.status}</span>`;
      const { total, pricedCount, totalCount } = ERP_SalesOrderRepository.computeGrandTotal(so);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);
      const deliveryDate = so.deliveryDate ? escapeHtml(so.deliveryDate) : `<span class="profile-subtle">—</span>`;
      const qa = quickActionFor(so);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${so.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(so.salesOrderCode)}</code></td>
        <td>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${totalCount}</td>
        <td>${totalLabel}</td>
        <td>${deliveryDate}</td>
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
    $$("#soStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#soStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#soSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#soSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#soExportCsvBtn").addEventListener("click", exportCsv);
    $("#soPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Sales Order Code", "Customer", "Line Items", "Subtotal", "Tax", "Total", "Delivery Date", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((so) => {
      const cust = so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
      const { subtotal, taxTotal, total, totalCount } = ERP_SalesOrderRepository.computeGrandTotal(so);
      const line = [
        so.salesOrderCode, cust ? cust.customerName : "", totalCount,
        subtotal, taxTotal, total, so.deliveryDate || "", so.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-sales-orders-${company.companyCode}.csv`;
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
      return `<tr><td>${escapeHtml(so.salesOrderCode)}</td><td>${cust ? escapeHtml(cust.customerName) : ""}</td><td>${totalCount}</td><td>${escapeHtml(formatCurrency(total))}</td><td>${escapeHtml(so.deliveryDate || "")}</td><td>${escapeHtml(so.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Sales Order Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Sales Order Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Sales Order Code</th><th>Customer</th><th>Lines</th><th>Total</th><th>Delivery Date</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Sales Order")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#soActivityEmptyState").hidden = relevant.length !== 0;
    $("#soActivityList").innerHTML = relevant.map((e) => `
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
     HEADER FORM (#soFormModal) — Add creates quotationId/customerId (from
     the picked quotation) + deliveryDate/notes. Edit can ONLY touch
     deliveryDate/notes — quotationId is locked once created, since the
     line items were copied from it at that moment and would go stale if
     it changed later. See file header.
     --------------------------------------------------------------------- */
  function populateQuotationOptions() {
    const quotations = ERP_SalesOrderRepository.getAvailableAcceptedQuotationsForCompany(company.id, null);
    const options = quotations.map((q) => {
      const cust = ERP_CustomerRepository.findById(q.customerId);
      const { total } = ERP_SalesQuotationRepository.computeGrandTotal(q);
      return `<option value="${q.id}">${escapeHtml(q.quotationCode)} — ${cust ? escapeHtml(cust.customerName) : "?"} — ${escapeHtml(formatCurrency(total))}</option>`;
    }).join("");
    $("#soFormQuotation").innerHTML = `<option value="">Select an accepted quotation…</option>` + options;
  }

  /** Shows the resolved customer name plus a live credit-utilization hint
      straight from Customer Master's own getCreditUsage()/
      getCreditUtilizationBand() — see sales-order-data.js's header for
      why this file doesn't reimplement that logic. */
  function updateCustomerAndCreditDisplay(customerId) {
    const display = $("#soFormCustomerDisplay");
    const hint = $("#soFormCreditHint");
    if (!customerId) { display.textContent = "— select a quotation above —"; hint.hidden = true; return; }
    const cust = ERP_CustomerRepository.findById(customerId);
    if (!cust) { display.textContent = "— customer not found —"; hint.hidden = true; return; }
    display.textContent = `${cust.customerName} (${cust.customerCode})`;
    const { available, utilizationPct } = ERP_CustomerRepository.getCreditUsage(cust);
    const band = ERP_CustomerRepository.getCreditUtilizationBand(cust);
    hint.hidden = false;
    hint.classList.toggle("field-hint--warning", band !== "under");
    const pctLabel = isFinite(utilizationPct) ? `${utilizationPct.toFixed(0)}%` : "over limit with no credit set";
    if (band === "over") {
      hint.textContent = `Credit: ${pctLabel} utilized — this customer is already over their approved limit.`;
    } else if (band === "near") {
      hint.textContent = `Credit: ${pctLabel} utilized — approaching their limit (${formatCurrency(available)} available).`;
    } else {
      hint.textContent = `Credit: ${pctLabel} utilized, ${formatCurrency(available)} available.`;
    }
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }

  function openAddModal() {
    const anyAvailable = ERP_SalesOrderRepository.getAvailableAcceptedQuotationsForCompany(company.id, null).length > 0;
    if (!anyAvailable) {
      showToast("No available Accepted quotations from an Active customer to order from yet.", "warning");
      return;
    }
    editingId = null;
    $("#soFormTitle").textContent = "New sales order";
    $("#soFormIntro").textContent = "Link the Accepted quotation this order is for — its line items copy over exactly as accepted.";
    $("#soFormSaveBtn").textContent = "Create Sales Order";
    $("#soFormQuotationField").hidden = false;
    populateQuotationOptions();
    $("#soFormQuotation").value = "";
    $("#soFormDeliveryDate").value = "";
    $("#soFormNotes").value = "";
    setFormError("soFormQuotation", "");
    updateCustomerAndCreditDisplay(null);
    openModal("soFormModal");
  }

  function openEditModal(so) {
    if (!ERP_SalesOrderRepository.canEdit(so)) {
      showToast(`"${so.salesOrderCode}" is ${so.status} and can't be edited directly. Withdraw or revise it back to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = so.id;
    $("#soFormTitle").textContent = "Edit sales order header";
    $("#soFormIntro").textContent = "Update the delivery date and notes — the linked quotation and its line items are locked once created.";
    $("#soFormSaveBtn").textContent = "Save Changes";
    $("#soFormQuotationField").hidden = true;
    $("#soFormDeliveryDate").value = so.deliveryDate || "";
    $("#soFormNotes").value = so.notes || "";
    setFormError("soFormQuotation", "");
    updateCustomerAndCreditDisplay(so.customerId);
    openModal("soFormModal");
  }

  function validateForm() {
    let valid = true;
    setFormError("soFormQuotation", "");
    if (!editingId && !$("#soFormQuotation").value) {
      setFormError("soFormQuotation", "Select which accepted quotation this order is for.");
      valid = false;
    }
    return valid;
  }

  function bindFormModal() {
    $("#soAddBtn").addEventListener("click", openAddModal);
    $("#soFormQuotation").addEventListener("change", (e) => {
      const quotation = e.target.value ? ERP_SalesQuotationRepository.findById(e.target.value) : null;
      updateCustomerAndCreditDisplay(quotation ? quotation.customerId : null);
    });

    $("#soFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      if (editingId) {
        const payload = {
          deliveryDate: $("#soFormDeliveryDate").value || null,
          notes: $("#soFormNotes").value.trim()
        };
        openConfirm({
          title: "Save changes to this sales order?",
          message: `This sales order's header details will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_SalesOrderRepository.update(editingId, payload);
            logSystemActivity({ module: "Sales Order", action: "Update", description: `Updated sales order header for ${company.name}` });
            closeModal("soFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_SalesOrderRepository.findById(editingId));
            showToast("Sales order updated.", "success");
          }
        });
      } else {
        const quotationId = $("#soFormQuotation").value;
        const quotation = ERP_SalesQuotationRepository.findById(quotationId);
        const cust = quotation ? ERP_CustomerRepository.findById(quotation.customerId) : null;
        const custLabel = cust ? cust.customerName : "this customer";
        const payload = {
          deliveryDate: $("#soFormDeliveryDate").value || null,
          notes: $("#soFormNotes").value.trim()
        };

        openConfirm({
          title: "Create this sales order?",
          message: `A new sales order will be created for ${custLabel} as a Draft, with line items copied from "${quotation ? quotation.quotationCode : "the quotation"}".`,
          confirmLabel: "Create Sales Order",
          onConfirm: () => {
            const created = ERP_SalesOrderRepository.create(company, quotation, payload);
            logSystemActivity({ module: "Sales Order", action: "Create", description: `Created sales order "${created.salesOrderCode}" for ${custLabel} (${company.name})` });
            closeModal("soFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.salesOrderCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS — Submit/Withdraw/Cancel/Revise/Delete only. No
     Approve/Reject on this page — see file header.
     --------------------------------------------------------------------- */
  function requestSubmit(so) {
    if (!so.deliveryDate) {
      showToast(`Set a Delivery Date on "${so.salesOrderCode}" before submitting it. Edit the header first.`, "warning");
      return;
    }
    openConfirm({
      title: "Submit this sales order for approval?",
      message: `"${so.salesOrderCode}" will be locked from further edits and sent into the approval queue.`,
      confirmLabel: "Submit for Approval",
      onConfirm: () => {
        ERP_SalesOrderRepository.submit(so.id, session.username);
        logSystemActivity({ module: "Sales Order", action: "Submit", description: `Submitted sales order "${so.salesOrderCode}" for approval (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === so.id) openDetailModal(ERP_SalesOrderRepository.findById(so.id));
        showToast(`"${so.salesOrderCode}" submitted for approval.`, "success");
      }
    });
  }

  function requestWithdraw(so) {
    openConfirm({
      title: "Withdraw this sales order?",
      message: `"${so.salesOrderCode}" will move back to Draft so you can edit its header again before resubmitting.`,
      confirmLabel: "Withdraw",
      onConfirm: () => {
        ERP_SalesOrderRepository.withdraw(so.id);
        logSystemActivity({ module: "Sales Order", action: "Withdraw", description: `Withdrew sales order "${so.salesOrderCode}" back to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === so.id) openDetailModal(ERP_SalesOrderRepository.findById(so.id));
        showToast(`"${so.salesOrderCode}" moved back to Draft.`, "info");
      }
    });
  }

  function requestRevise(so) {
    openConfirm({
      title: "Revise this sales order?",
      message: `"${so.salesOrderCode}" will move back to Draft so you can update its header and resubmit.`,
      confirmLabel: "Revise",
      onConfirm: () => {
        ERP_SalesOrderRepository.reopen(so.id);
        logSystemActivity({ module: "Sales Order", action: "Revise", description: `Reopened rejected sales order "${so.salesOrderCode}" to Draft for revision (${company.name})` });
        if (detailId === so.id) closeModal("soDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${so.salesOrderCode}" is back in Draft — update and resubmit when ready.`, "info");
      }
    });
  }

  function requestCancel(so) {
    openConfirm({
      title: "Cancel this sales order?",
      message: `"${so.salesOrderCode}" will be marked Cancelled and the linked quotation will be freed up for another sales order.`,
      confirmLabel: "Cancel Sales Order",
      onConfirm: () => {
        ERP_SalesOrderRepository.cancel(so.id, session.username);
        logSystemActivity({ module: "Sales Order", action: "Cancel", description: `Cancelled sales order "${so.salesOrderCode}" for ${company.name}`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === so.id) openDetailModal(ERP_SalesOrderRepository.findById(so.id));
        showToast(`"${so.salesOrderCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(so) {
    if (!ERP_SalesOrderRepository.canDelete(so)) {
      showToast(`"${so.salesOrderCode}" is ${so.status} and can't be deleted while it's still an active workflow record. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this sales order?",
      message: `"${so.salesOrderCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_SalesOrderRepository.remove(so.id);
        logSystemActivity({ module: "Sales Order", action: "Delete", description: `Deleted sales order "${so.salesOrderCode}" for ${company.name}`, severity: "warning" });
        if (detailId === so.id) closeModal("soDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${so.salesOrderCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL — header info + a READ-ONLY line-items table (frozen
     copy from the accepted quotation) + per-status footer. See file
     header for why nothing here is ever editable.
     --------------------------------------------------------------------- */
  function renderLineItemsTable(so) {
    const lines = so.lineItems || [];
    $("#soLineEmptyState").hidden = lines.length !== 0;
    $("#soLineTable").hidden = lines.length === 0;

    $("#soLineTableBody").innerHTML = lines.map((line) => {
      const tax = line.taxId && typeof ERP_TaxRepository !== "undefined" ? ERP_TaxRepository.findById(line.taxId) : null;
      const lineTotal = ERP_SalesOrderRepository.computeLineTotal(line);
      const lineTax = ERP_SalesOrderRepository.computeLineTax(line);
      const priceLabel = line.unitPrice != null ? escapeHtml(formatCurrency(line.unitPrice)) : `<span class="profile-subtle">—</span>`;
      const taxLabel = tax ? `${escapeHtml(tax.taxName)} (${tax.ratePct}%)` : `<span class="profile-subtle">—</span>`;
      const totalLabel = lineTotal != null ? escapeHtml(formatCurrency(lineTotal + (lineTax || 0))) : `<span class="profile-subtle">—</span>`;
      return `<tr><td>${escapeHtml(line.lineDescription || "—")}</td><td>${escapeHtml(String(line.quantity))}</td><td>${priceLabel}</td><td>${taxLabel}</td><td>${totalLabel}</td></tr>`;
    }).join("");

    const { subtotal, taxTotal, total, totalCount } = ERP_SalesOrderRepository.computeGrandTotal(so);
    $("#soGrandTotalLine").textContent = totalCount === 0
      ? ""
      : `Subtotal: ${formatCurrency(subtotal)} + Tax: ${formatCurrency(taxTotal)} = Total: ${formatCurrency(total)}`;
  }

  function renderDetailFooter(so) {
    const footer = $("#soDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (so.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(so));
      addBtn("Edit Header", "btn btn--ghost", () => { closeModal("soDetailModal"); openEditModal(so); });
      addBtn("Submit for Approval", "btn btn--primary", () => requestSubmit(so));
    } else if (so.status === "Submitted") {
      addBtn("Withdraw", "btn btn--ghost", () => requestWithdraw(so));
    } else if (so.status === "Approved") {
      addBtn("Cancel Sales Order", "btn btn--danger-outline", () => requestCancel(so));
    } else if (so.status === "Rejected") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(so));
      addBtn("Revise & Resubmit", "btn btn--primary", () => requestRevise(so));
    } else if (so.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(so));
    }
  }

  function openDetailModal(so) {
    detailId = so.id;
    const cust = so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
    const quotation = so.quotationId ? ERP_SalesQuotationRepository.findById(so.quotationId) : null;

    $("#soDetailTitle").textContent = `${so.salesOrderCode} · ${so.status}`;

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
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(so.createdAt))}</dd></div>`);
    if (so.submittedAt) rows.push(`<div><dt>Submitted</dt><dd>${formatDateTime(new Date(so.submittedAt))} by ${escapeHtml(ERP_SalesOrderRepository.actorLabel(so.submittedByUsername))}</dd></div>`);
    if (so.status === "Submitted") rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Awaiting a decision in <strong>Order Approval</strong> — see the Order Approval module in the sidebar.</dd></div>`);
    if (so.status === "Approved" && so.approvedAt) rows.push(`<div><dt>Approved</dt><dd>${formatDateTime(new Date(so.approvedAt))} by ${escapeHtml(ERP_SalesOrderRepository.actorLabel(so.approvedByUsername))}</dd></div>`);
    if (so.status === "Rejected" && so.rejectedAt) {
      rows.push(`<div><dt>Rejected</dt><dd>${formatDateTime(new Date(so.rejectedAt))} by ${escapeHtml(ERP_SalesOrderRepository.actorLabel(so.rejectedByUsername))}</dd></div>`);
      rows.push(`<div><dt>Rejection Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(so.rejectionReason || "—")}</dd></div>`);
    }
    if (so.status === "Cancelled" && so.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(so.cancelledAt))} by ${escapeHtml(ERP_SalesOrderRepository.actorLabel(so.cancelledByUsername))}</dd></div>`);
    if (typeof ERP_DeliveryChallanRepository !== "undefined") {
      const linkedChallan = ERP_DeliveryChallanRepository.findChallanForSalesOrder(company.id, so.id);
      if (linkedChallan) {
        const dcBadgeClass = linkedChallan.status === "Issued" ? "success" : linkedChallan.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Delivery Challan</dt><dd><code>${escapeHtml(linkedChallan.challanCode)}</code> <span class="status-badge status-badge--${dcBadgeClass}">${escapeHtml(linkedChallan.status)}</span></dd></div>`);
      } else if (so.status === "Approved") {
        rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Ready for shipment — see <strong>Delivery Challan</strong>.</dd></div>`);
      }
    }
    // RETROFIT (Phase 5, Module 10 — THE FINAL MODULE): Sales Close reads
    // FROM this sales order directly, exclusively, the same way Purchase
    // Closure read from the PO on the Procurement side. A genuine single
    // "Linked to X" row, the last retrofit this whole project adds.
    if (typeof ERP_SalesCloseRepository !== "undefined") {
      const linkedClosure = ERP_SalesCloseRepository.findClosureForSalesOrder(company.id, so.id);
      if (linkedClosure) {
        const scBadgeClass = linkedClosure.status === "Closed" ? "success" : linkedClosure.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Sales Close</dt><dd><code>${escapeHtml(linkedClosure.closureCode)}</code> <span class="status-badge status-badge--${scBadgeClass}">${escapeHtml(linkedClosure.status)}</span></dd></div>`);
      }
    }
    if (so.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(so.notes)}</dd></div>`);

    $("#soDetailBody").innerHTML = rows.join("");
    renderLineItemsTable(so);
    renderDetailFooter(so);
    openModal("soDetailModal");
  }

  function bindDetailModal() {
    $("#soTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const so = ERP_SalesOrderRepository.findById(viewBtn.dataset.id);
        if (so) openDetailModal(so);
        return;
      }
      if (actionBtn) {
        const so = ERP_SalesOrderRepository.findById(actionBtn.dataset.id);
        if (!so) return;
        if (actionBtn.dataset.action === "submit") requestSubmit(so);
        else if (actionBtn.dataset.action === "revise") requestRevise(so);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "sales-order")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading sales orders…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#noAnchorState").hidden = true;
      $("#soContent").hidden = true;
      $("#soSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#soSubtitle").textContent = `Managing sales orders for ${company.name} (${company.companyCode}).`;

      // Existing (non-Cancelled) sales orders should still be viewable
      // even if no NEW one could be created right now — mirrors
      // Quotation's own reasoning for the same anchor check shape.
      const anyExisting = ERP_SalesOrderRepository.getAllForCompany(company.id).length > 0;
      const anyAvailable = ERP_SalesOrderRepository.getAvailableAcceptedQuotationsForCompany(company.id, null).length > 0;

      if (!anyExisting && !anyAvailable) {
        $("#noAnchorState").hidden = false;
        $("#soContent").hidden = true;
        $("#soHeaderActions").hidden = true;
      } else {
        $("#noAnchorState").hidden = true;
        $("#soContent").hidden = false;
        $("#soHeaderActions").hidden = false;
        renderAll();
        renderActivity();
        bindToolbar();
        bindFormModal();
        bindDetailModal();

        // Dashboard-style deep-link precedent (?action=add), same as
        // Department Need/Employees/Items.
        if (new URLSearchParams(window.location.search).get("action") === "add") {
          openAddModal();
        }
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
