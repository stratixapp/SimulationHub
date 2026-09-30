/* =============================================================================
   DOT ERP
   FILE:  data/finished-goods-receipt-data.js
   ROLE:  Data-access layer for Finished Goods Receipt — Phase 10, Module
          04, the mirror event to Material Issue: a Work Order's own
          output is received INTO Stock Ledger as the finished item, at a
          computed cost. Built from one In Progress Work Order — NOT
          exclusive over it, same reasoning as Material Issue (a real
          production run can deliver output in more than one batch).

   COST = MATERIALS CONSUMED, DELIBERATELY WITH NO LABOR/OVERHEAD
   ABSORPTION IN THIS PHASE — A NAMED, DELIBERATE SCOPE CUT, NOT AN
   OVERSIGHT: the roadmap explicitly invited this call, and full overhead
   absorption accounting is genuinely complex — it needs its own Applied-
   vs-Actual-overhead variance account and a real cost-driver/absorption-
   rate concept (labor hours, machine hours) that nothing in this project
   currently tracks (Time Tracking doesn't exist until Phase 15). Rather
   than fake a shallow version of it, this module capitalizes ONLY the
   real, captured material cost that actually moved through Material
   Issue — the same "if a concept is genuinely out of scope, say so
   instead of faking it" discipline this project has held to everywhere
   else (Payroll's TDS flat estimate, GRN/Invoice Verification's assumed
   exact-match). A future phase could add a labor/overhead concept once
   Time Tracking exists to give it a real cost driver to absorb against.

   THE ALLOCATION MATH — A MOVING-AVERAGE OVER THE REMAINING PLANNED
   BATCH, THE SAME "CURRENT AVERAGE, NOT A PRECISE SLICE" HONESTY STOCK
   TRANSFER'S OWN COST CARRY-FORWARD ALREADY ESTABLISHED: this receipt's
   own cost-per-unit is
     (Work Order's remaining WIP cost) / (Work Order's remaining planned
     quantity)
   where "remaining WIP cost" is everything Material Issue has posted so
   far MINUS whatever earlier Finished Goods Receipts on this same order
   have already capitalized, and "remaining planned quantity" is the
   order's own plannedQuantity minus whatever's already been produced.
   This keeps every receipt's own unit cost anchored to real, posted
   material cost — nothing is invented — and guarantees capitalization
   can never exceed what was actually issued (see work-order-data.js's
   own `getRemainingWipCost()`). NAMED LIMITATION, THE SAME WAY GRN/
   INVOICE VERIFICATION'S OWN ASSUMED-EXACT-MATCH SIMPLIFICATION IS NAMED
   IN gl-posting-data.js: this is an AVERAGE across the whole remaining
   run, not an exact per-batch trace — if material is issued in a ratio
   that doesn't match the BOM, or far out of step with what's actually
   been produced so far, a single receipt's own rate can over- or under-
   capitalize slightly. A real standard-costing system would tie that gap
   to its own variance account; this project doesn't model one here, the
   same way it doesn't model GRN/Invoice Verification's own price
   variance.

   quantityProduced DEFAULTS TO THE ORDER'S REMAINING PLANNED QUANTITY,
   GENUINELY MEANT TO BE OVERWRITTEN — Goods Receipt's own precedent
   again: an actual production run can under- or over-produce against
   its own plan, and this module doesn't assume the plan was followed
   exactly.

   STOCK LEDGER ENTRY: an INCOMING movement, so — unlike Material Issue's
   own OUT entries — `unitCost` IS stored directly on the Stock Ledger
   entry itself, the standard "captured fact on an incoming entry" shape
   every other receiving module in this project already follows.

   Draft → Received → Cancelled (Cancelled only from Draft) — identical
   shape and identical reasoning to Material Issue's own header: Stock
   Ledger has no update()/remove(), so a correction after Received means
   a new, separate document, not a rewrite here.
   ========================================================================== */

const ERP_FGR_KEY = "erp_finished_goods_receipts";
const ERP_FGR_STATUSES = ["Draft", "Received", "Cancelled"];

const ERP_FinishedGoodsReceiptRepository = {
  statuses: ERP_FGR_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_FGR_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_FGR_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((r) => r.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((r) => r.id === id) || null;
  },

  getAllForWorkOrder(workOrderId) {
    return this.getAll().filter((r) => r.workOrderId === workOrderId);
  },

  /** FGR-01, FGR-02, ... per company. */
  nextReceiptCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((r) => {
      const match = /-FGR-(\d+)$/.exec(r.receiptCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-FGR-${String(max + 1).padStart(2, "0")}`;
  },

  /** Suggested default for the create form — the order's own remaining
      planned quantity. See file header: genuinely meant to be
      overwritten, not locked. */
  suggestedQuantity(workOrder) {
    if (typeof ERP_WorkOrderRepository === "undefined") return 0;
    return ERP_WorkOrderRepository.getRemainingPlannedQuantity(workOrder);
  },

  /** The allocation math — see file header. Returns the cost-per-unit
      this receipt would capitalize at RIGHT NOW, before it's saved (used
      by the create form to preview the total). */
  previewCostPerUnit(workOrder) {
    if (typeof ERP_WorkOrderRepository === "undefined") return 0;
    const remainingWip = ERP_WorkOrderRepository.getRemainingWipCost(workOrder.id);
    const remainingQty = ERP_WorkOrderRepository.getRemainingPlannedQuantity(workOrder);
    if (remainingQty > 0) return remainingWip / remainingQty;
    // Nothing planned remains (already at/over plan) — fall back to the
    // order's own overall average rate so far, rather than a hard zero
    // that would silently under-capitalize an over-produced batch.
    const produced = ERP_WorkOrderRepository.getProducedQuantity(workOrder.id);
    const capitalized = ERP_WorkOrderRepository.getTotalCapitalizedCost(workOrder.id);
    const issued = ERP_WorkOrderRepository.getTotalMaterialCostIssued(workOrder.id);
    return produced > 0 ? (issued > 0 ? (issued - capitalized) / Math.max(1, produced) : 0) : 0;
  },

  create(company, workOrder, data, actorUsername) {
    const record = {
      id: "FGR-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      receiptCode: this.nextReceiptCode(company),
      workOrderId: workOrder.id,
      finishedItemId: (typeof ERP_BomRepository !== "undefined" && ERP_BomRepository.findById(workOrder.bomId)) ? ERP_BomRepository.findById(workOrder.bomId).finishedItemId : null,
      warehouseId: workOrder.warehouseId,
      receiptDate: data.receiptDate || new Date().toISOString().slice(0, 10),
      receivedByEmployeeId: data.receivedByEmployeeId || null,
      quantityProduced: Number(data.quantityProduced) || 0,
      remarks: data.remarks || "",
      status: "Draft",
      unitCostCaptured: 0,
      totalCostCaptured: 0,
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString()
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  canPost(record) { return record.status === "Draft" && Number(record.quantityProduced) > 0; },

  /** The ONLY place a Finished Goods Receipt writes to Stock Ledger.
      Computes and stamps the real cost-per-unit at THIS moment (the
      allocation math — see file header), then records one incoming
      movement. Never throws. Returns { success, record, reason? }. */
  post(id, company, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1 || !this.canPost(all[idx])) return { success: false, reason: "This receipt can't be posted." };
    const record = all[idx];
    const workOrder = typeof ERP_WorkOrderRepository !== "undefined" ? ERP_WorkOrderRepository.findById(record.workOrderId) : null;
    if (!workOrder) return { success: false, reason: "Linked Work Order not found." };

    const unitCost = this.previewCostPerUnit(workOrder);
    const totalCost = unitCost * record.quantityProduced;

    if (typeof ERP_StockLedgerRepository !== "undefined" && record.finishedItemId) {
      ERP_StockLedgerRepository.recordMovement(company, {
        itemId: record.finishedItemId,
        warehouseId: record.warehouseId,
        transactionDate: record.receiptDate,
        transactionType: "Finished Goods Receipt",
        quantity: Math.abs(record.quantityProduced), // IN
        unitCost,
        referenceType: "Work Order",
        referenceId: record.workOrderId,
        narration: `Finished goods receipt ${record.receiptCode}`
      }, actorUsername);
    }

    all[idx] = {
      ...record,
      status: "Received",
      unitCostCaptured: unitCost,
      totalCostCaptured: totalCost,
      postedAt: new Date().toISOString(),
      postedByUsername: actorUsername || "system"
    };
    this._saveAll(all);
    return { success: true, record: all[idx] };
  },

  canCancel(record) { return record.status === "Draft"; },
  cancel(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1 || !this.canCancel(all[idx])) return null;
    all[idx] = { ...all[idx], status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  remove(id) {
    const all = this.getAll();
    const rec = all.find((r) => r.id === id);
    if (!rec || rec.status !== "Draft") return false;
    this._saveAll(all.filter((r) => r.id !== id));
    return true;
  }
};
