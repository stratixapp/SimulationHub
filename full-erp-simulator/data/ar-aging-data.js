/* =============================================================================
   DOT ERP
   FILE:  data/ar-aging-data.js
   ROLE:  Computation layer for Accounts Receivable Aging — Phase 6,
          Module 09, the LAST numbered module of this phase before the
          retrofit pass (item 10). No storage key, same as every other
          Phase 6 report — nothing created, edited, or deleted here.

   THE MIRROR OF AP AGING, DELIBERATELY CHECKED RATHER THAN ASSUMED TO BE
   THE SAME SHAPE — AND GENUINELY SIMPLER. AP Aging's own header flagged
   this explicitly: "worth checking rather than assuming" whether Sales'
   own chain to a customer is shorter than Procurement's four hops turned
   out to be. It is, by a wide margin: Tax Invoice already carries
   `customerId` directly (denormalized on the invoice itself, see that
   file's own header) — NO chain walk needed at all, where AP Aging
   needed four hops through Three-Way Matching and Invoice Verification
   to find a vendor. Tax Invoice also already carries its own `dueDate`
   (defaulting from Customer Master's own `creditPeriodDays`, independently
   editable afterward — see tax-invoice-data.js's own header for that
   discovered-hook story). Both facts this report needs were sitting
   right on the source document, so this file is meaningfully shorter
   than ap-aging-data.js, and that asymmetry is the honest result of
   Procurement and Sales having genuinely different document shapes, not
   an inconsistency to smooth over.

   OUTSTANDING AMOUNT: mirrors AP Aging's own reasoning exactly, just
   against Receipt/Tax Invoice instead of Vendor Payment/Payment Request.
   `ERP_TaxInvoiceRepository.computeGrandTotal(invoice).total` is the full
   amount owed; `ERP_ReceiptRepository.findReceiptForInvoice()` — the same
   retrofit hook Tax Invoice's own Detail modal already reads — finds the
   one active Receipt against it (Receipt is exclusive per invoice, same
   as Vendor Payment is exclusive per Payment Request). No Received
   receipt yet (or only a Draft one in progress) means the full total is
   still outstanding; a Received one means `total − amountReceived`,
   floored at zero — the same honoring of partial payments AP Aging's own
   header insists on.

   THE ONE GENUINE ADDITION AP AGING DIDN'T NEED: WRITTEN-OFF RECEIVABLES.
   Accounts Payable has no equivalent concept — a company doesn't get to
   unilaterally decide it no longer owes a vendor money. Accounts
   Receivable does: Payment Collection (Phase 5) already models a formal
   "Written Off" status for an invoice collections effort that's been
   given up on as uncollectible bad debt. `isWrittenOff()` checks
   `ERP_PaymentCollectionRepository.getLatestFollowUpForInvoice()` —
   already-existing, already-established Phase 5 hook — and this report
   excludes a written-off invoice from Total Outstanding entirely, the
   same way real accounting removes a recognized bad debt from the active
   AR list rather than leaving it aging forever. `getLatestFollowUpForInvoice()`
   is ALSO surfaced per-receivable in the page's own drill-down (last
   contact date/method, if any) — genuinely useful AR-specific context
   that has no AP equivalent, since collections follow-up is a real
   receivables-side-only business process this project already modeled.

   BUCKETS, GROUPING, SORT ORDER: identical to AP Aging's own choices —
   Current/1-30/31-60/61-90/90+/No Due Date, grouped by customer instead
   of vendor, sorted largest-owed-first, an explicit "Customer Unknown"
   group (in principle only — `customerId` is denormalized directly here,
   so an unresolved customer would mean the customer record was deleted
   entirely, not a broken multi-hop chain the way AP Aging's could fail)
   rather than silently dropped, `unresolvedCount` surfaced the same way.
   ========================================================================== */

const ERP_AR_AGING_BUCKETS = ["Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "No Due Date"];

const ERP_ARAgingRepository = {
  bucketLabels: ERP_AR_AGING_BUCKETS,

  /** RETROFIT (Phase 15, Module 02): issued credit notes reduce what a
      customer still owes, exactly the way a received payment does — so
      they're subtracted here rather than handled as a special case
      further down. Typeof-guarded, the same way the Receipt lookup
      already is, so this report still works on a page that doesn't load
      the credit note layer. Only `Credited` notes count; a Draft has
      promised the customer nothing yet. */
  getOutstandingAmount(invoice) {
    const total = ERP_TaxInvoiceRepository.computeGrandTotal(invoice).total;
    let remaining = total;

    if (typeof ERP_CreditNoteRepository !== "undefined") {
      remaining -= ERP_CreditNoteRepository.getIssuedCreditForInvoice(invoice.companyId, invoice.id);
    }
    if (typeof ERP_ReceiptRepository !== "undefined") {
      const receipt = ERP_ReceiptRepository.findReceiptForInvoice(invoice.companyId, invoice.id);
      if (receipt && receipt.status === "Received") remaining -= (Number(receipt.amountReceived) || 0);
    }
    // Rounded to paisa before flooring — tax math can leave a remainder
    // of ~1e-12 that would keep a fully-settled invoice aging forever.
    return Math.max(0, Math.round(remaining * 100) / 100);
  },

  /** Total unpaid balance across every one of this customer's own Raised,
      non-written-off invoices — what Customer Master's own Credit Limit
      screen shows as "Current Outstanding" (see customer-data.js
      `getCreditUsage()`), computed live from the same sub-ledger this
      report itself reads rather than a separately typed-in number that
      could drift out of sync with actual unpaid invoices. Typeof-guarded
      callers fall back to whatever was last stored if this file isn't
      loaded on their page (Customer Master's own list view, for one). */
  getCustomerOutstanding(companyId, customerId, asOfDate) {
    if (!customerId) return 0;
    const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);
    return ERP_TaxInvoiceRepository.getAllForCompany(companyId)
      .filter((inv) => inv.customerId === customerId && inv.status === "Raised" && inv.invoiceDate <= effectiveDate)
      .filter((inv) => !this.isWrittenOff(inv))
      .reduce((sum, inv) => sum + this.getOutstandingAmount(inv), 0);
  },

  /** True only if the MOST RECENT Payment Collection follow-up for this
      invoice reached "Written Off" — see file header for why AP Aging
      has no equivalent concept. */
  isWrittenOff(invoice) {
    if (typeof ERP_PaymentCollectionRepository === "undefined") return false;
    const latest = ERP_PaymentCollectionRepository.getLatestFollowUpForInvoice(invoice.companyId, invoice.id);
    return !!latest && latest.status === "Written Off";
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

  /** {asOfDate, customers:[{customer, invoices:[{invoice,
      outstandingAmount, bucket, daysOverdue, latestFollowUp}],
      bucketTotals:{...}, total}], grandBucketTotals:{...}, grandTotal,
      unresolvedCount}. Only Raised, non-written-off invoices with a
      genuinely nonzero outstanding balance are included. */
  getAgingReport(companyId, asOfDate) {
    const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);

    const receivables = ERP_TaxInvoiceRepository.getAllForCompany(companyId)
      .filter((inv) => inv.status === "Raised")
      .filter((inv) => !this.isWrittenOff(inv))
      .map((inv) => {
        const outstandingAmount = this.getOutstandingAmount(inv);
        const dueDate = inv.dueDate;
        const daysOverdue = dueDate ? Math.floor((new Date(effectiveDate) - new Date(dueDate)) / 86400000) : null;
        const customer = typeof ERP_CustomerRepository !== "undefined" ? ERP_CustomerRepository.findById(inv.customerId) : null;
        const latestFollowUp = typeof ERP_PaymentCollectionRepository !== "undefined" ? ERP_PaymentCollectionRepository.getLatestFollowUpForInvoice(companyId, inv.id) : null;
        return { invoice: inv, outstandingAmount, customer, bucket: this._bucketFor(dueDate, effectiveDate), daysOverdue, latestFollowUp };
      })
      .filter((r) => r.outstandingAmount > 0);

    const unresolvedCount = receivables.filter((r) => !r.customer).length;

    const byCustomer = new Map();
    receivables.forEach((r) => {
      const key = r.customer ? r.customer.id : "__unresolved__";
      if (!byCustomer.has(key)) byCustomer.set(key, { customer: r.customer, invoices: [] });
      byCustomer.get(key).invoices.push(r);
    });

    const customers = [...byCustomer.values()].map((c) => {
      const bucketTotals = {};
      ERP_AR_AGING_BUCKETS.forEach((b) => { bucketTotals[b] = 0; });
      c.invoices.forEach((r) => { bucketTotals[r.bucket] += r.outstandingAmount; });
      const total = c.invoices.reduce((s, r) => s + r.outstandingAmount, 0);
      return { ...c, bucketTotals, total };
    }).sort((a, b) => b.total - a.total);

    const grandBucketTotals = {};
    ERP_AR_AGING_BUCKETS.forEach((b) => { grandBucketTotals[b] = 0; });
    customers.forEach((c) => ERP_AR_AGING_BUCKETS.forEach((b) => { grandBucketTotals[b] += c.bucketTotals[b]; }));
    const grandTotal = customers.reduce((s, c) => s + c.total, 0);

    return { asOfDate: effectiveDate, customers, grandBucketTotals, grandTotal, unresolvedCount };
  }
};
