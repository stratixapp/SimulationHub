/* Employee expenses practice set check (jsdom). Run from emirates-tax-portal/ :  node tests/employee-smoke.js
   Seeds an account (same literal as ui-smoke.js), picks every correct answer, then wrong ones, and checks the sheet. */
const fs = require("fs"), path = require("path");
const { open, store } = require("./ui-smoke.js");
(async () => {
  const src = fs.readFileSync(path.join(__dirname, "ui-smoke.js"), "utf8");
  const acc = eval("(" + src.match(/const acc=(\{.*?\});/s)[1] + ")");
  const boot = await open("pages/other-services.html", { wait: 200 });
  const V = boot.w.eval("VATSIM"); V.saveAccount(acc); V.setSession({ email: acc.email, loggedInAt: new Date().toISOString() });
  for (let i = 0; i < boot.w.localStorage.length; i++) { const k = boot.w.localStorage.key(i); store[k] = boot.w.localStorage.getItem(k); }
  const pg = await open("pages/employee-expenses.html"); const d = pg.w.document; let bad = 0;
  const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) bad++; };
  const ANS = { E1: "blk", E2: "rec", E3: "rec", E4: "rec", E5: "blk", E6: "rec", E7: "rec", E8: "blk", E9: "rec", E10: "blk" };
  const pick = (id, v) => { const s = d.querySelector('select[data-id="' + id + '"]'); s.value = v; s.dispatchEvent(new pg.w.Event("change")); };
  Object.keys(ANS).forEach((id) => pick(id, ANS[id])); d.getElementById("btnCheck").click();
  ok("all correct -> 10 / 10", d.getElementById("scoreOut").textContent === "Score: 10 / 10");
  pick("E1", "rec"); pick("E6", "blk"); d.getElementById("btnCheck").click();
  ok("two wrong answers -> 8 / 10 with source text", d.getElementById("scoreOut").textContent === "Score: 8 / 10" && /Decision 17/.test(d.getElementById("empBody").textContent));
  ok("no script errors", pg.errs.length === 0 || (console.log(pg.errs), false));
  console.log(bad ? bad + " FAILED" : "EMPLOYEE OK"); process.exit(bad ? 1 : 0);
})();
