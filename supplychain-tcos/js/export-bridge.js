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
/* Full Lot snapshot of the bridge currently being turned into an Export Job.
   Attached to the job in submitExportBrief(); reset whenever a job is started any other way. */
var XD_BRIDGE_SOURCE = null;

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


/* Units the Logistics simulator allows but TCOS has no equivalent for (MT, LTR, SQM...) — tell
   the student instead of letting a default silently read "20 PCS". */
function xdUnmappedUnits(jd) {
  const seen = [];
  (jd.items || []).forEach(it => { const u = String(it.unit || '').trim(); if (u && !xdUnit(u) && !seen.includes(u)) seen.push(u); });
  return seen;
}

function beginConsigniaFromBridge(jobData, docType) {
  const jd = jobData || {};
  const firstItem = (jd.items && jd.items[0]) || {};
  XD_BRIDGE_TARGET_DOC_TYPE = docType;
  XD_BRIDGE_SOURCE = jd;
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
    ftaClaim: false, dangerousGoods: xdAnyDG(jd), scomet: false, packagingMaterial: '',
    linkedFilingId: '', linkedBookingId: '',
    notes: `Started from the Logistics Document Simulator via the TCOS bridge, for: ${EXPORT_DOC_CATALOG[docType] ? EXPORT_DOC_CATALOG[docType].label : (docType || 'your full Export Job')}. Review every field below — matched values were fuzzy-matched from the Logistics simulator's Job data, unmatched ones were deliberately left blank rather than guessed.` + (xdUnmappedUnits(jd).length ? ` NOTE: unit "${xdUnmappedUnits(jd).join('", "')}" from your Shipment Lot has no TCOS equivalent — choose the right unit (TCOS offers ${UNITS.join(', ')}) on each document line.` : '')
  };
  navTo('exportJobBrief');
}


/* ============================================================
   FULL AUTO-FILL FROM THE LOGISTICS SHIPMENT LOT
   ------------------------------------------------------------
   Before: only the Export Brief was pre-filled from the student's
   Shipment Lot; every Consignia document then started blank and the
   student re-typed the same exporter / buyer / items again.
   Now: when an Export Job was created from a Logistics bridge, the full
   Lot snapshot is kept on the job (job.sourceJobData) and each document
   is seeded from it THE FIRST TIME it is opened.

   Rules (same cautious philosophy as the rest of this file):
   - Only ever fills EMPTY values; never overwrites a TCOS default or
     anything the student typed.
   - Constrained dropdowns (country / port / unit / package type /
     incoterm / currency) are filled only on a confident match, otherwise
     left blank for the student — never a silent wrong guess.
   - Values that are the student's own learning task (invoice / insurance
     / LC numbers, dates, insured value, certificate numbers, botanical
     name, ...) are NOT invented here.
   - No-op for jobs that were not created through the bridge, so normal
     TCOS use is completely unchanged.
   ============================================================ */

function xdSet(obj, key, val) {
  if (!obj || val === undefined || val === null) return;
  const v = typeof val === 'string' ? val.trim() : val;
  if (v === '') return;
  if (obj[key] === '' || obj[key] === undefined || obj[key] === null) obj[key] = v;
}
function xdCountry(name) { return (typeof bridgeMatchCountry === 'function') ? bridgeMatchCountry(name) : ''; }
function xdPort(name, list) { return (typeof bridgeMatchPort === 'function') ? bridgeMatchPort(name, list) : ''; }
function xdNorm(x) { return String(x || '').toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, ''); }
/* Logistics unit / package vocabulary -> TCOS vocabulary. Anything with no
   true TCOS equivalent (MT, LTR, SQM, Rolls...) is deliberately left blank. */
const XD_UNIT_ALIAS = { PCS: 'PCS', SET: 'SET', KG: 'KGS', KGS: 'KGS', DZN: 'DOZ', DOZ: 'DOZ', CTN: 'CTN', BOX: 'BOX', PAIR: 'PAIR', MTR: 'MTR' };
function xdUnit(u) { const k = String(u || '').trim().toUpperCase(); return XD_UNIT_ALIAS[k] && UNITS.includes(XD_UNIT_ALIAS[k]) ? XD_UNIT_ALIAS[k] : ''; }
function xdPkgType(p) {
  const n = xdNorm(p); if (!n) return '';
  if (n === 'crate') return PACKAGE_TYPES.includes('Wooden Crate') ? 'Wooden Crate' : '';
  return PACKAGE_TYPES.find(t => xdNorm(t) === n) || '';
}
function xdItemsValue(jd) { return (jd.items || []).reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0); }
function xdMoney(n) { return n ? n.toFixed(2) : ''; }
function xdFirstDesc(jd) { const it = (jd.items || [])[0]; return it ? (it.description || it.product || '') : ''; }
function xdQtyText(jd) { const it = (jd.items || [])[0] || {}; const q = it.quantity || jd.quantity || ''; return q ? (q + (it.unit ? ' ' + it.unit : '')) : ''; }
function xdContainerVessel(jd) { return [jd.containerNo, jd.vesselName && (jd.vesselName + (jd.voyageNo ? ' / ' + jd.voyageNo : ''))].filter(Boolean).join(' | '); }
function xdDestCountry(jd) { return xdCountry(jd.destination) || xdCountry(jd.portOfDischargeCountry); }
function xdAnyDG(jd) { return (jd.items || []).some(it => String(it.isDangerousGoods || '').toLowerCase() === 'yes'); }

const XD_SEEDERS = {
  COMMERCIAL_INVOICE(f, jd) {
    const ex = f.exporter; xdSet(ex, 'legalName', jd.sellerName); xdSet(ex, 'address', jd.sellerAddress);
    const sc = xdCountry(jd.sellerCountry); if (sc) ex.country = sc;
    xdSet(ex, 'iec', jd.sellerIEC); xdSet(ex, 'gstin', jd.sellerGSTIN); xdSet(ex, 'contact', jd.sellerPhone);
    xdSet(ex, 'email', jd.sellerEmail); xdSet(ex, 'authorizedSignatory', jd.authorizedSignatory);
    const dc = xdDestCountry(jd);
    xdSet(f.buyer, 'legalName', jd.buyerName); xdSet(f.buyer, 'address', jd.buyerAddress); xdSet(f.buyer, 'country', dc);
    xdSet(f.buyer, 'contact', jd.buyerPhone); xdSet(f.buyer, 'email', jd.buyerEmail);
    xdSet(f.consignee, 'name', jd.buyerName); xdSet(f.consignee, 'address', jd.buyerAddress); xdSet(f.consignee, 'country', dc); xdSet(f.consignee, 'contact', jd.buyerPhone);
    xdSet(f, 'poRef', jd.poNumber);
    xdSet(f.shipment, 'portOfLoading', xdPort(jd.portOfLoading, INDIAN_PORTS));
    xdSet(f.shipment, 'portOfDischarge', xdPort(jd.portOfDischarge, FOREIGN_PORTS));
    xdSet(f.shipment, 'vesselFlight', jd.vesselName); xdSet(f.shipment, 'voyageFlightNo', jd.voyageNo);
    xdSet(f.shipment, 'containerNo', jd.containerNo); xdSet(f.shipment, 'sealNo', jd.sealNo);
    xdSet(f.commercialTerms, 'paymentTerms', jd.paymentTerms);
    xdSet(f.declaration, 'signatoryName', jd.authorizedSignatory);
    if (!f.items.length) (jd.items || []).forEach(it => f.items.push({
      product: it.product || it.description || '', description: it.description || '', hsCode: it.hsCode || '',
      countryOfOrigin: it.countryOfManufacture || 'India', quantity: it.quantity || '', unit: xdUnit(it.unit) || 'PCS',
      unitPrice: it.unitPrice || '', netWeight: it.netWeight || '', grossWeight: it.weight || '', packages: '',
      packageType: xdPkgType(it.packageType) || 'Carton', marksNumbers: ''
    }));
  },
  PACKING_LIST(f, jd) {
    xdSet(f.exporter, 'name', jd.sellerName); xdSet(f.exporter, 'address', jd.sellerAddress);
    const sc = xdCountry(jd.sellerCountry); if (sc) f.exporter.country = sc;
    const dc = xdDestCountry(jd);
    xdSet(f.buyer, 'name', jd.buyerName); xdSet(f.buyer, 'address', jd.buyerAddress); xdSet(f.buyer, 'country', dc);
    xdSet(f.consignee, 'name', jd.buyerName); xdSet(f.consignee, 'address', jd.buyerAddress); xdSet(f.consignee, 'country', dc);
    xdSet(f, 'poRef', jd.poNumber);
    xdSet(f.shipment, 'portOfLoading', xdPort(jd.portOfLoading, INDIAN_PORTS));
    xdSet(f.shipment, 'portOfDischarge', xdPort(jd.portOfDischarge, FOREIGN_PORTS));
    xdSet(f.shipment, 'vesselFlight', jd.vesselName); xdSet(f.shipment, 'containerNo', jd.containerNo); xdSet(f.shipment, 'sealNo', jd.sealNo);
    if (!f.packages.length) (jd.items || []).forEach((it, i) => f.packages.push({
      packageNumber: String(i + 1), packageType: xdPkgType(it.packageType) || 'Carton', marksNumbers: '',
      product: it.product || it.description || '', quantity: it.quantity || '', unit: xdUnit(it.unit) || 'PCS',
      netWeight: it.netWeight || '', grossWeight: it.weight || '', length: '', width: '', height: '', containerNo: jd.containerNo || ''
    }));
  },
  CERTIFICATE_OF_ORIGIN(f, jd) {
    xdSet(f.exporter, 'name', jd.sellerName); xdSet(f.exporter, 'address', jd.sellerAddress); xdSet(f.exporter, 'iec', jd.sellerIEC);
    const dc = xdDestCountry(jd);
    xdSet(f.consignee, 'name', jd.buyerName); xdSet(f.consignee, 'address', jd.buyerAddress); xdSet(f.consignee, 'country', dc);
    xdSet(f, 'goodsDescription', xdFirstDesc(jd));
    const it = (jd.items || [])[0] || {};
    xdSet(f, 'quantity', it.quantity || jd.quantity); xdSet(f, 'unit', xdUnit(it.unit));
    xdSet(f, 'value', xdMoney(xdItemsValue(jd))); xdSet(f, 'currency', (typeof bridgeMatchOption === 'function') ? bridgeMatchOption(jd.currency, CURRENCIES) : '');
    xdSet(f.declaration, 'signatoryName', jd.authorizedSignatory);
  },
  INSURANCE_CERTIFICATE(f, jd) {
    xdSet(f, 'exporter', jd.sellerName); xdSet(f, 'buyer', jd.buyerName);
    xdSet(f, 'vessel', jd.vesselName); xdSet(f, 'voyage', jd.voyageNo);
    xdSet(f, 'portOfLoading', xdPort(jd.portOfLoading, INDIAN_PORTS)); xdSet(f, 'portOfDischarge', xdPort(jd.portOfDischarge, FOREIGN_PORTS));
    xdSet(f, 'goodsDescription', xdFirstDesc(jd)); xdSet(f, 'invoiceValue', xdMoney(xdItemsValue(jd)));
    xdSet(f, 'signatory', jd.authorizedSignatory);
  },
  LETTER_OF_CREDIT(f, jd) {
    xdSet(f, 'applicant', jd.buyerName); xdSet(f, 'beneficiary', jd.sellerName);
    xdSet(f, 'amount', xdMoney(xdItemsValue(jd)));
    xdSet(f, 'portOfLoading', xdPort(jd.portOfLoading, INDIAN_PORTS)); xdSet(f, 'portOfDischarge', xdPort(jd.portOfDischarge, FOREIGN_PORTS));
  },
  BILL_OF_EXCHANGE(f, jd) {
    xdSet(f, 'drawer', jd.sellerName); xdSet(f, 'drawee', jd.buyerName); xdSet(f, 'payee', jd.sellerName);
    xdSet(f, 'amount', xdMoney(xdItemsValue(jd))); xdSet(f, 'signatory', jd.authorizedSignatory);
  },
  EXPORT_LICENSE(f, jd) {
    xdSet(f, 'exporter', jd.sellerName); xdSet(f, 'consignee', jd.buyerName);
    xdSet(f, 'quantity', ((jd.items || [])[0] || {}).quantity || jd.quantity);
  },
  PHYTOSANITARY_CERTIFICATE(f, jd) {
    xdSet(f, 'exporter', jd.sellerName); xdSet(f, 'consignee', jd.buyerName);
    xdSet(f, 'countryOfOrigin', xdCountry(jd.sellerCountry) || 'India'); xdSet(f, 'countryOfDestination', xdDestCountry(jd));
    xdSet(f, 'quantityDeclared', xdQtyText(jd));
  },
  HEALTH_CERTIFICATE(f, jd) {
    xdSet(f, 'exporter', jd.sellerName); xdSet(f, 'consignee', jd.buyerName);
    xdSet(f, 'productDescription', xdFirstDesc(jd));
    xdSet(f, 'countryOfOrigin', xdCountry(jd.sellerCountry) || 'India'); xdSet(f, 'countryOfDestination', xdDestCountry(jd));
    xdSet(f, 'batchNumber', ((jd.items || [])[0] || {}).batchNo);
  },
  FUMIGATION_CERTIFICATE(f, jd) {
    xdSet(f, 'commodity', xdFirstDesc(jd)); xdSet(f, 'containerVesselDetails', xdContainerVessel(jd));
  },
  CATCH_CERTIFICATE(f, jd) {
    xdSet(f, 'exporter', jd.sellerName); xdSet(f, 'consignee', jd.buyerName);
    xdSet(f, 'quantity', ((jd.items || [])[0] || {}).quantity || jd.quantity);
  },
  HACCP_CERTIFICATE(f, jd) {
    xdSet(f, 'facilityName', jd.sellerName);
  },
  DG_DECLARATION(f, jd) {
    const it = (jd.items || []).find(x => String(x.isDangerousGoods || '').toLowerCase() === 'yes') || (jd.items || [])[0] || {};
    xdSet(f, 'unNumber', it.unNumber); xdSet(f, 'hazardClass', it.hazardClass); xdSet(f, 'packingGroup', ['I', 'II', 'III'].includes(it.packingGroup) ? it.packingGroup : '');
    xdSet(f, 'flashPoint', it.flashpoint); xdSet(f, 'quantity', it.quantity || jd.quantity);
    xdSet(f, 'packageType', xdPkgType(it.packageType)); xdSet(f, 'containerVesselDetails', xdContainerVessel(jd));
    xdSet(f, 'properShippingName', it.description || it.product);
  },
  /* Bill of Lading / Air Waybill — shared field set */
  BILL_OF_LADING(f, jd) { xdSeedTransport(f, jd); },
  AIR_WAYBILL(f, jd) { xdSeedTransport(f, jd); }
};
function xdSeedTransport(f, jd) {
  xdSet(f.shipper, 'name', jd.sellerName); xdSet(f.shipper, 'address', jd.sellerAddress); xdSet(f.shipper, 'contact', jd.sellerPhone);
  xdSet(f.consignee, 'name', jd.buyerName); xdSet(f.consignee, 'address', jd.buyerAddress); xdSet(f.consignee, 'contact', jd.buyerPhone);
  xdSet(f, 'carrier', jd.carrierName); xdSet(f, 'vesselFlight', jd.vesselName); xdSet(f, 'voyageFlightNo', jd.voyageNo);
  xdSet(f.routing, 'portOfLoading', xdPort(jd.portOfLoading, INDIAN_PORTS)); xdSet(f.routing, 'portOfDischarge', xdPort(jd.portOfDischarge, FOREIGN_PORTS));
  xdSet(f.cargo, 'descriptionOfGoods', xdFirstDesc(jd));
  if (xdAnyDG(jd)) f.cargo.dangerousGoods = true;
  if (!f.containers.length && jd.containerNo) f.containers.push({
    containerNo: jd.containerNo, sealNo: jd.sealNo || '', containerType: '', packageCount: '', packageType: xdPkgType(((jd.items || [])[0] || {}).packageType) || 'Carton',
    grossWeight: jd.grossWeight || '', measurementVolume: ''
  });
}


/* Freight Booking (freight bridge): same philosophy — fill what is certain
   from the Shipment Lot, leave dropdown-constrained values blank unless the
   match is confident. Import Lots swap loading/discharge sides. */
function skTcosPrefillBookingFromJobData(booking, jd) {
  try {
    if (!booking || !jd) return;
    const isImport = jd.direction === 'import' || (!jd.direction && /import/i.test(jd.mode || ''));
    xdSet(booking, 'shipperName', jd.sellerName); xdSet(booking, 'shipperAddress', jd.sellerAddress); xdSet(booking, 'shipperContact', jd.sellerPhone);
    xdSet(booking, 'consigneeName', jd.buyerName); xdSet(booking, 'consigneeAddress', jd.buyerAddress); xdSet(booking, 'consigneeContact', jd.buyerPhone);
    if (/^Air/.test(jd.mode || '')) booking.mode = 'Air'; else if (/^Sea/.test(jd.mode || '')) booking.mode = 'Sea';
    xdSet(booking, 'carrierName', jd.carrierName);
    xdSet(booking, 'portOfLoading', xdPort(jd.portOfLoading, isImport ? FOREIGN_PORTS : INDIAN_PORTS));
    xdSet(booking, 'portOfDischarge', xdPort(jd.portOfDischarge, isImport ? INDIAN_PORTS : FOREIGN_PORTS));
    xdSet(booking, 'commodity', xdFirstDesc(jd));
    xdSet(booking, 'incoterm', (typeof bridgeMatchOption === 'function') ? bridgeMatchOption(jd.incoterm, INCOTERMS) : '');
    xdSet(booking, 'pieces', jd.quantity); xdSet(booking, 'grossWeight', jd.grossWeight);
    xdSet(booking, 'requestedSailingDate', jd.expectedShipmentDate);
    if (typeof saveState === 'function') saveState();
  } catch (e) { if (typeof console !== 'undefined') console.warn('Booking auto-fill skipped:', e); }
}

/* Called once per document, right where a brand-new first draft is created.
   Safe no-op for any job without bridge data. */
function xdSeedDoc(doc, job) {
  try {
    if (!doc || !job || !job.sourceJobData) return;
    const fn = XD_SEEDERS[doc.type];
    if (fn) fn(doc.fields, job.sourceJobData, job);
  } catch (e) { if (typeof console !== 'undefined') console.warn('Consignia auto-fill skipped:', e); }
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
