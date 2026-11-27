/* =============================================================================
   DOT ERP
   FILE:  data/tax-invoice-data.js
   ROLE:  Data-access layer for Tax Invoice — Phase 5, Module 06. Built
          from one Issued Delivery Challan (Module 05) — read that file's
          header first, this one assumes that context.

   THE FIRST TWO-HOP JOIN IN THIS CODEBASE, NOT JUST A CHAIN-WALK PAST
   INTERMEDIATE HOPS — AND WHY IT'S POSSIBLE HERE. GRN (Phase 4, #14) set
   the precedent for "the immediate parent doesn't carry price, so walk
   PAST it to whichever ancestor does" — GRN skipped Goods Receipt and
   Delivery Schedule entirely to reach the PO's own pricing. This module
   needs the exact same move: Delivery Challan deliberately carries NO
   price/tax at all (see its own header), so a Tax Invoice's real pricing
   has to come from the Sales Order instead. What makes this a genuine
   JOIN rather than a walk-and-grab: `buildInvoiceLines()` below MATCHES
   each challan line to its sales-order counterpart BY LINE ID, then
   combines the two — quantity comes from the challan (`deliveredQuantity`
   — you bill for what actually shipped, not what was merely ordered),
   while `unitPrice`/`taxId`/`itemId`/`lineDescription` come from the
   matching sales-order line. This match-by-id works cleanly because
   every module in this chain has quietly preserved the SAME line `id`
   the whole way down — Quotation's own line id survives into Sales
   Order's copy, and Sales Order's survives into Delivery Challan's copy
   — so there's no fuzzy matching to get wrong, just a direct id lookup.

   LINES ARE A ONE-TIME COMPUTED SNAPSHOT, FROZEN HARDER THAN EVEN SALES
   ORDER'S OWN COPY: Sales Order's lines are frozen after creation but at
   least started as a literal copy. This module's lines don't even exist
   until `create()` actively COMPUTES them by joining two other records
   together — and once computed, nothing here ever recomputes or edits
   them again, not even while still a Draft. By this point in the chain
   the quantity (confirmed at shipping) and the price (agreed at the
   quotation) are both already-settled real-world facts; a tax invoice's
   job is to state them formally, not to keep offering another chance to
   adjust them. If a number here is wrong, the fix belongs upstream (a
   corrected Delivery Challan or a fresh Sales Order), the same
   "corrections happen at the source, not the reflection" reasoning GRN's
   own header already established for its own line quantities.

   HSN CODE RESOLUTION, THE FIRST REAL USE OF HSN MASTER (PHASE 3,
   UNTOUCHED UNTIL NOW): each invoice line resolves an `hsnCodeId` from
   its linked item (`item.hsnCodeId`, if the line has a catalog item at
   all) — not a new field invented here, just Item Master's own existing
   link finally being read by a document that legally needs to show it. A
   line with no catalog item (a free-text description on the original
   quotation) simply has no HSN code to show — graceful degradation, the
   same as every other optional cross-module reference in this codebase.

   dueDate DEFAULTS FROM CUSTOMER MASTER'S OWN creditPeriodDays — ANOTHER
   DISCOVERED HOOK, NOT AN INVENTED FIELD: `data/customer-data.js` (Phase
   3) has carried `creditPeriodDays` since it was written, sitting
   unused by any transactional module until now, the same way
   `getCreditUsage()`/`getCreditUtilizationBand()` sat waiting for Sales
   Order. The page computes `invoiceDate + customer.creditPeriodDays` as
   a convenience default when creating an invoice — genuinely editable
   afterward, since real payment terms sometimes get negotiated per
   invoice, not just inherited blindly.

   STATUS: `Draft -> Raised -> Cancelled`, GRN's OWN 3-STATE SHAPE — BUT
   NOT GRN'S WORD FOR THE TERMINAL STATE, ON PURPOSE. No approval gate
   here either, for the same reason GRN has none: finalizing your own
   document is an administrative formalization action, not a judgment
   call about someone else's work (Order Approval, two steps back,
   already covered the one real decision in this trail). The word
   "Raised" was chosen deliberately over "Posted" (GRN's own word) or
   "Issued" (Delivery Challan's own word, one step back in this SAME
   phase) — reusing "Issued" here would have repeated the exact
   collision Delivery Challan's own header warned about avoiding for
   "Dispatched"/Module 07. "Raised" is also just how a tax invoice is
   actually described in real business language ("raise an invoice"),
   so it isn't a forced substitute.

   NO PAYMENT TRACKING HERE — A DELIBERATE SCOPE LINE AGAINST THE NEXT
   TWO MODULES: this document formally bills; whether it's actually been
   paid is Payment Collection's (#08) and Receipt's (#09) job, the exact
   same "creation vs. money changing hands are different modules"
   boundary Invoice Verification and Vendor Payment kept separate on the
   Procurement side. No `paymentStatus`/`amountPaid` field exists here,
   and none should be added by a future module reaching back into this
   file — give Payment Collection its own home for that.

   EXCLUSIVITY, SAME LIVE-SCAN SHAPE AS EVERY EARLIER LINK: `getLinked-
   ChallanIds()`/`getAvailableIssuedChallansForCompany()`, pool =
   `ERP_DeliveryChallanRepository.getIssuedForCompany()`. `findInvoice-
   ForChallan()` is the retrofit hook — Delivery Challan's own Detail
   modal picks up a "Linked to Tax Invoice" row from it. `getRaisedFor-
   Company()` is the FK-surface hook later Sales modules (Dispatch and/or
   Payment Collection) are expected to read from — no field built ahead
   of time on their behalf, the same "defer what nothing yet blocks"
   discipline every retrofit in this codebase has followed without
   exception. No duplicate-check needed — same "structurally not
   applicable" reasoning as Sales Order's and Delivery Challan's own:
   exclusivity plus a computed-not-freely-added line array leaves nothing
   that could duplicate.
   ========================================================================== */

const ERP_TAX_INVOICE_KEY = "erp_tax_invoices";

const ERP_TAX_INVOICE_STATUSES = ["Draft", "Raised", "Cancelled"];

const ERP_TaxInvoiceRepository = {
  statuses: ERP_TAX_INVOICE_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_TAX_INVOICE_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_TAX_INVOICE_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((inv) => inv.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((inv) => inv.id === id) || null;
  },

  /** COMP-001-TI-01, COMP-001-TI-02, ... */
  nextInvoiceCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((inv) => {
      const match = /-TI-(\d+)$/.exec(inv.invoiceCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-TI-${String(max + 1).padStart(2, "0")}`;
  },

  /** Only a Draft can be edited — and only the header (invoiceDate/
      dueDate/notes). Lines are never editable at any status — see file
      header. */
  canEdit(invoice) {
    return invoice.status === "Draft";
  },

  canDelete(invoice) {
    return invoice.status === "Draft" || invoice.status === "Cancelled";
  },

  /** Same partial-aware shape as every priced document in this
      codebase. */
  computeLineTotal(line) {
    const price = line.unitPrice;
    if (price === null || price === undefined || price === "" || isNaN(Number(price))) return null;
    return Number(line.quantity) * Number(price);
  },
  computeLineTax(line) {
    const lineTotal = this.computeLineTotal(line);
    if (lineTotal == null) return null;
    if (!line.taxId || typeof ERP_TaxRepository === "undefined") return 0;
    const tax = ERP_TaxRepository.findById(line.taxId);
    if (!tax) return 0;
    return lineTotal * (Number(tax.ratePct) || 0) / 100;
  },
  computeGrandTotal(invoice) {
    let subtotal = 0, taxTotal = 0, pricedCount = 0;
    (invoice.invoiceLines || []).forEach((line) => {
      const lineTotal = this.computeLineTotal(line);
      if (lineTotal != null) {
        subtotal += lineTotal;
        taxTotal += this.computeLineTax(line) || 0;
        pricedCount++;
      }
    });
    return { subtotal, taxTotal, total: subtotal + taxTotal, pricedCount, totalCount: (invoice.invoiceLines || []).length };
  },

  /** The two-hop join — see file header. Matches each challan line to
      its sales-order counterpart BY ID, combines delivered quantity with
      agreed pricing, and resolves each line's HSN code from its linked
      catalog item, if any. */
  buildInvoiceLines(challan, salesOrder) {
    const soLineById = {};
    (salesOrder.lineItems || []).forEach((l) => { soLineById[l.id] = l; });

    return (challan.challanLines || []).map((cLine) => {
      const soLine = soLineById[cLine.id] || {};
      const item = cLine.itemId && typeof ERP_ItemRepository !== "undefined" ? ERP_ItemRepository.findById(cLine.itemId) : null;
      const hsnCodeId = item && item.hsnCodeId ? item.hsnCodeId : null;
      return {
        id: cLine.id,
        itemId: cLine.itemId,
        lineDescription: cLine.lineDescription,
        quantity: cLine.deliveredQuantity,
        unitPrice: soLine.unitPrice != null ? soLine.unitPrice : null,
        taxId: soLine.taxId || null,
        hsnCodeId
      };
    });
  },

  /** Every challan id currently claimed by a non-Cancelled invoice in
      this company. */
  getLinkedChallanIds(companyId, excludeInvoiceId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((inv) => {
      if (inv.id === excludeInvoiceId || inv.status === "Cancelled") return;
      if (inv.challanId) ids.add(inv.challanId);
    });
    return ids;
  },

  /** Issued challans not already claimed elsewhere — the pool the
      "raise an invoice against a challan" picker offers. */
  getAvailableIssuedChallansForCompany(companyId, excludeInvoiceId) {
    if (typeof ERP_DeliveryChallanRepository === "undefined") return [];
    const claimed = this.getLinkedChallanIds(companyId, excludeInvoiceId);
    return ERP_DeliveryChallanRepository.getIssuedForCompany(companyId).filter((c) => !claimed.has(c.id));
  },

  /** The retrofit hook for Delivery Challan's own Detail modal. */
  findInvoiceForChallan(companyId, challanId) {
    return this.getAllForCompany(companyId).find((inv) =>
      inv.status !== "Cancelled" && inv.challanId === challanId
    ) || null;
  },

  /** The FK-surface hook later Sales modules are expected to read from
      — every Raised invoice for this company, oldest-raised-first
      (FIFO). */
  getRaisedForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((inv) => inv.status === "Raised")
      .sort((a, b) => new Date(a.raisedAt) - new Date(b.raisedAt));
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  /** Computes invoiceLines once via buildInvoiceLines() — never
      recomputed after this. See file header. */
  create(company, challan, salesOrder, data) {
    const record = {
      id: "TI-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      invoiceCode: this.nextInvoiceCode(company),
      challanId: challan.id,
      salesOrderId: salesOrder.id,
      customerId: challan.customerId,
      invoiceLines: this.buildInvoiceLines(challan, salesOrder),
      invoiceDate: null,
      dueDate: null,
      notes: "",
      status: "Draft",
      raisedAt: null, raisedByUsername: null,
      cancelledAt: null, cancelledByUsername: null,
      createdAt: new Date().toISOString(),
      ...data
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Header-field edits ONLY — invoiceLines is never touched via
      update(). */
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((inv) => inv.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Raised. No approval gate — see file header. */
  raise(id, actorUsername) {
    return this.update(id, { status: "Raised", raisedAt: new Date().toISOString(), raisedByUsername: actorUsername });
  },

  reopen(id) {
    return this.update(id, { status: "Draft", raisedAt: null, raisedByUsername: null });
  },

  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  remove(id) {
    const inv = this.findById(id);
    if (!inv || !this.canDelete(inv)) return false;
    const all = this.getAll().filter((r) => r.id !== id);
    this._saveAll(all);
    return true;
  }
};
