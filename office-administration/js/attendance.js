/* =========================================================
   attendance.js — Attendance Register & Monthly Sheet
   ========================================================= */

let _attMonth = todayISO().slice(0,7);
let _attView = 'register'; // register | sheet
const ATT_CODES = ['P','A','L','H','OD','WFH','HD'];
const ATT_CODE_LABELS = { P:'Present', A:'Absent', L:'Leave', H:'Holiday', OD:'On Duty', WFH:'Work From Home', HD:'Half Day' };

Modules.attendance = function(container) {
  const employees = Store.getEmployees();
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Module 3 &amp; 4</div><h1>Attendance Register</h1><p class="desc">Mark daily attendance and generate the monthly attendance sheet — Excel-style, just like real companies.</p></div>
      <div class="page-actions">
        <input type="month" id="att-month" value="${_attMonth}">
        <button class="btn btn-outline" onclick="attGenerateSample()">&#9889; Auto-fill Month</button>
      </div>
    </div>
    <div class="tabs" style="margin-bottom:18px;">
      <button class="tab-btn ${_attView==='register'?'active':''}" data-v="register">Daily Register</button>
      <button class="tab-btn ${_attView==='sheet'?'active':''}" data-v="sheet">Monthly Sheet</button>
      <button class="tab-btn ${_attView==='regularization'?'active':''}" data-v="regularization">Regularization Requests${Store.getRegularizations().filter(r=>r.status==='Pending').length ? ` (${Store.getRegularizations().filter(r=>r.status==='Pending').length})` : ''}</button>
      <button class="tab-btn ${_attView==='timelog'?'active':''}" data-v="timelog">Time Log</button>
    </div>
    <div id="att-mount"></div>
  `;
  document.getElementById('att-month').onchange = (e) => { _attMonth = e.target.value; renderAttendanceView(); };
  document.querySelectorAll('.tab-btn[data-v]').forEach(b => b.onclick = () => { _attView = b.dataset.v; renderAttendanceView(); });
  renderAttendanceView();
};

function attGenerateSample() {
  if (Store.getEmployees().length === 0) return toast('Add employees first', 'error');
  Store.generateSampleAttendance(_attMonth);
  toast('✓ Attendance auto-filled for ' + _attMonth, 'success');
  renderAttendanceView();
}

function renderAttendanceView() {
  document.querySelectorAll('.tab-btn[data-v]').forEach(b => b.classList.toggle('active', b.dataset.v === _attView));
  if (_attView === 'register') renderAttendanceRegister();
  else if (_attView === 'sheet') renderAttendanceSheet();
  else if (_attView === 'regularization') renderRegularizationRequests();
  else renderTimeLog();
}

function renderRegularizationRequests() {
  const mount = document.getElementById('att-mount');
  const employees = Store.getEmployees();
  const regs = Store.getRegularizations().slice().reverse();
  mount.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-head"><h3>Submit a Regularization Request</h3><span class="hint">e.g. forgot to mark attendance, wrong code entered</span></div>
      <div class="card-pad">
        <div class="form-grid">
          <div class="field"><label>Employee</label><select id="rg-emp">${employees.map(e=>`<option value="${e.id}">${e.firstName} ${e.lastName}</option>`).join('')}</select></div>
          <div class="field"><label>Date</label><input type="date" id="rg-date" value="${todayISO()}"></div>
          <div class="field"><label>Requested Code</label><select id="rg-code">${ATT_CODES.map(c=>`<option value="${c}">${c} — ${ATT_CODE_LABELS[c]}</option>`).join('')}</select></div>
          <div class="field span-3"><label>Reason</label><input id="rg-reason" placeholder="Brief reason for the correction"></div>
        </div>
        <button class="btn btn-primary btn-sm" style="margin-top:14px;" onclick="submitRegularization()">Submit Request</button>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h3>All Requests</h3></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Employee</th><th>Date</th><th>Requested Code</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${regs.length ? regs.map(r => {
          const emp = Store.getEmployee(r.empId);
          return `<tr>
            <td>${emp ? escapeHtml(emp.firstName+' '+emp.lastName) : r.empId}</td>
            <td>${fmtDate(r.date)}</td>
            <td>${r.requestedCode} — ${ATT_CODE_LABELS[r.requestedCode]}</td>
            <td style="max-width:200px;white-space:normal;">${escapeHtml(r.reason)}</td>
            <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
            <td>${r.status==='Pending' ? `<div class="actions-cell"><button class="icon-action" style="color:var(--sage-dark);" onclick="decideRegularizationUI('${r.id}','Approved')">&#10003;</button><button class="icon-action danger" onclick="decideRegularizationUI('${r.id}','Rejected')">&#10005;</button></div>` : '—'}</td>
          </tr>`;
        }).join('') : `<tr><td colspan="6" style="text-align:center;color:var(--text-faint);">No regularization requests yet</td></tr>`}</tbody>
      </table></div>
    </div>
  `;
}
function submitRegularization() {
  const empId = document.getElementById('rg-emp').value;
  const date = document.getElementById('rg-date').value;
  const code = document.getElementById('rg-code').value;
  const reason = document.getElementById('rg-reason').value.trim();
  if (!reason) return toast('Please enter a reason', 'error');
  Store.requestRegularization(empId, date, code, reason);
  toast('✓ Regularization request submitted', 'success');
  renderRegularizationRequests();
}
function decideRegularizationUI(id, status) {
  Store.decideRegularization(id, status);
  toast(`Request ${status.toLowerCase()}`, status==='Approved'?'success':'error');
  renderRegularizationRequests();
}

/* ---------------- Time Log (check-in / check-out) ---------------- */
let _timeLogDate = todayISO();
function renderTimeLog() {
  const mount = document.getElementById('att-mount');
  const employees = Store.getEmployees();
  if (employees.length === 0) {
    mount.innerHTML = `<div class="card"><div class="empty-state"><div class="ic">&#8987;</div><h4>No employees yet</h4><p>Add employees first to log check-in/check-out times.</p></div></div>`;
    return;
  }
  const month = _timeLogDate.slice(0,7);
  const day = parseInt(_timeLogDate.slice(8,10), 10);
  mount.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3>Check-in / Check-out Time Log</h3>
        <input type="date" id="tl-date" value="${_timeLogDate}" style="padding:8px 10px;border:1px solid var(--line-strong);border-radius:6px;">
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Employee</th><th>Shift</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead>
          <tbody>
            ${employees.map(e => {
              const shift = Store.getShift(e.id);
              const times = Store.getAttendanceTime(month, e.id, day);
              const late = Store.isLateArrival(e.id, times.in);
              return `<tr>
                <td><div class="cell-name"><div class="avatar-sm">${initials(e.firstName,e.lastName)}</div>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</div></td>
                <td><span class="badge badge-info">${shift.shiftName}</span> <span class="text-faint" style="font-size:11px;">${shift.start}–${shift.end}</span></td>
                <td><input type="time" value="${times.in}" style="padding:5px 7px;border:1px solid var(--line-strong);border-radius:5px;font-size:12px;" onchange="saveTimeLogUI('${e.id}','in',this.value)"></td>
                <td><input type="time" value="${times.out}" style="padding:5px 7px;border:1px solid var(--line-strong);border-radius:5px;font-size:12px;" onchange="saveTimeLogUI('${e.id}','out',this.value)"></td>
                <td>${times.in ? (late ? '<span class="badge badge-notice-period">Late</span>' : '<span class="badge badge-active">On Time</span>') : '<span class="text-faint" style="font-size:11.5px;">Not logged</span>'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.getElementById('tl-date').onchange = (e) => { _timeLogDate = e.target.value; renderTimeLog(); };
}
function saveTimeLogUI(empId, field, value) {
  const month = _timeLogDate.slice(0,7);
  const day = parseInt(_timeLogDate.slice(8,10), 10);
  const times = Store.getAttendanceTime(month, empId, day);
  times[field] = value;
  Store.setAttendanceTime(month, empId, day, times);
  renderTimeLog();
}

function daysInMonthOf(monthStr) {
  const [y,m] = monthStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function renderAttendanceRegister() {
  const mount = document.getElementById('att-mount');
  const employees = Store.getEmployees();
  if (employees.length === 0) {
    mount.innerHTML = `<div class="card"><div class="empty-state"><div class="ic">&#128197;</div><h4>No employees to mark attendance for</h4><p>Add employees first, then come back to mark attendance.</p><button class="btn btn-primary" onclick="navigate('employees')">Go to Employees</button></div></div>`;
    return;
  }
  const days = daysInMonthOf(_attMonth);
  const [y,m] = _attMonth.split('-').map(Number);
  const monthData = Store.getMonthAttendance(_attMonth);

  mount.innerHTML = `
    <div class="card card-pad">
      <div class="att-grid-wrap">
        <table class="att-table">
          <thead><tr>
            <th class="emp-col">Employee</th>
            ${Array.from({length:days},(_,i)=>i+1).map(d => `<th class="${new Date(y,m-1,d).getDay()===0?'sun':''}">${pad(d)}</th>`).join('')}
            <th>P</th><th>A</th><th>%</th>
          </tr></thead>
          <tbody>
            ${employees.map(emp => {
              const rec = (monthData[emp.id]) || {};
              let p=0,a=0,marked=0;
              Array.from({length:days},(_,i)=>i+1).forEach(d => { const c = rec[pad(d)]; if (c) marked++; if (c==='P'||c==='WFH'||c==='OD') p++; if (c==='A') a++; });
              const pct = marked ? Math.round((p/marked)*100) : 0;
              return `<tr>
                <td class="emp-col"><div class="cell-name"><div class="avatar-sm" style="width:22px;height:22px;font-size:9px;">${initials(emp.firstName,emp.lastName)}</div>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</div></td>
                ${Array.from({length:days},(_,i)=>i+1).map(d => {
                  const code = rec[pad(d)] || '';
                  const isSun = new Date(y,m-1,d).getDay()===0;
                  const isFuture = new Date(y,m-1,d) > new Date();
                  return `<td class="${isSun?'sun':''}"><button class="att-cell code-${code}" ${isFuture?'disabled':''} onclick="cycleAttendance('${emp.id}',${d})" title="${ATT_CODE_LABELS[code]||'Not marked'}">${code||'·'}</button></td>`;
                }).join('')}
                <td class="mono">${p}</td><td class="mono">${a}</td><td class="mono">${pct}%</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="att-legend">
        ${ATT_CODES.map(c => `<span><span class="sw" style="background:var(--${attColorVar(c)});"></span>${c} — ${ATT_CODE_LABELS[c]}</span>`).join('')}
        <span style="margin-left:auto;color:var(--text-faint);">Click a cell to cycle through attendance codes</span>
      </div>
    </div>
  `;
}
function attColorVar(c) { return { P:'sage', A:'clay', L:'amber', H:'teal', OD:'teal', WFH:'teal', HD:'amber' }[c] || 'line'; }

function cycleAttendance(empId, day) {
  const rec = Store.getAttendance(_attMonth, empId);
  const current = rec[pad(day)] || '';
  const idx = ATT_CODES.indexOf(current);
  const next = idx === -1 ? ATT_CODES[0] : (idx === ATT_CODES.length - 1 ? '' : ATT_CODES[idx+1]);
  Store.markAttendance(_attMonth, empId, day, next);
  renderAttendanceView();
}

function renderAttendanceSheet() {
  const mount = document.getElementById('att-mount');
  const employees = Store.getEmployees();
  if (employees.length === 0) {
    mount.innerHTML = `<div class="card"><div class="empty-state"><div class="ic">&#128202;</div><h4>No data available</h4><p>Add employees and mark attendance first.</p></div></div>`;
    return;
  }
  const days = daysInMonthOf(_attMonth);
  const [y,m] = _attMonth.split('-').map(Number);
  const monthData = Store.getMonthAttendance(_attMonth);
  const workingDays = Array.from({length:days},(_,i)=>i+1).filter(d => new Date(y,m-1,d).getDay() !== 0).length;

  const rows = employees.map(emp => {
    const rec = monthData[emp.id] || {};
    let p=0,a=0,l=0,h=0;
    Object.values(rec).forEach(c => { if (c==='P'||c==='WFH'||c==='OD') p++; else if (c==='A') a++; else if (c==='L'||c==='HD') l++; else if (c==='H') h++; });
    const pct = workingDays ? Math.round((p/workingDays)*100) : 0;
    return { emp, p, a, l, h, pct };
  });

  mount.innerHTML = `
    <div class="card">
      <div class="card-head"><h3>Monthly Attendance Sheet — ${monthLabel(_attMonth)}</h3>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="attExportExcel()">&#128190; Export Excel</button>
          <button class="btn btn-outline btn-sm" onclick="attPrintSheet()">&#128438; Print / PDF</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Employee</th><th>Department</th><th>Present</th><th>Absent</th><th>Leave</th><th>Holiday</th><th>Working Days</th><th>Attendance %</th></tr></thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td><div class="cell-name"><div class="avatar-sm">${initials(r.emp.firstName,r.emp.lastName)}</div>${escapeHtml(r.emp.firstName)} ${escapeHtml(r.emp.lastName)}</div></td>
              <td>${escapeHtml(r.emp.department)}</td>
              <td class="mono">${r.p}</td><td class="mono">${r.a}</td><td class="mono">${r.l}</td><td class="mono">${r.h}</td>
              <td class="mono">${workingDays}</td>
              <td><span class="badge ${r.pct>=90?'badge-active':r.pct>=75?'badge-pending':'badge-inactive'}">${r.pct}%</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
function monthLabel(m) {
  const [y,mo] = m.split('-').map(Number);
  return new Date(y, mo-1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function attExportExcel() {
  const employees = Store.getEmployees();
  const monthData = Store.getMonthAttendance(_attMonth);
  const days = daysInMonthOf(_attMonth);
  const [y,m] = _attMonth.split('-').map(Number);
  const workingDays = Array.from({length:days},(_,i)=>i+1).filter(d => new Date(y,m-1,d).getDay() !== 0).length;
  const rows = [['Employee Name','Department','Present','Absent','Leave','Holiday','Working Days','Attendance %']];
  employees.forEach(emp => {
    const rec = monthData[emp.id] || {};
    let p=0,a=0,l=0,h=0;
    Object.values(rec).forEach(c => { if (c==='P'||c==='WFH'||c==='OD') p++; else if (c==='A') a++; else if (c==='L'||c==='HD') l++; else if (c==='H') h++; });
    rows.push([`${emp.firstName} ${emp.lastName}`, emp.department, p, a, l, h, workingDays, workingDays?Math.round((p/workingDays)*100)+'%':'0%']);
  });
  exportCSV(`attendance-sheet-${_attMonth}.csv`, rows);
  Store.logDocument('Attendance Export', 'ALL', `Monthly Attendance Sheet — ${_attMonth}`);
}

function attPrintSheet() {
  const employees = Store.getEmployees();
  const monthData = Store.getMonthAttendance(_attMonth);
  const days = daysInMonthOf(_attMonth);
  const [y,m] = _attMonth.split('-').map(Number);
  const workingDays = Array.from({length:days},(_,i)=>i+1).filter(d => new Date(y,m-1,d).getDay() !== 0).length;
  const rowsHtml = employees.map(emp => {
    const rec = monthData[emp.id] || {};
    let p=0,a=0,l=0;
    Object.values(rec).forEach(c => { if (c==='P'||c==='WFH'||c==='OD') p++; else if (c==='A') a++; else if (c==='L'||c==='HD') l++; });
    return `<tr><td>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</td><td>${escapeHtml(emp.department)}</td><td>${p}</td><td>${a}</td><td>${l}</td><td>${workingDays}</td><td>${workingDays?Math.round((p/workingDays)*100):0}%</td></tr>`;
  }).join('');
  const html = `<div class="doc-page">
    ${letterheadHTML('Monthly Attendance Sheet')}
    <div class="doc-ref-row"><span>${monthLabel(_attMonth)}</span><span>Generated ${fmtDate(todayISO())}</span></div>
    <div class="doc-title">ATTENDANCE SHEET — ${monthLabel(_attMonth).toUpperCase()}</div>
    <table class="doc-table"><thead><tr><th>Employee</th><th>Department</th><th>Present</th><th>Absent</th><th>Leave</th><th>Working Days</th><th>%</th></tr></thead><tbody>${rowsHtml}</tbody></table>
  </div>`;
  printArea(html);
  Store.logDocument('Attendance Export', 'ALL', `Monthly Attendance Sheet — ${_attMonth}`);
}
