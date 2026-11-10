/* =====================================================================
   SimulatorHub regression suite  —  run:  node tests/run-all.js
   No npm packages needed (plain Node 18+). Loads the real simulator code
   in a sandbox and checks, for EVERY shipment mode:
     1. Job values -> every document's autofill passes that document's own validation
     2. Every enumerable Job value (ports, countries, units, payment terms ...) is accepted by every document dropdown
     3. Job-level validators (format, positive, Invoice Value = Σ items, Gross = Σ item weights, Net <= Gross)
     4. Logistics -> TCOS bridge: ports/units/packages/currency/incoterms map exactly (never to a wrong port)
     5. A bridged Job passes TCOS's own deep validation for Sea/Air x Export/Import
   Exit code 0 = all green, 1 = at least one failure.
   ===================================================================== */
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const LS = path.join(ROOT, 'logistics-simulator') + path.sep, TC = path.join(ROOT, 'tcos', 'js') + path.sep;
let FAILS = 0, CHECKS = 0;
const fail = (m) => { FAILS++; console.log('  FAIL  ' + m); };
const ok = (m) => { CHECKS++; console.log('  ok    ' + m); };
const mk = () => { const sb = { console, setTimeout, clearTimeout, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, sessionStorage: { getItem() { return null; }, setItem() {} },
  document: { getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {} }, navigator: {}, location: { search: '', href: '' } };
  sb.window = sb; sb.self = sb; vm.createContext(sb); return sb; };
const load = (sb, dir, f) => vm.runInContext(fs.readFileSync(dir + f, 'utf8') + '\n', sb, { filename: f });

/* ---------- Logistics simulator sandbox ---------- */
const L = mk();
['documents-data.js', 'air-patches.js', 'job-engine.js', 'workflow-rules.js', 'customs-forms-config.js', 'bill-of-lading-forms-config.js', 'multi-consistency.js', 'field-references.js'].forEach(f => load(L, LS, f));
vm.runInContext(`this.DC=DOCUMENT_CONFIGS;this.JF=JOB_FIELD_MAP;this.JI=JOB_ITEM_FIELD_MAP;this.INDIA=INDIA_LOADING_PORTS;this.DISCH=DISCHARGE_PORTS_BY_COUNTRY;
 this.skValidateJobConsistency=skValidateJobConsistency;this.skValidateJobFieldValue=skValidateJobFieldValue;this.skNormalizeJobValue=skNormalizeJobValue;`, L);
const eng = fs.readFileSync(LS + 'engine.js', 'utf8');
vm.runInContext(eng.match(/const SK_POSITIVE_LABEL_RE[\s\S]*?\nfunction skNumberMustBePositive\(f\)\{[\s\S]*?\n\}/)[0] + '\nthis.skNumberMustBePositive=skNumberMustBePositive;', L);
const ov = (o) => (o || []).map((x) => (typeof x === 'object' ? x.value : x));

function sampleJob(mode, tier) {
  const air = /^Air/.test(mode);
  const pol = L.INDIA.find((p) => p.type === (air ? 'air' : 'sea')).name, dp = L.DISCH['UAE'].find((p) => p.type === (air ? 'air' : 'sea')).name;
  return { jobId: 'SKL-2026-00001', status: 'in-progress', autofillTier: tier, fields: {
    mode, origin: 'Cochin, India', destination: 'UAE', sellerName: 'Meridian Exports Pvt. Ltd.', sellerAddress: 'Plot 14, MIDC Industrial Area, Pune', sellerCountry: 'India', sellerGSTIN: '27AABCT4521K1ZM', sellerIEC: 'AABCT4521K', sellerPAN: 'AABCT4521K', sellerPhone: '+91 98200 12345', sellerEmail: 'exports@meridian.co.in', authorizedSignatory: 'Priya Sharma',
    buyerName: 'Nordic Trading GmbH', buyerAddress: 'Hafenstrasse 22, 20457 Hamburg', buyerGSTIN: '07XYZAB5678G1Z2', buyerIEC: 'AABCT4521K', buyerPhone: '+49 40 123456', buyerEmail: 'procurement@nordictrading.de',
    poNumber: '88213', quantity: '500', grossWeight: '2100', invoiceValue: '42500', currency: 'USD', paymentTerms: 'Letter of Credit', expectedShipmentDate: '2026-12-01', incoterm: 'FOB',
    portOfLoading: pol, portOfDischargeCountry: 'UAE', portOfDischarge: dp, containerNo: 'MSKU1234567', containerCompany: 'Maersk Line', vesselName: air ? 'Emirates SkyCargo' : 'MSC Aria', voyageNo: air ? 'EK544' : 'V221E', flightDate: '2026-12-01', aircraftType: 'Boeing 777F', aircraftRegistration: 'A6-EFA', carrierName: air ? 'Emirates SkyCargo' : 'Mediterranean Shipping Company (MSC)',
    vehicleNumber: 'KL07AB1234', sealNo: 'SL-994231', deliveryChallanNo: 'MPM/DC/2026/00734', ewayBillNo: '351122334455', lorryReceiptNo: 'SRC/LR/2026/018842', driverName: 'Mr. Joseph Thomas', freightAmount: '42000', loadingCharge: '2500', unloadingCharge: '2500', warehouseName: 'Malabar Distribution RDC', warehouseCode: 'BLR-RDC-01', warehouseManagerName: 'Mr. Suresh Gowda',
    items: [{ product: 'Cotton T-Shirts', description: '100% combed cotton, crew neck, assorted sizes', productCode: 'BP-COTTON-01', hsCode: '61091000', quantity: '5000', unit: 'PCS', unitPrice: '8.50', discount: '0', weight: '2100', countryOfManufacture: 'India', brandModel: 'MER-CT-2026', netWeight: '1980', packageType: 'Cartons', manufacturerDetails: 'Meridian Exports Pvt. Ltd., Pune', batchNo: 'PCM2609A', mfgDate: '2026-09-01', expDate: '2028-08-31', isDangerousGoods: 'Yes', unNumber: 'UN1090', hazardClass: '3', packingGroup: 'II', flashpoint: '-20°C', tankType: 'T14', emsCode: 'F-E, S-D' }] } };
}

console.log('\n[1] Job autofill -> document validation (6 modes x all applicable documents, DG item = Yes)');
const MODES = ['Sea Export', 'Sea Import', 'Air Export', 'Air Import', 'Road / Domestic', 'Warehouse Transfer'];
let p1 = 0, docsChecked = 0;
for (const mode of MODES) {
  const ctx = L.skBuildJobContextFromData(sampleJob(mode, 'full'));
  for (const [slug, cfg] of Object.entries(L.DC)) {
    if (!L.skIsDocumentApplicableForMode(slug, mode)) continue; docsChecked++;
    const fd = L.skApplyContextAutofill(cfg, {}, JSON.parse(JSON.stringify(ctx)));
    (cfg.steps || []).forEach((st, si) => (st.fields || []).forEach((f) => {
      if (f.type === 'table') { (fd[f.name] || []).forEach((r) => (f.columns || []).forEach((c) => { const v = r[c.key]; if (v === undefined || v === '') return;
        const cp = f.cellPatterns && f.cellPatterns[c.key]; if (cp && !new RegExp(cp.pattern).test(String(v).trim())) { p1++; fail(`${mode} ${slug} step${si + 1} ${f.name}.${c.key}="${v}" !~ ${cp.pattern}`); }
        if (Array.isArray(c.options) && c.options.length && !ov(c.options).includes(v)) { p1++; fail(`${mode} ${slug} ${f.name}.${c.key}="${v}" not in options`); } })); return; }
      const v = fd[f.name]; if (v === undefined || v === '' || f.hidden) return; if (f.showIf) { try { if (!f.showIf(fd)) return; } catch (e) {} }
      if (f.pattern && !new RegExp(f.pattern).test(String(v).trim())) { p1++; fail(`${mode} ${slug} step${si + 1} ${f.name}="${v}" !~ ${f.pattern}`); }
      if (Array.isArray(f.options) && f.options.length && !ov(f.options).includes(v)) { p1++; fail(`${mode} ${slug} step${si + 1} ${f.name}="${v}" not in dropdown`); }
      if (f.type === 'number' && f.required && L.skNumberMustBePositive(f) && !(parseFloat(v) > 0)) { p1++; fail(`${mode} ${slug} ${f.name}="${v}" not positive`); }
    }));
  }
}
if (!p1) ok(`${docsChecked} (mode x document) combinations, 0 autofill rejects`);

console.log('\n[2] Every enumerable Job value is accepted by every document dropdown / pattern');
const byCtx = {}; const add = (k, o) => (byCtx[k] = byCtx[k] || []).push(o);
for (const [slug, cfg] of Object.entries(L.DC)) (cfg.steps || []).forEach((st) => (st.fields || []).forEach((f) => {
  if (f.type === 'table') { (f.columns || []).forEach((c) => c.contextKey && add(c.contextKey, { slug, label: f.label + '/' + c.label, options: c.options, pattern: f.cellPatterns && f.cellPatterns[c.key] && f.cellPatterns[c.key].pattern })); return; }
  if (f.contextKey) add(f.contextKey, { slug, label: f.label, options: f.options, pattern: f.pattern }); }));
const sweep = (key, values, tag) => (byCtx[key] || []).forEach((o) => { const bad = values.filter((v) => (o.options && o.options.length && !ov(o.options).includes(v)) || (o.pattern && !new RegExp(o.pattern).test(v)));
  if (bad.length) fail(`${tag} ${key} :: ${o.slug} "${o.label}" rejects ${bad.length}/${values.length} e.g. ${bad.slice(0, 2).join(' ; ')}`); });
const allPorts = L.INDIA.map((p) => p.name); Object.values(L.DISCH).forEach((a) => a.forEach((p) => allPorts.push(p.name)));
const before2 = FAILS; sweep('txn.portOfLoading', allPorts, 'PORT'); sweep('txn.portOfDischarge', allPorts, 'PORT'); sweep('txn.destinationCountry', Object.keys(L.DISCH), 'COUNTRY');
L.JF.forEach((f) => f.options && f.contextKey && sweep(f.contextKey, f.options, 'OPT')); L.JI.forEach((f) => f.options && f.contextKey && sweep(f.contextKey, f.options, 'ITEMOPT'));
if (FAILS === before2) ok(`${allPorts.length} ports, ${Object.keys(L.DISCH).length} countries and every Job dropdown option accepted everywhere`);

console.log('\n[3] Job-level validators');
const F = (k) => L.JF.find((x) => x.key === k), I = (k) => L.JI.find((x) => x.key === k);
const t = (cond, msg) => (cond ? ok(msg) : fail(msg));
t(L.skNormalizeJobValue(F('vehicleNumber'), ' kl-07 ab-1234 ') === 'KL07AB1234', 'vehicle number normalized (hyphens/spaces/case)');
t(!L.skValidateJobFieldValue(F('vehicleNumber'), 'kl-07-ab-1234', 'Road / Domestic'), 'hyphenated vehicle number accepted');
t(!!L.skValidateJobFieldValue(F('vehicleNumber'), 'ABC', 'Road / Domestic'), 'bad vehicle number rejected');
t(!!L.skValidateJobFieldValue(F('voyageNo'), 'V221E', 'Air Export') && !L.skValidateJobFieldValue(F('voyageNo'), 'AI508', 'Air Export') && !L.skValidateJobFieldValue(F('voyageNo'), 'V221E', 'Sea Export'), 'voyage/flight pattern is mode-aware');
t(!!L.skValidateJobFieldValue(I('hsCode'), '6109') && !L.skValidateJobFieldValue(I('hsCode'), '61091000'), 'HS code must be 8 digits');
t(!!L.skValidateJobFieldValue(I('unNumber'), '1090') && !L.skValidateJobFieldValue(I('unNumber'), 'un1090'), 'UN number must be UN + 4 digits (case-insensitive input)');
t(!!L.skValidateJobFieldValue(I('quantity'), '0') && !!L.skValidateJobFieldValue(I('unitPrice'), '-3') && !!L.skValidateJobFieldValue(F('grossWeight'), '0'), 'zero / negative numbers rejected');
t(!!L.skValidateJobFieldValue(F('sellerPhone'), '12') && !L.skValidateJobFieldValue(F('sellerPhone'), '+91 98200 12345'), 'phone format');
const items1 = [{ quantity: '5000', unitPrice: '8.50', discount: '0', weight: '2100', netWeight: '1980' }];
t(L.skValidateJobConsistency({ invoiceValue: '42500', grossWeight: '2100' }, items1, 'Sea Export').length === 0, 'consistent Job passes');
t(L.skValidateJobConsistency({ invoiceValue: '40000', grossWeight: '2100' }, items1, 'Sea Export').some((x) => x.key === 'invoiceValue'), 'Invoice Value != Σ items is caught');
t(L.skValidateJobConsistency({ invoiceValue: '42500', grossWeight: '8500' }, items1, 'Sea Export').some((x) => x.key === 'grossWeight'), 'Gross Weight != Σ item weights is caught');
t(L.skValidateJobConsistency({ invoiceValue: '42500', grossWeight: '2100' }, [{ ...items1[0], netWeight: '2500' }], 'Sea Export').some((x) => x.key === 'netWeight'), 'Net > Gross is caught');
t(L.skValidateJobConsistency({ invoiceValue: '42450', grossWeight: '2100' }, [{ ...items1[0], discount: '50' }], 'Sea Export').length === 0, 'discount is subtracted from the item total');

/* ---------- TCOS sandbox ---------- */
const T = mk(); load(T, TC, 'data.js'); load(T, TC, 'utils.js'); load(T, TC, 'scrutiny.js');
const ff = fs.readFileSync(TC + 'filingForm.js', 'utf8');
vm.runInContext(ff.match(/const BRIDGE_COUNTRY_ALIASES[\s\S]*?\nfunction beginFilingFromBridge/)[0].replace(/function beginFilingFromBridge$/, '') + '\nthis.B={bridgeMatchPort,bridgeMatchUnit,bridgeMatchPackageType,bridgeMatchOption,bridgeMatchCountry,bridgePanFromGstin,prefill:skTcosPrefillFilingFromJobData};this.LST={INDIAN_PORTS,FOREIGN_PORTS,CURRENCIES,INCOTERMS,UNITS,PACKAGE_TYPES};', T);
const bridgeSrc = fs.readFileSync(path.join(ROOT, 'shared', 'tcos-bridge.js'), 'utf8'); const BS = mk(); vm.runInContext(bridgeSrc, BS);

console.log('\n[4] Logistics -> TCOS vocabulary and ports');
const gap = (name, vals, fn) => { const miss = vals.filter((v) => !fn(v)); miss.length ? fail(`${name}: blank in TCOS for ${miss.join(', ')}`) : ok(`${name}: all ${vals.length} Job values map`); };
gap('currency', F('currency').options, (v) => T.B.bridgeMatchOption(v, T.LST.CURRENCIES)); gap('incoterm', F('incoterm').options, (v) => T.B.bridgeMatchOption(v, T.LST.INCOTERMS));
gap('item unit', I('unit').options, (v) => T.B.bridgeMatchUnit(v)); gap('package type', I('packageType').options, (v) => T.B.bridgeMatchPackageType(v));
let portBad = 0, portN = 0;
L.INDIA.forEach((p) => { portN++; if (T.B.bridgeMatchPort(p.name, T.LST.INDIAN_PORTS) !== p.name) { portBad++; fail(`Indian port "${p.name}" -> "${T.B.bridgeMatchPort(p.name, T.LST.INDIAN_PORTS)}"`); } });
for (const [c, ps] of Object.entries(L.DISCH)) { if (!T.B.bridgeMatchCountry(c)) { portBad++; fail('country not in TCOS: ' + c); }
  ps.forEach((p) => { portN++; const r = T.B.bridgeMatchPort(p.name, T.LST.FOREIGN_PORTS, c); if (!r || !r.toLowerCase().startsWith(p.name.toLowerCase()) || r !== T.B.bridgeMatchPort(p.name, T.LST.FOREIGN_PORTS)) { portBad++; fail(`foreign port ${c}: "${p.name}" -> "${r}"`); } }); }
if (!portBad) ok(`${portN} ports map to themselves (no fuzzy mismatches)`);
['Kandla', 'Ennore', 'Tuticorin', 'Vizhinjam', 'Cochin'].forEach((n) => t(T.B.bridgeMatchPort(n, T.LST.INDIAN_PORTS) === '', `free text "${n}" stays blank (never a wrong port)`));

console.log('\n[5] Bridged Job passes TCOS deep validation');
const snap = BS.DotBridge.buildJobSnapshot;
[['Sea Export', 'Germany'], ['Air Export', 'UAE'], ['Sea Import', 'China'], ['Air Import', 'Japan']].forEach(([mode, country]) => {
  const air = /^Air/.test(mode), imp = /Import/.test(mode), type = imp ? 'import' : 'export';
  const ind = L.INDIA.filter((p) => p.type === (air ? 'air' : 'sea')).map((p) => p.name), fo = (L.DISCH[country] || []).filter((p) => p.type === (air ? 'air' : 'sea')).map((p) => p.name);
  if (!ind.length || !fo.length) { fail(`${mode}: no ${air ? 'air' : 'sea'} ports to test for ${country}`); return; }
  const j = sampleJob(mode, 'full'); Object.assign(j.fields, imp ? { destination: country, portOfLoading: fo[0], portOfDischargeCountry: 'India', portOfDischarge: ind[0], buyerGSTIN: '27AABCT4521K1ZM', buyerName: 'Meridian Imports Pvt. Ltd.', sellerName: 'Overseas Supplier Ltd.', sellerCountry: country, sellerGSTIN: '', sellerIEC: '', sellerPAN: '' } : { destination: country, portOfLoading: ind[0], portOfDischargeCountry: country, portOfDischarge: fo[0] });
  const filing = { type, party: {}, counterparty: {}, shipment: {}, invoice: {}, items: [], packages: {} }; T.B.prefill(filing, type, snap(j));
  const errs = T.tcosDeepErrors ? vm.runInContext('tcosDeepErrors', T)(filing) : [];
  t(errs.length === 0, `${mode} (${country}): TCOS deep errors = ${errs.length ? JSON.stringify(errs) : 'none'}`);
  t(filing.shipment.portOfLoading && filing.shipment.portOfDischarge && filing.shipment.modeOfTransport === (air ? 'Air' : 'Sea'), `${mode}: ports + mode prefilled (${filing.shipment.portOfLoading} -> ${filing.shipment.portOfDischarge})`);
  t(filing.packages.packageType === 'Carton' && filing.items[0].unit === 'PCS', `${mode}: package type + unit carried over`);
  if (imp) t(filing.party.iec === 'AABCT4521K' && filing.party.pan === 'AABCT4521K' && filing.shipment.countryOfOrigin === country, `${mode}: importer IEC/PAN + country of origin (${filing.shipment.countryOfOrigin}) carried over`);
});

console.log(`\n${FAILS ? 'FAILED' : 'ALL GREEN'} — ${CHECKS} checks passed, ${FAILS} failed`);
process.exit(FAILS ? 1 : 0);
