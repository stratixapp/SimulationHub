/* ============================================================
   TCOS TRAINING SIMULATOR — APP CONTROLLER
   ============================================================ */

var CURRENT_SCREEN = 'dashboard';
var CURRENT_FILING_ID = null;
var CURRENT_LIST_FILTER = 'all';

/* ---------------- GLOBAL ERROR SAFETY NET (Section 30) ----------------
   Every workflow-mutating function already guards its own known failure
   modes with friendly toasts. This is the backstop for anything that still
   slips through (a coding mistake, an unexpected data shape) — instead of
   a raw exception leaving a blank or half-rendered screen, the user sees a
   plain-language message and can recover, while the real error still goes
   to the console for debugging. It also protects data: STATE is only ever
   written to localStorage inside saveState() after a step completes, so an
   exception here means the last SAVED state is untouched. */
var __lastErrorToastAt = 0;
function reportUnexpectedError(err, context) {
  console.error('[TCOS unexpected error]', context || '', err);
  const now = Date.now();
  if (now - __lastErrorToastAt < 2000) return; // avoid stacking multiple toasts from one cascade
  __lastErrorToastAt = now;
  if (typeof toast === 'function') {
    toast('Something went wrong loading that screen. Your saved data is safe — try the Dashboard link in the sidebar.', 'error');
  }
}
window.addEventListener('error', (e) => reportUnexpectedError(e.error || e.message, 'window.onerror'));
window.addEventListener('unhandledrejection', (e) => reportUnexpectedError(e.reason, 'unhandledrejection'));

/* ---------------- LIVE CLOCK ---------------- */
function updateLiveDateTime() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
  const node = document.getElementById('liveDateTime');
  if (node) node.textContent = date + ' | ' + time;
}
updateLiveDateTime();
setInterval(updateLiveDateTime, 1000);

/* ---------------- HOME / LOGIN / REGISTRATION (preserved & wired) ---------------- */
function showLogin() {
  document.getElementById('loader').classList.add('show');
  setTimeout(function () {
    document.getElementById('loader').classList.remove('show');
    document.getElementById('home').classList.remove('active');
    document.getElementById('login').classList.add('active');
    window.scrollTo(0, 0);
  }, 900);
}
function showHome() { document.getElementById('login').classList.remove('active'); document.getElementById('home').classList.add('active'); window.scrollTo(0, 0); }
function togglePw() { document.getElementById('pwd').type = document.getElementById('showpw').checked ? 'text' : 'password'; }
function moduleInfo(x) { toast(x + ' — Training simulator module.', 'info'); }
function fillDemo(uid) {
  const cred = DEMO_CREDENTIALS.find(c => c.userId === uid);
  document.getElementById('uid').value = uid;
  document.getElementById('pwd').value = cred.password;
  const radios = document.querySelectorAll('input[name="ut"]');
  if (radios.length === 2) { radios[0].checked = !cred.isTrainerAccount; radios[1].checked = !!cred.isTrainerAccount; }
}
function login() {
  const uid = document.getElementById('uid').value.trim();
  const pwd = document.getElementById('pwd').value.trim();
  const errBox = document.getElementById('loginError');
  errBox.textContent = '';
  if (!uid || !pwd) { errBox.textContent = 'Please enter both Simulator ID and Password.'; return; }
  const cred = findCredential(uid);
  if (!cred || cred.password !== pwd) {
    errBox.textContent = 'Invalid Simulator ID or Password. Use one of the training demo credentials shown below.';
    return;
  }
  const wantsTrainer = !!(document.querySelectorAll('input[name="ut"]')[1] && document.querySelectorAll('input[name="ut"]')[1].checked);
  /* Section 5 hardening: Trainer / Instructor is a distinct credential (TRAINER.ADMIN), not a
     privilege any trade-user account can grant itself by ticking a radio button. */
  if (wantsTrainer && !cred.isTrainerAccount) {
    errBox.textContent = 'This Simulator ID is a trade-user account and cannot sign in as Trainer / Instructor. Use the Trainer demo credential shown below.';
    return;
  }
  if (!wantsTrainer && cred.isTrainerAccount) {
    errBox.textContent = 'This Simulator ID is a Trainer / Instructor account — tick "Trainer / Instructor" above to continue.';
    return;
  }
  const profile = Object.assign({}, cred);
  CURRENT_USER_ID = cred.userId;
  loadState(); // load (or create) this profile's own private data namespace
  STATE.user = { loggedIn: true, userId: cred.userId, profile: profile, loggedInAsTrainer: !!cred.isTrainerAccount };
  saveState();
  saveSession({ userId: cred.userId, loggedInAsTrainer: !!cred.isTrainerAccount });
  if (window.DOT_SUITE_AUTH) {
    window.DOT_SUITE_AUTH.setAccount({
      userId: cred.userId, name: cred.name, role: cred.role,
      isTrainer: !!cred.isTrainerAccount, source: 'tcos', signedInAt: Date.now()
    });
  }
  enterApp();
}
function logout() {
  confirmDialog('Log out of the training simulator?', () => {
    saveSession(null);
    if (window.DOT_SUITE_AUTH) window.DOT_SUITE_AUTH.clearAccount();
    CURRENT_USER_ID = null;
    STATE = defaultState();
    document.getElementById('app').classList.remove('active');
    document.getElementById('home').classList.add('active');
    document.getElementById('login').classList.remove('active');
    window.scrollTo(0, 0);
    try { history.pushState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  });
}
function enterApp() {
  document.getElementById('login').classList.remove('active');
  document.getElementById('home').classList.remove('active');
  document.getElementById('app').classList.add('active');
  document.getElementById('appUserLabel').textContent = STATE.user.profile.name + ' (' + STATE.user.profile.role + ')';
  applyRoleAccess(STATE.user.profile.role);
  if (typeof resolvePendingAmendments === 'function') resolvePendingAmendments();
  if (typeof resolvePendingDocuments === 'function' && STATE.filings) {
    STATE.filings.forEach(f => resolvePendingDocuments(f));
  }
  const hashScreen = location.hash ? location.hash.slice(1) : null;
  const restore = hashScreen && $('#screen-' + hashScreen) ? hashScreen : null;
  navTo(restore || (STATE.user.profile.role === 'Trainer / Instructor' ? 'trainer' : 'dashboard'));
}

/* ---------------- ROLE-BASED SIDEBAR ACCESS (Section 6) ---------------- */
function applyRoleAccess(role) {
  const allowed = ROLE_SIDEBAR_GROUPS[role] || null;
  const titles = $all('.side-title');
  titles.forEach(title => {
    const group = title.getAttribute('data-group');
    const show = !allowed || allowed.includes(group);
    title.style.display = show ? '' : 'none';
    let sib = title.nextElementSibling;
    while (sib && !sib.classList.contains('side-title')) {
      sib.style.display = show ? '' : 'none';
      sib = sib.nextElementSibling;
    }
  });
}

/* ---------------- CENTRAL PERMISSION SYSTEM (Section 4) ----------------
   Sidebar hiding above is cosmetic only. Every operation that must actually
   be restricted to a role checks hasPermission() before it runs — hiding a
   link never substitutes for gating the operation itself, so this still
   blocks direct navigation (URL hash, browser back/forward, a stale link)
   into a screen or action the current role isn't allowed to use. */
function hasPermission(permission) {
  if (!STATE || !STATE.user || !STATE.user.profile) return false;
  const role = STATE.user.profile.role;
  switch (permission) {
    case 'trainer_console': return role === 'Trainer / Instructor';
    case 'broker_client_select': return role === 'Customs Broker';
    default: return true;
  }
}

/* Registration (preserved from original, cosmetic training flow) */
var regStep = 0;
var regState = { gstValid: false, iecValid: false, panValid: false, crossChecked: false, mobileOtpSent: false, mobileVerified: false, emailOtpSent: false, emailVerified: false, dscVerified: false };
const REG_STEP_COUNT = 12;

/* ---- Registered-user credential store (persisted, separate from the fixed DEMO_CREDENTIALS list) ---- */
const REGISTERED_USERS_KEY = 'icegate_training_registered_users_v1';
function loadRegisteredUsers() {
  try { return JSON.parse(localStorage.getItem(REGISTERED_USERS_KEY) || '[]'); }
  catch (e) { return []; }
}
function saveRegisteredUsers(list) {
  try { localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(list)); }
  catch (e) { console.error('Unable to save registered users', e); }
}
function findCredential(uid) {
  const all = DEMO_CREDENTIALS.concat(loadRegisteredUsers());
  return all.find(c => c.userId.toLowerCase() === (uid || '').toLowerCase());
}
/* Builds a Login ID from the registrant's name, e.g. "Rahul Mehta" -> "RAHUL.MEHTA".
   Appends a numeric suffix if that ID is already taken (by a demo account or an earlier registration). */
function generateLoginId(fullName) {
  const base = (fullName || 'TRAINEE').trim().toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(Boolean).join('.') || 'TRAINEE';
  let candidate = base;
  let n = 2;
  while (findCredential(candidate)) { candidate = base + n; n++; }
  return candidate;
}
function openReg() {
  document.getElementById('reg').classList.add('show');
  regStep = 0;
  regState = { gstValid: false, iecValid: false, panValid: false, crossChecked: false, mobileOtpSent: false, mobileVerified: false, emailOtpSent: false, emailVerified: false, dscVerified: false };
  document.getElementById('form').style.display = '';
  document.querySelector('#reg .steps').style.display = '';
  document.getElementById('success').classList.remove('on');
  document.getElementById('regPassword').value = '';
  document.getElementById('regPasswordConfirm').value = '';
  document.getElementById('regPasswordStatus').textContent = '';
  document.getElementById('regPasswordStatus').className = 'status';
  renderReg();
}
function closeReg() { document.getElementById('reg').classList.remove('show'); }
function renderReg() {
  for (let i = 0; i < REG_STEP_COUNT; i++) {
    document.getElementById('p' + i).classList.toggle('on', i === regStep);
    document.getElementById('s' + i).classList.toggle('on', i <= regStep);
  }
  document.getElementById('back2').style.display = regStep ? 'inline-block' : 'none';
  document.getElementById('next').style.display = regStep < REG_STEP_COUNT - 1 ? 'inline-block' : 'none';
  document.getElementById('submit').style.display = regStep === REG_STEP_COUNT - 1 ? 'inline-block' : 'none';
  if (regStep === 10) {
    document.getElementById('summary').innerHTML =
      '<table class="kv-table">' +
      '<tr><td>Role</td><td>' + esc(document.getElementById('role').value) + '</td></tr>' +
      '<tr><td>Organization</td><td>' + esc(document.getElementById('org').value || 'Not entered') + '</td></tr>' +
      '<tr><td>GSTIN</td><td>' + esc(document.getElementById('gst').value || 'Not entered') + (regState.gstValid ? ' ✓' : '') + '</td></tr>' +
      '<tr><td>IEC</td><td>' + esc(document.getElementById('iec').value || 'Not entered') + (regState.iecValid ? ' ✓' : '') + '</td></tr>' +
      '<tr><td>PAN</td><td>' + esc(document.getElementById('pan').value || 'Not entered') + (regState.panValid ? ' ✓' : '') + '</td></tr>' +
      '<tr><td>Authorized Person</td><td>' + esc(document.getElementById('person').value || 'Not entered') + '</td></tr>' +
      '<tr><td>Cross-Validation</td><td>' + (regState.crossChecked ? 'Completed' : 'Not run') + '</td></tr>' +
      '<tr><td>Mobile Verified</td><td>' + (regState.mobileVerified ? 'Yes' : 'No') + '</td></tr>' +
      '<tr><td>Email Verified</td><td>' + (regState.emailVerified ? 'Yes' : 'No') + '</td></tr>' +
      '<tr><td>DSC Signature</td><td>' + (regState.dscVerified ? 'Verified' : 'Not verified') + '</td></tr>' +
      '</table><p class="hint">Ready for simulated submission.</p>';
  }
}
function next() {
  if (regStep === 1 && !document.getElementById('org').value.trim()) { toast('Enter Organization / Firm Name for this training step.', 'error'); return; }
  if (regStep === 2 && !regState.gstValid) { toast('Validate GSTIN before continuing.', 'error'); return; }
  if (regStep === 3 && !regState.iecValid) { toast('Validate IEC before continuing.', 'error'); return; }
  if (regStep === 4 && !regState.panValid) { toast('Validate PAN before continuing.', 'error'); return; }
  if (regStep === 4 && !document.getElementById('person').value.trim()) { toast('Enter Authorized Person Name — your Login ID will be generated from this.', 'error'); return; }
  if (regStep === 10) {
    const pwd = document.getElementById('regPassword').value;
    const pwd2 = document.getElementById('regPasswordConfirm').value;
    const status = document.getElementById('regPasswordStatus');
    if (pwd.length < 6) { status.textContent = 'Password must be at least 6 characters.'; status.className = 'status err'; toast('Create a password of at least 6 characters.', 'error'); return; }
    if (pwd !== pwd2) { status.textContent = 'Passwords do not match.'; status.className = 'status err'; toast('Password and confirmation do not match.', 'error'); return; }
    status.textContent = 'Password looks good.'; status.className = 'status ok';
  }
  if (regStep < REG_STEP_COUNT - 1) { regStep++; renderReg(); }
}
function prev() { if (regStep) { regStep--; renderReg(); } }

function validateGSTIN() {
  const v = (document.getElementById('gst').value || '').trim().toUpperCase();
  const re = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}$/;
  const status = document.getElementById('gststatus');
  regState.gstValid = re.test(v);
  status.textContent = regState.gstValid ? 'Format valid (training check only).' : 'Invalid GSTIN format — expected 15 characters (2-digit state + 10-char PAN + entity code + Z + checksum).';
  status.className = 'status ' + (regState.gstValid ? 'ok' : 'err');
}
function validateIEC() {
  const v = (document.getElementById('iec').value || '').trim();
  const re = /^\d{10}$/;
  const status = document.getElementById('iecstatus');
  regState.iecValid = re.test(v);
  status.textContent = regState.iecValid ? 'Format valid (training check only).' : 'Invalid IEC format — expected 10 digits.';
  status.className = 'status ' + (regState.iecValid ? 'ok' : 'err');
}
function validatePAN() {
  const v = (document.getElementById('pan').value || '').trim().toUpperCase();
  const re = /^[A-Z]{5}\d{4}[A-Z]{1}$/;
  const status = document.getElementById('panstatus');
  regState.panValid = re.test(v);
  status.textContent = regState.panValid ? 'Format valid (training check only).' : 'Invalid PAN format — expected 5 letters + 4 digits + 1 letter.';
  status.className = 'status ' + (regState.panValid ? 'ok' : 'err');
}
function runCrossValidation() {
  const gst = (document.getElementById('gst').value || '').toUpperCase();
  const pan = (document.getElementById('pan').value || '').toUpperCase();
  const iec = (document.getElementById('iec').value || '');
  const org = document.getElementById('org').value || '';
  const gstPanSegment = gst.length >= 12 ? gst.slice(2, 12) : '';
  const gstPanMatch = pan && gstPanSegment === pan;
  const box = document.getElementById('crossResult');
  regState.crossChecked = true;
  box.innerHTML = `<table class="kv-table">
    <tr><td>GSTIN ↔ PAN</td><td>${gstPanMatch ? '✓ PAN segment embedded in GSTIN matches' : '⚠ PAN segment inside GSTIN does not match the PAN entered — in a real filing this would trigger a query. Re-check both numbers.'}</td></tr>
    <tr><td>IEC ↔ PAN</td><td>${iec && pan ? '✓ Linked for this training profile (simulated)' : '⚠ Enter both IEC and PAN to link them'}</td></tr>
    <tr><td>Organization Name Match</td><td>${org ? '✓ Organization name recorded and will be used across all documents' : '⚠ Organization name missing'}</td></tr>
  </table>`;
}
function otp(x) {
  document.getElementById(x).textContent = 'Training OTP sent. Demo OTP available in Training Console: 123456.';
  document.getElementById(x).className = 'status ok';
  if (x === 'ms') regState.mobileOtpSent = true; else regState.emailOtpSent = true;
}
function verifyOtp(kind) {
  const inputId = kind === 'mobile' ? 'mobileOtpInput' : 'emailOtpInput';
  const statusId = kind === 'mobile' ? 'mobileOtpStatus' : 'emailOtpStatus';
  const sent = kind === 'mobile' ? regState.mobileOtpSent : regState.emailOtpSent;
  const val = (document.getElementById(inputId).value || '').trim();
  const status = document.getElementById(statusId);
  if (!sent) { status.textContent = 'Send the OTP first.'; status.className = 'status err'; return; }
  const okv = val === '123456';
  if (kind === 'mobile') regState.mobileVerified = okv; else regState.emailVerified = okv;
  status.textContent = okv ? 'Verified.' : 'Incorrect OTP — training demo OTP is 123456.';
  status.className = 'status ' + (okv ? 'ok' : 'err');
}
function picked(a, x) { document.getElementById(x).textContent = a.files.length ? 'Selected: ' + a.files[0].name : ''; }
function verifyDSC() {
  const cert = document.getElementById('dscCert').value;
  const pin = (document.getElementById('dscPin').value || '').trim();
  const status = document.getElementById('dscStatus');
  regState.dscVerified = !!cert && /^\d{4,6}$/.test(pin);
  status.textContent = regState.dscVerified ? 'Digital signature verified (simulated).' : 'Select a certificate and enter a 4–6 digit demo PIN to simulate signing.';
  status.className = 'status ' + (regState.dscVerified ? 'ok' : 'err');
}
function submitReg() {
  const pwd = document.getElementById('regPassword').value;
  const pwd2 = document.getElementById('regPasswordConfirm').value;
  if (pwd.length < 6 || pwd !== pwd2) {
    toast('Please go back and create a valid, matching password before submitting.', 'error');
    regStep = 10; renderReg();
    return;
  }
  const personName = document.getElementById('person').value.trim() || 'Trainee';
  const newUid = generateLoginId(personName);
  const newCred = {
    userId: newUid,
    password: pwd,
    role: document.getElementById('role').value,
    name: personName,
    iec: document.getElementById('iec').value.trim() || '—',
    gstin: document.getElementById('gst').value.trim().toUpperCase() || '—',
    pan: document.getElementById('pan').value.trim().toUpperCase() || '—',
    isTrainerAccount: false
  };
  const registered = loadRegisteredUsers();
  registered.push(newCred);
  saveRegisteredUsers(registered);

  document.getElementById('form').style.display = 'none';
  document.querySelector('#reg .steps').style.display = 'none';
  document.getElementById('success').classList.add('on');
  document.getElementById('ref').textContent = 'TRAIN-TCOS-' + Math.floor(100000 + Math.random() * 900000);
  document.getElementById('regNewUid').textContent = newCred.userId;
  document.getElementById('regNewPwd').textContent = newCred.password;
}
function proceedToLoginFromReg() {
  const uid = document.getElementById('regNewUid').textContent;
  const pwd = document.getElementById('regNewPwd').textContent;
  closeReg();
  showLogin();
  document.getElementById('uid').value = uid;
  document.getElementById('pwd').value = pwd;
}

/* ---------------- APP NAVIGATION ---------------- */
var SUPPRESS_HISTORY = false;
function navTo(screen) {
  if (screen === 'trainer' && !hasPermission('trainer_console')) {
    toast('You do not have permission to view the Trainer Console.', 'error');
    screen = 'dashboard';
  }
  CURRENT_SCREEN = screen;
  $all('.app-screen').forEach(s => s.classList.remove('active'));
  const target = $('#screen-' + screen);
  if (target) target.classList.add('active');
  $all('.side-link').forEach(l => l.classList.toggle('active', l.dataset.s === screen));
  refreshNotifDot();
  window.scrollTo(0, 0);
  if (!SUPPRESS_HISTORY) {
    try { history.pushState({ screen: screen }, '', '#' + screen); } catch (e) { /* pushState unsupported in this environment — safe to ignore */ }
  }
  try {
    if (screen === 'dashboard') renderDashboard();
    if (screen === 'amendments') renderAmendments();
    if (screen === 'enquiry') renderEnquiry();
    if (screen === 'doccentre') renderDocCentre();
    if (screen === 'notifications') renderNotifications();
    if (screen === 'assessment') renderAssessment();
    if (screen === 'settings') renderSettings();
    if (screen === 'manifest') renderManifestRegister();
    if (screen === 'scenlibrary') renderScenarioLibrary();
    if (screen === 'jobsim') renderJobSimulator();
    if (screen === 'knowledge') renderKnowledgePanel();
    if (screen === 'errorlab') renderErrorLab();
    if (screen === 'compliance') renderComplianceLab();
    if (screen === 'certificate') renderCertificate();
    if (screen === 'trainer') renderTrainerConsole();
    if (screen === 'incentives') renderIncentivesCentre();
    if (screen === 'bonds') renderBondRegister();
    if (screen === 'containertrack') renderContainerTracker();
    if (screen === 'ratecompare') renderRateComparison();
  } catch (e) {
    /* Section 30: a render function throwing must never leave a blank/half-built screen
       with no way back — log it, tell the user plainly, and fall back to the dashboard,
       which is the one screen we can render with no external inputs. */
    console.error('[TCOS render error]', screen, e);
    if (target) target.innerHTML = '<div class="alert alert-error" style="margin:20px">Unable to load this screen. Your saved training data is unaffected — use the sidebar to go back to the Dashboard.</div>';
    toast('Unable to load that screen.', 'error');
  }
}
window.addEventListener('popstate', function (e) {
  const screen = (e.state && e.state.screen) || (location.hash ? location.hash.slice(1) : null);
  if (STATE && STATE.user && STATE.user.loggedIn && screen && $('#screen-' + screen)) {
    SUPPRESS_HISTORY = true;
    navTo(screen);
    SUPPRESS_HISTORY = false;
  }
});
function navToFiling(id) { CURRENT_FILING_ID = id; navTo('filingDetail'); renderFilingDetail(id); }
function navToFilingList(filter) { CURRENT_LIST_FILTER = filter; navTo('filingList'); renderFilingList(); }

function refreshNotifDot() {
  const dot = $('#notifDot');
  if (!dot) return;
  const c = unreadCount();
  dot.style.display = c ? 'inline-block' : 'none';
}

/* ---------------- DASHBOARD ---------------- */
function renderDashboard() {
  const host = $('#screen-dashboard');
  const filings = STATE.filings;
  const counts = {
    draft: filings.filter(f => f.status === 'DRAFT').length,
    submitted: filings.filter(f => ['SUBMITTED', 'ACKNOWLEDGED', 'UNDER_PROCESS'].includes(f.status)).length,
    query: filings.filter(f => f.status === 'QUERY_RAISED').length,
    exam: filings.filter(f => f.status === 'EXAMINATION').length,
    duty: filings.filter(f => f.status === 'DUTY_PENDING').length,
    cleared: filings.filter(f => ['LEO', 'OOC', 'COMPLETED'].includes(f.status)).length
  };
  const recent = filings.slice(0, 6);
  const bookings = STATE.bookings;
  const bookingCounts = {
    active: bookings.filter(b => !['DRAFT_BOOKING', 'COMPLETED', 'REJECTED'].includes(b.status)).length,
    delivered: bookings.filter(b => b.status === 'COMPLETED').length
  };
  const recentBookings = bookings.slice(0, 5);
  const { level, stats } = computeCurrentLevel();
  const nextLvl = nextLevelInfo();
  host.innerHTML = `
    <div class="page-head"><div><div class="crumb">Home</div><h1>Welcome, ${esc(STATE.user.profile.name)}</h1></div></div>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-n">${counts.draft}</div><div class="kpi-l">Draft Filings</div></div>
      <div class="kpi"><div class="kpi-n">${counts.submitted}</div><div class="kpi-l">Submitted / In Process</div></div>
      <div class="kpi"><div class="kpi-n">${counts.query}</div><div class="kpi-l">Queries Pending</div></div>
      <div class="kpi"><div class="kpi-n">${counts.exam}</div><div class="kpi-l">Under Examination</div></div>
      <div class="kpi"><div class="kpi-n">${counts.duty}</div><div class="kpi-l">Duty Pending</div></div>
      <div class="kpi"><div class="kpi-n">${counts.cleared}</div><div class="kpi-l">Cleared / Completed</div></div>
      <div class="kpi"><div class="kpi-n">${bookingCounts.active}</div><div class="kpi-l">Freight Bookings Active</div></div>
      <div class="kpi"><div class="kpi-n">${bookingCounts.delivered}</div><div class="kpi-l">Freight Delivered</div></div>
    </div>
    <h3>Training Progress</h3>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-n">${level.id}</div><div class="kpi-l">Current Level — ${esc(level.name)}</div></div>
      <div class="kpi"><div class="kpi-n">${stats.completed}</div><div class="kpi-l">Filings Completed</div></div>
      <div class="kpi"><div class="kpi-n">${stats.avg}%</div><div class="kpi-l">Avg. Assessment Score</div></div>
      <div class="kpi"><div class="kpi-n">${completedScenarioIds().length}/${SCENARIOS.length}</div><div class="kpi-l">Scenarios Completed</div></div>
      <div class="kpi"><div class="kpi-n">${STATE.jobSim.runs.length}</div><div class="kpi-l">Job Simulator Runs</div></div>
      <div class="kpi"><div class="kpi-n">${STATE.certificates.length}</div><div class="kpi-l">Certificates Earned</div></div>
    </div>
    ${nextLvl ? `<p class="hint">Next level: Level ${nextLvl.id} — ${esc(nextLvl.name)} (needs ${nextLvl.min} filings completed, ${nextLvl.avg}%+ average${nextLvl.freight ? `, ${nextLvl.freight}+ freight bookings completed` : ''}).</p>` : `<p class="hint">You've reached the highest training level — Senior Logistics Operations.</p>`}
    <h3>Quick Actions</h3>
    <div class="quick-grid">
      <button class="quick-btn" onclick="startFilingFlow('export')">🚢<span>New Export Filing</span></button>
      <button class="quick-btn" onclick="startFilingFlow('import')">📦<span>New Import Filing</span></button>
      <button class="quick-btn" onclick="startFreightBookingFlow()">🚚<span>New Freight Booking</span></button>
      <button class="quick-btn" onclick="navTo('doccentre')">🗂<span>e-Sanchit</span></button>
      <button class="quick-btn" onclick="navTo('enquiry')">🔍<span>Track Filing</span></button>
      <button class="quick-btn" onclick="navToFilingList('QUERY')">❓<span>Queries</span></button>
      <button class="quick-btn" onclick="navToFilingList('PAYMENT')">💳<span>Payments</span></button>
      <button class="quick-btn" onclick="navTo('doccentre')">📄<span>Documents</span></button>
      <button class="quick-btn" onclick="navTo('amendments')">✏️<span>Amendments</span></button>
      <button class="quick-btn" onclick="navTo('enquiry')">📨<span>Enquiries</span></button>
      <button class="quick-btn" onclick="navTo('scenlibrary')">🎯<span>Scenario Library</span></button>
      <button class="quick-btn" onclick="navTo('jobsim')">💼<span>Job Simulator</span></button>
      <button class="quick-btn" onclick="navTo('assessment')">🎓<span>Training Assessment</span></button>
      <button class="quick-btn" onclick="navTo('certificate')">🏅<span>Certificate</span></button>
    </div>
    <div class="two-col">
      <div>
        <h3>Recent Transactions</h3>
        ${recent.length ? filingsTableHTML(recent) : '<p class="hint">No filings yet. Use Quick Actions to start your first training filing.</p>'}
        <h3>Recent Freight Bookings</h3>
        ${recentBookings.length ? bookingsTableHTML(recentBookings) : '<p class="hint">No freight bookings yet.</p>'}
      </div>
      <div>
        <h3>Notifications</h3>
        ${notificationsPreviewHTML()}
      </div>
    </div>
  `;
}

function filingsTableHTML(list) {
  return `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Filing No.</th><th>Type</th><th>Party</th><th>Status</th><th>Updated</th><th></th></tr></thead>
    <tbody>${list.map(f => `<tr>
      <td>${esc(f.id)}</td>
      <td>${f.type === 'export' ? 'Shipping Bill' : 'Bill of Entry'}</td>
      <td>${esc(f.type === 'export' ? (f.party.exporterName || '—') : (f.party.importerName || '—'))}</td>
      <td><span class="badge ${STATUS_BADGE_CLASS[f.status]}">${STATUS_LABELS[f.status]}</span></td>
      <td>${fmtDate(f.updatedAt)}</td>
      <td><button class="btn-ghost sm" onclick="openFilingOrWizard('${f.id}')">Open</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
function openFilingOrWizard(id) {
  const f = getFiling(id);
  if (!f) return;
  if (f.status === 'DRAFT') resumeWizardFor(id); else navToFiling(id);
}

function notificationsPreviewHTML() {
  const list = STATE.notifications.slice(0, 6);
  if (!list.length) return '<p class="hint">No notifications yet.</p>';
  return `<ul class="notif-list">${list.map(n => `<li class="${n.read ? '' : 'unread'}"><span class="ndot"></span>${esc(n.text)} <span class="ntime">${fmtDateTime(n.ts)}</span></li>`).join('')}</ul>`;
}

/* ---------------- SCENARIO / NEW FILING FLOW ---------------- */
function startFilingFlow(type) {
  CURRENT_SCREEN = 'scenario';
  navTo('scenario');
  renderScenarioPicker(type);
}
const DIFFICULTY_BADGE = { Beginner: 'badge-green', Intermediate: 'badge-blue', Advanced: 'badge-amber', Professional: 'badge-red' };
var SCENARIO_DIFFICULTY_FILTER = 'all';
function renderScenarioPicker(type) {
  const host = $('#screen-scenario');
  let scenarios = SCENARIOS.filter(s => s.type === type);
  if (SCENARIO_DIFFICULTY_FILTER !== 'all') scenarios = scenarios.filter(s => s.difficulty === SCENARIO_DIFFICULTY_FILTER);
  const tiers = ['all', 'Beginner', 'Intermediate', 'Advanced', 'Professional'];
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Electronic Filing</div><h1>${type === 'export' ? 'New Export Filing — Shipping Bill' : 'New Import Filing — Bill of Entry'}</h1></div></div>
  <p class="hint">Choose a training scenario to pre-fill realistic shipment data, or start with a blank filing and enter your own details.</p>
  <div class="filter-tabs" style="margin-bottom:14px">
    ${tiers.map(t => `<button class="${SCENARIO_DIFFICULTY_FILTER === t ? 'on' : ''}" onclick="filterScenarios('${type}','${t}')">${t === 'all' ? 'All Levels' : t}</button>`).join('')}
  </div>
  <div class="scenario-grid">
    <div class="scenario-card blank" role="button" tabindex="0" onclick="beginFiling('${type}', null)">
      <h4>Blank Filing</h4><p>Start from scratch and enter all shipment details yourself.</p>
    </div>
    ${scenarios.map(s => `<div class="scenario-card" role="button" tabindex="0" onclick="beginFiling('${type}','${s.id}')">
      <h4>${esc(s.title)} ${completedScenarioIds().includes(s.id) ? '<span class="badge badge-green" style="margin-left:4px">✓ Done</span>' : ''}</h4>
      <span class="badge ${DIFFICULTY_BADGE[s.difficulty] || 'badge-grey'}" style="margin-bottom:6px;display:inline-block">${esc(s.difficulty || 'General')}</span>
      <p>${esc(s.desc)}</p>
    </div>`).join('')}
  </div>`;
}
function filterScenarios(type, tier) { SCENARIO_DIFFICULTY_FILTER = tier; renderScenarioPicker(type); }
function completedScenarioIds() {
  return STATE.filings.filter(f => ['LEO', 'OOC', 'COMPLETED'].includes(f.status) && f.scenarioId).map(f => f.scenarioId);
}
function beginFiling(type, scenarioId) {
  const scenario = scenarioId ? SCENARIOS.find(s => s.id === scenarioId) : null;
  const filing = startNewFiling(type, scenario);
  openWizard(filing);
}

/* ---------------- FILING LIST ---------------- */
var FILING_LIST_QUERY = '';
var FILING_LIST_TYPE = 'all';
function renderFilingList() {
  const host = $('#screen-filingList');
  let list = STATE.filings.slice();
  let title = 'All Filings';
  if (CURRENT_LIST_FILTER === 'DRAFT') { list = list.filter(f => f.status === 'DRAFT'); title = 'Draft Filings'; }
  else if (CURRENT_LIST_FILTER === 'QUERY') { list = list.filter(f => f.query && f.query.status !== 'QUERY RESOLVED'); title = 'Filings with Pending Queries'; }
  else if (CURRENT_LIST_FILTER === 'PAYMENT') { list = list.filter(f => f.type === 'import' && f.duty); title = 'Duty & Payments'; }
  if (FILING_LIST_TYPE !== 'all') list = list.filter(f => f.type === FILING_LIST_TYPE);
  if (FILING_LIST_QUERY) {
    const q = FILING_LIST_QUERY.toLowerCase();
    list = list.filter(f => f.id.toLowerCase().includes(q) ||
      (f.invoice.invoiceNo || '').toLowerCase().includes(q) ||
      (f.shipment.portOfLoading || '').toLowerCase().includes(q) ||
      (f.shipment.portOfDischarge || '').toLowerCase().includes(q) ||
      (f.type === 'export' ? f.party.exporterName : f.party.importerName || '').toLowerCase().includes(q));
  }
  list.sort((a, b) => b.updatedAt - a.updatedAt);

  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Electronic Filing</div><h1>${title}</h1></div>
  <div class="filter-tabs">
    <button class="${CURRENT_LIST_FILTER === 'all' ? 'on' : ''}" onclick="navToFilingList('all')">All</button>
    <button class="${CURRENT_LIST_FILTER === 'DRAFT' ? 'on' : ''}" onclick="navToFilingList('DRAFT')">Drafts</button>
    <button class="${CURRENT_LIST_FILTER === 'QUERY' ? 'on' : ''}" onclick="navToFilingList('QUERY')">Queries</button>
    <button class="${CURRENT_LIST_FILTER === 'PAYMENT' ? 'on' : ''}" onclick="navToFilingList('PAYMENT')">Payments</button>
  </div></div>
  <div class="search-row" style="margin-bottom:10px">
    <input id="filingListSearch" placeholder="Search by ID, invoice no., exporter/importer, port…" value="${esc(FILING_LIST_QUERY)}" oninput="filterFilingList(this.value)">
    <select id="filingListTypeSel" onchange="filterFilingListType(this.value)" style="border:1px solid #cbd3db;padding:8px 10px;font-size:13px">
      <option value="all" ${FILING_LIST_TYPE === 'all' ? 'selected' : ''}>All Types</option>
      <option value="export" ${FILING_LIST_TYPE === 'export' ? 'selected' : ''}>Export (Shipping Bill)</option>
      <option value="import" ${FILING_LIST_TYPE === 'import' ? 'selected' : ''}>Import (Bill of Entry)</option>
    </select>
  </div>
  ${list.length ? filingsTableHTML(list) : '<p class="hint">No filings match this filter.</p>'}
  `;
}
function filterFilingList(v) { FILING_LIST_QUERY = v; renderFilingList(); refocusEnd('filingListSearch'); }
function filterFilingListType(v) { FILING_LIST_TYPE = v; renderFilingList(); }
function refocusEnd(id) { const n = $('#' + id); if (n) { n.focus(); const v = n.value; n.value = ''; n.value = v; } }

/* ---------------- FILING DETAIL / TRACKING / PROCESSING ---------------- */
function renderFilingDetail(id) {
  const filing = getFiling(id);
  const host = $('#screen-filingDetail');
  if (!filing) { host.innerHTML = '<p class="hint">Filing not found.</p>'; return; }
  CURRENT_FILING_ID = id;
  const isExport = filing.type === 'export';

  host.innerHTML = `
  <div class="page-head">
    <div><div class="crumb">Electronic Filing / ${isExport ? 'Shipping Bill' : 'Bill of Entry'}</div>
    <h1>${esc(filing.id)} <span class="badge ${STATUS_BADGE_CLASS[filing.status]}">${STATUS_LABELS[filing.status]}</span></h1></div>
    <div><button class="btn-ghost" onclick="navToFilingList('all')">Back to List</button></div>
  </div>

  <div class="two-col">
    <div>
      <div class="wz-card">
        <h3>Filing Summary</h3>
        <table class="kv-table">
          <tr><td>${isExport ? 'Exporter' : 'Importer'}</td><td>${esc(isExport ? filing.party.exporterName : filing.party.importerName)}</td></tr>
          <tr><td>${isExport ? 'Consignee' : 'Supplier'}</td><td>${esc(isExport ? filing.counterparty.consigneeName : filing.counterparty.supplierName)}</td></tr>
          <tr><td>Invoice No.</td><td>${esc(filing.invoice.invoiceNo)}</td></tr>
          <tr><td>Invoice Value</td><td>${fmtMoney(filing.invoice.invoiceValue, filing.invoice.currency)}</td></tr>
          <tr><td>Port of Loading</td><td>${esc(filing.shipment.portOfLoading)}</td></tr>
          <tr><td>Port of Discharge</td><td>${esc(filing.shipment.portOfDischarge)}</td></tr>
          ${filing.ack ? `<tr><td>Acknowledgement</td><td>${esc(filing.ack.refNo)} (${fmtDate(filing.ack.date)})</td></tr>` : ''}
          ${filing.igm && filing.igm.verified ? `<tr><td>IGM No. / Line</td><td>${esc(filing.igm.igmNo)} / ${esc(filing.igm.lineNo)}</td></tr>` : ''}
          ${filing.egm ? `<tr><td>EGM No.</td><td>${esc(filing.egm.egmNo)} (${fmtDate(filing.egm.date)})</td></tr>` : ''}
          ${filing.dsc ? `<tr><td>Digitally Signed</td><td>${esc(filing.dsc.serialNo)} by ${esc(filing.dsc.signedBy)}</td></tr>` : ''}
          ${filing.brokerClientIec ? `<tr><td>Filed by Broker under POA</td><td>${esc(filing.poaRef)}</td></tr>` : ''}
        </table>
      </div>
      ${riskAssessmentCardHTML(filing)}
      ${processingPanelHTML(filing)}
      ${pgaPanelHTML(filing)}
      ${isExport && ['LEO', 'COMPLETED'].includes(filing.status) ? `<div class="wz-card"><h3>Export Benefits</h3><p class="hint">This shipment is eligible for Duty Drawback / RoDTEP claims and Bank Realisation tracking.</p><button class="btn-ghost" onclick="navTo('incentives')">Open Export Incentives &amp; Realisation Centre</button></div>` : ''}
      ${!isExport && filing.containers && filing.containers.length ? `<div class="wz-card"><h3>Container Tracking</h3><button class="btn-ghost" onclick="navTo('containertrack');setTimeout(()=>renderContainerTracker('${esc((filing.containers[0]||{}).containerNo||'')}'),0)">Track Container ${esc((filing.containers[0]||{}).containerNo||'')}</button></div>` : ''}
    </div>
    <div>
      <div class="wz-card">
        <h3>Timeline</h3>
        <ul class="timeline">${filing.timeline.slice().reverse().map(t => `<li><b>${esc(STATUS_LABELS[t.stage] || t.stage)}</b><span>${fmtDateTime(t.ts)}</span><div class="tnote">${esc(t.note)}</div></li>`).join('')}</ul>
      </div>
      ${filing.amendments && filing.amendments.length ? amendmentListForFilingHTML(filing) : ''}
    </div>
  </div>`;
}

function riskAssessmentCardHTML(filing) {
  if (!filing.riskAssessment) return '';
  const r = filing.riskAssessment;
  return `<div class="wz-card"><h3>Risk Assessment (RMS)</h3>
    <table class="kv-table"><tr><td>Risk Score</td><td>${r.score}/100</td></tr><tr><td>Risk Band</td><td><span class="badge ${r.band === 'High' ? 'badge-red' : (r.band === 'Medium' ? 'badge-amber' : 'badge-green')}">${esc(r.band)}</span></td></tr></table>
    <ul class="plain-list">${r.factors.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <p class="hint">Computed by the training Risk Management System from commodity risk, country risk, and trader filing history / AEO status (see Settings).</p>
  </div>`;
}

function processingPanelHTML(filing) {
  const s = filing.status;
  let panel = '';

  if (s === 'ACKNOWLEDGED') {
    panel = `<div class="wz-card"><h3>Customs Processing</h3>
      <p class="hint">The filing has been acknowledged. Proceed with system validation and risk assessment.</p>
      <button class="next" onclick="runCustomsProcessing('${filing.id}')">Proceed with Customs Processing</button>
      <button class="btn-ghost" onclick="navTo('doccentre')">View Acknowledgement</button>
    </div>`;
  } else if (s === 'QUERY_RAISED' && filing.query) {
    panel = `<div class="wz-card"><h3>Customs Query — ${esc(filing.query.number)}</h3>
      <table class="kv-table">
        <tr><td>Query Number</td><td>${esc(filing.query.number)}</td></tr>
        <tr><td>Filing Number</td><td>${esc(filing.id)}</td></tr>
        <tr><td>Date</td><td>${fmtDateTime(filing.query.date)}</td></tr>
        <tr><td>Officer / Section</td><td>${esc(filing.query.officer)}</td></tr>
        <tr><td>Status</td><td><span class="badge badge-red">${esc(filing.query.status)}</span></td></tr>
      </table>
      <div class="alert alert-error" style="margin-top:10px"><b>Query:</b> ${esc(filing.query.description)}</div>
      <label style="display:block;margin-top:12px;font-weight:700;font-size:13px">Your Reply</label>
      <textarea id="queryReplyText" rows="4" placeholder="Enter your response to the customs query (minimum 15 characters)…"></textarea>
      <div style="margin-top:10px"><button class="next" onclick="submitQueryReply('${filing.id}', document.getElementById('queryReplyText').value)">Submit Reply</button></div>
    </div>`;
  } else if (s === 'EXAMINATION' && filing.examination) {
    const ex = filing.examination;
    panel = `<div class="wz-card"><h3>Examination</h3>
      <table class="kv-table">
        <tr><td>Location</td><td>${esc(ex.location)}</td></tr>
        <tr><td>Scheduled Date</td><td>${fmtDate(ex.date)}</td></tr>
        <tr><td>Result</td><td><span class="badge ${ex.result === 'PASS' ? 'badge-green' : (ex.result === 'DISCREPANCY' ? 'badge-red' : 'badge-amber')}">${esc(ex.result)}</span></td></tr>
      </table>
      ${ex.result === 'SCHEDULED' ? `<button class="next" style="margin-top:10px" onclick="conductExamination('${filing.id}')">Conduct Examination (Simulate)</button>` : ''}
      ${ex.result === 'DISCREPANCY' ? `<div class="alert alert-error" style="margin-top:10px">${esc(ex.remarks)}</div>
        <label style="display:block;margin-top:12px;font-weight:700;font-size:13px">Corrective Action Taken</label>
        <textarea id="correctiveText" rows="3" placeholder="Describe the corrective action (minimum 10 characters)…"></textarea>
        <div style="margin-top:10px"><button class="next" onclick="submitCorrectiveAction('${filing.id}', document.getElementById('correctiveText').value)">Submit Corrective Action</button></div>` : ''}
    </div>`;
  } else if (s === 'CLEARED' && filing.type === 'export') {
    panel = `<div class="wz-card"><h3>Export Clearance</h3>
      <p class="hint">All processing stages are complete. Cargo is cleared for export.</p>
      ${pgaAllClear(filing) ? '' : '<div class="alert alert-error">PGA/NOC clearance still pending — see the panel below before LEO can be issued.</div>'}
      <button class="next" onclick="issueLEO('${filing.id}')">Issue Let Export Order (LEO)</button>
    </div>`;
  } else if (s === 'ASSESSED' || s === 'DUTY_PENDING') {
    panel = dutyPanelHTML(filing);
  } else if (s === 'DUTY_PAID') {
    let cfsBlock = '';
    if (filing.cfsRoute === 'DPD') {
      cfsBlock = `<p class="hint">Cargo release route: <b>Direct Port Delivery (DPD)</b> — AEO-accredited importer, cargo delivered directly without CFS movement.</p>`;
    } else if (!filing.cfsGateIn) {
      cfsBlock = `<div class="alert alert-amber">Cargo release route: CFS (Container Freight Station). Gate-in must be confirmed before Out of Charge.</div>
      <button class="btn-ghost" onclick="confirmCFSGateIn('${filing.id}')">Confirm CFS Gate-In</button>`;
    } else {
      cfsBlock = `<p class="hint">Cargo gated in at CFS: ${esc(filing.cfsGateIn.refNo)} (${fmtDateTime(filing.cfsGateIn.ts)})</p>`;
    }
    const canGrantOOC = (filing.cfsRoute === 'DPD' || filing.cfsGateIn);
    panel = `<div class="wz-card"><h3>Out of Charge</h3>
      <p class="hint">Duty has been paid. Cargo is ready to be released.</p>
      ${examStatusNoteHTML(filing)}
      ${cfsBlock}
      ${pgaAllClear(filing) ? '' : '<div class="alert alert-error">PGA/NOC clearance still pending — see the panel below before Out of Charge can be granted.</div>'}
      ${canGrantOOC ? `<button class="next" style="margin-top:10px" onclick="grantOOC('${filing.id}')">Grant Out of Charge (OOC)</button>` : ''}
    </div>`;
  } else if (s === 'LEO' || s === 'OOC' || s === 'COMPLETED') {
    panel = `<div class="wz-card"><h3>${filing.type === 'export' ? 'Let Export Order' : 'Out of Charge'} — Issued</h3>
      <table class="kv-table">
        ${filing.leo ? `<tr><td>LEO Reference</td><td>${esc(filing.leo.refNo)}</td></tr><tr><td>Date</td><td>${fmtDate(filing.leo.date)}</td></tr>` : ''}
        ${filing.ooc ? `<tr><td>OOC Reference</td><td>${esc(filing.ooc.refNo)}</td></tr><tr><td>Date</td><td>${fmtDate(filing.ooc.date)}</td></tr>` : ''}
      </table>
      <div class="alert alert-success" style="margin-top:10px">Shipment ${filing.type === 'export' ? 'export cleared' : 'import cleared'} and training workflow completed.</div>
      ${filing.type === 'export' && filing.leo && !filing.egm ? `<p class="hint" style="margin-top:10px">The Shipping Bill is only fully closed once the carrier files the Export General Manifest after sailing.</p><button class="next" onclick="fileEGM('${filing.id}')">File Export General Manifest (EGM)</button>` : ''}
      ${filing.egm ? `<div class="alert alert-success" style="margin-top:10px">EGM Filed: ${esc(filing.egm.egmNo)} — Shipping Bill fully closed.</div>` : ''}
      <div style="margin-top:10px"><button class="btn-ghost" onclick="navTo('doccentre')">View Documents</button>
      <button class="btn-ghost" onclick="navTo('assessment')">View Training Assessment</button></div>
      ${amendmentButtonHTML(filing)}
    </div>`;
  } else if (s === 'DRAFT') {
    panel = `<div class="wz-card"><h3>Draft Filing</h3><p class="hint">This filing has not yet been submitted.</p><button class="next" onclick="resumeWizardFor('${filing.id}')">Continue Filing</button></div>`;
  } else if (s === 'UNDER_PROCESS' || s === 'QUERY_REPLIED') {
    panel = `<div class="wz-card"><h3>Customs Processing</h3><p class="hint">Processing in progress. Please check back or refresh.</p></div>`;
  }

  if (['SUBMITTED', 'ACKNOWLEDGED', 'UNDER_PROCESS', 'QUERY_RAISED', 'QUERY_REPLIED', 'EXAMINATION', 'ASSESSED', 'DUTY_PENDING', 'DUTY_PAID', 'CLEARED'].includes(s)) {
    panel += amendmentButtonHTML(filing);
  }
  return panel;
}

function examStatusNoteHTML(filing) {
  if (filing.examination && filing.examination.required) {
    return `<p class="hint">Examination result: <span class="badge ${filing.examination.result === 'PASS' ? 'badge-green' : 'badge-amber'}">${esc(filing.examination.result)}</span></p>`;
  }
  return '';
}

function dutyPanelHTML(filing) {
  const d = filing.duty;
  if (!d) return '<div class="wz-card"><h3>Assessment</h3><p class="hint">Awaiting assessment.</p></div>';
  let paymentHTML = '';
  if (!filing.payment) {
    paymentHTML = `<div class="pay-methods">
      <button class="btn-ghost sm" onclick="initiatePayment('${filing.id}','Net Banking')">Net Banking</button>
      <button class="btn-ghost sm" onclick="initiatePayment('${filing.id}','NEFT/RTGS')">NEFT / RTGS</button>
      <button class="btn-ghost sm" onclick="initiatePayment('${filing.id}','Debit Card')">Debit Card</button>
    </div>`;
  } else if (filing.payment.status === 'INITIATED') {
    paymentHTML = `<div class="alert alert-amber">Payment initiated via ${esc(filing.payment.method)}. Challan: ${esc(filing.payment.challanNo)}.</div>
      <button class="next" onclick="confirmPayment('${filing.id}')">Confirm Payment (Simulate)</button>`;
  } else if (filing.payment.status === 'SUCCESS') {
    paymentHTML = `<div class="alert alert-success">Payment successful. Challan: ${esc(filing.payment.challanNo)}.</div>`;
  }
  return `<div class="wz-card"><h3>Duty Calculation <span class="hint-inline">(Training calculation only)</span></h3>
    ${d.ftaApplied ? '<div class="alert alert-success">FTA preferential rate applied to Basic Customs Duty.</div>' : ''}
    <table class="kv-table">
      <tr><td>Assessable Value</td><td>${fmtINR(d.assessableValue)}</td></tr>
      <tr><td>Basic Customs Duty (${(d.bcdRate * 100).toFixed(0)}%)</td><td>${fmtINR(d.bcd)}</td></tr>
      <tr><td>Social Welfare Surcharge (${(d.swsRate * 100).toFixed(0)}% of BCD)</td><td>${fmtINR(d.sws)}</td></tr>
      ${d.cess > 0 ? `<tr><td>Compensation / Health Cess (${(d.cessRate * 100).toFixed(0)}%)</td><td>${fmtINR(d.cess)}</td></tr>` : ''}
      ${d.add > 0 ? `<tr><td>Anti-Dumping Duty (${(d.addRate * 100).toFixed(0)}%)</td><td>${fmtINR(d.add)}</td></tr>` : ''}
      <tr><td>IGST (${(d.igstRate * 100).toFixed(0)}%)</td><td>${fmtINR(d.igst)}</td></tr>
      <tr><td><b>Total Duty Payable</b></td><td><b>${fmtINR(d.total)}</b></td></tr>
    </table>
    <p class="hint">${esc(d.note)}</p>
    <h4>Payment</h4>
    ${paymentHTML}
  </div>`;
}

function amendmentButtonHTML(filing) {
  return `<div style="margin-top:14px"><button class="btn-ghost sm" onclick="openAmendmentForm('${filing.id}')">Request Amendment</button></div>`;
}
function amendmentListForFilingHTML(filing) {
  return `<div class="wz-card"><h3>Amendments</h3><ul class="plain-list">${filing.amendments.map(a => `<li><b>${esc(a.type)}</b> — <span class="badge ${a.status === 'APPROVED' ? 'badge-green' : (a.status === 'REJECTED' ? 'badge-red' : 'badge-amber')}">${esc(a.status)}</span><div class="tnote">${esc(a.reason)}</div>${a.decision ? `<div class="tnote">${esc(a.decision)}</div>` : ''}</li>`).join('')}</ul></div>`;
}
function openAmendmentForm(filingId) {
  const filing = getFiling(filingId);
  const postClearance = filing && ['LEO', 'OOC', 'COMPLETED'].includes(filing.status);
  const bg = el('div', 'modal-bg show');
  bg.innerHTML = `<div class="modal" style="width:min(520px,92vw)">
    <div class="modal-head">Request Amendment <span class="close">×</span></div>
    <div style="padding:22px">
      ${postClearance ? '<div class="alert alert-amber">This filing has already cleared. Post-clearance amendments require justification under Section 149 of the Customs Act, 1962 and Assistant/Deputy Commissioner approval.</div>' : ''}
      <div class="field"><label>Amendment Type</label>
        <select id="amdType"><option>Invoice Correction</option><option>Quantity Correction</option><option>Address Correction</option><option>Document Correction</option><option>Item Information Correction</option></select>
      </div>
      <div class="field"><label>Reason</label><textarea id="amdReason" rows="3" placeholder="Describe the reason for this amendment (minimum 10 characters)…"></textarea></div>
      ${postClearance ? '<div class="field"><label>Section 149 Justification</label><textarea id="amdSection149" rows="3" placeholder="Justify why the amendment should be permitted based on documentary evidence in existence at the time of clearance (minimum 15 characters)…"></textarea></div>' : ''}
      <div class="actions"><button class="back2 close">Cancel</button><button class="next" id="amdSubmit">Submit Amendment Request</button></div>
    </div>
  </div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click', e => { if (e.target === bg || e.target.classList.contains('close')) bg.remove(); });
  $('#amdSubmit', bg).addEventListener('click', () => {
    requestAmendment(filingId, $('#amdType', bg).value, $('#amdReason', bg).value, postClearance ? $('#amdSection149', bg).value : null);
    bg.remove();
    if (CURRENT_SCREEN === 'filingDetail') renderFilingDetail(filingId);
  });
}

/* ---------------- FREIGHT FORWARDING ---------------- */
function startFreightBookingFlow() {
  const booking = startNewBooking();
  openFreightWizard(booking);
}
function navToFreightBooking(id) { navTo('freightDetail'); renderFreightDetail(id); }
function navToFreightList() { navTo('freightList'); renderFreightList(); }

function openBookingOrWizard(id) {
  const b = getBooking(id);
  if (!b) return;
  if (b.status === 'DRAFT_BOOKING') resumeFreightWizard(id); else navToFreightBooking(id);
}

function bookingsTableHTML(list) {
  return `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Booking No.</th><th>Mode</th><th>Carrier</th><th>Shipper</th><th>Consignee</th><th>Status</th><th>Updated</th><th></th></tr></thead>
    <tbody>${list.map(b => `<tr>
      <td>${esc(b.id)}</td>
      <td>${esc(b.mode)}</td>
      <td>${esc(b.carrierName || '—')}</td>
      <td>${esc(b.shipperName || '—')}</td>
      <td>${esc(b.consigneeName || '—')}</td>
      <td><span class="badge ${b.status === 'DRAFT_BOOKING' ? 'badge-grey' : FREIGHT_STATUS_BADGE[b.status]}">${b.status === 'DRAFT_BOOKING' ? 'Draft' : FREIGHT_STATUS_LABELS[b.status]}</span></td>
      <td>${fmtDate(b.updatedAt)}</td>
      <td><button class="btn-ghost sm" onclick="openBookingOrWizard('${b.id}')">Open</button> <button class="btn-ghost sm" onclick="navToJobCosting('${b.id}')">Job Costing</button></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
function navToJobCosting(bookingId) { navTo('jobcosting'); renderJobCosting(bookingId); }

var FREIGHT_LIST_QUERY = '';
var FREIGHT_LIST_MODE = 'all';
function renderFreightList() {
  const host = $('#screen-freightList');
  let list = STATE.bookings.slice();
  if (FREIGHT_LIST_MODE !== 'all') list = list.filter(b => b.mode === FREIGHT_LIST_MODE);
  if (FREIGHT_LIST_QUERY) {
    const q = FREIGHT_LIST_QUERY.toLowerCase();
    list = list.filter(b => b.id.toLowerCase().includes(q) ||
      (b.shipperName || '').toLowerCase().includes(q) ||
      (b.consigneeName || '').toLowerCase().includes(q) ||
      (b.carrierName || '').toLowerCase().includes(q) ||
      (b.portOfLoading || '').toLowerCase().includes(q) ||
      (b.portOfDischarge || '').toLowerCase().includes(q));
  }
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Freight Forwarding</div><h1>Freight Bookings</h1></div>
  <button class="next" onclick="startFreightBookingFlow()">+ New Freight Booking</button></div>
  <div class="search-row" style="margin-bottom:10px">
    <input id="freightListSearch" placeholder="Search by ID, shipper, consignee, carrier, port…" value="${esc(FREIGHT_LIST_QUERY)}" oninput="filterFreightList(this.value)">
    <select onchange="filterFreightMode(this.value)" style="border:1px solid #cbd3db;padding:8px 10px;font-size:13px">
      <option value="all" ${FREIGHT_LIST_MODE === 'all' ? 'selected' : ''}>All Modes</option>
      <option value="Sea" ${FREIGHT_LIST_MODE === 'Sea' ? 'selected' : ''}>Sea</option>
      <option value="Air" ${FREIGHT_LIST_MODE === 'Air' ? 'selected' : ''}>Air</option>
    </select>
  </div>
  ${list.length ? bookingsTableHTML(list) : '<p class="hint">No freight bookings match this filter.</p>'}
  `;
}
function filterFreightList(v) { FREIGHT_LIST_QUERY = v; renderFreightList(); refocusEnd('freightListSearch'); }
function filterFreightMode(v) { FREIGHT_LIST_MODE = v; renderFreightList(); }

function renderFreightDetail(id) {
  const b = getBooking(id);
  const host = $('#screen-freightDetail');
  if (!b) { host.innerHTML = '<p class="hint">Booking not found.</p>'; return; }
  const isSea = b.mode === 'Sea';
  host.innerHTML = `
  <div class="page-head">
    <div><div class="crumb">Freight Forwarding / Booking</div>
    <h1>${esc(b.id)} <span class="badge ${b.status === 'DRAFT_BOOKING' ? 'badge-grey' : FREIGHT_STATUS_BADGE[b.status]}">${b.status === 'DRAFT_BOOKING' ? 'Draft' : FREIGHT_STATUS_LABELS[b.status]}</span></h1></div>
    <div><button class="btn-ghost" onclick="navToFreightList()">Back to List</button></div>
  </div>
  <div class="two-col">
    <div>
      <div class="wz-card"><h3>Booking Summary</h3>
        <table class="kv-table">
          <tr><td>Shipper</td><td>${esc(b.shipperName)}</td></tr>
          <tr><td>Consignee</td><td>${esc(b.consigneeName)}</td></tr>
          <tr><td>Mode</td><td>${esc(b.mode)}</td></tr>
          <tr><td>Carrier</td><td>${esc(b.carrierName)}</td></tr>
          <tr><td>Port of Loading</td><td>${esc(b.portOfLoading)}</td></tr>
          <tr><td>Port of Discharge</td><td>${esc(b.portOfDischarge)}</td></tr>
          <tr><td>Commodity</td><td>${esc(b.commodity)}</td></tr>
          ${b.linkedFilingId ? `<tr><td>Linked Customs Filing</td><td><a href="#" onclick="navToFiling('${b.linkedFilingId}');return false;">${esc(b.linkedFilingId)}</a></td></tr>` : ''}
          ${b.bookingConfirmationNo ? `<tr><td>Booking Confirmation No.</td><td>${esc(b.bookingConfirmationNo)}</td></tr>` : ''}
          ${b.bl && b.bl.houseNo ? `<tr><td>House ${isSea ? 'BL' : 'AWB'} No.</td><td>${esc(b.bl.houseNo)}</td></tr>` : ''}
        </table>
      </div>
      ${freightProcessingPanelHTML(b)}
    </div>
    <div>
      <div class="wz-card"><h3>Timeline</h3>
        <ul class="timeline">${b.timeline.slice().reverse().map(t => `<li><b>${esc(FREIGHT_STATUS_LABELS[t.stage] || t.stage)}</b><span>${fmtDateTime(t.ts)}</span><div class="tnote">${esc(t.note)}</div></li>`).join('')}</ul>
      </div>
    </div>
  </div>`;
}

function freightProcessingPanelHTML(b) {
  const isSea = b.mode === 'Sea';
  const s = b.status;
  if (s === 'DRAFT_BOOKING') {
    return `<div class="wz-card"><h3>Booking</h3><p class="hint">This booking has not been submitted yet.</p><button class="next" onclick="resumeFreightWizard('${b.id}')">Continue Booking</button></div>`;
  }
  if (s === 'REQUESTED') {
    return `<div class="wz-card"><h3>Carrier Confirmation</h3><p class="hint">Booking request has been sent to ${esc(b.carrierName)}. Check for confirmation.</p>
      <button class="next" onclick="confirmBooking('${b.id}')">Check Carrier Confirmation</button></div>`;
  }
  if (s === 'REJECTED') {
    return `<div class="wz-card"><h3>Booking Rejected</h3>
      <div class="alert alert-error">${esc(b.rejectionReason)}</div>
      <label style="display:block;margin-top:12px;font-weight:700;font-size:13px">Alternate Sailing / Flight Date</label>
      <input type="date" id="altDate" style="height:39px;border:1px solid #c7ced6;padding:0 10px">
      <label style="display:block;margin-top:12px;font-weight:700;font-size:13px">Alternate Carrier (optional)</label>
      <select id="altCarrier"><option value="">Keep ${esc(b.carrierName)}</option>${(isSea ? OCEAN_CARRIERS : AIR_CARRIERS).filter(c => c !== b.carrierName).map(c => `<option>${c}</option>`).join('')}</select>
      <div style="margin-top:10px"><button class="next" onclick="resubmitBooking('${b.id}', document.getElementById('altDate').value, document.getElementById('altCarrier').value)">Resubmit Booking</button></div>
    </div>`;
  }
  if (s === 'CONFIRMED') {
    return `<div class="wz-card"><h3>Shipping Instructions (SI)</h3>
      <p class="hint">Submit final shipment details to the carrier for Bill of Lading${isSea ? '' : ' / Air Waybill'} preparation.</p>
      ${siFormHTML(b)}
    </div>`;
  }
  if (s === 'SI_SUBMITTED' && isSea) {
    return `<div class="wz-card"><h3>Verified Gross Mass (VGM)</h3>
      <p class="hint">SOLAS requires VGM submission before the carrier cut-off for all container shipments.</p>
      <div class="grid">
        <div class="field"><label>Total Verified Weight (KG) *</label><input id="vgmWeight" type="number"></div>
        <div class="field"><label>Weighing Method *</label><select id="vgmMethod">${VGM_METHODS.map(m => `<option>${m}</option>`).join('')}</select></div>
        <div class="field full"><label>Declarant Name *</label><input id="vgmDeclarant" placeholder="Authorized signatory name"></div>
      </div>
      <button class="next" onclick="submitVGM('${b.id}', document.getElementById('vgmWeight').value, document.getElementById('vgmMethod').value, document.getElementById('vgmDeclarant').value)">Submit VGM</button>
    </div>`;
  }
  if ((s === 'SI_SUBMITTED' && !isSea) || s === 'VGM_SUBMITTED') {
    return `<div class="wz-card"><h3>Draft ${isSea ? 'Bill of Lading' : 'Air Waybill'}</h3>
      <p class="hint">Generate the draft ${isSea ? 'BL' : 'AWB'} for verification before final issuance.</p>
      <button class="next" onclick="issueDraftBL('${b.id}')">Generate Draft ${isSea ? 'BL' : 'AWB'}</button>
    </div>`;
  }
  if (s === 'DRAFT_BL') {
    return `<div class="wz-card"><h3>Draft ${isSea ? 'Bill of Lading' : 'Air Waybill'} — ${esc(b.bl.draftNo)}</h3>
      <table class="kv-table">
        <tr><td>Shipper</td><td>${esc(b.shipperName)}</td></tr>
        <tr><td>Consignee</td><td>${esc(b.consigneeName)}</td></tr>
        <tr><td>Marks &amp; Numbers</td><td>${esc(b.si.marksNumbers)}</td></tr>
        <tr><td>Description of Goods</td><td>${esc(b.si.description)}</td></tr>
        ${isSea ? `<tr><td>Containers</td><td>${(b.si.containers || []).map(c => esc(c.containerNo) + ' / Seal ' + esc(c.sealNo)).join('<br>')}</td></tr>` : ''}
      </table>
      <p class="hint" style="margin-top:10px">Review carefully. Request a correction if any detail is wrong, or finalize to issue the transport document.</p>
      <label style="display:block;margin-top:6px;font-weight:700;font-size:13px">Release Type *</label>
      <select id="releaseType">${(isSea ? BL_RELEASE_TYPES_SEA : AWB_RELEASE_TYPES_AIR).map(t => `<option>${t}</option>`).join('')}</select>
      <div class="actions" style="margin-top:12px">
        <button class="back2" onclick="openCorrectionPrompt('${b.id}')">Request Correction</button>
        <button class="next" onclick="finalizeBL('${b.id}', document.getElementById('releaseType').value)">Finalize ${isSea ? 'BL' : 'AWB'}</button>
      </div>
    </div>`;
  }
  if (s === 'BL_ISSUED') {
    return `<div class="wz-card"><h3>${isSea ? 'Bill of Lading' : 'Air Waybill'} Finalized</h3>
      <table class="kv-table">
        <tr><td>House ${isSea ? 'BL' : 'AWB'} No.</td><td>${esc(b.bl.houseNo)}</td></tr>
        <tr><td>Master ${isSea ? 'BL' : 'AWB'} No.</td><td>${esc(b.bl.masterNo)}</td></tr>
        <tr><td>Release Type</td><td>${esc(b.bl.releaseType)}</td></tr>
        ${b.bl.originalsIssued ? `<tr><td>Originals Issued</td><td>${b.bl.originalsIssued}</td></tr>` : ''}
      </table>
      <button class="next" style="margin-top:10px" onclick="markArrival('${b.id}')">Mark ${isSea ? 'Vessel' : 'Flight'} Arrival (Simulate)</button>
    </div>`;
  }
  if (s === 'ARRIVED') {
    const needsSurrender = b.bl.releaseType === (isSea ? 'Original Bill of Lading' : 'Original AWB');
    let linkedNote = '';
    if (b.linkedFilingId) {
      const f = getFiling(b.linkedFilingId);
      if (f) linkedNote = `<p class="hint">Linked customs filing ${esc(f.id)} status: <span class="badge ${STATUS_BADGE_CLASS[f.status]}">${esc(STATUS_LABELS[f.status])}</span>${!['LEO', 'OOC', 'COMPLETED'].includes(f.status) ? ' — must reach LEO/OOC before Delivery Order can be issued.' : ''}</p>`;
    }
    return `<div class="wz-card"><h3>Delivery Order</h3>
      <p class="hint">Cargo has arrived at ${esc(b.portOfDischarge)}.</p>
      ${linkedNote}
      ${needsSurrender ? `<label><input type="checkbox" id="blSurrendered"> Original ${isSea ? 'Bill of Lading' : 'AWB'} has been surrendered at destination</label><br><br>` : `<p class="hint">Release type is ${esc(b.bl.releaseType)} — no physical surrender required.</p>`}
      <button class="next" onclick="requestDeliveryOrder('${b.id}', ${needsSurrender ? "document.getElementById('blSurrendered').checked" : 'true'})">Request Delivery Order</button>
    </div>`;
  }
  if (s === 'DO_ISSUED') {
    return `<div class="wz-card"><h3>Delivery Order Issued — ${esc(b.deliveryOrder.doNo)}</h3>
      <button class="next" onclick="gateOutCargo('${b.id}')">Gate Out Cargo (Simulate)</button>
    </div>`;
  }
  if (s === 'GATE_OUT') {
    return `<div class="wz-card"><h3>Cargo Gated Out — ${esc(b.gateOut.eirNo)}</h3>
      <label style="display:block;margin-top:6px;font-weight:700;font-size:13px">Received By (Consignee / Authorized Representative)</label>
      <input id="podSignedBy" placeholder="Name of person confirming receipt">
      <div style="margin-top:10px"><button class="next" onclick="submitPOD('${b.id}', document.getElementById('podSignedBy').value)">Confirm Proof of Delivery</button></div>
    </div>`;
  }
  if (s === 'COMPLETED') {
    return `<div class="wz-card"><h3>Delivered</h3>
      <table class="kv-table">
        <tr><td>Received By</td><td>${esc(b.pod.signedBy)}</td></tr>
        <tr><td>Delivery Date</td><td>${fmtDateTime(b.pod.date)}</td></tr>
      </table>
      <div class="alert alert-success" style="margin-top:10px">Freight booking completed — cargo delivered.</div>
      <button class="btn-ghost" onclick="navTo('doccentre')">View Documents</button>
    </div>`;
  }
  return '';
}

function siFormHTML(b) {
  const isSea = b.mode === 'Sea';
  let containerRows = '';
  if (isSea) {
    const need = [];
    (b.containers || []).forEach(c => { for (let i = 0; i < Number(c.qty || 0); i++) need.push({ type: c.type }); });
    const existing = (b.si && b.si.containers) || [];
    containerRows = need.map((c, i) => {
      const ex = existing[i] || {};
      return `<tr data-i="${i}">
        <td>${esc(c.type)}</td>
        <td><input class="sicell" data-k="containerNo" placeholder="MSCU1234567" value="${esc(ex.containerNo || '')}"></td>
        <td><input class="sicell" data-k="sealNo" placeholder="Seal No." value="${esc(ex.sealNo || '')}"></td>
        <td><input class="sicell" data-k="grossWeight" type="number" placeholder="KG" value="${ex.grossWeight || ''}" style="width:90px"></td>
      </tr>`;
    }).join('');
  }
  return `
  <div class="grid">
    <div class="field full"><label>Marks and Numbers *</label><input id="siMarks" value="${esc(b.si ? b.si.marksNumbers : '')}"></div>
    <div class="field full"><label>Description of Goods *</label><textarea id="siDesc" rows="2">${esc(b.si ? b.si.description : b.commodity)}</textarea></div>
  </div>
  ${isSea ? `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Container Type</th><th>Container No.</th><th>Seal No.</th><th>Gross Wt (KG)</th></tr></thead>
    <tbody id="siContBody">${containerRows}</tbody></table></div>` : ''}
  <button class="next" style="margin-top:12px" onclick="submitSIFromUI('${b.id}')">Submit Shipping Instructions</button>`;
}
function submitSIFromUI(bookingId) {
  const b = getBooking(bookingId);
  const marksNumbers = $('#siMarks').value;
  const description = $('#siDesc').value;
  let containers = [];
  if (b.mode === 'Sea') {
    containers = $all('#siContBody tr').map(tr => {
      const c = {};
      $all('.sicell', tr).forEach(cell => { c[cell.dataset.k] = cell.dataset.k === 'grossWeight' ? Number(cell.value || 0) : cell.value; });
      return c;
    });
  }
  submitSI(bookingId, { marksNumbers, description, containers });
}
function openCorrectionPrompt(bookingId) {
  const bg = el('div', 'modal-bg show');
  bg.innerHTML = `<div class="modal" style="width:min(460px,92vw)"><div class="modal-head">Request Correction <span class="close">×</span></div>
  <div style="padding:22px"><div class="field"><label>Describe the correction needed</label><textarea id="corrNote" rows="3"></textarea></div>
  <div class="actions"><button class="back2 close">Cancel</button><button class="next" id="corrSubmit">Submit</button></div></div></div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click', e => { if (e.target === bg || e.target.classList.contains('close')) bg.remove(); });
  $('#corrSubmit', bg).addEventListener('click', () => { requestBLCorrection(bookingId, $('#corrNote', bg).value); bg.remove(); });
}

/* ---------------- MANIFEST REGISTER (IGM / EGM) ---------------- */
function renderManifestRegister() {
  const host = $('#screen-manifest');
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Manifest</div><h1>IGM / EGM Register</h1></div></div>
  <p class="hint">A Bill of Entry can only reference cargo the carrier has already declared on an Import General Manifest (IGM) line. A Shipping Bill is only fully closed once the carrier files the Export General Manifest (EGM) after sailing.</p>
  <h3>Import General Manifest (IGM)</h3>
  ${STATE.igms.length ? `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>IGM No.</th><th>Date</th><th>Vessel/Flight</th><th>Port of Arrival</th><th>Lines (BL/AWB — Status)</th></tr></thead>
    <tbody>${STATE.igms.map(g => `<tr><td>${esc(g.igmNo)}</td><td>${fmtDate(g.date)}</td><td>${esc(g.vessel)}</td><td>${esc(g.portOfArrival)}</td><td>${g.lines.map(l => esc(l.blAwbNo) + ' (' + esc(l.status) + ')').join(', ')}</td></tr>`).join('')}</tbody>
  </table></div>` : '<p class="hint">No IGM entries yet. IGM lines are auto-filed when a linked freight booking\'s vessel/flight arrives, or can be simulated directly from the Bill of Entry wizard.</p>'}
  <h3>Export General Manifest (EGM)</h3>
  ${STATE.egms.length ? `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>EGM No.</th><th>Date</th><th>Vessel/Flight</th><th>Shipping Bill</th></tr></thead>
    <tbody>${STATE.egms.map(g => `<tr><td>${esc(g.egmNo)}</td><td>${fmtDate(g.date)}</td><td>${esc(g.vessel)}</td><td><a href="#" onclick="navToFiling('${g.filingId}');return false;">${esc(g.filingId)}</a></td></tr>`).join('')}</tbody>
  </table></div>` : '<p class="hint">No EGM entries yet. File an EGM from a Shipping Bill after LEO is granted, to fully close it out.</p>'}
  `;
}

/* ---------------- AMENDMENTS SCREEN ---------------- */
var AMEND_QUERY = ''; var AMEND_STATUS = 'all';
function renderAmendments() {
  resolvePendingAmendments();
  const host = $('#screen-amendments');
  let rows = [];
  STATE.filings.forEach(f => (f.amendments || []).forEach(a => rows.push({ f, a })));
  if (AMEND_STATUS !== 'all') rows = rows.filter(r => r.a.status === AMEND_STATUS);
  if (AMEND_QUERY) {
    const q = AMEND_QUERY.toLowerCase();
    rows = rows.filter(r => r.a.id.toLowerCase().includes(q) || r.f.id.toLowerCase().includes(q) || (r.a.type || '').toLowerCase().includes(q) || (r.a.reason || '').toLowerCase().includes(q));
  }
  rows.sort((x, y) => y.a.ts - x.a.ts);
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Filing</div><h1>Amendments</h1></div></div>
  <p class="hint">Select an eligible filing to request an amendment. Amendment requests are reviewed automatically in this training simulator.</p>
  <div class="search-row" style="margin-bottom:10px">
    <input id="amendSearch" placeholder="Search by amendment ID, filing ID, type, reason…" value="${esc(AMEND_QUERY)}" oninput="filterAmendments(this.value)">
    <select onchange="filterAmendStatus(this.value)" style="border:1px solid #cbd3db;padding:8px 10px;font-size:13px">
      <option value="all" ${AMEND_STATUS === 'all' ? 'selected' : ''}>All Statuses</option>
      <option value="APPROVED" ${AMEND_STATUS === 'APPROVED' ? 'selected' : ''}>Approved</option>
      <option value="REJECTED" ${AMEND_STATUS === 'REJECTED' ? 'selected' : ''}>Rejected</option>
      <option value="UNDER REVIEW" ${AMEND_STATUS === 'UNDER REVIEW' ? 'selected' : ''}>Under Review</option>
    </select>
  </div>
  ${rows.length ? `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Amendment ID</th><th>Filing</th><th>Type</th><th>Reason</th><th>Status</th><th>Date</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(r.a.id)}</td><td><a href="#" onclick="navToFiling('${r.f.id}');return false;">${esc(r.f.id)}</a></td><td>${esc(r.a.type)}</td><td>${esc(r.a.reason)}</td><td><span class="badge ${r.a.status === 'APPROVED' ? 'badge-green' : (r.a.status === 'REJECTED' ? 'badge-red' : 'badge-amber')}">${esc(r.a.status)}</span></td><td>${fmtDateTime(r.a.ts)}</td></tr>`).join('')}</tbody>
  </table></div>` : '<p class="hint">No amendments match this filter.</p>'}
  <h3>Eligible Filings</h3>
  ${STATE.filings.filter(f => f.status !== 'DRAFT').length ? filingsTableHTML(STATE.filings.filter(f => f.status !== 'DRAFT')) : '<p class="hint">Submit a filing first to request an amendment.</p>'}
  `;
}
function filterAmendments(v) { AMEND_QUERY = v; renderAmendments(); refocusEnd('amendSearch'); }
function filterAmendStatus(v) { AMEND_STATUS = v; renderAmendments(); }

/* ---------------- ENQUIRY / TRACKING ---------------- */
function renderEnquiry() {
  const host = $('#screen-enquiry');
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Filing</div><h1>Track / Enquiry</h1></div></div>
  <div class="search-row"><input id="enqInput" placeholder="Enter Filing No. / Shipping Bill No. / Bill of Entry No. / Invoice No. / Container No."><button class="next" onclick="runEnquiry()">Search</button></div>
  <div id="enqResults"></div>
  `;
  $('#enqInput').addEventListener('keydown', e => { if (e.key === 'Enter') runEnquiry(); });
}
function globalSearchGo() {
  const v = $('#globalSearch').value.trim();
  if (!v) return;
  navTo('enquiry');
  setTimeout(() => { $('#enqInput').value = v; runEnquiry(); }, 30);
}
function runEnquiry() {
  const q = ($('#enqInput').value || '').trim().toLowerCase();
  const results = STATE.filings.filter(f =>
    f.id.toLowerCase().includes(q) ||
    (f.invoice.invoiceNo || '').toLowerCase().includes(q) ||
    (f.ack && f.ack.refNo.toLowerCase().includes(q)) ||
    (f.containers || []).some(c => (c.containerNo || '').toLowerCase().includes(q))
  );
  const bookingResults = STATE.bookings.filter(b =>
    b.id.toLowerCase().includes(q) ||
    (b.bookingConfirmationNo || '').toLowerCase().includes(q) ||
    (b.bl && b.bl.houseNo && b.bl.houseNo.toLowerCase().includes(q)) ||
    (b.si && b.si.containers || []).some(c => (c.containerNo || '').toLowerCase().includes(q))
  );
  const host = $('#enqResults');
  if (!q) { host.innerHTML = ''; return; }
  if (!results.length && !bookingResults.length) { host.innerHTML = '<p class="hint">No matching filings or freight bookings found.</p>'; return; }
  let html = '';
  if (results.length) {
    html += `<h3>Customs Filings</h3>` + results.map(f => `
    <div class="wz-card">
      <h4>${esc(f.id)} <span class="badge ${STATUS_BADGE_CLASS[f.status]}">${STATUS_LABELS[f.status]}</span></h4>
      <table class="kv-table">
        <tr><td>Filing Date</td><td>${fmtDate(f.createdAt)}</td></tr>
        <tr><td>Last Update</td><td>${fmtDateTime(f.updatedAt)}</td></tr>
        <tr><td>Current Stage</td><td>${esc(STATUS_LABELS[f.status])}</td></tr>
        <tr><td>Pending Action</td><td>${pendingActionText(f)}</td></tr>
      </table>
      <button class="btn-ghost sm" onclick="navToFiling('${f.id}')">Open Filing</button>
    </div>
  `).join('');
  }
  if (bookingResults.length) {
    html += `<h3>Freight Bookings</h3>` + bookingResults.map(b => `
    <div class="wz-card">
      <h4>${esc(b.id)} <span class="badge ${b.status === 'DRAFT_BOOKING' ? 'badge-grey' : FREIGHT_STATUS_BADGE[b.status]}">${b.status === 'DRAFT_BOOKING' ? 'Draft' : FREIGHT_STATUS_LABELS[b.status]}</span></h4>
      <table class="kv-table">
        <tr><td>Created</td><td>${fmtDate(b.createdAt)}</td></tr>
        <tr><td>Last Update</td><td>${fmtDateTime(b.updatedAt)}</td></tr>
        <tr><td>Carrier</td><td>${esc(b.carrierName || '—')}</td></tr>
      </table>
      <button class="btn-ghost sm" onclick="navToFreightBooking('${b.id}')">Open Booking</button>
    </div>
  `).join('');
  }
  host.innerHTML = html;
}
function pendingActionText(f) {
  if (f.status === 'DRAFT') return 'Complete and submit the filing.';
  if (f.status === 'ACKNOWLEDGED') return 'Proceed with customs processing.';
  if (f.status === 'QUERY_RAISED') return 'Reply to customs query.';
  if (f.status === 'EXAMINATION' && f.examination.result === 'SCHEDULED') return 'Conduct examination.';
  if (f.status === 'EXAMINATION' && f.examination.result === 'DISCREPANCY') return 'Submit corrective action.';
  if (f.status === 'CLEARED') return 'Issue Let Export Order.';
  if (f.status === 'DUTY_PENDING') return 'Pay assessed duty.';
  if (f.status === 'DUTY_PAID') return 'Grant Out of Charge.';
  return 'None — no action required.';
}

/* ---------------- DOCUMENT CENTRE ---------------- */
var DOC_QUERY = ''; var DOC_TYPE = 'all';
function renderDocCentre() {
  const host = $('#screen-doccentre');
  let docs = STATE.documentsGenerated.slice();
  const types = Array.from(new Set(STATE.documentsGenerated.map(d => d.type))).sort();
  if (DOC_TYPE !== 'all') docs = docs.filter(d => d.type === DOC_TYPE);
  if (DOC_QUERY) {
    const q = DOC_QUERY.toLowerCase();
    docs = docs.filter(d => d.title.toLowerCase().includes(q) || (d.refNo || '').toLowerCase().includes(q) || (d.filingId || '').toLowerCase().includes(q) || (d.bookingId || '').toLowerCase().includes(q));
  }
  docs.sort((a, b) => b.ts - a.ts);
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Records</div><h1>Document Centre</h1></div></div>
  <p class="hint">All documents generated across your training filings — acknowledgements, queries, examination reports, duty challans, receipts, LEO/OOC orders.</p>
  <div class="search-row" style="margin-bottom:10px">
    <input id="docSearch" placeholder="Search by title, reference no., filing/booking ID…" value="${esc(DOC_QUERY)}" oninput="filterDocCentre(this.value)">
    <select onchange="filterDocType(this.value)" style="border:1px solid #cbd3db;padding:8px 10px;font-size:13px">
      <option value="all" ${DOC_TYPE === 'all' ? 'selected' : ''}>All Types</option>
      ${types.map(t => `<option value="${esc(t)}" ${DOC_TYPE === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
    </select>
  </div>
  ${docs.length ? `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Document</th><th>Type</th><th>Linked To</th><th>Reference</th><th>e-Sanchit IRN</th><th>Date</th><th>Actions</th></tr></thead>
    <tbody>${docs.map(d => `<tr>
      <td>${esc(d.title)}</td><td>${esc(d.type)}</td>
      <td>${d.filingId ? `<a href="#" onclick="navToFiling('${d.filingId}');return false;">${esc(d.filingId)}</a>` : (d.bookingId ? `<a href="#" onclick="navToFreightBooking('${d.bookingId}');return false;">${esc(d.bookingId)}</a>` : '—')}</td>
      <td>${esc(d.refNo)}</td><td style="font-family:monospace;font-size:12px">${esc(d.irn || '—')}</td><td>${fmtDateTime(d.ts)}</td>
      <td><button class="btn-ghost sm" onclick="viewDocument('${d.id}')">View</button>
          <button class="btn-ghost sm" onclick="printDocument('${d.id}')">Print</button>
          <button class="btn-ghost sm" onclick="downloadDocument('${d.id}')">Download</button></td>
    </tr>`).join('')}</tbody>
  </table></div>` : '<p class="hint">No documents match this filter.</p>'}
  `;
}
function filterDocCentre(v) { DOC_QUERY = v; renderDocCentre(); refocusEnd('docSearch'); }
function filterDocType(v) { DOC_TYPE = v; renderDocCentre(); }
function documentPrintableHTML(doc) {
  const f = doc.filingId ? getFiling(doc.filingId) : null;
  const b = doc.bookingId ? getBooking(doc.bookingId) : null;
  return `<html><head><title>${esc(doc.title)}</title><style>
    body{font-family:Arial,sans-serif;padding:40px;color:#111}
    h1{color:#17385f;border-bottom:3px solid #f07c00;padding-bottom:10px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    td{padding:8px;border-bottom:1px solid #ddd}
    .stamp{margin-top:30px;color:#a51818;font-weight:700;font-size:13px;border:2px solid #a51818;display:inline-block;padding:8px 14px}
  </style></head><body>
  <h1>${esc(doc.title)}</h1>
  <p><b>Reference No.:</b> ${esc(doc.refNo)} &nbsp; | &nbsp; <b>Date:</b> ${fmtDateTime(doc.ts)}</p>
  <table>
    ${f ? `<tr><td><b>Filing Number</b></td><td>${esc(doc.filingId)}</td></tr>
    <tr><td><b>${f.type === 'export' ? 'Exporter' : 'Importer'}</b></td><td>${esc(f.type === 'export' ? f.party.exporterName : f.party.importerName)}</td></tr>
    <tr><td><b>${f.type === 'export' ? 'Consignee' : 'Supplier'}</b></td><td>${esc(f.type === 'export' ? f.counterparty.consigneeName : f.counterparty.supplierName)}</td></tr>
    <tr><td><b>Invoice No.</b></td><td>${esc(f.invoice.invoiceNo)}</td></tr>
    <tr><td><b>Status</b></td><td>${esc(STATUS_LABELS[f.status])}</td></tr>` : ''}
    ${b ? `<tr><td><b>Booking Number</b></td><td>${esc(doc.bookingId)}</td></tr>
    <tr><td><b>Shipper</b></td><td>${esc(b.shipperName)}</td></tr>
    <tr><td><b>Consignee</b></td><td>${esc(b.consigneeName)}</td></tr>
    <tr><td><b>Carrier</b></td><td>${esc(b.carrierName)}</td></tr>
    <tr><td><b>Mode</b></td><td>${esc(b.mode)}</td></tr>
    <tr><td><b>Status</b></td><td>${esc(FREIGHT_STATUS_LABELS[b.status] || b.status)}</td></tr>
    ${b.bl && b.bl.houseNo ? `<tr><td><b>House ${b.mode === 'Sea' ? 'BL' : 'AWB'} No.</b></td><td>${esc(b.bl.houseNo)}</td></tr>` : ''}` : ''}
  </table>
  <div class="stamp">TRAINING SIMULATOR — NOT AN OFFICIAL GOVERNMENT DOCUMENT</div>
  </body></html>`;
}
function viewDocument(docId) {
  const doc = STATE.documentsGenerated.find(d => d.id === docId);
  if (!doc) { toast('That document could not be found — it may belong to a different profile.', 'error'); return; }
  const bg = el('div', 'modal-bg show');
  bg.innerHTML = `<div class="modal" style="width:min(700px,94vw)"><div class="modal-head">${esc(doc.title)} <span class="close">×</span></div>
  <iframe style="width:100%;height:60vh;border:0" srcdoc="${esc(documentPrintableHTML(doc))}"></iframe></div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click', e => { if (e.target === bg || e.target.classList.contains('close')) bg.remove(); });
}
function printDocument(docId) {
  const doc = STATE.documentsGenerated.find(d => d.id === docId);
  if (!doc) { toast('That document could not be found — it may belong to a different profile.', 'error'); return; }
  /* Merged from the parallel FINAL hardening pass: window.open() returns null when the
     browser's popup blocker intercepts it — without this check the code below would throw
     trying to call .document on null, silently going nowhere with no feedback to the trainee. */
  const w = window.open('', '_blank');
  if (!w) { toast('Your browser blocked the print window — allow pop-ups for this site and try again.', 'error'); return; }
  w.document.write(documentPrintableHTML(doc));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
function downloadDocument(docId) {
  const doc = STATE.documentsGenerated.find(d => d.id === docId);
  if (!doc) { toast('That document could not be found — it may belong to a different profile.', 'error'); return; }
  const blob = new Blob([documentPrintableHTML(doc)], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = doc.title.replace(/\s+/g, '_') + '_' + doc.refNo + '.html';
  a.click();
}

/* ---------------- NOTIFICATIONS ---------------- */
function renderNotifications() {
  const host = $('#screen-notifications');
  STATE.notifications.forEach(n => n.read = true);
  saveState();
  refreshNotifDot();
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Records</div><h1>Notifications</h1></div>
  <button class="btn-ghost" onclick="clearAllNotifications()">Clear All</button></div>
  ${STATE.notifications.length ? `<ul class="notif-list full">${STATE.notifications.map(n => `<li><span class="ndot read"></span>${esc(n.text)}<span class="ntime">${fmtDateTime(n.ts)}</span></li>`).join('')}</ul>` : '<p class="hint">No notifications yet.</p>'}
  `;
}
function clearAllNotifications() { confirmDialog('Clear all notifications?', () => { STATE.notifications = []; saveState(); renderNotifications(); }); }

/* ---------------- TRAINING ASSESSMENT ---------------- */
function renderAssessment() {
  const host = $('#screen-assessment');
  const list = STATE.assessments;
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Records</div><h1>Training Assessment</h1></div></div>
  <p class="hint">A score is generated automatically each time you complete a filing end-to-end (LEO or Out of Charge granted).</p>
  ${list.length ? list.map(r => assessmentCardHTML(r)).join('') : '<p class="hint">No completed filings yet. Complete a full export or import workflow to receive your first assessment.</p>'}
  `;
}
function assessmentCardHTML(r) {
  const b = r.breakdown;
  return `<div class="wz-card">
    <h3>${esc(r.filingId)} — ${r.total}/100 <span class="badge ${r.verdict === 'PASS' ? 'badge-green' : 'badge-amber'}">${r.verdict}</span></h3>
    <table class="kv-table">
      <tr><td>Documentation Accuracy</td><td>${b.documentation}/20</td></tr>
      <tr><td>Data Entry</td><td>${b.dataEntry}/20</td></tr>
      <tr><td>HS Classification</td><td>${b.classification}/15</td></tr>
      <tr><td>Workflow Knowledge</td><td>${b.workflowKnowledge}/20</td></tr>
      <tr><td>Error Handling</td><td>${b.errorHandling}/15</td></tr>
      <tr><td>Time Management</td><td>${b.timeManagement}/10</td></tr>
    </table>
    <p class="hint">Assessed ${fmtDateTime(r.ts)}</p>
  </div>`;
}

/* ---------------- SETTINGS ---------------- */
function renderSettings() {
  const host = $('#screen-settings');
  const p = STATE.user.profile;
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Account</div><h1>Settings</h1></div></div>
  <div class="wz-card"><h3>Profile</h3>
    <p class="hint">These identity details are used for your Digital Signature (DSC), Training Certificate, and Broker POA display — not auto-filled into any Shipping Bill / Bill of Entry form. Edit them to use your own fictional training company instead of the demo profile.</p>
    <div class="grid">
      <div class="field"><label>Name</label><input id="profName" value="${esc(p.name)}"></div>
      <div class="field"><label>Simulator ID</label><input value="${esc(p.userId)}" disabled></div>
      <div class="field"><label>Role</label><input value="${esc(p.role)}" disabled></div>
      <div class="field"><label>IEC</label><input id="profIec" value="${esc(p.iec)}"></div>
      <div class="field"><label>GSTIN</label><input id="profGstin" value="${esc(p.gstin)}"></div>
      <div class="field"><label>PAN</label><input id="profPan" value="${esc(p.pan)}"></div>
    </div>
    <button class="btn-ghost" onclick="saveProfileEdits()">Save Profile</button>
  </div>
  <div class="wz-card"><h3>Risk Profile (Training RMS)</h3>
    <table class="kv-table">
      <tr><td>AEO Accredited</td><td><input type="checkbox" id="aeoToggle" ${STATE.riskProfile.aeo ? 'checked' : ''}></td></tr>
      <tr><td>Clean Filing History</td><td>${STATE.riskProfile.cleanFilings} filing(s)</td></tr>
      <tr><td>Recorded Examination Discrepancies</td><td>${STATE.riskProfile.violations}</td></tr>
    </table>
    <p class="hint">AEO (Authorized Economic Operator) accreditation substantially lowers RMS-selected examination/query rates and unlocks Direct Port Delivery (DPD) for imports.</p>
  </div>
  <div class="wz-card"><h3>Backup &amp; Restore</h3>
    <p class="hint">This is a local, browser-only application with no backend — your training data lives only in this browser. Export it to a JSON file to keep a copy or move it to another browser, and import a previously exported file to restore it.</p>
    <button class="btn-ghost" onclick="exportTrainingData()">Export Data (JSON)</button>
    <button class="btn-ghost" onclick="triggerImportTrainingData()">Import Data (JSON)</button>
    <input type="file" id="importFileInput" accept=".json,application/json" style="display:none" onchange="handleImportFile(this)">
  </div>
  <div class="wz-card"><h3>Training Data</h3>
    <p class="hint">Reset all filings, documents, notifications and assessments stored in this browser. This cannot be undone.</p>
    <button class="btn-danger" onclick="resetTrainingData()">Reset Training Data</button>
  </div>
  `;
  $('#aeoToggle').addEventListener('change', (e) => { STATE.riskProfile.aeo = e.target.checked; saveState(); toast('AEO status updated.', 'success'); });
}
/* Merged from the parallel FINAL hardening pass: editable training identity, feeds DSC
   signature / Training Certificate / Broker POA display. */
function saveProfileEdits() {
  const p = STATE.user.profile;
  const name = $('#profName').value.trim();
  if (!name) { toast('Name cannot be blank.', 'error'); return; }
  p.name = name;
  p.iec = $('#profIec').value.trim() || '—';
  p.gstin = $('#profGstin').value.trim() || '—';
  p.pan = $('#profPan').value.trim() || '—';
  saveState();
  const label = document.getElementById('appUserLabel');
  if (label) label.textContent = p.name + ' (' + p.role + ')';
  toast('Profile updated — this name now appears on your DSC signature and Training Certificate.', 'success');
  renderSettings();
}

/* ---------------- BACKUP / RESTORE (Section 24 & 42) ----------------
   No backend exists, so this is the safety net: the entire per-user
   training-data namespace can be exported to a JSON file and restored
   later (same browser, a different browser, or after a reset). */
function exportTrainingData() {
  try {
    const payload = { exportedAt: new Date().toISOString(), schemaVersion: 1, userId: CURRENT_USER_ID, state: STATE };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tcos-backup-${CURRENT_USER_ID}-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Training data exported.', 'success');
  } catch (e) {
    console.error('Export failed', e);
    toast('Unable to export training data — your browser may not support file downloads from this page.', 'error');
  }
}
function triggerImportTrainingData() {
  const input = document.getElementById('importFileInput');
  if (input) input.click();
}
function handleImportFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    let payload;
    try {
      payload = JSON.parse(e.target.result);
    } catch (err) {
      toast('Import failed — the selected file is not valid JSON.', 'error');
      input.value = '';
      return;
    }
    if (!payload || typeof payload !== 'object' || !payload.state || typeof payload.schemaVersion !== 'number') {
      toast('Import failed — this file does not look like a TCOS training data backup.', 'error');
      input.value = '';
      return;
    }
    const gotKeys = Object.keys(payload.state);
    const hasCoreKeys = ['filings', 'bookings', 'user'].every(k => gotKeys.includes(k));
    if (!hasCoreKeys) {
      toast('Import failed — backup file is missing required data sections.', 'error');
      input.value = '';
      return;
    }
    confirmDialog(`This will replace ALL current training data for ${CURRENT_USER_ID} with the contents of this backup (exported ${payload.exportedAt || 'an unknown date'}). This cannot be undone. Continue?`, () => {
      const restored = payload.state;
      const d = defaultState();
      Object.keys(d).forEach(k => { if (restored[k] === undefined) restored[k] = d[k]; });
      restored.user = STATE.user; // never let an imported file change who is currently logged in
      STATE = restored;
      saveState();
      navTo('dashboard');
      toast('Training data restored from backup.', 'success');
    });
    input.value = '';
  };
  reader.readAsText(file);
}
function resetTrainingData() {
  confirmDialog('This will permanently erase all training filings, documents and progress in this browser. Continue?', () => {
    const wasUser = STATE.user;
    resetState();
    STATE.user = wasUser;
    saveState();
    navTo('dashboard');
    toast('Training data has been reset.', 'success');
  });
}

/* ---------------- INIT ---------------- */
function init() {
  const session = loadSession();
  if (session && session.userId) {
    CURRENT_USER_ID = session.userId;
    loadState();
    if (STATE.user && STATE.user.loggedIn && STATE.user.profile) {
      if (window.DOT_SUITE_AUTH) {
        const p = STATE.user.profile;
        window.DOT_SUITE_AUTH.setAccount({
          userId: p.userId, name: p.name, role: p.role,
          isTrainer: !!STATE.user.loggedInAsTrainer, source: 'tcos', signedInAt: Date.now()
        });
      }
      enterApp();
      return;
    }
  }
  STATE = defaultState(); // keep STATE non-null while the login/home screens are showing
}
document.addEventListener('DOMContentLoaded', init);

/* Section 48: role="button" elements (demo-row, feature-card, scenario-card — plain <div>s
   made clickable with onclick, since they're rendered as data-driven cards rather than real
   <button> markup) are now tabindex-reachable, but a div never gets native Enter/Space
   activation the way a real button does. One delegated listener covers all of them, present
   and future, without touching each render call site. */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target;
  if (t && t.getAttribute && t.getAttribute('role') === 'button' && t.hasAttribute('onclick')) {
    e.preventDefault();
    t.click();
  }
});
