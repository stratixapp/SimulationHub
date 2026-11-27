/* =========================================================
   mailroom.js — Inward / Outward Mail & Dispatch Register
   Classic office-administration function: every letter, courier or
   parcel that enters or leaves the office is logged with a reference
   number, mode, and status — independent of Correspondence & Drafting,
   which is about the content students write, not the log of physical
   items moving in and out of the office.
   ========================================================= */

const MAIL_MODES = ['Post', 'Courier', 'Hand Delivery', 'Email', 'Fax'];
const INWARD_ACTIONS = ['Pending', 'Forwarded', 'Replied', 'Filed'];

let _mailView = 'inward'; // inward | outward

Modules.mailroom = function(container) {
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Mail &amp; Dispatch Register</h1><p class="desc">Log every letter, courier or parcel that enters or leaves the office — the classic inward/outward register every office keeps.</p></div>
      <div class="page-actions">
        <button class="btn btn-primary" id="mail-new">+ New ${_mailView === 'inward' ? 'Inward' : 'Outward'} Entry</button>
      </div>
    </div>
    <div class="tabs" style="margin-bottom:18px;">
      <button class="tab-btn ${_mailView==='inward'?'active':''}" data-v="inward">Inward Register (${Store.getInwardMail().length})</button>
      <button class="tab-btn ${_mailView==='outward'?'active':''}" data-v="outward">Outward Register (${Store.getOutwardMail().length})</button>
    </div>
    <div id="mail-mount"></div>
  `;
  document.querySelectorAll('.tab-btn[data-v]').forEach(b => b.onclick = () => { _mailView = b.dataset.v; navigate('mailroom'); });
  document.getElementById('mail-new').onclick = () => _mailView === 'inward' ? openInwardForm() : openOutwardForm();
  renderMailView();
};

function renderMailView() {
  const mount = document.getElementById('mail-mount');
  if (_mailView === 'inward') {
    const items = Store.getInwardMail();
    mount.innerHTML = items.length === 0 ? emptyMailState('inward') : `
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Ref No</th><th>Date</th><th>From</th><th>Mode</th><th>Subject</th><th>Addressed To</th><th>Action</th><th></th></tr></thead>
        <tbody>${items.map(m => `<tr>
          <td class="mono">${m.refNo}</td>
          <td>${fmtDate(m.date)}</td>
          <td>${escapeHtml(m.from)}</td>
          <td>${escapeHtml(m.mode)}</td>
          <td>${escapeHtml(m.subject)}</td>
          <td>${escapeHtml(m.addressedTo||'—')}</td>
          <td><select data-mail-action="${m.id}" style="font-size:11.5px;padding:4px 6px;">${INWARD_ACTIONS.map(a=>`<option ${a===m.action?'selected':''}>${a}</option>`).join('')}</select></td>
          <td><button class="icon-action danger" onclick="deleteInwardConfirm('${m.id}')">&#128465;</button></td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;
    document.querySelectorAll('[data-mail-action]').forEach(sel => sel.onchange = (e) => {
      Store.updateInwardMail(e.target.dataset.mailAction, { action: e.target.value });
      toast('Status updated', 'success');
    });
  } else {
    const items = Store.getOutwardMail();
    mount.innerHTML = items.length === 0 ? emptyMailState('outward') : `
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Ref No</th><th>Date</th><th>To</th><th>Mode</th><th>Subject</th><th>Dispatched By</th><th>Tracking No.</th><th></th></tr></thead>
        <tbody>${items.map(m => `<tr>
          <td class="mono">${m.refNo}</td>
          <td>${fmtDate(m.date)}</td>
          <td>${escapeHtml(m.to)}</td>
          <td>${escapeHtml(m.mode)}</td>
          <td>${escapeHtml(m.subject)}</td>
          <td>${escapeHtml(m.dispatchedBy||'—')}</td>
          <td class="mono">${escapeHtml(m.trackingNo||'—')}</td>
          <td><button class="icon-action danger" onclick="deleteOutwardConfirm('${m.id}')">&#128465;</button></td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;
  }
}

function emptyMailState(kind) {
  return `<div class="card"><div class="empty-state"><div class="ic">&#128231;</div><h4>No ${kind} mail logged yet</h4><p>Use "+ New ${kind === 'inward' ? 'Inward' : 'Outward'} Entry" to log your first item.</p></div></div>`;
}

function openInwardForm() {
  const employees = Store.getEmployees();
  openModal({
    title: 'New Inward Mail Entry',
    body: `
      <div class="form-grid">
        <div class="field"><label>Date Received <span class="req">*</span></label><input type="date" id="im-date" value="${todayISO()}"></div>
        <div class="field"><label>Received From <span class="req">*</span></label><input id="im-from" placeholder="e.g. Om Traders, or a person's name"></div>
        <div class="field"><label>Mode</label><select id="im-mode">${MAIL_MODES.map(m=>`<option>${m}</option>`).join('')}</select></div>
        <div class="field span-2"><label>Subject <span class="req">*</span></label><input id="im-subject" placeholder="What is this mail about?"></div>
        <div class="field"><label>Addressed To</label><select id="im-to"><option value="">— Not employee-specific —</option>${employees.map(e=>`<option>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)} (${escapeHtml(e.department)})</option>`).join('')}</select></div>
        <div class="field"><label>Received By</label><select id="im-by"><option value="">— Select —</option>${employees.map(e=>`<option>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</option>`).join('')}</select></div>
        <div class="field"><label>Action Status</label><select id="im-action">${INWARD_ACTIONS.map(a=>`<option>${a}</option>`).join('')}</select></div>
        <div class="field span-3"><label>Remarks</label><textarea id="im-remarks" placeholder="Any additional notes"></textarea></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="im-cancel">Cancel</button><button class="btn btn-primary" id="im-save">Log Entry</button>`
  });
  document.getElementById('im-cancel').onclick = closeModal;
  document.getElementById('im-save').onclick = () => {
    const from = document.getElementById('im-from').value.trim();
    const subject = document.getElementById('im-subject').value.trim();
    if (!from || !subject) return toast('Received From and Subject are required', 'error');
    Store.addInwardMail({
      date: document.getElementById('im-date').value,
      from, subject,
      mode: document.getElementById('im-mode').value,
      addressedTo: document.getElementById('im-to').value,
      receivedBy: document.getElementById('im-by').value,
      action: document.getElementById('im-action').value,
      remarks: document.getElementById('im-remarks').value.trim()
    });
    closeModal(); toast('✓ Inward mail logged', 'success'); navigate('mailroom');
  };
}

function openOutwardForm() {
  openModal({
    title: 'New Outward Mail Entry',
    body: `
      <div class="form-grid">
        <div class="field"><label>Date Sent <span class="req">*</span></label><input type="date" id="om-date" value="${todayISO()}"></div>
        <div class="field"><label>Sent To <span class="req">*</span></label><input id="om-to" placeholder="e.g. Om Traders, or a person's name"></div>
        <div class="field"><label>Mode</label><select id="om-mode">${MAIL_MODES.map(m=>`<option>${m}</option>`).join('')}</select></div>
        <div class="field span-2"><label>Subject <span class="req">*</span></label><input id="om-subject" placeholder="What is being sent?"></div>
        <div class="field"><label>Dispatched By</label><select id="om-by"><option value="">— Select —</option>${Store.getEmployees().map(e=>`<option>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</option>`).join('')}</select></div>
        <div class="field"><label>Tracking / Postal No.</label><input id="om-tracking" placeholder="Optional"></div>
        <div class="field span-3"><label>Remarks</label><textarea id="om-remarks" placeholder="Any additional notes"></textarea></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="om-cancel">Cancel</button><button class="btn btn-primary" id="om-save">Log Entry</button>`
  });
  document.getElementById('om-cancel').onclick = closeModal;
  document.getElementById('om-save').onclick = () => {
    const to = document.getElementById('om-to').value.trim();
    const subject = document.getElementById('om-subject').value.trim();
    if (!to || !subject) return toast('Sent To and Subject are required', 'error');
    Store.addOutwardMail({
      date: document.getElementById('om-date').value,
      to, subject,
      mode: document.getElementById('om-mode').value,
      dispatchedBy: document.getElementById('om-by').value,
      trackingNo: document.getElementById('om-tracking').value.trim(),
      remarks: document.getElementById('om-remarks').value.trim()
    });
    closeModal(); toast('✓ Outward mail logged', 'success'); navigate('mailroom');
  };
}

function deleteInwardConfirm(id) { confirmAction('Delete this inward mail entry?', () => { Store.deleteInwardMail(id); toast('Deleted', 'success'); navigate('mailroom'); }); }
function deleteOutwardConfirm(id) { confirmAction('Delete this outward mail entry?', () => { Store.deleteOutwardMail(id); toast('Deleted', 'success'); navigate('mailroom'); }); }
