/* =========================================================
   reports.js — Reports, Search, Notifications, Notices,
                Calendar, Instructor Scoring Mode
   ========================================================= */

/* ================= Reports (Module 12 & 18) ================= */
Modules.reports = function(container) {
  const employees = Store.getEmployees();
  const deptCounts = {};
  employees.forEach(e => deptCounts[e.department] = (deptCounts[e.department]||0)+1);
  const statusCounts = { Active: employees.filter(e=>e.status==='Active').length, Inactive: employees.filter(e=>e.status==='Inactive').length };
  const month = todayISO().slice(0,7);
  const monthData = Store.getMonthAttendance(month);
  let totalP=0,totalA=0;
  Object.values(monthData).forEach(rec => Object.values(rec).forEach(c => { if (c==='P'||c==='WFH'||c==='OD') totalP++; else if (c==='A') totalA++; }));
  const leaveByType = {};
  Store.getLeaveApplications().forEach(l => leaveByType[l.leaveType] = (leaveByType[l.leaveType]||0)+1);

  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Module 12 &amp; 18</div><h1>HR Reports</h1><p class="desc">Visual summaries across employees, attendance, leave and departments — export or print as a full HR report.</p></div>
      <div class="page-actions">
        <button class="btn btn-outline" onclick="exportFullReport()">&#128190; Export Excel</button>
        <button class="btn btn-primary" onclick="printFullReport()">&#128438; Full HR Report (PDF)</button>
      </div>
    </div>
    ${employees.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128202;</div><h4>No data to report on yet</h4><p>Add employees and mark attendance to generate reports.</p></div></div>` : `
    <div class="grid grid-2" style="margin-bottom:20px;">
      <div class="card card-pad">
        <h3 style="margin-bottom:16px;font-size:15px;">Employees by Department</h3>
        <div class="bar-chart">
          ${Object.entries(deptCounts).map(([d,c]) => `<div class="bar-col"><div class="bar-val">${c}</div><div class="bar" style="height:${Math.max(8,(c/employees.length)*150)}px;"></div><div class="bar-lbl">${d.split(' ')[0]}</div></div>`).join('')}
        </div>
      </div>
      <div class="card card-pad">
        <h3 style="margin-bottom:16px;font-size:15px;">Employee Status</h3>
        <div class="donut-wrap">
          ${donutSVG([{label:'Active', val: statusCounts.Active, color:'#5B8C5B'},{label:'Inactive', val: statusCounts.Inactive, color:'#C1502E'}])}
        </div>
      </div>
    </div>
    <div class="grid grid-2" style="margin-bottom:20px;">
      <div class="card card-pad">
        <h3 style="margin-bottom:16px;font-size:15px;">Attendance This Month (${monthLabel(month)})</h3>
        <div class="donut-wrap">
          ${donutSVG([{label:'Present', val: totalP, color:'#5B8C5B'},{label:'Absent', val: totalA, color:'#C1502E'}])}
        </div>
      </div>
      <div class="card card-pad">
        <h3 style="margin-bottom:16px;font-size:15px;">Leave Applications by Type</h3>
        <div class="bar-chart">
          ${Object.keys(LEAVE_TYPES).filter(k=>leaveByType[k]).map(k => `<div class="bar-col"><div class="bar-val">${leaveByType[k]}</div><div class="bar" style="height:${Math.max(8,(leaveByType[k]/Math.max(...Object.values(leaveByType)))*150)}px;background:var(--amber);"></div><div class="bar-lbl">${k}</div></div>`).join('') || '<p class="text-dim" style="font-size:12.5px;">No leave data yet.</p>'}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Department-wise Report</h3></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Department</th><th>Employees</th><th>% of Workforce</th></tr></thead>
        <tbody>${Object.entries(deptCounts).map(([d,c]) => `<tr><td>${d}</td><td class="mono">${c}</td><td><div class="progress-bar" style="width:120px;display:inline-block;vertical-align:middle;margin-right:8px;"><div style="width:${Math.round(c/employees.length*100)}%"></div></div>${Math.round(c/employees.length*100)}%</td></tr>`).join('')}</tbody>
      </table></div>
    </div>
    ${Store.getResignations().length > 0 ? `
    <div class="card" style="margin-top:20px;">
      <div class="card-head"><h3>Exit Management Reports</h3><span class="hint">${Store.getResignations().length} resignation(s) on record</span></div>
      <div class="card-pad">
        <div class="grid grid-4" style="margin-bottom:18px;">
          <div class="card stat-tile accent-clay"><div class="stat-label">Attrition Rate</div><div class="stat-value">${Math.round(Store.getFormerEmployees().length / Math.max(1,Store.getEmployees().length) * 100)}%</div><div class="stat-sub">${Store.getFormerEmployees().length} of ${Store.getEmployees().length} total records</div></div>
          <div class="card stat-tile accent-amber"><div class="stat-label">Active Notice Periods</div><div class="stat-value">${Store.getResignations().filter(r=>r.noticeStatus==='Running').length}</div><div class="stat-sub">currently serving</div></div>
          <div class="card stat-tile accent-teal"><div class="stat-label">Settlements Paid</div><div class="stat-value">${Object.values(Store.load().finalSettlements).filter(s=>s.status==='Paid').length}</div><div class="stat-sub">of ${Store.getResignations().length} resignations</div></div>
          <div class="card stat-tile accent-sage"><div class="stat-label">Exit Interviews Done</div><div class="stat-value">${Object.keys(Store.load().exitInterviews).length}</div><div class="stat-sub">feedback collected</div></div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="exportResignationsCSV()">&#128190; Exit Report</button>
          <button class="btn btn-outline btn-sm" onclick="printExitReportPDF()">&#128438; Print</button>
          <button class="btn btn-outline btn-sm" onclick="exportSettlementReportCSV()">&#128190; Settlement Report</button>
          <button class="btn btn-outline btn-sm" onclick="printSettlementReportPDF()">&#128438; Print</button>
          <button class="btn btn-outline btn-sm" onclick="exportDepartmentExitReportCSV()">&#128190; Department Exit Report</button>
          <button class="btn btn-outline btn-sm" onclick="printDepartmentExitReportPDF()">&#128438; Print</button>
          <button class="btn btn-outline btn-sm" onclick="exportAttritionReportCSV()">&#128190; Attrition Report</button>
          <button class="btn btn-outline btn-sm" onclick="printAttritionReportPDF()">&#128438; Print</button>
          <button class="btn btn-outline btn-sm" onclick="exportNoticePeriodReportCSV()">&#128190; Notice Period Report</button>
          <button class="btn btn-outline btn-sm" onclick="printNoticePeriodReportPDF()">&#128438; Print</button>
          <button class="btn btn-outline btn-sm" onclick="exportFormerEmployeesCSV()">&#128190; Former Employee Report</button>
        </div>
      </div>
    </div>` : ''}
    `}
  `;
};

function donutSVG(segments) {
  const total = segments.reduce((s,x)=>s+x.val,0) || 1;
  let acc = 0;
  const r = 52, cx = 65, cy = 65, circ = 2*Math.PI*r;
  const circles = segments.map(seg => {
    const frac = seg.val/total;
    const dash = frac*circ;
    const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="18" stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-acc*circ}" transform="rotate(-90 ${cx} ${cy})"/>`;
    acc += frac;
    return el;
  }).join('');
  return `<svg class="donut" viewBox="0 0 130 130">${circles}<circle cx="${cx}" cy="${cy}" r="34" fill="#fff"/></svg>
    <div class="donut-legend">${segments.map(s => `<div class="lg-row"><div class="sw" style="background:${s.color};"></div>${s.label}: <b>${s.val}</b> (${total?Math.round(s.val/total*100):0}%)</div>`).join('')}</div>`;
}

function exportFullReport() {
  const employees = Store.getEmployees();
  const rows = [['Report: Employee & HR Summary', '', '', 'Generated: ' + fmtDate(todayISO())]];
  rows.push([]);
  rows.push(['Employee ID','Name','Department','Designation','Status','Joining Date']);
  employees.forEach(e => rows.push([e.id, `${e.firstName} ${e.lastName}`, e.department, e.designation, e.status, e.joiningDate]));
  exportCSV(`hr-full-report-${todayISO()}.csv`, rows);
  Store.logDocument('HR Report', 'ALL', 'Full HR Report Export');
}
function printFullReport() {
  const employees = Store.getEmployees();
  const deptCounts = {};
  employees.forEach(e => deptCounts[e.department] = (deptCounts[e.department]||0)+1);
  const html = `<div class="doc-page">
    ${letterheadHTML('HR Summary Report')}
    <div class="doc-ref-row"><span>Generated ${fmtDate(todayISO())}</span><span></span></div>
    <div class="doc-title">HR MANAGEMENT REPORT</div>
    <p><b>Total Employees:</b> ${employees.length} &nbsp; | &nbsp; <b>Active:</b> ${employees.filter(e=>e.status==='Active').length} &nbsp; | &nbsp; <b>Pending Leave:</b> ${Store.getLeaveApplications().filter(l=>l.status==='Pending').length}</p>
    <table class="doc-table"><thead><tr><th>Department</th><th>Employee Count</th></tr></thead><tbody>${Object.entries(deptCounts).map(([d,c])=>`<tr><td>${d}</td><td>${c}</td></tr>`).join('')}</tbody></table>
    <table class="doc-table" style="margin-top:20px;"><thead><tr><th>ID</th><th>Name</th><th>Department</th><th>Designation</th><th>Status</th></tr></thead>
    <tbody>${employees.map(e=>`<tr><td>${e.id}</td><td>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</td><td>${escapeHtml(e.department)}</td><td>${escapeHtml(e.designation)}</td><td>${e.status}</td></tr>`).join('')}</tbody></table>
  </div>`;
  printArea(html);
  Store.logDocument('HR Report', 'ALL', 'Full HR Report Print');
}

/* ================= Search Employee (Module 13) ================= */
Modules.search = function(container) {
  container.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Module 13</div><h1>Search Employee</h1><p class="desc">Instant search across name, ID, phone number and department.</p></div></div>
    <div class="search-box" style="max-width:480px;margin-bottom:20px;"><span class="ic">&#128269;</span><input id="sr-input" placeholder="Type a name, employee ID, phone or department..." autofocus></div>
    <div id="sr-results"></div>
  `;
  document.getElementById('sr-input').oninput = (e) => renderSearchResults(e.target.value);
  renderSearchResults('');
};
function renderSearchResults(q) {
  const mount = document.getElementById('sr-results');
  const employees = Store.getEmployees();
  let list = employees;
  if (q.trim()) {
    const qq = q.toLowerCase();
    list = employees.filter(e => {
      const res = Store.getActiveResignationForEmployee ? Store.getResignations().find(r => r.empId === e.id) : null;
      return `${e.firstName} ${e.lastName} ${e.id} ${e.phone} ${e.department} ${e.designation} ${e.status} ${res ? res.reason : ''}`.toLowerCase().includes(qq);
    });
  }
  if (!q.trim()) { mount.innerHTML = `<p class="text-dim" style="font-size:13px;">Start typing to search ${employees.length} employees, or browse below.</p>` + renderSearchTable(list.slice(0,10)); return; }
  mount.innerHTML = list.length ? `<p class="text-dim" style="font-size:12.5px;margin-bottom:10px;">${list.length} result(s) found</p>${renderSearchTable(list)}` : `<div class="card"><div class="empty-state"><div class="ic">&#128269;</div><h4>No matches found</h4><p>Try a different name, ID or department.</p></div></div>`;
}
function renderSearchTable(list) {
  if (!list.length) return '';
  return `<div class="card"><div class="table-wrap"><table class="data-table">
    <thead><tr><th>Employee</th><th>ID</th><th>Department</th><th>Designation</th><th>Status</th><th>Phone</th><th></th></tr></thead>
    <tbody>${list.map(e => `<tr><td><div class="cell-name"><div class="avatar-sm">${initials(e.firstName,e.lastName)}</div>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</div></td><td class="mono">${e.id}</td><td>${escapeHtml(e.department)}</td><td>${escapeHtml(e.designation)}</td><td><span class="badge badge-${statusSlug(e.status)}">${e.status}</span></td><td class="mono">${e.phone}</td><td><button class="btn btn-sm btn-outline" onclick="viewEmployee('${e.id}')">View</button></td></tr>`).join('')}</tbody>
  </table></div></div>`;
}

/* ================= Notifications (Module 14) ================= */
function computeNotifications() {
  const employees = Store.getEmployees();
  const notifs = [];
  const today = new Date();
  employees.forEach(e => {
    if (e.dob) {
      const dob = new Date(e.dob);
      if (dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate()) notifs.push({ type: 'Birthday', text: `${e.firstName} ${e.lastName}'s birthday is today 🎂`, icon: '&#127874;' });
    }
    if (e.joiningDate) {
      const jd = new Date(e.joiningDate);
      if (jd.getMonth() === today.getMonth() && jd.getDate() === today.getDate() && jd.getFullYear() < today.getFullYear()) notifs.push({ type: 'Anniversary', text: `${e.firstName} ${e.lastName} completes ${today.getFullYear()-jd.getFullYear()} year(s) today`, icon: '&#127942;' });
    }
  });
  Store.getLeaveApplications().filter(l => l.status === 'Pending').forEach(l => {
    const emp = Store.getEmployee(l.empId);
    notifs.push({ type: 'Pending Approval', text: `Leave request from ${emp ? emp.firstName+' '+emp.lastName : l.empId} awaiting approval`, icon: '&#9993;' });
  });
  const month = todayISO().slice(0,7);
  const monthData = Store.getMonthAttendance(month);
  const todayKey = pad(today.getDate());
  employees.forEach(e => {
    const code = (monthData[e.id]||{})[todayKey];
    if (!code && today.getDay() !== 0) notifs.push({ type: 'Attendance Reminder', text: `Attendance not marked today for ${e.firstName} ${e.lastName}`, icon: '&#8987;' });
  });

  // Regularization requests awaiting a decision
  Store.getRegularizations().filter(r => r.status === 'Pending').forEach(r => {
    const emp = Store.getEmployee(r.empId);
    notifs.push({ type: 'Pending Approval', text: `Attendance regularization from ${emp ? emp.firstName+' '+emp.lastName : r.empId} awaiting decision`, icon: '&#128197;' });
  });

  // Low leave balances
  employees.forEach(e => {
    const bal = Store.getLeaveBalance(e.id);
    const total = (bal.CL||0) + (bal.SL||0) + (bal.EL||0);
    if (total <= 2 && total >= 0) notifs.push({ type: 'Low Leave Balance', text: `${e.firstName} ${e.lastName} has only ${total} leave day(s) remaining`, icon: '&#9878;' });
  });

  // Open requisitions with no candidates yet
  Store.getRequisitions().filter(r => r.status === 'Open').forEach(r => {
    if (Store.getCandidates(r.id).length === 0) notifs.push({ type: 'Recruitment', text: `Requisition "${r.title}" is open with no candidates yet`, icon: '&#128188;' });
  });

  // Candidates sitting in Interview/Offer stage (needs a decision)
  Store.getCandidates().filter(c => ['Interview','Offer'].includes(c.stage)).forEach(c => {
    notifs.push({ type: 'Recruitment', text: `Candidate ${c.name} is at "${c.stage}" stage — needs a decision`, icon: '&#128188;' });
  });

  // Open appraisal cycles with unfinalized reviews
  Store.getCycles().filter(c => c.status === 'Open').forEach(c => {
    const started = Store.getAppraisalsForCycle(c.id);
    const unfinalized = started.filter(a => a.status !== 'Finalized').length;
    if (unfinalized > 0) notifs.push({ type: 'Performance', text: `"${c.name}" has ${unfinalized} review(s) not yet finalized`, icon: '&#127942;' });
  });

  // Payroll not yet run for the current month
  if (employees.filter(e=>e.status==='Active').length > 0 && !Store.getPayrollRun(month)) {
    notifs.push({ type: 'Payroll', text: `Payroll for ${monthLabel(month)} has not been run yet`, icon: '&#128176;' });
  }

  return notifs;
}
Modules.notifications = function(container) {
  const notifs = computeNotifications();
  const grouped = {};
  notifs.forEach(n => { (grouped[n.type] = grouped[n.type]||[]).push(n); });
  container.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Module 14</div><h1>Notifications</h1><p class="desc">Birthdays, joining anniversaries, leave reminders, pending approvals and late attendance — all in one place.</p></div></div>
    ${notifs.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128276;</div><h4>All caught up</h4><p>No notifications right now.</p></div></div>` :
    Object.entries(grouped).map(([type, items]) => `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-head"><h3>${type}</h3><span class="hint">${items.length}</span></div>
        <div class="card-pad" style="padding-top:6px;">${items.map(n => `<div class="activity-item"><div class="a-dot"></div><div>${n.icon} ${n.text}</div></div>`).join('')}</div>
      </div>`).join('')}
  `;
};

/* ================= Notice Board (Module 15) ================= */
const NOTICE_TYPES = ['Meeting','Holiday','Training','Event','Policy Update'];
Modules.notices = function(container) {
  const notices = Store.getNotices();
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Module 15</div><h1>Office Notice Board</h1><p class="desc">Post and view company-wide notices, exactly like a real HR notice board.</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openNoticeForm()">+ Create Notice</button></div>
    </div>
    ${notices.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128226;</div><h4>No notices posted</h4><p>Create your first notice to see it here.</p><button class="btn btn-primary" onclick="openNoticeForm()">+ Create Notice</button></div></div>` :
    notices.map(n => `<div class="notice-card type-${n.type.replace(' ','-')}">
      <div class="n-head"><h4>${escapeHtml(n.title)}</h4><div style="display:flex;gap:8px;align-items:center;"><span class="badge badge-info">${escapeHtml(n.type)}</span><button class="icon-action danger" onclick="deleteNoticeConfirm('${n.id}')">&#128465;</button></div></div>
      <div class="n-meta">Posted ${fmtDate(n.postedOn)}</div>
      <p>${escapeHtml(n.body)}</p>
    </div>`).join('')}
  `;
};
function openNoticeForm() {
  openModal({
    title: 'Create Notice',
    body: `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="field"><label>Title <span class="req">*</span></label><input id="nt-title" placeholder="e.g. Monthly Staff Meeting"></div>
        <div class="field"><label>Type</label><select id="nt-type">${NOTICE_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Details</label><textarea id="nt-body" placeholder="Notice details..."></textarea></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="nt-cancel">Cancel</button><button class="btn btn-primary" id="nt-post">Post Notice</button>`
  });
  document.getElementById('nt-cancel').onclick = closeModal;
  document.getElementById('nt-post').onclick = () => {
    const title = document.getElementById('nt-title').value.trim();
    if (!title) return toast('Title is required', 'error');
    Store.addNotice({ title, type: document.getElementById('nt-type').value, body: document.getElementById('nt-body').value.trim() });
    closeModal(); toast('✓ Notice posted', 'success'); navigate('notices');
  };
}
function deleteNoticeConfirm(id) {
  confirmAction('Delete this notice?', () => { Store.deleteNotice(id); toast('Notice deleted','success'); navigate('notices'); });
}

/* ================= HR Calendar (Module 17) ================= */
let _calMonth = new Date().getMonth(), _calYear = new Date().getFullYear();
Modules.calendar = function(container) {
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Module 17</div><h1>HR Calendar</h1><p class="desc">Joining dates, leave dates, holidays and birthdays plotted across the month.</p></div>
      <div class="page-actions">
        <button class="btn btn-outline btn-sm" id="cal-prev">‹ Prev</button>
        <span style="font-family:var(--font-display);font-weight:600;padding:8px 4px;color:var(--ink);" id="cal-label"></span>
        <button class="btn btn-outline btn-sm" id="cal-next">Next ›</button>
      </div>
    </div>
    <div class="card card-pad" id="cal-mount"></div>
  `;
  document.getElementById('cal-prev').onclick = () => { _calMonth--; if(_calMonth<0){_calMonth=11;_calYear--;} renderCalendar(); };
  document.getElementById('cal-next').onclick = () => { _calMonth++; if(_calMonth>11){_calMonth=0;_calYear++;} renderCalendar(); };
  renderCalendar();
};
function renderCalendar() {
  document.getElementById('cal-label').textContent = new Date(_calYear,_calMonth,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  const employees = Store.getEmployees();
  const firstDow = new Date(_calYear,_calMonth,1).getDay();
  const days = new Date(_calYear,_calMonth+1,0).getDate();
  const today = new Date();

  const events = {};
  const pushEv = (day, cls, text) => { (events[day]=events[day]||[]).push({cls,text}); };
  HOLIDAYS_2026.forEach(h => { const d = new Date(h.date); if (d.getMonth()===_calMonth && d.getFullYear()===_calYear) pushEv(d.getDate(),'ev-holiday','🎉 '+h.name); });
  employees.forEach(e => {
    const jd = new Date(e.joiningDate); if (jd.getMonth()===_calMonth) pushEv(jd.getDate(),'ev-join', `Joined: ${e.firstName}`);
    const dob = new Date(e.dob); if (dob.getMonth()===_calMonth) pushEv(dob.getDate(),'ev-birthday', `🎂 ${e.firstName}`);
  });
  Store.getLeaveApplications().filter(l=>l.status==='Approved').forEach(l => {
    const from = new Date(l.from);
    if (from.getMonth()===_calMonth && from.getFullYear()===_calYear) { const emp = Store.getEmployee(l.empId); pushEv(from.getDate(),'ev-leave', `Leave: ${emp?emp.firstName:l.empId}`); }
  });
  Store.getPayrollRuns().forEach(r => {
    const [y,m] = r.month.split('-').map(Number);
    const genDate = new Date(r.generatedOn);
    if (genDate.getMonth()===_calMonth && genDate.getFullYear()===_calYear) pushEv(genDate.getDate(),'ev-payroll', `💰 Payroll run — ${r.month}`);
  });
  Store.getCandidates().filter(c => c.stage !== 'Rejected').forEach(c => {
    const ad = new Date(c.appliedOn);
    if (ad.getMonth()===_calMonth && ad.getFullYear()===_calYear) pushEv(ad.getDate(),'ev-recruit', `💼 ${c.name} applied`);
  });

  let cells = '';
  for (let i=0;i<firstDow;i++) cells += `<div class="cal-cell empty"></div>`;
  for (let d=1; d<=days; d++) {
    const isToday = today.getDate()===d && today.getMonth()===_calMonth && today.getFullYear()===_calYear;
    const evs = (events[d]||[]).slice(0,3);
    cells += `<div class="cal-cell ${isToday?'today':''}"><div class="d-num">${d}</div>${evs.map(e=>`<span class="ev ${e.cls}">${e.text}</span>`).join('')}</div>`;
  }
  document.getElementById('cal-mount').innerHTML = `
    <div class="cal-grid" style="margin-bottom:6px;">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-dow">${d}</div>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    <div class="att-legend" style="margin-top:16px;">
      <span><span class="sw" style="background:#FBEACB;"></span>Holiday</span>
      <span><span class="sw" style="background:#E5F2F2;"></span>Joining</span>
      <span><span class="sw" style="background:#F6D6C7;"></span>Leave</span>
      <span><span class="sw" style="background:#E3DCF0;"></span>Birthday</span>
      <span><span class="sw" style="background:#D9EDD9;"></span>Payroll</span>
      <span><span class="sw" style="background:#DDE6F5;"></span>Recruitment</span>
    </div>
  `;
}

/* ================= Instructor Mode (Scoring) ================= */
Modules.instructor = function(container) {
  const employees = Store.getEmployees();
  const items = [
    { label: 'Employee records completed', sub: `${employees.length} employees added (target: 10+)`, score: Math.min(100, Math.round(employees.length/10*100)) },
    { label: 'Attendance accuracy', sub: 'Days marked this month across employees', score: attendanceCompletionScore() },
    { label: 'Leave processing', sub: `${Store.getLeaveApplications().filter(l=>l.status!=='Pending').length} of ${Store.getLeaveApplications().length} applications decided`, score: leaveProcessingScore() },
    { label: 'Document generation', sub: `${Store.getDocuments().filter(d=>!['Attendance Export','HR Report','Payroll Export','Employee Database Export'].includes(d.type)).length} letters/certificates generated`, score: Math.min(100, Store.getDocuments().filter(d=>!['Attendance Export','HR Report','Payroll Export','Employee Database Export'].includes(d.type)).length*15) },
    { label: 'Report exports', sub: `${Store.getDocuments().filter(d=>['HR Report','Attendance Export','Payroll Export','Employee Database Export'].includes(d.type)).length} reports/exports generated`, score: Math.min(100, Store.getDocuments().filter(d=>['HR Report','Attendance Export','Payroll Export','Employee Database Export'].includes(d.type)).length*30) },
    { label: 'Payroll setup', sub: `${Object.keys(Store.load().salaryStructures).length} salary structures configured, ${Store.getPayrollRuns().length} payroll run(s)`, score: Math.min(100, Object.keys(Store.load().salaryStructures).length*10 + Store.getPayrollRuns().length*30) },
    { label: 'Recruitment activity', sub: `${Store.getRequisitions().length} requisition(s), ${Store.getCandidates().filter(c=>c.stage==='Hired').length} hired`, score: Math.min(100, Store.getRequisitions().length*20 + Store.getCandidates().filter(c=>c.stage==='Hired').length*40) },
    { label: 'Performance appraisals', sub: `${Store.getCycles().length} cycle(s), ${Store.load().appraisals.filter(a=>a.status==='Finalized').length} finalized`, score: Math.min(100, Store.getCycles().length*20 + Store.load().appraisals.filter(a=>a.status==='Finalized').length*20) },
    { label: 'Asset management', sub: `${Store.getAssets().length} asset(s) tracked, ${Store.getAssets().filter(a=>a.issuedOn).length} issued`, score: Math.min(100, Store.getAssets().length*15 + Store.getAssets().filter(a=>a.issuedOn).length*20) },
    { label: 'Exit Management', sub: `${Store.getResignations().length} resignation(s), ${Store.getFormerEmployees().length} fully archived`, score: Math.min(100, Store.getResignations().length*20 + Store.getFormerEmployees().length*40) },
    { label: 'Practical task completion', sub: `${PRACTICALS.filter(p=>p.check()).length} of ${PRACTICALS.length} practicals complete`, score: Math.round(PRACTICALS.filter(p=>p.check()).length/PRACTICALS.length*100) }
  ];
  const overall = Math.round(items.reduce((s,i)=>s+i.score,0)/items.length);
  const ringColor = overall>=80?'var(--sage)':overall>=50?'var(--amber)':'var(--clay)';

  container.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Instructor Tools</div><h1>Instructor Mode — Practical Assessment</h1><p class="desc">Automatic scoring based on completed work. Use this during practical exams to evaluate student progress objectively.</p></div>
    <div class="page-actions"><button class="btn btn-outline" onclick="printInstructorReport(${overall})">&#128438; Print Assessment Report</button></div></div>

    <div class="card card-pad" style="display:flex;align-items:center;gap:24px;margin-bottom:22px;">
      <div class="score-ring" style="background:conic-gradient(${ringColor} ${overall*3.6}deg, var(--paper-dim) 0);"><div style="background:#fff;width:68px;height:68px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${overall}%</div></div>
      <div>
        <h3 style="font-size:17px;">Overall Completion Score</h3>
        <p class="text-dim" style="font-size:12.5px;margin-top:4px;">Student: <b>${escapeHtml(Store.load().meta.studentName || 'Not set — see Settings')}</b> · Batch: ${escapeHtml(Store.load().meta.batch || '—')}</p>
      </div>
    </div>

    <div class="card card-pad">
      <h3 style="margin-bottom:8px;font-size:15px;">Scoring Breakdown</h3>
      ${items.map(i => `<div class="checklist-row">
        <div><div class="cl-label">${i.label}</div><div class="cl-sub">${i.sub}</div></div>
        <div style="display:flex;align-items:center;gap:10px;width:180px;"><div class="progress-bar" style="flex:1;"><div style="width:${i.score}%;background:${i.score>=70?'var(--sage)':i.score>=40?'var(--amber)':'var(--clay)'};"></div></div><b style="font-size:12.5px;width:36px;text-align:right;">${i.score}%</b></div>
      </div>`).join('')}
    </div>
  `;
};
function attendanceCompletionScore() {
  const employees = Store.getEmployees();
  if (!employees.length) return 0;
  const month = todayISO().slice(0,7);
  const monthData = Store.getMonthAttendance(month);
  const marked = employees.filter(e => monthData[e.id] && Object.keys(monthData[e.id]).length > 5).length;
  return Math.round(marked/employees.length*100);
}
function leaveProcessingScore() {
  const apps = Store.getLeaveApplications();
  if (!apps.length) return 0;
  return Math.round(apps.filter(l=>l.status!=='Pending').length/apps.length*100);
}
function printInstructorReport(overall) {
  const meta = Store.load().meta;
  const html = `<div class="doc-page">
    <div class="doc-letterhead"><div><div class="co-name">${escapeHtml(meta.institution)}</div><div class="co-tag">Office Administration Practical Assessment</div></div><div class="co-addr">Generated ${fmtDate(todayISO())}</div></div>
    <div class="doc-title">PRACTICAL ASSESSMENT REPORT</div>
    <table class="doc-table"><tr><th>Student Name</th><td>${escapeHtml(meta.studentName||'—')}</td><th>Batch</th><td>${escapeHtml(meta.batch||'—')}</td></tr>
    <tr><th>Overall Score</th><td colspan="3"><b>${overall}%</b></td></tr></table>
    <table class="doc-table"><thead><tr><th>Practical</th><th>Status</th></tr></thead>
    <tbody>${PRACTICALS.map(p=>`<tr><td>Practical ${p.n}: ${p.title}</td><td>${p.check()?'✓ Complete':'✗ Incomplete'}</td></tr>`).join('')}</tbody></table>
    <div class="doc-signoff"><div class="sig-block"><div class="sig-line"></div>Student Signature</div><div class="sig-block"><div class="sig-line"></div>Instructor Signature</div></div>
  </div>`;
  printArea(html);
}
