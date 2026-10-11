/* =============================================================================
   DOT ERP
   FILE:  data/gstr1-data.js
   ROLE:  Data-access layer for GSTR-1 — Phase 16, Module 01. The first
          module in this project shaped as an actual STATUTORY RETURN
          rather than an internal reconciliation report — GST Summary
          (Phase 8) already answers "what does our GST position look
          like," but nobody files "GST Summary" with the government.
          GSTR-1 is the real outward-supply return, in the real return's
          own table shapes, with a real filing action.

   READS SALES REGISTER AND CREDIT NOTE, WRITES NEITHER — the same
   "genuine reuse forward, no re-derivation" restraint GST Summary
   itself already showed toward Sales Register and Purchase Register.
   This file adds no new sales-side computation Sales Register doesn't
   already do at line grain; it only re-groups those same rows into the
   shapes GSTR-1's own tables actually require.

   OUTWARD ONLY — NO DEBIT NOTES, AND THAT IS CORRECT, NOT AN OMISSION.
   GSTR-1 reports what THIS business sold. The Debit Note this project
   built in Phase 15 is issued BY this business TO a vendor, reducing
   what the vendor is owed — it belongs in the VENDOR'S OWN GSTR-1, not
   ours, and affects our own GSTR-3B as an input tax credit reversal,
   not this return. A debit note WE might issue TO a customer (raising
   what they owe, the sales-side mirror) is not a feature this project
   has built — nothing in this simulator currently generates one — so
   this file's own "Credit/Debit Notes" table only ever shows Credit
   Notes, named accurately rather than left implying a feature that
   does not exist.

   THE PERIOD IS (year, month) NUMBERS, NOT A "YYYY-MM" STRING — the
   exact convention Payroll and Depreciation Run already established
   for exactly this same shape of period, checked in both those files
   before choosing anything else. `_periodRange()` converts a calendar
   month into the same {fromDate, toDate} filter shape Sales Register's
   own `getRows()` already accepts, so no new filter contract had to be
   invented on either side.

   B2B vs B2C — DECIDED BY WHETHER THE CUSTOMER RECORD CARRIES A GSTIN,
   THE ONLY FACT THIS PROJECT ACTUALLY HAS TO DECIDE IT WITH. Customer
   Master's own `gstin` field (optional, validated when present — see
   that file's own header) is the real-world signal too: a registered
   business quotes its GSTIN on a purchase, an unregistered consumer
   doesn't. B2B rows are grouped (invoice, rate) — the real Table 4
   shape, since one invoice can carry more than one tax rate and each
   rate needs its own row. B2C is grouped (place of supply, rate) with
   no invoice-wise detail — the real, CURRENT simplified Table 7 shape.
   NAMED SIMPLIFICATION: this does not model the older B2C-Large
   invoice-wise threshold rule GST return formats used to require
   separately — that distinction has been phased out of the standard
   filing flow for most taxpayers, so building it would add complexity
   modeling a rule that mostly no longer applies, not a missing feature.

   CREDIT NOTES REPORT IN THE PERIOD THEY WERE ISSUED, NOT THE PERIOD
   OF THE ORIGINAL INVOICE — the real rule, and it falls out naturally
   here: every note is filtered by its own `noteDate`, never by the
   invoice's `invoiceDate` it credits. A credit note against a January
   sale, issued in March, belongs in March's return.

   THE INTERSTATE SPLIT IS RE-COMPUTED HERE, NOT REUSED FROM SALES
   REGISTER'S OWN PRIVATE `_resolveSplit()` — that function is private
   to its own file, the same convention Purchase Register's own private
   split helper already follows, so this file computes the identical
   logic independently via Tax Master's own PUBLIC
   `getIntraStateSplit()`/`getInterStateSplit()`, rather than reaching
   into another module's private internals. Sales Register's own rows
   already carry a computed split for invoice lines; Credit Note's own
   lines do not (that module was never asked to file a return), so this
   file computes it fresh for every credit note line, using the same
   home-state-vs-customer-state comparison Sales Register's own private
   version uses.

   FILING IS A SEPARATE, MINIMAL RECORD — NOT A SNAPSHOT OF EVERY ROW.
   Every table above is computed LIVE from Sales Register and Credit
   Note every time it's asked for; nothing about that changes once a
   period is filed. What `file()` adds is a single frozen TOTALS record
   per (company, year, month) — proof of what was reported and when,
   the same "immutable once posted" instinct Journal Entry and every
   lifecycle document in this project already share. ONE FILING PER
   PERIOD, EVER: once filed, filing the same period again is refused,
   because a real GSTR-1 cannot be un-filed and re-filed from scratch
   through this flow. This project has no period-lock mechanism
   anywhere else (Journal Entry doesn't lock periods either), so filing
   does not prevent a later transaction from landing in an
   already-filed month — a real, if imperfect, gap named here rather
   than silently pretended away: a business that then needs to correct
   the period would do so on next period's return in real GST law, and
   this file makes no attempt to reconcile that automatically.
   ========================================================================== */

const ERP_GSTR1_FILINGS_KEY = "erp_gstr1_filings";

const ERP_Gstr1Repository = {

  getAllFilings() {
    try { return JSON.parse(localStorage.getItem(ERP_GSTR1_FILINGS_KEY)) || []; }
    catch { return []; }
  },
  _saveFilings(list) {
    try { localStorage.setItem(ERP_GSTR1_FILINGS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getFilingsForCompany(companyId) {
    return this.getAllFilings()
      .filter((f) => f.companyId === companyId)
      .sort((a, b) => (b.periodYear - a.periodYear) || (b.periodMonth - a.periodMonth));
  },

  findFiling(companyId, year, month) {
    return this.getAllFilings().find((f) => f.companyId === companyId && f.periodYear === year && f.periodMonth === month) || null;
  },

  isFiled(companyId, year, month) {
    return !!this.findFiling(companyId, year, month);
  },


  /* -----------------------------------------------------------------------
     PERIOD + SPLIT HELPERS
     --------------------------------------------------------------------- */

  _periodRange(year, month) {
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { fromDate: from, toDate: to };
  },

  /** See file header — computed independently of Sales Register's own
      private split helper, via Tax Master's own public functions. */
  _resolveSplit(homeState, otherState, taxId, taxableValue) {
    const isInterState = !!(homeState && otherState && homeState !== otherState);
    if (!taxId || typeof ERP_TaxRepository === "undefined") {
      return { isInterState, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
    }
    const tax = ERP_TaxRepository.findById(taxId);
    if (!tax) return { isInterState, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
    if (isInterState) {
      const inter = ERP_TaxRepository.getInterStateSplit(tax);
      return { isInterState, cgstAmount: 0, sgstAmount: 0, igstAmount: taxableValue * inter.igstPct / 100 };
    }
    const intra = ERP_TaxRepository.getIntraStateSplit(tax);
    return { isInterState, cgstAmount: taxableValue * intra.cgstPct / 100, sgstAmount: taxableValue * intra.sgstPct / 100, igstAmount: 0 };
  },

  _homeState(companyId) {
    const company = typeof ERP_CompanyRepository !== "undefined" ? ERP_CompanyRepository.findById(companyId) : null;
    return (company && company.state ? company.state : "").trim().toLowerCase();
  },

  _isRegistered(customer) {
    return !!(customer && customer.gstin && customer.gstin.trim());
  },


  /* -----------------------------------------------------------------------
     TABLE 4 — B2B: invoice + rate grain
     --------------------------------------------------------------------- */

  getB2BRows(companyId, year, month) {
    if (typeof ERP_SalesRegisterRepository === "undefined" || typeof ERP_TaxInvoiceRepository === "undefined") return [];
    const { fromDate, toDate } = this._periodRange(year, month);
    const rows = ERP_SalesRegisterRepository.getRows(companyId, { fromDate, toDate });

    const registeredRows = rows.filter((r) => {
      const customer = r.customerId && typeof ERP_CustomerRepository !== "undefined" ? ERP_CustomerRepository.findById(r.customerId) : null;
      return this._isRegistered(customer);
    });

    const groups = new Map();
    registeredRows.forEach((r) => {
      const key = `${r.invoiceId}:${r.ratePct}`;
      if (!groups.has(key)) {
        const customer = ERP_CustomerRepository.findById(r.customerId);
        groups.set(key, {
          invoiceId: r.invoiceId,
          invoiceCode: r.invoiceCode,
          invoiceDate: r.invoiceDate,
          customerId: r.customerId,
          customerName: r.customerName,
          customerGstin: customer ? customer.gstin : "",
          ratePct: r.ratePct,
          isInterState: r.isInterState,
          taxableValue: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0
        });
      }
      const g = groups.get(key);
      g.taxableValue += r.taxableValue;
      g.cgstAmount += r.cgstAmount;
      g.sgstAmount += r.sgstAmount;
      g.igstAmount += r.igstAmount;
    });

    const invoiceValueCache = new Map();
    return Array.from(groups.values()).map((g) => {
      if (!invoiceValueCache.has(g.invoiceId)) {
        const inv = ERP_TaxInvoiceRepository.findById(g.invoiceId);
        invoiceValueCache.set(g.invoiceId, inv ? ERP_TaxInvoiceRepository.computeGrandTotal(inv).total : g.taxableValue);
      }
      return { ...g, invoiceValue: invoiceValueCache.get(g.invoiceId), taxAmount: g.cgstAmount + g.sgstAmount + g.igstAmount };
    }).sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate) || a.ratePct - b.ratePct);
  },


  /* -----------------------------------------------------------------------
     TABLE 7 — B2C: place-of-supply + rate grain, no invoice detail
     --------------------------------------------------------------------- */

  getB2CSummary(companyId, year, month) {
    if (typeof ERP_SalesRegisterRepository === "undefined") return [];
    const { fromDate, toDate } = this._periodRange(year, month);
    const rows = ERP_SalesRegisterRepository.getRows(companyId, { fromDate, toDate });
    const homeState = this._homeState(companyId);

    const unregisteredRows = rows.filter((r) => {
      const customer = r.customerId && typeof ERP_CustomerRepository !== "undefined" ? ERP_CustomerRepository.findById(r.customerId) : null;
      return !this._isRegistered(customer);
    });

    const groups = new Map();
    unregisteredRows.forEach((r) => {
      const placeOfSupply = r.customerState || "Unknown";
      const key = `${placeOfSupply}:${r.ratePct}`;
      if (!groups.has(key)) {
        groups.set(key, { placeOfSupply, ratePct: r.ratePct, isInterState: r.isInterState, taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 });
      }
      const g = groups.get(key);
      g.taxableValue += r.taxableValue;
      g.cgstAmount += r.cgstAmount;
      g.sgstAmount += r.sgstAmount;
      g.igstAmount += r.igstAmount;
    });

    return Array.from(groups.values())
      .map((g) => ({ ...g, taxAmount: g.cgstAmount + g.sgstAmount + g.igstAmount }))
      .sort((a, b) => a.placeOfSupply.localeCompare(b.placeOfSupply) || a.ratePct - b.ratePct);
  },


  /* -----------------------------------------------------------------------
     TABLE 9B — Credit Notes Issued (reduces outward liability)
     --------------------------------------------------------------------- */

  getCreditNoteRows(companyId, year, month) {
    if (typeof ERP_CreditNoteRepository === "undefined") return [];
    const { fromDate, toDate } = this._periodRange(year, month);
    const homeState = this._homeState(companyId);

    const notes = ERP_CreditNoteRepository.getAllForCompany(companyId)
      .filter((n) => n.status === "Credited" && n.noteDate >= fromDate && n.noteDate <= toDate);

    const rows = [];
    notes.forEach((n) => {
      const customer = n.customerId && typeof ERP_CustomerRepository !== "undefined" ? ERP_CustomerRepository.findById(n.customerId) : null;
      const otherState = (customer && customer.state ? customer.state : "").trim().toLowerCase();
      const registered = this._isRegistered(customer);

      const byRate = new Map();
      (n.creditLines || []).forEach((line) => {
        const lineValue = ERP_CreditNoteRepository.computeLineTotal(line);
        if (lineValue == null) return;
        const tax = line.taxId && typeof ERP_TaxRepository !== "undefined" ? ERP_TaxRepository.findById(line.taxId) : null;
        const ratePct = tax ? Number(tax.ratePct) || 0 : 0;
        const split = this._resolveSplit(homeState, otherState, line.taxId, lineValue);
        const key = ratePct;
        if (!byRate.has(key)) byRate.set(key, { ratePct, taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 });
        const g = byRate.get(key);
        g.taxableValue += lineValue;
        g.cgstAmount += split.cgstAmount;
        g.sgstAmount += split.sgstAmount;
        g.igstAmount += split.igstAmount;
      });

      byRate.forEach((g) => {
        rows.push({
          noteId: n.id,
          noteCode: n.noteCode,
          noteDate: n.noteDate,
          noteType: n.noteType,
          linkedInvoiceId: n.linkedInvoiceId,
          invoiceCode: typeof ERP_TaxInvoiceRepository !== "undefined" ? (ERP_TaxInvoiceRepository.findById(n.linkedInvoiceId) || {}).invoiceCode || "—" : "—",
          customerId: n.customerId,
          customerName: customer ? customer.customerName : "Removed customer",
          customerGstin: customer ? customer.gstin : "",
          registered,
          ratePct: g.ratePct,
          taxableValue: g.taxableValue,
          cgstAmount: g.cgstAmount,
          sgstAmount: g.sgstAmount,
          igstAmount: g.igstAmount,
          taxAmount: g.cgstAmount + g.sgstAmount + g.igstAmount
        });
      });
    });

    return rows.sort((a, b) => new Date(a.noteDate) - new Date(b.noteDate));
  },


  /* -----------------------------------------------------------------------
     TABLE 12 — HSN Summary, net of credit notes issued in the same period
     --------------------------------------------------------------------- */

  getHsnSummary(companyId, year, month) {
    if (typeof ERP_SalesRegisterRepository === "undefined") return [];
    const { fromDate, toDate } = this._periodRange(year, month);
    const salesRows = ERP_SalesRegisterRepository.getRows(companyId, { fromDate, toDate });

    const byHsn = new Map();
    const ensure = (hsnCode) => {
      if (!byHsn.has(hsnCode)) byHsn.set(hsnCode, { hsnCode, quantity: 0, unit: "", taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 });
      return byHsn.get(hsnCode);
    };

    salesRows.forEach((r) => {
      const g = ensure(r.hsnCode || "—");
      g.quantity += r.quantity;
      g.taxableValue += r.taxableValue;
      g.cgstAmount += r.cgstAmount;
      g.sgstAmount += r.sgstAmount;
      g.igstAmount += r.igstAmount;
      if (!g.unit && r.itemId && typeof ERP_ItemRepository !== "undefined" && typeof ERP_UnitRepository !== "undefined") {
        const item = ERP_ItemRepository.findById(r.itemId);
        const unit = item && item.unitId ? ERP_UnitRepository.findById(item.unitId) : null;
        if (unit) g.unit = unit.unitName;
      }
    });

    // Net out credit notes issued this period, by the SAME hsnCode —
    // real Table 12 nets credit/debit note adjustments into the HSN
    // figure rather than showing them as a separate HSN table.
    if (typeof ERP_CreditNoteRepository !== "undefined") {
      const notes = ERP_CreditNoteRepository.getAllForCompany(companyId)
        .filter((n) => n.status === "Credited" && n.noteDate >= fromDate && n.noteDate <= toDate);
      notes.forEach((n) => {
        (n.creditLines || []).forEach((line) => {
          const lineValue = ERP_CreditNoteRepository.computeLineTotal(line);
          if (lineValue == null) return;
          const hsn = line.hsnCodeId && typeof ERP_HsnRepository !== "undefined" ? ERP_HsnRepository.findById(line.hsnCodeId) : null;
          const g = ensure(hsn ? hsn.hsnCode : "—");
          g.taxableValue -= lineValue;
          // Credited tax is netted back proportionally into whichever
          // head it would have posted under — CGST+SGST for intra-state,
          // IGST for inter-state — using the same live split rather than
          // guessing a 50/50 default; a note with no resolvable split
          // (no customer/state on record) nets the whole figure to IGST
          // rather than silently dropping it.
          const customer = n.customerId && typeof ERP_CustomerRepository !== "undefined" ? ERP_CustomerRepository.findById(n.customerId) : null;
          const homeState = this._homeState(companyId);
          const split = this._resolveSplit(homeState, (customer && customer.state ? customer.state : "").trim().toLowerCase(), line.taxId, lineValue);
          g.cgstAmount -= split.cgstAmount;
          g.sgstAmount -= split.sgstAmount;
          g.igstAmount -= split.igstAmount;
        });
      });
    }

    return Array.from(byHsn.values())
      .map((g) => ({ ...g, taxAmount: g.cgstAmount + g.sgstAmount + g.igstAmount }))
      .sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));
  },


  /* -----------------------------------------------------------------------
     TOTALS — the single number a filer actually reports
     --------------------------------------------------------------------- */

  computeTotals(companyId, year, month) {
    const b2b = this.getB2BRows(companyId, year, month);
    const b2c = this.getB2CSummary(companyId, year, month);
    const notes = this.getCreditNoteRows(companyId, year, month);

    const sum = (rows, sign) => rows.reduce((acc, r) => ({
      taxableValue: acc.taxableValue + sign * r.taxableValue,
      cgstAmount: acc.cgstAmount + sign * r.cgstAmount,
      sgstAmount: acc.sgstAmount + sign * r.sgstAmount,
      igstAmount: acc.igstAmount + sign * r.igstAmount
    }), { taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 });

    const gross = [sum(b2b, 1), sum(b2c, 1)].reduce((a, b) => ({
      taxableValue: a.taxableValue + b.taxableValue,
      cgstAmount: a.cgstAmount + b.cgstAmount,
      sgstAmount: a.sgstAmount + b.sgstAmount,
      igstAmount: a.igstAmount + b.igstAmount
    }));
    const noteTotals = sum(notes, 1);

    const net = {
      taxableValue: gross.taxableValue - noteTotals.taxableValue,
      cgstAmount: gross.cgstAmount - noteTotals.cgstAmount,
      sgstAmount: gross.sgstAmount - noteTotals.sgstAmount,
      igstAmount: gross.igstAmount - noteTotals.igstAmount
    };

    return {
      periodYear: year,
      periodMonth: month,
      b2bInvoiceCount: new Set(b2b.map((r) => r.invoiceId)).size,
      b2cRowCount: b2c.length,
      creditNoteCount: new Set(notes.map((r) => r.noteId)).size,
      grossTaxableValue: gross.taxableValue,
      grossTax: gross.cgstAmount + gross.sgstAmount + gross.igstAmount,
      creditNoteTaxableValue: noteTotals.taxableValue,
      creditNoteTax: noteTotals.cgstAmount + noteTotals.sgstAmount + noteTotals.igstAmount,
      netTaxableValue: net.taxableValue,
      netCgst: net.cgstAmount,
      netSgst: net.sgstAmount,
      netIgst: net.igstAmount,
      netTax: net.cgstAmount + net.sgstAmount + net.igstAmount
    };
  },


  /* -----------------------------------------------------------------------
     FILING
     --------------------------------------------------------------------- */

  file(company, year, month, actorUsername) {
    if (this.isFiled(company.id, year, month)) {
      return { success: false, reason: `${this._monthLabel(year, month)} has already been filed and can't be filed again.` };
    }
    const totals = this.computeTotals(company.id, year, month);
    const record = {
      id: "GSTR1-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      periodYear: year,
      periodMonth: month,
      ...totals,
      filedAt: new Date().toISOString(),
      filedByUsername: actorUsername || "system"
    };
    const all = this.getAllFilings();
    all.push(record);
    this._saveFilings(all);
    return { success: true, record };
  },

  _monthLabel(year, month) {
    const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${names[month - 1]} ${year}`;
  },

  actorLabel(username) {
    return typeof window !== "undefined" && window.ERP && window.ERP.actorLabel
      ? window.ERP.actorLabel(username)
      : (username || "system");
  }
};
