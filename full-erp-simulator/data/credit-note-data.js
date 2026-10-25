/* =============================================================================
   DOT ERP
   FILE:  data/credit-note-data.js
   ROLE:  Data-access layer for Credit Note — Phase 15, Module 02. The
          financial half of a return, and the module that finally lets
          this system reduce what a customer owes. Read
          sales-return-data.js's own header first — this file assumes it.

   TWO PARENTS, AND THAT IS GENUINELY UNUSUAL FOR THIS CODEBASE, SO IT
   IS JUSTIFIED HERE RATHER THAN ASSUMED. Every other document in this
   project is built from exactly one upstream record. A credit note
   isn't, because in real business there are two entirely different
   reasons to raise one, and collapsing them would model one of them
   wrongly:

     - GOODS RETURN — a Sales Return came back, and the customer is
       credited for what they sent. Quantity-driven: the lines are
       derived, the price is frozen, nothing is typed.
     - PRICE ADJUSTMENT — nothing physically came back at all. A rate
       was wrong, a discount was agreed late, an item was billed at the
       wrong grade. Value-driven: there is no quantity to speak of, only
       an amount being credited per line.

   Forcing the second through a quantity × price shape would mean either
   inventing a fake quantity or inventing a fake rate. Both lie in the
   books. So `noteType` selects between two line shapes, and every
   function that touches lines handles both. This is checked at
   `computeLineTotal()`, the single place the two shapes actually meet:
   a line with its own `creditAmount` IS the amount; any other line is
   quantity × unitPrice. One branch, in one function, rather than two
   parallel repositories.

   Both types are real, both are standard in every ERP that handles GST
   (Tally, Zoho Books and SAP all offer exactly this pair), and a GST
   credit note is legally REQUIRED for either — which is the whole
   reason this phase exists.

   EXCLUSIVE OVER A SALES RETURN, NOT OVER AN INVOICE — and both halves
   of that are deliberate. One Sales Return gets at most one credit note
   (`getLinkedReturnIds`/`getAvailableReturnsForCompany`, the same
   live-scan exclusivity shape used everywhere since Delivery Schedule),
   because crediting the same returned goods twice is simply wrong. But
   an invoice can accumulate several credit notes over time — one per
   partial return, plus any number of later price adjustments — so
   `linkedInvoiceId` stays a plain foreign key, the same call Sales
   Return itself made one module ago.

   WHAT REPLACES INVOICE-LEVEL EXCLUSIVITY IS AN OVER-CREDIT GUARD, AND
   IT IS A DIFFERENT KIND OF GUARD FROM SALES RETURN'S OWN. Sales
   Return guards a QUANTITY per line; this guards a VALUE across the
   whole invoice: the sum of every non-Cancelled credit note's grand
   total against one invoice can never exceed that invoice's own grand
   total. Crediting a customer more than you ever billed them is not a
   correction, it's a payment, and a payment is a different document.
   Live scan, never a stored running total — so cancelling a note frees
   its value back up with nothing to reconcile, exactly as cancelling a
   Sales Return frees its quantity.

   THE LINE-ID JOIN sales-return-data.js's own header promised: a Goods
   Return note resolves each return line's price by finding the invoice
   line with the SAME id. That works because every module in this chain
   has preserved each line's own id unbroken since Sales Quotation —
   the same property `tax-invoice-data.js`'s `buildInvoiceLines()`
   relies on in the forward direction. This is the reason Sales Return
   was built quantity-only; the promise is now kept.

   LIFECYCLE: Draft -> Credited, +Cancelled. Terminal status is
   `Credited` — checked against every terminal word already in use
   (Raised, Issued, Dispatched, Received, Returned, Posted, Logged,
   Finalized, Confirmed, Paid, Collected, Closed, Processed, Completed,
   Verified, Approved) and found free. `Issued` would have collided with
   Delivery Challan and `Raised` with Tax Invoice, the two collisions
   most likely to appear beside this document in a status history.

   GL POSTING, ON `issue()`: Dr Sales Revenue (subtotal) + Dr Output Tax
   Payable (tax, only when nonzero) / Cr Accounts Receivable (total) —
   the exact reverse of `postTaxInvoice()`, including its own
   conditional third line. NO NEW GL MAPPING ROLES WERE ADDED: all three
   already existed and already mean the right thing, checked in
   gl-mapping-data.js before assuming. Deliberately NOT booked to a
   separate "Sales Returns" contra-revenue account — that would need a
   19th role whose only purpose is presentation, and this project's
   Profit & Loss has no contra-revenue section to show it in anyway.
   Named here rather than left implicit.
   ========================================================================== */

const ERP_CREDIT_NOTE_KEY = "erp_credit_notes";

const ERP_CREDIT_NOTE_STATUSES = ["Draft", "Credited", "Cancelled"];

/** The two real reasons a credit note exists — see file header. Fixed
    vocabulary, looped into a <select>, the `.xTypes` discipline. */
const ERP_CREDIT_NOTE_TYPES = ["Goods Return", "Price Adjustment"];

/** Why the credit is being given. Kept separate from `noteType`, which
    is a structural choice about the document's own shape. */
const ERP_CREDIT_NOTE_REASONS = [
  "Goods Returned by Customer",
  "Rate Charged Incorrectly",
  "Post-Sale Discount Agreed",
  "Deficiency in Service",
  "Tax Charged Incorrectly",
  "Other"
];

const ERP_CreditNoteRepository = {
  statuses: ERP_CREDIT_NOTE_STATUSES,
  noteTypes: ERP_CREDIT_NOTE_TYPES,
  reasons: ERP_CREDIT_NOTE_REASONS,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_CREDIT_NOTE_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_CREDIT_NOTE_KEY, JSON.stringify(list)); return true; }
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

  /** COMP-001-CN-01, COMP-001-CN-02, ... */
  nextNoteCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((n) => {
      const match = /-CN-(\d+)$/.exec(n.noteCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-CN-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(note) { return note.status === "Draft"; },
  canDelete(note) { return note.status === "Draft" || note.status === "Cancelled"; },

  actorLabel(username) {
    return typeof window !== "undefined" && window.ERP && window.ERP.actorLabel
      ? window.ERP.actorLabel(username)
      : (username || "system");
  },


  /* -----------------------------------------------------------------------
     LINE BUILDING — the two shapes, and the line-id join
     --------------------------------------------------------------------- */

  /** GOODS RETURN shape. Joins each ACTIVE return line (one with a real
      returned quantity) back to its own invoice line BY ID to recover
      the price and tax the customer was originally billed. A return
      line whose invoice counterpart has vanished is skipped rather than
      credited at zero — silently crediting nothing would look like a
      priced line worth ₹0. */
  buildLinesFromReturn(salesReturn, invoice) {
    const invLineById = {};
    (invoice.invoiceLines || []).forEach((l) => { invLineById[l.id] = l; });

    return (salesReturn.returnLines || [])
      .filter((l) => (Number(l.returnQuantity) || 0) > 0)
      .map((rLine) => {
        const invLine = invLineById[rLine.id];
        if (!invLine) return null;
        return {
          id: rLine.id,
          itemId: rLine.itemId,
          lineDescription: rLine.lineDescription,
          quantity: Number(rLine.returnQuantity) || 0,
          unitPrice: invLine.unitPrice != null ? invLine.unitPrice : null,
          taxId: invLine.taxId || null,
          hsnCodeId: invLine.hsnCodeId || null
        };
      })
      .filter(Boolean);
  },

  /** PRICE ADJUSTMENT shape. One row per invoice line, each carrying a
      typed `creditAmount` starting at zero — there is no quantity here
      at all, by design (see file header). `originalLineValue` is a
      frozen reference figure so the form can show what was billed
      beside what's being credited. */
  buildLinesFromInvoice(invoice) {
    return (invoice.invoiceLines || []).map((l) => ({
      id: l.id,
      itemId: l.itemId,
      lineDescription: l.lineDescription,
      creditAmount: 0,
      originalLineValue: (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
      taxId: l.taxId || null,
      hsnCodeId: l.hsnCodeId || null
    }));
  },


  /* -----------------------------------------------------------------------
     TOTALS — the ONE place the two line shapes meet
     --------------------------------------------------------------------- */

  computeLineTotal(line) {
    if (line.creditAmount !== undefined && line.creditAmount !== null) {
      const amt = Number(line.creditAmount);
      return isNaN(amt) ? null : amt;
    }
    const price = line.unitPrice;
    if (price === null || price === undefined || price === "" || isNaN(Number(price))) return null;
    return (Number(line.quantity) || 0) * Number(price);
  },

  computeLineTax(line) {
    const lineTotal = this.computeLineTotal(line);
    if (lineTotal == null) return null;
    if (!line.taxId || typeof ERP_TaxRepository === "undefined") return 0;
    const tax = ERP_TaxRepository.findById(line.taxId);
    if (!tax) return 0;
    return lineTotal * (Number(tax.ratePct) || 0) / 100;
  },

  /** Same partial-aware `{subtotal, taxTotal, total, pricedCount,
      totalCount}` shape every priced document in this codebase returns —
      Tax Invoice's own, unchanged, so the two can be compared directly. */
  computeGrandTotal(note) {
    let subtotal = 0, taxTotal = 0, pricedCount = 0;
    (note.creditLines || []).forEach((line) => {
      const lineTotal = this.computeLineTotal(line);
      if (lineTotal != null) {
        subtotal += lineTotal;
        taxTotal += this.computeLineTax(line) || 0;
        pricedCount++;
      }
    });
    return { subtotal, taxTotal, total: subtotal + taxTotal, pricedCount, totalCount: (note.creditLines || []).length };
  },


  /* -----------------------------------------------------------------------
     THE OVER-CREDIT GUARD — a VALUE guard, unlike Sales Return's own
     QUANTITY guard. Live scan, never stored.
     --------------------------------------------------------------------- */

  getCreditedAmountForInvoice(companyId, invoiceId, excludeNoteId) {
    return this.getAllForCompany(companyId)
      .filter((n) => n.linkedInvoiceId === invoiceId && n.status !== "Cancelled" && n.id !== excludeNoteId)
      .reduce((sum, n) => sum + this.computeGrandTotal(n).total, 0);
  },

  getRemainingCreditableForInvoice(companyId, invoice, excludeNoteId) {
    if (!invoice || typeof ERP_TaxInvoiceRepository === "undefined") return 0;
    const invoiceTotal = ERP_TaxInvoiceRepository.computeGrandTotal(invoice).total;
    const already = this.getCreditedAmountForInvoice(companyId, invoice.id, excludeNoteId);
    // Rounded to paisa before comparing — floating-point tax math can
    // leave a remainder of ~1e-12 that would otherwise read as "still
    // creditable" forever.
    return Math.max(0, Math.round((invoiceTotal - already) * 100) / 100);
  },

  /** Returns {ok, errors:[string]}. Called by the page AND enforced in
      issue(), so the form can never accept something the repository
      would later refuse. */
  validateNote(companyId, invoice, draftNote, excludeNoteId) {
    const errors = [];
    const totals = this.computeGrandTotal(draftNote);

    if (!(totals.total > 0)) {
      errors.push("A credit note needs at least one line with a value above zero.");
    }
    (draftNote.creditLines || []).forEach((line) => {
      const value = this.computeLineTotal(line);
      if (value != null && value < 0) errors.push("A credit line can't be negative — a credit note only ever reduces what's owed.");
    });

    const remaining = this.getRemainingCreditableForInvoice(companyId, invoice, excludeNoteId);
    if (Math.round(totals.total * 100) / 100 > remaining) {
      errors.push(`Only ${remaining.toFixed(2)} is still creditable against this invoice — the rest is already covered by other credit notes.`);
    }
    return { ok: errors.length === 0, errors };
  },


  /* -----------------------------------------------------------------------
     PICKER POOLS + FK SURFACE
     --------------------------------------------------------------------- */

  /** Exclusivity over Sales Return — same live-scan shape used
      everywhere since Delivery Schedule. */
  getLinkedReturnIds(companyId, excludeNoteId) {
    return this.getAllForCompany(companyId)
      .filter((n) => n.status !== "Cancelled" && n.id !== excludeNoteId && n.linkedReturnId)
      .map((n) => n.linkedReturnId);
  },

  /** Posted Sales Returns not already claimed by a credit note. */
  getAvailableReturnsForCompany(companyId, excludeNoteId) {
    if (typeof ERP_SalesReturnRepository === "undefined") return [];
    const claimed = new Set(this.getLinkedReturnIds(companyId, excludeNoteId));
    return ERP_SalesReturnRepository.getReturnedForCompany(companyId).filter((r) => !claimed.has(r.id));
  },

  /** Raised invoices with any value left to credit — the Price
      Adjustment pool. Deliberately NOT narrowed to unpaid invoices: a
      paid invoice can still be credited, and what that produces is a
      real refund obligation, which is exactly what a real business
      ends up with. */
  getCreditableInvoicesForCompany(companyId, excludeNoteId) {
    if (typeof ERP_TaxInvoiceRepository === "undefined") return [];
    return ERP_TaxInvoiceRepository.getRaisedForCompany(companyId)
      .filter((inv) => this.getRemainingCreditableForInvoice(companyId, inv, excludeNoteId) > 0);
  },

  /** The retrofit hook Sales Return's own Detail modal reads — a
      genuine single link, since this module IS exclusive over a return. */
  findNoteForReturn(companyId, returnId) {
    return this.getAllForCompany(companyId)
      .find((n) => n.linkedReturnId === returnId && n.status !== "Cancelled") || null;
  },

  /** AGGREGATE hook for Tax Invoice's own Detail modal and for AR
      Aging — this module is NOT exclusive over an invoice. */
  getAllForInvoice(companyId, invoiceId) {
    return this.getAllForCompany(companyId).filter((n) => n.linkedInvoiceId === invoiceId);
  },

  /** What AR Aging subtracts from an invoice's outstanding balance —
      only genuinely issued notes count, never drafts. */
  getIssuedCreditForInvoice(companyId, invoiceId) {
    return this.getAllForInvoice(companyId, invoiceId)
      .filter((n) => n.status === "Credited")
      .reduce((sum, n) => sum + this.computeGrandTotal(n).total, 0);
  },

  getCreditedForCompany(companyId) {
    return this.getAllForCompany(companyId)
      .filter((n) => n.status === "Credited")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },


  /* -----------------------------------------------------------------------
     CRUD + LIFECYCLE
     --------------------------------------------------------------------- */

  /** Takes the full parent record(s) — `salesReturn` is null for a
      Price Adjustment. Same parent-record signature shape Sales Order /
      Delivery Challan / Tax Invoice / Sales Return all use, extended by
      one optional argument rather than split into two create methods,
      since everything after line building is identical. */
  create(company, invoice, salesReturn, data, actorUsername) {
    const noteType = salesReturn ? "Goods Return" : "Price Adjustment";
    const record = {
      id: "CN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      noteCode: this.nextNoteCode(company),
      noteType,
      linkedInvoiceId: invoice.id,
      linkedReturnId: salesReturn ? salesReturn.id : null,
      customerId: invoice.customerId,
      noteDate: new Date().toISOString().slice(0, 10),
      reason: noteType === "Goods Return" ? ERP_CREDIT_NOTE_REASONS[0] : ERP_CREDIT_NOTE_REASONS[1],
      creditLines: salesReturn
        ? this.buildLinesFromReturn(salesReturn, invoice)
        : this.buildLinesFromInvoice(invoice),
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

  /** A Goods Return note's lines are NEVER editable, at any status — by
      this point both the quantity (confirmed when the goods physically
      came back) and the price (agreed at quotation) are settled facts,
      the same strictness Tax Invoice's own lines carry. Only a Price
      Adjustment note has anything a human is meant to type. */
  canEditLines(note) {
    return note.status === "Draft" && note.noteType === "Price Adjustment";
  },

  canIssue(note) {
    if (!note || note.status !== "Draft") return false;
    return this.computeGrandTotal(note).total > 0;
  },

  /** Flips the note to Credited. GL posting is the PAGE's job, called
      right after this returns — the same "business module never learns
      GL posting exists" separation this project has held since Phase 6.
      Returns {success, record?, reason?} and never throws. */
  issue(id, company, actorUsername) {
    const note = this.findById(id);
    if (!note) return { success: false, reason: "This credit note no longer exists." };
    if (note.status !== "Draft") return { success: false, reason: "Only a Draft credit note can be issued." };

    const invoice = typeof ERP_TaxInvoiceRepository !== "undefined"
      ? ERP_TaxInvoiceRepository.findById(note.linkedInvoiceId) : null;
    if (!invoice) return { success: false, reason: "The invoice this note credits no longer exists." };

    const check = this.validateNote(company.id, invoice, note, note.id);
    if (!check.ok) return { success: false, reason: check.errors[0] };

    const all = this.getAll();
    const idx = all.findIndex((n) => n.id === id);
    all[idx] = {
      ...all[idx],
      status: "Credited",
      issuedAt: new Date().toISOString(),
      issuedByUsername: actorUsername || "system"
    };
    this._saveAll(all);
    return { success: true, record: all[idx] };
  },

  /** Draft-only. Once Credited there's a real, posted journal entry
      behind this note, and this project does not silently rewrite
      posted accounting history — the same stance Journal Entry's own
      `post()` established. A genuine mistake on an issued credit note
      is corrected the way accounting actually corrects one: reverse the
      journal entry from Journal Entry's own page, and raise a fresh
      note. Named plainly rather than implied. */
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
