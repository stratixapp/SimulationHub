/* Corporate Tax registration rules + review flow (jsdom). Run from emirates-tax-portal/ :  node tests/ct-registration-smoke.js
   Deadlines: FTA Decision 3 of 2024. Late registration penalty AED 10,000: Cabinet Decision 75/2023 as amended by 10/2024. Waiver: 7 months after the end of the first tax period (FTA news 7 May 2025). */
const fs = require("fs"); const { Browser } = require("./e2e-agent.js");
(async () => {
  const b = new Browser(() => {}); await b.goto("ct/index.html", 100); const w = b.w; w.eval(fs.readFileSync("ct/assets/js/ct-reg.js", "utf8"));
  const ET = w.ET, R = ET.RegRules, F = ET.RegFlow; let bad = 0;
  const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) bad++; };
  const dl = (o) => { const x = R.deadline(o); return x ? R.msToDMY(x.ms) : null; };
  ok("no script errors on load", b.errs.length === 0);
  /* licence month table (any year) for juridical persons established before 1 March 2024 */
  const exp = ["31/05", "31/05", "30/06", "30/06", "31/07", "31/08", "30/09", "31/10", "31/10", "30/11", "30/11", "31/12"];
  let tableOk = true; for (let m = 1; m <= 12; m++) { const got = dl({ basis: "uae", relevantDate: "2018-02-01", licenceIssueDate: (2010 + m) + "-" + String(m).padStart(2, "0") + "-15" }); if (got !== exp[m - 1] + "/2024") tableOk = false; }
  ok("licence issue month table (Jan-Feb 31 May ... Dec 31 Dec 2024) for all 12 months", tableOk);
  ok("established before 1 Mar 2024 with no licence: 1 June 2024", dl({ basis: "uae", relevantDate: "2023-12-31" }) === "01/06/2024");
  ok("incorporated 1 Mar 2024: 3 months = 01/06/2024", dl({ basis: "uae", relevantDate: "2024-03-01" }) === "01/06/2024");
  ok("incorporated 30 Nov 2024: 28/02/2025 (month-end clamp); 31 Dec 2024: 31/03/2025", dl({ basis: "uae", relevantDate: "2024-11-30" }) === "28/02/2025" && dl({ basis: "uae", relevantDate: "2024-12-31" }) === "31/03/2025");
  ok("PE before 1 Mar 2024: 9 months (15/06/2023 -> 15/03/2024); PE after: 6 months (31/08/2025 -> 28/02/2026)", dl({ basis: "nonres-pe", relevantDate: "2023-06-15" }) === "15/03/2024" && dl({ basis: "nonres-pe", relevantDate: "2025-08-31" }) === "28/02/2026");
  ok("nexus before 1 Mar 2024: 01/06/2024; nexus on 10/05/2025: 10/08/2025", dl({ basis: "nonres-nexus", relevantDate: "2022-01-01" }) === "01/06/2024" && dl({ basis: "nonres-nexus", relevantDate: "2025-05-10" }) === "10/08/2025");
  ok("foreign person managed in the UAE: 3 months after financial year end (31/12/2025 -> 31/03/2026)", dl({ basis: "foreign-managed", fyEnd: "2025-12-31" }) === "31/03/2026");
  ok("missing dates give no deadline", dl({ basis: "uae" }) === null);
  const d1 = R.isoToMs("2024-06-01");
  ok("late registration: on the deadline is on time, next day is late with AED 10,000", R.lateRegistration(d1, d1).penalty === 0 && R.lateRegistration(d1, d1 + 86400000).penalty === 10000 && R.lateRegistration(d1, d1 + 86400000).late === true);
  ok("waiver deadline = 7 months after the end of the first tax period (31/12/2025 -> 31/07/2026; 31/08/2025 -> 31/03/2026)", R.msToDMY(R.waiverDeadline(R.isoToMs("2025-12-31"))) === "31/07/2026" && R.msToDMY(R.waiverDeadline(R.isoToMs("2025-08-31"))) === "31/03/2026");
  const t = R.genTrn("100123456789012"); ok("CT number: 15 digits and never equal to the VAT number", /^\d{15}$/.test(t) && t !== "100123456789012");
  /* record + validation */
  let rec = F.blank(); ok("a new record is a Draft and holds no password", rec.status === "Draft" && JSON.stringify(rec).toLowerCase().indexOf("password") < 0);
  ok("empty section 1-5 are rejected", [1, 2, 3, 4, 5].every((s) => F.validate(s, rec.form).length > 0));
  const f = rec.form; f.legalNameEn = "Test LLC"; f.relevantDate = "2025-01-10"; f.licence = { number: "CN-1", authority: "DET", issueDate: "2025-01-10", expiryDate: "2026-01-09", docAttached: true };
  f.activities = [{ name: "Trading" }]; f.owners = [{ type: "Natural Person", name: "A", eid: "", share: "60" }, { type: "Natural Person", name: "B", eid: "", share: "50" }]; f.ownersDocAttached = true;
  ok("ownership above 100% is rejected", F.validate(2, f).some((m) => /100%/.test(m)));
  f.owners[1].share = "40"; f.address = "Office 1"; f.emirate = "Dubai"; f.phone = "0501234567"; f.email = "a@b.ae"; f.signatories = [{ firstName: "A", lastName: "B", eid: "784-1990-1234567-1", designation: "Manager", authAttached: true }]; f.declaration = true;
  ok("a complete application passes all five sections", [1, 2, 3, 4, 5].every((s) => F.validate(s, f).length === 0));
  f.fyMonth = 2; f.fyDay = 30; ok("30 February is not a valid financial year end", F.validate(1, f).length > 0); f.fyMonth = 12; f.fyDay = 31;
  ok("approve before submit does nothing", F.advance(rec, "approve") === false && ET.Reg.isApproved() === false);
  F.submit(rec); ET.Reg.set(rec);
  ok("2025-01-10 incorporation: deadline 10/04/2025 passed -> late registration penalty AED 10,000 imposed", rec.lateReg.deadline === "10/04/2025" && rec.lateReg.late === true && rec.lateReg.penalty === 10000 && rec.status === "Submitted" && /^CTREG-\d{4}-\d{6}$/.test(rec.appRef));
  ok("while Submitted the filing gate stays closed and person().trn is empty", ET.Reg.isApproved() === false && ET.person().trn === "");
  ok("more information -> status, reason kept, resubmission recorded", F.advance(rec, "moreinfo", "Licence copy unreadable") && rec.status === "MoreInfo" && rec.feedback === "Licence copy unreadable");
  F.submit(rec); ok("resubmitted application keeps its reference and goes back to Submitted", rec.status === "Submitted" && rec.history[rec.history.length - 1].note.indexOf("Resubmitted") === 0);
  ok("reject keeps no TRN", F.advance(rec, "reject", "Not eligible") && rec.status === "Rejected" && rec.ctTrn === "");
  ok("a rejected application cannot be approved", F.advance(rec, "approve") === false);
  rec = F.blank(); Object.assign(rec.form, f); F.submit(rec); F.advance(rec, "review"); ok("under review", rec.status === "UnderReview");
  F.advance(rec, "approve"); ET.Reg.set(rec);
  ok("approved: CT TRN issued, gate opens, person().trn is the CT number and VAT number is kept apart", /^\d{15}$/.test(rec.ctTrn) && ET.Reg.isApproved() === true && ET.person().trn === rec.ctTrn && ET.person().vatTrn !== rec.ctTrn);
  ET.Store.reset(); ok("Reset exercise also clears the registration", ET.Reg.get() === null && ET.Reg.isApproved() === false);
  console.log(bad ? bad + " FAILED" : "CT REGISTRATION OK"); process.exit(bad ? 1 : 0);
})();
