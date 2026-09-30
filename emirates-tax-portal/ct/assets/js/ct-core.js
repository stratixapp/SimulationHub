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
    var entityType = a.applicantType || "Legal Person - Incorporated";
    var entitySub = a.registrationType || a.tradeName || "UAE Private Company (incl. an Establishment)";
    return {
      trn: a.trn || s.companyTRN || "",
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

  /* Tax period — the last completed calendar year, due 9 months after it ends. */
  function period() {
    var now = new Date();
    var y = now.getFullYear() - 1;
    return {
      from: "01/01/" + y,
      to: "31/12/" + y,
      yearEnd: "31/12/" + y,
      due: "30/09/" + (y + 1),
      description: "Tax Year End Dec-" + y
    };
  }

  /* ---------------- stored CT data ---------------- */
  var DEFAULTS = {
    loggedIn: false,
    instructionsRead: false,
    step: 1,
    maxStepReached: 1,
    favourites: {},
    filing: { status: "Open", appNumber: "", submittedOn: "", netPosition: 0, snapshot: null, payment: null },
    ct: {}
  };

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

  function readStored() {
    var raw = null;
    try { raw = global.localStorage.getItem(storageKey()); } catch (e) { raw = null; }
    if (raw === null && memoryStore) return clone(memoryStore);
    if (!raw) return clone(DEFAULTS);
    try { return merge(DEFAULTS, JSON.parse(raw)); }
    catch (e) { return clone(DEFAULTS); }
  }

  function writeStored(state) {
    var keep = {
      loggedIn: state.loggedIn,
      instructionsRead: state.instructionsRead,
      step: state.step,
      maxStepReached: state.maxStepReached,
      favourites: state.favourites,
      filing: state.filing,
      ct: state.ct
    };
    memoryStore = clone(keep);
    try { global.localStorage.setItem(storageKey(), JSON.stringify(keep)); } catch (e) {}
    return state;
  }

  var Store = {
    get: function () {
      var s = readStored();
      s.person = person();
      s.period = period();
      return s;
    },
    set: writeStored,
    update: function (fn) { var s = Store.get(); fn(s); return writeStored(s); },
    reset: function () {
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
    n = Math.round(toNumber(n));
    var neg = n < 0;
    var s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-" : "") + s;
  }
  function aed(n) { return "AED " + money(n); }
  function todayStr() {
    var d = new Date(), p = function (x) { return (x < 10 ? "0" : "") + x; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }
  function stampStr() {
    var d = new Date();
    var months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear() +
           ", " + p(d.getHours()) + ":" + p(d.getMinutes()) + " GST";
  }
  function appNumber() {
    return "CTRN-" + new Date().getFullYear() + "-" + Math.floor(100000 + Math.random() * 899999);
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

  function requireLogin() {
    var page = here();
    if (page === "index.html" || page === "uaepass.html") return true;
    if (!account()) { location.replace("index.html"); return false; }
    if (!Store.get().loggedIn) { location.replace("index.html"); return false; }
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
          message: "This clears the Corporate Tax return and its answers. The VAT registration and company details are not affected.",
          yesText: "Reset",
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          Store.reset();
          location.href = "index.html";
        });
      });
    });

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
    appNumber: appNumber
  };
})(window);
