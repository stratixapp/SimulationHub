/* =============================================================================
   DOT ERP
   FILE:  data/sales-register-data.js
   ROLE:  Data-access layer for Sales Register — Phase 8, Module 01. No
          storage key, same "thin computation over an already-real
          transactional module" shape as Trial Balance / AP Aging / Stock
          Valuation. Nothing created, edited, or deleted here — this file
          only ever reads tax-invoice-data.js (and, through it, Tax
          Master/HSN Master).

   OWN DATA FILE, NOT PAGE-ONLY — DECIDED, NOT DEFAULTED: the roadmap left
   open whether this stays a thin page-only computation the way Low Stock's
   filtering logic almost could have, or earns a real file of its own. It
   earns one, for a reason Low Stock never had to face: GST Summary (later
   in this same phase) needs to read Sales Register's own OUTPUT rows to
   compute output tax, and a page's internal functions aren't callable from
   another page. The moment a second module needs to consume this one's
   rows, "page-only" stops being an option — the same reasoning that put
   Trial Balance's own getAccountSummary() equivalent in General Ledger's
   file rather than trial-balance.js. This is the first time in the project
   a REPORT (not a transactional module) has needed to be reusable this way.

   ROW GRANULARITY — ONE ROW PER INVOICE LINE, NOT PER INVOICE — DECIDED,
   NOT DEFAULTED: a real GST sales register is filed HSN-wise (GSTR-1's own
   B2B/HSN summary tables), which only works if each row carries ONE item's
   own taxable value and tax amount. Collapsing to one row per invoice would
   either lose that granularity entirely or force a second "explode back to
   lines" step inside GST Summary — worse than just starting at line grain.
   `getRows()` below returns one row per invoice line; `getSummary()` also
   returns invoice-level counts (see `invoiceCount` vs `lineCount`) for
   callers that want both.

   REUSES TAX INVOICE'S OWN LINE MATH, DOES NOT RE-DERIVE IT: `computeLineTotal()`
   and `computeLineTax()` already exist on ERP_TaxInvoiceRepository and are
   called directly below — the same "genuine reuse forward" restraint AP
   Aging and Trial Balance already showed toward their own upstream ledgers.
   This file's only genuinely NEW computation is the CGST/SGST/IGST split.

   ONLY "RAISED" INVOICES COUNT — the same "only counted once it's real"
   rule Dashboard's own sales figure and AR Aging both already apply to Tax
   Invoice: a Draft invoice isn't a sale yet, and a Cancelled one never was.

   CGST/SGST/IGST — THE FIRST REAL TRANSACTIONAL USE OF TAX MASTER'S
   getIntraStateSplit()/getInterStateSplit(): those two functions have
   existed since Phase 3 but, per a direct check of every file that
   references them, have only ever been called by tax-master.js itself, to
   build the descriptive string on its own list ("9% CGST + 9% SGST /
   18% IGST"). Nothing has ever applied them to an actual transaction. Tax
   Master's own header is explicit that the split is a TRANSACTION-time
   fact (which state the buyer and seller are each in), not master data —
   this file is where that fact finally gets resolved for real, by
   comparing the active company's own `state` (seller) against the
   invoice's customer's own `state` (buyer). A same-state comparison (or a
   blank state on either side, which cannot be classified) is treated as
   intra-state for DISPLAY purposes — CGST+SGST vs IGST changes how a
   line's tax is BUCKETED, never the total tax amount itself (both splits
   sum back to the same `ratePct`), so this fallback never distorts a
   total, only which columns an unclassifiable line's tax appears under.

   UNPRICED LINES ARE SKIPPED, NOT ZEROED — mirrors computeGrandTotal()'s
   own `pricedCount` restraint on the source file: a line with no resolved
   price contributes nothing to any total rather than being counted as a
   real ₹0 sale, and `getSummary()` reports how many lines were skipped so
   a caller can surface that instead of silently under-reporting.
   ========================================================================== */

const ERP_SalesRegisterRepository = {

  /** {rows, invoiceCount, lineCount, skippedLineCount, totalTaxableValue,
      totalTax, totalCgst, totalSgst, totalIgst, totalValue}. `filters` is
      optional: { fromDate, toDate, customerId, itemId } — any/all omitted
      means unrestricted on that dimension. Dates compare against the
      invoice's own `invoiceDate` (inclusive on both ends). */
  getSummary(companyId, filters) {
    const rows = this.getRows(companyId, filters);
    const invoiceIds = new Set(rows.map((r) => r.invoiceId));
    const skippedLineCount = this._countSkippedLines(companyId, filters);

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
      invoiceCount: invoiceIds.size,
      lineCount: rows.length,
      skippedLineCount,
      ...totals
    };
  },

  /** The flat row list itself — see file header for grain and inclusion
      rules. Sorted newest invoice first, matching Tax Invoice's own list
      default. */
  getRows(companyId, filters) {
    const f = filters || {};
    if (typeof ERP_TaxInvoiceRepository === "undefined") return [];

    const company = typeof ERP_CompanyRepository !== "undefined" ? ERP_CompanyRepository.findById(companyId) : null;
    const homeState = (company && company.state ? company.state : "").trim().toLowerCase();

    let invoices = ERP_TaxInvoiceRepository.getAllForCompany(companyId).filter((inv) => inv.status === "Raised");

    if (f.fromDate) invoices = invoices.filter((inv) => inv.invoiceDate && inv.invoiceDate >= f.fromDate);
    if (f.toDate) invoices = invoices.filter((inv) => inv.invoiceDate && inv.invoiceDate <= f.toDate);
    if (f.customerId) invoices = invoices.filter((inv) => inv.customerId === f.customerId);

    invoices.sort((a, b) => new Date(b.invoiceDate || b.raisedAt || 0) - new Date(a.invoiceDate || a.raisedAt || 0));

    const rows = [];
    invoices.forEach((inv) => {
      const customer = inv.customerId && typeof ERP_CustomerRepository !== "undefined" ? ERP_CustomerRepository.findById(inv.customerId) : null;
      (inv.invoiceLines || []).forEach((line) => {
        if (f.itemId && line.itemId !== f.itemId) return;

        const taxableValue = ERP_TaxInvoiceRepository.computeLineTotal(line);
        if (taxableValue == null) return; // unpriced — see file header

        const taxAmount = ERP_TaxInvoiceRepository.computeLineTax(line) || 0;
        const split = this._resolveSplit(homeState, customer, line.taxId, taxableValue);
        const item = line.itemId && typeof ERP_ItemRepository !== "undefined" ? ERP_ItemRepository.findById(line.itemId) : null;
        const hsn = line.hsnCodeId && typeof ERP_HsnRepository !== "undefined" ? ERP_HsnRepository.findById(line.hsnCodeId) : null;
        const tax = line.taxId && typeof ERP_TaxRepository !== "undefined" ? ERP_TaxRepository.findById(line.taxId) : null;

        rows.push({
          id: `${inv.id}:${line.id}`,
          invoiceId: inv.id,
          invoiceCode: inv.invoiceCode,
          invoiceDate: inv.invoiceDate,
          customerId: inv.customerId,
          customerName: customer ? customer.customerName : "Removed customer",
          customerState: customer ? customer.state : "",
          itemId: line.itemId,
          itemName: item ? item.itemName : (line.lineDescription || "—"),
          hsnCodeId: line.hsnCodeId,
          hsnCode: hsn ? hsn.hsnCode : "—",
          quantity: Number(line.quantity) || 0,
          unitPrice: Number(line.unitPrice) || 0,
          taxableValue,
          taxId: line.taxId,
          taxName: tax ? tax.taxName : "—",
          ratePct: tax ? Number(tax.ratePct) || 0 : 0,
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

  /** Count of lines excluded from a filtered view purely because they had
      no resolvable price — kept separate from `getRows()` so a caller can
      say "3 lines omitted, unpriced" instead of pretending the report is
      exhaustive. Re-walks with the same filters minus itemId (a skipped
      line has no reliable itemId-relevant total to filter by, so this is
      reported at invoice/date/customer scope only). */
  _countSkippedLines(companyId, filters) {
    const f = filters || {};
    if (typeof ERP_TaxInvoiceRepository === "undefined") return 0;
    let invoices = ERP_TaxInvoiceRepository.getAllForCompany(companyId).filter((inv) => inv.status === "Raised");
    if (f.fromDate) invoices = invoices.filter((inv) => inv.invoiceDate && inv.invoiceDate >= f.fromDate);
    if (f.toDate) invoices = invoices.filter((inv) => inv.invoiceDate && inv.invoiceDate <= f.toDate);
    if (f.customerId) invoices = invoices.filter((inv) => inv.customerId === f.customerId);
    let skipped = 0;
    invoices.forEach((inv) => {
      (inv.invoiceLines || []).forEach((line) => {
        if (ERP_TaxInvoiceRepository.computeLineTotal(line) == null) skipped++;
      });
    });
    return skipped;
  },

  /** Splits a line's tax into CGST/SGST/IGST based on home state vs. the
      counterparty's own state — see file header. Applies Tax Master's own
      getIntraStateSplit()/getInterStateSplit() percentages directly to
      `taxableValue`, which is algebraically guaranteed to sum back to the
      same figure computeLineTax() already returned (cgstPct+sgstPct ==
      igstPct == the tax code's own ratePct in both branches), so this
      never drifts from the line's own already-computed total. */
  _resolveSplit(homeState, counterparty, taxId, taxableValue) {
    const otherState = (counterparty && counterparty.state ? counterparty.state : "").trim().toLowerCase();
    const isInterState = !!(homeState && otherState && homeState !== otherState);

    if (!taxId || typeof ERP_TaxRepository === "undefined") {
      return { isInterState, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
    }
    const tax = ERP_TaxRepository.findById(taxId);
    if (!tax) return { isInterState, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };

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

  /** Groups an already-fetched row list by tax rate (₹ subtotals per
      slab) — used by the GST Summary page and available to any other
      caller that wants the same breakdown without re-deriving it. */
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

  /** Groups an already-fetched row list by HSN code — the other half of a
      real GSTR-1's own reporting shape (Table 12's HSN summary sits
      alongside, not instead of, the rate-wise view groupByRate() already
      covers). Rows with no resolvable HSN are grouped under "—" rather
      than dropped. */
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
