/* ============================================================
   CONSIGNIA DESK — Commercial Invoice
   ------------------------------------------------------------
   A real, versioned document (Section 6 of the Export
   Documentation Simulator spec) — not the Shipping Bill's
   shallow invoice step, and not the fake e-Sanchit upload row.
   ============================================================ */

function blankInvoiceFields() {
  return {
    invoiceNumber: '', invoiceDate: '', exportOrderRef: '', poRef: '', contractNumber: '', proformaRef: '', invoiceType: 'Commercial',
    currency: '',
    exporter: { legalName: '', address: '', country: 'India', iec: '', gstin: '', pan: '', contact: '', email: '', authorizedSignatory: '' },
    buyer: { legalName: '', address: '', country: '', contact: '', email: '', buyerRef: '' },
    consignee: { name: '', address: '', country: '', contact: '' },
    notifyParty: { name: '', address: '', country: '' },
    shipment: { countryOfOrigin: 'India', countryOfFinalDestination: '', portOfLoading: '', portOfDischarge: '', placeOfDelivery: '', finalDestination: '', mode: '', vesselFlight: '', voyageFlightNo: '', containerNo: '', sealNo: '' },
    commercialTerms: { incoterm: '', incotermPlace: '', paymentTerms: '', freight: '', insurance: '', discount: '', commission: '', otherCharges: '', fobValue: '' },
    items: [],
    declaration: { signatoryName: '', signatoryTitle: '', place: '', date: '' }
  };
}

function openInvoiceWorkstation(jobId) {
  const job = getExportJob(jobId);
  let doc = currentDocOfType(jobId, 'COMMERCIAL_INVOICE');
  if (!doc) {
    doc = { id: newId('XDOC-INV'), exportJobId: jobId, type: 'COMMERCIAL_INVOICE', version: 1, status: 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: blankInvoiceFields() };
    doc.fields.currency = job.brief.currency || '';
    doc.fields.shipment.mode = job.brief.mode || '';
    doc.fields.shipment.countryOfFinalDestination = job.brief.destinationCountry || '';
    doc.fields.commercialTerms.incoterm = job.brief.incoterm || '';
    STATE.exportDocs.push(doc);
    saveState();
  }
  CURRENT_INVOICE_ID = doc.id;
  CURRENT_EXPORT_JOB_ID = jobId;
  navTo('exportInvoice');
}
var CURRENT_INVOICE_ID = null;

function invoiceLineValue(it) { return num(it.quantity) * num(it.unitPrice); }
function invoiceTotals(doc) {
  const items = doc.fields.items;
  const ct = doc.fields.commercialTerms;
  const subtotal = items.reduce((s, it) => s + invoiceLineValue(it), 0);
  const quantityTotal = items.reduce((s, it) => s + num(it.quantity), 0);
  const netWeightTotal = items.reduce((s, it) => s + num(it.netWeight), 0);
  const grossWeightTotal = items.reduce((s, it) => s + num(it.grossWeight), 0);
  const packagesTotal = items.reduce((s, it) => s + num(it.packages), 0);
  const finalInvoiceAmount = safeAmount2(subtotal + num(ct.freight) + num(ct.insurance) + num(ct.otherCharges) - num(ct.discount) - num(ct.commission));
  return { subtotal, quantityTotal, netWeightTotal, grossWeightTotal, packagesTotal, finalInvoiceAmount };
}
function safeAmount2(n) { return (!isFinite(n) || isNaN(n)) ? 0 : Math.round(n * 100) / 100; }

function renderExportInvoice() {
  const doc = getExportDoc(CURRENT_INVOICE_ID);
  const host = $('#screen-exportInvoice');
  if (!doc) { host.innerHTML = '<div class="xd-root"><p class="hint">Invoice not found.</p></div>'; return; }
  const f = doc.fields;
  const t = invoiceTotals(doc);
  const versions = docVersionsOfType(doc.exportJobId, 'COMMERCIAL_INVOICE');

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / ${esc(doc.exportJobId)} / <b>Commercial Invoice</b></div>
      <h1>Commercial Invoice <span class="badge ${XD_DOC_STATUS_BADGE[doc.status]}">${esc(doc.status)}</span> <span class="hint">v${doc.version}${versions.length > 1 ? ' of ' + versions.length : ''}</span></h1></div>
      <button class="btn-ghost" onclick="navToExportJobDetail('${doc.exportJobId}')">Back to Export Job</button>
    </div>

    <div class="xd-card"><h3>A. Invoice Identity</h3><div class="grid">
      ${fieldHTML({ id: 'inv__invoiceNumber', label: 'Invoice Number', required: true }, f.invoiceNumber)}
      ${fieldHTML({ id: 'inv__invoiceDate', label: 'Invoice Date', required: true, type: 'date' }, f.invoiceDate)}
      ${fieldHTML({ id: 'inv__exportOrderRef', label: 'Export Order Reference' }, f.exportOrderRef)}
      ${fieldHTML({ id: 'inv__poRef', label: 'Purchase Order' }, f.poRef)}
      ${fieldHTML({ id: 'inv__contractNumber', label: 'Contract Number' }, f.contractNumber)}
      ${fieldHTML({ id: 'inv__proformaRef', label: 'Proforma Invoice Reference' }, f.proformaRef)}
      ${fieldHTML({ id: 'inv__currency', label: 'Currency', required: true, type: 'select', options: CURRENCIES }, f.currency)}
    </div></div>

    <div class="xd-card"><h3>B. Exporter</h3><div class="grid">
      ${fieldHTML({ id: 'inv__exp_legalName', label: 'Legal Name', required: true }, f.exporter.legalName)}
      ${fieldHTML({ id: 'inv__exp_address', label: 'Address', required: true, full: true }, f.exporter.address)}
      ${fieldHTML({ id: 'inv__exp_country', label: 'Country', type: 'select', options: COUNTRIES }, f.exporter.country)}
      ${fieldHTML({ id: 'inv__exp_iec', label: 'IEC', required: true }, f.exporter.iec)}
      ${fieldHTML({ id: 'inv__exp_gstin', label: 'GSTIN' }, f.exporter.gstin)}
      ${fieldHTML({ id: 'inv__exp_pan', label: 'PAN' }, f.exporter.pan)}
      ${fieldHTML({ id: 'inv__exp_contact', label: 'Contact' }, f.exporter.contact)}
      ${fieldHTML({ id: 'inv__exp_email', label: 'Email' }, f.exporter.email)}
      ${fieldHTML({ id: 'inv__exp_authorizedSignatory', label: 'Authorized Signatory' }, f.exporter.authorizedSignatory)}
    </div></div>

    <div class="xd-card"><h3>C. Buyer</h3><div class="grid">
      ${fieldHTML({ id: 'inv__buy_legalName', label: 'Legal Name', required: true }, f.buyer.legalName)}
      ${fieldHTML({ id: 'inv__buy_address', label: 'Address', required: true, full: true }, f.buyer.address)}
      ${fieldHTML({ id: 'inv__buy_country', label: 'Country', type: 'select', options: COUNTRIES }, f.buyer.country)}
      ${fieldHTML({ id: 'inv__buy_contact', label: 'Contact' }, f.buyer.contact)}
      ${fieldHTML({ id: 'inv__buy_email', label: 'Email' }, f.buyer.email)}
      ${fieldHTML({ id: 'inv__buy_buyerRef', label: 'Buyer Reference' }, f.buyer.buyerRef)}
    </div></div>

    <div class="xd-card"><h3>D. Consignee</h3><div class="grid">
      ${fieldHTML({ id: 'inv__con_name', label: 'Name' }, f.consignee.name)}
      ${fieldHTML({ id: 'inv__con_address', label: 'Address', full: true }, f.consignee.address)}
      ${fieldHTML({ id: 'inv__con_country', label: 'Country', type: 'select', options: COUNTRIES }, f.consignee.country)}
      ${fieldHTML({ id: 'inv__con_contact', label: 'Contact' }, f.consignee.contact)}
    </div></div>

    <div class="xd-card"><h3>E. Notify Party</h3><div class="grid">
      ${fieldHTML({ id: 'inv__not_name', label: 'Name' }, f.notifyParty.name)}
      ${fieldHTML({ id: 'inv__not_address', label: 'Address', full: true }, f.notifyParty.address)}
      ${fieldHTML({ id: 'inv__not_country', label: 'Country', type: 'select', options: COUNTRIES }, f.notifyParty.country)}
    </div></div>

    <div class="xd-card"><h3>F. Shipment</h3><div class="grid">
      ${fieldHTML({ id: 'inv__sh_countryOfOrigin', label: 'Country of Origin', type: 'select', options: COUNTRIES }, f.shipment.countryOfOrigin)}
      ${fieldHTML({ id: 'inv__sh_countryOfFinalDestination', label: 'Country of Final Destination', type: 'select', options: COUNTRIES }, f.shipment.countryOfFinalDestination)}
      ${fieldHTML({ id: 'inv__sh_portOfLoading', label: 'Port of Loading', type: 'select', options: INDIAN_PORTS }, f.shipment.portOfLoading)}
      ${fieldHTML({ id: 'inv__sh_portOfDischarge', label: 'Port of Discharge', type: 'select', options: FOREIGN_PORTS }, f.shipment.portOfDischarge)}
      ${fieldHTML({ id: 'inv__sh_placeOfDelivery', label: 'Place of Delivery' }, f.shipment.placeOfDelivery)}
      ${fieldHTML({ id: 'inv__sh_finalDestination', label: 'Final Destination' }, f.shipment.finalDestination)}
      ${fieldHTML({ id: 'inv__sh_mode', label: 'Mode', type: 'select', options: MODES_OF_TRANSPORT }, f.shipment.mode)}
      ${fieldHTML({ id: 'inv__sh_vesselFlight', label: 'Vessel / Flight' }, f.shipment.vesselFlight)}
      ${fieldHTML({ id: 'inv__sh_voyageFlightNo', label: 'Voyage / Flight No.' }, f.shipment.voyageFlightNo)}
      ${fieldHTML({ id: 'inv__sh_containerNo', label: 'Container Number' }, f.shipment.containerNo)}
      ${fieldHTML({ id: 'inv__sh_sealNo', label: 'Seal Number' }, f.shipment.sealNo)}
    </div></div>

    <div class="xd-card"><h3>G. Commercial Terms</h3><div class="grid">
      ${fieldHTML({ id: 'inv__ct_incoterm', label: 'Incoterm', type: 'select', options: INCOTERMS }, f.commercialTerms.incoterm)}
      ${fieldHTML({ id: 'inv__ct_incotermPlace', label: 'Place (Incoterm)' }, f.commercialTerms.incotermPlace)}
      ${fieldHTML({ id: 'inv__ct_paymentTerms', label: 'Payment Terms' }, f.commercialTerms.paymentTerms)}
      ${fieldHTML({ id: 'inv__ct_fobValue', label: 'FOB Value', type: 'number' }, f.commercialTerms.fobValue)}
      ${fieldHTML({ id: 'inv__ct_freight', label: 'Freight', type: 'number' }, f.commercialTerms.freight)}
      ${fieldHTML({ id: 'inv__ct_insurance', label: 'Insurance', type: 'number' }, f.commercialTerms.insurance)}
      ${fieldHTML({ id: 'inv__ct_discount', label: 'Discount', type: 'number' }, f.commercialTerms.discount)}
      ${fieldHTML({ id: 'inv__ct_commission', label: 'Commission', type: 'number' }, f.commercialTerms.commission)}
      ${fieldHTML({ id: 'inv__ct_otherCharges', label: 'Other Charges', type: 'number' }, f.commercialTerms.otherCharges)}
    </div></div>

    <div class="xd-card"><h3>H. Line Items</h3>
      <div class="table-wrap"><table class="data-table items-table">
        <thead><tr><th>#</th><th>Product</th><th>Description</th><th>HS Code</th><th>Origin</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Line Value</th><th>N.Wt</th><th>G.Wt</th><th>Pkgs</th><th>Pkg Type</th><th>Marks</th><th></th></tr></thead>
        <tbody id="invItemsBody">${f.items.map((it, i) => invoiceItemRowHTML(it, i, f.currency)).join('')}</tbody>
      </table></div>
      <button class="btn-ghost sm" id="invAddItemBtn" type="button">+ Add Item</button>
    </div>

    <div class="xd-card"><h3>I. Totals</h3>
      <div class="xd-totals">
        <div><span>Quantity Total</span><b>${t.quantityTotal.toLocaleString('en-IN')}</b></div>
        <div><span>Net Weight Total (KG)</span><b>${t.netWeightTotal.toLocaleString('en-IN')}</b></div>
        <div><span>Gross Weight Total (KG)</span><b>${t.grossWeightTotal.toLocaleString('en-IN')}</b></div>
        <div><span>Packages Total</span><b>${t.packagesTotal.toLocaleString('en-IN')}</b></div>
        <div><span>Subtotal (line items)</span><b>${fmtMoney(t.subtotal, f.currency)}</b></div>
        <div class="xd-total-final"><span>Final Invoice Amount</span><b>${fmtMoney(t.finalInvoiceAmount, f.currency)}</b></div>
      </div>
      <p class="hint">Final Invoice Amount = Subtotal + Freight + Insurance + Other Charges − Discount − Commission. Recalculated live as you edit line items or commercial terms — never overwrites what you've typed elsewhere.</p>
    </div>

    <div class="xd-card"><h3>J. Declaration</h3><div class="grid">
      ${fieldHTML({ id: 'inv__decl_signatoryName', label: 'Authorized Signatory Name' }, f.declaration.signatoryName)}
      ${fieldHTML({ id: 'inv__decl_signatoryTitle', label: 'Title' }, f.declaration.signatoryTitle)}
      ${fieldHTML({ id: 'inv__decl_place', label: 'Place' }, f.declaration.place)}
      ${fieldHTML({ id: 'inv__decl_date', label: 'Date', type: 'date' }, f.declaration.date)}
      <div class="field full"><p class="hint">"We declare that this invoice shows the actual price of the goods described, that all particulars are true and correct, and that there is no other invoice issued for this shipment differing in any respect from this invoice."</p></div>
    </div></div>

    <div class="ferr" id="err_invoice"></div>
    <div class="actions">
      <button class="btn-ghost" onclick="openPrintPreview('COMMERCIAL_INVOICE', '${doc.id}')">🖨 Preview / Print</button>
      <button class="btn-ghost" onclick="saveInvoiceDraft()">Save Draft</button>
      <button class="next" onclick="markInvoiceReady()">Mark Ready</button>
    </div>
  </div>`;

  wireInvoiceItemsTable(doc);
  xdWireSuggestions(host, doc.exportJobId, {
    inv__sh_containerNo: 'containerNo', inv__sh_sealNo: 'sealNo',
    inv__exp_legalName: 'exporterName', inv__exp_iec: 'iec', inv__exp_gstin: 'gstin',
    inv__buy_legalName: 'buyerName', inv__con_name: 'consigneeName',
    inv__invoiceNumber: 'invoiceNumber', inv__currency: 'currency'
  });
}

function invoiceItemRowHTML(it, i, currency) {
  const hsOptions = Object.keys(HS_CODE_TABLE).map(c => `<option value="${c}" ${it.hsCode === c ? 'selected' : ''}>${c}</option>`).join('');
  return `<tr data-i="${i}">
    <td>${i + 1}</td>
    <td><input class="cell" data-k="product" value="${esc(it.product || '')}" style="min-width:110px"></td>
    <td><input class="cell" data-k="description" value="${esc(it.description || '')}" style="min-width:150px"></td>
    <td><select class="cell" data-k="hsCode" style="min-width:100px"><option value="">Select…</option>${hsOptions}</select></td>
    <td><input class="cell" data-k="countryOfOrigin" value="${esc(it.countryOfOrigin || '')}" style="width:90px"></td>
    <td><input class="cell" data-k="quantity" type="number" value="${it.quantity || ''}" style="width:70px"></td>
    <td><select class="cell" data-k="unit">${UNITS.map(u => `<option ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
    <td><input class="cell" data-k="unitPrice" type="number" value="${it.unitPrice || ''}" style="width:85px"></td>
    <td class="cell-total">${fmtMoney(invoiceLineValue(it), currency)}</td>
    <td><input class="cell" data-k="netWeight" type="number" value="${it.netWeight || ''}" style="width:75px"></td>
    <td><input class="cell" data-k="grossWeight" type="number" value="${it.grossWeight || ''}" style="width:75px"></td>
    <td><input class="cell" data-k="packages" type="number" value="${it.packages || ''}" style="width:60px"></td>
    <td><select class="cell" data-k="packageType">${PACKAGE_TYPES.map(p => `<option ${it.packageType === p ? 'selected' : ''}>${p}</option>`).join('')}</select></td>
    <td><input class="cell" data-k="marksNumbers" value="${esc(it.marksNumbers || '')}" style="width:90px"></td>
    <td><button class="row-del" type="button" title="Remove">✕</button></td>
  </tr>`;
}

function wireInvoiceItemsTable(doc) {
  const body = $('#invItemsBody');
  function refreshRow(tr, i) {
    const it = doc.fields.items[i];
    $all('.cell', tr).forEach(c => {
      const k = c.dataset.k;
      const isNumeric = ['quantity', 'unitPrice', 'netWeight', 'grossWeight', 'packages'].includes(k);
      it[k] = isNumeric ? (c.value === '' ? '' : Number(c.value)) : c.value;
    });
    tr.querySelector('.cell-total').textContent = fmtMoney(invoiceLineValue(it), doc.fields.currency);
    saveState();
    refreshInvoiceTotalsDisplay(doc);
  }
  $all('tr', body).forEach((tr, i) => {
    tr.addEventListener('input', () => refreshRow(tr, i));
    tr.querySelector('.row-del').addEventListener('click', () => { syncInvoiceFieldsFromDOM(doc); doc.fields.items.splice(i, 1); saveState(); renderExportInvoice(); });
  });
  $('#invAddItemBtn').addEventListener('click', () => {
    syncInvoiceFieldsFromDOM(doc);
    doc.fields.items.push({ product: '', description: '', hsCode: '', countryOfOrigin: 'India', quantity: '', unit: 'PCS', unitPrice: '', netWeight: '', grossWeight: '', packages: '', packageType: 'Carton', marksNumbers: '' });
    saveState(); renderExportInvoice();
  });
}
function refreshInvoiceTotalsDisplay(doc) {
  const t = invoiceTotals(doc);
  const box = $('.xd-totals');
  if (!box) return;
  const vals = box.querySelectorAll('b');
  vals[0].textContent = t.quantityTotal.toLocaleString('en-IN');
  vals[1].textContent = t.netWeightTotal.toLocaleString('en-IN');
  vals[2].textContent = t.grossWeightTotal.toLocaleString('en-IN');
  vals[3].textContent = t.packagesTotal.toLocaleString('en-IN');
  vals[4].textContent = fmtMoney(t.subtotal, doc.fields.currency);
  vals[5].textContent = fmtMoney(t.finalInvoiceAmount, doc.fields.currency);
}

/* Reads every non-table field back from the DOM into doc.fields. Table (items) is kept
   live-synced by wireInvoiceItemsTable already, so it's not re-read here. */
function syncInvoiceFieldsFromDOM(doc) {
  const host = $('#screen-exportInvoice');
  const f = doc.fields;
  const g = (id) => { const n = $('#' + id, host); return n ? n.value : ''; };
  f.invoiceNumber = g('inv__invoiceNumber'); f.invoiceDate = g('inv__invoiceDate');
  f.exportOrderRef = g('inv__exportOrderRef'); f.poRef = g('inv__poRef'); f.contractNumber = g('inv__contractNumber'); f.proformaRef = g('inv__proformaRef');
  f.currency = g('inv__currency');
  f.exporter = { legalName: g('inv__exp_legalName'), address: g('inv__exp_address'), country: g('inv__exp_country'), iec: g('inv__exp_iec'), gstin: g('inv__exp_gstin'), pan: g('inv__exp_pan'), contact: g('inv__exp_contact'), email: g('inv__exp_email'), authorizedSignatory: g('inv__exp_authorizedSignatory') };
  f.buyer = { legalName: g('inv__buy_legalName'), address: g('inv__buy_address'), country: g('inv__buy_country'), contact: g('inv__buy_contact'), email: g('inv__buy_email'), buyerRef: g('inv__buy_buyerRef') };
  f.consignee = { name: g('inv__con_name'), address: g('inv__con_address'), country: g('inv__con_country'), contact: g('inv__con_contact') };
  f.notifyParty = { name: g('inv__not_name'), address: g('inv__not_address'), country: g('inv__not_country') };
  f.shipment = { countryOfOrigin: g('inv__sh_countryOfOrigin'), countryOfFinalDestination: g('inv__sh_countryOfFinalDestination'), portOfLoading: g('inv__sh_portOfLoading'), portOfDischarge: g('inv__sh_portOfDischarge'), placeOfDelivery: g('inv__sh_placeOfDelivery'), finalDestination: g('inv__sh_finalDestination'), mode: g('inv__sh_mode'), vesselFlight: g('inv__sh_vesselFlight'), voyageFlightNo: g('inv__sh_voyageFlightNo'), containerNo: g('inv__sh_containerNo'), sealNo: g('inv__sh_sealNo') };
  f.commercialTerms = { incoterm: g('inv__ct_incoterm'), incotermPlace: g('inv__ct_incotermPlace'), paymentTerms: g('inv__ct_paymentTerms'), fobValue: g('inv__ct_fobValue'), freight: g('inv__ct_freight'), insurance: g('inv__ct_insurance'), discount: g('inv__ct_discount'), commission: g('inv__ct_commission'), otherCharges: g('inv__ct_otherCharges') };
  f.declaration = { signatoryName: g('inv__decl_signatoryName'), signatoryTitle: g('inv__decl_signatoryTitle'), place: g('inv__decl_place'), date: g('inv__decl_date') };
}

/* Versioning (Section 32): editing a document that's already READY creates a new
   version instead of mutating the ready one in place — the old version is kept,
   marked SUPERSEDED, for audit trail. A DRAFT just saves in place. */
function persistInvoiceEdit(doc, makeReady) {
  syncInvoiceFieldsFromDOM(doc);
  if (doc.status === 'READY') {
    doc.status = 'SUPERSEDED';
    const newDoc = { id: newId('XDOC-INV'), exportJobId: doc.exportJobId, type: 'COMMERCIAL_INVOICE', version: doc.version + 1, status: makeReady ? 'READY' : 'DRAFT', createdAt: Date.now(), updatedAt: Date.now(), fields: JSON.parse(JSON.stringify(doc.fields)) };
    STATE.exportDocs.push(newDoc);
    CURRENT_INVOICE_ID = newDoc.id;
    saveState();
    return newDoc;
  }
  doc.status = makeReady ? 'READY' : 'DRAFT';
  doc.updatedAt = Date.now();
  saveState();
  return doc;
}

function saveInvoiceDraft() {
  const doc = getExportDoc(CURRENT_INVOICE_ID);
  persistInvoiceEdit(doc, false);
  toast('Invoice draft saved.', 'success');
  renderExportInvoice();
}

function markInvoiceReady() {
  const doc = getExportDoc(CURRENT_INVOICE_ID);
  const host = $('#screen-exportInvoice');
  clearFieldErrors(host);
  syncInvoiceFieldsFromDOM(doc);
  const errs = [];
  if (!doc.fields.invoiceNumber) errs.push('Invoice Number is required');
  if (!doc.fields.invoiceDate) errs.push('Invoice Date is required');
  if (!doc.fields.currency) errs.push('Currency is required');
  if (!doc.fields.exporter.legalName) errs.push('Exporter Legal Name is required');
  if (!doc.fields.exporter.iec) errs.push('Exporter IEC is required');
  if (!doc.fields.buyer.legalName) errs.push('Buyer Legal Name is required');
  if (!doc.fields.items.length) errs.push('At least one line item is required');
  if (errs.length) {
    showFieldError(host, 'invoice', errs.join(' · '));
    toast('Fix the highlighted issues before marking Ready.', 'error');
    return;
  }
  const readyDoc = persistInvoiceEdit(doc, true);
  toast('Commercial Invoice marked Ready.', 'success');
  xdCheckBridgeCompletion('COMMERCIAL_INVOICE', readyDoc.id, 'Commercial Invoice');
  navToExportJobDetail(doc.exportJobId);
}
