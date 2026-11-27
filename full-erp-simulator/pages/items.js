/* =============================================================================
   DOT ERP — pages/items.js
   Phase 3, Module 06: Item Master

   Consumes Category Master and Unit Master as required fields — see
   data/item-data.js's header for the full reasoning, including why the
   Stock vs. Reorder bar deliberately inverts the budget-bar color
   direction, and why Tax/HSN fields are absent (not a forward stub —
   Tax Master and HSN Master are the very next two modules on this roadmap).
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let baseCurrency = null;
  let filterType = "all";
  let filterStock = "all";
  let filterStatus = "all";
  let sortOrder = "asc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;


  /* -----------------------------------------------------------------------
     FORMATTING
     --------------------------------------------------------------------- */
  function formatMoney(amount) {
    const n = Number(amount) || 0;
    const decimals = baseCurrency ? baseCurrency.decimalPlaces : 2;
    return `${baseCurrency ? baseCurrency.symbol : "₹"}${n.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
  }

  /** Deliberately the INVERSE of Cost Centers'/Customer Master's bar
      color logic — "critical" (low stock) maps to the SAME --over red
      modifier those modules use for their OWN bad case, but here that
      means empty/low, not full/over. See data/item-data.js's header. */
  function stockBarHtml(item, extraClass) {
    const { fillPct } = ERP_ItemRepository.getStockUsage(item);
    const band = ERP_ItemRepository.getStockHealthBand(item);
    const fillClass = band === "critical" ? "budget-bar__fill--over" : band === "low" ? "budget-bar__fill--near" : "";
    return `<div class="budget-bar ${extraClass || ""}"><div class="budget-bar__fill ${fillClass}" style="width:${fillPct}%"></div></div>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_ItemRepository.getAllForCompany(company.id);

    if (filterType !== "all") rows = rows.filter((i) => i.itemType === filterType);
    if (filterStock === "critical") rows = rows.filter((i) => ERP_ItemRepository.getStockHealthBand(i) === "critical");
    if (filterStatus !== "all") rows = rows.filter((i) => i.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((i) =>
        i.itemName.toLowerCase().includes(term) ||
        i.itemCode.toLowerCase().includes(term) ||
        (i.sku || "").toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.itemName.localeCompare(b.itemName);
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  function renderSummary() {
    const all = ERP_ItemRepository.getAllForCompany(company.id);
    $("#itmSummaryTotal").textContent = String(all.length);
    $("#itmSummaryActive").textContent = String(all.filter((i) => i.status === "Active").length);
    $("#itmSummaryCritical").textContent = String(all.filter((i) => ERP_ItemRepository.getStockHealthBand(i) === "critical").length);
    const stockValue = all.reduce((sum, i) => sum + ERP_ItemRepository.getStockUsage(i).currentStock * (Number(i.purchasePrice) || 0), 0);
    $("#itmSummaryStockValue").textContent = formatMoney(stockValue);
  }


  /* -----------------------------------------------------------------------
     TYPE CHIPS (built from the fixed reference list)
     --------------------------------------------------------------------- */
  function buildTypeChips() {
    const container = $("#itmTypeChips");
    const extra = ERP_ItemRepository.itemTypes.map((type) =>
      `<button type="button" class="chip" data-type="${escapeHtml(type)}">${escapeHtml(type)}</button>`
    ).join("");
    container.insertAdjacentHTML("beforeend", extra);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#itmPagination");
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

  function categoryLabel(item) {
    if (!item.categoryId) return `<span class="profile-subtle">—</span>`;
    const cat = ERP_CategoryRepository.findById(item.categoryId);
    return cat ? escapeHtml(cat.categoryName) : `<span class="profile-subtle">Category removed</span>`;
  }

  function unitLabel(item) {
    if (!item.unitId) return `<span class="profile-subtle">—</span>`;
    const unit = ERP_UnitRepository.findById(item.unitId);
    return unit ? escapeHtml(unit.unitSymbol) : `<span class="profile-subtle">Unit removed</span>`;
  }

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#itmEmptyState").hidden = all.length !== 0;
    $("#itmTable").hidden = all.length === 0;

    $("#itmTableBody").innerHTML = pageItems.map((i) => {
      const statusBadge = `<span class="status-badge status-badge--${i.status === "Active" ? "success" : "danger"}">${i.status}</span>`;
      const quickAction = `<button type="button" class="link-btn" data-action="toggle" data-id="${i.id}">${i.status === "Active" ? "Deactivate" : "Reactivate"}</button>`;
      const { reorderLevel, currentStock } = ERP_ItemRepository.getStockUsage(i);

      return `
      <tr>
        <td><code>${escapeHtml(i.itemCode)}</code></td>
        <td>${escapeHtml(i.itemName)}</td>
        <td>${escapeHtml(i.itemType)}</td>
        <td>${categoryLabel(i)}</td>
        <td>${unitLabel(i)}</td>
        <td>
          <span class="profile-subtle">${currentStock} / ${reorderLevel}</span>
          ${stockBarHtml(i, "budget-bar--sm")}
        </td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${i.id}">View</button>
          ${quickAction}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     TOOLBAR: type + stock + status chips, sort, search, export, print
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#itmTypeChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#itmTypeChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterType = chip.dataset.type;
        page = 1;
        renderTable();
      });
    });

    $$("#itmStockChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#itmStockChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStock = chip.dataset.stock;
        page = 1;
        renderTable();
      });
    });

    $$("#itmStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#itmStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#itmSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#itmSortBtn").textContent = sortOrder === "asc" ? "Name A-Z" : "Name Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#itmExportCsvBtn").addEventListener("click", exportCsv);
    $("#itmPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "SKU", "Name", "Type", "Category", "Unit", "Reorder Level", "Current Stock", "Purchase Price", "Sale Price", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((i) => {
      const cat = i.categoryId ? (ERP_CategoryRepository.findById(i.categoryId)?.categoryName || "") : "";
      const unit = i.unitId ? (ERP_UnitRepository.findById(i.unitId)?.unitSymbol || "") : "";
      const line = [i.itemCode, i.sku || "", i.itemName, i.itemType, cat, unit, i.reorderLevel, ERP_ItemRepository.getStockUsage(i).currentStock, i.purchasePrice, i.salePrice, i.status]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-items-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Items exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((i) => {
      const cat = i.categoryId ? (ERP_CategoryRepository.findById(i.categoryId)?.categoryName || "—") : "—";
      const unit = i.unitId ? (ERP_UnitRepository.findById(i.unitId)?.unitSymbol || "—") : "—";
      return `<tr><td>${escapeHtml(i.itemCode)}</td><td>${escapeHtml(i.itemName)}</td><td>${escapeHtml(i.itemType)}</td><td>${escapeHtml(cat)}</td><td>${escapeHtml(unit)}</td><td>${ERP_ItemRepository.getStockUsage(i).currentStock} / ${i.reorderLevel}</td><td>${escapeHtml(i.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Item Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Item Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Category</th><th>Unit</th><th>Stock/Reorder</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Item Master")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#itmActivityEmptyState").hidden = relevant.length !== 0;
    $("#itmActivityList").innerHTML = relevant.map((e) => `
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
     ADD / EDIT ITEM MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["itmFormName", "itmFormSku", "itmFormCategory", "itmFormUnit", "itmFormReorderLevel", "itmFormCurrentStock", "itmFormPurchasePrice", "itmFormSalePrice"]
      .forEach((f) => setFormError(f, ""));
  }

  function populateTypeOptions() {
    $("#itmFormType").innerHTML = ERP_ItemRepository.itemTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
  }

  /** Category options are filtered to match this item's Item Type — a
      Service item only ever sees Service categories, everything else only
      sees Product categories. Re-run whenever Item Type changes. */
  function populateCategoryOptions(selectedCategoryId) {
    const wantedType = ERP_ItemRepository.categoryTypeForItemType($("#itmFormType").value);
    const options = ERP_CategoryRepository.getActiveForCompany(company.id).filter((c) => c.categoryType === wantedType);
    $("#itmFormCategory").innerHTML = `<option value="">Select a category…</option>` +
      options.map((c) => `<option value="${c.id}">${escapeHtml(ERP_CategoryRepository.getBreadcrumbLabel(company.id, c.id))}</option>`).join("");
    if (selectedCategoryId && options.some((c) => c.id === selectedCategoryId)) {
      $("#itmFormCategory").value = selectedCategoryId;
    }
  }

  function populateUnitOptions(selectedUnitId) {
    const options = ERP_UnitRepository.getActiveForCompany(company.id);
    $("#itmFormUnit").innerHTML = `<option value="">Select a unit…</option>` +
      options.map((u) => `<option value="${u.id}">${escapeHtml(u.unitName)} (${escapeHtml(u.unitSymbol)})</option>`).join("");
    if (selectedUnitId) $("#itmFormUnit").value = selectedUnitId;
  }

  /** Retrofit fields (see data/item-data.js's header): HSN/SAC Code is the
      indirect route to a tax rate, Tax Override is the direct one — both
      optional, and both simply list every Active record from their own
      module, same as any other Active-only picker in this simulator. */
  function populateHsnOptions(selectedHsnCodeId) {
    if (typeof ERP_HsnRepository === "undefined") { $("#itmFormHsnCode").innerHTML = `<option value="">None</option>`; return; }
    const options = ERP_HsnRepository.getActiveForCompany(company.id);
    $("#itmFormHsnCode").innerHTML = `<option value="">None</option>` +
      options.map((h) => `<option value="${h.id}">${escapeHtml(h.hsnCode)} — ${escapeHtml(h.description)}</option>`).join("");
    if (selectedHsnCodeId) $("#itmFormHsnCode").value = selectedHsnCodeId;
  }

  function populateTaxCategoryOptions(selectedTaxCategoryId) {
    if (typeof ERP_TaxRepository === "undefined") { $("#itmFormTaxCategory").innerHTML = `<option value="">None</option>`; return; }
    const options = ERP_TaxRepository.getActiveForCompany(company.id);
    $("#itmFormTaxCategory").innerHTML = `<option value="">None — inherit from HSN/SAC code</option>` +
      options.map((t) => `<option value="${t.id}">${escapeHtml(t.taxName)} (${t.ratePct}%)</option>`).join("");
    if (selectedTaxCategoryId) $("#itmFormTaxCategory").value = selectedTaxCategoryId;
  }

  /** Purchase Unit options are limited to Active units that actually
      convert to whichever Unit of Measure is currently selected — re-run
      whenever the Unit of Measure changes, so an incompatible pairing
      can't even be picked, not just rejected on save. */
  function populatePurchaseUnitOptions(selectedPurchaseUnitId) {
    const unitId = $("#itmFormUnit").value;
    const all = ERP_UnitRepository.getActiveForCompany(company.id);
    const options = unitId
      ? all.filter((u) => u.id !== unitId && ERP_ItemRepository.isValidPurchaseUnit(company.id, unitId, u.id))
      : [];
    $("#itmFormPurchaseUnit").innerHTML = `<option value="">None (same as Unit of Measure)</option>` +
      options.map((u) => `<option value="${u.id}">${escapeHtml(u.unitName)} (${escapeHtml(u.unitSymbol)})</option>`).join("");
    $("#itmFormPurchaseUnit").disabled = !unitId;
    $("#itmFormPurchaseUnitHint").textContent = unitId
      ? (options.length ? "Only units convertible to the Unit of Measure above are shown." : "No other unit in the same conversion chain — set one up in Unit Master first if needed.")
      : "Select a Unit of Measure first.";
    if (selectedPurchaseUnitId && options.some((u) => u.id === selectedPurchaseUnitId)) {
      $("#itmFormPurchaseUnit").value = selectedPurchaseUnitId;
    }
  }

  function openAddModal() {
    editingId = null;
    $("#itmFormTitle").textContent = "Add item";
    $("#itmFormIntro").textContent = "Add an item to the catalog.";
    $("#itmFormSaveBtn").textContent = "Add Item";
    $("#itmFormName").value = "";
    $("#itmFormSku").value = "";
    populateTypeOptions();
    $("#itmFormType").value = "Finished Good";
    populateCategoryOptions(null);
    populateUnitOptions(null);
    populatePurchaseUnitOptions(null);
    populateHsnOptions(null);
    populateTaxCategoryOptions(null);
    $("#itmFormReorderLevel").value = "0";
    $("#itmFormCurrentStock").value = "0";
    $("#itmFormCurrentStock").disabled = false;
    $("#itmFormCurrentStockHint").hidden = true;
    $("#itmFormPurchasePrice").value = "";
    $("#itmFormSalePrice").value = "";
    $("#itmFormDescription").value = "";
    clearFormErrors();
    openModal("itmFormModal");
  }

  function openEditModal(item) {
    editingId = item.id;
    $("#itmFormTitle").textContent = "Edit item";
    $("#itmFormIntro").textContent = "Update this item's details.";
    $("#itmFormSaveBtn").textContent = "Save Changes";
    $("#itmFormName").value = item.itemName;
    $("#itmFormSku").value = item.sku || "";
    populateTypeOptions();
    $("#itmFormType").value = item.itemType;
    populateCategoryOptions(item.categoryId);
    populateUnitOptions(item.unitId);
    populatePurchaseUnitOptions(item.purchaseUnitId);
    populateHsnOptions(item.hsnCodeId);
    populateTaxCategoryOptions(item.taxCategoryId);
    $("#itmFormReorderLevel").value = String(item.reorderLevel || 0);

    // PHASE 7 RETROFIT: once Stock Ledger has any real activity for this
    // item, Current Stock stops being something you type here — it's a
    // live rollup now (see item-data.js's own header). The field is
    // shown read-only with the live figure instead of the stale stored
    // one, and is excluded from the save payload below.
    const hasLedgerActivity = typeof ERP_StockLedgerRepository !== "undefined" && ERP_StockLedgerRepository.getEntriesForItem(item.companyId, item.id).length > 0;
    if (hasLedgerActivity) {
      const live = ERP_ItemRepository.getLiveCurrentStock(item);
      $("#itmFormCurrentStock").value = String(live);
      $("#itmFormCurrentStock").disabled = true;
      $("#itmFormCurrentStockHint").hidden = false;
      $("#itmFormCurrentStockHint").textContent = `Computed live from the Stock Ledger — use Opening Stock, Stock Adjustment, or Stock Transfer to change it.`;
    } else {
      $("#itmFormCurrentStock").value = String(item.currentStock || 0);
      $("#itmFormCurrentStock").disabled = false;
      $("#itmFormCurrentStockHint").hidden = true;
    }

    $("#itmFormPurchasePrice").value = item.purchasePrice ? String(item.purchasePrice) : "";
    $("#itmFormSalePrice").value = item.salePrice ? String(item.salePrice) : "";
    $("#itmFormDescription").value = item.description || "";
    clearFormErrors();
    openModal("itmFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#itmFormName").value.trim();
    if (!name) { setFormError("itmFormName", "Item name is required."); valid = false; }
    else if (name.length > 80) { setFormError("itmFormName", "Maximum 80 characters allowed."); valid = false; }
    else if (ERP_ItemRepository.hasDuplicateName(company.id, name, editingId)) { setFormError("itmFormName", "An item with this name already exists."); valid = false; }

    const sku = $("#itmFormSku").value.trim();
    if (sku && ERP_ItemRepository.hasDuplicateSku(company.id, sku, editingId)) { setFormError("itmFormSku", "An item with this SKU already exists."); valid = false; }

    if (!$("#itmFormCategory").value) { setFormError("itmFormCategory", "Category is required."); valid = false; }
    if (!$("#itmFormUnit").value) { setFormError("itmFormUnit", "Unit of Measure is required."); valid = false; }

    const reorderLevel = $("#itmFormReorderLevel").value;
    if (reorderLevel === "" || isNaN(parseFloat(reorderLevel)) || parseFloat(reorderLevel) < 0) {
      setFormError("itmFormReorderLevel", "Enter a number 0 or greater."); valid = false;
    }
    const currentStock = $("#itmFormCurrentStock").value;
    if (!$("#itmFormCurrentStock").disabled && (currentStock === "" || isNaN(parseFloat(currentStock)) || parseFloat(currentStock) < 0)) {
      setFormError("itmFormCurrentStock", "Enter a number 0 or greater."); valid = false;
    }
    const purchasePrice = $("#itmFormPurchasePrice").value;
    if (purchasePrice !== "" && (isNaN(parseFloat(purchasePrice)) || parseFloat(purchasePrice) < 0)) {
      setFormError("itmFormPurchasePrice", "Enter a number 0 or greater, or leave blank."); valid = false;
    }
    const salePrice = $("#itmFormSalePrice").value;
    if (salePrice !== "" && (isNaN(parseFloat(salePrice)) || parseFloat(salePrice) < 0)) {
      setFormError("itmFormSalePrice", "Enter a number 0 or greater, or leave blank."); valid = false;
    }

    return valid;
  }

  function bindFormModal() {
    $("#itmAddBtn").addEventListener("click", openAddModal);

    $("#itmFormType").addEventListener("change", () => populateCategoryOptions(null));
    $("#itmFormUnit").addEventListener("change", () => populatePurchaseUnitOptions(null));

    $("#itmFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        itemName: $("#itmFormName").value.trim(),
        sku: $("#itmFormSku").value.trim(),
        itemType: $("#itmFormType").value,
        categoryId: $("#itmFormCategory").value,
        unitId: $("#itmFormUnit").value,
        purchaseUnitId: $("#itmFormPurchaseUnit").value || null,
        hsnCodeId: $("#itmFormHsnCode").value || null,
        taxCategoryId: $("#itmFormTaxCategory").value || null,
        reorderLevel: parseFloat($("#itmFormReorderLevel").value) || 0,
        purchasePrice: parseFloat($("#itmFormPurchasePrice").value) || 0,
        salePrice: parseFloat($("#itmFormSalePrice").value) || 0,
        description: $("#itmFormDescription").value.trim()
      };
      // PHASE 7 RETROFIT: only include currentStock in the save payload
      // when the field was actually editable — once Stock Ledger has
      // activity for this item, the field shows a live, disabled figure
      // that was never meant to be written back over the stored legacy
      // value (which is inert anyway once activity exists, but leaving
      // it out keeps the save honest about what actually changed).
      if (!$("#itmFormCurrentStock").disabled) {
        payload.currentStock = parseFloat($("#itmFormCurrentStock").value) || 0;
      }

      if (editingId) {
        openConfirm({
          title: "Save changes to this item?",
          message: `"${payload.itemName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_ItemRepository.update(editingId, payload);
            logSystemActivity({ module: "Item Master", action: "Update", description: `Updated item "${payload.itemName}" for ${company.name}` });
            closeModal("itmFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_ItemRepository.findById(editingId));
            showToast("Item updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this item?",
          message: `"${payload.itemName}" will be added to the catalog.`,
          confirmLabel: "Add Item",
          onConfirm: () => {
            const created = ERP_ItemRepository.create(company, payload);
            logSystemActivity({ module: "Item Master", action: "Create", description: `Added item "${created.itemName}" (${created.itemCode}) for ${company.name}` });
            closeModal("itmFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.itemName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (two-state: Active / Inactive)
     --------------------------------------------------------------------- */
  function requestToggleStatus(item) {
    const activating = item.status !== "Active";
    const message = activating
      ? `"${item.itemName}" will become Active again.`
      : `"${item.itemName}" will be marked Inactive. It stays on record and can be reactivated any time.`;

    openConfirm({
      title: activating ? "Reactivate this item?" : "Deactivate this item?",
      message,
      confirmLabel: activating ? "Reactivate" : "Deactivate",
      onConfirm: () => {
        ERP_ItemRepository.toggleStatus(item.id);
        logSystemActivity({ module: "Item Master", action: activating ? "Reactivate" : "Deactivate", description: `${activating ? "Reactivated" : "Deactivated"} item "${item.itemName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === item.id) openDetailModal(ERP_ItemRepository.findById(item.id));
        showToast(`"${item.itemName}" is now ${activating ? "Active" : "Inactive"}.`, "success");
      }
    });
  }

  function requestDelete(item) {
    openConfirm({
      title: "Delete this item?",
      message: `"${item.itemName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_ItemRepository.remove(item.id);
        logSystemActivity({ module: "Item Master", action: "Delete", description: `Deleted item "${item.itemName}" for ${company.name}`, severity: "warning" });
        if (detailId === item.id) closeModal("itmDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${item.itemName}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(item) {
    const footer = $("#itmDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(item));
    addBtn(item.status === "Active" ? "Deactivate" : "Reactivate", "btn btn--ghost", () => requestToggleStatus(item));
    addBtn("Edit", "btn btn--primary", () => { closeModal("itmDetailModal"); openEditModal(item); });
  }

  function openDetailModal(item) {
    detailId = item.id;
    const category = item.categoryId ? ERP_CategoryRepository.findById(item.categoryId) : null;
    const unit = item.unitId ? ERP_UnitRepository.findById(item.unitId) : null;
    const purchaseConv = ERP_ItemRepository.getPurchaseConversionLabel(item);
    const hsn = item.hsnCodeId && typeof ERP_HsnRepository !== "undefined" ? ERP_HsnRepository.findById(item.hsnCodeId) : null;
    const taxOverride = item.taxCategoryId && typeof ERP_TaxRepository !== "undefined" ? ERP_TaxRepository.findById(item.taxCategoryId) : null;
    const effectiveTax = ERP_ItemRepository.getEffectiveTaxCode(item);
    const { reorderLevel, currentStock, gap, fillPct } = ERP_ItemRepository.getStockUsage(item);
    const band = ERP_ItemRepository.getStockHealthBand(item);

    $("#itmDetailTitle").textContent = `${item.itemName} · ${item.itemCode}`;
    $("#itmDetailBody").innerHTML = `
      <div><dt>Item Name</dt><dd>${escapeHtml(item.itemName)}</dd></div>
      <div><dt>Item Code</dt><dd>${escapeHtml(item.itemCode)}</dd></div>
      <div><dt>SKU</dt><dd>${item.sku ? escapeHtml(item.sku) : "—"}</dd></div>
      <div><dt>Item Type</dt><dd>${escapeHtml(item.itemType)}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${item.status === "Active" ? "success" : "danger"}">${item.status}</span></dd></div>
      <div><dt>Category</dt><dd>${category ? escapeHtml(ERP_CategoryRepository.getBreadcrumbLabel(company.id, category.id)) : "— category removed —"}</dd></div>
      <div><dt>Unit of Measure</dt><dd>${unit ? escapeHtml(`${unit.unitName} (${unit.unitSymbol})`) : "— unit removed —"}</dd></div>
      <div><dt>Purchase Unit</dt><dd>${purchaseConv ? escapeHtml(purchaseConv) : "— same as Unit of Measure —"}</dd></div>
      <div><dt>HSN/SAC Code</dt><dd>${hsn ? escapeHtml(`${hsn.hsnCode} — ${hsn.description}`) : "— not set —"}</dd></div>
      <div><dt>Tax Override</dt><dd>${taxOverride ? escapeHtml(`${taxOverride.taxName} (${taxOverride.ratePct}%)`) : "— inherits from HSN/SAC —"}</dd></div>
      <div><dt>Effective Tax Rate</dt><dd>${effectiveTax ? escapeHtml(`${effectiveTax.taxName} (${effectiveTax.ratePct}%)`) : "— not resolved —"}</dd></div>
      <div><dt>Purchase Price</dt><dd>${item.purchasePrice ? formatMoney(item.purchasePrice) : "—"}</dd></div>
      <div><dt>Sale Price</dt><dd>${item.salePrice ? formatMoney(item.salePrice) : "—"}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(item.createdAt))}</dd></div>
      ${item.description ? `<div><dt>Description</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(item.description)}</dd></div>` : ""}
    `;

    const fillClass = band === "critical" ? "budget-bar__fill--over" : band === "low" ? "budget-bar__fill--near" : "";
    $("#itmDetailStockBarFill").className = `budget-bar__fill ${fillClass}`;
    $("#itmDetailStockBarFill").style.width = `${fillPct}%`;
    const bandText = band === "critical" ? "At or below reorder level — reorder now." : band === "low" ? "Getting close to the reorder level." : "Comfortably stocked.";
    $("#itmDetailStockCaption").textContent = `${currentStock} in stock, reorder level ${reorderLevel} (${gap >= 0 ? "+" : ""}${gap}). ${bandText}`;

    // PHASE 7 RETROFIT: once Stock Ledger has activity for this item,
    // show the per-warehouse breakdown behind that single total number
    // — see item-data.js's own getStockBreakdownByWarehouse().
    const breakdown = typeof ERP_ItemRepository.getStockBreakdownByWarehouse === "function" ? ERP_ItemRepository.getStockBreakdownByWarehouse(item) : [];
    if (breakdown.length && typeof ERP_WarehouseRepository !== "undefined") {
      const parts = breakdown
        .filter((b) => b.quantity !== 0)
        .map((b) => { const wh = ERP_WarehouseRepository.findById(b.warehouseId); return `${wh ? escapeHtml(wh.warehouseName) : "Unknown warehouse"}: ${b.quantity}`; });
      $("#itmDetailStockBreakdown").hidden = parts.length === 0;
      $("#itmDetailStockBreakdown").textContent = parts.length ? `By warehouse — ${parts.join(", ")}` : "";
    } else {
      $("#itmDetailStockBreakdown").hidden = true;
    }

    renderDetailFooter(item);
    openModal("itmDetailModal");
  }

  function bindDetailModal() {
    $("#itmTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const item = ERP_ItemRepository.findById(viewBtn.dataset.id);
        if (item) openDetailModal(item);
        return;
      }
      if (actionBtn) {
        const item = ERP_ItemRepository.findById(actionBtn.dataset.id);
        if (item) requestToggleStatus(item);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "items")) return;

    runBootSequence([
      { p: 30, t: "Authenticating session…" },
      { p: 60, t: "Loading catalog…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#noPrereqState").hidden = true;
      $("#itmContent").hidden = true;
      $("#itmSubtitle").textContent = "No active company yet.";
    } else {
      baseCurrency = ERP_CurrencyRepository.ensureBaseCurrency(company);
      const hasCategory = ERP_CategoryRepository.getActiveForCompany(company.id).length > 0;
      const hasUnit = ERP_UnitRepository.getActiveForCompany(company.id).length > 0;

      if (!hasCategory || !hasUnit) {
        $("#noCompanyState").hidden = true;
        $("#noPrereqState").hidden = false;
        $("#itmContent").hidden = true;
        $("#itmSubtitle").textContent = `Managing items for ${company.name} (${company.companyCode}).`;
        const missing = [!hasCategory ? "an Active category" : null, !hasUnit ? "an Active unit" : null].filter(Boolean).join(" and ");
        $("#noPrereqMessage").textContent = `Every item needs a Category and a Unit of Measure — both are required fields here, not optional extras. Set up ${missing} first.`;
      } else {
        $("#noCompanyState").hidden = true;
        $("#noPrereqState").hidden = true;
        $("#itmContent").hidden = false;
        $("#itmHeaderActions").hidden = false;
        $("#itmSubtitle").textContent = `Managing items for ${company.name} (${company.companyCode}).`;
        buildTypeChips();
        renderAll();
        renderActivity();
        bindToolbar();
        bindFormModal();
        bindDetailModal();

        // Dashboard's "Add Item" quick action deep-links here with
        // ?action=add so it opens straight to the form — the same
        // precedent Add Employee already established. Retrofitted now
        // (Phase 4) because Item Master didn't exist yet when that quick
        // action was first built; it was left as a "Soon" stub until now.
        if (new URLSearchParams(window.location.search).get("action") === "add") {
          openAddModal();
        }
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
