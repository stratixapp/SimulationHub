/* =============================================================================
   DOT ERP
   FILE:  data/e-way-bill-data.js
   ROLE:  Data-access layer for E-Way Bill — Phase 16, Module 04, the
          last module of this phase. Per-shipment: takes ONE Dispatched
          Dispatch record and produces an E-Way Bill Number (EBN) that
          legally has to accompany the goods while they physically move.

   BUILT FROM DISPATCH, NOT DELIVERY CHALLAN OR TAX INVOICE DIRECTLY —
   checked against `dispatch-data.js`'s own header before assuming
   otherwise, and confirmed by the real rule itself: an e-way bill is
   triggered by the MOVEMENT of goods, not by billing or by picking.
   Dispatch is this project's own "handover to a transporter" event,
   and — genuinely convenient, not engineered around — it ALREADY
   carries every Part-B field a real e-way bill needs (`transporterName`,
   `vehicleNumber`, `modeOfTransport`, `dispatchDate`), because Dispatch
   was built with exactly that logistics-event job one phase before this
   one existed. Nothing new had to be added to Dispatch itself.

   THE THRESHOLD WAS CHECKED LIVE, THE SAME DISCIPLINE E-INVOICE'S OWN
   HEADER ALREADY APPLIED. As of current 2026 sources: ₹50,000
   consignment value, uniform for BOTH inter-state and intra-state
   movement as the national baseline under Rule 138 of the CGST Rules —
   NOT assumed from memory, verified directly rather than risk a stale
   figure in a module whose entire point is teaching the real rule.

   CONSIGNMENT VALUE IS THE LINKED TAX INVOICE'S OWN GRAND TOTAL — the
   real rule counts taxable value plus GST (CGST/SGST/IGST/Cess),
   excluding any exempt-goods portion. This project has no per-line
   exempt-goods concept anywhere, so the invoice's own full
   `computeGrandTotal().total` stands in for that figure — a
   simplification named here rather than pretended precise.

   ONLY THE UNIFORM ₹50,000 NATIONAL BASELINE IS MODELED — A NAMED GAP,
   NOT AN OVERSIGHT. Real intra-state thresholds vary by state (₹50,000
   in Kerala, Karnataka, UP; ₹1,00,000 in Maharashtra, MP, Delhi, Tamil
   Nadu; ₹2,00,000 in some states; Gujarat exempts intra-city movement
   entirely; Jammu & Kashmir exempts intra-state movement altogether).
   Modeling all of that would need a state-by-state threshold table this
   project has no master for and no other module has ever needed either
   — the uniform national baseline is applied to every movement alike,
   named here rather than silently presented as the full picture.

   THE 180-DAY DOCUMENT-AGE RULE IS A HARD BLOCK, UNLIKE E-INVOICE'S OWN
   30-DAY FLAG — A GENUINE, DELIBERATE DIFFERENCE, NOT AN INCONSISTENCY.
   Checked directly: real sources describe the e-way bill portal
   REFUSING generation outright past 180 days from the document's own
   date ("the portal will not allow e-way bill generation"), where
   e-invoicing's own 30-day rule is enforced as a reporting restriction
   that still lets the trainee see what exposure looks like. Two
   different real enforcement postures, modeled as two different UX
   postures — `isEligible()` refuses outright past 180 days rather than
   generating a flagged-but-successful record the way `e-invoice-data.js`
   does for its own late case.

   VALIDITY IS DISTANCE-DRIVEN, WITH THE DISTANCE TYPED BY THE TRAINEE —
   this project has no distance/route data anywhere (no Transporter
   Master, no address-to-address routing), so `generate()` takes a
   `distanceKm` argument directly rather than inventing a fake distance
   source. One day of validity per 200 km for regular cargo (the
   CURRENT rule — checked live rather than assumed, since this figure
   has changed before and an older "100 km per day" figure sometimes
   still circulates), rounded up, with a minimum of one day. Over-
   dimensional cargo's own different rate (1 day per 20 km) is a real,
   named exclusion — this project has no cargo-dimension concept to key
   that off of.

   THE EWB NUMBER ITSELF IS A STRUCTURAL SIMULATION, THE SAME HONESTY
   E-INVOICE'S OWN IRN ALREADY APPLIES. A real EBN is a 12-digit numeric
   code; this file reproduces that shape (12 digits, fully deterministic
   from the dispatch's own facts) via the identical simple, synchronous,
   well-mixed hash `e-invoice-data.js` already uses for its own IRN,
   rather than claiming a real government-issued number.

   THE 24-HOUR CANCELLATION WINDOW MIRRORS E-INVOICE'S OWN — real rule:
   an unused EBN should be cancelled within 24 hours. This file does not
   distinguish "unused" from "goods already moving" (this project tracks
   no live transit status), so cancellation is simply gated on elapsed
   time from generation, the identical shape and reasoning
   `e-invoice-data.js`'s own `canCancel()` already uses.

   NO VALIDITY EXTENSION — A NAMED, DELIBERATE EXCLUSION. Real law lets
   a transporter extend an e-way bill's validity when goods are
   genuinely delayed in transit (up to 360 days from original
   generation). This project has no live transit-tracking concept
   anywhere to hang that workflow off of, so extension isn't modeled;
   `isExpired()` simply reports whether `validUntil` has passed.
   ========================================================================== */

const ERP_EWAYBILL_KEY = "erp_e_way_bills";
const ERP_EWAYBILL_THRESHOLD = 50000;              // ₹50,000 — national baseline, both inter- and intra-state
const ERP_EWAYBILL_MAX_DOCUMENT_AGE_DAYS = 180;    // hard block past this
const ERP_EWAYBILL_KM_PER_VALIDITY_DAY = 200;      // regular cargo; over-dimensional (1 day / 20km) not modeled

const ERP_EWayBillRepository = {

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_EWAYBILL_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_EWAYBILL_KEY, JSON.stringify(list)); return true; }
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

  /** Exclusive over a dispatch — the same live-scan shape used
      everywhere since Delivery Schedule, and the same reasoning
      E-Invoice's own `findForInvoice()` already applies one module
      earlier: excludes Cancelled records, so at most one active e-way
      bill exists per dispatch at a time. */
  findForDispatch(companyId, dispatchId) {
    return this.getAllForCompany(companyId).find((e) => e.dispatchId === dispatchId && e.status !== "Cancelled") || null;
  },

  actorLabel(username) {
    return typeof window !== "undefined" && window.ERP && window.ERP.actorLabel
      ? window.ERP.actorLabel(username)
      : (username || "system");
  },


  /* -----------------------------------------------------------------------
     HELPERS
     --------------------------------------------------------------------- */

  _homeState(companyId) {
    const company = typeof ERP_CompanyRepository !== "undefined" ? ERP_CompanyRepository.findById(companyId) : null;
    return (company && company.state ? company.state : "").trim().toLowerCase();
  },

  /** Every eligible dispatch for this company's own list page — Dispatched
      status, with its linked invoice still resolvable, each annotated
      with its own e-way bill (if any). The page's own list is built
      from this directly, the same "real logic lives in the data layer"
      discipline `e-invoice-data.js`'s own `getEligibleInvoicesForCompany()`
      already established. */
  getDispatchesForCompany(companyId) {
    if (typeof ERP_DispatchRepository === "undefined" || typeof ERP_TaxInvoiceRepository === "undefined") return [];
    return ERP_DispatchRepository.getDispatchedForCompany(companyId)
      .filter((d) => d.linkedInvoiceId && ERP_TaxInvoiceRepository.findById(d.linkedInvoiceId))
      .map((d) => ({ dispatch: d, ewayBill: this.findForDispatch(companyId, d.id) }))
      .sort((a, b) => new Date(b.dispatch.dispatchDate || 0) - new Date(a.dispatch.dispatchDate || 0));
  },


  /* -----------------------------------------------------------------------
     ELIGIBILITY
     --------------------------------------------------------------------- */

  isEligible(companyId, dispatch) {
    if (!dispatch) return { eligible: false, reason: "This dispatch no longer exists." };
    if (dispatch.status !== "Dispatched") return { eligible: false, reason: "Only a Dispatched shipment needs an e-way bill." };
    if (!dispatch.linkedInvoiceId || typeof ERP_TaxInvoiceRepository === "undefined") {
      return { eligible: false, reason: "This dispatch has no linked invoice to value the consignment from." };
    }
    const invoice = ERP_TaxInvoiceRepository.findById(dispatch.linkedInvoiceId);
    if (!invoice) return { eligible: false, reason: "The invoice this dispatch was raised against no longer exists." };

    if (invoice.invoiceDate) {
      const ageDays = Math.floor((new Date() - new Date(invoice.invoiceDate)) / (1000 * 60 * 60 * 24));
      if (ageDays > ERP_EWAYBILL_MAX_DOCUMENT_AGE_DAYS) {
        return { eligible: false, reason: `This invoice is ${ageDays} days old — past the ${ERP_EWAYBILL_MAX_DOCUMENT_AGE_DAYS}-day limit, an e-way bill can no longer be generated against it.` };
      }
    }

    const totals = ERP_TaxInvoiceRepository.computeGrandTotal(invoice);
    if (totals.total < ERP_EWAYBILL_THRESHOLD) {
      return { eligible: false, reason: `Consignment value ₹${totals.total.toLocaleString("en-IN")} is under the ₹${ERP_EWAYBILL_THRESHOLD.toLocaleString("en-IN")} threshold — an e-way bill isn't required.` };
    }

    if (this.findForDispatch(companyId, dispatch.id)) {
      return { eligible: false, reason: "An e-way bill already exists for this dispatch." };
    }

    return { eligible: true, reason: null, invoice, totals };
  },


  /* -----------------------------------------------------------------------
     THE EBN — structural simulation, see file header
     --------------------------------------------------------------------- */

  /** Identical mixing to `e-invoice-data.js`'s own `_computeIrn()`,
      reduced to 12 numeric digits (a real EBN's own shape) rather than
      64 hex characters — deliberately NOT copy-pasted into a shared
      file: each module owns its own structural simulation, the same
      restraint that keeps `_resolveSplit()` independently recomputed
      in `gstr1-data.js` and `gstr3b-data.js` rather than shared. */
  _computeEbn(canonicalString) {
    let h1 = 0x811c9dc5, h2 = 0x1000193;
    for (let i = 0; i < canonicalString.length; i++) {
      const c = canonicalString.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ c, 0x85ebca6b);
    }
    const digits = ((h1 >>> 0).toString() + (h2 >>> 0).toString()).padStart(12, "0");
    return digits.slice(0, 12);
  },

  _canonicalString(company, dispatch, invoice) {
    return `${company.gstin || "UNREGISTERED"}|EWB|${dispatch.dispatchCode}|${invoice.invoiceCode}`;
  },


  /* -----------------------------------------------------------------------
     GENERATE / CANCEL
     --------------------------------------------------------------------- */

  /** `distanceKm` is supplied by the trainee — see file header for why
      this project has no other source for it. */
  generate(company, dispatch, distanceKm, actorUsername) {
    const check = this.isEligible(company.id, dispatch);
    if (!check.eligible) return { success: false, reason: check.reason };

    const km = Number(distanceKm) || 0;
    if (km <= 0) return { success: false, reason: "Enter the approximate distance the consignment will travel." };

    const customer = check.invoice.customerId && typeof ERP_CustomerRepository !== "undefined"
      ? ERP_CustomerRepository.findById(check.invoice.customerId) : null;
    const homeState = this._homeState(company.id);
    const otherState = (customer && customer.state ? customer.state : "").trim().toLowerCase();
    const isInterState = !!(homeState && otherState && homeState !== otherState);

    const validityDays = Math.max(1, Math.ceil(km / ERP_EWAYBILL_KM_PER_VALIDITY_DAY));
    const generatedAt = new Date();
    const validUntil = new Date(generatedAt.getTime() + validityDays * 24 * 60 * 60 * 1000);

    const ebn = this._computeEbn(this._canonicalString(company, dispatch, check.invoice));

    const record = {
      id: "EWB-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      dispatchId: dispatch.id,
      dispatchCode: dispatch.dispatchCode,
      invoiceId: check.invoice.id,
      invoiceCode: check.invoice.invoiceCode,
      customerId: check.invoice.customerId,
      consignmentValue: check.totals.total,
      isInterState,
      distanceKm: km,
      validityDays,
      transporterName: dispatch.transporterName,
      vehicleNumber: dispatch.vehicleNumber,
      modeOfTransport: dispatch.modeOfTransport,
      ebn,
      status: "Generated",
      generatedAt: generatedAt.toISOString(),
      validUntil: validUntil.toISOString(),
      generatedByUsername: actorUsername || "system",
      cancelledAt: null,
      cancelledByUsername: null
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return { success: true, record };
  },

  isExpired(record) {
    if (!record || record.status !== "Generated") return false;
    return new Date() > new Date(record.validUntil);
  },

  /** Real rule: 24 hours from generation, the identical shape
      `e-invoice-data.js`'s own `canCancel()` already uses. */
  canCancel(record) {
    if (!record || record.status !== "Generated") return false;
    const elapsedHours = (new Date() - new Date(record.generatedAt)) / (1000 * 60 * 60);
    return elapsedHours <= 24;
  },

  cancel(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return { success: false, reason: "This e-way bill no longer exists." };
    if (!this.canCancel(all[idx])) {
      return { success: false, reason: "This e-way bill was generated more than 24 hours ago and can no longer be cancelled through this simulator, matching the real 24-hour window for an unused EBN." };
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
