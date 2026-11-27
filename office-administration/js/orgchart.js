/* =========================================================
   orgchart.js — Reporting Hierarchy Visualization
   ========================================================= */

Modules.orgchart = function(container) {
  const employees = Store.getEmployees().filter(e => e.status === 'Active');
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Org Structure</div><h1>Organization Chart</h1><p class="desc">Built automatically from each employee's Reporting Manager field — top level at the top, each manager's team branching down below them.</p></div>
      ${employees.length ? `<div class="page-actions"><button class="btn btn-outline" onclick="printOrgChart()">&#128438; Print / PDF</button></div>` : ''}
    </div>
    <div id="orgchart-mount"></div>
  `;
  const mount = document.getElementById('orgchart-mount');
  if (employees.length === 0) {
    mount.innerHTML = `<div class="card"><div class="empty-state"><div class="ic">&#127970;</div><h4>No employees yet</h4><p>Add employees and set their Reporting Manager to build the chart.</p></div></div>`;
    return;
  }
  mount.innerHTML = `<div class="card card-pad" style="overflow-x:auto;"><div style="display:inline-flex;gap:48px;min-width:100%;justify-content:center;">${buildOrgForest(employees)}</div></div>`;
};

/* Shared by the live view and the printed version */
function buildOrgForest(employees) {
  const byId = {}; employees.forEach(e => byId[e.id] = e);
  const roots = employees.filter(e => !e.managerId || !byId[e.managerId]);
  const childrenOf = (id) => employees.filter(e => e.managerId === id);

  function nodeCard(emp) {
    const kids = childrenOf(emp.id);
    return `<div class="org-card">
      <div class="avatar-sm">${emp.photo ? `<img src="${emp.photo}">` : initials(emp.firstName,emp.lastName)}</div>
      <div>
        <div style="font-weight:600;font-size:12.5px;color:var(--ink);white-space:nowrap;">${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</div>
        <div class="text-faint" style="font-size:11px;white-space:nowrap;">${escapeHtml(emp.designation)} &middot; ${escapeHtml(emp.department)}</div>
      </div>
      ${kids.length ? `<span class="badge badge-info" style="margin-left:8px;">${kids.length}</span>` : ''}
    </div>`;
  }

  function renderBranch(emp) {
    const kids = childrenOf(emp.id);
    return `<li>
      ${nodeCard(emp)}
      ${kids.length ? `<ul>${kids.map(renderBranch).join('')}</ul>` : ''}
    </li>`;
  }

  return roots.map(r => `<ul class="org-tree">${renderBranch(r)}</ul>`).join('');
}

function printOrgChart() {
  const employees = Store.getEmployees().filter(e => e.status === 'Active');
  const html = `<div class="doc-page" style="max-width:none;">
    ${letterheadHTML('Organization Chart')}
    <div class="doc-title">ORGANIZATION CHART</div>
    <div style="overflow-x:auto;"><div style="display:inline-flex;gap:48px;min-width:100%;justify-content:center;">${buildOrgForest(employees)}</div></div>
  </div>`;
  printArea(html);
  Store.logDocument('Organization Chart', 'ALL', 'Organization Chart — printed');
}
