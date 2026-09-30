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

  // Unlike the old version of this page, signing in here does NOT require
  // whichever student happens to be "active" on this browser right now to
  // already have an account/UAE PASS — Step 2 resolves the right student
  // by searching every UAE PASS / Emirates ID on this device (see
  // VATSIM.findStudentByIdentifier), the same way login.js resolves an
  // account by email. This is what makes "Login with UAE PASS" a genuine,
  // independent way in, not just a secondary confirmation for someone
  // who's already positioned in the right session.

  const TOTAL = 5;
  let step = 1;
  let loginOtp = "";
  let resolved = null; // { id, account, uaePass, emiratesId } once Step 2 succeeds

  function val(id) {
    return document.getElementById(id).value.trim();
  }
  function setInvalid(id, invalid) {
    document.getElementById(id).classList.toggle("invalid", invalid);
  }

  /* ---------------- Step 2: identifier method toggle ---------------- */
  document.querySelectorAll('input[name="idMethod"]').forEach((r) => {
    r.addEventListener("change", () => {
      const isUpload = r.value === "upload" && r.checked;
      if (!r.checked) return;
      document.getElementById("idMethodManual").style.display = r.value === "manual" ? "" : "none";
      document.getElementById("idMethodUpload").style.display = r.value === "upload" ? "" : "none";
    });
  });

  /* Pulls the longest run of digits out of the uploaded file's name — the
     Emirates ID / UAE PASS download filenames from this simulator embed
     the ID number in exactly this way (e.g. "UAE_PASS_784...pdf",
     "Emirates_ID_784....pdf"), so reading the filename back out is a
     faithful (if simplified) stand-in for "reading the document". */
  function extractIdNumberFromFilename(name) {
    const runs = String(name || "").match(/\d+/g);
    if (!runs || !runs.length) return null;
    return runs.reduce((a, b) => (b.length > a.length ? b : a));
  }

  document.getElementById("uaePassFileInput").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    const status = document.getElementById("uploadStatus");
    if (!file) return;
    status.style.color = "var(--text-muted)";
    status.textContent = "Reading " + file.name + "…";
    const idNumber = extractIdNumberFromFilename(file.name);
    setTimeout(() => {
      if (!idNumber) {
        resolved = null;
        status.style.color = "#c0392b";
        status.textContent = "Couldn't read a UAE PASS number from that file's name — try entering it manually instead.";
        return;
      }
      const found = VATSIM.findStudentByIdentifier(idNumber);
      if (!found || !found.uaePass) {
        resolved = null;
        status.style.color = "#c0392b";
        status.textContent = "Read " + idNumber + " from the file, but no UAE PASS on this device matches it.";
        return;
      }
      resolved = found;
      status.style.color = "#0d8a51";
      status.textContent = "✓ Read UAE PASS " + idNumber + " — verified for " + found.uaePass.firstName + " " + found.uaePass.lastName + ".";
    }, 500);
  });

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
      const method = document.querySelector('input[name="idMethod"]:checked').value;
      if (method === "upload") {
        if (!resolved) {
          VATSIM.toast("Upload your UAE PASS document first, or switch to entering the number manually.", "error");
          return false;
        }
        return true;
      }
      const id = val("identifierInput");
      const found = VATSIM.findStudentByIdentifier(id);
      setInvalid("f_identifier", !found || !found.uaePass);
      if (!found || !found.uaePass) {
        VATSIM.toast("No UAE PASS on this device matches that.", "error");
        return false;
      }
      resolved = found;
      return true;
    },
    3: () => {
      const ok = resolved && resolved.uaePass && val("pinInput") === resolved.uaePass.pin;
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
      const session = { email: (resolved.account && resolved.account.email) || "", loggedInAt: new Date().toISOString(), via: "uaepass" };
      const activeId = VATSIM.getActiveStudentId();
      if (resolved.id !== activeId) {
        VATSIM.switchActiveStudent(resolved.id);
        VATSIM.setSessionForStudent(resolved.id, session);
      } else {
        VATSIM.setSession(session);
      }
      VATSIM.logActivity("UAE PASS", "Signed in via UAE PASS.");

      document.getElementById("wizardWrap").style.display = "none";
      document.getElementById("wizardFooter").style.display = "none";
      document.getElementById("successWrap").style.display = "block";

      const name = resolved.uaePass ? (resolved.uaePass.firstName + " " + resolved.uaePass.lastName) : "you";
      document.getElementById("signedInAsText").textContent = "Signed in as " + name + ".";

      const hasVatAccount = !!resolved.account;
      const btnVat = document.getElementById("btnGoVat");
      if (!hasVatAccount) {
        btnVat.disabled = true;
        btnVat.title = "No VAT registration yet for this UAE PASS — sign up first.";
        btnVat.textContent = "No VAT account yet";
      }
      btnVat.addEventListener("click", () => {
        window.location.href = hasVatAccount ? "pages/user-type.html" : "register.html";
      });
      document.getElementById("btnGoCt").addEventListener("click", () => {
        window.location.href = "ct/index.html";
      });
    });
  }

  showStep(1);
})();
