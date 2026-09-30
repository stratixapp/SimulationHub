/* =========================================================
   auth.js — Student login system + Instructor roster
   NOTE: This is a lightweight client-side login for training/
   practical-exam purposes (keeping each student's practice data
   separate on shared lab computers). It is NOT bank-grade security
   — everything lives in the browser's localStorage on that machine.
   ========================================================= */

const STUDENTS_KEY = 'oats_students_registry_v1';
const SESSION_KEY = 'oats_session_v1';
const INSTRUCTOR_PW_KEY = 'oats_instructor_pw_v1';
const DEFAULT_INSTRUCTOR_PW = 'skelora123';

/* Simple non-cryptographic hash — fine for a training tool, not for real secrets */
function simpleHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

const Auth = {
  getRegistry() {
    try { return JSON.parse(localStorage.getItem(STUDENTS_KEY)) || {}; } catch(e) { return {}; }
  },
  saveRegistry(reg) { localStorage.setItem(STUDENTS_KEY, JSON.stringify(reg)); },

  studentExists(id) { return !!this.getRegistry()[id.toLowerCase()]; },

  register(id, name, batch, password) {
    const reg = this.getRegistry();
    const key = id.toLowerCase();
    if (reg[key]) return { ok: false, error: 'This Student ID is already registered. Please log in instead.' };
    reg[key] = { id, name, batch, passwordHash: simpleHash(password), createdAt: todayISO() };
    this.saveRegistry(reg);
    return { ok: true };
  },

  login(id, password) {
    const reg = this.getRegistry();
    const rec = reg[id.toLowerCase()];
    if (!rec) return { ok: false, error: 'No account found with that Student ID.' };
    if (rec.passwordHash !== simpleHash(password)) return { ok: false, error: 'Incorrect password.' };
    return { ok: true, student: rec };
  },

  changePassword(id, oldPw, newPw) {
    const reg = this.getRegistry();
    const key = id.toLowerCase();
    const rec = reg[key];
    if (!rec || rec.passwordHash !== simpleHash(oldPw)) return { ok: false, error: 'Current password is incorrect.' };
    rec.passwordHash = simpleHash(newPw);
    this.saveRegistry(reg);
    return { ok: true };
  },

  deleteStudent(id) {
    const reg = this.getRegistry();
    delete reg[id.toLowerCase()];
    this.saveRegistry(reg);
    localStorage.removeItem('oats_db_v1__' + id);
  },

  getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch(e) { return null; }
  },
  setSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); },
  clearSession() { localStorage.removeItem(SESSION_KEY); },

  getInstructorPasswordHash() {
    return localStorage.getItem(INSTRUCTOR_PW_KEY) || simpleHash(DEFAULT_INSTRUCTOR_PW);
  },
  setInstructorPassword(pw) { localStorage.setItem(INSTRUCTOR_PW_KEY, simpleHash(pw)); },
  checkInstructorPassword(pw) { return simpleHash(pw) === this.getInstructorPasswordHash(); }
};

/* ---------------- Auth screen rendering ---------------- */
let _authMode = 'login'; // login | register | instructor

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.querySelector('.app-shell').classList.add('hidden');
  renderAuthScreen();
}
function hideAuthScreen() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.querySelector('.app-shell').classList.remove('hidden');
}

function renderAuthScreen() {
  const el = document.getElementById('auth-screen');
  el.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand">
        <div class="mark">OA</div>
        <div>
          <div class="name">OATS</div>
          <div class="sub">Office Administration Training Simulator</div>
        </div>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab ${_authMode==='login'?'active':''}" data-m="login">Student Login</button>
        <button class="auth-tab ${_authMode==='register'?'active':''}" data-m="register">New Student</button>
        <button class="auth-tab ${_authMode==='instructor'?'active':''}" data-m="instructor">Instructor</button>
      </div>

      <div id="auth-body">${_authMode==='login' ? loginFormHTML() : _authMode==='register' ? registerFormHTML() : instructorLoginHTML()}</div>
      <div id="auth-error" class="auth-error hidden"></div>
    </div>
    <div class="auth-footer">Skelora Institute · Thiruvalla — Local Data Mode. Each student's practice data stays private to their login on this device.<br><span style="opacity:0.75;">Developed by <b>Ananthu Shaji</b> · Dot Ecosystem</span></div>
  `;
  document.querySelectorAll('.auth-tab').forEach(t => t.onclick = () => { _authMode = t.dataset.m; renderAuthScreen(); });
  wireAuthForm();
}

function loginFormHTML() {
  return `
    <div class="field"><label>Student ID</label><input id="au-id" placeholder="e.g. skelora24" autofocus></div>
    <div class="field"><label>Password</label><input id="au-pw" type="password" placeholder="Enter your password"></div>
    <button class="btn btn-primary" id="au-submit" style="width:100%;justify-content:center;margin-top:6px;">Log In</button>
    <p class="auth-hint">First time here? Switch to <b>New Student</b> above to create your account.</p>
  `;
}
function registerFormHTML() {
  return `
    <div class="field"><label>Full Name</label><input id="au-name" placeholder="Your full name"></div>
    <div class="field"><label>Choose a Student ID</label><input id="au-id" placeholder="e.g. skelora24" autofocus></div>
    <div class="field"><label>Batch / Roll Number</label><input id="au-batch" placeholder="e.g. OA-2026-B (optional)"></div>
    <div class="field"><label>Choose a Password</label><input id="au-pw" type="password" placeholder="At least 4 characters"></div>
    <div class="field"><label>Confirm Password</label><input id="au-pw2" type="password" placeholder="Re-enter password"></div>
    <button class="btn btn-primary" id="au-submit" style="width:100%;justify-content:center;margin-top:6px;">Create Account</button>
  `;
}
function instructorLoginHTML() {
  return `
    <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:14px;">Instructor access lets you view the full student roster and open any student's simulation for grading.</p>
    <div class="field"><label>Instructor Password</label><input id="au-instpw" type="password" placeholder="Default: skelora123" autofocus></div>
    <button class="btn btn-primary" id="au-submit" style="width:100%;justify-content:center;margin-top:6px;">Enter Instructor Mode</button>
  `;
}

function showAuthError(msg) {
  const errEl = document.getElementById('auth-error');
  errEl.textContent = msg;
  errEl.classList.remove('hidden');
}

function wireAuthForm() {
  document.getElementById('auth-error').classList.add('hidden');
  const submitBtn = document.getElementById('au-submit');
  submitBtn.onclick = () => {
    if (_authMode === 'login') {
      const id = document.getElementById('au-id').value.trim();
      const pw = document.getElementById('au-pw').value;
      if (!id || !pw) return showAuthError('Please enter both Student ID and password.');
      const res = Auth.login(id, pw);
      if (!res.ok) return showAuthError(res.error);
      completeLogin(res.student.id, res.student.name, res.student.batch);
    } else if (_authMode === 'register') {
      const name = document.getElementById('au-name').value.trim();
      const id = document.getElementById('au-id').value.trim();
      const batch = document.getElementById('au-batch').value.trim();
      const pw = document.getElementById('au-pw').value;
      const pw2 = document.getElementById('au-pw2').value;
      if (!name || !id || !pw) return showAuthError('Name, Student ID and password are required.');
      if (!/^[a-zA-Z0-9_-]{3,24}$/.test(id)) return showAuthError('Student ID must be 3–24 characters (letters, numbers, - or _ only).');
      if (pw.length < 4) return showAuthError('Password must be at least 4 characters.');
      if (pw !== pw2) return showAuthError('Passwords do not match.');
      const res = Auth.register(id, name, batch, pw);
      if (!res.ok) return showAuthError(res.error);
      completeLogin(id, name, batch);
    } else {
      const pw = document.getElementById('au-instpw').value;
      if (!Auth.checkInstructorPassword(pw)) return showAuthError('Incorrect instructor password.');
      enterInstructorRoster();
    }
  };
  // Enter key submits
  document.querySelectorAll('#auth-body input').forEach(inp => {
    inp.onkeydown = (e) => { if (e.key === 'Enter') submitBtn.click(); };
  });
}

function completeLogin(id, name, batch) {
  Auth.setSession({ studentId: id, loggedInAt: new Date().toISOString(), instructor: false });
  resetUIState();
  Store.setStudent(id);
  const d = Store.load();
  d.meta.studentName = name || d.meta.studentName;
  d.meta.batch = batch || d.meta.batch;
  Store.save();
  hideAuthScreen();
  document.getElementById('logout-btn').classList.remove('hidden');
  document.getElementById('instructor-exit-banner').classList.add('hidden');
  updateTopbarUser();
  buildSidebarNav(false);
  navigate('dashboard');
  toast(`Welcome, ${escapeHtml(name || id)} 👋`, 'success');
}

function logout() {
  confirmAction('Log out of this session? Your data stays saved under your Student ID for next time.', () => {
    Auth.clearSession();
    resetUIState();
    showAuthScreen();
    _authMode = 'login';
    renderAuthScreen();
  });
}

/* ---------------- Instructor Roster ---------------- */
function enterInstructorRoster() {
  Auth.setSession({ instructor: true, loggedInAt: new Date().toISOString() });
  hideAuthScreen();
  document.getElementById('logout-btn').classList.remove('hidden');
  buildSidebarNav(true);
  renderInstructorRosterPage();
}

function renderInstructorRosterPage() {
  document.getElementById('crumb-current').textContent = 'Instructor Roster';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const content = document.getElementById('content');
  const reg = Auth.getRegistry();
  const students = Object.values(reg);

  content.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Instructor Access</div><h1>Student Roster</h1><p class="desc">All students who have registered on this computer. Open any student's simulation to review progress, or remove an account.</p></div>
      <div class="page-actions"><button class="btn btn-outline" onclick="openInstructorPasswordChange()">Change Instructor Password</button></div>
    </div>
    ${students.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#127891;</div><h4>No students registered yet</h4><p>Students will appear here once they create an account on this computer.</p></div></div>` : `
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Student</th><th>Student ID</th><th>Batch</th><th>Registered On</th><th>Actions</th></tr></thead>
          <tbody>
            ${students.map(s => `<tr>
              <td>${escapeHtml(s.name)}</td>
              <td class="mono">${escapeHtml(s.id)}</td>
              <td>${escapeHtml(s.batch||'—')}</td>
              <td>${fmtDate(s.createdAt)}</td>
              <td><div class="actions-cell">
                <button class="btn btn-sm btn-outline" onclick="instructorOpenStudent('${s.id}')">Open Dashboard</button>
                <button class="icon-action danger" title="Remove account" onclick="instructorDeleteStudent('${s.id}')">&#128465;</button>
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`}
  `;
}

function instructorOpenStudent(id) {
  const reg = Auth.getRegistry();
  const rec = reg[id.toLowerCase()];
  resetUIState();
  Store.setStudent(id);
  document.getElementById('instructor-exit-banner').classList.remove('hidden');
  document.getElementById('instructor-viewing-name').textContent = `${rec.name} (${rec.id})`;
  buildSidebarNav(false);
  updateTopbarUser();
  navigate('instructor');
}
function exitInstructorView() {
  document.getElementById('instructor-exit-banner').classList.add('hidden');
  buildSidebarNav(true);
  renderInstructorRosterPage();
}
function instructorDeleteStudent(id) {
  confirmAction(`Remove student account <b>${escapeHtml(id)}</b> and all their simulation data? This cannot be undone.`, () => {
    Auth.deleteStudent(id);
    toast('Student account removed', 'success');
    renderInstructorRosterPage();
  });
}
function openInstructorPasswordChange() {
  openModal({
    title: 'Change Instructor Password',
    narrow: true,
    body: `
      <div class="field" style="margin-bottom:12px;"><label>Current Password</label><input type="password" id="ip-old"></div>
      <div class="field"><label>New Password</label><input type="password" id="ip-new"></div>
    `,
    foot: `<button class="btn btn-outline" id="ip-cancel">Cancel</button><button class="btn btn-primary" id="ip-save">Save</button>`
  });
  document.getElementById('ip-cancel').onclick = closeModal;
  document.getElementById('ip-save').onclick = () => {
    if (!Auth.checkInstructorPassword(document.getElementById('ip-old').value)) return toast('Current password incorrect', 'error');
    const newPw = document.getElementById('ip-new').value;
    if (newPw.length < 4) return toast('New password too short', 'error');
    Auth.setInstructorPassword(newPw);
    closeModal(); toast('✓ Instructor password updated', 'success');
  };
}

/* ---------------- Sidebar visibility toggle ---------------- */
let _instructorRosterMode = false;
function buildSidebarNav(instructorMode) {
  _instructorRosterMode = instructorMode;
  document.querySelectorAll('.nav-item[data-route]').forEach(el => {
    el.style.display = instructorMode ? 'none' : '';
  });
  document.querySelectorAll('.nav-group-label').forEach(el => {
    el.style.display = instructorMode ? 'none' : '';
  });
  document.getElementById('btn-notif').style.display = instructorMode ? 'none' : '';
  document.getElementById('btn-sample').style.display = instructorMode ? 'none' : '';
  if (!instructorMode) applyCourseTrackVisibility();
}

/* ---------------- Session bootstrap ---------------- */
function bootstrapAuth() {
  const session = Auth.getSession();
  if (session && session.instructor) {
    hideAuthScreen();
    document.getElementById('logout-btn').classList.remove('hidden');
    buildSidebarNav(true);
    renderInstructorRosterPage();
    return true;
  }
  if (session && session.studentId && Auth.studentExists(session.studentId)) {
    Store.setStudent(session.studentId);
    hideAuthScreen();
    document.getElementById('logout-btn').classList.remove('hidden');
    buildSidebarNav(false);
    updateTopbarUser();
    navigate('dashboard');
    return true;
  }
  showAuthScreen();
  return false;
}
