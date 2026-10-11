/* =============================================================================
   DOT ERP
   FILE:  data/payment-collection-data.js
   ROLE:  Data-access layer for Payment Collection — Phase 5, Module 08.
          Read dispatch-data.js's header first for the "Tax Invoice is now
          a hub" context this module continues.

   REJECTED THE OBVIOUS MIRROR ON PURPOSE — NOT VENDOR PAYMENT'S SHAPE.
   CONTINUE_HERE.md Section 10 predicted, ahead of time, that Payment
   Collection and Receipt would "likely mirror Vendor Payment's shape,
   reversed." That prediction was weighed seriously and set aside: on
   the Procurement side, Vendor Payment models the company AUTHORIZING
   and EXECUTING an outbound payment — a single, deliberate financial
   act with a clear "this happened" moment. Collecting money from a
   customer isn't the mirror image of that act; it's the thing that
   happens BEFORE that moment, and it isn't a single act at all. A real
   accounts-receivable team doesn't "authorize" a customer to pay —
   they follow up. A phone call today. An email reminder next week. A
   site visit if a large invoice goes quiet. Multiple touches, over
   time, against the SAME outstanding invoice, each one its own small
   record of what happened and what was promised. That's not Vendor
   Payment's shape at all — it's much closer to Customer Inquiry's own
   shape (Phase 5, Module 01): an ongoing PIPELINE OF EFFORT, not a
   single authorization-then-execution transaction.

   SO THIS REPOSITORY REUSES CUSTOMER INQUIRY'S 5-STATE PIPELINE SHAPE —
   workflow shape (g) in CONTINUE_HERE.md Section 9 — almost field-for-
   field: `Open` (default on create, nobody has worked it yet) ->
   `In Progress` (someone is actively chasing it — the same
   `assignedToEmployeeId`-required-before-start gate Customer Inquiry
   uses) -> either `Collected` (the follow-up worked, payment came in —
   this module's own "Converted") or `Written Off` (pursued, decided
   not collectible — this module's own "Lost," with a required
   `writeOffReason`, the same "capture the why" discipline as
   `lostReason`/`rejectionReason` before it) — plus `Cancelled`, a
   genuine sixth exit for a follow-up logged in error, distinct from
   `Written Off` the same way Customer Inquiry keeps `Cancelled`
   distinct from `Lost`. `Written Off -> In Progress` (`reopen()`) is
   also carried over unchanged — a customer who goes quiet can resume
   paying; the record picks back up rather than starting a new one.

   NOT EXCLUSIVE — A DELIBERATE, DIFFERENT CALL FROM EVERY "BUILT FROM
   EXACTLY ONE UPSTREAM RECORD" MODULE SINCE DELIVERY SCHEDULE. Every
   Phase 4/5 module from Delivery Schedule through Dispatch claimed its
   parent exclusively (`getLinkedXIds()`/`getAvailableXForCompany()`,
   one downstream record per upstream one). That shape assumes the
   parent is CONSUMED once claimed — a PO gets ONE delivery schedule, an
   invoice gets ONE dispatch. Collections don't work that way: the same
   invoice can and should get MULTIPLE follow-up entries over its own
   collection lifetime, each one a fresh touch, not a correction of the
   last one. This is the exact same reasoning Vendor Evaluation
   (Phase 4, Module 08) already established for rating a vendor
   multiple times — "no duplicate check, no exclusivity — multiple over
   time is the whole point," reused here unchanged rather than
   reinvented. `linkedInvoiceId` is therefore a plain foreign key, not
   an exclusivity claim: `getAllForInvoice()` returns every follow-up
   ever logged, and the picker offers every Raised invoice every time,
   the same way Vendor Evaluation's own vendor picker never excludes an
   already-evaluated vendor.

   `.collectionMethods` (Phone Call/Email/SMS/Site Visit/Legal Notice/
   Other) — the same fixed-vocabulary-earns-a-loop discipline as
   `.paymentMethods`/`.transportModes` before it.

   `promisedAmount`/`promisedDate` ARE THE "CUSTOMER SAID..." FIELDS —
   optional, because not every follow-up gets a promise (a first
   reminder email might just go unanswered), but worth their own named
   fields rather than burying them in free-text notes, since a real AR
   team tracks broken promises as their own signal (a customer who
   keeps promising and missing is a very different risk than one who
   pays on the first call).

   `assignedToEmployeeId` REUSES EMPLOYEE MASTER — THE SAME "WHO ON OUR
   SIDE IS HANDLING THIS" CONVENTION AS DISPATCH'S OWN "Dispatched By"
   AND GOODS RECEIPT'S "Received By" — with the SAME gate Customer
   Inquiry used: settable at creation, but the calling page requires it
   before `startFollowUp()`, not re-validated here (division of
   responsibility carried over unchanged).

   THE RETROFIT INTO TAX INVOICE'S DETAIL MODAL IS AN AGGREGATE, NOT A
   SINGLE LINK — because this module isn't exclusive, there's no one
   "the" linked record to show the way `findDispatchForInvoice()`
   shows one. `getLatestFollowUpForInvoice()` is the hook, mirroring
   Vendor Evaluation's own `getAverageScoreForVendor()` retrofit into
   Vendor Master (a summary stat, not a "Linked to X" row) rather than
   any exclusive module's single-link shape.
   ========================================================================== */

const ERP_PAYMENT_COLLECTION_KEY = "erp_payment_collections";

const ERP_PAYMENT_COLLECTION_STATUSES = ["Open", "In Progress", "Collected", "Written Off", "Cancelled"];

const ERP_PAYMENT_COLLECTION_METHODS = ["Phone Call", "Email", "SMS", "Site Visit", "Legal Notice", "Other"];

const ERP_PaymentCollectionRepository = {
  statuses: ERP_PAYMENT_COLLECTION_STATUSES,
  collectionMethods: ERP_PAYMENT_COLLECTION_METHODS,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_PAYMENT_COLLECTION_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_PAYMENT_COLLECTION_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((p) => p.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((p) => p.id === id) || null;
  },

  /** COMP-001-PCOL-01, COMP-001-PCOL-02, ... */
  nextCollectionCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((p) => {
      const match = /-PCOL-(\d+)$/.exec(p.collectionCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-PCOL-${String(max + 1).padStart(2, "0")}`;
  },

  /** Only Open can be freely edited — same "only the pre-commitment
      state is freely editable" rule as Customer Inquiry's own New-only. */
  canEdit(p) {
    return p.status === "Open";
  },

  /** Open/Written Off/Cancelled may be deleted outright. In Progress/
      Collected may not — cancel() the former, Collected is a decision
      already made. Mirrors Customer Inquiry's canDelete() exactly. */
  canDelete(p) {
    return p.status === "Open" || p.status === "Written Off" || p.status === "Cancelled";
  },

  /** Every follow-up ever logged against this invoice, newest first —
      NOT an exclusivity claim, a plain foreign-key read. See file
      header for why this module doesn't have a getLinked.../
      getAvailable... exclusivity pair at all. */
  getAllForInvoice(companyId, invoiceId) {
    return this.getAllForCompany(companyId)
      .filter((p) => p.linkedInvoiceId === invoiceId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /** The retrofit hook — an AGGREGATE summary (count + most recent),
      not a single link. See file header. */
  getLatestFollowUpForInvoice(companyId, invoiceId) {
    const all = this.getAllForInvoice(companyId, invoiceId);
    return all.length ? all[0] : null;
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "PCOL-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      collectionCode: this.nextCollectionCode(company),
      linkedInvoiceId: null,
      assignedToEmployeeId: null,
      followUpDate: null,
      followUpMethod: "",
      promisedAmount: null,
      promisedDate: null,
      notes: "",
      status: "Open",
      inProgressAt: null, inProgressByUsername: null,
      collectedAt: null, collectedByUsername: null,
      writtenOffAt: null, writtenOffByUsername: null, writeOffReason: "",
      cancelledAt: null, cancelledByUsername: null,
      createdAt: new Date().toISOString(),
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Only intended for use while still Open — the calling page checks
      canEdit() first, same as every other module. */
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Open -> In Progress. The calling page is expected to validate
      assignedToEmployeeId is set first — see file header. */
  startFollowUp(id, actorUsername) {
    return this.update(id, {
      status: "In Progress",
      inProgressAt: new Date().toISOString(),
      inProgressByUsername: actorUsername
    });
  },

  /** In Progress -> Open. Customer Inquiry's returnToNew() equivalent. */
  returnToOpen(id) {
    return this.update(id, { status: "Open", inProgressAt: null, inProgressByUsername: null });
  },

  /** In Progress -> Collected. Terminal, positive outcome — the follow-
      up worked. Recording an actual Receipt is a separate module (#9);
      this only marks that THIS collection effort succeeded. */
  markCollected(id, actorUsername) {
    return this.update(id, {
      status: "Collected",
      collectedAt: new Date().toISOString(),
      collectedByUsername: actorUsername
    });
  },

  /** In Progress -> Written Off. reason is required by the calling
      page's form, not re-validated here — same division of
      responsibility as Customer Inquiry's markLost(). */
  markWrittenOff(id, actorUsername, reason) {
    return this.update(id, {
      status: "Written Off",
      writtenOffAt: new Date().toISOString(),
      writtenOffByUsername: actorUsername,
      writeOffReason: reason || ""
    });
  },

  /** Written Off -> In Progress, to continue the SAME record — see file
      header. Deliberately does not clear writeOffReason/writtenOffAt/
      writtenOffByUsername; the page only shows them while status is
      Written Off, the same "don't show stale info as current"
      discipline Customer Inquiry's own reopen() established. */
  reopen(id) {
    return this.update(id, { status: "In Progress" });
  },

  /** Open or In Progress -> Cancelled. Distinct from markWrittenOff() —
      a follow-up logged in error vs. one genuinely pursued and given
      up on. Mirrors Customer Inquiry's cancel()/markLost() split. */
  cancel(id, actorUsername) {
    return this.update(id, {
      status: "Cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledByUsername: actorUsername
    });
  },

  /** Refuses for In Progress/Collected — see canDelete()/file header. */
  remove(id) {
    const p = this.findById(id);
    if (!p || !this.canDelete(p)) return false;
    const all = this.getAll().filter((rec) => rec.id !== id);
    this._saveAll(all);
    return true;
  }
};
