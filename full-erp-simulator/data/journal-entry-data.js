/* =============================================================================
   DOT ERP
   FILE:  data/journal-entry-data.js
   ROLE:  Data-access layer for Journal Entry — Phase 6, Module 02. The
          first module that actually POSTS to something — every account
          Chart of Accounts creates has been inert until now.

   TWO KINDS OF ENTRY, ONE REPOSITORY: the brief calls for "manual entries,
   plus a clear, filterable view of every auto-posted entry the system
   generated." Those are NOT two different record types — they're the same
   `JournalEntry` shape with a `source` field: `"Manual"` for anything
   created on this page, or the originating module's own name (e.g.
   `"Vendor Payment"`) for anything the Phase 6 retrofit pass posts later.
   Nothing sets a non-"Manual" source yet — that retrofit pass hasn't
   happened (see CONTINUE_HERE.md Section 3, Phase 6 item 10) — but the
   field, the filter, and the `sourceRecordId` back-reference all exist now
   so that pass has somewhere real to write to instead of needing its own
   follow-up schema change.

   WHY THIS MODULE GETS A GENUINELY NEW LINE-ITEM UI, NOT A COPY OF AN
   EXISTING ONE: every earlier line-item module in this project either
   pulls its lines from a single upstream document (Purchase Order's line
   table is fixed — it IS the recommended quotation's own lines, just
   editable) or adds them one at a time through their own small modal
   (Purchase Requisition). Neither shape fits here. A journal entry's
   lines have no upstream document to pull from, AND double-entry
   bookkeeping's one hard rule — total debits must equal total credits —
   is a constraint across ALL lines simultaneously, which means the
   trainee needs to see every line and a running total at once while
   typing, not one line at a time in its own modal. So the page gets a
   single live-editable table with its own "+ Add Line" / remove-row
   controls and a totals footer that updates on every keystroke — genuinely
   new for this project, and worth naming as a deliberate choice rather
   than silently deviating from what came before.

   LIFECYCLE — REAL ACCOUNTING IMMUTABILITY, NOT THIS PROJECT'S USUAL
   EDIT-UNTIL-APPROVED SHAPE: `Draft -> Posted`, `Draft -> Cancelled`. A
   Draft can be freely edited, saved unbalanced (the page shows how far out
   of balance it is live), and deleted — it hasn't affected anything yet.
   Posting is a deliberate, separate action (`post()`), only allowed once
   `canPost()` passes (>= 2 lines, every line has exactly one of
   debit/credit > 0 against a real Active Ledger account, and the entry
   balances to zero). ONCE POSTED, AN ENTRY IS NEVER EDITED OR DELETED —
   `update()`/`remove()` both refuse once status is anything but "Draft".
   This is a real, deliberate divergence from almost every other module in
   this project (Purchase Order, Sales Order etc. all allow editing an
   Approved/Sent record under some conditions) because a posted journal
   entry is real accounting history now — General Ledger and Trial Balance
   will read it directly once they exist, and silently rewriting posted
   history is exactly the bug a real accountant would never forgive. The
   only way to undo a Posted entry is `reverse()`: it creates a NEW,
   already-Posted entry with every line's debit and credit swapped, links
   both entries to each other (`reversalOfEntryId` / `reversedByEntryId`),
   and leaves the original untouched and still Posted — the same
   "correction is a new entry, not a rewrite" principle real accounting
   software (Tally's reversing journals, QuickBooks) uses. An entry can
   only be reversed once (`canReverse()` refuses if `reversedByEntryId` is
   already set).

   THE ONE RETROFIT THIS MODULE OWES BACKWARD: Chart of Accounts' own file
   header flags that it deliberately does NOT check "has this account ever
   been posted to" before allowing delete or a Group<->Ledger kind change
   — that check was left for "whoever builds Journal Entry next" to add,
   per this project's standing convention that a cross-module check
   belongs to the REFERENCING module, not the one being referenced. This
   file provides `hasPostedEntriesForAccount()`; `chart-of-accounts-
   data.js`'s own `remove()`/`canToggleGroup()` now call it (typeof-
   guarded, same defensive pattern every other cross-repository check in
   this codebase uses) and `chart-of-accounts.html` now also loads this
   file so that guard is actually live on the page where the delete button
   lives — not just theoretically available. This makes Chart of Accounts
   and Journal Entry the first two data files in this project with a
   genuine TWO-WAY dependency (Journal Entry reads accounts forward via
   `getPostableForCompany()`; Chart of Accounts now reads postings
   backward via this file) rather than the strictly one-directional
   layering every earlier phase used — worth flagging as a real departure,
   not a quiet one.

   ENTRY NUMBER, NOT A NAME: unlike every master-data module's Name field,
   an entry has no user-chosen identifier to duplicate-check — `entryNumber`
   is purely a sequential, system-generated label (`JE-00001`, `JE-00002`
   ...), so there's no `isDuplicateXxx()` here at all, a first for a
   document-shaped module in this project.
   ========================================================================== */

const ERP_JOURNAL_ENTRIES_KEY = "erp_journal_entries";

const ERP_JournalEntryRepository = {
  statuses: ["Draft", "Posted", "Cancelled"],

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_JOURNAL_ENTRIES_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_JOURNAL_ENTRIES_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((e) => e.companyId === companyId)
      .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate) || new Date(b.createdAt) - new Date(a.createdAt));
  },

  findById(id) {
    return this.getAll().find((e) => e.id === id) || null;
  },

  /** {totalDebit, totalCredit, difference, isBalanced} — `difference` is
      signed (totalDebit - totalCredit) so the page can say which side is
      short, not just "unbalanced." Tolerates a hair of floating-point
      drift (< 0.005) rather than demanding bit-exact equality. */
  computeTotals(entry) {
    const lines = entry.lines || [];
    const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    const difference = totalDebit - totalCredit;
    return { totalDebit, totalCredit, difference, isBalanced: Math.abs(difference) < 0.005 };
  },

  /** A line is well-formed if it points at a real, Active, Ledger account
      and carries exactly one of debit/credit as a positive amount — never
      both, never neither. */
  isLineValid(companyId, line) {
    if (!line.accountId) return false;
    const account = ERP_ChartOfAccountsRepository.findById(line.accountId);
    if (!account || account.companyId !== companyId || account.isGroup || account.status !== "Active") return false;
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    if (debit > 0 && credit > 0) return false;
    return debit > 0 || credit > 0;
  },

  canEdit(entry) {
    return entry.status === "Draft";
  },

  canDelete(entry) {
    return entry.status === "Draft";
  },

  /** Everything a Draft needs before it's allowed to become permanent
      accounting history: at least 2 lines, every line individually valid,
      and the whole entry balanced. The page is expected to call this
      before showing/enabling its own "Post" button — `post()` below
      re-checks it regardless, the same defense-in-depth every other
      module's own transition method (`approve()`, `confirm()`, etc.)
      already uses. */
  canPost(companyId, entry) {
    if (entry.status !== "Draft") return false;
    const lines = entry.lines || [];
    if (lines.length < 2) return false;
    if (!lines.every((l) => this.isLineValid(companyId, l))) return false;
    return this.computeTotals(entry).isBalanced;
  },

  canReverse(entry) {
    return entry.status === "Posted" && !entry.reversedByEntryId;
  },

  nextEntryNumber(company) {
    const mine = this.getAll().filter((e) => e.companyId === company.id);
    let max = 0;
    mine.forEach((e) => {
      const n = parseInt(String(e.entryNumber).replace(/^JE-/, ""), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    });
    return "JE-" + String(max + 1).padStart(5, "0");
  },

  /** Always creates a Draft, whatever `data.status` says — posting is its
      own deliberate step (`post()`), never implied by create(). */
  create(company, data, actorUsername) {
    const record = {
      id: "JE-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      entryNumber: this.nextEntryNumber(company),
      entryDate: new Date().toISOString().slice(0, 10),
      narration: "",
      lines: [],
      source: "Manual",
      sourceRecordId: null,
      reversalOfEntryId: null,
      reversedByEntryId: null,
      status: "Draft",
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString(),
      ...data,
      status: "Draft"
    };
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Refuses once the entry has left Draft — see file header. Returns
      `null` on a refused update so the calling page can tell "not found"
      and "not editable" apart from a falsy check alone if it needs to,
      though in practice the page is expected to call `canEdit()` first,
      same division of responsibility as every earlier module's own
      status-gated update(). */
  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    if (all[idx].status !== "Draft") return null;
    all[idx] = { ...all[idx], ...partial, status: "Draft", updatedAt: new Date().toISOString() };
    this._saveAll(all);
    return all[idx];
  },

  post(id, actorUsername) {
    const entry = this.findById(id);
    if (!entry) return null;
    const company = { id: entry.companyId };
    if (!this.canPost(company.id, entry)) return null;
    return this._patch(id, { status: "Posted", postedByUsername: actorUsername, postedAt: new Date().toISOString() });
  },

  cancel(id, actorUsername) {
    const entry = this.findById(id);
    if (!entry || entry.status !== "Draft") return null;
    return this._patch(id, { status: "Cancelled", cancelledByUsername: actorUsername, cancelledAt: new Date().toISOString() });
  },

  /** Creates and returns the new reversing entry; also patches the
      ORIGINAL with `reversedByEntryId` so both sides of the link exist.
      The reversal posts immediately (see file header for why) — it's
      never a Draft. */
  reverse(id, actorUsername) {
    const original = this.findById(id);
    if (!original || !this.canReverse(original)) return null;

    const company = { id: original.companyId };
    const reversal = {
      id: "JE-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: original.companyId,
      entryNumber: this.nextEntryNumber(company),
      entryDate: new Date().toISOString().slice(0, 10),
      narration: `Reversal of ${original.entryNumber}: ${original.narration}`,
      lines: (original.lines || []).map((l) => ({
        ...l,
        debit: Number(l.credit) || 0,
        credit: Number(l.debit) || 0
      })),
      source: "Manual",
      sourceRecordId: null,
      reversalOfEntryId: original.id,
      reversedByEntryId: null,
      status: "Posted",
      createdByUsername: actorUsername || "system",
      createdAt: new Date().toISOString(),
      postedByUsername: actorUsername || "system",
      postedAt: new Date().toISOString()
    };

    const all = this.getAll();
    all.push(reversal);
    const originalIdx = all.findIndex((e) => e.id === id);
    if (originalIdx !== -1) all[originalIdx] = { ...all[originalIdx], reversedByEntryId: reversal.id };
    this._saveAll(all);
    return reversal;
  },

  /** Refuses once the entry has left Draft — a Posted or Cancelled entry
      is permanent record, not something to delete. */
  remove(id) {
    const entry = this.findById(id);
    if (!entry || entry.status !== "Draft") return false;
    const all = this.getAll().filter((e) => e.id !== id);
    this._saveAll(all);
    return true;
  },

  _patch(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial };
    this._saveAll(all);
    return all[idx];
  },

  /** The retrofit Chart of Accounts' own header calls for — see this
      file's header for the full two-way-dependency reasoning. Only
      Posted entries count; a Draft or Cancelled entry never touched the
      books, so it shouldn't block anything. */
  hasPostedEntriesForAccount(companyId, accountId) {
    return this.getAllForCompany(companyId).some((e) =>
      e.status === "Posted" && (e.lines || []).some((l) => l.accountId === accountId)
    );
  }
};
