/* =========================================================================
   ICEGATE — ICEGATE "SUBMIT & SIGN" CONSOLE  (final step of a Shipping Bill)
   =========================================================================
   Filing a Shipping Bill used to end with two ticks and a button. On the real
   ICEGATE portal the last stretch is much harder: you finish the form, then
   "Submit & Sign" puts you through checklist verification, the Section 50
   declaration, DSC certificate selection + token PIN, an OTP check, and only
   then does the Bill go to ICES — which can time out and has to be retried.

   This module replaces that last step for EXPORT filings. It adds no form
   fields — the Shipping Bill's fields are unchanged. Six gates, in order:

     1  Pre-submission validation   (every check must pass)
     2  Draft checklist             (verify each section + re-key IEC, invoice
                                     value and package count from the checklist)
     3  Declarations               (5 separate clauses + signatory name/designation)
     4  Digital signature (DSC)    (detect token, pick the RIGHT certificate —
                                     expired / wrong holder / Class 2 are traps —
                                     token PIN, 3 wrong tries locks the token)
     5  OTP verification           (3-minute OTP, 3 tries, resend cooldown)
     6  Submission to ICES         (staged transmission; ICEGATE can answer
                                     "503 server busy" — retry, nothing is lost)

   Everything tunable lives in window.TCOS_FINAL_FILING (set it BEFORE this
   script loads, or edit the defaults below). Set export:false to go back to
   the old two-tick submit; set import:true to use the same gauntlet for the
   Bill of Entry.
   ========================================================================= */
(function () {
  "use strict";
  const CFG = window.TCOS_FINAL_FILING = Object.assign({
    export: true, import: false,
    pinAttempts: 3, lockSeconds: 30,
    otpValidSeconds: 180, otpResendSeconds: 15, otpAttempts: 3,
    serverBusyChance: 0.18, maxConsecutiveBusy: 2,
    stageMs: 650
  }, window.TCOS_FINAL_FILING || {});

  if (typeof wzSubmit !== "function" || typeof reviewStepHTML !== "function") return; // filing wizard not present

  const legacyWzSubmit = wzSubmit;
  const origReviewStepHTML = reviewStepHTML;
  const GATES = ["Pre-submission validation", "Draft checklist", "Declarations", "Digital signature (DSC)", "OTP verification", "Submit to ICES"];
  const q = (sel, root) => (root || document).querySelector(sel);
  const E = s => (typeof esc === "function" ? esc(s) : String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
  const norm = s => String(s == null ? "" : s).toLowerCase().replace(/\s+/g, " ").trim();
  const enabledFor = f => !!(f && CFG[f.type]);
  const fmtDate = t => { const d = new Date(t); return String(d.getDate()).padStart(2, "0") + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + d.getFullYear(); };

  /* ---------------- review step: swap the two ticks for "Submit & Sign" ---------------- */
  reviewStepHTML = function (filing) {
    let html = origReviewStepHTML(filing);
    if (!enabledFor(filing)) return html;
    const decl = /<div class="declaration">[\s\S]*?<\/div>\s*(<div id="validationResults">)/;
    const note = '<div class="declaration">' +
      '<p style="margin:0 0 6px"><b>Submit &amp; Sign</b> opens the ICEGATE signing console. Before ICES accepts the Shipping Bill you will have to: ' +
      'pass pre-submission validation, verify the draft checklist, make the Section 50 declarations, sign with your Class-3 DSC (token PIN), and confirm the OTP.</p>' +
      '<p class="hint" style="margin:0">Your form stays exactly as filled — you can cancel at any gate and return here to correct something.</p>' +
      '<input type="checkbox" id="declareBox" style="display:none"><input type="checkbox" id="dscBox" style="display:none"></div>$1';
    if (decl.test(html)) html = html.replace(decl, note);
    return html.replace(/>\s*Submit Filing\s*</, ">Submit &amp; Sign<");
  };

  wzSubmit = function () {
    const filing = typeof WZ !== "undefined" && WZ && WZ.filing;
    if (!filing || !enabledFor(filing)) return legacyWzSubmit();
    openConsole(filing);
  };

  /* ---------------- state ---------------- */
  let S = null;

  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function tokenPin() { return String(100000 + (hashStr("pin:" + (STATE.user && STATE.user.userId)) % 900000)); }
  /* The person who signs is the Signatory named in step "Digital Signature & Submission" (for a CHA-filed bill that is the
     Customs Broker's signatory, not the exporter's authorised person); older filings fall back to the Authorized Person. */
  function signerName(f) { return (f.icegate && f.icegate.signatoryName) || (f.party && f.party.authorizedPerson) || (STATE.user && STATE.user.profile && STATE.user.profile.name) || ""; }
  function signerDesignation(f) { return (f.icegate && f.icegate.signatoryDesignation) || ""; }
  function maskedMobile(f) {
    const d = String((f.party && f.party.contact) || (STATE.user && STATE.user.profile && STATE.user.profile.mobile) || "").replace(/\D/g, "");
    return d.length >= 4 ? "XXXXXX" + d.slice(-4) : "98XXXXXX21";
  }

  function buildCerts(f) {
    const now = Date.now(), day = 86400000, holder = signerName(f) || "Authorised Signatory";
    const pan = (STATE.user && STATE.user.profile && STATE.user.profile.pan && STATE.user.profile.pan !== "—") ? STATE.user.profile.pan : ((f.party && f.party.pan) || "AAAPA0000A");
    const mk = (tag, h, cls, validTo, p, issuer) => ({ id: tag, holder: h, cls: cls, validTo: validTo, pan: p, issuer: issuer, serial: String(10000000 + hashStr(tag + f.id + h) % 89999999) });
    const list = [
      mk("valid", holder, 3, now + 400 * day, pan, "(n)Code Solutions CA"),
      mk("expired", holder, 3, now - 45 * day, pan, "eMudhra CA"),
      mk("other", "Mahesh Kumar Nair", 3, now + 300 * day, "BXPPN4812Q", "Capricorn CA"),
      mk("class2", holder, 2, now + 200 * day, pan, "Sify SafeScrypt CA")
    ];
    return list.sort((a, b) => hashStr(f.id + a.id) - hashStr(f.id + b.id));
  }

  function openConsole(filing) {
    closeConsole(true);
    S = {
      filing: filing, gate: 1, maxGate: 1, verified: {}, rekeyBad: [], declOK: false, declErr: "",
      g1: null, g1Done: false, dscStage: "detect", certs: buildCerts(filing), certSel: null, dscErr: "", pinTries: 0, lockUntil: 0, dscSigned: null,
      otp: { code: null, exp: 0, tries: 0, resendAt: 0, ok: false }, otpErr: "",
      subLog: [], subState: "idle", busyStreak: 0, submitAttempts: 0, timers: [], at: {}
    };
    const ov = document.createElement("div");
    ov.className = "icg-overlay"; ov.id = "icgOverlay";
    ov.innerHTML = '<div class="icg-shell"><div class="icg-flag"></div><div class="icg-head"><div><h2>ICEGATE · Shipping Bill — Submit &amp; Sign</h2>' +
      '<div class="sub">Indian Customs EDI System (ICES) · TRAINING ENVIRONMENT</div></div><div class="trn">Shipping Bill ' + E(filing.id) + '</div></div>' +
      '<div class="icg-body"><div class="icg-steps" id="icgSteps"></div><div class="icg-main" id="icgMain" style="position:relative"></div></div>' +
      '<div class="icg-foot" id="icgFoot"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener("click", onClick);
    ov.addEventListener("change", onChange);
    runGate1();
    render();
  }
  function closeConsole(silent) {
    if (S) S.timers.forEach(t => { clearTimeout(t); clearInterval(t); });
    const ov = q("#icgOverlay"); if (ov) ov.remove();
    S = null;
  }
  function later(fn, ms) { const t = setTimeout(fn, ms); S && S.timers.push(t); return t; }

  /* ---------------- gate 1 ---------------- */
  const G1_ROWS = [
    ["IEC, PAN and GSTIN linkage (DGFT / GSTN)", ["party"]],
    ["Consignee and destination country", ["counterparty"]],
    ["Shipment, port and vessel particulars", ["shipment"]],
    ["Invoice value, currency and incoterm", ["invoice"]],
    ["Item lines and HS code master check", ["items", "item"]],
    ["Package and weight consistency", ["packages", "containers", "package"]],
    ["e-Sanchit supporting documents", ["documents", "document"]],
    ["Export scheme and licence", ["scheme", "licen"]],
    ["Declarant and ICEGATE particulars", ["icegate", "authorized", "declarant"]]
  ];
  function runGate1() {
    const errs = (typeof validateAll === "function" ? validateAll(S.filing) : []) || [];
    S.filing.validationErrors = errs;
    const used = new Set();
    const rows = G1_ROWS.map(r => {
      const hit = errs.filter(e => r[1].some(p => String(e.field || "").toLowerCase().indexOf(p) === 0 || String(e.field || "").toLowerCase().indexOf("." + p) >= 0));
      hit.forEach(h => used.add(h));
      return { label: r[0], errs: hit, shown: false };
    });
    const other = errs.filter(e => !used.has(e));
    if (other.length) rows.push({ label: "Other declaration checks", errs: other, shown: false });
    S.g1 = { rows: rows, total: errs.length };
    S.g1Done = false;
    rows.forEach((r, i) => later(() => { if (!S) return; r.shown = true; if (i === rows.length - 1) S.g1Done = true; render(); }, 250 * (i + 1)));
  }
  function gate1HTML() {
    const rows = S.g1.rows.map(r => '<tr><td>' + E(r.label) + '</td><td>' + (!r.shown ? '<span class="icg-wait">Checking…</span>' : (r.errs.length ? '<span class="icg-fail">✗ ' + r.errs.length + ' error' + (r.errs.length > 1 ? 's' : '') + '</span>' : '<span class="icg-pass">✓ Passed</span>')) + '</td></tr>').join('');
    let out = '<h3>1 · Pre-submission validation</h3><p class="lead">ICES runs these checks on your Shipping Bill before it can be signed. Every check must pass.</p>' +
      '<table class="icg-table"><thead><tr><th>Check</th><th style="width:150px">Result</th></tr></thead><tbody>' + rows + '</tbody></table>';
    if (S.g1Done) {
      if (S.g1.total) {
        out += '<div class="icg-err"><b>' + S.g1.total + ' validation error' + (S.g1.total > 1 ? 's' : '') + ' — the Shipping Bill cannot be signed yet.</b><br>' +
          S.g1.rows.filter(r => r.errs.length).map(r => r.errs.map(e => '• ' + E(e.message || e.field)).join('<br>')).join('<br>') +
          '<br><br>Cancel, correct these in the form, then choose Submit &amp; Sign again.</div>';
      } else out += '<div class="icg-ok">All pre-submission checks passed.</div>';
    }
    return out;
  }

  /* ---------------- gate 2 ---------------- */
  function kvPairs(obj) {
    return Object.keys(obj || {}).filter(k => !/^__/.test(k) && typeof obj[k] !== "object" && obj[k] !== "" && obj[k] != null)
      .map(k => [k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()), obj[k]]);
  }
  function checklistSections() {
    const f = S.filing;
    const secs = [
      ["Exporter", kvPairs(f.party)], ["Consignee", kvPairs(f.counterparty)], ["Shipment", kvPairs(f.shipment)], ["Invoice", kvPairs(f.invoice)],
      ["Items", (f.items || []).map((it, i) => ["Item " + (i + 1), (it.description || "") + " · HS " + (it.hsCode || "") + " · " + (it.qty || 0) + " " + (it.unit || "") + " @ " + (it.unitPrice || 0)])],
      ["Packages", kvPairs(f.packages)],
      ["Supporting documents", (f.documents || []).map(d => [d.type, d.status || ""])],
      ["Export scheme / licence", kvPairs(f.scheme)],
      ["Declarant & ICEGATE particulars", kvPairs(f.icegate)]
    ];
    return secs;
  }
  function gate2HTML() {
    const secs = checklistSections();
    const sec = secs.map((s, i) => '<div class="icg-chk-sec"><div class="t"><span>' + E(s[0]) + '</span><label><input type="checkbox" data-verify="' + i + '"' + (S.verified[i] ? " checked" : "") + '> I have verified this section</label></div>' +
      '<div class="kvs">' + (s[1].length ? s[1].map(p => '<div><span>' + E(p[0]) + ':</span> <b>' + E(p[1]) + '</b></div>').join("") : '<div><span>Nothing declared in this section.</span></div>') + '</div></div>').join("");
    const bad = S.rekeyBad || [];
    const fld = (id, label) => '<div class="icg-field"><label>' + label + '</label><input id="' + id + '" autocomplete="off"' + (bad.indexOf(id) >= 0 ? ' style="border-color:#b3261e"' : "") + ' value="' + E(S["rk_" + id] || "") + '"></div>';
    return '<h3>2 · Draft checklist</h3><p class="lead">ICEGATE generates a draft checklist of what you have declared. Read it carefully, confirm every section, then <b>re-key</b> three critical values from it — a typing slip here is exactly what this control exists to catch.</p>' +
      sec + '<h4 style="margin:14px 0 6px;color:#12396b">Re-key critical values</h4>' + fld("rkIec", "IEC of the exporter") + fld("rkValue", "Total invoice value (number only)") + fld("rkPkgs", "Number of packages") +
      (S.g2Err ? '<div class="icg-err">' + S.g2Err + '</div>' : "");
  }
  function verifyGate2() {
    const secs = checklistSections();
    S.rk_rkIec = (q("#rkIec") || {}).value || ""; S.rk_rkValue = (q("#rkValue") || {}).value || ""; S.rk_rkPkgs = (q("#rkPkgs") || {}).value || "";
    const missing = secs.map((s, i) => i).filter(i => !S.verified[i]);
    if (missing.length) { S.g2Err = "Please verify every section of the checklist (" + missing.length + " not yet verified)."; S.rekeyBad = []; return false; }
    const f = S.filing, bad = [];
    if (norm(S.rk_rkIec) !== norm((f.party || {}).iec)) bad.push("rkIec");
    if (!(Math.abs(Number(S.rk_rkValue) - Number((f.invoice || {}).invoiceValue)) < 0.005) || S.rk_rkValue.trim() === "") bad.push("rkValue");
    if (!(Number(S.rk_rkPkgs) === Number((f.packages || {}).numberOfPackages)) || S.rk_rkPkgs.trim() === "") bad.push("rkPkgs");
    S.rekeyBad = bad;
    if (bad.length) { S.g2Err = "Re-keyed value does not match the draft checklist: " + bad.map(b => ({ rkIec: "IEC", rkValue: "Invoice value", rkPkgs: "Number of packages" }[b])).join(", ") + ". Check the checklist above and type it again."; return false; }
    S.g2Err = ""; S.at.checklist = Date.now(); return true;
  }

  /* ---------------- gate 3 ---------------- */
  const DECLS = [
    "I declare that the particulars given in this Shipping Bill are true and correct, and I subscribe to this declaration as to the truth of its contents under Section 50 of the Customs Act, 1962.",
    "The quality and specification of the goods are as stated in the export contract / invoice, and the invoice value is the actual price payable.",
    "Export proceeds will be realised in India through an Authorised Dealer bank within the period prescribed under FEMA / RBI directions.",
    "The goods are not prohibited for export, and any licence, NOC or permission required for restricted goods is attached in e-Sanchit.",
    "Documents uploaded in e-Sanchit are true copies of the originals; I will retain the originals and produce them to Customs on demand."
  ];
  function gate3HTML() {
    const decls = DECLS.map((d, i) => '<label class="icg-decl"><input type="checkbox" data-decl="' + i + '"' + ((S.declChecked || {})[i] ? " checked" : "") + '><span>' + E(d) + '</span></label>').join("");
    return '<h3>3 · Declarations</h3><p class="lead">Each declaration is a separate legal statement — accept every one individually, then sign the declaration with the Signatory name and designation exactly as entered in this Shipping Bill.</p>' + decls +
      '<div class="icg-field" style="margin-top:12px"><label>Name of declarant (type in full)</label><input id="declName" autocomplete="off" value="' + E(S.declName || "") + '"></div>' +
      '<div class="icg-field"><label>Designation (as entered in the Signatory details)</label><input id="declDesig" autocomplete="off" value="' + E(S.declDesig || "") + '"></div>' +
      (S.declErr ? '<div class="icg-err">' + S.declErr + '</div>' : "");
  }
  function verifyGate3() {
    S.declName = (q("#declName") || {}).value || ""; S.declDesig = (q("#declDesig") || {}).value || "";
    const chk = S.declChecked || {}, n = DECLS.filter((d, i) => chk[i]).length;
    if (n < DECLS.length) { S.declErr = "You must accept all " + DECLS.length + " declarations (" + n + " accepted)."; return false; }
    if (norm(S.declName) !== norm(signerName(S.filing))) { S.declErr = "The declarant name does not match the Signatory Name entered in this Shipping Bill."; return false; }
    if (!S.declDesig.trim()) { S.declErr = "Enter the designation of the declarant."; return false; }
    if (signerDesignation(S.filing) && norm(S.declDesig) !== norm(signerDesignation(S.filing))) { S.declErr = "The designation does not match the Signatory Designation entered in this Shipping Bill."; return false; }
    S.declErr = ""; S.at.declared = Date.now(); return true;
  }

  /* ---------------- gate 4 (DSC) ---------------- */
  function gate4HTML() {
    const st = S.dscStage, now = Date.now();
    let out = '<h3>4 · Digital signature (DSC)</h3><p class="lead">Every Shipping Bill must be signed with a valid Class-3 Digital Signature Certificate belonging to the declarant.</p>';
    if (st === "detect") {
      out += '<div class="icg-warn">Insert your DSC token, then click <b>Detect token</b>.</div>' + (S.detecting ? '<p class="icg-wait">Looking for a DSC token on this computer…</p>' : "");
    } else if (st === "select") {
      out += '<div class="icg-ok">Token detected: <b>ePass2003 (Feitian)</b> — serial ' + E(String(40000000 + hashStr(S.filing.id) % 5000000)) + '</div>' +
        '<table class="icg-table"><thead><tr><th></th><th>Holder</th><th>PAN</th><th>Class</th><th>Issued by</th><th>Valid till</th><th>Serial</th></tr></thead><tbody>' +
        S.certs.map(c => '<tr class="' + (S.certSel === c.id ? "sel" : "") + '"><td><input type="radio" name="cert" data-cert="' + c.id + '"' + (S.certSel === c.id ? " checked" : "") + '></td><td>' + E(c.holder) + '</td><td>' + E(c.pan) + '</td><td>Class ' + c.cls + '</td><td>' + E(c.issuer) + '</td><td>' + fmtDate(c.validTo) + '</td><td>' + E(c.serial) + '</td></tr>').join("") +
        '</tbody></table><p class="lead">Select the certificate that must sign this Shipping Bill.</p>';
    } else if (st === "pin") {
      const locked = S.lockUntil > now;
      out += '<div class="icg-ok">Certificate selected: <b>' + E(S.dscSigned.holder) + '</b> · Class 3 · valid till ' + fmtDate(S.dscSigned.validTo) + '</div>' +
        '<div class="icg-field"><label>Token PIN</label><input id="icgDscPin" type="password" inputmode="numeric" autocomplete="off"' + (locked ? " disabled" : "") + '></div>' +
        '<div class="icg-token">TRAINING NOTE — token PIN for this training account: <code>' + tokenPin() + '</code>. On a real token the PIN is set by you; ' + CFG.pinAttempts + ' wrong attempts lock it.</div>';
      if (locked) out += '<div class="icg-err">Token locked after ' + CFG.pinAttempts + ' wrong PIN attempts. Try again in <b id="icgLockLeft">' + Math.ceil((S.lockUntil - now) / 1000) + '</b>s (on a real token you would have to contact your certifying authority).</div>';
    }
    if (S.dscErr) out += '<div class="icg-err">' + S.dscErr + '</div>';
    return out;
  }
  function chooseCert() {
    const c = S.certs.find(x => x.id === S.certSel), f = S.filing;
    if (!c) { S.dscErr = "Select a certificate first."; return false; }
    if (c.validTo < Date.now()) { S.dscErr = "Certificate " + E(c.serial) + " expired on " + fmtDate(c.validTo) + ". Select a valid certificate."; return false; }
    if (c.cls !== 3) { S.dscErr = "Class " + c.cls + " certificates are not accepted for ICEGATE e-filing — a Class-3 DSC is mandatory."; return false; }
    if (norm(c.holder) !== norm(signerName(f))) { S.dscErr = "The certificate holder (" + E(c.holder) + ") is not the declarant of this Shipping Bill (" + E(signerName(f)) + ")."; return false; }
    S.dscSigned = c; S.dscErr = ""; S.dscStage = "pin"; return true;
  }
  function submitPin() {
    if (S.lockUntil > Date.now()) return;
    const v = ((q("#icgDscPin") || {}).value || "").trim();
    if (v === tokenPin()) { S.dscErr = ""; S.at.dsc = Date.now(); S.dscStage = "done"; return true; }
    S.pinTries++;
    const left = CFG.pinAttempts - S.pinTries;
    if (left <= 0) {
      S.lockUntil = Date.now() + CFG.lockSeconds * 1000; S.pinTries = 0; S.dscErr = "";
      const t = setInterval(() => { if (!S) return clearInterval(t); const el = q("#icgLockLeft"); const rem = Math.ceil((S.lockUntil - Date.now()) / 1000); if (rem <= 0) { clearInterval(t); render(); } else if (el) el.textContent = rem; }, 500);
      S.timers.push(t);
    } else S.dscErr = "Incorrect PIN. " + left + " attempt" + (left > 1 ? "s" : "") + " remaining before the token locks.";
    return false;
  }

  /* ---------------- gate 5 (OTP) ---------------- */
  function sendOtp() {
    const o = S.otp, now = Date.now();
    if (o.resendAt > now) return;
    o.code = String(100000 + Math.floor(Math.random() * 900000)); o.exp = now + CFG.otpValidSeconds * 1000; o.tries = 0; o.resendAt = now + CFG.otpResendSeconds * 1000; S.otpErr = "";
    const t = setInterval(() => { if (!S) return clearInterval(t); const el = q("#icgOtpLeft"); const rem = Math.max(0, Math.ceil((o.exp - Date.now()) / 1000)); if (el) el.textContent = Math.floor(rem / 60) + ":" + String(rem % 60).padStart(2, "0"); const rb = q("#icgResend"); if (rb) rb.disabled = o.resendAt > Date.now(); if (rem <= 0) { clearInterval(t); render(); } }, 500);
    S.timers.push(t);
  }
  function gate5HTML() {
    const o = S.otp, now = Date.now(), live = o.code && o.exp > now;
    let out = '<h3>5 · OTP verification</h3><p class="lead">An OTP is sent to the mobile number registered with ICEGATE (' + E(maskedMobile(S.filing)) + '). Enter it to authorise the submission.</p>';
    if (!o.code) out += '<button class="icg-btn" data-act="sendotp">Send OTP</button>';
    else {
      out += '<div class="icg-field"><label>Enter 6-digit OTP</label><input id="otpIn" inputmode="numeric" maxlength="6" autocomplete="off"' + (live ? "" : " disabled") + '></div>' +
        (live ? '<p class="lead">OTP valid for <b id="icgOtpLeft">' + Math.floor((o.exp - now) / 60000) + ':' + String(Math.ceil((o.exp - now) / 1000) % 60).padStart(2, "0") + '</b></p>' : '<div class="icg-err">The OTP has expired. Request a new one.</div>') +
        '<button class="icg-btn ghost" id="icgResend" data-act="sendotp"' + (o.resendAt > now ? " disabled" : "") + '>Resend OTP</button>';
    }
    if (S.otpErr) out += '<div class="icg-err">' + S.otpErr + '</div>';
    return out;
  }
  function smsBubble() {
    const o = S.otp;
    return (S.gate === 5 && o.code && o.exp > Date.now() && !o.ok) ? '<div class="icg-sms"><div class="h">TRAINING SMS INBOX · now</div>ICEGATE: <b>' + o.code + '</b> is your OTP for Shipping Bill submission. Valid for ' + Math.round(CFG.otpValidSeconds / 60) + ' minutes. Do not share. -CBIC</div>' : "";
  }
  function verifyOtp() {
    const o = S.otp, v = ((q("#otpIn") || {}).value || "").trim();
    if (!o.code || o.exp <= Date.now()) { S.otpErr = "OTP expired. Request a new one."; return false; }
    if (v === o.code) { o.ok = true; S.otpErr = ""; S.at.otp = Date.now(); return true; }
    o.tries++;
    if (o.tries >= CFG.otpAttempts) { o.code = null; S.otpErr = "Too many wrong attempts. This OTP is cancelled — request a new one (available shortly)."; }
    else S.otpErr = "Incorrect OTP. " + (CFG.otpAttempts - o.tries) + " attempt" + (CFG.otpAttempts - o.tries > 1 ? "s" : "") + " remaining.";
    return false;
  }

  /* ---------------- gate 6 (ICES) ---------------- */
  const STAGES = ["Signing payload with Class-3 DSC (PKCS#7)", "Connecting to ICEGATE gateway", "Validating IEC with DGFT", "Checking AD Code registration for the port", "Duplicate invoice check", "Generating Shipping Bill number"];
  function runSubmission() {
    S.submitAttempts++; S.subState = "running"; S.subLog = []; S.subErr = "";
    const busyAt = (Math.random() < CFG.serverBusyChance && S.busyStreak < CFG.maxConsecutiveBusy) ? 1 + Math.floor(Math.random() * 3) : -1;
    STAGES.forEach((s, i) => later(() => {
      if (!S) return;
      if (busyAt === i + 1) { S.busyStreak++; S.subState = "busy"; S.subLog = S.subLog.slice(); render(); return; }
      if (S.subState !== "running") return;
      S.subLog.push(s);
      if (i === STAGES.length - 1) finishSubmission(); else render();
    }, CFG.stageMs * (i + 1)));
    render();
  }
  function finishSubmission() {
    const f = S.filing; S.busyStreak = 0;
    f.finalGate = { checklistAt: S.at.checklist, declaredAt: S.at.declared, declarant: S.declName, designation: S.declDesig, dscCertSerial: S.dscSigned.serial, dscClass: S.dscSigned.cls, otpAt: S.at.otp, submitAttempts: S.submitAttempts };
    const decl = q("#declareBox"), dscb = q("#dscBox"); if (decl) decl.checked = true; if (dscb) dscb.checked = true;
    legacyWzSubmit();   // re-validates, handles broker/licence rules, creates the DSC record and calls submitFiling()
    if (f.status === "DRAFT") { S.subState = "rejected"; render(); return; }
    if (f.dsc) { f.dsc.certSerial = S.dscSigned.serial; f.dsc.signedBy = S.dscSigned.holder; }
    if (typeof saveState === "function") saveState();
    S.subState = "done"; render();
  }
  function gate6HTML() {
    const f = S.filing;
    let out = '<h3>6 · Submit to ICES</h3>';
    if (S.subState === "idle") return out + '<p class="lead">Everything is verified and signed. Submit the Shipping Bill to ICES for processing.</p><div class="icg-ok">Checklist verified · Declarations signed · DSC ' + E(S.dscSigned.serial) + ' · OTP confirmed</div>';
    out += '<p class="lead">Transmitting to ICEGATE — please do not close this window.</p><ul class="icg-prog">' + STAGES.map((s, i) => '<li><span>' + (i < S.subLog.length ? '<span class="icg-pass">✓</span>' : (i === S.subLog.length && S.subState === "running" ? '<span class="icg-wait">…</span>' : '<span class="icg-wait">○</span>')) + '</span><span>' + E(s) + '</span></li>').join("") + '</ul>';
    if (S.subState === "busy") out += '<div class="icg-err"><b>ICEGATE: HTTP 503 — Service temporarily unavailable.</b><br>The gateway is busy. Your signed Shipping Bill is intact; click Retry to send it again.</div>';
    if (S.subState === "rejected") out += '<div class="icg-err"><b>ICES did not accept this submission.</b> Read the message shown at the top of the screen, close this console, fix the issue (broker client / licence balance / validation) and sign again.</div>';
    if (S.subState === "done") out += '<div class="icg-ack"><b style="color:#1b7a3d">✓ Shipping Bill accepted by ICES</b><br>Shipping Bill No: <b>' + E(f.id) + '</b><br>Acknowledgement: <b>' + E((f.ack || {}).refNo || "") + '</b><br>Signed by: ' + E(S.dscSigned.holder) + ' (DSC ' + E(S.dscSigned.serial) + ')<br>Status: ACKNOWLEDGED — now under ICES processing / RMS.</div>';
    return out;
  }

  /* ---------------- render + events ---------------- */
  function render() {
    if (!S) return;
    const ov = q("#icgOverlay"); if (!ov) return;
    q("#icgSteps").innerHTML = GATES.map((g, i) => '<div class="icg-step ' + (i + 1 === S.gate ? "active" : (i + 1 < S.gate || S.subState === "done" ? "done" : "")) + '"><span class="n">' + (i + 1 < S.gate || S.subState === "done" ? "✓" : i + 1) + '</span><span>' + g + '</span></div>').join("");
    const body = [null, gate1HTML, gate2HTML, gate3HTML, gate4HTML, gate5HTML, gate6HTML][S.gate]();
    const main = q("#icgMain"); const keepScroll = main.scrollTop;
    // keep what the student is typing across re-renders
    const typed = {}; ["rkIec", "rkValue", "rkPkgs", "declName", "declDesig", "icgDscPin", "otpIn"].forEach(id => { const el = q("#" + id); if (el) typed[id] = el.value; });
    main.innerHTML = smsBubble() + body;
    Object.keys(typed).forEach(id => { const el = q("#" + id); if (el && !el.disabled) el.value = typed[id]; });
    main.scrollTop = keepScroll;
    const foot = q("#icgFoot"), g = S.gate;
    let left = '<button class="icg-btn ghost" data-act="cancel">' + (S.subState === "done" ? "Close" : "Cancel") + '</button>', right = "";
    if (S.subState === "done") { left = ""; right = '<button class="icg-btn saffron" data-act="finish">View Shipping Bill status</button>'; }
    else if (g === 1) right = '<button class="icg-btn" data-act="next1"' + (S.g1Done && !S.g1.total ? "" : " disabled") + '>Continue</button>';
    else if (g === 2) right = '<button class="icg-btn ghost" data-act="back">Back</button> <button class="icg-btn" data-act="next2">Verify &amp; continue</button>';
    else if (g === 3) right = '<button class="icg-btn ghost" data-act="back">Back</button> <button class="icg-btn" data-act="next3">Sign declaration</button>';
    else if (g === 4) {
      if (S.dscStage === "detect") right = '<button class="icg-btn" data-act="detect"' + (S.detecting ? " disabled" : "") + '>Detect token</button>';
      else if (S.dscStage === "select") right = '<button class="icg-btn" data-act="pickcert">Use selected certificate</button>';
      else if (S.dscStage === "pin") right = '<button class="icg-btn" data-act="pin"' + (S.lockUntil > Date.now() ? " disabled" : "") + '>Sign</button>';
      else right = '<button class="icg-btn" data-act="next4">Continue</button>';
    } else if (g === 5) right = o5();
    else if (g === 6) {
      if (S.subState === "idle") right = '<button class="icg-btn saffron" data-act="submit">Submit to ICES</button>';
      else if (S.subState === "busy") right = '<button class="icg-btn saffron" data-act="submit">Retry</button>';
      else if (S.subState === "rejected") right = "";
    }
    foot.innerHTML = '<div>' + left + '</div><div>' + right + '</div>';
  }
  function o5() { return S.otp.ok ? '<button class="icg-btn" data-act="next5">Continue</button>' : '<button class="icg-btn" data-act="otpverify"' + (S.otp.code ? "" : " disabled") + '>Verify OTP</button>'; }

  function onChange(e) {
    if (!S) return; const t = e.target;
    if (t.dataset.verify !== undefined) S.verified[t.dataset.verify] = t.checked;
    else if (t.dataset.decl !== undefined) { S.declChecked = S.declChecked || {}; S.declChecked[t.dataset.decl] = t.checked; }
    else if (t.dataset.cert !== undefined) { S.certSel = t.dataset.cert; render(); }
  }
  function onClick(e) {
    if (!S) return; const b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === "cancel") return closeConsole();
    if (act === "finish") { closeConsole(); return; }
    if (act === "back") { S.gate = Math.max(1, S.gate - 1); }
    else if (act === "next1") { S.gate = 2; }
    else if (act === "next2") { if (verifyGate2()) S.gate = 3; }
    else if (act === "next3") { if (verifyGate3()) S.gate = 4; }
    else if (act === "detect") { S.detecting = true; render(); later(() => { if (!S) return; S.detecting = false; S.dscStage = "select"; render(); }, 1400); return; }
    else if (act === "pickcert") { chooseCert(); }
    else if (act === "pin") { if (submitPin() === true) S.gate = 4; }
    else if (act === "next4") { S.gate = 5; }
    else if (act === "sendotp") { sendOtp(); }
    else if (act === "otpverify") { verifyOtp(); }
    else if (act === "next5") { S.gate = 6; }
    else if (act === "submit") { runSubmission(); return; }
    render();
  }

  window.TcosFinalFiling = { open: openConsole, close: closeConsole, _state: () => S, _pin: tokenPin, _render: render };
})();
