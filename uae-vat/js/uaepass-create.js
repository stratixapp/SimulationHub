/* ==========================================================================
   uaepass-create.js — simulated UAE PASS account creation (10 steps)
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

  if (!VATSIM.getAccount()) {
    VATSIM.toast("Create your VAT training account first — UAE PASS links to it.", "warn");
    setTimeout(() => (window.location.href = "register.html"), 900);
    return;
  }

  const TOTAL = 11;
  let step = 1;
  // Step order matches UAE PASS's own published registration flow: Terms
  // -> Account Type -> Emirates ID (front+back scan) -> Personal Details
  // -> Mobile OTP -> Email OTP -> Create PIN (4-digit) -> Face
  // Verification -> Create a signing Password (a separate, final step —
  // confirmed against multiple current step-by-step guides).
  const STEP_TITLES = ["Welcome", "Get Started", "Terms & Conditions", "Account Type", "Emirates ID", "Personal Details", "Verify Mobile", "Verify Email", "Set PIN", "Face Verification", "Create Password"];
  const app = {};

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
    document.getElementById("btnBack").style.display = step === 1 ? "none" : "inline-flex";
    document.getElementById("btnNext").textContent = step === TOTAL ? "Create Account" : "Continue";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.getElementById("noEid").addEventListener("change", (e) => {
    document.getElementById("eidInput").disabled = e.target.checked;
    if (e.target.checked) document.getElementById("eidInput").value = "";
  });
  document.getElementById("btnScanEid").addEventListener("click", () => {
    // If a real application was already made on the standalone Emirates
    // ID page, "scan" that instead of generating a fresh random one —
    // closes the loop between the two flows.
    const existing = VATSIM.getEmiratesIdRecord();
    document.getElementById("eidInput").value = existing ? existing.idNumber : VATSIM.generateEmiratesId();
    VATSIM.toast("Emirates ID scanned (simulated).", "success");
  });
  // Prefill from a standalone Emirates ID application, if one exists.
  const existingEid = VATSIM.getEmiratesIdRecord();
  if (existingEid) {
    document.getElementById("eidInput").value = existingEid.idNumber;
  }

  function wirePhotoUpload(inputId, statusId, previewId, onDone) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById(statusId).textContent = "Processing…";
      VATSIM.compressImageFile(file, 700, 0.82)
        .then((dataUrl) => {
          document.getElementById(statusId).textContent = "✓ " + file.name;
          const preview = document.getElementById(previewId);
          if (preview) {
            preview.src = dataUrl;
            preview.style.display = "block";
          }
          onDone(dataUrl);
        })
        .catch((err) => {
          document.getElementById(statusId).textContent = "No photo uploaded.";
          VATSIM.toast(err.message || "Could not process that photo.", "error");
        });
    });
  }
  wirePhotoUpload("eidPhotoFrontInput", "eidPhotoFrontStatus", "eidPhotoFrontPreview", (dataUrl) => (app.eidPhotoFront = dataUrl));
  wirePhotoUpload("eidPhotoBackInput", "eidPhotoBackStatus", "eidPhotoBackPreview", (dataUrl) => (app.eidPhotoBack = dataUrl));
  document.getElementById("profilePhotoInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById("profilePhotoStatus").textContent = "Processing…";
    VATSIM.compressImageFile(file, 500, 0.85)
      .then((dataUrl) => {
        app.profilePhoto = dataUrl;
        document.getElementById("profilePhotoStatus").textContent = "✓ " + file.name;
        const circle = document.getElementById("faceCircle");
        circle.style.backgroundImage = "url(" + dataUrl + ")";
        circle.textContent = "";
      })
      .catch((err) => {
        document.getElementById("profilePhotoStatus").textContent = "No photo uploaded.";
        VATSIM.toast(err.message || "Could not process that photo.", "error");
      });
  });

  const VALIDATORS = {
    3: () => {
      const ok = document.getElementById("tcAgree").checked;
      if (!ok) VATSIM.toast("Please accept the Terms & Conditions to continue.", "error");
      return ok;
    },
    5: () => {
      const skip = document.getElementById("noEid").checked;
      const eid = val("eidInput").replace(/\s/g, "");
      const valid = skip || /^784-?\d{4}-?\d{7}-?\d$/.test(eid);
      setInvalid("f_eid", !valid);
      if (!valid) return false;
      app.emiratesId = skip ? "" : eid;
      return true;
    },
    6: () => {
      const first = val("pFirst"), last = val("pLast"), mobile = val("pMobile"), email = val("pEmail");
      const mobileValid = /^0?5[0-9]{8}$/.test(mobile.replace(/[\s-]/g, ""));
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      setInvalid("f_pFirst", !first);
      setInvalid("f_pLast", !last);
      setInvalid("f_pMobile", !mobileValid);
      setInvalid("f_pEmail", !emailValid);
      if (!first || !last || !mobileValid || !emailValid) return false;
      app.firstName = first;
      app.lastName = last;
      app.gender = radioVal("gender");
      app.mobile = mobile;
      app.email = email;
      return true;
    },
    7: () => {
      const ok = val("mobileOtpInput") === app.mobileOtp;
      setInvalid("f_mobileOtpInput", !ok);
      if (!ok) VATSIM.toast("That code doesn't match — check the code shown above.", "error");
      return ok;
    },
    8: () => {
      const ok = val("emailOtpInput") === app.emailOtp;
      setInvalid("f_emailOtpInput", !ok);
      if (!ok) VATSIM.toast("That code doesn't match — check the code shown above.", "error");
      return ok;
    },
    9: () => {
      const p1 = val("pin1"), p2 = val("pin2");
      const validFormat = /^\d{4}$/.test(p1);
      const match = p1 === p2;
      setInvalid("f_pin1", !validFormat);
      setInvalid("f_pin2", validFormat && !match);
      if (!validFormat) {
        VATSIM.toast("PIN must be exactly 4 digits.", "error");
        return false;
      }
      if (!match) {
        VATSIM.toast("PINs do not match.", "error");
        return false;
      }
      app.pin = p1;
      return true;
    },
    10: () => {
      if (!app.faceVerified) {
        VATSIM.toast("Complete face verification first.", "error");
        return false;
      }
      return true;
    },
    11: () => {
      const p1 = val("pw1"), p2 = val("pw2");
      const strong = p1.length >= 8 && /[A-Za-z]/.test(p1) && /[0-9]/.test(p1) && /[^A-Za-z0-9]/.test(p1);
      const match = p1 === p2;
      setInvalid("f_pw1", !strong);
      setInvalid("f_pw2", strong && !match);
      if (!strong) {
        VATSIM.toast("Password needs 8+ characters with letters, numbers, and a symbol.", "error");
        return false;
      }
      if (!match) {
        VATSIM.toast("Passwords do not match.", "error");
        return false;
      }
      app.password = p1;
      return true;
    },
  };

  function genOtp() {
    return String(Math.floor(100000 + Math.random() * 899999));
  }

  document.getElementById("btnNext").addEventListener("click", () => {
    const fn = VALIDATORS[step];
    if (fn && !fn()) return;

    // When leaving step 4, capture account type.
    if (step === 4) app.accountType = radioVal("accountType");

    // Entering step 7: generate + display the mobile OTP.
    if (step === 6) {
      app.mobileOtp = genOtp();
      app.emailOtp = genOtp();
      document.getElementById("mobileEcho").textContent = app.mobile;
      document.getElementById("mobileOtpDisplay").textContent = app.mobileOtp;
      document.getElementById("emailEcho").textContent = app.email;
      document.getElementById("emailOtpDisplay").textContent = app.emailOtp;
    }

    if (step < TOTAL) {
      showStep(step + 1);
    } else {
      finish();
    }
  });
  document.getElementById("btnBack").addEventListener("click", () => {
    if (step > 1) showStep(step - 1);
  });

  document.getElementById("btnStartFace").addEventListener("click", () => {
    const circle = document.getElementById("faceCircle");
    const status = document.getElementById("faceStatusText");
    const btn = document.getElementById("btnStartFace");
    btn.disabled = true;
    status.textContent = "Hold still… scanning (simulated)…";
    circle.style.transition = "box-shadow .3s";
    let pulses = 0;
    const timer = setInterval(() => {
      pulses++;
      circle.style.boxShadow = pulses % 2 ? "0 0 0 8px rgba(13,138,81,0.25)" : "none";
      if (pulses >= 5) {
        clearInterval(timer);
        circle.style.boxShadow = "none";
        circle.textContent = "✅";
        status.textContent = "Face verified.";
        app.faceVerified = true;
        VATSIM.toast("Face verification complete (simulated).", "success");
      }
    }, 300);
  });

  function finish() {
    VATSIM.showLoading("Creating your UAE PASS…", 1200).then(() => {
      const uaePass = {
        emiratesId: app.emiratesId || "",
        eidPhotoFront: app.eidPhotoFront || "",
        eidPhotoBack: app.eidPhotoBack || "",
        profilePhoto: app.profilePhoto || "",
        firstName: app.firstName,
        lastName: app.lastName,
        gender: app.gender,
        mobile: app.mobile,
        email: app.email,
        accountType: app.accountType,
        pin: app.pin,
        password: app.password,
        faceVerified: true,
        createdAt: new Date().toISOString(),
      };
      VATSIM.saveUaePass(uaePass);
      VATSIM.logActivity("UAE PASS", "UAE PASS account created for " + app.firstName + " " + app.lastName + ".");
      document.getElementById("wizardWrap").style.display = "none";
      document.getElementById("wizardFooter").style.display = "none";
      document.getElementById("successWrap").style.display = "block";
    });
  }

  document.getElementById("btnDownloadUaePassPdf").addEventListener("click", () => {
    const uaePass = VATSIM.getUaePass();
    if (!uaePass) {
      VATSIM.toast("Create your UAE PASS first.", "error");
      return;
    }
    VATSIM.showLoading("Preparing UAE PASS Digital ID PDF…", 500).then(() => {
      const ok = VATSIM.generateIdCardPdf({
        docTitle: "UAE PASS Digital ID",
        issuerLine: "UAE PASS — National Digital Identity (Simulated)",
        accent: [13, 138, 81],
        name: uaePass.firstName + " " + uaePass.lastName,
        idLabel: "Emirates ID",
        idNumber: uaePass.emiratesId || "Not linked",
        issueDate: VATSIM.fmtDate(uaePass.createdAt ? uaePass.createdAt.slice(0, 10) : VATSIM.todayISO()),
        rows: [["Mobile", uaePass.mobile], ["Email", uaePass.email], ["Account Type", uaePass.accountType]],
        photoDataUrl: uaePass.profilePhoto || undefined,
        watermarkLines: [
          "Digital Identity — Training Simulation. This is a training-simulation document generated by the UAE VAT Simulator and is not affiliated with, issued by, or endorsed by UAE PASS, TDRA, or any UAE government entity. It has no legal, official, or identification value.",
        ],
        filename: "UAE_PASS_Digital_ID_" + uaePass.firstName + "_" + uaePass.lastName + ".pdf",
      });
      if (ok) VATSIM.toast("UAE PASS Digital ID PDF downloaded.", "success");
    });
  });

  showStep(1);
})();
