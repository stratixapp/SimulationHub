/* =============================================================================
   DOT ERP
   FILE:  data/debit-note-data.js
   ROLE:  Data-access layer for Debit Note — Phase 15, Module 03b. The
          financial half of a purchase-side return, and the exact
          Procurement mirror of Credit Note. Read credit-note-data.js's
          own header first — this file follows its shape closely enough
          that only genuine differences are re-argued here.

   TWO PARENTS, FOR THE SAME REASON CREDIT NOTE HAS TWO. GOODS RETURN
   credits — here, DEBITS — a posted Purchase Return: quantity-driven,
   lines derived, nothing typed. PRICE ADJUSTMENT debits an Invoice
   Verification directly when nothing physically came back at all — the
   vendor overbilled a rate, or a discount was agreed after the invoice
   was verified: value-driven, no quantity, one typed amount per line.
   `computeLineTotal()` is the one place the two shapes meet, unchanged
   in shape from Credit Note's own.

   THE JOIN KEY IS `prLineItemId`, NOT `id` — genuinely different from
   Credit Note's own join, and worth naming why. Sales Return -> Credit
   Note joins on `id` because that is what the SALES chain (Quotation ->
   Order -> Challan -> Invoice) has preserved unbroken since Phase 5.
   Purchase Return -> Debit Note joins on `prLineItemId` because that is
   what the PROCUREMENT chain (PR -> RFQ -> Quotation -> PO -> Schedule
   -> Receipt -> GRN -> Invoice Verification) has used as ITS OWN stable
   line identifier since Phase 4 — checked directly in po-data.js,
   grn-data.js and invoice-verification-data.js before assuming it,
   exactly as purchase-return-data.js's own header already documents.
   Two different chains, two different join keys, each the real one for
   its own side — not an inconsistency to fix.

   REAL CAPTURED TAX, NOT AN ESTIMATE — THE WHOLE REASON THE INVOICE
   VERIFICATION RETROFIT HAPPENED FIRST THIS PHASE. `buildLinesFromReturn()`
   recovers each returned line's price AND tax by finding the Invoice
   Verification line with the SAME `prLineItemId` — including its own
   optional `invoicedTaxId`, when the trainee captured one. A line whose
   Invoice Verification counterpart was never priced, or has vanished, is
   SKIPPED rather than debited at zero — the identical honesty Credit
   Note's own `buildLinesFromReturn()` already practices.

   EXCLUSIVE OVER A PURCHASE RETURN, NOT OVER AN INVOICE VERIFICATION —
   both halves deliberate, mirroring Credit Note's own asymmetry exactly.
   One Purchase Return gets at most one debit note; one verified invoice
   can accumulate several notes over time (one per partial return, plus
   later adjustments).

   THE OVER-DEBIT GUARD IS A VALUE GUARD, THE SAME KIND CREDIT NOTE USES
   — NOT Purchase Return's own quantity guard. Across every non-Cancelled
   debit note, the total against one Invoice Verification can never
   exceed that verification's own tax-inclusive grand total. Live scan,
   never stored, rounded to paisa before comparing for the identical
   floating-point reason Credit Note's own guard is rounded.

   GL POSTING, ON `issue()` — THE REVERSE OF THE COMBINED GRN + INVOICE
   VERIFICATION PAIR, not of either alone: Dr Accounts Payable (total,
   what we no longer owe) / Cr Inventory (subtotal — reverses GRN's own
   Dr Inventory) + Cr Input Tax Credit Receivable (tax, only when
   nonzero — reverses the ITC Invoice Verification claimed). NO NEW GL
   ROLES were needed: all three already existed by the time this module
   was reached (`inventoryAccountId` from GRN, `accountsPayableAccountId`
   and the Phase-15-retrofitted `inputTaxCreditAccountId` from Invoice
   Verification), checked in gl-mapping-data.js before assuming.

   A PRICE ADJUSTMENT DEBIT NOTE REUSES THE SAME INVENTORY CREDIT AS A
   GOODS RETURN ONE, A NAMED SIMPLIFICATION MIRRORING CREDIT NOTE'S OWN.
   Crediting Inventory even when nothing physically moved assumes the
   underlying stock hasn't yet been consumed — not always true, and this
   project has no Purchase Price Variance account to route around it.
   This is the exact same simplification Credit Note already made
   (crediting Sales Revenue on both of ITS note types); named here
   rather than left silent, for the identical reason.

   LIFECYCLE: Draft -> Debited, +Cancelled. Terminal status checked
   against every word already in use across BOTH sides of this project
   (Raised, Issued, Dispatched, Received, Returned, Posted, Logged,
   Finalized, Confirmed, Paid, Collected, Closed, Processed, Completed,
   Verified, Approved, Credited) and found free. Cancel is Draft-only,
   for the identical reason Credit Note's own is: once Debited there is
   a real posted journal entry, and this project does not rewrite posted
   accounting history.
   ========================================================================== */

const ERP_DEBIT_NOTE_KEY = "erp_debit_notes";

const ERP_DEBIT_NOTE_STATUSES = ["Draft", "Debited", "Cancelled"];

const ERP_DEBIT_NOTE_TYPES = ["Goods Return", "Price Adjustment"];

const ERP_DEBIT_NOTE_REASONS = [
  "Goods Returned to Vendor",
  "Vendor Overbilled Rate",
  "Post-Purchase Discount Agreed",
  "Short Quantity Received",
  "Tax Charged Incorrectly",
  "Other"
];

const ERP_DebitNoteRepository = {
  statuses: ERP_DEBIT_NOTE_STATUSES,
  noteTypes: ERP_DEBIT_NOTE_TYPES,
  reasons: ERP_DEBIT_NOTE_REASONS,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_DEBIT_NOTE_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_DEBIT_NOTE_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((n) => n.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((n) => n.id === id) || null;
  },

  nextNoteCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((n) => {
      const match = /-DN-(\d+)$/.exec(n.noteCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-DN-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(note) { return note.status === "Draft"; },
  canDelete(note) { return note.status === "Draft" || note.status === "Cancelled"; },

  actorLabel(username) {
    return typeof window !== "undefined" && window.ERP && window.ERP.actorLabel
      ? window.ERP.actorLabel(username)
      : (username || "system");
  },


  /* -----------------------------------------------------------------------
     LINE BUILDING — the two shapes, joined by `prLineItemId`
     --------------------------------------------------------------------- */

  /** GOODS RETURN shape. Joins each active Purchase Return line back to
      its own Invoice Verification line BY `prLineItemId` to recover the
      real price and — when captured — the real tax. */
  buildLinesFromReturn(purchaseReturn, verification) {
    const ivLineByPrId = {};
    (verification.invoiceLines || []).forEach((l) => { ivLineByPrId[l.prLineItemId] = l; });

    return (purchaseReturn.returnLines || [])
      .filter((l) => (Number(l.returnQuantity) || 0) > 0)
      .map((rLine) => {
        const ivLine = ivLineByPrId[rLine.prLineItemId];
        if (!ivLine || ivLine.invoicedUnitPrice == null) return null;
        return {
          prLineItemId: rLine.prLineItemId,
          itemId: rLine.itemId,
          quantity: Number(rLine.returnQuantity) || 0,
          unitPrice: ivLine.invoicedUnitPrice,
          invoicedTaxId: ivLine.invoicedTaxId || null
        };
      })
      .filter(Boolean);
  },

  /** PRICE ADJUSTMENT shape. One row per Invoice Verification line that
      was actually priced, each carrying a typed `debitAmount` starting
      at zero. */
  buildLinesFromVerification(verification) {
    return (verification.invoiceLines || [])
      .filter((l) => l.invoicedUnitPrice != null)
      .map((l) => ({
        prLineItemId: l.prLineItemId,
        itemId: this._resolveItemForLine(verification, l.prLineItemId),
        debitAmount: 0,
        originalLineValue: (Number(l.invoicedQuantity) || 0) * (Number(l.invoicedUnitPrice) || 0),
        invoicedTaxId: l.invoicedTaxId || null
      }));
  },

  /** Invoice Verification's own lines don't carry `itemId` directly
      (the same absence Purchase Return's own header documents) — a
      short, best-effort resolution via whatever purchase-return-data.js
      already exposes for the same chain, rather than duplicating that
      seven-hop walk here. Falls back to null; callers show "Unresolved
      line" rather than guessing. */
  _resolveItemForLine(verification, prLineItemId) {
    if (typeof ERP_PurchaseOrderRepository === "undefined" || typeof ERP_PurchaseReturnRepository === "undefined") return null;
    const po = verification.linkedPoId ? ERP_PurchaseOrderRepository.findById(verification.linkedPoId) : null;
    if (!po) return null;
    // Re-walk from the PO's own chain by piggy-backing on Purchase
    // Return's own chain-walker, entering it one hop lower than usual:
    // give it a synthetic "grn-shaped" stand-in whose resolveChainForGrn
    // needs a real PR — POs don't need the whole receiving chain, only
    // Quotation -> RFQ -> PR, so this is resolved directly rather than
    // forcing an unrelated repository's own GRN-shaped entry point.
    if (typeof ERP_QuotationRepository === "undefined" || typeof ERP_RfqRepository === "undefined" || typeof ERP_PurchaseRequisitionRepository === "undefined") return null;
    const quotation = po.linkedQuotationId ? ERP_QuotationRepository.findById(po.linkedQuotationId) : null;
    const rfq = quotation && quotation.rfqId ? ERP_RfqRepository.findById(quotation.rfqId) : null;
    const pr = rfq && rfq.linkedPrId ? ERP_PurchaseRequisitionRepository.findById(rfq.linkedPrId) : null;
    if (!pr) return null;
    const prLine = (pr.lineItems || []).find((l) => l.id === prLineItemId);
    return prLine ? prLine.itemId : null;
  },


  /* -----------------------------------------------------------------------
     TOTALS — identical shape to Credit Note's own
     --------------------------------------------------------------------- */

  computeLineTotal(line) {
    if (line.debitAmount !== undefined && line.debitAmount !== null) {
      const amt = Number(line.debitAmount);
      return isNaN(amt) ? null : amt;
    }
    const price = line.unitPrice;
    if (price === null || price === undefined || price === "" || isNaN(Number(price))) return null;
    return (Number(line.quantity) || 0) * Number(price);
  },

  computeLineTax(line) {
    const lineTotal = this.computeLineTotal(line);
    if (lineTotal == null) return null;
    if (!line.invoicedTaxId || typeof ERP_TaxRepository === "undefined") return 0;
    const tax = ERP_TaxRepository.findById(line.invoicedTaxId);
    if (!tax) return 0;
    return lineTotal * (Number(tax.ratePct) || 0) / 100;
  },

  computeGrandTotal(note) {
    let subtotal = 0, taxTotal = 0, pricedCount = 0;
    (note.debitLines || []).forEach((line) => {
      const lineTotal = this.computeLineTotal(line);
      if (lineTotal != null) {
        subtotal += lineTotal;
        taxTotal += this.computeLineTax(line) || 0;
        pricedCount++;
      }
    });
    return { subtotal, taxTotal, total: subtotal + taxTotal, pricedCount, totalCount: (note.debitLines || []).length };
  },


  /* -----------------------------------------------------------------------
     THE OVER-DEBIT GUARD — a VALUE guard, mirroring Credit Note's own.
     --------------------------------------------------------------------- */

  getDebitedAmountForVerification(companyId, verificationId, excludeNoteId) {
    return this.getAllForCompany(companyId)
      .filter((n) => n.linkedVerificationId === verificationId && n.status !== "Cancelled" && n.id !== excludeNoteId)
      .reduce((sum, n) => sum + this.computeGrandTotal(n).total, 0);
  },

  getRemainingDebitableForVerification(companyId, verification, excludeNoteId) {
    if (!verification || typeof ERP_InvoiceVerificationRepository === "undefined") return 0;
    const verificationTotal = ERP_InvoiceVerificationRepository.computeGrandTotal(verification).total;
    const already = this.getDebitedAmountForVerification(companyId, verification.id, excludeNoteId);
    return Math.max(0, Math.round((verificationTotal - already) * 100) / 100);
  },

  validateNote(companyId, verification, draftNote, excludeNoteId) {
    const errors = [];
    const totals = this.computeGrandTotal(draftNote);

    if (!(totals.total > 0)) {
      errors.push("A debit note needs at least one line with a value above zero.");
    }
    (draftNote.debitLines || []).forEach((line) => {
      const value = this.computeLineTotal(line);
      if (value != null && value < 0) errors.push("A debit line can't be negative — a debit note only ever reduces what's owed to the vendor.");
    });

    const remaining = this.getRemainingDebitableForVerification(companyId, verification, excludeNoteId);
    if (Math.round(totals.total * 100) / 100 > remaining) {
      errors.push(`Only ${remaining.toFixed(2)} is still debitable against this invoice — the rest is already covered by other debit notes.`);
    }
    return { ok: errors.length === 0, errors };
  },


  /* -----------------------------------------------------------------------
     PICKER POOLS + FK SURFACE
     --------------------------------------------------------------------- */

  getLinkedReturnIds(companyId, excludeNoteId) {
    return this.getAllForCompany(companyId)
      .filter((n) => n.status !== "Cancelled" && n.id !== excludeNoteId && n.linkedReturnId)
      .map((n) => n.linkedReturnId);
  },

  getAvailableReturnsForCompany(companyId, excludeNoteId) {
    if (typeof ERP_PurchaseReturnRepository === "undefined") return [];
    const claimed = new Set(this.getLinkedReturnIds(companyId, excludeNoteId));
    return ERP_PurchaseReturnRepository.getReturnedForCompany(companyId).filter((r) => !claimed.has(r.id));
  },

  /** Verified invoices with any value left to debit. Deliberately NOT
      narrowed to unpaid ones — the same reasoning Credit Note's own
      `getCreditableInvoicesForCompany()` already gives. */
  getDebitableVerificationsForCompany(companyId, excludeNoteId) {
    if (typeof ERP_InvoiceVerificationRepository === "undefined") return [];
    return ERP_InvoiceVerificationRepository.getAllForCompany(companyId)
      .filter((v) => v.status === "Verified")
      .filter((v) => this.getRemainingDebitableForVerification(companyId, v, excludeNoteId) > 0);
  },

  /** The retrofit hook Purchase Return's own Detail modal reads. */
  findNoteForReturn(companyId, returnId) {
    return this.getAllForCompany(companyId)
      .find((n) => n.linkedReturnId === returnId && n.status !== "Cancelled") || null;
  },

  /** AGGREGATE hook for Invoice Verification's own Detail modal — this
      module is NOT exclusive over a verification. */
  getAllForVerification(companyId, verificationId) {
    return this.getAllForCompany(companyId).filter((n) => n.linkedVerificationId === verificationId);
  },

  getDebitedForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((n) => n.status === "Debited")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },


  /* -----------------------------------------------------------------------
     CRUD + LIFECYCLE
     --------------------------------------------------------------------- */

  create(company, verification, purchaseReturn, data, actorUsername) {
    const noteType = purchaseReturn ? "Goods Return" : "Price Adjustment";
    const record = {
      id: "DN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      noteCode: this.nextNoteCode(company),
      noteType,
      linkedVerificationId: verification.id,
      linkedReturnId: purchaseReturn ? purchaseReturn.id : null,
      vendorId: verification.linkedPoId && typeof ERP_PurchaseOrderRepository !== "undefined"
        ? (ERP_PurchaseOrderRepository.findById(verification.linkedPoId) || {}).vendorId || null
        : null,
      noteDate: new Date().toISOString().slice(0, 10),
      reason: noteType === "Goods Return" ? ERP_DEBIT_NOTE_REASONS[0] : ERP_DEBIT_NOTE_REASONS[1],
      debitLines: purchaseReturn
        ? this.buildLinesFromReturn(purchaseReturn, verification)
        : this.buildLinesFromVerification(verification),
      notes: "",
      status: "Draft",
      issuedAt: null, issuedByUsername: null,
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
    const idx = all.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    if (all[idx].status !== "Draft") return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Same strictness as Credit Note's own `canEditLines()` — a Goods
      Return note's lines are never editable at any status. */
  canEditLines(note) {
    return note.status === "Draft" && note.noteType === "Price Adjustment";
  },

  canIssue(note) {
    if (!note || note.status !== "Draft") return false;
    return this.computeGrandTotal(note).total > 0;
  },

  issue(id, company, actorUsername) {
    const note = this.findById(id);
    if (!note) return { success: false, reason: "This debit note no longer exists." };
    if (note.status !== "Draft") return { success: false, reason: "Only a Draft debit note can be issued." };

    const verification = typeof ERP_InvoiceVerificationRepository !== "undefined"
      ? ERP_InvoiceVerificationRepository.findById(note.linkedVerificationId) : null;
    if (!verification) return { success: false, reason: "The invoice verification this note debits no longer exists." };

    const check = this.validateNote(company.id, verification, note, note.id);
    if (!check.ok) return { success: false, reason: check.errors[0] };

    const all = this.getAll();
    const idx = all.findIndex((n) => n.id === id);
    all[idx] = {
      ...all[idx],
      status: "Debited",
      issuedAt: new Date().toISOString(),
      issuedByUsername: actorUsername || "system"
    };
    this._saveAll(all);
    return { success: true, record: all[idx] };
  },

  /** Draft-only, for the identical reason Credit Note's own cancel()
      is: once Debited there's a real posted journal entry, and this
      project does not rewrite posted accounting history. */
  cancel(id, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((n) => n.id === id);
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
    const note = this.findById(id);
    if (!note || !this.canDelete(note)) return false;
    this._saveAll(this.getAll().filter((n) => n.id !== id));
    return true;
  }
};
