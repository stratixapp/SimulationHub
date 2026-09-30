/* =========================================================
   maintenance.js — Facility Maintenance / Complaint Ticket Log
   Physical facility issues (AC, plumbing, IT equipment faults,
   furniture, cleaning) logged as tickets with priority, assigned
   to an internal handler or external vendor, and tracked to
   resolution — distinct from Grievances, which is about people
   issues, not physical facility faults.
   ========================================================= */

const TICKET_CATEGORIES = ['Electrical', 'Plumbing', 'IT Equipment', 'Furniture', 'Cleaning', 'Other'];
const TICKET_PRIORITIES = ['Urgent', 'High', 'Normal', 'Low'];
const TICKET_STATUSES = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

Modules.maintenance = function(container) {
  const items = Store.getMaintenanceTickets();
  const open = items.filter(t => t.status !== 'Resolved' && t.status !== 'Closed').length;
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Facility Maintenance Log</h1><p class="desc">Log physical office issues — electrical, plumbing, IT equipment, furniture — assign them, and track them to resolution.</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openTicketForm()">+ New Ticket</button></div>
    </div>
    <div class="grid grid-3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
      <div class="card stat-tile accent-clay"><div class="stat-label">Open Tickets</div><div class="stat-value">${open}</div></div>
      <div class="card stat-tile accent-amber"><div class="stat-label">Urgent</div><div class="stat-value">${items.filter(t=>t.priority==='Urgent' && t.status!=='Resolved' && t.status!=='Closed').length}</div></div>
      <div class="card stat-tile accent-sage"><div class="stat-label">Resolved</div><div class="stat-value">${items.filter(t=>t.status==='Resolved'||t.status==='Closed').length}</div></div>
    </div>
    ${items.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128295;</div><h4>No tickets logged</h4><p>Use "+ New Ticket" to report a facility issue.</p></div></div>` : `
    <div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Ticket No</th><th>Category</th><th>Location</th><th>Priority</th><th>Reported By</th><th>Assigned To</th><th>Status</th><th></th></tr></thead>
      <tbody>${items.map(t => `<tr>
        <td class="mono">${t.ticketNo}</td><td>${escapeHtml(t.category)}</td><td>${escapeHtml(t.location)}</td>
        <td><span class="badge ${t.priority==='Urgent'?'badge-rejected':t.priority==='High'?'badge-pending':'badge-info'}">${t.priority}</span></td>
        <td>${empName(t.reportedBy)}</td><td>${escapeHtml(t.assignedTo||'—')}</td>
        <td><select data-tkt-status="${t.id}" style="font-size:11.5px;padding:4px 6px;">${TICKET_STATUSES.map(s=>`<option ${s===t.status?'selected':''}>${s}</option>`).join('')}</select></td>
        <td style="white-space:nowrap;"><button class="btn btn-outline btn-sm" onclick="openTicketDetail('${t.id}')">Open</button> <button class="icon-action danger" onclick="deleteTicketConfirm('${t.id}')">&#128465;</button></td>
      </tr>`).join('')}</tbody>
    </table></div></div>`}
  `;
  document.querySelectorAll('[data-tkt-status]').forEach(sel => sel.onchange = (e) => {
    if (e.target.value === 'Resolved' || e.target.value === 'Closed') {
      const cur = Store.getMaintenanceTickets().find(x => x.id === e.target.dataset.tktStatus);
      if (!cur || !String(cur.resolutionNotes || '').trim()) {
        toast('Add resolution notes (open the ticket) before marking it Resolved or Closed', 'error');
        e.target.value = cur ? cur.status : 'Open';
        return;
      }
    }
    Store.updateMaintenanceTicket(e.target.dataset.tktStatus, { status: e.target.value }); toast('Status updated', 'success'); navigate('maintenance'); });
};

function openTicketForm() {
  const employees = Store.getEmployees();
  openModal({
    title: 'New Maintenance Ticket',
    body: `
      <div class="form-grid">
        <div class="field"><label>Category</label><select id="tk-cat">${TICKET_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Priority</label><select id="tk-priority">${TICKET_PRIORITIES.map(p=>`<option ${p==='Normal'?'selected':''}>${p}</option>`).join('')}</select></div>
        <div class="field span-2"><label>Location <span class="req">*</span></label><input id="tk-location" placeholder="e.g. 3rd Floor Conference Room A"></div>
        <div class="field span-2"><label>Description <span class="req">*</span></label><textarea id="tk-desc" placeholder="What is the issue?"></textarea></div>
        <div class="field"><label>Reported By</label><select id="tk-by"><option value="">— Select —</option>${employees.map(e=>`<option value="${e.id}">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</option>`).join('')}</select></div>
        <div class="field"><label>Assigned To (staff or vendor)</label><input id="tk-assigned" placeholder="e.g. Suresh Nambiar, or CoolAir AC Services"></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="tk-cancel">Cancel</button><button class="btn btn-primary" id="tk-save">Log Ticket</button>`
  });
  document.getElementById('tk-cancel').onclick = closeModal;
  document.getElementById('tk-save').onclick = () => {
    const location = document.getElementById('tk-location').value.trim();
    const description = document.getElementById('tk-desc').value.trim();
    if (!location || !description) return toast('Location and Description are required', 'error');
    const assignedTo = document.getElementById('tk-assigned').value.trim();
    Store.addMaintenanceTicket({
      category: document.getElementById('tk-cat').value, priority: document.getElementById('tk-priority').value,
      location, description, reportedBy: document.getElementById('tk-by').value,
      assignedTo, status: assignedTo ? 'Assigned' : 'Open', dateReported: todayISO()
    });
    closeModal(); toast('✓ Ticket logged', 'success'); navigate('maintenance');
  };
}

function openTicketDetail(id) {
  const t = Store.getMaintenanceTickets().find(x => x.id === id);
  if (!t) return;
  openModal({
    title: `${t.ticketNo} — ${t.category}`,
    body: `
      <p style="font-size:12.5px;"><b>Location:</b> ${escapeHtml(t.location)} &nbsp; <b>Priority:</b> ${t.priority} &nbsp; <b>Reported:</b> ${fmtDate(t.dateReported)}</p>
      <p style="font-size:12.5px;white-space:pre-wrap;margin-top:8px;"><b>Description:</b><br>${escapeHtml(t.description)}</p>
      <p style="font-size:12.5px;margin-top:8px;"><b>Reported By:</b> ${empName(t.reportedBy)} &nbsp; <b>Assigned To:</b> ${escapeHtml(t.assignedTo||'—')}</p>
      ${t.dateResolved ? `<p style="font-size:12.5px;"><b>Resolved On:</b> ${fmtDate(t.dateResolved)}</p>` : ''}
      <div class="field" style="margin-top:12px;"><label>Resolution Notes</label><textarea id="tkd-notes" placeholder="What was done to fix this?">${escapeHtml(t.resolutionNotes||'')}</textarea></div>
    `,
    foot: `<button class="btn btn-outline" id="tkd-close">Close</button><button class="btn btn-primary" id="tkd-save">Save Notes</button>`
  });
  document.getElementById('tkd-close').onclick = closeModal;
  document.getElementById('tkd-save').onclick = () => {
    Store.updateMaintenanceTicket(id, { resolutionNotes: document.getElementById('tkd-notes').value.trim() });
    closeModal(); toast('✓ Notes saved', 'success'); navigate('maintenance');
  };
}

function deleteTicketConfirm(id) { confirmAction('Delete this ticket?', () => { Store.deleteMaintenanceTicket(id); toast('Deleted', 'success'); navigate('maintenance'); }); }
