/* =============================================================================
   DOT ERP
   FILE:  data/chart-of-accounts-data.js
   ROLE:  Data-access layer for Chart of Accounts — Phase 6, Module 01
          (the first Finance & Accounting module, and the master data every
          other Phase 6 module — Journal Entry, General Ledger, Trial
          Balance, the two statements, Bank Reconciliation, both Aging
          reports — ultimately posts against or reads from).

   WHY THIS COMES FIRST: Section 3 of this document is explicit that Phase 6
   only earns its "highest-priority addition" billing if every operational
   module genuinely auto-posts to a real General Ledger. None of that is
   possible without somewhere for a posting to land — an account. This file
   builds that "somewhere."

   SHAPE DECISION — CATEGORY MASTER'S TREE, WITH ONE DELIBERATE ADDITION:
   A real chart of accounts nests exactly the way Item categories do
   (Assets > Current Assets > Cash & Bank > Cash in Hand), so this file
   reuses Category Master's exact hierarchy machinery — parentAccountId /
   getChildren / getDescendants / getAncestors / wouldCreateCycle /
   hasChildren-gated delete / getBreadcrumbLabel — renamed for the account
   domain, per Section 9's standing note that this tree shape is "the right
   shape for ANY 'this record points to another record of the same type'
   relationship," not exclusive to org units or categories.

   WHAT DOESN'T CARRY OVER, AND WHY — the "study the template, don't
   default-mirror it" discipline this project holds itself to everywhere:
   a category is just a filing bucket; you can post a sale under any
   category, leaf or not. An account is NOT interchangeable that way — you
   can debit "Cash in Hand" (a real, specific account) but you cannot debit
   "Current Assets" (a subtotal that only exists because its children add
   up to it). Category Master has no equivalent concept because it didn't
   need one. So this file adds `isGroup`: a Group account is a pure
   subtotal/header with no balance of its own — it can have children but
   can never be posted to; a Ledger account (isGroup: false) is a real
   postable account — it can carry an opening balance but can never have
   children. Two rules enforce the split:
     - canAddChild(id): only true for a Group account. A Ledger account is
       a leaf by definition; Journal Entry (and this module's own "Add
       Account" form) are expected to check this before offering a parent.
     - canToggleGroup(id): only true if the account has zero children. You
       can't demote a Group with real sub-accounts down to a Ledger, and
       you can't promote a Ledger that's already carrying an opening
       balance without first clearing it (the update() layer enforces the
       latter — see below).

   ACCOUNT TYPE & NORMAL BALANCE: the five fundamentals (Asset, Liability,
   Equity, Income, Expense) aren't just a label the way Category Type is —
   they determine which financial statement an account rolls up onto
   (Balance Sheet vs. P&L) and which side (Debit/Credit) is its "normal,
   increasing" side. Both live here because Chart of Accounts is this
   project's one canonical owner of accountType; Journal Entry, Trial
   Balance and the two statements are all expected to read
   getNormalBalance()/ACCOUNT_TYPE_STATEMENT rather than re-deriving it.

   ACCOUNT CODE — DELIBERATELY FLAT, NOT HIERARCHY-ENCODED: real-world
   charts of accounts are split roughly two ways: some encode depth
   directly into the number (1000 / 1100 / 1110 / 1111), others just
   reserve a numeric block per account type and hand out the next free
   number in that block regardless of where in the tree it sits (closer to
   QuickBooks' default numbering than Tally's). This file deliberately
   picks the second, simpler approach — Asset 1000-1999, Liability
   2000-2999, Equity 3000-3999, Income 4000-4999, Expense 5000-5999,
   next-available-within-block — because a depth-encoded scheme needs
   re-numbering logic the moment an account is dragged to a new parent,
   and this project's tree-shaped modules (Departments, Categories) have
   never needed that. The tree itself (parentAccountId) still carries the
   real hierarchy; the code is just a stable, human-readable label, same
   division of responsibility Category Master already has between
   categoryCode and parentCategoryId.

   OPENING BALANCE lives on Ledger accounts only (Group accounts have no
   balance of their own — theirs is always the sum of their children,
   computed, never stored, exactly the reasoning Departments' own header
   gives for not storing a headcount rollup). Recorded as an amount plus a
   side (Debit/Credit) rather than a signed number, because that is how a
   trial balance is actually read and it avoids a sign-convention bug
   waiting to happen in Journal Entry/Trial Balance later.

   DUPLICATE CHECK: Account Name is HARD-blocked, company-wide — same
   bucket as Categories/Departments/Cost Centers/Warehouses in Section 9's
   three-way duplicate-check lesson. Account Code is ALSO checked here
   (unlike Category Code, which is only ever system-generated and so can
   never collide) because this module lets a user override the suggested
   code, and two ledgers sharing one code would make Journal Entry's
   account picker genuinely ambiguous.

   DELETE GUARD: hasChildren, same as Category/Departments — deleting a
   Group with real children would orphan its subtree. RETROFITTED once
   Journal Entry shipped (Phase 6, Module 02): this file's remove() and
   canToggleGroup() now ALSO refuse if Journal Entry has ever posted to the
   account, via ERP_JournalEntryRepository.hasPostedEntriesForAccount()
   (typeof-guarded). This was originally left as a TODO for "whoever builds
   Journal Entry next" — per the project's standing convention that a
   cross-module check belongs to the REFERENCING module, not the one being
   referenced — and Journal Entry's own file header explains why that
   convention needed one exception here: unlike Item Master degrading
   gracefully when a linked Category disappears (a cosmetic fallback),
   letting a posted-against account get deleted would corrupt real
   accounting history, so this is a hard block, not a graceful degrade.
   chart-of-accounts.html now also loads journal-entry-data.js so the guard
   is actually live on the page where the delete button lives.

   NO AUTO-SEEDED "STARTER" CHART OF ACCOUNTS: every other master data
   module in this project (Category, Department, Vendor, Customer, Item)
   starts genuinely empty for a brand-new company and makes the trainee
   build it — that's the whole point of a training simulator. Pre-loading
   a default set of ledgers here would be the fake-data problem this
   project just spent a pass removing from the Dashboard, reintroduced in
   a new module. The empty-state copy on the page instead suggests a
   minimal starter set as TEXT, not as records the trainee didn't create.
   ========================================================================== */

const ERP_ACCOUNTS_KEY = "erp_chart_of_accounts";

const ERP_ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Income", "Expense"];

/** Which financial statement each account type rolls up onto, and which
    side is its "normal" (increasing) balance. Journal Entry validates debits
    against this; Trial Balance/P&L/Balance Sheet all group by it. */
const ERP_ACCOUNT_TYPE_META = {
  Asset:     { statement: "Balance Sheet", normalBalance: "Debit" },
  Liability: { statement: "Balance Sheet", normalBalance: "Credit" },
  Equity:    { statement: "Balance Sheet", normalBalance: "Credit" },
  Income:    { statement: "Profit & Loss", normalBalance: "Credit" },
  Expense:   { statement: "Profit & Loss", normalBalance: "Debit" }
};

/** Each type's reserved numeric block for nextAccountCode() — see file
    header for why the block is flat rather than depth-encoded. */
const ERP_ACCOUNT_CODE_BLOCKS = {
  Asset: 1000, Liability: 2000, Equity: 3000, Income: 4000, Expense: 5000
};

const ERP_ChartOfAccountsRepository = {
  accountTypes: ERP_ACCOUNT_TYPES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_ACCOUNTS_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_ACCOUNTS_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  /** Root accounts first (grouped by the five types, in ERP_ACCOUNT_TYPES
      order), each followed immediately by its own descendants — same
      stable walk Category Master uses, works for both the flat table and
      the tree view. */
  getAllForCompany(companyId) {
    const mine = this.getAll().filter((a) => a.companyId === companyId);
    const byParent = new Map();
    mine.forEach((a) => {
      const key = a.parentAccountId || "__root__";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(a);
    });
    byParent.forEach((list) => list.sort((a, b) => (a.accountCode || "").localeCompare(b.accountCode || "", undefined, { numeric: true })));
    (byParent.get("__root__") || []).sort((a, b) => {
      const typeDiff = ERP_ACCOUNT_TYPES.indexOf(a.accountType) - ERP_ACCOUNT_TYPES.indexOf(b.accountType);
      return typeDiff !== 0 ? typeDiff : (a.accountCode || "").localeCompare(b.accountCode || "", undefined, { numeric: true });
    });

    const ordered = [];
    const walk = (parentKey) => {
      (byParent.get(parentKey) || []).forEach((a) => { ordered.push(a); walk(a.id); });
    };
    walk("__root__");
    return ordered;
  },

  findById(id) {
    return this.getAll().find((a) => a.id === id) || null;
  },

  /** Active, Ledger-only accounts — the contract Journal Entry's account
      picker is expected to consume once it exists (you can never post to a
      Group account, and posting to an Inactive one shouldn't be offered). */
  getPostableForCompany(companyId) {
    return this.getAllForCompany(companyId).filter((a) => a.status === "Active" && !a.isGroup);
  },

  getRootAccounts(companyId) {
    return this.getAllForCompany(companyId).filter((a) => !a.parentAccountId);
  },

  getChildren(companyId, id) {
    return this.getAllForCompany(companyId).filter((a) => a.parentAccountId === id);
  },

  /** Every account beneath `id`, at any depth (BFS) — same shape as
      Category Master's getDescendants. */
  getDescendants(companyId, id) {
    const all = this.getAllForCompany(companyId);
    const result = [];
    let frontier = [id];
    while (frontier.length) {
      const nextFrontier = [];
      all.forEach((a) => {
        if (frontier.includes(a.parentAccountId)) { result.push(a); nextFrontier.push(a.id); }
      });
      frontier = nextFrontier;
    }
    return result;
  },

  /** Path from root down to (but not including) `id`. */
  getAncestors(companyId, id) {
    const acc = this.findById(id);
    if (!acc || !acc.parentAccountId) return [];
    const parent = this.findById(acc.parentAccountId);
    if (!parent) return [];
    return [...this.getAncestors(companyId, parent.id), parent];
  },

  /** "Assets > Current Assets > Cash & Bank > Cash in Hand" — for Journal
      Entry's account picker so a deeply-nested ledger is still
      identifiable at a glance. */
  getBreadcrumbLabel(companyId, id) {
    const acc = this.findById(id);
    if (!acc) return "";
    const ancestors = this.getAncestors(companyId, id);
    return [...ancestors.map((a) => a.accountName), acc.accountName].join(" > ");
  },

  /** True if setting `accId`'s parent to `proposedParentId` would create a
      cycle. Every re-parent must pass this, same as Category Master. */
  wouldCreateCycle(companyId, accId, proposedParentId) {
    if (!proposedParentId) return false;
    if (proposedParentId === accId) return true;
    const descendantIds = this.getDescendants(companyId, accId).map((a) => a.id);
    return descendantIds.includes(proposedParentId);
  },

  hasChildren(companyId, id) {
    return this.getChildren(companyId, id).length > 0;
  },

  /** Only a Group account can be a parent — see file header. The calling
      form is expected to check this before offering `id` in a parent
      picker, the same division of responsibility every earlier module's
      canEdit()-style guard uses. */
  canAddChild(id) {
    const acc = this.findById(id);
    return !!acc && acc.isGroup === true && acc.status === "Active";
  },

  /** Can only flip Group<->Ledger while the account has no children —
      demoting a Group with real sub-accounts, or promoting a Ledger that's
      already a parent, both make the tree inconsistent. RETROFITTED once
      Journal Entry shipped: also refuses if the account has ever been
      posted to — see this file's header for why that check had to wait
      for Journal Entry to exist, and chart-of-accounts.html's own script
      list for why this guard is actually live here now, not just
      theoretically available. */
  canToggleGroup(companyId, id) {
    if (this.hasChildren(companyId, id)) return false;
    if (typeof ERP_JournalEntryRepository !== "undefined" && ERP_JournalEntryRepository.hasPostedEntriesForAccount(companyId, id)) return false;
    return true;
  },

  getNormalBalance(accountType) {
    return (ERP_ACCOUNT_TYPE_META[accountType] || {}).normalBalance || "Debit";
  },

  getStatement(accountType) {
    return (ERP_ACCOUNT_TYPE_META[accountType] || {}).statement || "Balance Sheet";
  },

  /** Next free code within accountType's reserved block — see file header
      for why this is a flat per-type counter rather than depth-encoded. */
  nextAccountCode(company, accountType) {
    const base = ERP_ACCOUNT_CODE_BLOCKS[accountType] || 1000;
    const mine = this.getAllForCompany(company.id).filter((a) => a.accountType === accountType);
    let max = base - 1;
    mine.forEach((a) => {
      const n = parseInt(a.accountCode, 10);
      if (!isNaN(n) && n >= base && n < base + 1000) max = Math.max(max, n);
    });
    return String(max + 1);
  },

  isDuplicateName(companyId, accountName, excludeId) {
    const target = accountName.trim().toLowerCase();
    return this.getAllForCompany(companyId).some((a) => a.id !== excludeId && a.accountName.trim().toLowerCase() === target);
  },

  isDuplicateCode(companyId, accountCode, excludeId) {
    const target = String(accountCode).trim();
    return this.getAllForCompany(companyId).some((a) => a.id !== excludeId && String(a.accountCode).trim() === target);
  },

  /** Ledger accounts only: currentStock-style at-cost figure Dashboard/
      Trial Balance can read before Journal Entry exists to post real
      movement against it. Stored as {amount, side}, not a signed number —
      see file header. Group accounts always report a zero opening balance
      of their own; their real "balance" is a computed rollup that belongs
      to whichever module first needs it (Trial Balance/General Ledger),
      not to this master-data file. */
  create(company, data) {
    const isGroup = data.isGroup !== undefined ? !!data.isGroup : true;
    const record = {
      id: "ACC-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      accountType: "Asset",
      parentAccountId: null,
      isGroup,
      status: "Active",
      description: "",
      openingBalance: 0,
      openingBalanceType: "Debit",
      createdAt: new Date().toISOString(),
      ...data,
      isGroup
    };
    // A Group account never carries its own opening balance — it's a
    // computed rollup of its children, not a stored figure (see header).
    if (record.isGroup) { record.openingBalance = 0; }
    if (!record.accountCode) record.accountCode = this.nextAccountCode(company, record.accountType);
    const all = this.getAll();
    all.push(record);
    this._saveAll(all);
    return record;
  },

  update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    const next = { ...all[idx], ...partial, updatedAt: new Date().toISOString() };
    if (next.isGroup) { next.openingBalance = 0; }
    all[idx] = next;
    this._saveAll(all);
    return all[idx];
  },

  toggleStatus(id) {
    const acc = this.findById(id);
    if (!acc) return null;
    return this.update(id, { status: acc.status === "Active" ? "Inactive" : "Active" });
  },

  /** hasChildren guards against orphaning a subtree, same as Category/
      Departments. RETROFITTED once Journal Entry shipped: also refuses if
      the account has ever been posted to (typeof-guarded — see file
      header's two-way-dependency note, and chart-of-accounts.html's own
      script list, which now loads journal-entry-data.js specifically so
      this check is live on the page where the delete button actually is,
      not just theoretically available from some other page). */
  remove(id, companyId) {
    if (this.hasChildren(companyId, id)) return false;
    if (typeof ERP_JournalEntryRepository !== "undefined" && ERP_JournalEntryRepository.hasPostedEntriesForAccount(companyId, id)) return false;
    const all = this.getAll().filter((a) => a.id !== id);
    this._saveAll(all);
    return true;
  }
};
