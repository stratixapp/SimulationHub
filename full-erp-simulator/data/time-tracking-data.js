/* =============================================================================
   DOT ERP
   FILE:  data/time-tracking-data.js
   ROLE:  Data-access layer for Time Tracking — Phase 18, Module 02. Read
          `attendance-data.js`'s and `leave-data.js`'s own headers first,
          the roadmap's own instruction — this file borrows one real
          idea from each and diverges from each where the real process
          genuinely differs, named at every point rather than defaulted.

   NOT AN (employeeId, date) UPSERT LIKE ATTENDANCE — checked directly
   before assuming the precedent transferred whole. Attendance owns
   exactly one fact per employee per day (were they present). A person
   doing real project work logs SEVERAL entries on the same day —
   two hours on one project in the morning, three on another after
   lunch. So this file is a genuine multi-row-per-day LOG: any number
   of entries may share one (employeeId, workDate) pair, each its own
   independent record with its own project and hours.

   A DRAFT PHASE LEAVE APPLICATION DELIBERATELY DOESN'T HAVE — checked
   directly against that file's own header, which explains why a leave
   request skips straight to `Pending` (submitted complete, in one
   sitting, nothing to leave half-done). A time entry is the opposite
   case: filled in progressively through a day or a week, genuinely
   benefiting from a save-without-submitting phase — the same
   "real work-in-progress before a decision is ready" reasoning
   Three-Way Matching's own `Draft` state already carries, cited
   directly in Leave Application's own header as the contrasting case.
   So this file's own states are `Draft -> Submitted -> Approved /
   Rejected`, with `Cancelled` reachable from `Draft` or `Submitted`.

   REJECTED IS NOT TERMINAL HERE — A DELIBERATE DIVERGENCE FROM LEAVE
   APPLICATION'S OWN REJECTED, NAMED RATHER THAN INCONSISTENT. Leave
   Application's own header states its Rejected has nothing left to
   withdraw, because a denied leave request was refused on its actual
   merits. A rejected time entry is, in real practice, overwhelmingly a
   DATA-QUALITY correction ("wrong project," "hours don't match the
   standup notes") rather than a merits decision — so `Rejected` here
   loops back to `Draft` for correction and resubmission, a genuine,
   reasoned difference between two modules that otherwise share a
   4-state cardinality.

   THE APPROVER IS DERIVED AND FROZEN AT SUBMIT, NOT AT CREATE — the
   same "resolve once, freeze" instinct Leave Application's own
   `approverEmployeeId` already uses, timed to the moment that actually
   matters: a Draft entry isn't awaiting anyone's decision yet, so
   freezing an approver at creation would be meaningless. `submit()` is
   where `approverEmployeeId` gets set, from the entry's own employee's
   current `managerId` — and, matching Leave Application's own stated
   stance exactly, a missing manager (nothing above the employee in the
   reporting line) is a display gap, not a functional block: the entry
   still submits, showing "No manager on file."

   THE HOURLY COST RATE IS DERIVED FROM SALARY STRUCTURE, NOT A NEW
   FIELD INVENTED FOR THIS MODULE — checked directly: Employee Master
   carries no salary or rate field of its own (confirmed by search), so
   inventing a fresh "hourly rate" field here would create a second,
   competing source of truth for what an employee costs, alongside
   Payroll's own real one. `getHourlyCostRate()` instead reads
   `ERP_SalaryStructureRepository.getEffectiveStructure()` — the SAME
   function Payroll itself calls — for whichever structure was actually
   in effect ON THE ENTRY'S OWN WORK DATE (not today, and not frozen at
   entry-creation time), divides that structure's own monthly
   `grossEarnings` by a named constant, `STANDARD_MONTHLY_HOURS` (208 —
   8 hours × 26 working days, a common Indian payroll convention,
   named here as exactly that: a convention, not a precise measurement
   of any one month's real working days). Resolving PER ENTRY DATE
   rather than freezing at creation means a backdated salary correction
   in Payroll is correctly reflected in an already-logged entry's own
   cost the next time it's computed — the same live-recompute-over-
   frozen-snapshot preference GSTR-1 and GSTR-3B's own output-tax
   figures already show, not a frozen figure that could silently drift
   from what Payroll itself would now say for that same date.

   AN EMPLOYEE WITH NO SALARY STRUCTURE ON FILE CONTRIBUTES HOURS BUT
   NO COST, HONESTLY FLAGGED — the identical honesty Purchase
   Register's own `taxIsEstimated` and GSTR-3B's own `pctEstimated`
   already established for "this number is incomplete, not zero by
   fact." `getActualCostForProject()` returns `pctHoursWithoutRate`
   alongside its own total, rather than silently treating a missing
   rate as ₹0 of real cost.

   PROJECT'S OWN `actualCost` FIELD IS DELIBERATELY LEFT UNWRITTEN BY
   THIS FILE — THE DECISION PROJECT MASTER'S OWN HEADER FLAGGED AS
   STILL OPEN, NOW MADE AND NAMED. `getActualCostForProject()` is a
   LIVE-COMPUTED READ, never a write-back to the Project record — the
   same "compute at report time, don't cache a figure that can drift"
   instinct GSTR-1/GSTR-3B already chose over writing settled totals
   back onto source documents. Project's own stored `actualCost` field
   stays exactly what Module 01 left it (a manually-editable figure,
   genuinely useful for non-labor costs — materials, a subcontractor
   invoice — this project has no dedicated expense-tracking module to
   own instead) rather than being overwritten by this file. Project
   Profitability (Module 04) is where the two figures — Project's own
   manual `actualCost` and this file's own live labor cost — actually
   get added together into one number; this file does not attempt that
   combination itself, staying a labor-hours-and-cost source, not a
   total-project-cost authority.

   ONLY ACTIVE OR ON HOLD PROJECTS CAN RECEIVE LOGGED TIME — reuses
   `ERP_ProjectRepository.getActiveForCompany()` directly rather than
   re-deriving the same Active-or-On-Hold pool a second time; a
   Planning project has no work yet to log against, and a Completed or
   Cancelled one is closed to new entries the same way this project
   treats every concluded document as immutable.
   ========================================================================== */

const ERP_TIME_ENTRIES_KEY = "erp_time_entries";

const ERP_TIME_ENTRY_STATUSES = ["Draft", "Submitted", "Approved", "Rejected", "Cancelled"];

/** 8 hours x 26 working days — a convention, named as exactly that; see
    file header. */
const ERP_STANDARD_MONTHLY_HOURS = 208;

const ERP_TimeTrackingRepository = {
  statuses: ERP_TIME_ENTRY_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_TIME_ENTRIES_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_TIME_ENTRIES_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((t) => t.companyId === companyId)
      .sort((a, b) => new Date(b.workDate) - new Date(a.workDate));
  },

  getAllForEmployee(companyId, employeeId) {
    return this.getAllForCompany(companyId).filter((t) => t.employeeId === employeeId);
  },

  getAllForProject(companyId, projectId) {
    return this.getAllForCompany(companyId).filter((t) => t.projectId === projectId);
  },

  findById(id) {
    return this.getAll().find((t) => t.id === id) || null;
  },

  actorLabel(username) {
    return typeof window !== "undefined" && window.ERP && window.ERP.actorLabel
      ? window.ERP.actorLabel(username)
      : (username || "system");
  },


  /* -----------------------------------------------------------------------
     HOURLY COST RATE — derived from Salary Structure, see file header
     --------------------------------------------------------------------- */

  /** Returns a number, or null if no salary structure was effective for
      this employee on this date — never silently 0. */
  getHourlyCostRate(companyId, employeeId, asOfDate) {
    if (typeof ERP_SalaryStructureRepository === "undefined") return null;
    const structure = ERP_SalaryStructureRepository.getEffectiveStructure(companyId, employeeId, asOfDate);
    if (!structure) return null;
    const figures = ERP_SalaryStructureRepository.computeFigures(structure);
    return figures.grossEarnings / ERP_STANDARD_MONTHLY_HOURS;
  },

  /** The cost this ONE entry contributes: {cost, hasCostRate}. `cost` is
      0 when no rate could be resolved — `hasCostRate` is what tells a
      caller that 0 means "unknown," not "free." */
  computeEntryCost(companyId, entry) {
    const rate = this.getHourlyCostRate(companyId, entry.employeeId, entry.workDate);
    if (rate == null) return { cost: 0, hasCostRate: false };
    return { cost: (Number(entry.hoursWorked) || 0) * rate, hasCostRate: true };
  },


  /* -----------------------------------------------------------------------
     PROJECT-FACING ROLLUPS — live-computed, see file header
     --------------------------------------------------------------------- */

  /** Every Approved entry against this project, live. {totalHours,
      billableHours, totalCost, entryCount, pctHoursWithoutRate}. */
  getActualCostForProject(companyId, projectId) {
    const entries = this.getAllForProject(companyId, projectId).filter((t) => t.status === "Approved");
    let totalHours = 0, billableHours = 0, totalCost = 0, hoursWithoutRate = 0;
    entries.forEach((entry) => {
      const hours = Number(entry.hoursWorked) || 0;
      totalHours += hours;
      if (entry.isBillable) billableHours += hours;
      const { cost, hasCostRate } = this.computeEntryCost(companyId, entry);
      totalCost += cost;
      if (!hasCostRate) hoursWithoutRate += hours;
    });
    return {
      totalHours, billableHours, totalCost, entryCount: entries.length,
      pctHoursWithoutRate: totalHours > 0 ? Math.round((hoursWithoutRate / totalHours) * 100) : 0
    };
  },


  /* -----------------------------------------------------------------------
     VALIDATION
     --------------------------------------------------------------------- */

  validateEntry(data) {
    const errors = [];
    if (!data.employeeId) errors.push("Pick who this time is being logged for.");
    if (!data.projectId) errors.push("Pick which project this time was spent on.");
    if (!data.workDate) errors.push("Pick the date this work happened.");
    const hours = Number(data.hoursWorked);
    if (!hours || hours <= 0) errors.push("Hours worked must be greater than zero.");
    if (hours > 24) errors.push("Hours worked can't exceed 24 in a single entry.");
    return { ok: errors.length === 0, errors };
  },


  /* -----------------------------------------------------------------------
     CRUD
     --------------------------------------------------------------------- */

  create(company, data, actorUsername) {
    const record = {
      id: "TE-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      employeeId: null,
      projectId: null,
      workDate: null,
      hoursWorked: 0,
      taskDescription: "",
      isBillable: true,
      status: "Draft",
      approverEmployeeId: null,
      submittedAt: null,
      decidedAt: null, decidedByUsername: null, rejectionReason: "",
      cancelledAt: null, cancelledByUsername: null,
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString(),
      updatedAt: null,
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  canEdit(entry) {
    return entry && (entry.status === "Draft");
  },

  update(id, partial) {
    const entry = this.findById(id);
    if (!entry || !this.canEdit(entry)) return null;
    const { status, ...safePartial } = partial; // status changes only via the lifecycle actions below
    const all = this.getAll();
    const idx = all.findIndex((t) => t.id === id);
    all[idx] = { ...all[idx], ...safePartial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  canDelete(entry) {
    return entry && entry.status === "Draft";
  },

  remove(id) {
    const entry = this.findById(id);
    if (!entry || !this.canDelete(entry)) return false;
    this._saveAll(this.getAll().filter((t) => t.id !== id));
    return true;
  },


  /* -----------------------------------------------------------------------
     LIFECYCLE
     --------------------------------------------------------------------- */

  /** Draft -> Submitted. Freezes the approver here, not at create() —
      see file header for why this specific moment. */
  submit(id, actorUsername) {
    const entry = this.findById(id);
    if (!entry) return { success: false, reason: "This time entry no longer exists." };
    if (entry.status !== "Draft") return { success: false, reason: "Only a Draft entry can be submitted." };
    const check = this.validateEntry(entry);
    if (!check.ok) return { success: false, reason: check.errors[0] };

    const employee = typeof ERP_EmployeeRepository !== "undefined" ? ERP_EmployeeRepository.findById(entry.employeeId) : null;
    const approverEmployeeId = employee ? employee.managerId || null : null;

    const all = this.getAll();
    const idx = all.findIndex((t) => t.id === id);
    all[idx] = { ...all[idx], status: "Submitted", approverEmployeeId, submittedAt: new Date().toISOString() };
    this._saveAll(all);
    return { success: true, record: all[idx] };
  },

  approve(id, actorUsername) {
    const entry = this.findById(id);
    if (!entry) return { success: false, reason: "This time entry no longer exists." };
    if (entry.status !== "Submitted") return { success: false, reason: "Only a Submitted entry can be approved." };
    const all = this.getAll();
    const idx = all.findIndex((t) => t.id === id);
    all[idx] = { ...all[idx], status: "Approved", decidedAt: new Date().toISOString(), decidedByUsername: actorUsername || "system", rejectionReason: "" };
    this._saveAll(all);
    return { success: true, record: all[idx] };
  },

  /** Submitted -> Rejected. Rejected loops back to Draft via
      resubmitForCorrection() below — see file header for why this
      differs from Leave Application's own terminal Rejected. */
  reject(id, reason, actorUsername) {
    const entry = this.findById(id);
    if (!entry) return { success: false, reason: "This time entry no longer exists." };
    if (entry.status !== "Submitted") return { success: false, reason: "Only a Submitted entry can be rejected." };
    const all = this.getAll();
    const idx = all.findIndex((t) => t.id === id);
    all[idx] = { ...all[idx], status: "Rejected", decidedAt: new Date().toISOString(), decidedByUsername: actorUsername || "system", rejectionReason: reason || "" };
    this._saveAll(all);
    return { success: true, record: all[idx] };
  },

  /** Rejected -> Draft, for correction — the loop this file's own
      header names as a deliberate divergence from Leave Application. */
  resubmitForCorrection(id) {
    const entry = this.findById(id);
    if (!entry) return { success: false, reason: "This time entry no longer exists." };
    if (entry.status !== "Rejected") return { success: false, reason: "Only a Rejected entry can be sent back for correction." };
    const all = this.getAll();
    const idx = all.findIndex((t) => t.id === id);
    all[idx] = { ...all[idx], status: "Draft", approverEmployeeId: null, submittedAt: null, decidedAt: null, decidedByUsername: null };
    this._saveAll(all);
    return { success: true, record: all[idx] };
  },

  canCancel(entry) {
    return entry && (entry.status === "Draft" || entry.status === "Submitted");
  },

  cancel(id, actorUsername) {
    const entry = this.findById(id);
    if (!entry || !this.canCancel(entry)) return { success: false, reason: "Only a Draft or Submitted entry can be cancelled." };
    const all = this.getAll();
    const idx = all.findIndex((t) => t.id === id);
    all[idx] = { ...all[idx], status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername || "system" };
    this._saveAll(all);
    return { success: true, record: all[idx] };
  }
};
