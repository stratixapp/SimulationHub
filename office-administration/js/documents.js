/* =========================================================
   documents.js — Document Center (letters/certificates) + ID Cards
   ========================================================= */

const DOC_TYPES = [
  { key: 'appointment', title: 'Appointment Letter', ic: '&#128203;', desc: 'Formal appointment confirmation with role, salary and joining terms.' },
  { key: 'offer', title: 'Offer Letter', ic: '&#129309;', desc: 'Job offer extended to a candidate before joining.' },
  { key: 'experience', title: 'Experience Certificate', ic: '&#127942;', desc: 'Certifies tenure, role and conduct for a relieved employee.' },
  { key: 'relieving', title: 'Relieving Letter', ic: '&#128682;', desc: 'Confirms last working day and clearance on exit.' },
  { key: 'resignation', title: 'Resignation Acceptance', ic: '&#128196;', desc: 'Formally accepts an employee\'s resignation.' },
  { key: 'warning', title: 'Warning Letter', ic: '&#9888;', desc: 'Formal note of misconduct or policy violation.' },
  { key: 'promotion', title: 'Promotion Letter', ic: '&#128200;', desc: 'Confirms new designation, salary and effective date.' },
  { key: 'transfer', title: 'Transfer Letter', ic: '&#128257;', desc: 'Confirms transfer to a new department or location.' },
  { key: 'salary', title: 'Salary Certificate', ic: '&#128176;', desc: 'Certifies current salary, usually for bank/loan purposes.' },
  { key: 'bonafide', title: 'Bonafide Certificate', ic: '&#9989;', desc: 'Confirms genuine employment status with the company.' },
  { key: 'no-due', title: 'No Due Certificate', ic: '&#128181;', desc: 'Confirms no pending dues, loans, or asset liabilities on exit.' },
  { key: 'settlement-statement', title: 'Final Settlement Statement', ic: '&#128179;', desc: 'Itemized final settlement breakdown for an exiting employee.' },
  { key: 'clearance-report', title: 'Exit Clearance Report', ic: '&#128203;', desc: 'Summary of department-wise clearance status on exit.' },
  { key: 'employment-verification', title: 'Employment Verification Letter', ic: '&#128269;', desc: 'Verifies employment details for a third party (bank, agency, etc).' }
];

Modules.documents = function(container) {
  const employees = Store.getEmployees();
  const recent = Store.getDocuments().slice(-8).reverse();
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Module 9, 11 &amp; 16</div><h1>Document Center</h1><p class="desc">Generate professional HR documents instantly. Every letter uses your simulated company's letterhead and is print/PDF ready.</p></div>
    </div>
    ${employees.length === 0 ? `<div class="card" style="margin-bottom:22px;"><div class="empty-state"><div class="ic">&#128220;</div><h4>Add an employee first</h4><p>Documents are generated for a specific employee record.</p><button class="btn btn-primary" onclick="navigate('employees')">Go to Employees</button></div></div>` : ''}
    <div class="doc-type-grid" style="margin-bottom:26px;">
      ${DOC_TYPES.map(d => `<div class="doc-type-card" onclick="openDocGenerator('${d.key}')"><div class="dt-ic">${d.ic}</div><h4>${d.title}</h4><p>${d.desc}</p></div>`).join('')}
    </div>
    <div class="card">
      <div class="card-head"><h3>Recently Generated</h3><span class="hint">${Store.getDocuments().length} total documents</span></div>
      <div class="card-pad" style="padding-top:6px;">
        ${recent.length ? recent.map(d => {
          const emp = Store.getEmployee(d.empId);
          return `<div class="activity-item"><div class="a-dot"></div><div><div><b>${escapeHtml(d.type)}</b> — ${emp ? escapeHtml(emp.firstName+' '+emp.lastName) : d.empId}</div><div class="a-time">${fmtDate(d.date)}</div></div></div>`;
        }).join('') : `<p class="text-dim" style="font-size:13px;">No documents generated yet. Choose a document type above to get started.</p>`}
      </div>
    </div>
  `;
};

function openDocGenerator(key) {
  const employees = Store.getEmployees();
  if (employees.length === 0) return toast('Add an employee first', 'error');
  const meta = DOC_TYPES.find(d => d.key === key);
  openModal({
    title: `Generate ${meta.title}`,
    body: `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="field"><label>Employee <span class="req">*</span></label><select id="dg-emp">${employees.map(e=>`<option value="${e.id}">${e.firstName} ${e.lastName} (${e.department})</option>`).join('')}</select></div>
        ${docExtraFieldsHTML(key)}
      </div>
    `,
    foot: `<button class="btn btn-outline" id="dg-cancel">Cancel</button><button class="btn btn-primary" id="dg-generate">Generate &amp; Preview</button>`
  });
  document.getElementById('dg-cancel').onclick = closeModal;
  document.getElementById('dg-generate').onclick = () => {
    const empId = document.getElementById('dg-emp').value;
    const extra = collectDocExtraFields(key);
    closeModal();
    previewDocument(key, empId, extra);
  };
}

function docExtraFieldsHTML(key) {
  const today = todayISO();
  switch(key) {
    case 'appointment':
    case 'offer':
      return `
        <div class="field"><label>Effective / Joining Date</label><input type="date" id="dg-date" value="${today}"></div>
        <div class="field"><label>Monthly Salary (₹)</label><input type="number" id="dg-salary" value="25000"></div>`;
    case 'experience':
    case 'relieving':
      return `
        <div class="field"><label>Last Working Date</label><input type="date" id="dg-date" value="${today}"></div>
        <div class="field"><label>Performance Remarks</label><select id="dg-perf"><option>Excellent</option><option selected>Very Good</option><option>Good</option><option>Satisfactory</option></select></div>`;
    case 'resignation':
      return `
        <div class="field"><label>Resignation Date</label><input type="date" id="dg-date" value="${today}"></div>
        <div class="field"><label>Last Working Date</label><input type="date" id="dg-date2" value="${today}"></div>`;
    case 'warning':
      return `
        <div class="field"><label>Date of Incident</label><input type="date" id="dg-date" value="${today}"></div>
        <div class="field"><label>Nature of Concern</label><input id="dg-reason" placeholder="e.g. repeated late arrival, policy violation"></div>`;
    case 'promotion':
      return `
        <div class="field"><label>Effective Date</label><input type="date" id="dg-date" value="${today}"></div>
        <div class="field"><label>New Designation</label><input id="dg-newdesig" placeholder="e.g. Senior Executive"></div>
        <div class="field"><label>Revised Salary (₹)</label><input type="number" id="dg-salary" value="30000"></div>`;
    case 'transfer':
      return `
        <div class="field"><label>Effective Date</label><input type="date" id="dg-date" value="${today}"></div>
        <div class="field"><label>New Department</label><select id="dg-newdept">${DEPARTMENTS.map(d=>`<option>${d}</option>`).join('')}</select></div>
        <div class="field"><label>New Location</label><input id="dg-location" value="Thiruvalla, Kerala"></div>`;
    case 'salary':
    case 'bonafide':
    case 'employment-verification':
      return `<div class="field"><label>Purpose</label><input id="dg-purpose" placeholder="e.g. Bank loan application, Visa processing"></div>`;
    case 'no-due':
    case 'settlement-statement':
    case 'clearance-report':
      return `<div class="field"><label>Linked Resignation (optional)</label><select id="dg-resignation"><option value="">— None / not resignation-linked —</option>${Store.getResignations().map(r=>{const e=Store.getEmployee(r.empId);return `<option value="${r.id}">${e?e.firstName+' '+e.lastName:r.empId} — ${fmtDate(r.lastWorkingDay)}</option>`;}).join('')}</select></div>`;
    default: return '';
  }
}
function collectDocExtraFields(key) {
  const val = id => document.getElementById(id)?.value;
  return {
    date: val('dg-date'), date2: val('dg-date2'), salary: val('dg-salary'),
    perf: val('dg-perf'), reason: val('dg-reason'), newDesig: val('dg-newdesig'),
    newDept: val('dg-newdept'), location: val('dg-location'), purpose: val('dg-purpose'),
    resignationId: val('dg-resignation')
  };
}

function previewDocument(key, empId, extra) {
  const emp = Store.getEmployee(empId);
  const meta = Store.load().meta;
  const co = escapeHtml(meta.institution);
  const title = DOC_TYPES.find(d=>d.key===key).title;
  const refNo = uid('REF');
  let bodyHtml = '';

  switch(key) {
    case 'appointment':
      bodyHtml = `
        <p>Dear <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b>,</p>
        <p>We are pleased to confirm your appointment with <b>${co}</b> as <b>${escapeHtml(emp.designation)}</b> in the <b>${escapeHtml(emp.department)}</b> department, effective from <b>${fmtDate(extra.date)}</b>.</p>
        <p>Your monthly consolidated salary will be <b>₹${Number(extra.salary||0).toLocaleString('en-IN')}</b>, subject to applicable statutory deductions. You will report to <b>${escapeHtml(emp.reportingManager||'your Department Head')}</b>.</p>
        <p>Your employment shall be governed by the company's HR policies as amended from time to time. This letter, together with the offer of employment, constitutes your terms of appointment.</p>
        <p>We look forward to a long and mutually beneficial association. Please sign and return a copy of this letter as a token of your acceptance.</p>`;
      break;
    case 'offer':
      bodyHtml = `
        <p>Dear <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b>,</p>
        <p>Further to your interview and selection process, we are pleased to offer you the position of <b>${escapeHtml(emp.designation)}</b> in the <b>${escapeHtml(emp.department)}</b> department at <b>${co}</b>.</p>
        <p>Your proposed monthly salary will be <b>₹${Number(extra.salary||0).toLocaleString('en-IN')}</b>. Your tentative date of joining is <b>${fmtDate(extra.date)}</b>. A formal appointment letter will be issued upon joining.</p>
        <p>Kindly confirm your acceptance of this offer at the earliest to enable us to proceed with onboarding formalities.</p>`;
      break;
    case 'experience':
      bodyHtml = `
        <p>This is to certify that <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b> was employed with <b>${co}</b> as <b>${escapeHtml(emp.designation)}</b> in the <b>${escapeHtml(emp.department)}</b> department from <b>${fmtDate(emp.joiningDate)}</b> to <b>${fmtDate(extra.date)}</b>.</p>
        <p>During the tenure, ${escapeHtml(emp.firstName)}'s conduct and performance were <b>${extra.perf || 'Very Good'}</b>. ${escapeHtml(emp.firstName)} was found to be sincere, hardworking and possessed sound knowledge of office administration functions relevant to the role.</p>
        <p>We wish ${escapeHtml(emp.firstName)} all success in future endeavours.</p>`;
      break;
    case 'relieving':
      bodyHtml = `
        <p>This is to confirm that <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b>, ${escapeHtml(emp.designation)}, has been relieved from the services of <b>${co}</b> with effect from <b>${fmtDate(extra.date)}</b>.</p>
        <p>All dues, if any, have been settled and full and final clearance has been provided. We thank ${escapeHtml(emp.firstName)} for the contributions made during the tenure and wish continued success ahead.</p>`;
      break;
    case 'resignation': {
      const linkedRes = Store.getActiveResignationForEmployee(empId);
      bodyHtml = `
        <p>This is to acknowledge and accept the resignation submitted by <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b>, ${escapeHtml(emp.designation)}, dated <b>${fmtDate(extra.date)}</b>.</p>
        <p>Your last working day with <b>${co}</b> will be <b>${fmtDate(extra.date2)}</b>. Please ensure completion of handover formalities and exit clearance before your last working day.</p>
        ${linkedRes ? `<p>We note your reason for resignation as: <b>${escapeHtml(linkedRes.reason)}</b>. Your notice period of <b>${linkedRes.noticePeriodDays} days</b> has been recorded, and your exit will be processed through our standard clearance and settlement procedure.</p>` : ''}
        <p>We appreciate your services during your tenure with us and wish you success in your future endeavours.</p>`;
      break;
    }
    case 'warning':
      bodyHtml = `
        <p>This letter serves as a formal warning regarding an incident on <b>${fmtDate(extra.date)}</b> concerning: <b>${escapeHtml(extra.reason || 'a conduct/performance concern')}</b>.</p>
        <p>Dear <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b>, such conduct is not in line with the standards expected at <b>${co}</b>. You are advised to take corrective action immediately.</p>
        <p>Please treat this as a formal warning. Repetition of similar conduct may attract further disciplinary action as per company policy, up to and including termination of employment.</p>`;
      break;
    case 'promotion':
      bodyHtml = `
        <p>Dear <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b>,</p>
        <p>We are pleased to inform you that, in recognition of your consistent performance and contribution, you have been promoted to <b>${escapeHtml(extra.newDesig || 'a senior role')}</b>, effective <b>${fmtDate(extra.date)}</b>.</p>
        <p>Your revised monthly salary will be <b>₹${Number(extra.salary||0).toLocaleString('en-IN')}</b>. All other terms of your employment remain unchanged unless communicated separately.</p>
        <p>Congratulations, and we look forward to your continued contribution to <b>${co}</b>.</p>`;
      break;
    case 'transfer':
      bodyHtml = `
        <p>Dear <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b>,</p>
        <p>This is to inform you that you are being transferred from the <b>${escapeHtml(emp.department)}</b> department to the <b>${escapeHtml(extra.newDept)}</b> department, effective <b>${fmtDate(extra.date)}</b>.</p>
        <p>Your new work location will be <b>${escapeHtml(extra.location)}</b>. Please report to your new reporting authority on the effective date. All other terms of employment remain unchanged.</p>`;
      break;
    case 'salary':
      bodyHtml = `
        <p>This is to certify that <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b> is employed with <b>${co}</b> as <b>${escapeHtml(emp.designation)}</b> since <b>${fmtDate(emp.joiningDate)}</b>.</p>
        <p>The current monthly gross salary is <b>₹${Number(emp.salary||0).toLocaleString('en-IN')}</b>. This certificate is issued for the purpose of: <b>${escapeHtml(extra.purpose || 'official use')}</b>.</p>`;
      break;
    case 'bonafide':
      bodyHtml = `
        <p>This is to certify that <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b> is a bonafide employee of <b>${co}</b>, working as <b>${escapeHtml(emp.designation)}</b> in the <b>${escapeHtml(emp.department)}</b> department since <b>${fmtDate(emp.joiningDate)}</b>.</p>
        <p>This certificate is issued upon request for the purpose of: <b>${escapeHtml(extra.purpose || 'official use')}</b>.</p>`;
      break;
    case 'employment-verification':
      bodyHtml = `
        <p>This letter is issued at the request of <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b> to verify their employment details with <b>${co}</b>.</p>
        <p>We confirm that ${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)} (Employee ID: ${emp.id}) has been / was employed as <b>${escapeHtml(emp.designation)}</b> in the <b>${escapeHtml(emp.department)}</b> department, with a monthly gross salary of <b>₹${Number(emp.salary||0).toLocaleString('en-IN')}</b>, since <b>${fmtDate(emp.joiningDate)}</b>.</p>
        <p>This verification is issued for the purpose of: <b>${escapeHtml(extra.purpose || 'official use')}</b>. For any further clarification, the HR department may be contacted directly.</p>`;
      break;
    case 'no-due': {
      const res1 = extra.resignationId ? Store.getResignation(extra.resignationId) : null;
      const clearance1 = res1 ? Store.clearanceProgress(res1.id) : null;
      const settlement1 = res1 ? Store.getSettlement(res1.id) : null;
      bodyHtml = `
        <p>This is to certify that <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b>, ${escapeHtml(emp.designation)}, ${res1 ? `who was relieved effective <b>${fmtDate(res1.lastWorkingDay)}</b>,` : ''} has no outstanding dues, pending loans, advances, or unreturned company property as on the date of this certificate.</p>
        ${clearance1 ? `<p>All department clearances (${CLEARANCE_DEPARTMENTS.join(', ')}) have been completed and approved — <b>${clearance1.approved}/${clearance1.total}</b> departments cleared.</p>` : ''}
        ${settlement1 && settlement1.status === 'Paid' ? `<p>Final settlement of <b>₹${Store.settlementTotals(res1.id).net.toLocaleString('en-IN')}</b> was processed on <b>${fmtDate(settlement1.paidDate)}</b> via ${escapeHtml(settlement1.paymentMethod)}.</p>` : ''}
        <p>This No Due Certificate is issued for record purposes and may be used as proof of full and final clearance from <b>${co}</b>.</p>`;
      break;
    }
    case 'settlement-statement': {
      const res2 = extra.resignationId ? Store.getResignation(extra.resignationId) : null;
      if (!res2) { bodyHtml = `<p>No linked resignation/settlement record was selected for this employee. Please generate this document from the Final Settlement page instead.</p>`; break; }
      const s = Store.getSettlement(res2.id);
      const totals = Store.settlementTotals(res2.id);
      bodyHtml = `
        <p>This statement summarizes the full and final settlement for <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b>, relieved effective <b>${fmtDate(res2.lastWorkingDay)}</b>.</p>
        <table class="doc-table"><thead><tr><th colspan="2">Earnings</th></tr></thead><tbody>
          <tr><td>Pending Salary</td><td>₹${s.pendingSalary.toLocaleString('en-IN')}</td></tr>
          <tr><td>Leave Encashment</td><td>₹${s.leaveEncashment.toLocaleString('en-IN')}</td></tr>
          <tr><td>Bonus</td><td>₹${s.bonus.toLocaleString('en-IN')}</td></tr>
          <tr><td>Incentives</td><td>₹${s.incentives.toLocaleString('en-IN')}</td></tr>
          <tr><td>Commission</td><td>₹${s.commission.toLocaleString('en-IN')}</td></tr>
          <tr><td>Overtime</td><td>₹${s.overtime.toLocaleString('en-IN')}</td></tr>
          <tr><th>Gross Amount</th><th>₹${totals.gross.toLocaleString('en-IN')}</th></tr>
        </tbody></table>
        <table class="doc-table"><thead><tr><th colspan="2">Deductions</th></tr></thead><tbody>
          <tr><td>Recoveries</td><td>₹${s.recoveries.toLocaleString('en-IN')}</td></tr>
          <tr><td>Asset Damage</td><td>₹${s.assetDamage.toLocaleString('en-IN')}</td></tr>
          <tr><td>Advance Salary</td><td>₹${s.advanceSalary.toLocaleString('en-IN')}</td></tr>
          <tr><td>Loans</td><td>₹${s.loans.toLocaleString('en-IN')}</td></tr>
          <tr><td>Tax</td><td>₹${s.tax.toLocaleString('en-IN')}</td></tr>
          <tr><td>Other Deductions</td><td>₹${s.otherDeductions.toLocaleString('en-IN')}</td></tr>
          <tr><th>Total Deductions</th><th>₹${totals.deductions.toLocaleString('en-IN')}</th></tr>
        </tbody></table>
        <p style="font-size:14px;text-align:right;"><b>Net Settlement: ₹${totals.net.toLocaleString('en-IN')}</b></p>
        <p>Status: <b>${s.status}</b>${s.status==='Paid' ? ` — paid on ${fmtDate(s.paidDate)} via ${escapeHtml(s.paymentMethod)}` : ''}</p>`;
      break;
    }
    case 'clearance-report': {
      const res3 = extra.resignationId ? Store.getResignation(extra.resignationId) : null;
      if (!res3) { bodyHtml = `<p>No linked resignation was selected. Please generate this report from the Department Clearance page instead.</p>`; break; }
      const clearance3 = Store.getClearance(res3.id);
      bodyHtml = `
        <p>This report summarizes department-wise exit clearance status for <b>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</b>, last working day <b>${fmtDate(res3.lastWorkingDay)}</b>.</p>
        <table class="doc-table"><thead><tr><th>Department</th><th>Status</th><th>Responsible Person</th><th>Completion Date</th><th>Comments</th></tr></thead>
        <tbody>${CLEARANCE_DEPARTMENTS.map(dept => { const c = clearance3[dept]; return `<tr><td>${dept}</td><td>${c.status}</td><td>${escapeHtml(c.responsible||'—')}</td><td>${c.completionDate?fmtDate(c.completionDate):'—'}</td><td>${escapeHtml(c.comments||'—')}</td></tr>`; }).join('')}</tbody></table>`;
      break;
    }
  }

  const docHtml = `<div class="doc-page" id="doc-render-target">
    <div class="doc-watermark"><span>${co.toUpperCase()}</span></div>
    ${letterheadHTML()}
    <div class="doc-ref-row"><span>Ref No: ${refNo}</span><span>Date: ${fmtDate(todayISO())}</span></div>
    <div class="doc-title">${title.toUpperCase()}</div>
    ${bodyHtml}
    <div class="doc-signoff">
      <div class="sig-block"><div class="sig-line"></div>Employee Signature</div>
      <div class="sig-block"><div class="sig-line"></div>For ${co}<br>Authorized Signatory</div>
    </div>
    <div class="doc-seal"><div class="seal-text">OFFICIAL<br>SIMULATION<br>SEAL</div></div>
  </div>`;

  openModal({
    title: `${title} — Preview`, wide: true,
    body: `<div class="doc-preview-wrap"><div class="doc-scale-62">${docHtml}</div></div>`,
    foot: `<button class="btn btn-outline" id="dv-close">Close</button><button class="btn btn-primary" id="dv-print">&#128438; Print / Save as PDF</button>`
  });
  document.getElementById('dv-close').onclick = closeModal;
  fitDocPreview();
  document.getElementById('dv-print').onclick = () => {
    Store.logDocument(title, empId, `${title} — ${emp.firstName} ${emp.lastName}`);
    closeModal();
    printArea(docHtml);
    toast(`✓ ${title} generated`, 'success');
  };
}

/* ================= ID Card Generator (Module 10) ================= */
Modules.idcard = function(container) {
  const employees = Store.getEmployees();
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Module 10</div><h1>Employee ID Card Generator</h1><p class="desc">Generate front and back ID cards with photo, QR placeholder and company branding.</p></div>
    </div>
    ${employees.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#127380;</div><h4>No employees yet</h4><p>Add employees first to generate ID cards.</p><button class="btn btn-primary" onclick="navigate('employees')">Go to Employees</button></div></div>` : `
    <div class="card card-pad" style="margin-bottom:20px;">
      <div class="form-grid" style="grid-template-columns:2fr 1fr;align-items:end;">
        <div class="field"><label>Select Employee</label><select id="idc-emp">${employees.map(e=>`<option value="${e.id}">${e.firstName} ${e.lastName} (${e.id})</option>`).join('')}</select></div>
        <button class="btn btn-primary" id="idc-print">&#128438; Print ID Card</button>
      </div>
    </div>
    <div id="idc-preview"></div>`}
  `;
  if (employees.length) {
    document.getElementById('idc-emp').onchange = renderIdCardPreview;
    document.getElementById('idc-print').onclick = printIdCard;
    renderIdCardPreview();
  }
};

function idCardHTML(emp) {
  const meta = Store.load().meta;
  return `
    <div class="idcards-pair">
      <div class="idcard idcard-front">
        <div class="ic-head">${meta.companyLogo ? `<img src="${meta.companyLogo}" style="width:22px;height:22px;border-radius:6px;object-fit:cover;">` : `<div class="mark">OA</div>`}<div class="co">${escapeHtml(meta.institution).toUpperCase()}</div></div>
        <div class="ic-body">
          <div class="ic-photo">${emp.photo ? `<img src="${emp.photo}">` : '&#128100;'}</div>
          <div class="ic-info">
            <div class="nm">${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</div>
            <div class="ds">${escapeHtml(emp.designation)}</div>
            <div class="rows">
              ID: <b>${emp.id}</b><br>
              Dept: <b>${escapeHtml(emp.department)}</b><br>
              Blood Group: <b>${emp.bloodGroup || '—'}</b>
            </div>
          </div>
        </div>
        <div class="ic-strip"></div>
      </div>
      <div class="idcard idcard-back">
        <h5>Emergency &amp; Address</h5>
        <div class="row"><span>Address</span><span style="text-align:right;max-width:180px;">${escapeHtml(emp.city)}, ${escapeHtml(emp.district)}</span></div>
        <div class="row"><span>Emergency No.</span><span>${emp.emergencyContact || emp.phone}</span></div>
        <div class="row"><span>Blood Group</span><span>${emp.bloodGroup || '—'}</span></div>
        <div class="row"><span>Valid Till</span><span>Dec ${new Date().getFullYear()+1}</span></div>
        <div class="qr"></div>
        <div class="ic-sig">If found, please return to HR Dept.<br><b>${escapeHtml(meta.institution)}</b></div>
      </div>
    </div>
  `;
}
function renderIdCardPreview() {
  const emp = Store.getEmployee(document.getElementById('idc-emp').value);
  document.getElementById('idc-preview').innerHTML = `<div class="card card-pad">${idCardHTML(emp)}</div>`;
}
function printIdCard() {
  const emp = Store.getEmployee(document.getElementById('idc-emp').value);
  printArea(`<div style="padding:20px;">${idCardHTML(emp)}</div>`);
  Store.logDocument('ID Card', emp.id, `ID Card — ${emp.firstName} ${emp.lastName}`);
  toast('✓ ID Card generated', 'success');
}
