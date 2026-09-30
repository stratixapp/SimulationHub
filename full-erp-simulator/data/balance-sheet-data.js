/* =============================================================================
   DOT ERP
   FILE:  data/balance-sheet-data.js
   ROLE:  Computation layer for the Balance Sheet — Phase 6, Module 06.
          The culmination of the Phase 6 reporting chain so far: General
          Ledger (Module 03) → Trial Balance (Module 04) → Profit & Loss
          (Module 05) → this. It's also the FIRST module in that chain to
          consume the output of TWO earlier ones at once — General
          Ledger's `getAccountSummary()` AND Profit & Loss's
          `getProfitAndLoss()` — rather than building on just one.

   NO STORAGE KEY, SAME AS THE LAST THREE REPORTS: nothing created,
   edited, or deleted here either.

   "AS OF" A DATE, NOT A PERIOD — LIKE TRIAL BALANCE, UNLIKE PROFIT & LOSS.
   Assets, Liabilities, and Equity are Trial-Balance-shaped concepts:
   "how much do we own/owe/have invested, right now" is a point-in-time
   question, not a flow over a range, the exact opposite of Profit &
   Loss's own Income/Expense question. So this file calls
   `ERP_GeneralLedgerRepository.getAccountSummary(companyId, accountId,
   {toDate: asOfDate})` for every Asset/Liability/Equity Ledger account —
   the SAME function Trial Balance calls, for the SAME reason (real reuse,
   not reimplementation) — and deliberately does NOT touch Profit & Loss's
   own period-based computation for those three account types.

   THE ONE GENUINELY HARD PROBLEM THIS MODULE HAS TO SOLVE: WHERE DOES THE
   PROFIT GO? A balance sheet has to satisfy Assets = Liabilities +
   Equity. Every Asset/Liability/Equity account's own closing balance is
   available directly — but if this file summed ONLY those three account
   types' own balances, the sheet would NOT balance the moment any
   Income or Expense had ever been posted. Concretely: post "Dr Cash
   5000 / Cr Sales Revenue 5000" — Cash (an Asset) goes up by 5000, but
   nothing in Liability or Equity moved, because Sales Revenue is an
   Income account, and this file was only looking at the other three
   types. Assets would show +5000 with nothing on the other side to match
   it. In a REAL accounting system this doesn't happen because Income and
   Expense accounts get formally CLOSED at period end — a closing journal
   entry moves their net balance into a Retained Earnings equity account,
   and they reset to zero for the new period. This project has no closing-
   entry mechanism anywhere in Journal Entry (this is the same gap Profit
   & Loss's own header already named), so the honest fix isn't to fake a
   closing entry that never happened — it's to COMPUTE what one WOULD move,
   live, every time this report runs, the same way Tally's own Balance
   Sheet shows a live "Profit & Loss A/c" line under Capital without
   requiring the user to manually close the books first. Concretely:

       totalEquity = (sum of real Equity Ledger accounts' own balances)
                     + currentEarnings

   where `currentEarnings` is `ERP_ProfitAndLossRepository.getProfitAndLoss()`'s
   own `netProfit` — called with NO `fromDate` (meaning "since the very
   first posting ever," not "since the start of some fiscal year," since
   this project has no fiscal-year-start concept and, critically, no
   closing entry has EVER run to reset the clock) through `asOfDate`.
   `currentEarnings` is presented to the page as its own explicit line
   item inside the Equity section — never silently folded into a total
   with no visible source — because it's a COMPUTED figure, not a real
   Ledger account balance, and hiding that distinction would be exactly
   the kind of quiet imprecision Section 9's own documentation standard
   argues against.

   SIGN HANDLING — WHY THIS ISN'T JUST "SUM closingBalance.amount":
   `getAccountSummary()`'s own `closingBalance` is `{amount, side}`, and
   `side` can be the account's own normal side (the common case) OR the
   OPPOSITE side (a contra balance — an overdrawn bank account, a
   liability that's been overpaid into a debit position). A contra
   balance doesn't just "not count" — it actively SUBTRACTS from that
   section's total, because an overdrawn Asset account has, in real
   terms, gone negative. `_signedContribution()` below encodes exactly
   that: `+amount` when `closingBalance.side` matches `normalBalance`,
   `-amount` when it's the contra side. This is the same sign logic
   General Ledger's own `signedBalanceToDisplay()` uses internally, just
   applied at the summing stage instead of the display stage.

   WHY THIS PAGE DOESN'T REUSE TRIAL BALANCE'S TWO-COLUMN Dr/Cr LAYOUT:
   Trial Balance's whole point is showing which side of its own ledger
   every account sits on — that's a bookkeeping-mechanics question, and
   Debit/Credit columns are the right shape for it. A Balance Sheet asks
   a business question instead — "how much do we own, how much do we owe,
   what's left over" — and every real balance sheet presents that as
   plain positive amounts grouped into Assets vs. Liabilities-and-Equity,
   never as a Dr/Cr grid. Copying Trial Balance's own column shape here
   would answer the wrong question correctly rather than the right
   question at all, so this file's own return shape doesn't have a
   `debitColumn`/`creditColumn` pair anywhere in it — each row just has
   one plain, already-signed `amount`.
   ========================================================================== */

const ERP_BalanceSheetRepository = {
  /** +amount if the account's closing balance sits on its own normal
      side (the common, "healthy" case), -amount if it's a contra balance
      (sits on the opposite side) — see file header. */
  _signedContribution(summary) {
    return summary.closingBalance.side === summary.normalBalance
      ? summary.closingBalance.amount
      : -summary.closingBalance.amount;
  },

  _summariesForType(companyId, asOfDate, accountType) {
    return ERP_ChartOfAccountsRepository.getAllForCompany(companyId)
      .filter((a) => !a.isGroup && a.accountType === accountType)
      .map((a) => ERP_GeneralLedgerRepository.getAccountSummary(companyId, a.id, { toDate: asOfDate }))
      .sort((a, b) => String(a.account.accountCode).localeCompare(String(b.account.accountCode), undefined, { numeric: true }));
  },

  /** {asOfDate, assets:[{account,transactionCount,amount}], liabilities:[...],
      equity:[...], currentEarnings, totalAssets, totalLiabilities,
      totalEquity, totalLiabilitiesAndEquity, difference, isBalanced}.
      Every row's `amount` is already sign-adjusted for contra balances
      (see `_signedContribution()`) — the page never needs to re-derive
      that. Includes every Asset/Liability/Equity Ledger account
      regardless of activity, same "don't filter inside the data layer"
      discipline Trial Balance and Profit & Loss both already established
      — the page's own "With Activity Only" toggle is a display choice. */
  getBalanceSheet(companyId, asOfDate) {
    const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);

    const toRows = (summaries) => summaries.map((s) => ({
      account: s.account,
      transactionCount: s.transactionCount,
      amount: this._signedContribution(s)
    }));

    const assets = toRows(this._summariesForType(companyId, effectiveDate, "Asset"));
    const liabilities = toRows(this._summariesForType(companyId, effectiveDate, "Liability"));
    const equity = toRows(this._summariesForType(companyId, effectiveDate, "Equity"));

    const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
    const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
    const equityFromAccounts = equity.reduce((s, r) => s + r.amount, 0);

    // All-time cumulative profit through asOfDate — no fromDate, deliberately.
    // See file header for why this is the honest stand-in for a closing
    // entry this project has no mechanism to actually post.
    const currentEarnings = ERP_ProfitAndLossRepository.getProfitAndLoss(companyId, undefined, effectiveDate).netProfit;

    const totalEquity = equityFromAccounts + currentEarnings;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const difference = totalAssets - totalLiabilitiesAndEquity;

    return {
      asOfDate: effectiveDate,
      assets, liabilities, equity,
      currentEarnings,
      totalAssets, totalLiabilities, totalEquity, totalLiabilitiesAndEquity,
      difference,
      isBalanced: Math.abs(difference) < 0.005
    };
  }
};
