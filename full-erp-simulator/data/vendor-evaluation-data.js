/* =============================================================================
   DOT ERP
   FILE:  data/vendor-evaluation-data.js
   ROLE:  Data-access layer for Vendor Evaluation — Phase 4, Module 08. A
          scorecard rating a vendor's performance across a few standard
          criteria, optionally tied to the RFQ/quotation cycle it arose
          from, building an ongoing track record for future vendor
          decisions.

   NOT A WORKFLOW MODULE — A DELIBERATE CONTRAST TO EVERY OTHER PHASE 4
   MODULE SO FAR.
   Department Need, Purchase Requisition, and RFQ Creation all move
   through a lifecycle because each commits the company to something (a
   need, a spend, a vendor conversation) that benefits from a Draft stage
   and a lock. Rating a vendor commits to nothing — it's a record of an
   opinion. So this module has only two states, Draft (editable) and
   Final (locked, part of the vendor's track record), with a reopen-to-
   Draft escape hatch (revise()) for a genuine correction — closer in
   spirit to a simple Master Data status than to any of this Phase's
   workflow lifecycles. Read this as confirmation of Section 9's standing
   rule ("don't reuse a sibling module's shape by reflex") rather than an
   exception to it — the real-world entity here genuinely doesn't need
   Submitted/Approved/Rejected.

   NO DUPLICATE CHECK, ON PURPOSE.
   Every other module in Phase 4 has had SOME duplicate-check resolution
   (hard, soft, composite-key, or explicitly "not applicable and here's
   why" — see quotation-data.js). This one lands on genuinely "not
   applicable": a vendor being evaluated more than once, even referencing
   the same RFQ, is completely normal — it's how a track record forms
   over time. There is no (vendor, RFQ) uniqueness constraint here, unlike
   Quotation Receipt's hard one on the same shape of pair, because
   multiple quotations for one vendor on one RFQ WOULD be a data-entry
   mistake, while multiple evaluations of one vendor over time are exactly
   the point.

   FOUR FIXED CRITERIA, 1-5 EACH, AVERAGED FOR AN OVERALL SCORE.
   qualityScore/deliveryScore/pricingScore/communicationScore are the
   controlled vocabulary here (`.scoreCriteria`, a plain array of
   { key, label } pairs so the UI can loop instead of hardcoding four
   near-identical form fields). computeOverallScore() averages whatever
   criteria are present — the same "handle a partial set gracefully"
   instinct as pr-data.js's computeGrandTotal(), just for scores instead
   of prices.

   getAverageScoreForVendor() IS THE FK-SURFACE HOOK — read by Vendor
   Master's own retrofit (see vendors.js) to show a live "Average Rating"
   on a vendor's own profile, the same "older module gets a small display
   addition once a newer one has something worth surfacing" shape as
   Department Need's "Linked to PR" line.
   ========================================================================== */

const ERP_VENDOR_EVAL_KEY = "erp_vendor_evaluations";

const ERP_VENDOR_EVAL_STATUSES = ["Draft", "Final"];

const ERP_VENDOR_EVAL_CRITERIA = [
  { key: "qualityScore", label: "Quality" },
  { key: "deliveryScore", label: "Delivery Timeliness" },
  { key: "pricingScore", label: "Pricing Competitiveness" },
  { key: "communicationScore", label: "Communication" }
];

const ERP_VendorEvaluationRepository = {
  statuses: ERP_VENDOR_EVAL_STATUSES,
  scoreCriteria: ERP_VENDOR_EVAL_CRITERIA,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_VENDOR_EVAL_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_VENDOR_EVAL_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((e) => e.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getAllForVendor(vendorId) {
    return this.getAll().filter((e) => e.vendorId === vendorId);
  },

  findById(id) {
    return this.getAll().find((e) => e.id === id) || null;
  },

  nextEvaluationCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((e) => {
      const match = /-VE-(\d+)$/.exec(e.evaluationCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-VE-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(evaluation) {
    return evaluation.status === "Draft";
  },

  canDelete(evaluation) {
    return evaluation.status === "Draft";
  },

  /** Averages whatever criteria are present on this evaluation; null if
      none are. Rounded to 1 decimal for display. */
  computeOverallScore(evaluation) {
    const scores = ERP_VENDOR_EVAL_CRITERIA
      .map((c) => evaluation[c.key])
      .filter((v) => v != null && v !== "" && !isNaN(Number(v)));
    if (!scores.length) return null;
    const avg = scores.reduce((sum, v) => sum + Number(v), 0) / scores.length;
    return Math.round(avg * 10) / 10;
  },

  /** The FK-surface hook Vendor Master's own page reads from — see file
      header. Only counts Final evaluations, since a Draft one isn't a
      settled opinion yet. */
  getAverageScoreForVendor(vendorId) {
    const finals = this.getAllForVendor(vendorId).filter((e) => e.status === "Final");
    const scores = finals.map((e) => this.computeOverallScore(e)).filter((s) => s != null);
    if (!scores.length) return null;
    return Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10;
  },

  actorLabel(username) {
    if (!username) return "—";
    if (typeof ERP_UserRepository === "undefined") return username;
    const user = ERP_UserRepository.findByUsername(username);
    return user ? `${user.fullName} (${user.role})` : username;
  },

  create(company, data) {
    const record = {
      id: "VE-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      evaluationCode: this.nextEvaluationCode(company),
      vendorId: null,
      relatedRfqId: null,
      qualityScore: null,
      deliveryScore: null,
      pricingScore: null,
      communicationScore: null,
      comments: "",
      status: "Draft",
      finalizedAt: null, finalizedByUsername: null,
      createdAt: new Date().toISOString(),
      createdByUsername: null,
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Final. */
  finalize(id, actorUsername) {
    return this.update(id, { status: "Final", finalizedAt: new Date().toISOString(), finalizedByUsername: actorUsername });
  },

  /** Final -> Draft, to correct the SAME record — same "don't spawn a
      duplicate for a fix" instinct as elsewhere in Phase 4. */
  revise(id) {
    return this.update(id, { status: "Draft" });
  },

  remove(id) {
    const e = this.findById(id);
    if (!e || !this.canDelete(e)) return false;
    const all = this.getAll().filter((r) => r.id !== id);
    this._saveAll(all);
    return true;
  }
};
