/* =============================================================================
   DOT ERP
   FILE:  data/inventory-valuation-data.js
   ROLE:  Data-access layer for Inventory Valuation Report — Phase 8, Module
          04. No storage key, thinnest kind of wrapper this project has: it
          adds exactly one thing (top-level-category grouping with
          subtotals) on top of a computation Phase 7 already built and
          already trusts.

   GENUINELY DIFFERENT FROM STOCK VALUATION REPORT, NOT A DUPLICATE — READ
   STOCK VALUATION REPORT'S OWN FILE HEADER FIRST, THEN DECIDED: the roadmap
   names this separately from Phase 7's own Stock Valuation Report, which
   could have meant either "build a second FIFO engine" or "wire the
   existing one into this phase's reporting hub." It's neither. Stock
   Valuation Report is an OPERATIONAL tool — flat, one row per item, built
   for a warehouse or inventory manager who wants to drill into one item's
   own FIFO layers right now. This file produces something a controller
   closing the books would actually want instead: a formal, CATEGORY-
   GROUPED cut with subtotals and a grand total, the same "financial
   statement" shape Trial Balance and Balance Sheet already use, applied to
   inventory instead of ledger accounts. Different audience, different
   structure, same underlying FIFO numbers — reused, not re-derived, via
   ERP_StockValuationRepository.getValuationReport() directly (including
   its own `asOfDate` support, which already existed and already needed no
   changes to answer "what was inventory worth as of a past date").

   GROUPED BY TOP-LEVEL CATEGORY, NOT AN ITEM'S OWN LEAF CATEGORY —
   DECIDED, NOT DEFAULTED: Category Master supports arbitrary nesting
   ("Electronics > Computers > Laptops"), and grouping by the leaf would
   produce as many small groups as there are deep categories in use — not
   the clean "Raw Materials / Finished Goods / Consumables"-style cut a
   real closing pack wants. Each row's item still carries its own full
   category, but the GROUPING itself climbs to the top of Category
   Master's own `getAncestors()` chain first.

   DELIBERATELY DOES NOT ADD A WEIGHTED-AVERAGE COMPARISON, EVEN THOUGH
   `getWeightedAverageCost()` ALREADY EXISTS: it was tempting, but that
   function was read directly before deciding, not assumed reusable —
   it returns the blended cost of whatever FIFO layers are CURRENTLY on
   hand (used narrowly by Stock Transfer to price a transfer's destination
   layer), not a true from-day-one Weighted Average costing method
   recomputed on every receipt. Presenting that number as an alternative
   valuation TOTAL for the whole inventory would conflate two genuinely
   different costing methods rather than compare them. A real side-by-side
   would need its own from-scratch engine and its own Node-sandbox
   verification, the same rigor bar Stock Valuation Report's own FIFO
   engine was held to — out of scope here, and better left undone than
   done wrong.
   ========================================================================== */

const ERP_InventoryValuationRepository = {

  /** {asOfDate, warehouseId, groups:[{categoryId, categoryName, rows,
      subtotalValue, subtotalQuantity}], grandTotalValue, grandTotalQuantity,
      itemCount}. `asOfDate`/`warehouseId` pass straight through to
      ERP_StockValuationRepository.getValuationReport() — see that
      function's own header for what they mean. */
  getReport(companyId, asOfDate, warehouseId) {
    if (typeof ERP_StockValuationRepository === "undefined") {
      return { asOfDate: asOfDate || "", warehouseId: warehouseId || null, groups: [], grandTotalValue: 0, grandTotalQuantity: 0, itemCount: 0 };
    }

    const valuation = ERP_StockValuationRepository.getValuationReport(companyId, asOfDate, warehouseId);

    const groupsById = new Map();
    valuation.rows.forEach((row) => {
      const { categoryId, categoryName } = this._resolveTopLevelCategory(companyId, row.item);
      const key = categoryId || "_uncategorized";
      if (!groupsById.has(key)) {
        groupsById.set(key, { categoryId, categoryName, rows: [], subtotalValue: 0, subtotalQuantity: 0 });
      }
      const group = groupsById.get(key);
      group.rows.push(row);
      group.subtotalValue += row.value;
      group.subtotalQuantity += row.quantity;
    });

    const groups = [...groupsById.values()].sort((a, b) => b.subtotalValue - a.subtotalValue);
    groups.forEach((g) => g.rows.sort((a, b) => b.value - a.value));

    return {
      asOfDate: valuation.asOfDate,
      warehouseId: valuation.warehouseId,
      groups,
      grandTotalValue: valuation.grandTotalValue,
      grandTotalQuantity: valuation.grandTotalQuantity,
      itemCount: valuation.rows.length
    };
  },

  /** Climbs Category Master's own getAncestors() chain to the root. An
      item with no category (shouldn't happen — Item Master requires one —
      but handled the same defensive way a removed link is handled
      elsewhere in this project) is bucketed under "Uncategorized" rather
      than dropped. */
  _resolveTopLevelCategory(companyId, item) {
    if (!item || !item.categoryId || typeof ERP_CategoryRepository === "undefined") {
      return { categoryId: null, categoryName: "Uncategorized" };
    }
    const ancestors = ERP_CategoryRepository.getAncestors(companyId, item.categoryId);
    const top = ancestors.length ? ancestors[0] : ERP_CategoryRepository.findById(item.categoryId);
    if (!top) return { categoryId: null, categoryName: "Uncategorized" };
    return { categoryId: top.id, categoryName: top.categoryName };
  }
};
