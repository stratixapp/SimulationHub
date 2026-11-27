/* registers.js - Sales & Purchase VAT Register practice set (Phase 2). Created for SKELORA VAT training.
   Rules verified against FTA VATP005 (entertainment, Art. 53) and VATP006 (tax invoices). See tests/QA_REPORT.md. */
(function () {
  "use strict";
  const session = VATSIM.requireSession("../login.html");
  if (!session) return;
  const account = VATSIM.getAccount();
  if (!account) { window.location.href = "../index.html"; return; }
  VATSIM.wireChrome();
  const r2 = VATSIM.round2, f = VATSIM.fmtAED;
  const SO = [["std", "Standard rated 5% (Box 1)"], ["zero", "Zero rated (Box 4)"], ["exempt", "Exempt (Box 5)"], ["oos", "Outside scope"]];
  const PO = [["rec", "Recoverable input VAT (Box 9)"], ["blk", "Blocked - not recoverable"], ["rc", "Reverse charge (Box 3 + Box 10)"]];
  const SALES = VATPS.SALES, PURCH = VATPS.PURCH;
  const ch = {}; // student choices by row id
  const sel = (id, opts) => '<select data-id="' + id + '"><option value="">- select -</option>' + opts.map((o) => '<option value="' + o[0] + '"' + (ch[id] === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>";
  const std = (n) => r2(n * 0.05);

  function calc() {
    const t = { b1n: 0, b1v: 0, b3n: 0, b3v: 0, b4: 0, b5: 0, b9n: 0, b9v: 0, b10n: 0, b10: 0, blocked: 0 };
    SALES.forEach((s) => { const c = ch[s.id]; if (c === "std") { t.b1n += s.net; t.b1v += std(s.net); } else if (c === "zero") t.b4 += s.net; else if (c === "exempt") t.b5 += s.net; });
    PURCH.forEach((p) => { const c = ch[p.id]; if (c === "rec") { t.b9n += p.net; t.b9v += p.vat; } else if (c === "blk") t.blocked += p.vat; else if (c === "rc") { t.b3n += p.net; t.b3v += std(p.net); t.b10n += p.net; t.b10 += std(p.net); } });
    Object.keys(t).forEach((k) => (t[k] = r2(t[k])));
    t.out = r2(t.b1v + t.b3v); t.inp = r2(t.b9v + t.b10); t.net = r2(t.out - t.inp);
    return t;
  }
  function expected() { const save = Object.assign({}, ch); [...SALES, ...PURCH].forEach((r) => (ch[r.id] = r.ans)); const t = calc(); Object.keys(ch).forEach((k) => delete ch[k]); Object.assign(ch, save); return t; }

  function paint(checked) {
    const row = (r, opts, isP) => {
      const c = ch[r.id], ok = c === r.ans;
      const vat = isP ? r.vat : c === "std" ? std(r.net) : 0;
      return "<tr><td>" + VATSIM.fmtDate(r.date) + "</td><td>" + r.doc + "</td><td>" + r.party + "<br><small>TRN " + r.trn + "</small></td><td>" + r.desc + "</td><td>" + f(r.net) + "</td><td>" + f(vat) + "</td><td>" + sel(r.id, opts) + "</td><td>" +
        (checked ? (ok ? '<b style="color:var(--success)">✓</b>' : '<b style="color:var(--danger)">✕</b>') + "<br><small>" + r.why + "</small>" : "") + "</td></tr>";
    };
    const head = "<thead><tr><th>Date</th><th>Doc</th><th>Party</th><th>Description</th><th>Net (AED)</th><th>VAT on document</th><th>Your treatment</th><th>" + (checked ? "Result and source" : "") + "</th></tr></thead>";
    document.getElementById("salesBody").innerHTML = head + "<tbody>" + SALES.map((r) => row(r, SO, false)).join("") + "</tbody>";
    document.getElementById("purchBody").innerHTML = head + "<tbody>" + PURCH.map((r) => row(r, PO, true)).join("") + "</tbody>";
    document.querySelectorAll("select[data-id]").forEach((s) => s.addEventListener("change", () => { ch[s.dataset.id] = s.value; paint(false); }));
    const t = calc(), e = checked ? expected() : null;
    const L = [["Box 1 - Standard rated supplies (net of credit notes)", "b1n", "b1v"], ["Box 3 - Reverse charge supplies", "b3n", "b3v"], ["Box 4 - Zero rated supplies", "b4"], ["Box 5 - Exempt supplies", "b5"], ["Box 9 - Recoverable expenses", "b9n", "b9v"], ["Box 10 - Recoverable reverse charge", "b10n", "b10"], ["Blocked input VAT (not claimed)", null, "blocked"], ["Total output VAT (Boxes 1 + 3)", null, "out"], ["Total recoverable input VAT (Boxes 9 + 10)", null, "inp"], ["Net VAT payable / (refundable)", null, "net"]];
    document.getElementById("calcBody").innerHTML = "<thead><tr><th>VAT calculation sheet</th><th>Amount</th><th>VAT</th>" + (checked ? "<th>Expected</th>" : "") + "</tr></thead><tbody>" +
      L.map((l) => "<tr><td>" + l[0] + "</td><td>" + (l[1] ? f(t[l[1]]) : "") + "</td><td>" + (l[2] ? f(t[l[2]]) : "") + "</td>" + (checked ? "<td>" + (l[2] ? f(e[l[2]]) : f(e[l[1]])) + (JSON.stringify(l[2] ? e[l[2]] : e[l[1]]) === JSON.stringify(l[2] ? t[l[2]] : t[l[1]]) ? " ✓" : " ✕") + "</td>" : "") + "</tr>").join("") + "</tbody>";
  }
  document.getElementById("btnCheck").addEventListener("click", () => {
    const miss = [...SALES, ...PURCH].filter((r) => !ch[r.id]).length;
    if (miss) { VATSIM.toast("Classify all lines first (" + miss + " left).", "error"); return; }
    paint(true);
    const right = [...SALES, ...PURCH].filter((r) => ch[r.id] === r.ans).length;
    VATSIM.toast("Score: " + right + " / " + (SALES.length + PURCH.length), right === SALES.length + PURCH.length ? "success" : "error");
  });
  document.getElementById("btnReset").addEventListener("click", () => { Object.keys(ch).forEach((k) => delete ch[k]); paint(false); });
  document.getElementById("btnXlsx").addEventListener("click", () => {
    if (!window.XLSX) { VATSIM.toast("Excel library did not load.", "error"); return; }
    const lab = (o, v) => (o.find((x) => x[0] === v) || [0, "(not classified)"])[1];
    const wb = XLSX.utils.book_new(), t = calc();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Date", "Doc", "Customer", "TRN", "Description", "Net", "VAT", "Treatment"]].concat(SALES.map((s) => [s.date, s.doc, s.party, s.trn, s.desc, s.net, ch[s.id] === "std" ? std(s.net) : 0, lab(SO, ch[s.id])]))), "Sales Register");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Date", "Doc", "Supplier", "TRN", "Description", "Net", "VAT", "Treatment"]].concat(PURCH.map((p) => [p.date, p.doc, p.party, p.trn, p.desc, p.net, p.vat, lab(PO, ch[p.id])]))), "Purchase Register");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Item", "Amount", "VAT"], ["Box 1 net of credit notes", t.b1n, t.b1v], ["Box 3 reverse charge", t.b3n, t.b3v], ["Box 4 zero rated", t.b4, 0], ["Box 5 exempt", t.b5, 0], ["Box 9 recoverable", t.b9n, t.b9v], ["Box 10 recoverable reverse charge", t.b10n, t.b10], ["Blocked input VAT", 0, t.blocked], ["Total output VAT", 0, t.out], ["Total input VAT", 0, t.inp], ["Net VAT payable/(refundable)", 0, t.net]]), "VAT Calculation");
    XLSX.writeFile(wb, "VAT_Registers_" + account.trn + ".xlsx");
  });

  const HOME = (function () { const n = String(account.emirate || "").toLowerCase().replace(/[^a-z]/g, ""); return { abudhabi: "abudhabi", dubai: "dubai", sharjah: "sharjah", ajman: "ajman", ummalquwain: "uaq", uaq: "uaq", rasalkhaimah: "rak", rak: "rak", fujairah: "fujairah" }[n] || "dubai"; })();
  const ids = (list, c) => list.filter((r) => ch[r.id] === c).map((r) => r.doc).join(", ") || "-";
  const REF = "FTA VAT Returns User Guide (Aug 2021), ";
  function wpRows() {
    const t = calc();
    return [["Box", "Description", "Amount (AED)", "VAT / recoverable VAT (AED)", "Supporting documents", "FTA reference"],
      ["1", "Standard rated supplies - " + HOME + " (net of credit notes)", t.b1n, t.b1v, ids(SALES, "std"), REF + "Box 1"],
      ["3", "Supplies subject to reverse charge", t.b3n, t.b3v, ids(PURCH, "rc"), REF + "Box 3"],
      ["4", "Zero rated supplies", t.b4, 0, ids(SALES, "zero"), REF + "Box 4"],
      ["5", "Exempt supplies", t.b5, 0, ids(SALES, "exempt"), REF + "Box 5"],
      ["8", "Total output tax (Boxes 1 to 3; Boxes 2, 6, 7 nil in this set)", "", t.out, "", REF + "Box 8 / Box 12"],
      ["9", "Standard rated expenses (recoverable VAT only)", t.b9n, t.b9v, ids(PURCH, "rec"), REF + "Box 9"],
      ["10", "Reverse charge - recoverable (full net value + recoverable VAT)", t.b10n, t.b10, ids(PURCH, "rc"), REF + "Box 10"],
      ["13", "Total recoverable input tax (Boxes 9 + 10)", "", t.inp, "", REF + "Box 13"],
      ["14", "Net VAT payable / (refundable)", "", t.net, "", REF + "Box 14"],
      ["memo", "Blocked input VAT - not claimed", "", t.blocked, ids(PURCH, "blk"), "VATP005 / Art. 53"]];
  }
  document.getElementById("btnWp").addEventListener("click", () => {
    if (!window.XLSX) { VATSIM.toast("Excel library did not load.", "error"); return; }
    const miss = [...SALES, ...PURCH].filter((r) => !ch[r.id]).length;
    if (miss) { VATSIM.toast("Classify all lines first (" + miss + " left).", "error"); return; }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["VAT 201 working paper - " + account.companyName + " - TRN " + account.trn + " - Jul-Sep 2026 (practice set)"], []].concat(wpRows())), "VAT201 Working Paper");
    XLSX.writeFile(wb, "VAT201_Working_Paper_" + account.trn + ".xlsx");
  });
  document.getElementById("btnCmp").addEventListener("click", () => {
    const fl = VATSIM.getFilings().filter((x) => x.status !== "Submitted").sort((a, b) => String(b.period.from).localeCompare(String(a.period.from)))[0];
    if (!fl) { VATSIM.toast("No draft VAT 201 found - start one from My Filings.", "error"); return; }
    const miss = [...SALES, ...PURCH].filter((r) => !ch[r.id]).length;
    if (miss) { VATSIM.toast("Classify all lines first (" + miss + " left).", "error"); return; }
    const t = calc(), B = fl.boxes, n = (v) => r2(Number(v) || 0), e = B.b1[HOME] || {};
    const R = [["Box 1 (" + HOME + ")", n(e.amount), t.b1n, n(e.vat), t.b1v], ["Box 3", n(B.b3.amount), t.b3n, n(B.b3.vat), t.b3v], ["Box 4", n(B.b4.amount), t.b4, 0, 0], ["Box 5", n(B.b5.amount), t.b5, 0, 0], ["Box 9", n(B.b9.amount), t.b9n, n(B.b9.vat), t.b9v], ["Box 10", n(B.b10.amount), t.b10n, n(B.b10.vat), t.b10]];
    document.getElementById("cmpOut").innerHTML = '<table class="data-table"><thead><tr><th>Draft return ' + VATSIM.fmtDate(fl.period.from) + " - " + VATSIM.fmtDate(fl.period.to) + "</th><th>Your return: amount</th><th>Register: amount</th><th>Your return: VAT</th><th>Register: VAT</th><th></th></tr></thead><tbody>" +
      R.map((r) => "<tr><td>" + r[0] + "</td><td>" + f(r[1]) + "</td><td>" + f(r[2]) + "</td><td>" + f(r[3]) + "</td><td>" + f(r[4]) + "</td><td>" + (r[1] === r[2] && r[3] === r[4] ? "✓" : "✕ check") + "</td></tr>").join("") + "</tbody></table>";
  });
  paint(false);
})();
