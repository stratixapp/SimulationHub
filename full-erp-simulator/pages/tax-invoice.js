/* =============================================================================
   DOT ERP — pages/tax-invoice.js
   Phase 5, Module 6: Tax Invoice

   See data/tax-invoice-data.js's header for the full design rationale
   (the two-hop join — quantity from the challan, price from the sales
   order, matched by line id — the "Raised" status word chosen to dodge
   Delivery Challan's own "Issued," no payment tracking). UI-layer
   decisions on top of that:

   - THE INVOICE-LINE TABLE IS READ-ONLY, EVEN IN THE FORM. Same as GRN's
     own line table (its closest precedent) — a tax invoice is a faithful
     combination of numbers that already exist elsewhere (quantity from
     the challan, price from the sales order), not a place to type
     anything new. If a copied number is wrong, the fix belongs upstream.
   - Price/quantity resolution is a JOIN, not a chain-walk: `resolveJoin()`
     below finds the challan's own linked sales order directly (one hop,
     via `challan.salesOrderId` — Sales Order already stores that as a
     direct copy, so there's no need to walk further back through
     Quotation/Inquiry the way GRN had to walk three hops to reach a PO).
   - Due Date pre-fills from `invoiceDate + customer.creditPeriodDays` —
     see file header for why this is a genuinely new use of an
     already-existing Customer Master field, not an invented one.
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
    if (status === "Raised") return "success";
    if (status === "Cancelled") return "neutral";
    return "warning"; // Draft
  }

  function quickActionFor(invoice) {
    if (invoice.status === "Draft") return { action: "post", label: "Raise" };
    return null;
  }

  /** One hop: the challan's own linked sales order, direct — no further
      chain-walk needed (Sales Order already stores customerId/etc as its
      own copies, and Delivery Challan stores salesOrderId directly). */
  function resolveJoin(challan) {
    const salesOrder = challan ? ERP_SalesOrderRepository.findById(challan.salesOrderId) : null;
    return { salesOrder };
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_TaxInvoiceRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((inv) => inv.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((inv) => {
        const challan = inv.challanId ? ERP_DeliveryChallanRepository.findById(inv.challanId) : null;
        const cust = inv.customerId ? ERP_CustomerRepository.findById(inv.customerId) : null;
        return inv.invoiceCode.toLowerCase().includes(term) ||
          (challan && challan.challanCode.toLowerCase().includes(term)) ||
          (cust && cust.customerName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_TaxInvoiceRepository.getAllForCompany(company.id);
    $("#tiSummaryTotal").textContent = String(all.length);
    $("#tiSummaryDraft").textContent = String(all.filter((inv) => inv.status === "Draft").length);
    $("#tiSummaryLogged").textContent = String(all.filter((inv) => inv.status === "Raised").length);
    $("#tiSummaryCancelled").textContent = String(all.filter((inv) => inv.status === "Cancelled").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#tiPagination");
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

    $("#tiEmptyState").hidden = all.length !== 0;
    $("#tiTable").hidden = all.length === 0;

    $("#tiTableBody").innerHTML = pageItems.map((inv) => {
      const challan = inv.challanId ? ERP_DeliveryChallanRepository.findById(inv.challanId) : null;
      const cust = inv.customerId ? ERP_CustomerRepository.findById(inv.customerId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(inv.status)}">${inv.status}</span>`;
      const { total, pricedCount, totalCount } = ERP_TaxInvoiceRepository.computeGrandTotal(inv);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);
      const qa = quickActionFor(inv);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${inv.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(inv.invoiceCode)}</code></td>
        <td>${challan ? `<code>${escapeHtml(challan.challanCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${totalCount}</td>
        <td>${totalLabel}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${inv.id}">View</button>
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
    $$("#tiStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#tiStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#tiSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#tiSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#tiExportCsvBtn").addEventListener("click", exportCsv);
    $("#tiPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Invoice Code", "Challan Code", "Customer", "Lines", "Subtotal", "Tax", "Total", "Invoice Date", "Due Date", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((inv) => {
      const challan = inv.challanId ? ERP_DeliveryChallanRepository.findById(inv.challanId) : null;
      const cust = inv.customerId ? ERP_CustomerRepository.findById(inv.customerId) : null;
      const { subtotal, taxTotal, total, totalCount } = ERP_TaxInvoiceRepository.computeGrandTotal(inv);
      const line = [
        inv.invoiceCode, challan ? challan.challanCode : "", cust ? cust.customerName : "", totalCount,
        subtotal, taxTotal, total, inv.invoiceDate || "", inv.dueDate || "", inv.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-tax-invoices-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Tax invoices exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((inv) => {
      const cust = inv.customerId ? ERP_CustomerRepository.findById(inv.customerId) : null;
      const { total, totalCount } = ERP_TaxInvoiceRepository.computeGrandTotal(inv);
      return `<tr><td>${escapeHtml(inv.invoiceCode)}</td><td>${cust ? escapeHtml(cust.customerName) : ""}</td><td>${totalCount}</td><td>${escapeHtml(formatCurrency(total))}</td><td>${escapeHtml(inv.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Tax Invoice Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Tax Invoice Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Invoice Code</th><th>Customer</th><th>Lines</th><th>Total</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Tax Invoice")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#tiActivityEmptyState").hidden = relevant.length !== 0;
    $("#tiActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#tiFormModal) — the line table is read-only display, not
     inputs (see file header).
     --------------------------------------------------------------------- */
  function populateReceiptOptions(currentId) {
    let challans = ERP_TaxInvoiceRepository.getAvailableIssuedChallansForCompany(company.id, editingId);
    if (currentId && !challans.some((c) => c.id === currentId)) {
      const current = ERP_DeliveryChallanRepository.findById(currentId);
      if (current) challans = challans.concat([current]);
    }
    $("#tiFormSchedule").innerHTML = challans.map((c) => {
      const cust = c.customerId ? ERP_CustomerRepository.findById(c.customerId) : null;
      const label = `${c.challanCode}${cust ? ` — ${cust.customerName}` : ""}`;
      return `<option value="${c.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderReceiptInfo(challan) {
    const box = $("#tiFormScheduleInfo");
    if (!challan) { box.textContent = ""; return; }
    const cust = challan.customerId ? ERP_CustomerRepository.findById(challan.customerId) : null;
    box.textContent = `Customer: ${cust ? cust.customerName : "Removed"} — from ${challan.challanCode}.`;
  }

  /** The two-hop join, computed once per selection so the form can
      preview it before Save actually calls the repository's own
      buildInvoiceLines() — see tax-invoice-data.js's header. */
  function buildGrnLinesFromReceipt(challan) {
    if (!challan) return [];
    const { salesOrder } = resolveJoin(challan);
    if (!salesOrder) return [];
    return ERP_TaxInvoiceRepository.buildInvoiceLines(challan, salesOrder);
  }

  function renderLineDisplayTable(targetBodyId, invoiceLines) {
    if (!invoiceLines.length) {
      $("#" + targetBodyId).innerHTML = `<tr><td colspan="6"><span class="profile-subtle">Pick a delivery challan to load its lines.</span></td></tr>`;
      return;
    }
    $("#" + targetBodyId).innerHTML = invoiceLines.map((line) => {
      const hsn = line.hsnCodeId && typeof ERP_HsnRepository !== "undefined" ? ERP_HsnRepository.findById(line.hsnCodeId) : null;
      const tax = line.taxId && typeof ERP_TaxRepository !== "undefined" ? ERP_TaxRepository.findById(line.taxId) : null;
      const lineTotal = ERP_TaxInvoiceRepository.computeLineTotal(line);
      const lineTax = ERP_TaxInvoiceRepository.computeLineTax(line);
      const hsnLabel = hsn ? escapeHtml(hsn.hsnCode) : `<span class="profile-subtle">—</span>`;
      const priceLabel = line.unitPrice != null ? escapeHtml(formatCurrency(line.unitPrice)) : `<span class="profile-subtle">—</span>`;
      const taxLabel = tax ? `${escapeHtml(tax.taxName)} (${tax.ratePct}%)` : `<span class="profile-subtle">—</span>`;
      const totalLabel = lineTotal != null ? escapeHtml(formatCurrency(lineTotal + (lineTax || 0))) : `<span class="profile-subtle">—</span>`;
      return `<tr><td>${escapeHtml(line.lineDescription || "—")}</td><td>${hsnLabel}</td><td>${escapeHtml(String(line.quantity))}</td><td>${priceLabel}</td><td>${taxLabel}</td><td>${totalLabel}</td></tr>`;
    }).join("");
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("tiFormSchedule", ""); }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  /** invoiceDate + customer.creditPeriodDays — a convenience default
      only, editable afterward. See file header. */
  function computeDueDate(invoiceDateStr, customer) {
    if (!customer) return "";
    const d = new Date(invoiceDateStr + "T00:00:00");
    d.setDate(d.getDate() + (customer.creditPeriodDays || 0));
    return d.toISOString().slice(0, 10);
  }

  function applyDueDateDefault(challan) {
    const cust = challan && challan.customerId ? ERP_CustomerRepository.findById(challan.customerId) : null;
    const invDate = $("#tiFormInvoiceDate").value || todayISO();
    $("#tiFormDueDate").value = computeDueDate(invDate, cust);
    $("#tiFormDueDateHint").textContent = cust ? `Defaulted from ${cust.customerName}'s ${cust.creditPeriodDays}-day credit period — feel free to adjust.` : "";
  }

  let currentFormLines = [];

  function openAddModal() {
    const available = ERP_TaxInvoiceRepository.getAvailableIssuedChallansForCompany(company.id, null);
    if (!available.length) {
      showToast("No Issued delivery challans are currently available to raise an invoice for. Issue one in Delivery Challan first.", "warning");
      return;
    }
    editingId = null;
    $("#tiFormTitle").textContent = "New tax invoice";
    $("#tiFormIntro").textContent = "Pick the Issued delivery challan to raise an invoice for — quantity comes from the challan, price from the original sales order.";
    $("#tiFormSaveBtn").textContent = "Create Tax Invoice";
    $("#tiFormSchedule").disabled = false;
    populateReceiptOptions(null);
    const firstChallan = ERP_DeliveryChallanRepository.findById($("#tiFormSchedule").value);
    renderReceiptInfo(firstChallan);
    currentFormLines = buildGrnLinesFromReceipt(firstChallan);
    renderLineDisplayTable("tiFormLineTableBody", currentFormLines);
    $("#tiFormInvoiceDate").value = todayISO();
    applyDueDateDefault(firstChallan);
    $("#tiFormNotes").value = "";
    clearFormErrors();
    openModal("tiFormModal");
  }

  function openEditModal(invoice) {
    if (!ERP_TaxInvoiceRepository.canEdit(invoice)) {
      showToast(`"${invoice.invoiceCode}" is ${invoice.status} and can't be edited directly. Reopen it to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = invoice.id;
    $("#tiFormTitle").textContent = "Edit tax invoice";
    $("#tiFormIntro").textContent = "Update the invoice date, due date, or notes. The linked challan and its lines are locked once created.";
    $("#tiFormSaveBtn").textContent = "Save Changes";
    populateReceiptOptions(invoice.challanId);
    $("#tiFormSchedule").value = invoice.challanId || "";
    $("#tiFormSchedule").disabled = true;
    const challan = ERP_DeliveryChallanRepository.findById(invoice.challanId);
    renderReceiptInfo(challan);
    currentFormLines = invoice.invoiceLines || [];
    renderLineDisplayTable("tiFormLineTableBody", currentFormLines);
    $("#tiFormInvoiceDate").value = invoice.invoiceDate || todayISO();
    $("#tiFormDueDate").value = invoice.dueDate || "";
    $("#tiFormDueDateHint").textContent = "";
    $("#tiFormNotes").value = invoice.notes || "";
    clearFormErrors();
    openModal("tiFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!editingId && !$("#tiFormSchedule").value) { setFormError("tiFormSchedule", "Select the Issued delivery challan to raise an invoice for."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#tiAddBtn").addEventListener("click", openAddModal);

    $("#tiFormSchedule").addEventListener("change", (e) => {
      const challan = ERP_DeliveryChallanRepository.findById(e.target.value);
      renderReceiptInfo(challan);
      currentFormLines = buildGrnLinesFromReceipt(challan);
      renderLineDisplayTable("tiFormLineTableBody", currentFormLines);
      applyDueDateDefault(challan);
    });

    $("#tiFormInvoiceDate").addEventListener("change", () => {
      if (!editingId) {
        const challan = ERP_DeliveryChallanRepository.findById($("#tiFormSchedule").value);
        applyDueDateDefault(challan);
      }
    });

    $("#tiFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const challan = editingId ? ERP_DeliveryChallanRepository.findById(ERP_TaxInvoiceRepository.findById(editingId).challanId) : ERP_DeliveryChallanRepository.findById($("#tiFormSchedule").value);
      const label = challan ? challan.challanCode : "this challan";

      if (editingId) {
        const payload = {
          invoiceDate: $("#tiFormInvoiceDate").value || null,
          dueDate: $("#tiFormDueDate").value || null,
          notes: $("#tiFormNotes").value.trim()
        };
        openConfirm({
          title: "Save changes to this tax invoice?",
          message: `This tax invoice for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_TaxInvoiceRepository.update(editingId, payload);
            logSystemActivity({ module: "Tax Invoice", action: "Update", description: `Updated tax invoice for ${label} (${company.name})` });
            closeModal("tiFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_TaxInvoiceRepository.findById(editingId));
            showToast("Tax invoice updated.", "success");
          }
        });
      } else {
        const { salesOrder } = resolveJoin(challan);
        openConfirm({
          title: "Create this tax invoice?",
          message: `A new tax invoice will be created as a Draft for ${label}.`,
          confirmLabel: "Create Tax Invoice",
          onConfirm: () => {
            const created = ERP_TaxInvoiceRepository.create(company, challan, salesOrder, {
              invoiceDate: $("#tiFormInvoiceDate").value || null,
              dueDate: $("#tiFormDueDate").value || null,
              notes: $("#tiFormNotes").value.trim()
            });
            logSystemActivity({ module: "Tax Invoice", action: "Create", description: `Created tax invoice "${created.invoiceCode}" for ${label} (${company.name})` });
            closeModal("tiFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.invoiceCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestPost(invoice) {
    openConfirm({
      title: "Raise this tax invoice?",
      message: `"${invoice.invoiceCode}" will be marked Raised — treat this as the formal, billable document from here on.`,
      confirmLabel: "Raise",
      onConfirm: () => {
        ERP_TaxInvoiceRepository.raise(invoice.id, session.username);
        logSystemActivity({ module: "Tax Invoice", action: "Raise", description: `Raised tax invoice "${invoice.invoiceCode}" (${company.name})` });

        if (typeof ERP_GlPostingRepository !== "undefined") {
          const glResult = ERP_GlPostingRepository.postTaxInvoice(company, ERP_TaxInvoiceRepository.findById(invoice.id), session.username);
          if (glResult.success) {
            logSystemActivity({ module: "Tax Invoice", action: "Auto-Post", description: `Auto-posted journal entry ${glResult.entry.entryNumber} for invoice "${invoice.invoiceCode}" (${company.name})` });
            showToast(`Posted to the General Ledger as ${glResult.entry.entryNumber}.`, "info", { title: "Journal Entry created" });
          } else {
            showToast(glResult.reason, "warning", { title: "Not posted to the books" });
          }
        }

        renderAll();
        renderActivity();
        if (detailId === invoice.id) openDetailModal(ERP_TaxInvoiceRepository.findById(invoice.id));
        showToast(`"${invoice.invoiceCode}" raised.`, "success");
      }
    });
  }

  function requestReopen(invoice) {
    openConfirm({
      title: "Reopen this tax invoice?",
      message: `"${invoice.invoiceCode}" will move back to Draft so you can correct it.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_TaxInvoiceRepository.reopen(invoice.id);
        logSystemActivity({ module: "Tax Invoice", action: "Reopen", description: `Reopened tax invoice "${invoice.invoiceCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === invoice.id) openDetailModal(ERP_TaxInvoiceRepository.findById(invoice.id));
        showToast(`"${invoice.invoiceCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(invoice) {
    openConfirm({
      title: "Cancel this tax invoice?",
      message: `"${invoice.invoiceCode}" will be marked Cancelled and its delivery challan freed up for a different invoice.`,
      confirmLabel: "Cancel Invoice",
      onConfirm: () => {
        ERP_TaxInvoiceRepository.cancel(invoice.id, session.username);
        logSystemActivity({ module: "Tax Invoice", action: "Cancel", description: `Cancelled tax invoice "${invoice.invoiceCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === invoice.id) openDetailModal(ERP_TaxInvoiceRepository.findById(invoice.id));
        showToast(`"${invoice.invoiceCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(invoice) {
    if (!ERP_TaxInvoiceRepository.canDelete(invoice)) {
      showToast(`"${invoice.invoiceCode}" is ${invoice.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this tax invoice?",
      message: `"${invoice.invoiceCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_TaxInvoiceRepository.remove(invoice.id);
        logSystemActivity({ module: "Tax Invoice", action: "Delete", description: `Deleted tax invoice "${invoice.invoiceCode}" (${company.name})`, severity: "warning" });
        if (detailId === invoice.id) closeModal("tiDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${invoice.invoiceCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(invoice) {
    const footer = $("#tiDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (invoice.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(invoice));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("tiDetailModal"); openEditModal(invoice); });
      addBtn("Raise", "btn btn--primary", () => requestPost(invoice));
    } else if (invoice.status === "Raised") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(invoice));
      addBtn("Reopen to Draft", "btn btn--ghost", () => requestReopen(invoice));
    } else if (invoice.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(invoice));
    }
  }

  function openDetailModal(invoice) {
    detailId = invoice.id;
    const challan = ERP_DeliveryChallanRepository.findById(invoice.challanId);
    const salesOrder = invoice.salesOrderId ? ERP_SalesOrderRepository.findById(invoice.salesOrderId) : null;
    const cust = invoice.customerId ? ERP_CustomerRepository.findById(invoice.customerId) : null;

    $("#tiDetailTitle").textContent = `${invoice.invoiceCode} · ${invoice.status}`;

    const rows = [];
    rows.push(`<div><dt>Invoice Code</dt><dd><code>${escapeHtml(invoice.invoiceCode)}</code></dd></div>`);
    rows.push(`<div><dt>Delivery Challan</dt><dd>${challan ? `<code>${escapeHtml(challan.challanCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Sales Order</dt><dd>${salesOrder ? `<code>${escapeHtml(salesOrder.salesOrderCode)}</code>` : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Customer</dt><dd>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Invoice Date</dt><dd>${invoice.invoiceDate ? escapeHtml(invoice.invoiceDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Due Date</dt><dd>${invoice.dueDate ? escapeHtml(invoice.dueDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(invoice.status)}">${invoice.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(invoice.createdAt))}</dd></div>`);
    if (invoice.raisedAt) rows.push(`<div><dt>Raised</dt><dd>${formatDateTime(new Date(invoice.raisedAt))} by ${escapeHtml(ERP_TaxInvoiceRepository.actorLabel(invoice.raisedByUsername))}</dd></div>`);
    // RETROFIT (Phase 5, Module 07): Tax Invoice becomes a hub here —
    // Dispatch, Payment Collection, and Receipt all read FROM this
    // invoice independently rather than chaining through one another
    // (see dispatch-data.js's header). Each gets its own live-link
    // block, the same "Linked to X" / "Next Step" pairing Purchase
    // Order's own Detail modal established for its own three downstream
    // branches.
    if (typeof ERP_DispatchRepository !== "undefined") {
      const linkedDispatch = ERP_DispatchRepository.findDispatchForInvoice(company.id, invoice.id);
      if (linkedDispatch) {
        const dispatchBadgeClass = linkedDispatch.status === "Dispatched" ? "success" : linkedDispatch.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Dispatch</dt><dd><code>${escapeHtml(linkedDispatch.dispatchCode)}</code> <span class="status-badge status-badge--${dispatchBadgeClass}">${escapeHtml(linkedDispatch.status)}</span></dd></div>`);
      } else if (invoice.status === "Raised") {
        rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Ready for delivery to be arranged — see <strong>Dispatch</strong>.</dd></div>`);
      }
    } else if (invoice.status === "Raised") {
      rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Ready for delivery to be arranged — see <strong>Dispatch</strong>. Once paid, see <strong>Payment Collection</strong>.</dd></div>`);
    }
    // RETROFIT (Phase 5, Module 08): Payment Collection is NOT exclusive
    // over its parent invoice (see payment-collection-data.js's header),
    // so there's no single "the" linked record the way Dispatch's own
    // findDispatchForInvoice() has one. This shows an AGGREGATE instead —
    // count + most recent status — the same shape Vendor Evaluation's
    // own "Average Rating" retrofit into Vendor Master used, not the
    // single-link shape every exclusive module's retrofit uses.
    if (typeof ERP_PaymentCollectionRepository !== "undefined") {
      const followUps = ERP_PaymentCollectionRepository.getAllForInvoice(company.id, invoice.id);
      if (followUps.length) {
        const latest = followUps[0];
        const followUpBadgeClass = latest.status === "Collected" ? "success" : latest.status === "Written Off" ? "danger" : latest.status === "In Progress" ? "warning" : "neutral";
        rows.push(`<div><dt>Collection Follow-Ups</dt><dd>${followUps.length} logged · most recent <span class="status-badge status-badge--${followUpBadgeClass}">${escapeHtml(latest.status)}</span></dd></div>`);
      }
    }
    // RETROFIT (Phase 5, Module 09): Receipt IS exclusive over its
    // parent invoice (unlike Payment Collection just above), so this is
    // a genuine single "Linked to X" row, the same shape as Dispatch's
    // own retrofit rather than Payment Collection's aggregate one — Tax
    // Invoice's third and final independent downstream branch.
    if (typeof ERP_ReceiptRepository !== "undefined") {
      const linkedReceipt = ERP_ReceiptRepository.findReceiptForInvoice(company.id, invoice.id);
      if (linkedReceipt) {
        const receiptBadgeClass = linkedReceipt.status === "Received" ? "success" : linkedReceipt.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Receipt</dt><dd><code>${escapeHtml(linkedReceipt.receiptCode)}</code> <span class="status-badge status-badge--${receiptBadgeClass}">${escapeHtml(linkedReceipt.status)}</span></dd></div>`);
      }
    }
    // RETROFIT (Phase 15, Module 01): Sales Return, like Payment
    // Collection above and unlike Dispatch/Receipt, is NOT exclusive over
    // its parent invoice — several partial returns against one invoice
    // are normal — so this is the AGGREGATE shape (count + total quantity
    // + most recent status), not a single "Linked to X" row. This makes
    // Tax Invoice a genuine FOUR-way hub rather than a three-way one.
    if (typeof ERP_SalesReturnRepository !== "undefined") {
      const returns = ERP_SalesReturnRepository.getAllForInvoice(company.id, invoice.id);
      const live = returns.filter((r) => r.status !== "Cancelled");
      if (returns.length) {
        const latest = returns[0];
        const returnBadgeClass = latest.status === "Returned" ? "success" : latest.status === "Cancelled" ? "neutral" : "warning";
        const totalQty = live.reduce((s, r) => s + ERP_SalesReturnRepository.computeTotalReturnQuantity(r), 0);
        rows.push(`<div><dt>Sales Returns</dt><dd>${returns.length} raised · ${totalQty} unit(s) back · most recent <span class="status-badge status-badge--${returnBadgeClass}">${escapeHtml(latest.status)}</span></dd></div>`);
      }
    }
    // RETROFIT (Phase 15, Module 02): Credit Note, like Sales Return and
    // Payment Collection, is NOT exclusive over its parent invoice — one
    // invoice can collect several notes (a partial return's credit plus
    // later price adjustments) — so this is the AGGREGATE shape again.
    // The remaining-creditable figure is the one number someone looking
    // at this invoice actually wants next.
    if (typeof ERP_CreditNoteRepository !== "undefined") {
      const notes = ERP_CreditNoteRepository.getAllForInvoice(company.id, invoice.id);
      if (notes.length) {
        const issued = ERP_CreditNoteRepository.getIssuedCreditForInvoice(company.id, invoice.id);
        const remaining = ERP_CreditNoteRepository.getRemainingCreditableForInvoice(company.id, invoice, null);
        rows.push(`<div><dt>Credit Notes</dt><dd>${notes.length} raised · ₹${issued.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credited · ₹${remaining.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} still creditable</dd></div>`);
      }
    }
    if (invoice.status === "Cancelled" && invoice.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(invoice.cancelledAt))} by ${escapeHtml(ERP_TaxInvoiceRepository.actorLabel(invoice.cancelledByUsername))}</dd></div>`);
    // RETROFIT (Phase 16, Module 03): E-Invoice/IRN IS exclusive over an
    // invoice (findForInvoice() excludes Cancelled ones, so at most one
    // active e-invoice exists per invoice at a time) — a genuine single
    // link, the same shape Dispatch's own row above uses, not the
    // aggregate shape Sales Return/Credit Note needed.
    if (typeof ERP_EInvoiceRepository !== "undefined") {
      const eInvoice = ERP_EInvoiceRepository.findForInvoice(company.id, invoice.id);
      if (eInvoice) {
        const eBadgeClass = eInvoice.status === "Generated" ? "success" : "neutral";
        rows.push(`<div><dt>E-Invoice / IRN</dt><dd><code>${escapeHtml(eInvoice.irn.slice(0, 16))}…</code> <span class="status-badge status-badge--${eBadgeClass}">${escapeHtml(eInvoice.status)}</span>${eInvoice.isLate ? ' <span class="status-badge status-badge--danger">Late</span>' : ""}</dd></div>`);
      }
    }
    if (invoice.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(invoice.notes)}</dd></div>`);

    $("#tiDetailBody").innerHTML = rows.join("");
    renderLineDisplayTable("tiLineTableBody", invoice.invoiceLines || []);
    const { subtotal, taxTotal, total, pricedCount, totalCount } = ERP_TaxInvoiceRepository.computeGrandTotal(invoice);
    if (totalCount === 0) {
      $("#tiGrandTotalLine").textContent = "";
    } else if (pricedCount === totalCount) {
      $("#tiGrandTotalLine").textContent = `Subtotal: ${formatCurrency(subtotal)} + Tax: ${formatCurrency(taxTotal)} = Total: ${formatCurrency(total)}`;
    } else {
      $("#tiGrandTotalLine").textContent = `~Total so far: ${formatCurrency(total)} (${pricedCount} of ${totalCount} lines priced)`;
    }
    renderDetailFooter(invoice);
    openModal("tiDetailModal");
  }

  function bindDetailModal() {
    $("#tiTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const inv = ERP_TaxInvoiceRepository.findById(viewBtn.dataset.id);
        if (inv) openDetailModal(inv);
        return;
      }
      if (actionBtn) {
        const inv = ERP_TaxInvoiceRepository.findById(actionBtn.dataset.id);
        if (!inv) return;
        if (actionBtn.dataset.action === "post") requestPost(inv);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "tax-invoice")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading tax invoices…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#tiContent").hidden = true;
      $("#tiSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#tiContent").hidden = false;
      $("#tiHeaderActions").hidden = false;
      $("#tiSubtitle").textContent = `Raising tax invoices for ${company.name} (${company.companyCode}).`;

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
