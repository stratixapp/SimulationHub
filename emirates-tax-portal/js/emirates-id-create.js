/* ==========================================================================
   emirates-id-create.js — standalone "Apply for Emirates ID" flow
   Created By Ananthu Shaji

   Same step logic as the Emirates ID modal inside register.js, but as its
   own full page reachable straight from the login screen — matching real
   life, where getting an Emirates ID has nothing to do with the FTA or a
   VAT account. The result is saved via VATSIM.saveEmiratesIdRecord() so
   register.js and uaepass-create.js can both pick it up automatically.
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

  const TOTAL = 6;
  const STEP_TITLES = ["Confirm Eligibility", "Application Form", "Application Fee", "Biometric Capture", "Processing", "Issued"];
  let step = 1;
  const app = {};

  // Prefill the name if this student already has a shared identity (e.g.
  // they set up their company on the Corporate Tax simulator first).
  (function prefillFromSharedIdentity() {
    if (typeof SharedIdentity === "undefined") return;
    const id = SharedIdentity.get();
    if (!id || !id.fullNameEn) return;
    const el = document.getElementById("eidAppName");
    if (el && !el.value) el.value = id.fullNameEn;
  })();

  // Supporting document upload (Step 2) — accepts the UAE PASS PDF that
  // was just downloaded from the login screen. This is a training
  // simulation, so "verification" means checking whether a UAE PASS
  // already exists for this student on this browser, the same way a real
  // ICP check would confirm the uploaded ID against their own database —
  // it doesn't actually read the PDF's contents.
  let supportingDoc = null;
  document.getElementById("eidSupportingDoc").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    const status = document.getElementById("eidSupportingDocStatus");
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      supportingDoc = { name: file.name, mime: file.type, dataUrl: reader.result };
      const uaePass = VATSIM.getUaePass();
      if (uaePass) {
        status.style.color = "#0d8a51";
        status.textContent = "✓ Matched against your UAE PASS on file for " + uaePass.firstName + " " + uaePass.lastName + ".";
        if (!val("eidAppName")) document.getElementById("eidAppName").value = uaePass.firstName + " " + uaePass.lastName;
      } else {
        status.style.color = "var(--text-muted)";
        status.textContent = "✓ " + file.name + " received — no linked UAE PASS found on this browser to auto-verify against.";
      }
    };
    reader.readAsDataURL(file);
  });

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }
  function radioVal(name) {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  }
  function setInvalid(id, invalid) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("invalid", invalid);
  }

  function showStep(n) {
    step = n;
    document.querySelectorAll(".step-panel").forEach((p) => {
      p.style.display = Number(p.getAttribute("data-panel")) === step ? "block" : "none";
    });
    document.getElementById("stepNumOut").textContent = step;
    document.getElementById("stepTitleOut").textContent = STEP_TITLES[step - 1];
    document.getElementById("progressBar").style.width = (step / TOTAL) * 100 + "%";
    document.getElementById("eidBack").style.display = step === 1 ? "none" : "inline-flex";
    const next = document.getElementById("eidNext");
    next.style.display = step === 4 || step === 5 ? "none" : "inline-flex";
    next.textContent = step === 3 ? "Pay & Continue" : step === TOTAL ? "Done" : "Continue";
  }

  function renderPayDetail() {
    const method = radioVal("eidPayMethod");
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
  document.querySelectorAll('input[name="eidPayMethod"]').forEach((r) => r.addEventListener("change", renderPayDetail));

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
        VATSIM.toast("Biometric capture complete (simulated).", "success");
        setTimeout(() => {
          showStep(5);
          addFastForwardButton();
        }, 500);
      }
    }, 650);
  });

  function addFastForwardButton() {
    const panel5 = document.querySelector('.step-panel[data-panel="5"]');
    if (document.getElementById("btnFastForwardEid")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-gold";
    btn.id = "btnFastForwardEid";
    btn.textContent = "⚡ Fast-Forward Processing";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Processing…";
      await VATSIM.showLoading("ICP validating biometrics and printing card…", 1300);
      const eid = VATSIM.generateEmiratesId(new Date(app.dob || "1990-01-01").getFullYear());
      app.issuedEid = eid;
      app.trackingNumber = VATSIM.generateTrackingNumber();
      document.getElementById("eidIssuedNumber").textContent = eid;
      document.getElementById("eidTrackingOut").textContent = app.trackingNumber;
      showStep(6);
      finish();
    });
    panel5.appendChild(btn);
  }

  function finish() {
    const record = {
      name: app.name,
      idNumber: app.issuedEid,
      nationality: app.nationality,
      dob: app.dob,
      visaFile: app.visaFile,
      trackingNumber: app.trackingNumber,
      issueDate: VATSIM.todayISO(),
      createdAt: new Date().toISOString(),
      supportingDoc: supportingDoc ? { name: supportingDoc.name, mime: supportingDoc.mime } : null,
    };
    VATSIM.saveEmiratesIdRecord(record);
    // Interconnect: push the issued Emirates ID + name into the shared
    // identity so it shows up automatically on the VAT login screen and
    // on the Corporate Tax simulator too, even though this was reached
    // straight from Login, before any VAT account was created.
    if (typeof SharedIdentity !== 'undefined') {
      SharedIdentity.set({ fullNameEn: app.name, emiratesId: app.issuedEid });
    }
    setTimeout(() => {
      document.getElementById("wizardWrap").style.display = "none";
      document.getElementById("wizardFooter").style.display = "none";
      document.getElementById("successWrap").style.display = "block";
      if (typeof startAutoReturnToLogin === "function") startAutoReturnToLogin(6);
    }, 900);
  }

  document.getElementById("eidNext").addEventListener("click", async () => {
    if (step === 1) {
      const choice = radioVal("eidPrecondition");
      const ok = choice === "visa" || choice === "citizen";
      document.getElementById("eidPreconditionError").style.display = ok ? "none" : "block";
      if (!ok) return;
      app.precondition = choice;
      showStep(2);
      return;
    }
    if (step === 2) {
      const name = val("eidAppName"), dob = val("eidAppDob"), nationality = val("eidAppNationality"),
        visaFile = val("eidAppVisaFile"), apptDate = val("eidApptDate");
      setInvalid("f_eidName", !name);
      setInvalid("f_eidDob", !dob);
      setInvalid("f_eidNationality", !nationality);
      setInvalid("f_eidVisaFile", app.precondition === "visa" && !visaFile);
      setInvalid("f_eidApptDate", !apptDate);
      if (!name || !dob || !nationality || !apptDate || (app.precondition === "visa" && !visaFile)) {
        VATSIM.toast("Please complete the application form before continuing.", "error");
        return;
      }
      app.name = name;
      app.dob = dob;
      app.nationality = nationality;
      app.visaFile = visaFile;
      app.apptDate = apptDate;
      app.apptCentre = document.getElementById("eidApptCentre").value;
      renderPayDetail();
      showStep(3);
      return;
    }
    if (step === 3) {
      const method = radioVal("eidPayMethod");
      if (method === "MagnatiPay") {
        const num = val("eidCardNumber").replace(/\s/g, "");
        const expiry = val("eidCardExpiry");
        const cvv = val("eidCardCvv");
        if (!/^\d{13,19}$/.test(num) || !/^\d{2}\/\d{2}$/.test(expiry) || !/^\d{3,4}$/.test(cvv)) {
          VATSIM.toast("Enter a valid demo card number, expiry (MM/YY), and CVV.", "error");
          return;
        }
      }
      await VATSIM.showLoading("Processing biometrics & application fee payment (demo)…", 1200);
      showStep(4);
      return;
    }
  });
  document.getElementById("eidBack").addEventListener("click", () => {
    if (step > 1) showStep(step - 1);
  });

  document.getElementById("btnDownloadEidPdf").addEventListener("click", () => {
    const record = VATSIM.getEmiratesIdRecord();
    if (!record) {
      VATSIM.toast("Apply for an Emirates ID first.", "error");
      return;
    }
    VATSIM.showLoading("Preparing Emirates ID PDF…", 500).then(() => {
      const ok = VATSIM.generateIdCardPdf({
        docTitle: "Emirates ID",
        issuerLine: "Federal Authority for Identity, Citizenship, Customs & Port Security (ICP)",
        accent: [201, 162, 39],
        name: record.name,
        idLabel: "ID Number",
        idNumber: record.idNumber,
        issueDate: VATSIM.fmtDate(record.issueDate),
        rows: [["Nationality", record.nationality || "United Arab Emirates"], ["Card Type", "Training / Simulation Only"]],
        filename: "Emirates_ID_" + record.idNumber.replace(/[^0-9]/g, "") + ".pdf",
        loginNoteTitle: "This is not a sign-in ID",
        loginNote: [
          "An Emirates ID on its own does not log you in to this simulator \u2014 it only auto-fills your name and ID number when you create a UAE PASS or register for VAT.",
          "To actually sign in, create a UAE PASS (recommended) or sign up for a VAT training account.",
        ],
      });
      if (ok) VATSIM.toast("Emirates ID PDF downloaded.", "success");
    });
  });

  // If an Emirates ID was already generated in an earlier visit, skip
  // straight to the success screen instead of re-running the wizard.
  const existing = VATSIM.getEmiratesIdRecord();
  if (existing) {
    document.getElementById("wizardWrap").style.display = "none";
    document.getElementById("wizardFooter").style.display = "none";
    document.getElementById("successWrap").style.display = "block";
    document.querySelector("#successWrap h2").textContent = "Emirates ID Already On File";
    if (typeof startAutoReturnToLogin === "function") startAutoReturnToLogin(6);
  } else {
    showStep(1);
  }
})();
