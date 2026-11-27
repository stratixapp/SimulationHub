/* =============================================================================
   DOT ERP
   FILE:  data/item-data.js
   ROLE:  Data-access layer for Item Master — Phase 3, Module 06. The module
          Category Master and Unit Master were reordered ahead of (see their
          own file headers, and CONTINUE_HERE.md Section 10) specifically so
          this file could consume both as REQUIRED fields, not optional
          extras — a real item's category and unit of measure are core to
          what the record even means.

   CATEGORY LINK: categoryId is required, and the picker is filtered by
   Category Type to match this item's own Item Type — Service items only
   offer Service categories, the other four item types only offer Product
   categories (see category-data.js's header for why that split exists).
   Stored as an id and looked up LIVE via ERP_CategoryRepository, the
   standard "store the id, don't copy the fields" convention every cross-
   module reference in this codebase already follows — including degrading
   gracefully (a category-lookup helper below returns "—" style fallbacks)
   if a linked category is later deleted, exactly as Category Master's own
   file header promised its delete guard would require of any consumer.

   UNIT LINK, AND WHY UNIT MASTER'S CONVERSION MACHINERY EXISTS AT ALL:
   `unitId` is the item's base stock/tracking unit (required). `purchase-
   UnitId` is OPTIONAL — the unit a vendor might sell it in, when that
   differs from how it's stocked (Box vs. Pcs). This is the exact payoff
   Unit Master's header promised: the two must be CONVERTIBLE (share a
   common ultimate base via ERP_UnitRepository.getConversionFactor), which
   this file validates at save time via isValidPurchaseUnit() rather than
   letting an item silently claim a nonsensical pairing (e.g. Kg as a
   "purchase unit" for something stocked in Pcs).

   TAX / HSN RETROFIT (now complete — Tax Master and HSN Master exist):
   `taxCategoryId` (optional, direct override to a Tax Master record) and
   `hsnCodeId` (optional, link to HSN Master) were added once both modules
   existed, exactly as promised when this file first shipped without them
   (see CONTINUE_HERE.md Section 9's RETROFIT PATTERN). getEffectiveTax-
   Code() below resolves the two together: an item's own `taxCategoryId`
   wins if set; otherwise it falls back to whatever `hsnCodeId` links to's
   own `defaultTaxCodeId`; otherwise null. This is the SAME "own override
   wins, otherwise inherit from a linked record, resolved live every call"
   shape as Vendor Master's getEffectivePaymentTerms() and Warehouses'
   getEffectiveAddress(), just chained one hop further (item -> HSN code ->
   tax code, rather than a single direct link) — still never copied at
   creation time, so a later change to the HSN code's default is reflected
   immediately by every item that hasn't set its own override.

   REORDER LEVEL vs. CURRENT STOCK — THE BUDGET-BAR SHAPE, INVERTED:
   This is the fourth appearance of the "limit vs. actual" pattern (Cost
   Centers' budget, Warehouses' capacity, Customer Master's credit limit),
   and it reuses the same `.budget-bar` CSS component — but the DIRECTION
   is the opposite of all three earlier cases. There, a FULL bar (high
   utilization) is the danger signal (spending too much, too full, owes
   too much). Here, a LOW current stock relative to the reorder level is
   the danger signal — the real-world equivalent of a fuel gauge, not a
   spending meter: empty/red is bad, full/green is good. getStockUsage()
   deliberately computes a `fillPct` that represents how WELL-STOCKED the
   item is (capped against a 2x-reorder-level "comfortably restocked"
   ceiling) so the bar fills UP as stock health improves, and
   getStockHealthBand() classifies "critical" (at or below reorder level)
   /"low"/"healthy" independently of that fill number — the calling page
   is expected to map "critical" to the same `--over` (red) CSS modifier
   the other three modules use for THEIR bad case, and "healthy" to the
   default (green), even though what counts as "full" now means the
   opposite thing. This is worth getting right deliberately: a naive copy-
   paste of Cost Centers' getUtilizationBand (which colors HIGH values red)
   would color a well-stocked item red and an empty one green — backwards.

   DUPLICATE CHECK: itemName is hard-blocked, company-wide — the same
   "internal, curated identifier" bucket Category/Unit/Departments fall
   into. SKU is optional free text, but hard-blocked WHEN GIVEN — the same
   "optional-but-unique-if-present" shape Vendor/Customer Master's GSTIN
   already established, applied here for a fourth time.

   DELETE GUARD: none yet — nothing references an item by id until Phase 4
   (Procurement)/5 (Sales)/6 (Inventory) exist, same situation Vendor/
   Customer Master were in relative to their own not-yet-built consumers.

   PHASE 7 RETROFIT — currentStock BECOMES A COMPUTED ROLLUP, THE SAME WAY
   CHART OF ACCOUNTS' BALANCE BECAME COMPUTED ONCE JOURNAL ENTRY EXISTED.
   `currentStock` was added early (Phase 3, for the Dashboard) as a plain
   editable field, before this project had any real concept of a stock
   ledger — it was always a placeholder standing in for a computation that
   didn't exist yet, unlike Chart of Accounts' `openingBalance`, which was
   a genuine one-time seed value from day one. Now that Stock Ledger
   (`stock-ledger-data.js`) and Opening Stock both exist, the honest
   source of truth for "how much of this do we have" is the ledger, not
   this field — and it can't be a single company-wide number anymore
   either, since Multiple Warehouses (Phase 3) mean the true answer is
   "how much, in which warehouse," summed.

   `getLiveCurrentStock()` below is the one new seam this retrofit adds:
   if Stock Ledger is loaded AND has ever seen a movement for this item
   (Opening Stock confirmed, or any GRN/Delivery/Adjustment/Transfer
   posted against it), it returns the live, ledger-computed total across
   every warehouse. Otherwise it falls back to the item's own stored
   `currentStock` — a legacy number that matters only for items nobody's
   run through Opening Stock yet, so the Dashboard and this item's own
   stock-health badge don't just show zero the instant Phase 7 code loads
   for a company that hasn't finished onboarding every item into it.
   `getStockUsage()` and `getStockHealthBand()` below both now read
   through this helper instead of `item.currentStock` directly — a small,
   additive, signature-unchanged retrofit (both already took the whole
   item object, not a raw number, so every existing call site — Dashboard,
   the Items list, PR/PO stock-health badges — picks up the fix with zero
   changes of its own). `reorderLevel` is deliberately UNCHANGED and
   stays a single company-wide field, exactly as Phase 7's own brief
   specified reusing it as-is: a reorder decision in this project is made
   at the company level, not per warehouse.

   The Items page itself (`items.js`) was retrofitted alongside this file:
   the Current Stock input on the Add form still accepts a starting legacy
   value for a brand-new item (there's nothing to compute from yet), but
   on Edit, once Stock Ledger shows any real activity for that item, the
   field becomes a read-only, live, per-warehouse breakdown instead of a
   free-editable number — see items.js's own header for the full retrofit
   note.
   ========================================================================== */

const ERP_ITEMS_KEY = "erp_items";

const ERP_ITEM_TYPES = ["Raw Material", "Semi-Finished Good", "Finished Good", "Consumable", "Service"];

const ERP_ItemRepository = {
  itemTypes: ERP_ITEM_TYPES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_ITEMS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_ITEMS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((i) => i.companyId === companyId)
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  },

  findById(id) {
    return this.getAll().find((i) => i.id === id) || null;
  },

  getActiveForCompany(companyId) {
    return this.getAllForCompany(companyId).filter((i) => i.status === "Active");
  },

  /** COMP-001-ITM-01, COMP-001-ITM-02, ... */
  nextItemCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((i) => {
      const match = /-ITM-(\d+)$/.exec(i.itemCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-ITM-${String(max + 1).padStart(2, "0")}`;
  },

  hasDuplicateName(companyId, itemName, excludeId) {
    const target = itemName.trim().toLowerCase();
    return this.getAllForCompany(companyId).some((i) => i.id !== excludeId && i.itemName.trim().toLowerCase() === target);
  },

  /** Hard-blocked only when a SKU is actually given — same "optional but
      unique if present" shape as Vendor/Customer Master's GSTIN check. */
  hasDuplicateSku(companyId, sku, excludeId) {
    const target = String(sku || "").trim().toLowerCase();
    if (!target) return false;
    return this.getAllForCompany(companyId).some((i) => i.id !== excludeId && (i.sku || "").trim().toLowerCase() === target);
  },

  /** A Service item may only file under a Service category, and every
      other Item Type only under a Product category — see file header. */
  categoryTypeForItemType(itemType) {
    return itemType === "Service" ? "Service" : "Product";
  },

  /** True if `purchaseUnitId` is a legitimate secondary purchase unit for
      an item whose base/stock unit is `unitId` — they must resolve to a
      shared ultimate base via Unit Master's conversion chain. An empty
      purchaseUnitId is always valid (it's optional). */
  isValidPurchaseUnit(companyId, unitId, purchaseUnitId) {
    if (!purchaseUnitId) return true;
    if (purchaseUnitId === unitId) return true;
    return ERP_UnitRepository.getConversionFactor(companyId, purchaseUnitId, unitId) !== null;
  },

  /** How many of the item's base unit one purchase unit resolves to, for
      display — e.g. "1 Box = 12 Pcs". "" if no purchase unit is set or the
      linked units no longer exist. */
  getPurchaseConversionLabel(item) {
    if (!item.purchaseUnitId) return "";
    const unit = ERP_UnitRepository.findById(item.unitId);
    const purchaseUnit = ERP_UnitRepository.findById(item.purchaseUnitId);
    if (!unit || !purchaseUnit) return "";
    const factor = ERP_UnitRepository.getConversionFactor(item.companyId, item.purchaseUnitId, item.unitId);
    if (factor === null) return "";
    return `1 ${purchaseUnit.unitName} = ${factor} ${unit.unitName}`;
  },

  /** Live, ledger-computed total across every warehouse — falls back to
      the item's own legacy stored field if Stock Ledger isn't loaded on
      this page, or hasn't seen a single movement for this item yet. See
      file header for the full "computed rollup, not a stored field"
      reasoning. */
  getLiveCurrentStock(item) {
    if (typeof ERP_StockLedgerRepository !== "undefined") {
      const hasActivity = ERP_StockLedgerRepository.getEntriesForItem(item.companyId, item.id).length > 0;
      if (hasActivity) return ERP_StockLedgerRepository.getTotalStockForItem(item.companyId, item.id);
    }
    return Number(item.currentStock) || 0;
  },

  /** Per-warehouse breakdown of the live figure above — used by the
      item's own Detail modal once Stock Ledger has activity for it, so
      "80 total" can be shown as "Warehouse A: 50, Warehouse B: 30"
      rather than one flattened number. Empty array if there's no ledger
      activity yet (the legacy currentStock field has no warehouse to
      attribute itself to). */
  getStockBreakdownByWarehouse(item) {
    if (typeof ERP_StockLedgerRepository === "undefined") return [];
    return ERP_StockLedgerRepository.getEntriesForItem(item.companyId, item.id)
      .reduce((rows, e) => {
        let row = rows.find((r) => r.warehouseId === e.warehouseId);
        if (!row) { row = { warehouseId: e.warehouseId, quantity: 0 }; rows.push(row); }
        row.quantity += Number(e.quantity) || 0;
        return rows;
      }, []);
  },

  /** Reorder Level vs. Current Stock — see file header for why `fillPct`
      is deliberately the INVERSE direction of Cost Centers'/Warehouses'/
      Customer Master's equivalent (a fuel gauge, not a spending meter). A
      zero reorder level means "not tracked for reordering" — no threshold
      to compare against, so it's reported as healthy with a simple binary
      fill, the same explicit zero-guard spirit as every earlier budget-bar
      instance. `currentStock` here is the LIVE figure (see
      getLiveCurrentStock() above) — this function's own signature is
      unchanged, so every existing caller picks up the Phase 7 fix for
      free. */
  getStockUsage(item) {
    const reorderLevel = Number(item.reorderLevel) || 0;
    const currentStock = this.getLiveCurrentStock(item);
    const gap = currentStock - reorderLevel;
    let fillPct;
    if (reorderLevel > 0) {
      fillPct = Math.max(0, Math.min(100, (currentStock / (reorderLevel * 2)) * 100));
    } else {
      fillPct = currentStock > 0 ? 100 : 0;
    }
    return { reorderLevel, currentStock, gap, fillPct };
  },

  /** "critical" (at/below reorder level — reorder now), "low" (within 50%
      of the reorder level's own size above it), or "healthy". Independent
      of fillPct on purpose — see getStockUsage's own note. Reads the same
      LIVE current-stock figure as getStockUsage(). */
  getStockHealthBand(item) {
    const reorderLevel = Number(item.reorderLevel) || 0;
    const currentStock = this.getLiveCurrentStock(item);
    if (reorderLevel <= 0) return "healthy";
    const ratio = currentStock / reorderLevel;
    if (ratio <= 1) return "critical";
    if (ratio <= 1.5) return "low";
    return "healthy";
  },

  /** Own override wins; otherwise inherit from the linked HSN code's
      default; otherwise null — see file header. Returns the resolved Tax
      Master RECORD (not just an id) so a caller can display its name/rate
      directly, or null if nothing resolves. */
  getEffectiveTaxCode(item) {
    if (item.taxCategoryId && typeof ERP_TaxRepository !== "undefined") {
      const direct = ERP_TaxRepository.findById(item.taxCategoryId);
      if (direct) return direct;
    }
    if (item.hsnCodeId && typeof ERP_HsnRepository !== "undefined" && typeof ERP_TaxRepository !== "undefined") {
      const hsn = ERP_HsnRepository.findById(item.hsnCodeId);
      if (hsn && hsn.defaultTaxCodeId) {
        const inherited = ERP_TaxRepository.findById(hsn.defaultTaxCodeId);
        if (inherited) return inherited;
      }
    }
    return null;
  },

  create(company, data) {
    const record = {
      id: "ITM-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      itemCode: this.nextItemCode(company),
      sku: "",
      itemType: "Finished Good",
      categoryId: null,
      unitId: null,
      purchaseUnitId: null,
      taxCategoryId: null,
      hsnCodeId: null,
      reorderLevel: 0,
      currentStock: 0,
      purchasePrice: 0,
      salePrice: 0,
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
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  toggleStatus(id) {
    const item = this.findById(id);
    if (!item) return null;
    return this.update(id, { status: item.status === "Active" ? "Inactive" : "Active" });
  },

  /** No dependency guard needed yet — nothing references an item by id
      until Phase 4/5/6 exist, the same situation Vendor/Customer Master
      were in relative to their own not-yet-built consumers. */
  remove(id) {
    const all = this.getAll().filter((i) => i.id !== id);
    this._saveAll(all);
    return true;
  }
};
