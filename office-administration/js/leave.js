/* =========================================================
   leave.js — Leave Application, Register, Balance Calculator
   ========================================================= */

const LEAVE_TYPES = { CL: 'Casual Leave', SL: 'Sick Leave', EL: 'Earned Leave', ML: 'Maternity Leave', PL: 'Paternity Leave', LOP: 'Loss of Pay' };
let _leaveStatusFilter = '';

Modules.leave = function(container) {
  const employees = Store.getEmployees();
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Module 5 &amp; 7</div><h1>Leave Register</h1><p class="desc">Submit leave applications and process approvals — the full employee leave workflow.</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openLeaveForm()">+ Apply Leave</button></div>
    </div>
    <div class="toolbar">
      <div class="filter-row">
        <select id="lv-status-filter">
          <option value="">All Status</option>
          <option ${_leaveStatusFilter==='Pending'?'selected':''}>Pending</option>
          <option ${_leaveStatusFilter==='Approved'?'selected':''}>Approved</option>
          <option ${_leaveStatusFilter==='Rejected'?'selected':''}>Rejected</option>
        </select>
      </div>
    </div>
    <div id="lv-table-mount"></div>
  `;
  document.getElementById('lv-status-filter').onchange = (e) => { _leaveStatusFilter = e.target.value; renderLeaveTable(); };
  renderLeaveTable();
};

function renderLeaveTable() {
  const mount = document.getElementById('lv-table-mount');
  if (!mount) return;
  let list = Store.getLeaveApplications().slice().sort((a,b) => new Date(b.appliedOn) - new Date(a.appliedOn));
  if (_leaveStatusFilter) list = list.filter(l => l.status === _leaveStatusFilter);

  if (list.length === 0) {
    mount.innerHTML = `<div class="card"><div class="empty-state"><div class="ic">&#9993;</div><h4>No leave applications</h4><p>Submit a leave application to see it appear here.</p><button class="btn btn-primary" onclick="openLeaveForm()">+ Apply Leave</button></div></div>`;
    return;
  }
  mount.innerHTML = `
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Employee</th><th>Leave Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Approved By</th><th>Actions</th></tr></thead>
          <tbody>
            ${list.map(l => {
              const emp = Store.getEmployee(l.empId);
              return `<tr>
                <td>${emp ? `${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}` : l.empId}</td>
                <td>${LEAVE_TYPES[l.leaveType] || l.leaveType}</td>
                <td>${fmtDate(l.from)}</td><td>${fmtDate(l.to)}</td><td class="mono">${l.days}</td>
                <td style="max-width:180px;white-space:normal;">${escapeHtml(l.reason)}</td>
                <td><span class="badge badge-${l.status.toLowerCase()}">${l.status}</span>${l.status==='Rejected' && l.rejectionReason ? `<div class="text-faint" style="font-size:11px;margin-top:3px;max-width:160px;white-space:normal;">${escapeHtml(l.rejectionReason)}</div>` : ''}</td>
                <td>${l.approvedBy || '—'}</td>
                <td><div class="actions-cell">
                  ${l.status === 'Pending' ? `<button class="icon-action" title="Approve" onclick="decideLeave('${l.id}','Approved')" style="color:var(--sage-dark);">&#10003;</button><button class="icon-action danger" title="Reject" onclick="decideLeave('${l.id}','Rejected')">&#10005;</button>` : `<button class="icon-action" title="Print" onclick="printLeaveApplication('${l.id}')">&#128438;</button>`}
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function decideLeave(id, status) {
  if (status === 'Rejected') return openRejectLeaveForm(id);
  const res = Store.updateLeaveStatus(id, status, 'HR Manager');
  if (res && res.error) return toast(res.error, 'error');
  toast(`Leave ${status.toLowerCase()}`, 'success');
  renderLeaveTable();
  refreshTopbarBadges();
}

function openRejectLeaveForm(id) {
  openModal({
    title: 'Reject Leave Application',
    narrow: true,
    body: `
      <div class="field"><label>Reason for rejection <span class="req">*</span></label><textarea id="rj-reason" placeholder="e.g. No leave balance available, understaffed that week, insufficient notice..."></textarea></div>
    `,
    foot: `<button class="btn btn-outline" id="rj-cancel">Cancel</button><button class="btn btn-danger" id="rj-ok">Reject Application</button>`
  });
  document.getElementById('rj-cancel').onclick = closeModal;
  document.getElementById('rj-ok').onclick = () => {
    const reason = document.getElementById('rj-reason').value.trim();
    if (!reason) return toast('Please enter a reason for rejecting this leave', 'error');
    Store.updateLeaveStatus(id, 'Rejected', 'HR Manager', reason);
    closeModal();
    toast('Leave rejected', 'error');
    renderLeaveTable();
    refreshTopbarBadges();
  };
}

function openLeaveForm() {
  const employees = Store.getEmployees();
  if (employees.length === 0) return toast('Add employees before applying leave', 'error');
  openModal({
    title: 'Leave Application Form',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label>Employee <span class="req">*</span></label><select id="lf-emp">${employees.map(e=>`<option value="${e.id}">${e.firstName} ${e.lastName} (${e.department})</option>`).join('')}</select></div>
        <div class="field"><label>Leave Type <span class="req">*</span></label><select id="lf-type">${Object.entries(LEAVE_TYPES).filter(([k])=>k!=='LOP').map(([k,v])=>`<option value="${k}">${v} (${k})</option>`).join('')}</select></div>
        <div class="field"><label>From <span class="req">*</span></label><input type="date" id="lf-from" value="${todayISO()}"></div>
        <div class="field"><label>To <span class="req">*</span></label><input type="date" id="lf-to" value="${todayISO()}"></div>
        <div class="field"><label>Working Days <span class="text-faint" style="font-weight:400;">(excl. Sundays &amp; holidays)</span></label><input id="lf-days" readonly value="1"></div>
        <div class="field span-3"><label>Reason <span class="req">*</span></label><textarea id="lf-reason" placeholder="Brief reason for leave"></textarea></div>
      </div>
      <div id="lf-balance-hint" class="text-dim" style="font-size:12px;margin-top:6px;"></div>
    `,
    foot: `<button class="btn btn-outline" id="lf-cancel">Cancel</button><button class="btn btn-primary" id="lf-submit">Submit Application</button>`
  });
  const updateDays = () => {
    document.getElementById('lf-days').value = leaveWorkingDates(document.getElementById('lf-from').value, document.getElementById('lf-to').value).length;
  };
  const updateBalanceHint = () => {
    const empId = document.getElementById('lf-emp').value;
    const type = document.getElementById('lf-type').value;
    const bal = Store.getLeaveBalance(empId);
    document.getElementById('lf-balance-hint').textContent = `Available balance: ${bal[type] ?? 0} days of ${LEAVE_TYPES[type]}`;
  };
  document.getElementById('lf-from').onchange = updateDays;
  document.getElementById('lf-to').onchange = updateDays;
  document.getElementById('lf-emp').onchange = updateBalanceHint;
  document.getElementById('lf-type').onchange = updateBalanceHint;
  document.getElementById('lf-cancel').onclick = closeModal;
  document.getElementById('lf-submit').onclick = () => {
    const empId = document.getElementById('lf-emp').value;
    const leaveType = document.getElementById('lf-type').value;
    const from = document.getElementById('lf-from').value;
    const to = document.getElementById('lf-to').value;
    const days = leaveWorkingDates(from, to).length;
    const reason = document.getElementById('lf-reason').value.trim();
    if (!reason) return toast('Please enter a reason for leave', 'error');
    if (new Date(to) < new Date(from)) return toast('To date cannot be before From date', 'error');
    if (days < 1) return toast('Selected dates are all Sundays / holidays — nothing to apply for', 'error');
    const avail = Store.getLeaveBalance(empId)[leaveType] ?? 0;
    if (days > avail) return toast(`Only ${avail} day(s) of ${LEAVE_TYPES[leaveType]} available — cannot apply for ${days}`, 'error');
    Store.addLeaveApplication({ empId, leaveType, from, to, days, reason });
    closeModal();
    toast('✓ Leave application submitted', 'success');
    if (document.getElementById('lv-table-mount')) renderLeaveTable();
    refreshTopbarBadges();
  };
  updateDays();
  updateBalanceHint();
}

function printLeaveApplication(id) {
  const l = Store.getLeaveApplications().find(a => a.id === id);
  const emp = Store.getEmployee(l.empId);
  const html = `<div class="doc-page">
    ${letterheadHTML('Leave Application')}
    <div class="doc-ref-row"><span>Ref: ${l.id}</span><span>Applied: ${fmtDate(l.appliedOn)}</span></div>
    <div class="doc-title">LEAVE APPLICATION FORM</div>
    <table class="doc-table">
      <tr><th>Employee Name</th><td>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</td><th>Employee ID</th><td>${emp.id}</td></tr>
      <tr><th>Department</th><td>${escapeHtml(emp.department)}</td><th>Designation</th><td>${escapeHtml(emp.designation)}</td></tr>
      <tr><th>Leave Type</th><td>${LEAVE_TYPES[l.leaveType]}</td><th>Total Days</th><td>${l.days}</td></tr>
      <tr><th>From</th><td>${fmtDate(l.from)}</td><th>To</th><td>${fmtDate(l.to)}</td></tr>
      <tr><th>Reason</th><td colspan="3">${escapeHtml(l.reason)}</td></tr>
      <tr><th>Status</th><td>${l.status}</td><th>Decided On</th><td>${l.decidedOn ? fmtDate(l.decidedOn) : '—'}</td></tr>
      ${l.status === 'Rejected' && l.rejectionReason ? `<tr><th>Reason for Rejection</th><td colspan="3">${escapeHtml(l.rejectionReason)}</td></tr>` : ''}
    </table>
    <div class="doc-signoff">
      <div class="sig-block"><div class="sig-line"></div>Employee Signature</div>
      <div class="sig-block"><div class="sig-line"></div>Manager Approval</div>
      <div class="sig-block"><div class="sig-line"></div>${escapeHtml(l.approvedBy || 'HR Approval')}</div>
    </div>
  </div>`;
  printArea(html);
  Store.logDocument('Leave Application', l.empId, `Leave Application — ${fmtDate(l.from)} to ${fmtDate(l.to)}`);
}

/* ---------------- Leave Balance Calculator (Module 6) ---------------- */
const LEAVE_ENTITLEMENT = { CL: 12, SL: 12, EL: 15 }; // standard yearly entitlement per policy

Modules['leave-balance'] = function(container) {
  const employees = Store.getEmployees();
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Module 6</div><h1>Leave Balance Calculator</h1><p class="desc">Automatically calculated leave balances across all leave types for every employee.</p></div>
      ${employees.length ? `<div class="page-actions">
        <button class="btn btn-outline" onclick="lvExportBalanceExcel()">&#128190; Export Excel</button>
        <button class="btn btn-outline" onclick="lvPrintBalanceSheet()">&#128438; Print / PDF</button>
      </div>` : ''}
    </div>
    ${employees.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#9878;</div><h4>No employees yet</h4><p>Add employees to see their leave balances here.</p></div></div>` : `
    <div class="grid grid-3" style="margin-bottom:22px;">
      ${renderLeaveAggregateCard()}
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Employee</th><th>Casual (CL)</th><th>Sick (SL)</th><th>Earned (EL)</th><th>Maternity (ML)</th><th>Paternity (PL)</th><th>LOP</th><th>Total Remaining</th></tr></thead>
          <tbody>
            ${employees.map(e => {
              const b = Store.getLeaveBalance(e.id);
              const total = b.CL + b.SL + b.EL;
              return `<tr>
                <td><div class="cell-name"><div class="avatar-sm">${initials(e.firstName,e.lastName)}</div>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</div></td>
                <td class="mono">${b.CL}</td><td class="mono">${b.SL}</td><td class="mono">${b.EL}</td><td class="mono">${b.ML}</td><td class="mono">${b.PL}</td><td class="mono">${b.LOP}</td>
                <td><b>${total}</b> days</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`}
  `;
};

function lvExportBalanceExcel() {
  const employees = Store.getEmployees();
  const apps = Store.getLeaveApplications();
  // Formula worksheet: raw applications on one sheet; the summary sheet has Entitlement given and Taken/Balance left EMPTY.
  const raw = [['Employee','Leave Type','Days','Status']];
  apps.forEach(a => {
    const emp = Store.getEmployee(a.empId);
    raw.push([emp ? `${emp.firstName} ${emp.lastName}` : a.empId, a.leaveType, a.days, a.status]);
  });
  const sum = [['Employee','Department','CL Entitlement','CL Taken','CL Balance','SL Entitlement','SL Taken','SL Balance','EL Entitlement','EL Taken','EL Balance','Total Balance']];
  employees.forEach(e => {
    sum.push([`${e.firstName} ${e.lastName}`, e.department, LEAVE_ENTITLEMENT.CL, '', '', LEAVE_ENTITLEMENT.SL, '', '', LEAVE_ENTITLEMENT.EL, '', '', '']);
  });
  const q = wsQuestionsSheet('LEAVE BALANCE WORKSHEET \u2014 QUESTIONS', [
    'Two data sheets: "Leave Applications" (every application) and "Balance Summary" (one row per employee, Entitlement given). Type each answer in the Your Answer column below. Use Excel formulas.',
    'Leave types: CL = Casual, SL = Sick, EL = Earned. Only applications whose Status is Approved reduce a balance.'
  ], WS_QUESTIONS.leave);
  exportWorkbookXLSX('leave-balance-worksheet.xlsx', [
    { name: 'Leave Applications', rows: raw, cols: [24, 12, 8, 12] },
    { name: 'Balance Summary', rows: sum, cols: [24, 20, 15, 10, 11, 15, 10, 11, 15, 10, 11, 14] }, q ]);
  Store.logDocument('Leave Balance Export', 'ALL', 'Leave Balance Sheet (formula worksheet)');
}

function lvPrintBalanceSheet() {
  const employees = Store.getEmployees();
  const html = `<div class="doc-page">
    ${letterheadHTML('Leave Balance Sheet')}
    <div class="doc-title">LEAVE BALANCE — ALL EMPLOYEES</div>
    <table class="doc-table">
      <tr><th>Employee</th><th>CL</th><th>SL</th><th>EL</th><th>ML</th><th>PL</th><th>LOP</th></tr>
      ${employees.map(e => { const b = Store.getLeaveBalance(e.id); return `<tr><td>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</td><td>${b.CL}</td><td>${b.SL}</td><td>${b.EL}</td><td>${b.ML}</td><td>${b.PL}</td><td>${b.LOP}</td></tr>`; }).join('')}
    </table>
  </div>`;
  printArea(html);
  Store.logDocument('Leave Balance Sheet', 'ALL', 'Leave Balance Sheet — printed');
}

function renderLeaveAggregateCard() {
  const employees = Store.getEmployees();
  const totals = { CL:0, SL:0, EL:0 };
  employees.forEach(e => { const b = Store.getLeaveBalance(e.id); totals.CL+=b.CL; totals.SL+=b.SL; totals.EL+=b.EL; });
  return ['CL','SL','EL'].map(k => `
    <div class="card stat-tile accent-teal">
      <div class="stat-label">${LEAVE_TYPES[k]}</div>
      <div class="stat-value">${totals[k]}</div>
      <div class="stat-sub">total days available across ${employees.length} employees</div>
    </div>`).join('');
}
