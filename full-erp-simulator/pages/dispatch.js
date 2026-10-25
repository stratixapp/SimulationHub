/* =============================================================================
   DOT ERP — pages/dispatch.js
   Phase 5, Module 7: Dispatch

   See data/dispatch-data.js's header for the full design rationale
   (built from the Tax Invoice, not the Delivery Challan; header-only,
   no line items; the "Dispatched" terminal status Delivery Challan
   deliberately kept free). UI-layer decisions on top of that:

   - MODE OF TRANSPORT IS A FIXED, SMALL VOCABULARY
     (`ERP_DispatchRepository.transportModes`), looped into a `<select>`
     the same "controlled vocabulary earns a loop" discipline Vendor
     Payment's own `.paymentMethods` established.
   - THE INVOICE PICKER LOCKS IN EDIT MODE, EXPLICITLY RE-ENABLED WHEN
     ADD OPENS NEXT — the bug Delivery Challan's own header documents
     finding and fixing, applied proactively here from the start (the
     same discipline Tax Invoice already followed).
   - CUSTOMER IS RESOLVED DIRECTLY OFF THE INVOICE'S OWN STORED
     `customerId` — no chain-walk needed, since Tax Invoice already
     copied that field at its own creation.
   - REQUIRED FIELDS BEYOND THE INVOICE PICKER: Transporter Name,
     Vehicle Number, Mode of Transport, Dispatch Date — the four facts
     that make a dispatch record actually traceable (see this page's
     own Help Guide "Common Mistakes"). Driver details, LR number,
     expected delivery, and remarks stay optional, the same "not every
     field on a real-world document is mandatory in the simulator"
     balance every earlier form in this codebase has struck.
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
    if (status === "Dispatched") return "success";
    if (status === "Cancelled") return "neutral";
    return "warning"; // Draft
  }

  function quickActionFor(d) {
    if (d.status === "Draft") return { action: "dispatch", label: "Mark Dispatched" };
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
    let rows = ERP_DispatchRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((d) => d.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((d) => {
        const invoice = d.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(d.linkedInvoiceId) : null;
        const cust = invoice ? resolveCustomer(invoice) : null;
        return d.dispatchCode.toLowerCase().includes(term) ||
          (invoice && invoice.invoiceCode.toLowerCase().includes(term)) ||
          (cust && cust.customerName.toLowerCase().includes(term)) ||
          (d.transporterName || "").toLowerCase().includes(term) ||
          (d.vehicleNumber || "").toLowerCase().includes(term) ||
          (d.lrNumber || "").toLowerCase().includes(term);
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_DispatchRepository.getAllForCompany(company.id);
    $("#dispSummaryTotal").textContent = String(all.length);
    $("#dispSummaryDraft").textContent = String(all.filter((d) => d.status === "Draft").length);
    $("#dispSummaryDispatched").textContent = String(all.filter((d) => d.status === "Dispatched").length);
    $("#dispSummaryCancelled").textContent = String(all.filter((d) => d.status === "Cancelled").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#dispPagination");
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

    $("#dispEmptyState").hidden = all.length !== 0;
    $("#dispTable").hidden = all.length === 0;

    $("#dispTableBody").innerHTML = pageItems.map((d) => {
      const invoice = d.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(d.linkedInvoiceId) : null;
      const cust = invoice ? resolveCustomer(invoice) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(d.status)}">${d.status}</span>`;
      const qa = quickActionFor(d);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${d.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(d.dispatchCode)}</code></td>
        <td>${invoice ? `<code>${escapeHtml(invoice.invoiceCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${d.transporterName ? escapeHtml(d.transporterName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${d.vehicleNumber ? escapeHtml(d.vehicleNumber) : `<span class="profile-subtle">—</span>`}</td>
        <td>${d.dispatchDate ? escapeHtml(d.dispatchDate) : `<span class="profile-subtle">—</span>`}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${d.id}">View</button>
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
    $$("#dispStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#dispStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#dispSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#dispSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#dispExportCsvBtn").addEventListener("click", exportCsv);
    $("#dispPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Dispatch Code", "Invoice Code", "Customer", "Transporter", "Vehicle Number", "Mode", "LR Number", "Dispatch Date", "Expected Delivery", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((d) => {
      const invoice = d.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(d.linkedInvoiceId) : null;
      const cust = invoice ? resolveCustomer(invoice) : null;
      const line = [
        d.dispatchCode, invoice ? invoice.invoiceCode : "", cust ? cust.customerName : "",
        d.transporterName || "", d.vehicleNumber || "", d.modeOfTransport || "", d.lrNumber || "",
        d.dispatchDate || "", d.expectedDeliveryDate || "", d.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-dispatches-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Dispatches exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((d) => {
      const invoice = d.linkedInvoiceId ? ERP_TaxInvoiceRepository.findById(d.linkedInvoiceId) : null;
      const cust = invoice ? resolveCustomer(invoice) : null;
      return `<tr><td>${escapeHtml(d.dispatchCode)}</td><td>${cust ? escapeHtml(cust.customerName) : ""}</td><td>${escapeHtml(d.transporterName || "")}</td><td>${escapeHtml(d.vehicleNumber || "")}</td><td>${escapeHtml(d.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Dispatch Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Dispatch Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Dispatch Code</th><th>Customer</th><th>Transporter</th><th>Vehicle No.</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Dispatch")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#dispActivityEmptyState").hidden = relevant.length !== 0;
    $("#dispActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#dispFormModal)
     --------------------------------------------------------------------- */
  function populateInvoiceOptions(currentId) {
    let invoices = ERP_DispatchRepository.getAvailableRaisedInvoicesForCompany(company.id, editingId);
    if (currentId && !invoices.some((inv) => inv.id === currentId)) {
      const current = ERP_TaxInvoiceRepository.findById(currentId);
      if (current) invoices = invoices.concat([current]);
    }
    $("#dispFormInvoice").innerHTML = invoices.map((inv) => {
      const cust = resolveCustomer(inv);
      const label = `${inv.invoiceCode}${cust ? ` — ${cust.customerName}` : ""}`;
      return `<option value="${inv.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function populateModeOptions() {
    $("#dispFormMode").innerHTML = `<option value="">Not set</option>` +
      ERP_DispatchRepository.transportModes.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
  }

  function populateEmployeeOptions(currentId) {
    let employees = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status === "Active");
    if (currentId && !employees.some((e) => e.id === currentId)) {
      const current = ERP_EmployeeRepository.findById(currentId);
      if (current) employees = employees.concat([current]);
    }
    $("#dispFormDispatchedBy").innerHTML = `<option value="">Unassigned</option>` +
      employees.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)}</option>`).join("");
  }

  function renderInvoiceInfo(invoice) {
    const box = $("#dispFormInvoiceInfo");
    if (!invoice) { box.textContent = ""; return; }
    const cust = resolveCustomer(invoice);
    box.textContent = `Customer: ${cust ? cust.customerName : "Removed"} — from ${invoice.invoiceCode}.`;
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["dispFormInvoice", "dispFormTransporter", "dispFormVehicle", "dispFormMode", "dispFormDispatchDate"].forEach((f) => setFormError(f, ""));
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function openAddModal() {
    const available = ERP_DispatchRepository.getAvailableRaisedInvoicesForCompany(company.id, null);
    if (!available.length) {
      showToast("No Raised tax invoices are currently available to arrange dispatch for. Raise one in Tax Invoice first.", "warning");
      return;
    }
    editingId = null;
    $("#dispFormTitle").textContent = "New dispatch";
    $("#dispFormIntro").textContent = "Pick the Raised tax invoice to arrange dispatch for.";
    $("#dispFormSaveBtn").textContent = "Create Dispatch";
    // Explicitly re-enable — a shared DOM element's disabled state
    // doesn't reset itself between modal opens (Delivery Challan's own
    // header documents finding this bug; applied proactively here).
    $("#dispFormInvoice").disabled = false;
    populateInvoiceOptions(null);
    const firstInvoice = ERP_TaxInvoiceRepository.findById($("#dispFormInvoice").value);
    renderInvoiceInfo(firstInvoice);
    populateModeOptions();
    populateEmployeeOptions(null);
    $("#dispFormTransporter").value = "";
    $("#dispFormMode").value = "";
    $("#dispFormVehicle").value = "";
    $("#dispFormLr").value = "";
    $("#dispFormDriverName").value = "";
    $("#dispFormDriverContact").value = "";
    $("#dispFormDispatchDate").value = todayISO();
    $("#dispFormExpectedDelivery").value = "";
    $("#dispFormDispatchedBy").value = "";
    $("#dispFormRemarks").value = "";
    clearFormErrors();
    openModal("dispFormModal");
  }

  function openEditModal(d) {
    if (!ERP_DispatchRepository.canEdit(d)) {
      showToast(`"${d.dispatchCode}" is ${d.status} and can't be edited directly. Reopen it to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = d.id;
    $("#dispFormTitle").textContent = "Edit dispatch";
    $("#dispFormIntro").textContent = "Update the transport details. The linked invoice is locked once created.";
    $("#dispFormSaveBtn").textContent = "Save Changes";
    populateInvoiceOptions(d.linkedInvoiceId);
    $("#dispFormInvoice").value = d.linkedInvoiceId || "";
    $("#dispFormInvoice").disabled = true;
    const invoice = ERP_TaxInvoiceRepository.findById(d.linkedInvoiceId);
    renderInvoiceInfo(invoice);
    populateModeOptions();
    populateEmployeeOptions(d.dispatchedByEmployeeId);
    $("#dispFormTransporter").value = d.transporterName || "";
    $("#dispFormMode").value = d.modeOfTransport || "";
    $("#dispFormVehicle").value = d.vehicleNumber || "";
    $("#dispFormLr").value = d.lrNumber || "";
    $("#dispFormDriverName").value = d.driverName || "";
    $("#dispFormDriverContact").value = d.driverContactNumber || "";
    $("#dispFormDispatchDate").value = d.dispatchDate || todayISO();
    $("#dispFormExpectedDelivery").value = d.expectedDeliveryDate || "";
    $("#dispFormDispatchedBy").value = d.dispatchedByEmployeeId || "";
    $("#dispFormRemarks").value = d.remarks || "";
    clearFormErrors();
    openModal("dispFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!editingId && !$("#dispFormInvoice").value) { setFormError("dispFormInvoice", "Select the Raised tax invoice to arrange dispatch for."); valid = false; }
    if (!$("#dispFormTransporter").value.trim()) { setFormError("dispFormTransporter", "Transporter name is required."); valid = false; }
    if (!$("#dispFormVehicle").value.trim()) { setFormError("dispFormVehicle", "Vehicle number is required."); valid = false; }
    if (!$("#dispFormMode").value) { setFormError("dispFormMode", "Select a mode of transport."); valid = false; }
    if (!$("#dispFormDispatchDate").value) { setFormError("dispFormDispatchDate", "Dispatch date is required."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#dispAddBtn").addEventListener("click", openAddModal);

    $("#dispFormInvoice").addEventListener("change", (e) => {
      const invoice = ERP_TaxInvoiceRepository.findById(e.target.value);
      renderInvoiceInfo(invoice);
    });

    $("#dispFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const invoice = editingId
        ? ERP_TaxInvoiceRepository.findById(ERP_DispatchRepository.findById(editingId).linkedInvoiceId)
        : ERP_TaxInvoiceRepository.findById($("#dispFormInvoice").value);
      const label = invoice ? invoice.invoiceCode : "this invoice";

      const payload = {
        transporterName: $("#dispFormTransporter").value.trim(),
        modeOfTransport: $("#dispFormMode").value,
        vehicleNumber: $("#dispFormVehicle").value.trim(),
        lrNumber: $("#dispFormLr").value.trim(),
        driverName: $("#dispFormDriverName").value.trim(),
        driverContactNumber: $("#dispFormDriverContact").value.trim(),
        dispatchDate: $("#dispFormDispatchDate").value || null,
        expectedDeliveryDate: $("#dispFormExpectedDelivery").value || null,
        dispatchedByEmployeeId: $("#dispFormDispatchedBy").value || null,
        remarks: $("#dispFormRemarks").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this dispatch?",
          message: `This dispatch for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_DispatchRepository.update(editingId, payload);
            logSystemActivity({ module: "Dispatch", action: "Update", description: `Updated dispatch for ${label} (${company.name})` });
            closeModal("dispFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_DispatchRepository.findById(editingId));
            showToast("Dispatch updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this dispatch?",
          message: `A new dispatch will be created as a Draft for ${label}.`,
          confirmLabel: "Create Dispatch",
          onConfirm: () => {
            payload.linkedInvoiceId = $("#dispFormInvoice").value;
            const created = ERP_DispatchRepository.create(company, payload);
            logSystemActivity({ module: "Dispatch", action: "Create", description: `Created dispatch "${created.dispatchCode}" for ${label} (${company.name})` });
            closeModal("dispFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.dispatchCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestMarkDispatched(d) {
    openConfirm({
      title: "Mark this dispatch as sent?",
      message: `"${d.dispatchCode}" will be marked Dispatched — treat this as the factual record that the goods left.`,
      confirmLabel: "Mark Dispatched",
      onConfirm: () => {
        ERP_DispatchRepository.markDispatched(d.id, session.username);
        logSystemActivity({ module: "Dispatch", action: "Mark Dispatched", description: `Marked dispatch "${d.dispatchCode}" as Dispatched (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === d.id) openDetailModal(ERP_DispatchRepository.findById(d.id));
        showToast(`"${d.dispatchCode}" marked Dispatched.`, "success");
      }
    });
  }

  function requestReopen(d) {
    openConfirm({
      title: "Reopen this dispatch?",
      message: `"${d.dispatchCode}" will move back to Draft so you can correct it.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_DispatchRepository.reopen(d.id);
        logSystemActivity({ module: "Dispatch", action: "Reopen", description: `Reopened dispatch "${d.dispatchCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === d.id) openDetailModal(ERP_DispatchRepository.findById(d.id));
        showToast(`"${d.dispatchCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(d) {
    openConfirm({
      title: "Cancel this dispatch?",
      message: `"${d.dispatchCode}" will be marked Cancelled and its tax invoice freed up for a different dispatch.`,
      confirmLabel: "Cancel Dispatch",
      onConfirm: () => {
        ERP_DispatchRepository.cancel(d.id, session.username);
        logSystemActivity({ module: "Dispatch", action: "Cancel", description: `Cancelled dispatch "${d.dispatchCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === d.id) openDetailModal(ERP_DispatchRepository.findById(d.id));
        showToast(`"${d.dispatchCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(d) {
    if (!ERP_DispatchRepository.canDelete(d)) {
      showToast(`"${d.dispatchCode}" is ${d.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this dispatch?",
      message: `"${d.dispatchCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_DispatchRepository.remove(d.id);
        logSystemActivity({ module: "Dispatch", action: "Delete", description: `Deleted dispatch "${d.dispatchCode}" (${company.name})`, severity: "warning" });
        if (detailId === d.id) closeModal("dispDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${d.dispatchCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(d) {
    const footer = $("#dispDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (d.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(d));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("dispDetailModal"); openEditModal(d); });
      addBtn("Mark Dispatched", "btn btn--primary", () => requestMarkDispatched(d));
    } else if (d.status === "Dispatched") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(d));
      addBtn("Reopen to Draft", "btn btn--ghost", () => requestReopen(d));
    } else if (d.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(d));
    }
  }

  function openDetailModal(d) {
    detailId = d.id;
    const invoice = ERP_TaxInvoiceRepository.findById(d.linkedInvoiceId);
    const cust = invoice ? resolveCustomer(invoice) : null;
    const dispatchedBy = d.dispatchedByEmployeeId ? ERP_EmployeeRepository.findById(d.dispatchedByEmployeeId) : null;

    $("#dispDetailTitle").textContent = `${d.dispatchCode} · ${d.status}`;

    const rows = [];
    rows.push(`<div><dt>Dispatch Code</dt><dd><code>${escapeHtml(d.dispatchCode)}</code></dd></div>`);
    rows.push(`<div><dt>Tax Invoice</dt><dd>${invoice ? `<code>${escapeHtml(invoice.invoiceCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Customer</dt><dd>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Transporter</dt><dd>${d.transporterName ? escapeHtml(d.transporterName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Mode of Transport</dt><dd>${d.modeOfTransport ? escapeHtml(d.modeOfTransport) : "—"}</dd></div>`);
    rows.push(`<div><dt>Vehicle Number</dt><dd>${d.vehicleNumber ? escapeHtml(d.vehicleNumber) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>LR / Tracking Number</dt><dd>${d.lrNumber ? escapeHtml(d.lrNumber) : "—"}</dd></div>`);
    if (d.driverName || d.driverContactNumber) {
      rows.push(`<div><dt>Driver</dt><dd>${d.driverName ? escapeHtml(d.driverName) : "—"}${d.driverContactNumber ? ` · ${escapeHtml(d.driverContactNumber)}` : ""}</dd></div>`);
    }
    rows.push(`<div><dt>Dispatch Date</dt><dd>${d.dispatchDate ? escapeHtml(d.dispatchDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Expected Delivery</dt><dd>${d.expectedDeliveryDate ? escapeHtml(d.expectedDeliveryDate) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Dispatched By</dt><dd>${dispatchedBy ? escapeHtml(dispatchedBy.fullName) : "— unassigned —"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(d.status)}">${d.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(d.createdAt))}</dd></div>`);
    if (d.dispatchedAt) rows.push(`<div><dt>Marked Dispatched</dt><dd>${formatDateTime(new Date(d.dispatchedAt))} by ${escapeHtml(ERP_DispatchRepository.actorLabel(d.dispatchedByUsername))}</dd></div>`);
    if (d.status === "Cancelled" && d.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(d.cancelledAt))} by ${escapeHtml(ERP_DispatchRepository.actorLabel(d.cancelledByUsername))}</dd></div>`);
    // RETROFIT (Phase 16, Module 04): E-Way Bill IS exclusive over a
    // dispatch (findForDispatch() excludes Cancelled ones) — a genuine
    // single link, the same shape E-Invoice's own retrofit into Tax
    // Invoice used one module earlier, not an aggregate row.
    if (typeof ERP_EWayBillRepository !== "undefined") {
      const ewayBill = ERP_EWayBillRepository.findForDispatch(company.id, d.id);
      if (ewayBill) {
        const expired = ewayBill.status === "Generated" && ERP_EWayBillRepository.isExpired(ewayBill);
        const label = expired ? "Expired" : ewayBill.status;
        const badgeClass = expired ? "warning" : ewayBill.status === "Generated" ? "success" : "neutral";
        rows.push(`<div><dt>E-Way Bill</dt><dd><code>${escapeHtml(ewayBill.ebn)}</code> <span class="status-badge status-badge--${badgeClass}">${escapeHtml(label)}</span></dd></div>`);
      }
    }
    if (d.remarks) rows.push(`<div><dt>Remarks</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(d.remarks)}</dd></div>`);

    $("#dispDetailBody").innerHTML = rows.join("");
    renderDetailFooter(d);
    openModal("dispDetailModal");
  }

  function bindDetailModal() {
    $("#dispTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const d = ERP_DispatchRepository.findById(viewBtn.dataset.id);
        if (d) openDetailModal(d);
        return;
      }
      if (actionBtn) {
        const d = ERP_DispatchRepository.findById(actionBtn.dataset.id);
        if (!d) return;
        if (actionBtn.dataset.action === "dispatch") requestMarkDispatched(d);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "dispatch")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading dispatches…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#dispContent").hidden = true;
      $("#dispSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#dispContent").hidden = false;
      $("#dispHeaderActions").hidden = false;
      $("#dispSubtitle").textContent = `Arranging dispatch for ${company.name} (${company.companyCode}).`;

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
