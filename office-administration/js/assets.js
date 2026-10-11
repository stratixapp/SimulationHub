/* =========================================================
   assets.js — IT & Office Asset Management
   ========================================================= */

const ASSET_CATEGORIES = ['Laptop','Desktop','Monitor','Mobile Phone','Furniture (Chair/Desk)','ID Badge','SIM Card','Access Card','Other'];

Modules.assets = function(container) {
  const assets = Store.getAssets();
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Asset Management</div><h1>Company Assets</h1><p class="desc">Track laptops, ID cards, furniture and other company property — who has what, and since when.</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openAssetForm()">+ Add Asset</button></div>
    </div>
    <div class="grid grid-3" style="margin-bottom:20px;">
      <div class="card stat-tile accent-teal"><div class="stat-label">Total Assets</div><div class="stat-value">${assets.length}</div></div>
      <div class="card stat-tile accent-clay"><div class="stat-label">Currently Issued</div><div class="stat-value">${assets.filter(a=>a.status==='Issued').length}</div></div>
      <div class="card stat-tile accent-sage"><div class="stat-label">Available</div><div class="stat-value">${assets.filter(a=>a.status==='Available').length}</div></div>
    </div>
    ${assets.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128187;</div><h4>No assets in inventory</h4><p>Add laptops, ID cards, or furniture to start tracking issuance.</p><button class="btn btn-primary" onclick="openAssetForm()">+ Add Asset</button></div></div>` : `
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Asset</th><th>Category</th><th>Serial No.</th><th>Status</th><th>Assigned To</th><th>Since</th><th>Actions</th></tr></thead>
          <tbody>
            ${assets.map(a => {
              const emp = a.assignedTo ? Store.getEmployee(a.assignedTo) : null;
              return `<tr>
                <td><b>${escapeHtml(a.name)}</b></td>
                <td>${escapeHtml(a.category)}</td>
                <td class="mono">${escapeHtml(a.serialNo||'—')}</td>
                <td><span class="badge badge-${a.status==='Available'?'active':a.status==='Issued'?'pending':'inactive'}">${a.status}</span></td>
                <td>${emp ? escapeHtml(emp.firstName+' '+emp.lastName) : '—'}</td>
                <td>${a.issuedOn ? fmtDate(a.issuedOn) : '—'}</td>
                <td><div class="actions-cell">
                  ${a.status==='Available' ? `<button class="btn btn-sm btn-outline" onclick="openIssueAssetForm('${a.id}')">Issue</button>` : ''}
                  ${a.status==='Issued' ? `<button class="btn btn-sm btn-outline" onclick="returnAssetUI('${a.id}')">Return</button>` : ''}
                  <button class="icon-action danger" title="Delete" onclick="deleteAssetConfirm('${a.id}')">&#128465;</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`}
  `;
};

function openAssetForm() {
  openModal({
    title: 'Add Asset',
    body: `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="field"><label>Asset Name <span class="req">*</span></label><input id="as-name" placeholder="e.g. Dell Latitude 5420"></div>
        <div class="field"><label>Category</label><select id="as-cat">${ASSET_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Serial / Asset Number</label><input id="as-serial" placeholder="e.g. SKL-LT-0042"></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="as-cancel">Cancel</button><button class="btn btn-primary" id="as-save">Add to Inventory</button>`
  });
  document.getElementById('as-cancel').onclick = closeModal;
  document.getElementById('as-save').onclick = () => {
    const name = document.getElementById('as-name').value.trim();
    if (!name) return toast('Asset name is required', 'error');
    Store.addAsset({ name, category: document.getElementById('as-cat').value, serialNo: document.getElementById('as-serial').value.trim() });
    closeModal(); toast('✓ Asset added', 'success'); navigate('assets');
  };
}

function openIssueAssetForm(assetId) {
  const employees = Store.getEmployees().filter(e => e.status === 'Active');
  if (!employees.length) return toast('No active employees to issue to', 'error');
  openModal({
    title: 'Issue Asset',
    narrow: true,
    body: `<div class="field"><label>Issue To</label><select id="ia-emp">${employees.map(e=>`<option value="${e.id}">${e.firstName} ${e.lastName} (${e.department})</option>`).join('')}</select></div>`,
    foot: `<button class="btn btn-outline" id="ia-cancel">Cancel</button><button class="btn btn-primary" id="ia-save">Issue</button>`
  });
  document.getElementById('ia-cancel').onclick = closeModal;
  document.getElementById('ia-save').onclick = () => {
    Store.issueAsset(assetId, document.getElementById('ia-emp').value);
    closeModal(); toast('✓ Asset issued', 'success'); navigate('assets');
  };
}
function returnAssetUI(assetId) {
  confirmAction('Mark this asset as returned and available again?', () => { Store.returnAsset(assetId); toast('Asset returned', 'success'); navigate('assets'); });
}
function deleteAssetConfirm(assetId) {
  confirmAction('Remove this asset from inventory permanently?', () => { Store.deleteAsset(assetId); toast('Asset removed', 'success'); navigate('assets'); });
}
