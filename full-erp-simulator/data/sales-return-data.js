/* =============================================================================
   DOT ERP
   FILE:  data/sales-return-data.js
   ROLE:  Data-access layer for Sales Return — Phase 15, Module 01. The
          first module of the Returns & Credit/Debit Notes phase, and the
          first document in this whole project that moves stock BACKWARDS
          along a chain instead of forwards.

   BUILT FROM A RAISED TAX INVOICE, NOT THE DELIVERY CHALLAN — checked,
   not defaulted. Both were plausible parents: the challan is what
   physically left the warehouse, so mirroring it would have been the
   tidy-looking choice. But a customer returns goods against an INVOICE
   (that's the document they hold, that's the number they quote, and
   that's the document a Credit Note must ultimately reference for GST
   purposes). Dispatch already made this exact call one phase earlier,
   for the same underlying reason — see dispatch-data.js's own header.
   That also makes Tax Invoice a genuine FOUR-way hub now (Dispatch,
   Payment Collection, Receipt, and this), not a three-way one.

   QUANTITY ONLY, NO PRICING AT ALL — THE DELIVERY CHALLAN PRECEDENT,
   MIRRORED. `returnLines[]` carries no `unitPrice` and no `taxId`,
   deliberately, exactly the way `challanLines[]` doesn't. A Sales
   Return records a PHYSICAL fact (this much came back); the MONEY fact
   (what we owe the customer for it) belongs to Credit Note, Module 02
   of this phase, which will resolve pricing by joining each return line
   back to its own invoice line BY LINE ID — the same two-hop join
   `tax-invoice-data.js`'s own `buildInvoiceLines()` already performs in
   the forward direction, since every module in this chain has preserved
   each line's own id unbroken since Sales Quotation. Do NOT bolt
   pricing onto this file later; that would collapse a boundary this
   project has held on the outbound side since Phase 5.

   NOT EXCLUSIVE OVER ITS PARENT INVOICE — the second module in this
   project to break the "one downstream record per upstream one" shape,
   after Payment Collection (Phase 5, #8). Several partial returns
   against one invoice over time is a normal, real thing, not a
   duplicate to prevent. `linkedInvoiceId` is a plain foreign key, and
   the invoice picker offers every Raised invoice every time, never
   filtered to "available" ones.

   WHAT REPLACES EXCLUSIVITY IS A CUMULATIVE OVER-RETURN GUARD, WHICH IS
   A GENUINELY NEW KIND OF CHECK IN THIS CODEBASE — not any of the
   numbered duplicate-check resolutions. Per invoice LINE, the sum of
   every non-Cancelled return's own `returnQuantity` can never exceed
   what was invoiced. It hard-blocks, because returning more than was
   ever sold is a real impossibility, not a redundant record — the same
   reasoning Leave Application's own overlap check uses, applied to a
   quantity rather than a date range. `getReturnedQuantityForLine()` is
   a live scan, never a stored running total, so a cancelled return
   frees its quantity up again automatically with nothing to reconcile.

   STOCK COMES BACK AT COST, NOT AT SALE PRICE — and the cost used is
   `ERP_StockValuationRepository.getWeightedAverageCost()` for the
   destination warehouse, reused directly from the convention Stock
   Transfer (Phase 7) and Material Issue (Phase 10) already established
   rather than reinvented. NAMED SIMPLIFICATION: a fully precise system
   would restore the exact FIFO layers the original sale consumed, at
   their own original costs. This does not; it creates one new layer at
   the current weighted-average cost. That's the same honest trade-off
   Stock Transfer's own header already documents, and it's stated here
   rather than implied.

   "NO GL POSTING ON THIS MODULE" ABOVE WAS TRUE UNTIL THE PHASE 19
   RETROFIT (item 1) — Credit Note's own Dr Sales Revenue / Cr AR was
   always only HALF the reversal: it never touched Inventory or COGS
   at all (checked directly against its own file), so the physical
   half of a return — stock genuinely coming back, at real cost — had
   no GL effect of its own until now. `post()` below still writes the
   exact same Stock Ledger entry it always did; it now ALSO returns a
   `costedLines` array (cost already being looked up per line for that
   entry — this just captures it) for gl-posting-data.js's own new
   `postSalesReturnCogs()`, called by the page right after post()
   succeeds, same two-call shape Delivery Challan's page already uses
   for `postDeliveryCogs()`. That posting needs one fact this module
   never captured before: each line's `condition` (`"Resalable"` or
   `"Damaged / Scrap"`, see `ERP_SALES_RETURN_CONDITIONS` below) —
   whether the returned unit is fit to sell again genuinely changes
   which account absorbs its value, so it's captured on the line
   itself, not guessed at GL time.

   LIFECYCLE: Draft -> Returned, +Cancelled. Terminal status is
   `Returned`, NOT `Received` — a near-miss collision with Receipt's own
   terminal state (money confirmed in the bank), resolved the same way
   Dispatch/Delivery Challan and Receipt/Payment Collection resolved
   theirs: two genuinely different facts never share a status word in
   this project, because status-history displays become unreadable when
   they do. Cancel is Draft-only; once Returned, the Stock Ledger has a
   real entry and Stock Ledger has no update()/remove() at all, so
   there's nothing honest to undo — the same immutability GRN, Material
   Issue and Stock Adjustment all settled on.
   ========================================================================== */

const ERP_SALES_RETURN_KEY = "erp_sales_returns";

const ERP_SALES_RETURN_STATUSES = ["Draft", "Returned", "Cancelled"];

/** Fixed vocabulary, looped into a <select> — the `.xTypes` discipline
    every controlled list in this project follows (.paymentMethods,
    .transportModes, .reasons on Stock Adjustment, and so on). */
const ERP_SALES_RETURN_REASONS = [
  "Damaged in Transit",
  "Wrong Item Shipped",
  "Quality Issue",
  "Excess Supply",
  "Customer Cancelled Order",
  "Other"
];

/** PHASE 19 RETROFIT: per-LINE, not per-document — a single return can
    genuinely mix a resalable unit and a damaged one under the same
    header `reason`. `reason` says why the customer sent it back;
    `condition` says what state it came back IN, and gl-posting-
    data.js's own `postSalesReturnCogs()` is the only reader — the GL
    treatment genuinely depends on it (see that file's own header,
    item 12). Defaults to "Resalable" on every line, including lines
    on a record created before this field existed (a missing/unknown
    value reads as Resalable — see getActiveLines() usage sites). */
const ERP_SALES_RETURN_CONDITIONS = ["Resalable", "Damaged / Scrap"];

const ERP_SalesReturnRepository = {
  statuses: ERP_SALES_RETURN_STATUSES,
  reasons: ERP_SALES_RETURN_REASONS,
  conditions: ERP_SALES_RETURN_CONDITIONS,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_SALES_RETURN_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_SALES_RETURN_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((r) => r.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((r) => r.id === id) || null;
  },

  /** COMP-001-SR-01, COMP-001-SR-02, ... — same shape every document
      code in this project uses. */
  nextReturnCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((r) => {
      const match = /-SR-(\d+)$/.exec(r.returnCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-SR-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(record) { return record.status === "Draft"; },
  canDelete(record) { return record.status === "Draft" || record.status === "Cancelled"; },

  actorLabel(username) {
    return typeof window !== "undefined" && window.ERP && window.ERP.actorLabel
      ? window.ERP.actorLabel(username)
      : (username || "system");
  },


  /* -----------------------------------------------------------------------
     THE OVER-RETURN GUARD — see file header. Live scan, never stored.
     --------------------------------------------------------------------- */

  /** How much of ONE invoice line has already been claimed by other
      non-Cancelled returns. `excludeReturnId` lets an edit-in-progress
      ignore its own current figures. */
  getReturnedQuantityForLine(companyId, invoiceId, lineId, excludeReturnId) {
    return this.getAllForCompany(companyId)
      .filter((r) => r.linkedInvoiceId === invoiceId && r.status !== "Cancelled" && r.id !== excludeReturnId)
      .reduce((sum, r) => {
        const line = (r.returnLines || []).find((l) => l.id === lineId);
        return sum + (line ? Number(line.returnQuantity) || 0 : 0);
      }, 0);
  },

  /** The remaining returnable quantity for one invoice line, floored at
      zero. This is what the form's own per-line max is built from. */
  getReturnableQuantityForLine(companyId, invoice, lineId, excludeReturnId) {
    const invLine = (invoice.invoiceLines || []).find((l) => l.id === lineId);
    if (!invLine) return 0;
    const already = this.getReturnedQuantityForLine(companyId, invoice.id, lineId, excludeReturnId);
    return Math.max(0, (Number(invLine.quantity) || 0) - already);
  },

  /** Hard validation, called by create()/update() AND by the page before
      it ever gets that far — the page shows the specific line, the
      repository refuses regardless. Returns {ok, errors:[{lineId, message}]}. */
  validateQuantities(companyId, invoice, returnLines, excludeReturnId) {
    const errors = [];
    (returnLines || []).forEach((line) => {
      const qty = Number(line.returnQuantity) || 0;
      if (qty < 0) {
        errors.push({ lineId: line.id, message: "A return quantity can't be negative." });
        return;
      }
      const returnable = this.getReturnableQuantityForLine(companyId, invoice, line.id, excludeReturnId);
      if (qty > returnable) {
        errors.push({
          lineId: line.id,
          message: `Only ${returnable} left to return on this line — the rest is already covered by other returns.`
        });
      }
    });
    const totalQty = (returnLines || []).reduce((s, l) => s + (Number(l.returnQuantity) || 0), 0);
    if (totalQty <= 0) {
      errors.push({ lineId: null, message: "A return needs at least one line with a quantity above zero." });
    }
    return { ok: errors.length === 0, errors };
  },

  /** Invoices with anything at all still returnable. Deliberately NOT an
      exclusivity pool (see file header) — a partly-returned invoice
      stays in the list until it's fully returned. */
  getReturnableInvoicesForCompany(companyId) {
    if (typeof ERP_TaxInvoiceRepository === "undefined") return [];
    return ERP_TaxInvoiceRepository.getRaisedForCompany(companyId).filter((inv) =>
      (inv.invoiceLines || []).some((l) => this.getReturnableQuantityForLine(companyId, inv, l.id) > 0)
    );
  },


  /* -----------------------------------------------------------------------
     LINE BUILDING + ROLLUPS
     --------------------------------------------------------------------- */

  /** One row per invoice line, quantity-only. `invoicedQuantity` and
      `alreadyReturnedQuantity` are frozen reference figures captured at
      creation for display; `returnQuantity` starts at 0 because — unlike
      Goods Receipt, where a full-quantity default is the normal case —
      a return is almost never for the whole invoice. */
  buildReturnLines(companyId, invoice) {
    return (invoice.invoiceLines || []).map((l) => ({
      id: l.id,
      itemId: l.itemId,
      lineDescription: l.lineDescription,
      invoicedQuantity: Number(l.quantity) || 0,
      alreadyReturnedQuantity: this.getReturnedQuantityForLine(companyId, invoice.id, l.id),
      returnQuantity: 0,
      condition: ERP_SALES_RETURN_CONDITIONS[0]
    }));
  },

  computeTotalReturnQuantity(record) {
    return (record.returnLines || []).reduce((s, l) => s + (Number(l.returnQuantity) || 0), 0);
  },

  /** Lines with something actually being returned — the only ones that
      ever reach Stock Ledger or a Credit Note. */
  getActiveLines(record) {
    return (record.returnLines || []).filter((l) => (Number(l.returnQuantity) || 0) > 0);
  },


  /* -----------------------------------------------------------------------
     FK SURFACE — what later modules read
     --------------------------------------------------------------------- */

  /** AGGREGATE retrofit hook for Tax Invoice's own Detail modal — a
      count plus the most recent status, not a single "Linked to X" row,
      mirroring Payment Collection's own aggregate retrofit rather than
      Dispatch's single-link one, because this module isn't exclusive. */
  getAllForInvoice(companyId, invoiceId) {
    return this.getAllForCompany(companyId).filter((r) => r.linkedInvoiceId === invoiceId);
  },

  getLatestForInvoice(companyId, invoiceId) {
    const all = this.getAllForInvoice(companyId, invoiceId);
    return all.length ? all[0] : null;
  },

  /** FIFO — the hook Credit Note (Module 02 of this phase) reads from. */
  getReturnedForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((r) => r.status === "Returned")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },


  /* -----------------------------------------------------------------------
     CRUD + LIFECYCLE
     --------------------------------------------------------------------- */

  /** Takes the full parent record, not just an id — the same signature
      shape Sales Order / Delivery Challan / Tax Invoice all use, for the
      same reason: the line copy has to happen at this exact moment. */
  create(company, invoice, data, actorUsername) {
    const record = {
      id: "SR-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      returnCode: this.nextReturnCode(company),
      linkedInvoiceId: invoice.id,
      customerId: invoice.customerId,
      returnToWarehouseId: null,
      returnDate: new Date().toISOString().slice(0, 10),
      reason: ERP_SALES_RETURN_REASONS[0],
      receivedByEmployeeId: null,
      returnLines: this.buildReturnLines(company.id, invoice),
      remarks: "",
      status: "Draft",
      returnedAt: null, returnedByUsername: null,
      cancelledAt: null, cancelledByUsername: null,
      createdByUsername: actorUsername || "system",
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
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    if (all[idx].status !== "Draft") return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Every condition that must hold before stock can move. Kept separate
      from post() so the Detail modal can disable its own button with the
      same logic the repository will enforce anyway. */
  canPost(record) {
    if (!record || record.status !== "Draft") return false;
    if (!record.returnToWarehouseId) return false;
    return this.computeTotalReturnQuantity(record) > 0;
  },

  /** Writes ONE Stock Ledger entry per active line, then flips the
      record to Returned. Returns {success, record?, reason?} and never
      throws — the same shape every posting function in this project
      uses. A line whose item can't be costed still posts (quantity is
      the fact that matters); its unitCost is recorded as null, exactly
      the way recordMovement() already allows.

      PHASE 19 RETROFIT: also builds and returns `costedLines` — one
      `{itemId, quantity, cost, condition}` per line whose Stock Ledger
      entry actually wrote (a null-unitCost line contributes `cost: 0`,
      same "posts anyway, contributes nothing to GL" treatment every
      other uncostable-line case in this project's GL retrofits uses)
      — for gl-posting-data.js's own `postSalesReturnCogs()`. */
  post(id, company, actorUsername) {
    const record = this.findById(id);
    if (!record) return { success: false, reason: "This sales return no longer exists." };
    if (record.status !== "Draft") return { success: false, reason: "Only a Draft sales return can be posted." };
    if (!record.returnToWarehouseId) return { success: false, reason: "Pick the warehouse the goods are coming back into first." };
    if (typeof ERP_StockLedgerRepository === "undefined") return { success: false, reason: "Stock Ledger isn't loaded on this page." };

    const lines = this.getActiveLines(record);
    if (!lines.length) return { success: false, reason: "Nothing to post — every line's return quantity is zero." };

    let posted = 0;
    const costedLines = [];
    lines.forEach((line) => {
      let unitCost = null;
      if (typeof ERP_StockValuationRepository !== "undefined" && line.itemId) {
        const wac = ERP_StockValuationRepository.getWeightedAverageCost(company.id, line.itemId, record.returnToWarehouseId);
        if (wac != null && !isNaN(Number(wac))) unitCost = Number(wac);
      }
      const quantity = Number(line.returnQuantity) || 0;
      const movement = ERP_StockLedgerRepository.recordMovement(company, {
        itemId: line.itemId,
        warehouseId: record.returnToWarehouseId,
        transactionDate: record.returnDate,
        transactionType: "Sales Return",
        quantity,
        unitCost,
        referenceType: "Sales Return",
        referenceId: record.id,
        narration: `Returned against ${record.returnCode}`
      }, actorUsername);
      if (movement) {
        posted++;
        costedLines.push({
          itemId: line.itemId,
          quantity,
          cost: unitCost != null ? unitCost * quantity : 0,
          condition: line.condition === "Damaged / Scrap" ? "Damaged / Scrap" : "Resalable"
        });
      }
    });

    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    all[idx] = {
      ...all[idx],
      status: "Returned",
      returnedAt: new Date().toISOString(),
      returnedByUsername: actorUsername || "system"
    };
    this._saveAll(all);
    return { success: true, record: all[idx], linesPosted: posted, costedLines };
  },

  cancel(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    if (all[idx].status !== "Draft") return null;
    all[idx] = {
      ...all[idx],
      status: "Cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledByUsername: actorUsername || "system"
    };
    this._saveAll(all);
    return all[idx];
  },

  remove(id) {
    const record = this.findById(id);
    if (!record || !this.canDelete(record)) return false;
    this._saveAll(this.getAll().filter((r) => r.id !== id));
    return true;
  }
};
