/* =========================================================
   workdesk.js — Office Work Requests (module controller)
   ---------------------------------------------------------
   Replaces the old standalone "Excel Skills Lab". A student
   opens a session, is handed a set of short internal-office
   messages (each one a genuine request, not an Excel drill),
   downloads the live company data as a real spreadsheet, works
   out the answer using Excel formulas of their own choosing,
   and types the final result back here to get instant feedback.
   No formula is ever named on this screen.
   ========================================================= */

WD.studentSeed = function() { return typeof DB_KEY !== 'undefined' ? DB_KEY : 'guest'; };

/* Build the picker context C from the live tables */
WD.buildContext = function() {
  const T = WD.buildTables();
  const C = {
    E: T['Employees'], LV: T['Leave Register'], PAY: T['Payroll'],
    PC: T['Petty Cash'], STK: T['Stock Register'], STX: T['Stock Transactions'],
    REQ: T['Purchase Requisitions'], QT: T['Quotations'],
    TRV: T['Travel Claims'], EXI: T['Expense Items'], VND: T['Vendors'],
    MT: T['Maintenance Tickets'], GRV: T['Grievances'], VIS: T['Visitors'],
    IN: T['Inward Mail'], OUT: T['Outward Mail'], RB: T['Room Bookings'], AST: T['Assets'],
    ATT: T['Attendance'], days: T._attDays, attMonth: T._attMonth, payMonth: T._payMonth,
    holidays: WD.HOLIDAYS().map(h => h.date)
  };
  C.uniq = (a) => WD.x.uniq(a.filter(v => v !== '' && v != null));
  C.choice = (R, arr) => (arr && arr.length ? arr[Math.floor(R() * arr.length)] : null);
  C.depts = () => C.uniq(C.E.map(e => e.dept));
  C.pickDept = (R, minCount, filterFn) => { const f = filterFn || (() => true); const ds = C.depts().filter(d => C.E.filter(e => e.dept === d && f(e)).length >= minCount); return C.choice(R, ds); };
  C.pickEmp = (R, filterFn) => { const f = filterFn || (() => true); return C.choice(R, C.E.filter(f)); };
  return C;
};

WD.REQ = {
  emp8: C => C.E.length >= 8, leave10: C => C.LV.length >= 1, att: C => C.ATT.length >= 1, pay: C => C.PAY.length >= 1,
  petty: C => C.PC.length >= 1, stock: C => C.STK.length >= 1, proc: C => C.REQ.length >= 1, trav: C => C.TRV.length >= 1,
  vend: C => C.VND.length >= 1, maint: C => C.MT.length >= 1, griev: C => C.GRV.length >= 1, vis: C => C.VIS.length >= 1,
  mail: C => C.IN.length >= 1 || C.OUT.length >= 1, room: C => C.RB.length >= 1, asset: C => C.AST.length >= 1
};

WD.taskEligible = function(t, C) { return (t.req || []).every(k => WD.REQ[k] ? WD.REQ[k](C) : true); };

/* Human-readable reason a request is still locked, keyed the same as WD.REQ */
WD.REQ_HINT = {
  emp8: 'at least 8 employees added (Unit 1)', leave10: 'at least one leave application (Unit 3)',
  att: 'attendance marked for at least 5 days for at least 5 employees in one month (Unit 2)', pay: 'at least one payroll run (Unit 6)',
  petty: 'at least one petty cash voucher (Unit 17)', stock: 'at least one stock item (Unit 18)',
  proc: 'at least one purchase requisition (Unit 17)', trav: 'at least one travel expense claim (Unit 19)',
  vend: 'at least one vendor record (Unit 21)', maint: 'at least one maintenance ticket (Unit 23)',
  griev: 'at least one grievance filed (Unit 22)', vis: 'at least one visitor logged (Unit 14)',
  mail: 'at least one inward or outward mail entry (Unit 13)', room: 'at least one room booking (Unit 20)',
  asset: 'at least one company asset (Unit 9)'
};

/* What a session is still missing, for the "locked" card when it has zero eligible tasks yet */
WD.sessionMissing = function(sesId, C) {
  const need = new Set();
  WD_TASKS.filter(t => t.ses === sesId).forEach(t => (t.req || []).forEach(k => { if (WD.REQ[k] && !WD.REQ[k](C)) need.add(k); }));
  return Array.from(need).map(k => WD.REQ_HINT[k] || k);
};

/* Get (or freeze) this student's params for a task; null = not currently generable */
WD.getParams = function(task, C) {
  const store = Store.getWorkRequests();
  if (store.params[task.id] !== undefined) return store.params[task.id];
  const R = WD.rng(WD.studentSeed() + '::' + task.id);
  let params = null;
  try { params = task.pick(C, R); } catch (e) { params = null; }
  Store.saveWorkRequestParams(task.id, params);
  return params;
};

/* Compute the correct answer set (array of acceptable values, or a single value) for a task+params */
WD.computeAnswer = function(task, params, C) {
  try { return task.ans(params, C); } catch (e) { return null; }
};

/* ---------------------------------------------------------
   Answer matching — forgiving on formatting, strict on value
   --------------------------------------------------------- */
WD.normNum = function(s) { if (s == null) return null; const t = String(s).replace(/[₹,\s]/g, '').replace(/^\((.*)\)$/, '-$1'); const n = Number(t); return isFinite(n) ? n : null; };
WD.normText = function(s) { return WD.x.trim(String(s == null ? '' : s)).toLowerCase().replace(/[.,]/g, ''); };
WD.normDate = function(s) {
  if (s == null || s === '') return null;
  const t = String(s).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t); if (m) return WD.dt.ser(WD.dt.fmt(+m[1], +m[2], +m[3]));
  m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(t); if (m) return WD.dt.ser(WD.dt.fmt(+m[3], +m[2], +m[1]));
  m = /^(\d{1,2})[\s\-]([A-Za-z]{3,})[\s\-](\d{4})$/.exec(t);
  if (m) { const mi = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].slice(0, 3).toLowerCase()); if (mi >= 0) return WD.dt.ser(WD.dt.fmt(+m[3], mi + 1, +m[1])); }
  return null;
};

WD.checkAnswer = function(task, params, userVal, C) {
  const expected = WD.computeAnswer(task, params, C);
  if (expected === null || expected === undefined) return { ok: false, na: true };
  const raw = String(userVal == null ? '' : userVal).trim();
  if (!raw) return { ok: false, empty: true };
  if (task.kind === 'num') {
    const got = WD.normNum(raw); if (got == null) return { ok: false };
    const dp = task.dp || 0; const tol = Math.max(0.5 * Math.pow(10, -dp), Math.abs(expected) * 0.0005);
    return { ok: Math.abs(got - expected) <= tol + 1e-6 };
  }
  if (task.kind === 'date') {
    const got = WD.normDate(raw); const exp = WD.normDate(expected);
    return { ok: got != null && exp != null && got === exp };
  }
  const options = Array.isArray(expected) ? expected : [expected];
  const gotT = WD.normText(raw);
  return { ok: options.some(o => WD.normText(o) === gotT) };
};

/* ---------------------------------------------------------
   UI
   --------------------------------------------------------- */
WD.sessionTasks = function(sesId, C) {
  return WD_TASKS.filter(t => {
    if (t.ses !== sesId || !WD.taskEligible(t, C)) return false;
    const params = WD.getParams(t, C);
    if (params === null || params === undefined) return false;
    const ans = WD.computeAnswer(t, params, C);
    return ans !== null && ans !== undefined;
  });
};

WD.expectedText = function(task, params, C) {
  const v = WD.computeAnswer(task, params, C);
  if (v === null || v === undefined) return '—';
  if (task.kind === 'date') return WD.dt.human(v);
  if (task.kind === 'num') return (task.unit === '\u20B9' ? '\u20B9' : '') + Number(v).toLocaleString('en-IN', { minimumFractionDigits: task.dp || 0, maximumFractionDigits: task.dp || 0 }) + (task.unit && task.unit !== '\u20B9' ? ' ' + task.unit : '');
  return Array.isArray(v) ? v[0] : v;
};

Modules.excellab = function(container) {
  const C = WD.buildContext();
  const attempts = Store.getWorkRequests().attempts;
  const readyCount = Object.keys(WD.REQ).filter(k => WD.REQ[k](C)).length;
  const dataReady = C.E.length >= 8;

  if (!dataReady) {
    container.innerHTML = `
      <div class="page-head"><div><div class="eyebrow">General Office Skills</div><h1>Office Work Requests</h1>
      <p class="desc">Colleagues across the office send you short data requests — you pull the figures from the live system, work them out in Excel, and report back.</p></div></div>
      <div class="card" style="padding:22px;text-align:center;">
        <p style="margin-bottom:14px;">Your Employee Master needs at least 8 employees before requests can be generated. Add employees yourself, or use the lightning-bolt (&#9889;) sample-data button at the top of the screen — it now sets up every register these requests draw on in one go.</p>
        <button class="btn btn-primary" onclick="navigate('employees')">Go to Employees</button>
      </div>`;
    return;
  }

  const allEligible = [].concat.apply([], WD_SESSIONS.map(s => WD.sessionTasks(s.id, C)));
  const solved = allEligible.filter(t => (attempts[t.id] || {}).correct).length;
  const total = allEligible.length;

  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Office Work Requests</h1>
      <p class="desc">These are not Excel exercises — they are the kind of short data request a colleague actually sends you. Pull the sheet you need, work it out with the right formula yourself, and type back only the final result.</p></div>
      <div class="page-actions"><span class="badge" id="wd-total-badge" style="font-size:13px;padding:6px 12px;">${solved} of ${total} resolved</span></div>
    </div>
    <div class="card" style="padding:16px 18px;margin-bottom:18px;">
      <b>How this works</b>
      <ol style="margin:8px 0 0 18px;padding:0;font-size:13px;line-height:1.7;">
        <li>Open a session below — each is a themed batch of requests from a real colleague.</li>
        <li>Click <b>Download data for this session</b> to get the exact sheets you need as a real .xlsx file.</li>
        <li>Open it in Excel or Google Sheets, find the answer using formulas — no formula names are given, work out which one fits.</li>
        <li>Type only the final result into the box and click <b>Submit</b>.</li>
      </ol>
    </div>
    <div id="wd-sessions"></div>
  `;

  const wrap = document.getElementById('wd-sessions');
  wrap.innerHTML = WD_SESSIONS.map(s => {
    const tasks = WD.sessionTasks(s.id, C);
    if (!tasks.length) {
      const missing = WD.sessionMissing(s.id, C);
      return `
      <div class="card wd-session" style="margin-bottom:14px;opacity:.7;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:20px;">${s.icon}</span>
            <div><div style="font-weight:600;">${s.title}</div>
              <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">${missing.length ? 'Needs ' + missing.join(', ') + ' before any request here can be generated.' : 'No requests available for this session yet.'}</div>
            </div>
          </div>
          <span class="badge">Locked</span>
        </div>
      </div>`;
    }
    const done = tasks.filter(t => (attempts[t.id] || {}).correct).length;
    return `
      <div class="card wd-session" style="margin-bottom:14px;">
        <div class="wd-session-head" data-ses="${s.id}" style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;cursor:pointer;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:20px;">${s.icon}</span>
            <div><div style="font-weight:600;">${s.title}</div><div style="font-size:12px;color:var(--text-dim);margin-top:2px;">${tasks.length} requests waiting</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="badge ${done === tasks.length ? 'success' : ''}" id="wd-ses-badge-${s.id}">${done}/${tasks.length}</span>
            <span class="wd-chevron" id="wd-chev-${s.id}">&#9660;</span>
          </div>
        </div>
        <div class="wd-session-body hidden" id="wd-body-${s.id}"></div>
      </div>`;
  }).join('') || `<div class="card" style="padding:22px;text-align:center;">Every request needs more variety of data than is currently in the system. Generate more sample data (attendance, leave, or the office registers) and check back.</div>`;

  document.querySelectorAll('.wd-session-head').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.ses;
      const body = document.getElementById('wd-body-' + id);
      const chev = document.getElementById('wd-chev-' + id);
      const open = !body.classList.contains('hidden');
      if (open) { body.classList.add('hidden'); chev.innerHTML = '&#9660;'; return; }
      chev.innerHTML = '&#9650;';
      if (!body.dataset.rendered) { WD.renderSession(id, body, C); body.dataset.rendered = '1'; }
      body.classList.remove('hidden');
    });
  });
};

WD.renderSession = function(sesId, body, C) {
  const ses = WD_SESSIONS.find(s => s.id === sesId);
  const tasks = WD.sessionTasks(sesId, C);
  const attempts = Store.getWorkRequests().attempts;
  const sheets = WD.x.uniq([].concat.apply([], tasks.map(t => t.src)));

  body.innerHTML = `
    <div style="padding:0 18px 18px;">
      <p style="font-size:13px;color:var(--text-dim);margin:10px 0 14px;">${ses.narrative}</p>
      <div style="margin-bottom:16px;"><button class="btn btn-outline btn-sm" id="wd-dl-${sesId}">&#128190; Download data for this session (.xlsx)</button>
        ${sheets.length ? `<span style="font-size:12px;color:var(--text-dim);margin-left:10px;">Includes: ${sheets.map(n => WD.SHEET_LABEL[n] || n).join(', ')}</span>` : ''}
      </div>
      <div class="wd-tasklist"></div>
    </div>`;
  document.getElementById('wd-dl-' + sesId).onclick = () => WD.downloadExtract(sheets, ses.title.replace(/^Session \d+\s*—\s*/, ''));

  const list = body.querySelector('.wd-tasklist');
  list.innerHTML = tasks.map(t => {
    const params = WD.getParams(t, C);
    const [name, role] = WD_SENDERS[t.from] || ['Office', 'Colleague'];
    const att = attempts[t.id];
    const solved = att && att.correct;
    return `
    <div class="card wd-task ${solved ? 'wd-solved' : ''}" id="wd-task-${t.id}" style="padding:16px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div style="flex:1;">
          <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.04em;">From: ${name} &middot; ${role}</div>
          <div style="font-weight:600;margin:2px 0 6px;">${t.subj(params)}</div>
          <div style="font-size:13.5px;line-height:1.55;">${t.body(params)}</div>
        </div>
        <span class="badge" style="flex-shrink:0;">${'&#9733;'.repeat(t.lvl || 1)}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap;">
        <input type="text" class="wd-input" id="wd-in-${t.id}" placeholder="Your answer${t.unit && t.unit !== '\u20B9' ? ' (' + t.unit + ')' : ''}" style="max-width:220px;" value="${att && !solved ? escapeHtml(String(att.last || '')) : ''}" ${solved ? 'disabled' : ''}>
        <button class="btn btn-primary btn-sm" id="wd-go-${t.id}" ${solved ? 'disabled' : ''}>${solved ? '&#10003; Correct' : 'Submit'}</button>
        ${!solved ? `<button class="btn btn-outline btn-sm" id="wd-hint-${t.id}">Hint</button>` : ''}
      </div>
      <div id="wd-fb-${t.id}" style="margin-top:8px;font-size:12.5px;"></div>
    </div>`;
  }).join('');

  tasks.forEach(t => {
    const params = WD.getParams(t, C);
    const att = attempts[t.id];
    if (att && att.correct) return;
    const input = document.getElementById('wd-in-' + t.id);
    const go = document.getElementById('wd-go-' + t.id);
    const fb = document.getElementById('wd-fb-' + t.id);
    const hintBtn = document.getElementById('wd-hint-' + t.id);
    const submit = () => {
      const val = input.value;
      const res = WD.checkAnswer(t, params, val, C);
      const tries = ((att && att.tries) || 0) + 1;
      Store.recordWorkAttempt(t.id, { tries, last: val, correct: !!res.ok });
      if (res.ok) {
        fb.innerHTML = `<span style="color:var(--success,#1a8a4a);font-weight:600;">&#10003; Correct — that matches the system figure.</span>`;
        input.disabled = true; go.disabled = true; go.innerHTML = '&#10003; Correct';
        document.getElementById('wd-task-' + t.id).classList.add('wd-solved');
        WD.bumpBadge('wd-ses-badge-' + t.ses);
        WD.bumpBadge('wd-total-badge');
      } else if (res.na) {
        fb.innerHTML = `<span style="color:var(--danger,#c0392b);">This request can\u2019t be verified right now — the underlying data changed. Refresh the page to get a fresh request.</span>`;
      } else {
        fb.innerHTML = `<span style="color:var(--danger,#c0392b);">Not quite — check the figure and try again.${tries >= 2 ? ' Tip: ' + t.nudge : ''}</span>`;
      }
    };
    go.onclick = submit;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    if (hintBtn) hintBtn.onclick = () => { fb.innerHTML = `<span style="color:var(--text-dim);">${t.nudge}</span>`; };
  });
};

WD.bumpBadge = function(id) {
  const el = document.getElementById(id); if (!el) return;
  const m = /(\d+)\D+(\d+)/.exec(el.textContent); if (!m) return;
  const n = Math.min(+m[1] + 1, +m[2]);
  el.textContent = el.textContent.replace(m[1], String(n));
  if (id.indexOf('wd-ses-badge-') === 0 && n === +m[2]) el.classList.add('success');
};
