/* =============================================================================
   DOT ERP
   FILE:  data/bank-reconciliation-data.js
   ROLE:  Data-access layer for Bank Reconciliation — Phase 6, Module 07.
          The first Phase 6 module to reach OUTSIDE the Chart of Accounts
          / Journal Entry / General Ledger system this phase has been
          building — into Bank Master (Phase 3) and real Vendor Payment
          (Phase 4) / Receipt (Phase 5) transactions.

   A GENUINE TRANSACTIONAL MODULE, NOT ANOTHER REPORT — the first one in
   Phase 6 since Journal Entry itself. General Ledger, Trial Balance,
   Profit & Loss and Balance Sheet all own no storage; a real bank
   reconciliation is something a business performs monthly and keeps a
   permanent record of having done, so this file has a real `create()`/
   `update()`/lifecycle, `localStorage` key, all of it — the same shape
   Journal Entry has, for the same underlying reason.

   WHY THIS DOESN'T READ FROM JOURNAL ENTRY / GENERAL LEDGER AT ALL: the
   Phase 6 retrofit pass that will make Vendor Payment/Receipt actually
   POST journal entries (Section 3's own item 10) hasn't happened yet —
   there is currently no reliable way to find "the journal entries that
   correspond to this bank account's activity," because Bank Master
   itself has no link to a Chart of Accounts Ledger account at all (it
   predates Chart of Accounts by three phases). Building that link now,
   just for this module, would mean inventing a bank-to-ledger mapping
   this project has no other use for yet and no established pattern to
   follow — a bigger, separate piece of scope than reconciliation itself.
   So this file works from the one thing that already, genuinely exists:
   Vendor Payment and Receipt records, each carrying their own `bankId`
   pointing at a specific real bank account. This is the honest interim
   shape for a company whose AP/AR modules aren't yet posting to a
   general ledger automatically — which, not coincidentally, is exactly
   the state this project's OWN books are in right now.

   THE bankId RETROFIT THIS MODULE REQUIRED ON VENDOR PAYMENT: Receipt
   already carried `bankId` (added when Receipt itself was built, Phase
   5). Vendor Payment did not — an inconsistency, not a deliberate
   choice, caught only because this module needed both sides
   symmetrically. Fixed directly in `vendor-payment-data.js` (see that
   file's own updated header) rather than worked around here.

   THE RECONCILIATION MATH, VERIFIED BY HAND BEFORE BEING CODED:
   Book Balance = (all Receipts for this bank, this company, dated on or
   before the statement date) − (all Vendor Payments, same filter) +
   (adjustments of type "Interest") − (adjustments of type "Charge").
   "Adjustments" are bank-side items — fees, interest — the STATEMENT
   shows that nothing in Vendor Payment/Receipt has recorded yet; without
   them, a real bank charge would make the two balances disagree forever,
   for a reason that isn't actually an error.
   Adjusted Bank Balance = Statement Balance (as typed from the physical
   statement) + Deposits in Transit (uncleared Receipts — money the
   company recorded as received that the bank hasn't reflected yet) −
   Outstanding Payments (uncleared Vendor Payments — money recorded as
   paid that hasn't cleared the bank yet, e.g. an uncashed cheque).
   These two totals should be EQUAL when reconciliation is complete and
   correct — verified against a hand-traced example (₹1000 received
   cleared, ₹500 received not yet cleared, ₹300 paid cleared, ₹200 paid
   not yet cleared, a ₹10 bank charge) before this file was trusted:
   Book Balance = 1000+500−300−200−10 = 990. Bank statement, reflecting
   only what's actually cleared plus its own known charge = 1000−300−10 =
   690. Adjusted Bank Balance = 690+500−200 = 990. Match.

   NOT AUTOMATED: POSTING THE DISCOVERED CHARGES/INTEREST TO JOURNAL
   ENTRY. A real business would, once reconciliation is complete, post a
   Journal Entry for any bank charge or interest this process surfaced —
   debiting/crediting whichever Chart of Accounts Ledger account
   represents this bank. This project has no link from a Bank Master
   record to a Chart of Accounts account (see above), so there's no
   account to safely pre-fill such an entry against without guessing.
   Left as an explicit, documented manual follow-up rather than an
   automated step that would have to fabricate a target account — the
   training guide says so directly rather than silently doing nothing.

   LIFECYCLE: `Draft -> Reconciled`, same immutability principle Journal
   Entry established for `Posted` — once Reconciled, `update()`/`remove()`
   both refuse. A finished bank reconciliation is a real, dated audit
   record (the same "correction is a new entry, not a rewrite" spirit);
   if a mistake is found later, the fix is a NEW reconciliation for the
   same bank, not reopening the old one. No `isDuplicateXxx()` here either
   — same reasoning as Journal Entry's `entryNumber`: nothing about
   {bankId, statementDate} is a user-chosen identifier that needs
   protecting from collision; a trainee is free to attempt the same
   period's reconciliation more than once in Draft while getting it right.
   ========================================================================== */

const ERP_BANK_RECONCILIATION_KEY = "erp_bank_reconciliations";

const ERP_BANK_RECON_ADJUSTMENT_TYPES = ["Charge", "Interest"];

const ERP_BankReconciliationRepository = {
  statuses: ["Draft", "Reconciled"],
  adjustmentTypes: ERP_BANK_RECON_ADJUSTMENT_TYPES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_BANK_RECONCILIATION_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_BANK_RECONCILIATION_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((r) => r.companyId === companyId)
      .sort((a, b) => new Date(b.statementDate) - new Date(a.statementDate) || new Date(b.createdAt) - new Date(a.createdAt));
  },

  getForBank(companyId, bankId) {
    return this.getAllForCompany(companyId).filter((r) => r.bankId === bankId);
  },

  findById(id) {
    return this.getAll().find((r) => r.id === id) || null;
  },

  /** Every Vendor Payment (Paid) and Receipt (Received) tagged to this
      specific bank account, dated on or before `uptoDate` — the book
      side of the reconciliation. See file header for why this reads
      Vendor Payment/Receipt directly instead of Journal Entry. */
  getBookTransactions(companyId, bankId, uptoDate) {
    const payments = ERP_VendorPaymentRepository.getPaidForCompany(companyId)
      .filter((p) => p.bankId === bankId && (!uptoDate || !p.paymentDate || p.paymentDate <= uptoDate));
    const receipts = ERP_ReceiptRepository.getReceivedForCompany(companyId)
      .filter((r) => r.bankId === bankId && (!uptoDate || !r.receivedDate || r.receivedDate <= uptoDate));
    return { payments, receipts };
  },

  canEdit(recon) {
    return recon.status === "Draft";
  },

  canDelete(recon) {
    return recon.status === "Draft";
  },

  /** The full reconciliation computation — see file header for the
      formula and its hand-traced verification. Never mutates `recon`;
      returns a fresh summary the page renders from. */
  computeSummary(companyId, recon) {
    const { payments, receipts } = this.getBookTransactions(companyId, recon.bankId, recon.statementDate);
    const adjustments = recon.adjustments || [];
    const clearedPaymentIds = new Set(recon.clearedPaymentIds || []);
    const clearedReceiptIds = new Set(recon.clearedReceiptIds || []);

    const totalReceipts = receipts.reduce((s, r) => s + (Number(r.amountReceived) || 0), 0);
    const totalPayments = payments.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
    const totalCharges = adjustments.filter((a) => a.type === "Charge").reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const totalInterest = adjustments.filter((a) => a.type === "Interest").reduce((s, a) => s + (Number(a.amount) || 0), 0);

    const bookBalance = totalReceipts - totalPayments + totalInterest - totalCharges;

    const unclearedReceipts = receipts.filter((r) => !clearedReceiptIds.has(r.id));
    const unclearedPayments = payments.filter((p) => !clearedPaymentIds.has(p.id));
    const depositsInTransit = unclearedReceipts.reduce((s, r) => s + (Number(r.amountReceived) || 0), 0);
    const outstandingPayments = unclearedPayments.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);

    const statementBalance = Number(recon.statementBalance) || 0;
    const adjustedBankBalance = statementBalance + depositsInTransit - outstandingPayments;
    const difference = bookBalance - adjustedBankBalance;

    return {
      payments, receipts,
      unclearedReceipts, unclearedPayments,
      totalReceipts, totalPayments, totalCharges, totalInterest,
      bookBalance, depositsInTransit, outstandingPayments,
      statementBalance, adjustedBankBalance,
      difference,
      isReconciled: Math.abs(difference) < 0.005
    };
  },

  create(company, data, actorUsername) {
    const record = {
      id: "BRC-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      bankId: null,
      statementDate: new Date().toISOString().slice(0, 10),
      statementBalance: 0,
      adjustments: [],
      clearedPaymentIds: [],
      clearedReceiptIds: [],
      status: "Draft",
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString(),
      ...data,
      status: "Draft"
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Refuses once Reconciled — same immutability Journal Entry's own
      Posted state enforces, see file header. */
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    if (all[idx].status !== "Draft") return null;
    all[idx] = { ...all[idx], ...partial, status: "Draft", updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Marks Reconciled regardless of whether the balances actually match
      — a trainee should be able to close out a period and flag the
      difference for follow-up rather than being locked out of ever
      finishing it, the same way real bookkeeping sometimes carries a
      small unexplained variance forward rather than never closing the
      books. The page is expected to warn clearly when isReconciled is
      false before this is called, not to block the call itself. */
  markReconciled(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1 || all[idx].status !== "Draft") return null;
    all[idx] = { ...all[idx], status: "Reconciled", reconciledAt: new Date().toISOString(), reconciledByUsername: actorUsername };
    this._saveAll(all);
    return all[idx];
  },

  remove(id) {
    const recon = this.findById(id);
    if (!recon || recon.status !== "Draft") return false;
    const all = this.getAll().filter((r) => r.id !== id);
    this._saveAll(all);
    return true;
  }
};
