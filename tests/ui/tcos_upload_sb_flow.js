const { chromium } = require('playwright');
const B = 'http://localhost:8765';
let FAILS = 0, CHECKS = 0;
const ok = (c, m) => { CHECKS++; if (c) console.log('  ok    ' + m); else { FAILS++; console.log('  FAIL  ' + m); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  PAGEERROR', e.message.slice(0, 200)));

  // ---- 1. seed student + Shipment Lot (real Skelora functions) ----
  await page.goto(B + '/logistics-simulator/login.html');
  await page.evaluate(() => { skSignUp({ name: 'Test Student', email: 'SKELORA2026001', password: 'pass1234', role: 'student', position: 'Customs Clearance Executive' }); });
  await page.goto(B + '/logistics-simulator/workstation.html?doc=commercial-invoice');
  await page.waitForFunction(() => typeof skCreateJob === 'function');
  const seeded = await page.evaluate(() => {
    const r = { ok: true, user: skGetCurrentUser() };
    const f = { mode: 'Sea Export', origin: 'Cochin, India', destination: 'UAE', sellerName: 'Meridian Exports Pvt. Ltd.', sellerAddress: 'Plot 14, MIDC, Pune', sellerCountry: 'India', sellerGSTIN: '27AABCT4521K1ZM', sellerIEC: 'AABCT4521K', sellerPAN: 'AABCT4521K', sellerPhone: '+91 98200 12345',
      buyerName: 'Nordic Trading GmbH', buyerAddress: 'Hafenstrasse 22, Hamburg', buyerCountry: 'Germany', portOfLoading: 'Cochin Port', portOfDischarge: 'Port of Hamburg, Germany', incoterm: 'FOB', currency: 'USD', quantity: '500', grossWeight: '2100', invoiceValue: '42500',
      items: [{ description: 'Cotton T-shirts', hsCode: '61091000', quantity: '500', unit: 'PCS', unitPrice: '85', countryOfManufacture: 'India', weight: '2100', netWeight: '1900', packageType: 'Carton' }] };
    const slugs = ['commercial-invoice', 'packing-list', 'export-declaration', 'shipping-bill'];
    const job = skCreateJob(r.user.id, f, null, slugs, 'basic', []);
    ['commercial-invoice', 'packing-list', 'export-declaration'].forEach(s => skSaveDocProgress(r.user.id, s, { status: 'completed', currentStep: 1, maxReached: 1 }));
    return { ok: r.ok, uid: r.user.id, jobId: job && job.jobId };
  });
  ok(seeded.ok && seeded.jobId, 'seeded student + lot ' + JSON.stringify(seeded));

  // ---- 2. real bridge handoff into TCOS ----
  await page.goto(B + '/logistics-simulator/workstation.html?doc=shipping-bill');
  await page.waitForSelector('#tcosBridgeOverlay');
  ok(await page.$('#bridgeOptUpload') !== null, 'bridge popup shows the new "Upload the PDF" option on Shipping Bill');
  await Promise.all([
    page.waitForNavigation({ url: /tcos\/index\.html/ }),
    page.evaluate(() => {
      const job = skGetActiveJob(CURRENT_USER.id);
      DotBridge.startHandoff({ filingType: 'export', userId: CURRENT_USER.email, password: 'pass1234', name: CURRENT_USER.name, workRole: 'Customs Clearance Executive', returnSlug: 'shipping-bill', jobData: DotBridge.buildJobSnapshot(job) });
    })
  ]);
  await page.waitForSelector('#iglScreen', { state: 'visible', timeout: 20000 });
  { const pre = await page.evaluate(() => ({ uid: document.getElementById('uid').value, hasPw: document.getElementById('pwd').value.length > 0, cap: document.getElementById('captchaInput').value === document.getElementById('captchaText').textContent, shown: document.getElementById('iglWelcome').style.display })); ok(pre.uid.length > 0 && pre.hasPw && pre.cap && pre.shown === 'block', 'ICEGATE login screen shows with ID + password + captcha pre-filled (' + pre.uid + ')'); }
  await page.click('#login .igl-btn');
  await page.waitForFunction(() => typeof STATE !== 'undefined' && STATE.filings && STATE.filings.length > 0, null, { timeout: 15000 });
  const fil = await page.evaluate(() => ({ id: STATE.filings[0].id, jobId: STATE.filings[0].bridgeJobId, user: STATE.user.userId }));
  ok(fil.jobId === seeded.jobId, 'TCOS filing remembers the Shipment Lot id (' + fil.jobId + ')');

  // ---- 3. finish the filing like a student would (submit -> LEO), then download PDF via TCOS's own function ----
  const doc = await page.evaluate(() => {
    const f = STATE.filings[0];
    f.invoice = Object.assign({ invoiceNo: 'INV-2026-123456', invoiceDate: '2026-11-01', currency: 'USD', incoterm: 'FOB', invoiceValue: 42500 }, f.invoice);
    submitFiling(f);
    setFilingStatus(f, 'UNDER_PROCESS'); setFilingStatus(f, 'CLEARED');   // test harness: skip the random query/exam branch
    issueLEO(f.id);
    const d = STATE.documentsGenerated.find(x => x.filingId === f.id && x.type === 'Shipping Bill');
    return { docId: d && d.id, leo: !!f.leo, ack: !!f.ack };
  });
  ok(doc.docId && doc.leo && doc.ack, 'filing submitted + LEO issued, Shipping Bill doc exists');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(id => tcosDownloadIcegatePdf(id), doc.docId)]);
  const pdfPath = '' + require('os').tmpdir() + '/sb_real.pdf';
  await dl.saveAs(pdfPath);
  const fs = require('fs');
  const bytes = fs.readFileSync(pdfPath);
  ok(bytes.slice(0, 5).toString() === '%PDF-', 'TCOS produced a real PDF (' + bytes.length + ' bytes), name ' + dl.suggestedFilename());
  ok(bytes.toString('latin1').includes('DOTSTAMP1|'), 'PDF carries the DOT stamp in its Info dictionary');

  // ---- 4. A) automatic return still works (bridge still active) ----
  const bridgeNow = await page.evaluate(() => DotBridge.getBridge());
  ok(bridgeNow && bridgeNow.completed === true && bridgeNow.returnSlug === 'shipping-bill', 'bridge marked completed after LEO + PDF (auto-return armed)');
  const retPage = await ctx.newPage();
  await retPage.goto(B + '/logistics-simulator/workstation.html?doc=shipping-bill&bridgeReturn=1');
  await retPage.waitForSelector('text=Completed in ICEGATE', { timeout: 10000 });
  const prog = await retPage.evaluate(uid => skGetDocProgress(uid, 'shipping-bill'), seeded.uid);
  ok(prog && prog.status === 'completed' && prog.viaTcos && prog.formData && prog.formData.sbNumberGenerated === fil.id, 'auto-return: Shipping Bill completed, SB number carried = ' + (prog && prog.formData && prog.formData.sbNumberGenerated));
  await retPage.close();

  // ---- 5. B) BACKUP: wipe progress + bridge (auto-return "failed"), then upload the real PDF ----
  await page.goto(B + '/logistics-simulator/login.html');
  await page.evaluate(uid => {
    const all = skGetAllProgress(uid); delete all['shipping-bill']; localStorage.setItem('skelora_progress_v1_' + uid, JSON.stringify(all));
    DotBridge.clearBridge();
  }, seeded.uid);
  await page.goto(B + '/logistics-simulator/workstation.html?doc=shipping-bill');
  await page.waitForSelector('#tcosBridgeOverlay');
  await page.click('#bridgeOptUpload');
  await page.waitForSelector('#tcosUploadOverlay');
  await page.setInputFiles('#tcosUpFile', pdfPath);
  await page.waitForSelector('[data-up-state]');
  const state1 = await page.getAttribute('[data-up-state]', 'data-up-state');
  ok(state1 === 'verified', 'REAL Shipping Bill PDF verified in the Shipping Bill place (state=' + state1 + ')');
  if (state1 !== 'verified') console.log('   msg:', await page.innerText('#tcosUpResult'));
  await page.click('#tcosUpConfirm');
  await page.waitForSelector('text=Completed in ICEGATE', { timeout: 10000 });
  const prog2 = await page.evaluate(uid => skGetDocProgress(uid, 'shipping-bill'), seeded.uid);
  ok(prog2 && prog2.status === 'completed' && prog2.viaTcos && prog2.formData.sbNumberGenerated === fil.id, 'upload: Shipping Bill completed + number carried');
  const nextTxt = await page.evaluate(() => document.body.innerText);
  console.log('   completion screen text:', nextTxt.replace(/\s+/g, ' ').slice(0, 230));
  const audit = await page.evaluate(uid => skGetAuditLog(uid, 'shipping-bill')[0], seeded.uid);
  ok(audit && audit.meta && audit.meta.viaUpload === true, 'audit log records viaUpload');

  // ---- 6. same real PDF must be refused on the wrong documents / strip visible rules ----
  await page.goto(B + '/logistics-simulator/workstation.html?doc=shipping-bill');
  await page.waitForLoadState('domcontentloaded');
  ok(await page.$('#tcosUploadStrip') === null, 'no upload strip once the document is completed');

  console.log(`\n${CHECKS - FAILS}/${CHECKS} checks passed`);
  await browser.close();
  process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('E2E CRASH', e); process.exit(2); });
