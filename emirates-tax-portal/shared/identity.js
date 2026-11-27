/* ==========================================================================
   Shared Identity Bridge — UAE Tax Simulator Portal
   Both the VAT simulator (root) and the Corporate Tax simulator (/ct) load
   this file. Because both apps are served from the same origin, they share
   the browser's localStorage — so a single key here is genuinely shared
   data, not a copy. Only CORE identity fields live here (the fields a
   student would expect to carry over between the two simulators): their
   name, company, TRN/Emirate/Emirates ID. Each simulator's own domain data
   (VAT boxes, CT financials, filings, etc.) stays in its own storage and is
   never touched by this file.
   ========================================================================== */
const SHARED_IDENTITY_KEY_BASE = 'uae_tax_portal_shared_identity_v1';

const SharedIdentity = (function () {
  "use strict";

  // Multiple students share the same computer, so the shared identity must
  // be scoped per student too — otherwise the second student to sit down
  // sees (and can silently overwrite) the first student's name, company,
  // Emirates ID etc. This reuses the exact same "active student" pointer
  // the VAT simulator already maintains, so both apps and this bridge all
  // agree on whose data is whose.
  function activeStudentSuffix() {
    try {
      const raw = localStorage.getItem('vatsim_global_active');
      const id = raw ? JSON.parse(raw) : '';
      return id ? ('_' + id) : '';
    } catch (e) { return ''; }
  }
  function storageKey() {
    return SHARED_IDENTITY_KEY_BASE + activeStudentSuffix();
  }

  function read() {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('SharedIdentity read error', e);
      return null;
    }
  }

  function write(obj) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(obj));
      return true;
    } catch (e) {
      console.error('SharedIdentity write error', e);
      return false;
    }
  }

  /* Returns the shared identity object, or null if no student has
     registered on either simulator yet on this browser. Shape:
     {
       studentId,       // canonical anchor — same value used by both apps
       fullNameEn,      // student's name
       emiratesId,      // Emirates ID number (may be a training placeholder)
       companyName,     // legal / trade name of the company they created
       companyTRN,      // Tax Registration Number (VAT) — shared display only
       emirate,         // Emirate the company / student is registered in
       email,           // used as a secondary display field only
       updatedAt
     }
  */
  function get() {
    return read();
  }

  /* Merge a partial update into the shared identity. Only non-empty,
     non-undefined fields overwrite existing values, so either simulator can
     call this with just the fields it knows about without erasing what the
     other simulator already stored. */
  function set(patch) {
    const current = read() || {};
    const merged = Object.assign({}, current);
    Object.keys(patch || {}).forEach(function (k) {
      const v = patch[k];
      if (v !== undefined && v !== null && v !== '') {
        merged[k] = v;
      }
    });
    merged.updatedAt = new Date().toISOString();
    write(merged);
    return merged;
  }

  function clear() {
    try { localStorage.removeItem(storageKey()); } catch (e) { /* ignore */ }
  }

  return { get: get, set: set, clear: clear };
})();
