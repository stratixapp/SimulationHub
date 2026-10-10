/* ============================================================
   CONSIGNIA DESK — Cross-Document Value Suggestions
   ------------------------------------------------------------
   If "MSCU1234567" was typed into the Commercial Invoice, it
   should show up as a suggestion (not an autofill — the student
   still has to pick it) when typing the same kind of value into
   the Packing List or Bill of Lading. Uses native HTML5
   <datalist>, so it's just a dropdown-while-typing — never
   silently fills anything, never blocks a different value.
   ============================================================ */

function xdCollectSuggestions(exportJobId) {
  const docs = STATE.exportDocs.filter(d => d.exportJobId === exportJobId && d.status !== 'SUPERSEDED');
  const sets = {
    containerNo: new Set(), sealNo: new Set(), hsCode: new Set(), iec: new Set(), gstin: new Set(),
    buyerName: new Set(), exporterName: new Set(), consigneeName: new Set(), invoiceNumber: new Set(),
    portOfLoading: new Set(), portOfDischarge: new Set(), currency: new Set()
  };
  function add(set, v) { if (v !== undefined && v !== null && String(v).trim() !== '') set.add(String(v).trim()); }

  docs.forEach(doc => {
    const f = doc.fields;
    if (doc.type === 'COMMERCIAL_INVOICE') {
      add(sets.invoiceNumber, f.invoiceNumber);
      add(sets.iec, f.exporter.iec); add(sets.gstin, f.exporter.gstin);
      add(sets.exporterName, f.exporter.legalName); add(sets.buyerName, f.buyer.legalName); add(sets.consigneeName, f.consignee.name);
      add(sets.containerNo, f.shipment.containerNo); add(sets.sealNo, f.shipment.sealNo);
      add(sets.portOfLoading, f.shipment.portOfLoading); add(sets.portOfDischarge, f.shipment.portOfDischarge);
      add(sets.currency, f.currency);
      (f.items || []).forEach(it => add(sets.hsCode, it.hsCode));
    } else if (doc.type === 'PACKING_LIST') {
      add(sets.exporterName, f.exporter.name); add(sets.buyerName, f.buyer.name); add(sets.consigneeName, f.consignee.name);
      add(sets.containerNo, f.shipment.containerNo); add(sets.sealNo, f.shipment.sealNo);
      add(sets.portOfLoading, f.shipment.portOfLoading); add(sets.portOfDischarge, f.shipment.portOfDischarge);
    } else if (doc.type === 'BILL_OF_LADING' || doc.type === 'AIR_WAYBILL') {
      add(sets.exporterName, f.shipper.name); add(sets.consigneeName, f.consignee.name);
      (f.containers || []).forEach(c => { add(sets.containerNo, c.containerNo); add(sets.sealNo, c.sealNo); });
      add(sets.portOfLoading, f.routing.portOfLoading); add(sets.portOfDischarge, f.routing.portOfDischarge);
      add(sets.currency, f.freight.currency);
    } else if (doc.type === 'CERTIFICATE_OF_ORIGIN') {
      add(sets.iec, f.exporter.iec); add(sets.exporterName, f.exporter.name); add(sets.consigneeName, f.consignee.name); add(sets.hsCode, f.hsCode);
    } else if (doc.type === 'INSURANCE_CERTIFICATE') {
      add(sets.exporterName, f.exporter); add(sets.buyerName, f.buyer);
      add(sets.portOfLoading, f.portOfLoading); add(sets.portOfDischarge, f.portOfDischarge);
    }
  });

  const out = {};
  Object.keys(sets).forEach(k => out[k] = [...sets[k]]);
  return out;
}

function xdDatalistsHTML(suggestions) {
  return Object.keys(suggestions).map(k =>
    `<datalist id="xdsug_${k}">${suggestions[k].map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`
  ).join('');
}

/* Call after a screen renders: attaches list="xdsug_<key>" to any input whose
   id maps to a suggestion key, and injects the <datalist> elements. Never
   overwrites what's already typed — purely additive to the input's own
   native autocomplete dropdown. */
function xdWireSuggestions(host, exportJobId, idToKeyMap) {
  if (!host) return;
  const suggestions = xdCollectSuggestions(exportJobId);
  host.insertAdjacentHTML('beforeend', xdDatalistsHTML(suggestions));
  Object.keys(idToKeyMap).forEach(id => {
    const node = $('#' + id, host);
    if (node) node.setAttribute('list', 'xdsug_' + idToKeyMap[id]);
  });
  // Table cells (container/seal number columns) share one suggestion list per column.
  $all('[data-k="containerNo"]', host).forEach(n => n.setAttribute('list', 'xdsug_containerNo'));
  $all('[data-k="sealNo"]', host).forEach(n => n.setAttribute('list', 'xdsug_sealNo'));
  $all('[data-k="hsCode"]', host).forEach(n => { if (n.tagName === 'INPUT') n.setAttribute('list', 'xdsug_hsCode'); });
}
