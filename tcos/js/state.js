/* ============================================================
   TCOS TRAINING SIMULATOR — STATE / PERSISTENCE LAYER
   ============================================================
   Data isolation model (no backend, so this is local-only):
   - SESSION_KEY holds only "who is currently signed in" — tiny,
     never contains filings/bookings/etc.
   - Each local profile's operational data lives in its OWN
     localStorage key, namespaced by userId, so one profile can
     never see another profile's filings, bookings, certificates,
     notifications, or any other transactional record.
   - Demo credentials (published on the login screen) are shared
     login handles, but each userId still gets a private namespace
     the moment two different browser sessions or a reset touch it.
   ============================================================ */

const SESSION_KEY = 'icegate_training_session_v1';
const STORAGE_PREFIX = 'icegate_training_state_v1::';

function dataKeyFor(userId) {
  return STORAGE_PREFIX + String(userId || 'anonymous').toUpperCase();
}

function defaultState() {
  return {
    user: { loggedIn: false, userId: null, profile: null },
    filings: [],       // array of filing objects
    bookings: [],      // array of freight booking objects
    igms: [],          // Import General Manifest entries (carrier-filed)
    egms: [],          // Export General Manifest entries (carrier-filed, closes Shipping Bills)
    licenses: JSON.parse(JSON.stringify(DEMO_LICENSE_SEED)), // DGFT scheme licenses (Advance Auth / EPCG)
    riskProfile: { score: 50, aeo: false, cleanFilings: 0, violations: 0 }, // training RMS profile
    notifications: [], // {id, ts, text, read, filingId}
    documentsGenerated: [], // {id, type, filingId, ts, title, refNo}
    assessments: [],   // {id, filingId, ts, score, breakdown, verdict}
    counters: { sb: 183, boe: 44, qry: 60, amend: 10 },
    jobSim: { active: null, runs: [] },       // active job-simulator run + completed run history
    certificates: [],  // generated training-completion certificates
    trainerNotes: {},  // local trainer-console notes keyed by demo student id
    drawbackClaims: [], // Duty Drawback (AIR) claims linked to export filings
    rodtepScrips: [],   // RoDTEP e-scrips generated on export
    brcRecords: [],      // Bank Realisation Certificate tracking per export filing
    bonds: [],          // Bond / Bank Guarantee register
    jobCostings: {},      // freight job costing sheets, keyed by booking id
    usedIds: {},          // { [prefix]: { [generatedId]: true } } — collision guard for ID generators

    /* ---- Consignia Desk (Export Documentation Desk) ----
       Deliberately separate from `filings`/`bookings`/`documentsGenerated` above —
       those remain exactly what they were (Shipping Bill/BoE filing, freight booking
       lifecycle, e-Sanchit upload-simulation rows). An Export Job is a shipment-level
       wrapper that LINKS to an existing filing/booking by id; it never duplicates or
       reinterprets their fields. */
    exportJobs: [],        // shipment-level wrapper: brief, document plan, links to filing/booking
    exportDocs: [],        // versioned documents (Commercial Invoice, Packing List, ...): {id, exportJobId, type, version, status, fields}
    consistencyChecks: []  // cross-document diff results, keyed by exportJobId
  };
}

var STATE = null;
var CURRENT_USER_ID = null; // set on login / session restore; drives which localStorage key STATE persists to

/* -------- session (who is signed in right now — tiny, no transactional data) -------- */
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error('Unable to save session', e);
  }
}

/* -------- per-user operational data -------- */
function loadState() {
  if (!CURRENT_USER_ID) {
    STATE = defaultState();
    return STATE;
  }
  try {
    const raw = localStorage.getItem(dataKeyFor(CURRENT_USER_ID));
    STATE = raw ? JSON.parse(raw) : defaultState();
  } catch (e) {
    STATE = defaultState();
  }
  /* migration safety: fill in any keys added after a user's data was first saved */
  const d = defaultState();
  Object.keys(d).forEach(k => { if (STATE[k] === undefined) STATE[k] = d[k]; });
  return STATE;
}

function saveState() {
  if (!CURRENT_USER_ID) return; // nothing to persist to before a user is known
  try {
    localStorage.setItem(dataKeyFor(CURRENT_USER_ID), JSON.stringify(STATE));
  } catch (e) {
    console.error('Unable to save training state', e);
  }
}

function resetState() {
  if (CURRENT_USER_ID) localStorage.removeItem(dataKeyFor(CURRENT_USER_ID));
  STATE = defaultState();
  saveState();
}

/* -------- collision-safe ID generation (Section 41) --------
   generatorFn() must return a candidate ID string. We retry until
   we get one that hasn't been issued before *for this prefix*,
   checked against STATE.usedIds — so a double-click or a rare
   random collision can never produce two records with the same ID. */
/* ---------------- FORMAL FILING STATE MACHINE (Section 10) ----------------
   The precondition checks scattered through workflow.js (query resolved, exam passed,
   PGA clear, payment success, etc.) already made the dangerous jumps unreachable through
   the UI — this doesn't replace them. What it adds is a single declarative source of truth
   for "which status can follow which", enforced at the actual mutation point, so a future
   change to workflow.js can't silently reintroduce a DRAFT->COMPLETED-style skip without an
   explicit, visible exception. */
const FILING_STATUS_TRANSITIONS = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['UNDER_PROCESS'],
  UNDER_PROCESS: ['QUERY_RAISED', 'EXAMINATION', 'CLEARED', 'ASSESSED'],
  QUERY_RAISED: ['QUERY_REPLIED'],
  QUERY_REPLIED: ['EXAMINATION', 'CLEARED', 'ASSESSED'],
  EXAMINATION: ['CLEARED', 'ASSESSED'],
  CLEARED: ['LEO'],
  ASSESSED: ['DUTY_PENDING'],
  DUTY_PENDING: ['DUTY_PAID'],
  DUTY_PAID: ['OOC'],
  LEO: ['COMPLETED'],
  OOC: ['COMPLETED']
};
function setFilingStatus(filing, newStatus) {
  const allowed = FILING_STATUS_TRANSITIONS[filing.status];
  if (!allowed || !allowed.includes(newStatus)) {
    const msg = `Blocked invalid filing status transition: ${filing.status} -> ${newStatus} (filing ${filing.id})`;
    console.error('[TCOS state machine]', msg);
    throw new Error(msg);
  }
  filing.status = newStatus;
}

/* Same treatment for freight bookings — booking.status has its own, separate lifecycle. */
const BOOKING_STATUS_TRANSITIONS = {
  DRAFT_BOOKING: ['REQUESTED'],
  REQUESTED: ['REJECTED', 'CONFIRMED'],
  REJECTED: ['REQUESTED'],
  CONFIRMED: ['SI_SUBMITTED'],
  SI_SUBMITTED: ['VGM_SUBMITTED', 'DRAFT_BL'], // VGM (SOLAS) only applies to Sea; Air goes straight to draft BL/AWB
  VGM_SUBMITTED: ['DRAFT_BL'],
  DRAFT_BL: ['SI_SUBMITTED', 'BL_ISSUED'], // SI_SUBMITTED = correction loop back to re-verify SI
  BL_ISSUED: ['ARRIVED'],
  ARRIVED: ['DO_ISSUED'],
  DO_ISSUED: ['GATE_OUT'],
  GATE_OUT: ['COMPLETED']
};
function setBookingStatus(b, newStatus) {
  const allowed = BOOKING_STATUS_TRANSITIONS[b.status];
  if (!allowed || !allowed.includes(newStatus)) {
    const msg = `Blocked invalid booking status transition: ${b.status} -> ${newStatus} (booking ${b.id})`;
    console.error('[TCOS state machine]', msg);
    throw new Error(msg);
  }
  b.status = newStatus;
}
/* Export Job lifecycle — its OWN state machine (Section 5 of the integration plan):
   deliberately not squeezed into filing.status, which already has a closed,
   differently-shaped machine for the Shipping Bill itself. */
const EXPORT_JOB_STATUS_TRANSITIONS = {
  PLANNING: ['DOCUMENTS_IN_PROGRESS'],
  DOCUMENTS_IN_PROGRESS: ['READY_FOR_AUDIT'],
  READY_FOR_AUDIT: ['DOCUMENTS_IN_PROGRESS', 'AUDIT_PASSED', 'AUDIT_FAILED'],
  AUDIT_FAILED: ['DOCUMENTS_IN_PROGRESS'],
  AUDIT_PASSED: ['COMPLETE', 'DOCUMENTS_IN_PROGRESS'],
  COMPLETE: ['DOCUMENTS_IN_PROGRESS']
};
function setExportJobStatus(job, newStatus) {
  const allowed = EXPORT_JOB_STATUS_TRANSITIONS[job.status];
  if (!allowed || !allowed.includes(newStatus)) {
    const msg = `Blocked invalid export job status transition: ${job.status} -> ${newStatus} (job ${job.id})`;
    console.error('[Consignia Desk state machine]', msg);
    throw new Error(msg);
  }
  job.status = newStatus;
}
function getExportJob(id) {
  return STATE.exportJobs.find(j => j.id === id);
}
function getExportDoc(id) {
  return STATE.exportDocs.find(d => d.id === id);
}
/* Latest non-superseded version of a given doc type for a job, or null. */
function currentDocOfType(exportJobId, type) {
  const versions = STATE.exportDocs.filter(d => d.exportJobId === exportJobId && d.type === type);
  if (!versions.length) return null;
  return versions.reduce((a, b) => (b.version > a.version ? b : a));
}
function docVersionsOfType(exportJobId, type) {
  return STATE.exportDocs.filter(d => d.exportJobId === exportJobId && d.type === type).sort((a, b) => a.version - b.version);
}

function uniqueId(prefix, generatorFn) {
  if (!STATE.usedIds) STATE.usedIds = {};
  if (!STATE.usedIds[prefix]) STATE.usedIds[prefix] = {};
  let id, guard = 0;
  do {
    id = generatorFn();
    guard++;
  } while (STATE.usedIds[prefix][id] && guard < 50);
  if (STATE.usedIds[prefix][id]) {
    /* Exhausted retries against this generator's own output (astronomically unlikely with a
       real RNG, but must never silently hand back a duplicate) — force uniqueness with a
       disambiguating suffix rather than risk two records sharing an ID. */
    let n = 2;
    let candidate = id + '-' + n;
    while (STATE.usedIds[prefix][candidate]) { n++; candidate = id + '-' + n; }
    id = candidate;
  }
  STATE.usedIds[prefix][id] = true;
  return id;
}

function getFiling(id) {
  return STATE.filings.find(f => f.id === id);
}

function getBooking(id) {
  return STATE.bookings.find(b => b.id === id);
}

function getLicense(licenseNo) {
  return STATE.licenses.find(l => l.licenseNo === licenseNo);
}

function findIGMLineByBL(blAwbNo) {
  if (!blAwbNo) return null;
  for (const igm of STATE.igms) {
    const line = igm.lines.find(l => l.blAwbNo === blAwbNo);
    if (line) return { igm, line };
  }
  return null;
}

function addNotification(text, filingId) {
  const id = uniqueId('N', () => 'N' + Date.now() + Math.floor(Math.random() * 999));
  STATE.notifications.unshift({ id, ts: Date.now(), text, read: false, filingId: filingId || null });
  saveState();
}

function unreadCount() {
  return STATE.notifications.filter(n => !n.read).length;
}

function pushTimeline(filing, stage, note) {
  filing.timeline.push({ stage, ts: Date.now(), note: note || '' });
}

function addDocument(type, filingId, title, bookingId) {
  const id = uniqueId('DOC', () => 'DOC' + Date.now() + Math.floor(Math.random() * 999));
  const refNo = uniqueId('REF', () => 'REF-' + Math.floor(100000 + Math.random() * 900000));
  const doc = { id, type, filingId: filingId || null, bookingId: bookingId || null, ts: Date.now(), title, refNo, irn: generateIRN() };
  STATE.documentsGenerated.unshift(doc);
  return doc;
}
/* e-Sanchit-style Image Reference Number — training format only, not a live e-Sanchit lookup */
function generateIRN() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `51IN${yy}${mm}${dd}${rand}`;
}
