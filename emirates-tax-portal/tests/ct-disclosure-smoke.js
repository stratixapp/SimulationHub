/* Voluntary disclosure, incorrect return penalty, working days (jsdom). Run from emirates-tax-portal/ :  node tests/ct-disclosure-smoke.js
   Cabinet Decision 75/2023: incorrect return AED 500 unless corrected before the deadline; VD 1% of the Tax Difference per month or part from the day after the due date; 15% fixed if an audit was notified first. */
const { Browser } = require("./e2e-agent.js");
(async () => {
  const b = new Browser(() => {}); await b.goto("ct/index.html", 100); const ET = b.w.ET; let bad = 0;
  const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) bad++; };
  const due = "30/09/2026", D = (y, m, d) => new Date(y, m - 1, d, 12);
  const calc = (o, c, asOf, audit) => ET.vdCalc({ originalNet: o, correctedNet: c, dueDMY: due, asOf, auditNotified: !!audit });
  let c = calc(25200, 35200, D(2026, 10, 21));
  ok("1 month after the due date: difference 10,000, VD 1% = 100, incorrect return 500, total 10,600", c.mode === "vd" && c.diff === 10000 && c.monthsAfterDue === 1 && c.vdMonthly === 100 && c.incorrectReturn === 500 && c.total === 10600 && c.fixed15 === 0);
  ok("VD payment is due 20 working days after submission: 21/10/2026 -> 18/11/2026", c.payDueDMY === "18/11/2026");
  ok("AED 10,000 or less is not required to be a VD; above 10,000 it is", c.vdRequired === false && calc(25200, 35201, D(2026, 10, 21)).vdRequired === true);
  c = calc(25200, 45200, D(2027, 10, 20), true);
  ok("13 months late with an audit notified first: VD 20,000 x 1% x 13 = 2,600, fixed 15% = 3,000, incorrect return 500, total 26,100", c.monthsAfterDue === 13 && c.vdMonthly === 2600 && c.fixed15 === 3000 && c.incorrectReturn === 500 && c.total === 26100);
  c = calc(25200, 30200, D(2026, 9, 20));
  ok("corrected before the due date: no VD penalty, no incorrect return penalty, pay 5,000 by 30/09/2026", c.mode === "amended-before-deadline" && c.vdMonthly === 0 && c.incorrectReturn === 0 && c.total === 5000 && c.payDueDMY === due);
  ok("a disclosure on the due date itself is still before the deadline", calc(25200, 30200, D(2026, 9, 30)).mode === "amended-before-deadline");
  ok("the day after the due date is already 1 month or part", calc(25200, 30200, D(2026, 10, 1)).monthsAfterDue === 1 && calc(25200, 30200, D(2026, 10, 1)).vdMonthly === 50);
  c = calc(25200, 20200, D(2026, 10, 21));
  ok("overstated tax: overpaid 5,000 can be refunded; no VD penalty; incorrect return 500 applies after the deadline", c.mode === "overpaid" && c.refundable === 5000 && c.vdMonthly === 0 && c.incorrectReturn === 500);
  ok("same amount means nothing to disclose", calc(25200, 25200, D(2026, 10, 21)).mode === "nochange");
  ok("working days skip Saturday and Sunday: Fri 23/10/2026 + 1 = Mon 26/10/2026; + 5 = Fri 30/10/2026", ET.dmyDate(ET.addBusinessDays(D(2026, 10, 23), 1)) === "26/10/2026" && ET.dmyDate(ET.addBusinessDays(D(2026, 10, 23), 5)) === "30/10/2026");
  ET.Store.reset(); ET.SimDate.set("2026-10-21"); ET.Reg.set({ status: "Approved", ctTrn: "100111222333444", form: { relevantDate: "2025-01-10", fyMonth: 12, fyDay: 31 }, history: [] });
  ET.Store.update((s) => { s.filing.status = "Submitted"; s.filing.netPosition = 25200; s.disclosures = [{ ref: "CTVD-X", calc: c }]; s.refunds = [{ ref: "CTRF-X" }]; });
  ok("disclosures and refunds are kept in the slot of their own tax period", ET.Store.slot("2025-12-31").disclosures.length === 1 && ET.Store.slot("2025-12-31").refunds[0].ref === "CTRF-X" && ET.Store.slot("2026-12-31").disclosures.length === 0);
  ET.SimDate.set(""); console.log(bad ? bad + " FAILED" : "CT DISCLOSURE OK"); process.exit(bad ? 1 : 0);
})();
