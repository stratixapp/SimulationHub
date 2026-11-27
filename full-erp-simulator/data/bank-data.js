/* =============================================================================
   DOT ERP
   FILE:  data/bank-data.js
   ROLE:  Data-access layer for Bank Master — Phase 3, Module 10, the LAST
          module of Phase 3. This is exactly where Vendor Master's deferred
          bank-detail retrofit becomes due (see vendor-data.js's own header,
          written back in Module 02): vendors carry their own bankName/
          bankAccountNumber/bankIfsc as a forward-dependency placeholder,
          and this file is what they finally get to link to instead.

   IFSC PATTERN — OWNERSHIP MOVES HERE: Vendor Master defined its own
   `ERP_VENDOR_IFSC_RE` as a stopgap because Bank Master didn't exist yet.
   Bank Master is this pattern's REAL home now (the same way GST Details
   owns the GSTIN regex and Vendor Master merely imports it) — this file's
   `ifscPattern` is what the Vendor retrofit's form validation is updated to
   use, with Vendor Master's own copy kept only as a fallback for if this
   script somehow isn't loaded, never as the primary source of truth again.

   BANK NAME IS NOT UNIQUE, ACCOUNT NUMBER IS: a company can legitimately
   hold multiple accounts at the same bank (a current account and a
   separate collections account at the same branch, say), so `bankName`
   is plain free text with no duplicate check. `accountNumber` is what
   actually identifies one real account, so that's the hard-blocked field
   — the same "duplicate-check whatever's ACTUALLY unique in the real
   world, not whatever merely looks like a name" discipline Vendor Master's
   own gstin-vs-vendorName split already established.

   DEFAULT BANK ACCOUNT: the same plain-toggle singleton pattern as Tax
   Master's/Payment Terms' isDefault — "which account should a payment
   screen pre-fill," a preference, not a structural rule.

   RETROFIT SHAPE ON THE VENDOR SIDE: `bankId` (optional, added to vendor
   records in this same pass) with the vendor's own bankName/bankAccount-
   Number/bankIfsc kept as the free-text FALLBACK — the identical id-first-
   fallback-to-value shape as Warehouses' branchId/useCustomAddress and
   Cost Centers' responsibleEmployeeId/responsiblePerson. See vendor-
   data.js's own updated header for getEffectiveBankDetails().

   DELETE GUARD: refuses if any vendor currently links to this bank
   account via `bankId` — unlike Category/Unit/Tax/HSN's "no guard, the
   consumer degrades gracefully" stance, a bank ACCOUNT being silently
   pulled out from under a vendor that's actively paying against it is a
   sharper real-world problem than a missing category label, so this one
   DOES hard-block, the same reasoning Departments'/Category Master's
   hasChildren uses for their own structural relationship — except here
   the "structural relationship" reaches into an already-shipped module
   (Vendor Master) rather than staying within Bank Master's own tree. This
   is a deliberate, considered exception to the "cross-module references
   never hard-block the referenced side" convention, not an oversight —
   money moving through a deleted account is a different order of harm
   than a UI label reading "Category removed."

   RETROFITTED (Phase 6, the GL retrofit pass): added `linkedAccountId`,
   pointing at a Chart of Accounts Ledger account — the gap Bank
   Reconciliation's own header explicitly deferred and flagged for this
   exact moment ("a real link from Bank Master to a Chart of Accounts
   Ledger account would let this module read Journal Entry directly").
   Vendor Payment and Receipt both already carry `bankId`; once a Bank
   Master record also carries `linkedAccountId`, `gl-posting-data.js` can
   resolve "which real Ledger account does this specific bank account's
   money move through" without guessing — the same id-first-fallback
   shape Vendor Master's own `bankId` retrofit already established, here
   with no free-text fallback at all (there's no sensible text stand-in
   for "the Ledger account representing this bank," unlike a bank name/
   account number which genuinely has a plain-text equivalent).
   ========================================================================== */

const ERP_BANKS_KEY = "erp_banks";

const ERP_BANK_ACCOUNT_TYPES = ["Current", "Savings", "Cash Credit", "Overdraft"];

/** Same structural rule as Vendor Master's original stopgap copy — this
    file is now the canonical home for it. See file header. */
const ERP_BANK_IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const ERP_BankRepository = {
  accountTypes: ERP_BANK_ACCOUNT_TYPES,
  ifscPattern: ERP_BANK_IFSC_RE,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_BANKS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_BANKS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((b) => b.companyId === companyId)
      .sort((a, b) => a.bankName.localeCompare(b.bankName));
  },

  findById(id) {
    return this.getAll().find((b) => b.id === id) || null;
  },

  getActiveForCompany(companyId) {
    return this.getAllForCompany(companyId).filter((b) => b.status === "Active");
  },

  getDefault(companyId) {
    return this.getAllForCompany(companyId).find((b) => b.isDefault) || null;
  },

  /** COMP-001-BANK-01, COMP-001-BANK-02, ... */
  nextBankCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((b) => {
      const match = /-BANK-(\d+)$/.exec(b.bankCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-BANK-${String(max + 1).padStart(2, "0")}`;
  },

  /** Only accountNumber is duplicate-checked — see file header for why
      bankName deliberately is not. */
  hasDuplicateAccountNumber(companyId, accountNumber, excludeId) {
    const target = accountNumber.trim();
    return this.getAllForCompany(companyId).some((b) => b.id !== excludeId && b.accountNumber.trim() === target);
  },

  /** "HDFC Bank •••• 4821 (Current)" — a masked, display-safe label used
      anywhere a bank account needs to be shown in a compact list (the
      table, and the Vendor retrofit's linked-account preview). */
  maskedLabel(bank) {
    const acct = String(bank.accountNumber || "");
    const last4 = acct.slice(-4).padStart(4, "•");
    return `${bank.bankName} •••• ${last4} (${bank.accountType})`;
  },

  /** True if any vendor currently links to this bank account — the one
      hard delete-guard exception documented in the file header. Reads
      ERP_VendorRepository defensively (undefined if vendors.js/vendor-
      data.js aren't loaded on whatever page calls this). */
  isLinkedByVendor(companyId, id) {
    if (typeof ERP_VendorRepository === "undefined") return false;
    return ERP_VendorRepository.getAllForCompany(companyId).some((v) => v.bankId === id);
  },

  create(company, data) {
    const record = {
      id: "BANK-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      bankCode: this.nextBankCode(company),
      accountType: "Current",
      branchName: "",
      linkedAccountId: null,
      upiId: "",
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
    const idx = all.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    if (partial.isDefault) this.setDefault(id, all[idx].companyId);
    return all[idx];
  },

  /** Clears `isDefault` on every other bank account for the company first
      — same shape as Tax Master's/Payment Terms' setDefault(). */
  setDefault(id, companyId) {
    const all = this.getAll();
    all.forEach((b) => { if (b.companyId === companyId) b.isDefault = b.id === id; });
    this._saveAll(all);
    return this.findById(id);
  },

  toggleStatus(id) {
    const bank = this.findById(id);
    if (!bank) return null;
    return this.update(id, { status: bank.status === "Active" ? "Inactive" : "Active" });
  },

  /** Refuses while a vendor still links to this account — see file
      header for why Bank Master is a deliberate exception to this
      codebase's usual "consumer degrades gracefully" convention. */
  remove(id, companyId) {
    if (this.isLinkedByVendor(companyId, id)) return false;
    const all = this.getAll().filter((b) => b.id !== id);
    this._saveAll(all);
    return true;
  }
};
