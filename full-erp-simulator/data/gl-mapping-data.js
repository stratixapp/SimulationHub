/* =============================================================================
   DOT ERP
   FILE:  data/gl-mapping-data.js
   ROLE:  GL Account Mapping — the configuration layer the entire Phase 6
          retrofit pass (item 10, "the single most important piece of
          this whole phase") depends on. Read this file before touching
          gl-posting-data.js or any of the 5 retrofitted modules.

   THE PROBLEM THIS FILE EXISTS TO SOLVE: auto-posting a journal entry
   needs a REAL Chart of Accounts Ledger account id to debit and credit —
   but nothing anywhere in this project has ever recorded "which account
   IS Inventory" or "which account IS Accounts Payable." A trainee's
   Chart of Accounts might name that account "Inventory," "Stock in
   Hand," or something else entirely, at whatever code they chose. Every
   real ERP solves this the same way: a small, explicit configuration
   screen — SAP calls it Account Determination, Tally calls it Ledger
   Mapping to Voucher Types, QuickBooks/Zoho just call it default
   accounts — where a human designates which real account plays which
   accounting ROLE. This file is that mapping, and nothing else; it
   creates, edits, and deletes nothing about the business, only which
   existing Chart of Accounts records to point at.

   THIRTEEN ROLES BECAME EIGHTEEN IN PHASE 12's OWN FIXED ASSETS
   RETROFIT: Fixed Assets (at cost), Accumulated Depreciation,
   Depreciation Expense, Gain on Asset Disposal, and Loss on Asset
   Disposal — five new roles, all REQUIRED. Gain and Loss deliberately
   stay as TWO SEPARATE roles rather than one net "Gain/Loss on
   Disposal" account — a real P&L keeps Other Income and Other Expense
   apart, and `gl-posting-data.js`'s own `postAssetDisposal()` picks
   whichever one line actually applies to a given disposal (never both;
   see that function's own comments). Per-asset-CATEGORY GL segregation
   (a separate Fixed Asset account for Vehicles vs. Computers vs.
   Buildings, the way real published financial statements usually
   present them) was considered and deliberately NOT built — one
   `fixedAssetAccountId` covers every category uniformly, the same
   proportionate-scope call the single `inventoryAccountId` role already
   made for Item Master's own several item types, rather than an eight-
   role explosion for a distinction this simulator doesn't otherwise need.

   ELEVEN ROLES BECAME THIRTEEN IN PHASE 10's OWN MANUFACTURING RETROFIT:
   Work-in-Progress and Finished Goods Inventory, the two new accounts
   Material Issue's and Finished Goods Receipt's own GL postings need
   (see gl-posting-data.js's own header for the full three-account flow —
   Inventory → WIP → Finished Goods Inventory — and why the EXISTING
   `inventoryAccountId` role is reused for the raw-materials leg rather
   than adding a fourth new role for it). Both new roles are REQUIRED,
   not conditional — unlike Payroll's own PF/PT/TDS roles, a Work Order
   that issues any material at all always has a nonzero amount to post,
   so there's no legitimate "zero this period" case that would justify
   marking either optional the way Payroll's own liability roles are.

   SIX ROLES BECAME ELEVEN IN PHASE 9's OWN GL RETROFIT — NO INPUT TAX
   MAPPING STILL, ON PURPOSE: the original six (Procurement, then Sales)
   never mirrored Output Tax with an Input Tax role, because Invoice
   Verification's own `computeGrandTotal()` never separates a tax
   component at all — re-checked directly in that file rather than
   assumed before deciding to leave this role out, and that reasoning is
   still true today. What's new: Payroll Processing (Phase 9) needed its
   own five roles once its own GL posting was built — Salary Expense (the
   Dr side) plus PF Payable, Professional Tax Payable, TDS Payable, and
   Salary Payable (the Cr side, one per liability a payroll run actually
   creates). Adding a mapping role nothing can ever populate would still
   be worse than not having it, the same reasoning that kept Input Tax
   out — which is exactly why the three payroll liability roles below are
   marked conditional, not required, in `posting-rules.js`'s own
   readiness check: a run with genuinely zero TDS across every employee
   that period has nothing to post to a TDS Payable account, the same way
   an untaxed Tax Invoice has nothing to post to Output Tax Payable.

   ONE MAPPING PER COMPANY, NOT PER TRANSACTION TYPE OR PER VENDOR/
   CUSTOMER: real mid-market ERPs sometimes support per-vendor or
   per-item-category account overrides; this project's Chart of Accounts
   has no such granularity anywhere else (Vendor Master doesn't carry a
   "default expense account," Item Master doesn't carry a "default
   inventory account"), so building that granularity only for GL Mapping
   would invent a level of configuration nothing else in the project
   supports or needs yet. One set of roles per company, full stop —
   matching the training-simulator scope every other Phase 6/9 module has
   held to.

   TWENTY ROLES BECAME TWENTY-TWO IN THE PHASE 19 STOCK-MOVEMENT RETROFIT
   (item 1 of that pass — see gl-posting-data.js's own header for the
   full reasoning on each new posting): Inventory Write-off/Loss and
   Opening Balance Equity, two new roles, both REQUIRED (not
   conditional) by the postings that need them, the same "required
   unless there's a legitimate zero case" test every earlier role
   addition here has used. Inventory Write-off is deliberately ONE
   role serving BOTH directions of Stock Adjustment (Dr for shrinkage,
   Cr for a surplus) and Sales Return's own Damaged/Scrap condition —
   not two separate "Loss" and "Gain" roles the way Asset Disposal
   uses, because a real Chart of Accounts commonly nets small physical
   count variances through one P&L line either way, and this project's
   own Stock Adjustment module already lets one adjustment mix
   shrinkage and surplus lines together, which a two-role split would
   have to arbitrarily net back down anyway.

   NO STORAGE-LAYER VALIDATION THAT A REFERENCED ACCOUNT STILL EXISTS OR
   IS STILL A LEDGER: `set()` just saves whatever account ids it's given.
   gl-posting-data.js's own functions are the ones that actually attempt
   to post against a mapped account and are expected to fail gracefully
   (never throw) if a mapping points at something stale — an account
   since deleted, or one that got converted to a Group after being
   mapped (Chart of Accounts' own `canToggleGroup()` should prevent that
   second case in practice, since a mapped Ledger account will always
   have Journal Entry postings against it once used, which blocks the
   conversion — but this file doesn't assume that guarantee holds
   forever, and neither does gl-posting-data.js).
   ========================================================================== */

const ERP_GL_MAPPING_KEY = "erp_gl_mapping";

/** Every role a Posting Rules screen needs to show, in the order a
    trainee would naturally think through each retrofit pass as it
    shipped (Procurement, then Sales, then Payroll) — not alphabetical. */
const ERP_GL_MAPPING_ROLES = [
  { key: "inventoryAccountId", label: "Inventory", type: "Asset", usedBy: "GRN (goods received)" },
  { key: "grIrClearingAccountId", label: "GR/IR Clearing", type: "Liability", usedBy: "GRN and Invoice Verification (provisional liability between receiving goods and verifying the bill)" },
  { key: "accountsPayableAccountId", label: "Accounts Payable", type: "Liability", usedBy: "Invoice Verification and Vendor Payment" },
  { key: "inputTaxCreditAccountId", label: "Input Tax Credit Receivable", type: "Asset", usedBy: "Invoice Verification (only when a line actually captures real invoiced tax) and Debit Note (reverses it, only when the original note carried tax)" },
  { key: "accountsReceivableAccountId", label: "Accounts Receivable", type: "Asset", usedBy: "Tax Invoice and Receipt" },
  { key: "salesRevenueAccountId", label: "Sales Revenue", type: "Income", usedBy: "Tax Invoice" },
  { key: "outputTaxAccountId", label: "Output Tax Payable", type: "Liability", usedBy: "Tax Invoice (only when an invoice actually carries tax)" },
  { key: "costOfGoodsSoldAccountId", label: "Cost of Goods Sold", type: "Expense", usedBy: "Delivery Challan (Dr, every line with a resolvable item — relieves Inventory at its FIFO cost; see gl-posting-data.js postDeliveryCogs())" },
  { key: "salaryExpenseAccountId", label: "Salary Expense", type: "Expense", usedBy: "Payroll Processing (gross earnings, every run)" },
  { key: "pfPayableAccountId", label: "PF Payable", type: "Liability", usedBy: "Payroll Processing (only when a run actually has PF)" },
  { key: "professionalTaxPayableAccountId", label: "Professional Tax Payable", type: "Liability", usedBy: "Payroll Processing (only when a run actually has Professional Tax)" },
  { key: "tdsPayableAccountId", label: "TDS Payable", type: "Liability", usedBy: "Payroll Processing (only when a run actually has TDS)" },
  { key: "salaryPayableAccountId", label: "Salary Payable", type: "Liability", usedBy: "Payroll Processing (net pay, every run) and Salary Payment" },
  { key: "workInProgressAccountId", label: "Work-in-Progress", type: "Asset", usedBy: "Material Issue for Production (Dr) and Finished Goods Receipt (Cr)" },
  { key: "finishedGoodsInventoryAccountId", label: "Finished Goods Inventory", type: "Asset", usedBy: "Finished Goods Receipt (Dr)" },
  { key: "fixedAssetAccountId", label: "Fixed Assets (at cost)", type: "Asset", usedBy: "Asset Disposal (Cr, clears the asset from books at its own original cost)" },
  { key: "accumulatedDepreciationAccountId", label: "Accumulated Depreciation", type: "Asset", usedBy: "Depreciation Run (Cr, every run) and Asset Disposal (Dr, clears the contra-account)" },
  { key: "depreciationExpenseAccountId", label: "Depreciation Expense", type: "Expense", usedBy: "Depreciation Run (Dr, every run)" },
  { key: "gainOnDisposalAccountId", label: "Gain on Asset Disposal", type: "Income", usedBy: "Asset Disposal (Cr, only when a disposal is actually a gain)" },
  { key: "lossOnDisposalAccountId", label: "Loss on Asset Disposal", type: "Expense", usedBy: "Asset Disposal (Dr, only when a disposal is actually a loss)" },
  { key: "inventoryWriteOffAccountId", label: "Inventory Write-off / Loss", type: "Expense", usedBy: "Stock Adjustment (Dr for shrinkage, Cr for a surplus) and Sales Return (Dr, only for lines returned in Damaged / Scrap condition)" },
  { key: "openingBalanceEquityAccountId", label: "Opening Balance Equity", type: "Equity", usedBy: "Opening Stock (Cr, the one-time balance-sheet opening entry)" }
];

const ERP_GLMappingRepository = {
  roles: ERP_GL_MAPPING_ROLES,

  _emptyMapping(companyId) {
    const m = { companyId };
    ERP_GL_MAPPING_ROLES.forEach((r) => { m[r.key] = null; });
    return m;
  },

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_GL_MAPPING_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_GL_MAPPING_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** Always returns a full mapping object, even if nothing was ever
      configured — every role key present, null where unset. Callers
      never need a separate "does a mapping exist yet" check. */
  get(companyId) {
    const found = this.getAll().find((m) => m.companyId === companyId);
    return found || this._emptyMapping(companyId);
  },

  set(companyId, partial) {
    const all = this.getAll();
    const idx = all.findIndex((m) => m.companyId === companyId);
    const next = { ...this._emptyMapping(companyId), ...(idx !== -1 ? all[idx] : {}), ...partial, companyId, updatedAt: new Date().toISOString() };
    if (idx === -1) all.push(next); else all[idx] = next;
    this._saveAll(all);
    return next;
  },

  /** How many of the roles are actually mapped — the page's own
      "X of N configured" progress figure (N == ERP_GL_MAPPING_ROLES.length,
      never hardcoded here so this stays correct as roles are added). */
  configuredCount(companyId) {
    const m = this.get(companyId);
    return ERP_GL_MAPPING_ROLES.filter((r) => !!m[r.key]).length;
  }
};
