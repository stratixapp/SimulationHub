// v45: tracks removed, star label, real Shipments page (active + history), new ports / ships.  node tests/ui/dashboard_v45.js (hub served on :8765)
const { chromium } = require('playwright');
const B = 'http://localhost:8765';
let FAILS = 0, CHECKS = 0;
const ok = (c, m) => { CHECKS++; if (c) console.log('  ok    ' + m); else { FAILS++; console.log('  FAIL  ' + m); } };
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await page.goto(B + '/logistics-simulator/login.html');
  await page.evaluate(() => { skSignUp({ name: 'Dash Student', email: 'SKELORA2026003', password: 'pass1234', role: 'student', position: 'Customs Clearance Executive' }); });
  await page.goto(B + '/logistics-simulator/skelora-institute-dashboard.html');
  await page.waitForSelector('#jobPanel');
  let txt = await page.innerText('#jobPanel');
  ok(!/1-Year|6-Month|Foundational|Advanced|102|60 documents/i.test(txt), 'no 1-Year / 6-Month track text in the Shipment Lot panel');
  ok(await page.$('#startJobBtn') !== null && /Create a Shipment Lot/.test(txt), 'panel shows only "Create a Shipment Lot"');
  // new data
  const data = await page.evaluate(() => ({
    inPorts: ['Pipavav Port, Gujarat', 'Mormugao Port, Goa', 'Kozhikode (CCJ) Airport', 'Kakinada Port, Andhra Pradesh'].every(n => INDIA_LOADING_PORTS.some(p => p.name === n)),
    nIn: INDIA_LOADING_PORTS.length,
    foreign: Object.values(DISCHARGE_PORTS_BY_COUNTRY).reduce((a, l) => a + l.length, 0),
    ships: ['MSC Irina', 'ONE Apus', 'COSCO Shipping Taurus'].every(v => VESSEL_NAMES.includes(v) && VESSEL_CARRIER_MAP[v]),
    nShips: VESSEL_NAMES.length }));
  ok(data.inPorts && data.ships, 'new Indian ports + ships present (' + data.nIn + ' Indian ports, ' + data.foreign + ' foreign, ' + data.nShips + ' ships)');
  // open the create-lot modal -> star label, no Mandatory/Optional words
  await page.click('#startJobBtn');
  await page.waitForSelector('#jobDocAutoAddToggle');
  await page.selectOption('select[name="mode"], #jobField_mode, [data-job-field="mode"]', 'Sea Export').catch(() => {});
  const modalTxt = await page.evaluate(() => document.body.innerText);
  await page.selectOption('[data-jobfield="mode"]', 'Sea Export');
  await page.waitForTimeout(500);
  const cnt = await page.evaluate(() => ({ shown: parseInt(document.getElementById('jobDocSelectedCount').textContent, 10), real: document.querySelectorAll('.jobdoc-check:checked').length }));
  ok(cnt.real > 0 && cnt.shown === cnt.real, '"N selected" counter matches the ticked documents (' + cnt.shown + ' = ' + cnt.real + ')');
  await page.evaluate(() => document.querySelector('.jobdoc-check').click());
  const cnt2 = await page.evaluate(() => ({ shown: parseInt(document.getElementById('jobDocSelectedCount').textContent, 10), real: document.querySelectorAll('.jobdoc-check:checked').length }));
  ok(cnt2.shown === cnt2.real && cnt2.real !== cnt.real, 'counter still follows manual ticks (' + cnt2.shown + ')');
  ok(!/\bMandatory\b|\bOptional\b/.test(modalTxt), 'no "Mandatory"/"Optional" words in the Create Lot modal');
  const tier = await page.evaluate(() => ({ checked: (document.querySelector('input[name="jobAutofillTier"]:checked') || {}).value, txt: document.querySelector('.autofill-tier-row').innerText }));
  ok(tier.checked === 'full', 'new Shipment Lots default to Autofill level C (Full)');
  ok(/A · Basic/.test(tier.txt) && /B · Half/.test(tier.txt) && /C · Full/.test(tier.txt) && /IEC, GSTIN, PAN/.test(tier.txt), 'the three autofill levels are named and explained');
  await page.keyboard.press('Escape');
  // seed an active lot + a history lot, then check Shipments page
  const seed = await page.evaluate(() => {
    const u = skGetCurrentUser();
    const items = [{ product: 'Cotton T-Shirts', hsCode: '61091000', quantity: '10' }];
    const f = { items, mode: 'Sea Export', origin: 'Cochin, India', destination: 'UAE', sellerName: 'Meridian Exports', sellerIEC: 'AABCT4521K', buyerName: 'Gulf Traders LLC', portOfLoading: 'Cochin Port', portOfDischarge: 'Jebel Ali Port, Dubai', incoterm: 'FOB', currency: 'USD', quantity: '10', grossWeight: '100', invoiceValue: '1000' };
    const j1 = skCreateJob(u.id, f, null, ['commercial-invoice', 'packing-list'], 'basic', []);
    skFinishJob(u.id);
    const j2 = skCreateJob(u.id, Object.assign({}, f, { portOfDischarge: 'Port of Hamburg, Germany', destination: 'Germany' }), null, ['commercial-invoice', 'shipping-bill'], 'basic', []);
    skSaveDocProgress(u.id, 'commercial-invoice', { status: 'completed' });
    return { old: j1.jobId, cur: j2.jobId };
  });
  await page.reload(); await page.waitForSelector('#jobPanel');
  await page.evaluate(() => showView('shipments'));
  await page.waitForSelector('#shipmentActiveLot');
  const sh = await page.innerText('#shipmentLots');
  ok(sh.includes(seed.cur) && /Hamburg/.test(sh) && /Cotton T-Shirts/.test(sh) && /Commercial Invoice/i.test(sh), 'Shipments shows the ACTIVE lot with route, items and documents');
  ok(/Completed/.test(sh) && /Documents completed/.test(sh), 'active lot shows per-document status + progress');
  ok(sh.includes(seed.old) && /Shipment History/.test(sh), 'Shipments shows history with the earlier lot ' + seed.old);
  const hist = await page.evaluate(() => { const d = document.querySelector('#shipmentHistory details'); d.open = true; return d.innerText; });
  ok(/Jebel Ali/.test(hist) && /Cotton T-Shirts/.test(hist), 'history entry expands to the full lot details');
  ok(!/Booking Number|Container Number/.test(sh), 'old random "assigned scenario" is gone');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  const nxt = await page.evaluate(() => { const u = skGetCurrentUser(); const job = skGetActiveJob(u.id);
    job.docSlugs = ['commercial-invoice', 'packing-list', 'proforma-invoice', 'sales-order', 'icegate-registration-form']; job.fields.mode = 'Sea Export';
    localStorage.setItem(_sk_jobKey(u.id), JSON.stringify(job));
    skSaveDocProgress(u.id, 'commercial-invoice', { status: 'in-progress' });
    ['icegate-registration-form', 'proforma-invoice', 'sales-order'].forEach(sl => skSaveDocProgress(u.id, sl, { status: 'completed' }));
    return skGetNextJobDocument(u.id, skGetActiveJob(u.id)); });
  ok(nxt === 'commercial-invoice', 'after the Sales Order the simulator offers the Commercial Invoice next (got ' + nxt + ')');
  console.log(`\n${CHECKS - FAILS}/${CHECKS} checks passed`);
  await browser.close(); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
