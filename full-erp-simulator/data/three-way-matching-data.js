/* =============================================================================
   DOT ERP
   FILE:  data/three-way-matching-data.js
   ROLE:  Data-access layer for Three-Way Matching — Phase 4, Module 17.
          This is the module CONTINUE_HERE.md flagged as reading from
          THREE upstream chains at once — the PO, its GRN (found by
          walking PO -> Delivery Schedule -> Goods Receipt -> GRN), and
          its Invoice Verification — rather than one exclusive parent
          link. It's also the FIRST real decision-gate on the receiving
          side since Vendor Confirmation: Approve for Payment or Hold,
          feeding directly into Payment Request (Module 18).

   BUILT FROM ONE INVOICE VERIFICATION, NOT A NEW COMBINATION OF THREE
   LINKS. `linkedInvoiceVerificationId` is the ONLY stored relationship
   (required, exclusive — `getLinkedInvoiceVerificationIds`/
   `getAvailableVerifiedInvoicesForCompany`, the ninth instance of the
   exclusivity pattern this session). The PO and GRN are never stored as
   separate fields — they're resolved by walking the invoice's own
   `linkedPoId`, then from the PO onward through Delivery Schedule and
   Goods Receipt to find a GRN, EVERY time this record is viewed. This is
   the "prefer live-query over a stored field" bias (CONTINUE_HERE.md
   Section 9) taken to its logical extreme: not just one relationship,
   but the entire multi-hop chain, recomputed fresh on every read so it
   can never go stale if something upstream changes.

   `computeMatchLines()` IS THE HEART OF THIS FILE — A PURE, UNSTORED
   COMPUTATION, NOT A DATA FIELD. Given a record, it walks invoice ->
   PO -> schedule -> receipt -> GRN, then for each PO line compares
   ordered qty/price (PO) against received qty (GRN, if one exists) and
   invoiced qty/price (the Invoice Verification) — returning a
   `{prLineItemId, description, orderedQty, orderedPrice, grnQty,
   invoicedQty, invoicedPrice, qtyStatus, priceStatus}` row per line, an
   overall status, and a plain-language reason if no GRN exists yet.
   Storing this instead would risk showing a stale comparison after any
   upstream record changes — a real risk here specifically, since a
   Draft invoice or an unposted GRN can still be edited after this
   record exists.

   STATUS LIFECYCLE: THE FIRST REAL DECISION GATE SINCE VENDOR
   CONFIRMATION. `Draft -> Approved for Payment / On Hold, +Cancelled`
   — unlike every operational record between here and Module 11, this
   one asks a real judgment question with real consequences (whether
   Payment Request, Module 18, gets built from it), so it earns an actual
   decision pair rather than the single "formalize" transition Delivery
   Schedule/Goods Receipt/GRN/Quality Inspection/Invoice Verification
   all used. `On Hold` can move back to `Draft` via `reopen()` once
   whatever caused the discrepancy is fixed upstream (a corrected
   invoice, a completed GRN) — the same "send it back for revision"
   shape PO Approval's own Reject uses, just without a separate approval
   page, since (like Payment Request will be) there's no dedicated
   "Three-Way Matching Approval" module in the roadmap.
   ========================================================================== */

const ERP_THREE_WAY_MATCHING_KEY = "erp_three_way_matches";

const ERP_THREE_WAY_MATCHING_STATUSES = ["Draft", "Approved for Payment", "On Hold", "Cancelled"];

const ERP_ThreeWayMatchingRepository = {
  statuses: ERP_THREE_WAY_MATCHING_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_THREE_WAY_MATCHING_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_THREE_WAY_MATCHING_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((m) => m.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((m) => m.id === id) || null;
  },

  nextMatchCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((m) => {
      const match = /-3WM-(\d+)$/.exec(m.matchCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-3WM-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(m) {
    return m.status === "Draft";
  },

  canDelete(m) {
    return m.status === "Draft" || m.status === "Cancelled";
  },

  /** Walks invoice -> PO -> schedule -> receipt -> GRN. Returns whichever
      records exist; callers must handle a null `grn` gracefully (a
      genuinely common, valid state — the receiving side may simply not
      have caught up yet). */
  resolveChain(invoiceVerification) {
    const po = invoiceVerification && typeof ERP_PurchaseOrderRepository !== "undefined"
      ? ERP_PurchaseOrderRepository.findById(invoiceVerification.linkedPoId) : null;
    let schedule = null, receipt = null, grn = null;
    if (po && typeof ERP_DeliveryScheduleRepository !== "undefined") {
      schedule = ERP_DeliveryScheduleRepository.getAllForCompany(po.companyId)
        .find((s) => s.status !== "Cancelled" && s.linkedPoId === po.id) || null;
    }
    if (schedule && typeof ERP_GoodsReceiptRepository !== "undefined") {
      receipt = ERP_GoodsReceiptRepository.getAllForCompany(schedule.companyId)
        .find((r) => r.status !== "Cancelled" && r.linkedScheduleId === schedule.id) || null;
    }
    if (receipt && typeof ERP_GrnRepository !== "undefined") {
      grn = ERP_GrnRepository.getAllForCompany(receipt.companyId)
        .find((g) => g.status !== "Cancelled" && g.linkedReceiptId === receipt.id) || null;
    }
    return { po, schedule, receipt, grn };
  },

  /** The pure, unstored comparison — see file header. Never persisted;
      always recomputed from current PO/GRN/Invoice data. */
  computeMatchLines(company, record) {
    const invoiceVerification = typeof ERP_InvoiceVerificationRepository !== "undefined"
      ? ERP_InvoiceVerificationRepository.findById(record.linkedInvoiceVerificationId) : null;
    const { po, grn } = this.resolveChain(invoiceVerification);
    if (!po) return { lines: [], po: null, grn: null, invoiceVerification, overallStatus: "PO Not Available" };

    const grnLineById = {};
    (grn ? grn.grnLines || [] : []).forEach((l) => { grnLineById[l.prLineItemId] = l; });
    const invoiceLineById = {};
    (invoiceVerification ? invoiceVerification.invoiceLines || [] : []).forEach((l) => { invoiceLineById[l.prLineItemId] = l; });

    const lines = (po.lineItems || []).map((poLine) => {
      const grnLine = grnLineById[poLine.prLineItemId];
      const invoiceLine = invoiceLineById[poLine.prLineItemId];
      const grnQty = grnLine ? grnLine.quantity : null;
      const invoicedQty = invoiceLine ? invoiceLine.invoicedQuantity : null;
      const invoicedPrice = invoiceLine ? invoiceLine.invoicedUnitPrice : null;

      const qtyStatus = !grn ? "No GRN"
        : (grnQty === Number(poLine.quantity) && invoicedQty === grnQty ? "Matched" : "Mismatch");
      const priceStatus = (poLine.unitPrice != null && invoicedPrice != null && Number(poLine.unitPrice) === Number(invoicedPrice))
        ? "Matched" : "Mismatch";

      return {
        prLineItemId: poLine.prLineItemId,
        orderedQty: poLine.quantity,
        orderedPrice: poLine.unitPrice,
        grnQty, invoicedQty, invoicedPrice,
        qtyStatus, priceStatus
      };
    });

    let overallStatus;
    if (!grn) overallStatus = "GRN Not Available";
    else if (lines.some((l) => l.qtyStatus === "Mismatch" || l.priceStatus === "Mismatch")) overallStatus = "Discrepancies Found";
    else overallStatus = "Fully Matched";

    return { lines, po, grn, invoiceVerification, overallStatus };
  },

  getLinkedInvoiceVerificationIds(companyId, excludeMatchId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((m) => {
      if (m.id === excludeMatchId || m.status === "Cancelled") return;
      if (m.linkedInvoiceVerificationId) ids.add(m.linkedInvoiceVerificationId);
    });
    return ids;
  },

  getAvailableVerifiedInvoicesForCompany(companyId, excludeMatchId) {
    if (typeof ERP_InvoiceVerificationRepository === "undefined") return [];
    const claimed = this.getLinkedInvoiceVerificationIds(companyId, excludeMatchId);
    return ERP_InvoiceVerificationRepository.getAllForCompany(companyId)
      .filter((v) => v.status === "Verified" && !claimed.has(v.id));
  },

  /** The retrofit hook for Invoice Verification's own Detail modal. */
  findMatchForInvoice(companyId, invoiceVerificationId) {
    return this.getAllForCompany(companyId).find((m) =>
      m.status !== "Cancelled" && m.linkedInvoiceVerificationId === invoiceVerificationId
    ) || null;
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "3WM-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      matchCode: this.nextMatchCode(company),
      linkedInvoiceVerificationId: null,
      decisionNotes: "",
      status: "Draft",
      approvedAt: null, approvedByUsername: null,
      onHoldAt: null, onHoldByUsername: null, holdReason: "",
      cancelledAt: null, cancelledByUsername: null,
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
    const idx = all.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Approved for Payment. The real decision this module
      exists to make. */
  approveForPayment(id, actorUsername) {
    return this.update(id, { status: "Approved for Payment", approvedAt: new Date().toISOString(), approvedByUsername: actorUsername });
  },

  /** Draft -> On Hold. Same shape as PR/PO's own reject() — requires a
      reason, since it's the thing whoever fixes the discrepancy has to
      go on. */
  putOnHold(id, actorUsername, reason) {
    return this.update(id, { status: "On Hold", onHoldAt: new Date().toISOString(), onHoldByUsername: actorUsername, holdReason: reason || "" });
  },

  /** On Hold -> Draft, to re-review once the discrepancy is fixed
      upstream. */
  reopen(id) {
    return this.update(id, { status: "Draft", onHoldAt: null, onHoldByUsername: null, holdReason: "" });
  },

  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  remove(id) {
    const m = this.findById(id);
    if (!m || !this.canDelete(m)) return false;
    const all = this.getAll().filter((rec) => rec.id !== id);
    this._saveAll(all);
    return true;
  }
};
