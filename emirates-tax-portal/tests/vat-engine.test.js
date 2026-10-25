/* VAT201 engine tests — run:  node tests/vat-engine.test.js   (from emirates-tax-portal/)
   Loads js/storage.js in an isolated vm sandbox with an in-memory localStorage (no real data touched). */
const fs = require("fs"), vm = require("vm"), path = require("path");
const store = {};
const ctx = {
  console, Date, Math, JSON,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } },
  navigator: {}, location: { pathname: "/" },
};
ctx.window = ctx; ctx.addEventListener = () => {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/storage.js"), "utf8") + ";this.V=VATSIM;", ctx);
const V = ctx.V;

let pass = 0, fail = 0; const rows = [];
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  rows.push((ok ? "PASS " : "FAIL ") + name + (ok ? "" : "  expected=" + JSON.stringify(expected) + " actual=" + JSON.stringify(actual)));
}
const period = { label: "Q1", from: "2026-01-01", to: "2026-03-31", dueDate: "2026-04-28" };
function fresh() { const f = V.newFilingSkeleton({}, period); f.boxes.b2 = { amount: 0, vat: 0, seeded: true }; f.boxes.b6 = { amount: 0, vat: 0, seeded: true }; return f; }

// T1 empty return
{ const t = V.computeTotals(fresh().boxes); eq("T1 empty return: boxes 8/12/13/14 all 0", [t.box8amount, t.box8vat, t.box12, t.box13, t.box14, t.isRefund], [0, 0, 0, 0, 0, false]); }

// T2 Box 1 100,000 @5%
{ const f = fresh(); f.boxes.b1.dubai.amount = 100000; f.boxes.b1.dubai.vat = 5000; const t = V.computeTotals(f.boxes);
  eq("T2 Box1 100,000 -> output VAT 5,000", [t.box8amount, t.box8vat, t.box12, t.box14], [100000, 5000, 5000, 5000]); }

// T3 user's reported case: Box1 100k, Box2 16,169/808.45, Box6 19,173/958.65
{ const f = fresh(); f.boxes.b1.dubai.amount = 100000; f.boxes.b1.dubai.vat = 5000;
  f.boxes.b2 = { amount: 16169, vat: 808.45, seeded: true }; f.boxes.b6 = { amount: 19173, vat: 958.65, seeded: true };
  const t = V.computeTotals(f.boxes);
  eq("T3a Box 6 VAT = 19,173 x 5%", Math.round(19173 * 0.05 * 100) / 100, 958.65);
  eq("T3b Box 8 VAT = 5000 - 808.45 + 958.65", t.box8vat, 5150.2);
  eq("T3c Box 8 amount = 100,000 - 16,169 (Box 2 is negative) + 19,173", t.box8amount, 103004);
  eq("T3d Box 12 / 13 / 14", [t.box12, t.box13, t.box14], [5150.2, 0, 5150.2]); }

// T4 Box 3 amount belongs in Box 8 amount
{ const f = fresh(); f.boxes.b3.amount = 20000; f.boxes.b3.vat = 1000; const t = V.computeTotals(f.boxes);
  eq("T4 Box 3 20,000/1,000 -> Box 8 amount 20,000, VAT 1,000", [t.box8amount, t.box8vat], [20000, 1000]); }

// T5 zero-rated + exempt only: amount only, no VAT
{ const f = fresh(); f.boxes.b4.amount = 5000; f.boxes.b5.amount = 2000; const t = V.computeTotals(f.boxes);
  eq("T5 Box 4+5 -> Box 8 amount 7,000, VAT 0", [t.box8amount, t.box8vat, t.box12], [7000, 0, 0]); }

// T6 inputs, full recovery
{ const f = fresh(); f.boxes.b9.amount = 20000; f.boxes.b9.vat = 1000; f.boxes.b10.amount = 20000; f.boxes.b10.vat = 1000; const t = V.computeTotals(f.boxes);
  eq("T6 Box 9+10 -> Box 11 amount 40,000 VAT 2,000, Box 13 = 2,000", [t.box11amount, t.box11vat, t.box13], [40000, 2000, 2000]); }

// T7 refund position never clamped
{ const f = fresh(); f.boxes.b9.amount = 20000; f.boxes.b9.vat = 1000; const t = V.computeTotals(f.boxes);
  eq("T7 refund: Box 14 = -1,000, isRefund true (not clamped)", [t.box14, t.isRefund], [-1000, true]); }

// T8 zero balance
{ const f = fresh(); f.boxes.b1.dubai.amount = 20000; f.boxes.b1.dubai.vat = 1000; f.boxes.b9.amount = 20000; f.boxes.b9.vat = 1000; const t = V.computeTotals(f.boxes);
  eq("T8 zero balance", [t.box14, t.isRefund], [0, false]); }

// T9 Box 1 adjustment (negative) and Box 9 adjustment (either sign)
{ const f = fresh(); f.boxes.b1.dubai.amount = 100000; f.boxes.b1.dubai.vat = 5000; f.boxes.b1.dubai.adj = -500;
  f.boxes.b9.amount = 20000; f.boxes.b9.vat = 1000; f.boxes.b9.adj = 100; const t = V.computeTotals(f.boxes);
  eq("T9 adj: Box12 = 5000-500, Box13 = 1000+100, Box14 = 3400", [t.box12, t.box13, t.box14], [4500, 1100, 3400]); }

// T10 Box 7 negative adjustment (FTA: may be positive or negative)
{ const f = fresh(); f.boxes.b6 = { amount: 19173, vat: 958.65, seeded: true }; f.boxes.b7.amount = -5000; f.boxes.b7.vat = -250; const t = V.computeTotals(f.boxes);
  eq("T10 Box 7 negative: Box 8 VAT = 958.65 - 250", t.box8vat, 708.65);
  f.boxes.b10 = { amount: 14173, vat: 708.65 };
  eq("T10b Box 7 negative pair + matching Box 10 recovery -> no findings", V.validateBoxPairs(f.boxes), []); }

// T11 pair validation still catches real errors
{ const f = fresh(); f.boxes.b7.amount = 1000; f.boxes.b7.vat = ""; eq("T11a incomplete pair is a WARNING, not an error (real portal lets it through)", [V.validateBoxes(f.boxes).errors.length, V.validateBoxes(f.boxes).warnings.length], [0, 1]);
  const g = fresh(); g.boxes.b3.amount = 100; g.boxes.b3.vat = 500; eq("T11b VAT 500 on 100 -> 5% warning (+ Box 10 empty reminder), no hard error", [V.validateBoxes(g.boxes).errors.length, V.validateBoxes(g.boxes).warnings.length], [0, 2]);
  const h = fresh(); h.boxes.b7.amount = -100; h.boxes.b7.vat = -500; eq("T11c negative Box 7 with wrong VAT -> 5% warning", V.validateBoxes(h.boxes).warnings.some(w => /not 5%/.test(w)), true);
  const k = fresh(); k.boxes.b1.dubai.amount = 1000; k.boxes.b1.dubai.vat = 50; k.boxes.b1.dubai.adj = 25; eq("T11d positive Box 1 adjustment is a hard ERROR", V.validateBoxes(k.boxes).errors.length, 1); }

// T12 rounding / idempotence / 2-dp
{ const f = fresh(); f.boxes.b1.dubai.amount = "0.1"; f.boxes.b1.dubai.vat = "0.2"; f.boxes.b1.sharjah.amount = "0.2"; f.boxes.b1.sharjah.vat = "0.1"; const t = V.computeTotals(f.boxes);
  eq("T12a float trap 0.1+0.2 -> 0.3", [t.box8vat, t.box12], [0.3, 0.3]);
  const a = JSON.stringify(V.computeTotals(f.boxes)), c = JSON.stringify(V.computeTotals(f.boxes)); eq("T12b recalculation is idempotent", a, c);
  eq("T12c sanitizeMoney trims to 2 dp", V.sanitizeMoney ? [V.sanitizeMoney("12.3456"), V.sanitizeMoney("-7.891", true), V.sanitizeMoney("-7.891", false)] : "missing", ["12.34", "-7.89", "7.89"]); }

// T13 all 7 emirates counted once
{ const f = fresh(); ["abudhabi","dubai","sharjah","ajman","uaq","rak","fujairah"].forEach(k => { f.boxes.b1[k].amount = 1000; f.boxes.b1[k].vat = 50; });
  const t = V.computeTotals(f.boxes); eq("T13 seven emirates: 7,000 / 350, no double count", [t.b1amt, t.b1vat, t.box8amount, t.box12], [7000, 350, 7000, 350]); }

// T14 feeds: Box 2 / Box 6 are LOCKED feeds. Default = 0.00 (no Customs / tourist-refund records). Training feed is opt-in.
{ const f = V.newFilingSkeleton({}, period); eq("T14a new filing starts with zero Box 2 / Box 6", [f.boxes.b2.amount, f.boxes.b6.amount, f.boxes.b2.seeded, f.boxes.b6.seeded], [0, 0, false, false]);
  V.seedIntegrationFeeds(f); eq("T14b feed OFF (default): Box 2 / Box 6 stay 0.00", [f.boxes.b2.amount, f.boxes.b6.amount], [0, 0]);
  V.saveAccount({ simulateFeeds: true }); V.seedIntegrationFeeds(f); const a = [f.boxes.b2.amount, f.boxes.b6.amount]; V.seedIntegrationFeeds(f);
  eq("T14c feed ON: values appear, stable, VAT = 5%", [a[0] > 0, a[1] > 0, [f.boxes.b2.amount, f.boxes.b6.amount], f.boxes.b6.vat], [true, true, a, Math.round(a[1] * 5) / 100]);
  f.status = "Submitted"; V.saveAccount({ simulateFeeds: false }); V.seedIntegrationFeeds(f);
  eq("T14d submitted returns keep what was filed when the feed is switched off", [f.boxes.b2.amount, f.boxes.b6.amount], a);
  const g = V.newFilingSkeleton({}, period); V.saveAccount({ simulateFeeds: true }); V.seedIntegrationFeeds(g); V.saveAccount({ simulateFeeds: false }); V.seedIntegrationFeeds(g);
  eq("T14e open return goes back to 0.00 when the feed is switched off", [g.boxes.b2.amount, g.boxes.b6.amount], [0, 0]); }
// T21 credit notes: negative Box 1 / Box 9 totals are accepted and flow through the totals
{ const f = fresh(); f.boxes.b1.dubai.amount = -2000; f.boxes.b1.dubai.vat = -100; f.boxes.b9.amount = -1000; f.boxes.b9.vat = -50; const t = V.computeTotals(f.boxes);
  eq("T21a credit-note period: Box 12 = -100, Box 13 = -50, Box 14 = -50 (refundable)", [t.box12, t.box13, t.box14, t.isRefund], [-100, -50, -50, true]);
  eq("T21b matching negative pairs raise no findings", V.validateBoxes(f.boxes).errors.concat(V.validateBoxes(f.boxes).warnings), []); }
// T22 5% check is a warning that does NOT block; Box 9 may recover LESS than 5% but not more
{ const f = fresh(); f.boxes.b1.dubai.amount = 1000; f.boxes.b1.dubai.vat = 40; const r = V.validateBoxes(f.boxes);
  eq("T22a Box 1 VAT not 5% -> one warning, zero errors", [r.errors.length, r.warnings.length], [0, 1]);
  const g = fresh(); g.boxes.b9.amount = 1000; g.boxes.b9.vat = 30; eq("T22b Box 9 partial recovery (30 on 1000) is fine", V.validateBoxes(g.boxes).warnings.length, 0);
  g.boxes.b9.vat = 80; eq("T22c Box 9 recovering more than 5% warns", V.validateBoxes(g.boxes).warnings.length, 1); }
// T23 Box 10 is the recovery side of Boxes 3, 6, 7
{ const f = fresh(); f.boxes.b3.amount = 10000; f.boxes.b3.vat = 500;
  eq("T23a reverse charge declared but Box 10 empty -> reminder", V.validateBoxes(f.boxes).warnings.length, 1);
  f.boxes.b10.amount = 10000; f.boxes.b10.vat = 500; eq("T23b Box 10 mirrors Box 3 -> clean, Box 14 = 0", [V.validateBoxes(f.boxes).warnings.length, V.computeTotals(f.boxes).box14], [0, 0]);
  f.boxes.b10.amount = 20000; f.boxes.b10.vat = 1000; eq("T23c Box 10 larger than Boxes 3+6+7 -> warning", V.validateBoxes(f.boxes).warnings.some(w => /more reverse-charge input tax/.test(w)), true);
  f.boxes.b10.amount = 8000; f.boxes.b10.vat = 400; eq("T23d partial recovery (less than declared) is allowed", V.validateBoxes(f.boxes).warnings.length, 0); }

// T15 registration thresholds never touch return boxes
{ const src = fs.readFileSync(path.join(__dirname, "../js/register.js"), "utf8"); eq("T15 register.js never writes boxes b1/b6", /boxes\s*\.\s*b[16]|b\.b[16]/.test(src), false); }

// T16 late-payment months = calendar months ("each month or part", first period starts day after due date)
{ const due = "2026-04-28";
  eq("T16a paid on due date -> 0", V.lateMonths(due, "2026-04-28"), 0);
  eq("T16b 1 day late -> 1", V.lateMonths(due, "2026-04-29"), 1);
  eq("T16c 28 May (end of month 1) -> 1", V.lateMonths(due, "2026-05-28"), 1);
  eq("T16d 29 May (month 2 starts) -> 2", V.lateMonths(due, "2026-05-29"), 2);
  eq("T16e 10 Oct 2026 -> 6", V.lateMonths(due, "2026-10-10"), 6);
  eq("T16f Feb clamp: due 2026-01-30 -> month 2 starts 28 Feb, month 3 starts 31 Mar; end 3 Mar -> 2", V.lateMonths("2026-01-30", "2026-03-03"), 2);
  eq("T16g same due date, end 31 Mar -> 3", V.lateMonths("2026-01-30", "2026-03-31"), 3); }

// T17 filed on time but paid late still pays the late-payment charge (no late-filing fee)
{ const f = fresh(); f.boxes.b1.dubai.amount = 20000; f.boxes.b1.dubai.vat = 1000;
  f.status = "Submitted"; f.submittedAt = "2026-04-20T10:00:00.000Z"; f.payment = { status: "Paid", date: "2026-05-29", amount: 1000 };
  const p = V.computeFilingPenalty(f, [f]);
  eq("T17 on-time filing, paid 29 May: late filing 0, late payment 1000 x 14% x 2/12 = 23.33", [p.isLateFiling, p.lateFiling, p.isLatePayment, p.monthsLate, p.latePayment, p.total], [false, 0, true, 2, 23.33, 23.33]); }

// T18 late filing + late payment together; and nothing when on time & paid on time
{ const f = fresh(); f.boxes.b1.dubai.amount = 20000; f.boxes.b1.dubai.vat = 1000;
  f.status = "Submitted"; f.submittedAt = "2026-05-10T10:00:00.000Z"; f.payment = { status: "Paid", date: "2026-05-10", amount: 1000 };
  const p = V.computeFilingPenalty(f, [f]);
  eq("T18a late filing 1,000 + late payment (1 month) 11.67", [p.lateFiling, p.latePayment, p.total], [1000, 11.67, 1011.67]);
  const g = fresh(); g.boxes.b1.dubai.amount = 20000; g.boxes.b1.dubai.vat = 1000;
  g.status = "Submitted"; g.submittedAt = "2026-04-20T10:00:00.000Z"; g.payment = { status: "Paid", date: "2026-04-25", amount: 1000 };
  eq("T18b on time and paid on time -> no penalty", V.computeFilingPenalty(g, [g]).total, 0); }


/* ===================== Round 3 regression tests =====================
   Helpers: build local-time instants (so results do not depend on the machine's timezone) and
   freeze "now" for the functions that read the clock. */
function localISO(y, m, d, hh, mm, ss) { return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0).toISOString(); }
function withNow(iso, fn) {
  const Real = ctx.Date;
  class D extends Real { constructor(...a) { if (a.length === 0) super(iso); else super(...a); } static now() { return new Real(iso).getTime(); } }
  ctx.Date = D; try { return fn(); } finally { ctx.Date = Real; }
}
function mkFiling(from, to, due, boxFn) {
  const f = V.newFilingSkeleton({}, { label: from, from, to, dueDate: due, taxYear: from.slice(0, 4), taxYearEnd: from.slice(0, 4) + "-12-31", stagger: "Quarterly (calendar quarters)" });
  f.boxes.b2 = { amount: 0, vat: 0 }; f.boxes.b6 = { amount: 0, vat: 0 };
  if (boxFn) boxFn(f.boxes); return f;
}

// T30 due date is inclusive: the whole due day is on time (was: filed on the due date = late, AED 1,000)
{ const due = "2026-10-28";
  eq("T30a 28 Oct 00:00:01 local -> on time", V.isPastDue(due, localISO(2026, 10, 28, 0, 0, 1)), false);
  eq("T30b 28 Oct 09:00 local -> on time", V.isPastDue(due, localISO(2026, 10, 28, 9)), false);
  eq("T30c 28 Oct 23:59:59 local -> on time", V.isPastDue(due, localISO(2026, 10, 28, 23, 59, 59)), false);
  eq("T30d 29 Oct 00:00:00 local -> late", V.isPastDue(due, localISO(2026, 10, 29, 0, 0, 0)), true); }

// T31 filed AND paid on the due date -> no penalty at all; one day later -> 1,000 + 1 month late payment
{ const mk = () => mkFiling("2026-07-01", "2026-09-30", "2026-10-28", (b) => { b.b1.dubai.amount = 20000; b.b1.dubai.vat = 1000; });
  const a = mk(); a.status = "Submitted"; a.submittedAt = localISO(2026, 10, 28, 9); a.payment = { status: "Paid", date: "2026-10-28", amount: 1000 };
  eq("T31a filed+paid on the due date -> penalty 0", V.computeFilingPenalty(a, [a]).total, 0);
  const b = mk(); b.status = "Submitted"; b.submittedAt = localISO(2026, 10, 29, 9); b.payment = { status: "Paid", date: "2026-10-29", amount: 1000 };
  const pb = V.computeFilingPenalty(b, [b]);
  eq("T31b filed+paid 1 day late -> 1,000 + 1000x14%x1/12 = 11.67", [pb.lateFiling, pb.latePayment, pb.total], [1000, 11.67, 1011.67]); }

// T32 status badge / days-left use the whole due day
{ const f = mkFiling("2026-07-01", "2026-09-30", "2026-10-28");
  eq("T32a badge on the due date (15:00) -> Draft", withNow(localISO(2026, 10, 28, 15), () => V.filingStatusBadge(f).label), "Draft");
  eq("T32b badge next day -> Overdue", withNow(localISO(2026, 10, 29, 8), () => V.filingStatusBadge(f).label), "Overdue");
  eq("T32c daysUntilDue: 3 days before / on / after", [withNow(localISO(2026, 10, 25, 22), () => V.daysUntilDue("2026-10-28")), withNow(localISO(2026, 10, 28, 1), () => V.daysUntilDue("2026-10-28")), withNow(localISO(2026, 10, 29, 1), () => V.daysUntilDue("2026-10-28"))], [3, 0, -1]); }

// T33 Voluntary Disclosure keeps the original Adjustment columns
{ const f = mkFiling("2026-07-01", "2026-09-30", "2026-10-28", (b) => {
    b.b1.dubai = { amount: 100000, vat: 5000, adj: -300 }; b.b9 = { amount: 20000, vat: 1000, adj: -50 }; });
  const orig = V.computeTotals(f.boxes);
  const same = { b1amount: 100000, b1vat: 5000, b3amount: 0, b3vat: 0, b4amount: 0, b5amount: 0, b7amount: 0, b7vat: 0, b9amount: 20000, b9vat: 1000, b10amount: 0, b10vat: 0 };
  eq("T33a VD with unchanged figures -> difference exactly 0", V.round2(V.computeTotals(V.buildCorrectedBoxes(f.boxes, same)).box14 - orig.box14), 0);
  const more = Object.assign({}, same, { b1amount: 120000, b1vat: 6000 });
  eq("T33b VD raising Box 1 VAT by 1,000 -> difference exactly 1,000", V.round2(V.computeTotals(V.buildCorrectedBoxes(f.boxes, more)).box14 - orig.box14), 1000);
  const c = V.computeTotals(V.buildCorrectedBoxes(f.boxes, same));
  eq("T33c adjustment columns survive (Box 8 adj -300, Box 11 adj -50)", [c.box8adj, c.box11adj], [-300, -50]); }

// T34 VD penalty = 1% per calendar month or part month (same count as late payment)
{ const P = (d, vd, audit) => V.computeVdPenalty(d, "2026-07-28", vd, !!audit);
  eq("T34a VD on 28 Aug (end of month 1) -> 1 month", P(12000, "2026-08-28T10:00:00").monthsElapsed, 1);
  eq("T34b VD on 29 Aug -> 2 months", P(12000, "2026-08-29T10:00:00").monthsElapsed, 2);
  eq("T34c Sarmat example: 12,000 disclosed 15 Sep -> 2 months, AED 240", [P(12000, "2026-09-15T10:00:00").monthsElapsed, P(12000, "2026-09-15T10:00:00").total], [2, 240]);
  eq("T34d after audit notice: +15% fixed = 1,800 + 240", P(12000, "2026-09-15T10:00:00", true).total, 2040);
  eq("T34e month-end clamp: due 31 Jan, VD 1 Mar -> same as lateMonths (2)", V.computeVdPenalty(1000, "2026-01-31", "2026-03-01T10:00:00", false).monthsElapsed, V.lateMonths("2026-01-31", "2026-03-01"));
  eq("T34f VD on/before the original due date -> no monthly penalty", P(12000, "2026-07-20T10:00:00").applicable, false);
  eq("T34g refund-side correction -> no penalty", P(-500, "2026-09-15T10:00:00").applicable, false); }

// T35 Box 15 = "No": the credit really is set off against the next payable returns
{ const q1 = mkFiling("2026-01-01", "2026-03-31", "2026-04-28", (b) => { b.b1.dubai.amount = 10000; b.b1.dubai.vat = 500; b.b9.amount = 40000; b.b9.vat = 2000; b.requestRefund = "No"; });
  const q2 = mkFiling("2026-04-01", "2026-06-30", "2026-07-28", (b) => { b.b1.dubai.amount = 20000; b.b1.dubai.vat = 1000; });
  const q3 = mkFiling("2026-07-01", "2026-09-30", "2026-10-28", (b) => { b.b1.dubai.amount = 40000; b.b1.dubai.vat = 2000; });
  [q1, q2].forEach((f) => { f.status = "Submitted"; });
  const all = [q1, q2, q3];
  eq("T35a Q1 Box 14 = -1,500 (refundable), Box 15 = No", V.computeTotals(q1.boxes).box14, -1500);
  const n2 = V.netPayable(q2, all);
  eq("T35b Q2 payable 1,000 fully covered by the 1,500 credit", [n2.box14, n2.credit, n2.net], [1000, 1000, 0]);
  const n3 = V.netPayable(q3, all);
  eq("T35c Q3 payable 2,000 gets only the 500 left over -> net 1,500", [n3.box14, n3.credit, n3.net], [2000, 500, 1500]);
  eq("T35d first return never gets credit from itself/later returns", V.creditBroughtForward(q1, all), 0);
  q2.payment = null;
  eq("T35e fully covered return: no late-payment penalty even if long overdue", withNow(localISO(2026, 12, 1, 9), () => V.computeFilingPenalty(q2, all).latePayment), 0);
  q1.boxes.requestRefund = "Yes";
  eq("T35f Box 15 = Yes -> refund claimed, nothing carried forward (Q2 pays full 1,000)", V.netPayable(q2, all).net, 1000);
  eq("T35g a payable return has no credit to spend when none exists", V.netPayable(mkFiling("2025-10-01", "2025-12-31", "2026-01-28", (b) => { b.b1.dubai.amount = 20000; b.b1.dubai.vat = 1000; }), []).net, 1000); }

// T36 stagger wording is neutral; old saved wording is mapped for display
{ eq("T36a old 'Stagger 2 - Quarterly' shows as Quarterly (calendar quarters)", V.staggerLabel("Stagger 2 – Quarterly (Jan to Dec)"), "Quarterly (calendar quarters)");
  eq("T36b old 'Stagger 1 - Monthly' shows as Monthly (calendar months)", V.staggerLabel("Stagger 1 – Monthly (Jan to Dec)"), "Monthly (calendar months)");
  eq("T36c new wording unchanged", V.staggerLabel("Quarterly (calendar quarters)"), "Quarterly (calendar quarters)");
  const gen = V.generateInitialFilings({ firstNameEn: "A", lastNameEn: "B", firstNameAr: "", lastNameAr: "", email: "a@b.c", companyName: "X" });
  eq("T36d newly generated filings carry no 'Stagger N' wording", gen.every((f) => !/Stagger/i.test(f.period.stagger)), true); }

// T37 calendar dates are local dates in every timezone
{ eq("T37a fmtDate('2026-10-28') -> 28/10/2026 (no off-by-one west of UTC)", V.fmtDate("2026-10-28"), "28/10/2026");
  eq("T37b todayISO at 01:00 local on 29 Oct -> 2026-10-29 (not the UTC day)", withNow(localISO(2026, 10, 29, 1, 0), () => V.todayISO()), "2026-10-29");
  eq("T37c todayISO at 23:30 local on 28 Oct -> 2026-10-28", withNow(localISO(2026, 10, 28, 23, 30), () => V.todayISO()), "2026-10-28"); }

// T38 - tax invoice treatments (FTA VATP006 / Art. 59; rounding per Art. 61 to nearest fils)
{ const acc = { companyName: "T Co", trn: "100000000000003", address: "Dubai" };
  const mk = (o) => V.addInvoice(acc, Object.assign({ type: "Tax Invoice", date: "2026-10-01", customerName: "C", description: "d", quantity: "10", unitPrice: "100", discountPct: "0", reverseCharge: false }, o));
  const a = mk({ taxTreatment: "standard" }), z = mk({ taxTreatment: "zero" }), e = mk({ taxTreatment: "exempt" }), r = mk({ taxTreatment: "standard", reverseCharge: true }), d = mk({});
  eq("T38a standard 5%: 1000 -> VAT 50, total 1050", [a.vatAmount, a.total], [50, 1050]);
  eq("T38b zero-rated: VAT 0, total 1000", [z.vatAmount, z.total, z.taxTreatment], [0, 1000, "zero"]);
  eq("T38c exempt: VAT 0, total 1000", [e.vatAmount, e.total, e.taxTreatment], [0, 1000, "exempt"]);
  eq("T38d reverse charge: VAT 0", [r.vatAmount, r.total], [0, 1000]);
  eq("T38e missing treatment (old data) defaults to standard 5%", [d.vatAmount, d.taxTreatment, d.invFormat], [50, "standard", "full"]);
  const f = mk({ taxTreatment: "standard", quantity: "1", unitPrice: "47.14" });
  eq("T38f VATP006 rounding: 2.357 -> 2.36", f.vatAmount, 2.36); }

// T39 - foreign-currency invoice (FTA VATP006: tax shown in AED with the exchange rate)
{ const acc = { companyName: "T Co", trn: "100000000000003", address: "Dubai" };
  const u = V.addInvoice(acc, { type: "Tax Invoice", date: "2026-10-01", customerName: "C", description: "d", quantity: "1", unitPrice: "100", discountPct: "0", taxTreatment: "standard", currency: "USD", fxRate: "3.6725" });
  const a = V.addInvoice(acc, { type: "Tax Invoice", date: "2026-10-01", customerName: "C", description: "d", quantity: "1", unitPrice: "100", discountPct: "0" });
  eq("T39a USD 100: VAT 5 USD, total 105 USD, VAT in AED 18.36", [u.vatAmount, u.total, u.vatAed, u.currency, u.fxRate], [5, 105, 18.36, "USD", 3.6725]);
  eq("T39b AED invoice: vatAed equals vatAmount, rate 1", [a.vatAed, a.currency, a.fxRate], [5, "AED", 1]); }

// T40 - multi-line invoice: per-line rate and per-line rounding (FTA VATP006)
{ const acc = { companyName: "T Co", trn: "100000000000003", address: "Dubai" };
  const base = { type: "Tax Invoice", date: "2026-10-01", customerName: "C", description: "A", quantity: "2", unitPrice: "100", discountPct: "0", taxTreatment: "standard" };
  const L = [{ description: "A", quantity: "2", unitPrice: "100", discountPct: "0", taxTreatment: "standard" }, { description: "B", quantity: "1", unitPrice: "200", discountPct: "10", taxTreatment: "zero" }, { description: "C", quantity: "1", unitPrice: "47.14", discountPct: "0", taxTreatment: "standard" }];
  const m = V.addInvoice(acc, Object.assign({}, base, { lines: L }));
  eq("T40a three lines (5% / 0% / 5%): taxable 427.14, VAT 12.36, total 439.50", [m.taxableAmount, m.vatAmount, m.total, m.lines.length], [427.14, 12.36, 439.5, 3]);
  eq("T40b line detail: line 2 taxable 180 VAT 0, line 3 VAT 2.36", [m.lines[1].taxable, m.lines[1].vat, m.lines[2].vat], [180, 0, 2.36]);
  const rc = V.addInvoice(acc, Object.assign({}, base, { lines: L, reverseCharge: true }));
  eq("T40c reverse charge: VAT 0 on every line", [rc.vatAmount, rc.lines.every((l) => l.vat === 0)], [0, true]);
  const old = V.addInvoice(acc, base);
  eq("T40d legacy single-line data still works and stores one line", [old.lines.length, old.taxableAmount, old.vatAmount], [1, 200, 10]); }

console.log(rows.join("\n")); console.log("\n" + pass + " passed, " + fail + " failed, " + (pass + fail) + " total");
process.exit(fail ? 1 : 0);
