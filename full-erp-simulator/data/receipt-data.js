/* =============================================================================
   DOT ERP
   FILE:  data/receipt-data.js
   ROLE:  Data-access layer for Receipt — Phase 5, Module 09. Read
          payment-collection-data.js's header first — this module is the
          THIRD independent branch off the Tax Invoice hub that header
          describes, and the one place in that trio where the earlier
          Section 10 prediction actually held.

   THE MIRROR HELD THIS TIME — VENDOR PAYMENT'S SHAPE GENUINELY FITS,
   UNLIKE PAYMENT COLLECTION ONE MODULE AGO. Recording that money
   actually landed in the bank is a single, factual, after-the-fact
   event — there's no multi-touch process to model, no follow-up
   pipeline, nothing to authorize. That's exactly Vendor Payment's own
   shape (Phase 4, #19): a simple `Draft -> Received -> Cancelled`
   header-only execution record, reused here almost unchanged. Worth
   stating plainly since the last two modules both broke from their
   obvious mirror for good reasons — the discipline that led Payment
   Collection AWAY from this shape is the same discipline that confirms
   it's the right one HERE. Terminal status is `Received`, not
   `Collected` — deliberately a different word from Payment Collection's
   own terminal state, even though the two could read as interchangeable
   in casual speech. They're not the same fact: `Collected` means a
   follow-up effort succeeded; `Received` means money is confirmed in
   the bank. Reusing `Collected` here would have quietly implied the two
   modules are recording the same event, when they're not — Payment
   Collection can exist and succeed with no Receipt ever created (the
   team just never got around to logging the formal voucher), and a
   Receipt can exist with no Payment Collection follow-up before it (an
   advance payment, paid before anyone had to chase it).

   BUILT FROM THE TAX INVOICE DIRECTLY, NOT FROM PAYMENT COLLECTION —
   Receipt is the third of the three independent branches Dispatch's own
   header predicted off the Tax Invoice hub. A receipt voucher only
   needs to know which invoice got paid, how much, and by what method —
   which specific follow-up attempt (if any) led to that payment isn't
   material to the accounting record, and Payment Collection isn't even
   exclusive (Section 9), so there'd be no single "the" follow-up to
   point at even if it mattered.

   EXCLUSIVE OVER ITS PARENT INVOICE — AT MOST ONE RECEIPT PER INVOICE,
   A DOCUMENTED SIMPLIFICATION. A real invoice can genuinely be settled
   through several partial receipts over time (an installment plan, a
   part-payment now and the balance later). This simulator simplifies
   that to one receipt per invoice, the same kind of one-per-parent
   trade-off Invoice Verification (Phase 4, #16) already documented for
   "at most one invoice per PO" — real flexibility traded for a
   simpler, still-realistic teaching model. `amountReceived` still
   defaults from the invoice's own grand total but stays fully editable,
   the same "partial payments are a normal, legitimate case" reasoning
   Vendor Payment's own `amountPaid` used — so a single partial payment
   is still representable, just not a SEQUENCE of them within this
   simulator's scope.

   BANK MASTER, USED IN A GENUINELY REVERSED DIRECTION FROM PAYMENT
   REQUEST/VENDOR PAYMENT. Those two modules resolved a bank account
   through a linked VENDOR's own `getEffectiveBankDetails()` — read-only,
   never chosen, because the question was "which account does the
   vendor want paid into," an external party's own detail. Receipt asks
   a different question entirely: "which of OUR OWN accounts did this
   money land in" — the company's own choice, not a resolution through
   any outside party. So this module uses a plain picker over
   `ERP_BankRepository.getActiveForCompany(company.id)`, defaulting to
   `getDefault(company.id)` but freely changeable, and displays each
   option through the bank module's own `maskedLabel()` helper — the
   exact same masking Vendor Master's own retrofit already uses, reused
   because it's the right shape, not reinvented.

   `.paymentMethods` IS ITS OWN DELIBERATELY EXPANDED VOCABULARY, NOT A
   COPY OF VENDOR PAYMENT'S — Vendor Payment's own list (Bank Transfer/
   Cheque/Online Payment/Cash) was written for an OUTBOUND payment
   process; Receipt adds `UPI` as its own fifth, distinct option,
   because UPI has become a genuinely common B2B collection channel in
   India (including for amounts well beyond casual retail use) and
   deserves its own named category rather than being folded into "Online
   Payment," which more naturally reads as a gateway/wire transaction.
   A small, deliberate divergence, not an oversight.

   `receivedByEmployeeId` REUSES EMPLOYEE MASTER — the same "who on our
   side handled this" convention as Dispatch's own "Dispatched By,"
   Goods Receipt's "Received By," and Payment Collection's "Assigned To."

   NO DUPLICATE CHECK NEEDED — resolution #8 (Section 9), the same
   "structurally not applicable" reasoning as Dispatch: exclusivity via
   `linkedInvoiceId` already prevents claiming the same invoice's
   receipt twice, and there's no child array to duplicate a row within.

   `findReceiptForInvoice()` is the retrofit hook — Tax Invoice's own
   Detail modal picks up a genuine single "Linked to Receipt" row from
   it (Receipt IS exclusive, unlike Payment Collection's own aggregate
   retrofit one module ago). `getReceivedForCompany()` is the FK-surface
   hook Sales Close (#10) is expected to read from.
   ========================================================================== */

const ERP_RECEIPT_KEY = "erp_receipts";

const ERP_RECEIPT_STATUSES = ["Draft", "Received", "Cancelled"];

const ERP_RECEIPT_PAYMENT_METHODS = ["Cash", "Cheque", "Bank Transfer", "UPI", "Online Payment"];

const ERP_ReceiptRepository = {
  statuses: ERP_RECEIPT_STATUSES,
  paymentMethods: ERP_RECEIPT_PAYMENT_METHODS,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_RECEIPT_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_RECEIPT_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((r) => r.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((r) => r.id === id) || null;
  },

  /** COMP-001-RCPT-01, COMP-001-RCPT-02, ... */
  nextReceiptCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((r) => {
      const match = /-RCPT-(\d+)$/.exec(r.receiptCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-RCPT-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(r) {
    return r.status === "Draft";
  },

  canDelete(r) {
    return r.status === "Draft" || r.status === "Cancelled";
  },

  /** Every invoice id currently claimed by a non-Cancelled receipt in
      this company. */
  getLinkedInvoiceIds(companyId, excludeReceiptId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((r) => {
      if (r.id === excludeReceiptId || r.status === "Cancelled") return;
      if (r.linkedInvoiceId) ids.add(r.linkedInvoiceId);
    });
    return ids;
  },

  /** Raised invoices not already claimed elsewhere — the pool the
      "record a receipt for an invoice" picker offers. Reads the SAME
      `getRaisedForCompany()` pool Dispatch and Payment Collection both
      independently read from — see this file's own header. */
  getAvailableRaisedInvoicesForCompany(companyId, excludeReceiptId) {
    if (typeof ERP_TaxInvoiceRepository === "undefined") return [];
    const claimed = this.getLinkedInvoiceIds(companyId, excludeReceiptId);
    return ERP_TaxInvoiceRepository.getRaisedForCompany(companyId).filter((inv) => !claimed.has(inv.id));
  },

  /** The retrofit hook for Tax Invoice's own Detail modal — a genuine
      single link, since this module IS exclusive (unlike Payment
      Collection's own aggregate retrofit). */
  findReceiptForInvoice(companyId, invoiceId) {
    return this.getAllForCompany(companyId).find((r) =>
      r.status !== "Cancelled" && r.linkedInvoiceId === invoiceId
    ) || null;
  },

  /** The FK-surface hook Sales Close (#10) is expected to read from —
      every Received record for this company, oldest-first (FIFO). */
  getReceivedForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((r) => r.status === "Received")
      .sort((a, b) => new Date(a.receivedAt) - new Date(b.receivedAt));
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "RCPT-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      receiptCode: this.nextReceiptCode(company),
      linkedInvoiceId: null,
      amountReceived: 0,
      receivedDate: null,
      paymentMethod: "",
      bankId: null,
      referenceNumber: "",
      receivedByEmployeeId: null,
      remarks: "",
      status: "Draft",
      receivedAt: null, receivedByUsername: null,
      cancelledAt: null, cancelledByUsername: null,
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
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Received. A factual record, not a decision — see file
      header. */
  markReceived(id, actorUsername) {
    return this.update(id, { status: "Received", receivedAt: new Date().toISOString(), receivedByUsername: actorUsername });
  },

  reopen(id) {
    return this.update(id, { status: "Draft", receivedAt: null, receivedByUsername: null });
  },

  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  remove(id) {
    const r = this.findById(id);
    if (!r || !this.canDelete(r)) return false;
    const all = this.getAll().filter((rec) => rec.id !== id);
    this._saveAll(all);
    return true;
  }
};
