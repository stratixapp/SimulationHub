/* =========================================================
   filing.js — Filing System Simulator
   A stack of real-looking office documents, each needing the
   right folder AND the right retention period — not just "put
   it somewhere safe."
   ========================================================= */

const FILING_FOLDERS = ['HR Records', 'Finance & Accounts', 'Vendor & Contracts', 'Correspondence', 'Legal & Compliance'];
const FILING_RETENTIONS = ['1 Year', '3 Years', '7 Years', 'Permanent'];

const FILING_DOCUMENTS = [
  { id: 'F1', name: 'Employee Appointment Letter — Kavya Menon', correctFolder: 'HR Records', correctRetention: 'Permanent',
    why: 'Core personnel documents stay in HR Records for as long as the employee\u2019s history matters — kept permanently.' },
  { id: 'F2', name: 'Monthly Attendance Sheet — March 2026', correctFolder: 'HR Records', correctRetention: '3 Years',
    why: 'Routine attendance records are HR Records, but don\u2019t need permanent retention — a few years is standard.' },
  { id: 'F3', name: 'Vendor AMC Contract — Zenith Cooling Services', correctFolder: 'Vendor & Contracts', correctRetention: '7 Years',
    why: 'Signed contracts are kept well past their term in case of a later dispute.' },
  { id: 'F4', name: 'Purchase Invoice — Om Traders (Stationery)', correctFolder: 'Finance & Accounts', correctRetention: '7 Years',
    why: 'Financial invoices typically need 7+ years of retention for audit and tax purposes.' },
  { id: 'F5', name: 'Client Complaint Letter — Reliance Distributors', correctFolder: 'Correspondence', correctRetention: '3 Years',
    why: 'A written complaint is correspondence — keep it a few years in case the issue resurfaces.' },
  { id: 'F6', name: 'GST Filing Acknowledgement — Q4 FY26', correctFolder: 'Finance & Accounts', correctRetention: 'Permanent',
    why: 'Statutory tax filings are financial records kept permanently, not just for a few years.' },
  { id: 'F7', name: 'Employee Exit Clearance Form — Suresh Nambiar', correctFolder: 'HR Records', correctRetention: '7 Years',
    why: 'Exit documentation is an HR record retained well beyond the employee\u2019s last day.' },
  { id: 'F8', name: 'Office Lease Agreement — Crystal Towers', correctFolder: 'Legal & Compliance', correctRetention: 'Permanent',
    why: 'A property lease is a legal document kept for the life of the tenancy and beyond.' },
  { id: 'F9', name: 'Petty Cash Voucher — March 2026', correctFolder: 'Finance & Accounts', correctRetention: '3 Years',
    why: 'Petty cash vouchers are financial, but low-value — a few years\u2019 retention is enough.' },
  { id: 'F10', name: 'Employee Provident Fund (EPF) Statement', correctFolder: 'HR Records', correctRetention: 'Permanent',
    why: 'Statutory retirement-fund records follow the employee\u2019s HR file permanently.' },
  { id: 'F11', name: 'Vendor Quotation — New Printer (not selected)', correctFolder: 'Vendor & Contracts', correctRetention: '1 Year',
    why: 'A quotation that wasn\u2019t taken forward has little long-term value — a year is plenty.' },
  { id: 'F12', name: 'Thank-you Letter from a Guest Speaker', correctFolder: 'Correspondence', correctRetention: '1 Year',
    why: 'Goodwill correspondence like this is nice to keep briefly, not indefinitely.' },
  { id: 'F13', name: 'Fire Safety Compliance Certificate', correctFolder: 'Legal & Compliance', correctRetention: 'Permanent',
    why: 'Statutory safety certificates are compliance records kept as long as the premises are in use.' },
  { id: 'F14', name: 'Courier Delivery Acknowledgement', correctFolder: 'Correspondence', correctRetention: '1 Year',
    why: 'A delivery slip is correspondence-adjacent proof, useful for a year at most.' },
  { id: 'F15', name: 'Insurance Policy — Group Health Cover', correctFolder: 'Legal & Compliance', correctRetention: '7 Years',
    why: 'Insurance policies are kept well past expiry in case a claim is raised on a past period.' }
];

Modules.filing = function(container) {
  const attempts = Store.getFilingAttempts();
  const done = FILING_DOCUMENTS.filter(d => attempts[d.id]).length;
  const correct = FILING_DOCUMENTS.filter(d => attempts[d.id] && attempts[d.id].correct).length;
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Filing System Simulator</h1><p class="desc">Every document needs the right folder AND the right retention period — filing something in the wrong place is as good as losing it.</p></div>
      <div class="page-actions"><span class="badge">${done}/${FILING_DOCUMENTS.length} filed &middot; ${correct} correct</span></div>
    </div>
    <div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Document</th><th>Folder</th><th>Retention</th><th></th><th></th></tr></thead>
      <tbody>${FILING_DOCUMENTS.map(d => {
        const a = attempts[d.id];
        return `<tr>
          <td>${escapeHtml(d.name)}</td>
          <td><select data-fl-folder="${d.id}" ${a && a.correct ? 'disabled' : ''}><option value="">— Select —</option>${FILING_FOLDERS.map(f => `<option ${a && a.folder === f ? 'selected' : ''}>${f}</option>`).join('')}</select></td>
          <td><select data-fl-retention="${d.id}" ${a && a.correct ? 'disabled' : ''}><option value="">— Select —</option>${FILING_RETENTIONS.map(r => `<option ${a && a.retention === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
          <td>${!a || !a.correct ? `<button class="btn btn-primary btn-sm" onclick="checkFiling('${d.id}')">File It</button>` : ''}</td>
          <td>${a ? `<span class="badge ${a.correct ? 'badge-approved' : 'badge-rejected'}" title="${escapeHtml(d.why)}">${a.correct ? '&#10003; Correct' : '&#10007; Try again'}</span>` : ''}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div></div>
  `;
}

function checkFiling(id) {
  const folder = document.querySelector(`[data-fl-folder="${id}"]`).value;
  const retention = document.querySelector(`[data-fl-retention="${id}"]`).value;
  if (!folder || !retention) return toast('Pick both a folder and a retention period', 'error');
  const result = Store.recordFiling(id, folder, retention);
  toast(result.correct ? '\u2713 Filed correctly' : '\u2717 Not quite — check the hint on the badge', result.correct ? 'success' : 'error');
  navigate('filing');
}
