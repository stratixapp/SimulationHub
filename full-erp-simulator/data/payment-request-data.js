/* =============================================================================
   DOT ERP
   FILE:  data/payment-request-data.js
   ROLE:  Data-access layer for Payment Request — Phase 4, Module 18. A
          three-way match Approved for Payment says the money SHOULD move;
          this module is the formal ask for someone to actually release
          it — the request that gets authorized before Vendor Payment
          (Module 19) executes it.

   BUILT FROM ONE APPROVED-FOR-PAYMENT MATCH, HEADER ONLY — NO LINE
   ITEMS. `linkedMatchId` required, exclusive (`getLinkedMatchIds`/
   `getAvailableApprovedMatchesForCompany`, the tenth instance of the
   exclusivity pattern this session). Unlike every receiving-side module
   since Delivery Schedule, this one has no line-items array at all — a
   payment request is a single amount against a single match, not a
   per-line breakdown. `requestedAmount` DEFAULTS from the matched
   invoice's own total (walking match -> invoice, the same live-resolve
   habit this session has used throughout) but stays genuinely editable —
   a real payment request can legitimately differ from the invoice total
   (a negotiated early-payment discount, a partial release pending some
   final check), so this is deliberately NOT locked read-only the way
   GRN's copied numbers were.

   STATUS LIFECYCLE: FULL APPROVAL GATE, BUT NO SEPARATE APPROVAL PAGE —
   THE DEPARTMENT NEED PRECEDENT, NOT THE PR ONE. `Draft -> Submitted ->
   Approved/Rejected, +Cancelled` is the full 5-state gate (releasing
   money is a real decision, arguably the highest-stakes one in this
   entire chain), but the roadmap lists no "Payment Request Approval" as
   its own module the way it did for PR and PO — so `approve()`/
   `reject()` live here AND are wired directly from this module's own
   page, the same "one module owns its whole lifecycle, no split" shape
   Department Need used back at the very start of Phase 4, before PR
   Approval established the two-module pattern that PO Approval and
   every approval-gated module since then followed. Don't assume every
   approval-gated document needs a sibling approval module — check the
   roadmap's own module list first, the way this file's own design had
   to.

   PAY-TO BANK DETAILS ARE RESOLVED FROM THE VENDOR, NOT CHOSEN. This
   module reuses `ERP_VendorRepository.getEffectiveBankDetails(vendor)`
   (Phase 3's own id-first-fallback-to-free-text helper, written for
   exactly this kind of read) to show read-only where the payment is
   headed — a real payment request doesn't offer a picker of arbitrary
   bank accounts, it pays into whatever account the vendor has on file.
   This is the first Phase 4 module to read from Bank Master at all,
   filling in the last untouched Phase 3 master this session's own
   Section 9 convention (link to previously-untouched masters, don't
   invent a free-text field) predicted would eventually get used.
   ========================================================================== */

const ERP_PAYMENT_REQUEST_KEY = "erp_payment_requests";

const ERP_PAYMENT_REQUEST_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Cancelled"];

const ERP_PaymentRequestRepository = {
  statuses: ERP_PAYMENT_REQUEST_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_PAYMENT_REQUEST_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_PAYMENT_REQUEST_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((p) => p.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((p) => p.id === id) || null;
  },

  nextRequestCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((p) => {
      const match = /-PAYREQ-(\d+)$/.exec(p.requestCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-PAYREQ-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(p) {
    return p.status === "Draft";
  },

  canDelete(p) {
    return p.status === "Draft" || p.status === "Rejected" || p.status === "Cancelled";
  },

  /** match -> invoice, resolving the invoice total as a sensible default
      for a new request's amount. RETROFITTED BEHAVIOUR (Phase 15, no
      code change needed here): `.total` used to mean taxable value only,
      because Invoice Verification never captured tax. Now that it can
      (see that file's own header), `.total` is genuinely tax-inclusive,
      so this default correctly suggests paying the FULL billed amount
      rather than quietly excluding tax — a real improvement, verified
      in this phase's own Node sandbox rather than assumed safe. */
  computeDefaultAmount(match) {
    if (!match || typeof ERP_ThreeWayMatchingRepository === "undefined") return null;
    const { invoiceVerification } = ERP_ThreeWayMatchingRepository.computeMatchLines(
      { id: match.companyId }, match
    );
    if (!invoiceVerification || typeof ERP_InvoiceVerificationRepository === "undefined") return null;
    const { total, totalCount, pricedCount } = ERP_InvoiceVerificationRepository.computeGrandTotal(invoiceVerification);
    return totalCount > 0 && pricedCount === totalCount ? total : null;
  },

  getLinkedMatchIds(companyId, excludeRequestId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((p) => {
      if (p.id === excludeRequestId || p.status === "Cancelled") return;
      if (p.linkedMatchId) ids.add(p.linkedMatchId);
    });
    return ids;
  },

  getAvailableApprovedMatchesForCompany(companyId, excludeRequestId) {
    if (typeof ERP_ThreeWayMatchingRepository === "undefined") return [];
    const claimed = this.getLinkedMatchIds(companyId, excludeRequestId);
    return ERP_ThreeWayMatchingRepository.getAllForCompany(companyId)
      .filter((m) => m.status === "Approved for Payment" && !claimed.has(m.id));
  },

  /** The retrofit hook for Three-Way Matching's own Detail modal. */
  findRequestForMatch(companyId, matchId) {
    return this.getAllForCompany(companyId).find((p) =>
      p.status !== "Cancelled" && p.linkedMatchId === matchId
    ) || null;
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "PAYREQ-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      requestCode: this.nextRequestCode(company),
      linkedMatchId: null,
      requestedByEmployeeId: null,
      requestedAmount: null,
      dueDate: null,
      notes: "",
      status: "Draft",
      submittedAt: null, submittedByUsername: null,
      approvedAt: null, approvedByUsername: null,
      rejectedAt: null, rejectedByUsername: null, rejectionReason: "",
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
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  submit(id, actorUsername) {
    return this.update(id, { status: "Submitted", submittedAt: new Date().toISOString(), submittedByUsername: actorUsername });
  },

  withdraw(id) {
    return this.update(id, { status: "Draft", submittedAt: null, submittedByUsername: null });
  },

  /** Wired directly from this module's own page — see file header for
      why there's no separate approval module. */
  approve(id, actorUsername) {
    return this.update(id, { status: "Approved", approvedAt: new Date().toISOString(), approvedByUsername: actorUsername });
  },

  reject(id, actorUsername, reason) {
    return this.update(id, {
      status: "Rejected",
      rejectedAt: new Date().toISOString(),
      rejectedByUsername: actorUsername,
      rejectionReason: reason || ""
    });
  },

  reopen(id) {
    return this.update(id, { status: "Draft" });
  },

  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  remove(id) {
    const p = this.findById(id);
    if (!p || !this.canDelete(p)) return false;
    const all = this.getAll().filter((rec) => rec.id !== id);
    this._saveAll(all);
    return true;
  }
};
