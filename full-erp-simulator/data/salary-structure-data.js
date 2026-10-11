/* =============================================================================
   DOT ERP
   FILE:  data/salary-structure-data.js
   ROLE:  Data-access layer for Salary Structure — Phase 9, Module 03.
          Genuine storage (`erp_salary_structures`) — a pay structure is a
          real, independent fact (what someone is actually paid), the same
          reasoning behind every other genuine-storage module.

   MULTIPLE RECORDS PER EMPLOYEE IS THE NORMAL, GOOD OUTCOME — NOT
   SOMETHING TO PREVENT: when an employee gets a raise, real HR practice
   creates a NEW structure with a later `effectiveFrom`, and keeps the OLD
   one on file — Payroll runs for past months still need the structure
   that was actually in effect THEN, not today's. What genuinely needs
   preventing is two structures for the SAME employee sharing the exact
   SAME `effectiveFrom` date, which would leave "which one applies from
   that day" ambiguous — a real resolution #7 case (hard uniqueness on a
   composite key, the same shape Opening Stock's own (itemId, warehouseId)
   uniqueness uses), applied here to (employeeId, effectiveFrom) instead.

   NO SEPARATE effectiveTo FIELD, ON PURPOSE: a structure is implicitly in
   effect from its own `effectiveFrom` until the NEXT structure's own
   `effectiveFrom` for the same employee (exclusive), or indefinitely if
   it's the latest one. Storing an explicit `effectiveTo` alongside would
   let the two dates drift out of sync with each other (edit one, forget
   the other) — `getEffectiveStructure()` below derives the answer live
   instead, the same "don't store what you can derive" instinct behind
   Item Master's own live `currentStock`.

   CANCEL NEVER CORRUPTS PAST PAYROLL HISTORY, SO IT NEEDS NO USAGE
   GUARD: Bank Master refuses to let a referenced record be removed
   because OTHER records keep pointing at it live. Salary Structure is
   different — Payroll (Module 04) freezes every computed figure
   (earnings, deductions, net pay) onto its own payslip line at the
   moment a run is Processed, the same "resolve once, freeze, don't
   re-derive later" shape Sales Order's own copied fields use. So
   Cancelling a structure that was already used in a past run changes
   nothing about that run's own already-frozen numbers — it only stops
   FUTURE payroll runs from resolving to it. `cancel()` below is
   unconditional, on purpose, not a gap.

   HRA% AND PF% ARE EDITABLE, NOT HARDCODED CONSTANTS — REAL VARIATION,
   NOT JUST A UI NICETY: Indian HRA convention genuinely varies (a common
   50% of Basic in metro cities, 40% elsewhere), and PF's own 12% is a
   statutory default that some structures still need to override. Both
   ship with a sensible default on a new structure but stay real,
   editable fields. Professional Tax and TDS are deliberately flat,
   manually-entered figures, not computed — real Indian Professional Tax
   varies by state and salary slab, and real TDS needs full income-tax
   slab computation; modeling either properly is genuinely out of scope
   for this simulator (the same honest scope cut GST Summary's own
   `netTax` simplification made in Phase 8), so both are just numbers HR
   types in directly rather than a fabricated computation dressed up as
   one.
   ========================================================================== */

const ERP_SALARY_STRUCTURE_KEY = "erp_salary_structures";

const ERP_SalaryStructureRepository = {

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_SALARY_STRUCTURE_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_SALARY_STRUCTURE_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((s) => s.companyId === companyId)
      .sort((a, b) => (b.effectiveFrom || "").localeCompare(a.effectiveFrom || ""));
  },

  getAllForEmployee(companyId, employeeId) {
    return this.getAllForCompany(companyId).filter((s) => s.employeeId === employeeId);
  },

  findById(id) {
    return this.getAll().find((s) => s.id === id) || null;
  },

  /** True if `employeeId` already has ANY structure (any status) with
      this exact `effectiveFrom` — see file header for why this is the
      one real uniqueness rule here. */
  hasDuplicateEffectiveDate(companyId, employeeId, effectiveFrom, excludeId) {
    return this.getAllForEmployee(companyId, employeeId).some((s) => s.id !== excludeId && s.effectiveFrom === effectiveFrom);
  },

  /** All the derived pay figures for a structure — never stored, always
      computed from the four real inputs (basic, hraPercent,
      specialAllowance, pfPercent, professionalTax, tds). */
  computeFigures(structure) {
    const basic = Number(structure.basic) || 0;
    const hraAmount = basic * (Number(structure.hraPercent) || 0) / 100;
    const specialAllowance = Number(structure.specialAllowance) || 0;
    const grossEarnings = basic + hraAmount + specialAllowance;

    const pfAmount = basic * (Number(structure.pfPercent) || 0) / 100;
    const professionalTax = Number(structure.professionalTax) || 0;
    const tds = Number(structure.tds) || 0;
    const totalDeductions = pfAmount + professionalTax + tds;

    return { basic, hraAmount, specialAllowance, grossEarnings, pfAmount, professionalTax, tds, totalDeductions, netPay: grossEarnings - totalDeductions };
  },

  /** Creates a new Active structure. Refuses (returns null) if
      (employeeId, effectiveFrom) already exists for this employee — the
      page is expected to check `hasDuplicateEffectiveDate()` itself
      first for a clear message rather than a silent null. */
  create(company, data) {
    if (this.hasDuplicateEffectiveDate(company.id, data.employeeId, data.effectiveFrom)) return null;

    const record = {
      id: "SAL-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      employeeId: data.employeeId,
      effectiveFrom: data.effectiveFrom,
      basic: Number(data.basic) || 0,
      hraPercent: data.hraPercent === "" || data.hraPercent === undefined ? 40 : Number(data.hraPercent),
      specialAllowance: Number(data.specialAllowance) || 0,
      pfPercent: data.pfPercent === "" || data.pfPercent === undefined ? 12 : Number(data.pfPercent),
      professionalTax: data.professionalTax === "" || data.professionalTax === undefined ? 200 : Number(data.professionalTax),
      tds: Number(data.tds) || 0,
      status: "Active",
      createdAt: new Date().toISOString(),
      createdByUsername: data.createdByUsername || "system"
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Unconditional — see file header for why this needs no usage guard. */
  cancel(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  /** The Active structure in effect for `employeeId` on `asOfDate` — the
      latest `effectiveFrom` that is on or before `asOfDate`, among
      structures never Cancelled. Returns null if the employee has no
      structure at all as of that date (a new hire whose structure
      predates their own joining paperwork, or one who's never had a
      structure entered at all — Payroll is expected to skip such an
      employee from a run rather than fabricate a structure for them). */
  getEffectiveStructure(companyId, employeeId, asOfDate) {
    const candidates = this.getAllForEmployee(companyId, employeeId)
      .filter((s) => s.status === "Active" && s.effectiveFrom <= asOfDate)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    return candidates[0] || null;
  }
};
