/* =============================================================================
   DOT ERP
   FILE:  data/cost-center-data.js
   ROLE:  Data-access layer for Cost Centers — Phase 2, Module 08.

   WHY THIS ONE IS FLAT, NOT A TREE (unlike Departments, Module 07):
   Real cost accounting (SAP CO is the clearest example) keeps individual
   cost centers as flat, leaf-level entities — it's separate "Cost Center
   Groups" that carry hierarchy, layered ON TOP of a flat cost center list,
   not baked into the cost centers themselves. Reusing Department's tree
   machinery here would be modeling the wrong thing. Instead, cost centers
   are grouped by a fixed CATEGORY (Production / Sales & Distribution /
   Administration / R&D / Service & Support — the same kind of controlled
   vocabulary Currency used for rate slabs and GST Details used for rate
   slabs), and can optionally link to a Department and/or a Branch, the
   same "store the id, look it up live" pattern Departments used for its
   Branch link.

   THE REAL DEPTH HERE IS VARIANCE, VALIDITY, AND A THREE-STATE LIFECYCLE:
   - Every cost center has a validity window (validFrom, optional validTo) —
     a genuine SAP CO concept. A cost center past its validTo is EXPIRED,
     which is a derived fact (isExpired()), independent of and layered on
     top of whatever status is manually set — exactly like a real system
     enforces time-based validity separately from a manual flag.
   - Active / Blocked / Inactive, not just Active/Inactive: Blocked means
     "temporarily can't receive new postings, under review" — different
     from Inactive's "permanently retired." Confusing the two is a real,
     common mistake and worth teaching.
   - Budget vs. Actual isn't just two numbers side by side — getVariance()
     computes the gap and utilization %, and getUtilizationBand() turns
     that into an under/near/over-budget classification the UI can color.
   ========================================================================== */

const ERP_COST_CENTERS_KEY = "erp_cost_centers";

const ERP_COST_CENTER_CATEGORIES = [
  "Production", "Sales & Distribution", "Administration", "Research & Development", "Service & Support"
];

function erpCcTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}


const ERP_CostCenterRepository = {
  categories: ERP_COST_CENTER_CATEGORIES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_COST_CENTERS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_COST_CENTERS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((c) => c.companyId === companyId)
      .sort((a, b) => a.ccName.localeCompare(b.ccName));
  },

  findById(id) {
    return this.getAll().find((c) => c.id === id) || null;
  },

  /** COMP-001-CC-01, COMP-001-CC-02, ... — same per-company numbering every
      other Phase 2 module already established. */
  nextCcCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((c) => {
      const match = /-CC-(\d+)$/.exec(c.ccCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-CC-${String(max + 1).padStart(2, "0")}`;
  },

  /** True if this cost center's validity window has already ended — a fact
      derived from its dates, independent of whatever `status` says. A cost
      center can be "Active" and expired at the same time; the UI should
      show both, not silently pick one. */
  isExpired(cc, todayISO) {
    const today = todayISO || erpCcTodayISO();
    return !!cc.validTo && cc.validTo < today;
  },

  /** RETROFIT (Phase 3, Module 1): resolves the display name for this cost
      center's responsible person. Prefers the live-looked-up Employee
      Master record if `responsibleEmployeeId` is linked — appending the
      employee's status when it isn't Active, so an outdated assignment
      (someone who's since gone On Leave or exited) doesn't read as though
      nothing's changed. Falls back to the free-text `responsiblePerson`
      field for anyone genuinely not in Employee Master yet. Never copies
      the name into this record — same "look it up, don't copy" rule
      Warehouses' getEffectiveAddress() already follows for branch
      addresses. */
  getResponsiblePersonLabel(cc) {
    if (cc.responsibleEmployeeId && typeof ERP_EmployeeRepository !== "undefined") {
      const emp = ERP_EmployeeRepository.findById(cc.responsibleEmployeeId);
      if (emp) return emp.status !== "Active" ? `${emp.fullName} (${emp.status})` : emp.fullName;
    }
    return cc.responsiblePerson || "—";
  },

  /** Budget vs. actual: the gap (positive = under budget, negative = over)
      and utilization as a percentage of budget already spent. Guards
      against a zero budget rather than dividing by it. */
  getVariance(cc) {
    const budget = Number(cc.annualBudget) || 0;
    const actual = Number(cc.actualSpend) || 0;
    const variance = budget - actual;
    const utilizationPct = budget > 0 ? (actual / budget) * 100 : (actual > 0 ? Infinity : 0);
    return { budget, actual, variance, utilizationPct };
  },

  /** Turns utilization % into a three-way band the UI can color:
      "under" (comfortably within budget), "near" (80-100%), "over" (100%+). */
  getUtilizationBand(cc) {
    const { utilizationPct } = this.getVariance(cc);
    if (utilizationPct > 100) return "over";
    if (utilizationPct >= 80) return "near";
    return "under";
  },

  create(company, data) {
    const record = {
      id: "CC-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      ccCode: this.nextCcCode(company),
      status: "Active",
      departmentId: null,
      branchId: null,
      responsibleEmployeeId: null,
      validTo: null,
      annualBudget: 0,
      actualSpend: 0,
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
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Active -> Blocked -> Active, or either -> Inactive -> Active. Blocked
      and Inactive are deliberately distinct states (see file header) so
      this takes an explicit target rather than just toggling one flag. */
  setStatus(id, status) {
    return this.update(id, { status });
  },

  /** No dependency protection needed yet — nothing else in Phase 2/3
      references a cost center by id, unlike Departments (which had to
      guard against orphaning children). Kept as its own method anyway so
      that if a later phase (Procurement/Sales cost allocation) needs to
      add a guard, there's one obvious place to add it. */
  remove(id) {
    const all = this.getAll().filter((c) => c.id !== id);
    this._saveAll(all);
    return true;
  },

  hasDuplicateName(companyId, ccName, excludeId) {
    const target = ccName.trim().toLowerCase();
    return this.getAllForCompany(companyId).some((c) => c.id !== excludeId && c.ccName.trim().toLowerCase() === target);
  }
};
