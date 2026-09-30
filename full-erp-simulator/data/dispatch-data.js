/* =============================================================================
   DOT ERP
   FILE:  data/dispatch-data.js
   ROLE:  Data-access layer for Dispatch — Phase 5, Module 07. Built from
          one Raised Tax Invoice (Module 06) — read that file's header
          first, this one assumes that context.

   BUILT FROM THE TAX INVOICE, NOT THE DELIVERY CHALLAN — A DELIBERATE
   CALL, NOT THE DEFAULT ONE. CONTINUE_HERE.md flagged two plausible
   parents ahead of time: `ERP_TaxInvoiceRepository.getRaisedForCompany()`
   or `ERP_DeliveryChallanRepository.getIssuedForCompany()`. Two things
   point at the invoice. First, the roadmap's own ordering — Tax Invoice
   is Module 06, Dispatch is Module 07, immediately next — and every
   module in this phase so far (bar the two documented exceptions,
   Invoice Verification and Purchase Closure, on the PROCUREMENT side)
   builds from whatever shipped one hop before it. Second, and more
   important, real GST-compliant transport practice actually works this
   way: goods can't legally move without a document that states value and
   tax (the invoice, or in some cases the challan) accompanying them, and
   the transport paperwork (an e-way bill, a lorry receipt) is written
   REFERENCING that invoice's own number — logistics execution attaches
   to the billing-final document, not the shipping-quantity one. The
   Delivery Challan already did its own job (proving what physically
   shipped); Dispatch's job is the ACTUAL HANDOVER TO A TRANSPORTER, and
   that handover is what the invoice's own existence authorizes.

   HEADER-ONLY, NO LINE ITEMS — THE SAME SHAPE PAYMENT REQUEST/VENDOR
   PAYMENT USED, FOR A DIFFERENT REASON. Every earlier "what's in this
   shipment" question already has a home: Delivery Challan's own
   `challanLines[]` (quantity) and Tax Invoice's own `invoiceLines[]`
   (quantity + price + tax + HSN). Dispatch's real-world job is the
   LOGISTICS EVENT itself — who's carrying it, what vehicle, what
   tracking number — not another copy of what's inside the shipment. A
   header-only document is the honest shape for that, not a
   simplification: a real "Goods Dispatch Note" sometimes does list
   packages, but this simulator has already committed that data to two
   earlier documents, and repeating it a third time would just be a
   third copy of the same numbers, not new information.

   TRANSPORTER IS FREE TEXT — A DOCUMENTED SIMPLIFICATION, NOT AN
   OVERSIGHT. A real ERP would very likely have its own Transporter
   Master (the same way Vendor Master and Customer Master exist), so a
   transporter could be picked from a list and its own contact/GST
   details reused across shipments. Phase 3 never built one — the
   original 10 Master Data modules were Customer/Vendor/Warehouse/
   Category/Unit/Item/Tax/HSN/Payment Terms/Bank, no Transporter — so
   `transporterName` stays a plain text field here, the same "no master
   exists yet, so this is free text until one does" reasoning Warehouse
   Master's own `branchId`-vs-free-address split and Vendor Master's
   original bank fields both used before their own masters caught up.

   CONTROLLED VOCABULARY: `.transportModes` (Road/Rail/Air/Sea/Courier),
   the same "more than 2-3 members earns a looped array" discipline as
   Vendor Payment's own `.paymentMethods`.

   `dispatchedByEmployeeId` REUSES EMPLOYEE MASTER, THE SAME "WHO ON OUR
   SIDE HANDLED THIS" PATTERN GOODS RECEIPT'S OWN "Received By" USED ON
   THE PROCUREMENT SIDE — a genuinely mirrored, not reinvented, use of
   an already-existing master.

   STATUS: `Draft -> Dispatched -> Cancelled`, THE SAME SIMPLE 3-STATE
   OPERATIONAL SHAPE AS DELIVERY SCHEDULE/GOODS RECEIPT/GRN/QUALITY
   INSPECTION/INVOICE VERIFICATION/VENDOR PAYMENT — no approval gate,
   because arranging a shipment's transport is an administrative/
   logistics action, not a financial decision (Order Approval, four
   modules back, already covered the one real decision this whole
   chain needed). THIS MODULE GETS TO USE THE WORD "Dispatched" AS ITS
   OWN TERMINAL STATUS — Delivery Challan's own header deliberately
   avoided that exact word for its OWN terminal state ("Issued" instead)
   specifically so this module could have it without a collision. That
   reservation pays off here.

   NO DUPLICATE CHECK NEEDED — resolution #8 (Section 9), the same
   "structurally not applicable" reasoning as every other exclusivity-
   plus-no-freeform-array module: `linkedInvoiceId` exclusivity already
   prevents claiming the same invoice's dispatch twice, and there's no
   child collection here to duplicate a row within.

   EXCLUSIVITY, THE SAME LIVE-SCAN SHAPE AS EVERY EARLIER LINK:
   `getLinkedInvoiceIds()`/`getAvailableRaisedInvoicesForCompany()`, pool
   = `ERP_TaxInvoiceRepository.getRaisedForCompany()`. `findDispatchFor-
   Invoice()` is the retrofit hook — Tax Invoice's own Detail modal picks
   up a "Linked to Dispatch" row from it. `getDispatchedForCompany()` is
   the FK-surface hook later Sales modules (Sales Close's own completion
   checklist) are expected to read from.

   A NOTABLE STRUCTURAL POINT WORTH FLAGGING: Tax Invoice is now a HUB,
   NOT JUST A LINK IN A CHAIN. Dispatch (this module), Payment Collection
   (#08), and Receipt (#09) all independently build FROM the same Raised
   Tax Invoice rather than chaining through one another — logistics
   fulfillment and financial collection are two genuinely separate
   real-world concerns that both start from "the invoice is now final,"
   not a sequential relay race. Purchase Order was this codebase's first
   hub (Vendor Confirmation, Delivery Schedule's own chain, Invoice
   Verification's own chain, and Purchase Closure all read from it), so
   the shape itself isn't new — but this is the first time it happens
   this close together, three downstream modules deep in one phase,
   worth noting so a future session doesn't mistake it for an accident.
   ========================================================================== */

const ERP_DISPATCH_KEY = "erp_dispatches";

const ERP_DISPATCH_STATUSES = ["Draft", "Dispatched", "Cancelled"];

const ERP_DISPATCH_TRANSPORT_MODES = ["Road", "Rail", "Air", "Sea", "Courier"];

const ERP_DispatchRepository = {
  statuses: ERP_DISPATCH_STATUSES,
  transportModes: ERP_DISPATCH_TRANSPORT_MODES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_DISPATCH_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_DISPATCH_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((d) => d.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((d) => d.id === id) || null;
  },

  /** COMP-001-DSP-01, COMP-001-DSP-02, ... */
  nextDispatchCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((d) => {
      const match = /-DSP-(\d+)$/.exec(d.dispatchCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-DSP-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(d) {
    return d.status === "Draft";
  },

  canDelete(d) {
    return d.status === "Draft" || d.status === "Cancelled";
  },

  /** Every invoice id currently claimed by a non-Cancelled dispatch in
      this company. */
  getLinkedInvoiceIds(companyId, excludeDispatchId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((d) => {
      if (d.id === excludeDispatchId || d.status === "Cancelled") return;
      if (d.linkedInvoiceId) ids.add(d.linkedInvoiceId);
    });
    return ids;
  },

  /** Raised invoices not already claimed elsewhere — the pool the
      "arrange dispatch for an invoice" picker offers. */
  getAvailableRaisedInvoicesForCompany(companyId, excludeDispatchId) {
    if (typeof ERP_TaxInvoiceRepository === "undefined") return [];
    const claimed = this.getLinkedInvoiceIds(companyId, excludeDispatchId);
    return ERP_TaxInvoiceRepository.getRaisedForCompany(companyId).filter((inv) => !claimed.has(inv.id));
  },

  /** The retrofit hook for Tax Invoice's own Detail modal. */
  findDispatchForInvoice(companyId, invoiceId) {
    return this.getAllForCompany(companyId).find((d) =>
      d.status !== "Cancelled" && d.linkedInvoiceId === invoiceId
    ) || null;
  },

  /** The FK-surface hook Sales Close (#10) is expected to read from —
      every Dispatched record for this company, oldest-first (FIFO). */
  getDispatchedForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((d) => d.status === "Dispatched")
      .sort((a, b) => new Date(a.dispatchedAt) - new Date(b.dispatchedAt));
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "DSP-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      dispatchCode: this.nextDispatchCode(company),
      linkedInvoiceId: null,
      transporterName: "",
      vehicleNumber: "",
      driverName: "",
      driverContactNumber: "",
      modeOfTransport: "",
      lrNumber: "",
      dispatchDate: null,
      expectedDeliveryDate: null,
      dispatchedByEmployeeId: null,
      remarks: "",
      status: "Draft",
      dispatchedAt: null, dispatchedByUsername: null,
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
    const idx = all.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Dispatched. Administrative logistics action, not a
      decision — see file header. */
  markDispatched(id, actorUsername) {
    return this.update(id, { status: "Dispatched", dispatchedAt: new Date().toISOString(), dispatchedByUsername: actorUsername });
  },

  reopen(id) {
    return this.update(id, { status: "Draft", dispatchedAt: null, dispatchedByUsername: null });
  },

  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  remove(id) {
    const d = this.findById(id);
    if (!d || !this.canDelete(d)) return false;
    const all = this.getAll().filter((rec) => rec.id !== id);
    this._saveAll(all);
    return true;
  }
};
