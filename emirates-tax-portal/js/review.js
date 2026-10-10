/* ==========================================================================
   review.js — Steps 18-19: Review & Declaration
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
  let filing = filingId && VATSIM.getFiling(filingId);
  if (!filing) {
    VATSIM.toast("Filing not found — please start again from My Filings.", "error");
    setTimeout(() => (window.location.href = "filings.html"), 900);
    return;
  }
  if (filing.status === "Submitted" && !VATSIM.canEditFiling(filing)) {
    window.location.href = "success.html?id=" + encodeURIComponent(filing.id);
    return;
  }
  const isEditingSubmitted = filing.status === "Submitted";

  const b = filing.boxes;
  const t = VATSIM.computeTotals(b);

  /* QA fix: review.html?id=… can be opened directly (bookmark/back button) and used to submit a
     return that never passed the Return-screen checks. Re-run the same rules here and send the
     student back to fix them instead of submitting an invalid return. */
  {
    // Like the real portal: only hard errors stop submission; "VAT is not 5%" style flags do not.
    const checked = VATSIM.validateBoxes(b);
    const pending = checked.errors.slice();
    if (!b.profitMargin) pending.push("Profit Margin Scheme question not answered");
    if (!pending.length && checked.warnings.length) {
      VATSIM.toast(checked.warnings.length + " item(s) on this return are flagged (e.g. " + checked.warnings[0].split(":")[0] + "). You may still submit, but a clean return has none.", "info");
    }
    if (pending.length) {
      VATSIM.toast("This return has issues: " + pending[0] + (pending.length > 1 ? " (+" + (pending.length - 1) + " more)" : "") + ". Please fix them first.", "error");
      setTimeout(() => (window.location.href = "return.html?id=" + encodeURIComponent(filing.id)), 1200);
      return;
    }
  }

  document.getElementById("fPeriod").textContent = VATSIM.fmtDate(filing.period.from) + " - " + VATSIM.fmtDate(filing.period.to);
  document.getElementById("fStagger").textContent = VATSIM.staggerLabel(filing.period.stagger);
  document.getElementById("fDue").textContent = VATSIM.fmtDate(filing.period.dueDate);
  document.getElementById("fYearEnd").textContent = VATSIM.fmtDate(filing.period.taxYearEnd);

  const EMIRATE_LABELS = {
    abudhabi: "Abu Dhabi", dubai: "Dubai", sharjah: "Sharjah", ajman: "Ajman",
    uaq: "Umm Al Quwain", rak: "Ras Al Khaimah", fujairah: "Fujairah",
  };

  function section(title, itemsHtml) {
    return (
      '<div class="review-section">' +
      '<div class="review-section-header"><h3>' + title + '</h3><span class="chev">▾</span></div>' +
      '<div class="review-section-body"><div class="review-grid">' + itemsHtml + "</div></div>" +
      "</div>"
    );
  }
  function item(k, v) {
    return '<div class="review-item"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>";
  }

  let html = "";

  html += section(
    "Taxable Person Details",
    item("TRN", account.trn) +
      item("First Name in English", account.firstNameEn) +
      item("Last Name in English", account.lastNameEn) +
      item("First Name in Arabic", account.firstNameAr || "—") +
      item("Last Name in Arabic", account.lastNameAr || "—") +
      item("Business Activity", account.businessActivity) +
      item("Registered Address", account.address)
  );

  let salesItems = "";
  Object.keys(EMIRATE_LABELS).forEach((key) => {
    salesItems += item("Box 1 — Standard rated (" + EMIRATE_LABELS[key] + ")", "AED " + VATSIM.fmtAED(b.b1[key].amount) + " / VAT " + VATSIM.fmtAED(b.b1[key].vat));
  });
  salesItems += item("Box 2 — Tourist refunds", "AED " + VATSIM.fmtAED(b.b2.amount) + " / VAT " + VATSIM.fmtAED(b.b2.vat));
  salesItems += item("Box 3 — Reverse charge supplies", "AED " + VATSIM.fmtAED(b.b3.amount) + " / VAT " + VATSIM.fmtAED(b.b3.vat));
  salesItems += item("Box 4 — Zero rated supplies", "AED " + VATSIM.fmtAED(b.b4.amount));
  salesItems += item("Box 5 — Exempt supplies", "AED " + VATSIM.fmtAED(b.b5.amount));
  salesItems += item("Box 6 — Goods imported", "AED " + VATSIM.fmtAED(b.b6.amount) + " / VAT " + VATSIM.fmtAED(b.b6.vat));
  salesItems += item("Box 7 — Import adjustments", "AED " + VATSIM.fmtAED(b.b7.amount) + " / VAT " + VATSIM.fmtAED(b.b7.vat));
  salesItems += item("Box 8 — Totals", "AED " + VATSIM.fmtAED(t.box8amount) + " / VAT " + VATSIM.fmtAED(t.box8vat) + " / Adj " + VATSIM.fmtAED(t.box8adj));
  html += section("VAT on Sales and All Other Outputs", salesItems);

  let expItems = "";
  expItems += item("Box 9 — Standard rated expenses", "AED " + VATSIM.fmtAED(b.b9.amount) + " / VAT " + VATSIM.fmtAED(b.b9.vat));
  expItems += item("Box 10 — Reverse charge purchases", "AED " + VATSIM.fmtAED(b.b10.amount) + " / VAT " + VATSIM.fmtAED(b.b10.vat));
  expItems += item("Box 11 — Totals", "AED " + VATSIM.fmtAED(t.box11amount) + " / VAT " + VATSIM.fmtAED(t.box11vat) + " / Adj " + VATSIM.fmtAED(t.box11adj));
  html += section("VAT on Expenses and All Other Inputs", expItems);

  html += section(
    "Net VAT Due",
    item("Box 12 — Total tax due", "AED " + VATSIM.fmtAED(t.box12)) +
      item("Box 13 — Total recoverable tax", "AED " + VATSIM.fmtAED(t.box13)) +
      item("Box 14 — " + (t.isRefund ? "Refundable tax" : "Payable tax"), "AED " + VATSIM.fmtAED(Math.abs(t.box14))) +
      (t.isRefund && Math.abs(t.box14) > 0
        ? item("Box 15 — Request a refund?", b.requestRefund === "Yes" ? "Yes (Form VAT311 required after submission)" : "No (kept as credit and set off against your next payable return)")
        : "") +
      (!t.isRefund && t.box14 > 0 && VATSIM.netPayable(filing).credit > 0
        ? item("Credit brought forward (Box 15 = No earlier)", "AED " + VATSIM.fmtAED(VATSIM.netPayable(filing).credit)) +
          item("Net amount payable after credit", "AED " + VATSIM.fmtAED(VATSIM.netPayable(filing).net))
        : "")
  );

  html += section(
    "Additional Reporting",
    item("Profit Margin Scheme applied?", b.profitMargin || "Not answered") + item("Notes", b.notes ? b.notes : "—")
  );

  document.getElementById("reviewSections").innerHTML = html;
  document.querySelectorAll(".review-section-header").forEach((h) => {
    h.addEventListener("click", () => {
      h.classList.toggle("open");
      h.nextElementSibling.classList.toggle("open");
    });
  });
  let allOpen = false;
  document.getElementById("btnExpandAll").addEventListener("click", () => {
    allOpen = !allOpen;
    document.querySelectorAll(".review-section-header").forEach((h) => {
      h.classList.toggle("open", allOpen);
      h.nextElementSibling.classList.toggle("open", allOpen);
    });
  });

  /* ---------------- Declaration fields (pre-populated from registration) ---------------- */
  document.getElementById("dFirstEn").value = filing.declaration.firstNameEn || account.firstNameEn;
  document.getElementById("dLastEn").value = filing.declaration.lastNameEn || account.lastNameEn;
  document.getElementById("dFirstAr").value = filing.declaration.firstNameAr || account.firstNameAr || "—";
  document.getElementById("dLastAr").value = filing.declaration.lastNameAr || account.lastNameAr || "—";
  document.getElementById("dCountry").value = filing.declaration.countryCode || "+971";
  document.getElementById("dPhone").value = filing.declaration.phone || account.phone || "—";
  document.getElementById("dEmail").value = filing.declaration.email || account.email;
  document.getElementById("dDate").value = VATSIM.fmtDate(VATSIM.todayISO());

  const declareCheck = document.getElementById("declareCheck");
  const submitBtn = document.getElementById("btnSubmit");
  if (isEditingSubmitted) {
    submitBtn.textContent = "Resubmit Return";
  }
  declareCheck.addEventListener("change", () => {
    submitBtn.disabled = !declareCheck.checked;
  });

  document.getElementById("btnPrevStep").addEventListener("click", () => {
    window.location.href = "return.html?id=" + encodeURIComponent(filing.id);
  });

  let submitting = false; // QA fix: a double-click/Enter must not create two submissions (two refs, two messages)
  submitBtn.addEventListener("click", () => {
    if (!declareCheck.checked || submitting) return;
    submitting = true;
    submitBtn.disabled = true;
    VATSIM.showLoading(isEditingSubmitted ? "Resubmitting VAT Return…" : "Submitting VAT Return…", 1100).then(() => {
      const today = new Date();
      const wasEditing = isEditingSubmitted;
      filing.status = "Submitted";
      if (!wasEditing) {
        filing.submittedAt = today.toISOString();
        filing.referenceNumber = "DEMO-" + String(Math.floor(100000000 + Math.random() * 899999999));
      } else {
        filing.modifiedAt = today.toISOString();
      }
      filing.declaration.confirmed = true;
      VATSIM.upsertFiling(filing);
      if (!wasEditing) VATSIM.addSubmissionCorrespondence(account, filing);
      VATSIM.toast(wasEditing ? "VAT Return resubmitted successfully." : "VAT Return submitted successfully.", "success");
      window.location.href = "success.html?id=" + encodeURIComponent(filing.id);
    });
  });
})();
