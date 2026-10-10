/* =============================================================================
   DOT ERP
   FILE:  data/po-data.js
   ROLE:  Data-access layer for Purchase Order — Phase 4, Module 09. This is
          the module where the sourcing cycle (Modules 1-8, all complete)
          turns into an actual commitment to a vendor. Read data/quotation-
          data.js's header first if you haven't — this file is built
          directly on top of its `isRecommended` / `getRecommendedQuotation-
          ForRfq()` FK-surface hook.

   THE BIG DECISION: BUILT FROM A RECOMMENDED QUOTATION, NOT FROM SCRATCH.
   A PO is the THIRD header + line-items document in this codebase (after
   Purchase Requisition and, one level lighter, Quotation Receipt's own
   `lineQuotes`). But unlike PR (which a user fills in from an optional
   Department Need) or Quotation Receipt (which prices an RFQ's existing PR
   lines), a PO doesn't invite free composition at all: it is built FROM
   exactly one Recommended quotation (`ERP_QuotationRepository`'s own
   `isRecommended` flag, Module 7's whole output), copying that vendor and
   its per-line pricing over as a STARTING POINT the buyer can still adjust
   (a final negotiated price, a trimmed quantity) before committing. This
   is why `lineItems` here is NOT freely added-to/removed-from the way PR's
   is — there is no "add a line" flow at all. The SET of lines is dictated
   entirely by which quotation the PO is built from; the whole array is
   replaced together via `update()`, the same shape `quotation-data.js`
   already uses for `lineQuotes` (not PR's per-line `addLineItem`/
   `updateLineItem`/`removeLineItem` CRUD, which only makes sense when a
   user is composing the line set by hand). A consequence worth naming
   explicitly: this is why PO doesn't need its own line-level duplicate
   check (Section 9's catalog) — there's no free-form entry point for a
   duplicate to be entered THROUGH.

   `vendorId` IS ITS OWN STORED FIELD, NOT A LIVE LOOKUP THROUGH THE
   QUOTATION — deliberately mirroring `quotation-data.js`'s own `vendorId`
   (which is stored directly rather than derived from the RFQ's
   `vendorDecisions` each time). The vendor a PO is placed with is core to
   the PO's own identity, referenced constantly by every page rendering a
   row or a detail view — worth the one small denormalization at creation
   time, the same call Quotation Receipt already made one hop up the chain.

   EXCLUSIVITY, AGAIN — SAME SHAPE, THIRD USE.
   `getLinkedQuotationIds()`/`getAvailableRecommendedQuotationsForCompany()`
   mirror `pr-data.js`'s `getLinkedNeedIds()`/`getAvailableNeedsForCompany()`
   and `rfq-data.js`'s `getLinkedPrIds()`/`getAvailablePrsForCompany()`
   exactly: a live scan across this repository's own non-Cancelled records
   (Rejected still counts as "claimed" — a Rejected PO can be revised back
   to Draft via `reopen()` and continue using the SAME quotation, so
   freeing it up on rejection would be wrong; only Cancelled truly releases
   it, matching PR's own Need-exclusivity precedent exactly), always
   excluding the record currently being edited. `findPoForQuotation()` is
   the retrofit hook — Quotation Receipt's own Detail modal picks up a live
   "Linked to PO" row from it, the same "PR's Detail modal shows Linked to
   RFQ" shape one hop further down the chain.

   STATUS LIFECYCLE — RICHER THAN PR'S, AND DELIBERATELY SO.
   A PO starts on PR's own proven shape (Draft -> Submitted -> Approved /
   Rejected, +Cancelled — it's a real commitment, it needs an approval
   gate, hence Module 10, PO Approval, splitting the exact same way PR/PR
   Approval did: `approve()`/`reject()` are fully implemented below but
   never called from this module's own page). But a PO needs something PR
   never did: internal approval and the VENDOR accepting the order are two
   separate real-world events, which is exactly why the roadmap gives the
   vendor's side its own module (11, Vendor Confirmation) instead of
   folding it into PO Approval. So the lifecycle adds three more states
   PR's never needed: `Sent` (Approved -> Sent, the PO has been dispatched
   to the vendor — WIRED into this module's own page, because dispatching
   YOUR OWN approved document is an administrative action on your own
   record, not a decision about it, the same reasoning that keeps
   `cancel()` on this module's page rather than PO Approval's), and
   `Confirmed` / `Vendor Declined` (Sent -> either — `confirm()`/
   `declineByVendor()` are fully implemented below, exactly like
   `approve()`/`reject()` were for Module 10, but deliberately left UNWIRED
   here, reserved for Module 11 (Vendor Confirmation) to call once it's
   built. This is the same "build the next module's hooks now, wire them
   later" discipline PR established for PR Approval, just one module
   further ahead of where the roadmap currently is.

   TWO PHASE-3 MASTERS GET THEIR FIRST PHASE-4 FK, IN THE SAME MODULE.
   `deliveryWarehouseId` (optional -> `ERP_WarehouseRepository`) and
   `paymentTermsId` (optional -> `ERP_PaymentTermsRepository`) are both
   real fields a real PO carries (where should the vendor ship to, what
   payment terms govern this order) and both point at Phase 3 masters that
   NO Phase 4 module has referenced yet, eight modules in. Reusing them
   here rather than inventing free-text fields is the same "grep first,
   reuse the existing repository" discipline Section 2's build rules
   require — real depth earned by connecting phases the roadmap always
   intended to connect, not by adding complexity for its own sake.

   ACTOR TRACKING — THE CENTRALIZATION SECTION 9 PREDICTED.
   `actorLabel()` had been duplicated as an identical ~4-line function in
   FOUR data files by the time this module started (department-need-data.js,
   pr-data.js, rfq-data.js, quotation-data.js). Section 9 flagged "a 4th+
   instance is the trigger to centralize" — this file becoming a FIFTH copy
   is that trigger. The real implementation now lives once, in script.js's
   `window.ERP.actorLabel()`; the four existing files keep their own local
   copies untouched (they still work correctly — no reason to edit four
   already-shipped, already-validated modules just to prove a point), but
   this repository's own `actorLabel()` below is a one-line delegate to the
   shared version, kept only so every call site across the codebase still
   reads identically (`ERP_PurchaseOrderRepository.actorLabel(username)`,
   same as every earlier module). Grep `window.ERP.actorLabel` as the one
   real source of truth going forward.
   ========================================================================== */

const ERP_PO_KEY = "erp_purchase_orders";

const ERP_PO_STATUSES = [
  "Draft", "Submitted", "Approved", "Rejected", "Sent", "Confirmed", "Vendor Declined", "Cancelled"
];

const ERP_PurchaseOrderRepository = {
  statuses: ERP_PO_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_PO_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_PO_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** Newest-first — every Phase 4 repository's chronological default. */
  getAllForCompany(companyId) {
    return this.getAll()
      .filter((p) => p.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((p) => p.id === id) || null;
  },

  nextPoCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((p) => {
      const match = /-PO-(\d+)$/.exec(p.poCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-PO-${String(max + 1).padStart(2, "0")}`;
  },

  /** Only a Draft can be edited (which quotation it's built from, delivery
      details, notes) — same shape as PR's canEdit(). */
  canEdit(po) {
    return po.status === "Draft";
  },

  /** Draft/Rejected/Cancelled deletable — same shape as PR's canDelete(). */
  canDelete(po) {
    return po.status === "Draft" || po.status === "Rejected" || po.status === "Cancelled";
  },

  /** null (not 0) when a line genuinely has no price — mirrors pr-data.js's
      computeLineTotal() so a missing price is never silently treated as a
      free line. In practice every PO line starts priced (copied from the
      Received quotation it was built from), but a line COULD be blanked
      out during Draft editing, so the guard still matters. */
  computeLineTotal(line) {
    const price = line.unitPrice;
    if (price === null || price === undefined || price === "" || isNaN(Number(price))) return null;
    return Number(line.quantity) * Number(price);
  },

  computeGrandTotal(po) {
    let total = 0, pricedCount = 0;
    (po.lineItems || []).forEach((line) => {
      const t = this.computeLineTotal(line);
      if (t != null) { total += t; pricedCount++; }
    });
    return { total, pricedCount, totalCount: (po.lineItems || []).length };
  },

  /** Every quotation id currently claimed by a line item of some OTHER
      non-Cancelled PO in this company. See file header for why Rejected
      still counts as claimed. */
  getLinkedQuotationIds(companyId, excludePoId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((po) => {
      if (po.id === excludePoId || po.status === "Cancelled") return;
      if (po.linkedQuotationId) ids.add(po.linkedQuotationId);
    });
    return ids;
  },

  /** Recommended quotations not already claimed by another PO — the pool
      the "build from a recommended quotation" picker offers. */
  getAvailableRecommendedQuotationsForCompany(companyId, excludePoId) {
    if (typeof ERP_QuotationRepository === "undefined") return [];
    const claimed = this.getLinkedQuotationIds(companyId, excludePoId);
    return ERP_QuotationRepository.getAllForCompany(companyId)
      .filter((q) => q.isRecommended === true && q.status !== "Cancelled" && !claimed.has(q.id));
  },

  /** The retrofit hook for Quotation Receipt's own Detail modal — same
      shape as pr-data.js's findPrForNeed() / rfq-data.js's findRfqForPr(). */
  findPoForQuotation(companyId, quotationId) {
    return this.getAllForCompany(companyId).find((po) =>
      po.status !== "Cancelled" && po.linkedQuotationId === quotationId
    ) || null;
  },

  /** One-line delegate to the now-centralized window.ERP.actorLabel() —
      see file header. */
  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "PO-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      poCode: this.nextPoCode(company),
      linkedQuotationId: null,
      vendorId: null,
      lineItems: [],
      deliveryWarehouseId: null,
      paymentTermsId: null,
      expectedDeliveryDate: null,
      notes: "",
      status: "Draft",
      submittedAt: null, submittedByUsername: null,
      approvedAt: null, approvedByUsername: null,
      rejectedAt: null, rejectedByUsername: null, rejectionReason: "",
      sentAt: null, sentByUsername: null,
      confirmedAt: null, confirmedByUsername: null, vendorConfirmedDeliveryDate: null,
      vendorDeclinedAt: null, vendorDeclinedByUsername: null, vendorDeclineReason: "",
      cancelledAt: null, cancelledByUsername: null,
      createdAt: new Date().toISOString(),
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Header-field (and whole-lineItems-array) edits — calling page is
      expected to check canEdit() first, same division of responsibility
      as every earlier module's update(). */
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Submitted. */
  submit(id, actorUsername) {
    return this.update(id, { status: "Submitted", submittedAt: new Date().toISOString(), submittedByUsername: actorUsername });
  },

  /** Submitted -> Draft. */
  withdraw(id) {
    return this.update(id, { status: "Draft", submittedAt: null, submittedByUsername: null });
  },

  /** Submitted -> Approved. Implemented for Module 10 (PO Approval) to
      call — never wired to a button in this module's own page, exactly
      like pr-data.js's approve(). */
  approve(id, actorUsername) {
    return this.update(id, { status: "Approved", approvedAt: new Date().toISOString(), approvedByUsername: actorUsername });
  },

  /** Submitted -> Rejected. Same "implemented for Module 10, unused here"
      status as approve(). */
  reject(id, actorUsername, reason) {
    return this.update(id, {
      status: "Rejected",
      rejectedAt: new Date().toISOString(),
      rejectedByUsername: actorUsername,
      rejectionReason: reason || ""
    });
  },

  /** Rejected -> Draft, to revise and resubmit the SAME record — this
      module's own job, same reasoning as pr-data.js's reopen(). */
  reopen(id) {
    return this.update(id, { status: "Draft" });
  },

  /** Approved -> Sent. Dispatching your own approved PO to the vendor is
      an administrative action on your own document, not a decision about
      it — kept in this module's own page for the same reason cancel() is,
      see file header. */
  sendToVendor(id, actorUsername) {
    return this.update(id, { status: "Sent", sentAt: new Date().toISOString(), sentByUsername: actorUsername });
  },

  /** Sent -> Confirmed. Fully implemented, deliberately UNWIRED — reserved
      for Module 11 (Vendor Confirmation) to call once it's built. See file
      header. RETROFITTED once Module 11 actually shipped: takes the
      vendor's own promised delivery date as an optional third argument —
      real-world, a vendor confirming an order often promises a different
      date than the one originally requested (`expectedDeliveryDate`), and
      Module 12 (Delivery Schedule) needs the vendor's actual promise, not
      the buyer's original ask. Same "retrofit a shipped module's data file
      when the very next module in the same record's own lifecycle needs
      it" call RFQ/Vendor Selection and Quotation/Quotation Comparison
      already made. */
  confirm(id, actorUsername, vendorConfirmedDeliveryDate) {
    return this.update(id, {
      status: "Confirmed",
      confirmedAt: new Date().toISOString(),
      confirmedByUsername: actorUsername,
      vendorConfirmedDeliveryDate: vendorConfirmedDeliveryDate || null
    });
  },

  /** Sent -> Vendor Declined. Same "implemented for Module 11, unused
      here" status as confirm() — a distinct status from internal
      `Rejected` on purpose, so status history never confuses an internal
      approver's decision with a vendor's own. */
  declineByVendor(id, actorUsername, reason) {
    return this.update(id, {
      status: "Vendor Declined",
      vendorDeclinedAt: new Date().toISOString(),
      vendorDeclinedByUsername: actorUsername,
      vendorDeclineReason: reason || ""
    });
  },

  /** Draft/Submitted/Approved/Sent/Vendor Declined -> Cancelled. Kept in
      THIS module (not deferred to Module 10) because cancelling something
      you created is reasonable to keep with the creation/management page
      regardless of who has (or hasn't) approved, sent, or responded to it
      — the same call PR's own cancel() made. */
  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  /** Refuses for anything but Draft/Rejected/Cancelled — see canDelete(). */
  remove(id) {
    const po = this.findById(id);
    if (!po || !this.canDelete(po)) return false;
    const all = this.getAll().filter((p) => p.id !== id);
    this._saveAll(all);
    return true;
  }
};
