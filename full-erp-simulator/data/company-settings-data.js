/* =============================================================================
   DOT ERP
   FILE:  data/company-settings-data.js
   ROLE:  Data-access layer for Company Settings — Phase 2, Module 10 (the
          last module in Phase 2).

   A FOURTH SHAPE, NOT A LIST AT ALL —
   Every earlier Phase 2 module (Currency, GST, Branches, Departments, Cost
   Centers, Warehouses) is a LIST: many records per company, each with its
   own lifecycle. Company Settings is different in the same direction
   Company Profile already is — there is exactly ONE settings record per
   company, always. So this repository is a "get-or-create singleton,"
   the same spirit as Currency's ensureBaseCurrency/GST's
   ensurePrimaryRegistration/Branch's ensurePrimaryBranch anchor pattern,
   but simpler still: there's no "one flagged record among many" to keep in
   sync, just one record, full stop. getForCompany() below IS the anchor
   call — safe and idempotent to call from any page, same as those three.
   This is also why the page has no Add/Edit/Delete, no list, no filters,
   no sort, no pagination, and no per-record Detail modal — there's only
   ever one record, so the whole page IS its detail/edit view. See the
   page's own Help Guide for why those omissions are deliberate, not
   missing scope.

   WHAT THIS MODULE OWNS vs. WHAT IT JUST SUMMARIZES —
   The Company Settings PAGE also shows a read-only "Configuration
   Overview" of things owned by earlier modules (base currency, current
   financial year, primary GST registration, Head Office) as summary tiles
   that link back to their real owning page — it does not re-implement
   editing for any of them here. This file only stores what genuinely has
   no other home: document numbering (a real ERP admin concern — SAP calls
   these Number Ranges, Tally calls it Voucher Numbering), a handful of
   forward-looking operational toggles that Phase 4/5/6 will eventually
   read (approval thresholds, multi-currency, batch tracking, negative
   stock, GRN-before-invoice), and a few simple numeric defaults
   (payment terms, order validity, low-stock threshold).
   ========================================================================== */

const ERP_COMPANY_SETTINGS_KEY = "erp_company_settings";

/** A fixed, speculative vocabulary — the document types Phase 4/5/6 will
    eventually issue. Exposed as a plain array, same convention as GST's
    rate slabs and Cost Centers' categories, so the page can build its
    numbering table directly from this list rather than hardcoding it a
    second time. */
const ERP_DOCUMENT_TYPES = [
  { key: "purchaseRequisition", label: "Purchase Requisition", defaultPrefix: "PR" },
  { key: "purchaseOrder", label: "Purchase Order", defaultPrefix: "PO" },
  { key: "salesOrder", label: "Sales Order", defaultPrefix: "SO" },
  { key: "taxInvoice", label: "Tax Invoice", defaultPrefix: "INV" },
  { key: "goodsReceiptNote", label: "Goods Receipt Note", defaultPrefix: "GRN" },
  { key: "stockTransfer", label: "Stock Transfer", defaultPrefix: "ST" }
];

const ERP_NUMBERING_RESET_FREQUENCIES = ["Never", "Yearly", "Monthly"];


const ERP_CompanySettingsRepository = {
  documentTypes: ERP_DOCUMENT_TYPES,
  resetFrequencies: ERP_NUMBERING_RESET_FREQUENCIES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_COMPANY_SETTINGS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_COMPANY_SETTINGS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  _defaultsFor(companyId) {
    const numbering = {};
    ERP_DOCUMENT_TYPES.forEach((dt) => {
      numbering[dt.key] = { prefix: dt.defaultPrefix, nextNumber: 1, resetFrequency: "Yearly" };
    });
    return {
      companyId,
      numbering,
      requireApprovalAboveThreshold: true,
      approvalThreshold: 50000,
      enableMultiCurrency: false,
      enableBatchTracking: false,
      allowNegativeStock: false,
      requireGrnBeforeInvoice: true,
      defaultPaymentTermsDays: 30,
      defaultOrderValidityDays: 15,
      lowStockThresholdPct: 20,
      updatedAt: new Date().toISOString()
    };
  },

  /** The anchor call. Every company effectively HAS settings the moment it
      exists — there's no meaningful "hasn't been set up yet" state to show
      the user, unlike Currency/GST/Branches, which do show an explicit
      "not linked yet" empty state for their anchor field. Get-or-create,
      no separate Add step. */
  getForCompany(companyId) {
    const all = this.getAll();
    let rec = all.find((s) => s.companyId === companyId);
    if (!rec) {
      rec = this._defaultsFor(companyId);
      all.push(rec);
      this._saveAll(all);
    } else {
      // Guard against an older record predating a document type or field
      // this session's version of the module added — fill gaps, keep values.
      let changed = false;
      ERP_DOCUMENT_TYPES.forEach((dt) => {
        if (!rec.numbering[dt.key]) {
          rec.numbering[dt.key] = { prefix: dt.defaultPrefix, nextNumber: 1, resetFrequency: "Yearly" };
          changed = true;
        }
      });
      if (changed) this.update(companyId, { numbering: rec.numbering });
    }
    return rec;
  },

  update(companyId, partial) {
    const all = this.getAll();
    let idx = all.findIndex((s) => s.companyId === companyId);
    if (idx === -1) { all.push(this._defaultsFor(companyId)); idx = all.length - 1; }
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  resetToDefaults(companyId) {
    const all = this.getAll();
    const idx = all.findIndex((s) => s.companyId === companyId);
    const fresh = this._defaultsFor(companyId);
    if (idx === -1) all.push(fresh); else all[idx] = fresh;
    this._saveAll(all);
    return fresh;
  }
};
