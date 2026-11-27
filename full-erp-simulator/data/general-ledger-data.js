/* =============================================================================
   DOT ERP
   FILE:  data/general-ledger-data.js
   ROLE:  Computation layer for General Ledger — Phase 6, Module 03.

   THE FIRST DATA FILE IN THIS PROJECT WITH NO STORAGE KEY OF ITS OWN.
   Every earlier `data/*.js` file owns a `localStorage` key and a CRUD
   lifecycle — this one owns neither. General Ledger doesn't create,
   edit, or delete anything; it's a lens over data Chart of Accounts and
   Journal Entry already own. There's no `getAll()`/`_saveAll()` pattern
   here because there's nothing to save — every function below is a pure
   read-and-compute over `ERP_ChartOfAccountsRepository` and
   `ERP_JournalEntryRepository`, called fresh every time (same "no
   caching, recompute live" reasoning `dashboard-data.js` settled on:
   aggregation here is cheap array scans, not an expensive query, so
   there's no correctness-vs-speed tradeoff to make in the first place).

   THE ONE REAL PIECE OF NEW LOGIC: RUNNING BALANCE, SIGNED CORRECTLY.
   A Ledger account's balance isn't just "sum of debits minus sum of
   credits" — which side COUNTS as the increasing direction depends on
   the account's own Account Type, via `ERP_ChartOfAccountsRepository.
   getNormalBalance()` (Chart of Accounts' own file already promised every
   later Phase 6 module would read this rather than re-deriving it — this
   is the first one to actually do so). Internally, every balance is kept
   as ONE signed number in "normal-balance terms" (positive = same side as
   the account's own normal balance, negative = a contra position — an
   overdrawn bank account, a refunded expense) so the running-balance math
   is a single addition per line regardless of account type, not a
   branching if/else at every step. `signedBalanceToDisplay()` converts
   that internal number back to the `{amount, side}` shape the page
   actually shows, only at the boundary — the same "keep the signed math
   internal, convert to Dr/Cr only for display" reasoning Chart of
   Accounts' own Opening Balance field already uses.

   SCOPE LINE AGAINST TRIAL BALANCE (NOT BUILT YET, BUT WORTH DRAWING NOW):
   General Ledger answers "what happened to THIS account, in order, with a
   running balance" — a per-account transaction history. Trial Balance
   will answer "what's the closing balance of EVERY account, side by
   side, right now" — a company-wide summary snapshot. `getAccountSummary()`
   below (closing balance + totals for ONE account) is what this module
   needs for its own account-list table; Trial Balance is expected to call
   it once per postable account rather than reimplementing the same
   debit/credit-totaling logic — genuine, deliberate reuse forward, not
   this file reaching forward to build something only Trial Balance would
   need.

   INCLUDES INACTIVE ACCOUNTS, DELIBERATELY: Journal Entry's own account
   picker correctly filters to Active accounts only (you shouldn't be able
   to post NEW entries to a retired account) — but General Ledger is a
   HISTORICAL record, and an account marked Inactive after it was posted
   to still has real transaction history that needs to stay visible.
   Filtering Inactive accounts out here would make old postings vanish
   from the books, which is a much worse bug than showing a slightly
   longer account list.
   ========================================================================== */

const ERP_GeneralLedgerRepository = {
  /** Convert an internal signed "normal-balance-terms" number back to the
      {amount, side} shape a page actually displays. Positive stays on the
      account's own normal side; negative flips to the opposite side (a
      contra balance) and reports a positive amount there instead of a
      negative number, which is how a real ledger always presents it. */
  signedBalanceToDisplay(signedAmount, normalBalance) {
    const opposite = normalBalance === "Debit" ? "Credit" : "Debit";
    return signedAmount >= 0
      ? { amount: signedAmount, side: normalBalance }
      : { amount: -signedAmount, side: opposite };
  },

  /** +delta for a line that moves the balance further onto its normal
      side, -delta for a line that moves it the other way — one formula
      regardless of whether the account is Debit- or Credit-normal. */
  _lineDelta(normalBalance, debit, credit) {
    const d = Number(debit) || 0, c = Number(credit) || 0;
    return normalBalance === "Debit" ? (d - c) : (c - d);
  },

  /** Opening Balance as a signed "normal-balance-terms" starting point for
      the running-balance walk below. Group accounts never carry one of
      their own (see chart-of-accounts-data.js's header) — returns 0. */
  _openingBalanceSigned(account, normalBalance) {
    if (account.isGroup) return 0;
    const amt = Number(account.openingBalance) || 0;
    return account.openingBalanceType === normalBalance ? amt : -amt;
  },

  /** Every Posted line that touched this account, oldest first, each
      carrying the entry it came from and a running balance computed from
      the account's own Opening Balance forward. `fromDate`/`toDate`
      (inclusive, "YYYY-MM-DD" strings) are optional — when given, the
      running balance still walks the FULL history up to `fromDate` first
      (so the balance the range opens on is correct), then only the rows
      inside the range are returned; a partial-period ledger with a
      believable opening balance, not a truncated one starting from zero. */
  getLedgerForAccount(companyId, accountId, opts) {
    const account = ERP_ChartOfAccountsRepository.findById(accountId);
    if (!account || account.companyId !== companyId) {
      return { account: null, normalBalance: "Debit", openingBalance: { amount: 0, side: "Debit" }, rows: [], closingBalance: { amount: 0, side: "Debit" } };
    }

    const normalBalance = ERP_ChartOfAccountsRepository.getNormalBalance(account.accountType);
    const fromDate = opts && opts.fromDate;
    const toDate = opts && opts.toDate;

    const flatLines = [];
    ERP_JournalEntryRepository.getAllForCompany(companyId)
      .filter((e) => e.status === "Posted")
      .forEach((e) => {
        (e.lines || []).forEach((l) => {
          if (l.accountId === accountId) {
            flatLines.push({
              entryId: e.id, entryNumber: e.entryNumber, entryDate: e.entryDate,
              narration: e.narration, lineNarration: l.lineNarration,
              debit: Number(l.debit) || 0, credit: Number(l.credit) || 0
            });
          }
        });
      });
    flatLines.sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate) || a.entryNumber.localeCompare(b.entryNumber, undefined, { numeric: true }));

    let running = this._openingBalanceSigned(account, normalBalance);
    const rows = [];
    flatLines.forEach((line) => {
      // toDate is checked FIRST and returns immediately, before running is
      // touched at all — a line dated after the as-of date must have zero
      // effect on anything, not just be excluded from the visible rows.
      // (This file shipped for one session with the check in the other
      // order — running got incremented for every line regardless, then
      // toDate only gated whether a row was pushed — which meant
      // closingBalance silently included postings dated AFTER the as-of
      // date whenever any existed. Caught by balance-sheet-data.js's own
      // multi-scenario verification, which is exactly the kind of thing a
      // single-entry sandbox test can't surface — see CONTINUE_HERE.md.)
      if (toDate && line.entryDate > toDate) return;
      if (fromDate && line.entryDate < fromDate) {
        // Still walks the balance forward through pre-range history —
        // see this function's own header note — just doesn't emit a row.
        running += this._lineDelta(normalBalance, line.debit, line.credit);
        return;
      }
      running += this._lineDelta(normalBalance, line.debit, line.credit);
      rows.push({ ...line, runningBalance: this.signedBalanceToDisplay(running, normalBalance) });
    });

    const openingSignedAtRangeStart = fromDate
      ? this._openingBalanceSigned(account, normalBalance) + flatLines
          .filter((l) => l.entryDate < fromDate)
          .reduce((sum, l) => sum + this._lineDelta(normalBalance, l.debit, l.credit), 0)
      : this._openingBalanceSigned(account, normalBalance);

    return {
      account,
      normalBalance,
      openingBalance: this.signedBalanceToDisplay(openingSignedAtRangeStart, normalBalance),
      rows,
      closingBalance: this.signedBalanceToDisplay(running, normalBalance)
    };
  },

  /** {account, normalBalance, totalDebit, totalCredit, transactionCount,
      closingBalance:{amount,side}} for ONE account — the row shape this
      module's own account-list table needs, and what Trial Balance is
      expected to call once per postable account rather than re-deriving
      the same totals (see file header). `opts` ({fromDate, toDate}) is
      optional and passes straight through to getLedgerForAccount() —
      added when Trial Balance needed an "as of [date]" snapshot rather
      than always-as-of-today; every existing call site (this file's own
      getAllAccountSummaries(), General Ledger's page) calls this with no
      third argument and gets identical behavior to before. */
  getAccountSummary(companyId, accountId, opts) {
    const ledger = this.getLedgerForAccount(companyId, accountId, opts);
    const totalDebit = ledger.rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = ledger.rows.reduce((s, r) => s + r.credit, 0);
    return {
      account: ledger.account,
      normalBalance: ledger.normalBalance,
      totalDebit, totalCredit,
      transactionCount: ledger.rows.length,
      closingBalance: ledger.closingBalance
    };
  },

  /** One summary per Ledger account (Group accounts excluded — they carry
      no balance of their own; see chart-of-accounts-data.js). Includes
      Inactive accounts on purpose — see file header. */
  getAllAccountSummaries(companyId) {
    return ERP_ChartOfAccountsRepository.getAllForCompany(companyId)
      .filter((a) => !a.isGroup)
      .map((a) => this.getAccountSummary(companyId, a.id));
  }
};
