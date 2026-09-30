/* =========================================================
   travel.js — Travel & Expense (TA/DA) Claims
   Two-stage workflow: a Travel Request raised and approved
   before a trip, followed by an Expense Claim with itemized
   bills submitted and reimbursed after the trip.
   ========================================================= */

const TRAVEL_MODES = ['Flight', 'Train', 'Cab', 'Own Vehicle', 'Bus'];
const EXPENSE_CATEGORIES = ['Travel Fare', 'Lodging', 'Food', 'Local Conveyance', 'Other'];

let _travelView = 'requests'; // requests | claims

Modules.travel = function(container) {
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Travel &amp; Expense (TA/DA)</h1><p class="desc">Raise a travel request, get it approved, then submit an itemized expense claim for reimbursement.</p></div>
      <div class="page-actions"><button class="btn btn-primary" id="tv-new"></button></div>
    </div>
    <div class="tabs" style="margin-bottom:18px;">
      <button class="tab-btn ${_travelView==='requests'?'active':''}" data-v="requests">Travel Requests (${Store.getTravelRequests().length})</button>
      <button class="tab-btn ${_travelView==='claims'?'active':''}" data-v="claims">Expense Claims (${Store.getExpenseClaims().length})</button>
    </div>
    <div id="tv-mount"></div>
  `;
  document.querySelectorAll('.tab-btn[data-v]').forEach(b => b.onclick = () => { _travelView = b.dataset.v; navigate('travel'); });
  const newBtn = document.getElementById('tv-new');
  if (_travelView === 'requests') { newBtn.textContent = '+ New Travel Request'; newBtn.onclick = openTravelRequestForm; }
  else { newBtn.textContent = '+ New Expense Claim'; newBtn.onclick = openExpenseClaimForm; }
  renderTravelView();
};



function renderTravelView() {
  const mount = document.getElementById('tv-mount');
  if (_travelView === 'requests') {
    const items = Store.getTravelRequests();
    mount.innerHTML = items.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#9992;</div><h4>No travel requests yet</h4><p>Use "+ New Travel Request" to submit one.</p></div></div>` : `
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Employee</th><th>Purpose</th><th>Route</th><th>Dates</th><th>Mode</th><th>Advance</th><th>Status</th><th></th></tr></thead>
        <tbody>${items.map(t => `<tr>
          <td>${empName(t.empId)}</td><td>${escapeHtml(t.purpose)}</td><td>${escapeHtml(t.fromCity)} → ${escapeHtml(t.toCity)}</td>
          <td>${fmtDate(t.fromDate)} – ${fmtDate(t.toDate)}</td><td>${t.mode}</td><td class="mono">₹${Number(t.advanceRequested||0).toLocaleString('en-IN')}</td>
          <td><select data-trv-status="${t.id}" style="font-size:11.5px;padding:4px 6px;">${['Pending','Approved','Rejected'].map(s=>`<option ${s===t.status?'selected':''}>${s}</option>`).join('')}</select></td>
          <td><button class="icon-action danger" onclick="deleteTravelConfirm('${t.id}')">&#128465;</button></td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;
    document.querySelectorAll('[data-trv-status]').forEach(sel => sel.onchange = (e) => { Store.updateTravelRequest(e.target.dataset.trvStatus, { status: e.target.value }); toast('Status updated', 'success'); });
  } else {
    const items = Store.getExpenseClaims();
    mount.innerHTML = items.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128179;</div><h4>No expense claims yet</h4><p>Use "+ New Expense Claim" to submit one.</p></div></div>` : `
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Employee</th><th>Items</th><th>Total Claimed</th><th>Advance Adjusted</th><th>Net Payable</th><th>Status</th><th></th></tr></thead>
        <tbody>${items.map(c => `<tr>
          <td>${fmtDate(c.date)}</td><td>${empName(c.empId)}</td><td>${c.items.length}</td>
          <td class="mono">₹${c.totalClaimed.toLocaleString('en-IN')}</td><td class="mono">₹${c.advanceAdjusted.toLocaleString('en-IN')}</td>
          <td class="mono">₹${c.netPayable.toLocaleString('en-IN')}${c.excessAdvance ? `<div style="font-size:11px;color:var(--danger,#b3261e);">Recover ₹${c.excessAdvance.toLocaleString('en-IN')} from employee</div>` : ''}</td>
          <td><select data-exp-status="${c.id}" style="font-size:11.5px;padding:4px 6px;">${['Submitted','Approved','Reimbursed'].map(s=>`<option ${s===c.status?'selected':''}>${s}</option>`).join('')}</select></td>
          <td><button class="icon-action danger" onclick="deleteClaimConfirm('${c.id}')">&#128465;</button></td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;
    document.querySelectorAll('[data-exp-status]').forEach(sel => sel.onchange = (e) => { Store.updateExpenseClaim(e.target.dataset.expStatus, { status: e.target.value }); toast('Status updated', 'success'); });
  }
}

function openTravelRequestForm() {
  openModal({
    title: 'New Travel Request',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label>Employee <span class="req">*</span></label><select id="tr-emp"><option value="">— Select —</option>${Store.getEmployees().map(e=>`<option value="${e.id}">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)} (${escapeHtml(e.department)})</option>`).join('')}</select></div>
        <div class="field span-2"><label>Purpose <span class="req">*</span></label><input id="tr-purpose" placeholder="e.g. Client meeting, Vendor site visit"></div>
        <div class="field"><label>From City</label><input id="tr-from" value="Mumbai"></div>
        <div class="field"><label>To City</label><input id="tr-to"></div>
        <div class="field"><label>From Date</label><input type="date" id="tr-fdate" value="${todayISO()}"></div>
        <div class="field"><label>To Date</label><input type="date" id="tr-tdate" value="${todayISO()}"></div>
        <div class="field"><label>Mode of Travel</label><select id="tr-mode">${TRAVEL_MODES.map(m=>`<option>${m}</option>`).join('')}</select></div>
        <div class="field"><label>Advance Requested (₹)</label><input type="number" id="tr-advance" value="0"></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="tr-cancel">Cancel</button><button class="btn btn-primary" id="tr-save">Submit Request</button>`
  });
  document.getElementById('tr-cancel').onclick = closeModal;
  document.getElementById('tr-save').onclick = () => {
    const empId = document.getElementById('tr-emp').value;
    const purpose = document.getElementById('tr-purpose').value.trim();
    if (!empId || !purpose) return toast('Employee and Purpose are required', 'error');
    Store.addTravelRequest({
      empId, purpose, fromCity: document.getElementById('tr-from').value.trim(), toCity: document.getElementById('tr-to').value.trim(),
      fromDate: document.getElementById('tr-fdate').value, toDate: document.getElementById('tr-tdate').value,
      mode: document.getElementById('tr-mode').value, advanceRequested: Number(document.getElementById('tr-advance').value) || 0
    });
    closeModal(); toast('✓ Travel request submitted', 'success'); navigate('travel');
  };
}

function deleteTravelConfirm(id) { confirmAction('Delete this travel request?', () => { Store.deleteTravelRequest(id); toast('Deleted', 'success'); navigate('travel'); }); }

let _expItems = [];

function openExpenseClaimForm() {
  const approvedTravel = Store.getTravelRequests().filter(t => t.status === 'Approved');
  _expItems = [{ category: 'Travel Fare', amount: '', billNo: '' }];
  openModal({
    title: 'New Expense Claim', wide: true,
    body: `
      <div class="form-grid">
        <div class="field span-2"><label>Linked Travel Request</label><select id="ec-travel"><option value="">— Not linked to a specific trip —</option>${approvedTravel.map(t=>`<option value="${t.id}">${escapeHtml(t.purpose)} (${empName(t.empId)})</option>`).join('')}</select></div>
        <div class="field span-2"><label>Employee <span class="req">*</span></label><select id="ec-emp"><option value="">— Select —</option>${Store.getEmployees().map(e=>`<option value="${e.id}">${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</option>`).join('')}</select></div>
        <div class="field"><label>Advance Adjusted (₹)</label><input type="number" id="ec-advance" value="0"></div>
      </div>
      <h3 style="font-size:13.5px;margin:16px 0 8px;">Expense Items</h3>
      <div id="ec-items"></div>
      <button class="btn btn-outline btn-sm" id="ec-add-item" style="margin-top:8px;">+ Add Item</button>
      <p id="ec-total" class="text-dim" style="font-size:12.5px;margin-top:12px;"></p>
    `,
    foot: `<button class="btn btn-outline" id="ec-cancel">Cancel</button><button class="btn btn-primary" id="ec-save">Submit Claim</button>`
  });
  document.getElementById('ec-cancel').onclick = closeModal;
  document.getElementById('ec-advance').oninput = updateExpTotal;
  document.getElementById('ec-add-item').onclick = () => { syncExpItems(); _expItems.push({ category: 'Travel Fare', amount: '', billNo: '' }); renderExpItems(); };
  const travelSel = document.getElementById('ec-travel');
  travelSel.onchange = () => {
    const t = Store.getTravelRequest(travelSel.value);
    if (t) document.getElementById('ec-emp').value = t.empId;
  };
  renderExpItems();
  document.getElementById('ec-save').onclick = () => {
    const empId = document.getElementById('ec-emp').value;
    if (!empId) return toast('Employee is required', 'error');
    syncExpItems();
    const items = _expItems.filter(i => Number(i.amount) > 0);
    if (items.length === 0) return toast('Add at least one expense item', 'error');
    const totalClaimed = items.reduce((s,i) => s + Number(i.amount), 0);
    const advanceAdjusted = Number(document.getElementById('ec-advance').value) || 0;
    Store.addExpenseClaim({
      travelId: travelSel.value || null, empId, items, totalClaimed, advanceAdjusted,
      netPayable: Math.max(0, totalClaimed - advanceAdjusted),
      excessAdvance: Math.max(0, advanceAdjusted - totalClaimed)
    });
    closeModal(); toast('✓ Expense claim submitted', 'success'); navigate('travel');
  };
}

function renderExpItems() {
  const mount = document.getElementById('ec-items');
  mount.innerHTML = _expItems.map((it, i) => `
    <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr auto;gap:6px;margin-bottom:6px;">
      <select class="ei-cat" data-i="${i}">${EXPENSE_CATEGORIES.map(c=>`<option ${c===it.category?'selected':''}>${c}</option>`).join('')}</select>
      <input class="ei-amount" data-i="${i}" type="number" placeholder="Amount (₹)" value="${it.amount}">
      <input class="ei-bill" data-i="${i}" placeholder="Bill No." value="${it.billNo}">
      <button class="icon-action danger" onclick="removeExpItem(${i})">&#128465;</button>
    </div>`).join('');
  mount.querySelectorAll('.ei-amount, .ei-cat, .ei-bill').forEach(el => el.oninput = updateExpTotal);
  updateExpTotal();
}

function updateExpTotal() {
  syncExpItems();
  const total = _expItems.reduce((s,i) => s + (Number(i.amount)||0), 0);
  const advance = Number(document.getElementById('ec-advance').value) || 0;
  document.getElementById('ec-total').textContent = `Total Claimed: ₹${total.toLocaleString('en-IN')} · Advance Adjusted: ₹${advance.toLocaleString('en-IN')} · ${total >= advance ? `Net Payable: ₹${(total-advance).toLocaleString('en-IN')}` : `Net Payable: ₹0 · Excess advance to recover from employee: ₹${(advance-total).toLocaleString('en-IN')}`}`;
}

function syncExpItems() {
  document.querySelectorAll('.ei-cat').forEach(el => _expItems[+el.dataset.i].category = el.value);
  document.querySelectorAll('.ei-amount').forEach(el => _expItems[+el.dataset.i].amount = el.value);
  document.querySelectorAll('.ei-bill').forEach(el => _expItems[+el.dataset.i].billNo = el.value);
}

function removeExpItem(i) { syncExpItems(); _expItems.splice(i,1); if (_expItems.length===0) _expItems.push({category:'Travel Fare',amount:'',billNo:''}); renderExpItems(); }

function deleteClaimConfirm(id) { confirmAction('Delete this expense claim?', () => { Store.deleteExpenseClaim(id); toast('Deleted', 'success'); navigate('travel'); }); }
