/* =============================================================================
   DOT ERP
   FILE:  data/asset-data.js
   ROLE:  Data-access layer for Asset Register — Phase 12, Module 01,
          opening Fixed Assets. Master data: what the company owns, what
          it cost, how long it's expected to last, and which of the two
          real methods depreciates it.

   ACQUISITION ITSELF IS DELIBERATELY NOT A GL-POSTING EVENT HERE — THE
   SAME BOUNDARY ITEM MASTER ALREADY DRAWS: this file is pure master
   data, the same way Item Master is — creating a record here doesn't
   itself touch the books. A real capitalization entry (Dr Fixed Asset /
   Cr Bank or Accounts Payable) is exactly what the general-purpose
   Journal Entry module (Phase 6) already exists to record directly; this
   phase's own GL work is scoped to the two events it can actually
   COMPUTE for you — Depreciation Run and Asset Disposal — the same two
   the roadmap's own brief named. Building a whole acquisition-payment
   sub-flow here would be scope creep this phase was never asked for.

   ASSET CATEGORY IS A FIXED ENUM, NOT ITS OWN MASTER-DATA MODULE — A
   DELIBERATE SCOPE CALL: the real-world vocabulary (Schedule II of the
   Companies Act, 2013) is short and genuinely fixed in practice —
   Land, Buildings, Plant & Machinery, Furniture & Fixtures, Vehicles,
   Office Equipment, Computers, Intangible Assets. Adding a 6th master-
   data CRUD module just to manage eight rarely-changing category names
   would be disproportionate; this reuses the exact "fixed vocabulary
   embedded directly on the record" shape Item Master's own `itemType`
   already established, not a new pattern.

   RESIDUAL VALUE, NOT JUST USEFUL LIFE — BOTH FORMULAS BELOW NEED IT:
   Schedule II assumes a 5% default residual (salvage) value unless a
   company specifies otherwise; `defaultResidualValue()` below returns
   that 5% starting point for a create form to pre-fill, genuinely
   editable, not hard-coded into the computation itself.

   METHOD IS CHOSEN PER ASSET, NOT ONE COMPANY-WIDE POLICY — A DELIBERATE,
   JUSTIFIED CALL: real companies commonly run Straight-Line for one
   class of asset (Buildings) and Written-Down-Value for another (Plant &
   Machinery) within the SAME set of books — a single company-wide switch
   would misrepresent how depreciation policy actually works. This is the
   same "policy lives on the individual record, not a global setting"
   shape Salary Structure already established (each employee's own
   structure, not one company-wide pay formula).

   BOTH FORMULAS BELOW ARE THE REAL SCHEDULE II ONES, NODE-VERIFIED
   AGAINST HAND-TRACED NUMBERS BEFORE THIS FILE SHIPPED — THE SAME
   RIGOR STOCK VALUATION'S OWN FIFO ENGINE GOT:
     Straight-Line annual charge = (cost - residual) / usefulLifeYears
     Written-Down-Value annual RATE = 1 - (residual / cost) ^ (1 / usefulLifeYears)
   The WDV formula is the actual Schedule II, Part C, Note 3 formula —
   not a guessed flat percentage — and was hand-verified to bring a
   test asset's own book value down to EXACTLY its residual value after
   its full useful life (a 5-year, 5%-residual asset lands on a ~45.07%
   annual rate; traced year by year in Node, it closes at precisely the
   residual, to the cent). `data/depreciation-run-data.js` derives the
   actual MONTHLY charge from these two annual figures — see that file's
   own header for the (also Node-verified, and less obvious than it
   first looks) monthly-equivalent-rate math for WDV specifically.

   ACCUMULATED DEPRECIATION AND NET BOOK VALUE ARE LIVE-COMPUTED, NEVER
   STORED ON THE ASSET ITSELF — the same "computed rollup, not a
   redundant stored field" discipline Item Master's own
   `getLiveCurrentStock()` and Work Order's own WIP rollups already
   established. `getAccumulatedDepreciation()` sums every POSTED
   (Processed, non-Cancelled) Depreciation Run's own line for this asset,
   plus a Disposed asset's own final captured charge if it has one — see
   asset-disposal-data.js's own header for why that final charge lives on
   the disposal record itself rather than as a synthetic Depreciation Run
   line.

   DUPLICATE CHECK: NOT APPLICABLE, NAMED EXPLICITLY — A COMPANY ROUTINELY
   OWNS SEVERAL ASSETS WITH THE SAME NAME (ten identical office chairs,
   three identical laptops bought the same day) — the same "not a
   duplicate, a normal repeat" reasoning Vendor Evaluation and Payment
   Collection both already established for their own repeat-is-normal
   cases, applied here to a master-data record instead of a transactional
   one for the first time.
   ========================================================================== */

const ERP_ASSET_KEY = "erp_fixed_assets";
const ERP_ASSET_STATUSES = ["Active", "Disposed"];
const ERP_ASSET_METHODS = ["Straight-Line", "Written-Down-Value"];
const ERP_ASSET_CATEGORIES = [
  "Land", "Buildings", "Plant & Machinery", "Furniture & Fixtures",
  "Vehicles", "Office Equipment", "Computers", "Intangible Assets"
];

const ERP_AssetRepository = {
  statuses: ERP_ASSET_STATUSES,
  methods: ERP_ASSET_METHODS,
  categories: ERP_ASSET_CATEGORIES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_ASSET_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_ASSET_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((a) => a.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getActiveForCompany(companyId) {
    return this.getAllForCompany(companyId).filter((a) => a.status === "Active");
  },

  findById(id) {
    return this.getAll().find((a) => a.id === id) || null;
  },

  /** AST-01, AST-02, ... per company. */
  nextAssetCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((a) => {
      const match = /-AST-(\d+)$/.exec(a.assetCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-AST-${String(max + 1).padStart(2, "0")}`;
  },

  defaultResidualValue(acquisitionCost) {
    return Math.round((Number(acquisitionCost) || 0) * 0.05 * 100) / 100;
  },

  /** Annual figures only — see file header. Returns
      { annualCharge, annualRate } (one or the other populated depending
      on method; the unused one is 0). depreciation-run-data.js derives
      the actual monthly charge from whichever applies. */
  computeAnnualDepreciation(asset) {
    const cost = Number(asset.acquisitionCost) || 0;
    const residual = Number(asset.residualValue) || 0;
    const life = Number(asset.usefulLifeYears) || 0;
    if (life <= 0 || cost <= residual) return { annualCharge: 0, annualRate: 0 };
    if (asset.depreciationMethod === "Straight-Line") {
      return { annualCharge: (cost - residual) / life, annualRate: 0 };
    }
    return { annualCharge: 0, annualRate: 1 - Math.pow(residual / cost, 1 / life) };
  },

  /** Sum of every POSTED Depreciation Run's own line for this asset, plus
      a Disposed asset's own final captured charge (see asset-disposal-
      data.js). Live, never stored — see file header. */
  getAccumulatedDepreciation(companyId, assetId) {
    let total = 0;
    if (typeof ERP_DepreciationRunRepository !== "undefined") {
      ERP_DepreciationRunRepository.getAllForCompany(companyId)
        .filter((r) => r.status === "Processed")
        .forEach((r) => {
          const line = (r.lines || []).find((l) => l.assetId === assetId);
          if (line) total += Number(line.chargeAmount) || 0;
        });
    }
    if (typeof ERP_AssetDisposalRepository !== "undefined") {
      const disposal = ERP_AssetDisposalRepository.getAllForCompany(companyId)
        .find((d) => d.assetId === assetId && d.status === "Disposed");
      if (disposal) total += Number(disposal.finalDepreciationCharge) || 0;
    }
    return total;
  },

  getNetBookValue(companyId, asset) {
    const cost = Number(asset.acquisitionCost) || 0;
    return cost - this.getAccumulatedDepreciation(companyId, asset.id);
  },

  create(company, data, actorUsername) {
    const record = {
      id: "AST-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      assetCode: this.nextAssetCode(company),
      assetName: data.assetName,
      assetCategory: data.assetCategory,
      acquisitionDate: data.acquisitionDate,
      acquisitionCost: Number(data.acquisitionCost) || 0,
      residualValue: Number(data.residualValue) || 0,
      usefulLifeYears: Number(data.usefulLifeYears) || 0,
      depreciationMethod: data.depreciationMethod,
      departmentId: data.departmentId || null,
      notes: data.notes || "",
      status: "Active",
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString()
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Only while Active AND before any depreciation has ever been posted
      against it — once a Depreciation Run has used this asset's own
      cost/residual/life/method to compute a real, posted figure,
      changing those fields out from under it would silently corrupt
      every subsequent run's own accumulated-depreciation math. Editing
      an already-depreciated asset means correcting it going forward
      through a fresh Asset Disposal + a new Asset Register entry, not a
      silent rewrite — the same "correction is a new record" principle
      Stock Ledger's own header already established. */
  canEdit(companyId, asset) {
    return asset.status === "Active" && this.getAccumulatedDepreciation(companyId, asset.id) === 0;
  },
  update(companyId, id, partial, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((a) => a.id === id);
    if (idx === -1 || !this.canEdit(companyId, all[idx])) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString(), updatedByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  /** Called by asset-disposal-data.js at disposal time — nowhere else. */
  markDisposed(id) {
    const all = this.getAll();
    const idx = all.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], status: "Disposed" };
    this._saveAll(all);
    return all[idx];
  },

  /** Only if nothing has ever been posted against it — the same guard
      as canEdit, for the same reason. */
  remove(companyId, id) {
    const all = this.getAll();
    const asset = all.find((a) => a.id === id);
    if (!asset || !this.canEdit(companyId, asset)) return false;
    this._saveAll(all.filter((a) => a.id !== id));
    return true;
  }
};
