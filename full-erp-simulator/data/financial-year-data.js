/* =============================================================================
   DOT ERP
   FILE:  data/financial-year-data.js
   ROLE:  Data-access layer for Financial Years — Phase 2, Module 03.

   Every financial year belongs to one company (companyId) and carries its
   own 12 monthly Periods, generated automatically the moment the financial
   year is created. This mirrors how a real ERP's fiscal year calendar works
   (SAP's fiscal year variant, Oracle Fusion's GL accounting calendar, Tally's
   "Financial Year" under company alteration): you don't hand-type periods,
   the system derives them from the year's start and end date.

   LIFECYCLE (deliberately simple, four states):
     Draft   -> newly created, editable, deletable, not yet in use
     Current -> the one financial year "open" for a company right now
     Closed  -> finished, periods all closed, can still be reopened
     Locked  -> permanently sealed, nothing about it can change again

   Only ONE financial year per company may be "Current" at a time — the
   same constraint every real ERP enforces, because posting dates need a
   single unambiguous open period to land in.
   ========================================================================== */

const ERP_FINANCIAL_YEARS_KEY = "erp_financial_years";

/* ---------------------------------------------------------------------
   DATE HELPERS (local, calendar-only — deliberately independent of
   script.js's formatDateTime, which is built for timestamped events, not
   pure calendar dates like a fiscal year's start/end).
   --------------------------------------------------------------------- */
const ERP_FY_MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parses a "YYYY-MM-DD" string (as produced by <input type="date">) into a
    local-midnight Date, avoiding the UTC-shift bugs of `new Date("YYYY-MM-DD")`. */
function erpFyParseISO(str) {
  const [y, m, d] = String(str).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
/** Formats a Date back to "YYYY-MM-DD" for storage / <input type="date">. */
function erpFyToISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function erpFyAddMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, date.getDate());
}
function erpFyAddDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}
/** "Apr 2026" style label for a period. */
function erpFyMonthYearLabel(date) {
  return `${ERP_FY_MONTH_ABBR[date.getMonth()]} ${date.getFullYear()}`;
}
/** "FY 2026-27" (or "FY 2026" if start/end share a year) suggested from dates. */
function erpFySuggestName(startISO, endISO) {
  const start = erpFyParseISO(startISO);
  const end = erpFyParseISO(endISO);
  if (start.getFullYear() === end.getFullYear()) return `FY ${start.getFullYear()}`;
  return `FY ${start.getFullYear()}-${String(end.getFullYear()).slice(-2)}`;
}
/** Suggested end date = exactly one year after start, minus a day (e.g. 1 Apr 2026 -> 31 Mar 2027). */
function erpFySuggestEndDate(startISO) {
  const start = erpFyParseISO(startISO);
  return erpFyToISO(erpFyAddDays(erpFyAddMonths(start, 12), -1));
}
/** 12 successive monthly periods spanning startISO..endISO. The 12th period's
    end is pinned to the FY's real end date so odd-length years don't drift. */
function erpFyGeneratePeriods(startISO, endISO) {
  const start = erpFyParseISO(startISO);
  const end = erpFyParseISO(endISO);
  const periods = [];
  for (let i = 0; i < 12; i++) {
    const periodStart = erpFyAddMonths(start, i);
    const periodEnd = i === 11 ? end : erpFyAddDays(erpFyAddMonths(start, i + 1), -1);
    periods.push({
      id: "P" + String(i + 1).padStart(2, "0"),
      seq: i + 1,
      name: erpFyMonthYearLabel(periodStart),
      startDate: erpFyToISO(periodStart),
      endDate: erpFyToISO(periodEnd),
      status: "Open"
    });
  }
  return periods;
}


const ERP_FinancialYearRepository = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_FINANCIAL_YEARS_KEY)) || []; }
    catch { return []; }
  },

  _saveAll(list) {
    try { localStorage.setItem(ERP_FINANCIAL_YEARS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** All financial years for one company, chronological (earliest start first). */
  getAllForCompany(companyId) {
    return this.getAll()
      .filter((fy) => fy.companyId === companyId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  },

  findById(id) {
    return this.getAll().find((fy) => fy.id === id) || null;
  },

  /** The single "Current" financial year for a company, or null if none. */
  getCurrent(companyId) {
    return this.getAll().find((fy) => fy.companyId === companyId && fy.status === "Current") || null;
  },

  /** COMP-001-FY-01, COMP-001-FY-02, ... — scoped per company, never reused. */
  nextFyCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((fy) => {
      const match = /-FY-(\d+)$/.exec(fy.fyCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-FY-${String(max + 1).padStart(2, "0")}`;
  },

  /** True if [startISO, endISO] overlaps any existing financial year for this
      company (any status), excluding excludeId (used when editing). Two
      ranges overlap unless one ends before the other begins. */
  hasDateOverlap(companyId, startISO, endISO, excludeId) {
    return this.getAllForCompany(companyId).some((fy) => {
      if (fy.id === excludeId) return false;
      return startISO <= fy.endDate && endISO >= fy.startDate;
    });
  },

  create(company, data) {
    const record = {
      id: "FY-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      fyCode: this.nextFyCode(company),
      status: "Draft",
      periods: erpFyGeneratePeriods(data.startDate, data.endDate),
      notes: "",
      createdAt: new Date().toISOString(),
      closedAt: null,
      lockedAt: null,
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((fy) => fy.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Re-derives the 12 periods after a Draft financial year's dates are edited. */
  regeneratePeriods(id) {
    const fy = this.findById(id);
    if (!fy) return null;
    return this.update(id, { periods: erpFyGeneratePeriods(fy.startDate, fy.endDate) });
  },

  setCurrent(id) {
    return this.update(id, { status: "Current" });
  },

  closeFY(id) {
    const fy = this.findById(id);
    if (!fy) return null;
    const closedPeriods = fy.periods.map((p) => ({ ...p, status: "Closed" }));
    return this.update(id, { status: "Closed", closedAt: new Date().toISOString(), periods: closedPeriods });
  },

  reopenFY(id) {
    return this.update(id, { status: "Current", closedAt: null });
  },

  lockFY(id) {
    const fy = this.findById(id);
    if (!fy) return null;
    const closedPeriods = fy.periods.map((p) => ({ ...p, status: "Closed" }));
    return this.update(id, { status: "Locked", lockedAt: new Date().toISOString(), periods: closedPeriods });
  },

  /** Toggles one period's Open/Closed state — only meaningful while the
      parent financial year itself is "Current" (enforced by the UI). */
  togglePeriod(fyId, periodId) {
    const fy = this.findById(fyId);
    if (!fy) return null;
    const periods = fy.periods.map((p) => p.id === periodId ? { ...p, status: p.status === "Open" ? "Closed" : "Open" } : p);
    return this.update(fyId, { periods });
  },

  remove(id) {
    const all = this.getAll().filter((fy) => fy.id !== id);
    this._saveAll(all);
  },

  /* Exposed date helpers so pages/financial-year.js can reuse them without duplicating logic. */
  helpers: {
    parseISO: erpFyParseISO,
    toISO: erpFyToISO,
    addMonths: erpFyAddMonths,
    addDays: erpFyAddDays,
    monthYearLabel: erpFyMonthYearLabel,
    suggestName: erpFySuggestName,
    suggestEndDate: erpFySuggestEndDate
  }
};
