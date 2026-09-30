/* ============================================================
   CONSIGNIA DESK — Bill of Lading / Air Waybill
   ------------------------------------------------------------
   One engine, two labels — BILL_OF_LADING for Sea, AIR_WAYBILL
   for Air, chosen by the Export Job's brief.mode (matches the
   Document Planner's own rule). Sources shipper/consignee/notify/
   container/vessel data from the linked freight booking, but only
   via an explicit "Apply from Booking" action (Section 43 — no
   silent autofill) since this is a document the student is
   preparing, not a mirror of the booking record.

   Deepened per feedback that this felt too quick to complete —
   containers/seals are now a real repeatable table (matching the
   Invoice/Packing List pattern) instead of one flat text field,
   plus VGM, a freight charge breakdown, and clauses/remarks.
   ============================================================ */

function transportDocType(job) { return job.brief.mode === 'Air' ? 'AIR_WAYBILL' : 'BILL_OF_LADING'; }
function transportDocLabel(type) { return type === 'AIR_WAYBILL' ? 'Air Waybill' : 'Bill of Lading'; }

function blankTransportDocFields() {
  return {
    documentNo: '', bookingNo: '', releaseType: '', date: '', numberOfOriginals: '',
    shippingInstructionsRef: '',
    shipper: { name: '', address: '', contact: '' },
    consignee: { name: '', address: '', contact: '' },
    notifyParty: { name: '', address: '' },
    carrier: '', agent: '', vesselFlight: '', voyageFlightNo: '',
    routing: { placeOfReceipt: '', portOfLoading: '', portOfDischarge: '', placeOfDelivery: '', finalDestination: '' },
    containers: [],
    cargo: { marksNumbers: '', descriptionOfGoods: '', dangerousGoods: false, dgDetails: '' },
    vgm: { verifiedGrossMass: '', method: 'Method 1 (weighing the packed container)', responsibleParty: '', submissionDate: '' },
    freight: { freightTerms: '', currency: '', oceanFreight: '', thc: '', blFee: '', otherCharges: '' },
    clauses: ''
  };
}

function openTransportDocWorkstation(jobId) {
  const job = getExportJob(jobId);
  const type = transportDocType(job);
  let doc = currentDocOfType(jobId, type);
  if (!doc) {
    doc = { id: newId('XDOC-TRN'), exportJobId: jobId, type, version: 1, status: 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: blankTransportDocFields() };
    STATE.exportDocs.push(doc);
    saveState();
  }
  CURRENT_TRANSPORTDOC_ID = doc.id;
  CURRENT_EXPORT_JOB_ID = jobId;
  navTo('exportTransportDoc');
}
var CURRENT_TRANSPORTDOC_ID = null;

function transportDocTotals(doc) {
  const c = doc.fields.containers;
  return {
    totalContainers: c.length,
    totalPackages: c.reduce((s, x) => s + num(x.packageCount), 0),
    totalGrossWeight: c.reduce((s, x) => s + num(x.grossWeight), 0),
    totalVolume: c.reduce((s, x) => s + num(x.measurementVolume), 0)
  };
}
function transportDocContainerNosJoined(doc) { return doc.fields.containers.map(c => c.containerNo).filter(Boolean).join(', '); }
function transportDocSealNosJoined(doc) { return doc.fields.containers.map(c => c.sealNo).filter(Boolean).join(', '); }

function applyBookingToTransportDoc() {
  const doc = getExportDoc(CURRENT_TRANSPORTDOC_ID);
  const job = getExportJob(doc.exportJobId);
  const booking = job.linkedBookingId ? getBooking(job.linkedBookingId) : null;
  if (!booking) { toast('No freight booking linked to this Export Job.', 'error'); return; }
  syncTransportDocFieldsFromDOM(doc);
  const f = doc.fields;
  f.bookingNo = booking.id || f.bookingNo;
  f.shipper = { name: booking.shipperName || '', address: booking.shipperAddress || '', contact: booking.shipperContact || '' };
  f.consignee = { name: booking.consigneeName || '', address: booking.consigneeAddress || '', contact: booking.consigneeContact || '' };
  f.notifyParty = { name: booking.notifyName || '', address: booking.notifyAddress || '' };
  f.carrier = booking.carrierName || '';
  f.routing.portOfLoading = booking.portOfLoading || '';
  f.routing.portOfDischarge = booking.portOfDischarge || '';
  f.freight.freightTerms = booking.freightTerms || '';
  if (booking.containers && booking.containers.length) {
    f.containers = booking.containers.map(c => ({
      containerNo: c.containerNo || '', sealNo: c.sealNo || '', containerType: c.type || '',
      packageCount: '', packageType: '', grossWeight: booking.grossWeight && booking.containers.length === 1 ? booking.grossWeight : '', measurementVolume: ''
    }));
  }
  if (booking.bl && booking.bl.houseNo) { f.documentNo = booking.bl.houseNo; f.releaseType = booking.bl.releaseType || ''; }
  saveState();
  toast('Applied booking data — review container details and complete the rest before marking Ready.', 'success');
  renderExportTransportDoc();
}

function renderExportTransportDoc() {
  const doc = getExportDoc(CURRENT_TRANSPORTDOC_ID);
  const host = $('#screen-exportTransportDoc');
  if (!doc) { host.innerHTML = '<div class="xd-root"><p class="hint">Document not found.</p></div>'; return; }
  const label = transportDocLabel(doc.type);
  const f = doc.fields;
  const t = transportDocTotals(doc);
  const job = getExportJob(doc.exportJobId);
  const booking = job.linkedBookingId ? getBooking(job.linkedBookingId) : null;
  const versions = docVersionsOfType(doc.exportJobId, doc.type);
  const isAir = doc.type === 'AIR_WAYBILL';

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / ${esc(doc.exportJobId)} / <b>${esc(label)}</b></div>
      <h1>${esc(label)} <span class="badge ${XD_DOC_STATUS_BADGE[doc.status]}">${esc(doc.status)}</span> <span class="hint">v${doc.version}${versions.length > 1 ? ' of ' + versions.length : ''}</span></h1></div>
      <button class="btn-ghost" onclick="navToExportJobDetail('${doc.exportJobId}')">Back to Export Job</button>
    </div>

    <div class="xd-card">
      <h3>Booking Reference</h3>
      ${booking ? `<p class="hint">Linked freight booking: <b>${esc(booking.id)}</b> (${esc(booking.status.replace(/_/g, ' '))})${booking.bl && booking.bl.houseNo ? ` — House No. <b>${esc(booking.bl.houseNo)}</b>` : ' — draft/final BL/AWB not yet issued on the booking.'}</p>
        <button class="btn-ghost sm" onclick="applyBookingToTransportDoc()">Apply from Booking →</button>` : '<p class="hint">No freight booking linked to this Export Job — fill this document directly.</p>'}
    </div>

    <div class="xd-card"><h3>Document Identity</h3><div class="grid">
      ${fieldHTML({ id: 'trn__documentNo', label: label + ' Number', required: true }, f.documentNo)}
      ${fieldHTML({ id: 'trn__bookingNo', label: 'Booking Number' }, f.bookingNo)}
      ${fieldHTML({ id: 'trn__shippingInstructionsRef', label: 'Shipping Instructions Ref.' }, f.shippingInstructionsRef)}
      ${fieldHTML({ id: 'trn__date', label: 'Date', required: true, type: 'date' }, f.date)}
      ${fieldHTML({ id: 'trn__numberOfOriginals', label: 'Number of Originals Issued', type: 'number' }, f.numberOfOriginals)}
      ${fieldHTML({ id: 'trn__releaseType', label: 'Release Type', type: 'select', options: isAir ? ['Original AWB', 'Telex Release'] : ['Original Bill of Lading', 'Sea Waybill', 'Telex Release'] }, f.releaseType)}
      ${fieldHTML({ id: 'trn__carrier', label: 'Carrier' }, f.carrier)}
      ${fieldHTML({ id: 'trn__agent', label: 'Agent' }, f.agent)}
      ${fieldHTML({ id: 'trn__vesselFlight', label: isAir ? 'Flight' : 'Vessel' }, f.vesselFlight)}
      ${fieldHTML({ id: 'trn__voyageFlightNo', label: isAir ? 'Flight No.' : 'Voyage No.' }, f.voyageFlightNo)}
    </div></div>

    <div class="xd-card"><h3>Shipper</h3><div class="grid">
      ${fieldHTML({ id: 'trn__sh_name', label: 'Name', required: true }, f.shipper.name)}
      ${fieldHTML({ id: 'trn__sh_address', label: 'Address', full: true }, f.shipper.address)}
      ${fieldHTML({ id: 'trn__sh_contact', label: 'Contact' }, f.shipper.contact)}
    </div></div>

    <div class="xd-card"><h3>Consignee</h3><div class="grid">
      ${fieldHTML({ id: 'trn__con_name', label: 'Name', required: true }, f.consignee.name)}
      ${fieldHTML({ id: 'trn__con_address', label: 'Address', full: true }, f.consignee.address)}
      ${fieldHTML({ id: 'trn__con_contact', label: 'Contact' }, f.consignee.contact)}
    </div></div>

    <div class="xd-card"><h3>Notify Party</h3><div class="grid">
      ${fieldHTML({ id: 'trn__not_name', label: 'Name' }, f.notifyParty.name)}
      ${fieldHTML({ id: 'trn__not_address', label: 'Address', full: true }, f.notifyParty.address)}
    </div></div>

    <div class="xd-card"><h3>Routing</h3><div class="grid">
      ${fieldHTML({ id: 'trn__rt_placeOfReceipt', label: 'Place of Receipt' }, f.routing.placeOfReceipt)}
      ${fieldHTML({ id: 'trn__rt_portOfLoading', label: isAir ? 'Airport of Departure' : 'Port of Loading', required: true, type: 'select', options: INDIAN_PORTS }, f.routing.portOfLoading)}
      ${fieldHTML({ id: 'trn__rt_portOfDischarge', label: isAir ? 'Airport of Destination' : 'Port of Discharge', required: true, type: 'select', options: FOREIGN_PORTS }, f.routing.portOfDischarge)}
      ${fieldHTML({ id: 'trn__rt_placeOfDelivery', label: 'Place of Delivery' }, f.routing.placeOfDelivery)}
      ${fieldHTML({ id: 'trn__rt_finalDestination', label: 'Final Destination' }, f.routing.finalDestination)}
    </div></div>

    <div class="xd-card"><h3>${isAir ? 'Pieces / ULDs' : 'Containers &amp; Seals'}</h3>
      <div class="table-wrap"><table class="data-table items-table">
        <thead><tr><th>${isAir ? 'ULD / Ref' : 'Container No.'}</th><th>Seal No.</th><th>Type</th><th>Pkgs</th><th>Pkg Type</th><th>Gross Wt (KG)</th><th>Volume (m³)</th><th></th></tr></thead>
        <tbody id="trnContainersBody">${f.containers.map((c, i) => transportContainerRowHTML(c, i)).join('')}</tbody>
      </table></div>
      <button class="btn-ghost sm" id="trnAddContainerBtn" type="button">+ Add ${isAir ? 'Piece/ULD' : 'Container'}</button>
      <div class="xd-totals" style="margin-top:12px" id="trnTotals">
        <div><span>Total ${isAir ? 'Pieces' : 'Containers'}</span><b>${t.totalContainers}</b></div>
        <div><span>Total Packages</span><b>${t.totalPackages.toLocaleString('en-IN')}</b></div>
        <div><span>Total Gross Weight (KG)</span><b>${t.totalGrossWeight.toLocaleString('en-IN')}</b></div>
        <div><span>Total Volume (m³)</span><b>${t.totalVolume.toFixed(3)}</b></div>
      </div>
    </div>

    <div class="xd-card"><h3>Cargo Description</h3><div class="grid">
      ${fieldHTML({ id: 'trn__cg_marksNumbers', label: 'Marks &amp; Numbers', full: true }, f.cargo.marksNumbers)}
      ${fieldHTML({ id: 'trn__cg_descriptionOfGoods', label: 'Description of Goods', full: true, type: 'textarea' }, f.cargo.descriptionOfGoods)}
    </div>
    <label class="xd-check"><input type="checkbox" id="trn__cg_dangerousGoods" ${f.cargo.dangerousGoods ? 'checked' : ''}> Contains Dangerous Goods</label>
    ${f.cargo.dangerousGoods ? `<div class="grid" style="margin-top:6px">${fieldHTML({ id: 'trn__cg_dgDetails', label: 'DG Reference (UN No. / Class — see DG Declaration)', full: true }, f.cargo.dgDetails)}</div>` : ''}
    </div>

    ${!isAir ? `<div class="xd-card"><h3>Verified Gross Mass (VGM)</h3><div class="grid">
      ${fieldHTML({ id: 'trn__vgm_verifiedGrossMass', label: 'Verified Gross Mass (KG)', type: 'number' }, f.vgm.verifiedGrossMass)}
      ${fieldHTML({ id: 'trn__vgm_method', label: 'VGM Method', type: 'select', options: ['Method 1 (weighing the packed container)', 'Method 2 (weighing contents + tare)'] }, f.vgm.method)}
      ${fieldHTML({ id: 'trn__vgm_responsibleParty', label: 'Responsible Party' }, f.vgm.responsibleParty)}
      ${fieldHTML({ id: 'trn__vgm_submissionDate', label: 'Submission Date', type: 'date' }, f.vgm.submissionDate)}
    </div>
    <p class="hint">VGM must be submitted to the carrier ahead of the cut-off — the terminal will not load a container without it.</p>
    </div>` : ''}

    <div class="xd-card"><h3>Freight</h3><div class="grid">
      ${fieldHTML({ id: 'trn__fr_freightTerms', label: 'Freight Terms', type: 'select', options: ['Prepaid', 'Collect'] }, f.freight.freightTerms)}
      ${fieldHTML({ id: 'trn__fr_currency', label: 'Currency', type: 'select', options: CURRENCIES }, f.freight.currency)}
      ${fieldHTML({ id: 'trn__fr_oceanFreight', label: isAir ? 'Air Freight' : 'Ocean Freight', type: 'number' }, f.freight.oceanFreight)}
      ${fieldHTML({ id: 'trn__fr_thc', label: 'THC (Terminal Handling Charges)', type: 'number' }, f.freight.thc)}
      ${fieldHTML({ id: 'trn__fr_blFee', label: label + ' Fee', type: 'number' }, f.freight.blFee)}
      ${fieldHTML({ id: 'trn__fr_otherCharges', label: 'Other Charges', type: 'number' }, f.freight.otherCharges)}
    </div></div>

    <div class="xd-card"><h3>Clauses / Remarks</h3>
      ${fieldHTML({ id: 'trn__clauses', label: '', full: true, type: 'textarea', placeholder: 'e.g. "Shipped on board in apparent good order and condition" — Clean on Board' }, f.clauses)}
    </div>

    <div class="ferr" id="err_transportDoc"></div>
    <div class="actions">
      <button class="btn-ghost" onclick="openPrintPreview('${doc.type}', '${doc.id}')">🖨 Preview / Print</button>
      <button class="btn-ghost" onclick="saveTransportDocDraft()">Save Draft</button>
      <button class="next" onclick="markTransportDocReady()">Mark Ready</button>
    </div>
  </div>`;

  wireTransportContainersTable(doc);
  xdWireSuggestions(host, doc.exportJobId, { trn__sh_name: 'exporterName', trn__con_name: 'consigneeName' });
}

function transportContainerRowHTML(c, i) {
  return `<tr data-i="${i}">
    <td><input class="cell" data-k="containerNo" value="${esc(c.containerNo || '')}" style="min-width:110px"></td>
    <td><input class="cell" data-k="sealNo" value="${esc(c.sealNo || '')}" style="width:90px"></td>
    <td><input class="cell" data-k="containerType" value="${esc(c.containerType || '')}" placeholder="20' / 40' HC" style="width:90px"></td>
    <td><input class="cell" data-k="packageCount" type="number" value="${c.packageCount || ''}" style="width:65px"></td>
    <td><select class="cell" data-k="packageType">${PACKAGE_TYPES.map(p => `<option ${c.packageType === p ? 'selected' : ''}>${p}</option>`).join('')}</select></td>
    <td><input class="cell" data-k="grossWeight" type="number" value="${c.grossWeight || ''}" style="width:80px"></td>
    <td><input class="cell" data-k="measurementVolume" type="number" value="${c.measurementVolume || ''}" style="width:75px"></td>
    <td><button class="row-del" type="button" title="Remove">✕</button></td>
  </tr>`;
}

function wireTransportContainersTable(doc) {
  const body = $('#trnContainersBody');
  function refreshTotalsDisplay() {
    const t = transportDocTotals(doc);
    const box = $('#trnTotals');
    if (!box) return;
    const vals = box.querySelectorAll('b');
    vals[0].textContent = t.totalContainers;
    vals[1].textContent = t.totalPackages.toLocaleString('en-IN');
    vals[2].textContent = t.totalGrossWeight.toLocaleString('en-IN');
    vals[3].textContent = t.totalVolume.toFixed(3);
  }
  $all('tr', body).forEach((tr, i) => {
    tr.addEventListener('input', () => {
      const c = doc.fields.containers[i];
      $all('.cell', tr).forEach(cell => {
        const k = cell.dataset.k;
        const isNumeric = ['packageCount', 'grossWeight', 'measurementVolume'].includes(k);
        c[k] = isNumeric ? (cell.value === '' ? '' : Number(cell.value)) : cell.value;
      });
      saveState();
      refreshTotalsDisplay();
    });
    tr.querySelector('.row-del').addEventListener('click', () => { syncTransportDocFieldsFromDOM(doc); doc.fields.containers.splice(i, 1); saveState(); renderExportTransportDoc(); });
  });
  const addBtn = $('#trnAddContainerBtn');
  if (addBtn) addBtn.addEventListener('click', () => {
    syncTransportDocFieldsFromDOM(doc);
    doc.fields.containers.push({ containerNo: '', sealNo: '', containerType: '', packageCount: '', packageType: 'Carton', grossWeight: '', measurementVolume: '' });
    saveState(); renderExportTransportDoc();
  });
}

function syncTransportDocFieldsFromDOM(doc) {
  const host = $('#screen-exportTransportDoc');
  const f = doc.fields;
  const g = (id) => { const n = $('#' + id, host); return n ? n.value : ''; };
  if (!host || !$('#trn__documentNo', host)) return; // called before first render (e.g. from Apply button pre-render)
  f.documentNo = g('trn__documentNo'); f.bookingNo = g('trn__bookingNo'); f.shippingInstructionsRef = g('trn__shippingInstructionsRef');
  f.date = g('trn__date'); f.numberOfOriginals = g('trn__numberOfOriginals'); f.releaseType = g('trn__releaseType');
  f.carrier = g('trn__carrier'); f.agent = g('trn__agent'); f.vesselFlight = g('trn__vesselFlight'); f.voyageFlightNo = g('trn__voyageFlightNo');
  f.shipper = { name: g('trn__sh_name'), address: g('trn__sh_address'), contact: g('trn__sh_contact') };
  f.consignee = { name: g('trn__con_name'), address: g('trn__con_address'), contact: g('trn__con_contact') };
  f.notifyParty = { name: g('trn__not_name'), address: g('trn__not_address') };
  f.routing = { placeOfReceipt: g('trn__rt_placeOfReceipt'), portOfLoading: g('trn__rt_portOfLoading'), portOfDischarge: g('trn__rt_portOfDischarge'), placeOfDelivery: g('trn__rt_placeOfDelivery'), finalDestination: g('trn__rt_finalDestination') };
  const dgNode = $('#trn__cg_dangerousGoods', host);
  f.cargo = { marksNumbers: g('trn__cg_marksNumbers'), descriptionOfGoods: g('trn__cg_descriptionOfGoods'), dangerousGoods: dgNode ? dgNode.checked : f.cargo.dangerousGoods, dgDetails: $('#trn__cg_dgDetails', host) ? g('trn__cg_dgDetails') : f.cargo.dgDetails };
  if ($('#trn__vgm_verifiedGrossMass', host)) {
    f.vgm = { verifiedGrossMass: g('trn__vgm_verifiedGrossMass'), method: g('trn__vgm_method'), responsibleParty: g('trn__vgm_responsibleParty'), submissionDate: g('trn__vgm_submissionDate') };
  }
  f.freight = { freightTerms: g('trn__fr_freightTerms'), currency: g('trn__fr_currency'), oceanFreight: g('trn__fr_oceanFreight'), thc: g('trn__fr_thc'), blFee: g('trn__fr_blFee'), otherCharges: g('trn__fr_otherCharges') };
  f.clauses = g('trn__clauses');
}

function persistTransportDocEdit(doc, makeReady) {
  syncTransportDocFieldsFromDOM(doc);
  if (doc.status === 'READY') {
    doc.status = 'SUPERSEDED';
    const newDoc = { id: newId('XDOC-TRN'), exportJobId: doc.exportJobId, type: doc.type, version: doc.version + 1, status: makeReady ? 'READY' : 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: JSON.parse(JSON.stringify(doc.fields)) };
    STATE.exportDocs.push(newDoc);
    CURRENT_TRANSPORTDOC_ID = newDoc.id;
    saveState();
    return newDoc;
  }
  doc.status = makeReady ? 'READY' : 'DRAFT';
  doc.updatedAt = Date.now();
  saveState();
  return doc;
}

function saveTransportDocDraft() {
  const doc = getExportDoc(CURRENT_TRANSPORTDOC_ID);
  persistTransportDocEdit(doc, false);
  toast((transportDocLabel(doc.type)) + ' draft saved.', 'success');
  renderExportTransportDoc();
}

function markTransportDocReady() {
  const doc = getExportDoc(CURRENT_TRANSPORTDOC_ID);
  const host = $('#screen-exportTransportDoc');
  clearFieldErrors(host);
  syncTransportDocFieldsFromDOM(doc);
  const errs = [];
  if (!doc.fields.documentNo) errs.push((transportDocLabel(doc.type)) + ' Number is required');
  if (!doc.fields.shipper.name) errs.push('Shipper Name is required');
  if (!doc.fields.consignee.name) errs.push('Consignee Name is required');
  if (!doc.fields.routing.portOfLoading) errs.push('Port/Airport of Loading is required');
  if (!doc.fields.routing.portOfDischarge) errs.push('Port/Airport of Discharge is required');
  if (!doc.fields.containers.length) errs.push('At least one container/piece row is required');
  if (doc.fields.cargo.dangerousGoods && !doc.fields.cargo.dgDetails) errs.push('DG Reference is required when Dangerous Goods is checked');
  if (errs.length) {
    showFieldError(host, 'transportDoc', errs.join(' · '));
    toast('Fix the highlighted issues before marking Ready.', 'error');
    return;
  }
  persistTransportDocEdit(doc, true);
  toast((transportDocLabel(doc.type)) + ' marked Ready.', 'success');
  navToExportJobDetail(doc.exportJobId);
}
