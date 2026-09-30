/* =========================================================
   procurement.js — Procurement & Petty Cash
   Two classic office-admin workflows: (1) raise a purchase
   requisition, collect vendor quotations, and issue a Purchase
   Order to the winning vendor; (2) maintain the day-to-day
   Petty Cash Book with a running balance.
   ========================================================= */

let _procView = 'requisitions'; // requisitions | pettycash

Modules.procurement = function(container) {
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Procurement &amp; Petty Cash</h1><p class="desc">Raise purchase requisitions, compare vendor quotations, issue Purchase Orders, and maintain the Petty Cash Book.</p></div>
      <div class="page-actions"><button class="btn btn-primary" id="proc-new"></button></div>
    </div>
    <div class="tabs" style="margin-bottom:18px;">
      <button class="tab-btn ${_procView==='requisitions'?'active':''}" data-v="requisitions">Purchase Requisitions (${Store.getPurchaseRequisitions().length})</button>
      <button class="tab-btn ${_procView==='pettycash'?'active':''}" data-v="pettycash">Petty Cash Book</button>
    </div>
    <div id="proc-mount"></div>
  `;
  document.querySelectorAll('.tab-btn[data-v]').forEach(b => b.onclick = () => { _procView = b.dataset.v; navigate('procurement'); });
  const newBtn = document.getElementById('proc-new');
  if (_procView === 'requisitions') { newBtn.textContent = '+ New Requisition'; newBtn.onclick = openPurchaseRequisitionForm; }
  else { newBtn.textContent = '+ Add Voucher'; newBtn.onclick = openVoucherForm; }
  renderProcView();
};

function renderProcView() {
  const mount = document.getElementById('proc-mount');
  if (_procView === 'requisitions') {
    const items = Store.getPurchaseRequisitions();
    mount.innerHTML = items.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128722;</div><h4>No requisitions yet</h4><p>Use "+ New Requisition" to raise your first purchase request.</p></div></div>` : `
      <div class="card"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Ref No</th><th>Item</th><th>Qty</th><th>Department</th><th>Quotations</th><th>Status</th><th></th></tr></thead>
        <tbody>${items.map(r => `<tr>
          <td class="mono">${r.refNo}</td><td>${escapeHtml(r.item)}</td><td>${r.quantity}</td><td>${escapeHtml(r.department)}</td>
          <td>${r.quotations.length}/3</td>
          <td><span class="badge ${r.status==='PO Raised'?'badge-approved':r.status==='Rejected'?'badge-rejected':'badge-pending'}">${r.status}</span></td>
          <td style="white-space:nowrap;"><button class="btn btn-outline btn-sm" onclick="openRequisitionDetail('${r.id}')">Open</button>
          <button class="icon-action danger" onclick="deletePurchaseRequisitionConfirm('${r.id}')">&#128465;</button></td>
        </tr>`).join('')}</tbody>
      </table></div></div>`;
  } else {
    const pc = Store.getPettyCash();
    const bal = pc.vouchers.length ? pc.vouchers[pc.vouchers.length-1].balance : pc.openingBalance;
    mount.innerHTML = `
      <div class="grid grid-3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
        <div class="card stat-tile accent-teal"><div class="stat-label">Opening Balance</div><div class="stat-value">₹${pc.openingBalance.toLocaleString('en-IN')}</div></div>
        <div class="card stat-tile accent-sage"><div class="stat-label">Current Balance</div><div class="stat-value">₹${bal.toLocaleString('en-IN')}</div></div>
        <div class="card stat-tile accent-amber"><div class="stat-label">Vouchers Logged</div><div class="stat-value">${pc.vouchers.length}</div></div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Petty Cash Book</h3>
          <div><button class="btn btn-outline btn-sm" onclick="openOpeningBalanceForm()">Edit Opening Balance</button>
          <button class="btn btn-outline btn-sm" onclick="printPettyCashBook()">&#128438; Print</button></div>
        </div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Date</th><th>Particulars</th><th>Type</th><th>Amount</th><th>Balance</th><th>Approved By</th><th></th></tr></thead>
          <tbody>${pc.vouchers.length === 0 ? `<tr><td colspan="7" style="text-align:center;color:var(--text-dim);">No vouchers yet</td></tr>` : pc.vouchers.map(v => `<tr>
            <td>${fmtDate(v.date)}</td><td>${escapeHtml(v.particulars)}</td>
            <td><span class="badge ${v.type==='Receipt'?'badge-approved':'badge-pending'}">${v.type}</span></td>
            <td class="mono">₹${Number(v.amount).toLocaleString('en-IN')}</td>
            <td class="mono">₹${v.balance.toLocaleString('en-IN')}</td>
            <td>${escapeHtml(v.approvedBy||'—')}</td>
            <td><button class="icon-action danger" onclick="deleteVoucherConfirm('${v.id}')">&#128465;</button></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`;
  }
}

function openPurchaseRequisitionForm() {
  openModal({
    title: 'New Purchase Requisition',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label>Item / Description <span class="req">*</span></label><input id="pr-item" placeholder="e.g. A4 Paper (80 GSM), 20 reams"></div>
        <div class="field"><label>Quantity <span class="req">*</span></label><input type="number" id="pr-qty" value="1"></div>
        <div class="field"><label>Department</label><select id="pr-dept">${DEPARTMENTS.map(d=>`<option>${d}</option>`).join('')}</select></div>
        <div class="field span-2"><label>Requested By</label><select id="pr-by"><option value="">— Select —</option>${Store.getEmployees().map(e=>`<option>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</option>`).join('')}</select></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="pr-cancel">Cancel</button><button class="btn btn-primary" id="pr-save">Raise Requisition</button>`
  });
  document.getElementById('pr-cancel').onclick = closeModal;
  document.getElementById('pr-save').onclick = () => {
    const item = document.getElementById('pr-item').value.trim();
    if (!item) return toast('Item description is required', 'error');
    Store.addPurchaseRequisition({
      item, quantity: Number(document.getElementById('pr-qty').value) || 1,
      department: document.getElementById('pr-dept').value,
      requestedBy: document.getElementById('pr-by').value,
      date: todayISO()
    });
    closeModal(); toast('✓ Requisition raised', 'success'); navigate('procurement');
  };
}

function openRequisitionDetail(id) {
  const r = Store.getPurchaseRequisition(id);
  if (!r) return;
  const canRaisePO = r.quotations.length >= 1 && r.status !== 'PO Raised';
  openModal({
    title: `${r.refNo} — ${r.item}`, wide: true,
    body: `
      <p style="font-size:12.5px;"><b>Quantity:</b> ${r.quantity} &nbsp; <b>Department:</b> ${escapeHtml(r.department)} &nbsp; <b>Date:</b> ${fmtDate(r.date)}</p>
      <h3 style="font-size:13.5px;margin:14px 0 8px;">Vendor Quotations (${r.quotations.length}/3)</h3>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Vendor</th><th>Amount</th><th>Delivery (days)</th><th></th></tr></thead>
      <tbody>${r.quotations.length === 0 ? `<tr><td colspan="4" style="text-align:center;color:var(--text-dim);">No quotations added yet</td></tr>` : r.quotations.map(q => `<tr>
        <td>${escapeHtml(q.vendor)}</td><td class="mono">₹${Number(q.amount).toLocaleString('en-IN')}</td><td>${q.deliveryDays}</td>
        <td>${r.status !== 'PO Raised' ? `<button class="btn btn-outline btn-sm" onclick="raisePOConfirm('${r.id}','${escapeHtml(q.vendor)}')">Select &amp; Raise PO</button>` : (r.selectedVendor===q.vendor ? '<span class="badge badge-approved">Selected</span>' : '')}</td>
      </tr>`).join('')}</tbody></table></div>
      ${r.quotations.length < 3 && r.status !== 'PO Raised' ? `
      <h3 style="font-size:13.5px;margin:16px 0 8px;">Add a Quotation</h3>
      <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr;">
        <div class="field"><label>Vendor Name</label><input id="pq-vendor"></div>
        <div class="field"><label>Quoted Amount (₹)</label><input type="number" id="pq-amount"></div>
        <div class="field"><label>Delivery (days)</label><input type="number" id="pq-days" value="7"></div>
      </div>
      <button class="btn btn-outline btn-sm" id="pq-add" style="margin-top:6px;">+ Add Quotation</button>` : ''}
      ${r.status === 'PO Raised' ? `<div class="card card-pad" style="margin-top:16px;background:var(--paper-dim);"><b>Purchase Order ${r.poNumber}</b> raised to ${escapeHtml(r.selectedVendor)} on ${fmtDate(r.poDate)}. <button class="btn btn-outline btn-sm" onclick="printPurchaseOrder('${r.id}')" style="margin-left:8px;">&#128438; Print PO</button></div>` : ''}
    `,
    foot: `<button class="btn btn-outline" id="prd-close">Close</button>`
  });
  document.getElementById('prd-close').onclick = closeModal;
  const addBtn = document.getElementById('pq-add');
  if (addBtn) addBtn.onclick = () => {
    const vendor = document.getElementById('pq-vendor').value.trim();
    const amount = Number(document.getElementById('pq-amount').value);
    if (!vendor || !amount) return toast('Vendor and Amount are required', 'error');
    Store.addQuotation(id, { vendor, amount, deliveryDays: Number(document.getElementById('pq-days').value) || 7 });
    openRequisitionDetail(id);
  };
}

function raisePOConfirm(reqId, vendor) {
  confirmAction(`Raise a Purchase Order to ${vendor}? This finalizes the vendor selection.`, () => {
    Store.raisePO(reqId, vendor);
    toast('✓ Purchase Order raised', 'success');
    openRequisitionDetail(reqId);
  });
}

function deletePurchaseRequisitionConfirm(id) { confirmAction('Delete this requisition?', () => { Store.deletePurchaseRequisition(id); toast('Deleted', 'success'); navigate('procurement'); }); }

function printPurchaseOrder(reqId) {
  const r = Store.getPurchaseRequisition(reqId);
  const meta = Store.load().meta;
  const co = escapeHtml(meta.institution);
  const q = r.quotations.find(x => x.vendor === r.selectedVendor);
  const html = `<div class="doc-page">
    <div class="doc-watermark"><span>${co.toUpperCase()}</span></div>
    ${letterheadHTML('Purchase Order')}
    <div class="doc-ref-row"><span>PO No: ${r.poNumber}</span><span>Date: ${fmtDate(r.poDate)}</span></div>
    <div class="doc-title">PURCHASE ORDER</div>
    <p style="font-size:12.5px;"><b>To:</b> ${escapeHtml(r.selectedVendor)}</p>
    <table class="doc-table"><thead><tr><th>Item</th><th>Quantity</th><th>Quoted Amount</th><th>Delivery</th></tr></thead>
    <tbody><tr><td>${escapeHtml(r.item)}</td><td>${r.quantity}</td><td>₹${q?Number(q.amount).toLocaleString('en-IN'):'—'}</td><td>${q?q.deliveryDays+' days':'—'}</td></tr></tbody></table>
    <p style="font-size:12.5px;margin-top:12px;">Requesting Department: ${escapeHtml(r.department)} &nbsp; Requisition Ref: ${r.refNo}</p>
    <div class="doc-signoff">
      <div class="sig-block"><div class="sig-line"></div>Prepared By</div>
      <div class="sig-block"><div class="sig-line"></div>For ${co}<br>Authorized Signatory</div>
    </div>
  </div>`;
  printArea(html);
  toast('✓ Purchase Order printed', 'success');
}

function openVoucherForm() {
  openModal({
    title: 'New Petty Cash Voucher',
    body: `
      <div class="form-grid">
        <div class="field"><label>Date</label><input type="date" id="pv-date" value="${todayISO()}"></div>
        <div class="field"><label>Type</label><select id="pv-type"><option>Payment</option><option>Receipt</option></select></div>
        <div class="field span-2"><label>Particulars <span class="req">*</span></label><input id="pv-particulars" placeholder="e.g. Courier charges, tea/coffee supplies"></div>
        <div class="field"><label>Amount (₹) <span class="req">*</span></label><input type="number" id="pv-amount"></div>
        <div class="field"><label>Approved By</label><select id="pv-by"><option value="">— Select —</option>${Store.getEmployees().map(e=>`<option>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</option>`).join('')}</select></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="pv-cancel">Cancel</button><button class="btn btn-primary" id="pv-save">Add Voucher</button>`
  });
  document.getElementById('pv-cancel').onclick = closeModal;
  document.getElementById('pv-save').onclick = () => {
    const particulars = document.getElementById('pv-particulars').value.trim();
    const amount = Number(document.getElementById('pv-amount').value);
    if (!particulars || !amount) return toast('Particulars and Amount are required', 'error');
    Store.addPettyCashVoucher({ date: document.getElementById('pv-date').value, type: document.getElementById('pv-type').value, particulars, amount, approvedBy: document.getElementById('pv-by').value });
    closeModal(); toast('✓ Voucher added', 'success'); navigate('procurement');
  };
}

function openOpeningBalanceForm() {
  const pc = Store.getPettyCash();
  openModal({
    title: 'Edit Opening Balance',
    body: `<div class="field"><label>Opening Balance (₹)</label><input type="number" id="ob-amount" value="${pc.openingBalance}"></div>`,
    foot: `<button class="btn btn-outline" id="ob-cancel">Cancel</button><button class="btn btn-primary" id="ob-save">Save</button>`
  });
  document.getElementById('ob-cancel').onclick = closeModal;
  document.getElementById('ob-save').onclick = () => {
    Store.setPettyCashOpening(Number(document.getElementById('ob-amount').value) || 0);
    closeModal(); toast('✓ Opening balance updated', 'success'); navigate('procurement');
  };
}

function deleteVoucherConfirm(id) { confirmAction('Delete this voucher? Later balances will be recalculated.', () => { Store.deletePettyCashVoucher(id); toast('Deleted', 'success'); navigate('procurement'); }); }

function printPettyCashBook() {
  const pc = Store.getPettyCash();
  const meta = Store.load().meta;
  const co = escapeHtml(meta.institution);
  const html = `<div class="doc-page">
    ${letterheadHTML('Petty Cash Book')}
    <div class="doc-title">PETTY CASH BOOK</div>
    <p style="font-size:12.5px;">Opening Balance: <b>₹${pc.openingBalance.toLocaleString('en-IN')}</b></p>
    <table class="doc-table"><thead><tr><th>Date</th><th>Particulars</th><th>Type</th><th>Amount</th><th>Balance</th></tr></thead>
    <tbody>${pc.vouchers.map(v => `<tr><td>${fmtDate(v.date)}</td><td>${escapeHtml(v.particulars)}</td><td>${v.type}</td><td>₹${Number(v.amount).toLocaleString('en-IN')}</td><td>₹${v.balance.toLocaleString('en-IN')}</td></tr>`).join('')}</tbody></table>
    <div class="doc-signoff"><div class="sig-block"><div class="sig-line"></div>Prepared By</div><div class="sig-block"><div class="sig-line"></div>For ${co}<br>Authorized Signatory</div></div>
  </div>`;
  printArea(html);
  toast('✓ Petty Cash Book printed', 'success');
}
