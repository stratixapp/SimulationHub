/* =============================================================================
   DOT ERP
   FILE:  data/opening-stock-data.js
   ROLE:  Data-access layer for Opening Stock — Phase 7, Module 01. The
          starting balance a Stock Ledger needs before anything else
          (GRN, Delivery Challan, Stock Adjustment, Stock Transfer) can
          move against it. Plays the same role for Stock Ledger that
          Chart of Accounts' own `openingBalance` field plays for General
          Ledger — a one-time seed value everything downstream builds on
          — except per (item, warehouse) pair instead of per account,
          because Multiple Warehouses (Phase 3) already exist and a
          single company-wide starting quantity can't represent "50 in
          Warehouse A, 30 in Warehouse B."

   BUILT AS ITS OWN RECORD, NOT A FIELD ON ITEM MASTER — Chart of
   Accounts got to keep `openingBalance` as a plain field on the account
   itself because an account only ever has ONE starting balance. An item
   doesn't: it has one potential starting balance PER warehouse, decided
   at a point in time. That's a real record with its own lifecycle, not
   a field — which is also why Item Master's own pre-existing
   `currentStock` field can't be reused for this (see item-data.js's own
   header for the full reasoning on what happens to that field now).

   HARD UNIQUENESS ON A COMPOSITE (itemId, warehouseId) KEY — the same
   duplicate-check shape Quotation Receipt established first for
   (rfqId, vendorId): not a single field, not a cross-parent exclusivity
   claim, but "at most one non-Cancelled record for this exact pair."
   Opening stock for one item in one warehouse is a single fact, decided
   once — a second Draft for the same pair isn't a new fact, it's a
   duplicate attempt at the same fact.

   LIFECYCLE — Draft -> Confirmed, or Draft -> Cancelled. Deliberately
   the same shape Journal Entry established for anything that posts to a
   ledger, not this project's more common "edit until Approved, then
   still adjustable" shape: a Draft is freely editable (quantity, unit
   cost, and date can all be corrected — nothing's happened yet).
   `confirm()` is the one moment this record actually writes to Stock
   Ledger (transaction type "Opening Stock", quantity = +openingQuantity,
   with the entered unitCost carried forward as-is — see stock-ledger-
   data.js's own header on why incoming entries store cost as a captured
   fact). PHASE 19 RETROFIT: the page now also calls gl-posting-
   data.js's own new `postOpeningStock()` right after a successful
   confirm() — `Dr Inventory / Cr Opening Balance Equity` — nothing
   changed in this function itself, since `openingQuantity * unitCost`
   was already sitting right there on the record with nothing left to
   derive; see that file's own header, item 11. ONCE CONFIRMED, update()/remove() BOTH REFUSE, and — unlike
   Journal Entry, which allows a Posted entry to be undone via a
   reversing entry — THERE IS NO UN-CONFIRM AT ALL. A journal entry can
   be reversed because a reversal is itself just another balanced entry;
   there's no equivalent safe "undo" for a fact as foundational as "this
   is where the ledger starts." If a confirmed opening quantity turns out
   to be wrong, the honest fix is a Stock Adjustment against the same
   item/warehouse afterward — a new, dated correction, not a rewritten
   starting point. Cancel is only available from Draft, for a mistaken
   entry that was never confirmed — the same "terminal state, no reopen"
   shape Purchase Closure and Sales Close already established at the
   end-of-process level, applied here at the individual-record level
   instead.

   THIS FILE HAS A REAL DEPENDENCY ON stock-ledger-data.js (its own
   `confirm()` calls `ERP_StockLedgerRepository.recordMovement()`
   directly, typeof-guarded) — unlike the GRN/Delivery Challan retrofit,
   which had to reach Stock Ledger through a separate orchestration file
   (`stock-posting-data.js`) specifically to avoid touching two already-
   shipped modules. Opening Stock is a brand-new Phase 7 module built
   alongside Stock Ledger in the same session, so there's no "keep it
   ignorant of a concept that didn't exist when it shipped" constraint to
   honor — a direct, typeof-guarded call is the honest shape here, the
   same way Stock Adjustment and Stock Transfer's own data files call
   Stock Ledger directly rather than through a retrofit layer.
   ========================================================================== */

const ERP_OPENING_STOCK_KEY = "erp_opening_stock";

const ERP_OpeningStockRepository = {
  statuses: ["Draft", "Confirmed", "Cancelled"],

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_OPENING_STOCK_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_OPENING_STOCK_KEY, JSON.stringify(list)); return true; }
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

  /** At most one non-Cancelled record per (itemId, warehouseId) pair —
      see file header. */
  hasDuplicateForItemWarehouse(companyId, itemId, warehouseId, excludeId) {
    return this.getAllForCompany(companyId).some((r) =>
      r.id !== excludeId && r.itemId === itemId && r.warehouseId === warehouseId && r.status !== "Cancelled"
    );
  },

  canEdit(record) {
    return record.status === "Draft";
  },
  canDelete(record) {
    return record.status === "Draft";
  },
  canConfirm(record) {
    if (record.status !== "Draft") return false;
    if (!record.itemId || !record.warehouseId) return false;
    const qty = Number(record.openingQuantity);
    if (isNaN(qty) || qty <= 0) return false;
    const cost = Number(record.unitCost);
    if (isNaN(cost) || cost < 0) return false;
    return true;
  },
  canCancel(record) {
    return record.status === "Draft";
  },

  create(company, data, actorUsername) {
    const record = {
      id: "OS-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      itemId: null,
      warehouseId: null,
      openingQuantity: 0,
      unitCost: 0,
      asOfDate: new Date().toISOString().slice(0, 10),
      notes: "",
      status: "Draft",
      linkedStockLedgerEntryId: null,
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

  /** Writes the one Stock Ledger entry this record will ever produce.
      Never throws if Stock Ledger isn't loaded on the page — degrades to
      "confirmed, but nothing posted yet," same defensive shape as every
      other typeof-guarded cross-module call in this project; in
      practice every page that loads this file also loads
      stock-ledger-data.js, so this is a safety net, not the expected
      path. */
  confirm(id, company, actorUsername) {
    const record = this.findById(id);
    if (!record || !this.canConfirm(record)) return null;

    let linkedStockLedgerEntryId = null;
    if (typeof ERP_StockLedgerRepository !== "undefined") {
      const entry = ERP_StockLedgerRepository.recordMovement(company, {
        itemId: record.itemId,
        warehouseId: record.warehouseId,
        transactionDate: record.asOfDate,
        transactionType: "Opening Stock",
        quantity: Number(record.openingQuantity),
        unitCost: Number(record.unitCost),
        referenceType: "OpeningStock",
        referenceId: record.id,
        narration: record.notes || ""
      }, actorUsername);
      if (entry) linkedStockLedgerEntryId = entry.id;
    }

    return this._patch(id, {
      status: "Confirmed",
      linkedStockLedgerEntryId,
      confirmedByUsername: actorUsername,
      confirmedAt: new Date().toISOString()
    });
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
