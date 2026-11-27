/* Place of supply practice set check (jsdom). Run from emirates-tax-portal/ :  node tests/place-of-supply-smoke.js
   Seeds an account (same literal as ui-smoke.js), picks every correct answer, then wrong ones, and checks the sheet. */
const fs = require("fs"), path = require("path");
const { open, store } = require("./ui-smoke.js");
(async () => {
  const src = fs.readFileSync(path.join(__dirname, "ui-smoke.js"), "utf8");
  const acc = eval("(" + src.match(/const acc=(\{.*?\});/s)[1] + ")");
  const boot = await open("pages/other-services.html", { wait: 200 });
  const V = boot.w.eval("VATSIM"); V.saveAccount(acc); V.setSession({ email: acc.email, loggedInAt: new Date().toISOString() });
  for (let i = 0; i < boot.w.localStorage.length; i++) { const k = boot.w.localStorage.key(i); store[k] = boot.w.localStorage.getItem(k); }
  const pg = await open("pages/place-of-supply.html"); const d = pg.w.document; let bad = 0;
  const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) bad++; };
  const ANS = { G1: ["uae", "std"], G2: ["uae", "zero"], G3: ["uae", "zero"], G4: ["out", "oos"], S1: ["uae", "std"], S2: ["uae", "zero"], S3: ["uae", "std"], S4: ["uae", "zero"], S5: ["uae", "std"], S6: ["uae", "rc"], S7: ["uae", "rc"], S8: ["uae", "std"], Z1: ["uae", "std"], Z2: ["uae", "std"], Z3: ["uae", "zero"], Z4: ["out", "oos"], Z5: ["out", "oos"], Z6: ["uae", "std"] };
  const pick = (id, k, v) => { const s = d.querySelector('select[data-id="' + id + '"][data-k="' + k + '"]'); s.value = v; s.dispatchEvent(new pg.w.Event("change")); };
  Object.keys(ANS).forEach((id) => { pick(id, "pos", ANS[id][0]); pick(id, "tr", ANS[id][1]); });
  d.getElementById("btnCheck").click();
  ok("all correct -> 18 / 18", d.getElementById("scoreOut").textContent === "Score: 18 / 18");
  pick("G3", "tr", "std"); pick("S6", "pos", "out"); d.getElementById("btnCheck").click();
  ok("two wrong answers -> 16 / 18", d.getElementById("scoreOut").textContent === "Score: 16 / 18");
  ok("wrong answers show source text", /VATP019/.test(d.getElementById("posBody").textContent));
  ok("no script errors", pg.errs.length === 0 || (console.log(pg.errs), false));
  console.log(bad ? bad + " FAILED" : "PLACE-OF-SUPPLY OK"); process.exit(bad ? 1 : 0);
})();
