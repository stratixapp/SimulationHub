/* =========================================================
   grievances.js — Grievance / Complaint Register
   Confidential log of employee complaints/grievances, assigned
   to an HR handler and tracked through to resolution.
   ========================================================= */

const GRIEVANCE_CATEGORIES = ['Harassment', 'Payroll / Compensation', 'Facilities', 'Interpersonal Conflict', 'Policy Concern', 'Other'];
const GRIEVANCE_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

Modules.grievances = function(container) {
  const items = Store.getGrievances();
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Grievance &amp; Complaint Register</h1><p class="desc">Log employee grievances, assign them to an HR handler, and track them through to resolution.</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openGrievanceForm()">+ File Grievance</button></div>
    </div>
    ${items.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128172;</div><h4>No grievances filed</h4><p>Use "+ File Grievance" to log the first one.</p></div></div>` : `
    <div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Date Filed</th><th>Employee</th><th>Category</th><th>Assigned To</th><th>Status</th><th></th></tr></thead>
      <tbody>${items.map(g => `<tr>
        <td>${fmtDate(g.dateFiled)}</td><td>${empName(g.empId)}</td><td>${escapeHtml(g.category)}</td><td>${empName(g.assignedTo)}</td>
        <td><select data-grv-status="${g.id}" style="font-size:11.5px;padding:4px 6px;">${GRIEVANCE_STATUSES.map(s=>`<option ${s===g.status?'selected':''}>${s}</option>`).join('')}</select></td>
        <td style="white-space:nowrap;"><button class="btn btn-outline btn-sm" onclick="openGrievanceDetail('${g.id}')">Open</button> <button class="icon-action danger" onclick="deleteGrievanceConfirm('${g.id}')">&#128465;</button></td>
      </tr>`).join('')}</tbody>
    </table></div></div>`}
  `;
  document.querySelectorAll('[data-grv-status]').forEach(sel => sel.onchange = (e) => {
    const patch = { status: e.target.value };
    if (e.target.value === 'Resolved' || e.target.value === 'Closed') {
      const cur = Store.getGrievances().find(x => x.id === e.target.dataset.grvStatus);
      if (!cur || !String(cur.resolutionNotes || '').trim()) {
        toast('Add resolution notes (open the grievance) before marking it Resolved or Closed', 'error');
        e.target.value = cur ? cur.status : 'Open';
        return;
      }
    }
    if (e.target.value === 'Resolved' || e.target.value === 'Closed') patch.resolvedDate = todayISO();
    Store.updateGrievance(e.target.dataset.grvStatus, patch);
    toast('Status updated', 'success');
  });
};

function openGrievanceForm() {
  const employees = Store.getEmployees();
  openModal({
    title: 'File a Grievance',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label>Employee (Filed By) <span class="req">*</span></label><select id="gr-emp"><option value="">— Select —</option>${employees.map(e=>`<option value="${e.id}">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</option>`).join('')}</select></div>
        <div class="field"><label>Category</label><select id="gr-cat">${GRIEVANCE_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Date Filed</label><input type="date" id="gr-date" value="${todayISO()}"></div>
        <div class="field span-2"><label>Description <span class="req">*</span></label><textarea id="gr-desc" placeholder="What happened, and what resolution is being sought"></textarea></div>
        <div class="field span-2"><label>Assign To (HR Handler)</label><select id="gr-assign"><option value="">— Select —</option>${employees.map(e=>`<option value="${e.id}">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)} (${escapeHtml(e.department)})</option>`).join('')}</select></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="gr-cancel">Cancel</button><button class="btn btn-primary" id="gr-save">File Grievance</button>`
  });
  document.getElementById('gr-cancel').onclick = closeModal;
  document.getElementById('gr-save').onclick = () => {
    const empId = document.getElementById('gr-emp').value;
    const description = document.getElementById('gr-desc').value.trim();
    if (!empId || !description) return toast('Employee and Description are required', 'error');
    Store.addGrievance({
      empId, category: document.getElementById('gr-cat').value, dateFiled: document.getElementById('gr-date').value,
      description, assignedTo: document.getElementById('gr-assign').value
    });
    closeModal(); toast('✓ Grievance filed', 'success'); navigate('grievances');
  };
}

function openGrievanceDetail(id) {
  const g = Store.getGrievances().find(x => x.id === id);
  if (!g) return;
  openModal({
    title: `Grievance — ${g.category}`,
    body: `
      <p style="font-size:12.5px;"><b>Filed By:</b> ${empName(g.empId)} &nbsp; <b>Date:</b> ${fmtDate(g.dateFiled)} &nbsp; <b>Assigned To:</b> ${empName(g.assignedTo)}</p>
      <p style="font-size:12.5px;white-space:pre-wrap;margin-top:10px;"><b>Description:</b><br>${escapeHtml(g.description)}</p>
      <div class="field" style="margin-top:14px;"><label>Resolution Notes</label><textarea id="gd-notes" placeholder="How was this resolved?">${escapeHtml(g.resolutionNotes||'')}</textarea></div>
    `,
    foot: `<button class="btn btn-outline" id="gd-close">Close</button><button class="btn btn-primary" id="gd-save">Save Notes</button>`
  });
  document.getElementById('gd-close').onclick = closeModal;
  document.getElementById('gd-save').onclick = () => {
    Store.updateGrievance(id, { resolutionNotes: document.getElementById('gd-notes').value.trim() });
    closeModal(); toast('✓ Notes saved', 'success'); navigate('grievances');
  };
}

function deleteGrievanceConfirm(id) { confirmAction('Delete this grievance record?', () => { Store.deleteGrievance(id); toast('Deleted', 'success'); navigate('grievances'); }); }
