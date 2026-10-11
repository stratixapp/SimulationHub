/* ============================================================
   Corporate Tax payment — Magnati Pay checkout (training replica)
   ------------------------------------------------------------
   Runs only on payment.html, after a Corporate Tax return has
   been submitted. Flow:
     1. Review       — amount, period, due date, method, consent
     2. Fund account — the simulator auto-credits the student's
                       linked training bank account with the exact
                       amount due (no real money, no real bank)
     3. Magnati Pay  — gateway page: pay by account or by card,
                       with a simulated SMS one-time password
     4. Processing   — authorise -> debit -> confirm with FTA
     5. Result       — receipt (PDF / print) or a decline reason
   The payment record is stored in ET.Store under filing.payment.
   Card numbers and CVVs are never stored — only brand + last 4.
   ============================================================ */
(function (global) {
  "use strict";

  var BANK_NAME = "Al Noor Training Bank";
  var SESSION_MS = 10 * 60 * 1000;
  var OTP_LIFE_MS = 3 * 60 * 1000;
  var OTP_RESEND_MS = 30 * 1000;
  var MAX_OTP_TRIES = 3;

  var root = null;
  var S = {
    stage: "review",
    method: "account",     /* gateway tab: account | card */
    funded: false,
    balance: 0,
    amount: 0,
    token: 0,
    timers: [],
    tick: null,
    sessionEnd: 0,
    otp: null,
    otpAt: 0,
    otpTries: 0,
    otpResendAt: 0,
    card: { brand: "CARD", last4: "" },
    fail: null,
    saved: null
  };

  /* ------------------------------ helpers ------------------------------ */
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, ctx) { return (ctx || root).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || root).querySelectorAll(sel)); }
  function reduced() {
    try { return global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  }
  function dur(ms) { return reduced() ? 40 : ms; }
  function rnd(n) { var s = ""; for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 10); return s; }
  function rndAlnum(n) {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    for (var i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  }
  function later(fn, ms) {
    var t = setTimeout(fn, ms);
    S.timers.push(t);
    return t;
  }
  function clearAll() {
    S.timers.forEach(function (t) { clearTimeout(t); });
    S.timers = [];
    if (S.tick) { clearInterval(S.tick); S.tick = null; }
    removeSms();
  }
  function aed(n) { return "AED " + ET.money(n); }
  function state() { return ET.Store.get(); }
  function acctLast4() {
    var p = ET.person();
    var digits = String((p && p.trn) || "").replace(/\D/g, "");
    return digits.length >= 4 ? digits.slice(-4) : "4821";
  }
  function accountLabel() { return BANK_NAME + " \u2022\u2022\u2022\u2022 " + acctLast4(); }

  function parseDue(str) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(str || ""));
    if (!m) return null;
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10), 23, 59, 59);
  }
  function dueInfo() {
    var due = parseDue(ET.period().due);
    if (!due) return { text: "", late: false };
    var diff = Math.ceil((due.getTime() - Date.now()) / 86400000);
    if (diff < 0) return { text: "Due date passed " + Math.abs(diff) + " day" + (Math.abs(diff) === 1 ? "" : "s") + " ago", late: true };
    if (diff === 0) return { text: "Due today", late: false };
    return { text: diff + " day" + (diff === 1 ? "" : "s") + " left to pay", late: false };
  }

  var ICON = {
    tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    lock: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
  };
  var LOGO = '<span class="mp-logo"><b>magnati</b><span class="p">pay</span></span>';
  var LOGO_INV = '<span class="mp-logo inv"><b>magnati</b><span class="p">pay</span></span>';

  /* ------------------------------ stepper ------------------------------ */
  function stepIndex() {
    if (S.stage === "review" || S.stage === "nodue") return 1;
    if (S.stage === "funding") return 2;
    if (S.stage === "gateway" || S.stage === "processing") return 3;
    if (S.stage === "result" && S.fail) return 3;
    return 4;
  }
  function stepperHtml() {
    var cur = stepIndex();
    var allDone = S.stage === "result" && !S.fail;
    var names = ["Review payment", "Fund account", "Magnati Pay", "Confirmation"];
    var out = '<div class="pay-stepper" aria-label="Payment progress">';
    names.forEach(function (n, i) {
      var idx = i + 1;
      var cls = allDone || idx < cur ? "done" : (idx === cur ? "active" : "");
      out += '<div class="pay-step ' + cls + '"><span class="n">' + (cls === "done" ? "\u2713" : idx) + '</span><span class="t">' + n + '</span></div>';
      if (i < names.length - 1) out += '<span class="pay-step-bar' + (allDone || idx < cur ? " done" : "") + '"></span>';
    });
    return out + "</div>";
  }

  function mount(html) {
    clearAll();
    S.token++;
    root.innerHTML = stepperHtml() + html;
    try { global.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }); } catch (e) { global.scrollTo(0, 0); }
  }

  /* ------------------------------ stage 1: review ------------------------------ */
  function summaryRows(f, p, per) {
    return '<div class="pay-rows">' +
      '<div class="pay-row"><span class="l">TRN</span><span class="v">' + esc(p.trn || "\u2014") + '</span></div>' +
      '<div class="pay-row"><span class="l">Registrant&rsquo;s Name</span><span class="v">' + esc(p.nameEn || "\u2014") + '</span></div>' +
      '<div class="pay-row"><span class="l">Application Number</span><span class="v">' + esc(f.appNumber) + '</span></div>' +
      '<div class="pay-row"><span class="l">Submitted On</span><span class="v">' + esc(f.submittedOn) + '</span></div>' +
      '<div class="pay-row"><span class="l">Corporate Tax Period</span><span class="v">' + esc(per.from) + ' &ndash; ' + esc(per.to) + '</span></div>' +
      '<div class="pay-row"><span class="l">Payment Due Date</span><span class="v">' + esc(per.due) + '</span></div>' +
      '</div>';
  }

  function renderReview() {
    S.stage = "review";
    var st = state(), f = st.filing, p = ET.person(), per = ET.period();
    var due = dueInfo();
    mount(
      '<div class="pay-grid">' +
        '<div>' +
          '<div class="pay-card"><div class="pay-card-head"><h2>Payment Summary</h2><span class="pay-chip unpaid"><span class="dot"></span>Payment pending</span></div>' +
            '<div class="pay-card-body">' + summaryRows(f, p, per) + '</div></div>' +
          '<div class="pay-card"><div class="pay-card-head"><h2>Select payment method</h2></div><div class="pay-card-body">' +
            '<div class="pay-methods">' +
              '<div class="pay-method sel" role="radio" aria-checked="true" tabindex="0" id="m-mp"><span class="radio"></span><div><div class="mt">' + LOGO + '</div><div class="md">Pay securely from your bank account or with a debit / credit card</div></div><span class="rec">Recommended</span></div>' +
              '<div class="pay-method off" role="radio" aria-checked="false" aria-disabled="true" data-off="e-Dirham is not available in this exercise"><span class="radio"></span><div><div class="mt">e-Dirham</div><div class="md">Pre-paid government payment card</div></div></div>' +
              '<div class="pay-method off" role="radio" aria-checked="false" aria-disabled="true" data-off="Bank transfer (IBAN) is not available in this exercise"><span class="radio"></span><div><div class="mt">Bank transfer (IBAN)</div><div class="md">Transfer to the FTA collection account</div></div></div>' +
            '</div>' +
            '<label class="pay-check"><input type="checkbox" id="pay-consent"><span>I confirm that the amount shown is the Corporate Tax payable declared in the submitted return and I authorise this payment.</span></label>' +
            '<div class="pay-actions">' +
              '<a class="btn btn-ghost" href="ct-filings.html">Back to Corporate Tax Filings</a>' +
              '<button type="button" class="btn btn-teal btn-lg" id="pay-go" disabled>Continue to payment</button>' +
            '</div>' +
          '</div></div>' +
        '</div>' +
        '<div>' +
          '<div class="pay-amount"><div class="lbl">Net Corporate Tax payable</div>' +
            '<div class="amt"><small>AED</small>' + ET.money(S.amount) + '</div>' +
            '<div class="sub">Tax period ' + esc(per.from) + ' &ndash; ' + esc(per.to) + '</div>' +
            '<span class="pay-due-chip' + (due.late ? " late" : "") + '">' + esc(due.text) + '</span></div>' +
          '<div class="note-box info" style="margin-top:16px"><span>Training simulator: your linked bank account is credited automatically with the exact amount due, then Magnati Pay debits it. No real money moves and no real bank or card is contacted.</span></div>' +
          '<div class="note-box"><span>Payment must reach the Federal Tax Authority by the due date. A late payment penalty applies after the due date.</span></div>' +
        '</div>' +
      '</div>'
    );
    $all(".pay-method.off").forEach(function (el) {
      el.addEventListener("click", function () { ET.toast(el.getAttribute("data-off"), "warn"); });
    });
    var chk = $("#pay-consent"), go = $("#pay-go");
    chk.addEventListener("change", function () { go.disabled = !chk.checked; });
    go.addEventListener("click", function () {
      if (!chk.checked) return;
      renderFunding();
    });
  }

  /* ------------------------------ stage 2: auto-funding ------------------------------ */
  function fundingHtml(done) {
    var steps = [
      ["Connecting to " + BANK_NAME, "Secure link to your linked current account"],
      ["Checking available balance", "Available balance: AED 0"],
      ["Auto-funding your account", "The simulator credits AED " + ET.money(S.amount) + " so the payment can go through"],
      ["Funds received", "AED " + ET.money(S.amount) + " is now available to pay"]
    ];
    var li = steps.map(function (s, i) {
      return '<li id="fs-' + i + '" class="' + (done ? "ok" : "") + '"><span class="ic">\u2713</span><div>' + esc(s[0]) + '<div class="sd">' + esc(s[1]) + '</div></div></li>';
    }).join("");
    return '<div class="pay-grid">' +
      '<div>' +
        '<div class="pay-card"><div class="pay-card-head"><h2>Fund your account</h2><span class="pay-chip unpaid" id="fund-chip"><span class="dot"></span>' + (done ? "Funds received" : "Funding in progress") + '</span></div>' +
          '<div class="pay-card-body"><ul class="pay-seq" id="fund-seq">' + li + '</ul>' +
          '<div id="fund-done" class="' + (done ? "" : "hidden") + '"><div class="note-box ok" style="margin-top:20px;margin-bottom:0"><span><b>AED ' + ET.money(S.amount) + '</b> has been credited to your account. You can now pay with Magnati Pay.</span></div></div>' +
          '<div class="pay-actions">' +
            '<button type="button" class="btn btn-ghost" id="fund-back">Back</button>' +
            '<button type="button" class="btn btn-teal btn-lg" id="fund-next"' + (done ? "" : " disabled") + '>Pay with ' + "Magnati Pay" + '</button>' +
          '</div></div></div>' +
      '</div>' +
      '<div>' +
        '<div class="pay-bank"><div class="bn">' + esc(BANK_NAME) + '</div><div class="bt">Current account &middot; linked</div>' +
          '<div class="ac">\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ' + esc(acctLast4()) + '</div>' +
          '<div class="holder">' + esc(ET.person().nameEn || "Taxable Person") + '</div>' +
          '<div class="pay-bal">Available balance</div>' +
          '<div class="pay-bal-amt" id="bal"><small>AED</small><span id="bal-n">' + (done ? ET.money(S.balance) : "0") + '</span></div></div>' +
        '<div class="pay-amount" style="margin-top:16px"><div class="lbl">Amount to pay</div><div class="amt"><small>AED</small>' + ET.money(S.amount) + '</div></div>' +
      '</div></div>';
  }

  function renderFunding() {
    S.stage = "funding";
    var already = S.funded;
    mount(fundingHtml(already));
    $("#fund-back").addEventListener("click", renderReview);
    $("#fund-next").addEventListener("click", function () { renderGateway(); });
    if (already) return;

    var token = S.token;
    var seq = [900, 1000, 1700, 700];
    var i = 0;
    function setState(idx, cls) { var el = $("#fs-" + idx); if (el) el.className = cls; }
    function step() {
      if (token !== S.token) return;
      if (i >= seq.length) {
        S.funded = true;
        S.balance = S.amount;
        var chip = $("#fund-chip");
        if (chip) { chip.className = "pay-chip paid"; chip.innerHTML = '<span class="dot"></span>Funds received'; }
        var d = $("#fund-done"); if (d) d.className = "";
        var nx = $("#fund-next"); if (nx) nx.disabled = false;
        return;
      }
      setState(i, "run");
      if (i === 2) animateBalance(token, dur(seq[2]));
      var cur = i;
      later(function () {
        if (token !== S.token) return;
        setState(cur, "ok");
        i++;
        step();
      }, dur(seq[cur]));
    }
    step();
  }

  function animateBalance(token, ms) {
    var el = $("#bal-n");
    if (!el) return;
    var t0 = Date.now(), target = S.amount;
    function frame() {
      if (token !== S.token) return;
      var k = Math.min(1, (Date.now() - t0) / ms);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = ET.money(target * eased);
      if (k < 1) later(frame, 30); else el.textContent = ET.money(target);
    }
    frame();
  }

  /* ------------------------------ stage 3: Magnati Pay gateway ------------------------------ */
  function mmss(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  function renderGateway(keepSession) {
    S.stage = "gateway";
    var p = ET.person(), f = state().filing, per = ET.period();
    var wasMethod = S.method;
    mount(
      '<div class="mp-shell" id="mp-shell">' +
        '<div class="mp-top">' + LOGO_INV +
          '<div class="sec">' + ICON.lock + ' Secure payment session <span class="mp-timer" id="mp-timer">10:00</span></div></div>' +
        '<div class="mp-body">' +
          '<aside class="mp-order"><h3>Order summary</h3>' +
            '<div class="mn">Federal Tax Authority &mdash; EmaraTax</div><div class="ms">Corporate Tax payment (training replica)</div>' +
            '<dl>' +
              '<div><dt>Payer</dt><dd>' + esc(p.nameEn || "\u2014") + '</dd></div>' +
              '<div><dt>TRN</dt><dd>' + esc(p.trn || "\u2014") + '</dd></div>' +
              '<div><dt>Reference</dt><dd>' + esc(f.appNumber) + '</dd></div>' +
              '<div><dt>Tax period</dt><dd>' + esc(per.from) + ' &ndash; ' + esc(per.to) + '</dd></div>' +
            '</dl>' +
            '<div class="tot"><div class="l">Total to pay</div><div class="a"><small>AED</small>' + ET.money(S.amount) + '</div></div>' +
          '</aside>' +
          '<section class="mp-main" id="mp-main">' +
            '<h3>Choose how to pay</h3>' +
            '<div class="mp-tabs" role="tablist">' +
              '<button type="button" class="mp-tab" role="tab" data-t="account">Pay by account</button>' +
              '<button type="button" class="mp-tab" role="tab" data-t="card">Pay by card</button>' +
            '</div>' +
            '<div id="tab-account">' +
              '<div class="mp-src"><div class="ico">AN</div><div><div class="t">' + esc(BANK_NAME) + '</div><div class="s">Current account &bull;&bull;&bull;&bull; ' + esc(acctLast4()) + '</div></div>' +
                '<div class="b"><small>Available</small>AED ' + ET.money(S.balance) + '</div></div>' +
              '<button type="button" class="btn btn-teal btn-lg mp-paybtn" id="pay-acct">Pay AED ' + ET.money(S.amount) + '</button>' +
            '</div>' +
            '<div id="tab-card" class="hidden">' +
              '<div class="mp-hint">Test cards &mdash; <code>4111 1111 1111 1111</code> approves &middot; <code>4000 0000 0000 0002</code> is declined &middot; <code>4000 0000 0000 9995</code> has insufficient funds. Use any future expiry and any 3-digit CVV.</div>' +
              '<div class="mp-field rel" id="f-num"><label for="c-num">Card number</label><input id="c-num" inputmode="numeric" autocomplete="off" maxlength="23" placeholder="1234 5678 9012 3456"><span class="mp-cardbrand hidden" id="c-brand"></span><div class="em">Enter a valid card number</div></div>' +
              '<div class="mp-field" id="f-name"><label for="c-name">Name on card</label><input id="c-name" autocomplete="off" maxlength="40" placeholder="AS PRINTED ON CARD"><div class="em">Enter the name on the card</div></div>' +
              '<div class="mp-row2">' +
                '<div class="mp-field" id="f-exp"><label for="c-exp">Expiry (MM/YY)</label><input id="c-exp" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="MM/YY"><div class="em">Enter a valid future expiry</div></div>' +
                '<div class="mp-field" id="f-cvv"><label for="c-cvv">CVV</label><input id="c-cvv" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="123" type="password"><div class="em">Enter the security code</div></div>' +
              '</div>' +
              '<button type="button" class="btn btn-teal btn-lg mp-paybtn" id="pay-card">Pay AED ' + ET.money(S.amount) + '</button>' +
            '</div>' +
            '<a href="#" class="mp-cancel" id="mp-cancel">Cancel and return to EmaraTax</a>' +
          '</section>' +
        '</div>' +
        '<div class="mp-foot"><span>Magnati Pay &mdash; training replica. Not a real payment gateway.</span><span>No card data is stored by this simulator.</span></div>' +
      '</div>'
    );

    if (!keepSession || !S.sessionEnd) S.sessionEnd = Date.now() + SESSION_MS;
    startSessionClock();

    function pick(t) {
      S.method = t;
      $all(".mp-tab").forEach(function (b) {
        var on = b.getAttribute("data-t") === t;
        b.className = "mp-tab" + (on ? " on" : "");
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      $("#tab-account").className = t === "account" ? "" : "hidden";
      $("#tab-card").className = t === "card" ? "" : "hidden";
    }
    $all(".mp-tab").forEach(function (b) {
      b.addEventListener("click", function () { pick(b.getAttribute("data-t")); });
    });
    pick(wasMethod === "card" ? "card" : "account");

    $("#pay-acct").addEventListener("click", function () {
      S.card = { brand: "ACCOUNT", last4: acctLast4() };
      S.method = "account";
      openOtp("account");
    });
    bindCardForm();
    $("#mp-cancel").addEventListener("click", function (e) {
      e.preventDefault();
      ET.confirmDialog({
        title: "Cancel payment",
        message: "Cancel this payment and return to EmaraTax? No money has been taken.",
        yesText: "Cancel payment",
        noText: "Stay here"
      }).then(function (ok) {
        if (!ok) return;
        S.sessionEnd = 0;
        renderReview();
      });
    });
  }

  function startSessionClock() {
    var token = S.token;
    function paint() {
      if (token !== S.token) return;
      var left = S.sessionEnd - Date.now();
      var el = $("#mp-timer");
      if (el) {
        el.textContent = mmss(left);
        el.className = "mp-timer" + (left < 60000 ? " low" : "");
      }
      if (left <= 0) {
        clearAll();
        S.sessionEnd = 0;
        S.fail = { code: "SESSION_TIMEOUT", title: "Payment session expired", msg: "The secure session timed out before the payment was completed. No money has been taken. Start the payment again." };
        renderResult();
      }
    }
    paint();
    S.tick = setInterval(paint, 1000);
  }

  /* ---- card form ---- */
  function luhn(num) {
    var sum = 0, dbl = false;
    for (var i = num.length - 1; i >= 0; i--) {
      var d = parseInt(num.charAt(i), 10);
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return num.length > 0 && sum % 10 === 0;
  }
  function brandOf(num) {
    if (/^4/.test(num)) return "VISA";
    if (/^(5[1-5]|2(2[2-9]|[3-6]|7[01]|720))/.test(num)) return "MASTERCARD";
    if (/^3[47]/.test(num)) return "AMEX";
    return "CARD";
  }
  function bindCardForm() {
    var num = $("#c-num"), exp = $("#c-exp"), cvv = $("#c-cvv"), name = $("#c-name"), brand = $("#c-brand");
    num.addEventListener("input", function () {
      var d = num.value.replace(/\D/g, "").slice(0, 19);
      num.value = d.replace(/(.{4})/g, "$1 ").trim();
      var b = brandOf(d);
      if (d.length >= 1 && b !== "CARD") { brand.textContent = b; brand.className = "mp-cardbrand"; }
      else brand.className = "mp-cardbrand hidden";
      $("#f-num").classList.remove("err");
    });
    exp.addEventListener("input", function () {
      var d = exp.value.replace(/\D/g, "").slice(0, 4);
      exp.value = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
      $("#f-exp").classList.remove("err");
    });
    cvv.addEventListener("input", function () {
      cvv.value = cvv.value.replace(/\D/g, "").slice(0, 4);
      $("#f-cvv").classList.remove("err");
    });
    name.addEventListener("input", function () { $("#f-name").classList.remove("err"); });
    [num, name, exp, cvv].forEach(function (el) {
      el.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submitCard(); } });
    });
    $("#pay-card").addEventListener("click", submitCard);
  }
  function submitCard() {
    var digits = $("#c-num").value.replace(/\D/g, "");
    var b = brandOf(digits);
    var okNum = digits.length >= 13 && digits.length <= 19 && luhn(digits);
    var okName = $("#c-name").value.trim().length >= 2;
    var ex = /^(\d{2})\/(\d{2})$/.exec($("#c-exp").value);
    var okExp = false;
    if (ex) {
      var mm = parseInt(ex[1], 10), yy = 2000 + parseInt(ex[2], 10);
      var now = new Date();
      okExp = mm >= 1 && mm <= 12 && (yy > now.getFullYear() || (yy === now.getFullYear() && mm >= now.getMonth() + 1));
    }
    var need = b === "AMEX" ? 4 : 3;
    var okCvv = $("#c-cvv").value.length === need;
    $("#f-num").classList.toggle("err", !okNum);
    $("#f-name").classList.toggle("err", !okName);
    $("#f-exp").classList.toggle("err", !okExp);
    $("#f-cvv").classList.toggle("err", !okCvv);
    if (!(okNum && okName && okExp && okCvv)) {
      ET.toast("Check the highlighted card details", "warn");
      var bad = $(".mp-field.err input");
      if (bad) bad.focus();
      return;
    }
    S.card = { brand: b, last4: digits.slice(-4), digits: digits };
    S.method = "card";
    openOtp("card");
  }

  /* ---- OTP (simulated SMS) ---- */
  function removeSms() {
    var el = document.getElementById("pay-sms");
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  function showSms() {
    removeSms();
    var el = document.createElement("div");
    el.id = "pay-sms";
    el.className = "pay-sms";
    el.setAttribute("role", "status");
    var mobile = ET.person().mobile || "";
    var tail = String(mobile).replace(/\D/g, "").slice(-3);
    el.innerHTML =
      '<div class="h"><span>MESSAGES &middot; ' + esc(BANK_NAME.toUpperCase()) + '</span><span>now <button type="button" class="x" aria-label="Dismiss">&times;</button></span></div>' +
      '<div>Your one-time password for AED ' + ET.money(S.amount) + ' to Federal Tax Authority via Magnati Pay is <b>' + esc(S.otp) + '</b>. Valid for 3 minutes. Never share this code.' +
      (tail ? '<br><span style="opacity:.6;font-size:.9em">Sent to mobile ending ' + esc(tail) + '</span>' : "") + '</div>';
    document.body.appendChild(el);
    el.querySelector(".x").addEventListener("click", removeSms);
  }
  function newOtp() {
    S.otp = String(100000 + Math.floor(Math.random() * 900000));
    S.otpAt = Date.now();
    S.otpResendAt = Date.now() + OTP_RESEND_MS;
    showSms();
  }

  function openOtp(kind) {
    var main = $("#mp-main");
    if (!main) return;
    var old = $(".mp-otp", main);
    if (old) old.parentNode.removeChild(old);
    S.otpTries = 0;
    newOtp();
    var ov = document.createElement("div");
    ov.className = "mp-otp";
    ov.innerHTML =
      '<h3>Verify it&rsquo;s you</h3>' +
      '<p>Enter the 6-digit one-time password sent by ' + esc(BANK_NAME) + ' to authorise <b>AED ' + ET.money(S.amount) + '</b>' +
      (kind === "card" ? ' on your ' + esc(S.card.brand) + ' ending ' + esc(S.card.last4) : ' from your account') + '.</p>' +
      '<div class="mp-otp-boxes" id="otp-boxes">' +
        [0, 1, 2, 3, 4, 5].map(function (i) { return '<input inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="Digit ' + (i + 1) + '" data-i="' + i + '">'; }).join("") +
      '</div>' +
      '<div class="oerr" id="otp-err" role="alert"></div>' +
      '<button type="button" class="btn btn-teal btn-lg" id="otp-ok">Verify &amp; pay</button>' +
      '<div class="links"><button type="button" id="otp-resend" disabled>Resend code</button><button type="button" id="otp-back">Back</button></div>';
    main.appendChild(ov);

    var boxes = $all("#otp-boxes input", ov);
    boxes[0].focus();
    boxes.forEach(function (b, i) {
      b.addEventListener("input", function () {
        b.value = b.value.replace(/\D/g, "").slice(0, 1);
        $("#otp-boxes").classList.remove("bad");
        if (b.value && i < 5) boxes[i + 1].focus();
      });
      b.addEventListener("keydown", function (e) {
        if (e.key === "Backspace" && !b.value && i > 0) { boxes[i - 1].focus(); boxes[i - 1].value = ""; }
        else if (e.key === "Enter") { e.preventDefault(); verify(); }
        else if (e.key === "ArrowLeft" && i > 0) boxes[i - 1].focus();
        else if (e.key === "ArrowRight" && i < 5) boxes[i + 1].focus();
      });
      b.addEventListener("paste", function (e) {
        var t = (e.clipboardData || global.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6);
        if (!t) return;
        e.preventDefault();
        for (var k = 0; k < 6; k++) boxes[k].value = t.charAt(k) || "";
        boxes[Math.min(t.length, 5)].focus();
      });
    });

    var resend = $("#otp-resend", ov);
    var token = S.token;
    function paintResend() {
      if (token !== S.token) return;
      var left = S.otpResendAt - Date.now();
      if (left > 0) {
        resend.disabled = true;
        resend.textContent = "Resend code in " + Math.ceil(left / 1000) + "s";
        later(paintResend, 500);
      } else {
        resend.disabled = false;
        resend.textContent = "Resend code";
      }
    }
    paintResend();
    resend.addEventListener("click", function () {
      newOtp();
      boxes.forEach(function (b) { b.value = ""; });
      boxes[0].focus();
      $("#otp-err").textContent = "";
      ET.toast("A new code has been sent", "ok");
      paintResend();
    });
    $("#otp-back", ov).addEventListener("click", function () {
      removeSms();
      S.otp = null;
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    });
    $("#otp-ok", ov).addEventListener("click", verify);

    function verify() {
      var code = boxes.map(function (b) { return b.value; }).join("");
      var err = $("#otp-err");
      var wrap = $("#otp-boxes");
      if (code.length < 6) { err.textContent = "Enter all 6 digits."; return; }
      if (Date.now() - S.otpAt > OTP_LIFE_MS) {
        err.textContent = "This code has expired. Request a new one.";
        return;
      }
      if (code !== S.otp) {
        S.otpTries++;
        var left = MAX_OTP_TRIES - S.otpTries;
        wrap.classList.remove("bad"); void wrap.offsetWidth; wrap.classList.add("bad");
        if (left <= 0) {
          removeSms();
          clearAll();
          S.sessionEnd = 0;
          S.fail = { code: "OTP_LOCKED", title: "Authentication failed", msg: "The one-time password was entered incorrectly 3 times, so the payment was stopped for your protection. No money has been taken." };
          renderResult();
          return;
        }
        err.textContent = "Incorrect code. " + left + " attempt" + (left === 1 ? "" : "s") + " left.";
        boxes.forEach(function (b) { b.value = ""; });
        boxes[0].focus();
        return;
      }
      removeSms();
      S.otp = null;
      renderProcessing();
    }
  }

  /* ------------------------------ stage 4: processing ------------------------------ */
  function renderProcessing() {
    var keepEnd = S.sessionEnd;
    S.stage = "processing";
    var steps = [
      ["Authorising with your bank", "Verifying the one-time password"],
      ["Debiting AED " + ET.money(S.amount), S.method === "card" ? "Charging your " + S.card.brand + " card" : "Debiting " + accountLabel()],
      ["Confirming with the Federal Tax Authority", "Allocating the payment to your Corporate Tax account"],
      ["Issuing your receipt", "Generating payment reference"]
    ];
    mount(
      '<div class="pay-card pay-proc"><div class="pay-spinner" role="progressbar" aria-label="Processing payment"></div>' +
        '<h2>Processing your payment</h2><p class="s">Please do not refresh or close this page.</p>' +
        '<ul class="pay-seq" id="proc-seq">' +
        steps.map(function (s, i) {
          return '<li id="ps-' + i + '"><span class="ic">\u2713</span><div>' + esc(s[0]) + '<div class="sd">' + esc(s[1]) + '</div></div></li>';
        }).join("") + '</ul></div>'
    );
    S.sessionEnd = keepEnd;
    var token = S.token, i = 0;
    var ms = [800, 900, 1000, 600];
    function step() {
      if (token !== S.token) return;
      if (i >= steps.length) { settle(); return; }
      var el = $("#ps-" + i);
      if (el) el.className = "run";
      var cur = i;
      later(function () {
        if (token !== S.token) return;
        var e2 = $("#ps-" + cur);
        if (e2) e2.className = "ok";
        i++;
        step();
      }, dur(ms[cur]));
    }
    step();
  }

  function settle() {
    S.fail = null;
    if (S.method === "card") {
      var n = S.card.digits || "";
      if (n === "4000000000000002") {
        S.fail = { code: "05", title: "Card declined", msg: "Your card issuer declined the payment (response code 05 \u2014 Do not honour). Try a different card or pay from your bank account. No money has been taken." };
      } else if (n === "4000000000009995") {
        S.fail = { code: "51", title: "Insufficient funds", msg: "The card does not have enough available balance for AED " + ET.money(S.amount) + " (response code 51). Try a different card or pay from your bank account. No money has been taken." };
      }
    } else if (S.balance < S.amount) {
      S.fail = { code: "51", title: "Insufficient funds", msg: "The available balance in your account is lower than the amount due. No money has been taken." };
    }
    if (S.fail) { S.sessionEnd = 0; S.card = { brand: "CARD", last4: "" }; renderResult(); return; }

    var paid = {
      status: "Paid",
      reference: "CTPAY-" + new Date().getFullYear() + "-" + rnd(6),
      gatewayTxn: "MP" + rnd(12),
      authCode: rndAlnum(6),
      method: S.method === "card" ? "Card" : "Bank account",
      instrument: S.method === "card" ? S.card.brand + " \u2022\u2022\u2022\u2022 " + S.card.last4 : accountLabel(),
      amount: S.amount,
      paidOn: ET.stampStr(),
      paidOnDate: ET.todayStr(),
      balanceAfter: S.method === "card" ? null : S.balance - S.amount
    };
    ET.Store.update(function (s) { s.filing.payment = paid; });
    S.saved = paid;
    S.sessionEnd = 0;
    S.card = { brand: "CARD", last4: "" };
    renderResult();
  }

  /* ------------------------------ stage 5: result ------------------------------ */
  function renderResult() {
    S.stage = "result";
    var st = state(), f = st.filing, p = ET.person(), per = ET.period();
    var pay = f.payment && f.payment.status === "Paid" ? f.payment : null;

    if (S.fail && !pay) {
      var fl = S.fail;
      mount(
        '<div class="pay-result"><div class="pay-card"><div class="pay-result-head">' +
          '<div class="pay-tick bad">' + ICON.cross + '</div><h2>' + esc(fl.title) + '</h2><p>Your Corporate Tax payment was not completed.</p></div>' +
          '<div class="pay-card-body"><div class="pay-fail-reason"><b>Reason (' + esc(fl.code) + ')</b>' + esc(fl.msg) + '</div>' +
          '<div class="pay-actions" style="justify-content:center">' +
            '<a class="btn btn-ghost" href="ct-filings.html">Cancel payment</a>' +
            '<button type="button" class="btn btn-teal btn-lg" id="pay-retry">Try again</button>' +
          '</div></div></div></div>'
      );
      $("#pay-retry").addEventListener("click", function () {
        S.fail = null;
        S.sessionEnd = 0;
        renderGateway(false);
      });
      return;
    }

    var alreadyNote = S.saved && S.saved.reference === pay.reference ? "" :
      '<div class="note-box info"><span>This Corporate Tax return has already been paid. The receipt below is the record of that payment.</span></div>';
    mount(
      '<div class="pay-result"><div class="pay-card">' +
        '<div class="pay-result-head"><div class="pay-tick">' + ICON.tick + '</div><h2>Payment successful</h2>' +
        '<p>Your Corporate Tax payment of <b>' + aed(pay.amount) + '</b> has been received.</p></div>' +
        '<div class="pay-card-body">' + alreadyNote +
          '<div class="pay-receipt"><div class="rh"><span>PAYMENT RECEIPT</span><span>' + esc(pay.reference) + '</span></div><div class="rb">' +
            '<div class="pay-rows">' +
              '<div class="pay-row"><span class="l">Registrant&rsquo;s Name</span><span class="v">' + esc(p.nameEn || "\u2014") + '</span></div>' +
              '<div class="pay-row"><span class="l">TRN</span><span class="v">' + esc(p.trn || "\u2014") + '</span></div>' +
              '<div class="pay-row"><span class="l">Return Application No.</span><span class="v">' + esc(f.appNumber) + '</span></div>' +
              '<div class="pay-row"><span class="l">Corporate Tax Period</span><span class="v">' + esc(per.from) + ' &ndash; ' + esc(per.to) + '</span></div>' +
              '<div class="pay-row"><span class="l">Payment Date &amp; Time</span><span class="v">' + esc(pay.paidOn) + '</span></div>' +
              '<div class="pay-row"><span class="l">Payment Method</span><span class="v">Magnati Pay &middot; ' + esc(pay.method) + '</span></div>' +
              '<div class="pay-row"><span class="l">Paid with</span><span class="v">' + esc(pay.instrument) + '</span></div>' +
              '<div class="pay-row"><span class="l">Magnati Transaction ID</span><span class="v">' + esc(pay.gatewayTxn) + '</span></div>' +
              '<div class="pay-row"><span class="l">Authorisation Code</span><span class="v">' + esc(pay.authCode) + '</span></div>' +
              (pay.balanceAfter == null ? "" : '<div class="pay-row"><span class="l">Account balance after payment</span><span class="v">' + aed(pay.balanceAfter) + '</span></div>') +
            '</div>' +
            '<div class="rt"><span>AMOUNT PAID</span><span>' + aed(pay.amount) + '</span></div>' +
          '</div></div>' +
          '<div class="pay-actions" style="justify-content:center">' +
            '<a class="btn btn-ghost" href="ct-filings.html">Back to Corporate Tax Filings</a>' +
            '<button type="button" class="btn btn-outline-navy" id="pay-print">Print receipt</button>' +
            '<button type="button" class="btn btn-primary" id="pay-pdf">Download receipt PDF</button>' +
          '</div>' +
        '</div></div></div>'
    );
    $("#pay-print").addEventListener("click", function () { global.print(); });
    $("#pay-pdf").addEventListener("click", function () { ET_CT_PDF.receipt(); });
  }

  /* ------------------------------ nothing due ------------------------------ */
  function renderNoDue() {
    S.stage = "nodue";
    mount(
      '<div class="pay-card"><div class="pay-card-head"><h2>Corporate Tax payment</h2><span class="pay-chip none">No payment due</span></div>' +
      '<div class="pay-card-body"><div class="note-box ok"><span>The submitted Corporate Tax return shows a net payable of AED 0 for this period, so there is nothing to pay.</span></div>' +
      '<div class="pay-actions"><a class="btn btn-ghost" href="ct-filings.html">Back to Corporate Tax Filings</a></div></div></div>'
    );
  }

  /* ------------------------------ start ------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    root = document.getElementById("pay-root");
    if (!root) return;
    var f = state().filing;
    if (f.status !== "Submitted") { location.replace("ct-filings.html"); return; }
    S.amount = Math.round(ET.toNumber(f.netPosition));
    if (f.payment && f.payment.status === "Paid") { renderResult(); return; }
    if (S.amount <= 0) { renderNoDue(); return; }
    renderReview();
  });

  global.addEventListener("beforeunload", clearAll);
})(window);
