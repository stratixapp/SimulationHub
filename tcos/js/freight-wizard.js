/* ============================================================
   ICEGATE TRAINING SIMULATOR — FREIGHT BOOKING WIZARD
   ============================================================ */

function freightStepDefs() {
  return [
    { key: 'parties', title: 'Shipper, Consignee & Notify Party', fields: [
      { key: 'shipperName', label: 'Shipper Name', required: true },
      { key: 'shipperAddress', label: 'Shipper Address', required: true, full: true },
      { key: 'shipperContact', label: 'Shipper Contact', required: true },
      { key: 'consigneeName', label: 'Consignee Name', required: true },
      { key: 'consigneeAddress', label: 'Consignee Address', required: true, full: true },
      { key: 'consigneeContact', label: 'Consignee Contact', required: true },
      { key: 'notifyName', label: 'Notify Party Name' },
      { key: 'notifyAddress', label: 'Notify Party Address', full: true }
    ]},
    { key: 'booking', title: 'Booking Request', special: 'booking' },
    { key: 'cargo', title: 'Cargo Details', special: 'cargo' },
    { key: 'review', title: 'Review & Submit Booking', special: 'reviewBooking' }
  ];
}

var FWZ = null; // {booking, steps, stepIndex}

function startNewBooking() {
  const id = newId('TRN-FB');
  const booking = {
    id, status: 'DRAFT_BOOKING', createdAt: Date.now(), updatedAt: Date.now(),
    linkedFilingId: null,
    shipperName: '', shipperAddress: '', shipperContact: '',
    consigneeName: '', consigneeAddress: '', consigneeContact: '',
    notifyName: '', notifyAddress: '',
    mode: 'Sea', carrierName: '', portOfLoading: '', portOfDischarge: '',
    cargoReadinessDate: '', requestedSailingDate: '', commodity: '', incoterm: '', freightTerms: 'Prepaid',
    specialTags: [],
    containers: [],
    pieces: '', grossWeight: '', volumetricWeight: '', chargeableWeight: '',
    bookingAttempts: 0,
    bookingConfirmationNo: '',
    si: null, vgm: null, bl: null, arrival: null, deliveryOrder: null, gateOut: null, pod: null,
    timeline: [{ stage: 'DRAFT_BOOKING', ts: Date.now(), note: 'Booking draft created.' }]
  };
  STATE.bookings.unshift(booking);
  saveState();
  return booking;
}

function openFreightWizard(booking) {
  FWZ = { booking, steps: freightStepDefs(), stepIndex: 0 };
  navTo('freightWizard');
  renderFreightWizard();
}
function resumeFreightWizard(id) {
  const b = getBooking(id);
  if (b) openFreightWizard(b);
}

function renderFreightWizard() {
  const host = $('#screen-freightWizard');
  const { booking, steps, stepIndex } = FWZ;
  host.innerHTML = `
    <div class="page-head">
      <div><div class="crumb">Freight Forwarding / Booking / <b>${esc(booking.id)}</b></div>
      <h1>Freight Booking <span class="badge badge-grey">Draft</span></h1></div>
      <button class="btn-ghost" onclick="freightSaveDraftExit()">Save Draft &amp; Exit</button>
    </div>
    <div class="stepper" id="fwzStepper"></div>
    <div class="wz-pane" id="fwzPane"></div>
  `;
  const stepper = $('#fwzStepper');
  stepper.innerHTML = steps.map((s, i) => `<div class="step ${i === stepIndex ? 'on' : ''} ${i < stepIndex ? 'done' : ''}" data-i="${i}"><i>${i < stepIndex ? '✓' : i + 1}</i>${esc(s.title)}</div>`).join('');
  $all('.step', stepper).forEach(s => s.addEventListener('click', () => { FWZ.stepIndex = Number(s.dataset.i); renderFreightWizard(); }));
  renderFreightPane();
}

function renderFreightPane() {
  const { booking, steps, stepIndex } = FWZ;
  const step = steps[stepIndex];
  const pane = $('#fwzPane');
  let body = '';
  if (step.special === 'booking') body = bookingStepHTML(booking);
  else if (step.special === 'cargo') body = cargoStepHTML(booking);
  else if (step.special === 'reviewBooking') body = reviewBookingHTML(booking);
  else body = `<div class="grid">${step.fields.map(f => fieldHTML({ id: step.key + '__' + f.key, label: f.label, required: f.required, full: f.full }, booking[f.key])).join('')}</div>`;

  pane.innerHTML = `<div class="wz-card"><h3>${esc(step.title)}</h3>${body}
    <div class="actions">
      ${stepIndex > 0 ? '<button class="back2" onclick="fwzPrev()">Back</button>' : ''}
      <button class="btn-ghost" onclick="fwzSaveDraft()">Save Draft</button>
      ${stepIndex < steps.length - 1 ? '<button class="next" onclick="fwzNext()">Next</button>' : ''}
    </div>
  </div>`;

  if (step.special === 'booking') wireBookingStep(booking);
  if (step.special === 'cargo') wireCargoStep(booking);
  if (step.special === 'reviewBooking') wireReviewBooking(booking);
}

function syncFreightFields() {
  const { booking, steps, stepIndex } = FWZ;
  const step = steps[stepIndex];
  if (step.fields) {
    step.fields.forEach(f => {
      const node = $('#' + step.key + '__' + f.key);
      if (node) booking[f.key] = node.value;
    });
  }
  booking.updatedAt = Date.now();
}

const FREIGHT_STEP_VALIDATORS = {
  parties: validateFreightParties,
  booking: validateFreightBooking,
  cargo: validateFreightCargo
};

function validateFreightParties(b) {
  const errs = [];
  if (!b.shipperName) errs.push({ field: 'parties__shipperName', message: 'Shipper name is mandatory.' });
  if (!b.shipperAddress) errs.push({ field: 'parties__shipperAddress', message: 'Shipper address is mandatory.' });
  if (!b.shipperContact) errs.push({ field: 'parties__shipperContact', message: 'Shipper contact is mandatory.' });
  if (!b.consigneeName) errs.push({ field: 'parties__consigneeName', message: 'Consignee name is mandatory.' });
  if (!b.consigneeAddress) errs.push({ field: 'parties__consigneeAddress', message: 'Consignee address is mandatory.' });
  if (!b.consigneeContact) errs.push({ field: 'parties__consigneeContact', message: 'Consignee contact is mandatory.' });
  return errs;
}
function validateFreightBooking(b) {
  const errs = [];
  if (!b.carrierName) errs.push({ field: 'carrierName', message: 'Carrier is mandatory.' });
  if (!b.portOfLoading) errs.push({ field: 'portOfLoading', message: 'Port of loading is mandatory.' });
  if (!b.portOfDischarge) errs.push({ field: 'portOfDischarge', message: 'Port of discharge is mandatory.' });
  if (b.portOfLoading && b.portOfDischarge && b.portOfLoading === b.portOfDischarge) errs.push({ field: 'portOfDischarge', message: 'Port of discharge cannot be the same as port of loading.' });
  if (!b.cargoReadinessDate) errs.push({ field: 'cargoReadinessDate', message: 'Cargo readiness date is mandatory.' });
  if (!b.requestedSailingDate) errs.push({ field: 'requestedSailingDate', message: 'Requested sailing/flight date is mandatory.' });
  if (b.cargoReadinessDate && b.requestedSailingDate && b.cargoReadinessDate > b.requestedSailingDate) errs.push({ field: 'requestedSailingDate', message: 'Requested sailing date cannot be before cargo readiness date.' });
  if (!b.commodity) errs.push({ field: 'commodity', message: 'Commodity description is mandatory.' });
  return errs;
}
function validateFreightCargo(b) {
  const errs = [];
  if (b.mode === 'Sea') {
    if (!b.containers || !b.containers.length) errs.push({ field: 'containers', message: 'At least one container line (type + quantity) is required.' });
    else b.containers.forEach((c, i) => { if (!c.qty || Number(c.qty) <= 0) errs.push({ field: 'containers', message: `Container line ${i + 1}: quantity must be greater than zero.` }); });
  } else {
    if (!b.pieces || Number(b.pieces) <= 0) errs.push({ field: 'pieces', message: 'Number of pieces must be greater than zero.' });
    if (!b.grossWeight || Number(b.grossWeight) <= 0) errs.push({ field: 'grossWeight', message: 'Gross weight must be greater than zero.' });
    if (!b.chargeableWeight || Number(b.chargeableWeight) <= 0) errs.push({ field: 'chargeableWeight', message: 'Chargeable weight must be greater than zero.' });
    if (b.chargeableWeight && b.grossWeight && Number(b.chargeableWeight) < Number(b.grossWeight)) errs.push({ field: 'chargeableWeight', message: 'Chargeable weight cannot be less than gross weight.' });
  }
  return errs;
}

function fwzNext() {
  syncFreightFields();
  const { booking, steps, stepIndex } = FWZ;
  const step = steps[stepIndex];
  const validator = FREIGHT_STEP_VALIDATORS[step.key];
  if (validator) {
    const errs = validator(booking);
    if (errs.length) { toast(errs[0].message, 'error'); saveState(); renderFreightPane(); showFreightErrors(errs); return; }
  }
  saveState();
  if (stepIndex < steps.length - 1) { FWZ.stepIndex++; renderFreightWizard(); }
}
function showFreightErrors(errs) {
  const pane = $('#fwzPane');
  errs.forEach(e => showFieldError(pane, e.field, e.message));
}
function fwzPrev() { syncFreightFields(); saveState(); FWZ.stepIndex--; renderFreightWizard(); }
function fwzSaveDraft() { syncFreightFields(); saveState(); toast('Booking draft saved.', 'success'); }
function freightSaveDraftExit() { syncFreightFields(); saveState(); toast('Booking draft saved.', 'success'); navTo('dashboard'); }

/* -------- BOOKING STEP -------- */
function bookingStepHTML(b) {
  const eligibleFilings = STATE.filings.filter(f => f.status !== 'DRAFT');
  const carrierOptions = (b.mode === 'Sea' ? OCEAN_CARRIERS : AIR_CARRIERS);
  const ports = INDIAN_PORTS.concat(FOREIGN_PORTS);
  return `<div class="grid">
    <div class="field"><label for="bk_linkedFilingId">Link to Customs Filing (optional)</label>
      <select id="bk_linkedFilingId">
        <option value="">Not linked / standalone booking</option>
        ${eligibleFilings.map(f => `<option value="${f.id}" ${b.linkedFilingId === f.id ? 'selected' : ''}>${f.id} — ${f.type === 'export' ? 'Shipping Bill' : 'Bill of Entry'} (${STATUS_LABELS[f.status]})</option>`).join('')}
      </select>
    </div>
    <div class="field"><label for="bk_mode">Mode of Transport *</label>
      <select id="bk_mode"><option value="Sea" ${b.mode === 'Sea' ? 'selected' : ''}>Sea</option><option value="Air" ${b.mode === 'Air' ? 'selected' : ''}>Air</option></select>
    </div>
    <div class="field"><label for="bk_carrierName">Carrier *</label>
      <select id="bk_carrierName">${carrierOptions.map(c => `<option ${b.carrierName === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <div class="ferr" id="err_carrierName"></div>
    </div>
    <div class="field"><label for="bk_portOfLoading">Port / Airport of Loading *</label>
      <select id="bk_portOfLoading">${ports.map(p => `<option ${b.portOfLoading === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <div class="ferr" id="err_portOfLoading"></div>
    </div>
    <div class="field"><label for="bk_portOfDischarge">Port / Airport of Discharge *</label>
      <select id="bk_portOfDischarge">${ports.map(p => `<option ${b.portOfDischarge === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <div class="ferr" id="err_portOfDischarge"></div>
    </div>
    <div class="field"><label for="bk_cargoReadinessDate">Cargo Readiness Date *</label><input id="bk_cargoReadinessDate" type="date" value="${esc(b.cargoReadinessDate)}"><div class="ferr" id="err_cargoReadinessDate"></div></div>
    <div class="field"><label for="bk_requestedSailingDate">Requested Sailing / Flight Date *</label><input id="bk_requestedSailingDate" type="date" value="${esc(b.requestedSailingDate)}"><div class="ferr" id="err_requestedSailingDate"></div></div>
    <div class="field"><label for="bk_commodity">Commodity Description *</label><input id="bk_commodity" value="${esc(b.commodity)}"><div class="ferr" id="err_commodity"></div></div>
    <div class="field"><label for="bk_incoterm">Incoterm</label><select id="bk_incoterm">${INCOTERMS.map(t => `<option ${b.incoterm === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="field"><label for="bk_freightTerms">Freight Terms</label><select id="bk_freightTerms">${FREIGHT_TERMS.map(t => `<option ${b.freightTerms === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="field full"><label>Special Cargo Requirements</label>
      <div class="tag-check">${SPECIAL_CARGO_TAGS.map(t => `<label class="chk"><input type="checkbox" class="specialTag" value="${esc(t)}" ${b.specialTags.includes(t) ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div>
    </div>
  </div>`;
}
function wireBookingStep(b) {
  $('#bk_mode').addEventListener('change', () => { b.mode = $('#bk_mode').value; b.containers = []; b.carrierName = ''; saveState(); renderFreightPane(); });
  $all('input,select', $('#fwzPane')).forEach(node => {
    if (!node.id || !node.id.startsWith('bk_')) return;
    node.addEventListener('change', () => { b[node.id.replace('bk_', '')] = node.value; saveState(); });
  });
  $all('.specialTag', $('#fwzPane')).forEach(cb => cb.addEventListener('change', () => {
    b.specialTags = $all('.specialTag', $('#fwzPane')).filter(c => c.checked).map(c => c.value);
    saveState();
  }));
}

/* -------- CARGO STEP -------- */
function cargoStepHTML(b) {
  if (b.mode === 'Sea') {
    const rows = (b.containers || []).map((c, i) => `<tr data-i="${i}">
      <td><select class="cell" data-k="type">${CONTAINER_TYPES.map(t => `<option ${c.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td><input class="cell" data-k="qty" type="number" value="${c.qty || ''}" style="width:80px"></td>
      <td><button class="row-del" type="button">✕</button></td></tr>`).join('');
    return `<p class="hint">Request container types and quantities. Actual container/seal numbers are captured later at Shipping Instructions stage.</p>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Container Type</th><th>Quantity</th><th></th></tr></thead>
    <tbody id="cargoBody">${rows}</tbody></table></div>
    <button class="btn-ghost" id="addCargoBtn" type="button">+ Add Container Type</button>
    <div class="ferr" id="err_containers"></div>`;
  }
  return `<div class="grid">
    ${fieldHTML({ id: 'cg_pieces', label: 'Number of Pieces', required: true, type: 'number' }, b.pieces)}
    ${fieldHTML({ id: 'cg_grossWeight', label: 'Gross Weight (KG)', required: true, type: 'number' }, b.grossWeight)}
    ${fieldHTML({ id: 'cg_volumetricWeight', label: 'Volumetric Weight (KG)', type: 'number' }, b.volumetricWeight)}
    ${fieldHTML({ id: 'cg_chargeableWeight', label: 'Chargeable Weight (KG)', required: true, type: 'number' }, b.chargeableWeight)}
  </div>
  <div class="ferr" id="err_pieces"></div><div class="ferr" id="err_grossWeight"></div><div class="ferr" id="err_chargeableWeight"></div>`;
}
function wireCargoStep(b) {
  if (b.mode === 'Sea') {
    const body = $('#cargoBody');
    $all('tr', body).forEach((tr, i) => {
      tr.addEventListener('input', () => {
        const c = b.containers[i];
        $all('.cell', tr).forEach(cell => { c[cell.dataset.k] = cell.dataset.k === 'qty' ? Number(cell.value || 0) : cell.value; });
        saveState();
      });
      tr.querySelector('.row-del').addEventListener('click', () => { b.containers.splice(i, 1); saveState(); renderFreightPane(); });
    });
    $('#addCargoBtn').addEventListener('click', () => { b.containers.push({ type: CONTAINER_TYPES[0], qty: 1 }); saveState(); renderFreightPane(); });
  } else {
    ['pieces', 'grossWeight', 'volumetricWeight', 'chargeableWeight'].forEach(k => {
      const node = $('#cg_' + k);
      node.addEventListener('input', () => { b[k] = node.value === '' ? '' : Number(node.value); saveState(); });
    });
  }
}

/* -------- REVIEW / SUBMIT BOOKING -------- */
function reviewBookingHTML(b) {
  const cargoSummary = b.mode === 'Sea'
    ? (b.containers || []).map(c => `${c.qty} × ${c.type}`).join(', ') || '—'
    : `${b.pieces || 0} pcs, Gross ${b.grossWeight || 0} KG, Chargeable ${b.chargeableWeight || 0} KG`;
  return `<table class="kv-table">
    <tr><td>Shipper</td><td>${esc(b.shipperName)}</td></tr>
    <tr><td>Consignee</td><td>${esc(b.consigneeName)}</td></tr>
    <tr><td>Mode</td><td>${esc(b.mode)}</td></tr>
    <tr><td>Carrier</td><td>${esc(b.carrierName)}</td></tr>
    <tr><td>Port of Loading</td><td>${esc(b.portOfLoading)}</td></tr>
    <tr><td>Port of Discharge</td><td>${esc(b.portOfDischarge)}</td></tr>
    <tr><td>Cargo Readiness</td><td>${fmtDate(b.cargoReadinessDate)}</td></tr>
    <tr><td>Requested Sailing/Flight Date</td><td>${fmtDate(b.requestedSailingDate)}</td></tr>
    <tr><td>Commodity</td><td>${esc(b.commodity)}</td></tr>
    <tr><td>Cargo</td><td>${esc(cargoSummary)}</td></tr>
    <tr><td>Linked Customs Filing</td><td>${b.linkedFilingId ? esc(b.linkedFilingId) : 'None'}</td></tr>
  </table>
  <div class="declaration"><label><input type="checkbox" id="bkDeclare"> I confirm the above booking details are correct and request the carrier to confirm space allocation. (Training simulation.)</label></div>
  <div id="bkValidation"></div>
  <div class="actions"><button class="submit" onclick="submitBookingRequest()">Submit Booking Request</button></div>`;
}
function wireReviewBooking(b) { /* inline onclick */ }
function submitBookingRequest() {
  const b = FWZ.booking;
  let errs = [];
  errs = errs.concat(validateFreightParties(b), validateFreightBooking(b), validateFreightCargo(b));
  if (errs.length) {
    $('#bkValidation').innerHTML = `<div class="alert alert-error"><b>${errs.length} validation error(s):</b><ul>${errs.map(e => `<li>${esc(e.message)}</li>`).join('')}</ul></div>`;
    toast('Please correct the errors before submitting.', 'error');
    return;
  }
  if (!$('#bkDeclare').checked) { toast('Please confirm the declaration checkbox.', 'error'); return; }
  const linkSel = null; // linkedFilingId already synced via change listener on bk_linkedFilingId
  setBookingStatus(b, 'REQUESTED');
  pushTimeline(b, 'REQUESTED', 'Booking request submitted to carrier.');
  addNotification(`Booking request ${b.id} submitted to ${b.carrierName}.`, null);
  saveState();
  navToFreightBooking(b.id);
  toast('Booking request submitted. Awaiting carrier confirmation.', 'success');
}
