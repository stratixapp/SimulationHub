/* =========================================================================
   DOT ECOSYSTEM — LOGISTICS ⇄ TCOS DOCUMENT BRIDGE
   =========================================================================
   Shipping Bill (export) and Bill of Entry (import) exist as real, deep
   filing workflows inside TCOS — not just a fill-in form like the
   Logistics Document Simulator's other exercises. This module lets a
   student choose, per document, to do it in TCOS's actual Customs Portal
   simulation instead of the Logistics simulator's own exercise — with a
   real single-sign-on handoff (no second login screen) and an automatic
   return to the Logistics simulator, correctly marked complete, once the
   filing is genuinely finished in TCOS (LEO+EGM for export, OOC for
   import).

   Both apps are served from the same origin (this hub), so localStorage
   is naturally shared between them — no server, no postMessage plumbing.
   This file is loaded by both hub/logistics-simulator/ and hub/tcos/.

   Design notes:
   - TCOS gates real credentials against a fixed list (DEMO_CREDENTIALS)
     plus a persisted "registered users" store. To make the *same* Skelora
     login ID and password work inside TCOS too, startHandoff() mirrors
     the student's Skelora account into that registered-users store and
     pre-seeds a valid TCOS session, so TCOS's own boot sequence restores
     it as an already-signed-in user — a genuine SSO handoff, not a
     disguised auto-fill of TCOS's login form.
   - The bridge record itself (dotecosystem_bridge_v1) only ever tracks
     "what is being bridged and has it finished" — no transactional data
     — mirroring how suite-auth.js keeps the account bridge minimal.
   ========================================================================= */

(function (global) {
  "use strict";

  const BRIDGE_KEY = "dotecosystem_bridge_v1";
  const TCOS_SESSION_KEY = "icegate_training_session_v1";
  const TCOS_REGISTERED_USERS_KEY = "icegate_training_registered_users_v1";
  const TCOS_STATE_PREFIX = "icegate_training_state_v1::";
  const BRIDGE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6h — stale bridge records are ignored, never acted on

  function readJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("DotBridge: unable to write", key, e);
    }
  }

  function getBridge() {
    const b = readJSON(BRIDGE_KEY);
    if (!b || !b.startedAt || Date.now() - b.startedAt > BRIDGE_MAX_AGE_MS) return null;
    return b;
  }
  function clearBridge() {
    try {
      localStorage.removeItem(BRIDGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  /* -----------------------------------------------------------------------
     Called from the Logistics Document Simulator when the student picks
     "Do this in TCOS instead". Mirrors their account into TCOS and hands
     off to it, already signed in.
  ----------------------------------------------------------------------- */
  function startHandoff(opts) {
    const filingType = opts.filingType; // 'export' | 'import'
    const userId = String(opts.userId || "").trim().toUpperCase();
    const password = opts.password;
    const name = opts.name || userId;
    const returnSlug = opts.returnSlug; // logistics doc slug to return to, e.g. 'shipping-bill'
    if (!userId || !password || !filingType || !returnSlug) {
      console.error("DotBridge.startHandoff: missing required fields", opts);
      return false;
    }
    const role = filingType === "export" ? "IEC Holder (Exporter)" : "IEC Holder (Importer)";
    // 1) Mirror this student into TCOS's registered-user credential store,
    //    so the same ID + password also works as a normal TCOS login later
    //    (not just for this one bridged session).
    const registered = readJSON(TCOS_REGISTERED_USERS_KEY) || [];
    const idx = registered.findIndex((c) => (c.userId || "").toUpperCase() === userId);
    const cred = { userId, password, role, name, iec: "—", gstin: "—", pan: "—", isTrainerAccount: false };
    if (idx >= 0) registered[idx] = Object.assign({}, registered[idx], cred);
    else registered.push(cred);
    writeJSON(TCOS_REGISTERED_USERS_KEY, registered);

    // 2) Pre-seed (or extend) this user's TCOS data blob with a logged-in
    //    profile. Only the `user` field is set here — TCOS's own
    //    loadState() fills in every other default field via its existing
    //    migration-safety merge, so this never needs to know TCOS's full
    //    state shape. If this student already has TCOS progress from an
    //    earlier bridge or a direct TCOS login, it's preserved untouched.
    const stateKey = TCOS_STATE_PREFIX + userId;
    const existingState = readJSON(stateKey) || {};
    existingState.user = { loggedIn: true, userId, profile: cred, loggedInAsTrainer: false };
    writeJSON(stateKey, existingState);

    // 3) Sign the session in — this is what TCOS's boot sequence checks
    //    first, before it would otherwise show the login screen.
    writeJSON(TCOS_SESSION_KEY, { userId, loggedInAsTrainer: false });

    // 4) Record what's being bridged, so TCOS knows to jump straight into
    //    the right filing flow, and so the Logistics simulator knows what
    //    to look for when the student comes back. `jobData` (optional) is
    //    a snapshot of the student's active Shipment Lot — party/shipment/
    //    item details already typed once in the Logistics simulator — so
    //    TCOS's New Filing wizard can start pre-filled from it instead of
    //    making the student re-type the same shipment a second time. See
    //    skTcosPrefillFilingFromJobData in tcos/js/filingForm.js for how
    //    it's applied; a bridge with no jobData (or an older caller that
    //    doesn't pass it) still works exactly as before — scenario picker,
    //    blank filing. `consignaDocType` (optional) names which specific
    //    Consignia Desk document to open directly when filingType is
    //    "consignia" — see js/export-bridge.js in tcos/ for the receiving
    //    side (beginConsigniaFromBridge / xdCheckBridgeCompletion).
    writeJSON(BRIDGE_KEY, {
      active: true,
      completed: false,
      filingType: filingType,
      returnSlug: returnSlug,
      userId: userId,
      jobData: opts.jobData || null,
      consignaDocType: opts.consignaDocType || null,
      startedAt: Date.now(),
    });

    window.location.href = "../tcos/index.html?bridge=1";
    return true;
  }

  /* -----------------------------------------------------------------------
     Called from TCOS when a bridged action genuinely finishes — EGM filed
     for export, OOC granted for import, or (for the Freight Booking
     bridge, where several stages share filingType 'freight') the one
     specific stage the student actually clicked into. `slug` disambiguates
     that last case: this only fires true when it matches the bridge's own
     returnSlug, so mid-journey freight stages that aren't what the student
     asked for don't trigger a premature "return" prompt. Returns true if
     this completion should trigger a "return to Logistics Simulator" prompt.
  ----------------------------------------------------------------------- */
  function markCompleted(filingType, refNo, slug) {
    const b = getBridge();
    if (!b || !b.active || b.completed || b.filingType !== filingType || b.returnSlug !== slug) return false;
    b.completed = true;
    b.refNo = refNo;
    b.completedAt = Date.now();
    writeJSON(BRIDGE_KEY, b);
    return true;
  }

  function setBookingId(bookingId) {
    const b = getBridge();
    if (!b) return false;
    b.bookingId = bookingId;
    writeJSON(BRIDGE_KEY, b);
    return true;
  }

  /* -----------------------------------------------------------------------
     Called from the Logistics Document Simulator's workstation boot for
     the current doc slug. If a completed bridge is waiting to be picked
     up for THIS slug, consumes it (deactivates it so it can't be reused)
     and returns { refNo, filingType }; otherwise returns null.
  ----------------------------------------------------------------------- */
  function consumeReturn(returnSlug) {
    const b = getBridge();
    if (!b || !b.completed || b.returnSlug !== returnSlug) return null;
    const result = { refNo: b.refNo, filingType: b.filingType };
    b.active = false;
    writeJSON(BRIDGE_KEY, b);
    return result;
  }

  /* -----------------------------------------------------------------------
     Companion-document auto-complete — TCOS generates some documents as
     an automatic byproduct of a bridged filing closing (the Export
     General Manifest is filed together with the Shipping Bill; the Out
     of Charge Order is issued together with the Bill of Entry). Since
     the student never separately chose to bridge THOSE slugs, this skips
     the popup/consumeReturn dance entirely and just writes the
     completion straight into the Logistics simulator's own progress
     store for them — a companion document is not itself a bridge, so it
     never overwrites or reads dotecosystem_bridge_v1.

     Skelora's progress store is keyed by its own internal user id (not
     the login ID used everywhere else here), so this first resolves
     login ID → internal id via Skelora's own user list — safe to read
     directly since both apps share this origin.
  ----------------------------------------------------------------------- */
  const SKELORA_USERS_KEY = "skelora_users_v1";
  const SKELORA_PROGRESS_PREFIX = "skelora_progress_v1_";

  function silentCompleteLogisticsDoc(loginUserId, slug, refNo, docTitle) {
    if (!loginUserId || !slug) return false;
    const users = readJSON(SKELORA_USERS_KEY) || [];
    const match = users.find((u) => (u.email || "").toUpperCase() === String(loginUserId).toUpperCase());
    if (!match) return false; // no Logistics account for this ID — nothing to update
    const progressKey = SKELORA_PROGRESS_PREFIX + match.id;
    const all = readJSON(progressKey) || {};
    all[slug] = Object.assign({}, all[slug] || { startedAt: new Date().toISOString() }, {
      status: "completed",
      viaTcos: true,
      tcosRef: refNo,
      docTitle: docTitle,
      currentStep: 1,
      maxReached: 1,
      updatedAt: new Date().toISOString(),
    });
    writeJSON(progressKey, all);
    return true;
  }

  global.DotBridge = {
    getBridge: getBridge,
    clearBridge: clearBridge,
    startHandoff: startHandoff,
    markCompleted: markCompleted,
    setBookingId: setBookingId,
    consumeReturn: consumeReturn,
    silentCompleteLogisticsDoc: silentCompleteLogisticsDoc,
  };
})(window);
