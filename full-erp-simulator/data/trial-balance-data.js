/* =============================================================================
   DOT ERP
   FILE:  data/trial-balance-data.js
   ROLE:  Computation layer for Trial Balance — Phase 6, Module 04. The
          first genuine (report), not just read-only-view, module: General
          Ledger (Module 03) shows one account's history in detail; this
          shows every account's closing balance side by side, at once.

   NO STORAGE KEY HERE EITHER — same reasoning as general-ledger-data.js's
   own header: nothing is created, edited, or deleted, so there's nothing
   to persist. This file is even thinner than that one: it doesn't
   re-derive any balance math of its own at all. `getTrialBalance()` calls
   `ERP_GeneralLedgerRepository.getAccountSummary()` once per postable
   account — exactly the reuse General Ledger's own header called for —
   and does only the two things that are genuinely THIS report's job and
   nobody else's:

   1. RESHAPE {amount, side} INTO TWO COLUMNS. General Ledger's own view
      shows one account at a time, so a single amount+side pair reads
      fine ("₹200 Credit"). A trial balance shows every account AT ONCE,
      and the whole point of the format is a Debit column and a Credit
      column side by side, with each account's balance sitting in
      whichever one matches its `closingBalance.side` and reading zero in
      the other — that's the shape `getTrialBalance()` produces, and it's
      only a genuine transformation because "one account's balance" and
      "everyone's balances arranged into two columns" are different
      questions, not the same one asked twice.

   2. "AS OF" A DATE, DEFAULT TODAY. A trial balance is conventionally
      pulled as of a specific date, and General Ledger's own
      getAccountSummary() didn't support that until this module needed
      it — see that file's own header for the (small, additive,
      backward-compatible) extension this module asked for.

   ORDERING IS DELIBERATE, NOT ALPHABETICAL: Asset, Liability, Equity,
   Income, Expense — `ERP_ChartOfAccountsRepository.accountTypes`' own
   order — then account code within each type. That's the standard order
   every real trial balance prints in, and it's also exactly the order
   `ERP_ACCOUNT_TYPE_META` and Chart of Accounts' own account-code blocks
   already use, so this file adds no new ordering concept, just applies
   one that already existed.

   WHY THIS SHOULD ALWAYS BALANCE, STATED AS A CLAIM WORTH VERIFYING, NOT
   JUST ASSERTING: `isBalanced` should be `true` every single time this
   function is called, for any company, any date — not as an aspiration,
   but as a direct consequence of two rules already enforced elsewhere:
   Journal Entry's own `canPost()` refuses to post anything that doesn't
   balance to zero, and `reverse()` only ever swaps an already-balanced
   entry's own debits and credits, which is still balanced by
   construction. If a real bug ever made `isBalanced` false here, that
   would mean one of those two guarantees broke somewhere upstream, not
   that this file's own math is wrong — which is exactly why the page
   surfaces the Difference figure prominently rather than hiding it: it's
   a live integrity check on the whole system, not decoration.
   ========================================================================== */

const ERP_TrialBalanceRepository = {
  /** {asOfDate, rows:[{account, transactionCount, debitColumn,
      creditColumn}], totalDebit, totalCredit, difference, isBalanced}.
      `asOfDate` defaults to today ("YYYY-MM-DD") when omitted. Includes
      every Ledger account regardless of balance or Active/Inactive status
      — the page's own "With Balance Only" filter is a display choice, not
      something this computation should bake in, the same "don't filter
      inside the data layer" discipline `getAllAccountSummaries()` already
      follows for Inactive accounts. */
  getTrialBalance(companyId, asOfDate) {
    const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);
    const typeOrder = ERP_ChartOfAccountsRepository.accountTypes;

    const summaries = ERP_ChartOfAccountsRepository.getAllForCompany(companyId)
      .filter((a) => !a.isGroup)
      .map((a) => ERP_GeneralLedgerRepository.getAccountSummary(companyId, a.id, { toDate: effectiveDate }));

    summaries.sort((a, b) => {
      const typeDiff = typeOrder.indexOf(a.account.accountType) - typeOrder.indexOf(b.account.accountType);
      if (typeDiff !== 0) return typeDiff;
      return String(a.account.accountCode).localeCompare(String(b.account.accountCode), undefined, { numeric: true });
    });

    const rows = summaries.map((s) => ({
      account: s.account,
      transactionCount: s.transactionCount,
      debitColumn: s.closingBalance.side === "Debit" ? s.closingBalance.amount : 0,
      creditColumn: s.closingBalance.side === "Credit" ? s.closingBalance.amount : 0
    }));

    const totalDebit = rows.reduce((sum, r) => sum + r.debitColumn, 0);
    const totalCredit = rows.reduce((sum, r) => sum + r.creditColumn, 0);
    const difference = totalDebit - totalCredit;

    return {
      asOfDate: effectiveDate,
      rows,
      totalDebit,
      totalCredit,
      difference,
      isBalanced: Math.abs(difference) < 0.005
    };
  }
};
