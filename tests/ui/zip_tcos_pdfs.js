// v46: the Shipment Lot ZIP must contain the REAL TCOS PDF for documents done in TCOS (auto-return AND upload path),
// and list TCOS documents that have no PDF of their own in a README instead of zipping a blank form.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), cp = require('child_process');
const B = 'http://localhost:8765';
let FAILS = 0, CHECKS = 0;
const ok = (c, m) => { CHECKS++; if (c) console.log('  ok    ' + m); else { FAILS++; console.log('  FAIL  ' + m); } };
const sh = c => cp.execSync(c, { encoding: 'latin1' });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await page.goto(B + '/logistics-simulator/login.html');
  await page.evaluate(() => { skSignUp({ name: 'Zip Student', email: 'SKELORA2026020', password: 'pass1234', role: 'student', position: 'Customs Clearance Executive' }); });
  await page.goto(B + '/logistics-simulator/workstation.html?doc=commercial-invoice');
  await page.waitForFunction(() => typeof skCreateJob === 'function');
  const S = await page.evaluate(() => {
    const u = skGetCurrentUser();
    const f = { mode: 'Sea Export', origin: 'Cochin, India', destination: 'Germany', sellerName: 'Meridian Exports Pvt. Ltd.', sellerIEC: 'AABCT4521K', buyerName: 'Nordic Trading GmbH', portOfLoading: 'Cochin Port', portOfDischarge: 'Port of Hamburg, Germany', incoterm: 'FOB', currency: 'USD', quantity: '500', grossWeight: '2100', invoiceValue: '42500', items: [{ product: 'Cotton T-Shirts', hsCode: '61091000', quantity: '500' }] };
    const job = skCreateJob(u.id, f, null, ['commercial-invoice', 'packing-list', 'export-declaration', 'shipping-bill', 'export-general-manifest'], 'basic', []);
    ['commercial-invoice', 'packing-list', 'export-declaration'].forEach(s => skSaveDocProgress(u.id, s, { status: 'completed' }));
    return { uid: u.id };
  });
  await page.goto(B + '/logistics-simulator/workstation.html?doc=shipping-bill');
  await page.waitForSelector('#tcosBridgeOverlay');
  await Promise.all([page.waitForNavigation({ url: /tcos\/index\.html/ }), page.evaluate(() => {
    const job = skGetActiveJob(CURRENT_USER.id);
    DotBridge.startHandoff({ filingType: 'export', userId: CURRENT_USER.email, password: 'pass1234', name: CURRENT_USER.name, workRole: 'Customs Clearance Executive', returnSlug: 'shipping-bill', jobData: DotBridge.buildJobSnapshot(job) });
  })]);
  await page.waitForSelector('#iglScreen', { state: 'visible', timeout: 20000 });
  { const pre = await page.evaluate(() => ({ uid: document.getElementById('uid').value, hasPw: document.getElementById('pwd').value.length > 0, cap: document.getElementById('captchaInput').value === document.getElementById('captchaText').textContent, shown: document.getElementById('iglWelcome').style.display })); ok(pre.uid.length > 0 && pre.hasPw && pre.cap && pre.shown === 'block', 'ICEGATE login screen shows with ID + password + captcha pre-filled (' + pre.uid + ')'); }
  await page.click('#login .igl-btn');
  await page.waitForFunction(() => typeof STATE !== 'undefined' && STATE.filings && STATE.filings.length > 0, null, { timeout: 15000 });
  const doc = await page.evaluate(() => {
    const f = STATE.filings[0];
    f.invoice = Object.assign({ invoiceNo: 'INV-2026-123456', invoiceDate: '2026-11-01', currency: 'USD', incoterm: 'FOB', invoiceValue: 42500 }, f.invoice);
    submitFiling(f); setFilingStatus(f, 'UNDER_PROCESS'); setFilingStatus(f, 'CLEARED'); issueLEO(f.id);
    return { docId: STATE.documentsGenerated.find(x => x.filingId === f.id && x.type === 'Shipping Bill').id, fid: f.id };
  });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(id => tcosDownloadIcegatePdf(id), doc.docId)]);
  const pdfPath = os.tmpdir() + '/zip_sb.pdf'; await dl.saveAs(pdfPath);
  const tcosPdfSize = fs.statSync(pdfPath).size;
  await page.waitForTimeout(1200);   // let the vault write finish
  const vault = await page.evaluate(() => DotBridge.getPdf('SKELORA2026020', 'shipping-bill').then(r => r ? { size: r.blob.size, name: r.filename, ref: r.ref } : null));
  ok(vault && vault.size === tcosPdfSize, 'TCOS kept a copy of the final Shipping Bill PDF (' + (vault && vault.name) + ', ' + (vault && vault.size) + ' bytes)');
  // a companion TCOS completes silently (no PDF of its own)
  await page.evaluate(() => DotBridge.silentCompleteLogisticsDoc('SKELORA2026020', 'export-general-manifest', 'TRN-SB-X', 'Export General Manifest'));

  // ---- A) auto-return completes the doc, then ZIP of the Lot ----
  const dash = await ctx.newPage();
  await dash.goto(B + '/logistics-simulator/workstation.html?doc=shipping-bill&bridgeReturn=1');
  await dash.waitForSelector('text=Completed in ICEGATE', { timeout: 10000 });
  await dash.goto(B + '/logistics-simulator/skelora-institute-dashboard.html'); await dash.waitForTimeout(1500);
  const zipOf = async (pg) => { const [z] = await Promise.all([pg.waitForEvent('download', { timeout: 120000 }), pg.evaluate(() => bulkExportJobPdfs(skGetActiveJob(skGetCurrentUser().id)))]); const f = os.tmpdir() + '/lot_' + Date.now() + '.zip'; await z.saveAs(f); return f; };
  let zf = await zipOf(dash);
  let list = sh('unzip -l ' + zf);
  ok(/Shipping_Bill/i.test(list), 'ZIP contains the Shipping Bill PDF by its TCOS file name');
  const dir = os.tmpdir() + '/zx_' + Date.now(); fs.mkdirSync(dir); sh('unzip -q -o ' + zf + ' -d ' + dir);
  const sbFile = fs.readdirSync(dir).find(n => /Shipping_Bill/i.test(n));
  const sbBytes = fs.readFileSync(dir + '/' + sbFile);
  ok(sbBytes.length === tcosPdfSize && sbBytes.toString('latin1').includes('DOTSTAMP1|'), 'it is the REAL TCOS PDF (same size, carries the TCOS stamp), not a blank form');
  const readme = fs.readdirSync(dir).find(n => /README_ICEGATE/.test(n));
  ok(readme && /Export General Manifest/.test(fs.readFileSync(dir + '/' + readme, 'utf8')), 'TCOS-only companion (EGM) listed in README_ICEGATE_documents.txt instead of a blank PDF');

  // ---- B) upload path: wipe vault + progress, upload the PDF, ZIP again ----
  await dash.evaluate(async () => { await new Promise(r => { const q = indexedDB.deleteDatabase('dot-tcos-pdfs'); q.onsuccess = q.onerror = q.onblocked = r; }); const u = skGetCurrentUser().id; const a = skGetAllProgress(u); delete a['shipping-bill']; localStorage.setItem('skelora_progress_v1_' + u, JSON.stringify(a)); DotBridge.clearBridge(); });
  await dash.goto(B + '/logistics-simulator/workstation.html?doc=shipping-bill');
  await dash.waitForSelector('#tcosBridgeOverlay'); await dash.click('#bridgeOptUpload');
  await dash.setInputFiles('#tcosUpFile', pdfPath); await dash.waitForSelector('#tcosUpConfirm', { state: 'visible' });
  await dash.click('#tcosUpConfirm'); await dash.waitForSelector('text=Completed in ICEGATE');
  await dash.waitForTimeout(800);
  await dash.goto(B + '/logistics-simulator/skelora-institute-dashboard.html'); await dash.waitForTimeout(1500);
  zf = await zipOf(dash);
  const dir2 = os.tmpdir() + '/zy_' + Date.now(); fs.mkdirSync(dir2); sh('unzip -q -o ' + zf + ' -d ' + dir2);
  const sb2 = fs.readdirSync(dir2).find(n => /\.pdf$/i.test(n));
  ok(sb2 && fs.statSync(dir2 + '/' + sb2).size === tcosPdfSize, 'after the UPLOAD path the ZIP also contains the real PDF (' + sb2 + ')');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  console.log(`\n${CHECKS - FAILS}/${CHECKS} checks passed`);
  await browser.close(); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
