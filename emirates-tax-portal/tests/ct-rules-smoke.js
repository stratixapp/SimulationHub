/* Corporate Tax calculation rules encoded in return.js (jsdom). Run from emirates-tax-portal/ :  node tests/ct-rules-smoke.js
   Rules and sources: see tests/QA_REPORT.md Round 19. jsdom is not a real browser. */
const fs = require("fs"); const { Browser } = require("./e2e-agent.js");
(async () => {
  const b = new Browser(() => {}); await b.goto("ct/index.html", 100); let ET = b.w.ET, bad = 0;
  const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) bad++; };
  const reg = (inc) => ET.Reg.set({ status: "Approved", ctTrn: "100111222333444", form: { relevantDate: inc, fyMonth: 12, fyDay: 31 }, history: [] });
  ET.SimDate.set("2026-10-21"); reg("2025-01-10"); ET.Store.update((s) => { s.loggedIn = true; });
  await b.goto("ct/return.html", 300); ET = b.w.ET; const calc = (v) => ET.ReturnCalc(v);
  ok("return page loads with no script errors", b.errs.length === 0 && typeof ET.ReturnCalc === "function");
  let c = calc({ revenue: 2000000, a_opex: 1000000, o_entertainment: 100000 });
  ok("entertainment: 50% added back (Decree-Law Art 32): income 1,000,000 + 50,000 = taxable 1,050,000", c.entertainmentAddBack === 50000 && c.taxableIncome === 1050000);
  ok("0% to AED 375,000 and 9% above: (1,050,000 - 375,000) x 9% = 60,750", c.band0 === 375000 && c.band9 === 675000 && c.taxBefore === 60750);
  c = calc({ revenue: 500000 }); ok("taxable income 500,000: tax 11,250; at exactly 375,000: tax 0", c.taxBefore === 11250 && calc({ revenue: 375000 }).taxBefore === 0);
  c = calc({ revenue: 3000000, a_opex: 1000000, r_losses_bf: 5000000, r_losses_used: 5000000 });
  ok("loss offset capped at 75% of income before losses (Art 37(2)): 2,000,000 -> uses 1,500,000, carries 3,500,000, taxable 500,000, tax 11,250", c.lossCap === 1500000 && c.lossesUsed === 1500000 && c.lossesCf === 3500000 && c.taxableIncome === 500000 && c.taxBefore === 11250);
  const IN = { revenue: 12000000, a_opex: 200000, a_interest: 11800000 };
  c = calc(IN); ok("first period 10/01/2025-31/12/2025 is 356 days: interest cap AED 12m x 356/365 = 11,704,110, so 95,890 of 11,800,000 is disallowed", c.interestCap === 11704110 && c.interestAllowed === 11704110 && c.interestDisallowed === 95890);
  reg("2019-03-15"); c = calc(IN); ok("a full 366-day period (first period 01/01/2024-31/12/2024) keeps the AED 12m cap: all 11,800,000 deductible", ET.period().to === "31/12/2024" && c.interestCap === 12000000 && c.interestDisallowed === 0);
  c = calc({ revenue: 40000000 }); ok("QFZP de minimis = lower of 5% of revenue or AED 5m: revenue 40m -> 2,000,000; 200m -> 5,000,000", c.deMinimis === 2000000 && calc({ revenue: 200000000 }).deMinimis === 5000000);
  const src = fs.readFileSync("ct/assets/js/return.js", "utf8");
  ok("DMTT is labelled as a separate Top-up Tax shown for training only, with the unverified figures named", /separate Top-up Tax under Cabinet Decision 142 of 2024/.test(src) && /not verified/.test(src));
  ET.SimDate.set(""); console.log(bad ? bad + " FAILED" : "CT RULES OK"); process.exit(bad ? 1 : 0);
})();
