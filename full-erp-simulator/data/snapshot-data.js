/* =============================================================================
   DOT ERP
   FILE:  data/snapshot-data.js
   ROLE:  The actual hard infrastructure problem Phase 8 exists to solve —
          a real historical snapshot mechanism, so Dashboard's own
          day-over-day deltas stop being hardcoded to 0. Closer in shape to
          Stock Ledger or GL Posting than to a report page, exactly as the
          roadmap itself framed it: GENUINE STORAGE (`ERP_SNAPSHOT_KEY`,
          `getAll()`/`_saveAll()`, real records with real ids), not a thin
          computation layer like every other Phase 8 file. No page of its
          own — like gl-posting-data.js and stock-posting-data.js before
          it, this is pure orchestration other modules call into.

   AUDITED, NOT ASSUMED — EXACTLY TWO FIELDS NEEDED THIS: dashboard-data.js
   and pages/dashboard.js were both read directly before writing this file,
   not skimmed. Only two KPI tiles were ever hardcoded to 0:
   `inventoryChangePct` and `lowStockChange`. `salesChangePct` and
   `purchasesChangePct` already worked correctly, computed live from Tax
   Invoice's and PO's own dated records — a "day-over-day" question about
   THOSE two doesn't need a snapshot, because the source transactions are
   already timestamped. Inventory value and low-stock count are different:
   both are CURRENT-STATE rollups with no historical trail of their own —
   Item Master only ever stores today's stock level, not what it was
   yesterday — which is the actual gap a snapshot mechanism closes. This
   file captures exactly those two figures and nothing else.

   CAPTURED BOTH AUTOMATICALLY AND ON DEMAND — DECIDED, NOT DEFAULTED: the
   brief explicitly asked "on boot? an explicit action? both?" Both, for a
   reason specific to this being a TRAINING simulator rather than a real
   always-on system: `ensureTodaySnapshot()` fires once per calendar day,
   the first time Dashboard boots that day, the way a real end-of-day (or
   start-of-day) job would. But a trainee exploring this project in one
   sitting will never see a second calendar day roll over on its own, so
   `captureSnapshot()` is also exposed directly for a manual "Capture
   Snapshot Now" action on the Dashboard itself — an honest, clearly
   labeled override for seeing the mechanism work, not a pretense that
   it's automatic.

   TODAY'S OWN ROW IS UPSERT; EVERY EARLIER ROW IS EFFECTIVELY STABLE — a
   deliberate departure from Stock Ledger's own "no update(), ever"
   stance, and worth being explicit about why. A Stock Ledger entry
   records a fact that already, physically happened; today's own snapshot
   hasn't finished happening yet — the day is still in progress every time
   this gets called before midnight. So `captureSnapshot()` OVERWRITES
   today's own row if one already exists (whether from the automatic boot
   call or an earlier manual one) rather than appending a second row for
   the same date, while nothing in this file ever writes to a PAST date's
   row once it exists. That distinction only matters for today; there is
   no code path that revisits yesterday.

   DELTAS COMPARE AGAINST THE LATEST PRIOR-DAY SNAPSHOT, NEVER TODAY'S OWN
   — the other half of getting "day-over-day" right. If deltas compared
   today's live figures against today's OWN snapshot row, a trainee who
   posts a GRN five minutes after boot would see a "change" that's really
   just "five minutes of activity," which isn't what "day-over-day" means
   to anyone. `getDeltas()` always diffs against the most recent snapshot
   dated strictly BEFORE today — the last completed day — which is also
   why `getSnapshotInfo()`'s own `baselineDate` is worth showing on the
   page: the trainee should be able to see exactly which day a "+4.2%"
   is measured against.

   NO PRIOR SNAPSHOT EXISTS YET → `null`, NEVER 0 — the one rule this
   whole mechanism exists to enforce. A brand-new company, or one that's
   only ever been viewed on a single calendar day, has no baseline to
   diff against; `getDeltas()` returns `hasBaseline: false` and both delta
   fields as `null`, and dashboard.js's own renderKpiTrend() renders that
   as "No prior-day data yet" — visibly different from "No change since
   yesterday" (which is what a real, tiny, honest 0% would still show).
   Silently defaulting a missing baseline to 0 is exactly the lie this
   file was built to stop telling.

   `_computeCurrentMetrics()` DUPLICATES, RATHER THAN IMPORTS, DASHBOARD-
   DATA.JS'S OWN inventoryValue/lowStockCount LOGIC — a deliberate,
   small-scope call. The alternative (dashboard-data.js exporting its own
   internal helper for this file to call) would create a real dependency
   edge between an infrastructure file and a single page's own reporting
   layer, for six lines of array-filtering logic that's easy to keep in
   sync by inspection. Duplicated here, cited there (see this file's own
   header note added to dashboard-data.js), not shared.
   ========================================================================== */

const ERP_SNAPSHOT_KEY = "erp_daily_snapshots";

const ERP_SnapshotRepository = {

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_SNAPSHOT_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_SNAPSHOT_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((s) => s.companyId === companyId);
  },

  getSnapshotForDate(companyId, dateISO) {
    return this.getAllForCompany(companyId).find((s) => s.snapshotDate === dateISO) || null;
  },

  /** Most recent snapshot strictly BEFORE `beforeDate` — the "yesterday,
      or the last day we actually had data for" a day-over-day comparison
      needs. Never returns a same-date row. */
  getLatestPriorSnapshot(companyId, beforeDate) {
    const prior = this.getAllForCompany(companyId).filter((s) => s.snapshotDate < beforeDate);
    prior.sort((a, b) => new Date(b.snapshotDate) - new Date(a.snapshotDate));
    return prior[0] || null;
  },

  /** {inventoryValue, lowStockCount} — see file header for why this
      duplicates rather than calls into dashboard-data.js. Mirrors that
      file's own buildKpis() logic exactly: real FIFO valuation via Stock
      Valuation Report when it's loaded (with the same at-cost fallback,
      kept for the same defensive reason), and the same critical/low
      stock-health bands Item Master itself uses. */
  _computeCurrentMetrics(companyId) {
    if (typeof ERP_ItemRepository === "undefined") return { inventoryValue: 0, lowStockCount: 0 };

    const activeItems = ERP_ItemRepository.getAllForCompany(companyId).filter((i) => i.status === "Active");

    const inventoryValue = (typeof ERP_StockValuationRepository !== "undefined")
      ? ERP_StockValuationRepository.getValuationReport(companyId).grandTotalValue
      : activeItems.reduce((a, i) => a + (Number(i.currentStock) || 0) * (Number(i.purchasePrice) || 0), 0);

    const lowStockCount = activeItems.filter((i) => {
      const band = ERP_ItemRepository.getStockHealthBand(i);
      return band === "critical" || band === "low";
    }).length;

    return { inventoryValue, lowStockCount };
  },

  /** The only way a snapshot row comes into existence. Upserts TODAY's
      own row (see file header for why today, specifically, is an
      exception to this project's usual "no rewrite" rule) with the
      current inventoryValue/lowStockCount. `isManualCapture` is stored
      purely as an honest audit trail of which trigger produced a given
      row — it never changes how the row is read. */
  captureSnapshot(company, actorUsername, isManualCapture) {
    if (!company || !company.id) return null;
    const today = new Date().toISOString().slice(0, 10);
    const metrics = this._computeCurrentMetrics(company.id);

    const all = this.getAll();
    const existingIdx = all.findIndex((s) => s.companyId === company.id && s.snapshotDate === today);

    const record = {
      id: existingIdx >= 0 ? all[existingIdx].id : ("SNAP-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()),
      companyId: company.id,
      snapshotDate: today,
      inventoryValue: metrics.inventoryValue,
      lowStockCount: metrics.lowStockCount,
      capturedAt: new Date().toISOString(),
      capturedByUsername: actorUsername || "system",
      isManualCapture: !!isManualCapture
    };

    if (existingIdx >= 0) all[existingIdx] = record; else all.push(record);
    this._saveAll(all);
    return record;
  },

  /** The automatic trigger — called once from Dashboard's own boot
      sequence. A no-op (besides returning the existing row) if today's
      snapshot already exists, so an ordinary page reload never quietly
      overwrites today's own captured figures with whatever the moment of
      reload happens to look like. */
  ensureTodaySnapshot(company, actorUsername) {
    if (!company || !company.id) return null;
    const today = new Date().toISOString().slice(0, 10);
    const existing = this.getSnapshotForDate(company.id, today);
    if (existing) return existing;
    return this.captureSnapshot(company, actorUsername, false);
  },

  /** {hasBaseline, baselineDate, inventoryChangePct, lowStockChange,
      currentInventoryValue, currentLowStockCount}. Diffs freshly-computed
      current metrics (not today's own stored snapshot row, which could be
      stale by however long it's been since boot) against the latest
      snapshot strictly before today. `inventoryChangePct` uses the same
      "no prior value, today is positive → +100%, otherwise 0%" edge-case
      handling dashboard-data.js's own pctChange() already established for
      sales/purchases, for the same reason: a genuine baseline of exactly
      zero isn't a missing baseline, it's a real 0 to grow from. A missing
      baseline entirely is the `hasBaseline: false` case, handled
      separately and never smuggled through as a 0. */
  getDeltas(companyId) {
    const today = new Date().toISOString().slice(0, 10);
    const current = this._computeCurrentMetrics(companyId);
    const baseline = this.getLatestPriorSnapshot(companyId, today);

    if (!baseline) {
      return {
        hasBaseline: false, baselineDate: null,
        inventoryChangePct: null, lowStockChange: null,
        currentInventoryValue: current.inventoryValue, currentLowStockCount: current.lowStockCount
      };
    }

    const inventoryChangePct = baseline.inventoryValue > 0
      ? ((current.inventoryValue - baseline.inventoryValue) / baseline.inventoryValue) * 100
      : (current.inventoryValue > 0 ? 100 : 0);

    return {
      hasBaseline: true, baselineDate: baseline.snapshotDate,
      inventoryChangePct, lowStockChange: current.lowStockCount - baseline.lowStockCount,
      currentInventoryValue: current.inventoryValue, currentLowStockCount: current.lowStockCount
    };
  },

  /** {hasBaseline, baselineDate, todaySnapshot} — the small info bundle
      the Dashboard page itself displays (baseline date + today's own
      capture time) alongside its "Capture Snapshot Now" control. Kept
      separate from getDeltas() so the page can show capture metadata even
      in the no-baseline case, where getDeltas() itself has nothing else
      to say. */
  getSnapshotInfo(companyId) {
    const today = new Date().toISOString().slice(0, 10);
    const baseline = this.getLatestPriorSnapshot(companyId, today);
    return {
      hasBaseline: !!baseline,
      baselineDate: baseline ? baseline.snapshotDate : null,
      todaySnapshot: this.getSnapshotForDate(companyId, today)
    };
  }
};
