/* Corporate Tax tax periods + trainer simulated date (jsdom). Run from emirates-tax-portal/ :  node tests/ct-periods-smoke.js
   Due date = 9 months after the period end. First-period rules (6 to 18 months, FY starting on/after 1 June 2023) are SECONDARY sources. */
const { Browser } = require("./e2e-agent.js");
(async () => {
  const b = new Browser(() => {}); await b.goto("ct/index.html", 100); const ET = b.w.ET; let bad = 0;
  const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) bad++; };
  const approve = (inc, m, d) => { ET.Store.reset(); ET.Reg.set({ status: "Approved", ctTrn: "100111222333444", form: { relevantDate: inc, fyMonth: m, fyDay: d }, history: [] }); };
  const at = (iso) => ET.SimDate.set(iso);
  const sum = (p) => p.from + "-" + p.to + " due " + p.due + " (" + p.months + "m)";
  at("2026-10-21");
  approve("2025-01-10", 12, 31); let L = ET.periods();
  ok("inc 10/01/2025, FY end 31 Dec: first period 10/01/2025-31/12/2025, 11 months, due 30/09/2026; next period 2026 not ended", L.length === 2 && sum(L[0]) === "10/01/2025-31/12/2025 due 30/09/2026 (11m)" && L[0].ended && !L[1].ended && L[0].isFirst);
  ok("a period that is not a full year is called Tax Period End; the full year is Tax Year End", L[0].description === "Tax Period End Dec-2025" && L[1].description === "Tax Year End Dec-2026" && L[1].from === "01/01/2026");
  approve("2026-09-21", 12, 31); L = ET.periods();
  ok("inc 21/09/2026 (3 months to the year end): first period runs on to 31/12/2027, 15 months, due 30/09/2028, not ended", L.length === 1 && sum(L[0]) === "21/09/2026-31/12/2027 due 30/09/2028 (15m)" && !L[0].ended);
  approve("2026-07-01", 12, 31); ok("exactly 6 months (01/07/2026-31/12/2026) stays a 6-month first period", sum(ET.periods()[0]).indexOf("(6m)") > -1 && ET.periods()[0].to === "31/12/2026");
  approve("2026-07-02", 12, 31); ok("5 months 30 days (from 02/07/2026) is under 6 months, so it runs on to 31/12/2027", ET.periods()[0].to === "31/12/2027");
  approve("2019-03-15", 12, 31); L = ET.periods();
  ok("established 2019, FY Dec: first period is the financial year starting on/after 1 June 2023 = 01/01/2024-31/12/2024, due 30/09/2025; then 2025 and 2026 follow", L[0].from === "01/01/2024" && L[0].to === "31/12/2024" && L[0].due === "30/09/2025" && L.length === 3);
  approve("2019-03-15", 3, 31); L = ET.periods();
  ok("established 2019, FY end 31 Mar: first period 01/04/2024-31/03/2025 (the 2023-24 year starts before 1 June 2023), due 31/12/2025; 3 periods on 21/10/2026", L[0].from === "01/04/2024" && L[0].to === "31/03/2025" && L[0].due === "31/12/2025" && L.length === 3);
  approve("2019-03-15", 6, 30); ok("FY end 30 June: due date is 31 March (month-end convention)", ET.periods()[0].to === "30/06/2024" && ET.periods()[0].due === "31/03/2025");
  approve("2019-03-15", 2, 28); ok("FY end 28 Feb: first period 01/03/2024-28/02/2025 is due 30 November 2025", ET.periods()[0].from === "01/03/2024" && ET.periods()[0].to === "28/02/2025" && ET.periods()[0].due === "30/11/2025");
  ET.Store.reset(); ok("no approved registration: one placeholder period (last calendar year)", ET.periods().length === 1 && ET.periods()[0].unregistered === true && ET.periods()[0].to === "31/12/2025");
  /* simulated date */
  approve("2025-01-10", 12, 31);
  at("2027-10-21"); L = ET.periods(); ok("simulated date 21/10/2027: the 2026 period has ended (due 30/09/2027) and 2027 is the open one", L.length === 3 && L[1].ended && L[1].due === "30/09/2027" && !L[2].ended);
  ok("ET.now() follows the simulated date and todayStr uses it", ET.now().getFullYear() === 2027 && ET.now().getMonth() === 9 && ET.now().getDate() === 21 && ET.todayStr() === "21/10/2027");
  ok("an invalid date is ignored and clearing restores the real date", ET.SimDate.set("21-10-2027") === "" && ET.SimDate.active() === false && Math.abs(ET.now() - new Date()) < 5000);
  /* the three class cases, first period 2025, due 30/09/2026 */
  const f = { netPosition: 25200, payment: null, lateFilingMonths: 0, lateFilingPenalty: 0 }, due = "30/09/2026", asOf = (y, m, d) => new Date(y, m - 1, d);
  const m = (y, mo, d) => ET.penalty.monthsLate(due, asOf(y, mo, d));
  ok("on time (20/09/2026): 0 months, no penalties", m(2026, 9, 20) === 0 && ET.penaltyDue(f, asOf(2026, 9, 20), due).latePayment === 0);
  ok("1 month late (20/10/2026): filing 500, late payment 294.00", m(2026, 10, 20) === 1 && ET.penalty.lateFiling(1) === 500 && ET.penaltyDue(f, asOf(2026, 10, 20), due).latePayment === 294);
  ok("13 months late (20/10/2027): filing 7,000, late payment 3,822.00", m(2027, 10, 20) === 13 && ET.penalty.lateFiling(13) === 7000 && ET.penaltyDue(f, asOf(2027, 10, 20), due).latePayment === 3822);
  /* per-period storage and active period */
  at("2027-10-21"); ET.Store.update((s) => { s.filing.status = "Submitted"; s.filing.appNumber = "X1"; });
  ok("the filing is saved in the slot of the active period only", ET.Store.slot("2025-12-31").filing.status === "Submitted" && ET.Store.slot("2026-12-31").filing.status === "Open");
  ET.setActivePeriod("2026-12-31"); ok("choosing another period switches the data the return pages see", ET.Store.get().period.to === "31/12/2026" && ET.Store.get().filing.status === "Open" && ET.period().due === "30/09/2027");
  ET.Store.update((s) => { s.filing.status = "Draft"; }); ok("the second period keeps its own draft", ET.Store.slot("2026-12-31").filing.status === "Draft" && ET.Store.slot("2025-12-31").filing.status === "Submitted");
  b.w.ET.SimDate.set(""); console.log(bad ? bad + " FAILED" : "CT PERIODS OK"); process.exit(bad ? 1 : 0);
})();
