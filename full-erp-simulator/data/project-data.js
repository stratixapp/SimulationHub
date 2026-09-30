/* =============================================================================
   DOT ERP
   FILE:  data/project-data.js
   ROLE:  Data-access layer for Project Master — Phase 18, Module 01, the
          first module of Project Accounting. Everything else in this
          phase (Time Tracking, Milestone Billing, Project Profitability)
          hangs off what gets decided here.

   PROJECT IS A PARALLEL DIMENSION TO COST CENTER, NOT A ROLLUP INTO
   IT — the deliberate decision the roadmap's own brief asked for,
   reasoned here rather than left implicit. Checked directly in
   `cost-center-data.js` before deciding: a Cost Center is a permanent
   organizational unit (Production, R&D) that accumulates overhead
   indefinitely, with no client, no start/end date, no billing concept
   of its own — and its own `actualSpend` is a MANUALLY MAINTAINED
   figure today, not live-computed from any posting anywhere in this
   project (`costCenterId` appears in no Journal Entry or GL Posting
   code, confirmed by search, not assumed). A Project is the opposite
   shape: a temporary, bounded engagement with a client (sometimes),
   a start date, usually an end date, a project manager, and a real
   profitability question — "did THIS engagement make money" — that a
   Cost Center was never built to answer. Forcing Project through Cost
   Center's own shape would mean bolting business-facing fields onto an
   organizational master that has no room for them, the same kind of
   mismatch this project has avoided everywhere else (Purchase Return
   was built from GRN, not retrofitted onto Sales Return's own shape,
   despite the surface-level similarity).

   WHAT THIS FILE ACTUALLY DOES, GIVEN THAT DECISION: `costCenterId` is
   an OPTIONAL field on a Project — the same "store the id, look it up
   live" pattern Cost Center itself already uses for its own optional
   Department/Branch links — so a business that wants a project's costs
   to also roll into an existing cost-center report CAN link the two,
   without Project being defined IN TERMS OF Cost Center. Independent,
   but interoperable; not fence-sitting between the roadmap's own two
   offered options, but a genuine third answer built from checking what
   each master actually is before choosing.

   INTERNAL VS. CLIENT PROJECTS — `customerId` IS OPTIONAL, NOT DEFAULTED
   TO ANY VALUE. A real business runs both a paid client engagement and
   an internal initiative (an office move, a tooling upgrade) through
   the same Project concept; forcing every project to carry a customer
   would misrepresent the internal ones. `isClientProject()` is a single
   derived predicate the rest of this phase (Milestone Billing
   especially) can key off rather than re-checking `customerId` truthy
   inline everywhere.

   A RICHER LIFECYCLE THAN MOST MASTERS IN THIS PROJECT, WITH REAL GUARDED
   TRANSITIONS — unlike Cost Center's own free-form `setStatus()` (any
   status to any status, no guard, checked directly before deciding this
   needed to be different), a project's own lifecycle carries real
   meaning a trainee should learn: `Planning -> Active`, `Active <->
   On Hold` (genuinely bidirectional — a project can be paused and
   resumed, unlike Support Ticket's own strictly linear Open -> In
   Progress -> Resolved -> Closed progression), `Active` or `On Hold`
   `-> Completed`, and `Cancelled` reachable from `Planning`, `Active`,
   or `On Hold`. `Completed` and `Cancelled` are BOTH terminal — no
   status setter reopens either one, the same "immutable once concluded"
   instinct this project applies everywhere else (Journal Entry, every
   posted document). `getValidNextStatuses()` is the single source of
   truth the page's own status controls read from, so the UI can never
   offer a transition the repository itself would refuse.

   BUDGET IS A PROJECT TOTAL, NOT AN ANNUAL FIGURE — named deliberately
   differently from Cost Center's own `annualBudget` field, because a
   project's own duration is whatever the project needs, not a fiscal
   year. `actualCost` starts at zero and stays that way from THIS module
   alone — Time Tracking (Module 02) is what will actually populate it
   with real hours × a cost rate; `getVariance()` is written now, against
   whatever `actualCost` holds, so Module 02 has a stable function to
   feed rather than needing its own parallel computation later.
   ========================================================================== */

const ERP_PROJECTS_KEY = "erp_projects";

const ERP_PROJECT_STATUSES = ["Planning", "Active", "On Hold", "Completed", "Cancelled"];

const ERP_PROJECT_BILLING_TYPES = ["Fixed Price", "Time & Material", "Internal"];

/** The single source of truth for what a status can move to — see file
    header. `Completed`/`Cancelled` have no entries: both terminal. */
const ERP_PROJECT_STATUS_TRANSITIONS = {
  "Planning": ["Active", "Cancelled"],
  "Active": ["On Hold", "Completed", "Cancelled"],
  "On Hold": ["Active", "Completed", "Cancelled"],
  "Completed": [],
  "Cancelled": []
};

function erpProjTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const ERP_ProjectRepository = {
  statuses: ERP_PROJECT_STATUSES,
  billingTypes: ERP_PROJECT_BILLING_TYPES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_PROJECTS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_PROJECTS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((p) => p.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /** The pool Time Tracking (Module 02) and Milestone Billing will both
      draw their own project picker from — time can only be logged, and
      a milestone can only be billed, against a project that's genuinely
      underway. */
  getActiveForCompany(companyId) {
    return this.getAllForCompany(companyId).filter((p) => p.status === "Active" || p.status === "On Hold");
  },

  findById(id) {
    return this.getAll().find((p) => p.id === id) || null;
  },

  nextProjectCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((p) => {
      const match = /-PRJ-(\d+)$/.exec(p.projectCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-PRJ-${String(max + 1).padStart(2, "0")}`;
  },

  isClientProject(project) {
    return !!(project && project.customerId);
  },

  actorLabel(username) {
    return typeof window !== "undefined" && window.ERP && window.ERP.actorLabel
      ? window.ERP.actorLabel(username)
      : (username || "system");
  },


  /* -----------------------------------------------------------------------
     LIFECYCLE — guarded transitions, see file header
     --------------------------------------------------------------------- */

  getValidNextStatuses(project) {
    if (!project) return [];
    return ERP_PROJECT_STATUS_TRANSITIONS[project.status] || [];
  },

  canTransitionTo(project, newStatus) {
    return this.getValidNextStatuses(project).includes(newStatus);
  },

  setStatus(id, newStatus, actorUsername) {
    const project = this.findById(id);
    if (!project) return { success: false, reason: "This project no longer exists." };
    if (!this.canTransitionTo(project, newStatus)) {
      return { success: false, reason: `A project in "${project.status}" can't move directly to "${newStatus}".` };
    }
    const all = this.getAll();
    const idx = all.findIndex((p) => p.id === id);
    const partial = { status: newStatus, updatedAt: new Date().toISOString() };
    if (newStatus === "Active" && !all[idx].actualStartDate) {
      partial.actualStartDate = erpProjTodayISO();
    }
    if (newStatus === "Completed") {
      partial.completedAt = new Date().toISOString();
      partial.completedByUsername = actorUsername || "system";
    }
    if (newStatus === "Cancelled") {
      partial.cancelledAt = new Date().toISOString();
      partial.cancelledByUsername = actorUsername || "system";
    }
    all[idx] = { ...all[idx], ...partial };
    this._saveAll(all);
    return { success: true, record: all[idx] };
  },


  /* -----------------------------------------------------------------------
     BUDGET vs ACTUAL — actualCost stays 0 until Module 02 populates it
     --------------------------------------------------------------------- */

  getVariance(project) {
    const budget = Number(project.budgetAmount) || 0;
    const actual = Number(project.actualCost) || 0;
    const variance = budget - actual;
    const utilizationPct = budget > 0 ? (actual / budget) * 100 : (actual > 0 ? Infinity : 0);
    return { budget, actual, variance, utilizationPct };
  },

  getUtilizationBand(project) {
    const { utilizationPct } = this.getVariance(project);
    if (utilizationPct > 100) return "over";
    if (utilizationPct >= 80) return "near";
    return "under";
  },


  /* -----------------------------------------------------------------------
     VALIDATION
     --------------------------------------------------------------------- */

  hasDuplicateName(companyId, projectName, excludeId) {
    const target = (projectName || "").trim().toLowerCase();
    if (!target) return false;
    return this.getAllForCompany(companyId).some((p) => p.id !== excludeId && (p.projectName || "").trim().toLowerCase() === target);
  },


  /* -----------------------------------------------------------------------
     CRUD
     --------------------------------------------------------------------- */

  create(company, data, actorUsername) {
    const record = {
      id: "PRJ-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      projectCode: this.nextProjectCode(company),
      projectName: "",
      customerId: null,
      costCenterId: null,
      projectManagerId: null,
      billingType: ERP_PROJECT_BILLING_TYPES[0],
      startDate: erpProjTodayISO(),
      endDate: null,
      actualStartDate: null,
      budgetAmount: 0,
      actualCost: 0,
      description: "",
      status: "Planning",
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString(),
      updatedAt: null,
      completedAt: null, completedByUsername: null,
      cancelledAt: null, cancelledByUsername: null,
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Only Planning/Active/On Hold projects are editable — the same
      "concluded means immutable" instinct `setStatus()`'s own terminal
      states already carry. Status itself is changed only through
      `setStatus()`, never through a raw `update()`, so every transition
      is checked against the guard above and nowhere bypasses it. */
  canEdit(project) {
    return project && project.status !== "Completed" && project.status !== "Cancelled";
  },

  update(id, partial) {
    const project = this.findById(id);
    if (!project || !this.canEdit(project)) return null;
    const { status, ...safePartial } = partial; // status change only via setStatus()
    const all = this.getAll();
    const idx = all.findIndex((p) => p.id === id);
    all[idx] = { ...all[idx], ...safePartial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Only a Planning project with nothing built on it yet can be
      deleted outright — once Active, Time Tracking (Module 02) may
      already reference it, so Cancelled is the correct way to retire
      it instead, the same distinction Cost Center's own status set
      already draws between "under review" and "permanently retired." */
  canDelete(project) {
    return project && project.status === "Planning";
  },

  remove(id) {
    const project = this.findById(id);
    if (!project || !this.canDelete(project)) return false;
    this._saveAll(this.getAll().filter((p) => p.id !== id));
    return true;
  }
};
