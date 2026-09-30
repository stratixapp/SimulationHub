/* =============================================================================
   DOT ERP
   FILE:  data/payment-terms-data.js
   ROLE:  Data-access layer for Payment Terms — Phase 3, Module 09. Flat
          list, same complexity tier as Tax Master — a short, named
          reference list other modules can point to instead of carrying a
          raw day-count.

   WHY THIS DOESN'T CONTRADICT SECTION 9'S VENDOR-VS-CUSTOMER WARNING:
   CONTINUE_HERE.md Section 9 is explicit that Vendor Master's Payment
   Terms (AP — how long WE take to pay THEM) and Customer Master's Credit
   Period (AR — how long THEY get to pay US) are opposite directions and
   must NOT share a fallback DEFAULT. That warning is about which NUMBER
   applies when nothing else is set (a company might reasonably want to
   offer customers different terms than it accepts from vendors) — it is
   NOT a claim that "Net 30" the TEMPLATE means something different
   depending which side uses it. A term like "payment due 30 days after
   invoice date" is direction-agnostic; whether it's a bill payable or an
   invoice receivable is a property of the TRANSACTION, not the term. This
   module is written so it would be safe for both Vendor and Customer
   Master to eventually reference the same named record — see below for
   why that retrofit isn't done in this pass.

   RETROFIT DELIBERATELY DEFERRED, NOT SILENTLY SKIPPED: Vendor Master's
   `paymentTermsDays` and Customer Master's `creditPeriodDays` both
   currently store a plain number with their own Company-Settings-backed
   fallback (getEffectivePaymentTerms()/equivalent). Pointing them at named
   records here (`paymentTermsId` on each, own value kept as the override/
   fallback — the same id-first-fallback-to-value shape as every other
   retrofit in this codebase) is a reasonable next step, but doing it
   properly means touching two already-shipped, non-trivial modules' UI —
   real cost, for real value, but value that competes for the same session
   budget as the rest of this roadmap (Bank Master, then Phases 4-7). This
   file ships standalone and reusable on purpose so that retrofit stays
   cheap WHENEVER it happens, rather than doing it now at the expense of
   everything still ahead. See CONTINUE_HERE.md's handoff notes.

   ADVANCE PERCENTAGE, NOT JUST DAYS: a real payment term is sometimes
   split ("50% advance, balance Net 30"), not always a single due date —
   `advancePct` (0 if none) captures that without inventing a second
   record type. getDueDate() is a small forward-looking utility for
   Phase 4/5's eventual invoice screens: given an invoice date, what date
   is the (remaining) balance actually due.

   DEFAULT TERM: the same plain-toggle singleton pattern as Tax Master's
   isDefault (see that file's header) — a user choice, not a structural
   guarantee.

   DUPLICATE CHECK: termName hard-blocked, company-wide — the same
   "internal, curated identifier" bucket as Category/Unit/Tax/Departments.

   DELETE GUARD: none yet — nothing references a payment term by id until
   a future Vendor/Customer retrofit (see above) or Phase 4/5 exist.
   ========================================================================== */

const ERP_PAYMENT_TERMS_KEY = "erp_payment_terms";

const ERP_PaymentTermsRepository = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_PAYMENT_TERMS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_PAYMENT_TERMS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((t) => t.companyId === companyId)
      .sort((a, b) => a.days - b.days || a.termName.localeCompare(b.termName));
  },

  findById(id) {
    return this.getAll().find((t) => t.id === id) || null;
  },

  getActiveForCompany(companyId) {
    return this.getAllForCompany(companyId).filter((t) => t.status === "Active");
  },

  getDefault(companyId) {
    return this.getAllForCompany(companyId).find((t) => t.isDefault) || null;
  },

  /** COMP-001-PT-01, COMP-001-PT-02, ... */
  nextTermCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((t) => {
      const match = /-PT-(\d+)$/.exec(t.termCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-PT-${String(max + 1).padStart(2, "0")}`;
  },

  hasDuplicateName(companyId, termName, excludeId) {
    const target = termName.trim().toLowerCase();
    return this.getAllForCompany(companyId).some((t) => t.id !== excludeId && t.termName.trim().toLowerCase() === target);
  },

  /** "Payment due within 30 days of invoice date." / "50% due upfront,
      remaining 50% due within 30 days." / "Payment due immediately upon
      invoice receipt." — the single display string every table row and
      the detail modal use. */
  describeTerm(term) {
    const days = Number(term.days) || 0;
    const advancePct = Number(term.advancePct) || 0;
    if (days === 0 && advancePct === 0) return "Payment due immediately upon invoice receipt.";
    if (advancePct > 0 && advancePct < 100) {
      return `${advancePct}% due upfront, remaining ${100 - advancePct}% due within ${days} day${days === 1 ? "" : "s"}.`;
    }
    if (advancePct >= 100) return "Full payment due upfront, in advance.";
    return `Payment due within ${days} day${days === 1 ? "" : "s"} of invoice date.`;
  },

  /** Invoice date (ISO) + this term's `days` = the (remaining-balance) due
      date, for a future invoice screen to consume directly. */
  getDueDate(term, invoiceDateISO) {
    const invoiceDate = new Date(invoiceDateISO);
    if (isNaN(invoiceDate.getTime())) return null;
    const due = new Date(invoiceDate);
    due.setDate(due.getDate() + (Number(term.days) || 0));
    return due.toISOString().slice(0, 10);
  },

  create(company, data) {
    const record = {
      id: "PT-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      termCode: this.nextTermCode(company),
      days: 30,
      advancePct: 0,
      isDefault: false,
      status: "Active",
      description: "",
      createdAt: new Date().toISOString(),
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    if (record.isDefault) this.setDefault(record.id, company.id);
    return record;
  },

  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    if (partial.isDefault) this.setDefault(id, all[idx].companyId);
    return all[idx];
  },

  /** Clears `isDefault` on every other term for the company first — same
      shape as Tax Master's setDefault(). */
  setDefault(id, companyId) {
    const all = this.getAll();
    all.forEach((t) => { if (t.companyId === companyId) t.isDefault = t.id === id; });
    this._saveAll(all);
    return this.findById(id);
  },

  toggleStatus(id) {
    const term = this.findById(id);
    if (!term) return null;
    return this.update(id, { status: term.status === "Active" ? "Inactive" : "Active" });
  },

  remove(id) {
    const all = this.getAll().filter((t) => t.id !== id);
    this._saveAll(all);
    return true;
  }
};
