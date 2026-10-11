/* =========================================================
   frontoffice.js — Front Office & Reception
   Three classic reception-desk registers in one module: Visitor
   Register (check-in/out), Appointment Scheduler, and Telephone
   Call Log — the day-to-day work of a front-office executive that
   nothing else in the simulator covers.
   ========================================================= */

let _foView = 'visitors'; // visitors | appointments | calls

Modules.frontoffice = function(container) {
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Front Office &amp; Reception</h1><p class="desc">Run the reception desk — check visitors in and out, schedule appointments, and log telephone calls and messages.</p></div>
      <div class="page-actions"><button class="btn btn-primary" id="fo-new"></button></div>
    </div>
    <div class="tabs" style="margin-bottom:18px;">
      <button class="tab-btn ${_foView==='visitors'?'active':''}" data-v="visitors">Visitor Register (${Store.getVisitors().length})</button>
      <button class="tab-btn ${_foView==='appointments'?'active':''}" data-v="appointments">Appointments (${Store.getAppointments().length})</button>
      <button class="tab-btn ${_foView==='calls'?'active':''}" data-v="calls">Telephone Call Log (${Store.getCallLog().length})</button>
    </div>
    <div id="fo-mount"></div>
  `;
  document.querySelectorAll('.tab-btn[data-v]').forEach(b => b.onclick = () => { _foView = b.dataset.v; navigate('frontoffice'); });
  const newBtn = document.getElementById('fo-new');
  if (_foView === 'visitors') { newBtn.textContent = '+ Check In Visitor'; newBtn.onclick = openVisitorForm; }
  else if (_foView === 'appointments') { newBtn.textContent = '+ Schedule Appointment'; newBtn.onclick = openAppointmentForm; }
  else { newBtn.textContent = '+ Log Call'; newBtn.onclick = openCallForm; }
  renderFrontOfficeView();
};

function empName(id) {
  const e = Store.getEmployees().find(x => x.id === id);
  return e ? `${e.firstName} ${e.lastName}` : '—';
}

function renderFrontOfficeView() {
  const mount = document.getElementById('fo-mount');
  if (_foView === 'visitors') {
    const items = Store.getVisitors();
    mount.innerHTML = items.length === 0 ? emptyFoState('No visitors checked in yet', 'Use "+ Check In Visitor" to log the first one.') : `
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Badge</th><th>Name</th><th>Company</th><th>Purpose</th><th>To Meet</th><th>Time In</th><th>Time Out</th><th></th></tr></thead>
        <tbody>${items.map(v => `<tr>
          <td class="mono">${v.badgeNo}</td><td>${escapeHtml(v.name)}</td><td>${escapeHtml(v.company||'—')}</td>
          <td>${escapeHtml(v.purpose)}</td><td>${empName(v.whomToMeet)}</td>
          <td>${v.timeIn}</td>
          <td>${v.timeOut ? v.timeOut : `<button class="btn btn-outline btn-sm" onclick="checkOutVisitorNow('${v.id}')">Check Out</button>`}</td>
          <td><button class="icon-action danger" onclick="deleteVisitorConfirm('${v.id}')">&#128465;</button></td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;
  } else if (_foView === 'appointments') {
    const items = Store.getAppointments().slice().sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
    mount.innerHTML = items.length === 0 ? emptyFoState('No appointments scheduled', 'Use "+ Schedule Appointment" to book the first one.') : `
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Time</th><th>Visitor / Client</th><th>Purpose</th><th>With</th><th>Status</th><th></th></tr></thead>
        <tbody>${items.map(a => `<tr>
          <td>${fmtDate(a.date)}</td><td>${a.time}</td><td>${escapeHtml(a.visitorName)}</td>
          <td>${escapeHtml(a.purpose)}${a.notes ? `<div style="font-size:11.5px;color:var(--text-dim);">Note: ${escapeHtml(a.notes)}</div>` : ''}</td><td>${empName(a.withEmpId)}</td>
          <td><select data-apt-status="${a.id}" style="font-size:11.5px;padding:4px 6px;">${['Scheduled','Completed','Cancelled'].map(s=>`<option ${s===a.status?'selected':''}>${s}</option>`).join('')}</select></td>
          <td><div class="actions-cell"><button class="icon-action" title="Edit / Reschedule" onclick="openAppointmentForm('${a.id}')">Edit</button><button class="icon-action danger" onclick="deleteAppointmentConfirm('${a.id}')">&#128465;</button></div></td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;
    document.querySelectorAll('[data-apt-status]').forEach(sel => sel.onchange = (e) => {
      Store.updateAppointment(e.target.dataset.aptStatus, { status: e.target.value });
      toast('Status updated', 'success');
    });
  } else {
    const items = Store.getCallLog();
    mount.innerHTML = items.length === 0 ? emptyFoState('No calls logged yet', 'Use "+ Log Call" to record the first one.') : `
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Time</th><th>Direction</th><th>Caller / Recipient</th><th>For</th><th>Message</th><th>Callback?</th><th></th></tr></thead>
        <tbody>${items.map(c => `<tr>
          <td>${fmtDate(c.date)}</td><td>${c.time}</td>
          <td><span class="badge ${c.direction==='Incoming'?'badge-info':'badge-pending'}">${c.direction}</span></td>
          <td>${escapeHtml(c.party)}</td><td>${empName(c.forEmpId)}</td>
          <td>${escapeHtml(c.message||'—')}</td><td>${c.callBack ? 'Yes' : 'No'}</td>
          <td><button class="icon-action danger" onclick="deleteCallConfirm('${c.id}')">&#128465;</button></td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;
  }
}

function emptyFoState(title, sub) {
  return `<div class="card"><div class="empty-state"><div class="ic">&#127970;</div><h4>${title}</h4><p>${sub}</p></div></div>`;
}

function openVisitorForm() {
  const employees = Store.getEmployees();
  const now = new Date().toTimeString().slice(0,5);
  openModal({
    title: 'Check In a Visitor',
    body: `
      <div class="form-grid">
        <div class="field"><label>Visitor Name <span class="req">*</span></label><input id="v-name" placeholder="Full name"></div>
        <div class="field"><label>Company / Organization</label><input id="v-company"></div>
        <div class="field span-2"><label>Purpose of Visit <span class="req">*</span></label><input id="v-purpose" placeholder="e.g. Meeting, Interview, Delivery"></div>
        <div class="field"><label>Whom to Meet</label><select id="v-whom"><option value="">— Select —</option>${employees.map(e=>`<option value="${e.id}">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)} (${escapeHtml(e.department)})</option>`).join('')}</select></div>
        <div class="field"><label>Time In</label><input type="time" id="v-timein" value="${now}"></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="v-cancel">Cancel</button><button class="btn btn-primary" id="v-save">Check In</button>`
  });
  document.getElementById('v-cancel').onclick = closeModal;
  document.getElementById('v-save').onclick = () => {
    const name = document.getElementById('v-name').value.trim();
    const purpose = document.getElementById('v-purpose').value.trim();
    if (!name || !purpose) return toast('Visitor Name and Purpose are required', 'error');
    Store.addVisitor({
      name, purpose,
      company: document.getElementById('v-company').value.trim(),
      whomToMeet: document.getElementById('v-whom').value,
      date: todayISO(),
      timeIn: document.getElementById('v-timein').value
    });
    closeModal(); toast('✓ Visitor checked in', 'success'); navigate('frontoffice');
  };
}

function checkOutVisitorNow(id) {
  Store.checkOutVisitor(id, new Date().toTimeString().slice(0,5));
  toast('Visitor checked out', 'success');
  navigate('frontoffice');
}

function deleteVisitorConfirm(id) { confirmAction('Delete this visitor entry?', () => { Store.deleteVisitor(id); toast('Deleted', 'success'); navigate('frontoffice'); }); }

function openAppointmentForm(editId) {
  const employees = Store.getEmployees();
  const editing = editId ? Store.getAppointments().find(x => x.id === editId) : null;
  openModal({
    title: editing ? 'Edit / Reschedule Appointment' : 'Schedule an Appointment',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label>Visitor / Client Name <span class="req">*</span></label><input id="a-name" placeholder="Full name"></div>
        <div class="field span-2"><label>Purpose <span class="req">*</span></label><input id="a-purpose"></div>
        <div class="field"><label>Date</label><input type="date" id="a-date" value="${todayISO()}"></div>
        <div class="field"><label>Time</label><input type="time" id="a-time" value="10:00"></div>
        <div class="field span-2"><label>With (Employee)</label><select id="a-with"><option value="">— Select —</option>${employees.map(e=>`<option value="${e.id}">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)} (${escapeHtml(e.department)})</option>`).join('')}</select></div>
        <div class="field span-2"><label>Notes</label><input id="a-notes" placeholder="e.g. Visitor called to say they will arrive 30 minutes late"></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="a-cancel">Cancel</button><button class="btn btn-primary" id="a-save">${editing ? 'Save Changes' : 'Schedule'}</button>`
  });
  if (editing) {
    document.getElementById('a-name').value = editing.visitorName || '';
    document.getElementById('a-purpose').value = editing.purpose || '';
    document.getElementById('a-date').value = editing.date || todayISO();
    document.getElementById('a-time').value = editing.time || '10:00';
    document.getElementById('a-with').value = editing.withEmpId || '';
    document.getElementById('a-notes').value = editing.notes || '';
  }
  document.getElementById('a-cancel').onclick = closeModal;
  document.getElementById('a-save').onclick = () => {
    const visitorName = document.getElementById('a-name').value.trim();
    const purpose = document.getElementById('a-purpose').value.trim();
    if (!visitorName || !purpose) return toast('Name and Purpose are required', 'error');
    const data = {
      visitorName, purpose,
      withEmpId: document.getElementById('a-with').value,
      date: document.getElementById('a-date').value,
      time: document.getElementById('a-time').value,
      notes: document.getElementById('a-notes').value.trim()
    };
    if (editing) Store.updateAppointment(editing.id, data); else Store.addAppointment(data);
    closeModal(); toast(editing ? '✓ Appointment updated' : '✓ Appointment scheduled', 'success'); navigate('frontoffice');
  };
}

function deleteAppointmentConfirm(id) { confirmAction('Delete this appointment?', () => { Store.deleteAppointment(id); toast('Deleted', 'success'); navigate('frontoffice'); }); }

function openCallForm() {
  const employees = Store.getEmployees();
  const now = new Date().toTimeString().slice(0,5);
  openModal({
    title: 'Log a Telephone Call',
    body: `
      <div class="form-grid">
        <div class="field"><label>Direction</label><select id="c-dir"><option>Incoming</option><option>Outgoing</option></select></div>
        <div class="field"><label>Date / Time</label><div style="display:flex;gap:6px;"><input type="date" id="c-date" value="${todayISO()}"><input type="time" id="c-time" value="${now}"></div></div>
        <div class="field span-2"><label>Caller / Recipient Name <span class="req">*</span></label><input id="c-party" placeholder="Who called, or who was called"></div>
        <div class="field span-2"><label>For (Employee)</label><select id="c-for"><option value="">— Select —</option>${employees.map(e=>`<option value="${e.id}">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</option>`).join('')}</select></div>
        <div class="field span-2"><label>Message</label><textarea id="c-message" placeholder="Message taken, or summary of the call"></textarea></div>
        <div class="field span-2"><label><input type="checkbox" id="c-callback" style="width:auto;display:inline-block;margin-right:6px;">Needs a callback</label></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="c-cancel">Cancel</button><button class="btn btn-primary" id="c-save">Log Call</button>`
  });
  document.getElementById('c-cancel').onclick = closeModal;
  document.getElementById('c-save').onclick = () => {
    const party = document.getElementById('c-party').value.trim();
    if (!party) return toast('Caller/Recipient name is required', 'error');
    Store.addCallLog({
      direction: document.getElementById('c-dir').value,
      date: document.getElementById('c-date').value,
      time: document.getElementById('c-time').value,
      party,
      forEmpId: document.getElementById('c-for').value,
      message: document.getElementById('c-message').value.trim(),
      callBack: document.getElementById('c-callback').checked
    });
    closeModal(); toast('✓ Call logged', 'success'); navigate('frontoffice');
  };
}

function deleteCallConfirm(id) { confirmAction('Delete this call log entry?', () => { Store.deleteCallLog(id); toast('Deleted', 'success'); navigate('frontoffice'); }); }
