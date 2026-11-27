/* ============================================================
   CONSIGNIA DESK — Logistics ⇄ ICEGATE bridge (receiving side)
   ------------------------------------------------------------
   Mirrors the same fuzzy-match-or-leave-blank philosophy as
   skTcosPrefillFilingFromJobData (tcos/js/filingForm.js) for the
   existing Shipping Bill/Bill of Entry bridge: never guess a
   wrong port/country/payment-method silently — match confidently
   or leave it for the student to pick. The Export Brief still
   lands on screen for review before a job is created (Section 43
   — no silent autofill), it just starts from real Job data
   instead of a blank form or an ICEGATE scenario pick.
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


/* Units the Logistics simulator allows but ICEGATE has no equivalent for (MT, LTR, SQM...) — tell
   the student instead of letting a default silently read "20 PCS". */
function xdUnmappedUnits(jd) {
  const seen = [];
  (jd.items || []).forEach(it => { const u = String(it.unit || '').trim(); if (u && !xdUnit(u) && !seen.includes(u)) seen.push(u); });
  return seen;
}

function xdSplitList(v) { return String(v || '').split(/[,;\n|]+/).map(x => x.trim()).filter(Boolean); }

/* Doc-Sim items / containers / consignment -> the multi-product Export Brief shape */
function xdBriefPartsFromJobData(jd) {
  const items = (jd.items || []).map(it => ({
    description: it.description || it.product || '', hsCode: it.hsCode || '', qty: it.quantity || '',
    unit: xdUnit(it.unit) || xdFuzzyMatchFromList(UNITS, it.unit) || 'PCS', unitPrice: it.unitPrice || '',
    origin: it.countryOfManufacture || 'India', packages: '', grossWeight: it.weight || '', netWeight: it.netWeight || ''
  }));
  const nos = xdSplitList(jd.containerNo), seals = xdSplitList(jd.sealNo);
  const containers = nos.map((n, i) => ({ containerNo: n, containerType: CONTAINER_TYPES[0], sealNo: seals[i] || (nos.length === 1 ? (seals[0] || '') : ''), grossWeight: '' }));
  const netTotal = items.reduce((s, it) => s + (Number(it.netWeight) || 0), 0);
  const consignment = {
    consigneeAddress: jd.buyerAddress || '',
    portOfLoading: xdPort(jd.portOfLoading, INDIAN_PORTS), portOfDischarge: xdPort(jd.portOfDischarge, FOREIGN_PORTS),
    vesselFlight: jd.vesselName || '', voyageFlight: jd.voyageNo || '',
    packageType: xdPkgType((jd.items && jd.items[0] && jd.items[0].packageType) || ''),
    totalPackages: jd.quantity || '', grossWeight: jd.grossWeight || '', netWeight: netTotal || '',
    marksNumbers: '', instructions: ''
  };
  return { items: items.length ? items : [xdBlankItem()], containers: containers.length ? containers : [xdBlankContainer()], consignment: Object.assign(xdBlankConsignment(), consignment) };
}

/* The workbook PDF never mentions "Commodity Category" / "Packaging Material" on the Export Brief, so the bridge
   works them out from the Shipment Lot (HS chapter of the first product, package type) instead of leaving a required
   box blank that a student following the PDF could not know how to fill. They stay editable. */
function xdGuessCommodityCategory(hs, desc) {
  const ch = parseInt(String(hs || '').replace(/\D/g, '').slice(0, 2), 10);
  const d = String(desc || '').toLowerCase();
  if (/fish|shrimp|prawn|seafood|crab|squid/.test(d) || ch === 3 || ch === 16) return 'Seafood';
  if (ch === 30 || /pharma|tablet|capsule|medicine/.test(d)) return 'Pharmaceuticals';
  if (ch >= 1 && ch <= 14) return 'Agriculture';
  if (ch >= 15 && ch <= 24) return 'Food';
  if ((ch >= 28 && ch <= 29) || (ch >= 31 && ch <= 40)) return 'Chemicals';
  if (ch >= 50 && ch <= 63) return 'Textiles/Garments';
  if (ch === 85) return 'Electronics';
  if (ch === 84 || (ch >= 86 && ch <= 89)) return 'Machinery';
  return 'General Merchandise';
}
function xdGuessPackagingMaterial(pt) {
  const t = String(pt || '').toLowerCase();
  if (/wood|crate|pallet|case/.test(t)) return 'Wood';
  if (/carton|box|cardboard/.test(t)) return 'Carton/Cardboard';
  if (/drum|barrel/.test(t)) return 'Metal Drum';
  if (/bag|plastic|sack/.test(t)) return 'Plastic';
  return 'Mixed';
}
function beginConsigniaFromBridge(jobData, docType) {
  const jd = jobData || {};
  const firstItem = (jd.items && jd.items[0]) || {};
  XD_BRIDGE_TARGET_DOC_TYPE = docType;
  XD_BRIDGE_SOURCE = jd;
  const parts = xdBriefPartsFromJobData(jd);
  XD_BRIEF_DRAFT = {
    buyerName: jd.buyerName || '',
    commodity: firstItem.description || '',
    commodityCategory: xdGuessCommodityCategory(firstItem.hsCode, firstItem.description),
    hsCode: firstItem.hsCode || '',
    quantity: firstItem.quantity || jd.quantity || '',
    unit: xdFuzzyMatchFromList(UNITS, firstItem.unit),
    currency: xdFuzzyMatchFromList(CURRENCIES, jd.currency),
    incoterm: xdFuzzyMatchFromList(INCOTERMS, jd.incoterm),
    paymentMethod: xdFuzzyMatchFromList(PAYMENT_METHODS, jd.paymentTerms),
    mode: xdFuzzyMatchFromList(MODES_OF_TRANSPORT, jd.mode),
    destinationCountry: xdFuzzyMatchFromList(COUNTRIES, jd.destination) || xdFuzzyMatchFromList(COUNTRIES, jd.portOfDischargeCountry),
    ftaClaim: false, dangerousGoods: xdAnyDG(jd), scomet: false, packagingMaterial: xdGuessPackagingMaterial(firstItem.packageType || jd.packageType),
    linkedFilingId: '', linkedBookingId: '',
    items: parts.items, containers: parts.containers, consignment: parts.consignment,
    notes: `Started from the Logistics Document Simulator via the ICEGATE bridge, for: ${EXPORT_DOC_CATALOG[docType] ? EXPORT_DOC_CATALOG[docType].label : (docType || 'your full Export Job')}. Review every field below - matched values come from your Shipment Lot; anything it could not match confidently is left blank for you.`
  };
  navTo('exportJobBrief');
}

/* ============================================================
   SHIPPING BILL FROM THE EXPORT JOB
   The job's consignee, products (every HSN row), containers + seals and consignment box
   become the Shipping Bill filing; exporter identity (IEC / GSTIN / address) comes from the
   Document Simulator job. The student then files it through the real ICEGATE steps.
   ============================================================ */
function xdOpenShippingBill(jobId) {
  const job = getExportJob(jobId);
  if (!job) return;
  let filing = job.linkedFilingId ? getFiling(job.linkedFilingId) : null;
  if (!filing) {
    /* v51: the 21 Shipping Bill steps start BLANK. The workbook teaches the Shipping Bill by having the student type
       every box themselves; nothing from the Export Brief / Shipment Lot is carried into the wizard. */
    filing = startNewFiling('export', null);
    filing.exportJobId = job.id;
    job.linkedFilingId = filing.id; job.updatedAt = Date.now();
    saveState();
    if (typeof toast === 'function') toast('Shipping Bill opened - fill every step yourself, from the documents you prepared.', 'info');
  }
  /* the Document Simulator's Shipping Bill is complete when this filing is cleared + EGM filed */
  if (typeof DotBridge !== 'undefined') {
    const br = DotBridge.getBridge();
    if (br && br.active && !br.completed && br.filingType === 'consignia' && (br.consignaDocType === 'SHIPPING_BILL' || br.returnSlug === 'consignia-desk-direct')) {
      DotBridge.retarget('export', 'shipping-bill');
      if (typeof renderBridgeBanner === 'function') renderBridgeBanner();
    }
  }
  if (filing.status !== 'DRAFT') { navToFiling(filing.id); return; }
  openWizard(filing);
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
   - Only ever fills EMPTY values; never overwrites an ICEGATE default or
     anything the student typed.
   - Constrained dropdowns (country / port / unit / package type /
     incoterm / currency) are filled only on a confident match, otherwise
     left blank for the student — never a silent wrong guess.
   - Values that are the student's own learning task (invoice / insurance
     / LC numbers, dates, insured value, certificate numbers, botanical
     name, ...) are NOT invented here.
   - No-op for jobs that were not created through the bridge, so normal
     ICEGATE use is completely unchanged.
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
/* Logistics unit / package vocabulary -> ICEGATE vocabulary. Every Job unit now has
   an ICEGATE equivalent (KG->KGS, MT->MTS, DZN->DOZ, LTR, SQM); only an unknown unit is left blank. */
const XD_UNIT_ALIAS = (typeof BRIDGE_UNIT_ALIAS !== 'undefined') ? BRIDGE_UNIT_ALIAS : { PCS: 'PCS', SET: 'SET', KG: 'KGS', KGS: 'KGS', MT: 'MTS', DZN: 'DOZ', DOZ: 'DOZ', CTN: 'CTN', BOX: 'BOX', LTR: 'LTR', SQM: 'SQM', PAIR: 'PAIR', MTR: 'MTR' };
function xdUnit(u) { const k = String(u || '').trim().toUpperCase(); return XD_UNIT_ALIAS[k] && UNITS.includes(XD_UNIT_ALIAS[k]) ? XD_UNIT_ALIAS[k] : ''; }
function xdPkgType(p) { return (typeof bridgeMatchPackageType === 'function') ? bridgeMatchPackageType(p) : ''; }
function xdItemsValue(jd) { return (typeof bridgeItemsValue === 'function') ? bridgeItemsValue(jd.items) : (jd.items || []).reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0), 0); }
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
    xdSet(ex, 'iec', jd.sellerIEC); xdSet(ex, 'gstin', jd.sellerGSTIN); xdSet(ex, 'pan', jd.sellerPAN); xdSet(ex, 'contact', jd.sellerPhone);
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
    xdSet(f.exporter, 'name', jd.sellerName); xdSet(f.exporter, 'address', jd.sellerAddress); xdSet(f.exporter, 'iec', jd.sellerIEC); xdSet(f.exporter, 'pan', jd.sellerPAN);
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
    if (jd.jobId) booking.bridgeJobId = String(jd.jobId);   // v44: Shipment Lot id, stamped into the booking's PDFs
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
