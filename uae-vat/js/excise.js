/* ==========================================================================
   excise.js — Excise Tax: registration, dashboard, EX201 return filing
   Created By Ananthu Shaji
   ========================================================================== */

(function () {
  "use strict";

  const session = VATSIM.requireSession("../login.html");
  if (!session) return;
  let account = VATSIM.getAccount();
  if (!account) {
    window.location.href = "../index.html";
    return;
  }
  VATSIM.wireChrome();

  function rateLabel(cat) {
    if (!cat) return "—";
    if (cat.calcType === "volumetric-tiered") return "Tiered — AED/litre by sugar content";
    return Math.round(cat.rate * 100) + "%";
  }
  function fillRateTable(tbodyId) {
    const el = document.getElementById(tbodyId);
    if (!el) return;
    let rows = VATSIM.EXCISE_CATEGORIES.map((c) => "<tr><td>" + c.label + "</td><td>" + rateLabel(c) + "</td></tr>").join("");
    rows += VATSIM.SWEETENED_TIERS.map((t) => "<tr><td style='padding-left:22px;color:var(--text-muted)'>↳ " + t.label + "</td><td>AED " + t.ratePerLitre.toFixed(2) + " / litre</td></tr>").join("");
    el.innerHTML = rows;
  }

  document.querySelectorAll("[data-static]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      VATSIM.toast("This module is outside the VAT201 training scope of this simulator.", "info");
    })
  );

  /* ======================================================================
     Excise Dashboard (excise.html)
     ====================================================================== */
  if (document.getElementById("notRegisteredWrap")) {
    fillRateTable("rateTableBody");
    fillRateTable("rateTableBody2");

    if (!account.exciseRegistered) {
      document.getElementById("notRegisteredWrap").style.display = "block";
      document.getElementById("registeredWrap").style.display = "none";

      const picker = document.getElementById("categoryPicker");
      VATSIM.EXCISE_CATEGORIES.forEach((c) => {
        const lbl = document.createElement("label");
        lbl.className = "radio-pill";
        lbl.innerHTML = '<input type="checkbox" value="' + c.key + '" /> ' + c.label + " (" + rateLabel(c) + ")";
        picker.appendChild(lbl);
      });

      document.getElementById("btnRegisterExcise").addEventListener("click", () => {
        const picked = Array.from(picker.querySelectorAll("input:checked")).map((i) => i.value);
        if (!picked.length) {
          VATSIM.toast("Select at least one excise goods category to register.", "error");
          return;
        }
        VATSIM.showLoading("Submitting Excise Tax registration to the FTA…", 1000).then(() => {
          VATSIM.registerForExcise(account, picked);
          account = VATSIM.getAccount();
          VATSIM.toast("Excise Tax registration approved. TRN " + account.exciseTrn, "success");
          renderDashboard();
        });
      });
    } else {
      renderDashboard();
    }

    function renderDashboard() {
      document.getElementById("notRegisteredWrap").style.display = "none";
      document.getElementById("registeredWrap").style.display = "block";
      document.getElementById("exciseTrnOut").textContent = account.exciseTrn;
      document.getElementById("exciseRegDateOut").textContent = VATSIM.fmtDate(account.exciseRegistrationDate);

      const filings = VATSIM.getExciseFilings().sort((a, b) => new Date(b.period.from) - new Date(a.period.from));
      const totalPaid = filings.filter((f) => f.payment).reduce((s, f) => s + VATSIM.n(f.payment.amount), 0);
      document.getElementById("exciseTotalPaidOut").textContent = "AED " + VATSIM.fmtAED(totalPaid);

      const body = document.getElementById("exciseFilingsBody");
      body.innerHTML = "";
      filings.forEach((f) => {
        const overdue = f.status !== "Submitted" && new Date(f.period.dueDate) < new Date();
        const statusLabel = f.status === "Submitted" ? "Submitted" : overdue ? "Overdue" : "Draft";
        const dotClass = f.status === "Submitted" ? "submitted" : overdue ? "overdue" : "draft";
        const tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + f.period.label + "</td>" +
          '<td style="color:' + (overdue ? "var(--danger)" : "inherit") + '">' + VATSIM.fmtDate(f.period.dueDate) + "</td>" +
          "<td>" + (f.submittedAt ? VATSIM.fmtDate(f.submittedAt) : "—") + "</td>" +
          "<td>AED " + VATSIM.fmtAED(f.totalExcise || 0) + "</td>" +
          '<td><span class="status-pill"><span class="status-dot ' + dotClass + '"></span> ' + statusLabel + "</td>" +
          "<td></td>";
        const btn = document.createElement("button");
        btn.className = f.status === "Submitted" ? "btn btn-ghost btn-sm" : "btn btn-outline btn-sm";
        btn.textContent = f.status === "Submitted" ? "👁 View" : "📝 File";
        btn.addEventListener("click", () => (window.location.href = "excise-return.html?id=" + encodeURIComponent(f.id)));
        tr.lastElementChild.appendChild(btn);
        body.appendChild(tr);
      });
      if (!filings.length) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-faint);padding:24px">No excise periods yet.</td></tr>';
      }
    }
  }

  /* ======================================================================
     Excise Return Filing (excise-return.html)
     ====================================================================== */
  if (document.getElementById("linesBody")) {
    if (!account.exciseRegistered) {
      VATSIM.toast("Register for Excise Tax before filing a return.", "error");
      setTimeout(() => (window.location.href = "excise.html"), 900);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const filingId = params.get("id");
    let filing = filingId && VATSIM.getExciseFiling(filingId);
    if (!filing) {
      VATSIM.toast("Excise return not found.", "error");
      setTimeout(() => (window.location.href = "excise.html"), 900);
      return;
    }
    const readOnly = filing.status === "Submitted";

    document.getElementById("periodLabel").textContent =
      "Period: " + filing.period.label + " · Due " + VATSIM.fmtDate(filing.period.dueDate) + (readOnly ? " · Submitted" : "");

    const catSelect = document.getElementById("lineCategory");
    catSelect.innerHTML = VATSIM.EXCISE_CATEGORIES.map((c) => '<option value="' + c.key + '">' + c.label + " (" + rateLabel(c) + ")</option>").join("");

    const tierSelect = document.getElementById("sugarTier");
    tierSelect.innerHTML = VATSIM.SWEETENED_TIERS.map((t) => '<option value="' + t.key + '">' + t.label + " — AED " + t.ratePerLitre.toFixed(2) + "/L</option>").join("");

    function syncLineFieldsForCategory() {
      const cat = VATSIM.EXCISE_CATEGORIES.find((c) => c.key === catSelect.value);
      const isSweetened = cat && cat.calcType === "volumetric-tiered";
      document.getElementById("f_sugarTier").style.display = isSweetened ? "block" : "none";
      document.getElementById("lineQtyLabel").textContent = isSweetened ? "Volume (Litres)" : "Quantity (units)";
      document.getElementById("linePriceLabel").textContent = isSweetened ? "Retail Price per Litre (AED, for VAT estimate only)" : "Retail Price per Unit (AED)";
    }
    catSelect.addEventListener("change", syncLineFieldsForCategory);
    syncLineFieldsForCategory();

    function renderLines() {
      const body = document.getElementById("linesBody");
      body.innerHTML = "";
      document.getElementById("emptyLinesHint").style.display = filing.lines.length ? "none" : "block";
      filing.lines.forEach((l, idx) => {
        const cat = VATSIM.EXCISE_CATEGORIES.find((c) => c.key === l.category);
        const isSweetened = cat && cat.calcType === "volumetric-tiered";
        const tier = isSweetened ? VATSIM.SWEETENED_TIERS.find((t) => t.key === l.sugarTier) : null;
        const tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + (cat ? cat.label : l.category) + (tier ? "<br/><span style='font-size:10.5px;color:var(--text-muted)'>" + tier.label + "</span>" : "") + "</td>" +
          "<td>" + l.description + "</td>" +
          "<td>" + VATSIM.n(l.quantity) + (isSweetened ? " L" : "") + "</td>" +
          "<td>" + (isSweetened ? "—" : VATSIM.fmtAED(VATSIM.n(l.unitPrice))) + "</td>" +
          "<td>" + (isSweetened ? "AED " + (tier ? tier.ratePerLitre.toFixed(2) : "0.00") + "/L" : rateLabel(cat)) + "</td>" +
          "<td>" + VATSIM.fmtAED(l.exciseAmount || 0) + "</td>" +
          "<td></td>";
        if (!readOnly) {
          const rm = document.createElement("button");
          rm.className = "btn btn-ghost btn-sm";
          rm.textContent = "✕";
          rm.addEventListener("click", () => {
            filing.lines.splice(idx, 1);
            recalc();
          });
          tr.lastElementChild.appendChild(rm);
        }
        body.appendChild(tr);
      });
    }

    function recalc() {
      const t = VATSIM.computeExciseTotals(filing);
      document.getElementById("sumGoodsValue").textContent = "AED " + VATSIM.fmtAED(t.goodsValue);
      document.getElementById("sumExcise").textContent = "AED " + VATSIM.fmtAED(t.totalExcise);
      document.getElementById("sumVat").textContent = "AED " + VATSIM.fmtAED(t.vatOnExcise);
      renderLines();
    }
    recalc();

    if (readOnly) {
      document.getElementById("btnAddLine").style.display = "none";
      document.getElementById("declareCheck").checked = true;
      document.getElementById("declareCheck").disabled = true;
      document.querySelector(".wizard-footer").style.display = "none";
    }

    /* ---- Add line modal ---- */
    const modal = document.getElementById("lineModal");
    document.getElementById("btnAddLine").addEventListener("click", () => {
      syncLineFieldsForCategory();
      modal.classList.add("open");
    });
    document.getElementById("closeLineModal").addEventListener("click", () => modal.classList.remove("open"));
    document.getElementById("cancelLine").addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });

    document.getElementById("saveLine").addEventListener("click", () => {
      const category = catSelect.value;
      const desc = document.getElementById("lineDesc").value.trim();
      const qty = parseFloat(document.getElementById("lineQty").value);
      const price = parseFloat(document.getElementById("linePrice").value);

      const descOk = !!desc;
      const qtyOk = !isNaN(qty) && qty > 0;
      const priceOk = !isNaN(price) && price > 0;
      document.getElementById("f_lineDesc").classList.toggle("invalid", !descOk);
      document.getElementById("f_lineQty").classList.toggle("invalid", !qtyOk);
      document.getElementById("f_linePrice").classList.toggle("invalid", !priceOk);
      if (!descOk || !qtyOk || !priceOk) {
        VATSIM.toast("Please complete this goods line correctly.", "error");
        return;
      }
      filing.lines.push({ category, description: desc, quantity: qty, unitPrice: price, sugarTier: tierSelect.value });
      recalc();
      document.getElementById("lineDesc").value = "";
      document.getElementById("lineQty").value = "";
      document.getElementById("linePrice").value = "";
      modal.classList.remove("open");
    });

    /* ---- Save draft ---- */
    document.getElementById("btnSaveDraft").addEventListener("click", () => {
      VATSIM.upsertExciseFiling(filing);
      VATSIM.toast("Draft saved.", "success");
    });

    /* ---- Submit & Pay ---- */
    document.getElementById("btnSubmitPay").addEventListener("click", () => {
      if (!filing.lines.length) {
        VATSIM.toast("Add at least one excise goods line before submitting.", "error");
        return;
      }
      if (!document.getElementById("declareCheck").checked) {
        VATSIM.toast("Please confirm the declaration before submitting.", "error");
        return;
      }
      VATSIM.showLoading("Submitting Excise Tax return and processing payment…", 1200).then(() => {
        const t = VATSIM.computeExciseTotals(filing);
        filing.totalExcise = t.totalExcise;
        filing.vatOnExcise = t.vatOnExcise;
        filing.status = "Submitted";
        filing.referenceNumber = "DEMO-EXREF-" + String(Math.floor(100000000 + Math.random() * 899999999));
        filing.submittedAt = new Date().toISOString();
        filing.payment = {
          ref: "EXPAY-" + Math.floor(100000 + Math.random() * 899999),
          date: VATSIM.todayISO(),
          amount: t.totalExcise,
          status: "Paid",
        };
        VATSIM.upsertExciseFiling(filing);
        VATSIM.logActivity("Excise Tax", "Filed " + filing.period.label + " return, Ref. " + filing.referenceNumber + " — AED " + VATSIM.fmtAED(t.totalExcise) + " paid.");
        VATSIM.addMessage({
          folder: "inbox", category: "FTA Notice",
          subject: "Excise Tax Return Acknowledged — Ref. " + filing.referenceNumber,
          from: "Federal Tax Authority", to: account.email,
          date: new Date().toISOString(), read: false,
          body:
            "Dear " + account.firstNameEn + ",\n\nWe acknowledge receipt of your Excise Tax return for " + filing.period.label +
            ", reference number " + filing.referenceNumber + ". Excise tax of AED " + VATSIM.fmtAED(t.totalExcise) +
            " has been received.",
          relatedFilingId: filing.id,
        });

        document.getElementById("receiptRef").textContent = filing.referenceNumber;
        document.getElementById("receiptAmt").textContent = "AED " + VATSIM.fmtAED(t.totalExcise);
        document.getElementById("receiptModal").classList.add("open");
      });
    });

    document.getElementById("btnDownloadExcisePdf").addEventListener("click", () => {
      VATSIM.showLoading("Preparing receipt PDF…", 600).then(() => {
        const rows = [
          ["Excise TRN", account.exciseTrn],
          ["Reference Number", filing.referenceNumber],
          ["Period", filing.period.label],
          ["Due Date", VATSIM.fmtDate(filing.period.dueDate)],
          ["Submitted", VATSIM.fmtDate(filing.submittedAt)],
          ["Total Goods Value", "AED " + VATSIM.fmtAED(VATSIM.computeExciseTotals(filing).goodsValue)],
          ["Total Excise Tax Paid", "AED " + VATSIM.fmtAED(filing.totalExcise)],
          ["Estimated VAT Impact (informational)", "AED " + VATSIM.fmtAED(filing.vatOnExcise)],
          ["Payment Reference", filing.payment.ref],
          ["Payment Status", filing.payment.status],
        ];
        const ok = VATSIM.generatePdf({
          title: "Excise Tax Return — Acknowledgement Receipt (Form EX201)",
          rows,
          filename: "Excise_Acknowledgement_" + filing.referenceNumber + ".pdf",
        });
        if (ok) VATSIM.toast("Receipt PDF downloaded.", "success");
      });
    });
    document.getElementById("closeReceipt").addEventListener("click", () => (window.location.href = "excise.html"));
    document.getElementById("btnBackToExcise").addEventListener("click", () => (window.location.href = "excise.html"));
  }
})();
