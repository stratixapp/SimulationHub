/* =============================================================================
   DOT ERP
   FILE:  data/work-order-data.js
   ROLE:  Data-access layer for Work Order / Production Order — Phase 10,
          Module 02. Built from one Active `data/bom-data.js` record, this
          is the plan: how many units of the BOM's own finished item to
          produce, by when, from which warehouse.

   A GENUINELY NEW WORKFLOW SHAPE — CHECKED, NOT ASSUMED, PER THE ROADMAP'S
   OWN INSTRUCTION: a Work Order has a real TWO-SIDED consumption/output
   relationship (materials go IN via Material Issue, finished goods come
   OUT via Finished Goods Receipt) that neither GRN (receives only) nor
   Delivery Challan (issues only) mirrors — each of those is one-sided.
   So this file does NOT force-fit either precedent. What it actually
   resembles more closely, once you look past the surface, is Purchase
   Order's own "hub" shape (CONTINUE_HERE.md Section 9): one parent record
   that several independent downstream modules build from over time,
   without those downstream modules chaining through each other. Material
   Issue and Finished Goods Receipt both read `workOrderId` directly and
   independently — neither is built from the other.

   NOT EXCLUSIVE OVER ITS OWN BOM: unlike almost every earlier "build one
   from one" relationship in this project (a PO from a Recommended
   quotation, a GRN from a Logged receipt), a real BOM is meant to be
   reused across MANY Work Orders over time — the same item gets produced
   again and again from the same recipe. So there is no
   `getLinkedXIds`/`getAvailableXForCompany` exclusivity pair here at all;
   any Active BOM can be picked freely, every time — the same "not
   applicable, and here's why" reasoning Vendor Evaluation established
   first (rating the same vendor repeatedly is normal) and Payment
   Collection reused second (multiple follow-ups against the same invoice
   is normal).

   STATUS LIFECYCLE — Planned → In Progress → Completed, +Cancelled, NO
   REOPEN FROM EITHER TERMINAL STATE: `start()` is a deliberate, explicit
   action (not an automatic side effect of the first Material Issue) —
   keeping the two modules from silently mutating each other's own
   records mid-flight is worth one extra click, the same explicit-
   administrative-action precedent PO's own `sendToVendor()` set.
   Materials can only be issued, and finished goods only received,
   against an In Progress order — enforced by Material Issue's and
   Finished Goods Receipt's own `create()`, not duplicated here. No
   reopen from Completed or Cancelled — the same terminal-state
   immutability Purchase Closure and Sales Close both settled on for
   their own capstone modules.

   EVERY QUANTITY/COST ROLLUP BELOW IS LIVE-COMPUTED, NEVER STORED ON THE
   WORK ORDER ITSELF — the same "computed rollup, not a redundant stored
   field" discipline Item Master's own `getLiveCurrentStock()` and
   Purchase Closure's own `computeCompletionChecklist()` already
   established. `getProducedQuantity()`/`getTotalMaterialCostIssued()`/
   `getTotalCapitalizedCost()` all read `material-issue-data.js` and
   `finished-goods-receipt-data.js` fresh, every call — a Draft Material
   Issue or Finished Goods Receipt doesn't count yet, only Issued/Received
   ones do, so these numbers can never drift out of sync with what's
   actually been posted to Stock Ledger.

   `computeCompletionChecklist()` IS PURELY INFORMATIONAL, EXACTLY LIKE
   PURCHASE CLOSURE'S OWN — it never gates `complete()`. A real production
   run can legitimately close out short of its own original plan (a
   cancelled remainder, a scrap write-off handled elsewhere); this module
   trusts the person completing it to look at the full picture rather than
   hard-blocking on a shortfall.

   CANCELLATION DOES NOT REVERSE ALREADY-POSTED STOCK MOVEMENTS — NAMED
   PLAINLY, NOT HIDDEN: if a Work Order is cancelled after some Material
   Issues have already posted real OUT movements, those movements stand —
   Stock Ledger has no update()/remove() at all (see its own header), and
   a stock movement records a fact that already, physically happened.
   Recovering issued-but-unused material back into stock, if that's what
   actually happened in the real world, needs its own Stock Adjustment —
   this module doesn't attempt to infer or automate that, the same way
   Purchase Closure doesn't attempt to unwind a closed purchase's own
   downstream postings.
   ========================================================================== */

const ERP_WORK_ORDER_KEY = "erp_work_orders";
const ERP_WORK_ORDER_STATUSES = ["Planned", "In Progress", "Completed", "Cancelled"];

const ERP_WorkOrderRepository = {
  statuses: ERP_WORK_ORDER_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_WORK_ORDER_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_WORK_ORDER_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((w) => w.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((w) => w.id === id) || null;
  },

  /** WO-01, WO-02, ... per company. */
  nextWorkOrderCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((w) => {
      const match = /-WO-(\d+)$/.exec(w.workOrderCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-WO-${String(max + 1).padStart(2, "0")}`;
  },

  getInProgressForCompany(companyId) {
    return this.getAllForCompany(companyId).filter((w) => w.status === "In Progress");
  },

  /** Sum of `quantityProduced` across every non-Cancelled Finished Goods
      Receipt posted (status "Received") against this Work Order. Live,
      never stored — see file header. */
  getProducedQuantity(workOrderId) {
    if (typeof ERP_FinishedGoodsReceiptRepository === "undefined") return 0;
    return ERP_FinishedGoodsReceiptRepository.getAllForWorkOrder(workOrderId)
      .filter((r) => r.status === "Received")
      .reduce((sum, r) => sum + (Number(r.quantityProduced) || 0), 0);
  },

  /** Sum of `totalMaterialCost` across every posted (status "Issued")
      Material Issue against this Work Order — the real, actual cost
      moved into Work-in-Progress so far. */
  getTotalMaterialCostIssued(workOrderId) {
    if (typeof ERP_MaterialIssueRepository === "undefined") return 0;
    return ERP_MaterialIssueRepository.getAllForWorkOrder(workOrderId)
      .filter((m) => m.status === "Issued")
      .reduce((sum, m) => sum + (Number(m.totalMaterialCost) || 0), 0);
  },

  /** Sum of `totalCostCaptured` across every posted (status "Received")
      Finished Goods Receipt — the real cost already capitalized out of
      Work-in-Progress into Finished Goods Inventory. */
  getTotalCapitalizedCost(workOrderId) {
    if (typeof ERP_FinishedGoodsReceiptRepository === "undefined") return 0;
    return ERP_FinishedGoodsReceiptRepository.getAllForWorkOrder(workOrderId)
      .filter((r) => r.status === "Received")
      .reduce((sum, r) => sum + (Number(r.totalCostCaptured) || 0), 0);
  },

  /** What's still sitting in Work-in-Progress for this order right now —
      material issued minus what's already been capitalized as finished
      goods. Never negative in a healthy flow (capitalization can't
      exceed what was issued — see finished-goods-receipt-data.js's own
      header for the allocation math that keeps this true). */
  getRemainingWipCost(workOrderId) {
    return Math.max(0, this.getTotalMaterialCostIssued(workOrderId) - this.getTotalCapitalizedCost(workOrderId));
  },

  getRemainingPlannedQuantity(workOrder) {
    return Math.max(0, (Number(workOrder.plannedQuantity) || 0) - this.getProducedQuantity(workOrder.id));
  },

  /** Purely informational — see file header. One row per BOM component
      (required qty for the full planned batch, including scrap, vs.
      actually issued so far) plus the produced-vs-planned quantity line.
      Never gates complete(). */
  computeCompletionChecklist(companyId, workOrder) {
    const bom = typeof ERP_BomRepository !== "undefined" ? ERP_BomRepository.findById(workOrder.bomId) : null;
    const plannedQty = Number(workOrder.plannedQuantity) || 0;
    const materialRows = (bom ? bom.lines || [] : []).map((l) => {
      const requiredQty = (Number(l.quantityPerOutput) || 0) * (1 + (Number(l.scrapPercent) || 0) / 100) * plannedQty;
      const issuedQty = typeof ERP_MaterialIssueRepository !== "undefined"
        ? ERP_MaterialIssueRepository.getIssuedQuantityForComponent(workOrder.id, l.componentItemId)
        : 0;
      return { componentItemId: l.componentItemId, requiredQty, issuedQty, complete: issuedQty >= requiredQty };
    });
    const producedQty = this.getProducedQuantity(workOrder.id);
    return {
      materialRows,
      producedQty,
      plannedQty,
      productionComplete: producedQty >= plannedQty,
      totalMaterialCostIssued: this.getTotalMaterialCostIssued(workOrder.id),
      totalCapitalizedCost: this.getTotalCapitalizedCost(workOrder.id)
    };
  },

  create(company, data, actorUsername) {
    const record = {
      id: "WO-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      workOrderCode: this.nextWorkOrderCode(company),
      bomId: data.bomId,
      plannedQuantity: Number(data.plannedQuantity) || 0,
      targetCompletionDate: data.targetCompletionDate || null,
      warehouseId: data.warehouseId,
      remarks: data.remarks || "",
      status: "Planned",
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString()
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  update(id, partial, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((w) => w.id === id);
    if (idx === -1 || all[idx].status !== "Planned") return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString(), updatedByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  canStart(record) { return record.status === "Planned"; },
  start(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((w) => w.id === id);
    if (idx === -1 || !this.canStart(all[idx])) return null;
    all[idx] = { ...all[idx], status: "In Progress", startedAt: new Date().toISOString(), startedByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  canComplete(record) { return record.status === "In Progress"; },
  complete(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((w) => w.id === id);
    if (idx === -1 || !this.canComplete(all[idx])) return null;
    all[idx] = { ...all[idx], status: "Completed", completedAt: new Date().toISOString(), completedByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  canCancel(record) { return record.status === "Planned" || record.status === "In Progress"; },
  cancel(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((w) => w.id === id);
    if (idx === -1 || !this.canCancel(all[idx])) return null;
    all[idx] = { ...all[idx], status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername || "system" };
    this._saveAll(all);
    return all[idx];
  },

  /** Drafts-equivalent guard: only a Planned order (nothing posted
      against it yet) may be removed outright. */
  remove(id) {
    const all = this.getAll();
    const rec = all.find((w) => w.id === id);
    if (!rec || rec.status !== "Planned") return false;
    this._saveAll(all.filter((w) => w.id !== id));
    return true;
  }
};
