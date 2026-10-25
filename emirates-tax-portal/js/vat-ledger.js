/* vat-ledger.js - Module 04: VAT ledger posting, control account reconciliation, input VAT reconciliation and period closing. */
(function () {
  "use strict";
  const session = VATSIM.requireSession("../login.html");
  if (!session) return;
  const account = VATSIM.getAccount();
  if (!account) { window.location.href = "../index.html"; return; }
  VATSIM.wireChrome();
  const r2 = VATSIM.round2, f = VATSIM.fmtAED, SALES = VATPS.SALES, PURCH = VATPS.PURCH;
  const SO = [["cr", "Cr VAT Output (tax charged)"], ["dr", "Dr VAT Output (credit note)"], ["none", "No VAT entry (nil VAT)"]];
  const PO = [["in", "Dr VAT Input (recoverable)"], ["cost", "Dr Expense / cost - VAT blocked"], ["rc", "Dr VAT Input + Cr VAT Output (reverse charge)"]];
  const std = (n) => r2(Math.abs(n) * 0.05);
  const keyOf = (r, p) => (p ? (r.ans === "rec" ? "in" : r.ans === "blk" ? "cost" : "rc") : r.ans === "std" ? (r.net < 0 ? "dr" : "cr") : "none");
  const ROWS = SALES.map((r) => ({ r: r, p: false })).concat(PURCH.map((r) => ({ r: r, p: true })));
  const ch = {}; let checked = false;
  const eff = (x, c) => {
    if (!x.p) { const v = std(x.r.net); return c === "cr" ? { oc: v } : c === "dr" ? { od: v } : {}; }
    if (c === "in") return { id: x.r.vat };
    if (c === "rc") { const v = std(x.r.net); return { id: v, oc: v }; }
    return {};
  };
  function tot(pick) { const t = { oc: 0, od: 0, id: 0 }; ROWS.forEach((x) => { const e = eff(x, pick(x)); t.oc += e.oc || 0; t.od += e.od || 0; t.id += e.id || 0; }); t.out = r2(t.oc - t.od); t.inp = r2(t.id); t.net = r2(t.out - t.inp); return t; }
  const mine = () => tot((x) => ch[x.r.id]), key = () => tot((x) => keyOf(x.r, x.p));
  const ledger = (title, side) => {
    const lines = []; ROWS.forEach((x) => { const e = eff(x, ch[x.r.id] || ""); if (side === "out") { if (e.oc) lines.push([x.r.doc, "", e.oc]); if (e.od) lines.push([x.r.doc, e.od, ""]); } else if (e.id) lines.push([x.r.doc, e.id, ""]); });
    const m = mine(), dr = side === "out" ? m.od : m.id, cr = side === "out" ? m.oc : 0;
    return '<table class="data-table"><thead><tr><th>' + title + "</th><th>Dr</th><th>Cr</th></tr></thead><tbody>" + lines.map((l) => "<tr><td>" + l[0] + "</td><td>" + (l[1] === "" ? "" : f(l[1])) + "</td><td>" + (l[2] === "" ? "" : f(l[2])) + "</td></tr>").join("") +
      "<tr><td><b>Total</b></td><td>" + f(dr) + "</td><td>" + f(cr) + "</td></tr><tr><td><b>Balance c/d</b></td><td>" + (side === "in" ? f(m.inp) : "") + "</td><td>" + (side === "out" ? f(m.out) : "") + "</td></tr></tbody></table>";
  };
  function recon() {
    const m = mine(), K = key(), pv = (c) => PURCH.filter((p) => ch[p.id] === c);
    const all = r2(PURCH.reduce((s, p) => s + p.vat, 0)), blk = r2(pv("cost").reduce((s, p) => s + p.vat, 0)), rcIn = r2(pv("rc").reduce((s, p) => s + std(p.net), 0)), rec = r2(all - blk), tin = r2(rec + rcIn);
    const row = (a, b, c, d) => "<tr><td>" + a + "</td><td>" + b + "</td><td>" + c + "</td><td>" + d + "</td></tr>";
    const tick = (x, y) => (x === y ? "✓" : "✕ " + f(r2(x - y)));
    let h = '<table class="data-table"><thead><tr><th>Control account reconciliation</th><th>VAT ledger</th><th>VAT 201 (expected)</th><th>Difference</th></tr></thead><tbody>' +
      row("Output VAT (Box 8)", f(m.out), f(K.out), f(r2(m.out - K.out))) + row("Recoverable input VAT (Box 13)", f(m.inp), f(K.inp), f(r2(m.inp - K.inp))) + row("<b>Net VAT payable / (refundable)</b>", f(m.net), f(K.net), f(r2(m.net - K.net))) + "</tbody></table><p><b>Net difference: " + f(r2(m.net - K.net)) + "</b></p>";
    const items = ROWS.filter((x) => ch[x.r.id] !== keyOf(x.r, x.p)).map((x) => { const a = eff(x, ch[x.r.id]), k = eff(x, keyOf(x.r, x.p)); return [x.r.doc, r2(((a.oc || 0) - (a.od || 0) - (a.id || 0)) - ((k.oc || 0) - (k.od || 0) - (k.id || 0)))]; });
    h += items.length ? "<p>Reconciling items (postings that differ from the correct treatment):</p><ul>" + items.map((i) => "<li>" + i[0] + ": effect on net VAT payable " + f(i[1]) + "</li>").join("") + "</ul>" : "<p>No reconciling items: the ledger agrees to the VAT 201.</p>";
    h += '<table class="data-table"><thead><tr><th>Input VAT reconciliation</th><th>AED</th></tr></thead><tbody>' + row("VAT charged on purchase documents", f(all), "", "").replace(/<td><\/td><td><\/td>/, "") + row("Less: blocked, taken to cost", "(" + f(blk) + ")", "", "").replace(/<td><\/td><td><\/td>/, "") + row("Recoverable VAT on purchases (Box 9)", f(rec), "", "").replace(/<td><\/td><td><\/td>/, "") + row("Add: reverse charge input VAT (Box 10)", f(rcIn), "", "").replace(/<td><\/td><td><\/td>/, "") + row("<b>Total recoverable input VAT</b>", f(tin), "", "").replace(/<td><\/td><td><\/td>/, "") + row("Per VAT 201 (expected)", f(K.inp), "", "").replace(/<td><\/td><td><\/td>/, "") + row("Result", tick(tin, K.inp), "", "").replace(/<td><\/td><td><\/td>/, "") + "</tbody></table>";
    return h;
  }
  function paint() {
    const head = "<thead><tr><th>Doc</th><th>Description</th><th>Net</th><th>VAT on document</th><th>Your posting</th><th>Posted to VAT accounts</th><th>" + (checked ? "Result and source" : "") + "</th></tr></thead>";
    document.getElementById("postBody").innerHTML = head + "<tbody>" + ROWS.map((x) => {
      const c = ch[x.r.id], ok = c === keyOf(x.r, x.p), e = eff(x, c || "");
      const posted = [e.oc ? "Cr Output " + f(e.oc) : "", e.od ? "Dr Output " + f(e.od) : "", e.id ? "Dr Input " + f(e.id) : ""].filter(Boolean).join("; ") || "-";
      const docVat = x.p ? x.r.vat : x.r.ans === "std" ? (x.r.net < 0 ? -std(x.r.net) : std(x.r.net)) : 0;
      const sel = '<select data-id="' + x.r.id + '"><option value="">- select -</option>' + (x.p ? PO : SO).map((o) => '<option value="' + o[0] + '"' + (c === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>";
      return "<tr><td>" + x.r.doc + "</td><td>" + x.r.desc + "</td><td>" + f(x.r.net) + "</td><td>" + f(docVat) + "</td><td>" + sel + "</td><td>" + posted + "</td><td>" + (checked ? (ok ? "✓ " : "✕ ") + "<small>" + x.r.why + "</small>" : "") + "</td></tr>";
    }).join("") + "</tbody>";
    document.getElementById("ledOut").innerHTML = ledger("VAT Output account", "out");
    document.getElementById("ledIn").innerHTML = ledger("VAT Input account", "in");
    document.querySelectorAll("select[data-id]").forEach((s) => s.addEventListener("change", () => { ch[s.dataset.id] = s.value; checked = false; document.getElementById("reconOut").innerHTML = "<small>Shown after you check your work.</small>"; document.getElementById("closeRes").innerHTML = ""; document.getElementById("scoreOut").textContent = ""; paint(); }));
  }
  const num = (id) => r2(Number(document.getElementById(id).value) || 0);
  document.getElementById("btnCheck").addEventListener("click", () => {
    const miss = ROWS.filter((x) => !ch[x.r.id]).length;
    if (miss) { VATSIM.toast("Post every document first (" + miss + " left).", "error"); return; }
    const K = key(), right = ROWS.filter((x) => ch[x.r.id] === keyOf(x.r, x.p)).length, dirK = K.net >= 0 ? "pay" : "ref";
    const cl = (num("closeOut") === K.out ? 1 : 0) + (num("closeIn") === K.inp ? 1 : 0) + (num("closeNet") === Math.abs(K.net) ? 1 : 0) + (document.getElementById("closeDir").value === dirK ? 1 : 0);
    checked = true; paint();
    document.getElementById("scoreOut").textContent = "Posting: " + right + " / " + ROWS.length + " · Closing: " + cl + " / 4";
    document.getElementById("closeRes").innerHTML = "Closing journal: Dr VAT Output " + f(K.out) + "; Cr VAT Input " + f(K.inp) + "; " + (K.net >= 0 ? "Cr VAT Payable " + f(K.net) : "Dr VAT Refundable " + f(-K.net)) + ". The return is due by 28 October 2026 (28 days after the period end); on payment: Dr VAT Payable " + f(Math.abs(K.net)) + "; Cr Bank " + f(Math.abs(K.net)) + ".";
    document.getElementById("reconOut").innerHTML = recon();
  });
  document.getElementById("btnReset").addEventListener("click", () => { Object.keys(ch).forEach((k) => delete ch[k]); checked = false; document.getElementById("reconOut").innerHTML = "<small>Shown after you check your work.</small>"; document.getElementById("closeRes").innerHTML = ""; document.getElementById("scoreOut").textContent = ""; paint(); });
  document.getElementById("btnXlsx").addEventListener("click", () => {
    if (!window.XLSX) { VATSIM.toast("Excel library did not load.", "error"); return; }
    if (ROWS.some((x) => !ch[x.r.id])) { VATSIM.toast("Post every document first.", "error"); return; }
    const m = mine(), K = key(), wb = XLSX.utils.book_new(), add = (n, a) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(a), n);
    const pl = (c) => ROWS.filter((x) => ch[x.r.id] === c);
    add("VAT Ledger", [["Doc", "Account", "Dr", "Cr"]].concat(ROWS.flatMap((x) => { const e = eff(x, ch[x.r.id]), o = []; if (e.oc) o.push([x.r.doc, "VAT Output", 0, e.oc]); if (e.od) o.push([x.r.doc, "VAT Output", e.od, 0]); if (e.id) o.push([x.r.doc, "VAT Input", e.id, 0]); return o; })).concat([["", "Balance VAT Output (Cr)", "", m.out], ["", "Balance VAT Input (Dr)", m.inp, ""]]));
    add("Control Reconciliation", [["Item", "VAT ledger", "VAT 201 expected", "Difference"], ["Output VAT", m.out, K.out, r2(m.out - K.out)], ["Input VAT", m.inp, K.inp, r2(m.inp - K.inp)], ["Net VAT payable/(refundable)", m.net, K.net, r2(m.net - K.net)]]);
    add("Period Closing", [["Entry", "Dr", "Cr"], ["VAT Output", m.out, ""], ["VAT Input", "", m.inp], [m.net >= 0 ? "VAT Payable" : "VAT Refundable", m.net < 0 ? -m.net : "", m.net >= 0 ? m.net : ""], ["Payment (due 28 Oct 2026): VAT Payable / Bank", Math.max(m.net, 0), Math.max(m.net, 0)]]);
    add("Net VAT Statement", [["Net VAT payable / (refundable) for Jul-Sep 2026", m.net], ["Total output VAT", m.out], ["Total recoverable input VAT", m.inp], ["Blocked input VAT (not claimed)", r2(pl("cost").reduce((s, x) => s + x.r.vat, 0))]]);
    add("Supporting Schedules", [["Schedule", "Doc", "Party", "Net", "VAT"]].concat(pl("cost").map((x) => ["Blocked input VAT", x.r.doc, x.r.party, x.r.net, x.r.vat])).concat(pl("rc").map((x) => ["Reverse charge", x.r.doc, x.r.party, x.r.net, std(x.r.net)])).concat(ROWS.filter((x) => !x.p && x.r.net < 0).map((x) => ["Credit notes", x.r.doc, x.r.party, x.r.net, -std(x.r.net)])));
    XLSX.writeFile(wb, "VAT_Ledger_Pack_" + account.trn + ".xlsx");
  });
  paint();
})();
