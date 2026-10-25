/* employee-expenses.js - Input VAT on employee expenses from 1 Oct 2026 (FTA Decision 17 of 2026 as summarised in firm notes; VATP005 for entertainment). */
(function () {
  "use strict";
  const session = VATSIM.requireSession("../login.html");
  if (!session) return;
  if (!VATSIM.getAccount()) { window.location.href = "../index.html"; return; }
  VATSIM.wireChrome();
  const D17 = "FTA Decision 17 of 2026 ";
  const S = [
    ["E1", "A city-centre head office gives all staff a free lunch every day under the staff handbook. Restaurants are nearby.", "blk", "Free food for employees is recoverable only in the remote-area case (" + D17 + "Art. 2(2)). A city office has restaurants nearby, so the VAT is blocked."],
    ["E2", "A desert drilling camp, 150 km from any town, gives staff meals during the work rotation. There are no kitchen facilities and no restaurants nearby. The contract requires the meals and there is no cash option.", "rec", "All the remote-area conditions are met (" + D17 + "Art. 2(2)): remote location, no preparation facilities, no nearby restaurants, tied to the work period, no cash in lieu. Recoverable."],
    ["E3", "A company bus takes employees between home and the workplace. The employment contract requires it and employees cannot take cash instead.", "rec", "Employee transport under a contract, not for personal benefit and with no cash option (" + D17 + "Art. 2(1)). Recoverable."],
    ["E4", "An apartment is rented next to a remote project site because the operation needs staff on site. It is not part of salary, has no cash option and only employees use it.", "rec", "Work-required accommodation that is not ordinary compensation, has no cash alternative and is used by employees only (" + D17 + "Art. 2(3)). Recoverable."],
    ["E5", "A villa is rented for a manager as part of his salary package. He may take the allowance in cash instead.", "blk", "Ordinary compensation, and a cash option blocks recovery (" + D17 + "Art. 2(3)). Blocked."],
    ["E6", "A hotel is booked for 20 days for a new hire while he finds a home. A documented policy provides for it.", "rec", "Temporary accommodation for new hires is recoverable for up to 30 days (" + D17 + "Art. 2(4)). Recoverable."],
    ["E7", "Mobile phones and data packages for sales staff. A written use policy exists, usage is monitored and records are kept. Personal use is only incidental.", "rec", "Phones and data needed for the job with a documented policy, monitoring and records (" + D17 + "Art. 2(5)). Recoverable."],
    ["E8", "Mobile phone bills for staff who mainly use their phones privately. There is no policy and no monitoring.", "blk", "No documented policy or monitoring and mainly personal use, so Art. 2(5) is not met. Blocked."],
    ["E9", "Parking spaces allocated to employees for business visits. A documented reimbursement policy and approval process exist and receipts are kept.", "rec", "Parking incurred solely for business with a documented policy and receipts (" + D17 + "Art. 2(6)). Recoverable."],
    ["E10", "An annual staff party with a dinner and entertainment.", "blk", "Entertainment is blocked in full (FTA VATP005, Art. 53(1)(a)); it is not one of the six Decision 17 cases."],
  ].map((r) => ({ id: r[0], facts: r[1], ans: r[2], why: r[3] }));
  const OPT = [["rec", "Recoverable"], ["blk", "Not recoverable"]], ch = {};
  function paint(checked) {
    let right = 0;
    const rows = S.map((r) => { const ok = ch[r.id] === r.ans; if (ok) right++;
      return "<tr><td>" + r.id + "</td><td>" + r.facts + '</td><td><select data-id="' + r.id + '"><option value="">- select -</option>' + OPT.map((o) => '<option value="' + o[0] + '"' + (ch[r.id] === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select></td><td>" +
        (checked ? (ok ? '<b style="color:var(--success)">✓</b> ' : '<b style="color:var(--danger)">✕</b> ') + "<small>" + r.why + "</small>" : "") + "</td></tr>"; });
    document.getElementById("empBody").innerHTML = "<thead><tr><th>Case</th><th>Facts</th><th>Input VAT</th><th>" + (checked ? "Result and source" : "") + "</th></tr></thead><tbody>" + rows.join("") + "</tbody>";
    document.getElementById("scoreOut").textContent = checked ? "Score: " + right + " / " + S.length : "";
    document.querySelectorAll("select[data-id]").forEach((s) => s.addEventListener("change", () => { ch[s.dataset.id] = s.value; paint(false); }));
  }
  document.getElementById("btnCheck").addEventListener("click", () => {
    const miss = S.filter((r) => !ch[r.id]).length;
    if (miss) { VATSIM.toast("Answer every case (" + miss + " left).", "error"); return; }
    paint(true);
  });
  document.getElementById("btnReset").addEventListener("click", () => { Object.keys(ch).forEach((k) => delete ch[k]); paint(false); });
  paint(false);
})();
