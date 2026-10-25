/* ============================================================
   Corporate Tax REGISTRATION (separate application, its own record)
   ------------------------------------------------------------
   - Same EmaraTax sign-in as VAT: no password is created or stored here.
   - The form is PRE-FILLED from the VAT registration but saved as its own
     record (ET.Reg). Corporate Tax filing is blocked until it is Approved.
   Sources (see tests/QA_REPORT.md Round 16):
     FTA Decision 3 of 2024 (registration timeline)        VERIFIED
     Cabinet Decision 75 of 2023 as amended by 10 of 2024  VERIFIED  (AED 10,000)
     FTA news 7 May 2025 / service card (7-month waiver)   VERIFIED  (conditions); Cabinet Decision text not read
     FTA CT Registration User Manual v4 (5 sections)       VERIFIED  (2023 manual; 2026 guide not readable)
   SIMULATED, not confirmed by an FTA source: CT TRN format, effective
   registration date, certificate layout, review status labels, the
   "financial year end" field and the FTA reviewer panel.
   ============================================================ */
(function (global) {
  "use strict";
  var ET = global.ET;
  if (!ET) return;

  /* ---------------- rules engine (pure, tested) ---------------- */
  var EFFECTIVE = Date.UTC(2024, 2, 1);            /* FTA Decision 3 of 2024 is effective 1 March 2024 */
  var LATE_REGISTRATION_PENALTY = 10000;           /* Cabinet Decision 75/2023 clause 14, added by Cabinet Decision 10/2024 */
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  /* Art 3(1): date of licence issuance (any year) -> deadline, for juridical persons established before 1 March 2024 */
  var LICENCE_TABLE = { 1: [5, 31], 2: [5, 31], 3: [6, 30], 4: [6, 30], 5: [7, 31], 6: [8, 31], 7: [9, 30], 8: [10, 31], 9: [10, 31], 10: [11, 30], 11: [11, 30], 12: [12, 31] };
  var WAIVER_CONDITIONS = [
    "The AED 10,000 penalty is waived if the first Tax Return (annual declaration for certain exempt persons) is filed within 7 months of the end of the first Tax Period, instead of 9 months.",
    "It applies only to the person's first Tax Period.",
    "If the penalty was already paid and the condition is met, it is credited back to the tax account (it can be left against Corporate Tax Payable or refunded).",
    "If the registration application has not been submitted yet, register first and then file the return within the 7 months."
  ];

  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function isoToMs(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; }
  function dateToMs(d) { return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
  function msToDMY(ms) { if (ms === null || ms === undefined) return ""; var d = new Date(ms); return p2(d.getUTCDate()) + "/" + p2(d.getUTCMonth() + 1) + "/" + d.getUTCFullYear(); }
  function msToISO(ms) { var d = new Date(ms); return d.getUTCFullYear() + "-" + p2(d.getUTCMonth() + 1) + "-" + p2(d.getUTCDate()); }
  function addMonths(ms, k) {
    var d = new Date(ms), y = d.getUTCFullYear(), m = d.getUTCMonth() + k;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(d.getUTCDate(), last));
  }

  /* inp: { basis, relevantDate (ISO), licenceIssueDate (ISO), fyEnd (ISO, foreign-managed only) } */
  function deadline(inp) {
    inp = inp || {};
    var rel = isoToMs(inp.relevantDate), out;
    if (inp.basis === "foreign-managed") {
      var fy = isoToMs(inp.fyEnd);
      if (fy === null) return null;
      return { ms: addMonths(fy, 3), rule: "Foreign-incorporated person effectively managed and controlled in the UAE: 3 months from the end of its Financial Year.", source: "FTA Decision 3/2024, Art 3(3)" };
    }
    if (rel === null) return null;
    if (inp.basis === "nonres-pe") {
      out = rel < EFFECTIVE ? { ms: addMonths(rel, 9), rule: "Non-resident juridical person with a Permanent Establishment that existed before 1 March 2024: 9 months from the date the PE came into existence." }
                            : { ms: addMonths(rel, 6), rule: "Non-resident juridical person with a Permanent Establishment from 1 March 2024: 6 months from the date the PE came into existence." };
      out.source = rel < EFFECTIVE ? "FTA Decision 3/2024, Art 4(1)" : "FTA Decision 3/2024, Art 4(2)"; return out;
    }
    if (inp.basis === "nonres-nexus") {
      out = rel < EFFECTIVE ? { ms: addMonths(EFFECTIVE, 3), rule: "Non-resident juridical person with a nexus before 1 March 2024: 3 months from 1 March 2024." }
                            : { ms: addMonths(rel, 3), rule: "Non-resident juridical person with a nexus from 1 March 2024: 3 months from the date the nexus was established." };
      out.source = rel < EFFECTIVE ? "FTA Decision 3/2024, Art 4(1)" : "FTA Decision 3/2024, Art 4(2)"; return out;
    }
    /* resident juridical person incorporated in the UAE (mainland or free zone) */
    if (rel >= EFFECTIVE) return { ms: addMonths(rel, 3), rule: "Resident juridical person established on or after 1 March 2024: 3 months from the date of incorporation, establishment or recognition.", source: "FTA Decision 3/2024, Art 3(3)" };
    var lic = isoToMs(inp.licenceIssueDate);
    if (lic === null) return { ms: addMonths(EFFECTIVE, 3), rule: "Resident juridical person established before 1 March 2024 with no licence at that date: 3 months from 1 March 2024.", source: "FTA Decision 3/2024, Art 3(1)" };
    var mo = new Date(lic).getUTCMonth() + 1, t = LICENCE_TABLE[mo];
    return { ms: Date.UTC(2024, t[0] - 1, t[1]), rule: "Resident juridical person established before 1 March 2024: licence issued in " + MONTHS[mo - 1] + " (any year) gives the deadline in the FTA table. If there is more than one licence, the earliest issue date is used.", source: "FTA Decision 3/2024, Art 3(1) and 3(2)" };
  }
  function lateRegistration(deadlineMs, submittedMs) {
    var late = deadlineMs !== null && submittedMs > deadlineMs;
    return { late: late, penalty: late ? LATE_REGISTRATION_PENALTY : 0 };
  }
  /* the waiver deadline: 7 months from the end of the first tax period (FTA news 7 May 2025) */
  function waiverDeadline(firstPeriodEndMs) { return addMonths(firstPeriodEndMs, 7); }
  /* late: the AED 10,000 was imposed; firstEndMs: end of the first Tax Period; submittedISO: when the first return was filed ("" if not yet); todayMs: simulated today */
  function waiver(late, firstEndMs, submittedISO, todayMs) {
    if (!late) return { state: "None", deadlineMs: null };
    var dl = waiverDeadline(firstEndMs);
    if (submittedISO) { var d = new Date(submittedISO), sMs = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); return { state: sMs <= dl ? "Waived" : "NotWaived", deadlineMs: dl, submittedMs: sMs }; }
    return { state: todayMs <= dl ? "Pending" : "NotWaived", deadlineMs: dl };
  }

  /* SIMULATED format: 15 digits, always different from the VAT number. The real CT TRN format is not confirmed by an FTA source. */
  function genTrn(vatTrn) {
    var t, n = 0;
    do { t = "100"; for (var i = 0; i < 12; i++) t += Math.floor(Math.random() * 10); n++; } while (t === String(vatTrn || "") && n < 20);
    return t;
  }

  global.ET.RegRules = { deadline: deadline, lateRegistration: lateRegistration, waiverDeadline: waiverDeadline, waiver: waiver, waiverConditions: WAIVER_CONDITIONS,
    addMonths: addMonths, isoToMs: isoToMs, msToDMY: msToDMY, msToISO: msToISO, genTrn: genTrn, LICENCE_TABLE: LICENCE_TABLE, PENALTY: LATE_REGISTRATION_PENALTY, EFFECTIVE: EFFECTIVE };

  /* ---------------- record ---------------- */
  var ENTITY_TYPES = ["UAE Public Joint Stock Company", "UAE Private Company (incl. an Establishment)", "UAE Partnership", "Foreign Company", "Foreign Partnership",
    "Club or Association or Society", "Trust", "Charity", "Foundation", "Federal Government Entity", "Emirate Government Entity", "Other"];   /* sub-types listed in FTA manual v4 */
  var BASES = [
    ["uae", "Incorporated, established or recognised in the UAE (including a Free Zone Person)"],
    ["foreign-managed", "Foreign-incorporated, effectively managed and controlled in the UAE"],
    ["nonres-pe", "Non-resident with a Permanent Establishment in the UAE"],
    ["nonres-nexus", "Non-resident with a nexus in the UAE"]
  ];
  var EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
  var DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function esc(v) { return String(v === undefined || v === null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function prefilled() {
    var p = ET.person() || {}, a = ET.account() || {};
    var et = ENTITY_TYPES.indexOf(p.entitySubType) > -1 ? p.entitySubType : "UAE Private Company (incl. an Establishment)";
    return {
      entityType: et, basis: "uae", legalNameEn: p.nameEn || "", legalNameAr: p.nameAr || "", tradeName: p.tradeName || "",
      relevantDate: "", fyEnd: "", fyMonth: 12, fyDay: 31,
      licence: { number: p.tradeLicenseNo || "", authority: "", issueDate: "", expiryDate: "", docAttached: false },
      activities: p.primaryBusiness ? [{ name: p.primaryBusiness }] : [],
      owners: [], ownersDocAttached: false, hasBranches: false, branches: [],
      address: p.address || "", emirate: p.emirate || "", phone: p.mobile || "", email: p.email || "",
      signatories: [{ firstName: p.firstName || "", lastName: p.lastName || "", eid: p.emiratesId || "", designation: p.designation || "", authAttached: false }],
      declaration: false,
      linkedBank: { bankName: a.bankName || "", holder: a.bankAccountHolder || "", iban: a.iban || "" }   /* carried from VAT, informational only */
    };
  }
  function blankRecord() { return { status: "Draft", section: 1, maxSection: 1, form: prefilled(), appRef: "", submittedAt: "", history: [], lateReg: null, ctTrn: "", approvedAt: "", effectiveDate: "", feedback: "", resubmission: 0 }; }
  function load() { var r = ET.Reg.get(); return r || blankRecord(); }
  function save(r) { return ET.Reg.set(r); }
  function nowMs() { return dateToMs(ET.now()); }
  function stamp(r, status, note) { r.history.push({ status: status, at: ET.now().toISOString(), note: note || "" }); r.status = status; }
  function labelOf(st) { return { Draft: "Draft", Submitted: "Submitted", UnderReview: "Under review", MoreInfo: "More information requested", Approved: "Approved", Rejected: "Rejected" }[st] || st; }

  /* ---------------- validation per section ---------------- */
  function validate(sec, f) {
    var e = [], i;
    if (sec === 1) {
      if (!f.legalNameEn.trim()) e.push("Enter the legal name in English.");
      if (!f.relevantDate) e.push("Enter the " + dateLabel(f.basis).toLowerCase() + ".");
      if (f.basis === "foreign-managed" && !f.fyEnd) e.push("Enter the end date of the Financial Year.");
      var m = +f.fyMonth, d = +f.fyDay;
      if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= DAYS_IN_MONTH[m - 1 || 0])) e.push("Enter a valid financial year end (month and day).");
    }
    if (sec === 2) {
      if (!f.licence.number.trim()) e.push("Enter the main trade licence number.");
      if (!f.licence.authority.trim()) e.push("Enter the licensing authority.");
      if (!f.licence.issueDate) e.push("Enter the licence issue date.");
      if (!f.licence.expiryDate) e.push("Enter the licence expiry date.");
      if (f.licence.issueDate && f.licence.expiryDate && f.licence.expiryDate < f.licence.issueDate) e.push("The licence expiry date is before the issue date.");
      if (!f.licence.docAttached) e.push("Attach the trade licence.");
      if (!f.activities.length) e.push("Add at least one business activity.");
      for (i = 0; i < f.activities.length; i++) if (!f.activities[i].name.trim()) e.push("Business activity " + (i + 1) + " is empty.");
      if (!f.owners.length) e.push("Add at least one owner.");
      var tot = 0;
      for (i = 0; i < f.owners.length; i++) {
        if (!f.owners[i].name.trim()) e.push("Owner " + (i + 1) + " needs a name.");
        var s = ET.toNumber(f.owners[i].share); if (!(s > 0 && s <= 100)) e.push("Owner " + (i + 1) + ": ownership must be above 0 and at most 100%."); tot += s;
      }
      if (tot > 100.0001) e.push("Ownership adds up to " + tot + "%, which is more than 100%.");
      if (f.owners.length && !f.ownersDocAttached) e.push("Attach the Emirates ID / passport of owners.");
      if (f.hasBranches) for (i = 0; i < f.branches.length; i++) if (!f.branches[i].licence.trim()) e.push("Branch " + (i + 1) + " needs a licence number.");
    }
    if (sec === 3) {
      if (!f.address.trim()) e.push("Enter the registered address.");
      if (!f.emirate) e.push("Select the emirate.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) e.push("Enter a valid email address.");
      if (!f.phone.trim()) e.push("Enter a contact number.");
    }
    if (sec === 4) {
      if (!f.signatories.length) e.push("Add at least one authorised signatory.");
      for (i = 0; i < f.signatories.length; i++) {
        var g = f.signatories[i];
        if (!g.firstName.trim() || !g.lastName.trim()) e.push("Signatory " + (i + 1) + " needs a first and last name.");
        if (!g.eid.trim()) e.push("Signatory " + (i + 1) + " needs an Emirates ID.");
        if (!g.authAttached) e.push("Signatory " + (i + 1) + ": attach the evidence of authorisation.");
      }
    }
    if (sec === 5 && !f.declaration) e.push("Tick the declaration to confirm the information is correct.");
    return e;
  }
  function dateLabel(b) { return b === "nonres-pe" ? "Date the Permanent Establishment came into existence" : b === "nonres-nexus" ? "Date the nexus was established" : "Date of incorporation / establishment / recognition"; }

  /* ---------------- submit and FTA review (training stand-in) ---------------- */
  function submit(r) {
    var f = r.form, dl = deadline({ basis: f.basis, relevantDate: f.relevantDate, licenceIssueDate: f.licence.issueDate, fyEnd: f.fyEnd });
    var today = nowMs(), lr = lateRegistration(dl ? dl.ms : null, today);
    if (!r.appRef) r.appRef = "CTREG-" + ET.now().getFullYear() + "-" + Math.floor(100000 + Math.random() * 899999);
    r.submittedAt = ET.now().toISOString();
    r.lateReg = { deadline: dl ? msToDMY(dl.ms) : "", deadlineMs: dl ? dl.ms : null, rule: dl ? dl.rule : "", source: dl ? dl.source : "", submittedOn: msToDMY(today), late: lr.late,
      penalty: lr.penalty, status: lr.late ? "Imposed" : "None", waiverNote: lr.late ? "Waived if the first Tax Return is filed within 7 months of the end of the first Tax Period." : "" };
    stamp(r, "Submitted", r.resubmission ? "Resubmitted with the information requested" : "Application submitted");
    r.feedback = "";
    return r;
  }
  function advance(r, action, note) {
    if (action === "review" && r.status === "Submitted") stamp(r, "UnderReview", "FTA started reviewing the application");
    else if (action === "approve" && (r.status === "Submitted" || r.status === "UnderReview")) {
      var vat = (ET.person() || {}).vatTrn;
      r.ctTrn = r.ctTrn || genTrn(vat); r.approvedAt = ET.now().toISOString();
      r.effectiveDate = msToDMY(dateToMs(new Date(r.submittedAt)));      /* SIMULATED: real effective-date rule not confirmed */
      stamp(r, "Approved", "Corporate Tax Registration Number issued");
    }
    else if (action === "moreinfo" && (r.status === "Submitted" || r.status === "UnderReview")) { r.feedback = note || "Please provide the missing information."; r.resubmission++; stamp(r, "MoreInfo", r.feedback); }
    else if (action === "reject" && (r.status === "Submitted" || r.status === "UnderReview")) { r.feedback = note || "The application does not meet the requirements."; stamp(r, "Rejected", r.feedback); }
    else return false;
    return true;
  }
  global.ET.RegFlow = { validate: validate, submit: submit, advance: advance, blank: blankRecord, labelOf: labelOf };

  /* ---------------- UI ---------------- */
  var root, rec, errors = [];
  function field(label, inner, hint) { return '<div class="field"><label>' + label + '</label>' + (hint ? '<span class="hint">' + hint + '</span>' : "") + inner + '</div>'; }
  function input(path, val, type, extra) { return '<input type="' + (type || "text") + '" data-r="' + path + '" value="' + esc(val) + '"' + (extra || "") + '>'; }
  function select(path, val, opts) {
    return '<select data-r="' + path + '">' + opts.map(function (o) { var v = o instanceof Array ? o[0] : o, l = o instanceof Array ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? " selected" : "") + ">" + esc(l) + "</option>"; }).join("") + "</select>";
  }
  function attach(path, on, label) {
    return '<div class="field"><label>' + label + '</label><button type="button" class="btn ' + (on ? "btn-emerald" : "btn-ghost") + ' btn-sm" data-attach="' + path + '">' + (on ? "Attached (simulated) - click to remove" : "Attach document (simulated)") + '</button></div>';
  }
  function setPath(obj, path, v) {
    var parts = path.split("."), o = obj, i;
    for (i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = v;
  }
  function getPath(obj, path) { var parts = path.split("."), o = obj, i; for (i = 0; i < parts.length; i++) o = o[parts[i]]; return o; }

  var SECTION_NAMES = ["Entity Details", "Identification Details", "Contact Details", "Authorized Signatory", "Review and Declaration"];

  function stepper(cur, max) {
    return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px">' + SECTION_NAMES.map(function (n, i) {
      var k = i + 1, st = k === cur ? "background:#1f4f8f;color:#fff" : (k < max || k < cur ? "background:#e3f3e8;color:#1b6b3a" : "background:#eef0f3;color:#5b6573");
      return '<button type="button" data-goto="' + k + '" style="border:0;border-radius:4px;padding:7px 12px;font-size:.8rem;cursor:pointer;' + st + '">' + k + ". " + n + (k < cur ? " \u2713" : "") + "</button>";
    }).join("") + "</div>";
  }

  function deadlineBox(f) {
    var dl = deadline({ basis: f.basis, relevantDate: f.relevantDate, licenceIssueDate: f.licence.issueDate, fyEnd: f.fyEnd });
    if (!dl) return '<div class="note-box info" id="dl-box">Enter the dates to see your registration deadline.</div>';
    var late = nowMs() > dl.ms;
    return '<div class="note-box ' + (late ? "" : "ok") + '" id="dl-box"><strong>Registration deadline: ' + msToDMY(dl.ms) + '</strong><br>' + esc(dl.rule) + ' <em>(' + esc(dl.source) + ')</em>' +
      (late ? '<br><strong>This date has passed. If you submit now, a late registration penalty of AED 10,000 applies.</strong> It is waived if you file your first Tax Return within 7 months of the end of your first Tax Period.' : "") + "</div>";
  }

  function sec1(f) {
    return '<div class="grid-2">' + field("Entity Type *", select("entityType", f.entityType, ENTITY_TYPES), "Sub-types as listed in the FTA registration manual") +
      field("Basis of registration *", select("basis", f.basis, BASES)) + "</div>" +
      '<div class="grid-2">' + field("Legal name (English) *", input("legalNameEn", f.legalNameEn), "Pre-filled from your VAT registration - edit if different") + field("Legal name (Arabic)", input("legalNameAr", f.legalNameAr)) + "</div>" +
      field("Trade name", input("tradeName", f.tradeName)) +
      field(dateLabel(f.basis) + " *", input("relevantDate", f.relevantDate, "date")) +
      (f.basis === "foreign-managed" ? field("End date of the person's Financial Year *", input("fyEnd", f.fyEnd, "date"), "FTA Decision 3/2024 Art 3(3): 3 months from the end of the Financial Year") : "") +
      '<div class="grid-2">' + field("Financial year end - month *", select("fyMonth", f.fyMonth, MONTHS.map(function (m, i) { return [i + 1, m]; })), "Training field: the simulator uses it to build your Tax Periods. Confirm the exact field in the live portal.") +
      field("Financial year end - day *", input("fyDay", f.fyDay, "number", ' min="1" max="31"')) + "</div>" + deadlineBox(f);
  }
  function rows(listPath, items, cols, addLabel) {
    var h = items.map(function (it, i) {
      return '<div class="card" style="padding:10px;margin:8px 0"><div class="grid-2">' + cols.map(function (c) { return field(c.label, c.type === "select" ? select(listPath + "." + i + "." + c.k, it[c.k], c.opts) : input(listPath + "." + i + "." + c.k, it[c.k], c.type)); }).join("") + '</div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-remove="' + listPath + "." + i + '">Remove</button></div>';
    }).join("");
    return h + '<button type="button" class="btn btn-outline-navy btn-sm" data-add="' + listPath + '">' + addLabel + "</button>";
  }
  function sec2(f) {
    return '<h3 class="section-title">Main licence details</h3><div class="grid-2">' + field("Trade licence number *", input("licence.number", f.licence.number), "Pre-filled from your VAT registration") +
      field("Licensing authority *", input("licence.authority", f.licence.authority)) + field("Licence issue date *", input("licence.issueDate", f.licence.issueDate, "date")) +
      field("Licence expiry date *", input("licence.expiryDate", f.licence.expiryDate, "date")) + "</div>" + attach("licence.docAttached", f.licence.docAttached, "Trade licence (PDF, max 15 MB) *") +
      '<h3 class="section-title">Business activities</h3>' + rows("activities", f.activities, [{ k: "name", label: "Activity *" }], "Add business activity") +
      '<h3 class="section-title">Owners</h3>' + rows("owners", f.owners, [{ k: "type", label: "Owner type", type: "select", opts: ["Natural Person", "Legal Person"] }, { k: "name", label: "Name *" }, { k: "eid", label: "Emirates ID / passport / licence no." }, { k: "share", label: "Ownership % *", type: "number" }], "Add owner") +
      attach("ownersDocAttached", f.ownersDocAttached, "Emirates ID and passport of owners (PDF) *") +
      '<h3 class="section-title">Branches</h3><div class="field"><label>Does the entity have local branches?</label>' + select("hasBranches", f.hasBranches ? "yes" : "no", [["no", "No"], ["yes", "Yes"]]) + "</div>" +
      (f.hasBranches ? '<div class="note-box info">The registration is in the name of the head office. Only one Corporate Tax registration is required, even with branches in more than one emirate.</div>' + rows("branches", f.branches, [{ k: "licence", label: "Branch licence number *" }, { k: "emirate", label: "Emirate", type: "select", opts: EMIRATES }], "Add branch") : "");
  }
  function sec3(f) {
    return '<div class="note-box info">Do not use another company\'s address (for example, your accountant\'s). If you have several addresses, give the place where most of the day-to-day activities of the business are carried out.</div>' +
      field("Registered address *", input("address", f.address)) + '<div class="grid-2">' + field("Emirate *", select("emirate", f.emirate, [["", "Select"]].concat(EMIRATES))) +
      field("Contact number *", input("phone", f.phone)) + "</div>" + field("Email *", input("email", f.email), "Notifications about this application are sent here. Your EmaraTax sign-in stays the same as for VAT - no new password.");
  }
  function sec4(f) {
    return rows("signatories", f.signatories, [{ k: "firstName", label: "First name *" }, { k: "lastName", label: "Last name *" }, { k: "eid", label: "Emirates ID *" }, { k: "designation", label: "Designation" }], "Add authorised signatory") +
      f.signatories.map(function (s, i) { return attach("signatories." + i + ".authAttached", s.authAttached, "Evidence of authorisation - signatory " + (i + 1) + " (for a legal person this may be a Power of Attorney) *"); }).join("");
  }
  function sec5(f) {
    var dl = deadlineBox(f), b = f.linkedBank;
    function row(l, v) { return "<tr><th style=\"text-align:left;padding:6px 10px;width:34%;background:#f4f6f8\">" + l + "</th><td style=\"padding:6px 10px\">" + esc(v || "-") + "</td></tr>"; }
    return dl + '<table style="width:100%;border-collapse:collapse;margin:10px 0">' + row("Entity type", f.entityType) + row("Legal name", f.legalNameEn) + row("Basis", (BASES.filter(function (x) { return x[0] === f.basis; })[0] || [])[1]) +
      row(dateLabel(f.basis), f.relevantDate) + row("Financial year end", f.fyDay + " " + MONTHS[(+f.fyMonth || 1) - 1]) + row("Trade licence", f.licence.number + " - " + f.licence.authority + " (" + f.licence.issueDate + " to " + f.licence.expiryDate + ")") +
      row("Business activities", f.activities.map(function (a) { return a.name; }).join("; ")) + row("Owners", f.owners.map(function (o) { return o.name + " " + o.share + "%"; }).join("; ")) +
      row("Branches", f.hasBranches ? f.branches.length + " branch(es)" : "None") + row("Address", f.address + ", " + f.emirate) + row("Contact", f.phone + " / " + f.email) +
      row("Authorised signatories", f.signatories.map(function (s) { return s.firstName + " " + s.lastName + " (" + s.eid + ")"; }).join("; ")) + "</table>" +
      (b.iban || b.bankName ? '<div class="note-box info">Bank details carried over from your VAT registration (' + esc(b.bankName) + ", " + esc(b.iban) + "). Informational only: the FTA registration manual lists no bank section, so this simulator keeps them just to show they stay consistent across both services.</div>" : "") +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin:14px 0"><input type="checkbox" data-r="declaration"' + (f.declaration ? " checked" : "") + '> <span>I declare that the information provided in this application is correct and complete.</span></label>';
  }

  function wizardHTML() {
    var f = rec.form, n = rec.section, body = [sec1, sec2, sec3, sec4, sec5][n - 1](f);
    return '<div class="card"><div class="card-head"><span>Corporate Tax Registration - ' + SECTION_NAMES[n - 1] + '</span></div><div class="card-body">' +
      '<div class="note-box info">This is a <strong>separate application</strong> from your VAT registration. It is pre-filled from VAT so you only check and complete it. You sign in with the same EmaraTax email and password as VAT - no second password is created.' +
      (rec.status === "MoreInfo" ? '<br><strong>The FTA asked for more information:</strong> ' + esc(rec.feedback) : "") + "</div>" + stepper(n, rec.maxSection) +
      (errors.length ? '<div class="note-box" style="border-color:#c0392b;color:#8e2a1f"><strong>Please fix:</strong><ul style="margin:6px 0 0 18px">' + errors.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul></div>" : "") +
      '<div id="sec-body">' + body + '</div><div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">' +
      (n > 1 ? '<button type="button" class="btn btn-ghost" data-nav="prev">Previous Step</button>' : "") + '<button type="button" class="btn btn-ghost" data-nav="draft">Save as Draft</button>' +
      (n < 5 ? '<button type="button" class="btn btn-primary" data-nav="next">Next Step</button>' : '<button type="button" class="btn btn-primary" data-nav="submit">Submit</button>') + "</div></div></div>";
  }

  function timelineHTML() {
    var stages = ["Submitted", "UnderReview", rec.status === "Rejected" ? "Rejected" : (rec.status === "MoreInfo" ? "MoreInfo" : "Approved")], idx = stages.indexOf(rec.status);
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">' + stages.map(function (s, i) {
      var on = i <= idx, bad = s === "Rejected" || s === "MoreInfo";
      return '<span style="padding:6px 12px;border-radius:14px;font-size:.8rem;background:' + (on ? (bad ? "#fde8e6" : "#e3f3e8") : "#eef0f3") + ";color:" + (on ? (bad ? "#8e2a1f" : "#1b6b3a") : "#5b6573") + '">' + (i + 1) + ". " + labelOf(s) + "</span>";
    }).join("") + "</div>";
  }
  function statusHTML() {
    var h = rec.history.map(function (x) { return "<tr><td style=\"padding:5px 10px\">" + esc(x.at.replace("T", " ").slice(0, 16)) + "</td><td style=\"padding:5px 10px\">" + labelOf(x.status) + "</td><td style=\"padding:5px 10px\">" + esc(x.note) + "</td></tr>"; }).join("");
    var lr = rec.lateReg || {}, out = '<div class="card"><div class="card-head"><span>Corporate Tax Registration - Application status</span></div><div class="card-body">' +
      '<p><strong>Application reference:</strong> <span id="reg-appref">' + esc(rec.appRef) + '</span> &nbsp; <strong>Status:</strong> <span id="reg-status">' + labelOf(rec.status) + "</span></p>" + timelineHTML();
    if (rec.status === "Approved") {
      out += '<div class="note-box ok" id="reg-cert"><strong>Corporate Tax Registration Certificate (training replica)</strong><br>Taxable person: ' + esc(rec.form.legalNameEn) + '<br>Corporate Tax Registration Number: <strong id="reg-trn">' + esc(rec.ctTrn) +
        '</strong> <em>(simulated format; different from the VAT number ' + esc((ET.person() || {}).vatTrn) + ')</em><br>Effective date of registration: ' + esc(rec.effectiveDate) + ' <em>(simulated)</em><br>Financial year end: ' + rec.form.fyDay + " " + MONTHS[rec.form.fyMonth - 1] +
        '<br><button class="btn btn-ghost btn-sm" type="button" data-print style="margin-top:8px">Print certificate</button> <a class="btn btn-primary btn-sm" href="ct-filings.html" style="margin-top:8px">Go to Corporate Tax Filings</a></div>';
    }
    if (rec.status === "MoreInfo") out += '<div class="note-box"><strong>More information requested:</strong> ' + esc(rec.feedback) + '<br><button class="btn btn-primary btn-sm" type="button" data-resubmit style="margin-top:8px">Edit and resubmit</button></div>';
    if (rec.status === "Rejected") out += '<div class="note-box"><strong>Application rejected:</strong> ' + esc(rec.feedback) + '<br><button class="btn btn-primary btn-sm" type="button" data-newapp style="margin-top:8px">Start a new application</button></div>';
    if (rec.status === "Submitted" || rec.status === "UnderReview") out += '<div class="note-box info">Corporate Tax filing stays blocked until the registration is approved. The FTA states it completes applications in about 20 business days.</div>';
    out += '<h3 class="section-title">Registration deadline and late registration penalty</h3><div class="note-box ' + (lr.late ? "" : "ok") + '" id="reg-late"><strong>Deadline: ' + esc(lr.deadline || "not calculated") + "</strong> &nbsp; Submitted on: " + esc(lr.submittedOn || "") + "<br>" + esc(lr.rule || "") + " <em>(" + esc(lr.source || "") + ")</em><br>" +
      (lr.late ? "<strong>Late registration penalty imposed: AED " + ET.money(lr.penalty) + "</strong> (Cabinet Decision 75/2023, as amended by Cabinet Decision 10/2024). " : "Submitted within the deadline: no late registration penalty. ") + "</div>";
    if (lr.late) {
      var per = ET.periods()[0], fl = rec.status === "Approved" ? ET.Store.slot(per.key).filing : { status: "Open" };
      var w = rec.status === "Approved" ? waiver(true, per.endMs, fl.status === "Submitted" ? fl.submittedISO : "", nowMs()) : { state: "Pending", deadlineMs: null };
      var wtxt = w.state === "Waived" ? "Waived: the first return (period ending " + per.to + ") was filed on " + msToDMY(w.submittedMs) + ", within 7 months of the period end (by " + msToDMY(w.deadlineMs) + "). The AED " + ET.money(lr.penalty) + " is not payable."
        : w.state === "NotWaived" ? "Not waived: the first return (period ending " + per.to + ") " + (fl.status === "Submitted" ? "was filed on " + msToDMY(w.submittedMs) : "has not been filed") + " after the 7-month limit of " + msToDMY(w.deadlineMs) + ". The AED " + ET.money(lr.penalty) + " stays payable."
        : w.deadlineMs ? "Pending: file the first return (period ending " + per.to + ") by " + msToDMY(w.deadlineMs) + " to have the AED " + ET.money(lr.penalty) + " waived." : "Pending: the 7-month limit is counted from the end of your first Tax Period once the registration is approved.";
      out += '<div class="note-box ' + (w.state === "Waived" ? "ok" : "info") + '" id="reg-waiver"><strong>Waiver status: ' + esc(wtxt) + '</strong><ul style="margin:6px 0 0 18px">' + WAIVER_CONDITIONS.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div>";
    }
    out += '<h3 class="section-title">History</h3><table style="width:100%;border-collapse:collapse">' + h + "</table></div></div>";
    if (rec.status === "Submitted" || rec.status === "UnderReview") {
      out += '<div class="card" style="border:1px dashed #9aa5b1"><div class="card-head"><span>FTA reviewer (training only)</span></div><div class="card-body"><div class="note-box info">In the real portal the FTA reviews and decides. This panel stands in for the FTA so a class can see each outcome. The status labels are simulated.</div>' +
        '<div class="field"><label>Message to the applicant (for "more information" or "reject")</label><input type="text" id="fta-note" placeholder="e.g. Trade licence copy is not readable"></div><div style="display:flex;gap:8px;flex-wrap:wrap">' +
        (rec.status === "Submitted" ? '<button class="btn btn-ghost" type="button" data-fta="review">Start review</button>' : "") + '<button class="btn btn-emerald" type="button" data-fta="approve">Approve</button><button class="btn btn-ghost" type="button" data-fta="moreinfo">Request more information</button><button class="btn btn-danger" type="button" data-fta="reject">Reject</button></div></div></div>';
    }
    return out;
  }

  function render() {
    root.innerHTML = (rec.status === "Draft" || (rec.status === "MoreInfo" && rec.editing)) ? wizardHTML() : statusHTML();
  }
  function rerenderKeepFocus() { render(); }

  function onChange(e) {
    var t = e.target, path = t.getAttribute && t.getAttribute("data-r"); if (!path) return;
    var v = t.type === "checkbox" ? t.checked : t.value;
    if (path === "hasBranches") v = (v === "yes");
    if (path === "fyMonth" || path === "fyDay") v = +v;
    setPath(rec.form, path, v); save(rec);
    if (["basis", "hasBranches", "fyMonth"].indexOf(path) > -1) rerenderKeepFocus();
    else { var box = root.querySelector("#dl-box"); if (box && (path === "relevantDate" || path === "fyEnd" || path === "licence.issueDate")) box.outerHTML = deadlineBox(rec.form); }
  }
  function onClick(e) {
    var t = e.target; while (t && t !== root && !(t.getAttribute && (t.hasAttribute("data-nav") || t.hasAttribute("data-goto") || t.hasAttribute("data-add") || t.hasAttribute("data-remove") || t.hasAttribute("data-attach") || t.hasAttribute("data-fta") || t.hasAttribute("data-resubmit") || t.hasAttribute("data-newapp") || t.hasAttribute("data-print")))) t = t.parentNode;
    if (!t || t === root) return;
    var f = rec.form, k;
    if (t.hasAttribute("data-attach")) { var p = t.getAttribute("data-attach"); setPath(f, p, !getPath(f, p)); save(rec); render(); return; }
    if (t.hasAttribute("data-add")) {
      k = t.getAttribute("data-add");
      f[k].push(k === "activities" ? { name: "" } : k === "owners" ? { type: "Natural Person", name: "", eid: "", share: "" } : k === "branches" ? { licence: "", emirate: "Dubai" } : { firstName: "", lastName: "", eid: "", designation: "", authAttached: false });
      save(rec); render(); return;
    }
    if (t.hasAttribute("data-remove")) { var pp = t.getAttribute("data-remove").split("."); f[pp[0]].splice(+pp[1], 1); save(rec); render(); return; }
    if (t.hasAttribute("data-goto")) { var g = +t.getAttribute("data-goto"); if (g <= rec.maxSection || g < rec.section) { rec.section = g; errors = []; save(rec); render(); } return; }
    if (t.hasAttribute("data-nav")) {
      var nav = t.getAttribute("data-nav");
      if (nav === "prev") { rec.section--; errors = []; }
      else if (nav === "draft") { save(rec); ET.toast("Draft saved", "ok"); return; }
      else if (nav === "next") { errors = validate(rec.section, f); if (!errors.length) { rec.section++; rec.maxSection = Math.max(rec.maxSection, rec.section); } }
      else if (nav === "submit") {
        errors = []; for (var s = 1; s <= 5; s++) { var er = validate(s, f); if (er.length) { errors = er; rec.section = s; break; } }
        if (!errors.length) { submit(rec); rec.editing = false; save(rec); ET.toast("Application submitted. Reference " + rec.appRef, "ok"); render(); return; }
      }
      save(rec); render(); window.scrollTo(0, 0); return;
    }
    if (t.hasAttribute("data-fta")) {
      var note = (root.querySelector("#fta-note") || {}).value || "";
      if (advance(rec, t.getAttribute("data-fta"), note)) { save(rec); ET.toast("Status: " + labelOf(rec.status), "ok"); render(); }
      return;
    }
    if (t.hasAttribute("data-resubmit")) { rec.editing = true; rec.section = 1; errors = []; save(rec); render(); return; }
    if (t.hasAttribute("data-newapp")) { ET.Reg.clear(); rec = blankRecord(); save(rec); errors = []; render(); return; }
    if (t.hasAttribute("data-print")) { window.print(); }
  }

  function start(el) {
    root = el; rec = load(); if (rec.status === "MoreInfo" && !rec.editing) rec.editing = false;
    root.addEventListener("change", onChange); root.addEventListener("click", onClick);
    root.addEventListener("input", function (e) { var t = e.target; if (t && t.getAttribute && t.getAttribute("data-r") && t.type !== "checkbox" && t.tagName !== "SELECT") { onChange(e); } });
    render();
  }
  global.ET.RegUI = { start: start };
})(window);
