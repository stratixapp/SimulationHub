/* Invoice generator rule checks (jsdom). Run from emirates-tax-portal/ :  node tests/invoice-rules-smoke.js
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
  async function run(f) {
    const pg = await open("pages/invoice-generator.html"); const d = pg.w.document;
    const set = (id, v) => { const e = d.getElementById(id); e.value = v; e.dispatchEvent(new pg.w.Event("input")); e.dispatchEvent(new pg.w.Event("change")); };
    set("docDate", f.doc); set("supplyDate", f.sup); set("customerName", "Test Customer"); set("description", "Goods"); set("quantity", "1"); set("unitPrice", f.price || "1000");
    if (f.cn) { const rb = d.querySelector('input[name="docType"][value="Tax Credit Note"]'); rb.checked = true; rb.dispatchEvent(new pg.w.Event("change")); set("relatedInvoice", "INV-0001"); if (f.reason) set("cnReason", f.reason); }
    if (f.trn) set("customerTrn", f.trn); if (f.addr) set("customerAddress", f.addr); if (f.cur) set("currency", f.cur); if (f.fx) set("fxRate", f.fx); set("invFormat", f.fmt || "full"); if (f.rc) d.getElementById("reverseCharge").checked = true;
    (f.extra || []).forEach((x) => { d.getElementById("btnAddLine").click(); const row = Array.from(d.querySelectorAll("#extraLines .xl-row")).pop(), g = (k) => row.querySelector('[data-k="' + k + '"]'); g("description").value = x.d; g("quantity").value = x.q; g("unitPrice").value = x.p; g("taxTreatment").value = x.t || "standard"; row.dispatchEvent(new pg.w.Event("input", { bubbles: true })); });
    d.getElementById("btnGenerate").click();
    return { txt: d.body.textContent, prev: d.getElementById("invoicePreview").textContent, errs: pg.errs };
  }
  let r = await run({ doc: "2026-10-20", sup: "2026-10-01" });
  ok("full invoice 19 days after supply is blocked (Art. 67)", /within 14 days/.test(r.txt));
  r = await run({ doc: "2026-10-11", sup: "2026-10-01" });
  ok("full invoice 10 days after supply is accepted", /generated/.test(r.txt) && !/within 14 days/.test(r.txt));
  r = await run({ doc: "2026-10-11", sup: "2026-10-01", fmt: "simplified" });
  ok("simplified invoice not on the supply date is blocked", /on the date of supply/.test(r.txt));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", fmt: "simplified" });
  ok("simplified invoice on the supply date is accepted", /generated/.test(r.txt));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", fmt: "simplified", rc: true });
  ok("simplified invoice with reverse charge is blocked", /reverse charge applies/.test(r.txt));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", fmt: "simplified", trn: "100123456700003", price: "20000" });
  ok("simplified invoice above AED 10,000 to a registered customer is blocked", /AED 10,000/.test(r.txt));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", cur: "USD" });
  ok("foreign currency without exchange rate is blocked", /Central Bank exchange rate/.test(r.txt));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", cur: "USD", fx: "3.6725" });
  ok("foreign currency with exchange rate is accepted and the preview shows VAT in AED", /generated/.test(r.txt) && /VAT in AED/.test(r.prev));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", trn: "100123456700003" });
  ok("full invoice to a registered customer without address is blocked", /customer's address/.test(r.txt));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", trn: "100123456700003", addr: "Dubai, UAE" });
  ok("full invoice to a registered customer with address is accepted", /generated/.test(r.txt));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", cn: true });
  ok("credit note without an explanation is blocked (Art. 60(1))", /brief explanation/.test(r.txt));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", cn: true, reason: "Goods returned" });
  ok("credit note with an explanation is accepted", /generated/.test(r.txt));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", cn: true, reason: "Goods returned", trn: "100123456700003" });
  ok("credit note to a registered customer without address is blocked", /name, address and TRN/.test(r.txt));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", extra: [{ d: "Export freight", q: "1", p: "500", t: "zero" }] });
  ok("two-line invoice with a zero-rated second line is accepted and the preview lists both lines", /generated/.test(r.txt) && /Goods/.test(r.prev) && /Export freight/.test(r.prev) && /0% zero-rated/.test(r.prev) && /mixed rates/.test(r.prev));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", extra: [{ d: "", q: "1", p: "500" }] });
  ok("incomplete second line is blocked", /Complete line 2/.test(r.txt));
  r = await run({ doc: "2026-10-01", sup: "2026-10-01", rc: true, extra: [{ d: "Export freight", q: "1", p: "500", t: "zero" }] });
  ok("reverse charge with a zero-rated line is blocked", /Reverse charge applies only/.test(r.txt));
  r = await run({ doc: "2026-11-10", sup: "2026-10-05", fmt: "summary" });
  ok("summary invoice 10 days after month end is accepted", /generated/.test(r.txt));
  r = await run({ doc: "2026-11-20", sup: "2026-10-05", fmt: "summary" });
  ok("summary invoice 20 days after month end is blocked", /summary tax invoice must be issued within 14 days/.test(r.txt));
  ok("no script errors", r.errs.length === 0 || (console.log(r.errs), false));
  console.log(bad ? bad + " FAILED" : "INVOICE RULES OK"); process.exit(bad ? 1 : 0);
})();
