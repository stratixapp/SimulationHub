/* Dot ERP — sign-in, first-run setup and password recovery. Uses ERP_UserRepository (data/users.js). */
(function () {
  "use strict";
  const R = ERP_UserRepository;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const SESSION_KEY = "erp_active_session";
  const REMEMBER_KEY = "erp_remembered_username";
  const VIEWS = ["SignIn", "Setup", "RecoveryKey", "Forgot"];

  const toast = (msg, type, title) => { if (window.ERP && window.ERP.showToast) window.ERP.showToast(msg, type || "info", { title }); };
  function show(name) {
    VIEWS.forEach((v) => { $("#view" + v).hidden = v !== name; });
    const first = $("#view" + name + " input:not([type=checkbox])"); if (first) setTimeout(() => first.focus(), 60);
  }
  function setErr(id, msg) { const el = $("#" + id + "Error"); if (el) el.textContent = msg || ""; const inp = $("#" + id); if (inp) { const w = inp.closest(".af-input"); if (w) w.classList.toggle("has-error", !!msg); } }
  const clearErrs = (ids) => ids.forEach((i) => setErr(i, ""));
  function busy(btn, on, label) { btn.disabled = on; $(".af-spin", btn).hidden = !on; if (label) $(".af-label", btn).textContent = on ? label : btn.dataset.label; }
  function shake() { const c = $("#authCard"); c.classList.remove("is-shaking"); void c.offsetWidth; c.classList.add("is-shaking"); }

  function startSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      sessionId: "SES-" + Math.random().toString(36).slice(2, 10).toUpperCase(), userId: user.id, username: user.username,
      role: user.role, fullName: user.fullName, department: user.department, loginTime: new Date().toISOString()
    }));
  }

  /* ---- password visibility + caps lock ---- */
  $$("[data-eye]").forEach((b) => b.addEventListener("click", () => {
    const i = $("#" + b.dataset.eye); const show = i.type === "password"; i.type = show ? "text" : "password"; b.setAttribute("aria-label", show ? "Hide password" : "Show password");
  }));
  ["keydown", "keyup"].forEach((ev) => $("#siPass").addEventListener(ev, (e) => { $("#siCaps").hidden = !(e.getModifierState && e.getModifierState("CapsLock")); }));
  $("#siPass").addEventListener("blur", () => { $("#siCaps").hidden = true; });

  /* ================= SIGN IN ================= */
  let lockTimer = null;
  function lockUI(until) {
    const box = $("#siLock"), btn = $("#siBtn");
    const tick = () => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      $("#siLockTimer").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
      if (s <= 0) { clearInterval(lockTimer); lockTimer = null; box.hidden = true; btn.disabled = false; }
    };
    box.hidden = false; btn.disabled = true; tick(); clearInterval(lockTimer); lockTimer = setInterval(tick, 500);
  }
  $("#siUser").addEventListener("input", () => setErr("siUser", ""));
  $("#siPass").addEventListener("input", () => setErr("siPass", ""));
  $("#siUser").addEventListener("blur", () => { const u = $("#siUser").value.trim(); if (u) { const l = R.lockoutFor(u); if (l) lockUI(l); } });

  $("#signInForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = $("#siUser").value.trim(), password = $("#siPass").value;
    clearErrs(["siUser", "siPass"]);
    let ok = true;
    if (!username) { setErr("siUser", "Enter your username."); ok = false; }
    if (!password) { setErr("siPass", "Enter your password."); ok = false; }
    if (!ok) { shake(); return; }
    const locked = R.lockoutFor(username);
    if (locked) { lockUI(locked); shake(); return; }

    const btn = $("#siBtn"); busy(btn, true, "Signing in…");
    setTimeout(() => {                                    // let the spinner paint before the (deliberately slow) hash runs
      const res = R.authenticate(username, password);
      busy(btn, false, "Sign in");
      if (res.ok) {
        R.clearFailures(username); R.logSignIn(res.user.username, "SUCCESS");
        if ($("#siRemember").checked) localStorage.setItem(REMEMBER_KEY, res.user.username); else localStorage.removeItem(REMEMBER_KEY);
        startSession(res.user);
        window.location.href = res.user.mustChangePassword ? "pages/profile.html?forcePassword=1" : "pages/dashboard.html";
        return;
      }
      shake();
      if (res.reason === "inactive") {
        R.logSignIn(username, "FAILED");
        setErr("siUser", "This account has been deactivated. Contact your administrator.");
        return;
      }
      const f = R.registerFailure(username); R.logSignIn(username, "FAILED");
      setErr("siPass", "Incorrect username or password.");
      if (f.lockUntil) { lockUI(f.lockUntil); toast("Too many failed attempts. Sign-in is paused for 1 minute.", "danger", "Account locked"); }
      else if (f.left <= 2) toast(`${f.left} attempt${f.left === 1 ? "" : "s"} left before sign-in is paused.`, "warning", "Sign-in failed");
    }, 40);
  });
  $("#toForgot").addEventListener("click", () => { $("#fgUser").value = $("#siUser").value.trim(); show("Forgot"); });

  /* ================= FIRST-RUN SETUP ================= */
  const LABELS = ["", "Weak", "Fair", "Good", "Strong"];
  $("#suPass").addEventListener("input", () => {
    const v = $("#suPass").value, s = R.passwordStrength(v);
    $("#suMeter").dataset.s = v ? s : 0;
    $("#suMeterLabel").textContent = v ? (LABELS[s] || "Weak") + (s < 3 ? " — add length, capitals or symbols." : "") : "Use letters and numbers; longer is stronger.";
    setErr("suPass", "");
  });
  ["suName", "suEmail", "suUser", "suPass2"].forEach((id) => $("#" + id).addEventListener("input", () => setErr(id, "")));

  let pendingAdmin = null, pendingKey = "";
  $("#setupForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const d = { fullName: $("#suName").value.trim(), email: $("#suEmail").value.trim(), username: $("#suUser").value.trim(), password: $("#suPass").value };
    clearErrs(["suName", "suEmail", "suUser", "suPass", "suPass2"]);
    let ok = true;
    if (d.fullName.length < 2) { setErr("suName", "Enter your full name."); ok = false; }
    if (!ERP_EMAIL_PATTERN.test(d.email)) { setErr("suEmail", "Enter a valid email address."); ok = false; }
    if (!ERP_USERNAME_PATTERN.test(d.username)) { setErr("suUser", "Use 3–30 letters, numbers, dot or underscore."); ok = false; }
    const pp = R.passwordProblem(d.password); if (pp) { setErr("suPass", pp); ok = false; }
    if ($("#suPass2").value !== d.password) { setErr("suPass2", "Passwords don't match."); ok = false; }
    if (!ok) { shake(); return; }
    const btn = $("#suBtn"); busy(btn, true, "Creating account…");
    setTimeout(() => {
      const res = R.createAdministrator(d);
      busy(btn, false, "Create administrator account");
      if (!res.ok) { shake(); toast(res.error, "danger", "Couldn't create account"); return; }
      pendingAdmin = res.user; pendingKey = res.recoveryKey;
      R.logSignIn(res.user.username, "SUCCESS");
      $("#rkKey").textContent = pendingKey;
      show("RecoveryKey");
    }, 40);
  });

  $("#rkCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(pendingKey); toast("Recovery key copied.", "success"); }
    catch { const r = document.createRange(); r.selectNodeContents($("#rkKey")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Press Ctrl+C to copy the selected key.", "info"); }
  });
  $("#rkDownload").addEventListener("click", () => {
    const text = `Dot ERP — administrator recovery key\r\nUsername: ${pendingAdmin.username}\r\nRecovery key: ${pendingKey}\r\n\r\nKeep this file private. Anyone with this key can reset the administrator password.\r\nGenerated: ${new Date().toLocaleString()}\r\n`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = "dot-erp-recovery-key.txt";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("#rkConfirm").addEventListener("change", (e) => { $("#rkContinue").disabled = !e.target.checked; });
  $("#rkContinue").addEventListener("click", () => {
    startSession(pendingAdmin); pendingKey = "";
    window.location.href = "pages/create-company.html";
  });

  /* ================= FORGOT PASSWORD (recovery key) ================= */
  $("#fgBack").addEventListener("click", () => show("SignIn"));
  $("#fgKey").addEventListener("input", (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
    e.target.value = raw.match(/.{1,5}/g) ? raw.match(/.{1,5}/g).join("-") : ""; setErr("fgKey", "");
  });
  ["fgUser", "fgPass"].forEach((id) => $("#" + id).addEventListener("input", () => setErr(id, "")));
  $("#forgotForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = $("#fgUser").value.trim(), k = $("#fgKey").value, p = $("#fgPass").value;
    clearErrs(["fgUser", "fgKey", "fgPass"]);
    let ok = true;
    if (!u) { setErr("fgUser", "Enter your username."); ok = false; }
    if (k.replace(/-/g, "").length !== 20) { setErr("fgKey", "The recovery key has 20 characters."); ok = false; }
    const pp = R.passwordProblem(p); if (pp) { setErr("fgPass", pp); ok = false; }
    if (!ok) { shake(); return; }
    const btn = $("#fgBtn"); busy(btn, true, "Resetting…");
    setTimeout(() => {
      const res = R.recoverWithKey(u, k, p);
      busy(btn, false, "Reset password");
      if (!res.ok) { shake(); setErr("fgKey", res.error); return; }
      R.clearFailures(u); R.logSignIn(u, "PASSWORD_RESET");
      $("#forgotForm").reset(); $("#siUser").value = u; $("#siPass").value = "";
      show("SignIn"); $("#siPass").focus();
      toast("Password updated. Sign in with your new password.", "success", "Password reset");
    }, 40);
  });

  /* ================= boot ================= */
  ["siBtn", "suBtn", "fgBtn"].forEach((id) => { const b = $("#" + id); b.dataset.label = $(".af-label", b).textContent; });
  $("#footerYear").textContent = new Date().getFullYear();

  const params = new URLSearchParams(location.search), reason = params.get("reason");
  let session = null; try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { /* none */ }
  if (session && !reason && !R.isSetupRequired()) {
    const acct = R.findByUsername(session.username);
    if (acct && acct.status === "Active") { location.replace("pages/dashboard.html"); return; }
    sessionStorage.removeItem(SESSION_KEY);
  }
  if (R.isSetupRequired()) show("Setup");
  else {
    show("SignIn");
    const remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered) { $("#siUser").value = remembered; $("#siRemember").checked = true; setTimeout(() => $("#siPass").focus(), 70); }
  }
  if (reason === "timeout") toast("You were signed out after a period of inactivity.", "info", "Session timed out");
  if (reason === "revoked") toast("Your account was changed or deactivated. Please sign in again.", "info", "Signed out");
  if (reason) history.replaceState({}, "", location.pathname);
})();
