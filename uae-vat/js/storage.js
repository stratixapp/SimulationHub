/* ==========================================================================
   UAE VAT Return Filing Simulator (VAT201) — Training Edition
   storage.js — shared state model, localStorage layer, and common utilities
   Created By Ananthu Shaji
   ========================================================================== */

const VATSIM = (function () {
  "use strict";

  const NS = "vatsim_v1_";
  const GLOBAL_NS = "vatsim_global_";

  /* ---------------------------------------------------------------------
     Low level storage helpers
  --------------------------------------------------------------------- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.error("VATSIM storage read error", key, e);
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("VATSIM storage write error", key, e);
      const isQuotaError =
        e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || e.code === 1014);
      // A silently-dropped save is the worst kind of bug for a student to
      // hit — they'd submit a return, see success, then find it gone on
      // reload with no idea why. Surface it loudly instead. This can
      // realistically happen after many months of accumulated multi-
      // student data (photos especially), since localStorage is capped
      // per-browser (typically 5-10MB).
      toast(
        isQuotaError
          ? "⚠ Browser storage is full — this couldn't be saved. Go to Settings → Storage to see what's using space, or ask your instructor about clearing old student data."
          : "⚠ Could not save your changes — please try again, or use a different browser if this keeps happening.",
        "error"
      );
      return false;
    }
  }

  /* ---------------------------------------------------------------------
     Multi-Student Support — each student gets an isolated namespace
     (TRN/company/filings/everything) on the same browser. The very first
     student on a machine keeps the original un-suffixed namespace, so
     existing single-student installs need no migration at all; every
     student registered after that gets their own "vatsim_v1_<id>_"
     namespace. Which namespace is "active" is tracked in a small, always
     un-namespaced pointer key, so it survives regardless of which
     student is currently active.
  --------------------------------------------------------------------- */
  function getActiveStudentId() {
    return read(GLOBAL_NS + "active", "");
  }
  function setActiveStudentId(id) {
    write(GLOBAL_NS + "active", id || "");
  }
  function getStudentRegistry() {
    return read(GLOBAL_NS + "registry", []);
  }
  function saveStudentRegistry(list) {
    write(GLOBAL_NS + "registry", list);
  }
  function studentNamespace(id) {
    return NS + (id ? id + "_" : "");
  }
  /* Read one key from a specific student's namespace, regardless of who
     is currently active — used by the Instructor Roster to summarize
     every student without switching the active profile. */
  function readForStudent(id, key, fallback) {
    return read(studentNamespace(id) + key, fallback);
  }
  function registerNewStudent(account) {
    const registry = getStudentRegistry();
    const id = registry.length === 0 ? "" : "s" + (registry.length + 1) + Math.random().toString(36).slice(2, 5);
    registry.push({ id, email: account.email, companyName: account.companyName, trn: account.trn, addedAt: new Date().toISOString() });
    saveStudentRegistry(registry);
    setActiveStudentId(id);
    return id;
  }
  function switchActiveStudent(id) {
    setActiveStudentId(id);
  }
  /* Keep the registry's display fields (company name, TRN) in sync after
     the active student edits their profile or completes registration. */
  function syncActiveStudentRegistryEntry(account) {
    const activeId = getActiveStudentId();
    const registry = getStudentRegistry();
    let entry = registry.find((s) => s.id === activeId);
    if (!entry) {
      entry = { id: activeId, addedAt: new Date().toISOString() };
      registry.push(entry);
    }
    entry.email = account.email;
    entry.companyName = account.companyName;
    entry.trn = account.trn;
    saveStudentRegistry(registry);
  }

  const activeStudentId = getActiveStudentId();
  const CURRENT_NS = studentNamespace(activeStudentId);
  const KEYS = {
    ACCOUNT: CURRENT_NS + "account",
    SESSION: CURRENT_NS + "session",
    FILINGS: CURRENT_NS + "filings",
    SETTINGS: CURRENT_NS + "settings",
    MESSAGES: CURRENT_NS + "messages",
    AUTH_USERS: CURRENT_NS + "authusers",
    ACTIVITY: CURRENT_NS + "activity",
    EXCISE_FILINGS: CURRENT_NS + "excisefilings",
    VOLUNTARY_DISCLOSURES: CURRENT_NS + "voluntarydisclosures",
    INVOICES: CURRENT_NS + "invoices",
    TB_ATTEMPTS: CURRENT_NS + "tbattempts",
    UAE_PASS: CURRENT_NS + "uaepass",
    EMIRATES_ID: CURRENT_NS + "emiratesid",
  };

  /* A new student is registered on register.html, which has already
     computed the OLD active student's KEYS by the time we know we need a
     new namespace. So registration stages the finished account here
     (under a namespace-independent key) and switches the active pointer;
     whichever page loads next re-evaluates KEYS against the new
     namespace and this bootstrap step materializes the staged account
     into it — transparently, on the very next script load. */
  function stagePendingSignup(payload) {
    write(GLOBAL_NS + "pending_signup", payload);
  }
  (function bootstrapPendingSignup() {
    try {
      const pending = read(GLOBAL_NS + "pending_signup", null);
      if (!pending) return;
      write(GLOBAL_NS + "pending_signup", null);
      saveAccount(pending.account);
      const filings = generateInitialFilings(pending.account);
      generateInitialMessages(pending.account, filings);
      generateInitialAuthUsers(pending.account);
      (pending.extraMessages || []).forEach((m) => addMessage(m));
      if (pending.activityLog) logActivity(pending.activityLog.action, pending.activityLog.detail);
      setSession(pending.session);
    } catch (e) {
      // A failure here must never prevent VATSIM itself from finishing
      // construction — that would break every page, not just signup.
      console.error("VATSIM bootstrapPendingSignup failed", e);
    }
  })();

  /* ---------------------------------------------------------------------
     Formatting helpers
  --------------------------------------------------------------------- */
  function fmtAED(n) {
    const v = Number(n) || 0;
    return v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }
  function uid(prefix) {
    return (prefix || "ID") + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  }
  function pad(n, len) {
    return String(n).padStart(len, "0");
  }

  /* ---------------------------------------------------------------------
     Account (created at Sign Up — this is the ONLY place company /
     taxable-person data originates. Nothing is pre-filled beyond what
     the trainee themselves enters at signup.)
  --------------------------------------------------------------------- */
  function getAccount() {
    return read(KEYS.ACCOUNT, null);
  }
  function saveAccount(acc) {
    write(KEYS.ACCOUNT, acc);
  }
  function generateTRN() {
    let n = "";
    for (let i = 0; i < 15; i++) n += Math.floor(Math.random() * 10);
    return n;
  }
  /* Generates a realistically-formatted UAE Emirates ID: 784-YYYY-XXXXXXX-C.
     The check digit is computed with a weighted modulus-11 algorithm
     (the commonly documented approach for this ID format) so the same
     14 digits always produce the same check digit — useful if a
     "verify this ID" feature is ever added later. This is a training
     simulator: the number is realistic in shape but not a real,
     government-issued Emirates ID. */
  function emiratesIdCheckDigit(digits14) {
    const weights = [2, 7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2, 7];
    let sum = 0;
    for (let i = 0; i < 14; i++) sum += Number(digits14[i]) * weights[i];
    const remainder = sum % 11;
    const check = 11 - remainder;
    if (check === 10) return "0";
    if (check === 11) return "1";
    return String(check);
  }
  function generateEmiratesId(birthYear) {
    const year = birthYear || 1970 + Math.floor(Math.random() * 40);
    let middle = "";
    for (let i = 0; i < 7; i++) middle += Math.floor(Math.random() * 10);
    const digits14 = "784" + year + middle;
    const check = emiratesIdCheckDigit(digits14);
    return "784-" + year + "-" + middle + "-" + check;
  }

  /* ---------------------------------------------------------------------
     Session
  --------------------------------------------------------------------- */
  function getSession() {
    return read(KEYS.SESSION, null);
  }
  function setSession(s) {
    write(KEYS.SESSION, s);
  }
  function clearSession() {
    localStorage.removeItem(KEYS.SESSION);
  }
  function requireSession(redirectTo) {
    const s = getSession();
    if (!s) {
      window.location.href = redirectTo || "../login.html";
      return null;
    }
    return s;
  }

  /* ---------------------------------------------------------------------
     Settings (accessibility text size, admin/training extras)
  --------------------------------------------------------------------- */
  function getSettings() {
    return read(KEYS.SETTINGS, { textScale: 1, lang: "en" });
  }
  function saveSettings(s) {
    write(KEYS.SETTINGS, s);
  }
  function applyTextScale() {
    const s = getSettings();
    document.documentElement.style.fontSize = 14 * (s.textScale || 1) + "px";
  }

  /* ---------------------------------------------------------------------
     Storage usage estimate — localStorage is capped per-browser (usually
     5-10MB total for this origin, shared across every student on this
     machine). There's no reliable cross-browser API for the exact quota,
     so this reports actual bytes used (precise) against a conservative
     5MB assumption (a reasonable floor every major browser supports),
     so it under-promises rather than over-promises how much room is left.
  --------------------------------------------------------------------- */
  function getStorageUsageEstimate() {
    let usedBytes = 0;
    let vatsimKeys = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k) || "";
        usedBytes += (k ? k.length : 0) + v.length;
        if (k && k.indexOf("vatsim_") === 0) vatsimKeys++;
      }
    } catch (e) {
      return { usedBytes: 0, usedMB: "0.0", assumedTotalMB: 5, pctUsed: 0, vatsimKeys: 0, error: true };
    }
    const assumedTotalBytes = 5 * 1024 * 1024;
    return {
      usedBytes,
      usedMB: (usedBytes / (1024 * 1024)).toFixed(2),
      assumedTotalMB: 5,
      pctUsed: Math.min(100, Math.round((usedBytes / assumedTotalBytes) * 100)),
      vatsimKeys,
      error: false,
    };
  }

  /* ---------------------------------------------------------------------
     Taxable Person Selection — in the real EmaraTax portal, one UAE PASS
     login can be linked to several Taxable Person profiles, and a picker
     always appears after authentication, before any dashboard. The
     student's own registered company is the fully-featured one (every
     module operates on it exactly as before); the seeded demo companies
     below are deliberately read-only previews, not parallel data
     namespaces — clearly labeled as such rather than pretending to be a
     second fully-interactive company.
  --------------------------------------------------------------------- */
  const DEMO_COMPANIES = [
    {
      id: "demo1", name: "ABC Trading LLC", trn: "100123456700003", access: "Authorized User",
      activity: "General Trading", emirate: "Dubai",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 42500, box13: 18200, box14: 24300 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 38900, box13: 21100, box14: 17800 },
      ],
    },
    {
      id: "demo2", name: "XYZ Logistics LLC", trn: "100987654300004", access: "Authorized User",
      activity: "Logistics & Freight", emirate: "Abu Dhabi",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 61200, box13: 55400, box14: 5800 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 58700, box13: 60100, box14: -1400 },
      ],
    },
    {
      id: "demo3", name: "Dubai General Trading LLC", trn: "100555666700003", access: "Authorized User",
      activity: "Retail & Wholesale Trading", emirate: "Dubai",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 27650, box13: 9400, box14: 18250 },
        { period: "Q1 2026", status: "Overdue", dueDate: "2026-04-28", box12: 0, box13: 0, box14: 0 },
      ],
    },
    {
      id: "demo4", name: "Crystal Crown International", trn: "100112233400005", access: "Authorized User",
      activity: "Hospitality — Luxury hotels, resorts & hospitality", emirate: "Dubai",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 184500, box13: 96200, box14: 88300 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 171200, box13: 88900, box14: 82300 },
      ],
    },
    {
      id: "demo5", name: "VitaNova Pharmaceuticals", trn: "100223344500006", access: "Authorized User",
      activity: "Pharmaceuticals — Drug development, manufacturing & life sciences", emirate: "Abu Dhabi",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 52300, box13: 68900, box14: -16600 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 49100, box13: 71400, box14: -22300 },
      ],
    },
    {
      id: "demo6", name: "Hera Life Healthcare Solutions", trn: "100334455600007", access: "Authorized User",
      activity: "Healthcare — Healthcare services, medical technology & solutions", emirate: "Sharjah",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 19800, box13: 14200, box14: 5600 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 21100, box13: 15900, box14: 5200 },
      ],
    },
    {
      id: "demo7", name: "AS-GIEMC", trn: "100445566700008", access: "Authorized User",
      activity: "Industrial — Industrial equipment, engineering & heavy machinery", emirate: "Ajman",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 96400, box13: 61200, box14: 35200 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 89700, box13: 57300, box14: 32400 },
      ],
    },
    {
      id: "demo8", name: "ASDRC", trn: "100556677800009", access: "Authorized User",
      activity: "Defence & Aerospace — Defence systems, R&D and strategic technologies", emirate: "Umm Al Quwain",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 73200, box13: 79500, box14: -6300 },
        { period: "Q1 2026", status: "Overdue", dueDate: "2026-04-28", box12: 0, box13: 0, box14: 0 },
      ],
    },
    {
      id: "demo9", name: "ASG Medical Colleges", trn: "100667788900010", access: "Authorized User",
      activity: "Education / Healthcare — Medical colleges, hospitals & medical education", emirate: "Ras Al Khaimah",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 11400, box13: 8900, box14: 2500 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 10800, box13: 8100, box14: 2700 },
      ],
    },
    {
      id: "demo10", name: "Tapasya Fundamental Research Institute", trn: "100778899000011", access: "Authorized User",
      activity: "Research — Fundamental science and advanced research", emirate: "Fujairah",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 6200, box13: 9800, box14: -3600 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 5700, box13: 8900, box14: -3200 },
      ],
    },
    {
      id: "demo11", name: "TARDDC Australia", trn: "100889900100012", access: "Authorized User",
      activity: "R&D / Technology — Advanced research, development & technology", emirate: "Dubai",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 34600, box13: 41200, box14: -6600 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 31900, box13: 36400, box14: -4500 },
      ],
    },
    {
      id: "demo12", name: "ASAPWES", trn: "100990011200013", access: "Authorized User",
      activity: "Water / Infrastructure — Water purification and environmental systems", emirate: "Abu Dhabi",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 58900, box13: 39100, box14: 19800 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 54300, box13: 36700, box14: 17600 },
      ],
    },
    {
      id: "demo13", name: "Elan Fi", trn: "100001122300014", access: "Authorized User",
      activity: "Fashion — Apparel, fashion & lifestyle", emirate: "Sharjah",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 23400, box13: 11600, box14: 11800 },
        { period: "Q1 2026", status: "Overdue", dueDate: "2026-04-28", box12: 0, box13: 0, box14: 0 },
      ],
    },
    {
      id: "demo14", name: "ITMEC", trn: "100112200400015", access: "Authorized User",
      activity: "Mining — Mining, minerals & extraction", emirate: "Ajman",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 78600, box13: 52300, box14: 26300 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 74100, box13: 49800, box14: 24300 },
      ],
    },
    {
      id: "demo15", name: "Garuda Interstellar Mining", trn: "100223300500016", access: "Authorized User",
      activity: "Space / Mining — Planned extraterrestrial-resource exploration & mining", emirate: "Umm Al Quwain",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 4100, box13: 12900, box14: -8800 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 3600, box13: 10400, box14: -6800 },
      ],
    },
    {
      id: "demo16", name: "AS Continental Defense Network (AS-CDN)", trn: "100334400600017", access: "Authorized User",
      activity: "Defence — Strategic defence network and security operations", emirate: "Ras Al Khaimah",
      filings: [
        { period: "Q2 2026", status: "Submitted", dueDate: "2026-07-28", box12: 65900, box13: 47200, box14: 18700 },
        { period: "Q1 2026", status: "Submitted", dueDate: "2026-04-28", box12: 61300, box13: 44100, box14: 17200 },
      ],
    },
  ];
  function getDemoCompany(id) {
    return DEMO_COMPANIES.find((c) => c.id === id) || null;
  }
  function getSelectedTaxablePerson() {
    const s = getSettings();
    return s.selectedTaxablePerson || "own";
  }
  function setSelectedTaxablePerson(id) {
    const s = getSettings();
    s.selectedTaxablePerson = id;
    saveSettings(s);
  }

  /* ---------------------------------------------------------------------
     Filings
     A filing represents one VAT201 return period. Every numeric box the
     trainee is responsible for starts BLANK (0 / empty) — there is no
     pre-filled "answer key" data. The only figures shown as
     "auto-populated" (tourist-refund Box 2 and customs-import Box 6) are
     simulated integration feeds — exactly as the real portal pulls them
     from Planet Tax Free / UAE Customs — and are visible read-only via
     "View Details", never silently injected into the trainee's editable
     boxes.
  --------------------------------------------------------------------- */
  function getFilings() {
    return read(KEYS.FILINGS, []);
  }
  function saveFilings(list) {
    write(KEYS.FILINGS, list);
  }
  function getFiling(id) {
    return getFilings().find((f) => f.id === id) || null;
  }
  function upsertFiling(filing) {
    const list = getFilings();
    const idx = list.findIndex((f) => f.id === filing.id);
    if (idx === -1) list.push(filing);
    else list[idx] = filing;
    saveFilings(list);
    return filing;
  }
  function deleteFiling(id) {
    saveFilings(getFilings().filter((f) => f.id !== id));
  }

  /* A submitted return may still be corrected up to (and including) its
     due date — exactly like the real portal's "you can edit your
     submitted VAT return until the due date" rule. After the due date it
     becomes view-only (a Voluntary Disclosure would be needed in real
     life, which is out of scope for this training simulator). */
  function canEditFiling(filing) {
    if (!filing) return false;
    if (filing.status === "Draft") return true;
    if (filing.status === "Submitted") {
      const due = new Date(filing.period.dueDate + "T23:59:59");
      return new Date() <= due;
    }
    return false;
  }

  function blankBoxes() {
    return {
      // Box 1 — Standard rated supplies per emirate
      b1: {
        abudhabi: { amount: "", vat: "", adj: 0 },
        dubai: { amount: "", vat: "", adj: 0 },
        sharjah: { amount: "", vat: "", adj: 0 },
        ajman: { amount: "", vat: "", adj: 0 },
        uaq: { amount: "", vat: "", adj: 0 },
        rak: { amount: "", vat: "", adj: 0 },
        fujairah: { amount: "", vat: "", adj: 0 },
      },
      // Box 2 — Tourist refund scheme (simulated auto-populated integration feed)
      b2: { amount: 0, vat: 0, seeded: false },
      // Box 3 — Supplies subject to reverse charge (output side, trainee entered)
      b3: { amount: "", vat: "" },
      // Box 4 — Zero rated
      b4: { amount: "" },
      // Box 5 — Exempt
      b5: { amount: "" },
      // Box 6 — Goods imported into UAE (simulated Customs feed)
      b6: { amount: 0, vat: 0, seeded: false },
      // Box 7 — Adjustments to imported goods (trainee entered)
      b7: { amount: "", vat: "" },
      // Box 9 — Standard rated expenses
      b9: { amount: "", vat: "", adj: 0 },
      // Box 10 — Supplies subject to reverse charge (input recovery side)
      b10: { amount: "", vat: "" },
      profitMargin: null, // "Yes" | "No"
      notes: "",
    };
  }

  function newFilingSkeleton(account, period) {
    const today = new Date();
    return {
      id: uid("FIL"),
      status: "Draft", // Draft | Submitted
      period: period, // {taxYear, from, to, stagger, dueDate, taxYearEnd}
      boxes: blankBoxes(),
      currentStep: "return", // return | review
      createdAt: today.toISOString(),
      submittedAt: null,
      modifiedAt: null,
      referenceNumber: null,
      declaration: {
        firstNameEn: account ? account.firstNameEn : "",
        lastNameEn: account ? account.lastNameEn : "",
        firstNameAr: account ? account.firstNameAr : "",
        lastNameAr: account ? account.lastNameAr : "",
        countryCode: "+971",
        phone: account ? account.phone : "",
        email: account ? account.email : "",
        confirmed: false,
      },
      payment: null, // {method, ref, date, amount, status}
    };
  }

  /* Auto-generate the standard set of filing periods for a freshly
     registered taxable person — exactly how EmaraTax populates "My
     Filings" the first time you visit VAT > My Filings, rather than
     asking the trainee to pick dates themselves. Uses Stagger 2
     (quarterly) starting from the registration month, most recent
     period first, matching the real portal's Overdue/Draft pattern. */
  function generateInitialFilings(account) {
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function makePeriod(year, startMonthIdx) {
      const from = new Date(year, startMonthIdx, 1);
      const to = new Date(year, startMonthIdx + 3, 0);
      const due = new Date(to.getFullYear(), to.getMonth() + 1, 28);
      const taxYearEnd = new Date(to.getFullYear() + (to.getMonth() >= 11 ? 1 : 0), 11, 31);
      const fmt = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
      return {
        from: fmt(from), to: fmt(to), dueDate: fmt(due), taxYearEnd: fmt(taxYearEnd),
        stagger: "Stagger 2 – Quarterly (Jan to Dec)",
        taxYear: String(from.getFullYear()),
        label: MONTHS[from.getMonth()] + " " + from.getFullYear() + " – " + MONTHS[to.getMonth()] + " " + to.getFullYear(),
      };
    }
    const now = new Date();
    // Anchor to the most recently completed quarter, then step back three quarters.
    const anchorMonth = Math.floor(now.getMonth() / 3) * 3 - 3;
    const periods = [];
    for (let i = 0; i < 3; i++) {
      let m = anchorMonth - i * 3;
      let y = now.getFullYear();
      while (m < 0) { m += 12; y -= 1; }
      periods.push(makePeriod(y, m));
    }
    const filings = periods.map((p) => {
      const f = newFilingSkeleton(account, p);
      seedIntegrationFeeds(f);
      return f;
    });
    saveFilings(filings);
    return filings;
  }

  /* Rebuild the account's upcoming (Draft) filing periods for a chosen
     stagger — Stagger 1 (Monthly) or Stagger 2 (Quarterly) — while
     leaving already-Submitted returns untouched, exactly as switching
     stagger on the real portal only affects future periods. */
  function setFilingStagger(account, staggerType) {
    account.staggerType = staggerType; // "1" monthly | "2" quarterly
    saveAccount(account);

    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function makeMonthly(year, monthIdx) {
      const from = new Date(year, monthIdx, 1);
      const to = new Date(year, monthIdx + 1, 0);
      const due = new Date(year, monthIdx + 1, 28);
      const taxYearEnd = new Date(year + (monthIdx >= 11 ? 1 : 0), 11, 31);
      const fmt = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
      return {
        from: fmt(from), to: fmt(to), dueDate: fmt(due), taxYearEnd: fmt(taxYearEnd),
        stagger: "Stagger 1 – Monthly (Jan to Dec)",
        taxYear: String(year),
        label: MONTHS[monthIdx] + " " + year,
      };
    }
    function makeQuarterly(year, startMonthIdx) {
      const from = new Date(year, startMonthIdx, 1);
      const to = new Date(year, startMonthIdx + 3, 0);
      const due = new Date(to.getFullYear(), to.getMonth() + 1, 28);
      const taxYearEnd = new Date(to.getFullYear() + (to.getMonth() >= 11 ? 1 : 0), 11, 31);
      const fmt = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
      return {
        from: fmt(from), to: fmt(to), dueDate: fmt(due), taxYearEnd: fmt(taxYearEnd),
        stagger: "Stagger 2 – Quarterly (Jan to Dec)",
        taxYear: String(from.getFullYear()),
        label: MONTHS[from.getMonth()] + " " + from.getFullYear() + " – " + MONTHS[to.getMonth()] + " " + to.getFullYear(),
      };
    }

    const now = new Date();
    const newPeriods = [];
    if (staggerType === "1") {
      for (let i = 2; i >= 0; i--) {
        let m = now.getMonth() - i;
        let y = now.getFullYear();
        while (m < 0) { m += 12; y -= 1; }
        newPeriods.push(makeMonthly(y, m));
      }
    } else {
      const anchorMonth = Math.floor(now.getMonth() / 3) * 3 - 3;
      for (let i = 0; i < 3; i++) {
        let m = anchorMonth - i * 3;
        let y = now.getFullYear();
        while (m < 0) { m += 12; y -= 1; }
        newPeriods.unshift(makeQuarterly(y, m));
      }
    }

    const existing = getFilings();
    const keptSubmitted = existing.filter((f) => f.status === "Submitted");
    const overlaps = (p) => keptSubmitted.some((f) => !(p.to < f.period.from || p.from > f.period.to));
    const newDrafts = newPeriods
      .filter((p) => !overlaps(p))
      .map((p) => {
        const f = newFilingSkeleton(account, p);
        seedIntegrationFeeds(f);
        return f;
      });

    saveFilings(keptSubmitted.concat(newDrafts));
    logActivity("Settings", "Filing stagger changed to " + (staggerType === "1" ? "Stagger 1 (Monthly)" : "Stagger 2 (Quarterly)") + " — upcoming periods regenerated.");
    return getFilings();
  }

  /* Seed the simulated Box 2 / Box 6 integration data once per filing,
     deterministically from the filing id (NOT a fake pre-answered box —
     these values are read-only integration data exactly like the real
     portal, only editable via the training "View Details" adjustment
     the FTA portal itself exposes as Box 7). */
  function seedIntegrationFeeds(filing) {
    if (!filing.boxes.b2.seeded) {
      const seed = hashSeed(filing.id + "b2");
      const amt = 5000 + (seed % 40000);
      filing.boxes.b2.amount = round2(amt);
      filing.boxes.b2.vat = round2(amt * 0.05);
      filing.boxes.b2.seeded = true;
    }
    if (!filing.boxes.b6.seeded) {
      const seed = hashSeed(filing.id + "b6");
      const amt = 8000 + (seed % 90000);
      filing.boxes.b6.amount = round2(amt);
      filing.boxes.b6.vat = round2(amt * 0.05);
      filing.boxes.b6.seeded = true;
    }
    return filing;
  }
  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }
  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  /* ---------------------------------------------------------------------
     Calculations — mirrors the real VAT201 box logic
  --------------------------------------------------------------------- */
  function n(v) {
    const x = parseFloat(v);
    return isNaN(x) ? 0 : x;
  }

  function computeTotals(boxes) {
    const b1amt =
      n(boxes.b1.abudhabi.amount) +
      n(boxes.b1.dubai.amount) +
      n(boxes.b1.sharjah.amount) +
      n(boxes.b1.ajman.amount) +
      n(boxes.b1.uaq.amount) +
      n(boxes.b1.rak.amount) +
      n(boxes.b1.fujairah.amount);
    const b1vat =
      n(boxes.b1.abudhabi.vat) +
      n(boxes.b1.dubai.vat) +
      n(boxes.b1.sharjah.vat) +
      n(boxes.b1.ajman.vat) +
      n(boxes.b1.uaq.vat) +
      n(boxes.b1.rak.vat) +
      n(boxes.b1.fujairah.vat);

    const b2amt = n(boxes.b2.amount);
    const b2vat = n(boxes.b2.vat);
    const b3amt = n(boxes.b3.amount);
    const b3vat = n(boxes.b3.vat);
    const b4amt = n(boxes.b4.amount);
    const b5amt = n(boxes.b5.amount);
    const b6amt = n(boxes.b6.amount);
    const b6vat = n(boxes.b6.vat);
    const b7amt = n(boxes.b7.amount);
    const b7vat = n(boxes.b7.vat);

    // Box 1 Adjustment column (VAT Bad Debt Relief / commercial property sale
    // adjustments) — per the official FTA VAT Returns User Guide, this feeds
    // into Box 8's Adjustment total, which in turn feeds Box 12.
    const b1adj =
      n(boxes.b1.abudhabi.adj) + n(boxes.b1.dubai.adj) + n(boxes.b1.sharjah.adj) +
      n(boxes.b1.ajman.adj) + n(boxes.b1.uaq.adj) + n(boxes.b1.rak.adj) + n(boxes.b1.fujairah.adj);

    // Box 8 = total of boxes 1-7 (amount col only meaningful for 1,4,5; vat col sums 1,2,3,6,7)
    const box8amount = round2(b1amt + b4amt + b5amt + b6amt + b7amt);
    const box8vat = round2(b1vat - b2vat + b3vat + b6vat + b7vat);
    const box8adj = round2(b1adj);

    const b9amt = n(boxes.b9.amount);
    const b9vat = n(boxes.b9.vat);
    const b9adj = n(boxes.b9.adj);
    const b10amt = n(boxes.b10.amount);
    const b10vat = n(boxes.b10.vat);

    const box11amount = round2(b9amt + b10amt);
    const box11vat = round2(b9vat + b10vat);
    const box11adj = round2(b9adj);

    // Per the FTA VAT Returns User Guide: "Box 12 ... will be the sum of the
    // VAT and Adjustments columns in the Outputs section" and "Box 13 ...
    // sum of the VAT and Adjustments columns in the Inputs section." Both
    // Adjustment columns were previously captured from the form but never
    // included in these totals — fixed here.
    const box12 = round2(box8vat + box8adj); // total output tax due
    const box13 = round2(box11vat + box11adj); // total recoverable input tax
    const box14 = round2(box12 - box13); // payable (+) or refundable (-)

    return {
      b1amt, b1vat, b1adj, b2amt, b2vat, b3amt, b3vat, b4amt, b5amt, b6amt, b6vat, b7amt, b7vat,
      box8amount, box8vat, box8adj,
      b9amt, b9vat, b9adj, b10amt, b10vat,
      box11amount, box11vat, box11adj,
      box12, box13, box14,
      isRefund: box14 < 0,
    };
  }

  /* ---------------------------------------------------------------------
     My Correspondence — Inbox / Outbox / Archived / Drafts
     Messages are generated deterministically from real simulator events
     (registration, filing due dates, submissions, payments) — never
     random noise disconnected from the trainee's own actions.
  --------------------------------------------------------------------- */
  function getMessages() {
    return read(KEYS.MESSAGES, []);
  }
  function saveMessages(list) {
    write(KEYS.MESSAGES, list);
  }
  function addMessage(msg) {
    const list = getMessages();
    const full = Object.assign(
      {
        id: uid("MSG"),
        folder: "inbox", // inbox | outbox | archived | drafts
        category: "System Message",
        subject: "",
        from: "Federal Tax Authority",
        to: "",
        date: new Date().toISOString(),
        read: false,
        body: "",
        relatedFilingId: null,
      },
      msg
    );
    list.unshift(full);
    saveMessages(list);
    return full;
  }
  function markMessageRead(id, read) {
    const list = getMessages();
    const m = list.find((x) => x.id === id);
    if (m) m.read = read !== false;
    saveMessages(list);
  }
  function setMessageFolder(id, folder) {
    const list = getMessages();
    const m = list.find((x) => x.id === id);
    if (m) m.folder = folder;
    saveMessages(list);
  }
  function unreadMessageCount() {
    return getMessages().filter((m) => m.folder === "inbox" && !m.read).length;
  }

  /* Seed correspondence the moment a training account is created —
     mirrors what a freshly registered EmaraTax profile already has
     waiting in "My Correspondence": a registration notice, plus a
     due-date reminder for whichever seeded filing is soonest due. */
  function generateInitialMessages(account, filings) {
    const list = [];
    list.push({
      id: uid("MSG"), folder: "inbox", category: "FTA Notice",
      subject: "VAT Registration Confirmation — TRN " + account.trn,
      from: "Federal Tax Authority", to: account.email,
      date: account.createdAt, read: false,
      body:
        "Dear " + account.firstNameEn + ",\n\nThis confirms that " + account.companyName +
        " has been successfully registered for Value Added Tax (VAT) with Tax Registration Number (TRN) " +
        account.trn + ".\n\nYou are now required to file VAT returns (Form VAT201) for each tax period " +
        "according to your assigned filing frequency, and to settle any tax due by the stated due date.\n\n" +
        "This is a training simulator notice — no real registration has taken place.",
      relatedFilingId: null,
    });
    (filings || []).forEach((f) => {
      const due = new Date(f.period.dueDate);
      const daysLeft = Math.ceil((due - new Date()) / 86400000);
      if (daysLeft <= 30) {
        list.push({
          id: uid("MSG"), folder: "inbox", category: "Reminder Letter",
          subject: "VAT Return Reminder — Period " + f.period.label,
          from: "Federal Tax Authority", to: account.email,
          date: new Date().toISOString(), read: false,
          body:
            "Dear " + account.firstNameEn + ",\n\nThis is a reminder that your VAT return for the period " +
            fmtDate(f.period.from) + " to " + fmtDate(f.period.to) +
            " is due for submission by " + fmtDate(f.period.dueDate) +
            (daysLeft < 0 ? ". This period is now overdue." : ".") +
            "\n\nPlease log in to file your return and settle any tax due.",
          relatedFilingId: f.id,
        });
      }
    });
    saveMessages(list.concat(getMessages()));
    return list;
  }

  /* Called when a filing is submitted — appends a matched outbox +
     inbox pair so "My Correspondence" always mirrors what was just
     filed (no stale/mismatched totals, ever pulled live via
     computeTotals at render time in correspondence.js). */
  function addSubmissionCorrespondence(account, filing) {
    addMessage({
      folder: "outbox", category: "Submitted Return",
      subject: "VAT201 Return Submitted — Ref. " + filing.referenceNumber,
      from: account.email, to: "Federal Tax Authority",
      date: new Date().toISOString(), read: true,
      body: "VAT201 return for the period " + fmtDate(filing.period.from) + " to " + fmtDate(filing.period.to) + " was submitted.",
      relatedFilingId: filing.id,
    });
    addMessage({
      folder: "inbox", category: "FTA Notice",
      subject: "Acknowledgement of VAT201 Submission — Ref. " + filing.referenceNumber,
      from: "Federal Tax Authority", to: account.email,
      date: new Date().toISOString(), read: false,
      body:
        "Dear " + account.firstNameEn + ",\n\nWe acknowledge receipt of your VAT201 return, reference number " +
        filing.referenceNumber + ", for the period " + fmtDate(filing.period.from) + " to " +
        fmtDate(filing.period.to) + ".\n\nIf any tax is payable, please ensure payment is settled by the due date to avoid penalties.",
      relatedFilingId: filing.id,
    });
  }
  function addPaymentCorrespondence(account, filing) {
    addMessage({
      folder: "inbox", category: "FTA Notice",
      subject: "Payment Receipt Confirmation — " + filing.payment.ref,
      from: "Federal Tax Authority", to: account.email,
      date: new Date().toISOString(), read: false,
      body:
        "Dear " + account.firstNameEn + ",\n\nWe confirm receipt of your payment of AED " + fmtAED(filing.payment.amount) +
        " (Reference " + filing.payment.ref + ") against VAT201 return " + filing.referenceNumber + ".",
      relatedFilingId: filing.id,
    });
  }

  /* ---------------------------------------------------------------------
     User Authorization — authorized users, roles, permissions,
     approval history. The signed-in trainee is always listed as the
     Owner and cannot be removed or demoted (mirrors the real portal).
  --------------------------------------------------------------------- */
  const ROLES = {
    Owner: { label: "Owner", perms: ["view", "file", "submit", "pay", "manage_users", "manage_settings"] },
    Admin: { label: "Administrator", perms: ["view", "file", "submit", "pay", "manage_users"] },
    Manager: { label: "Tax Manager", perms: ["view", "file", "submit", "pay"] },
    Preparer: { label: "Return Preparer", perms: ["view", "file"] },
    Viewer: { label: "Viewer", perms: ["view"] },
  };
  function getAuthUsers() {
    return read(KEYS.AUTH_USERS, []);
  }
  function saveAuthUsers(list) {
    write(KEYS.AUTH_USERS, list);
  }
  function generateInitialAuthUsers(account) {
    const owner = {
      id: uid("USR"), name: account.firstNameEn + " " + account.lastNameEn,
      email: account.email, role: "Owner", status: "Active",
      addedAt: account.createdAt, isOwner: true,
    };
    saveAuthUsers([owner]);
    logActivity("User Authorization", owner.name + " set as Owner during registration.");
    return [owner];
  }
  function addAuthUser(u) {
    const list = getAuthUsers();
    const full = { id: uid("USR"), status: "Pending Approval", addedAt: new Date().toISOString(), isOwner: false, ...u };
    list.push(full);
    saveAuthUsers(list);
    logActivity("User Authorization", "Invited " + full.name + " (" + full.email + ") as " + ROLES[full.role].label + ".");
    return full;
  }
  function removeAuthUser(id) {
    const list = getAuthUsers();
    const u = list.find((x) => x.id === id);
    if (u && u.isOwner) return false;
    saveAuthUsers(list.filter((x) => x.id !== id));
    if (u) logActivity("User Authorization", "Removed " + u.name + " (" + u.email + ") from authorized users.");
    return true;
  }
  function approveAuthUser(id) {
    const list = getAuthUsers();
    const u = list.find((x) => x.id === id);
    if (u) {
      u.status = "Active";
      saveAuthUsers(list);
      logActivity("User Authorization", "Approved " + u.name + " (" + u.email + ") — now Active.");
    }
  }

  function getActivityLog() {
    return read(KEYS.ACTIVITY, []);
  }
  function logActivity(action, detail) {
    const list = getActivityLog();
    list.unshift({ id: uid("LOG"), ts: new Date().toISOString(), action, detail });
    write(KEYS.ACTIVITY, list.slice(0, 200));
  }

  /* ---------------------------------------------------------------------
     Excise Tax — registration, EX201-style return filing, rates.
     Rates verified current as of this build: 100% ad-valorem on tobacco,
     energy drinks, and e-smoking devices/liquids (Cabinet Decision No. 52
     of 2019). Sweetened drinks changed fundamentally on 1 January 2026
     under Cabinet Decision No. 197 of 2025 — the old flat 50%
     ad-valorem rate (which also covered "Carbonated Drinks" as its own
     category) was REPLACED by a tiered, per-litre volumetric tax based on
     sugar content per 100ml, and Carbonated Drinks stopped being a
     separate excise category at all. Filed monthly, due on the 15th of
     the following month. VAT still applies at 5% on top of the
     excise-inclusive price — shown here as an informational figure only;
     it does not feed into the VAT201 Box calculations.
  --------------------------------------------------------------------- */
  const EXCISE_CATEGORIES = [
    { key: "tobacco", label: "Tobacco Products", calcType: "advalorem", rate: 1.0 },
    { key: "energy", label: "Energy Drinks", calcType: "advalorem", rate: 1.0 },
    { key: "vape", label: "Electronic Smoking Devices & Liquids", calcType: "advalorem", rate: 1.0 },
    { key: "sweetened", label: "Sweetened Drinks (tiered by sugar content, AED/litre)", calcType: "volumetric-tiered" },
  ];
  const SWEETENED_TIERS = [
    { key: "low", label: "Low Sugar — under 5g per 100ml", ratePerLitre: 0 },
    { key: "medium", label: "Medium Sugar — 5g to under 8g per 100ml", ratePerLitre: 0.79 },
    { key: "high", label: "High Sugar — 8g per 100ml or more", ratePerLitre: 1.09 },
  ];
  function exciseRateFor(catKey) {
    const c = EXCISE_CATEGORIES.find((x) => x.key === catKey);
    return c && c.calcType === "advalorem" ? c.rate : 0;
  }
  function sweetenedTierRate(tierKey) {
    const t = SWEETENED_TIERS.find((x) => x.key === tierKey);
    return t ? t.ratePerLitre : 0;
  }

  function getExciseFilings() {
    return read(KEYS.EXCISE_FILINGS, []);
  }
  function saveExciseFilings(list) {
    write(KEYS.EXCISE_FILINGS, list);
  }
  function getExciseFiling(id) {
    return getExciseFilings().find((f) => f.id === id) || null;
  }
  function upsertExciseFiling(filing) {
    const list = getExciseFilings();
    const i = list.findIndex((f) => f.id === filing.id);
    filing.modifiedAt = new Date().toISOString();
    if (i === -1) list.push(filing);
    else list[i] = filing;
    saveExciseFilings(list);
    return filing;
  }

  function generateExciseTRN() {
    return "EX" + String(Math.floor(1e11 + Math.random() * 8.9e11));
  }

  /* Register the taxable person for Excise Tax — unlike VAT, there is no
     turnover threshold: anyone who imports, produces, or stockpiles
     excise goods must register regardless of revenue. */
  function registerForExcise(account, categories) {
    account.exciseRegistered = true;
    account.exciseTrn = generateExciseTRN();
    account.exciseRegistrationDate = todayISO();
    account.exciseCategories = categories || [];
    saveAccount(account);

    const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    function makeMonthPeriod(year, monthIdx) {
      const from = new Date(year, monthIdx, 1);
      const to = new Date(year, monthIdx + 1, 0);
      const due = new Date(year, monthIdx + 1, 15);
      const fmt = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
      return {
        from: fmt(from), to: fmt(to), dueDate: fmt(due),
        label: MONTHS[monthIdx] + " " + year,
      };
    }
    const now = new Date();
    const periods = [];
    for (let i = 2; i >= 0; i--) {
      let m = now.getMonth() - i;
      let y = now.getFullYear();
      while (m < 0) { m += 12; y -= 1; }
      periods.push(makeMonthPeriod(y, m));
    }
    const filings = periods.map((p) => ({
      id: uid("EXC"),
      period: p,
      status: "Draft",
      referenceNumber: null,
      lines: [],
      totalExcise: 0,
      vatOnExcise: 0,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      submittedAt: null,
      payment: null,
    }));
    saveExciseFilings(filings);

    logActivity("Excise Tax", "Registered for Excise Tax — TRN " + account.exciseTrn + ".");
    addMessage({
      folder: "inbox", category: "FTA Notice",
      subject: "Excise Tax Registration Confirmed — TRN " + account.exciseTrn,
      from: "Federal Tax Authority", to: account.email,
      date: new Date().toISOString(), read: false,
      body:
        "Dear " + account.firstNameEn + ",\n\nThis confirms registration of " + account.companyName +
        " for Excise Tax with Tax Registration Number (TRN) " + account.exciseTrn +
        ".\n\nYou are required to file an Excise Tax return (Form EX201) for each monthly tax period and settle any tax due by the 15th of the following month.\n\nThis is a training simulator notice — no real registration has taken place.",
    });
    return filings;
  }

  function computeExciseTotals(filing) {
    let totalExcise = 0;
    let goodsValue = 0;
    (filing.lines || []).forEach((l) => {
      const cat = EXCISE_CATEGORIES.find((c) => c.key === l.category);
      const qty = n(l.quantity);
      const price = n(l.unitPrice);
      const lineValue = round2(qty * price);
      let lineExcise;
      if (cat && cat.calcType === "volumetric-tiered") {
        const tierRate = sweetenedTierRate(l.sugarTier);
        lineExcise = round2(qty * tierRate); // quantity = litres for this category
        l.rate = tierRate;
      } else {
        const rate = exciseRateFor(l.category);
        lineExcise = round2(lineValue * rate);
        l.rate = rate;
      }
      l.exciseAmount = lineExcise;
      totalExcise += lineExcise;
      goodsValue += lineValue;
    });
    totalExcise = round2(totalExcise);
    const vatOnExcise = round2((goodsValue + totalExcise) * 0.05);
    return { totalExcise, goodsValue: round2(goodsValue), vatOnExcise };
  }

  /* ---------------------------------------------------------------------
     Penalty Reference Engine — Cabinet Decision No. 129 of 2025 (in force
     14 April 2026): AED 1,000 first late-filing offence / AED 2,000 for a
     repeat within 24 months; late payment accrues at a flat 14% per annum,
     calculated monthly (part-months count as a full month) on the unpaid
     balance. Applies automatically wherever a filing is overdue or was
     filed/paid late — Filings list, Dashboard, and the return itself.
  --------------------------------------------------------------------- */
  function isFilingLate(f) {
    const due = new Date(f.period.dueDate);
    if (f.status === "Submitted") return new Date(f.submittedAt) > due;
    return new Date() > due;
  }
  function isRepeatLateFiling(currentFiling, allFilings) {
    const filings = allFilings || getFilings();
    const cutoff = new Date(currentFiling.period.dueDate);
    cutoff.setMonth(cutoff.getMonth() - 24);
    return filings.some((f) => {
      if (f.id === currentFiling.id) return false;
      if (new Date(f.period.dueDate) >= new Date(currentFiling.period.dueDate)) return false;
      if (new Date(f.period.dueDate) < cutoff) return false;
      return isFilingLate(f);
    });
  }
  function computeFilingPenalty(filing, allFilings) {
    const result = { lateFiling: 0, latePayment: 0, total: 0, monthsLate: 0, isLateFiling: false, isLatePayment: false, repeat: false };
    if (!isFilingLate(filing)) return result;
    result.isLateFiling = true;
    result.repeat = isRepeatLateFiling(filing, allFilings);
    result.lateFiling = result.repeat ? 2000 : 1000;

    const t = computeTotals(filing.boxes);
    const payable = t.box14 > 0 ? t.box14 : 0;
    if (payable > 0) {
      const paidOnTime = filing.payment && filing.payment.status === "Paid" && new Date(filing.payment.date) <= new Date(filing.period.dueDate);
      if (!paidOnTime) {
        const endDate = filing.payment && filing.payment.status === "Paid" ? new Date(filing.payment.date) : new Date();
        const dueDate = new Date(filing.period.dueDate);
        const daysLate = Math.max(0, Math.ceil((endDate - dueDate) / 86400000));
        if (daysLate > 0) {
          result.isLatePayment = true;
          result.monthsLate = Math.ceil(daysLate / 30);
          result.latePayment = round2(payable * 0.14 * (result.monthsLate / 12));
        }
      }
    }
    result.total = round2(result.lateFiling + result.latePayment);
    return result;
  }

  /* ---------------------------------------------------------------------
     Post-submission review stage — a submitted return doesn't just sit
     there labelled "Submitted" forever; it moves through a live,
     time-based Under Review -> Processed -> Approved sequence, mirroring
     the real FTA's backend review (which in reality takes anywhere from
     hours to a few business days — here it's compressed into ~60 real
     seconds so a trainee can actually watch it happen). Purely a display
     computation: filing.status stays "Submitted" in the data model the
     whole time (editability / voluntary-disclosure rules key off that,
     unchanged), this just derives what stage to *show*.
  --------------------------------------------------------------------- */
  const REVIEW_STAGE_SECONDS = { review: 20, processed: 20, approved: 20 }; // 20+20+20 = 60s total
  function getFilingReviewStage(filing) {
    if (!filing || filing.status !== "Submitted" || !filing.submittedAt) return null;
    const elapsedSec = (Date.now() - new Date(filing.submittedAt).getTime()) / 1000;
    const t1 = REVIEW_STAGE_SECONDS.review;
    const t2 = t1 + REVIEW_STAGE_SECONDS.processed;
    if (elapsedSec < t1) {
      return { key: "review", label: "Under Review", pct: Math.min(100, (elapsedSec / t1) * 33.33), elapsedSec };
    }
    if (elapsedSec < t2) {
      return { key: "processed", label: "Processed", pct: 33.33 + ((elapsedSec - t1) / REVIEW_STAGE_SECONDS.processed) * 33.33, elapsedSec };
    }
    return { key: "approved", label: "Approved", pct: 100, elapsedSec };
  }
  /* Single shared status-badge decision used by dashboard/filings/
     liabilities/success so the live Under Review -> Processed -> Approved
     progression looks identical everywhere it's shown. Filings with no
     submittedAt (the seeded demo history, filed "in the past") skip
     straight to Approved rather than animating — they were never
     literally submitted during this session. */
  function filingStatusBadge(filing) {
    if (filing.status === "Submitted") {
      const stage = getFilingReviewStage(filing);
      if (stage) return { label: stage.label, dotClass: stage.key };
      return { label: "Approved", dotClass: "approved" };
    }
    const overdue = new Date(filing.period.dueDate) < new Date();
    return overdue ? { label: "Overdue", dotClass: "overdue" } : { label: "Draft", dotClass: "draft" };
  }

  /* ---------------------------------------------------------------------
     GIBAN settlement delay — MagnatiPay and eDebit confirm instantly in
     real life, but a GIBAN bank transfer genuinely doesn't reconcile with
     the FTA the moment it's sent; it settles roughly T+1. A payment
     record with method "GIBAN" is created with status "Processing" and a
     settleAt timestamp; this resolves what to actually show/treat it as
     right now, without ever mutating the stored record on read.
  --------------------------------------------------------------------- */
  const GIBAN_SETTLE_MS = 20000; // ~20 real seconds standing in for T+1
  function getEffectivePaymentStatus(record) {
    if (!record) return null;
    if (record.status !== "Processing") return record.status;
    if (record.settleAt && Date.now() >= record.settleAt) return "Paid";
    return "Processing";
  }
  function isPaymentSettled(record) {
    return getEffectivePaymentStatus(record) === "Paid";
  }
  function accountTotalPenalties(allFilings) {
    const filings = allFilings || getFilings();
    return filings.reduce(
      (sum, f) => {
        const p = computeFilingPenalty(f, filings);
        sum.total += p.total;
        if (p.total > 0) sum.count += 1;
        return sum;
      },
      { total: 0, count: 0 }
    );
  }

  /* ---------------------------------------------------------------------
     Voluntary Disclosure (Form VAT211) — lets the student correct a past
     Submitted return. Reuses computeTotals() by building a synthetic
     "corrected" boxes object (the Box 1 correction is entered as one
     aggregate figure rather than per-emirate, for simplicity) so the
     resulting Box 12/13/14 are calculated exactly the same way as the
     original VAT201 return, not by separate/duplicate math.
  --------------------------------------------------------------------- */
  function getVoluntaryDisclosures() {
    return read(KEYS.VOLUNTARY_DISCLOSURES, []);
  }
  function saveVoluntaryDisclosures(list) {
    write(KEYS.VOLUNTARY_DISCLOSURES, list);
  }
  function buildCorrectedBoxes(originalBoxes, corrected) {
    const cloned = JSON.parse(JSON.stringify(originalBoxes));
    cloned.b1 = {
      abudhabi: { amount: corrected.b1amount, vat: corrected.b1vat, adj: 0 },
      dubai: { amount: 0, vat: 0, adj: 0 },
      sharjah: { amount: 0, vat: 0, adj: 0 },
      ajman: { amount: 0, vat: 0, adj: 0 },
      uaq: { amount: 0, vat: 0, adj: 0 },
      rak: { amount: 0, vat: 0, adj: 0 },
      fujairah: { amount: 0, vat: 0, adj: 0 },
    };
    cloned.b3 = { amount: corrected.b3amount, vat: corrected.b3vat };
    cloned.b4 = { amount: corrected.b4amount };
    cloned.b5 = { amount: corrected.b5amount };
    cloned.b7 = { amount: corrected.b7amount, vat: corrected.b7vat };
    cloned.b9 = { amount: corrected.b9amount, vat: corrected.b9vat, adj: 0 };
    cloned.b10 = { amount: corrected.b10amount, vat: corrected.b10vat };
    return cloned;
  }
  /* Voluntary Disclosure penalty — Cabinet Decision No. 129 of 2025:
     a disclosure filed BEFORE any FTA audit notice attracts 1% per month
     on the tax difference (from the original due date to the disclosure
     date); one filed AFTER an audit notice attracts an additional fixed
     15% surcharge plus the same 1% per month. Only applies where the
     correction results in additional tax due (a refund correction has no
     late-payment-style penalty). */
  function computeVdPenalty(taxDifference, originalDueDate, vdDate, auditNotified) {
    if (taxDifference <= 0) return { applicable: false, monthsElapsed: 0, monthlyPortion: 0, surcharge: 0, total: 0 };
    const due = new Date(originalDueDate);
    const filed = new Date(vdDate);
    const daysElapsed = Math.max(0, Math.ceil((filed - due) / 86400000));
    const monthsElapsed = Math.max(1, Math.ceil(daysElapsed / 30));
    const monthlyPortion = round2(taxDifference * 0.01 * monthsElapsed);
    const surcharge = auditNotified ? round2(taxDifference * 0.15) : 0;
    return { applicable: true, monthsElapsed, monthlyPortion, surcharge, total: round2(monthlyPortion + surcharge) };
  }
  function addVoluntaryDisclosure(account, filing, correctedInputs, reason, auditNotified) {
    const originalTotals = computeTotals(filing.boxes);
    const correctedBoxes = buildCorrectedBoxes(filing.boxes, correctedInputs);
    const correctedTotals = computeTotals(correctedBoxes);
    const taxDifference = round2(correctedTotals.box14 - originalTotals.box14);
    const vdDate = new Date().toISOString();
    const penalty = computeVdPenalty(taxDifference, filing.period.dueDate, vdDate, auditNotified);

    const vd = {
      id: uid("VD"),
      filingId: filing.id,
      periodLabel: filing.period.label,
      referenceNumber: "DEMO-VD211-" + String(Math.floor(100000000 + Math.random() * 899999999)),
      reason: reason || "",
      auditNotified: !!auditNotified,
      originalBox12: originalTotals.box12,
      originalBox13: originalTotals.box13,
      originalBox14: originalTotals.box14,
      correctedBox12: correctedTotals.box12,
      correctedBox13: correctedTotals.box13,
      correctedBox14: correctedTotals.box14,
      taxDifference,
      penalty,
      submittedAt: vdDate,
    };
    const list = getVoluntaryDisclosures();
    list.unshift(vd);
    saveVoluntaryDisclosures(list);

    logActivity("Voluntary Disclosure", "Filed VD211 for " + filing.period.label + ", Ref. " + vd.referenceNumber + " — tax difference AED " + fmtAED(Math.abs(taxDifference)) + (taxDifference >= 0 ? " additional due" : " refundable") + (penalty.applicable ? ", VD penalty AED " + fmtAED(penalty.total) : "") + ".");
    addMessage({
      folder: "inbox", category: "FTA Notice",
      subject: "Voluntary Disclosure Received — Ref. " + vd.referenceNumber,
      from: "Federal Tax Authority", to: account.email,
      date: new Date().toISOString(), read: false,
      body:
        "Dear " + account.firstNameEn + ",\n\nWe acknowledge receipt of your Voluntary Disclosure (Form VAT211) relating to the VAT return for " +
        filing.period.label + ", reference number " + vd.referenceNumber + ".\n\nOriginal net tax: AED " + fmtAED(Math.abs(originalTotals.box14)) +
        (originalTotals.isRefund ? " (refundable)" : " (payable)") + "\nCorrected net tax: AED " + fmtAED(Math.abs(correctedTotals.box14)) +
        (correctedTotals.isRefund ? " (refundable)" : " (payable)") + "\nTax difference: AED " + fmtAED(Math.abs(taxDifference)) +
        (taxDifference >= 0 ? " additional payable" : " additional refundable") +
        (penalty.applicable
          ? "\n\nVoluntary Disclosure Penalty (Cabinet Decision No. 129 of 2025): AED " + fmtAED(penalty.total) +
            " (" + (auditNotified ? "15% fixed surcharge + " : "") + "1% per month × " + penalty.monthsElapsed + " month(s) on the tax difference)."
          : "\n\nNo Voluntary Disclosure penalty applies, as this correction does not result in additional tax due.") +
        "\n\nSettle any amount due promptly to limit further exposure.",
      relatedFilingId: filing.id,
    });
    return vd;
  }

  /* ---------------------------------------------------------------------
     Pure box-pair validator — mirrors the interactive checks in return.js
     (amount/VAT pairs must both be present or both blank; VAT can't
     exceed the taxable amount) but returns plain data instead of
     manipulating the DOM, so it can be reused for Instructor grading.
  --------------------------------------------------------------------- */
  const DEFAULT_EMIRATES = [
    ["abudhabi", "Abu Dhabi"], ["dubai", "Dubai"], ["sharjah", "Sharjah"],
    ["ajman", "Ajman"], ["uaq", "Umm Al Quwain"], ["rak", "Ras Al Khaimah"], ["fujairah", "Fujairah"],
  ];
  function validateBoxPairs(boxes) {
    const issues = [];
    function checkPair(amount, vat, label) {
      const hasAmt = amount !== "" && amount != null;
      const hasVat = vat !== "" && vat != null;
      if (hasAmt !== hasVat) issues.push(label + ": amount/VAT pair incomplete");
      else if (hasAmt && hasVat && n(vat) > n(amount)) issues.push(label + ": VAT exceeds taxable amount");
    }
    DEFAULT_EMIRATES.forEach(([key, label]) => checkPair(boxes.b1[key].amount, boxes.b1[key].vat, label));
    checkPair(boxes.b3.amount, boxes.b3.vat, "Box 3 (Reverse charge supplies)");
    checkPair(boxes.b7.amount, boxes.b7.vat, "Box 7 (Import adjustments)");
    checkPair(boxes.b9.amount, boxes.b9.vat, "Box 9 (Standard rated expenses)");
    checkPair(boxes.b10.amount, boxes.b10.vat, "Box 10 (Reverse charge purchases)");
    return issues;
  }

  /* ---------------------------------------------------------------------
     Instructor / Grading Mode — objectively scores the student's account.
     Every figure here is derived from the same data other pages already
     show (filings, penalties, VD filings) — nothing is a separate
     "grading-only" dataset, so the report can never drift from reality.
  --------------------------------------------------------------------- */
  function gradeAccount(source) {
    const filings = (source && source.filings) || getFilings();
    const total = filings.length || 0;
    const vds = (source && source.vds) || getVoluntaryDisclosures();

    let onTime = 0, submitted = 0, clean = 0, penaltyFree = 0;
    const detail = filings
      .slice()
      .sort((a, b) => new Date(a.period.from) - new Date(b.period.from))
      .map((f) => {
        const isSubmitted = f.status === "Submitted";
        const late = isFilingLate(f);
        const issues = isSubmitted ? validateBoxPairs(f.boxes) : [];
        const isClean = issues.length === 0;
        const penalty = computeFilingPenalty(f, filings);
        const vd = vds.find((v) => v.filingId === f.id);
        if (isSubmitted && !late) onTime++;
        if (isSubmitted) submitted++;
        if (!isSubmitted || isClean) clean++;
        if (penalty.total === 0) penaltyFree++;
        return {
          period: f.period.label, referenceNumber: f.referenceNumber || "—",
          status: isSubmitted ? "Submitted" : (new Date(f.period.dueDate) < new Date() ? "Overdue" : "Draft"),
          onTime: isSubmitted ? !late : null,
          issues, penalty: penalty.total,
          voluntaryDisclosure: vd ? { referenceNumber: vd.referenceNumber, taxDifference: vd.taxDifference } : null,
        };
      });

    const divisor = total || 1;
    const onTimeRate = round2((onTime / divisor) * 100);
    const completionRate = round2((submitted / divisor) * 100);
    const cleanRate = round2((clean / divisor) * 100);
    const penaltyFreeRate = round2((penaltyFree / divisor) * 100);
    // Voluntary Disclosure usage is scored as "clean" (100) unless a filing
    // carries a nonzero unresolved penalty that no VD was ever filed
    // against — i.e. an error the student never went back to correct.
    const uncorrectedIssues = filings.filter((f) => {
      const p = computeFilingPenalty(f, filings);
      const hadVd = vds.some((v) => v.filingId === f.id);
      return p.isLatePayment && p.latePayment > 0 && !hadVd;
    }).length;
    const vdRate = total ? round2(((total - uncorrectedIssues) / total) * 100) : 100;

    const overallScore = round2((onTimeRate + completionRate + cleanRate + penaltyFreeRate + vdRate) / 5);

    return {
      totalFilings: total,
      onTimeRate, completionRate, cleanRate, penaltyFreeRate, vdRate, overallScore,
      totalPenalties: accountTotalPenalties(filings).total,
      voluntaryDisclosureCount: vds.length,
      detail,
    };
  }
  /* Grade any registered student without switching the active namespace —
     powers the Instructor Roster's at-a-glance scores. */
  function gradeStudentById(studentId) {
    const filings = readForStudent(studentId, "filings", []);
    const vds = readForStudent(studentId, "voluntarydisclosures", []);
    return gradeAccount({ filings, vds });
  }

  /* ---------------------------------------------------------------------
     Tax Invoice / Tax Credit Note Generator — produces a document
     carrying the fields the Executive Regulations require for a UAE Tax
     Invoice: supplier TRN, sequential invoice number, invoice date,
     description, taxable amount, VAT amount, and gross total. A Tax
     Credit Note must reference the original invoice it corrects.
  --------------------------------------------------------------------- */
  function getInvoices() {
    return read(KEYS.INVOICES, []);
  }
  function saveInvoices(list) {
    write(KEYS.INVOICES, list);
  }
  function nextInvoiceNumber(type) {
    const list = getInvoices();
    const prefix = type === "Tax Credit Note" ? "CN" : "INV";
    const countOfType = list.filter((i) => i.type === type).length;
    return prefix + "-" + pad(countOfType + 1, 5);
  }
  function addInvoice(account, data) {
    const taxableAmount = round2(n(data.quantity) * n(data.unitPrice) * (1 - n(data.discountPct) / 100));
    const vatAmount = data.reverseCharge ? 0 : round2(taxableAmount * 0.05);
    const total = round2(taxableAmount + vatAmount);
    const invoice = {
      id: uid("DOC"),
      type: data.type,
      invoiceNumber: nextInvoiceNumber(data.type),
      date: data.date || todayISO(),
      supplyDate: data.supplyDate || data.date || todayISO(),
      supplierName: account.companyName,
      supplierTrn: account.trn,
      supplierAddress: account.address,
      customerName: data.customerName,
      customerTrn: data.customerTrn || "",
      customerAddress: data.customerAddress || "",
      description: data.description,
      quantity: n(data.quantity),
      unitPrice: n(data.unitPrice),
      discountPct: n(data.discountPct),
      reverseCharge: !!data.reverseCharge,
      taxableAmount, vatAmount, total,
      relatedInvoiceNumber: data.relatedInvoiceNumber || "",
      reason: data.reason || "",
      relatedFilingId: data.relatedFilingId || "",
      createdAt: new Date().toISOString(),
    };
    const list = getInvoices();
    list.unshift(invoice);
    saveInvoices(list);
    logActivity("Tax Invoice", "Generated " + invoice.type + " " + invoice.invoiceNumber + " — AED " + fmtAED(invoice.total) + " for " + invoice.customerName + ".");
    return invoice;
  }

  /* ---------------------------------------------------------------------
     Trial Balance Exercise attempts — recorded for the student's own
     progress view and surfaced in Instructor Mode.
  --------------------------------------------------------------------- */
  function getTbAttempts() {
    return read(KEYS.TB_ATTEMPTS, []);
  }
  function addTbAttempt(attempt) {
    const list = getTbAttempts();
    list.unshift(Object.assign({ id: uid("TB"), date: new Date().toISOString() }, attempt));
    write(KEYS.TB_ATTEMPTS, list.slice(0, 50));
    logActivity("Trial Balance Exercise", "Scored " + attempt.scorePct + "% (" + attempt.correctCount + "/" + attempt.total + " correctly classified).");
  }

  /* ---------------------------------------------------------------------
     UAE PASS (simulated) — a separate identity credential from the VAT
     training account itself, exactly like the real thing: you create a
     UAE PASS once, then use it to sign in to different services. Stored
     per-student, since each student on this browser has their own.
  --------------------------------------------------------------------- */
  function getUaePass() {
    return read(KEYS.UAE_PASS, null);
  }
  function saveUaePass(data) {
    write(KEYS.UAE_PASS, data);
  }

  /* ---------------------------------------------------------------------
     Standalone Emirates ID application record — for the "Apply for
     Emirates ID" entry point reachable straight from the login screen,
     independent of the VAT registration wizard. Same shape as the record
     produced inside register.js's Emirates ID modal; stored per-student
     so it can be reused when creating a UAE PASS or registering.
  --------------------------------------------------------------------- */
  function getEmiratesIdRecord() {
    return read(KEYS.EMIRATES_ID, null);
  }
  function saveEmiratesIdRecord(data) {
    write(KEYS.EMIRATES_ID, data);
  }

  /* ---------------------------------------------------------------------
     File/image helpers — every uploaded or generated document is
     downsized client-side before being stored, since it all lives in
     localStorage (no backend, no server, nothing leaves the browser).
  --------------------------------------------------------------------- */
  function compressImageFile(file, maxWidth, quality) {
    maxWidth = maxWidth || 900;
    quality = quality || 0.82;
    return new Promise((resolve, reject) => {
      if (!file || !file.type || !file.type.startsWith("image/")) {
        reject(new Error("Please choose an image file (JPG, PNG, etc.)."));
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error("That file is too large — please choose an image under 8 MB."));
        return;
      }
      const img = new Image();
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.onload = () => {
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => reject(new Error("Could not read that image."));
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* Draws a clearly-labelled fake training ID card — used both as a
     stand-in "trade license" upload during registration and as the
     photo-ID step of the simulated UAE PASS creation flow. Every card
     is watermarked so it can never be mistaken for a real document. */
  function generateIdCardImage(data) {
    const canvas = document.createElement("canvas");
    const W = 900, H = 560;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0c1f38");
    grad.addColorStop(1, "#173a63");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#c9a227";
    ctx.fillRect(0, 0, W, 10);
    ctx.fillRect(0, H - 10, W, 10);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px Arial";
    ctx.fillText("TRAINING SIMULATOR ID CARD", 40, 60);
    ctx.font = "13px Arial";
    ctx.fillStyle = "#c9a227";
    ctx.fillText("UAE VAT Return Filing Simulator — Not a Real Government Document", 40, 82);

    // Photo placeholder
    ctx.fillStyle = "#22375a";
    ctx.fillRect(40, 120, 200, 240);
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 120, 200, 240);
    ctx.fillStyle = "#c9a227";
    ctx.font = "bold 70px Arial";
    const initials = (data.name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
    ctx.textAlign = "center";
    ctx.fillText(initials, 140, 260);
    ctx.textAlign = "left";

    // Details
    let y = 150;
    function row(label, value) {
      ctx.fillStyle = "#8b98a6";
      ctx.font = "12px Arial";
      ctx.fillText(label.toUpperCase(), 270, y);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px Arial";
      ctx.fillText(value || "—", 270, y + 24);
      y += 56;
    }
    row("Full Name", data.name);
    row("ID Number", data.idNumber);
    row("Nationality", data.nationality || "United Arab Emirates");
    row("Date of Issue", data.issueDate);
    row("Card Type", data.cardType || "Training / Simulation Only");

    // Watermark
    ctx.save();
    ctx.translate(W / 2, H / 2 + 30);
    ctx.rotate(-0.35);
    ctx.font = "bold 46px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.textAlign = "center";
    ctx.fillText("NOT A REAL DOCUMENT", 0, 0);
    ctx.fillText("FOR TRAINING USE ONLY", 0, 55);
    ctx.restore();

    return canvas.toDataURL("image/png");
  }

  /* Generates a 6-9 char fake courier tracking number for physical card
     "delivery" — Emirates Post style alphanumeric reference. Training
     only; nothing is actually posted anywhere. */
  function generateTrackingNumber() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    let s = "EP";
    for (let i = 0; i < 2; i++) s += letters[Math.floor(Math.random() * letters.length)];
    for (let i = 0; i < 8; i++) s += Math.floor(Math.random() * 10);
    s += "AE";
    return s;
  }

  /* ---------------------------------------------------------------------
     Downloadable ID-card-style PDF — shared by the Emirates ID download
     (register.js) and the UAE PASS Digital ID download (uaepass-create.js
     / profile.html). Draws a clean one-page, ID-1-proportioned card panel
     on an A4 sheet using the same jsPDF instance/branding conventions as
     generatePdf() above, rather than reusing generatePdf's row-table
     layout (a physical ID card isn't a table of rows). Every card carries
     the same "NOT A REAL DOCUMENT" watermark treatment as the rest of the
     simulator's generated PDFs.
     opts: { docTitle, issuerLine, accent: [r,g,b], name, idLabel,
             idNumber, rows: [[k,v],...], watermarkLines: [string,...],
             filename } */
  function generateIdCardPdf(opts) {
    if (!window.jspdf) {
      toast("PDF library did not load — check your internet connection and try again.", "error");
      return false;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 16;
    const accent = opts.accent || [201, 162, 39]; // gold-500 default
    let y = 16;

    // Page header (matches the rest of the simulator's PDF branding)
    doc.setFillColor(12, 31, 56);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(opts.issuerLine || "UAE VAT Return Filing Simulator", marginX, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Training Edition — Created By Ananthu Shaji", marginX, 18.5);
    y = 30;

    doc.setFillColor(253, 242, 226);
    doc.setDrawColor(233, 199, 143);
    doc.roundedRect(marginX, y, pageW - marginX * 2, 12, 2, 2, "FD");
    doc.setTextColor(139, 86, 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("⚠  TRAINING SIMULATOR ONLY — NOT A REAL GOVERNMENT-ISSUED DOCUMENT", pageW / 2, y + 7.5, { align: "center" });
    y += 22;

    // ---- Card panel (ID-1 card proportions, scaled up: 85.6 x 53.98mm) ----
    const cardW = pageW - marginX * 2;
    const cardH = cardW * (53.98 / 85.6);
    const cardX = marginX;
    const cardY = y;
    doc.setFillColor(12, 31, 56);
    doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, "F");
    doc.setFillColor.apply(doc, accent);
    doc.rect(cardX, cardY, cardW, 3, "F");
    doc.rect(cardX, cardY + cardH - 3, cardW, 3, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(opts.docTitle, cardX + 8, cardY + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor.apply(doc, accent);
    doc.text("United Arab Emirates — Training Simulation", cardX + 8, cardY + 17);

    // Photo box — real uploaded photo when available, initials placeholder otherwise
    const photoX = cardX + 8, photoY = cardY + 22, photoW = cardW * 0.22, photoH = cardH - 30;
    doc.setFillColor(34, 55, 90);
    doc.rect(photoX, photoY, photoW, photoH, "F");
    doc.setDrawColor.apply(doc, accent);
    doc.setLineWidth(0.4);
    doc.rect(photoX, photoY, photoW, photoH);
    if (opts.photoDataUrl) {
      try {
        const fmt = opts.photoDataUrl.indexOf("image/png") !== -1 ? "PNG" : "JPEG";
        doc.addImage(opts.photoDataUrl, fmt, photoX, photoY, photoW, photoH);
      } catch (e) {
        /* fall through to initials if the image fails to decode */
      }
    }
    if (!opts.photoDataUrl) {
      const initials = (opts.name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
      doc.setTextColor.apply(doc, accent);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(initials, photoX + photoW / 2, photoY + photoH / 2 + 3, { align: "center" });
    }

    // Field rows, right side of the card
    let fy = cardY + 26;
    const fx = photoX + photoW + 8;
    const fieldRows = [["Full Name", opts.name], [opts.idLabel || "ID Number", opts.idNumber]].concat(opts.rows || []);
    fieldRows.forEach(([k, v]) => {
      doc.setTextColor(150, 175, 205);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(String(k).toUpperCase(), fx, fy);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text(String(v || "—"), fx, fy + 4.6);
      fy += 9.5;
    });

    // Diagonal watermark across the card
    doc.saveGraphicsState && doc.saveGraphicsState();
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    try { doc.setGState(new doc.GState({ opacity: 0.12 })); } catch (e) {}
    doc.text("NOT A REAL DOCUMENT", cardX + cardW / 2, cardY + cardH / 2, { align: "center", angle: 18 });
    try { doc.setGState(new doc.GState({ opacity: 1 })); } catch (e) {}
    doc.restoreGraphicsState && doc.restoreGraphicsState();

    y = cardY + cardH + 12;

    doc.setTextColor(30, 42, 56);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text("Card Details", marginX, y);
    y += 7;
    const detailRows = [["Issue Date", opts.issueDate], ["Document Type", opts.docTitle]].concat(opts.rows || []);
    doc.setFontSize(10);
    detailRows.forEach(([k, v], i) => {
      if (i % 2 === 0) {
        doc.setFillColor(246, 248, 250);
        doc.rect(marginX, y - 4.2, pageW - marginX * 2, 7, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(91, 107, 124);
      doc.text(String(k), marginX + 2, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 42, 56);
      doc.text(String(v || "—"), pageW - marginX - 2, y, { align: "right" });
      y += 7;
    });
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(139, 152, 166);
    (opts.watermarkLines || [
      "This is a training-simulation document generated by the UAE VAT Simulator. It is not affiliated with, issued by, or endorsed by the ICP, TDRA, UAE PASS, or any UAE government entity, and has no legal, official, or identification value.",
    ]).forEach((p) => {
      const wrapped = doc.splitTextToSize(p, pageW - marginX * 2);
      wrapped.forEach((line) => {
        if (y > 280) { doc.addPage(); y = 18; }
        doc.text(line, marginX, y);
        y += 4.4;
      });
      y += 1.5;
    });

    doc.setDrawColor(224, 228, 233);
    doc.line(marginX, 288, pageW - marginX, 288);
    doc.setFontSize(8);
    doc.text("UAE VAT Simulator · Created By Ananthu Shaji · Training Edition · Generated " + fmtDate(todayISO()), pageW / 2, 292, { align: "center" });

    doc.save(opts.filename);
    return true;
  }

  /* ---------------------------------------------------------------------
     Notification Center — derived live from filings + messages, never
     stored separately, so it can never go stale or mismatch.
  --------------------------------------------------------------------- */
  function getNotifications() {
    const items = [];
    getFilings().forEach((f) => {
      const due = new Date(f.period.dueDate);
      const daysLeft = Math.ceil((due - new Date()) / 86400000);
      if (f.status !== "Submitted" && daysLeft <= 15) {
        items.push({
          type: daysLeft < 0 ? "overdue" : "due-soon",
          text: (daysLeft < 0 ? "Overdue: " : "Due in " + daysLeft + " day(s): ") + "VAT return for " + f.period.label,
          date: f.period.dueDate,
          link: "return.html?id=" + f.id,
        });
      }
    });
    getExciseFilings().forEach((f) => {
      const due = new Date(f.period.dueDate);
      const daysLeft = Math.ceil((due - new Date()) / 86400000);
      if (f.status !== "Submitted" && daysLeft <= 15) {
        items.push({
          type: daysLeft < 0 ? "overdue" : "due-soon",
          text: (daysLeft < 0 ? "Overdue: " : "Due in " + daysLeft + " day(s): ") + "Excise return for " + f.period.label,
          date: f.period.dueDate,
          link: "excise-return.html?id=" + f.id,
        });
      }
    });
    getMessages().filter((m) => m.folder === "inbox" && !m.read).forEach((m) => {
      items.push({ type: "message", text: m.subject, date: m.date, link: "correspondence.html?id=" + m.id });
    });
    items.sort((a, b) => new Date(a.date) - new Date(b.date));
    return items;
  }

  /* ---------------------------------------------------------------------
     Global search across TRN, reference numbers, returns, messages
  --------------------------------------------------------------------- */
  function globalSearch(qRaw) {
    const q = (qRaw || "").trim().toLowerCase();
    if (!q) return [];
    const results = [];
    const account = getAccount();
    if (account && account.trn.toLowerCase().includes(q)) {
      results.push({ type: "Profile", label: "TRN " + account.trn, link: "profile.html" });
    }
    getFilings().forEach((f) => {
      if ((f.referenceNumber || "").toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || f.period.label.toLowerCase().includes(q)) {
        results.push({ type: "VAT Return", label: f.period.label + (f.referenceNumber ? " — Ref. " + f.referenceNumber : ""), link: "filings.html" });
      }
    });
    getExciseFilings().forEach((f) => {
      if ((f.referenceNumber || "").toLowerCase().includes(q) || f.id.toLowerCase().includes(q) || f.period.label.toLowerCase().includes(q)) {
        results.push({ type: "Excise Return", label: f.period.label + (f.referenceNumber ? " — Ref. " + f.referenceNumber : ""), link: "excise.html" });
      }
    });
    getMessages().forEach((m) => {
      if (m.subject.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)) {
        results.push({ type: "Correspondence", label: m.subject, link: "correspondence.html?id=" + m.id });
      }
    });
    getAuthUsers().forEach((u) => {
      if (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) {
        results.push({ type: "User", label: u.name + " (" + u.email + ")", link: "authorization.html" });
      }
    });
    return results.slice(0, 20);
  }

  /* ---------------------------------------------------------------------
     Shared PDF engine — used by every download across the simulator so
     every generated document (return acknowledgement, payment receipt,
     correspondence, certificates, Excise Tax documents) shares the same
     branding, warning banner, and bilingual Terms & Conditions block.
  --------------------------------------------------------------------- */
  function pdfArabicBlockToImage(lines, opts) {
    opts = opts || {};
    const fontSize = opts.fontSize || 15;
    const widthPx = opts.widthPx || 1000;
    const lineHeight = fontSize * 1.7;
    const scale = 3;
    const canvas = document.createElement("canvas");
    canvas.width = widthPx * scale;
    canvas.height = (lines.length * lineHeight + 16) * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#1e2a38";
    ctx.font = fontSize + 'px "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    lines.forEach((line, i) => ctx.fillText(line, widthPx - 6, 8 + i * lineHeight));
    return { dataUrl: canvas.toDataURL("image/png"), widthPx, heightPx: canvas.height / scale };
  }

  const PDF_TERMS_EN = [
    "This document is generated by the UAE VAT Simulator, an offline training and educational tool created by " +
      "Ananthu Shaji. It is not affiliated with, endorsed by, or connected to the UAE Federal Tax Authority (FTA) " +
      "or any government entity in any way.",
    "All names, TRNs, reference numbers, and figures shown here are training data entered by the user of this " +
      "simulator and hold no legal, financial, or tax significance. This document is not a valid FTA-issued " +
      "document and cannot be used for any official, legal, or regulatory purpose.",
    "No data from this simulator is transmitted to the FTA, EmaraTax, or any real government or financial system " +
      "— everything is generated and stored locally in the user's own browser.",
    "By using this simulator you acknowledge that it is provided purely for practice and learning purposes, " +
      '"as is", with no warranty of accuracy, and that any resemblance of its figures to a real tax position is ' +
      "coincidental.",
  ];
  const PDF_TERMS_AR = [
    "هذا المستند تم إنشاؤه بواسطة \"محاكي ضريبة القيمة المضافة الإماراتي\"، وهو أداة تدريبية",
    "وتعليمية تعمل دون اتصال بالإنترنت من إنشاء أنانثو شاجي (Ananthu Shaji)، وهو غير تابع",
    "للهيئة الاتحادية للضرائب ولا يمثلها بأي شكل من الأشكال، ولا يتصل بأي نظام حكومي حقيقي.",
    "",
    "جميع الأسماء والأرقام الضريبية وأرقام المرجع والقيم الظاهرة هنا هي بيانات تدريبية أدخلها",
    "المستخدم، وليس لها أي قيمة قانونية أو مالية أو ضريبية. هذا المستند ليس صادرًا رسميًا",
    "من الهيئة الاتحادية للضرائب ولا يجوز استخدامه لأي غرض رسمي أو قانوني.",
    "",
    "لا يتم إرسال أي بيانات من هذا المحاكي إلى الهيئة الاتحادية للضرائب أو نظام \"إماراتاكس\"",
    "أو أي نظام حكومي أو مالي حقيقي — يتم إنشاء جميع البيانات وتخزينها محليًا داخل متصفح المستخدم فقط.",
  ];

  /* opts: { title, subtitle, rows: [[k,v],...], bodyParas: [string,...], filename } */
  function generatePdf(opts) {
    if (!window.jspdf) {
      toast("PDF library did not load — check your internet connection and try again.", "error");
      return false;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 16;
    let y = 16;

    doc.setFillColor(12, 31, 56);
    doc.rect(0, 0, pageW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("FEDERAL TAX AUTHORITY — VAT Return Filing Simulator", marginX, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Training Edition — Created By Ananthu Shaji", marginX, 18.5);
    y = 30;

    doc.setFillColor(253, 242, 226);
    doc.setDrawColor(233, 199, 143);
    doc.roundedRect(marginX, y, pageW - marginX * 2, 12, 2, 2, "FD");
    doc.setTextColor(139, 86, 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("⚠  TRAINING SIMULATOR ONLY — THIS IS NOT AN OFFICIAL FTA DOCUMENT", pageW / 2, y + 7.5, { align: "center" });
    y += 20;

    doc.setTextColor(30, 42, 56);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(opts.title, marginX, y);
    y += 6;
    if (opts.subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(91, 107, 124);
      doc.text(opts.subtitle, marginX, y);
      y += 5;
    }
    y += 3;

    if (opts.rows && opts.rows.length) {
      doc.setFontSize(10);
      opts.rows.forEach(([k, v], i) => {
        if (y > 275) { doc.addPage(); y = 18; }
        const isSectionHeader = k.indexOf("— ") === 0 && v === "";
        if (isSectionHeader) {
          y += 2;
          doc.setFillColor(12, 31, 56);
          doc.rect(marginX, y - 4.6, pageW - marginX * 2, 7.4, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(255, 255, 255);
          doc.text(String(k).replace(/^—\s*|\s*—$/g, ""), marginX + 2, y);
          doc.setFontSize(10);
          y += 8;
          return;
        }
        if (i % 2 === 0) {
          doc.setFillColor(246, 248, 250);
          doc.rect(marginX, y - 4.2, pageW - marginX * 2, 7, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setTextColor(91, 107, 124);
        doc.text(String(k), marginX + 2, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 42, 56);
        doc.text(String(v), pageW - marginX - 2, y, { align: "right" });
        y += 7;
      });
      y += 6;
    }

    if (opts.bodyParas && opts.bodyParas.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(60, 72, 84);
      opts.bodyParas.forEach((p) => {
        const wrapped = doc.splitTextToSize(p, pageW - marginX * 2);
        wrapped.forEach((line) => {
          if (y > 275) { doc.addPage(); y = 18; }
          doc.text(line, marginX, y);
          y += 5;
        });
        y += 2;
      });
      y += 4;
    }

    if (y > 230) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(12, 31, 56);
    doc.text("Terms, Conditions & Disclosure", marginX, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.3);
    doc.setTextColor(60, 72, 84);
    PDF_TERMS_EN.forEach((p) => {
      const wrapped = doc.splitTextToSize(p, pageW - marginX * 2);
      wrapped.forEach((line) => {
        if (y > 275) { doc.addPage(); y = 18; }
        doc.text(line, marginX, y);
        y += 5;
      });
      y += 2;
    });

    y += 4;
    if (y > 230) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(12, 31, 56);
    doc.text("الشروط والأحكام والإفصاح", pageW - marginX, y, { align: "right" });
    y += 6;
    const arImg = pdfArabicBlockToImage(PDF_TERMS_AR, { fontSize: 15, widthPx: 1000 });
    const arWmm = pageW - marginX * 2;
    const arHmm = (arImg.heightPx / arImg.widthPx) * arWmm;
    if (y + arHmm > 285) { doc.addPage(); y = 18; }
    doc.addImage(arImg.dataUrl, "PNG", marginX, y, arWmm, arHmm);
    y += arHmm + 8;

    doc.setDrawColor(224, 228, 233);
    doc.line(marginX, 288, pageW - marginX, 288);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(139, 152, 166);
    doc.text("UAE VAT Simulator · Created By Ananthu Shaji · Training Edition · Generated " + fmtDate(todayISO()), pageW / 2, 292, { align: "center" });

    doc.save(opts.filename);
    return true;
  }

  /* ---------------------------------------------------------------------
     Toast notifications
  --------------------------------------------------------------------- */
  function ensureToastStack() {
    let el = document.querySelector(".toast-stack");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast-stack";
      document.body.appendChild(el);
    }
    return el;
  }
  function toast(msg, type) {
    type = type || "info";
    const stack = ensureToastStack();
    const t = document.createElement("div");
    t.className = "toast " + type;
    const icon = type === "success" ? "✓" : type === "error" ? "✕" : type === "warn" ? "!" : "i";
    t.innerHTML =
      '<span class="ic">' + icon + '</span><span class="msg"></span><button class="close" aria-label="Dismiss">✕</button>';
    t.querySelector(".msg").textContent = msg;
    t.querySelector(".close").addEventListener("click", () => t.remove());
    stack.appendChild(t);
    setTimeout(() => t.remove(), 4500);
  }

  /* ---------------------------------------------------------------------
     Loading overlay
  --------------------------------------------------------------------- */
  /* ---------------------------------------------------------------------
     Generic CSV export/download — used by the Activity Log (and any
     future table export). Escapes per RFC 4180: wrap in quotes and
     double up any embedded quote whenever a cell contains a comma,
     quote, or newline.
  --------------------------------------------------------------------- */
  function downloadCsv(filename, headers, rows) {
    const esc = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.map(esc).join(",")].concat(rows.map((r) => r.map(esc).join(",")));
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function ensureLoadingOverlay() {
    let el = document.querySelector(".loading-overlay");
    if (!el) {
      el = document.createElement("div");
      el.className = "loading-overlay";
      el.innerHTML = '<div class="spinner"></div><div class="msg">Loading…</div>';
      document.body.appendChild(el);
    }
    return el;
  }
  function showLoading(msg, ms) {
    return new Promise((resolve) => {
      const el = ensureLoadingOverlay();
      el.querySelector(".msg").textContent = msg || "Loading…";
      el.classList.add("open");
      setTimeout(() => {
        el.classList.remove("open");
        resolve();
      }, ms || 500);
    });
  }

  /* ---------------------------------------------------------------------
     Idle session timeout — mirrors the real EmaraTax portal, which signs
     you out after a period of inactivity to protect tax data on shared
     lab machines. Warns 60s before signing out so a genuinely-idle
     student doesn't lose unsaved work without notice; any click/keypress/
     scroll resets the clock. Skipped entirely on pages with no session
     (login/index/register) since there's nothing to time out.
  --------------------------------------------------------------------- */
  const IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes, matching real portal norms
  const IDLE_WARN_MS = 60 * 1000; // warn with 60s left on the clock
  function ensureIdleModal() {
    let el = document.querySelector(".idle-modal-backdrop");
    if (!el) {
      el = document.createElement("div");
      el.className = "modal-backdrop idle-modal-backdrop";
      el.innerHTML =
        '<div class="modal" style="max-width:420px">' +
        '<div class="modal-body" style="padding:30px 26px;text-align:center">' +
        '<div style="font-size:32px;margin-bottom:10px">⏳</div>' +
        '<h3 style="font-size:15px;margin-bottom:8px">Session about to expire</h3>' +
        '<p style="font-size:12.5px;color:var(--text-muted);margin-bottom:18px">' +
        "You've been inactive for a while. For security, you'll be signed out in " +
        '<strong><span id="idleCountdown">60</span>s</strong> — just like the real EmaraTax portal.</p>' +
        '<button class="btn btn-gold" id="idleStayBtn" style="width:100%">Stay signed in</button>' +
        "</div></div>";
      document.body.appendChild(el);
      el.querySelector("#idleStayBtn").addEventListener("click", resetIdleTimer);
    }
    return el;
  }
  let idleWarnTimer, idleLogoutTimer, idleCountdownInterval;
  function resetIdleTimer() {
    clearTimeout(idleWarnTimer);
    clearTimeout(idleLogoutTimer);
    clearInterval(idleCountdownInterval);
    const modal = document.querySelector(".idle-modal-backdrop");
    if (modal) modal.classList.remove("open");
    idleWarnTimer = setTimeout(showIdleWarning, IDLE_LIMIT_MS - IDLE_WARN_MS);
  }
  function showIdleWarning() {
    const modal = ensureIdleModal();
    modal.classList.add("open");
    let secsLeft = Math.round(IDLE_WARN_MS / 1000);
    const out = document.getElementById("idleCountdown");
    if (out) out.textContent = String(secsLeft);
    idleCountdownInterval = setInterval(() => {
      secsLeft -= 1;
      if (out) out.textContent = String(Math.max(secsLeft, 0));
      if (secsLeft <= 0) clearInterval(idleCountdownInterval);
    }, 1000);
    idleLogoutTimer = setTimeout(() => {
      modal.classList.remove("open");
      clearSession();
      window.location.href = rootPath() + "login.html?timeout=1";
    }, IDLE_WARN_MS);
  }
  function initIdleTimeout() {
    if (!getSession()) return; // nothing to protect on pre-login pages
    ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach((evt) =>
      document.addEventListener(evt, debounce(resetIdleTimer, 800), { passive: true })
    );
    resetIdleTimer();
  }
  function debounce(fn, wait) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  /* ---------------------------------------------------------------------
     Header/topbar wiring shared by every page
  --------------------------------------------------------------------- */
  function wireChrome() {
    applyTextScale();
    initIdleTimeout();
    // text size buttons
    document.querySelectorAll("[data-textsize]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = getSettings();
        const dir = btn.getAttribute("data-textsize");
        if (dir === "up") s.textScale = Math.min(1.3, (s.textScale || 1) + 0.1);
        else if (dir === "down") s.textScale = Math.max(0.85, (s.textScale || 1) - 0.1);
        else s.textScale = 1;
        saveSettings(s);
        applyTextScale();
      });
    });
    // Language toggle — the real EmaraTax portal fully serves an Arabic
    // UI; translating this entire training simulator is out of scope, so
    // this is an honest partial: it flips the page to RTL and swaps the
    // chrome (header/nav/buttons) into Arabic, while clearly telling the
    // student the form content itself stays in English. Better to be
    // upfront about the limit than to fake a full translation.
    document.querySelectorAll(".lang-toggle").forEach((el) => {
      const activate = () => {
        const goingArabic = document.documentElement.getAttribute("dir") !== "rtl";
        document.documentElement.setAttribute("dir", goingArabic ? "rtl" : "ltr");
        document.documentElement.setAttribute("lang", goingArabic ? "ar" : "en");
        document.body.classList.toggle("lang-ar-chrome", goingArabic);
        el.textContent = goingArabic ? "English" : "عربي";
        toast(
          goingArabic
            ? "الواجهة الرئيسية بالعربية الآن. المحاكي التدريبي لا يترجم كامل المحتوى — نموذج الإقرار الضريبي يبقى بالإنجليزية."
            : "Switched back to English.",
          "info"
        );
      };
      el.addEventListener("click", activate);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });
    // user menu dropdown
    const menu = document.querySelector(".user-menu");
    const dropdown = document.querySelector(".user-menu-dropdown");
    if (menu && dropdown) {
      menu.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
      });
      document.addEventListener("click", () => dropdown.classList.remove("open"));

      // Switch Taxable Person — injected here (rather than duplicated in
      // every page's HTML) so it appears consistently everywhere, and
      // never on the pre-login / registration / picker pages themselves
      // (those don't have this dropdown at all).
      if (!dropdown.querySelector("[data-action='switch-taxable-person']") && !window.location.pathname.endsWith("taxable-person.html")) {
        const btn = document.createElement("button");
        btn.setAttribute("data-action", "switch-taxable-person");
        btn.textContent = "🏢 Switch Taxable Person";
        dropdown.insertBefore(btn, dropdown.firstChild);
        btn.addEventListener("click", () => (window.location.href = pagesPath() + "taxable-person.html"));
      }
    }
    // Persistent "viewing" indicator when a demo company is selected —
    // keeps the currently-selected Taxable Person visible everywhere,
    // per the same session-persistence rule the multi-student switcher
    // already follows.
    const selectedTp = getSelectedTaxablePerson();
    if (selectedTp !== "own" && !document.getElementById("tpIndicator") && !window.location.pathname.endsWith("demo-company.html") && !window.location.pathname.endsWith("taxable-person.html")) {
      const company = getDemoCompany(selectedTp);
      if (company) {
        const bar = document.createElement("div");
        bar.id = "tpIndicator";
        bar.style.cssText = "background:var(--gold-100);color:#8b5c0c;font-size:11.5px;font-weight:600;text-align:center;padding:6px 10px;border-bottom:1px solid #e6d3a3";
        bar.innerHTML = '👁 Viewing demo company: <strong>' + company.name + '</strong> (view only) — <a href="' + pagesPath() + 'taxable-person.html" style="color:inherit;text-decoration:underline">switch back</a>';
        document.body.insertBefore(bar, document.body.firstChild);
      }
    }
    // logout
    document.querySelectorAll("[data-action='logout']").forEach((btn) => {
      btn.addEventListener("click", () => {
        clearSession();
        toast("You have been logged out.", "info");
        setTimeout(() => (window.location.href = rootPath() + "login.html"), 400);
      });
    });
    // reset simulator
    document.querySelectorAll("[data-action='reset-sim']").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("This will erase the account, all filings, and settings from this browser. Continue?")) {
          Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
          const myId = getActiveStudentId();
          saveStudentRegistry(getStudentRegistry().filter((s) => s.id !== myId));
          // Leave the active pointer as-is (now pointing at an empty
          // namespace) rather than forcing it to "" — since "" is also a
          // real student's namespace when they were the first ever
          // created on this browser, resetting that pointer here could
          // silently switch into a different student's account.
          toast("Simulator reset.", "success");
          setTimeout(() => (window.location.href = rootPath() + "login.html"), 500);
        }
      });
    });
    // mobile sidebar toggle
    const toggle = document.querySelector("[data-action='toggle-sidebar']");
    const sidebar = document.querySelector(".sidebar");
    if (toggle && sidebar) {
      toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
    }
    // populate user email chip
    const session = getSession();
    const account = getAccount();
    document.querySelectorAll("[data-user-email]").forEach((el) => {
      el.textContent = session ? session.email : "";
    });
    document.querySelectorAll("[data-user-initial]").forEach((el) => {
      el.textContent = session && session.email ? session.email[0].toUpperCase() : "?";
    });
    document.querySelectorAll("[data-company-name]").forEach((el) => {
      el.textContent = account ? account.companyName : "";
    });
    document.querySelectorAll("[data-trn]").forEach((el) => {
      el.textContent = account ? account.trn : "";
    });
    // Notification bell — derived live, never stale
    document.querySelectorAll(".icon-btn[title='Notifications']").forEach((btn) => {
      if (btn.dataset.wired) return;
      btn.dataset.wired = "1";
      btn.style.position = "relative";
      const notes = getNotifications();
      if (notes.length) {
        const dot = document.createElement("span");
        dot.className = "notif-dot";
        dot.textContent = notes.length > 9 ? "9+" : String(notes.length);
        btn.appendChild(dot);
      }
      const panel = document.createElement("div");
      panel.className = "notif-panel";
      panel.innerHTML =
        '<div class="notif-panel-header">Notifications</div>' +
        (notes.length
          ? notes
              .map(
                (n) =>
                  '<a class="notif-row ' + n.type + '" href="' + pagesPath() + n.link + '">' +
                  '<span class="dot"></span><span class="txt">' + n.text + "</span></a>"
              )
              .join("")
          : '<div class="notif-empty">You\'re all caught up.</div>');
      document.body.appendChild(panel);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const r = btn.getBoundingClientRect();
        panel.style.top = r.bottom + 8 + "px";
        panel.style.right = window.innerWidth - r.right + "px";
        panel.classList.toggle("open");
      });
      document.addEventListener("click", () => panel.classList.remove("open"));
    });
    // Global header search
    document.querySelectorAll(".header-search").forEach((box) => {
      if (box.dataset.wired) return;
      box.dataset.wired = "1";
      box.setAttribute("tabindex", "0");
      const label = box.querySelector("span");
      const results = document.createElement("div");
      results.className = "search-panel";
      box.style.position = "relative";
      box.appendChild(results);
      box.addEventListener("click", (e) => {
        e.stopPropagation();
        if (box.querySelector("input")) return;
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Search TRN, returns, messages, users…";
        input.className = "header-search-input";
        if (label) label.style.display = "none";
        box.insertBefore(input, results);
        input.focus();
        input.addEventListener("click", (ev) => ev.stopPropagation());
        input.addEventListener("input", () => {
          const hits = globalSearch(input.value);
          results.innerHTML = hits.length
            ? hits.map((h) => '<a href="' + pagesPath() + h.link + '"><span class="tag">' + h.type + "</span>" + h.label + "</a>").join("")
            : input.value.trim()
            ? '<div class="search-empty">No matches.</div>'
            : "";
          results.classList.toggle("open", !!input.value.trim());
        });
      });
      document.addEventListener("click", () => results.classList.remove("open"));
    });
  }

  function rootPath() {
    // pages live in /pages/, index.html lives at project root
    return window.location.pathname.includes("/pages/") ? "../" : "./";
  }
  function pagesPath() {
    return window.location.pathname.includes("/pages/") ? "./" : "pages/";
  }

  return {
    KEYS,
    read, write,
    fmtAED, fmtDate, todayISO, uid, pad, round2,
    getAccount, saveAccount, generateTRN, generateEmiratesId, generateTrackingNumber,
    getSession, setSession, clearSession, requireSession,
    getSettings, saveSettings, applyTextScale, getStorageUsageEstimate,
    DEMO_COMPANIES, getDemoCompany, getSelectedTaxablePerson, setSelectedTaxablePerson,
    getFilings, saveFilings, getFiling, upsertFiling, deleteFiling, canEditFiling,
    newFilingSkeleton, seedIntegrationFeeds, generateInitialFilings, computeTotals, n,
    getMessages, saveMessages, addMessage, markMessageRead, setMessageFolder, unreadMessageCount,
    generateInitialMessages, addSubmissionCorrespondence, addPaymentCorrespondence,
    ROLES, getAuthUsers, saveAuthUsers, generateInitialAuthUsers, addAuthUser, removeAuthUser, approveAuthUser,
    getActivityLog, logActivity, getNotifications, globalSearch, downloadCsv,
    generatePdf, pdfArabicBlockToImage, generateIdCardPdf,
    EXCISE_CATEGORIES, SWEETENED_TIERS, exciseRateFor, sweetenedTierRate, getExciseFilings, saveExciseFilings, getExciseFiling, upsertExciseFiling,
    registerForExcise, computeExciseTotals,
    isFilingLate, isRepeatLateFiling, computeFilingPenalty, accountTotalPenalties, getFilingReviewStage, filingStatusBadge, getEffectivePaymentStatus, isPaymentSettled,
    getVoluntaryDisclosures, saveVoluntaryDisclosures, addVoluntaryDisclosure, buildCorrectedBoxes, computeVdPenalty,
    validateBoxPairs, gradeAccount, gradeStudentById, setFilingStagger,
    getInvoices, saveInvoices, addInvoice,
    getTbAttempts, addTbAttempt,
    getUaePass, saveUaePass, getEmiratesIdRecord, saveEmiratesIdRecord, compressImageFile, generateIdCardImage,
    getActiveStudentId, setActiveStudentId, getStudentRegistry, saveStudentRegistry,
    registerNewStudent, switchActiveStudent, syncActiveStudentRegistryEntry, readForStudent, stagePendingSignup,
    toast, showLoading, wireChrome, rootPath, pagesPath,
  };
})();

/* ---------------------------------------------------------------------
   PWA: register the service worker so the simulator installs and works
   offline (favicon/manifest/theme-color are wired in each page's <head>).
--------------------------------------------------------------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swPath = (window.location.pathname.includes("/pages/") ? "../" : "./") + "sw.js";
    navigator.serviceWorker.register(swPath).catch((err) => {
      console.warn("VATSIM: service worker registration failed", err);
    });
  });
}
