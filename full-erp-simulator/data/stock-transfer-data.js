/* =============================================================================
   DOT ERP
   FILE:  data/stock-transfer-data.js
   ROLE:  Data-access layer for Stock Transfer — Phase 7, Module 04.
          Warehouse-to-warehouse moves: the same physical stock, moving
          from one location to another, never created or destroyed.

   TWO STOCK LEDGER ENTRIES PER LINE, NOT ONE — a transfer isn't a single
   movement, it's an outflow from one warehouse paired with an inflow to
   another. `complete()` writes a "Transfer Out" entry (negative
   quantity, `unitCost: null` — consumed via FIFO at valuation time, same
   as a Delivery Issue) against `fromWarehouseId`, and a "Transfer In"
   entry (positive quantity, WITH a unitCost — see below) against
   `toWarehouseId`, both referencing the same Stock Transfer record. Both
   or neither: if a line's fromWarehouse doesn't have enough stock to
   cover it, that line is skipped entirely rather than posting a lopsided
   half-transfer (an outflow with no matching inflow, or vice versa,
   would be worse than not posting at all).

   WHERE THE DESTINATION'S COST COMES FROM — READS stock-valuation-
   data.js's FIFO ENGINE, DOESN'T DUPLICATE IT. The incoming layer this
   creates in the destination warehouse needs a cost basis carried over
   from the source. Rather than re-deriving cost logic here,
   `complete()` calls `ERP_StockValuationRepository.getWeightedAverageCost()`
   for the source (item, fromWarehouse) pair AT THE MOMENT OF TRANSFER —
   the exact same "genuine reuse forward, not duplicated logic" discipline
   Trial Balance reusing General Ledger's own account summary, and
   Balance Sheet reusing Profit & Loss, both established in Phase 6. See
   stock-valuation-data.js's own header for why this uses the CURRENT
   average cost rather than peeling an exact FIFO slice for the
   transferred quantity specifically — a named, deliberate simplification,
   not an oversight.

   THIS CREATES A REAL BUILD-ORDER DEPENDENCY ON stock-valuation-data.js,
   EVEN THOUGH THE ROADMAP LISTS STOCK TRANSFER (04) BEFORE STOCK
   VALUATION REPORT (05) — the same "real dependency order beats roadmap
   numbering" situation Stock Ledger/Opening Stock already had. Stock
   Valuation's own FIFO engine was built early specifically so this file
   could depend on it; the Valuation Report PAGE simply ships later, in
   its own roadmap slot.

   LIFECYCLE — Draft -> Completed (immutable) or Draft -> Cancelled, the
   same ledger-writing shape as Opening Stock and Stock Adjustment.
   "Completed" rather than "Posted" — a transfer isn't posted to
   somewhere the way a journal entry or an adjustment is, it's physically
   completed, the same verb a real warehouse transfer note would use.

   fromWarehouseId AND toWarehouseId MUST DIFFER — the one duplicate-free
   validation this module needs that no earlier module quite had: not a
   record-level duplicate check, but a same-record internal consistency
   rule (a transfer to itself moves nothing and shouldn't be postable).
   ========================================================================== */

const ERP_STOCK_TRANSFER_KEY = "erp_stock_transfers";

const ERP_StockTransferRepository = {
  statuses: ["Draft", "Completed", "Cancelled"],

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_STOCK_TRANSFER_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_STOCK_TRANSFER_KEY, JSON.stringify(list)); return true; }
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

  findDuplicateLineItemByItem(transfer, itemId, excludeLineId) {
    if (!itemId) return null;
    return (transfer.lineItems || []).find((l) => l.id !== excludeLineId && l.itemId === itemId) || null;
  },

  isLineValid(line) {
    if (!line.itemId) return false;
    const qty = Number(line.quantity);
    return !isNaN(qty) && qty > 0;
  },

  canEdit(record) { return record.status === "Draft"; },
  canDelete(record) { return record.status === "Draft"; },
  canCancel(record) { return record.status === "Draft"; },

  canComplete(companyId, record) {
    if (record.status !== "Draft") return false;
    if (!record.fromWarehouseId || !record.toWarehouseId) return false;
    if (record.fromWarehouseId === record.toWarehouseId) return false;
    const lines = record.lineItems || [];
    if (lines.length === 0) return false;
    return lines.every((l) => this.isLineValid(l));
  },

  /** Whichever lines have enough stock on hand in fromWarehouse right
      now to actually cover the transfer — surfaced to the page so it
      can warn before the trainee tries to complete a transfer that
      would otherwise silently skip lines. Read-only; posts nothing. */
  getShortfallLines(companyId, record) {
    if (typeof ERP_StockLedgerRepository === "undefined") return [];
    return (record.lineItems || []).filter((l) => {
      if (!this.isLineValid(l)) return true;
      const available = ERP_StockLedgerRepository.getBalance(companyId, l.itemId, record.fromWarehouseId);
      return available < Number(l.quantity);
    });
  },

  nextTransferNumber(company) {
    const mine = this.getAll().filter((r) => r.companyId === company.id);
    let max = 0;
    mine.forEach((r) => {
      const n = parseInt(String(r.transferNumber).replace(/^STF-/, ""), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    });
    return "STF-" + String(max + 1).padStart(5, "0");
  },

  create(company, data, actorUsername) {
    const record = {
      id: "STF-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      transferNumber: this.nextTransferNumber(company),
      fromWarehouseId: null,
      toWarehouseId: null,
      transferDate: new Date().toISOString().slice(0, 10),
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

  /** Writes a matched Transfer Out / Transfer In pair per line that has
      enough stock on hand to cover it — see file header. A line without
      enough stock is skipped on BOTH sides, never just one; `skippedCount`
      tells the page how many lines that happened to. */
  complete(id, company, actorUsername) {
    const record = this.findById(id);
    if (!record || !this.canComplete(company.id, record)) return null;

    const linkedStockLedgerEntryIds = [];
    let skippedCount = 0;

    if (typeof ERP_StockLedgerRepository !== "undefined") {
      (record.lineItems || []).forEach((line) => {
        const quantity = Number(line.quantity) || 0;
        const available = ERP_StockLedgerRepository.getBalance(company.id, line.itemId, record.fromWarehouseId);
        if (quantity <= 0 || available < quantity) { skippedCount += 1; return; }

        const unitCost = (typeof ERP_StockValuationRepository !== "undefined")
          ? ERP_StockValuationRepository.getWeightedAverageCost(company.id, line.itemId, record.fromWarehouseId, record.transferDate)
          : 0;

        const outEntry = ERP_StockLedgerRepository.recordMovement(company, {
          itemId: line.itemId, warehouseId: record.fromWarehouseId,
          transactionDate: record.transferDate, transactionType: "Transfer Out",
          quantity: -quantity, unitCost: null,
          referenceType: "StockTransfer", referenceId: record.id,
          narration: `Transfer ${record.transferNumber} to warehouse`
        }, actorUsername);

        const inEntry = ERP_StockLedgerRepository.recordMovement(company, {
          itemId: line.itemId, warehouseId: record.toWarehouseId,
          transactionDate: record.transferDate, transactionType: "Transfer In",
          quantity, unitCost,
          referenceType: "StockTransfer", referenceId: record.id,
          narration: `Transfer ${record.transferNumber} from warehouse`
        }, actorUsername);

        if (outEntry) linkedStockLedgerEntryIds.push(outEntry.id);
        if (inEntry) linkedStockLedgerEntryIds.push(inEntry.id);
      });
    }

    return this._patch(id, { status: "Completed", linkedStockLedgerEntryIds, skippedLineCount: skippedCount, completedByUsername: actorUsername, completedAt: new Date().toISOString() });
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
