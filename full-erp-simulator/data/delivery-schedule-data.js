/* =============================================================================
   DOT ERP
   FILE:  data/delivery-schedule-data.js
   ROLE:  Data-access layer for Delivery Schedule — Phase 4, Module 12. A
          Confirmed purchase order (Module 11's own output) says a vendor
          has agreed to deliver something; this module is where the
          company plans HOW that delivery actually lands — which line
          arrives when, so Goods Receipt (Module 13, not yet built) has
          something concrete to check physical arrivals against.

   THE BIG DECISION: BUILT FROM A CONFIRMED PO, HEADER + SCHEDULE LINES,
   ONE LINE PER PO LINE ITEM. Same "built from exactly one upstream
   record, exclusivity enforced" shape Purchase Order itself used one
   module back (`linkedPoId`, required) — see po-data.js's header for the
   shape this mirrors. `scheduleLines[]` is ANOTHER instance of the
   "whole array replaced together, no per-line CRUD" pattern PO's own
   `lineItems` established (not PR's freely add/remove-able lines) —
   there's still no free-form entry point here: the SET of schedule lines
   is always exactly the linked PO's own line items, one planned
   quantity + planned date per line, pre-filled from the PO's own
   quantity and its `vendorConfirmedDeliveryDate` (falling back to
   `expectedDeliveryDate`) as a starting point. Real-world justification
   for why this is genuinely useful and not just copying the same date N
   times: a vendor confirming one overall date for a PO doesn't mean
   every line ships together — in-stock lines often go out immediately
   while back-ordered lines trail behind, and this is where that split
   gets planned. A buyer is free to change any line's planned date
   independently once the schedule is open for editing.

   EXCLUSIVITY, A FOURTH TIME. `getLinkedPoIds()`/
   `getAvailableConfirmedPosForCompany()` mirror the exact shape used
   three times already (Need→PR, PR→RFQ, Quotation→PO): a live scan
   across this repository's own non-Cancelled records, always excluding
   the record being edited. The claimable pool is Confirmed purchase
   orders — NOT Sent or Draft ones, since there's nothing to schedule
   delivery for until the vendor has actually agreed to the order.
   `findScheduleForPo()` is the retrofit hook — Purchase Order's own
   Detail modal picks up a live "Linked to Delivery Schedule" row from it,
   the same live-query-from-the-newer-module shape every retrofit in this
   codebase has used (see CONTINUE_HERE.md Section 9).

   STATUS LIFECYCLE: THE RFQ SHAPE, NOT THE PR/PO SHAPE — DELIBERATELY.
   A delivery schedule doesn't commit new money or need anyone's
   authorization the way a PR or PO does; it's a logistics-coordination
   document, closer to RFQ's "informational, in-progress, no approval
   gate" shape than to PR/PO's approval-gated one. `.statuses` is
   therefore a plain THREE-state `Draft -> Finalized -> Cancelled` — no
   Module 13 approval-style split anywhere in the roadmap for this
   record, so there's no `approve()`/`reject()` pair built-and-left-
   unwired the way PR's and PO's own files have. Named `Finalized`
   rather than reusing `Confirmed` (which `po-data.js` already uses for a
   DIFFERENT thing — the vendor accepting the order) to keep the two
   concepts from reading as the same event in status-history displays.
   Deliberately does NOT reach any kind of "Completed" state from this
   module alone — once Goods Receipt (Module 13) exists, actual receipts
   against a schedule line are that module's job to record, most likely
   as a retrofit onto this file, the same "build the hook when the next
   module in the chain actually needs it" call already made twice this
   session (`po-data.js`'s own `confirm()` gaining a delivery-date
   parameter once Module 11 shipped, `rfq-data.js`/`quotation-data.js`
   gaining Vendor Selection's/Quotation Comparison's fields the modules
   after them).
   ========================================================================== */

const ERP_DELIVERY_SCHEDULE_KEY = "erp_delivery_schedules";

const ERP_DELIVERY_SCHEDULE_STATUSES = ["Draft", "Finalized", "Cancelled"];

const ERP_DeliveryScheduleRepository = {
  statuses: ERP_DELIVERY_SCHEDULE_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_DELIVERY_SCHEDULE_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_DELIVERY_SCHEDULE_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((s) => s.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((s) => s.id === id) || null;
  },

  nextScheduleCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((s) => {
      const match = /-DS-(\d+)$/.exec(s.scheduleCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-DS-${String(max + 1).padStart(2, "0")}`;
  },

  /** Only a Draft can be edited — same shape as every other module. */
  canEdit(schedule) {
    return schedule.status === "Draft";
  },

  /** Draft/Cancelled deletable — Finalized is not, the same way an
      Approved PR/PO can't be silently deleted once it's the record of a
      real decision. */
  canDelete(schedule) {
    return schedule.status === "Draft" || schedule.status === "Cancelled";
  },

  /** Every PO id currently claimed by a non-Cancelled delivery schedule
      in this company. */
  getLinkedPoIds(companyId, excludeScheduleId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((s) => {
      if (s.id === excludeScheduleId || s.status === "Cancelled") return;
      if (s.linkedPoId) ids.add(s.linkedPoId);
    });
    return ids;
  },

  /** Confirmed purchase orders not already claimed by another schedule —
      the pool the "build from a Confirmed PO" picker offers. */
  getAvailableConfirmedPosForCompany(companyId, excludeScheduleId) {
    if (typeof ERP_PurchaseOrderRepository === "undefined") return [];
    const claimed = this.getLinkedPoIds(companyId, excludeScheduleId);
    return ERP_PurchaseOrderRepository.getAllForCompany(companyId)
      .filter((po) => po.status === "Confirmed" && !claimed.has(po.id));
  },

  /** The retrofit hook for Purchase Order's own Detail modal. */
  findScheduleForPo(companyId, poId) {
    return this.getAllForCompany(companyId).find((s) =>
      s.status !== "Cancelled" && s.linkedPoId === poId
    ) || null;
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "DS-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      scheduleCode: this.nextScheduleCode(company),
      linkedPoId: null,
      scheduleLines: [],
      carrierName: "",
      trackingReference: "",
      notes: "",
      status: "Draft",
      finalizedAt: null, finalizedByUsername: null,
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
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Finalized. No approval gate — see file header. */
  finalize(id, actorUsername) {
    return this.update(id, { status: "Finalized", finalizedAt: new Date().toISOString(), finalizedByUsername: actorUsername });
  },

  /** Finalized -> Draft, to revise. */
  reopen(id) {
    return this.update(id, { status: "Draft", finalizedAt: null, finalizedByUsername: null });
  },

  /** Draft/Finalized -> Cancelled. */
  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  /** Refuses for anything but Draft/Cancelled — see canDelete(). */
  remove(id) {
    const schedule = this.findById(id);
    if (!schedule || !this.canDelete(schedule)) return false;
    const all = this.getAll().filter((s) => s.id !== id);
    this._saveAll(all);
    return true;
  }
};
