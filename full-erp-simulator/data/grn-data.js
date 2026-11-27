/* =============================================================================
   DOT ERP
   FILE:  data/grn-data.js
   ROLE:  Data-access layer for GRN (Goods Receipt Note) — Phase 4, Module
          14. Goods Receipt (Module 13) is the fast, informal dock entry;
          this is the formal, numbered document downstream accounting
          modules actually trust — Invoice Verification (16) and, by
          name, Three-Way Matching (17, "PO vs GRN vs Invoice") both
          reference GRN specifically, never Goods Receipt directly.

   WHY THIS ISN'T JUST GOODS RECEIPT WITH A DIFFERENT LABEL. A GRN line
   carries something Goods Receipt's own lines never needed: `unitPrice`.
   Goods Receipt is purely a quantity/condition record — it doesn't care
   what anything costs. A GRN does, because it's the document Three-Way
   Matching will eventually check a vendor's invoice against, and that
   check is fundamentally about money as well as quantity. The price is
   copied from the PURCHASE ORDER's own line pricing (walking PAST Goods
   Receipt and Delivery Schedule, neither of which carry price, all the
   way back to the PO) — a GRN doesn't renegotiate price, it just carries
   forward what was agreed. This is the first chain-walk in this session
   that skips two intermediate hops to reach the field it actually needs.

   BUILT FROM ONE LOGGED GOODS RECEIPT, HEADER + LINES, SAME SHAPE AS
   EVERY MODULE THIS SESSION. `linkedReceiptId` required, exclusive
   (`getLinkedReceiptIds`/`getAvailableLoggedReceiptsForCompany`, the
   sixth instance of this exact pattern — see CONTINUE_HERE.md Section
   9). `grnLines[]` is copied 1:1 from the receipt's own `receiptLines`
   at creation time (quantity) plus the PO's own price — NOT independently
   editable line-by-line the way Goods Receipt's quantities were, because
   a GRN's whole job is to be a faithful, price-bearing COPY of what was
   already recorded, not a place to revise numbers again. If a quantity
   was wrong, the fix belongs back in Goods Receipt, not here.

   STATUS LIFECYCLE: DELIBERATELY NO APPROVAL GATE, EVEN THOUGH THIS
   FEEDS ACCOUNTING. `Draft -> Posted -> Cancelled` — the same simple
   3-state operational shape Delivery Schedule and Goods Receipt used,
   NOT the PR/PO 5-8 state approval-gated shape. The reasoning: "Posted"
   is an administrative formalization action (same category as PO's own
   `sendToVendor()` — dispatching/finalizing your own record, not judging
   it), not a decision about whether the goods were acceptable. THAT
   decision — pass/fail, accept/reject quantities — is Quality
   Inspection's job (Module 15), a genuinely separate concern kept in its
   own module rather than folded in here or turned into an approval gate
   on this one.
   ========================================================================== */

const ERP_GRN_KEY = "erp_grns";

const ERP_GRN_STATUSES = ["Draft", "Posted", "Cancelled"];

const ERP_GrnRepository = {
  statuses: ERP_GRN_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_GRN_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_GRN_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((g) => g.companyId === companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((g) => g.id === id) || null;
  },

  nextGrnNumber(company) {
    const mine = this.getAllForCompany(company.id);
    let max = 0;
    mine.forEach((g) => {
      const match = /-GRN-(\d+)$/.exec(g.grnNumber || "");
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return `${company.companyCode}-GRN-${String(max + 1).padStart(2, "0")}`;
  },

  canEdit(grn) {
    return grn.status === "Draft";
  },

  canDelete(grn) {
    return grn.status === "Draft" || grn.status === "Cancelled";
  },

  /** Same partial-aware shape as every priced document this session. */
  computeLineValue(line) {
    const price = line.unitPrice;
    if (price === null || price === undefined || price === "" || isNaN(Number(price))) return null;
    return Number(line.quantity) * Number(price);
  },

  computeGrandTotal(grn) {
    let total = 0, pricedCount = 0;
    (grn.grnLines || []).forEach((line) => {
      const v = this.computeLineValue(line);
      if (v != null) { total += v; pricedCount++; }
    });
    return { total, pricedCount, totalCount: (grn.grnLines || []).length };
  },

  getLinkedReceiptIds(companyId, excludeGrnId) {
    const ids = new Set();
    this.getAllForCompany(companyId).forEach((g) => {
      if (g.id === excludeGrnId || g.status === "Cancelled") return;
      if (g.linkedReceiptId) ids.add(g.linkedReceiptId);
    });
    return ids;
  },

  getAvailableLoggedReceiptsForCompany(companyId, excludeGrnId) {
    if (typeof ERP_GoodsReceiptRepository === "undefined") return [];
    const claimed = this.getLinkedReceiptIds(companyId, excludeGrnId);
    return ERP_GoodsReceiptRepository.getAllForCompany(companyId)
      .filter((r) => r.status === "Logged" && !claimed.has(r.id));
  },

  /** The retrofit hook for Goods Receipt's own Detail modal. */
  findGrnForReceipt(companyId, receiptId) {
    return this.getAllForCompany(companyId).find((g) =>
      g.status !== "Cancelled" && g.linkedReceiptId === receiptId
    ) || null;
  },

  actorLabel(username) {
    return window.ERP.actorLabel(username);
  },

  create(company, data) {
    const record = {
      id: "GRN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      grnNumber: this.nextGrnNumber(company),
      linkedReceiptId: null,
      grnLines: [],
      notes: "",
      status: "Draft",
      postedAt: null, postedByUsername: null,
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
    const idx = all.findIndex((g) => g.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Posted. No approval gate — see file header. */
  post(id, actorUsername) {
    return this.update(id, { status: "Posted", postedAt: new Date().toISOString(), postedByUsername: actorUsername });
  },

  reopen(id) {
    return this.update(id, { status: "Draft", postedAt: null, postedByUsername: null });
  },

  cancel(id, actorUsername) {
    return this.update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername });
  },

  remove(id) {
    const grn = this.findById(id);
    if (!grn || !this.canDelete(grn)) return false;
    const all = this.getAll().filter((g) => g.id !== id);
    this._saveAll(all);
    return true;
  }
};
