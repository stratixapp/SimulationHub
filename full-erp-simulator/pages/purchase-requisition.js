/* =============================================================================
   DOT ERP — pages/purchase-requisition.js
   Phase 4, Module 2: Purchase Requisition

   See data/pr-data.js's header for the full design rationale (line items,
   need exclusivity, why Approve/Reject live in a future module). This
   file is the UI layer specific decisions on top of that:

   - THE DETAIL MODAL IS THE WORKSPACE. Unlike every prior module, Add
     only creates the HEADER (raisedByEmployeeId/preferredVendorId/
     requiredByDate/notes) — line items are added, edited, and removed
     from inside the Detail modal (#prDetailModal), which is why it's
     noticeably richer here than in any Master Data or even Department
     Need's own Detail modal. Two nested modals (#prFormModal for the
     header, #prLineItemModal for one line) instead of one, because the
     header and a line item are genuinely different kinds of things, not
     because of habit.
   - NO Submitted quick-action, and NO Approve/Reject anywhere on this
     page. Department Need's Submitted state offered a row quick-action
     ("Approve") because Department Need owned its whole lifecycle; this
     module deliberately does NOT own the Submitted -> Approved/Rejected
     transition (see pr-data.js's header) so there is nothing to offer.
   - "Link an approved need" PRE-FILLS a line item's item/description/
     quantity but never locks them — the PR creator can still adjust a
     quantity up to a case size or reword the description after picking a
     source need.
   - Department Need's own Detail modal picks up a small addition here
     (see the bottom of this file / department-need.js's own diff): a
     "Linked to PR" row, resolved live via `ERP_PurchaseRequisitionRepository
     .findPrForNeed()`, which is why department-need.html now also loads
     `../data/pr-data.js`.
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
  let sortOrder = "desc"; // newest first by default
  let searchTerm = "";
  let page = 1;
  let editingId = null;   // PR header being created/edited in #prFormModal
  let detailId = null;    // PR currently open in #prDetailModal
  let editingLineId = null; // line item being edited in #prLineItemModal (null = adding)


  /* -----------------------------------------------------------------------
     BADGE COLOR MAPPING — identical to Department Need's, same 5-status
     vocabulary.
     --------------------------------------------------------------------- */
  function statusBadgeClass(status) {
    if (status === "Approved") return "success";
    if (status === "Rejected") return "danger";
    if (status === "Submitted") return "warning";
    return "neutral"; // Draft, Cancelled
  }

  /** Draft -> Submit, Rejected -> Revise. Submitted/Approved/Cancelled get
      NO row quick-action here — see file header. */
  function quickActionFor(pr) {
    if (pr.status === "Draft") return { action: "submit", label: "Submit" };
    if (pr.status === "Rejected") return { action: "revise", label: "Revise" };
    return null;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_PurchaseRequisitionRepository.getAllForCompany(company.id); // newest-first

    if (filterStatus !== "all") rows = rows.filter((p) => p.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((p) => {
        const emp = ERP_EmployeeRepository.findById(p.raisedByEmployeeId);
        const vendor = p.preferredVendorId ? ERP_VendorRepository.findById(p.preferredVendorId) : null;
        return p.prCode.toLowerCase().includes(term) ||
          (emp && emp.fullName.toLowerCase().includes(term)) ||
          (vendor && vendor.vendorName.toLowerCase().includes(term));
      });
    }

    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_PurchaseRequisitionRepository.getAllForCompany(company.id);
    $("#prSummaryTotal").textContent = String(all.length);
    $("#prSummaryDraft").textContent = String(all.filter((p) => p.status === "Draft").length);
    $("#prSummarySubmitted").textContent = String(all.filter((p) => p.status === "Submitted").length);
    $("#prSummaryApproved").textContent = String(all.filter((p) => p.status === "Approved").length);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#prPagination");
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

    $("#prEmptyState").hidden = all.length !== 0;
    $("#prTable").hidden = all.length === 0;

    $("#prTableBody").innerHTML = pageItems.map((p) => {
      const emp = ERP_EmployeeRepository.findById(p.raisedByEmployeeId);
      const vendor = p.preferredVendorId ? ERP_VendorRepository.findById(p.preferredVendorId) : null;
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(p.status)}">${p.status}</span>`;
      const { total, pricedCount, totalCount } = ERP_PurchaseRequisitionRepository.computeGrandTotal(p);
      const totalLabel = totalCount === 0
        ? `<span class="profile-subtle">—</span>`
        : (pricedCount === totalCount ? formatCurrency(total) : `~${formatCurrency(total)}`);
      const requiredBy = p.requiredByDate ? escapeHtml(p.requiredByDate) : `<span class="profile-subtle">—</span>`;
      const qa = quickActionFor(p);
      const quickActionHtml = qa ? `<button type="button" class="link-btn" data-action="${qa.action}" data-id="${p.id}">${qa.label}</button>` : "";

      return `
      <tr>
        <td><code>${escapeHtml(p.prCode)}</code></td>
        <td>${emp ? escapeHtml(emp.fullName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Not set</span>`}</td>
        <td>${totalCount}</td>
        <td>${totalLabel}</td>
        <td>${requiredBy}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${p.id}">View</button>
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
    $$("#prStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#prStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#prSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#prSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#prExportCsvBtn").addEventListener("click", exportCsv);
    $("#prPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["PR Code", "Raised By", "Preferred Vendor", "Line Items", "Est. Total", "Required By", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((p) => {
      const emp = ERP_EmployeeRepository.findById(p.raisedByEmployeeId);
      const vendor = p.preferredVendorId ? ERP_VendorRepository.findById(p.preferredVendorId) : null;
      const { total, totalCount } = ERP_PurchaseRequisitionRepository.computeGrandTotal(p);
      const line = [
        p.prCode, emp ? emp.fullName : "", vendor ? vendor.vendorName : "", totalCount,
        total, p.requiredByDate || "", p.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-purchase-requisitions-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Purchase requisitions exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((p) => {
      const emp = ERP_EmployeeRepository.findById(p.raisedByEmployeeId);
      const vendor = p.preferredVendorId ? ERP_VendorRepository.findById(p.preferredVendorId) : null;
      const { total, totalCount } = ERP_PurchaseRequisitionRepository.computeGrandTotal(p);
      return `<tr><td>${escapeHtml(p.prCode)}</td><td>${emp ? escapeHtml(emp.fullName) : ""}</td><td>${vendor ? escapeHtml(vendor.vendorName) : ""}</td><td>${totalCount}</td><td>${escapeHtml(formatCurrency(total))}</td><td>${escapeHtml(p.requiredByDate || "")}</td><td>${escapeHtml(p.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Purchase Requisition Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Purchase Requisition Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>PR Code</th><th>Raised By</th><th>Preferred Vendor</th><th>Lines</th><th>Est. Total</th><th>Required By</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Purchase Requisition")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#prActivityEmptyState").hidden = relevant.length !== 0;
    $("#prActivityList").innerHTML = relevant.map((e) => `
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
     HEADER FORM (#prFormModal) — creates/edits raisedByEmployeeId /
     preferredVendorId / requiredByDate / notes only. Line items live in
     the Detail modal (below).
     --------------------------------------------------------------------- */
  function populateRaisedByOptions(currentId) {
    let emps = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status !== "Inactive");
    if (currentId && !emps.some((e) => e.id === currentId)) {
      const current = ERP_EmployeeRepository.findById(currentId);
      if (current) emps = emps.concat([current]);
    }
    emps = emps.slice().sort((a, b) => a.fullName.localeCompare(b.fullName));
    $("#prFormRaisedBy").innerHTML = emps.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)} (${escapeHtml(e.employeeCode)})</option>`).join("");
  }

  function populateVendorOptions(currentId) {
    let vendors = ERP_VendorRepository.getAllForCompany(company.id).filter((v) => v.status === "Active");
    if (currentId && !vendors.some((v) => v.id === currentId)) {
      const current = ERP_VendorRepository.findById(currentId);
      if (current) vendors = vendors.concat([current]);
    }
    vendors = vendors.slice().sort((a, b) => a.vendorName.localeCompare(b.vendorName));
    $("#prFormVendor").innerHTML = `<option value="">Not set</option>` + vendors.map((v) => `<option value="${v.id}">${escapeHtml(v.vendorName)}</option>`).join("");
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }

  function openAddModal() {
    const anyEmp = ERP_EmployeeRepository.getAllForCompany(company.id).some((e) => e.status !== "Inactive");
    if (!anyEmp) {
      showToast("Add at least one active Employee before raising a requisition.", "warning");
      return;
    }
    editingId = null;
    $("#prFormTitle").textContent = "New purchase requisition";
    $("#prFormIntro").textContent = "Set up the requisition header — line items get added once it's created.";
    $("#prFormSaveBtn").textContent = "Create Requisition";
    populateRaisedByOptions(null);
    populateVendorOptions(null);
    $("#prFormRequiredBy").value = "";
    $("#prFormNotes").value = "";
    setFormError("prFormRaisedBy", "");
    openModal("prFormModal");
  }

  function openEditModal(pr) {
    if (!ERP_PurchaseRequisitionRepository.canEdit(pr)) {
      showToast(`"${pr.prCode}" is ${pr.status} and can't be edited directly. Withdraw or revise it back to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = pr.id;
    $("#prFormTitle").textContent = "Edit requisition header";
    $("#prFormIntro").textContent = "Update who's raising this requisition and its target details.";
    $("#prFormSaveBtn").textContent = "Save Changes";
    populateRaisedByOptions(pr.raisedByEmployeeId);
    $("#prFormRaisedBy").value = pr.raisedByEmployeeId;
    populateVendorOptions(pr.preferredVendorId);
    $("#prFormVendor").value = pr.preferredVendorId || "";
    $("#prFormRequiredBy").value = pr.requiredByDate || "";
    $("#prFormNotes").value = pr.notes || "";
    setFormError("prFormRaisedBy", "");
    openModal("prFormModal");
  }

  function validateForm() {
    let valid = true;
    setFormError("prFormRaisedBy", "");
    if (!$("#prFormRaisedBy").value) { setFormError("prFormRaisedBy", "Select who's raising this requisition."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#prAddBtn").addEventListener("click", openAddModal);

    $("#prFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        raisedByEmployeeId: $("#prFormRaisedBy").value,
        preferredVendorId: $("#prFormVendor").value || null,
        requiredByDate: $("#prFormRequiredBy").value || null,
        notes: $("#prFormNotes").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this requisition?",
          message: `This requisition's header details will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_PurchaseRequisitionRepository.update(editingId, payload);
            logSystemActivity({ module: "Purchase Requisition", action: "Update", description: `Updated requisition header for ${company.name}` });
            closeModal("prFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_PurchaseRequisitionRepository.findById(editingId));
            showToast("Requisition updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Create this requisition?",
          message: `A new purchase requisition will be created as a Draft — you'll add line items next.`,
          confirmLabel: "Create Requisition",
          onConfirm: () => {
            const created = ERP_PurchaseRequisitionRepository.create(company, payload);
            logSystemActivity({ module: "Purchase Requisition", action: "Create", description: `Created requisition "${created.prCode}" for ${company.name}` });
            closeModal("prFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.prCode}" created as a Draft. Add line items now.`, "success");
            openDetailModal(created);
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LINE ITEM FORM (#prLineItemModal)
     --------------------------------------------------------------------- */
  function populateLineNeedOptions(currentId) {
    let needs = ERP_PurchaseRequisitionRepository.getAvailableNeedsForCompany(company.id, detailId);
    if (currentId && !needs.some((n) => n.id === currentId) && typeof ERP_DepartmentNeedRepository !== "undefined") {
      const current = ERP_DepartmentNeedRepository.findById(currentId);
      if (current) needs = needs.concat([current]);
    }
    const options = needs.map((n) => {
      const desc = n.needDescription.length > 40 ? n.needDescription.slice(0, 40) + "…" : n.needDescription;
      return `<option value="${n.id}">${escapeHtml(n.needCode)} — ${escapeHtml(desc)}</option>`;
    }).join("");
    $("#prLineNeed").innerHTML = `<option value="">Not linked — enter directly</option>` + options;
  }

  function populateLineItemPicker(currentId) {
    let items = ERP_ItemRepository.getActiveForCompany(company.id);
    if (currentId && !items.some((i) => i.id === currentId)) {
      const current = ERP_ItemRepository.findById(currentId);
      if (current) items = items.concat([current]);
    }
    items = items.slice().sort((a, b) => a.itemName.localeCompare(b.itemName));
    $("#prLineItem").innerHTML = `<option value="">Not linked — describe below</option>` + items.map((i) => `<option value="${i.id}">${escapeHtml(i.itemName)} (${escapeHtml(i.itemCode)})</option>`).join("");
  }

  function applyNeedPrefill(needId) {
    if (!needId) return;
    const need = ERP_DepartmentNeedRepository.findById(needId);
    if (!need) return;
    if (need.itemId) $("#prLineItem").value = need.itemId;
    $("#prLineDescription").value = need.needDescription || "";
    if (need.estimatedQuantity != null) $("#prLineQuantity").value = String(need.estimatedQuantity);
  }

  function checkLineDuplicateHint() {
    const pr = ERP_PurchaseRequisitionRepository.findById(detailId);
    if (!pr) return;
    const itemId = $("#prLineItem").value;
    const dup = ERP_PurchaseRequisitionRepository.findDuplicateLineItemByItem(pr, itemId, editingLineId);
    const hint = $("#prLineDuplicateHint");
    if (dup) {
      hint.textContent = `Heads up: this item is already on another line in this requisition ("${dup.lineDescription || "—"}"). Consider combining the quantities into one line instead.`;
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  }

  function setLineFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearLineFormErrors() {
    ["prLineQuantity", "prLineDescription", "prLineUnitPrice"].forEach((f) => setLineFormError(f, ""));
  }

  function openAddLineModal() {
    editingLineId = null;
    $("#prLineItemTitle").textContent = "Add a line item";
    $("#prLineItemSaveBtn").textContent = "Add Line Item";
    populateLineNeedOptions(null);
    populateLineItemPicker(null);
    $("#prLineNeed").value = "";
    $("#prLineDescription").value = "";
    $("#prLineQuantity").value = "";
    $("#prLineUnitPrice").value = "";
    clearLineFormErrors();
    $("#prLineDuplicateHint").hidden = true;
    openModal("prLineItemModal");
  }

  function openEditLineModal(line) {
    editingLineId = line.id;
    $("#prLineItemTitle").textContent = "Edit line item";
    $("#prLineItemSaveBtn").textContent = "Save Line Item";
    populateLineNeedOptions(line.departmentNeedId);
    populateLineItemPicker(line.itemId);
    $("#prLineNeed").value = line.departmentNeedId || "";
    $("#prLineItem").value = line.itemId || "";
    $("#prLineDescription").value = line.lineDescription || "";
    $("#prLineQuantity").value = line.quantity != null ? String(line.quantity) : "";
    $("#prLineUnitPrice").value = line.estimatedUnitPrice != null ? String(line.estimatedUnitPrice) : "";
    clearLineFormErrors();
    $("#prLineDuplicateHint").hidden = true;
    openModal("prLineItemModal");
    checkLineDuplicateHint();
  }

  /** Item is optional, but a line needs SOME description — required only
      when no catalog item is linked, since the item's own name already
      identifies the line otherwise. A deliberate departure from
      Department Need's "always required" rule — see pr-data.js's header. */
  function validateLineForm() {
    let valid = true;
    clearLineFormErrors();

    const itemId = $("#prLineItem").value;
    const desc = $("#prLineDescription").value.trim();
    if (!itemId && !desc) {
      setLineFormError("prLineDescription", "Describe this line, or link a catalog item above.");
      valid = false;
    }

    const qtyRaw = $("#prLineQuantity").value;
    if (qtyRaw === "" || isNaN(Number(qtyRaw)) || Number(qtyRaw) <= 0) {
      setLineFormError("prLineQuantity", "Enter a quantity greater than zero.");
      valid = false;
    }

    const priceRaw = $("#prLineUnitPrice").value;
    if (priceRaw !== "" && (isNaN(Number(priceRaw)) || Number(priceRaw) < 0)) {
      setLineFormError("prLineUnitPrice", "Enter a positive price, or leave this blank.");
      valid = false;
    }

    return valid;
  }

  function bindLineItemModal() {
    $("#prAddLineBtn").addEventListener("click", openAddLineModal);
    $("#prLineNeed").addEventListener("change", (e) => applyNeedPrefill(e.target.value));
    $("#prLineItem").addEventListener("change", checkLineDuplicateHint);

    $("#prLineItemSaveBtn").addEventListener("click", () => {
      if (!validateLineForm()) return;
      const priceRaw = $("#prLineUnitPrice").value;
      const payload = {
        departmentNeedId: $("#prLineNeed").value || null,
        itemId: $("#prLineItem").value || null,
        lineDescription: $("#prLineDescription").value.trim(),
        quantity: Number($("#prLineQuantity").value),
        estimatedUnitPrice: priceRaw === "" ? null : Number(priceRaw)
      };

      if (editingLineId) {
        ERP_PurchaseRequisitionRepository.updateLineItem(detailId, editingLineId, payload);
        logSystemActivity({ module: "Purchase Requisition", action: "Update Line", description: `Updated a line item on requisition for ${company.name}` });
      } else {
        ERP_PurchaseRequisitionRepository.addLineItem(detailId, payload);
        logSystemActivity({ module: "Purchase Requisition", action: "Add Line", description: `Added a line item to requisition for ${company.name}` });
      }
      closeModal("prLineItemModal");
      renderAll();
      renderActivity();
      openDetailModal(ERP_PurchaseRequisitionRepository.findById(detailId));
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS — Submit/Withdraw/Cancel/Revise/Delete only. No
     Approve/Reject on this page — see file header.
     --------------------------------------------------------------------- */
  function requestSubmit(pr) {
    if (!(pr.lineItems || []).length) {
      showToast(`Add at least one line item to "${pr.prCode}" before submitting it.`, "warning");
      return;
    }
    openConfirm({
      title: "Submit this requisition for approval?",
      message: `"${pr.prCode}" will be locked from further edits and sent into the approval queue.`,
      confirmLabel: "Submit for Approval",
      onConfirm: () => {
        ERP_PurchaseRequisitionRepository.submit(pr.id, session.username);
        logSystemActivity({ module: "Purchase Requisition", action: "Submit", description: `Submitted requisition "${pr.prCode}" for approval (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === pr.id) openDetailModal(ERP_PurchaseRequisitionRepository.findById(pr.id));
        showToast(`"${pr.prCode}" submitted for approval.`, "success");
      }
    });
  }

  function requestWithdraw(pr) {
    openConfirm({
      title: "Withdraw this requisition?",
      message: `"${pr.prCode}" will move back to Draft so you can edit it again before resubmitting.`,
      confirmLabel: "Withdraw",
      onConfirm: () => {
        ERP_PurchaseRequisitionRepository.withdraw(pr.id);
        logSystemActivity({ module: "Purchase Requisition", action: "Withdraw", description: `Withdrew requisition "${pr.prCode}" back to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === pr.id) openDetailModal(ERP_PurchaseRequisitionRepository.findById(pr.id));
        showToast(`"${pr.prCode}" moved back to Draft.`, "info");
      }
    });
  }

  function requestRevise(pr) {
    openConfirm({
      title: "Revise this requisition?",
      message: `"${pr.prCode}" will move back to Draft so you can update it and resubmit.`,
      confirmLabel: "Revise",
      onConfirm: () => {
        ERP_PurchaseRequisitionRepository.reopen(pr.id);
        logSystemActivity({ module: "Purchase Requisition", action: "Revise", description: `Reopened rejected requisition "${pr.prCode}" to Draft for revision (${company.name})` });
        if (detailId === pr.id) closeModal("prDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${pr.prCode}" is back in Draft — update and resubmit when ready.`, "info");
      }
    });
  }

  function requestCancel(pr) {
    openConfirm({
      title: "Cancel this requisition?",
      message: `"${pr.prCode}" will be marked Cancelled and any needs it linked will be freed up for other requisitions.`,
      confirmLabel: "Cancel Requisition",
      onConfirm: () => {
        ERP_PurchaseRequisitionRepository.cancel(pr.id, session.username);
        logSystemActivity({ module: "Purchase Requisition", action: "Cancel", description: `Cancelled requisition "${pr.prCode}" for ${company.name}`, severity: "warning" });
        renderAll();
        renderActivity();
        if (detailId === pr.id) openDetailModal(ERP_PurchaseRequisitionRepository.findById(pr.id));
        showToast(`"${pr.prCode}" cancelled.`, "info");
      }
    });
  }

  function requestDelete(pr) {
    if (!ERP_PurchaseRequisitionRepository.canDelete(pr)) {
      showToast(`"${pr.prCode}" is ${pr.status} and can't be deleted while it's still an active workflow record. Cancel it instead.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this requisition?",
      message: `"${pr.prCode}" will be permanently removed, along with all its line items. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_PurchaseRequisitionRepository.remove(pr.id);
        logSystemActivity({ module: "Purchase Requisition", action: "Delete", description: `Deleted requisition "${pr.prCode}" for ${company.name}`, severity: "warning" });
        if (detailId === pr.id) closeModal("prDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${pr.prCode}" deleted.`, "info");
      }
    });
  }

  function requestRemoveLine(pr, line) {
    openConfirm({
      title: "Remove this line item?",
      message: `This line will be removed from "${pr.prCode}"${line.departmentNeedId ? " and the linked need will be freed up for other requisitions." : "."}`,
      confirmLabel: "Remove Line",
      onConfirm: () => {
        ERP_PurchaseRequisitionRepository.removeLineItem(pr.id, line.id);
        logSystemActivity({ module: "Purchase Requisition", action: "Remove Line", description: `Removed a line item from requisition "${pr.prCode}" (${company.name})` });
        renderAll();
        renderActivity();
        openDetailModal(ERP_PurchaseRequisitionRepository.findById(pr.id));
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL — header info + live line-items table + per-status
     footer. See file header for why this is the workspace.
     --------------------------------------------------------------------- */
  function renderLineItemsTable(pr) {
    const lines = pr.lineItems || [];
    $("#prLineEmptyState").hidden = lines.length !== 0;
    $("#prLineTable").hidden = lines.length === 0;
    const editable = ERP_PurchaseRequisitionRepository.canEdit(pr);
    $("#prAddLineBtn").hidden = !editable;

    $("#prLineTableBody").innerHTML = lines.map((line) => {
      const item = line.itemId ? ERP_ItemRepository.findById(line.itemId) : null;
      const need = line.departmentNeedId ? ERP_DepartmentNeedRepository.findById(line.departmentNeedId) : null;
      const total = ERP_PurchaseRequisitionRepository.computeLineTotal(line);
      const label = item ? `${escapeHtml(item.itemName)}${line.lineDescription ? " — " + escapeHtml(line.lineDescription) : ""}` : escapeHtml(line.lineDescription || "—");
      const needLabel = need ? `<code>${escapeHtml(need.needCode)}</code>` : `<span class="profile-subtle">—</span>`;
      const priceLabel = line.estimatedUnitPrice != null ? escapeHtml(formatCurrency(line.estimatedUnitPrice)) : `<span class="profile-subtle">—</span>`;
      const totalLabel = total != null ? escapeHtml(formatCurrency(total)) : `<span class="profile-subtle">—</span>`;
      const actions = editable
        ? `<button type="button" class="link-btn" data-line-edit="${line.id}">Edit</button> <button type="button" class="link-btn" data-line-remove="${line.id}">Remove</button>`
        : "";
      return `<tr><td>${label}</td><td>${needLabel}</td><td>${escapeHtml(String(line.quantity))}</td><td>${priceLabel}</td><td>${totalLabel}</td><td>${actions}</td></tr>`;
    }).join("");

    const { total, pricedCount, totalCount } = ERP_PurchaseRequisitionRepository.computeGrandTotal(pr);
    if (totalCount === 0) {
      $("#prGrandTotalLine").textContent = "";
    } else if (pricedCount === totalCount) {
      $("#prGrandTotalLine").textContent = `Estimated total: ${formatCurrency(total)}`;
    } else {
      $("#prGrandTotalLine").textContent = `Estimated total: ~${formatCurrency(total)} (${pricedCount} of ${totalCount} lines priced)`;
    }
  }

  function renderDetailFooter(pr) {
    const footer = $("#prDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    if (pr.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(pr));
      addBtn("Edit Header", "btn btn--ghost", () => { closeModal("prDetailModal"); openEditModal(pr); });
      addBtn("Submit for Approval", "btn btn--primary", () => requestSubmit(pr));
    } else if (pr.status === "Submitted") {
      addBtn("Withdraw", "btn btn--ghost", () => requestWithdraw(pr));
    } else if (pr.status === "Approved") {
      addBtn("Cancel Requisition", "btn btn--danger-outline", () => requestCancel(pr));
    } else if (pr.status === "Rejected") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(pr));
      addBtn("Revise & Resubmit", "btn btn--primary", () => requestRevise(pr));
    } else if (pr.status === "Cancelled") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(pr));
    }
  }

  function openDetailModal(pr) {
    detailId = pr.id;
    const emp = ERP_EmployeeRepository.findById(pr.raisedByEmployeeId);
    const vendor = pr.preferredVendorId ? ERP_VendorRepository.findById(pr.preferredVendorId) : null;

    $("#prDetailTitle").textContent = `${pr.prCode} · ${pr.status}`;

    const rows = [];
    rows.push(`<div><dt>PR Code</dt><dd><code>${escapeHtml(pr.prCode)}</code></dd></div>`);
    rows.push(`<div><dt>Raised By</dt><dd>${emp ? escapeHtml(emp.fullName) + " (" + escapeHtml(emp.employeeCode) + ")" : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Preferred Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : "— not set —"}</dd></div>`);
    rows.push(`<div><dt>Required By</dt><dd>${pr.requiredByDate ? escapeHtml(pr.requiredByDate) : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(pr.status)}">${pr.status}</span></dd></div>`);
    rows.push(`<div><dt>Raised</dt><dd>${formatDateTime(new Date(pr.createdAt))}</dd></div>`);
    if (pr.submittedAt) rows.push(`<div><dt>Submitted</dt><dd>${formatDateTime(new Date(pr.submittedAt))} by ${escapeHtml(ERP_PurchaseRequisitionRepository.actorLabel(pr.submittedByUsername))}</dd></div>`);
    if (pr.status === "Submitted") rows.push(`<div><dt>Next Step</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">Awaiting a decision in <strong>PR Approval</strong> — see the PR Approval module in the sidebar.</dd></div>`);
    if (pr.status === "Approved" && pr.approvedAt) rows.push(`<div><dt>Approved</dt><dd>${formatDateTime(new Date(pr.approvedAt))} by ${escapeHtml(ERP_PurchaseRequisitionRepository.actorLabel(pr.approvedByUsername))}</dd></div>`);
    if (pr.status === "Rejected" && pr.rejectedAt) {
      rows.push(`<div><dt>Rejected</dt><dd>${formatDateTime(new Date(pr.rejectedAt))} by ${escapeHtml(ERP_PurchaseRequisitionRepository.actorLabel(pr.rejectedByUsername))}</dd></div>`);
      rows.push(`<div><dt>Rejection Reason</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(pr.rejectionReason || "—")}</dd></div>`);
    }
    if (pr.status === "Cancelled" && pr.cancelledAt) rows.push(`<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(pr.cancelledAt))} by ${escapeHtml(ERP_PurchaseRequisitionRepository.actorLabel(pr.cancelledByUsername))}</dd></div>`);
    if (typeof ERP_RfqRepository !== "undefined") {
      const linkedRfq = ERP_RfqRepository.findRfqForPr(company.id, pr.id);
      if (linkedRfq) {
        const rfqBadgeClass = linkedRfq.status === "Closed" ? "success" : linkedRfq.status === "Cancelled" ? "neutral" : linkedRfq.status === "Sent" ? "warning" : "neutral";
        rows.push(`<div><dt>Linked to RFQ</dt><dd><code>${escapeHtml(linkedRfq.rfqCode)}</code> <span class="status-badge status-badge--${rfqBadgeClass}">${escapeHtml(linkedRfq.status)}</span></dd></div>`);
      }
    }
    if (pr.notes) rows.push(`<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(pr.notes)}</dd></div>`);

    $("#prDetailBody").innerHTML = rows.join("");
    renderLineItemsTable(pr);
    renderDetailFooter(pr);
    openModal("prDetailModal");
  }

  function bindDetailModal() {
    $("#prTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const p = ERP_PurchaseRequisitionRepository.findById(viewBtn.dataset.id);
        if (p) openDetailModal(p);
        return;
      }
      if (actionBtn) {
        const p = ERP_PurchaseRequisitionRepository.findById(actionBtn.dataset.id);
        if (!p) return;
        if (actionBtn.dataset.action === "submit") requestSubmit(p);
        else if (actionBtn.dataset.action === "revise") requestRevise(p);
      }
    });

    $("#prLineTableBody").addEventListener("click", (e) => {
      const pr = ERP_PurchaseRequisitionRepository.findById(detailId);
      if (!pr) return;
      const editBtn = e.target.closest("[data-line-edit]");
      const removeBtn = e.target.closest("[data-line-remove]");
      if (editBtn) {
        const line = (pr.lineItems || []).find((l) => l.id === editBtn.dataset.lineEdit);
        if (line) openEditLineModal(line);
      } else if (removeBtn) {
        const line = (pr.lineItems || []).find((l) => l.id === removeBtn.dataset.lineRemove);
        if (line) requestRemoveLine(pr, line);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "purchase-requisition")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading purchase requisitions…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#noAnchorState").hidden = true;
      $("#prContent").hidden = true;
      $("#prSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#prSubtitle").textContent = `Managing purchase requisitions for ${company.name} (${company.companyCode}).`;

      const anyEmp = ERP_EmployeeRepository.getAllForCompany(company.id).some((e) => e.status !== "Inactive");

      if (!anyEmp) {
        $("#noAnchorState").hidden = false;
        $("#prContent").hidden = true;
        $("#prHeaderActions").hidden = true;
      } else {
        $("#noAnchorState").hidden = true;
        $("#prContent").hidden = false;
        $("#prHeaderActions").hidden = false;
        renderAll();
        renderActivity();
        bindToolbar();
        bindFormModal();
        bindLineItemModal();
        bindDetailModal();

        // Dashboard-style deep-link precedent (?action=add), same as
        // Department Need/Employees/Items.
        if (new URLSearchParams(window.location.search).get("action") === "add") {
          openAddModal();
        }
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
