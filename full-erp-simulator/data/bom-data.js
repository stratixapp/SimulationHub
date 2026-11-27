/* =============================================================================
   DOT ERP
   FILE:  data/bom-data.js
   ROLE:  Data-access layer for Bill of Materials — Phase 10, Module 01, the
          module that opens Manufacturing. Real master data: which raw
          materials/sub-assemblies, in what quantities, produce one batch
          of a finished (or semi-finished) item.

   NESTING IS SUPPORTED, DELIBERATELY, NOT DEFAULTED TO FLAT: a component
   can itself be a Semi-Finished Good with its own Active BOM (a genuine
   sub-assembly), and the roadmap explicitly asked this be decided rather
   than assumed — real manufacturing usually nests. That means two things
   this file has to own that a flat BOM wouldn't need: (1) CYCLE PROTECTION
   — `wouldCreateCycle()` walks a proposed component's own BOM chain before
   a line can be saved, the same "structurally impossible claim, hard-
   blocked at create" shape Leave Application's overlap check established
   (CONTINUE_HERE.md Section 9) rather than a numbered duplicate-check
   resolution, because a cycle isn't a duplicate, it's a claim that can't
   be true; (2) RECURSIVE COST ROLLUP — `computeMaterialCostPerUnit()`
   below, visited-set guarded against the same cycles as a defensive second
   layer even though save-time validation should already prevent them.

   ESTIMATED COST (HERE) VS. ACTUAL COST (Material Issue) — A DELIBERATE
   TWO-NUMBER DESIGN, NOT AN OVERSIGHT: this file's own cost rollup is a
   STANDARD-COSTING estimate — it walks the BOM tree and prices every leaf
   (an item with no Active BOM of its own) at Item Master's own
   `purchasePrice`, which is a static, editable field, not a captured fact.
   It exists so a BOM can be reviewed and costed BEFORE any Work Order or
   stock movement exists at all. `material-issue-data.js`, one module over,
   posts a genuinely different number — the real FIFO-weighted-average cost
   of what was actually in the warehouse at the moment of consumption, via
   `ERP_StockValuationRepository.getWeightedAverageCost()`. Two honest,
   differently-sourced numbers for two different real questions ("what
   should this cost" vs. "what did this actually cost"), the same
   estimate-vs-fact discipline Purchase Register's own `taxIsEstimated`
   flag already established for this project — never quietly collapsed
   into one.

   SCRAP % PER LINE — A REAL, SIMPLE SCOPE DECISION: `scrapPercent`
   (default 0) inflates a line's effective consumption
   (`quantityPerOutput * (1 + scrapPercent/100)`) without inventing a
   separate wastage-tracking module. A real BOM almost always carries some
   wastage allowance; modeling it as one number per line is honest and
   proportionate to what this simulator needs, versus a full scrap-
   reporting subsystem, which stays out of scope.

   "AT MOST ONE ACTIVE BOM PER FINISHED ITEM" — A GENUINELY NEW DUPLICATE-
   CHECK SHAPE, NOT A REUSE OF RESOLUTION #7: a flat hard-block on
   `finishedItemId` would be wrong — Draft BOMs for the same item coexist
   freely while a recipe is being worked out (the same freedom Salary
   Structure's own effectiveFrom versioning established: a second record
   isn't automatically a duplicate, check what it MEANS). What actually
   needs exclusivity is which ONE BOM is live for costing and Work Orders
   at any moment. So `activate()` below reuses Quotation Comparison's own
   MUTUAL-EXCLUSIVITY TOGGLE shape instead (CONTINUE_HERE.md Section 4):
   activating a BOM auto-deactivates whatever was previously Active for
   that same finished item, rather than blocking the save outright. Line
   items get the ordinary resolution — the same component added twice
   within one BOM is resolution #6 (child-collection-scoped), a soft nudge
   the calling page shows, not a hard block, applied here for a fourth
   time.

   ITEM TYPE CONSTRAINTS, CHECKED AT SAVE TIME, NOT JUST IN THE PICKER:
   `finishedItemId` must resolve to a "Semi-Finished Good" or "Finished
   Good" item (Item Master's own `ERP_ITEM_TYPES` — a BOM produces one of
   those two, never a Raw Material or Consumable). A component may be
   anything except the finished item's own Service-type cousins or itself
   — Service items carry no physical stock to consume, so they're excluded
   from the component picker entirely rather than silently allowed and
   later producing a nonsensical Stock Ledger entry.

   NO STATUS OTHER THAN Draft/Active/Inactive — DELIBERATELY NOT A FULL
   APPROVAL WORKFLOW: a BOM is engineering/costing data a planner iterates
   on, not a financial commitment that needs a separate approval gate the
   way a PR or PO does. Draft → Active is a one-step activation (with the
   auto-supersede above); Active → Inactive retires a superseded recipe
   without deleting its own history (Work Orders already built from it
   keep referencing it by id, same as every other "don't delete what's
   been referenced" precedent in this project).
   ========================================================================== */

const ERP_BOM_KEY = "erp_bom_records";
const ERP_BOM_STATUSES = ["Draft", "Active", "Inactive"];
const ERP_BOM_COMPONENT_EXCLUDED_TYPES = ["Service"];

const ERP_BomRepository = {
  statuses: ERP_BOM_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_BOM_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_BOM_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((b) => b.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((b) => b.id === id) || null;
  },

  /** BOM-01, BOM-02, ... per company. */
  nextBomCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((b) => {
      const match = /-BOM-(\d+)$/.exec(b.bomCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-BOM-${String(max + 1).padStart(2, "0")}`;
  },

  getActiveBomForItem(companyId, finishedItemId) {
    return this.getAllForCompany(companyId).find((b) => b.finishedItemId === finishedItemId && b.status === "Active") || null;
  },

  getAllForFinishedItem(companyId, finishedItemId) {
    return this.getAllForCompany(companyId).filter((b) => b.finishedItemId === finishedItemId);
  },

  /** Soft, non-blocking check the calling page nudges on — resolution #6,
      the same child-collection-scoped shape PR/Quotation's own line items
      already established. */
  isDuplicateComponent(lines, componentItemId, excludeLineId) {
    return (lines || []).some((l) => l.id !== excludeLineId && l.componentItemId === componentItemId);
  },

  /** True if making `componentItemId` a component of `finishedItemId`
      would create a cycle — either direct self-reference, or an indirect
      loop through `componentItemId`'s own Active BOM chain (a sub-
      assembly that, some number of levels down, is built from the very
      item that's supposed to contain it). Hard-blocked at save — see file
      header. `visited` guards this walk itself against an already-
      corrupt chain so the CHECK can never infinite-loop even if the data
      somehow already did. */
  wouldCreateCycle(companyId, finishedItemId, componentItemId, visited) {
    if (!finishedItemId || !componentItemId) return false;
    if (componentItemId === finishedItemId) return true;
    visited = visited || [];
    if (visited.includes(componentItemId)) return false; // already-corrupt chain; don't loop the checker itself
    const bom = this.getActiveBomForItem(companyId, componentItemId);
    if (!bom) return false;
    const nextVisited = visited.concat([componentItemId]);
    return (bom.lines || []).some((l) => this.wouldCreateCycle(companyId, finishedItemId, l.componentItemId, nextVisited) || l.componentItemId === finishedItemId);
  },

  /** Recursive STANDARD-COST estimate — see file header for why this is a
      deliberately different number from Material Issue's actual FIFO
      cost. A leaf item (no Active BOM of its own) prices at Item
      Master's own purchasePrice. `visited` is cycle protection as a
      second, defensive layer beneath wouldCreateCycle()'s own save-time
      gate. Returns { costPerUnit, circular } — circular is surfaced so a
      caller can show "cost unavailable — circular BOM" instead of a
      silently wrong zero. */
  computeMaterialCostPerUnit(companyId, itemId, visited) {
    visited = visited || [];
    if (visited.includes(itemId)) return { costPerUnit: 0, circular: true };
    if (typeof ERP_ItemRepository === "undefined") return { costPerUnit: 0, circular: false };
    const item = ERP_ItemRepository.findById(itemId);
    if (!item) return { costPerUnit: 0, circular: false };

    const bom = this.getActiveBomForItem(companyId, itemId);
    if (!bom) return { costPerUnit: Number(item.purchasePrice) || 0, circular: false };

    const nextVisited = visited.concat([itemId]);
    let total = 0;
    let circular = false;
    (bom.lines || []).forEach((l) => {
      const sub = this.computeMaterialCostPerUnit(companyId, l.componentItemId, nextVisited);
      if (sub.circular) circular = true;
      const effectiveQty = (Number(l.quantityPerOutput) || 0) * (1 + (Number(l.scrapPercent) || 0) / 100);
      total += effectiveQty * sub.costPerUnit;
    });
    const outputQuantity = Number(bom.outputQuantity) || 1;
    return { costPerUnit: total / outputQuantity, circular };
  },

  create(company, data, actorUsername) {
    const record = {
      id: "BOM-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      bomCode: this.nextBomCode(company),
      finishedItemId: data.finishedItemId,
      outputQuantity: Number(data.outputQuantity) || 1,
      status: "Draft",
      notes: data.notes || "",
      lines: (data.lines || []).map((l) => ({
        id: l.id || ("BOML-" + Math.random().toString(36).slice(2, 8).toUpperCase()),
        componentItemId: l.componentItemId,
        quantityPerOutput: Number(l.quantityPerOutput) || 0,
        scrapPercent: Number(l.scrapPercent) || 0
      })),
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString()
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Only a Draft can be edited freely — once Active, a BOM is what Work
      Orders and cost rollups are actively reading; changing its own
      recipe underneath them silently would corrupt any in-flight Work
      Order's own cost trail. Editing an Active BOM means deactivating it
      and creating a new version instead (the same "correction is a new
      record" principle Stock Ledger's own header already established). */
  update(id, partial, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1 || all[idx].status !== "Draft") return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString(), updatedByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft → Active. Auto-supersedes (deactivates) any other Active BOM
      for the same finishedItemId — see file header, the same mutual-
      exclusivity toggle shape Quotation Comparison's recommend() uses. */
  activate(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1 || all[idx].status !== "Draft") return null;
    const target = all[idx];
    all.forEach((b, i) => {
      if (b.companyId === target.companyId && b.finishedItemId === target.finishedItemId && b.status === "Active") {
        all[i] = { ...b, status: "Inactive", deactivatedAt: new Date().toISOString(), deactivatedByUsername: actorUsername || "system", supersededByBomId: target.id };
      }
    });
    all[idx] = { ...target, status: "Active", activatedAt: new Date().toISOString(), activatedByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  deactivate(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1 || all[idx].status !== "Active") return null;
    all[idx] = { ...all[idx], status: "Inactive", deactivatedAt: new Date().toISOString(), deactivatedByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  /** Drafts only — an Active or Inactive BOM may already be referenced by
      a Work Order; removing it would strand that reference the same way
      every other "no delete once referenced" module in this project
      refuses to. */
  remove(id) {
    const all = this.getAll();
    const rec = all.find((b) => b.id === id);
    if (!rec || rec.status !== "Draft") return false;
    this._saveAll(all.filter((b) => b.id !== id));
    return true;
  }
};
