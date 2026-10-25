/* =============================================================================
   DOT ERP — pages/invoice-verification.js
   Phase 4, Module 16: Invoice Verification

   See data/invoice-verification-data.js's header for the full design
   rationale (built from a PO not a receipt chain, manually-entered lines
   with no pre-fill, the lightweight two-way match vs the real Three-Way
   Matching decision one module later). UI-layer decisions on top of
   that:

   - THE FORM'S LINE TABLE SHOWS THE PO'S OWN QTY/PRICE AS PLAIN
     REFERENCE TEXT ALONGSIDE two BLANK inputs for what the invoice
     actually says. This is the one form this session where a column
     exists purely for the human to compare against while typing,
     not to feed the payload.
   - THE MATCH COLUMN is rendered from `computeMatchSummary()`, called
     fresh every time — never stored, since it depends on the PO's
     current line data and would go stale if computed once and cached.
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
    if (status === "Verified") return "success";
    if (status === "Cancelled") return "neutral";
    return "warning"; // Draft
  }

  function quickActionFor(v) {
    if (v.status === "Draft") return { action: "verify", label: "Verify" };
    return null;
  }

  /** po -> quotation -> RFQ -> PR, resolving a line's description. */
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
    let rows = ERP_InvoiceVerificationRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((v) => v.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((v) => {
        const po = v.linkedPoId ? ERP_PurchaseOrderRepository.findById(v.linkedPoId) : null;
        return v.verificationCode.toLowerCase().includes(term) ||
          (v.vendorInvoiceNumber || "").toLowerCase().includes(term) ||
          (po && po.poCode.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_InvoiceVerificationRepository.getAllForCompany(company.id);
    $("#ivSummaryTotal").textContent = String(all.length);
    $("#ivSummaryDraft").textContent = String(all.filter((v) => v.status === "Draft").length);
    $("#ivSummaryVerified").textContent = String(all.filter((v) => v.status === "Verified").length);
    $("#ivSummaryCancelled").textContent = String(all.filter((v) => v.status === "Cancelled").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#ivPagination");
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

    $("#ivEmptyState").hidden = all.length !== 0;
    $("#ivTable").hidden = all.length === 0;

    $("#ivTableBody").innerHTML = pageItems.map((v) => {
      const po = v.linkedPoId ? ERP_PurchaseOrderRepository.findById(v.linkedPoId) : null;
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(v.status)}">${v.status}</span>`;
      const { total, pricedCount, totalCount } = ERP_InvoiceVerificationRepository.computeGrandTotal(v);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);
      const { matched, mismatched } = ERP_InvoiceVerificationRepository.computeMatchSummary(v);
      const matchCell = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (mismatched === 0
            ? `<span class="status-badge status-badge--success">Matches PO</span>`
            : `<span class="status-badge status-badge--warning">${mismatched} mismatch${mismatched === 1 ? "" : "es"}</span>`);
      const qa = quickActionFor(v);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${v.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(v.verificationCode)}</code></td>
        <td>${v.vendorInvoiceNumber ? escapeHtml(v.vendorInvoiceNumber) : `<span class="profile-subtle">—</span>`}</td>
        <td>${po ? `<code>${escapeHtml(po.poCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${totalLabel}</td>
        <td>${matchCell}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${v.id}">View</button>
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
    $$("#ivStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#ivStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#ivSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#ivSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#ivExportCsvBtn").addEventListener("click", exportCsv);
    $("#ivPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Verification Code", "Vendor Invoice #", "PO Code", "Vendor", "Invoice Total", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((v) => {
      const po = v.linkedPoId ? ERP_PurchaseOrderRepository.findById(v.linkedPoId) : null;
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const { total } = ERP_InvoiceVerificationRepository.computeGrandTotal(v);
      const line = [
        v.verificationCode, v.vendorInvoiceNumber || "", po ? po.poCode : "", vendor ? vendor.vendorName : "", total, v.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-invoice-verifications-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Invoice verifications exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((v) => {
      const { total } = ERP_InvoiceVerificationRepository.computeGrandTotal(v);
      return `<tr><td>${escapeHtml(v.verificationCode)}</td><td>${escapeHtml(v.vendorInvoiceNumber || "")}</td><td>${escapeHtml(formatCurrency(total))}</td><td>${escapeHtml(v.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Invoice Verification Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Invoice Verification Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Verification Code</th><th>Invoice #</th><th>Total</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Invoice Verification")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#ivActivityEmptyState").hidden = relevant.length !== 0;
    $("#ivActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#ivFormModal)
     --------------------------------------------------------------------- */
  function populatePoOptions(currentId) {
    let pos = ERP_InvoiceVerificationRepository.getAvailablePosForCompany(company.id, editingId);
    if (currentId && !pos.some((p) => p.id === currentId)) {
      const current = ERP_PurchaseOrderRepository.findById(currentId);
      if (current) pos = pos.concat([current]);
    }
    $("#ivFormSchedule").innerHTML = pos.map((po) => {
      const vendor = ERP_VendorRepository.findById(po.vendorId);
      const label = `${po.poCode} — ${vendor ? vendor.vendorName : "Unknown vendor"}`;
      return `<option value="${po.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderPoInfo(po) {
    const box = $("#ivFormScheduleInfo");
    if (!po) { box.textContent = ""; return; }
    const vendor = ERP_VendorRepository.findById(po.vendorId);
    box.textContent = `Vendor: ${vendor ? vendor.vendorName : "Removed"} — PO status: ${po.status}.`;
  }

  function taxOptionsHtml(selectedId) {
    const taxes = typeof ERP_TaxRepository !== "undefined" ? ERP_TaxRepository.getActiveForCompany(company.id) : [];
    return `<option value="">Not captured</option>` +
      taxes.map((t) => `<option value="${t.id}" ${t.id === selectedId ? "selected" : ""}>${escapeHtml(t.taxName)} (${t.ratePct}%)</option>`).join("");
  }

  function renderFormLineTable(po, existingLines) {
    const poLines = po ? (po.lineItems || []) : [];
    const existingByLine = {};
    (existingLines || []).forEach((l) => { existingByLine[l.prLineItemId] = l; });

    if (!poLines.length) {
      $("#ivFormLineTableBody").innerHTML = `<tr><td colspan="5"><span class="profile-subtle">Pick a purchase order to load its line items.</span></td></tr>`;
      updateFormTotalsHint();
      return;
    }
    const prLineById = {};
    getSourceLinesForPo(po).forEach((l) => { prLineById[l.id] = l; });
    $("#ivFormLineTableBody").innerHTML = poLines.map((line) => {
      const prLine = prLineById[line.prLineItemId];
      const item = prLine && prLine.itemId ? ERP_ItemRepository.findById(prLine.itemId) : null;
      const label = item
        ? `${escapeHtml(item.itemName)}${prLine.lineDescription ? " — " + escapeHtml(prLine.lineDescription) : ""}`
        : escapeHtml((prLine && prLine.lineDescription) || "—");
      const existing = existingByLine[line.prLineItemId];
      const invoicedQty = existing ? existing.invoicedQuantity : "";
      const invoicedPrice = existing ? existing.invoicedUnitPrice : "";
      const invoicedTaxId = existing ? existing.invoicedTaxId : "";
      const poRefLabel = `${line.quantity} @ ${line.unitPrice != null ? formatCurrency(line.unitPrice) : "—"}`;
      return `
      <tr>
        <td>${label}</td>
        <td><span class="profile-subtle">${escapeHtml(poRefLabel)}</span></td>
        <td><div class="input-wrap"><input type="number" class="iv-line-qty" data-line-id="${line.prLineItemId}" min="0" step="1" value="${invoicedQty}" placeholder="Qty billed" /></div></td>
        <td><div class="input-wrap"><input type="number" class="iv-line-price" data-line-id="${line.prLineItemId}" min="0" step="0.01" value="${invoicedPrice}" placeholder="Price billed" /></div></td>
        <td><select class="select-field iv-line-tax" data-line-id="${line.prLineItemId}">${taxOptionsHtml(invoicedTaxId)}</select></td>
      </tr>`;
    }).join("");
    $$(".iv-line-qty, .iv-line-price, .iv-line-tax").forEach((el) => {
      el.addEventListener("input", updateFormTotalsHint);
      el.addEventListener("change", updateFormTotalsHint);
    });
    updateFormTotalsHint();
  }

  /** A live preview so a Draft's own tax entry isn't a black box until
      Save — the same "what's shown before saving matches what's
      computed" discipline Finished Goods Receipt's own cost preview
      established. */
  function updateFormTotalsHint() {
    const totals = ERP_InvoiceVerificationRepository.computeGrandTotal({ invoiceLines: collectInvoiceLines() });
    if (!totals.pricedCount) { $("#ivFormTotalsHint").textContent = ""; return; }
    $("#ivFormTotalsHint").textContent =
      `Taxable value ${formatCurrency(totals.subtotal)} · Tax ${formatCurrency(totals.taxTotal)} · Total owed ${formatCurrency(totals.total)}`;
  }

  function collectInvoiceLines() {
    return $$(".iv-line-qty").map((qtyInput) => {
      const lineId = qtyInput.dataset.lineId;
      const priceInput = document.querySelector(`.iv-line-price[data-line-id="${lineId}"]`);
      const taxInput = document.querySelector(`.iv-line-tax[data-line-id="${lineId}"]`);
      return {
        prLineItemId: lineId,
        invoicedQuantity: qtyInput.value === "" ? 0 : Number(qtyInput.value),
        invoicedUnitPrice: !priceInput || priceInput.value === "" ? null : Number(priceInput.value),
        invoicedTaxId: taxInput && taxInput.value ? taxInput.value : null
      };
    });
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("ivFormSchedule", ""); }

  function openAddModal() {
    const available = ERP_InvoiceVerificationRepository.getAvailablePosForCompany(company.id, null);
    if (!available.length) {
      showToast("No purchase orders are currently available to log an invoice against.", "warning");
      return;
    }
    editingId = null;
    $("#ivFormTitle").textContent = "New invoice verification";
    $("#ivFormIntro").textContent = "Pick the purchase order this invoice is billing against, then enter what the vendor's invoice actually says — not what was ordered.";
    $("#ivFormSaveBtn").textContent = "Create Invoice Verification";
    populatePoOptions(null);
    const firstPo = ERP_PurchaseOrderRepository.findById($("#ivFormSchedule").value);
    renderPoInfo(firstPo);
    renderFormLineTable(firstPo, []);
    $("#ivFormInvoiceNumber").value = "";
    $("#ivFormInvoiceDate").value = "";
    $("#ivFormNotes").value = "";
    clearFormErrors();
    openModal("ivFormModal");
  }

  function openEditModal(v) {
    if (!ERP_InvoiceVerificationRepository.canEdit(v)) {
      showToast(`"${v.verificationCode}" is ${v.status} and can't be edited directly. Reopen it to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = v.id;
    $("#ivFormTitle").textContent = "Edit invoice verification";
    $("#ivFormIntro").textContent = "Update which purchase order this invoice bills against, or correct the invoiced quantities/prices.";
    $("#ivFormSaveBtn").textContent = "Save Changes";
    populatePoOptions(v.linkedPoId);
    $("#ivFormSchedule").value = v.linkedPoId || "";
    const po = ERP_PurchaseOrderRepository.findById(v.linkedPoId);
    renderPoInfo(po);
    renderFormLineTable(po, v.invoiceLines);
    $("#ivFormInvoiceNumber").value = v.vendorInvoiceNumber || "";
    $("#ivFormInvoiceDate").value = v.invoiceDate || "";
    $("#ivFormNotes").value = v.notes || "";
    clearFormErrors();
    openModal("ivFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#ivFormSchedule").value) { setFormError("ivFormSchedule", "Select the purchase order this invoice bills against."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#ivAddBtn").addEventListener("click", openAddModal);

    $("#ivFormSchedule").addEventListener("change", (e) => {
      const po = ERP_PurchaseOrderRepository.findById(e.target.value);
      renderPoInfo(po);
      renderFormLineTable(po, []);
    });

    $("#ivFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const po = ERP_PurchaseOrderRepository.findById($("#ivFormSchedule").value);
      const payload = {
        linkedPoId: $("#ivFormSchedule").value,
        vendorInvoiceNumber: $("#ivFormInvoiceNumber").value.trim(),
        invoiceDate: $("#ivFormInvoiceDate").value || null,
        invoiceLines: collectInvoiceLines(),
        notes: $("#ivFormNotes").value.trim()
      };

      const label = po ? po.poCode : "this order";

      if (editingId) {
        openConfirm({
          title: "Save changes to this invoice verification?",
          message: `This invoice verification for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_InvoiceVerificationRepository.update(editingId, payload);
            logSystemActivity({ module: "Invoice Verification", action: "Update", description: `Updated invoice verification for ${label} (${company.name})` });
            closeModal("ivFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_InvoiceVerificationRepository.findById(editingId));
            showToast("Invoice verification updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this invoice verification?",
          message: `A new invoice verification will be created as a Draft for ${label}.`,
          confirmLabel: "Create Invoice Verification",
          onConfirm: () => {
            const created = ERP_InvoiceVerificationRepository.create(company, payload);
            logSystemActivity({ module: "Invoice Verification", action: "Create", description: `Created invoice verification "${created.verificationCode}" for ${label} (${company.name})` });
            closeModal("ivFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.verificationCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestVerify(v) {
    openConfirm({
      title: "Mark this invoice verified?",
      message: `"${v.verificationCode}" will be marked Verified — treat this as an accurate record of what the vendor billed.`,
      confirmLabel: "Verify",
      onConfirm: () => {
        ERP_InvoiceVerificationRepository.verify(v.id, session.username);
        logSystemActivity({ module: "Invoice Verification", action: "Verify", description: `Verified invoice "${v.verificationCode}" (${company.name})` });

        if (typeof ERP_GlPostingRepository !== "undefined") {
          const glResult = ERP_GlPostingRepository.postInvoiceVerification(company, ERP_InvoiceVerificationRepository.findById(v.id), session.username);
          if (glResult.success) {
            logSystemActivity({ module: "Invoice Verification", action: "Auto-Post", description: `Auto-posted journal entry ${glResult.entry.entryNumber} for invoice "${v.verificationCode}" (${company.name})` });
            showToast(`Posted to the General Ledger as ${glResult.entry.entryNumber}.`, "info", { title: "Journal Entry created" });
          } else {
            showToast(glResult.reason, "warning", { title: "Not posted to the books" });
          }
        }

        renderAll();
        renderActivity();
        if (detailId === v.id) openDetailModal(ERP_InvoiceVerificationRepository.findById(v.id));
        showToast(`"${v.verificationCode}" verified.`, "success");
      }
    });
  }

  function requestReopen(v) {
    openConfirm({
      title: "Reopen this invoice verification?",
      message: `"${v.verificationCode}" will move back to Draft so you can correct it.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_InvoiceVerificationRepository.reopen(v.id);
        logSystemActivity({ module: "Invoice Verification", action: "Reopen", description: `Reopened invoice verification "${v.verificationCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === v.id) openDetailModal(ERP_InvoiceVerificationRepository.findById(v.id));
        showToast(`"${v.verificationCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(v) {
    openConfirm({
      title: "Cancel this invoice verification?",
      message: `"${v.verificationCode}" will be marked Cancelled and its purchase order freed up for a different invoice.`,
      confirmLabel: "Cancel Verification",
      onConfirm: () => {
        ERP_InvoiceVerificationRepository.cancel(v.id, session.username);
        logSystemActivity({ module: "Invoice Verification", action: "Cancel", description: `Cancelled invoice verification "${v.verificationCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === v.id) openDetailModal(ERP_InvoiceVerificationRepository.findById(v.id));
        showToast(`"${v.verificationCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(v) {
    if (!ERP_InvoiceVerificationRepository.canDelete(v)) {
      showToast(`"${v.verificationCode}" is ${v.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this invoice verification?",
      message: `"${v.verificationCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_InvoiceVerificationRepository.remove(v.id);
        logSystemActivity({ module: "Invoice Verification", action: "Delete", description: `Deleted invoice verification "${v.verificationCode}" (${company.name})`, severity: "warning" });
        if (detailId === v.id) closeModal("ivDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${v.verificationCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderLineItemsTable(v) {
    const po = ERP_PurchaseOrderRepository.findById(v.linkedPoId);
    const prLineById = {};
    getSourceLinesForPo(po).forEach((l) => { prLineById[l.id] = l; });
    const { lines: matchLines } = ERP_InvoiceVerificationRepository.computeMatchSummary(v);
    const matchByLine = {};
    matchLines.forEach((m) => { matchByLine[m.prLineItemId] = m; });

    const lines = v.invoiceLines || [];
    $("#ivLineTableBody").innerHTML = lines.length
      ? lines.map((line) => {
          const prLine = prLineById[line.prLineItemId];
          const item = prLine && prLine.itemId ? ERP_ItemRepository.findById(prLine.itemId) : null;
          const label = item
            ? `${escapeHtml(item.itemName)}${prLine.lineDescription ? " — " + escapeHtml(prLine.lineDescription) : ""}`
            : escapeHtml((prLine && prLine.lineDescription) || "—");
          const value = ERP_InvoiceVerificationRepository.computeLineValue(line);
          const lineTax = ERP_InvoiceVerificationRepository.computeLineTax(line);
          const priceLabel = line.invoicedUnitPrice != null ? escapeHtml(formatCurrency(line.invoicedUnitPrice)) : `<span class="profile-subtle">—</span>`;
          const taxLabel = line.invoicedTaxId
            ? escapeHtml(formatCurrency(lineTax))
            : `<span class="profile-subtle">Not captured</span>`;
          const valueLabel = value != null ? escapeHtml(formatCurrency(value)) : `<span class="profile-subtle">—</span>`;
          const m = matchByLine[line.prLineItemId];
          const matchCell = m && m.isMatch
            ? `<span class="status-badge status-badge--success">Matches</span>`
            : `<span class="status-badge status-badge--warning">Mismatch</span>`;
          return `<tr><td>${label}</td><td>${escapeHtml(String(line.invoicedQuantity))}</td><td>${priceLabel}</td><td>${taxLabel}</td><td>${valueLabel}</td><td>${matchCell}</td></tr>`;
        }).join("")
      : `<tr><td colspan="6"><span class="profile-subtle">This invoice has no lines.</span></td></tr>`;

    const { subtotal, taxTotal, total, pricedCount, totalCount } = ERP_InvoiceVerificationRepository.computeGrandTotal(v);
    const { matched, mismatched } = ERP_InvoiceVerificationRepository.computeMatchSummary(v);
    if (totalCount === 0) {
      $("#ivGrandTotalLine").textContent = "";
    } else {
      const partial = pricedCount !== totalCount;
      const prefix = partial ? "~" : "";
      const taxNote = taxTotal > 0 ? ` (taxable ${formatCurrency(subtotal)} + tax ${formatCurrency(taxTotal)})` : "";
      const suffix = partial ? ` (${pricedCount} of ${totalCount} lines priced)` : "";
      $("#ivGrandTotalLine").textContent = `Invoice total: ${prefix}${formatCurrency(total)}${taxNote}${suffix} — ${matched} matched, ${mismatched} mismatched vs the PO.`;
    }
  }

  function renderDetailFooter(v) {
    const footer = $("#ivDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (v.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(v));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("ivDetailModal"); openEditModal(v); });
      addBtn("Verify", "btn btn--primary", () => requestVerify(v));
    } else if (v.status === "Verified") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(v));
      addBtn("Reopen to Draft", "btn btn--ghost", () => requestReopen(v));
    } else if (v.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(v));
    }
  }

  function openDetailModal(v) {
    detailId = v.id;
    const po = ERP_PurchaseOrderRepository.findById(v.linkedPoId);
    const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;

    $("#ivDetailTitle").textContent = `${v.verificationCode} · ${v.status}`;

    const rows = [];
    rows.push(`<div><dt>Verification Code</dt><dd><code>${escapeHtml(v.verificationCode)}</code></dd></div>`);
    rows.push(`<div><dt>Purchase Order</dt><dd>${po ? `<code>${escapeHtml(po.poCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor Invoice #</dt><dd>${v.vendorInvoiceNumber ? escapeHtml(v.vendorInvoiceNumber) : "—"}</dd></div>`);
    rows.push(`<div><dt>Invoice Date</dt><dd>${v.invoiceDate ? escapeHtml(v.invoiceDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(v.status)}">${v.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(v.createdAt))}</dd></div>`);
    if (v.verifiedAt) rows.push(`<div><dt>Verified</dt><dd>${formatDateTime(new Date(v.verifiedAt))} by ${escapeHtml(ERP_InvoiceVerificationRepository.actorLabel(v.verifiedByUsername))}</dd></div>`);
    if (typeof ERP_ThreeWayMatchingRepository !== "undefined") {
      const linkedMatch = ERP_ThreeWayMatchingRepository.findMatchForInvoice(company.id, v.id);
      if (linkedMatch) {
        const matchBadgeClass = linkedMatch.status === "Approved for Payment" ? "success" : linkedMatch.status === "On Hold" ? "danger" : linkedMatch.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Three-Way Match</dt><dd><code>${escapeHtml(linkedMatch.matchCode)}</code> <span class="status-badge status-badge--${matchBadgeClass}">${escapeHtml(linkedMatch.status)}</span></dd></div>`);
      } else if (v.status === "Verified") {
        rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Ready to match — see <strong>Three-Way Matching</strong>.</dd></div>`);
      }
    }
    if (v.status === "Cancelled" && v.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(v.cancelledAt))} by ${escapeHtml(ERP_InvoiceVerificationRepository.actorLabel(v.cancelledByUsername))}</dd></div>`);
    // RETROFIT (Phase 15, Module 03b): a verification, like an invoice
    // on the Sales side, is NOT exclusive over its own Debit Note —
    // several notes can accumulate over time — so this is the AGGREGATE
    // shape, mirroring Credit Note's own retrofit into Tax Invoice.
    if (typeof ERP_DebitNoteRepository !== "undefined") {
      const notes = ERP_DebitNoteRepository.getAllForVerification(company.id, v.id);
      if (notes.length) {
        const latest = notes[0];
        const debited = ERP_DebitNoteRepository.getDebitedAmountForVerification(company.id, v.id, null);
        const remaining = ERP_DebitNoteRepository.getRemainingDebitableForVerification(company.id, v, null);
        const noteBadgeClass = latest.status === "Debited" ? "success" : latest.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Debit Notes</dt><dd>${notes.length} raised · ${formatCurrency(debited)} debited · ${formatCurrency(remaining)} still debitable · most recent <span class="status-badge status-badge--${noteBadgeClass}">${escapeHtml(latest.status)}</span></dd></div>`);
      }
    }
    if (v.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(v.notes)}</dd></div>`);

    $("#ivDetailBody").innerHTML = rows.join("");
    renderLineItemsTable(v);
    renderDetailFooter(v);
    openModal("ivDetailModal");
  }

  function bindDetailModal() {
    $("#ivTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const v = ERP_InvoiceVerificationRepository.findById(viewBtn.dataset.id);
        if (v) openDetailModal(v);
        return;
      }
      if (actionBtn) {
        const v = ERP_InvoiceVerificationRepository.findById(actionBtn.dataset.id);
        if (!v) return;
        if (actionBtn.dataset.action === "verify") requestVerify(v);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "invoice-verification")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading invoice verifications…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#ivContent").hidden = true;
      $("#ivSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#ivContent").hidden = false;
      $("#ivHeaderActions").hidden = false;
      $("#ivSubtitle").textContent = `Logging invoices for ${company.name} (${company.companyCode}).`;

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
