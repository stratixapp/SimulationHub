/* ==========================================================================
   voluntary-disclosure.js — Form VAT211: correct a past Submitted return
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

  const submittedFilings = VATSIM.getFilings().filter((f) => f.status === "Submitted").sort((a, b) => new Date(b.period.from) - new Date(a.period.from));

  const select = document.getElementById("filingSelect");
  select.innerHTML =
    '<option value="">Select a return…</option>' +
    submittedFilings.map((f) => '<option value="' + f.id + '">' + f.period.label + " — Ref. " + f.referenceNumber + "</option>").join("");

  const params = new URLSearchParams(window.location.search);
  const preselect = params.get("id");
  if (preselect) select.value = preselect;

  let filing = null;
  let originalTotals = null;

  const fieldIds = ["c_b1amount", "c_b1vat", "c_b3amount", "c_b3vat", "c_b4amount", "c_b5amount", "c_b7amount", "c_b7vat", "c_b9amount", "c_b9vat", "c_b10amount", "c_b10vat"];

  function n(v) {
    return VATSIM.n ? VATSIM.n(v) : parseFloat(v) || 0;
  }

  function loadFiling(id) {
    filing = submittedFilings.find((f) => f.id === id);
    if (!filing) {
      document.getElementById("vdWorkspace").style.display = "none";
      document.getElementById("wizardFooter").style.display = "none";
      return;
    }
    originalTotals = VATSIM.computeTotals(filing.boxes);
    document.getElementById("vdWorkspace").style.display = "block";
    document.getElementById("wizardFooter").style.display = "flex";

    function item(k, v) {
      return '<div class="review-item"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>";
    }
    document.getElementById("originalGrid").innerHTML =
      item("Period", filing.period.label) +
      item("Reference Number", filing.referenceNumber) +
      item("Box 12 — Total Output VAT", "AED " + VATSIM.fmtAED(originalTotals.box12)) +
      item("Box 13 — Total Recoverable Tax", "AED " + VATSIM.fmtAED(originalTotals.box13)) +
      item((originalTotals.isRefund ? "Box 14 — Refundable" : "Box 14 — Payable"), "AED " + VATSIM.fmtAED(Math.abs(originalTotals.box14)));

    // Pre-fill corrected fields with the original totals as the starting point
    document.getElementById("c_b1amount").value = originalTotals.b1amt || "";
    document.getElementById("c_b1vat").value = originalTotals.b1vat || "";
    document.getElementById("c_b3amount").value = filing.boxes.b3.amount || "";
    document.getElementById("c_b3vat").value = filing.boxes.b3.vat || "";
    document.getElementById("c_b4amount").value = filing.boxes.b4.amount || "";
    document.getElementById("c_b5amount").value = filing.boxes.b5.amount || "";
    document.getElementById("c_b7amount").value = filing.boxes.b7.amount || "";
    document.getElementById("c_b7vat").value = filing.boxes.b7.vat || "";
    document.getElementById("c_b9amount").value = filing.boxes.b9.amount || "";
    document.getElementById("c_b9vat").value = filing.boxes.b9.vat || "";
    document.getElementById("c_b10amount").value = filing.boxes.b10.amount || "";
    document.getElementById("c_b10vat").value = filing.boxes.b10.vat || "";

    recalc();
  }

  function getCorrectedInputs() {
    return {
      b1amount: document.getElementById("c_b1amount").value,
      b1vat: document.getElementById("c_b1vat").value,
      b3amount: document.getElementById("c_b3amount").value,
      b3vat: document.getElementById("c_b3vat").value,
      b4amount: document.getElementById("c_b4amount").value,
      b5amount: document.getElementById("c_b5amount").value,
      b7amount: document.getElementById("c_b7amount").value,
      b7vat: document.getElementById("c_b7vat").value,
      b9amount: document.getElementById("c_b9amount").value,
      b9vat: document.getElementById("c_b9vat").value,
      b10amount: document.getElementById("c_b10amount").value,
      b10vat: document.getElementById("c_b10vat").value,
    };
  }

  function recalc() {
    if (!filing) return;
    const correctedBoxes = VATSIM.buildCorrectedBoxes(filing.boxes, getCorrectedInputs());
    const correctedTotals = VATSIM.computeTotals(correctedBoxes);
    const diff = VATSIM.round2(correctedTotals.box14 - originalTotals.box14);

    function item(k, v) {
      return '<div class="review-item"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>";
    }
    document.getElementById("correctedGrid").innerHTML =
      item("Box 12 — Total Output VAT", "AED " + VATSIM.fmtAED(correctedTotals.box12)) +
      item("Box 13 — Total Recoverable Tax", "AED " + VATSIM.fmtAED(correctedTotals.box13)) +
      item((correctedTotals.isRefund ? "Box 14 — Refundable" : "Box 14 — Payable"), "AED " + VATSIM.fmtAED(Math.abs(correctedTotals.box14)));

    const banner = document.getElementById("differenceBanner");
    if (diff === 0) {
      banner.innerHTML = "<span>No net tax difference between the original and corrected figures.</span>";
    } else if (diff > 0) {
      banner.innerHTML = "<span><strong>AED " + VATSIM.fmtAED(diff) + "</strong> additional tax is now payable as a result of this correction, plus any applicable Voluntary Disclosure penalty below.</span>";
    } else {
      banner.innerHTML = "<span><strong>AED " + VATSIM.fmtAED(Math.abs(diff)) + "</strong> becomes refundable as a result of this correction.</span>";
    }

    const auditNotified = document.querySelector('input[name="auditNotified"]:checked').value === "yes";
    const penalty = VATSIM.computeVdPenalty(diff, filing.period.dueDate, VATSIM.todayISO(), auditNotified);
    const penaltyBanner = document.getElementById("vdPenaltyBanner");
    if (penalty.applicable) {
      penaltyBanner.style.display = "block";
      penaltyBanner.innerHTML =
        "<span><strong>Estimated Voluntary Disclosure Penalty: AED " + VATSIM.fmtAED(penalty.total) + "</strong><br/>" +
        (auditNotified ? "15% fixed surcharge (AED " + VATSIM.fmtAED(penalty.surcharge) + ") + " : "") +
        "1% per month × " + penalty.monthsElapsed + " month(s) since the original due date, on the AED " + VATSIM.fmtAED(diff) + " tax difference (Cabinet Decision No. 129 of 2025).</span>";
    } else {
      penaltyBanner.style.display = "none";
    }

    // AED 10,000 materiality threshold — per Article 10.1(a) of the Tax
    // Procedures Executive Regulation, a Voluntary Disclosure is only
    // required where the tax difference exceeds AED 10,000; smaller
    // errors can normally just be corrected in the next VAT return.
    const thresholdBanner = document.getElementById("thresholdBanner");
    if (Math.abs(diff) > 0 && Math.abs(diff) <= 10000) {
      thresholdBanner.style.display = "block";
      thresholdBanner.innerHTML =
        "<span>This AED " + VATSIM.fmtAED(Math.abs(diff)) + " difference is at or below the AED 10,000 Voluntary Disclosure threshold (Article 10.1(a)). " +
        "You're not required to file a VD211 for this — you could instead just correct it in your next VAT return. You can still submit here for practice.</span>";
    } else {
      thresholdBanner.style.display = "none";
    }

    // 20-business-day filing deadline from the discovery date.
    const deadlineBanner = document.getElementById("deadlineBanner");
    const discoveryVal = document.getElementById("discoveryDate").value;
    if (discoveryVal) {
      const businessDaysSince = countBusinessDays(new Date(discoveryVal), new Date());
      if (businessDaysSince > 20) {
        deadlineBanner.style.display = "block";
        deadlineBanner.innerHTML =
          "<span><strong>⚠ Past the 20-business-day filing window.</strong> It's been " + businessDaysSince +
          " business day(s) since you discovered this error — the Tax Procedures Executive Regulation requires a Voluntary Disclosure to be submitted within 20 business days of discovery. Filing late here doesn't itself add a monetary penalty, but delays like this are exactly what the deadline is designed to prevent — file as soon as an error is found.</span>";
      } else {
        deadlineBanner.style.display = "none";
      }
    } else {
      deadlineBanner.style.display = "none";
    }
  }
  function countBusinessDays(from, to) {
    let count = 0;
    const cur = new Date(from);
    while (cur < to) {
      cur.setDate(cur.getDate() + 1);
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  }

  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      let v = el.value.replace(/[^0-9.]/g, "");
      const firstDot = v.indexOf(".");
      if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
      if (v !== el.value) el.value = v;
      recalc();
    });
  });

  select.addEventListener("change", () => loadFiling(select.value));
  if (preselect) loadFiling(preselect);

  document.querySelectorAll('input[name="auditNotified"]').forEach((r) => r.addEventListener("change", recalc));
  document.getElementById("discoveryDate").addEventListener("change", recalc);
  document.getElementById("discoveryDate").max = VATSIM.todayISO();

  document.getElementById("btnSubmitVd").addEventListener("click", () => {
    if (!filing) {
      VATSIM.toast("Select a return to correct first.", "error");
      return;
    }
    if (!document.getElementById("discoveryDate").value) {
      VATSIM.toast("Enter the date you discovered this error.", "error");
      document.getElementById("discoveryDate").focus();
      return;
    }
    const reason = document.getElementById("vdReason").value.trim();
    if (!reason) {
      VATSIM.toast("Please state a reason for this disclosure.", "error");
      document.getElementById("vdReason").focus();
      return;
    }
    const auditNotified = document.querySelector('input[name="auditNotified"]:checked').value === "yes";
    VATSIM.showLoading("Submitting Voluntary Disclosure to the FTA…", 1100).then(() => {
      const vd = VATSIM.addVoluntaryDisclosure(account, filing, getCorrectedInputs(), reason, auditNotified);
      VATSIM.toast("Voluntary Disclosure submitted. Ref. " + vd.referenceNumber, "success");
      setTimeout(() => (window.location.href = "correspondence.html"), 900);
    });
  });
})();
