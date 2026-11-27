/* Loads every Corporate Tax page (signed in, approved registration, one submitted return) and fails on any script error. jsdom only. Run from emirates-tax-portal/ */
const fs = require("fs"); const { Browser } = require("./e2e-agent.js");
(async () => {
  const b = new Browser(() => {}); await b.goto("ct/index.html", 100); const ET = b.w.ET; let bad = 0;
  ET.SimDate.set("2026-10-21"); ET.Reg.set({ status: "Approved", ctTrn: "100111222333444", form: { relevantDate: "2025-01-10", fyMonth: 12, fyDay: 31, legalNameEn: "Test LLC", licence: {}, signatories: [], owners: [], activities: [] }, history: [], appRef: "CTREG-1", effectiveDate: "10/01/2025", lateReg: { late: true, penalty: 10000, deadline: "10/04/2025", submittedOn: "21/10/2026", rule: "r", source: "s" } });
  ET.Store.update((s) => { s.loggedIn = true; });
  for (const f of fs.readdirSync("ct").filter((x) => x.endsWith(".html")).sort()) {
    const before = b.errs.length; await b.goto("ct/" + f, 250); const ok = b.errs.length === before; if (!ok) bad++;
    console.log((ok ? "PASS " : "FAIL ") + f + (ok ? "" : "  " + String(b.errs[before]).slice(0, 160)));
  }
  ET.SimDate.set(""); console.log(bad ? bad + " FAILED" : "CT PAGES OK"); process.exit(bad ? 1 : 0);
})();
