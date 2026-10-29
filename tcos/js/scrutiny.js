/* ============================================================
   TCOS — CUSTOMS SCRUTINY (what Customs / the system actually checks)
   ------------------------------------------------------------
   1. tcosDeepErrors(filing)    hard ICEGATE-style validation (blocks submission) - identity, GSTIN/PAN,
                                dates, FOB arithmetic, mode vs port, weights ...
   2. tcosScrutinize(filing)    compares what the student TYPED with the source documents of the job
                                (commercial invoice, packing list, booking / BL). A mismatch is NOT blocked at
                                filing - exactly like real life - Customs finds it and raises a specific query.
   3. Query-reply with corrections (tcosQueryPanelHTML / tcosSubmitScrutinyReply).
   4. Source documents viewer (tcosShowSourceDocs).
   5. "Where am I?" step guide (tcosStepGuideHTML).
   6. EGM matching + scroll / refund (tcosProcessScroll).
   ============================================================ */

function tcosSrc(filing) {
  const sc = (typeof scenarioFor === 'function') ? scenarioFor(filing) : null;
  return sc && sc.prefill ? sc.prefill : null;
}
function tcosNorm(v) { return String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function tcosClose(a, b, tol) { a = Number(a); b = Number(b); if (!isFinite(a) || !isFinite(b)) return false; if (b === 0) return a === 0; return Math.abs(a - b) <= Math.abs(b) * (tol == null ? 0.005 : tol); }
function tcosGet(o, path) { return path.reduce((x, k) => (x == null ? undefined : x[k]), o); }
function tcosSet(o, path, v) { let x = o; for (let i = 0; i < path.length - 1; i++) { if (x[path[i]] == null) x[path[i]] = {}; x = x[path[i]]; } x[path[path.length - 1]] = v; }

/* ---------------- 1. hard validation ---------------- */
const TCOS_GST_STATE_CODES = new Set(['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','97','99']);
function tcosIso6346Ok(no) {
  no = String(no || '').replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{4}[0-9]{7}$/.test(no)) return false;
  const letters = '0123456789A?BCDEFGHIJK?LMNOPQRSTU?VWXYZ';
  let sum = 0;
  for (let i = 0; i < 10; i++) { const v = i < 4 ? letters.indexOf(no[i]) : Number(no[i]); sum += v * Math.pow(2, i); }
  return (sum % 11) % 10 === Number(no[10]);
}
function tcosDeepErrors(filing) {
  const errs = [], P = filing.party || {}, S = filing.shipment || {}, I = filing.invoice || {}, K = filing.packages || {};
  const isExp = filing.type === 'export';
  if (P.gstin && P.pan && /^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]/.test(P.gstin) && String(P.gstin).slice(2, 12).toUpperCase() !== String(P.pan).toUpperCase())
    errs.push({ field: 'pan', message: 'PAN does not match the PAN embedded in the GSTIN (characters 3-12). ICEGATE rejects this at validation.' });
  if (P.gstin && /^[0-9]{2}/.test(P.gstin) && !TCOS_GST_STATE_CODES.has(String(P.gstin).slice(0, 2)))
    errs.push({ field: 'gstin', message: 'GSTIN starts with an invalid state code (01-38).' });
  if (I.invoiceDate) {
    const t = new Date(I.invoiceDate).getTime();
    if (isFinite(t) && t > Date.now() + 86400000) errs.push({ field: 'invoiceDate', message: 'Invoice date cannot be in the future.' });
    if (isFinite(t) && t < Date.now() - 400 * 86400000) errs.push({ field: 'invoiceDate', message: 'Invoice date is more than a year old - Customs will not accept a stale invoice.' });
  }
  if (isExp && I.fobValue && I.invoiceValue) {
    const inc = String(I.incoterm || '').toUpperCase(), inv = Number(I.invoiceValue), fr = Number(I.freight) || 0, ins = Number(I.insurance) || 0;
    let exp = null;
    if (inc === 'CIF') exp = inv - fr - ins; else if (inc === 'CFR' || inc === 'CNF') exp = inv - fr; else if (inc === 'FOB' || inc === 'FCA') exp = inv;
    if (exp != null && !tcosClose(I.fobValue, exp, 0.01))
      errs.push({ field: 'fobValue', message: `FOB value does not reconcile with the invoice value for ${inc} terms (FOB = invoice value less freight / insurance included in the price).` });
  }
  const air = /air|flight/i.test(S.modeOfTransport || ''), sea = /sea/i.test(S.modeOfTransport || '');
  const pl = String(S.portOfLoading || '') + ' ' + String(S.portOfDischarge || '');
  if (sea && /airport|air cargo/i.test(pl)) errs.push({ field: 'modeOfTransport', message: 'Mode of transport is Sea but an airport is selected as a port.' });
  if (air && /(port|jnpt)/i.test(pl) && !/airport/i.test(pl.replace(/port of|seaport/gi, ''))) errs.push({ field: 'modeOfTransport', message: 'Mode of transport is Air but a seaport is selected.' });
  if (filing.items && filing.items.length) {
    const gw = filing.items.reduce((s, it) => s + (Number(it.grossWeight) || 0), 0), nw = filing.items.reduce((s, it) => s + (Number(it.netWeight) || 0), 0);
    if (gw > 0 && K.grossWeight && !tcosClose(K.grossWeight, gw, 0.01)) errs.push({ field: 'grossWeight', message: `Total gross weight (${K.grossWeight}) does not equal the sum of item gross weights (${gw}).` });
    if (nw > 0 && K.netWeight && !tcosClose(K.netWeight, nw, 0.01)) errs.push({ field: 'netWeight', message: `Total net weight (${K.netWeight}) does not equal the sum of item net weights (${nw}).` });
  }
  return errs;
}

/* ---------------- 2. scrutiny against the source documents ---------------- */
const TCOS_DOC_FOR = { party: 'IEC / GST registration', counterparty: 'commercial invoice', shipment: 'booking / transport document', invoice: 'commercial invoice', item: 'commercial invoice & packing list', packages: 'packing list' };
function tcosScrutinize(filing) { return tcosScrutinizeDocs(filing).concat(tcosDutyFindings(filing)); }

/* Bill of Entry: self-assessment vs the duty Customs computes (valuation Rule 10, tariff rates) */
function tcosDutyFindings(filing) {
  if (filing.type !== 'import' || typeof tcosComputeDuty !== 'function') return [];
  const a = filing.assessment || {};
  if (!Object.keys(a).some(k => a[k] !== '' && a[k] != null)) return [];
  const d = tcosComputeDuty(filing), out = [];
  const chk = (key, label, exp, tol) => { if (a[key] === '' || a[key] == null) return; if (!tcosClose(a[key], exp, tol || 0.01)) out.push({ code: 'assessment.' + key, cat: 'duty', path: ['assessment', key], label, typed: a[key], expected: Math.round(exp * 100) / 100, severity: 'high', doc: 'Customs valuation rules and tariff rates (CIF + 1% landing charge)' }); };
  chk('assessableValue', 'Assessable value (INR)', d.assessableValue);
  chk('bcdAmount', 'Basic Customs Duty (INR)', d.bcd);
  if (a.swsAmount !== '' && a.swsAmount != null) chk('swsAmount', 'Social Welfare Surcharge (INR)', d.sws);
  chk('igstAmount', 'IGST (INR)', d.igst);
  if (d.add > 0 || Number(a.antiDumpingDuty) > 0) { const t = Number(a.antiDumpingDuty) || 0; if (!tcosClose(t, d.add, 0.01)) out.push({ code: 'assessment.antiDumpingDuty', cat: 'duty', path: ['assessment', 'antiDumpingDuty'], label: 'Anti-dumping / safeguard duty (INR)', typed: a.antiDumpingDuty === '' || a.antiDumpingDuty == null ? 0 : a.antiDumpingDuty, expected: Math.round(d.add * 100) / 100, severity: 'high', doc: 'Customs tariff (anti-dumping notification for the HS)' }); }
  if (d.cess > 0 || Number(a.cessAmount) > 0) { const t = Number(a.cessAmount) || 0; if (!tcosClose(t, d.cess, 0.01)) out.push({ code: 'assessment.cessAmount', cat: 'duty', path: ['assessment', 'cessAmount'], label: 'Compensation cess (INR)', typed: a.cessAmount === '' || a.cessAmount == null ? 0 : a.cessAmount, expected: Math.round(d.cess * 100) / 100, severity: 'high', doc: 'Customs tariff (cess notification for the HS)' }); }
  chk('totalDutyPayable', 'Total duty payable (INR)', d.total);
  return out;
}

function tcosScrutinizeDocs(filing) {
  const src = tcosSrc(filing), out = [];
  if (!src) return out;
  const isExp = filing.type === 'export';
  const add = (cat, path, label, typed, expected, severity, doc) => out.push({ code: path.join('.'), cat, path, label, typed: typed == null ? '' : typed, expected, severity, doc });
  const txt = (cat, grp, key, label, sev, doc) => {
    const e = tcosGet(src, [grp, key]); if (e == null || e === '') return;
    const t = tcosGet(filing, [grp, key]);
    if (tcosNorm(t) !== tcosNorm(e)) add(cat, [grp, key], label, t, e, sev, doc);
  };
  const numr = (cat, path, label, sev, doc, tol, base) => {
    const e = tcosGet(base || src, path.slice(base ? 0 : 0)); if (e == null || e === '') return;
    const t = tcosGet(filing, path);
    if (!tcosClose(t, e, tol)) add(cat, path, label, t, e, sev, doc);
  };
  txt('party', 'party', 'iec', 'IEC', 'high', 'IEC certificate');
  txt('party', 'party', 'gstin', 'GSTIN', 'high', 'GST registration');
  txt('party', 'party', isExp ? 'exporterName' : 'importerName', isExp ? 'Exporter name' : 'Importer name', 'med', 'IEC certificate');
  txt('party', 'counterparty', isExp ? 'consigneeName' : 'supplierName', isExp ? 'Consignee name' : 'Supplier name', 'med', 'commercial invoice');
  txt('shipment', 'shipment', 'vesselFlight', 'Vessel / flight', 'med', 'booking / transport document');
  txt('shipment', 'shipment', 'voyageFlight', 'Voyage / flight no.', 'med', 'booking / transport document');
  txt('shipment', 'shipment', 'portOfDischarge', 'Port of discharge', 'high', 'booking / transport document');
  txt('shipment', 'shipment', 'portOfLoading', 'Port of loading', 'med', 'booking / transport document');
  if (!isExp) txt('shipment', 'shipment', 'blAwbNo', 'B/L / AWB number', 'high', 'Bill of Lading');
  txt('doc', 'invoice', 'invoiceNo', 'Invoice number', 'high', 'commercial invoice');
  txt('value', 'invoice', 'currency', 'Invoice currency', 'high', 'commercial invoice');
  numr('value', ['invoice', 'invoiceValue'], 'Invoice value', 'high', 'commercial invoice', 0.002);
  if (isExp) numr('value', ['invoice', 'fobValue'], 'FOB value', 'high', 'commercial invoice', 0.002);
  const si = src.items || [], fi = filing.items || [];
  if (si.length !== fi.length) add('quantity', ['items'], 'Number of item lines', fi.length, si.length, 'high', 'commercial invoice');
  si.forEach((s, i) => {
    const t = fi[i]; if (!t) return;
    const tag = 'Item ' + (i + 1) + ' ';
    if (String(t.hsCode) !== String(s.hsCode)) add('classification', ['items', i, 'hsCode'], tag + 'HS code', t.hsCode, s.hsCode, 'high', 'commercial invoice / classification');
    if (!tcosClose(t.qty, s.qty, 0.001)) add('quantity', ['items', i, 'qty'], tag + 'quantity', t.qty, s.qty, 'high', 'packing list');
    if (tcosNorm(t.unit) !== tcosNorm(s.unit)) add('quantity', ['items', i, 'unit'], tag + 'unit', t.unit, s.unit, 'med', 'packing list');
    if (!tcosClose(t.unitPrice, s.unitPrice, 0.002)) add('value', ['items', i, 'unitPrice'], tag + 'unit price', t.unitPrice, s.unitPrice, 'high', 'commercial invoice');
    if (tcosNorm(t.origin) !== tcosNorm(s.origin)) add('origin', ['items', i, 'origin'], tag + 'country of origin', t.origin, s.origin, 'med', 'commercial invoice');
    if (!tcosClose(t.packages, s.packages, 0.001)) add('packages', ['items', i, 'packages'], tag + 'packages', t.packages, s.packages, 'med', 'packing list');
    if (!tcosClose(t.grossWeight, s.grossWeight, 0.01)) add('weight', ['items', i, 'grossWeight'], tag + 'gross weight', t.grossWeight, s.grossWeight, 'med', 'packing list');
    if (!tcosClose(t.netWeight, s.netWeight, 0.01)) add('weight', ['items', i, 'netWeight'], tag + 'net weight', t.netWeight, s.netWeight, 'med', 'packing list');
  });
  /* description vs HS (classification sense-check) */
  fi.forEach((it, i) => {
    const hs = (typeof HS_CODE_TABLE !== 'undefined') && HS_CODE_TABLE[it.hsCode];
    if (!hs || !it.description) return;
    const words = String(hs.desc).toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3 && !/other|products?|general/.test(w));
    const d = String(it.description).toLowerCase();
    if (words.length && !words.some(w => d.indexOf(w.slice(0, Math.max(4, w.length - 2))) > -1) && !out.some(f => f.code === 'items.' + i + '.hsCode'))
      out.push({ code: 'items.' + i + '.desc', cat: 'classification', path: ['items', i, 'hsCode'], label: 'Item ' + (i + 1) + ' classification', typed: it.hsCode, expected: null, severity: 'med', doc: 'classification', note: 'The declared description does not appear to match the HS heading chosen.' });
  });
  /* containers: ISO 6346 check digit */
  (filing.containers || []).forEach((c, i) => {
    if (c.containerNo && !tcosIso6346Ok(c.containerNo)) out.push({ code: 'containers.' + i, cat: 'container', path: ['containers', i, 'containerNo'], label: 'Container ' + (i + 1) + ' number', typed: c.containerNo, expected: null, severity: 'med', doc: 'container / seal details', note: 'Container number fails the ISO 6346 check-digit test.' });
  });
  return out;
}

function tcosQueryTextFor(filing) {
  const f = (filing.scrutiny && filing.scrutiny.findings) || [];
  if (!f.length) return null;
  const lines = f.slice(0, 4).map(x => x.note ? `${x.label}: ${x.note}` : `${x.label} as declared (${x.typed === '' ? 'blank' : x.typed}) does not agree with the ${x.doc} on record.`);
  return 'Discrepancy noted between the declaration and the documents: ' + lines.join(' | ') + (f.length > 4 ? ` | ...and ${f.length - 4} more.` : '') + ' Verify against the original documents, correct the particulars and reply.';
}

/* the correction form inside a query / scroll hold */
function tcosCorrectionsHTML(filing, findings) {
  return `<div class="field full" style="margin-top:10px"><label>Corrections - verify each value against the source documents (Documents on your desk) and correct what is wrong</label>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Particular flagged</th><th>As you declared</th><th>Corrected value</th></tr></thead><tbody>
    ${findings.map((f, i) => `<tr><td>${esc(f.label)}${f.note ? `<div class="hint">${esc(f.note)}</div>` : ''}</td><td>${esc(f.typed === '' ? '(blank)' : f.typed)}</td><td><input class="cell" data-corr="${i}" value="${esc(f.typed)}" style="min-width:140px"></td></tr>`).join('')}
    </tbody></table></div></div>`;
}
function tcosApplyCorrections(filing, findings) {
  $all('[data-corr]').forEach(n => {
    const f = findings[Number(n.dataset.corr)]; if (!f) return;
    let v = n.value.trim();
    const cur = tcosGet(filing, f.path);
    if (typeof cur === 'number' || /qty|price|weight|packages|invoiceValue|fobValue/i.test(f.path[f.path.length - 1])) { if (v !== '' && isFinite(Number(v))) v = Number(v); }
    tcosSet(filing, f.path, v);
  });
}

function tcosQueryPanelHTML(filing) {
  const f = (filing.scrutiny && filing.scrutiny.open) || [];
  if (!f.length) return '';
  return tcosCorrectionsHTML(filing, f) + `<div class="hint">Round ${filing.query.round || 1} of 2. Customs re-checks the corrected particulars against the documents - a wrong "correction" gets the filing sent for physical examination.</div>`;
}
/* Returns true when the reply was handled here (scrutiny query); false to fall back to the plain reply flow */
function tcosSubmitScrutinyReply(filingId, replyText) {
  const filing = getFiling(filingId);
  if (!filing || !filing.query || !(filing.scrutiny && filing.scrutiny.open && filing.scrutiny.open.length)) return false;
  if (!replyText || replyText.trim().length < 15) { toast('Reply must be at least 15 characters and address the query.', 'error'); return true; }
  tcosApplyCorrections(filing, filing.scrutiny.open);
  filing.updatedAt = Date.now();
  const still = tcosScrutinize(filing);
  filing.query.reply = replyText.trim();
  filing.query.round = (filing.query.round || 1);
  if (still.length && filing.query.round < 2) {
    filing.query.round++;
    filing.scrutiny.open = still;
    filing.query.description = tcosQueryTextFor({ scrutiny: { findings: still } }) + ' (Your reply did not resolve the discrepancy - the particulars still differ from the documents.)';
    filing.query.date = Date.now();
    pushTimeline(filing, 'QUERY_RAISED', `Reply to ${filing.query.number} not satisfactory - ${still.length} particular(s) still differ from the documents. Query re-issued.`);
    addNotification(`Query ${filing.query.number} re-issued on ${filing.id}: reply not satisfactory.`, filing.id);
    saveState(); toast('Customs is not satisfied - the query has been re-issued.', 'error'); renderFilingDetail(filing.id); return true;
  }
  const outcome = determineProcessingOutcome(filing);
  filing.scrutiny.findings = still;
  filing.scrutiny.open = [];
  if (still.length) {
    /* two rounds failed: goods go for examination and the discrepancy is established */
    outcome.needsExam = true; outcome.discrepancy = true; filing.processingOutcome = outcome;
    STATE.riskProfile.violations = (STATE.riskProfile.violations || 0) + 1;
    pushTimeline(filing, 'QUERY_REPLIED', 'Query closed unresolved - goods referred for physical examination. Risk profile marked.');
  }
  filing.query.status = 'QUERY RESOLVED';
  setFilingStatus(filing, 'QUERY_REPLIED');
  pushTimeline(filing, 'QUERY_REPLIED', `Reply submitted for query ${filing.query.number}.` + (still.length ? '' : ' Particulars now agree with the documents.'));
  addNotification(`Reply submitted for query ${filing.query.number} on ${filing.id}.`, filing.id);
  saveState(); toast(still.length ? 'Reply recorded - goods referred for examination.' : 'Query resolved - particulars now agree with the documents.', still.length ? 'info' : 'success');
  if (outcome.needsExam) scheduleExamination(filing); else advancePastProcessing(filing);
  saveState(); renderFilingDetail(filing.id);
  return true;
}

/* ---------------- 4. source documents on the desk ---------------- */
function tcosSourceDocsHTML(filing) {
  const src = tcosSrc(filing); if (!src) return '';
  const isExp = filing.type === 'export', P = src.party || {}, C = src.counterparty || {}, S = src.shipment || {}, I = src.invoice || {}, items = src.items || [];
  const seller = isExp ? P : C, buyer = isExp ? C : P;
  const sName = isExp ? P.exporterName : C.supplierName, bName = isExp ? C.consigneeName : P.importerName;
  const doc = (title, body) => `<div class="srcdoc"><div class="srcdoc-h">${title}</div>${body}</div>`;
  const rows = items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.description)}</td><td>${esc(it.hsCode)}</td><td class="r">${it.qty}</td><td>${esc(it.unit)}</td><td class="r">${it.unitPrice}</td><td class="r">${(it.qty * it.unitPrice).toFixed(2)}</td><td>${esc(it.origin)}</td></tr>`).join('');
  const invoice = doc('COMMERCIAL INVOICE', `<div class="srcgrid"><div><b>Seller / Exporter</b><br>${esc(sName)}<br>${esc(seller.address)}<br>${isExp ? 'IEC ' + esc(P.iec) + '<br>GSTIN ' + esc(P.gstin) + '<br>PAN ' + esc(P.pan) : ''}</div>
    <div><b>Buyer / Consignee</b><br>${esc(bName)}<br>${esc(buyer.address)}<br>${esc(isExp ? C.country : P.country || '')}${!isExp ? '<br>IEC ' + esc(P.iec) + '<br>GSTIN ' + esc(P.gstin) : ''}</div>
    <div><b>Invoice No.</b> ${esc(I.invoiceNo)}<br><b>Date</b> (date of filing)<br><b>Currency</b> ${esc(I.currency)}<br><b>Terms</b> ${esc(I.incoterm)} - ${esc(I.paymentTerms || '')}<br><b>Freight</b> ${I.freight || 0} &nbsp;<b>Insurance</b> ${I.insurance || 0}</div></div>
    <table class="srct"><thead><tr><th>#</th><th>Description</th><th>HS</th><th>Qty</th><th>Unit</th><th>Unit price</th><th>Amount</th><th>Origin</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="r"><b>Total ${esc(I.currency)} ${I.invoiceValue}</b>${isExp ? ' &nbsp; FOB value ' + I.fobValue : ''}</div>`);
  const prow = items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.description)}</td><td class="r">${it.qty} ${esc(it.unit)}</td><td class="r">${it.packages}</td><td class="r">${it.grossWeight}</td><td class="r">${it.netWeight}</td></tr>`).join('');
  const pk = doc('PACKING LIST', `<div>Invoice ref: ${esc(I.invoiceNo)} &nbsp; Shipper: ${esc(sName)}</div><table class="srct"><thead><tr><th>#</th><th>Goods</th><th>Quantity</th><th>Packages</th><th>Gross wt (kg)</th><th>Net wt (kg)</th></tr></thead><tbody>${prow}</tbody></table>
    <div class="r"><b>Total packages ${items.reduce((s, it) => s + (Number(it.packages) || 0), 0)} &nbsp; Gross ${items.reduce((s, it) => s + (Number(it.grossWeight) || 0), 0)} kg &nbsp; Net ${items.reduce((s, it) => s + (Number(it.netWeight) || 0), 0)} kg</b></div>`);
  const bk = doc(isExp ? 'BOOKING CONFIRMATION / SHIPPING INSTRUCTION' : 'BILL OF LADING / AIRWAY BILL', `<div class="srcgrid"><div><b>Port of loading</b><br>${esc(S.portOfLoading)}</div><div><b>Port of discharge</b><br>${esc(S.portOfDischarge)}</div><div><b>Mode</b> ${esc(S.modeOfTransport)}<br><b>Vessel / flight</b> ${esc(S.vesselFlight)}<br><b>Voyage / flight no.</b> ${esc(S.voyageFlight)}<br>${isExp ? '<b>Reference</b> ' + esc(S.shipmentRef) : '<b>B/L - AWB No.</b> ' + esc(S.blAwbNo) + '<br><b>Country of origin</b> ' + esc(S.countryOfOrigin || '')}</div></div>`);
  const cert = doc(isExp ? 'IEC CERTIFICATE & GST REGISTRATION (extract)' : 'IMPORTER IEC & GST REGISTRATION (extract)', `<div><b>${esc(isExp ? P.exporterName : P.importerName)}</b> - IEC ${esc(P.iec)} - GSTIN ${esc(P.gstin)} - PAN ${esc(P.pan)}<br>${esc(P.address)}<br>Authorised person: ${esc(P.authorizedPerson)} - ${esc(P.contact)}</div>`);
  return invoice + pk + bk + cert;
}
function tcosShowSourceDocs() {
  const filing = (typeof WZ !== 'undefined' && WZ && WZ.filing) || null;
  if (!filing) return;
  const html = tcosSourceDocsHTML(filing);
  const bg = el('div', 'modal-bg show');
  bg.innerHTML = `<div class="modal" style="width:min(900px,96vw)"><div class="modal-head">Documents on your desk - ${esc(filing.id)} <span class="close">×</span></div>
    <div style="max-height:78vh;overflow:auto;padding:12px;background:#eef1f5"><p class="hint">These are the client's original documents. Type the filing from them - Customs checks your declaration against these, line by line.</p>${html || '<p class="hint">This filing has no source documents (free practice).</p>'}</div></div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click', e => { if (e.target === bg || e.target.classList.contains('close')) bg.remove(); });
}

/* ---------------- 5. "where am I" step guide ---------------- */
const TCOS_STEP_GUIDE = {
  party: { part: 'Part I - B. Declarant / Importer-Exporter', what: 'Who is making this declaration. This identifies the legal entity responsible for every particular on the bill.', read: 'IEC certificate, GST registration, PAN card', checks: 'IEC format, GSTIN structure (state code + PAN + entity + check), PAN embedded in GSTIN, authorised signatory.', trap: 'Typing the PAN that does not match the GSTIN, or an old address.' },
  counterparty: { part: 'Part I - Consignee / Supplier', what: 'The foreign party in the transaction - buyer for an export, seller for an import.', read: 'Commercial invoice (header), purchase order / LC', checks: 'Name and address agree with the invoice and the transport document.', trap: 'Using the notify party or bank as the consignee.' },
  shipment: { part: 'Part I - A. Status & Cargo / Shipment', what: 'How and where the goods travel: ports, mode, vessel / flight, voyage and (import) the BL / AWB that links to the manifest.', read: 'Booking confirmation, Bill of Lading / AWB, vessel schedule', checks: 'Port-mode consistency, vessel + voyage vs manifest, BL number vs IGM.', trap: 'Sea mode with an airport, or a voyage number from the wrong sailing.' },
  invoice: { part: 'Part II - Invoice Details', what: 'The commercial value of the transaction. Customs builds value / drawback / duty on this.', read: 'Commercial invoice, LC or contract for terms', checks: 'Invoice no. uniqueness, date, currency, FOB vs incoterm, invoice total vs items.', trap: 'FOB not matching CIF - freight - insurance; wrong currency.' },
  items: { part: 'Part III - Item Details', what: 'Line-by-line description, classification (HS), quantity, price and weights of each item.', read: 'Commercial invoice lines + packing list', checks: 'HS code vs description, qty x price = line value, line totals = invoice, weights.', trap: 'Wrong HS, unit mismatch (PCS vs KGS), net > gross.' },
  itemExtra: { part: 'Part III - Item particulars', what: 'Extra per-item particulars Customs prints in the item block.', read: 'Product catalogue, invoice', checks: 'Completeness and consistency with the item description.', trap: 'Leaving end use / brand blank for goods that need it.' },
  packages: { part: 'Part I - Packages & weights', what: 'Total packages and weights for the whole consignment.', read: 'Packing list totals', checks: 'Total packages = sum of items; gross >= net; totals = item sums.', trap: 'Typing the invoice quantity as package count.' },
  containers: { part: 'Part I - E. Container details', what: 'Container number and seal for each container stuffed.', read: 'Stuffing / container list, seal slip', checks: 'ISO 6346 container number and check digit; seal number present.', trap: 'A transposed digit - the check digit fails and the container cannot be tracked.' },
  assessment: { part: 'Part III - Duties (Bill of Entry)', what: 'Self-assessment of duty: assessable value, BCD, SWS, IGST, cess.', read: 'Invoice, customs tariff, notifications', checks: 'Duty arithmetic and rates vs notification.', trap: 'Applying IGST on value without adding BCD and SWS.' },
  manifest: { part: 'Part I - D. Manifest details', what: 'Verification that the carrier has already filed the cargo on the IGM.', read: 'Bill of Lading, delivery order', checks: 'BL number + IGM match.', trap: 'BL number from the house BL when the manifest has the master.' },
  documents: { part: 'Part III / Annexures - e-Sanchit documents', what: 'Supporting documents uploaded and linked to the filing.', read: 'Invoice, packing list, certificates', checks: 'Mandatory documents for the goods / scheme are attached.', trap: 'Forgetting the certificate that the HS or scheme requires.' },
  review: { part: 'Validation & Submission', what: 'Final validation, digital signature and submission. After this, Customs processes the bill.', read: 'Everything you typed, against the documents', checks: 'Full validation. Anything wrong now becomes a Customs query later.', trap: 'Submitting without re-reading - mismatches are found by Customs, not by the system.' }
};
function tcosStepGuideHTML(filing, step) {
  let g = TCOS_STEP_GUIDE[step.key];
  if (!g && step.special === 'igspec') {
    const n = step.docSimStep || 0, exp = filing.type === 'export';
    g = { part: (exp ? 'Shipping Bill' : 'Bill of Entry') + ' - ICEGATE form step ' + n, what: 'Real ICEGATE particulars for: ' + step.title + '. Each field prints on the final document in its own box.', read: 'The matching document named in the field help (licence, LC, PO, bank advice ...)', checks: 'Mandatory fields, formats (codes / dates / amounts) and consistency with the earlier steps.', trap: 'Copying a value you do not have a document for - leave optional particulars blank instead of guessing.' };
  }
  if (!g) return '';
  const idx = WZ.steps.indexOf(step) + 1;
  return `<div class="ig-guide"><div class="ig-guide-h"><span>${esc(g.part)}</span><span>Step ${idx} of ${WZ.steps.length}</span></div>
    <div class="ig-guide-b"><div><b>What you are doing</b>${esc(g.what)}</div><div><b>Read it from</b>${esc(g.read)}</div><div><b>Customs checks</b>${esc(g.checks)}</div><div><b>Common mistake</b>${esc(g.trap)}</div></div></div>`;
}

/* ---------------- 6. EGM matching + scroll / refund ---------------- */
function tcosEgmCheck(filing) {
  /* the carrier files the EGM from the documents it holds (the source documents), not from your typing */
  const src = tcosSrc(filing), problems = [];
  if (src) {
    const S = filing.shipment || {}, ss = src.shipment || {};
    if (tcosNorm(S.vesselFlight) !== tcosNorm(ss.vesselFlight)) problems.push('Vessel on the Shipping Bill differs from the vessel on the EGM.');
    if (tcosNorm(S.voyageFlight) !== tcosNorm(ss.voyageFlight)) problems.push('Voyage on the Shipping Bill differs from the voyage on the EGM.');
    const pk = (src.items || []).reduce((s, it) => s + (Number(it.packages) || 0), 0), gw = (src.items || []).reduce((s, it) => s + (Number(it.grossWeight) || 0), 0);
    if (!tcosClose((filing.packages || {}).numberOfPackages, pk, 0.001)) problems.push('Package count on the Shipping Bill differs from the EGM.');
    if (!tcosClose((filing.packages || {}).grossWeight, gw, 0.01)) problems.push('Gross weight on the Shipping Bill differs from the EGM.');
  }
  return problems;
}
function tcosIgstRefund(filing) {
  const fx = (typeof FX_TO_INR !== 'undefined' && FX_TO_INR[(filing.invoice || {}).currency]) || 1;
  const ig = filing.icegate || {}, sch = ig.itemScheme || filing.itemScheme || [];
  let t = 0;
  (filing.items || []).forEach((it, i) => {
    const r = sch[i] || {}; if (/lut/i.test(r.igstStatus || '') || ig.lut === 'Y') return;
    const pct = Number(r.igstRatePct); t += (Number(it.qty) || 0) * (Number(it.unitPrice) || 0) * fx * ((isFinite(pct) && r.igstRatePct !== '' && r.igstRatePct != null ? pct : 18) / 100);
  });
  return Math.round(t);
}
function tcosScrollPanelHTML(filing) {
  if (filing.type !== 'export' || !filing.egm) return '';
  const sc = filing.scroll;
  if (!sc) return `<div class="wz-card"><h3>Scroll &amp; Refund</h3><p class="hint">After the EGM is filed, Customs matches the Shipping Bill with the EGM and sends the scroll to GSTN (IGST refund) and the bank (Drawback / RoDTEP).</p><button class="next" onclick="tcosProcessScroll('${filing.id}')">Check Scroll Status</button></div>`;
  if (sc.status === 'HELD') return `<div class="wz-card"><h3>Scroll &amp; Refund - ON HOLD</h3><div class="alert alert-error"><b>SB-EGM mismatch.</b><ul style="margin:6px 0 0 18px">${sc.problems.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
    <p class="hint">No IGST refund / Drawback is released until the Shipping Bill and EGM agree. Correct the Shipping Bill particulars from the documents and request re-matching (this is an amendment under Section 149).</p>
    ${tcosCorrectionsHTML(filing, sc.fix)}<button class="next" style="margin-top:10px" onclick="tcosResolveScrollHold('${filing.id}')">Submit Amendment &amp; Re-match</button></div>`;
  return `<div class="wz-card"><h3>Scroll &amp; Refund</h3><table class="kv-table"><tr><td>Scroll No.</td><td>${esc(sc.scrollNo)}</td></tr><tr><td>SB-EGM match</td><td><span class="badge badge-green">MATCHED</span></td></tr>
    <tr><td>IGST refund (to bank A/c)</td><td>${sc.igst ? '₹' + sc.igst.toLocaleString('en-IN') + ' - ' + esc(sc.igstStatus) : 'Not applicable (exported under LUT)'}</td></tr>
    <tr><td>Drawback / RoDTEP</td><td>Claim from the Export Benefits panel above - credited after this scroll.</td></tr></table></div>`;
}
function tcosProcessScroll(filingId) {
  const filing = getFiling(filingId); if (!filing || !filing.egm) return;
  const problems = tcosEgmCheck(filing);
  if (problems.length) {
    const found = tcosScrutinize(filing).filter(f => ['shipment', 'packages', 'weight'].indexOf(f.cat) > -1 || /vessel|voyage|packages|weight/i.test(f.label));
    const fix = found.length ? found : tcosScrutinize(filing).slice(0, 4);
    filing.scroll = { status: 'HELD', problems, fix, ts: Date.now() };
    pushTimeline(filing, filing.status, 'Scroll held: Shipping Bill / EGM mismatch.');
    addNotification(`Scroll on ${filing.id} held - SB/EGM mismatch.`, filing.id);
  } else {
    const igst = tcosIgstRefund(filing);
    filing.scroll = { status: 'GENERATED', scrollNo: 'SCR-' + Math.floor(100000 + Math.random() * 900000), igst, igstStatus: 'Sanctioned - credited to bank', ts: Date.now() };
    pushTimeline(filing, filing.status, 'Scroll generated: SB matched with EGM.');
    addNotification(`Scroll ${filing.scroll.scrollNo} generated for ${filing.id}.`, filing.id);
  }
  saveState(); renderFilingDetail(filing.id);
}
function tcosResolveScrollHold(filingId) {
  const filing = getFiling(filingId); if (!filing || !filing.scroll || filing.scroll.status !== 'HELD') return;
  tcosApplyCorrections(filing, filing.scroll.fix);
  filing.updatedAt = Date.now();
  const problems = tcosEgmCheck(filing);
  if (problems.length) { filing.scroll.problems = problems; filing.scroll.fix = tcosScrutinize(filing).slice(0, 4); saveState(); toast('Still mismatched with the EGM - check the vessel, voyage, packages and gross weight against the booking / packing list.', 'error'); renderFilingDetail(filing.id); return; }
  filing.amendments = filing.amendments || [];
  filing.amendments.push({ id: 'AMD-' + Math.floor(100000 + Math.random() * 900000), reasonType: 'SB-EGM mismatch', status: 'APPROVED', ts: Date.now() });
  filing.scroll = null;
  tcosProcessScroll(filingId);
  toast('Amendment accepted - scroll generated.', 'success');
}
