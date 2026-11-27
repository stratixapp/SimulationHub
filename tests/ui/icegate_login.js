// v47: ICEGATE login screen (standalone + from the Logistics bridge) and the TCOS -> ICEGATE rename.
const { chromium } = require('playwright');
const B = 'http://localhost:8765';
let FAILS = 0, CHECKS = 0;
const ok = (c, m) => { CHECKS++; if (c) console.log('  ok    ' + m); else { FAILS++; console.log('  FAIL  ' + m); } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 150)));

  // ---- standalone: Home -> Login/Sign Up -> ICEGATE loader -> login screen ----
  await page.goto(B + '/tcos/index.html');
  const homeTxt = await page.evaluate(() => document.body.innerText);
  ok(!/\bTCOS\b/i.test(homeTxt), 'no "TCOS" text on the ICEGATE home page');
  await page.click('nav .login');
  await page.waitForSelector('#gateLoader.show', { timeout: 3000 });
  ok(true, 'ICEGATE loading screen appears after Sign In');
  await page.waitForSelector('#iglScreen', { state: 'visible', timeout: 8000 });
  ok(await page.evaluate(() => !!getComputedStyle(document.getElementById('iglScreen')).backgroundImage.match(/assets\/login\/port\d\.jpg/)), 'login screen sits on a port photo');
  const loginTxt = await page.evaluate(() => document.getElementById('login').innerText);
  ok(!/\bTCOS\b/i.test(loginTxt) && /ICEGATE ID/.test(loginTxt), 'login screen says ICEGATE, never TCOS');
  // captcha + wrong password
  await page.fill('#uid', 'TRAINING.EXPORTER'); await page.fill('#pwd', 'TRAIN@123');
  await page.click('#login .igl-btn');
  ok(/enter the captcha/i.test(await page.innerText('#loginError')), 'empty captcha is refused');
  await page.fill('#captchaInput', 'ZZZZZ'); await page.click('#login .igl-btn');
  ok(/Captcha does not match/i.test(await page.innerText('#loginError')), 'wrong captcha is refused');
  await page.fill('#captchaInput', await page.innerText('#captchaText')); await page.fill('#pwd', 'wrong');
  await page.click('#login .igl-btn');
  ok(/Invalid User ID or Password/i.test(await page.innerText('#loginError')), 'wrong password is refused');
  // demo row fills everything, Enter key logs in
  await page.click('.igl-demo summary'); await page.click('.igl-demo .row:first-of-type');
  ok(await page.evaluate(() => document.getElementById('uid').value === 'TRAINING.EXPORTER' && document.getElementById('captchaInput').value === document.getElementById('captchaText').textContent), 'demo credential row fills ID, password and captcha');
  await page.press('#pwd', 'Enter');
  await page.waitForSelector('#app.active', { timeout: 8000 });
  ok(await page.evaluate(() => STATE.user.userId === 'TRAINING.EXPORTER'), 'standalone login works (Enter key)');
  const appTxt = await page.evaluate(() => document.body.innerText);
  ok(!/\bTCOS\b/i.test(appTxt), 'no "TCOS" text inside the app after login');

  // ---- trainer login still possible ----
  await page.evaluate(() => { logout.__skip = true; saveSession(null); }); await page.goto(B + '/tcos/index.html');
  await page.click('nav .login'); await page.waitForSelector('#iglScreen', { state: 'visible', timeout: 8000 });
  await page.click('.igl-demo summary'); await page.click('.igl-demo .row:last-of-type');
  ok(await page.evaluate(() => document.querySelectorAll('input[name="ut"]')[1].checked), 'trainer demo row ticks Trainer / Instructor');
  await page.click('#login .igl-btn'); await page.waitForSelector('#app.active', { timeout: 8000 });
  ok(await page.evaluate(() => STATE.user.loggedInAsTrainer === true), 'trainer / instructor login still works');

  // ---- Logistics bridge: an OLD session must not sign the student in silently ----
  const lp = await ctx.newPage();
  await lp.goto(B + '/logistics-simulator/login.html');
  await lp.evaluate(() => { skSignUp({ name: 'Riya Thomas', email: 'SKELORA2026041', password: 'pass1234', role: 'student', position: 'Customs Clearance Executive' }); });
  await lp.goto(B + '/logistics-simulator/workstation.html?doc=commercial-invoice');
  await lp.waitForFunction(() => typeof skCreateJob === 'function');
  await lp.evaluate(() => {
    const u = skGetCurrentUser();
    const f = { mode: 'Sea Export', origin: 'Cochin, India', destination: 'Germany', sellerName: 'Meridian Exports', sellerIEC: 'AABCT4521K', buyerName: 'Nordic GmbH', portOfLoading: 'Cochin Port', portOfDischarge: 'Port of Hamburg, Germany', incoterm: 'FOB', currency: 'USD', items: [{ product: 'Cotton', hsCode: '61091000', quantity: '5' }] };
    skCreateJob(u.id, f, null, ['commercial-invoice', 'packing-list', 'export-declaration', 'shipping-bill'], 'basic', []);
    ['commercial-invoice', 'packing-list', 'export-declaration'].forEach(s => skSaveDocProgress(u.id, s, { status: 'completed' }));
    localStorage.setItem('icegate_training_session_v1', JSON.stringify({ userId: 'TRAINING.EXPORTER', loggedInAsTrainer: false }));   // a leftover session
  });
  await lp.goto(B + '/logistics-simulator/workstation.html?doc=shipping-bill');
  await lp.waitForSelector('#tcosBridgeOverlay');
  const popTxt = await lp.evaluate(() => document.getElementById('tcosBridgeOverlay').innerText);
  ok(!/\bTCOS\b/i.test(popTxt) && /ICEGATE/.test(popTxt), 'Logistics popup says ICEGATE, never TCOS');
  await Promise.all([lp.waitForURL('**/tcos/index.html*', { timeout: 15000 }), lp.evaluate(() => {
    DotBridge.startHandoff({ filingType: 'export', userId: CURRENT_USER.email, password: 'pass1234', name: CURRENT_USER.name, workRole: 'Customs Clearance Executive', returnSlug: 'shipping-bill', jobData: DotBridge.buildJobSnapshot(skGetActiveJob(CURRENT_USER.id)) });
  })]);
  await lp.waitForSelector('#iglScreen', { state: 'visible', timeout: 15000 });
  ok(await lp.evaluate(() => !document.getElementById('app').classList.contains('active') && localStorage.getItem('icegate_training_session_v1') === null), 'bridge does NOT sign the student in silently (leftover session cleared, login screen shown)');
  const pre = await lp.evaluate(() => ({ uid: document.getElementById('uid').value, pw: document.getElementById('pwd').value, w: document.getElementById('iglWelcome').innerText }));
  ok(pre.uid === 'SKELORA2026041' && pre.pw === 'pass1234' && /Riya Thomas/.test(pre.w), 'ID + password pre-filled from Logistics, welcome shows the student\'s name');
  await lp.click('#login .igl-btn');
  await lp.waitForSelector('#app.active', { timeout: 10000 });
  ok(await lp.evaluate(() => STATE.user.profile.name === 'Riya Thomas' && /Riya Thomas/.test(document.body.innerText)), 'after Login the app uses the student\'s Logistics name');
  await lp.waitForFunction(() => STATE.filings && STATE.filings.length > 0, null, { timeout: 15000 });
  ok(true, 'Shipping Bill filing starts pre-filled from the Shipment Lot exactly as before');

  // ---- rename in the Logistics dashboard (create-lot picker) ----
  const dp = await ctx.newPage();
  await dp.goto(B + '/logistics-simulator/skelora-institute-dashboard.html'); await dp.waitForTimeout(1500);
  await dp.evaluate(() => openJobModal(null)); await dp.waitForSelector('#jobDocAutoAddToggle');
  const dtxt = await dp.evaluate(() => document.body.innerText);
  ok(!/\bTCOS\b/i.test(dtxt), 'no "TCOS" text in the Logistics dashboard / Create Lot modal');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  console.log(`\n${CHECKS - FAILS}/${CHECKS} checks passed`);
  await browser.close(); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
