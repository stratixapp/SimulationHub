/* =========================================================
   diary.js — Executive Calendar / Diary Management
   The classic PA/EA task: manage one executive's daily schedule,
   check for double-booking, find a free slot for a new request,
   and print a clean daily agenda — separate from Meetings &
   Minutes (which is about the meeting's content and MoM, not
   whose personal calendar it sits on) and Room Booking (which is
   about the room, not the person).
   ========================================================= */

const DIARY_TYPES = ['Meeting', 'Call', 'Travel', 'Personal', 'Reminder'];

let _diaryOwner = null;
let _diaryDate = todayISO();

Modules.diary = function(container) {
  const employees = Store.getEmployees();
  if (!_diaryOwner && employees.length) _diaryOwner = employees[0].id;
  const entries = Store.getDiaryEntries(_diaryOwner).filter(e => e.date === _diaryDate).sort((a,b) => a.startTime.localeCompare(b.startTime));
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Executive Calendar &amp; Diary</h1><p class="desc">Manage one executive's daily schedule — book entries without double-booking, find a free slot, and print the daily agenda.</p></div>
      <div class="page-actions"><button class="btn btn-outline" onclick="openFreeSlotFinder()">&#128269; Find Free Slot</button> <button class="btn btn-primary" onclick="openDiaryEntryForm()">+ New Entry</button></div>
    </div>
    <div class="card card-pad" style="margin-bottom:18px;display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;">
      <div class="field" style="margin:0;min-width:220px;"><label>Executive</label><select id="dy-owner">${employees.map(e=>`<option value="${e.id}" ${e.id===_diaryOwner?'selected':''}>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)} — ${escapeHtml(e.designation)}</option>`).join('')}</select></div>
      <div class="field" style="margin:0;"><label>Date</label><input type="date" id="dy-date" value="${_diaryDate}"></div>
      <button class="btn btn-outline btn-sm" onclick="printDailyAgenda()">&#128438; Print Daily Agenda</button>
    </div>
    <div class="card">
      <div class="card-head"><h3>${fmtDate(_diaryDate)} — Schedule</h3></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Time</th><th>Title</th><th>Type</th><th>Status</th><th></th></tr></thead>
        <tbody>${entries.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);">No entries for this date</td></tr>` : entries.map(e => `<tr>
          <td>${e.startTime}–${e.endTime}</td><td>${escapeHtml(e.title)}</td><td><span class="badge badge-info">${e.type}</span></td>
          <td><select data-dy-status="${e.id}" style="font-size:11.5px;padding:4px 6px;">${['Scheduled','Completed','Rescheduled','Cancelled'].map(s=>`<option ${s===e.status?'selected':''}>${s}</option>`).join('')}</select></td>
          <td><div class="actions-cell"><button class="icon-action" title="Reschedule" onclick="openDiaryRescheduleForm('${e.id}')">Reschedule</button><button class="icon-action danger" onclick="deleteDiaryEntryConfirm('${e.id}')">&#128465;</button></div></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>
  `;
  document.getElementById('dy-owner').onchange = (e) => { _diaryOwner = e.target.value; navigate('diary'); };
  document.getElementById('dy-date').onchange = (e) => { _diaryDate = e.target.value; navigate('diary'); };
  document.querySelectorAll('[data-dy-status]').forEach(sel => sel.onchange = (e) => { Store.updateDiaryEntry(e.target.dataset.dyStatus, { status: e.target.value }); toast('Status updated', 'success'); });
};

function openDiaryRescheduleForm(id) {
  const entry = Store.getDiaryEntries(_diaryOwner).find(x => x.id === id);
  if (!entry) return;
  openModal({
    title: 'Reschedule Entry',
    narrow: true,
    body: `<p style="font-size:13px;margin-bottom:12px;"><b>${escapeHtml(entry.title)}</b></p>
      <div class="form-grid">
        <div class="field span-2"><label>New Date</label><input type="date" id="rs-d-date" value="${entry.date}"></div>
        <div class="field"><label>Start</label><input type="time" id="rs-d-start" value="${entry.startTime}"></div>
        <div class="field"><label>End</label><input type="time" id="rs-d-end" value="${entry.endTime}"></div>
      </div>
      <p id="rs-d-conflict" style="font-size:12px;color:#B4553F;margin-top:8px;"></p>`,
    foot: `<button class="btn btn-outline" id="rs-d-cancel">Cancel</button><button class="btn btn-primary" id="rs-d-save">Reschedule</button>`
  });
  document.getElementById('rs-d-cancel').onclick = closeModal;
  document.getElementById('rs-d-save').onclick = () => {
    const date = document.getElementById('rs-d-date').value;
    const s = document.getElementById('rs-d-start').value, e = document.getElementById('rs-d-end').value;
    if (!date || !s || !e || e <= s) return toast('End time must be after start time', 'error');
    if (Store.diaryConflict(entry.ownerId, date, s, e, entry.id)) {
      document.getElementById('rs-d-conflict').textContent = 'This executive already has an entry overlapping this time slot on this date.';
      return;
    }
    Store.updateDiaryEntry(entry.id, { date, startTime: s, endTime: e, status: 'Rescheduled' });
    closeModal(); toast('✓ Entry rescheduled', 'success'); navigate('diary');
  };
}

function openDiaryEntryForm(prefillStart, prefillEnd) {
  openModal({
    title: 'New Diary Entry',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label>Title <span class="req">*</span></label><input id="de-title" placeholder="e.g. Call with Orion Logistics"></div>
        <div class="field"><label>Type</label><select id="de-type">${DIARY_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Date</label><input type="date" id="de-date" value="${_diaryDate}"></div>
        <div class="field"><label>Start Time</label><input type="time" id="de-start" value="${prefillStart||'10:00'}"></div>
        <div class="field"><label>End Time</label><input type="time" id="de-end" value="${prefillEnd||'11:00'}"></div>
        <div class="field span-2"><label>Notes</label><textarea id="de-notes"></textarea></div>
      </div>
      <p id="de-conflict" style="font-size:12px;color:#B4553F;margin-top:8px;"></p>
    `,
    foot: `<button class="btn btn-outline" id="de-cancel">Cancel</button><button class="btn btn-primary" id="de-save">Add to Diary</button>`
  });
  document.getElementById('de-cancel').onclick = closeModal;
  document.getElementById('de-save').onclick = () => {
    const title = document.getElementById('de-title').value.trim();
    const date = document.getElementById('de-date').value;
    const startTime = document.getElementById('de-start').value;
    const endTime = document.getElementById('de-end').value;
    if (!title) return toast('Title is required', 'error');
    if (startTime >= endTime) return toast('End Time must be after Start Time', 'error');
    if (Store.diaryConflict(_diaryOwner, date, startTime, endTime)) {
      document.getElementById('de-conflict').textContent = 'This executive already has an entry overlapping this time slot on this date.';
      return;
    }
    Store.addDiaryEntry({ ownerId: _diaryOwner, title, type: document.getElementById('de-type').value, date, startTime, endTime, notes: document.getElementById('de-notes').value.trim() });
    closeModal(); toast('✓ Added to diary', 'success'); _diaryDate = date; navigate('diary');
  };
}

function openFreeSlotFinder() {
  openModal({
    title: 'Find a Free Slot',
    body: `
      <div class="form-grid">
        <div class="field"><label>Date</label><input type="date" id="fs-date" value="${_diaryDate}"></div>
        <div class="field"><label>Duration (minutes)</label><input type="number" id="fs-duration" value="30" step="15"></div>
      </div>
      <div id="fs-result" style="margin-top:14px;font-size:13px;"></div>
    `,
    foot: `<button class="btn btn-outline" id="fs-cancel">Close</button><button class="btn btn-primary" id="fs-find">Find Slot</button>`
  });
  document.getElementById('fs-cancel').onclick = closeModal;
  document.getElementById('fs-find').onclick = () => {
    const date = document.getElementById('fs-date').value;
    const duration = Number(document.getElementById('fs-duration').value) || 30;
    const slot = Store.findFreeSlot(_diaryOwner, date, duration);
    const resultEl = document.getElementById('fs-result');
    if (!slot) {
      resultEl.innerHTML = `<span class="badge badge-rejected">No free slot found</span> The executive's working hours (9:30 AM–6:30 PM) are fully booked on this date.`;
    } else {
      resultEl.innerHTML = `<span class="badge badge-approved">Free slot found</span> ${slot.startTime}–${slot.endTime} <button class="btn btn-outline btn-sm" style="margin-left:8px;" id="fs-book">Book This Slot</button>`;
      document.getElementById('fs-book').onclick = () => { closeModal(); _diaryDate = date; openDiaryEntryForm(slot.startTime, slot.endTime); };
    }
  };
}

function deleteDiaryEntryConfirm(id) { confirmAction('Delete this diary entry?', () => { Store.deleteDiaryEntry(id); toast('Deleted', 'success'); navigate('diary'); }); }

function printDailyAgenda() {
  const owner = Store.getEmployee(_diaryOwner);
  const entries = Store.getDiaryEntries(_diaryOwner).filter(e => e.date === _diaryDate && e.status !== 'Cancelled').sort((a,b) => a.startTime.localeCompare(b.startTime));
  const meta = Store.load().meta;
  const co = escapeHtml(meta.institution);
  const html = `<div class="doc-page">
    ${letterheadHTML('Daily Agenda')}
    <div class="doc-ref-row"><span>For: ${escapeHtml(owner.firstName)} ${escapeHtml(owner.lastName)} — ${escapeHtml(owner.designation)}</span><span>Date: ${fmtDate(_diaryDate)}</span></div>
    <div class="doc-title">DAILY AGENDA</div>
    <table class="doc-table"><thead><tr><th>Time</th><th>Title</th><th>Type</th><th>Notes</th></tr></thead>
    <tbody>${entries.length === 0 ? '<tr><td colspan="4">No entries scheduled.</td></tr>' : entries.map(e => `<tr><td>${e.startTime}–${e.endTime}</td><td>${escapeHtml(e.title)}</td><td>${e.type}</td><td>${escapeHtml(e.notes||'—')}</td></tr>`).join('')}</tbody></table>
    <div class="doc-signoff"><div class="sig-block"><div class="sig-line"></div>Prepared By (PA/EA)</div><div class="sig-block"><div class="sig-line"></div>For ${co}</div></div>
  </div>`;
  printArea(html);
  toast('✓ Daily agenda printed', 'success');
}
