/* =============================================================================
   DOT ERP
   FILE:  data/stock-adjustment-data.js
   ROLE:  Data-access layer for Stock Adjustment — Phase 7, Module 03.
          Physical stock-take corrections: what the system says you have
          vs. what a trainee actually counted, one warehouse at a time,
          for as many items as one count session covers — with a
          required reason, because "we adjusted stock" without saying
          why is exactly the kind of gap a real auditor would flag.

   ONE ADJUSTMENT = ONE COUNT SESSION, MULTIPLE LINES — modeled as a
   header (warehouse, date, reason, notes) + a live-editable line table,
   the same "own new line-item UI, not a copy of an existing one" shape
   Journal Entry established first: there's no single upstream document
   to pull lines from, and a stock-take genuinely covers several items
   at once, so a live table with its own add/remove controls fits better
   than either a fixed pulled-in line table (Purchase Order's shape) or
   one-at-a-time modal entry (Purchase Requisition's shape).

   EACH LINE SNAPSHOTS systemQuantity AT THE MOMENT IT'S ADDED, NOT
   RECOMPUTED AT POST TIME — a deliberate choice, not an oversight. A
   physical count compares "what we counted" against "what the system
   said AT THE MOMENT OF COUNTING," not against whatever the system
   happens to say later if some other transaction lands in between.
   `adjustmentQuantity` (= countedQuantity - systemQuantity) is derived
   once, when the count is entered, and that's the number that gets
   posted — post() does not re-derive it from a fresh balance lookup.

   UNIT COST IS REQUIRED ONLY WHEN A LINE IS A SURPLUS (adjustmentQuantity
   > 0) — THE ONE REAL DECISION THIS FILE HAD TO MAKE EXPLICITLY. A
   shortage line (damage, theft, count coming up short) consumes existing
   FIFO layers automatically at valuation time — same as a Delivery
   Issue, no cost input needed, because stock-valuation-data.js already
   knows what those units cost from however they originally arrived. A
   surplus line (found stock with no receiving document behind it) is
   creating a brand-new incoming layer out of nothing, and a layer with
   no cost would corrupt every valuation report downstream — so the
   trainee must supply one, and `isLineValid()`/`canPost()` both enforce
   it, mirroring real-ERP behavior (Tally and SAP both prompt for a cost
   basis specifically when recording a stock increase with no purchase
   document behind it).

   LIFECYCLE — Draft -> Posted (immutable) or Draft -> Cancelled, the
   same shape Journal Entry and Opening Stock both use for anything that
   writes to a ledger. `post()` writes ONE Stock Ledger "Stock Adjustment"
   entry per line whose adjustmentQuantity is non-zero — a line where the
   count matched the system exactly produces no ledger entry at all
   (nothing moved, nothing to record), the same "zero isn't a movement"
   rule stock-ledger-data.js's own recordMovement() already enforces.
   ========================================================================== */

const ERP_STOCK_ADJUSTMENT_KEY = "erp_stock_adjustments";
const ERP_STOCK_ADJUSTMENT_REASONS = ["Physical Count Variance", "Damage", "Expiry", "Theft / Loss", "Found Surplus", "Other"];

const ERP_StockAdjustmentRepository = {
  statuses: ["Draft", "Posted", "Cancelled"],
  reasons: ERP_STOCK_ADJUSTMENT_REASONS,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_STOCK_ADJUSTMENT_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_STOCK_ADJUSTMENT_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((r) => r.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((r) => r.id === id) || null;
  },

  findDuplicateLineItemByItem(adjustment, itemId, excludeLineId) {
    if (!itemId) return null;
    return (adjustment.lineItems || []).find((l) => l.id !== excludeLineId && l.itemId === itemId) || null;
  },

  /** adjustmentQuantity = countedQuantity - systemQuantity, computed
      here so the page's own line-editing code and post() always agree
      on the same formula. */
  computeAdjustmentQuantity(line) {
    return (Number(line.countedQuantity) || 0) - (Number(line.systemQuantity) || 0);
  },

  /** A line is well-formed if it points at a real item and, for a
      surplus line, carries a positive unit cost — see file header. */
  isLineValid(line) {
    if (!line.itemId) return false;
    if (Number(line.countedQuantity) < 0 || isNaN(Number(line.countedQuantity))) return false;
    const adjQty = this.computeAdjustmentQuantity(line);
    if (adjQty > 0) {
      const cost = Number(line.unitCost);
      if (isNaN(cost) || cost <= 0) return false;
    }
    return true;
  },

  canEdit(record) { return record.status === "Draft"; },
  canDelete(record) { return record.status === "Draft"; },
  canCancel(record) { return record.status === "Draft"; },

  /** At least one line, every line well-formed, and at least one line
      actually represents a real movement (a session where every count
      matched the system exactly has nothing to post). */
  canPost(record) {
    if (record.status !== "Draft") return false;
    if (!record.warehouseId || !record.reason) return false;
    const lines = record.lineItems || [];
    if (lines.length === 0) return false;
    if (!lines.every((l) => this.isLineValid(l))) return false;
    return lines.some((l) => this.computeAdjustmentQuantity(l) !== 0);
  },

  nextAdjustmentNumber(company) {
    const mine = this.getAll().filter((r) => r.companyId === company.id);
    let max = 0;
    mine.forEach((r) => {
      const n = parseInt(String(r.adjustmentNumber).replace(/^ADJ-/, ""), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    });
    return "ADJ-" + String(max + 1).padStart(5, "0");
  },

  create(company, data, actorUsername) {
    const record = {
      id: "SA-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      adjustmentNumber: this.nextAdjustmentNumber(company),
      warehouseId: null,
      adjustmentDate: new Date().toISOString().slice(0, 10),
      reason: "",
      notes: "",
      lineItems: [],
      status: "Draft",
      linkedStockLedgerEntryIds: [],
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString(),
      ...data,
      status: "Draft"
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    if (all[idx].status !== "Draft") return null;
    all[idx] = { ...all[idx], ...partial, status: "Draft", updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Writes one Stock Ledger entry per non-zero line — see file header.
      Typeof-guarded against Stock Ledger not being loaded, same
      defensive shape every cross-module call in this project uses.

      PHASE 19 RETROFIT: also builds and returns `costedLines` — one
      `{itemId, adjustmentQuantity, cost}` per line that actually
      moved — for gl-posting-data.js's own `postStockAdjustment()`. A
      shrinkage line (adjustmentQuantity < 0) is costed via
      `ERP_StockValuationRepository.computeConsumptionCost()`, called
      BEFORE that line's own outgoing Stock Ledger entry is written —
      the identical interleaved pattern stock-posting-data.js's own
      `postDeliveryIssue()` established for Delivery Challan, needed
      here for the same reason: a second shrinkage line for the same
      item later in this same adjustment must cost against what the
      first one left behind, not against the pre-adjustment state. A
      surplus line (adjustmentQuantity > 0) needs no such lookup — its
      own `unitCost` was already required at entry (see file header),
      so its cost is simply `adjustmentQuantity * unitCost`. Return
      shape changed from a bare record to `{success, record?, reason?,
      costedLines?}` — the same `{success, reason}` shape Sales Return
      and Purchase Return's own post() already use, adopted here so
      the calling page has an honest failure reason to show instead of
      a bare falsy check. */
  post(id, company, actorUsername) {
    const record = this.findById(id);
    if (!record) return { success: false, reason: "This stock adjustment no longer exists." };
    if (!this.canPost(record)) return { success: false, reason: "This adjustment isn't ready to post — check the warehouse, reason, and every line." };

    const linkedStockLedgerEntryIds = [];
    const costedLines = [];
    if (typeof ERP_StockLedgerRepository !== "undefined") {
      (record.lineItems || []).forEach((line) => {
        const adjQty = this.computeAdjustmentQuantity(line);
        if (adjQty === 0) return;

        let cost = 0;
        if (adjQty < 0) {
          const costed = (typeof ERP_StockValuationRepository !== "undefined")
            ? ERP_StockValuationRepository.computeConsumptionCost(company.id, line.itemId, record.warehouseId, record.adjustmentDate, Math.abs(adjQty))
            : { cost: 0 };
          cost = costed.cost || 0;
        } else {
          cost = adjQty * (Number(line.unitCost) || 0);
        }

        const entry = ERP_StockLedgerRepository.recordMovement(company, {
          itemId: line.itemId,
          warehouseId: record.warehouseId,
          transactionDate: record.adjustmentDate,
          transactionType: "Stock Adjustment",
          quantity: adjQty,
          unitCost: adjQty > 0 ? Number(line.unitCost) : null,
          referenceType: "StockAdjustment",
          referenceId: record.id,
          narration: `${record.reason}${record.notes ? " — " + record.notes : ""}`
        }, actorUsername);
        if (entry) {
          linkedStockLedgerEntryIds.push(entry.id);
          costedLines.push({ itemId: line.itemId, adjustmentQuantity: adjQty, cost });
        }
      });
    }

    const updated = this._patch(id, { status: "Posted", linkedStockLedgerEntryIds, postedByUsername: actorUsername, postedAt: new Date().toISOString() });
    if (!updated) return { success: false, reason: "Couldn't post this adjustment." };
    return { success: true, record: updated, costedLines };
  },

  cancel(id, actorUsername) {
    const record = this.findById(id);
    if (!record || !this.canCancel(record)) return null;
    return this._patch(id, { status: "Cancelled", cancelledByUsername: actorUsername, cancelledAt: new Date().toISOString() });
  },

  remove(id) {
    const record = this.findById(id);
    if (!record || record.status !== "Draft") return false;
    const all = this.getAll().filter((r) => r.id !== id);
    this._saveAll(all);
    return true;
  },

  _patch(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial };
    this._saveAll(all);
    return all[idx];
  }
};
