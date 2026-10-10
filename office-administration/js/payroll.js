/* =========================================================
   payroll.js — Salary Structures, Payroll Runs, Payslips
   ========================================================= */

let _payMonth = todayISO().slice(0,7);

Modules.payroll = function(container) {
  const employees = Store.getEmployees();
  const run = Store.getPayrollRun(_payMonth);
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Payroll</div><h1>Payroll &amp; Payslips</h1><p class="desc">Configure salary structures and run monthly payroll — CTC breakup, statutory deductions, and printable payslips.</p></div>
      <div class="page-actions">
        <input type="month" id="pay-month" value="${_payMonth}">
        <button class="btn btn-primary" id="pay-run">${run ? '↻ Re-run Payroll' : '▶ Run Payroll'}</button>
      </div>
    </div>
    ${employees.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128176;</div><h4>No employees yet</h4><p>Add employees first to configure salary and run payroll.</p><button class="btn btn-primary" onclick="navigate('employees')">Go to Employees</button></div></div>` : `
    <div class="grid grid-3" style="margin-bottom:20px;">
      <div class="card stat-tile accent-teal"><div class="stat-label">Employees on Payroll</div><div class="stat-value">${employees.filter(e=>e.status==='Active').length}</div><div class="stat-sub">active headcount</div></div>
      <div class="card stat-tile accent-sage"><div class="stat-label">Total Net Pay</div><div class="stat-value">₹${run ? run.payslips.reduce((s,p)=>s+p.netPay,0).toLocaleString('en-IN') : '—'}</div><div class="stat-sub">${run ? monthLabel(_payMonth) : 'not yet run'}</div></div>
      <div class="card stat-tile accent-amber"><div class="stat-label">Total Statutory Deductions</div><div class="stat-value">₹${run ? run.payslips.reduce((s,p)=>s+p.deductions,0).toLocaleString('en-IN') : '—'}</div><div class="stat-sub">PF + ESI + PT</div></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>${run ? `Payroll — ${monthLabel(_payMonth)}` : 'Salary Structure — set up before running payroll'}</h3>
        ${run ? `<button class="btn btn-outline btn-sm" onclick="exportPayrollCSV()">&#128190; Export Excel</button>` : ''}
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Employee</th><th>Department</th><th>Gross</th><th>PF</th><th>ESI</th><th>PT</th><th>LOP Days</th><th>Net Pay</th><th>Actions</th></tr></thead>
          <tbody>
            ${employees.filter(e=>e.status==='Active').map(e => {
              const slip = (run && run.payslips.find(p=>p.empId===e.id)) || Store.computePayslip(e.id, _payMonth);
              return `<tr>
                <td><div class="cell-name"><div class="avatar-sm">${initials(e.firstName,e.lastName)}</div>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</div></td>
                <td>${escapeHtml(e.department)}</td>
                <td class="mono">₹${slip.gross.toLocaleString('en-IN')}</td>
                <td class="mono">₹${slip.pf}</td><td class="mono">₹${slip.esi}</td><td class="mono">₹${slip.pt}</td>
                <td class="mono">${slip.lopDays}</td>
                <td class="mono"><b>₹${slip.netPay.toLocaleString('en-IN')}</b></td>
                <td><div class="actions-cell">
                  <button class="icon-action" title="Edit salary structure" onclick="openSalaryStructureForm('${e.id}')">&#9998;</button>
                  ${run ? `<button class="icon-action" title="View payslip" onclick="previewPayslip('${e.id}','${_payMonth}')">&#128196;</button>` : ''}
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`}
  `;
  document.getElementById('pay-month').onchange = (e) => { _payMonth = e.target.value; navigate('payroll'); };
  document.getElementById('pay-run').onclick = () => {
    if (employees.length === 0) return;
    Store.runPayroll(_payMonth);
    toast(`✓ Payroll generated for ${monthLabel(_payMonth)}`, 'success');
    navigate('payroll');
  };
};

function openSalaryStructureForm(empId) {
  const emp = Store.getEmployee(empId);
  const s = Store.getSalaryStructure(empId);
  openModal({
    title: `Salary Structure — ${emp.firstName} ${emp.lastName}`,
    body: `
      <div class="form-section"><div class="sec-title">Earnings (Monthly)</div>
      <div class="form-grid">
        <div class="field"><label>Basic</label><input type="number" id="ss-basic" value="${s.basic}"></div>
        <div class="field"><label>DA (Dearness Allowance)</label><input type="number" id="ss-da" value="${s.da||0}"></div>
        <div class="field"><label>HRA</label><input type="number" id="ss-hra" value="${s.hra}"></div>
        <div class="field"><label>Conveyance</label><input type="number" id="ss-conv" value="${s.conveyance}"></div>
        <div class="field"><label>Medical Allowance</label><input type="number" id="ss-medical" value="${s.medical}"></div>
        <div class="field"><label>Special Allowance</label><input type="number" id="ss-special" value="${s.special}"></div>
      </div></div>
      <div class="form-section"><div class="sec-title">Statutory Deductions (Monthly)
        <button class="btn btn-outline btn-sm" id="ss-autocalc" style="margin-left:10px;">&#9889; Auto-Calculate</button>
      </div>
      <p class="text-dim" style="font-size:11.5px;margin:2px 0 10px;">EPF 12% of Basic+DA (capped ₹1,800) &middot; ESI 0.75% of Gross if Gross \u2264 ₹21,000 &middot; Professional Tax per Maharashtra slab (${escapeHtml(emp.gender||'Male')}, ${monthLabel(_payMonth)})</p>
      <div class="form-grid">
        <div class="field"><label>Provident Fund (PF)</label><input type="number" id="ss-pf" value="${s.pf}"></div>
        <div class="field"><label>ESI</label><input type="number" id="ss-esi" value="${s.esi}"></div>
        <div class="field"><label>Professional Tax</label><input type="number" id="ss-pt" value="${s.pt}"></div>
        <div class="field"><label>Other Deductions</label><input type="number" id="ss-other" value="${s.otherDeduction||0}"></div>
      </div></div>
      <p id="ss-preview" class="text-dim" style="font-size:12.5px;"></p>
    `,
    foot: `<button class="btn btn-outline" id="ss-cancel">Cancel</button><button class="btn btn-primary" id="ss-save">Save Structure</button>`
  });
  const updatePreview = () => {
    const v = id => Number(document.getElementById(id).value) || 0;
    const gross = v('ss-basic')+v('ss-da')+v('ss-hra')+v('ss-conv')+v('ss-medical')+v('ss-special');
    const ded = v('ss-pf')+v('ss-esi')+v('ss-pt')+v('ss-other');
    document.getElementById('ss-preview').textContent = `Gross: ₹${gross.toLocaleString('en-IN')}/mo · Deductions: ₹${ded.toLocaleString('en-IN')} · Approx Net: ₹${(gross-ded).toLocaleString('en-IN')}`;
  };
  document.querySelectorAll('#modal-body input').forEach(inp => inp.oninput = updatePreview);
  updatePreview();
  document.getElementById('ss-autocalc').onclick = () => {
    const v = id => Number(document.getElementById(id).value) || 0;
    const basic = v('ss-basic'), da = v('ss-da');
    const gross = basic + da + v('ss-hra') + v('ss-conv') + v('ss-medical') + v('ss-special');
    const stat = Store.calcStatutoryDeductions(basic, da, gross, emp.gender, _payMonth);
    document.getElementById('ss-pf').value = stat.pf;
    document.getElementById('ss-esi').value = stat.esi;
    document.getElementById('ss-pt').value = stat.pt;
    updatePreview();
    toast('Statutory deductions auto-calculated', 'success');
  };
  document.getElementById('ss-cancel').onclick = closeModal;
  document.getElementById('ss-save').onclick = () => {
    const v = id => Number(document.getElementById(id).value) || 0;
    Store.setSalaryStructure(empId, {
      basic: v('ss-basic'), da: v('ss-da'), hra: v('ss-hra'), conveyance: v('ss-conv'), medical: v('ss-medical'), special: v('ss-special'),
      pf: v('ss-pf'), esi: v('ss-esi'), pt: v('ss-pt'), otherDeduction: v('ss-other')
    });
    closeModal(); toast('✓ Salary structure saved', 'success'); navigate('payroll');
  };
}

function previewPayslip(empId, month) {
  const emp = Store.getEmployee(empId);
  const run = Store.getPayrollRun(month);
  const slip = (run && run.payslips.find(p => p.empId === empId)) || Store.computePayslip(empId, month);
  const meta = Store.load().meta;
  const html = `<div class="doc-page">
    ${letterheadHTML('Payslip')}
    <div class="doc-ref-row"><span>Pay Period: ${monthLabel(month)}</span><span>Generated ${fmtDate(todayISO())}</span></div>
    <div class="doc-title">PAYSLIP — ${monthLabel(month).toUpperCase()}</div>
    <table class="doc-table">
      <tr><th>Employee Name</th><td>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</td><th>Employee ID</th><td>${emp.id}</td></tr>
      <tr><th>Department</th><td>${escapeHtml(emp.department)}</td><th>Designation</th><td>${escapeHtml(emp.designation)}</td></tr>
      <tr><th>Bank A/C</th><td>${emp.accountNumber||'—'}</td><th>PAN</th><td>${emp.pan||'—'}</td></tr>
      <tr><th>Working Days</th><td>${slip.workingDays}</td><th>LOP Days</th><td>${slip.lopDays}</td></tr>
    </table>
    <div class="grid grid-2" style="display:flex;gap:20px;margin-top:16px;">
      <table class="doc-table" style="flex:1;"><thead><tr><th colspan="2">Earnings</th></tr></thead><tbody>
        <tr><td>Basic</td><td>₹${slip.basic.toLocaleString('en-IN')}</td></tr>
        <tr><td>DA (Dearness Allowance)</td><td>₹${(slip.da||0).toLocaleString('en-IN')}</td></tr>
        <tr><td>HRA</td><td>₹${slip.hra.toLocaleString('en-IN')}</td></tr>
        <tr><td>Conveyance</td><td>₹${slip.conveyance.toLocaleString('en-IN')}</td></tr>
        <tr><td>Medical Allowance</td><td>₹${slip.medical.toLocaleString('en-IN')}</td></tr>
        <tr><td>Special Allowance</td><td>₹${slip.special.toLocaleString('en-IN')}</td></tr>
        <tr><th>Gross Earnings</th><th>₹${slip.gross.toLocaleString('en-IN')}</th></tr>
      </tbody></table>
      <table class="doc-table" style="flex:1;"><thead><tr><th colspan="2">Deductions</th></tr></thead><tbody>
        <tr><td>Provident Fund</td><td>₹${slip.pf.toLocaleString('en-IN')}</td></tr>
        <tr><td>ESI</td><td>₹${slip.esi.toLocaleString('en-IN')}</td></tr>
        <tr><td>Professional Tax</td><td>₹${slip.pt.toLocaleString('en-IN')}</td></tr>
        <tr><td>Loss of Pay (${slip.lopDays} day${slip.lopDays===1?'':'s'})</td><td>₹${slip.lopDeduction.toLocaleString('en-IN')}</td></tr>
        <tr><th>Total Deductions</th><th>₹${(slip.deductions+slip.lopDeduction).toLocaleString('en-IN')}</th></tr>
      </tbody></table>
    </div>
    <p style="margin-top:18px;font-size:14px;text-align:right;"><b>Net Pay: ₹${slip.netPay.toLocaleString('en-IN')}</b></p>
    <p style="margin-top:24px;font-size:10.5px;color:#888;">This is a system-generated payslip for training/simulation purposes only and does not constitute an actual financial document.</p>
  </div>`;
  openModal({
    title: `Payslip Preview — ${emp.firstName} ${emp.lastName}`, wide: true,
    body: `<div class="doc-preview-wrap"><div class="doc-scale-62">${html}</div></div>`,
    foot: `<button class="btn btn-outline" id="ps-close">Close</button><button class="btn btn-primary" id="ps-print">&#128438; Print / Save as PDF</button>`
  });
  document.getElementById('ps-close').onclick = closeModal;
  fitDocPreview();
  document.getElementById('ps-print').onclick = () => {
    Store.logDocument('Payslip', empId, `Payslip — ${monthLabel(month)}`);
    closeModal(); printArea(html); toast('✓ Payslip generated', 'success');
  };
}

function exportPayrollCSV() {
  const run = Store.getPayrollRun(_payMonth);
  if (!run) return;
  // Formula worksheet: Basic, DA, HRA, Working Days and LOP Days are given; everything derived is left EMPTY.
  const rows = [['Employee','Department','Gender','Employment Type','Basic','DA','HRA','Conveyance','Medical','Special','Gross','PF','ESI','PT','Working Days','LOP Days','LOP Deduction','Net Pay']];
  run.payslips.forEach(p => {
    const emp = Store.getEmployee(p.empId);
    if (!emp) return; // employee may have since been removed from the system
    rows.push([`${emp.firstName} ${emp.lastName}`, emp.department, emp.gender, emp.employmentType, p.basic, p.da||0, p.hra, '', '', '', '', '', '', '', p.workingDays, p.lopDays, '', '']);
  });
  const q = wsQuestionsSheet(`PAYROLL WORKSHEET \u2014 QUESTIONS  (month ${_payMonth})`, [
    'Work on the "Data" sheet and type each answer in the Your Answer column below. Use Excel formulas \u2014 do not type derived numbers by hand.',
    'Given on the Data sheet: Basic, DA, HRA, Gender, Employment Type, Working Days and LOP Days. Everything else is yours to work out.'
  ], WS_QUESTIONS.pay, WS_QUESTIONS.payRules);
  exportWorkbookXLSX(`payroll-worksheet-${_payMonth}.xlsx`, [
    { name: 'Data', rows, cols: [22, 20, 9, 16, 10, 9, 9, 12, 10, 10, 10, 8, 8, 8, 13, 10, 15, 11] }, q ]);
  Store.logDocument('Payroll Export', 'ALL', `Payroll Export (formula worksheet) — ${_payMonth}`);
}
