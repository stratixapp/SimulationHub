/* =============================================================================
   DOT ERP
   FILE:  data/category-data.js
   ROLE:  Data-access layer for Category Master — Phase 3, Module 04
          *(reordered ahead of Item Master — see CONTINUE_HERE.md Section 10
          for why: Item Master genuinely needs a working categoryId picker,
          the same "forward dependency" tension Vendor Master hit with Bank
          Master, except category/unit are core fields, not a small
          secondary concern, so the roadmap itself got reordered instead of
          leaving Item Master with a placeholder).

   SHAPE DECISION — REAL HIERARCHY, ON PURPOSE:
   Item categories genuinely nest in the real world (Electronics > Computers
   > Laptops, the way any real product catalog — Amazon, Tally, SAP material
   groups — is structured), which makes this module a stronger natural fit
   for Departments-style tree machinery than most flat Phase 3 modules have
   been (Cost Centers, Warehouses, Employee Master's org shape, Vendor/
   Customer Master all deliberately stayed flat — see their own file headers
   for why each one specifically didn't need this). This file reuses
   Departments' exact hierarchy shape — parentCategoryId / getChildren /
   getDescendants / getAncestors / wouldCreateCycle / hasChildren-gated
   delete — renamed for the category domain, because Section 9's own note
   on Employee Master's manager chain already established that this tree
   machinery is "the right shape for ANY 'this record points to another
   record of the same type' relationship," not exclusive to org units.

   NOT copied from Departments: no budget/headcount rollup, because a
   category has no numeric field that would make sense to roll up a subtree
   of (an item count rollup would be the category-domain equivalent, but
   that's Item Master's data to own once it exists next module — this file
   deliberately doesn't reach forward for it).

   CATEGORY TYPE: Product vs. Service, because Item Master's Item Type field
   will include "Service" as one of its five types, and a service line item
   shouldn't be filed under a category built for physical stock-keeping
   units. Item Master's category picker is expected to filter by this.

   DUPLICATE CHECK: Category Name is HARD-blocked, company-wide (not just
   among siblings) — same bucket as Departments/Cost Centers/Warehouses in
   Section 9's three-way duplicate-check lesson (an internal, curated
   identifier meant to be unique), and the same company-wide scope
   Departments already uses rather than only-unique-among-siblings. Real
   catalogs sometimes allow a repeated leaf name under two different
   parents (e.g. "Accessories" under both Electronics and Furniture) — this
   simulator deliberately keeps the simpler, fully-unique rule instead,
   consistent with Departments' own precedent, rather than introducing a
   sibling-scoped variant this codebase hasn't needed anywhere else yet.

   DELETE GUARD: hasChildren only, exactly like Departments — deleting a
   non-leaf category would silently orphan its subtree. This file does NOT
   also check whether any item references the category, even after Item
   Master exists next module: Section 9's established convention for a
   cross-module reference is "store the id, look it up live," with a
   cross-module mismatch surfaced as a soft inline hint on the REFERENCING
   module's own side, not a hard block owned by the module being pointed
   at (Departments' own remove() never checks Cost Centers/Warehouses
   either, for the same reason). Item Master is expected to degrade
   gracefully if a linked category is later deleted.
   ========================================================================== */

const ERP_CATEGORIES_KEY = "erp_categories";

const ERP_CATEGORY_TYPES = ["Product", "Service"];

const ERP_CategoryRepository = {
  categoryTypes: ERP_CATEGORY_TYPES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_CATEGORIES_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_CATEGORIES_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** Root categories first (alphabetically), each followed immediately by
      its own descendants (also alphabetical) — same stable walk order
      Departments uses, works for both the flat table and the tree view. */
  getAllForCompany(companyId) {
    const mine = this.getAll().filter((c) => c.companyId === companyId);
    const byParent = new Map();
    mine.forEach((c) => {
      const key = c.parentCategoryId || "__root__";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(c);
    });
    byParent.forEach((list) => list.sort((a, b) => a.categoryName.localeCompare(b.categoryName)));

    const ordered = [];
    const walk = (parentKey) => {
      (byParent.get(parentKey) || []).forEach((c) => { ordered.push(c); walk(c.id); });
    };
    walk("__root__");
    return ordered;
  },

  findById(id) {
    return this.getAll().find((c) => c.id === id) || null;
  },

  /** Active categories only — the contract Item Master's picker consumes
      (Section 10: "a way to list Active categories for a picker"). */
  getActiveForCompany(companyId) {
    return this.getAllForCompany(companyId).filter((c) => c.status === "Active");
  },

  getRootCategories(companyId) {
    return this.getAllForCompany(companyId).filter((c) => !c.parentCategoryId);
  },

  getChildren(companyId, id) {
    return this.getAllForCompany(companyId).filter((c) => c.parentCategoryId === id);
  },

  /** Every category beneath `id`, at any depth (BFS) — same shape as
      Departments' getDescendants. */
  getDescendants(companyId, id) {
    const all = this.getAllForCompany(companyId);
    const result = [];
    let frontier = [id];
    while (frontier.length) {
      const nextFrontier = [];
      all.forEach((c) => {
        if (frontier.includes(c.parentCategoryId)) { result.push(c); nextFrontier.push(c.id); }
      });
      frontier = nextFrontier;
    }
    return result;
  },

  /** Path from root down to (but not including) `id` — powers both
      breadcrumb-style labels ("Electronics > Laptops") and the tree view. */
  getAncestors(companyId, id) {
    const cat = this.findById(id);
    if (!cat || !cat.parentCategoryId) return [];
    const parent = this.findById(cat.parentCategoryId);
    if (!parent) return [];
    return [...this.getAncestors(companyId, parent.id), parent];
  },

  /** "Electronics > Computers > Laptops" — used by Item Master's category
      picker so a deeply-nested category is still identifiable at a glance. */
  getBreadcrumbLabel(companyId, id) {
    const cat = this.findById(id);
    if (!cat) return "";
    const ancestors = this.getAncestors(companyId, id);
    return [...ancestors.map((a) => a.categoryName), cat.categoryName].join(" > ");
  },

  /** True if setting `catId`'s parent to `proposedParentId` would create a
      cycle — the proposed parent IS the category itself, or is already one
      of its own descendants. Every parent re-assignment must pass this. */
  wouldCreateCycle(companyId, catId, proposedParentId) {
    if (!proposedParentId) return false;
    if (proposedParentId === catId) return true;
    const descendantIds = this.getDescendants(companyId, catId).map((c) => c.id);
    return descendantIds.includes(proposedParentId);
  },

  /** COMP-001-CAT-01, COMP-001-CAT-02, ... — same per-company numbering
      convention every earlier module established. */
  nextCategoryCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((c) => {
      const match = /-CAT-(\d+)$/.exec(c.categoryCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-CAT-${String(max + 1).padStart(2, "0")}`;
  },

  create(company, data) {
    const record = {
      id: "CAT-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      categoryCode: this.nextCategoryCode(company),
      parentCategoryId: null,
      categoryType: "Product",
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
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  toggleStatus(id) {
    const cat = this.findById(id);
    if (!cat) return null;
    return this.update(id, { status: cat.status === "Active" ? "Inactive" : "Active" });
  },

  /** Refuses to delete a category that still has children — deleting a
      non-leaf category would silently orphan everything beneath it, same
      reasoning as Departments. See file header for why this does NOT also
      check Item Master references. */
  hasChildren(companyId, id) {
    return this.getChildren(companyId, id).length > 0;
  },

  remove(id, companyId) {
    if (this.hasChildren(companyId, id)) return false;
    const all = this.getAll().filter((c) => c.id !== id);
    this._saveAll(all);
    return true;
  },

  hasDuplicateName(companyId, categoryName, excludeId) {
    const target = categoryName.trim().toLowerCase();
    return this.getAllForCompany(companyId).some((c) => c.id !== excludeId && c.categoryName.trim().toLowerCase() === target);
  }
};
