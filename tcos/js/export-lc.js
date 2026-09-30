/* ============================================================
   CONSIGNIA DESK — Letter of Credit + Compliance Check
   ------------------------------------------------------------
   The LC itself is a document like any other. The Compliance
   Check is a separate engine (Section 15) that compares the LC's
   stated requirements against the Export Job's actual document
   set — same investigate-don't-reveal posture as the consistency
   engine, but LC-specific severities (COMPLIANT / DISCREPANCY /
   MISSING DOCUMENT / DATA MISMATCH).
   ============================================================ */

const LC_DOC_CHOICES = ['COMMERCIAL_INVOICE', 'PACKING_LIST', 'BILL_OF_LADING', 'AIR_WAYBILL', 'CERTIFICATE_OF_ORIGIN', 'INSURANCE_CERTIFICATE', 'BILL_OF_EXCHANGE'];

function blankLcFields() {
  const documentsRequired = {};
  LC_DOC_CHOICES.forEach(k => documentsRequired[k] = ['COMMERCIAL_INVOICE', 'PACKING_LIST', 'BILL_OF_LADING'].includes(k));
  return {
    lcNumber: '', issueDate: '', expiryDate: '', expiryPlace: '', applicant: '', beneficiary: '',
    issuingBank: '', advisingBank: '', nominatedBank: '', confirmingBank: '',
    amount: '', currency: '', tolerancePct: '', availability: 'Sight', tenorDays: '',
    latestShipmentDate: '', portOfLoading: '', portOfDischarge: '',
    partialShipmentAllowed: false, transshipmentAllowed: false,
    incoterm: '', insuranceRequired: false,
    documentsRequired,
    specialConditions: ''
  };
}

function openLcWorkstation(jobId) {
  const job = getExportJob(jobId);
  let doc = currentDocOfType(jobId, 'LETTER_OF_CREDIT');
  if (!doc) {
    doc = { id: newId('XDOC-LC'), exportJobId: jobId, type: 'LETTER_OF_CREDIT', version: 1, status: 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: blankLcFields() };
    doc.fields.beneficiary = ''; doc.fields.currency = job.brief.currency || '';
    doc.fields.incoterm = job.brief.incoterm || '';
    doc.fields.portOfLoading = ''; doc.fields.portOfDischarge = '';
    doc.fields.insuranceRequired = job.brief.incoterm === 'CIF' || job.brief.incoterm === 'CIP';
    STATE.exportDocs.push(doc);
    saveState();
  }
  CURRENT_LC_ID = doc.id;
  CURRENT_EXPORT_JOB_ID = jobId;
  navTo('exportLc');
}
var CURRENT_LC_ID = null;

function renderExportLc() {
  const doc = getExportDoc(CURRENT_LC_ID);
  const host = $('#screen-exportLc');
  if (!doc) { host.innerHTML = '<div class="xd-root"><p class="hint">Letter of Credit not found.</p></div>'; return; }
  const f = doc.fields;
  const versions = docVersionsOfType(doc.exportJobId, 'LETTER_OF_CREDIT');
  const check = STATE.consistencyChecks.find(c => c.exportJobId === doc.exportJobId && c.kind === 'LC_COMPLIANCE');

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / ${esc(doc.exportJobId)} / <b>Letter of Credit</b></div>
      <h1>Letter of Credit <span class="badge ${XD_DOC_STATUS_BADGE[doc.status]}">${esc(doc.status)}</span> <span class="hint">v${doc.version}${versions.length > 1 ? ' of ' + versions.length : ''}</span></h1></div>
      <button class="btn-ghost" onclick="navToExportJobDetail('${doc.exportJobId}')">Back to Export Job</button>
    </div>

    <div class="xd-card"><h3>LC Identity</h3><div class="grid">
      ${fieldHTML({ id: 'lc__lcNumber', label: 'LC Number', required: true }, f.lcNumber)}
      ${fieldHTML({ id: 'lc__issueDate', label: 'Issue Date', type: 'date' }, f.issueDate)}
      ${fieldHTML({ id: 'lc__expiryDate', label: 'Expiry Date', required: true, type: 'date' }, f.expiryDate)}
      ${fieldHTML({ id: 'lc__expiryPlace', label: 'Expiry Place' }, f.expiryPlace)}
      ${fieldHTML({ id: 'lc__applicant', label: 'Applicant (Buyer)', required: true }, f.applicant)}
      ${fieldHTML({ id: 'lc__beneficiary', label: 'Beneficiary (Exporter)', required: true }, f.beneficiary)}
    </div></div>

    <div class="xd-card"><h3>Banks</h3><div class="grid">
      ${fieldHTML({ id: 'lc__issuingBank', label: 'Issuing Bank', required: true }, f.issuingBank)}
      ${fieldHTML({ id: 'lc__advisingBank', label: 'Advising Bank' }, f.advisingBank)}
      ${fieldHTML({ id: 'lc__nominatedBank', label: 'Nominated Bank' }, f.nominatedBank)}
      ${fieldHTML({ id: 'lc__confirmingBank', label: 'Confirming Bank' }, f.confirmingBank)}
    </div></div>

    <div class="xd-card"><h3>Financial</h3><div class="grid">
      ${fieldHTML({ id: 'lc__amount', label: 'Amount', required: true, type: 'number' }, f.amount)}
      ${fieldHTML({ id: 'lc__currency', label: 'Currency', type: 'select', options: CURRENCIES }, f.currency)}
      ${fieldHTML({ id: 'lc__tolerancePct', label: 'Tolerance (%)', type: 'number', placeholder: 'e.g. 5' }, f.tolerancePct)}
      ${fieldHTML({ id: 'lc__availability', label: 'Availability', type: 'select', options: ['Sight', 'Usance'] }, f.availability)}
      ${fieldHTML({ id: 'lc__tenorDays', label: 'Tenor (days, if Usance)', type: 'number' }, f.tenorDays)}
    </div></div>

    <div class="xd-card"><h3>Shipment Conditions</h3><div class="grid">
      ${fieldHTML({ id: 'lc__latestShipmentDate', label: 'Latest Shipment Date', required: true, type: 'date' }, f.latestShipmentDate)}
      ${fieldHTML({ id: 'lc__portOfLoading', label: 'Port of Loading', type: 'select', options: INDIAN_PORTS }, f.portOfLoading)}
      ${fieldHTML({ id: 'lc__portOfDischarge', label: 'Port of Discharge', type: 'select', options: FOREIGN_PORTS }, f.portOfDischarge)}
      ${fieldHTML({ id: 'lc__incoterm', label: 'Incoterm', type: 'select', options: INCOTERMS }, f.incoterm)}
    </div>
    <div class="grid" style="margin-top:6px">
      <label class="xd-check"><input type="checkbox" id="lc__partialShipmentAllowed" ${f.partialShipmentAllowed ? 'checked' : ''}> Partial Shipment Allowed</label>
      <label class="xd-check"><input type="checkbox" id="lc__transshipmentAllowed" ${f.transshipmentAllowed ? 'checked' : ''}> Transshipment Allowed</label>
      <label class="xd-check"><input type="checkbox" id="lc__insuranceRequired" ${f.insuranceRequired ? 'checked' : ''}> Insurance Required</label>
    </div></div>

    <div class="xd-card"><h3>Documents Required</h3>
      <div class="grid">${LC_DOC_CHOICES.map(k => `<label class="xd-check"><input type="checkbox" data-lcdoc="${k}" ${f.documentsRequired[k] ? 'checked' : ''}> ${esc(EXPORT_DOC_CATALOG[k].label)}</label>`).join('')}</div>
    </div>

    <div class="xd-card"><h3>Special Conditions</h3>
      ${fieldHTML({ id: 'lc__specialConditions', label: '', full: true, type: 'textarea', placeholder: 'One condition per line' }, f.specialConditions)}
    </div>

    <div class="ferr" id="err_lc"></div>
    <div class="actions">
      <button class="btn-ghost" onclick="openPrintPreview('LETTER_OF_CREDIT', '${doc.id}')">🖨 Preview / Print</button>
      <button class="btn-ghost" onclick="saveLcDraft()">Save Draft</button>
      <button class="next" onclick="markLcReady()">Mark Ready</button>
    </div>

    <div class="xd-card"><h3>LC Document Compliance Check</h3>
      ${check ? renderLcComplianceSummary(check) : '<p class="hint">Run once the LC is saved and at least the Commercial Invoice exists.</p>'}
      <button class="btn-ghost sm" onclick="runLCComplianceCheck('${doc.exportJobId}'); renderExportLc()">Run Compliance Check</button>
    </div>
  </div>`;

  $all('[data-lcdoc]', host).forEach(cb => cb.addEventListener('change', () => { doc.fields.documentsRequired[cb.dataset.lcdoc] = cb.checked; saveState(); }));
}

function syncLcFieldsFromDOM(doc) {
  const host = $('#screen-exportLc');
  const f = doc.fields;
  const g = (id) => { const n = $('#' + id, host); return n ? n.value : ''; };
  if (!host || !$('#lc__lcNumber', host)) return;
  f.lcNumber = g('lc__lcNumber'); f.issueDate = g('lc__issueDate'); f.expiryDate = g('lc__expiryDate'); f.expiryPlace = g('lc__expiryPlace'); f.applicant = g('lc__applicant'); f.beneficiary = g('lc__beneficiary');
  f.issuingBank = g('lc__issuingBank'); f.advisingBank = g('lc__advisingBank'); f.nominatedBank = g('lc__nominatedBank'); f.confirmingBank = g('lc__confirmingBank');
  f.amount = g('lc__amount'); f.currency = g('lc__currency'); f.tolerancePct = g('lc__tolerancePct'); f.availability = g('lc__availability'); f.tenorDays = g('lc__tenorDays');
  f.latestShipmentDate = g('lc__latestShipmentDate'); f.portOfLoading = g('lc__portOfLoading'); f.portOfDischarge = g('lc__portOfDischarge'); f.incoterm = g('lc__incoterm');
  f.partialShipmentAllowed = $('#lc__partialShipmentAllowed', host).checked;
  f.transshipmentAllowed = $('#lc__transshipmentAllowed', host).checked;
  f.insuranceRequired = $('#lc__insuranceRequired', host).checked;
  f.specialConditions = g('lc__specialConditions');
}

function persistLcEdit(doc, makeReady) {
  syncLcFieldsFromDOM(doc);
  if (doc.status === 'READY') {
    doc.status = 'SUPERSEDED';
    const newDoc = { id: newId('XDOC-LC'), exportJobId: doc.exportJobId, type: 'LETTER_OF_CREDIT', version: doc.version + 1, status: makeReady ? 'READY' : 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: JSON.parse(JSON.stringify(doc.fields)) };
    STATE.exportDocs.push(newDoc);
    CURRENT_LC_ID = newDoc.id;
    saveState();
    return newDoc;
  }
  doc.status = makeReady ? 'READY' : 'DRAFT';
  doc.updatedAt = Date.now();
  saveState();
  return doc;
}

function saveLcDraft() { const doc = getExportDoc(CURRENT_LC_ID); persistLcEdit(doc, false); toast('LC draft saved.', 'success'); renderExportLc(); }

function markLcReady() {
  const doc = getExportDoc(CURRENT_LC_ID);
  const host = $('#screen-exportLc');
  clearFieldErrors(host);
  syncLcFieldsFromDOM(doc);
  const errs = [];
  if (!doc.fields.lcNumber) errs.push('LC Number is required');
  if (!doc.fields.expiryDate) errs.push('Expiry Date is required');
  if (!doc.fields.applicant) errs.push('Applicant is required');
  if (!doc.fields.beneficiary) errs.push('Beneficiary is required');
  if (!doc.fields.issuingBank) errs.push('Issuing Bank is required');
  if (!doc.fields.amount) errs.push('Amount is required');
  if (!doc.fields.latestShipmentDate) errs.push('Latest Shipment Date is required');
  if (errs.length) { showFieldError(host, 'lc', errs.join(' · ')); toast('Fix the highlighted issues before marking Ready.', 'error'); return; }
  const readyDoc = persistLcEdit(doc, true);
  toast('Letter of Credit marked Ready.', 'success');
  xdCheckBridgeCompletion('LETTER_OF_CREDIT', readyDoc.id, 'Letter of Credit');
  navToExportJobDetail(doc.exportJobId);
}

/* ---------------- LC Document Compliance Check ---------------- */
const LC_SEVERITY_BADGE = { COMPLIANT: 'badge-green', DISCREPANCY: 'badge-red', 'MISSING DOCUMENT': 'badge-grey', 'DATA MISMATCH': 'badge-amber' };

function runLCComplianceCheck(jobId) {
  const lc = currentDocOfType(jobId, 'LETTER_OF_CREDIT');
  const results = [];
  function add(docType, area, severity, reason) { results.push({ document: docType ? (EXPORT_DOC_CATALOG[docType] ? EXPORT_DOC_CATALOG[docType].label : docType) : 'Letter of Credit', area, severity, reason }); }

  if (!lc) {
    const check = { id: newId('XCHK-LC'), exportJobId: jobId, kind: 'LC_COMPLIANCE', ts: Date.now(), results: [{ document: 'Letter of Credit', area: 'Document', severity: 'MISSING DOCUMENT', reason: 'No Letter of Credit has been prepared for this Export Job yet.' }], counts: { 'MISSING DOCUMENT': 1 } };
    saveLcComplianceCheck(check);
    return check;
  }

  Object.keys(lc.fields.documentsRequired).forEach(docType => {
    if (!lc.fields.documentsRequired[docType]) return;
    const d = currentDocOfType(jobId, docType);
    if (!d) { add(docType, 'Document', 'MISSING DOCUMENT', 'Required by the LC but not yet started.'); return; }
    if (d.status !== 'READY') { add(docType, 'Document', 'MISSING DOCUMENT', 'Required by the LC but not yet marked Ready.'); return; }
  });

  const invoice = currentDocOfType(jobId, 'COMMERCIAL_INVOICE');
  if (invoice) {
    const presented = invoiceTotals(invoice).finalInvoiceAmount;
    const tolerance = num(lc.fields.tolerancePct) / 100;
    if (lc.fields.amount && presented > num(lc.fields.amount) * (1 + tolerance)) add('COMMERCIAL_INVOICE', 'Invoice Value', 'DISCREPANCY', 'Presented invoice amount does not reconcile with the documentary credit amount and tolerance.');
    if (lc.fields.currency && invoice.fields.currency && lc.fields.currency !== invoice.fields.currency) add('COMMERCIAL_INVOICE', 'Currency', 'DISCREPANCY', 'Presented currency does not match the documentary credit currency.');
    if (xdStrMismatch(lc.fields.applicant, invoice.fields.buyer.legalName)) add('COMMERCIAL_INVOICE', 'Applicant / Buyer', 'DATA MISMATCH', 'Buyer named on the invoice does not match the LC applicant.');
    if (xdStrMismatch(lc.fields.beneficiary, invoice.fields.exporter.legalName)) add('COMMERCIAL_INVOICE', 'Beneficiary / Exporter', 'DATA MISMATCH', 'Exporter named on the invoice does not match the LC beneficiary.');
  }

  const job = getExportJob(jobId);
  const transportType = transportDocType(job);
  const transportDoc = currentDocOfType(jobId, transportType);
  if (transportDoc) {
    if (transportDoc.fields.date && lc.fields.latestShipmentDate && transportDoc.fields.date > lc.fields.latestShipmentDate) add(transportType, 'Shipment Date', 'DISCREPANCY', 'Transport document date appears to be after the LC\u2019s latest shipment date — presentation may be late.');
    if (lc.fields.portOfLoading && xdStrMismatch(lc.fields.portOfLoading, transportDoc.fields.routing.portOfLoading)) add(transportType, 'Port of Loading', 'DATA MISMATCH', 'Port of Loading on the transport document does not match the LC.');
    if (lc.fields.portOfDischarge && xdStrMismatch(lc.fields.portOfDischarge, transportDoc.fields.routing.portOfDischarge)) add(transportType, 'Port of Discharge', 'DATA MISMATCH', 'Port of Discharge on the transport document does not match the LC.');
  }

  if (lc.fields.insuranceRequired) {
    const ins = currentDocOfType(jobId, 'INSURANCE_CERTIFICATE');
    if (ins && invoice && num(ins.fields.insuredValue) < num(invoiceTotals(invoice).finalInvoiceAmount)) add('INSURANCE_CERTIFICATE', 'Insured Value', 'DISCREPANCY', 'Insured value appears insufficient relative to the invoice value.');
  }

  if (!results.length) results.push({ document: 'All Presented Documents', area: 'Overall', severity: 'COMPLIANT', reason: 'No discrepancies detected against the documents available so far.' });

  const counts = {};
  results.forEach(r => counts[r.severity] = (counts[r.severity] || 0) + 1);
  const check = { id: newId('XCHK-LC'), exportJobId: jobId, kind: 'LC_COMPLIANCE', ts: Date.now(), results, counts };
  saveLcComplianceCheck(check);
  return check;
}

function saveLcComplianceCheck(check) {
  const idx = STATE.consistencyChecks.findIndex(c => c.exportJobId === check.exportJobId && c.kind === 'LC_COMPLIANCE');
  if (idx >= 0) STATE.consistencyChecks[idx] = check; else STATE.consistencyChecks.push(check);
  saveState();
}

function renderLcComplianceSummary(check) {
  return `<p class="hint">Last run ${fmtDateTime(check.ts)}. Values are not shown — open the listed document(s) and check against the LC yourself.</p>
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>Status</th><th>Document</th><th>Area</th><th>Observation</th></tr></thead>
    <tbody>${check.results.map(r => `<tr>
      <td><span class="badge ${LC_SEVERITY_BADGE[r.severity]}">${esc(r.severity)}</span></td>
      <td>${esc(r.document)}</td><td>${esc(r.area)}</td><td>${esc(r.reason)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
