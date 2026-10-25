/* =============================================================================
   DOT ERP
   FILE:  data/vendor-payment-data.js
   ROLE:  Data-access layer for Vendor Payment — Phase 4, Module 19. A
          Payment Request being Approved means someone authorized the
          money to move; this module is where it actually MOVES — the
          execution of a decision that's already been made, not another
          decision in its own right.

   BUILT FROM ONE APPROVED PAYMENT REQUEST, HEADER ONLY, NO LINE ITEMS —
   THE SAME SHAPE PAYMENT REQUEST ITSELF USED ONE MODULE BACK.
   `linkedRequestId` required, exclusive (`getLinkedRequestIds`/
   `getAvailableApprovedRequestsForCompany`, the eleventh instance of the
   exclusivity pattern this session). `amountPaid` defaults from the
   request's own `requestedAmount` but stays independently editable — a
   REAL, deliberate design point: partial payments happen in real
   accounts payable (a vendor dispute over one line shouldn't hold up
   payment for the rest), so this field is never locked the way GRN's
   copied numbers were, mirroring Payment Request's own "defaults but
   doesn't lock" treatment of the same underlying number one hop up.

   STATUS LIFECYCLE: THE SIMPLE 3-STATE SHAPE, NOT ANOTHER APPROVAL
   GATE. `Draft -> Paid -> Cancelled` — the decision already happened in
   Payment Request; this module's own `Draft -> Paid` transition is
   purely administrative, recording that an already-authorized payment
   was executed. Same reasoning `sendToVendor()` used on `po-data.js`
   (dispatching an already-approved action isn't a new decision) and the
   same reasoning every simple 3-state operational module since Delivery
   Schedule has used. Named `Paid`, not `Executed`/`Completed`/`Posted`
   (all used elsewhere in this chain), to keep the vocabulary distinct.

   THIS IS THE LAST MODULE BEFORE PURCHASE CLOSURE (MODULE 20) — THE
   CHAIN'S OWN FINAL LINK. Once a Vendor Payment record reaches Paid, the
   entire procure-to-pay journey this session built (Department Need
   through here) has a complete, connected trail: Need -> PR -> RFQ ->
   Quotation -> PO -> Schedule -> Receipt -> GRN -> Invoice -> Match ->
   Request -> Payment. Purchase Closure's own job, one module ahead, is
   to walk that whole trail and formally close the loop.

   RETROFITTED (Phase 6, Bank Reconciliation build): added `bankId`,
   pointing at `ERP_BankRepository` — which of the company's OWN bank
   accounts the money actually left from. This field genuinely should
   have existed from the start (Bank Master shipped as Phase 3's own
   last module, chronologically BEFORE this one), and Receipt (Phase 5,
   built later) got the equivalent field the moment it needed it — this
   module simply didn't, an inconsistency rather than a deliberate
   choice, caught and fixed only once Bank Reconciliation needed both
   sides (money out here, money in via Receipt) to be attributable to a
   specific account symmetrically. Same picker shape Receipt's own
   `bankId` already established (`ERP_BankRepository.getActiveForCompany()`,
   masked label, defaults to the company's default bank) — no new pattern
   invented, just the existing one finally applied here too.
   `getPaidForCompany()` was added at the same time, mirroring Receipt's
   own `getReceivedForCompany()`, for the same reason: Bank Reconciliation
   needs a symmetric "every settled record" surface from both sides.
   ========================================================================== */

const ERP_VENDOR_PAYMENT_KEY = "erp_vendor_payments";

const ERP_VENDOR_PAYMENT_STATUSES = ["Draft", "Paid", "Cancelled"];

const ERP_VENDOR_PAYMENT_METHODS = ["Bank Transfer", "Cheque", "Online Payment", "Cash"];

const ERP_VendorPaymentRepository = {
  statuses: ERP_VENDOR_PAYMENT_STATUSES,
  paymentMethods: ERP_VENDOR_PAYMENT_METHODS,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_VENDOR_PAYMENT_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_VENDOR_PAYMENT_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((v) => v.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((v) => v.id === id) || null;
  },

  nextPaymentCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((v) => {
      const match = /-VP-(\d+)$/.exec(v.paymentCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-VP-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(v) {
    return v.status === "Draft";
  },

  canDelete(v) {
    return v.status === "Draft" || v.status === "Cancelled";
  },

  /** Added alongside the bankId retrofit — Bank Reconciliation needs the
      same "every settled record for this company" surface Receipt's own
      getReceivedForCompany() already provides, so this module gets the
      symmetric hook rather than Bank Reconciliation filtering
      getAllForCompany() inline. Sorted oldest-first, same convention. */
  getPaidForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((v) => v.status === "Paid")
      .sort((a, b) => new Date(a.paidAt) - new Date(b.paidAt));
  },

  getLinkedRequestIds(companyId, excludePaymentId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((v) => {
      if (v.id === excludePaymentId || v.status === "Cancelled") return;
      if (v.linkedRequestId) ids.add(v.linkedRequestId);
    });
    return ids;
  },

  getAvailableApprovedRequestsForCompany(companyId, excludePaymentId) {
    if (typeof ERP_PaymentRequestRepository === "undefined") return [];
    const claimed = this.getLinkedRequestIds(companyId, excludePaymentId);
    return ERP_PaymentRequestRepository.getAllForCompany(companyId)
      .filter((p) => p.status === "Approved" && !claimed.has(p.id));
  },

  /** The retrofit hook for Payment Request's own Detail modal. */
  findPaymentForRequest(companyId, requestId) {
    return this.getAllForCompany(companyId).find((v) =>
      v.status !== "Cancelled" && v.linkedRequestId === requestId
    ) || null;
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "VP-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      paymentCode: this.nextPaymentCode(company),
      linkedRequestId: null,
      paymentDate: null,
      paymentMethod: "",
      bankId: null,
      transactionReference: "",
      amountPaid: null,
      notes: "",
      status: "Draft",
      paidAt: null, paidByUsername: null,
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
    const idx = all.findIndex((v) => v.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Paid. Administrative execution, not a decision — see file
      header. */
  markPaid(id, actorUsername) {
    return this.update(id, { status: "Paid", paidAt: new Date().toISOString(), paidByUsername: actorUsername });
  },

  reopen(id) {
    return this.update(id, { status: "Draft", paidAt: null, paidByUsername: null });
  },

  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  remove(id) {
    const v = this.findById(id);
    if (!v || !this.canDelete(v)) return false;
    const all = this.getAll().filter((rec) => rec.id !== id);
    this._saveAll(all);
    return true;
  }
};
