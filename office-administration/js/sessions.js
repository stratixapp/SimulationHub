/* =========================================================
   sessions.js — Practice Sessions
   Narrative, multi-step scenarios that walk a student through
   a complete real-world HR workflow across several modules at
   once (as opposed to the flat, one-line Practical Tasks list).
   ========================================================= */

const SESSIONS = [
  {
    id: 'onboarding', icon: '&#127881;', title: 'Session 1 — New Hire Onboarding',
    narrative: 'A new employee just accepted your offer. Walk them through everything that happens before their first day — record, letter, ID, manager, and their first company asset.',
    steps: [
      { label: 'Create the employee\'s record', route: 'employees', check: () => Store.getEmployees().length >= 1 },
      { label: 'Assign their Reporting Manager', route: 'orgchart', check: () => Store.getEmployees().some(e => e.managerId) },
      { label: 'Generate their Appointment Letter', route: 'documents', check: () => Store.getDocuments().some(d => d.type === 'Appointment Letter') },
      { label: 'Issue their Employee ID Card', route: 'idcard', check: () => Store.getDocuments().some(d => d.type === 'ID Card') },
      { label: 'Issue them a company asset (e.g. laptop)', route: 'assets', check: () => Store.getAssets().some(a => a.issuedOn) }
    ]
  },
  {
    id: 'payroll-cycle', icon: '&#128176;', title: 'Session 2 — Monthly Attendance &amp; Payroll Cycle',
    narrative: 'It\'s month-end. Close out attendance, handle any corrections, and run payroll like a real HR/finance team would.',
    steps: [
      { label: 'Mark attendance for the month', route: 'attendance', check: () => Object.keys(Store.getMonthAttendance(todayISO().slice(0,7))).length > 0 },
      { label: 'Process an attendance regularization request', route: 'attendance', check: () => Store.getRegularizations().some(r => r.status !== 'Pending') },
      { label: 'Set up salary structures for your employees', route: 'payroll', check: () => Object.keys(Store.load().salaryStructures).length >= 1 },
      { label: 'Run payroll for the month', route: 'payroll', check: () => !!Store.getPayrollRun(todayISO().slice(0,7)) },
      { label: 'Generate at least one payslip', route: 'payroll', check: () => Store.getDocuments().some(d => d.type === 'Payslip') }
    ]
  },
  {
    id: 'leave-cycle', icon: '&#128197;', title: 'Session 3 — Leave Management Cycle',
    narrative: 'An employee needs time off. Handle the request the way HR actually does — application, decision, balance check, and a printed record.',
    steps: [
      { label: 'Submit a leave application', route: 'leave', check: () => Store.getLeaveApplications().length >= 1 },
      { label: 'Approve or reject the application', route: 'leave', check: () => Store.getLeaveApplications().some(l => l.status !== 'Pending') },
      { label: 'Review the Leave Balance Calculator', route: 'leave-balance', check: () => Store.getEmployees().length > 0 },
      { label: 'Print the Leave Application form', route: 'leave', check: () => Store.getDocuments().some(d => d.type === 'Leave Application') }
    ]
  },
  {
    id: 'recruitment-drive', icon: '&#128188;', title: 'Session 4 — Recruitment Drive',
    narrative: 'You need to fill an open position. Run the whole hiring funnel from job posting to a signed new hire.',
    steps: [
      { label: 'Open a job requisition', route: 'recruitment', check: () => Store.getRequisitions().length >= 1 },
      { label: 'Add at least 2 candidates', route: 'recruitment', check: () => Store.getCandidates().length >= 2 },
      { label: 'Move a candidate to the Offer stage', route: 'recruitment', check: () => Store.getCandidates().some(c => ['Offer','Hired'].includes(c.stage)) },
      { label: 'Mark a candidate as Hired', route: 'recruitment', check: () => Store.getCandidates().some(c => c.stage === 'Hired') },
      { label: 'Confirm their employee record was created', route: 'employees', check: () => Store.getEmployees().length >= 1 }
    ]
  },
  {
    id: 'performance-cycle', icon: '&#127942;', title: 'Session 5 — Performance Review Cycle',
    narrative: 'Half-year reviews are due. Run a full appraisal cycle from KPI ratings to a signed-off report.',
    steps: [
      { label: 'Create an appraisal cycle', route: 'performance', check: () => Store.getCycles().length >= 1 },
      { label: 'Rate at least one employee\'s KPIs', route: 'performance', check: () => Store.load().appraisals.length >= 1 },
      { label: 'Finalize at least 2 reviews', route: 'performance', check: () => Store.load().appraisals.filter(a => a.status === 'Finalized').length >= 2 },
      { label: 'Print a finalized appraisal report', route: 'performance', check: () => Store.getDocuments().some(d => d.type === 'Appraisal Report') }
    ]
  },
  {
    id: 'exit-process', icon: '&#128682;', title: 'Session 6 — Employee Exit &amp; Asset Recovery',
    narrative: 'An employee is leaving. Handle a clean, professional exit — assets back, paperwork issued, checklist complete.',
    steps: [
      { label: 'Mark an employee as Inactive', route: 'employees', check: () => Store.getEmployees().some(e => e.status === 'Inactive') },
      { label: 'Return any assets they were holding', route: 'assets', check: () => Store.getAssets().filter(a => a.status === 'Issued').length === 0 || Store.getAssets().some(a => a.returnedOn) },
      { label: 'Issue their Relieving Letter', route: 'documents', check: () => Store.getDocuments().some(d => d.type === 'Relieving Letter') },
      { label: 'Issue their Experience Certificate', route: 'documents', check: () => Store.getDocuments().some(d => d.type === 'Experience Certificate') }
    ]
  },
  {
    id: 'hr-audit', icon: '&#128202;', title: 'Session 7 — Full HR Audit &amp; Reporting',
    narrative: 'Leadership wants a full HR snapshot. Pull every export and confirm your practical score before the exam.',
    steps: [
      { label: 'Export the Employee Database', route: 'employees', check: () => Store.getDocuments().some(d => d.type === 'Employee Database Export') },
      { label: 'Export the Monthly Attendance Sheet', route: 'attendance', check: () => Store.getDocuments().some(d => d.type === 'Attendance Export') },
      { label: 'Export a Payroll run', route: 'payroll', check: () => Store.getDocuments().some(d => d.type === 'Payroll Export') },
      { label: 'Generate the Full HR Report', route: 'reports', check: () => Store.getDocuments().some(d => d.type === 'HR Report') },
      { label: 'Review your score in Instructor Mode', route: 'instructor', check: () => PRACTICALS.filter(p => p.check()).length >= 15 }
    ]
  },
  {
    id: 'exit-management', icon: '&#128682;', title: 'Session 8 — Resignation &amp; Exit Management',
    narrative: 'Run the complete exit pipeline end to end, exactly as HR would handle a real resignation: submit, approve, serve notice, clear every department, settle dues, interview, and archive.',
    steps: [
      { label: 'Employee submits a resignation', route: 'resignations', check: () => Store.getResignations().length >= 1 },
      { label: 'Manager approves the resignation', route: 'resignations', check: () => Store.getResignations().some(r => ['Manager Approved','HR Approved'].includes(r.status)) },
      { label: 'HR approves the resignation', route: 'resignations', check: () => Store.getResignations().some(r => r.status === 'HR Approved') },
      { label: 'Complete the notice period', route: 'notice-period', check: () => Store.getResignations().some(r => ['Completed','Released'].includes(r.noticeStatus)) },
      { label: 'Collect all assets (Exit Checklist)', route: 'resignations', check: () => Store.getResignations().some(r => { const p = Store.checklistProgress(r.id); return p.done === p.total; }) },
      { label: 'Complete department clearance', route: 'clearance', check: () => Store.getResignations().some(r => Store.clearanceProgress(r.id).allApproved) },
      { label: 'Process the final settlement', route: 'final-settlement', check: () => Object.values(Store.load().finalSettlements).some(s => s.status === 'Paid') },
      { label: 'Conduct the exit interview', route: 'exit-interviews', check: () => Object.keys(Store.load().exitInterviews).length >= 1 },
      { label: 'Generate the Relieving Letter', route: 'documents', check: () => Store.getDocuments().some(d => d.type === 'Relieving Letter') },
      { label: 'Archive the employee', route: 'former-employees', check: () => Store.getFormerEmployees().length >= 1 }
    ]
  }
];

Modules.sessions = function(container) {
  const track = Store.load().meta.courseTrack || 'full';
  // On Core track, show each session with only its core-relevant steps (not hide the whole
  // session just because it also has one advanced step) - only drop sessions with zero core steps.
  const visibleSessions = track === 'core'
    ? SESSIONS.map(sess => ({ ...sess, steps: sess.steps.filter(st => !isAdvancedRoute(st.route)) })).filter(sess => sess.steps.length > 0)
    : SESSIONS;
  const totalSteps = visibleSessions.reduce((s, sess) => s + sess.steps.length, 0);
  const doneSteps = visibleSessions.reduce((s, sess) => s + sess.steps.filter(st => st.check()).length, 0);

  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Guided Learning</div><h1>Practice Sessions</h1><p class="desc">Full real-world scenarios that walk you across several modules at once — the way these tasks actually happen in a real HR department. For a flat checklist instead, see Practical Tasks.${track==='core' ? ' Showing Core Office Administration steps only — a few sessions are trimmed down, and Recruitment/Performance sessions are hidden entirely.' : ''}</p></div>
      <div class="page-actions"><button class="btn btn-outline" onclick="navigate('practicals')">View Practical Tasks →</button></div>
    </div>
    <div class="card card-pad" style="margin-bottom:20px;">
      <div class="flex-between" style="margin-bottom:8px;"><b style="font-family:var(--font-display);color:var(--ink);">${doneSteps} / ${totalSteps} steps completed across all sessions</b><span class="text-dim" style="font-size:12.5px;">${Math.round(doneSteps/totalSteps*100)}%</span></div>
      <div class="progress-bar"><div style="width:${Math.round(doneSteps/totalSteps*100)}%"></div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px;">
      ${visibleSessions.map(renderSessionCard).join('')}
    </div>
  `;
};

function renderSessionCard(sess) {
  const doneCount = sess.steps.filter(st => st.check()).length;
  const complete = doneCount === sess.steps.length;
  return `
    <div class="card">
      <div class="card-pad" style="display:flex;gap:16px;align-items:flex-start;">
        <div style="font-size:26px;flex-shrink:0;line-height:1;">${sess.icon}</div>
        <div style="flex:1;">
          <div class="flex-between">
            <h3 style="font-size:15.5px;">${sess.title}</h3>
            <span class="badge ${complete ? 'badge-active' : 'badge-pending'}">${doneCount}/${sess.steps.length}</span>
          </div>
          <p style="font-size:12.5px;color:var(--text-dim);margin:6px 0 14px;">${sess.narrative}</p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${sess.steps.map((st, i) => {
              const done = st.check();
              return `<div style="display:flex;align-items:center;gap:10px;">
                <div style="width:22px;height:22px;border-radius:50%;background:${done?'var(--sage)':'var(--paper-dim)'};color:${done?'#fff':'var(--text-dim)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${done?'✓':i+1}</div>
                <span style="font-size:12.5px;flex:1;color:${done?'var(--text-dim)':'var(--ink)'};${done?'text-decoration:line-through;':''}">${st.label}</span>
                <button class="btn btn-sm btn-outline" onclick="navigate('${st.route}')">${done?'Review':'Go'}</button>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}
