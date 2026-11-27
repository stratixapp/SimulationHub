/* ============================================================
   CONSIGNIA DESK — Document Print / PDF
   ------------------------------------------------------------
   No external libraries (jsPDF/html2canvas would break the
   project's offline-first, no-third-party-dependency posture —
   Section 41 of the brief). Uses the browser's native print
   pipeline instead: a dedicated print-only stylesheet plus
   window.print() gives a genuinely professional "Save as PDF"
   result with zero dependencies and zero network calls.
   ============================================================ */

var CURRENT_PRINT_DOC_ID = null;
var CURRENT_PRINT_DOC_TYPE = null;

function openPrintPreview(type, docId) {
  CURRENT_PRINT_DOC_TYPE = type;
  CURRENT_PRINT_DOC_ID = docId;
  navTo('exportPrint');
}

function xdPrintHeader(doc, title) {
  const job = getExportJob(doc.exportJobId);
  return `
  <div class="xd-print-letterhead">
    <div class="xd-print-brand">CONSIGNIA DESK</div>
    <div class="xd-print-doctitle">${esc(title)}</div>
  </div>
  <div class="xd-print-meta">
    <span>Document No./Ref: <b>${esc(xdPrintDocNumber(doc))}</b></span>
    <span>Version: <b>${doc.version}</b></span>
    <span>Status: <b>${esc(doc.status)}</b></span>
    <span>Export Job: <b>${esc(doc.exportJobId)}</b></span>
  </div>
  <div class="xd-print-disclaimer">TRAINING SIMULATOR — Independent educational software. Not affiliated with, endorsed by, or connected to Indian Customs, CBIC, ICEGATE, DGFT, or any government authority. All data is synthetic and no real government filing is performed.</div>
  <hr class="xd-print-rule">`;
}

function xdPrintDocNumber(doc) {
  const f = doc.fields;
  return f.invoiceNumber || f.packingListNumber || f.documentNo || f.certificateNumber || f.policyNumber || f.lcNumber || f.licenseReference || doc.id;
}

function xdPrintFooter() {
  return `<div class="xd-print-footer"><hr class="xd-print-rule">
    <div class="xd-print-sig-row"><div>Prepared by: ____________________</div><div>Date: ____________________</div></div>
  </div>`;
}

function xdPrintRow(label, value) { return `<div class="xd-print-field"><span>${esc(label)}</span><b>${esc(value === undefined || value === null || value === '' ? '\u2014' : String(value))}</b></div>`; }
function xdPrintSection(title, rowsHtml) { return `<div class="xd-print-section"><h4>${esc(title)}</h4><div class="xd-print-grid">${rowsHtml}</div></div>`; }

function xdPrintContentFor(doc) {
  const f = doc.fields;
  switch (doc.type) {
    case 'COMMERCIAL_INVOICE': {
      const t = invoiceTotals(doc);
      return xdPrintSection('Invoice', xdPrintRow('Invoice No.', f.invoiceNumber) + xdPrintRow('Date', f.invoiceDate) + xdPrintRow('Currency', f.currency)) +
        xdPrintSection('Exporter', xdPrintRow('Name', f.exporter.legalName) + xdPrintRow('IEC', f.exporter.iec) + xdPrintRow('Address', f.exporter.address)) +
        xdPrintSection('Buyer', xdPrintRow('Name', f.buyer.legalName) + xdPrintRow('Address', f.buyer.address)) +
        xdPrintSection('Shipment', xdPrintRow('Port of Loading', f.shipment.portOfLoading) + xdPrintRow('Port of Discharge', f.shipment.portOfDischarge) + xdPrintRow('Container', f.shipment.containerNo) + xdPrintRow('Seal', f.shipment.sealNo)) +
        xdPrintItemsTable(f.items, ['Product', 'HS Code', 'Qty', 'Unit', 'Unit Price', 'Line Value'], it => [it.product, it.hsCode, it.quantity, it.unit, it.unitPrice, invoiceLineValue(it).toFixed(2)]) +
        xdPrintSection('Totals', xdPrintRow('Subtotal', fmtMoney(t.subtotal, f.currency)) + xdPrintRow('Final Invoice Amount', fmtMoney(t.finalInvoiceAmount, f.currency)));
    }
    case 'PACKING_LIST': {
      const t = packingListTotals(doc);
      return xdPrintSection('Header', xdPrintRow('Packing List No.', f.packingListNumber) + xdPrintRow('Date', f.date) + xdPrintRow('Invoice Ref.', f.invoiceRef)) +
        xdPrintSection('Parties', xdPrintRow('Exporter', f.exporter.name) + xdPrintRow('Buyer', f.buyer.name) + xdPrintRow('Consignee', f.consignee.name)) +
        xdPrintItemsTable(f.packages, ['Pkg No.', 'Type', 'Product', 'Qty', 'Net Wt', 'Gross Wt'], p => [p.packageNumber, p.packageType, p.product, p.quantity, p.netWeight, p.grossWeight]) +
        xdPrintSection('Totals', xdPrintRow('Total Packages', t.totalPackages) + xdPrintRow('Total Net Weight', t.totalNetWeight) + xdPrintRow('Total Gross Weight', t.totalGrossWeight));
    }
    case 'BILL_OF_LADING': case 'AIR_WAYBILL': {
      const t = transportDocTotals(doc);
      return xdPrintSection('Document', xdPrintRow((doc.type === 'AIR_WAYBILL' ? 'AWB' : 'BL') + ' No.', f.documentNo) + xdPrintRow('Booking No.', f.bookingNo) + xdPrintRow('Date', f.date) + xdPrintRow('Carrier', f.carrier) + xdPrintRow('Release Type', f.releaseType)) +
        xdPrintSection('Shipper', xdPrintRow('Name', f.shipper.name) + xdPrintRow('Address', f.shipper.address)) +
        xdPrintSection('Consignee', xdPrintRow('Name', f.consignee.name) + xdPrintRow('Address', f.consignee.address)) +
        xdPrintSection('Routing', xdPrintRow('Port/Airport of Loading', f.routing.portOfLoading) + xdPrintRow('Port/Airport of Discharge', f.routing.portOfDischarge) + xdPrintRow('Place of Delivery', f.routing.placeOfDelivery)) +
        xdPrintItemsTable(f.containers, ['Container/ULD', 'Seal', 'Type', 'Pkgs', 'Gross Wt', 'Volume'], c => [c.containerNo, c.sealNo, c.containerType, c.packageCount, c.grossWeight, c.measurementVolume]) +
        xdPrintSection('Cargo Totals', xdPrintRow('Total Containers/Pieces', t.totalContainers) + xdPrintRow('Total Gross Weight', t.totalGrossWeight) + xdPrintRow('Description', f.cargo.descriptionOfGoods)) +
        (f.clauses ? xdPrintSection('Clauses', xdPrintRow('Remarks', f.clauses)) : '');
    }
    case 'CERTIFICATE_OF_ORIGIN':
      return xdPrintSection('Certificate', xdPrintRow('Type', f.type) + xdPrintRow('Number', f.certificateNumber) + xdPrintRow('Trade Agreement', f.tradeAgreement)) +
        xdPrintSection('Exporter', xdPrintRow('Name', f.exporter.name) + xdPrintRow('IEC', f.exporter.iec)) +
        xdPrintSection('Consignee', xdPrintRow('Name', f.consignee.name) + xdPrintRow('Country', f.consignee.country)) +
        xdPrintSection('Goods', xdPrintRow('Description', f.goodsDescription) + xdPrintRow('HS Code', f.hsCode) + xdPrintRow('Origin Criterion', f.originCriterion));
    case 'INSURANCE_CERTIFICATE':
      return xdPrintSection('Policy', xdPrintRow('Policy No.', f.policyNumber) + xdPrintRow('Insurer', f.insurer) + xdPrintRow('Date', f.policyDate)) +
        xdPrintSection('Coverage', xdPrintRow('Coverage', f.coverage) + xdPrintRow('Insured Value', fmtMoney(f.insuredValue, f.currency)) + xdPrintRow('Premium', f.premium));
    case 'LETTER_OF_CREDIT':
      return xdPrintSection('LC Identity', xdPrintRow('LC No.', f.lcNumber) + xdPrintRow('Expiry', f.expiryDate) + xdPrintRow('Applicant', f.applicant) + xdPrintRow('Beneficiary', f.beneficiary)) +
        xdPrintSection('Financial', xdPrintRow('Amount', fmtMoney(f.amount, f.currency)) + xdPrintRow('Availability', f.availability)) +
        xdPrintSection('Shipment Conditions', xdPrintRow('Latest Shipment Date', f.latestShipmentDate) + xdPrintRow('Port of Loading', f.portOfLoading) + xdPrintRow('Port of Discharge', f.portOfDischarge));
    case 'BILL_OF_EXCHANGE':
      return xdPrintSection('Bill of Exchange', xdPrintRow('Drawer', f.drawer) + xdPrintRow('Drawee', f.drawee) + xdPrintRow('Payee', f.payee) + xdPrintRow('Amount', fmtMoney(f.amount, f.currency)) + xdPrintRow('Tenor', f.tenor));
    case 'EXPORT_LICENSE':
      return xdPrintSection('Authorization', xdPrintRow('Type', f.licenseType) + xdPrintRow('Reference', f.licenseReference) + xdPrintRow('Status', f.status)) +
        xdPrintSection('Item', xdPrintRow('Product', f.product) + xdPrintRow('HS Code', f.hsCode) + xdPrintRow('End User', f.endUser) + xdPrintRow('End Use', f.endUse));
    default: { // commodity certs — generic field-def driven
      const defs = COMMODITY_CERT_FIELD_DEFS[doc.type];
      if (!defs) return '';
      return xdPrintSection(EXPORT_DOC_CATALOG[doc.type].label, defs.map(d => xdPrintRow(d.label, f[d.key])).join(''));
    }
  }
}

function xdPrintItemsTable(rows, headers, mapFn) {
  if (!rows || !rows.length) return '';
  return `<table class="xd-print-table"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${mapFn(r).map(c => `<td>${esc(c === undefined || c === null || c === '' ? '' : String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function renderExportPrint() {
  const doc = getExportDoc(CURRENT_PRINT_DOC_ID);
  const host = $('#screen-exportPrint');
  if (!doc) { host.innerHTML = '<div class="xd-root"><p class="hint">Document not found.</p></div>'; return; }
  const label = EXPORT_DOC_CATALOG[doc.type] ? EXPORT_DOC_CATALOG[doc.type].label : transportDocLabel(doc.type);

  host.innerHTML = `
  <div class="xd-root xd-print-screen">
    <div class="page-head no-print">
      <div><div class="crumb">Export Documentation Desk / ${esc(doc.exportJobId)} / <b>${esc(label)} — Print Preview</b></div>
      <h1>Print / Save as PDF</h1>
      <p class="hint">Use your browser's Print dialog and choose "Save as PDF" as the destination for a PDF file.</p></div>
      <div>
        <button class="btn-ghost" onclick="navToExportJobDetail('${doc.exportJobId}')">Back</button>
        <button class="next" onclick="window.print()">🖨 Print / Save as PDF</button>
      </div>
    </div>
    <div class="xd-print-sheet">
      ${xdPrintHeader(doc, label)}
      ${xdPrintContentFor(doc)}
      ${xdPrintFooter()}
    </div>
  </div>`;
}
