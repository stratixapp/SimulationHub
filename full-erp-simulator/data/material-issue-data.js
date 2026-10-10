/* =============================================================================
   DOT ERP
   FILE:  data/material-issue-data.js
   ROLE:  Data-access layer for Material Issue for Production — Phase 10,
          Module 03. Consumes raw materials from Stock Ledger against a
          Work Order's own BOM. Built from one In Progress Work Order —
          NOT exclusive over it (see below).

   THE QUESTION THE ROADMAP EXPLICITLY ASKED TO BE CHECKED, NOT ASSUMED:
   does `ERP_StockLedgerRepository.recordMovement()` already fit an OUT
   movement whose "destination" is a Work Order, or does it need a new
   shape? Checked directly against that file's own signature
   (`stock-ledger-data.js`): `recordMovement()` already takes a generic
   `referenceType`/`referenceId` pair, never previously typed to any
   specific calling module, plus a `transactionType` validated against a
   small controlled vocabulary. The reference pair needed NO change at
   all — `referenceType: "Work Order"` slots in exactly like "GRN Receipt"
   or "Stock Adjustment" already do. The ONLY change genuinely needed was
   a small, additive one: two new entries in that vocabulary array
   ("Material Issue", "Finished Goods Receipt" — the latter used by this
   module's own sibling one file over), not a new API shape or a second
   write path. Confirmed, not assumed, exactly as the roadmap asked.

   NOT EXCLUSIVE OVER ITS OWN WORK ORDER: a real production run issues
   materials in batches as work actually progresses, not all at once up
   front — so multiple Material Issues can legitimately exist against the
   same Work Order, over time. No `getLinkedXIds`/`getAvailableXForCompany`
   pair here; `getAllForWorkOrder()` is a plain foreign-key read, the same
   "no exclusivity, multiple legitimate actions per parent" shape Vendor
   Evaluation and Payment Collection already established.

   LINES ARE DERIVED FROM THE WORK ORDER'S OWN BOM, NOT FREELY ADDED — A
   RESOLUTION #8 VARIANT, AND MEANT TO BE OVERWRITTEN: `buildSuggestedLines()`
   below returns one row per BOM component, quantity pre-filled with
   whatever's still OUTSTANDING for the order's own planned batch
   (`requiredQty - alreadyIssuedQty`, both scrap-adjusted) — never the
   full requirement again once a partial issue has already happened. Every
   line stays genuinely editable, the same "pre-filled but meant to be
   overwritten, a discrepancy is the normal case" precedent Goods Receipt
   established first — an actual issue can differ from the ideal plan
   (breakage, a substitution, a rounding difference), and this module
   doesn't pretend otherwise.

   ACTUAL COST, NOT ESTIMATED COST — REUSED FROM STOCK TRANSFER, NOT
   REINVENTED: each line's `unitCostAtIssue` is captured at posting time
   via `ERP_StockValuationRepository.getWeightedAverageCost()` — the exact
   same "current average cost of everything on hand in that warehouse"
   convention Stock Transfer's own cost carry-forward already established
   as honest, real-ERP-adjacent behavior (see stock-valuation-data.js's
   header) rather than a full FIFO-layer peel. `bom-data.js`'s own
   `computeMaterialCostPerUnit()` is a DIFFERENT, STANDARD-COST estimate
   for planning; this is the real number that actually posts.

   INSUFFICIENT STOCK — A LINE IS SKIPPED, NEVER POSTED LOPSIDED: mirrors
   Stock Transfer's own precedent exactly. If a line's own issue quantity
   exceeds the current balance of that item in the Work Order's warehouse,
   `post()` skips writing a Stock Ledger entry for that one line (it is
   NOT force-negative, and it is NOT silently clamped) and reports the
   skipped count back, the same shape Stock Adjustment's/Stock Transfer's
   own post() functions already return for the calling page to announce.

   Draft → Issued → Cancelled (Cancelled only from Draft) — the same
   "administrative formalization, immutable once posted" shape GRN and
   Stock Adjustment both use, for the same reason: Stock Ledger has no
   update()/remove() at all (see its own header), so an Issued Material
   Issue can't be safely un-posted — a correction is a new, separate
   document (a return via Stock Adjustment), not a rewrite here. Named
   plainly as the real limitation it is, not hidden.
   ========================================================================== */

const ERP_MATERIAL_ISSUE_KEY = "erp_material_issues";
const ERP_MATERIAL_ISSUE_STATUSES = ["Draft", "Issued", "Cancelled"];

const ERP_MaterialIssueRepository = {
  statuses: ERP_MATERIAL_ISSUE_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_MATERIAL_ISSUE_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_MATERIAL_ISSUE_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((m) => m.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((m) => m.id === id) || null;
  },

  getAllForWorkOrder(workOrderId) {
    return this.getAll().filter((m) => m.workOrderId === workOrderId);
  },

  /** MI-01, MI-02, ... per company. */
  nextMaterialIssueCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((m) => {
      const match = /-MI-(\d+)$/.exec(m.materialIssueCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-MI-${String(max + 1).padStart(2, "0")}`;
  },

  /** Total already-Issued quantity of one BOM component against one Work
      Order, across every posted (non-Draft, non-Cancelled) Material
      Issue — what buildSuggestedLines() subtracts from the full
      requirement to land on "what's still outstanding." */
  getIssuedQuantityForComponent(workOrderId, componentItemId) {
    return this.getAllForWorkOrder(workOrderId)
      .filter((m) => m.status === "Issued")
      .reduce((sum, m) => sum + (m.lines || []).filter((l) => l.itemId === componentItemId).reduce((s, l) => s + (Number(l.quantity) || 0), 0), 0);
  },

  /** One suggested row per BOM component, quantity pre-filled with
      whatever's still outstanding for the order's own planned batch
      (scrap-adjusted). See file header — genuinely meant to be
      overwritten, not a locked value. */
  buildSuggestedLines(companyId, workOrder) {
    if (typeof ERP_BomRepository === "undefined") return [];
    const bom = ERP_BomRepository.findById(workOrder.bomId);
    if (!bom) return [];
    const plannedQty = Number(workOrder.plannedQuantity) || 0;
    return (bom.lines || []).map((l) => {
      const requiredQty = (Number(l.quantityPerOutput) || 0) * (1 + (Number(l.scrapPercent) || 0) / 100) * plannedQty;
      const alreadyIssued = this.getIssuedQuantityForComponent(workOrder.id, l.componentItemId);
      const outstanding = Math.max(0, requiredQty - alreadyIssued);
      return { itemId: l.componentItemId, requiredQty, alreadyIssued, quantity: outstanding };
    });
  },

  create(company, workOrder, data, actorUsername) {
    const record = {
      id: "MI-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      materialIssueCode: this.nextMaterialIssueCode(company),
      workOrderId: workOrder.id,
      warehouseId: workOrder.warehouseId,
      issueDate: data.issueDate || new Date().toISOString().slice(0, 10),
      issuedByEmployeeId: data.issuedByEmployeeId || null,
      remarks: data.remarks || "",
      status: "Draft",
      lines: (data.lines || []).filter((l) => l.itemId && Number(l.quantity) > 0).map((l) => ({
        id: "MIL-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        itemId: l.itemId,
        quantity: Number(l.quantity) || 0,
        unitCostAtIssue: null // stamped at post() — see below
      })),
      totalMaterialCost: 0,
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString()
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  canPost(record) { return record.status === "Draft" && (record.lines || []).length > 0; },

  /** The ONLY place a Material Issue writes to Stock Ledger. For each
      line, looks up the current weighted-average cost and the current
      balance in the Work Order's warehouse; a line whose quantity
      exceeds that balance is SKIPPED (see file header), never posted
      lopsided. Never throws. Returns
      { success, record, skippedCount, postedCount }. */
  post(id, company, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((m) => m.id === id);
    if (idx === -1 || !this.canPost(all[idx])) return { success: false, reason: "This Material Issue can't be posted." };
    const record = all[idx];

    let totalCost = 0;
    let skippedCount = 0;
    let postedCount = 0;
    const postedLines = record.lines.map((l) => {
      const available = typeof ERP_StockLedgerRepository !== "undefined"
        ? ERP_StockLedgerRepository.getBalance(company.id, l.itemId, record.warehouseId)
        : 0;
      if (l.quantity > available) { skippedCount += 1; return { ...l, skipped: true, unitCostAtIssue: null }; }

      const unitCost = typeof ERP_StockValuationRepository !== "undefined"
        ? ERP_StockValuationRepository.getWeightedAverageCost(company.id, l.itemId, record.warehouseId)
        : 0;

      if (typeof ERP_StockLedgerRepository !== "undefined") {
        ERP_StockLedgerRepository.recordMovement(company, {
          itemId: l.itemId,
          warehouseId: record.warehouseId,
          transactionDate: record.issueDate,
          transactionType: "Material Issue",
          quantity: -Math.abs(l.quantity), // OUT
          unitCost: null, // outgoing entries never store unitCost — see stock-ledger-data.js's own header
          referenceType: "Work Order",
          referenceId: record.workOrderId,
          narration: `Material issue ${record.materialIssueCode}`
        }, actorUsername);
      }

      totalCost += l.quantity * unitCost;
      postedCount += 1;
      return { ...l, skipped: false, unitCostAtIssue: unitCost };
    });

    all[idx] = {
      ...record,
      status: "Issued",
      lines: postedLines,
      totalMaterialCost: totalCost,
      postedAt: new Date().toISOString(),
      postedByUsername: actorUsername || "system"
    };
    this._saveAll(all);
    return { success: true, record: all[idx], skippedCount, postedCount };
  },

  canCancel(record) { return record.status === "Draft"; },
  cancel(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((m) => m.id === id);
    if (idx === -1 || !this.canCancel(all[idx])) return null;
    all[idx] = { ...all[idx], status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  remove(id) {
    const all = this.getAll();
    const rec = all.find((m) => m.id === id);
    if (!rec || rec.status !== "Draft") return false;
    this._saveAll(all.filter((m) => m.id !== id));
    return true;
  }
};
