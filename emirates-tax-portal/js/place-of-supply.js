/* place-of-supply.js - Place of Supply and Intra-GCC practice set (Phase 4).
   Rules read from: Federal Decree-Law 8/2017 (UAE Legislation Portal text, updated 1 Oct 2025) Arts 27, 29-32, 45, 48, FTA Public Clarification VATP019 and FTA Designated Zones VAT Guide VATGDZ1 (July 2018). See tests/QA_REPORT.md Round 8. */
(function () {
  "use strict";
  const session = VATSIM.requireSession("../login.html");
  if (!session) return;
  if (!VATSIM.getAccount()) { window.location.href = "../index.html"; return; }
  VATSIM.wireChrome();
  const POS = [["uae", "Inside the UAE"], ["out", "Outside the UAE"]];
  const TR = [["std", "Standard rated 5% (Box 1)"], ["zero", "Zero rated (Box 4)"], ["rc", "Reverse charge (Box 3 + Box 10)"], ["oos", "Outside the scope of UAE VAT"]];
  const GCC = " FTA VATP019: the UAE currently recognises no other state as an Implementing State, so Saudi Arabia is treated like any non-GCC state.";
  const S = [
    ["G1", "Goods", "A Dubai trader sells goods to a customer in Sharjah. The goods are delivered inside the UAE.", "uae", "std", "Art. 27(1): a supply made in the UAE with no export or import has its place of supply in the UAE. Standard rated 5%."],
    ["G2", "Goods", "A UAE trader sells goods to a buyer in India and ships them out of the UAE. Export evidence is kept.", "uae", "zero", "Art. 27(3)(a)(i): an export to a place outside the Applying States has its place of supply in the UAE, and Art. 45(1) zero-rates it. An export is zero rated, not outside scope."],
    ["G3", "Goods / intra-GCC", "A UAE trader sells goods to a VAT-registered customer in Saudi Arabia and ships them to Riyadh.", "uae", "zero", "Art. 27(3) and Art. 45(1) treat only exports to Applying States specially." + GCC + " Treated as an export: zero rated. Check the FTA for any change in status."],
    ["G4", "Goods", "A UAE trader buys goods in China and sells them straight to a customer in Kenya. The goods ship from China to Kenya and never enter the UAE.", "out", "oos", "Art. 27(1): a supply is in the UAE only if it is made in the UAE. The goods never enter the UAE, so the sale is outside scope and is not reported in the VAT 201. (Read from Art. 27(1); no FTA text on this exact case was opened.)"],
    ["S1", "Services", "A Dubai consultancy advises a Dubai company.", "uae", "std", "Art. 29: place of supply of services is the supplier's place of residence (the UAE). Standard rated 5%."],
    ["S2", "Services / export", "A UAE consultancy advises a UK company that has no UAE branch. All work is remote and no UK staff visit the UAE.", "uae", "zero", "Art. 29 puts the supply in the UAE, but Art. 45(1) and Exec. Reg. Art. 31(1)(a) zero-rate it: the recipient has no place of residence in the UAE and is outside the UAE when the services are performed (VATP019). It must also not be a special-case service performed in the UAE (Exec. Reg. Art. 31(1)(a)(3), from 15 Nov 2024). Box 4."],
    ["S3", "Services / export", "A UAE law firm advises a non-resident client on an arbitration. The client's representative attends the hearing in the UAE for two weeks.", "uae", "std", "VATP019 uses this example: the recipient is physically present, through its representative, when the services are performed and the presence is connected with the supply, so it cannot be zero rated. Standard rated 5%."],
    ["S4", "Services / intra-GCC", "A UAE IT firm supports a Saudi company (registered for VAT in Saudi Arabia). The company has no UAE presence and its staff stay in Riyadh.", "uae", "zero", "Condition 1 of VATP019 is met when the recipient has no place of residence in the UAE." + GCC + " Recipient is outside the UAE, so the supply is an export of services: zero rated (Box 4), provided Art. 31(1)(a)(3) is also met (see case S8)."],
    ["S5", "Services", "A Dubai hotel provides rooms and catering to an overseas tourist.", "uae", "std", "Art. 30(5): for hotel, restaurant and catering services the place of supply is where the services are actually performed. Standard rated 5%."],
    ["S6", "Services / import", "A UK consultancy advises a VAT-registered UAE company. The UK firm has no UAE presence and charges no VAT.", "uae", "rc", "Art. 30(2): the recipient is in business in the UAE and the supplier has no UAE residence, so the place of supply is the UAE. Art. 48(1): the recipient accounts for the tax. Box 3 for the output VAT, Box 10 to recover it if entitled."],
    ["S7", "Services / import (intra-GCC)", "A Saudi software firm provides services to a VAT-registered UAE company. The supplier has no UAE presence.", "uae", "rc", "Same rule as S6 (Art. 30(2) and Art. 48(1))." + GCC + " Reverse charge: Box 3 and Box 10."],
    ["S8", "Services / export", "A UAE workshop repairs equipment that is located in the UAE for a UK company. The UK company has no UAE presence and pays from abroad.", "uae", "std", "Art. 30(3) of the Decree-Law: services related to goods are supplied where they are performed, here the UAE. Since 15 Nov 2024 Exec. Reg. Art. 31(1)(a)(3) denies zero-rating when the place of supply is fixed by Art. 30(3)-(8) or Art. 31 of the Decree-Law, so an overseas customer does not make this an export. Standard rated 5%. (Art. 31(1)(a)(3) is quoted by several firm notes; the Executive Regulation text itself was not opened.)"],
    ["Z1", "Designated Zone / goods", "A mainland trader sells goods to a company in a Designated Zone and delivers them into the zone.", "uae", "std", "VATGDZ1 s.3.4.2 (Exec. Reg. Art. 30(3)): a supply from the mainland to a Designated Zone is not an export. It is a local supply: standard rated 5%."],
    ["Z2", "Designated Zone / services", "A consultancy established in a Designated Zone advises a customer in mainland Dubai.", "uae", "std", "VATGDZ1 s.2.3 and s.3.2 (Exec. Reg. Art. 51(6)): a business in a Designated Zone is treated as resident in the UAE, and the place of supply of services in a Designated Zone is the UAE. Standard rated 5%."],
    ["Z3", "Designated Zone / export of services", "A Designated Zone IT company supports a UK company that has no UAE presence. All work is remote.", "uae", "zero", "VATGDZ1 s.3.2: services in a Designated Zone follow the general rules, and services exported to a recipient outside the GCC Implementing States may be zero rated. The VATP019 conditions and Art. 31(1)(a)(3) apply. Box 4."],
    ["Z4", "Designated Zone / goods from abroad", "A Chinese supplier sells goods to a trading company in a Designated Zone and ships them straight into the zone.", "out", "oos", "VATGDZ1 s.3.4.1: a movement or supply of goods into a Designated Zone from outside the UAE takes place outside the UAE, so no UAE VAT is charged. Import VAT arises only if the goods later move into the mainland or are consumed (s.3.5 and s.3.6)."],
    ["Z5", "Designated Zone / transfer", "A trader moves goods from Designated Zone A to Designated Zone B under customs suspension. The goods are not released, used or altered.", "out", "oos", "VATGDZ1 s.3.4.3 (Exec. Reg. Art. 51(4)): a transfer between Designated Zones is outside the scope of VAT if the goods are not released, used or altered and customs suspension rules are followed. The FTA may require a financial guarantee."],
    ["Z6", "Free zone (not designated)", "A company in an ordinary free zone that is not on the Cabinet's Designated Zone list sells goods to a customer in mainland Dubai.", "uae", "std", "VATGDZ1 s.2.1: a free zone that is not a Designated Zone is treated like any other part of the UAE for VAT. Normal rules apply: standard rated 5%."],
  ].map((r) => ({ id: r[0], kind: r[1], facts: r[2], pos: r[3], tr: r[4], why: r[5] }));
  const ch = {};
  const sel = (id, k, opts) => '<select data-id="' + id + '" data-k="' + k + '"><option value="">- select -</option>' + opts.map((o) => '<option value="' + o[0] + '"' + (ch[id] && ch[id][k] === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>";
  function paint(checked) {
    let right = 0;
    const rows = S.map((r) => {
      const c = ch[r.id] || {}, ok = c.pos === r.pos && c.tr === r.tr; if (ok) right++;
      return "<tr><td>" + r.id + "<br><small>" + r.kind + "</small></td><td>" + r.facts + "</td><td>" + sel(r.id, "pos", POS) + "</td><td>" + sel(r.id, "tr", TR) + "</td><td>" +
        (checked ? (ok ? '<b style="color:var(--success)">✓</b> ' : '<b style="color:var(--danger)">✕</b> ') + "<small>" + r.why + "</small>" : "") + "</td></tr>";
    });
    document.getElementById("posBody").innerHTML = "<thead><tr><th>Case</th><th>Facts</th><th>Place of supply</th><th>VAT treatment</th><th>" + (checked ? "Result and source" : "") + "</th></tr></thead><tbody>" + rows.join("") + "</tbody>";
    document.getElementById("scoreOut").textContent = checked ? "Score: " + right + " / " + S.length : "";
    document.querySelectorAll("select[data-id]").forEach((s) => s.addEventListener("change", () => { (ch[s.dataset.id] = ch[s.dataset.id] || {})[s.dataset.k] = s.value; paint(false); }));
  }
  document.getElementById("btnCheck").addEventListener("click", () => {
    const miss = S.filter((r) => !(ch[r.id] && ch[r.id].pos && ch[r.id].tr)).length;
    if (miss) { VATSIM.toast("Answer both questions for every case (" + miss + " left).", "error"); return; }
    paint(true);
  });
  document.getElementById("btnReset").addEventListener("click", () => { Object.keys(ch).forEach((k) => delete ch[k]); paint(false); });
  paint(false);
})();
