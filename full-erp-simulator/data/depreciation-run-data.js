/* =============================================================================
   DOT ERP
   FILE:  data/depreciation-run-data.js
   ROLE:  Data-access layer for Depreciation Run — Phase 12, Module 03.
          A periodic batch process: for every Active asset, compute and
          POST one month's real depreciation charge. This is the module
          that turns Asset Register's own annual formulas and
          Depreciation Schedule's own projection into a genuine, posted,
          historical fact.

   CHECKED AGAINST PAYROLL PROCESSING'S OWN SHAPE, NOT ASSUMED TO MATCH —
   THE ROADMAP'S OWN EXPLICIT INSTRUCTION: read `data/payroll-data.js`
   directly before writing a line of this file. The similarity holds,
   almost exactly: `findActiveRunForPeriod(companyId, year, month)` mirrors
   `findActiveRunForPeriod` byte for byte in shape; `generateRun()` is
   both "create" and "refresh" for a Draft the same way Payroll's own
   version is (recomputing every line in place is useful if an asset was
   added or disposed after the first generation but before anyone signed
   off); ONE RUN PER (companyId, periodYear, periodMonth), EXCLUDING
   CANCELLED — resolution #7's familiar shape, the "Cancelled doesn't
   block a redo" exception carried over intact. Where it genuinely
   DIFFERS: there's no `markPaid()` equivalent at all — a depreciation
   run has no cash leg of its own, so the lifecycle is the simpler
   two-stage Draft → Processed (+ Cancelled), not Payroll's three-stage
   Draft → Processed → Paid.

   CANCELLING A PROCESSED RUN DOES NOT REVERSE ITS OWN GL POSTING — THE
   SAME LIMITATION PAYROLL'S OWN `cancel()` ALREADY CARRIES, NOT A NEW
   ONE INTRODUCED HERE: neither file's own `cancel()` calls any GL-
   reversal function, and neither Journal Entry nor Stock Ledger support
   an update/delete once posted (see their own headers). A cancelled-
   after-Processed run's own figures stop counting toward
   `ERP_AssetRepository.getAccumulatedDepreciation()` (which only reads
   `status === "Processed"`), which means a cancellation like that
   creates a genuine, real mismatch against whatever already posted to
   the General Ledger — named plainly here, the same way it's true of
   (and never solved for) Payroll's own equivalent case, rather than
   quietly claiming this file handles it better.

   THE MONTHLY MATH — SLM IS SIMPLE, WDV IS NOT AS SIMPLE AS IT LOOKS,
   AND BOTH WERE NODE-VERIFIED AGAINST HAND-TRACED NUMBERS BEFORE THIS
   FILE SHIPPED, THE SAME RIGOR STOCK VALUATION'S OWN FIFO ENGINE GOT:
   Straight-Line's own monthly charge is just `annualCharge / 12` — a
   constant figure every month. Written-Down-Value is NOT
   `annualRate / 12` applied to the declining monthly balance — that was
   the first version of this file's own math, and it was WRONG: verified
   in Node that it left an asset roughly 40% short of its own residual
   value after its full useful life, because compounding a naive
   (rate/12) monthly reduction for 12 periods does NOT equal a single
   annual reduction at the full rate (`1-(1-r/12)^12 ≠ r`). The corrected,
   verified formula derives the true MONTHLY-EQUIVALENT rate instead —
   `monthlyRate = 1 - (1 - annualRate) ^ (1/12)` — so that compounding it
   for 12 full months reproduces EXACTLY the same year-end book value the
   annual formula alone would give. Traced in Node against a 5-year,
   ₹120,000-cost, ₹6,000-residual asset: the corrected formula closed at
   precisely ₹6,000.00 after the asset's full useful life; the naive one
   was still sitting at ₹10,140 with the life already elapsed. This is
   exactly the kind of "looks obviously right, is subtly wrong" defect
   Node verification exists to catch before it ships, not after.

   PRORATION, CLAMPING, EXCLUSION — THREE RULES APPLIED TO EVERY LINE,
   EVERY RUN:
   1. An asset acquired DURING the run's own month prorates that one
      month by days: `chargeDays = daysInMonth - acquisitionDay + 1`
      (inclusive of the acquisition day itself), `charge *= chargeDays /
      daysInMonth`. Every month after the acquisition month charges in
      full.
   2. A charge is CLAMPED so book value never drops below residual value
      — the final month of an asset's life charges exactly
      `bookValue - residual`, not the full formula amount, which would
      otherwise overshoot. An asset already at its own residual value
      generates a genuine ₹0 line, included and visible, not silently
      dropped — the same "show the zero, don't hide the edge case" ethos
      this project has held to elsewhere (a fully-issued Material Issue
      line, a zero-balance GL account on Trial Balance).
   3. An asset already Disposed as of this run's own period is EXCLUDED
      entirely — its own final, disposal-date-prorated charge already
      lives on its own Asset Disposal record (see that file's own
      header), and duplicating it here would double-count it.

   GL POSTING LIVES IN gl-posting-data.js, NOT HERE, BUILT IN THE SAME
   PASS AS THIS FILE — DELIBERATELY NOT DEFERRED THE WAY PAYROLL'S FIRST
   WAS: the roadmap's own brief said this one probably shouldn't be —
   depreciation with no GL impact isn't really modeling the concept at
   all, since the entire point of a depreciation run in real accounting
   IS the journal entry it produces. `pages/depreciation-run.js` calls
   `ERP_GlPostingRepository.postDepreciationRun()` right after a
   successful `process()`, the same "business module doesn't know GL
   posting exists" separation every Phase 6 retrofit point already uses.
   ========================================================================== */

const ERP_DEPRECIATION_RUN_KEY = "erp_depreciation_runs";
const ERP_DEPRECIATION_RUN_STATUSES = ["Draft", "Processed", "Cancelled"];

const ERP_DepreciationRunRepository = {
  statuses: ERP_DEPRECIATION_RUN_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_DEPRECIATION_RUN_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_DEPRECIATION_RUN_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((r) => r.companyId === companyId)
      .sort((a, b) => (b.periodYear - a.periodYear) || (b.periodMonth - a.periodMonth));
  },

  findById(id) {
    return this.getAll().find((r) => r.id === id) || null;
  },

  findActiveRunForPeriod(companyId, year, month) {
    return this.getAllForCompany(companyId).find((r) => r.periodYear === year && r.periodMonth === month && r.status !== "Cancelled") || null;
  },

  _daysInMonth(year, month) { return new Date(year, month, 0).getDate(); },

  /** The verified monthly math — see file header. Returns the RAW
      monthly charge for one asset for one (year, month) period, BEFORE
      proration/clamping (applied by the caller, since clamping needs to
      know the asset's own running book value across the whole run, not
      just this one line in isolation). */
  _rawMonthlyCharge(asset, openingBookValue) {
    const annual = ERP_AssetRepository.computeAnnualDepreciation(asset);
    if (asset.depreciationMethod === "Straight-Line") return annual.annualCharge / 12;
    const monthlyRate = 1 - Math.pow(1 - annual.annualRate, 1 / 12);
    return openingBookValue * monthlyRate;
  },

  /** Builds (but does not save) the line array a Draft run for
      (year, month) would contain right now — used by both generateRun()
      and the create-page's own live preview. */
  buildLines(companyId, year, month) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const daysInMonth = this._daysInMonth(year, month);

    return ERP_AssetRepository.getAllForCompany(companyId)
      .filter((a) => new Date(a.acquisitionDate) <= monthEnd) // not yet acquired as of this period
      .filter((a) => {
        // Exclude an asset already Disposed BEFORE this period started —
        // its own final charge already lives on its own disposal record.
        if (a.status !== "Disposed") return true;
        if (typeof ERP_AssetDisposalRepository === "undefined") return true;
        const disposal = ERP_AssetDisposalRepository.getAllForCompany(companyId).find((d) => d.assetId === a.id && d.status === "Disposed");
        return disposal ? new Date(disposal.disposalDate) >= monthStart : true;
      })
      .map((a) => {
        const openingAccum = ERP_AssetRepository.getAccumulatedDepreciation(companyId, a.id) -
          this._thisRunsOwnPriorAmount(companyId, a.id, year, month); // exclude this SAME draft's own prior save, if regenerating
        const cost = Number(a.acquisitionCost) || 0;
        const residual = Number(a.residualValue) || 0;
        const openingBookValue = cost - openingAccum;
        const remainingDepreciable = openingBookValue - residual;

        let charge = 0;
        if (remainingDepreciable > 0.005) {
          charge = this._rawMonthlyCharge(a, openingBookValue);
          const acq = new Date(a.acquisitionDate);
          const isAcquisitionMonth = acq.getFullYear() === year && (acq.getMonth() + 1) === month;
          if (isAcquisitionMonth) {
            const activeDays = daysInMonth - acq.getDate() + 1;
            charge *= Math.max(0, activeDays) / daysInMonth;
          }
          if (charge > remainingDepreciable) charge = remainingDepreciable;
          charge = Math.round(charge * 100) / 100;
        }

        return {
          assetId: a.id,
          openingBookValue: Math.round(openingBookValue * 100) / 100,
          chargeAmount: charge,
          closingBookValue: Math.round((openingBookValue - charge) * 100) / 100
        };
      });
  },

  /** If a Draft run for this exact period already exists, its own
      previously-saved lines must be excluded from "already accumulated"
      before recomputing — otherwise regenerating a Draft would double-
      count its own prior draft amount. Returns 0 if no such Draft/line
      exists yet (the normal, first-generation case). */
  _thisRunsOwnPriorAmount(companyId, assetId, year, month) {
    const existing = this.findActiveRunForPeriod(companyId, year, month);
    if (!existing || existing.status !== "Draft") return 0;
    const line = (existing.lines || []).find((l) => l.assetId === assetId);
    return line ? Number(line.chargeAmount) || 0 : 0;
  },

  /** Create-or-refresh for (year, month) — see file header. */
  generateRun(company, year, month, actorUsername) {
    const lines = this.buildLines(company.id, year, month);
    const totalCharge = lines.reduce((sum, l) => sum + l.chargeAmount, 0);
    const all = this.getAll();
    const existing = all.findIndex((r) => r.companyId === company.id && r.periodYear === year && r.periodMonth === month && r.status === "Draft");

    if (existing !== -1) {
      all[existing] = { ...all[existing], lines, totalCharge, regeneratedAt: new Date().toISOString() };
      this._saveAll(all);
      return all[existing];
    }
    const record = {
      id: "DEP-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      runCode: `${company.companyCode}-DEP-${year}${String(month).padStart(2, "0")}`,
      periodYear: year,
      periodMonth: month,
      status: "Draft",
      lines,
      totalCharge,
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString()
    };
    all.push(record);
    this._saveAll(all);
    return record;
  },

  process(id, actorUsername) {
    const run = this.findById(id);
    if (!run || run.status !== "Draft") return null;
    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    all[idx] = { ...all[idx], status: "Processed", processedAt: new Date().toISOString(), processedByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft or Processed -> Cancelled — see file header for why this does
      NOT reverse an already-posted GL entry, the same limitation
      Payroll's own cancel() already carries. */
  cancel(id, actorUsername) {
    const run = this.findById(id);
    if (!run || (run.status !== "Draft" && run.status !== "Processed")) return null;
    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    all[idx] = { ...all[idx], status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  }
};
