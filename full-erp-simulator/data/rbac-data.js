/* =============================================================================
   DOT ERP
   FILE:  data/rbac-data.js
   ROLE:  Role-Based Access Control — Phase 11. A pure lookup layer: which
          of this project's six roles can reach which page, plus a couple
          of small role-identity helpers. No UI side effects live here —
          see script.js's own `window.ERP.enforcePageAccess()` for the
          redirect/toast/sidebar-hiding that actually ACTS on what this
          file answers, the same "repository stays pure, the page/runtime
          layer does the acting" split every other data file in this
          project already holds to.

   ARCHITECTURE CEILING — READ THIS FIRST, IT'S NOT OPTIONAL CONTEXT:
   this is, and can only ever be, a UI-LEVEL SIMULATION. Every check below
   runs in the browser, reads a role string sitting in `sessionStorage`,
   and hides or blocks things in the DOM. Anyone with dev tools open can
   edit that role string, or simply call a repository function directly
   from the console, and bypass every restriction this file describes.
   That is not a bug to fix — there is no backend here to enforce
   anything against, the same honest limitation the dummy login system
   itself already names. Build and use this as what it actually is: a
   real, useful way to PRACTICE what role-based access looks and feels
   like from the inside of an ERP, not a security boundary.

   THE ROLE MODEL — SIX ROLES, REUSING THE EXISTING `role` FIELD RATHER
   THAN INVENTING A COMPETING ONE: `data/users.js` already put a `role`
   string on every dummy user, and that string was already flowing into
   the session object at login (`session.role` — see script.js's own
   login handler) and already being used as a soft, non-blocking hint in
   three earlier Procurement modules (`APPROVER_ROLES`, PR/PO/Order
   Approval). Renaming any of those five existing strings would ripple
   into that soft-hint check and the login page's own quick-login chips
   for no real benefit — so this phase reuses them EXACTLY as they
   already are, and adds exactly one new one (HR Manager, the one
   functional area — Phase 9 — with no existing persona at all). "Current
   role" is deliberately NOT a separate thing chosen at login: it's
   simply whatever `role` the signed-in user's own account currently
   carries, the same way a real system's access follows the account, not
   a per-session choice. A role change made through this phase's own new
   User & Role Management module takes effect the next time that account
   signs in — not instantly for an already-open session elsewhere, since
   nothing here has any way to reach into a different browser tab's own
   sessionStorage, a real and named limitation rather than a solved one.

   WHY THESE SIX, NOT A ROLE PER PHASE: a role per phase (ten of them,
   one per Phase 1-10) would be far too granular to match how an actual
   mid-market company organizes access — nobody hires a dedicated
   "Master Data Administrator." These six instead mirror how a real
   company's OWN functional departments actually divide up: a commercial
   manager running both purchasing and sales (a genuinely common setup at
   this company's own size, not a shortcut — see "Purchase & Sales
   Manager" already meant exactly this before RBAC existed), a finance
   function covering both bookkeeping and the reports built on it, an
   operations function covering both the warehouse and the shop floor
   that draws from it (Inventory + Manufacturing), HR & Payroll on its
   own (nothing else touches employee compensation data), and a
   full-access administrator. A Viewer/read-only role (`Auditor (Read-Only)`)
   completes the set — see the two-tier design note below for why it
   works differently from the other five.

   PAGE-LEVEL GATING, NOT ACTION-LEVEL — A DELIBERATE, NAMED SCOPE
   DECISION: the roadmap's own brief asks whether a restricted user sees
   a disabled button, a hidden button, or a redirect, and this project
   picks BOTH, applied at two different tiers rather than one — because
   an action-by-action permission matrix across ~90 already-built
   modules' own dynamically-rendered buttons would mean re-opening every
   one of them individually, the exact "invasive retrofit" scale the
   roadmap warned about, and doing that with real per-button rigor is not
   achievable without touching each module's own file. What this DOES
   deliver in full: (1) MODULE-LEVEL access — the four functional roles
   below each see only their own department's own pages in the sidebar,
   and are redirected away with a toast if they reach a page outside
   that set by a direct URL, the real, primary shape of RBAC in most
   actual small-to-mid ERPs (a purchasing clerk's own login usually can't
   even OPEN the payroll module, full stop, module by module — it isn't
   usually gated button by button inside modules they can't see at all).
   (2) A universal ACTION-level lockdown for the Viewer role specifically
   (see below), enforced through the small number of shared choke points
   every module's own destructive/state-changing action already funnels
   through (`window.ERP.openConfirm()`, `window.ERP.openModal()`, and a
   `…SaveBtn`-suffix convention), rather than per-module code — real,
   broad coverage with zero changes to any of those ~90 modules' own
   files, but NOT a claim of ABSOLUTE, individually-audited coverage; see
   script.js's own RBAC section for the one specific, named exception
   this approach doesn't reach (Vendor Selection's own inline per-row
   decision UI, retrofitted directly instead — see that file's header).

   TWO GENUINELY DIFFERENT SHAPES OF RESTRICTION, ON PURPOSE: the four
   functional roles get a NARROWED set of pages with FULL rights inside
   them (see their own page arrays below). The Viewer role gets the
   OPPOSITE shape — every page (the sidebar hides nothing for it), but
   zero mutating rights anywhere at all. Modeling Viewer as "sees
   everything, does nothing" rather than folding it into the same
   narrowed-page-set shape is deliberate: `Auditor (Read-Only)`'s own
   existing bio ("learning how an ERP system works, one module at a
   time") is a genuine read-everywhere auditor/learner persona, not a
   department — narrowing its own page set the same way the functional
   roles are narrowed would defeat that persona's whole point.

   ADMIN IS A SUPERSET, NEVER ENUMERATED PER PAGE: `canAccessPage()`
   checks for `System Administrator` FIRST, before consulting the map at
   all, so every page array below only ever needs to name the functional
   role(s) that ALSO reach it — no page's own array repeats "System
   Administrator" defensively.

   OVERLAPPING ACCESS IS NORMAL, NOT A BUG: several pages list more than
   one functional role (Purchase Register and AP Aging list BOTH Finance
   and Purchase & Sales, since a procurement manager genuinely needs
   their own department's own spend report too, not only Finance).
   Real RBAC is rarely one-role-per-page; cross-functional overlap where
   it's genuinely justified is modeled here rather than forced into an
   artificially clean partition.

   FAIL-CLOSED ON AN UNLISTED PAGE, WITH A LOUD CONSOLE WARNING — THE NEW
   STANDING RULE FOR EVERY PHASE FROM HERE ON: an unrecognized `pageKey`
   defaults to Admin-only rather than universally open. A training tool
   about access control that quietly opened up on anything it forgot to
   classify would be teaching the wrong lesson; a real RBAC system fails
   closed too. Every phase from Phase 12 onward MUST add its own new
   pages to `ERP_PAGE_ROLE_MAP` as part of that module's own first
   version — see `CONTINUE_HERE.md`'s own updated Section 2 for this as
   a new non-negotiable rule alongside validate.py and Node verification.
   ========================================================================== */

const ERP_RBAC_ADMIN_ROLE = "System Administrator";
const ERP_RBAC_VIEWER_ROLE = "Auditor (Read-Only)";

const ERP_RBAC_ROLES = [
  "System Administrator",
  "Purchase & Sales Manager",
  "Finance Executive",
  "Inventory Controller",
  "HR Manager",
  "Auditor (Read-Only)"
];

/* Short labels for compact UI (role chips, badges) — mirrors the login
   page's own existing quick-login chip labels exactly. */
const ERP_RBAC_ROLE_SHORT_LABELS = {
  "System Administrator": "Admin",
  "Purchase & Sales Manager": "Manager",
  "Finance Executive": "Finance",
  "Inventory Controller": "Inventory",
  "HR Manager": "HR",
  "Auditor (Read-Only)": "Viewer"
};

/* "*" = every role (including Viewer, including any future role) reaches
   this page — used only for genuinely universal/personal pages, never as
   a stand-in for "didn't get around to classifying this one." Everything
   else lists exactly the functional role(s) that reach it; Admin reaches
   everything regardless (see canAccessPage). */
const ERP_PAGE_ROLE_MAP = {
  // Universal — personal/utility pages, gated for nobody.
  "dashboard": "*",
  "profile": "*",
  "settings": "*",
  "notifications": "*",
  "theme": "*",
  "help": "*",

  // Admin-only — foundational system/company configuration.
  "activity-log": [],
  "create-company": [],
  "company-profile": [],
  "financial-year": [],
  "currency": [],
  "gst-details": [],
  "branches": [],
  "departments": [],
  "company-settings": [],
  "user-role-management": [],

  // Master Data — each classified by the function that actually owns it,
  // independent of which sidebar group/phase originally built it (e.g.
  // Warehouses shipped under Company Setup, Cost Centers under Company
  // Setup too — both are classified here by what they're actually FOR).
  "employees": ["HR Manager"],
  "vendors": ["Purchase & Sales Manager"],
  "customers": ["Purchase & Sales Manager"],
  "categories": ["Purchase & Sales Manager", "Inventory Controller"],
  "units": ["Purchase & Sales Manager", "Inventory Controller"],
  "items": ["Purchase & Sales Manager", "Inventory Controller"],
  "tax-master": ["Finance Executive"],
  "hsn-master": ["Finance Executive"],
  "payment-terms": ["Purchase & Sales Manager", "Finance Executive"],
  "bank-master": ["Finance Executive"],
  "warehouses": ["Inventory Controller"],
  "cost-centers": ["Finance Executive"],

  // Procurement (Phase 4) — Purchase & Sales Manager.
  "department-need": ["Purchase & Sales Manager"],
  "purchase-requisition": ["Purchase & Sales Manager"],
  "pr-approval": ["Purchase & Sales Manager"],
  "rfq-creation": ["Purchase & Sales Manager"],
  "vendor-selection": ["Purchase & Sales Manager"],
  "quotation-receipt": ["Purchase & Sales Manager"],
  "quotation-comparison": ["Purchase & Sales Manager"],
  "vendor-evaluation": ["Purchase & Sales Manager"],
  "purchase-order": ["Purchase & Sales Manager"],
  "po-approval": ["Purchase & Sales Manager"],
  "vendor-confirmation": ["Purchase & Sales Manager"],
  "delivery-schedule": ["Purchase & Sales Manager"],
  "goods-receipt": ["Purchase & Sales Manager"],
  "grn": ["Purchase & Sales Manager"],
  "quality-inspection": ["Purchase & Sales Manager"],
  "invoice-verification": ["Purchase & Sales Manager"],
  "three-way-matching": ["Purchase & Sales Manager"],
  "payment-request": ["Purchase & Sales Manager"],
  "vendor-payment": ["Purchase & Sales Manager"],
  "purchase-closure": ["Purchase & Sales Manager"],

  // Sales (Phase 5) — Purchase & Sales Manager.
  "customer-inquiry": ["Purchase & Sales Manager"],
  "sales-quotation": ["Purchase & Sales Manager"],
  "sales-order": ["Purchase & Sales Manager"],
  "order-approval": ["Purchase & Sales Manager"],
  "delivery-challan": ["Purchase & Sales Manager"],
  "tax-invoice": ["Purchase & Sales Manager"],
  "dispatch": ["Purchase & Sales Manager"],
  "payment-collection": ["Purchase & Sales Manager"],
  "receipt": ["Purchase & Sales Manager"],
  "sales-close": ["Purchase & Sales Manager"],

  // Returns & Credit Notes (Phase 15). Dual ownership is genuine here,
  // not hedging: accepting a return is a commercial decision (Purchase &
  // Sales Manager), but physically booking the goods back into a
  // warehouse is stores work (Inventory Controller) — the same "both
  // departments really do need this page" reasoning Budget vs. Actual
  // and AP/AR Aging already use.
  "sales-return": ["Purchase & Sales Manager", "Inventory Controller"],
  // Credit Note is Sales + FINANCE, not Sales + Inventory: no goods move
  // here, but a real journal entry posts on issue, which is finance work.
  "credit-note": ["Purchase & Sales Manager", "Finance Executive"],
  // Purchase Return is Procurement + Inventory, the mirror of Sales
  // Return's own Sales + Inventory pairing: deciding goods go back to a
  // vendor is procurement's call, physically sending them out of a
  // warehouse is stores work. "Purchase & Sales Manager" is the SAME
  // role GRN, PO, PR and Invoice Verification all already use for
  // Procurement, checked here rather than reaching for the unused
  // "Procurement Officer" entry in the role vocabulary — that role
  // exists in the master list but isn't assigned to a single page or
  // seeded user anywhere in this project, so wiring a new page to it
  // would have been a real access dead-end for every trainee account.
  "purchase-return": ["Purchase & Sales Manager", "Inventory Controller"],
  // Debit Note is Procurement + FINANCE, not Procurement + Inventory —
  // mirrors Credit Note's own Sales + Finance pairing (no goods move
  // here, but a real journal entry posts on issue).
  "debit-note": ["Purchase & Sales Manager", "Finance Executive"],

  // Finance & Accounting (Phase 6).
  "chart-of-accounts": ["Finance Executive"],
  "journal-entry": ["Finance Executive"],
  "general-ledger": ["Finance Executive"],
  "trial-balance": ["Finance Executive"],
  "profit-and-loss": ["Finance Executive"],
  "balance-sheet": ["Finance Executive"],
  "ap-aging": ["Finance Executive", "Purchase & Sales Manager"],
  "ar-aging": ["Finance Executive", "Purchase & Sales Manager"],
  "bank-reconciliation": ["Finance Executive"],
  "posting-rules": ["Finance Executive"],

  // Inventory Management (Phase 7).
  "opening-stock": ["Inventory Controller"],
  "stock-ledger": ["Inventory Controller"],
  "stock-adjustment": ["Inventory Controller"],
  "stock-transfer": ["Inventory Controller"],
  "stock-valuation": ["Inventory Controller", "Finance Executive"],
  "low-stock": ["Inventory Controller", "Purchase & Sales Manager"],

  // Cross-Module Reporting & Dashboard (Phase 8) — Dashboard itself is
  // universal (above); these four standalone reports are Finance's own
  // domain in this role model, with the two directly-operational ones
  // (each department's own activity register) also open to the
  // department it reports on.
  "sales-register": ["Finance Executive", "Purchase & Sales Manager"],
  "purchase-register": ["Finance Executive", "Purchase & Sales Manager"],
  "gst-summary": ["Finance Executive"],
  // GSTR-1 is a real filing, not just a reconciliation view — Finance
  // Executive only, the same role GST Summary itself already uses.
  "gstr1": ["Finance Executive"],
  // GSTR-3B is a real filing too, and reads across both Sales and
  // Procurement — Finance Executive only, matching GSTR-1 and GST
  // Summary's own established stance for filings.
  "gstr3b": ["Finance Executive"],
  // E-Invoice/IRN is Sales + Finance, not Finance-only like the two
  // filings above — Purchase & Sales Manager raises the invoice and is
  // the one who'd actually generate its IRN day to day; Finance
  // Executive still needs it for compliance oversight.
  "e-invoice": ["Purchase & Sales Manager", "Finance Executive"],
  // E-Way Bill matches Dispatch's own role exactly — checked directly
  // (grn and dispatch both use "Purchase & Sales Manager" alone, not
  // "Inventory Controller" as an earlier draft of this comment wrongly
  // assumed before being verified against the real file). This module
  // is built FROM Dispatch, so the same single role follows it here.
  "e-way-bill": ["Purchase & Sales Manager"],
  "inventory-valuation": ["Finance Executive", "Inventory Controller"],

  // HR & Payroll (Phase 9).
  "attendance": ["HR Manager"],
  "leave": ["HR Manager"],
  "salary-structure": ["HR Manager"],
  "payroll": ["HR Manager"],

  // Manufacturing (Phase 10) — grouped with Inventory Controller, the
  // same real-world pairing (warehouse + shop floor under one operations
  // head) the file header's own role-model reasoning already explains.
  "bill-of-materials": ["Inventory Controller"],
  "work-order": ["Inventory Controller"],
  "material-issue": ["Inventory Controller"],
  "finished-goods-receipt": ["Inventory Controller"],

  // Fixed Assets (Phase 12) — Finance Executive, the same real-world
  // ownership call this project already made for Cost Centers: asset
  // accounting and depreciation are core finance/accounting functions,
  // not a Procurement or Inventory concern despite physically involving
  // equipment/vehicles/machinery.
  "asset-register": ["Finance Executive"],
  "depreciation-schedule": ["Finance Executive"],
  "depreciation-run": ["Finance Executive"],
  "asset-disposal": ["Finance Executive"],

  // Budgeting & Forecasting (Phase 13) — Finance Executive owns the
  // budget itself; Budget vs. Actual is additionally open to Purchase &
  // Sales, the same overlap reasoning Purchase Register and Sales
  // Register already use (a department head genuinely needs to see
  // performance against their own budget, not just the finance team).
  "budget-master": ["Finance Executive"],
  "budget-vs-actual": ["Finance Executive", "Purchase & Sales Manager"],

  // CRM (Phase 14) — Purchase & Sales Manager owns all three: leads,
  // post-sale support and customer contracts are all customer-facing
  // commercial work, the same functional-ownership call that put every
  // Phase 5 Sales module with this role.
  "lead-pipeline": ["Purchase & Sales Manager"],
  "support-tickets": ["Purchase & Sales Manager"],
  "contracts": ["Purchase & Sales Manager"],

  // Project Accounting (Phase 18). Sales + Finance, mirroring Sales
  // Return / Credit Note's own dual-ownership reasoning: a project
  // engagement is commercial (Purchase & Sales Manager runs the client
  // relationship), but budget/variance is genuinely finance's concern.
  "project": ["Purchase & Sales Manager", "Finance Executive"],

  // Time Tracking is HR-adjacent (an employee logs it, a manager
  // approves it) rather than Sales/Finance — matching HR Manager's own
  // role on Attendance/Leave Application, checked directly before
  // reusing it here.
  "time-tracking": ["HR Manager"]
};

const ERP_RbacRepository = {
  roles: ERP_RBAC_ROLES,
  adminRole: ERP_RBAC_ADMIN_ROLE,
  viewerRole: ERP_RBAC_VIEWER_ROLE,

  isAdmin(role) { return role === ERP_RBAC_ADMIN_ROLE; },
  isViewer(role) { return role === ERP_RBAC_VIEWER_ROLE; },
  shortLabel(role) { return ERP_RBAC_ROLE_SHORT_LABELS[role] || role || "Unknown"; },

  /** True if `role` can open `pageKey` at all. Admin always can. Viewer
      always can (see file header — the deliberately opposite shape from
      the four functional roles). An unlisted pageKey fails CLOSED
      (Admin-only), with a console warning, rather than silently opening
      — see file header's own "new standing rule" note. */
  canAccessPage(role, pageKey) {
    if (this.isAdmin(role)) return true;
    if (this.isViewer(role)) return true;
    const entry = ERP_PAGE_ROLE_MAP[pageKey];
    if (entry === undefined) {
      console.warn(`[RBAC] "${pageKey}" isn't registered in ERP_PAGE_ROLE_MAP — defaulting to Admin-only. Add it as part of that module's own first version.`);
      return false;
    }
    if (entry === "*") return true;
    return entry.includes(role);
  },

  /** Every pageKey `role` can reach — drives sidebar link hiding. Admin
      and Viewer both get the full key list (see canAccessPage). */
  getAllowedPageKeys(role) {
    if (this.isAdmin(role) || this.isViewer(role)) return Object.keys(ERP_PAGE_ROLE_MAP);
    return Object.keys(ERP_PAGE_ROLE_MAP).filter((key) => this.canAccessPage(role, key));
  }
};
