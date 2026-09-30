/* =============================================================================
   DOT ERP
   FILE:  data/rfq-data.js
   ROLE:  Data-access layer for RFQ Creation — Phase 4, Module 04. An RFQ
          (Request for Quotation) is built FROM one Approved Purchase
          Requisition and sent to several invited vendors asking them to
          quote. Read data/pr-data.js's header first if you haven't.

   REQUIRED, ONE-TO-ONE LINK TO AN APPROVED PR — SAME EXCLUSIVITY SHAPE.
   Unlike a PR line's OPTIONAL link to a Department Need, an RFQ's link to
   a PR (`linkedPrId`) is REQUIRED — an RFQ only exists to get quotes on
   something the company has already approved buying. Once an Approved PR
   is claimed by an RFQ, it's reserved the same way a Need is reserved by
   a PR line (`getLinkedPrIds`/`getAvailablePrsForCompany` mirror pr-
   data.js's `getLinkedNeedIds`/`getAvailableNeedsForCompany` exactly) —
   one PR becomes one RFQ, not several, keeping the chain traceable.

   NOT EVERY WORKFLOW NEEDS AN APPROVAL GATE.
   Department Need and Purchase Requisition both moved through a 5-state
   Draft → Submitted → (Approved | Rejected) [+ Cancelled] lifecycle
   because both commit the company to something that needs sign-off. An
   RFQ commits to nothing financially — it's a request for INFORMATION.
   So its lifecycle is a genuinely simpler 4 states: Draft → Sent → Closed,
   with Cancelled as a separate early exit from Draft or Sent. No
   Approved/Rejected here, and no `approve()`/`reject()` methods — don't
   assume every Phase 4 workflow module needs the same 5-state shape PR
   established; check whether an approval decision is actually being made.

   INVITED VENDORS AS A PLAIN ARRAY OF IDS.
   `invitedVendorIds` is the simplest possible shape for "which vendors
   were asked" — no child-record complexity is needed here the way
   Purchase Requisition's line items needed one, because an invitation
   carries no per-vendor data of its own yet (that arrives with each
   vendor's own quotation, Module 6's job).

   VENDOR SELECTION (Module 5) LIVES HERE, NOT IN ITS OWN DATA FILE.
   Narrowing down which invited vendors actually proceed to quote is a
   continuation of the RFQ's own lifecycle, not a new kind of document —
   `vendorDecisions` (keyed by vendor id: `{ selected, note, decidedAt,
   decidedByUsername }`) lives directly on the RFQ record, the same "one
   repository, multiple pages" shape pr-data.js already established with
   Purchase Requisition + PR Approval. `pages/vendor-selection.html/.js`
   reads and writes this same repository; no `vendor-selection-data.js`
   exists.
   ========================================================================== */

const ERP_RFQ_KEY = "erp_rfqs";

const ERP_RFQ_STATUSES = ["Draft", "Sent", "Closed", "Cancelled"];

const ERP_RfqRepository = {
  statuses: ERP_RFQ_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_RFQ_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_RFQ_KEY, JSON.stringify(list)); return true; }
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

  nextRfqCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((r) => {
      const match = /-RFQ-(\d+)$/.exec(r.rfqCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-RFQ-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(rfq) {
    return rfq.status === "Draft";
  },

  canDelete(rfq) {
    return rfq.status === "Draft" || rfq.status === "Cancelled";
  },

  /** Record (or update) one vendor's selection decision on this RFQ.
      Available once the RFQ has been Sent — deciding who actually quotes
      only makes sense after vendors have been invited. */
  recordVendorDecision(rfqId, vendorId, selected, note, actorUsername) {
    const rfq = this.findById(rfqId);
    if (!rfq) return null;
    const decisions = { ...(rfq.vendorDecisions || {}) };
    decisions[vendorId] = {
      selected: !!selected,
      note: note || "",
      decidedAt: new Date().toISOString(),
      decidedByUsername: actorUsername
    };
    return this.update(rfqId, { vendorDecisions: decisions });
  },

  /** Invited vendor ids marked `selected: true` — the pool Quotation
      Receipt (Module 6) is expected to log quotes against. Vendors with
      no decision yet, or explicitly not selected, are excluded. */
  getSelectedVendorIds(rfq) {
    const decisions = rfq.vendorDecisions || {};
    return (rfq.invitedVendorIds || []).filter((id) => decisions[id] && decisions[id].selected === true);
  },

  /** Every PR id already claimed by another non-Cancelled RFQ. Same shape
      as pr-data.js's getLinkedNeedIds(). */
  getLinkedPrIds(companyId, excludeRfqId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((r) => {
      if (r.id === excludeRfqId || r.status === "Cancelled") return;
      if (r.linkedPrId) ids.add(r.linkedPrId);
    });
    return ids;
  },

  /** Approved PRs not already claimed by another RFQ — the pool the
      "build from an approved PR" picker offers. */
  getAvailablePrsForCompany(companyId, excludeRfqId) {
    if (typeof ERP_PurchaseRequisitionRepository === "undefined") return [];
    const claimed = this.getLinkedPrIds(companyId, excludeRfqId);
    return ERP_PurchaseRequisitionRepository.getAllForCompany(companyId)
      .filter((p) => p.status === "Approved" && !claimed.has(p.id));
  },

  /** The retrofit hook for Purchase Requisition's own Detail modal — same
      shape as pr-data.js's findPrForNeed(). */
  findRfqForPr(companyId, prId) {
    return this.getAllForCompany(companyId).find((r) =>
      r.status !== "Cancelled" && r.linkedPrId === prId
    ) || null;
  },

  actorLabel(username) {
    if (!username) return "—";
    if (typeof ERP_UserRepository === "undefined") return username;
    const user = ERP_UserRepository.findByUsername(username);
    return user ? `${user.fullName} (${user.role})` : username;
  },

  create(company, data) {
    const record = {
      id: "RFQ-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      rfqCode: this.nextRfqCode(company),
      linkedPrId: null,
      invitedVendorIds: [],
      vendorDecisions: {},
      dueDate: null,
      notes: "",
      status: "Draft",
      sentAt: null, sentByUsername: null,
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
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Sent. */
  send(id, actorUsername) {
    return this.update(id, { status: "Sent", sentAt: new Date().toISOString(), sentByUsername: actorUsername });
  },

  /** Sent -> Closed — quotes are in (or the window's over) and the RFQ is
      done being actionable. Module 7 (Quotation Comparison) reads Closed
      RFQs as its natural starting point. */
  close(id, actorUsername) {
    return this.update(id, { status: "Closed", closedAt: new Date().toISOString(), closedByUsername: actorUsername });
  },

  /** Draft/Sent -> Cancelled. */
  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  remove(id) {
    const rfq = this.findById(id);
    if (!rfq || !this.canDelete(rfq)) return false;
    const all = this.getAll().filter((r) => r.id !== id);
    this._saveAll(all);
    return true;
  }
};
