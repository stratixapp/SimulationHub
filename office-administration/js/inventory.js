/* =========================================================
   inventory.js — Stationery & Inventory Stock Register
   Tracks consumables (paper, pens, cartridges, pantry supplies)
   as running stock levels — distinct from Assets, which tracks
   durable items (laptops, furniture) issued to named employees.
   ========================================================= */

const STOCK_CATEGORIES = ['Stationery', 'Pantry Supplies', 'IT Consumables', 'Cleaning Supplies', 'Other'];
const STOCK_UNITS = ['pcs', 'reams', 'boxes', 'packets', 'liters', 'kg'];

Modules.inventory = function(container) {
  const items = Store.getStockItems();
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Stationery &amp; Inventory Register</h1><p class="desc">Track consumable office stock — stationery, pantry supplies, IT consumables — with stock-in/stock-out entries and reorder alerts.</p></div>
      <div class="page-actions"><button class="btn btn-primary" onclick="openStockItemForm()">+ Add Item</button></div>
    </div>
    ${items.length === 0 ? `<div class="card"><div class="empty-state"><div class="ic">&#128230;</div><h4>No stock items yet</h4><p>Use "+ Add Item" to start your inventory register.</p></div></div>` : `
    <div class="card" style="margin-bottom:20px;"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Item</th><th>Category</th><th>Unit</th><th>Current Stock</th><th>Reorder Level</th><th>Status</th><th></th></tr></thead>
      <tbody>${items.map(i => `<tr>
        <td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.category)}</td><td>${escapeHtml(i.unit)}</td>
        <td class="mono">${i.currentStock}</td><td class="mono">${i.reorderLevel}</td>
        <td>${i.currentStock <= i.reorderLevel ? '<span class="badge badge-rejected">Low Stock</span>' : '<span class="badge badge-approved">OK</span>'}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-outline btn-sm" onclick="openStockTxForm('${i.id}','Stock In')">+ In</button>
          <button class="btn btn-outline btn-sm" onclick="openStockTxForm('${i.id}','Stock Out')">− Out</button>
          <button class="icon-action danger" onclick="deleteStockItemConfirm('${i.id}')">&#128465;</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div></div>
    <div class="card">
      <div class="card-head"><h3>Transaction Log</h3></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Quantity</th><th>Issued To / Remarks</th></tr></thead>
        <tbody>${Store.getStockTransactions().length === 0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);">No transactions yet</td></tr>` : Store.getStockTransactions().map(t => {
          const item = Store.getStockItem(t.itemId);
          return `<tr><td>${fmtDate(t.date)}</td><td>${escapeHtml(item?item.name:'—')}</td>
          <td><span class="badge ${t.type==='Stock In'?'badge-approved':'badge-pending'}">${t.type}</span></td>
          <td class="mono">${t.quantity}</td><td>${escapeHtml(t.issuedTo||t.remarks||'—')}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`}
  `;
};

function openStockItemForm() {
  openModal({
    title: 'Add Stock Item',
    body: `
      <div class="form-grid">
        <div class="field span-2"><label>Item Name <span class="req">*</span></label><input id="si-name" placeholder="e.g. A4 Paper (80 GSM)"></div>
        <div class="field"><label>Category</label><select id="si-cat">${STOCK_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Unit</label><select id="si-unit">${STOCK_UNITS.map(u=>`<option>${u}</option>`).join('')}</select></div>
        <div class="field"><label>Opening Stock</label><input type="number" id="si-open" value="0"></div>
        <div class="field"><label>Reorder Level</label><input type="number" id="si-reorder" value="10"></div>
      </div>`,
    foot: `<button class="btn btn-outline" id="si-cancel">Cancel</button><button class="btn btn-primary" id="si-save">Add Item</button>`
  });
  document.getElementById('si-cancel').onclick = closeModal;
  document.getElementById('si-save').onclick = () => {
    const name = document.getElementById('si-name').value.trim();
    if (!name) return toast('Item name is required', 'error');
    Store.addStockItem({
      name, category: document.getElementById('si-cat').value, unit: document.getElementById('si-unit').value,
      currentStock: Number(document.getElementById('si-open').value) || 0,
      reorderLevel: Number(document.getElementById('si-reorder').value) || 0
    });
    closeModal(); toast('✓ Item added', 'success'); navigate('inventory');
  };
}

function deleteStockItemConfirm(id) { confirmAction('Delete this item and its transaction history?', () => { Store.deleteStockItem(id); toast('Deleted', 'success'); navigate('inventory'); }); }

function openStockTxForm(itemId, type) {
  const item = Store.getStockItem(itemId);
  const employees = Store.getEmployees();
  openModal({
    title: `${type} — ${item.name}`,
    body: `
      <p style="font-size:12.5px;">Current Stock: <b>${item.currentStock} ${item.unit}</b></p>
      <div class="form-grid">
        <div class="field"><label>Date</label><input type="date" id="tx-date" value="${todayISO()}"></div>
        <div class="field"><label>Quantity <span class="req">*</span></label><input type="number" id="tx-qty" value="1"></div>
        ${type === 'Stock Out' ? `<div class="field span-2"><label>Issued To</label><select id="tx-to"><option value="">— General Use —</option>${employees.map(e=>`<option>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</option>`).join('')}</select></div>`
                                : `<div class="field span-2"><label>Remarks</label><input id="tx-remarks" placeholder="e.g. New purchase order received"></div>`}
      </div>`,
    foot: `<button class="btn btn-outline" id="tx-cancel">Cancel</button><button class="btn btn-primary" id="tx-save">Save</button>`
  });
  document.getElementById('tx-cancel').onclick = closeModal;
  document.getElementById('tx-save').onclick = () => {
    const qty = Number(document.getElementById('tx-qty').value);
    if (!qty || qty <= 0) return toast('Enter a valid quantity', 'error');
    if (type === 'Stock Out' && qty > item.currentStock) return toast('Cannot issue more than current stock', 'error');
    Store.addStockTransaction({
      itemId, type, quantity: qty, date: document.getElementById('tx-date').value,
      issuedTo: type === 'Stock Out' ? document.getElementById('tx-to').value : '',
      remarks: type === 'Stock In' ? document.getElementById('tx-remarks').value.trim() : ''
    });
    closeModal(); toast(`✓ ${type} recorded`, 'success'); navigate('inventory');
  };
}
