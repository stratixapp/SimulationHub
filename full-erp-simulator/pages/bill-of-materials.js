/* =============================================================================
   DOT ERP — pages/bill-of-materials.js
   Phase 10, Module 01: Bill of Materials

   Live add/remove component line table — the same delegated-event shape
   stock-adjustment.js established (rows re-rendered on every change, one
   tbody-level listener rather than per-row listeners needing rebinding).
   The Finished Item picker is filtered to Semi-Finished Good/Finished
   Good types only (see data/bom-data.js's own header); the Component
   picker excludes Service items and the currently-selected finished item
   itself, and a cycle check runs on every component pick, not just at
   save time, so a bad selection is caught the moment it's made.
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
  let formLines = [];
  let rowCounter = 0;
  let editingId = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function formatQty(n) { return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function itemLabel(id) { const i = ERP_ItemRepository.findById(id); return i ? i.itemName : "Unknown item"; }
  function statusBadge(status) {
    const tone = status === "Active" ? "success" : status === "Inactive" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }

  function eligibleFinishedItems() {
    return ERP_ItemRepository.getActiveForCompany(company.id).filter((i) => i.itemType === "Semi-Finished Good" || i.itemType === "Finished Good");
  }
  function eligibleComponentItems(finishedItemId) {
    return ERP_ItemRepository.getActiveForCompany(company.id).filter((i) => i.itemType !== "Service" && i.id !== finishedItemId);
  }


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY / LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_BomRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    return rows;
  }

  function estimatedCostPerUnit(bom) {
    return ERP_BomRepository.computeMaterialCostPerUnit(company.id, bom.finishedItemId, []);
  }

  function renderSummary() {
    const all = ERP_BomRepository.getAllForCompany(company.id);
    $("#bomSummaryTotal").textContent = String(all.length);
    $("#bomSummaryDraft").textContent = String(all.filter((r) => r.status === "Draft").length);
    $("#bomSummaryActive").textContent = String(all.filter((r) => r.status === "Active").length);
    $("#bomSummaryInactive").textContent = String(all.filter((r) => r.status === "Inactive").length);
  }

  function renderPagination(totalPages) {
    const container = $("#bomPagination");
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

    $("#bomEmptyState").hidden = all.length !== 0;
    $("#bomTable").hidden = all.length === 0;

    $("#bomTableBody").innerHTML = pageItems.map((r) => {
      const cost = estimatedCostPerUnit(r);
      return `
      <tr>
        <td><code>${escapeHtml(r.bomCode)}</code></td>
        <td>${escapeHtml(itemLabel(r.finishedItemId))}</td>
        <td class="text-right">${formatQty(r.outputQuantity)}</td>
        <td class="text-right">${(r.lines || []).length}</td>
        <td class="text-right">${cost.circular ? "—" : formatMoney(cost.costPerUnit)}</td>
        <td>${statusBadge(r.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">View</button></td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#bomStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#bomStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#bomSortBtn").addEventListener("click", () => {
      const btn = $("#bomSortBtn");
      const asc = btn.dataset.order === "asc";
      btn.dataset.order = asc ? "desc" : "asc";
      btn.textContent = asc ? "Newest First" : "Oldest First";
      renderTable();
    });
    $("#bomExportCsvBtn").addEventListener("click", exportCsv);
    $("#bomPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["BOM Code", "Finished Item", "Output Qty", "Components", "Est. Cost/Unit", "Status"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      const cost = estimatedCostPerUnit(r);
      lines.push([r.bomCode, `"${itemLabel(r.finishedItemId)}"`, r.outputQuantity, (r.lines || []).length, cost.circular ? "" : cost.costPerUnit.toFixed(2), r.status].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `bill-of-materials-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Bill of Materials")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#bomActivityEmptyState").hidden = relevant.length !== 0;
    $("#bomActivityList").innerHTML = relevant.map((e) => `
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
     COMPONENT LINE TABLE (add modal)
     --------------------------------------------------------------------- */
  function componentOptionsHtml(selectedId) {
    const finishedItemId = $("#bomFormFinishedItem").value;
    const items = eligibleComponentItems(finishedItemId);
    const options = items.map((i) => `<option value="${i.id}"${i.id === selectedId ? " selected" : ""}>${escapeHtml(i.itemName)} (${escapeHtml(i.itemType)})</option>`).join("");
    return `<option value="">Select component…</option>` + options;
  }

  function renderCostPreview() {
    const finishedItemId = $("#bomFormFinishedItem").value;
    const outputQty = Number($("#bomFormOutputQty").value) || 1;
    if (!finishedItemId || formLines.every((l) => !l.componentItemId)) {
      $("#bomFormCostPreview").textContent = "";
      return;
    }
    let total = 0;
    formLines.forEach((l) => {
      if (!l.componentItemId) return;
      const sub = ERP_BomRepository.computeMaterialCostPerUnit(company.id, l.componentItemId, []);
      const effectiveQty = (Number(l.quantityPerOutput) || 0) * (1 + (Number(l.scrapPercent) || 0) / 100);
      total += effectiveQty * sub.costPerUnit;
    });
    $("#bomFormCostPreview").textContent = `Estimated cost per unit of output: ${formatMoney(total / (outputQty || 1))} (a planning estimate, from Item Master's own purchase prices — not the actual cost that will post when materials are issued).`;
  }

  function renderLineRows() {
    $("#bomFormLineTableBody").innerHTML = formLines.map((line) => `
      <tr data-row-id="${line.rowId}">
        <td><select class="select-field bom-line-item">${componentOptionsHtml(line.componentItemId)}</select></td>
        <td><div class="input-wrap"><input type="number" class="bom-line-qty" min="0" step="0.01" value="${line.quantityPerOutput}" /></div></td>
        <td><div class="input-wrap"><input type="number" class="bom-line-scrap" min="0" step="0.1" value="${line.scrapPercent}" /></div></td>
        <td><button type="button" class="link-btn bom-remove-line">Remove</button></td>
      </tr>`).join("");
    renderCostPreview();
  }

  function addLine() {
    rowCounter += 1;
    formLines.push({ rowId: "row-" + rowCounter, componentItemId: "", quantityPerOutput: 1, scrapPercent: 0 });
    renderLineRows();
  }

  function removeLine(rowId) {
    formLines = formLines.filter((l) => l.rowId !== rowId);
    renderLineRows();
  }

  function syncLineFromRow(tr) {
    const rowId = tr.dataset.rowId;
    const line = formLines.find((l) => l.rowId === rowId);
    if (!line) return;
    const newComponentId = tr.querySelector(".bom-line-item").value;
    if (newComponentId && newComponentId !== line.componentItemId) {
      const finishedItemId = $("#bomFormFinishedItem").value;
      if (finishedItemId && ERP_BomRepository.wouldCreateCycle(company.id, finishedItemId, newComponentId, [])) {
        showToast("That would create a circular recipe (this component's own chain leads back to the finished item) — not allowed.", "danger");
        renderLineRows();
        return;
      }
      if (ERP_BomRepository.isDuplicateComponent(formLines.map((l) => ({ id: l.rowId, componentItemId: l.componentItemId })), newComponentId, line.rowId)) {
        showToast("That component is already on this BOM — consider adjusting its existing line instead of adding a second one.", "warning");
      }
    }
    line.componentItemId = newComponentId;
    line.quantityPerOutput = tr.querySelector(".bom-line-qty").value;
    line.scrapPercent = tr.querySelector(".bom-line-scrap").value;
  }

  function bindLineTable() {
    $("#bomAddLineBtn").addEventListener("click", addLine);
    $("#bomFormLineTableBody").addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".bom-remove-line");
      if (!removeBtn) return;
      removeLine(removeBtn.closest("tr").dataset.rowId);
    });
    $("#bomFormLineTableBody").addEventListener("change", (e) => {
      const tr = e.target.closest("tr");
      if (!tr) return;
      syncLineFromRow(tr);
      renderLineRows();
    });
    $("#bomFormFinishedItem").addEventListener("change", () => {
      // Re-check every existing line for a now-possible cycle or self-reference.
      formLines = formLines.filter((l) => l.componentItemId !== $("#bomFormFinishedItem").value);
      renderLineRows();
    });
    $("#bomFormOutputQty").addEventListener("input", renderCostPreview);
  }


  /* -----------------------------------------------------------------------
     ADD / EDIT MODAL
     --------------------------------------------------------------------- */
  function populateFinishedItemOptions(selectedId) {
    const items = eligibleFinishedItems();
    $("#bomFormFinishedItem").innerHTML = `<option value="">Select finished item…</option>` +
      items.map((i) => `<option value="${i.id}"${i.id === selectedId ? " selected" : ""}>${escapeHtml(i.itemName)} (${escapeHtml(i.itemType)})</option>`).join("");
  }

  function clearFormErrors() {
    ["bomFormFinishedItemError", "bomFormOutputQtyError", "bomFormLinesError"].forEach((id) => { $("#" + id).textContent = ""; });
  }

  function openAddModal() {
    editingId = null;
    formLines = [];
    rowCounter = 0;
    $("#bomFormTitle").textContent = "New Bill of Materials";
    $("#bomFormIntro").textContent = "Saves as a Draft — you can revise it freely until you Activate it.";
    populateFinishedItemOptions("");
    $("#bomFormFinishedItem").disabled = false;
    $("#bomFormOutputQty").value = "1";
    $("#bomFormNotes").value = "";
    addLine();
    clearFormErrors();
    openModal("bomFormModal");
  }

  function openEditModal(record) {
    editingId = record.id;
    formLines = (record.lines || []).map((l) => ({ rowId: l.id, componentItemId: l.componentItemId, quantityPerOutput: l.quantityPerOutput, scrapPercent: l.scrapPercent }));
    rowCounter = formLines.length;
    $("#bomFormTitle").textContent = `Edit ${record.bomCode}`;
    $("#bomFormIntro").textContent = "Only a Draft BOM can be edited — Activate it once the recipe is final.";
    populateFinishedItemOptions(record.finishedItemId);
    $("#bomFormFinishedItem").disabled = true; // changing the output item mid-edit would orphan the whole recipe's own intent
    $("#bomFormOutputQty").value = record.outputQuantity;
    $("#bomFormNotes").value = record.notes || "";
    renderLineRows();
    clearFormErrors();
    openModal("bomFormModal");
  }

  function buildLinePayload() {
    return formLines
      .filter((l) => l.componentItemId)
      .map((l) => ({ id: l.rowId, componentItemId: l.componentItemId, quantityPerOutput: Number(l.quantityPerOutput) || 0, scrapPercent: Number(l.scrapPercent) || 0 }));
  }

  function validateForm(lines) {
    let valid = true;
    clearFormErrors();
    const finishedItemId = $("#bomFormFinishedItem").value;
    if (!finishedItemId) { $("#bomFormFinishedItemError").textContent = "Select the item this BOM produces."; valid = false; }
    if (!(Number($("#bomFormOutputQty").value) > 0)) { $("#bomFormOutputQtyError").textContent = "Output quantity must be greater than zero."; valid = false; }
    if (lines.length === 0) { $("#bomFormLinesError").textContent = "Add at least one component."; valid = false; }
    else if (lines.some((l) => !(Number(l.quantityPerOutput) > 0))) { $("#bomFormLinesError").textContent = "Every component needs a quantity greater than zero."; valid = false; }
    else if (finishedItemId && lines.some((l) => ERP_BomRepository.wouldCreateCycle(company.id, finishedItemId, l.componentItemId, []))) {
      $("#bomFormLinesError").textContent = "One of these components would create a circular recipe — remove it.";
      valid = false;
    }
    return valid;
  }

  function bindFormModal() {
    $("#bomAddBtn").addEventListener("click", openAddModal);
    $("#bomFormSaveBtn").addEventListener("click", () => {
      const lines = buildLinePayload();
      if (!validateForm(lines)) return;
      const payload = {
        finishedItemId: $("#bomFormFinishedItem").value,
        outputQuantity: Number($("#bomFormOutputQty").value) || 1,
        notes: $("#bomFormNotes").value.trim(),
        lines
      };
      if (editingId) {
        const updated = ERP_BomRepository.update(editingId, payload, session.username);
        if (updated) {
          logSystemActivity({ module: "Bill of Materials", action: "Update", description: `Updated BOM "${updated.bomCode}" for ${company.name}` });
          showToast("BOM updated.", "success");
        }
      } else {
        const created = ERP_BomRepository.create(company, payload, session.username);
        logSystemActivity({ module: "Bill of Materials", action: "Create", description: `Created BOM "${created.bomCode}" for ${company.name}` });
        showToast("BOM saved as Draft — Activate it once the recipe is final.", "success");
      }
      closeModal("bomFormModal");
      renderAll();
      renderActivity();
    });
    bindLineTable();
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL + LIFECYCLE ACTIONS
     --------------------------------------------------------------------- */
  function renderDetailFooter(record) {
    const footer = $("#bomDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, onClick) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", onClick);
      footer.appendChild(btn);
    };
    if (record.status === "Draft") {
      addBtn("Edit", "btn btn--ghost", () => { closeModal("bomDetailModal"); openEditModal(record); });
      addBtn("Activate", "btn btn--primary", () => requestActivate(record));
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(record));
    } else if (record.status === "Active") {
      addBtn("Deactivate", "btn btn--danger-outline", () => requestDeactivate(record));
    }
    addBtn("Close", "btn btn--ghost", () => closeModal("bomDetailModal"));
  }

  function openDetailModal(record) {
    const cost = estimatedCostPerUnit(record);
    $("#bomDetailTitle").textContent = `Bill of Materials — ${record.bomCode}`;
    $("#bomDetailBody").innerHTML = `
      <div><dt>BOM Code</dt><dd><code>${escapeHtml(record.bomCode)}</code></dd></div>
      <div><dt>Finished Item</dt><dd>${escapeHtml(itemLabel(record.finishedItemId))}</dd></div>
      <div><dt>Output Quantity</dt><dd>${formatQty(record.outputQuantity)}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(record.status)}</dd></div>
      <div><dt>Notes</dt><dd>${record.notes ? escapeHtml(record.notes) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(record.createdAt))} by ${escapeHtml(actorLabel(record.createdByUsername))}</dd></div>
      ${record.status === "Active" ? `<div><dt>Activated</dt><dd>${formatDateTime(new Date(record.activatedAt))} by ${escapeHtml(actorLabel(record.activatedByUsername))}</dd></div>` : ""}
      ${record.status === "Inactive" && record.deactivatedAt ? `<div><dt>Deactivated</dt><dd>${formatDateTime(new Date(record.deactivatedAt))} by ${escapeHtml(actorLabel(record.deactivatedByUsername))}</dd></div>` : ""}
    `;
    $("#bomDetailLineTableBody").innerHTML = (record.lines || []).map((l) => {
      const effectiveQty = (Number(l.quantityPerOutput) || 0) * (1 + (Number(l.scrapPercent) || 0) / 100);
      return `
      <tr>
        <td>${escapeHtml(itemLabel(l.componentItemId))}</td>
        <td class="text-right">${formatQty(l.quantityPerOutput)}</td>
        <td class="text-right">${formatQty(l.scrapPercent)}%</td>
        <td class="text-right">${formatQty(effectiveQty)}</td>
      </tr>`;
    }).join("");
    $("#bomDetailCostLine").textContent = cost.circular
      ? "Estimated cost unavailable — this BOM's own component chain is circular."
      : `Estimated cost per unit of output: ${formatMoney(cost.costPerUnit)}`;
    renderDetailFooter(record);
    openModal("bomDetailModal");
  }

  function requestActivate(record) {
    const existing = ERP_BomRepository.getActiveBomForItem(company.id, record.finishedItemId);
    openConfirm({
      title: "Activate this BOM?",
      message: existing
        ? `This retires "${existing.bomCode}", currently Active for the same item, and makes this one the live recipe Work Orders will build from.`
        : "This makes it the live recipe Work Orders will build from.",
      confirmLabel: "Activate",
      onConfirm: () => {
        const updated = ERP_BomRepository.activate(record.id, session.username);
        if (updated) {
          logSystemActivity({ module: "Bill of Materials", action: "Activate", description: `Activated BOM "${updated.bomCode}" (${company.name})` });
          closeModal("bomDetailModal");
          renderAll();
          renderActivity();
          showToast("BOM activated.", "success");
        }
      }
    });
  }

  function requestDeactivate(record) {
    openConfirm({
      title: "Deactivate this BOM?",
      message: "New Work Orders won't be able to build from this recipe until another BOM is activated for the same item.",
      confirmLabel: "Deactivate",
      onConfirm: () => {
        const updated = ERP_BomRepository.deactivate(record.id, session.username);
        if (updated) {
          logSystemActivity({ module: "Bill of Materials", action: "Deactivate", description: `Deactivated BOM "${updated.bomCode}" (${company.name})` });
          closeModal("bomDetailModal");
          renderAll();
          renderActivity();
        }
      }
    });
  }

  function requestDelete(record) {
    openConfirm({
      title: "Delete this draft BOM?",
      message: "This draft was never activated, so nothing built from it yet — deleting is safe.",
      confirmLabel: "Delete",
      onConfirm: () => {
        if (ERP_BomRepository.remove(record.id)) {
          logSystemActivity({ module: "Bill of Materials", action: "Delete", description: `Deleted draft BOM "${record.bomCode}" (${company.name})` });
          closeModal("bomDetailModal");
          renderAll();
          renderActivity();
        }
      }
    });
  }

  function bindDetailModal() {
    $("#bomTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const record = ERP_BomRepository.findById(viewBtn.dataset.id);
      if (record) openDetailModal(record);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "bill-of-materials")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading bills of material…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#bomContent").hidden = true;
      $("#bomSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#bomContent").hidden = false;
      $("#bomHeaderActions").hidden = false;
      $("#bomSubtitle").textContent = `Managing bills of material for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
