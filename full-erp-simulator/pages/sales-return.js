/* =============================================================================
   DOT ERP — pages/sales-return.js
   Phase 15, Module 01: Sales Return

   Line table lives INSIDE the form modal (Stock Adjustment's own shape),
   not behind a per-line modal: a return is a single decision about
   several lines at once, and you need to see every line's remaining
   returnable quantity together to make it. Quantities are validated
   against the SAME repository function post() will enforce anyway, so
   the form can never accept something the repository would refuse.
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
  let selectedInvoice = null;
  let draftLines = [];
  let editingId = null;

  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function itemLabel(id) { const i = id && typeof ERP_ItemRepository !== "undefined" ? ERP_ItemRepository.findById(id) : null; return i ? i.itemName : "Unknown item"; }
  function warehouseLabel(id) { const w = id ? ERP_WarehouseRepository.findById(id) : null; return w ? w.warehouseName : "Not selected"; }
  function customerLabel(id) { const c = id ? ERP_CustomerRepository.findById(id) : null; return c ? c.customerName : "Unknown customer"; }
  function invoiceLabel(id) { const i = id ? ERP_TaxInvoiceRepository.findById(id) : null; return i ? i.invoiceCode : "Unknown invoice"; }

  function statusBadge(status) {
    const tone = status === "Returned" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY / LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_SalesReturnRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((r) =>
        (r.returnCode || "").toLowerCase().includes(q) ||
        invoiceLabel(r.linkedInvoiceId).toLowerCase().includes(q) ||
        customerLabel(r.customerId).toLowerCase().includes(q)
      );
    }
    const btn = $("#srSortBtn");
    if (btn && btn.dataset.order === "asc") rows = [...rows].reverse();
    return rows;
  }

  function renderSummary() {
    const all = ERP_SalesReturnRepository.getAllForCompany(company.id);
    $("#srSummaryTotal").textContent = String(all.length);
    $("#srSummaryDraft").textContent = String(all.filter((r) => r.status === "Draft").length);
    $("#srSummaryReturned").textContent = String(all.filter((r) => r.status === "Returned").length);
    $("#srSummaryCancelled").textContent = String(all.filter((r) => r.status === "Cancelled").length);
  }

  function renderPagination(totalPages) {
    const container = $("#srPagination");
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

    $("#srEmptyState").hidden = all.length !== 0;
    $("#srTable").hidden = all.length === 0;

    $("#srTableBody").innerHTML = pageItems.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.returnCode)}</code></td>
        <td>${escapeHtml(invoiceLabel(r.linkedInvoiceId))}</td>
        <td>${escapeHtml(customerLabel(r.customerId))}</td>
        <td class="text-right">${formatQty(ERP_SalesReturnRepository.computeTotalReturnQuantity(r))}</td>
        <td>${escapeHtml(r.reason || "—")}</td>
        <td>${r.returnDate || "—"}</td>
        <td>${statusBadge(r.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">View</button></td>
      </tr>`).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#srStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#srStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    // Search lives in the topbar on every list page in this project, not
    // in the card toolbar — checked against customers.js before wiring it.
    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value.trim();
      page = 1;
      renderTable();
    });
    $("#srSortBtn").addEventListener("click", () => {
      const btn = $("#srSortBtn");
      const asc = btn.dataset.order === "asc";
      btn.dataset.order = asc ? "desc" : "asc";
      btn.textContent = asc ? "Newest First" : "Oldest First";
      renderTable();
    });
    $("#srExportCsvBtn").addEventListener("click", exportCsv);
    $("#srPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Return Code", "Invoice", "Customer", "Total Qty Returned", "Reason", "Warehouse", "Return Date", "Status"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([
        r.returnCode,
        invoiceLabel(r.linkedInvoiceId),
        `"${customerLabel(r.customerId)}"`,
        ERP_SalesReturnRepository.computeTotalReturnQuantity(r),
        `"${r.reason || ""}"`,
        `"${warehouseLabel(r.returnToWarehouseId)}"`,
        r.returnDate || "",
        r.status
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sales-returns-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Sales Return")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#srActivityEmptyState").hidden = relevant.length !== 0;
    $("#srActivityList").innerHTML = relevant.map((e) => `
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
     FORM MODAL — invoice picker, warehouse, and the editable line table
     --------------------------------------------------------------------- */
  function populateInvoiceOptions(selectedId) {
    const invoices = ERP_SalesReturnRepository.getReturnableInvoicesForCompany(company.id);
    const select = $("#srFormInvoice");
    if (!invoices.length && !selectedId) {
      select.innerHTML = `<option value="">No invoice has anything left to return</option>`;
      select.disabled = true;
      return;
    }
    select.disabled = false;
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

  function populateWarehouseOptions(selectedId) {
    const warehouses = ERP_WarehouseRepository.getAllForCompany(company.id).filter((w) => w.status === "Active");
    $("#srFormWarehouse").innerHTML =
      `<option value="">Select a warehouse…</option>` +
      warehouses.map((w) => `<option value="${w.id}">${escapeHtml(w.warehouseName)}</option>`).join("");
    if (selectedId) $("#srFormWarehouse").value = selectedId;
  }

  function populateReasonOptions(selected) {
    $("#srFormReason").innerHTML = ERP_SalesReturnRepository.reasons
      .map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
    if (selected) $("#srFormReason").value = selected;
  }

  function populateEmployeeOptions(selectedId) {
    const employees = typeof ERP_EmployeeRepository !== "undefined"
      ? ERP_EmployeeRepository.getAllForCompany(company.id) : [];
    $("#srFormReceivedBy").innerHTML =
      `<option value="">Not specified</option>` +
      employees.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)}</option>`).join("");
    if (selectedId) $("#srFormReceivedBy").value = selectedId;
  }

  /** Rebuilds `draftLines` from the picked invoice, carrying over any
      quantity the user has already typed for a line that still exists. */
  function rebuildDraftLines(invoice, existing) {
    const typed = {};
    (existing || draftLines).forEach((l) => { typed[l.id] = { returnQuantity: l.returnQuantity, condition: l.condition }; });
    draftLines = ERP_SalesReturnRepository.buildReturnLines(company.id, invoice).map((l) => ({
      ...l,
      // In edit mode this record's own already-returned figure must not
      // count against itself — the repository's excludeReturnId does the
      // same thing for validation; this keeps the DISPLAYED remaining
      // figure honest too.
      alreadyReturnedQuantity: ERP_SalesReturnRepository.getReturnedQuantityForLine(company.id, invoice.id, l.id, editingId),
      returnQuantity: typed[l.id] && typed[l.id].returnQuantity != null ? typed[l.id].returnQuantity : 0,
      condition: (typed[l.id] && typed[l.id].condition) || l.condition
    }));
  }

  function renderFormLines() {
    const body = $("#srFormLinesBody");
    if (!draftLines.length) {
      body.innerHTML = "";
      $("#srFormLinesEmpty").hidden = false;
      $("#srFormTotalQty").textContent = "0";
      return;
    }
    $("#srFormLinesEmpty").hidden = true;
    body.innerHTML = draftLines.map((l) => {
      const remaining = Math.max(0, (Number(l.invoicedQuantity) || 0) - (Number(l.alreadyReturnedQuantity) || 0));
      return `
        <tr data-line-id="${l.id}">
          <td>${escapeHtml(l.lineDescription || itemLabel(l.itemId))}</td>
          <td class="text-right">${formatQty(l.invoicedQuantity)}</td>
          <td class="text-right">${formatQty(l.alreadyReturnedQuantity)}</td>
          <td class="text-right">${formatQty(remaining)}</td>
          <td class="text-right">
            <input type="number" class="sr-line-qty" data-line-id="${l.id}"
                   min="0" max="${remaining}" step="0.01" value="${l.returnQuantity || 0}" />
          </td>
          <td>
            <select class="select-field sr-line-condition" data-line-id="${l.id}">
              ${ERP_SalesReturnRepository.conditions.map((c) => `<option value="${c}" ${(l.condition || ERP_SalesReturnRepository.conditions[0]) === c ? "selected" : ""}>${c}</option>`).join("")}
            </select>
          </td>
        </tr>`;
    }).join("");
    updateTotalQty();
  }

  function updateTotalQty() {
    const total = draftLines.reduce((s, l) => s + (Number(l.returnQuantity) || 0), 0);
    $("#srFormTotalQty").textContent = formatQty(total);
  }

  function onInvoicePicked() {
    const id = $("#srFormInvoice").value;
    selectedInvoice = id ? ERP_TaxInvoiceRepository.findById(id) : null;
    $("#srFormInvoiceError").textContent = "";
    if (!selectedInvoice) {
      draftLines = [];
      $("#srFormInvoiceInfo").textContent = "";
      renderFormLines();
      return;
    }
    $("#srFormInvoiceInfo").textContent =
      `Customer: ${customerLabel(selectedInvoice.customerId)} · Invoice date: ${selectedInvoice.invoiceDate || "—"}`;
    rebuildDraftLines(selectedInvoice, []);
    renderFormLines();
  }

  function openAddModal() {
    editingId = null;
    selectedInvoice = null;
    draftLines = [];
    const available = ERP_SalesReturnRepository.getReturnableInvoicesForCompany(company.id);
    if (!available.length) {
      showToast("No Raised invoice has anything left to return yet.", "warning");
      return;
    }
    $("#srFormTitle").textContent = "New sales return";
    $("#srFormIntro").textContent = "Pick the invoice the goods were sold on — every line starts at zero, since a return is almost never for the whole invoice.";
    $("#srFormSaveBtn").textContent = "Create Sales Return";
    populateInvoiceOptions(null);
    populateWarehouseOptions(null);
    populateReasonOptions(null);
    populateEmployeeOptions(null);
    $("#srFormInvoice").disabled = false;
    $("#srFormReturnDate").value = new Date().toISOString().slice(0, 10);
    $("#srFormRemarks").value = "";
    $("#srFormInvoiceError").textContent = "";
    $("#srFormWarehouseError").textContent = "";
    $("#srFormLinesError").textContent = "";
    $("#srFormInvoiceInfo").textContent = "";
    renderFormLines();
    openModal("srFormModal");
  }

  function openEditModal(record) {
    editingId = record.id;
    selectedInvoice = ERP_TaxInvoiceRepository.findById(record.linkedInvoiceId);
    if (!selectedInvoice) { showToast("The linked invoice no longer exists.", "danger"); return; }
    $("#srFormTitle").textContent = `Edit sales return — ${record.returnCode}`;
    $("#srFormIntro").textContent = "Only a Draft can be edited. The invoice it was raised against is fixed.";
    $("#srFormSaveBtn").textContent = "Save Changes";
    populateInvoiceOptions(record.linkedInvoiceId);
    $("#srFormInvoice").value = record.linkedInvoiceId;
    // The picker stays locked in Edit mode — changing the parent invoice
    // would invalidate every line. Same treatment Delivery Challan and
    // Tax Invoice give their own parent pickers.
    $("#srFormInvoice").disabled = true;
    populateWarehouseOptions(record.returnToWarehouseId);
    populateReasonOptions(record.reason);
    populateEmployeeOptions(record.receivedByEmployeeId);
    $("#srFormReturnDate").value = record.returnDate || "";
    $("#srFormRemarks").value = record.remarks || "";
    $("#srFormInvoiceError").textContent = "";
    $("#srFormWarehouseError").textContent = "";
    $("#srFormLinesError").textContent = "";
    $("#srFormInvoiceInfo").textContent =
      `Customer: ${customerLabel(record.customerId)} · Invoice date: ${selectedInvoice.invoiceDate || "—"}`;
    rebuildDraftLines(selectedInvoice, record.returnLines);
    renderFormLines();
    closeModal("srDetailModal");
    openModal("srFormModal");
  }

  function validateForm() {
    let valid = true;
    $("#srFormInvoiceError").textContent = "";
    $("#srFormWarehouseError").textContent = "";
    $("#srFormLinesError").textContent = "";

    if (!selectedInvoice) {
      $("#srFormInvoiceError").textContent = "Pick the invoice these goods were sold on.";
      valid = false;
    }
    if (!$("#srFormWarehouse").value) {
      $("#srFormWarehouseError").textContent = "Pick the warehouse the goods are coming back into.";
      valid = false;
    }
    if (selectedInvoice) {
      const result = ERP_SalesReturnRepository.validateQuantities(company.id, selectedInvoice, draftLines, editingId);
      if (!result.ok) {
        $("#srFormLinesError").textContent = result.errors[0].message;
        valid = false;
      }
    }
    return valid;
  }

  function bindFormModal() {
    $("#srAddBtn").addEventListener("click", openAddModal);
    $("#srFormInvoice").addEventListener("change", onInvoicePicked);

    // Delegated at tbody level — no per-row listeners to rebind on every
    // re-render (Journal Entry's own established pattern).
    $("#srFormLinesBody").addEventListener("input", (e) => {
      const qtyInput = e.target.closest(".sr-line-qty");
      if (qtyInput) {
        const line = draftLines.find((l) => l.id === qtyInput.dataset.lineId);
        if (!line) return;
        line.returnQuantity = Number(qtyInput.value) || 0;
        updateTotalQty();
        return;
      }
      const conditionSelect = e.target.closest(".sr-line-condition");
      if (conditionSelect) {
        const line = draftLines.find((l) => l.id === conditionSelect.dataset.lineId);
        if (!line) return;
        line.condition = conditionSelect.value;
      }
    });

    $("#srFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const payload = {
        returnToWarehouseId: $("#srFormWarehouse").value || null,
        returnDate: $("#srFormReturnDate").value || new Date().toISOString().slice(0, 10),
        reason: $("#srFormReason").value,
        receivedByEmployeeId: $("#srFormReceivedBy").value || null,
        remarks: $("#srFormRemarks").value.trim(),
        returnLines: draftLines
      };
      if (editingId) {
        const updated = ERP_SalesReturnRepository.update(editingId, payload);
        if (!updated) { showToast("Couldn't save — only a Draft can be edited.", "danger"); return; }
        logSystemActivity({ module: "Sales Return", action: "Update", description: `Updated sales return "${updated.returnCode}" (${company.name})` });
        showToast("Sales return updated.", "success");
      } else {
        const created = ERP_SalesReturnRepository.create(company, selectedInvoice, payload, session.username);
        logSystemActivity({ module: "Sales Return", action: "Create", description: `Created sales return "${created.returnCode}" against invoice ${invoiceLabel(created.linkedInvoiceId)} (${company.name})` });
        showToast("Sales return saved as Draft — post it to take the goods back into stock.", "success");
      }
      closeModal("srFormModal");
      editingId = null;
      renderAll();
      renderActivity();
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function renderDetailFooter(record) {
    const footer = $("#srDetailFooter");
    footer.innerHTML = "";

    if (record.status === "Draft") {
      const postBtn = document.createElement("button");
      postBtn.type = "button";
      postBtn.className = "btn btn--primary";
      postBtn.textContent = "Post (takes goods back into stock)";
      postBtn.disabled = !ERP_SalesReturnRepository.canPost(record);
      postBtn.addEventListener("click", () => requestPost(record));
      footer.appendChild(postBtn);

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn--ghost";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openEditModal(record));
      footer.appendChild(editBtn);

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn--danger-outline";
      cancelBtn.textContent = "Cancel Return";
      cancelBtn.addEventListener("click", () => requestCancel(record));
      footer.appendChild(cancelBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn btn--ghost";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => closeModal("srDetailModal"));
    footer.appendChild(closeBtn);
  }

  function openDetailModal(record) {
    const receivedBy = record.receivedByEmployeeId && typeof ERP_EmployeeRepository !== "undefined"
      ? ERP_EmployeeRepository.findById(record.receivedByEmployeeId) : null;

    $("#srDetailTitle").textContent = `Sales Return — ${record.returnCode}`;
    $("#srDetailBody").innerHTML = `
      <div><dt>Return Code</dt><dd><code>${escapeHtml(record.returnCode)}</code></dd></div>
      <div><dt>Against Invoice</dt><dd>${escapeHtml(invoiceLabel(record.linkedInvoiceId))}</dd></div>
      <div><dt>Customer</dt><dd>${escapeHtml(customerLabel(record.customerId))}</dd></div>
      <div><dt>Return To Warehouse</dt><dd>${escapeHtml(warehouseLabel(record.returnToWarehouseId))}</dd></div>
      <div><dt>Reason</dt><dd>${escapeHtml(record.reason || "—")}</dd></div>
      <div><dt>Return Date</dt><dd>${record.returnDate || "—"}</dd></div>
      <div><dt>Total Quantity Returned</dt><dd>${formatQty(ERP_SalesReturnRepository.computeTotalReturnQuantity(record))}</dd></div>
      <div><dt>Received By</dt><dd>${receivedBy ? escapeHtml(receivedBy.fullName) : "<span class=\"profile-subtle\">Not specified</span>"}</dd></div>
      <div><dt>Remarks</dt><dd>${record.remarks ? escapeHtml(record.remarks) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(record.status)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(record.createdAt))} by ${escapeHtml(actorLabel(record.createdByUsername))}</dd></div>
      ${record.status === "Returned" ? `<div><dt>Posted</dt><dd>${formatDateTime(new Date(record.returnedAt))} by ${escapeHtml(actorLabel(record.returnedByUsername))}</dd></div>` : ""}
      ${record.status === "Cancelled" ? `<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(record.cancelledAt))} by ${escapeHtml(actorLabel(record.cancelledByUsername))}</dd></div>` : ""}
      <div><dt>Credit Note</dt><dd>${creditNoteRow(record)}</dd></div>
    `;

    const lines = record.returnLines || [];
    $("#srDetailLinesBody").innerHTML = lines.map((l) => `
      <tr>
        <td>${escapeHtml(l.lineDescription || itemLabel(l.itemId))}</td>
        <td class="text-right">${formatQty(l.invoicedQuantity)}</td>
        <td class="text-right">${formatQty(l.returnQuantity)}</td>
        <td>${(Number(l.returnQuantity) || 0) > 0 ? escapeHtml(l.condition === "Damaged / Scrap" ? "Damaged / Scrap" : "Resalable") : "—"}</td>
      </tr>`).join("");
    $("#srDetailLinesEmpty").hidden = lines.length !== 0;

    renderDetailFooter(record);
    openModal("srDetailModal");
  }

  /** Forward-looking row for Credit Note (Module 02 of this phase).
      Typeof-guarded so this page works correctly both before and after
      that module exists — the same shape every retrofit hook in this
      project uses. */
  function creditNoteRow(record) {
    if (typeof ERP_CreditNoteRepository === "undefined") {
      return `<span class="profile-subtle">Credit Note isn't built yet — the financial side of this return is still open.</span>`;
    }
    const note = ERP_CreditNoteRepository.findNoteForReturn(company.id, record.id);
    if (!note) return `<span class="profile-subtle">No credit note raised yet.</span>`;
    return `${escapeHtml(note.noteCode)} — ${escapeHtml(note.status)}`;
  }

  function requestPost(record) {
    if (!ERP_SalesReturnRepository.canPost(record)) return;
    openConfirm({
      title: "Post this sales return?",
      message: "This writes one Stock Ledger entry per returned line, bringing the goods back into the chosen warehouse at their current weighted-average cost. Stock Ledger entries can't be edited or removed, so this can't be undone — a correction needs its own separate document. The money side is handled separately, by a Credit Note.",
      confirmLabel: "Post",
      onConfirm: () => {
        const result = ERP_SalesReturnRepository.post(record.id, company, session.username);
        if (result.success) {
          logSystemActivity({ module: "Sales Return", action: "Post", description: `Posted sales return "${result.record.returnCode}" — ${result.linesPosted} stock line(s) returned (${company.name})` });

          // Books the physical inventory/COGS reversal to the General
          // Ledger — the half Credit Note never covers — split by each
          // line's own condition. See gl-posting-data.js's own
          // postSalesReturnCogs().
          if (typeof ERP_GlPostingRepository !== "undefined" && result.costedLines && result.costedLines.length) {
            const glResult = ERP_GlPostingRepository.postSalesReturnCogs(company, result.record, result.costedLines, session.username);
            if (glResult.success && !glResult.skipped) {
              logSystemActivity({ module: "Sales Return", action: "Auto-Post", description: `Posted cost reversal for sales return "${result.record.returnCode}" (${company.name})` });
            } else if (!glResult.success) {
              showToast(glResult.reason, "warning", { title: "Not posted to the books" });
            }
          }

          closeModal("srDetailModal");
          renderAll();
          renderActivity();
          showToast(`Took ${formatQty(ERP_SalesReturnRepository.computeTotalReturnQuantity(result.record))} unit(s) back into stock. Raise a Credit Note next to settle the money side.`, "success");
        } else {
          showToast(result.reason || "Couldn't post this return.", "danger");
        }
      }
    });
  }

  function requestCancel(record) {
    openConfirm({
      title: "Cancel this draft?",
      message: "This draft was never posted, so nothing has been written to the Stock Ledger — cancelling is safe, and it frees the quantities back up for another return against the same invoice.",
      confirmLabel: "Cancel Return",
      onConfirm: () => {
        ERP_SalesReturnRepository.cancel(record.id, session.username);
        logSystemActivity({ module: "Sales Return", action: "Cancel", description: `Cancelled sales return "${record.returnCode}" (${company.name})` });
        closeModal("srDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#srTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const record = ERP_SalesReturnRepository.findById(viewBtn.dataset.id);
      if (record) openDetailModal(record);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "sales-return")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading sales returns…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#srContent").hidden = true;
      $("#srSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#srContent").hidden = false;
      $("#srHeaderActions").hidden = false;
      $("#srSubtitle").textContent = `Managing sales returns for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
