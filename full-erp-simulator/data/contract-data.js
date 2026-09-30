/* =============================================================================
   DOT ERP
   FILE:  data/contract-data.js
   ROLE:  Data-access layer for Contract Management — Phase 14, Module 03.
          Recurring/contracted customer agreements: terms, value, and
          renewal dates, linked to Customer Master.

   STATUS IS DERIVED FROM DATES, NOT JUST STORED — REUSING COST CENTER'S
   OWN ESTABLISHED PRECEDENT RATHER THAN INVENTING ONE: `data/cost-center-
   data.js` (Phase 2) already solved exactly this problem with its
   `isExpired()` helper, whose header says the derived state layers "on
   top of whatever status is manually set — exactly like a real system."
   A contract has the same property: it can be manually Active while its
   own `endDate` has quietly passed. `getEffectiveStatus()` below returns
   the honest answer by checking the dates first, so a contract nobody
   remembered to renew shows as Expired rather than sitting there
   claiming to be Active. The stored `status` still records the
   ADMINISTRATIVE decision (Draft/Active/Terminated); the derived one
   records REALITY. Neither overwrites the other — the same two-number
   honesty (estimate vs. fact, plan vs. actual) this project has held to
   since Purchase Register's own `taxIsEstimated` flag.

   RENEWAL CREATES A NEW CONTRACT, NEVER MUTATES DATES IN PLACE — the
   single most important decision in this file. Extending `endDate` on an
   existing record would destroy the contract history: what the terms
   were last year, what the value was, when it actually changed. Real
   contract management is precisely about that history. So `renew()`
   creates a NEW contract carrying forward the terms (freely editable
   before saving), links it back via `renewedFromContractId`, and marks
   the old one Renewed — a terminal state distinct from Expired (nobody
   renewed it) and Terminated (someone ended it early, with a reason).
   Three genuinely different endings that a single "Closed" would
   flatten into one, the same Cancelled-vs-Lost distinction Customer
   Inquiry draws for the same reason.

   NOT EXCLUSIVE OVER ITS OWN CUSTOMER, DELIBERATELY: a customer can hold
   several concurrent contracts (an AMC on one product line, a supply
   agreement on another) — so there is no exclusivity pair here. But
   OVERLAPPING DATE RANGES for the same customer are surfaced as a SOFT
   WARNING (`findOverlappingContract()`, resolution #5's shape), never a
   hard block: overlap is usually a data-entry mistake but genuinely
   might not be, and the system cannot know which. This is deliberately
   NOT Leave Application's hard-blocked overlap check — a leave overlap is
   a structurally impossible claim (one person can't be on two leaves at
   once), whereas two concurrent contracts with one customer is an
   entirely real business arrangement.

   AUTO-RENEWAL IS A FLAG, NOT AN ENGINE — A NAMED SCOPE CUT: real systems
   can auto-generate the renewal on the due date. That needs a scheduler
   this offline simulator has no way to run (the same absence Phase 8's
   snapshot mechanism already worked around). `autoRenew` is stored and
   surfaced in the renewal-due list as an intent, and a person still
   clicks Renew — honest about what the tool actually does rather than
   implying a background job exists.

   NO GL POSTING, DELIBERATELY — the same boundary Asset Register drew in
   Phase 12: a contract is an AGREEMENT, not a transaction. Revenue is
   recognized when Tax Invoice actually raises one, which already posts
   to the books through its own Phase 6 retrofit. Posting contract value
   at signature would recognize revenue that hasn't been earned, which is
   not merely out of scope but accounting-wrong.
   ========================================================================== */

const ERP_CONTRACT_KEY = "erp_contracts";
const ERP_CONTRACT_STATUSES = ["Draft", "Active", "Renewed", "Expired", "Terminated"];
const ERP_CONTRACT_TYPES = ["Annual Maintenance (AMC)", "Supply Agreement", "Service Retainer", "Subscription", "Rental / Lease", "Other"];
const ERP_CONTRACT_BILLING_CYCLES = ["Monthly", "Quarterly", "Half-Yearly", "Annually", "One-time"];

const ERP_ContractRepository = {
  statuses: ERP_CONTRACT_STATUSES,
  types: ERP_CONTRACT_TYPES,
  billingCycles: ERP_CONTRACT_BILLING_CYCLES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_CONTRACT_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_CONTRACT_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((c) => c.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) { return this.getAll().find((c) => c.id === id) || null; },

  getAllForCustomer(companyId, customerId) {
    return this.getAllForCompany(companyId).filter((c) => c.customerId === customerId);
  },

  nextContractCode(company) {
    let max = 0;
    this.getAllForCompany(company.id).forEach((c) => {
      const m = /-CTR-(\d+)$/.exec(c.contractCode || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `${company.companyCode}-CTR-${String(max + 1).padStart(2, "0")}`;
  },

  /** Reality, not just the stored administrative decision — see file
      header. An Active contract whose endDate has passed reports
      "Expired"; Draft/Renewed/Terminated always report themselves. */
  getEffectiveStatus(contract, todayISO) {
    const today = todayISO || new Date().toISOString().slice(0, 10);
    if (contract.status !== "Active") return contract.status;
    if (contract.endDate && contract.endDate < today) return "Expired";
    return "Active";
  },

  /** Days until expiry — negative once already expired. Null for a
      contract that isn't effectively Active. */
  getDaysToExpiry(contract, todayISO) {
    if (this.getEffectiveStatus(contract, todayISO) !== "Active") return null;
    const today = new Date(todayISO || new Date().toISOString().slice(0, 10));
    return Math.ceil((new Date(contract.endDate) - today) / 864e5);
  },

  /** Active contracts expiring within `days` — what the renewal-due
      panel shows. Default 60 days, a realistic notice window. */
  getRenewalsDue(companyId, days, todayISO) {
    const window = Number(days) || 60;
    return this.getAllForCompany(companyId)
      .filter((c) => this.getEffectiveStatus(c, todayISO) === "Active")
      .map((c) => ({ contract: c, daysToExpiry: this.getDaysToExpiry(c, todayISO) }))
      .filter((r) => r.daysToExpiry !== null && r.daysToExpiry <= window)
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry);
  },

  /** Soft warn, resolution #5 — see file header on why this is NOT
      Leave Application's hard block. */
  findOverlappingContract(companyId, customerId, startDate, endDate, excludeId) {
    if (!customerId || !startDate || !endDate) return null;
    return this.getAllForCompany(companyId).find((c) =>
      c.id !== excludeId && c.customerId === customerId &&
      (c.status === "Active" || c.status === "Draft") &&
      startDate <= c.endDate && endDate >= c.startDate
    ) || null;
  },

  create(company, data, actorUsername) {
    const record = {
      id: "CTR-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      contractCode: this.nextContractCode(company),
      customerId: data.customerId,
      title: "",
      contractType: "Annual Maintenance (AMC)",
      startDate: null,
      endDate: null,
      contractValue: 0,
      billingCycle: "Annually",
      autoRenew: false,
      terms: "",
      ownerEmployeeId: null,
      status: "Draft",
      renewedFromContractId: null,
      renewedToContractId: null,
      activatedAt: null, activatedByUsername: null,
      terminatedAt: null, terminatedByUsername: null, terminationReason: "",
      renewedAt: null, renewedByUsername: null,
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString(),
      ...data,
      status: data && data.status === "Active" ? "Active" : "Draft"
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  canEdit(c) { return c.status === "Draft"; },
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1 || !this.canEdit(all[idx])) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  _patch(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial };
    this._saveAll(all);
    return all[idx];
  },

  canActivate(c) { return c.status === "Draft" && !!c.startDate && !!c.endDate; },
  activate(id, actorUsername) {
    const c = this.findById(id);
    if (!c || !this.canActivate(c)) return null;
    return this._patch(id, { status: "Active", activatedAt: new Date().toISOString(), activatedByUsername: actorUsername || "system" });
  },

  /** Only a contract that is effectively Active (or already Expired but
      never renewed) can be renewed — a Draft has nothing to renew from,
      and a Terminated one was deliberately ended. */
  canRenew(c, todayISO) {
    const eff = this.getEffectiveStatus(c, todayISO);
    return (eff === "Active" || eff === "Expired") && !c.renewedToContractId;
  },

  /** Creates a NEW contract rather than extending dates in place — see
      file header. `overrides` lets the renewal form change terms/value
      before saving. Returns { success, newContract, reason? }. */
  renew(id, company, overrides, actorUsername) {
    const c = this.findById(id);
    if (!c || !this.canRenew(c)) return { success: false, reason: "This contract can't be renewed." };

    const created = this.create(company, {
      customerId: c.customerId,
      title: (overrides && overrides.title) || c.title,
      contractType: c.contractType,
      startDate: (overrides && overrides.startDate) || null,
      endDate: (overrides && overrides.endDate) || null,
      contractValue: overrides && overrides.contractValue != null ? Number(overrides.contractValue) : Number(c.contractValue) || 0,
      billingCycle: c.billingCycle,
      autoRenew: c.autoRenew,
      terms: (overrides && overrides.terms) || c.terms,
      ownerEmployeeId: c.ownerEmployeeId,
      renewedFromContractId: c.id,
      status: "Active"
    }, actorUsername);

    this._patch(id, {
      status: "Renewed",
      renewedAt: new Date().toISOString(),
      renewedByUsername: actorUsername || "system",
      renewedToContractId: created.id
    });
    return { success: true, newContract: created };
  },

  canTerminate(c, todayISO) { return this.getEffectiveStatus(c, todayISO) === "Active"; },
  terminate(id, reason, actorUsername) {
    const c = this.findById(id);
    if (!c || !this.canTerminate(c)) return null;
    return this._patch(id, { status: "Terminated", terminationReason: reason || "", terminatedAt: new Date().toISOString(), terminatedByUsername: actorUsername || "system" });
  },

  canDelete(c) { return c.status === "Draft"; },
  remove(id) {
    const c = this.findById(id);
    if (!c || !this.canDelete(c)) return false;
    this._saveAll(this.getAll().filter((x) => x.id !== id));
    return true;
  },

  /** Live metrics. Contracted value counts only effectively-Active
      contracts — an expired or terminated one contributes nothing to
      what's currently under contract, and including it would overstate
      the book. */
  getMetrics(companyId, todayISO) {
    const all = this.getAllForCompany(companyId);
    const eff = (c) => this.getEffectiveStatus(c, todayISO);
    const active = all.filter((c) => eff(c) === "Active");
    return {
      total: all.length,
      active: active.length,
      draft: all.filter((c) => c.status === "Draft").length,
      expired: all.filter((c) => eff(c) === "Expired").length,
      activeValue: active.reduce((s, c) => s + (Number(c.contractValue) || 0), 0),
      renewalsDue: this.getRenewalsDue(companyId, 60, todayISO).length
    };
  }
};
