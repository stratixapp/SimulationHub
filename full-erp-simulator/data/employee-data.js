/* =============================================================================
   DOT ERP
   FILE:  data/employee-data.js
   ROLE:  Data-access layer for Employee Master — Phase 3, Module 01 (the
          first Master Data module, and the first module other Phase 2
          modules now reach BACKWARD to reference — see the retrofit note
          near the bottom of this file).

   FLAT LIST, BUT WITH A REAL SELF-REFERENTIAL HIERARCHY —
   Employee Master is a flat table (like Cost Centers/Warehouses), NOT a
   tree page — organizational structure already belongs to Departments.
   But "who reports to whom" is a genuine hierarchy in its own right (a
   reporting LINE is a different concept from an org UNIT — a person's
   manager doesn't have to sit in the same department in every real
   company), so `managerId` gets the full Departments-style tree treatment:
   getDirectReports/getAllReports (BFS descendants)/getManagerChain
   (ancestors) and a wouldCreateManagerCycle guard on every reassignment —
   the exact same shape as Departments' parentId machinery, just renamed
   for a person-reports-to-person relationship instead of a department-
   nests-under-department one. hasDirectReports() blocks deletion outright,
   the same "refuse, don't just warn" rule Departments uses for hasChildren
   — deleting a manager out from under their team would leave every direct
   report's `managerId` dangling, exactly the structural integrity problem
   Departments' own guard exists to prevent.

   WHY THE DUPLICATE CHECK IS ON EMAIL, NOT NAME —
   Every earlier module's duplicate check has been on its record's NAME
   (department name, cost center name, warehouse name) because those names
   are meant to be unique identifiers within a company. A person's NAME is
   not — two employees can genuinely both be named "Rahul Sharma," and a
   duplicate-name check would incorrectly block the second one. Work Email
   is the field that actually must be unique per person in a real HRIS, so
   hasDuplicateEmail() is what create/update validation should call
   instead of a name check. This is a deliberate departure from every
   earlier module's pattern, not an oversight.

   TENURE IS A DERIVED FACT, LIKE COST CENTERS' isExpired() —
   getTenure() computes years/months worked from dateOfJoining through
   dateOfExit (or today, if still employed) — never stored, always
   recomputed, the same "derive it, don't store a fact that would go stale"
   principle as isExpired().

   THE RETROFIT: OLDER MODULES NOW REACH FORWARD INTO THIS FILE —
   Cost Centers' "Responsible Person" and Warehouses' "Warehouse Manager"
   were originally free-text name fields with a comment saying Phase 3
   would eventually let them link to a real employee. Now that this file
   exists, both of those modules gained an optional `responsibleEmployeeId`
   / `managerEmployeeId` field alongside their original free-text field
   (kept as a fallback for anyone genuinely not in Employee Master yet —
   an external consultant, a not-yet-onboarded hire). Both resolve the
   DISPLAY name live from here via findById(), the same "look it up, don't
   copy" rule Warehouses already uses for its branch address — see
   cost-center-data.js's getResponsiblePersonLabel() and warehouse-
   data.js's getManagerLabel(). Employee Master itself has NO dependency
   the other direction — this file never imports from cost-center-data.js
   or warehouse-data.js, keeping the dependency graph one-way.
   ========================================================================== */

const ERP_EMPLOYEES_KEY = "erp_employees";

const ERP_EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Intern", "Consultant"];

function erpEmpTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}


const ERP_EmployeeRepository = {
  employmentTypes: ERP_EMPLOYMENT_TYPES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_EMPLOYEES_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_EMPLOYEES_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((e) => e.companyId === companyId)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  findById(id) {
    return this.getAll().find((e) => e.id === id) || null;
  },

  /** COMP-001-EMP-01, COMP-001-EMP-02, ... — same per-company, never-reused
      numbering convention every other Phase 2/3 module established. */
  nextEmployeeCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((e) => {
      const match = /-EMP-(\d+)$/.exec(e.employeeCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-EMP-${String(max + 1).padStart(2, "0")}`;
  },

  /** Direct reports only — one level down. */
  getDirectReports(companyId, id) {
    return this.getAllForCompany(companyId).filter((e) => e.managerId === id);
  },

  /** Every employee beneath `id` in the reporting line, at any depth (BFS) —
      the same shape as Departments' getDescendants. */
  getAllReports(companyId, id) {
    const all = this.getAllForCompany(companyId);
    const result = [];
    let frontier = [id];
    while (frontier.length) {
      const nextFrontier = [];
      all.forEach((e) => {
        if (frontier.includes(e.managerId)) { result.push(e); nextFrontier.push(e.id); }
      });
      frontier = nextFrontier;
    }
    return result;
  },

  /** Path from the top of the chain down to (but not including) `id` — the
      same shape as Departments' getAncestors, useful for showing a
      "Reporting Line" breadcrumb in the Detail view. */
  getManagerChain(companyId, id) {
    const emp = this.findById(id);
    if (!emp || !emp.managerId) return [];
    const manager = this.findById(emp.managerId);
    if (!manager) return [];
    return [...this.getManagerChain(companyId, manager.id), manager];
  },

  /** True if setting `id`'s manager to `proposedManagerId` would create a
      cycle — the proposed manager IS `id` itself, or is already one of
      `id`'s own reports (direct or indirect). Every manager reassignment
      must pass this before saving (a brand-new employee is exempt — they
      have no reports yet to cycle back through). */
  wouldCreateManagerCycle(companyId, id, proposedManagerId) {
    if (!proposedManagerId) return false;
    if (proposedManagerId === id) return true;
    const reportIds = this.getAllReports(companyId, id).map((e) => e.id);
    return reportIds.includes(proposedManagerId);
  },

  hasDirectReports(companyId, id) {
    return this.getDirectReports(companyId, id).length > 0;
  },

  /** Years/months worked, from Date of Joining through Date of Exit (or
      through today, if still employed) — a derived fact, recomputed every
      call, the same principle as Cost Centers' isExpired(). Returns null
      if there's no join date to measure from at all. */
  getTenure(employee, todayISO) {
    if (!employee.dateOfJoining) return null;
    const start = new Date(employee.dateOfJoining + "T00:00:00");
    const endDateStr = employee.dateOfExit || todayISO || erpEmpTodayISO();
    const end = new Date(endDateStr + "T00:00:00");
    let totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) totalMonths -= 1;
    totalMonths = Math.max(0, totalMonths);
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    const label = years > 0 ? `${years}y ${months}m` : `${months}m`;
    return { years, months, totalMonths, label, asOf: employee.dateOfExit ? "exit" : "today" };
  },

  create(company, data) {
    const record = {
      id: "EMP-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      employeeCode: this.nextEmployeeCode(company),
      status: "Active",
      departmentId: null,
      branchId: null,
      managerId: null,
      dateOfExit: null,
      phone: "",
      notes: "",
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
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Active / On Leave / Inactive — a genuine three-state lifecycle, the
      same reasoning as Cost Centers' Active/Blocked/Inactive: On Leave is
      temporary and reversible, Inactive means the person has actually
      exited. Collapsing "on leave" into "inactive" would lose a real,
      common distinction, exactly the mistake Cost Centers' Help Guide
      already warns against for Blocked vs. Inactive. */
  setStatus(id, status) {
    return this.update(id, { status });
  },

  /** Refuses outright while the employee still has direct reports — the
      same "don't orphan the structure" rule as Departments' hasChildren
      guard (same `remove(id, companyId)` signature and boolean return,
      too), applied to a reporting line instead of an org-unit tree.
      Deliberately does NOT check Cost Centers'/Warehouses' soft
      responsibleEmployeeId/managerEmployeeId references — those are
      informational tags that already degrade gracefully to "—" if the
      linked employee disappears (see those files' getResponsiblePerson-
      Label/getManagerLabel), not structural relationships that would
      leave anything orphaned. */
  remove(id, companyId) {
    if (this.hasDirectReports(companyId, id)) return false;
    const all = this.getAll().filter((e) => e.id !== id);
    this._saveAll(all);
    return true;
  },

  hasDuplicateEmail(companyId, email, excludeId) {
    const target = String(email || "").trim().toLowerCase();
    if (!target) return false;
    return this.getAllForCompany(companyId).some((e) => e.id !== excludeId && (e.workEmail || "").trim().toLowerCase() === target);
  }
};
