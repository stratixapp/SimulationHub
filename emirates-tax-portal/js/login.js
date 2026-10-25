/* ==========================================================================
   login.js — Step 1: Login screen
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

  // If already logged in, resume wherever they last were — respecting
  // whichever Taxable Person was selected, so the session stays
  // consistent instead of silently resetting to the student's own
  // company (Section 28: persist the selection until deliberately
  // switched).
  if (VATSIM.getSession() && VATSIM.getAccount()) {
    const tp = VATSIM.getSelectedTaxablePerson();
    window.location.href = tp === "own" ? "pages/dashboard.html" : "pages/demo-company.html?id=" + tp;
    return;
  }

  // Show "Switch Student" once more than one student profile exists on this browser.
  if (VATSIM.getStudentRegistry().length > 1) {
    document.getElementById("btnSwitchStudent").style.display = "";
  }

  // Interconnected status: an Emirates ID / UAE PASS created here, via the
  // standalone entry points, or via the Corporate Tax simulator should all
  // be recognised on this screen — check both this app's own record and
  // the shared identity so nothing looks "empty" just because the record
  // happened to be created from the other simulator.
  (function showExistingIdentityStatus() {
    const shared = (typeof SharedIdentity !== "undefined") ? SharedIdentity.get() : null;
    const eidRecord = VATSIM.getEmiratesIdRecord();
    const eidNumber = (eidRecord && eidRecord.idNumber) || (shared && shared.emiratesId);
    if (eidNumber) {
      const btn = document.getElementById("btnEidEntry");
      const note = document.getElementById("eidStatusNote");
      btn.textContent = "🪪 Emirates ID on file — View";
      note.textContent = "Emirates ID " + eidNumber + " is already on record for this student.";
      note.style.display = "";
    }

    const uaePass = VATSIM.getUaePass();
    const note2 = document.getElementById("uaePassStatusNote");
    if (uaePass) {
      document.getElementById("btnUaePassCreate").textContent = "＋ Create Another UAE PASS";
      note2.textContent = "UAE PASS linked for " + uaePass.firstName + " " + uaePass.lastName + ".";
      note2.style.display = "";
    } else if (shared && shared.hasUaePass) {
      // A UAE PASS was created via the standalone flow / on this browser
      // under a different active student — flag it rather than staying
      // silent, since VATSIM.getUaePass() is namespaced per active student.
      note2.textContent = "A UAE PASS exists for " + (shared.fullNameEn || "this student") + " on this browser — switch student if you don't see it below.";
      note2.style.display = "";
    }
  })();

  /* ---------------- Captcha ---------------- */
  function randomCode() {
    let c = "";
    for (let i = 0; i < 6; i++) c += Math.floor(Math.random() * 10);
    return c;
  }
  let currentCaptcha = randomCode();
  function paintCaptcha() {
    document.getElementById("captchaCode").textContent = currentCaptcha;
  }
  paintCaptcha();
  document.getElementById("btnRefreshCaptcha").addEventListener("click", () => {
    currentCaptcha = randomCode();
    paintCaptcha();
    document.getElementById("captcha").value = "";
  });

  /* ---------------- Field validation helpers ---------------- */
  function setInvalid(fieldId, invalid) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.classList.toggle("invalid", invalid);
  }

  /* ---------------- Login form ---------------- */
  document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const captcha = document.getElementById("captcha").value.trim();

    let ok = true;
    setInvalid("fEmail", !email);
    setInvalid("fPassword", !password);
    if (!email) ok = false;
    if (!password) ok = false;

    const captchaOk = captcha === currentCaptcha;
    setInvalid("fCaptcha", !captchaOk);
    if (!captchaOk) ok = false;

    if (!ok) {
      VATSIM.toast("Please correct the highlighted fields.", "error");
      return;
    }

    // Look up by email across every known student on this browser — not
    // just whichever namespace happens to be active right now. This is
    // what makes "log out, then log back in with the same email" work:
    // the active slot may have been reset since you logged out, but your
    // account itself never moved.
    const found = VATSIM.findAccountByEmail(email);
    if (!found) {
      VATSIM.toast("No account found for this email. Please sign up first.", "error");
      setInvalid("fEmail", true);
      return;
    }
    const account = found.account;
    if (account.password !== password) {
      VATSIM.toast("Incorrect password.", "error");
      setInvalid("fPassword", true);
      return;
    }

    VATSIM.showLoading("Verifying credentials…", 700).then(() => {
      const activeId = VATSIM.getActiveStudentId();
      if (found.id !== activeId) {
        // Re-point the active pointer at the account we just found, and
        // write the session directly into ITS namespace — KEYS on this
        // page load is still bound to the OLD active id, so it can't be
        // used for this; the next page load will resolve correctly now
        // that the pointer has been switched.
        VATSIM.switchActiveStudent(found.id);
        VATSIM.setSessionForStudent(found.id, { email: account.email, loggedInAt: new Date().toISOString() });
      } else {
        VATSIM.setSession({ email: account.email, loggedInAt: new Date().toISOString() });
      }
      window.location.href = "pages/user-type.html";
    });
  });

  document.getElementById("linkForgot").addEventListener("click", (e) => {
    e.preventDefault();
    VATSIM.toast("This is a training simulator — use the password you set at Sign Up.", "info");
  });
  document.getElementById("linkFaq").addEventListener("click", (e) => {
    e.preventDefault();
    VATSIM.toast("FAQs: This simulator recreates the VAT201 filing workflow for practice. No real data leaves your browser.", "info");
  });

  document.getElementById("btnUaePass").addEventListener("click", () => {
    // uaepass-login.html now resolves the right student itself (by UAE
    // PASS number, Emirates ID, mobile, or email, or an uploaded
    // document) regardless of which student happens to be active on
    // this browser right now — so there's nothing to pre-check here.
    window.location.href = "uaepass-login.html";
  });
})();
