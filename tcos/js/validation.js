/* ============================================================
   ICEGATE TRAINING SIMULATOR — VALIDATION ENGINE
   Returns array of { field, message } — real, specific errors.
   ============================================================ */

const RE_IEC = /^[A-Za-z0-9]{10}$/;
const RE_GSTIN = /^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]$/;
const RE_PAN = /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/;
const RE_HS = /^[0-9]{8}$/;
const RE_CONTAINER = /^[A-Za-z]{4}[0-9]{7}$/;

function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

function validatePartyStep(filing) {
  const errs = [];
  const p = filing.party;
  const isExport = filing.type === 'export';
  if (!p[isExport ? 'exporterName' : 'importerName']) errs.push({ field: isExport ? 'exporterName' : 'importerName', message: 'Name is mandatory.' });
  if (!p.iec) errs.push({ field: 'iec', message: 'IEC is mandatory.' });
  else if (!RE_IEC.test(p.iec)) errs.push({ field: 'iec', message: 'Invalid IEC format — must be 10 alphanumeric characters.' });
  if (!p.gstin) errs.push({ field: 'gstin', message: 'GSTIN is mandatory.' });
  else if (!RE_GSTIN.test(p.gstin)) errs.push({ field: 'gstin', message: 'Invalid GSTIN format (expected e.g. 27AAACR5055K1Z8).' });
  if (!p.pan) errs.push({ field: 'pan', message: 'PAN is mandatory.' });
  else if (!RE_PAN.test(p.pan)) errs.push({ field: 'pan', message: 'Invalid PAN format (expected e.g. AAACR5055K).' });
  if (!p.address) errs.push({ field: 'address', message: 'Address is mandatory.' });
  if (!p.contact) errs.push({ field: 'contact', message: 'Contact number is mandatory.' });
  if (!p.authorizedPerson) errs.push({ field: 'authorizedPerson', message: 'Authorized person is mandatory.' });
  return errs;
}

function validateCounterpartyStep(filing) {
  const errs = [];
  const c = filing.counterparty;
  const isExport = filing.type === 'export';
  if (!c[isExport ? 'consigneeName' : 'supplierName']) errs.push({ field: isExport ? 'consigneeName' : 'supplierName', message: 'Name is mandatory.' });
  if (!c.address) errs.push({ field: 'address2', message: 'Address is mandatory.' });
  if (!c.country) errs.push({ field: 'country', message: 'Country is mandatory.' });
  if (isExport && !c.port) errs.push({ field: 'port', message: 'Port is mandatory.' });
  if (!c.contact) errs.push({ field: 'contact2', message: 'Contact is mandatory.' });
  return errs;
}

function validateShipmentStep(filing) {
  const errs = [];
  const s = filing.shipment;
  if (!s.portOfLoading) errs.push({ field: 'portOfLoading', message: 'Port of loading is mandatory.' });
  if (!s.portOfDischarge) errs.push({ field: 'portOfDischarge', message: 'Port of discharge is mandatory.' });
  if (filing.type === 'export' && !s.countryOfDestination) errs.push({ field: 'countryOfDestination', message: 'Country of destination is mandatory.' });
  if (filing.type === 'import' && !s.countryOfOrigin) errs.push({ field: 'countryOfOrigin', message: 'Country of origin is mandatory.' });
  if (!s.modeOfTransport) errs.push({ field: 'modeOfTransport', message: 'Mode of transport is mandatory.' });
  if (!s.vesselFlight) errs.push({ field: 'vesselFlight', message: 'Vessel/Flight name is mandatory.' });
  if (!s.voyageFlight) errs.push({ field: 'voyageFlight', message: 'Voyage/Flight number is mandatory.' });
  if (filing.type === 'import' && !s.blAwbNo) errs.push({ field: 'blAwbNo', message: 'Bill of Lading / AWB number is mandatory.' });
  if (filing.type === 'export' && !s.shipmentRef) errs.push({ field: 'shipmentRef', message: 'Shipment reference is mandatory.' });
  if (s.portOfLoading && s.portOfDischarge && s.portOfLoading === s.portOfDischarge) errs.push({ field: 'portOfDischarge', message: 'Port of discharge cannot be the same as port of loading.' });
  return errs;
}

function validateInvoiceStep(filing) {
  const errs = [];
  const inv = filing.invoice;
  if (!inv.invoiceNo) errs.push({ field: 'invoiceNo', message: 'Invoice number is mandatory.' });
  if (!inv.invoiceDate) errs.push({ field: 'invoiceDate', message: 'Invoice date is mandatory.' });
  if (!inv.currency) errs.push({ field: 'currency', message: 'Invalid currency — please select a currency.' });
  if (!inv.invoiceValue || num(inv.invoiceValue) <= 0) errs.push({ field: 'invoiceValue', message: 'Invoice value must be greater than zero.' });
  if (filing.type === 'export' && (!inv.fobValue || num(inv.fobValue) <= 0)) errs.push({ field: 'fobValue', message: 'FOB value must be greater than zero.' });
  if (num(inv.freight) < 0) errs.push({ field: 'freight', message: 'Freight cannot be negative.' });
  if (num(inv.insurance) < 0) errs.push({ field: 'insurance', message: 'Insurance cannot be negative.' });
  /* duplicate invoice check across other filings of same party/type */
  const dup = STATE.filings.find(f => f.id !== filing.id && f.type === filing.type && f.invoice.invoiceNo && f.invoice.invoiceNo === inv.invoiceNo);
  if (dup) errs.push({ field: 'invoiceNo', message: `Duplicate invoice number — already used in filing ${dup.id}.` });
  return errs;
}

function validateItemsStep(filing) {
  const errs = [];
  if (!filing.items || filing.items.length === 0) { errs.push({ field: 'items', message: 'At least one item must be added.' }); return errs; }
  filing.items.forEach((it, i) => {
    const tag = `Item ${i + 1}`;
    if (!it.description) errs.push({ field: 'items', message: `${tag}: description is mandatory.` });
    if (!it.hsCode) errs.push({ field: 'items', message: `${tag}: HS Code is mandatory.` });
    else if (!RE_HS.test(it.hsCode)) errs.push({ field: 'items', message: `${tag}: invalid HS Code — must be 8 digits.` });
    if (!it.qty || num(it.qty) <= 0) errs.push({ field: 'items', message: `${tag}: quantity must be greater than zero.` });
    if (!it.unit) errs.push({ field: 'items', message: `${tag}: unit is mandatory.` });
    if (!it.unitPrice || num(it.unitPrice) <= 0) errs.push({ field: 'items', message: `${tag}: unit price must be greater than zero.` });
    if (!it.origin) errs.push({ field: 'items', message: `${tag}: country of origin is mandatory.` });
    if (num(it.grossWeight) < num(it.netWeight)) errs.push({ field: 'items', message: `${tag}: gross weight cannot be less than net weight.` });
  });
  /* invoice value vs sum of item totals */
  const itemSum = filing.items.reduce((s, it) => s + num(it.qty) * num(it.unitPrice), 0);
  const declared = num(filing.invoice.invoiceValue);
  if (declared > 0 && itemSum > 0 && Math.abs(itemSum - declared) > Math.max(1, declared * 0.01)) {
    errs.push({ field: 'items', message: `Invoice value (${fmtMoney(declared, filing.invoice.currency)}) does not match declared item value (${fmtMoney(itemSum, filing.invoice.currency)}).` });
  }
  return errs;
}

function validatePackagesStep(filing) {
  const errs = [];
  const p = filing.packages;
  if (!p.packageType) errs.push({ field: 'packageType', message: 'Package type is mandatory.' });
  if (!p.numberOfPackages || num(p.numberOfPackages) <= 0) errs.push({ field: 'numberOfPackages', message: 'Number of packages must be greater than zero.' });
  if (!p.grossWeight || num(p.grossWeight) <= 0) errs.push({ field: 'grossWeight', message: 'Gross weight must be greater than zero.' });
  if (!p.netWeight || num(p.netWeight) <= 0) errs.push({ field: 'netWeight', message: 'Net weight must be greater than zero.' });
  if (num(p.grossWeight) < num(p.netWeight)) errs.push({ field: 'grossWeight', message: 'Gross weight cannot be less than net weight.' });
  const itemPkgSum = filing.items.reduce((s, it) => s + num(it.packages), 0);
  if (itemPkgSum > 0 && num(p.numberOfPackages) > 0 && itemPkgSum !== num(p.numberOfPackages)) {
    errs.push({ field: 'numberOfPackages', message: `Package quantity mismatch — item packages total ${itemPkgSum} but declared ${p.numberOfPackages}.` });
  }
  return errs;
}

function validateContainersStep(filing) {
  const errs = [];
  if (filing.shipment.modeOfTransport !== 'Sea') return errs; // containers optional for air/land
  (filing.containers || []).forEach((c, i) => {
    if (c.containerNo && !RE_CONTAINER.test(c.containerNo.replace(/\s/g, ''))) {
      errs.push({ field: 'containers', message: `Container ${i + 1}: invalid container number format (expected e.g. MSCU1234567).` });
    }
    if (c.containerNo && !c.sealNo) errs.push({ field: 'containers', message: `Container ${i + 1}: seal number is mandatory once a container number is entered.` });
  });
  return errs;
}

/* Import-only — Bill of Entry duty assessment. Amounts are entered by the
   student (this is a training tool, not a live duty calculator), so
   validation checks internal consistency (does BCD + SWS + IGST + Cess +
   ADD actually add up to the declared total?) rather than recomputing the
   "correct" duty itself, which depends on notification-specific rates this
   simulator doesn't model. */
function validateAssessmentStep(filing) {
  const errs = [];
  if (filing.type !== 'import') return errs;
  const a = filing.assessment || {};
  if (!a.assessableValue || num(a.assessableValue) <= 0) errs.push({ field: 'assessableValue', message: 'Assessable value must be greater than zero.' });
  if (a.bcdRate === '' || a.bcdRate === undefined || num(a.bcdRate) < 0) errs.push({ field: 'bcdRate', message: 'BCD rate is mandatory.' });
  if (!a.bcdAmount && a.bcdAmount !== 0) errs.push({ field: 'bcdAmount', message: 'BCD amount is mandatory.' });
  if (!a.igstRate) errs.push({ field: 'igstRate', message: 'IGST rate is mandatory.' });
  if (!a.igstAmount && a.igstAmount !== 0) errs.push({ field: 'igstAmount', message: 'IGST amount is mandatory.' });
  if (!a.totalDutyPayable || num(a.totalDutyPayable) <= 0) errs.push({ field: 'totalDutyPayable', message: 'Total duty payable must be greater than zero.' });
  else {
    const computed = num(a.bcdAmount) + num(a.swsAmount) + num(a.igstAmount) + num(a.cessAmount) + num(a.antiDumpingDuty);
    if (Math.abs(computed - num(a.totalDutyPayable)) > 1) {
      errs.push({ field: 'totalDutyPayable', message: `Total duty payable (₹${num(a.totalDutyPayable).toLocaleString('en-IN')}) doesn't match BCD + SWS + IGST + Cess + Anti-Dumping (₹${computed.toLocaleString('en-IN')}). Recheck the individual amounts.` });
    }
  }
  if (!a.dutyChallanNo) errs.push({ field: 'dutyChallanNo', message: 'Duty payment challan / CIN is mandatory before the Bill of Entry can be submitted.' });
  return errs;
}

function validateDocumentsStep(filing) {
  const errs = [];
  const required = filing.type === 'export' ? ['Commercial Invoice', 'Packing List'] : ['Bill of Lading / Air Waybill', 'Commercial Invoice', 'Packing List'];
  required.forEach(rt => {
    const found = (filing.documents || []).find(d => d.type === rt && d.status === 'ATTACHED TO FILING');
    if (!found) errs.push({ field: 'documents', message: `Supporting document required before submission: ${rt}.` });
  });
  return errs;
}

/* Full validation across all steps.
   Section 8/9 fix: for import filings this MUST independently re-check IGM/manifest
   verification here too — not only rely on the wizard having gated the manifest step,
   since a user can go back and edit the BL/AWB number after verifying, or a filing
   record could be reached through any other code path. Wizard-step validation and
   final-submission validation now share this exact same rule set. */
function validateAll(filing) {
  let errs = [];
  errs = errs.concat(validatePartyStep(filing));
  errs = errs.concat(validateCounterpartyStep(filing));
  errs = errs.concat(validateShipmentStep(filing));
  if (filing.type === 'import' && typeof validateManifestStep === 'function') {
    errs = errs.concat(validateManifestStep(filing));
  }
  errs = errs.concat(validateInvoiceStep(filing));
  errs = errs.concat(validateItemsStep(filing));
  errs = errs.concat(validatePackagesStep(filing));
  errs = errs.concat(validateContainersStep(filing));
  errs = errs.concat(validateAssessmentStep(filing));
  errs = errs.concat(validateDocumentsStep(filing));
  return errs;
}

const STEP_VALIDATORS = {
  party: validatePartyStep,
  counterparty: validateCounterpartyStep,
  shipment: validateShipmentStep,
  invoice: validateInvoiceStep,
  items: validateItemsStep,
  packages: validatePackagesStep,
  containers: validateContainersStep,
  assessment: validateAssessmentStep,
  documents: validateDocumentsStep
};
