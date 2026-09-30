/* ============================================================
   CONSIGNIA DESK — Commodity-Specific Certificates
   ------------------------------------------------------------
   One config-driven workstation engine handles all six
   commodity-specific documents (Section 19). Each has its own
   real field set — not a shared generic form — but shares the
   render/save/version machinery so behavior stays consistent.
   ============================================================ */

const COMMODITY_CERT_FIELD_DEFS = {
  PHYTOSANITARY_CERTIFICATE: [
    { key: 'certificateNumber', label: 'Certificate Number', required: true },
    { key: 'issueDate', label: 'Issue Date', type: 'date' },
    { key: 'issuingAuthority', label: 'Issuing Authority', placeholder: 'e.g. Plant Quarantine Authority' },
    { key: 'exporter', label: 'Exporter' }, { key: 'consignee', label: 'Consignee' },
    { key: 'countryOfOrigin', label: 'Country of Origin', type: 'select', options: COUNTRIES },
    { key: 'countryOfDestination', label: 'Country of Destination', type: 'select', options: COUNTRIES },
    { key: 'botanicalName', label: 'Botanical Name / Plant Product', required: true, full: true },
    { key: 'quantityDeclared', label: 'Quantity Declared' },
    { key: 'distinguishingMarks', label: 'Distinguishing Marks' },
    { key: 'treatmentDetails', label: 'Treatment Details (fumigation/cold treatment etc.)', full: true, type: 'textarea' },
    { key: 'additionalDeclaration', label: 'Additional Declaration', full: true, type: 'textarea' }
  ],
  HEALTH_CERTIFICATE: [
    { key: 'certificateNumber', label: 'Certificate Number', required: true },
    { key: 'issueDate', label: 'Issue Date', type: 'date' }, { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
    { key: 'issuingAuthority', label: 'Issuing Authority', placeholder: 'e.g. Export Inspection Council / FSSAI' },
    { key: 'exporter', label: 'Exporter' }, { key: 'consignee', label: 'Consignee' },
    { key: 'productDescription', label: 'Product Description', required: true, full: true },
    { key: 'countryOfOrigin', label: 'Country of Origin', type: 'select', options: COUNTRIES },
    { key: 'countryOfDestination', label: 'Country of Destination', type: 'select', options: COUNTRIES },
    { key: 'manufacturingPlantApprovalNo', label: 'Manufacturing Plant Approval No.' },
    { key: 'batchNumber', label: 'Batch Number' },
    { key: 'healthAttestation', label: 'Health Attestation', full: true, type: 'textarea', placeholder: 'e.g. fit for human consumption, free from specified pathogens' }
  ],
  FUMIGATION_CERTIFICATE: [
    { key: 'certificateNumber', label: 'Certificate Number', required: true },
    { key: 'treatmentDate', label: 'Treatment Date', required: true, type: 'date' },
    { key: 'fumigant', label: 'Fumigant Used', placeholder: 'e.g. Methyl Bromide, Aluminium Phosphide' },
    { key: 'dosage', label: 'Dosage' }, { key: 'exposureTime', label: 'Exposure Time (hours)', type: 'number' },
    { key: 'temperature', label: 'Temperature (°C)', type: 'number' },
    { key: 'treatmentProvider', label: 'Treatment Provider' }, { key: 'placeOfTreatment', label: 'Place of Treatment' },
    { key: 'commodity', label: 'Commodity Treated', full: true },
    { key: 'containerVesselDetails', label: 'Container / Vessel Details' }
  ],
  CATCH_CERTIFICATE: [
    { key: 'certificateNumber', label: 'Certificate Number', required: true },
    { key: 'issueDate', label: 'Issue Date', type: 'date' },
    { key: 'issuingAuthority', label: 'Issuing Authority', placeholder: 'e.g. MPEDA / Marine Products Export Authority' },
    { key: 'vesselName', label: 'Fishing Vessel Name', required: true }, { key: 'vesselRegistrationNo', label: 'Vessel Registration No.' },
    { key: 'fishingZone', label: 'Fishing Zone' }, { key: 'catchDate', label: 'Catch Date', type: 'date' },
    { key: 'speciesCaught', label: 'Species Caught', required: true, full: true },
    { key: 'exporter', label: 'Exporter' }, { key: 'consignee', label: 'Consignee' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'processingPlantApprovalNo', label: 'Processing Plant Approval No.' }
  ],
  HACCP_CERTIFICATE: [
    { key: 'certificateNumber', label: 'Certificate Number', required: true },
    { key: 'issueDate', label: 'Issue Date', type: 'date' }, { key: 'validUntil', label: 'Valid Until', type: 'date' },
    { key: 'issuingAuthority', label: 'Certifying Body' },
    { key: 'facilityName', label: 'Facility Name', required: true, full: true },
    { key: 'facilityApprovalNo', label: 'Facility Approval Number' },
    { key: 'scopeOfCertification', label: 'Scope of Certification', full: true, type: 'textarea' }
  ],
  DG_DECLARATION: [
    { key: 'unNumber', label: 'UN Number', required: true, placeholder: 'e.g. UN1993' },
    { key: 'properShippingName', label: 'Proper Shipping Name', required: true, full: true },
    { key: 'hazardClass', label: 'Hazard Class', required: true, placeholder: 'e.g. Class 3' },
    { key: 'packingGroup', label: 'Packing Group', type: 'select', options: ['I', 'II', 'III'] },
    { key: 'flashPoint', label: 'Flash Point (°C)' },
    { key: 'quantity', label: 'Quantity', type: 'number' }, { key: 'packageType', label: 'Package Type', type: 'select', options: PACKAGE_TYPES },
    { key: 'containerVesselDetails', label: 'Container / Vessel Details' },
    { key: 'emergencyContact', label: 'Emergency Contact', required: true },
    { key: 'shipperDeclaration', label: 'Shipper\u2019s Declaration Text', full: true, type: 'textarea', placeholder: 'e.g. "I hereby declare that the contents of this consignment are fully and accurately described..."' }
  ]
};

function blankCommodityCertFields(type) {
  const f = {};
  COMMODITY_CERT_FIELD_DEFS[type].forEach(d => f[d.key] = '');
  return f;
}

function openCommodityCertWorkstation(type, jobId) {
  let doc = currentDocOfType(jobId, type);
  if (!doc) {
    doc = { id: newId('XDOC-CC'), exportJobId: jobId, type, version: 1, status: 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: blankCommodityCertFields(type) };
    STATE.exportDocs.push(doc);
    saveState();
  }
  CURRENT_COMMODITY_CERT_ID = doc.id;
  CURRENT_EXPORT_JOB_ID = jobId;
  navTo('exportCommodityCert');
}
var CURRENT_COMMODITY_CERT_ID = null;

function renderExportCommodityCert() {
  const doc = getExportDoc(CURRENT_COMMODITY_CERT_ID);
  const host = $('#screen-exportCommodityCert');
  if (!doc) { host.innerHTML = '<div class="xd-root"><p class="hint">Certificate not found.</p></div>'; return; }
  const label = EXPORT_DOC_CATALOG[doc.type].label;
  const defs = COMMODITY_CERT_FIELD_DEFS[doc.type];
  const f = doc.fields;
  const versions = docVersionsOfType(doc.exportJobId, doc.type);

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / ${esc(doc.exportJobId)} / <b>${esc(label)}</b></div>
      <h1>${esc(label)} <span class="badge ${XD_DOC_STATUS_BADGE[doc.status]}">${esc(doc.status)}</span> <span class="hint">v${doc.version}${versions.length > 1 ? ' of ' + versions.length : ''}</span></h1></div>
      <button class="btn-ghost" onclick="navToExportJobDetail('${doc.exportJobId}')">Back to Export Job</button>
    </div>
    <div class="xd-card"><h3>Certificate Details</h3><div class="grid">
      ${defs.map(d => fieldHTML({ id: 'cc__' + d.key, label: d.label, required: d.required, full: d.full, type: d.type, options: d.options, placeholder: d.placeholder }, f[d.key])).join('')}
    </div></div>
    <div class="ferr" id="err_commodityCert"></div>
    <div class="actions">
      <button class="btn-ghost" onclick="openPrintPreview('${doc.type}', '${doc.id}')">🖨 Preview / Print</button>
      <button class="btn-ghost" onclick="saveCommodityCertDraft()">Save Draft</button>
      <button class="next" onclick="markCommodityCertReady()">Mark Ready</button>
    </div>
  </div>`;
}

function syncCommodityCertFieldsFromDOM(doc) {
  const host = $('#screen-exportCommodityCert');
  if (!host || !$('#cc__' + COMMODITY_CERT_FIELD_DEFS[doc.type][0].key, host)) return;
  COMMODITY_CERT_FIELD_DEFS[doc.type].forEach(d => { const n = $('#cc__' + d.key, host); if (n) doc.fields[d.key] = n.value; });
}

function persistCommodityCertEdit(doc, makeReady) {
  syncCommodityCertFieldsFromDOM(doc);
  if (doc.status === 'READY') {
    doc.status = 'SUPERSEDED';
    const newDoc = { id: newId('XDOC-CC'), exportJobId: doc.exportJobId, type: doc.type, version: doc.version + 1, status: makeReady ? 'READY' : 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: JSON.parse(JSON.stringify(doc.fields)) };
    STATE.exportDocs.push(newDoc);
    CURRENT_COMMODITY_CERT_ID = newDoc.id;
    saveState();
    return newDoc;
  }
  doc.status = makeReady ? 'READY' : 'DRAFT';
  doc.updatedAt = Date.now();
  saveState();
  return doc;
}

function saveCommodityCertDraft() {
  const doc = getExportDoc(CURRENT_COMMODITY_CERT_ID);
  persistCommodityCertEdit(doc, false);
  toast(EXPORT_DOC_CATALOG[doc.type].label + ' draft saved.', 'success');
  renderExportCommodityCert();
}

function markCommodityCertReady() {
  const doc = getExportDoc(CURRENT_COMMODITY_CERT_ID);
  const host = $('#screen-exportCommodityCert');
  clearFieldErrors(host);
  syncCommodityCertFieldsFromDOM(doc);
  const defs = COMMODITY_CERT_FIELD_DEFS[doc.type];
  const missing = defs.filter(d => d.required && !doc.fields[d.key]);
  if (missing.length) {
    showFieldError(host, 'commodityCert', `Please complete: ${missing.map(d => d.label).join(', ')}`);
    toast('Fix the highlighted issues before marking Ready.', 'error');
    return;
  }
  const readyDoc = persistCommodityCertEdit(doc, true);
  toast(EXPORT_DOC_CATALOG[doc.type].label + ' marked Ready.', 'success');
  xdCheckBridgeCompletion(doc.type, readyDoc.id, EXPORT_DOC_CATALOG[doc.type].label);
  navToExportJobDetail(doc.exportJobId);
}
