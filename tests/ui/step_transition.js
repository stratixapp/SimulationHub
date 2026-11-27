// v49: step transition = DOT ECHOSYSTEM loader over a frosted layer, next step fading in behind it.
// 2 s for normal steps, 4 s when the step being opened is the final document review. Logistics Simulator only.
const { chromium } = require('playwright');
const B = 'http://localhost:8765';
let FAILS = 0, CHECKS = 0;
const ok = (c, m) => { CHECKS++; if (c) console.log('  ok    ' + m); else { FAILS++; console.log('  FAIL  ' + m); } };
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 150)));
  await page.goto(B + '/logistics-simulator/login.html');
  await page.evaluate(() => { skSignUp({ name: 'Step Student', email: 'SKELORA2026051', password: 'pass1234', role: 'student', position: 'x' }); });
  await page.goto(B + '/logistics-simulator/workstation.html?doc=export-checklist');
  await page.waitForSelector('#nextBtn', { timeout: 15000 });
  await page.waitForSelector('#tcosBridgeOverlay', { timeout: 6000 }).catch(() => {});
  if (await page.$('#tcosBridgeOverlay')) await page.click('#bridgeOptHere');
  await page.waitForSelector('#tcosBridgeOverlay', { state: 'detached', timeout: 5000 }).catch(() => {});
  await page.evaluate(() => { window.validateStep = () => true; });
  await page.evaluate(() => { window.__zb = []; new MutationObserver(ms => ms.forEach(m => { m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('sk-zb')) window.__zb.push({ s: performance.now() }); }); m.removedNodes.forEach(n => { if (n.classList && n.classList.contains('sk-zb')) window.__zb[window.__zb.length - 1].e = performance.now(); }); })).observe(document.body, { childList: true }); });
  const lastMs = () => page.evaluate(() => { const z = window.__zb[window.__zb.length - 1]; return Math.round(z.e - z.s); });
  const before = await page.evaluate(() => currentStep);

  // ---------- normal step: 2 seconds ----------
  const t0 = Date.now();
  await page.click('#nextBtn');
  await page.waitForSelector('.sk-zb', { timeout: 1000 });
  ok(Date.now() - t0 < 700, 'loader appears right after Next');
  await page.waitForTimeout(100);
  const early = await page.evaluate(() => ({ step: currentStep, letters: [...document.querySelectorAll('.sk-zb .letter')].map(e => e.textContent).join(''), sub: document.querySelector('.sk-zb .sub').textContent, alpha: (getComputedStyle(document.querySelector('.sk-zb')).backgroundColor.match(/[\d.]+/g) || []).map(Number)[3] }));
  ok(early.letters === 'DOT' && early.sub === 'ECHOSYSTEM', 'it is the DOT / ECHOSYSTEM wordmark');
  ok(early.step === before, 'current step still showing for the first moments');
  ok(early.alpha === undefined || early.alpha < 0.8, 'background is a light frosted layer, NOT a solid white screen (alpha ' + early.alpha + ')');
  await page.waitForTimeout(700);   // ~0.8s
  const mid = await page.evaluate(() => { const sb = stepBody(); return { step: currentStep, overlay: !!document.querySelector('.sk-zb'), op: parseFloat(getComputedStyle(sb).opacity), blocked: document.elementFromPoint(600, 400).closest('.sk-zb') !== null }; });
  ok(mid.step === before + 1 && mid.overlay, 'next step is already in place behind the loader');
  ok(mid.op > 0 && mid.op < 1, 'next step is fading in WHILE the loader is showing (opacity ' + mid.op.toFixed(2) + ')');
  ok(mid.blocked, 'clicks blocked while it plays');
  await page.screenshot({ path: '/tmp/zb2_mid.png' });
  await page.waitForSelector('.sk-zb', { state: 'detached', timeout: 3000 });
  const t1 = await lastMs();
  ok(t1 >= 1950 && t1 <= 2100, 'normal step: loader shown for 2 seconds (' + t1 + ' ms)');
  await page.waitForTimeout(400);
  { const o = await page.evaluate(() => { const sb = stepBody(); return [getComputedStyle(sb).opacity, sb.style.animation, getComputedStyle(sb).filter]; }); ok(parseFloat(o[0]) > 0.99, 'next step fully visible afterwards ' + JSON.stringify(o)); }

  // ---------- step before the final document review: 4 seconds ----------
  const ri = await page.evaluate(() => CONFIG.steps.findIndex(s => s.custom === 'review'));
  ok(ri > 0, 'document has a final review step (index ' + ri + ')');
  await page.evaluate(i => { currentStep = i - 1; renderStep(currentStep); }, ri);
  await page.waitForTimeout(500);
  const t2 = Date.now();
  await page.click('#nextBtn');
  await page.waitForSelector('.sk-zb', { timeout: 1000 });
  await page.waitForTimeout(3000);
  ok(await page.evaluate(() => !!document.querySelector('.sk-zb')), 'still loading after 3 s when opening the final review');
  await page.waitForSelector('.sk-zb', { state: 'detached', timeout: 3000 });
  const t3 = await lastMs();
  ok(t3 >= 3950 && t3 <= 4100, 'before the final review: loader shown for 4 seconds (' + t3 + ' ms)');
  ok(await page.evaluate(() => CONFIG.steps[currentStep].custom === 'review'), 'and the final review step is showing');

  // ---------- review -> completion is a normal 2 s step ----------
  const t4 = Date.now();
  await page.click('#nextBtn');
  await page.waitForSelector('.sk-zb', { timeout: 1000 });
  await page.waitForSelector('.sk-zb', { state: 'detached', timeout: 4000 });
  const t5 = await lastMs();
  ok(t5 >= 1950 && t5 <= 2100, 'Mark Complete -> completion step: 2 seconds (' + t5 + ' ms)');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  console.log(`\n${CHECKS - FAILS}/${CHECKS} checks passed`);
  await browser.close(); process.exit(FAILS ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
