/* =============================================================================
   DOT ERP — pages/debit-note.js
   Phase 15, Module 03b: Debit Note

   The Procurement mirror of pages/credit-note.js — same shape-switching
   form (Goods Return vs Price Adjustment), same convergence on one
   totals block and one guard. Only the labels, the parent documents,
   and the direction of the money change.
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
  let selectedVerification = null;
  let draftLines = [];
  let editingId = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function itemLabel(id) { const i = id && typeof ERP_ItemRepository !== "undefined" ? ERP_ItemRepository.findById(id) : null; return i ? i.itemName : "Unresolved line"; }
  function vendorLabel(id) { const v = id ? ERP_VendorRepository.findById(id) : null; return v ? v.vendorName : "Unknown vendor"; }
  function verificationLabel(id) { const v = id ? ERP_InvoiceVerificationRepository.findById(id) : null; return v ? v.verificationCode : "Unknown verification"; }
  function returnLabel(id) { const r = id && typeof ERP_PurchaseReturnRepository !== "undefined" ? ERP_PurchaseReturnRepository.findById(id) : null; return r ? r.returnCode : "—"; }

  function statusBadge(status) {
    const tone = status === "Debited" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }
  function typeBadge(type) {
    return `<span class="status-badge status-badge--${type === "Goods Return" ? "info" : "neutral"}">${escapeHtml(type)}</span>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY / LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_DebitNoteRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((n) => n.status === filterStatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((n) =>
        (n.noteCode || "").toLowerCase().includes(q) ||
        verificationLabel(n.linkedVerificationId).toLowerCase().includes(q) ||
        vendorLabel(n.vendorId).toLowerCase().includes(q)
      );
    }
    const btn = $("#dnSortBtn");
    if (btn && btn.dataset.order === "asc") rows = [...rows].reverse();
    return rows;
  }

  function renderSummary() {
    const all = ERP_DebitNoteRepository.getAllForCompany(company.id);
    $("#dnSummaryTotal").textContent = String(all.length);
    $("#dnSummaryDraft").textContent = String(all.filter((n) => n.status === "Draft").length);
    $("#dnSummaryDebited").textContent = String(all.filter((n) => n.status === "Debited").length);
    const value = all
      .filter((n) => n.status === "Debited")
      .reduce((s, n) => s + ERP_DebitNoteRepository.computeGrandTotal(n).total, 0);
    $("#dnSummaryValue").textContent = formatMoney(value);
  }

  function renderPagination(totalPages) {
    const container = $("#dnPagination");
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

    $("#dnEmptyState").hidden = all.length !== 0;
    $("#dnTable").hidden = all.length === 0;

    $("#dnTableBody").innerHTML = pageItems.map((n) => `
      <tr>
        <td><code>${escapeHtml(n.noteCode)}</code></td>
        <td>${typeBadge(n.noteType)}</td>
        <td>${escapeHtml(verificationLabel(n.linkedVerificationId))}</td>
        <td>${escapeHtml(vendorLabel(n.vendorId))}</td>
        <td class="text-right">${formatMoney(ERP_DebitNoteRepository.computeGrandTotal(n).total)}</td>
        <td>${n.noteDate || "—"}</td>
        <td>${statusBadge(n.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${n.id}">View</button></td>
      </tr>`).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#dnStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#dnStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
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
    $("#dnSortBtn").addEventListener("click", () => {
      const btn = $("#dnSortBtn");
      const asc = btn.dataset.order === "asc";
      btn.dataset.order = asc ? "desc" : "asc";
      btn.textContent = asc ? "Newest First" : "Oldest First";
      renderTable();
    });
    $("#dnExportCsvBtn").addEventListener("click", exportCsv);
    $("#dnPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Note Code", "Type", "Against Verification", "Purchase Return", "Vendor", "Subtotal", "Tax", "Total", "Reason", "Note Date", "Status"];
    const lines = [header.join(",")];
    rows.forEach((n) => {
      const t = ERP_DebitNoteRepository.computeGrandTotal(n);
      lines.push([
        n.noteCode, n.noteType,
        verificationLabel(n.linkedVerificationId),
        returnLabel(n.linkedReturnId),
        `"${vendorLabel(n.vendorId)}"`,
        t.subtotal.toFixed(2), t.taxTotal.toFixed(2), t.total.toFixed(2),
        `"${n.reason || ""}"`, n.noteDate || "", n.status
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `debit-notes-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Debit Note")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#dnActivityEmptyState").hidden = relevant.length !== 0;
    $("#dnActivityList").innerHTML = relevant.map((e) => `
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
    $("#dnFormType").innerHTML = ERP_DebitNoteRepository.noteTypes
      .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
    if (selected) $("#dnFormType").value = selected;
  }

  function populateReasonOptions(selected) {
    $("#dnFormReason").innerHTML = ERP_DebitNoteRepository.reasons
      .map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
    if (selected) $("#dnFormReason").value = selected;
  }

  function populateReturnOptions(selectedId) {
    const returns = ERP_DebitNoteRepository.getAvailableReturnsForCompany(company.id, editingId);
    const select = $("#dnFormReturn");
    const options = returns.map((r) =>
      `<option value="${r.id}">${escapeHtml(r.returnCode)}</option>`
    );
    if (selectedId && !returns.some((r) => r.id === selectedId)) {
      const r = ERP_PurchaseReturnRepository.findById(selectedId);
      if (r) options.unshift(`<option value="${r.id}">${escapeHtml(r.returnCode)}</option>`);
    }
    select.innerHTML = `<option value="">Select a posted purchase return…</option>` + options.join("");
    if (selectedId) select.value = selectedId;
  }

  function populateVerificationOptions(selectedId) {
    const verifications = ERP_DebitNoteRepository.getDebitableVerificationsForCompany(company.id, editingId);
    const select = $("#dnFormVerification");
    const options = verifications.map((v) =>
      `<option value="${v.id}">${escapeHtml(v.verificationCode)} — ${escapeHtml(v.vendorInvoiceNumber || "no vendor invoice #")}</option>`
    );
    if (selectedId && !verifications.some((v) => v.id === selectedId)) {
      const v = ERP_InvoiceVerificationRepository.findById(selectedId);
      if (v) options.unshift(`<option value="${v.id}">${escapeHtml(v.verificationCode)}</option>`);
    }
    select.innerHTML = `<option value="">Select a verified invoice…</option>` + options.join("");
    if (selectedId) select.value = selectedId;
  }

  function applyTypeToForm() {
    const isGoods = formType === "Goods Return";
    $("#dnFormReturnField").hidden = !isGoods;
    $("#dnFormVerificationField").hidden = isGoods;
    $("#dnFormLinesHead").innerHTML = isGoods
      ? `<th>Line</th><th>Qty Returned</th><th>Rate</th><th>Tax</th><th>Line Debit</th>`
      : `<th>Line</th><th>Originally Billed</th><th>Tax</th><th>Debit Amount</th>`;
    $("#dnFormLinesHint").textContent = isGoods
      ? "Lines are derived from the purchase return and priced from the verified invoice — nothing here is typed."
      : "Nothing physically went back, so there's no quantity — type the amount being debited on each line.";
  }

  function onTypeChanged() {
    formType = $("#dnFormType").value;
    selectedReturn = null;
    selectedVerification = null;
    draftLines = [];
    populateReasonOptions(formType === "Goods Return"
      ? ERP_DebitNoteRepository.reasons[0]
      : ERP_DebitNoteRepository.reasons[1]);
    if (formType === "Goods Return") populateReturnOptions(null); else populateVerificationOptions(null);
    applyTypeToForm();
    $("#dnFormParentInfo").textContent = "";
    $("#dnFormReturnError").textContent = "";
    $("#dnFormVerificationError").textContent = "";
    renderFormLines();
  }

  function vendorForVerification(v) {
    if (!v || !v.linkedPoId || typeof ERP_PurchaseOrderRepository === "undefined") return null;
    const po = ERP_PurchaseOrderRepository.findById(v.linkedPoId);
    return po ? po.vendorId : null;
  }

  function onReturnPicked() {
    const id = $("#dnFormReturn").value;
    selectedReturn = id ? ERP_PurchaseReturnRepository.findById(id) : null;
    selectedVerification = null;
    $("#dnFormReturnError").textContent = "";
    if (!selectedReturn) {
      draftLines = [];
      $("#dnFormParentInfo").textContent = "";
      renderFormLines();
      return;
    }
    // A Purchase Return doesn't itself point at an Invoice Verification —
    // find whichever Verified verification shares the same PO as the
    // return's own GRN, the same "resolve through the shared PO" this
    // module's own header already documents for item resolution.
    const chain = ERP_PurchaseReturnRepository.resolveChainForGrn(
      typeof ERP_GrnRepository !== "undefined" ? ERP_GrnRepository.findById(selectedReturn.linkedGrnId) : null
    );
    selectedVerification = chain.po
      ? ERP_InvoiceVerificationRepository.getAllForCompany(company.id).find((v) => v.linkedPoId === chain.po.id && v.status === "Verified")
      : null;
    if (!selectedVerification) {
      draftLines = [];
      $("#dnFormParentInfo").textContent = "This return's own purchase order has no Verified invoice yet — verify the vendor's bill first.";
      renderFormLines();
      return;
    }
    draftLines = ERP_DebitNoteRepository.buildLinesFromReturn(selectedReturn, selectedVerification);
    updateParentInfo();
    renderFormLines();
  }

  function onVerificationPicked() {
    const id = $("#dnFormVerification").value;
    selectedVerification = id ? ERP_InvoiceVerificationRepository.findById(id) : null;
    selectedReturn = null;
    $("#dnFormVerificationError").textContent = "";
    if (!selectedVerification) {
      draftLines = [];
      $("#dnFormParentInfo").textContent = "";
      renderFormLines();
      return;
    }
    draftLines = ERP_DebitNoteRepository.buildLinesFromVerification(selectedVerification);
    updateParentInfo();
    renderFormLines();
  }

  function updateParentInfo() {
    if (!selectedVerification) { $("#dnFormParentInfo").textContent = ""; return; }
    const vTotal = ERP_InvoiceVerificationRepository.computeGrandTotal(selectedVerification).total;
    const remaining = ERP_DebitNoteRepository.getRemainingDebitableForVerification(company.id, selectedVerification, editingId);
    $("#dnFormParentInfo").textContent =
      `Vendor: ${vendorLabel(vendorForVerification(selectedVerification))} · Verification ${selectedVerification.verificationCode} total ${formatMoney(vTotal)} · still debitable ${formatMoney(remaining)}`;
  }

  function renderFormLines() {
    const body = $("#dnFormLinesBody");
    if (!draftLines.length) {
      body.innerHTML = "";
      $("#dnFormLinesEmpty").hidden = false;
      updateTotals();
      return;
    }
    $("#dnFormLinesEmpty").hidden = true;

    if (formType === "Goods Return") {
      body.innerHTML = draftLines.map((l) => {
        const total = ERP_DebitNoteRepository.computeLineTotal(l);
        const tax = ERP_DebitNoteRepository.computeLineTax(l);
        return `
          <tr>
            <td>${escapeHtml(itemLabel(l.itemId))}</td>
            <td class="text-right">${formatQty(l.quantity)}</td>
            <td class="text-right">${l.unitPrice != null ? formatMoney(l.unitPrice) : "—"}</td>
            <td class="text-right">${tax != null ? formatMoney(tax) : "—"}</td>
            <td class="text-right">${total != null ? formatMoney(total) : "—"}</td>
          </tr>`;
      }).join("");
    } else {
      body.innerHTML = draftLines.map((l) => {
        const tax = ERP_DebitNoteRepository.computeLineTax(l);
        return `
          <tr data-line-id="${l.prLineItemId}">
            <td>${escapeHtml(itemLabel(l.itemId))}</td>
            <td class="text-right">${formatMoney(l.originalLineValue)}</td>
            <td class="text-right">${tax != null ? formatMoney(tax) : "—"}</td>
            <td class="text-right">
              <input type="number" class="dn-line-amount" data-line-id="${l.prLineItemId}"
                     min="0" step="0.01" value="${l.debitAmount || 0}" />
            </td>
          </tr>`;
      }).join("");
    }
    updateTotals();
  }

  function updateTotals() {
    const totals = ERP_DebitNoteRepository.computeGrandTotal({ debitLines: draftLines });
    $("#dnFormSubtotal").textContent = formatMoney(totals.subtotal);
    $("#dnFormTax").textContent = formatMoney(totals.taxTotal);
    $("#dnFormTotal").textContent = formatMoney(totals.total);

    if (selectedVerification) {
      const remaining = ERP_DebitNoteRepository.getRemainingDebitableForVerification(company.id, selectedVerification, editingId);
      const over = Math.round(totals.total * 100) / 100 > remaining;
      $("#dnFormRemaining").textContent = over
        ? `Over the limit — only ${formatMoney(remaining)} is still debitable against this invoice.`
        : `${formatMoney(remaining)} still debitable against this invoice.`;
      $("#dnFormRemaining").className = over ? "field-error" : "field-hint";
    } else {
      $("#dnFormRemaining").textContent = "";
      $("#dnFormRemaining").className = "field-hint";
    }
  }

  function openAddModal() {
    editingId = null;
    formType = "Goods Return";
    selectedReturn = null;
    selectedVerification = null;
    draftLines = [];

    const returns = ERP_DebitNoteRepository.getAvailableReturnsForCompany(company.id, null);
    const verifications = ERP_DebitNoteRepository.getDebitableVerificationsForCompany(company.id, null);
    if (!returns.length && !verifications.length) {
      showToast("Nothing to debit yet — post a purchase return, or verify a vendor invoice with value left to debit.", "warning");
      return;
    }
    if (!returns.length) formType = "Price Adjustment";

    $("#dnFormTitle").textContent = "New debit note";
    $("#dnFormIntro").textContent = "A debit note reduces what you owe a vendor. Pick why you're raising it — the rest of the form follows from that.";
    $("#dnFormSaveBtn").textContent = "Create Debit Note";
    populateTypeOptions(formType);
    $("#dnFormType").disabled = false;
    populateReasonOptions(formType === "Goods Return" ? ERP_DebitNoteRepository.reasons[0] : ERP_DebitNoteRepository.reasons[1]);
    if (formType === "Goods Return") populateReturnOptions(null); else populateVerificationOptions(null);
    applyTypeToForm();
    $("#dnFormNoteDate").value = new Date().toISOString().slice(0, 10);
    $("#dnFormNotes").value = "";
    $("#dnFormReturnError").textContent = "";
    $("#dnFormVerificationError").textContent = "";
    $("#dnFormLinesError").textContent = "";
    $("#dnFormParentInfo").textContent = "";
    renderFormLines();
    openModal("dnFormModal");
  }

  function openEditModal(note) {
    editingId = note.id;
    formType = note.noteType;
    selectedVerification = ERP_InvoiceVerificationRepository.findById(note.linkedVerificationId);
    selectedReturn = note.linkedReturnId && typeof ERP_PurchaseReturnRepository !== "undefined"
      ? ERP_PurchaseReturnRepository.findById(note.linkedReturnId) : null;
    if (!selectedVerification) { showToast("The linked invoice verification no longer exists.", "danger"); return; }

    draftLines = (note.debitLines || []).map((l) => ({ ...l }));

    $("#dnFormTitle").textContent = `Edit debit note — ${note.noteCode}`;
    $("#dnFormIntro").textContent = ERP_DebitNoteRepository.canEditLines(note)
      ? "Only a Draft can be edited, and the document it debits is fixed."
      : "A Goods Return note's lines are derived and never editable — only the header fields below can change.";
    $("#dnFormSaveBtn").textContent = "Save Changes";
    populateTypeOptions(note.noteType);
    $("#dnFormType").disabled = true;
    populateReasonOptions(note.reason);
    populateReturnOptions(note.linkedReturnId);
    populateVerificationOptions(note.linkedVerificationId);
    $("#dnFormReturn").disabled = true;
    $("#dnFormVerification").disabled = true;
    applyTypeToForm();
    $("#dnFormNoteDate").value = note.noteDate || "";
    $("#dnFormNotes").value = note.notes || "";
    $("#dnFormReturnError").textContent = "";
    $("#dnFormVerificationError").textContent = "";
    $("#dnFormLinesError").textContent = "";
    updateParentInfo();
    renderFormLines();
    closeModal("dnDetailModal");
    openModal("dnFormModal");
  }

  function validateForm() {
    let valid = true;
    $("#dnFormReturnError").textContent = "";
    $("#dnFormVerificationError").textContent = "";
    $("#dnFormLinesError").textContent = "";

    if (formType === "Goods Return" && !selectedReturn) {
      $("#dnFormReturnError").textContent = "Pick the posted purchase return this note debits.";
      valid = false;
    }
    if (formType === "Price Adjustment" && !selectedVerification) {
      $("#dnFormVerificationError").textContent = "Pick the verified invoice being adjusted.";
      valid = false;
    }
    if (formType === "Goods Return" && selectedReturn && !selectedVerification) {
      $("#dnFormReturnError").textContent = "This return's purchase order has no Verified invoice yet.";
      valid = false;
    }
    if (selectedVerification) {
      const check = ERP_DebitNoteRepository.validateNote(
        company.id, selectedVerification, { debitLines: draftLines }, editingId
      );
      if (!check.ok) { $("#dnFormLinesError").textContent = check.errors[0]; valid = false; }
    }
    return valid;
  }

  function bindFormModal() {
    $("#dnAddBtn").addEventListener("click", openAddModal);
    $("#dnFormType").addEventListener("change", onTypeChanged);
    $("#dnFormReturn").addEventListener("change", onReturnPicked);
    $("#dnFormVerification").addEventListener("change", onVerificationPicked);

    $("#dnFormLinesBody").addEventListener("input", (e) => {
      const input = e.target.closest(".dn-line-amount");
      if (!input) return;
      const line = draftLines.find((l) => l.prLineItemId === input.dataset.lineId);
      if (!line) return;
      line.debitAmount = Number(input.value) || 0;
      updateTotals();
    });

    $("#dnFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const payload = {
        noteDate: $("#dnFormNoteDate").value || new Date().toISOString().slice(0, 10),
        reason: $("#dnFormReason").value,
        notes: $("#dnFormNotes").value.trim(),
        debitLines: draftLines
      };
      if (editingId) {
        const updated = ERP_DebitNoteRepository.update(editingId, payload);
        if (!updated) { showToast("Couldn't save — only a Draft can be edited.", "danger"); return; }
        logSystemActivity({ module: "Debit Note", action: "Update", description: `Updated debit note "${updated.noteCode}" (${company.name})` });
        showToast("Debit note updated.", "success");
      } else {
        const created = ERP_DebitNoteRepository.create(company, selectedVerification, selectedReturn, payload, session.username);
        logSystemActivity({ module: "Debit Note", action: "Create", description: `Created ${created.noteType.toLowerCase()} debit note "${created.noteCode}" against verification ${verificationLabel(created.linkedVerificationId)} (${company.name})` });
        showToast("Debit note saved as Draft — issue it to reduce what you owe the vendor.", "success");
      }
      closeModal("dnFormModal");
      editingId = null;
      renderAll();
      renderActivity();
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function renderDetailFooter(note) {
    const footer = $("#dnDetailFooter");
    footer.innerHTML = "";

    if (note.status === "Draft") {
      const issueBtn = document.createElement("button");
      issueBtn.type = "button";
      issueBtn.className = "btn btn--primary";
      issueBtn.textContent = "Issue (posts to the books)";
      issueBtn.disabled = !ERP_DebitNoteRepository.canIssue(note);
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
    closeBtn.addEventListener("click", () => closeModal("dnDetailModal"));
    footer.appendChild(closeBtn);
  }

  function openDetailModal(note) {
    const totals = ERP_DebitNoteRepository.computeGrandTotal(note);
    const verification = ERP_InvoiceVerificationRepository.findById(note.linkedVerificationId);
    const verificationTotal = verification ? ERP_InvoiceVerificationRepository.computeGrandTotal(verification).total : null;

    $("#dnDetailTitle").textContent = `Debit Note — ${note.noteCode}`;
    $("#dnDetailBody").innerHTML = `
      <div><dt>Note Code</dt><dd><code>${escapeHtml(note.noteCode)}</code></dd></div>
      <div><dt>Type</dt><dd>${typeBadge(note.noteType)}</dd></div>
      <div><dt>Against Verification</dt><dd>${escapeHtml(verificationLabel(note.linkedVerificationId))}${verificationTotal != null ? ` (${formatMoney(verificationTotal)})` : ""}</dd></div>
      ${note.linkedReturnId ? `<div><dt>From Purchase Return</dt><dd>${escapeHtml(returnLabel(note.linkedReturnId))}</dd></div>` : ""}
      <div><dt>Vendor</dt><dd>${escapeHtml(vendorLabel(note.vendorId))}</dd></div>
      <div><dt>Reason</dt><dd>${escapeHtml(note.reason || "—")}</dd></div>
      <div><dt>Note Date</dt><dd>${note.noteDate || "—"}</dd></div>
      <div><dt>Subtotal</dt><dd>${formatMoney(totals.subtotal)}</dd></div>
      <div><dt>Tax Reversed</dt><dd>${formatMoney(totals.taxTotal)}</dd></div>
      <div><dt>Total Debited</dt><dd><strong>${formatMoney(totals.total)}</strong></dd></div>
      <div><dt>Notes</dt><dd>${note.notes ? escapeHtml(note.notes) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(note.status)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(note.createdAt))} by ${escapeHtml(actorLabel(note.createdByUsername))}</dd></div>
      ${note.status === "Debited" ? `<div><dt>Issued</dt><dd>${formatDateTime(new Date(note.issuedAt))} by ${escapeHtml(actorLabel(note.issuedByUsername))}</dd></div>` : ""}
      ${note.status === "Cancelled" ? `<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(note.cancelledAt))} by ${escapeHtml(actorLabel(note.cancelledByUsername))}</dd></div>` : ""}
    `;

    const isGoods = note.noteType === "Goods Return";
    $("#dnDetailLinesHead").innerHTML = isGoods
      ? `<th>Line</th><th>Qty</th><th>Rate</th><th>Tax</th><th>Line Debit</th>`
      : `<th>Line</th><th>Originally Billed</th><th>Tax</th><th>Debit Amount</th>`;

    const lines = note.debitLines || [];
    $("#dnDetailLinesBody").innerHTML = lines.map((l) => {
      const total = ERP_DebitNoteRepository.computeLineTotal(l);
      const tax = ERP_DebitNoteRepository.computeLineTax(l);
      const label = escapeHtml(itemLabel(l.itemId));
      return isGoods
        ? `<tr><td>${label}</td><td class="text-right">${formatQty(l.quantity)}</td><td class="text-right">${l.unitPrice != null ? formatMoney(l.unitPrice) : "—"}</td><td class="text-right">${tax != null ? formatMoney(tax) : "—"}</td><td class="text-right">${total != null ? formatMoney(total) : "—"}</td></tr>`
        : `<tr><td>${label}</td><td class="text-right">${formatMoney(l.originalLineValue)}</td><td class="text-right">${tax != null ? formatMoney(tax) : "—"}</td><td class="text-right">${total != null ? formatMoney(total) : "—"}</td></tr>`;
    }).join("");
    $("#dnDetailLinesEmpty").hidden = lines.length !== 0;

    renderDetailFooter(note);
    openModal("dnDetailModal");
  }

  function requestIssue(note) {
    if (!ERP_DebitNoteRepository.canIssue(note)) return;
    const totals = ERP_DebitNoteRepository.computeGrandTotal(note);
    // A "Goods Return" note is built from a Purchase Return that has
    // already posted its own inventory/payable reversal at FIFO cost the
    // moment it was itself posted — this note now only carries the tax
    // portion forward. See gl-posting-data.js's own postDebitNote() for
    // the full reasoning. A "Price Adjustment" note has no such return
    // behind it, so its own message still describes the full reversal.
    const isGoodsReturn = note.noteType === "Goods Return";
    const message = isGoodsReturn
      ? (totals.taxTotal > 0
          ? `The inventory and payable value for this return were already posted when the purchase return itself was posted. This note posts the remaining tax portion: ${formatMoney(totals.taxTotal)} of input tax credit reversed. Once issued it can't be edited or cancelled — a mistake is corrected by reversing the journal entry and raising a fresh note.`
          : `The inventory and payable value for this return were already posted when the purchase return itself was posted, and this note carries no tax — so issuing it posts nothing further to the books. Once issued it can't be edited or cancelled.`)
      : `This posts a journal entry reversing ${formatMoney(totals.subtotal)} of inventory value${totals.taxTotal > 0 ? ` and ${formatMoney(totals.taxTotal)} of input tax credit` : ""}, and reduces what you owe this vendor by ${formatMoney(totals.total)}. Once issued it can't be edited or cancelled — a mistake is corrected by reversing the journal entry and raising a fresh note.`;
    openConfirm({
      title: "Issue this debit note?",
      message,
      confirmLabel: "Issue Debit Note",
      onConfirm: () => {
        const result = ERP_DebitNoteRepository.issue(note.id, company, session.username);
        if (!result.success) { showToast(result.reason || "Couldn't issue this debit note.", "danger"); return; }

        logSystemActivity({ module: "Debit Note", action: "Issue", description: `Issued debit note "${result.record.noteCode}" for ${formatMoney(totals.total)} (${company.name})` });

        if (typeof ERP_GlPostingRepository !== "undefined") {
          const glResult = ERP_GlPostingRepository.postDebitNote(company, result.record, session.username);
          if (glResult.success && !glResult.skipped) {
            logSystemActivity({ module: "Debit Note", action: "Auto-Post", description: `Auto-posted journal entry ${glResult.entry.entryNumber} for debit note "${result.record.noteCode}" (${company.name})` });
          } else if (!glResult.success) {
            showToast(glResult.reason, "warning", { title: "Not posted to the books" });
          }
        }

        closeModal("dnDetailModal");
        renderAll();
        renderActivity();
        showToast(`Debit note issued — ${formatMoney(totals.total)} taken off what you owe this vendor.`, "success");
      }
    });
  }

  function requestCancel(note) {
    openConfirm({
      title: "Cancel this draft?",
      message: "This draft was never issued, so nothing has been posted to the books and you still owe the vendor the full amount — cancelling is safe, and it frees the value back up for another debit note against the same invoice.",
      confirmLabel: "Cancel Note",
      onConfirm: () => {
        ERP_DebitNoteRepository.cancel(note.id, session.username);
        logSystemActivity({ module: "Debit Note", action: "Cancel", description: `Cancelled debit note "${note.noteCode}" (${company.name})` });
        closeModal("dnDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#dnTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const note = ERP_DebitNoteRepository.findById(viewBtn.dataset.id);
      if (note) openDetailModal(note);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "debit-note")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading debit notes…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#dnContent").hidden = true;
      $("#dnSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#dnContent").hidden = false;
      $("#dnHeaderActions").hidden = false;
      $("#dnSubtitle").textContent = `Managing debit notes for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
