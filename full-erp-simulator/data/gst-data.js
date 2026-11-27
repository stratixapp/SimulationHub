/* =============================================================================
   DOT ERP
   FILE:  data/gst-data.js
   ROLE:  Data-access layer for GST Details — Phase 2, Module 05.

   Company Profile already owns a single company-level `gstin` field (and a
   `state`) — this module does not re-collect either. Instead it treats
   Company Profile's GSTIN as the company's PRIMARY, home-state GST
   registration and builds the real depth GST compliance needs around it:
   every OTHER state the business is registered in (India's GST is a
   state-wise tax — one legal entity can hold a separate GSTIN per state
   it operates in, all sharing the same PAN), the standard GST rate slabs
   the business actually uses, and its return-filing preferences.

   GSTIN STRUCTURE (why state is derived, not typed):
   digits 1-2 = state code, next 10 = PAN, digit 13 = entity number for that
   PAN+state, digit 14 is always "Z", digit 15 is a checksum. This module
   validates the STRUCTURE (same regex Company Profile already uses) and
   derives the state from the first two digits — it does not compute the
   real checksum algorithm, which is out of scope for a training simulator.
   ========================================================================== */

const ERP_GST_REGISTRATIONS_KEY = "erp_gst_registrations";
const ERP_GST_RATE_PREFS_KEY = "erp_gst_rate_prefs";
const ERP_GST_SETTINGS_KEY = "erp_gst_settings";

/** Same structural check Company Profile / Create Company already use —
    kept identical on purpose so a GSTIN accepted there is accepted here. */
const ERP_GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Official India GST jurisdiction state/UT codes (the first two digits of
    every GSTIN). Code 28 is deliberately kept alongside 37 — both are real:
    28 was Andhra Pradesh's code before the 2014 state bifurcation, and many
    older GSTINs still carry it, which is a genuine, well-known source of
    confusion this module's Help Guide calls out on purpose. */
const ERP_GST_STATE_CODES = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
  "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman and Diu", "26": "Dadra and Nagar Haveli",
  "27": "Maharashtra", "28": "Andhra Pradesh (Old Code)", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory", "99": "Centre Jurisdiction"
};

/** The statutory GST rate slabs — fixed by law, not something a business can
    invent. A company can only choose which of these it actually uses. */
const ERP_GST_RATE_REFERENCE = [
  { rate: 0, label: "Nil-Rated / Exempt", description: "Essential goods and services — unbranded food staples, fresh produce, healthcare, education." },
  { rate: 0.25, label: "0.25%", description: "Rough precious and semi-precious stones." },
  { rate: 3, label: "3%", description: "Gold, silver, and other precious metals and jewellery." },
  { rate: 5, label: "5%", description: "Household necessities — packaged food, coal, transport services." },
  { rate: 12, label: "12%", description: "Processed food, business-class air travel, computers." },
  { rate: 18, label: "18%", description: "Standard rate — most goods and services, including most B2B supplies." },
  { rate: 28, label: "28%", description: "Luxury and sin goods — cars, tobacco, aerated drinks." }
];

function erpGstTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function erpGstDeriveState(gstin) {
  const code = String(gstin).slice(0, 2);
  return ERP_GST_STATE_CODES[code] || "Unknown";
}


const ERP_GstRepository = {
  stateCodes: ERP_GST_STATE_CODES,
  rateReference: ERP_GST_RATE_REFERENCE,
  gstinPattern: ERP_GSTIN_RE,
  deriveState: erpGstDeriveState,

  /* -------------------------- state-wise registrations ------------------ */
  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_GST_REGISTRATIONS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_GST_REGISTRATIONS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** Primary registration first, then the rest alphabetically by state. */
  getAllForCompany(companyId) {
    return this.getAll()
      .filter((r) => r.companyId === companyId)
      .sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.state.localeCompare(b.state);
      });
  },

  findById(id) {
    return this.getAll().find((r) => r.id === id) || null;
  },

  findByGstin(companyId, gstin) {
    return this.getAll().find((r) => r.companyId === companyId && r.gstin === gstin) || null;
  },

  getPrimary(companyId) {
    return this.getAll().find((r) => r.companyId === companyId && r.isPrimary) || null;
  },

  /** Keeps the registration list in sync with whatever Company Profile says
      the company's GSTIN is. Call this once whenever the GST Details page
      loads. Returns the primary registration, or null if the company has
      no GSTIN set (an unregistered business — nothing to anchor yet). */
  ensurePrimaryRegistration(company) {
    const gstin = (company.gstin || "").trim().toUpperCase();
    const existingPrimary = this.getPrimary(company.id);

    if (existingPrimary && existingPrimary.gstin === gstin && gstin) {
      return existingPrimary; // already in sync
    }

    const all = this.getAll();

    if (existingPrimary) {
      // Company Profile's GSTIN changed (or was cleared) since we last
      // checked — demote the old primary to an ordinary Active registration
      // rather than deleting it; it's still a real registration on record.
      const idx = all.findIndex((r) => r.id === existingPrimary.id);
      all[idx] = { ...all[idx], isPrimary: false };
    }

    if (!gstin) {
      this._saveAll(all);
      return null;
    }

    let newPrimary = all.find((r) => r.companyId === company.id && r.gstin === gstin);
    if (newPrimary) {
      const idx = all.findIndex((r) => r.id === newPrimary.id);
      all[idx] = { ...all[idx], isPrimary: true, status: "Active" };
      newPrimary = all[idx];
    } else {
      newPrimary = {
        id: "GSTREG-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
        companyId: company.id,
        gstin,
        state: erpGstDeriveState(gstin),
        registrationType: "Regular",
        status: "Active",
        isPrimary: true,
        effectiveDate: erpGstTodayISO(),
        jurisdictionWard: "",
        notes: "Primary registration — synced from Company Profile.",
        createdAt: new Date().toISOString(),
        cancelledAt: null
      };
      all.push(newPrimary);
    }

    this._saveAll(all);
    return newPrimary;
  },

  create(company, data) {
    const record = {
      id: "GSTREG-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      isPrimary: false,
      status: "Active",
      jurisdictionWard: "",
      notes: "",
      createdAt: new Date().toISOString(),
      cancelledAt: null,
      ...data,
      state: erpGstDeriveState(data.gstin)
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Active <-> Cancelled — blocked for the primary registration, which
      stays tied to Company Profile's own identity. */
  toggleStatus(id) {
    const reg = this.findById(id);
    if (!reg || reg.isPrimary) return null;
    const cancelling = reg.status === "Active";
    return this.update(id, {
      status: cancelling ? "Cancelled" : "Active",
      cancelledAt: cancelling ? new Date().toISOString() : null
    });
  },

  remove(id) {
    const reg = this.findById(id);
    if (!reg || reg.isPrimary) return false;
    const all = this.getAll().filter((r) => r.id !== id);
    this._saveAll(all);
    return true;
  },

  hasDuplicateGstin(companyId, gstin, excludeId) {
    return this.getAllForCompany(companyId).some((r) => r.id !== excludeId && r.gstin === gstin);
  },

  /* ------------------------------ rate slabs ----------------------------- */
  getRatePrefs(companyId) {
    let store = {};
    try { store = JSON.parse(localStorage.getItem(ERP_GST_RATE_PREFS_KEY)) || {}; } catch { /* ignore */ }
    // Default: every statutory slab enabled, until the company disables one.
    return store[companyId] || ERP_GST_RATE_REFERENCE.map((r) => r.rate);
  },

  toggleRate(companyId, rate) {
    let store = {};
    try { store = JSON.parse(localStorage.getItem(ERP_GST_RATE_PREFS_KEY)) || {}; } catch { /* ignore */ }
    const current = store[companyId] || ERP_GST_RATE_REFERENCE.map((r) => r.rate);
    const enabled = current.includes(rate) ? current.filter((r) => r !== rate) : [...current, rate];
    store[companyId] = enabled;
    localStorage.setItem(ERP_GST_RATE_PREFS_KEY, JSON.stringify(store));
    return enabled;
  },

  /* ---------------------------- filing settings -------------------------- */
  getSettings(companyId) {
    let store = {};
    try { store = JSON.parse(localStorage.getItem(ERP_GST_SETTINGS_KEY)) || {}; } catch { /* ignore */ }
    return store[companyId] || { returnFrequency: "Monthly", eInvoiceApplicable: false, eWayBillThreshold: 50000 };
  },

  updateSettings(companyId, partial) {
    let store = {};
    try { store = JSON.parse(localStorage.getItem(ERP_GST_SETTINGS_KEY)) || {}; } catch { /* ignore */ }
    const current = store[companyId] || { returnFrequency: "Monthly", eInvoiceApplicable: false, eWayBillThreshold: 50000 };
    store[companyId] = { ...current, ...partial };
    localStorage.setItem(ERP_GST_SETTINGS_KEY, JSON.stringify(store));
    return store[companyId];
  }
};
