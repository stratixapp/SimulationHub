/* =============================================================================
   DOT ERP
   FILE:  data/vendor-data.js
   ROLE:  Data-access layer for Vendor Master — Phase 3, Module 02. The
          first EXTERNAL entity in Master Data (Employee Master was
          internal people) — Phase 4 (Procurement) will reference vendors
          by id once Purchase Orders exist.

   GSTIN: REUSED, NOT REBUILT — GST Details (Phase 2, Module 05) already
   built the structural GSTIN regex and the state-from-GSTIN derivation
   (`ERP_GstRepository.gstinPattern` / `.deriveState`). This file imports
   both rather than redefining them, so a GSTIN accepted on GST Details is
   accepted here too. Unlike GST Details' own registrations, a vendor's
   GSTIN is genuinely OPTIONAL — plenty of real vendors (small suppliers
   below the GST threshold, individual contractors, some foreign vendors)
   legitimately have none. When one IS given, it's validated, its state is
   auto-derived as a courtesy default (still a plain editable field
   afterward, not locked), and it's the field that gets a HARD duplicate
   check — see the note on vendorName below for why that's different.

   TWO DIFFERENT ANSWERS TO "IS THIS NAME UNIQUE," ON PURPOSE —
   Every master-data module through Warehouses hard-blocked duplicate
   Name because those names are curated internal identifiers. Employee
   Master dropped the check on Name entirely, because real people share
   names all the time and Work Email is what's actually unique there.
   Vendor Master needs a THIRD answer: `vendorName` gets duplicate-checked
   too (hasDuplicateVendorName), but only ever as a SOFT inline warning —
   never a hard block — because two genuinely different vendor accounts
   can plausibly share a trading name (a common one, a franchise, two
   unrelated companies), the same "flag, don't block" spirit Section 9
   already uses for cross-module mismatches. `gstin`, when present, is
   what's actually guaranteed unique in the real world, so that one DOES
   hard-block via hasDuplicateGstin — a vendor's GSTIN is a genuine
   government-issued identifier for that PAN+state; a name is not.

   THREE-STATE LIFECYCLE, REUSING COST CENTERS' EXACT SHAPE AND WORDING —
   Active / Blocked / Inactive, not a new vocabulary — a "purchasing
   block" (can't be used on new POs, existing transactions untouched) is
   real ERP terminology (SAP calls vendor holds exactly this), and it's
   the same temporary/reversible-vs-permanent distinction Cost Centers
   already established. Employee Master needed different wording ("On
   Leave") because that's the correct HR term for its equivalent state;
   Vendor Master doesn't need to reinvent anything here.

   PAYMENT TERMS: A FOURTH "LIVE-RESOLVE, FALL BACK GRACEFULLY" HELPER —
   getEffectivePaymentTerms() is the same shape as Warehouses'
   getEffectiveAddress(), Cost Centers' getResponsiblePersonLabel(), and
   Warehouses' getManagerLabel(): a vendor's own `paymentTermsDays`
   override if it's set, otherwise Company Settings' company-wide default
   — resolved live every call, never copied at creation time, so a later
   change to the company default is reflected immediately by every vendor
   that hasn't set its own override.

   BANK DETAILS RETROFIT (now complete — Bank Master exists): the original
   bankName/bankAccountNumber/bankIfsc fields were a deliberate FORWARD
   dependency, built directly on the vendor record because Bank Master
   (Phase 3, Module 10) didn't exist yet. Now that it does, `bankId`
   (optional) links to a real Bank Master record, with the original three
   fields kept as the free-text FALLBACK — the exact same id-first-
   fallback-to-value shape as the responsibleEmployeeId/managerEmployeeId
   retrofit in cost-center-data.js/warehouse-data.js. getEffectiveBank-
   Details() below resolves the two together, live, every call, the same
   "never copied at creation time" discipline getEffectivePaymentTerms()
   just above already follows. The IFSC pattern itself is no longer owned
   here either — `ERP_VENDOR_IFSC_RE` is kept only as a defensive fallback
   for if Bank Master's script somehow isn't loaded; the real source of
   truth is now `ERP_BankRepository.ifscPattern` (bank-data.js), the same
   way this file already treats GST Details as the GSTIN pattern's real
   owner rather than keeping its own authoritative copy.
   ========================================================================== */

const ERP_VENDORS_KEY = "erp_vendors";

const ERP_VENDOR_TYPES = [
  "Raw Material Supplier", "Service Provider", "Contractor", "Transporter", "Consultant", "Other"
];

/** IFSC: 4-letter bank code + a literal "0" (reserved for future use) +
    6-character branch code. Real, well-known, simple to validate
    structurally — same "validate the structure, not a live registry"
    spirit as the GSTIN checksum GST Details already declines to compute.
    (PAN doesn't get an entry here — it's a generic identifier with no
    vendor-specific meaning, so it's sourced from window.ERP.panPattern,
    the shared page-level home for PAN/email, instead of a second local
    copy. GSTIN stays sourced from ERP_GstRepository specifically because
    its validation is genuinely coupled to GST/tax domain logic —
    deriveState() — that window.ERP has no reason to own.) */
const ERP_VENDOR_IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;


const ERP_VendorRepository = {
  vendorTypes: ERP_VENDOR_TYPES,
  ifscPattern: ERP_VENDOR_IFSC_RE,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_VENDORS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_VENDORS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((v) => v.companyId === companyId)
      .sort((a, b) => a.vendorName.localeCompare(b.vendorName));
  },

  findById(id) {
    return this.getAll().find((v) => v.id === id) || null;
  },

  /** COMP-001-VEN-01, COMP-001-VEN-02, ... — same per-company numbering
      convention every earlier module established. */
  nextVendorCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((v) => {
      const match = /-VEN-(\d+)$/.exec(v.vendorCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-VEN-${String(max + 1).padStart(2, "0")}`;
  },

  /** Hard duplicate check — only meaningful when a GSTIN is actually given,
      since most vendors having none is normal, not a gap to flag. */
  hasDuplicateGstin(companyId, gstin, excludeId) {
    const target = String(gstin || "").trim().toUpperCase();
    if (!target) return false;
    return this.getAllForCompany(companyId).some((v) => v.id !== excludeId && (v.gstin || "").toUpperCase() === target);
  },

  /** Soft check only — the caller decides how to present it (an inline
      warning that doesn't block Save), never a hard validation failure.
      See file header for why vendor names are treated differently from
      every other master-data module's Name field. */
  hasDuplicateVendorName(companyId, vendorName, excludeId) {
    const target = String(vendorName || "").trim().toLowerCase();
    if (!target) return false;
    return this.getAllForCompany(companyId).some((v) => v.id !== excludeId && v.vendorName.trim().toLowerCase() === target);
  },

  /** This vendor's own payment-terms override if set, otherwise Company
      Settings' company-wide default — see file header for the general
      "live-resolve, fall back gracefully" shape this repeats. */
  getEffectivePaymentTerms(vendor, company) {
    if (vendor.paymentTermsDays !== null && vendor.paymentTermsDays !== undefined && vendor.paymentTermsDays !== "") {
      return { days: Number(vendor.paymentTermsDays), source: "vendor" };
    }
    const settings = (typeof ERP_CompanySettingsRepository !== "undefined") ? ERP_CompanySettingsRepository.getForCompany(company.id) : null;
    return { days: settings ? settings.defaultPaymentTermsDays : 30, source: "company-default" };
  },

  /** This vendor's linked Bank Master record if `bankId` is set (and still
      exists), otherwise its own free-text bank fields — see file header.
      Always resolved live, never copied, so editing the linked bank
      account's details in Bank Master is reflected here immediately. */
  getEffectiveBankDetails(vendor) {
    const ownFields = {
      bankName: vendor.bankName || "", accountNumber: vendor.bankAccountNumber || "", ifscCode: vendor.bankIfsc || ""
    };
    if (!vendor.bankId || typeof ERP_BankRepository === "undefined") {
      return { ...ownFields, source: "custom" };
    }
    const bank = ERP_BankRepository.findById(vendor.bankId);
    if (!bank) return { ...ownFields, source: "custom" }; // linked account missing/removed — fall back
    return {
      bankName: bank.bankName, accountNumber: bank.accountNumber, ifscCode: bank.ifscCode,
      accountHolderName: bank.accountHolderName, source: "bank-master"
    };
  },

  create(company, data) {
    const record = {
      id: "VEN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      vendorCode: this.nextVendorCode(company),
      status: "Active",
      gstin: "",
      pan: "",
      address1: "", address2: "", city: "", state: "", pincode: "",
      contactPerson: "",
      email: "",
      phone: "",
      paymentTermsDays: null,
      bankId: null,
      bankName: "",
      bankAccountNumber: "",
      bankIfsc: "",
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
    const idx = all.findIndex((v) => v.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Active / Blocked / Inactive — see file header for why this reuses
      Cost Centers' exact three-state shape and vocabulary. */
  setStatus(id, status) {
    return this.update(id, { status });
  },

  /** No dependency guard needed yet — nothing references a vendor by id
      until Phase 4 (Procurement) exists, the same situation Cost Centers
      and Warehouses were in at the time they were built. */
  remove(id) {
    const all = this.getAll().filter((v) => v.id !== id);
    this._saveAll(all);
    return true;
  }
};
