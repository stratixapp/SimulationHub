/* =============================================================================
   DOT ERP — pages/sales-quotation.js
   Phase 5, Module 2: Quotation

   See data/sales-quotation-data.js's header for the full design rationale
   (line items, inquiry exclusivity, why Declined has no reopen, the
   `-SQ-` naming disambiguation from Phase 4's own Quotation Receipt). This
   file is the UI layer specific decisions on top of that:

   - THE DETAIL MODAL IS THE WORKSPACE, same split as Purchase
     Requisition's own page: Add only creates the HEADER
     (customerInquiryId/customerId/validUntil/notes) — line items are
     added, edited, and removed from inside the Detail modal
     (#sqDetailModal). Two nested modals (#sqFormModal for the header,
     #sqLineItemModal for one line) for the same reason PR has two.
   - CUSTOMER IS NEVER AN INDEPENDENT FIELD — it's a read-only display
     (#sqFormCustomerDisplay) that updates the moment an inquiry is
     picked, never its own dropdown. See data/sales-quotation-data.js's
     header for why `customerId` is always fully derived, like Vendor on
     a PO.
   - SEND VALIDATES TWO THINGS PR's SUBMIT NEVER HAD TO: not just >=1 line
     item, but also a set `validUntil` — a quotation with no expiry isn't
     something a real business sends. Both checks live at the page level,
     same division of responsibility as every earlier gate.
   - MARK DECLINED gets its OWN small modal (#sqDeclineModal) for the same
     "capture free text" reason as Customer Inquiry's Mark Lost — and,
     critically, has NO reopen/revise action anywhere on this page. See
     data/sales-quotation-data.js's header for why that's deliberate.
   - "Link a Catalog Item" on a line PRE-FILLS unitPrice (from the item's
     salePrice) and taxId (from ERP_ItemRepository.getEffectiveTaxCode())
     but never locks either — a real quotation regularly discounts off
     list price.
   - Customer Inquiry's own Detail modal picks up a small addition here
     (see customer-inquiry.js's own diff): a "Linked to Quotation" row,
     resolved live via `ERP_SalesQuotationRepository.findQuotationForInquiry()`,
     which is why customer-inquiry.html now also loads
     `../data/sales-quotation-data.js`.
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
  let editingId = null;   // quotation header being created/edited in #sqFormModal
  let detailId = null;    // quotation currently open in #sqDetailModal
  let editingLineId = null; // line item being edited in #sqLineItemModal (null = adding)
  let decliningId = null; // the quotation awaiting a reason in #sqDeclineModal


  /* -----------------------------------------------------------------------
     BADGE COLOR MAPPING
     Draft/Cancelled -> neutral, Sent -> warning (awaiting the customer's
     response), Accepted -> success, Declined -> danger.
     --------------------------------------------------------------------- */
  function statusBadgeClass(status) {
    if (status === "Accepted") return "success";
    if (status === "Declined") return "danger";
    if (status === "Sent") return "warning";
    return "neutral"; // Draft, Cancelled
  }

  /** Draft -> Send. Sent/Accepted/Declined/Cancelled get NO row
      quick-action — Accept/Decline/Withdraw/Cancel/Delete all live inside
      the Detail modal, since (unlike Department Need's single-page full
      lifecycle) this module's terminal decision is an OUTSIDE PARTY's
      call, not a one-click internal approval. */
  function quickActionFor(q) {
    if (q.status === "Draft") return { action: "send", label: "Send" };
    return null;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_SalesQuotationRepository.getAllForCompany(company.id); // newest-first

    if (filterStatus !== "all") rows = rows.filter((q) => q.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((q) => {
        const cust = q.customerId ? ERP_CustomerRepository.findById(q.customerId) : null;
        return q.quotationCode.toLowerCase().includes(term) ||
          (cust && cust.customerName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_SalesQuotationRepository.getAllForCompany(company.id);
    $("#sqSummaryTotal").textContent = String(all.length);
    $("#sqSummaryDraft").textContent = String(all.filter((q) => q.status === "Draft").length);
    $("#sqSummarySent").textContent = String(all.filter((q) => q.status === "Sent").length);
    $("#sqSummaryAccepted").textContent = String(all.filter((q) => q.status === "Accepted").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#sqPagination");
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

    $("#sqEmptyState").hidden = all.length !== 0;
    $("#sqTable").hidden = all.length === 0;

    $("#sqTableBody").innerHTML = pageItems.map((q) => {
      const cust = q.customerId ? ERP_CustomerRepository.findById(q.customerId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(q.status)}">${q.status}</span>`;
      const { total, pricedCount, totalCount } = ERP_SalesQuotationRepository.computeGrandTotal(q);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);
      const validUntil = q.validUntil ? escapeHtml(q.validUntil) : `<span class="profile-subtle">—</span>`;
      const qa = quickActionFor(q);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${q.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(q.quotationCode)}</code></td>
        <td>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${totalCount}</td>
        <td>${totalLabel}</td>
        <td>${validUntil}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${q.id}">View</button>
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
    $$("#sqStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#sqStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#sqSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#sqSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#sqExportCsvBtn").addEventListener("click", exportCsv);
    $("#sqPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Quotation Code", "Customer", "Line Items", "Subtotal", "Tax", "Total", "Valid Until", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((q) => {
      const cust = q.customerId ? ERP_CustomerRepository.findById(q.customerId) : null;
      const { subtotal, taxTotal, total, totalCount } = ERP_SalesQuotationRepository.computeGrandTotal(q);
      const line = [
        q.quotationCode, cust ? cust.customerName : "", totalCount,
        subtotal, taxTotal, total, q.validUntil || "", q.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
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
      const cust = q.customerId ? ERP_CustomerRepository.findById(q.customerId) : null;
      const { total, totalCount } = ERP_SalesQuotationRepository.computeGrandTotal(q);
      return `<tr><td>${escapeHtml(q.quotationCode)}</td><td>${cust ? escapeHtml(cust.customerName) : ""}</td><td>${totalCount}</td><td>${escapeHtml(formatCurrency(total))}</td><td>${escapeHtml(q.validUntil || "")}</td><td>${escapeHtml(q.status)}</td></tr>`;
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
        <table><thead><tr><th>Quotation Code</th><th>Customer</th><th>Lines</th><th>Total</th><th>Valid Until</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Quotation")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#sqActivityEmptyState").hidden = relevant.length !== 0;
    $("#sqActivityList").innerHTML = relevant.map((e) => `
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
     HEADER FORM (#sqFormModal) — creates/edits customerInquiryId (and the
     customerId derived from it) / validUntil / notes only. Line items
     live in the Detail modal (below).
     --------------------------------------------------------------------- */
  function populateInquiryOptions(currentId) {
    let inquiries = ERP_SalesQuotationRepository.getAvailableConvertedInquiriesForCompany(company.id, editingId);
    if (currentId && !inquiries.some((n) => n.id === currentId) && typeof ERP_CustomerInquiryRepository !== "undefined") {
      const current = ERP_CustomerInquiryRepository.findById(currentId);
      if (current) inquiries = inquiries.concat([current]);
    }
    const options = inquiries.map((n) => {
      const cust = ERP_CustomerRepository.findById(n.customerId);
      const desc = n.inquiryDescription.length > 40 ? n.inquiryDescription.slice(0, 40) + "…" : n.inquiryDescription;
      return `<option value="${n.id}">${escapeHtml(n.inquiryCode)} — ${cust ? escapeHtml(cust.customerName) : "?"} — ${escapeHtml(desc)}</option>`;
    }).join("");
    $("#sqFormInquiry").innerHTML = `<option value="">Select a converted inquiry…</option>` + options;
  }

  /** Customer is never an independent field — it's always fully derived
      from whichever inquiry is linked. See file header. */
  function updateCustomerDisplay() {
    const inquiryId = $("#sqFormInquiry").value;
    const display = $("#sqFormCustomerDisplay");
    if (!inquiryId) { display.textContent = "— select an inquiry above —"; return; }
    const inquiry = ERP_CustomerInquiryRepository.findById(inquiryId);
    const cust = inquiry ? ERP_CustomerRepository.findById(inquiry.customerId) : null;
    display.textContent = cust ? `${cust.customerName} (${cust.customerCode})` : "— customer not found —";
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }

  function openAddModal() {
    const anyInquiry = ERP_SalesQuotationRepository.getAvailableConvertedInquiriesForCompany(company.id, null).length > 0;
    if (!anyInquiry) {
      showToast("No available Converted customer inquiries to quote from yet.", "warning");
      return;
    }
    editingId = null;
    $("#sqFormTitle").textContent = "New quotation";
    $("#sqFormIntro").textContent = "Link the Converted customer inquiry this quotation is for — line items get added once it's created.";
    $("#sqFormSaveBtn").textContent = "Create Quotation";
    populateInquiryOptions(null);
    $("#sqFormValidUntil").value = "";
    $("#sqFormNotes").value = "";
    setFormError("sqFormInquiry", "");
    updateCustomerDisplay();
    openModal("sqFormModal");
  }

  function openEditModal(q) {
    if (!ERP_SalesQuotationRepository.canEdit(q)) {
      showToast(`"${q.quotationCode}" is ${q.status} and can't be edited directly. Withdraw it back to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = q.id;
    $("#sqFormTitle").textContent = "Edit quotation header";
    $("#sqFormIntro").textContent = "Update which inquiry this quotation is for and its validity.";
    $("#sqFormSaveBtn").textContent = "Save Changes";
    populateInquiryOptions(q.customerInquiryId);
    $("#sqFormInquiry").value = q.customerInquiryId || "";
    $("#sqFormValidUntil").value = q.validUntil || "";
    $("#sqFormNotes").value = q.notes || "";
    setFormError("sqFormInquiry", "");
    updateCustomerDisplay();
    openModal("sqFormModal");
  }

  function validateForm() {
    let valid = true;
    setFormError("sqFormInquiry", "");
    if (!$("#sqFormInquiry").value) { setFormError("sqFormInquiry", "Select which customer inquiry this quotation is for."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#sqAddBtn").addEventListener("click", openAddModal);
    $("#sqFormInquiry").addEventListener("change", updateCustomerDisplay);

    $("#sqFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const inquiryId = $("#sqFormInquiry").value;
      const inquiry = ERP_CustomerInquiryRepository.findById(inquiryId);
      const payload = {
        customerInquiryId: inquiryId,
        customerId: inquiry ? inquiry.customerId : null,
        validUntil: $("#sqFormValidUntil").value || null,
        notes: $("#sqFormNotes").value.trim()
      };

      const cust = payload.customerId ? ERP_CustomerRepository.findById(payload.customerId) : null;
      const custLabel = cust ? cust.customerName : "this customer";

      if (editingId) {
        openConfirm({
          title: "Save changes to this quotation?",
          message: `This quotation's header details will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_SalesQuotationRepository.update(editingId, payload);
            logSystemActivity({ module: "Quotation", action: "Update", description: `Updated quotation header for ${custLabel} (${company.name})` });
            closeModal("sqFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_SalesQuotationRepository.findById(editingId));
            showToast("Quotation updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this quotation?",
          message: `A new quotation will be created for ${custLabel} as a Draft — you'll add line items next.`,
          confirmLabel: "Create Quotation",
          onConfirm: () => {
            let created = ERP_SalesQuotationRepository.create(company, payload);

            // Seed one starting line from the inquiry's own item/
            // description/quantity, when it has one — convenience only,
            // freely editable/removable afterward like any line. See file
            // header.
            if (inquiry && inquiry.inquiryDescription) {
              const item = inquiry.itemId ? ERP_ItemRepository.findById(inquiry.itemId) : null;
              const effectiveTax = item ? ERP_ItemRepository.getEffectiveTaxCode(item) : null;
              created = ERP_SalesQuotationRepository.addLineItem(created.id, {
                itemId: inquiry.itemId || null,
                lineDescription: inquiry.inquiryDescription,
                quantity: inquiry.estimatedQuantity != null ? inquiry.estimatedQuantity : 1,
                unitPrice: item && item.salePrice != null ? item.salePrice : null,
                taxId: effectiveTax ? effectiveTax.id : null
              });
            }

            logSystemActivity({ module: "Quotation", action: "Create", description: `Created quotation "${created.quotationCode}" for ${custLabel} (${company.name})` });
            closeModal("sqFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.quotationCode}" created as a Draft. Review line items now.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LINE ITEM FORM (#sqLineItemModal)
     --------------------------------------------------------------------- */
  function populateLineItemPicker(currentId) {
    let items = ERP_ItemRepository.getActiveForCompany(company.id);
    if (currentId && !items.some((i) => i.id === currentId)) {
      const current = ERP_ItemRepository.findById(currentId);
      if (current) items = items.concat([current]);
    }
    items = items.slice().sort((a, b) => a.itemName.localeCompare(b.itemName));
    $("#sqLineItem").innerHTML = `<option value="">Not linked — describe below</option>` + items.map((i) => `<option value="${i.id}">${escapeHtml(i.itemName)} (${escapeHtml(i.itemCode)})</option>`).join("");
  }

  function populateLineTaxOptions(currentId) {
    let taxes = typeof ERP_TaxRepository !== "undefined" ? ERP_TaxRepository.getActiveForCompany(company.id) : [];
    if (currentId && !taxes.some((t) => t.id === currentId)) {
      const current = ERP_TaxRepository.findById(currentId);
      if (current) taxes = taxes.concat([current]);
    }
    $("#sqLineTax").innerHTML = `<option value="">No tax</option>` + taxes.map((t) => `<option value="${t.id}">${escapeHtml(t.taxName)} (${t.ratePct}%)</option>`).join("");
  }

  /** Linking a catalog item pre-fills unitPrice (from its salePrice) and
      taxId (from its own Item->HSN->Tax effective chain) — both stay
      editable afterward. See file header. */
  function applyItemPrefill(itemId) {
    if (!itemId) return;
    const item = ERP_ItemRepository.findById(itemId);
    if (!item) return;
    if (!$("#sqLineDescription").value.trim()) $("#sqLineDescription").value = item.itemName;
    if (item.salePrice != null) $("#sqLineUnitPrice").value = String(item.salePrice);
    const effectiveTax = ERP_ItemRepository.getEffectiveTaxCode(item);
    if (effectiveTax) $("#sqLineTax").value = effectiveTax.id;
  }

  function checkLineDuplicateHint() {
    const q = ERP_SalesQuotationRepository.findById(detailId);
    if (!q) return;
    const itemId = $("#sqLineItem").value;
    const dup = ERP_SalesQuotationRepository.findDuplicateLineItemByItem(q, itemId, editingLineId);
    const hint = $("#sqLineDuplicateHint");
    if (dup) {
      hint.textContent = `Heads up: this item is already on another line in this quotation ("${dup.lineDescription || "—"}"). Consider combining the quantities into one line instead.`;
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  }

  function setLineFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearLineFormErrors() {
    ["sqLineQuantity", "sqLineDescription", "sqLineUnitPrice"].forEach((f) => setLineFormError(f, ""));
  }

  function openAddLineModal() {
    editingLineId = null;
    $("#sqLineItemTitle").textContent = "Add a line item";
    $("#sqLineItemSaveBtn").textContent = "Add Line Item";
    populateLineItemPicker(null);
    populateLineTaxOptions(null);
    $("#sqLineDescription").value = "";
    $("#sqLineQuantity").value = "";
    $("#sqLineUnitPrice").value = "";
    clearLineFormErrors();
    $("#sqLineDuplicateHint").hidden = true;
    openModal("sqLineItemModal");
  }

  function openEditLineModal(line) {
    editingLineId = line.id;
    $("#sqLineItemTitle").textContent = "Edit line item";
    $("#sqLineItemSaveBtn").textContent = "Save Line Item";
    populateLineItemPicker(line.itemId);
    populateLineTaxOptions(line.taxId);
    $("#sqLineItem").value = line.itemId || "";
    $("#sqLineDescription").value = line.lineDescription || "";
    $("#sqLineQuantity").value = line.quantity != null ? String(line.quantity) : "";
    $("#sqLineUnitPrice").value = line.unitPrice != null ? String(line.unitPrice) : "";
    $("#sqLineTax").value = line.taxId || "";
    clearLineFormErrors();
    $("#sqLineDuplicateHint").hidden = true;
    openModal("sqLineItemModal");
    checkLineDuplicateHint();
  }

  /** Item is optional, but a line needs SOME description — required only
      when no catalog item is linked. UNLIKE Purchase Requisition's
      estimatedUnitPrice, unitPrice here IS required — an unpriced line
      isn't a real quotation line yet. See sales-quotation-data.js's
      header. */
  function validateLineForm() {
    let valid = true;
    clearLineFormErrors();

    const itemId = $("#sqLineItem").value;
    const desc = $("#sqLineDescription").value.trim();
    if (!itemId && !desc) {
      setLineFormError("sqLineDescription", "Describe this line, or link a catalog item above.");
      valid = false;
    }

    const qtyRaw = $("#sqLineQuantity").value;
    if (qtyRaw === "" || isNaN(Number(qtyRaw)) || Number(qtyRaw) <= 0) {
      setLineFormError("sqLineQuantity", "Enter a quantity greater than zero.");
      valid = false;
    }

    const priceRaw = $("#sqLineUnitPrice").value;
    if (priceRaw === "" || isNaN(Number(priceRaw)) || Number(priceRaw) < 0) {
      setLineFormError("sqLineUnitPrice", "Enter a price for this line — every quoted line needs one.");
      valid = false;
    }

    return valid;
  }

  function bindLineItemModal() {
    $("#sqAddLineBtn").addEventListener("click", openAddLineModal);
    $("#sqLineItem").addEventListener("change", (e) => { applyItemPrefill(e.target.value); checkLineDuplicateHint(); });

    $("#sqLineItemSaveBtn").addEventListener("click", () => {
      if (!validateLineForm()) return;
      const payload = {
        itemId: $("#sqLineItem").value || null,
        lineDescription: $("#sqLineDescription").value.trim(),
        quantity: Number($("#sqLineQuantity").value),
        unitPrice: Number($("#sqLineUnitPrice").value),
        taxId: $("#sqLineTax").value || null
      };

      if (editingLineId) {
        ERP_SalesQuotationRepository.updateLineItem(detailId, editingLineId, payload);
        logSystemActivity({ module: "Quotation", action: "Update Line", description: `Updated a line item on quotation for ${company.name}` });
      } else {
        ERP_SalesQuotationRepository.addLineItem(detailId, payload);
        logSystemActivity({ module: "Quotation", action: "Add Line", description: `Added a line item to quotation for ${company.name}` });
      }
      closeModal("sqLineItemModal");
      renderAll();
      renderActivity();
      openDetailModal(ERP_SalesQuotationRepository.findById(detailId));
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS — Send/Withdraw/Accept/Decline/Cancel/Delete. No
     reopen/revise for Declined — see file header.
     --------------------------------------------------------------------- */
  function requestSend(q) {
    if (!(q.lineItems || []).length) {
      showToast(`Add at least one line item to "${q.quotationCode}" before sending it.`, "warning");
      return;
    }
    if (!q.validUntil) {
      showToast(`Set a Valid Until date on "${q.quotationCode}" before sending it. Edit the header first.`, "warning");
      return;
    }
    openConfirm({
      title: "Send this quotation?",
      message: `"${q.quotationCode}" will be locked from further edits and marked as sent to the customer.`,
      confirmLabel: "Send",
      onConfirm: () => {
        ERP_SalesQuotationRepository.send(q.id, session.username);
        logSystemActivity({ module: "Quotation", action: "Send", description: `Sent quotation "${q.quotationCode}" (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === q.id) openDetailModal(ERP_SalesQuotationRepository.findById(q.id));
        showToast(`"${q.quotationCode}" sent.`, "success");
      }
    });
  }

  function requestWithdraw(q) {
    openConfirm({
      title: "Withdraw this quotation?",
      message: `"${q.quotationCode}" will move back to Draft so you can edit it again before resending.`,
      confirmLabel: "Withdraw",
      onConfirm: () => {
        ERP_SalesQuotationRepository.withdraw(q.id);
        logSystemActivity({ module: "Quotation", action: "Withdraw", description: `Withdrew quotation "${q.quotationCode}" back to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === q.id) openDetailModal(ERP_SalesQuotationRepository.findById(q.id));
        showToast(`"${q.quotationCode}" moved back to Draft.`, "info");
      }
    });
  }

  function requestMarkAccepted(q) {
    openConfirm({
      title: "Mark this quotation accepted?",
      message: `"${q.quotationCode}" will be marked Accepted and become available for a Sales Order to be built from.`,
      confirmLabel: "Mark Accepted",
      onConfirm: () => {
        ERP_SalesQuotationRepository.markAccepted(q.id, session.username);
        logSystemActivity({ module: "Quotation", action: "Accept", description: `Marked quotation "${q.quotationCode}" Accepted for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === q.id) openDetailModal(ERP_SalesQuotationRepository.findById(q.id));
        showToast(`"${q.quotationCode}" marked Accepted.`, "success");
      }
    });
  }

  function requestMarkDeclined(q) {
    decliningId = q.id;
    $("#sqDeclineReason").value = "";
    $("#sqDeclineReasonError").textContent = "";
    openModal("sqDeclineModal");
  }

  function bindDeclineModal() {
    $("#sqDeclineConfirmBtn").addEventListener("click", () => {
      const reason = $("#sqDeclineReason").value.trim();
      if (!reason) { $("#sqDeclineReasonError").textContent = "A reason is required so the sales team knows why."; return; }
      const q = ERP_SalesQuotationRepository.findById(decliningId);
      if (!q) { closeModal("sqDeclineModal"); return; }
      ERP_SalesQuotationRepository.markDeclined(q.id, session.username, reason);
      logSystemActivity({ module: "Quotation", action: "Decline", description: `Marked quotation "${q.quotationCode}" Declined for ${company.name}: ${reason}`, severity: "warning" });
      closeModal("sqDeclineModal");
      renderAll();
      renderActivity();
      if (detailId === q.id) openDetailModal(ERP_SalesQuotationRepository.findById(q.id));
      showToast(`"${q.quotationCode}" marked Declined.`, "info");
    });
  }

  function requestCancel(q) {
    openConfirm({
      title: "Cancel this quotation?",
      message: `"${q.quotationCode}" will be marked Cancelled and the linked customer inquiry will be freed up for other quotations.`,
      confirmLabel: "Cancel Quotation",
      onConfirm: () => {
        ERP_SalesQuotationRepository.cancel(q.id, session.username);
        logSystemActivity({ module: "Quotation", action: "Cancel", description: `Cancelled quotation "${q.quotationCode}" for ${company.name}`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === q.id) openDetailModal(ERP_SalesQuotationRepository.findById(q.id));
        showToast(`"${q.quotationCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(q) {
    if (!ERP_SalesQuotationRepository.canDelete(q)) {
      showToast(`"${q.quotationCode}" is ${q.status} and can't be deleted while it's still an active workflow record. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this quotation?",
      message: `"${q.quotationCode}" will be permanently removed, along with all its line items. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_SalesQuotationRepository.remove(q.id);
        logSystemActivity({ module: "Quotation", action: "Delete", description: `Deleted quotation "${q.quotationCode}" for ${company.name}`, severity: "warning" });
        if (detailId === q.id) closeModal("sqDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${q.quotationCode}" deleted.`, "info");
      }
    });
  }

  function requestRemoveLine(q, line) {
    openConfirm({
      title: "Remove this line item?",
      message: `This line will be removed from "${q.quotationCode}".`,
      confirmLabel: "Remove Line",
      onConfirm: () => {
        ERP_SalesQuotationRepository.removeLineItem(q.id, line.id);
        logSystemActivity({ module: "Quotation", action: "Remove Line", description: `Removed a line item from quotation "${q.quotationCode}" (${company.name})` });
        renderAll();
        renderActivity();
        openDetailModal(ERP_SalesQuotationRepository.findById(q.id));
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL — header info + live line-items table (with tax) +
     per-status footer. See file header for why this is the workspace.
     --------------------------------------------------------------------- */
  function renderLineItemsTable(q) {
    const lines = q.lineItems || [];
    $("#sqLineEmptyState").hidden = lines.length !== 0;
    $("#sqLineTable").hidden = lines.length === 0;
    const editable = ERP_SalesQuotationRepository.canEdit(q);
    $("#sqAddLineBtn").hidden = !editable;

    $("#sqLineTableBody").innerHTML = lines.map((line) => {
      const item = line.itemId ? ERP_ItemRepository.findById(line.itemId) : null;
      const tax = line.taxId && typeof ERP_TaxRepository !== "undefined" ? ERP_TaxRepository.findById(line.taxId) : null;
      const lineTotal = ERP_SalesQuotationRepository.computeLineTotal(line);
      const lineTax = ERP_SalesQuotationRepository.computeLineTax(line);
      const label = item ? `${escapeHtml(item.itemName)}${line.lineDescription ? " — " + escapeHtml(line.lineDescription) : ""}` : escapeHtml(line.lineDescription || "—");
      const priceLabel = line.unitPrice != null ? escapeHtml(formatCurrency(line.unitPrice)) : `<span class="profile-subtle">—</span>`;
      const taxLabel = tax ? `${escapeHtml(tax.taxName)} (${tax.ratePct}%)` : `<span class="profile-subtle">—</span>`;
      const totalLabel = lineTotal != null ? escapeHtml(formatCurrency(lineTotal + (lineTax || 0))) : `<span class="profile-subtle">—</span>`;
      const actions = editable
        ? `<button type="button" class="link-btn" data-line-edit="${line.id}">Edit</button> <button type="button" class="link-btn" data-line-remove="${line.id}">Remove</button>`
        : "";
      return `<tr><td>${label}</td><td>${escapeHtml(String(line.quantity))}</td><td>${priceLabel}</td><td>${taxLabel}</td><td>${totalLabel}</td><td>${actions}</td></tr>`;
    }).join("");

    const { subtotal, taxTotal, total, pricedCount, totalCount } = ERP_SalesQuotationRepository.computeGrandTotal(q);
    if (totalCount === 0) {
      $("#sqGrandTotalLine").textContent = "";
    } else if (pricedCount === totalCount) {
      $("#sqGrandTotalLine").textContent = `Subtotal: ${formatCurrency(subtotal)} + Tax: ${formatCurrency(taxTotal)} = Total: ${formatCurrency(total)}`;
    } else {
      $("#sqGrandTotalLine").textContent = `~Total so far: ${formatCurrency(total)} (${pricedCount} of ${totalCount} lines priced)`;
    }
  }

  function renderDetailFooter(q) {
    const footer = $("#sqDetailFooter");
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
      addBtn("Edit Header", "btn btn--ghost", () => { closeModal("sqDetailModal"); openEditModal(q); });
      addBtn("Send", "btn btn--primary", () => requestSend(q));
    } else if (q.status === "Sent") {
      addBtn("Withdraw", "btn btn--ghost", () => requestWithdraw(q));
      addBtn("Mark Declined", "btn btn--danger-outline", () => requestMarkDeclined(q));
      addBtn("Mark Accepted", "btn btn--primary", () => requestMarkAccepted(q));
    } else if (q.status === "Accepted") {
      addBtn("Cancel Quotation", "btn btn--danger-outline", () => requestCancel(q));
    } else if (q.status === "Declined") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(q));
    } else if (q.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(q));
    }
  }

  function openDetailModal(q) {
    detailId = q.id;
    const cust = q.customerId ? ERP_CustomerRepository.findById(q.customerId) : null;
    const inquiry = q.customerInquiryId ? ERP_CustomerInquiryRepository.findById(q.customerInquiryId) : null;

    $("#sqDetailTitle").textContent = `${q.quotationCode} · ${q.status}`;

    const rows = [];
    rows.push(`<div><dt>Quotation Code</dt><dd><code>${escapeHtml(q.quotationCode)}</code></dd></div>`);
    rows.push(`<div><dt>Customer</dt><dd>${cust ? escapeHtml(cust.customerName) + " (" + escapeHtml(cust.customerCode) + ")" : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>From Inquiry</dt><dd>${inquiry ? `<code>${escapeHtml(inquiry.inquiryCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Valid Until</dt><dd>${q.validUntil ? escapeHtml(q.validUntil) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(q.status)}">${q.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(q.createdAt))}</dd></div>`);
    if (q.sentAt) rows.push(`<div><dt>Sent</dt><dd>${formatDateTime(new Date(q.sentAt))} by ${escapeHtml(ERP_SalesQuotationRepository.actorLabel(q.sentByUsername))}</dd></div>`);
    if (q.status === "Accepted" && q.acceptedAt) rows.push(`<div><dt>Accepted</dt><dd>${formatDateTime(new Date(q.acceptedAt))} by ${escapeHtml(ERP_SalesQuotationRepository.actorLabel(q.acceptedByUsername))}</dd></div>`);
    if (q.status === "Declined" && q.declinedAt) {
      rows.push(`<div><dt>Declined</dt><dd>${formatDateTime(new Date(q.declinedAt))} by ${escapeHtml(ERP_SalesQuotationRepository.actorLabel(q.declinedByUsername))}</dd></div>`);
      rows.push(`<div><dt>Decline Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(q.declineReason || "—")}</dd></div>`);
    }
    if (q.status === "Cancelled" && q.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(q.cancelledAt))} by ${escapeHtml(ERP_SalesQuotationRepository.actorLabel(q.cancelledByUsername))}</dd></div>`);
    if (typeof ERP_SalesOrderRepository !== "undefined") {
      const linkedSalesOrder = ERP_SalesOrderRepository.findSalesOrderForQuotation(company.id, q.id);
      if (linkedSalesOrder) {
        const soBadgeClass = linkedSalesOrder.status === "Approved" ? "success" : linkedSalesOrder.status === "Rejected" ? "danger" : linkedSalesOrder.status === "Submitted" ? "warning" : "neutral";
        rows.push(`<div><dt>Linked to Sales Order</dt><dd><code>${escapeHtml(linkedSalesOrder.salesOrderCode)}</code> <span class="status-badge status-badge--${soBadgeClass}">${escapeHtml(linkedSalesOrder.status)}</span></dd></div>`);
      }
    }
    if (q.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(q.notes)}</dd></div>`);

    $("#sqDetailBody").innerHTML = rows.join("");
    renderLineItemsTable(q);
    renderDetailFooter(q);
    openModal("sqDetailModal");
  }

  function bindDetailModal() {
    $("#sqTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const q = ERP_SalesQuotationRepository.findById(viewBtn.dataset.id);
        if (q) openDetailModal(q);
        return;
      }
      if (actionBtn) {
        const q = ERP_SalesQuotationRepository.findById(actionBtn.dataset.id);
        if (!q) return;
        if (actionBtn.dataset.action === "send") requestSend(q);
      }
    });

    $("#sqLineTableBody").addEventListener("click", (e) => {
      const q = ERP_SalesQuotationRepository.findById(detailId);
      if (!q) return;
      const editBtn = e.target.closest("[data-line-edit]");
      const removeBtn = e.target.closest("[data-line-remove]");
      if (editBtn) {
        const line = (q.lineItems || []).find((l) => l.id === editBtn.dataset.lineEdit);
        if (line) openEditLineModal(line);
      } else if (removeBtn) {
        const line = (q.lineItems || []).find((l) => l.id === removeBtn.dataset.lineRemove);
        if (line) requestRemoveLine(q, line);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "sales-quotation")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading quotations…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#noAnchorState").hidden = true;
      $("#sqContent").hidden = true;
      $("#sqSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#sqSubtitle").textContent = `Managing quotations for ${company.name} (${company.companyCode}).`;

      // Existing (non-Cancelled) quotations should still be viewable even
      // if no NEW one could be created right now — so the anchor check
      // only blocks when there's truly nothing here AND nothing available
      // to build a first one from, rather than hiding a populated list
      // just because the well has temporarily run dry.
      const anyExisting = ERP_SalesQuotationRepository.getAllForCompany(company.id).length > 0;
      const anyAvailable = ERP_SalesQuotationRepository.getAvailableConvertedInquiriesForCompany(company.id, null).length > 0;

      if (!anyExisting && !anyAvailable) {
        $("#noAnchorState").hidden = false;
        $("#sqContent").hidden = true;
        $("#sqHeaderActions").hidden = true;
      } else {
        $("#noAnchorState").hidden = true;
        $("#sqContent").hidden = false;
        $("#sqHeaderActions").hidden = false;
        renderAll();
        renderActivity();
        bindToolbar();
        bindFormModal();
        bindLineItemModal();
        bindDetailModal();
        bindDeclineModal();

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
