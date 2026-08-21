/* ==========================================================================
   success.js — Step 20: Submission success
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

  const params = new URLSearchParams(window.location.search);
  const filingId = params.get("id");
  const filing = filingId && VATSIM.getFiling(filingId);
  if (!filing || filing.status !== "Submitted") {
    VATSIM.toast("No submitted return found for that reference.", "error");
    setTimeout(() => (window.location.href = "filings.html"), 900);
    return;
  }

  const t = VATSIM.computeTotals(filing.boxes);

  document.getElementById("sTrn").textContent = account.trn;
  document.getElementById("sName").textContent = account.firstNameEn + " " + account.lastNameEn;
  document.getElementById("sRef").textContent = filing.referenceNumber;
  document.getElementById("sSubDate").textContent = VATSIM.fmtDate(filing.submittedAt);
  document.getElementById("sPeriod").textContent = VATSIM.fmtDate(filing.period.from) + " – " + VATSIM.fmtDate(filing.period.to);
  document.getElementById("sStagger").textContent = filing.period.stagger;
  document.getElementById("sDue").textContent = VATSIM.fmtDate(filing.period.dueDate);
  document.getElementById("sYearEnd").textContent = VATSIM.fmtDate(filing.period.taxYearEnd);
  document.getElementById("sReturnAmt").textContent = "AED " + VATSIM.fmtAED(Math.abs(t.box14)) + (t.isRefund ? " (Refundable)" : "");
  document.getElementById("sDueAmt").textContent = t.isRefund ? "AED 0.00" : "AED " + VATSIM.fmtAED(t.box14);

  const cta = document.getElementById("paymentCta");
  if (t.isRefund && Math.abs(t.box14) > 0 && filing.boxes.requestRefund === "Yes") {
    cta.innerHTML =
      '<div class="info-banner" style="text-align:left;max-width:420px;margin:0 auto">You requested a refund on Box 15 — you\'ll need to separately complete and submit Form <strong>VAT311</strong> (VAT Refund Request) to claim it.</div>';
  }
  if (!t.isRefund && t.box14 > 0) {
    if (filing.payment && VATSIM.getEffectivePaymentStatus(filing.payment) === "Paid") {
      cta.innerHTML = '<span class="status-pill" style="font-size:13px"><span class="status-dot submitted"></span> Payment received on ' + VATSIM.fmtDate(filing.payment.date) + '</span>';
    } else if (filing.payment && filing.payment.status === "Processing") {
      cta.innerHTML = '<span class="status-pill" style="font-size:13px"><span class="status-dot processed"></span> GIBAN transfer processing — see <a href="liabilities.html">My Liabilities</a> for status</span>';
    } else {
      // Matches the real EmaraTax portal: filing and payment are two
      // separate places there. You submit the return here, then go find
      // it under "My Liabilities" to pay it — there's no "Pay Now"
      // shortcut on the confirmation screen itself.
      const btn = document.createElement("button");
      btn.className = "btn btn-gold";
      btn.textContent = "💰 Go to My Liabilities to Pay";
      btn.addEventListener("click", () => (window.location.href = "liabilities.html"));
      cta.appendChild(btn);
    }
  }

  /* ---------------- Live review-status animation ----------------
     Under Review -> Processed -> Approved, driven off real elapsed time
     since submittedAt (see VATSIM.getFilingReviewStage). Only shown for
     a return actually submitted in this session (has submittedAt) —
     the seeded demo history skips straight to a plain "Approved" pill
     with no animation, since those were never really "just submitted". */
  const stagePanel = document.getElementById("reviewStagePanel");
  if (filing.submittedAt) {
    stagePanel.style.display = "block";
    const STEP_ORDER = ["review", "processed", "approved"];
    function renderStage() {
      const stage = VATSIM.getFilingReviewStage(filing);
      const currentKey = stage ? stage.key : "approved";
      const currentIdx = STEP_ORDER.indexOf(currentKey);
      document.querySelectorAll(".review-step").forEach((el) => {
        const idx = STEP_ORDER.indexOf(el.getAttribute("data-stage"));
        el.classList.toggle("done", idx < currentIdx || (idx === currentIdx && currentKey === "approved"));
        el.classList.toggle("active", idx === currentIdx && currentKey !== "approved");
      });
      const pct = stage ? stage.pct : 100;
      document.getElementById("reviewProgressBar").style.width = pct + "%";
      const label = stage ? stage.label : "Approved";
      const elapsed = stage ? Math.floor(stage.elapsedSec) : 60;
      document.getElementById("reviewStatusText").textContent =
        currentKey === "approved"
          ? "✅ Approved — review complete."
          : label + "… (" + Math.min(elapsed, 60) + "s of ~60s)";
      if (currentKey === "approved") clearInterval(timer);
    }
    renderStage();
    const timer = setInterval(renderStage, 1000);
  }

  if (VATSIM.canEditFiling(filing)) {
    const editBtn = document.getElementById("btnEditReturn");
    editBtn.style.display = "";
    editBtn.addEventListener("click", () => (window.location.href = "return.html?id=" + encodeURIComponent(filing.id)));
  }

  /* ---------------- Penalty breakdown ---------------- */
  const penalty = VATSIM.computeFilingPenalty(filing);
  if (penalty.total > 0) {
    document.getElementById("penaltyPanel").style.display = "block";
    function item(k, v) {
      return '<div class="review-item"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>";
    }
    let html = "";
    if (penalty.isLateFiling) {
      html += item("Late Filing Penalty", "AED " + VATSIM.fmtAED(penalty.lateFiling) + (penalty.repeat ? " (repeat offence within 24 months)" : " (first offence)"));
    }
    if (penalty.isLatePayment) {
      html += item("Late Payment Penalty", "AED " + VATSIM.fmtAED(penalty.latePayment) + " (" + penalty.monthsLate + " month(s) late at 14%/annum)");
    }
    html += item("Total Estimated Penalty", "AED " + VATSIM.fmtAED(penalty.total));
    document.getElementById("penaltyGrid").innerHTML = html;
  }

  document.getElementById("btnDownloadSummary").addEventListener("click", () => {
    VATSIM.showLoading("Preparing VAT summary PDF…", 500).then(() => {
      const rows = [
        ["TRN", account.trn],
        ["Registrant", account.firstNameEn + " " + account.lastNameEn],
        ["Demo Submission Reference", filing.referenceNumber],
        ["Submission Date", VATSIM.fmtDate(filing.submittedAt)],
        ["VAT Return Period", VATSIM.fmtDate(filing.period.from) + " – " + VATSIM.fmtDate(filing.period.to)],
        ["Due Date", VATSIM.fmtDate(filing.period.dueDate)],
        ["Box 8 — Total Output VAT", "AED " + VATSIM.fmtAED(t.box8vat)],
        ["Box 11 — Total Input VAT", "AED " + VATSIM.fmtAED(t.box11vat)],
        ["Box 12 — Total Tax Due", "AED " + VATSIM.fmtAED(t.box12)],
        ["Box 13 — Total Recoverable Tax", "AED " + VATSIM.fmtAED(t.box13)],
        ["Box 14 — " + (t.isRefund ? "Refundable" : "Payable") + " Tax", "AED " + VATSIM.fmtAED(Math.abs(t.box14))],
      ];
      const ok = VATSIM.generatePdf({
        title: "VAT201 Return — Summary",
        rows,
        filename: "VAT_Summary_" + filing.referenceNumber + ".pdf",
      });
      if (ok) VATSIM.toast("VAT summary PDF downloaded.", "success");
    });
  });

  document.getElementById("btnDownloadPdf").addEventListener("click", () => {
    if (!window.jspdf) {
      VATSIM.toast("PDF library did not load — check your internet connection and try again.", "error");
      return;
    }
    VATSIM.showLoading("Preparing acknowledgement PDF…", 700).then(() => buildPdf());
  });

  function buildPdf() {
    const b = filing.boxes;
    const EMIRATES = [
      ["abudhabi", "Abu Dhabi"], ["dubai", "Dubai"], ["sharjah", "Sharjah"],
      ["ajman", "Ajman"], ["uaq", "Umm Al Quwain"], ["rak", "Ras Al Khaimah"], ["fujairah", "Fujairah"],
    ];
    const headerRows = [
      ["TRN", account.trn],
      ["Registrant's Name", account.firstNameEn + " " + account.lastNameEn],
      ["Legal Name", account.companyName],
      ["Demo Submission Reference", filing.referenceNumber],
      ["Submission Date", VATSIM.fmtDate(filing.submittedAt)],
      ["Last Modified", filing.modifiedAt ? VATSIM.fmtDate(filing.modifiedAt) : "—"],
      ["VAT Return Period", VATSIM.fmtDate(filing.period.from) + "  –  " + VATSIM.fmtDate(filing.period.to)],
      ["VAT Stagger", filing.period.stagger],
      ["Due Date", VATSIM.fmtDate(filing.period.dueDate)],
      ["Tax Year End", VATSIM.fmtDate(filing.period.taxYearEnd)],
    ];

    const outputRows = [];
    EMIRATES.forEach(([key, label]) => {
      const row = b.b1[key];
      if (VATSIM.n(row.amount) || VATSIM.n(row.vat) || VATSIM.n(row.adj)) {
        outputRows.push(["1 — Standard rated supplies in " + label, "AED " + VATSIM.fmtAED(row.amount) + " / VAT " + VATSIM.fmtAED(row.vat) + (VATSIM.n(row.adj) ? " / Adj " + VATSIM.fmtAED(row.adj) : "")]);
      }
    });
    outputRows.push(["2 — Tax refunds provided to tourists", "AED " + VATSIM.fmtAED(b.b2.amount) + " / VAT " + VATSIM.fmtAED(b.b2.vat)]);
    outputRows.push(["3 — Supplies subject to reverse charge", "AED " + VATSIM.fmtAED(b.b3.amount) + " / VAT " + VATSIM.fmtAED(b.b3.vat)]);
    outputRows.push(["4 — Zero rated supplies", "AED " + VATSIM.fmtAED(b.b4.amount)]);
    outputRows.push(["5 — Exempt supplies", "AED " + VATSIM.fmtAED(b.b5.amount)]);
    outputRows.push(["6 — Goods imported into the UAE", "AED " + VATSIM.fmtAED(b.b6.amount) + " / VAT " + VATSIM.fmtAED(b.b6.vat)]);
    outputRows.push(["7 — Adjustments to goods imported", "AED " + VATSIM.fmtAED(b.b7.amount) + " / VAT " + VATSIM.fmtAED(b.b7.vat)]);
    outputRows.push(["8 — Totals (Outputs)", "AED " + VATSIM.fmtAED(t.box8amount) + " / VAT " + VATSIM.fmtAED(t.box8vat) + " / Adj " + VATSIM.fmtAED(t.box8adj)]);

    const inputRows = [
      ["9 — Standard rated expenses", "AED " + VATSIM.fmtAED(b.b9.amount) + " / VAT " + VATSIM.fmtAED(b.b9.vat) + (VATSIM.n(b.b9.adj) ? " / Adj " + VATSIM.fmtAED(b.b9.adj) : "")],
      ["10 — Supplies subject to reverse charge (recoverable)", "AED " + VATSIM.fmtAED(b.b10.amount) + " / VAT " + VATSIM.fmtAED(b.b10.vat)],
      ["11 — Totals (Inputs)", "AED " + VATSIM.fmtAED(t.box11amount) + " / VAT " + VATSIM.fmtAED(t.box11vat) + " / Adj " + VATSIM.fmtAED(t.box11adj)],
    ];

    const netRows = [
      ["12 — Total value of due tax for the period", "AED " + VATSIM.fmtAED(t.box12)],
      ["13 — Total value of recoverable tax for the period", "AED " + VATSIM.fmtAED(t.box13)],
      [(t.isRefund ? "14 — Net VAT refundable" : "14 — Net VAT payable"), "AED " + VATSIM.fmtAED(Math.abs(t.box14))],
    ];
    if (penalty.total > 0) {
      if (penalty.isLateFiling) netRows.push(["Late Filing Penalty", "AED " + VATSIM.fmtAED(penalty.lateFiling)]);
      if (penalty.isLatePayment) netRows.push(["Late Payment Penalty", "AED " + VATSIM.fmtAED(penalty.latePayment)]);
      netRows.push(["Total Estimated Penalty", "AED " + VATSIM.fmtAED(penalty.total)]);
    }

    const rows = headerRows
      .concat([["— VAT ON SALES AND ALL OTHER OUTPUTS —", ""]])
      .concat(outputRows)
      .concat([["— VAT ON EXPENSES AND ALL OTHER INPUTS —", ""]])
      .concat(inputRows)
      .concat([["— NET VAT DUE —", ""]])
      .concat(netRows);

    const ok = VATSIM.generatePdf({
      title: "VAT201 Return — Acknowledgement Receipt",
      subtitle: "Federal Tax Authority acknowledges receipt of this VAT return, submitted via EmaraTax.",
      rows,
      filename: "VAT201_Acknowledgement_" + filing.referenceNumber + ".pdf",
    });
    if (ok) VATSIM.toast("Acknowledgement PDF downloaded.", "success");
  }
})();
