/* =============================================================================
   DOT ERP
   FILE:  data/goods-receipt-data.js
   ROLE:  Data-access layer for Goods Receipt — Phase 4, Module 13. A
          Finalized delivery schedule (Module 12's own output) says what
          SHOULD arrive and when; this module is the dock-level record of
          what ACTUALLY arrived — the first place in this entire
          simulation where reality can differ from the plan.

   THE BIG DECISION: BUILT FROM A FINALIZED SCHEDULE, HEADER + RECEIPT
   LINES, ONE LINE PER SCHEDULE LINE. Same shape as every header +
   line-items document this session (`linkedScheduleId`, required,
   exclusive — see delivery-schedule-data.js's header for the pattern
   this mirrors exactly). `receiptLines[]` is yet another "whole array
   replaced together, no free-form add" collection — there is still no
   independent line-creation flow anywhere in this chain (PO's lines come
   from a quotation, schedule lines come from the PO, receipt lines come
   from the schedule). Each receipt line carries `receivedQuantity`
   (pre-filled from the schedule's own `plannedQuantity`, but genuinely
   meant to be overwritten — this is the one line-count field in this
   whole session where the "starting point" language is doing real work:
   a shortage or an over-delivery is completely normal at a dock) and a
   short free-text `conditionNotes` per line (damage, wrong item, wrong
   packaging — the kind of thing Quality Inspection, Module 15, will care
   about).

   EXCLUSIVITY, A FIFTH TIME. `getLinkedScheduleIds()`/
   `getAvailableFinalizedSchedulesForCompany()` — identical shape to
   every prior instance this session, scanning this repository's own
   non-Cancelled records. The claimable pool is Finalized delivery
   schedules only. `findReceiptForSchedule()` is the retrofit hook —
   Delivery Schedule's own Detail modal picks up a live "Linked to Goods
   Receipt" row from it.

   STATUS LIFECYCLE: THE SAME 3-STATE SHAPE AS DELIVERY SCHEDULE, NAMED
   DIFFERENTLY ON PURPOSE. `Draft -> Logged -> Cancelled` — no approval
   gate here either; logging what physically arrived is an operational
   record, not a financial commitment. Named `Logged` rather than
   `Finalized` or `Confirmed` (both already mean something else one
   module up the chain) purely to keep status-history displays from
   reading like the same event happened three times. Deliberately does
   NOT try to be the "official" receiving document — that's GRN's job
   (Module 14, not yet built), which the roadmap treats as its own
   separate module for a reason: Goods Receipt is the fast, informal
   dock entry; GRN is expected to be the formal, numbered document later
   modules (Quality Inspection, Three-Way Matching) actually reference.
   Keep that distinction in mind if you're the one building Module 14 —
   don't collapse the two into one page just because they look similar
   at a glance.
   ========================================================================== */

const ERP_GOODS_RECEIPT_KEY = "erp_goods_receipts";

const ERP_GOODS_RECEIPT_STATUSES = ["Draft", "Logged", "Cancelled"];

const ERP_GoodsReceiptRepository = {
  statuses: ERP_GOODS_RECEIPT_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_GOODS_RECEIPT_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_GOODS_RECEIPT_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((r) => r.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((r) => r.id === id) || null;
  },

  nextReceiptCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((r) => {
      const match = /-GR-(\d+)$/.exec(r.receiptCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-GR-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(receipt) {
    return receipt.status === "Draft";
  },

  canDelete(receipt) {
    return receipt.status === "Draft" || receipt.status === "Cancelled";
  },

  /** Every schedule id currently claimed by a non-Cancelled receipt in
      this company. */
  getLinkedScheduleIds(companyId, excludeReceiptId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((r) => {
      if (r.id === excludeReceiptId || r.status === "Cancelled") return;
      if (r.linkedScheduleId) ids.add(r.linkedScheduleId);
    });
    return ids;
  },

  /** Finalized delivery schedules not already claimed by another
      receipt — the pool the "log a receipt against a schedule" picker
      offers. */
  getAvailableFinalizedSchedulesForCompany(companyId, excludeReceiptId) {
    if (typeof ERP_DeliveryScheduleRepository === "undefined") return [];
    const claimed = this.getLinkedScheduleIds(companyId, excludeReceiptId);
    return ERP_DeliveryScheduleRepository.getAllForCompany(companyId)
      .filter((s) => s.status === "Finalized" && !claimed.has(s.id));
  },

  /** The retrofit hook for Delivery Schedule's own Detail modal. */
  findReceiptForSchedule(companyId, scheduleId) {
    return this.getAllForCompany(companyId).find((r) =>
      r.status !== "Cancelled" && r.linkedScheduleId === scheduleId
    ) || null;
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "GR-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      receiptCode: this.nextReceiptCode(company),
      linkedScheduleId: null,
      receivedByEmployeeId: null,
      receivedWarehouseId: null,
      receivedDate: null,
      receiptLines: [],
      notes: "",
      status: "Draft",
      loggedAt: null, loggedByUsername: null,
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
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Logged. No approval gate — see file header. */
  logReceipt(id, actorUsername) {
    return this.update(id, { status: "Logged", loggedAt: new Date().toISOString(), loggedByUsername: actorUsername });
  },

  /** Logged -> Draft, to correct a mistake. */
  reopen(id) {
    return this.update(id, { status: "Draft", loggedAt: null, loggedByUsername: null });
  },

  /** Draft/Logged -> Cancelled. */
  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  /** Refuses for anything but Draft/Cancelled — see canDelete(). */
  remove(id) {
    const receipt = this.findById(id);
    if (!receipt || !this.canDelete(receipt)) return false;
    const all = this.getAll().filter((r) => r.id !== id);
    this._saveAll(all);
    return true;
  }
};
