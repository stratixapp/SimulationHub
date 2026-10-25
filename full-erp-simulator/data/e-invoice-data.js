/* =============================================================================
   DOT ERP
   FILE:  data/e-invoice-data.js
   ROLE:  Data-access layer for E-Invoice / IRN generation — Phase 16,
          Module 03. Per-invoice, not a return: this module takes ONE
          Raised, B2B Tax Invoice and produces an Invoice Reference
          Number (IRN) and a QR payload — the two artifacts that make
          an invoice legally valid under the real e-invoicing mandate.

   APPLICABILITY IS COMPUTED FROM THIS COMPANY'S OWN DATA, NOT A MANUAL
   TOGGLE — because the real rule is worth teaching, not hiding behind
   a switch. As of the current GST regime (CBIC Notification 10/2023,
   ₹5 crore, unchanged as of mid-2026 — checked directly rather than
   assumed, since a threshold this specific is exactly the kind of fact
   that can move between this file's own writing and a trainee reading
   it), e-invoicing becomes mandatory once a business's own aggregate
   turnover crosses ₹5 crore in ANY financial year on record — and the
   obligation is PERMANENT from that point on, even if a later year's
   turnover falls back below the line. `isApplicable()` checks every
   Financial Year this company has on record, sums Raised Tax Invoice
   totals falling inside each one, and reports back not just a boolean
   but WHICH year triggered it and what that year's own turnover was —
   the same "show the reasoning, not just the verdict" instinct GST
   Summary's own header already insists on for a much simpler check.

   B2B ONLY — THE SAME GSTIN-PRESENCE TEST GSTR-1 ALREADY ESTABLISHED.
   E-invoicing covers B2B, export and SEZ supplies, never plain B2C
   retail. This project has no export/SEZ concept built anywhere yet,
   so this module's own eligibility check is, honestly, narrower than
   the full real rule: B2B (customer has a GSTIN) and nothing else —
   named here rather than silently presented as complete.

   THE IRN ITSELF IS A STRUCTURAL SIMULATION, NOT A REAL SHA-256 HASH —
   the identical honesty `gst-data.js`'s own header already applies to
   GSTIN validation ("structure-only, not real government validation").
   The real algorithm hashes a canonical string built from the
   supplier's GSTIN, document type, document number and financial year
   into a 64-character hex digest. This file reproduces that STRUCTURE
   — same canonical-string inputs, same 64-hex-character output shape,
   same determinism (the same invoice always yields the same IRN,
   exactly like the real one) — via a simple, synchronous, well-mixed
   hash rather than the Web Crypto API's real (asynchronous) SHA-256.
   That choice is deliberate, not a shortcut: introducing the first
   `async`/Promise-based code path anywhere in this 100+ page, entirely
   synchronous codebase for one module would be a genuinely bigger,
   riskier change than the realism it would buy, and this project has
   never reached for that trade-off anywhere else either.

   THE QR PAYLOAD IS SHOWN AS TEXT, NOT RENDERED AS A SCANNABLE IMAGE —
   named, not silently simplified. This entire project loads zero
   external libraries anywhere (every `<script src>` in every one of
   its 100+ pages points at a local file); hand-rolling a real QR
   bitmap generator is a nontrivial algorithm this project has never
   needed before, and faking one would be LESS honest than showing the
   real payload string plainly, which is what a trainee actually needs
   to understand the mechanism.

   THE 24-HOUR CANCELLATION WINDOW IS REAL, ENFORCED, AND CHECKED
   AGAINST ACTUAL CLOCK TIME, NOT A FIXED "TODAY" DATE — matching the
   real rule that an IRN can only be cancelled within 24 hours of its
   own generation; after that, a credit note is the correct instrument,
   which this project has already built (Phase 15). `canCancel()` is
   the single source of truth the page's own button disables against.

   THE 30-DAY REPORTING RULE IS MODELED AS A FLAG, NOT A BLOCK — real
   law (effective 1 April 2025) restricts e-invoice generation to
   within 30 days of the invoice's own date, but ONLY for businesses
   whose turnover has crossed ₹10 crore. Rather than silently refusing
   generation past 30 days for every company alike, `generate()` checks
   this company's OWN ₹10-crore status the same way `isApplicable()`
   checks ₹5 crore, and marks a late invoice `isLate: true` with the
   real day count — visible, not blocking, because a training simulator
   that hard-refuses a late demo invoice teaches less than one that
   shows the trainee exactly what a real business would now be exposed
   to.

   GENERATING OR CANCELLING AN E-INVOICE NEVER TOUCHES TAX INVOICE'S
   OWN STATUS — a named, deliberate boundary. In real law, an invoice
   without a valid IRN is not legally valid, and cancelling an IRN
   effectively voids the invoice. This project keeps the two lifecycles
   related but independent, the same restraint it has shown everywhere
   else rather than building a new cross-module cancellation cascade
   this codebase has never needed before.
   ========================================================================== */

const ERP_EINVOICE_KEY = "erp_e_invoices";
const ERP_EINVOICE_THRESHOLD = 50000000;      // ₹5 crore — mandatory e-invoicing
const ERP_EINVOICE_REPORTING_THRESHOLD = 100000000; // ₹10 crore — 30-day reporting window applies

const ERP_EInvoiceRepository = {

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_EINVOICE_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_EINVOICE_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((e) => e.companyId === companyId)
      .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
  },

  findById(id) {
    return this.getAll().find((e) => e.id === id) || null;
  },

  /** Exclusive over an invoice — the same live-scan shape used
      everywhere since Delivery Schedule. Real IRN generation IS
      idempotent (the same invoice always produces the same IRN), but
      this project still tracks "has this been generated" as a distinct
      workflow fact, the same way Dispatch tracks a single link rather
      than silently allowing repeat action. */
  findForInvoice(companyId, invoiceId) {
    return this.getAllForCompany(companyId).find((e) => e.invoiceId === invoiceId && e.status !== "Cancelled") || null;
  },

  actorLabel(username) {
    return typeof window !== "undefined" && window.ERP && window.ERP.actorLabel
      ? window.ERP.actorLabel(username)
      : (username || "system");
  },


  /** Every Raised, B2B invoice for this company, each annotated with its
      own e-invoice status — the page's own list is built from this
      directly rather than re-deriving B2B/status logic itself, the
      same "real logic lives in the data layer" discipline every other
      module in this project already follows. */
  getEligibleInvoicesForCompany(companyId) {
    if (typeof ERP_TaxInvoiceRepository === "undefined" || typeof ERP_CustomerRepository === "undefined") return [];
    return ERP_TaxInvoiceRepository.getRaisedForCompany(companyId)
      .filter((inv) => {
        const customer = inv.customerId ? ERP_CustomerRepository.findById(inv.customerId) : null;
        return !!(customer && customer.gstin && customer.gstin.trim());
      })
      .map((inv) => ({
        invoice: inv,
        eInvoice: this.findForInvoice(companyId, inv.id)
      }))
      .sort((a, b) => new Date(b.invoice.invoiceDate) - new Date(a.invoice.invoiceDate));
  },


  /* -----------------------------------------------------------------------
     APPLICABILITY — see file header
     --------------------------------------------------------------------- */

  /** Sums Raised Tax Invoice totals within each Financial Year this
      company has on record, looking for the FIRST year (chronologically)
      that crossed a given threshold. Shared by the ₹5cr and ₹10cr checks
      below rather than duplicated. */
  _firstYearCrossing(companyId, threshold) {
    if (typeof ERP_FinancialYearRepository === "undefined" || typeof ERP_TaxInvoiceRepository === "undefined") return null;
    const years = ERP_FinancialYearRepository.getAllForCompany(companyId)
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const invoices = ERP_TaxInvoiceRepository.getRaisedForCompany(companyId);

    for (const fy of years) {
      const turnover = invoices
        .filter((inv) => inv.invoiceDate && inv.invoiceDate >= fy.startDate && inv.invoiceDate <= fy.endDate)
        .reduce((sum, inv) => sum + ERP_TaxInvoiceRepository.computeGrandTotal(inv).total, 0);
      if (turnover >= threshold) {
        return { fyCode: fy.fyCode, fyLabel: this._fyLabel(fy), turnover };
      }
    }
    return null;
  },

  _fyLabel(fy) {
    const startYear = new Date(fy.startDate).getFullYear();
    const endYear = new Date(fy.endDate).getFullYear();
    return `FY ${startYear}-${String(endYear).slice(-2)}`;
  },

  /** {applicable, fyCode, fyLabel, turnover} — permanent once true,
      matching the real "crossed once, applies forever" rule. */
  isApplicable(companyId) {
    const crossing = this._firstYearCrossing(companyId, ERP_EINVOICE_THRESHOLD);
    return crossing ? { applicable: true, ...crossing } : { applicable: false, fyCode: null, fyLabel: null, turnover: 0 };
  },

  /** Same shape, for the ₹10 crore 30-day-reporting threshold. */
  requiresFastReporting(companyId) {
    const crossing = this._firstYearCrossing(companyId, ERP_EINVOICE_REPORTING_THRESHOLD);
    return crossing ? { applicable: true, ...crossing } : { applicable: false, fyCode: null, fyLabel: null, turnover: 0 };
  },


  /* -----------------------------------------------------------------------
     ELIGIBILITY — per invoice
     --------------------------------------------------------------------- */

  isEligibleInvoice(companyId, invoice) {
    if (!invoice) return { eligible: false, reason: "This invoice no longer exists." };
    if (invoice.status !== "Raised") return { eligible: false, reason: "Only a Raised invoice can have an e-invoice generated." };
    const customer = invoice.customerId && typeof ERP_CustomerRepository !== "undefined" ? ERP_CustomerRepository.findById(invoice.customerId) : null;
    if (!customer || !customer.gstin || !customer.gstin.trim()) {
      return { eligible: false, reason: "E-invoicing applies to B2B supplies only — this customer has no GSTIN on file." };
    }
    const applicability = this.isApplicable(companyId);
    if (!applicability.applicable) {
      return { eligible: false, reason: "E-invoicing isn't mandatory yet — this company's own turnover hasn't crossed ₹5 crore in any financial year on record." };
    }
    if (this.findForInvoice(companyId, invoice.id)) {
      return { eligible: false, reason: "An e-invoice already exists for this invoice." };
    }
    return { eligible: true, reason: null };
  },


  /* -----------------------------------------------------------------------
     THE IRN — structural simulation, see file header
     --------------------------------------------------------------------- */

  /** A simple, well-mixed, deterministic hash — NOT cryptographic, and
      not claimed to be. Same input always produces the same 64-hex-
      character output, matching the real algorithm's own determinism
      without pulling in the Web Crypto API's async signature. */
  _computeIrn(canonicalString) {
    let h1 = 0x811c9dc5, h2 = 0x1000193, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
    for (let i = 0; i < canonicalString.length; i++) {
      const c = canonicalString.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ c, 0x85ebca6b);
      h3 = Math.imul(h3 ^ c, 0xc2b2ae35);
      h4 = Math.imul(h4 ^ c, 0x27d4eb2f);
    }
    const toHex16 = (n) => (n >>> 0).toString(16).padStart(8, "0");
    return (toHex16(h1) + toHex16(h2) + toHex16(h3) + toHex16(h4)).repeat(2).slice(0, 64);
  },

  /** Supplier GSTIN + document type + document number + financial year
      — the real algorithm's own canonical input, reproduced structurally.
      Reads `company.gstin` directly — `gst-data.js`'s own header
      already documents Company Profile as the single canonical source
      of a company's GSTIN, so no separate lookup is needed here. */
  _canonicalString(company, invoice, fyLabel) {
    const supplierGstin = (company.gstin || "").trim().toUpperCase() || "UNREGISTERED";
    return `${supplierGstin}|INV|${invoice.invoiceCode}|${fyLabel}`;
  },

  /** The QR payload — a pipe-delimited structure carrying the fields a
      real e-invoice QR actually encodes, shown as text (see file header). */
  _buildQrPayload(company, invoice, customer, totals, irn) {
    const supplierGstin = (company.gstin || "").trim().toUpperCase() || "UNREGISTERED";
    return [
      `SellerGSTIN:${supplierGstin}`,
      `BuyerGSTIN:${customer.gstin}`,
      `DocNo:${invoice.invoiceCode}`,
      `DocDate:${invoice.invoiceDate}`,
      `TotalValue:${totals.total.toFixed(2)}`,
      `IRN:${irn}`
    ].join("|");
  },


  /* -----------------------------------------------------------------------
     GENERATE / CANCEL
     --------------------------------------------------------------------- */

  generate(company, invoice, actorUsername) {
    const check = this.isEligibleInvoice(company.id, invoice);
    if (!check.eligible) return { success: false, reason: check.reason };

    const customer = ERP_CustomerRepository.findById(invoice.customerId);
    const totals = ERP_TaxInvoiceRepository.computeGrandTotal(invoice);
    const applicability = this.isApplicable(company.id);
    const canonical = this._canonicalString(company, invoice, applicability.fyLabel);
    const irn = this._computeIrn(canonical);
    const qrPayload = this._buildQrPayload(company, invoice, customer, totals, irn);

    const fastReporting = this.requiresFastReporting(company.id);
    let isLate = false, daysSinceInvoice = 0;
    if (fastReporting.applicable && invoice.invoiceDate) {
      daysSinceInvoice = Math.floor((new Date() - new Date(invoice.invoiceDate)) / (1000 * 60 * 60 * 24));
      isLate = daysSinceInvoice > 30;
    }

    const record = {
      id: "EINV-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      invoiceId: invoice.id,
      invoiceCode: invoice.invoiceCode,
      customerId: invoice.customerId,
      customerGstin: customer.gstin,
      irn,
      qrPayload,
      invoiceValue: totals.total,
      status: "Generated",
      isLate,
      daysSinceInvoice,
      generatedAt: new Date().toISOString(),
      generatedByUsername: actorUsername || "system",
      cancelledAt: null,
      cancelledByUsername: null
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return { success: true, record };
  },

  /** Real rule: 24 hours from the IRN's own generation, checked against
      actual elapsed clock time. */
  canCancel(record) {
    if (!record || record.status !== "Generated") return false;
    const elapsedHours = (new Date() - new Date(record.generatedAt)) / (1000 * 60 * 60);
    return elapsedHours <= 24;
  },

  cancel(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return { success: false, reason: "This e-invoice no longer exists." };
    if (!this.canCancel(all[idx])) {
      return { success: false, reason: "This IRN was generated more than 24 hours ago and can no longer be cancelled — raise a Credit Note instead, the way real GST law requires past this window." };
    }
    all[idx] = {
      ...all[idx],
      status: "Cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledByUsername: actorUsername || "system"
    };
    this._saveAll(all);
    return { success: true, record: all[idx] };
  }
};
