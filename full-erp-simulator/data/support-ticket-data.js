/* =============================================================================
   DOT ERP
   FILE:  data/support-ticket-data.js
   ROLE:  Data-access layer for Support Tickets / Case Management —
          Phase 14, Module 02. Post-sale customer issues.

   A GENUINELY NEW WORKFLOW SHAPE — THE 8th — AND THIS ONE EARNS IT,
   UNLIKE LEAD PIPELINE: `data/lead-data.js` (one module earlier this
   same phase) checked itself against Customer Inquiry's 7th shape and
   concluded it should SHARE it rather than add catalog noise. This
   module ran the same check and reached the opposite answer, for a
   concrete reason: Open -> In Progress -> Resolved -> Closed is not a
   pipeline progression at all. A pipeline (shape 7) has MUTUALLY
   EXCLUSIVE terminal outcomes — Converted XOR Lost — where the whole
   point is which branch you land on. A support lifecycle has ONE
   success path with a SEQUENTIAL two-stage ending: Resolved (we believe
   it's fixed) and then Closed (the customer agrees, or enough time
   passed). Those are not competing outcomes; they're consecutive
   confirmations of the same outcome, and the gap between them is where
   real support systems live. Nothing in this project's existing catalog
   has that structure. **Both answers this phase came to were arrived at
   by the same check — which is the point of running it honestly.**

   REOPEN IS A FIRST-CLASS TRANSITION, NOT AN EXCEPTION: `reopen()` moves
   Resolved -> In Progress, because "we fixed it" being wrong is a
   completely normal, expected event in support — not an error state.
   This is deliberately different from every reopen() elsewhere in this
   project (Customer Inquiry, Department Need, Lead Pipeline), which all
   reopen from a NEGATIVE terminal state (Lost/Rejected) as a recovery.
   Here the reopen is from a POSITIVE state that turned out to be
   premature, which is its own distinct thing and is why `reopenCount`
   is tracked on the record: a ticket reopened three times is a real
   signal about the quality of the fix, and throwing that history away
   would hide exactly the thing a support manager needs to see.

   CLOSED IS TERMINAL AND CANNOT BE REOPENED — a deliberate asymmetry
   with Resolved. Once a customer has confirmed closure, a NEW ticket is
   the honest record of a recurrence, not a resurrection of an old one
   (which would corrupt every resolution-time metric computed from it).
   Same "correction is a new record" principle the whole project holds.

   PRIORITY AND SEVERITY ARE TWO SEPARATE DIMENSIONS, NOT ONE FIELD —
   the roadmap said support systems "always" have a priority/severity
   dimension, and the real reason they often carry BOTH is that they
   measure different things: SEVERITY is about impact (how badly is the
   customer affected — a factual property of the problem), PRIORITY is
   about scheduling (what do we work on first — a business decision that
   weighs severity against who the customer is and what else is queued).
   A Low-severity issue for the company's largest account can genuinely
   be High priority; collapsing them into one field destroys that. This
   module models both, with priority defaulting from severity via
   `suggestPriorityFor()` — a starting point that stays freely editable,
   the same "pre-filled but meant to be overwritten" precedent Goods
   Receipt established.

   RESOLUTION TIME IS COMPUTED, NEVER STORED — hours between createdAt
   and resolvedAt, live. The same "computed rollup, not a redundant
   stored field" discipline Item Master's getLiveCurrentStock() and Work
   Order's WIP rollups already established, so it can never drift out of
   sync with the timestamps it's derived from.

   NO SLA DEADLINE ENGINE — A NAMED SCOPE CUT, NOT AN OVERSIGHT: real
   systems attach an SLA target per priority and escalate on breach. That
   needs business-hours calendars, holiday handling and an escalation
   workflow — genuinely more machinery than this simulator needs to teach
   what a ticket IS. `getAgeHours()` gives the honest raw number a person
   can judge for themselves instead of faking an SLA clock.
   ========================================================================== */

const ERP_TICKET_KEY = "erp_support_tickets";
const ERP_TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed", "Cancelled"];
const ERP_TICKET_SEVERITIES = ["Critical", "Major", "Minor", "Cosmetic"];
const ERP_TICKET_PRIORITIES = ["Urgent", "High", "Normal", "Low"];
const ERP_TICKET_CATEGORIES = ["Product Defect", "Delivery Issue", "Billing Query", "How-to / Training", "Feature Request", "Other"];

const ERP_SupportTicketRepository = {
  statuses: ERP_TICKET_STATUSES,
  severities: ERP_TICKET_SEVERITIES,
  priorities: ERP_TICKET_PRIORITIES,
  categories: ERP_TICKET_CATEGORIES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_TICKET_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_TICKET_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((t) => t.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) { return this.getAll().find((t) => t.id === id) || null; },

  getAllForCustomer(companyId, customerId) {
    return this.getAllForCompany(companyId).filter((t) => t.customerId === customerId);
  },

  nextTicketCode(company) {
    let max = 0;
    this.getAllForCompany(company.id).forEach((t) => {
      const m = /-TKT-(\d+)$/.exec(t.ticketCode || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `${company.companyCode}-TKT-${String(max + 1).padStart(2, "0")}`;
  },

  /** Severity -> suggested priority. A starting point the form pre-fills
      and the person can freely override — see file header on why the two
      are genuinely separate dimensions. */
  suggestPriorityFor(severity) {
    switch (severity) {
      case "Critical": return "Urgent";
      case "Major": return "High";
      case "Minor": return "Normal";
      default: return "Low";
    }
  },

  /** Live, never stored — see file header. */
  getAgeHours(ticket) {
    const end = ticket.resolvedAt ? new Date(ticket.resolvedAt) : new Date();
    return Math.max(0, (end - new Date(ticket.createdAt)) / 36e5);
  },
  getResolutionHours(ticket) {
    if (!ticket.resolvedAt) return null;
    return Math.max(0, (new Date(ticket.resolvedAt) - new Date(ticket.createdAt)) / 36e5);
  },

  create(company, data, actorUsername) {
    const severity = data.severity || "Minor";
    const record = {
      id: "TKT-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      ticketCode: this.nextTicketCode(company),
      customerId: data.customerId,           // a real Customer Master record — this is POST-sale
      subject: "",
      description: "",
      category: "Other",
      severity,
      priority: this.suggestPriorityFor(severity),
      assignedToEmployeeId: null,
      status: "Open",
      reopenCount: 0,
      resolutionNotes: "",
      inProgressAt: null, inProgressByUsername: null,
      resolvedAt: null, resolvedByUsername: null,
      closedAt: null, closedByUsername: null,
      cancelledAt: null, cancelledByUsername: null,
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString(),
      ...data,
      status: "Open"
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  canEdit(t) { return t.status === "Open" || t.status === "In Progress"; },
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1 || !this.canEdit(all[idx])) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  _patch(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial };
    this._saveAll(all);
    return all[idx];
  },

  canStart(t) { return t.status === "Open"; },
  start(id, actorUsername) {
    const t = this.findById(id);
    if (!t || !this.canStart(t)) return null;
    return this._patch(id, { status: "In Progress", inProgressAt: new Date().toISOString(), inProgressByUsername: actorUsername || "system" });
  },

  /** resolutionNotes required — the same "capture the why" discipline
      lostReason/rejectionReason enforce elsewhere. A resolved ticket with
      no explanation teaches the next person nothing. */
  canResolve(t) { return t.status === "In Progress"; },
  resolve(id, notes, actorUsername) {
    const t = this.findById(id);
    if (!t || !this.canResolve(t)) return null;
    return this._patch(id, { status: "Resolved", resolutionNotes: notes || "", resolvedAt: new Date().toISOString(), resolvedByUsername: actorUsername || "system" });
  },

  /** Resolved -> In Progress. A first-class transition, not an error
      path — see file header. reopenCount is deliberately preserved. */
  canReopen(t) { return t.status === "Resolved"; },
  reopen(id, actorUsername) {
    const t = this.findById(id);
    if (!t || !this.canReopen(t)) return null;
    return this._patch(id, {
      status: "In Progress",
      reopenCount: (Number(t.reopenCount) || 0) + 1,
      resolvedAt: null, resolvedByUsername: null,
      inProgressAt: new Date().toISOString(), inProgressByUsername: actorUsername || "system"
    });
  },

  canClose(t) { return t.status === "Resolved"; },
  close(id, actorUsername) {
    const t = this.findById(id);
    if (!t || !this.canClose(t)) return null;
    return this._patch(id, { status: "Closed", closedAt: new Date().toISOString(), closedByUsername: actorUsername || "system" });
  },

  canCancel(t) { return t.status === "Open" || t.status === "In Progress"; },
  cancel(id, actorUsername) {
    const t = this.findById(id);
    if (!t || !this.canCancel(t)) return null;
    return this._patch(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername || "system" });
  },

  canDelete(t) { return t.status === "Open" || t.status === "Cancelled"; },
  remove(id) {
    const t = this.findById(id);
    if (!t || !this.canDelete(t)) return false;
    this._saveAll(this.getAll().filter((x) => x.id !== id));
    return true;
  },

  /** Board metrics — all live. Average resolution time counts only
      tickets that actually reached Resolved or Closed, since an open
      ticket has no resolution time yet and including its age would
      silently drag the average toward meaninglessness. */
  getMetrics(companyId) {
    const all = this.getAllForCompany(companyId);
    const by = (s) => all.filter((t) => t.status === s).length;
    const resolved = all.filter((t) => t.resolvedAt);
    const avg = resolved.length
      ? resolved.reduce((s, t) => s + (this.getResolutionHours(t) || 0), 0) / resolved.length
      : null;
    return {
      total: all.length,
      Open: by("Open"), "In Progress": by("In Progress"),
      Resolved: by("Resolved"), Closed: by("Closed"), Cancelled: by("Cancelled"),
      openUrgent: all.filter((t) => (t.status === "Open" || t.status === "In Progress") && t.priority === "Urgent").length,
      avgResolutionHours: avg,
      reopenedCount: all.filter((t) => (Number(t.reopenCount) || 0) > 0).length
    };
  }
};
