/* =============================================================================
   DOT ERP — pages/purchase-return.js
   Phase 15, Module 03a: Purchase Return

   Same "line table lives inside the form modal" shape Sales Return
   established. The one real behavioural difference: post() here can
   report a skipped line (insufficient stock to actually send back),
   so the post confirmation and result toast both say so plainly rather
   than pretending every line always goes through.
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
  let selectedGrn = null;
  let draftLines = [];
  let editingId = null;

  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function itemLabel(id) { const i = id && typeof ERP_ItemRepository !== "undefined" ? ERP_ItemRepository.findById(id) : null; return i ? i.itemName : "Unresolved line"; }
  function warehouseLabel(id) { const w = id ? ERP_WarehouseRepository.findById(id) : null; return w ? w.warehouseName : "Not selected"; }
  function vendorLabel(id) { const v = id ? ERP_VendorRepository.findById(id) : null; return v ? v.vendorName : "Unknown vendor"; }
  function grnLabel(id) { const g = id && typeof ERP_GrnRepository !== "undefined" ? ERP_GrnRepository.findById(id) : null; return g ? g.grnNumber : "Unknown GRN"; }
  function vendorForGrn(grn) {
    const chain = ERP_PurchaseReturnRepository.resolveChainForGrn(grn);
    return chain.po ? chain.po.vendorId : null;
  }

  function statusBadge(status) {
    const tone = status === "Returned" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY / LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_PurchaseReturnRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((r) =>
        (r.returnCode || "").toLowerCase().includes(q) ||
        grnLabel(r.linkedGrnId).toLowerCase().includes(q)
      );
    }
    const btn = $("#pretSortBtn");
    if (btn && btn.dataset.order === "asc") rows = [...rows].reverse();
    return rows;
  }

  function renderSummary() {
    const all = ERP_PurchaseReturnRepository.getAllForCompany(company.id);
    $("#pretSummaryTotal").textContent = String(all.length);
    $("#pretSummaryDraft").textContent = String(all.filter((r) => r.status === "Draft").length);
    $("#pretSummaryReturned").textContent = String(all.filter((r) => r.status === "Returned").length);
    $("#pretSummaryCancelled").textContent = String(all.filter((r) => r.status === "Cancelled").length);
  }

  function renderPagination(totalPages) {
    const container = $("#pretPagination");
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

    $("#pretEmptyState").hidden = all.length !== 0;
    $("#pretTable").hidden = all.length === 0;

    $("#pretTableBody").innerHTML = pageItems.map((r) => {
      const grn = typeof ERP_GrnRepository !== "undefined" ? ERP_GrnRepository.findById(r.linkedGrnId) : null;
      return `
      <tr>
        <td><code>${escapeHtml(r.returnCode)}</code></td>
        <td>${escapeHtml(grnLabel(r.linkedGrnId))}</td>
        <td>${escapeHtml(grn ? vendorLabel(vendorForGrn(grn)) : "—")}</td>
        <td class="text-right">${formatQty(ERP_PurchaseReturnRepository.computeTotalReturnQuantity(r))}</td>
        <td>${escapeHtml(r.reason || "—")}</td>
        <td>${r.returnDate || "—"}</td>
        <td>${statusBadge(r.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">View</button></td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#pretStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#pretStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
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
    $("#pretSortBtn").addEventListener("click", () => {
      const btn = $("#pretSortBtn");
      const asc = btn.dataset.order === "asc";
      btn.dataset.order = asc ? "desc" : "asc";
      btn.textContent = asc ? "Newest First" : "Oldest First";
      renderTable();
    });
    $("#pretExportCsvBtn").addEventListener("click", exportCsv);
    $("#pretPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Return Code", "GRN", "Total Qty Returned", "Reason", "Warehouse", "Return Date", "Status"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([
        r.returnCode,
        grnLabel(r.linkedGrnId),
        ERP_PurchaseReturnRepository.computeTotalReturnQuantity(r),
        `"${r.reason || ""}"`,
        `"${warehouseLabel(r.vendorWarehouseId)}"`,
        r.returnDate || "",
        r.status
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `purchase-returns-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Purchase Return")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#pretActivityEmptyState").hidden = relevant.length !== 0;
    $("#pretActivityList").innerHTML = relevant.map((e) => `
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
  function populateGrnOptions(selectedId) {
    const grns = ERP_PurchaseReturnRepository.getReturnableGrnsForCompany(company.id);
    const select = $("#pretFormGrn");
    if (!grns.length && !selectedId) {
      select.innerHTML = `<option value="">No posted GRN has anything left to return</option>`;
      select.disabled = true;
      return;
    }
    select.disabled = false;
    const options = grns.map((g) =>
      `<option value="${g.id}">${escapeHtml(g.grnNumber)} — ${escapeHtml(vendorLabel(vendorForGrn(g)))}</option>`
    );
    if (selectedId && !grns.some((g) => g.id === selectedId)) {
      const g = ERP_GrnRepository.findById(selectedId);
      if (g) options.unshift(`<option value="${g.id}">${escapeHtml(g.grnNumber)} — ${escapeHtml(vendorLabel(vendorForGrn(g)))}</option>`);
    }
    select.innerHTML = `<option value="">Select a posted GRN…</option>` + options.join("");
    if (selectedId) select.value = selectedId;
  }

  function populateWarehouseOptions(selectedId) {
    const warehouses = ERP_WarehouseRepository.getAllForCompany(company.id).filter((w) => w.status === "Active");
    $("#pretFormWarehouse").innerHTML =
      `<option value="">Select a warehouse…</option>` +
      warehouses.map((w) => `<option value="${w.id}">${escapeHtml(w.warehouseName)}</option>`).join("");
    if (selectedId) $("#pretFormWarehouse").value = selectedId;
  }

  function populateReasonOptions(selected) {
    $("#pretFormReason").innerHTML = ERP_PurchaseReturnRepository.reasons
      .map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
    if (selected) $("#pretFormReason").value = selected;
  }

  function rebuildDraftLines(grn, existing) {
    const typed = {};
    (existing || draftLines).forEach((l) => { typed[l.prLineItemId] = l.returnQuantity; });
    draftLines = ERP_PurchaseReturnRepository.buildReturnLines(company.id, grn).map((l) => ({
      ...l,
      alreadyReturnedQuantity: ERP_PurchaseReturnRepository.getReturnedQuantityForGrnLine(company.id, grn.id, l.prLineItemId, editingId),
      returnQuantity: typed[l.prLineItemId] != null ? typed[l.prLineItemId] : 0
    }));
  }

  function renderFormLines() {
    const body = $("#pretFormLinesBody");
    if (!draftLines.length) {
      body.innerHTML = "";
      $("#pretFormLinesEmpty").hidden = false;
      $("#pretFormTotalQty").textContent = "0";
      return;
    }
    $("#pretFormLinesEmpty").hidden = true;
    body.innerHTML = draftLines.map((l) => {
      const remaining = Math.max(0, (Number(l.receivedQuantity) || 0) - (Number(l.alreadyReturnedQuantity) || 0));
      return `
        <tr data-line-id="${l.prLineItemId}">
          <td>${escapeHtml(itemLabel(l.itemId))}</td>
          <td class="text-right">${formatQty(l.receivedQuantity)}</td>
          <td class="text-right">${formatQty(l.alreadyReturnedQuantity)}</td>
          <td class="text-right">${formatQty(remaining)}</td>
          <td class="text-right">
            <input type="number" class="pret-line-qty" data-line-id="${l.prLineItemId}"
                   min="0" max="${remaining}" step="0.01" value="${l.returnQuantity || 0}" />
          </td>
        </tr>`;
    }).join("");
    updateTotalQty();
  }

  function updateTotalQty() {
    const total = draftLines.reduce((s, l) => s + (Number(l.returnQuantity) || 0), 0);
    $("#pretFormTotalQty").textContent = formatQty(total);
  }

  function onGrnPicked() {
    const id = $("#pretFormGrn").value;
    selectedGrn = id && typeof ERP_GrnRepository !== "undefined" ? ERP_GrnRepository.findById(id) : null;
    $("#pretFormGrnError").textContent = "";
    if (!selectedGrn) {
      draftLines = [];
      $("#pretFormGrnInfo").textContent = "";
      renderFormLines();
      return;
    }
    $("#pretFormGrnInfo").textContent = `Vendor: ${vendorLabel(vendorForGrn(selectedGrn))} · Received: ${selectedGrn.receivedDate || selectedGrn.createdAt?.slice(0, 10) || "—"}`;
    rebuildDraftLines(selectedGrn, []);
    renderFormLines();
  }

  function openAddModal() {
    editingId = null;
    selectedGrn = null;
    draftLines = [];
    const available = ERP_PurchaseReturnRepository.getReturnableGrnsForCompany(company.id);
    if (!available.length) {
      showToast("No posted GRN has anything left to return yet.", "warning");
      return;
    }
    $("#pretFormTitle").textContent = "New purchase return";
    $("#pretFormIntro").textContent = "Pick the GRN these goods were received on — every line starts at zero, since a return is almost never for the whole GRN.";
    $("#pretFormSaveBtn").textContent = "Create Purchase Return";
    populateGrnOptions(null);
    populateWarehouseOptions(null);
    populateReasonOptions(null);
    $("#pretFormGrn").disabled = false;
    $("#pretFormReturnDate").value = new Date().toISOString().slice(0, 10);
    $("#pretFormRemarks").value = "";
    $("#pretFormGrnError").textContent = "";
    $("#pretFormWarehouseError").textContent = "";
    $("#pretFormLinesError").textContent = "";
    $("#pretFormGrnInfo").textContent = "";
    renderFormLines();
    openModal("pretFormModal");
  }

  function openEditModal(record) {
    editingId = record.id;
    selectedGrn = typeof ERP_GrnRepository !== "undefined" ? ERP_GrnRepository.findById(record.linkedGrnId) : null;
    if (!selectedGrn) { showToast("The linked GRN no longer exists.", "danger"); return; }
    $("#pretFormTitle").textContent = `Edit purchase return — ${record.returnCode}`;
    $("#pretFormIntro").textContent = "Only a Draft can be edited. The GRN it was raised against is fixed.";
    $("#pretFormSaveBtn").textContent = "Save Changes";
    populateGrnOptions(record.linkedGrnId);
    $("#pretFormGrn").value = record.linkedGrnId;
    $("#pretFormGrn").disabled = true;
    populateWarehouseOptions(record.vendorWarehouseId);
    populateReasonOptions(record.reason);
    $("#pretFormReturnDate").value = record.returnDate || "";
    $("#pretFormRemarks").value = record.remarks || "";
    $("#pretFormGrnError").textContent = "";
    $("#pretFormWarehouseError").textContent = "";
    $("#pretFormLinesError").textContent = "";
    $("#pretFormGrnInfo").textContent = `Vendor: ${vendorLabel(vendorForGrn(selectedGrn))}`;
    rebuildDraftLines(selectedGrn, record.returnLines);
    renderFormLines();
    closeModal("pretDetailModal");
    openModal("pretFormModal");
  }

  function validateForm() {
    let valid = true;
    $("#pretFormGrnError").textContent = "";
    $("#pretFormWarehouseError").textContent = "";
    $("#pretFormLinesError").textContent = "";

    if (!selectedGrn) {
      $("#pretFormGrnError").textContent = "Pick the GRN these goods were received on.";
      valid = false;
    }
    if (!$("#pretFormWarehouse").value) {
      $("#pretFormWarehouseError").textContent = "Pick the warehouse these goods are leaving from.";
      valid = false;
    }
    if (selectedGrn) {
      const result = ERP_PurchaseReturnRepository.validateQuantities(company.id, selectedGrn, draftLines, editingId);
      if (!result.ok) {
        $("#pretFormLinesError").textContent = result.errors[0].message;
        valid = false;
      }
    }
    return valid;
  }

  function bindFormModal() {
    $("#pretAddBtn").addEventListener("click", openAddModal);
    $("#pretFormGrn").addEventListener("change", onGrnPicked);

    $("#pretFormLinesBody").addEventListener("input", (e) => {
      const input = e.target.closest(".pret-line-qty");
      if (!input) return;
      const line = draftLines.find((l) => l.prLineItemId === input.dataset.lineId);
      if (!line) return;
      line.returnQuantity = Number(input.value) || 0;
      updateTotalQty();
    });

    $("#pretFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const payload = {
        vendorWarehouseId: $("#pretFormWarehouse").value || null,
        returnDate: $("#pretFormReturnDate").value || new Date().toISOString().slice(0, 10),
        reason: $("#pretFormReason").value,
        remarks: $("#pretFormRemarks").value.trim(),
        returnLines: draftLines
      };
      if (editingId) {
        const updated = ERP_PurchaseReturnRepository.update(editingId, payload);
        if (!updated) { showToast("Couldn't save — only a Draft can be edited.", "danger"); return; }
        logSystemActivity({ module: "Purchase Return", action: "Update", description: `Updated purchase return "${updated.returnCode}" (${company.name})` });
        showToast("Purchase return updated.", "success");
      } else {
        const created = ERP_PurchaseReturnRepository.create(company, selectedGrn, payload, session.username);
        logSystemActivity({ module: "Purchase Return", action: "Create", description: `Created purchase return "${created.returnCode}" against GRN ${grnLabel(created.linkedGrnId)} (${company.name})` });
        showToast("Purchase return saved as Draft — post it to send the goods back to the vendor.", "success");
      }
      closeModal("pretFormModal");
      editingId = null;
      renderAll();
      renderActivity();
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function renderDetailFooter(record) {
    const footer = $("#pretDetailFooter");
    footer.innerHTML = "";

    if (record.status === "Draft") {
      const postBtn = document.createElement("button");
      postBtn.type = "button";
      postBtn.className = "btn btn--primary";
      postBtn.textContent = "Post (sends goods back to the vendor)";
      postBtn.disabled = !ERP_PurchaseReturnRepository.canPost(record);
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
    closeBtn.addEventListener("click", () => closeModal("pretDetailModal"));
    footer.appendChild(closeBtn);
  }

  function openDetailModal(record) {
    const grn = typeof ERP_GrnRepository !== "undefined" ? ERP_GrnRepository.findById(record.linkedGrnId) : null;

    $("#pretDetailTitle").textContent = `Purchase Return — ${record.returnCode}`;
    $("#pretDetailBody").innerHTML = `
      <div><dt>Return Code</dt><dd><code>${escapeHtml(record.returnCode)}</code></dd></div>
      <div><dt>Against GRN</dt><dd>${escapeHtml(grnLabel(record.linkedGrnId))}</dd></div>
      <div><dt>Vendor</dt><dd>${escapeHtml(grn ? vendorLabel(vendorForGrn(grn)) : "—")}</dd></div>
      <div><dt>Sent From Warehouse</dt><dd>${escapeHtml(warehouseLabel(record.vendorWarehouseId))}</dd></div>
      <div><dt>Reason</dt><dd>${escapeHtml(record.reason || "—")}</dd></div>
      <div><dt>Return Date</dt><dd>${record.returnDate || "—"}</dd></div>
      <div><dt>Total Quantity Returned</dt><dd>${formatQty(ERP_PurchaseReturnRepository.computeTotalReturnQuantity(record))}</dd></div>
      <div><dt>Remarks</dt><dd>${record.remarks ? escapeHtml(record.remarks) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(record.status)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(record.createdAt))} by ${escapeHtml(actorLabel(record.createdByUsername))}</dd></div>
      ${record.status === "Returned" ? `<div><dt>Posted</dt><dd>${formatDateTime(new Date(record.returnedAt))} by ${escapeHtml(actorLabel(record.returnedByUsername))}</dd></div>` : ""}
      ${record.status === "Cancelled" ? `<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(record.cancelledAt))} by ${escapeHtml(actorLabel(record.cancelledByUsername))}</dd></div>` : ""}
      <div><dt>Debit Note</dt><dd>${debitNoteRow(record)}</dd></div>
    `;

    const lines = record.returnLines || [];
    $("#pretDetailLinesBody").innerHTML = lines.map((l) => `
      <tr>
        <td>${escapeHtml(itemLabel(l.itemId))}</td>
        <td class="text-right">${formatQty(l.receivedQuantity)}</td>
        <td class="text-right">${formatQty(l.returnQuantity)}</td>
      </tr>`).join("");
    $("#pretDetailLinesEmpty").hidden = lines.length !== 0;

    renderDetailFooter(record);
    openModal("pretDetailModal");
  }

  /** Forward-looking row for Debit Note (Module 03b) — typeof-guarded,
      the same shape Sales Return's own creditNoteRow() used. */
  function debitNoteRow(record) {
    if (typeof ERP_DebitNoteRepository === "undefined") {
      return `<span class="profile-subtle">Debit Note isn't built yet — the financial side of this return is still open.</span>`;
    }
    const note = ERP_DebitNoteRepository.findNoteForReturn(company.id, record.id);
    if (!note) return `<span class="profile-subtle">No debit note raised yet.</span>`;
    return `${escapeHtml(note.noteCode)} — ${escapeHtml(note.status)}`;
  }

  function requestPost(record) {
    if (!ERP_PurchaseReturnRepository.canPost(record)) return;
    openConfirm({
      title: "Post this purchase return?",
      message: "This writes one Stock Ledger entry per returned line whose warehouse currently holds enough of that item, sending the goods back out. A line with insufficient stock is skipped rather than posted lopsided, and you'll be told if that happens. Stock Ledger entries can't be edited or removed, so this can't be undone. The money side is handled separately, by a Debit Note.",
      confirmLabel: "Post",
      onConfirm: () => {
        const result = ERP_PurchaseReturnRepository.post(record.id, company, session.username);
        if (result.success) {
          logSystemActivity({ module: "Purchase Return", action: "Post", description: `Posted purchase return "${result.record.returnCode}" — ${result.linesPosted} stock line(s) sent back${result.skippedCount ? `, ${result.skippedCount} skipped for insufficient stock` : ""} (${company.name})` });

          // Books the physical inventory reversal to the General Ledger,
          // at the FIFO cost worked out per line, debiting Accounts
          // Payable or GR/IR Clearing depending on whether this GRN's
          // bill has already been verified — see gl-posting-data.js's
          // own postPurchaseReturnCogs().
          if (typeof ERP_GlPostingRepository !== "undefined" && result.costedLines && result.costedLines.length) {
            const glResult = ERP_GlPostingRepository.postPurchaseReturnCogs(company, result.record, result.costedLines, session.username);
            if (glResult.success && !glResult.skipped) {
              logSystemActivity({ module: "Purchase Return", action: "Auto-Post", description: `Posted inventory reversal for purchase return "${result.record.returnCode}" (${company.name})` });
            } else if (!glResult.success) {
              showToast(glResult.reason, "warning", { title: "Not posted to the books" });
            }
          }

          closeModal("pretDetailModal");
          renderAll();
          renderActivity();
          const skippedNote = result.skippedCount ? ` ${result.skippedCount} line(s) were skipped — not enough stock on hand to send back.` : "";
          showToast(`Sent ${formatQty(ERP_PurchaseReturnRepository.computeTotalReturnQuantity(result.record))} unit(s) back to the vendor.${skippedNote} Raise a Debit Note next to settle the money side.`, result.skippedCount ? "warning" : "success");
        } else {
          showToast(result.reason || "Couldn't post this return.", "danger");
        }
      }
    });
  }

  function requestCancel(record) {
    openConfirm({
      title: "Cancel this draft?",
      message: "This draft was never posted, so nothing has been written to the Stock Ledger — cancelling is safe, and it frees the quantities back up for another return against the same GRN.",
      confirmLabel: "Cancel Return",
      onConfirm: () => {
        ERP_PurchaseReturnRepository.cancel(record.id, session.username);
        logSystemActivity({ module: "Purchase Return", action: "Cancel", description: `Cancelled purchase return "${record.returnCode}" (${company.name})` });
        closeModal("pretDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#pretTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const record = ERP_PurchaseReturnRepository.findById(viewBtn.dataset.id);
      if (record) openDetailModal(record);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "purchase-return")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading purchase returns…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#pretContent").hidden = true;
      $("#pretSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#pretContent").hidden = false;
      $("#pretHeaderActions").hidden = false;
      $("#pretSubtitle").textContent = `Managing purchase returns for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
