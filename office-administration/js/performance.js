/* =========================================================
   performance.js — Appraisal Cycles & Structured Reviews
   ========================================================= */

const DEFAULT_KPIS = ['Job Knowledge', 'Quality of Work', 'Punctuality &amp; Attendance', 'Communication', 'Teamwork', 'Initiative'];
let _perfCycleId = null;

Modules.performance = function(container) {
  const cycles = Store.getCycles();
  if (!_perfCycleId && cycles.length) _perfCycleId = cycles[cycles.length-1].id;
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Performance</div><h1>Performance Appraisals</h1><p class="desc">Run structured review cycles with KPI ratings, manager comments and a finalized score per employee.</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openCycleForm()">+ New Appraisal Cycle</button></div>
    </div>
    ${cycles.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#127942;</div><h4>No appraisal cycles yet</h4><p>Create a review cycle (e.g. "Half-Year Review 2026") to begin evaluating employees.</p><button class="btn btn-primary" onclick="openCycleForm()">+ New Appraisal Cycle</button></div></div>` : `
    <div class="tabs" style="margin-bottom:18px;">
      ${cycles.map(c => `<button class="tab-btn ${c.id===_perfCycleId?'active':''}" onclick="_perfCycleId='${c.id}';navigate('performance');">${escapeHtml(c.name)}</button>`).join('')}
    </div>
    <div id="perf-mount"></div>`}
  `;
  if (cycles.length) renderCycleTable();
};

function openCycleForm() {
  openModal({
    title: 'New Appraisal Cycle',
    narrow: true,
    body: `
      <div class="field" style="margin-bottom:12px;"><label>Cycle Name <span class="req">*</span></label><input id="cy-name" placeholder="e.g. Half-Year Review — Jul 2026"></div>
      <div class="field"><label>Review Period</label><input id="cy-period" placeholder="e.g. Jan – Jun 2026"></div>
    `,
    foot: `<button class="btn btn-outline" id="cy-cancel">Cancel</button><button class="btn btn-primary" id="cy-save">Create Cycle</button>`
  });
  document.getElementById('cy-cancel').onclick = closeModal;
  document.getElementById('cy-save').onclick = () => {
    const name = document.getElementById('cy-name').value.trim();
    if (!name) return toast('Cycle name is required', 'error');
    const c = Store.addAppraisalCycle({ name, period: document.getElementById('cy-period').value.trim() });
    _perfCycleId = c.id;
    closeModal(); toast('✓ Appraisal cycle created', 'success'); navigate('performance');
  };
}

function renderCycleTable() {
  const mount = document.getElementById('perf-mount');
  if (!mount) return;
  const cycle = Store.getCycles().find(c => c.id === _perfCycleId);
  const employees = Store.getEmployees().filter(e => e.status === 'Active');
  const appraisals = Store.getAppraisalsForCycle(_perfCycleId);

  mount.innerHTML = `
    <div class="card">
      <div class="card-head"><h3>${escapeHtml(cycle.name)}</h3><span class="badge ${cycle.status==='Open'?'badge-active':'badge-inactive'}">${cycle.status}</span></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Employee</th><th>Department</th><th>Status</th><th>Overall Rating</th><th>Actions</th></tr></thead>
          <tbody>
            ${employees.map(e => {
              const ap = appraisals.find(a => a.empId === e.id);
              return `<tr>
                <td><div class="cell-name"><div class="avatar-sm">${initials(e.firstName,e.lastName)}</div>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</div></td>
                <td>${escapeHtml(e.department)}</td>
                <td><span class="badge badge-${ap ? (ap.status==='Finalized'?'active':'pending') : 'inactive'}">${ap ? ap.status : 'Not Started'}</span></td>
                <td>${ap && ap.overallRating ? `${'★'.repeat(Math.round(ap.overallRating))}${'☆'.repeat(5-Math.round(ap.overallRating))} (${ap.overallRating})` : '—'}</td>
                <td><div class="actions-cell">
                  <button class="btn btn-sm btn-outline" onclick="openAppraisalForm('${e.id}')">${ap ? 'Edit' : 'Start Review'}</button>
                  ${ap && ap.status==='Finalized' ? `<button class="icon-action" title="Print" onclick="printAppraisal('${e.id}')">&#128438;</button>` : ''}
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openAppraisalForm(empId) {
  const emp = Store.getEmployee(empId);
  const existing = Store.getAppraisal(_perfCycleId, empId);
  const kpis = existing ? existing.kpis : DEFAULT_KPIS.map(label => ({ label, score: 3, comments: '' }));
  openModal({
    title: `Appraisal — ${emp.firstName} ${emp.lastName}`,
    wide: true,
    body: `
      <div class="form-section"><div class="sec-title">KPI Ratings (1 = Needs Improvement, 5 = Outstanding)</div>
        ${kpis.map((k,i) => `
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
            <div style="width:190px;font-size:12.5px;font-weight:600;">${k.label}</div>
            <input type="range" min="1" max="5" value="${k.score}" id="kpi-score-${i}" oninput="document.getElementById('kpi-val-${i}').textContent=this.value" style="flex:1;">
            <span id="kpi-val-${i}" style="width:16px;font-weight:700;color:var(--ink);">${k.score}</span>
            <input placeholder="Comment (optional)" id="kpi-comment-${i}" value="${escapeHtml(k.comments||'')}" style="flex:1;padding:7px 9px;border:1px solid var(--line-strong);border-radius:5px;font-size:12px;">
          </div>`).join('')}
      </div>
      <div class="form-section"><div class="sec-title">Manager Comments</div>
        <textarea id="ap-mgr-comments" placeholder="Overall summary, strengths, areas of development...">${escapeHtml(existing ? existing.managerComments : '')}</textarea>
      </div>
    `,
    foot: `<button class="btn btn-outline" id="ap-cancel">Cancel</button><button class="btn btn-outline" id="ap-draft">Save as Draft</button><button class="btn btn-primary" id="ap-finalize">Finalize Review</button>`
  });
  document.getElementById('ap-cancel').onclick = closeModal;
  const collect = (status) => {
    const newKpis = kpis.map((k,i) => ({ label: k.label, score: Number(document.getElementById(`kpi-score-${i}`).value), comments: document.getElementById(`kpi-comment-${i}`).value.trim() }));
    const overallRating = Math.round((newKpis.reduce((s,k)=>s+k.score,0) / newKpis.length) * 10) / 10;
    Store.saveAppraisal({ cycleId: _perfCycleId, empId, kpis: newKpis, overallRating, managerComments: document.getElementById('ap-mgr-comments').value.trim(), status });
    closeModal();
    toast(status === 'Finalized' ? '✓ Appraisal finalized' : 'Draft saved', 'success');
    renderCycleTable();
  };
  document.getElementById('ap-draft').onclick = () => collect('Draft');
  document.getElementById('ap-finalize').onclick = () => collect('Finalized');
}

function printAppraisal(empId) {
  const emp = Store.getEmployee(empId);
  const cycle = Store.getCycles().find(c => c.id === _perfCycleId);
  const ap = Store.getAppraisal(_perfCycleId, empId);
  const html = `<div class="doc-page">
    ${letterheadHTML('Performance Appraisal Report')}
    <div class="doc-ref-row"><span>${escapeHtml(cycle.name)}</span><span>${escapeHtml(cycle.period||'')}</span></div>
    <div class="doc-title">PERFORMANCE APPRAISAL</div>
    <table class="doc-table"><tr><th>Employee</th><td>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</td><th>Designation</th><td>${escapeHtml(emp.designation)}</td></tr></table>
    <table class="doc-table"><thead><tr><th>KPI</th><th>Score (/5)</th><th>Comments</th></tr></thead>
    <tbody>${ap.kpis.map(k=>`<tr><td>${k.label}</td><td>${k.score}</td><td>${escapeHtml(k.comments||'—')}</td></tr>`).join('')}</tbody></table>
    <p style="margin-top:16px;"><b>Overall Rating: ${ap.overallRating} / 5</b></p>
    <p><b>Manager Comments:</b> ${escapeHtml(ap.managerComments||'—')}</p>
    <div class="doc-signoff"><div class="sig-block"><div class="sig-line"></div>Employee Signature</div><div class="sig-block"><div class="sig-line"></div>Manager Signature</div></div>
  </div>`;
  printArea(html);
  Store.logDocument('Appraisal Report', empId, `Appraisal Report — ${escapeHtml(cycle.name)}`);
}
