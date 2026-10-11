/* =============================================================================
   DOT ERP
   FILE:  data/profit-and-loss-data.js
   ROLE:  Computation layer for the Profit & Loss Statement — Phase 6,
          Module 05. No storage key, same as General Ledger and Trial
          Balance — this is the third pure read-and-compute report in a
          row now, all built the same way for the same reason: nothing
          here is created, edited, or deleted.

   THE ONE REAL NEW IDEA: A PERIOD, NOT A POINT IN TIME. Trial Balance
   asks "what's every account's balance AS OF a date" — a snapshot.
   Profit & Loss asks "how much Income and Expense happened DURING a
   date range" — a flow. That's not a stylistic choice, it's what Income
   and Expense accounts actually mean in real accounting: in a real
   system, they get closed to zero at the start of every new fiscal
   period via closing entries, so their "balance" only ever means
   anything relative to a period, never as a standing, carried-forward
   figure the way an Asset or Liability's does. This project doesn't
   model closing entries — there's no such transaction type anywhere in
   Journal Entry — so the honest equivalent is simpler and arguably more
   correct anyway: THIS FILE NEVER LOOKS AT AN ACCOUNT'S OPENING BALANCE
   AT ALL. `getProfitAndLoss()` sums each account's raw debit/credit
   movement from `ERP_GeneralLedgerRepository.getLedgerForAccount()`'s own
   `rows` (bounded to `[fromDate, toDate]`) directly — never its
   `closingBalance`, which is the one field on that return value that DOES
   fold in the opening balance, and is exactly the field a Balance-Sheet-
   style point-in-time report would want instead.

   SINGLE-LEVEL, DELIBERATELY: a real, mature P&L usually has stages —
   Gross Profit (Direct Income minus Cost of Goods Sold), then Operating
   Profit (minus Operating Expenses), then Net Profit (minus everything
   else). This file doesn't build that, because Chart of Accounts' own
   five Account Types have no sub-classification for "direct" vs.
   "indirect" or "COGS" vs. "operating" — building a multi-stage P&L on
   top of a data model that can't distinguish those categories would mean
   either inventing a classification Chart of Accounts doesn't have, or
   faking the stages by fiat. Simpler and more honest: Total Income minus
   Total Expense equals Net Profit (or Net Loss), full stop — a real,
   correct, single-stage P&L, not a pretend multi-stage one. If a future
   session wants the staged version, it needs a Chart of Accounts change
   first, not a Profit & Loss one.

   FORWARD LINE TO BALANCE SHEET (NOT BUILT YET): a real Balance Sheet's
   Equity section includes the current period's Net Profit (retained
   earnings only becomes "permanent" equity after a formal period-end
   closing entry moves it there — which, again, this project doesn't
   model). Whoever builds Balance Sheet next is expected to call
   `getProfitAndLoss()` for whatever period makes sense and fold
   `netProfit` into its own Equity total, rather than the books simply
   not balancing until a closing-entries module exists. Named here
   explicitly rather than left for that session to discover on its own —
   same courtesy Chart of Accounts' own header extended to Journal Entry.
   ========================================================================== */

const ERP_ProfitAndLossRepository = {
  /** {fromDate, toDate, income:[{account,periodAmount,transactionCount}],
      expense:[...], totalIncome, totalExpense, netProfit}. `periodAmount`
      is each account's net movement in ITS OWN normal-balance terms for
      the period — for Income (Credit-normal) that's credit-minus-debit
      (a credit note against a sale correctly reduces it); for Expense
      (Debit-normal) that's debit-minus-credit (a refunded expense
      correctly reduces it). Includes every Income/Expense Ledger account
      regardless of activity — same "don't filter inside the data layer"
      discipline Trial Balance's own header already established; the
      page's own "With Activity Only" toggle is a display choice. */
  getProfitAndLoss(companyId, fromDate, toDate) {
    const accounts = ERP_ChartOfAccountsRepository.getAllForCompany(companyId)
      .filter((a) => !a.isGroup && (a.accountType === "Income" || a.accountType === "Expense"));

    const rows = accounts.map((a) => {
      const ledger = ERP_GeneralLedgerRepository.getLedgerForAccount(companyId, a.id, { fromDate, toDate });
      const periodDebit = ledger.rows.reduce((s, r) => s + r.debit, 0);
      const periodCredit = ledger.rows.reduce((s, r) => s + r.credit, 0);
      const normalBalance = ERP_ChartOfAccountsRepository.getNormalBalance(a.accountType);
      const periodAmount = normalBalance === "Debit" ? (periodDebit - periodCredit) : (periodCredit - periodDebit);
      return { account: a, periodAmount, transactionCount: ledger.rows.length };
    });

    rows.sort((a, b) => String(a.account.accountCode).localeCompare(String(b.account.accountCode), undefined, { numeric: true }));

    const income = rows.filter((r) => r.account.accountType === "Income");
    const expense = rows.filter((r) => r.account.accountType === "Expense");
    const totalIncome = income.reduce((s, r) => s + r.periodAmount, 0);
    const totalExpense = expense.reduce((s, r) => s + r.periodAmount, 0);

    return {
      fromDate, toDate,
      income, expense,
      totalIncome, totalExpense,
      netProfit: totalIncome - totalExpense
    };
  }
};
