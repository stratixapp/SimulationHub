/* ==========================================================================
   payment.js — Screens 12-13: Payment & Payment Confirmation
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
  const payType = params.get("type") === "penalty" ? "penalty" : "vat";

  /* ---------------- Payment screen ---------------- */
  if (document.getElementById("btnPayNow")) {
    const filing = filingId && VATSIM.getFiling(filingId);
    if (!filing || filing.status !== "Submitted") {
      VATSIM.toast("Submit the return before making a payment.", "error");
      setTimeout(() => (window.location.href = "filings.html"), 900);
      return;
    }
    let payAmount;
    if (payType === "penalty") {
      const penalty = VATSIM.computeFilingPenalty(filing, VATSIM.getFilings());
      if (penalty.total <= 0 || (filing.penaltyPayment && filing.penaltyPayment.status === "Paid")) {
        VATSIM.toast("No outstanding penalty for this return.", "info");
        setTimeout(() => (window.location.href = "liabilities.html"), 900);
        return;
      }
      payAmount = penalty.total;
      document.getElementById("payAmountLabel").textContent = "Administrative Penalty Due";
      document.getElementById("payRefLine").innerHTML = "For VAT Return Reference: <span id=\"payRef\">" + filing.referenceNumber + "</span>";
      document.getElementById("payAmount").textContent = "AED " + VATSIM.fmtAED(payAmount);
    } else {
      const t = VATSIM.computeTotals(filing.boxes);
      if (t.isRefund || t.box14 <= 0) {
        VATSIM.toast("No payable amount for this return.", "info");
      }
      payAmount = Math.abs(t.box14);
      document.getElementById("payAmount").textContent = "AED " + VATSIM.fmtAED(payAmount);
      document.getElementById("payRef").textContent = filing.referenceNumber;
    }

    document.querySelectorAll('.card-link').forEach((card) => {
      const radio = card.querySelector('input[type=radio]');
      if (!radio) return;
      const sync = () => card.style.borderColor = radio.checked ? 'var(--gold-500)' : 'var(--border)';
      radio.addEventListener('change', () => {
        document.querySelectorAll('input[name=payMethod]').forEach(r => r.closest('.card-link').style.borderColor = 'var(--border)');
        sync();
        renderMethodDetail();
      });
      sync();
    });

    const giban = "AE" + String(Math.floor(1e8 + Math.random() * 8.9e8)) + "TAX" + account.trn.slice(-6);
    function renderMethodDetail() {
      const method = document.querySelector('input[name="payMethod"]:checked').value;
      const detail = document.getElementById("methodDetail");
      if (method === "MagnatiPay") {
        detail.innerHTML =
          '<div style="font-size:11.5px;color:var(--text-faint);margin-bottom:10px">MagnatiPay — demo card entry only. No real card is charged. A service charge of ~0.68% of the transaction applies on the real gateway. Any card number works; occasionally a payment is randomly declined so you can practice the retry flow — or use <code>4000 0000 0000 0002</code> to trigger a decline on demand.</div>' +
          '<div class="two-col"><div class="field"><label for="cardNumber">Card Number (demo)</label><input type="text" id="cardNumber" placeholder="4111 1111 1111 1111" maxlength="19" /></div>' +
          '<div class="field"><label for="cardName">Name on Card</label><input type="text" id="cardName" placeholder="' + account.firstNameEn + ' ' + account.lastNameEn + '" /></div></div>' +
          '<div class="two-col"><div class="field"><label for="cardExpiry">Expiry (MM/YY)</label><input type="text" id="cardExpiry" placeholder="MM/YY" maxlength="5" /></div>' +
          '<div class="field"><label for="cardCvv">CVV</label><input type="password" id="cardCvv" placeholder="•••" maxlength="4" /></div></div>';
      } else if (method === "GIBAN") {
        detail.innerHTML =
          '<div class="info-banner" style="margin-bottom:0">' +
          '<strong>Your VAT GIBAN (training-only):</strong> ' + giban + '<br/>' +
          'A GIBAN is a unique bank account number the FTA generates for each taxable person — one for VAT, a separate one for Excise Tax. ' +
          'Add it as a beneficiary in your online banking and transfer the exact amount due, including the payment reference shown above. ' +
          'Real transfers can take up to 24 hours to reflect; this is training-only banking information, no real transfer happens here.' +
          "</div>";
      } else if (method === "eDebit") {
        detail.innerHTML =
          '<div class="info-banner" style="margin-bottom:0">' +
          'eDebit redirects to your bank\'s own online banking login to pull the payment directly from your linked account (simulated — you will not be asked for real bank credentials here). ' +
          'A fixed fee of AED 10 applies per transaction. For corporate accounts with multiple signatories, the payment stays "Pending" until every signatory approves — usually within 3 business days.' +
          "</div>";
      }
    }
    renderMethodDetail();

    /* ---------------- Animated payment processing ----------------
       A staged, gateway-style animation (card shimmer + a ticking
       checklist) instead of a single generic spinner — each payment
       method gets its own realistic sequence of stages. */
    const PAY_STAGES = {
      MagnatiPay: [
        "Connecting to MagnatiPay Gateway…",
        "Validating card details…",
        "Authorizing with issuing bank…",
        "Payment confirmed.",
      ],
      GIBAN: [
        "Verifying GIBAN transfer reference…",
        "Matching incoming funds…",
        "Reconciling with FTA ledger…",
        "Payment confirmed.",
      ],
      eDebit: [
        "Redirecting to bank login (simulated)…",
        "Authorizing direct debit…",
        "Confirming with linked account…",
        "Payment confirmed.",
      ],
    };
    // Real card gateways decline a small share of legitimate attempts
    // (issuer risk rules, insufficient funds, etc.) — training students
    // only on the always-succeeds path leaves them unprepared for the
    // single most common real-world payment hiccup: what to do when a
    // card is declined and you have to retry. ~10% of MagnatiPay
    // attempts on a fresh (never-yet-declined) reference simulate this.
    // A magic test number (4000 0000 0000 0002 — the same "always
    // declines" convention Stripe/other gateways use for testing) always
    // declines, so instructors can demo the retry flow on demand instead
    // of waiting on chance. GIBAN/eDebit aren't card rails, so they're
    // not modeled as declinable here.
    const DECLINE_REASONS = [
      "Insufficient funds. Try a different card or payment method.",
      "Card declined by issuing bank. Contact your bank or try another card.",
      "Card verification failed. Check the card number, expiry, and CVV and try again.",
    ];
    let declineAttempted = false;
    function runPaymentAnimation(method, willDecline) {
      const modal = document.getElementById("payProcessModal");
      const list = document.getElementById("payStageList");
      const title = document.getElementById("payProcessTitle");
      const gatewayLabel = document.getElementById("payGatewayLabel");
      const cardVisual = document.getElementById("payCardVisual");
      const stages = PAY_STAGES[method] || PAY_STAGES.MagnatiPay;
      gatewayLabel.textContent = method;
      title.textContent = "Processing Payment…";
      cardVisual.style.boxShadow = "0 10px 24px rgba(12,31,56,.28)";
      list.innerHTML = stages
        .map((s, i) => '<div class="pay-stage-row" id="payStage' + i + '"><span class="ic">◻</span><span class="txt">' + s + "</span></div>")
        .join("");
      document.getElementById("payCardScan").style.animation = "card-scan 1.1s linear infinite";
      modal.classList.add("open");
      return new Promise((resolve, reject) => {
        let i = 0;
        // A card decline is caught at the bank-authorization stage, not
        // the last stage — that's where a real gateway would find out.
        const declineAtIndex = method === "MagnatiPay" ? stages.length - 2 : -1;
        function nextStage() {
          if (i > 0) {
            const prev = document.getElementById("payStage" + (i - 1));
            prev.classList.remove("active");
            prev.classList.add("done");
            prev.querySelector(".ic").textContent = "✅";
          }
          if (willDecline && i === declineAtIndex + 1) {
            const failRow = document.getElementById("payStage" + declineAtIndex);
            failRow.classList.remove("active");
            failRow.classList.add("declined");
            failRow.querySelector(".ic").textContent = "❌";
            document.getElementById("payCardScan").style.animation = "none";
            cardVisual.style.boxShadow = "0 0 0 4px rgba(196,58,58,0.35), 0 10px 24px rgba(12,31,56,.28)";
            title.textContent = "✕ Payment Declined";
            setTimeout(() => reject(DECLINE_REASONS[Math.floor(Math.random() * DECLINE_REASONS.length)]), 700);
            return;
          }
          if (i >= stages.length) {
            document.getElementById("payCardScan").style.animation = "none";
            title.textContent = "✅ Payment Successful";
            cardVisual.style.boxShadow = "0 0 0 4px rgba(13,138,81,0.35), 0 10px 24px rgba(12,31,56,.28)";
            setTimeout(resolve, 700);
            return;
          }
          const row = document.getElementById("payStage" + i);
          row.classList.add("active");
          row.querySelector(".ic").textContent = "⏳";
          i++;
          setTimeout(nextStage, 750);
        }
        nextStage();
      });
    }

    document.getElementById("btnPayNow").addEventListener("click", () => {
      const method = document.querySelector('input[name="payMethod"]:checked').value;
      let willDecline = false;
      if (method === "MagnatiPay") {
        const num = (document.getElementById("cardNumber").value || "").replace(/\s/g, "");
        const expiry = document.getElementById("cardExpiry").value || "";
        const cvv = document.getElementById("cardCvv").value || "";
        if (!/^\d{13,19}$/.test(num) || !/^\d{2}\/\d{2}$/.test(expiry) || !/^\d{3,4}$/.test(cvv)) {
          VATSIM.toast("Enter a valid demo card number, expiry (MM/YY), and CVV.", "error");
          return;
        }
        willDecline = num === "4000000000000002" || (!declineAttempted && Math.random() < 0.1);
      }
      document.getElementById("btnPayNow").disabled = true;
      runPaymentAnimation(method, willDecline)
        .then(() => {
          const record = {
            method,
            ref: "DEMO-PAY-" + Math.floor(100000 + Math.random() * 899999),
            date: VATSIM.todayISO(),
            amount: payAmount,
            status: method === "GIBAN" ? "Processing" : "Paid",
          };
          if (method === "GIBAN") record.settleAt = Date.now() + 20000; // ~20s stands in for real T+1 settlement
          if (payType === "penalty") {
            filing.penaltyPayment = record;
          } else {
            filing.payment = record;
          }
          VATSIM.upsertFiling(filing);
          if (payType !== "penalty") VATSIM.addPaymentCorrespondence(account, filing);
          window.location.href = "payment-confirmation.html?id=" + encodeURIComponent(filing.id) + (payType === "penalty" ? "&type=penalty" : "");
        })
        .catch((reason) => {
          declineAttempted = true;
          document.getElementById("payProcessModal").classList.remove("open");
          document.getElementById("btnPayNow").disabled = false;
          VATSIM.toast("✕ " + reason, "error");
        });
    });
  }

  /* ---------------- Payment confirmation screen ---------------- */
  if (document.getElementById("cRef")) {
    const filing = filingId && VATSIM.getFiling(filingId);
    const record = payType === "penalty" ? filing && filing.penaltyPayment : filing && filing.payment;
    if (!filing || !record) {
      VATSIM.toast("No payment record found.", "error");
      setTimeout(() => (window.location.href = "filings.html"), 900);
      return;
    }
    if (payType === "penalty") {
      document.getElementById("cTitle").textContent = "Penalty Payment Successful";
      document.getElementById("cPills").innerHTML =
        '<span class="status-pill"><span class="status-dot submitted"></span> VAT Return Filed</span>' +
        '<span class="status-pill"><span class="status-dot submitted"></span> Penalty Paid</span>';
    }
    if (record.method === "GIBAN" && record.status === "Processing") {
      document.getElementById("cTitle").textContent = "Payment Initiated";
      const banner = document.createElement("div");
      banner.className = "info-banner";
      banner.style.cssText = "text-align:left;max-width:420px;margin:14px auto 0";
      banner.id = "gibanSettleBanner";
      banner.innerHTML =
        "⏳ Your GIBAN transfer is <strong>processing</strong> — real bank transfers to the FTA typically settle within 1 business day; this is fast-forwarded here so you can watch it happen.";
      document.querySelector(".success-icon").insertAdjacentElement("afterend", banner);
      const check = setInterval(() => {
        if (VATSIM.isPaymentSettled(record)) {
          clearInterval(check);
          record.status = "Paid";
          if (payType === "penalty") filing.penaltyPayment = record;
          else filing.payment = record;
          VATSIM.upsertFiling(filing);
          banner.innerHTML = "✅ Your GIBAN transfer has <strong>settled</strong> — payment is now marked Paid.";
          banner.style.color = "";
          document.getElementById("cTitle").textContent = payType === "penalty" ? "Penalty Payment Successful" : "Payment Successful";
        }
      }, 2000);
    }
    document.getElementById("cRef").textContent = record.ref;
    document.getElementById("cDate").textContent = VATSIM.fmtDate(record.date);
    document.getElementById("cMethod").textContent = record.method;
    document.getElementById("cAmount").textContent = "AED " + VATSIM.fmtAED(record.amount);

    document.getElementById("btnDownloadReceipt").addEventListener("click", () => {
      VATSIM.showLoading("Preparing payment receipt PDF…", 600).then(() => {
        const ok = VATSIM.generatePdf({
          title: payType === "penalty" ? "Administrative Penalty — Payment Receipt" : "Payment Receipt",
          subtitle: "TRN " + account.trn + " — " + account.companyName,
          rows: [
            ["Payment Reference", record.ref],
            ["VAT Return Reference", filing.referenceNumber],
            ["VAT Return Period", VATSIM.fmtDate(filing.period.from) + "  –  " + VATSIM.fmtDate(filing.period.to)],
            ["Payment Date", VATSIM.fmtDate(record.date)],
            ["Payment Method", record.method],
            [payType === "penalty" ? "Penalty Amount Paid" : "Paid Amount", "AED " + VATSIM.fmtAED(record.amount)],
            ["Status", record.status],
          ],
          filename: (payType === "penalty" ? "Penalty_Receipt_" : "Payment_Receipt_") + record.ref + ".pdf",
        });
        if (ok) VATSIM.toast("Payment receipt PDF downloaded.", "success");
      });
    });
  }
})();
