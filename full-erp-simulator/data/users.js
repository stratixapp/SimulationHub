/* =============================================================================
   DOT ERP
   FILE:  data/users.js
   ROLE:  User accounts, password hashing and account administration.

   NO SEEDED USERS. The first administrator is created on first launch from the
   sign-in screen; every other account is created by an administrator in
   User & Role Management. Nothing here ships with a default login.

   PASSWORDS: never stored in plain text. Each account keeps a random 16-byte
   salt and a PBKDF2-HMAC-SHA256 hash (see the pure-JS implementation below,
   verified against a reference implementation). It is synchronous on purpose so
   the rest of the app's synchronous repository style is unchanged.

   HONEST LIMIT: this app runs entirely in the browser with no server, so the
   account list lives in this browser's localStorage. Hashing keeps passwords
   from being read back, but anyone with full access to the browser profile /
   developer tools can still tamper with local data. Treat sign-in as access
   control for a shared workstation, not as a security boundary against a
   determined local attacker. (Multi-user, multi-device security needs a server.)
   ========================================================================== */

const ERP_USER_ACCOUNTS_KEY = "erp_accounts";
const ERP_LOGIN_LOG_KEY = "erp_login_audit_log";
const ERP_LOGIN_ATTEMPTS_KEY = "erp_login_attempts";
const ERP_PBKDF2_ITERATIONS = 15000;

/* ---------- SHA-256 / HMAC / PBKDF2 (pure JS, synchronous) ---------- */
const ERP_Crypto = (function () {
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  const W = new Uint32Array(64);
  function compress(H, blk, off) {
    let i;
    for (i = 0; i < 16; i++) W[i] = (blk[off + 4 * i] << 24) | (blk[off + 4 * i + 1] << 16) | (blk[off + 4 * i + 2] << 8) | blk[off + 4 * i + 3];
    for (i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  function sha256(bytes) {
    const H = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const n = bytes.length, total = ((n + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total); buf.set(bytes); buf[n] = 0x80;
    const bits = n * 8;
    buf[total - 4] = (bits >>> 24) & 255; buf[total - 3] = (bits >>> 16) & 255; buf[total - 2] = (bits >>> 8) & 255; buf[total - 1] = bits & 255;
    buf[total - 8] = Math.floor(n / 0x20000000) & 255;
    for (let o = 0; o < total; o += 64) compress(H, buf, o);
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) { out[4 * i] = (H[i] >>> 24) & 255; out[4 * i + 1] = (H[i] >>> 16) & 255; out[4 * i + 2] = (H[i] >>> 8) & 255; out[4 * i + 3] = H[i] & 255; }
    return out;
  }
  function hmac(key, msg) {
    if (key.length > 64) key = sha256(key);
    const ipad = new Uint8Array(64 + msg.length), opad = new Uint8Array(96);
    for (let i = 0; i < 64; i++) { const k = i < key.length ? key[i] : 0; ipad[i] = k ^ 0x36; opad[i] = k ^ 0x5c; }
    ipad.set(msg, 64);
    opad.set(sha256(ipad), 64);
    return sha256(opad);
  }
  const utf8 = (s) => new TextEncoder().encode(s);
  function pbkdf2(password, salt, iterations) {           // 32-byte output = exactly one PBKDF2 block
    const pw = utf8(password);
    const s = new Uint8Array(salt.length + 4); s.set(salt); s[salt.length + 3] = 1;
    let u = hmac(pw, s); const t = new Uint8Array(u);
    for (let i = 1; i < iterations; i++) { u = hmac(pw, u); for (let j = 0; j < 32; j++) t[j] ^= u[j]; }
    return t;
  }
  const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  const unhex = (h) => new Uint8Array((h.match(/.{2}/g) || []).map((x) => parseInt(x, 16)));
  function randomBytes(n) { const b = new Uint8Array(n); (self.crypto || window.crypto).getRandomValues(b); return b; }
  function safeEqual(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
  return { sha256, hmac, pbkdf2, hex, unhex, randomBytes, safeEqual };
})();

function erpHashSecret(secret, saltHex, iterations) {
  const salt = saltHex ? ERP_Crypto.unhex(saltHex) : ERP_Crypto.randomBytes(16);
  return { salt: ERP_Crypto.hex(salt), hash: ERP_Crypto.hex(ERP_Crypto.pbkdf2(secret, salt, iterations || ERP_PBKDF2_ITERATIONS)), iterations: iterations || ERP_PBKDF2_ITERATIONS };
}

const ERP_USERNAME_PATTERN = /^[a-zA-Z0-9._]{3,30}$/;
const ERP_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ERP_RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O/1/I confusion

const ERP_UserRepository = {
  ADMIN_ROLE: "System Administrator",

  /* ---- raw storage (secrets included) — never returned outside this file ---- */
  _raw() { try { return JSON.parse(localStorage.getItem(ERP_USER_ACCOUNTS_KEY)) || []; } catch { return []; } },
  _write(list) { try { localStorage.setItem(ERP_USER_ACCOUNTS_KEY, JSON.stringify(list)); return true; } catch { return false; } },
  _find(username) { const n = String(username || "").trim().toLowerCase(); return this._raw().find((u) => u.username.toLowerCase() === n) || null; },
  _public(u) {
    if (!u) return null;
    const { passwordHash, passwordSalt, passwordIterations, recoveryHash, recoverySalt, ...rest } = u;
    return { ...rest, hasRecoveryKey: !!recoveryHash };
  },
  _update(username, fn) {
    const list = this._raw(); const n = String(username || "").toLowerCase();
    const i = list.findIndex((u) => u.username.toLowerCase() === n);
    if (i < 0) return { ok: false, error: "User not found." };
    const err = fn(list[i], list);
    if (err) return { ok: false, error: err };
    return this._write(list) ? { ok: true, user: this._public(list[i]) } : { ok: false, error: "Couldn't save — browser storage is full or blocked." };
  },
  _activeAdmins(list) { return (list || this._raw()).filter((u) => u.role === this.ADMIN_ROLE && u.status === "Active"); },

  /* ---- reads ---- */
  isSetupRequired() { return this._raw().length === 0; },
  all() { return this._raw().map((u) => this._public(u)); },
  findByUsername(username) { return this._public(this._find(username)); },
  findByEmail(email) { const n = String(email || "").trim().toLowerCase(); return this._public(this._raw().find((u) => (u.email || "").toLowerCase() === n) || null); },

  /* ---- password rules (one place, used by every form) ---- */
  passwordProblem(pw) {
    if (typeof pw !== "string" || pw.length < 8) return "Use at least 8 characters.";
    if (pw.length > 64) return "Maximum 64 characters.";
    if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Include both letters and numbers.";
    return null;
  },
  passwordStrength(pw) {                                   // 0..4
    let s = 0; if (!pw) return 0;
    if (pw.length >= 8) s++; if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(4, s);
  },

  /* ---- first run ---- */
  createAdministrator({ fullName, email, username, password }) {
    if (!this.isSetupRequired()) return { ok: false, error: "This workspace is already set up." };
    const check = this._validateNew({ fullName, email, username, password }, []);
    if (check) return { ok: false, error: check };
    const recoveryKey = this._newRecoveryKey();
    const h = erpHashSecret(password), r = erpHashSecret(recoveryKey.replace(/-/g, ""));
    const user = {
      id: "USR-" + Date.now().toString(36).toUpperCase(), username: username.trim(), fullName: fullName.trim(), email: email.trim(),
      role: this.ADMIN_ROLE, department: "Administration", phone: "", bio: "", photoDataUrl: null, status: "Active",
      createdAt: new Date().toISOString(), joinedDate: new Date().toISOString().slice(0, 10), mustChangePassword: false,
      passwordHash: h.hash, passwordSalt: h.salt, passwordIterations: h.iterations, passwordChangedAt: null,
      recoveryHash: r.hash, recoverySalt: r.salt
    };
    if (!this._write([user])) return { ok: false, error: "Couldn't save — browser storage is full or blocked." };
    return { ok: true, user: this._public(user), recoveryKey };
  },
  _newRecoveryKey() {
    const b = ERP_Crypto.randomBytes(20); let k = "";
    for (let i = 0; i < 20; i++) { k += ERP_RECOVERY_ALPHABET[b[i] % 32]; if (i % 5 === 4 && i < 19) k += "-"; }
    return k;
  },
  _validateNew(d, existing) {
    if (String(d.fullName || "").trim().length < 2) return "Enter the person's full name.";
    if (!ERP_EMAIL_PATTERN.test(String(d.email || "").trim())) return "Enter a valid email address.";
    if (!ERP_USERNAME_PATTERN.test(String(d.username || "").trim())) return "Username: 3–30 letters, numbers, dot or underscore.";
    if (existing.some((u) => u.username.toLowerCase() === d.username.trim().toLowerCase())) return "That username is already taken.";
    if (existing.some((u) => (u.email || "").toLowerCase() === d.email.trim().toLowerCase())) return "That email is already used by another account.";
    return this.passwordProblem(d.password);
  },

  /* ---- administrator: create / manage other users ---- */
  createUser({ fullName, email, username, department, role, password }, roles) {
    const list = this._raw();
    if (roles && !roles.includes(role)) return { ok: false, error: "Choose a role." };
    const check = this._validateNew({ fullName, email, username, password }, list);
    if (check) return { ok: false, error: check };
    const h = erpHashSecret(password);
    const user = {
      id: "USR-" + Date.now().toString(36).toUpperCase() + list.length, username: username.trim(), fullName: fullName.trim(), email: email.trim(),
      role, department: (department || "").trim(), phone: "", bio: "", photoDataUrl: null, status: "Active",
      createdAt: new Date().toISOString(), joinedDate: new Date().toISOString().slice(0, 10), mustChangePassword: true,
      passwordHash: h.hash, passwordSalt: h.salt, passwordIterations: h.iterations, passwordChangedAt: null
    };
    list.push(user);
    return this._write(list) ? { ok: true, user: this._public(user) } : { ok: false, error: "Couldn't save — browser storage is full or blocked." };
  },
  setRole(username, role, roles) {
    return this._update(username, (u, list) => {
      if (roles && !roles.includes(role)) return "Choose a valid role.";
      if (u.role === this.ADMIN_ROLE && role !== this.ADMIN_ROLE && this._activeAdmins(list).length <= 1) return "At least one active administrator is required.";
      u.role = role;
    });
  },
  setStatus(username, status) {
    return this._update(username, (u, list) => {
      if (!["Active", "Inactive"].includes(status)) return "Bad status.";
      if (status === "Inactive" && u.role === this.ADMIN_ROLE && this._activeAdmins(list).length <= 1) return "At least one active administrator is required.";
      u.status = status;
    });
  },
  /** Administrator sets a temporary password; the user must change it at next sign-in. */
  adminResetPassword(username, tempPassword) {
    const p = this.passwordProblem(tempPassword); if (p) return { ok: false, error: p };
    return this._update(username, (u) => {
      const h = erpHashSecret(tempPassword);
      u.passwordHash = h.hash; u.passwordSalt = h.salt; u.passwordIterations = h.iterations; u.mustChangePassword = true;
    });
  },

  /* ---- authentication ---- */
  verifyPassword(username, password) {
    const u = this._find(username); if (!u) return false;
    const h = ERP_Crypto.hex(ERP_Crypto.pbkdf2(String(password || ""), ERP_Crypto.unhex(u.passwordSalt), u.passwordIterations || ERP_PBKDF2_ITERATIONS));
    return ERP_Crypto.safeEqual(h, u.passwordHash);
  },
  /** -> { ok, user } | { ok:false, reason: "invalid" | "inactive" } */
  authenticate(username, password) {
    const u = this._find(username);
    if (!u) { erpHashSecret(String(password || ""), null, ERP_PBKDF2_ITERATIONS); return { ok: false, reason: "invalid" }; }   // equalise timing
    if (!this.verifyPassword(username, password)) return { ok: false, reason: "invalid" };
    if (u.status !== "Active") return { ok: false, reason: "inactive" };
    this._update(u.username, (x) => { x.lastLoginAt = new Date().toISOString(); });
    return { ok: true, user: this._public(u) };
  },
  /** Change your own password (also clears the "must change" flag). */
  changePassword(username, currentPassword, newPassword) {
    if (!this.verifyPassword(username, currentPassword)) return { ok: false, error: "Current password is incorrect." };
    const p = this.passwordProblem(newPassword); if (p) return { ok: false, error: p };
    if (newPassword === currentPassword) return { ok: false, error: "New password must be different from the current one." };
    return this._update(username, (u) => {
      const h = erpHashSecret(newPassword);
      u.passwordHash = h.hash; u.passwordSalt = h.salt; u.passwordIterations = h.iterations; u.mustChangePassword = false; u.passwordChangedAt = new Date().toISOString();
    });
  },
  /** Forgot-password for the administrator who holds the recovery key. */
  recoverWithKey(username, recoveryKey, newPassword) {
    const u = this._find(username);
    const key = String(recoveryKey || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const ok = u && u.recoveryHash && ERP_Crypto.safeEqual(ERP_Crypto.hex(ERP_Crypto.pbkdf2(key, ERP_Crypto.unhex(u.recoverySalt), ERP_PBKDF2_ITERATIONS)), u.recoveryHash);
    if (!ok) return { ok: false, error: "That username / recovery key combination isn't valid." };
    const p = this.passwordProblem(newPassword); if (p) return { ok: false, error: p };
    return this._update(u.username, (x) => {
      const h = erpHashSecret(newPassword);
      x.passwordHash = h.hash; x.passwordSalt = h.salt; x.passwordIterations = h.iterations; x.mustChangePassword = false; x.passwordChangedAt = new Date().toISOString(); x.status = "Active";
    });
  },
  /** Issue a fresh recovery key (invalidates the old one). Requires the current password. */
  regenerateRecoveryKey(username, password) {
    if (!this.verifyPassword(username, password)) return { ok: false, error: "Password is incorrect." };
    const key = this._newRecoveryKey(); const r = erpHashSecret(key.replace(/-/g, ""));
    const res = this._update(username, (u) => { u.recoveryHash = r.hash; u.recoverySalt = r.salt; });
    return res.ok ? { ok: true, recoveryKey: key } : res;
  },

  /* ---- own profile (name / email / phone / bio / photo) ---- */
  updateProfile(username, partial) {
    return this._update(username, (u, list) => {
      const allowed = ["fullName", "email", "phone", "bio", "photoDataUrl"];
      if (partial.email && list.some((x) => x !== u && (x.email || "").toLowerCase() === String(partial.email).toLowerCase())) return "That email is already used by another account.";
      allowed.forEach((k) => { if (k in partial) u[k] = partial[k]; });
    });
  },
  /** Legacy signature used by Profile: profile fields only (passwords go through changePassword). */
  saveOverride(username, partial) { return this.updateProfile(username, partial).ok; },

  /* ---- sign-in activity + brute-force lockout (this browser) ---- */
  logSignIn(username, status) {
    let log = []; try { log = JSON.parse(localStorage.getItem(ERP_LOGIN_LOG_KEY)) || []; } catch { log = []; }
    log.unshift({ id: "LOG-" + Date.now().toString(36).toUpperCase(), timestamp: new Date().toISOString(), username: username || "(blank)", status, device: (navigator.userAgent.match(/(Edg|Firefox|Chrome|Safari)\//) || ["", "Browser"])[1].replace("Edg", "Edge") + " · " + (navigator.platform || "") });
    if (log.length > 200) log.length = 200;
    try { localStorage.setItem(ERP_LOGIN_LOG_KEY, JSON.stringify(log)); } catch { /* ignore */ }
  },
  signInHistory() { try { return JSON.parse(localStorage.getItem(ERP_LOGIN_LOG_KEY)) || []; } catch { return []; } },
  lockoutFor(username) {
    let m = {}; try { m = JSON.parse(localStorage.getItem(ERP_LOGIN_ATTEMPTS_KEY)) || {}; } catch { m = {}; }
    const r = m[String(username || "").toLowerCase()]; return r && r.lockUntil > Date.now() ? r.lockUntil : 0;
  },
  registerFailure(username) {
    let m = {}; try { m = JSON.parse(localStorage.getItem(ERP_LOGIN_ATTEMPTS_KEY)) || {}; } catch { m = {}; }
    const k = String(username || "").toLowerCase(); const r = m[k] || { count: 0, lockUntil: 0 };
    r.count += 1; let locked = 0;
    if (r.count >= 5) { r.lockUntil = Date.now() + 60000; r.count = 0; locked = r.lockUntil; }
    m[k] = r; try { localStorage.setItem(ERP_LOGIN_ATTEMPTS_KEY, JSON.stringify(m)); } catch { /* ignore */ }
    return { lockUntil: locked, left: locked ? 0 : 5 - r.count };
  },
  clearFailures(username) {
    let m = {}; try { m = JSON.parse(localStorage.getItem(ERP_LOGIN_ATTEMPTS_KEY)) || {}; } catch { m = {}; }
    delete m[String(username || "").toLowerCase()]; try { localStorage.setItem(ERP_LOGIN_ATTEMPTS_KEY, JSON.stringify(m)); } catch { /* ignore */ }
  }
};
