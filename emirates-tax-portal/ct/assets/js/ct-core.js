/* ============================================================
   Corporate Tax simulator — core bridge
   ------------------------------------------------------------
   This file replaces the standalone store of the CT simulator.
   Everything that identifies the taxable person (company name,
   TRN, Emirates ID, address, contact, UAE PASS) is read live
   from the VAT simulator's own account (VATSIM + SharedIdentity),
   so a student registers once and both simulators show the same
   company. Only Corporate Tax answers are stored by this file,
   namespaced per student.
   ============================================================ */
(function (global) {
  "use strict";

  var BASE_KEY = "emaratax_ct_return_v1";

  /* ---------------- student namespace ---------------- */
  function activeStudentId() {
    try {
      var raw = global.localStorage.getItem("vatsim_global_active");
      return raw ? JSON.parse(raw) : "";
    } catch (e) { return ""; }
  }
  function storageKey() {
    var id = activeStudentId();
    return BASE_KEY + (id ? "_" + id : "");
  }

  /* ---------------- Corporate Tax registration record ----------------
     A separate application with its own record, number and status. It holds NO password: the person signs in with
     the same EmaraTax email and password as VAT (see index.html). Built in ct-reg.js, gated here. */
  var REG_KEY = "emaratax_ct_reg_v1";
  var regMemory = null;
  function regKey() { var id = activeStudentId(); return REG_KEY + (id ? "_" + id : ""); }
  function readReg() {
    var raw = null;
    try { raw = global.localStorage.getItem(regKey()); } catch (e) { raw = null; }
    if (raw === null && regMemory) return JSON.parse(JSON.stringify(regMemory));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function writeReg(r) {
    regMemory = JSON.parse(JSON.stringify(r));
    try { global.localStorage.setItem(regKey(), JSON.stringify(r)); } catch (e) {}
    return r;
  }
  function clearReg() { regMemory = null; try { global.localStorage.removeItem(regKey()); } catch (e) {} }
  function regApproved() { var r = readReg(); return !!(r && r.status === "Approved" && r.ctTrn); }
  /* ---------------- trainer simulated date ----------------
     The one place that says what "today" is for the Corporate Tax service. Default = the real date. A trainer can set a date on
     trainer.html; it drives period generation, due dates, penalties, submission and payment dates. It is stored for this browser
     (all student profiles on it), and it never touches the VAT service. */
  var SIM_KEY = "emaratax_ct_simdate_v1", simMemory = null;
  function simGet() {
    var v = null;
    try { v = global.localStorage.getItem(SIM_KEY); } catch (e) { v = null; }
    if (v === null) v = simMemory;
    return /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : "";
  }
  function simSet(iso) {
    simMemory = /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? iso : null;
    try { if (simMemory) global.localStorage.setItem(SIM_KEY, simMemory); else global.localStorage.removeItem(SIM_KEY); } catch (e) {}
    return simGet();
  }
  function now() {
    var real = new Date(), v = simGet(), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], real.getHours(), real.getMinutes(), real.getSeconds()) : real;
  }

  /* ---------------- VAT portal data ---------------- */
  function account() {
    try { return (typeof VATSIM !== "undefined") ? VATSIM.getAccount() : null; }
    catch (e) { return null; }
  }
  function uaePass() {
    try { return (typeof VATSIM !== "undefined") ? VATSIM.getUaePass() : null; }
    catch (e) { return null; }
  }
  function emiratesIdRecord() {
    try { return (typeof VATSIM !== "undefined") ? VATSIM.getEmiratesIdRecord() : null; }
    catch (e) { return null; }
  }
  function sharedIdentity() {
    try { return (typeof SharedIdentity !== "undefined") ? SharedIdentity.get() : null; }
    catch (e) { return null; }
  }

  /* Taxable person — derived entirely from the VAT registration. */
  function person() {
    var a = account() || {};
    var s = sharedIdentity() || {};
    var eid = emiratesIdRecord();
    var up = uaePass();
    var rg = readReg();
    var ctTrn = (rg && rg.status === "Approved" && rg.ctTrn) ? rg.ctTrn : "";
    var entityType = a.applicantType || "Legal Person - Incorporated";
    var entitySub = a.registrationType || a.tradeName || "UAE Private Company (incl. an Establishment)";
    return {
      trn: ctTrn,
      vatTrn: a.trn || s.companyTRN || "",
      nameEn: a.companyName || s.companyName || "",
      nameAr: a.companyNameAr || "",
      tradeName: a.tradeName || "",
      tradeLicenseNo: a.tradeLicenseNo || "",
      entityType: entityType,
      entitySubType: entitySub,
      primaryBusiness: a.businessActivity || "",
      emirate: a.emirate || s.emirate || "",
      address: a.address || "",
      firstName: a.firstNameEn || (up && up.firstName) || "",
      lastName: a.lastNameEn || (up && up.lastName) || "",
      firstNameAr: a.firstNameAr || "",
      lastNameAr: a.lastNameAr || "",
      designation: a.designation || "",
      mobile: a.phone || (up && up.mobile) || "",
      email: a.email || (up && up.email) || "",
      emiratesId: a.emiratesId || (eid && eid.idNumber) || (up && up.emiratesId) || (s && s.emiratesId) || "",
      registrationDate: a.registrationDate || ""
    };
  }

  /* ---------------- tax periods ----------------
     Periods follow the financial year end chosen at Corporate Tax registration. Due date = 9 months after the period end.
     First period: starts on the incorporation date (or on the first financial year starting on or after 1 June 2023 for older entities);
     if that first financial year would be shorter than 6 months it runs on to the next financial year end (up to 18 months).
     SOURCE STATUS: the 9-month due date is the FTA rule; the 6-to-18-month first period comes from FTA public clarification summaries
     (Deloitte / KPMG), not the clarification itself: SECONDARY, flagged on the filings page. */
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var CT_START = Date.UTC(2023, 5, 1);
  function isoMs(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; }
  function dmyMs(ms) { var d = new Date(ms), p = function (x) { return (x < 10 ? "0" : "") + x; }; return p(d.getUTCDate()) + "/" + p(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear(); }
  function isoOf(ms) { var d = new Date(ms), p = function (x) { return (x < 10 ? "0" : "") + x; }; return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()); }
  /* a financial year end of 28 or 29 February means the last day of February (29 in leap years) */
  function fyEndIn(year, m, d) { var dim = new Date(Date.UTC(year, m, 0)).getUTCDate(); return Date.UTC(year, m - 1, (m === 2 && d >= 28) ? dim : Math.min(d, dim)); }
  function nextFyEnd(ms, m, d) { var y = new Date(ms).getUTCFullYear(), c = fyEndIn(y, m, d); return c >= ms ? c : fyEndIn(y + 1, m, d); }
  function nowMs() { var n = now(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }
  /* Due date: 9 months after the period end. A period that ends on the last day of a month is due on the last day of the month 9 months later
     (31 Dec -> 30 Sep, 30 Jun -> 31 Mar, 28 Feb -> 30 Nov). The month-end convention is from firm deadline calendars: SECONDARY. */
  function dueAfter(end) {
    var d = new Date(end), lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    if (d.getUTCDate() === lastDay) return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 10, 0);
    return addMonths(end, 9);
  }
  function makePeriod(start, end, first) {
    var e = new Date(end), after = end + 86400000, months = 0, due = dueAfter(end), t = nowMs();
    while (months < 60 && addMonths(start, months + 1) <= after) months++;
    var full12 = addMonths(start, 12) === after;
    return { key: isoOf(end), from: dmyMs(start), to: dmyMs(end), yearEnd: dmyMs(end), due: dmyMs(due), dueMs: due, startMs: start, endMs: end, months: months, isFirst: !!first,
      description: (full12 ? "Tax Year End " : "Tax Period End ") + MON[e.getUTCMonth()] + "-" + e.getUTCFullYear(), ended: t > end };
  }
  /* The periods of the registered taxable person up to the first one that has not ended yet. */
  function periods() {
    var rg = readReg(), t = nowMs(), list = [], f, m, d, inc, start, e1, i;
    if (!(rg && rg.status === "Approved" && rg.form)) {
      var y = now().getFullYear() - 1, one = makePeriod(Date.UTC(y, 0, 1), Date.UTC(y, 11, 31), true); one.unregistered = true; return [one];
    }
    f = rg.form; m = +f.fyMonth || 12; d = +f.fyDay || 31; inc = isoMs(f.relevantDate) || CT_START;
    if (inc < CT_START) { e1 = nextFyEnd(CT_START, m, d); start = fyEndIn(new Date(e1).getUTCFullYear() - 1, m, d) + 86400000; if (start < CT_START) { start = e1 + 86400000; e1 = nextFyEnd(start, m, d); } }
    else { start = inc; e1 = nextFyEnd(inc, m, d); if (e1 + 86400000 < addMonths(start, 6)) e1 = fyEndIn(new Date(e1).getUTCFullYear() + 1, m, d); }
    list.push(makePeriod(start, e1, true));
    for (i = 0; i < 40 && list[list.length - 1].ended; i++) { var prev = list[list.length - 1]; start = prev.endMs + 86400000; list.push(makePeriod(start, fyEndIn(new Date(prev.endMs).getUTCFullYear() + 1, m, d), false)); }
    return list;
  }
  function slotOf(raw, key) { return merge(SLOT_DEFAULTS, (raw.periods && raw.periods[key]) || {}); }
  function activeKey(raw) {
    var list = periods(), i, sl;
    if (raw.activePeriod) for (i = 0; i < list.length; i++) if (list[i].key === raw.activePeriod) return raw.activePeriod;
    for (i = 0; i < list.length; i++) { sl = slotOf(raw, list[i].key); if (list[i].ended && sl.filing.status !== "Submitted") return list[i].key; }
    for (i = list.length - 1; i >= 0; i--) if (list[i].ended) return list[i].key;
    return list[0].key;
  }
  function period() {
    var list = periods(), k = activeKey(readRaw()), i;
    for (i = 0; i < list.length; i++) if (list[i].key === k) return list[i];
    return list[0];
  }
  function setActivePeriod(key) { var raw = readRaw(); raw.activePeriod = key; writeRaw(raw); }

  /* ---------------- stored CT data (one slot per tax period) ---------------- */
  var SLOT_DEFAULTS = {
    instructionsRead: false,
    step: 1,
    maxStepReached: 1,
    filing: { status: "Open", appNumber: "", submittedOn: "", netPosition: 0, snapshot: null, payment: null },
    ct: {},
    disclosures: [],
    refunds: []
  };
  var DEFAULTS = { loggedIn: false, favourites: {}, activePeriod: "", periods: {} };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(base, extra) {
    var out = clone(base);
    Object.keys(extra || {}).forEach(function (k) {
      if (extra[k] && typeof extra[k] === "object" && !Array.isArray(extra[k]) &&
          out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
        out[k] = merge(out[k], extra[k]);
      } else { out[k] = extra[k]; }
    });
    return out;
  }

  var memoryStore = null;

  function readRaw() {
    var raw = null, o;
    try { raw = global.localStorage.getItem(storageKey()); } catch (e) { raw = null; }
    if (raw === null && memoryStore) return clone(memoryStore);
    if (!raw) return clone(DEFAULTS);
    try { o = JSON.parse(raw); } catch (e) { return clone(DEFAULTS); }
    o = merge(DEFAULTS, o);
    if (o.filing && !Object.keys(o.periods).length) {          /* older single-period data moves into the first slot */
      var legacy = { instructionsRead: o.instructionsRead, step: o.step, maxStepReached: o.maxStepReached, filing: o.filing, ct: o.ct, disclosures: [], refunds: [] }, k = activeKeyLegacy();
      o.periods[k] = legacy;
    }
    return { loggedIn: o.loggedIn, favourites: o.favourites, activePeriod: o.activePeriod, periods: o.periods };
  }
  function activeKeyLegacy() { var l = periods(), i; for (i = 0; i < l.length; i++) if (l[i].ended) return l[i].key; return l[0].key; }
  function writeRaw(raw) {
    memoryStore = clone(raw);
    try { global.localStorage.setItem(storageKey(), JSON.stringify(raw)); } catch (e) {}
    return raw;
  }
  function writeStored(state) {
    var raw = readRaw(), key = state.activePeriod || activeKey(raw);
    raw.loggedIn = state.loggedIn; raw.favourites = state.favourites;
    raw.periods[key] = { instructionsRead: state.instructionsRead, step: state.step, maxStepReached: state.maxStepReached, filing: state.filing, ct: state.ct, disclosures: state.disclosures || [], refunds: state.refunds || [] };
    writeRaw(raw);
    return state;
  }

  var Store = {
    get: function () {
      var raw = readRaw(), key = activeKey(raw), sl = slotOf(raw, key), list = periods(), i, per = list[0];
      for (i = 0; i < list.length; i++) if (list[i].key === key) per = list[i];
      return { loggedIn: raw.loggedIn, favourites: raw.favourites, activePeriod: key, instructionsRead: sl.instructionsRead, step: sl.step, maxStepReached: sl.maxStepReached,
        filing: sl.filing, ct: sl.ct, disclosures: sl.disclosures, refunds: sl.refunds, person: person(), period: per };
    },
    set: writeStored,
    update: function (fn) { var s = Store.get(); fn(s); return writeStored(s); },
    slot: function (key) { return slotOf(readRaw(), key); },
    reset: function () {
      clearReg();
      memoryStore = null;
      try { global.localStorage.removeItem(storageKey()); } catch (e) {}
      return clone(DEFAULTS);
    }
  };

  /* ---------------- helpers ---------------- */
  function toNumber(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    if (!v) return 0;
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
    return isFinite(n) ? n : 0;
  }
  function money(n) {
    n = toNumber(n);
    var frac = Math.abs(n - Math.round(n)) > 0.004;
    var parts = (frac ? Math.abs(n).toFixed(2) : String(Math.abs(Math.round(n)))).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (n < 0 && (frac || Math.round(n) !== 0) ? "-" : "") + parts.join(".");
  }
  /* ---------------- administrative penalties ----------------
     Late filing: Cabinet Decision 75 of 2023 - AED 500 for each month or part of a month for the first 12 months, AED 1,000 from the 13th month,
     imposed from the day after the due date and on the same date each month. Late payment: 14% a year on the unpaid tax, charged monthly
     (month or part of a month) from the day after the due date (Cabinet Decision 75 of 2023 annex, clause 8: "a monthly penalty of 14% per annum"; the /12 reading is a secondary-source interpretation. Cabinet Decision 129 of 2025 amends the VAT/excise decision, not this one). */
  function parseDMY(s) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ""); return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : null; }
  function addMonths(ms, k) { var d = new Date(ms), y = d.getUTCFullYear(), m = d.getUTCMonth() + k, last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return Date.UTC(y, m, Math.min(d.getUTCDate(), last)); }
  function monthsLate(dueDMY, asOf) {
    var due = parseDMY(dueDMY); if (due === null) return 0;
    var a = Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()), start = due + 86400000, n = 0;
    while (n < 600 && addMonths(start, n) <= a) n++;
    return n;
  }
  function lateFiling(months) { return months <= 12 ? 500 * months : 6000 + 1000 * (months - 12); }
  function latePayment(tax, months) { return Math.round(tax * 0.14 / 12 * months * 100) / 100; }
  function penaltyDue(f, asOf, dueDMY) {
    var paid = f.payment && f.payment.status === "Paid" ? f.payment : null;
    if (paid && paid.breakdown) return paid.breakdown;
    var tax = Math.round(toNumber(f.netPosition) * 100) / 100;
    var fm = toNumber(f.lateFilingMonths), fp = toNumber(f.lateFilingPenalty);
    var pm = tax > 0 ? monthsLate(dueDMY || period().due, asOf || now()) : 0, pp = latePayment(tax, pm);
    return { tax: tax, lateFilingMonths: fm, lateFiling: fp, latePaymentMonths: pm, latePayment: pp, total: Math.round((tax + fp + pp) * 100) / 100 };
  }


  /* ---------------- voluntary disclosure, incorrect return, refunds ----------------
     Cabinet Decision 75/2023 annex (as amended): incorrect return AED 500 unless corrected before the deadline; voluntary disclosure (VD) 1% of the Tax Difference
     per month or part from the day after the due date of the return until the VD is submitted; if the person did not disclose before being notified of an audit,
     a fixed 15% of the Tax Difference is added. Cabinet Decision 74/2023 Art 10: error over AED 10,000 needs a VD (20 working days), AED 10,000 or less may be fixed in the next return.
     Art 26: refund decided in 20 working days, paid in 5 working days, may be deferred while returns are overdue.
     SECONDARY: working days are counted Monday to Friday with no public holidays; the VD payment due date of 20 working days after submission. */
  function addBusinessDays(d, n) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()), k = 0;
    while (k < n) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) k++; }
    return x;
  }
  function dmyDate(d) { var p = function (v) { return (v < 10 ? "0" : "") + v; }; return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function vdCalc(o) {
    var orig = Math.round(toNumber(o.originalNet)), corr = Math.round(toNumber(o.correctedNet)), diff = corr - orig, asOf = o.asOf || now();
    var months = monthsLate(o.dueDMY, asOf), after = months > 0, out = { original: orig, corrected: corr, diff: diff, monthsAfterDue: months, afterDeadline: after, vdMonthly: 0, fixed15: 0, incorrectReturn: 0, payDueDMY: "", total: 0, mode: "" };
    if (diff === 0) { out.mode = "nochange"; return out; }
    out.incorrectReturn = after ? 500 : 0;
    if (diff < 0) { out.mode = "overpaid"; out.refundable = -diff; out.total = out.incorrectReturn; return out; }
    out.mode = after ? "vd" : "amended-before-deadline";
    out.vdMonthly = after ? r2(diff * 0.01 * months) : 0;
    out.fixed15 = (after && o.auditNotified) ? r2(diff * 0.15) : 0;
    out.payDueDMY = after ? dmyDate(addBusinessDays(asOf, 20)) : o.dueDMY;
    out.vdRequired = diff > 10000;
    out.total = r2(diff + out.vdMonthly + out.fixed15 + out.incorrectReturn);
    return out;
  }

  function aed(n) { return "AED " + money(n); }
  function todayStr() {
    var d = now(), p = function (x) { return (x < 10 ? "0" : "") + x; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }
  function stampStr() {
    var d = now();
    var months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear() +
           ", " + p(d.getHours()) + ":" + p(d.getMinutes()) + " GST";
  }
  function appNumber() {
    return "CTRN-" + now().getFullYear() + "-" + Math.floor(100000 + Math.random() * 899999);
  }

  /* ---------------- toast ---------------- */
  function toast(message, kind) {
    var host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      document.body.appendChild(host);
    }
    var el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = message;
    host.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity .25s";
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 2600);
  }

  /* ---------------- modal ---------------- */
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML =
        '<div class="modal-box">' +
          '<div class="modal-head"><span></span><button type="button" aria-label="Close">&#10005;</button></div>' +
          '<div class="modal-body"><p></p>' +
            '<div class="modal-actions">' +
              '<button type="button" class="btn btn-ghost" data-no></button>' +
              '<button type="button" class="btn btn-primary" data-yes></button>' +
            '</div></div></div>';
      overlay.querySelector(".modal-head span").textContent = opts.title || "Confirm";
      overlay.querySelector(".modal-body p").textContent = opts.message || "";
      overlay.querySelector("[data-no]").textContent = opts.noText || "No";
      overlay.querySelector("[data-yes]").textContent = opts.yesText || "Yes";
      if (opts.danger) overlay.querySelector("[data-yes]").className = "btn btn-danger";
      function close(r) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener("keydown", onKey);
        resolve(r);
      }
      function onKey(e) { if (e.key === "Escape") close(false); }
      overlay.querySelector(".modal-head button").addEventListener("click", function () { close(false); });
      overlay.querySelector("[data-no]").addEventListener("click", function () { close(false); });
      overlay.querySelector("[data-yes]").addEventListener("click", function () { close(true); });
      overlay.addEventListener("click", function (e) { if (e.target === overlay) close(false); });
      document.addEventListener("keydown", onKey);
      document.body.appendChild(overlay);
    });
  }

  /* ---------------- guards ---------------- */
  function here() { return location.pathname.split("/").pop() || "index.html"; }

  function requireAccount() {
    if (!account()) {
      if (here() !== "index.html") { location.replace("index.html"); return false; }
    }
    return true;
  }

  /* Filing and payment pages need an approved Corporate Tax registration. */
  var GATED = ["ct-filings.html", "return-instructions.html", "return.html", "submitted.html", "payment.html", "disclosure.html"];
  function requireLogin() {
    var page = here();
    if (page === "index.html" || page === "uaepass.html") return true;
    if (!account()) { location.replace("index.html"); return false; }
    if (!Store.get().loggedIn) { location.replace("index.html"); return false; }
    if (GATED.indexOf(page) > -1 && !regApproved()) { location.replace("register.html"); return false; }
    return true;
  }

  /* ---------------- chrome ---------------- */
  var FONT_STEPS = [12, 13, 14, 15, 16, 17, 18];

  function applyFontSize(px) {
    document.documentElement.style.setProperty("--fs", px + "px");
    try { global.localStorage.setItem(BASE_KEY + "_fs", String(px)); } catch (e) {}
  }
  function currentFontSize() {
    var v = 17;
    try { v = parseInt(global.localStorage.getItem(BASE_KEY + "_fs"), 10) || 17; } catch (e) {}
    return FONT_STEPS.indexOf(v) === -1 ? 17 : v;
  }

  function wireChrome() {
    applyFontSize(currentFontSize());

    document.querySelectorAll("[data-font]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-font");
        var i = FONT_STEPS.indexOf(currentFontSize());
        if (mode === "up") i = Math.min(FONT_STEPS.length - 1, i + 1);
        else if (mode === "down") i = Math.max(0, i - 1);
        else i = FONT_STEPS.indexOf(17);
        applyFontSize(FONT_STEPS[i]);
        toast("Text size: " + FONT_STEPS[i] + "px");
      });
    });

    document.querySelectorAll("[data-toggle-sidebar]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var sb = document.querySelector(".et-sidebar");
        if (sb) sb.classList.toggle("collapsed");
      });
    });

    document.querySelectorAll("[data-sim-note]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        toast(el.getAttribute("data-sim-note"), "warn");
      });
    });

    var state = Store.get();
    document.querySelectorAll("[data-fav]").forEach(function (btn) {
      var id = btn.getAttribute("data-fav");
      if (state.favourites[id]) btn.classList.add("on");
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        btn.classList.toggle("on");
        var on = btn.classList.contains("on");
        Store.update(function (s) { s.favourites[id] = on; });
        toast(on ? "Added to My Favourites" : "Removed from My Favourites", on ? "ok" : "");
      });
    });

    document.querySelectorAll("[data-tabs]").forEach(function (group) {
      group.querySelectorAll(".tab").forEach(function (tab) {
        tab.addEventListener("click", function () {
          group.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
          tab.classList.add("active");
          var target = tab.getAttribute("data-tab");
          var scope = document.querySelector(group.getAttribute("data-tabs"));
          if (scope) {
            scope.querySelectorAll("[data-panel]").forEach(function (p) {
              p.classList.toggle("hidden", p.getAttribute("data-panel") !== target);
            });
          }
        });
      });
    });

    document.querySelectorAll("[data-accordion]").forEach(function (head) {
      head.addEventListener("click", function () {
        var panel = document.getElementById(head.getAttribute("data-accordion"));
        if (!panel) return;
        panel.classList.toggle("hidden");
        var caret = head.querySelector(".caret");
        if (caret) caret.style.transform = panel.classList.contains("hidden") ? "" : "rotate(90deg)";
      });
    });

    document.querySelectorAll("[data-filter-table]").forEach(function (input) {
      if (input.tagName !== "INPUT") return;
      input.addEventListener("input", function () {
        var table = document.querySelector(input.getAttribute("data-filter-table"));
        if (!table) return;
        var q = input.value.trim().toLowerCase();
        table.querySelectorAll("tbody tr").forEach(function (tr) {
          tr.classList.toggle("hidden", q !== "" && tr.textContent.toLowerCase().indexOf(q) === -1);
        });
      });
    });

    document.querySelectorAll("select[data-filter-col]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var table = document.querySelector(sel.getAttribute("data-filter-table"));
        if (!table) return;
        var col = parseInt(sel.getAttribute("data-filter-col"), 10);
        var val = sel.value;
        table.querySelectorAll("tbody tr").forEach(function (tr) {
          var cell = tr.children[col];
          var text = cell ? cell.textContent.trim().toLowerCase() : "";
          tr.classList.toggle("hidden", val !== "" && text.indexOf(val.toLowerCase()) === -1);
        });
      });
    });

    document.querySelectorAll("[data-logout]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        confirmDialog({
          title: "Leave Corporate Tax",
          message: "Sign out of the Corporate Tax service? Your saved return is kept.",
          yesText: "Sign out"
        }).then(function (ok) {
          if (!ok) return;
          Store.update(function (s) { s.loggedIn = false; });
          location.href = "index.html";
        });
      });
    });

    document.querySelectorAll("[data-reset-sim]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        confirmDialog({
          title: "Reset Corporate Tax exercise",
          message: "This clears the Corporate Tax registration, the return and its answers. The VAT registration and company details are not affected.",
          yesText: "Reset",
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          Store.reset();
          location.href = "index.html";
        });
      });
    });

    var rib = document.querySelector(".sim-ribbon");
    if (rib && !rib.querySelector("[data-trainer-link]")) {
      var sd = simGet(), tl = document.createElement("a");
      tl.setAttribute("href", "trainer.html"); tl.setAttribute("data-trainer-link", "1");
      tl.style.cssText = "margin-left:10px;color:inherit;text-decoration:underline;font-size:.78rem;white-space:nowrap";
      tl.textContent = sd ? "Trainer: simulated date " + sd.split("-").reverse().join("/") : "Trainer settings";
      rib.appendChild(tl);
    }
    var sideNav = document.querySelector(".et-sidebar nav");
    if (sideNav && !sideNav.querySelector("[data-ct-reg-link]")) {
      var rg = readReg(), lbl = !rg ? "CT REGISTRATION" : "CT REGISTRATION - " + String(rg.status).replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();
      var a = document.createElement("a");
      a.className = "side-link" + (here() === "register.html" ? " active" : "");
      a.setAttribute("href", "register.html"); a.setAttribute("data-ct-reg-link", "1");
      a.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14l2 2 4-4"/></svg><span></span>';
      a.querySelector("span").textContent = lbl;
      sideNav.insertBefore(a, sideNav.children[1] || null);
    }

    var st = Store.get();
    document.querySelectorAll("[data-bind]").forEach(function (el) {
      var path = el.getAttribute("data-bind").split(".");
      var v = st;
      for (var i = 0; i < path.length && v != null; i++) v = v[path[i]];
      el.textContent = (v == null || v === "") ? "\u2014" : v;
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (document.body.hasAttribute("data-public")) {
      if (!requireAccount()) return;
    } else if (!requireLogin()) {
      return;
    }
    wireChrome();
  });

  global.ET = {
    Store: Store,
    account: account,
    uaePass: uaePass,
    emiratesIdRecord: emiratesIdRecord,
    person: person,
    period: period,
    toast: toast,
    confirmDialog: confirmDialog,
    money: money,
    aed: aed,
    toNumber: toNumber,
    todayStr: todayStr,
    stampStr: stampStr,
    penalty: { monthsLate: monthsLate, lateFiling: lateFiling, latePayment: latePayment },
    penaltyDue: penaltyDue,
    appNumber: appNumber,
    now: now,
    vdCalc: vdCalc,
    addBusinessDays: addBusinessDays,
    dmyDate: dmyDate,
    SimDate: { get: simGet, set: simSet, active: function () { return !!simGet(); } },
    periods: periods,
    setActivePeriod: setActivePeriod,
    Reg: { get: readReg, set: writeReg, clear: clearReg, isApproved: regApproved }
  };
})(window);
