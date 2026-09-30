/* =============================================================================
   DOT ERP
   FILE:  data/stock-valuation-data.js
   ROLE:  Data-access layer for Stock Valuation Report — Phase 7, Module
          05 (report). No storage key, same "thin computation over an
          already-real ledger" shape as Trial Balance / P&L / Balance
          Sheet over General Ledger. Nothing created, edited, or deleted
          here — this file only ever reads stock-ledger-data.js.

          BUILT EARLY, SHIPPED LATE: the roadmap lists this as module 05,
          after Stock Transfer (04), but Stock Transfer's own cost
          carry-forward logic (see below) needs this file's FIFO engine
          to exist first. Real dependency order won out over roadmap
          numbering here the same way it did for Stock Ledger needing to
          exist before Opening Stock's own file — the report PAGE ships
          in roadmap order; the underlying computation doesn't wait.

   FIFO, NOT WEIGHTED AVERAGE — CHOSEN DELIBERATELY, NOT DEFAULTED. Both
   are real, AS-2/Ind-AS-2-compliant costing methods; this project could
   defensibly have picked either. Weighted Average is the simpler
   implementation — one running number per (item, warehouse), recomputed
   on every receipt, no queue to maintain. FIFO is genuinely more work:
   it needs an ordered queue of cost "layers" (see `computeFifoState()`
   below) that get consumed oldest-first, including the fiddly case of
   one outgoing movement partially draining one layer and spilling into
   the next. That extra complexity is exactly why FIFO was chosen over
   the simpler option: this is the first genuinely new data structure in
   the whole project (nothing before this needed an ordered, partially-
   consumable queue), and FIFO is also the method most accounting courses
   introduce first, making the training value of watching layers actually
   get consumed, oldest first, worth the extra implementation risk — which
   is exactly why every scenario below was hand-traced and verified in a
   Node sandbox before this file was trusted, the same bar General
   Ledger's running balance and Balance Sheet's five scenarios were held
   to. Weighted Average is a legitimate alternative a future session
   could add as a second selectable method; it was not silently skipped,
   it was compared and set aside.

   THE INVARIANT THIS FILE PROTECTS: at any point, a FIFO layer walk's
   own total remaining quantity must equal Stock Ledger's own plain
   signed-quantity running balance for that same (item, warehouse) —
   `computeFifoState()`'s returned `totalQuantity - shortfallQuantity`
   always equals `ERP_StockLedgerRepository.getBalance()` for the same
   inputs. If those two ever disagreed, the valuation report and the
   stock ledger page would show two different "how much do we have"
   answers for the same thing, which is the one inconsistency a training
   simulator absolutely cannot afford. `shortfallQuantity` exists purely
   to preserve this invariant: if an outgoing movement is ever posted
   for more than the layers on hand can cover (a Delivery Challan issued
   before Opening Stock was ever entered for that item, for instance),
   the excess is tracked as a shortfall rather than either silently
   clamping at zero (which would break the invariant above) or letting a
   layer's own quantity go negative (which would corrupt valuation math
   for anyone reading that layer). A later incoming movement pays down
   the shortfall first, before it starts building new real layers — the
   same way the ledger's own signed sum would naturally recover.

   STOCK TRANSFER'S COST CARRY-FORWARD USES THE SIMPLER "CURRENT AVERAGE,"
   NOT A PARTIAL FIFO SLICE — a deliberate, named simplification. When
   units move warehouse-to-warehouse, the destination's incoming layer
   needs SOME cost basis carried forward from the source. Strict FIFO
   would require peeling exactly the transferred quantity off the front
   of the source's own layer queue, potentially splitting one layer's
   quantity between "stays behind" and "goes with the transfer" — solvable,
   but materially harder to get right and to verify than the reporting
   math above, for a benefit (slightly more precise costing on transfers
   specifically) that's marginal in a training context. Instead,
   `getWeightedAverageCost()` below returns the average cost of
   everything currently on hand in the source warehouse, and Stock
   Transfer stamps that single number on its own "Transfer In" entry.
   This is honest, real-ERP-adjacent behavior (several real systems cost
   inter-warehouse transfers at moving average specifically, even when
   the item's own primary valuation method is FIFO) — not a shortcut
   dressed up as the "right" answer.
   ========================================================================== */

const ERP_StockValuationRepository = {

  /** Walks every entry for (itemId, warehouseId) up to and including
      asOfDate, in chronological order, building and consuming a FIFO
      layer queue. Returns:
      { layers: [{quantity, unitCost, entryDate, sourceEntryId}],
        totalQuantity, totalValue, averageUnitCost, shortfallQuantity,
        asOfDate }
      Never throws — an item/warehouse with no entries yet returns an
      all-zero result. */
  computeFifoState(companyId, itemId, warehouseId, asOfDate) {
    const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);
    const entries = (typeof ERP_StockLedgerRepository !== "undefined")
      ? ERP_StockLedgerRepository.getEntriesForItemWarehouse(companyId, itemId, warehouseId).filter((e) => e.transactionDate <= effectiveDate)
      : [];

    let layers = [];
    let shortfallQuantity = 0;

    entries.forEach((entry) => {
      let quantity = Number(entry.quantity) || 0;
      if (quantity === 0) return;

      if (quantity > 0) {
        // Incoming: first pay down any outstanding shortfall, then
        // whatever's left over becomes a new layer.
        if (shortfallQuantity > 0) {
          const offset = Math.min(shortfallQuantity, quantity);
          shortfallQuantity -= offset;
          quantity -= offset;
        }
        if (quantity > 0) {
          layers.push({ quantity, unitCost: Number(entry.unitCost) || 0, entryDate: entry.transactionDate, sourceEntryId: entry.id });
        }
      } else {
        // Outgoing: consume oldest layers first.
        let need = Math.abs(quantity);
        while (need > 0 && layers.length > 0) {
          const front = layers[0];
          if (front.quantity <= need) {
            need -= front.quantity;
            layers.shift();
          } else {
            front.quantity -= need;
            need = 0;
          }
        }
        if (need > 0) shortfallQuantity += need;
      }
    });

    const totalQuantity = layers.reduce((s, l) => s + l.quantity, 0);
    const totalValue = layers.reduce((s, l) => s + l.quantity * l.unitCost, 0);
    const averageUnitCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

    return { layers, totalQuantity, totalValue, averageUnitCost, shortfallQuantity, asOfDate: effectiveDate };
  },

  /** Cost of consuming `quantityToConsume` units, oldest layers first, from the
      state as of `asOfDate` — i.e. call this BEFORE the outgoing Stock Ledger
      entry for that same date is written, so `computeFifoState()` still sees
      the pre-consumption layers. Used by GL Posting to cost COGS on a Delivery
      Challan (see gl-posting-data.js `postDeliveryCogs()`). Mirrors the same
      oldest-layer-first walk `computeFifoState()` itself uses for an outgoing
      entry, kept separate so it can run BEFORE that entry exists rather than
      by re-deriving it from a ledger that already includes the entry.
      If there isn't enough layered stock to cover the quantity (should be
      rare — Delivery Challan normally follows a GRN/Opening Stock receipt,
      but a Sales Return re-adding stock with no original receipt can leave a
      shortfall), the uncovered portion is costed at the pre-consumption
      average so COGS is never silently understated; `shortfallQuantity`
      reports how much of that happened. Never throws — no layers at all
      returns `{ cost: 0, shortfallQuantity: quantityToConsume, ... }`. */
  computeConsumptionCost(companyId, itemId, warehouseId, asOfDate, quantityToConsume) {
    const state = this.computeFifoState(companyId, itemId, warehouseId, asOfDate);
    let need = Math.max(0, Number(quantityToConsume) || 0);
    let cost = 0;
    const layers = state.layers.map((l) => ({ ...l }));   // local copy — never mutate the state we just computed
    while (need > 0 && layers.length > 0) {
      const front = layers[0];
      const taken = Math.min(front.quantity, need);
      cost += taken * front.unitCost;
      front.quantity -= taken;
      need -= taken;
      if (front.quantity <= 0) layers.shift();
    }
    const shortfallQuantity = need;
    if (shortfallQuantity > 0) cost += shortfallQuantity * state.averageUnitCost;   // best available estimate, not a silent zero
    return { cost, shortfallQuantity, averageCostUsed: state.averageUnitCost, layersBefore: state.layers.length };
  },

  /** Convenience used by Stock Transfer — see file header. */
  getWeightedAverageCost(companyId, itemId, warehouseId, asOfDate) {
    return this.computeFifoState(companyId, itemId, warehouseId, asOfDate).averageUnitCost;
  },

  /** {asOfDate, warehouseId (or null = all), rows:[{item, warehouseId or
      null, quantity, value, averageUnitCost, layers, shortfallQuantity}],
      grandTotalValue, grandTotalQuantity}. One row per item. When
      `warehouseId` is given, each row is that item's state in that one
      warehouse. When omitted ("All Warehouses"), each row aggregates the
      item's FIFO state across every warehouse it has activity in — the
      row's own `layers` is the concatenation of all those warehouses'
      remaining layers, sorted oldest first, so the drill-down still
      reads as one coherent FIFO queue. Only items with at least one
      Stock Ledger entry appear — an item nobody's ever moved yet isn't
      "zero-valued," it's simply not part of this ledger-driven report,
      the same way an account with no journal entries doesn't appear on
      Trial Balance. */
  getValuationReport(companyId, asOfDate, warehouseId) {
    const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);
    if (typeof ERP_StockLedgerRepository === "undefined" || typeof ERP_ItemRepository === "undefined") {
      return { asOfDate: effectiveDate, warehouseId: warehouseId || null, rows: [], grandTotalValue: 0, grandTotalQuantity: 0 };
    }

    const pairs = ERP_StockLedgerRepository.getActivePairsForCompany(companyId)
      .filter((p) => !warehouseId || p.warehouseId === warehouseId);

    const itemIds = [...new Set(pairs.map((p) => p.itemId))];

    const rows = itemIds.map((itemId) => {
      const item = ERP_ItemRepository.findById(itemId);
      const itemPairs = pairs.filter((p) => p.itemId === itemId);

      let layers = [];
      let totalQuantity = 0, totalValue = 0, shortfallQuantity = 0;
      itemPairs.forEach((p) => {
        const state = this.computeFifoState(companyId, itemId, p.warehouseId, effectiveDate);
        layers = layers.concat(state.layers.map((l) => ({ ...l, warehouseId: p.warehouseId })));
        totalQuantity += state.totalQuantity;
        totalValue += state.totalValue;
        shortfallQuantity += state.shortfallQuantity;
      });
      layers.sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));

      return {
        item, itemId,
        warehouseId: warehouseId || null,
        quantity: totalQuantity,
        value: totalValue,
        averageUnitCost: totalQuantity > 0 ? totalValue / totalQuantity : 0,
        shortfallQuantity,
        layers
      };
    }).filter((r) => r.item)
      .sort((a, b) => b.value - a.value);

    const grandTotalValue = rows.reduce((s, r) => s + r.value, 0);
    const grandTotalQuantity = rows.reduce((s, r) => s + r.quantity, 0);

    return { asOfDate: effectiveDate, warehouseId: warehouseId || null, rows, grandTotalValue, grandTotalQuantity };
  }
};
