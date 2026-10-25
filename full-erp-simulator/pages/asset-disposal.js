/* =============================================================================
   DOT ERP — pages/asset-disposal.js
   Phase 12, Module 04: Asset Disposal

   The live preview calls the SAME `previewDisposal()` the repository's own
   `post()` uses, so what's shown before saving is exactly what posts —
   the same preview-and-reality-can't-drift discipline Finished Goods
   Receipt's own cost preview already established in Phase 10.
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

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function assetLabel(id) { const a = ERP_AssetRepository.findById(id); return a ? `${a.assetCode} — ${a.assetName}` : "Unknown asset"; }
  function statusBadge(status) {
    const tone = status === "Disposed" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }
  function gainLossCell(value, status) {
    if (status !== "Disposed") return "—";
    const tone = value >= 0 ? "success" : "danger";
    const label = value >= 0 ? `Gain ${formatMoney(value)}` : `Loss ${formatMoney(Math.abs(value))}`;
    return `<span class="status-badge status-badge--${tone}">${label}</span>`;
  }

  function disposableAssets() {
    return ERP_AssetRepository.getActiveForCompany(company.id)
      .filter((a) => !ERP_AssetDisposalRepository.hasOpenDisposal(company.id, a.id));
  }

  function getFilteredSorted() {
    let rows = ERP_AssetDisposalRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    return rows;
  }

  function renderSummary() {
    const all = ERP_AssetDisposalRepository.getAllForCompany(company.id);
    $("#adSummaryTotal").textContent = String(all.length);
    $("#adSummaryDraft").textContent = String(all.filter((d) => d.status === "Draft").length);
    const disposed = all.filter((d) => d.status === "Disposed");
    const gain = disposed.filter((d) => d.gainOrLoss > 0).reduce((s, d) => s + d.gainOrLoss, 0);
    const loss = disposed.filter((d) => d.gainOrLoss < 0).reduce((s, d) => s + Math.abs(d.gainOrLoss), 0);
    $("#adSummaryGain").textContent = formatMoney(gain);
    $("#adSummaryLoss").textContent = formatMoney(loss);
  }

  function renderPagination(totalPages) {
    const container = $("#adPagination");
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
    const pageItems = all.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE);

    $("#adEmptyState").hidden = all.length !== 0;
    $("#adTable").hidden = all.length === 0;

    $("#adTableBody").innerHTML = pageItems.map((d) => `
      <tr>
        <td><code>${escapeHtml(d.disposalCode)}</code></td>
        <td>${escapeHtml(assetLabel(d.assetId))}</td>
        <td>${d.disposalDate}</td>
        <td>${escapeHtml(d.disposalType)}</td>
        <td class="text-right">${d.disposalType === "Sale" ? formatMoney(d.saleProceeds) : "—"}</td>
        <td>${gainLossCell(d.gainOrLoss, d.status)}</td>
        <td>${statusBadge(d.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${d.id}">View</button></td>
      </tr>`).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#adStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#adStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#adExportCsvBtn").addEventListener("click", exportCsv);
    $("#adPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const lines = [["Disposal Code", "Asset", "Date", "Type", "Proceeds", "Net Book Value", "Gain/Loss", "Status"].join(",")];
    rows.forEach((d) => lines.push([d.disposalCode, `"${assetLabel(d.assetId)}"`, d.disposalDate, d.disposalType, d.saleProceeds, d.netBookValue, d.gainOrLoss, d.status].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `asset-disposals-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log.filter((e) => e.module === "Asset Disposal").sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8);
    $("#adActivityEmptyState").hidden = relevant.length !== 0;
    $("#adActivityList").innerHTML = relevant.map((e) => `
      <li class="activity-item">
        <span class="activity-item__icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>
        <div><p class="activity-item__text">${escapeHtml(e.description)}</p><p class="activity-item__time">${formatDateTime(new Date(e.timestamp))}</p></div>
      </li>`).join("");
  }

  /* --- Create modal + live preview --- */
  function populateAssetOptions() {
    const assets = disposableAssets();
    $("#adFormAsset").innerHTML = `<option value="">Select an asset…</option>` +
      assets.map((a) => `<option value="${a.id}">${escapeHtml(a.assetCode)} — ${escapeHtml(a.assetName)}</option>`).join("");
  }
  function populateBankOptions() {
    const banks = ERP_BankRepository.getActiveForCompany(company.id);
    $("#adFormBank").innerHTML = `<option value="">Select a bank…</option>` +
      banks.map((b) => `<option value="${b.id}">${escapeHtml(ERP_BankRepository.maskedLabel(b))}</option>`).join("");
    const def = ERP_BankRepository.getDefault(company.id);
    if (def) $("#adFormBank").value = def.id;
  }

  function renderPreview() {
    const assetId = $("#adFormAsset").value;
    const asset = assetId ? ERP_AssetRepository.findById(assetId) : null;
    const date = $("#adFormDate").value;
    if (!asset || !date) { $("#adPreviewTableBody").innerHTML = ""; return; }

    const isSale = $("#adFormType").value === "Sale";
    const proceeds = isSale ? Number($("#adFormProceeds").value) || 0 : 0;
    const p = ERP_AssetDisposalRepository.previewDisposal(company.id, asset, date, proceeds);
    const through = ERP_AssetDisposalRepository.lastDepreciatedThrough(company.id, asset);
    const gainLabel = p.gainOrLoss >= 0 ? "Gain on disposal" : "Loss on disposal";
    const gainTone = p.gainOrLoss >= 0 ? "success" : "danger";

    $("#adPreviewTableBody").innerHTML = `
      <tr><td>Acquisition cost</td><td class="text-right">${formatMoney(asset.acquisitionCost)}</td></tr>
      <tr><td>Depreciation posted through</td><td class="text-right">${through.toISOString().slice(0, 10)}</td></tr>
      <tr><td>Accumulated depreciation so far</td><td class="text-right">${formatMoney(p.openingAccum)}</td></tr>
      <tr><td>Final depreciation charge (to disposal date)</td><td class="text-right">${formatMoney(p.finalCharge)}</td></tr>
      <tr><td><strong>Net book value at disposal</strong></td><td class="text-right"><strong>${formatMoney(p.netBookValue)}</strong></td></tr>
      <tr><td>Sale proceeds</td><td class="text-right">${formatMoney(proceeds)}</td></tr>
      <tr><td><strong>${gainLabel}</strong></td><td class="text-right"><span class="status-badge status-badge--${gainTone}">${formatMoney(Math.abs(p.gainOrLoss))}</span></td></tr>
    `;
  }

  function syncTypeFields() {
    const isSale = $("#adFormType").value === "Sale";
    $("#adSaleFields").hidden = !isSale;
    renderPreview();
  }

  function clearFormErrors() {
    ["adFormAssetError", "adFormDateError", "adFormProceedsError", "adFormBankError"].forEach((id) => { $("#" + id).textContent = ""; });
  }

  function openAddModal() {
    if (disposableAssets().length === 0) {
      showToast("No assets available to dispose — every active asset already has an open disposal.", "warning");
      return;
    }
    populateAssetOptions();
    populateBankOptions();
    $("#adFormDate").value = new Date().toISOString().slice(0, 10);
    $("#adFormType").value = "Sale";
    $("#adFormProceeds").value = "";
    $("#adFormRemarks").value = "";
    $("#adPreviewTableBody").innerHTML = "";
    syncTypeFields();
    clearFormErrors();
    openModal("adFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();
    const assetId = $("#adFormAsset").value;
    if (!assetId) { $("#adFormAssetError").textContent = "Select an asset."; valid = false; }
    const date = $("#adFormDate").value;
    if (!date) { $("#adFormDateError").textContent = "Select a disposal date."; valid = false; }
    else if (assetId) {
      const asset = ERP_AssetRepository.findById(assetId);
      if (asset && new Date(date) < new Date(asset.acquisitionDate)) {
        $("#adFormDateError").textContent = "Disposal date can't be before the asset was acquired.";
        valid = false;
      }
    }
    if ($("#adFormType").value === "Sale") {
      const proceeds = Number($("#adFormProceeds").value);
      if (!(proceeds >= 0)) { $("#adFormProceedsError").textContent = "Enter the sale proceeds (0 if nothing was received)."; valid = false; }
      if (!$("#adFormBank").value) { $("#adFormBankError").textContent = "Select which bank the money arrived into."; valid = false; }
    }
    return valid;
  }

  function bindFormModal() {
    $("#adAddBtn").addEventListener("click", openAddModal);
    $("#adFormAsset").addEventListener("change", renderPreview);
    $("#adFormDate").addEventListener("change", renderPreview);
    $("#adFormType").addEventListener("change", syncTypeFields);
    $("#adFormProceeds").addEventListener("input", renderPreview);

    $("#adFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const asset = ERP_AssetRepository.findById($("#adFormAsset").value);
      if (!asset) return;
      const created = ERP_AssetDisposalRepository.create(company, asset, {
        disposalDate: $("#adFormDate").value,
        disposalType: $("#adFormType").value,
        saleProceeds: Number($("#adFormProceeds").value) || 0,
        bankId: $("#adFormBank").value || null,
        remarks: $("#adFormRemarks").value.trim()
      }, session.username);
      logSystemActivity({ module: "Asset Disposal", action: "Create", description: `Created disposal "${created.disposalCode}" for ${assetLabel(asset.id)} (${company.name})` });
      closeModal("adFormModal");
      renderAll();
      renderActivity();
      showToast("Disposal saved as Draft — post it to update the books.", "success");
    });
  }

  /* --- Detail modal + lifecycle --- */
  function renderDetailFooter(disposal) {
    const footer = $("#adDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, onClick) => {
      const btn = document.createElement("button"); btn.type = "button"; btn.className = cls; btn.textContent = label; btn.addEventListener("click", onClick); footer.appendChild(btn);
    };
    if (disposal.status === "Draft") {
      addBtn("Post Disposal", "btn btn--primary", () => requestPost(disposal));
      addBtn("Cancel", "btn btn--danger-outline", () => requestCancel(disposal));
    }
    addBtn("Close", "btn btn--ghost", () => closeModal("adDetailModal"));
  }

  function openDetailModal(disposal) {
    const asset = ERP_AssetRepository.findById(disposal.assetId);
    const bank = disposal.bankId && typeof ERP_BankRepository !== "undefined" ? ERP_BankRepository.findById(disposal.bankId) : null;
    const isPosted = disposal.status === "Disposed";
    $("#adDetailTitle").textContent = `Asset Disposal — ${disposal.disposalCode}`;
    $("#adDetailBody").innerHTML = `
      <div><dt>Disposal Code</dt><dd><code>${escapeHtml(disposal.disposalCode)}</code></dd></div>
      <div><dt>Asset</dt><dd>${escapeHtml(assetLabel(disposal.assetId))}</dd></div>
      <div><dt>Disposal Date</dt><dd>${disposal.disposalDate}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(disposal.disposalType)}</dd></div>
      ${disposal.disposalType === "Sale" ? `<div><dt>Sale Proceeds</dt><dd>${formatMoney(disposal.saleProceeds)}</dd></div><div><dt>Received Into</dt><dd>${bank ? escapeHtml(ERP_BankRepository.maskedLabel(bank)) : "<span class=\"profile-subtle\">Not specified</span>"}</dd></div>` : ""}
      ${asset ? `<div><dt>Acquisition Cost</dt><dd>${formatMoney(asset.acquisitionCost)}</dd></div>` : ""}
      ${isPosted ? `
        <div><dt>Final Depreciation Charge</dt><dd>${formatMoney(disposal.finalDepreciationCharge)}</dd></div>
        <div><dt>Net Book Value at Disposal</dt><dd>${formatMoney(disposal.netBookValue)}</dd></div>
        <div><dt>Gain / Loss</dt><dd>${gainLossCell(disposal.gainOrLoss, disposal.status)}</dd></div>` : ""}
      <div><dt>Remarks</dt><dd>${disposal.remarks ? escapeHtml(disposal.remarks) : "<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(disposal.status)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(disposal.createdAt))} by ${escapeHtml(actorLabel(disposal.createdByUsername))}</dd></div>
      ${isPosted ? `<div><dt>Posted</dt><dd>${formatDateTime(new Date(disposal.postedAt))} by ${escapeHtml(actorLabel(disposal.postedByUsername))}</dd></div>` : ""}
    `;
    renderDetailFooter(disposal);
    openModal("adDetailModal");
  }

  function requestPost(disposal) {
    const asset = ERP_AssetRepository.findById(disposal.assetId);
    const preview = asset ? ERP_AssetDisposalRepository.previewDisposal(company.id, asset, disposal.disposalDate, disposal.saleProceeds) : null;
    const gainLossText = preview
      ? (preview.gainOrLoss >= 0 ? `a gain of ${formatMoney(preview.gainOrLoss)}` : `a loss of ${formatMoney(Math.abs(preview.gainOrLoss))}`)
      : "the computed gain or loss";
    openConfirm({
      title: "Post this disposal?",
      message: `This charges the final depreciation, marks the asset Disposed, and posts a journal entry booking ${gainLossText}. There's no un-posting.`,
      confirmLabel: "Post Disposal",
      onConfirm: () => {
        const result = ERP_AssetDisposalRepository.post(disposal.id, company.id, session.username);
        if (!result.success) { showToast(result.reason || "Couldn't post this disposal.", "danger"); return; }
        logSystemActivity({ module: "Asset Disposal", action: "Post", description: `Posted disposal "${result.record.disposalCode}" (${company.name})` });

        if (typeof ERP_GlPostingRepository !== "undefined") {
          const glResult = ERP_GlPostingRepository.postAssetDisposal(company, result.record, session.username);
          if (glResult.success) {
            logSystemActivity({ module: "Asset Disposal", action: "Auto-Post", description: `Auto-posted journal entry ${glResult.entry.entryNumber} for "${result.record.disposalCode}" (${company.name})` });
          } else {
            showToast(glResult.reason, "warning", { title: "Not posted to the books" });
          }
        }

        closeModal("adDetailModal");
        renderAll();
        renderActivity();
        showToast("Disposal posted.", "success");
      }
    });
  }

  function requestCancel(disposal) {
    openConfirm({
      title: "Cancel this draft?",
      message: "This draft was never posted, so nothing has reached the books — cancelling is safe, and the asset stays Active.",
      confirmLabel: "Cancel Disposal",
      onConfirm: () => {
        ERP_AssetDisposalRepository.cancel(disposal.id, session.username);
        logSystemActivity({ module: "Asset Disposal", action: "Cancel", description: `Cancelled disposal "${disposal.disposalCode}" (${company.name})` });
        closeModal("adDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#adTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const disposal = ERP_AssetDisposalRepository.findById(viewBtn.dataset.id);
      if (disposal) openDetailModal(disposal);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "asset-disposal")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading disposals…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#adContent").hidden = true;
      $("#adSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#adContent").hidden = false;
      $("#adHeaderActions").hidden = false;
      $("#adSubtitle").textContent = `Managing asset disposals for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
