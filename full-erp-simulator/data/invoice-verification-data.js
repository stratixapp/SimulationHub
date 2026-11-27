/* =============================================================================
   DOT ERP
   FILE:  data/invoice-verification-data.js
   ROLE:  Data-access layer for Invoice Verification — Phase 4, Module 16.
          The vendor's bill has arrived. This module is where it gets
          logged into the system and given a first, lightweight sanity
          check against the PO — the FULL three-way check against GRN
          quantities too is deliberately Module 17's job, not this one.

   BUILT FROM ONE PURCHASE ORDER, NOT FROM GRN. Every prior receiving-side
   module this session built from the thing immediately upstream of it
   (schedule from PO, receipt from schedule, GRN from receipt, inspection
   from GRN). This module breaks that chain on purpose: an invoice is a
   document between the buyer and the VENDOR, referencing the PO
   directly — a vendor's invoice doesn't know or care about your internal
   GRN numbering. `linkedPoId` required, exclusive
   (`getLinkedPoIds`/`getAvailablePosForCompany`, the eighth instance of
   the exclusivity pattern this session). SCOPING CHOICE, DOCUMENTED
   HONESTLY: this enforces at most ONE invoice per PO, which is a
   simplification — a real PO can receive multiple invoices for partial
   shipments. Extending to many-invoices-per-PO is the natural next step
   if a future session needs it; for now, one PO, one invoice, keeps the
   whole chain's shape consistent with everything else this session built.

   `invoiceLines[]` IS MANUALLY ENTERED, NOT COPIED — THE FIRST TIME THIS
   SESSION A "STARTING POINT" ISN'T EVEN A STARTING POINT. Every other
   line-items array this session pre-filled from an upstream record. This
   one deliberately starts BLANK (well — pre-filled with the PO's own
   description/expected qty/price for convenience, but the actual
   `invoicedQuantity`/`invoicedUnitPrice` fields start empty) because the
   entire point of an invoice verification is recording what the VENDOR
   claims, which may or may not match what was ordered. Auto-filling
   those two fields from the PO would silently manufacture a "perfect
   match" that was never actually checked.

   `computeMatchSummary()` IS THIS MODULE'S OWN LIGHTWEIGHT TWO-WAY
   CHECK — invoice vs PO, quantity and price, per line, with a small
   tolerance-free equality check (exact match or flagged). This is
   informational only, shown in the table and detail view, and is NOT
   the same thing as Three-Way Matching (Module 17): that module also
   pulls in GRN quantities and produces a real Approve/Hold decision.
   This module's own check exists so a log-only record isn't a black
   box — you can see at a glance whether what the vendor billed lines up
   with what was ordered, without waiting for the formal downstream gate.

   STATUS LIFECYCLE: SAME SIMPLE 3-STATE SHAPE, NO APPROVAL GATE.
   `Draft -> Verified -> Cancelled` — logging and lightly checking an
   invoice is an operational record, not a spend decision; the actual
   financial gate is Three-Way Matching, one module further down.

   TAX RETROFIT (Phase 15, alongside Sales Return/Credit Note): EVERY
   line item anywhere upstream in Procurement (PR -> RFQ -> Quotation
   Receipt -> PO) was checked directly, and none of them carry a tax
   rate — the same absence `purchase-register-data.js`'s own header
   and `gl-mapping-data.js`'s own original header both already named.
   This module is the one honest place to close that gap, because its
   own lines are already the one place in this chain that is MANUALLY
   ENTERED rather than copied — the whole point of this module is
   recording what the vendor's actual bill says, and a real vendor bill
   always states its own tax. So each line now carries an optional
   `invoicedTaxId`, a REAL CAPTURED FACT, genuinely different in kind
   from Purchase Register's own `taxIsEstimated` figure (which infers a
   rate from an item's CURRENT tax configuration, not what was actually
   billed). Leaving a line's tax blank is a legitimate, if less precise,
   choice — the field is optional, not required, matching this module's
   own existing "manually entered, may not match" philosophy for
   quantity and price.

   `computeGrandTotal()` NOW RETURNS THE RICHER `{subtotal, taxTotal,
   total, pricedCount, totalCount}` SHAPE, matching Tax Invoice's and
   Credit Note's own convention on the Sales side — `subtotal` is the
   exact number this module's own `.total` used to mean (taxable value
   only, matching what GRN posted to GR/IR Clearing), `taxTotal` is the
   sum of genuinely captured tax, and `total = subtotal + taxTotal` is
   the real, tax-inclusive amount actually owed to the vendor. THIS IS
   A DELIBERATE, DOCUMENTED CHANGE TO WHAT `.total` MEANS. Every
   existing caller was checked and updated: `gl-posting-data.js`'s own
   `postInvoiceVerification()` now debits GR/IR Clearing at `subtotal`
   (still matching GRN's own credit exactly) and a NEW Input Tax Credit
   Receivable role at `taxTotal` (only when nonzero), crediting Accounts
   Payable at the full `total` — the genuinely correct real-world entry,
   where the earlier version quietly assumed no tax existed at all.
   `payment-request-data.js`'s own `computeDefaultAmount()` now suggests
   the full tax-inclusive `total` rather than the taxable value alone —
   a real improvement (a vendor payment should cover what was actually
   billed), verified rather than assumed safe.
   ========================================================================== */

const ERP_INVOICE_VERIFICATION_KEY = "erp_invoice_verifications";

const ERP_INVOICE_VERIFICATION_STATUSES = ["Draft", "Verified", "Cancelled"];

const ERP_InvoiceVerificationRepository = {
  statuses: ERP_INVOICE_VERIFICATION_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_INVOICE_VERIFICATION_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_INVOICE_VERIFICATION_KEY, JSON.stringify(list)); return true; }
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

  nextVerificationCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((v) => {
      const match = /-IV-(\d+)$/.exec(v.verificationCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-IV-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(v) {
    return v.status === "Draft";
  },

  canDelete(v) {
    return v.status === "Draft" || v.status === "Cancelled";
  },

  computeLineValue(line) {
    const price = line.invoicedUnitPrice;
    if (price === null || price === undefined || price === "" || isNaN(Number(price))) return null;
    return Number(line.invoicedQuantity || 0) * Number(price);
  },

  /** The genuinely captured figure — see file header. 0 when the line
      has no priced value yet, or when no tax was captured for it
      (blank is a legitimate choice, not a missing value). */
  computeLineTax(line) {
    const lineValue = this.computeLineValue(line);
    if (lineValue == null) return 0;
    if (!line.invoicedTaxId || typeof ERP_TaxRepository === "undefined") return 0;
    const tax = ERP_TaxRepository.findById(line.invoicedTaxId);
    if (!tax) return 0;
    return lineValue * (Number(tax.ratePct) || 0) / 100;
  },

  /** `{subtotal, taxTotal, total, pricedCount, totalCount}` — see file
      header for why `subtotal` is what `.total` used to mean and why
      `.total` itself changed meaning. */
  computeGrandTotal(v) {
    let subtotal = 0, taxTotal = 0, pricedCount = 0;
    (v.invoiceLines || []).forEach((line) => {
      const lineValue = this.computeLineValue(line);
      if (lineValue != null) {
        subtotal += lineValue;
        taxTotal += this.computeLineTax(line);
        pricedCount++;
      }
    });
    return { subtotal, taxTotal, total: subtotal + taxTotal, pricedCount, totalCount: (v.invoiceLines || []).length };
  },

  /** Two-way check against the linked PO's own line quantity/price —
      informational only, see file header for why this isn't the same
      thing as Three-Way Matching. Returns per-line status plus a summary
      count so callers don't need to re-derive it. */
  computeMatchSummary(v) {
    const po = typeof ERP_PurchaseOrderRepository !== "undefined" ? ERP_PurchaseOrderRepository.findById(v.linkedPoId) : null;
    const poLineById = {};
    (po ? po.lineItems || [] : []).forEach((l) => { poLineById[l.prLineItemId] = l; });

    let matched = 0, mismatched = 0;
    const lines = (v.invoiceLines || []).map((line) => {
      const poLine = poLineById[line.prLineItemId];
      const qtyOk = poLine && Number(line.invoicedQuantity) === Number(poLine.quantity);
      const priceOk = poLine && poLine.unitPrice != null && Number(line.invoicedUnitPrice) === Number(poLine.unitPrice);
      const isMatch = !!(poLine && qtyOk && priceOk);
      if (isMatch) matched++; else mismatched++;
      return { prLineItemId: line.prLineItemId, poLine, qtyOk: !!qtyOk, priceOk: !!priceOk, isMatch };
    });
    return { lines, matched, mismatched, totalCount: lines.length };
  },

  getLinkedPoIds(companyId, excludeVerificationId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((v) => {
      if (v.id === excludeVerificationId || v.status === "Cancelled") return;
      if (v.linkedPoId) ids.add(v.linkedPoId);
    });
    return ids;
  },

  /** Every PO not already claimed by another invoice — deliberately NOT
      filtered to a particular PO status (Sent/Confirmed/etc.); a vendor
      invoice can arrive at various points in a real process, and this
      module's own job is just to log and lightly check it, not to gate
      on where the PO happens to be. */
  getAvailablePosForCompany(companyId, excludeVerificationId) {
    if (typeof ERP_PurchaseOrderRepository === "undefined") return [];
    const claimed = this.getLinkedPoIds(companyId, excludeVerificationId);
    return ERP_PurchaseOrderRepository.getAllForCompany(companyId)
      .filter((po) => po.status !== "Draft" && po.status !== "Cancelled" && !claimed.has(po.id));
  },

  /** The retrofit hook for Purchase Order's own Detail modal. */
  findVerificationForPo(companyId, poId) {
    return this.getAllForCompany(companyId).find((v) =>
      v.status !== "Cancelled" && v.linkedPoId === poId
    ) || null;
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "IV-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      verificationCode: this.nextVerificationCode(company),
      linkedPoId: null,
      vendorInvoiceNumber: "",
      invoiceDate: null,
      invoiceLines: [],
      notes: "",
      status: "Draft",
      verifiedAt: null, verifiedByUsername: null,
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

  /** Draft -> Verified. No approval gate — see file header. */
  verify(id, actorUsername) {
    return this.update(id, { status: "Verified", verifiedAt: new Date().toISOString(), verifiedByUsername: actorUsername });
  },

  reopen(id) {
    return this.update(id, { status: "Draft", verifiedAt: null, verifiedByUsername: null });
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
