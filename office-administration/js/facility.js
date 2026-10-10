/* =========================================================
   facility.js — Facility & Meeting Room Booking
   Books office rooms for any purpose (not just formal meetings —
   training, interviews, client visits) with real conflict
   detection: the same room can't be double-booked on overlapping
   time slots on the same day.
   ========================================================= */

Modules.facility = function(container) {
  const rooms = Store.getFacilityRooms();
  const bookings = Store.getRoomBookings().slice().sort((a,b) => (a.date+a.startTime).localeCompare(b.date+b.startTime));
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Facility &amp; Room Booking</h1><p class="desc">Book a room for any purpose — the app blocks a second booking that overlaps an existing one for the same room.</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openRoomBookingForm()">+ New Booking</button></div>
    </div>
    <div class="grid grid-3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;">
      ${rooms.map(r => `<div class="card card-pad"><b>${escapeHtml(r.name)}</b><div class="text-dim" style="font-size:12px;">Capacity: ${r.capacity}</div><div class="text-dim" style="font-size:12px;">${bookings.filter(b=>b.roomId===r.id).length} booking(s)</div></div>`).join('')}
    </div>
    <div class="card">
      <div class="card-head"><h3>All Bookings</h3></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Room</th><th>Title</th><th>Date</th><th>Time</th><th>Booked By</th><th></th></tr></thead>
        <tbody>${bookings.length === 0 ? `<tr><td colspan="6" style="text-align:center;color:var(--text-dim);">No bookings yet</td></tr>` : bookings.map(b => {
          const room = rooms.find(r => r.id === b.roomId);
          return `<tr><td>${escapeHtml(room?room.name:'—')}</td><td>${escapeHtml(b.title)}</td><td>${fmtDate(b.date)}</td><td>${b.startTime}–${b.endTime}</td><td>${empName(b.bookedBy)}</td>
          <td><button class="icon-action danger" onclick="deleteBookingConfirm('${b.id}')">&#128465;</button></td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>
  `;
};

function openRoomBookingForm() {
  const rooms = Store.getFacilityRooms();
  openModal({
    title: 'New Room Booking',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label>Title / Purpose <span class="req">*</span></label><input id="rb-title" placeholder="e.g. New Joinee Induction"></div>
        <div class="field span-2"><label>Room</label><select id="rb-room">${rooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)} (capacity ${r.capacity})</option>`).join('')}</select></div>
        <div class="field"><label>Date</label><input type="date" id="rb-date" value="${todayISO()}"></div>
        <div class="field"><label>Booked By</label><select id="rb-by"><option value="">— Select —</option>${Store.getEmployees().map(e=>`<option value="${e.id}">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</option>`).join('')}</select></div>
        <div class="field"><label>Start Time</label><input type="time" id="rb-start" value="10:00"></div>
        <div class="field"><label>End Time</label><input type="time" id="rb-end" value="11:00"></div>
      </div>
      <p id="rb-conflict" style="font-size:12px;color:#B4553F;margin-top:8px;"></p>
    `,
    foot: `<button class="btn btn-outline" id="rb-cancel">Cancel</button><button class="btn btn-primary" id="rb-save">Book Room</button>`
  });
  document.getElementById('rb-cancel').onclick = closeModal;
  document.getElementById('rb-save').onclick = () => {
    const title = document.getElementById('rb-title').value.trim();
    const roomId = document.getElementById('rb-room').value;
    const date = document.getElementById('rb-date').value;
    const startTime = document.getElementById('rb-start').value;
    const endTime = document.getElementById('rb-end').value;
    if (!title) return toast('Title is required', 'error');
    if (startTime >= endTime) return toast('End Time must be after Start Time', 'error');
    if (Store.bookingConflict(roomId, date, startTime, endTime)) {
      document.getElementById('rb-conflict').textContent = 'This room is already booked for an overlapping time slot on this date. Choose a different room or time.';
      return;
    }
    Store.addRoomBooking({ title, roomId, date, startTime, endTime, bookedBy: document.getElementById('rb-by').value });
    closeModal(); toast('✓ Room booked', 'success'); navigate('facility');
  };
}

function deleteBookingConfirm(id) { confirmAction('Cancel this booking?', () => { Store.deleteRoomBooking(id); toast('Booking cancelled', 'success'); navigate('facility'); }); }
