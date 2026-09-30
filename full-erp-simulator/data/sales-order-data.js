/* =============================================================================
   DOT ERP
   FILE:  data/sales-order-data.js
   ROLE:  Data-access layer for Sales Order — Phase 5, Module 03. Built from
          one Accepted Quotation (Module 02) — read that file's header
          first, this one assumes that context.

   PR's SHAPE, NOT PO's — AND WHY THAT'S THE RIGHT CALL, NOT A DEFAULT:
   CONTINUE_HERE.md flagged this decision explicitly before this file was
   written: Purchase Order's own 8-state shape exists because TWO separate
   parties each need their own say — the buyer approves internally, AND
   the vendor must separately confirm they can actually fulfill it
   (Vendor Confirmation, its own module). A Sales Order has no equivalent
   second party to confirm: the CUSTOMER already committed the moment they
   Accepted the quotation. What's actually missing before this company can
   commit to fulfilling it is an INTERNAL decision — which is exactly why
   the roadmap names "Order Approval" as its own very next module, the
   same relationship Purchase Requisition has with PR Approval. So this
   file's shape is a direct copy of `pr-data.js`'s: `Draft/Submitted/
   Approved/Rejected/Cancelled`, with `approve()`/`reject()` built here but
   deliberately UNWIRED from this module's own page — reserved for Order
   Approval (Module 04) to call, exactly like PR Approval calls PR's.

   LINE ITEMS ARE A FROZEN COPY, NOT CRUD — THE OPPOSITE CALL FROM
   QUOTATION'S OWN MODULE: Quotation's lines needed free CRUD because the
   source inquiry carried nowhere near enough structure to copy from. A
   Sales Order is the exact opposite case: the source quotation is already
   a complete, priced, tax-inclusive document the customer explicitly
   agreed to. Copying that whole array at creation (the same "pre-filled
   and replaced together" shape Quotation Receipt/PO used, not Quotation's
   own CRUD one) and then leaving it READ-ONLY is the only defensible
   choice — quietly editing what a customer already accepted would make
   the record meaningless. `computeLineTotal`/`computeLineTax`/
   `computeGrandTotal` still exist here (same shape as sales-quotation-
   data.js's own) because the totals still need to be SHOWN, even with
   nothing editable.

   CREDIT CHECK — A HOOK CUSTOMER MASTER WAS ALREADY BUILT FOR, NOT A NEW
   FIELD INVENTED HERE: `data/customer-data.js` already exposes
   `getCreditUsage()`/`getCreditUtilizationBand()`, and its own `setStatus()`
   comment says outright: "Blocked is a credit hold... can't take new
   orders once Sales exists." This module is that promise being kept —
   `getAvailableAcceptedQuotationsForCompany()` below filters out any
   quotation whose customer is not currently Active, so a Blocked or
   Inactive customer's accepted quotations simply never appear as
   create-able Sales Orders. This lives at the SAME layer as every other
   "only Active records are pickable" filter in this codebase (Department/
   Employee/Vendor), not a new kind of business rule — Customer Master
   just happened to already be built anticipating exactly this use.
   Utilization band ("under"/"near"/"over") is surfaced as an informational
   badge at the page level directly from Customer Master's own methods —
   this file doesn't duplicate that logic.

   `customerId` IS A STORED COPY, CAPTURED ONCE AT CREATION — same
   reasoning as `sales-quotation-data.js`'s own `customerId` (which mirrors
   `po-data.js`'s `vendorId`): stable and independently meaningful even if
   the source quotation record changes later.

   EXCLUSIVITY OVER QUOTATION, ONE HOP FURTHER THAN QUOTATION'S OWN OVER
   INQUIRY: `getLinkedQuotationIds()`/`getAvailableAcceptedQuotationsForCompany()`
   are the same live-scan shape used at every earlier link in this chain
   (PR over Need, Quotation over Inquiry). No separate duplicate-check
   resolution is needed for line items, the same "structurally not
   applicable" reasoning PO's own quotation exclusivity already
   established — a quotation can only ever be actively claimed by one
   non-Cancelled Sales Order, so there is nothing left to duplicate.

   `findSalesOrderForQuotation()` IS THE RETROFIT HOOK for Quotation's own
   Detail modal (a "Linked to Sales Order" row), the same shape as every
   earlier retrofit in this codebase. `getApprovedForCompany()` is the
   FK-surface hook Order Approval (Module 04) sets via `approve()`, and
   that Delivery Challan (Module 05) is expected to read from once it
   exists — no `linkedDeliveryChallanId` field built ahead of time.
   ========================================================================== */

const ERP_SALES_ORDER_KEY = "erp_sales_orders";

const ERP_SALES_ORDER_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Cancelled"];

const ERP_SalesOrderRepository = {
  statuses: ERP_SALES_ORDER_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_SALES_ORDER_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_SALES_ORDER_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** Newest-raised-first, same chronological default every transactional
      module in this codebase uses. */
  getAllForCompany(companyId) {
    return this.getAll()
      .filter((so) => so.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((so) => so.id === id) || null;
  },

  /** COMP-001-SO-01, COMP-001-SO-02, ... */
  nextSalesOrderCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((so) => {
      const match = /-SO-(\d+)$/.exec(so.salesOrderCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-SO-${String(max + 1).padStart(2, "0")}`;
  },

  /** Only a Draft can be edited — and only its header (deliveryDate/
      notes). Line items are always frozen; see file header. */
  canEdit(so) {
    return so.status === "Draft";
  },

  /** Draft/Rejected/Cancelled deletable; Submitted/Approved not — active
      or already-decided records. Same shape as pr-data.js's canDelete(). */
  canDelete(so) {
    return so.status === "Draft" || so.status === "Rejected" || so.status === "Cancelled";
  },

  /** Identical shape to sales-quotation-data.js's own — operates on the
      frozen copied lines, just to compute what gets displayed. */
  computeLineTotal(line) {
    const price = line.unitPrice;
    if (price === null || price === undefined || price === "" || isNaN(Number(price))) return null;
    return Number(line.quantity) * Number(price);
  },
  computeLineTax(line) {
    const lineTotal = this.computeLineTotal(line);
    if (lineTotal == null) return null;
    if (!line.taxId || typeof ERP_TaxRepository === "undefined") return 0;
    const tax = ERP_TaxRepository.findById(line.taxId);
    if (!tax) return 0;
    return lineTotal * (Number(tax.ratePct) || 0) / 100;
  },
  computeGrandTotal(so) {
    let subtotal = 0, taxTotal = 0, pricedCount = 0;
    (so.lineItems || []).forEach((line) => {
      const lineTotal = this.computeLineTotal(line);
      if (lineTotal != null) {
        subtotal += lineTotal;
        taxTotal += this.computeLineTax(line) || 0;
        pricedCount++;
      }
    });
    return { subtotal, taxTotal, total: subtotal + taxTotal, pricedCount, totalCount: (so.lineItems || []).length };
  },

  /** Every quotation id currently claimed by some OTHER non-Cancelled
      sales order in this company. See file header. */
  getLinkedQuotationIds(companyId, excludeSalesOrderId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((so) => {
      if (so.id === excludeSalesOrderId || so.status === "Cancelled") return;
      if (so.quotationId) ids.add(so.quotationId);
    });
    return ids;
  },

  /** Accepted quotations not already claimed elsewhere, AND whose
      customer is currently Active — see file header for why a Blocked or
      Inactive customer's accepted quotations never appear here at all. */
  getAvailableAcceptedQuotationsForCompany(companyId, excludeSalesOrderId) {
    if (typeof ERP_SalesQuotationRepository === "undefined") return [];
    const claimed = this.getLinkedQuotationIds(companyId, excludeSalesOrderId);
    return ERP_SalesQuotationRepository.getAcceptedForCompany(companyId)
      .filter((q) => !claimed.has(q.id))
      .filter((q) => {
        if (typeof ERP_CustomerRepository === "undefined" || !q.customerId) return true;
        const cust = ERP_CustomerRepository.findById(q.customerId);
        return cust && cust.status === "Active";
      });
  },

  /** The retrofit hook for Quotation's own Detail modal. */
  findSalesOrderForQuotation(companyId, quotationId) {
    return this.getAllForCompany(companyId).find((so) =>
      so.status !== "Cancelled" && so.quotationId === quotationId
    ) || null;
  },

  /** The FK-surface hook Delivery Challan (Module 05) is expected to read
      from — every Approved sales order for this company, oldest-approved-
      first (FIFO). Set by approve() below, which Order Approval (Module
      04) calls — not this module's own page. */
  getApprovedForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((so) => so.status === "Approved")
      .sort((a, b) => new Date(a.approvedAt) - new Date(b.approvedAt));
  },

  /** One-line delegate to the centralized window.ERP.actorLabel(). */
  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  /** Copies the quotation's own lineItems[] verbatim (frozen from this
      point on) — see file header. */
  create(company, quotation, data) {
    const record = {
      id: "SO-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      salesOrderCode: this.nextSalesOrderCode(company),
      quotationId: quotation.id,
      customerId: quotation.customerId,
      lineItems: (quotation.lineItems || []).map((l) => ({ ...l })),
      deliveryDate: null,
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

  /** Header-field edits ONLY (deliveryDate/notes) — the calling page
      checks canEdit() first. Line items are never touched via update(). */
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((so) => so.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Submitted. The calling page validates deliveryDate is set
      first — see file header for the division of responsibility. */
  submit(id, actorUsername) {
    return this.update(id, { status: "Submitted", submittedAt: new Date().toISOString(), submittedByUsername: actorUsername });
  },

  /** Submitted -> Draft — this module's own page wires this (the
      requester pulling their own submission back), the same as PR's
      withdraw(). */
  withdraw(id) {
    return this.update(id, { status: "Draft", submittedAt: null, submittedByUsername: null });
  },

  /** Submitted -> Approved. Built here but UNWIRED from this module's own
      page — reserved for Order Approval (Module 04). See file header. */
  approve(id, actorUsername) {
    return this.update(id, {
      status: "Approved",
      approvedAt: new Date().toISOString(),
      approvedByUsername: actorUsername
    });
  },

  /** Submitted -> Rejected. Also reserved for Order Approval (Module 04)
      to call — never called from this module's own page. */
  reject(id, actorUsername, reason) {
    return this.update(id, {
      status: "Rejected",
      rejectedAt: new Date().toISOString(),
      rejectedByUsername: actorUsername,
      rejectionReason: reason || ""
    });
  },

  /** Rejected -> Draft — WIRED on this module's own page (the same split
      PR/PR Approval established: the approval page owns only the
      decision; revising after a rejection is the requester's own move). */
  reopen(id) {
    return this.update(id, { status: "Draft" });
  },

  /** Draft/Submitted/Approved -> Cancelled. Frees the linked quotation
      for a different Sales Order to claim, the same as PR's own cancel()
      freeing its linked needs. */
  cancel(id, actorUsername) {
    return this.update(id, {
      status: "Cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledByUsername: actorUsername
    });
  },

  /** Refuses for Submitted/Approved — see canDelete(). */
  remove(id) {
    const so = this.findById(id);
    if (!so || !this.canDelete(so)) return false;
    const all = this.getAll().filter((r) => r.id !== id);
    this._saveAll(all);
    return true;
  }
};
