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
   Accounts
   --------------------------------------------------------------------- */
function skSignUp({name, email, password, role}){
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
    // Also kept in the clear (not just hashed) so the "recent logins" picker
    // on the sign-in screen can auto-fill the password when a student taps
    // their name — this is a training simulator on a shared/offline browser,
    // not a system meant to protect real secrets, so that convenience is a
    // deliberate trade-off here, not an oversight.
    savedPassword: password,
    role: role==='faculty' ? 'faculty' : 'student',
    createdAt: new Date().toISOString()
  };
  users.push(user);
  _sk_saveUsers(users);
  skSetSession(user.id);
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
  return {ok:true, user};
}
function skSetSession(userId){ localStorage.setItem(SKELORA_SESSION_KEY, userId); }
function skGetSessionId(){ return localStorage.getItem(SKELORA_SESSION_KEY); }
function skLogOut(){ localStorage.removeItem(SKELORA_SESSION_KEY); }
function skGetCurrentUser(){
  const id = skGetSessionId();
  if(!id) return null;
  return _sk_loadUsers().find(u=>u.id===id) || null;
}
// Call at the top of any protected page. Redirects to login if nobody is signed in.
function skRequireAuth(){
  const u = skGetCurrentUser();
  if(!u){ window.location.replace('login.html'); return null; }
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
  return skUpdateUser(userId, {passHash:_sk_hash(newPassword)});
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
