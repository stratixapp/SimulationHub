/* =============================================================================
   DOT ERP
   FILE:  data/department-need-data.js
   ROLE:  Data-access layer for Department Need — Phase 4, Module 01, the
          FIRST Procurement module and the first TRANSACTIONAL/WORKFLOW
          module in the whole simulator. Everything through Phase 3 was
          Master Data (CRUD on reference records). This is a different kind
          of thing: a record that moves through a business-process
          lifecycle, and whose end state (Approved) is what a later module
          — Purchase Requisition, Phase 4 Module 2 — will consume from.

   WHAT "DEPARTMENT NEED" IS, AND WHY IT'S ITS OWN RECORD:
   Real ERPs vary here — some call this a "Purchase Indent," some skip
   straight to a Purchase Requisition and use its own "origin" field
   instead. This simulator models it as its own lightweight record,
   deliberately, for three reasons: (1) it's genuinely the first, roughest
   step in the real process — a department says "we need something" before
   anyone has priced it, chosen a vendor, or committed budget, and
   collapsing that into PR would blur a distinction worth teaching; (2) it
   gives the workflow-status lesson (see below) a clean, single-purpose
   home instead of tangling it with PR's own eventual line-item complexity;
   (3) it's the natural anchor for PR Creation to read FROM later, the same
   "one module reaches forward and consumes an earlier one's Approved
   output" shape this codebase already uses for retrofits, just running
   forward for the first time instead of backward.

   THE WORKFLOW-STATUS LESSON — GENUINELY NEW, NOT A REACTIVATE PATTERN:
   Every Master Data status this simulator has built so far (Active/
   Inactive, Active/Blocked/Inactive, Active/On Leave/Inactive) describes
   whether a REFERENCE RECORD is currently usable, and every transition is
   reversible in either direction on demand. A Department Need's status
   describes PROGRESS THROUGH A PROCESS instead: Draft -> Submitted ->
   (Approved | Rejected), with Cancelled reachable as a genuine early-exit
   from either Draft or Submitted (different from Rejected: Rejected means
   an approver looked at it and said no; Cancelled means the need itself
   went away before anyone had to make that call — a real, common
   distinction worth its own state rather than collapsing into one). This
   is NOT freely reversible: Submitted -> Draft (withdraw) and Rejected ->
   Draft (reopen for revision) are both allowed because a document that
   hasn't been acted on yet by anyone downstream is safe to pull back, but
   there is no "reactivate" out of Approved or Cancelled — those are
   terminal in this module the way Master Data's states never were.

   TWO NEW GATES THAT DIDN'T EXIST BEFORE THIS MODULE:
   - EDIT is now status-gated, not just delete. Every Master Data record
     could be edited regardless of its Active/Inactive status. Here, only
     a Draft can be freely edited (canEdit()) — editing a Submitted record
     out from under an approver, or an Approved one after it's been acted
     on, would silently invalidate a decision someone already made. To
     edit a Submitted or Rejected need, withdraw()/reopen() it to Draft
     first, same as a real approval inbox would require.
   - DELETE is gated by the record's OWN lifecycle stage (canDelete()),
     not by another module referencing it. Every earlier delete guard in
     this codebase (Departments/Category Master's hasChildren, Bank
     Master's isLinkedByVendor) checks whether something ELSE points at
     the record. Nothing else points at a Department Need yet — PR
     Creation doesn't exist. This guard is new because deleting a
     Submitted or Approved need would erase a decision mid-process (or
     after) with no trace, the same integrity concern, but sourced from
     the record's own status field instead of a foreign key elsewhere.
     Draft/Rejected/Cancelled may be deleted; Submitted/Approved may not
     (cancel() first, which keeps the record and its trail intact).

   DUPLICATE CHECK — A FIFTH RESOLUTION, AND THE FIRST NON-BLOCKING ONE:
   Section 9's duplicate-check lesson has had four resolutions so far
   (hard-name-block; hard-different-field; soft-name+hard-other-field;
   both-fields-hard) — all of them on MASTER DATA, where a duplicate name
   really would be a mistake. A Department Need is transactional: two
   departments genuinely can both need "new laptops" in the same month,
   and that's not an error, so a hard block would be actively wrong here.
   findPossibleDuplicate() instead returns a same-department, same-wording,
   still-OPEN (Draft/Submitted) need as a soft, non-blocking NUDGE the form
   surfaces via .field-hint--warning — "you may have already raised this,"
   not "you may not raise this." This is the first duplicate check in the
   codebase that never blocks Save.

   ACTOR TRACKING — THE LIVE-RESOLVE PATTERN'S SEVENTH INSTANCE, NEW DOMAIN:
   submittedByUsername/approvedByUsername/rejectedByUsername/
   cancelledByUsername store only the acting SESSION user's username at
   each transition (the same field create-company.js's createdBy already
   established), never a copied display name — actorLabel() below resolves
   the current full name + role live via ERP_UserRepository at render time,
   the same "look it up, don't copy, so it can't go stale" shape as
   Warehouses' getEffectiveAddress() or Cost Centers' getResponsiblePerson-
   Label(), just applied to a LOGIN identity instead of a business record
   for the first time. Role-based hard permission gating (e.g. only the
   "Purchase & Sales Manager" role can approve) was deliberately considered
   and NOT built — it's a cross-cutting decision every one of Phase 4's
   remaining 19 modules would need to answer consistently, not something
   the first module should decide unilaterally. actorLabel() surfaces the
   role for realism and teaching value without enforcing anything on it.

   requestedByEmployeeId vs. actor usernames — two different meanings of
   "who": requestedByEmployeeId is a BUSINESS fact (which person in the
   org has the need — an Employee Master record, required, since a real
   indent always names a requester) resolved the normal cross-module way.
   The submitted/approved/rejected/cancelled *ByUsername fields are a
   SESSION/AUDIT fact (which login account performed the action in the
   software) — these are not assumed to be the same person, exactly like
   a manager can submit a request on a colleague's behalf in a real ERP.

   FK SURFACE FOR PR CREATION (not built yet): getApprovedForCompany()
   below is the hook Phase 4 Module 2 is expected to read from — sorted
   oldest-approved-first (FIFO), since older authorized needs should
   normally become requisitions before newer ones. No `linkedPrId` field
   exists on this record yet; PR Creation is expected to retrofit one onto
   this file the same way Bank Master retrofitted onto Vendor Master, once
   there's an actual PR record to point back from. Not building it now
   follows the same "defer what nothing yet blocks" discipline Payment
   Terms' own deferred retrofit already established.
   ========================================================================== */

const ERP_DEPARTMENT_NEEDS_KEY = "erp_department_needs";

const ERP_NEED_URGENCY_LEVELS = ["Low", "Normal", "High", "Urgent"];

/** A genuine controlled vocabulary exposed as a plain array, same rule as
    .categoryTypes/.unitTypes/etc. — but this is the first STATUS field in
    the codebase that graduates to this treatment. Two/three-state Master
    Data statuses were always small enough to hardcode straight into each
    page's own UI; five workflow states, referenced by both this page and
    (eventually) PR Creation's "is this need still available" checks, earns
    a real shared list instead. */
const ERP_NEED_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Cancelled"];

function erpNeedTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ERP_DepartmentNeedRepository = {
  urgencyLevels: ERP_NEED_URGENCY_LEVELS,
  statuses: ERP_NEED_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_DEPARTMENT_NEEDS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_DEPARTMENT_NEEDS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** Newest-raised-first — a deliberate departure from Master Data's
      alphabetical-by-name default. A transactional list is naturally read
      in the order things HAPPENED, not sorted by a name field nobody is
      scanning for; every other list in this codebase reuses this same
      chronological default going forward for Phase 4. */
  getAllForCompany(companyId) {
    return this.getAll()
      .filter((n) => n.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((n) => n.id === id) || null;
  },

  /** COMP-001-DN-01, COMP-001-DN-02, ... — same per-company, never-reused
      numbering convention every Phase 2/3 module already established. */
  nextNeedCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((n) => {
      const match = /-DN-(\d+)$/.exec(n.needCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-DN-${String(max + 1).padStart(2, "0")}`;
  },

  /** Only a Draft can be freely edited — see file header. */
  canEdit(need) {
    return need.status === "Draft";
  },

  /** Draft/Rejected/Cancelled may be deleted outright (nothing downstream
      depends on them yet). Submitted/Approved may not — cancel() them
      instead, which keeps the record and its trail intact. See file
      header for why this guard reads the record's OWN status rather than
      another module's foreign key. */
  canDelete(need) {
    return need.status === "Draft" || need.status === "Rejected" || need.status === "Cancelled";
  },

  /** True once requiredByDate has passed while the need is still sitting
      in Draft or Submitted — i.e. still waiting on someone, past when it
      was actually needed. Deliberately scoped to those two statuses only:
      once a need is Approved/Rejected/Cancelled a decision has already
      been made, so "overdue" stops being an actionable flag the same way
      Cost Centers' isExpired() stays independent of manual status but
      this derived fact is additionally scoped to where it's still useful. */
  isOverdue(need, todayISO) {
    const today = todayISO || erpNeedTodayISO();
    return !!need.requiredByDate && need.requiredByDate < today &&
      (need.status === "Draft" || need.status === "Submitted");
  },

  /** The FK surface hook for Phase 4 Module 2 (PR Creation) — every
      Approved need for this company, oldest-approved-first (FIFO). See
      file header. */
  getApprovedForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((n) => n.status === "Approved")
      .sort((a, b) => new Date(a.approvedAt) - new Date(b.approvedAt));
  },

  /** Soft, non-blocking nudge — NOT a hard duplicate block. Returns the
      first other OPEN (Draft/Submitted) need from the SAME department
      whose description matches this one exactly once both are trimmed and
      case-folded, or null. See file header for why this is the first
      duplicate check in the codebase that never blocks Save. */
  findPossibleDuplicate(companyId, departmentId, needDescription, excludeId) {
    const target = String(needDescription || "").trim().toLowerCase();
    if (!target) return null;
    return this.getAllForCompany(companyId).find((n) =>
      n.id !== excludeId &&
      n.departmentId === departmentId &&
      (n.status === "Draft" || n.status === "Submitted") &&
      n.needDescription.trim().toLowerCase() === target
    ) || null;
  },

  /** Resolves a live "Full Name (Role)" label for a stored *ByUsername
      field via ERP_UserRepository — see file header for why actor identity
      is looked up live instead of copied at the time of the action. Reads
      ERP_UserRepository defensively (falls back to the bare username if
      users.js somehow isn't loaded, or to "—" if there's no username at
      all yet). */
  actorLabel(username) {
    if (!username) return "—";
    if (typeof ERP_UserRepository === "undefined") return username;
    const user = ERP_UserRepository.findByUsername(username);
    return user ? `${user.fullName} (${user.role})` : username;
  },

  create(company, data) {
    const record = {
      id: "DN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      needCode: this.nextNeedCode(company),
      departmentId: null,
      requestedByEmployeeId: null,
      costCenterId: null,
      itemId: null,
      needDescription: "",
      estimatedQuantity: null,
      urgency: "Normal",
      requiredByDate: null,
      status: "Draft",
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

  /** Only intended for use while the need is still a Draft — the calling
      page is expected to check canEdit() first, the same way every page
      that checks a delete guard checks it before calling remove(). */
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Submitted. */
  submit(id, actorUsername) {
    return this.update(id, {
      status: "Submitted",
      submittedAt: new Date().toISOString(),
      submittedByUsername: actorUsername
    });
  },

  /** Submitted -> Draft. The raiser pulling their own request back before
      anyone has approved or rejected it — clears the submission stamp
      since a fresh Submit will set a new one. */
  withdraw(id) {
    return this.update(id, { status: "Draft", submittedAt: null, submittedByUsername: null });
  },

  /** Submitted -> Approved. */
  approve(id, actorUsername) {
    return this.update(id, {
      status: "Approved",
      approvedAt: new Date().toISOString(),
      approvedByUsername: actorUsername
    });
  },

  /** Submitted -> Rejected. reason is required by the calling page's form,
      not re-validated here (same division of responsibility as every
      other module's form-level validation vs. repository-level storage). */
  reject(id, actorUsername, reason) {
    return this.update(id, {
      status: "Rejected",
      rejectedAt: new Date().toISOString(),
      rejectedByUsername: actorUsername,
      rejectionReason: reason || ""
    });
  },

  /** Rejected -> Draft, to revise and resubmit the SAME record rather than
      creating a new one — keeps one continuous, auditable history instead
      of spawning duplicate need records for what's really one request that
      needed changes. Deliberately does not clear rejectionReason/
      rejectedAt/rejectedByUsername — they simply stop being shown once the
      status is no longer Rejected (the page renders them conditionally),
      the same "don't show stale info as current" discipline as elsewhere,
      rather than erasing history that's still useful once resubmitted. */
  reopen(id) {
    return this.update(id, { status: "Draft" });
  },

  /** Draft or Submitted -> Cancelled. Distinct from reject() — see file
      header for why "the need went away" earns its own terminal state
      instead of collapsing into Rejected. */
  cancel(id, actorUsername) {
    return this.update(id, {
      status: "Cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledByUsername: actorUsername
    });
  },

  /** Refuses for Submitted/Approved — see canDelete()/file header. */
  remove(id) {
    const need = this.findById(id);
    if (!need || !this.canDelete(need)) return false;
    const all = this.getAll().filter((n) => n.id !== id);
    this._saveAll(all);
    return true;
  }
};
