/* =============================================================================
   DOT ERP — pages/grn.js
   Phase 4, Module 14: GRN

   See data/grn-data.js's header for the full design rationale (built
   from a Logged goods receipt, price pulled from the PO not the receipt,
   no approval gate). UI-layer decisions on top of that:

   - THE GRN-LINE TABLE IS READ-ONLY, EVEN IN THE FORM. Unlike every
     other line table this session (PO's qty/price, Delivery Schedule's
     qty/date, Goods Receipt's qty/notes — all editable inputs), a GRN's
     own line table shows plain text, not inputs. This is deliberate: a
     GRN is a faithful copy of numbers that already exist elsewhere
     (quantity from the receipt, price from the PO), not a place to type
     anything new. If the copied numbers are wrong, the fix belongs
     upstream.
   - Price resolution walks THREE hops from the receipt: receipt ->
     schedule -> PO, then reads the PO's own `lineItems` for price (not
     the PR/quotation chain Goods Receipt's own page needed for
     descriptions — GRN needs both chains, one for the label, one for
     the price).
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
    if (status === "Posted") return "success";
    if (status === "Cancelled") return "neutral";
    return "warning"; // Draft
  }

  function quickActionFor(grn) {
    if (grn.status === "Draft") return { action: "post", label: "Post" };
    return null;
  }

  /** receipt -> schedule -> PO -> quotation -> RFQ -> PR, resolving both
      a line's description (via PR) and its price (via PO) in one pass. */
  function resolveChain(receipt) {
    const schedule = receipt ? ERP_DeliveryScheduleRepository.findById(receipt.linkedScheduleId) : null;
    const po = schedule ? ERP_PurchaseOrderRepository.findById(schedule.linkedPoId) : null;
    const quotation = po ? ERP_QuotationRepository.findById(po.linkedQuotationId) : null;
    const rfq = quotation ? ERP_RfqRepository.findById(quotation.rfqId) : null;
    const pr = rfq ? ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId) : null;
    return { schedule, po, pr };
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_GrnRepository.getAllForCompany(company.id);

    if (filterStatus !== "all") rows = rows.filter((g) => g.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((g) => {
        const receipt = g.linkedReceiptId ? ERP_GoodsReceiptRepository.findById(g.linkedReceiptId) : null;
        return g.grnNumber.toLowerCase().includes(term) || (receipt && receipt.receiptCode.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_GrnRepository.getAllForCompany(company.id);
    $("#grnSummaryTotal").textContent = String(all.length);
    $("#grnSummaryDraft").textContent = String(all.filter((g) => g.status === "Draft").length);
    $("#grnSummaryLogged").textContent = String(all.filter((g) => g.status === "Posted").length);
    $("#grnSummaryCancelled").textContent = String(all.filter((g) => g.status === "Cancelled").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#grnPagination");
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

    $("#grnEmptyState").hidden = all.length !== 0;
    $("#grnTable").hidden = all.length === 0;

    $("#grnTableBody").innerHTML = pageItems.map((g) => {
      const receipt = g.linkedReceiptId ? ERP_GoodsReceiptRepository.findById(g.linkedReceiptId) : null;
      const { po } = resolveChain(receipt);
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(g.status)}">${g.status}</span>`;
      const { total, pricedCount, totalCount } = ERP_GrnRepository.computeGrandTotal(g);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);
      const qa = quickActionFor(g);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${g.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(g.grnNumber)}</code></td>
        <td>${receipt ? `<code>${escapeHtml(receipt.receiptCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</td>
        <td>${totalCount}</td>
        <td>${totalLabel}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${g.id}">View</button>
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
    $$("#grnStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#grnStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#grnSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#grnSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#grnExportCsvBtn").addEventListener("click", exportCsv);
    $("#grnPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["GRN Number", "Receipt Code", "Vendor", "Lines", "GRN Value", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((g) => {
      const receipt = g.linkedReceiptId ? ERP_GoodsReceiptRepository.findById(g.linkedReceiptId) : null;
      const { po } = resolveChain(receipt);
      const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
      const { total, totalCount } = ERP_GrnRepository.computeGrandTotal(g);
      const line = [
        g.grnNumber, receipt ? receipt.receiptCode : "", vendor ? vendor.vendorName : "", totalCount, total, g.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-grns-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("GRNs exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((g) => {
      const { total, totalCount } = ERP_GrnRepository.computeGrandTotal(g);
      return `<tr><td>${escapeHtml(g.grnNumber)}</td><td>${totalCount}</td><td>${escapeHtml(formatCurrency(total))}</td><td>${escapeHtml(g.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - GRN Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — GRN Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>GRN Number</th><th>Lines</th><th>Value</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "GRN")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#grnActivityEmptyState").hidden = relevant.length !== 0;
    $("#grnActivityList").innerHTML = relevant.map((e) => `
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
     FORM (#grnFormModal) — the line table is read-only display, not
     inputs (see file header).
     --------------------------------------------------------------------- */
  function populateReceiptOptions(currentId) {
    let receipts = ERP_GrnRepository.getAvailableLoggedReceiptsForCompany(company.id, editingId);
    if (currentId && !receipts.some((r) => r.id === currentId)) {
      const current = ERP_GoodsReceiptRepository.findById(currentId);
      if (current) receipts = receipts.concat([current]);
    }
    $("#grnFormSchedule").innerHTML = receipts.map((r) => {
      const { po } = resolveChain(r);
      const label = `${r.receiptCode}${po ? ` — ${po.poCode}` : ""}`;
      return `<option value="${r.id}">${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderReceiptInfo(receipt) {
    const box = $("#grnFormScheduleInfo");
    if (!receipt) { box.textContent = ""; return; }
    const { po } = resolveChain(receipt);
    const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
    box.textContent = `Vendor: ${vendor ? vendor.vendorName : "Removed"}${po ? ` — from ${po.poCode}` : ""}.`;
  }

  function buildGrnLinesFromReceipt(receipt) {
    if (!receipt) return [];
    const { po, pr } = resolveChain(receipt);
    const poLineById = {};
    (po ? po.lineItems || [] : []).forEach((l) => { poLineById[l.prLineItemId] = l; });
    return (receipt.receiptLines || []).map((line) => {
      const poLine = poLineById[line.prLineItemId];
      return {
        prLineItemId: line.prLineItemId,
        quantity: line.receivedQuantity,
        unitPrice: poLine ? poLine.unitPrice : null
      };
    });
  }

  function renderLineDisplayTable(targetBodyId, grnLines, receipt) {
    const { pr } = resolveChain(receipt);
    const prLineById = {};
    (pr ? pr.lineItems || [] : []).forEach((l) => { prLineById[l.id] = l; });

    if (!grnLines.length) {
      $("#" + targetBodyId).innerHTML = `<tr><td colspan="4"><span class="profile-subtle">Pick a goods receipt to load its lines.</span></td></tr>`;
      return;
    }
    $("#" + targetBodyId).innerHTML = grnLines.map((line) => {
      const prLine = prLineById[line.prLineItemId];
      const item = prLine && prLine.itemId ? ERP_ItemRepository.findById(prLine.itemId) : null;
      const label = item
        ? `${escapeHtml(item.itemName)}${prLine.lineDescription ? " — " + escapeHtml(prLine.lineDescription) : ""}`
        : escapeHtml((prLine && prLine.lineDescription) || "—");
      const value = ERP_GrnRepository.computeLineValue(line);
      const priceLabel = line.unitPrice != null ? escapeHtml(formatCurrency(line.unitPrice)) : `<span class="profile-subtle">—</span>`;
      const valueLabel = value != null ? escapeHtml(formatCurrency(value)) : `<span class="profile-subtle">—</span>`;
      return `<tr><td>${label}</td><td>${escapeHtml(String(line.quantity))}</td><td>${priceLabel}</td><td>${valueLabel}</td></tr>`;
    }).join("");
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("grnFormSchedule", ""); }

  let currentFormLines = [];

  function openAddModal() {
    const available = ERP_GrnRepository.getAvailableLoggedReceiptsForCompany(company.id, null);
    if (!available.length) {
      showToast("No Logged goods receipts are currently available to post a GRN for. Log one in Goods Receipt first.", "warning");
      return;
    }
    editingId = null;
    $("#grnFormTitle").textContent = "New GRN";
    $("#grnFormIntro").textContent = "Pick the Logged goods receipt to post a GRN for — quantity comes from the receipt, price from the original PO.";
    $("#grnFormSaveBtn").textContent = "Create GRN";
    populateReceiptOptions(null);
    const firstReceipt = ERP_GoodsReceiptRepository.findById($("#grnFormSchedule").value);
    renderReceiptInfo(firstReceipt);
    currentFormLines = buildGrnLinesFromReceipt(firstReceipt);
    renderLineDisplayTable("grnFormLineTableBody", currentFormLines, firstReceipt);
    $("#grnFormNotes").value = "";
    clearFormErrors();
    openModal("grnFormModal");
  }

  function openEditModal(grn) {
    if (!ERP_GrnRepository.canEdit(grn)) {
      showToast(`"${grn.grnNumber}" is ${grn.status} and can't be edited directly. Reopen it to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = grn.id;
    $("#grnFormTitle").textContent = "Edit GRN";
    $("#grnFormIntro").textContent = "Update which goods receipt this GRN is posted for.";
    $("#grnFormSaveBtn").textContent = "Save Changes";
    populateReceiptOptions(grn.linkedReceiptId);
    $("#grnFormSchedule").value = grn.linkedReceiptId || "";
    const receipt = ERP_GoodsReceiptRepository.findById(grn.linkedReceiptId);
    renderReceiptInfo(receipt);
    currentFormLines = grn.grnLines && grn.grnLines.length ? grn.grnLines : buildGrnLinesFromReceipt(receipt);
    renderLineDisplayTable("grnFormLineTableBody", currentFormLines, receipt);
    $("#grnFormNotes").value = grn.notes || "";
    clearFormErrors();
    openModal("grnFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#grnFormSchedule").value) { setFormError("grnFormSchedule", "Select the Logged goods receipt to post a GRN for."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#grnAddBtn").addEventListener("click", openAddModal);

    $("#grnFormSchedule").addEventListener("change", (e) => {
      const receipt = ERP_GoodsReceiptRepository.findById(e.target.value);
      renderReceiptInfo(receipt);
      currentFormLines = buildGrnLinesFromReceipt(receipt);
      renderLineDisplayTable("grnFormLineTableBody", currentFormLines, receipt);
    });

    $("#grnFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const receipt = ERP_GoodsReceiptRepository.findById($("#grnFormSchedule").value);
      const payload = {
        linkedReceiptId: $("#grnFormSchedule").value,
        grnLines: currentFormLines,
        notes: $("#grnFormNotes").value.trim()
      };

      const label = receipt ? receipt.receiptCode : "this receipt";

      if (editingId) {
        openConfirm({
          title: "Save changes to this GRN?",
          message: `This GRN for ${label} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_GrnRepository.update(editingId, payload);
            logSystemActivity({ module: "GRN", action: "Update", description: `Updated GRN for ${label} (${company.name})` });
            closeModal("grnFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_GrnRepository.findById(editingId));
            showToast("GRN updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this GRN?",
          message: `A new GRN will be created as a Draft for ${label}.`,
          confirmLabel: "Create GRN",
          onConfirm: () => {
            const created = ERP_GrnRepository.create(company, payload);
            logSystemActivity({ module: "GRN", action: "Create", description: `Created GRN "${created.grnNumber}" for ${label} (${company.name})` });
            closeModal("grnFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.grnNumber}" created as a Draft.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestPost(grn) {
    openConfirm({
      title: "Post this GRN?",
      message: `"${grn.grnNumber}" will be marked Posted — treat this as the formal, accounting-relevant record from here on.`,
      confirmLabel: "Post",
      onConfirm: () => {
        ERP_GrnRepository.post(grn.id, session.username);
        logSystemActivity({ module: "GRN", action: "Post", description: `Posted GRN "${grn.grnNumber}" (${company.name})` });

        // Auto-post to the General Ledger (Phase 6 retrofit pass) — see
        // data/gl-posting-data.js's own header. Typeof-guarded since not
        // every page loads the GL posting layer.
        if (typeof ERP_GlPostingRepository !== "undefined") {
          const glResult = ERP_GlPostingRepository.postGrnReceipt(company, ERP_GrnRepository.findById(grn.id), session.username);
          if (glResult.success) {
            logSystemActivity({ module: "GRN", action: "Auto-Post", description: `Auto-posted journal entry ${glResult.entry.entryNumber} for GRN "${grn.grnNumber}" (${company.name})` });
            showToast(`Posted to the General Ledger as ${glResult.entry.entryNumber}.`, "info", { title: "Journal Entry created" });
          } else {
            showToast(glResult.reason, "warning", { title: "Not posted to the books" });
          }
        }

        // Auto-post to the Stock Ledger (Phase 7 retrofit pass) — see
        // data/stock-posting-data.js's own header. Typeof-guarded the
        // same way the GL posting call above is.
        if (typeof ERP_StockPostingRepository !== "undefined") {
          const stockResult = ERP_StockPostingRepository.postGrnReceipt(company, ERP_GrnRepository.findById(grn.id), session.username);
          if (stockResult.success && stockResult.entries.length > 0) {
            logSystemActivity({ module: "GRN", action: "Auto-Post", description: `Posted ${stockResult.entries.length} Stock Ledger entr${stockResult.entries.length === 1 ? "y" : "ies"} for GRN "${grn.grnNumber}" (${company.name})` });
            const skipNote = stockResult.skippedCount ? ` (${stockResult.skippedCount} line${stockResult.skippedCount === 1 ? "" : "s"} skipped — no catalog item linked)` : "";
            showToast(`Posted ${stockResult.entries.length} line${stockResult.entries.length === 1 ? "" : "s"} to the Stock Ledger${skipNote}.`, "info", { title: "Stock Ledger updated" });
          } else if (!stockResult.success) {
            showToast(stockResult.reason, "warning", { title: "Not posted to the Stock Ledger" });
          } else if (stockResult.reason) {
            showToast(stockResult.reason, "warning", { title: "Not posted to the Stock Ledger" });
          }
        }

        renderAll();
        renderActivity();
        if (detailId === grn.id) openDetailModal(ERP_GrnRepository.findById(grn.id));
        showToast(`"${grn.grnNumber}" posted.`, "success");
      }
    });
  }

  function requestReopen(grn) {
    openConfirm({
      title: "Reopen this GRN?",
      message: `"${grn.grnNumber}" will move back to Draft so you can correct it.`,
      confirmLabel: "Reopen",
      onConfirm: () => {
        ERP_GrnRepository.reopen(grn.id);
        logSystemActivity({ module: "GRN", action: "Reopen", description: `Reopened GRN "${grn.grnNumber}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === grn.id) openDetailModal(ERP_GrnRepository.findById(grn.id));
        showToast(`"${grn.grnNumber}" is back in Draft.`, "info");
      }
    });
  }

  function requestCancel(grn) {
    openConfirm({
      title: "Cancel this GRN?",
      message: `"${grn.grnNumber}" will be marked Cancelled and its goods receipt freed up for a different GRN.`,
      confirmLabel: "Cancel GRN",
      onConfirm: () => {
        ERP_GrnRepository.cancel(grn.id, session.username);
        logSystemActivity({ module: "GRN", action: "Cancel", description: `Cancelled GRN "${grn.grnNumber}" (${company.name})`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === grn.id) openDetailModal(ERP_GrnRepository.findById(grn.id));
        showToast(`"${grn.grnNumber}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(grn) {
    if (!ERP_GrnRepository.canDelete(grn)) {
      showToast(`"${grn.grnNumber}" is ${grn.status} and can't be deleted. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this GRN?",
      message: `"${grn.grnNumber}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_GrnRepository.remove(grn.id);
        logSystemActivity({ module: "GRN", action: "Delete", description: `Deleted GRN "${grn.grnNumber}" (${company.name})`, severity: "warning" });
        if (detailId === grn.id) closeModal("grnDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${grn.grnNumber}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(grn) {
    const footer = $("#grnDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (grn.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(grn));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("grnDetailModal"); openEditModal(grn); });
      addBtn("Post", "btn btn--primary", () => requestPost(grn));
    } else if (grn.status === "Posted") {
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(grn));
      addBtn("Reopen to Draft", "btn btn--ghost", () => requestReopen(grn));
    } else if (grn.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(grn));
    }
  }

  function openDetailModal(grn) {
    detailId = grn.id;
    const receipt = ERP_GoodsReceiptRepository.findById(grn.linkedReceiptId);
    const { po } = resolveChain(receipt);
    const vendor = po && po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;

    $("#grnDetailTitle").textContent = `${grn.grnNumber} · ${grn.status}`;

    const rows = [];
    rows.push(`<div><dt>GRN Number</dt><dd><code>${escapeHtml(grn.grnNumber)}</code></dd></div>`);
    rows.push(`<div><dt>Goods Receipt</dt><dd>${receipt ? `<code>${escapeHtml(receipt.receiptCode)}</code>` : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Purchase Order</dt><dd>${po ? `<code>${escapeHtml(po.poCode)}</code>` : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">—</span>`}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(grn.status)}">${grn.status}</span></dd></div>`);
    rows.push(`<div><dt>Created</dt><dd>${formatDateTime(new Date(grn.createdAt))}</dd></div>`);
    if (grn.postedAt) rows.push(`<div><dt>Posted</dt><dd>${formatDateTime(new Date(grn.postedAt))} by ${escapeHtml(ERP_GrnRepository.actorLabel(grn.postedByUsername))}</dd></div>`);
    if (typeof ERP_QualityInspectionRepository !== "undefined") {
      const linkedInspection = ERP_QualityInspectionRepository.findInspectionForGrn(company.id, grn.id);
      if (linkedInspection) {
        const inspectionBadgeClass = linkedInspection.status === "Completed" ? "success" : linkedInspection.status === "Cancelled" ? "neutral" : "warning";
        rows.push(`<div><dt>Linked to Quality Inspection</dt><dd><code>${escapeHtml(linkedInspection.inspectionCode)}</code> <span class="status-badge status-badge--${inspectionBadgeClass}">${escapeHtml(linkedInspection.status)}</span></dd></div>`);
      } else if (grn.status === "Posted") {
        rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Ready to inspect — see <strong>Quality Inspection</strong>.</dd></div>`);
      }
    }
    if (grn.status === "Cancelled" && grn.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(grn.cancelledAt))} by ${escapeHtml(ERP_GrnRepository.actorLabel(grn.cancelledByUsername))}</dd></div>`);
    // RETROFIT (Phase 15, Module 03a): a GRN, like an invoice, is NOT
    // exclusive over its own Purchase Return — several partial returns
    // over time are normal — so this is the AGGREGATE shape (count +
    // total quantity + most recent status), mirroring Sales Return's
    // own retrofit into Tax Invoice one phase earlier.
    if (typeof ERP_PurchaseReturnRepository !== "undefined") {
      const returns = ERP_PurchaseReturnRepository.getAllForGrn(company.id, grn.id);
      const live = returns.filter((r) => r.status !== "Cancelled");
      if (returns.length) {
        const latest = returns[0];
        const returnBadgeClass = latest.status === "Returned" ? "success" : latest.status === "Cancelled" ? "neutral" : "warning";
        const totalQty = live.reduce((s, r) => s + ERP_PurchaseReturnRepository.computeTotalReturnQuantity(r), 0);
        rows.push(`<div><dt>Purchase Returns</dt><dd>${returns.length} raised · ${totalQty} unit(s) sent back · most recent <span class="status-badge status-badge--${returnBadgeClass}">${escapeHtml(latest.status)}</span></dd></div>`);
      }
    }
    if (grn.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(grn.notes)}</dd></div>`);

    $("#grnDetailBody").innerHTML = rows.join("");
    renderLineDisplayTable("grnLineTableBody", grn.grnLines || [], receipt);
    const { total, pricedCount, totalCount } = ERP_GrnRepository.computeGrandTotal(grn);
    if (totalCount === 0) {
      $("#grnGrandTotalLine").textContent = "";
    } else if (pricedCount === totalCount) {
      $("#grnGrandTotalLine").textContent = `GRN value: ${formatCurrency(total)}`;
    } else {
      $("#grnGrandTotalLine").textContent = `GRN value: ~${formatCurrency(total)} (${pricedCount} of ${totalCount} lines priced)`;
    }
    renderDetailFooter(grn);
    openModal("grnDetailModal");
  }

  function bindDetailModal() {
    $("#grnTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const g = ERP_GrnRepository.findById(viewBtn.dataset.id);
        if (g) openDetailModal(g);
        return;
      }
      if (actionBtn) {
        const g = ERP_GrnRepository.findById(actionBtn.dataset.id);
        if (!g) return;
        if (actionBtn.dataset.action === "post") requestPost(g);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "grn")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading GRNs…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#grnContent").hidden = true;
      $("#grnSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#grnContent").hidden = false;
      $("#grnHeaderActions").hidden = false;
      $("#grnSubtitle").textContent = `Posting GRNs for ${company.name} (${company.companyCode}).`;

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
