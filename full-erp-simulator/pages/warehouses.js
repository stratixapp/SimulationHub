/* =============================================================================
   DOT ERP — pages/warehouses.js
   Phase 2, Module 09: Warehouses

   Always works against the ACTIVE company. Flat list, like Cost Centers —
   see data/warehouse-data.js's header for the full reasoning behind the
   address-inheritance model (live-resolved from a linked Branch by
   default, with an explicit opt-out into a custom address) and why the
   page-level summary reports an AVERAGE utilization % rather than a total
   capacity figure (capacity units differ per warehouse and can't be summed).
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity
  } = window.ERP;

  const PAGE_SIZE = 6;

  let session = null;
  let company = null;
  let filterType = "all";
  let filterStatus = "all";
  let sortOrder = "asc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;
  let formZones = []; // working list of zones while the Add/Edit modal is open


  /* -----------------------------------------------------------------------
     FORMATTING HELPERS
     --------------------------------------------------------------------- */
  function formatCapacity(amount, unit) {
    const n = Number(amount) || 0;
    return `${n.toLocaleString()} ${unit || ""}`.trim();
  }
  function formatPct(pct) {
    if (!isFinite(pct)) return "—";
    return `${Math.round(pct)}%`;
  }
  function capacityBarHtml(wh, extraClass) {
    const { utilizationPct } = ERP_WarehouseRepository.getCapacityUsage(wh);
    const band = ERP_WarehouseRepository.getUtilizationBand(wh);
    const fillClass = band === "over" ? "budget-bar__fill--over" : band === "near" ? "budget-bar__fill--near" : "";
    const widthPct = Math.min(100, isFinite(utilizationPct) ? utilizationPct : 100);
    return `<div class="budget-bar ${extraClass || ""}"><div class="budget-bar__fill ${fillClass}" style="width:${widthPct}%"></div></div>`;
  }
  function addressLine(addr) {
    if (!addr.address1 && !addr.city) return "—";
    return `${addr.address1 || ""}${addr.address2 ? ", " + addr.address2 : ""}, ${addr.city || ""}, ${addr.state || ""} ${addr.pincode || ""}`.trim();
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_WarehouseRepository.getAllForCompany(company.id);

    if (filterType !== "all") rows = rows.filter((w) => w.warehouseType === filterType);
    if (filterStatus !== "all") rows = rows.filter((w) => w.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((w) =>
        w.warehouseName.toLowerCase().includes(term) ||
        w.warehouseCode.toLowerCase().includes(term) ||
        ERP_WarehouseRepository.getManagerLabel(w).toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.warehouseName.localeCompare(b.warehouseName);
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  function renderSummary() {
    const all = ERP_WarehouseRepository.getAllForCompany(company.id);
    $("#whSummaryTotal").textContent = String(all.length);
    $("#whSummaryActive").textContent = String(all.filter((w) => w.status === "Active").length);
    const totalZones = all.reduce((sum, w) => sum + (Array.isArray(w.zones) ? w.zones.length : 0), 0);
    $("#whSummaryZones").textContent = String(totalZones);

    // Mixed capacity units across warehouses means a summed total would be
    // meaningless (Sq. Ft. + Pallet Positions + Cubic Meters is not a real
    // number) — average the per-warehouse utilization % instead, which is
    // unit-agnostic. Only warehouses with a capacity actually set count.
    const withCapacity = all.filter((w) => (Number(w.totalCapacity) || 0) > 0);
    if (!withCapacity.length) {
      $("#whSummaryUtilization").textContent = "—";
    } else {
      const avgPct = withCapacity.reduce((sum, w) => {
        const { utilizationPct } = ERP_WarehouseRepository.getCapacityUsage(w);
        return sum + (isFinite(utilizationPct) ? utilizationPct : 100);
      }, 0) / withCapacity.length;
      $("#whSummaryUtilization").textContent = formatPct(avgPct);
    }
  }


  /* -----------------------------------------------------------------------
     TYPE CHIPS (built from the fixed reference list)
     --------------------------------------------------------------------- */
  function buildTypeChips() {
    const container = $("#whTypeChips");
    const extra = ERP_WarehouseRepository.warehouseTypes.map((type) =>
      `<button type="button" class="chip" data-type="${escapeHtml(type)}">${escapeHtml(type)}</button>`
    ).join("");
    container.insertAdjacentHTML("beforeend", extra);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#whPagination");
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

  function branchLabelFor(wh) {
    if (!wh.branchId) return `<span class="profile-subtle">Not linked</span>`;
    const branch = ERP_BranchRepository.findById(wh.branchId);
    return branch ? escapeHtml(branch.branchName) : `<span class="profile-subtle">—</span>`;
  }

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#whEmptyState").hidden = all.length !== 0;
    $("#whTable").hidden = all.length === 0;

    $("#whTableBody").innerHTML = pageItems.map((w) => {
      const { utilizationPct } = ERP_WarehouseRepository.getCapacityUsage(w);
      const statusBadge = `<span class="status-badge status-badge--${w.status === "Active" ? "success" : "danger"}">${w.status}</span>`;
      const quickAction = w.status === "Active"
        ? `<button type="button" class="link-btn" data-action="deactivate" data-id="${w.id}">Deactivate</button>`
        : `<button type="button" class="link-btn" data-action="reactivate" data-id="${w.id}">Reactivate</button>`;

      return `
      <tr>
        <td><code>${escapeHtml(w.warehouseCode)}</code></td>
        <td>${escapeHtml(w.warehouseName)}</td>
        <td>${escapeHtml(w.warehouseType)}</td>
        <td>${branchLabelFor(w)}</td>
        <td>${formatCapacity(w.totalCapacity, w.capacityUnit)}</td>
        <td>${formatPct(utilizationPct)}${capacityBarHtml(w, "budget-bar--sm")}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${w.id}">View</button>
          ${quickAction}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     TOOLBAR: type + status chips, sort, search, export, print
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#whTypeChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#whTypeChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterType = chip.dataset.type;
        page = 1;
        renderTable();
      });
    });

    $$("#whStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#whStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#whSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#whSortBtn").textContent = sortOrder === "asc" ? "Name A-Z" : "Name Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#whExportCsvBtn").addEventListener("click", exportCsv);
    $("#whPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Type", "Linked Branch", "Address", "Total Capacity", "Capacity Unit", "Utilized", "Utilization %", "Zones", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((w) => {
      const branch = w.branchId ? ERP_BranchRepository.findById(w.branchId) : null;
      const addr = ERP_WarehouseRepository.getEffectiveAddress(w);
      const { utilizationPct } = ERP_WarehouseRepository.getCapacityUsage(w);
      const line = [
        w.warehouseCode, w.warehouseName, w.warehouseType, branch ? branch.branchName : "",
        addressLine(addr), w.totalCapacity, w.capacityUnit, w.utilizedCapacity,
        isFinite(utilizationPct) ? Math.round(utilizationPct) : "",
        (w.zones || []).length, w.status
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-warehouses-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Warehouses exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((w) => {
      const { utilizationPct } = ERP_WarehouseRepository.getCapacityUsage(w);
      return `<tr><td>${escapeHtml(w.warehouseCode)}</td><td>${escapeHtml(w.warehouseName)}</td><td>${escapeHtml(w.warehouseType)}</td><td>${formatCapacity(w.totalCapacity, w.capacityUnit)}</td><td>${formatPct(utilizationPct)}</td><td>${w.status}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Warehouse Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Warehouse Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Capacity</th><th>Utilization</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Warehouses")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#whActivityEmptyState").hidden = relevant.length !== 0;
    $("#whActivityList").innerHTML = relevant.map((e) => `
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
     ADDRESS INHERITANCE (branch link -> live address, or explicit override)
     --------------------------------------------------------------------- */
  function populateBranchOptions() {
    const branches = ERP_BranchRepository.getAllForCompany(company.id).filter((b) => b.isPrimary || b.status === "Active");
    $("#whFormBranch").innerHTML = `<option value="">Not linked</option>` +
      branches.map((b) => `<option value="${b.id}">${escapeHtml(b.branchName)}</option>`).join("");
  }

  /** RETROFIT (Phase 3, Module 1): lists Active/On Leave employees to pick
      as Warehouse Manager, plus a "Someone not listed" escape hatch for
      free text — exact same shape as Cost Centers' populateResponsible-
      Options(). If the record being edited already points at an employee
      who's since gone Inactive, that employee is appended anyway so
      editing doesn't silently discard a valid existing assignment. */
  function populateManagerOptions(currentEmployeeId) {
    const employees = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status !== "Inactive");
    if (currentEmployeeId && !employees.some((e) => e.id === currentEmployeeId)) {
      const current = ERP_EmployeeRepository.findById(currentEmployeeId);
      if (current) employees.push(current);
    }
    employees.sort((a, b) => a.fullName.localeCompare(b.fullName));
    const options = employees.map((e) => `<option value="${e.id}">${escapeHtml(e.fullName)} — ${escapeHtml(e.designation || "")}</option>`).join("");
    $("#whFormManager").innerHTML = `<option value="">Not set</option>${options}<option value="__custom__">Someone not listed (type a name)</option>`;
  }
  function refreshManagerNameVisibility() {
    $("#whFormManagerNameRow").hidden = $("#whFormManager").value !== "__custom__";
  }

  /** Shows/hides the override checkbox, the read-only address preview, and
      the editable address fields, based on whether a branch is currently
      selected and whether the override checkbox is ticked. This is the
      form-side mirror of ERP_WarehouseRepository.getEffectiveAddress(). */
  function refreshAddressMode() {
    const branchId = $("#whFormBranch").value;
    const toggleRow = $("#whFormAddressToggleRow");
    const preview = $("#whFormAddressPreview");
    const fields = $("#whFormAddressFields");

    if (!branchId) {
      // No branch linked at all — this warehouse always uses its own address.
      toggleRow.hidden = true;
      preview.hidden = true;
      fields.hidden = false;
      $("#whFormCustomAddress").checked = true;
      return;
    }

    toggleRow.hidden = false;
    const useCustom = $("#whFormCustomAddress").checked;
    if (useCustom) {
      preview.hidden = true;
      fields.hidden = false;
    } else {
      fields.hidden = true;
      const branch = ERP_BranchRepository.findById(branchId);
      preview.hidden = false;
      preview.textContent = branch
        ? `Shared with ${branch.branchName}: ${addressLine(branch)}`
        : "This branch's address could not be found.";
    }
  }


  /* -----------------------------------------------------------------------
     ZONES (lightweight add/remove list, held in `formZones` while the
     Add/Edit modal is open, written into the record as a whole on Save)
     --------------------------------------------------------------------- */
  function populateZoneTypeOptions() {
    $("#whZoneTypeInput").innerHTML = ERP_WarehouseRepository.zoneTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
  }

  function renderZoneChips() {
    const container = $("#whZoneChips");
    $("#whZoneEmptyHint").hidden = formZones.length !== 0;
    container.innerHTML = formZones.map((z) => `
      <span class="chip chip--removable">${escapeHtml(z.zoneName)} <span class="profile-subtle">(${escapeHtml(z.zoneType)})</span>
        <button type="button" class="chip__remove-btn" data-zone-id="${z.id}" aria-label="Remove ${escapeHtml(z.zoneName)}">×</button>
      </span>
    `).join("");
  }

  function bindZoneControls() {
    $("#whZoneAddBtn").addEventListener("click", () => {
      const name = $("#whZoneNameInput").value.trim();
      if (!name) { showToast("Enter a zone name first.", "warning"); return; }
      if (name.length > 40) { showToast("Zone name is too long (max 40 characters).", "warning"); return; }
      if (formZones.some((z) => z.zoneName.toLowerCase() === name.toLowerCase())) {
        showToast("That zone name is already on the list.", "warning");
        return;
      }
      formZones.push({
        id: "ZN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(),
        zoneName: name,
        zoneType: $("#whZoneTypeInput").value
      });
      $("#whZoneNameInput").value = "";
      renderZoneChips();
    });

    $("#whZoneChips").addEventListener("click", (e) => {
      const btn = e.target.closest(".chip__remove-btn");
      if (!btn) return;
      formZones = formZones.filter((z) => z.id !== btn.dataset.zoneId);
      renderZoneChips();
    });
  }


  /* -----------------------------------------------------------------------
     ADD / EDIT WAREHOUSE MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["whFormName", "whFormManagerName", "whFormAddress1", "whFormCity", "whFormState", "whFormTotalCapacity", "whFormUtilizedCapacity"].forEach((f) => setFormError(f, ""));
  }

  function populateTypeOptions() {
    $("#whFormType").innerHTML = ERP_WarehouseRepository.warehouseTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
  }
  function populateCapacityUnitOptions() {
    $("#whFormCapacityUnit").innerHTML = ERP_WarehouseRepository.capacityUnits.map((u) => `<option>${escapeHtml(u)}</option>`).join("");
  }

  function openAddModal() {
    editingId = null;
    formZones = [];
    $("#whFormTitle").textContent = "Add warehouse";
    $("#whFormIntro").textContent = "Add a warehouse — a physical storage site, optionally linked to one of your Branches.";
    $("#whFormSaveBtn").textContent = "Add Warehouse";
    $("#whFormName").value = "";
    populateTypeOptions();
    populateBranchOptions();
    $("#whFormBranch").value = "";
    $("#whFormCustomAddress").checked = true;
    $("#whFormAddress1").value = "";
    $("#whFormAddress2").value = "";
    $("#whFormCity").value = "";
    $("#whFormState").value = "";
    $("#whFormPincode").value = "";
    populateManagerOptions(null);
    $("#whFormManager").value = "";
    $("#whFormManagerName").value = "";
    refreshManagerNameVisibility();
    $("#whFormPhone").value = "";
    populateCapacityUnitOptions();
    $("#whFormTotalCapacity").value = "0";
    $("#whFormUtilizedCapacity").value = "0";
    populateZoneTypeOptions();
    $("#whZoneNameInput").value = "";
    renderZoneChips();
    $("#whFormDescription").value = "";
    clearFormErrors();
    refreshAddressMode();
    openModal("whFormModal");
  }

  function openEditModal(wh) {
    editingId = wh.id;
    formZones = (wh.zones || []).map((z) => ({ ...z }));
    $("#whFormTitle").textContent = "Edit warehouse";
    $("#whFormIntro").textContent = "Update this warehouse's details.";
    $("#whFormSaveBtn").textContent = "Save Changes";
    $("#whFormName").value = wh.warehouseName;
    populateTypeOptions();
    $("#whFormType").value = wh.warehouseType;
    populateBranchOptions();
    $("#whFormBranch").value = wh.branchId || "";
    $("#whFormCustomAddress").checked = !wh.branchId || !!wh.useCustomAddress;
    $("#whFormAddress1").value = wh.address1 || "";
    $("#whFormAddress2").value = wh.address2 || "";
    $("#whFormCity").value = wh.city || "";
    $("#whFormState").value = wh.state || "";
    $("#whFormPincode").value = wh.pincode || "";
    populateManagerOptions(wh.managerEmployeeId);
    if (wh.managerEmployeeId) {
      $("#whFormManager").value = wh.managerEmployeeId;
      $("#whFormManagerName").value = "";
    } else if (wh.managerName) {
      $("#whFormManager").value = "__custom__";
      $("#whFormManagerName").value = wh.managerName;
    } else {
      $("#whFormManager").value = "";
      $("#whFormManagerName").value = "";
    }
    refreshManagerNameVisibility();
    $("#whFormPhone").value = wh.contactPhone || "";
    populateCapacityUnitOptions();
    $("#whFormCapacityUnit").value = wh.capacityUnit;
    $("#whFormTotalCapacity").value = String(wh.totalCapacity || 0);
    $("#whFormUtilizedCapacity").value = String(wh.utilizedCapacity || 0);
    populateZoneTypeOptions();
    $("#whZoneNameInput").value = "";
    renderZoneChips();
    $("#whFormDescription").value = wh.description || "";
    clearFormErrors();
    refreshAddressMode();
    openModal("whFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#whFormName").value.trim();
    if (!name) { setFormError("whFormName", "Warehouse name is required."); valid = false; }
    else if (name.length > 60) { setFormError("whFormName", "Maximum 60 characters allowed."); valid = false; }
    else if (ERP_WarehouseRepository.hasDuplicateName(company.id, name, editingId)) { setFormError("whFormName", "Another warehouse already uses this name."); valid = false; }

    if ($("#whFormManager").value === "__custom__" && !$("#whFormManagerName").value.trim()) {
      setFormError("whFormManagerName", "Enter a name, or pick someone from the list above.");
      valid = false;
    }

    const needsOwnAddress = $("#whFormAddressFields").hidden === false;
    if (needsOwnAddress) {
      if (!$("#whFormAddress1").value.trim()) { setFormError("whFormAddress1", "Address line 1 is required."); valid = false; }
      if (!$("#whFormCity").value.trim()) { setFormError("whFormCity", "City is required."); valid = false; }
      if (!$("#whFormState").value) { setFormError("whFormState", "State is required."); valid = false; }
    }

    const totalCapacity = parseFloat($("#whFormTotalCapacity").value);
    if ($("#whFormTotalCapacity").value === "" || isNaN(totalCapacity) || totalCapacity < 0) { setFormError("whFormTotalCapacity", "Enter a capacity of 0 or more."); valid = false; }

    const utilized = parseFloat($("#whFormUtilizedCapacity").value);
    if ($("#whFormUtilizedCapacity").value === "" || isNaN(utilized) || utilized < 0) { setFormError("whFormUtilizedCapacity", "Enter a utilized amount of 0 or more."); valid = false; }

    return valid;
  }

  function bindFormModal() {
    $("#whAddBtn").addEventListener("click", openAddModal);
    $("#whFormBranch").addEventListener("change", () => {
      // Switching branches resets the override back off, so the new
      // branch's address is what's inherited by default.
      $("#whFormCustomAddress").checked = false;
      refreshAddressMode();
    });
    $("#whFormCustomAddress").addEventListener("change", refreshAddressMode);
    $("#whFormManager").addEventListener("change", refreshManagerNameVisibility);

    $("#whFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const branchId = $("#whFormBranch").value || null;
      const useCustomAddress = !branchId || $("#whFormCustomAddress").checked;
      const managerValue = $("#whFormManager").value;

      const payload = {
        warehouseName: $("#whFormName").value.trim(),
        warehouseType: $("#whFormType").value,
        branchId,
        useCustomAddress,
        address1: $("#whFormAddress1").value.trim(),
        address2: $("#whFormAddress2").value.trim(),
        city: $("#whFormCity").value.trim(),
        state: $("#whFormState").value,
        pincode: $("#whFormPincode").value.trim(),
        managerEmployeeId: (managerValue && managerValue !== "__custom__") ? managerValue : null,
        managerName: managerValue === "__custom__" ? $("#whFormManagerName").value.trim() : "",
        contactPhone: $("#whFormPhone").value.trim(),
        capacityUnit: $("#whFormCapacityUnit").value,
        totalCapacity: parseFloat($("#whFormTotalCapacity").value) || 0,
        utilizedCapacity: parseFloat($("#whFormUtilizedCapacity").value) || 0,
        zones: formZones.slice(),
        description: $("#whFormDescription").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this warehouse?",
          message: `"${payload.warehouseName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_WarehouseRepository.update(editingId, payload);
            logSystemActivity({ module: "Warehouses", action: "Update", description: `Updated warehouse "${payload.warehouseName}" for ${company.name}` });
            closeModal("whFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_WarehouseRepository.findById(editingId));
            showToast("Warehouse updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this warehouse?",
          message: `"${payload.warehouseName}" (${payload.warehouseType}) will be added.`,
          confirmLabel: "Add Warehouse",
          onConfirm: () => {
            const created = ERP_WarehouseRepository.create(company, payload);
            logSystemActivity({ module: "Warehouses", action: "Create", description: `Added warehouse "${created.warehouseName}" (${created.warehouseCode}) for ${company.name}` });
            closeModal("whFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.warehouseName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (toggle status / delete)
     --------------------------------------------------------------------- */
  function requestToggleStatus(wh) {
    const activating = wh.status !== "Active";
    openConfirm({
      title: activating ? "Reactivate this warehouse?" : "Deactivate this warehouse?",
      message: activating
        ? `"${wh.warehouseName}" will become Active again.`
        : `"${wh.warehouseName}" will be marked Inactive. It stays on record and can be reactivated any time.`,
      confirmLabel: activating ? "Reactivate" : "Deactivate",
      onConfirm: () => {
        ERP_WarehouseRepository.toggleStatus(wh.id);
        logSystemActivity({ module: "Warehouses", action: activating ? "Reactivate" : "Deactivate", description: `${activating ? "Reactivated" : "Deactivated"} warehouse "${wh.warehouseName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === wh.id) openDetailModal(ERP_WarehouseRepository.findById(wh.id));
        showToast(`"${wh.warehouseName}" is now ${activating ? "Active" : "Inactive"}.`, "success");
      }
    });
  }

  function requestDelete(wh) {
    openConfirm({
      title: "Delete this warehouse?",
      message: `"${wh.warehouseName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_WarehouseRepository.remove(wh.id);
        logSystemActivity({ module: "Warehouses", action: "Delete", description: `Deleted warehouse "${wh.warehouseName}" for ${company.name}`, severity: "warning" });
        if (detailId === wh.id) closeModal("whDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${wh.warehouseName}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(wh) {
    const footer = $("#whDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(wh));
    addBtn(wh.status === "Active" ? "Deactivate" : "Reactivate", "btn btn--ghost", () => requestToggleStatus(wh));
    addBtn("Edit", "btn btn--primary", () => { closeModal("whDetailModal"); openEditModal(wh); });
  }

  function openDetailModal(wh) {
    detailId = wh.id;
    const branch = wh.branchId ? ERP_BranchRepository.findById(wh.branchId) : null;
    const addr = ERP_WarehouseRepository.getEffectiveAddress(wh);
    const { capacity, used, free, utilizationPct } = ERP_WarehouseRepository.getCapacityUsage(wh);
    const band = ERP_WarehouseRepository.getUtilizationBand(wh);

    $("#whDetailTitle").textContent = `${wh.warehouseName} · ${wh.warehouseCode}`;
    $("#whDetailBody").innerHTML = `
      <div><dt>Warehouse Name</dt><dd>${escapeHtml(wh.warehouseName)}</dd></div>
      <div><dt>Warehouse Code</dt><dd>${escapeHtml(wh.warehouseCode)}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(wh.warehouseType)}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${wh.status === "Active" ? "success" : "danger"}">${wh.status}</span></dd></div>
      <div><dt>Linked Branch</dt><dd>${branch ? escapeHtml(branch.branchName) : "Not linked"}</dd></div>
      <div><dt>Address</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(addressLine(addr))}${addr.source === "branch" ? ` <span class="profile-subtle">(shared with ${escapeHtml(branch ? branch.branchName : "")})</span>` : ""}</dd></div>
      <div><dt>Warehouse Manager</dt><dd>${escapeHtml(ERP_WarehouseRepository.getManagerLabel(wh))}</dd></div>
      <div><dt>Contact Phone</dt><dd>${escapeHtml(wh.contactPhone || "—")}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(wh.createdAt))}</dd></div>
      ${wh.description ? `<div><dt>Description</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(wh.description)}</dd></div>` : ""}
    `;

    const fillClass = band === "over" ? "budget-bar__fill--over" : band === "near" ? "budget-bar__fill--near" : "";
    $("#whDetailCapacityBarFill").className = `budget-bar__fill ${fillClass}`;
    $("#whDetailCapacityBarFill").style.width = `${Math.min(100, isFinite(utilizationPct) ? utilizationPct : 100)}%`;
    const freeLabel = free >= 0 ? "free" : "over capacity";
    $("#whDetailCapacityText").textContent =
      `Capacity ${formatCapacity(capacity, wh.capacityUnit)} · Utilized ${formatCapacity(used, wh.capacityUnit)} · ${formatCapacity(Math.abs(free), wh.capacityUnit)} ${freeLabel} (${formatPct(utilizationPct)} utilized)`;

    const zones = wh.zones || [];
    $("#whDetailZonesEmpty").hidden = zones.length !== 0;
    $("#whDetailZones").innerHTML = zones.map((z) => `<span class="chip">${escapeHtml(z.zoneName)} <span class="profile-subtle">(${escapeHtml(z.zoneType)})</span></span>`).join("");

    renderDetailFooter(wh);
    openModal("whDetailModal");
  }

  function bindDetailModal() {
    $("#whTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const wh = ERP_WarehouseRepository.findById(viewBtn.dataset.id);
        if (wh) openDetailModal(wh);
        return;
      }
      if (actionBtn) {
        const wh = ERP_WarehouseRepository.findById(actionBtn.dataset.id);
        if (wh) requestToggleStatus(wh);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "warehouses")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading warehouses…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#whContent").hidden = true;
      $("#whSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#whContent").hidden = false;
      $("#whHeaderActions").hidden = false;
      $("#whSubtitle").textContent = `Managing warehouses for ${company.name} (${company.companyCode}).`;
      buildTypeChips();
      renderAll();
      renderActivity();
      bindToolbar();
      bindZoneControls();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
