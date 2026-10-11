/* =========================================================
   vendors.js — Vendor & Compliance Renewal Tracker
   Tracks AMC contracts, insurance policies, licenses and other
   vendor agreements with an expiry date, flagging anything
   expiring soon or already expired — a real recurring admin
   responsibility that easily gets missed without a tracker.
   ========================================================= */

const VENDOR_CATEGORIES = ['AMC / Maintenance', 'Insurance', 'License / Compliance', 'IT Services', 'Facility Services', 'Other'];

function vendorStatus(contractEnd) {
  const days = Math.floor((new Date(contractEnd) - new Date(todayISO())) / 86400000);
  if (days < 0) return { label: 'Expired', cls: 'badge-rejected', days };
  if (days <= 30) return { label: 'Expiring Soon', cls: 'badge-pending', days };
  return { label: 'Active', cls: 'badge-approved', days };
}

Modules.vendors = function(container) {
  const items = Store.getVendors();
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Vendor &amp; Compliance Tracker</h1><p class="desc">Track AMC contracts, insurance policies and licenses by expiry date, so renewals never get missed.</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openVendorForm()">+ Add Vendor / Contract</button></div>
    </div>
    ${items.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128203;</div><h4>No vendors tracked yet</h4><p>Use "+ Add Vendor / Contract" to add your first one.</p></div></div>` : `
    <div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Vendor</th><th>Category</th><th>Contact</th><th>Contract Period</th><th>Status</th><th></th></tr></thead>
      <tbody>${items.map(v => {
        const st = vendorStatus(v.contractEnd);
        return `<tr>
          <td>${escapeHtml(v.name)}</td><td>${escapeHtml(v.category)}</td>
          <td>${escapeHtml(v.contactPerson||'—')}${v.phone?' · '+escapeHtml(v.phone):''}</td>
          <td>${fmtDate(v.contractStart)} – ${fmtDate(v.contractEnd)}</td>
          <td><span class="badge ${st.cls}">${st.label}${st.label==='Expiring Soon'?` (${st.days}d)`:''}</span></td>
          <td><button class="btn btn-outline btn-sm" onclick="openVendorForm('${v.id}')">Edit</button> <button class="icon-action danger" onclick="deleteVendorConfirm('${v.id}')">&#128465;</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div></div>`}
  `;
};

function openVendorForm(id) {
  const v = id ? Store.getVendors().find(x => x.id === id) : null;
  openModal({
    title: v ? `Edit — ${v.name}` : 'Add Vendor / Contract',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label>Vendor / Contract Name <span class="req">*</span></label><input id="vd-name" value="${v?escapeHtml(v.name):''}" placeholder="e.g. Om Traders — Office AMC"></div>
        <div class="field"><label>Category</label><select id="vd-cat">${VENDOR_CATEGORIES.map(c=>`<option ${v&&v.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Contact Person</label><input id="vd-contact" value="${v?escapeHtml(v.contactPerson||''):''}"></div>
        <div class="field"><label>Phone</label><input id="vd-phone" value="${v?escapeHtml(v.phone||''):''}"></div>
        <div class="field"><label>Contract Start</label><input type="date" id="vd-start" value="${v?v.contractStart:todayISO()}"></div>
        <div class="field"><label>Contract End <span class="req">*</span></label><input type="date" id="vd-end" value="${v?v.contractEnd:''}"></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="vd-cancel">Cancel</button><button class="btn btn-primary" id="vd-save">${v?'Save Changes':'Add'}</button>`
  });
  document.getElementById('vd-cancel').onclick = closeModal;
  document.getElementById('vd-save').onclick = () => {
    const name = document.getElementById('vd-name').value.trim();
    const contractEnd = document.getElementById('vd-end').value;
    if (!name || !contractEnd) return toast('Name and Contract End date are required', 'error');
    const data = {
      name, category: document.getElementById('vd-cat').value,
      contactPerson: document.getElementById('vd-contact').value.trim(),
      phone: document.getElementById('vd-phone').value.trim(),
      contractStart: document.getElementById('vd-start').value, contractEnd
    };
    if (v) Store.updateVendor(v.id, data); else Store.addVendor(data);
    closeModal(); toast(v ? '✓ Updated' : '✓ Vendor added', 'success'); navigate('vendors');
  };
}

function deleteVendorConfirm(id) { confirmAction('Delete this vendor/contract?', () => { Store.deleteVendor(id); toast('Deleted', 'success'); navigate('vendors'); }); }
