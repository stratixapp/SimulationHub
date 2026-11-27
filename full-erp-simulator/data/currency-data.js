/* =============================================================================
   DOT ERP
   FILE:  data/currency-data.js
   ROLE:  Data-access layer for Currency Master — Phase 2, Module 04.

   Company Profile already owns a single `baseCurrency` field (Module 2) —
   this module does NOT duplicate that choice. Instead it treats whatever
   Company Profile says the base currency is as the anchor, and builds real
   multi-currency depth around it: a currency master list per company, an
   exchange rate for every non-base currency (quoted as "1 <currency> =
   <rate> <base currency>", the way an Indian business would naturally quote
   USD/EUR/GBP/AED against INR), and a full rate-history log — because in
   any real ERP, exchange rates are something you update over time, not set
   once and forget.

   RATE CONVENTION (used everywhere in this module):
     currentRate = how many units of the BASE currency equal 1 unit of THIS
     currency. The base currency's own currentRate is always exactly 1.
   ========================================================================== */

const ERP_CURRENCIES_KEY = "erp_currencies";

/** A starter reference list a user can pick from when adding a currency —
    real ERPs ship a standard currency master the same way. Deliberately
    includes a few currencies with non-standard decimal places (JPY/KRW/VND
    use 0, BHD/KWD/OMR use 3) so the concept of decimalPlaces means something
    when it's explained in the Help Guide. */
const ERP_CURRENCY_REFERENCE_LIST = [
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimalPlaces: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", decimalPlaces: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "AED", decimalPlaces: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimalPlaces: 0 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimalPlaces: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimalPlaces: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", decimalPlaces: 2 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimalPlaces: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimalPlaces: 2 },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", decimalPlaces: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", decimalPlaces: 2 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimalPlaces: 2 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", decimalPlaces: 0 },
  { code: "THB", name: "Thai Baht", symbol: "฿", decimalPlaces: 2 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimalPlaces: 2 },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", decimalPlaces: 0 },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BD", decimalPlaces: 3 },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KD", decimalPlaces: 3 },
  { code: "OMR", name: "Omani Rial", symbol: "OMR", decimalPlaces: 3 },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", decimalPlaces: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", decimalPlaces: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", decimalPlaces: 2 },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", decimalPlaces: 2 }
];

function erpCurrencyRefFor(code) {
  return ERP_CURRENCY_REFERENCE_LIST.find((c) => c.code === code) || { code, name: code, symbol: code, decimalPlaces: 2 };
}


const ERP_CurrencyRepository = {
  referenceList: ERP_CURRENCY_REFERENCE_LIST,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_CURRENCIES_KEY)) || []; }
    catch { return []; }
  },

  _saveAll(list) {
    try { localStorage.setItem(ERP_CURRENCIES_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** All currencies for one company — base currency always first, then the
      rest alphabetically by code. */
  getAllForCompany(companyId) {
    return this.getAll()
      .filter((c) => c.companyId === companyId)
      .sort((a, b) => {
        if (a.isBase !== b.isBase) return a.isBase ? -1 : 1;
        return a.code.localeCompare(b.code);
      });
  },

  findById(id) {
    return this.getAll().find((c) => c.id === id) || null;
  },

  findByCode(companyId, code) {
    return this.getAll().find((c) => c.companyId === companyId && c.code === code) || null;
  },

  getBase(companyId) {
    return this.getAll().find((c) => c.companyId === companyId && c.isBase) || null;
  },

  /** Keeps the currency master in sync with whatever Company Profile says
      the base currency is. Call this once whenever the Currency page loads.
      Returns the (possibly newly created) base currency record. */
  ensureBaseCurrency(company) {
    const existingBase = this.getBase(company.id);

    if (existingBase && existingBase.code === company.baseCurrency) {
      return existingBase; // already in sync, nothing to do
    }

    const all = this.getAll();

    if (existingBase && existingBase.code !== company.baseCurrency) {
      // Company Profile's base currency changed since we last checked — demote
      // the old base to an ordinary currency (rate reset to 1 until someone
      // updates it; a real ERP would treat re-basing as a major project, not
      // a one-click change, but this simulator keeps the concept visible and
      // honest rather than silently losing the old base's row).
      const idx = all.findIndex((c) => c.id === existingBase.id);
      all[idx] = {
        ...all[idx],
        isBase: false,
        currentRate: 1,
        rateHistory: [
          ...all[idx].rateHistory,
          { id: "R" + String(all[idx].rateHistory.length + 1).padStart(2, "0"), rate: 1, effectiveDate: new Date().toISOString().slice(0, 10), note: "Base currency changed — rate reset, needs updating.", updatedAt: new Date().toISOString() }
        ]
      };
    }

    // Create (or re-create) the new base currency, reusing an existing
    // non-base record with the same code if one already happens to exist.
    let newBase = all.find((c) => c.companyId === company.id && c.code === company.baseCurrency);
    if (newBase) {
      const idx = all.findIndex((c) => c.id === newBase.id);
      all[idx] = { ...all[idx], isBase: true, status: "Active", currentRate: 1 };
      newBase = all[idx];
    } else {
      const ref = erpCurrencyRefFor(company.baseCurrency);
      newBase = {
        id: "CUR-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
        companyId: company.id,
        code: ref.code,
        name: ref.name,
        symbol: ref.symbol,
        decimalPlaces: ref.decimalPlaces,
        isBase: true,
        status: "Active",
        currentRate: 1,
        rateHistory: [{ id: "R01", rate: 1, effectiveDate: new Date().toISOString().slice(0, 10), note: "Set as base currency.", updatedAt: new Date().toISOString() }],
        createdAt: new Date().toISOString()
      };
      all.push(newBase);
    }

    this._saveAll(all);
    return newBase;
  },

  create(company, data) {
    const record = {
      id: "CUR-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      isBase: false,
      status: "Active",
      rateHistory: [{ id: "R01", rate: data.currentRate, effectiveDate: data.effectiveDate, note: data.note || "Initial rate.", updatedAt: new Date().toISOString() }],
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

  updateRate(id, { rate, effectiveDate, note }) {
    const currency = this.findById(id);
    if (!currency) return null;
    const entry = { id: "R" + String(currency.rateHistory.length + 1).padStart(2, "0"), rate, effectiveDate, note: note || "", updatedAt: new Date().toISOString() };
    return this.update(id, { currentRate: rate, rateHistory: [...currency.rateHistory, entry] });
  },

  toggleStatus(id) {
    const currency = this.findById(id);
    if (!currency || currency.isBase) return null;
    return this.update(id, { status: currency.status === "Active" ? "Inactive" : "Active" });
  },

  remove(id) {
    const currency = this.findById(id);
    if (!currency || currency.isBase) return false;
    const all = this.getAll().filter((c) => c.id !== id);
    this._saveAll(all);
    return true;
  },

  /** Reference-list entries not yet added for this company (and not the
      base currency, which is managed automatically). Powers the Add
      Currency picker. */
  availableToAdd(companyId) {
    const existingCodes = new Set(this.getAllForCompany(companyId).map((c) => c.code));
    return ERP_CURRENCY_REFERENCE_LIST.filter((c) => !existingCodes.has(c.code));
  }
};
