/* =========================================================
   correspondence.js — Correspondence & Drafting (General Office Skills)
   New module: lets a student draft, self-check and finalize the everyday
   written-communication documents a real office produces day to day —
   Business Letters, Office Memos, Circulars and Emails — as distinct from
   the Document Center, which only fills in ready-made HR letter templates.
   ========================================================= */

const CORRESPONDENCE_TYPES = ['Business Letter', 'Office Memo', 'Circular', 'Email'];

/* Blank starting skeleton per type, inserted into the body textarea so a
   student is never staring at a fully empty box and learns the correct
   layout/convention for each type by filling in the blanks themselves. */
const CORRESPONDENCE_SKELETONS = {
  'Business Letter': `Date: \n\nTo,\n[Recipient Name]\n[Recipient Designation / Company]\n[Address]\n\nSubject: \n\nDear Sir/Madam,\n\n[Opening — state the purpose of writing]\n\n[Body — details, facts, or requests]\n\n[Closing — desired action or conclusion]\n\nYours faithfully,\n[Your Name]\n[Your Designation]`,
  'Office Memo': `TO: \nFROM: \nDATE: \nSUBJECT: \n\n[Body of the memo — state the purpose, the details, and any action required, in short direct paragraphs]`,
  'Circular': `Circular No: \nDate: \n\nTo: All Staff / All Departments\n\nSubject: \n\n[Body of the circular — the announcement and any effective date or instruction]\n\nBy Order,\n[Name / Department]`,
  'Email': `Subject: \n\nHi [Name],\n\n[Opening line]\n\n[Body — details or request]\n\nBest regards,\n[Your Name]\n[Your Designation]`
};

/* Curated practice prompts. Each ties to one real-office scenario (several
   deliberately reuse the AS Group of Industries case study) with a model
   answer and a short list of self-check points a student's draft should
   hit. This is a *self-check*, not real grading — it just keyword-matches
   against a few phrasings per point, so a covered point is a hint, not proof,
   and a missed one is worth a second look rather than an automatic fail. */
const CORRESPONDENCE_EXERCISES = [
  {
    id: 'ex-timings',
    type: 'Circular',
    title: 'Revised Office Timings',
    scenario: 'AS Group of Industries is shifting its Mumbai head-office timings from 9:30 AM–6:30 PM to 9:00 AM–6:00 PM, effective the 1st of next month, to align better with client time zones. Draft a circular informing all staff.',
    points: [
      { label: 'States the new timing clearly', kw: ['9:00', '9 am', '9.00'] },
      { label: 'Gives an effective date', kw: ['effective', 'with effect from', 'w.e.f'] },
      { label: 'Addressed to all staff / all departments', kw: ['all staff', 'all employees', 'all departments'] },
      { label: 'Gives a reason or context', kw: ['client', 'time zone', 'align'] },
      { label: 'Signed off by an authority', kw: ['hr department', 'administration department', 'human resources', 'admin department'] }
    ],
    modelAnswer: `Circular No: ASG/ADMIN/2026/014\nDate: 18-Sep-2026\n\nTo: All Staff / All Departments\n\nSubject: Revision of Office Timings\n\nThis is to inform all employees that, effective 1st October 2026, the office timings for the Mumbai head office will change from the current 9:30 AM – 6:30 PM to 9:00 AM – 6:00 PM.\n\nThis change has been made to better align our working hours with client time zones across our international operations. All employees are requested to plan their commute accordingly and ensure adherence to the revised timings from the effective date.\n\nAny queries regarding this circular may be directed to the HR Department.\n\nBy Order,\nHuman Resources Department\nAS Group of Industries`
  },
  {
    id: 'ex-vendor',
    type: 'Business Letter',
    title: 'Complaint to a Vendor',
    scenario: 'Your stationery vendor, Om Traders, delivered the monthly office-supplies order 12 days late, disrupting work across departments. Draft a formal letter of complaint requesting an explanation and an assurance it will not recur.',
    points: [
      { label: 'References the specific order/delay', kw: ['12 days', 'delay', 'late'] },
      { label: 'States the impact of the delay', kw: ['disrupt', 'affected', 'inconvenience'] },
      { label: 'Requests an explanation', kw: ['explain', 'reason for', 'clarify'] },
      { label: 'Asks for assurance against recurrence', kw: ['not recur', 'future orders', 'ensure this', 'going forward'] },
      { label: 'Professional but firm closing', kw: ['yours faithfully', 'regards'] }
    ],
    modelAnswer: `Date: 18-Sep-2026\n\nTo,\nThe Manager\nOm Traders\nMumbai\n\nSubject: Delay in Delivery of Monthly Office Supplies Order\n\nDear Sir/Madam,\n\nWe wish to bring to your attention that our monthly office-supplies order, due on the 1st of this month, was delivered 12 days late. This delay disrupted routine work across several departments that depend on timely stationery supply.\n\nWe request you to explain the reason for this delay and provide an assurance that future orders will be delivered strictly as per the agreed schedule. Continued delays will compel us to review our vendor arrangement.\n\nWe trust you will treat this matter with urgency and look forward to your prompt response.\n\nYours faithfully,\nAdministration Department\nAS Group of Industries`
  },
  {
    id: 'ex-expense',
    type: 'Office Memo',
    title: 'Reminder — Monthly Expense Reports',
    scenario: 'Several departments have not submitted their monthly expense reports to Accounts & Finance for two months running. Draft an internal memo reminding all Department Heads to submit by the 5th of every month.',
    points: [
      { label: 'Addressed to Department Heads', kw: ['department head', 'all heads', 'all managers'] },
      { label: 'States the submission deadline', kw: ['5th', 'fifth'] },
      { label: 'Names the receiving department', kw: ['accounts', 'finance'] },
      { label: 'Notes the recurring lapse / consequence', kw: ['two months', 'repeated', 'delay in processing', 'reimbursement'] }
    ],
    modelAnswer: `TO: All Department Heads\nFROM: Accounts & Finance Department\nDATE: 18-Sep-2026\nSUBJECT: Timely Submission of Monthly Expense Reports\n\nIt has been observed that several departments have not submitted their monthly expense reports to Accounts & Finance for the past two months, which is delaying reconciliation and reimbursement processing.\n\nAll Department Heads are requested to ensure their respective monthly expense reports are submitted to Accounts & Finance by the 5th of every month without fail. Continued delays may affect the timely processing of reimbursements for your teams.\n\nYour cooperation is appreciated.`
  },
  {
    id: 'ex-client',
    type: 'Email',
    title: 'Reply to a Client Enquiry',
    scenario: 'A client, Mr. Ramesh Iyer of Orion Logistics, has emailed asking whether your team is available for a meeting this Friday at 3 PM. Draft a professional email reply confirming, or proposing an alternative.',
    points: [
      { label: 'Greets the client by name', kw: ['dear mr', 'hi ramesh', 'hello mr'] },
      { label: 'Directly confirms or proposes an alternative time', kw: ['friday', 'confirm', 'available', 'alternative', 'instead'] },
      { label: 'Mentions the meeting mode/venue', kw: ['office', 'call', 'video', 'meet'] },
      { label: 'Professional sign-off', kw: ['regards', 'best regards', 'sincerely'] }
    ],
    modelAnswer: `Subject: Re: Meeting Request — Friday 3 PM\n\nDear Mr. Iyer,\n\nThank you for reaching out. This Friday at 3 PM works well for us — we would be glad to meet at our Mumbai office, or over a video call, whichever is more convenient for you.\n\nPlease confirm your preference and we will send across the invite accordingly.\n\nLooking forward to speaking with you.\n\nBest regards,\nAditi Rao\nFront Office Executive, AS Group of Industries`
  },
  {
    id: 'ex-townhall',
    type: 'Circular',
    title: 'Annual Town Hall Announcement',
    scenario: 'AS Group of Industries is holding its Annual Town Hall next month at the Crystal Towers auditorium, Mumbai. Draft a circular inviting all staff and giving the logistics.',
    points: [
      { label: 'Gives a date and time', kw: ['am', 'pm'] },
      { label: 'Names the venue', kw: ['crystal towers', 'auditorium'] },
      { label: 'States who should attend', kw: ['all staff', 'all employees', 'mandatory', 'invited'] },
      { label: 'Gives an RSVP or registration instruction', kw: ['rsvp', 'confirm attendance', 'register'] }
    ],
    modelAnswer: `Circular No: ASG/HR/2026/031\nDate: 18-Sep-2026\n\nTo: All Staff\n\nSubject: Annual Town Hall — Save the Date\n\nWe are pleased to announce that the AS Group of Industries Annual Town Hall will be held on 10th October 2026 at 4:00 PM at the Crystal Towers Auditorium, Mumbai.\n\nAll employees are invited and encouraged to attend this important session, which will cover the year's achievements and the roadmap ahead. Kindly confirm your attendance with your reporting manager by 3rd October 2026.\n\nWe look forward to seeing everyone there.\n\nBy Order,\nHuman Resources Department`
  },
  {
    id: 'ex-thankyou',
    type: 'Business Letter',
    title: 'Thank-You Letter to a Guest Speaker',
    scenario: 'Dr. Meena Kapoor recently delivered a guest lecture on Workplace Ethics at your training institute. Draft a formal thank-you letter on behalf of the institute.',
    points: [
      { label: 'Names the speaker', kw: ['dr. meena', 'dr meena', 'ms. kapoor'] },
      { label: 'Names the topic of the talk', kw: ['workplace ethics', 'ethics'] },
      { label: 'Expresses genuine gratitude', kw: ['thank you', 'grateful', 'appreciate'] },
      { label: 'Mentions the impact on students/attendees', kw: ['students', 'benefited', 'valuable', 'insight'] }
    ],
    modelAnswer: `Date: 18-Sep-2026\n\nTo,\nDr. Meena Kapoor\n\nSubject: Thank You for the Guest Lecture on Workplace Ethics\n\nDear Dr. Kapoor,\n\nOn behalf of the institute, we would like to express our sincere gratitude for taking the time to deliver such an insightful guest lecture on Workplace Ethics for our students.\n\nYour real-world examples and practical guidance were extremely valuable, and our students have benefited greatly from your perspective. We hope to have the opportunity to host you again in the future.\n\nThank you once again for your time and generosity.\n\nYours faithfully,\nTraining Coordinator`
  },
  {
    id: 'ex-lop-memo',
    type: 'Office Memo',
    title: 'LOP Memo to the Managing Director',
    scenario: 'This one starts before you write a word. Go to Payroll → run or review this month\'s payroll for all employees and check the LOP (Loss of Pay) Days column. If nobody shows an LOP day yet, first mark one day of Loss of Pay for any employee (Attendance or Leave) and re-run payroll — see Unit 6\'s Challenge Task if you need the steps. Using the real employee name(s) and LOP day count from your own payroll run, draft an internal Office Memo to the Managing Director stating: who had Loss of Pay this month, how many days, the resulting effect on their Net Pay, and one suggestion to reduce repeat LOP going forward.',
    points: [
      { label: 'States "Loss of Pay" or "LOP" specifically', kw: ['loss of pay', 'lop'] },
      { label: 'Gives a specific day count', kw: ['day'] },
      { label: 'Mentions the Net Pay / salary impact', kw: ['net pay', 'salary', 'deduct', 'gross'] },
      { label: 'Gives a suggestion to reduce recurrence', kw: ['going forward', 'recommend', 'suggest', 'avoid', 'prevent', 'ensure'] },
      { label: 'Addressed to the Managing Director', kw: ['managing director', 'md,', 'dear md', 'to: md', 'to: managing director'] }
    ],
    modelAnswer: `TO: Managing Director\nFROM: HR Department\nDATE: 18-Sep-2026\nSUBJECT: Loss of Pay (LOP) Summary — This Month\n\nThis is to bring to your notice that [Employee Name] recorded [X] day(s) of Loss of Pay this month, which has reduced their Net Pay accordingly for the period.\n\nTo reduce repeat occurrences, it is recommended that reporting managers review attendance more closely during the month and encourage employees to file leave applications in advance rather than take unplanned absences.\n\nPlease let us know if any further action is required from HR's side.`
  }
];

let _corrFilterType = '';

Modules.correspondence = function(container) {
  const items = Store.getCorrespondence();
  const filtered = _corrFilterType ? items.filter(c => c.type === _corrFilterType) : items;
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Correspondence &amp; Drafting</h1><p class="desc">Practice writing the everyday documents a real office produces — Business Letters, Office Memos, Circulars and Emails — then self-check and finalize them on your simulated company's letterhead.</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openCorrespondenceForm()">+ Blank Draft</button></div>
    </div>

    ${bulkmailListHTML()}

    <div class="card card-pad" style="margin-bottom:22px;">
      <h3 style="margin-bottom:4px;font-size:15px;">Practice Exercises</h3>
      <p class="text-dim" style="font-size:12.5px;margin-bottom:14px;">Pick a real-office scenario. Your draft is self-checked against a short list of points a good answer should cover, then compared with a model answer.</p>
      <div class="doc-type-grid">
        ${CORRESPONDENCE_EXERCISES.map(ex => `<div class="doc-type-card" onclick="openCorrespondenceForm(null,'${ex.id}')">
          <div class="dt-ic">${corrIcon(ex.type)}</div>
          <h4>${escapeHtml(ex.title)}</h4>
          <p><span class="badge badge-info">${escapeHtml(ex.type)}</span></p>
        </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Your Correspondence</h3>
        <select id="corr-filter" style="max-width:180px;">
          <option value="">All Types</option>
          ${CORRESPONDENCE_TYPES.map(t => `<option ${t===_corrFilterType?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="card-pad" style="padding-top:6px;">
        ${filtered.length === 0 ? `<div class="empty-state"><div class="ic">&#128221;</div><h4>Nothing drafted yet</h4><p>Choose a practice exercise above, or start a blank draft.</p></div>` : `
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Title</th><th>Type</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>${filtered.map(c => `<tr>
            <td>${escapeHtml(c.title)}</td>
            <td><span class="badge badge-info">${escapeHtml(c.type)}</span></td>
            <td>${fmtDate(c.date || c.createdOn)}</td>
            <td><span class="badge ${c.status==='Finalized'?'badge-approved':'badge-pending'}">${c.status}</span></td>
            <td style="white-space:nowrap;">
              <button class="btn btn-outline btn-sm" onclick="openCorrespondenceForm('${c.id}')">Open</button>
              <button class="icon-action danger" onclick="deleteCorrespondenceConfirm('${c.id}')">&#128465;</button>
            </td>
          </tr>`).join('')}</tbody>
        </table></div>`}
      </div>
    </div>
  `;
  const filterEl = document.getElementById('corr-filter');
  if (filterEl) filterEl.onchange = (e) => { _corrFilterType = e.target.value; navigate('correspondence'); };
};

function corrIcon(type) {
  return { 'Business Letter': '&#128196;', 'Office Memo': '&#128203;', 'Circular': '&#128227;', 'Email': '&#128231;' }[type] || '&#128221;';
}

/* id = existing draft to reopen; exerciseId = start fresh from a practice prompt */
function openCorrespondenceForm(id, exerciseId) {
  const existing = id ? Store.getCorrespondenceItem(id) : null;
  const exercise = exerciseId ? CORRESPONDENCE_EXERCISES.find(e => e.id === exerciseId) : (existing && existing.exerciseId ? CORRESPONDENCE_EXERCISES.find(e => e.id === existing.exerciseId) : null);
  const type = existing ? existing.type : (exercise ? exercise.type : 'Business Letter');
  const meta = Store.load().meta;

  openModal({
    title: existing ? `${existing.type} — ${existing.title}` : (exercise ? `New Draft — ${exercise.title}` : 'New Blank Draft'),
    wide: true,
    body: `
      ${exercise ? `<div class="card card-pad" style="background:var(--paper-dim);margin-bottom:16px;"><b>Scenario:</b> ${escapeHtml(exercise.scenario)}</div>` : ''}
      <div class="form-grid" style="grid-template-columns:1fr 1fr;">
        <div class="field"><label>Type</label>
          <select id="cf-type" ${exercise ? 'disabled' : ''}>${CORRESPONDENCE_TYPES.map(t => `<option ${t===type?'selected':''}>${t}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Title <span class="req">*</span></label><input id="cf-title" value="${escapeHtml(existing ? existing.title : (exercise ? exercise.title : ''))}" placeholder="A short name for your reference"></div>
        <div class="field"><label>Date</label><input type="date" id="cf-date" value="${existing ? (existing.date||todayISO()) : todayISO()}"></div>
        <div class="field"><label>To / Recipient</label><input id="cf-to" value="${escapeHtml(existing ? existing.to||'' : '')}" placeholder="e.g. All Staff, or a name"></div>
        <div class="field span-2"><label>Your Draft</label>
          <textarea id="cf-body" style="min-height:260px;font-family:var(--font-mono);font-size:12.5px;">${escapeHtml(existing ? existing.body : (exercise ? '' : CORRESPONDENCE_SKELETONS[type]))}</textarea>
          <div class="helptext">${exercise ? 'Start from the blank box above using the scenario — or switch Type off to load a blank skeleton.' : 'Fill in the bracketed placeholders and delete the instructions as you go.'}</div>
        </div>
      </div>
      <div id="cf-check-panel" style="margin-top:14px;"></div>
    `,
    foot: `
      <button class="btn btn-outline" id="cf-cancel">Close</button>
      ${exercise ? `<button class="btn btn-outline" id="cf-selfcheck">Self-Check My Draft</button>` : ''}
      <button class="btn btn-outline" id="cf-savedraft">Save as Draft</button>
      <button class="btn btn-primary" id="cf-finalize">Finalize &amp; Preview</button>
    `
  });

  document.getElementById('cf-cancel').onclick = closeModal;
  if (!exercise) {
    document.getElementById('cf-type').onchange = (e) => {
      const ta = document.getElementById('cf-body');
      if (!ta.value.trim() || Object.values(CORRESPONDENCE_SKELETONS).includes(ta.value)) ta.value = CORRESPONDENCE_SKELETONS[e.target.value];
    };
  }

  if (exercise) {
    document.getElementById('cf-selfcheck').onclick = () => {
      const text = document.getElementById('cf-body').value.toLowerCase();
      const results = exercise.points.map(p => ({ label: p.label, hit: p.kw.some(k => text.includes(k)) }));
      const hitCount = results.filter(r => r.hit).length;
      document.getElementById('cf-check-panel').innerHTML = `
        <div class="card card-pad">
          <h3 style="font-size:13.5px;margin-bottom:10px;">Self-Check — ${hitCount}/${results.length} points found</h3>
          ${results.map(r => `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;font-size:12.5px;">
            <span class="badge ${r.hit?'badge-approved':'badge-pending'}">${r.hit ? '✓' : '?'}</span>
            <span>${escapeHtml(r.label)}</span>
          </div>`).join('')}
          <p class="text-dim" style="font-size:11.5px;margin-top:10px;">This is a keyword self-check, not a grade — a point marked "?" may still be covered in different words. Read it back yourself, then compare with the model answer after finalizing.</p>
        </div>`;
    };
  }

  document.getElementById('cf-savedraft').onclick = () => {
    const data = collectCorrespondenceForm(exercise, exerciseId, existing);
    if (!data) return;
    if (existing) Store.updateCorrespondence(existing.id, { ...data, status: 'Draft' });
    else Store.addCorrespondence({ ...data, status: 'Draft' });
    closeModal(); toast('Draft saved', 'success'); navigate('correspondence');
  };

  document.getElementById('cf-finalize').onclick = () => {
    const data = collectCorrespondenceForm(exercise, exerciseId, existing);
    if (!data) return;
    const saved = existing ? Store.updateCorrespondence(existing.id, { ...data, status: 'Finalized' }) : Store.addCorrespondence({ ...data, status: 'Finalized' });
    closeModal();
    previewCorrespondence(saved, exercise);
  };
}

function collectCorrespondenceForm(exercise, exerciseId, existing) {
  const title = document.getElementById('cf-title').value.trim();
  if (!title) { toast('Title is required', 'error'); return null; }
  return {
    type: exercise ? exercise.type : document.getElementById('cf-type').value,
    exerciseId: exercise ? exercise.id : (exerciseId || (existing ? existing.exerciseId : null)),
    title,
    to: document.getElementById('cf-to').value.trim(),
    date: document.getElementById('cf-date').value,
    body: document.getElementById('cf-body').value
  };
}

function deleteCorrespondenceConfirm(id) {
  confirmAction('Delete this draft/correspondence?', () => { Store.deleteCorrespondence(id); toast('Deleted', 'success'); navigate('correspondence'); });
}

function previewCorrespondence(item, exercise) {
  const meta = Store.load().meta;
  const co = escapeHtml(meta.institution);
  const isEmail = item.type === 'Email';
  const docHtml = `<div class="doc-page" id="doc-render-target">
    <div class="doc-watermark"><span>${co.toUpperCase()}</span></div>
    ${letterheadHTML(item.type === 'Circular' ? 'Circular' : item.type === 'Office Memo' ? 'Office Memorandum' : item.type === 'Email' ? 'Correspondence' : 'Office Correspondence')}
    ${isEmail ? `<div class="doc-ref-row"><span>To: ${escapeHtml(item.to||'—')}</span><span>Date: ${fmtDate(item.date||todayISO())}</span></div>`
              : `<div class="doc-ref-row"><span>${item.to ? 'To: ' + escapeHtml(item.to) : ''}</span><span>Date: ${fmtDate(item.date||todayISO())}</span></div>`}
    ${!isEmail ? `<div class="doc-title">${item.type.toUpperCase()}</div>` : ''}
    <div style="white-space:pre-wrap;font-size:12.5px;line-height:1.9;">${escapeHtml(item.body)}</div>
    ${item.type !== 'Email' ? `<div class="doc-signoff">
      <div class="sig-block"><div class="sig-line"></div>Prepared By</div>
      <div class="sig-block"><div class="sig-line"></div>For ${co}<br>Authorized Signatory</div>
    </div>` : ''}
  </div>`;

  const modelHtml = exercise ? `<div style="margin-top:22px;"><h3 style="font-size:14px;margin-bottom:8px;">Model Answer (for comparison)</h3>
    <div class="card card-pad" style="white-space:pre-wrap;font-size:12px;font-family:var(--font-mono);background:var(--paper-dim);">${escapeHtml(exercise.modelAnswer)}</div></div>` : '';

  openModal({
    title: `${item.title} — Preview`, wide: true,
    body: `<div class="doc-preview-wrap"><div class="doc-scale-62">${docHtml}</div></div>${modelHtml}`,
    foot: `<button class="btn btn-outline" id="cv-close">Close</button><button class="btn btn-primary" id="cv-print">&#128438; Print / Save as PDF</button>`
  });
  document.getElementById('cv-close').onclick = closeModal;
  fitDocPreview();
  document.getElementById('cv-print').onclick = () => {
    closeModal();
    printArea(docHtml);
    toast(`✓ ${item.type} finalized`, 'success');
  };
}
