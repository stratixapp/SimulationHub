/* ============================================================
   CONSIGNIA DESK — Logistics ⇄ TCOS bridge (receiving side)
   ------------------------------------------------------------
   Mirrors the same fuzzy-match-or-leave-blank philosophy as
   skTcosPrefillFilingFromJobData (tcos/js/filingForm.js) for the
   existing Shipping Bill/Bill of Entry bridge: never guess a
   wrong port/country/payment-method silently — match confidently
   or leave it for the student to pick. The Export Brief still
   lands on screen for review before a job is created (Section 43
   — no silent autofill), it just starts from real Job data
   instead of a blank form or a TCOS scenario pick.
   ============================================================ */

var XD_BRIDGE_TARGET_DOC_TYPE = null;

function xdFuzzyMatchFromList(list, value) {
  if (!value) return '';
  const v = String(value).trim().toLowerCase();
  if (!v) return '';
  const exact = list.find(x => x.toLowerCase() === v);
  if (exact) return exact;
  // Word-boundary partial match — plain .includes() let short codes like
  // "TT" (Telegraphic Transfer) false-match against unrelated list entries
  // just because the letters happen to appear consecutively inside another
  // word (e.g. "TT" is literally inside "Le-TT-er of Credit"). Requiring a
  // \b...\b boundary means a match only counts when it lines up with a
  // whole word, not an accidental substring.
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const partial = list.find(x => {
    const xl = x.toLowerCase();
    return new RegExp('\\b' + esc(v) + '\\b').test(xl) || new RegExp('\\b' + esc(xl) + '\\b').test(v);
  });
  return partial || '';
}

function beginConsigniaFromBridge(jobData, docType) {
  const jd = jobData || {};
  const firstItem = (jd.items && jd.items[0]) || {};
  XD_BRIDGE_TARGET_DOC_TYPE = docType;
  XD_BRIEF_DRAFT = {
    buyerName: jd.buyerName || '',
    commodity: firstItem.description || '',
    commodityCategory: '',
    hsCode: firstItem.hsCode || '',
    quantity: firstItem.quantity || jd.quantity || '',
    unit: xdFuzzyMatchFromList(UNITS, firstItem.unit),
    currency: xdFuzzyMatchFromList(CURRENCIES, jd.currency),
    incoterm: xdFuzzyMatchFromList(INCOTERMS, jd.incoterm),
    paymentMethod: xdFuzzyMatchFromList(PAYMENT_METHODS, jd.paymentTerms),
    mode: xdFuzzyMatchFromList(MODES_OF_TRANSPORT, jd.mode),
    destinationCountry: xdFuzzyMatchFromList(COUNTRIES, jd.destination) || xdFuzzyMatchFromList(COUNTRIES, jd.portOfDischargeCountry),
    ftaClaim: false, dangerousGoods: false, scomet: false, packagingMaterial: '',
    linkedFilingId: '', linkedBookingId: '',
    notes: `Started from the Logistics Document Simulator via the TCOS bridge, for: ${EXPORT_DOC_CATALOG[docType] ? EXPORT_DOC_CATALOG[docType].label : (docType || 'your full Export Job')}. Review every field below — matched values were fuzzy-matched from the Logistics simulator's Job data, unmatched ones were deliberately left blank rather than guessed.`
  };
  navTo('exportJobBrief');
}

/* Called at the end of every markXReady() function across the Consignia
   Desk documents that are bridge-eligible. A no-op unless this exact
   document type is the one the active bridge is waiting on. */
function xdCheckBridgeCompletion(docType, refId, label) {
  if (typeof DotBridge === 'undefined') return;
  const bridge = DotBridge.getBridge();
  if (!bridge || bridge.filingType !== 'consignia' || bridge.consignaDocType !== docType) return;
  if (DotBridge.markCompleted('consignia', refId, bridge.returnSlug)) {
    if (typeof showBridgeReturnPrompt === 'function') showBridgeReturnPrompt(refId, label);
  }
}
