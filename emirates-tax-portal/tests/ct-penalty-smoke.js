/* Corporate Tax penalty maths (jsdom). Run from emirates-tax-portal/ :  node tests/ct-penalty-smoke.js
   Rules: late filing AED 500 per month or part for 12 months then AED 1,000 (Cabinet Decision 75 of 2023); late payment 14% a year charged monthly, month or part, from the day after the due date. */
const { Browser } = require("./e2e-agent.js");
(async () => {
  const b = new Browser(() => {}); await b.goto("ct/index.html", 100); const ET = b.w.ET; let bad = 0;
  const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) bad++; };
  const D = (y, m, d) => new Date(y, m - 1, d), ML = (due, y, m, d) => ET.penalty.monthsLate(due, D(y, m, d));
  ok("on the due date: no month late", ML("30/09/2026", 2026, 9, 30) === 0);
  ok("day after the due date: 1 month", ML("30/09/2026", 2026, 10, 1) === 1);
  ok("20 days late: still 1 month (part of a month)", ML("30/09/2026", 2026, 10, 20) === 1 && ML("30/09/2026", 2026, 10, 31) === 1);
  ok("1 Nov: second monthly charge date", ML("30/09/2026", 2026, 11, 1) === 2);
  ok("31 Dec 2026: 3 months", ML("30/09/2026", 2026, 12, 31) === 3);
  ok("1 Sep 2027: 12 months; 1 Oct 2027: 13 months", ML("30/09/2026", 2027, 9, 1) === 12 && ML("30/09/2026", 2027, 10, 1) === 13);
  ok("month-end due date: 28 Feb counts the second monthly date (31 Jan start)", ML("30/01/2026", 2026, 2, 28) === 2);
  ok("late filing: 1 month 500, 12 months 6,000, 13 months 7,000 (published example), 14 months 8,000", [1, 12, 13, 14].map(ET.penalty.lateFiling).join() === "500,6000,7000,8000");
  ok("late payment: 25,200 for 1 month = 294.00; 50,000 for 3 months = 1,750.00; 50,000 for 1 month = 583.33", ET.penalty.latePayment(25200, 1) === 294 && ET.penalty.latePayment(50000, 3) === 1750 && ET.penalty.latePayment(50000, 1) === 583.33);
  ok("money shows fils only when needed", ET.money(25994) === "25,994" && ET.money(583.33) === "583.33" && ET.money(0) === "0" && ET.money(-1200) === "-1,200");
  const f = { netPosition: 25200, lateFilingMonths: 1, lateFilingPenalty: 500, payment: null }; const due = ET.period().due.split("/"); const late = new Date(+due[2], 9, 20); const pd = ET.penaltyDue(f, late);
  ok("penaltyDue on 20 Oct after the due date: tax 25,200 + filing 500 + payment 294 = 25,994", pd.tax === 25200 && pd.lateFiling === 500 && pd.latePayment === 294 && pd.total === 25994);
  const paid = ET.penaltyDue({ netPosition: 25200, payment: { status: "Paid", breakdown: { total: 25994 } } }, late);
  ok("after payment the breakdown is frozen", paid.total === 25994);
  console.log(bad ? bad + " FAILED" : "CT PENALTY OK"); process.exit(bad ? 1 : 0);
})();
