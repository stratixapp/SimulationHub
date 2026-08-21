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
  // Idle-timeout redirect lands here with ?timeout=1 — surface that so
  // it doesn't look like an unexplained logout.
  if (new URLSearchParams(window.location.search).get("timeout") === "1") {
    VATSIM.toast("You were signed out after 15 minutes of inactivity, for security — just like the real EmaraTax portal.", "info");
  }

  if (VATSIM.getSession() && VATSIM.getAccount()) {
    const tp = VATSIM.getSelectedTaxablePerson();
    window.location.href = tp === "own" ? "pages/dashboard.html" : "pages/demo-company.html?id=" + tp;
    return;
  }

  // Show "Switch Student" once more than one student profile exists on this browser.
  if (VATSIM.getStudentRegistry().length > 1) {
    document.getElementById("btnSwitchStudent").style.display = "";
  }

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

    const account = VATSIM.getAccount();
    if (!account || account.email.toLowerCase() !== email.toLowerCase()) {
      VATSIM.toast("No account found for this email. Please sign up first.", "error");
      setInvalid("fEmail", true);
      return;
    }
    if (account.password !== password) {
      VATSIM.toast("Incorrect password.", "error");
      setInvalid("fPassword", true);
      return;
    }

    VATSIM.showLoading("Verifying credentials…", 700).then(() => {
      VATSIM.setSession({ email: account.email, loggedInAt: new Date().toISOString() });
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
    const account = VATSIM.getAccount();
    if (!account) {
      VATSIM.toast("Create an account first — UAE PASS sign-in needs a linked profile.", "warn");
      setTimeout(() => (window.location.href = "register.html"), 700);
      return;
    }
    if (!VATSIM.getUaePass()) {
      VATSIM.toast("No UAE PASS found yet — let's create one first.", "info");
      setTimeout(() => (window.location.href = "uaepass-create.html"), 700);
      return;
    }
    window.location.href = "uaepass-login.html";
  });
})();
