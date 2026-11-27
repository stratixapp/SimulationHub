/* =============================================================================
   DOT ERP
   FILE:  data/purchase-closure-data.js
   ROLE:  Data-access layer for Purchase Closure — Phase 4, Module 20, THE
          FINAL MODULE OF THE PHASE. Vendor Payment recording money moved
          is the last real transaction in the procure-to-pay chain; this
          module is the ceremonial close of the loop — formally marking
          one purchase order's entire journey, from a Department Need all
          the way to a paid vendor, as done.

   BUILT FROM ONE PURCHASE ORDER, NOT FROM VENDOR PAYMENT. Every module
   between Delivery Schedule and Vendor Payment built from whatever sat
   immediately upstream of it. This module deliberately reaches all the
   way back to the PO itself — the one record every other module in this
   entire chain ultimately traces back to — because "closing" the
   purchase is about the PO's own lifecycle ending, not about any single
   downstream artifact. `linkedPoId` required, exclusive
   (`getLinkedPoIds`/`getAvailablePosForCompany`, the twelfth and final
   instance of the exclusivity pattern this session).

   `computeCompletionChecklist()` IS THE CAPSTONE OF THE WHOLE PHASE — A
   PURE, UNSTORED COMPUTATION THAT WALKS EVERY MODULE THIS SESSION
   BUILT. Starting from the PO, it walks forward through Delivery
   Schedule, Goods Receipt, GRN, Quality Inspection (optional — not
   every GRN needs one), Invoice Verification, Three-Way Matching,
   Payment Request, and Vendor Payment, returning a `{stage, exists,
   status}` row for each. This is the same "never store what can be
   derived live" discipline Three-Way Matching's own `computeMatchLines()`
   established one third of the way through this chain, taken all the
   way to its natural conclusion: a single function that can answer "how
   far along is this purchase, really?" by asking every module that
   contributed to the answer, live, every time.

   THE CHECKLIST IS INFORMATIONAL, NOT A GATE. Closing a PO does NOT
   require every stage to show complete — a real company might
   legitimately force-close a purchase that was partially cancelled,
   partially short-shipped and written off, or otherwise never going to
   finish cleanly. `close()` never checks the checklist before allowing
   the transition; the checklist exists so the PERSON closing it can see
   the full picture and make an informed call, not so the system can
   block them from one.

   STATUS LIFECYCLE: THE SIMPLEST SHAPE IN THE ENTIRE PHASE, DELIBERATELY.
   `Draft -> Closed, +Cancelled` — no separate "Reopen" even, since
   reopening a formally closed purchase is a bigger deal than this
   module's own scope covers (it would mean actually undoing accounting
   consequences downstream, not just flipping a status flag) — Cancelled
   is available from Draft only, to abandon a closure record started by
   mistake before it's ever finalized. Every financial and quality
   decision that mattered already happened in an earlier module; this
   one just declares the story over.
   ========================================================================== */

const ERP_PURCHASE_CLOSURE_KEY = "erp_purchase_closures";

const ERP_PURCHASE_CLOSURE_STATUSES = ["Draft", "Closed", "Cancelled"];

/** The full stage list `computeCompletionChecklist()` walks, in order.
    A `.checklistStages`-style controlled array, the same "loop over an
    array instead of hardcoding N near-identical fields" discipline
    Vendor Evaluation's `.scoreCriteria` established (CONTINUE_HERE.md
    Section 9) — new stages (a future module) extend this list, not a
    hand-written if/else chain. */
const ERP_PURCHASE_CLOSURE_STAGES = [
  { key: "deliverySchedule", label: "Delivery Schedule" },
  { key: "goodsReceipt", label: "Goods Receipt" },
  { key: "grn", label: "GRN" },
  { key: "qualityInspection", label: "Quality Inspection", optional: true },
  { key: "invoiceVerification", label: "Invoice Verification" },
  { key: "threeWayMatching", label: "Three-Way Matching" },
  { key: "paymentRequest", label: "Payment Request" },
  { key: "vendorPayment", label: "Vendor Payment" }
];

const ERP_PurchaseClosureRepository = {
  statuses: ERP_PURCHASE_CLOSURE_STATUSES,
  checklistStages: ERP_PURCHASE_CLOSURE_STAGES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_PURCHASE_CLOSURE_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_PURCHASE_CLOSURE_KEY, JSON.stringify(list)); return true; }
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

  nextClosureCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((c) => {
      const match = /-CLOSE-(\d+)$/.exec(c.closureCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-CLOSE-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(c) {
    return c.status === "Draft";
  },

  canDelete(c) {
    return c.status === "Draft" || c.status === "Cancelled";
  },

  /** The whole-chain walk — see file header. Never persisted; always
      recomputed from whatever the eight downstream modules currently
      say. Each stage's `status` is "Complete", "In Progress", or "Not
      Started"; optional stages that were skipped entirely still show
      "Not Started" rather than being hidden, so the checklist is always
      honest about what actually happened. */
  computeCompletionChecklist(companyId, po) {
    if (!po) return this.checklistStages.map((s) => ({ ...s, status: "Not Started" }));

    const schedule = typeof ERP_DeliveryScheduleRepository !== "undefined"
      ? ERP_DeliveryScheduleRepository.getAllForCompany(companyId).find((s) => s.status !== "Cancelled" && s.linkedPoId === po.id) : null;
    const receipt = schedule && typeof ERP_GoodsReceiptRepository !== "undefined"
      ? ERP_GoodsReceiptRepository.getAllForCompany(companyId).find((r) => r.status !== "Cancelled" && r.linkedScheduleId === schedule.id) : null;
    const grn = receipt && typeof ERP_GrnRepository !== "undefined"
      ? ERP_GrnRepository.getAllForCompany(companyId).find((g) => g.status !== "Cancelled" && g.linkedReceiptId === receipt.id) : null;
    const inspection = grn && typeof ERP_QualityInspectionRepository !== "undefined"
      ? ERP_QualityInspectionRepository.getAllForCompany(companyId).find((q) => q.status !== "Cancelled" && q.linkedGrnId === grn.id) : null;
    const invoiceVerification = typeof ERP_InvoiceVerificationRepository !== "undefined"
      ? ERP_InvoiceVerificationRepository.getAllForCompany(companyId).find((v) => v.status !== "Cancelled" && v.linkedPoId === po.id) : null;
    const match = invoiceVerification && typeof ERP_ThreeWayMatchingRepository !== "undefined"
      ? ERP_ThreeWayMatchingRepository.getAllForCompany(companyId).find((m) => m.status !== "Cancelled" && m.linkedInvoiceVerificationId === invoiceVerification.id) : null;
    const paymentRequest = match && typeof ERP_PaymentRequestRepository !== "undefined"
      ? ERP_PaymentRequestRepository.getAllForCompany(companyId).find((p) => p.status !== "Cancelled" && p.linkedMatchId === match.id) : null;
    const vendorPayment = paymentRequest && typeof ERP_VendorPaymentRepository !== "undefined"
      ? ERP_VendorPaymentRepository.getAllForCompany(companyId).find((v) => v.status !== "Cancelled" && v.linkedRequestId === paymentRequest.id) : null;

    const recordFor = {
      deliverySchedule: schedule, goodsReceipt: receipt, grn, qualityInspection: inspection,
      invoiceVerification, threeWayMatching: match, paymentRequest, vendorPayment
    };
    const doneStatusFor = {
      deliverySchedule: "Finalized", goodsReceipt: "Logged", grn: "Posted", qualityInspection: "Completed",
      invoiceVerification: "Verified", threeWayMatching: "Approved for Payment", paymentRequest: "Approved", vendorPayment: "Paid"
    };

    return this.checklistStages.map((stage) => {
      const record = recordFor[stage.key];
      let status = "Not Started";
      if (record) status = record.status === doneStatusFor[stage.key] ? "Complete" : "In Progress";
      return { ...stage, status };
    });
  },

  getLinkedPoIds(companyId, excludeClosureId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((c) => {
      if (c.id === excludeClosureId || c.status === "Cancelled") return;
      if (c.linkedPoId) ids.add(c.linkedPoId);
    });
    return ids;
  },

  /** Every non-Draft, non-Cancelled PO not already claimed by another
      closure — deliberately not narrowed to "fully paid" POs, since
      force-closing an incomplete purchase is a legitimate use of this
      module (see file header). */
  getAvailablePosForCompany(companyId, excludeClosureId) {
    if (typeof ERP_PurchaseOrderRepository === "undefined") return [];
    const claimed = this.getLinkedPoIds(companyId, excludeClosureId);
    return ERP_PurchaseOrderRepository.getAllForCompany(companyId)
      .filter((po) => po.status !== "Draft" && po.status !== "Cancelled" && !claimed.has(po.id));
  },

  /** The retrofit hook for Purchase Order's own Detail modal — the last
      one this session adds. */
  findClosureForPo(companyId, poId) {
    return this.getAllForCompany(companyId).find((c) =>
      c.status !== "Cancelled" && c.linkedPoId === poId
    ) || null;
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "CLOSE-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      closureCode: this.nextClosureCode(company),
      linkedPoId: null,
      closureNotes: "",
      status: "Draft",
      closedAt: null, closedByUsername: null,
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
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Closed. Never gated on the checklist — see file header. */
  close(id, actorUsername) {
    return this.update(id, { status: "Closed", closedAt: new Date().toISOString(), closedByUsername: actorUsername });
  },

  /** Draft -> Cancelled only (no reopen from Closed — see file header). */
  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  remove(id) {
    const c = this.findById(id);
    if (!c || !this.canDelete(c)) return false;
    const all = this.getAll().filter((rec) => rec.id !== id);
    this._saveAll(all);
    return true;
  }
};
