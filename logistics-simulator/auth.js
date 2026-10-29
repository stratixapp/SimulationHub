/* =========================================================================
   SKELORA INSTITUTE LOGISTICS SIMULATOR — OFFLINE AUTH & PROGRESS STORE
   No backend. Everything lives in this browser's localStorage, so accounts
   and progress are specific to the computer/browser they were created on.
   This file is shared by login.html, the dashboard, and the workstation.
   ========================================================================= */

const SKELORA_USERS_KEY   = 'skelora_users_v1';
const SKELORA_SESSION_KEY = 'skelora_session_v1';
const SKELORA_PROGRESS_PREFIX = 'skelora_progress_v1_';

/* ---------------------------------------------------------------------
   Internal helpers
   --------------------------------------------------------------------- */
function _sk_loadUsers(){
  try { return JSON.parse(localStorage.getItem(SKELORA_USERS_KEY)) || []; }
  catch(e){ return []; }
}
function _sk_saveUsers(users){
  localStorage.setItem(SKELORA_USERS_KEY, JSON.stringify(users));
}
// Simple non-cryptographic hash — this is an offline training simulator,
// not a system holding real credentials, so this is intentionally lightweight.
function _sk_hash(str){
  let h = 0;
  for(let i=0;i<str.length;i++){ h = (h<<5)-h + str.charCodeAt(i); h |= 0; }
  return 'h'+h;
}
function _sk_initials(name){
  const parts = (name||'').trim().split(/\s+/).filter(Boolean);
  if(parts.length===0) return '??';
  if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}

/* ---------------------------------------------------------------------
   Login log (faculty "Login Monitor" in Administration)
   One entry per real sign-in / new account / sign-out on THIS computer, so
   faculty can see who used it and when. Entries hold only who + when + kind
   (name and Student ID are copied in so the entry survives an account being
   deleted). The password is deliberately NOT duplicated here - the monitor
   looks it up from the account record (user.savedPassword), so it is always
   the current one. Capped so it can never grow without bound.
   kind: 'login' | 'signup' | 'logout'
   --------------------------------------------------------------------- */
const SKELORA_LOGIN_LOG_KEY = 'skelora_login_log_v1';
function skGetLoginLog(){
  try { const a = JSON.parse(localStorage.getItem(SKELORA_LOGIN_LOG_KEY)); return Array.isArray(a) ? a : []; }
  catch(e){ return []; }
}
function _sk_pushLoginEvent(ev){
  try {
    const log = skGetLoginLog();
    log.push(ev);
    localStorage.setItem(SKELORA_LOGIN_LOG_KEY, JSON.stringify(log.length > 1000 ? log.slice(log.length - 1000) : log));
  } catch(e){ /* storage full / blocked: never let logging break sign-in */ }
}
function skRecordLogin(user, kind){
  if(!user) return;
  _sk_pushLoginEvent({userId:user.id, name:user.name, email:user.email, role:user.role, kind:kind, ts:new Date().toISOString()});
}
function skClearLoginLog(){ localStorage.removeItem(SKELORA_LOGIN_LOG_KEY); }

/* ---------------------------------------------------------------------
   Accounts
   --------------------------------------------------------------------- */
function skSignUp({name, email, password, role, position}){
  /* Note: internally this still uses the variable name "email" as the unique
     login key, to avoid touching every call site — but it now accepts any
     Student ID (roll number, admission number, etc.), not just email addresses.
     No email account or Gmail is required. Every Student ID must start with
     "SKELORA" (case-insensitive) and is stored/compared in uppercase. */
  name = (name||'').trim();
  email = (email||'').trim().toUpperCase().replace(/\s+/g, '');
  if(!name || !email || !password) return {ok:false, error:'Please fill in your name, Student ID, and password.'};
  if(!email.startsWith('SKELORA')) return {ok:false, error:'Student ID must start with "SKELORA" (e.g. SKELORA2026045).'};
  if(email.length < 8) return {ok:false, error:'Student ID must be at least 8 characters (SKELORA followed by your number).'};
  if(password.length < 4) return {ok:false, error:'Password must be at least 4 characters.'};
  const users = _sk_loadUsers();
  if(users.some(u=>u.email===email)){
    return {ok:false, error:'An account with this Student ID already exists on this computer. Try signing in instead.'};
  }
  const user = {
    id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7),
    name, email,
    passHash: _sk_hash(password),
    // Also kept in the clear (not just hashed) so faculty can look it up: the
    // student's own Settings page and the faculty Login Monitor both show it. This
    // is a training simulator on a shared/offline browser, not a system meant to
    // protect real secrets, so that is a deliberate trade-off. It is NOT used to
    // auto-fill the sign-in form any more.
    savedPassword: password,
    role: role==='faculty' ? 'faculty' : 'student',
    // Working position / job role picked on the sign-in screen (e.g. "Customs Clearance Executive").
    // Printed next to the student's name on every document PDF - see skGetWorkRole().
    position: (position||'').trim(),
    createdAt: new Date().toISOString()
  };
  users.push(user);
  _sk_saveUsers(users);
  skSetSession(user.id);
  skRecordLogin(user, 'signup');
  return {ok:true, user};
}
function skLogIn(email, password){
  email = (email||'').trim().toUpperCase().replace(/\s+/g, '');
  const users = _sk_loadUsers();
  const user = users.find(u=>u.email===email);
  if(!user) return {ok:false, error:'No account found with that Student ID on this computer. Create an account first.'};
  if(user.passHash !== _sk_hash(password)) return {ok:false, error:'Incorrect password. Please try again.'};
  // Backfill savedPassword for accounts created before the recent-logins
  // picker existed, so it works for them too from their next login onward.
  if(user.savedPassword !== password){ user.savedPassword = password; _sk_saveUsers(users); }
  skSetSession(user.id);
  skRecordLogin(user, 'login');
  return {ok:true, user};
}
function skSetSession(userId){ localStorage.setItem(SKELORA_SESSION_KEY, userId); }
function skGetSessionId(){ return localStorage.getItem(SKELORA_SESSION_KEY); }
function skLogOut(){
  const id = skGetSessionId();
  if(id) _sk_pushLoginEvent({userId:id, kind:'logout', ts:new Date().toISOString()});
  localStorage.removeItem(SKELORA_SESSION_KEY);
  localStorage.removeItem(SKELORA_WORKROLE_KEY);
}

/* ---------------------------------------------------------------------
   Working role (asked on every sign-in)
   The role the student picks on the sign-in screen for THIS session. It is
   printed next to the student's name on every document PDF ("Document Prepared
   By - Name - Role"), on the certificate, and is handed to TCOS. It is separate
   from user.role ('student' | 'faculty'), which controls permissions.
   --------------------------------------------------------------------- */
const SKELORA_WORKROLE_KEY = 'skelora_session_workrole_v1';
function skSetWorkRole(role){
  role = (role||'').trim();
  try{
    if(role) localStorage.setItem(SKELORA_WORKROLE_KEY, role); else localStorage.removeItem(SKELORA_WORKROLE_KEY);
    const id = skGetSessionId();
    if(id && role){ const u = _sk_loadUsers().find(x=>x.id===id); if(u && u.position !== role) skUpdateUser(id, {position: role}); }
  }catch(e){}
}
function skGetWorkRole(){
  try{
    const r = localStorage.getItem(SKELORA_WORKROLE_KEY);
    if(r) return r;
    const u = skGetCurrentUser();
    if(u && u.position) return u.position;
    if(u) return u.role==='faculty' ? 'Faculty / Instructor' : 'Student';
  }catch(e){}
  return '';
}
/* {name, role, id} of whoever is signed in - read by the ICEGATE print renderers (customs-forms.js) */
function skGetPreparedBy(){
  const u = skGetCurrentUser();
  if(!u) return null;
  return {name:u.name, role:skGetWorkRole(), id:u.email};
}
try{ window.skGetPreparedBy = skGetPreparedBy; }catch(e){}
function skGetCurrentUser(){
  const id = skGetSessionId();
  if(!id) return null;
  return _sk_loadUsers().find(u=>u.id===id) || null;
}
// Call at the top of any protected page. Redirects to login if nobody is signed in.
/* Redirect-loop breaker: if sign-in and the dashboard keep sending each other back (storage not shared between pages),
   stop after a few bounces instead of flashing until the tab crashes. */
function skLoopTrip(){
  try{
    const now = Date.now(), t = +sessionStorage.getItem('sk_nav_t')||0;
    let n = +sessionStorage.getItem('sk_nav_n')||0;
    n = (now - t < 6000) ? n + 1 : 1;
    sessionStorage.setItem('sk_nav_t', String(now)); sessionStorage.setItem('sk_nav_n', String(n));
    if(n >= 5){
      sessionStorage.removeItem('sk_nav_n');
      document.open();
      document.write('<!doctype html><meta charset="utf-8"><body style="font-family:Segoe UI,Arial,sans-serif;background:#0b1f3a;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px"><div style="max-width:520px;line-height:1.55"><h2>Sign-in could not be kept</h2><p>This browser is not saving your sign-in between pages. Close private/incognito mode, allow site data, or open the hub through a local server (START_LOCAL_SERVER.bat then http://localhost:8000) or in Chrome / Edge. Then <a style="color:#7fc1ff" href="login.html">try again</a>.</p></div></body>');
      document.close();
      return true;
    }
  }catch(e){}
  return false;
}
function skRequireAuth(){
  const u = skGetCurrentUser();
  if(!u){ if(skLoopTrip()) return null; window.location.replace('login.html'); return null; }
  return u;
}
function skListAllUsers(){ return _sk_loadUsers().slice().sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt)); }
function skUpdateUser(userId, patch){
  const users = _sk_loadUsers();
  const idx = users.findIndex(u=>u.id===userId);
  if(idx===-1) return {ok:false, error:'User not found.'};
  users[idx] = {...users[idx], ...patch};
  _sk_saveUsers(users);
  return {ok:true, user:users[idx]};
}
function skChangePassword(userId, currentPassword, newPassword){
  const users = _sk_loadUsers();
  const user = users.find(u=>u.id===userId);
  if(!user) return {ok:false, error:'User not found.'};
  if(user.passHash !== _sk_hash(currentPassword)) return {ok:false, error:'Your current password is incorrect.'};
  return skUpdateUser(userId, {passHash:_sk_hash(newPassword), savedPassword:newPassword});
}
/* Permanently deletes ONE student's account and every piece of data tied
   to that userId - and only that userId; every key here is namespaced by
   userId so no other student's data is touched. Covers every per-user
   localStorage key across the whole app: progress, audit trail, active
   Job, Job ID sequence counter, Job history, track selection, companies/
   customers list, and inbox read-tracking. The constants referenced below
   (SKELORA_JOB_PREFIX etc.) are defined in job-engine.js, which has
   always finished loading by the time a person can actually click a
   delete button, so this resolves correctly despite auth.js loading
   first in the script tag order. */
function skDeleteUser(userId){
  const users = _sk_loadUsers().filter(u=>u.id!==userId);
  _sk_saveUsers(users);
  localStorage.removeItem(SKELORA_PROGRESS_PREFIX+userId);
  localStorage.removeItem(_sk_auditKey(userId));
  try{
    if(typeof SKELORA_JOB_PREFIX !== 'undefined') localStorage.removeItem(SKELORA_JOB_PREFIX+userId);
    if(typeof SKELORA_JOB_SEQ_PREFIX !== 'undefined') localStorage.removeItem(SKELORA_JOB_SEQ_PREFIX+userId);
    if(typeof SKELORA_JOB_HISTORY_PREFIX !== 'undefined') localStorage.removeItem(SKELORA_JOB_HISTORY_PREFIX+userId);
    if(typeof SKELORA_TRACK_PREFIX !== 'undefined') localStorage.removeItem(SKELORA_TRACK_PREFIX+userId);
    if(typeof SKELORA_COMPANIES_PREFIX !== 'undefined') localStorage.removeItem(SKELORA_COMPANIES_PREFIX+userId);
    if(typeof SKELORA_CUSTOM_COUNTRIES_PREFIX !== 'undefined') localStorage.removeItem(SKELORA_CUSTOM_COUNTRIES_PREFIX+userId);
    if(typeof SKELORA_SEQNUM_PREFIX !== 'undefined') localStorage.removeItem(SKELORA_SEQNUM_PREFIX+userId);
  }catch(e){}
  localStorage.removeItem('skelora_inbox_read_v1_'+userId);
  localStorage.removeItem('skelora_shipment_v1_'+userId);
}

/* ---------------------------------------------------------------------
   Audit Trail (Phase 6) - a real, append-only log of document actions.
   Purely additive: nothing existing reads or depends on this data, it
   only records events that already happen (save / complete / restart).
   --------------------------------------------------------------------- */
const SKELORA_AUDIT_PREFIX = 'skelora_audit_v1_';
function _sk_auditKey(userId){ return SKELORA_AUDIT_PREFIX + userId; }
function skGetAllAuditLog(userId){
  try { return JSON.parse(localStorage.getItem(_sk_auditKey(userId))) || []; }
  catch(e){ return []; }
}
function skAppendAudit(userId, slug, action, meta){
  if(!userId || !slug) return;
  const log = skGetAllAuditLog(userId);
  log.push({slug, action, meta: meta||{}, ts: new Date().toISOString()});
  /* Cap total entries so this never grows unbounded in localStorage */
  const capped = log.length > 500 ? log.slice(log.length - 500) : log;
  localStorage.setItem(_sk_auditKey(userId), JSON.stringify(capped));
}
function skGetAuditLog(userId, slug){
  return skGetAllAuditLog(userId).filter(e=>e.slug===slug).sort((a,b)=>new Date(b.ts)-new Date(a.ts));
}

/* Merges an imported set of audit-log entries (from another lab computer's
   "My Progress" export) into this computer's own log for the same user,
   instead of overwriting or silently dropping them. Dedupes on
   slug+action+ts so re-importing the same file twice doesn't double the
   entries — this matters because skGetDocumentTiming/skGetJobAudit derive
   real attempts and time-spent from this log, so losing it on a computer
   switch would silently zero those out. */
function skMergeAuditLog(userId, importedEntries){
  if(!userId || !Array.isArray(importedEntries) || importedEntries.length===0) return 0;
  const existing = skGetAllAuditLog(userId);
  const seen = new Set(existing.map(e => `${e.slug}|${e.action}|${e.ts}`));
  let added = 0;
  importedEntries.forEach(e=>{
    if(!e || !e.slug || !e.action || !e.ts) return;
    const key = `${e.slug}|${e.action}|${e.ts}`;
    if(seen.has(key)) return;
    seen.add(key);
    existing.push({slug: e.slug, action: e.action, meta: e.meta||{}, ts: e.ts});
    added++;
  });
  existing.sort((a,b) => new Date(a.ts) - new Date(b.ts));
  const capped = existing.length > 500 ? existing.slice(existing.length - 500) : existing;
  localStorage.setItem(_sk_auditKey(userId), JSON.stringify(capped));
  return added;
}

/* ---------------------------------------------------------------------
   Per-student exercise progress
   --------------------------------------------------------------------- */
function _sk_progressKey(userId){ return SKELORA_PROGRESS_PREFIX + userId; }
function skGetAllProgress(userId){
  try { return JSON.parse(localStorage.getItem(_sk_progressKey(userId))) || {}; }
  catch(e){ return {}; }
}
function skGetDocProgress(userId, slug){ return skGetAllProgress(userId)[slug] || null; }
function skSaveDocProgress(userId, slug, patch){
  const all = skGetAllProgress(userId);
  all[slug] = {...(all[slug]||{startedAt:new Date().toISOString()}), ...patch, updatedAt:new Date().toISOString()};
  localStorage.setItem(_sk_progressKey(userId), JSON.stringify(all));
  return all[slug];
}
function skResetUserProgress(userId){
  localStorage.removeItem(_sk_progressKey(userId));
  localStorage.removeItem(_sk_auditKey(userId));
}
function skComputeStats(userId, totalExercises){
  const all = skGetAllProgress(userId);
  const entries = Object.values(all);
  const completed = entries.filter(e=>e.status==='completed').length;
  const inProgress = entries.filter(e=>e.status==='in-progress').length;
  const notStarted = Math.max(0, totalExercises - completed - inProgress);
  const pct = totalExercises>0 ? Math.round((completed/totalExercises)*100) : 0;
  return {completed, inProgress, notStarted, total:totalExercises, pct};
}
