/* =============================================================================
   DOT ERP
   FILE:  data/purchase-register-data.js
   ROLE:  Data-access layer for Purchase Register — Phase 8, Module 02. No
          storage key, same thin-computation shape as sales-register-data.js.
          Nothing created, edited, or deleted here.

   PRIMARY SOURCE IS INVOICE VERIFICATION, NOT GRN — DECIDED, NOT ASSUMED:
   the brief names both, and the two don't play symmetric roles. GRN is
   Procurement's own mirror of Delivery Challan — a goods-MOVEMENT document,
   no tax on it anywhere. Invoice Verification is Procurement's mirror of
   Tax Invoice — the document that actually represents what was BILLED,
   which is what a real Purchase Register reports (GST is owed on the bill,
   not on the goods physically arriving). So this file reads "Verified"
   Invoice Verification records as its own rows, the same way Sales
   Register reads "Raised" Tax Invoices — genuinely the same mirror the
   brief predicted, just resolved by checking which side actually carries
   billing information rather than assumed from the module names alone.
   GRN itself is never read here.

   ROW GRANULARITY — ONE ROW PER INVOICE LINE — same reasoning as Sales
   Register: GST Summary needs HSN/rate-level granularity to reconcile
   against output tax, and per-invoice rows would only have to be
   re-exploded a step later.

   THE CHAIN-WALK IS ONE HOP SHORTER THAN GRN's OWN resolveChain() — Invoice
   Verification's own `linkedPoId` points straight at the PO, skipping
   Schedule/Receipt/GRN entirely (those only exist on the goods-receiving
   side). From a verification record: `linkedPoId` → PO → PO's own
   `linkedQuotationId` → Quotation Receipt → its own `rfqId` → RFQ → its
   own `linkedPrId` → PR, then PR's `lineItems` resolves the original
   `prLineItemId` to a real catalog `itemId`. Four hops, not GRN's six —
   grn.js's own resolveChain() was read directly before writing this, not
   assumed to be reusable as-is (it takes a Receipt, this file starts one
   level up), so the walk below is a genuine one-hop-shorter sibling of it,
   the same restraint AP Aging showed toward AR Aging's own age-bucket
   logic rather than blindly copying a shape that didn't quite fit.

   INPUT TAX WAS PURELY AN ESTIMATE — NOW PARTIALLY A CAPTURED FACT
   (Phase 15 retrofit). Invoice Verification's own lines can now
   optionally carry a real `invoicedTaxId` — see that file's own header.
   This file checks for one FIRST, on every line, before falling back to
   the original estimate: `getEffectiveTaxCode()` on the chain-walked
   item's CURRENT tax configuration. `taxIsEstimated` is now an honest
   PER-ROW flag rather than a blanket `true` — false wherever a real
   captured tax exists, true only where a verification's own line left
   tax blank. The estimate path itself is UNCHANGED and still real: not
   every trainee will capture tax on every bill, so this fallback stays
   exactly as it was.

   UNPRICED LINES ARE SKIPPED, NOT ZEROED — mirrors computeGrandTotal()'s
   own `pricedCount` restraint, same as Sales Register.
   ========================================================================== */

const ERP_PurchaseRegisterRepository = {

  /** {rows, verificationCount, lineCount, skippedLineCount, unresolvedLineCount,
      totalTaxableValue, totalTax, totalCgst, totalSgst, totalIgst, totalValue}.
      `filters`: { fromDate, toDate, vendorId, itemId } — any/all omitted
      means unrestricted. Dates compare against the verification's own
      `invoiceDate` (inclusive both ends). */
  getSummary(companyId, filters) {
    const rows = this.getRows(companyId, filters);
    const verificationIds = new Set(rows.map((r) => r.verificationId));

    const totals = rows.reduce((acc, r) => {
      acc.totalTaxableValue += r.taxableValue;
      acc.totalTax += r.taxAmount;
      acc.totalCgst += r.cgstAmount;
      acc.totalSgst += r.sgstAmount;
      acc.totalIgst += r.igstAmount;
      acc.totalValue += r.lineTotal;
      return acc;
    }, { totalTaxableValue: 0, totalTax: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalValue: 0 });

    return {
      rows,
      verificationCount: verificationIds.size,
      lineCount: rows.length,
      skippedLineCount: this._countSkippedLines(companyId, filters),
      unresolvedLineCount: rows.filter((r) => !r.itemId).length,
      ...totals
    };
  },

  /** The flat row list — see file header for grain, source, and the
      estimated-tax caveat. Sorted newest verification first. */
  getRows(companyId, filters) {
    const f = filters || {};
    if (typeof ERP_InvoiceVerificationRepository === "undefined") return [];

    const company = typeof ERP_CompanyRepository !== "undefined" ? ERP_CompanyRepository.findById(companyId) : null;
    const homeState = (company && company.state ? company.state : "").trim().toLowerCase();

    let verifications = ERP_InvoiceVerificationRepository.getAllForCompany(companyId).filter((v) => v.status === "Verified");

    if (f.fromDate) verifications = verifications.filter((v) => v.invoiceDate && v.invoiceDate >= f.fromDate);
    if (f.toDate) verifications = verifications.filter((v) => v.invoiceDate && v.invoiceDate <= f.toDate);

    verifications.sort((a, b) => new Date(b.invoiceDate || b.verifiedAt || 0) - new Date(a.invoiceDate || a.verifiedAt || 0));

    const rows = [];
    verifications.forEach((v) => {
      const { po, pr } = this._resolveChain(v);
      const vendor = po && po.vendorId && typeof ERP_VendorRepository !== "undefined" ? ERP_VendorRepository.findById(po.vendorId) : null;

      if (f.vendorId && (!po || po.vendorId !== f.vendorId)) return;

      const prLineById = {};
      (pr ? pr.lineItems || [] : []).forEach((l) => { prLineById[l.id] = l; });

      (v.invoiceLines || []).forEach((line) => {
        const taxableValue = ERP_InvoiceVerificationRepository.computeLineValue(line);
        if (taxableValue == null) return; // unpriced — see file header

        const prLine = prLineById[line.prLineItemId];
        const itemId = prLine ? prLine.itemId : null;
        if (f.itemId && itemId !== f.itemId) return;

        const item = itemId && typeof ERP_ItemRepository !== "undefined" ? ERP_ItemRepository.findById(itemId) : null;
        const hsn = item && item.hsnCodeId && typeof ERP_HsnRepository !== "undefined" ? ERP_HsnRepository.findById(item.hsnCodeId) : null;

        // RETROFIT (Phase 15): a REAL captured tax now beats the estimate
        // whenever a line actually has one — checked first, not assumed
        // absent. Invoice Verification's own `invoicedTaxId` is a fact
        // the vendor's bill stated, not a guess from today's item
        // configuration, so `taxIsEstimated` is honestly false for these
        // rows. Everything else about the row shape is unchanged.
        const capturedTax = line.invoicedTaxId && typeof ERP_TaxRepository !== "undefined"
          ? ERP_TaxRepository.findById(line.invoicedTaxId) : null;
        const tax = capturedTax || (item && typeof ERP_ItemRepository !== "undefined" ? ERP_ItemRepository.getEffectiveTaxCode(item) : null);
        const taxIsEstimated = !capturedTax;

        const ratePct = tax ? Number(tax.ratePct) || 0 : 0;
        const taxAmount = taxableValue * ratePct / 100;
        const split = this._resolveSplit(homeState, vendor, tax, taxableValue);

        rows.push({
          id: `${v.id}:${line.id}`,
          verificationId: v.id,
          verificationCode: v.verificationCode,
          vendorInvoiceNumber: v.vendorInvoiceNumber,
          invoiceDate: v.invoiceDate,
          vendorId: po ? po.vendorId : null,
          vendorName: vendor ? vendor.vendorName : (po ? "Removed vendor" : "—"),
          vendorState: vendor ? vendor.state : "",
          itemId,
          itemName: item ? item.itemName : (prLine ? prLine.lineDescription : "Unresolved line"),
          hsnCodeId: item ? item.hsnCodeId : null,
          hsnCode: hsn ? hsn.hsnCode : "—",
          quantity: Number(line.invoicedQuantity) || 0,
          unitPrice: Number(line.invoicedUnitPrice) || 0,
          taxableValue,
          taxId: tax ? tax.id : null,
          taxName: tax ? tax.taxName : "—",
          ratePct,
          taxIsEstimated,
          isInterState: split.isInterState,
          cgstAmount: split.cgstAmount,
          sgstAmount: split.sgstAmount,
          igstAmount: split.igstAmount,
          taxAmount,
          lineTotal: taxableValue + taxAmount
        });
      });
    });

    return rows;
  },

  /** verification → PO → Quotation Receipt → RFQ → PR. One hop shorter
      than GRN's own resolveChain() — see file header. */
  _resolveChain(verification) {
    const po = verification ? ERP_PurchaseOrderRepository.findById(verification.linkedPoId) : null;
    const quotation = po ? ERP_QuotationRepository.findById(po.linkedQuotationId) : null;
    const rfq = quotation ? ERP_RfqRepository.findById(quotation.rfqId) : null;
    const pr = rfq ? ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId) : null;
    return { po, quotation, rfq, pr };
  },

  _countSkippedLines(companyId, filters) {
    const f = filters || {};
    if (typeof ERP_InvoiceVerificationRepository === "undefined") return 0;
    let verifications = ERP_InvoiceVerificationRepository.getAllForCompany(companyId).filter((v) => v.status === "Verified");
    if (f.fromDate) verifications = verifications.filter((v) => v.invoiceDate && v.invoiceDate >= f.fromDate);
    if (f.toDate) verifications = verifications.filter((v) => v.invoiceDate && v.invoiceDate <= f.toDate);
    let skipped = 0;
    verifications.forEach((v) => {
      (v.invoiceLines || []).forEach((line) => {
        if (ERP_InvoiceVerificationRepository.computeLineValue(line) == null) skipped++;
      });
    });
    return skipped;
  },

  /** Same mechanism as sales-register-data.js's own _resolveSplit, applied
      to the vendor's state instead of the customer's. See that file's
      header for why an unclassifiable state never distorts a total. */
  _resolveSplit(homeState, vendor, tax, taxableValue) {
    const otherState = (vendor && vendor.state ? vendor.state : "").trim().toLowerCase();
    const isInterState = !!(homeState && otherState && homeState !== otherState);

    if (!tax || typeof ERP_TaxRepository === "undefined") {
      return { isInterState, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
    }
    if (isInterState) {
      const inter = ERP_TaxRepository.getInterStateSplit(tax);
      return { isInterState, cgstAmount: 0, sgstAmount: 0, igstAmount: taxableValue * inter.igstPct / 100 };
    }
    const intra = ERP_TaxRepository.getIntraStateSplit(tax);
    return {
      isInterState,
      cgstAmount: taxableValue * intra.cgstPct / 100,
      sgstAmount: taxableValue * intra.sgstPct / 100,
      igstAmount: 0
    };
  },

  /** Groups an already-fetched row list by tax rate — mirrors Sales
      Register's own groupByRate() so GST Summary can treat both sides
      identically. */
  groupByRate(rows) {
    const byRate = new Map();
    rows.forEach((r) => {
      const key = r.ratePct;
      if (!byRate.has(key)) byRate.set(key, { ratePct: key, taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, taxAmount: 0, lineCount: 0 });
      const bucket = byRate.get(key);
      bucket.taxableValue += r.taxableValue;
      bucket.cgstAmount += r.cgstAmount;
      bucket.sgstAmount += r.sgstAmount;
      bucket.igstAmount += r.igstAmount;
      bucket.taxAmount += r.taxAmount;
      bucket.lineCount += 1;
    });
    return [...byRate.values()].sort((a, b) => a.ratePct - b.ratePct);
  },

  /** Groups an already-fetched row list by HSN code — mirrors Sales
      Register's own groupByHsn() so GST Summary can merge both sides by
      the same key. */
  groupByHsn(rows) {
    const byHsn = new Map();
    rows.forEach((r) => {
      const key = r.hsnCode || "—";
      if (!byHsn.has(key)) byHsn.set(key, { hsnCode: key, taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, taxAmount: 0, lineCount: 0 });
      const bucket = byHsn.get(key);
      bucket.taxableValue += r.taxableValue;
      bucket.cgstAmount += r.cgstAmount;
      bucket.sgstAmount += r.sgstAmount;
      bucket.igstAmount += r.igstAmount;
      bucket.taxAmount += r.taxAmount;
      bucket.lineCount += 1;
    });
    return [...byHsn.values()].sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));
  }
};
