/* =============================================================================
   DOT ERP
   FILE:  data/stock-posting-data.js
   ROLE:  Retrofit orchestration layer — Phase 7's equivalent of Phase
          6's gl-posting-data.js. GRN and Delivery Challan were both
          shipped back in Phase 4/5, long before Stock Ledger existed;
          this file is the ONE place that teaches them about it, so
          neither grn-data.js nor delivery-challan-data.js needs to be
          touched at all. Each affected page (grn.js, delivery-
          challan.js) gains exactly one typeof-guarded call, right after
          its own post()/issue(), the same shape gl-posting-data.js
          established: "when a new module needs to affect several
          already-shipped modules the same way, reach for one new
          orchestration file before reaching for N edits to N existing
          ones" (see CONTINUE_HERE.md Section 9). Never throws; every
          function returns {success, entries?, skippedCount?, reason?}
          so the calling page can toast an honest outcome either way.

   TWO DIFFERENT ITEM-RESOLUTION PATHS, BECAUSE THE TWO SOURCE MODULES
   DON'T CARRY ITEM THE SAME WAY:

   - Delivery Challan's own `challanLines[]` already carries `itemId`
     directly (copied straight from the Sales Order line) — no chain
     walk needed. It CAN still be null, though: a Sales Order line is
     only optionally linked to a catalog item, the same "free-text
     description line" case Purchase Requisition's own lines allow. A
     null-itemId line is skipped, not guessed at.

   - GRN's own `grnLines[]` carries only `prLineItemId` — the actual
     item lives on the ORIGINATING Purchase Requisition's own line item,
     found by walking GRN -> (`linkedReceiptId`) -> Goods Receipt ->
     (`linkedScheduleId`) -> Delivery Schedule -> (`linkedPoId`) ->
     Purchase Order -> (`linkedQuotationId`) -> Quotation -> (`rfqId`)
     -> RFQ -> (`linkedPrId`) -> Purchase Requisition -> `lineItems[]`
     matched by id -> `itemId`. This is the exact same chain grn.js's
     own `resolveChain()` already walks for price/description purposes
     — reused here rather than re-derived, and it can ALSO legitimately
     end in `itemId: null` (a PR line never linked to a catalog item),
     which is skipped the same way. Warehouse, for GRN, comes from a
     much shorter hop: the Goods Receipt's own `receivedWarehouseId`
     field directly (no chain-walk needed for that part).

   NEVER PARTIALLY POSTS SILENTLY — every skipped line (unresolvable
   item, or a Delivery Challan with no dispatch warehouse set at all,
   since that field is optional) is counted and returned as
   `skippedCount`, the same "surface the gap, don't hide it" discipline
   ap-aging-data.js's own `unresolvedCount` established. A GRN/challan
   with EVERY line unresolvable still returns `success: true` with
   `entries: []` and the full `skippedCount` — posting zero real
   movements isn't a failure of this file, it's an honest reflection of
   data that was already incomplete upstream.
   ========================================================================== */

const ERP_StockPostingRepository = {

  /** Resolves the true itemId for one GRN line via the same multi-hop
      chain grn.js's own resolveChain() walks. Returns null the moment
      any hop is missing — never throws. */
  _resolveGrnLineItemId(grn, prLineItemId) {
    if (typeof ERP_GoodsReceiptRepository === "undefined" || typeof ERP_DeliveryScheduleRepository === "undefined" ||
        typeof ERP_PurchaseOrderRepository === "undefined" || typeof ERP_QuotationRepository === "undefined" ||
        typeof ERP_RfqRepository === "undefined" || typeof ERP_PurchaseRequisitionRepository === "undefined") return null;

    const receipt = grn.linkedReceiptId ? ERP_GoodsReceiptRepository.findById(grn.linkedReceiptId) : null;
    if (!receipt) return null;
    const schedule = receipt.linkedScheduleId ? ERP_DeliveryScheduleRepository.findById(receipt.linkedScheduleId) : null;
    if (!schedule) return null;
    const po = schedule.linkedPoId ? ERP_PurchaseOrderRepository.findById(schedule.linkedPoId) : null;
    if (!po) return null;
    const quotation = po.linkedQuotationId ? ERP_QuotationRepository.findById(po.linkedQuotationId) : null;
    if (!quotation) return null;
    const rfq = quotation.rfqId ? ERP_RfqRepository.findById(quotation.rfqId) : null;
    if (!rfq) return null;
    const pr = rfq.linkedPrId ? ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId) : null;
    if (!pr) return null;
    const prLine = (pr.lineItems || []).find((l) => l.id === prLineItemId);
    return prLine ? prLine.itemId : null;
  },

  /** Called once, right after grn.js's own ERP_GrnRepository.post(). One
      Stock Ledger "GRN Receipt" entry per resolvable line, at the
      warehouse the linked Goods Receipt was actually received into. */
  postGrnReceipt(company, grn, actorUsername) {
    if (typeof ERP_StockLedgerRepository === "undefined") return { success: false, reason: "Stock Ledger not loaded on this page." };
    if (!grn || grn.status !== "Posted") return { success: false, reason: "GRN is not Posted." };

    const receipt = grn.linkedReceiptId && typeof ERP_GoodsReceiptRepository !== "undefined" ? ERP_GoodsReceiptRepository.findById(grn.linkedReceiptId) : null;
    const warehouseId = receipt ? receipt.receivedWarehouseId : null;
    if (!warehouseId) return { success: true, entries: [], skippedCount: (grn.grnLines || []).length, reason: "No receiving warehouse set on the linked Goods Receipt." };

    const entries = [];
    let skippedCount = 0;

    (grn.grnLines || []).forEach((line) => {
      const itemId = this._resolveGrnLineItemId(grn, line.prLineItemId);
      const quantity = Number(line.quantity) || 0;
      if (!itemId || quantity <= 0) { skippedCount += 1; return; }

      const entry = ERP_StockLedgerRepository.recordMovement(company, {
        itemId, warehouseId,
        transactionDate: grn.postedAt ? grn.postedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        transactionType: "GRN Receipt",
        quantity,
        unitCost: line.unitPrice,
        referenceType: "GRN",
        referenceId: grn.id,
        narration: `GRN ${grn.grnNumber}`
      }, actorUsername);
      if (entry) entries.push(entry); else skippedCount += 1;
    });

    return { success: true, entries, skippedCount };
  },

  /** Called once, right after delivery-challan.js's own
      ERP_DeliveryChallanRepository.issue(). One Stock Ledger "Delivery
      Issue" entry per resolvable line, at the challan's own
      dispatchWarehouseId — which is optional on this record, so a
      challan issued without one produces zero entries and a
      skippedCount covering every line, surfaced rather than guessed
      at. */
  postDeliveryIssue(company, challan, actorUsername) {
    if (typeof ERP_StockLedgerRepository === "undefined") return { success: false, reason: "Stock Ledger not loaded on this page." };
    if (!challan || challan.status !== "Issued") return { success: false, reason: "Delivery Challan is not Issued." };

    if (!challan.dispatchWarehouseId) {
      return { success: true, entries: [], skippedCount: (challan.challanLines || []).length, reason: "No dispatch warehouse set on this challan." };
    }

    const entries = [];
    const costedLines = [];   // for gl-posting-data.js postDeliveryCogs() — see there for why cost isn't stored on the entry itself
    let skippedCount = 0;
    const transactionDate = challan.issuedAt ? challan.issuedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);

    (challan.challanLines || []).forEach((line) => {
      const quantity = Number(line.deliveredQuantity) || 0;
      if (!line.itemId || quantity <= 0) { skippedCount += 1; return; }

      // Cost this line's FIFO layers BEFORE recordMovement() below writes the outgoing
      // entry for it — computeConsumptionCost() reads the ledger as it stands right now,
      // which is exactly the pre-consumption state it needs. Doing this one line at a time,
      // interleaved with the write, is what makes two lines for the same item on one challan
      // cost correctly against each other instead of both reading the same starting layers.
      const costed = (typeof ERP_StockValuationRepository !== "undefined")
        ? ERP_StockValuationRepository.computeConsumptionCost(company.id, line.itemId, challan.dispatchWarehouseId, transactionDate, quantity)
        : { cost: 0, shortfallQuantity: quantity };

      const entry = ERP_StockLedgerRepository.recordMovement(company, {
        itemId: line.itemId, warehouseId: challan.dispatchWarehouseId,
        transactionDate,
        transactionType: "Delivery Issue",
        quantity: -quantity,
        unitCost: null,
        referenceType: "DeliveryChallan",
        referenceId: challan.id,
        narration: `Delivery Challan ${challan.challanCode}`
      }, actorUsername);
      if (entry) { entries.push(entry); costedLines.push({ itemId: line.itemId, quantity, cost: costed.cost, shortfallQuantity: costed.shortfallQuantity }); }
      else skippedCount += 1;
    });

    return { success: true, entries, costedLines, skippedCount };
  }
};
