/* =========================================================
   bulkmail.js — Bulk Mailings (the simulator's Mail Merge work)
   ---------------------------------------------------------
   Lives inside Correspondence & Drafting as a second tab. Each
   assignment is real office work: HR or Admin needs a batch of
   personalised letters sent out, but first someone has to work
   out WHO qualifies — from the live company data, using Excel —
   before a single letter goes out. Only once the recipient list
   is correct does the merge itself happen, and it happens for
   the whole batch at once, the way a real mail merge does.
   ========================================================= */

const BULKMAIL_STAGE = { PICK: 'pick', VERIFIED: 'verified', DONE: 'done' };

/* criteria(C) -> array of recipient row objects (already carries every merge field it needs) */
const BULKMAIL_ASSIGNMENTS = [
  {
    id: 'bm-increment', title: 'Annual Increment Letters', from: 'meera', role: 'HR Manager',
    audience: 'employee', sheets: ['Employees', 'Increment Policy'],
    brief: `Every employee whose service anniversary falls this month is due their annual increment letter. Pull the Employee Master, work out whose Joining Date anniversary falls in the current month, and use the Increment Policy sheet to work out each person's increment. I need the letters ready to sign off today — Payroll is waiting on them before next month's run.`,
    criteria: (C) => C.E.filter(e => { const j = WD.dt.parse(e.join); return j && j.m === WD.dt.parse(WD.dt.today()).m && WD.dt.datedif(e.join, WD.dt.today(), 'Y') >= 1; })
      .map(e => { const yrs = WD.dt.datedif(e.join, WD.dt.today(), 'Y'); const pct = WD.approxLookup(WD.INCREMENT_POLICY, yrs)[1]; const inc = WD.x.round(e.basic * pct, 0); return { id: e.id, name: `${e.first} ${e.last}`, fields: { FirstName: e.first, LastName: e.last, FullName: `${e.first} ${e.last}`, Designation: e.desig, Department: e.dept, JoiningDate: WD.dt.human(e.join), CompletedYears: String(yrs), IncrementPercent: (pct * 100).toFixed(1) + '%', CurrentBasic: '\u20B9' + e.basic.toLocaleString('en-IN'), IncrementAmount: '\u20B9' + inc.toLocaleString('en-IN'), NewBasic: '\u20B9' + (e.basic + inc).toLocaleString('en-IN') } }; }),
    fields: ['FullName', 'Designation', 'Department', 'JoiningDate', 'CompletedYears', 'IncrementPercent', 'CurrentBasic', 'IncrementAmount', 'NewBasic'],
    subject: 'Revision of Basic Salary',
    template: `Dear {{FirstName}},\n\nWe are pleased to inform you that, in recognition of your {{CompletedYears}} completed year(s) of service and your continued contribution to the {{Department}} department, your annual increment has been approved with effect from the 1st of this month.\n\nYour Basic salary has been revised from {{CurrentBasic}} to {{NewBasic}}, an increase of {{IncrementAmount}} ({{IncrementPercent}}), in line with the Company's increment policy for your service band. This revision will reflect in your next salary credit, along with the corresponding change to your other salary components.\n\nWe would like to take this opportunity to thank you for your continued dedication in your role as {{Designation}}, and we look forward to your ongoing contribution to the organisation.\n\nPlease sign and return the duplicate copy of this letter to HR as acknowledgement.\n\nWith appreciation,`
  },
  {
    id: 'bm-probation', title: 'Probation Confirmation Letters', from: 'rohan', role: 'HR Executive',
    audience: 'employee', sheets: ['Employees'],
    brief: `Probation is 6 months from the joining date. Please identify every employee whose 6-month probation period ends this month and prepare their confirmation letters — Payroll needs to know who is confirmed before they process the next cycle, since it affects their leave entitlement and notice period.`,
    criteria: (C) => C.E.filter(e => e.status === 'Active').filter(e => { const pe = WD.dt.edate(e.join, 6); return WD.dt.parse(pe).y === WD.dt.parse(WD.dt.today()).y && WD.dt.parse(pe).m === WD.dt.parse(WD.dt.today()).m; })
      .map(e => ({ id: e.id, name: `${e.first} ${e.last}`, fields: { FirstName: e.first, LastName: e.last, FullName: `${e.first} ${e.last}`, Designation: e.desig, Department: e.dept, JoiningDate: WD.dt.human(e.join), ProbationEndDate: WD.dt.human(WD.dt.edate(e.join, 6)) } })),
    fields: ['FullName', 'Designation', 'Department', 'JoiningDate', 'ProbationEndDate'],
    subject: 'Confirmation of Appointment',
    template: `Dear {{FirstName}},\n\nWe are pleased to inform you that you have successfully completed your probationary period, which commenced on your date of joining, {{JoiningDate}}, and concluded on {{ProbationEndDate}}.\n\nBased on the satisfactory feedback received from your reporting manager and the {{Department}} department, we are glad to confirm your appointment as {{Designation}} with the Company, with effect from {{ProbationEndDate}}.\n\nAll other terms and conditions of your employment, as detailed in your original offer letter, remain unchanged. We take this opportunity to congratulate you on your confirmation and look forward to your continued contribution to the organisation.\n\nPlease sign and return the duplicate copy of this letter as a token of acceptance.\n\nWith best wishes,`
  },
  {
    id: 'bm-service', title: 'Long-Service Award Letters', from: 'meera', role: 'HR Manager',
    audience: 'employee', sheets: ['Employees', 'Service Award Policy'],
    brief: `We recognise employees on their 3rd, 5th, 8th and 10th service anniversaries with a long-service award. Work out whose service anniversary falls this month AND lands on one of those milestone years, then use the Service Award Policy sheet for the award amount. These letters go out at this month's team meeting, so please have them ready in advance.`,
    criteria: (C) => C.E.filter(e => { const j = WD.dt.parse(e.join); const yrs = WD.dt.datedif(e.join, WD.dt.today(), 'Y'); return j && j.m === WD.dt.parse(WD.dt.today()).m && [3, 5, 8, 10].includes(yrs); })
      .map(e => { const yrs = WD.dt.datedif(e.join, WD.dt.today(), 'Y'); const award = WD.approxLookup(WD.SERVICE_AWARD, yrs)[1]; return { id: e.id, name: `${e.first} ${e.last}`, fields: { FirstName: e.first, LastName: e.last, FullName: `${e.first} ${e.last}`, Designation: e.desig, Department: e.dept, JoiningDate: WD.dt.human(e.join), CompletedYears: String(yrs), AwardAmount: '\u20B9' + award.toLocaleString('en-IN') } }; }),
    fields: ['FullName', 'Designation', 'Department', 'CompletedYears', 'AwardAmount'],
    subject: 'Long Service Recognition Award',
    template: `Dear {{FirstName}},\n\nThis month marks {{CompletedYears}} years since you joined us as {{Designation}} in the {{Department}} department, and we would like to take this opportunity to recognise this important milestone in your career with us.\n\nYour commitment and consistent contribution over the years have not gone unnoticed, and it is our pleasure to present you with a Long Service Award of {{AwardAmount}} in recognition of your {{CompletedYears}} years of dedicated service. This award will be presented to you at this month's team meeting, and the amount will be credited along with your next salary.\n\nOn behalf of the entire organisation, thank you for your continued loyalty and hard work. We look forward to many more years of your association with us.\n\nWarm regards,`
  },
  {
    id: 'bm-attendance', title: 'Attendance Caution Letters', from: 'suresh', role: 'Administration Manager',
    audience: 'employee', sheets: ['Payroll'],
    brief: `This month's payroll run shows a few employees with more than 2 days of Loss-of-Pay. Company policy requires a formal caution letter whenever LOP exceeds 2 days in a month. Please identify who this applies to from the Payroll Register and prepare the letters — these need to go out before month-end along with the payslips.`,
    criteria: (C) => C.PAY.filter(r => r.lopDays > 2).map(r => ({ id: r.empId, name: r.name, fields: { FirstName: r.name.split(' ')[0], FullName: r.name, Department: r.dept, LOPDays: String(r.lopDays), LOPAmount: '\u20B9' + r.lopAmt.toLocaleString('en-IN'), Month: WD.dt.monthName(+((C.payMonth || WD.dt.today().slice(0, 7)).slice(5))) + ' ' + (C.payMonth || WD.dt.today().slice(0, 7)).slice(0, 4) } })),
    fields: ['FullName', 'Department', 'LOPDays', 'LOPAmount', 'Month'],
    subject: 'Irregular Attendance — Formal Caution',
    template: `Dear {{FirstName}},\n\nOur attendance records for {{Month}} show that you were absent without approved leave for {{LOPDays}} day(s) during the month, resulting in a Loss-of-Pay deduction of {{LOPAmount}} from your salary for this period.\n\nRegular and disciplined attendance is essential to the smooth functioning of the {{Department}} department and the organisation as a whole. This letter serves as a formal caution regarding your attendance during {{Month}}. We would like to understand if there were any genuine difficulties that led to this, and we encourage you to discuss the matter with your reporting manager or HR at the earliest.\n\nWe trust this is a one-off matter and expect your attendance to improve going forward. Please treat this communication as strictly confidential.\n\nRegards,`
  },
  {
    id: 'bm-leave', title: 'Year-End Leave Balance Reminders', from: 'rohan', role: 'HR Executive',
    audience: 'employee', sheets: ['Employees', 'Leave Register', 'Leave Policy'],
    brief: `With the leave year closing soon, HR wants a reminder sent to every employee still sitting on more than half of their annual Earned Leave (EL) entitlement, encouraging them to plan their leave before it lapses. Work out each person's EL balance from the Leave Register against the Leave Policy sheet, and prepare the reminders for anyone above that threshold.`,
    criteria: (C) => { const ent = WD.LEAVE_POLICY.entitlement[WD.LEAVE_POLICY.types.indexOf('EL')]; return C.E.filter(e => e.status === 'Active').map(e => { const used = C.LV.filter(l => l.empId === e.id && l.type === 'EL' && l.status === 'Approved').reduce((s, l) => s + l.days, 0); return { e, bal: ent - used }; }).filter(x => x.bal > ent / 2).map(x => ({ id: x.e.id, name: `${x.e.first} ${x.e.last}`, fields: { FirstName: x.e.first, FullName: `${x.e.first} ${x.e.last}`, Department: x.e.dept, ELBalance: String(x.bal), Entitlement: String(ent) } })); },
    fields: ['FullName', 'Department', 'ELBalance', 'Entitlement'],
    subject: 'Reminder — Plan Your Earned Leave Before Year-End',
    template: `Dear {{FirstName}},\n\nAs the leave year draws to a close, our records show that you currently have {{ELBalance}} day(s) of Earned Leave remaining out of your annual entitlement of {{Entitlement}} days.\n\nWe encourage you to plan and avail your pending leave over the coming weeks, in consultation with your reporting manager, to ensure minimum disruption to the {{Department}} department's work. Please note that any leave not availed by the year-end will lapse as per Company policy, unless carried forward is separately approved.\n\nShould you wish to apply for leave, please do so through the Leave Register at the earliest so that your manager has adequate time to plan around your absence.\n\nRegards,`
  },
  {
    id: 'bm-vendor', title: 'Vendor Contract Renewal Notices', from: 'vikram', role: 'Procurement Officer',
    audience: 'vendor', sheets: ['Vendors'],
    brief: `Several vendor contracts are approaching their end date. Company policy requires a formal renewal notice to be sent to any vendor whose Contract End date falls within the next 45 days, so that we have time to renegotiate or find an alternative if needed. Please identify which vendors this applies to and get the notices out this week.`,
    criteria: (C) => { const t = WD.dt.ser(WD.dt.today()); return C.VND.filter(v => { const s = WD.dt.ser(v.end); return s >= t && s <= t + 45; }).map(v => ({ id: v.id, name: v.name, fields: { VendorName: v.name, Category: v.cat, ContactPerson: v.contact, ContractStart: WD.dt.human(v.start), ContractEnd: WD.dt.human(v.end) } })); },
    fields: ['VendorName', 'Category', 'ContactPerson', 'ContractStart', 'ContractEnd'],
    subject: 'Notice of Upcoming Contract Expiry',
    template: `Dear {{ContactPerson}},\n\nThis is to inform you that the contract between {{VendorName}} and our organisation, covering {{Category}} services and running from {{ContractStart}}, is due to expire on {{ContractEnd}}.\n\nWe value our association with {{VendorName}} and would like to initiate a discussion regarding renewal of this contract ahead of the expiry date. We would appreciate it if you could share your updated commercial terms at the earliest, so that both parties have adequate time to review and finalise the renewal, or make alternative arrangements if required.\n\nPlease treat this as a formal notice under the terms of our existing agreement. We look forward to your response at the earliest.\n\nYours faithfully,`
  }
];

function bmMerge(tpl, fields) { return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (fields[k] !== undefined ? fields[k] : m)); }

let _bmOpenId = null;

function bulkmailListHTML() {
  const mailings = Store.getBulkMailings();
  return `
    <div class="card card-pad" style="margin-bottom:22px;">
      <h3 style="margin-bottom:4px;font-size:15px;">Bulk Mailings</h3>
      <p class="text-dim" style="font-size:12.5px;margin-bottom:14px;">Real mail-merge assignments from around the office. You work out who qualifies from the live data using Excel, then the simulator merges your letter across the whole batch at once.</p>
      <div class="doc-type-grid">
        ${BULKMAIL_ASSIGNMENTS.map(a => { const st = (mailings[a.id] || {}).stage; return `
        <div class="doc-type-card" onclick="openBulkMailing('${a.id}')">
          <div class="dt-ic">${a.audience === 'vendor' ? '&#127970;' : '&#128100;'}</div>
          <h4>${escapeHtml(a.title)}</h4>
          <p><span class="badge ${st === 'done' ? 'badge-approved' : st ? 'badge-info' : 'badge-pending'}">${st === 'done' ? 'Completed' : st === 'verified' ? 'List verified' : st === 'pick' ? 'In progress' : 'Not started'}</span></p>
        </div>`; }).join('')}
      </div>
    </div>`;
}

function openBulkMailing(id) {
  _bmOpenId = id;
  const a = BULKMAIL_ASSIGNMENTS.find(x => x.id === id);
  const saved = Store.getBulkMailing(id) || { stage: BULKMAIL_STAGE.PICK, selection: [] };
  const C = WD.buildContext();
  const correct = a.criteria(C);
  const correctIds = new Set(correct.map(r => r.id));
  const allRows = a.audience === 'vendor' ? C.VND.map(v => ({ id: v.id, name: v.name, sub: v.cat })) : C.E.map(e => ({ id: e.id, name: `${e.first} ${e.last}`, sub: e.dept }));

  openModal({
    title: a.title, wide: true,
    body: `
      <div class="card card-pad" style="background:var(--paper-dim);margin-bottom:14px;"><b>From: ${WD_SENDERS[a.from] ? WD_SENDERS[a.from][0] : a.from} (${WD_SENDERS[a.from] ? WD_SENDERS[a.from][1] : a.role})</b><br><span style="font-size:13px;">${escapeHtml(a.brief)}</span></div>
      <div style="margin-bottom:14px;"><button class="btn btn-outline btn-sm" id="bm-dl">&#128190; Download data for this task (.xlsx)</button></div>
      <div id="bm-body"></div>
    `,
    foot: `<button class="btn btn-outline" id="bm-close">Close</button><div id="bm-foot-actions" style="display:inline-flex;gap:8px;"></div>`
  });
  document.getElementById('bm-close').onclick = closeModal;
  document.getElementById('bm-dl').onclick = () => WD.downloadExtract(a.sheets, a.title);
  bmRenderStage(a, saved, allRows, correctIds, correct);
}

function bmRenderStage(a, saved, allRows, correctIds, correct) {
  const body = document.getElementById('bm-body');
  const foot = document.getElementById('bm-foot-actions');
  const stage = saved.stage || BULKMAIL_STAGE.PICK;
  const sel = new Set(saved.selection || []);

  if (stage === BULKMAIL_STAGE.PICK) {
    body.innerHTML = `
      <p style="font-size:13px;margin-bottom:8px;"><b>Step 1 — Who qualifies?</b> Tick everyone you have determined, from the exported sheet, meets the criteria in the message above. There ${allRows.length === 1 ? 'is' : 'are'} ${allRows.length} ${a.audience === 'vendor' ? 'vendors' : 'employees'} in total to check.</p>
      <div style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px;">
        ${allRows.map(r => `<label style="display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:13px;border-bottom:1px solid var(--border-dim,#eee);">
          <input type="checkbox" class="bm-chk" value="${r.id}" ${sel.has(r.id) ? 'checked' : ''}>
          <span style="flex:1;">${escapeHtml(r.name)}</span><span style="color:var(--text-dim);font-size:11.5px;">${escapeHtml(r.sub || '')}</span>
        </label>`).join('')}
      </div>
      <div id="bm-verify-result" style="margin-top:10px;font-size:12.5px;"></div>
    `;
    foot.innerHTML = `<button class="btn btn-primary" id="bm-verify">Verify Recipient List</button>`;
    document.getElementById('bm-verify').onclick = () => {
      const picked = Array.from(document.querySelectorAll('.bm-chk:checked')).map(el => el.value);
      const pickedSet = new Set(picked);
      const missing = [...correctIds].filter(id => !pickedSet.has(id)).length;
      const extra = picked.filter(id => !correctIds.has(id)).length;
      const ok = missing === 0 && extra === 0;
      Store.saveBulkMailing(a.id, { stage: ok ? BULKMAIL_STAGE.VERIFIED : BULKMAIL_STAGE.PICK, selection: picked });
      const rp = document.getElementById('bm-verify-result');
      if (ok) {
        rp.innerHTML = `<span style="color:var(--success,#1a8a4a);font-weight:600;">&#10003; Correct — ${correct.length} ${a.audience === 'vendor' ? 'vendor(s)' : 'employee(s)'} qualify. Continuing to the letter...</span>`;
        setTimeout(() => bmRenderStage(a, Store.getBulkMailing(a.id), allRows, correctIds, correct), 500);
      } else {
        rp.innerHTML = `<span style="color:var(--danger,#c0392b);">Not quite — ${missing ? missing + ' who should be on the list ' + (missing === 1 ? 'is' : 'are') + ' missing. ' : ''}${extra ? extra + ' selected shouldn\u2019t qualify.' : ''} Recheck the criteria against the data and try again.</span>`;
      }
    };
    return;
  }

  /* Stage 2 (verified) or 3 (done) — template + merge + generate */
  const sample = correct[0];
  body.innerHTML = `
    ${stage === BULKMAIL_STAGE.DONE ? `<div class="card card-pad" style="background:var(--paper-dim);margin-bottom:10px;font-size:12.5px;">&#10003; Already generated on ${fmtDate(saved.completedOn || todayISO())}. You can edit and re-generate if needed.</div>` : ''}
    <p style="font-size:13px;margin-bottom:8px;"><b>Step 2 — Draft the letter.</b> Recipient list confirmed (${correct.length} ${a.audience === 'vendor' ? 'vendor(s)' : 'people'}). Edit the body if you like — the highlighted merge fields will be replaced automatically for every recipient. Available fields: ${a.fields.map(f => `<code>{{${f}}}</code>`).join(', ')}.</p>
    <div class="field"><label>Subject</label><input id="bm-subject" value="${escapeHtml(saved.subject || a.subject)}"></div>
    <div class="field"><label>Letter Body</label><textarea id="bm-tpl" style="min-height:260px;font-family:var(--font-mono);font-size:12.5px;">${escapeHtml(saved.template || a.template)}</textarea></div>
    <div style="margin-top:12px;">
      <button class="btn btn-outline btn-sm" id="bm-preview">Preview for ${escapeHtml(sample ? sample.name : 'first recipient')}</button>
    </div>
    <div id="bm-preview-panel" style="margin-top:12px;"></div>
  `;
  foot.innerHTML = `<button class="btn btn-outline" id="bm-back">Back to Recipient List</button><button class="btn btn-primary" id="bm-generate">Generate &amp; Print All ${correct.length} Letters</button>`;

  document.getElementById('bm-back').onclick = () => { Store.saveBulkMailing(a.id, { stage: BULKMAIL_STAGE.PICK }); bmRenderStage(a, Store.getBulkMailing(a.id), allRows, correctIds, correct); };
  document.getElementById('bm-preview').onclick = () => {
    if (!sample) return;
    const tpl = document.getElementById('bm-tpl').value;
    document.getElementById('bm-preview-panel').innerHTML = `<div class="card card-pad" style="white-space:pre-wrap;font-size:12.5px;background:var(--paper-dim);">${escapeHtml(bmMerge(tpl, sample.fields))}</div>`;
  };
  document.getElementById('bm-generate').onclick = () => {
    const subject = document.getElementById('bm-subject').value;
    const tpl = document.getElementById('bm-tpl').value;
    Store.saveBulkMailing(a.id, { stage: BULKMAIL_STAGE.DONE, subject, template: tpl, completedOn: todayISO() });
    closeModal();
    bmPrintBatch(a, correct, subject, tpl);
    toast(`✓ ${correct.length} personalised letters generated for "${a.title}"`, 'success');
    navigate('correspondence');
  };
}

function bmPrintBatch(a, recipients, subject, tpl) {
  const meta = Store.load().meta;
  const co = escapeHtml(meta.institution);
  const pages = recipients.map(r => `
    <div class="doc-page" style="page-break-after:always;">
      <div class="doc-watermark"><span>${co.toUpperCase()}</span></div>
      ${letterheadHTML('Office Correspondence')}
      <div class="doc-ref-row"><span>To: ${escapeHtml(r.name)}${a.audience === 'vendor' ? '' : ' (' + escapeHtml(r.fields.Department || '') + ')'}</span><span>Date: ${fmtDate(todayISO())}</span></div>
      <div class="doc-title">${escapeHtml(bmMerge(subject, r.fields)).toUpperCase()}</div>
      <div style="white-space:pre-wrap;font-size:12.5px;line-height:1.9;">${escapeHtml(bmMerge(tpl, r.fields))}\n\nFor ${co}</div>
    </div>`).join('');
  printArea(`<div id="doc-render-target">${pages}</div>`);
}
