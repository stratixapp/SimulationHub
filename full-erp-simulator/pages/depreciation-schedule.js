/* =============================================================================
   DOT ERP — pages/depreciation-schedule.js
   Phase 12, Module 02: Depreciation Schedule

   A PURE READ-ONLY PROJECTION — NO REPOSITORY OF ITS OWN, BY DESIGN: this
   is the same "a report reuses forward, it doesn't re-derive" discipline
   every Phase 8 report already follows. The projection is computed here,
   from Asset Register's own already-verified annual formulas plus
   Depreciation Run's own already-verified monthly-equivalent rate — NOT
   a third, independent implementation of the same math, which would be
   exactly the kind of quiet drift this project has avoided everywhere
   else. That's why this module needs no `data/` file at all: it stores
   nothing and decides nothing.

   The projection deliberately runs from the asset's own ACQUISITION DATE
   every time, regardless of what's actually been posted — that's what
   makes it a comparable, independent recomputation (the auditor's use
   case in this page's own training guide) rather than just a restatement
   of Depreciation Run's own history.
   ========================================================================== */

(function () {
  "use strict";

  const { $, $$, escapeHtml, showToast, requireSession, runBootSequence } = window.ERP;

  let session = null;
  let company = null;
  let granularity = "yearly";
  let selectedAssetId = null;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

  /** The full month-by-month projection for one asset, from its own
      acquisition date until it reaches residual value. Reuses
      ERP_AssetRepository.computeAnnualDepreciation() and the same
      monthly-equivalent WDV rate ERP_DepreciationRunRepository uses —
      see this file's own header on why it's reused, not reimplemented. */
  function projectMonthly(asset) {
    const cost = Number(asset.acquisitionCost) || 0;
    const residual = Number(asset.residualValue) || 0;
    const annual = ERP_AssetRepository.computeAnnualDepreciation(asset);
    const monthlyRate = asset.depreciationMethod === "Written-Down-Value"
      ? 1 - Math.pow(1 - annual.annualRate, 1 / 12)
      : 0;

    const acq = new Date(asset.acquisitionDate);
    let y = acq.getFullYear();
    let m = acq.getMonth() + 1;
    let bv = cost;
    const rows = [];

    // Hard cap well beyond any sane useful life, so a pathological record
    // (life = 0.5y, residual ≈ cost) can never spin forever.
    const maxMonths = Math.ceil((Number(asset.usefulLifeYears) || 0) * 12) + 24;

    for (let i = 0; i < maxMonths; i++) {
      const remaining = bv - residual;
      if (remaining <= 0.005) break;

      let charge = asset.depreciationMethod === "Straight-Line"
        ? annual.annualCharge / 12
        : bv * monthlyRate;

      const isAcqMonth = (y === acq.getFullYear() && m === acq.getMonth() + 1);
      if (isAcqMonth) {
        const dim = daysInMonth(y, m);
        charge *= Math.max(0, dim - acq.getDate() + 1) / dim;
      }
      if (charge > remaining) charge = remaining;
      charge = Math.round(charge * 100) / 100;

      const opening = bv;
      bv = Math.round((bv - charge) * 100) / 100;
      rows.push({ year: y, month: m, opening, charge, closing: bv });

      m++; if (m > 12) { m = 1; y++; }
    }
    return rows;
  }

  function aggregateYearly(monthlyRows) {
    const byYear = new Map();
    monthlyRows.forEach((r) => {
      if (!byYear.has(r.year)) byYear.set(r.year, { year: r.year, opening: r.opening, charge: 0, closing: r.closing });
      const entry = byYear.get(r.year);
      entry.charge = Math.round((entry.charge + r.charge) * 100) / 100;
      entry.closing = r.closing;
    });
    return Array.from(byYear.values());
  }

  function currentRows() {
    const asset = ERP_AssetRepository.findById(selectedAssetId);
    if (!asset) return [];
    const monthly = projectMonthly(asset);
    return granularity === "monthly" ? monthly : aggregateYearly(monthly);
  }

  function renderAssetSummary() {
    const asset = ERP_AssetRepository.findById(selectedAssetId);
    if (!asset) { $("#dsAssetSummary").innerHTML = ""; return; }
    const annual = ERP_AssetRepository.computeAnnualDepreciation(asset);
    const posted = ERP_AssetRepository.getAccumulatedDepreciation(company.id, asset.id);
    const rateLine = asset.depreciationMethod === "Straight-Line"
      ? `${formatMoney(annual.annualCharge)} per year`
      : `${(annual.annualRate * 100).toFixed(2)}% per year (of opening book value)`;

    $("#dsAssetSummary").innerHTML = `
      <div><dt>Asset</dt><dd>${escapeHtml(asset.assetName)} (<code>${escapeHtml(asset.assetCode)}</code>)</dd></div>
      <div><dt>Category</dt><dd>${escapeHtml(asset.assetCategory)}</dd></div>
      <div><dt>Acquisition Cost</dt><dd>${formatMoney(asset.acquisitionCost)}</dd></div>
      <div><dt>Residual Value</dt><dd>${formatMoney(asset.residualValue)}</dd></div>
      <div><dt>Useful Life</dt><dd>${asset.usefulLifeYears} year(s)</dd></div>
      <div><dt>Method</dt><dd>${escapeHtml(asset.depreciationMethod)}</dd></div>
      <div><dt>Depreciation Rate</dt><dd>${rateLine}</dd></div>
      <div><dt>Posted so far</dt><dd>${formatMoney(posted)} (actual, via Depreciation Run)</dd></div>
    `;
  }

  function renderTable() {
    const rows = currentRows();
    $("#dsEmptyState").hidden = rows.length !== 0;
    $("#dsTable").hidden = rows.length === 0;

    $("#dsTableBody").innerHTML = rows.map((r) => {
      const label = granularity === "monthly"
        ? `${r.year}-${String(r.month).padStart(2, "0")}`
        : String(r.year);
      return `
      <tr>
        <td>${label}</td>
        <td class="text-right">${formatMoney(r.opening)}</td>
        <td class="text-right">${formatMoney(r.charge)}</td>
        <td class="text-right">${formatMoney(r.closing)}</td>
      </tr>`;
    }).join("");
  }

  function renderAll() { renderAssetSummary(); renderTable(); }

  function populateAssetPicker() {
    const assets = ERP_AssetRepository.getAllForCompany(company.id);
    $("#dsAssetPicker").innerHTML = assets.map((a) => `<option value="${a.id}">${escapeHtml(a.assetCode)} — ${escapeHtml(a.assetName)}</option>`).join("");
    selectedAssetId = assets.length ? assets[0].id : null;
  }

  function bindControls() {
    $("#dsAssetPicker").addEventListener("change", () => {
      selectedAssetId = $("#dsAssetPicker").value;
      renderAll();
    });
    $$("#dsGranularityChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#dsGranularityChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        granularity = chip.dataset.granularity;
        renderTable();
      });
    });
    $("#dsExportCsvBtn").addEventListener("click", exportCsv);
    $("#dsPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = currentRows();
    if (!rows.length) { showToast("Nothing to export — this asset is fully depreciated.", "warning"); return; }
    const asset = ERP_AssetRepository.findById(selectedAssetId);
    const header = ["Period", "Opening Book Value", "Depreciation", "Closing Book Value"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      const label = granularity === "monthly" ? `${r.year}-${String(r.month).padStart(2, "0")}` : String(r.year);
      lines.push([label, r.opening.toFixed(2), r.charge.toFixed(2), r.closing.toFixed(2)].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `depreciation-schedule-${asset ? asset.assetCode : "asset"}-${granularity}.csv`;
    link.click();
  }

  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "depreciation-schedule")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Projecting depreciation…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#noAssetState").hidden = true;
      $("#dsContent").hidden = true;
      $("#dsSubtitle").textContent = "No active company yet.";
    } else if (ERP_AssetRepository.getAllForCompany(company.id).length === 0) {
      $("#noCompanyState").hidden = true;
      $("#noAssetState").hidden = false;
      $("#dsContent").hidden = true;
    } else {
      $("#noCompanyState").hidden = true;
      $("#noAssetState").hidden = true;
      $("#dsContent").hidden = false;
      $("#dsHeaderActions").hidden = false;
      $("#dsSubtitle").textContent = `Projecting depreciation for ${company.name} (${company.companyCode}).`;
      populateAssetPicker();
      renderAll();
      bindControls();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
