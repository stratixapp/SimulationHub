/* =============================================================================
   DOT ERP
   FILE:  data/delivery-challan-data.js
   ROLE:  Data-access layer for Delivery Challan — Phase 5, Module 05. Built
          from one Approved Sales Order (Module 03/04's own output) — read
          those files' headers first, this one assumes that context.

   PROOF OF WHAT SHIPPED, NOT A BILL — A DELIBERATE SCOPE LINE AGAINST
   THE NEXT TWO MODULES: A Sales Order already carries pricing and tax;
   Tax Invoice (Module 06) is where the formal bill gets raised; Dispatch
   (Module 07) is where the actual logistics — transporter, vehicle,
   tracking — will live. This module's only job, sitting between them, is
   to prove WHAT physically left the building and in what quantity. So
   `challanLines[]` deliberately carries NO `unitPrice`/`taxId` at all —
   the one line-items collection in this whole codebase that's quantity-
   only, on purpose, not because pricing was forgotten. And no
   transporter/vehicle/tracking fields either, even though a real
   delivery challan often has a "dispatched via" line — that's Module 07's
   territory to define properly, not something to guess at half-built
   here. Keep both boundaries in mind if you're the one building Modules
   06 or 07: don't reach back into this file to bolt pricing or logistics
   onto it after the fact; give each its own clean home.

   BUILT FROM ONE APPROVED SALES ORDER, HEADER + LINES COPIED — SAME
   SHAPE AS GOODS RECEIPT'S OWN FROM A FINALIZED SCHEDULE, MIRRORED FROM
   THE SHIPPING SIDE INSTEAD OF THE RECEIVING SIDE. `salesOrderId`,
   required, exclusive (one Approved sales order claimed by at most one
   non-Cancelled challan — the same live-scan shape as every earlier link
   in both phases). `challanLines[]` is copied verbatim from the sales
   order's own frozen `lineItems[]` at creation — another "whole array
   replaced together" collection, no free-form add here either. Each line
   keeps `orderedQuantity` (frozen, for reference — what the customer
   actually ordered) alongside `deliveredQuantity` (pre-filled equal to
   it, but genuinely meant to be overwritten): a warehouse might only
   have partial stock ready to ship right now, the exact same "the
   starting point is a real starting point, not a lock" reasoning Goods
   Receipt's own `receivedQuantity` established for the inbound side.
   `hasShortfall()` below is a plain, non-blocking derived flag — never a
   validation gate — for exactly that case.

   STATUS: `Draft -> Issued -> Cancelled`, THE SAME 3-STATE SHAPE AS
   GOODS RECEIPT/DELIVERY SCHEDULE, NAMED TO DODGE A REAL COLLISION.
   No approval gate — like Goods Receipt, this is an operational record
   of what happened, not a financial commitment needing sign-off (Order
   Approval, one step back, already covered the money decision). The
   terminal status is explicitly NOT called "Dispatched" even though
   that's the first word that comes to mind for "this shipment is ready
   to go" — Dispatch is Module 07's own name and job later in this same
   roadmap, and reusing it here would make status-history displays read
   like the same event happened twice under two different modules.
   "Issued" was picked instead — real Indian business practice already
   describes a delivery challan as being "issued," so the word choice
   isn't a stretch even as it dodges the collision.

   EXCLUSIVITY, CONTINUING THE SAME LIVE-SCAN SHAPE: `getLinkedSalesOrderIds()`/
   `getAvailableApprovedSalesOrdersForCompany()`, pool = `ERP_SalesOrderRepository
   .getApprovedForCompany()`. `findChallanForSalesOrder()` is the retrofit
   hook — Sales Order's own Detail modal picks up a "Linked to Delivery
   Challan" row from it. `getIssuedForCompany()` is the FK-surface hook
   Tax Invoice (Module 06) is expected to read from — no
   `linkedTaxInvoiceId` field built ahead of time, the same "defer what
   nothing yet blocks" discipline every retrofit in this codebase has
   followed without exception.

   NO DUPLICATE CHECK NEEDED — SAME "STRUCTURALLY NOT APPLICABLE"
   REASONING AS SALES ORDER'S OWN: exclusivity over the sales order plus
   a copied-not-freely-added line array means there's nothing left that
   COULD duplicate. `customerId` is a stored copy, captured once at
   creation — the same "stable even if the source record changes later"
   reasoning as every earlier copy in this chain (Quotation's from the
   inquiry, Sales Order's from the quotation).
   ========================================================================== */

const ERP_DELIVERY_CHALLAN_KEY = "erp_delivery_challans";

const ERP_DELIVERY_CHALLAN_STATUSES = ["Draft", "Issued", "Cancelled"];

const ERP_DeliveryChallanRepository = {
  statuses: ERP_DELIVERY_CHALLAN_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_DELIVERY_CHALLAN_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_DELIVERY_CHALLAN_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((c) => c.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((c) => c.id === id) || null;
  },

  /** COMP-001-DC-01, COMP-001-DC-02, ... */
  nextChallanCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((c) => {
      const match = /-DC-(\d+)$/.exec(c.challanCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-DC-${String(max + 1).padStart(2, "0")}`;
  },

  /** Only a Draft can be edited — header AND each line's
      deliveredQuantity. */
  canEdit(challan) {
    return challan.status === "Draft";
  },

  /** Draft/Cancelled deletable; Issued not — an operational record of
      something that already happened. Same shape as Goods Receipt's
      canDelete(). */
  canDelete(challan) {
    return challan.status === "Draft" || challan.status === "Cancelled";
  },

  /** True if any line is shipping less than what was ordered —
      informational only, never a validation gate. See file header. */
  hasShortfall(challan) {
    return (challan.challanLines || []).some((l) => Number(l.deliveredQuantity) < Number(l.orderedQuantity));
  },

  /** Every sales order id currently claimed by a non-Cancelled challan in
      this company. */
  getLinkedSalesOrderIds(companyId, excludeChallanId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((c) => {
      if (c.id === excludeChallanId || c.status === "Cancelled") return;
      if (c.salesOrderId) ids.add(c.salesOrderId);
    });
    return ids;
  },

  /** Approved sales orders not already claimed elsewhere — the pool the
      "prepare a challan against a sales order" picker offers. */
  getAvailableApprovedSalesOrdersForCompany(companyId, excludeChallanId) {
    if (typeof ERP_SalesOrderRepository === "undefined") return [];
    const claimed = this.getLinkedSalesOrderIds(companyId, excludeChallanId);
    return ERP_SalesOrderRepository.getApprovedForCompany(companyId).filter((so) => !claimed.has(so.id));
  },

  /** The retrofit hook for Sales Order's own Detail modal. */
  findChallanForSalesOrder(companyId, salesOrderId) {
    return this.getAllForCompany(companyId).find((c) =>
      c.status !== "Cancelled" && c.salesOrderId === salesOrderId
    ) || null;
  },

  /** The FK-surface hook Tax Invoice (Module 06) is expected to read
      from — every Issued challan for this company, oldest-issued-first
      (FIFO). */
  getIssuedForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((c) => c.status === "Issued")
      .sort((a, b) => new Date(a.issuedAt) - new Date(b.issuedAt));
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  /** Copies the sales order's own lineItems[] into challanLines[],
      dropping pricing/tax entirely and adding orderedQuantity (frozen)
      + deliveredQuantity (the editable starting point) — see file
      header. */
  create(company, salesOrder, data) {
    const record = {
      id: "DC-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      challanCode: this.nextChallanCode(company),
      salesOrderId: salesOrder.id,
      customerId: salesOrder.customerId,
      dispatchWarehouseId: null,
      challanDate: salesOrder.deliveryDate || null,
      challanLines: (salesOrder.lineItems || []).map((l) => ({
        id: l.id,
        itemId: l.itemId,
        lineDescription: l.lineDescription,
        orderedQuantity: l.quantity,
        deliveredQuantity: l.quantity
      })),
      notes: "",
      status: "Draft",
      issuedAt: null, issuedByUsername: null,
      cancelledAt: null, cancelledByUsername: null,
      createdAt: new Date().toISOString(),
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Header-field edits AND per-line deliveredQuantity updates — the
      calling page checks canEdit() first. */
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  updateLineQuantity(challanId, lineId, deliveredQuantity) {
    const c = this.findById(challanId);
    if (!c) return null;
    const challanLines = (c.challanLines || []).map((l) => (l.id === lineId ? { ...l, deliveredQuantity } : l));
    return this.update(challanId, { challanLines });
  },

  /** Draft -> Issued. No approval gate — see file header. */
  issue(id, actorUsername) {
    return this.update(id, { status: "Issued", issuedAt: new Date().toISOString(), issuedByUsername: actorUsername });
  },

  /** Issued -> Draft, to correct a mistake. Mirrors Goods Receipt's own
      reopen(). */
  reopen(id) {
    return this.update(id, { status: "Draft", issuedAt: null, issuedByUsername: null });
  },

  /** Draft/Issued -> Cancelled. Frees the linked sales order for a
      different challan to claim. */
  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  /** Refuses for Issued — see canDelete(). */
  remove(id) {
    const c = this.findById(id);
    if (!c || !this.canDelete(c)) return false;
    const all = this.getAll().filter((r) => r.id !== id);
    this._saveAll(all);
    return true;
  }
};
