/* =========================================================
   recruitment.js — Job Requisitions & Candidate Pipeline
   ========================================================= */

const PIPELINE_STAGES = ['Applied','Screening','Interview','Offer','Hired','Rejected'];
let _reqFilter = null;

Modules.recruitment = function(container) {
  const reqs = Store.getRequisitions();
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Recruitment</div><h1>Recruitment &amp; Onboarding</h1><p class="desc">Open job requisitions and move candidates through the hiring pipeline, from application to hire.</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openRequisitionForm()">+ New Requisition</button></div>
    </div>
    ${reqs.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128188;</div><h4>No open positions yet</h4><p>Create a job requisition to start receiving candidates.</p><button class="btn btn-primary" onclick="openRequisitionForm()">+ New Requisition</button></div></div>` : `
    <div class="doc-type-grid" style="margin-bottom:24px;">
      ${reqs.map(r => {
        const candCount = Store.getCandidates(r.id).length;
        const hired = Store.getCandidates(r.id).filter(c=>c.stage==='Hired').length;
        return `<div class="doc-type-card" onclick="openPipeline('${r.id}')">
          <div class="dt-ic">&#128188;</div><h4>${escapeHtml(r.title)}</h4>
          <p>${escapeHtml(r.department)} · ${r.openings} opening(s)</p>
          <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
            <span class="badge ${r.status==='Open'?'badge-active':'badge-inactive'}">${r.status}</span>
            <span class="text-faint" style="font-size:11px;">${candCount} candidate(s) · ${hired} hired</span>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div id="pipeline-mount"></div>`}
  `;
};

function openRequisitionForm() {
  openModal({
    title: 'New Job Requisition',
    body: `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="field"><label>Job Title <span class="req">*</span></label><input id="rq-title" placeholder="e.g. HR Executive"></div>
        <div class="field"><label>Department</label><select id="rq-dept">${DEPARTMENTS.map(d=>`<option>${d}</option>`).join('')}</select></div>
        <div class="field"><label>Number of Openings</label><input type="number" id="rq-openings" value="1" min="1"></div>
        <div class="field"><label>Job Description</label><textarea id="rq-desc" placeholder="Key responsibilities and requirements"></textarea></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="rq-cancel">Cancel</button><button class="btn btn-primary" id="rq-save">Open Requisition</button>`
  });
  document.getElementById('rq-cancel').onclick = closeModal;
  document.getElementById('rq-save').onclick = () => {
    const title = document.getElementById('rq-title').value.trim();
    if (!title) return toast('Job title is required', 'error');
    Store.addRequisition({ title, department: document.getElementById('rq-dept').value, openings: parseInt(document.getElementById('rq-openings').value,10)||1, description: document.getElementById('rq-desc').value.trim() });
    closeModal(); toast('✓ Requisition opened', 'success'); navigate('recruitment');
  };
}

function openPipeline(reqId) {
  _reqFilter = reqId;
  const mount = document.getElementById('pipeline-mount');
  renderPipeline();
  if (mount && typeof mount.scrollIntoView === 'function') mount.scrollIntoView({ behavior: 'smooth' });
}

function renderPipeline() {
  const mount = document.getElementById('pipeline-mount');
  if (!mount || !_reqFilter) return;
  const req = Store.getRequisitions().find(r => r.id === _reqFilter);
  if (!req) return;
  const candidates = Store.getCandidates(_reqFilter);

  mount.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3>${escapeHtml(req.title)} — Pipeline</h3>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="openCandidateForm('${req.id}')">+ Add Candidate</button>
          <button class="btn btn-outline btn-sm" onclick="toggleRequisitionStatus('${req.id}')">${req.status==='Open'?'Close Position':'Reopen Position'}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRequisitionConfirm('${req.id}')">Delete</button>
        </div>
      </div>
      <div class="card-pad" style="overflow-x:auto;">
        <div style="display:flex;gap:14px;min-width:900px;">
          ${PIPELINE_STAGES.map(stage => `
            <div style="flex:1;min-width:150px;">
              <div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-dim);margin-bottom:10px;">${stage} <span class="text-faint">(${candidates.filter(c=>c.stage===stage).length})</span></div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${candidates.filter(c => c.stage === stage).map(c => `
                  <div class="card card-pad" style="padding:12px;">
                    <div style="font-weight:600;font-size:12.5px;color:var(--ink);">${escapeHtml(c.name)}</div>
                    <div class="text-faint" style="font-size:11px;margin:3px 0 8px;">${escapeHtml(c.phone||'')}${c.rating ? ' · ★'+c.rating : ''}${c.resumeFileName ? ' · &#128203; Resume' : ''}</div>
                    ${c.resumeFileName ? `<div class="text-faint" style="font-size:10.5px;margin-bottom:6px;" title="${escapeHtml(c.resumeFileName)}">&#128206; ${escapeHtml(c.resumeFileName.length > 20 ? c.resumeFileName.slice(0,17)+'...' : c.resumeFileName)}</div>` : ''}
                    <select style="width:100%;font-size:11px;padding:5px 6px;border:1px solid var(--line);border-radius:5px;margin-bottom:6px;" onchange="moveCandidateStageUI('${c.id}', this.value)">
                      ${PIPELINE_STAGES.map(s => `<option value="${s}" ${s===c.stage?'selected':''}>${s}</option>`).join('')}
                    </select>
                    <div style="display:flex;gap:5px;">
                      ${c.stage==='Offer' ? `<button class="btn btn-sm btn-teal" style="flex:1;padding:4px;font-size:10.5px;" onclick="hireCandidateUI('${c.id}')">Mark Hired</button>` : ''}
                      <button class="icon-action danger" style="width:24px;height:24px;" onclick="deleteCandidateConfirm('${c.id}')">&#128465;</button>
                    </div>
                  </div>`).join('') || `<div class="text-faint" style="font-size:11px;padding:10px 0;">No candidates</div>`}
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  `;
}

function openCandidateForm(reqId) {
  openModal({
    title: 'Add Candidate',
    body: `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="field"><label>Full Name <span class="req">*</span></label><input id="cd-name"></div>
        <div class="field"><label>Phone</label><input id="cd-phone"></div>
        <div class="field"><label>Email</label><input id="cd-email" type="email"></div>
        <div class="field"><label>Resume Notes</label><textarea id="cd-notes" placeholder="Education, experience, key skills"></textarea></div>
        <div class="field">
          <label>Resume File</label>
          <div class="photo-upload">
            <div class="preview" style="border-radius:8px;" id="cd-resume-preview">&#128196;</div>
            <div>
              <label class="btn btn-outline btn-sm" style="cursor:pointer;">Upload Resume<input type="file" id="cd-resume-input" accept=".pdf,.doc,.docx" style="display:none;"></label>
              <div class="helptext" style="margin-top:6px;" id="cd-resume-name">No file attached</div>
            </div>
          </div>
        </div>
      </div>`,
    foot: `<button class="btn btn-outline" id="cd-cancel">Cancel</button><button class="btn btn-primary" id="cd-save">Add Candidate</button>`
  });
  let resumeFileName = '';
  document.getElementById('cd-resume-input').onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    resumeFileName = file.name;
    document.getElementById('cd-resume-name').textContent = `Attached: ${file.name}`;
    document.getElementById('cd-resume-preview').innerHTML = '&#128203;';
  };
  document.getElementById('cd-cancel').onclick = closeModal;
  document.getElementById('cd-save').onclick = () => {
    const name = document.getElementById('cd-name').value.trim();
    if (!name) return toast('Candidate name is required', 'error');
    Store.addCandidate({ name, phone: document.getElementById('cd-phone').value.trim(), email: document.getElementById('cd-email').value.trim(), resumeNote: document.getElementById('cd-notes').value.trim(), resumeFileName, requisitionId: reqId });
    closeModal(); toast('✓ Candidate added', 'success'); renderPipeline();
  };
}

function moveCandidateStageUI(id, stage) { Store.moveCandidateStage(id, stage); renderPipeline(); toast(`Moved to ${stage}`, 'success'); }
function hireCandidateUI(id) {
  const cand = Store.getCandidates().find(c => c.id === id);
  confirmAction('Mark this candidate as Hired and create their employee record now?', () => {
    Store.hireCandidate(id);
    toast('✓ Candidate hired', 'success');
    renderPipeline();
    const nameParts = cand.name.trim().split(/\s+/);
    navigate('employees');
    openEmployeeForm(null, {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      phone: cand.phone || '',
      email: cand.email || '',
      department: Store.getRequisitions().find(r => r.id === cand.requisitionId)?.department || DEPARTMENTS[0]
    });
  });
}
function deleteCandidateConfirm(id) { confirmAction('Remove this candidate from the pipeline?', () => { Store.deleteCandidate(id); renderPipeline(); }); }
function toggleRequisitionStatus(id) {
  const req = Store.getRequisitions().find(r => r.id === id);
  Store.updateRequisitionStatus(id, req.status === 'Open' ? 'Closed' : 'Open');
  navigate('recruitment'); openPipeline(id);
}
function deleteRequisitionConfirm(id) {
  confirmAction('Delete this requisition and all its candidates? This cannot be undone.', () => {
    Store.deleteRequisition(id); _reqFilter = null; navigate('recruitment'); toast('Requisition deleted', 'success');
  });
}
