// ─────────────────────────────────────────────────────────────
// Auth — client-side only, by design. This simulator is static
// files with no backend, so there is no server to verify a
// password against. What this module actually does is:
//   1) Give each Student ID its own isolated save-slot in this
//      browser's localStorage, so multiple students sharing one
//      lab computer never overwrite each other's progress.
//   2) Present a professional-looking sign-in gate with a
//      typo-catching captcha.
// It is NOT secure authentication — a password only has to match
// what that Student ID registered with on THIS browser. Don't
// reuse a real password here, and don't rely on this for anything
// beyond keeping classroom sessions separate.
// ─────────────────────────────────────────────────────────────
var Auth = (function () {
  const ACCOUNTS_KEY = 'procurement-simulator-accounts';

  function hasLocalStorage() {
    try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch (e) { return false; }
  }

  // Small non-cryptographic string hash (cyrb53) — just enough so
  // a password isn't sitting in localStorage in plain text.
  function hashString(str) {
    let h1 = 0xdeadbeef ^ 0;
    let h2 = 0x41c6ce57 ^ 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }

  function loadAccounts() {
    if (!hasLocalStorage()) return {};
    try {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveAccounts(accounts) {
    if (!hasLocalStorage()) return;
    try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); } catch (e) { /* storage full/unavailable */ }
  }

  function normalizeId(id) {
    return String(id || '').trim().toUpperCase();
  }

  function validateStudentId(id) {
    const v = normalizeId(id);
    if (!v) return 'Student ID is required.';
    if (!v.startsWith('SKELORA')) return 'Student ID must start with SKELORA (e.g. SKELORA-2026-014).';
    if (v.length < 8) return 'That Student ID looks incomplete — e.g. SKELORA-2026-014.';
    return null;
  }

  const SECURITY_QUESTIONS = [
    'What was the name of your first school?',
    "What is your favourite teacher's name?",
    'What city were you born in?',
    'What was the name of your first pet?',
  ];

  const LOCKOUT_MAX_ATTEMPTS = 5;
  const LOCKOUT_MINUTES = 2; // short — this is a classroom tool, not a bank

  function register(id, password, securityQuestion, securityAnswer) {
    const studentId = normalizeId(id);
    const idError = validateStudentId(studentId);
    if (idError) return { ok: false, error: idError };
    if (!password || password.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };
    if (!securityQuestion || !securityAnswer || !securityAnswer.trim()) return { ok: false, error: 'Choose a security question and answer it — you\'ll need it if you forget your password.' };
    const accounts = loadAccounts();
    if (accounts[studentId]) return { ok: false, error: 'That Student ID is already registered on this computer. Sign in instead.' };
    accounts[studentId] = {
      passwordHash: hashString(password), createdAt: new Date().toISOString(),
      securityQuestion, securityAnswerHash: hashString(securityAnswer.trim().toLowerCase()),
      failedAttempts: 0, lockUntil: null,
    };
    saveAccounts(accounts);
    return { ok: true, studentId };
  }

  function login(id, password) {
    const studentId = normalizeId(id);
    const idError = validateStudentId(studentId);
    if (idError) return { ok: false, error: idError };
    const accounts = loadAccounts();
    const account = accounts[studentId];
    if (!account) return { ok: false, error: 'No account found for that Student ID on this computer. Create one first.' };

    if (account.lockUntil && Date.now() < account.lockUntil) {
      const minsLeft = Math.ceil((account.lockUntil - Date.now()) / 60000);
      return { ok: false, error: 'Too many failed attempts — try again in ' + minsLeft + ' minute(s), or use "Forgot password?".' };
    }

    if (account.passwordHash !== hashString(password || '')) {
      account.failedAttempts = (account.failedAttempts || 0) + 1;
      if (account.failedAttempts >= LOCKOUT_MAX_ATTEMPTS) {
        account.lockUntil = Date.now() + LOCKOUT_MINUTES * 60000;
        account.failedAttempts = 0;
        saveAccounts(accounts);
        return { ok: false, error: 'Too many failed attempts — locked for ' + LOCKOUT_MINUTES + ' minute(s). Use "Forgot password?" if needed.' };
      }
      saveAccounts(accounts);
      return { ok: false, error: 'Incorrect password. ' + (LOCKOUT_MAX_ATTEMPTS - account.failedAttempts) + ' attempt(s) remaining before a temporary lock.' };
    }

    account.failedAttempts = 0;
    account.lockUntil = null;
    saveAccounts(accounts);
    return { ok: true, studentId };
  }

  function getSecurityQuestion(id) {
    const accounts = loadAccounts();
    const account = accounts[normalizeId(id)];
    return account ? account.securityQuestion : null;
  }

  function resetPasswordWithSecurityAnswer(id, securityAnswer, newPassword) {
    const studentId = normalizeId(id);
    const accounts = loadAccounts();
    const account = accounts[studentId];
    if (!account) return { ok: false, error: 'No account found for that Student ID on this computer.' };
    if (account.securityAnswerHash !== hashString(String(securityAnswer || '').trim().toLowerCase())) {
      return { ok: false, error: 'That answer doesn\'t match what we have on file.' };
    }
    if (!newPassword || newPassword.length < 4) return { ok: false, error: 'New password must be at least 4 characters.' };
    account.passwordHash = hashString(newPassword);
    account.failedAttempts = 0;
    account.lockUntil = null;
    saveAccounts(accounts);
    return { ok: true };
  }

  function accountExists(id) {
    const accounts = loadAccounts();
    return !!accounts[normalizeId(id)];
  }

  function listStudentIds() {
    return Object.keys(loadAccounts()).sort();
  }

  // ── Captcha — a typo-catching friction step, not bot protection ──
  const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0, I/1 — avoids ambiguity
  function generateCaptcha() {
    let code = '';
    for (let i = 0; i < 5; i++) code += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
    return code;
  }
  function captchaMatches(code, input) {
    return String(code || '').toUpperCase() === String(input || '').trim().toUpperCase();
  }

  return {
    register, login, accountExists, validateStudentId, normalizeId, generateCaptcha, captchaMatches, ACCOUNTS_KEY,
    SECURITY_QUESTIONS, getSecurityQuestion, resetPasswordWithSecurityAnswer, listStudentIds,
  };
})();
