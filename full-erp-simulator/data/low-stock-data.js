/* =============================================================================
   DOT ERP
   FILE:  data/low-stock-data.js
   ROLE:  Data-access layer for Low Stock / Reorder Level Report — Phase
          7, Module 06, the last one on the roadmap. No storage key —
          the thinnest report in this whole phase: it reuses Item
          Master's own `reorderLevel` field exactly as-is (per this
          phase's own brief) and its own already-existing
          `getStockUsage()`/`getStockHealthBand()` helpers, which by the
          time this file exists are already reading the LIVE, Stock-
          Ledger-computed current stock (see item-data.js's own header).
          This file adds no new computation of its own — it filters and
          sorts, the same "thin report over an already-established
          source of truth" shape AP/AR Aging established over Vendor
          Payment / Sales Receipt.

   WHY THIS DOESN'T LIVE INSIDE item-data.js ITSELF: item-data.js's job
   is one item at a time (health band for a single record, shown as a
   badge on a list row or a detail modal). This file's job is the
   opposite direction — given a whole company's worth of items, which
   ones need attention right now, ranked by how urgently. That's a
   different shape of question (a report, not a per-record lookup), so
   it gets its own file the same way AP Aging and AR Aging are their own
   files even though both ultimately read Vendor Payment / Sales Receipt
   data that already has its own repository.

   SORTED MOST-CRITICAL-FIRST BY RATIO, NOT BY RAW GAP — an item 5 units
   below a reorder level of 10 (50% of threshold) is a more urgent problem
   than an item 500 units below a reorder level of 10,000 (95% of
   threshold), even though the second gap is numerically larger. Sorting
   by `currentStock / reorderLevel` ascending puts the truly critical
   items at the top regardless of the absolute scale of any one item's
   numbers — items with a zero or unset reorder level are excluded
   entirely up front, the same "not tracked for reordering" treatment
   getStockHealthBand() already gives them.
   ========================================================================== */

const ERP_LowStockRepository = {

  /** {rows: [{item, usage, band}], criticalCount, lowCount}. `usage` is
      whatever getStockUsage() returned (reorderLevel, currentStock, gap,
      fillPct); `band` is "critical" or "low" — "healthy" items never
      appear on this report at all, the same way a fully-paid invoice
      never appears on an aging report. */
  getReport(companyId) {
    if (typeof ERP_ItemRepository === "undefined") return { rows: [], criticalCount: 0, lowCount: 0 };

    const rows = ERP_ItemRepository.getActiveForCompany(companyId)
      .filter((item) => Number(item.reorderLevel) > 0)
      .map((item) => ({ item, usage: ERP_ItemRepository.getStockUsage(item), band: ERP_ItemRepository.getStockHealthBand(item) }))
      .filter((row) => row.band !== "healthy")
      .sort((a, b) => (a.usage.currentStock / a.usage.reorderLevel) - (b.usage.currentStock / b.usage.reorderLevel));

    return {
      rows,
      criticalCount: rows.filter((r) => r.band === "critical").length,
      lowCount: rows.filter((r) => r.band === "low").length
    };
  }
};
