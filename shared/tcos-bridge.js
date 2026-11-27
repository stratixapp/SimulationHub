/* =========================================================================
   DOT ECOSYSTEM — LOGISTICS ⇄ ICEGATE DOCUMENT BRIDGE
   =========================================================================
   Shipping Bill (export) and Bill of Entry (import) exist as real, deep
   filing workflows inside ICEGATE — not just a fill-in form like the
   Logistics Document Simulator's other exercises. This module lets a
   student choose, per document, to do it in ICEGATE's actual Customs Portal
   simulation instead of the Logistics simulator's own exercise — with a
   real single-sign-on handoff (no second login screen) and an automatic
   return to the Logistics simulator, correctly marked complete, once the
   filing is genuinely finished in ICEGATE (LEO+EGM for export, OOC for
   import).

   Both apps are served from the same origin (this hub), so localStorage
   is naturally shared between them — no server, no postMessage plumbing.
   This file is loaded by both hub/logistics-simulator/ and hub/tcos/.

   Design notes:
   - ICEGATE gates real credentials against a fixed list (DEMO_CREDENTIALS)
     plus a persisted "registered users" store. To make the *same* Skelora
     login ID and password work inside ICEGATE too, startHandoff() mirrors
     the student's Skelora account into that registered-users store and
     pre-seeds a valid ICEGATE session, so ICEGATE's own boot sequence restores
     it as an already-signed-in user — a genuine SSO handoff, not a
     disguised auto-fill of ICEGATE's login form.
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
  /* A bridge that already owns a saved DRAFT filing (bindFiling) lives longer, so a student who clicks
     "Save Draft & Exit" and comes back the next day is still sent back to the Logistics Simulator when the filing is done. */
  const BRIDGE_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
    if (!b || !b.startedAt) return null;
    const maxAge = b.filingId ? BRIDGE_DRAFT_MAX_AGE_MS : BRIDGE_MAX_AGE_MS;
    if (Date.now() - b.startedAt > maxAge) return null;
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
     "Do this in ICEGATE instead". Mirrors their account into ICEGATE and hands
     off to it, already signed in.
  ----------------------------------------------------------------------- */
  function startHandoff(opts) {
    const filingType = opts.filingType; // 'export' | 'import'
    const userId = String(opts.userId || "").trim().toUpperCase();
    const password = opts.password;
    const name = opts.name || userId;
    const workRole = String(opts.workRole || "").trim(); // role picked on the Skelora sign-in screen; printed beside the name on PDFs
    const returnSlug = opts.returnSlug; // logistics doc slug to return to, e.g. 'shipping-bill'
    if (!userId || !password || !filingType || !returnSlug) {
      console.error("DotBridge.startHandoff: missing required fields", opts);
      return false;
    }
    const role = (filingType === "export" || filingType === "consignia" || filingType === "brc") ? "IEC Holder (Exporter)" : "IEC Holder (Importer)";
    // 1) Mirror this student into ICEGATE's registered-user credential store,
    //    so the same ID + password also works as a normal ICEGATE login later
    //    (not just for this one bridged session).
    const registered = readJSON(TCOS_REGISTERED_USERS_KEY) || [];
    const idx = registered.findIndex((c) => (c.userId || "").toUpperCase() === userId);
    const cred = { userId, password, role, name, workRole, iec: "—", gstin: "—", pan: "—", isTrainerAccount: false };
    if (idx >= 0) registered[idx] = Object.assign({}, registered[idx], cred);
    else registered.push(cred);
    writeJSON(TCOS_REGISTERED_USERS_KEY, registered);

    // 2) Pre-seed (or extend) this user's ICEGATE data blob with a logged-in
    //    profile. Only the `user` field is set here — ICEGATE's own
    //    loadState() fills in every other default field via its existing
    //    migration-safety merge, so this never needs to know ICEGATE's full
    //    state shape. If this student already has ICEGATE progress from an
    //    earlier bridge or a direct ICEGATE login, it's preserved untouched.
    const stateKey = TCOS_STATE_PREFIX + userId;
    const existingState = readJSON(stateKey) || {};
    existingState.user = { loggedIn: true, userId, profile: cred, loggedInAsTrainer: false };
    writeJSON(stateKey, existingState);

    // 3) Sign the session in — this is what ICEGATE's boot sequence checks
    //    first, before it would otherwise show the login screen.
    //    v47: NOT signed in silently any more. Any older session is cleared so ICEGATE shows its own login screen with this
    //    student's ID + password already filled in (see igStartBridgeLogin in tcos/js/app.js) — they click Login themselves.
    try { localStorage.removeItem(TCOS_SESSION_KEY); } catch (e) { /* ignore */ }

    // 4) Record what's being bridged, so ICEGATE knows to jump straight into
    //    the right filing flow, and so the Logistics simulator knows what
    //    to look for when the student comes back. `jobData` (optional) is
    //    a snapshot of the student's active Shipment Lot — party/shipment/
    //    item details already typed once in the Logistics simulator — so
    //    ICEGATE's New Filing wizard can start pre-filled from it instead of
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
      workRole: workRole,
      jobData: opts.jobData || null,
      consignaDocType: opts.consignaDocType || null,
      startedAt: Date.now(),
    });

    window.location.href = "../tcos/index.html?bridge=1";
    return true;
  }

  /* -----------------------------------------------------------------------
     Called from ICEGATE when a bridged action genuinely finishes — EGM filed
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
    /* v52: a bridge is tied to the ONE filing it opened (bindFiling). Finishing some other, unrelated filing in ICEGATE
       must not send the student back to the Logistics Simulator or mark the Logistics document done. */
    if ((filingType === 'export' || filingType === 'import') && b.filingId && refNo && b.filingId !== refNo) return false;
    b.completed = true;
    b.refNo = refNo;
    b.completedAt = Date.now();
    writeJSON(BRIDGE_KEY, b);
    return true;
  }

  /* Re-aim an in-progress bridge at a different closing event (e.g. the Export Brief of the general
     "consignia" bridge turns into the Shipping Bill filing -> return to the Shipping Bill document). */
  function retarget(filingType, returnSlug) {
    const b = getBridge();
    if (!b || !b.active || b.completed) return false;
    b.filingType = filingType;
    b.returnSlug = returnSlug;
    writeJSON(BRIDGE_KEY, b);
    return true;
  }

  /* v52: remember which ICEGATE filing this bridge opened, so Save Draft -> come back later -> finish still returns. */
  function bindFiling(filingId) {
    const b = getBridge();
    if (!b || !b.active || b.completed || b.filingId) return false;
    b.filingId = filingId;
    writeJSON(BRIDGE_KEY, b);
    return true;
  }

  /* v56: ICEGATE measures the active time a student spent filing; keep it on the bridge so the shipment summary in the
     Logistics Simulator can show a real "time taken" for the ICEGATE document instead of 0s. */
  function recordFilingSeconds(filingId, seconds) {
    const b = getBridge();
    if (!b || !b.active || b.completed) return false;
    if (b.filingId && filingId && b.filingId !== filingId) return false;
    if (!isFinite(seconds) || seconds <= 0) return false;
    b.filingSeconds = Math.round(seconds);
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
    if (!b || !b.active || !b.completed || b.returnSlug !== returnSlug) return null;
    const result = { refNo: b.refNo, filingType: b.filingType };
    b.active = false;
    writeJSON(BRIDGE_KEY, b);
    return result;
  }

  /* -----------------------------------------------------------------------
     Companion-document auto-complete — ICEGATE generates some documents as
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

  /* GAP FIX: a document finished in ICEGATE used to reach Logistics as "completed" + a reference
     number only, so downstream documents (Commercial Invoice No, B/L No, Booking No, Shipping
     Bill No ...) never autofilled and cross-document checks skipped it. This maps each bridged
     document to the Logistics field that holds ITS OWN number, so the number now flows forward
     exactly as if the student had typed it into the Logistics document. Field names verified
     against documents-data.js. */
  const OWN_NUMBER_FIELD = {
    "shipping-bill": "sbNumberGenerated",
    "bill-of-entry": "beNumberGenerated",
    "booking-confirmation": "bookingNo",
    "bill-of-lading-sea": "blNumber",
    "air-waybill": "awbNumber",
    "delivery-order": "doNumberGenerated",
    "commercial-invoice": "invoiceNo",
    "packing-list": "plNumber",
    "letter-of-credit": "lcNumber",
    "out-of-charge": "oocNumberGenerated",
  };
  /* ICEGATE numbers its documents TRN-SB-2026-914852 / XDOC-INV-2026-123456 ... — fine for the Shipping Bill, but the
     Logistics Commercial Invoice / Packing List / AWB fields downstream expect INV-2026-123456 / PL-2026-123456 /
     123-12345678, so those are converted (or skipped) rather than forwarding a value the next document would reject. */
  const NUMBER_FIX = {
    "commercial-invoice": v => v.replace(/^XDOC-INV-/, "INV-"),
    "packing-list": v => v.replace(/^XDOC-PKL-/, "PL-"),
    "air-waybill": v => (/^\d{3}-\d{8}$/.test(v) ? v : ""),
  };
  function formDataForDoc(slug, ownNumber) {
    const field = OWN_NUMBER_FIELD[slug];
    if (!field || ownNumber == null || ownNumber === "") return null;
    let v = String(ownNumber);
    if (NUMBER_FIX[slug]) v = NUMBER_FIX[slug](v);
    if (!v) return null;
    const fd = {};
    fd[field] = v;
    return fd;
  }

  function silentCompleteLogisticsDoc(loginUserId, slug, refNo, docTitle, ownNumber, extraFields) {
    if (!loginUserId || !slug) return false;
    const users = readJSON(SKELORA_USERS_KEY) || [];
    const match = users.find((u) => (u.email || "").toUpperCase() === String(loginUserId).toUpperCase());
    if (!match) return false; // no Logistics account for this ID — nothing to update
    const progressKey = SKELORA_PROGRESS_PREFIX + match.id;
    const all = readJSON(progressKey) || {};
    const prev = all[slug] || { startedAt: new Date().toISOString() };
    all[slug] = Object.assign({}, prev, {
      status: "completed",
      viaTcos: true,
      tcosRef: refNo,
      docTitle: docTitle,
      currentStep: 1,
      maxReached: 1,
      updatedAt: new Date().toISOString(),
    });
    /* v56: the main ICEGATE document (Shipping Bill / Bill of Entry) carries the time ICEGATE measured for the filing */
    const _br = readJSON(BRIDGE_KEY);
    if (_br && _br.filingSeconds && slug === _br.returnSlug) all[slug].tcosSeconds = _br.filingSeconds;
    // out-of-charge's own number is NOT the filing id, so only use an explicitly passed number there.
    const fd = formDataForDoc(slug, ownNumber != null ? ownNumber : (slug === "out-of-charge" ? null : refNo));
    if (fd) all[slug].formData = Object.assign({}, prev.formData || {}, fd);
    /* v35: optional extra field values for documents ICEGATE produces as a by-product but that have no single
       "own number" field (Assessment Copy, Duty Calculation, Duty Challan, Examination Report). Empty values are skipped
       and anything the student already typed into the Logistics document is kept. */
    if (extraFields && typeof extraFields === "object") {
      const cur = all[slug].formData || (all[slug].formData = {});
      Object.keys(extraFields).forEach(function (k) {
        const v = extraFields[k];
        if (v !== undefined && v !== null && v !== "" && (cur[k] === undefined || cur[k] === null || cur[k] === "")) cur[k] = v;
      });
    }
    writeJSON(progressKey, all);
    return true;
  }

  /* -----------------------------------------------------------------------
     Full snapshot of a Shipment Lot for the ICEGATE side. ONE builder used by
     every Logistics entry point (per-document popup + the dashboard's
     "Continue in ICEGATE" button) so they can never drift apart again.
     Every key that earlier versions sent keeps exactly the same name and
     value (skTcosPrefillFilingFromJobData / beginConsigniaFromBridge read
     them); the extra keys below are purely additive, so an older ICEGATE
     build simply ignores them. `direction` is derived from the Shipment
     Mode so ICEGATE never has to guess export vs import.
  ----------------------------------------------------------------------- */
  function buildJobSnapshot(job) {
    const f = (job && job.fields) || {};
    const s = (v) => (v == null ? "" : v);
    const mode = f.mode || "";
    const direction = /import/i.test(mode) ? "import" : /export/i.test(mode) ? "export" : "";
    const items = Array.isArray(f.items)
      ? f.items
          .filter((it) => it && (it.description || it.product))
          .map((it) => ({
            description: it.description || it.product || "",
            hsCode: it.hsCode || "",
            quantity: it.quantity || "",
            unit: it.unit || "",
            unitPrice: it.unitPrice || "",
            countryOfManufacture: it.countryOfManufacture || "",
            weight: it.weight || "",
            netWeight: it.netWeight || "",
            packageType: it.packageType || "",
            // ---- additive ----
            product: s(it.product),
            productCode: s(it.productCode),
            discount: s(it.discount),
            brandModel: s(it.brandModel),
            manufacturerDetails: s(it.manufacturerDetails),
            batchNo: s(it.batchNo),
            mfgDate: s(it.mfgDate),
            expDate: s(it.expDate),
            isDangerousGoods: s(it.isDangerousGoods),
            unNumber: s(it.unNumber),
            hazardClass: s(it.hazardClass),
            packingGroup: s(it.packingGroup),
            flashpoint: s(it.flashpoint),
          }))
      : [];
    return {
      mode: f.mode || "", sellerName: f.sellerName || "", sellerAddress: f.sellerAddress || "", sellerCountry: f.sellerCountry || "",
      sellerGSTIN: f.sellerGSTIN || "", sellerIEC: f.sellerIEC || "", sellerPAN: f.sellerPAN || "", sellerPhone: f.sellerPhone || "",
      buyerName: f.buyerName || "", buyerAddress: f.buyerAddress || "", buyerGSTIN: f.buyerGSTIN || "", buyerIEC: f.buyerIEC || "", buyerPhone: f.buyerPhone || "",
      destination: f.destination || "", portOfLoading: f.portOfLoading || "", portOfDischarge: f.portOfDischarge || "",
      portOfDischargeCountry: f.portOfDischargeCountry || "", vesselName: f.vesselName || "", voyageNo: f.voyageNo || "",
      incoterm: f.incoterm || "", currency: f.currency || "", paymentTerms: f.paymentTerms || "",
      quantity: f.quantity || "", grossWeight: f.grossWeight || "",
      items: items,
      // ---- additive ----
      direction: direction,
      jobId: s(job && job.jobId),
      origin: s(f.origin), sellerEmail: s(f.sellerEmail), authorizedSignatory: s(f.authorizedSignatory), buyerEmail: s(f.buyerEmail),
      poNumber: s(f.poNumber), invoiceValue: s(f.invoiceValue), expectedShipmentDate: s(f.expectedShipmentDate),
      containerNo: s(f.containerNo), carrierName: s(f.carrierName), sealNo: s(f.sealNo), freightAmount: s(f.freightAmount),
    };
  }

  /* =====================================================================
     BACKUP PATH — UPLOAD THE ICEGATE PDF INTO THE LOGISTICS SIMULATOR (v44)
     =====================================================================
     The automatic "return to Logistics" can fail (cleared browser data, a
     different tab/browser, the bridge record older than 6h, the student
     closing ICEGATE early ...). This is the manual backup: the student
     uploads the PDF they downloaded from ICEGATE into the SAME document's
     place in the Logistics simulator, and it is accepted ONLY if it is
     genuinely that document, from that student, for that Shipment Lot.

     How a PDF is recognised: ICEGATE builds its Shipping Bill / Bill of Entry
     / freight PDFs as page images (html2canvas -> jsPDF), so there is no
     text inside to read. Instead ICEGATE writes a small signed stamp into the
     PDF's Info dictionary (the "Keywords" field, which jsPDF stores
     uncompressed), and Logistics reads that stamp straight from the file
     bytes — no PDF library needed, works offline.

     Honest limit: the stamp is a checksum, not a cryptographic signature —
     it stops wrong-document / wrong-student / wrong-lot / unfinished-filing
     uploads and casual edits, which is the training goal; it is not meant
     to stop a determined student who reads this source and forges one.
     ===================================================================== */
  const STAMP_TAG = "DOTSTAMP1";
  const STAMP_SALT = "dot-ecosystem|tcos-pdf|v1";

  /* slug -> label: the Logistics documents that ICEGATE produces as a real PDF (and so can be uploaded).
     VGM Certificate (ICEGATE has no PDF for it) and the Consignia Desk documents (printed through the
     browser's own Save-as-PDF, which can't carry a stamp) are intentionally NOT here. */
  const UPLOADABLE_DOCS = {
    "shipping-bill": "Shipping Bill",
    "bill-of-entry": "Bill of Entry",
    "booking-confirmation": "Booking Confirmation",
    "bill-of-lading-sea": "Bill of Lading",
    "air-waybill": "Air Waybill",
    "arrival-notice": "Arrival Notice",
    "delivery-order": "Delivery Order",
    "equipment-interchange-receipt": "Equipment Interchange Receipt",
    "proof-of-delivery": "Proof of Delivery",
    "bank-realization-certificate": "Bank Realisation Certificate",
  };

  function cyrb53(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
  }
  function b64uEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64uDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* info = { slug, doc, type:'export'|'import'|'freight', ref, user, job, final, need, iec, co:{...}, ts } */
  function buildStampString(info) {
    const body = b64uEncode(JSON.stringify(Object.assign({ v: 1 }, info)));
    return STAMP_TAG + "|" + body + "|" + cyrb53(STAMP_SALT + body);
  }

  /* Writes the stamp into a jsPDF document's Info dictionary. Must be called BEFORE pdf.save(). Never throws. */
  function stampPdf(pdf, info) {
    try {
      const label = (UPLOADABLE_DOCS[info.slug] || info.doc || "Document").replace(/[^\x20-\x7E]/g, "");
      pdf.setProperties({
        title: (label + " " + String(info.ref || "")).replace(/[^\x20-\x7E]/g, "").trim(),
        subject: "ICEGATE training document",
        author: "ICEGATE Trade and Customs Operations Simulator",
        keywords: buildStampString(info),
        creator: "DOT Ecosystem ICEGATE",
      });
      return true;
    } catch (e) {
      console.warn("DotBridge.stampPdf failed — PDF will still download, but cannot be uploaded to Logistics:", e);
      return false;
    }
  }

  /* Reads + checksum-verifies the stamp from the raw bytes of a PDF (ArrayBuffer / Uint8Array).
     -> { ok:true, data } or { ok:false, code:'not-pdf'|'no-stamp'|'tampered'|'bad-stamp'|'unsupported' } */
  function parsePdfStamp(buf) {
    try {
      const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      if (u8.length < 8 || String.fromCharCode(u8[0], u8[1], u8[2], u8[3], u8[4]) !== "%PDF-") return { ok: false, code: "not-pdf" };
      let text = "";
      for (let i = 0; i < u8.length; i += 0x8000) text += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      const at = text.lastIndexOf(STAMP_TAG + "|");
      if (at < 0) return { ok: false, code: "no-stamp" };
      const m = /^DOTSTAMP1\|([A-Za-z0-9_-]+)\|([0-9a-f]{16})/.exec(text.slice(at, at + 4000));
      if (!m) return { ok: false, code: "bad-stamp" };
      if (cyrb53(STAMP_SALT + m[1]) !== m[2]) return { ok: false, code: "tampered" };
      const data = JSON.parse(b64uDecode(m[1]));
      if (!data || data.v !== 1 || !data.slug) return { ok: false, code: "unsupported" };
      return { ok: true, data: data };
    } catch (e) {
      return { ok: false, code: "bad-stamp" };
    }
  }

  function _norm(v) { return String(v == null ? "" : v).replace(/[^A-Za-z0-9]/g, "").toUpperCase(); }
  function _bad(code, message, data) { return { ok: false, code: code, message: message, data: data || null }; }

  /* Decides whether a parsed stamp is acceptable for THIS Logistics document, THIS student, THIS Shipment Lot.
     ctx = { userLoginId, job }  (job = the student's active Shipment Lot, or null for free-play). */
  function verifyUpload(slug, parsed, ctx) {
    ctx = ctx || {};
    const expect = UPLOADABLE_DOCS[slug];
    if (!expect) return _bad("not-uploadable", "An ICEGATE PDF can't be uploaded for this document — it isn't produced as a PDF by ICEGATE. Do it here as the normal exercise.");
    if (!parsed || !parsed.ok) {
      const code = parsed && parsed.code;
      if (code === "not-pdf") return _bad(code, "That isn't a PDF file. Upload the PDF you downloaded from ICEGATE.");
      if (code === "tampered") return _bad(code, "This PDF's ICEGATE stamp doesn't match its contents — it looks edited. Download a fresh copy from ICEGATE and upload that.");
      return _bad(code || "no-stamp", "This PDF wasn't downloaded from ICEGATE (or it was re-saved / printed to PDF afterwards, which removes ICEGATE's hidden stamp). Open the filing in ICEGATE, use its own Download PDF button, and upload that exact file.");
    }
    const d = parsed.data;
    const gotLabel = d.doc || UPLOADABLE_DOCS[d.slug] || d.slug;
    if (d.slug !== slug) {
      return _bad("wrong-doc", "This PDF is a " + gotLabel + ", but this place is for the " + expect + ". Upload it in the " + gotLabel + " document instead.", d);
    }
    if (_norm(d.user) !== _norm(ctx.userLoginId)) {
      return _bad("wrong-user", "This " + expect + " PDF was made under a different login (" + (d.user || "unknown") + "), not yours (" + (ctx.userLoginId || "unknown") + "). Each student must upload their own.", d);
    }
    if (d.final === false) {
      const need = d.need ? " (" + d.need + ")" : "";
      return _bad("not-final", "This " + expect + " PDF was downloaded before the filing finished in ICEGATE" + need + ". Complete it in ICEGATE, then download the PDF again and upload the new one.", d);
    }
    const job = ctx.job;
    /* Export vs Import separation — same rule the Logistics popup uses before offering ICEGATE at all */
    const lotMode = (job && job.fields && job.fields.mode) || "";
    if ((d.type === "export" && /import/i.test(lotMode)) || (d.type === "import" && /export/i.test(lotMode))) {
      return _bad("wrong-direction", "This " + expect + " is for an " + (d.type === "export" ? "Export" : "Import") + " shipment, but your active Shipment Lot is an " + (d.type === "export" ? "Import" : "Export") + " (" + lotMode + ").", d);
    }
    if (job && job.jobId) {
      if (d.job) {
        if (String(d.job) !== String(job.jobId)) {
          return _bad("wrong-lot", "This " + expect + " belongs to Shipment Lot " + d.job + ", but your active Shipment Lot is " + job.jobId + ". Upload the one made for this Lot.", d);
        }
      } else if (d.iec) {
        /* filing wasn't started from a Lot (no lot id in the stamp) — fall back to the exporter / importer IEC */
        const f = job.fields || {};
        const lotIec = d.type === "import" ? f.buyerIEC : f.sellerIEC;
        if (_norm(lotIec) && _norm(d.iec) !== _norm(lotIec)) {
          return _bad("wrong-lot", "The IEC on this " + expect + " (" + d.iec + ") doesn't match the IEC of your active Shipment Lot (" + lotIec + "), so it isn't the document for this shipment.", d);
        }
      }
    }
    return { ok: true, code: "ok", message: "", data: d };
  }

  /* Companion documents ICEGATE completes as a by-product (same list/arguments as the live paths in
     tcos/js/workflow.js grantOOC() and manifest.js fileEGM()), so an uploaded Bill of Entry / Shipping Bill
     leaves Logistics in exactly the state the automatic return would have. Returns the slugs it completed. */
  function completeCompanions(loginUserId, d) {
    const done = [];
    const co = d.co || {};
    const run = function (slug, ref, title, own, extra) {
      if (silentCompleteLogisticsDoc(loginUserId, slug, ref, title, own, extra)) done.push(slug);
    };
    if (d.slug === "bill-of-entry") {
      run("out-of-charge", d.ref, "Out of Charge Order", co.oocNo || null);
      run("assessment-copy", d.ref, "Assessment Copy", null, { originalDocType: "Bill of Entry", originalDocNo: d.ref });
      run("duty-calculation", d.ref, "Duty Calculation", null, { boeNumber: d.ref, challanNo: co.challanNo || "", oocNumber: co.oocNo || "" });
      run("duty-challan", d.ref, "Duty Challan", null, { boeNo: d.ref, cin: co.challanNo || "" });
      if (co.exam) run("examination-report", d.ref, "Examination Report", null, { boeNo: d.ref });
    } else if (d.slug === "shipping-bill" && co.egm) {
      run("export-general-manifest", d.ref, "Export General Manifest");
    }
    return done;
  }

  /* After a successful upload: retire a still-open bridge for the same document so ICEGATE stops showing
     "continuing the ... — you'll be sent back automatically" and the record can't be reused. */
  function closeBridgeFor(slug) {
    const b = getBridge();
    if (!b || !b.active || b.returnSlug !== slug) return false;
    b.active = false;
    b.completed = true;
    b.viaUpload = true;
    writeJSON(BRIDGE_KEY, b);
    return true;
  }

  /* =====================================================================
     PDF VAULT (v46) — keeps the REAL ICEGATE PDF of each finished document
     =====================================================================
     A document completed through ICEGATE only stores its number in the Logistics
     progress record, so the Logistics "Download ... (ZIP)" used to render a
     mostly BLANK form for it. ICEGATE (on each final PDF download) and the upload
     backup (on acceptance) now keep a copy of the actual PDF here — IndexedDB,
     same origin as both simulators — and the ZIP exports use it. Never throws. */
  const VAULT_DB = "dot-tcos-pdfs", VAULT_STORE = "pdfs";
  function _vaultOpen() {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
      const r = indexedDB.open(VAULT_DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(VAULT_STORE, { keyPath: "key" }); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }
  function _vaultKey(loginUserId, slug) { return String(loginUserId || "").toUpperCase() + "|" + slug; }
  function savePdf(loginUserId, slug, blob, meta) {
    return _vaultOpen().then(function (db) {
      return new Promise(function (resolve) {
        const tx = db.transaction(VAULT_STORE, "readwrite");
        tx.objectStore(VAULT_STORE).put({ key: _vaultKey(loginUserId, slug), blob: blob, filename: (meta && meta.filename) || (slug + ".pdf"), ref: (meta && meta.ref) || "", savedAt: Date.now() });
        tx.oncomplete = function () { db.close(); resolve(true); };
        tx.onerror = tx.onabort = function () { db.close(); resolve(false); };
      });
    }).catch(function () { return false; });
  }
  function getPdf(loginUserId, slug) {
    return _vaultOpen().then(function (db) {
      return new Promise(function (resolve) {
        const rq = db.transaction(VAULT_STORE, "readonly").objectStore(VAULT_STORE).get(_vaultKey(loginUserId, slug));
        rq.onsuccess = function () { db.close(); resolve(rq.result || null); };
        rq.onerror = function () { db.close(); resolve(null); };
      });
    }).catch(function () { return null; });
  }

  global.DotBridge = {
    buildJobSnapshot: buildJobSnapshot,
    getBridge: getBridge,
    clearBridge: clearBridge,
    startHandoff: startHandoff,
    markCompleted: markCompleted,
    setBookingId: setBookingId,
    bindFiling: bindFiling,
    recordFilingSeconds: recordFilingSeconds,
    retarget: retarget,
    consumeReturn: consumeReturn,
    silentCompleteLogisticsDoc: silentCompleteLogisticsDoc,
    formDataForDoc: formDataForDoc,
    /* v44 — upload backup path */
    UPLOADABLE_DOCS: UPLOADABLE_DOCS,
    buildStampString: buildStampString,
    stampPdf: stampPdf,
    parsePdfStamp: parsePdfStamp,
    verifyUpload: verifyUpload,
    completeCompanions: completeCompanions,
    closeBridgeFor: closeBridgeFor,
    /* v46 — real ICEGATE PDFs kept for the ZIP exports */
    savePdf: savePdf,
    getPdf: getPdf,
  };
})(window);
