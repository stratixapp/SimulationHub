/* =============================================================================
   DOT ERP — pages/delivery-challan.js
   Phase 5, Module 5: Delivery Challan

   See data/delivery-challan-data.js's header for the full design
   rationale (built from an Approved sales order, exclusivity, the
   3-state lifecycle named `Issued` to avoid colliding with `Dispatched`
   — Module 07's own name later in this roadmap — no price/tax on this
   document at all). This file is the UI layer's own decisions on top of
   that:

   - THE CHALLAN-LINE TABLE IS DYNAMIC, ONE ROW PER SALES ORDER LINE.
     Choosing an Approved sales order resolves its own frozen `lineItems`,
     and renders one editable delivered-qty row per line, pre-filled with
     the ORDERED quantity — genuinely meant to be overwritten, the same
     "starting point is a real starting point" reasoning Goods Receipt's
     own received-qty column established on the inbound side. A partial
     shipment is the normal case this module exists to handle, not an
     edge case.
   - NO CHAIN-WALK NEEDED TO RESOLVE A LINE'S OWN DESCRIPTION. Goods
     Receipt had to walk schedule -> PO -> quotation -> RFQ -> PR to find
     a line's own text, because Delivery Schedule's own lines only ever
     stored a `prLineItemId` reference. This module's lines already carry
     their own `lineDescription` directly (copied down from Sales
     Order's own frozen copy of Quotation's lines) — one hop, not five.
   - Customer info is read-only, resolved via the linked sales order, the
     same "derived, not chosen" treatment every downstream module in this
     codebase gives a field that already has an answer further up the
     chain.
   - Dispatch Warehouse IS independently editable (unlike customer) — a
     genuinely optional field with no natural default to fall back to
     (unlike Goods Receipt's own warehouse picker, which could default to
     the PO's delivery warehouse; a sales order has no equivalent
     "default ship-from" location recorded on it).
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
    if (status === "Issued") return "success";
    if (status === "Cancelled") return "neutral";
    return "warning"; // Draft
  }

  function quickActionFor(challan) {
    if (challan.status === "Draft") return { action: "issue", label: "Issue Challan" };
    return null;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_DeliveryChallanRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((c) => c.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((c) => {
        const so = c.salesOrderId ? ERP_SalesOrderRepository.findById(c.salesOrderId) : null;
        const cust = c.customerId ? ERP_CustomerRepository.findById(c.customerId) : null;
        return c.challanCode.toLowerCase().includes(term) ||
          (so && so.salesOrderCode.toLowerCase().includes(term)) ||
          (cust && cust.customerName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_DeliveryChallanRepository.getAllForCompany(company.id);
    $("#dcSummaryTotal").textContent = String(all.length);
    $("#dcSummaryDraft").textContent = String(all.filter((c) => c.status === "Draft").length);
    $("#dcSummaryLogged").textContent = String(all.filter((c) => c.status === "Issued").length);
    $("#dcSummaryCancelled").textContent = String(all.filter((c) => c.status === "Cancelled").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#dcPagination");
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

    $("#dcEmptyState").hidden = all.length !== 0;
    $("#dcTable").hidden = all.length === 0;

    $("#dcTableBody").innerHTML = pageItems.map((c) => {
      const so = c.salesOrderId ? ERP_SalesOrderRepository.findById(c.salesOrderId) : null;
      const cust = c.customerId ? ERP_CustomerRepository.findById(c.customerId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(c.status)}">${c.status}</span>`;
      const shortfallBadge = ERP_DeliveryChallanRepository.hasShortfall(c) ? ` <span class="status-badge status-badge--warning">Partial</span>` : "";
      const qa = quickActionFor(c);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${c.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(c.challanCode)}</code></td>
        <td>${so ? `<code>${escapeHtml(so.salesOrderCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${(c.challanLines || []).length}${shortfallBadge}</td>
        <td>${c.challanDate ? escapeHtml(c.challanDate) : `<span class="profile-subtle">—</span>`}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${c.id}">View</button>
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
    $$("#dcStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#dcStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#dcSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#dcSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#dcExportCsvBtn").addEventListener("click", exportCsv);
    $("#dcPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Challan Code", "Sales Order Code", "Customer", "Lines", "Challan Date", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((c) => {
      const so = c.salesOrderId ? ERP_SalesOrderRepository.findById(c.salesOrderId) : null;
      const cust = c.customerId ? ERP_CustomerRepository.findById(c.customerId) : null;
      const line = [
        c.challanCode, so ? so.salesOrderCode : "", cust ? cust.customerName : "", (c.challanLines || []).length,
        c.challanDate || "", c.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-delivery-challans-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Delivery challans exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((c) => {
      const so = c.salesOrderId ? ERP_SalesOrderRepository.findById(c.salesOrderId) : null;
      const cust = c.customerId ? ERP_CustomerRepository.findById(c.customerId) : null;
      return `<tr><td>${escapeHtml(c.challanCode)}</td><td>${so ? escapeHtml(so.salesOrderCode) : ""}</td><td>${cust ? escapeHtml(cust.customerName) : ""}</td><td>${escapeHtml(c.challanDate || "")}</td><td>${escapeHtml(c.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Delivery Challan Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Delivery Challan Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Challan Code</th><th>Sales Order</th><th>Customer</th><th>Challan Date</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Delivery Challan")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#dcActivityEmptyState").hidden = relevant.length !== 0;
    $("#dcActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#dcFormModal)
     --------------------------------------------------------------------- */
  function populateScheduleOptions(currentId) {
    let orders = ERP_DeliveryChallanRepository.getAvailableApprovedSalesOrdersForCompany(company.id, editingId);
    if (currentId && !orders.some((s) => s.id === currentId)) {
      const current = ERP_SalesOrderRepository.findById(currentId);
      if (current) orders = orders.concat([current]);
    }
    $("#dcFormSchedule").innerHTML = orders.map((so) => {
      const cust = so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
      const label = `${so.salesOrderCode}${cust ? ` — ${cust.customerName}` : ""}`;
      return `<option value="${so.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  /** No employee field on this module — see file header for why Dispatch
      Warehouse has no natural default the way Goods Receipt's own
      warehouse picker did. */
  function populateWarehouseOptions(currentId) {
    let whs = ERP_WarehouseRepository.getAllForCompany(company.id).filter((w) => w.status === "Active");
    if (currentId && !whs.some((w) => w.id === currentId)) {
      const current = ERP_WarehouseRepository.findById(currentId);
      if (current) whs = whs.concat([current]);
    }
    whs = whs.slice().sort((a, b) => a.warehouseName.localeCompare(b.warehouseName));
    $("#dcFormWarehouse").innerHTML = `<option value="">Not set</option>` + whs.map((w) =>
      `<option value="${w.id}">${escapeHtml(w.warehouseName)} (${escapeHtml(w.warehouseCode)})</option>`
    ).join("");
    $("#dcFormWarehouse").value = currentId || "";
  }

  function renderScheduleInfo(so) {
    const box = $("#dcFormScheduleInfo");
    if (!so) { box.textContent = ""; return; }
    const cust = so.customerId ? ERP_CustomerRepository.findById(so.customerId) : null;
    box.textContent = `Customer: ${cust ? cust.customerName : "Removed"} — from ${so.salesOrderCode}.`;
  }

  /** Renders from lines already shaped like challanLines[] — for a fresh
      Add, the caller maps the sales order's own lineItems into that
      shape first (quantity -> orderedQuantity/deliveredQuantity both);
      for Edit, the challan's own challanLines are already in that shape.
      One shared render path either way. */
  function renderFormLineTable(lines) {
    if (!lines || !lines.length) {
      $("#dcFormLineTableBody").innerHTML = `<tr><td colspan="3"><span class="profile-subtle">Pick a sales order to load its lines.</span></td></tr>`;
      return;
    }
    $("#dcFormLineTableBody").innerHTML = lines.map((line) => `
      <tr>
        <td>${escapeHtml(line.lineDescription || "—")}</td>
        <td>${escapeHtml(String(line.orderedQuantity))}</td>
        <td><div class="input-wrap"><input type="number" class="dc-line-qty" data-line-id="${line.id}" min="0" step="1" value="${line.deliveredQuantity}" /></div></td>
      </tr>`).join("");
  }

  /** Line identity (id/itemId/lineDescription/orderedQuantity) is carried
      as data attributes isn't needed — collectChallanLines() is only
      ever called against a table that renderFormLineTable() itself just
      built, so it re-reads the same source array and only swaps in the
      live input value. */
  function collectChallanLines(sourceLines) {
    return sourceLines.map((line) => {
      const input = document.querySelector(`.dc-line-qty[data-line-id="${line.id}"]`);
      return {
        id: line.id,
        itemId: line.itemId,
        lineDescription: line.lineDescription,
        orderedQuantity: line.orderedQuantity,
        deliveredQuantity: input && input.value !== "" ? Number(input.value) : 0
      };
    });
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("dcFormSchedule", ""); }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  let formLines = []; // the current source array renderFormLineTable()/collectChallanLines() share

  function openAddModal() {
    const available = ERP_DeliveryChallanRepository.getAvailableApprovedSalesOrdersForCompany(company.id, null);
    if (!available.length) {
      showToast("No Approved sales orders are currently available to prepare a challan against. Approve one in Order Approval first.", "warning");
      return;
    }
    editingId = null;
    $("#dcFormTitle").textContent = "New delivery challan";
    $("#dcFormIntro").textContent = "Pick the Approved sales order to prepare a challan against — each line starts on its ordered quantity.";
    $("#dcFormSaveBtn").textContent = "Create Delivery Challan";
    $("#dcFormSchedule").disabled = false;
    populateScheduleOptions(null);
    const firstSo = ERP_SalesOrderRepository.findById($("#dcFormSchedule").value);
    renderScheduleInfo(firstSo);
    formLines = firstSo ? (firstSo.lineItems || []).map((l) => ({ id: l.id, itemId: l.itemId, lineDescription: l.lineDescription, orderedQuantity: l.quantity, deliveredQuantity: l.quantity })) : [];
    renderFormLineTable(formLines);
    populateWarehouseOptions(null);
    $("#dcFormChallanDate").value = firstSo && firstSo.deliveryDate ? firstSo.deliveryDate : todayISO();
    $("#dcFormNotes").value = "";
    clearFormErrors();
    openModal("dcFormModal");
  }

  function openEditModal(challan) {
    if (!ERP_DeliveryChallanRepository.canEdit(challan)) {
      showToast(`"${challan.challanCode}" is ${challan.status} and can't be edited directly. Reopen it to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = challan.id;
    $("#dcFormTitle").textContent = "Edit delivery challan";
    $("#dcFormIntro").textContent = "Adjust delivered quantities, the dispatch warehouse, or the challan date.";
    $("#dcFormSaveBtn").textContent = "Save Changes";
    populateScheduleOptions(challan.salesOrderId);
    $("#dcFormSchedule").value = challan.salesOrderId || "";
    $("#dcFormSchedule").disabled = true; // locked once created — see file header
    const so = ERP_SalesOrderRepository.findById(challan.salesOrderId);
    renderScheduleInfo(so);
    formLines = challan.challanLines || [];
    renderFormLineTable(formLines);
    populateWarehouseOptions(challan.dispatchWarehouseId);
    $("#dcFormChallanDate").value = challan.challanDate || todayISO();
    $("#dcFormNotes").value = challan.notes || "";
    clearFormErrors();
    openModal("dcFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!editingId && !$("#dcFormSchedule").value) { setFormError("dcFormSchedule", "Select the Approved sales order to prepare a challan against."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#dcAddBtn").addEventListener("click", openAddModal);

    $("#dcFormSchedule").addEventListener("change", (e) => {
      const so = ERP_SalesOrderRepository.findById(e.target.value);
      renderScheduleInfo(so);
      formLines = so ? (so.lineItems || []).map((l) => ({ id: l.id, itemId: l.itemId, lineDescription: l.lineDescription, orderedQuantity: l.quantity, deliveredQuantity: l.quantity })) : [];
      renderFormLineTable(formLines);
    });

    $("#dcFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const so = editingId ? ERP_SalesOrderRepository.findById(ERP_DeliveryChallanRepository.findById(editingId).salesOrderId) : ERP_SalesOrderRepository.findById($("#dcFormSchedule").value);
      const label = so ? so.salesOrderCode : "this sales order";

      if (editingId) {
        const payload = {
          challanLines: collectChallanLines(formLines),
          dispatchWarehouseId: $("#dcFormWarehouse").value || null,
          challanDate: $("#dcFormChallanDate").value || null,
          notes: $("#dcFormNotes").value.trim()
        };
        openConfirm({
          title: "Save changes to this delivery challan?",
          message: `This delivery challan for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_DeliveryChallanRepository.update(editingId, payload);
            logSystemActivity({ module: "Delivery Challan", action: "Update", description: `Updated delivery challan for ${label} (${company.name})` });
            closeModal("dcFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_DeliveryChallanRepository.findById(editingId));
            showToast("Delivery challan updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this delivery challan?",
          message: `A new delivery challan will be created as a Draft for ${label}.`,
          confirmLabel: "Create Delivery Challan",
          onConfirm: () => {
            const created = ERP_DeliveryChallanRepository.create(company, so, {
              challanLines: collectChallanLines(formLines),
              dispatchWarehouseId: $("#dcFormWarehouse").value || null,
              challanDate: $("#dcFormChallanDate").value || null,
              notes: $("#dcFormNotes").value.trim()
            });
            logSystemActivity({ module: "Delivery Challan", action: "Create", description: `Created delivery challan "${created.challanCode}" for ${label} (${company.name})` });
            closeModal("dcFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.challanCode}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestLog(challan) {
    openConfirm({
      title: "Issue this delivery challan?",
      message: `"${challan.challanCode}" will be marked Issued — treat this as an accurate record of what's shipping.`,
      confirmLabel: "Issue Challan",
      onConfirm: () => {
        ERP_DeliveryChallanRepository.issue(challan.id, session.username);
        logSystemActivity({ module: "Delivery Challan", action: "Issue", description: `Issued delivery challan "${challan.challanCode}" (${company.name})` });

        // Auto-post to the Stock Ledger (Phase 7 retrofit pass) — see
        // data/stock-posting-data.js's own header. Typeof-guarded since
        // not every page loads the Stock Ledger layer.
        if (typeof ERP_StockPostingRepository !== "undefined") {
          const stockResult = ERP_StockPostingRepository.postDeliveryIssue(company, ERP_DeliveryChallanRepository.findById(challan.id), session.username);
          if (stockResult.success && stockResult.entries.length > 0) {
            logSystemActivity({ module: "Delivery Challan", action: "Auto-Post", description: `Posted ${stockResult.entries.length} Stock Ledger entr${stockResult.entries.length === 1 ? "y" : "ies"} for challan "${challan.challanCode}" (${company.name})` });
            const skipNote = stockResult.skippedCount ? ` (${stockResult.skippedCount} line${stockResult.skippedCount === 1 ? "" : "s"} skipped)` : "";
            showToast(`Posted ${stockResult.entries.length} line${stockResult.entries.length === 1 ? "" : "s"} to the Stock Ledger${skipNote}.`, "info", { title: "Stock Ledger updated" });
          } else if (!stockResult.success || stockResult.reason) {
            showToast(stockResult.reason, "warning", { title: "Not posted to the Stock Ledger" });
          }

          // Same call also relieves Inventory and books Cost of Goods Sold on the
          // General Ledger, at the FIFO cost worked out per line above — see
          // gl-posting-data.js's own postDeliveryCogs().
          if (typeof ERP_GlPostingRepository !== "undefined" && stockResult.costedLines && stockResult.costedLines.length) {
            const cogsResult = ERP_GlPostingRepository.postDeliveryCogs(company, ERP_DeliveryChallanRepository.findById(challan.id), stockResult.costedLines, session.username);
            if (cogsResult.success && !cogsResult.skipped) {
              logSystemActivity({ module: "Delivery Challan", action: "Auto-Post", description: `Posted Cost of Goods Sold (${formatCurrency(cogsResult.amount)}) for challan "${challan.challanCode}" (${company.name})` });
              showToast(`Posted ${formatCurrency(cogsResult.amount)} to Cost of Goods Sold.${cogsResult.hadShortfall ? " Some of this used an estimated cost — stock for at least one item ran out of priced layers." : ""}`, "info", { title: "General Ledger updated" });
            } else if (!cogsResult.success) {
              showToast(cogsResult.reason, "warning", { title: "Not posted to the books" });
            }
          }
        }

        renderAll();
        renderActivity();
        if (detailId === challan.id) openDetailModal(ERP_DeliveryChallanRepository.findById(challan.id));
        showToast(`"${challan.challanCode}" issued.`, "success");
      }
    });
  }

  function requestReopen(challan) {
    openConfirm({
      title: "Reopen this delivery challan?",
      message: `"${challan.challanCode}" will move back to Draft so you can correct it.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_DeliveryChallanRepository.reopen(challan.id);
        logSystemActivity({ module: "Delivery Challan", action: "Reopen", description: `Reopened delivery challan "${challan.challanCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === challan.id) openDetailModal(ERP_DeliveryChallanRepository.findById(challan.id));
        showToast(`"${challan.challanCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(challan) {
    openConfirm({
      title: "Cancel this delivery challan?",
      message: `"${challan.challanCode}" will be marked Cancelled and its sales order freed up for a different challan.`,
      confirmLabel: "Cancel Challan",
      onConfirm: () => {
        ERP_DeliveryChallanRepository.cancel(challan.id, session.username);
        logSystemActivity({ module: "Delivery Challan", action: "Cancel", description: `Cancelled delivery challan "${challan.challanCode}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === challan.id) openDetailModal(ERP_DeliveryChallanRepository.findById(challan.id));
        showToast(`"${challan.challanCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(challan) {
    if (!ERP_DeliveryChallanRepository.canDelete(challan)) {
      showToast(`"${challan.challanCode}" is ${challan.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this delivery challan?",
      message: `"${challan.challanCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_DeliveryChallanRepository.remove(challan.id);
        logSystemActivity({ module: "Delivery Challan", action: "Delete", description: `Deleted delivery challan "${challan.challanCode}" (${company.name})`, severity: "warning" });
        if (detailId === challan.id) closeModal("dcDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${challan.challanCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderLineItemsTable(challan) {
    const lines = challan.challanLines || [];
    $("#dcLineTableBody").innerHTML = lines.length
      ? lines.map((line) => {
          const shortfall = Number(line.deliveredQuantity) < Number(line.orderedQuantity);
          const deliveredCell = shortfall
            ? `<span class="status-badge status-badge--warning">${escapeHtml(String(line.deliveredQuantity))}</span>`
            : escapeHtml(String(line.deliveredQuantity));
          return `<tr><td>${escapeHtml(line.lineDescription || "—")}</td><td>${escapeHtml(String(line.orderedQuantity))}</td><td>${deliveredCell}</td></tr>`;
        }).join("")
      : `<tr><td colspan="3"><span class="profile-subtle">This challan has no lines.</span></td></tr>`;

    const shortLines = lines.filter((line) => Number(line.deliveredQuantity) < Number(line.orderedQuantity));
    if (!lines.length) {
      $("#dcGrandTotalLine").textContent = "";
    } else if (shortLines.length) {
      $("#dcGrandTotalLine").textContent = `${shortLines.length} of ${lines.length} line(s) shipping short of the order — a partial delivery.`;
    } else {
      $("#dcGrandTotalLine").textContent = `All ${lines.length} line(s) shipping in full.`;
    }
  }

  function renderDetailFooter(challan) {
    const footer = $("#dcDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (challan.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(challan));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("dcDetailModal"); openEditModal(challan); });
      addBtn("Issue Challan", "btn btn--primary", () => requestLog(challan));
    } else if (challan.status === "Issued") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(challan));
      addBtn("Reopen to Draft", "btn btn--ghost", () => requestReopen(challan));
    } else if (challan.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(challan));
    }
  }

  function openDetailModal(challan) {
    detailId = challan.id;
    const so = challan.salesOrderId ? ERP_SalesOrderRepository.findById(challan.salesOrderId) : null;
    const cust = challan.customerId ? ERP_CustomerRepository.findById(challan.customerId) : null;
    const dispatchWh = challan.dispatchWarehouseId ? ERP_WarehouseRepository.findById(challan.dispatchWarehouseId) : null;

    $("#dcDetailTitle").textContent = `${challan.challanCode} · ${challan.status}`;

    const rows = [];
    rows.push(`<div><dt>Challan Code</dt><dd><code>${escapeHtml(challan.challanCode)}</code></dd></div>`);
    rows.push(`<div><dt>Sales Order</dt><dd>${so ? `<code>${escapeHtml(so.salesOrderCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Customer</dt><dd>${cust ? escapeHtml(cust.customerName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Dispatch Warehouse</dt><dd>${dispatchWh ? escapeHtml(dispatchWh.warehouseName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Challan Date</dt><dd>${challan.challanDate ? escapeHtml(challan.challanDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(challan.status)}">${challan.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(challan.createdAt))}</dd></div>`);
    if (challan.issuedAt) rows.push(`<div><dt>Issued</dt><dd>${formatDateTime(new Date(challan.issuedAt))} by ${escapeHtml(ERP_DeliveryChallanRepository.actorLabel(challan.issuedByUsername))}</dd></div>`);
    if (typeof ERP_TaxInvoiceRepository !== "undefined") {
      const linkedInvoice = ERP_TaxInvoiceRepository.findInvoiceForChallan(company.id, challan.id);
      if (linkedInvoice) {
        const tiBadgeClass = linkedInvoice.status === "Raised" ? "success" : linkedInvoice.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Tax Invoice</dt><dd><code>${escapeHtml(linkedInvoice.invoiceCode)}</code> <span class="status-badge status-badge--${tiBadgeClass}">${escapeHtml(linkedInvoice.status)}</span></dd></div>`);
      } else if (challan.status === "Issued") {
        rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Ready for billing — see <strong>Tax Invoice</strong>.</dd></div>`);
      }
    }
    if (challan.status === "Cancelled" && challan.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(challan.cancelledAt))} by ${escapeHtml(ERP_DeliveryChallanRepository.actorLabel(challan.cancelledByUsername))}</dd></div>`);
    if (challan.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(challan.notes)}</dd></div>`);

    $("#dcDetailBody").innerHTML = rows.join("");
    renderLineItemsTable(challan);
    renderDetailFooter(challan);
    openModal("dcDetailModal");
  }

  function bindDetailModal() {
    $("#dcTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const c = ERP_DeliveryChallanRepository.findById(viewBtn.dataset.id);
        if (c) openDetailModal(c);
        return;
      }
      if (actionBtn) {
        const c = ERP_DeliveryChallanRepository.findById(actionBtn.dataset.id);
        if (!c) return;
        if (actionBtn.dataset.action === "issue") requestLog(c);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "delivery-challan")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading delivery challans…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#dcContent").hidden = true;
      $("#dcSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#dcContent").hidden = false;
      $("#dcHeaderActions").hidden = false;
      $("#dcSubtitle").textContent = `Managing delivery challans for ${company.name} (${company.companyCode}).`;

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
