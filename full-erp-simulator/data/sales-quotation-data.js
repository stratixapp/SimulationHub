/* =============================================================================
   DOT ERP
   FILE:  data/sales-quotation-data.js
   ROLE:  Data-access layer for Quotation — Phase 5, Module 02. The module
          Customer Inquiry (Module 01) was explicitly built to feed
          (`ERP_CustomerInquiryRepository.getConvertibleForCompany()`).
          Read that file's header first — this one assumes that context.

   NAMED "SALES QUOTATION" IN CODE, NOT "QUOTATION" — A DELIBERATE
   DISAMBIGUATION FROM PHASE 4's OWN "QUOTATION":
   The roadmap calls this module "Quotation," but Phase 4 Module 06
   (`data/quotation-data.js`) already owns the global identifiers
   `ERP_QuotationRepository` / `ERP_QUOTATION_KEY` / `ERP_QUOTATION_STATUSES`
   for Quotation RECEIPT — a VENDOR's price TO this company. This module is
   the opposite direction entirely: THIS COMPANY's own price OFFER to a
   CUSTOMER. Reusing the same identifiers would either collide outright or,
   worse, silently shadow one repository with the other if both scripts
   were ever loaded on the same page. Every identifier here is prefixed
   `SalesQuotation`/`SALES_QUOTATION` and the record code suffix is `-SQ-`
   (not `-QT-`, already Quotation Receipt's) for exactly this reason — see
   CONTINUE_HERE.md Section 10's own warning about this before Phase 5
   started. The visible sidebar label and training content still just say
   "Quotation," matching the roadmap; only the code-level names disambiguate.

   LINE ITEMS, CRUD-STYLE — NOT COPIED FROM THE PARENT, UNLIKE MOST OF
   PHASE 4's LATER "BUILT FROM ONE UPSTREAM RECORD" MODULES:
   Customer Inquiry carries at most ONE optional item + one free-text
   description — nowhere near the multi-line structure a real quotation
   needs (a customer's actual ask often expands into several priced lines
   once a sales person actually works it). So this module's `lineItems[]`
   follows Purchase Requisition's shape (Module 2's own — freely add/edit/
   remove via `addLineItem`/`updateLineItem`/`removeLineItem`, a dedicated
   line-item modal on the page), NOT the "whole array pre-filled and
   replaced together" shape Quotation Receipt/PO/Delivery Schedule/etc.
   used for the rest of Phase 4. The one thing this module DOES borrow from
   the inquiry: the PAGE seeds a single starting line from the inquiry's
   own item/description/quantity right after creation (convenience, not a
   structural copy — freely editable/removable afterward like any line).

   A GENUINELY NEW COMBINATION: FREE-FORM LINE CRUD *WITH* PER-LINE PRICING
   *AND* TAX. Purchase Requisition's freely-added lines never had a
   required price (`estimatedUnitPrice` was optional — a rough estimate is
   fine pre-approval). Quotation Receipt's per-line pricing was rich but
   the whole array was pre-filled/replaced, never freely added to. This
   module is the first to combine BOTH — freely add/remove lines exactly
   like PR, but `unitPrice` is REQUIRED per line, because a real quotation
   without a price on every line isn't actually a quotation yet; that's
   the whole point of the document. `taxId` is the FIRST use anywhere in
   the codebase of Tax Master (Phase 3, unused until now) against an actual
   document total — see computeGrandTotal() below.

   TAX DEFAULTS FROM THE LINKED ITEM, VIA ITS OWN EXISTING CHAIN:
   When a line links a catalog Item, `unitPrice` defaults from that item's
   own `salePrice` and `taxId` defaults from `ERP_ItemRepository.
   getEffectiveTaxCode(item)` (Item's own Item->HSN->Tax fallback chain,
   built when Item Master was retrofitted in Phase 3) — both stay
   independently editable afterward, the same "defaults from upstream but
   can diverge" shape as Goods Receipt's Received Qty or Payment Request's
   requestedAmount, not the "always fully derived" shape of a PO's Vendor.
   A real quotation regularly discounts off list price, so locking
   `unitPrice` to the item's own would be wrong, not just inconvenient.

   computeGrandTotal() RETURNS A RICHER SHAPE THAN ANY EARLIER MODULE'S:
   `{ subtotal, taxTotal, total, pricedCount, totalCount }` — the first
   grand total in the whole codebase that separates a pre-tax subtotal from
   a tax component instead of a single lump total, because this is also
   the first document whose total genuinely needs to show tax broken out
   (a customer-facing quotation always itemizes tax). Still keeps the same
   partial-aware `pricedCount`/`totalCount` shape every earlier `compute-
   GrandTotal`/`computeQuotedTotal` used, even though `unitPrice` being
   required per line means this pair should rarely actually diverge — kept
   for robustness and shape-consistency with the rest of the codebase.

   CUSTOMER EXCLUSIVITY, SAME SHAPE AS PR'S NEED EXCLUSIVITY, ONE HOP
   EARLIER: `getLinkedInquiryIds()`/`getAvailableConvertedInquiriesForCompany()`
   are the exact same live-scan shape as `pr-data.js`'s need exclusivity —
   a Converted inquiry claimed by any non-Cancelled quotation stops
   appearing as available to a different one. `findQuotationForInquiry()`
   is the retrofit hook for Customer Inquiry's own Detail modal (a
   "Linked to Quotation" row, purely additive, the same shape as Department
   Need's own PR retrofit).

   `customerId` IS A STORED COPY, CAPTURED ONCE AT CREATION — NOT A LIVE
   CHAIN THROUGH THE INQUIRY EVERY READ:
   Same reasoning as `po-data.js` storing its own `vendorId` directly
   rather than re-deriving it live through `linkedQuotationId` on every
   read: once this record exists, it should stay stable and independently
   meaningful even if the source inquiry is later Cancelled (Customer
   Inquiry's own `cancel()` doesn't check whether a Quotation already
   claims it — the same known, accepted simplification Department Need's
   own `cancel()` has always had relative to Purchase Requisition; see
   CONTINUE_HERE.md Section 9). `customerId` is never independently
   choosable on this form — always fully derived from whichever inquiry is
   linked, the same "always fully derived" treatment as Vendor on a PO.

   A 5-STATE SHAPE THAT LOOKS LIKE (a) BUT BEHAVES LIKE THE DECLINE HALF OF
   VENDOR CONFIRMATION, NOT LIKE DEPARTMENT NEED'S REJECT:
   Draft -> Sent -> Accepted / Declined, +Cancelled. Sent requires at least
   one line item AND a `validUntil` date (both validated at the page level,
   the same division of responsibility as every earlier module's send/
   submit gate). The important call: **Declined has NO reopen or revise-
   and-resend**, unlike Department Need/PR's Rejected -> Draft. A customer
   declining a quotation is an OUTSIDE PARTY's decision, the same category
   as a vendor declining a PO in Vendor Confirmation — and that module's
   own header already established the reasoning this one reuses directly:
   real renegotiation means a fresh quotation, not silently resurrecting a
   declined one. `withdraw()` (Sent -> Draft) is the one internal, freely-
   reversible action here — pulling back your OWN not-yet-answered
   submission is nothing like the customer's actual response.
   `markAccepted()` is the FK-surface hook Sales Order (Module 3) is
   expected to read from (`getAcceptedForCompany()`). Accepted stays
   cancellable (Draft/Sent/Accepted -> Cancelled), the same "a terminal
   success state remains cancellable until something downstream actually
   claims it" precedent Department Need's Approved and Customer Inquiry's
   Converted both established.

   DUPLICATE CHECK — REUSES RESOLUTION #6 (CHILD-COLLECTION-SCOPED SOFT
   NUDGE), NO NEW RESOLUTION NEEDED: same shape as PR's own
   `findDuplicateLineItemByItem()` — the same catalog item added as a
   second line within the SAME quotation, nudged (never blocked), since
   it's usually meant to be one line with a combined quantity.
   ========================================================================== */

const ERP_SALES_QUOTATION_KEY = "erp_sales_quotations";

const ERP_SALES_QUOTATION_STATUSES = ["Draft", "Sent", "Accepted", "Declined", "Cancelled"];

const ERP_SalesQuotationRepository = {
  statuses: ERP_SALES_QUOTATION_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_SALES_QUOTATION_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_SALES_QUOTATION_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** Newest-raised-first, same chronological default every transactional
      module in this codebase uses. */
  getAllForCompany(companyId) {
    return this.getAll()
      .filter((q) => q.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((q) => q.id === id) || null;
  },

  /** COMP-001-SQ-01, COMP-001-SQ-02, ... — `-SQ-`, not `-QT-` (Quotation
      Receipt's own suffix). See file header. */
  nextQuotationCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((q) => {
      const match = /-SQ-(\d+)$/.exec(q.quotationCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-SQ-${String(max + 1).padStart(2, "0")}`;
  },

  /** Only a Draft can be edited or have its line items changed. */
  canEdit(q) {
    return q.status === "Draft";
  },

  /** Draft/Declined/Cancelled deletable; Sent/Accepted not — active or
      succeeded records. */
  canDelete(q) {
    return q.status === "Draft" || q.status === "Declined" || q.status === "Cancelled";
  },

  /** null (not 0) when unitPrice is missing, so callers can tell "not
      priced yet" apart from "priced at zero" — same defensive shape as
      pr-data.js's computeLineTotal(), even though the form requires a
      price per line (see file header). */
  computeLineTotal(line) {
    const price = line.unitPrice;
    if (price === null || price === undefined || price === "" || isNaN(Number(price))) return null;
    return Number(line.quantity) * Number(price);
  },

  /** The tax AMOUNT for one line (not the rate) — 0 if no taxId is set,
      null if the line itself isn't priced yet (nothing to tax). */
  computeLineTax(line) {
    const lineTotal = this.computeLineTotal(line);
    if (lineTotal == null) return null;
    if (!line.taxId || typeof ERP_TaxRepository === "undefined") return 0;
    const tax = ERP_TaxRepository.findById(line.taxId);
    if (!tax) return 0;
    return lineTotal * (Number(tax.ratePct) || 0) / 100;
  },

  /** The richer { subtotal, taxTotal, total, pricedCount, totalCount }
      shape — see file header for why this document is the first to need
      tax broken out separately from the line subtotal. */
  computeGrandTotal(q) {
    let subtotal = 0, taxTotal = 0, pricedCount = 0;
    (q.lineItems || []).forEach((line) => {
      const lineTotal = this.computeLineTotal(line);
      if (lineTotal != null) {
        subtotal += lineTotal;
        taxTotal += this.computeLineTax(line) || 0;
        pricedCount++;
      }
    });
    return { subtotal, taxTotal, total: subtotal + taxTotal, pricedCount, totalCount: (q.lineItems || []).length };
  },

  /** Every Customer Inquiry id currently claimed by some OTHER
      non-Cancelled quotation in this company. See file header. */
  getLinkedInquiryIds(companyId, excludeQuotationId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((q) => {
      if (q.id === excludeQuotationId || q.status === "Cancelled") return;
      if (q.customerInquiryId) ids.add(q.customerInquiryId);
    });
    return ids;
  },

  /** Converted inquiries not already claimed elsewhere — the pool the
      "link a converted inquiry" picker offers. */
  getAvailableConvertedInquiriesForCompany(companyId, excludeQuotationId) {
    if (typeof ERP_CustomerInquiryRepository === "undefined") return [];
    const claimed = this.getLinkedInquiryIds(companyId, excludeQuotationId);
    return ERP_CustomerInquiryRepository.getConvertibleForCompany(companyId)
      .filter((n) => !claimed.has(n.id));
  },

  /** The retrofit hook for Customer Inquiry's own Detail modal. */
  findQuotationForInquiry(companyId, inquiryId) {
    return this.getAllForCompany(companyId).find((q) =>
      q.status !== "Cancelled" && q.customerInquiryId === inquiryId
    ) || null;
  },

  /** The FK-surface hook Sales Order (Module 3) is expected to read from
      — every Accepted quotation for this company, oldest-accepted-first
      (FIFO), the same shape as every earlier "X for Company" hook. */
  getAcceptedForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((q) => q.status === "Accepted")
      .sort((a, b) => new Date(a.acceptedAt) - new Date(b.acceptedAt));
  },

  /** Soft, non-blocking — reuses resolution #6 exactly (child-collection
      scoped). See file header. */
  findDuplicateLineItemByItem(q, itemId, excludeLineId) {
    if (!itemId) return null;
    return (q.lineItems || []).find((l) => l.id !== excludeLineId && l.itemId === itemId) || null;
  },

  /** One-line delegate to the centralized window.ERP.actorLabel(), same
      as every Phase 5 module going forward. */
  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "SQ-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      quotationCode: this.nextQuotationCode(company),
      customerInquiryId: null,
      customerId: null,
      lineItems: [],
      validUntil: null,
      notes: "",
      status: "Draft",
      sentAt: null, sentByUsername: null,
      acceptedAt: null, acceptedByUsername: null,
      declinedAt: null, declinedByUsername: null, declineReason: "",
      cancelledAt: null, cancelledByUsername: null,
      createdAt: new Date().toISOString(),
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Header-field edits — calling page checks canEdit() first, same
      division of responsibility as every earlier module's update(). */
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  addLineItem(quotationId, lineData) {
    const q = this.findById(quotationId);
    if (!q) return null;
    const line = {
      id: "LN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      itemId: null,
      lineDescription: "",
      quantity: 0,
      unitPrice: null,
      taxId: null,
      ...lineData
    };
    return this.update(quotationId, { lineItems: (q.lineItems || []).concat([line]) });
  },

  updateLineItem(quotationId, lineId, partial) {
    const q = this.findById(quotationId);
    if (!q) return null;
    const lineItems = (q.lineItems || []).map((l) => (l.id === lineId ? { ...l, ...partial } : l));
    return this.update(quotationId, { lineItems });
  },

  removeLineItem(quotationId, lineId) {
    const q = this.findById(quotationId);
    if (!q) return null;
    return this.update(quotationId, { lineItems: (q.lineItems || []).filter((l) => l.id !== lineId) });
  },

  /** Draft -> Sent. The calling page validates >=1 line item and a set
      validUntil first — see file header. */
  send(id, actorUsername) {
    return this.update(id, { status: "Sent", sentAt: new Date().toISOString(), sentByUsername: actorUsername });
  },

  /** Sent -> Draft — pulling back your OWN not-yet-answered quotation.
      See file header for why this is nothing like Declined. */
  withdraw(id) {
    return this.update(id, { status: "Draft", sentAt: null, sentByUsername: null });
  },

  /** Sent -> Accepted. Terminal success — see file header. */
  markAccepted(id, actorUsername) {
    return this.update(id, {
      status: "Accepted",
      acceptedAt: new Date().toISOString(),
      acceptedByUsername: actorUsername
    });
  },

  /** Sent -> Declined. Terminal — deliberately NO reopen()/revise() path.
      See file header for why this follows Vendor Confirmation's decline,
      not Department Need's reject. */
  markDeclined(id, actorUsername, reason) {
    return this.update(id, {
      status: "Declined",
      declinedAt: new Date().toISOString(),
      declinedByUsername: actorUsername,
      declineReason: reason || ""
    });
  },

  /** Draft/Sent/Accepted -> Cancelled. */
  cancel(id, actorUsername) {
    return this.update(id, {
      status: "Cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledByUsername: actorUsername
    });
  },

  /** Refuses for Sent/Accepted — see canDelete(). */
  remove(id) {
    const q = this.findById(id);
    if (!q || !this.canDelete(q)) return false;
    const all = this.getAll().filter((r) => r.id !== id);
    this._saveAll(all);
    return true;
  }
};
