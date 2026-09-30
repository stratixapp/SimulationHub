/* =============================================================================
   DOT ERP
   FILE:  data/ap-aging-data.js
   ROLE:  Computation layer for Accounts Payable Aging — Phase 6, Module
          08 (report). No storage key, same as General Ledger/Trial
          Balance/Profit & Loss/Balance Sheet — nothing created, edited,
          or deleted here.

   BUILT FROM PAYMENT REQUEST, NOT INVOICE VERIFICATION OR JOURNAL ENTRY —
   per this project's own roadmap note ("built from Vendor Payment/
   Payment Request data"). A real Accounts Payable balance is technically
   created the moment a vendor's invoice is verified — but Payment
   Request is the record that already carries the two fields aging
   genuinely needs (`requestedAmount` and, critically, `dueDate`) and
   represents "this is now a real, Approved obligation to pay," which is
   the correct unit for an AP Aging report regardless of which upstream
   document technically created the liability first.

   THE FOUR-HOP CHAIN WALK TO FIND WHO'S OWED THE MONEY: Payment Request
   has no `vendorId` of its own — none of Three-Way Matching or Invoice
   Verification denormalize it either. `resolveVendor()` walks Payment
   Request -> (`linkedMatchId`) -> Three-Way Matching -> (`linkedInvoice
   VerificationId`) -> Invoice Verification -> (`linkedPoId`) -> Purchase
   Order -> (`vendorId`) -> Vendor, four hops deep, each one individually
   null-checked so a broken or missing link anywhere degrades to "vendor
   unknown" rather than throwing. This isn't a new pattern for this
   project — GRN's own three-hop chain-walk (see CONTINUE_HERE.md Section
   9) already established that walking several hops to resolve a distant
   relationship is the honest approach when nothing along the way
   denormalizes the field being sought; this file is simply one hop
   longer, because Payment Request sits one module further downstream.

   WHICH PAYMENT REQUESTS COUNT AS "STILL OWED," AND FOR HOW MUCH: only
   Approved requests are real payables (Draft/Submitted haven't been
   authorized yet; Rejected/Cancelled never will be paid). For each,
   `getOutstandingAmount()` checks `ERP_VendorPaymentRepository.
   findPaymentForRequest()` — the SAME retrofit hook Payment Request's own
   Detail modal already reads. If no active Vendor Payment exists yet, OR
   one exists but hasn't reached "Paid" (a Draft payment in progress
   hasn't actually moved money), the FULL `requestedAmount` is still
   owed. If a Paid payment exists, the outstanding balance is
   `requestedAmount - amountPaid` — never negative, and genuinely can be
   a small positive remainder, because Vendor Payment's own header
   explicitly treats partial payments as a normal, supported case, not
   an edge case to ignore. A request with zero (or negative, floored to
   zero) outstanding balance is excluded from the report entirely — it's
   settled, not aging.

   AGING BUCKETS — THE STANDARD FIVE, PLUS ONE HONEST SIXTH: Current
   (not yet due), 1-30 / 31-60 / 61-90 / 90+ days overdue — the same
   bucket structure real ERPs (SAP, Tally, QuickBooks) all use. A sixth
   bucket, "No Due Date," exists because Payment Request's own `dueDate`
   field can genuinely be null (a trainee simply hasn't set one) — an
   aging report answers "how overdue is this," which is a question this
   file refuses to fabricate an answer to when the one fact it depends on
   isn't there. Defaulting an unset due date to "Current" would silently
   understate real risk; defaulting it to "90+ Days" would silently
   overstate it. Naming the gap is the only honest option.

   GROUPED BY VENDOR, SORTED BY LARGEST TOTAL OWED FIRST — the shape a
   real AP Aging report is actually read in: "who do we owe the most,
   and how overdue is it," not a flat list of individual payment
   requests. A request whose vendor couldn't be resolved (a broken chain
   link somewhere) is grouped under its own explicit "Vendor Unknown"
   bucket rather than silently dropped — `unresolvedCount` on the
   top-level return surfaces this as a real data-quality signal the page
   is expected to show, not hide.
   ========================================================================== */

const ERP_AP_AGING_BUCKETS = ["Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "No Due Date"];

const ERP_APAgingRepository = {
  bucketLabels: ERP_AP_AGING_BUCKETS,

  /** Payment Request -> Three-Way Matching -> Invoice Verification ->
      Purchase Order -> Vendor. Returns null the moment any hop is
      missing — never throws. */
  resolveVendor(request) {
    if (typeof ERP_ThreeWayMatchingRepository === "undefined" || typeof ERP_InvoiceVerificationRepository === "undefined" ||
        typeof ERP_PurchaseOrderRepository === "undefined" || typeof ERP_VendorRepository === "undefined") return null;

    const match = request.linkedMatchId ? ERP_ThreeWayMatchingRepository.findById(request.linkedMatchId) : null;
    if (!match) return null;
    const verification = match.linkedInvoiceVerificationId ? ERP_InvoiceVerificationRepository.findById(match.linkedInvoiceVerificationId) : null;
    if (!verification) return null;
    const po = verification.linkedPoId ? ERP_PurchaseOrderRepository.findById(verification.linkedPoId) : null;
    if (!po) return null;
    return po.vendorId ? ERP_VendorRepository.findById(po.vendorId) : null;
  },

  /** Full requestedAmount if nothing's been paid yet (or only a
      not-yet-Paid Draft payment exists); requestedAmount minus
      amountPaid, floored at 0, once a Paid payment exists. */
  getOutstandingAmount(request) {
    if (typeof ERP_VendorPaymentRepository === "undefined") return Number(request.requestedAmount) || 0;
    const payment = ERP_VendorPaymentRepository.findPaymentForRequest(request.companyId, request.id);
    const requested = Number(request.requestedAmount) || 0;
    if (!payment || payment.status !== "Paid") return requested;
    const paid = Number(payment.amountPaid) || 0;
    return Math.max(0, requested - paid);
  },

  _bucketFor(dueDate, asOfDate) {
    if (!dueDate) return "No Due Date";
    const daysOverdue = Math.floor((new Date(asOfDate) - new Date(dueDate)) / 86400000);
    if (daysOverdue <= 0) return "Current";
    if (daysOverdue <= 30) return "1-30 Days";
    if (daysOverdue <= 60) return "31-60 Days";
    if (daysOverdue <= 90) return "61-90 Days";
    return "90+ Days";
  },

  /** {asOfDate, vendors:[{vendor, requests:[{request, outstandingAmount,
      bucket, daysOverdue}], bucketTotals:{...}, total}],
      grandBucketTotals:{...}, grandTotal, unresolvedCount}. Vendor with
      `vendor: null` represents the "Vendor Unknown" group — see file
      header. Sorted vendors-by-total descending. */
  getAgingReport(companyId, asOfDate) {
    const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);

    const payables = ERP_PaymentRequestRepository.getAllForCompany(companyId)
      .filter((r) => r.status === "Approved")
      .map((r) => {
        const outstandingAmount = this.getOutstandingAmount(r);
        const dueDate = r.dueDate;
        const daysOverdue = dueDate ? Math.floor((new Date(effectiveDate) - new Date(dueDate)) / 86400000) : null;
        return { request: r, outstandingAmount, vendor: this.resolveVendor(r), bucket: this._bucketFor(dueDate, effectiveDate), daysOverdue };
      })
      .filter((p) => p.outstandingAmount > 0);

    const unresolvedCount = payables.filter((p) => !p.vendor).length;

    const byVendor = new Map();
    payables.forEach((p) => {
      const key = p.vendor ? p.vendor.id : "__unresolved__";
      if (!byVendor.has(key)) byVendor.set(key, { vendor: p.vendor, requests: [] });
      byVendor.get(key).requests.push(p);
    });

    const vendors = [...byVendor.values()].map((v) => {
      const bucketTotals = {};
      ERP_AP_AGING_BUCKETS.forEach((b) => { bucketTotals[b] = 0; });
      v.requests.forEach((p) => { bucketTotals[p.bucket] += p.outstandingAmount; });
      const total = v.requests.reduce((s, p) => s + p.outstandingAmount, 0);
      return { ...v, bucketTotals, total };
    }).sort((a, b) => b.total - a.total);

    const grandBucketTotals = {};
    ERP_AP_AGING_BUCKETS.forEach((b) => { grandBucketTotals[b] = 0; });
    vendors.forEach((v) => ERP_AP_AGING_BUCKETS.forEach((b) => { grandBucketTotals[b] += v.bucketTotals[b]; }));
    const grandTotal = vendors.reduce((s, v) => s + v.total, 0);

    return { asOfDate: effectiveDate, vendors, grandBucketTotals, grandTotal, unresolvedCount };
  }
};
