const { chromium } = require('playwright');
const fs = require('fs');
const B = 'http://localhost:8765';
let FAILS = 0, CHECKS = 0;
const ok = (c, m) => { CHECKS++; if (c) console.log('  ok    ' + m); else { FAILS++; console.log('  FAIL  ' + m); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  PAGEERROR', e.message.slice(0, 200)));

  await page.goto(B + '/logistics-simulator/login.html');
  await page.evaluate(() => { skSignUp({ name: 'Test Student', email: 'SKELORA2026001', password: 'pass1234', role: 'student', position: 'Customs Clearance Executive' }); });
  await page.goto(B + '/logistics-simulator/workstation.html?doc=commercial-invoice');
  await page.waitForFunction(() => typeof skCreateJob === 'function');
  const S = await page.evaluate(() => {
    const u = skGetCurrentUser();
    const f = { mode: 'Sea Export', origin: 'Cochin, India', destination: 'UAE', sellerName: 'Meridian Exports Pvt. Ltd.', sellerIEC: 'AABCT4521K', buyerName: 'Nordic Trading GmbH', buyerIEC: 'ZZZZZ9999Z', portOfLoading: 'Cochin Port', portOfDischarge: 'Port of Hamburg, Germany', incoterm: 'FOB', currency: 'USD', quantity: '500', grossWeight: '2100', invoiceValue: '42500', items: [] };
    const job = skCreateJob(u.id, f, null, ['commercial-invoice', 'packing-list', 'export-declaration', 'shipping-bill'], 'basic', []);
    ['commercial-invoice', 'packing-list', 'export-declaration'].forEach(s => skSaveDocProgress(u.id, s, { status: 'completed', currentStep: 1, maxReached: 1 }));
    return { uid: u.id, jobId: job.jobId };
  });
  await page.goto(B + '/logistics-simulator/workstation.html?doc=shipping-bill');
  await page.waitForSelector('#tcosBridgeOverlay');

  // ---- strip: choose "Do it here" -> upload place must still be on the page ----
  await page.click('#bridgeOptHere');
  await page.waitForSelector('#tcosUploadStrip', { timeout: 8000 });
  ok(true, 'after "Do it here" the permanent "Upload TCOS PDF" strip is on the Shipping Bill page');

  // helper: build a stamped (or not) PDF inside the page and return base64
  const mk = (info, opts) => page.evaluate(({ info, opts }) => {
    const pdf = new window.jspdf.jsPDF(); pdf.text('x', 10, 10);
    if (info) DotBridge.stampPdf(pdf, info);
    let b64 = pdf.output('datauristring').split(',')[1];
    if (opts && opts.tamper) { let bin = atob(b64); const i = bin.indexOf('DOTSTAMP1|') + 14; bin = bin.slice(0, i) + (bin[i] === 'A' ? 'B' : 'A') + bin.slice(i + 1); b64 = btoa(bin); }
    return b64;
  }, { info, opts });
  const base = { slug: 'shipping-bill', doc: 'Shipping Bill', type: 'export', ref: 'TRN-SB-2026-111111', user: 'SKELORA2026001', job: S.jobId, final: true, iec: 'AABCT4521K', co: { egm: false } };
  const attempt = async (name, info, opts, fileOverride) => {
    await page.evaluate(() => skShowTcosUploadModal('shipping-bill'));
    const buffer = fileOverride || Buffer.from(await mk(info, opts), 'base64');
    await page.setInputFiles('#tcosUpFile', { name: name || 'f.pdf', mimeType: 'application/pdf', buffer });
    await page.waitForSelector('[data-up-state]');
    const st = await page.getAttribute('[data-up-state]', 'data-up-state');
    const txt = await page.innerText('#tcosUpResult');
    await page.click('#tcosUpClose');
    return { st, txt };
  };
  let r;
  r = await attempt('good.pdf', base);                                         ok(r.st === 'verified', 'valid stamp accepted');
  r = await attempt('boe.pdf', Object.assign({}, base, { slug: 'bill-of-entry', doc: 'Bill of Entry', type: 'import' }));
  ok(r.st === 'rejected' && /Bill of Entry/.test(r.txt) && /Shipping Bill/.test(r.txt), 'Bill of Entry PDF refused in the Shipping Bill place -> ' + r.txt.replace(/\s+/g, ' ').slice(0, 120));
  r = await attempt('u.pdf', Object.assign({}, base, { user: 'SKELORA2026999' }));   ok(r.st === 'rejected' && /different login/.test(r.txt), 'another student\'s PDF refused');
  r = await attempt('nf.pdf', Object.assign({}, base, { final: false, need: 'Let Export Order (LEO) not issued yet' })); ok(r.st === 'rejected' && /before the filing finished/.test(r.txt), 'PDF downloaded before LEO refused');
  r = await attempt('lot.pdf', Object.assign({}, base, { job: 'SKL-2026-00099' }));  ok(r.st === 'rejected' && /Shipment Lot SKL-2026-00099/.test(r.txt), 'PDF of a different Shipment Lot refused');
  r = await attempt('iec1.pdf', Object.assign({}, base, { job: '', iec: 'QQQQQ0000Q' })); ok(r.st === 'rejected' && /IEC/.test(r.txt), 'no lot id + different IEC refused');
  r = await attempt('iec2.pdf', Object.assign({}, base, { job: '' }));                 ok(r.st === 'verified', 'no lot id + same IEC accepted');
  r = await attempt('t.pdf', base, { tamper: true });                                  ok(r.st === 'rejected' && /edited/.test(r.txt), 'edited stamp refused (checksum)');
  r = await attempt('plain.pdf', null);                                                ok(r.st === 'rejected' && /wasn't downloaded from ICEGATE/.test(r.txt), 'plain PDF without stamp refused');
  r = await attempt('x.pdf', null, null, Buffer.from('this is not a pdf at all'));    ok(r.st === 'rejected' && /isn't a PDF/.test(r.txt), 'non-PDF file refused');
  r = await attempt('imp.pdf', Object.assign({}, base, { type: 'import' }));           ok(r.st === 'rejected' && /Import/.test(r.txt) && /Export/.test(r.txt), 'import-direction PDF refused for an Export lot');

  // ---- prerequisite gate cannot be bypassed by upload ----
  await page.evaluate(uid => { const a = skGetAllProgress(uid); delete a['packing-list']; localStorage.setItem('skelora_progress_v1_' + uid, JSON.stringify(a)); }, S.uid);
  r = await attempt('good.pdf', base);
  ok(r.st === 'rejected' && /Complete these first/.test(r.txt) && /Packing List/.test(r.txt), 'missing prerequisite blocks the upload -> ' + r.txt.replace(/\s+/g, ' ').slice(0, 110));
  await page.evaluate(uid => skSaveDocProgress(uid, 'packing-list', { status: 'completed', currentStep: 1, maxReached: 1 }), S.uid);

  // ---- already-completed guard ----
  await page.evaluate(uid => skSaveDocProgress(uid, 'shipping-bill', { status: 'completed' }), S.uid);
  r = await attempt('good.pdf', base);   ok(r.st === 'rejected' && /already marked complete/.test(r.txt), 'cannot re-upload an already completed document');
  await page.evaluate(uid => { const a = skGetAllProgress(uid); delete a['shipping-bill']; localStorage.setItem('skelora_progress_v1_' + uid, JSON.stringify(a)); }, S.uid);

  // ---- a valid fake upload completes the doc, carries the number, and the NEXT document is offered ----
  await page.evaluate(() => skShowTcosUploadModal('shipping-bill'));
  await page.setInputFiles('#tcosUpFile', { name: 'good.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await mk(base), 'base64') });
  await page.waitForSelector('#tcosUpConfirm', { state: 'visible' });
  await page.click('#tcosUpConfirm');
  await page.waitForSelector('text=Completed in ICEGATE');
  const p = await page.evaluate(uid => skGetDocProgress(uid, 'shipping-bill'), S.uid);
  ok(p.status === 'completed' && p.formData.sbNumberGenerated === 'TRN-SB-2026-111111', 'upload completes Shipping Bill and carries SB number to later documents');
  const nxt = await page.evaluate(() => { const a = document.querySelector('a.btn-primary'); return a ? a.getAttribute('href') + ' | ' + a.textContent.trim() : null; });
  ok(!!nxt && /workstation\.html\?doc=/.test(nxt), 'next document button appears: ' + nxt);

  // ---- freight stamp builder inside real TCOS code (booking / BL / DO) ----
  const t = await ctx.newPage();
  await t.goto(B + '/logistics-simulator/workstation.html?doc=shipping-bill');   // seed TCOS session via real handoff API
  await Promise.all([t.waitForNavigation({ url: /tcos\/index\.html/ }), t.evaluate(() => {
    const job = skGetActiveJob(CURRENT_USER.id);
    DotBridge.startHandoff({ filingType: 'freight', userId: CURRENT_USER.email, password: 'pass1234', name: CURRENT_USER.name, returnSlug: 'booking-confirmation', jobData: DotBridge.buildJobSnapshot(job) });
  })]);
  await t.waitForSelector('#iglScreen', { state: 'visible', timeout: 20000 });
  { const pre = await t.evaluate(() => ({ uid: document.getElementById('uid').value, hasPw: document.getElementById('pwd').value.length > 0, cap: document.getElementById('captchaInput').value === document.getElementById('captchaText').textContent, shown: document.getElementById('iglWelcome').style.display })); ok(pre.uid.length > 0 && pre.hasPw && pre.cap && pre.shown === 'block', 'ICEGATE login screen shows with ID + password + captcha pre-filled (' + pre.uid + ')'); }
  await t.click('#login .igl-btn');
  await t.waitForFunction(() => typeof STATE !== 'undefined' && STATE.bookings && STATE.bookings.length > 0, null, { timeout: 15000 });
  const fr = await t.evaluate(() => {
    const b = STATE.bookings[0];
    b.bookingConfirmationNo = 'BKG-123456'; b.bl = { houseNo: 'HBL-654321' }; b.deliveryOrder = { doNo: 'DO-111222' }; b.gateOut = { eirNo: 'EIR-333444' };
    const out = {};
    [['Booking Confirmation', 'bc'], ['House Bill of Lading', 'bl'], ['House Air Waybill', 'awb'], ['Arrival Notice', 'an'], ['Delivery Order', 'do'], ['Equipment Interchange Receipt', 'eir'], ['Proof of Delivery', 'pod'], ['Draft Bill of Lading', 'draft']].forEach(([ty, k]) => {
      const d = addDocument(ty, null, ty, b.id); out[k] = tcosBuildStampInfo(d);
    });
    return { bookingId: b.id, bridgeJobId: b.bridgeJobId, out };
  });
  ok(fr.bridgeJobId === S.jobId, 'booking remembers the Shipment Lot id');
  const o = fr.out;
  ok(o.bc.slug === 'booking-confirmation' && o.bc.ref === 'BKG-123456' && o.bc.job === S.jobId && o.bc.type === 'freight', 'Booking Confirmation stamp: ' + o.bc.ref);
  ok(o.bl.slug === 'bill-of-lading-sea' && o.bl.ref === 'HBL-654321', 'House BL stamp -> bill-of-lading-sea');
  ok(o.awb.slug === 'air-waybill' && o.awb.ref === 'HBL-654321', 'House AWB stamp -> air-waybill');
  ok(o.an.slug === 'arrival-notice' && o.an.ref === fr.bookingId, 'Arrival Notice stamp');
  ok(o['do'].slug === 'delivery-order' && o['do'].ref === 'DO-111222', 'Delivery Order stamp');
  ok(o.eir.slug === 'equipment-interchange-receipt' && o.eir.ref === 'EIR-333444', 'EIR stamp');
  ok(o.pod.slug === 'proof-of-delivery' && o.pod.ref === fr.bookingId, 'POD stamp');
  ok(o.draft === null, 'Draft BL (not a Logistics document) is not stamped');

  console.log(`\n${CHECKS - FAILS}/${CHECKS} checks passed`);
  await browser.close();
  process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('E2E CRASH', e); process.exit(2); });
