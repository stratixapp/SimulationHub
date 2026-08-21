/* ==========================================================================
   uaepass-login.js — simulated UAE PASS sign-in flow
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

  const account = VATSIM.getAccount();
  const uaePass = VATSIM.getUaePass();

  if (!account) {
    VATSIM.toast("Create your VAT training account first.", "warn");
    setTimeout(() => (window.location.href = "register.html"), 900);
    return;
  }
  if (!uaePass) {
    VATSIM.toast("No UAE PASS found for this profile yet — create one first.", "warn");
    setTimeout(() => (window.location.href = "uaepass-create.html"), 900);
    return;
  }

  const TOTAL = 5;
  let step = 1;
  let loginOtp = "";

  function val(id) {
    return document.getElementById(id).value.trim();
  }
  function setInvalid(id, invalid) {
    document.getElementById(id).classList.toggle("invalid", invalid);
  }

  function showStep(n) {
    step = n;
    document.querySelectorAll(".step-panel").forEach((p) => {
      p.style.display = Number(p.getAttribute("data-panel")) === step ? "block" : "none";
    });
    document.getElementById("stepNumOut").textContent = step;
    document.getElementById("btnBack").style.display = step === 1 ? "none" : "inline-flex";
    document.getElementById("btnNext").textContent = step === TOTAL ? "Approve & Sign In" : "Continue";
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (step === 5) {
      const method = document.querySelector('input[name="verifyMethod"]:checked').value;
      document.getElementById("faceApproval").style.display = method === "face" ? "block" : "none";
      document.getElementById("otpApproval").style.display = method === "otp" ? "block" : "none";
      if (method === "otp") {
        loginOtp = String(Math.floor(100000 + Math.random() * 899999));
        document.getElementById("loginOtpDisplay").textContent = loginOtp;
      } else {
        // Simulate the "waiting for app approval" delay, then auto-approve.
        const btn = document.getElementById("btnNext");
        btn.disabled = true;
        document.getElementById("faceApprovalText").textContent = "Waiting for approval on your UAE PASS app (simulated)…";
        setTimeout(() => {
          document.getElementById("faceApprovalText").textContent = "✓ Approved on your device.";
          btn.disabled = false;
        }, 1600);
      }
    }
  }

  const VALIDATORS = {
    2: () => {
      const id = val("identifierInput");
      const matches = id && (id === uaePass.mobile || id === uaePass.email || id.replace(/\s/g, "") === uaePass.emiratesId);
      setInvalid("f_identifier", !matches);
      return matches;
    },
    3: () => {
      const ok = val("pinInput") === uaePass.pin;
      setInvalid("f_pinInput", !ok);
      if (!ok) VATSIM.toast("Incorrect PIN.", "error");
      return ok;
    },
    5: () => {
      const method = document.querySelector('input[name="verifyMethod"]:checked').value;
      if (method === "otp") {
        const ok = val("loginOtpInput") === loginOtp;
        setInvalid("f_loginOtpInput", !ok);
        if (!ok) VATSIM.toast("That code doesn't match.", "error");
        return ok;
      }
      return true; // face approval already gates via disabled button
    },
  };

  document.getElementById("btnNext").addEventListener("click", () => {
    const fn = VALIDATORS[step];
    if (fn && !fn()) return;
    if (step < TOTAL) {
      showStep(step + 1);
    } else {
      finish();
    }
  });
  document.getElementById("btnBack").addEventListener("click", () => {
    if (step > 1) showStep(step - 1);
  });

  function finish() {
    VATSIM.showLoading("Signing you in…", 900).then(() => {
      VATSIM.setSession({ email: account.email, loggedInAt: new Date().toISOString(), via: "uaepass" });
      VATSIM.logActivity("UAE PASS", "Signed in to VAT training account via UAE PASS.");
      document.getElementById("wizardWrap").style.display = "none";
      document.getElementById("wizardFooter").style.display = "none";
      document.getElementById("successWrap").style.display = "block";
      setTimeout(() => (window.location.href = "pages/user-type.html"), 900);
    });
  }

  showStep(1);
})();
