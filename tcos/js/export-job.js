/* ============================================================
   CONSIGNIA DESK — Export Job Master & Document Planner
   ------------------------------------------------------------
   An Export Job is a shipment-level wrapper. It LINKS to an existing
   Shipping Bill filing and/or freight booking by id — it never
   duplicates or reinterprets their fields (Section 5 of the
   integration plan). Everything here is additive to TCOS.
   ============================================================ */

var XD_BRIEF_DRAFT = null; // in-progress Export Brief form state, before a job exists

function xdBlankItem() { return { description: '', hsCode: '', qty: '', unit: 'PCS', unitPrice: '', origin: 'India', packages: '', grossWeight: '', netWeight: '' }; }
function xdBlankContainer() { return { containerNo: '', containerType: CONTAINER_TYPES[0], sealNo: '', grossWeight: '' }; }
function xdBlankConsignment() { return { consigneeAddress: '', portOfLoading: '', portOfDischarge: '', vesselFlight: '', voyageFlight: '', packageType: '', totalPackages: '', grossWeight: '', netWeight: '', marksNumbers: '', instructions: '' }; }
function xdBlankBrief() {
  return {
    buyerName: '', commodity: '', commodityCategory: '', hsCode: '', quantity: '', unit: '',
    currency: '', incoterm: '', paymentMethod: '', mode: '', destinationCountry: '',
    ftaClaim: false, dangerousGoods: false, scomet: false, packagingMaterial: '',
    linkedFilingId: '', linkedBookingId: '', notes: '',
    items: [xdBlankItem()], containers: [xdBlankContainer()], consignment: xdBlankConsignment()
  };
}
/* briefs created by older code (or the scenario starter) get the multi-product shape */
function xdEnsureBriefShape(b) {
  if (!Array.isArray(b.items) || !b.items.length) {
    b.items = [Object.assign(xdBlankItem(), { description: b.commodity || '', hsCode: b.hsCode || '', qty: b.quantity || '', unit: b.unit || 'PCS' })];
  }
  if (!Array.isArray(b.containers) || !b.containers.length) b.containers = [xdBlankContainer()];
  b.consignment = Object.assign(xdBlankConsignment(), b.consignment || {});
  return b;
}

function startNewExportJob() {
  if (typeof XD_BRIDGE_SOURCE !== 'undefined') XD_BRIDGE_SOURCE = null; // a manual job must never inherit a stale bridge snapshot
  XD_BRIEF_DRAFT = xdBlankBrief();
  navTo('exportJobBrief');
}

function exportBriefFieldDefs() {
  return [
    { key: 'buyerName', label: 'Buyer / Consignee Name', required: true },
    { key: 'commodityCategory', label: 'Commodity Category', required: true, type: 'select', options: COMMODITY_CATEGORIES },
    { key: 'currency', label: 'Currency', required: true, type: 'select', options: CURRENCIES },
    { key: 'incoterm', label: 'Incoterm', required: true, type: 'select', options: INCOTERMS },
    { key: 'paymentMethod', label: 'Payment Method', required: true, type: 'select', options: PAYMENT_METHODS },
    { key: 'mode', label: 'Mode of Transport', required: true, type: 'select', options: MODES_OF_TRANSPORT },
    { key: 'destinationCountry', label: 'Country of Destination', required: true, type: 'select', options: COUNTRIES },
    { key: 'packagingMaterial', label: 'Packaging Material', type: 'select', options: PACKAGING_MATERIALS },
    { key: 'notes', label: 'Brief / Notes', full: true, type: 'textarea' }
  ];
}
const XD_CONSIGNMENT_FIELDS = [
  { key: 'consigneeAddress', label: 'Consignee Address', full: true },
  { key: 'portOfLoading', label: 'Port of Loading', type: 'select', options: INDIAN_PORTS },
  { key: 'portOfDischarge', label: 'Port of Discharge', type: 'select', options: FOREIGN_PORTS },
  { key: 'vesselFlight', label: 'Vessel / Flight Name' },
  { key: 'voyageFlight', label: 'Voyage / Flight No.' },
  { key: 'packageType', label: 'Package Type', type: 'select', options: PACKAGE_TYPES },
  { key: 'totalPackages', label: 'Total Number of Packages', type: 'number', number: true },
  { key: 'grossWeight', label: 'Total Gross Weight (KG)', type: 'number', number: true },
  { key: 'netWeight', label: 'Total Net Weight (KG)', type: 'number', number: true },
  { key: 'marksNumbers', label: 'Marks & Numbers', full: true },
  { key: 'instructions', label: 'Shipping Instructions / Special Handling', full: true, type: 'textarea' }
];

function xdItemsTableHTML(b) {
  const hsList = '<datalist id="xdHsList">' + Object.keys(HS_CODE_TABLE).map(c => `<option value="${c}">${esc(HS_CODE_TABLE[c].desc)}</option>`).join('') + '</datalist>';
  const rows = b.items.map((it, i) => `<tr data-i="${i}">
    <td>${i + 1}</td>
    <td><input class="cell" data-xi="description" value="${esc(it.description)}" placeholder="Product description" style="min-width:170px"></td>
    <td><input class="cell" data-xi="hsCode" list="xdHsList" value="${esc(it.hsCode)}" placeholder="8-digit HSN" maxlength="8" style="width:100px"></td>
    <td><input class="cell" data-xi="qty" type="number" step="any" value="${esc(it.qty)}" style="width:70px"></td>
    <td><select class="cell" data-xi="unit">${UNITS.map(u => `<option ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
    <td><input class="cell" data-xi="unitPrice" type="number" step="any" value="${esc(it.unitPrice)}" style="width:80px"></td>
    <td><input class="cell" data-xi="origin" value="${esc(it.origin)}" style="width:80px"></td>
    <td><input class="cell" data-xi="packages" type="number" value="${esc(it.packages)}" style="width:60px"></td>
    <td><input class="cell" data-xi="grossWeight" type="number" step="any" value="${esc(it.grossWeight)}" style="width:75px"></td>
    <td><input class="cell" data-xi="netWeight" type="number" step="any" value="${esc(it.netWeight)}" style="width:75px"></td>
    <td>${b.items.length > 1 ? `<button class="row-del" type="button" onclick="xdDelItem(${i})" title="Remove product">✕</button>` : ''}</td></tr>`).join('');
  return `${hsList}<div class="table-wrap"><table class="data-table items-table"><thead><tr><th>#</th><th>Product / Description</th><th>HSN Code</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Origin</th><th>Pkgs</th><th>Gross Wt</th><th>Net Wt</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <button class="btn-ghost" type="button" onclick="xdAddItem()">+ Add HSN / Product</button>
    <div class="ferr" id="err_xdItems"></div>`;
}
function xdContainersTableHTML(b) {
  const rows = b.containers.map((c, i) => `<tr data-i="${i}">
    <td>${i + 1}</td>
    <td><input class="cell" data-xc="containerNo" value="${esc(c.containerNo)}" placeholder="MSCU1234567" style="width:130px"></td>
    <td><select class="cell" data-xc="containerType">${CONTAINER_TYPES.map(t => `<option ${c.containerType === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></td>
    <td><input class="cell" data-xc="sealNo" value="${esc(c.sealNo)}" placeholder="Seal no." style="width:110px"></td>
    <td><input class="cell" data-xc="grossWeight" type="number" step="any" value="${esc(c.grossWeight)}" style="width:90px"></td>
    <td>${b.containers.length > 1 ? `<button class="row-del" type="button" onclick="xdDelContainer(${i})" title="Remove container">✕</button>` : ''}</td></tr>`).join('');
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Container No.</th><th>Type</th><th>Seal No.</th><th>Gross Wt (KG)</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <button class="btn-ghost" type="button" onclick="xdAddContainer()">+ Add Container / Seal</button>
    <div class="ferr" id="err_xdContainers"></div>`;
}

/* read every box of the Export Brief back into XD_BRIEF_DRAFT (used before any re-render and on submit) */
function xdReadBriefDOM() {
  const host = $('#screen-exportJobBrief'), b = XD_BRIEF_DRAFT;
  if (!host || !b) return b;
  exportBriefFieldDefs().forEach(f => { const n = $('#xdb__' + f.key, host); if (n) b[f.key] = n.value; });
  XD_CONSIGNMENT_FIELDS.forEach(f => { const n = $('#xdc__' + f.key, host); if (n) b.consignment[f.key] = f.number ? (n.value === '' ? '' : Number(n.value)) : n.value; });
  ['ftaClaim', 'dangerousGoods', 'scomet'].forEach(k => { const n = $('#xdb__' + k, host); if (n) b[k] = n.checked; });
  const fl = $('#xdb__linkedFilingId', host), bl = $('#xdb__linkedBookingId', host);
  if (fl) b.linkedFilingId = fl.value || ''; if (bl) b.linkedBookingId = bl.value || '';
  $all('[data-xi]', host).forEach(n => { const i = Number(n.closest('tr').dataset.i); if (b.items[i]) b.items[i][n.dataset.xi] = n.value; });
  $all('[data-xc]', host).forEach(n => { const i = Number(n.closest('tr').dataset.i); if (b.containers[i]) b.containers[i][n.dataset.xc] = n.value; });
  return b;
}
function xdAddItem() { xdReadBriefDOM(); XD_BRIEF_DRAFT.items.push(xdBlankItem()); renderExportJobBrief(); }
function xdDelItem(i) { xdReadBriefDOM(); XD_BRIEF_DRAFT.items.splice(i, 1); renderExportJobBrief(); }
function xdAddContainer() { xdReadBriefDOM(); XD_BRIEF_DRAFT.containers.push(xdBlankContainer()); renderExportJobBrief(); }
function xdDelContainer(i) { xdReadBriefDOM(); XD_BRIEF_DRAFT.containers.splice(i, 1); renderExportJobBrief(); }

function renderExportJobBrief() {
  const host = $('#screen-exportJobBrief');
  const b = xdEnsureBriefShape(XD_BRIEF_DRAFT);
  const openExportFilings = STATE.filings.filter(f => f.type === 'export');
  const bookings = STATE.bookings;
  const bridge = (typeof DotBridge !== 'undefined') ? DotBridge.getBridge() : null;
  const src = (typeof XD_BRIDGE_SOURCE !== 'undefined' && XD_BRIDGE_SOURCE) ? XD_BRIDGE_SOURCE : null;
  const srcCard = src ? `<div class="xd-card"><h3>From your Document Simulator job</h3>
    <p class="hint">This is what the Logistics Document Simulator already knows about this shipment. The boxes below are pre-filled from it - check each one and add what the job did not have (more products, more containers, seals).</p>
    <table class="kv-table">
      <tr><td>Exporter</td><td>${esc(src.sellerName || '-')} ${src.sellerIEC ? '· IEC ' + esc(src.sellerIEC) : ''}</td></tr>
      <tr><td>Consignee / Buyer</td><td>${esc(src.buyerName || '-')}</td></tr>
      <tr><td>Route</td><td>${esc(src.portOfLoading || '-')} → ${esc(src.portOfDischarge || '-')} (${esc(src.mode || '-')})</td></tr>
      <tr><td>Vessel / Voyage</td><td>${esc(src.vesselName || '-')} ${src.voyageNo ? '/ ' + esc(src.voyageNo) : ''}</td></tr>
      <tr><td>Products</td><td>${(src.items || []).length} line(s)</td></tr>
      <tr><td>Working as</td><td>${esc((bridge && bridge.workRole) || (STATE.user.profile && (STATE.user.profile.workRole || STATE.user.profile.role)) || '-')}</td></tr>
    </table></div>` : '';
  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / <b>New Export Job</b></div>
      <h1>Export Brief</h1>
      <p class="hint">Capture the shipment's commercial facts once. The Document Planner below will use this to work out what your export file actually needs - including the Shipping Bill, which is prepared from these boxes.</p></div>
    </div>
    ${srcCard}
    <div class="xd-card">
      <h3>Shipment Facts</h3>
      <div class="grid">${exportBriefFieldDefs().map(f => fieldHTML({ id: 'xdb__' + f.key, label: f.label, required: f.required, full: f.full, type: f.type, options: f.options, placeholder: f.placeholder }, b[f.key])).join('')}</div>
      <div class="grid" style="margin-top:6px">
        <label class="xd-check"><input type="checkbox" id="xdb__ftaClaim" ${b.ftaClaim ? 'checked' : ''}> Buyer/contract claims preferential tariff treatment (FTA)</label>
        <label class="xd-check"><input type="checkbox" id="xdb__dangerousGoods" ${b.dangerousGoods ? 'checked' : ''}> Cargo is Dangerous Goods</label>
        <label class="xd-check"><input type="checkbox" id="xdb__scomet" ${b.scomet ? 'checked' : ''}> Item is SCOMET / export-controlled</label>
      </div>
    </div>
    <div class="xd-card">
      <h3>Products &amp; HSN Codes</h3>
      <p class="hint">One row per product line. Add as many HSN codes / products as the consignment has - each becomes its own item in the invoice, packing list and Shipping Bill.</p>
      ${xdItemsTableHTML(b)}
    </div>
    <div class="xd-card">
      <h3>Consignment Details</h3>
      <p class="hint">Where the cargo goes and how it is packed - the Shipping Bill's cargo and shipment particulars come from here.</p>
      <div class="grid">${XD_CONSIGNMENT_FIELDS.map(f => fieldHTML({ id: 'xdc__' + f.key, label: f.label, full: f.full, type: f.type, options: f.options }, b.consignment[f.key])).join('')}</div>
    </div>
    <div class="xd-card">
      <h3>Containers &amp; Seals</h3>
      <p class="hint">One row per container stuffed. Container number = 4 letters + 7 digits; every container carries its own seal number. Leave blank for air / LCL cargo.</p>
      ${xdContainersTableHTML(b)}
    </div>
    <div class="xd-card">
      <h3>Link to Existing Filing / Booking <span class="hint">(optional)</span></h3>
      <p class="hint">If a Shipping Bill or freight booking already exists for this shipment, link it here so Duty Drawback, RoDTEP, BRC and the freight lifecycle keep working exactly as before - Consignia Desk documents sit alongside them.</p>
      <div class="grid">
        <div class="field"><label>Shipping Bill (Export Filing)</label>
          <select id="xdb__linkedFilingId"><option value="">— None —</option>
            ${openExportFilings.map(f => `<option value="${esc(f.id)}" ${b.linkedFilingId === f.id ? 'selected' : ''}>${esc(f.id)} — ${esc(f.party.exporterName || 'Unnamed exporter')}</option>`).join('')}
          </select></div>
        <div class="field"><label>Freight Booking</label>
          <select id="xdb__linkedBookingId"><option value="">— None —</option>
            ${bookings.map(bk => `<option value="${esc(bk.id)}" ${b.linkedBookingId === bk.id ? 'selected' : ''}>${esc(bk.id)} — ${esc(bk.consigneeName || 'Unnamed consignee')}</option>`).join('')}
          </select></div>
      </div>
    </div>
    <div class="ferr" id="err_exportBrief"></div>
    <div class="actions">
      <button class="back2" onclick="navTo('exportDesk')">Cancel</button>
      <button class="next" onclick="submitExportBrief()">Create Export Job &amp; View Document Plan</button>
    </div>
  </div>`;
}

function submitExportBrief() {
  const host = $('#screen-exportJobBrief');
  clearFieldErrors(host);
  const b = xdReadBriefDOM();
  b.linkedFilingId = b.linkedFilingId || null;
  b.linkedBookingId = b.linkedBookingId || null;

  const missing = exportBriefFieldDefs().filter(f => f.required && !b[f.key] && b[f.key] !== 0);
  if (missing.length) {
    missing.forEach(f => showFieldError(host, 'xdb__' + f.key, 'Required'));
    showFieldError(host, 'exportBrief', `Please complete: ${missing.map(f => f.label).join(', ')}`);
    return;
  }
  /* products: every started row needs description, 8-digit HSN, qty, unit price */
  const rows = b.items.filter(it => Object.keys(it).some(k => k !== 'unit' && k !== 'origin' && String(it[k]).trim() !== ''));
  if (!rows.length) { showFieldError(host, 'xdItems', 'Add at least one product with its HSN code.'); return; }
  for (let i = 0; i < rows.length; i++) {
    const it = rows[i], tag = 'Product ' + (i + 1) + ': ';
    if (!String(it.description).trim()) { showFieldError(host, 'xdItems', tag + 'description is required.'); return; }
    if (!/^[0-9]{8}$/.test(String(it.hsCode).trim())) { showFieldError(host, 'xdItems', tag + 'HSN / HS code must be 8 digits.'); return; }
    if (!(Number(it.qty) > 0)) { showFieldError(host, 'xdItems', tag + 'quantity must be greater than zero.'); return; }
    if (!(Number(it.unitPrice) > 0)) { showFieldError(host, 'xdItems', tag + 'unit price must be greater than zero.'); return; }
    if (it.grossWeight !== '' && it.netWeight !== '' && Number(it.grossWeight) < Number(it.netWeight)) { showFieldError(host, 'xdItems', tag + 'gross weight cannot be less than net weight.'); return; }
  }
  b.items = rows;
  /* containers: if a number is typed it must be well-formed and carry a seal */
  const conts = b.containers.filter(c => String(c.containerNo).trim() || String(c.sealNo).trim());
  for (let i = 0; i < conts.length; i++) {
    const c = conts[i];
    if (!/^[A-Za-z]{4}[0-9]{7}$/.test(String(c.containerNo).replace(/\s/g, ''))) { showFieldError(host, 'xdContainers', `Container ${i + 1}: number must be 4 letters + 7 digits (e.g. MSCU1234567).`); return; }
    if (!String(c.sealNo).trim()) { showFieldError(host, 'xdContainers', `Container ${i + 1}: seal number is required.`); return; }
  }
  b.containers = conts;
  /* derived summary fields other Consignia modules still read */
  const first = b.items[0];
  b.commodity = b.items.length > 1 ? `${first.description} (+${b.items.length - 1} more)` : first.description;
  b.hsCode = first.hsCode; b.quantity = Number(first.qty); b.unit = first.unit;
  /* High-value / controlled goods (defence, space, SCOMET chemicals...) are flagged in the HS table: tick SCOMET automatically so the Export Licence shows up in the Document Plan. */
  if (b.items.some(it => HS_CODE_TABLE[it.hsCode] && HS_CODE_TABLE[it.hsCode].scomet)) b.scomet = true;

  const id = newId('EXJ');
  const job = {
    id, status: 'PLANNING', createdAt: Date.now(), updatedAt: Date.now(),
    linkedFilingId: b.linkedFilingId, linkedBookingId: b.linkedBookingId,
    brief: JSON.parse(JSON.stringify(b)),
    documentPlan: computeDocumentPlan(b),
    documentIds: {}
  };
  if (typeof XD_BRIDGE_SOURCE !== 'undefined' && XD_BRIDGE_SOURCE) { job.sourceJobData = XD_BRIDGE_SOURCE; XD_BRIDGE_SOURCE = null; }
  setExportJobStatus(job, 'DOCUMENTS_IN_PROGRESS');
  STATE.exportJobs.unshift(job);
  saveState();
  toast('Export Job created — Document Plan ready.', 'success');
  if (XD_BRIDGE_TARGET_DOC_TYPE && XD_DOC_WORKSTATIONS[XD_BRIDGE_TARGET_DOC_TYPE]) {
    const targetType = XD_BRIDGE_TARGET_DOC_TYPE;
    XD_BRIDGE_TARGET_DOC_TYPE = null;
    XD_DOC_WORKSTATIONS[targetType](id);
  } else {
    navToExportJobDetail(id);
  }
}

function navToExportJobDetail(id) { CURRENT_EXPORT_JOB_ID = id; navTo('exportJobDetail'); }
var CURRENT_EXPORT_JOB_ID = null;

const XD_STATUS_BADGE = {
  REQUIRED: 'badge-red', CONDITIONAL: 'badge-amber', RECOMMENDED: 'badge-blue', NOT_APPLICABLE: 'badge-grey'
};
const XD_DOC_STATUS_BADGE = { NOT_STARTED: 'badge-grey', DRAFT: 'badge-amber', READY: 'badge-green' };

/* Which documents already have a real workstation built (Phase order — Section 9
   of the integration plan). Everything else in the catalog shows its planner
   status honestly, with a "not yet built" note instead of a dead link. */
const XD_DOC_WORKSTATIONS = {
  SHIPPING_BILL: (jobId) => xdOpenShippingBill(jobId),
  COMMERCIAL_INVOICE: (jobId) => openInvoiceWorkstation(jobId),
  PACKING_LIST: (jobId) => openPackingListWorkstation(jobId),
  BILL_OF_LADING: (jobId) => openTransportDocWorkstation(jobId),
  AIR_WAYBILL: (jobId) => openTransportDocWorkstation(jobId),
  CERTIFICATE_OF_ORIGIN: (jobId) => openCooWorkstation(jobId),
  INSURANCE_CERTIFICATE: (jobId) => openInsuranceWorkstation(jobId),
  LETTER_OF_CREDIT: (jobId) => openLcWorkstation(jobId),
  BILL_OF_EXCHANGE: (jobId) => openBoeWorkstation(jobId),
  EXPORT_LICENSE: (jobId) => openLicenseWorkstation(jobId),
  PHYTOSANITARY_CERTIFICATE: (jobId) => openCommodityCertWorkstation('PHYTOSANITARY_CERTIFICATE', jobId),
  HEALTH_CERTIFICATE: (jobId) => openCommodityCertWorkstation('HEALTH_CERTIFICATE', jobId),
  FUMIGATION_CERTIFICATE: (jobId) => openCommodityCertWorkstation('FUMIGATION_CERTIFICATE', jobId),
  CATCH_CERTIFICATE: (jobId) => openCommodityCertWorkstation('CATCH_CERTIFICATE', jobId),
  HACCP_CERTIFICATE: (jobId) => openCommodityCertWorkstation('HACCP_CERTIFICATE', jobId),
  DG_DECLARATION: (jobId) => openCommodityCertWorkstation('DG_DECLARATION', jobId)
};

function exportJobDocStatus(job, docType) {
  if (docType === 'SHIPPING_BILL') {
    const f = job.linkedFilingId ? getFiling(job.linkedFilingId) : null;
    if (!f) return { status: 'NOT_STARTED', version: null };
    return { status: (f.leo || f.status === 'LEO' || f.status === 'COMPLETED') ? 'READY' : 'DRAFT', version: null };
  }
  const doc = currentDocOfType(job.id, docType);
  if (!doc) return { status: 'NOT_STARTED', version: null };
  return { status: doc.status, version: doc.version };
}

function renderExportJobDetail(id) {
  const job = getExportJob(id || CURRENT_EXPORT_JOB_ID);
  const host = $('#screen-exportJobDetail');
  if (!job) { host.innerHTML = '<div class="xd-root"><p class="hint">Export Job not found.</p></div>'; return; }
  const groups = ['CUSTOMS', 'CORE', 'TRANSPORT', 'ORIGIN', 'FINANCIAL', 'REGULATORY', 'COMMODITY'];
  const filing = job.linkedFilingId ? getFiling(job.linkedFilingId) : null;
  const booking = job.linkedBookingId ? getBooking(job.linkedBookingId) : null;
  const check = STATE.consistencyChecks.find(c => c.exportJobId === job.id && !c.kind);
  const lcCheck = STATE.consistencyChecks.find(c => c.exportJobId === job.id && c.kind === 'LC_COMPLIANCE');

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / <b>${esc(job.id)}</b></div>
      <h1>${esc(job.brief.commodity)} <span class="badge badge-blue">${esc(job.status.replace(/_/g, ' '))}</span></h1>
      <p class="hint">${esc(job.brief.buyerName)} · ${esc(job.brief.destinationCountry)} · ${esc(job.brief.mode)} · ${esc(job.brief.incoterm)} · ${esc(job.brief.paymentMethod)}</p></div>
      <button class="btn-ghost" onclick="navTo('exportDesk')">Back to Desk</button>
    </div>

    <div class="xd-card">
      <h3>Linked Records</h3>
      <p class="hint">${filing ? `Shipping Bill: <b>${esc(filing.id)}</b> (${esc(filing.status)})` : 'No Shipping Bill linked yet.'} &nbsp;·&nbsp; ${booking ? `Freight Booking: <b>${esc(booking.id)}</b> (${esc(booking.status)})` : 'No freight booking linked yet.'}</p>
    </div>

    <div class="xd-card">
      <h3>Document Plan</h3>
      ${groups.map(g => {
        const docs = job.documentPlan.filter(d => d.category === g);
        if (!docs.length) return '';
        return `<h4 class="xd-subhead">${esc(g)}</h4><div class="table-wrap"><table class="data-table">
          <thead><tr><th>Document</th><th>Applicability</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${docs.map(d => {
            const ds = exportJobDocStatus(job, d.doc);
            const hasWorkstation = !!XD_DOC_WORKSTATIONS[d.doc];
            const actionable = d.status !== 'NOT_APPLICABLE' && hasWorkstation;
            return `<tr>
              <td>${esc(d.label)}</td>
              <td><span class="badge ${XD_STATUS_BADGE[d.status]}">${esc(d.status.replace(/_/g, ' '))}</span></td>
              <td class="hint">${esc(d.reason)}</td>
              <td>${d.status === 'NOT_APPLICABLE' ? '—' : `<span class="badge ${XD_DOC_STATUS_BADGE[ds.status]}">${esc(ds.status.replace(/_/g, ' '))}${ds.version ? ' v' + ds.version : ''}</span>`}</td>
              <td>${actionable ? `<button class="btn-ghost sm" onclick="XD_DOC_WORKSTATIONS['${d.doc}']('${job.id}')">${ds.status === 'NOT_STARTED' ? 'Start' : 'Open'}</button>` : (d.status === 'NOT_APPLICABLE' ? '' : '<span class="hint">Not yet built</span>')}</td>
            </tr>`;
          }).join('')}</tbody></table></div>`;
      }).join('')}
    </div>

    <div class="xd-card">
      <h3>Cross-Document Consistency</h3>
      ${check ? renderConsistencySummary(check) : '<p class="hint">Run once at least two documents (e.g. Commercial Invoice + Packing List) have a Ready draft.</p>'}
      <button class="btn-ghost sm" onclick="runConsistencyCheck('${job.id}'); renderExportJobDetail('${job.id}')">Run Consistency Check</button>
    </div>
    ${currentDocOfType(job.id, 'LETTER_OF_CREDIT') ? `<div class="xd-card">
      <h3>LC Document Compliance</h3>
      ${lcCheck ? renderLcComplianceSummary(lcCheck) : '<p class="hint">Run from the Letter of Credit screen, or here.</p>'}
      <button class="btn-ghost sm" onclick="runLCComplianceCheck('${job.id}'); renderExportJobDetail('${job.id}')">Run Compliance Check</button>
    </div>` : ''}

    <div class="xd-card">
      <h3>Final Export File Audit</h3>
      <p class="hint">Pulls document completeness, cross-document consistency, and LC compliance (if applicable) into one READY / NOT READY result.</p>
      <button class="next sm" onclick="navToExportAudit('${job.id}')">Open Final Audit</button>
    </div>
  </div>`;
}

function navToExportAudit(jobId) { CURRENT_EXPORT_JOB_ID = jobId; navTo('exportAudit'); }

/* ---------------- Start from an existing TCOS scenario ----------------
   Interconnection point (not a new/duplicate scenario library): reuses
   TCOS's own SCENARIOS data. Follows TCOS's own established rule (see
   startNewFiling's comment in filingForm.js) of never silently filling
   a document — the linked Shipping Bill filing stays blank exactly as
   a normal new filing does, and the Export Brief is pre-filled but
   still requires the student's review and explicit "Create" action. */
function startExportJobFromScenario(scenarioId) {
  if (typeof XD_BRIDGE_SOURCE !== 'undefined') XD_BRIDGE_SOURCE = null;
  const scenario = SCENARIOS.find(s => s.id === scenarioId && s.type === 'export');
  if (!scenario) return;
  const filing = startNewFiling('export', scenario);
  const p = scenario.prefill;
  const firstItem = (p.items && p.items[0]) || {};
  const mappedPayment = PAYMENT_METHODS.includes(p.invoice.paymentTerms) ? p.invoice.paymentTerms : '';
  const mappedMode = MODES_OF_TRANSPORT.includes(p.shipment.modeOfTransport) ? p.shipment.modeOfTransport : '';
  const mappedUnit = UNITS.includes(firstItem.unit) ? firstItem.unit : '';
  XD_BRIEF_DRAFT = {
    buyerName: p.counterparty.consigneeName || '', commodity: firstItem.description || '', commodityCategory: '',
    hsCode: firstItem.hsCode || '', quantity: firstItem.qty || '', unit: mappedUnit,
    items: (p.items || []).map(it => Object.assign(xdBlankItem(), { description: it.description, hsCode: it.hsCode, qty: it.qty, unit: UNITS.includes(it.unit) ? it.unit : 'PCS', unitPrice: it.unitPrice, origin: it.origin, packages: it.packages, grossWeight: it.grossWeight, netWeight: it.netWeight })),
    containers: [xdBlankContainer()],
    consignment: Object.assign(xdBlankConsignment(), { consigneeAddress: p.counterparty.address || '', vesselFlight: p.shipment.vesselFlight || '', voyageFlight: p.shipment.voyageFlight || '' }),
    currency: p.invoice.currency || '', incoterm: p.invoice.incoterm || '', paymentMethod: mappedPayment,
    mode: mappedMode, destinationCountry: p.shipment.countryOfDestination || '',
    ftaClaim: false, dangerousGoods: false, scomet: false, packagingMaterial: '',
    linkedFilingId: filing.id, linkedBookingId: '',
    notes: `Started from TCOS scenario ${scenario.id} — ${scenario.title}. Review every field below before creating the job; nothing here was filled in silently.`
  };
  navTo('exportJobBrief');
}

function renderExportDesk() {
  const host = $('#screen-exportDesk');
  const jobs = STATE.exportJobs;
  const active = jobs.filter(j => j.status !== 'COMPLETE');
  const docsPending = jobs.reduce((n, j) => n + j.documentPlan.filter(d => d.status !== 'NOT_APPLICABLE' && exportJobDocStatus(j, d.doc).status !== 'READY').length, 0);

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Consignia Desk</div><h1>Export Documentation Desk</h1>
      <p class="hint">Build the real export document file for a shipment — Commercial Invoice, Packing List, and the rest of the document plan — cross-checked against each other and against the Shipping Bill.</p></div>
      <button class="next" onclick="startNewExportJob()">+ New Export Job</button>
    </div>
    <div class="xd-cards">
      <div class="xd-stat"><b>${active.length}</b><span>Active Export Jobs</span></div>
      <div class="xd-stat"><b>${jobs.length - active.length}</b><span>Complete</span></div>
      <div class="xd-stat"><b>${docsPending}</b><span>Documents Pending</span></div>
    </div>
    <div class="xd-card">
      <h3>Start from a TCOS Scenario</h3>
      <p class="hint">Reuses TCOS's own scenario library — creates a linked Shipping Bill filing (blank, exactly like a normal new filing) and pre-fills the Export Brief for you to review, not silently commit.</p>
      <div class="grid">${SCENARIOS.filter(s => s.type === 'export').map(s => `
        <div class="field full" style="border:1px solid var(--xd-line);border-radius:2px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div><b>${esc(s.title)}</b><br><span class="hint">${esc(s.desc)}</span></div>
          <button class="btn-ghost sm" onclick="startExportJobFromScenario('${s.id}')">Use This</button>
        </div>`).join('')}</div>
    </div>
    <div class="xd-card">
      <h3>Export Jobs</h3>
      ${jobs.length ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Job</th><th>Commodity</th><th>Buyer</th><th>Destination</th><th>Status</th><th></th></tr></thead>
        <tbody>${jobs.map(j => `<tr>
          <td>${esc(j.id)}</td><td>${esc(j.brief.commodity)}</td><td>${esc(j.brief.buyerName)}</td><td>${esc(j.brief.destinationCountry)}</td>
          <td><span class="badge badge-blue">${esc(j.status.replace(/_/g, ' '))}</span></td>
          <td><button class="btn-ghost sm" onclick="navToExportJobDetail('${j.id}')">Open</button></td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="hint">No Export Jobs yet — create one to get started.</p>'}
    </div>
  </div>`;
}
