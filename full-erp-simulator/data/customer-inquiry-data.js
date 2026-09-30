/* =============================================================================
   DOT ERP
   FILE:  data/customer-inquiry-data.js
   ROLE:  Data-access layer for Customer Inquiry — Phase 5, Module 01, the
          FIRST Sales module. Section 10 of CONTINUE_HERE.md calls this the
          sales mirror of Department Need (Phase 4, Module 01): both are a
          soft, low-commitment starting signal that a later module builds a
          real document from. Read this header for where that mirror holds
          and — more importantly — where it deliberately DOESN'T, because
          Section 10 was explicit that symmetry is a starting point to test,
          not a guarantee to copy blindly.

   WHERE THE MIRROR BREAKS: NO APPROVAL GATE, AND WHY THAT'S CORRECT —
   Department Need models an INTERNAL request: a department asking the
   company to spend money, which is exactly the kind of thing a manager
   needs to authorize before it goes further. A Customer Inquiry is the
   opposite direction — a signal arriving from OUTSIDE the company. Nobody
   internally needs to "approve" that a customer asked a question; there is
   no spend being authorized, no budget being committed. What actually
   happens in a real sales pipeline is TRIAGE, not authorization: has anyone
   picked this up yet, and did it turn into real business or not. That's a
   genuinely different kind of five-state shape from Department Need's
   Draft/Submitted/Approved/Rejected/Cancelled — same cardinality (five
   states), different meaning entirely: New/In Progress/Converted/Lost/
   Cancelled is a PIPELINE PROGRESSION, not a permission gate. Worth
   recording as its own (7th) shape in CONTINUE_HERE.md Section 9's
   catalog once this phase's own conventions get written up.

   THE FIVE STATES, AND WHY EACH TRANSITION EXISTS:
   New (default on create, nobody has worked it yet) -> In Progress
   (someone is actively following up — see the assignment gate below) ->
   either Converted (this inquiry became — or is becoming — a Quotation:
   real success) or Lost (pursued, didn't convert — a lostReason is
   required, the same "capture the why" discipline as Department Need's
   own rejectionReason). Cancelled is a genuine sixth exit reachable from
   New or In Progress, for the same reason Department Need keeps Cancelled
   distinct from Rejected: Lost means someone genuinely worked the inquiry
   and it didn't pan out; Cancelled means the inquiry itself was invalid or
   withdrawn (a duplicate entry, a customer who called back to say never
   mind) before that judgment was ever reached. Converted and Cancelled are
   both terminal, same as Approved/Cancelled are terminal in Department
   Need. Lost can be reopened back to In Progress (reopen()) — a customer
   who goes quiet can genuinely come back — mirroring Department Need's own
   Rejected -> Draft reopen()for exactly the same "don't lose the history,
   let the SAME record continue" reason.

   THE ASSIGNMENT GATE — A GENUINELY NEW KIND OF REQUIREMENT:
   assignedToEmployeeId may be set at creation (a rep might already know
   they're taking this lead) but is not required until startFollowUp() —
   the page validates this, the same division of responsibility as every
   other module's form-level vs. repository-level validation split. This
   is a deliberately different shape from Department Need's
   requestedByEmployeeId (required up front, always) because the real-world
   fact is different: an inquiry can legitimately sit unowned in a shared
   queue for a while (New), but nobody should be shown as "working" a lead
   that has no owner.

   EDIT / DELETE GATES — SAME SHAPE, DIFFERENT SETTLING POINT:
   canEdit(): New only, the same "only the pre-commitment state is freely
   editable" rule as Department Need's Draft-only edit — returnToNew() is
   this module's withdraw() equivalent, for the same "pull it back before
   editing" reason. canDelete(): New/Lost/Cancelled, refusing In Progress
   (someone is actively relying on this record right now) and Converted
   (a decision already happened) — cancel() first, same as everywhere else
   in this codebase.

   CUSTOMER, NOT A FREE-TEXT PROSPECT NAME — A DOCUMENTED SIMPLIFICATION:
   customerId is REQUIRED and always resolves to an existing Customer
   Master record — the same "name a real master record, don't accept free
   text" discipline Department Need applies to requestedByEmployeeId. A
   real CRM would also support inquiries from not-yet-onboarded prospects
   (a "Lead" concept distinct from "Customer"), logging a name/phone/email
   before any formal customer account exists. This simulator deliberately
   doesn't build that distinction — Customer Master (data/customer-data.js)
   already exists from Phase 3 and, per CONTINUE_HERE.md Section 10, has
   sat completely unused by any transactional module until now. Creating a
   lightweight Customer Master record first is a fast, realistic on-ramp,
   not a real limitation for the teaching goal here — the same honest
   trade-off Invoice Verification documented for "at most one invoice per
   PO."

   TWO FIELDS WITH NO PROCUREMENT EQUIVALENT AT ALL —
   source (fixed vocabulary: Phone/Email/Website/Walk-in/Referral/Trade
   Show/Other, looped into a <select> the same ".xTypes array" discipline
   as Vendor Payment's paymentMethods) tracks HOW the inquiry arrived — a
   real sales concept Procurement never needed, because a Department Need
   always arrives the same way (someone in the company raises it).
   expectedResponseDate (optional) is the customer's OWN expectation of
   when they'll hear back — not an internal deadline like Department
   Need's requiredByDate, but the same shape of field feeding the same
   kind of derived flag (see isOverdue() below). Not every Sales module
   needs to invent something Procurement never had, but this one earns
   its two new concepts honestly rather than padding the record with
   fields nothing downstream uses.

   ISOVERDUE() — SAME DERIVED-FLAG DISCIPLINE, RENAMED FOR THE DOMAIN:
   True once expectedResponseDate has passed while the inquiry is still
   New or In Progress — i.e. still sitting there past when the CUSTOMER
   expected to hear back. Scoped to those two statuses only, the exact
   same reasoning as Department Need's isOverdue(): once Converted/Lost/
   Cancelled, a decision has already been made and "overdue" stops being
   an actionable flag.

   DUPLICATE CHECK — REUSES RESOLUTION #5, NO NINTH RESOLUTION NEEDED:
   findPossibleDuplicate() is a direct reuse of Department Need's own
   non-blocking soft-nudge shape (CONTINUE_HERE.md Section 9, resolution
   #5): same customer, same wording (trimmed/case-folded), still open
   (New/In Progress) -> a field-hint warning, never a block. Two inquiries
   from the same customer about the same thing is completely plausible (a
   customer calling back, or reaching out on two channels) — a hard block
   would be actively wrong here, the identical reasoning Department Need
   used for two departments genuinely both needing "new laptops."

   ACTOR TRACKING — FIRST PHASE 5 MODULE TO DEFAULT STRAIGHT TO THE
   CENTRALIZED HELPER: inProgressByUsername/convertedByUsername/
   lostByUsername/cancelledByUsername store only the acting session
   user's username, exactly like Department Need's own *ByUsername
   fields. Unlike Department Need (written before centralization existed,
   so it kept its own local actorLabel() copy even after script.js grew
   one), this file's actorLabel() is a one-line delegate straight to
   window.ERP.actorLabel() from day one — CONTINUE_HERE.md Section 9 says
   this should be the default going into Phase 5, and there's no reason
   for a brand-new module to start as yet another local copy.

   FK SURFACE FOR QUOTATION (Phase 5 Module 2, not built yet):
   getConvertibleForCompany() below is the hook Module 2 is expected to
   read from — every Converted inquiry for this company, oldest-converted-
   first (FIFO), the exact same shape as Department Need's own
   getApprovedForCompany(). No `linkedQuotationId` field exists here yet;
   Quotation is expected to retrofit one onto this file once it exists,
   the same "defer what nothing yet blocks" discipline every retrofit in
   this codebase has followed without exception.
   ========================================================================== */

const ERP_CUSTOMER_INQUIRIES_KEY = "erp_customer_inquiries";

const ERP_INQUIRY_SOURCES = ["Phone", "Email", "Website", "Walk-in", "Referral", "Trade Show", "Other"];

/** A genuine controlled vocabulary, the same treatment Department Need's
    urgency levels and Vendor Payment's payment methods already got — five
    states, referenced by this page and (eventually) Quotation's own "is
    this inquiry still convertible" checks, earns a real shared list. */
const ERP_INQUIRY_STATUSES = ["New", "In Progress", "Converted", "Lost", "Cancelled"];

function erpInquiryTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ERP_CustomerInquiryRepository = {
  sources: ERP_INQUIRY_SOURCES,
  statuses: ERP_INQUIRY_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_CUSTOMER_INQUIRIES_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_CUSTOMER_INQUIRIES_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** Newest-raised-first — the same chronological default every Phase 4
      transactional module used, continued into Phase 5. */
  getAllForCompany(companyId) {
    return this.getAll()
      .filter((n) => n.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((n) => n.id === id) || null;
  },

  /** COMP-001-CI-01, COMP-001-CI-02, ... — same per-company, never-reused
      numbering convention every earlier module established. */
  nextInquiryCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((n) => {
      const match = /-CI-(\d+)$/.exec(n.inquiryCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-CI-${String(max + 1).padStart(2, "0")}`;
  },

  /** Only a New inquiry can be freely edited — see file header. */
  canEdit(inquiry) {
    return inquiry.status === "New";
  },

  /** New/Lost/Cancelled may be deleted outright. In Progress/Converted may
      not — cancel() the former, and a Converted record is a decision
      already made. See file header. */
  canDelete(inquiry) {
    return inquiry.status === "New" || inquiry.status === "Lost" || inquiry.status === "Cancelled";
  },

  /** True once expectedResponseDate has passed while the inquiry is still
      New or In Progress. See file header for why this is scoped exactly
      like Department Need's own isOverdue(). */
  isOverdue(inquiry, todayISO) {
    const today = todayISO || erpInquiryTodayISO();
    return !!inquiry.expectedResponseDate && inquiry.expectedResponseDate < today &&
      (inquiry.status === "New" || inquiry.status === "In Progress");
  },

  /** The FK surface hook for Phase 5 Module 2 (Quotation) — every
      Converted inquiry for this company, oldest-converted-first (FIFO).
      See file header. */
  getConvertibleForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((n) => n.status === "Converted")
      .sort((a, b) => new Date(a.convertedAt) - new Date(b.convertedAt));
  },

  /** Soft, non-blocking nudge — reuses Department Need's resolution #5
      exactly. See file header. */
  findPossibleDuplicate(companyId, customerId, inquiryDescription, excludeId) {
    const target = String(inquiryDescription || "").trim().toLowerCase();
    if (!target) return null;
    return this.getAllForCompany(companyId).find((n) =>
      n.id !== excludeId &&
      n.customerId === customerId &&
      (n.status === "New" || n.status === "In Progress") &&
      n.inquiryDescription.trim().toLowerCase() === target
    ) || null;
  },

  /** One-line delegate to the centralized window.ERP.actorLabel() — first
      Phase 5 module to default straight to it. See file header. */
  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "CI-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      inquiryCode: this.nextInquiryCode(company),
      customerId: null,
      assignedToEmployeeId: null,
      itemId: null,
      inquiryDescription: "",
      estimatedQuantity: null,
      source: "Phone",
      expectedResponseDate: null,
      status: "New",
      inProgressAt: null, inProgressByUsername: null,
      convertedAt: null, convertedByUsername: null,
      lostAt: null, lostByUsername: null, lostReason: "",
      cancelledAt: null, cancelledByUsername: null,
      createdAt: new Date().toISOString(),
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Only intended for use while still New — the calling page checks
      canEdit() first, same as every other module. */
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** New -> In Progress. The calling page is expected to validate
      assignedToEmployeeId is set first — see file header. */
  startFollowUp(id, actorUsername) {
    return this.update(id, {
      status: "In Progress",
      inProgressAt: new Date().toISOString(),
      inProgressByUsername: actorUsername
    });
  },

  /** In Progress -> New. The Department Need withdraw() equivalent —
      clears the in-progress stamp since a fresh startFollowUp() will set
      a new one. */
  returnToNew(id) {
    return this.update(id, { status: "New", inProgressAt: null, inProgressByUsername: null });
  },

  /** In Progress -> Converted. Terminal — see file header. */
  convert(id, actorUsername) {
    return this.update(id, {
      status: "Converted",
      convertedAt: new Date().toISOString(),
      convertedByUsername: actorUsername
    });
  },

  /** In Progress -> Lost. reason is required by the calling page's form,
      not re-validated here — same division of responsibility as
      Department Need's reject(). */
  markLost(id, actorUsername, reason) {
    return this.update(id, {
      status: "Lost",
      lostAt: new Date().toISOString(),
      lostByUsername: actorUsername,
      lostReason: reason || ""
    });
  },

  /** Lost -> In Progress, to continue the SAME record rather than logging
      a fresh inquiry — a customer who goes quiet can genuinely come back.
      Deliberately does not clear lostReason/lostAt/lostByUsername; the
      page only shows them while status is Lost, the same "don't show
      stale info as current" discipline as Department Need's reopen(). */
  reopen(id) {
    return this.update(id, { status: "In Progress" });
  },

  /** New or In Progress -> Cancelled. Distinct from markLost() — see file
      header for why "the inquiry itself was invalid" earns its own
      terminal state instead of collapsing into Lost. */
  cancel(id, actorUsername) {
    return this.update(id, {
      status: "Cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledByUsername: actorUsername
    });
  },

  /** Refuses for In Progress/Converted — see canDelete()/file header. */
  remove(id) {
    const inquiry = this.findById(id);
    if (!inquiry || !this.canDelete(inquiry)) return false;
    const all = this.getAll().filter((n) => n.id !== id);
    this._saveAll(all);
    return true;
  }
};
