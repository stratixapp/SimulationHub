/* =========================================================
   app.js — router, shared UI utilities, dashboard, init
   (Modules, ROUTES, currentRoute are declared in core.js,
   which must load before this and every other module file)
   ========================================================= */

/* Resets all per-session UI selection state. Must be called on login/logout/instructor
   switch — otherwise a stale employee/cycle/pipeline ID from a previous student's session
   can carry over and cause "No employee selected" or blank screens for the next student. */
function resetUIState() {
  _empPage = 1; _empSearch = ''; _empDeptFilter = ''; _empStatusFilter = ''; _empSort = 'name-asc'; _empSelected.clear();
  _pfEmpId = null; _pfActiveTab = 'Personal Details';
  _attMonth = todayISO().slice(0,7); _attView = 'register';
  _leaveStatusFilter = '';
  _payMonth = todayISO().slice(0,7);
  _reqFilter = null;
  _perfCycleId = null;
  _calMonth = new Date().getMonth(); _calYear = new Date().getFullYear();
  currentRoute = 'dashboard';
}

/* Hides advanced-track sidebar items (and any group label left with nothing under it)
   when the current student is set to the Core Office Administration track. No-op during
   instructor roster mode, and a full no-op (shows everything) when track is 'full'. */
function applyCourseTrackVisibility() {
  if (typeof _instructorRosterMode !== 'undefined' && _instructorRosterMode) return;
  const track = (Store.load().meta.courseTrack) || 'full';
  const navScroll = document.getElementById('nav-scroll');
  if (!navScroll) return;
  const children = [...navScroll.children];
  let lastLabel = null;
  let groupHasVisibleItem = new Map();
  children.forEach(el => {
    if (el.classList.contains('nav-group-label')) {
      lastLabel = el;
      groupHasVisibleItem.set(lastLabel, false);
    } else if (el.classList.contains('nav-item') && el.dataset.route) {
      const routeTrack = (ROUTES[el.dataset.route] || {}).track || 'core';
      const hide = track === 'core' && routeTrack === 'advanced';
      el.style.display = hide ? 'none' : '';
      if (!hide && lastLabel) groupHasVisibleItem.set(lastLabel, true);
    }
  });
  groupHasVisibleItem.forEach((visible, label) => { label.style.display = visible ? '' : 'none'; });
}

function isAdvancedRoute(route) { return (ROUTES[route] || {}).track === 'advanced'; }

function navigate(route) {
  if (!ROUTES[route]) route = 'dashboard';
  // If this student is on the Core Office Administration track, advanced-track pages
  // shouldn't be reachable even via a stale button/quick-link - fall back to dashboard.
  const track = (Store.load().meta.courseTrack) || 'full';
  if (track === 'core' && ROUTES[route].track === 'advanced') route = 'dashboard';
  currentRoute = route;
  applyCourseTrackVisibility();
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.route === route));
  document.getElementById('crumb-current').textContent = ROUTES[route].label;
  const content = document.getElementById('content');
  content.scrollTop = 0;
  window.scrollTo(0,0);
  if (Modules[route]) {
    try {
      Modules[route](content);
    } catch (err) {
      console.error(`Error rendering module "${route}":`, err);
      content.innerHTML = `<div class="card"><div class="empty-state">
        <div class="ic">&#9888;</div>
        <h4>Something went wrong loading this page</h4>
        <p>This is a bug in the simulator, not a problem with your data. Try again, or use the thumbs-down / feedback option to report it.<br><span class="mono" style="font-size:11px;">${escapeHtml(err.message)}</span></p>
        <button class="btn btn-primary" onclick="navigate('dashboard')">Back to Dashboard</button>
      </div></div>`;
    }
  } else {
    content.innerHTML = `<div class="empty-state"><div class="ic">&#128679;</div><h4>Module under construction</h4><p>This module is not yet implemented.</p></div>`;
  }
  document.getElementById('sidebar').classList.remove('open');
  refreshTopbarBadges();
}

/* ---------------- Modal ---------------- */
function openModal({ title, body, foot, wide=false, narrow=false }) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-foot').innerHTML = foot || '';
  box.classList.toggle('modal-wide', !!wide);
  box.classList.toggle('modal-narrow', !!narrow);
  overlay.classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
});

/* ---------------- Toast ---------------- */
function toast(msg, type='') {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = msg;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 2600);
}

/* ---------------- Confirm dialog ---------------- */
function confirmAction(message, onConfirm) {
  openModal({
    title: 'Please confirm',
    body: `<p style="font-size:13.5px;color:var(--text-dim);">${message}</p>`,
    narrow: true,
    foot: `<button class="btn btn-outline" id="cf-cancel">Cancel</button><button class="btn btn-danger" id="cf-ok">Confirm</button>`
  });
  document.getElementById('cf-cancel').onclick = closeModal;
  document.getElementById('cf-ok').onclick = () => { closeModal(); onConfirm(); };
}

/* ---------------- CSV export helper ---------------- */
function exportCSV(filename, rows) {
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell === undefined || cell === null ? '' : cell);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  }).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Exported ' + filename, 'success');
}

/* Sizes a .doc-scale-62 wrapper to match its scaled content exactly, regardless of document length */
function fitDocPreview() {
  requestAnimationFrame(() => {
    const wrap = document.querySelector('.doc-scale-62');
    const page = wrap && wrap.querySelector('.doc-page');
    if (!wrap || !page) return;
    const rect = page.getBoundingClientRect();
    wrap.style.width = (rect.width * 0.62) + 'px';
    wrap.style.height = (rect.height * 0.62) + 'px';
  });
}

function printArea(html) {
  let area = document.getElementById('__print_area');
  if (area) area.remove();
  area = document.createElement('div');
  area.id = '__print_area';
  area.className = 'print-area';
  area.innerHTML = html;
  document.body.appendChild(area);
  window.print();
  setTimeout(() => area.remove(), 500);
}

/* ---------------- Badges (notifications) ---------------- */
function refreshTopbarBadges() {
  const notifs = computeNotifications();
  const badge = document.getElementById('notif-badge');
  const dot = document.getElementById('notif-dot');
  if (notifs.length > 0) {
    badge.textContent = notifs.length;
    badge.classList.remove('hidden');
    dot.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    dot.classList.add('hidden');
  }
}

/* ---------------- Dashboard ---------------- */
Modules.dashboard = function(container) {
  const employees = Store.getEmployees();
  const active = employees.filter(e => e.status === 'Active');
  const track = Store.load().meta.courseTrack || 'full';
  const month = todayISO().slice(0,7);
  const monthAtt = Store.getMonthAttendance(month);
  const today = pad(new Date().getDate());
  let presentToday = 0, absentToday = 0, leaveToday = 0;
  employees.forEach(e => {
    const code = (monthAtt[e.id] || {})[today];
    if (code === 'P' || code === 'WFH' || code === 'OD') presentToday++;
    else if (code === 'A') absentToday++;
    else if (code === 'L' || code === 'HD') leaveToday++;
  });
  const pendingLeaves = Store.getLeaveApplications().filter(l => l.status === 'Pending').length;
  const notices = Store.getNotices().slice(0,3);
  const activity = Store.load().activityLog.slice(0,8);

  container.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">Welcome back</div>
        <h1>HR Administration Dashboard</h1>
        <p class="desc">Simulated office environment for ${escapeHtml(Store.load().meta.institution)}. Everything here is training data stored locally in your browser.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-outline" id="db-sample">&#9889; Generate Sample Data</button>
        <button class="btn btn-primary" onclick="navigate('employees')">+ Add Employee</button>
      </div>
    </div>

    <div class="grid grid-4" style="margin-bottom:22px;">
      <div class="card stat-tile accent-teal"><div class="stat-icon">&#128101;</div><div class="stat-label">Total Employees</div><div class="stat-value">${employees.length}</div><div class="stat-sub">${active.length} active</div></div>
      <div class="card stat-tile accent-sage"><div class="stat-icon">&#9989;</div><div class="stat-label">Present Today</div><div class="stat-value">${presentToday}</div><div class="stat-sub">of ${employees.length} employees</div></div>
      <div class="card stat-tile accent-clay"><div class="stat-icon">&#10060;</div><div class="stat-label">Absent Today</div><div class="stat-value">${absentToday}</div><div class="stat-sub">${leaveToday} on leave</div></div>
      <div class="card stat-tile accent-amber"><div class="stat-icon">&#9993;</div><div class="stat-label">Pending Leave</div><div class="stat-value">${pendingLeaves}</div><div class="stat-sub">awaiting approval</div></div>
    </div>

    ${track === 'full' ? `
    <div class="grid grid-4" style="margin-bottom:22px;">
      <div class="card stat-tile accent-teal" style="cursor:pointer;" onclick="navigate('payroll')"><div class="stat-icon">&#128176;</div><div class="stat-label">Payroll Status</div><div class="stat-value" style="font-size:20px;">${Store.getPayrollRun(month) ? 'Run ✓' : 'Not Run'}</div><div class="stat-sub">${monthLabel(month)}</div></div>
      <div class="card stat-tile accent-sage" style="cursor:pointer;" onclick="navigate('recruitment')"><div class="stat-icon">&#128188;</div><div class="stat-label">Open Positions</div><div class="stat-value">${Store.getRequisitions().filter(r=>r.status==='Open').length}</div><div class="stat-sub">${Store.getCandidates().filter(c=>!['Hired','Rejected'].includes(c.stage)).length} candidate(s) in pipeline</div></div>
      <div class="card stat-tile accent-amber" style="cursor:pointer;" onclick="navigate('performance')"><div class="stat-icon">&#127942;</div><div class="stat-label">Reviews Pending</div><div class="stat-value">${Store.load().appraisals.filter(a=>a.status!=='Finalized').length + Store.getCycles().filter(c=>c.status==='Open').reduce((s,c)=>s+Math.max(0,active.length-Store.getAppraisalsForCycle(c.id).length),0)}</div><div class="stat-sub">across open cycles</div></div>
      <div class="card stat-tile accent-clay" style="cursor:pointer;" onclick="navigate('assets')"><div class="stat-icon">&#128187;</div><div class="stat-label">Assets Issued</div><div class="stat-value">${Store.getAssets().filter(a=>a.status==='Issued').length}</div><div class="stat-sub">of ${Store.getAssets().length} tracked</div></div>
    </div>

    <div class="grid grid-4" style="margin-bottom:22px;">
      <div class="card stat-tile accent-amber" style="cursor:pointer;" onclick="navigate('notice-period')"><div class="stat-icon">&#8987;</div><div class="stat-label">Employees on Notice</div><div class="stat-value">${Store.getResignations().filter(r=>r.noticeStatus==='Running').length}</div><div class="stat-sub">${Store.getResignations().filter(r=>Store.computeNoticeProgress(r).isOverdue).length} overdue</div></div>
      <div class="card stat-tile accent-clay" style="cursor:pointer;" onclick="navigate('clearance')"><div class="stat-icon">&#9989;</div><div class="stat-label">Pending Clearances</div><div class="stat-value">${Store.getResignations().filter(r=>!['Rejected','Cancelled'].includes(r.status) && !Store.clearanceProgress(r.id).allApproved).length}</div><div class="stat-sub">across active exits</div></div>
      <div class="card stat-tile accent-teal" style="cursor:pointer;" onclick="navigate('final-settlement')"><div class="stat-icon">&#128176;</div><div class="stat-label">Pending Settlements</div><div class="stat-value">${Store.getResignations().filter(r=>!['Rejected','Cancelled'].includes(r.status) && Store.getSettlement(r.id).status!=='Paid').length}</div><div class="stat-sub">not yet paid</div></div>
      <div class="card stat-tile accent-sage" style="cursor:pointer;" onclick="navigate('former-employees')"><div class="stat-icon">&#128100;</div><div class="stat-label">Former Employees</div><div class="stat-value">${Store.getFormerEmployees().length}</div><div class="stat-sub">archived records</div></div>
    </div>
    ` : ''}

    ${track === 'full' && Store.getResignations().length > 0 ? renderExitAnalyticsCard() : ''}

    <div class="card card-pad" style="margin-bottom:22px;">
      <h3 style="margin-bottom:14px;">Quick Actions</h3>
      <div class="quick-links">
        <button class="quick-link" onclick="navigate('employees')"><div class="ql-ic">&#128100;</div><span>Add Employee</span></button>
        <button class="quick-link" onclick="navigate('attendance')"><div class="ql-ic">&#128197;</div><span>Mark Attendance</span></button>
        <button class="quick-link" onclick="navigate('leave')"><div class="ql-ic">&#9993;</div><span>Apply Leave</span></button>
        ${track === 'full' ? `
        <button class="quick-link" onclick="navigate('payroll')"><div class="ql-ic">&#128176;</div><span>Run Payroll</span></button>
        <button class="quick-link" onclick="navigate('recruitment')"><div class="ql-ic">&#128188;</div><span>Recruitment</span></button>
        <button class="quick-link" onclick="navigate('resignations')"><div class="ql-ic">&#128196;</div><span>New Resignation</span></button>` : `
        <button class="quick-link" onclick="navigate('documents')"><div class="ql-ic">&#128220;</div><span>Generate Letter</span></button>
        <button class="quick-link" onclick="navigate('idcard')"><div class="ql-ic">&#127380;</div><span>Print ID Card</span></button>`}
        <button class="quick-link" onclick="navigate('sessions')"><div class="ql-ic">&#128218;</div><span>Practice Sessions</span></button>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><h3>Recent Activity</h3><span class="hint">Last ${activity.length} actions</span></div>
        <div class="card-pad" style="padding-top:6px;">
          ${activity.length ? activity.map(a => `<div class="activity-item"><div class="a-dot"></div><div><div>${a.action}</div><div class="a-time">${new Date(a.at).toLocaleString('en-IN', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div></div>`).join('') : `<p class="text-dim" style="font-size:13px;">No activity yet. Start by adding employees or generating sample data.</p>`}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Notice Board</h3><span class="hint" style="cursor:pointer;" onclick="navigate('notices')">View all →</span></div>
        <div class="card-pad" style="padding-top:6px;">
          ${notices.length ? notices.map(n => `<div class="notice-card type-${n.type.replace(' ','-')}" style="margin-bottom:10px;"><div class="n-head"><h4>${escapeHtml(n.title)}</h4><span class="badge badge-info">${escapeHtml(n.type)}</span></div><div class="n-meta">Posted ${fmtDate(n.postedOn)}</div></div>`).join('') : `<p class="text-dim" style="font-size:13px;">No notices posted yet.</p>`}
        </div>
      </div>
    </div>
  `;
  document.getElementById('db-sample').onclick = openSampleDataModal;
};

/* ---------------- Sample Data Modal ---------------- */
function openSampleDataModal() {
  openModal({
    title: 'Generate Sample Data',
    body: `
      <p style="font-size:13px;color:var(--text-dim);margin-bottom:16px;">Auto-generate realistic training data so you can focus on practicals instead of manual entry. This adds to existing data — it does not overwrite it.</p>
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="field">
          <label>Number of employees to generate</label>
          <select id="sd-count"><option value="25">25 employees</option><option value="50" selected>50 employees</option><option value="75">75 employees</option><option value="100">100 employees</option></select>
        </div>
        <div class="field">
          <label>Attendance month to populate</label>
          <input type="month" id="sd-month" value="${todayISO().slice(0,7)}">
        </div>
        <div class="field">
          <label>Sample leave applications</label>
          <select id="sd-leaves"><option value="0">None</option><option value="10">10 applications</option><option value="20" selected>20 applications</option><option value="35">35 applications</option></select>
        </div>
      </div>
    `,
    foot: `<button class="btn btn-outline" id="sd-cancel">Cancel</button><button class="btn btn-primary" id="sd-go">Generate</button>`
  });
  document.getElementById('sd-cancel').onclick = closeModal;
  document.getElementById('sd-go').onclick = () => {
    const count = parseInt(document.getElementById('sd-count').value, 10);
    const month = document.getElementById('sd-month').value.replace('-','-');
    const leaves = parseInt(document.getElementById('sd-leaves').value, 10);
    Store.generateSampleEmployees(count);
    Store.generateSampleAttendance(month);
    if (leaves > 0) Store.generateSampleLeaves(leaves);
    closeModal();
    toast(`✓ Generated ${count} employees, attendance for ${month}${leaves ? `, ${leaves} leave applications` : ''}`, 'success');
    navigate(currentRoute);
  };
}

/* ---------------- Practicals ---------------- */
const PRACTICALS = [
  { n: 1, title: 'Create 10 Employees', desc: 'Add 10 employee records with complete personal, employment and bank details.', route: 'employees', check: () => Store.getEmployees().length >= 10 },
  { n: 2, title: 'Mark Attendance for One Month', desc: 'Mark daily attendance for all employees for a full calendar month.', route: 'attendance', check: () => Object.keys(Store.getMonthAttendance(todayISO().slice(0,7))).length >= Math.min(5, Store.getEmployees().length) && Store.getEmployees().length > 0 },
  { n: 3, title: 'Approve Leave Requests', desc: 'Submit at least 3 leave applications and process (approve/reject) them.', route: 'leave', check: () => Store.getLeaveApplications().filter(l => l.status !== 'Pending').length >= 3 },
  { n: 4, title: 'Generate an Appointment Letter', desc: 'Use the Document Center to generate an Appointment Letter for an employee.', route: 'documents', check: () => Store.getDocuments().some(d => d.type === 'Appointment Letter') },
  { n: 5, title: 'Create Employee ID Cards', desc: 'Generate at least 3 employee ID cards (front and back).', route: 'idcard', check: () => Store.getDocuments().filter(d => d.type === 'ID Card').length >= 3 },
  { n: 6, title: 'Prepare Employee Personal Files', desc: 'Complete personal file tabs (documents/details) for at least 2 employees.', route: 'personal-file', check: () => Store.getEmployees().length >= 2 },
  { n: 7, title: 'Generate Experience Certificates', desc: 'Generate at least 1 Experience Certificate.', route: 'documents', check: () => Store.getDocuments().some(d => d.type === 'Experience Certificate') },
  { n: 8, title: 'Prepare Monthly Attendance Report', desc: 'View and export the Monthly Attendance Sheet as Excel/CSV.', route: 'attendance', check: () => Store.getDocuments().some(d => d.type === 'Attendance Export') },
  { n: 9, title: 'Calculate Leave Balance', desc: 'Visit the Leave Balance Calculator and review balances for all leave types.', route: 'leave-balance', check: () => Store.getEmployees().length > 0 },
  { n: 10, title: 'Export Complete HR Report', desc: 'Generate a full HR report from the Reports module (PDF/Excel).', route: 'reports', check: () => Store.getDocuments().some(d => d.type === 'HR Report') },
  { n: 11, title: 'Build the Org Chart', desc: 'Assign Reporting Managers so at least 3 employees appear under a manager in the Org Chart.', route: 'orgchart', check: () => Store.getEmployees().filter(e => e.managerId).length >= 3 },
  { n: 12, title: 'Set Up Salary Structures', desc: 'Configure the salary breakup (Basic/HRA/Deductions) for at least 3 employees.', route: 'payroll', check: () => Object.keys(Store.load().salaryStructures).length >= 3 },
  { n: 13, title: 'Run Monthly Payroll', desc: 'Run payroll for the current month and generate at least one payslip.', route: 'payroll', check: () => !!Store.getPayrollRun(todayISO().slice(0,7)) && Store.getDocuments().some(d => d.type === 'Payslip') },
  { n: 14, title: 'Run a Recruitment Drive', desc: 'Open a job requisition, add at least 2 candidates, and move one all the way to Hired.', route: 'recruitment', check: () => Store.getCandidates().some(c => c.stage === 'Hired') },
  { n: 15, title: 'Complete a Performance Appraisal', desc: 'Create an appraisal cycle and finalize the review for at least 2 employees.', route: 'performance', check: () => Store.load().appraisals.filter(a => a.status === 'Finalized').length >= 2 },
  { n: 16, title: 'Issue and Return a Company Asset', desc: 'Add an asset, issue it to an employee, then process its return.', route: 'assets', check: () => Store.getAssets().some(a => a.issuedOn) },
  { n: 17, title: 'Submit an Attendance Regularization', desc: 'Submit a regularization request and approve or reject it.', route: 'attendance', check: () => Store.getRegularizations().some(r => r.status !== 'Pending') },
  { n: 18, title: 'Post an Office Notice', desc: 'Create a notice on the Notice Board (e.g. a meeting or holiday announcement).', route: 'notices', check: () => Store.getNotices().length > 0 },
  { n: 19, title: 'Process a Full Employee Exit', desc: 'Mark an employee Inactive, return their assets, and issue their Relieving Letter.', route: 'employees', check: () => Store.getEmployees().some(e => e.status === 'Inactive') && Store.getDocuments().some(d => d.type === 'Relieving Letter') },
  { n: 20, title: 'Review Your Instructor Score', desc: 'Open Instructor Mode and review your own completion score before the practical exam.', route: 'instructor', check: () => PRACTICALS.slice(0,19).filter(p => p.check()).length >= 15 },
  { n: 21, title: 'Submit a Resignation Request', desc: 'Create a resignation request for an employee with a notice period and reason.', route: 'resignations', check: () => Store.getResignations().length >= 1 },
  { n: 22, title: 'Process Manager & HR Approval', desc: 'Move a resignation from Pending through Manager Approved to HR Approved.', route: 'resignations', check: () => Store.getResignations().some(r => r.status === 'HR Approved') },
  { n: 23, title: 'Complete Notice Period & Exit Checklist', desc: 'Mark a notice period Completed (or Early Released) and resolve every exit checklist item.', route: 'notice-period', check: () => Store.getResignations().some(r => ['Completed','Released'].includes(r.noticeStatus) && Store.checklistProgress(r.id).done === Store.checklistProgress(r.id).total) },
  { n: 24, title: 'Clear All Departments', desc: 'Approve every department (HR, Finance, IT, Admin, Security, Manager, Operations) for one exiting employee.', route: 'clearance', check: () => Store.getResignations().some(r => Store.clearanceProgress(r.id).allApproved) },
  { n: 25, title: 'Process a Final Settlement', desc: 'Review, adjust, and mark a full and final settlement as Paid.', route: 'final-settlement', check: () => Object.values(Store.load().finalSettlements).some(s => s.status === 'Paid') },
  { n: 26, title: 'Archive an Employee', desc: 'Complete the full exit pipeline and archive an employee to Former Employees.', route: 'former-employees', check: () => Store.getFormerEmployees().length >= 1 }
];

Modules.practicals = function(container) {
  const track = Store.load().meta.courseTrack || 'full';
  const visiblePracticals = track === 'core' ? PRACTICALS.filter(p => !isAdvancedRoute(p.route)) : PRACTICALS;
  const done = visiblePracticals.filter(p => p.check()).length;
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Training Exercises</div><h1>Student Practical Tasks</h1><p class="desc">Complete these practicals in order to master every module of the office administration workflow.${track==='core' ? ' Showing Core Office Administration tasks only — switch to Full HRMS in Settings to see the rest.' : ''}</p></div>
      <div class="page-actions"><button class="btn btn-outline" onclick="navigate('instructor')">View Instructor Scoring →</button></div>
    </div>
    <div class="card card-pad" style="margin-bottom:20px;">
      <div class="flex-between" style="margin-bottom:8px;"><b style="font-family:var(--font-display);color:var(--ink);">${done} / ${visiblePracticals.length} completed</b><span class="text-dim" style="font-size:12.5px;">${Math.round(done/visiblePracticals.length*100)}%</span></div>
      <div class="progress-bar"><div style="width:${done/visiblePracticals.length*100}%"></div></div>
    </div>
    <div class="grid grid-2">
      ${visiblePracticals.map(p => {
        const complete = p.check();
        return `<div class="card card-pad" style="display:flex;gap:14px;align-items:flex-start;">
          <div style="width:34px;height:34px;border-radius:50%;background:${complete ? 'var(--sage)' : 'var(--paper-dim)'};color:${complete?'#fff':'var(--text-dim)'};display:flex;align-items:center;justify-content:center;font-weight:700;font-family:var(--font-display);flex-shrink:0;">${complete ? '✓' : p.n}</div>
          <div style="flex:1;">
            <h4 style="font-size:13.5px;color:var(--ink);margin-bottom:3px;">Practical ${p.n}: ${p.title}</h4>
            <p style="font-size:12px;color:var(--text-dim);margin:0 0 10px;">${p.desc}</p>
            <button class="btn btn-sm ${complete ? 'btn-outline' : 'btn-teal'}" onclick="navigate('${p.route}')">${complete ? 'Review' : 'Start Task'}</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
};

/* ---------------- Settings ---------------- */
Modules.settings = function(container) {
  const meta = Store.load().meta;
  container.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Configuration</div><h1>Settings</h1><p class="desc">Configure your student identity and institution details. This appears on every generated document.</p></div></div>
    <div class="grid grid-2">
      <div class="card card-pad">
        <div class="form-section">
          <div class="sec-title">Student &amp; Institution Profile</div>
          <div class="form-grid" style="grid-template-columns:1fr;">
            <div class="field"><label>Student Name</label><input id="st-name" value="${escapeHtml(meta.studentName)}" placeholder="e.g. Ananthu Shaji"></div>
            <div class="field"><label>Batch / Roll Number</label><input id="st-batch" value="${escapeHtml(meta.batch)}" placeholder="e.g. OA-2026-B"></div>
            <div class="field"><label>Institution Name</label><input id="st-institution" value="${escapeHtml(meta.institution)}"></div>
            <div class="field">
              <label>Course Track</label>
              <select id="st-track">${Object.entries(COURSE_TRACKS).map(([k,v]) => `<option value="${k}" ${(meta.courseTrack||'full')===k?'selected':''}>${v.label}</option>`).join('')}</select>
              <div class="helptext" style="margin-top:4px;">"Core" hides Payroll, Recruitment, Performance, Org Chart and Exit Management from the sidebar — ideal for a shorter Office Administration course. Switch back to "Full HRMS" anytime without losing any data.</div>
            </div>
          </div>
        </div>
        <div class="form-section">
          <div class="sec-title">Document Letterhead</div>
          <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">These appear on every generated letter, certificate, payslip and report.</p>
          <div class="form-grid" style="grid-template-columns:1fr;">
            <div class="field"><label>Company Address</label><textarea id="st-address" rows="2">${escapeHtml(meta.companyAddress)}</textarea></div>
            <div class="field"><label>Company Phone</label><input id="st-phone" value="${escapeHtml(meta.companyPhone)}"></div>
            <div class="field"><label>Company Email</label><input id="st-email" value="${escapeHtml(meta.companyEmail)}"></div>
            <div class="field">
              <label>Company Logo (optional)</label>
              <div class="photo-upload">
                <div class="preview" style="border-radius:8px;">${meta.companyLogo ? `<img src="${meta.companyLogo}">` : '&#127970;'}</div>
                <label class="btn btn-outline btn-sm" style="cursor:pointer;">Upload Logo<input type="file" id="st-logo" accept="image/*" style="display:none;"></label>
              </div>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" id="st-save">Save Settings</button>
      </div>
      <div class="card card-pad">
        <div class="form-section">
          <div class="sec-title">Data Management</div>
          <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:14px;">All data is stored locally in this browser only (localStorage). Nothing is uploaded anywhere.</p>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="btn btn-outline" id="st-backup">&#128190; Download Full Backup (JSON)</button>
            <label class="btn btn-outline" style="text-align:center;">&#128228; Restore from Backup<input type="file" id="st-restore" accept=".json" style="display:none;"></label>
            <button class="btn btn-danger" id="st-wipe">&#128465; Wipe All Data</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card card-pad" style="margin-top:20px;" id="recycle-bin-card">
      <div class="flex-between" style="margin-bottom:4px;"><div class="sec-title" style="margin-bottom:0;">Recycle Bin</div>${Store.getDeletedEmployees().length ? `<button class="btn btn-sm btn-danger" id="st-purge-all">Empty Recycle Bin</button>` : ''}</div>
      <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:14px;">Deleted employees land here instead of being erased immediately — restore them anytime, or permanently purge them.</p>
      <div id="recycle-bin-mount"></div>
    </div>

    <div class="card card-pad" style="margin-top:20px;">
      <div class="sec-title" style="margin-bottom:10px;">About the Developer &amp; Dot Ecosystem</div>
      <p style="font-size:12.5px;color:var(--text-dim);line-height:1.7;margin:0;">
        This application is built by <b>Ananthu Shaji</b>, an independent software developer and technology entrepreneur, as part of the <b>Dot Ecosystem</b> — a unified platform of interconnected business, educational, and AI-powered software products.
      </p>
      <button class="btn btn-outline btn-sm" id="about-toggle" style="margin-top:12px;">Read More</button>
      <div id="about-full" class="hidden" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--text-dim);line-height:1.8;">

        <div class="sec-title" style="margin-bottom:10px;">About the Developer</div>
        <p>Ananthu Shaji is an independent software developer, technology entrepreneur, logistics educator, and published author dedicated to building modern digital solutions for education, enterprise management, business operations, logistics, productivity, and artificial intelligence.</p>
        <p>Driven by a passion for innovation and practical problem-solving, he develops software that combines professional design, realistic workflows, intelligent automation, and scalable architecture. His mission is to bridge the gap between learning and real-world industry practices by creating applications that are intuitive, reliable, and future-ready.</p>
        <p>Every product is designed with a strong focus on performance, security, usability, and long-term sustainability.</p>

        <div class="sec-title" style="margin:20px 0 10px;">About the Dot Ecosystem</div>
        <p>Dot Ecosystem is a unified technology platform consisting of interconnected software products, enterprise applications, educational simulators, AI-powered tools, and cloud infrastructure.</p>
        <p>Rather than developing isolated applications, the Dot Ecosystem follows a shared architecture where products can work independently while seamlessly integrating with one another. It is built upon: Enterprise-grade Security, Modern User Experience, Scalable Architecture, Cloud-Ready Infrastructure, Artificial Intelligence Integration, Cross-Platform Compatibility, Performance &amp; Reliability, and Real-World Business Workflows.</p>

        <div class="sec-title" style="margin:20px 0 10px;">Dot Ecosystem Products</div>
        <div class="kv-list">
          <div class="kv-row"><span class="k">Stratix One / Lite / Pro</span><span class="v" style="text-align:right;max-width:200px;">Integrated CRM, HR, Finance, Inventory &amp; Workflow platform</span></div>
          <div class="kv-row"><span class="k">BuildBoss</span><span class="v" style="text-align:right;max-width:200px;">Construction &amp; project management</span></div>
          <div class="kv-row"><span class="k">Connect / Connect Flow</span><span class="v" style="text-align:right;max-width:200px;">Collaboration &amp; workflow automation</span></div>
          <div class="kv-row"><span class="k">Paisa+ / Paisa Pro+</span><span class="v" style="text-align:right;max-width:200px;">Personal &amp; professional finance management</span></div>
          <div class="kv-row"><span class="k">Fund Circle</span><span class="v" style="text-align:right;max-width:200px;">Shared funds &amp; group financial management</span></div>
          <div class="kv-row"><span class="k">LAM ERP</span><span class="v" style="text-align:right;max-width:200px;">Logistics, warehousing &amp; supply chain ERP</span></div>
          <div class="kv-row"><span class="k">Filio</span><span class="v" style="text-align:right;max-width:200px;">Secure document &amp; digital asset management</span></div>
          <div class="kv-row"><span class="k">StorySoul / NovelForge AI</span><span class="v" style="text-align:right;max-width:200px;">Creative &amp; AI-assisted writing platforms</span></div>
          <div class="kv-row"><span class="k">Kshetra</span><span class="v" style="text-align:right;max-width:200px;">Structured organizational management</span></div>
          <div class="kv-row"><span class="k">Saathi</span><span class="v" style="text-align:right;max-width:200px;">Productivity &amp; team collaboration</span></div>
        </div>

        <div class="sec-title" style="margin:20px 0 10px;">Dot Infrastructure</div>
        <p>The Dot Infrastructure is the core technology foundation powering every Dot Ecosystem application — shared services, development standards, cloud technologies, security systems, and intelligent infrastructure for consistency and scalability across all products.</p>
        <div class="kv-list">
          <div class="kv-row"><span class="k">Ghost Backend (GB)</span><span class="v" style="text-align:right;max-width:200px;">Auth, API routing &amp; business logic</span></div>
          <div class="kv-row"><span class="k">DotBase</span><span class="v" style="text-align:right;max-width:200px;">Centralized data &amp; storage platform</span></div>
          <div class="kv-row"><span class="k">DotPulse</span><span class="v" style="text-align:right;max-width:200px;">Monitoring &amp; observability</span></div>
          <div class="kv-row"><span class="k">Dotploy</span><span class="v" style="text-align:right;max-width:200px;">Deployment automation</span></div>
          <div class="kv-row"><span class="k">DotMesh</span><span class="v" style="text-align:right;max-width:200px;">Secure inter-service communication</span></div>
          <div class="kv-row"><span class="k">DotX Runway</span><span class="v" style="text-align:right;max-width:200px;">Unified dev &amp; delivery platform</span></div>
          <div class="kv-row"><span class="k">DotX1 Apache</span><span class="v" style="text-align:right;max-width:200px;">Enterprise web hosting environment</span></div>
          <div class="kv-row"><span class="k">DotAIL</span><span class="v" style="text-align:right;max-width:200px;">Asynchronous background processing</span></div>
          <div class="kv-row"><span class="k">DotSQL</span><span class="v" style="text-align:right;max-width:200px;">Structured enterprise data platform</span></div>
          <div class="kv-row"><span class="k">DotIntent OS</span><span class="v" style="text-align:right;max-width:200px;">Workflow &amp; automation orchestration</span></div>
          <div class="kv-row"><span class="k">Dot Neural Net Fabric</span><span class="v" style="text-align:right;max-width:200px;">AI foundation for the ecosystem</span></div>
        </div>

        <div class="sec-title" style="margin:20px 0 10px;">Vision</div>
        <p>To build a world-class ecosystem of software solutions that empowers individuals, educational institutions, businesses, and enterprises through innovation, intelligent technology, and practical digital transformation.</p>

        <div class="sec-title" style="margin:20px 0 10px;">Contact</div>
        <div class="kv-list">
          <div class="kv-row"><span class="k">Developer</span><span class="v">Ananthu Shaji</span></div>
          <div class="kv-row"><span class="k">Platform</span><span class="v">Dot Ecosystem</span></div>
          <div class="kv-row"><span class="k">Version</span><span class="v">1.0</span></div>
          <div class="kv-row"><span class="k">Status</span><span class="v">Under Continuous Development</span></div>
        </div>

        <div class="divider"></div>
        <p style="font-size:11px;color:var(--text-faint);line-height:1.7;">© 2026 Ananthu Shaji. All Rights Reserved. Dot Ecosystem™, its applications, infrastructure components, trademarks, software architecture, user interface designs, documentation, and associated technologies are proprietary intellectual property. Unauthorized copying, modification, redistribution, reverse engineering, commercial resale, or reproduction of any part of this software without prior written permission is strictly prohibited.</p>
        <p style="text-align:center;font-size:11.5px;color:var(--text-faint);font-style:italic;margin-top:10px;">"Building intelligent software for education, business, enterprise, and the future."</p>
      </div>
    </div>
  `;
  document.getElementById('about-toggle').onclick = (e) => {
    const full = document.getElementById('about-full');
    const collapsing = !full.classList.contains('hidden');
    full.classList.toggle('hidden');
    e.target.textContent = collapsing ? 'Read More' : 'Show Less';
  };
  document.getElementById('st-save').onclick = () => {
    const d = Store.load();
    d.meta.studentName = document.getElementById('st-name').value.trim();
    d.meta.batch = document.getElementById('st-batch').value.trim();
    d.meta.institution = document.getElementById('st-institution').value.trim() || 'Skelora Institute';
    d.meta.companyAddress = document.getElementById('st-address').value.trim();
    d.meta.companyPhone = document.getElementById('st-phone').value.trim();
    d.meta.companyEmail = document.getElementById('st-email').value.trim();
    const trackChanged = d.meta.courseTrack !== document.getElementById('st-track').value;
    d.meta.courseTrack = document.getElementById('st-track').value;
    Store.save();
    toast('✓ Settings saved', 'success');
    updateTopbarUser();
    applyCourseTrackVisibility();
    if (trackChanged) toast(d.meta.courseTrack === 'core' ? 'Switched to Core Office Administration track' : 'Switched to Full HRMS track', 'success');
  };
  document.getElementById('st-logo').onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      Store.load().meta.companyLogo = ev.target.result;
      Store.save();
      toast('✓ Logo uploaded', 'success');
      navigate('settings');
    };
    reader.readAsDataURL(file);
  };
  document.getElementById('st-backup').onclick = () => {
    const blob = new Blob([JSON.stringify(Store.load(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `oats-backup-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('Backup downloaded', 'success');
  };
  document.getElementById('st-restore').onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        localStorage.setItem(DB_KEY, JSON.stringify(data));
        Store._data = null; Store.load();
        toast('✓ Backup restored', 'success');
        navigate('dashboard');
      } catch(err) { toast('Invalid backup file', 'error'); }
    };
    reader.readAsText(file);
  };
  document.getElementById('st-wipe').onclick = () => {
    confirmAction('This will permanently delete all employees, attendance, leave and document records. This cannot be undone.', () => {
      Store.wipeAllData();
      toast('All data wiped', 'success');
      navigate('dashboard');
    });
  };

  renderRecycleBin();
  const purgeAllBtn = document.getElementById('st-purge-all');
  if (purgeAllBtn) purgeAllBtn.onclick = () => {
    confirmAction('Permanently purge every employee in the Recycle Bin? This cannot be undone.', () => {
      const count = Store.purgeAllDeletedEmployees();
      toast(`✓ Purged ${count} record(s) permanently`, 'success');
      navigate('settings');
    });
  };
};

function renderRecycleBin() {
  const mount = document.getElementById('recycle-bin-mount');
  if (!mount) return;
  const deleted = Store.getDeletedEmployees();
  if (!deleted.length) {
    mount.innerHTML = `<p class="text-faint" style="font-size:12.5px;">Recycle Bin is empty.</p>`;
    return;
  }
  mount.innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Employee</th><th>Department</th><th>Deleted On</th><th>Actions</th></tr></thead>
    <tbody>${deleted.map(e => `<tr>
      <td><div class="cell-name"><div class="avatar-sm">${initials(e.firstName,e.lastName)}</div>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</div></td>
      <td>${escapeHtml(e.department)}</td>
      <td>${new Date(e.deletedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
      <td><div class="actions-cell">
        <button class="btn btn-sm btn-outline" onclick="restoreDeletedEmployeeUI('${e.id}')">Restore</button>
        <button class="icon-action danger" title="Purge permanently" onclick="purgeDeletedEmployeeUI('${e.id}')">&#128465;</button>
      </div></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
function restoreDeletedEmployeeUI(id) {
  Store.restoreDeletedEmployee(id);
  toast('✓ Employee restored', 'success');
  navigate('settings');
}
function purgeDeletedEmployeeUI(id) {
  const emp = Store.getEmployeeIncludingDeleted(id);
  confirmAction(`Permanently purge <b>${escapeHtml(emp.firstName+' '+emp.lastName)}</b>? This cannot be undone.`, () => {
    Store.purgeDeletedEmployee(id);
    toast('Permanently purged', 'success');
    navigate('settings');
  });
}

/* ---------------- Init ---------------- */
function updateTopbarUser() {
  const meta = Store.load().meta;
  const name = meta.studentName || 'Student';
  document.getElementById('topbar-name').textContent = name;
  const initials = name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase() || 'ST';
  document.getElementById('topbar-initials').textContent = initials;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item[data-route]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.route));
  });
  document.getElementById('menu-toggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('btn-sample').addEventListener('click', openSampleDataModal);
  document.getElementById('btn-notif').addEventListener('click', () => navigate('notifications'));
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('instructor-exit-btn').addEventListener('click', exitInstructorView);
  bootstrapAuth();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
});
