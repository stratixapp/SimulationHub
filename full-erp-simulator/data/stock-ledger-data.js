/* =============================================================================
   DOT ERP
   FILE:  data/stock-ledger-data.js
   ROLE:  Data-access layer for Stock Ledger — Phase 7, Module 02. Every
          GRN receipt, Delivery Challan issue, Opening Stock, Stock
          Adjustment, and Stock Transfer writes one immutable entry here.
          Built BEFORE Opening Stock's own file even though the roadmap
          lists Opening Stock first — Opening Stock's own confirm() needs
          a Stock Ledger to post into, so this file has to exist first
          regardless of module numbering. Noted here so the ordering
          doesn't look accidental.

   "NO STORAGE, PURE COMPUTATION" LIKE GENERAL LEDGER, OR GENUINE STORAGE
   LIKE JOURNAL ENTRY? — THE QUESTION THIS FILE WAS ASKED TO ANSWER
   EXPLICITLY, NOT ASSUME. General Ledger has no storage key of its own
   because Journal Entry already IS the real, stored transactional record
   — General Ledger just re-walks Journal Entry's own lines per account,
   live, every time. For that shape to repeat here, Phase 7 would need
   its own "Journal Entry equivalent" for stock — a single already-real
   place every stock-moving action writes to — with Stock Ledger sitting
   on top of it as a pure per-item/warehouse view. But the roadmap names
   no such module. It says, in so many words, that GRN and Delivery
   Challan should already be "writing to" Stock Ledger — language that
   only makes sense if Stock Ledger itself is the thing being written to,
   not a view computed over something else. So: THIS FILE HAS GENUINE
   STORAGE (`ERP_STOCK_LEDGER_KEY`, `getAll()` / `_saveAll()`, real
   records with real ids) — structurally closer to Journal Entry than to
   General Ledger, even though its ROLE in the reporting chain that
   follows it (Stock Valuation Report, Low Stock Report both read from
   this file the way Trial Balance reads from General Ledger) matches
   General Ledger's role exactly. Storage architecture and reporting role
   are two different questions; Phase 6 happened to answer them the same
   way for General Ledger, but nothing requires that here.

   NO update() OR remove() EXIST ON THIS REPOSITORY AT ALL — not merely
   refused conditionally the way Journal Entry blocks editing a Posted
   entry (which still assumes an update() function you call and it says
   no). Here there is no function to call in the first place. A stock
   ledger entry records a fact that already, physically happened — goods
   were received, issued, counted, or moved — the moment its owning
   module's own lifecycle action (a GRN post(), a Delivery Challan
   issue(), an Opening Stock confirm(), a Stock Adjustment post(), a
   Stock Transfer complete()) finished. Undoing or editing that fact
   later doesn't undo the physical event; it just makes the books lie
   about what happened. The only honest correction is a NEW entry (a
   follow-up Stock Adjustment) — same "correction is a new record, not a
   rewrite" principle Journal Entry's reverse() and Bank Reconciliation's
   own notes already established for this project, taken one step
   further: not even a status-gate, just no rewrite path to begin with.

   SIGNED QUANTITY, NOT DEBIT/CREDIT — a deliberate simplification versus
   General Ledger's shape. Money has a normal-balance side because the
   same account can legitimately be debited or credited depending on
   context; a unit of physical stock doesn't work that way — it's either
   moving into a warehouse or out of one. So each entry carries one
   signed `quantity` (positive = in, negative = out) instead of two
   separate debit/credit fields, and a running balance is just a running
   sum — no contra-account flipping logic to port over from General
   Ledger at all.

   unitCost IS STORED ONLY ON INCOMING ENTRIES, AND ONLY AS A FACT
   CAPTURED AT THE MOMENT IT HAPPENED — never recomputed later. Opening
   Stock, GRN Receipt, Transfer In, and a positive (surplus) Stock
   Adjustment all know their own cost at write time and stamp it directly
   on the entry, the same way GRN itself copies price forward from PO
   rather than re-deriving it later. Outgoing entries (Delivery Issue,
   Transfer Out, a negative Stock Adjustment) store `unitCost: null` —
   the cost of what's going OUT is a FIFO consumption question, answered
   by `stock-valuation-data.js` at the moment it's asked, not a fact this
   file records. Quantity-only questions (current stock, low-stock
   checks) never need unitCost at all and stay fast; only Stock
   Valuation Report and Stock Transfer's own cost-carry-forward logic
   need to walk cost layers, and that logic lives in ONE place
   (`stock-valuation-data.js`), not duplicated here.

   TWO LEVELS OF BALANCE QUERY, FOR TWO DIFFERENT CONSUMERS: `getBalance()`
   answers "how much of item X is in warehouse Y" — what Opening Stock's
   own duplicate-guard and Stock Transfer's own from-warehouse check need.
   `getTotalStockForItem()` sums across every warehouse for a company —
   what Item Master's own now-computed `currentStock` rollup and the Low
   Stock report need, since a reorder decision in this project is made at
   the company level (see item-data.js's own header for the full
   currentStock reasoning). Both are simple signed-quantity sums; neither
   needs the FIFO layer walk that only valuation requires.
   ========================================================================== */

const ERP_STOCK_LEDGER_KEY = "erp_stock_ledger_entries";

/* PHASE 10 RETROFIT (Manufacturing): two additions to the vocabulary —
   "Material Issue" (OUT, a Work Order's own materials consumption) and
   "Finished Goods Receipt" (IN, a Work Order's own completed output).
   Nothing else about this file changed. recordMovement()'s existing
   generic `referenceType`/`referenceId` pair already fit a Work Order as
   a reference — see data/material-issue-data.js's own header for the
   full "checked, not assumed" reasoning the roadmap asked for. */
const ERP_StockLedgerRepository = {
  /* "Sales Return" added by Phase 15, Module 01 — additive only, the
     same treatment Phase 10 gave "Material Issue"/"Finished Goods
     Receipt". Checked before assuming anything else had to change:
     recordMovement()'s existing generic referenceType/referenceId pair
     already fits a Sales Return as a reference, and a return is an
     ordinary positive (inbound) movement, so no new write path or sign
     handling was needed at all. */
  /* "Purchase Return" added by Phase 15, Module 03a — additive only, the
     same treatment "Sales Return" got one module earlier. Checked
     first: recordMovement()'s existing generic referenceType/
     referenceId pair already fits, and this is an ordinary negative
     (outbound) movement, so no new write path or sign handling was
     needed. */
  transactionTypes: ["Opening Stock", "GRN Receipt", "Delivery Issue", "Stock Adjustment", "Transfer In", "Transfer Out", "Material Issue", "Finished Goods Receipt", "Sales Return", "Purchase Return"],

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_STOCK_LEDGER_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_STOCK_LEDGER_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((e) => e.companyId === companyId);
  },

  findById(id) {
    return this.getAll().find((e) => e.id === id) || null;
  },

  /** Chronological order (transactionDate, then createdAt as a
      tiebreaker for same-day entries) — the order both a running
      balance and a FIFO layer walk depend on. */
  getEntriesForItemWarehouse(companyId, itemId, warehouseId) {
    return this.getAllForCompany(companyId)
      .filter((e) => e.itemId === itemId && e.warehouseId === warehouseId)
      .sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate) || new Date(a.createdAt) - new Date(b.createdAt));
  },

  getEntriesForItem(companyId, itemId) {
    return this.getAllForCompany(companyId)
      .filter((e) => e.itemId === itemId)
      .sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate) || new Date(a.createdAt) - new Date(b.createdAt));
  },

  /** Signed-quantity sum for one item in one warehouse, optionally as of
      a given date (inclusive). No FIFO layers — see file header. */
  getBalance(companyId, itemId, warehouseId, asOfDate) {
    return this.getEntriesForItemWarehouse(companyId, itemId, warehouseId)
      .filter((e) => !asOfDate || e.transactionDate <= asOfDate)
      .reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
  },

  /** Company-wide total for an item, across every warehouse. */
  getTotalStockForItem(companyId, itemId, asOfDate) {
    return this.getEntriesForItem(companyId, itemId)
      .filter((e) => !asOfDate || e.transactionDate <= asOfDate)
      .reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
  },

  /** Every distinct (item, warehouse) pair that has at least one entry,
      each with its current balance and last movement date — the row
      shape Stock Ledger's own summary table needs. Pairs that have
      netted back to exactly zero (e.g. a full transfer out with nothing
      left) are still included; a real stock ledger doesn't hide an
      account just because its balance happens to be zero right now. */
  getActivePairsForCompany(companyId) {
    const all = this.getAllForCompany(companyId);
    const byKey = new Map();
    all.forEach((e) => {
      const key = e.itemId + "::" + e.warehouseId;
      if (!byKey.has(key)) byKey.set(key, { itemId: e.itemId, warehouseId: e.warehouseId, entries: [] });
      byKey.get(key).entries.push(e);
    });
    return [...byKey.values()].map((pair) => {
      const sorted = pair.entries.slice().sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate) || new Date(a.createdAt) - new Date(b.createdAt));
      const balance = sorted.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
      const last = sorted[sorted.length - 1];
      return { itemId: pair.itemId, warehouseId: pair.warehouseId, balance, entryCount: sorted.length, lastTransactionDate: last.transactionDate, lastTransactionType: last.transactionType };
    });
  },

  /** Entries for one (item, warehouse) pair with a running balance
      attached to each row — the exact shape General Ledger's own
      getLedgerForAccount() returns for one account, just quantity-only
      instead of debit/credit. */
  getLedgerRows(companyId, itemId, warehouseId) {
    let running = 0;
    return this.getEntriesForItemWarehouse(companyId, itemId, warehouseId).map((e) => {
      running += Number(e.quantity) || 0;
      return { entry: e, runningBalance: running };
    });
  },

  /** The ONLY way an entry comes into existence — see file header for
      why there's no corresponding update()/remove(). Validates the
      transaction type against the controlled vocabulary and refuses a
      zero quantity (a movement that moves nothing isn't a movement).
      Never throws; returns null on anything invalid so a calling
      module's own posting logic can degrade gracefully instead of
      crashing mid-loop over several lines. */
  recordMovement(company, data, actorUsername) {
    if (!data || !data.itemId || !data.warehouseId) return null;
    if (!this.transactionTypes.includes(data.transactionType)) return null;
    const quantity = Number(data.quantity);
    if (!quantity || isNaN(quantity)) return null;

    const record = {
      id: "SLE-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      itemId: data.itemId,
      warehouseId: data.warehouseId,
      transactionDate: data.transactionDate || new Date().toISOString().slice(0, 10),
      transactionType: data.transactionType,
      quantity,
      unitCost: (data.unitCost === null || data.unitCost === undefined || isNaN(Number(data.unitCost))) ? null : Number(data.unitCost),
      referenceType: data.referenceType || null,
      referenceId: data.referenceId || null,
      narration: data.narration || "",
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString()
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  }
};
