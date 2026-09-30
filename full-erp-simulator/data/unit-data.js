/* =============================================================================
   DOT ERP
   FILE:  data/unit-data.js
   ROLE:  Data-access layer for Unit Master — Phase 3, Module 05. A small
          reference list of units of measure (Pcs, Kg, Box, ...) — simpler
          than Category Master, and deliberately flat, not a tree: a base-
          unit link is a single optional relationship, not a browsable
          hierarchy, so this module skips the Tree View / dept-tree reuse
          Category Master needed.

   SCOPE DECISION — LIGHTWEIGHT CONVERSIONS, NOT A FULL GRAPH:
   Real ERPs (Tally's "Compound Units", SAP's UoM dimension groups) track
   that e.g. 1 Box = 12 Pcs, so items bought in one unit can be received,
   stocked, or sold in another. That's genuinely useful — Item Master and
   later Inventory (Phase 6) will want it — so this file does NOT defer it
   entirely, but it deliberately keeps the shape minimal: each unit points
   to AT MOST ONE `baseUnitId` with a `conversionFactor` ("1 of me = factor
   of my base"), not a full many-to-many conversion table. Any two units
   that share the same ultimate base (walk each one's chain up to the root)
   can have a factor computed between them via getConversionFactor() — e.g.
   Box -> Pcs (12) and Dozen -> Pcs (12) lets Box <-> Dozen resolve to 1:1
   without a direct link between them — but two units in different chains
   (Kg vs. Pcs) correctly return null: weight and count aren't convertible,
   and this file won't pretend otherwise.

   This is structurally the same "walk a chain of single-parent pointers,
   guard against cycles" shape Departments'/Category Master's getAncestors
   already established, just applied to a base-unit link instead of an
   org/catalog parent — see wouldCreateCycle/getBaseChain below.

   UNIT TYPE (Count/Weight/Volume/Length/Area/Time/Other): a fixed,
   controlled vocabulary exposed as a plain array, the same pattern GST's
   rate slabs and Cost Centers' categories already use — and the guard a
   base-unit link should only ever be set within the SAME unit type (Box
   can base off Pcs, both Count; Kg should never base off Pcs).

   DUPLICATE CHECK — A FOURTH RESOLUTION TO SECTION 9'S LESSON:
   Unit Master hard-blocks BOTH unitName ("Kilogram") AND unitSymbol ("kg")
   independently. CONTINUE_HERE.md Section 9 documents three prior
   resolutions (hard-name-only; soft-name+hard-other-field; name skipped
   entirely for a different hard field) — this is a natural fourth, not a
   contradiction: unlike a vendor's name-vs-GSTIN (two DIFFERENT kinds of
   identifier, one internal and one government-issued), a unit's name and
   symbol are both internally curated and both genuinely meant to be
   unique on their own ("Kilogram" and "kg" each need to mean exactly one
   thing), so both get the same hard-block treatment Departments/Cost
   Centers/Warehouses/Category Master already apply to their one unique
   field. Case-insensitive on both, the same simplification every other
   duplicate check in this codebase already makes (this simulator doesn't
   attempt SI-rigor case-sensitivity, e.g. "Mg" vs. "mg").

   DELETE GUARD: refuses if any OTHER unit currently uses this one as its
   base (isBaseUnitOf) — deleting it would silently break that unit's own
   conversion. The same "don't orphan what points at you" reasoning as
   Departments'/Category Master's hasChildren, applied to a base-unit link
   instead of a parent-child tree.
   ========================================================================== */

const ERP_UNITS_KEY = "erp_units";

const ERP_UNIT_TYPES = ["Count", "Weight", "Volume", "Length", "Area", "Time", "Other"];

const ERP_UnitRepository = {
  unitTypes: ERP_UNIT_TYPES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_UNITS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_UNITS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((u) => u.companyId === companyId)
      .sort((a, b) => a.unitName.localeCompare(b.unitName));
  },

  findById(id) {
    return this.getAll().find((u) => u.id === id) || null;
  },

  /** Active units only — the contract Item Master's picker consumes,
      mirroring Category Master's getActiveForCompany. */
  getActiveForCompany(companyId) {
    return this.getAllForCompany(companyId).filter((u) => u.status === "Active");
  },

  /** COMP-001-UOM-01, COMP-001-UOM-02, ... */
  nextUnitCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((u) => {
      const match = /-UOM-(\d+)$/.exec(u.unitCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-UOM-${String(max + 1).padStart(2, "0")}`;
  },

  hasDuplicateName(companyId, unitName, excludeId) {
    const target = unitName.trim().toLowerCase();
    return this.getAllForCompany(companyId).some((u) => u.id !== excludeId && u.unitName.trim().toLowerCase() === target);
  },
  hasDuplicateSymbol(companyId, unitSymbol, excludeId) {
    const target = unitSymbol.trim().toLowerCase();
    return this.getAllForCompany(companyId).some((u) => u.id !== excludeId && u.unitSymbol.trim().toLowerCase() === target);
  },

  /** Walk the base-unit chain UP from `unitId` (not including itself),
      stopping safely if data is somehow already circular rather than
      looping forever — the cycle GUARD (wouldCreateCycle) is what's
      supposed to prevent that state from ever being saved in the first
      place, this is just a defensive backstop. */
  getBaseChain(companyId, unitId) {
    const chain = [];
    const seen = new Set([unitId]);
    let current = this.findById(unitId);
    while (current && current.baseUnitId) {
      if (seen.has(current.baseUnitId)) break; // corrupted data guard
      const next = this.findById(current.baseUnitId);
      if (!next) break;
      chain.push(next);
      seen.add(next.id);
      current = next;
    }
    return chain;
  },

  /** True if setting `unitId`'s base to `proposedBaseUnitId` would create a
      cycle — the proposed base IS the unit itself, or the proposed base's
      OWN chain eventually loops back to this unit. Same guard shape as
      Departments'/Category Master's wouldCreateCycle, applied to a single-
      parent chain instead of a full tree. */
  wouldCreateCycle(companyId, unitId, proposedBaseUnitId) {
    if (!proposedBaseUnitId) return false;
    if (proposedBaseUnitId === unitId) return true;
    return this.getBaseChain(companyId, proposedBaseUnitId).some((u) => u.id === unitId);
  },

  /** {unit, factor} of the ultimate (root) unit in this unit's base chain,
      and the cumulative multiplier from `unitId` down to that root — e.g.
      for Box -> Pcs(12), returns {unit: Pcs, factor: 12}. A unit with no
      base of its own is its own root (factor 1). */
  getUltimateBase(companyId, unitId) {
    const unit = this.findById(unitId);
    if (!unit) return null;
    let current = unit;
    let factor = 1;
    const seen = new Set([unit.id]);
    while (current.baseUnitId) {
      if (seen.has(current.baseUnitId)) break;
      const next = this.findById(current.baseUnitId);
      if (!next) break;
      factor *= Number(current.conversionFactor) || 1;
      current = next;
      seen.add(current.id);
    }
    return { unit: current, factor };
  },

  /** How many `toUnitId` make up one `fromUnitId` — null if the two units
      don't share a common ultimate base (e.g. Kg vs. Pcs: not convertible,
      and this deliberately returns null rather than guessing). */
  getConversionFactor(companyId, fromUnitId, toUnitId) {
    if (fromUnitId === toUnitId) return 1;
    const from = this.getUltimateBase(companyId, fromUnitId);
    const to = this.getUltimateBase(companyId, toUnitId);
    if (!from || !to || from.unit.id !== to.unit.id) return null;
    return from.factor / to.factor;
  },

  /** "1 Box = 12 Pcs" for display — "" if this unit has no base set. */
  describeConversion(unit) {
    if (!unit || !unit.baseUnitId) return "";
    const base = this.findById(unit.baseUnitId);
    if (!base) return "";
    return `1 ${unit.unitName} = ${Number(unit.conversionFactor) || 1} ${base.unitName}`;
  },

  /** Refuses to delete a unit that another unit still bases its own
      conversion on — same "don't orphan what points at you" reasoning as
      Departments'/Category Master's hasChildren. */
  isBaseUnitOf(companyId, id) {
    return this.getAllForCompany(companyId).some((u) => u.baseUnitId === id);
  },

  create(company, data) {
    const record = {
      id: "UOM-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      unitCode: this.nextUnitCode(company),
      unitType: "Count",
      baseUnitId: null,
      conversionFactor: 1,
      status: "Active",
      description: "",
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
    const idx = all.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  toggleStatus(id) {
    const unit = this.findById(id);
    if (!unit) return null;
    return this.update(id, { status: unit.status === "Active" ? "Inactive" : "Active" });
  },

  remove(id, companyId) {
    if (this.isBaseUnitOf(companyId, id)) return false;
    const all = this.getAll().filter((u) => u.id !== id);
    this._saveAll(all);
    return true;
  }
};
