/* =============================================================================
   DOT ERP
   FILE:  data/asset-disposal-data.js
   ROLE:  Data-access layer for Asset Disposal — Phase 12, Module 04,
          closing Fixed Assets. Sells or writes off an Active asset,
          computing a genuine gain or loss on disposal — real double-
          entry accounting, not a simplified placeholder.

   THE FINAL PARTIAL-PERIOD CHARGE IS COMPUTED AND CAPTURED RIGHT HERE,
   NOT DEFERRED TO A REQUIRED DEPRECIATION RUN FIRST — A DELIBERATE UX
   AND ACCOUNTING DECISION: real accounting charges depreciation up to
   the date of disposal BEFORE computing gain/loss, and requiring a
   person to go run Depreciation Run for a stub period immediately before
   every disposal would be clunky and easy to forget. So `post()` below
   computes its own final charge — prorated by days from whatever's
   already been Processed (the end of the last Processed run's own
   period, or the asset's own acquisition date if depreciation was never
   run at all) up to the disposal date — using the SAME annual-rate math
   `depreciation-run-data.js` already established (see that file's own
   header for the Node-verified SLM/WDV formulas), applied as a fraction
   of a full year rather than a fraction of one month. This charge is
   stored on THIS record (`finalDepreciationCharge`), not injected as a
   synthetic line into some Depreciation Run — `getAccumulatedDepreciation()`
   in asset-data.js already reads both sources and adds them together,
   the same way a Work Order's own live rollups already read across two
   sibling modules without either one needing to know about the other's
   own storage.

   GAIN/LOSS — REAL DOUBLE-ENTRY, NODE-VERIFIED TO BALANCE: with the
   final charge folded in, `netBookValue = cost - accumulatedDepreciation`
   (accumulated including this disposal's own final charge) and
   `gainOrLoss = saleProceeds - netBookValue` — positive is a gain,
   negative a loss. A write-off (no sale at all) is simply
   `saleProceeds = 0`, which makes `gainOrLoss` equal to the negative of
   whatever book value remained — a full loss of what hadn't yet been
   depreciated, exactly as it should be. `gl-posting-data.js`'s own
   `postAssetDisposal()` turns this into the real compound journal entry
   (clear Accumulated Depreciation, clear the asset at cost, book the
   sale proceeds if any, and a balancing gain-or-loss line) — verified in
   Node to balance to the paisa across a gain case, a loss case, and a
   fully-depreciated write-off with nothing left to lose.

   NOT EXCLUSIVE, THE ORDINARY WAY: only one OPEN (Draft) disposal can
   exist per asset at a time (a hard block, resolution #7's shape, scoped
   to non-Cancelled records — a second Draft disposal for an asset
   that's already mid-disposal is a genuine duplicate, not a normal
   repeat), but a Cancelled disposal doesn't block trying again, the same
   "Cancelled doesn't count" exception every period-lock and status-
   scoped check in this project already carries.

   Draft → Disposed → Cancelled (Cancelled only from Draft) — the same
   "administrative formalization, immutable once posted" shape every
   other posting module in this project uses, for the same reason: once
   Disposed, the asset's own status has changed and a real Stock-Ledger-
   adjacent fact (a genuine disposal, an actual sale) has happened —
   correcting it means a fresh, separate document, not a rewrite.
   ========================================================================== */

const ERP_ASSET_DISPOSAL_KEY = "erp_asset_disposals";
const ERP_ASSET_DISPOSAL_STATUSES = ["Draft", "Disposed", "Cancelled"];
const ERP_ASSET_DISPOSAL_TYPES = ["Sale", "Write-off"];

const ERP_AssetDisposalRepository = {
  statuses: ERP_ASSET_DISPOSAL_STATUSES,
  types: ERP_ASSET_DISPOSAL_TYPES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_ASSET_DISPOSAL_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_ASSET_DISPOSAL_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((d) => d.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((d) => d.id === id) || null;
  },

  hasOpenDisposal(companyId, assetId) {
    return this.getAllForCompany(companyId).some((d) => d.assetId === assetId && d.status !== "Cancelled");
  },

  /** DEP-DISP-01, ... per company (its own code prefix, distinct from
      Depreciation Run's DEP-YYYYMM codes, so the two never look
      interchangeable in a list). */
  nextDisposalCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((d) => {
      const match = /-DISP-(\d+)$/.exec(d.disposalCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-DISP-${String(max + 1).padStart(2, "0")}`;
  },

  /** The date depreciation was last actually posted up to, for this
      asset — the end of the last Processed run's own period, or the
      asset's own acquisition date if none has ever run. Exposed so the
      create page can show "depreciation is current through {date}"
      before a person picks a disposal date. */
  lastDepreciatedThrough(companyId, asset) {
    let latest = new Date(asset.acquisitionDate);
    if (typeof ERP_DepreciationRunRepository !== "undefined") {
      ERP_DepreciationRunRepository.getAllForCompany(companyId)
        .filter((r) => r.status === "Processed" && (r.lines || []).some((l) => l.assetId === asset.id))
        .forEach((r) => {
          const periodEnd = new Date(r.periodYear, r.periodMonth, 0); // last day of that period's own month
          if (periodEnd > latest) latest = periodEnd;
        });
    }
    return latest;
  },

  /** The Node-verified annual-rate math from depreciation-run-data.js,
      applied as a fraction of a year rather than a fraction of a month —
      see file header. Returns the raw final charge, NOT yet clamped to
      the asset's own remaining depreciable amount (the caller clamps,
      since it also needs the unclamped figure for display/preview). */
  computeFinalCharge(companyId, asset, disposalDate) {
    const through = this.lastDepreciatedThrough(companyId, asset);
    const disposal = new Date(disposalDate);
    const days = Math.max(0, Math.round((disposal - through) / (1000 * 60 * 60 * 24)));
    if (days <= 0) return 0;

    const openingAccum = ERP_AssetRepository.getAccumulatedDepreciation(companyId, asset.id);
    const cost = Number(asset.acquisitionCost) || 0;
    const openingBookValue = cost - openingAccum;
    const annual = ERP_AssetRepository.computeAnnualDepreciation(asset);

    let raw;
    if (asset.depreciationMethod === "Straight-Line") raw = annual.annualCharge * (days / 365);
    else raw = openingBookValue * annual.annualRate * (days / 365);
    return Math.round(raw * 100) / 100;
  },

  /** Full preview of what disposing THIS asset on THIS date would look
      like — used by both the create page's live preview and post()
      itself, so preview and reality can never drift apart. */
  previewDisposal(companyId, asset, disposalDate, saleProceeds) {
    const openingAccum = ERP_AssetRepository.getAccumulatedDepreciation(companyId, asset.id);
    const cost = Number(asset.acquisitionCost) || 0;
    const residual = Number(asset.residualValue) || 0;
    const openingBookValue = cost - openingAccum;
    const remainingDepreciable = Math.max(0, openingBookValue - residual);

    let finalCharge = this.computeFinalCharge(companyId, asset, disposalDate);
    if (finalCharge > remainingDepreciable) finalCharge = remainingDepreciable;
    if (finalCharge < 0) finalCharge = 0;

    const netBookValue = Math.round((openingBookValue - finalCharge) * 100) / 100;
    const gainOrLoss = Math.round(((Number(saleProceeds) || 0) - netBookValue) * 100) / 100;

    return { openingAccum, finalCharge, netBookValue, gainOrLoss };
  },

  create(company, asset, data, actorUsername) {
    const record = {
      id: "DISP-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      disposalCode: this.nextDisposalCode(company),
      assetId: asset.id,
      disposalDate: data.disposalDate,
      disposalType: data.disposalType,
      saleProceeds: data.disposalType === "Sale" ? Number(data.saleProceeds) || 0 : 0,
      bankId: data.disposalType === "Sale" ? (data.bankId || null) : null,
      remarks: data.remarks || "",
      status: "Draft",
      finalDepreciationCharge: 0,
      netBookValue: 0,
      gainOrLoss: 0,
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString()
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  canPost(record) { return record.status === "Draft"; },

  /** The ONLY place a disposal's own final figures are actually
      computed for real and stamped — see previewDisposal() above for
      why preview and post() can never disagree. Marks the asset itself
      Disposed. Does NOT itself call GL posting — that's
      `pages/asset-disposal.js`'s own job, right after a successful
      post(), matching this whole project's established page-calls-GL
      separation. */
  post(id, companyId, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((d) => d.id === id);
    if (idx === -1 || !this.canPost(all[idx])) return { success: false, reason: "This disposal can't be posted." };
    const record = all[idx];
    const asset = ERP_AssetRepository.findById(record.assetId);
    if (!asset) return { success: false, reason: "Linked asset not found." };

    const preview = this.previewDisposal(companyId, asset, record.disposalDate, record.saleProceeds);

    all[idx] = {
      ...record,
      status: "Disposed",
      finalDepreciationCharge: preview.finalCharge,
      netBookValue: preview.netBookValue,
      gainOrLoss: preview.gainOrLoss,
      postedAt: new Date().toISOString(),
      postedByUsername: actorUsername || "system"
    };
    this._saveAll(all);
    ERP_AssetRepository.markDisposed(record.assetId);
    return { success: true, record: all[idx] };
  },

  canCancel(record) { return record.status === "Draft"; },
  cancel(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((d) => d.id === id);
    if (idx === -1 || !this.canCancel(all[idx])) return null;
    all[idx] = { ...all[idx], status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  }
};
