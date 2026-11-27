/* =============================================================================
   DOT ERP
   FILE:  data/pr-data.js
   ROLE:  Data-access layer for Purchase Requisition — Phase 4, Module 02,
          the module Department Need was explicitly built to feed
          (`ERP_DepartmentNeedRepository.getApprovedForCompany()`). Read
          data/department-need-data.js's header first if you haven't — this
          file assumes that context and only explains what's NEW here.

   THE BIG DECISION: LINE ITEMS, AND MANY-NEEDS-TO-ONE-PR.
   Department Need was deliberately ONE flat record — a single rough need.
   A real Purchase Requisition is a different kind of document: a HEADER
   (who's raising it, an optional preferred vendor, a target date) plus
   MULTIPLE LINE ITEMS, because real procurement consolidates — five
   departments' laptop requests become ONE requisition a vendor can quote
   on in bulk, not five separate documents. This is the first line-item
   (header + child-records) shape in the whole codebase, and it's a
   deliberate escalation, not scope creep: Purchase Order (Module 9) will
   need this exact shape too, so getting it right now means Module 9
   inherits a proven pattern instead of inventing its own.

   A line item's `departmentNeedId` is OPTIONAL, not required — real
   procurement also raises requisitions directly for routine/repeat
   purchases that never went through a formal indent. This is WHY this
   module, unlike Department Need, has only ONE hard-required anchor
   (an active Employee to raise it) instead of two — see purchase-
   requisition.js's empty-state handling.

   NEED EXCLUSIVITY — A GENUINELY NEW KIND OF CROSS-MODULE RELATIONSHIP:
   Every earlier cross-module FK in this codebase was pure "look up and
   display" (a vendor's linked bank account, an item's linked HSN code).
   This module needs something none of them did: once an Approved need is
   pulled into ANY line item of ANY non-Cancelled PR, it has to stop
   showing up as available to a DIFFERENT PR — two requisitions both
   silently fulfilling the same need is a real double-ordering risk this
   simulator should teach people to avoid. getLinkedNeedIds()/
   getAvailableNeedsForCompany() implement this as a LIVE SCAN across every
   PR's line items (excluding the PR currently being edited, so editing
   your own requisition never locks you out of your own picks), not a
   stored flag anywhere — the same "derive it, don't cache it" instinct
   behind every `getEffectiveX()` helper elsewhere, just answering an
   availability question instead of a display one for the first time.

   THE DEPARTMENT-NEED RETROFIT TURNED OUT LIGHTER THAN PLANNED:
   Department Need's own file header predicted this module would retrofit
   a stored `linkedPrId` field onto Need records. Building it, that turned
   out to be the WRONG call: `findPrForNeed(companyId, needId)` below (a
   live scan, the same shape as Bank Master's `isLinkedByVendor`) answers
   the same question without a stored field that could go stale if a line
   item is later removed or a PR deleted. **No changes were needed to
   department-need-data.js at all** — only department-need.js (the page)
   picked up a small display addition (a "Linked to PR" line in its Detail
   modal) and department-need.html picked up this file's `<script>` tag.
   Worth remembering: a plan written in one module's header is a starting
   hypothesis for the next module, not a commitment — revisit it against
   what's actually cheapest and most robust once you're building the real
   thing.

   PR APPROVAL IS DELIBERATELY NOT THIS MODULE'S JOB.
   The roadmap splits "Purchase Requisition" (create/manage, Module 2 —
   this file and its page) from "PR Approval" (Module 3, not yet built) as
   TWO separate modules, the same way it later splits Purchase Order from
   PO Approval, and GRN from Quality Inspection. Because of that, `approve()`
   and `reject()` below are fully implemented — Module 3 needs them to
   exist and work the moment it's built — but purchase-requisition.js (this
   session's page) never calls them and never renders Approve/Reject
   buttons anywhere. This is a new kind of split: **the module that CREATES
   a record doesn't own every one of its status transitions** — Draft/
   Submitted-side actions (create, edit, submit, withdraw, cancel, delete)
   belong here; the Submitted -> Approved/Rejected transition belongs to
   Module 3's own page, reading and writing the SAME repository. Don't
   assume every workflow module needs its own full Approve/Reject UI the
   way Department Need did — Department Need only got one because the
   roadmap never gave it a separate approval module.

   DUPLICATE CHECK — A SIXTH RESOLUTION, OPERATING ON A CHILD COLLECTION:
   findDuplicateLineItemByItem() is the first duplicate check in this
   codebase scoped to a PARENT record's own child collection rather than
   to the whole company's table of records — a soft nudge (not a block,
   same reasoning as Department Need's) when the same catalog item is
   added as a second line within the SAME requisition, since that's
   usually meant to be one line with a combined quantity, not two.

   ACTOR TRACKING: same live-resolve-via-username shape as Department
   Need's `actorLabel()`, duplicated here rather than factored into a
   shared helper. Two instances of a 3-line function is fine; if a THIRD
   workflow module needs the same thing, that's the signal to centralize
   it onto `window.ERP` (Section 6's existing "3+ places" rule for shared
   constants, extended to a shared function for the first time).
   ========================================================================== */

const ERP_PR_KEY = "erp_purchase_requisitions";

const ERP_PR_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Cancelled"];

const ERP_PurchaseRequisitionRepository = {
  statuses: ERP_PR_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_PR_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_PR_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** Newest-raised-first, same chronological default Department Need
      established for transactional lists. */
  getAllForCompany(companyId) {
    return this.getAll()
      .filter((p) => p.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((p) => p.id === id) || null;
  },

  nextPrCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((p) => {
      const match = /-PR-(\d+)$/.exec(p.prCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-PR-${String(max + 1).padStart(2, "0")}`;
  },

  /** Only a Draft can be edited or have its line items changed — same
      shape as Department Need's canEdit(). */
  canEdit(pr) {
    return pr.status === "Draft";
  },

  /** Draft/Rejected/Cancelled deletable; Submitted/Approved not — same
      shape as Department Need's canDelete(). */
  canDelete(pr) {
    return pr.status === "Draft" || pr.status === "Rejected" || pr.status === "Cancelled";
  },

  /** null (not "—") when there's no price yet, so callers can tell "zero
      cost" apart from "not priced yet." */
  computeLineTotal(line) {
    const price = line.estimatedUnitPrice;
    if (price === null || price === undefined || price === "" || isNaN(Number(price))) return null;
    return Number(line.quantity) * Number(price);
  },

  /** Sums only the lines that HAVE a price — `pricedCount`/`totalCount`
      let the UI say "partial estimate (2 of 5 lines priced)" instead of
      quietly understating the total as if it were complete. */
  computeGrandTotal(pr) {
    let total = 0, pricedCount = 0;
    (pr.lineItems || []).forEach((line) => {
      const t = this.computeLineTotal(line);
      if (t != null) { total += t; pricedCount++; }
    });
    return { total, pricedCount, totalCount: (pr.lineItems || []).length };
  },

  /** Every Department Need id currently claimed by a line item of some
      OTHER non-Cancelled PR in this company. See file header. */
  getLinkedNeedIds(companyId, excludePrId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((pr) => {
      if (pr.id === excludePrId || pr.status === "Cancelled") return;
      (pr.lineItems || []).forEach((line) => { if (line.departmentNeedId) ids.add(line.departmentNeedId); });
    });
    return ids;
  },

  /** Approved needs not already claimed elsewhere — the pool a line
      item's "link an approved need" picker offers. */
  getAvailableNeedsForCompany(companyId, excludePrId) {
    if (typeof ERP_DepartmentNeedRepository === "undefined") return [];
    const claimed = this.getLinkedNeedIds(companyId, excludePrId);
    return ERP_DepartmentNeedRepository.getAllForCompany(companyId)
      .filter((n) => n.status === "Approved" && !claimed.has(n.id));
  },

  /** The retrofit hook for Department Need's own Detail modal — see file
      header for why this replaced the stored-field plan. */
  findPrForNeed(companyId, needId) {
    return this.getAllForCompany(companyId).find((pr) =>
      pr.status !== "Cancelled" && (pr.lineItems || []).some((line) => line.departmentNeedId === needId)
    ) || null;
  },

  /** Soft, non-blocking — see file header. */
  findDuplicateLineItemByItem(pr, itemId, excludeLineId) {
    if (!itemId) return null;
    return (pr.lineItems || []).find((l) => l.id !== excludeLineId && l.itemId === itemId) || null;
  },

  actorLabel(username) {
    if (!username) return "—";
    if (typeof ERP_UserRepository === "undefined") return username;
    const user = ERP_UserRepository.findByUsername(username);
    return user ? `${user.fullName} (${user.role})` : username;
  },

  create(company, data) {
    const record = {
      id: "PR-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      prCode: this.nextPrCode(company),
      raisedByEmployeeId: null,
      preferredVendorId: null,
      requiredByDate: null,
      notes: "",
      status: "Draft",
      lineItems: [],
      submittedAt: null, submittedByUsername: null,
      approvedAt: null, approvedByUsername: null,
      rejectedAt: null, rejectedByUsername: null, rejectionReason: "",
      cancelledAt: null, cancelledByUsername: null,
      createdAt: new Date().toISOString(),
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Header-field edits — calling page is expected to check canEdit()
      first, same division of responsibility as Department Need's update(). */
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  addLineItem(prId, lineData) {
    const pr = this.findById(prId);
    if (!pr) return null;
    const line = {
      id: "LN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      departmentNeedId: null,
      itemId: null,
      lineDescription: "",
      quantity: 0,
      estimatedUnitPrice: null,
      ...lineData
    };
    return this.update(prId, { lineItems: (pr.lineItems || []).concat([line]) });
  },

  updateLineItem(prId, lineId, partial) {
    const pr = this.findById(prId);
    if (!pr) return null;
    const lineItems = (pr.lineItems || []).map((l) => (l.id === lineId ? { ...l, ...partial } : l));
    return this.update(prId, { lineItems });
  },

  removeLineItem(prId, lineId) {
    const pr = this.findById(prId);
    if (!pr) return null;
    return this.update(prId, { lineItems: (pr.lineItems || []).filter((l) => l.id !== lineId) });
  },

  /** Draft -> Submitted. */
  submit(id, actorUsername) {
    return this.update(id, { status: "Submitted", submittedAt: new Date().toISOString(), submittedByUsername: actorUsername });
  },

  /** Submitted -> Draft. */
  withdraw(id) {
    return this.update(id, { status: "Draft", submittedAt: null, submittedByUsername: null });
  },

  /** Submitted -> Approved. Implemented for Module 3 (PR Approval) to
      call — never wired to a button in this module's own page. See file
      header. */
  approve(id, actorUsername) {
    return this.update(id, { status: "Approved", approvedAt: new Date().toISOString(), approvedByUsername: actorUsername });
  },

  /** Submitted -> Rejected. Same "implemented for Module 3, unused here"
      status as approve(). */
  reject(id, actorUsername, reason) {
    return this.update(id, {
      status: "Rejected",
      rejectedAt: new Date().toISOString(),
      rejectedByUsername: actorUsername,
      rejectionReason: reason || ""
    });
  },

  /** Rejected -> Draft, to revise and resubmit the same record — this
      module's own job, since editing/resubmitting is a creation-side
      concern regardless of which module rejected it. */
  reopen(id) {
    return this.update(id, { status: "Draft" });
  },

  /** Draft/Submitted/Approved -> Cancelled. Kept in THIS module (not
      deferred to Module 3/9) because cancelling something you created is
      reasonable to keep with the creation/management page regardless of
      who (if anyone yet) approved it. */
  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  /** Refuses for Submitted/Approved — see canDelete(). */
  remove(id) {
    const pr = this.findById(id);
    if (!pr || !this.canDelete(pr)) return false;
    const all = this.getAll().filter((p) => p.id !== id);
    this._saveAll(all);
    return true;
  }
};
