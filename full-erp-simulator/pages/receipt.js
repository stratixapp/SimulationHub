/* =============================================================================
   DOT ERP — pages/receipt.js
   Phase 5, Module 9: Receipt

   See data/receipt-data.js's header for the full design rationale (why
   this module's shape confirms Vendor Payment's own mirror, unlike
   Payment Collection one module ago; why "Received" and not "Collected"
   as the terminal status; why Bank Master is used in a genuinely
   reversed direction here). UI-layer decisions on top of that:

   - THE INVOICE PICKER LOCKS IN EDIT MODE, EXPLICITLY RE-ENABLED WHEN
     ADD OPENS NEXT — the same proactive fix Dispatch and Tax Invoice
     both already carry forward from Delivery Challan's own documented
     bug.
   - AMOUNT RECEIVED DEFAULTS FROM THE INVOICE'S OWN GRAND TOTAL —
     `computeGrandTotal()` on the selected invoice's own lines — the
     same "default but stay editable" pattern Vendor Payment's own
     `amountPaid` used, refreshed live whenever the invoice selection
     changes.
   - THE BANK PICKER DEFAULTS TO THE COMPANY'S OWN `getDefault()` account
     but is a genuine choice, not a resolution — see file header. Each
     option is rendered through `ERP_BankRepository.maskedLabel()`, the
     exact same masked format Vendor Master's own retrofit already uses.
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

  function quickActionFor(r) {
    if (r.status === "Draft") return { action: "receive", label: "Mark Received" };
    return null;
  }

  /** The invoice's own stored customerId, direct — no chain-walk. */
  function resolveCustomer(invoice) {
    if (!invoice || !invoice.customerId) return null;
    return ERP_CustomerRepository.findById(invoice.customerId);
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_ReceiptRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((r) => {
        const invoice = r.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(r.linkedInvoiceId) : null;
        const cust = invoice ? resolveCustomer(invoice) : null;
        return r.receiptCode.toLowerCase().includes(term) ||
          (invoice && invoice.invoiceCode.toLowerCase().includes(term)) ||
          (cust && cust.customerName.toLowerCase().includes(term)) ||
          (r.referenceNumber || "").toLowerCase().includes(term);
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_ReceiptRepository.getAllForCompany(company.id);
    $("#rcptSummaryTotal").textContent = String(all.length);
    $("#rcptSummaryDraft").textContent = String(all.filter((r) => r.status === "Draft").length);
    $("#rcptSummaryReceived").textContent = String(all.filter((r) => r.status === "Received").length);
    $("#rcptSummaryCancelled").textContent = String(all.filter((r) => r.status === "Cancelled").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#rcptPagination");
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

    $("#rcptEmptyState").hidden = all.length !== 0;
    $("#rcptTable").hidden = all.length === 0;

    $("#rcptTableBody").innerHTML = pageItems.map((r) => {
      const invoice = r.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(r.linkedInvoiceId) : null;
      const cust = invoice ? resolveCustomer(invoice) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(r.status)}">${r.status}</span>`;
      const methodBadge = r.paymentMethod ? `<span class="status-badge status-badge--info">${escapeHtml(r.paymentMethod)}</span>` : `<span class="profile-subtle">—</span>`;
      const qa = quickActionFor(r);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${r.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(r.receiptCode)}</code></td>
        <td>${invoice ? `<code>${escapeHtml(invoice.invoiceCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${escapeHtml(formatCurrency(r.amountReceived || 0))}</td>
        <td>${r.receivedDate ? escapeHtml(r.receivedDate) : `<span class="profile-subtle">—</span>`}</td>
        <td>${methodBadge}</td>
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
    $$("#rcptStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#rcptStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#rcptSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#rcptSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#rcptExportCsvBtn").addEventListener("click", exportCsv);
    $("#rcptPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Receipt Code", "Invoice Code", "Customer", "Amount Received", "Received Date", "Method", "Bank Account", "Reference Number", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((r) => {
      const invoice = r.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(r.linkedInvoiceId) : null;
      const cust = invoice ? resolveCustomer(invoice) : null;
      const bank = r.bankId ? ERP_BankRepository.findById(r.bankId) : null;
      const line = [
        r.receiptCode, invoice ? invoice.invoiceCode : "", cust ? cust.customerName : "",
        r.amountReceived != null ? r.amountReceived : "", r.receivedDate || "", r.paymentMethod || "",
        bank ? ERP_BankRepository.maskedLabel(bank) : "", r.referenceNumber || "", r.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-receipts-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Receipts exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((r) => {
      const invoice = r.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(r.linkedInvoiceId) : null;
      const cust = invoice ? resolveCustomer(invoice) : null;
      return `<tr><td>${escapeHtml(r.receiptCode)}</td><td>${cust ? escapeHtml(cust.customerName) : ""}</td><td>${escapeHtml(formatCurrency(r.amountReceived || 0))}</td><td>${escapeHtml(r.paymentMethod || "")}</td><td>${escapeHtml(r.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Receipt Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Receipt Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Receipt Code</th><th>Customer</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Receipt")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#rcptActivityEmptyState").hidden = relevant.length !== 0;
    $("#rcptActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#rcptFormModal)
     --------------------------------------------------------------------- */
  function populateInvoiceOptions(currentId) {
    let invoices = ERP_ReceiptRepository.getAvailableRaisedInvoicesForCompany(company.id, editingId);
    if (currentId && !invoices.some((inv) => inv.id === currentId)) {
      const current = ERP_TaxInvoiceRepository.findById(currentId);
      if (current) invoices = invoices.concat([current]);
    }
    $("#rcptFormInvoice").innerHTML = invoices.map((inv) => {
      const cust = resolveCustomer(inv);
      const label = `${inv.invoiceCode}${cust ? ` — ${cust.customerName}` : ""}`;
      return `<option value="${inv.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function populateMethodOptions() {
    $("#rcptFormMethod").innerHTML = `<option value="">Not set</option>` +
      ERP_ReceiptRepository.paymentMethods.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
  }

  /** The COMPANY's own active bank accounts — a genuine choice, not a
      resolution through a linked party. See receipt-data.js's header. */
  function populateBankOptions(currentId) {
    let banks = ERP_BankRepository.getActiveForCompany(company.id);
    if (currentId && !banks.some((b) => b.id === currentId)) {
      const current = ERP_BankRepository.findById(currentId);
      if (current) banks = banks.concat([current]);
    }
    $("#rcptFormBank").innerHTML = `<option value="">Not set</option>` +
      banks.map((b) => `<option value="${b.id}">${escapeHtml(ERP_BankRepository.maskedLabel(b))}</option>`).join("");
  }

  function populateReceivedByOptions(currentId) {
    let employees = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status === "Active");
    if (currentId && !employees.some((e) => e.id === currentId)) {
      const current = ERP_EmployeeRepository.findById(currentId);
      if (current) employees = employees.concat([current]);
    }
    $("#rcptFormReceivedBy").innerHTML = `<option value="">Unassigned</option>` +
      employees.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)}</option>`).join("");
  }

  function renderInvoiceInfo(invoice) {
    const box = $("#rcptFormInvoiceInfo");
    if (!invoice) { box.textContent = ""; return; }
    const cust = resolveCustomer(invoice);
    const total = ERP_TaxInvoiceRepository.computeGrandTotal(invoice);
    box.textContent = `Customer: ${cust ? cust.customerName : "Removed"} — invoice total ${formatCurrency(total)}.`;
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["rcptFormInvoice", "rcptFormMethod", "rcptFormAmount", "rcptFormBank", "rcptFormReceivedDate"].forEach((f) => setFormError(f, ""));
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function openAddModal() {
    const available = ERP_ReceiptRepository.getAvailableRaisedInvoicesForCompany(company.id, null);
    if (!available.length) {
      showToast("No Raised tax invoices are currently available to record a receipt for. Raise one in Tax Invoice first.", "warning");
      return;
    }
    editingId = null;
    $("#rcptFormTitle").textContent = "New receipt";
    $("#rcptFormIntro").textContent = "Pick the Raised tax invoice to record a receipt for.";
    $("#rcptFormSaveBtn").textContent = "Create Receipt";
    // Explicitly re-enable — a shared DOM element's disabled state
    // doesn't reset itself between modal opens (see receipt-data.js's
    // header, Dispatch's own header, and the original Delivery Challan
    // bug this fix traces back to).
    $("#rcptFormInvoice").disabled = false;
    populateInvoiceOptions(null);
    const firstInvoice = ERP_TaxInvoiceRepository.findById($("#rcptFormInvoice").value);
    renderInvoiceInfo(firstInvoice);
    populateMethodOptions();
    populateBankOptions(null);
    populateReceivedByOptions(null);
    $("#rcptFormMethod").value = "";
    $("#rcptFormAmount").value = firstInvoice ? String(ERP_TaxInvoiceRepository.computeGrandTotal(firstInvoice)) : "";
    $("#rcptFormBank").value = (ERP_BankRepository.getDefault(company.id) || {}).id || "";
    $("#rcptFormReceivedDate").value = todayISO();
    $("#rcptFormReference").value = "";
    $("#rcptFormReceivedBy").value = "";
    $("#rcptFormRemarks").value = "";
    clearFormErrors();
    openModal("rcptFormModal");
  }

  function openEditModal(r) {
    if (!ERP_ReceiptRepository.canEdit(r)) {
      showToast(`"${r.receiptCode}" is ${r.status} and can't be edited directly. Reopen it to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = r.id;
    $("#rcptFormTitle").textContent = "Edit receipt";
    $("#rcptFormIntro").textContent = "Update the receipt details. The linked invoice is locked once created.";
    $("#rcptFormSaveBtn").textContent = "Save Changes";
    populateInvoiceOptions(r.linkedInvoiceId);
    $("#rcptFormInvoice").value = r.linkedInvoiceId || "";
    $("#rcptFormInvoice").disabled = true;
    const invoice = ERP_TaxInvoiceRepository.findById(r.linkedInvoiceId);
    renderInvoiceInfo(invoice);
    populateMethodOptions();
    populateBankOptions(r.bankId);
    populateReceivedByOptions(r.receivedByEmployeeId);
    $("#rcptFormMethod").value = r.paymentMethod || "";
    $("#rcptFormAmount").value = r.amountReceived != null ? String(r.amountReceived) : "";
    $("#rcptFormBank").value = r.bankId || "";
    $("#rcptFormReceivedDate").value = r.receivedDate || todayISO();
    $("#rcptFormReference").value = r.referenceNumber || "";
    $("#rcptFormReceivedBy").value = r.receivedByEmployeeId || "";
    $("#rcptFormRemarks").value = r.remarks || "";
    clearFormErrors();
    openModal("rcptFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!editingId && !$("#rcptFormInvoice").value) { setFormError("rcptFormInvoice", "Select the Raised tax invoice to record a receipt for."); valid = false; }
    if (!$("#rcptFormMethod").value) { setFormError("rcptFormMethod", "Select how this payment was received."); valid = false; }
    const amtRaw = $("#rcptFormAmount").value;
    if (amtRaw === "" || isNaN(Number(amtRaw)) || Number(amtRaw) <= 0) { setFormError("rcptFormAmount", "Enter an amount greater than zero."); valid = false; }
    if (!$("#rcptFormBank").value) { setFormError("rcptFormBank", "Select which of our accounts received this payment."); valid = false; }
    if (!$("#rcptFormReceivedDate").value) { setFormError("rcptFormReceivedDate", "Received date is required."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#rcptAddBtn").addEventListener("click", openAddModal);

    $("#rcptFormInvoice").addEventListener("change", (e) => {
      const invoice = ERP_TaxInvoiceRepository.findById(e.target.value);
      renderInvoiceInfo(invoice);
      if (invoice && !editingId) $("#rcptFormAmount").value = String(ERP_TaxInvoiceRepository.computeGrandTotal(invoice));
    });

    $("#rcptFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const invoice = editingId
        ? ERP_TaxInvoiceRepository.findById(ERP_ReceiptRepository.findById(editingId).linkedInvoiceId)
        : ERP_TaxInvoiceRepository.findById($("#rcptFormInvoice").value);
      const label = invoice ? invoice.invoiceCode : "this invoice";

      const payload = {
        paymentMethod: $("#rcptFormMethod").value,
        amountReceived: Number($("#rcptFormAmount").value),
        bankId: $("#rcptFormBank").value || null,
        receivedDate: $("#rcptFormReceivedDate").value || null,
        referenceNumber: $("#rcptFormReference").value.trim(),
        receivedByEmployeeId: $("#rcptFormReceivedBy").value || null,
        remarks: $("#rcptFormRemarks").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this receipt?",
          message: `This receipt for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_ReceiptRepository.update(editingId, payload);
            logSystemActivity({ module: "Receipt", action: "Update", description: `Updated receipt for ${label} (${company.name})` });
            closeModal("rcptFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_ReceiptRepository.findById(editingId));
            showToast("Receipt updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this receipt?",
          message: `A new receipt will be created as a Draft for ${label}.`,
          confirmLabel: "Create Receipt",
          onConfirm: () => {
            payload.linkedInvoiceId = $("#rcptFormInvoice").value;
            const created = ERP_ReceiptRepository.create(company, payload);
            logSystemActivity({ module: "Receipt", action: "Create", description: `Created receipt "${created.receiptCode}" for ${label} (${company.name})` });
            closeModal("rcptFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.receiptCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestMarkReceived(r) {
    openConfirm({
      title: "Mark this receipt as received?",
      message: `"${r.receiptCode}" will be marked Received — treat this as the factual record that the money landed.`,
      confirmLabel: "Mark Received",
      onConfirm: () => {
        ERP_ReceiptRepository.markReceived(r.id, session.username);
        logSystemActivity({ module: "Receipt", action: "Mark Received", description: `Marked receipt "${r.receiptCode}" as Received (${company.name})` });

        if (typeof ERP_GlPostingRepository !== "undefined") {
          const glResult = ERP_GlPostingRepository.postReceipt(company, ERP_ReceiptRepository.findById(r.id), session.username);
          if (glResult.success) {
            logSystemActivity({ module: "Receipt", action: "Auto-Post", description: `Auto-posted journal entry ${glResult.entry.entryNumber} for receipt "${r.receiptCode}" (${company.name})` });
            showToast(`Posted to the General Ledger as ${glResult.entry.entryNumber}.`, "info", { title: "Journal Entry created" });
          } else {
            showToast(glResult.reason, "warning", { title: "Not posted to the books" });
          }
        }

        renderAll();
        renderActivity();
        if (detailId === r.id) openDetailModal(ERP_ReceiptRepository.findById(r.id));
        showToast(`"${r.receiptCode}" marked Received.`, "success");
      }
    });
  }

  function requestReopen(r) {
    openConfirm({
      title: "Reopen this receipt?",
      message: `"${r.receiptCode}" will move back to Draft so you can correct it.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_ReceiptRepository.reopen(r.id);
        logSystemActivity({ module: "Receipt", action: "Reopen", description: `Reopened receipt "${r.receiptCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === r.id) openDetailModal(ERP_ReceiptRepository.findById(r.id));
        showToast(`"${r.receiptCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(r) {
    openConfirm({
      title: "Cancel this receipt?",
      message: `"${r.receiptCode}" will be marked Cancelled and its tax invoice freed up for a different receipt.`,
      confirmLabel: "Cancel Receipt",
      onConfirm: () => {
        ERP_ReceiptRepository.cancel(r.id, session.username);
        logSystemActivity({ module: "Receipt", action: "Cancel", description: `Cancelled receipt "${r.receiptCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === r.id) openDetailModal(ERP_ReceiptRepository.findById(r.id));
        showToast(`"${r.receiptCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(r) {
    if (!ERP_ReceiptRepository.canDelete(r)) {
      showToast(`"${r.receiptCode}" is ${r.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this receipt?",
      message: `"${r.receiptCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_ReceiptRepository.remove(r.id);
        logSystemActivity({ module: "Receipt", action: "Delete", description: `Deleted receipt "${r.receiptCode}" (${company.name})`, severity: "warning" });
        if (detailId === r.id) closeModal("rcptDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${r.receiptCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(r) {
    const footer = $("#rcptDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (r.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(r));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("rcptDetailModal"); openEditModal(r); });
      addBtn("Mark Received", "btn btn--primary", () => requestMarkReceived(r));
    } else if (r.status === "Received") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(r));
      addBtn("Reopen to Draft", "btn btn--ghost", () => requestReopen(r));
    } else if (r.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(r));
    }
  }

  function openDetailModal(r) {
    detailId = r.id;
    const invoice = ERP_TaxInvoiceRepository.findById(r.linkedInvoiceId);
    const cust = invoice ? resolveCustomer(invoice) : null;
    const bank = r.bankId ? ERP_BankRepository.findById(r.bankId) : null;
    const receivedBy = r.receivedByEmployeeId ? ERP_EmployeeRepository.findById(r.receivedByEmployeeId) : null;

    $("#rcptDetailTitle").textContent = `${r.receiptCode} · ${r.status}`;

    const rows = [];
    rows.push(`<div><dt>Receipt Code</dt><dd><code>${escapeHtml(r.receiptCode)}</code></dd></div>`);
    rows.push(`<div><dt>Tax Invoice</dt><dd>${invoice ? `<code>${escapeHtml(invoice.invoiceCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Customer</dt><dd>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Amount Received</dt><dd>${escapeHtml(formatCurrency(r.amountReceived || 0))}</dd></div>`);
    rows.push(`<div><dt>Payment Method</dt><dd>${r.paymentMethod ? escapeHtml(r.paymentMethod) : "—"}</dd></div>`);
    rows.push(`<div><dt>Received Into</dt><dd>${bank ? escapeHtml(ERP_BankRepository.maskedLabel(bank)) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Reference Number</dt><dd>${r.referenceNumber ? escapeHtml(r.referenceNumber) : "—"}</dd></div>`);
    rows.push(`<div><dt>Received Date</dt><dd>${r.receivedDate ? escapeHtml(r.receivedDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Received By</dt><dd>${receivedBy ? escapeHtml(receivedBy.fullName) : "— unassigned —"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(r.status)}">${r.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(r.createdAt))}</dd></div>`);
    if (r.receivedAt) rows.push(`<div><dt>Marked Received</dt><dd>${formatDateTime(new Date(r.receivedAt))} by ${escapeHtml(ERP_ReceiptRepository.actorLabel(r.receivedByUsername))}</dd></div>`);
    if (r.status === "Cancelled" && r.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(r.cancelledAt))} by ${escapeHtml(ERP_ReceiptRepository.actorLabel(r.cancelledByUsername))}</dd></div>`);
    if (r.remarks) rows.push(`<div><dt>Remarks</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(r.remarks)}</dd></div>`);

    $("#rcptDetailBody").innerHTML = rows.join("");
    renderDetailFooter(r);
    openModal("rcptDetailModal");
  }

  function bindDetailModal() {
    $("#rcptTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const r = ERP_ReceiptRepository.findById(viewBtn.dataset.id);
        if (r) openDetailModal(r);
        return;
      }
      if (actionBtn) {
        const r = ERP_ReceiptRepository.findById(actionBtn.dataset.id);
        if (!r) return;
        if (actionBtn.dataset.action === "receive") requestMarkReceived(r);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "receipt")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading receipts…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#rcptContent").hidden = true;
      $("#rcptSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#rcptContent").hidden = false;
      $("#rcptHeaderActions").hidden = false;
      $("#rcptSubtitle").textContent = `Recording receipts for ${company.name} (${company.companyCode}).`;

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
