/* =========================================================
   exit.js — Employee Resignation & Exit Management
   Additive module: reuses Store, Modules registry, modal/toast
   helpers, letterheadHTML/printArea and the existing Document
   Center (documents.js) exactly as the rest of the app does.
   ========================================================= */

// Shared across the Notice Period / Clearance / Settlement / Exit Interview
// pages so jumping there from a specific resignation carries context.
let _selectedResignationId = null;
let _formerEmpSearch = '';

const EXIT_TIMELINE_STAGES = [
  { key: 'submitted', label: 'Resignation Submitted' },
  { key: 'manager', label: 'Manager Approval' },
  { key: 'hr', label: 'HR Approval' },
  { key: 'notice', label: 'Notice Started' },
  { key: 'kt', label: 'Knowledge Transfer' },
  { key: 'assets', label: 'Asset Return' },
  { key: 'clearance', label: 'Department Clearance' },
  { key: 'settlement', label: 'Settlement' },
  { key: 'interview', label: 'Exit Interview' },
  { key: 'documents', label: 'Documents Issued' },
  { key: 'archived', label: 'Archived' }
];

/* Computes how far a resignation has progressed through the full exit pipeline (Feature 16) */
function computeExitTimelineStatus(res) {
  const emp = Store.getEmployee(res.empId);
  const checklist = Store.checklistProgress(res.id);
  const clearance = Store.clearanceProgress(res.id);
  const settlement = Store.getSettlement(res.id);
  const interview = Store.getExitInterview(res.id);
  const docs = Store.getDocuments().filter(d => d.empId === res.empId);
  const ktDone = Store.getExitChecklist(res.id).filter(i => i.category === 'General').every(i => i.status !== 'Pending');

  return {
    submitted: true,
    manager: res.status === 'Manager Approved' || res.status === 'HR Approved',
    hr: res.status === 'HR Approved',
    notice: res.status === 'HR Approved',
    kt: ktDone,
    assets: checklist.done === checklist.total,
    clearance: clearance.allApproved,
    settlement: settlement.status === 'Paid',
    interview: !!interview,
    documents: docs.some(d => d.type === 'Relieving Letter') && docs.some(d => d.type === 'Experience Certificate'),
    archived: emp ? emp.status === 'Former Employee' : false
  };
}

function renderExitTimeline(res) {
  const status = computeExitTimelineStatus(res);
  const keys = EXIT_TIMELINE_STAGES.map(s => s.key);
  const firstPendingIdx = keys.findIndex(k => !status[k]);
  return `<div class="exit-timeline">
    ${EXIT_TIMELINE_STAGES.map((stage, i) => {
      const done = status[stage.key];
      const isCurrent = !done && i === firstPendingIdx;
      const cls = done ? 'done' : (isCurrent ? 'current' : 'pending');
      return `<div class="exit-step">
        <div class="es-line">
          <div class="es-dot ${cls}">${done ? '✓' : i+1}</div>
          ${i < EXIT_TIMELINE_STAGES.length-1 ? `<div class="es-connector ${done?'done':''}"></div>` : ''}
        </div>
        <div class="es-body">
          <div class="es-title">${stage.label}</div>
          <div class="es-sub">${done ? 'Complete' : (isCurrent ? 'In progress' : 'Not started')}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ================= Resignations (Feature 1) ================= */
Modules.resignations = function(container) {
  const list = Store.getResignations().slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Exit Management</div><h1>Resignations</h1><p class="desc">Create and track resignation requests through manager and HR approval.</p></div>
      <div class="page-actions">
        <button class="btn btn-outline" onclick="exportResignationsCSV()">&#128190; Export Report</button>
        <button class="btn btn-primary" onclick="openResignationForm()">+ New Resignation</button>
      </div>
    </div>
    ${list.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128196;</div><h4>No resignations yet</h4><p>Create a resignation request to begin the exit process for an employee.</p><button class="btn btn-primary" onclick="openResignationForm()">+ New Resignation</button></div></div>` : `
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Employee</th><th>Department</th><th>Resignation Date</th><th>Last Working Day</th><th>Notice</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${list.map(r => {
              const emp = Store.getEmployee(r.empId);
              return `<tr>
                <td><div class="cell-name"><div class="avatar-sm">${emp ? initials(emp.firstName,emp.lastName) : '?'}</div>${emp ? escapeHtml(emp.firstName)+' '+escapeHtml(emp.lastName) : r.empId}</div></td>
                <td>${emp ? escapeHtml(emp.department) : '—'}</td>
                <td>${fmtDate(r.resignationDate)}</td>
                <td>${fmtDate(r.lastWorkingDay)}</td>
                <td><span class="badge badge-${statusSlug(r.noticeStatus)}">${r.noticeStatus}</span></td>
                <td><span class="badge badge-${statusSlug(r.status)}">${r.status}</span></td>
                <td><div class="actions-cell">
                  <button class="icon-action" title="View" onclick="openResignationDetail('${r.id}')">&#128065;</button>
                  ${r.status === 'Pending' ? `<button class="icon-action" title="Manager Approve" style="color:var(--sage-dark);" onclick="decideResignation('${r.id}','Manager Approved')">&#10003;</button>` : ''}
                  ${r.status === 'Manager Approved' ? `<button class="icon-action" title="HR Approve" style="color:var(--sage-dark);" onclick="decideResignation('${r.id}','HR Approved')">&#10003;&#10003;</button>` : ''}
                  ${['Pending','Manager Approved'].includes(r.status) ? `<button class="icon-action danger" title="Reject" onclick="decideResignation('${r.id}','Rejected')">&#10005;</button>` : ''}
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`}
  `;
};

function openResignationForm() {
  const employees = Store.getEmployees().filter(e => !['Former Employee'].includes(e.status));
  if (!employees.length) return toast('Add employees first', 'error');
  openModal({
    title: 'New Resignation Request',
    wide: true,
    body: `
      <div class="form-grid">
        <div class="field span-3"><label>Employee <span class="req">*</span></label><select id="rs-emp">${employees.map(e=>`<option value="${e.id}">${e.firstName} ${e.lastName} — ${e.department} (${e.designation})</option>`).join('')}</select></div>
        <div class="field"><label>Resignation Date <span class="req">*</span></label><input type="date" id="rs-date" value="${todayISO()}"></div>
        <div class="field"><label>Notice Period (days)</label><input type="number" id="rs-notice-days" value="30" min="0"></div>
        <div class="field"><label>Last Working Day</label><input type="date" id="rs-lwd" readonly></div>
        <div class="field span-2"><label>Reason <span class="req">*</span></label><select id="rs-reason">${RESIGNATION_REASONS.map(r=>`<option>${r}</option>`).join('')}</select></div>
        <div class="field"><label>Resignation Letter</label><label class="btn btn-outline btn-sm" style="cursor:pointer;display:block;text-align:center;">Upload<input type="file" id="rs-letter" style="display:none;"></label></div>
        <div class="field span-3"><label>Additional Notes</label><textarea id="rs-notes" placeholder="Any additional context for HR"></textarea></div>
      </div>
      <p id="rs-letter-name" class="text-faint" style="font-size:11.5px;margin-top:6px;"></p>
    `,
    foot: `<button class="btn btn-outline" id="rs-cancel">Cancel</button><button class="btn btn-primary" id="rs-save">Submit Resignation</button>`
  });
  const updateLWD = () => {
    const d1 = new Date(document.getElementById('rs-date').value);
    const days = parseInt(document.getElementById('rs-notice-days').value, 10) || 0;
    const lwd = new Date(d1); lwd.setDate(lwd.getDate() + days);
    document.getElementById('rs-lwd').value = lwd.toISOString().slice(0,10);
  };
  document.getElementById('rs-date').onchange = updateLWD;
  document.getElementById('rs-notice-days').oninput = updateLWD;
  updateLWD();
  let letterFileName = '';
  document.getElementById('rs-letter').onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    letterFileName = file.name;
    document.getElementById('rs-letter-name').textContent = `Attached: ${file.name}`;
  };
  document.getElementById('rs-cancel').onclick = closeModal;
  document.getElementById('rs-save').onclick = () => {
    const empId = document.getElementById('rs-emp').value;
    if (Store.getActiveResignationForEmployee(empId)) return toast('This employee already has an active resignation in progress', 'error');
    Store.addResignation({
      empId,
      resignationDate: document.getElementById('rs-date').value,
      lastWorkingDay: document.getElementById('rs-lwd').value,
      noticePeriodDays: parseInt(document.getElementById('rs-notice-days').value, 10) || 0,
      reason: document.getElementById('rs-reason').value,
      notes: document.getElementById('rs-notes').value.trim(),
      letterFileName
    });
    closeModal();
    toast('✓ Resignation request submitted', 'success');
    navigate('resignations');
  };
}

function decideResignation(id, status) {
  Store.updateResignationStatus(id, status);
  toast(`Resignation ${status}`, status === 'Rejected' ? 'error' : 'success');
  navigate('resignations');
}

/* ---------------- Resignation Detail: Timeline + Exit Checklist ---------------- */
let _resDetailTab = 'timeline';
function openResignationDetail(id) {
  _resDetailTab = 'timeline';
  const res = Store.getResignation(id);
  const emp = Store.getEmployee(res.empId);
  openModal({
    title: `Exit Process — ${emp ? emp.firstName+' '+emp.lastName : res.empId}`,
    wide: true,
    body: `
      <div class="tabs" style="margin-bottom:16px;">
        <button class="tab-btn active" data-t="timeline">Timeline</button>
        <button class="tab-btn" data-t="checklist">Exit Checklist</button>
      </div>
      <div id="rd-tab-content"></div>
      <div class="divider"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-outline" onclick="closeModal();_selectedResignationId='${id}';navigate('notice-period');">Notice Period →</button>
        <button class="btn btn-sm btn-outline" onclick="closeModal();_selectedResignationId='${id}';navigate('clearance');">Clearance →</button>
        <button class="btn btn-sm btn-outline" onclick="closeModal();_selectedResignationId='${id}';navigate('final-settlement');">Settlement →</button>
        <button class="btn btn-sm btn-outline" onclick="closeModal();_selectedResignationId='${id}';navigate('exit-interviews');">Exit Interview →</button>
        <button class="btn btn-sm btn-teal" onclick="closeModal();archiveEmployeeUI('${id}');">Archive Employee</button>
      </div>
    `,
    foot: `<button class="btn btn-outline" id="rd-close">Close</button>`
  });
  document.getElementById('rd-close').onclick = closeModal;
  document.querySelectorAll('.tab-btn[data-t]').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tab-btn[data-t]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    _resDetailTab = b.dataset.t;
    renderResignationDetailTab(id);
  });
  renderResignationDetailTab(id);
}
function renderResignationDetailTab(id) {
  const res = Store.getResignation(id);
  const mount = document.getElementById('rd-tab-content');
  if (_resDetailTab === 'timeline') {
    mount.innerHTML = renderExitTimeline(res);
    return;
  }
  const list = Store.getExitChecklist(id);
  const progress = Store.checklistProgress(id);
  const categories = ['General', 'Asset Return', 'Documents'];
  mount.innerHTML = `
    <div class="flex-between" style="margin-bottom:12px;"><b style="font-family:var(--font-display);color:var(--ink);">${progress.done}/${progress.total} items resolved</b><span class="text-dim" style="font-size:12.5px;">${progress.pct}%</span></div>
    <div class="progress-bar" style="margin-bottom:16px;"><div style="width:${progress.pct}%"></div></div>
    <div class="checklist-grid">
      ${categories.map(cat => `
        <div class="cg-cat">${cat}</div>
        ${list.filter(i => i.category === cat).map(i => `
          <div style="font-size:12.5px;">${i.label}</div>
          <select style="padding:5px 8px;border:1px solid var(--line-strong);border-radius:5px;font-size:12px;" onchange="updateChecklistItemUI('${id}','${i.key}',this.value)">
            ${EXIT_ITEM_STATUSES.map(s => `<option ${s===i.status?'selected':''}>${s}</option>`).join('')}
          </select>
          <input placeholder="Remarks" value="${escapeHtml(i.remarks)}" style="padding:5px 8px;border:1px solid var(--line-strong);border-radius:5px;font-size:12px;width:140px;" onchange="updateChecklistRemarksUI('${id}','${i.key}',this.value)">
        `).join('')}
      `).join('')}
    </div>
  `;
}
function updateChecklistItemUI(resId, key, status) { Store.updateChecklistItem(resId, key, { status }); renderResignationDetailTab(resId); }
function updateChecklistRemarksUI(resId, key, remarks) { Store.updateChecklistItem(resId, key, { remarks }); }

/* ================= Notice Period Tracker (Feature 2) ================= */
Modules['notice-period'] = function(container) {
  const list = Store.getResignations().filter(r => !['Rejected','Cancelled'].includes(r.status));
  container.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Exit Management</div><h1>Notice Period Tracker</h1><p class="desc">Track every departing employee's notice period, with the ability to extend, reduce, or approve early release.</p></div></div>
    ${list.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#8987;</div><h4>No one is currently serving notice</h4><p>Notice periods appear here once a resignation is submitted.</p></div></div>` : `
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${list.map(r => {
        const emp = Store.getEmployee(r.empId);
        const p = Store.computeNoticeProgress(r);
        return `<div class="card card-pad">
          <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
            <div class="notice-ring" style="background:conic-gradient(${p.pct>=100?'var(--sage)':'var(--amber)'} ${p.pct*3.6}deg, var(--paper-dim) 0);"><div style="background:#fff;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${p.pct}%</div></div>
            <div style="flex:1;min-width:220px;">
              <div class="flex-between"><b style="color:var(--ink);">${emp ? escapeHtml(emp.firstName)+' '+escapeHtml(emp.lastName) : r.empId}</b><span class="badge badge-${statusSlug(r.noticeStatus)}">${r.noticeStatus}</span></div>
              <div class="text-faint" style="font-size:11.5px;margin:4px 0 8px;">Notice: ${fmtDate(r.resignationDate)} → ${fmtDate(r.lastWorkingDay)} · ${p.daysCompleted}/${p.totalDays} days completed · ${p.daysRemaining} remaining${p.isOverdue?' · <span style="color:var(--clay-dark);">Overdue</span>':''}</div>
              <div class="progress-bar"><div style="width:${p.pct}%"></div></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${r.noticeStatus === 'Running' ? `
                <button class="btn btn-sm btn-outline" onclick="openExtendReduceForm('${r.id}','extend')">Extend Notice</button>
                <button class="btn btn-sm btn-outline" onclick="openExtendReduceForm('${r.id}','reduce')">Reduce Notice</button>
                <button class="btn btn-sm btn-teal" onclick="openEarlyReleaseForm('${r.id}')">Early Release</button>
                ${p.pct>=100 ? `<button class="btn btn-sm btn-primary" onclick="markNoticeCompletedUI('${r.id}')">Mark Completed</button>` : ''}
              ` : `<span class="text-faint" style="font-size:11.5px;">No further action needed</span>`}
            </div>
          </div>
          ${r.managerRemarks || r.hrRemarks ? `<div class="divider"></div><div style="font-size:12px;">${r.managerRemarks?`<div><b>Manager:</b> ${escapeHtml(r.managerRemarks)}</div>`:''}${r.hrRemarks?`<div><b>HR:</b> ${escapeHtml(r.hrRemarks)}</div>`:''}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`}
  `;
};
function openExtendReduceForm(resId, mode) {
  const res = Store.getResignation(resId);
  openModal({
    title: mode === 'extend' ? 'Extend Notice Period' : 'Reduce Notice Period',
    narrow: true,
    body: `
      <div class="field" style="margin-bottom:12px;"><label>New Last Working Day</label><input type="date" id="nr-date" value="${res.lastWorkingDay}"></div>
      <div class="field"><label>${mode === 'extend' ? 'HR' : 'Manager'} Remarks</label><textarea id="nr-remarks" placeholder="Reason for this change"></textarea></div>
    `,
    foot: `<button class="btn btn-outline" id="nr-cancel">Cancel</button><button class="btn btn-primary" id="nr-save">Save</button>`
  });
  document.getElementById('nr-cancel').onclick = closeModal;
  document.getElementById('nr-save').onclick = () => {
    const newDate = document.getElementById('nr-date').value;
    const remarks = document.getElementById('nr-remarks').value.trim();
    if (mode === 'extend') Store.extendNotice(resId, newDate, remarks); else Store.reduceNotice(resId, newDate, remarks);
    closeModal(); toast('✓ Notice period updated', 'success'); navigate('notice-period');
  };
}
function openEarlyReleaseForm(resId) {
  openModal({
    title: 'Approve Early Release',
    narrow: true,
    body: `<p style="font-size:12.5px;color:var(--text-dim);margin-bottom:12px;">This immediately ends the notice period as of today and marks it Released.</p><div class="field"><label>HR Remarks</label><textarea id="er-remarks" placeholder="Reason for early release"></textarea></div>`,
    foot: `<button class="btn btn-outline" id="er-cancel">Cancel</button><button class="btn btn-primary" id="er-save">Approve Release</button>`
  });
  document.getElementById('er-cancel').onclick = closeModal;
  document.getElementById('er-save').onclick = () => {
    Store.releaseEarly(resId, document.getElementById('er-remarks').value.trim());
    closeModal(); toast('✓ Early release approved', 'success'); navigate('notice-period');
  };
}
function markNoticeCompletedUI(resId) { Store.markNoticeCompleted(resId); toast('✓ Notice period marked complete', 'success'); navigate('notice-period'); }

/* ================= Department Clearance (Feature 4) ================= */
Modules.clearance = function(container) {
  const resignations = Store.getResignations().filter(r => !['Rejected','Cancelled'].includes(r.status));
  if (!_selectedResignationId || !resignations.some(r => r.id === _selectedResignationId)) {
    _selectedResignationId = resignations[0]?.id || null;
  }
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Exit Management</div><h1>Department Clearance</h1><p class="desc">Each department signs off before an employee can be settled and archived.</p></div>
      <div class="page-actions">${resignations.length ? `<select id="cl-res-select" style="padding:9px 12px;border:1px solid var(--line-strong);border-radius:6px;">${resignations.map(r=>{const e=Store.getEmployee(r.empId);return `<option value="${r.id}" ${r.id===_selectedResignationId?'selected':''}>${e?e.firstName+' '+e.lastName:r.empId}</option>`;}).join('')}</select>` : ''}</div>
    </div>
    <div id="clearance-mount"></div>
  `;
  if (resignations.length) {
    document.getElementById('cl-res-select').onchange = (e) => { _selectedResignationId = e.target.value; renderClearanceBody(); };
    renderClearanceBody();
  } else {
    document.getElementById('clearance-mount').innerHTML = `<div class="card"><div class="empty-state"><div class="ic">&#9989;</div><h4>No active resignations</h4><p>Clearance tracking appears once a resignation is submitted.</p></div></div>`;
  }
};
function renderClearanceBody() {
  const mount = document.getElementById('clearance-mount');
  if (!mount || !_selectedResignationId) return;
  const clearance = Store.getClearance(_selectedResignationId);
  const progress = Store.clearanceProgress(_selectedResignationId);
  mount.innerHTML = `
    <div class="card card-pad" style="margin-bottom:18px;">
      <div class="flex-between" style="margin-bottom:8px;"><b style="font-family:var(--font-display);color:var(--ink);">${progress.approved}/${progress.total} departments approved</b><span class="text-dim" style="font-size:12.5px;">${progress.pct}%</span></div>
      <div class="progress-bar" style="margin-bottom:12px;"><div style="width:${progress.pct}%"></div></div>
      <button class="btn btn-sm btn-outline" onclick="printClearanceReport('${_selectedResignationId}')">&#128438; Print Clearance Report</button>
    </div>
    <div class="clearance-grid">
      ${CLEARANCE_DEPARTMENTS.map(dept => {
        const c = clearance[dept];
        return `<div class="clearance-card">
          <div class="cc-head"><b style="font-size:13px;color:var(--ink);">${dept}</b><span class="badge badge-${statusSlug(c.status)}">${c.status}</span></div>
          <select onchange="updateClearanceUI('${dept}','status',this.value)">
            <option ${c.status==='Pending'?'selected':''}>Pending</option>
            <option ${c.status==='Approved'?'selected':''}>Approved</option>
            <option ${c.status==='Rejected'?'selected':''}>Rejected</option>
          </select>
          <input placeholder="Responsible person" value="${escapeHtml(c.responsible)}" onchange="updateClearanceUI('${dept}','responsible',this.value)">
          <input placeholder="Comments" value="${escapeHtml(c.comments)}" onchange="updateClearanceUI('${dept}','comments',this.value)">
          ${c.completionDate ? `<div class="text-faint" style="font-size:11px;margin-top:6px;">Completed ${fmtDate(c.completionDate)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  `;
}
function updateClearanceUI(dept, field, value) {
  Store.updateClearance(_selectedResignationId, dept, { [field]: value });
  renderClearanceBody();
}

/* ================= Final Settlement (Feature 5) ================= */
Modules['final-settlement'] = function(container) {
  const resignations = Store.getResignations().filter(r => !['Rejected','Cancelled'].includes(r.status));
  if (!_selectedResignationId || !resignations.some(r => r.id === _selectedResignationId)) {
    _selectedResignationId = resignations[0]?.id || null;
  }
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Exit Management</div><h1>Final Settlement</h1><p class="desc">Auto-calculated from salary structure and leave balance — review, adjust, and process payment.</p></div>
      <div class="page-actions">${resignations.length ? `<select id="fs-res-select" style="padding:9px 12px;border:1px solid var(--line-strong);border-radius:6px;">${resignations.map(r=>{const e=Store.getEmployee(r.empId);return `<option value="${r.id}" ${r.id===_selectedResignationId?'selected':''}>${e?e.firstName+' '+e.lastName:r.empId}</option>`;}).join('')}</select>` : ''}</div>
    </div>
    <div id="settlement-mount"></div>
  `;
  if (resignations.length) {
    document.getElementById('fs-res-select').onchange = (e) => { _selectedResignationId = e.target.value; renderSettlementBody(); };
    renderSettlementBody();
  } else {
    document.getElementById('settlement-mount').innerHTML = `<div class="card"><div class="empty-state"><div class="ic">&#128176;</div><h4>No active resignations</h4><p>Settlements appear once a resignation is submitted.</p></div></div>`;
  }
};
const SETTLEMENT_EARNING_FIELDS = [['pendingSalary','Pending Salary'],['leaveEncashment','Leave Encashment'],['bonus','Bonus'],['incentives','Incentives'],['commission','Commission'],['overtime','Overtime']];
const SETTLEMENT_DEDUCTION_FIELDS = [['recoveries','Recoveries'],['assetDamage','Asset Damage'],['advanceSalary','Advance Salary'],['loans','Loans'],['tax','Tax'],['otherDeductions','Other Deductions']];
function renderSettlementBody() {
  const mount = document.getElementById('settlement-mount');
  if (!mount || !_selectedResignationId) return;
  const s = Store.getSettlement(_selectedResignationId);
  const totals = Store.settlementTotals(_selectedResignationId);
  const clearance = Store.clearanceProgress(_selectedResignationId);
  mount.innerHTML = `
    <div class="grid grid-2">
      <div class="card card-pad">
        <div class="sec-title">Earnings</div>
        <div class="form-grid" style="grid-template-columns:1fr;">
          ${SETTLEMENT_EARNING_FIELDS.map(([k,label]) => `<div class="field"><label>${label}</label><input type="number" id="fs-${k}" value="${s[k]}" onchange="updateSettlementFieldUI('${k}',this.value)"></div>`).join('')}
        </div>
      </div>
      <div class="card card-pad">
        <div class="sec-title">Deductions</div>
        <div class="form-grid" style="grid-template-columns:1fr;">
          ${SETTLEMENT_DEDUCTION_FIELDS.map(([k,label]) => `<div class="field"><label>${label}</label><input type="number" id="fs-${k}" value="${s[k]}" onchange="updateSettlementFieldUI('${k}',this.value)"></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="card card-pad" style="margin-top:18px;">
      <div class="kv-list">
        <div class="kv-row"><span class="k">Gross Amount</span><span class="v">₹${totals.gross.toLocaleString('en-IN')}</span></div>
        <div class="kv-row"><span class="k">Total Deductions</span><span class="v">₹${totals.deductions.toLocaleString('en-IN')}</span></div>
        <div class="kv-row"><span class="k">Net Settlement</span><span class="v" style="font-size:16px;">₹${totals.net.toLocaleString('en-IN')}</span></div>
        <div class="kv-row"><span class="k">Status</span><span class="v"><span class="badge badge-${statusSlug(s.status)}">${s.status}</span></span></div>
        ${s.paidDate ? `<div class="kv-row"><span class="k">Paid On</span><span class="v">${fmtDate(s.paidDate)} via ${escapeHtml(s.paymentMethod)}</span></div>` : ''}
      </div>
      ${s.status === 'Paid' ? `<div style="padding:16px;padding-top:0;"><button class="btn btn-sm btn-outline" onclick="printSettlementStatement('${_selectedResignationId}')">&#128438; Print Settlement Statement</button></div>` : ''}
      ${s.status !== 'Paid' ? `
        ${!clearance.allApproved ? `<p style="font-size:12px;color:var(--clay-dark);margin-top:12px;">⚠ All department clearances must be approved before this can be marked as paid (${clearance.approved}/${clearance.total} approved).</p>` : ''}
        <div class="form-actions" style="border:none;padding-top:14px;">
          <select id="fs-payment-method" style="padding:9px 11px;border:1px solid var(--line-strong);border-radius:6px;">
            <option>Bank Transfer</option><option>Cheque</option><option>Cash</option>
          </select>
          <button class="btn btn-primary" ${!clearance.allApproved?'disabled':''} onclick="markSettlementPaidUI()">Mark as Paid</button>
        </div>` : ''}
    </div>
  `;
}
function updateSettlementFieldUI(key, value) {
  Store.saveSettlement(_selectedResignationId, { [key]: Number(value) || 0 });
  renderSettlementBody();
}
function markSettlementPaidUI() {
  const method = document.getElementById('fs-payment-method').value;
  const result = Store.markSettlementPaid(_selectedResignationId, method);
  if (!result.ok) return toast(result.error, 'error');
  toast('✓ Settlement marked as paid', 'success');
  renderSettlementBody();
}

/* ================= Exit Interview (Feature 6) ================= */
const EXIT_INTERVIEW_QUESTIONS = [
  ['whyLeaving', 'Why are you leaving?'],
  ['enjoyed', 'What did you enjoy most about working here?'],
  ['improve', 'What can be improved?'],
  ['recommend', 'Would you recommend this company to others?'],
  ['rejoin', 'Would you consider joining again in the future?']
];
const EXIT_INTERVIEW_RATINGS = [['management','Management'],['workEnv','Work Environment'],['salary','Salary'],['growth','Growth Opportunities'],['culture','Company Culture']];

Modules['exit-interviews'] = function(container) {
  const resignations = Store.getResignations().filter(r => !['Rejected','Cancelled'].includes(r.status));
  if (!_selectedResignationId || !resignations.some(r => r.id === _selectedResignationId)) {
    _selectedResignationId = resignations[0]?.id || null;
  }
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Exit Management</div><h1>Exit Interviews</h1><p class="desc">Capture honest feedback from departing employees to improve retention.</p></div>
      <div class="page-actions">${resignations.length ? `<select id="ei-res-select" style="padding:9px 12px;border:1px solid var(--line-strong);border-radius:6px;">${resignations.map(r=>{const e=Store.getEmployee(r.empId);return `<option value="${r.id}" ${r.id===_selectedResignationId?'selected':''}>${e?e.firstName+' '+e.lastName:r.empId}</option>`;}).join('')}</select>` : ''}</div>
    </div>
    <div id="interview-mount"></div>
  `;
  if (resignations.length) {
    document.getElementById('ei-res-select').onchange = (e) => { _selectedResignationId = e.target.value; renderExitInterviewBody(); };
    renderExitInterviewBody();
  } else {
    document.getElementById('interview-mount').innerHTML = `<div class="card"><div class="empty-state"><div class="ic">&#128172;</div><h4>No active resignations</h4><p>Exit interviews appear once a resignation is submitted.</p></div></div>`;
  }
};
function renderExitInterviewBody() {
  const mount = document.getElementById('interview-mount');
  if (!mount || !_selectedResignationId) return;
  const existing = Store.getExitInterview(_selectedResignationId);
  mount.innerHTML = `
    <div class="card card-pad">
      ${existing ? `<p class="text-faint" style="font-size:11.5px;margin-bottom:14px;">Conducted on ${fmtDate(existing.conductedOn)} · Overall rating ${existing.overallRating}/5</p>` : ''}
      <div class="form-section">
        <div class="sec-title">Feedback</div>
        ${EXIT_INTERVIEW_QUESTIONS.map(([k,q]) => `<div class="field" style="margin-bottom:12px;"><label>${q}</label><textarea id="ei-${k}" rows="2">${escapeHtml(existing ? existing[k]||'' : '')}</textarea></div>`).join('')}
      </div>
      <div class="form-section">
        <div class="sec-title">Ratings (1–5)</div>
        <div class="form-grid">
          ${EXIT_INTERVIEW_RATINGS.map(([k,label]) => `<div class="field"><label>${label}</label><input type="number" min="1" max="5" id="ei-rate-${k}" value="${existing && existing.ratings ? existing.ratings[k]||3 : 3}"></div>`).join('')}
        </div>
      </div>
      <div class="field" style="margin-bottom:14px;"><label>Suggestions</label><textarea id="ei-suggestions" rows="2">${escapeHtml(existing ? existing.suggestions||'' : '')}</textarea></div>
      <button class="btn btn-primary" onclick="saveExitInterviewUI()">Save Exit Interview</button>
    </div>
  `;
}
function saveExitInterviewUI() {
  const val = id => document.getElementById(id).value;
  const ratings = {};
  EXIT_INTERVIEW_RATINGS.forEach(([k]) => ratings[k] = Number(val(`ei-rate-${k}`)) || 3);
  const overallRating = Math.round((Object.values(ratings).reduce((s,v)=>s+v,0) / Object.values(ratings).length) * 10) / 10;
  const data = {
    whyLeaving: val('ei-whyLeaving'), enjoyed: val('ei-enjoyed'), improve: val('ei-improve'),
    recommend: val('ei-recommend'), rejoin: val('ei-rejoin'), ratings, overallRating,
    suggestions: val('ei-suggestions')
  };
  Store.saveExitInterview(_selectedResignationId, data);
  toast('✓ Exit interview saved', 'success');
  renderExitInterviewBody();
}

/* ================= Former Employees (Feature 8) ================= */
let _formerDeptFilter = '';
let _formerReasonFilter = '';

Modules['former-employees'] = function(container) {
  const formerList = Store.getFormerEmployees();
  const depts = [...new Set(formerList.map(e => e.department))];
  const reasons = [...new Set(Store.getResignations().map(r => r.reason))];
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Exit Management</div><h1>Former Employees</h1><p class="desc">Archived employee records — search, filter, review documents, or restore/rehire.</p></div>
      <div class="page-actions"><button class="btn btn-outline" onclick="exportFormerEmployeesCSV()">&#128190; Export Report</button></div>
    </div>
    <div class="toolbar">
      <div class="search-box"><span class="ic">&#128269;</span><input id="fe-search" placeholder="Search former employees..." value="${escapeHtml(_formerEmpSearch)}"></div>
      <div class="filter-row">
        <select id="fe-dept-filter"><option value="">All Departments</option>${depts.map(d=>`<option ${d===_formerDeptFilter?'selected':''}>${d}</option>`).join('')}</select>
        <select id="fe-reason-filter"><option value="">All Reasons</option>${reasons.map(r=>`<option ${r===_formerReasonFilter?'selected':''}>${r}</option>`).join('')}</select>
      </div>
    </div>
    <div id="fe-mount"></div>
  `;
  document.getElementById('fe-search').oninput = (e) => { _formerEmpSearch = e.target.value; renderFormerEmployees(); };
  document.getElementById('fe-dept-filter').onchange = (e) => { _formerDeptFilter = e.target.value; renderFormerEmployees(); };
  document.getElementById('fe-reason-filter').onchange = (e) => { _formerReasonFilter = e.target.value; renderFormerEmployees(); };
  renderFormerEmployees();
};
function renderFormerEmployees() {
  const mount = document.getElementById('fe-mount');
  let list = Store.getFormerEmployees();
  if (_formerEmpSearch.trim()) {
    const q = _formerEmpSearch.toLowerCase();
    list = list.filter(e => `${e.firstName} ${e.lastName} ${e.id} ${e.department} ${e.designation}`.toLowerCase().includes(q));
  }
  if (_formerDeptFilter) list = list.filter(e => e.department === _formerDeptFilter);
  if (_formerReasonFilter) {
    list = list.filter(e => {
      const res = Store.getResignations().filter(r => r.empId === e.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
      return res && res.reason === _formerReasonFilter;
    });
  }
  if (!list.length) {
    mount.innerHTML = `<div class="card"><div class="empty-state"><div class="ic">&#128100;</div><h4>No former employees</h4><p>Employees appear here once they're archived after completing the exit process.</p></div></div>`;
    return;
  }
  mount.innerHTML = `<div class="card"><div class="table-wrap"><table class="data-table">
    <thead><tr><th>Employee</th><th>Department</th><th>Joining Date</th><th>Exit Date</th><th>Reason</th><th>Documents</th><th>Actions</th></tr></thead>
    <tbody>${list.map(e => {
      const res = Store.getResignations().filter(r => r.empId === e.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
      const docCount = Store.getDocuments().filter(d => d.empId === e.id).length;
      return `<tr>
        <td><div class="cell-name"><div class="avatar-sm">${initials(e.firstName,e.lastName)}</div>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</div></td>
        <td>${escapeHtml(e.department)}</td>
        <td>${fmtDate(e.joiningDate)}</td>
        <td>${res ? fmtDate(res.lastWorkingDay) : '—'}</td>
        <td>${res ? escapeHtml(res.reason) : '—'}</td>
        <td><button class="btn btn-sm btn-outline" onclick="viewFormerEmployeeDocuments('${e.id}')">${docCount} document${docCount===1?'':'s'}</button></td>
        <td><div class="actions-cell">
          <button class="icon-action" title="View Profile" onclick="viewEmployee('${e.id}')">&#128065;</button>
          <button class="btn btn-sm btn-outline" onclick="restoreFormerEmployeeUI('${e.id}')">Restore/Rehire</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div></div>`;
}
function viewFormerEmployeeDocuments(empId) {
  const emp = Store.getEmployee(empId);
  const docs = Store.getDocuments().filter(d => d.empId === empId).sort((a,b) => b.date.localeCompare(a.date));
  openModal({
    title: `Documents — ${emp.firstName} ${emp.lastName}`,
    body: docs.length ? `<div class="kv-list">${docs.map(d => `<div class="kv-row"><span class="k">${escapeHtml(d.type)}</span><span class="v">${fmtDate(d.date)}</span></div>`).join('')}</div>` : `<p class="text-dim" style="font-size:12.5px;">No documents generated for this employee yet.</p>`,
    foot: `<button class="btn btn-primary" id="fed-close">Close</button>`
  });
  document.getElementById('fed-close').onclick = closeModal;
}
function restoreFormerEmployeeUI(empId) {
  confirmAction('Restore this employee to Active status (rehire)? They will reappear in all active employee lists.', () => {
    Store.restoreFormerEmployee(empId);
    toast('✓ Employee restored', 'success');
    renderFormerEmployees();
  });
}

/* ================= Dashboard Exit Analytics (Feature 10 charts) ================= */
function renderExitAnalyticsCard() {
  const resignations = Store.getResignations();
  // Monthly Resignations - last 6 months
  const monthBuckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    monthBuckets.push({ key: d.toISOString().slice(0,7), label: d.toLocaleDateString('en-IN',{month:'short'}) });
  }
  const monthCounts = monthBuckets.map(b => resignations.filter(r => r.resignationDate.slice(0,7) === b.key).length);
  const maxMonthCount = Math.max(1, ...monthCounts);

  // Department-wise Exits
  const deptCounts = {};
  resignations.forEach(r => { const emp = Store.getEmployee(r.empId); const dept = emp ? emp.department : 'Unknown'; deptCounts[dept] = (deptCounts[dept]||0)+1; });
  const maxDeptCount = Math.max(1, ...Object.values(deptCounts));

  // Reasons for Leaving
  const reasonCounts = {};
  resignations.forEach(r => { reasonCounts[r.reason] = (reasonCounts[r.reason]||0)+1; });
  const reasonColors = ['#2D8C8C','#D9A441','#5B8C5B','#C1502E','#5B3F91','#35538F'];
  const reasonSegments = Object.entries(reasonCounts).map(([label,val],i) => ({ label, val, color: reasonColors[i % reasonColors.length] }));

  // Average Notice Period
  const avgNotice = resignations.length ? Math.round(resignations.reduce((s,r)=>s+(r.noticePeriodDays||0),0) / resignations.length) : 0;

  return `
    <div class="card card-pad" style="margin-bottom:22px;">
      <div class="flex-between" style="margin-bottom:16px;"><h3 style="font-size:15px;">Exit Management Analytics</h3><span class="hint" style="cursor:pointer;" onclick="navigate('resignations')">View Resignations →</span></div>
      <div class="grid grid-4">
        <div>
          <div class="text-faint" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Monthly Resignations</div>
          <div class="bar-chart" style="height:110px;">
            ${monthBuckets.map((b,i) => `<div class="bar-col"><div class="bar-val">${monthCounts[i]}</div><div class="bar" style="height:${Math.max(6,(monthCounts[i]/maxMonthCount)*80)}px;"></div><div class="bar-lbl">${b.label}</div></div>`).join('')}
          </div>
        </div>
        <div>
          <div class="text-faint" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Department-wise Exits</div>
          <div class="bar-chart" style="height:110px;">
            ${Object.keys(deptCounts).length ? Object.entries(deptCounts).map(([dept,c]) => `<div class="bar-col"><div class="bar-val">${c}</div><div class="bar" style="height:${Math.max(6,(c/maxDeptCount)*80)}px;background:var(--amber);"></div><div class="bar-lbl">${dept.split(' ')[0]}</div></div>`).join('') : '<p class="text-faint" style="font-size:11.5px;">No data yet</p>'}
          </div>
        </div>
        <div>
          <div class="text-faint" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Reasons for Leaving</div>
          ${reasonSegments.length ? donutSVG(reasonSegments) : '<p class="text-faint" style="font-size:11.5px;">No data yet</p>'}
        </div>
        <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:var(--paper-dim);border-radius:var(--radius);">
          <div class="text-faint" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Average Notice Period</div>
          <div style="font-family:var(--font-display);font-size:36px;font-weight:700;color:var(--ink);margin-top:6px;">${avgNotice}</div>
          <div class="text-faint" style="font-size:11.5px;">days</div>
        </div>
      </div>
    </div>
  `;
}

/* ================= Exit Reports (Feature 12) — reuses existing exportCSV/printArea helpers ================= */
function exportResignationsCSV() {
  const rows = [['Employee','Department','Resignation Date','Last Working Day','Notice Period (days)','Reason','Status','Notice Status']];
  Store.getResignations().forEach(r => {
    const emp = Store.getEmployee(r.empId);
    rows.push([emp ? `${emp.firstName} ${emp.lastName}` : r.empId, emp ? emp.department : '', r.resignationDate, r.lastWorkingDay, r.noticePeriodDays, r.reason, r.status, r.noticeStatus]);
  });
  exportCSV(`exit-report-${todayISO()}.csv`, rows);
  Store.logDocument('Exit Report', 'ALL', 'Resignations / Exit Report Export');
}
function exportFormerEmployeesCSV() {
  const rows = [['Employee','Department','Joining Date','Exit Date','Reason']];
  Store.getFormerEmployees().forEach(e => {
    const res = Store.getResignations().filter(r => r.empId === e.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
    rows.push([`${e.firstName} ${e.lastName}`, e.department, e.joiningDate, res ? res.lastWorkingDay : '', res ? res.reason : '']);
  });
  exportCSV(`former-employees-${todayISO()}.csv`, rows);
  Store.logDocument('Former Employee Report', 'ALL', 'Former Employees Report Export');
}
function exportSettlementReportCSV() {
  const rows = [['Employee','Department','Gross','Deductions','Net Settlement','Status','Paid Date','Payment Method']];
  Store.getResignations().forEach(r => {
    const emp = Store.getEmployee(r.empId);
    const s = Store.getSettlement(r.id);
    const totals = Store.settlementTotals(r.id);
    rows.push([emp ? `${emp.firstName} ${emp.lastName}` : r.empId, emp ? emp.department : '', totals.gross, totals.deductions, totals.net, s.status, s.paidDate||'', s.paymentMethod||'']);
  });
  exportCSV(`settlement-report-${todayISO()}.csv`, rows);
  Store.logDocument('Settlement Report', 'ALL', 'Settlement Report Export');
}
function exportDepartmentExitReportCSV() {
  const deptCounts = {};
  Store.getResignations().forEach(r => { const emp = Store.getEmployee(r.empId); const dept = emp ? emp.department : 'Unknown'; deptCounts[dept] = (deptCounts[dept]||0)+1; });
  const rows = [['Department','Exit Count']];
  Object.entries(deptCounts).forEach(([dept,count]) => rows.push([dept, count]));
  exportCSV(`department-exit-report-${todayISO()}.csv`, rows);
  Store.logDocument('Department Exit Report', 'ALL', 'Department Exit Report Export');
}
function exportAttritionReportCSV() {
  const totalEmployees = Store.getEmployees().length;
  const formerCount = Store.getFormerEmployees().length;
  const rate = totalEmployees ? Math.round(formerCount / totalEmployees * 100) : 0;
  const reasonCounts = {};
  Store.getResignations().forEach(r => { reasonCounts[r.reason] = (reasonCounts[r.reason]||0)+1; });
  const rows = [['Metric','Value']];
  rows.push(['Total Employee Records', totalEmployees]);
  rows.push(['Former Employees', formerCount]);
  rows.push(['Attrition Rate (%)', rate]);
  rows.push(['Total Resignations', Store.getResignations().length]);
  rows.push([]);
  rows.push(['Reason for Leaving', 'Count']);
  Object.entries(reasonCounts).forEach(([reason,count]) => rows.push([reason, count]));
  exportCSV(`attrition-report-${todayISO()}.csv`, rows);
  Store.logDocument('Attrition Report', 'ALL', 'Attrition Report Export');
}
function exportNoticePeriodReportCSV() {
  const rows = [['Employee','Department','Notice Start','Notice End','Days Completed','Days Remaining','Completion %','Notice Status']];
  Store.getResignations().forEach(r => {
    const emp = Store.getEmployee(r.empId);
    const p = Store.computeNoticeProgress(r);
    rows.push([emp ? `${emp.firstName} ${emp.lastName}` : r.empId, emp ? emp.department : '', r.resignationDate, r.lastWorkingDay, p.daysCompleted, p.daysRemaining, p.pct, r.noticeStatus]);
  });
  exportCSV(`notice-period-report-${todayISO()}.csv`, rows);
  Store.logDocument('Notice Period Report', 'ALL', 'Notice Period Report Export');
}

/* ---- Print (PDF via browser print dialog) versions of the aggregate reports ---- */
function printExitReportPDF() {
  const rows = Store.getResignations().map(r => {
    const emp = Store.getEmployee(r.empId);
    return `<tr><td>${emp?escapeHtml(emp.firstName+' '+emp.lastName):r.empId}</td><td>${emp?escapeHtml(emp.department):''}</td><td>${fmtDate(r.resignationDate)}</td><td>${fmtDate(r.lastWorkingDay)}</td><td>${escapeHtml(r.reason)}</td><td>${r.status}</td></tr>`;
  }).join('');
  const html = `<div class="doc-page">${letterheadHTML('Exit Report')}<div class="doc-title">EXIT REPORT</div>
    <table class="doc-table"><thead><tr><th>Employee</th><th>Department</th><th>Resignation Date</th><th>Last Working Day</th><th>Reason</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  printArea(html);
  Store.logDocument('Exit Report', 'ALL', 'Exit Report Print');
}
function printSettlementReportPDF() {
  const rows = Store.getResignations().map(r => {
    const emp = Store.getEmployee(r.empId);
    const s = Store.getSettlement(r.id); const t = Store.settlementTotals(r.id);
    return `<tr><td>${emp?escapeHtml(emp.firstName+' '+emp.lastName):r.empId}</td><td>₹${t.gross.toLocaleString('en-IN')}</td><td>₹${t.deductions.toLocaleString('en-IN')}</td><td>₹${t.net.toLocaleString('en-IN')}</td><td>${s.status}</td></tr>`;
  }).join('');
  const html = `<div class="doc-page">${letterheadHTML('Settlement Report')}<div class="doc-title">SETTLEMENT REPORT</div>
    <table class="doc-table"><thead><tr><th>Employee</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  printArea(html);
  Store.logDocument('Settlement Report', 'ALL', 'Settlement Report Print');
}
function printDepartmentExitReportPDF() {
  const deptCounts = {};
  Store.getResignations().forEach(r => { const emp = Store.getEmployee(r.empId); const dept = emp ? emp.department : 'Unknown'; deptCounts[dept] = (deptCounts[dept]||0)+1; });
  const rows = Object.entries(deptCounts).map(([dept,c]) => `<tr><td>${escapeHtml(dept)}</td><td>${c}</td></tr>`).join('');
  const html = `<div class="doc-page">${letterheadHTML('Department Exit Report')}<div class="doc-title">DEPARTMENT EXIT REPORT</div>
    <table class="doc-table"><thead><tr><th>Department</th><th>Exit Count</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  printArea(html);
  Store.logDocument('Department Exit Report', 'ALL', 'Department Exit Report Print');
}
function printAttritionReportPDF() {
  const totalEmployees = Store.getEmployees().length;
  const formerCount = Store.getFormerEmployees().length;
  const rate = totalEmployees ? Math.round(formerCount / totalEmployees * 100) : 0;
  const reasonCounts = {};
  Store.getResignations().forEach(r => { reasonCounts[r.reason] = (reasonCounts[r.reason]||0)+1; });
  const html = `<div class="doc-page">${letterheadHTML('Attrition Report')}<div class="doc-title">ATTRITION REPORT</div>
    <p><b>Total Employee Records:</b> ${totalEmployees} &nbsp; | &nbsp; <b>Former Employees:</b> ${formerCount} &nbsp; | &nbsp; <b>Attrition Rate:</b> ${rate}%</p>
    <table class="doc-table"><thead><tr><th>Reason for Leaving</th><th>Count</th></tr></thead><tbody>${Object.entries(reasonCounts).map(([r,c])=>`<tr><td>${escapeHtml(r)}</td><td>${c}</td></tr>`).join('')}</tbody></table></div>`;
  printArea(html);
  Store.logDocument('Attrition Report', 'ALL', 'Attrition Report Print');
}
function printNoticePeriodReportPDF() {
  const rows = Store.getResignations().map(r => {
    const emp = Store.getEmployee(r.empId);
    const p = Store.computeNoticeProgress(r);
    return `<tr><td>${emp?escapeHtml(emp.firstName+' '+emp.lastName):r.empId}</td><td>${fmtDate(r.resignationDate)}</td><td>${fmtDate(r.lastWorkingDay)}</td><td>${p.pct}%</td><td>${r.noticeStatus}</td></tr>`;
  }).join('');
  const html = `<div class="doc-page">${letterheadHTML('Notice Period Report')}<div class="doc-title">NOTICE PERIOD REPORT</div>
    <table class="doc-table"><thead><tr><th>Employee</th><th>Notice Start</th><th>Notice End</th><th>Completion</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  printArea(html);
  Store.logDocument('Notice Period Report', 'ALL', 'Notice Period Report Print');
}
function printSettlementStatement(resId) {
  const res = Store.getResignation(resId);
  previewDocument('settlement-statement', res.empId, { resignationId: resId });
}
function printClearanceReport(resId) {
  const res = Store.getResignation(resId);
  previewDocument('clearance-report', res.empId, { resignationId: resId });
}

/* ================= Archive action (used from Resignation Detail / Former Employees flow) ================= */
function archiveEmployeeUI(resignationId) {
  const result = Store.archiveEmployee(resignationId);
  if (!result.ok) return toast(result.error, 'error');
  toast('✓ Employee archived to Former Employees', 'success');
  navigate('former-employees');
}
