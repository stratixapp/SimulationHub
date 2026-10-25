/* =============================================================================
   DOT ERP — pages/credit-note.js
   Phase 15, Module 02: Credit Note

   The one page in this project whose form changes shape based on a
   choice made inside it: picking "Goods Return" shows a Sales Return
   picker and a read-only, derived line table; picking "Price
   Adjustment" shows an invoice picker and a table with one typed amount
   per line. Both paths converge on the same totals block and the same
   over-credit guard, so nothing downstream has to care which was used.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity, actorLabel
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let filterStatus = "all";
  let searchTerm = "";
  let page = 1;

  let formType = "Goods Return";
  let selectedReturn = null;
  let selectedInvoice = null;
  let draftLines = [];
  let editingId = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function itemLabel(id) { const i = id && typeof ERP_ItemRepository !== "undefined" ? ERP_ItemRepository.findById(id) : null; return i ? i.itemName : "Unknown item"; }
  function customerLabel(id) { const c = id ? ERP_CustomerRepository.findById(id) : null; return c ? c.customerName : "Unknown customer"; }
  function invoiceLabel(id) { const i = id ? ERP_TaxInvoiceRepository.findById(id) : null; return i ? i.invoiceCode : "Unknown invoice"; }
  function returnLabel(id) { const r = id && typeof ERP_SalesReturnRepository !== "undefined" ? ERP_SalesReturnRepository.findById(id) : null; return r ? r.returnCode : "—"; }

  function statusBadge(status) {
    const tone = status === "Credited" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }
  function typeBadge(type) {
    return `<span class="status-badge status-badge--${type === "Goods Return" ? "info" : "neutral"}">${escapeHtml(type)}</span>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY / LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_CreditNoteRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((n) => n.status === filterStatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((n) =>
        (n.noteCode || "").toLowerCase().includes(q) ||
        invoiceLabel(n.linkedInvoiceId).toLowerCase().includes(q) ||
        customerLabel(n.customerId).toLowerCase().includes(q)
      );
    }
    const btn = $("#cnSortBtn");
    if (btn && btn.dataset.order === "asc") rows = [...rows].reverse();
    return rows;
  }

  function renderSummary() {
    const all = ERP_CreditNoteRepository.getAllForCompany(company.id);
    $("#cnSummaryTotal").textContent = String(all.length);
    $("#cnSummaryDraft").textContent = String(all.filter((n) => n.status === "Draft").length);
    $("#cnSummaryCredited").textContent = String(all.filter((n) => n.status === "Credited").length);
    const value = all
      .filter((n) => n.status === "Credited")
      .reduce((s, n) => s + ERP_CreditNoteRepository.computeGrandTotal(n).total, 0);
    $("#cnSummaryValue").textContent = formatMoney(value);
  }

  function renderPagination(totalPages) {
    const container = $("#cnPagination");
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

    $("#cnEmptyState").hidden = all.length !== 0;
    $("#cnTable").hidden = all.length === 0;

    $("#cnTableBody").innerHTML = pageItems.map((n) => `
      <tr>
        <td><code>${escapeHtml(n.noteCode)}</code></td>
        <td>${typeBadge(n.noteType)}</td>
        <td>${escapeHtml(invoiceLabel(n.linkedInvoiceId))}</td>
        <td>${escapeHtml(customerLabel(n.customerId))}</td>
        <td class="text-right">${formatMoney(ERP_CreditNoteRepository.computeGrandTotal(n).total)}</td>
        <td>${n.noteDate || "—"}</td>
        <td>${statusBadge(n.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${n.id}">View</button></td>
      </tr>`).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#cnStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#cnStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value.trim();
      page = 1;
      renderTable();
    });
    $("#cnSortBtn").addEventListener("click", () => {
      const btn = $("#cnSortBtn");
      const asc = btn.dataset.order === "asc";
      btn.dataset.order = asc ? "desc" : "asc";
      btn.textContent = asc ? "Newest First" : "Oldest First";
      renderTable();
    });
    $("#cnExportCsvBtn").addEventListener("click", exportCsv);
    $("#cnPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Note Code", "Type", "Against Invoice", "Sales Return", "Customer", "Subtotal", "Tax", "Total", "Reason", "Note Date", "Status"];
    const lines = [header.join(",")];
    rows.forEach((n) => {
      const t = ERP_CreditNoteRepository.computeGrandTotal(n);
      lines.push([
        n.noteCode, n.noteType,
        invoiceLabel(n.linkedInvoiceId),
        returnLabel(n.linkedReturnId),
        `"${customerLabel(n.customerId)}"`,
        t.subtotal.toFixed(2), t.taxTotal.toFixed(2), t.total.toFixed(2),
        `"${n.reason || ""}"`, n.noteDate || "", n.status
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `credit-notes-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Credit Note")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#cnActivityEmptyState").hidden = relevant.length !== 0;
    $("#cnActivityList").innerHTML = relevant.map((e) => `
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
     FORM MODAL
     --------------------------------------------------------------------- */
  function populateTypeOptions(selected) {
    $("#cnFormType").innerHTML = ERP_CreditNoteRepository.noteTypes
      .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
    if (selected) $("#cnFormType").value = selected;
  }

  function populateReasonOptions(selected) {
    $("#cnFormReason").innerHTML = ERP_CreditNoteRepository.reasons
      .map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
    if (selected) $("#cnFormReason").value = selected;
  }

  function populateReturnOptions(selectedId) {
    const returns = ERP_CreditNoteRepository.getAvailableReturnsForCompany(company.id, editingId);
    const select = $("#cnFormReturn");
    const options = returns.map((r) =>
      `<option value="${r.id}">${escapeHtml(r.returnCode)} — ${escapeHtml(customerLabel(r.customerId))} (${escapeHtml(invoiceLabel(r.linkedInvoiceId))})</option>`
    );
    if (selectedId && !returns.some((r) => r.id === selectedId)) {
      const r = ERP_SalesReturnRepository.findById(selectedId);
      if (r) options.unshift(`<option value="${r.id}">${escapeHtml(r.returnCode)} — ${escapeHtml(customerLabel(r.customerId))}</option>`);
    }
    select.innerHTML = `<option value="">Select a posted sales return…</option>` + options.join("");
    if (selectedId) select.value = selectedId;
  }

  function populateInvoiceOptions(selectedId) {
    const invoices = ERP_CreditNoteRepository.getCreditableInvoicesForCompany(company.id, editingId);
    const select = $("#cnFormInvoice");
    const options = invoices.map((inv) =>
      `<option value="${inv.id}">${escapeHtml(inv.invoiceCode)} — ${escapeHtml(customerLabel(inv.customerId))}</option>`
    );
    if (selectedId && !invoices.some((i) => i.id === selectedId)) {
      const inv = ERP_TaxInvoiceRepository.findById(selectedId);
      if (inv) options.unshift(`<option value="${inv.id}">${escapeHtml(inv.invoiceCode)} — ${escapeHtml(customerLabel(inv.customerId))}</option>`);
    }
    select.innerHTML = `<option value="">Select an invoice…</option>` + options.join("");
    if (selectedId) select.value = selectedId;
  }

  /** The form's own shape-switch — see file header. */
  function applyTypeToForm() {
    const isGoods = formType === "Goods Return";
    $("#cnFormReturnField").hidden = !isGoods;
    $("#cnFormInvoiceField").hidden = isGoods;
    $("#cnFormLinesHead").innerHTML = isGoods
      ? `<th>Line</th><th>Qty Returned</th><th>Rate</th><th>Tax</th><th>Line Credit</th>`
      : `<th>Line</th><th>Originally Billed</th><th>Tax</th><th>Credit Amount</th>`;
    $("#cnFormLinesHint").textContent = isGoods
      ? "Lines are derived from the sales return and priced from the original invoice — nothing here is typed."
      : "Nothing physically came back, so there's no quantity — type the amount being credited on each line.";
  }

  function onTypeChanged() {
    formType = $("#cnFormType").value;
    selectedReturn = null;
    selectedInvoice = null;
    draftLines = [];
    populateReasonOptions(formType === "Goods Return"
      ? ERP_CreditNoteRepository.reasons[0]
      : ERP_CreditNoteRepository.reasons[1]);
    if (formType === "Goods Return") populateReturnOptions(null); else populateInvoiceOptions(null);
    applyTypeToForm();
    $("#cnFormParentInfo").textContent = "";
    $("#cnFormReturnError").textContent = "";
    $("#cnFormInvoiceError").textContent = "";
    renderFormLines();
  }

  function onReturnPicked() {
    const id = $("#cnFormReturn").value;
    selectedReturn = id ? ERP_SalesReturnRepository.findById(id) : null;
    selectedInvoice = selectedReturn ? ERP_TaxInvoiceRepository.findById(selectedReturn.linkedInvoiceId) : null;
    $("#cnFormReturnError").textContent = "";
    if (!selectedReturn || !selectedInvoice) {
      draftLines = [];
      $("#cnFormParentInfo").textContent = selectedReturn ? "The invoice this return was raised against no longer exists." : "";
      renderFormLines();
      return;
    }
    draftLines = ERP_CreditNoteRepository.buildLinesFromReturn(selectedReturn, selectedInvoice);
    updateParentInfo();
    renderFormLines();
  }

  function onInvoicePicked() {
    const id = $("#cnFormInvoice").value;
    selectedInvoice = id ? ERP_TaxInvoiceRepository.findById(id) : null;
    selectedReturn = null;
    $("#cnFormInvoiceError").textContent = "";
    if (!selectedInvoice) {
      draftLines = [];
      $("#cnFormParentInfo").textContent = "";
      renderFormLines();
      return;
    }
    draftLines = ERP_CreditNoteRepository.buildLinesFromInvoice(selectedInvoice);
    updateParentInfo();
    renderFormLines();
  }

  function updateParentInfo() {
    if (!selectedInvoice) { $("#cnFormParentInfo").textContent = ""; return; }
    const invTotal = ERP_TaxInvoiceRepository.computeGrandTotal(selectedInvoice).total;
    const remaining = ERP_CreditNoteRepository.getRemainingCreditableForInvoice(company.id, selectedInvoice, editingId);
    $("#cnFormParentInfo").textContent =
      `Customer: ${customerLabel(selectedInvoice.customerId)} · Invoice ${selectedInvoice.invoiceCode} total ${formatMoney(invTotal)} · still creditable ${formatMoney(remaining)}`;
  }

  function renderFormLines() {
    const body = $("#cnFormLinesBody");
    if (!draftLines.length) {
      body.innerHTML = "";
      $("#cnFormLinesEmpty").hidden = false;
      updateTotals();
      return;
    }
    $("#cnFormLinesEmpty").hidden = true;

    if (formType === "Goods Return") {
      body.innerHTML = draftLines.map((l) => {
        const total = ERP_CreditNoteRepository.computeLineTotal(l);
        const tax = ERP_CreditNoteRepository.computeLineTax(l);
        return `
          <tr>
            <td>${escapeHtml(l.lineDescription || itemLabel(l.itemId))}</td>
            <td class="text-right">${formatQty(l.quantity)}</td>
            <td class="text-right">${l.unitPrice != null ? formatMoney(l.unitPrice) : "—"}</td>
            <td class="text-right">${tax != null ? formatMoney(tax) : "—"}</td>
            <td class="text-right">${total != null ? formatMoney(total) : "—"}</td>
          </tr>`;
      }).join("");
    } else {
      body.innerHTML = draftLines.map((l) => {
        const tax = ERP_CreditNoteRepository.computeLineTax(l);
        return `
          <tr data-line-id="${l.id}">
            <td>${escapeHtml(l.lineDescription || itemLabel(l.itemId))}</td>
            <td class="text-right">${formatMoney(l.originalLineValue)}</td>
            <td class="text-right">${tax != null ? formatMoney(tax) : "—"}</td>
            <td class="text-right">
              <input type="number" class="cn-line-amount" data-line-id="${l.id}"
                     min="0" step="0.01" value="${l.creditAmount || 0}" />
            </td>
          </tr>`;
      }).join("");
    }
    updateTotals();
  }

  function updateTotals() {
    const totals = ERP_CreditNoteRepository.computeGrandTotal({ creditLines: draftLines });
    $("#cnFormSubtotal").textContent = formatMoney(totals.subtotal);
    $("#cnFormTax").textContent = formatMoney(totals.taxTotal);
    $("#cnFormTotal").textContent = formatMoney(totals.total);

    if (selectedInvoice) {
      const remaining = ERP_CreditNoteRepository.getRemainingCreditableForInvoice(company.id, selectedInvoice, editingId);
      const over = Math.round(totals.total * 100) / 100 > remaining;
      $("#cnFormRemaining").textContent = over
        ? `Over the limit — only ${formatMoney(remaining)} is still creditable against this invoice.`
        : `${formatMoney(remaining)} still creditable against this invoice.`;
      $("#cnFormRemaining").className = over ? "field-error" : "field-hint";
    } else {
      $("#cnFormRemaining").textContent = "";
      $("#cnFormRemaining").className = "field-hint";
    }
  }

  function openAddModal() {
    editingId = null;
    formType = "Goods Return";
    selectedReturn = null;
    selectedInvoice = null;
    draftLines = [];

    const returns = ERP_CreditNoteRepository.getAvailableReturnsForCompany(company.id, null);
    const invoices = ERP_CreditNoteRepository.getCreditableInvoicesForCompany(company.id, null);
    if (!returns.length && !invoices.length) {
      showToast("Nothing to credit yet — post a sales return, or raise an invoice with value left to credit.", "warning");
      return;
    }
    // Open on whichever type actually has something available, rather
    // than always defaulting to Goods Return and showing an empty picker.
    if (!returns.length) formType = "Price Adjustment";

    $("#cnFormTitle").textContent = "New credit note";
    $("#cnFormIntro").textContent = "A credit note reduces what a customer owes. Pick why you're raising it — the rest of the form follows from that.";
    $("#cnFormSaveBtn").textContent = "Create Credit Note";
    populateTypeOptions(formType);
    $("#cnFormType").disabled = false;
    populateReasonOptions(formType === "Goods Return" ? ERP_CreditNoteRepository.reasons[0] : ERP_CreditNoteRepository.reasons[1]);
    if (formType === "Goods Return") populateReturnOptions(null); else populateInvoiceOptions(null);
    applyTypeToForm();
    $("#cnFormNoteDate").value = new Date().toISOString().slice(0, 10);
    $("#cnFormNotes").value = "";
    $("#cnFormReturnError").textContent = "";
    $("#cnFormInvoiceError").textContent = "";
    $("#cnFormLinesError").textContent = "";
    $("#cnFormParentInfo").textContent = "";
    renderFormLines();
    openModal("cnFormModal");
  }

  function openEditModal(note) {
    editingId = note.id;
    formType = note.noteType;
    selectedInvoice = ERP_TaxInvoiceRepository.findById(note.linkedInvoiceId);
    selectedReturn = note.linkedReturnId && typeof ERP_SalesReturnRepository !== "undefined"
      ? ERP_SalesReturnRepository.findById(note.linkedReturnId) : null;
    if (!selectedInvoice) { showToast("The linked invoice no longer exists.", "danger"); return; }

    draftLines = (note.creditLines || []).map((l) => ({ ...l }));

    $("#cnFormTitle").textContent = `Edit credit note — ${note.noteCode}`;
    $("#cnFormIntro").textContent = ERP_CreditNoteRepository.canEditLines(note)
      ? "Only a Draft can be edited, and the document it credits is fixed."
      : "A Goods Return note's lines are derived and never editable — only the header fields below can change.";
    $("#cnFormSaveBtn").textContent = "Save Changes";
    populateTypeOptions(note.noteType);
    // Type and parent both stay locked in Edit mode — changing either
    // would invalidate every line. Same treatment Delivery Challan and
    // Tax Invoice give their own parent pickers.
    $("#cnFormType").disabled = true;
    populateReasonOptions(note.reason);
    populateReturnOptions(note.linkedReturnId);
    populateInvoiceOptions(note.linkedInvoiceId);
    $("#cnFormReturn").disabled = true;
    $("#cnFormInvoice").disabled = true;
    applyTypeToForm();
    $("#cnFormNoteDate").value = note.noteDate || "";
    $("#cnFormNotes").value = note.notes || "";
    $("#cnFormReturnError").textContent = "";
    $("#cnFormInvoiceError").textContent = "";
    $("#cnFormLinesError").textContent = "";
    updateParentInfo();
    renderFormLines();
    closeModal("cnDetailModal");
    openModal("cnFormModal");
  }

  function validateForm() {
    let valid = true;
    $("#cnFormReturnError").textContent = "";
    $("#cnFormInvoiceError").textContent = "";
    $("#cnFormLinesError").textContent = "";

    if (formType === "Goods Return" && !selectedReturn) {
      $("#cnFormReturnError").textContent = "Pick the posted sales return this note credits.";
      valid = false;
    }
    if (formType === "Price Adjustment" && !selectedInvoice) {
      $("#cnFormInvoiceError").textContent = "Pick the invoice being adjusted.";
      valid = false;
    }
    if (selectedInvoice) {
      const check = ERP_CreditNoteRepository.validateNote(
        company.id, selectedInvoice, { creditLines: draftLines }, editingId
      );
      if (!check.ok) { $("#cnFormLinesError").textContent = check.errors[0]; valid = false; }
    }
    return valid;
  }

  function bindFormModal() {
    $("#cnAddBtn").addEventListener("click", openAddModal);
    $("#cnFormType").addEventListener("change", onTypeChanged);
    $("#cnFormReturn").addEventListener("change", onReturnPicked);
    $("#cnFormInvoice").addEventListener("change", onInvoicePicked);

    // Delegated at tbody level — no per-row listeners to rebind on every
    // re-render (Journal Entry's own established pattern).
    $("#cnFormLinesBody").addEventListener("input", (e) => {
      const input = e.target.closest(".cn-line-amount");
      if (!input) return;
      const line = draftLines.find((l) => l.id === input.dataset.lineId);
      if (!line) return;
      line.creditAmount = Number(input.value) || 0;
      updateTotals();
    });

    $("#cnFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const payload = {
        noteDate: $("#cnFormNoteDate").value || new Date().toISOString().slice(0, 10),
        reason: $("#cnFormReason").value,
        notes: $("#cnFormNotes").value.trim(),
        creditLines: draftLines
      };
      if (editingId) {
        const updated = ERP_CreditNoteRepository.update(editingId, payload);
        if (!updated) { showToast("Couldn't save — only a Draft can be edited.", "danger"); return; }
        logSystemActivity({ module: "Credit Note", action: "Update", description: `Updated credit note "${updated.noteCode}" (${company.name})` });
        showToast("Credit note updated.", "success");
      } else {
        const created = ERP_CreditNoteRepository.create(company, selectedInvoice, selectedReturn, payload, session.username);
        logSystemActivity({ module: "Credit Note", action: "Create", description: `Created ${created.noteType.toLowerCase()} credit note "${created.noteCode}" against invoice ${invoiceLabel(created.linkedInvoiceId)} (${company.name})` });
        showToast("Credit note saved as Draft — issue it to reduce what the customer owes.", "success");
      }
      closeModal("cnFormModal");
      editingId = null;
      renderAll();
      renderActivity();
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function renderDetailFooter(note) {
    const footer = $("#cnDetailFooter");
    footer.innerHTML = "";

    if (note.status === "Draft") {
      const issueBtn = document.createElement("button");
      issueBtn.type = "button";
      issueBtn.className = "btn btn--primary";
      issueBtn.textContent = "Issue (posts to the books)";
      issueBtn.disabled = !ERP_CreditNoteRepository.canIssue(note);
      issueBtn.addEventListener("click", () => requestIssue(note));
      footer.appendChild(issueBtn);

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn--ghost";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openEditModal(note));
      footer.appendChild(editBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn--danger-outline";
      cancelBtn.textContent = "Cancel Note";
      cancelBtn.addEventListener("click", () => requestCancel(note));
      footer.appendChild(cancelBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn btn--ghost";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => closeModal("cnDetailModal"));
    footer.appendChild(closeBtn);
  }

  function openDetailModal(note) {
    const totals = ERP_CreditNoteRepository.computeGrandTotal(note);
    const invoice = ERP_TaxInvoiceRepository.findById(note.linkedInvoiceId);
    const invoiceTotal = invoice ? ERP_TaxInvoiceRepository.computeGrandTotal(invoice).total : null;

    $("#cnDetailTitle").textContent = `Credit Note — ${note.noteCode}`;
    $("#cnDetailBody").innerHTML = `
      <div><dt>Note Code</dt><dd><code>${escapeHtml(note.noteCode)}</code></dd></div>
      <div><dt>Type</dt><dd>${typeBadge(note.noteType)}</dd></div>
      <div><dt>Against Invoice</dt><dd>${escapeHtml(invoiceLabel(note.linkedInvoiceId))}${invoiceTotal != null ? ` (${formatMoney(invoiceTotal)})` : ""}</dd></div>
      ${note.linkedReturnId ? `<div><dt>From Sales Return</dt><dd>${escapeHtml(returnLabel(note.linkedReturnId))}</dd></div>` : ""}
      <div><dt>Customer</dt><dd>${escapeHtml(customerLabel(note.customerId))}</dd></div>
      <div><dt>Reason</dt><dd>${escapeHtml(note.reason || "—")}</dd></div>
      <div><dt>Note Date</dt><dd>${note.noteDate || "—"}</dd></div>
      <div><dt>Subtotal</dt><dd>${formatMoney(totals.subtotal)}</dd></div>
      <div><dt>Tax Credited</dt><dd>${formatMoney(totals.taxTotal)}</dd></div>
      <div><dt>Total Credited</dt><dd><strong>${formatMoney(totals.total)}</strong></dd></div>
      <div><dt>Notes</dt><dd>${note.notes ? escapeHtml(note.notes) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(note.status)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(note.createdAt))} by ${escapeHtml(actorLabel(note.createdByUsername))}</dd></div>
      ${note.status === "Credited" ? `<div><dt>Issued</dt><dd>${formatDateTime(new Date(note.issuedAt))} by ${escapeHtml(actorLabel(note.issuedByUsername))}</dd></div>` : ""}
      ${note.status === "Cancelled" ? `<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(note.cancelledAt))} by ${escapeHtml(actorLabel(note.cancelledByUsername))}</dd></div>` : ""}
    `;

    const isGoods = note.noteType === "Goods Return";
    $("#cnDetailLinesHead").innerHTML = isGoods
      ? `<th>Line</th><th>Qty</th><th>Rate</th><th>Tax</th><th>Line Credit</th>`
      : `<th>Line</th><th>Originally Billed</th><th>Tax</th><th>Credit Amount</th>`;

    const lines = note.creditLines || [];
    $("#cnDetailLinesBody").innerHTML = lines.map((l) => {
      const total = ERP_CreditNoteRepository.computeLineTotal(l);
      const tax = ERP_CreditNoteRepository.computeLineTax(l);
      const label = escapeHtml(l.lineDescription || itemLabel(l.itemId));
      return isGoods
        ? `<tr><td>${label}</td><td class="text-right">${formatQty(l.quantity)}</td><td class="text-right">${l.unitPrice != null ? formatMoney(l.unitPrice) : "—"}</td><td class="text-right">${tax != null ? formatMoney(tax) : "—"}</td><td class="text-right">${total != null ? formatMoney(total) : "—"}</td></tr>`
        : `<tr><td>${label}</td><td class="text-right">${formatMoney(l.originalLineValue)}</td><td class="text-right">${tax != null ? formatMoney(tax) : "—"}</td><td class="text-right">${total != null ? formatMoney(total) : "—"}</td></tr>`;
    }).join("");
    $("#cnDetailLinesEmpty").hidden = lines.length !== 0;

    renderDetailFooter(note);
    openModal("cnDetailModal");
  }

  function requestIssue(note) {
    if (!ERP_CreditNoteRepository.canIssue(note)) return;
    const totals = ERP_CreditNoteRepository.computeGrandTotal(note);
    openConfirm({
      title: "Issue this credit note?",
      message: `This posts a journal entry reversing ${formatMoney(totals.subtotal)} of revenue${totals.taxTotal > 0 ? ` and ${formatMoney(totals.taxTotal)} of output tax` : ""}, and reduces what this customer owes by ${formatMoney(totals.total)}. Once issued it can't be edited or cancelled — a mistake is corrected by reversing the journal entry and raising a fresh note, the way real accounting corrects one.`,
      confirmLabel: "Issue Credit Note",
      onConfirm: () => {
        const result = ERP_CreditNoteRepository.issue(note.id, company, session.username);
        if (!result.success) { showToast(result.reason || "Couldn't issue this credit note.", "danger"); return; }

        logSystemActivity({ module: "Credit Note", action: "Issue", description: `Issued credit note "${result.record.noteCode}" for ${formatMoney(totals.total)} (${company.name})` });

        // Auto-post to the General Ledger — the same typeof-guarded
        // pattern every auto-posting page in this project follows.
        if (typeof ERP_GlPostingRepository !== "undefined") {
          const glResult = ERP_GlPostingRepository.postCreditNote(company, result.record, session.username);
          if (glResult.success) {
            logSystemActivity({ module: "Credit Note", action: "Auto-Post", description: `Auto-posted journal entry ${glResult.entry.entryNumber} for credit note "${result.record.noteCode}" (${company.name})` });
          } else {
            showToast(glResult.reason, "warning", { title: "Not posted to the books" });
          }
        }

        closeModal("cnDetailModal");
        renderAll();
        renderActivity();
        showToast(`Credit note issued — ${formatMoney(totals.total)} taken off what this customer owes.`, "success");
      }
    });
  }

  function requestCancel(note) {
    openConfirm({
      title: "Cancel this draft?",
      message: "This draft was never issued, so nothing has been posted to the books and the customer still owes the full amount — cancelling is safe, and it frees the value back up for another credit note against the same invoice.",
      confirmLabel: "Cancel Note",
      onConfirm: () => {
        ERP_CreditNoteRepository.cancel(note.id, session.username);
        logSystemActivity({ module: "Credit Note", action: "Cancel", description: `Cancelled credit note "${note.noteCode}" (${company.name})` });
        closeModal("cnDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#cnTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const note = ERP_CreditNoteRepository.findById(viewBtn.dataset.id);
      if (note) openDetailModal(note);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "credit-note")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading credit notes…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#cnContent").hidden = true;
      $("#cnSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#cnContent").hidden = false;
      $("#cnHeaderActions").hidden = false;
      $("#cnSubtitle").textContent = `Managing credit notes for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
