/* ==========================================================================
   liabilities.js — "My Liabilities" screen
   Created By Ananthu Shaji

   Mirrors the real EmaraTax portal's separate Liabilities list: filing a
   return and paying it are two different places there — you submit the
   return, then come here (or get here via a notification) to find what's
   still owed and pay it. Excise Tax isn't listed here because, in this
   simulator (matching how excise.js already works), excise tax is paid at
   the moment of filing rather than left as a later liability.
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

  function outstandingLiabilities() {
    return VATSIM.getFilings()
      .filter((f) => f.status === "Submitted")
      .map((f) => ({ filing: f, totals: VATSIM.computeTotals(f.boxes) }))
      .filter(({ totals, filing }) => !totals.isRefund && totals.box14 > 0 && !VATSIM.isPaymentSettled(filing.payment))
      .sort((a, b) => new Date(a.filing.period.dueDate) - new Date(b.filing.period.dueDate));
  }

  // Administrative penalties (late filing / late payment) show up as
  // their own separate payable line — matching how the real EmaraTax
  // My Liabilities screen lists penalties apart from the return itself,
  // rather than folding them into the return's payment.
  function outstandingPenalties() {
    const all = VATSIM.getFilings();
    return all
      .filter((f) => f.status === "Submitted")
      .map((f) => ({ filing: f, penalty: VATSIM.computeFilingPenalty(f, all) }))
      .filter(({ filing, penalty }) => penalty.total > 0 && !VATSIM.isPaymentSettled(filing.penaltyPayment))
      .sort((a, b) => new Date(a.filing.period.dueDate) - new Date(b.filing.period.dueDate));
  }

  function render() {
    const items = outstandingLiabilities();
    const penalties = outstandingPenalties();
    const body = document.getElementById("liabilitiesBody");
    body.innerHTML = "";
    document.getElementById("emptyState").style.display = items.length || penalties.length ? "none" : "block";
    const total = items.length + penalties.length;
    document.getElementById("pageSummary").textContent = "showing " + total + " of " + total + " records";

    items.forEach(({ filing, totals }) => {
      const overdue = new Date(filing.period.dueDate) < new Date();
      const reviewBadge = VATSIM.filingStatusBadge(filing);
      const processing = filing.payment && VATSIM.getEffectivePaymentStatus(filing.payment) === "Processing";
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>VAT Return</td>" +
        "<td>" + (filing.referenceNumber || "—") + "</td>" +
        "<td>" + VATSIM.fmtDate(filing.period.from) + " – " + VATSIM.fmtDate(filing.period.to) + "</td>" +
        "<td>" + VATSIM.fmtDate(filing.period.dueDate) + "</td>" +
        "<td>AED " + VATSIM.fmtAED(totals.box14) + "</td>" +
        '<td><span class="status-pill"><span class="status-dot ' + (processing ? "processed" : reviewBadge.dotClass) + '"></span> ' +
        (processing ? "GIBAN Processing" : reviewBadge.label) +
        (overdue && !processing ? ' <span style="color:var(--danger);font-weight:700">· Overdue</span>' : "") + "</span></td>" +
        "<td></td>";
      const actionCell = tr.lastElementChild;
      if (processing) {
        actionCell.innerHTML = '<span style="font-size:11px;color:var(--text-faint)">Settling — no action needed</span>';
      } else {
        const btn = document.createElement("button");
        btn.className = "btn btn-gold btn-sm";
        btn.textContent = "💳 Pay Now";
        btn.addEventListener("click", () => (window.location.href = "payment.html?id=" + encodeURIComponent(filing.id)));
        actionCell.appendChild(btn);
      }
      body.appendChild(tr);
    });

    penalties.forEach(({ filing, penalty }) => {
      const tr = document.createElement("tr");
      const title =
        (penalty.isLateFiling ? "Late filing: AED " + VATSIM.fmtAED(penalty.lateFiling) + (penalty.repeat ? " (repeat offence)" : " (first offence)") : "") +
        (penalty.isLatePayment ? " · Late payment: AED " + VATSIM.fmtAED(penalty.latePayment) + " (" + penalty.monthsLate + " mo.)" : "");
      tr.innerHTML =
        '<td>Administrative Penalty</td>' +
        "<td>Ref. " + (filing.referenceNumber || "—") + "</td>" +
        "<td>" + VATSIM.fmtDate(filing.period.from) + " – " + VATSIM.fmtDate(filing.period.to) + "</td>" +
        "<td>" + VATSIM.fmtDate(filing.period.dueDate) + "</td>" +
        '<td title="' + title + '">AED ' + VATSIM.fmtAED(penalty.total) + "</td>" +
        '<td><span class="status-pill"><span class="status-dot overdue"></span> Payable</span></td>' +
        "<td></td>";
      const actionCell = tr.lastElementChild;
      const btn = document.createElement("button");
      btn.className = "btn btn-outline btn-sm";
      btn.style.borderColor = "var(--danger)";
      btn.style.color = "var(--danger)";
      btn.textContent = "💳 Pay Penalty";
      btn.addEventListener("click", () => (window.location.href = "payment.html?id=" + encodeURIComponent(filing.id) + "&type=penalty"));
      actionCell.appendChild(btn);
      body.appendChild(tr);
    });
  }

  render();
  setInterval(() => {
    const stillAnimating = VATSIM.getFilings().some(
      (f) =>
        (f.status === "Submitted" && f.submittedAt && Date.now() - new Date(f.submittedAt).getTime() < 65000) ||
        (f.payment && f.payment.status === "Processing") ||
        (f.penaltyPayment && f.penaltyPayment.status === "Processing")
    );
    if (stillAnimating) render();
  }, 2000);
})();
