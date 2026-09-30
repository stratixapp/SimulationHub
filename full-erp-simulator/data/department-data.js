/* =============================================================================
   DOT ERP
   FILE:  data/department-data.js
   ROLE:  Data-access layer for Departments — Phase 2, Module 07.

   Unlike Financial Year, Currency, GST Details or Branches, no earlier
   module has touched departments — there is nothing to sync from, so this
   file has no `ensureX()` anchor call. It's the first genuinely standalone
   Phase 2 master list, and the first one with real HIERARCHY: a department
   can have a parent department, which means this file has to solve the
   problems every real org-chart tool solves — no cycles, safe deletion,
   and rollups that don't double-count.

   HIERARCHY RULES:
   - `parentId: null` means a top-level (root) department.
   - A department can never become its own ancestor. wouldCreateCycle()
     is the guard every parent re-assignment must pass through.
   - A department with children cannot be deleted — real ERPs refuse this
     for the same reason a filesystem refuses to delete a non-empty folder
     without -r: it would silently orphan everything underneath.
   - Budget/headcount ROLLUP (own + every descendant's own) is only ever
     computed for ONE department's subtree at a time. A company-WIDE total
     is a flat sum across all departments instead — summing every
     department's own rollup would double-count every parent's numbers
     once for itself and again inside each child's rollup. Keep this
     distinction in the UI, not just in this file.
   ========================================================================== */

const ERP_DEPARTMENTS_KEY = "erp_departments";

const ERP_DepartmentRepository = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_DEPARTMENTS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_DEPARTMENTS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** Root departments first (alphabetically), each followed immediately by
      its own descendants (also alphabetical) — a stable, readable order
      that works equally well for the flat table and the tree view. */
  getAllForCompany(companyId) {
    const mine = this.getAll().filter((d) => d.companyId === companyId);
    const byParent = new Map();
    mine.forEach((d) => {
      const key = d.parentId || "__root__";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(d);
    });
    byParent.forEach((list) => list.sort((a, b) => a.deptName.localeCompare(b.deptName)));

    const ordered = [];
    const walk = (parentKey) => {
      (byParent.get(parentKey) || []).forEach((d) => { ordered.push(d); walk(d.id); });
    };
    walk("__root__");
    return ordered;
  },

  findById(id) {
    return this.getAll().find((d) => d.id === id) || null;
  },

  getRootDepartments(companyId) {
    return this.getAllForCompany(companyId).filter((d) => !d.parentId);
  },

  getChildren(companyId, id) {
    return this.getAllForCompany(companyId).filter((d) => d.parentId === id);
  },

  /** Every department beneath `id`, at any depth (BFS). */
  getDescendants(companyId, id) {
    const all = this.getAllForCompany(companyId);
    const result = [];
    let frontier = [id];
    while (frontier.length) {
      const nextFrontier = [];
      all.forEach((d) => {
        if (frontier.includes(d.parentId)) { result.push(d); nextFrontier.push(d.id); }
      });
      frontier = nextFrontier;
    }
    return result;
  },

  /** Path from root down to (but not including) `id` — for breadcrumbs. */
  getAncestors(companyId, id) {
    const dept = this.findById(id);
    if (!dept || !dept.parentId) return [];
    const parent = this.findById(dept.parentId);
    if (!parent) return [];
    return [...this.getAncestors(companyId, parent.id), parent];
  },

  /** True if setting `deptId`'s parent to `proposedParentId` would create a
      cycle — i.e. the proposed parent IS `deptId` itself, or is already one
      of `deptId`'s own descendants. This is the one check every parent
      re-assignment (create excluded, since a brand-new department has no
      descendants yet) must pass before saving. */
  wouldCreateCycle(companyId, deptId, proposedParentId) {
    if (!proposedParentId) return false;
    if (proposedParentId === deptId) return true;
    const descendantIds = this.getDescendants(companyId, deptId).map((d) => d.id);
    return descendantIds.includes(proposedParentId);
  },

  /** This department's own budget/headcount plus every descendant's own —
      the subtree total. Deliberately NOT used for a company-wide total;
      see the file header for why. */
  getBudgetRollup(companyId, id) {
    const dept = this.findById(id);
    if (!dept) return 0;
    const descendants = this.getDescendants(companyId, id);
    return [dept, ...descendants].reduce((sum, d) => sum + (Number(d.annualBudget) || 0), 0);
  },
  getHeadcountRollup(companyId, id) {
    const dept = this.findById(id);
    if (!dept) return 0;
    const descendants = this.getDescendants(companyId, id);
    return [dept, ...descendants].reduce((sum, d) => sum + (Number(d.headcount) || 0), 0);
  },

  /** COMP-001-DEPT-01, COMP-001-DEPT-02, ... — same per-company, never-reused
      numbering convention every other Phase 2 module already established. */
  nextDeptCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((d) => {
      const match = /-DEPT-(\d+)$/.exec(d.deptCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-DEPT-${String(max + 1).padStart(2, "0")}`;
  },

  create(company, data) {
    const record = {
      id: "DEPT-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      deptCode: this.nextDeptCode(company),
      parentId: null,
      branchId: null,
      status: "Active",
      annualBudget: 0,
      headcount: 0,
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
    const idx = all.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  toggleStatus(id) {
    const dept = this.findById(id);
    if (!dept) return null;
    return this.update(id, { status: dept.status === "Active" ? "Inactive" : "Active" });
  },

  /** Refuses to delete a department that still has children — same reason
      a real ERP does: it would silently orphan every department beneath
      it. The caller (UI) is expected to check hasChildren() first and
      explain this rather than relying on a bare `false` return. */
  hasChildren(companyId, id) {
    return this.getChildren(companyId, id).length > 0;
  },

  remove(id, companyId) {
    if (this.hasChildren(companyId, id)) return false;
    const all = this.getAll().filter((d) => d.id !== id);
    this._saveAll(all);
    return true;
  },

  hasDuplicateName(companyId, deptName, excludeId) {
    const target = deptName.trim().toLowerCase();
    return this.getAllForCompany(companyId).some((d) => d.id !== excludeId && d.deptName.trim().toLowerCase() === target);
  }
};
