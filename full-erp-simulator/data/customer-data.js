/* =============================================================================
   DOT ERP
   FILE:  data/customer-data.js
   ROLE:  Data-access layer for Customer Master — Phase 3, Module 03.
          Vendor Master's natural mirror (the other side of the same
          trading relationship), which makes it tempting to just copy
          Vendor Master and rename fields. Several things below are
          DELIBERATELY not a copy — see each note for why.

   REUSED FROM VENDOR MASTER, UNCHANGED —
   Same optional-but-validated GSTIN (via ERP_GstRepository.gstinPattern/
   .deriveState, not a local copy), same three-way duplicate-check split
   (gstin hard-blocks when present, customerName only soft-warns — two
   customer accounts can plausibly share a trading name), same Active/
   Blocked/Inactive three-state shape (a credit hold is exactly as real on
   the customer side as a purchasing hold is on the vendor side), no
   Branch link (a customer is external, needs its own address). PAN is
   sourced from window.ERP.panPattern at the PAGE level (customers.js),
   the same shared home Vendor Master's own page now uses — see vendor-
   data.js's header for why PAN doesn't get a repository-local copy here
   either.

   CREDIT LIMIT vs. OUTSTANDING: THE SAME BUDGET-BAR SHAPE, A THIRD TIME —
   getCreditUsage()/getCreditUtilizationBand() are the third appearance of
   the exact pattern Cost Centers established for Budget vs. Actual and
   Warehouses reused for Total vs. Utilized Capacity: a limit, a live
   figure against it, a gap, and a three-way under/near/over band the UI
   colors consistently via the same `.budget-bar` component. Current
   Outstanding is manually tracked for now, the same "real transactions
   will post here automatically once that module exists" honesty Cost
   Centers already applies to Actual Spend — here, that future module is
   Phase 5 (Sales) once invoices exist.

   PAYMENT TERMS: DELIBERATELY NOT SHARED WITH VENDOR MASTER'S FALLBACK —
   Vendor Master's paymentTermsDays falls back to Company Settings'
   `defaultPaymentTermsDays` when unset. Customer Master does NOT reuse
   that same fallback for its own `creditPeriodDays` — they look like the
   same shape (a number of days) but mean opposite things: Vendor's is how
   long WE take to pay THEM (an AP concept); Customer's is how long THEY
   get to pay US (an AR concept). Company Settings' field never specified
   which direction it covers, and silently reusing a vendor-shaped default
   for the customer side would be presumptuous, not clever reuse. Instead,
   `creditPeriodDays` is a plain field on the customer record with its own
   sensible default (30) set at creation time — no live-resolve helper, no
   cross-module fallback. If a genuine company-wide AR default is wanted
   later, it deserves its own explicitly-named Company Settings field
   ("Default Customer Credit Period"), not a repurposed AP one.

   ADDRESS: SINGLE, ON PURPOSE, FOR NOW —
   Real customer masters often split Billing Address from one or more
   Shipping/Delivery Addresses. This module deliberately does NOT build
   that split — a single address mirrors Vendor Master's shape, and the
   module that will actually NEED a delivery address is Phase 5's Sales
   Orders, not this one. Revisit the split when that module is built,
   rather than guessing at its shape now.
   ========================================================================== */

const ERP_CUSTOMERS_KEY = "erp_customers";

const ERP_CUSTOMER_TYPES = ["Retail", "Wholesale", "Distributor", "Government", "Export", "Other"];


const ERP_CustomerRepository = {
  customerTypes: ERP_CUSTOMER_TYPES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_CUSTOMERS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_CUSTOMERS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((c) => c.companyId === companyId)
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  },

  findById(id) {
    return this.getAll().find((c) => c.id === id) || null;
  },

  /** COMP-001-CUS-01, COMP-001-CUS-02, ... — same per-company numbering
      convention every earlier module established. */
  nextCustomerCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((c) => {
      const match = /-CUS-(\d+)$/.exec(c.customerCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-CUS-${String(max + 1).padStart(2, "0")}`;
  },

  /** Hard duplicate check — only meaningful when a GSTIN is actually given.
      Same reasoning as Vendor Master's hasDuplicateGstin. */
  hasDuplicateGstin(companyId, gstin, excludeId) {
    const target = String(gstin || "").trim().toUpperCase();
    if (!target) return false;
    return this.getAllForCompany(companyId).some((c) => c.id !== excludeId && (c.gstin || "").toUpperCase() === target);
  },

  /** Soft check only — the page presents this as a non-blocking inline
      warning, never a validation failure. See file header for why
      customer names are treated this way instead of a hard block. */
  hasDuplicateCustomerName(companyId, customerName, excludeId) {
    const target = String(customerName || "").trim().toLowerCase();
    if (!target) return false;
    return this.getAllForCompany(companyId).some((c) => c.id !== excludeId && c.customerName.trim().toLowerCase() === target);
  },

  /** Credit Limit vs. Current Outstanding — the gap (available credit) and
      utilization as a percentage of the limit already used. Guards a zero
      limit rather than dividing by it — the third appearance of this
      exact shape (see file header).

      RETROFIT: outstanding now comes LIVE from AR Aging's own sub-ledger
      walk (every Raised, unpaid Tax Invoice, minus Credit Notes and
      Receipts already applied against it) rather than a separately typed
      `currentOutstanding` field that nothing ever kept in sync with real
      invoices — a real credit-limit check has to trust the actual ledger,
      not a number a person may have forgotten to update. Falls back to
      the stored field, typeof-guarded, only on a page that doesn't load
      the sales/finance stack (AR Aging needs Tax Invoice, Credit Note,
      Receipt) — Customer Master's own list view is exactly that case, so
      it still shows a real, if possibly stale, number instead of nothing. */
  getCreditUsage(customer) {
    const limit = Number(customer.creditLimit) || 0;
    const outstanding = (typeof ERP_ARAgingRepository !== "undefined" && typeof ERP_TaxInvoiceRepository !== "undefined")
      ? ERP_ARAgingRepository.getCustomerOutstanding(customer.companyId, customer.id)
      : Number(customer.currentOutstanding) || 0;
    const available = limit - outstanding;
    const utilizationPct = limit > 0 ? (outstanding / limit) * 100 : (outstanding > 0 ? Infinity : 0);
    return { limit, outstanding, available, utilizationPct };
  },

  /** Same under/near/over three-way band as Cost Centers'/Warehouses'
      equivalents: "under" (comfortable headroom), "near" (80-100%),
      "over" (100%+, i.e. the customer already owes more than their
      approved limit). */
  getCreditUtilizationBand(customer) {
    const { utilizationPct } = this.getCreditUsage(customer);
    if (utilizationPct > 100) return "over";
    if (utilizationPct >= 80) return "near";
    return "under";
  },

  create(company, data) {
    const record = {
      id: "CUS-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      customerCode: this.nextCustomerCode(company),
      status: "Active",
      gstin: "",
      pan: "",
      address1: "", address2: "", city: "", state: "", pincode: "",
      contactPerson: "",
      email: "",
      phone: "",
      creditLimit: 0,
      currentOutstanding: 0,
      creditPeriodDays: 30,
      notes: "",
      createdAt: new Date().toISOString(),
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Active / Blocked / Inactive — Blocked is a credit hold (over limit,
      payment issues): can't take new orders once Sales exists, without
      touching anything already on record. Same shape and wording as
      Vendor Master's purchasing block. */
  setStatus(id, status) {
    return this.update(id, { status });
  },

  /** No dependency guard needed yet — nothing references a customer by id
      until Phase 5 (Sales) exists, the same situation Vendor Master is in
      relative to Phase 4. */
  remove(id) {
    const all = this.getAll().filter((c) => c.id !== id);
    this._saveAll(all);
    return true;
  }
};
