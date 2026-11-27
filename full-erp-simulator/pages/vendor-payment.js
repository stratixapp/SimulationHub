/* =============================================================================
   DOT ERP — pages/vendor-payment.js
   Phase 4, Module 19: Vendor Payment

   See data/vendor-payment-data.js's header for the full design rationale
   (built from an Approved payment request, no line items, amountPaid
   defaults but stays editable for partial payments, the simple 3-state
   "administrative execution, not another decision" lifecycle). UI-layer
   decisions on top of that:

   - PAYMENT METHOD IS A FIXED, SMALL VOCABULARY (`ERP_VendorPaymentRepository
     .paymentMethods`), looped over into a `<select>` the same
     "controlled vocabulary with more than 2-3 members earns a loop, not
     hardcoded options" discipline Vendor Evaluation's `.scoreCriteria`
     established (CONTINUE_HERE.md Section 9).
   - "PAY TO" BANK DETAILS reuse the exact same resolution Payment
     Request's own page uses (`ERP_VendorRepository.getEffectiveBankDetails()`),
     resolved by walking request -> match -> PO -> vendor.
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
    if (status === "Paid") return "success";
    if (status === "Cancelled") return "neutral";
    return "warning"; // Draft
  }

  function quickActionFor(v) {
    if (v.status === "Draft") return { action: "pay", label: "Mark Paid" };
    return null;
  }

  /** request -> match -> PO -> vendor, resolving who this payment is to. */
  function resolveVendor(request) {
    if (!request) return null;
    const match = ERP_ThreeWayMatchingRepository.findById(request.linkedMatchId);
    if (!match) return null;
    const { po } = ERP_ThreeWayMatchingRepository.computeMatchLines(company, match);
    return po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_VendorPaymentRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((v) => v.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((v) => {
        const request = v.linkedRequestId ? ERP_PaymentRequestRepository.findById(v.linkedRequestId) : null;
        const vendor = request ? resolveVendor(request) : null;
        return v.paymentCode.toLowerCase().includes(term) ||
          (request && request.requestCode.toLowerCase().includes(term)) ||
          (vendor && vendor.vendorName.toLowerCase().includes(term)) ||
          (v.transactionReference || "").toLowerCase().includes(term);
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_VendorPaymentRepository.getAllForCompany(company.id);
    $("#vpSummaryTotal").textContent = String(all.length);
    $("#vpSummaryDraft").textContent = String(all.filter((v) => v.status === "Draft").length);
    $("#vpSummaryPaid").textContent = String(all.filter((v) => v.status === "Paid").length);
    $("#vpSummaryCancelled").textContent = String(all.filter((v) => v.status === "Cancelled").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#vpPagination");
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

    $("#vpEmptyState").hidden = all.length !== 0;
    $("#vpTable").hidden = all.length === 0;

    $("#vpTableBody").innerHTML = pageItems.map((v) => {
      const request = v.linkedRequestId ? ERP_PaymentRequestRepository.findById(v.linkedRequestId) : null;
      const vendor = request ? resolveVendor(request) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(v.status)}">${v.status}</span>`;
      const amountLabel = v.amountPaid != null ? formatCurrency(v.amountPaid) : `<span class="profile-subtle">—</span>`;
      const qa = quickActionFor(v);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${v.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(v.paymentCode)}</code></td>
        <td>${request ? `<code>${escapeHtml(request.requestCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${amountLabel}</td>
        <td>${v.paymentDate ? escapeHtml(v.paymentDate) : `<span class="profile-subtle">—</span>`}</td>
        <td>${v.paymentMethod ? escapeHtml(v.paymentMethod) : `<span class="profile-subtle">—</span>`}</td>
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
    $$("#vpStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#vpStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#vpSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#vpSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#vpExportCsvBtn").addEventListener("click", exportCsv);
    $("#vpPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Payment Code", "Request Code", "Vendor", "Amount Paid", "Payment Date", "Method", "Reference", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((v) => {
      const request = v.linkedRequestId ? ERP_PaymentRequestRepository.findById(v.linkedRequestId) : null;
      const vendor = request ? resolveVendor(request) : null;
      const line = [
        v.paymentCode, request ? request.requestCode : "", vendor ? vendor.vendorName : "",
        v.amountPaid != null ? v.amountPaid : "", v.paymentDate || "", v.paymentMethod || "", v.transactionReference || "", v.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-vendor-payments-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Vendor payments exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((v) => {
      const request = v.linkedRequestId ? ERP_PaymentRequestRepository.findById(v.linkedRequestId) : null;
      const vendor = request ? resolveVendor(request) : null;
      return `<tr><td>${escapeHtml(v.paymentCode)}</td><td>${vendor ? escapeHtml(vendor.vendorName) : ""}</td><td>${v.amountPaid != null ? escapeHtml(formatCurrency(v.amountPaid)) : ""}</td><td>${escapeHtml(v.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Vendor Payment Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Vendor Payment Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Payment Code</th><th>Vendor</th><th>Amount</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Vendor Payment")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#vpActivityEmptyState").hidden = relevant.length !== 0;
    $("#vpActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#vpFormModal)
     --------------------------------------------------------------------- */
  function populateRequestOptions(currentId) {
    let requests = ERP_VendorPaymentRepository.getAvailableApprovedRequestsForCompany(company.id, editingId);
    if (currentId && !requests.some((r) => r.id === currentId)) {
      const current = ERP_PaymentRequestRepository.findById(currentId);
      if (current) requests = requests.concat([current]);
    }
    $("#vpFormRequest").innerHTML = requests.map((r) => {
      const vendor = resolveVendor(r);
      const label = `${r.requestCode}${vendor ? ` — ${vendor.vendorName}` : ""}`;
      return `<option value="${r.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function populatePaymentMethodOptions() {
    $("#vpFormPaymentMethod").innerHTML = `<option value="">Not set</option>` +
      ERP_VendorPaymentRepository.paymentMethods.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
  }

  /** Same picker shape Receipt's own retrofit already established:
      Active banks only, masked label, defaults to the company's own
      default bank when adding fresh. See vendor-payment-data.js's own
      header for why this field didn't exist until now. */
  function populateBankOptions(currentId) {
    let banks = ERP_BankRepository.getActiveForCompany(company.id);
    if (currentId && !banks.some((b) => b.id === currentId)) {
      const current = ERP_BankRepository.findById(currentId);
      if (current) banks = [...banks, current];
    }
    $("#vpFormBank").innerHTML = `<option value="">Not set</option>` +
      banks.map((b) => `<option value="${b.id}">${escapeHtml(ERP_BankRepository.maskedLabel(b))}</option>`).join("");
  }

  function renderRequestInfo(request) {
    const box = $("#vpFormRequestInfo");
    if (!request) { box.textContent = ""; return; }
    const vendor = resolveVendor(request);
    const bank = vendor ? ERP_VendorRepository.getEffectiveBankDetails(vendor) : null;
    const bankLabel = bank && bank.accountNumber ? `${bank.bankName || "Bank"} · ${bank.accountNumber}` : "no bank details on file";
    box.textContent = `Vendor: ${vendor ? vendor.vendorName : "Removed"} — pays to ${bankLabel}.`;
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("vpFormRequest", ""); }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function openAddModal() {
    const available = ERP_VendorPaymentRepository.getAvailableApprovedRequestsForCompany(company.id, null);
    if (!available.length) {
      showToast("No Approved payment requests are currently available to record execution for. Approve one in Payment Request first.", "warning");
      return;
    }
    editingId = null;
    $("#vpFormTitle").textContent = "New vendor payment";
    $("#vpFormIntro").textContent = "Pick the Approved payment request to record execution for.";
    $("#vpFormSaveBtn").textContent = "Create Vendor Payment";
    populateRequestOptions(null);
    const firstRequest = ERP_PaymentRequestRepository.findById($("#vpFormRequest").value);
    renderRequestInfo(firstRequest);
    populatePaymentMethodOptions();
    populateBankOptions(null);
    $("#vpFormBank").value = (ERP_BankRepository.getDefault(company.id) || {}).id || "";
    $("#vpFormAmount").value = firstRequest && firstRequest.requestedAmount != null ? firstRequest.requestedAmount : "";
    $("#vpFormPaymentDate").value = todayISO();
    $("#vpFormReference").value = "";
    $("#vpFormNotes").value = "";
    clearFormErrors();
    openModal("vpFormModal");
  }

  function openEditModal(v) {
    if (!ERP_VendorPaymentRepository.canEdit(v)) {
      showToast(`"${v.paymentCode}" is ${v.status} and can't be edited directly. Reopen it to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = v.id;
    $("#vpFormTitle").textContent = "Edit vendor payment";
    $("#vpFormIntro").textContent = "Update which request this payment covers, or correct the amount/method/reference.";
    $("#vpFormSaveBtn").textContent = "Save Changes";
    populateRequestOptions(v.linkedRequestId);
    $("#vpFormRequest").value = v.linkedRequestId || "";
    const request = ERP_PaymentRequestRepository.findById(v.linkedRequestId);
    renderRequestInfo(request);
    populatePaymentMethodOptions();
    $("#vpFormPaymentMethod").value = v.paymentMethod || "";
    populateBankOptions(v.bankId);
    $("#vpFormBank").value = v.bankId || "";
    $("#vpFormAmount").value = v.amountPaid != null ? v.amountPaid : "";
    $("#vpFormPaymentDate").value = v.paymentDate || todayISO();
    $("#vpFormReference").value = v.transactionReference || "";
    $("#vpFormNotes").value = v.notes || "";
    clearFormErrors();
    openModal("vpFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#vpFormRequest").value) { setFormError("vpFormRequest", "Select the Approved payment request to record execution for."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#vpAddBtn").addEventListener("click", openAddModal);

    $("#vpFormRequest").addEventListener("change", (e) => {
      const request = ERP_PaymentRequestRepository.findById(e.target.value);
      renderRequestInfo(request);
      $("#vpFormAmount").value = request && request.requestedAmount != null ? request.requestedAmount : "";
    });

    $("#vpFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const request = ERP_PaymentRequestRepository.findById($("#vpFormRequest").value);
      const payload = {
        linkedRequestId: $("#vpFormRequest").value,
        paymentMethod: $("#vpFormPaymentMethod").value,
        bankId: $("#vpFormBank").value || null,
        amountPaid: $("#vpFormAmount").value === "" ? null : Number($("#vpFormAmount").value),
        paymentDate: $("#vpFormPaymentDate").value || null,
        transactionReference: $("#vpFormReference").value.trim(),
        notes: $("#vpFormNotes").value.trim()
      };

      const vendor = request ? resolveVendor(request) : null;
      const label = vendor ? vendor.vendorName : "this vendor";

      if (editingId) {
        openConfirm({
          title: "Save changes to this vendor payment?",
          message: `This vendor payment for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_VendorPaymentRepository.update(editingId, payload);
            logSystemActivity({ module: "Vendor Payment", action: "Update", description: `Updated vendor payment for ${label} (${company.name})` });
            closeModal("vpFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_VendorPaymentRepository.findById(editingId));
            showToast("Vendor payment updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this vendor payment?",
          message: `A new vendor payment will be created as a Draft for ${label}.`,
          confirmLabel: "Create Vendor Payment",
          onConfirm: () => {
            const created = ERP_VendorPaymentRepository.create(company, payload);
            logSystemActivity({ module: "Vendor Payment", action: "Create", description: `Created vendor payment "${created.paymentCode}" for ${label} (${company.name})` });
            closeModal("vpFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.paymentCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestMarkPaid(v) {
    openConfirm({
      title: "Mark this payment as executed?",
      message: `"${v.paymentCode}" will be marked Paid — treat this as the factual record that the money moved.`,
      confirmLabel: "Mark Paid",
      onConfirm: () => {
        ERP_VendorPaymentRepository.markPaid(v.id, session.username);
        logSystemActivity({ module: "Vendor Payment", action: "Mark Paid", description: `Marked vendor payment "${v.paymentCode}" as Paid (${company.name})` });

        if (typeof ERP_GlPostingRepository !== "undefined") {
          const glResult = ERP_GlPostingRepository.postVendorPayment(company, ERP_VendorPaymentRepository.findById(v.id), session.username);
          if (glResult.success) {
            logSystemActivity({ module: "Vendor Payment", action: "Auto-Post", description: `Auto-posted journal entry ${glResult.entry.entryNumber} for payment "${v.paymentCode}" (${company.name})` });
            showToast(`Posted to the General Ledger as ${glResult.entry.entryNumber}.`, "info", { title: "Journal Entry created" });
          } else {
            showToast(glResult.reason, "warning", { title: "Not posted to the books" });
          }
        }

        renderAll();
        renderActivity();
        if (detailId === v.id) openDetailModal(ERP_VendorPaymentRepository.findById(v.id));
        showToast(`"${v.paymentCode}" marked Paid.`, "success");
      }
    });
  }

  function requestReopen(v) {
    openConfirm({
      title: "Reopen this vendor payment?",
      message: `"${v.paymentCode}" will move back to Draft so you can correct it.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_VendorPaymentRepository.reopen(v.id);
        logSystemActivity({ module: "Vendor Payment", action: "Reopen", description: `Reopened vendor payment "${v.paymentCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === v.id) openDetailModal(ERP_VendorPaymentRepository.findById(v.id));
        showToast(`"${v.paymentCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(v) {
    openConfirm({
      title: "Cancel this vendor payment?",
      message: `"${v.paymentCode}" will be marked Cancelled and its payment request freed up for a different payment.`,
      confirmLabel: "Cancel Payment",
      onConfirm: () => {
        ERP_VendorPaymentRepository.cancel(v.id, session.username);
        logSystemActivity({ module: "Vendor Payment", action: "Cancel", description: `Cancelled vendor payment "${v.paymentCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === v.id) openDetailModal(ERP_VendorPaymentRepository.findById(v.id));
        showToast(`"${v.paymentCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(v) {
    if (!ERP_VendorPaymentRepository.canDelete(v)) {
      showToast(`"${v.paymentCode}" is ${v.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this vendor payment?",
      message: `"${v.paymentCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_VendorPaymentRepository.remove(v.id);
        logSystemActivity({ module: "Vendor Payment", action: "Delete", description: `Deleted vendor payment "${v.paymentCode}" (${company.name})`, severity: "warning" });
        if (detailId === v.id) closeModal("vpDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${v.paymentCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(v) {
    const footer = $("#vpDetailFooter");
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
      addBtn("Edit", "btn btn--ghost", () => { closeModal("vpDetailModal"); openEditModal(v); });
      addBtn("Mark Paid", "btn btn--primary", () => requestMarkPaid(v));
    } else if (v.status === "Paid") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(v));
      addBtn("Reopen to Draft", "btn btn--ghost", () => requestReopen(v));
    } else if (v.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(v));
    }
  }

  function openDetailModal(v) {
    detailId = v.id;
    const request = ERP_PaymentRequestRepository.findById(v.linkedRequestId);
    const vendor = request ? resolveVendor(request) : null;
    const bank = vendor ? ERP_VendorRepository.getEffectiveBankDetails(vendor) : null;

    $("#vpDetailTitle").textContent = `${v.paymentCode} · ${v.status}`;

    const rows = [];
    rows.push(`<div><dt>Payment Code</dt><dd><code>${escapeHtml(v.paymentCode)}</code></dd></div>`);
    rows.push(`<div><dt>Payment Request</dt><dd>${request ? `<code>${escapeHtml(request.requestCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Paid To</dt><dd>${bank && bank.accountNumber ? `${escapeHtml(bank.bankName || "Bank")} · ${escapeHtml(bank.accountNumber)}` : "— no bank details on file —"}</dd></div>`);
    const ourBank = v.bankId ? ERP_BankRepository.findById(v.bankId) : null;
    rows.push(`<div><dt>Paid From</dt><dd>${ourBank ? escapeHtml(ERP_BankRepository.maskedLabel(ourBank)) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Amount Paid</dt><dd>${v.amountPaid != null ? escapeHtml(formatCurrency(v.amountPaid)) : "—"}</dd></div>`);
    if (request && request.requestedAmount != null && v.amountPaid != null && Number(v.amountPaid) !== Number(request.requestedAmount)) {
      rows.push(`<div><dt>Requested Amount</dt><dd>${escapeHtml(formatCurrency(request.requestedAmount))} <span class="status-badge status-badge--warning">Differs from paid</span></dd></div>`);
    }
    rows.push(`<div><dt>Payment Date</dt><dd>${v.paymentDate ? escapeHtml(v.paymentDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Payment Method</dt><dd>${v.paymentMethod ? escapeHtml(v.paymentMethod) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Transaction Reference</dt><dd>${v.transactionReference ? escapeHtml(v.transactionReference) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(v.status)}">${v.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(v.createdAt))}</dd></div>`);
    if (v.paidAt) rows.push(`<div><dt>Paid</dt><dd>${formatDateTime(new Date(v.paidAt))} by ${escapeHtml(ERP_VendorPaymentRepository.actorLabel(v.paidByUsername))}</dd></div>`);
    if (v.status === "Cancelled" && v.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(v.cancelledAt))} by ${escapeHtml(ERP_VendorPaymentRepository.actorLabel(v.cancelledByUsername))}</dd></div>`);
    if (v.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(v.notes)}</dd></div>`);

    $("#vpDetailBody").innerHTML = rows.join("");
    renderDetailFooter(v);
    openModal("vpDetailModal");
  }

  function bindDetailModal() {
    $("#vpTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const v = ERP_VendorPaymentRepository.findById(viewBtn.dataset.id);
        if (v) openDetailModal(v);
        return;
      }
      if (actionBtn) {
        const v = ERP_VendorPaymentRepository.findById(actionBtn.dataset.id);
        if (!v) return;
        if (actionBtn.dataset.action === "pay") requestMarkPaid(v);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "vendor-payment")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading vendor payments…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#vpContent").hidden = true;
      $("#vpSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#vpContent").hidden = false;
      $("#vpHeaderActions").hidden = false;
      $("#vpSubtitle").textContent = `Recording vendor payments for ${company.name} (${company.companyCode}).`;

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
