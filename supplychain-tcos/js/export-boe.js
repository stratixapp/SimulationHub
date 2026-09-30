/* ============================================================
   CONSIGNIA DESK — Bill of Exchange
   ============================================================ */

function blankBoeFields() {
  return {
    drawer: '', drawee: '', payee: '',
    amount: '', currency: '', date: '', tenor: 'At Sight',
    invoiceRef: '', lcRef: '', placeOfPayment: '',
    acceptance: '', signatory: ''
  };
}

function openBoeWorkstation(jobId) {
  const job = getExportJob(jobId);
  let doc = currentDocOfType(jobId, 'BILL_OF_EXCHANGE');
  if (!doc) {
    doc = { id: newId('XDOC-BOE'), exportJobId: jobId, type: 'BILL_OF_EXCHANGE', version: 1, status: 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: blankBoeFields() };
    doc.fields.currency = job.brief.currency || '';
    STATE.exportDocs.push(doc);
    saveState();
  }
  CURRENT_BOE_ID = doc.id;
  CURRENT_EXPORT_JOB_ID = jobId;
  navTo('exportBoe');
}
var CURRENT_BOE_ID = null;

function applySourcesToBoe() {
  const doc = getExportDoc(CURRENT_BOE_ID);
  const invoice = currentDocOfType(doc.exportJobId, 'COMMERCIAL_INVOICE');
  const lc = currentDocOfType(doc.exportJobId, 'LETTER_OF_CREDIT');
  syncBoeFieldsFromDOM(doc);
  const f = doc.fields;
  if (invoice) {
    f.drawer = invoice.fields.exporter.legalName;
    f.drawee = lc ? lc.fields.issuingBank : invoice.fields.buyer.legalName;
    f.payee = invoice.fields.exporter.legalName;
    f.amount = invoiceTotals(invoice).finalInvoiceAmount;
    f.currency = invoice.fields.currency;
    f.invoiceRef = invoice.fields.invoiceNumber;
  }
  if (lc) { f.lcRef = lc.fields.lcNumber; f.tenor = lc.fields.availability === 'Usance' ? `${lc.fields.tenorDays || ''} days after sight` : 'At Sight'; }
  saveState();
  toast('Applied from Invoice/LC on file — review before marking Ready.', 'success');
  renderExportBoe();
}

function renderExportBoe() {
  const doc = getExportDoc(CURRENT_BOE_ID);
  const host = $('#screen-exportBoe');
  if (!doc) { host.innerHTML = '<div class="xd-root"><p class="hint">Bill of Exchange not found.</p></div>'; return; }
  const f = doc.fields;
  const versions = docVersionsOfType(doc.exportJobId, 'BILL_OF_EXCHANGE');

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / ${esc(doc.exportJobId)} / <b>Bill of Exchange</b></div>
      <h1>Bill of Exchange <span class="badge ${XD_DOC_STATUS_BADGE[doc.status]}">${esc(doc.status)}</span> <span class="hint">v${doc.version}${versions.length > 1 ? ' of ' + versions.length : ''}</span></h1></div>
      <button class="btn-ghost" onclick="navToExportJobDetail('${doc.exportJobId}')">Back to Export Job</button>
    </div>

    <div class="xd-card"><p class="hint">Sources Drawer/Drawee/Payee/Amount from the Commercial Invoice and Tenor from the Letter of Credit, if on file. <button class="btn-ghost sm" onclick="applySourcesToBoe()">Apply from Invoice / LC →</button></p></div>

    <div class="xd-card"><h3>Parties</h3><div class="grid">
      ${fieldHTML({ id: 'boe__drawer', label: 'Drawer', required: true }, f.drawer)}
      ${fieldHTML({ id: 'boe__drawee', label: 'Drawee', required: true }, f.drawee)}
      ${fieldHTML({ id: 'boe__payee', label: 'Payee', required: true }, f.payee)}
    </div></div>

    <div class="xd-card"><h3>Financial</h3><div class="grid">
      ${fieldHTML({ id: 'boe__amount', label: 'Amount', required: true, type: 'number' }, f.amount)}
      ${fieldHTML({ id: 'boe__currency', label: 'Currency', type: 'select', options: CURRENCIES }, f.currency)}
      ${fieldHTML({ id: 'boe__date', label: 'Date', type: 'date' }, f.date)}
      ${fieldHTML({ id: 'boe__tenor', label: 'Tenor' }, f.tenor)}
      ${fieldHTML({ id: 'boe__placeOfPayment', label: 'Place of Payment' }, f.placeOfPayment)}
    </div></div>

    <div class="xd-card"><h3>References</h3><div class="grid">
      ${fieldHTML({ id: 'boe__invoiceRef', label: 'Underlying Invoice Reference' }, f.invoiceRef)}
      ${fieldHTML({ id: 'boe__lcRef', label: 'LC Reference (if applicable)' }, f.lcRef)}
    </div></div>

    <div class="xd-card"><h3>Acceptance &amp; Signature</h3><div class="grid">
      ${fieldHTML({ id: 'boe__acceptance', label: 'Acceptance', type: 'select', options: ['Not Yet Presented', 'Accepted', 'Dishonoured'] }, f.acceptance)}
      ${fieldHTML({ id: 'boe__signatory', label: 'Signatory' }, f.signatory)}
    </div></div>

    <div class="ferr" id="err_boe"></div>
    <div class="actions">
      <button class="btn-ghost" onclick="openPrintPreview('BILL_OF_EXCHANGE', '${doc.id}')">🖨 Preview / Print</button>
      <button class="btn-ghost" onclick="saveBoeDraft()">Save Draft</button>
      <button class="next" onclick="markBoeReady()">Mark Ready</button>
    </div>
  </div>`;
}

function syncBoeFieldsFromDOM(doc) {
  const host = $('#screen-exportBoe');
  const f = doc.fields;
  const g = (id) => { const n = $('#' + id, host); return n ? n.value : ''; };
  if (!host || !$('#boe__drawer', host)) return;
  f.drawer = g('boe__drawer'); f.drawee = g('boe__drawee'); f.payee = g('boe__payee');
  f.amount = g('boe__amount'); f.currency = g('boe__currency'); f.date = g('boe__date'); f.tenor = g('boe__tenor'); f.placeOfPayment = g('boe__placeOfPayment');
  f.invoiceRef = g('boe__invoiceRef'); f.lcRef = g('boe__lcRef');
  f.acceptance = g('boe__acceptance'); f.signatory = g('boe__signatory');
}

function persistBoeEdit(doc, makeReady) {
  syncBoeFieldsFromDOM(doc);
  if (doc.status === 'READY') {
    doc.status = 'SUPERSEDED';
    const newDoc = { id: newId('XDOC-BOE'), exportJobId: doc.exportJobId, type: 'BILL_OF_EXCHANGE', version: doc.version + 1, status: makeReady ? 'READY' : 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: JSON.parse(JSON.stringify(doc.fields)) };
    STATE.exportDocs.push(newDoc);
    CURRENT_BOE_ID = newDoc.id;
    saveState();
    return newDoc;
  }
  doc.status = makeReady ? 'READY' : 'DRAFT';
  doc.updatedAt = Date.now();
  saveState();
  return doc;
}

function saveBoeDraft() { const doc = getExportDoc(CURRENT_BOE_ID); persistBoeEdit(doc, false); toast('Bill of Exchange draft saved.', 'success'); renderExportBoe(); }

function markBoeReady() {
  const doc = getExportDoc(CURRENT_BOE_ID);
  const host = $('#screen-exportBoe');
  clearFieldErrors(host);
  syncBoeFieldsFromDOM(doc);
  const errs = [];
  if (!doc.fields.drawer) errs.push('Drawer is required');
  if (!doc.fields.drawee) errs.push('Drawee is required');
  if (!doc.fields.payee) errs.push('Payee is required');
  if (!doc.fields.amount) errs.push('Amount is required');
  if (errs.length) { showFieldError(host, 'boe', errs.join(' · ')); toast('Fix the highlighted issues before marking Ready.', 'error'); return; }
  const readyDoc = persistBoeEdit(doc, true);
  toast('Bill of Exchange marked Ready.', 'success');
  xdCheckBridgeCompletion('BILL_OF_EXCHANGE', readyDoc.id, 'Bill of Exchange');
  navToExportJobDetail(doc.exportJobId);
}
