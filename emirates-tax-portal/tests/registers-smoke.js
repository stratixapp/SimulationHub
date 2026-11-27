/* Registers practice set check (jsdom). Run from emirates-tax-portal/ :  node tests/registers-smoke.js
   Seeds an account (same literal as ui-smoke.js), picks every correct answer, then wrong ones, and checks the sheet. */
const fs = require("fs"), path = require("path");
const { open, store } = require("./ui-smoke.js");
(async () => {
  const src = fs.readFileSync(path.join(__dirname, "ui-smoke.js"), "utf8");
  const acc = eval("(" + src.match(/const acc=(\{.*?\});/s)[1] + ")");
  const boot = await open("pages/other-services.html", { wait: 200 });
  const V = boot.w.eval("VATSIM"); V.saveAccount(acc); V.setSession({ email: acc.email, loggedInAt: new Date().toISOString() });
  const fl = V.newFilingSkeleton(acc, { label: "Jul-Sep 2026", from: "2026-07-01", to: "2026-09-30", dueDate: "2026-10-28", taxYear: "2026", taxYearEnd: "2026-12-31", stagger: "Quarterly (calendar quarters)" });
  const fillBoxes = (b, b9vat) => { b.b1.dubai.amount = 130000; b.b1.dubai.vat = 6500; b.b3.amount = 20000; b.b3.vat = 1000; b.b4.amount = 60000; b.b5.amount = 24000; b.b9.amount = 65000; b.b9.vat = b9vat; b.b10.amount = 20000; b.b10.vat = 1000; };
  fillBoxes(fl.boxes, 3250); V.saveFilings([fl]);
  for (let i = 0; i < boot.w.localStorage.length; i++) { const k = boot.w.localStorage.key(i); store[k] = boot.w.localStorage.getItem(k); }
  const pg = await open("pages/registers.html"); const d = pg.w.document; let bad = 0;
  const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) bad++; };
  const ANS = { S1: "std", S2: "std", S3: "zero", S4: "exempt", S5: "std", P1: "rec", P2: "rec", P3: "blk", P4: "blk", P5: "rec", P6: "rec", P7: "blk", P8: "rc", P9: "blk" };
  const pick = (m) => Object.keys(m).forEach((id) => { const s = d.querySelector('select[data-id="' + id + '"]'); s.value = m[id]; s.dispatchEvent(new pg.w.Event("change")); });
  pick(ANS); d.getElementById("btnCheck").click();
  const txt = d.getElementById("calcBody").textContent.replace(/\s+/g, " ");
  ["130,000.00", "6,500.00", "20,000.00", "1,000.00", "60,000.00", "24,000.00", "65,000.00", "3,250.00", "1,500.00", "7,500.00", "4,250.00"].forEach((v) => ok("expected figure " + v + " on sheet", txt.includes(v)));
  ok("all correct -> no wrong marks", !/✕/.test(d.getElementById("salesBody").textContent + d.getElementById("purchBody").textContent + txt));
  pick({ P3: "rec", S3: "std" }); d.getElementById("btnCheck").click();
  ok("wrong answers flagged", /✕/.test(d.getElementById("purchBody").textContent) && /✕/.test(d.getElementById("calcBody").textContent));
  d.getElementById("btnCmp").click();
  pick(ANS); d.getElementById("btnCmp").click();
  ok("draft return matching registers -> all boxes tick", /Box 10/.test(d.getElementById("cmpOut").textContent) && !/✕/.test(d.getElementById("cmpOut").textContent));
  fillBoxes(fl.boxes, 3000); boot.w.eval("VATSIM").saveFilings([fl]); for (let i = 0; i < boot.w.localStorage.length; i++) { const k = boot.w.localStorage.key(i); store[k] = boot.w.localStorage.getItem(k); }
  const pg2 = await open("pages/registers.html"); const d2 = pg2.w.document;
  Object.keys(ANS).forEach((id) => { const s = d2.querySelector('select[data-id="' + id + '"]'); s.value = ANS[id]; s.dispatchEvent(new pg2.w.Event("change")); });
  d2.getElementById("btnCmp").click();
  ok("wrong Box 9 VAT in draft is flagged", /✕/.test(d2.getElementById("cmpOut").textContent));
  ok("no script errors", pg.errs.length === 0 || (console.log(pg.errs), false));
  console.log(bad ? bad + " FAILED" : "REGISTERS OK"); process.exit(bad ? 1 : 0);
})();
