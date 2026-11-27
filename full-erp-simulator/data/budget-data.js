/* =============================================================================
   DOT ERP
   FILE:  data/budget-data.js
   ROLE:  Data-access layer for Budget Master — Phase 13, Module 01. A
          budgeted figure per GL account per period, scoped to one
          Financial Year.

   THE COST CENTER DIMENSION QUESTION — THE ROADMAP EXPLICITLY LEFT THIS
   OPEN ("or Cost Center, if you want that dimension too"), AND IT WAS
   SETTLED BY READING THE DATA, NOT BY PREFERENCE: checked
   `data/journal-entry-data.js` directly before designing anything here.
   A journal entry LINE carries exactly `accountId`, `debit`, `credit`,
   and `lineNarration` — there is NO `costCenterId` on it, anywhere, and
   no other module writes one. That means cost-center ACTUALS cannot be
   derived from the General Ledger at all, by anyone, today. Budgeting by
   cost center would therefore produce a budget that could never be
   compared against anything — a Budget vs. Actual report with a
   populated budget column and a permanently empty actual column, which
   is worse than not offering the dimension. So Budget Master is scoped
   to GL ACCOUNT × PERIOD only, and the reason is recorded here so a
   future phase doesn't re-litigate it from scratch. **The genuine
   prerequisite for ever adding it** is putting a `costCenterId` on the
   journal entry line itself and populating it from every auto-posting
   module — a real, invasive retrofit on the scale of Phase 11's, not a
   field added to this file.

   A RELATED, PRE-EXISTING GAP, NAMED RATHER THAN QUIETLY DUPLICATED:
   `data/cost-center-data.js` (Phase 2) already carries its own
   `annualBudget` and `actualSpend` fields plus a `getVariance()` helper.
   That `actualSpend` is a MANUALLY TYPED number — verified by grep, no
   transactional module writes it — so Cost Center's own variance is a
   self-contained, hand-maintained estimate, NOT a GL-derived figure.
   This module does not touch, extend, or attempt to reconcile with it:
   two different things that both happen to be called "budget" is
   confusing, but silently overwriting an existing module's own fields
   from a new one would be worse. Budget Master is the GL-anchored,
   genuinely-comparable budget; Cost Center's own pair remains what it
   always was, and its own header already describes it honestly.

   PERIODS ARE REUSED FROM FINANCIAL YEAR, NEVER REINVENTED: a Financial
   Year record already generates its own 12 monthly `periods` array (each
   with `id`, `seq`, `name`, `startDate`, `endDate`) — see
   `data/financial-year-data.js`. A budget line references a period by
   that same `id`, and Budget vs. Actual reads the period's own
   `startDate`/`endDate` straight off the FY record to query the ledger.
   No second period concept, no duplicated date math, one source of truth
   — the same "reuse forward, don't re-derive" discipline every report in
   this project follows, applied to a dimension rather than a figure.

   ONLY INCOME AND EXPENSE ACCOUNTS ARE BUDGETABLE — A REAL DECISION, NOT
   A LIMITATION: you budget revenue and costs, which are PERIOD FLOWS. An
   Asset/Liability/Equity account holds a POINT-IN-TIME BALANCE, and
   "budgeting" one is a genuinely different exercise (cash-flow
   forecasting, or a balance-sheet plan) that real systems treat as a
   separate discipline. Restricting to the two flow types is what makes a
   period-by-period budget meaningful and comparable against P&L
   actuals — and it's the same Income/Expense scoping
   `data/profit-and-loss-data.js` already uses, deliberately matched so
   the two reports can never disagree about what's in scope.

   ONE APPROVED BUDGET PER FINANCIAL YEAR — QUOTATION COMPARISON'S OWN
   MUTUAL-EXCLUSIVITY TOGGLE, REUSED A THIRD TIME: Draft budgets for the
   same FY coexist freely while planning is in progress (multiple
   scenarios is exactly what real budgeting looks like), so a flat
   duplicate hard-block would be wrong. What needs exclusivity is which
   ONE budget is live for variance reporting. `approve()` therefore
   auto-supersedes whatever was previously Approved for that same FY
   rather than blocking the save — the same shape
   `ERP_BomRepository.activate()` used in Phase 10, which itself borrowed
   it from Quotation Comparison's own `recommend()`.

   ANNUAL-AMOUNT-PLUS-DISTRIBUTION, NOT 12 HAND-TYPED CELLS: typing 12
   separate figures per account across a dozen accounts is 144 inputs and
   nobody would do it. `buildEvenDistribution()` spreads an annual figure
   across the FY's own periods with the REMAINDER LANDING ON THE LAST
   PERIOD, so the 12 monthly figures always sum to EXACTLY the annual
   amount — verified in Node against amounts that don't divide evenly by
   12, because a naive `Math.round(annual/12) * 12` silently loses or
   invents paisa. Every distributed figure stays individually editable
   afterward; the distribution is a starting point, not a lock.
   ========================================================================== */

const ERP_BUDGET_KEY = "erp_budgets";
const ERP_BUDGET_STATUSES = ["Draft", "Approved", "Superseded", "Cancelled"];
const ERP_BUDGETABLE_ACCOUNT_TYPES = ["Income", "Expense"];

const ERP_BudgetRepository = {
  statuses: ERP_BUDGET_STATUSES,
  budgetableAccountTypes: ERP_BUDGETABLE_ACCOUNT_TYPES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_BUDGET_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_BUDGET_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((b) => b.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((b) => b.id === id) || null;
  },

  /** BUD-01, BUD-02, ... per company. */
  nextBudgetCode(company) {
    let max = 0;
    this.getAllForCompany(company.id).forEach((b) => {
      const m = /-BUD-(\d+)$/.exec(b.budgetCode || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `${company.companyCode}-BUD-${String(max + 1).padStart(2, "0")}`;
  },

  /** The one budget Budget vs. Actual reports against for a given FY. */
  getApprovedForFy(companyId, financialYearId) {
    return this.getAllForCompany(companyId)
      .find((b) => b.financialYearId === financialYearId && b.status === "Approved") || null;
  },

  /** Income + Expense Ledger accounts only — see file header. Deliberately
      matches profit-and-loss-data.js's own scoping exactly. */
  getBudgetableAccounts(companyId) {
    if (typeof ERP_ChartOfAccountsRepository === "undefined") return [];
    return ERP_ChartOfAccountsRepository.getAllForCompany(companyId)
      .filter((a) => !a.isGroup && ERP_BUDGETABLE_ACCOUNT_TYPES.includes(a.accountType))
      .sort((a, b) => String(a.accountCode).localeCompare(String(b.accountCode), undefined, { numeric: true }));
  },

  /** Spread `annualAmount` across `periodCount` periods so the parts sum
      to EXACTLY annualAmount — remainder lands on the final period. See
      file header on why a naive round-and-multiply is wrong. Works in
      paisa internally to avoid float drift. */
  buildEvenDistribution(annualAmount, periodCount) {
    const total = Math.round((Number(annualAmount) || 0) * 100);
    const n = Math.max(1, Number(periodCount) || 1);
    const base = Math.floor(total / n);
    const out = new Array(n).fill(base);
    out[n - 1] = total - base * (n - 1); // remainder on the last period
    return out.map((paise) => paise / 100);
  },

  /** Sum of every period figure on one account's own line. */
  getAccountAnnualTotal(budget, accountId) {
    const line = (budget.lines || []).find((l) => l.accountId === accountId);
    if (!line) return 0;
    return Object.values(line.periodAmounts || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  },

  /** Whole-budget total, and split by account type — what the list table
      and the detail header display. */
  getTotals(budget) {
    let income = 0, expense = 0;
    (budget.lines || []).forEach((l) => {
      const acc = typeof ERP_ChartOfAccountsRepository !== "undefined" ? ERP_ChartOfAccountsRepository.findById(l.accountId) : null;
      const sum = Object.values(l.periodAmounts || {}).reduce((s, v) => s + (Number(v) || 0), 0);
      if (!acc) return;
      if (acc.accountType === "Income") income += sum;
      else if (acc.accountType === "Expense") expense += sum;
    });
    return { income, expense, net: income - expense };
  },

  create(company, data, actorUsername) {
    const record = {
      id: "BUD-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      budgetCode: this.nextBudgetCode(company),
      budgetName: data.budgetName || "",
      financialYearId: data.financialYearId,
      notes: data.notes || "",
      status: "Draft",
      // lines: [{ accountId, periodAmounts: { P01: 1000, P02: 1000, ... } }]
      lines: (data.lines || []).map((l) => ({
        accountId: l.accountId,
        periodAmounts: { ...(l.periodAmounts || {}) }
      })),
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString()
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Drafts only — an Approved budget is what Budget vs. Actual is
      actively reporting against; editing it underneath a report would
      silently change history. Revising an approved budget means creating
      a new one and approving it (which auto-supersedes the old), the
      same "correction is a new record" principle this project holds to
      everywhere. */
  canEdit(budget) { return budget.status === "Draft"; },
  update(id, partial, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1 || !this.canEdit(all[idx])) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString(), updatedByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Approved, auto-superseding any other Approved budget for
      the same FY — see file header. */
  canApprove(budget) { return budget.status === "Draft" && (budget.lines || []).length > 0; },
  approve(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1 || !this.canApprove(all[idx])) return null;
    const target = all[idx];
    all.forEach((b, i) => {
      if (b.companyId === target.companyId && b.financialYearId === target.financialYearId && b.status === "Approved") {
        all[i] = { ...b, status: "Superseded", supersededAt: new Date().toISOString(), supersededByBudgetId: target.id };
      }
    });
    all[idx] = { ...target, status: "Approved", approvedAt: new Date().toISOString(), approvedByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  canCancel(budget) { return budget.status === "Draft"; },
  cancel(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1 || !this.canCancel(all[idx])) return null;
    all[idx] = { ...all[idx], status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  remove(id) {
    const all = this.getAll();
    const rec = all.find((b) => b.id === id);
    if (!rec || rec.status !== "Draft") return false;
    this._saveAll(all.filter((b) => b.id !== id));
    return true;
  }
};
