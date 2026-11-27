/* =========================================================
   meetings.js — Meetings & Minutes
   Schedule a meeting with an agenda and attendee list, then record
   Minutes of Meeting (MoM) with an action-items tracker, and print
   a formal MoM document on the simulated company's letterhead.
   ========================================================= */

let _miActionItems = []; // working state while the "Add Minutes" modal is open

Modules.meetings = function(container) {
  const items = Store.getMeetings().slice().sort((a,b) => (b.date+b.time).localeCompare(a.date+a.time));
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Meetings &amp; Minutes</h1><p class="desc">Schedule meetings with an agenda, then record Minutes of Meeting with tracked action items — and print a formal MoM.</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openMeetingForm()">+ Schedule Meeting</button></div>
    </div>
    ${items.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128197;</div><h4>No meetings scheduled yet</h4><p>Use "+ Schedule Meeting" to plan your first one.</p></div></div>` : `
    <div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Title</th><th>Date</th><th>Time</th><th>Venue</th><th>Attendees</th><th>Status</th><th></th></tr></thead>
      <tbody>${items.map(m => `<tr>
        <td>${escapeHtml(m.title)}</td><td>${fmtDate(m.date)}</td><td>${m.time}</td><td>${escapeHtml(m.venue||'—')}</td>
        <td>${(m.attendeeIds||[]).length}</td>
        <td><span class="badge ${m.status==='Completed'?'badge-approved':'badge-pending'}">${m.status}</span></td>
        <td style="white-space:nowrap;">
          <button class="btn btn-outline btn-sm" onclick="openMeetingDetail('${m.id}')">Open</button>
          <button class="icon-action danger" onclick="deleteMeetingConfirm('${m.id}')">&#128465;</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div></div>`}
  `;
};

function openMeetingForm() {
  const employees = Store.getEmployees();
  openModal({
    title: 'Schedule a Meeting', wide: true,
    body: `
      <div class="form-grid">
        <div class="field span-2"><label>Meeting Title <span class="req">*</span></label><input id="mf-title" placeholder="e.g. Monthly Department Review"></div>
        <div class="field"><label>Date</label><input type="date" id="mf-date" value="${todayISO()}"></div>
        <div class="field"><label>Time</label><input type="time" id="mf-time" value="11:00"></div>
        <div class="field span-2"><label>Venue</label><input id="mf-venue" placeholder="e.g. Conference Room A"></div>
        <div class="field span-2"><label>Attendees</label>
          <div style="max-height:140px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;padding:10px;">
            ${employees.length === 0 ? '<p class="text-dim" style="font-size:12px;">Add employees first (Unit 1).</p>' : employees.map(e => `
              <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:3px 0;">
                <input type="checkbox" class="mf-attendee" value="${e.id}" style="width:auto;">
                ${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)} — ${escapeHtml(e.department)}
              </label>`).join('')}
          </div>
        </div>
        <div class="field span-2"><label>Agenda (one item per line) <span class="req">*</span></label>
          <textarea id="mf-agenda" style="min-height:100px;" placeholder="Review of last month's targets&#10;Budget approval for Q4&#10;Any other business"></textarea>
        </div>
      </div>`,
    foot: `<button class="btn btn-outline" id="mf-cancel">Cancel</button><button class="btn btn-primary" id="mf-save">Schedule</button>`
  });
  document.getElementById('mf-cancel').onclick = closeModal;
  document.getElementById('mf-save').onclick = () => {
    const title = document.getElementById('mf-title').value.trim();
    const agendaRaw = document.getElementById('mf-agenda').value.trim();
    if (!title || !agendaRaw) return toast('Title and Agenda are required', 'error');
    const attendeeIds = Array.from(document.querySelectorAll('.mf-attendee:checked')).map(el => el.value);
    Store.addMeeting({
      title,
      date: document.getElementById('mf-date').value,
      time: document.getElementById('mf-time').value,
      venue: document.getElementById('mf-venue').value.trim(),
      attendeeIds,
      agenda: agendaRaw.split('\n').map(s => s.trim()).filter(Boolean)
    });
    closeModal(); toast('✓ Meeting scheduled', 'success'); navigate('meetings');
  };
}

function empLabel(id) {
  const e = Store.getEmployees().find(x => x.id === id);
  return e ? `${e.firstName} ${e.lastName}` : '—';
}

function openMeetingDetail(id) {
  const m = Store.getMeeting(id);
  if (!m) return;
  const hasMinutes = m.status === 'Completed';
  openModal({
    title: m.title, wide: true,
    body: `
      <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:14px;">
        <div><b>Date</b><br>${fmtDate(m.date)}</div>
        <div><b>Time</b><br>${m.time}</div>
        <div><b>Venue</b><br>${escapeHtml(m.venue||'—')}</div>
      </div>
      <b>Attendees:</b> ${(m.attendeeIds||[]).map(empLabel).join(', ') || '—'}
      <h3 style="font-size:13.5px;margin:14px 0 6px;">Agenda</h3>
      <ol style="margin:0;padding-left:18px;font-size:12.5px;">${(m.agenda||[]).map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ol>
      ${hasMinutes ? `
        <h3 style="font-size:13.5px;margin:16px 0 6px;">Discussion</h3>
        <p style="font-size:12.5px;white-space:pre-wrap;">${escapeHtml(m.minutes.discussion || '—')}</p>
        <h3 style="font-size:13.5px;margin:16px 0 6px;">Action Items</h3>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>Task</th><th>Owner</th><th>Due Date</th><th>Status</th></tr></thead>
        <tbody>${(m.minutes.actionItems||[]).map(ai => `<tr><td>${escapeHtml(ai.task)}</td><td>${empLabel(ai.ownerId)}</td><td>${ai.dueDate?fmtDate(ai.dueDate):'—'}</td><td><select data-ai-status="${(m.minutes.actionItems||[]).indexOf(ai)}" style="font-size:11.5px;padding:4px 6px;">${['Pending','In Progress','Done'].map(s=>`<option ${s===ai.status?'selected':''}>${s}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
      ` : `<p class="text-dim" style="font-size:12px;margin-top:14px;">Minutes not recorded yet.</p>`}
    `,
    foot: `
      <button class="btn btn-outline" id="md-close">Close</button>
      ${hasMinutes ? `<button class="btn btn-primary" id="md-print">&#128438; Print MoM</button>` : `<button class="btn btn-primary" id="md-minutes">Add Minutes</button>`}
    `
  });
  document.getElementById('md-close').onclick = closeModal;
  document.querySelectorAll('[data-ai-status]').forEach(sel => sel.onchange = (ev) => {
    const items = (m.minutes.actionItems || []).map(x => Object.assign({}, x));
    const idx = Number(ev.target.dataset.aiStatus);
    if (!items[idx]) return;
    items[idx].status = ev.target.value;
    Store.updateMeeting(m.id, { minutes: Object.assign({}, m.minutes, { actionItems: items }) });
    m.minutes.actionItems = items;
    toast('Action item marked ' + ev.target.value, 'success');
  });
  if (hasMinutes) document.getElementById('md-print').onclick = () => { closeModal(); printMinutes(m); };
  else document.getElementById('md-minutes').onclick = () => { closeModal(); openMinutesForm(m); };
}

function openMinutesForm(meeting) {
  _miActionItems = [{ task: '', ownerId: '', dueDate: '', status: 'Pending' }];
  openModal({
    title: `Record Minutes — ${meeting.title}`, wide: true,
    body: `
      <div class="field"><label>Discussion Summary <span class="req">*</span></label><textarea id="mm-discussion" style="min-height:100px;" placeholder="Summarize what was discussed under each agenda point"></textarea></div>
      <h3 style="font-size:13.5px;margin:16px 0 8px;">Action Items</h3>
      <div id="mm-items"></div>
      <button class="btn btn-outline btn-sm" id="mm-add-item" style="margin-top:8px;">+ Add Action Item</button>
    `,
    foot: `<button class="btn btn-outline" id="mm-cancel">Cancel</button><button class="btn btn-primary" id="mm-save">Finalize Minutes</button>`
  });
  document.getElementById('mm-cancel').onclick = closeModal;
  document.getElementById('mm-add-item').onclick = () => { _miActionItems.push({ task: '', ownerId: '', dueDate: '', status: 'Pending' }); renderMinutesItems(); };
  renderMinutesItems();
  document.getElementById('mm-save').onclick = () => {
    const discussion = document.getElementById('mm-discussion').value.trim();
    if (!discussion) return toast('Discussion summary is required', 'error');
    syncMinutesItemsFromDOM();
    const actionItems = _miActionItems.filter(ai => ai.task.trim());
    Store.updateMeeting(meeting.id, { status: 'Completed', minutes: { discussion, actionItems } });
    closeModal(); toast('✓ Minutes finalized', 'success'); navigate('meetings');
  };
}

function renderMinutesItems() {
  const employees = Store.getEmployees();
  const mount = document.getElementById('mm-items');
  mount.innerHTML = _miActionItems.map((ai, i) => `
    <div style="display:grid;grid-template-columns:2fr 1.4fr 1fr 1fr auto;gap:6px;margin-bottom:6px;align-items:center;">
      <input class="mm-task" data-i="${i}" placeholder="Task" value="${escapeHtml(ai.task)}">
      <select class="mm-owner" data-i="${i}"><option value="">— Owner —</option>${employees.map(e=>`<option value="${e.id}" ${e.id===ai.ownerId?'selected':''}>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</option>`).join('')}</select>
      <input type="date" class="mm-due" data-i="${i}" value="${ai.dueDate}">
      <select class="mm-status" data-i="${i}"><option ${ai.status==='Pending'?'selected':''}>Pending</option><option ${ai.status==='Done'?'selected':''}>Done</option></select>
      <button class="icon-action danger" onclick="removeMinutesItem(${i})">&#128465;</button>
    </div>`).join('');
}

function removeMinutesItem(i) { syncMinutesItemsFromDOM(); _miActionItems.splice(i, 1); if (_miActionItems.length === 0) _miActionItems.push({ task:'', ownerId:'', dueDate:'', status:'Pending' }); renderMinutesItems(); }

function syncMinutesItemsFromDOM() {
  document.querySelectorAll('.mm-task').forEach(el => _miActionItems[+el.dataset.i].task = el.value);
  document.querySelectorAll('.mm-owner').forEach(el => _miActionItems[+el.dataset.i].ownerId = el.value);
  document.querySelectorAll('.mm-due').forEach(el => _miActionItems[+el.dataset.i].dueDate = el.value);
  document.querySelectorAll('.mm-status').forEach(el => _miActionItems[+el.dataset.i].status = el.value);
}

function deleteMeetingConfirm(id) { confirmAction('Delete this meeting and its minutes?', () => { Store.deleteMeeting(id); toast('Deleted', 'success'); navigate('meetings'); }); }

function printMinutes(m) {
  const meta = Store.load().meta;
  const co = escapeHtml(meta.institution);
  const docHtml = `<div class="doc-page" id="doc-render-target">
    <div class="doc-watermark"><span>${co.toUpperCase()}</span></div>
    ${letterheadHTML('Minutes of Meeting')}
    <div class="doc-ref-row"><span>Date: ${fmtDate(m.date)} &nbsp; Time: ${m.time}</span><span>Venue: ${escapeHtml(m.venue||'—')}</span></div>
    <div class="doc-title">MINUTES OF MEETING</div>
    <p style="font-size:12.5px;"><b>${escapeHtml(m.title)}</b></p>
    <p style="font-size:12.5px;"><b>Attendees:</b> ${(m.attendeeIds||[]).map(empLabel).join(', ') || '—'}</p>
    <h4 style="font-size:12.5px;margin:14px 0 4px;">Agenda</h4>
    <ol style="margin:0 0 12px;padding-left:18px;font-size:12.5px;">${(m.agenda||[]).map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ol>
    <h4 style="font-size:12.5px;margin:14px 0 4px;">Discussion</h4>
    <p style="font-size:12.5px;white-space:pre-wrap;">${escapeHtml(m.minutes.discussion)}</p>
    <h4 style="font-size:12.5px;margin:14px 0 4px;">Action Items</h4>
    <table class="doc-table"><thead><tr><th>Task</th><th>Owner</th><th>Due Date</th><th>Status</th></tr></thead>
    <tbody>${(m.minutes.actionItems||[]).map(ai => `<tr><td>${escapeHtml(ai.task)}</td><td>${empLabel(ai.ownerId)}</td><td>${ai.dueDate?fmtDate(ai.dueDate):'—'}</td><td>${ai.status}</td></tr>`).join('')}</tbody></table>
    <div class="doc-signoff">
      <div class="sig-block"><div class="sig-line"></div>Minutes Recorded By</div>
      <div class="sig-block"><div class="sig-line"></div>For ${co}<br>Authorized Signatory</div>
    </div>
  </div>`;
  printArea(docHtml);
  toast('✓ Minutes printed', 'success');
}
