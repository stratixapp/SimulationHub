/* ============================================================
   CONSIGNIA DESK — Export License / SCOMET Authorization
   ------------------------------------------------------------
   Gated by the Document Planner's brief.scomet flag. Clearly a
   TRAINING representation — never framed as a real DGFT filing
   (Section 3 / 18 of the master brief).
   ============================================================ */

function blankLicenseFields() {
  return {
    licenseType: 'SCOMET Authorization',
    licenseReference: '', applicationDate: '', issueDate: '', expiryDate: '', issuingAuthority: 'DGFT',
    exporter: '', consignee: '', product: '', hsCode: '', quantity: '', permittedQuantity: '', destinationCountry: '',
    itemCategory: '', subCategory: '', technicalDescription: '',
    endUser: '', endUse: '', endUserDeclarationOnFile: false,
    conditions: '', status: 'DRAFT'
  };
}

function openLicenseWorkstation(jobId) {
  const job = getExportJob(jobId);
  let doc = currentDocOfType(jobId, 'EXPORT_LICENSE');
  if (!doc) {
    doc = { id: newId('XDOC-LIC'), exportJobId: jobId, type: 'EXPORT_LICENSE', version: 1, status: 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: blankLicenseFields() };
    doc.fields.product = job.brief.commodity || ''; doc.fields.hsCode = job.brief.hsCode || ''; doc.fields.destinationCountry = job.brief.destinationCountry || '';
    STATE.exportDocs.push(doc);
    saveState();
  }
  CURRENT_LICENSE_ID = doc.id;
  CURRENT_EXPORT_JOB_ID = jobId;
  navTo('exportLicense');
}
var CURRENT_LICENSE_ID = null;

function renderExportLicense() {
  const doc = getExportDoc(CURRENT_LICENSE_ID);
  const host = $('#screen-exportLicense');
  if (!doc) { host.innerHTML = '<div class="xd-root"><p class="hint">Not found.</p></div>'; return; }
  const f = doc.fields;
  const versions = docVersionsOfType(doc.exportJobId, 'EXPORT_LICENSE');

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / ${esc(doc.exportJobId)} / <b>Export License / SCOMET</b></div>
      <h1>Export License / SCOMET <span class="badge ${XD_DOC_STATUS_BADGE[doc.status]}">${esc(doc.status)}</span> <span class="hint">v${doc.version}${versions.length > 1 ? ' of ' + versions.length : ''}</span></h1></div>
      <button class="btn-ghost" onclick="navToExportJobDetail('${doc.exportJobId}')">Back to Export Job</button>
    </div>
    <div class="xd-card"><p class="hint"><b>TRAINING SIMULATOR.</b> This is an independent educational representation of an export-control authorization workflow — it is not a DGFT filing, is not connected to any government system, and grants no real authorization.</p></div>

    <div class="xd-card"><h3>Authorization</h3><div class="grid">
      ${fieldHTML({ id: 'lic__licenseType', label: 'Type', type: 'select', options: ['SCOMET Authorization', 'Restricted Goods Export License'] }, f.licenseType)}
      ${fieldHTML({ id: 'lic__licenseReference', label: 'Application / License Reference' }, f.licenseReference)}
      ${fieldHTML({ id: 'lic__applicationDate', label: 'Application Date', type: 'date' }, f.applicationDate)}
      ${fieldHTML({ id: 'lic__issueDate', label: 'Issue Date', type: 'date' }, f.issueDate)}
      ${fieldHTML({ id: 'lic__expiryDate', label: 'Expiry Date', type: 'date' }, f.expiryDate)}
      ${fieldHTML({ id: 'lic__issuingAuthority', label: 'Issuing Authority' }, f.issuingAuthority)}
      ${fieldHTML({ id: 'lic__status', label: 'Status', type: 'select', options: ['DRAFT', 'APPLIED', 'GRANTED', 'DENIED'] }, f.status)}
    </div></div>

    <div class="xd-card"><h3>Item</h3><div class="grid">
      ${fieldHTML({ id: 'lic__product', label: 'Product', required: true }, f.product)}
      ${fieldHTML({ id: 'lic__hsCode', label: 'HS Code', required: true }, f.hsCode)}
      ${fieldHTML({ id: 'lic__itemCategory', label: 'SCOMET Category', placeholder: 'e.g. Category 3 — Electronics' }, f.itemCategory)}
      ${fieldHTML({ id: 'lic__subCategory', label: 'Sub-Category' }, f.subCategory)}
      ${fieldHTML({ id: 'lic__technicalDescription', label: 'Technical Description', full: true, type: 'textarea' }, f.technicalDescription)}
      ${fieldHTML({ id: 'lic__quantity', label: 'Quantity', type: 'number' }, f.quantity)}
      ${fieldHTML({ id: 'lic__permittedQuantity', label: 'Permitted Quantity', type: 'number' }, f.permittedQuantity)}
    </div></div>

    <div class="xd-card"><h3>Parties &amp; End Use</h3><div class="grid">
      ${fieldHTML({ id: 'lic__exporter', label: 'Exporter' }, f.exporter)}
      ${fieldHTML({ id: 'lic__consignee', label: 'Consignee' }, f.consignee)}
      ${fieldHTML({ id: 'lic__destinationCountry', label: 'Destination Country', type: 'select', options: COUNTRIES }, f.destinationCountry)}
      ${fieldHTML({ id: 'lic__endUser', label: 'End User', required: true }, f.endUser)}
      ${fieldHTML({ id: 'lic__endUse', label: 'End Use', required: true, full: true }, f.endUse)}
    </div>
    <label class="xd-check"><input type="checkbox" id="lic__endUserDeclarationOnFile" ${f.endUserDeclarationOnFile ? 'checked' : ''}> End-User Declaration / Undertaking on file</label>
    </div>

    <div class="xd-card"><h3>Conditions</h3>
      ${fieldHTML({ id: 'lic__conditions', label: '', full: true, type: 'textarea', placeholder: 'One condition per line' }, f.conditions)}
    </div>

    <div class="ferr" id="err_license"></div>
    <div class="actions">
      <button class="btn-ghost" onclick="openPrintPreview('EXPORT_LICENSE', '${doc.id}')">🖨 Preview / Print</button>
      <button class="btn-ghost" onclick="saveLicenseDraft()">Save Draft</button>
      <button class="next" onclick="markLicenseReady()">Mark Ready</button>
    </div>
  </div>`;
}

function syncLicenseFieldsFromDOM(doc) {
  const host = $('#screen-exportLicense');
  const f = doc.fields;
  const g = (id) => { const n = $('#' + id, host); return n ? n.value : ''; };
  if (!host || !$('#lic__licenseType', host)) return;
  f.licenseType = g('lic__licenseType'); f.licenseReference = g('lic__licenseReference'); f.applicationDate = g('lic__applicationDate'); f.issueDate = g('lic__issueDate'); f.expiryDate = g('lic__expiryDate'); f.issuingAuthority = g('lic__issuingAuthority'); f.status = g('lic__status');
  f.product = g('lic__product'); f.hsCode = g('lic__hsCode'); f.itemCategory = g('lic__itemCategory'); f.subCategory = g('lic__subCategory'); f.technicalDescription = g('lic__technicalDescription'); f.quantity = g('lic__quantity'); f.permittedQuantity = g('lic__permittedQuantity');
  f.exporter = g('lic__exporter'); f.consignee = g('lic__consignee'); f.destinationCountry = g('lic__destinationCountry'); f.endUser = g('lic__endUser'); f.endUse = g('lic__endUse');
  f.endUserDeclarationOnFile = $('#lic__endUserDeclarationOnFile', host).checked;
  f.conditions = g('lic__conditions');
}

function persistLicenseEdit(doc, makeReady) {
  syncLicenseFieldsFromDOM(doc);
  if (doc.status === 'READY') {
    doc.status = 'SUPERSEDED';
    const newDoc = { id: newId('XDOC-LIC'), exportJobId: doc.exportJobId, type: 'EXPORT_LICENSE', version: doc.version + 1, status: makeReady ? 'READY' : 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: JSON.parse(JSON.stringify(doc.fields)) };
    STATE.exportDocs.push(newDoc);
    CURRENT_LICENSE_ID = newDoc.id;
    saveState();
    return newDoc;
  }
  doc.status = makeReady ? 'READY' : 'DRAFT';
  doc.updatedAt = Date.now();
  saveState();
  return doc;
}

function saveLicenseDraft() { const doc = getExportDoc(CURRENT_LICENSE_ID); persistLicenseEdit(doc, false); toast('Draft saved.', 'success'); renderExportLicense(); }

function markLicenseReady() {
  const doc = getExportDoc(CURRENT_LICENSE_ID);
  const host = $('#screen-exportLicense');
  clearFieldErrors(host);
  syncLicenseFieldsFromDOM(doc);
  const errs = [];
  if (!doc.fields.product) errs.push('Product is required');
  if (!doc.fields.hsCode) errs.push('HS Code is required');
  if (!doc.fields.endUser) errs.push('End User is required');
  if (!doc.fields.endUse) errs.push('End Use is required');
  if (errs.length) { showFieldError(host, 'license', errs.join(' · ')); toast('Fix the highlighted issues before marking Ready.', 'error'); return; }
  const readyDoc = persistLicenseEdit(doc, true);
  toast('Export License / SCOMET marked Ready.', 'success');
  xdCheckBridgeCompletion('EXPORT_LICENSE', readyDoc.id, 'Export License / SCOMET');
  navToExportJobDetail(doc.exportJobId);
}
