/* =============================================================================
   DOT ERP
   FILE:  data/leave-data.js
   ROLE:  Data-access layer for Leave Application & Approval — Phase 9,
          Module 02. Genuine storage (`erp_leave_applications`) — a leave
          request is its own real fact and decision, the same reasoning
          every other genuine-storage module in this project has used.

   A REAL DECISION GATE, BUT A DIFFERENT STARTING STATE THAN THREE-WAY
   MATCHING'S OWN — checked directly, not assumed reusable as-is.
   Three-Way Matching's own shape is `Draft → Approved for Payment / On
   Hold, +Cancelled` — Draft because there's real work-in-progress before
   a match is ready to decide on. A leave application has no equivalent
   in-progress phase: it's submitted complete, by the applicant, and
   immediately awaits someone else's decision. So this file's own states
   are `Pending → Approved / Rejected, +Cancelled` — same 4-state
   CARDINALITY as Three-Way Matching, genuinely different STARTING-STATE
   semantics (waiting-on-someone-else vs. still-being-assembled). Cancel
   is available from BOTH Pending (the applicant withdraws before a
   decision) and Approved (plans changed after approval) — but not from
   Rejected, which is already terminal with nothing left to withdraw.

   WHOLE DAYS ONLY — NO HALF-DAY LEAVE: Attendance (Module 01) already
   owns "Half Day" as its own concept, for a day someone was only
   partially present. Giving Leave Application a parallel half-day notion
   would let the same partial day be described two different ways by two
   different modules. A leave request here is always whole calendar days,
   inclusive of both `fromDate` and `toDate` — a real, named simplification
   (plenty of real HRIS platforms do support half-day leave; this one
   doesn't, on purpose, to keep "which module owns a partial day" from
   ever being ambiguous).

   APPROVER IS DERIVED, NOT CHOSEN — REUSES EMPLOYEE MASTER'S OWN
   REPORTING LINE: `approverEmployeeId` is set automatically from the
   applicant's own `managerId` at the moment of application (frozen onto
   the record, the same "resolve once, freeze, don't re-derive later"
   shape Sales Order's own copied fields use) — never a field the
   applicant picks. If the applicant has no manager set in Employee
   Master (nothing above them in the reporting line — a founder, a CEO),
   `approverEmployeeId` stays null and the record displays "No manager on
   file" rather than blocking the application outright; this project has
   never gated WHO can click an Approve button on the actual logged-in
   user matching a specific employee (Order Approval and PR Approval
   don't either — there's one shared login, not per-employee accounts),
   so a missing approver is a display/audit-trail gap, not a functional
   one.

   OVERLAP IS A HARD BLOCK, NOT A DUPLICATE-CHECK CATALOG ENTRY — A
   GENUINELY NEW KIND OF VALIDATION: every numbered duplicate-check
   resolution in this project's own catalog is about two records
   describing THE SAME THING (a repeated name, a repeated line item). This
   isn't that — two overlapping leave applications for the same employee
   describe two DIFFERENT but mutually IMPOSSIBLE claims (you cannot
   physically be on leave twice over the same days). That's a harder
   business-logic conflict than any existing resolution models, so it
   hard-blocks at `create()` rather than reusing a soft-nudge shape that
   was never built for this kind of conflict. Only Pending/Approved
   applications count as a real conflict — a Rejected or Cancelled one
   never actually claimed those days.

   LEAVE BALANCE — A FIXED, NAMED, NOT-USER-CONFIGURABLE POLICY: a real
   HRIS lets a company configure its own annual entitlement per leave
   type, often prorated by tenure or accrued monthly. This file uses one
   fixed, flat annual figure per paid leave type (`ERP_LEAVE_POLICY`),
   never prorated — a deliberate, reasonable scope cut, the same spirit
   as Salary Structure's own flat Professional Tax figure (Module 03).
   Unpaid Leave deliberately has NO entry in the policy — it has no
   balance to run out of, by definition; `getLeaveBalance()` returns null
   for it rather than a fabricated number.

   `getApprovedLeaveDaysInRange()` IS THE FK-SURFACE HOOK PAYROLL (MODULE
   04) IS EXPECTED TO READ FROM — a per-date paid/unpaid lookup for
   whatever period a payroll run covers, so Payroll never has to re-walk
   this file's own date-range logic itself.
   ========================================================================== */

const ERP_LEAVE_KEY = "erp_leave_applications";

const ERP_LEAVE_TYPES = ["Casual Leave", "Sick Leave", "Earned Leave", "Unpaid Leave"];
const ERP_LEAVE_POLICY = { "Casual Leave": 12, "Sick Leave": 12, "Earned Leave": 15 }; // annual days; Unpaid Leave intentionally absent

const ERP_LeaveRepository = {
  leaveTypes: ERP_LEAVE_TYPES,
  policy: ERP_LEAVE_POLICY,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_LEAVE_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_LEAVE_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((a) => a.companyId === companyId)
      .sort((a, b) => (b.appliedAt || "").localeCompare(a.appliedAt || ""));
  },

  findById(id) {
    return this.getAll().find((a) => a.id === id) || null;
  },

  /** Inclusive whole-calendar-day count between fromDate and toDate. */
  computeNumberOfDays(fromDate, toDate) {
    if (!fromDate || !toDate) return 0;
    const start = new Date(fromDate + "T00:00:00");
    const end = new Date(toDate + "T00:00:00");
    const days = Math.round((end - start) / 86400000) + 1;
    return Math.max(0, days);
  },

  /** True if `employeeId` already has a Pending/Approved application whose
      own [fromDate, toDate] overlaps the given range — see file header
      for why this hard-blocks rather than reusing a soft-nudge
      resolution. `excludeId` lets an edit-in-place check against every
      OTHER application. */
  hasOverlap(companyId, employeeId, fromDate, toDate, excludeId) {
    return this.getAllForCompany(companyId).some((a) =>
      a.id !== excludeId &&
      a.employeeId === employeeId &&
      (a.status === "Pending" || a.status === "Approved") &&
      a.fromDate <= toDate && a.toDate >= fromDate
    );
  },

  /** Creates a Pending application. Refuses (returns null) if the dates
      overlap an existing Pending/Approved one for the same employee —
      the page is expected to check `hasOverlap()` itself first so it can
      show a clear message rather than silently getting null back. */
  create(company, data) {
    if (this.hasOverlap(company.id, data.employeeId, data.fromDate, data.toDate)) return null;

    const applicant = typeof ERP_EmployeeRepository !== "undefined" ? ERP_EmployeeRepository.findById(data.employeeId) : null;

    const record = {
      id: "LV-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      employeeId: data.employeeId,
      leaveType: data.leaveType,
      fromDate: data.fromDate,
      toDate: data.toDate,
      numberOfDays: this.computeNumberOfDays(data.fromDate, data.toDate),
      reason: data.reason || "",
      status: "Pending",
      approverEmployeeId: applicant ? applicant.managerId : null,
      appliedAt: new Date().toISOString(),
      appliedByUsername: data.appliedByUsername || "system",
      decidedAt: null,
      decidedByUsername: null,
      decisionNotes: ""
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  _update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial };
    this._saveAll(all);
    return all[idx];
  },

  approve(id, actorUsername, notes) {
    return this._update(id, { status: "Approved", decidedAt: new Date().toISOString(), decidedByUsername: actorUsername, decisionNotes: notes || "" });
  },

  reject(id, actorUsername, notes) {
    return this._update(id, { status: "Rejected", decidedAt: new Date().toISOString(), decidedByUsername: actorUsername, decisionNotes: notes || "" });
  },

  /** Available from Pending or Approved — see file header. */
  cancel(id, actorUsername) {
    const app = this.findById(id);
    if (!app || (app.status !== "Pending" && app.status !== "Approved")) return null;
    return this._update(id, { status: "Cancelled", decidedAt: new Date().toISOString(), decidedByUsername: actorUsername });
  },

  /** {entitlement, used, remaining} for a paid leave type, or null for
      Unpaid Leave (no entitlement concept — see file header). `used`
      only ever counts Approved applications; a Pending one hasn't
      consumed the balance yet, a Rejected/Cancelled one never did. Scoped
      to applications whose own `fromDate` falls in `year` — a leave
      spanning a year boundary counts entirely against the year it
      STARTS in, a deliberate simplification rather than splitting one
      application's days across two years' balances. */
  getLeaveBalance(companyId, employeeId, leaveType, year) {
    const entitlement = ERP_LEAVE_POLICY[leaveType];
    if (entitlement === undefined) return null;
    const used = this.getAllForCompany(companyId)
      .filter((a) => a.employeeId === employeeId && a.leaveType === leaveType && a.status === "Approved" && a.fromDate && a.fromDate.startsWith(String(year)))
      .reduce((sum, a) => sum + a.numberOfDays, 0);
    return { entitlement, used, remaining: entitlement - used };
  },

  /** {[dateISO]: {leaveType, isPaid}} for every calendar date in
      [fromDate, toDate] covered by an APPROVED application for
      `employeeId` — the hook Payroll (Module 04) reads directly rather
      than re-deriving this file's own overlap/range logic itself. A date
      NOT present in the returned object simply isn't on approved leave;
      Payroll falls back to Attendance (and then to "assume present") for
      those, exactly as that module's own header describes. */
  getApprovedLeaveDaysInRange(companyId, employeeId, fromDate, toDate) {
    const apps = this.getAllForCompany(companyId).filter((a) =>
      a.employeeId === employeeId && a.status === "Approved" && a.fromDate <= toDate && a.toDate >= fromDate
    );
    const result = {};
    apps.forEach((a) => {
      const start = a.fromDate > fromDate ? a.fromDate : fromDate;
      const end = a.toDate < toDate ? a.toDate : toDate;
      let cursor = new Date(start + "T00:00:00");
      const last = new Date(end + "T00:00:00");
      while (cursor <= last) {
        const iso = cursor.toISOString().slice(0, 10);
        result[iso] = { leaveType: a.leaveType, isPaid: a.leaveType !== "Unpaid Leave" };
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return result;
  }
};
