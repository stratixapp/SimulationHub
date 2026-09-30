/* =============================================================================
   DOT ERP
   FILE:  data/hsn-data.js
   ROLE:  Data-access layer for HSN Master — Phase 3, Module 08. A company-
          maintained list of the HSN (goods) / SAC (services) classification
          codes the business actually uses on its invoices, each optionally
          carrying the GST rate that class of goods/services normally
          attracts — completing the chain Tax Master started: GST Details
          defines the legal rate slabs, Tax Master turns them into named
          codes, HSN Master says which code a given kind of product/service
          normally uses.

   REFERENCE LIST, DELIBERATELY NOT CURRENCY MASTER'S "PICK-ONLY" SHAPE —
   Currency Master's `referenceList`/`availableToAdd()` pattern (a curated,
   effectively-closed set of ~25 ISO currencies you can only ADD FROM, never
   type manually) is the obvious precedent here, and this file DOES reuse
   its shape — `ERP_HSN_REFERENCE_LIST` is exposed the same way, for a page
   to build a "pick a common code" convenience picker from. But it stops
   short of copying the CONSTRAINT: ISO currencies are a small, genuinely
   closed set (there really are only ~180 of them), while real HSN/SAC
   codes number in the thousands across every product category — no
   reference list this file could reasonably ship would be comprehensive,
   so unlike Currency Master, a code here does NOT have to come from the
   list. The reference list pre-fills Code/Description/Type as a
   convenience; typing a code that isn't in it is normal, expected use, not
   an edge case to guard against.

   HSN TYPE (Goods/Services): the same "Product vs. Service" split Category
   Master already made for its own domain (categoryType), renamed for HSN's
   own vocabulary (HSN codes classify goods; SAC codes classify services —
   both live in this one module rather than as two separate ones, since the
   roadmap only calls for a single "HSN Master").

   DEFAULT TAX CODE — THE RETROFIT PAYLOAD FOR ITEM MASTER: `defaultTax-
   CodeId` links to Tax Master (optional). getEffectiveTaxLabel() resolves
   it live, the standard "store the id, look it up live, degrade
   gracefully" convention every cross-module reference in this codebase
   follows. This is what makes Item Master's own retrofit (next) worth
   doing as a TWO-field pair rather than one: an item's own `taxCategoryId`
   override always wins if set, otherwise it falls back to whatever its
   linked HSN code's `defaultTaxCodeId` says — the same "own override wins,
   otherwise inherit from a linked record, resolved live every time" shape
   Vendor Master's getEffectivePaymentTerms()/Warehouses' getEffective-
   Address() already established, applied through one more hop.

   DUPLICATE CHECK: hsnCode is hard-blocked, company-wide — a business
   listing the same classification code twice in its own HSN Master is a
   data-entry mistake, not a legitimate scenario (unlike Tax Master's
   ratePct, where two DIFFERENT named codes at the same rate is normal).

   DELETE GUARD: none yet, for the same reason as Tax Master — nothing
   references an HSN record by id until Item Master's retrofit exists.
   ========================================================================== */

const ERP_HSN_CODES_KEY = "erp_hsn_codes";

const ERP_HSN_TYPES = ["Goods", "Services"];

/** A convenience shortlist spanning common goods (HSN) and services (SAC)
    codes — not exhaustive, not a closed set. `suggestedRatePct` is only a
    hint the page can use to suggest an existing Tax Master record at that
    rate (or prompt creating one) — it is NOT copied into the HSN record
    itself, which only ever stores a real `defaultTaxCodeId` once one
    exists. */
const ERP_HSN_REFERENCE_LIST = [
  { code: "1006", description: "Rice", hsnType: "Goods", suggestedRatePct: 5 },
  { code: "1905", description: "Bread, pastry, cakes, biscuits", hsnType: "Goods", suggestedRatePct: 18 },
  { code: "3004", description: "Medicaments (pharmaceutical products)", hsnType: "Goods", suggestedRatePct: 12 },
  { code: "3926", description: "Plastic articles", hsnType: "Goods", suggestedRatePct: 18 },
  { code: "4820", description: "Paper stationery — registers, notebooks, files", hsnType: "Goods", suggestedRatePct: 12 },
  { code: "6109", description: "T-shirts, singlets, knitted apparel", hsnType: "Goods", suggestedRatePct: 5 },
  { code: "7308", description: "Structures of iron or steel", hsnType: "Goods", suggestedRatePct: 18 },
  { code: "8471", description: "Computers and peripheral units", hsnType: "Goods", suggestedRatePct: 18 },
  { code: "8517", description: "Telephones, smartphones, network equipment", hsnType: "Goods", suggestedRatePct: 18 },
  { code: "9401", description: "Seats and furniture (office chairs etc.)", hsnType: "Goods", suggestedRatePct: 18 },
  { code: "9403", description: "Other furniture (tables, cabinets, racks)", hsnType: "Goods", suggestedRatePct: 18 },
  { code: "9503", description: "Toys and games", hsnType: "Goods", suggestedRatePct: 12 },
  { code: "998311", description: "Management consulting services", hsnType: "Services", suggestedRatePct: 18 },
  { code: "998313", description: "IT design and development services", hsnType: "Services", suggestedRatePct: 18 },
  { code: "996511", description: "Road transport of goods", hsnType: "Services", suggestedRatePct: 5 },
  { code: "997212", description: "Rental/leasing of commercial property", hsnType: "Services", suggestedRatePct: 18 },
  { code: "998619", description: "Other repair and maintenance services", hsnType: "Services", suggestedRatePct: 18 },
  { code: "999799", description: "Other professional/technical services n.e.c.", hsnType: "Services", suggestedRatePct: 18 }
];

/** Numeric only, 4-8 digits — real HSN codes run 2/4/6/8 digits and real
    SAC codes are 6 digits (conventionally starting "99"). This validates
    only the general shape, the same "structure, not a live registry"
    restraint GST Details' own GSTIN check already takes. */
const ERP_HSN_CODE_RE = /^[0-9]{4,8}$/;

const ERP_HsnRepository = {
  hsnTypes: ERP_HSN_TYPES,
  referenceList: ERP_HSN_REFERENCE_LIST,
  codePattern: ERP_HSN_CODE_RE,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_HSN_CODES_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_HSN_CODES_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((h) => h.companyId === companyId)
      .sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));
  },

  findById(id) {
    return this.getAll().find((h) => h.id === id) || null;
  },

  getActiveForCompany(companyId) {
    return this.getAllForCompany(companyId).filter((h) => h.status === "Active");
  },

  hasDuplicateCode(companyId, hsnCode, excludeId) {
    const target = hsnCode.trim();
    return this.getAllForCompany(companyId).some((h) => h.id !== excludeId && h.hsnCode.trim() === target);
  },

  /** Reference-list entries this company hasn't already added, by code —
      same shape as Currency Master's availableToAdd(), used purely as a
      convenience picker here (see file header — typing a code NOT in this
      list is equally valid). */
  availableToAdd(companyId) {
    const existingCodes = new Set(this.getAllForCompany(companyId).map((h) => h.hsnCode));
    return ERP_HSN_REFERENCE_LIST.filter((r) => !existingCodes.has(r.code));
  },

  /** The linked Tax Master record's name/rate for display — "—" if no
      default is set or the linked tax code no longer exists. */
  getEffectiveTaxLabel(hsn) {
    if (!hsn.defaultTaxCodeId || typeof ERP_TaxRepository === "undefined") return "—";
    const tax = ERP_TaxRepository.findById(hsn.defaultTaxCodeId);
    return tax ? `${tax.taxName} (${tax.ratePct}%)` : "—";
  },

  create(company, data) {
    const record = {
      id: "HSN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      hsnType: "Goods",
      defaultTaxCodeId: null,
      status: "Active",
      createdAt: new Date().toISOString(),
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((h) => h.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  toggleStatus(id) {
    const hsn = this.findById(id);
    if (!hsn) return null;
    return this.update(id, { status: hsn.status === "Active" ? "Inactive" : "Active" });
  },

  remove(id) {
    const all = this.getAll().filter((h) => h.id !== id);
    this._saveAll(all);
    return true;
  }
};
