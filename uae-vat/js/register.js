/* ==========================================================================
   register.js — Multi-step VAT Registration wizard (EmaraTax-style)
   Created By Ananthu Shaji
   ========================================================================== */

(function () {
  "use strict";

  VATSIM.applyTextScale();
  document.querySelectorAll("[data-textsize]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = VATSIM.getSettings();
      const dir = btn.getAttribute("data-textsize");
      if (dir === "up") s.textScale = Math.min(1.3, (s.textScale || 1) + 0.1);
      else if (dir === "down") s.textScale = Math.max(0.85, (s.textScale || 1) - 0.1);
      else s.textScale = 1;
      VATSIM.saveSettings(s);
      VATSIM.applyTextScale();
    });
  });

  // Multi-student: register.html always creates a brand new, isolated
  // student profile — it never blocks on an existing active account,
  // since a lab machine may have several students sharing it.

  const TOTAL_STEPS = 7;
  let step = 1;
  const app = {}; // accumulated application data

  // Some business activities need approval from another government body
  // before a trade license (and therefore VAT registration) can proceed
  // — this is real, e.g. DHA/MOH for healthcare, KHDA/MOE for education,
  // RERA for real estate brokerage, Central Bank for financial services
  // and insurance, Ministry of Justice for legal consultancy. It's shown
  // as an informational note here, not a hard gate — this simulator has
  // no other authority to actually route the approval through.
  const ACTIVITY_APPROVALS = {
    "Financial Services": "Central Bank of the UAE",
    "Insurance": "Central Bank of the UAE (Insurance Authority)",
    "Legal Consultancy": "Ministry of Justice",
    "Healthcare / Medical Services": "Dubai Health Authority / Ministry of Health & Prevention",
    "Education / Training Institute": "Knowledge and Human Development Authority (KHDA) / Ministry of Education",
    "Real Estate Brokerage": "Real Estate Regulatory Agency (RERA) / Dubai Land Department",
  };
  document.getElementById("inActivity").addEventListener("change", (e) => {
    const banner = document.getElementById("activityApprovalBanner");
    const authority = ACTIVITY_APPROVALS[e.target.value];
    if (authority) {
      banner.style.display = "block";
      banner.innerHTML = "⚠ In real life, a <strong>" + e.target.value + "</strong> trade license needs additional approval from the <strong>" + authority + "</strong> before it's issued — separate from this VAT registration, and not something this simulator models. This training flow will let you continue regardless.";
    } else {
      banner.style.display = "none";
    }
  });

  /* ---------------- Supporting document (trade license) ----------------
     Stored as { dataUrl, mime, name } so an uploaded PDF (including a
     student's own downloaded Emirates ID / UAE PASS Digital ID PDF) can
     be told apart from an image and previewed appropriately — a PDF data
     URL can't be dropped straight into an <img> tag. */
  let tradeLicenseDoc = null;
  function setDocPreview(doc) {
    tradeLicenseDoc = doc;
    const img = document.getElementById("docPreview");
    const pdfPreview = document.getElementById("docPreviewPdf");
    if (doc.mime === "pdf") {
      img.style.display = "none";
      pdfPreview.style.display = "flex";
      document.getElementById("docPreviewPdfName").textContent = doc.name || "document.pdf";
    } else {
      pdfPreview.style.display = "none";
      img.style.display = "block";
      img.src = doc.dataUrl;
    }
    document.getElementById("docPreviewWrap").style.display = "block";
    document.getElementById("docUploadStatus").textContent = "";
  }
  document.getElementById("inDocUpload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    if (isPdf) {
      if (file.size > 8 * 1024 * 1024) {
        VATSIM.toast("That file is too large — please choose a PDF under 8 MB.", "error");
        e.target.value = "";
        return;
      }
      document.getElementById("docUploadStatus").textContent = "Processing…";
      const reader = new FileReader();
      reader.onload = () => {
        setDocPreview({ dataUrl: reader.result, mime: "pdf", name: file.name });
      };
      reader.onerror = () => {
        document.getElementById("docUploadStatus").textContent = "";
        VATSIM.toast("Could not read that PDF.", "error");
      };
      reader.readAsDataURL(file);
    } else {
      document.getElementById("docUploadStatus").textContent = "Processing…";
      VATSIM.compressImageFile(file, 900, 0.82)
        .then((dataUrl) => setDocPreview({ dataUrl, mime: "image", name: file.name }))
        .catch((err) => {
          document.getElementById("docUploadStatus").textContent = "";
          VATSIM.toast(err.message || "Could not process that file.", "error");
        });
    }
    e.target.value = "";
  });
  document.getElementById("btnGenDocCard").addEventListener("click", () => {
    const name = window.prompt("Name to print on the training document:", val("inLegalNameEn") || "");
    if (name === null) return;
    const dataUrl = VATSIM.generateIdCardImage({
      name: name || "Training Business",
      idNumber: val("inTradeLicense") || String(Math.floor(100000 + Math.random() * 899999)),
      issueDate: VATSIM.fmtDate(VATSIM.todayISO()),
      cardType: "Trade License (Training Placeholder)",
    });
    setDocPreview({ dataUrl, mime: "image", name: "training-document.png" });
  });
  document.getElementById("btnRemoveDoc").addEventListener("click", () => {
    tradeLicenseDoc = null;
    document.getElementById("docPreviewWrap").style.display = "none";
  });

  function setInvalid(fieldId, invalid) {
    const el = document.getElementById(fieldId);
    if (el) el.classList.toggle("invalid", invalid);
  }
  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }
  function radioVal(name) {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  }

  function paintStepper() {
    document.querySelectorAll(".step").forEach((s) => {
      const n = Number(s.getAttribute("data-step"));
      s.classList.toggle("active", n === step);
      s.classList.toggle("done", n < step);
    });
    document.querySelectorAll(".connector").forEach((c) => {
      const n = Number(c.getAttribute("data-conn"));
      c.classList.toggle("done", n < step);
    });
  }

  function showStep(n) {
    step = n;
    document.querySelectorAll(".step-panel").forEach((p) => {
      p.style.display = Number(p.getAttribute("data-panel")) === step ? "block" : "none";
    });
    paintStepper();
    document.getElementById("btnBack").style.display = step === 1 ? "none" : "inline-flex";
    document.getElementById("btnNext").textContent = step === TOTAL_STEPS ? "Submit Application" : "Next Step";
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step === 7) buildReview();
  }

  /* ---------------- Per-step validation ---------------- */
  function validateStep1() {
    const email = val("inEmail");
    const p1 = val("inPassword");
    const p2 = val("inPassword2");
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const emailTaken = false; // single-account simulator — no account exists yet at this point
    const passValid = p1.length >= 6;
    const matchValid = p1 === p2 && p2.length > 0;
    setInvalid("f_email", !emailValid || emailTaken);
    setInvalid("f_password", !passValid);
    setInvalid("f_password2", !matchValid);
    if (emailValid && !emailTaken && passValid && matchValid) {
      app.email = email;
      app.password = p1;
      return true;
    }
    return false;
  }
  function validateStep2() {
    const legalNameEn = val("inLegalNameEn");
    const tradeName = val("inTradeName");
    const tradeLicense = val("inTradeLicense");
    setInvalid("f_legalNameEn", !legalNameEn);
    setInvalid("f_tradeName", !tradeName);
    setInvalid("f_tradeLicense", !tradeLicense);
    if (legalNameEn && tradeName && tradeLicense) {
      app.applicantType = radioVal("applicantType");
      app.legalNameEn = legalNameEn;
      app.legalNameAr = val("inLegalNameAr");
      app.tradeName = tradeName;
      app.tradeLicenseNo = tradeLicense;
      app.businessActivity = document.getElementById("inActivity").value || "Other";
      return true;
    }
    return false;
  }
  function validateStep3() {
    const regType = radioVal("regType");
    const turnoverRaw = val("inTurnover").replace(/,/g, "");
    const turnover = parseFloat(turnoverRaw);
    const hasTurnover = turnoverRaw !== "" && !isNaN(turnover) && turnover >= 0;
    let thresholdOk = true;
    let msg = "";
    if (!hasTurnover) {
      thresholdOk = false;
      msg = "Enter your taxable turnover for the last 12 months.";
    } else if (regType === "Mandatory" && turnover < 375000) {
      thresholdOk = false;
      msg = "Mandatory registration requires taxable turnover of at least AED 375,000. Select Voluntary instead if this fits.";
    } else if (regType === "Voluntary" && turnover < 187500) {
      thresholdOk = false;
      msg = "Voluntary registration requires taxable turnover (or expenses) of at least AED 187,500.";
    }
    setInvalid("f_turnover", !thresholdOk);
    if (!thresholdOk) document.getElementById("turnoverError").textContent = msg;
    if (thresholdOk) {
      app.registrationType = regType;
      app.turnover = VATSIM.round2(turnover);
      return true;
    }
    return false;
  }
  function validateStep4() {
    const emirate = document.getElementById("inEmirate").value;
    const phone = val("inPhone");
    const address = val("inAddress");
    const phoneDigits = phone.replace(/[\s-]/g, "");
    const phoneValid = /^0?5[0-9]{8}$/.test(phoneDigits);
    setInvalid("f_emirate", !emirate);
    setInvalid("f_phone", !phoneValid);
    setInvalid("f_address", !address);
    if (emirate && phoneValid && address) {
      app.emirate = emirate;
      app.phone = phone;
      app.address = address;
      return true;
    }
    return false;
  }
  function validateStep5() {
    const firstEn = val("inSigFirstEn");
    const lastEn = val("inSigLastEn");
    const eid = val("inEmiratesId").replace(/\s/g, "");
    const designation = val("inDesignation");
    const eidValid = /^784-?\d{4}-?\d{7}-?\d$/.test(eid);
    setInvalid("f_sigFirstEn", !firstEn);
    setInvalid("f_sigLastEn", !lastEn);
    setInvalid("f_emiratesId", !eidValid);
    setInvalid("f_designation", !designation);
    if (firstEn && lastEn && eidValid && designation) {
      app.firstNameEn = firstEn;
      app.lastNameEn = lastEn;
      app.firstNameAr = val("inSigFirstAr");
      app.lastNameAr = val("inSigLastAr");
      app.emiratesId = eid;
      app.designation = designation;
      return true;
    }
    return false;
  }
  function validateStep6() {
    // All optional — but if any bank field is filled, require a valid IBAN.
    const bankName = val("inBankName");
    const holder = val("inAccountHolder");
    const iban = val("inIban").toUpperCase().replace(/\s/g, "");
    const anyFilled = bankName || holder || iban;
    const ibanValid = !anyFilled || /^AE\d{21}$/.test(iban);
    setInvalid("f_iban", anyFilled && !ibanValid);
    if (ibanValid) {
      app.bankName = bankName;
      app.bankAccountHolder = holder;
      app.iban = iban;
      return true;
    }
    return false;
  }
  function validateStep7() {
    if (!document.getElementById("declareCheck").checked) {
      VATSIM.toast("Please confirm the declaration before submitting.", "error");
      return false;
    }
    return true;
  }

  const VALIDATORS = { 1: validateStep1, 2: validateStep2, 3: validateStep3, 4: validateStep4, 5: validateStep5, 6: validateStep6, 7: validateStep7 };

  /* ---------------- Review screen ---------------- */
  function buildReview() {
    function item(k, v) {
      return '<div class="review-item"><div class="k">' + k + '</div><div class="v">' + (v || "—") + "</div></div>";
    }
    let html = "";
    html += item("Applicant Type", app.applicantType);
    html += item("Supporting Document", tradeLicenseDoc ? "✓ Attached (" + (tradeLicenseDoc.mime === "pdf" ? "PDF" : "Image") + ")" : "Not attached");
    html += item("Legal Name (English)", app.legalNameEn);
    html += item("Legal Name (Arabic)", app.legalNameAr);
    html += item("Trade Name", app.tradeName);
    html += item("Trade License Number", app.tradeLicenseNo);
    html += item("Business Activity", app.businessActivity);
    html += item("Registration Type", app.registrationType);
    html += item("Taxable Turnover (12 months)", "AED " + VATSIM.fmtAED(app.turnover));
    html += item("Emirate", app.emirate);
    html += item("Registered Address", app.address);
    html += item("Mobile Number", app.phone);
    html += item("Authorized Signatory", app.firstNameEn + " " + app.lastNameEn);
    html += item("Emirates ID", app.emiratesId);
    html += item("Designation", app.designation);
    html += item("Bank Name", app.bankName || "Not provided");
    html += item("IBAN", app.iban || "Not provided");
    html += item("Login Email", app.email);
    document.getElementById("reviewGrid").innerHTML = html;
  }

  /* ---------------- Navigation ---------------- */
  document.getElementById("btnNext").addEventListener("click", () => {
    const fn = VALIDATORS[step];
    if (fn && !fn()) {
      VATSIM.toast("Please complete this step correctly before continuing.", "error");
      return;
    }
    if (step < TOTAL_STEPS) {
      showStep(step + 1);
    } else {
      submitApplication();
    }
  });
  document.getElementById("btnBack").addEventListener("click", () => {
    if (step > 1) showStep(step - 1);
  });

  /* ---------------- Submit & simulated FTA review ---------------- */
  function submitApplication() {
    app.arn = "VATREG-" + String(Math.floor(100000000 + Math.random() * 899999999));
    document.getElementById("wizardWrap").style.display = "none";
    document.getElementById("wizardFooter").style.display = "none";
    document.getElementById("pendingWrap").style.display = "block";
    document.getElementById("arnOut").textContent = app.arn;
  }

  /* ---------------- TRN issuance — manual, staged generation ----------------
     Mirrors the real FTA review pipeline as a checklist of named stages
     instead of a single instant "click and it appears" button. The TRN
     itself is only generated once processing reaches the "TRN Generation"
     stage, and is revealed there rather than beforehand. */
  const TRN_STAGES = [
    { key: "review", label: "Initial Review", detail: "Application received and queued for an FTA reviewing officer." },
    { key: "docs", label: "Document & Eligibility Verification", detail: "Trade license, turnover declaration, and authorized signatory details are checked." },
    { key: "risk", label: "Risk Assessment", detail: "Standard compliance and risk-profiling checks are run on the application." },
    { key: "trn", label: "TRN Generation", detail: "A unique 15-digit Tax Registration Number is generated for the taxable person." },
    { key: "cert", label: "Certificate & Notification Issuance", detail: "The VAT Registration Certificate is issued and a notice is sent to My Correspondence." },
  ];
  let trnStageIndex = -1;
  let trnValue = "";
  function renderTrnStages() {
    const list = document.getElementById("trnStageList");
    list.innerHTML = TRN_STAGES.map((s, i) => {
      const state = i < trnStageIndex ? "done" : i === trnStageIndex ? "active" : "pending";
      const icon = state === "done" ? "✅" : state === "active" ? "⏳" : "◻";
      let extra = "";
      if (s.key === "trn" && i <= trnStageIndex && trnValue) {
        extra = '<div style="font-size:15px;font-weight:800;color:var(--navy-900);letter-spacing:1px;margin-top:4px">TRN: ' + trnValue + "</div>";
      }
      return (
        '<div class="review-item" style="align-items:flex-start;margin-top:' + (i === 0 ? "0" : "10px") + '">' +
        '<div class="k" style="white-space:nowrap">' + icon + " " + s.label + "</div>" +
        '<div class="v" style="text-align:right">' + (state === "pending" ? "Pending" : s.detail) + extra + "</div>" +
        "</div>"
      );
    }).join("");
  }
  function advanceTrnStage() {
    return new Promise((resolve) => {
      trnStageIndex++;
      const stage = TRN_STAGES[trnStageIndex];
      if (stage.key === "trn") trnValue = VATSIM.generateTRN();
      renderTrnStages();
      VATSIM.showLoading("FTA — " + stage.label + "…", 700).then(resolve);
    });
  }

  document.getElementById("btnApprove").addEventListener("click", async () => {
    const btn = document.getElementById("btnApprove");
    btn.disabled = true;
    btn.textContent = "Processing…";
    for (let i = 0; i < TRN_STAGES.length; i++) {
      await advanceTrnStage();
    }
    const account = {
      companyName: app.legalNameEn,
      companyNameAr: app.legalNameAr,
      tradeName: app.tradeName,
      tradeLicenseNo: app.tradeLicenseNo,
      applicantType: app.applicantType,
      businessActivity: app.businessActivity,
      registrationType: app.registrationType,
      turnover: app.turnover,
      firstNameEn: app.firstNameEn,
      lastNameEn: app.lastNameEn,
      firstNameAr: app.firstNameAr,
      lastNameAr: app.lastNameAr,
      emiratesId: app.emiratesId,
      designation: app.designation,
      emirate: app.emirate,
      address: app.address,
      phone: app.phone,
      email: app.email,
      password: app.password,
      bankName: app.bankName,
      bankAccountHolder: app.bankAccountHolder,
      tradeLicenseDoc: tradeLicenseDoc,
      iban: app.iban,
      trn: trnValue,
      arn: app.arn,
      registrationDate: VATSIM.todayISO(),
      registrationStatus: "Registered",
      staggerType: "2",
      createdAt: new Date().toISOString(),
    };
    VATSIM.registerNewStudent(account);
    VATSIM.stagePendingSignup({
      account,
      session: { email: account.email, loggedInAt: new Date().toISOString() },
      activityLog: { action: "VAT Registration", detail: "Application " + app.arn + " approved — TRN " + account.trn + " issued." },
      extraMessages: [{
        folder: "inbox", category: "FTA Notice",
        subject: "VAT Registration Approved — TRN " + account.trn,
        from: "Federal Tax Authority", to: account.email,
        date: new Date().toISOString(), read: false,
        body:
          "Dear " + account.firstNameEn + ",\n\nCongratulations. Your VAT registration application (Ref. " + app.arn +
          ") has been approved.\n\nYour Tax Registration Number (TRN) is " + account.trn +
          ".\n\nYou must now issue tax invoices showing this TRN and file VAT returns for each tax period by the due date.",
      }],
    });
    VATSIM.toast("VAT registration approved. Welcome, " + account.firstNameEn + "!", "success");
    setTimeout(() => (window.location.href = "pages/taxable-person.html"), 700);
  });

  /* ---------------- Emirates ID application (ICP-modeled, simulated) ---------------- */
  const eidModal = document.getElementById("eidModal");
  let eidStep = 1;
  const EID_TOTAL = 6;
  const eidApp = {};

  function eidVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }
  function eidRadioVal(name) {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  }
  function eidSetInvalid(fieldId, invalid) {
    const el = document.getElementById(fieldId);
    if (el) el.classList.toggle("invalid", invalid);
  }
  function showEidStep(n) {
    eidStep = n;
    document.querySelectorAll(".eid-step").forEach((p) => {
      p.style.display = Number(p.getAttribute("data-eidstep")) === eidStep ? "block" : "none";
    });
    document.getElementById("eidProgressBar").style.width = (eidStep / EID_TOTAL) * 100 + "%";
    document.getElementById("eidBack").style.display = eidStep === 1 ? "none" : "inline-flex";
    const next = document.getElementById("eidNext");
    next.style.display = eidStep === 4 || eidStep === 5 ? "none" : "inline-flex";
    next.textContent = eidStep === 3 ? "Pay & Continue" : eidStep === EID_TOTAL ? "Done" : "Continue";
  }
  function openEidModal() {
    eidApp.faceDone = false;
    eidApp.issuedEid = null;
    document.getElementById("eidAppName").value = (val("inSigFirstEn") + " " + val("inSigLastEn")).trim();
    document.getElementById("eidPreconditionError").style.display = "none";
    showEidStep(1);
    eidModal.classList.add("open");
  }
  function closeEidModal() {
    eidModal.classList.remove("open");
  }
  document.getElementById("btnGenEmiratesId").addEventListener("click", () => {
    // If a real application was already made on the standalone Emirates
    // ID page, use that instead of starting the whole wizard over.
    const existing = VATSIM.getEmiratesIdRecord();
    if (existing) {
      const field = document.getElementById("inEmiratesId");
      field.value = existing.idNumber;
      field.closest(".field").classList.remove("invalid");
      document.getElementById("btnDownloadEidPdf").style.display = "inline-flex";
      VATSIM.toast("Using your existing Emirates ID application.", "success");
      return;
    }
    openEidModal();
  });
  document.getElementById("closeEidModal").addEventListener("click", closeEidModal);
  eidModal.addEventListener("click", (e) => { if (e.target === eidModal) closeEidModal(); });

  function renderEidPayDetail() {
    const method = eidRadioVal("eidPayMethod");
    const detail = document.getElementById("eidPayDetail");
    if (method === "MagnatiPay") {
      detail.innerHTML =
        '<div class="two-col"><div class="field"><label for="eidCardNumber">Card Number (demo)</label><input type="text" id="eidCardNumber" placeholder="4111 1111 1111 1111" maxlength="19" /></div>' +
        '<div class="field"><label for="eidCardExpiry">Expiry (MM/YY)</label><input type="text" id="eidCardExpiry" placeholder="MM/YY" maxlength="5" /></div></div>' +
        '<div class="field"><label for="eidCardCvv">CVV</label><input type="password" id="eidCardCvv" placeholder="•••" maxlength="4" style="max-width:120px" /></div>';
    } else {
      const giban = "AE" + String(Math.floor(1e8 + Math.random() * 8.9e8)) + "ICP" + String(Math.floor(100000 + Math.random() * 899999));
      detail.innerHTML =
        '<div class="info-banner" style="margin-bottom:0"><strong>ICP GIBAN (training-only):</strong> ' + giban +
        "<br/>Transfer the exact amount due using this reference. Training-only banking information — no real transfer happens here.</div>";
    }
  }
  document.querySelectorAll('input[name="eidPayMethod"]').forEach((r) => r.addEventListener("change", renderEidPayDetail));

  document.getElementById("btnStartEidBio").addEventListener("click", () => {
    const circle = document.getElementById("eidBioCircle");
    const status = document.getElementById("eidBioStatusText");
    const btn = document.getElementById("btnStartEidBio");
    const stages = ["👆 Capturing fingerprints…", "🙂 Capturing facial recognition…", "✍️ Capturing digital signature…"];
    btn.disabled = true;
    let i = 0;
    status.textContent = stages[0];
    const timer = setInterval(() => {
      i++;
      circle.style.boxShadow = i % 2 ? "0 0 0 8px rgba(201,162,39,0.25)" : "none";
      if (i < stages.length) {
        status.textContent = stages[i];
      } else {
        clearInterval(timer);
        circle.style.boxShadow = "none";
        circle.textContent = "✅";
        status.textContent = "Biometric capture complete.";
        eidApp.faceDone = true;
        VATSIM.toast("Biometric capture complete (simulated).", "success");
        setTimeout(() => showEidStep(5), 500);
      }
    }, 650);
  });

  document.getElementById("eidNext").addEventListener("click", async () => {
    if (eidStep === 1) {
      const choice = eidRadioVal("eidPrecondition");
      const ok = choice === "visa" || choice === "citizen";
      document.getElementById("eidPreconditionError").style.display = ok ? "none" : "block";
      if (!ok) return;
      eidApp.precondition = choice;
      showEidStep(2);
      return;
    }
    if (eidStep === 2) {
      const name = eidVal("eidAppName"), dob = eidVal("eidAppDob"), nationality = eidVal("eidAppNationality"),
        visaFile = eidVal("eidAppVisaFile"), apptDate = eidVal("eidApptDate");
      eidSetInvalid("f_eidName", !name);
      eidSetInvalid("f_eidDob", !dob);
      eidSetInvalid("f_eidNationality", !nationality);
      eidSetInvalid("f_eidVisaFile", eidApp.precondition === "visa" && !visaFile);
      eidSetInvalid("f_eidApptDate", !apptDate);
      if (!name || !dob || !nationality || !apptDate || (eidApp.precondition === "visa" && !visaFile)) {
        VATSIM.toast("Please complete the application form before continuing.", "error");
        return;
      }
      eidApp.name = name;
      eidApp.dob = dob;
      eidApp.nationality = nationality;
      eidApp.visaFile = visaFile;
      eidApp.apptDate = apptDate;
      eidApp.apptCentre = document.getElementById("eidApptCentre").value;
      renderEidPayDetail();
      showEidStep(3);
      return;
    }
    if (eidStep === 3) {
      const method = eidRadioVal("eidPayMethod");
      if (method === "MagnatiPay") {
        const num = eidVal("eidCardNumber").replace(/\s/g, "");
        const expiry = eidVal("eidCardExpiry");
        const cvv = eidVal("eidCardCvv");
        if (!/^\d{13,19}$/.test(num) || !/^\d{2}\/\d{2}$/.test(expiry) || !/^\d{3,4}$/.test(cvv)) {
          VATSIM.toast("Enter a valid demo card number, expiry (MM/YY), and CVV.", "error");
          return;
        }
      }
      await VATSIM.showLoading("Processing biometrics & application fee payment (demo)…", 1200);
      showEidStep(4);
      return;
    }
    if (eidStep === 6) {
      const field = document.getElementById("inEmiratesId");
      field.value = eidApp.issuedEid;
      field.closest(".field").classList.remove("invalid");
      document.getElementById("btnDownloadEidPdf").style.display = "inline-flex";
      closeEidModal();
      return;
    }
  });
  document.getElementById("eidBack").addEventListener("click", () => {
    if (eidStep > 1) showEidStep(eidStep - 1);
  });

  // Entering step 5 (Processing) shows a fast-forward button in place of
  // the modal's normal Next button, mirroring the VAT approval pattern.
  const eidStepObserver = new MutationObserver(() => {
    const panel5 = document.querySelector('.eid-step[data-eidstep="5"]');
    if (panel5 && panel5.style.display !== "none" && !document.getElementById("btnFastForwardEid")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-gold";
      btn.id = "btnFastForwardEid";
      btn.textContent = "⚡ Fast-Forward Processing";
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Processing…";
        await VATSIM.showLoading("ICP validating biometrics and printing card…", 1300);
        const eid = VATSIM.generateEmiratesId(new Date(eidApp.dob || "1990-01-01").getFullYear());
        eidApp.issuedEid = eid;
        document.getElementById("eidIssuedNumber").textContent = eid;
        document.getElementById("eidTrackingOut").textContent = VATSIM.generateTrackingNumber();
        showEidStep(6);
        btn.remove();
      });
      panel5.appendChild(btn);
    }
    if (panel5 && panel5.style.display === "none") {
      const existing = document.getElementById("btnFastForwardEid");
      if (existing) existing.remove();
    }
  });
  eidStepObserver.observe(document.querySelector('.eid-step[data-eidstep="5"]'), { attributes: true, attributeFilter: ["style"] });

  /* ---------------- Emirates ID PDF download ---------------- */
  document.getElementById("btnDownloadEidPdf").addEventListener("click", () => {
    const eidNumber = val("inEmiratesId");
    if (!eidNumber) {
      VATSIM.toast("Apply for or enter an Emirates ID first.", "error");
      return;
    }
    const name = (val("inSigFirstEn") + " " + val("inSigLastEn")).trim() || eidApp.name || "Training Applicant";
    VATSIM.showLoading("Preparing Emirates ID PDF…", 500).then(() => {
      const ok = VATSIM.generateIdCardPdf({
        docTitle: "Emirates ID",
        issuerLine: "Federal Authority for Identity, Citizenship, Customs & Port Security (ICP)",
        accent: [201, 162, 39],
        name,
        idLabel: "ID Number",
        idNumber: eidNumber,
        issueDate: VATSIM.fmtDate(VATSIM.todayISO()),
        rows: [["Nationality", eidApp.nationality || "United Arab Emirates"], ["Card Type", "Training / Simulation Only"]],
        filename: "Emirates_ID_" + eidNumber.replace(/[^0-9]/g, "") + ".pdf",
      });
      if (ok) VATSIM.toast("Emirates ID PDF downloaded.", "success");
    });
  });

  document.getElementById("inEmiratesId").addEventListener("input", () => {
    document.getElementById("btnDownloadEidPdf").style.display = val("inEmiratesId") ? "inline-flex" : "none";
  });

  renderTrnStages();
  showStep(1);
})();
