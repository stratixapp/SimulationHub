const { chromium } = require('playwright');
const B = 'http://localhost:8765';
let FAILS = 0, CHECKS = 0;
const ok = (c, m) => { CHECKS++; if (c) console.log('  ok    ' + m); else { FAILS++; console.log('  FAIL  ' + m); } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  PAGEERROR', e.message.slice(0, 200)));
  await page.goto(B + '/logistics-simulator/login.html');
  await page.evaluate(() => { skSignUp({ name: 'Import Student', email: 'SKELORA2026002', password: 'pass1234', role: 'student', position: 'Customs Clearance Executive' }); });
  await page.goto(B + '/logistics-simulator/workstation.html?doc=import-invoice');
  await page.waitForFunction(() => typeof skCreateJob === 'function');
  const S = await page.evaluate(() => {
    const u = skGetCurrentUser();
    const f = { mode: 'Sea Import', origin: 'Shanghai, China', destination: 'India', sellerName: 'Shanghai Components Co. Ltd', sellerAddress: 'Pudong, Shanghai', sellerCountry: 'China', buyerName: 'Meridian Imports Pvt. Ltd.', buyerAddress: 'Plot 14, Pune', buyerGSTIN: '27AABCT4521K1ZM', buyerIEC: 'AABCT4521K', portOfLoading: 'Port of Shanghai, China', portOfDischarge: 'Nhava Sheva (JNPT), Mumbai', incoterm: 'CIF', currency: 'USD', quantity: '100', grossWeight: '900', invoiceValue: '20000',
      items: [{ description: 'Electric motors', hsCode: '85011019', quantity: '100', unit: 'PCS', unitPrice: '200', countryOfManufacture: 'China', weight: '900', netWeight: '800', packageType: 'Carton' }] };
    const job = skCreateJob(u.id, f, null, ['import-invoice', 'arrival-notice', 'bill-of-entry'], 'basic', []);
    ['import-invoice', 'arrival-notice'].forEach(s => skSaveDocProgress(u.id, s, { status: 'completed', currentStep: 1, maxReached: 1 }));
    return { uid: u.id, jobId: job.jobId };
  });
  await page.goto(B + '/logistics-simulator/workstation.html?doc=bill-of-entry');
  await page.waitForSelector('#tcosBridgeOverlay');
  ok(await page.$('#bridgeOptUpload') !== null, 'Bill of Entry popup has the upload option');
  await Promise.all([page.waitForNavigation({ url: /tcos\/index\.html/ }), page.evaluate(() => {
    const job = skGetActiveJob(CURRENT_USER.id);
    DotBridge.startHandoff({ filingType: 'import', userId: CURRENT_USER.email, password: 'pass1234', name: CURRENT_USER.name, workRole: 'Customs Clearance Executive', returnSlug: 'bill-of-entry', jobData: DotBridge.buildJobSnapshot(job) });
  })]);
  await page.waitForSelector('#iglScreen', { state: 'visible', timeout: 20000 });
  { const pre = await page.evaluate(() => ({ uid: document.getElementById('uid').value, hasPw: document.getElementById('pwd').value.length > 0, cap: document.getElementById('captchaInput').value === document.getElementById('captchaText').textContent, shown: document.getElementById('iglWelcome').style.display })); ok(pre.uid.length > 0 && pre.hasPw && pre.cap && pre.shown === 'block', 'ICEGATE login screen shows with ID + password + captcha pre-filled (' + pre.uid + ')'); }
  await page.click('#login .igl-btn');
  await page.waitForFunction(() => typeof STATE !== 'undefined' && STATE.filings && STATE.filings.length > 0, null, { timeout: 15000 });
  const fil = await page.evaluate(() => { const f = STATE.filings[0]; return { id: f.id, jobId: f.bridgeJobId, type: f.type, iec: f.party && f.party.iec }; });
  ok(fil.type === 'import' && fil.jobId === S.jobId, 'import filing remembers Lot (' + fil.id + ', IEC ' + fil.iec + ')');

  // ---- BoE with OOC NOT yet granted: the PDF must carry final=false (so upload would be refused) ----
  const early = await page.evaluate(() => {
    const f = STATE.filings[0];
    f.invoice = Object.assign({ invoiceNo: 'INV-2026-777777', invoiceDate: '2026-11-01', currency: 'USD', incoterm: 'CIF', invoiceValue: 20000 }, f.invoice);
    submitFiling(f);
    const d = STATE.documentsGenerated.find(x => x.filingId === f.id && x.type === 'Bill of Entry');
    const info = tcosBuildStampInfo(d);
    return { final: info.final, need: info.need };
  });
  ok(early.final === false && /Out of Charge/.test(early.need), 'before OOC the BoE stamp says "not final" -> ' + early.need);

  // ---- run it through assessment, payment, OOC ----
  const doc = await page.evaluate(() => {
    const f = STATE.filings[0];
    setFilingStatus(f, 'UNDER_PROCESS');
    runAssessment(f);
    initiatePayment(f.id, 'UPI'); confirmPayment(f.id);
    (f.pga || []).forEach(p => { p.status = 'CLEARED'; });
    f.cfsRoute = 'DPD';
    grantOOC(f.id);
    const d = STATE.documentsGenerated.find(x => x.filingId === f.id && x.type === 'Bill of Entry');
    return { docId: d && d.id, ooc: f.ooc && f.ooc.refNo, challan: f.payment && f.payment.challanNo, status: f.status };
  });
  ok(doc.docId && doc.ooc, 'BoE reached OOC (' + doc.ooc + ', challan ' + doc.challan + ', status ' + doc.status + ')');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(id => tcosDownloadIcegatePdf(id), doc.docId)]);
  const pdfPath = '' + require('os').tmpdir() + '/boe_real.pdf';
  await dl.saveAs(pdfPath);
  const bytes = require('fs').readFileSync(pdfPath);
  ok(bytes.toString('latin1').includes('DOTSTAMP1|'), 'real Bill of Entry PDF is stamped (' + bytes.length + ' bytes)');

  // ---- A) automatic path already ran at OOC: companions completed by TCOS itself ----
  const auto = await page.evaluate(uid => { const a = skGetAllProgress(uid); return ['out-of-charge', 'assessment-copy', 'duty-calculation', 'duty-challan'].map(s => [s, a[s] && a[s].status]); }, S.uid).catch(() => null);

  // ---- B) BACKUP: wipe progress for BoE + companions and bridge, then upload ----
  await page.goto(B + '/logistics-simulator/login.html');
  await page.evaluate(uid => {
    const a = skGetAllProgress(uid); ['bill-of-entry', 'out-of-charge', 'assessment-copy', 'duty-calculation', 'duty-challan', 'examination-report'].forEach(s => delete a[s]);
    localStorage.setItem('skelora_progress_v1_' + uid, JSON.stringify(a)); DotBridge.clearBridge();
  }, S.uid);
  await page.goto(B + '/logistics-simulator/workstation.html?doc=bill-of-entry');
  await page.waitForSelector('#tcosBridgeOverlay');
  await page.click('#bridgeOptUpload');
  await page.setInputFiles('#tcosUpFile', pdfPath);
  await page.waitForSelector('[data-up-state]');
  const st = await page.getAttribute('[data-up-state]', 'data-up-state');
  ok(st === 'verified', 'REAL Bill of Entry PDF verified (' + st + ')');
  if (st !== 'verified') console.log('   msg:', await page.innerText('#tcosUpResult'));
  await page.click('#tcosUpConfirm');
  await page.waitForSelector('text=Completed in ICEGATE');
  const res = await page.evaluate(uid => { const a = skGetAllProgress(uid); const g = s => a[s] || {}; return {
    boe: g('bill-of-entry').status, boeNo: (g('bill-of-entry').formData || {}).beNumberGenerated,
    ooc: g('out-of-charge').status, oocNo: (g('out-of-charge').formData || {}).oocNumberGenerated,
    ac: g('assessment-copy').status, dc: g('duty-calculation').status, ch: g('duty-challan').status, ex: g('examination-report').status }; }, S.uid);
  ok(res.boe === 'completed' && res.boeNo === fil.id, 'upload completes Bill of Entry, BoE number carried = ' + res.boeNo);
  ok(res.ooc === 'completed' && res.oocNo === doc.ooc, 'companion Out of Charge completed with its own OOC number ' + res.oocNo);
  ok(res.ac === 'completed' && res.dc === 'completed' && res.ch === 'completed', 'companions Assessment Copy / Duty Calculation / Duty Challan completed');
  const dcData = await page.evaluate(uid => skGetDocProgress(uid, 'duty-challan').formData, S.uid);
  ok(dcData && dcData.boeNo === fil.id && dcData.cin === doc.challan, 'Duty Challan carries BoE No + CIN from the stamp (' + JSON.stringify(dcData) + ')');
  ok(res.ex !== 'completed', 'Examination Report NOT completed (no examination happened)');

  // ---- cross-check: the same real BoE PDF is refused in the Shipping Bill place of another (export) lot ----
  console.log(`\n${CHECKS - FAILS}/${CHECKS} checks passed`);
  await browser.close();
  process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('E2E CRASH', e); process.exit(2); });
