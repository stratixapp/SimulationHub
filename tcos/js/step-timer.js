/* ============================================================
   FILING TIMER - v53 (Shipping Bill AND Bill of Entry)
   Measures how long the student actually works on every ICEGATE step, and the total time taken to file.
   - Active time only: the clock stops when the browser tab is hidden or the student leaves the filing screen,
     and carries on from where it was when they come back to a saved draft.
   - Live bar above the filing steps: time on this step + total. Each step in the left list shows its own time.
   - After submission the filing page shows "Time taken to file" with the per-step breakdown.
   Nothing else is limited or scored: it is only a record of the time taken.
   Stored in filing.timing = { stepMs:{stepKey:ms}, order:[keys], titles:{key:title}, finishedMs }.
   ============================================================ */

let TT = null;   // the step currently being timed: { filing, key, since }
let TT_TICK = null;

function tcosTimerKey(step, i) { return (step && step.key) ? step.key : 'step' + i; }

function tcosFmtDuration(ms) {
  ms = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const h = Math.floor(ms / 3600), m = Math.floor((ms % 3600) / 60), s = ms % 60;
  if (h) return h + 'h ' + String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's';
  if (m) return m + 'm ' + String(s).padStart(2, '0') + 's';
  return s + 's';
}

function tcosTimerData(filing) {
  if (!filing.timing || typeof filing.timing !== 'object') filing.timing = {};
  const t = filing.timing;
  if (!t.stepMs) t.stepMs = {};
  if (!t.order) t.order = [];
  if (!t.titles) t.titles = {};
  return t;
}

/* add the running step's elapsed time to its total and (optionally) save */
function tcosTimerStop(persist) {
  if (!TT) return;
  const t = tcosTimerData(TT.filing);
  const add = Date.now() - TT.since;
  if (add > 0 && add < 6 * 3600 * 1000) t.stepMs[TT.key] = (t.stepMs[TT.key] || 0) + add;   // ignore a clock jump / laptop sleep of > 6h
  TT = null;
  if (persist !== false && typeof saveState === 'function') saveState();
}

/* start timing a step (called whenever the wizard shows one) */
function tcosTimerEnter(filing, key, title) {
  if (!filing || filing.status !== 'DRAFT') { tcosTimerStop(); return; }   // only drafts are being filed
  if (TT && TT.filing === filing && TT.key === key) return;
  tcosTimerStop();
  const t = tcosTimerData(filing);
  if (t.order.indexOf(key) < 0) t.order.push(key);
  if (title) t.titles[key] = title;
  TT = { filing: filing, key: key, since: Date.now() };
  tcosTimerEnsureTick();
  tcosTimerPaint();
}

function tcosTimerTotal(filing) {
  const t = filing.timing || {};
  let sum = 0;
  Object.keys(t.stepMs || {}).forEach(k => { sum += t.stepMs[k]; });
  if (TT && TT.filing === filing) sum += Date.now() - TT.since;
  return sum;
}

function tcosTimerStepMs(filing, key) {
  const t = filing.timing || {};
  let ms = (t.stepMs || {})[key] || 0;
  if (TT && TT.filing === filing && TT.key === key) ms += Date.now() - TT.since;
  return ms;
}

/* the filing is submitted: freeze the timer and keep the total */
function tcosTimerFinish(filing) {
  if (TT && TT.filing === filing) tcosTimerStop(false);
  const t = tcosTimerData(filing);
  t.finishedMs = tcosTimerTotal(filing);
  return t.finishedMs;
}

function tcosTimerPaint() {
  if (!TT) return;
  const bar = document.getElementById('ttBar');
  if (bar) bar.innerHTML = '⏱ This step <b>' + tcosFmtDuration(tcosTimerStepMs(TT.filing, TT.key)) + '</b> &nbsp;·&nbsp; Total time on this filing <b>' + tcosFmtDuration(tcosTimerTotal(TT.filing)) + '</b>';
  document.querySelectorAll('[data-tt]').forEach(function (n) {
    const ms = tcosTimerStepMs(TT.filing, n.getAttribute('data-tt'));
    n.textContent = ms >= 1000 ? tcosFmtDuration(ms) : '';
  });
}

function tcosTimerEnsureTick() {
  if (TT_TICK) return;
  TT_TICK = setInterval(function () {
    if (!TT) return;
    if (typeof CURRENT_SCREEN !== 'undefined' && CURRENT_SCREEN !== 'wizard') { tcosTimerStop(); return; }   // left the filing screen
    if (document.hidden) return;
    tcosTimerPaint();
  }, 1000);
}

/* pause while the tab is in the background; resume when it comes back */
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    if (TT) { const f = TT.filing, k = TT.key; tcosTimerStop(); TT_RESUME = { filing: f, key: k }; }
  } else if (TT_RESUME) {
    const r = TT_RESUME; TT_RESUME = null;
    if (typeof CURRENT_SCREEN === 'undefined' || CURRENT_SCREEN === 'wizard') tcosTimerEnter(r.filing, r.key);
  }
});
let TT_RESUME = null;
window.addEventListener('pagehide', function () { tcosTimerStop(); });

/* "Time taken to file" card for the filing page (after submission) */
function tcosTimerCardHTML(filing) {
  const t = filing.timing;
  if (!t || typeof t.finishedMs !== 'number' || !t.order || !t.order.length) return '';
  const rows = t.order.filter(function (k) { return (t.stepMs[k] || 0) >= 1000; });
  return '<div class="wz-card"><h3>⏱ Time taken to file</h3>' +
    '<p style="margin:0 0 8px;font-size:15px">This ' + (filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry') + ' was filed in <b>' + esc(tcosFmtDuration(t.finishedMs)) + '</b>.</p>' +
    (rows.length ? '<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Step</th><th>Time spent</th></tr></thead><tbody>' +
      rows.map(function (k, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(t.titles[k] || k) + '</td><td>' + esc(tcosFmtDuration(t.stepMs[k])) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '') +
    '<p class="hint" style="margin-bottom:0">Only the time you were actively working on the filing is counted (saved drafts and time away from the screen are not).</p></div>';
}

(function injectTimerCss() {
  if (document.getElementById('ttCss')) return;
  const st = document.createElement('style'); st.id = 'ttCss';
  st.textContent = '.tt-bar{margin:6px 0 10px;padding:6px 12px;background:#eef4fc;border:1px solid #cfdcf0;border-radius:4px;font-size:13px;color:#12365f}' +
    '.tt-s{display:block;font-style:normal;font-size:11px;color:#6b7a90;font-weight:400;margin-top:1px}.tt-s:empty{display:none}';
  document.head.appendChild(st);
})();
