/* ============================================================
   TCOS TRAINING SIMULATOR — TRAINING LAYER
   Level System · Knowledge Panel · Certificate · Job Simulator ·
   Trainer Console · Error Resolution Lab · Compliance Lab
   ============================================================ */

function getScenarioById(id) { return SCENARIOS.find(s => s.id === id); }
function getJobTrack(key) { return JOB_TRACKS[key]; }

/* ---------------- TRAINING LEVEL SYSTEM (Section 32) ---------------- */
const TRAINING_LEVELS = [
  { id: 1, name: 'Documentation Beginner', min: 0, avg: 0 },
  { id: 2, name: 'EXIM Executive', min: 2, avg: 50 },
  { id: 3, name: 'Customs Operations Executive', min: 4, avg: 65 },
  { id: 4, name: 'Freight Forwarding Executive', min: 4, avg: 65, freight: 1 },
  { id: 5, name: 'Senior Logistics Operations', min: 8, avg: 80, freight: 2 }
];
function trainingStats() {
  const a = STATE.assessments;
  const completed = a.length;
  const avg = completed ? Math.round(a.reduce((s, r) => s + r.total, 0) / completed) : 0;
  const freightDone = STATE.bookings.filter(b => b.status === 'COMPLETED').length;
  return { completed, avg, freightDone };
}
function computeCurrentLevel() {
  const st = trainingStats();
  let level = TRAINING_LEVELS[0];
  TRAINING_LEVELS.forEach(l => {
    if (st.completed >= l.min && st.avg >= l.avg && st.freightDone >= (l.freight || 0)) level = l;
  });
  return { level, stats: st };
}
function nextLevelInfo() {
  const { level } = computeCurrentLevel();
  return TRAINING_LEVELS.find(l => l.id === level.id + 1) || null;
}

/* ---------------- KNOWLEDGE PANEL (Section 50) ---------------- */
const KNOWLEDGE_PANEL = [
  { key: 'sb', title: 'Shipping Bill', what: 'The primary export customs declaration filed electronically before goods leave India.', who: 'Prepared by the exporter or their Customs Broker (CHA).', why: 'Declares export cargo details to Customs so a Let Export Order can be issued.', when: 'Before the cargo is loaded / gated in at the port.', errors: ['Wrong HS code', 'Wrong FOB value', 'Incorrect consignee details', 'Missing supporting document'] },
  { key: 'boe', title: 'Bill of Entry', what: 'The primary import customs declaration filed to clear goods into India.', who: 'Prepared by the importer or their Customs Broker (CHA).', why: 'Declares imported cargo for assessment of duty and clearance.', when: 'On or before arrival of the vessel/aircraft carrying the goods.', errors: ['Wrong assessable value', 'Wrong classification (HS code)', 'Missing PGA clearance', 'BL/AWB number mismatch'] },
  { key: 'igm', title: 'Import General Manifest (IGM)', what: 'A manifest filed by the shipping line / airline listing all cargo arriving on a vessel or flight.', who: 'Filed by the carrier or their agent, not the importer.', why: 'Allows Customs to cross-check every Bill of Entry against actual arriving cargo.', when: 'Before or on arrival of the conveyance.', errors: ['BL number mismatch with Bill of Entry', 'Incorrect package/weight count', 'Late filing'] },
  { key: 'egm', title: 'Export General Manifest (EGM)', what: 'A manifest filed by the carrier confirming cargo actually loaded for export.', who: 'Filed by the carrier or their agent after loading.', why: 'Closes out the Shipping Bill and confirms the export actually took place — required for export benefit claims.', when: 'After the vessel/aircraft departs.', errors: ['Shipping Bill not linked correctly', 'Container/seal mismatch', 'Late filing delaying export incentive claims'] },
  { key: 'query', title: 'Customs Query', what: 'A formal request from Customs for clarification, correction, or an additional document on a filing.', who: 'Raised by the assessing officer / system; answered by the exporter, importer, or broker.', why: 'Resolves doubts (classification, value, documentation) before the filing can proceed.', when: 'Any time after submission and before final clearance.', errors: ['Vague or incomplete reply', 'Missing the requested supporting document', 'Late reply causing detention charges'] },
  { key: 'exam', title: 'Examination', what: 'Physical or documentary inspection of cargo by a Customs examining officer.', who: 'Conducted by Customs; the exporter/importer/broker responds to any finding.', why: 'Verifies that the goods match what was declared.', when: 'Before Let Export Order (export) or before Out of Charge (import), when selected by RMS or on suspicion.', errors: ['Weight/quantity mismatch not explained', 'Description mismatch not corrected', 'Ignoring a discrepancy instead of amending'] },
  { key: 'assess', title: 'Assessment', what: 'The Customs process of determining classification, valuation, and applicable duty on an import.', who: 'Done by the assessing officer (or self-assessed by the importer, subject to verification).', why: 'Fixes the legal duty liability for the consignment.', when: 'After Bill of Entry filing, before duty payment.', errors: ['Under-valuation', 'Wrong tariff heading used', 'Missed applicable exemption/FTA benefit'] },
  { key: 'duty', title: 'Duty & Payment', what: 'The customs duty (BCD, SWS, IGST etc.) payable on an assessed import.', who: 'Paid by the importer or their broker.', why: 'Duty must be paid before Out of Charge is granted.', when: 'Immediately after assessment.', errors: ['Payment method failure not retried', 'Wrong duty amount referenced', 'Payment not linked to correct Bill of Entry'] },
  { key: 'amend', title: 'Amendment', what: 'A formal correction to an already-submitted filing.', who: 'Requested by the exporter/importer/broker, approved by Customs.', why: 'Fixes an error without needing to cancel and re-file from scratch.', when: 'After submission, whenever an error is discovered.', errors: ['No supporting document attached', 'Reason not clearly stated', 'Amending the wrong field'] },
  { key: 'leo-ooc', title: 'LEO & Out of Charge (OOC)', what: 'LEO (Let Export Order) permits export cargo to be loaded; OOC releases import cargo to the importer.', who: 'Issued by Customs once all checks are cleared.', why: 'The final clearance milestone in each workflow.', when: 'After assessment/examination/query/duty steps are all resolved.', errors: ['Assuming clearance before OOC/LEO is actually issued', 'Missing a pending query that blocks issue'] },
  { key: 'vgm', title: 'Verified Gross Mass (VGM)', what: 'A mandatory declaration of the verified weight of a container before it can be loaded on a vessel.', who: 'Declared by the shipper (exporter) or their agent.', why: 'SOLAS requirement — vessels cannot load a container without a valid VGM.', when: 'Before the port cut-off, ahead of vessel loading.', errors: ['Missed cut-off', 'Weighing method not stated', 'VGM not matching declared cargo weight'] },
  { key: 'bl-awb', title: 'Bill of Lading / Air Waybill', what: 'The transport document issued by the carrier — a BL for sea freight, an AWB for air freight.', who: 'Issued by the shipping line/airline (or their agent) based on Shipping Instructions from the shipper.', why: 'Evidences the contract of carriage and (for a BL) can be a document of title.', when: 'Draft issued after Shipping Instructions; final issued after loading.', errors: ['Draft not reviewed before final issue', 'Consignee/notify party details wrong', 'Weight/measurement mismatch with the booking'] }
];
function renderKnowledgePanel() {
  const host = $('#screen-knowledge');
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Training</div><h1>Knowledge Panel</h1></div></div>
  <p class="hint">Educational reference only — not legal or regulatory advice. Verify current rates/procedures against official CBIC sources before relying on them in real work.</p>
  ${KNOWLEDGE_PANEL.map(k => `
  <div class="wz-card">
    <h3>${esc(k.title)}</h3>
    <table class="kv-table">
      <tr><td>What is it?</td><td>${esc(k.what)}</td></tr>
      <tr><td>Who prepares/handles it?</td><td>${esc(k.who)}</td></tr>
      <tr><td>Why is it required?</td><td>${esc(k.why)}</td></tr>
      <tr><td>When does it happen?</td><td>${esc(k.when)}</td></tr>
      <tr><td>Common mistakes</td><td>${k.errors.map(e => esc(e)).join(' · ')}</td></tr>
    </table>
  </div>`).join('')}`;
}

/* ---------------- SCENARIO LIBRARY (Section 57) ---------------- */
function renderScenarioLibrary() {
  const host = $('#screen-scenlibrary');
  const done = completedScenarioIds();
  const tiers = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Training</div><h1>Scenario Library</h1></div></div>
  <p class="hint">${done.length} of ${SCENARIOS.length} scenarios completed. Click a scenario to begin the matching filing wizard.</p>
  ${tiers.map(tier => {
    const list = SCENARIOS.filter(s => s.difficulty === tier);
    if (!list.length) return '';
    return `<h3 style="color:#17385f;margin-top:18px">${tier}</h3><div class="scenario-grid">
    ${list.map(s => `<div class="scenario-card" role="button" tabindex="0" onclick="beginFiling('${s.type}','${s.id}')">
      <h4>${esc(s.title)} ${done.includes(s.id) ? '<span class="badge badge-green">✓ Done</span>' : ''}</h4>
      <span class="badge ${s.type === 'export' ? 'badge-blue' : 'badge-amber'}">${s.type === 'export' ? 'Export' : 'Import'}</span>
      <p>${esc(s.desc)}</p>
      <p class="hint-inline" style="color:#5c6b7a">🎓 ${esc(s.learningPoint || '')}</p>
    </div>`).join('')}</div>`;
  }).join('')}`;
}

/* ---------------- CERTIFICATE (Section 34) ---------------- */
function renderCertificate() {
  const host = $('#screen-certificate');
  const { level, stats } = computeCurrentLevel();
  const eligible = stats.completed >= 4 && stats.avg >= 60;
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Training</div><h1>Training Completion Certificate</h1></div></div>
  <div class="wz-card">
    <h3>Your Progress</h3>
    <table class="kv-table">
      <tr><td>Current Level</td><td>Level ${level.id} — ${esc(level.name)}</td></tr>
      <tr><td>Filings Completed</td><td>${stats.completed}</td></tr>
      <tr><td>Average Assessment Score</td><td>${stats.avg}/100</td></tr>
      <tr><td>Freight Bookings Completed</td><td>${stats.freightDone}</td></tr>
    </table>
  </div>
  ${eligible ? (STATE.certificates.some(c => c.levelId === level.id) ? `<div class="wz-card"><h3>Certificate</h3><p class="hint">You have already been issued a certificate for Level ${level.id}. See it under Issued Certificates below.</p></div>` : `<div class="wz-card"><h3>Generate Certificate</h3>
    <p class="hint">You are eligible for a Training Simulator Completion certificate at your current level.</p>
    <button class="btn-ghost" onclick="generateCertificate()">Generate Certificate</button>
  </div>`) : `<div class="alert alert-amber">Complete at least 4 filings with an average assessment score of 60 or above to unlock your first certificate. (${stats.completed}/4 filings, ${stats.avg}/60 average)</div>`}
  ${STATE.certificates.length ? `<h3 style="color:#17385f;margin-top:18px">Issued Certificates</h3>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>Certificate ID</th><th>Level</th><th>Date</th><th></th></tr></thead><tbody>
  ${STATE.certificates.map(c => `<tr><td>${esc(c.id)}</td><td>Level ${c.levelId} — ${esc(c.levelName)}</td><td>${fmtDateTime(c.ts)}</td>
  <td><button class="btn-ghost sm" onclick="viewCertificate('${c.id}')">View</button> <button class="btn-ghost sm" onclick="printCertificate('${c.id}')">Print</button></td></tr>`).join('')}
  </tbody></table></div>` : ''}
  `;
}
function generateCertificate() {
  const { level, stats } = computeCurrentLevel();
  /* Section 21: no duplicate issuance — reopening/re-clicking must not mint a second
     certificate for a level the user has already been issued one for. */
  const existing = STATE.certificates.find(c => c.levelId === level.id);
  if (existing) { renderCertificate(); toast('Certificate for this level was already issued.', 'info'); return; }
  const cert = {
    id: uniqueId('CERT', () => 'CERT-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000)),
    ts: Date.now(), studentName: STATE.user.profile.name, levelId: level.id, levelName: level.name,
    filingsCompleted: stats.completed, avgScore: stats.avg, institution: 'TCOS Training Simulator'
  };
  STATE.certificates.unshift(cert);
  saveState();
  toast('Certificate generated.', 'success');
  renderCertificate();
}
function certificateHTML(c) {
  return `<html><head><title>Certificate ${esc(c.id)}</title><style>
    body{font-family:Georgia,serif;padding:50px;color:#111;text-align:center}
    .frame{border:6px double #17385f;padding:50px 40px}
    h1{color:#17385f;font-size:26px;letter-spacing:1px;margin-bottom:2px}
    h2{color:#f07c00;font-size:15px;font-weight:600;margin-top:0}
    .name{font-size:28px;margin:26px 0 8px;color:#17385f;font-weight:700}
    .line{width:280px;border-bottom:2px solid #17385f;margin:0 auto 6px}
    .meta{font-size:13px;color:#555;margin-top:26px}
    .stamp{margin-top:34px;color:#a51818;font-weight:700;font-size:12px;border:2px solid #a51818;display:inline-block;padding:8px 16px}
  </style></head><body>
  <div class="frame">
    <h1>TCOS TRAINING SIMULATOR COMPLETION</h1>
    <h2>India Trade &amp; Customs Operations Simulator</h2>
    <p style="margin-top:30px">This is to certify that</p>
    <div class="line"></div><div class="name">${esc(c.studentName)}</div><div class="line"></div>
    <p>has completed training modules reaching</p>
    <p style="font-size:18px;font-weight:700;color:#17385f">Level ${c.levelId} — ${esc(c.levelName)}</p>
    <p>Filings completed: ${c.filingsCompleted} &nbsp; | &nbsp; Average assessment score: ${c.avgScore}/100</p>
    <div class="meta">Certificate ID: ${esc(c.id)} &nbsp; | &nbsp; Date: ${fmtDateTime(c.ts)} &nbsp; | &nbsp; Training Institution: ${esc(c.institution)}</div>
    <div class="stamp">EDUCATIONAL SIMULATION CERTIFICATE — NOT A GOVERNMENT OR REGULATORY CERTIFICATION</div>
  </div>
  </body></html>`;
}
function viewCertificate(id) {
  const c = STATE.certificates.find(x => x.id === id);
  if (!c) { toast('That certificate could not be found — it may belong to a different profile.', 'error'); return; }
  const bg = el('div', 'modal-bg show');
  bg.innerHTML = `<div class="modal" style="width:min(700px,94vw)"><div class="modal-head">Certificate ${esc(c.id)} <span class="close">×</span></div>
  <iframe style="width:100%;height:65vh;border:0" srcdoc="${esc(certificateHTML(c))}"></iframe></div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click', e => { if (e.target === bg || e.target.classList.contains('close')) bg.remove(); });
}
function printCertificate(id) {
  const c = STATE.certificates.find(x => x.id === id);
  if (!c) { toast('That certificate could not be found — it may belong to a different profile.', 'error'); return; }
  /* Merged from the parallel FINAL hardening pass: guard against a popup-blocked window. */
  const w = window.open('', '_blank');
  if (!w) { toast('Your browser blocked the print window — allow pop-ups for this site and try again.', 'error'); return; }
  w.document.write(certificateHTML(c)); w.document.close(); w.focus();
  setTimeout(() => w.print(), 400);
}

/* ---------------- JOB SIMULATOR (Section 30) ---------------- */
const JOB_TRACKS = {
  exim: {
    title: 'Junior EXIM Executive', roleType: 'export',
    tasks: [
      { id: 't1', time: '09:00 AM', title: 'Inspect Client Documents', kind: 'inspect',
        brief: 'Al Noor Trading LLC has sent an export document set. One field looks inconsistent — find it before you file.',
        docSummary: { 'Invoice No.': 'INV-EXP-9101', 'Declared FOB Value': '$18,500', 'Packing List Total': '480 cartons', 'Invoice Carton Count': '500 cartons' },
        question: 'What is the discrepancy in the documents above?', options: ['Invoice value is missing', 'Packing List carton count does not match the Invoice carton count', 'Consignee name is missing', 'There is no discrepancy'], answer: 1 },
      { id: 't2', time: '09:45 AM', title: 'Prepare Shipping Bill', kind: 'filing', scenarioId: 'S1',
        brief: 'Now prepare and submit the Shipping Bill for this shipment using the matching training scenario.' },
      { id: 't3', time: '11:15 AM', title: 'Handle Customs Query (if raised)', kind: 'checkpoint', status: 'query',
        brief: 'If a query is raised on your filing, go to Queries and reply with the correct clarification and supporting document.' },
      { id: 't4', time: '02:00 PM', title: 'Respond to Examination (if selected)', kind: 'checkpoint', status: 'exam',
        brief: 'If your cargo is selected for examination, review the finding and take the correct next step.' },
      { id: 't5', time: '04:30 PM', title: 'Send Final Documents to Client', kind: 'confirm',
        brief: 'Once LEO is issued, download the acknowledgement/LEO document and confirm it has been sent to the client.' }
    ]
  },
  customs: {
    title: 'Customs Documentation Executive', roleType: 'import',
    tasks: [
      { id: 't1', time: '09:00 AM', title: 'Inspect Supplier Documents', kind: 'inspect',
        brief: 'Pacific Computing Pte Ltd has sent an import document set. Check the invoice and AWB before filing.',
        docSummary: { 'Invoice No.': 'INV-IMP-9201', 'Incoterm': 'CIF', 'AWB No.': '618-39201847', 'BL/AWB on Invoice': '618-39201874' },
        question: 'What is the discrepancy in the documents above?', options: ['Incoterm is missing', 'AWB number on the Invoice does not match the actual AWB number', 'Invoice number is missing', 'There is no discrepancy'], answer: 1 },
      { id: 't2', time: '09:40 AM', title: 'Prepare Bill of Entry', kind: 'filing', scenarioId: 'S4',
        brief: 'Prepare and submit the Bill of Entry for this shipment using the matching training scenario.' },
      { id: 't3', time: '12:00 PM', title: 'Complete Assessment & Duty Payment', kind: 'checkpoint', status: 'duty',
        brief: 'Proceed through assessment and pay the assessed duty for this Bill of Entry.' },
      { id: 't4', time: '03:00 PM', title: 'Handle Examination (if selected)', kind: 'checkpoint', status: 'exam',
        brief: 'If the cargo is selected for examination, respond correctly to the finding.' },
      { id: 't5', time: '05:00 PM', title: 'Send Final Documents to Client', kind: 'confirm',
        brief: 'Once Out of Charge is granted, download the OOC document and confirm it has been sent to the client.' }
    ]
  },
  freight: {
    title: 'Freight Forwarding Executive', roleType: 'freight',
    tasks: [
      { id: 't1', time: '09:00 AM', title: 'Review Booking Request', kind: 'inspect',
        brief: 'A new freight booking request has come in. Check the cargo ready date against the requested ETD before confirming.',
        docSummary: { 'Cargo Ready Date': '14 Aug', 'Requested ETD': '13 Aug', 'Mode': 'Sea', 'Container Type': "40' Standard" },
        question: 'What is the issue with this booking request?', options: ['Container type is invalid', 'Cargo Ready Date is after the requested ETD — timeline is not feasible', 'Mode of transport is missing', 'There is no issue'], answer: 1 },
      { id: 't2', time: '09:40 AM', title: 'Create Freight Booking', kind: 'freight',
        brief: 'Go to Freight Forwarding and create a new booking for the (corrected) shipment timeline.' },
      { id: 't3', time: '12:00 PM', title: 'Submit Shipping Instructions & VGM', kind: 'checkpoint', status: 'freight-si',
        brief: 'Once the booking is confirmed, submit Shipping Instructions and the VGM before the cut-off.' },
      { id: 't4', time: '03:00 PM', title: 'Review Draft BL / AWB', kind: 'checkpoint', status: 'freight-bl',
        brief: 'Check the draft BL/AWB carefully before requesting the final document.' },
      { id: 't5', time: '05:00 PM', title: 'Confirm Delivery / POD', kind: 'confirm',
        brief: 'Confirm Delivery Order, Gate Out and POD have been completed and communicated to the customer.' }
    ]
  }
};
function renderJobSimulator() {
  const host = $('#screen-jobsim');
  const active = STATE.jobSim.active;
  if (!active) {
    host.innerHTML = `
    <div class="page-head"><div><div class="crumb">Training</div><h1>Job Simulator — Live a Real Work Day</h1></div></div>
    <p class="hint">Choose a role. Tasks arrive across a simulated workday exactly like a real junior logistics job — including the mistakes.</p>
    <div class="scenario-grid">
      ${Object.keys(JOB_TRACKS).map(k => `<div class="scenario-card" role="button" tabindex="0" onclick="startJobTrack('${k}')">
        <h4>${esc(JOB_TRACKS[k].title)}</h4><p>${JOB_TRACKS[k].tasks.length} tasks across a simulated workday.</p></div>`).join('')}
    </div>
    ${STATE.jobSim.runs.length ? `<h3 style="color:#17385f;margin-top:20px">Past Performance Reports</h3>
    ${STATE.jobSim.runs.slice(0, 5).map(r => jobRunReportHTML(r)).join('')}` : ''}
    `;
    return;
  }
  const track = JOB_TRACKS[active.trackKey];
  const task = track.tasks[active.taskIndex];
  if (!task) { host.innerHTML = jobRunReportHTML(finishJobRun()); return; }
  let body = '';
  if (task.kind === 'inspect') {
    body = `<div class="wz-card"><h3>${esc(task.time)} — ${esc(task.title)}</h3><p>${esc(task.brief)}</p>
    <table class="kv-table">${Object.entries(task.docSummary).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
    <p style="margin-top:14px;font-weight:700">${esc(task.question)}</p>
    ${task.options.map((o, i) => `<button class="btn-ghost" style="display:block;width:100%;text-align:left;margin-bottom:6px" onclick="answerJobQuiz(${i})">${esc(o)}</button>`).join('')}
    </div>`;
  } else if (task.kind === 'filing') {
    body = `<div class="wz-card"><h3>${esc(task.time)} — ${esc(task.title)}</h3><p>${esc(task.brief)}</p>
    <button class="btn-ghost" onclick="startJobFiling('${task.scenarioId}')">Open Filing Wizard</button></div>`;
  } else if (task.kind === 'freight') {
    body = `<div class="wz-card"><h3>${esc(task.time)} — ${esc(task.title)}</h3><p>${esc(task.brief)}</p>
    <button class="btn-ghost" onclick="startJobFreight()">Open Freight Booking Wizard</button></div>`;
  } else if (task.kind === 'checkpoint') {
    body = `<div class="wz-card"><h3>${esc(task.time)} — ${esc(task.title)}</h3><p>${esc(task.brief)}</p>
    <p class="hint">Go handle this in the relevant module using the sidebar, then come back here and mark the task complete.</p>
    <button class="btn-ghost" onclick="advanceJobTask()">Mark Task Complete &amp; Continue</button></div>`;
  } else if (task.kind === 'confirm') {
    body = `<div class="wz-card"><h3>${esc(task.time)} — ${esc(task.title)}</h3><p>${esc(task.brief)}</p>
    <button class="btn-ghost" onclick="advanceJobTask()">Confirm &amp; Finish Work Day</button></div>`;
  }
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Training</div><h1>${esc(track.title)} — Simulated Work Day</h1></div>
  <button class="btn-ghost sm" onclick="quitJobRun()">Exit Simulation</button></div>
  <div class="stepper">${track.tasks.map((t, i) => `<div class="step ${i < active.taskIndex ? 'done' : (i === active.taskIndex ? 'on' : '')}"><i>${i + 1}</i>${esc(t.time)}</div>`).join('')}</div>
  ${body}`;
}
function startJobTrack(key) {
  STATE.jobSim.active = { trackKey: key, taskIndex: 0, startTs: Date.now(), correctAnswers: 0, totalQuestions: 0, filingId: null, bookingId: null };
  saveState();
  navTo('jobsim');
}
function answerJobQuiz(i) {
  const active = STATE.jobSim.active; const track = JOB_TRACKS[active.trackKey]; const task = track.tasks[active.taskIndex];
  active.totalQuestions++;
  if (i === task.answer) { active.correctAnswers++; toast('Correct — you caught the discrepancy.', 'success'); }
  else toast('Not quite. Correct answer: ' + task.options[task.answer], 'error');
  saveState();
  advanceJobTask();
}
function startJobFiling(scenarioId) {
  const active = STATE.jobSim.active; const track = JOB_TRACKS[active.trackKey];
  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  const filing = startNewFiling(track.roleType, scenario);
  active.filingId = filing.id;
  saveState();
  openWizard(filing);
}
function startJobFreight() {
  startFreightBookingFlow();
}
function advanceJobTask() {
  const active = STATE.jobSim.active; if (!active) return;
  active.taskIndex++;
  saveState();
  renderJobSimulator();
}
function finishJobRun() {
  const active = STATE.jobSim.active; const track = JOB_TRACKS[active.trackKey];
  const minutes = Math.max(1, Math.round((Date.now() - active.startTs) / 60000));
  const accuracy = active.totalQuestions ? Math.round(100 * active.correctAnswers / active.totalQuestions) : 100;
  const filing = active.filingId ? getFiling(active.filingId) : null;
  const completedFiling = filing && ['LEO', 'OOC', 'COMPLETED'].includes(filing.status);
  const scores = {
    accuracy, documentation: completedFiling ? 90 : 60, customsKnowledge: completedFiling ? 88 : 55,
    freightKnowledge: track.roleType === 'freight' ? 85 : 70, compliance: accuracy, decisionMaking: accuracy,
    timeManagement: minutes < 20 ? 95 : (minutes < 60 ? 80 : 65), errorDetection: accuracy, communication: 85
  };
  const overall = Math.round(Object.values(scores).reduce((s, v) => s + v, 0) / Object.keys(scores).length);
  const run = { id: 'JOB-' + Date.now(), trackKey: active.trackKey, trackTitle: track.title, ts: Date.now(), minutes, scores, overall, filingId: active.filingId };
  STATE.jobSim.runs.unshift(run);
  STATE.jobSim.active = null;
  saveState();
  return run;
}
function quitJobRun() {
  confirmDialog('Exit this simulated work day? Progress on the current run will be lost.', () => {
    STATE.jobSim.active = null; saveState(); navTo('jobsim');
  });
}
function jobRunReportHTML(r) {
  return `<div class="wz-card"><h3>${esc(r.trackTitle)} — Daily Performance Report <span class="badge ${r.overall >= 70 ? 'badge-green' : 'badge-amber'}">${r.overall}/100</span></h3>
  <table class="kv-table">
    <tr><td>Accuracy</td><td>${r.scores.accuracy}</td></tr>
    <tr><td>Documentation</td><td>${r.scores.documentation}</td></tr>
    <tr><td>Customs Knowledge</td><td>${r.scores.customsKnowledge}</td></tr>
    <tr><td>Freight Knowledge</td><td>${r.scores.freightKnowledge}</td></tr>
    <tr><td>Compliance</td><td>${r.scores.compliance}</td></tr>
    <tr><td>Decision Making</td><td>${r.scores.decisionMaking}</td></tr>
    <tr><td>Time Management</td><td>${r.scores.timeManagement} (${r.minutes} min)</td></tr>
    <tr><td>Error Detection</td><td>${r.scores.errorDetection}</td></tr>
    <tr><td>Communication</td><td>${r.scores.communication}</td></tr>
  </table>
  <p class="hint">Completed ${fmtDateTime(r.ts)}</p></div>`;
}

/* ---------------- TRAINER CONSOLE (Section 46) ---------------- */
const TRAINER_DEMO_ROSTER = [
  { id: 'STU001', name: 'Anjali Nair', role: 'Exporter Track', filingsCompleted: 3, avgScore: 74 },
  { id: 'STU002', name: 'Vishnu Prasad', role: 'Importer Track', filingsCompleted: 5, avgScore: 81 },
  { id: 'STU003', name: 'Fathima Rasheed', role: 'Freight Forwarding Track', filingsCompleted: 2, avgScore: 63 },
  { id: 'STU004', name: 'Arun Kumar', role: 'Customs Broker Track', filingsCompleted: 6, avgScore: 88 }
];
function renderTrainerConsole() {
  const host = $('#screen-trainer');
  const { level, stats } = computeCurrentLevel();
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Training</div><h1>Trainer Console</h1></div></div>
  <div class="alert alert-amber">This is a local, single-browser demo environment — there is no shared backend, so the roster below is illustrative demo data for trainers to preview the console. Your own live progress is shown separately below.</div>
  <div class="wz-card"><h3>Your Live Training Profile (this browser)</h3>
  <table class="kv-table">
    <tr><td>Name</td><td>${esc(STATE.user.profile.name)}</td></tr>
    <tr><td>Current Level</td><td>Level ${level.id} — ${esc(level.name)}</td></tr>
    <tr><td>Filings Completed</td><td>${stats.completed}</td></tr>
    <tr><td>Average Score</td><td>${stats.avg}/100</td></tr>
  </table></div>
  <h3 style="color:#17385f;margin-top:18px">Demo Student Roster</h3>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>Student ID</th><th>Name</th><th>Track</th><th>Filings</th><th>Avg. Score</th><th>Trainer Note</th></tr></thead><tbody>
  ${TRAINER_DEMO_ROSTER.map(s => `<tr><td>${s.id}</td><td>${esc(s.name)}</td><td>${esc(s.role)}</td><td>${s.filingsCompleted}</td><td>${s.avgScore}</td>
    <td><input type="text" value="${esc(STATE.trainerNotes[s.id] || '')}" placeholder="Add note…" onchange="setTrainerNote('${s.id}', this.value)" style="width:100%;border:1px solid #cbd3db;padding:4px 6px;font-size:12px"></td></tr>`).join('')}
  </tbody></table></div>`;
}
function setTrainerNote(id, val) {
  if (!hasPermission('trainer_console')) { toast('You do not have permission to do this.', 'error'); return; }
  STATE.trainerNotes[id] = val; saveState(); toast('Note saved.', 'success');
}

/* ---------------- ERROR RESOLUTION LAB (Section 21) ---------------- */
const ERROR_LAB_CASES = [
  { code: 'ERR-GST-01', title: 'Invalid GSTIN', cause: 'GSTIN does not match the 15-character format or checksum.', field: 'Exporter/Importer GSTIN', fix: 'Re-enter the GSTIN exactly as shown on the GST registration certificate and re-validate.', options: ['Ignore and submit anyway', 'Re-enter the correct GSTIN and re-validate', 'Delete the GSTIN field entirely'], answer: 1 },
  { code: 'ERR-IEC-02', title: 'Invalid IEC', cause: 'IEC number entered does not match the registered 10-digit format.', field: 'IEC Number', fix: 'Confirm the IEC on the DGFT-issued certificate and re-enter it correctly.', options: ['Use the GSTIN instead', 'Confirm and re-enter the correct 10-digit IEC', 'Leave blank'], answer: 1 },
  { code: 'ERR-HS-03', title: 'Invalid HS Code', cause: 'The HS code entered does not exist in the tariff schedule or does not match the item description.', field: 'Item HS Code', fix: 'Cross-check the HS code against the item description using the Compliance Lab before resubmitting.', options: ['Pick any valid-looking code', 'Cross-check the correct HS code for the item description', 'Submit without a code'], answer: 1 },
  { code: 'ERR-FLD-04', title: 'Missing Mandatory Field', cause: 'A required field (e.g. consignee address, invoice date) was left blank.', field: 'Varies', fix: 'Review the validation summary and complete every field flagged as mandatory.', options: ['Submit and wait for a query', 'Complete every mandatory field before submitting', 'Delete the section'], answer: 1 },
  { code: 'ERR-PRT-05', title: 'Invalid Port Code', cause: 'The port code entered is not a recognised port in the reference list.', field: 'Port of Loading / Discharge', fix: 'Select the port from the standard list rather than typing it freehand.', options: ['Type the port name freehand', 'Select the correct port from the standard list', 'Leave the port blank'], answer: 1 },
  { code: 'ERR-INV-06', title: 'Invoice Value Mismatch', cause: 'The declared value does not match the sum of item-level totals.', field: 'Invoice Value / Item Totals', fix: 'Recalculate item totals (qty × unit price) and reconcile with the declared invoice value.', options: ['Adjust invoice value randomly', 'Recalculate item totals and reconcile with invoice value', 'Ignore — Customs will fix it'], answer: 1 },
  { code: 'ERR-WGT-07', title: 'Weight Mismatch', cause: 'Package-level weight does not add up to the declared gross weight.', field: 'Packages / Gross Weight', fix: 'Re-total the package weights and correct the declared gross weight before submission.', options: ['Round the gross weight up', 'Re-total package weights and correct the gross weight', 'Remove the weight field'], answer: 1 },
  { code: 'ERR-DOC-08', title: 'Missing Document', cause: 'A mandatory supporting document (e.g. Certificate of Origin for an FTA claim) was not uploaded.', field: 'Document Upload', fix: 'Upload the missing document type before submitting or replying to a query.', options: ['Submit without the document', 'Upload the missing document before proceeding', 'Explain in a text note instead of uploading'], answer: 1 },
  { code: 'ERR-DUP-09', title: 'Duplicate Filing', cause: 'A filing with the same invoice number has already been submitted.', field: 'Invoice Number', fix: 'Check existing filings for the same invoice number before creating a new one.', options: ['Submit anyway', 'Check for an existing filing with the same invoice number first', 'Change the invoice number to something random'], answer: 1 },
  { code: 'ERR-SIG-10', title: 'Signature/DSC Failure', cause: 'The simulated digital signature step did not complete before submission was attempted.', field: 'DSC Sign Step', fix: 'Complete the signing step in the wizard before clicking submit.', options: ['Skip signing and submit', 'Complete the signing step first, then submit', 'Submit twice'], answer: 1 }
];
var ERROR_LAB_CURRENT = null;
function renderErrorLab() {
  const host = $('#screen-errorlab');
  if (!ERROR_LAB_CURRENT) ERROR_LAB_CURRENT = ERROR_LAB_CASES[Math.floor(Math.random() * ERROR_LAB_CASES.length)];
  const c = ERROR_LAB_CURRENT;
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Training</div><h1>Error Resolution Lab</h1></div>
  <button class="btn-ghost sm" onclick="nextErrorLabCase()">Next Error →</button></div>
  <div class="wz-card">
    <h3>${esc(c.code)} — ${esc(c.title)}</h3>
    <table class="kv-table">
      <tr><td>Affected Field</td><td>${esc(c.field)}</td></tr>
      <tr><td>Likely Cause</td><td>${esc(c.cause)}</td></tr>
    </table>
    <p style="margin-top:14px;font-weight:700">What is the correct corrective action?</p>
    <div id="errorLabOptions">
    ${c.options.map((o, i) => `<button class="btn-ghost" style="display:block;width:100%;text-align:left;margin-bottom:6px" onclick="answerErrorLab(${i})">${esc(o)}</button>`).join('')}
    </div>
    <div id="errorLabFeedback"></div>
  </div>`;
}
function answerErrorLab(i) {
  const c = ERROR_LAB_CURRENT;
  const fb = $('#errorLabFeedback');
  if (i === c.answer) fb.innerHTML = `<div class="alert alert-success">Correct. ${esc(c.fix)}</div>`;
  else fb.innerHTML = `<div class="alert alert-error">Not the best fix. Correct approach: ${esc(c.fix)}</div>`;
}
function nextErrorLabCase() {
  let next; do { next = ERROR_LAB_CASES[Math.floor(Math.random() * ERROR_LAB_CASES.length)]; } while (next === ERROR_LAB_CURRENT && ERROR_LAB_CASES.length > 1);
  ERROR_LAB_CURRENT = next; renderErrorLab();
}

/* ---------------- COMPLIANCE LAB (Section 29) ---------------- */
function renderComplianceLab() {
  const host = $('#screen-compliance');
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Training</div><h1>Compliance Lab</h1></div></div>
  <p class="hint">Training reference only — always verify current tariff, PGA and FTA rules against official CBIC/DGFT sources before relying on them for real work.</p>
  <div class="search-row"><input id="complianceQuery" placeholder="Search HS code or commodity keyword…" onkeydown="if(event.key==='Enter')runComplianceSearch()"><button class="btn-ghost" onclick="runComplianceSearch()">Search</button></div>
  <div id="complianceResults"></div>
  <h3 style="color:#17385f;margin-top:20px">Participating Government Agencies (PGA)</h3>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>Agency</th><th>Clearance Type</th></tr></thead><tbody>
  ${Object.values(PGA_AGENCIES).map(a => `<tr><td>${esc(a.name)}</td><td>${esc(a.noc)}</td></tr>`).join('')}
  </tbody></table></div>
  <h3 style="color:#17385f;margin-top:20px">Free Trade Agreements (Training Reference)</h3>
  <div class="table-wrap"><table class="data-table"><thead><tr><th>Agreement</th><th>Partner Countries</th><th>Preferential BCD (illustrative)</th></tr></thead><tbody>
  ${FTA_AGREEMENTS.map(f => `<tr><td>${esc(f.name)}</td><td>${f.partnerCountries.join(', ')}</td><td>${(f.preferentialBcdRate * 100).toFixed(0)}%</td></tr>`).join('')}
  </tbody></table></div>`;
}
function runComplianceSearch() {
  const q = ($('#complianceQuery').value || '').trim().toLowerCase();
  const results = $('#complianceResults');
  if (!q) { results.innerHTML = '<p class="hint">Enter an HS code or keyword to search.</p>'; return; }
  const matches = Object.entries(HS_CODE_TABLE).filter(([code, d]) => code.includes(q) || d.desc.toLowerCase().includes(q));
  if (!matches.length) { results.innerHTML = '<p class="hint">No training tariff entries matched. Try a different keyword.</p>'; return; }
  results.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr><th>HS Code</th><th>Description</th><th>BCD</th><th>PGA Requirement</th><th>Risk Tier</th></tr></thead><tbody>
  ${matches.map(([code, d]) => `<tr><td>${code}</td><td>${esc(d.desc)}</td><td>${(d.bcdRate * 100).toFixed(0)}%</td><td>${d.pgaAgency ? esc(PGA_AGENCIES[d.pgaAgency].name) : '—'}</td><td>${esc(d.riskTier)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
