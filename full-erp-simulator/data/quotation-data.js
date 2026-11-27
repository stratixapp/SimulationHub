/* =============================================================================
   DOT ERP
   FILE:  data/quotation-data.js
   ROLE:  Data-access layer for Quotation Receipt — Phase 4, Module 06.
          Records the actual quote a SELECTED vendor (Module 5) sent back
          on a Sent/Closed RFQ. Read data/rfq-data.js's header first.

   PER-LINE PRICING, MIRRORING THE PR'S OWN LINE ITEMS.
   A quotation could have been modeled as one lump-sum number, but that
   would make Module 7 (Quotation Comparison) unable to do anything more
   interesting than compare totals. Instead, `lineQuotes` has one entry
   per line item of the RFQ's linked PR (`{ prLineItemId, quotedUnitPrice }`)
   — the same "reuse the upstream document's own structure" instinct
   Purchase Requisition's line items already modeled, just one hop further
   down the chain (PR line -> RFQ -> vendor's price on that exact line).
   computeQuotedTotal() sums these the same partial-aware way pr-data.js's
   computeGrandTotal() does.

   A HARD UNIQUENESS CONSTRAINT ON A COMPOSITE (RFQ, VENDOR) KEY — A NEW
   KIND OF DUPLICATE CHECK.
   Every duplicate check so far in this codebase was either a single
   FIELD (a name, a code) or a CROSS-PARENT exclusivity claim (a Need
   claimed by at most one PR, a PR claimed by at most one RFQ). This one
   is different again: at most ONE quotation may exist for a given
   (rfqId, vendorId) PAIR — not because the vendor or the RFQ is
   "consumed," but because a second quotation record for the same
   vendor on the same RFQ would just be a duplicate entry of the same
   real-world fact. If a vendor sends a revised price, the existing
   record gets EDITED (while still Draft) or reopened via reviseToDraft()
   — never a second row. hasQuotationForRfqAndVendor() enforces this as a
   HARD block (hasDuplicate*-style), not a soft nudge, because unlike
   Department Need's transactional duplicates, two quotation rows for the
   same vendor really would just be a data-entry mistake here.

   THE VENDOR PICKER IS FURTHER NARROWED THAN "INVITED" — IT'S "SELECTED."
   A quotation can only be logged for a vendor Module 5 marked Selected on
   this RFQ (`ERP_RfqRepository.getSelectedVendorIds()`), not merely
   invited — reinforcing the pipeline Module 5 exists to create instead of
   letting this module bypass it.

   A SIMPLE 3-STATE LIFECYCLE, ONCE AGAIN NOT PR'S 5-STATE SHAPE.
   Draft (being entered/corrected) -> Received (locked, ready for
   comparison), with Cancelled as an early exit (a vendor withdrew, or the
   quote arrived in error). No Approve/Reject — accepting or rejecting a
   QUOTE happens through the act of choosing a vendor for the PO later,
   not through this record's own status. reviseToDraft() (Received ->
   Draft) exists for a genuine correction, the same "don't spawn a
   duplicate row for what's really one document being fixed" instinct as
   Department Need's reopen().
   QUOTATION COMPARISON (Module 7) LIVES HERE TOO — THIRD REINFORCEMENT OF
   THE "ONE REPOSITORY, MULTIPLE PAGES" PATTERN.
   Comparing Received quotations side by side and marking one Recommended
   is a continuation of the SAME quotation records, not a new document —
   `isRecommended`/`recommendedAt`/`recommendedByUsername` live directly
   on the quotation record, exactly like Vendor Selection's
   `vendorDecisions` lives on the RFQ rather than getting its own file.
   `recommend()` enforces "at most one Recommended quotation per RFQ" by
   clearing the flag on every sibling quotation for the same `rfqId` —
   a SINGLETON-PER-PARENT shape, distinct from `isDefault`'s singleton-
   per-COMPANY shape (Tax Master/Bank Master/Payment Terms) because the
   scope being deduplicated against is one RFQ's own quotations, not the
   whole company's table. `getRecommendedQuotationForRfq()` is the
   FK-surface hook Purchase Order (Module 9) is expected to read from.
   ========================================================================== */

const ERP_QUOTATION_KEY = "erp_quotations";

const ERP_QUOTATION_STATUSES = ["Draft", "Received", "Cancelled"];

const ERP_QuotationRepository = {
  statuses: ERP_QUOTATION_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_QUOTATION_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_QUOTATION_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((q) => q.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getAllForRfq(rfqId) {
    return this.getAll().filter((q) => q.rfqId === rfqId);
  },

  findById(id) {
    return this.getAll().find((q) => q.id === id) || null;
  },

  nextQuotationCode(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((q) => {
      const match = /-QT-(\d+)$/.exec(q.quotationCode || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-QT-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(quotation) {
    return quotation.status === "Draft";
  },

  canDelete(quotation) {
    return quotation.status === "Draft" || quotation.status === "Cancelled";
  },

  /** Hard uniqueness on the (rfqId, vendorId) pair — see file header. */
  hasQuotationForRfqAndVendor(rfqId, vendorId, excludeId) {
    return this.getAllForRfq(rfqId).some((q) =>
      q.id !== excludeId && q.vendorId === vendorId && q.status !== "Cancelled"
    );
  },

  /** null price on any line -> null total, same "don't understate an
      incomplete estimate" shape as pr-data.js's computeGrandTotal(). */
  computeQuotedTotal(quotation) {
    let total = 0, pricedCount = 0;
    (quotation.lineQuotes || []).forEach((lq) => {
      if (lq.quotedUnitPrice != null && lq.quotedUnitPrice !== "" && !isNaN(Number(lq.quotedUnitPrice))) {
        total += Number(lq.quotedUnitPrice) * Number(lq.quantity || 0);
        pricedCount++;
      }
    });
    return { total, pricedCount, totalCount: (quotation.lineQuotes || []).length };
  },

  actorLabel(username) {
    if (!username) return "—";
    if (typeof ERP_UserRepository === "undefined") return username;
    const user = ERP_UserRepository.findByUsername(username);
    return user ? `${user.fullName} (${user.role})` : username;
  },

  create(company, data) {
    const record = {
      id: "QT-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      quotationCode: this.nextQuotationCode(company),
      rfqId: null,
      vendorId: null,
      lineQuotes: [],
      validUntil: null,
      deliveryDays: null,
      notes: "",
      status: "Draft",
      isRecommended: false,
      recommendedAt: null, recommendedByUsername: null,
      receivedAt: null, receivedByUsername: null,
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
    const idx = all.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Received. */
  markReceived(id, actorUsername) {
    return this.update(id, { status: "Received", receivedAt: new Date().toISOString(), receivedByUsername: actorUsername });
  },

  /** Received -> Draft, to correct the SAME record rather than creating a
      second one — see file header. */
  reviseToDraft(id) {
    return this.update(id, { status: "Draft" });
  },

  /** Draft/Received -> Cancelled. */
  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  /** Marks this quotation Recommended and clears the flag on every OTHER
      quotation for the SAME rfqId — see file header for why this is a
      singleton-per-PARENT shape, not per-company like isDefault. */
  recommend(id, actorUsername) {
    const quotation = this.findById(id);
    if (!quotation) return null;
    const all = this.getAll();
    all.forEach((q) => {
      if (q.rfqId !== quotation.rfqId) return;
      if (q.id === id) {
        q.isRecommended = true;
        q.recommendedAt = new Date().toISOString();
        q.recommendedByUsername = actorUsername;
      } else if (q.isRecommended) {
        q.isRecommended = false;
        q.recommendedAt = null;
        q.recommendedByUsername = null;
      }
    });
    this._saveAll(all);
    return this.findById(id);
  },

  unrecommend(id) {
    return this.update(id, { isRecommended: false, recommendedAt: null, recommendedByUsername: null });
  },

  /** The FK-surface hook Purchase Order (Module 9) is expected to read
      from. */
  getRecommendedQuotationForRfq(rfqId) {
    return this.getAllForRfq(rfqId).find((q) => q.isRecommended) || null;
  },

  remove(id) {
    const q = this.findById(id);
    if (!q || !this.canDelete(q)) return false;
    const all = this.getAll().filter((r) => r.id !== id);
    this._saveAll(all);
    return true;
  }
};
