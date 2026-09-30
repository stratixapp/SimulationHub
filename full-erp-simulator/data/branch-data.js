/* =============================================================================
   DOT ERP
   FILE:  data/branch-data.js
   ROLE:  Data-access layer for Branches — Phase 2, Module 06.

   Company Profile already owns a single registered address (address1/2,
   city, state, country, pincode, phone, email) — this module treats that
   as the company's implicit "Head Office" branch and lets the user add
   real branch locations beyond it, each optionally linked to one of the
   state-wise GST registrations Module 5 built, since a branch dispatching
   goods from a given state needs that state's GSTIN on its invoices.

   WHY THE HEAD-OFFICE SYNC WORKS DIFFERENTLY FROM CURRENCY / GST DETAILS:
   Currency's baseCurrency and GST Details' gstin are each a single
   discriminating VALUE — when it changes, the old value still means
   something (a currency that's no longer base, a GSTIN that's no longer
   primary), so those modules demote the old record and create a new one.
   An address has no such single identity to swap; it's just a set of
   descriptive fields that can drift over time. So here, ensurePrimaryBranch
   simply keeps updating the SAME Head Office record's address/contact
   fields to match Company Profile, every time this page loads — there is
   nothing to demote, because there's only ever one Head Office.
   ========================================================================== */

const ERP_BRANCHES_KEY = "erp_branches";

const ERP_BRANCH_TYPES = [
  "Branch Office", "Warehouse", "Factory / Plant", "Sales Office", "Regional Office", "Liaison Office"
];

function erpBranchAddressSignature(company) {
  return JSON.stringify({
    address1: company.address1 || "", address2: company.address2 || "",
    city: company.city || "", state: company.state || "", country: company.country || "",
    pincode: company.pincode || "", phone: company.phone || "", email: company.email || ""
  });
}


const ERP_BranchRepository = {
  branchTypes: ERP_BRANCH_TYPES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_BRANCHES_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_BRANCHES_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** Primary (Head Office) first, then the rest alphabetically by name. */
  getAllForCompany(companyId) {
    return this.getAll()
      .filter((b) => b.companyId === companyId)
      .sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.branchName.localeCompare(b.branchName);
      });
  },

  findById(id) {
    return this.getAll().find((b) => b.id === id) || null;
  },

  getPrimary(companyId) {
    return this.getAll().find((b) => b.companyId === companyId && b.isPrimary) || null;
  },

  /** COMP-001-BR-01, COMP-001-BR-02, ... scoped per company, never reused —
      same numbering convention Financial Year and Currency established. */
  nextBranchCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((b) => {
      const match = /-BR-(\d+)$/.exec(b.branchCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-BR-${String(max + 1).padStart(2, "0")}`;
  },

  /** Keeps the Head Office branch's address/contact fields in sync with
      Company Profile. Call this once whenever the Branches page loads.
      Always returns a record (creating one on first visit) since every
      company has *some* registered address the moment it's created. */
  ensurePrimaryBranch(company) {
    const existing = this.getPrimary(company.id);
    const signature = erpBranchAddressSignature(company);

    if (existing) {
      if (existing._addressSignature === signature) return existing; // already in sync
      return this.update(existing.id, {
        address1: company.address1 || "", address2: company.address2 || "",
        city: company.city || "", state: company.state || "", country: company.country || "",
        pincode: company.pincode || "", contactPhone: company.phone || "", contactEmail: company.email || "",
        _addressSignature: signature
      });
    }

    const record = {
      id: "BR-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      branchCode: this.nextBranchCode(company),
      branchName: "Head Office",
      branchType: "Head Office",
      address1: company.address1 || "", address2: company.address2 || "",
      city: company.city || "", state: company.state || "", country: company.country || "",
      pincode: company.pincode || "",
      contactPerson: "",
      contactPhone: company.phone || "",
      contactEmail: company.email || "",
      gstRegistrationId: null,
      status: "Active",
      isPrimary: true,
      _addressSignature: signature,
      createdAt: new Date().toISOString()
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  create(company, data) {
    const record = {
      id: "BR-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      branchCode: this.nextBranchCode(company),
      isPrimary: false,
      status: "Active",
      gstRegistrationId: null,
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
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Active <-> Inactive — blocked for the Head Office. */
  toggleStatus(id) {
    const branch = this.findById(id);
    if (!branch || branch.isPrimary) return null;
    return this.update(id, { status: branch.status === "Active" ? "Inactive" : "Active" });
  },

  remove(id) {
    const branch = this.findById(id);
    if (!branch || branch.isPrimary) return false;
    const all = this.getAll().filter((b) => b.id !== id);
    this._saveAll(all);
    return true;
  },

  hasDuplicateName(companyId, branchName, excludeId) {
    const target = branchName.trim().toLowerCase();
    return this.getAllForCompany(companyId).some((b) => b.id !== excludeId && b.branchName.trim().toLowerCase() === target);
  }
};
