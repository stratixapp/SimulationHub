/* =============================================================================
   DOT ERP
   FILE:  data/quality-inspection-data.js
   ROLE:  Data-access layer for Quality Inspection — Phase 4, Module 15.
          GRN made the receipt formal and priced; this module is where
          someone actually judges whether what arrived is GOOD — the
          first genuine pass/fail decision anywhere in the receiving
          side of this chain.

   BUILT FROM ONE POSTED GRN, HEADER + INSPECTION LINES — SAME SHAPE,
   ONE GENUINE DIFFERENCE. `linkedGrnId` required, exclusive
   (`getLinkedGrnIds`/`getAvailablePostedGrnsForCompany`, the seventh
   instance of the exclusivity pattern this session — see
   CONTINUE_HERE.md Section 9). `inspectionLines[]` copies quantity from
   the GRN's own lines at creation time, same as every prior module — but
   ADDS a real split GRN never needed: `acceptedQuantity` and
   `rejectedQuantity`, independently entered per line (not just one
   overwritten number), because "how much arrived" and "how much passed"
   are genuinely different questions with genuinely different answers.
   A `rejectionReason` per line captures why, for whatever line has a
   nonzero rejected quantity.

   DELIBERATE SCOPING DECISION: QUALITY INSPECTION DOES **NOT** FEED
   FORWARD INTO THREE-WAY MATCHING'S MATH. The roadmap names Module 17
   "Three-Way Matching (PO vs GRN vs Invoice)" — GRN, not Quality
   Inspection — so Three-Way Matching (built later this session) checks
   quantities against the GRN's own `quantity` field, not this module's
   `acceptedQuantity`. This keeps Quality Inspection an independent
   quality-control record (useful on its own, browsable on its own)
   rather than a silent, easy-to-miss modifier of numbers another module
   trusts. If a future session decides Three-Way Matching SHOULD prefer
   accepted quantity when an inspection exists, that's a deliberate
   design change to make explicitly in that module's own file header, not
   something to assume by default.

   STATUS LIFECYCLE: SAME SIMPLE 3-STATE SHAPE AS EVERY OPERATIONAL
   RECORD THIS SESSION. `Draft -> Completed -> Cancelled` — no separate
   approval gate, because the pass/fail judgment IS the whole content of
   the record; there's nothing left for a second module to approve.
   Named `Completed` (not `Posted`/`Logged`/`Finalized`, all already used
   one hop away) to keep the vocabulary distinct per Section 9's own
   established discipline.
   ========================================================================== */

const ERP_QUALITY_INSPECTION_KEY = "erp_quality_inspections";

const ERP_QUALITY_INSPECTION_STATUSES = ["Draft", "Completed", "Cancelled"];

const ERP_QualityInspectionRepository = {
  statuses: ERP_QUALITY_INSPECTION_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_QUALITY_INSPECTION_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_QUALITY_INSPECTION_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((q) => q.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((q) => q.id === id) || null;
  },

  nextInspectionCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((q) => {
      const match = /-QI-(\d+)$/.exec(q.inspectionCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-QI-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(inspection) {
    return inspection.status === "Draft";
  },

  canDelete(inspection) {
    return inspection.status === "Draft" || inspection.status === "Cancelled";
  },

  /** Every rejected unit summed across a record's own lines — the
      headline number the table/detail views lead with. */
  computeTotalRejected(inspection) {
    return (inspection.inspectionLines || []).reduce((sum, l) => sum + (Number(l.rejectedQuantity) || 0), 0);
  },

  getLinkedGrnIds(companyId, excludeInspectionId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((q) => {
      if (q.id === excludeInspectionId || q.status === "Cancelled") return;
      if (q.linkedGrnId) ids.add(q.linkedGrnId);
    });
    return ids;
  },

  getAvailablePostedGrnsForCompany(companyId, excludeInspectionId) {
    if (typeof ERP_GrnRepository === "undefined") return [];
    const claimed = this.getLinkedGrnIds(companyId, excludeInspectionId);
    return ERP_GrnRepository.getAllForCompany(companyId)
      .filter((g) => g.status === "Posted" && !claimed.has(g.id));
  },

  /** The retrofit hook for GRN's own Detail modal. */
  findInspectionForGrn(companyId, grnId) {
    return this.getAllForCompany(companyId).find((q) =>
      q.status !== "Cancelled" && q.linkedGrnId === grnId
    ) || null;
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "QI-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      inspectionCode: this.nextInspectionCode(company),
      linkedGrnId: null,
      inspectedByEmployeeId: null,
      inspectionDate: null,
      inspectionLines: [],
      notes: "",
      status: "Draft",
      completedAt: null, completedByUsername: null,
      cancelledAt: null, cancelledByUsername: null,
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
    const idx = all.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Completed. No approval gate — see file header. */
  complete(id, actorUsername) {
    return this.update(id, { status: "Completed", completedAt: new Date().toISOString(), completedByUsername: actorUsername });
  },

  reopen(id) {
    return this.update(id, { status: "Draft", completedAt: null, completedByUsername: null });
  },

  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  remove(id) {
    const inspection = this.findById(id);
    if (!inspection || !this.canDelete(inspection)) return false;
    const all = this.getAll().filter((q) => q.id !== id);
    this._saveAll(all);
    return true;
  }
};
