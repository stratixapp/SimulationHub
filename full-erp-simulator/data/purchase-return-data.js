/* =============================================================================
   DOT ERP
   FILE:  data/purchase-return-data.js
   ROLE:  Data-access layer for Purchase Return — Phase 15, Module 03a.
          The Procurement-side mirror of Sales Return — read that file's
          own header first, this one assumes that context throughout.

   BUILT FROM ONE POSTED GRN, NOT THE PURCHASE ORDER OR GOODS RECEIPT —
   checked, not defaulted, the same way Sales Return chose the invoice
   over the challan. A GRN is the formal, price-bearing, numbered
   document this project's own downstream accounting modules (Invoice
   Verification, Three-Way Matching, and now this one) all reference by
   name; Goods Receipt is the fast, informal dock entry Module 13's own
   header explicitly says is NOT the trusted record. Returning against
   an informal note would leave no clean accounting trail; returning
   against the GRN does.

   QUANTITY ONLY, NO PRICING — the Sales Return precedent mirrored onto
   the buying side. `returnLines[]` carries no `unitPrice` and no
   `taxId`, deliberately, exactly the way Sales Return's own lines
   don't. This is the physical fact (goods left the warehouse back to
   the vendor); the money fact (how much less we now owe) is Debit
   Note's job, Module 03b of this same phase, which resolves pricing —
   AND, where captured, real tax — by joining back through the SAME
   `prLineItemId` this module preserves on every line, unbroken from
   the original Purchase Requisition all the way through Invoice
   Verification. This is the Procurement-side counterpart of the
   line-id join Sales Return promised on the Sales side; the join key
   here is `prLineItemId` rather than a shared `id`, because that is
   what this project's own Procurement chain has used as its stable
   line identifier since Module 2 of Phase 4 — checked directly in
   po-data.js, grn-data.js and invoice-verification-data.js before
   assuming it would carry through unbroken this far.

   ITEM RESOLUTION NEEDS A CHAIN-WALK GRN'S OWN LINES DON'T CARRY —
   a GRN line stores `prLineItemId`/`quantity`/`unitPrice`, never
   `itemId` directly (checked in grn-data.js and pages/grn.js before
   assuming otherwise); the real item only exists on the ORIGINAL PR
   line, six hops back. `resolveChainForGrn()` below is a genuine
   seventh hop past `pages/grn.js`'s own `resolveChain()` (which starts
   from a Receipt, one level below a GRN) — GRN -> Receipt -> Schedule
   -> PO -> Quotation -> RFQ -> PR — the same "one hop further than the
   nearest existing chain-walk because this module starts one level
   higher" reasoning AP Aging used against Payment Request's own
   four-hop walk. `itemId` is resolved ONCE, at return-creation time,
   and frozen onto the return's own line — "resolve once, freeze," the
   same discipline Payroll's own Salary Structure resolution and Sales
   Order's own copied lines both already use — rather than re-walking
   six hops on every single render.

   NOT EXCLUSIVE OVER ITS PARENT GRN — the same call Sales Return made
   over its invoice. A GRN can receive several partial returns over
   time (three units found damaged this week, two more next month), so
   `linkedGrnId` stays a plain foreign key. What replaces exclusivity is
   the SAME KIND of cumulative-quantity guard Sales Return already
   established: per GRN line (`prLineItemId`), the sum of every
   non-Cancelled return's own `returnQuantity` can never exceed what the
   GRN itself recorded as received. Live scan, never a stored running
   total, so a cancelled return frees its claim back up automatically.

   A GENUINE, DOCUMENTED DIVERGENCE FROM SALES RETURN: AN AVAILABLE-
   STOCK CHECK ON POST(), BECAUSE THIS MOVEMENT GOES OUT, NOT IN. Sales
   Return brings stock IN and never needed to check anything was
   available first. This module sends stock OUT, back to the vendor —
   and by the time a return is raised, some of what a GRN brought in may
   already have been consumed elsewhere (sold, issued to production,
   transferred out). Reusing Material Issue's and Stock Transfer's own
   established precedent, a line whose warehouse doesn't currently hold
   enough of that item is SKIPPED at post time rather than posted
   lopsided (driving the balance negative), with the skipped count
   reported back for the page to announce — the exact same shape those
   two modules already use, applied here for the same underlying reason:
   a stock movement records a fact that must actually be physically true.

   STOCK LEAVES AT A NEGATIVE, UNCOSTED MOVEMENT — "Purchase Return" was
   added to `stock-ledger-data.js`'s own `transactionTypes` vocabulary,
   additive only. `quantity` is posted as `-Math.abs(returnQuantity)`
   and `unitCost` as `null` on every entry — the same convention every
   OTHER outbound movement in this codebase already follows (Delivery
   Issue, Transfer Out, Material Issue): `stock-ledger-data.js`'s own
   header already states outgoing entries never store unit cost. THE
   LEDGER ENTRY STAYS UNCOSTED even after the Phase 19 retrofit below —
   only the SEPARATE `costedLines` result `post()` now also returns is
   new; it exists purely for gl-posting-data.js to post against, the
   same "cost computed for GL, never written onto the ledger entry
   itself" split Delivery Challan already established.

   LIFECYCLE: Draft -> Returned, +Cancelled. Terminal status is
   `Returned` — the SAME word Sales Return uses. Checked deliberately,
   not overlooked: the two records live in different repositories, with
   different storage keys, and neither module's own status-history
   display ever mixes rows from the other, so there is no collision to
   avoid the way there was between adjacent Sales-side documents sharing
   one activity feed. Reusing the word here is honest, too — sending
   goods back is the same real-world action on both sides of a sale.

   NO GL POSTING ON THIS MODULE, deliberately, for the identical reason
   Sales Return has none: a quantity-only document has no amount to
   post. Debit Note (Module 03b) owns the financial reversal.
   ========================================================================== */

const ERP_PURCHASE_RETURN_KEY = "erp_purchase_returns";

const ERP_PURCHASE_RETURN_STATUSES = ["Draft", "Returned", "Cancelled"];

/** Fixed vocabulary, looped into a <select> — the `.xTypes` discipline
    every controlled list in this project follows. Deliberately not
    identical to Sales Return's own list: a business rarely tells a
    vendor "Customer Cancelled Order," and a vendor-side return has
    reasons a customer-side one doesn't (short shipment discovered
    late, a wrong item entirely). */
const ERP_PURCHASE_RETURN_REASONS = [
  "Damaged on Receipt",
  "Wrong Item Shipped by Vendor",
  "Quality Rejected",
  "Excess Quantity Received",
  "Ordered in Error",
  "Other"
];

const ERP_PurchaseReturnRepository = {
  statuses: ERP_PURCHASE_RETURN_STATUSES,
  reasons: ERP_PURCHASE_RETURN_REASONS,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_PURCHASE_RETURN_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_PURCHASE_RETURN_KEY, JSON.stringify(list)); return true; }
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

  nextReturnCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((r) => {
      const match = /-PR-RET-(\d+)$/.exec(r.returnCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-PR-RET-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(record) { return record.status === "Draft"; },
  canDelete(record) { return record.status === "Draft" || record.status === "Cancelled"; },

  actorLabel(username) {
    return typeof window !== "undefined" && window.ERP && window.ERP.actorLabel
      ? window.ERP.actorLabel(username)
      : (username || "system");
  },


  /* -----------------------------------------------------------------------
     THE SEVENTH-HOP CHAIN-WALK — see file header. Item resolution only;
     price is never needed here (this module carries none).
     --------------------------------------------------------------------- */

  resolveChainForGrn(grn) {
    if (typeof ERP_GoodsReceiptRepository === "undefined") return { pr: null };
    const receipt = grn.linkedReceiptId ? ERP_GoodsReceiptRepository.findById(grn.linkedReceiptId) : null;
    const schedule = receipt && typeof ERP_DeliveryScheduleRepository !== "undefined"
      ? ERP_DeliveryScheduleRepository.findById(receipt.linkedScheduleId) : null;
    const po = schedule && typeof ERP_PurchaseOrderRepository !== "undefined"
      ? ERP_PurchaseOrderRepository.findById(schedule.linkedPoId) : null;
    const quotation = po && typeof ERP_QuotationRepository !== "undefined"
      ? ERP_QuotationRepository.findById(po.linkedQuotationId) : null;
    const rfq = quotation && typeof ERP_RfqRepository !== "undefined"
      ? ERP_RfqRepository.findById(quotation.rfqId) : null;
    const pr = rfq && typeof ERP_PurchaseRequisitionRepository !== "undefined"
      ? ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId) : null;
    return { receipt, schedule, po, quotation, rfq, pr };
  },

  /** Resolves one GRN line's real item — the fact GRN's own line never
      stores directly. Returns null if any hop along the way is missing;
      callers show "Unresolved line" rather than guessing. */
  resolveItemForGrnLine(grn, prLineItemId) {
    const { pr } = this.resolveChainForGrn(grn);
    if (!pr) return null;
    const prLine = (pr.lineItems || []).find((l) => l.id === prLineItemId);
    return prLine ? prLine.itemId : null;
  },


  /* -----------------------------------------------------------------------
     THE OVER-RETURN GUARD — a QUANTITY guard, the same kind Sales
     Return uses (not Debit Note's own VALUE guard). Live scan, never
     stored.
     --------------------------------------------------------------------- */

  getReturnedQuantityForGrnLine(companyId, grnId, prLineItemId, excludeReturnId) {
    return this.getAllForCompany(companyId)
      .filter((r) => r.linkedGrnId === grnId && r.status !== "Cancelled" && r.id !== excludeReturnId)
      .reduce((sum, r) => {
        const line = (r.returnLines || []).find((l) => l.prLineItemId === prLineItemId);
        return sum + (line ? Number(line.returnQuantity) || 0 : 0);
      }, 0);
  },

  getReturnableQuantityForGrnLine(companyId, grn, prLineItemId, excludeReturnId) {
    const grnLine = (grn.grnLines || []).find((l) => l.prLineItemId === prLineItemId);
    if (!grnLine) return 0;
    const already = this.getReturnedQuantityForGrnLine(companyId, grn.id, prLineItemId, excludeReturnId);
    return Math.max(0, (Number(grnLine.quantity) || 0) - already);
  },

  validateQuantities(companyId, grn, returnLines, excludeReturnId) {
    const errors = [];
    (returnLines || []).forEach((line) => {
      const qty = Number(line.returnQuantity) || 0;
      if (qty < 0) {
        errors.push({ prLineItemId: line.prLineItemId, message: "A return quantity can't be negative." });
        return;
      }
      const returnable = this.getReturnableQuantityForGrnLine(companyId, grn, line.prLineItemId, excludeReturnId);
      if (qty > returnable) {
        errors.push({
          prLineItemId: line.prLineItemId,
          message: `Only ${returnable} left to return on this line — the rest is already covered by other returns.`
        });
      }
    });
    const totalQty = (returnLines || []).reduce((s, l) => s + (Number(l.returnQuantity) || 0), 0);
    if (totalQty <= 0) {
      errors.push({ prLineItemId: null, message: "A return needs at least one line with a quantity above zero." });
    }
    return { ok: errors.length === 0, errors };
  },

  /** Posted GRNs with anything at all still returnable. NOT an
      exclusivity pool — a partly-returned GRN stays listed until every
      line is fully returned, the identical shape Sales Return's own
      `getReturnableInvoicesForCompany()` uses. */
  getReturnableGrnsForCompany(companyId) {
    if (typeof ERP_GrnRepository === "undefined") return [];
    return ERP_GrnRepository.getAllForCompany(companyId)
      .filter((g) => g.status === "Posted")
      .filter((g) => (g.grnLines || []).some((l) => this.getReturnableQuantityForGrnLine(companyId, g, l.prLineItemId) > 0));
  },


  /* -----------------------------------------------------------------------
     LINE BUILDING + ROLLUPS
     --------------------------------------------------------------------- */

  buildReturnLines(companyId, grn) {
    return (grn.grnLines || []).map((l) => ({
      prLineItemId: l.prLineItemId,
      itemId: this.resolveItemForGrnLine(grn, l.prLineItemId),
      receivedQuantity: Number(l.quantity) || 0,
      alreadyReturnedQuantity: this.getReturnedQuantityForGrnLine(companyId, grn.id, l.prLineItemId),
      returnQuantity: 0
    }));
  },

  computeTotalReturnQuantity(record) {
    return (record.returnLines || []).reduce((s, l) => s + (Number(l.returnQuantity) || 0), 0);
  },

  getActiveLines(record) {
    return (record.returnLines || []).filter((l) => (Number(l.returnQuantity) || 0) > 0);
  },


  /* -----------------------------------------------------------------------
     FK SURFACE
     --------------------------------------------------------------------- */

  /** AGGREGATE retrofit hook for GRN's own Detail modal — GRN, like Tax
      Invoice, is not exclusive over its own return, so count + most
      recent status, mirroring Sales Return's own retrofit into Tax
      Invoice rather than a single "Linked to X" row. */
  getAllForGrn(companyId, grnId) {
    return this.getAllForCompany(companyId).filter((r) => r.linkedGrnId === grnId);
  },

  getLatestForGrn(companyId, grnId) {
    const all = this.getAllForGrn(companyId, grnId);
    return all.length ? all[0] : null;
  },

  /** FIFO — the hook Debit Note (Module 03b) reads from. */
  getReturnedForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((r) => r.status === "Returned")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },


  /* -----------------------------------------------------------------------
     CRUD + LIFECYCLE
     --------------------------------------------------------------------- */

  create(company, grn, data, actorUsername) {
    const record = {
      id: "PRET-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      returnCode: this.nextReturnCode(company),
      linkedGrnId: grn.id,
      vendorWarehouseId: null,
      returnDate: new Date().toISOString().slice(0, 10),
      reason: ERP_PURCHASE_RETURN_REASONS[0],
      returnLines: this.buildReturnLines(company.id, grn),
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

  canPost(record) {
    if (!record || record.status !== "Draft") return false;
    if (!record.vendorWarehouseId) return false;
    return this.computeTotalReturnQuantity(record) > 0;
  },

  /** Writes one Stock Ledger entry per active line whose warehouse
      currently holds enough of that item — see file header for why
      this checks availability where Sales Return's own post() didn't
      need to. Returns {success, record?, reason?, linesPosted,
      skippedCount, costedLines} and never throws.

      PHASE 19 RETROFIT: the Stock Ledger entry itself is still written
      uncosted (`unitCost: null`) — the same convention every other
      outgoing movement in this project uses, unchanged. What's new is
      costing each line via `ERP_StockValuationRepository.
      computeConsumptionCost()` BEFORE that line's entry is written —
      the identical interleaved pattern stock-posting-data.js's own
      `postDeliveryIssue()` established for Delivery Challan, needed
      here for the same reason (a second line for the same item later
      in this same return must cost against what the first one left
      behind) — and returning the result as `costedLines` for
      gl-posting-data.js's own new `postPurchaseReturnCogs()`. A
      skipped line (not enough stock) contributes nothing here, same
      as it contributes nothing to the Stock Ledger. */
  post(id, company, actorUsername) {
    const record = this.findById(id);
    if (!record) return { success: false, reason: "This purchase return no longer exists." };
    if (record.status !== "Draft") return { success: false, reason: "Only a Draft purchase return can be posted." };
    if (!record.vendorWarehouseId) return { success: false, reason: "Pick the warehouse these goods are leaving from first." };
    if (typeof ERP_StockLedgerRepository === "undefined") return { success: false, reason: "Stock Ledger isn't loaded on this page." };

    const lines = this.getActiveLines(record);
    if (!lines.length) return { success: false, reason: "Nothing to post — every line's return quantity is zero." };

    let posted = 0, skipped = 0;
    const costedLines = [];
    lines.forEach((line) => {
      const qty = Number(line.returnQuantity) || 0;
      const available = ERP_StockLedgerRepository.getBalance(company.id, line.itemId, record.vendorWarehouseId);
      if (available < qty) { skipped++; return; }

      let cost = 0;
      if (typeof ERP_StockValuationRepository !== "undefined") {
        const costed = ERP_StockValuationRepository.computeConsumptionCost(company.id, line.itemId, record.vendorWarehouseId, record.returnDate, qty);
        cost = costed.cost || 0;
      }

      const movement = ERP_StockLedgerRepository.recordMovement(company, {
        itemId: line.itemId,
        warehouseId: record.vendorWarehouseId,
        transactionDate: record.returnDate,
        transactionType: "Purchase Return",
        quantity: -Math.abs(qty),
        unitCost: null,
        referenceType: "Purchase Return",
        referenceId: record.id,
        narration: `Returned to vendor against ${record.returnCode}`
      }, actorUsername);
      if (movement) {
        posted++;
        costedLines.push({ itemId: line.itemId, quantity: qty, cost });
      }
    });

    if (!posted) {
      return { success: false, reason: "Nothing could be posted — none of the returned items currently have enough stock in that warehouse." };
    }

    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    all[idx] = {
      ...all[idx],
      status: "Returned",
      returnedAt: new Date().toISOString(),
      returnedByUsername: actorUsername || "system"
    };
    this._saveAll(all);
    return { success: true, record: all[idx], linesPosted: posted, skippedCount: skipped, costedLines };
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
