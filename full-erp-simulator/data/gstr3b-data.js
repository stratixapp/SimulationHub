/* =============================================================================
   DOT ERP
   FILE:  data/gstr3b-data.js
   ROLE:  Data-access layer for GSTR-3B — Phase 16, Module 02. The
          monthly summary return: output tax liability minus eligible
          input tax credit equals net tax payable (or, when ITC exceeds
          liability, a net credit — a real GST outcome, not an error
          state). Read gstr1-data.js's own header first; this file
          reuses it directly rather than re-deriving outward supplies.

   OUTPUT SIDE IS GSTR-1's OWN NUMBER, NOT RE-COMPUTED — "genuine reuse
   forward," the same restraint every report in this project has shown
   toward its own upstream module. Specifically: IF a GSTR-1 filing
   already exists for the period, this file uses THAT FROZEN RECORD,
   not a live recompute — because a real GSTR-3B is reconciled against
   what was actually reported in GSTR-1, not against figures that may
   have drifted since (a very late credit note landing in an
   already-filed month, for instance). If no GSTR-1 filing exists yet
   for the period, this file falls back to GSTR-1's own live
   `computeTotals()` and says so plainly — `outputSource` on every
   totals object is either `"filed"` or `"live"`, and the page surfaces
   it rather than presenting an unfiled figure as settled.

   INPUT SIDE REUSES PURCHASE REGISTER'S OWN ROWS DIRECTLY — not a
   second traversal of Invoice Verification. The one thing this file
   adds beyond a plain sum is the SAME honesty Purchase Register's own
   header already insists on: every row is estimated unless captured,
   and this file surfaces `pctEstimated` (the share of this period's
   own input tax that rests on an estimate, not a captured fact) rather
   than quietly averaging it away.

   ITC IS TREATED AS FULLY ELIGIBLE — A NAMED SIMPLIFICATION INHERITED
   FROM GST SUMMARY, NOT RE-LITIGATED. GST Summary's own header already
   states plainly that this simulator has no concept of ITC eligibility
   rules (blocked credits, reverse charge, capital goods restrictions).
   This file inherits that exact stance rather than pretending Module
   02 of a phase should re-solve a problem Module 03 of Phase 8 already
   named honestly. `netTax` here is genuinely useful — output minus all
   recorded input tax — not a claim to have modeled eligibility.

   DEBIT NOTES REVERSE ITC — AND NEEDED A SPLIT RECOMPUTED INDEPENDENTLY,
   THE SAME PROBLEM CREDIT NOTES POSED FOR GSTR-1'S OWN HSN NETTING,
   SOLVED THE SAME WAY. Debit Note's own `computeGrandTotal()` returns
   only a flat `taxTotal` — checked directly in `debit-note-data.js`
   before assuming otherwise — because that module was never asked to
   file a return either. This file recomputes the CGST/SGST/IGST split
   per debit line independently, via Tax Master's own PUBLIC
   `getIntraStateSplit()`/`getInterStateSplit()`, using the note's own
   `vendorId` (a field Debit Note already stores directly, no chain-walk
   needed) against the company's home state — the identical pattern
   GSTR-1's own `getHsnSummary()` already uses for Credit Note.

   NO CARRY-FORWARD BETWEEN PERIODS — A NAMED, DELIBERATE LIMITATION.
   A real electronic credit ledger lets excess ITC from one period
   reduce a LATER period's cash payable. This project has no running
   ledger anywhere (Depreciation Run doesn't carry forward a WDV error
   across runs beyond its own book value field; GST Summary doesn't
   carry forward either), so each period's `netTax` here is computed
   entirely on ITS OWN transactions. A negative `netTax` (ITC exceeding
   liability) is shown as a genuine "net ITC available" figure, not
   hidden or floored at zero — that outcome is real and common, not an
   error state — but it is never carried into the next period's own
   calculation automatically.

   FILING FOLLOWS GSTR-1's OWN SHAPE EXACTLY: one frozen totals record
   per (company, year, month), refused a second time for the same
   period, computed at file-time and never silently recomputed after.
   ========================================================================== */

const ERP_GSTR3B_FILINGS_KEY = "erp_gstr3b_filings";

const ERP_Gstr3bRepository = {

  getAllFilings() {
    try { return JSON.parse(localStorage.getItem(ERP_GSTR3B_FILINGS_KEY)) || []; }
    catch { return []; }
  },
  _saveFilings(list) {
    try { localStorage.setItem(ERP_GSTR3B_FILINGS_KEY, JSON.stringify(list)); return true; }
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
     HELPERS
     --------------------------------------------------------------------- */

  _periodRange(year, month) {
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { fromDate: from, toDate: to };
  },

  _homeState(companyId) {
    const company = typeof ERP_CompanyRepository !== "undefined" ? ERP_CompanyRepository.findById(companyId) : null;
    return (company && company.state ? company.state : "").trim().toLowerCase();
  },

  /** See file header — computed independently for the same reason
      GSTR-1's own HSN netting recomputes Credit Note's split rather
      than reusing another file's private helper. */
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


  /* -----------------------------------------------------------------------
     3.1 — OUTPUT TAX LIABILITY (reused from GSTR-1, filed or live)
     --------------------------------------------------------------------- */

  getOutputLiability(companyId, year, month) {
    if (typeof ERP_Gstr1Repository === "undefined") {
      return { taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalTax: 0, source: "unavailable" };
    }
    const filing = ERP_Gstr1Repository.findFiling(companyId, year, month);
    if (filing) {
      return {
        taxableValue: filing.netTaxableValue, cgstAmount: filing.netCgst, sgstAmount: filing.netSgst,
        igstAmount: filing.netIgst, totalTax: filing.netTax, source: "filed"
      };
    }
    const live = ERP_Gstr1Repository.computeTotals(companyId, year, month);
    return {
      taxableValue: live.netTaxableValue, cgstAmount: live.netCgst, sgstAmount: live.netSgst,
      igstAmount: live.netIgst, totalTax: live.netTax, source: "live"
    };
  },


  /* -----------------------------------------------------------------------
     4(A) — INPUT TAX CREDIT AVAILABLE (gross, from Purchase Register)
     --------------------------------------------------------------------- */

  getGrossItc(companyId, year, month) {
    if (typeof ERP_PurchaseRegisterRepository === "undefined") {
      return { taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalTax: 0, pctEstimated: 0, lineCount: 0 };
    }
    const { fromDate, toDate } = this._periodRange(year, month);
    const rows = ERP_PurchaseRegisterRepository.getRows(companyId, { fromDate, toDate });

    const totals = rows.reduce((acc, r) => {
      acc.taxableValue += r.taxableValue;
      acc.cgstAmount += r.cgstAmount;
      acc.sgstAmount += r.sgstAmount;
      acc.igstAmount += r.igstAmount;
      if (r.taxIsEstimated) acc.estimatedTax += r.taxAmount;
      return acc;
    }, { taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, estimatedTax: 0 });

    const totalTax = totals.cgstAmount + totals.sgstAmount + totals.igstAmount;
    return {
      taxableValue: totals.taxableValue,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      igstAmount: totals.igstAmount,
      totalTax,
      pctEstimated: totalTax > 0 ? Math.round((totals.estimatedTax / totalTax) * 100) : 0,
      lineCount: rows.length
    };
  },


  /* -----------------------------------------------------------------------
     4(B) — ITC REVERSED (Debit Notes issued this period)
     --------------------------------------------------------------------- */

  getItcReversal(companyId, year, month) {
    if (typeof ERP_DebitNoteRepository === "undefined") {
      return { taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalTax: 0, noteCount: 0 };
    }
    const { fromDate, toDate } = this._periodRange(year, month);
    const homeState = this._homeState(companyId);

    const notes = ERP_DebitNoteRepository.getAllForCompany(companyId)
      .filter((n) => n.status === "Debited" && n.noteDate >= fromDate && n.noteDate <= toDate);

    const totals = { taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
    notes.forEach((n) => {
      const vendor = n.vendorId && typeof ERP_VendorRepository !== "undefined" ? ERP_VendorRepository.findById(n.vendorId) : null;
      const otherState = (vendor && vendor.state ? vendor.state : "").trim().toLowerCase();
      (n.debitLines || []).forEach((line) => {
        const lineValue = ERP_DebitNoteRepository.computeLineTotal(line);
        if (lineValue == null) return;
        const split = this._resolveSplit(homeState, otherState, line.invoicedTaxId, lineValue);
        totals.taxableValue += lineValue;
        totals.cgstAmount += split.cgstAmount;
        totals.sgstAmount += split.sgstAmount;
        totals.igstAmount += split.igstAmount;
      });
    });

    return { ...totals, totalTax: totals.cgstAmount + totals.sgstAmount + totals.igstAmount, noteCount: notes.length };
  },


  /* -----------------------------------------------------------------------
     4(C) — NET ITC AVAILABLE
     --------------------------------------------------------------------- */

  getNetItc(companyId, year, month) {
    const gross = this.getGrossItc(companyId, year, month);
    const reversed = this.getItcReversal(companyId, year, month);
    return {
      cgstAmount: gross.cgstAmount - reversed.cgstAmount,
      sgstAmount: gross.sgstAmount - reversed.sgstAmount,
      igstAmount: gross.igstAmount - reversed.igstAmount,
      totalTax: gross.totalTax - reversed.totalTax,
      pctEstimated: gross.pctEstimated
    };
  },


  /* -----------------------------------------------------------------------
     6.1 — NET TAX PAYABLE (or net credit, when negative)
     --------------------------------------------------------------------- */

  computeSummary(companyId, year, month) {
    const output = this.getOutputLiability(companyId, year, month);
    const grossItc = this.getGrossItc(companyId, year, month);
    const itcReversal = this.getItcReversal(companyId, year, month);
    const netItc = this.getNetItc(companyId, year, month);

    return {
      periodYear: year,
      periodMonth: month,
      outputTaxableValue: output.taxableValue,
      outputCgst: output.cgstAmount,
      outputSgst: output.sgstAmount,
      outputIgst: output.igstAmount,
      outputTax: output.totalTax,
      outputSource: output.source,
      grossItcCgst: grossItc.cgstAmount,
      grossItcSgst: grossItc.sgstAmount,
      grossItcIgst: grossItc.igstAmount,
      grossItcTax: grossItc.totalTax,
      itcPctEstimated: grossItc.pctEstimated,
      itcLineCount: grossItc.lineCount,
      itcReversedCgst: itcReversal.cgstAmount,
      itcReversedSgst: itcReversal.sgstAmount,
      itcReversedIgst: itcReversal.igstAmount,
      itcReversedTax: itcReversal.totalTax,
      itcReversedNoteCount: itcReversal.noteCount,
      netItcCgst: netItc.cgstAmount,
      netItcSgst: netItc.sgstAmount,
      netItcIgst: netItc.igstAmount,
      netItcTax: netItc.totalTax,
      netTaxPayable: output.totalTax - netItc.totalTax,
      // Head-wise payable is a genuine simplification: real GST law lets
      // IGST credit offset CGST/SGST liability under specific cross-
      // utilization rules this simulator does not model (the same class
      // of eligibility rule GST Summary's own header already excludes).
      // Each head nets against itself only.
      netPayableCgst: output.cgstAmount - netItc.cgstAmount,
      netPayableSgst: output.sgstAmount - netItc.sgstAmount,
      netPayableIgst: output.igstAmount - netItc.igstAmount
    };
  },


  /* -----------------------------------------------------------------------
     FILING
     --------------------------------------------------------------------- */

  file(company, year, month, actorUsername) {
    if (this.isFiled(company.id, year, month)) {
      return { success: false, reason: `${this._monthLabel(year, month)} has already been filed and can't be filed again.` };
    }
    const summary = this.computeSummary(company.id, year, month);
    const record = {
      id: "GSTR3B-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      ...summary,
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
