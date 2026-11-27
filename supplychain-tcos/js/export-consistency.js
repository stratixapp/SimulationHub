/* ============================================================
   CONSIGNIA DESK — Cross-Document Consistency Engine (v1)
   ------------------------------------------------------------
   Covers: Commercial Invoice ↔ Packing List ↔ linked Shipping
   Bill filing. Deliberately does NOT show the two differing
   values side by side (Section 22 of the spec) — the student
   is told WHAT and WHERE, not the answer.
   ============================================================ */

const XD_TOLERANCE_PCT = 0.02; // 2% numeric tolerance before flagging a numeric mismatch

function xdNumMismatch(a, b) {
  const na = num(a), nb = num(b);
  if (na === 0 && nb === 0) return false;
  if (na === 0 || nb === 0) return true;
  return Math.abs(na - nb) / Math.max(na, nb) > XD_TOLERANCE_PCT;
}
function xdStrMismatch(a, b) {
  if (!a || !b) return false; // one side blank isn't a mismatch — it's just not entered yet
  return String(a).trim().toLowerCase() !== String(b).trim().toLowerCase();
}

function runConsistencyCheck(jobId) {
  const job = getExportJob(jobId);
  const invoice = currentDocOfType(jobId, 'COMMERCIAL_INVOICE');
  const pkl = currentDocOfType(jobId, 'PACKING_LIST');
  const filing = job.linkedFilingId ? getFiling(job.linkedFilingId) : null;
  const results = [];

  function add(docs, field, severity, message) {
    results.push({ docs, field, severity, message });
  }

  if (invoice && pkl) {
    const it = invoiceTotals(invoice), pt = packingListTotals(pkl);
    if (xdStrMismatch(invoice.fields.buyer.legalName, pkl.fields.buyer.name)) add(['Commercial Invoice', 'Packing List'], 'Buyer Name', 'MISMATCH', 'Buyer name differs between these two documents.');
    if (xdStrMismatch(invoice.fields.consignee.name, pkl.fields.consignee.name)) add(['Commercial Invoice', 'Packing List'], 'Consignee Name', 'MISMATCH', 'Consignee name differs between these two documents.');
    if (xdStrMismatch(invoice.fields.shipment.portOfLoading, pkl.fields.shipment.portOfLoading)) add(['Commercial Invoice', 'Packing List'], 'Port of Loading', 'WARNING', 'Port of Loading differs between these two documents.');
    if (xdStrMismatch(invoice.fields.shipment.portOfDischarge, pkl.fields.shipment.portOfDischarge)) add(['Commercial Invoice', 'Packing List'], 'Port of Discharge', 'WARNING', 'Port of Discharge differs between these two documents.');
    if (xdStrMismatch(invoice.fields.shipment.containerNo, pkl.fields.shipment.containerNo)) add(['Commercial Invoice', 'Packing List'], 'Container Number', 'CRITICAL', 'Container number differs between these two documents.');
    if (xdStrMismatch(invoice.fields.shipment.sealNo, pkl.fields.shipment.sealNo)) add(['Commercial Invoice', 'Packing List'], 'Seal Number', 'CRITICAL', 'Seal number differs between these two documents.');
    if (it.netWeightTotal && pt.totalNetWeight && xdNumMismatch(it.netWeightTotal, pt.totalNetWeight)) add(['Commercial Invoice', 'Packing List'], 'Net Weight Total', 'MISMATCH', 'Declared net weight total does not reconcile between these two documents.');
    if (it.grossWeightTotal && pt.totalGrossWeight && xdNumMismatch(it.grossWeightTotal, pt.totalGrossWeight)) add(['Commercial Invoice', 'Packing List'], 'Gross Weight Total', 'MISMATCH', 'Declared gross weight total does not reconcile between these two documents.');
    if (it.quantityTotal && pt.totalQuantity && xdNumMismatch(it.quantityTotal, pt.totalQuantity)) add(['Commercial Invoice', 'Packing List'], 'Quantity Total', 'MISMATCH', 'Declared quantity total does not reconcile between these two documents.');
  } else if (invoice && !pkl) {
    add(['Packing List'], 'Document', 'MISSING', 'Packing List has not been started yet — cannot cross-check against the Commercial Invoice.');
  } else if (pkl && !invoice) {
    add(['Commercial Invoice'], 'Document', 'MISSING', 'Commercial Invoice has not been started yet — cannot cross-check against the Packing List.');
  }

  if (filing && invoice) {
    if (xdStrMismatch(filing.invoice.invoiceNo, invoice.fields.invoiceNumber)) add(['Commercial Invoice', 'Shipping Bill'], 'Invoice Number', 'CRITICAL', 'Invoice number on the Shipping Bill does not match the Commercial Invoice.');
    if (filing.invoice.currency && invoice.fields.currency && filing.invoice.currency !== invoice.fields.currency) add(['Commercial Invoice', 'Shipping Bill'], 'Currency', 'CRITICAL', 'Declared currency on the Shipping Bill does not match the Commercial Invoice.');
    if (xdNumMismatch(filing.invoice.invoiceValue, invoiceTotals(invoice).finalInvoiceAmount)) add(['Commercial Invoice', 'Shipping Bill'], 'Invoice Value', 'MISMATCH', 'Declared invoice value on the Shipping Bill does not reconcile with the Commercial Invoice total.');
    if (xdStrMismatch(filing.counterparty.consigneeName, invoice.fields.buyer.legalName)) add(['Commercial Invoice', 'Shipping Bill'], 'Buyer / Consignee Name', 'MISMATCH', 'Buyer/Consignee name on the Shipping Bill does not match the Commercial Invoice.');
    if (xdStrMismatch(filing.shipment.portOfLoading, invoice.fields.shipment.portOfLoading)) add(['Commercial Invoice', 'Shipping Bill'], 'Port of Loading', 'WARNING', 'Port of Loading on the Shipping Bill does not match the Commercial Invoice.');
    const filingHS = new Set((filing.items || []).map(i => i.hsCode).filter(Boolean));
    const invoiceHS = new Set(invoice.fields.items.map(i => i.hsCode).filter(Boolean));
    if (filingHS.size && invoiceHS.size && [...filingHS].some(c => !invoiceHS.has(c))) add(['Commercial Invoice', 'Shipping Bill'], 'HS Code', 'MISMATCH', 'HS Code(s) declared on the Shipping Bill do not all appear on the Commercial Invoice.');
  }
  if (filing && pkl) {
    if (xdNumMismatch(filing.packages.grossWeight, packingListTotals(pkl).totalGrossWeight)) add(['Packing List', 'Shipping Bill'], 'Gross Weight', 'MISMATCH', 'Declared gross weight on the Shipping Bill does not reconcile with the Packing List total.');
    if (xdNumMismatch(filing.packages.netWeight, packingListTotals(pkl).totalNetWeight)) add(['Packing List', 'Shipping Bill'], 'Net Weight', 'MISMATCH', 'Declared net weight on the Shipping Bill does not reconcile with the Packing List total.');
    if (filing.packages.numberOfPackages && xdNumMismatch(filing.packages.numberOfPackages, packingListTotals(pkl).totalPackages)) add(['Packing List', 'Shipping Bill'], 'Package Count', 'WARNING', 'Declared package count on the Shipping Bill does not reconcile with the Packing List.');
  }

  const transportType = transportDocType(job);
  const transportDoc = currentDocOfType(jobId, transportType);
  const transportLabel = transportDocLabel(transportType);
  if (transportDoc && invoice) {
    if (xdStrMismatch(transportDoc.fields.consignee.name, invoice.fields.consignee.name || invoice.fields.buyer.legalName)) add(['Commercial Invoice', transportLabel], 'Consignee Name', 'MISMATCH', `Consignee name on the ${transportLabel} does not match the Commercial Invoice.`);
    if (xdStrMismatch(transportDoc.fields.routing.portOfLoading, invoice.fields.shipment.portOfLoading)) add(['Commercial Invoice', transportLabel], 'Port of Loading', 'WARNING', `Port of Loading on the ${transportLabel} does not match the Commercial Invoice.`);
    if (xdStrMismatch(transportDoc.fields.routing.portOfDischarge, invoice.fields.shipment.portOfDischarge)) add(['Commercial Invoice', transportLabel], 'Port of Discharge', 'WARNING', `Port of Discharge on the ${transportLabel} does not match the Commercial Invoice.`);
    if (xdStrMismatch(transportDocContainerNosJoined(transportDoc), invoice.fields.shipment.containerNo)) add(['Commercial Invoice', transportLabel], 'Container Number', 'CRITICAL', `Container number on the ${transportLabel} does not match the Commercial Invoice.`);
    if (xdNumMismatch(transportDocTotals(transportDoc).totalGrossWeight, invoiceTotals(invoice).grossWeightTotal)) add(['Commercial Invoice', transportLabel], 'Gross Weight', 'MISMATCH', `Gross weight on the ${transportLabel} does not reconcile with the Commercial Invoice.`);
  } else if (invoice && !transportDoc && job.documentPlan.find(d => d.doc === transportType && d.status === 'REQUIRED')) {
    add([transportLabel], 'Document', 'MISSING', `${transportLabel} has not been started yet — it is required for this shipment mode.`);
  }
  if (transportDoc && pkl) {
    if (xdNumMismatch(transportDocTotals(transportDoc).totalGrossWeight, packingListTotals(pkl).totalGrossWeight)) add(['Packing List', transportLabel], 'Gross Weight', 'MISMATCH', `Gross weight on the ${transportLabel} does not reconcile with the Packing List total.`);
    if (xdStrMismatch(transportDocContainerNosJoined(transportDoc), pkl.fields.shipment.containerNo)) add(['Packing List', transportLabel], 'Container Number', 'CRITICAL', `Container number on the ${transportLabel} does not match the Packing List.`);
  }

  const counts = { MATCH: 0, WARNING: 0, MISMATCH: 0, CRITICAL: 0, MISSING: 0 };
  results.forEach(r => counts[r.severity] = (counts[r.severity] || 0) + 1);
  const check = { id: newId('XCHK'), exportJobId: jobId, ts: Date.now(), results, counts };
  const existingIdx = STATE.consistencyChecks.findIndex(c => c.exportJobId === jobId && !c.kind);
  if (existingIdx >= 0) STATE.consistencyChecks[existingIdx] = check; else STATE.consistencyChecks.push(check);
  saveState();
  return check;
}

const XD_SEVERITY_BADGE = { WARNING: 'badge-amber', MISMATCH: 'badge-red', CRITICAL: 'badge-red', MISSING: 'badge-grey' };

function renderConsistencySummary(check) {
  const issues = check.results;
  if (!issues.length) {
    return `<p class="hint">Last run ${fmtDateTime(check.ts)}: no discrepancies detected across the documents available so far.</p>`;
  }
  return `<p class="hint">Last run ${fmtDateTime(check.ts)} — ${issues.length} item(s) flagged. Values are not shown here on purpose: open the listed documents and compare them yourself.</p>
  <div class="table-wrap"><table class="data-table">
    <thead><tr><th>Severity</th><th>Field</th><th>Documents Involved</th><th>Observation</th></tr></thead>
    <tbody>${issues.map(r => `<tr>
      <td><span class="badge ${XD_SEVERITY_BADGE[r.severity]}">${esc(r.severity)}</span></td>
      <td>${esc(r.field)}</td>
      <td>${r.docs.map(esc).join(' vs ')}</td>
      <td>${esc(r.message)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
