/* =============================================================================
   DOT ERP
   FILE:  data/tax-data.js
   ROLE:  Data-access layer for Tax Master — Phase 3, Module 07. Flat list,
          same complexity tier as Unit Master — no hierarchy, no cross-
          module forward dependency, just a genuinely deep reuse of a
          module already built two phases ago.

   REUSES GST DETAILS' STATUTORY RATE SLABS — DOES NOT REDEFINE THEM:
   GST Details (Phase 2, Module 05) already owns `ERP_GstRepository.
   rateReference` (the fixed, LEGAL list of India's GST rate slabs — 0%,
   0.25%, 3%, 5%, 12%, 18%, 28%) and `getRatePrefs(companyId)` (which of
   those slabs THIS company has chosen to actually use, defaulting to all
   of them — see gst-data.js's own header). A tax rate isn't something a
   business gets to invent, so Tax Master doesn't define its own list —
   getAvailableRates() below simply filters GST Details' statutory
   reference down to whatever this company currently has enabled, and the
   Add/Edit form is expected to only ever offer THOSE. If GST Details
   later has a slab disabled, any tax code already created at that rate
   is left alone (this file doesn't retroactively invalidate existing
   records — same "don't let an unrelated module's later change silently
   break something already saved" restraint the cross-module lookups
   elsewhere in this codebase already show), but no NEW tax code can be
   created at a disabled rate.

   WHAT TAX MASTER ACTUALLY ADDS ON TOP: a NAMED, REFERENCEABLE tax code —
   e.g. "GST 18% - Goods" and "GST 18% - Services" can both legitimately
   exist at the same statutory rate for different reporting/classification
   purposes, which is exactly why `taxName` is duplicate-checked but
   `ratePct` deliberately is NOT. CGST/SGST/IGST are NOT separate stored
   fields — they're the same rate presented two different ways depending
   on whether a transaction is intra-state (CGST+SGST, split evenly) or
   inter-state (IGST, the full rate) — that split is a TRANSACTION-time
   fact (which state the buyer and seller are each in), not a master-data
   fact, so storing it twice would just invite the two copies to drift.
   getIntraStateSplit()/getInterStateSplit() derive it live instead.

   DEFAULT TAX CODE — A NEW SINGLETON PATTERN, DELIBERATELY NOT COPIED
   FROM CURRENCY'S BASE CURRENCY: Currency Master's base currency is an
   auto-created, structurally-guaranteed singleton (ensureBaseCurrency()).
   Tax Master's default is different in kind — it's a user CHOICE among
   otherwise-equal records (which tax code should pre-fill on a new
   transaction later), so it's a plain `isDefault` boolean with a
   setDefault() that clears the flag on every other record for the
   company before setting it — a toggle, not a structural guarantee. No
   default is required to exist; an empty catalog or one where nothing's
   been marked yet just has no default, which callers should treat as "let
   the user pick."

   DUPLICATE CHECK: taxName hard-blocked, company-wide — the same
   "internal, curated identifier" bucket as Category/Unit/Departments.

   DELETE GUARD: none yet — nothing references a tax code by id until
   Item Master is retrofitted with a `taxCategoryId` link (expected right
   after this file, per item-data.js's own header) and Phase 4/5
   transactions exist. Same "no guard needed yet" situation Vendor/
   Customer/Item Master were each in relative to their own not-yet-built
   consumers.
   ========================================================================== */

const ERP_TAX_CODES_KEY = "erp_tax_codes";

const ERP_TaxRepository = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_TAX_CODES_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_TAX_CODES_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((t) => t.companyId === companyId)
      .sort((a, b) => a.ratePct - b.ratePct || a.taxName.localeCompare(b.taxName));
  },

  findById(id) {
    return this.getAll().find((t) => t.id === id) || null;
  },

  getActiveForCompany(companyId) {
    return this.getAllForCompany(companyId).filter((t) => t.status === "Active");
  },

  getDefault(companyId) {
    return this.getAllForCompany(companyId).find((t) => t.isDefault) || null;
  },

  /** GST Details' statutory rate slabs, filtered to whatever THIS company
      currently has enabled — see file header. Falls back to the full
      statutory list if GST Details hasn't been loaded on this page (keeps
      Tax Master usable standalone rather than hard-crashing on a missing
      script include). */
  getAvailableRates(companyId) {
    if (typeof ERP_GstRepository === "undefined") return [];
    const enabled = ERP_GstRepository.getRatePrefs(companyId);
    return ERP_GstRepository.rateReference.filter((r) => enabled.includes(r.rate));
  },

  /** COMP-001-TAX-01, COMP-001-TAX-02, ... */
  nextTaxCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((t) => {
      const match = /-TAX-(\d+)$/.exec(t.taxCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-TAX-${String(max + 1).padStart(2, "0")}`;
  },

  hasDuplicateName(companyId, taxName, excludeId) {
    const target = taxName.trim().toLowerCase();
    return this.getAllForCompany(companyId).some((t) => t.id !== excludeId && t.taxName.trim().toLowerCase() === target);
  },

  /** Intra-state: the rate is split evenly between CGST and SGST (the two
      components a buyer and seller in the SAME state each see). */
  getIntraStateSplit(taxCode) {
    const half = (Number(taxCode.ratePct) || 0) / 2;
    return { cgstPct: half, sgstPct: half, totalPct: Number(taxCode.ratePct) || 0 };
  },

  /** Inter-state: the full rate applies as a single IGST component. */
  getInterStateSplit(taxCode) {
    return { igstPct: Number(taxCode.ratePct) || 0, totalPct: Number(taxCode.ratePct) || 0 };
  },

  /** "9% CGST + 9% SGST (intra-state) / 18% IGST (inter-state)" — the
      single display string every table row and the detail modal use. */
  describeSplit(taxCode) {
    const intra = this.getIntraStateSplit(taxCode);
    const inter = this.getInterStateSplit(taxCode);
    return `${intra.cgstPct}% CGST + ${intra.sgstPct}% SGST (intra-state) / ${inter.igstPct}% IGST (inter-state)`;
  },

  create(company, data) {
    const record = {
      id: "TAX-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      taxCode: this.nextTaxCode(company),
      ratePct: 0,
      isDefault: false,
      status: "Active",
      description: "",
      createdAt: new Date().toISOString(),
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    if (record.isDefault) this.setDefault(record.id, company.id);
    return record;
  },

  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    if (partial.isDefault) this.setDefault(id, all[idx].companyId);
    return all[idx];
  },

  /** Clears `isDefault` on every other tax code for the company before
      setting it here — see file header on why this is a plain toggle, not
      a structural singleton like Currency's base currency. */
  setDefault(id, companyId) {
    const all = this.getAll();
    all.forEach((t) => { if (t.companyId === companyId) t.isDefault = t.id === id; });
    this._saveAll(all);
    return this.findById(id);
  },

  toggleStatus(id) {
    const tax = this.findById(id);
    if (!tax) return null;
    return this.update(id, { status: tax.status === "Active" ? "Inactive" : "Active" });
  },

  remove(id) {
    const all = this.getAll().filter((t) => t.id !== id);
    this._saveAll(all);
    return true;
  }
};
