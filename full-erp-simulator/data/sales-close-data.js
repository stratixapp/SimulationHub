/* =============================================================================
   DOT ERP
   FILE:  data/sales-close-data.js
   ROLE:  Data-access layer for Sales Close — Phase 5, Module 10, THE
          FINAL MODULE OF THE PHASE AND THE PROJECT AS ORIGINALLY SCOPED.
          Receipt recording money landed is the last real transaction in
          the whole quote-to-cash journey; this module is the ceremonial
          close of the loop — formally marking one sale's entire journey,
          from a Customer Inquiry all the way to cash received, as done.
          Read purchase-closure-data.js's header first (Phase 4, #20) —
          this module mirrors its OVERALL SHAPE closely and explicitly
          diverges from its WALK MECHANISM. Both halves of that sentence
          matter equally; neither is the whole story on its own.

   BUILT FROM ONE SALES ORDER, NOT FROM RECEIPT — the same "closing is
   about the root record's own lifecycle ending, not about any single
   downstream artifact" reasoning Purchase Closure established for the
   PO. `linkedSalesOrderId` required, exclusive (`getLinkedSalesOrder
   Ids`/`getAvailableSalesOrdersForCompany`, continuing the exclusivity
   pattern this phase used everywhere except Payment Collection). Pool
   is every non-Draft, non-Cancelled Sales Order not already claimed —
   deliberately NOT narrowed to "fully paid" or "fully dispatched" ones,
   for the exact reason Purchase Closure's own pool wasn't narrowed
   either: force-closing an incomplete sale (a partially fulfilled
   order that's being written off, a customer who backed out after
   goods shipped) is a legitimate real business action, not an error
   state to prevent.

   THE SHAPE HOLDS; THE WALK MECHANISM DOESN'T — AND THAT'S THE ACTUAL
   LESSON THIS MODULE TEACHES. Purchase Closure's own `compute
   CompletionChecklist()` was a clean, single-file linear relay: each
   stage's record was found by reading the PREVIOUS stage's own id, all
   the way from PO to Vendor Payment, because Procurement's own chain
   really is that — one continuous relay, no branching. Sales Close's
   own chain is linear only as far as Tax Invoice (Sales Order ->
   Delivery Challan via `salesOrderId` -> Tax Invoice via `challanId`).
   Past that point it's not a relay anymore — it's the hub Dispatch's
   own file header first named: Dispatch, Payment Collection, and
   Receipt all read `linkedInvoiceId` off the SAME Tax Invoice directly,
   independently, not off each other. `computeCompletionChecklist()`
   below reflects that honestly: it walks forward linearly through
   Delivery Challan and Tax Invoice, then BRANCHES three ways off the
   resolved invoice rather than continuing a single thread. Copying
   Purchase Closure's exact chain-walk code structure here — one
   variable built from the previous one, straight down — would have
   silently produced a checklist that could never show more than one of
   Dispatch/Payment Collection/Receipt as anything but "Not Started,"
   since none of them are actually each other's prerequisite.

   PAYMENT COLLECTION IS THE ONE STAGE THAT CAN'T REUSE THE SIMPLE
   "record.status === doneStatus" CHECK EVERY OTHER STAGE USES — because
   it's the one Phase 5 repository with no exclusivity (Section 9): an
   invoice can have zero, one, or many follow-up entries, none of them
   "the" record for that stage the way every other stage has exactly
   one. Its own stage status is computed from the FULL SET
   (`getAllForInvoice()`) instead of a single lookup: `"Complete"` if
   ANY follow-up ever reached `Collected`, `"In Progress"` if any exist
   at all regardless of outcome, `"Not Started"` if none do. Flagged
   `optional: true` in `.checklistStages`, the same way Quality
   Inspection was optional in Purchase Closure's own list — a sale can
   go straight from Tax Invoice to Receipt with zero collection effort
   at all if a customer simply pays on time, and that's a success story
   for the checklist to show, not a gap.

   THE CHECKLIST IS INFORMATIONAL, NOT A GATE — carried over unchanged
   from Purchase Closure. `close()` never checks it before allowing the
   transition; it exists so the person closing the sale can see the
   full picture, not so the system can block an informed decision to
   force-close anyway.

   STATUS LIFECYCLE: THE SAME SIMPLEST SHAPE IN THE PHASE, DELIBERATELY,
   copied unchanged from Purchase Closure for the same reason. `Draft ->
   Closed, +Cancelled` — no separate reopen from Closed (undoing a
   formally closed sale would mean undoing real downstream consequences,
   outside this module's own scope); Cancelled is reachable from Draft
   only, to abandon a closure record started by mistake before it's
   ever finalized. Every real decision that mattered — approving the
   order, shipping it, invoicing it, collecting for it — already
   happened in an earlier module; this one just declares the story over.
   ========================================================================== */

const ERP_SALES_CLOSE_KEY = "erp_sales_closures";

const ERP_SALES_CLOSE_STATUSES = ["Draft", "Closed", "Cancelled"];

/** The full stage list `computeCompletionChecklist()` walks, in order.
    A `.checklistStages`-style controlled array, the same discipline
    Purchase Closure's own `.checklistStages`/Vendor Evaluation's
    `.scoreCriteria` established (CONTINUE_HERE.md Section 9) — new
    stages extend this list, not a hand-written if/else chain. Smaller
    than Purchase Closure's own 8-stage list because Phase 5 simply has
    fewer total modules downstream of its own root record than Phase 4
    did (5 here vs. 8 there) — not a shortcut, a fact about the roadmap. */
const ERP_SALES_CLOSE_STAGES = [
  { key: "deliveryChallan", label: "Delivery Challan" },
  { key: "taxInvoice", label: "Tax Invoice" },
  { key: "dispatch", label: "Dispatch" },
  { key: "paymentCollection", label: "Payment Collection", optional: true },
  { key: "receipt", label: "Receipt" }
];

const ERP_SalesCloseRepository = {
  statuses: ERP_SALES_CLOSE_STATUSES,
  checklistStages: ERP_SALES_CLOSE_STAGES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_SALES_CLOSE_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_SALES_CLOSE_KEY, JSON.stringify(list)); return true; }
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

  /** COMP-001-SC-01, COMP-001-SC-02, ... */
  nextClosureCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((c) => {
      const match = /-SC-(\d+)$/.exec(c.closureCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-SC-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(c) {
    return c.status === "Draft";
  },

  canDelete(c) {
    return c.status === "Draft" || c.status === "Cancelled";
  },

  /** The whole-chain walk — see file header for why this BRANCHES past
      Tax Invoice instead of continuing a single linear relay the way
      Purchase Closure's own equivalent does. Never persisted; always
      recomputed live from whatever the five downstream Sales modules
      currently say. Each stage's `status` is "Complete", "In Progress",
      or "Not Started"; the optional Payment Collection stage still
      shows "Not Started" rather than being hidden when skipped
      entirely, so the checklist stays honest about what actually
      happened — same discipline as Purchase Closure's own Quality
      Inspection stage. */
  computeCompletionChecklist(companyId, salesOrder) {
    if (!salesOrder) return this.checklistStages.map((s) => ({ ...s, status: "Not Started" }));

    // Linear as far as the Tax Invoice — one record per stage, each
    // found from the previous stage's own id, same mechanism as
    // Purchase Closure's own chain-walk.
    const challan = typeof ERP_DeliveryChallanRepository !== "undefined"
      ? ERP_DeliveryChallanRepository.getAllForCompany(companyId).find((c) => c.status !== "Cancelled" && c.salesOrderId === salesOrder.id) : null;
    const invoice = challan && typeof ERP_TaxInvoiceRepository !== "undefined"
      ? ERP_TaxInvoiceRepository.getAllForCompany(companyId).find((i) => i.status !== "Cancelled" && i.challanId === challan.id) : null;

    // BRANCHES three ways off the same invoice from here — NOT a
    // continued relay. See file header; this is the whole point of
    // this module diverging from Purchase Closure's own mechanism.
    const dispatch = invoice && typeof ERP_DispatchRepository !== "undefined"
      ? ERP_DispatchRepository.getAllForCompany(companyId).find((d) => d.status !== "Cancelled" && d.linkedInvoiceId === invoice.id) : null;
    const paymentCollections = invoice && typeof ERP_PaymentCollectionRepository !== "undefined"
      ? ERP_PaymentCollectionRepository.getAllForInvoice(companyId, invoice.id).filter((p) => p.status !== "Cancelled") : [];
    const receipt = invoice && typeof ERP_ReceiptRepository !== "undefined"
      ? ERP_ReceiptRepository.getAllForCompany(companyId).find((r) => r.status !== "Cancelled" && r.linkedInvoiceId === invoice.id) : null;

    const recordFor = { deliveryChallan: challan, taxInvoice: invoice, dispatch, receipt };
    const doneStatusFor = { deliveryChallan: "Issued", taxInvoice: "Raised", dispatch: "Dispatched", receipt: "Received" };

    return this.checklistStages.map((stage) => {
      // Payment Collection's own aggregate rule — see file header for
      // why this can't reuse the single-record comparison below.
      if (stage.key === "paymentCollection") {
        let status = "Not Started";
        if (paymentCollections.some((p) => p.status === "Collected")) status = "Complete";
        else if (paymentCollections.length) status = "In Progress";
        return { ...stage, status };
      }
      const record = recordFor[stage.key];
      let status = "Not Started";
      if (record) status = record.status === doneStatusFor[stage.key] ? "Complete" : "In Progress";
      return { ...stage, status };
    });
  },

  getLinkedSalesOrderIds(companyId, excludeClosureId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((c) => {
      if (c.id === excludeClosureId || c.status === "Cancelled") return;
      if (c.linkedSalesOrderId) ids.add(c.linkedSalesOrderId);
    });
    return ids;
  },

  /** Every non-Draft, non-Cancelled sales order not already claimed by
      another closure — deliberately not narrowed to "fully collected"
      orders, since force-closing an incomplete sale is a legitimate
      use of this module (see file header). */
  getAvailableSalesOrdersForCompany(companyId, excludeClosureId) {
    if (typeof ERP_SalesOrderRepository === "undefined") return [];
    const claimed = this.getLinkedSalesOrderIds(companyId, excludeClosureId);
    return ERP_SalesOrderRepository.getAllForCompany(companyId)
      .filter((so) => so.status !== "Draft" && so.status !== "Cancelled" && !claimed.has(so.id));
  },

  /** The retrofit hook for Sales Order's own Detail modal — the last
      one this project adds. */
  findClosureForSalesOrder(companyId, salesOrderId) {
    return this.getAllForCompany(companyId).find((c) =>
      c.status !== "Cancelled" && c.linkedSalesOrderId === salesOrderId
    ) || null;
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "SC-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      closureCode: this.nextClosureCode(company),
      linkedSalesOrderId: null,
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
