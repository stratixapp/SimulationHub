/* VAT ledger practice set check (jsdom). Run from emirates-tax-portal/ :  node tests/ledger-smoke.js
   Seeds an account (same literal as ui-smoke.js), picks every correct answer, then wrong ones, and checks the sheet. */
const fs = require("fs"), path = require("path");
const { open, store } = require("./ui-smoke.js");
(async () => {
  const src = fs.readFileSync(path.join(__dirname, "ui-smoke.js"), "utf8");
  const acc = eval("(" + src.match(/const acc=(\{.*?\});/s)[1] + ")");
  const boot = await open("pages/other-services.html", { wait: 200 });
  const V = boot.w.eval("VATSIM"); V.saveAccount(acc); V.setSession({ email: acc.email, loggedInAt: new Date().toISOString() });
  for (let i = 0; i < boot.w.localStorage.length; i++) { const k = boot.w.localStorage.key(i); store[k] = boot.w.localStorage.getItem(k); }
  let bad = 0; const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) bad++; };
  const KEY = { S1: "cr", S2: "cr", S3: "none", S4: "none", S5: "dr", P1: "in", P2: "in", P3: "cost", P4: "cost", P5: "in", P6: "in", P7: "cost", P8: "rc", P9: "cost" };
  async function run(over, close) {
    const pg = await open("pages/vat-ledger.html"); const d = pg.w.document;
    const ev = (e, t) => e.dispatchEvent(new pg.w.Event(t));
    Object.assign({}, KEY, over) && Object.keys(KEY).forEach((id) => { const s = d.querySelector('select[data-id="' + id + '"]'); s.value = (over && over[id]) || KEY[id]; ev(s, "change"); });
    const put = (id, v) => { const e = d.getElementById(id); e.value = v; };
    put("closeOut", close ? close[0] : "7500"); put("closeIn", close ? close[1] : "4250"); put("closeNet", close ? close[2] : "3250"); put("closeDir", "pay");
    d.getElementById("btnCheck").click();
    return { score: d.getElementById("scoreOut").textContent, recon: d.getElementById("reconOut").textContent, closing: d.getElementById("closeRes").textContent, ledOut: d.getElementById("ledOut").textContent, ledIn: d.getElementById("ledIn").textContent, errs: pg.errs };
  }
  let r = await run();
  ok("all postings and closing correct", r.score === "Posting: 14 / 14 \u00b7 Closing: 4 / 4");
  ok("VAT Output ledger balance 7,500.00 and Input 4,250.00", /7,500\.00/.test(r.ledOut) && /4,250\.00/.test(r.ledIn));
  ok("control account has no difference", /Net difference: 0\.00/.test(r.recon) && /No reconciling items/.test(r.recon));
  { const z = r.recon.replace(/\s+/g, ""); ok("input VAT reconciliation reaches 4,250.00 with tick", z.includes("Totalrecoverableinput VAT".replace(" ", "") + "4,250.00") && z.includes("Result\u2713")); }
  ok("closing journal and payment entry shown", /Cr VAT Payable 3,250\.00/.test(r.closing) && /28 October 2026/.test(r.closing));
  r = await run({ P3: "in" });
  ok("blocked line posted as recoverable -> 13 / 14 and 200.00 difference traced to SUP-773", r.score.startsWith("Posting: 13 / 14") && /SUP-773: effect on net VAT payable -200\.00/.test(r.recon) && /Net difference: -200\.00/.test(r.recon));
  r = await run({ S5: "cr" }, ["8500", "4250", "4250"]);
  ok("credit note posted as output: reconciling item CN-0001, 13 / 14 postings and 2 / 4 closing figures", /CN-0001/.test(r.recon) && /Posting: 13 \/ 14/.test(r.score) && /Closing: 2 \/ 4/.test(r.score));
  ok("no script errors", r.errs.length === 0 || (console.log(r.errs), false));
  console.log(bad ? bad + " FAILED" : "LEDGER OK"); process.exit(bad ? 1 : 0);
})();
