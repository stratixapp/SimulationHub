/* =============================================================================
   DOT ERP — script.js
   CORE SHARED RUNTIME + LOGIN MODULE

   ARCHITECTURE NOTE (read this before adding a new page)
   This file is loaded by every page in the app. It is split into two
   halves:

     PART A — SHARED RUNTIME (sections 1-8)
       Utilities, toast notifications, the modal system, the boot loader, the
       training drawer mechanics, session helpers and the authenticated app
       shell (sidebar + topbar). Everything here is defensive: it checks an
       element exists before binding to it, so the same file works whether
       it's loaded on the pre-login index.html or an authenticated page under
       /pages/. This half is exposed on `window.ERP` so page-specific files
       (e.g. pages/dashboard.js) can reuse it without duplicating code.

     PART B — LOGIN MODULE (section 9)
       Everything specific to the sign-in screen. It only runs when
       <body data-page="login"> is present.

   A new module's own page (e.g. pages/dashboard.html) should link this file
   for the shared runtime, then link its OWN small script (e.g.
   pages/dashboard.js) for logic unique to that page, calling into
   `window.ERP` instead of re-implementing toasts/modals/etc.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     1. CONSTANTS & DOM HELPERS
     --------------------------------------------------------------------- */
  const STORAGE_KEYS = {
    auditLog: "erp_login_audit_log",
    rememberedUsername: "erp_remembered_username",
    attempts: "erp_login_attempts",
    activeSession: "erp_active_session",       // sessionStorage
    sidebarCollapsed: "erp_sidebar_collapsed", // localStorage
    sidebarGroupsExpanded: "erp_sidebar_groups_expanded", // localStorage
    notificationsRead: "erp_notifications_read", // localStorage
    notificationsDismissed: "erp_notifications_dismissed", // localStorage
    customNotifications: "erp_custom_notifications", // localStorage
    profileActivityLog: "erp_profile_activity_log", // localStorage
    systemActivityLog: "erp_system_activity_log", // localStorage
    theme: "erp_theme_preference", // localStorage
    preferences: "erp_user_preferences" // localStorage
  };

  /* Module 5 (Settings) defaults. Every preference has a safe fallback so
     any page works fine even before a user has ever visited Settings. */
  const DEFAULT_PREFERENCES = {
    dateFormat: "DD_MON_YYYY",   // "DD_MON_YYYY" | "DD_MM_YYYY" | "MM_DD_YYYY"
    numberFormat: "en-IN",       // "en-IN" (1,24,500) | "en-US" (124,500)
    density: "comfortable",      // "comfortable" | "compact"
    sessionTimeoutMinutes: 30,   // 15 | 30 | 60 | 0 (0 = never)
    confirmLogout: true,
    notifyLowStock: true,
    notifyApprovals: true,
    notifyOnboarding: true,
    notifyCompliance: true,
    notifySystem: true
  };

  function getPreferences() {
    try {
      return { ...DEFAULT_PREFERENCES, ...(JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences)) || {}) };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }
  function savePreferences(partial) {
    const merged = { ...getPreferences(), ...partial };
    try { localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(merged)); } catch { /* storage unavailable */ }
    applyDensityPreference();
    return merged;
  }
  /** Applied on every page load — the one preference that needs to visibly
      affect layout everywhere, not just where it was set. */
  function applyDensityPreference() {
    document.body.classList.toggle("density-compact", getPreferences().density === "compact");
  }

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /* ---------------------------------------------------------------------
     1b. THEME (Module 08 — Theme Switcher)
     "light" | "dark" | "system" is stored; "system" resolves to whatever
     the OS currently prefers. Applied as <body data-theme="light|dark">,
     which is all every other CSS rule in this file needs to know about —
     see the dark-theme token overrides near the top of style.css.
     Called synchronously below (not inside DOMContentLoaded) so the
     correct theme is in place before the boot loader even fades out.
     --------------------------------------------------------------------- */
  function getThemePreference() {
    try { return localStorage.getItem(STORAGE_KEYS.theme) || "system"; }
    catch { return "system"; }
  }
  function getEffectiveTheme() {
    const pref = getThemePreference();
    if (pref === "dark" || pref === "light") return pref;
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  function applyTheme(preference) {
    if (preference) {
      try { localStorage.setItem(STORAGE_KEYS.theme, preference); } catch { /* storage unavailable */ }
    }
    const effective = getEffectiveTheme();
    document.body.setAttribute("data-theme", effective);
    window.dispatchEvent(new CustomEvent("erp:theme-changed", { detail: { theme: effective, preference: getThemePreference() } }));
    return effective;
  }
  // Apply immediately — script.js sits at the end of <body>, so document.body
  // already exists by the time this line runs, well before DOMContentLoaded.
  applyTheme();
  // If the user has chosen "System", follow the OS live if it changes while a tab is open.
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (getThemePreference() === "system") applyTheme();
    });
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  /** Auto-generated reference numbers, the way an ERP stamps every record. */
  function generateId(prefix) {
    const now = new Date();
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${datePart}-${timePart}-${rand}`;
  }

  function formatDateTime(date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = pad(date.getDate());
    const monthNum = pad(date.getMonth() + 1);
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = pad(date.getMinutes());
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    const format = getPreferences().dateFormat;
    let datePart;
    if (format === "DD_MM_YYYY") datePart = `${day}/${monthNum}/${year}`;
    else if (format === "MM_DD_YYYY") datePart = `${monthNum}/${day}/${year}`;
    else datePart = `${day} ${month} ${year}`; // DD_MON_YYYY, the default

    return `${datePart}, ${hours}:${minutes} ${ampm}`;
  }

  /** "5 min ago" / "Yesterday" style label — used by notification & activity feeds. */
  function formatRelativeTime(date) {
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay === 1) return "Yesterday";
    if (diffDay < 7) return `${diffDay} days ago`;
    return formatDateTime(date);
  }

  /** Full currency, grouped per the user's Number Format preference — e.g. ₹1,24,500 (Indian) or ₹124,500 (International). */
  function formatCurrency(amount) {
    const locale = getPreferences().numberFormat === "en-US" ? "en-US" : "en-IN";
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
    } catch {
      return "₹" + Math.round(amount).toLocaleString();
    }
  }

  /** Compact currency for chart labels, e.g. ₹1.24L / ₹3.2Cr (Indian) or ₹1.24M (International). */
  function formatCurrencyShort(amount) {
    const abs = Math.abs(amount);
    if (getPreferences().numberFormat === "en-US") {
      if (abs >= 1e6) return "₹" + (amount / 1e6).toFixed(2).replace(/\.00$/, "") + "M";
      if (abs >= 1e3) return "₹" + (amount / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
      return "₹" + Math.round(amount);
    }
    if (abs >= 1e7) return "₹" + (amount / 1e7).toFixed(2).replace(/\.00$/, "") + "Cr";
    if (abs >= 1e5) return "₹" + (amount / 1e5).toFixed(2).replace(/\.00$/, "") + "L";
    if (abs >= 1e3) return "₹" + (amount / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return "₹" + Math.round(amount);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }


  /* ---------------------------------------------------------------------
     2. TOAST NOTIFICATIONS
     --------------------------------------------------------------------- */
  const TOAST_ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/><path d="M7.5 12.5l3 3 6-6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    danger: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v5M12 16v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 21 19H3L12 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9.5v4M12 16.5v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v5.5M12 8v.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };
  const CLOSE_SVG_SM = '<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  function showToast(message, type, options) {
    type = type || "info";
    options = options || {};
    const container = $("#toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
      <div class="toast__body">
        ${options.title ? `<p class="toast__title">${escapeHtml(options.title)}</p>` : ""}
        <p class="toast__message">${escapeHtml(message)}</p>
      </div>
      <button type="button" class="toast__close" aria-label="Dismiss notification">${CLOSE_SVG_SM}</button>
    `;
    container.appendChild(toast);

    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      toast.classList.add("is-leaving");
      setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector(".toast__close").addEventListener("click", remove);
    setTimeout(remove, options.duration || 4200);
  }


  /* ---------------------------------------------------------------------
     3. GENERIC MODAL SYSTEM + CONFIRMATION DIALOG
     Every page includes its own <div class="modal-overlay" id="..."> markup
     (static HTML can't be "included" without a backend), but the open/close
     mechanics below are written once and reused everywhere.

     PHASE 11 RBAC ADDITION — the Viewer role's own universal action
     lockdown is enforced RIGHT HERE, not in any individual module. Every
     "New X" / "Edit" form and every special-purpose mutating modal
     (Reject reason, Mark Paid, Confirm-with-date, and so on) across every
     module in this project opens through this one function; every
     destructive/state-changing action goes through openConfirm() one
     level below it (Section 2's own Rule 3). Blocking Viewer HERE, once,
     reaches all of it with zero changes to any of those modules' own
     files — see data/rbac-data.js's own header for the full reasoning,
     including the one specific, named case (Vendor Selection's own
     inline per-row decision UI) this approach doesn't reach and why that
     one was retrofitted directly instead.

     `VIEWER_ALLOWED_MODAL_IDS` is a real, audited allow-list, not a
     guess: every modal id across every module in this project (143 of
     them) was checked by hand. Most already end in "DetailModal" (a
     read-only view — always allowed) or "FormModal" (create/edit —
     always blocked); the handful with their own bespoke names are listed
     individually below, each because it's genuinely read-only (a ledger
     drill-down, a FIFO layer view, a payslip) or, for
     `changePasswordModal`, because it's a personal account action on the
     signed-in user's OWN account, not a business-data mutation — the
     Viewer restriction is about business data, not locking someone out
     of their own login credentials.
     --------------------------------------------------------------------- */
  const VIEWER_ALLOWED_MODAL_IDS = [
    "confirmDialog", "changePasswordModal",
    "apaVendorModal", "araCustomerModal", "glLedgerModal",
    "lowStockModal", "payslipModal", "slLedgerModal", "svLayerModal"
  ];
  function currentRbacRole() {
    const session = getActiveSession();
    return session ? session.role : null;
  }
  function isModalAllowedForViewer(id) {
    return id.endsWith("DetailModal") || VIEWER_ALLOWED_MODAL_IDS.includes(id);
  }
  function blockForViewer() {
    showToast("The read-only role can browse and run reports, but can't save, post, approve or delete anything.", "warning", { title: "Read-only role" });
  }

  function openModal(id) {
    if (typeof ERP_RbacRepository !== "undefined" && ERP_RbacRepository.isViewer(currentRbacRole()) && !isModalAllowedForViewer(id)) {
      blockForViewer();
      return;
    }
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    const focusable = overlay.querySelector("input, button, [tabindex]");
    if (focusable) focusable.focus();
  }

  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.hidden = true;
    const anyOpen = $$(".modal-overlay").some((m) => !m.hidden);
    if (!anyOpen) document.body.style.overflow = "";
  }

  function bindModalGenerics() {
    $$(".modal-overlay").forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });
    $$("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      // .find() would return the FIRST open overlay in DOM order, which
      // is the one furthest back on screen once two modals are nested
      // (Purchase Requisition's Detail modal + its Line Item modal, the
      // first case in this codebase where that happens) — take the LAST
      // one instead, since equal z-index + later DOM position means it's
      // the topmost, visually frontmost modal.
      const openOverlays = $$(".modal-overlay").filter((m) => !m.hidden);
      const openOverlay = openOverlays[openOverlays.length - 1];
      if (openOverlay) { closeModal(openOverlay.id); return; }
      if ($("#trainingDrawer")?.classList.contains("is-open")) closeTrainingDrawer();
    });
  }

  let _confirmCallback = null;
  function openConfirm(opts) {
    // Account-security actions (change your own password, etc.) are always allowed, even for the
    // read-only role — being unable to change a temporary password would lock the account out for good.
    if (!opts.allowForViewer && typeof ERP_RbacRepository !== "undefined" && ERP_RbacRepository.isViewer(currentRbacRole())) {
      blockForViewer();
      return;
    }
    if (!$("#confirmDialog")) return;
    $("#confirmTitle").textContent = opts.title || "Are you sure?";
    $("#confirmMessage").textContent = opts.message || "";
    $("#confirmOkBtn").textContent = opts.confirmLabel || "Confirm";
    _confirmCallback = opts.onConfirm || null;
    openModal("confirmDialog");
  }
  function bindConfirmDialog() {
    const okBtn = $("#confirmOkBtn");
    const cancelBtn = $("#confirmCancelBtn");
    if (!okBtn) return;
    okBtn.addEventListener("click", () => {
      closeModal("confirmDialog");
      const cb = _confirmCallback;
      _confirmCallback = null;
      if (cb) cb();
    });
    cancelBtn.addEventListener("click", () => {
      _confirmCallback = null;
      closeModal("confirmDialog");
    });
  }


  /* ---------------------------------------------------------------------
     4. BOOT LOADER
     Generic page loader. Each page can pass its own step list; falls back
     to a sensible default if none is given.
     --------------------------------------------------------------------- */
  const DEFAULT_BOOT_STEPS = [
    { p: 30, t: "Connecting to application server…" },
    { p: 70, t: "Preparing workspace…" },
    { p: 100, t: "Ready." }
  ];

  function runBootSequence(steps) {
    const bar = $("#bootProgressBar");
    const text = $("#bootLoaderText");
    const loader = $("#bootLoader");
    if (!bar || !text || !loader) return;

    const sequence = steps && steps.length ? steps : DEFAULT_BOOT_STEPS;
    let i = 0;
    (function next() {
      if (i >= sequence.length) {
        setTimeout(() => loader.classList.add("boot-loader--hidden"), 250);
        return;
      }
      const step = sequence[i++];
      bar.style.width = step.p + "%";
      text.textContent = step.t;
      setTimeout(next, 300);
    })();
  }


  /* ---------------------------------------------------------------------
     5. TRAINING GUIDE DRAWER
     Mechanics only — each page fills #trainingDrawer's body with its own
     Purpose / Business Process / Industry Usage / Tips / Mistakes / Best
     Practices content directly in its HTML.
     --------------------------------------------------------------------- */
  function openTrainingDrawer() {
    const drawer = $("#trainingDrawer");
    const backdrop = $("#drawerBackdrop");
    if (!drawer) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    if (backdrop) backdrop.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeTrainingDrawer() {
    const drawer = $("#trainingDrawer");
    const backdrop = $("#drawerBackdrop");
    if (!drawer) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (backdrop) backdrop.hidden = true;
    document.body.style.overflow = "";
  }
  function bindTrainingDrawer() {
    const fab = $("#trainingFabBtn");
    if (!fab) return;
    fab.addEventListener("click", openTrainingDrawer);
    $("#closeTrainingDrawer")?.addEventListener("click", closeTrainingDrawer);
    $("#drawerBackdrop")?.addEventListener("click", closeTrainingDrawer);
  }


  /* ---------------------------------------------------------------------
     6. SESSION HELPERS
     A session is created by the Login module and read by every
     authenticated page to know who is "signed in" and to guard access.
     --------------------------------------------------------------------- */
  function getActiveSession() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEYS.activeSession)); }
    catch { return null; }
  }
  function clearActiveSession() {
    sessionStorage.removeItem(STORAGE_KEYS.activeSession);
  }
  /** Call at the top of any authenticated page. Redirects to login if needed. */
  function requireSession(redirectUrl) {
    let session = getActiveSession();
    const home = redirectUrl || "../index.html";
    if (!session) {
      window.location.href = home;
      return null;
    }
    // The signed-in account must still exist and be active, and its role/name are always the live ones
    // (so a role change or deactivation by an administrator takes effect on the next page load).
    if (typeof ERP_UserRepository !== "undefined") {
      const acct = ERP_UserRepository.findByUsername(session.username);
      if (!acct || acct.status !== "Active") {
        sessionStorage.removeItem(STORAGE_KEYS.activeSession);
        window.location.href = home + (home.indexOf("?") < 0 ? "?reason=revoked" : "");
        return null;
      }
      if (acct.role !== session.role || acct.fullName !== session.fullName || acct.department !== session.department) {
        session = { ...session, role: acct.role, fullName: acct.fullName, department: acct.department };
        sessionStorage.setItem(STORAGE_KEYS.activeSession, JSON.stringify(session));
      }
      if (acct.mustChangePassword && !/\/profile\.html$/.test(window.location.pathname)) {
        window.location.href = "profile.html?forcePassword=1";
        return null;
      }
    }
    return session;
  }
  /** Patch the active session (e.g. after a Profile edit) and refresh the
      topbar/profile-menu display elements that mirror it, without a reload. */
  function updateActiveSession(partial) {
    const session = getActiveSession();
    if (!session) return null;
    const updated = { ...session, ...partial };
    sessionStorage.setItem(STORAGE_KEYS.activeSession, JSON.stringify(updated));
    const initials = (updated.fullName || "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    $$(".js-current-user-name").forEach((el) => (el.textContent = updated.fullName));
    $$(".js-current-user-role").forEach((el) => (el.textContent = updated.role));
    $$(".js-current-user-initials").forEach((el) => (el.textContent = initials));
    return updated;
  }

  /* ---------------------------------------------------------------------
     6a. ROLE-BASED ACCESS CONTROL — Phase 11.
     Called once, right after requireSession(), from every page's own
     boot sequence: `if (!window.ERP.enforcePageAccess(session, "pageKey"))
     return;` — the second page-gate alongside requireSession() itself,
     same calling convention, same early-bail-out shape. Typeof-guarded
     against `ERP_RbacRepository` throughout since script.js is the
     universal first script and must stay useful even on a page (like the
     login page itself) that never loads data/rbac-data.js at all.

     Does three things every time it's called: (1) hides every sidebar
     link/group the CURRENT role can't reach at all — cosmetic, but
     applies regardless of whether THIS page itself is accessible, since
     the sidebar markup is identical baked-in HTML on every page; (2)
     disables the small set of STATIC "create new" / "save" trigger
     buttons for the Viewer role (belt-and-suspenders alongside the
     openModal()/openConfirm() runtime block above — see that section's
     own header for why dynamically-rendered footer action buttons rely
     on that block alone, since they don't have stable ids to query
     generically); (3) checks whether the CURRENT page itself is allowed
     at all and, if not, redirects to the dashboard with an explanatory
     toast — the real gate, for anyone who reaches a restricted page
     directly by URL rather than through an already-hidden sidebar link.
     --------------------------------------------------------------------- */
  function applySidebarRbac(role) {
    if (typeof ERP_RbacRepository === "undefined") return;
    if (ERP_RbacRepository.isAdmin(role) || ERP_RbacRepository.isViewer(role)) return; // both see everything
    const allowed = ERP_RbacRepository.getAllowedPageKeys(role);
    $$(".sidebar-link[data-page-key]").forEach((link) => {
      link.hidden = !allowed.includes(link.dataset.pageKey);
    });
    $$(".sidebar-group").forEach((group) => {
      const links = $$(".sidebar-link[data-page-key]", group);
      const anyVisible = links.some((l) => !l.hidden);
      group.hidden = links.length > 0 && !anyVisible;
    });
  }
  function applyViewerLockdown(role) {
    if (typeof ERP_RbacRepository === "undefined" || !ERP_RbacRepository.isViewer(role)) return;
    $$('[id$="AddBtn"], [id$="SaveBtn"]').forEach((btn) => { btn.disabled = true; btn.title = "Viewer role is read-only"; });
  }
  function enforcePageAccess(session, pageKey) {
    const role = session ? session.role : null;
    applySidebarRbac(role);
    applyViewerLockdown(role);
    if (typeof ERP_RbacRepository === "undefined") return true; // this page never loaded the RBAC layer — nothing to enforce
    if (ERP_RbacRepository.canAccessPage(role, pageKey)) return true;
    showToast(`Your role (${role || "Unknown"}) doesn't have access to this module.`, "warning", { title: "Access restricted" });
    window.location.href = "dashboard.html";
    return false;
  }

  /* ---------------------------------------------------------------------
     6b. SESSION TIMEOUT (Module 5 — Security preference)
     Signs the user out automatically after N minutes of no mouse/keyboard/
     scroll activity, mirroring a real ERP's idle-session policy. Reset on
     every page load and every user interaction; "Never" (0) disables it.
     --------------------------------------------------------------------- */
  let _sessionTimeoutId = null;
  function bindSessionTimeout() {
    const minutes = getPreferences().sessionTimeoutMinutes;
    if (!minutes || minutes <= 0) return; // "Never"

    const fire = () => {
      clearActiveSession();
      window.location.href = "../index.html?reason=timeout";
    };
    const reset = () => {
      if (_sessionTimeoutId) clearTimeout(_sessionTimeoutId);
      _sessionTimeoutId = setTimeout(fire, minutes * 60000);
    };

    ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach((evt) => {
      document.addEventListener(evt, reset, { passive: true });
    });
    reset();
  }


  /* ---------------------------------------------------------------------
     7. SHARED NOTIFICATION FEED
     The topbar bell (every authenticated page) shows a short preview; the
     full Notification Center (Module 6) shows everything. Both read from
     the same merged source so marking something read/dismissed in one
     place is reflected in the other immediately.
     --------------------------------------------------------------------- */
  function getSystemNotifications() {
    const now = Date.now();
    const prefs = getPreferences();
    const all = [
      { id: "N1", type: "warning", title: "Low stock alert", message: "5 items have fallen below their reorder level.", minutesAgo: 12, prefKey: "notifyLowStock" },
      { id: "N2", type: "info", title: "Purchase order awaiting approval", message: "PO-20417 from Bansal Traders needs manager sign-off.", minutesAgo: 95, prefKey: "notifyApprovals" },
      { id: "N3", type: "info", title: "New employee onboarding", message: "Priya Nair's onboarding checklist is 80% complete.", minutesAgo: 240, prefKey: "notifyOnboarding" },
      { id: "N4", type: "warning", title: "GST filing due soon", message: "GSTR-3B for this period is due in 4 days.", minutesAgo: 1300, prefKey: "notifyCompliance" },
      { id: "N5", type: "success", title: "Daily backup completed", message: "Local training data snapshot completed successfully.", minutesAgo: 4200, prefKey: "notifySystem" }
    ];
    return all
      .filter((n) => prefs[n.prefKey] !== false)
      .map((n) => ({ ...n, time: new Date(now - n.minutesAgo * 60000), source: "system" }));
  }
  function getCustomNotifications() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(STORAGE_KEYS.customNotifications)) || []; } catch { /* ignore */ }
    return list.map((n) => ({ ...n, time: new Date(n.createdAt), source: "custom" }));
  }
  function getDismissedNotificationIds() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.notificationsDismissed)) || []; }
    catch { return []; }
  }
  function dismissNotification(id) {
    const ids = getDismissedNotificationIds();
    if (!ids.includes(id)) ids.push(id);
    localStorage.setItem(STORAGE_KEYS.notificationsDismissed, JSON.stringify(ids));
  }
  /** Full, deduplicated, dismissed-filtered feed — newest first. Used by
      both the bell preview and the Notification Center. */
  function getAllNotifications() {
    const dismissed = getDismissedNotificationIds();
    return [...getSystemNotifications(), ...getCustomNotifications()]
      .filter((n) => !dismissed.includes(n.id))
      .sort((a, b) => b.time - a.time);
  }
  function addCustomNotification({ type, title, message }) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(STORAGE_KEYS.customNotifications)) || []; } catch { /* ignore */ }
    const entry = { id: generateId("CN"), type, title, message, createdAt: new Date().toISOString() };
    list.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.customNotifications, JSON.stringify(list));
    return entry;
  }
  function updateCustomNotification(id, partial) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(STORAGE_KEYS.customNotifications)) || []; } catch { /* ignore */ }
    const idx = list.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...partial };
    localStorage.setItem(STORAGE_KEYS.customNotifications, JSON.stringify(list));
    return true;
  }

  function getReadNotificationIds() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.notificationsRead)) || []; }
    catch { return []; }
  }
  function markNotificationRead(id) {
    const ids = getReadNotificationIds();
    if (!ids.includes(id)) ids.push(id);
    localStorage.setItem(STORAGE_KEYS.notificationsRead, JSON.stringify(ids));
  }

  const BELL_PREVIEW_LIMIT = 5;
  function renderNotifications() {
    const list = $("#notificationList");
    const badge = $("#notificationBadge");
    if (!list) return;
    const notifications = getAllNotifications();
    const readIds = getReadNotificationIds();
    const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

    if (badge) {
      badge.textContent = String(unreadCount);
      badge.hidden = unreadCount === 0;
    }

    const preview = notifications.slice(0, BELL_PREVIEW_LIMIT);
    if (!preview.length) {
      list.innerHTML = `<li class="notif-item notif-item--empty">You're all caught up.</li>`;
      return;
    }
    list.innerHTML = preview.map((n) => `
      <li class="notif-item ${readIds.includes(n.id) ? "" : "is-unread"}">
        <span class="notif-dot notif-dot--${n.type}"></span>
        <div>
          <p class="notif-item__title">${escapeHtml(n.title)}</p>
          <p class="notif-item__message">${escapeHtml(n.message)}</p>
          <p class="notif-item__time">${formatRelativeTime(n.time)}</p>
        </div>
      </li>
    `).join("");
  }
  function bindNotifications() {
    const markAllBtn = $("#markAllReadBtn");
    if (!markAllBtn) return;
    markAllBtn.addEventListener("click", () => {
      const ids = getAllNotifications().map((n) => n.id);
      localStorage.setItem(STORAGE_KEYS.notificationsRead, JSON.stringify(ids));
      renderNotifications();
      showToast("All notifications marked as read.", "success");
    });
  }


  /* ---------------------------------------------------------------------
     7c. SYSTEM ACTIVITY LOG (Module 7)
     A generic, append-only logger any module can write to — this is
     deliberately the ONLY way entries get added; there is no edit and no
     per-row delete, because a real audit trail must be tamper-evident.
     The Activity Log page presents this merged with the specialized Login
     (Module 1) and Profile (Module 4) logs so there is one true timeline.
     --------------------------------------------------------------------- */
  function logSystemActivity({ module, action, description, severity }) {
    const session = getActiveSession();
    let log = [];
    try { log = JSON.parse(localStorage.getItem(STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const entry = {
      id: generateId("SYS"),
      timestamp: new Date().toISOString(),
      username: (session && session.username) || "system",
      module, action, description,
      severity: severity || "info"
    };
    log.unshift(entry);
    if (log.length > 300) log.length = 300;
    localStorage.setItem(STORAGE_KEYS.systemActivityLog, JSON.stringify(log));
    return entry;
  }

  function _loginLogAsActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(STORAGE_KEYS.auditLog)) || []; } catch { /* ignore */ }
    return log.map((e) => {
      let action, description, severity;
      if (e.status === "SUCCESS") { action = "Sign In"; description = `Signed in successfully (${e.device})`; severity = "info"; }
      else if (e.status === "FAILED") { action = "Failed Sign In"; description = `Failed sign-in attempt (${e.device})`; severity = "warning"; }
      else { action = "Password Reset"; description = "Requested a password reset link"; severity = "info"; }
      return { id: e.id, timestamp: e.timestamp, username: e.username, module: "Authentication", action, description, severity };
    });
  }
  function _profileLogAsActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(STORAGE_KEYS.profileActivityLog)) || []; } catch { /* ignore */ }
    return log.map((e) => {
      let action = "Update";
      if (/password/i.test(e.text)) action = "Security";
      else if (/photo/i.test(e.text)) action = "Photo";
      return { id: e.id, timestamp: e.timestamp, username: e.username, module: "Profile", action, description: e.text, severity: "info" };
    });
  }
  function _systemLogAsActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    return log.map((e) => ({ id: e.id, timestamp: e.timestamp, username: e.username, module: e.module, action: e.action, description: e.description, severity: e.severity || "info" }));
  }
  /** The single merged, newest-first timeline that Module 7 displays. */
  function getUnifiedActivityLog() {
    return [..._loginLogAsActivity(), ..._profileLogAsActivity(), ..._systemLogAsActivity()]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  /** Wipes all three underlying stores — used only by Module 7's "Clear Log". */
  function clearUnifiedActivityLog() {
    localStorage.removeItem(STORAGE_KEYS.auditLog);
    localStorage.removeItem(STORAGE_KEYS.profileActivityLog);
    localStorage.removeItem(STORAGE_KEYS.systemActivityLog);
  }


  /* ---------------------------------------------------------------------
     7b. SIDEBAR NAVIGATION (Module 3)
     Generic tree controller: works on whatever .sidebar-group / .sidebar-link
     markup a page provides. A link's [data-page-key] is matched against
     <body data-page="..."> to set the active state and auto-expand its
     group; group expand/collapse state persists per browser. Search filters
     every link across every group at once, restoring the persisted state
     when cleared.
     --------------------------------------------------------------------- */
  function bindSidebarNav() {
    const nav = $(".sidebar-nav");
    if (!nav) return;

    const allLinks = $$(".sidebar-link", nav);
    const groups = $$(".sidebar-group", nav);
    const searchInput = $("#sidebarSearchInput");
    const emptyState = $("#sidebarSearchEmpty");
    const currentPage = document.body.dataset.page;

    let activeGroupKey = null;
    allLinks.forEach((link) => {
      if (link.dataset.pageKey && link.dataset.pageKey === currentPage) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
        const parentGroup = link.closest(".sidebar-group");
        if (parentGroup) activeGroupKey = parentGroup.dataset.groupKey;
      }
    });

    function applyPersistedState() {
      let expandedState = {};
      try { expandedState = JSON.parse(localStorage.getItem(STORAGE_KEYS.sidebarGroupsExpanded)) || {}; }
      catch { /* ignore malformed storage */ }
      groups.forEach((group) => {
        const key = group.dataset.groupKey;
        group.classList.toggle("is-expanded", key === activeGroupKey || expandedState[key] === true);
        group.hidden = false;
      });
      allLinks.forEach((l) => { l.hidden = false; });
      if (emptyState) emptyState.hidden = true;
    }

    applyPersistedState();

    groups.forEach((group) => {
      const header = group.querySelector(".sidebar-group__header");
      header?.addEventListener("click", () => {
        const wasCollapsed = document.body.classList.contains("sidebar-collapsed");
        if (wasCollapsed) {
          document.body.classList.remove("sidebar-collapsed");
          localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, "0");
        }
        const nowExpanded = wasCollapsed ? true : !group.classList.contains("is-expanded");
        group.classList.toggle("is-expanded", nowExpanded);
        let state = {};
        try { state = JSON.parse(localStorage.getItem(STORAGE_KEYS.sidebarGroupsExpanded)) || {}; }
        catch { /* ignore malformed storage */ }
        state[group.dataset.groupKey] = nowExpanded;
        localStorage.setItem(STORAGE_KEYS.sidebarGroupsExpanded, JSON.stringify(state));
      });
    });

    searchInput?.addEventListener("input", () => {
      const term = searchInput.value.trim().toLowerCase();
      if (!term) { applyPersistedState(); return; }

      let anyMatch = false;
      allLinks.forEach((link) => {
        const match = link.textContent.trim().toLowerCase().includes(term);
        link.hidden = !match;
        if (match) anyMatch = true;
      });
      groups.forEach((group) => {
        const hasVisible = $$(".sidebar-link", group).some((l) => !l.hidden);
        group.hidden = !hasVisible;
        if (hasVisible) group.classList.add("is-expanded");
      });
      if (emptyState) emptyState.hidden = anyMatch;
    });
  }


  /* ---------------------------------------------------------------------
     8. AUTHENTICATED APP SHELL (sidebar + topbar)
     Binds only if #appSidebar is present, so this is a no-op on index.html.
     --------------------------------------------------------------------- */
  function bindAppShell() {
    const sidebar = $("#appSidebar");
    if (!sidebar) return;

    bindSidebarNav();

    // Mobile off-canvas sidebar ------------------------------------------
    const toggleBtn = $("#sidebarToggleBtn");
    const backdrop = $("#sidebarBackdrop");
    const openMobile = () => { sidebar.classList.add("is-open"); if (backdrop) backdrop.hidden = false; document.body.style.overflow = "hidden"; };
    const closeMobile = () => { sidebar.classList.remove("is-open"); if (backdrop) backdrop.hidden = true; document.body.style.overflow = ""; };
    toggleBtn?.addEventListener("click", () => (sidebar.classList.contains("is-open") ? closeMobile() : openMobile()));
    backdrop?.addEventListener("click", closeMobile);

    // Desktop collapse-to-icons, persisted --------------------------------
    const collapseBtn = $("#sidebarCollapseBtn");
    if (localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "1") {
      document.body.classList.add("sidebar-collapsed");
    }
    collapseBtn?.addEventListener("click", () => {
      const collapsed = document.body.classList.toggle("sidebar-collapsed");
      localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, collapsed ? "1" : "0");
    });

    // Quick theme toggle (Module 8 — full options live on the Theme Switcher page)
    const themeBtn = $("#themeToggleBtn");
    const THEME_ICONS = {
      light: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2.3M12 19.2v2.3M21.5 12h-2.3M4.8 12H2.5M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
      dark: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
      system: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="1.6" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 20h7M12 16.5V20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
    };
    const THEME_LABEL = { light: "Light theme — click for Dark", dark: "Dark theme — click for System", system: "System theme — click for Light" };
    function updateThemeToggleIcon() {
      if (!themeBtn) return;
      const pref = getThemePreference();
      themeBtn.innerHTML = THEME_ICONS[pref] || THEME_ICONS.system;
      themeBtn.setAttribute("aria-label", THEME_LABEL[pref] || "Change theme");
      themeBtn.title = THEME_LABEL[pref] || "Change theme";
    }
    themeBtn?.addEventListener("click", () => {
      const next = { light: "dark", dark: "system", system: "light" }[getThemePreference()] || "light";
      applyTheme(next);
      updateThemeToggleIcon();
    });
    updateThemeToggleIcon();

    // Topbar dropdowns (notifications + profile) --------------------------
    const notifBtn = $("#notificationBtn");
    const notifPanel = $("#notificationDropdown");
    const profileBtn = $("#profileBtn");
    const profilePanel = $("#profileDropdown");

    const closeAllPanels = (except) => {
      [notifPanel, profilePanel].forEach((p) => { if (p && p !== except) p.hidden = true; });
    };
    notifBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = notifPanel.hidden;
      closeAllPanels();
      notifPanel.hidden = !willOpen;
    });
    profileBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = profilePanel.hidden;
      closeAllPanels();
      profilePanel.hidden = !willOpen;
    });
    document.addEventListener("click", () => closeAllPanels());
    [notifPanel, profilePanel].forEach((p) => p?.addEventListener("click", (e) => e.stopPropagation()));

    renderNotifications();
    bindNotifications();

    // Populate signed-in user info from session ---------------------------
    const session = getActiveSession();
    if (session) {
      const initials = (session.fullName || "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
      $$(".js-current-user-name").forEach((el) => (el.textContent = session.fullName));
      $$(".js-current-user-role").forEach((el) => (el.textContent = session.role));
      $$(".js-current-user-initials").forEach((el) => (el.textContent = initials));
    }

    // Logout (respects the "confirm before sign out" preference from Settings)
    $("#logoutBtn")?.addEventListener("click", () => {
      const doLogout = () => {
        clearActiveSession();
        window.location.href = "../index.html";
      };
      if (getPreferences().confirmLogout) {
        openConfirm({
          title: "Sign out of Dot ERP?",
          message: "You'll need to sign in again to access the training workspace.",
          confirmLabel: "Sign out",
          onConfirm: doLogout
        });
      } else {
        doLogout();
      }
    });

    // Nav items not built yet: explain rather than fail silently ----------
    $$("[data-not-built]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        showToast(`${el.dataset.notBuilt} isn't available yet.`, "info", { title: "Coming soon" });
      });
    });

    bindSessionTimeout();
  }


  /* ---------------------------------------------------------------------
     Shared validation constants (used by Login and by Profile's
     change-password form, so the rule lives in exactly one place)
     --------------------------------------------------------------------- */
  const PASSWORD_LIMITS = { min: 8, max: 64 };

  /* ---------------------------------------------------------------------
     Shared PAN/email patterns — previously redefined locally on Company
     Profile, Create Company, Employee Master, and Vendor Master (identical
     regex, four separate copies). Centralized here the moment a FIFTH
     module (Customer Master) was about to become a fifth copy — the same
     "shared behavior belongs in window.ERP, not copy-pasted per page" rule
     PASSWORD_LIMITS above already follows. GSTIN doesn't need an entry
     here: it already has exactly one home, ERP_GstRepository.gstinPattern/
     .deriveState, which every module needing GSTIN validation imports
     directly rather than going through window.ERP.
     --------------------------------------------------------------------- */
  const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---------------------------------------------------------------------
     Shared actorLabel() — previously a duplicated ~4-line function inside
     department-need-data.js, pr-data.js, rfq-data.js, and quotation-
     data.js (each doing the same "look up a username in ERP_UserRepository,
     render 'Full Name (Role)', fall back to the raw username" resolution
     for status-history display). Section 9 of CONTINUE_HERE.md flagged "a
     4th+ instance is the trigger to centralize" — po-data.js becoming a
     FIFTH copy is that trigger, the same one PAN_PATTERN/EMAIL_PATTERN
     above already followed for validation regexes. Centralized here
     rather than added as another local copy; the four existing modules
     keep their own local copies unchanged (still correct, no reason to
     touch already-shipped, already-validated code), but this is now the
     one real implementation to grep for going forward — po-data.js's own
     `actorLabel()` is just a one-line delegate to this.
     --------------------------------------------------------------------- */
  function actorLabel(username) {
    if (!username) return "—";
    if (typeof ERP_UserRepository === "undefined") return username;
    const user = ERP_UserRepository.findByUsername(username);
    return user ? `${user.fullName} (${user.role})` : username;
  }


  /* ---------------------------------------------------------------------
     Expose the shared runtime for page-specific scripts (e.g. dashboard.js)
     --------------------------------------------------------------------- */
  window.ERP = {
    $, $$, generateId, formatDateTime, formatRelativeTime, formatCurrency, formatCurrencyShort, escapeHtml,
    showToast, openModal, closeModal, openConfirm,
    runBootSequence, openTrainingDrawer, closeTrainingDrawer,
    getActiveSession, clearActiveSession, requireSession, updateActiveSession,
    enforcePageAccess,
    renderNotifications,
    getAllNotifications, getSystemNotifications, getCustomNotifications,
    addCustomNotification, updateCustomNotification,
    getReadNotificationIds, markNotificationRead,
    getDismissedNotificationIds, dismissNotification,
    logSystemActivity, getUnifiedActivityLog, clearUnifiedActivityLog,
    getPreferences, savePreferences, applyDensityPreference, defaultPreferences: DEFAULT_PREFERENCES,
    bindSessionTimeout,
    getThemePreference, getEffectiveTheme, applyTheme,
    passwordLimits: PASSWORD_LIMITS,
    panPattern: PAN_PATTERN,
    emailPattern: EMAIL_PATTERN,
    actorLabel,
    STORAGE_KEYS
  };


  /* Sign-in, first-run setup and password recovery live in assets/auth.js (loaded only by index.html). */


  /* =======================================================================
     APP INIT DISPATCHER
     ======================================================================= */
  document.addEventListener("DOMContentLoaded", () => {
    applyDensityPreference();
    bindModalGenerics();
    bindConfirmDialog();
    bindTrainingDrawer();
    bindAppShell();

  });
})();
