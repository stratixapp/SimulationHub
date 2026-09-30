/* ============================================================
   CONSIGNIA DESK — Insurance Certificate
   ============================================================ */

function blankInsuranceFields() {
  return {
    policyNumber: '', insured: '', policyDate: '',
    exporter: '', buyer: '',
    voyage: '', vessel: '', portOfLoading: '', portOfDischarge: '',
    goodsDescription: '', invoiceRef: '', invoiceValue: '', insuredValue: '', currency: '',
    coverage: '', risksCovered: '', premium: '',
    insurer: '', claimsPayableAt: '', signatory: ''
  };
}

function openInsuranceWorkstation(jobId) {
  const job = getExportJob(jobId);
  let doc = currentDocOfType(jobId, 'INSURANCE_CERTIFICATE');
  if (!doc) {
    doc = { id: newId('XDOC-INS'), exportJobId: jobId, type: 'INSURANCE_CERTIFICATE', version: 1, status: 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: blankInsuranceFields() };
    doc.fields.currency = job.brief.currency || '';
    STATE.exportDocs.push(doc);
    saveState();
  }
  CURRENT_INSURANCE_ID = doc.id;
  CURRENT_EXPORT_JOB_ID = jobId;
  navTo('exportInsurance');
}
var CURRENT_INSURANCE_ID = null;

function applyInvoiceToInsurance() {
  const doc = getExportDoc(CURRENT_INSURANCE_ID);
  const invoice = currentDocOfType(doc.exportJobId, 'COMMERCIAL_INVOICE');
  if (!invoice) { toast('No Commercial Invoice found for this Export Job.', 'error'); return; }
  syncInsuranceFieldsFromDOM(doc);
  const f = doc.fields;
  f.exporter = invoice.fields.exporter.legalName; f.buyer = invoice.fields.buyer.legalName;
  f.portOfLoading = invoice.fields.shipment.portOfLoading; f.portOfDischarge = invoice.fields.shipment.portOfDischarge;
  f.vessel = invoice.fields.shipment.vesselFlight;
  f.invoiceRef = invoice.fields.invoiceNumber; f.invoiceValue = invoiceTotals(invoice).finalInvoiceAmount; f.currency = invoice.fields.currency;
  if (invoice.fields.items.length) f.goodsDescription = invoice.fields.items.map(i => i.product).filter(Boolean).join(', ');
  saveState();
  toast('Applied from Commercial Invoice — review before marking Ready.', 'success');
  renderExportInsurance();
}

function renderExportInsurance() {
  const doc = getExportDoc(CURRENT_INSURANCE_ID);
  const host = $('#screen-exportInsurance');
  if (!doc) { host.innerHTML = '<div class="xd-root"><p class="hint">Certificate not found.</p></div>'; return; }
  const f = doc.fields;
  const versions = docVersionsOfType(doc.exportJobId, 'INSURANCE_CERTIFICATE');
  const invoice = currentDocOfType(doc.exportJobId, 'COMMERCIAL_INVOICE');

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / ${esc(doc.exportJobId)} / <b>Insurance Certificate</b></div>
      <h1>Insurance Certificate <span class="badge ${XD_DOC_STATUS_BADGE[doc.status]}">${esc(doc.status)}</span> <span class="hint">v${doc.version}${versions.length > 1 ? ' of ' + versions.length : ''}</span></h1></div>
      <button class="btn-ghost" onclick="navToExportJobDetail('${doc.exportJobId}')">Back to Export Job</button>
    </div>
    ${invoice ? `<div class="xd-card"><p class="hint">Commercial Invoice on file: <b>${esc(invoice.fields.invoiceNumber || '(number not set)')}</b>. <button class="btn-ghost sm" onclick="applyInvoiceToInsurance()">Apply from Invoice →</button></p></div>` : ''}

    <div class="xd-card"><h3>Policy</h3><div class="grid">
      ${fieldHTML({ id: 'ins__policyNumber', label: 'Policy / Certificate Number', required: true }, f.policyNumber)}
      ${fieldHTML({ id: 'ins__policyDate', label: 'Policy Date', type: 'date' }, f.policyDate)}
      ${fieldHTML({ id: 'ins__insured', label: 'Insured' }, f.insured)}
      ${fieldHTML({ id: 'ins__insurer', label: 'Insurer', required: true }, f.insurer)}
      ${fieldHTML({ id: 'ins__claimsPayableAt', label: 'Claims Payable At' }, f.claimsPayableAt)}
    </div></div>

    <div class="xd-card"><h3>Parties &amp; Voyage</h3><div class="grid">
      ${fieldHTML({ id: 'ins__exporter', label: 'Exporter' }, f.exporter)}
      ${fieldHTML({ id: 'ins__buyer', label: 'Buyer' }, f.buyer)}
      ${fieldHTML({ id: 'ins__vessel', label: 'Vessel / Flight' }, f.vessel)}
      ${fieldHTML({ id: 'ins__voyage', label: 'Voyage' }, f.voyage)}
      ${fieldHTML({ id: 'ins__portOfLoading', label: 'Port of Loading', type: 'select', options: INDIAN_PORTS }, f.portOfLoading)}
      ${fieldHTML({ id: 'ins__portOfDischarge', label: 'Port of Discharge', type: 'select', options: FOREIGN_PORTS }, f.portOfDischarge)}
    </div></div>

    <div class="xd-card"><h3>Goods &amp; Value</h3><div class="grid">
      ${fieldHTML({ id: 'ins__goodsDescription', label: 'Goods Description', full: true }, f.goodsDescription)}
      ${fieldHTML({ id: 'ins__invoiceRef', label: 'Invoice Reference' }, f.invoiceRef)}
      ${fieldHTML({ id: 'ins__invoiceValue', label: 'Invoice Value', type: 'number' }, f.invoiceValue)}
      ${fieldHTML({ id: 'ins__insuredValue', label: 'Insured Value', required: true, type: 'number' }, f.insuredValue)}
      ${fieldHTML({ id: 'ins__currency', label: 'Currency', type: 'select', options: CURRENCIES }, f.currency)}
      ${fieldHTML({ id: 'ins__premium', label: 'Premium', type: 'number' }, f.premium)}
    </div>
    <p class="hint">Insured Value is typically Invoice Value + a margin (commonly CIF + 10%) — the exact figure is the student's call to make, not auto-calculated here.</p>
    </div>

    <div class="xd-card"><h3>Coverage</h3><div class="grid">
      ${fieldHTML({ id: 'ins__coverage', label: 'Coverage', type: 'select', options: ['Institute Cargo Clauses (A)', 'Institute Cargo Clauses (B)', 'Institute Cargo Clauses (C)', 'All Risks', 'Named Perils'] }, f.coverage)}
      ${fieldHTML({ id: 'ins__risksCovered', label: 'Risks Covered', full: true, type: 'textarea' }, f.risksCovered)}
    </div></div>

    <div class="xd-card"><h3>Signature</h3><div class="grid">
      ${fieldHTML({ id: 'ins__signatory', label: 'Authorized Signatory' }, f.signatory)}
    </div></div>

    <div class="ferr" id="err_insurance"></div>
    <div class="actions">
      <button class="btn-ghost" onclick="openPrintPreview('INSURANCE_CERTIFICATE', '${doc.id}')">🖨 Preview / Print</button>
      <button class="btn-ghost" onclick="saveInsuranceDraft()">Save Draft</button>
      <button class="next" onclick="markInsuranceReady()">Mark Ready</button>
    </div>
  </div>`;
  xdWireSuggestions(host, doc.exportJobId, { ins__exporter: 'exporterName', ins__buyer: 'buyerName' });
}

function syncInsuranceFieldsFromDOM(doc) {
  const host = $('#screen-exportInsurance');
  const f = doc.fields;
  const g = (id) => { const n = $('#' + id, host); return n ? n.value : ''; };
  if (!host || !$('#ins__policyNumber', host)) return;
  f.policyNumber = g('ins__policyNumber'); f.policyDate = g('ins__policyDate'); f.insured = g('ins__insured'); f.insurer = g('ins__insurer'); f.claimsPayableAt = g('ins__claimsPayableAt');
  f.exporter = g('ins__exporter'); f.buyer = g('ins__buyer'); f.vessel = g('ins__vessel'); f.voyage = g('ins__voyage'); f.portOfLoading = g('ins__portOfLoading'); f.portOfDischarge = g('ins__portOfDischarge');
  f.goodsDescription = g('ins__goodsDescription'); f.invoiceRef = g('ins__invoiceRef'); f.invoiceValue = g('ins__invoiceValue'); f.insuredValue = g('ins__insuredValue'); f.currency = g('ins__currency'); f.premium = g('ins__premium');
  f.coverage = g('ins__coverage'); f.risksCovered = g('ins__risksCovered'); f.signatory = g('ins__signatory');
}

function persistInsuranceEdit(doc, makeReady) {
  syncInsuranceFieldsFromDOM(doc);
  if (doc.status === 'READY') {
    doc.status = 'SUPERSEDED';
    const newDoc = { id: newId('XDOC-INS'), exportJobId: doc.exportJobId, type: 'INSURANCE_CERTIFICATE', version: doc.version + 1, status: makeReady ? 'READY' : 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: JSON.parse(JSON.stringify(doc.fields)) };
    STATE.exportDocs.push(newDoc);
    CURRENT_INSURANCE_ID = newDoc.id;
    saveState();
    return newDoc;
  }
  doc.status = makeReady ? 'READY' : 'DRAFT';
  doc.updatedAt = Date.now();
  saveState();
  return doc;
}

function saveInsuranceDraft() { const doc = getExportDoc(CURRENT_INSURANCE_ID); persistInsuranceEdit(doc, false); toast('Insurance Certificate draft saved.', 'success'); renderExportInsurance(); }

function markInsuranceReady() {
  const doc = getExportDoc(CURRENT_INSURANCE_ID);
  const host = $('#screen-exportInsurance');
  clearFieldErrors(host);
  syncInsuranceFieldsFromDOM(doc);
  const errs = [];
  if (!doc.fields.policyNumber) errs.push('Policy/Certificate Number is required');
  if (!doc.fields.insurer) errs.push('Insurer is required');
  if (!doc.fields.insuredValue) errs.push('Insured Value is required');
  if (errs.length) { showFieldError(host, 'insurance', errs.join(' · ')); toast('Fix the highlighted issues before marking Ready.', 'error'); return; }
  const readyDoc = persistInsuranceEdit(doc, true);
  toast('Insurance Certificate marked Ready.', 'success');
  xdCheckBridgeCompletion('INSURANCE_CERTIFICATE', readyDoc.id, 'Insurance Certificate');
  navToExportJobDetail(doc.exportJobId);
}
