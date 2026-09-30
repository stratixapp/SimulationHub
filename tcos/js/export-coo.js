/* ============================================================
   CONSIGNIA DESK — Certificate of Origin
   ------------------------------------------------------------
   Supports Non-Preferential and Preferential (eCoO 2.0 style,
   incl. Back-to-Back for goods not of Indian origin) — per the
   Sept 2026 DGFT eCoO 2.0 research findings (Phase 1 doc).
   ============================================================ */

function blankCooFields() {
  return {
    certificateNumber: '', applicationReference: '', type: 'Non-Preferential', tradeAgreement: '', backToBack: false,
    exporter: { name: '', address: '', iec: '' },
    consignee: { name: '', address: '', country: '' },
    countryOfOrigin: 'India', countryOfDestination: '',
    invoiceRef: '', invoiceDate: '',
    goodsDescription: '', hsCode: '', quantity: '', unit: '', value: '', currency: '',
    originCriterion: '', processingInformation: '',
    issuingAuthority: '', issueStatus: 'DRAFT', issueDate: '',
    declaration: { signatoryName: '', place: '', date: '' }
  };
}

function openCooWorkstation(jobId) {
  const job = getExportJob(jobId);
  let doc = currentDocOfType(jobId, 'CERTIFICATE_OF_ORIGIN');
  if (!doc) {
    doc = { id: newId('XDOC-COO'), exportJobId: jobId, type: 'CERTIFICATE_OF_ORIGIN', version: 1, status: 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: blankCooFields() };
    doc.fields.type = job.brief.ftaClaim ? 'Preferential' : 'Non-Preferential';
    doc.fields.countryOfDestination = job.brief.destinationCountry || '';
    doc.fields.hsCode = job.brief.hsCode || '';
    STATE.exportDocs.push(doc);
    saveState();
  }
  CURRENT_COO_ID = doc.id;
  CURRENT_EXPORT_JOB_ID = jobId;
  navTo('exportCoo');
}
var CURRENT_COO_ID = null;

function applyInvoiceToCoo() {
  const doc = getExportDoc(CURRENT_COO_ID);
  const invoice = currentDocOfType(doc.exportJobId, 'COMMERCIAL_INVOICE');
  if (!invoice) { toast('No Commercial Invoice found for this Export Job.', 'error'); return; }
  syncCooFieldsFromDOM(doc);
  const f = doc.fields;
  f.exporter = { name: invoice.fields.exporter.legalName, address: invoice.fields.exporter.address, iec: invoice.fields.exporter.iec };
  f.consignee = { name: invoice.fields.consignee.name || invoice.fields.buyer.legalName, address: invoice.fields.consignee.address || invoice.fields.buyer.address, country: invoice.fields.consignee.country || invoice.fields.buyer.country };
  f.invoiceRef = invoice.fields.invoiceNumber; f.invoiceDate = invoice.fields.invoiceDate;
  f.value = invoiceTotals(invoice).finalInvoiceAmount; f.currency = invoice.fields.currency;
  if (invoice.fields.items.length) { f.goodsDescription = invoice.fields.items.map(i => i.product).filter(Boolean).join(', '); f.hsCode = invoice.fields.items[0].hsCode; f.quantity = invoiceTotals(invoice).quantityTotal; }
  saveState();
  toast('Applied from Commercial Invoice — review before marking Ready.', 'success');
  renderExportCoo();
}

function renderExportCoo() {
  const doc = getExportDoc(CURRENT_COO_ID);
  const host = $('#screen-exportCoo');
  if (!doc) { host.innerHTML = '<div class="xd-root"><p class="hint">Certificate not found.</p></div>'; return; }
  const f = doc.fields;
  const versions = docVersionsOfType(doc.exportJobId, 'CERTIFICATE_OF_ORIGIN');
  const invoice = currentDocOfType(doc.exportJobId, 'COMMERCIAL_INVOICE');

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / ${esc(doc.exportJobId)} / <b>Certificate of Origin</b></div>
      <h1>Certificate of Origin <span class="badge ${XD_DOC_STATUS_BADGE[doc.status]}">${esc(doc.status)}</span> <span class="hint">v${doc.version}${versions.length > 1 ? ' of ' + versions.length : ''}</span></h1></div>
      <button class="btn-ghost" onclick="navToExportJobDetail('${doc.exportJobId}')">Back to Export Job</button>
    </div>

    ${invoice ? `<div class="xd-card"><p class="hint">Commercial Invoice on file: <b>${esc(invoice.fields.invoiceNumber || '(number not set)')}</b>. <button class="btn-ghost sm" onclick="applyInvoiceToCoo()">Apply from Invoice →</button></p></div>` : ''}

    <div class="xd-card"><h3>Certificate Type</h3><div class="grid">
      ${fieldHTML({ id: 'coo__type', label: 'Type', required: true, type: 'select', options: ['Non-Preferential', 'Preferential'] }, f.type)}
      ${fieldHTML({ id: 'coo__tradeAgreement', label: 'Trade Agreement (if Preferential)' }, f.tradeAgreement)}
      ${fieldHTML({ id: 'coo__certificateNumber', label: 'Certificate Number' }, f.certificateNumber)}
      ${fieldHTML({ id: 'coo__applicationReference', label: 'DGFT eCoO 2.0 Application Reference' }, f.applicationReference)}
    </div>
    <label class="xd-check"><input type="checkbox" id="coo__backToBack" ${f.backToBack ? 'checked' : ''}> Back-to-Back CoO (goods not of Indian origin — re-export/merchanting trade)</label>
    <p class="hint">DGFT's eCoO 2.0 platform now supports an Open API for ERP-integrated exporters to submit CoO applications directly, and an in-lieu correction workflow if a certificate needs to be reissued after errors are found — this training module models the manual application path.</p>
    </div>

    <div class="xd-card"><h3>Exporter</h3><div class="grid">
      ${fieldHTML({ id: 'coo__exp_name', label: 'Name', required: true }, f.exporter.name)}
      ${fieldHTML({ id: 'coo__exp_address', label: 'Address', full: true }, f.exporter.address)}
      ${fieldHTML({ id: 'coo__exp_iec', label: 'IEC', required: true }, f.exporter.iec)}
    </div></div>

    <div class="xd-card"><h3>Consignee</h3><div class="grid">
      ${fieldHTML({ id: 'coo__con_name', label: 'Name', required: true }, f.consignee.name)}
      ${fieldHTML({ id: 'coo__con_address', label: 'Address', full: true }, f.consignee.address)}
      ${fieldHTML({ id: 'coo__con_country', label: 'Country', type: 'select', options: COUNTRIES }, f.consignee.country)}
    </div></div>

    <div class="xd-card"><h3>Shipment &amp; Goods</h3><div class="grid">
      ${fieldHTML({ id: 'coo__countryOfOrigin', label: 'Country of Origin', type: 'select', options: COUNTRIES }, f.countryOfOrigin)}
      ${fieldHTML({ id: 'coo__countryOfDestination', label: 'Country of Destination', type: 'select', options: COUNTRIES }, f.countryOfDestination)}
      ${fieldHTML({ id: 'coo__invoiceRef', label: 'Invoice Reference' }, f.invoiceRef)}
      ${fieldHTML({ id: 'coo__invoiceDate', label: 'Invoice Date', type: 'date' }, f.invoiceDate)}
      ${fieldHTML({ id: 'coo__goodsDescription', label: 'Description of Goods', full: true, required: true }, f.goodsDescription)}
      ${fieldHTML({ id: 'coo__hsCode', label: 'HS Code', required: true }, f.hsCode)}
      ${fieldHTML({ id: 'coo__quantity', label: 'Quantity', type: 'number' }, f.quantity)}
      ${fieldHTML({ id: 'coo__unit', label: 'Unit', type: 'select', options: UNITS }, f.unit)}
      ${fieldHTML({ id: 'coo__value', label: 'Value', type: 'number' }, f.value)}
      ${fieldHTML({ id: 'coo__currency', label: 'Currency', type: 'select', options: CURRENCIES }, f.currency)}
    </div></div>

    <div class="xd-card"><h3>Origin Evidence</h3><div class="grid">
      ${fieldHTML({ id: 'coo__originCriterion', label: 'Origin Criterion', full: true, placeholder: 'e.g. Wholly Obtained / Substantial Transformation / Value-Addition threshold met' }, f.originCriterion)}
      ${fieldHTML({ id: 'coo__processingInformation', label: 'Processing / Manufacturing Information', full: true, type: 'textarea' }, f.processingInformation)}
    </div></div>

    <div class="xd-card"><h3>Issuance</h3><div class="grid">
      ${fieldHTML({ id: 'coo__issuingAuthority', label: 'Issuing Authority', placeholder: 'e.g. Export Promotion Council / Chamber of Commerce' }, f.issuingAuthority)}
      ${fieldHTML({ id: 'coo__issueStatus', label: 'Status', type: 'select', options: ['DRAFT', 'APPLIED', 'ISSUED', 'CORRECTION REQUESTED (IN-LIEU)'] }, f.issueStatus)}
      ${fieldHTML({ id: 'coo__issueDate', label: 'Issue Date', type: 'date' }, f.issueDate)}
    </div></div>

    <div class="xd-card"><h3>Declaration</h3><div class="grid">
      ${fieldHTML({ id: 'coo__decl_signatoryName', label: 'Signatory Name' }, f.declaration.signatoryName)}
      ${fieldHTML({ id: 'coo__decl_place', label: 'Place' }, f.declaration.place)}
      ${fieldHTML({ id: 'coo__decl_date', label: 'Date', type: 'date' }, f.declaration.date)}
    </div></div>

    <div class="ferr" id="err_coo"></div>
    <div class="actions">
      <button class="btn-ghost" onclick="openPrintPreview('CERTIFICATE_OF_ORIGIN', '${doc.id}')">🖨 Preview / Print</button>
      <button class="btn-ghost" onclick="saveCooDraft()">Save Draft</button>
      <button class="next" onclick="markCooReady()">Mark Ready</button>
    </div>
  </div>`;
  xdWireSuggestions(host, doc.exportJobId, { coo__exp_name: 'exporterName', coo__exp_iec: 'iec', coo__con_name: 'consigneeName', coo__hsCode: 'hsCode' });
}

function syncCooFieldsFromDOM(doc) {
  const host = $('#screen-exportCoo');
  const f = doc.fields;
  const g = (id) => { const n = $('#' + id, host); return n ? n.value : ''; };
  if (!host || !$('#coo__type', host)) return;
  f.type = g('coo__type'); f.tradeAgreement = g('coo__tradeAgreement'); f.certificateNumber = g('coo__certificateNumber'); f.applicationReference = g('coo__applicationReference');
  f.backToBack = $('#coo__backToBack', host).checked;
  f.exporter = { name: g('coo__exp_name'), address: g('coo__exp_address'), iec: g('coo__exp_iec') };
  f.consignee = { name: g('coo__con_name'), address: g('coo__con_address'), country: g('coo__con_country') };
  f.countryOfOrigin = g('coo__countryOfOrigin'); f.countryOfDestination = g('coo__countryOfDestination');
  f.invoiceRef = g('coo__invoiceRef'); f.invoiceDate = g('coo__invoiceDate');
  f.goodsDescription = g('coo__goodsDescription'); f.hsCode = g('coo__hsCode'); f.quantity = g('coo__quantity'); f.unit = g('coo__unit'); f.value = g('coo__value'); f.currency = g('coo__currency');
  f.originCriterion = g('coo__originCriterion'); f.processingInformation = g('coo__processingInformation');
  f.issuingAuthority = g('coo__issuingAuthority'); f.issueStatus = g('coo__issueStatus'); f.issueDate = g('coo__issueDate');
  f.declaration = { signatoryName: g('coo__decl_signatoryName'), place: g('coo__decl_place'), date: g('coo__decl_date') };
}

function persistCooEdit(doc, makeReady) {
  syncCooFieldsFromDOM(doc);
  if (doc.status === 'READY') {
    doc.status = 'SUPERSEDED';
    const newDoc = { id: newId('XDOC-COO'), exportJobId: doc.exportJobId, type: 'CERTIFICATE_OF_ORIGIN', version: doc.version + 1, status: makeReady ? 'READY' : 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: JSON.parse(JSON.stringify(doc.fields)) };
    STATE.exportDocs.push(newDoc);
    CURRENT_COO_ID = newDoc.id;
    saveState();
    return newDoc;
  }
  doc.status = makeReady ? 'READY' : 'DRAFT';
  doc.updatedAt = Date.now();
  saveState();
  return doc;
}

function saveCooDraft() { const doc = getExportDoc(CURRENT_COO_ID); persistCooEdit(doc, false); toast('Certificate of Origin draft saved.', 'success'); renderExportCoo(); }

function markCooReady() {
  const doc = getExportDoc(CURRENT_COO_ID);
  const host = $('#screen-exportCoo');
  clearFieldErrors(host);
  syncCooFieldsFromDOM(doc);
  const errs = [];
  if (!doc.fields.exporter.name) errs.push('Exporter Name is required');
  if (!doc.fields.exporter.iec) errs.push('Exporter IEC is required');
  if (!doc.fields.consignee.name) errs.push('Consignee Name is required');
  if (!doc.fields.goodsDescription) errs.push('Description of Goods is required');
  if (!doc.fields.hsCode) errs.push('HS Code is required');
  if (doc.fields.type === 'Preferential' && !doc.fields.originCriterion) errs.push('Origin Criterion is required for a Preferential claim');
  if (errs.length) { showFieldError(host, 'coo', errs.join(' · ')); toast('Fix the highlighted issues before marking Ready.', 'error'); return; }
  const readyDoc = persistCooEdit(doc, true);
  toast('Certificate of Origin marked Ready.', 'success');
  xdCheckBridgeCompletion('CERTIFICATE_OF_ORIGIN', readyDoc.id, 'Certificate of Origin');
  navToExportJobDetail(doc.exportJobId);
}
