/* =============================================================================
   DOT ERP
   FILE:  data/company-data.js
   ROLE:  Data-access layer for company records — the foundation every other
          Company Setup module (Financial Year, Currency, GST, Branches,
          Departments, Cost Centers, Warehouses, Company Settings) will read
          from as they're built. Supports more than one company, the way a
          real system lets one login manage several legal entities, with a
          single "active company" the rest of the app treats as current.

   TRAINING NOTE
   Real ERPs almost always support multiple companies/legal entities under
   one login (an accountant managing several clients, a group with several
   subsidiaries). "Active company" here plays the same role SAP's Company
   Code or Tally's "current company" does — everything else you build later
   should scope itself to whichever company is active.
   ========================================================================== */

const ERP_COMPANIES_KEY = "erp_companies";
const ERP_ACTIVE_COMPANY_KEY = "erp_active_company_id";

const ERP_CompanyRepository = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_COMPANIES_KEY)) || []; }
    catch { return []; }
  },

  _saveAll(list) {
    try { localStorage.setItem(ERP_COMPANIES_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getActiveId() {
    try { return localStorage.getItem(ERP_ACTIVE_COMPANY_KEY); }
    catch { return null; }
  },

  getActive() {
    const id = this.getActiveId();
    if (!id) return null;
    return this.getAll().find((c) => c.id === id) || null;
  },

  setActive(id) {
    try { localStorage.setItem(ERP_ACTIVE_COMPANY_KEY, id); return true; }
    catch { return false; }
  },

  findById(id) {
    return this.getAll().find((c) => c.id === id) || null;
  },

  /** Case-insensitive name match — used for the create wizard's duplicate check. */
  findByName(name) {
    const needle = String(name || "").trim().toLowerCase();
    return this.getAll().find((c) => c.name.trim().toLowerCase() === needle) || null;
  },

  /** COMP-001, COMP-002, ... regardless of deletions, so codes are never reused. */
  nextCompanyCode() {
    const all = this.getAll();
    let max = 0;
    all.forEach((c) => {
      const match = /^COMP-(\d+)$/.exec(c.companyCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return "COMP-" + String(max + 1).padStart(3, "0");
  },

  create(data) {
    const all = this.getAll();
    const record = {
      id: "CO-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyCode: this.nextCompanyCode(),
      status: "Active",
      createdAt: new Date().toISOString(),
      ...data
    };
    all.push(record);
    this._saveAll(all);
    // First company created automatically becomes the active one.
    if (!this.getActiveId()) this.setActive(record.id);
    return record;
  },

  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial };
    this._saveAll(all);
    return all[idx];
  },

  remove(id) {
    const all = this.getAll().filter((c) => c.id !== id);
    this._saveAll(all);
    // If the deleted company was active, fall back to another one (or none).
    if (this.getActiveId() === id) {
      if (all.length) this.setActive(all[0].id);
      else { try { localStorage.removeItem(ERP_ACTIVE_COMPANY_KEY); } catch { /* ignore */ } }
    }
  }
};
