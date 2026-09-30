/* ============================================================
   CONSIGNIA DESK — Packing List
   ============================================================ */

function blankPackingListFields() {
  return {
    packingListNumber: '', date: '', invoiceRef: '', poRef: '',
    exporter: { name: '', address: '', country: 'India' },
    buyer: { name: '', address: '', country: '' },
    consignee: { name: '', address: '', country: '' },
    notifyParty: { name: '', address: '', country: '' },
    shipment: { portOfLoading: '', portOfDischarge: '', vesselFlight: '', containerNo: '', sealNo: '' },
    packages: []
  };
}

function openPackingListWorkstation(jobId) {
  const job = getExportJob(jobId);
  let doc = currentDocOfType(jobId, 'PACKING_LIST');
  if (!doc) {
    doc = { id: newId('XDOC-PKL'), exportJobId: jobId, type: 'PACKING_LIST', version: 1, status: 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: blankPackingListFields() };
    doc.fields.shipment.portOfLoading = '';
    STATE.exportDocs.push(doc);
    saveState();
  }
  CURRENT_PACKINGLIST_ID = doc.id;
  CURRENT_EXPORT_JOB_ID = jobId;
  navTo('exportPackingList');
}
var CURRENT_PACKINGLIST_ID = null;

function packingListTotals(doc) {
  const p = doc.fields.packages;
  return {
    totalPackages: p.length,
    totalQuantity: p.reduce((s, x) => s + num(x.quantity), 0),
    totalNetWeight: p.reduce((s, x) => s + num(x.netWeight), 0),
    totalGrossWeight: p.reduce((s, x) => s + num(x.grossWeight), 0),
    totalVolume: p.reduce((s, x) => s + (num(x.length) * num(x.width) * num(x.height) / 1000000), 0) // cm^3 -> m^3
  };
}

function renderExportPackingList() {
  const doc = getExportDoc(CURRENT_PACKINGLIST_ID);
  const host = $('#screen-exportPackingList');
  if (!doc) { host.innerHTML = '<div class="xd-root"><p class="hint">Packing List not found.</p></div>'; return; }
  const f = doc.fields;
  const t = packingListTotals(doc);
  const versions = docVersionsOfType(doc.exportJobId, 'PACKING_LIST');
  const invoice = currentDocOfType(doc.exportJobId, 'COMMERCIAL_INVOICE');

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / ${esc(doc.exportJobId)} / <b>Packing List</b></div>
      <h1>Packing List <span class="badge ${XD_DOC_STATUS_BADGE[doc.status]}">${esc(doc.status)}</span> <span class="hint">v${doc.version}${versions.length > 1 ? ' of ' + versions.length : ''}</span></h1></div>
      <button class="btn-ghost" onclick="navToExportJobDetail('${doc.exportJobId}')">Back to Export Job</button>
    </div>

    <div class="xd-card"><h3>Header</h3><div class="grid">
      ${fieldHTML({ id: 'pkl__packingListNumber', label: 'Packing List Number', required: true }, f.packingListNumber)}
      ${fieldHTML({ id: 'pkl__date', label: 'Date', required: true, type: 'date' }, f.date)}
      ${fieldHTML({ id: 'pkl__invoiceRef', label: 'Invoice Reference' }, f.invoiceRef)}
      ${fieldHTML({ id: 'pkl__poRef', label: 'PO Reference' }, f.poRef)}
    </div>
    ${invoice ? `<p class="hint">Linked Commercial Invoice on file: <b>${esc(invoice.fields.invoiceNumber || '(number not set)')}</b> (v${invoice.version}, ${esc(invoice.status)}). ${f.invoiceRef ? '' : `<button class="btn-ghost sm" onclick="applyInvoiceRefToPackingList()">Apply Invoice Number &#8594;</button>`}</p>` : '<p class="hint">No Commercial Invoice found for this Export Job yet.</p>'}
    </div>

    <div class="xd-card"><h3>Parties</h3><div class="grid">
      ${fieldHTML({ id: 'pkl__exp_name', label: 'Exporter' }, f.exporter.name)}
      ${fieldHTML({ id: 'pkl__buy_name', label: 'Buyer' }, f.buyer.name)}
      ${fieldHTML({ id: 'pkl__con_name', label: 'Consignee' }, f.consignee.name)}
      ${fieldHTML({ id: 'pkl__not_name', label: 'Notify Party' }, f.notifyParty.name)}
    </div></div>

    <div class="xd-card"><h3>Shipment</h3><div class="grid">
      ${fieldHTML({ id: 'pkl__sh_portOfLoading', label: 'Port of Loading', type: 'select', options: INDIAN_PORTS }, f.shipment.portOfLoading)}
      ${fieldHTML({ id: 'pkl__sh_portOfDischarge', label: 'Port of Discharge', type: 'select', options: FOREIGN_PORTS }, f.shipment.portOfDischarge)}
      ${fieldHTML({ id: 'pkl__sh_vesselFlight', label: 'Vessel / Flight' }, f.shipment.vesselFlight)}
      ${fieldHTML({ id: 'pkl__sh_containerNo', label: 'Container Number' }, f.shipment.containerNo)}
      ${fieldHTML({ id: 'pkl__sh_sealNo', label: 'Seal Number' }, f.shipment.sealNo)}
    </div></div>

    <div class="xd-card"><h3>Package Table</h3>
      <div class="table-wrap"><table class="data-table items-table">
        <thead><tr><th>#</th><th>Pkg No.</th><th>Type</th><th>Marks</th><th>Product</th><th>Qty</th><th>Unit</th><th>N.Wt</th><th>G.Wt</th><th>L×W×H (cm)</th><th>Container</th><th></th></tr></thead>
        <tbody id="pklBody">${f.packages.map((p, i) => packingRowHTML(p, i)).join('')}</tbody>
      </table></div>
      <button class="btn-ghost sm" id="pklAddBtn" type="button">+ Add Package</button>
    </div>

    <div class="xd-card"><h3>Totals</h3>
      <div class="xd-totals" id="pklTotals">
        <div><span>Total Packages</span><b>${t.totalPackages}</b></div>
        <div><span>Total Quantity</span><b>${t.totalQuantity.toLocaleString('en-IN')}</b></div>
        <div><span>Total Net Weight (KG)</span><b>${t.totalNetWeight.toLocaleString('en-IN')}</b></div>
        <div><span>Total Gross Weight (KG)</span><b>${t.totalGrossWeight.toLocaleString('en-IN')}</b></div>
        <div><span>Total Volume (m³)</span><b>${t.totalVolume.toFixed(3)}</b></div>
      </div>
    </div>

    <div class="ferr" id="err_packingList"></div>
    <div class="actions">
      <button class="btn-ghost" onclick="openPrintPreview('PACKING_LIST', '${doc.id}')">🖨 Preview / Print</button>
      <button class="btn-ghost" onclick="savePackingListDraft()">Save Draft</button>
      <button class="next" onclick="markPackingListReady()">Mark Ready</button>
    </div>
  </div>`;

  wirePackingListTable(doc);
  xdWireSuggestions(host, doc.exportJobId, {
    pkl__sh_containerNo: 'containerNo', pkl__sh_sealNo: 'sealNo',
    pkl__exp_name: 'exporterName', pkl__buy_name: 'buyerName', pkl__con_name: 'consigneeName'
  });
}

function packingRowHTML(p, i) {
  return `<tr data-i="${i}">
    <td>${i + 1}</td>
    <td><input class="cell" data-k="packageNumber" value="${esc(p.packageNumber || '')}" style="width:80px"></td>
    <td><select class="cell" data-k="packageType">${PACKAGE_TYPES.map(x => `<option ${p.packageType === x ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
    <td><input class="cell" data-k="marksNumbers" value="${esc(p.marksNumbers || '')}" style="width:90px"></td>
    <td><input class="cell" data-k="product" value="${esc(p.product || '')}" style="min-width:120px"></td>
    <td><input class="cell" data-k="quantity" type="number" value="${p.quantity || ''}" style="width:70px"></td>
    <td><select class="cell" data-k="unit">${UNITS.map(u => `<option ${p.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
    <td><input class="cell" data-k="netWeight" type="number" value="${p.netWeight || ''}" style="width:75px"></td>
    <td><input class="cell" data-k="grossWeight" type="number" value="${p.grossWeight || ''}" style="width:75px"></td>
    <td>
      <input class="cell" data-k="length" type="number" value="${p.length || ''}" style="width:50px" placeholder="L">
      <input class="cell" data-k="width" type="number" value="${p.width || ''}" style="width:50px" placeholder="W">
      <input class="cell" data-k="height" type="number" value="${p.height || ''}" style="width:50px" placeholder="H">
    </td>
    <td><input class="cell" data-k="containerNo" value="${esc(p.containerNo || '')}" style="width:90px"></td>
    <td><button class="row-del" type="button" title="Remove">✕</button></td>
  </tr>`;
}

function wirePackingListTable(doc) {
  const body = $('#pklBody');
  function refresh() {
    saveState();
    const t = packingListTotals(doc);
    const box = $('#pklTotals');
    if (box) {
      const vals = box.querySelectorAll('b');
      vals[0].textContent = t.totalPackages;
      vals[1].textContent = t.totalQuantity.toLocaleString('en-IN');
      vals[2].textContent = t.totalNetWeight.toLocaleString('en-IN');
      vals[3].textContent = t.totalGrossWeight.toLocaleString('en-IN');
      vals[4].textContent = t.totalVolume.toFixed(3);
    }
  }
  $all('tr', body).forEach((tr, i) => {
    tr.addEventListener('input', () => {
      const p = doc.fields.packages[i];
      $all('.cell', tr).forEach(c => {
        const k = c.dataset.k;
        const isNumeric = ['quantity', 'netWeight', 'grossWeight', 'length', 'width', 'height'].includes(k);
        p[k] = isNumeric ? (c.value === '' ? '' : Number(c.value)) : c.value;
      });
      refresh();
    });
    tr.querySelector('.row-del').addEventListener('click', () => { syncPackingListFieldsFromDOM(doc); doc.fields.packages.splice(i, 1); saveState(); renderExportPackingList(); });
  });
  $('#pklAddBtn').addEventListener('click', () => {
    syncPackingListFieldsFromDOM(doc);
    doc.fields.packages.push({ packageNumber: String(doc.fields.packages.length + 1), packageType: 'Carton', marksNumbers: '', product: '', quantity: '', unit: 'PCS', netWeight: '', grossWeight: '', length: '', width: '', height: '', containerNo: '' });
    saveState(); renderExportPackingList();
  });
}

function applyInvoiceRefToPackingList() {
  const doc = getExportDoc(CURRENT_PACKINGLIST_ID);
  const invoice = currentDocOfType(doc.exportJobId, 'COMMERCIAL_INVOICE');
  if (!invoice) return;
  syncPackingListFieldsFromDOM(doc);
  doc.fields.invoiceRef = invoice.fields.invoiceNumber || '';
  saveState();
  toast('Invoice number applied.', 'success');
  renderExportPackingList();
}

function syncPackingListFieldsFromDOM(doc) {
  const host = $('#screen-exportPackingList');
  const f = doc.fields;
  const g = (id) => { const n = $('#' + id, host); return n ? n.value : ''; };
  f.packingListNumber = g('pkl__packingListNumber'); f.date = g('pkl__date'); f.invoiceRef = g('pkl__invoiceRef'); f.poRef = g('pkl__poRef');
  f.exporter.name = g('pkl__exp_name'); f.buyer.name = g('pkl__buy_name'); f.consignee.name = g('pkl__con_name'); f.notifyParty.name = g('pkl__not_name');
  f.shipment = { portOfLoading: g('pkl__sh_portOfLoading'), portOfDischarge: g('pkl__sh_portOfDischarge'), vesselFlight: g('pkl__sh_vesselFlight'), containerNo: g('pkl__sh_containerNo'), sealNo: g('pkl__sh_sealNo') };
}

function persistPackingListEdit(doc, makeReady) {
  syncPackingListFieldsFromDOM(doc);
  if (doc.status === 'READY') {
    doc.status = 'SUPERSEDED';
    const newDoc = { id: newId('XDOC-PKL'), exportJobId: doc.exportJobId, type: 'PACKING_LIST', version: doc.version + 1, status: makeReady ? 'READY' : 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: JSON.parse(JSON.stringify(doc.fields)) };
    STATE.exportDocs.push(newDoc);
    CURRENT_PACKINGLIST_ID = newDoc.id;
    saveState();
    return newDoc;
  }
  doc.status = makeReady ? 'READY' : 'DRAFT';
  doc.updatedAt = Date.now();
  saveState();
  return doc;
}

function savePackingListDraft() {
  const doc = getExportDoc(CURRENT_PACKINGLIST_ID);
  persistPackingListEdit(doc, false);
  toast('Packing List draft saved.', 'success');
  renderExportPackingList();
}

function markPackingListReady() {
  const doc = getExportDoc(CURRENT_PACKINGLIST_ID);
  const host = $('#screen-exportPackingList');
  clearFieldErrors(host);
  syncPackingListFieldsFromDOM(doc);
  const errs = [];
  if (!doc.fields.packingListNumber) errs.push('Packing List Number is required');
  if (!doc.fields.date) errs.push('Date is required');
  if (!doc.fields.packages.length) errs.push('At least one package row is required');
  if (errs.length) {
    showFieldError(host, 'packingList', errs.join(' · '));
    toast('Fix the highlighted issues before marking Ready.', 'error');
    return;
  }
  const readyDoc = persistPackingListEdit(doc, true);
  toast('Packing List marked Ready.', 'success');
  xdCheckBridgeCompletion('PACKING_LIST', readyDoc.id, 'Packing List');
  navToExportJobDetail(doc.exportJobId);
}
