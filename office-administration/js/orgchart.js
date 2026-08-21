/* =========================================================
   orgchart.js — Reporting Hierarchy Visualization
   ========================================================= */

Modules.orgchart = function(container) {
  const employees = Store.getEmployees().filter(e => e.status === 'Active');
  container.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Org Structure</div><h1>Organization Chart</h1><p class="desc">Built automatically from each employee's Reporting Manager field.</p></div></div>
    <div id="orgchart-mount"></div>
  `;
  const mount = document.getElementById('orgchart-mount');
  if (employees.length === 0) {
    mount.innerHTML = `<div class="card"><div class="empty-state"><div class="ic">&#127970;</div><h4>No employees yet</h4><p>Add employees and set their Reporting Manager to build the chart.</p></div></div>`;
    return;
  }
  const byId = {}; employees.forEach(e => byId[e.id] = e);
  const roots = employees.filter(e => !e.managerId || !byId[e.managerId]);
  const childrenOf = (id) => employees.filter(e => e.managerId === id);

  function renderNode(emp, depth) {
    const kids = childrenOf(emp.id);
    return `
      <div class="org-node" style="margin-left:${depth*28}px;">
        <div class="org-card">
          <div class="avatar-sm">${emp.photo ? `<img src="${emp.photo}">` : initials(emp.firstName,emp.lastName)}</div>
          <div>
            <div style="font-weight:600;font-size:12.5px;color:var(--ink);">${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</div>
            <div class="text-faint" style="font-size:11px;">${escapeHtml(emp.designation)} · ${escapeHtml(emp.department)}</div>
          </div>
          ${kids.length ? `<span class="badge badge-info" style="margin-left:auto;">${kids.length} direct report${kids.length===1?'':'s'}</span>` : ''}
        </div>
        ${kids.length ? `<div class="org-children">${kids.map(k => renderNode(k, depth+1)).join('')}</div>` : ''}
      </div>
    `;
  }

  mount.innerHTML = `<div class="card card-pad">
    ${roots.length ? roots.map(r => renderNode(r, 0)).join('<div class="divider"></div>') : `<p class="text-dim" style="font-size:12.5px;">No top-level manager found — check that Reporting Manager fields are set correctly.</p>`}
  </div>`;
};
