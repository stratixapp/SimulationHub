/* =============================================================================
   DOT ERP
   FILE:  data/dashboard-data.js
   ROLE:  Live reporting layer for the Dashboard module — computed entirely
          from the company's own real records. No random numbers, no
          invented company/party names, no hardcoded sample employees.

   WHAT CHANGED AND WHY
   This file used to synthesize its entire snapshot with Math.random() —
   fake sales figures, a fixed pool of made-up party names, even a
   hardcoded "New employee record created: Priya Nair" activity line that
   had no relationship to anything the trainee had actually done. That's
   fine for a static mockup but wrong for a TRAINING simulator: a trainee
   creating their first Purchase Order should see it show up here, not
   watch it get drowned out by fabricated numbers that never move in
   response to anything they do. So every tile below is now a real
   aggregation over this company's actual records, using the same
   repositories every other module reads and writes.

   SCOPE, HONESTLY STATED
   - "Today's Sales" / the 7-day series = Tax Invoices with status
     "Raised" (a Draft invoice isn't a sale yet), bucketed by invoiceDate.
   - "Today's Purchases" = Purchase Orders that have left Draft (Submitted
     / Approved / Sent / Confirmed — Rejected, Vendor Declined and
     Cancelled never became a real commitment), bucketed by submittedAt.
   - "Inventory Value" — PHASE 7 UPDATE: now reads
     ERP_StockValuationRepository.getValuationReport(), the real FIFO
     valuation built on Stock Ledger, when that module is loaded. Falls
     back to the old current-stock x purchase-price approximation only
     if Stock Valuation isn't available on this page (defensive, same
     typeof-guard shape every cross-module call in this project uses) —
     in practice that fallback path is dead code once Phase 7 shipped,
     kept only so this file never hard-crashes if a future pass removes
     the script tag by accident. The category-level split below (used by
     the "Inventory Value by Category" chart) is retrofitted the same
     way — grouped from real per-item FIFO values, not re-approximated.
   - "Low Stock" reuses ERP_ItemRepository.getStockHealthBand() — the same
     critical/low/healthy bands Item Master itself already uses — instead
     of inventing a second set of thresholds. "healthy" items never
     appear here.
   - Recent Transactions merges Purchase Orders, Tax Invoices and Delivery
     Challans (the three transactional documents with a party stored
     directly on the record, so no fragile multi-hop joins). Vendor
     Payment / Receipt are intentionally left out of this list until
     Phase 6 gives them a clean, direct party reference through the
     ledger — better to leave a real source out than fake its shape.
   - Recent Activity reads the same unified system activity log every
     other module already writes to via logSystemActivity() (see
     ../script.js), filtered to this company and to non-auth modules —
     dashboard.js separately merges the real login audit log on top, so
     duplicating auth events here would double them up.
   - Category Split values each item's current stock at cost and groups
     it by Item Master's own categoryId, via ERP_CategoryRepository —
     items with no category roll up under "Uncategorized" rather than
     being silently dropped.

   NO CACHING. The old version cached a snapshot in sessionStorage and
   framed that as mirroring real dashboards trading staleness for speed.
   That reasoning only holds when aggregation is genuinely expensive; here
   it's a handful of array scans over localStorage-sized data, so caching
   bought nothing but a real correctness bug — add an invoice, come back
   to the dashboard, and the stale cached snapshot would still show the
   old number. Every call to getSnapshot() recomputes fresh.
   ========================================================================== */

(function () {
  "use strict";

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const VALID_PO_STATUSES = ["Submitted", "Approved", "Sent", "Confirmed"];
  const VALID_INVOICE_STATUSES = ["Raised"];

  const ACTIVITY_KIND_RULES = [
    { test: /invoice/i, kind: "invoice" },
    { test: /purchase|requisition|rfq|quotation|grn|goods receipt|vendor|three-way|invoice verification/i, kind: "purchase" },
    { test: /item|stock|warehouse|quality inspection|category|unit/i, kind: "stock" },
    { test: /employee/i, kind: "employee" },
    { test: /payment|receipt/i, kind: "payment" }
  ];

  function safeParse(raw) {
    try { return JSON.parse(raw) || []; } catch { return []; }
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function isSameDay(a, b) {
    return startOfDay(a).getTime() === startOfDay(b).getTime();
  }

  function pctChange(today, yesterday) {
    if (!yesterday) return today > 0 ? 100 : 0;
    return ((today - yesterday) / yesterday) * 100;
  }

  /* -----------------------------------------------------------------------
     SOURCE ROWS — normalize each repository's records into a small common
     shape before aggregating, so the KPI/series/transaction builders below
     don't each need to know PO vs Invoice field names.
     --------------------------------------------------------------------- */
  function getPurchaseRows(companyId) {
    if (typeof ERP_PurchaseOrderRepository === "undefined") return [];
    return ERP_PurchaseOrderRepository.getAllForCompany(companyId)
      .filter((po) => VALID_PO_STATUSES.includes(po.status))
      .map((po) => {
        const vendor = typeof ERP_VendorRepository !== "undefined" ? ERP_VendorRepository.findById(po.vendorId) : null;
        return {
          id: po.poCode || po.id,
          type: "Purchase Order",
          party: (vendor && vendor.vendorName) || "Unknown Vendor",
          amount: ERP_PurchaseOrderRepository.computeGrandTotal(po).total,
          status: po.status,
          date: po.submittedAt || po.createdAt
        };
      });
  }

  function getSalesRows(companyId) {
    if (typeof ERP_TaxInvoiceRepository === "undefined") return [];
    return ERP_TaxInvoiceRepository.getAllForCompany(companyId)
      .filter((inv) => VALID_INVOICE_STATUSES.includes(inv.status))
      .map((inv) => {
        const customer = typeof ERP_CustomerRepository !== "undefined" ? ERP_CustomerRepository.findById(inv.customerId) : null;
        return {
          id: inv.invoiceCode || inv.id,
          type: "Sales Invoice",
          party: (customer && customer.customerName) || "Unknown Customer",
          amount: ERP_TaxInvoiceRepository.computeGrandTotal(inv).total,
          status: inv.status,
          date: inv.invoiceDate || inv.raisedAt || inv.createdAt
        };
      });
  }

  function getDeliveryRows(companyId) {
    if (typeof ERP_DeliveryChallanRepository === "undefined") return [];
    return ERP_DeliveryChallanRepository.getAllForCompany(companyId)
      .filter((c) => c.status === "Issued")
      .map((c) => {
        const customer = typeof ERP_CustomerRepository !== "undefined" ? ERP_CustomerRepository.findById(c.customerId) : null;
        return {
          id: c.challanCode || c.id,
          type: "Delivery Challan",
          party: (customer && customer.customerName) || "Unknown Customer",
          amount: 0, // Delivery Challan carries quantities, not a billed amount — the Tax Invoice raised from it is what carries value.
          status: c.status,
          date: c.issuedAt || c.challanDate || c.createdAt
        };
      })
      .filter((r) => r.date);
  }

  /* -----------------------------------------------------------------------
     KPIs
     --------------------------------------------------------------------- */
  function buildKpis(companyId, purchaseRows, salesRows, items) {
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);

    const sumOnDay = (rows, day) => rows.filter((r) => r.date && isSameDay(new Date(r.date), day)).reduce((a, r) => a + (r.amount || 0), 0);

    const todaysSales = sumOnDay(salesRows, now);
    const yesterdaysSales = sumOnDay(salesRows, yesterday);
    const todaysPurchases = sumOnDay(purchaseRows, now);
    const yesterdaysPurchases = sumOnDay(purchaseRows, yesterday);

    const activeItems = items.filter((i) => i.status === "Active");
    // PHASE 7 RETROFIT: real FIFO valuation when Stock Valuation is
    // loaded, falling back to the old at-cost approximation only if it
    // isn't (see this file's own header for why that fallback should
    // never actually run in practice).
    const inventoryValue = (typeof ERP_StockValuationRepository !== "undefined")
      ? ERP_StockValuationRepository.getValuationReport(companyId).grandTotalValue
      : activeItems.reduce((a, i) => a + (Number(i.currentStock) || 0) * (Number(i.purchasePrice) || 0), 0);

    const lowStock = activeItems.filter((i) => {
      const band = ERP_ItemRepository.getStockHealthBand(i);
      return band === "critical" || band === "low";
    });

    // PHASE 8 RETROFIT: inventoryChangePct and lowStockChange used to be
    // hardcoded to 0 — there was no historical valuation to diff against.
    // ERP_SnapshotRepository (data/snapshot-data.js) now exists for
    // exactly this; see its own header for the full mechanism. Guarded
    // the same defensive way every other cross-module call in this file
    // already is — `null` (not 0) when the repository isn't loaded or
    // there's genuinely no prior-day baseline yet, so this file never
    // claims "no change" when the honest answer is "no data yet".
    const deltas = (typeof ERP_SnapshotRepository !== "undefined")
      ? ERP_SnapshotRepository.getDeltas(companyId)
      : { hasBaseline: false };

    return {
      todaysSales,
      salesChangePct: pctChange(todaysSales, yesterdaysSales),
      todaysPurchases,
      purchasesChangePct: pctChange(todaysPurchases, yesterdaysPurchases),
      inventoryValue,
      inventoryChangePct: deltas.hasBaseline ? deltas.inventoryChangePct : null,
      lowStockCount: lowStock.length,
      lowStockChange: deltas.hasBaseline ? deltas.lowStockChange : null
    };
  }

  function buildLowStockItems(items) {
    return items
      .filter((i) => i.status === "Active")
      .map((i) => ({ item: i, band: ERP_ItemRepository.getStockHealthBand(i), usage: ERP_ItemRepository.getStockUsage(i) }))
      .filter((x) => x.band === "critical" || x.band === "low")
      .sort((a, b) => (a.usage.currentStock / (a.usage.reorderLevel || 1)) - (b.usage.currentStock / (b.usage.reorderLevel || 1)))
      .map(({ item, band, usage }) => {
        const category = (typeof ERP_CategoryRepository !== "undefined" && item.categoryId) ? ERP_CategoryRepository.findById(item.categoryId) : null;
        return {
          name: item.itemName,
          sku: item.sku || "—",
          category: (category && category.categoryName) || "Uncategorized",
          currentQty: usage.currentStock,
          reorderLevel: usage.reorderLevel,
          itemType: item.itemType || "—",
          status: band === "critical" ? "Critical" : "Warning"
        };
      });
  }

  function buildSeries(purchaseRows, salesRows, days) {
    const series = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const sales = salesRows.filter((r) => r.date && isSameDay(new Date(r.date), d)).reduce((a, r) => a + r.amount, 0);
      const purchases = purchaseRows.filter((r) => r.date && isSameDay(new Date(r.date), d)).reduce((a, r) => a + r.amount, 0);
      series.push({ label: DAY_LABELS[d.getDay()], date: d.toISOString(), sales, purchases });
    }
    return series;
  }

  /** PHASE 7 RETROFIT: groups real per-item FIFO values (from Stock
      Valuation's own report) by category when that module is loaded,
      instead of re-approximating with currentStock x purchasePrice —
      the same fallback-only-if-truly-unavailable shape buildKpis()
      above uses for the same reason. */
  function buildCategorySplit(companyId, items) {
    const byCategory = new Map();

    if (typeof ERP_StockValuationRepository !== "undefined") {
      const report = ERP_StockValuationRepository.getValuationReport(companyId);
      report.rows.forEach((row) => {
        const category = (typeof ERP_CategoryRepository !== "undefined" && row.item.categoryId) ? ERP_CategoryRepository.findById(row.item.categoryId) : null;
        const name = (category && category.categoryName) || "Uncategorized";
        byCategory.set(name, (byCategory.get(name) || 0) + row.value);
      });
    } else {
      items.filter((i) => i.status === "Active").forEach((item) => {
        const category = (typeof ERP_CategoryRepository !== "undefined" && item.categoryId) ? ERP_CategoryRepository.findById(item.categoryId) : null;
        const name = (category && category.categoryName) || "Uncategorized";
        const value = (Number(item.currentStock) || 0) * (Number(item.purchasePrice) || 0);
        byCategory.set(name, (byCategory.get(name) || 0) + value);
      });
    }

    const total = [...byCategory.values()].reduce((a, v) => a + v, 0);
    return [...byCategory.entries()]
      .map(([category, value]) => ({ category, value, pct: total > 0 ? value / total : 0 }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }

  function buildTransactions(purchaseRows, salesRows, deliveryRows) {
    return [...purchaseRows, ...salesRows, ...deliveryRows]
      .filter((r) => r.date)
      .map((r) => ({ ...r, status: normalizeTxnStatus(r.status) }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /** The transactions table's filter chips speak in "Completed / Pending /
      Overdue" — the generic vocabulary of a finished-vs-in-flight document,
      not each module's own specific status names. Map each real status
      into that shared vocabulary rather than exposing the underlying
      module-specific one, so the filter chips still mean the same thing
      across Purchase Orders, Invoices and Challans. */
  function normalizeTxnStatus(status) {
    if (["Raised", "Approved", "Confirmed", "Issued"].includes(status)) return "Completed";
    if (["Submitted", "Sent"].includes(status)) return "Pending";
    return status;
  }

  function buildActivities(companyName) {
    if (!companyName) return [];
    const log = safeParse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog));
    const suffix = `(${companyName})`;
    return log
      .filter((entry) => entry.module !== "Authentication" && entry.description && entry.description.includes(suffix))
      .slice(0, 12)
      .map((entry) => {
        let kind = "invoice";
        if (entry.severity === "warning" || entry.severity === "danger") kind = "warning";
        else {
          const rule = ACTIVITY_KIND_RULES.find((r) => r.test.test(entry.module || ""));
          if (rule) kind = rule.kind;
        }
        const text = entry.description.replace(` ${suffix}`, "");
        return { text, kind, time: entry.timestamp };
      });
  }

  /* -----------------------------------------------------------------------
     ORCHESTRATION
     --------------------------------------------------------------------- */
  function emptySnapshot() {
    return {
      generatedAt: new Date().toISOString(),
      kpis: { todaysSales: 0, salesChangePct: 0, todaysPurchases: 0, purchasesChangePct: 0, inventoryValue: 0, inventoryChangePct: null, lowStockCount: 0, lowStockChange: null },
      lowStockItems: [],
      series: buildSeries([], [], 7),
      categorySplit: [],
      transactions: [],
      activities: [],
      snapshotInfo: { hasBaseline: false, baselineDate: null, todaySnapshot: null }
    };
  }

  function buildSnapshot() {
    const company = typeof ERP_CompanyRepository !== "undefined" ? ERP_CompanyRepository.getActive() : null;
    if (!company) return emptySnapshot();

    const items = typeof ERP_ItemRepository !== "undefined" ? ERP_ItemRepository.getAllForCompany(company.id) : [];
    const purchaseRows = getPurchaseRows(company.id);
    const salesRows = getSalesRows(company.id);
    const deliveryRows = getDeliveryRows(company.id);

    return {
      generatedAt: new Date().toISOString(),
      kpis: buildKpis(company.id, purchaseRows, salesRows, items),
      lowStockItems: buildLowStockItems(items),
      series: buildSeries(purchaseRows, salesRows, 7),
      categorySplit: buildCategorySplit(company.id, items),
      transactions: buildTransactions(purchaseRows, salesRows, deliveryRows),
      activities: buildActivities(company.name),
      snapshotInfo: (typeof ERP_SnapshotRepository !== "undefined")
        ? ERP_SnapshotRepository.getSnapshotInfo(company.id)
        : { hasBaseline: false, baselineDate: null, todaySnapshot: null }
    };
  }

  /** Kept accepting a `forceRefresh` argument for backward compatibility
      with the Refresh button's call site — there's no cache left to
      bypass, every call already recomputes fresh. */
  function getSnapshot(_forceRefresh) {
    return buildSnapshot();
  }

  window.ERP_DashboardData = { getSnapshot };
})();
