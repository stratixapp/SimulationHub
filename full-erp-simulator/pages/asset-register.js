/* =============================================================================
   DOT ERP — pages/asset-register.js
   Phase 12, Module 01: Asset Register
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
  let page = 1;
  let editingId = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function departmentLabel(id) { const d = id ? ERP_DepartmentRepository.findById(id) : null; return d ? d.deptName : "—"; }
  function statusBadge(status) {
    const tone = status === "Active" ? "success" : "danger";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }

  function getFilteredSorted() {
    let rows = ERP_AssetRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    const btn = $("#arSortBtn");
    if (btn && btn.dataset.order === "asc") rows = [...rows].reverse();
    return rows;
  }

  function renderSummary() {
    const all = ERP_AssetRepository.getAllForCompany(company.id);
    $("#arSummaryTotal").textContent = String(all.length);
    $("#arSummaryActive").textContent = String(all.filter((a) => a.status === "Active").length);
    $("#arSummaryDisposed").textContent = String(all.filter((a) => a.status === "Disposed").length);
    const totalNbv = all.filter((a) => a.status === "Active").reduce((sum, a) => sum + ERP_AssetRepository.getNetBookValue(company.id, a), 0);
    $("#arSummaryNbv").textContent = formatMoney(totalNbv);
  }

  function renderPagination(totalPages) {
    const container = $("#arPagination");
    container.innerHTML = "";
    if (totalPages <= 1) return;
    const makeBtn = (label, disabled, onClick, active) => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "page-btn" + (active ? " is-active" : ""); btn.textContent = label; btn.disabled = !!disabled;
      btn.addEventListener("click", onClick);
      return btn;
    };
    container.appendChild(makeBtn("‹", page === 1, () => { page--; renderTable(); }));
    for (let p = 1; p <= totalPages; p++) container.appendChild(makeBtn(String(p), false, () => { page = p; renderTable(); }, p === page));
    container.appendChild(makeBtn("›", page === totalPages, () => { page++; renderTable(); }));
  }

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#arEmptyState").hidden = all.length !== 0;
    $("#arTable").hidden = all.length === 0;

    $("#arTableBody").innerHTML = pageItems.map((a) => `
      <tr>
        <td><code>${escapeHtml(a.assetCode)}</code></td>
        <td>${escapeHtml(a.assetName)}</td>
        <td>${escapeHtml(a.assetCategory)}</td>
        <td>${a.acquisitionDate}</td>
        <td class="text-right">${formatMoney(a.acquisitionCost)}</td>
        <td class="text-right">${formatMoney(ERP_AssetRepository.getNetBookValue(company.id, a))}</td>
        <td>${escapeHtml(a.depreciationMethod)}</td>
        <td>${statusBadge(a.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${a.id}">View</button></td>
      </tr>`).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#arStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#arStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#arSortBtn").addEventListener("click", () => {
      const btn = $("#arSortBtn");
      const asc = btn.dataset.order === "asc";
      btn.dataset.order = asc ? "desc" : "asc";
      btn.textContent = asc ? "Newest First" : "Oldest First";
      renderTable();
    });
    $("#arExportCsvBtn").addEventListener("click", exportCsv);
    $("#arPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Asset Code", "Name", "Category", "Acquired", "Cost", "Net Book Value", "Method", "Status"];
    const lines = [header.join(",")];
    rows.forEach((a) => {
      lines.push([a.assetCode, `"${a.assetName}"`, a.assetCategory, a.acquisitionDate, a.acquisitionCost, ERP_AssetRepository.getNetBookValue(company.id, a).toFixed(2), a.depreciationMethod, a.status].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `asset-register-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log.filter((e) => e.module === "Asset Register").sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8);
    $("#arActivityEmptyState").hidden = relevant.length !== 0;
    $("#arActivityList").innerHTML = relevant.map((e) => `
      <li class="activity-item">
        <span class="activity-item__icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>
        <div><p class="activity-item__text">${escapeHtml(e.description)}</p><p class="activity-item__time">${formatDateTime(new Date(e.timestamp))}</p></div>
      </li>`).join("");
  }

  function populateCategoryOptions(selected) {
    $("#arFormCategory").innerHTML = ERP_ASSET_CATEGORIES.map((c) => `<option value="${c}"${c === selected ? " selected" : ""}>${c}</option>`).join("");
  }
  function populateDepartmentOptions(selected) {
    const depts = ERP_DepartmentRepository.getAllForCompany(company.id);
    $("#arFormDepartment").innerHTML = `<option value="">Not specified</option>` + depts.map((d) => `<option value="${d.id}"${d.id === selected ? " selected" : ""}>${escapeHtml(d.deptName)}</option>`).join("");
  }

  function updateRatePreview() {
    const cost = Number($("#arFormCost").value) || 0;
    const residual = Number($("#arFormResidual").value) || 0;
    const life = Number($("#arFormLife").value) || 0;
    const method = $("#arFormMethod").value;
    if (!(cost > 0 && life > 0 && cost > residual)) { $("#arFormRatePreview").textContent = ""; return; }
    const fake = { acquisitionCost: cost, residualValue: residual, usefulLifeYears: life, depreciationMethod: method };
    const annual = ERP_AssetRepository.computeAnnualDepreciation(fake);
    $("#arFormRatePreview").textContent = method === "Straight-Line"
      ? `Annual depreciation: ${formatMoney(annual.annualCharge)} (${formatMoney(annual.annualCharge / 12)}/month).`
      : `Annual depreciation rate: ${(annual.annualRate * 100).toFixed(2)}% of opening book value each year.`;
  }

  function clearFormErrors() {
    ["arFormNameError", "arFormCategoryError", "arFormAcqDateError", "arFormCostError", "arFormResidualError", "arFormLifeError"].forEach((id) => { $("#" + id).textContent = ""; });
  }

  function openAddModal() {
    editingId = null;
    $("#arFormTitle").textContent = "New Asset";
    populateCategoryOptions("Plant & Machinery");
    populateDepartmentOptions("");
    $("#arFormName").value = "";
    $("#arFormAcqDate").value = new Date().toISOString().slice(0, 10);
    $("#arFormCost").value = "";
    $("#arFormResidual").value = "";
    $("#arFormLife").value = "";
    $("#arFormMethod").value = "Straight-Line";
    $("#arFormNotes").value = "";
    $("#arFormRatePreview").textContent = "";
    clearFormErrors();
    openModal("arFormModal");
  }

  function openEditModal(asset) {
    editingId = asset.id;
    $("#arFormTitle").textContent = `Edit ${asset.assetCode}`;
    populateCategoryOptions(asset.assetCategory);
    populateDepartmentOptions(asset.departmentId || "");
    $("#arFormName").value = asset.assetName;
    $("#arFormAcqDate").value = asset.acquisitionDate;
    $("#arFormCost").value = asset.acquisitionCost;
    $("#arFormResidual").value = asset.residualValue;
    $("#arFormLife").value = asset.usefulLifeYears;
    $("#arFormMethod").value = asset.depreciationMethod;
    $("#arFormNotes").value = asset.notes || "";
    updateRatePreview();
    clearFormErrors();
    openModal("arFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    if (!$("#arFormName").value.trim()) { $("#arFormNameError").textContent = "Enter an asset name."; valid = false; }
    if (!$("#arFormCategory").value) { $("#arFormCategoryError").textContent = "Select a category."; valid = false; }
    if (!$("#arFormAcqDate").value) { $("#arFormAcqDateError").textContent = "Select an acquisition date."; valid = false; }
    const cost = Number($("#arFormCost").value);
    if (!(cost > 0)) { $("#arFormCostError").textContent = "Cost must be greater than zero."; valid = false; }
    const residual = Number($("#arFormResidual").value);
    if (residual < 0) { $("#arFormResidualError").textContent = "Residual value can't be negative."; valid = false; }
    else if (cost > 0 && residual >= cost) { $("#arFormResidualError").textContent = "Residual value must be less than cost."; valid = false; }
    if (!(Number($("#arFormLife").value) > 0)) { $("#arFormLifeError").textContent = "Useful life must be greater than zero."; valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#arAddBtn").addEventListener("click", openAddModal);
    $("#arFormCost").addEventListener("input", () => {
      if (!editingId && !$("#arFormResidual").dataset.touched) {
        $("#arFormResidual").value = ERP_AssetRepository.defaultResidualValue($("#arFormCost").value);
      }
      updateRatePreview();
    });
    $("#arFormResidual").addEventListener("input", () => { $("#arFormResidual").dataset.touched = "1"; updateRatePreview(); });
    $("#arFormLife").addEventListener("input", updateRatePreview);
    $("#arFormMethod").addEventListener("change", updateRatePreview);

    $("#arFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const payload = {
        assetName: $("#arFormName").value.trim(),
        assetCategory: $("#arFormCategory").value,
        acquisitionDate: $("#arFormAcqDate").value,
        acquisitionCost: Number($("#arFormCost").value) || 0,
        residualValue: Number($("#arFormResidual").value) || 0,
        usefulLifeYears: Number($("#arFormLife").value) || 0,
        depreciationMethod: $("#arFormMethod").value,
        departmentId: $("#arFormDepartment").value || null,
        notes: $("#arFormNotes").value.trim()
      };
      if (editingId) {
        const updated = ERP_AssetRepository.update(company.id, editingId, payload, session.username);
        if (updated) {
          logSystemActivity({ module: "Asset Register", action: "Update", description: `Updated asset "${updated.assetCode}" for ${company.name}` });
          showToast("Asset updated.", "success");
        } else {
          showToast("Couldn't update — depreciation may already be posted against this asset.", "danger");
        }
      } else {
        const created = ERP_AssetRepository.create(company, payload, session.username);
        logSystemActivity({ module: "Asset Register", action: "Create", description: `Added asset "${created.assetCode}" for ${company.name}` });
        showToast("Asset added.", "success");
      }
      closeModal("arFormModal");
      renderAll();
      renderActivity();
    });
  }

  function renderDetailFooter(asset) {
    const footer = $("#arDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, onClick) => {
      const btn = document.createElement("button"); btn.type = "button"; btn.className = cls; btn.textContent = label; btn.addEventListener("click", onClick); footer.appendChild(btn);
    };
    if (ERP_AssetRepository.canEdit(company.id, asset)) {
      addBtn("Edit", "btn btn--ghost", () => { closeModal("arDetailModal"); openEditModal(asset); });
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(asset));
    }
    addBtn("Close", "btn btn--ghost", () => closeModal("arDetailModal"));
  }

  function openDetailModal(asset) {
    const accum = ERP_AssetRepository.getAccumulatedDepreciation(company.id, asset.id);
    const nbv = ERP_AssetRepository.getNetBookValue(company.id, asset);
    $("#arDetailTitle").textContent = `Asset — ${asset.assetCode}`;
    $("#arDetailBody").innerHTML = `
      <div><dt>Asset Code</dt><dd><code>${escapeHtml(asset.assetCode)}</code></dd></div>
      <div><dt>Name</dt><dd>${escapeHtml(asset.assetName)}</dd></div>
      <div><dt>Category</dt><dd>${escapeHtml(asset.assetCategory)}</dd></div>
      <div><dt>Department</dt><dd>${escapeHtml(departmentLabel(asset.departmentId))}</dd></div>
      <div><dt>Acquisition Date</dt><dd>${asset.acquisitionDate}</dd></div>
      <div><dt>Acquisition Cost</dt><dd>${formatMoney(asset.acquisitionCost)}</dd></div>
      <div><dt>Residual Value</dt><dd>${formatMoney(asset.residualValue)}</dd></div>
      <div><dt>Useful Life</dt><dd>${asset.usefulLifeYears} year(s)</dd></div>
      <div><dt>Method</dt><dd>${escapeHtml(asset.depreciationMethod)}</dd></div>
      <div><dt>Accumulated Depreciation</dt><dd>${formatMoney(accum)}</dd></div>
      <div><dt>Net Book Value</dt><dd>${formatMoney(nbv)}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(asset.status)}</dd></div>
      <div><dt>Notes</dt><dd>${asset.notes ? escapeHtml(asset.notes) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(asset.createdAt))} by ${escapeHtml(actorLabel(asset.createdByUsername))}</dd></div>
    `;
    renderDetailFooter(asset);
    openModal("arDetailModal");
  }

  function requestDelete(asset) {
    openConfirm({
      title: "Delete this asset?",
      message: "No depreciation has been posted against it yet, so deleting is safe.",
      confirmLabel: "Delete",
      onConfirm: () => {
        if (ERP_AssetRepository.remove(company.id, asset.id)) {
          logSystemActivity({ module: "Asset Register", action: "Delete", description: `Deleted asset "${asset.assetCode}" (${company.name})` });
          closeModal("arDetailModal");
          renderAll();
          renderActivity();
        }
      }
    });
  }

  function bindDetailModal() {
    $("#arTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const asset = ERP_AssetRepository.findById(viewBtn.dataset.id);
      if (asset) openDetailModal(asset);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "asset-register")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading asset register…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#arContent").hidden = true;
      $("#arSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#arContent").hidden = false;
      $("#arHeaderActions").hidden = false;
      $("#arSubtitle").textContent = `Managing the asset register for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
