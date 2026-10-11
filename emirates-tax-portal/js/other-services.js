/* ==========================================================================
   other-services.js — Other Services module
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

  const SERVICES = [
    {
      id: "reg-status", icon: "📝", title: "VAT Registration", desc: "View your current VAT registration status.",
      type: "info",
      body: () =>
        "<p>Your business is already registered for VAT.</p>" +
        '<div class="review-grid"><div class="review-item"><div class="k">TRN</div><div class="v">' + account.trn + '</div></div>' +
        '<div class="review-item"><div class="k">Status</div><div class="v">' + account.registrationStatus + '</div></div>' +
        '<div class="review-item"><div class="k">Registered Since</div><div class="v">' + VATSIM.fmtDate(account.registrationDate) + "</div></div></div>",
    },
    {
      id: "deregister", icon: "🚫", title: "VAT Deregistration", desc: "Apply to cancel your VAT registration.",
      type: "request", refPrefix: "DEREG",
      confirmText: "Submit a VAT deregistration application for " + "TRN " + (account.trn || "") + "? This is a training simulation only.",
      successText: "Deregistration application submitted for review. This does not affect your training account — you can keep filing practice returns.",
    },
    {
      id: "emirates-id-gen", icon: "🪪", title: "Emirates ID Generator", desc: "Generate a realistically-formatted training Emirates ID number.",
      type: "eid-gen",
    },
    {
      id: "trn-verify", icon: "🔎", title: "TRN Verification", desc: "Verify whether a TRN is registered for VAT.",
      type: "trn",
    },
    {
      id: "tax-invoice", icon: "🧾", title: "Tax Invoice / Credit Note Generator", desc: "Generate a compliant-format UAE tax invoice or credit note.",
      type: "link", target: "invoice-generator.html",
    },
    {
      id: "tax-cert", icon: "📜", title: "Tax Registration Certificate", desc: "Download your simulated Tax Registration Certificate.",
      type: "certificate",
    },
    {
      id: "tax-group", icon: "🏢", title: "Tax Group", desc: "Manage or apply for VAT Tax Group registration.",
      type: "request", refPrefix: "TXGRP",
      confirmText: "Submit a request to form/join a Tax Group under TRN " + (account.trn || "") + "?",
      successText: "Tax Group request submitted for review.",
    },
    {
      id: "refund", icon: "💰", title: "Refund Requests", desc: "Request a refund of excess recoverable VAT.",
      type: "request", refPrefix: "REFUND",
      confirmText: "Submit a VAT refund request for this account?",
      successText: "Refund request submitted. You'll be notified in My Correspondence once it's reviewed.",
    },
    {
      id: "penalty-calc", icon: "🧮", title: "Penalty Calculator", desc: "Estimate FTA administrative penalties for late registration, filing, or payment.",
      type: "penalty-calc",
    },
    {
      id: "penalty", icon: "⚖️", title: "Penalty Waiver", desc: "Request waiver or reduction of an administrative penalty.",
      type: "request", refPrefix: "PWR",
      confirmText: "Submit a penalty waiver request?",
      successText: "Penalty waiver request submitted for review.",
    },
    {
      id: "vdisc", icon: "🧮", title: "Voluntary Disclosure", desc: "Correct an error in a previously submitted return (Form VAT211).",
      type: "link", target: "voluntary-disclosure.html",
    },
    {
      id: "biz-details", icon: "🏬", title: "Change Business Details", desc: "Update your registered company information.",
      type: "link", target: "profile.html",
    },
    {
      id: "bank", icon: "🏦", title: "Bank Account Update", desc: "Update the bank account linked for VAT refunds.",
      type: "request", refPrefix: "BANK",
      confirmText: "Submit a bank account update request?",
      successText: "Bank account update request submitted for review.",
    },
    {
      id: "doc-verify", icon: "📄", title: "Document Verification", desc: "Verify the authenticity of an issued FTA document.",
      type: "request", refPrefix: "DOCV",
      confirmText: "Submit a document verification request?",
      successText: "Document verification request submitted. Result will appear in My Correspondence.",
    },
    {
      id: "cert-downloads", icon: "⬇️", title: "Certificate Downloads", desc: "Download previously issued certificates.",
      type: "info",
      body: () => "<p>No additional certificates have been issued yet. Once issued (e.g. a Tax Registration Certificate), they'll be listed here for download.</p>",
    },
  ];

  const grid = document.getElementById("servicesGrid");
  SERVICES.forEach((s) => {
    const card = document.createElement("div");
    card.className = "card-link";
    card.innerHTML =
      "<div><h4>" + s.title + "</h4><p>" + s.desc + '</p><span class="service-badge">Simulator Only</span></div><div class="ic">' + s.icon + "</div>";
    card.addEventListener("click", () => openService(s));
    grid.appendChild(card);
  });

  const modal = document.getElementById("serviceModal");
  function closeModal() { modal.classList.remove("open"); }
  document.getElementById("svcClose").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  function openService(s) {
    document.getElementById("svcTitle").textContent = s.title;
    const body = document.getElementById("svcBody");
    const footer = document.getElementById("svcFooter");
    footer.innerHTML = "";

    if (s.type === "penalty-calc") {
      body.innerHTML =
        '<div class="info-banner">Based on Cabinet Decision No. 129 of 2025 (in force from 14 April 2026): AED 10,000 fixed late-registration penalty; AED 1,000 / AED 2,000 late-filing penalty (first / repeat within 24 months); and a flat 14% per annum late-payment penalty calculated monthly on the unpaid balance, replacing the earlier 2% + 4% compounding system. Figures are illustrative — always confirm current amounts on the real FTA portal.</div>' +
        '<div class="field"><label>What would you like to estimate?</label>' +
        '<div class="radio-pill-group">' +
        '<label class="radio-pill"><input type="radio" name="pcType" value="registration" checked /> Late Registration</label>' +
        '<label class="radio-pill"><input type="radio" name="pcType" value="filing" /> Late Filing</label>' +
        '<label class="radio-pill"><input type="radio" name="pcType" value="payment" /> Late Payment</label>' +
        "</div></div>" +
        '<div id="pcFilingOpts" style="display:none" class="field"><label>Is this a repeat late filing within the last 24 months?</label>' +
        '<div class="radio-pill-group"><label class="radio-pill"><input type="radio" name="pcRepeat" value="no" checked /> No — first offence</label><label class="radio-pill"><input type="radio" name="pcRepeat" value="yes" /> Yes — repeat</label></div></div>' +
        '<div id="pcPaymentOpts" style="display:none">' +
        '<div class="field"><label for="pcAmount">Unpaid VAT Amount (AED)</label><input type="text" inputmode="decimal" id="pcAmount" placeholder="e.g. 25000" /></div>' +
        '<div class="field"><label for="pcDays">Days Late</label><input type="text" inputmode="numeric" id="pcDays" placeholder="e.g. 45" /></div>' +
        "</div>" +
        '<div id="pcResult" style="margin-top:10px;font-size:13px"></div>';

      const typeRadios = body.querySelectorAll('input[name="pcType"]');
      function syncPcVisibility() {
        const v = body.querySelector('input[name="pcType"]:checked').value;
        body.querySelector("#pcFilingOpts").style.display = v === "filing" ? "block" : "none";
        body.querySelector("#pcPaymentOpts").style.display = v === "payment" ? "block" : "none";
        body.querySelector("#pcResult").innerHTML = "";
      }
      typeRadios.forEach((r) => r.addEventListener("change", syncPcVisibility));
      syncPcVisibility();

      const calcBtn = document.createElement("button");
      calcBtn.className = "btn btn-gold";
      calcBtn.textContent = "Calculate";
      calcBtn.addEventListener("click", () => {
        const v = body.querySelector('input[name="pcType"]:checked').value;
        const resultEl = body.querySelector("#pcResult");
        if (v === "registration") {
          resultEl.innerHTML = '<div class="review-item"><div class="k">Estimated Penalty</div><div class="v" style="font-size:16px;color:var(--danger)">AED 10,000.00</div></div><p style="font-size:11.5px;color:var(--text-faint);margin-top:6px">Fixed penalty for failing to register within 30 days of exceeding the mandatory threshold.</p>';
        } else if (v === "filing") {
          const repeat = body.querySelector('input[name="pcRepeat"]:checked').value === "yes";
          const amt = repeat ? 2000 : 1000;
          resultEl.innerHTML = '<div class="review-item"><div class="k">Estimated Penalty</div><div class="v" style="font-size:16px;color:var(--danger)">AED ' + VATSIM.fmtAED(amt) + '</div></div><p style="font-size:11.5px;color:var(--text-faint);margin-top:6px">Applies even if the return shows zero VAT due, and stacks separately from any late-payment penalty.</p>';
        } else {
          const amount = parseFloat(document.getElementById("pcAmount").value);
          const days = parseFloat(document.getElementById("pcDays").value);
          if (isNaN(amount) || amount <= 0 || isNaN(days) || days <= 0) {
            resultEl.innerHTML = '<p style="color:var(--danger);font-size:12.5px">Enter a valid unpaid amount and number of days late.</p>';
            return;
          }
          const monthsLate = Math.ceil(days / 30);
          const penalty = VATSIM.round2(amount * 0.14 * (monthsLate / 12));
          resultEl.innerHTML =
            '<div class="review-item"><div class="k">Months Late (rounded up)</div><div class="v">' + monthsLate + '</div></div>' +
            '<div class="review-item" style="margin-top:8px"><div class="k">Estimated Late-Payment Penalty</div><div class="v" style="font-size:16px;color:var(--danger)">AED ' + VATSIM.fmtAED(penalty) + '</div></div>' +
            '<p style="font-size:11.5px;color:var(--text-faint);margin-top:6px">Calculated at 14% per annum (≈1.17% per month or part month) on the unpaid balance.</p>';
        }
      });
      footer.appendChild(calcBtn);
      modal.classList.add("open");
      return;
    }

    if (s.type === "link") {
      window.location.href = s.target;
      return;
    }

    if (s.type === "info") {
      body.innerHTML = s.body();
      const okBtn = document.createElement("button");
      okBtn.className = "btn btn-gold";
      okBtn.textContent = "Close";
      okBtn.addEventListener("click", closeModal);
      footer.appendChild(okBtn);
      modal.classList.add("open");
      return;
    }

    if (s.type === "eid-gen") {
      body.innerHTML =
        '<p style="font-size:12.5px;color:var(--text-muted)">Generates a realistically-formatted UAE Emirates ID number (784-YYYY-XXXXXXX-C) for training use — e.g. for an authorized signatory or invited user.</p>' +
        '<div id="eidOut" style="text-align:center;font-size:20px;font-weight:800;letter-spacing:1px;color:var(--navy-900);margin:16px 0;padding:16px;background:var(--bg);border-radius:8px">—</div>';
      function doGenerate() {
        body.querySelector("#eidOut").textContent = VATSIM.generateEmiratesId();
      }
      const genBtn = document.createElement("button");
      genBtn.className = "btn btn-gold";
      genBtn.textContent = "🎲 Generate";
      genBtn.addEventListener("click", doGenerate);
      footer.appendChild(genBtn);
      doGenerate();
      modal.classList.add("open");
      return;
    }

    if (s.type === "trn") {
      body.innerHTML =
        '<div class="field"><label for="trnInput">Enter a 15-digit TRN to verify</label><input type="text" id="trnInput" maxlength="15" placeholder="e.g. ' + account.trn + '" /></div>' +
        '<div id="trnResult" style="margin-top:10px;font-size:12.5px"></div>';
      const verifyBtn = document.createElement("button");
      verifyBtn.className = "btn btn-gold";
      verifyBtn.textContent = "Verify";
      verifyBtn.addEventListener("click", () => {
        const val = document.getElementById("trnInput").value.trim();
        const result = document.getElementById("trnResult");
        if (!/^\d{15}$/.test(val)) {
          result.innerHTML = '<span style="color:var(--danger)">✕ Invalid TRN format — a TRN must be exactly 15 digits.</span>';
        } else if (val === account.trn) {
          result.innerHTML = '<span style="color:var(--success)">✓ Valid — registered to <strong>' + account.companyName + "</strong> (Status: " + account.registrationStatus + ").</span>";
        } else {
          result.innerHTML = '<span style="color:var(--danger)">✕ No matching registration found in this simulator\'s records.</span>';
        }
      });
      footer.appendChild(verifyBtn);
      modal.classList.add("open");
      return;
    }

    if (s.type === "certificate") {
      body.innerHTML =
        "<p style='font-size:12.5px;color:var(--text-muted)'>This will generate a simulated Tax Registration Certificate for training purposes, based on your registration details.</p>";
      const dlBtn = document.createElement("button");
      dlBtn.className = "btn btn-gold";
      dlBtn.textContent = "⬇ Download Certificate";
      dlBtn.addEventListener("click", () => {
        VATSIM.showLoading("Preparing certificate PDF…", 600).then(() => {
          const ok = downloadCertificate();
          if (ok) {
            VATSIM.logActivity("Other Services", "Downloaded Tax Registration Certificate.");
            VATSIM.toast("Certificate PDF downloaded.", "success");
          }
          closeModal();
        });
      });
      footer.appendChild(dlBtn);
      modal.classList.add("open");
      return;
    }

    if (s.type === "request") {
      body.innerHTML = "<p style='font-size:12.5px;color:var(--text-muted)'>" + s.confirmText + "</p>";
      const submitBtn = document.createElement("button");
      submitBtn.className = "btn btn-gold";
      submitBtn.textContent = "Submit Request";
      submitBtn.addEventListener("click", () => {
        const ref = s.refPrefix + "-" + Math.floor(100000 + Math.random() * 899999);
        VATSIM.logActivity("Other Services", s.title + " request submitted — Ref. " + ref + ".");
        VATSIM.addMessage({
          folder: "inbox", category: "FTA Notice",
          subject: s.title + " Request Received — Ref. " + ref,
          from: "Federal Tax Authority", to: account.email,
          date: new Date().toISOString(), read: false,
          body: "Dear " + account.firstNameEn + ",\n\n" + s.successText + "\n\nReference Number: " + ref + "\nStatus: Under Review (simulated)",
        });
        VATSIM.toast(s.successText + " Ref. " + ref, "success");
        closeModal();
      });
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "btn btn-outline";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", closeModal);
      footer.appendChild(cancelBtn);
      footer.appendChild(submitBtn);
      modal.classList.add("open");
      return;
    }
  }

  function downloadCertificate() {
    const ok = VATSIM.generatePdf({
      title: "Tax Registration Certificate",
      subtitle: "Certificate No: CERT-" + account.trn + " · Issued " + VATSIM.fmtDate(VATSIM.todayISO()),
      rows: [
        ["Legal Name", account.companyName],
        ["Tax Registration Number (TRN)", account.trn],
        ["Registration Date", VATSIM.fmtDate(account.registrationDate)],
        ["Registration Type", account.registrationType || "—"],
        ["Business Activity", account.businessActivity],
        ["Registered Address", account.address],
      ],
      bodyParas: [
        "This is to certify that the entity named above is registered for Value Added Tax under UAE Federal Decree-Law No. (8) of 2017 on Value Added Tax.",
      ],
      filename: "Tax_Registration_Certificate_" + account.trn + ".pdf",
    });
    return ok;
  }
})();
