/* ==========================================================================
   trial-balance.js — Trial Balance → VAT Return classification exercise
   Created By Ananthu Shaji
   ========================================================================== */

(function () {
  "use strict";

  const session = VATSIM.requireSession("../login.html");
  if (!session) return;
  const account = VATSIM.getAccount();
  if (!account) {
    window.location.href = "../index.html";
    return;
  }
  VATSIM.wireChrome();

  const BOX_OPTIONS = [
    { value: "", label: "— Select a box —" },
    { value: "b1", label: "Box 1 — Standard Rated Supply (5%)" },
    { value: "b3", label: "Box 3 — Reverse Charge Supply Received" },
    { value: "b4", label: "Box 4 — Zero Rated Supply" },
    { value: "b5", label: "Box 5 — Exempt Supply" },
    { value: "b7", label: "Box 7 — Adjustment to Imported Goods" },
    { value: "b9", label: "Box 9 — Standard Rated Expense" },
    { value: "b10", label: "Box 10 — Recoverable Reverse Charge Input" },
    { value: "oos", label: "Outside the Scope of VAT" },
  ];

  const TRANSACTION_BANK = [
    { desc: "Cash sale of goods to a UAE retail customer in Dubai", box: "b1" },
    { desc: "Invoice raised to a local UAE company for consulting services rendered", box: "b1" },
    { desc: "Sale of office furniture no longer needed by the business", box: "b1" },
    { desc: "Export sale of goods shipped to a customer in Saudi Arabia", box: "b4" },
    { desc: "International freight — transporting goods from Dubai to Muscat", box: "b4" },
    { desc: "Supply of certain qualifying healthcare (medical) services", box: "b4" },
    { desc: "Rent received from a residential apartment lease", box: "b5" },
    { desc: "Interest earned on a business current account", box: "b5" },
    { desc: "Local public passenger transport fare income", box: "b5" },
    { desc: "Purchase of digital advertising services from a non-resident supplier (reverse charge applies)", box: "b3" },
    { desc: "Purchase of consulting services from an overseas firm with no UAE establishment", box: "b3" },
    { desc: "Recoverable input VAT on the reverse-charge digital advertising purchase above", box: "b10" },
    { desc: "Recoverable input VAT on the reverse-charge overseas consulting purchase above", box: "b10" },
    { desc: "Adjustment for goods previously imported and later returned to the overseas supplier", box: "b7" },
    { desc: "Correction to Customs-declared import value discovered after the original declaration", box: "b7" },
    { desc: "Office rent paid for the Sharjah branch (standard-rated expense)", box: "b9" },
    { desc: "Purchase of stock-in-trade from a local VAT-registered wholesaler", box: "b9" },
    { desc: "IT support and software subscription paid to a local UAE vendor", box: "b9" },
    { desc: "Monthly salaries and wages paid to employees", box: "oos" },
    { desc: "Dividend received from a subsidiary company", box: "oos" },
    { desc: "Fine paid to Dubai Municipality for a parking violation", box: "oos" },
    { desc: "Donation made to a registered UAE charity", box: "oos" },
    { desc: "Capital injected by the owner into the business bank account", box: "oos" },
  ];

  const SCENARIO_NAMES = ["Retail Trading Co.", "Gulf Logistics Services", "Al Manara Consulting", "Marina Import & Export", "Falcon IT Solutions"];

  let ledger = [];

  function pickLedger() {
    const shuffled = TRANSACTION_BANK.slice().sort(() => Math.random() - 0.5).slice(0, 14);
    const today = new Date();
    ledger = shuffled.map((t, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), Math.max(1, 28 - i * 2));
      return {
        id: "L" + i,
        date: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"),
        description: t.desc,
        amount: Math.round((2000 + Math.random() * 48000) / 50) * 50,
        correctBox: t.box,
        studentBox: "",
      };
    });
    document.getElementById("scenarioLabelOut").textContent = SCENARIO_NAMES[Math.floor(Math.random() * SCENARIO_NAMES.length)];
    document.getElementById("resultPanel").style.display = "none";
    renderLedger();
    renderTotals();
  }

  function renderLedger() {
    const body = document.getElementById("ledgerBody");
    body.innerHTML = "";
    ledger.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + VATSIM.fmtDate(row.date) + "</td>" +
        "<td>" + row.description + "</td>" +
        "<td>" + VATSIM.fmtAED(row.amount) + "</td>" +
        '<td><select data-row="' + row.id + '">' + BOX_OPTIONS.map((o) => '<option value="' + o.value + '">' + o.label + "</option>").join("") + "</select></td>" +
        '<td data-result="' + row.id + '"></td>';
      body.appendChild(tr);
    });
    body.querySelectorAll("select").forEach((sel) => {
      sel.addEventListener("change", () => {
        const row = ledger.find((r) => r.id === sel.getAttribute("data-row"));
        row.studentBox = sel.value;
        renderTotals();
      });
    });
  }

  function renderTotals() {
    const totals = { b1: 0, b3: 0, b4: 0, b5: 0, b7: 0, b9: 0, b10: 0, oos: 0 };
    ledger.forEach((r) => {
      if (r.studentBox && totals[r.studentBox] !== undefined) totals[r.studentBox] += r.amount;
    });
    function item(k, v) {
      return '<div class="review-item"><div class="k">' + k + '</div><div class="v">AED ' + VATSIM.fmtAED(v) + "</div></div>";
    }
    document.getElementById("runningTotals").innerHTML =
      item("Box 1 — Standard Rated Supplies", totals.b1) +
      item("Box 3 — Reverse Charge Supplies", totals.b3) +
      item("Box 4 — Zero Rated Supplies", totals.b4) +
      item("Box 5 — Exempt Supplies", totals.b5) +
      item("Box 7 — Import Adjustments", totals.b7) +
      item("Box 9 — Standard Rated Expenses", totals.b9) +
      item("Box 10 — Reverse Charge Recoverable", totals.b10) +
      item("Excluded (Outside Scope)", totals.oos);
  }

  document.getElementById("btnNewLedger").addEventListener("click", pickLedger);

  document.getElementById("btnCheck").addEventListener("click", () => {
    const unanswered = ledger.filter((r) => !r.studentBox);
    if (unanswered.length) {
      VATSIM.toast("Classify all " + ledger.length + " lines before checking your work (" + unanswered.length + " remaining).", "error");
      return;
    }
    let correctCount = 0;
    ledger.forEach((row) => {
      const isCorrect = row.studentBox === row.correctBox;
      if (isCorrect) correctCount++;
      const cell = document.querySelector('[data-result="' + row.id + '"]');
      const correctLabel = BOX_OPTIONS.find((o) => o.value === row.correctBox).label;
      cell.innerHTML = isCorrect
        ? '<span style="color:var(--success);font-weight:700">✓ Correct</span>'
        : '<span style="color:var(--danger);font-weight:700" title="Correct answer: ' + correctLabel + '">✕ Should be: ' + correctLabel.replace(/^Box \d+ — /, "").replace("Outside the Scope of VAT", "Outside Scope") + "</span>";
    });
    const scorePct = VATSIM.round2((correctCount / ledger.length) * 100);
    document.getElementById("resultPanel").style.display = "block";
    document.getElementById("scoreOut").textContent = scorePct + "%";
    document.getElementById("scoreDetailOut").textContent = correctCount + " of " + ledger.length + " transactions classified correctly.";
    document.getElementById("resultPanel").scrollIntoView({ behavior: "smooth", block: "center" });

    VATSIM.addTbAttempt({ scorePct, correctCount, total: ledger.length });
    VATSIM.toast("Scored " + scorePct + "% — logged to your Activity Log.", scorePct >= 70 ? "success" : "info");
  });

  pickLedger();
})();
