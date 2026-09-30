/* =============================================================================
   DOT ERP
   FILE:  data/gst-summary-data.js
   ROLE:  Data-access layer for GST Summary — Phase 8, Module 03. No storage
          key. The first report in this project that reconciles two OTHER
          reports built this same phase, rather than reading one upstream
          module directly — it calls ERP_SalesRegisterRepository and
          ERP_PurchaseRegisterRepository's own already-computed rows and
          grouping helpers (getRows/getSummary/groupByRate/groupByHsn) and
          merges them, the same "genuine reuse forward" restraint every
          earlier report in this project has shown toward its own upstream
          module.

   A PERIOD, NOT A POINT IN TIME — DECIDED, NOT DEFAULTED: Trial Balance and
   AP/AR Aging are all "as of a date" reports (a balance is a snapshot).
   GST liability isn't — it's filed monthly or quarterly, over a RANGE of
   dates, the same reasoning Profit & Loss already used to justify its own
   From/To period instead of a single "as of" date. GST Summary follows
   P&L's own precedent here, not Trial Balance's.

   OUTPUT TAX IS EXACT, INPUT TAX IS AN ESTIMATE — NOT THIS FILE'S CALL TO
   SOFTEN: Sales Register's own rows are read straight off Tax Invoice's
   transaction-time figures. Purchase Register's own rows are marked
   `taxIsEstimated: true` for a real, documented reason (see that file's
   header — no tax rate is ever captured anywhere in the Procurement
   chain). This file does not paper over that difference: every input-tax
   figure it produces carries the same honesty forward, and the page built
   on top of this file says so out loud rather than presenting Net Payable
   as a precise, filing-ready number.

   NET PAYABLE IS A DELIBERATE SIMPLIFICATION, NAMED AS ONE: real GST
   liability involves Input Tax Credit eligibility rules (blocked credits,
   reverse charge, capital goods restrictions) this simulator has no
   concept of. `netTax` here is simply outputTax − inputTax, per rate and
   in total — a genuine, useful approximation of the real computation, not
   a claim to have modeled ITC eligibility. The training drawer says this
   plainly rather than letting the number imply more precision than it has.

   GROUPED TWO WAYS, BOTH REUSED FROM THE REGISTERS THEMSELVES: by tax rate
   (the number that actually nets to a payable/refundable figure) and by
   HSN (the other half of a real GSTR-1's own reporting shape — Table 12's
   HSN summary sits alongside the rate-wise view, not instead of it).
   Both merges use the same private `_mergeGroups()` below, keyed on
   whichever field the caller names.
   ========================================================================== */

const ERP_GstSummaryRepository = {

  /** filters: { fromDate, toDate } — both optional; omitted means the
      report covers the whole history on that side, same as the registers
      themselves default to. Returns the full reconciliation: totals, a
      by-rate breakdown, and a by-HSN breakdown. */
  getSummary(companyId, filters) {
    const f = filters || {};
    const dateFilter = { fromDate: f.fromDate || "", toDate: f.toDate || "" };

    const salesRows = (typeof ERP_SalesRegisterRepository !== "undefined")
      ? ERP_SalesRegisterRepository.getRows(companyId, dateFilter) : [];
    const purchaseRows = (typeof ERP_PurchaseRegisterRepository !== "undefined")
      ? ERP_PurchaseRegisterRepository.getRows(companyId, dateFilter) : [];

    const outputTotals = this._sumRows(salesRows);
    const inputTotals = this._sumRows(purchaseRows);

    const salesByRate = (typeof ERP_SalesRegisterRepository !== "undefined") ? ERP_SalesRegisterRepository.groupByRate(salesRows) : [];
    const purchaseByRate = (typeof ERP_PurchaseRegisterRepository !== "undefined") ? ERP_PurchaseRegisterRepository.groupByRate(purchaseRows) : [];
    const byRate = this._mergeGroups(salesByRate, purchaseByRate, "ratePct");

    const salesByHsn = (typeof ERP_SalesRegisterRepository !== "undefined") ? ERP_SalesRegisterRepository.groupByHsn(salesRows) : [];
    const purchaseByHsn = (typeof ERP_PurchaseRegisterRepository !== "undefined") ? ERP_PurchaseRegisterRepository.groupByHsn(purchaseRows) : [];
    const byHsn = this._mergeGroups(salesByHsn, purchaseByHsn, "hsnCode");

    return {
      fromDate: dateFilter.fromDate,
      toDate: dateFilter.toDate,

      outputTaxableValue: outputTotals.taxableValue,
      outputTax: outputTotals.taxAmount,
      outputCgst: outputTotals.cgstAmount,
      outputSgst: outputTotals.sgstAmount,
      outputIgst: outputTotals.igstAmount,
      salesLineCount: salesRows.length,

      inputTaxableValue: inputTotals.taxableValue,
      inputTax: inputTotals.taxAmount,
      inputCgst: inputTotals.cgstAmount,
      inputSgst: inputTotals.sgstAmount,
      inputIgst: inputTotals.igstAmount,
      purchaseLineCount: purchaseRows.length,

      netTax: outputTotals.taxAmount - inputTotals.taxAmount,
      netCgst: outputTotals.cgstAmount - inputTotals.cgstAmount,
      netSgst: outputTotals.sgstAmount - inputTotals.sgstAmount,
      netIgst: outputTotals.igstAmount - inputTotals.igstAmount,

      byRate,
      byHsn
    };
  },

  _sumRows(rows) {
    return rows.reduce((acc, r) => {
      acc.taxableValue += r.taxableValue;
      acc.taxAmount += r.taxAmount;
      acc.cgstAmount += r.cgstAmount;
      acc.sgstAmount += r.sgstAmount;
      acc.igstAmount += r.igstAmount;
      return acc;
    }, { taxableValue: 0, taxAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 });
  },

  /** Merges a Sales-side group list and a Purchase-side group list, keyed
      on `keyField` (either "ratePct" or "hsnCode"), into one row per key
      with output/input/net figures side by side. A key present on only
      one side still gets a full row, with the other side's figures at
      zero — this project's usual "name the gap, don't hide it" rule
      applied to a rate or HSN that's only ever been bought or only ever
      been sold. */
  _mergeGroups(salesGroups, purchaseGroups, keyField) {
    const byKey = new Map();
    const ensure = (key) => {
      if (!byKey.has(key)) {
        byKey.set(key, {
          [keyField]: key,
          outputTaxableValue: 0, outputTax: 0, outputCgst: 0, outputSgst: 0, outputIgst: 0,
          inputTaxableValue: 0, inputTax: 0, inputCgst: 0, inputSgst: 0, inputIgst: 0,
          netTax: 0
        });
      }
      return byKey.get(key);
    };
    salesGroups.forEach((g) => {
      const row = ensure(g[keyField]);
      row.outputTaxableValue += g.taxableValue;
      row.outputTax += g.taxAmount;
      row.outputCgst += g.cgstAmount;
      row.outputSgst += g.sgstAmount;
      row.outputIgst += g.igstAmount;
    });
    purchaseGroups.forEach((g) => {
      const row = ensure(g[keyField]);
      row.inputTaxableValue += g.taxableValue;
      row.inputTax += g.taxAmount;
      row.inputCgst += g.cgstAmount;
      row.inputSgst += g.sgstAmount;
      row.inputIgst += g.igstAmount;
    });
    const list = [...byKey.values()];
    list.forEach((row) => { row.netTax = row.outputTax - row.inputTax; });
    list.sort((a, b) => {
      const av = a[keyField], bv = b[keyField];
      return typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
    });
    return list;
  }
};
