/* ============================================================
   ICEGATE TRAINING SIMULATOR — FILING WIZARD ENGINE
   Shared by Shipping Bill (export) and Bill of Entry (import).
   ============================================================ */

function exportStepDefs() {
  return [
    { key: 'party', title: 'Exporter Details', fields: [
      { key: 'exporterName', label: 'Exporter Name', required: true },
      { key: 'iec', label: 'IEC', required: true, placeholder: '10 alphanumeric characters' },
      { key: 'gstin', label: 'GSTIN', required: true, placeholder: '27AAACR5055K1Z8' },
      { key: 'pan', label: 'PAN', required: true, placeholder: 'AAACR5055K' },
      { key: 'address', label: 'Address', required: true, full: true },
      { key: 'contact', label: 'Contact Number', required: true },
      { key: 'authorizedPerson', label: 'Authorized Person', required: true }
    ]},
    { key: 'counterparty', title: 'Consignee Details', fields: [
      { key: 'consigneeName', label: 'Consignee / Buyer Name', required: true },
      { key: 'address', label: 'Address', required: true, full: true, id2: 'address2' },
      { key: 'country', label: 'Country', required: true, type: 'select', options: COUNTRIES },
      { key: 'port', label: 'Port of Destination', required: true, type: 'select', options: FOREIGN_PORTS },
      { key: 'contact', label: 'Contact', required: true, id2: 'contact2' }
    ]},
    { key: 'shipment', title: 'Shipment Details', fields: [
      { key: 'portOfLoading', label: 'Port of Loading', required: true, type: 'select', options: INDIAN_PORTS },
      { key: 'portOfDischarge', label: 'Port of Discharge', required: true, type: 'select', options: FOREIGN_PORTS },
      { key: 'countryOfDestination', label: 'Country of Destination', required: true, type: 'select', options: COUNTRIES },
      { key: 'modeOfTransport', label: 'Mode of Transport', required: true, type: 'select', options: MODES_OF_TRANSPORT },
      { key: 'vesselFlight', label: 'Vessel / Flight Name', required: true },
      { key: 'voyageFlight', label: 'Voyage / Flight Number', required: true },
      { key: 'shipmentRef', label: 'Shipment Reference', required: true }
    ]},
    { key: 'invoice', title: 'Invoice Details', fields: [
      { key: 'invoiceNo', label: 'Invoice Number', required: true },
      { key: 'invoiceDate', label: 'Invoice Date', required: true, type: 'date' },
      { key: 'currency', label: 'Currency', required: true, type: 'select', options: CURRENCIES },
      { key: 'invoiceValue', label: 'Invoice Value', required: true, type: 'number', number: true },
      { key: 'fobValue', label: 'FOB Value', required: true, type: 'number', number: true },
      { key: 'freight', label: 'Freight', type: 'number', number: true },
      { key: 'insurance', label: 'Insurance', type: 'number', number: true },
      { key: 'incoterm', label: 'Incoterm', type: 'select', options: INCOTERMS },
      { key: 'paymentTerms', label: 'Payment Terms' }
    ]},
    { key: 'items', title: 'Item Details', special: 'items' },
    { key: 'packages', title: 'Package Details', fields: [
      { key: 'packageType', label: 'Package Type', required: true, type: 'select', options: PACKAGE_TYPES },
      { key: 'numberOfPackages', label: 'Number of Packages', required: true, type: 'number', number: true },
      { key: 'grossWeight', label: 'Gross Weight (KG)', required: true, type: 'number', number: true },
      { key: 'netWeight', label: 'Net Weight (KG)', required: true, type: 'number', number: true },
      { key: 'marksNumbers', label: 'Marks and Numbers', full: true }
    ]},
    { key: 'containers', title: 'Container Details', special: 'containers' },
    { key: 'documents', title: 'Supporting Documents', special: 'documents' },
    { key: 'review', title: 'Validation & Review', special: 'review' }
  ];
}

function importStepDefs() {
  return [
    { key: 'party', title: 'Importer Details', fields: [
      { key: 'importerName', label: 'Importer Name', required: true },
      { key: 'iec', label: 'IEC', required: true, placeholder: '10 alphanumeric characters' },
      { key: 'gstin', label: 'GSTIN', required: true, placeholder: '27AAACS8871L1Z2' },
      { key: 'pan', label: 'PAN', required: true, placeholder: 'AAACS8871L' },
      { key: 'address', label: 'Address', required: true, full: true },
      { key: 'contact', label: 'Contact Number', required: true },
      { key: 'authorizedPerson', label: 'Authorized Person', required: true }
    ]},
    { key: 'counterparty', title: 'Supplier Details', fields: [
      { key: 'supplierName', label: 'Supplier Name', required: true },
      { key: 'address', label: 'Address', required: true, full: true, id2: 'address2' },
      { key: 'country', label: 'Country', required: true, type: 'select', options: COUNTRIES },
      { key: 'contact', label: 'Contact', required: true, id2: 'contact2' }
    ]},
    { key: 'shipment', title: 'Shipment Details', fields: [
      { key: 'portOfLoading', label: 'Port of Loading (Foreign)', required: true, type: 'select', options: FOREIGN_PORTS },
      { key: 'portOfDischarge', label: 'Port of Discharge (India)', required: true, type: 'select', options: INDIAN_PORTS },
      { key: 'countryOfOrigin', label: 'Country of Origin', required: true, type: 'select', options: COUNTRIES },
      { key: 'modeOfTransport', label: 'Mode of Transport', required: true, type: 'select', options: MODES_OF_TRANSPORT },
      { key: 'vesselFlight', label: 'Vessel / Flight Name', required: true },
      { key: 'voyageFlight', label: 'Voyage / Flight Number', required: true },
      { key: 'blAwbNo', label: 'Bill of Lading / AWB Number', required: true }
    ]},
    { key: 'manifest', title: 'IGM Verification', special: 'manifest' },
    { key: 'invoice', title: 'Invoice Details', fields: [
      { key: 'invoiceNo', label: 'Invoice Number', required: true },
      { key: 'invoiceDate', label: 'Invoice Date', required: true, type: 'date' },
      { key: 'currency', label: 'Currency', required: true, type: 'select', options: CURRENCIES },
      { key: 'invoiceValue', label: 'Invoice Value (CIF)', required: true, type: 'number', number: true },
      { key: 'freight', label: 'Freight', type: 'number', number: true },
      { key: 'insurance', label: 'Insurance', type: 'number', number: true },
      { key: 'incoterm', label: 'Incoterm', type: 'select', options: INCOTERMS },
      { key: 'paymentTerms', label: 'Payment Terms' }
    ]},
    { key: 'items', title: 'Item Details', special: 'items' },
    { key: 'packages', title: 'Package Details', fields: [
      { key: 'packageType', label: 'Package Type', required: true, type: 'select', options: PACKAGE_TYPES },
      { key: 'numberOfPackages', label: 'Number of Packages', required: true, type: 'number', number: true },
      { key: 'grossWeight', label: 'Gross Weight (KG)', required: true, type: 'number', number: true },
      { key: 'netWeight', label: 'Net Weight (KG)', required: true, type: 'number', number: true },
      { key: 'marksNumbers', label: 'Marks and Numbers', full: true }
    ]},
    { key: 'documents', title: 'Supporting Documents', special: 'documents' },
    { key: 'review', title: 'Validation & Review', special: 'review' }
  ];
}

var WZ = null; // current wizard state {filing, steps, stepIndex}

function startNewFiling(type, scenario) {
  const id = type === 'export' ? newId('TRN-SB') : newId('TRN-BOE');
  const filing = {
    id, type, scenarioId: scenario ? scenario.id : null,
    status: 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(),
    party: {}, counterparty: {}, shipment: {}, invoice: {}, items: [], packages: {}, containers: [],
    documents: [], validationErrors: [], ack: null,
    examination: { required: false, location: '', date: '', result: '', remarks: '' },
    query: null,
    duty: null, payment: null, leo: null, ooc: null,
    timeline: [{ stage: 'DRAFT', ts: Date.now(), note: 'Filing created.' }],
    processingOutcome: null, amendments: [],
    /* Level 2: manifest, PGA, scheme, RMS, CHA/DSC, first/second check, CFS/DPD */
    igm: null, egm: null, pga: [], riskAssessment: null,
    scheme: null, checkType: type === 'import' ? CHECK_TYPES[0] : null, cfsRoute: 'CFS', ftaClaim: null,
    dsc: null, brokerClientIec: null, poaRef: null, cfsGateIn: null
  };
  /* Section 31/39 (merged from the parallel FINAL hardening pass): scenario data is
     deliberately NOT auto-filled into the form. Every field starts blank — the scenario is
     shown as a reference brief instead (see scenarioBriefHTML) so the student types every
     value in themselves, which is the actual data-entry practice the simulator is for. The
     scenario ID stays attached to the filing so query/examination/discrepancy triggers still
     fire as designed — that logic never inspects what was actually typed. */
  STATE.filings.unshift(filing);
  saveState();
  return filing;
}

function scenarioBriefHTML(filing) {
  if (!filing.scenarioId) return '';
  const sc = SCENARIOS.find(s => s.id === filing.scenarioId);
  if (!sc || !sc.prefill) return '';
  const p = sc.prefill;
  return `<div class="wz-card" id="scenarioBriefCard">
    <h3>📋 Client Brief — ${esc(sc.title)} <button class="btn-ghost sm" style="float:right" onclick="toggleScenarioBrief()">Show / Hide Reference Data</button></h3>
    <p class="hint">${esc(sc.desc)}</p>
    <div id="scenarioBriefBody" style="display:none">
      <p class="hint"><b>This is reference information only — nothing is auto-filled.</b> Type the values below into the matching fields on each step yourself, exactly like reading a client's documents on the job.</p>
      <table class="kv-table">
        ${Object.entries(p.party || {}).map(([k, v]) => `<tr><td>${esc(labelize(k))}</td><td>${esc(v)}</td></tr>`).join('')}
        ${Object.entries(p.counterparty || {}).map(([k, v]) => `<tr><td>${esc(labelize(k))}</td><td>${esc(v)}</td></tr>`).join('')}
        ${Object.entries(p.shipment || {}).map(([k, v]) => `<tr><td>${esc(labelize(k))}</td><td>${esc(v)}</td></tr>`).join('')}
        ${Object.entries(p.invoice || {}).map(([k, v]) => `<tr><td>${esc(labelize(k))}</td><td>${esc(v)}</td></tr>`).join('')}
      </table>
      <h4 style="margin-top:10px">Items</h4>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Description</th><th>HS Code</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Origin</th><th>Packages</th><th>Gross Wt</th><th>Net Wt</th></tr></thead>
      <tbody>${(p.items || []).map(it => `<tr><td>${esc(it.description)}</td><td>${esc(it.hsCode)}</td><td>${it.qty}</td><td>${esc(it.unit)}</td><td>${it.unitPrice}</td><td>${esc(it.origin)}</td><td>${it.packages}</td><td>${it.grossWeight}</td><td>${it.netWeight}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>
  </div>`;
}
function toggleScenarioBrief() {
  const b = $('#scenarioBriefBody');
  if (b) b.style.display = b.style.display === 'none' ? 'block' : 'none';
}

function openWizard(filing) {
  WZ = { filing, steps: filing.type === 'export' ? exportStepDefs() : importStepDefs(), stepIndex: 0 };
  navTo('wizard');
  renderWizard();
}

function resumeWizardFor(filingId) {
  const f = getFiling(filingId);
  if (f) openWizard(f);
}

function renderWizard() {
  const host = $('#screen-wizard');
  const { filing, steps, stepIndex } = WZ;
  const isExport = filing.type === 'export';
  host.innerHTML = `
    <div class="page-head">
      <div>
        <div class="crumb">${isExport ? 'Electronic Filing' : 'Electronic Filing'} / ${isExport ? 'Shipping Bill' : 'Bill of Entry'} / <b>${esc(filing.id)}</b></div>
        <h1>${isExport ? 'Shipping Bill Filing' : 'Bill of Entry Filing'} <span class="badge ${STATUS_BADGE_CLASS[filing.status]}">${STATUS_LABELS[filing.status]}</span></h1>
      </div>
      <button class="btn-ghost" onclick="saveDraftAndExit()">Save Draft &amp; Exit</button>
    </div>
    <div class="stepper" id="wzStepper"></div>
    <div class="wz-pane" id="wzPane"></div>
  `;
  const stepper = $('#wzStepper');
  stepper.innerHTML = steps.map((s, i) => `<div class="step ${i === stepIndex ? 'on' : ''} ${i < stepIndex ? 'done' : ''}" data-i="${i}"><i>${i < stepIndex ? '✓' : i + 1}</i>${esc(s.title)}</div>`).join('');
  $all('.step', stepper).forEach(s => s.addEventListener('click', () => { WZ.stepIndex = Number(s.dataset.i); renderWizard(); }));
  renderWizardPane();
}

function renderWizardPane() {
  const { filing, steps, stepIndex } = WZ;
  const step = steps[stepIndex];
  const pane = $('#wzPane');
  let bodyHTML = '';
  if (step.special === 'items') bodyHTML = itemsStepHTML(filing);
  else if (step.special === 'containers') bodyHTML = containersStepHTML(filing);
  else if (step.special === 'documents') bodyHTML = documentsStepHTML(filing);
  else if (step.special === 'manifest') bodyHTML = manifestStepHTML(filing);
  else if (step.special === 'review') bodyHTML = reviewStepHTML(filing);
  else {
    let brokerBlock = '';
    if (step.key === 'party' && STATE.user.profile.role === 'Customs Broker') {
      const clients = DEMO_CLIENTS.filter(c => c.type === filing.type);
      brokerBlock = `<div class="alert alert-amber" style="margin-bottom:14px">Filing as Customs Broker under Power of Attorney. Select the client IEC holder you are filing on behalf of.</div>
      <div class="field full"><label>Filing on Behalf of (Client) *</label>
        <select id="brokerClientSelect">
          <option value="">Select client…</option>
          ${clients.map(c => `<option value="${esc(c.iec)}" ${filing.brokerClientIec === c.iec ? 'selected' : ''}>${esc(c.name)} — IEC ${esc(c.iec)}</option>`).join('')}
        </select>
        ${filing.poaRef ? `<div class="hint">Power of Attorney Reference: ${esc(filing.poaRef)}</div>` : ''}
      </div>`;
    }
    bodyHTML = brokerBlock + `<div class="grid">${step.fields.map(f => fieldHTML({ id: (f.id2 || step.key + '__' + f.key), label: f.label, required: f.required, type: f.type, options: f.options, full: f.full, placeholder: f.placeholder }, filing[step.key][f.key])).join('')}</div>`;
  }

  pane.innerHTML = `${scenarioBriefHTML(filing)}<div class="wz-card"><h3>${esc(step.title)}</h3>${bodyHTML}
    <div class="actions">
      ${stepIndex > 0 ? '<button class="back2" onclick="wzPrev()">Back</button>' : ''}
      <button class="btn-ghost" onclick="wzSaveDraft()">Save Draft</button>
      ${stepIndex < steps.length - 1 ? '<button class="next" onclick="wzNext()">Next</button>' : ''}
    </div>
  </div>`;

  if (step.special === 'items') wireItemsStep(filing);
  if (step.special === 'containers') wireContainersStep(filing);
  if (step.special === 'documents') wireDocumentsStep(filing);
  if (step.special === 'manifest') wireManifestStep(filing);
  if (step.special === 'review') wireReviewStep(filing);
  const brokerSelect = $('#brokerClientSelect');
  if (brokerSelect) brokerSelect.addEventListener('change', () => {
    if (!hasPermission('broker_client_select')) { toast('Only Customs Broker accounts can file on behalf of a client.', 'error'); return; }
    const client = DEMO_CLIENTS.find(c => c.iec === brokerSelect.value);
    if (client) {
      filing.brokerClientIec = client.iec;
      filing.poaRef = client.poaRef;
      if (filing.type === 'export') filing.party.exporterName = client.name.replace(' (Exporter)', '');
      else filing.party.importerName = client.name.replace(' (Importer)', '');
      filing.party.iec = client.iec; filing.party.gstin = client.gstin; filing.party.pan = client.pan;
      saveState();
      renderWizardPane();
    }
  });
}

function syncCurrentStepFields() {
  const { filing, steps, stepIndex } = WZ;
  const step = steps[stepIndex];
  if (step.fields) {
    step.fields.forEach(f => {
      const id = f.id2 || step.key + '__' + f.key;
      const node = $('#' + id);
      if (!node) return;
      let v = node.value;
      if (f.number) v = v === '' ? '' : Number(v);
      filing[step.key][f.key] = v;
    });
  }
  filing.updatedAt = Date.now();
}

function wzNext() {
  syncCurrentStepFields();
  const { filing, steps, stepIndex } = WZ;
  const step = steps[stepIndex];
  const validator = STEP_VALIDATORS[step.key];
  if (validator) {
    const errs = validator(filing);
    if (errs.length) {
      toast(errs[0].message, 'error');
      showStepErrors(errs);
      saveState();
      return;
    }
  }
  saveState();
  if (stepIndex < steps.length - 1) { WZ.stepIndex++; renderWizard(); }
}
function wzPrev() { syncCurrentStepFields(); saveState(); WZ.stepIndex--; renderWizard(); }
function wzSaveDraft() { syncCurrentStepFields(); saveState(); toast('Draft saved.', 'success'); }
function saveDraftAndExit() { syncCurrentStepFields(); saveState(); toast('Draft saved.', 'success'); navTo('dashboard'); }

function showStepErrors(errs) {
  const pane = $('#wzPane');
  errs.forEach(e => {
    const fid = WZ.steps[WZ.stepIndex].key + '__' + e.field;
    showFieldError(pane, e.field === 'address2' || e.field === 'contact2' ? e.field : fid, e.message);
  });
}

/* ---------------- ITEMS STEP ---------------- */
function itemsStepHTML(filing) {
  const rows = filing.items.map((it, i) => itemRowHTML(it, i)).join('');
  const sum = filing.items.reduce((s, it) => s + num(it.qty) * num(it.unitPrice), 0);
  return `<div class="table-wrap">
    <table class="data-table items-table">
      <thead><tr><th>#</th><th>Description</th><th>HS Code</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th><th>Origin</th><th>Pkgs</th><th>G.Wt</th><th>N.Wt</th><th></th></tr></thead>
      <tbody id="itemsBody">${rows}</tbody>
    </table>
  </div>
  <button class="btn-ghost" id="addItemBtn" type="button">+ Add Item</button>
  <div class="hint">Declared invoice value: <b>${fmtMoney(filing.invoice.invoiceValue, filing.invoice.currency)}</b> &nbsp;|&nbsp; Sum of item totals: <b id="itemSumDisplay">${fmtMoney(sum, filing.invoice.currency)}</b></div>
  <div class="ferr" id="err_items"></div>`;
}
function itemRowHTML(it, i) {
  const hsOptions = Object.keys(HS_CODE_TABLE).map(c => `<option value="${c}" ${it.hsCode === c ? 'selected' : ''}>${c} — ${HS_CODE_TABLE[c].desc}</option>`).join('');
  return `<tr data-i="${i}">
    <td>${i + 1}</td>
    <td><input class="cell" data-k="description" value="${esc(it.description || '')}" style="min-width:170px"></td>
    <td><select class="cell" data-k="hsCode" style="min-width:110px"><option value="">Select…</option>${hsOptions}</select></td>
    <td><input class="cell" data-k="qty" type="number" value="${it.qty || ''}" style="width:70px"></td>
    <td><select class="cell" data-k="unit">${UNITS.map(u => `<option ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
    <td><input class="cell" data-k="unitPrice" type="number" value="${it.unitPrice || ''}" style="width:85px"></td>
    <td class="cell-total">${fmtMoney(num(it.qty) * num(it.unitPrice))}</td>
    <td><input class="cell" data-k="origin" value="${esc(it.origin || '')}" style="width:90px"></td>
    <td><input class="cell" data-k="packages" type="number" value="${it.packages || ''}" style="width:60px"></td>
    <td><input class="cell" data-k="grossWeight" type="number" value="${it.grossWeight || ''}" style="width:75px"></td>
    <td><input class="cell" data-k="netWeight" type="number" value="${it.netWeight || ''}" style="width:75px"></td>
    <td><button class="row-del" title="Remove item" type="button">✕</button></td>
  </tr>`;
}
function wireItemsStep(filing) {
  const body = $('#itemsBody');
  function refreshRow(tr, i) {
    const it = filing.items[i];
    $all('.cell', tr).forEach(c => {
      const k = c.dataset.k;
      it[k] = (c.tagName === 'SELECT' || c.type === 'text') ? c.value : (c.value === '' ? '' : Number(c.value));
    });
    it.totalValue = num(it.qty) * num(it.unitPrice);
    tr.querySelector('.cell-total').textContent = fmtMoney(it.totalValue);
    const sum = filing.items.reduce((s, x) => s + num(x.qty) * num(x.unitPrice), 0);
    $('#itemSumDisplay').textContent = fmtMoney(sum, filing.invoice.currency);
    saveState();
  }
  $all('tr', body).forEach((tr, i) => {
    tr.addEventListener('input', () => refreshRow(tr, i));
    tr.querySelector('.row-del').addEventListener('click', () => { filing.items.splice(i, 1); saveState(); renderWizardPane(); });
  });
  $('#addItemBtn').addEventListener('click', () => {
    filing.items.push({ id: 'IT' + Date.now(), description: '', hsCode: '', qty: '', unit: 'PCS', unitPrice: '', totalValue: 0, origin: 'India', packages: '', grossWeight: '', netWeight: '' });
    saveState(); renderWizardPane();
  });
}

/* ---------------- CONTAINERS STEP ---------------- */
function containersStepHTML(filing) {
  if (filing.shipment.modeOfTransport && filing.shipment.modeOfTransport !== 'Sea') {
    return `<p class="hint">Container details are not applicable for ${esc(filing.shipment.modeOfTransport)} shipments. You may proceed to the next step.</p>`;
  }
  const rows = (filing.containers || []).map((c, i) => `<tr data-i="${i}">
    <td>${i + 1}</td>
    <td><input class="cell" data-k="containerNo" value="${esc(c.containerNo || '')}" placeholder="MSCU1234567"></td>
    <td><select class="cell" data-k="containerType">${CONTAINER_TYPES.map(t => `<option ${c.containerType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
    <td><input class="cell" data-k="sealNo" value="${esc(c.sealNo || '')}"></td>
    <td><input class="cell" data-k="grossWeight" type="number" value="${c.grossWeight || ''}" style="width:90px"></td>
    <td><button class="row-del" type="button">✕</button></td>
  </tr>`).join('');
  return `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>#</th><th>Container No.</th><th>Type</th><th>Seal No.</th><th>Gross Wt (KG)</th><th></th></tr></thead>
    <tbody id="contBody">${rows}</tbody></table></div>
    <button class="btn-ghost" id="addContBtn" type="button">+ Add Container</button>
    <div class="ferr" id="err_containers"></div>`;
}
function wireContainersStep(filing) {
  const body = $('#contBody');
  if (!body) return;
  $all('tr', body).forEach((tr, i) => {
    tr.addEventListener('input', () => {
      const c = filing.containers[i];
      $all('.cell', tr).forEach(cell => { c[cell.dataset.k] = cell.dataset.k === 'grossWeight' ? Number(cell.value || 0) : cell.value; });
      saveState();
    });
    tr.querySelector('.row-del').addEventListener('click', () => { filing.containers.splice(i, 1); saveState(); renderWizardPane(); });
  });
  const addBtn = $('#addContBtn');
  if (addBtn) addBtn.addEventListener('click', () => {
    filing.containers = filing.containers || [];
    filing.containers.push({ containerNo: '', containerType: CONTAINER_TYPES[0], sealNo: '', grossWeight: '' });
    saveState(); renderWizardPane();
  });
}

/* ---------------- DOCUMENTS STEP (e-Sanchit style) ---------------- */
function documentsStepHTML(filing) {
  const types = filing.type === 'export' ? DOCUMENT_TYPES_EXPORT : DOCUMENT_TYPES_IMPORT;
  const required = filing.type === 'export' ? ['Commercial Invoice', 'Packing List'] : ['Bill of Lading / Air Waybill', 'Commercial Invoice', 'Packing List'];
  const rows = types.map(t => {
    const doc = (filing.documents || []).find(d => d.type === t);
    return esanchitRowHTML(t, doc, required.includes(t));
  }).join('');
  return `<p class="hint">Upload and attach the following supporting documents via the e-Sanchit training module. Required documents are marked with *.</p>
  <div class="table-wrap"><table class="data-table doc-table">
  <thead><tr><th>Document Type</th><th>File</th><th>Status</th><th>Reference No.</th><th>Action</th></tr></thead>
  <tbody id="docBody">${rows}</tbody></table></div>
  <div class="ferr" id="err_documents"></div>`;
}
function esanchitRowHTML(type, doc, required) {
  const status = doc ? doc.status : 'NOT UPLOADED';
  const cls = { 'NOT UPLOADED': 'badge-grey', 'UPLOADING': 'badge-amber', 'VALIDATING': 'badge-amber', 'VALIDATED': 'badge-blue', 'ATTACHED TO FILING': 'badge-green' }[status];
  return `<tr data-type="${esc(type)}">
    <td>${esc(type)}${required ? ' <span class="req">*</span>' : ''}</td>
    <td>${doc ? esc(doc.fileName) : '<input type="file" class="fileInput">'}</td>
    <td><span class="badge ${cls}">${status}</span></td>
    <td>${doc && doc.refNo ? esc(doc.refNo) : '—'}</td>
    <td>${docActionHTML(type, doc)}</td>
  </tr>`;
}
function docActionHTML(type, doc) {
  if (!doc || doc.status === 'NOT UPLOADED') return `<button class="btn-ghost sm upload-btn" type="button">Upload</button>`;
  if (doc.status === 'UPLOADING' || doc.status === 'VALIDATING') return `<span class="hint">Processing…</span>`;
  if (doc.status === 'VALIDATED') return `<button class="next sm attach-btn" type="button">Attach to Filing</button>`;
  return `<span class="hint">Attached ✓</span> <button class="btn-ghost sm remove-btn" type="button">Remove</button>`;
}
/* Resolves any document stuck below VALIDATED whose uploadStartedAt shows enough real time has
   elapsed — computed from total elapsed time (not a per-stage timer that resets), so it correctly
   catches all the way through to VALIDATED in one pass after a long gap (e.g. a reload minutes
   later), not just one stage at a time. Safe to call repeatedly; a no-op for anything not pending. */
function resolvePendingDocuments(filing) {
  if (!filing || !filing.documents) return;
  let changed = false;
  filing.documents.forEach(d => {
    if ((d.status === 'UPLOADING' || d.status === 'VALIDATING') && d.uploadStartedAt) {
      const elapsed = Date.now() - d.uploadStartedAt;
      if (elapsed >= 1600) {
        d.status = 'VALIDATED';
        d.refNo = uniqueId('ESANCHIT', () => 'ESANCHIT-' + Math.floor(100000 + Math.random() * 900000));
        delete d.uploadStartedAt;
        changed = true;
      } else if (elapsed >= 700 && d.status === 'UPLOADING') {
        d.status = 'VALIDATING';
        changed = true;
      }
    }
  });
  if (changed) {
    saveState();
    if (WZ && WZ.filing && WZ.filing.id === filing.id && WZ.steps[WZ.stepIndex].special === 'documents') renderWizardPane();
  }
  const stillPending = filing.documents.some(d => (d.status === 'UPLOADING' || d.status === 'VALIDATING') && d.uploadStartedAt);
  if (stillPending) setTimeout(() => resolvePendingDocuments(filing), 250);
}

function wireDocumentsStep(filing) {
  resolvePendingDocuments(filing);
  filing.documents = filing.documents || [];
  const body = $('#docBody');
  $all('tr', body).forEach(tr => {
    const type = tr.dataset.type;
    const fileInput = tr.querySelector('.fileInput');
    if (fileInput) fileInput.addEventListener('change', () => {
      if (!fileInput.files.length) return;
      const fileName = fileInput.files[0].name;
      let doc = filing.documents.find(d => d.type === type);
      if (!doc) { doc = { type, fileName, status: 'UPLOADING', refNo: '' }; filing.documents.push(doc); }
      else { doc.fileName = fileName; doc.status = 'UPLOADING'; }
      /* Section 39/24 fix (same class of bug as the amendment resolver): the UPLOADING ->
         VALIDATING -> VALIDATED chain used to rely purely on nested setTimeouts. A reload
         during that ~1.6s window stranded the document forever below VALIDATED — and since
         "Attach to Filing" only ever renders once a document IS VALIDATED, that could
         permanently block the whole filing from ever passing submission validation, with no
         error message explaining why. Persisting resolveAt lets resolvePendingDocuments()
         catch it up on the next render/session-restore, same fix pattern as the amendments. */
      doc.uploadStartedAt = Date.now();
      saveState(); renderWizardPane();
      setTimeout(() => resolvePendingDocuments(filing), 750);
    });
    const uploadBtn = tr.querySelector('.upload-btn');
    if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput && fileInput.click());
    const attachBtn = tr.querySelector('.attach-btn');
    if (attachBtn) attachBtn.addEventListener('click', () => {
      const d = filing.documents.find(x => x.type === type);
      if (d) { d.status = 'ATTACHED TO FILING'; saveState(); toast(type + ' attached to filing.', 'success'); renderWizardPane(); }
    });
    const removeBtn = tr.querySelector('.remove-btn');
    if (removeBtn) removeBtn.addEventListener('click', () => {
      filing.documents = filing.documents.filter(x => x.type !== type);
      saveState(); renderWizardPane();
    });
  });
}

/* ---------------- REVIEW STEP ---------------- */
function reviewStepHTML(filing) {
  const isExport = filing.type === 'export';
  return `
  <div class="review-grid">
    <div class="review-block"><h4>${isExport ? 'Exporter' : 'Importer'}</h4>${kv(filing.party)}</div>
    <div class="review-block"><h4>${isExport ? 'Consignee' : 'Supplier'}</h4>${kv(filing.counterparty)}</div>
    <div class="review-block"><h4>Shipment</h4>${kv(filing.shipment)}</div>
    <div class="review-block"><h4>Invoice</h4>${kv(filing.invoice)}</div>
  </div>
  <h4>Items</h4>
  <div class="table-wrap"><table class="data-table">
  <thead><tr><th>Description</th><th>HS Code</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th></tr></thead>
  <tbody>${filing.items.map(it => `<tr><td>${esc(it.description)}</td><td>${esc(it.hsCode)}</td><td>${it.qty}</td><td>${esc(it.unit)}</td><td>${fmtMoney(it.unitPrice)}</td><td>${fmtMoney(num(it.qty) * num(it.unitPrice))}</td></tr>`).join('')}</tbody>
  </table></div>
  <h4>Packages</h4>${kv(filing.packages)}
  <h4>Documents</h4>
  <ul class="plain-list">${(filing.documents || []).map(d => `<li>${esc(d.type)} ${ESANCHIT_CODES[d.type] ? `<span class="hint">(Doc Code: ${esc(ESANCHIT_CODES[d.type])})</span>` : ''} — <span class="badge ${STATUS_BADGE_CLASS[d.status] || 'badge-grey'}">${esc(d.status)}</span></li>`).join('') || '<li>No documents attached.</li>'}</ul>
  ${complianceBlockHTML(filing)}
  <div class="declaration">
    <label><input type="checkbox" id="declareBox"> I declare that the particulars given above are true and correct to the best of my knowledge, for training purposes.</label>
    <label style="display:block;margin-top:8px"><input type="checkbox" id="dscBox"> Sign using registered Class-3 Digital Signature Certificate</label>
  </div>
  <div id="validationResults"></div>
  <div class="actions">
    <button class="btn-ghost" onclick="wzValidateOnly()">Validate</button>
    <button class="submit" onclick="wzSubmit()">Submit Filing</button>
  </div>`;
}
function complianceBlockHTML(filing) {
  const isExport = filing.type === 'export';
  if (isExport) {
    return `<h4>Export Scheme (DGFT)</h4>
      <div class="field"><label>Claim under Scheme</label>
        <select id="schemeSelect">${EXPORT_SCHEMES.map(s => `<option ${(filing.scheme && filing.scheme.type ? filing.scheme.type === s : s === 'None') ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
      <div id="licenseBlock">${licenseBlockHTML(filing)}</div>`;
  }
  const country = filing.counterparty.country;
  const agreement = FTA_AGREEMENTS.find(a => a.partnerCountries.includes(country));
  const hasCOO = (filing.documents || []).some(d => d.type === 'Certificate of Origin' && d.status === 'ATTACHED TO FILING');
  return `<h4>Assessment Options</h4>
    <div class="grid">
      <div class="field"><label>Examination Preference</label><select id="checkTypeSelect">${CHECK_TYPES.map(c => `<option ${filing.checkType === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="field"><label>Cargo Release Route</label>
        <select id="cfsRouteSelect" ${STATE.riskProfile.aeo ? '' : 'disabled'}>
          <option value="CFS" ${filing.cfsRoute !== 'DPD' ? 'selected' : ''}>CFS (Container Freight Station)</option>
          <option value="DPD" ${filing.cfsRoute === 'DPD' ? 'selected' : ''}>DPD (Direct Port Delivery)</option>
        </select>
        ${STATE.riskProfile.aeo ? '' : '<div class="hint">DPD requires AEO accreditation — enable it in Settings to unlock.</div>'}
      </div>
    </div>
    ${agreement ? `<label class="chk" style="margin-top:10px"><input type="checkbox" id="ftaClaimBox" ${filing.ftaClaim ? 'checked' : ''} ${hasCOO ? '' : 'disabled'}> Claim preferential rate under ${esc(agreement.name)}${hasCOO ? '' : ' (requires an attached Certificate of Origin)'}</label>` : ''}`;
}
function licenseBlockHTML(filing) {
  const scheme = filing.scheme ? filing.scheme.type : 'None';
  if (scheme !== 'Advance Authorization' && scheme.indexOf('EPCG') !== 0) return '';
  const licenses = STATE.licenses.filter(l => l.iec === filing.party.iec && l.type === scheme);
  return `<div class="field full"><label>License / Scrip Number</label>
    <select id="licenseSelect">
      <option value="">Select license…</option>
      ${licenses.map(l => `<option value="${esc(l.licenseNo)}" ${filing.scheme && filing.scheme.licenseNo === l.licenseNo ? 'selected' : ''}>${esc(l.licenseNo)} — EO Balance Remaining: ₹${l.balance.toLocaleString('en-IN')} of ₹${l.exportObligationValue.toLocaleString('en-IN')}</option>`).join('')}
    </select>
    ${!licenses.length ? '<div class="hint">No matching license found for this IEC under DGFT — cannot claim this scheme.</div>' : '<div class="hint">Exporting against this license reduces its remaining Export Obligation. Manage licenses and redemption under Licenses &amp; Export Obligation in the sidebar.</div>'}
  </div>`;
}
function kv(obj) {
  return `<table class="kv-table">${Object.keys(obj).map(k => `<tr><td>${esc(labelize(k))}</td><td>${esc(obj[k] === '' || obj[k] === undefined || obj[k] === null ? '—' : obj[k])}</td></tr>`).join('')}</table>`;
}
function labelize(k) { return k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()); }
function wireReviewStep(filing) {
  const schemeSelect = $('#schemeSelect');
  if (schemeSelect) {
    filing.scheme = filing.scheme || { type: schemeSelect.value, licenseNo: null };
    const wireLicenseSelect = () => {
      const sel = $('#licenseSelect');
      if (sel) sel.addEventListener('change', () => { filing.scheme.licenseNo = sel.value; saveState(); });
    };
    wireLicenseSelect();
    schemeSelect.addEventListener('change', () => {
      filing.scheme.type = schemeSelect.value;
      filing.scheme.licenseNo = null;
      $('#licenseBlock').innerHTML = licenseBlockHTML(filing);
      wireLicenseSelect();
      saveState();
    });
  }
  const checkTypeSelect = $('#checkTypeSelect');
  if (checkTypeSelect) {
    filing.checkType = filing.checkType || checkTypeSelect.value;
    checkTypeSelect.addEventListener('change', () => { filing.checkType = checkTypeSelect.value; saveState(); });
  }
  const cfsRouteSelect = $('#cfsRouteSelect');
  if (cfsRouteSelect) {
    filing.cfsRoute = STATE.riskProfile.aeo ? (filing.cfsRoute || cfsRouteSelect.value) : 'CFS';
    cfsRouteSelect.addEventListener('change', () => { filing.cfsRoute = cfsRouteSelect.value; saveState(); });
  }
  const ftaBox = $('#ftaClaimBox');
  if (ftaBox) {
    ftaBox.addEventListener('change', () => {
      if (ftaBox.checked) {
        const agreement = FTA_AGREEMENTS.find(a => a.partnerCountries.includes(filing.counterparty.country));
        filing.ftaClaim = agreement ? { code: agreement.code, name: agreement.name } : null;
      } else filing.ftaClaim = null;
      saveState();
    });
  }
}

/* ---------------- LEARNING MODE (Section 39) ---------------- */
const LEARNING_TIPS = {
  iec: { why: 'The IEC is the unique code DGFT issues to every importer/exporter — Customs cannot process a filing without a valid one linked to the party.', fix: 'Re-check the IEC on the DGFT-issued certificate and re-enter it exactly (10 alphanumeric characters).' },
  gstin: { why: 'GSTIN links the filing to the correct GST-registered entity for tax purposes.', fix: 'Re-enter the 15-character GSTIN exactly as shown on the GST registration certificate.' },
  pan: { why: 'PAN is used to validate the identity of the filing party and is embedded inside the GSTIN itself.', fix: 'Enter the 10-character PAN exactly as issued (5 letters + 4 digits + 1 letter).' },
  address: { why: 'Customs uses the declared address to verify the identity and jurisdiction of the party.', fix: 'Enter the complete registered address of the exporter/importer.' },
  contact: { why: 'A working contact number is needed so Customs or the broker can reach the party quickly if a query is raised.', fix: 'Enter a valid contact number for the authorized person.' },
  authorizedPerson: { why: 'Someone must be named as legally responsible for the accuracy of the declaration.', fix: 'Enter the name of the person authorized to sign/declare on behalf of the organization.' },
  portOfLoading: { why: 'The port of loading determines jurisdiction and which Customs house processes the filing.', fix: 'Select the correct port of loading from the standard port list.' },
  portOfDischarge: { why: 'This must be a different, valid port from the port of loading — the two cannot be the same.', fix: 'Select the correct destination port; verify it differs from the port of loading.' },
  countryOfDestination: { why: 'The destination country drives export documentation requirements (e.g. certificates of origin, FTA eligibility).', fix: 'Select the correct destination country from the list.' },
  countryOfOrigin: { why: 'Country of origin affects duty rate eligibility, especially for FTA preferential claims.', fix: 'Select the correct country of origin — this should match the supplier/manufacturing country.' },
  modeOfTransport: { why: 'Mode of transport (Sea/Air) determines which downstream fields (e.g. container details) are mandatory.', fix: 'Select Sea, Air, or the correct mode for this shipment.' },
  vesselFlight: { why: 'Customs cross-checks the declared vessel/flight against the manifest (IGM/EGM).', fix: 'Enter the correct vessel or flight name/number as per the booking confirmation.' },
  voyageFlight: { why: 'The voyage/flight number uniquely identifies this specific sailing/flight for manifest matching.', fix: 'Enter the correct voyage or flight number.' },
  blAwbNo: { why: 'The Bill of Lading/AWB number links this Bill of Entry to the carrier\'s manifest (IGM) — a mismatch causes a query.', fix: 'Enter the BL/AWB number exactly as shown on the transport document.' },
  shipmentRef: { why: 'An internal shipment reference helps track this filing through your own records.', fix: 'Enter a unique shipment reference for this export.' },
  invoiceNo: { why: 'Duplicate invoice numbers across filings usually indicate a data-entry mistake or an attempt to double-file the same shipment.', fix: 'Check whether this shipment has already been filed; if not, correct the invoice number to the genuinely unique one from the commercial invoice.' },
  invoiceValue: { why: 'Invoice value is the base figure Customs uses to compute assessable value and duty.', fix: 'Enter the actual invoice value greater than zero, matching the commercial invoice.' },
  fobValue: { why: 'FOB value excludes freight/insurance and is required to compute export benefit eligibility.', fix: 'Enter the correct FOB value greater than zero.' },
  items: { why: 'Item-level details (HS code, quantity, value, weight) must be internally consistent — Customs cross-checks these against the invoice and packing list.', fix: 'Review each item row and correct the highlighted field — recheck HS code digits, quantities, and that gross weight is not less than net weight.' },
  packageType: { why: 'Package type tells Customs and the carrier how the cargo is physically packed for handling.', fix: 'Select the correct package type (e.g. Carton, Pallet, Drum).' },
  numberOfPackages: { why: 'The declared package count must reconcile with the sum of packages across all items — a mismatch is a very common query/examination trigger.', fix: 'Recount the packages per item and make sure the total matches the declared number of packages.' },
  grossWeight: { why: 'Gross weight (cargo + packaging) can never be less than net weight (cargo alone) — that would be physically impossible.', fix: 'Re-check your weighment slip and correct gross weight so it is equal to or greater than net weight.' },
  netWeight: { why: 'Net weight is the actual cargo weight excluding packaging, used for duty calculation on a per-unit-weight basis where applicable.', fix: 'Enter the correct net weight from the packing list.' },
  containers: { why: 'Container and seal numbers on the filing must exactly match the physical container/seal, or Customs will flag it on examination.', fix: 'Double-check the container number format (4 letters + 7 digits) and ensure a seal number is entered.' },
  documents: { why: 'Supporting documents are what Customs uses to verify the declaration — a filing is incomplete without them.', fix: 'Upload/attach the missing document type listed before submitting.' },
  igm: { why: 'A Bill of Entry can only be filed against cargo the carrier has already declared on the Import General Manifest — Customs cross-checks every BOE against the IGM, and an unmatched BOE cannot be assessed.', fix: 'Go to the IGM Verification step, search the IGM register using the BL/AWB number from Shipment Details, and confirm the line matches before proceeding.' }
};
function learningTipFor(field) { return LEARNING_TIPS[field] || null; }

function wzValidateOnly() {
  const filing = WZ.filing;
  const errs = validateAll(filing);
  filing.validationErrors = errs;
  saveState();
  renderValidationResults(errs);
}
function renderValidationResults(errs) {
  const host = $('#validationResults');
  if (!host) return;
  if (!errs.length) {
    host.innerHTML = `<div class="alert alert-success">Validation passed. No errors found. This filing is ready for submission.</div>`;
  } else {
    host.innerHTML = `<div class="alert alert-error"><b>${errs.length} validation error(s) found.</b> Each one below explains why it matters and how to fix it — this is how Customs would reject or query the filing in real life.</div>
    ${errs.map(e => {
      const tip = learningTipFor(e.field);
      return `<div class="wz-card learning-card">
        <div class="learning-bad">❌ Incorrect — ${esc(e.message)}</div>
        <div class="learning-why"><b>Why?</b> ${esc(tip ? tip.why : 'This does not meet the training validation rules for this field.')}</div>
        <div class="learning-fix"><b>Correct approach:</b> ${esc(tip ? tip.fix : 'Review this field, correct the value, and re-validate.')}</div>
      </div>`;
    }).join('')}
    <button class="btn-ghost" onclick="wzValidateOnly()">[ Try Again — Re-validate ]</button>`;
  }
}
function wzSubmit() {
  const filing = WZ.filing;
  const declared = $('#declareBox');
  const dsc = $('#dscBox');
  const errs = validateAll(filing);
  filing.validationErrors = errs;
  if (errs.length) { renderValidationResults(errs); toast(`${errs.length} validation error(s) — please correct before submitting.`, 'error'); saveState(); return; }
  if (!declared || !declared.checked) { toast('Please confirm the declaration checkbox before submitting.', 'error'); return; }
  if (!dsc || !dsc.checked) { toast('Please sign using your registered Digital Signature Certificate before submitting.', 'error'); return; }
  if (STATE.user.profile.role === 'Customs Broker' && !filing.brokerClientIec) { toast('Select the client you are filing on behalf of (Exporter/Importer Details step).', 'error'); return; }
  if (filing.type === 'export' && filing.scheme && filing.scheme.type && filing.scheme.type !== 'None' && (filing.scheme.type === 'Advance Authorization' || filing.scheme.type.indexOf('EPCG') === 0)) {
    if (!filing.scheme.licenseNo) { toast('Select a license to claim this export scheme.', 'error'); return; }
    const lic = getLicense(filing.scheme.licenseNo);
    const fx = FX_TO_INR[filing.invoice.currency] || 1;
    const debitAmount = Math.round(num(filing.invoice.invoiceValue) * fx);
    if (!lic || lic.balance < debitAmount) { toast(`Insufficient license balance — ₹${lic ? lic.balance.toLocaleString('en-IN') : 0} available, ₹${debitAmount.toLocaleString('en-IN')} required.`, 'error'); return; }
    lic.balance -= debitAmount;
    lic.linkedFilingIds = lic.linkedFilingIds || [];
    lic.linkedFilingIds.push(filing.id);
    filing.scheme.debited = debitAmount;
  }
  filing.dsc = { serialNo: uniqueId('DSC', () => 'DSC-' + Math.floor(100000000 + Math.random() * 900000000)), signedBy: STATE.user.profile.name, ts: Date.now() };
  submitFiling(filing);
}
