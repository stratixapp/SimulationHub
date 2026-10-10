/* =============================================================================
   DOT ERP
   FILE:  data/lead-data.js
   ROLE:  Data-access layer for Lead Pipeline — Phase 14, Module 01. A
          pre-Inquiry stage: someone who has shown interest but is NOT yet
          a Customer Master record and has not necessarily asked about a
          specific need.

   THIS MODULE CLOSES A GAP THIS PROJECT ITSELF NAMED, IN WRITING, NINE
   PHASES AGO — the roadmap told this phase to read
   `data/customer-inquiry-data.js`'s own header before building anything,
   and that header turns out to describe exactly this module in advance:
   "A real CRM would also support inquiries from not-yet-onboarded
   prospects (a 'Lead' concept distinct from 'Customer'), logging a
   name/phone/email before any formal customer account exists. This
   simulator deliberately doesn't build that distinction." That was an
   honest, documented simplification at the time; Lead Pipeline is the
   module that finally earns it out, the same way Phase 16 is scheduled
   to close the TDS gap Salary Structure's own header named. **Customer
   Inquiry itself is not changed at all** — its `customerId` stays
   required, exactly as its header describes, because an Inquiry is still
   genuinely a question from a known customer. The Lead is what sits
   BEFORE that.

   THE ROADMAP'S OWN QUESTION — "IS THIS REALLY A NEW WORKFLOW SHAPE, OR
   CLOSE ENOUGH TO CUSTOMER INQUIRY'S TO SHARE?" — CHECKED, NOT ASSUMED,
   AND THE ANSWER IS: **SHARE IT. THIS IS THE SAME 7th SHAPE, NOT AN 8th.**
   Compared side by side against Customer Inquiry's own documented
   lifecycle:
       Customer Inquiry:  New -> In Progress -> Converted / Lost (+ Cancelled)
       Lead Pipeline:     New -> Qualified   -> Converted / Lost (+ Cancelled)
   "Qualified" and "In Progress" are the same state wearing a different
   domain label — someone has picked this up and is actively working it.
   Converted and Lost mean structurally identical things in both. Both
   are PIPELINE PROGRESSION, not a permission gate — which is precisely
   what Section 9's own 7th shape is defined as. So this file deliberately
   reuses that shape wholesale rather than inventing a near-duplicate 8th
   entry in the catalog: the same `lostReason`-required discipline, the
   same reopen()-from-Lost allowance (a lead that goes quiet genuinely
   comes back), the same Cancelled-vs-Lost distinction (Cancelled = the
   record was invalid or withdrawn before anyone judged it; Lost = it was
   genuinely worked and didn't pan out). **A near-identical 8th shape
   would have been catalog noise, not a real distinction.**

   WHAT GENUINELY IS DIFFERENT IS THE SUBJECT, NOT THE LIFECYCLE: a Lead
   carries FREE-TEXT contact details (`leadName`, `contactPerson`,
   `phone`, `email`) and NO `customerId` at all, because the whole point
   is that no Customer record exists yet. That is the one real departure
   from this project's own long-standing "name a real master record,
   don't accept free text" discipline — and it's deliberate, not a lapse:
   for a prospect who may never become a customer, creating a Customer
   Master record up front would pollute the customer list with records
   for people who never bought anything, which is exactly the problem
   real CRMs use a separate Lead entity to avoid.

   CONVERT() IS THE ONLY PLACE A LEAD BECOMES REAL DATA, AND IT CREATES
   THE CUSTOMER ITSELF: converting writes a genuine `ERP_CustomerRepository`
   record from the lead's own free-text fields (the promotion from
   prospect to customer, which is the moment the "name a real master
   record" discipline reasserts itself) and stores the resulting
   `convertedCustomerId` back on the lead. Creating a follow-on Customer
   Inquiry at the same time is OFFERED but OPTIONAL — a converted lead
   might already have a concrete need to log, or might simply be a
   customer now with nothing specific pending. Forcing an Inquiry would
   invent a question the prospect never actually asked. When one IS
   created, `convertedInquiryId` is stored too, so the whole chain
   Lead -> Customer -> Inquiry -> Quotation stays walkable.

   NOT EXCLUSIVE OVER ITS OWN CUSTOMER: several leads can legitimately
   convert into the same eventual customer over time (a company that
   enquired twice through different channels), so there is no
   `getLinkedIds`/`getAvailable` exclusivity pair here — the same
   "repeat is normal, not a duplicate" reasoning Vendor Evaluation,
   Payment Collection and Asset Register already established.

   DUPLICATE CHECK — RESOLUTION #5 (SOFT WARN), REUSED: two leads with
   the same phone or email are probably the same person enquiring twice,
   but genuinely might not be (a shared office line, a family business).
   `findPossibleDuplicate()` surfaces it as a non-blocking warning the
   page shows, exactly as Customer Inquiry's own duplicate check does —
   never a hard block, because the system cannot actually know.
   ========================================================================== */

const ERP_LEAD_KEY = "erp_leads";
const ERP_LEAD_STATUSES = ["New", "Qualified", "Converted", "Lost", "Cancelled"];
/* Deliberately the SAME vocabulary Customer Inquiry uses for `source` —
   a lead and an inquiry arrive through the same channels, and two
   divergent lists for one real-world concept would be a maintenance trap. */
const ERP_LEAD_SOURCES = ["Phone", "Email", "Website", "Walk-in", "Referral", "Trade Show", "Other"];
const ERP_LEAD_RATINGS = ["Hot", "Warm", "Cold"];

const ERP_LeadRepository = {
  statuses: ERP_LEAD_STATUSES,
  sources: ERP_LEAD_SOURCES,
  ratings: ERP_LEAD_RATINGS,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_LEAD_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_LEAD_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll().filter((l) => l.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) { return this.getAll().find((l) => l.id === id) || null; },

  nextLeadCode(company) {
    let max = 0;
    this.getAllForCompany(company.id).forEach((l) => {
      const m = /-LEAD-(\d+)$/.exec(l.leadCode || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `${company.companyCode}-LEAD-${String(max + 1).padStart(2, "0")}`;
  },

  /** Resolution #5 soft warn — see file header. Matches on phone or email
      (either alone is enough), ignoring Cancelled leads since those were
      explicitly withdrawn. */
  findPossibleDuplicate(companyId, { phone, email }, excludeId) {
    const p = String(phone || "").trim().toLowerCase();
    const e = String(email || "").trim().toLowerCase();
    if (!p && !e) return null;
    return this.getAllForCompany(companyId).find((l) =>
      l.id !== excludeId && l.status !== "Cancelled" &&
      ((p && String(l.phone || "").trim().toLowerCase() === p) ||
       (e && String(l.email || "").trim().toLowerCase() === e))
    ) || null;
  },

  create(company, data, actorUsername) {
    const record = {
      id: "LEAD-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      leadCode: this.nextLeadCode(company),
      leadName: "",            // free text — no Customer record exists yet, by design
      contactPerson: "",
      phone: "",
      email: "",
      source: "Phone",
      rating: "Warm",
      assignedToEmployeeId: null,
      interestNotes: "",
      estimatedValue: null,
      status: "New",
      qualifiedAt: null, qualifiedByUsername: null,
      convertedAt: null, convertedByUsername: null,
      convertedCustomerId: null, convertedInquiryId: null,
      lostAt: null, lostByUsername: null, lostReason: "",
      cancelledAt: null, cancelledByUsername: null,
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString(),
      ...data,
      status: "New"
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** New only — the same "only the pre-commitment state is freely
      editable" rule Customer Inquiry and Department Need both use. */
  canEdit(lead) { return lead.status === "New"; },
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((l) => l.id === id);
    if (idx === -1 || !this.canEdit(all[idx])) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  _patch(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial };
    this._saveAll(all);
    return all[idx];
  },

  /** New -> Qualified. Requires an owner, the same assignment-gate
      reasoning Customer Inquiry's own startFollowUp() uses: a lead can
      sit unowned in a shared queue while New, but nobody should show as
      "working" a lead with no owner. The page enforces the owner check. */
  canQualify(lead) { return lead.status === "New"; },
  qualify(id, actorUsername) {
    const lead = this.findById(id);
    if (!lead || !this.canQualify(lead)) return null;
    return this._patch(id, { status: "Qualified", qualifiedAt: new Date().toISOString(), qualifiedByUsername: actorUsername || "system" });
  },

  /** Qualified -> back to New, the withdraw()/returnToNew() equivalent —
      same "pull it back before editing" reason as every sibling module. */
  canReturnToNew(lead) { return lead.status === "Qualified"; },
  returnToNew(id) {
    const lead = this.findById(id);
    if (!lead || !this.canReturnToNew(lead)) return null;
    return this._patch(id, { status: "New", qualifiedAt: null, qualifiedByUsername: null });
  },

  canConvert(lead) { return lead.status === "Qualified"; },

  /** The only place a Lead becomes real master data — see file header.
      Creates a genuine Customer Master record from the lead's own free-
      text fields, and OPTIONALLY a follow-on Customer Inquiry. Never
      throws; returns { success, customer, inquiry, reason? }. */
  convert(id, company, opts, actorUsername) {
    const lead = this.findById(id);
    if (!lead || !this.canConvert(lead)) return { success: false, reason: "Only a Qualified lead can be converted." };
    if (typeof ERP_CustomerRepository === "undefined") return { success: false, reason: "Customer Master isn't available on this page." };

    const customer = ERP_CustomerRepository.create(company, {
      customerName: lead.leadName,
      contactPerson: lead.contactPerson || "",
      phone: lead.phone || "",
      email: lead.email || "",
      notes: `Converted from lead ${lead.leadCode}.`
    });

    let inquiry = null;
    if (opts && opts.createInquiry && typeof ERP_CustomerInquiryRepository !== "undefined") {
      inquiry = ERP_CustomerInquiryRepository.create(company, {
        customerId: customer.id,
        assignedToEmployeeId: lead.assignedToEmployeeId || null,
        inquiryDescription: opts.inquiryDescription || lead.interestNotes || "",
        source: lead.source,
        createdByUsername: actorUsername || "system"
      });
    }

    const updated = this._patch(id, {
      status: "Converted",
      convertedAt: new Date().toISOString(),
      convertedByUsername: actorUsername || "system",
      convertedCustomerId: customer.id,
      convertedInquiryId: inquiry ? inquiry.id : null
    });
    return { success: true, lead: updated, customer, inquiry };
  },

  /** lostReason required — the same "capture the why" discipline
      Customer Inquiry and Department Need both enforce. */
  canMarkLost(lead) { return lead.status === "New" || lead.status === "Qualified"; },
  markLost(id, reason, actorUsername) {
    const lead = this.findById(id);
    if (!lead || !this.canMarkLost(lead)) return null;
    return this._patch(id, { status: "Lost", lostAt: new Date().toISOString(), lostByUsername: actorUsername || "system", lostReason: reason || "" });
  },

  /** Lost -> Qualified. A prospect who went quiet genuinely comes back —
      the same reopen() allowance Customer Inquiry has, for the same
      "don't lose the history, let the SAME record continue" reason. */
  canReopen(lead) { return lead.status === "Lost"; },
  reopen(id) {
    const lead = this.findById(id);
    if (!lead || !this.canReopen(lead)) return null;
    return this._patch(id, { status: "Qualified", lostAt: null, lostByUsername: null, lostReason: "" });
  },

  canCancel(lead) { return lead.status === "New" || lead.status === "Qualified"; },
  cancel(id, actorUsername) {
    const lead = this.findById(id);
    if (!lead || !this.canCancel(lead)) return null;
    return this._patch(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername || "system" });
  },

  /** Refuses Qualified (someone is actively relying on it) and Converted
      (a real Customer record now points back at it) — cancel() first,
      same as everywhere else in this codebase. */
  canDelete(lead) { return lead.status === "New" || lead.status === "Lost" || lead.status === "Cancelled"; },
  remove(id) {
    const lead = this.findById(id);
    if (!lead || !this.canDelete(lead)) return false;
    this._saveAll(this.getAll().filter((l) => l.id !== id));
    return true;
  },

  /** Funnel counts for the pipeline board — computed live, never stored. */
  getFunnelCounts(companyId) {
    const all = this.getAllForCompany(companyId);
    const by = (s) => all.filter((l) => l.status === s).length;
    const worked = by("Converted") + by("Lost");
    return {
      total: all.length,
      New: by("New"), Qualified: by("Qualified"),
      Converted: by("Converted"), Lost: by("Lost"), Cancelled: by("Cancelled"),
      // Conversion rate is measured against leads that were genuinely
      // WORKED to a conclusion (Converted + Lost) — Cancelled records were
      // withdrawn before any judgment, and counting them would understate
      // the rate for reasons that have nothing to do with sales
      // performance. Same reasoning as Customer Inquiry's own
      // Cancelled-vs-Lost distinction.
      conversionRate: worked > 0 ? (by("Converted") / worked) * 100 : null
    };
  }
};
