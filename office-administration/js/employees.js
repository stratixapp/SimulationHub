/* =========================================================
   employees.js — Employee Form, Database, Personal File
   ========================================================= */

let _empPage = 1;
let _empSelected = new Set();
const EMP_PAGE_SIZE = 10;
let _empSearch = '';
let _empDeptFilter = '';
let _empStatusFilter = '';
let _empSort = 'name-asc';
let _empPhotoData = null;

Modules.employees = function(container) {
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Module 1 &amp; 2</div><h1>Employees</h1><p class="desc">Add new employees and manage the employee database — exactly as an HR executive would in a real company.</p></div>
      <div class="page-actions">
        <label class="btn btn-outline" style="cursor:pointer;">&#128228; Import Excel<input type="file" id="emp-import-input" accept=".csv" style="display:none;"></label>
        <button class="btn btn-outline" onclick="exportEmployeesCSV()">&#128190; Export Excel</button>
        <button class="btn btn-primary" onclick="openEmployeeForm()">+ Add Employee</button>
      </div>
    </div>
    <div class="toolbar">
      <div class="search-box"><span class="ic">&#128269;</span><input id="emp-search" placeholder="Search by name, ID, phone, department..." value="${escapeHtml(_empSearch)}"></div>
      <div class="filter-row">
        <select id="emp-filter-dept"><option value="">All Departments</option>${DEPARTMENTS.map(d=>`<option ${d===_empDeptFilter?'selected':''}>${d}</option>`).join('')}</select>
        <select id="emp-filter-status"><option value="">All Status</option><option ${_empStatusFilter==='Active'?'selected':''}>Active</option><option ${_empStatusFilter==='Inactive'?'selected':''}>Inactive</option></select>
        <select id="emp-sort">
          <option value="name-asc" ${_empSort==='name-asc'?'selected':''}>Name (A-Z)</option>
          <option value="name-desc" ${_empSort==='name-desc'?'selected':''}>Name (Z-A)</option>
          <option value="date-desc" ${_empSort==='date-desc'?'selected':''}>Joining Date (Newest)</option>
          <option value="date-asc" ${_empSort==='date-asc'?'selected':''}>Joining Date (Oldest)</option>
        </select>
      </div>
    </div>
    <div id="emp-table-mount"></div>
  `;
  document.getElementById('emp-search').oninput = (e) => { _empSearch = e.target.value; _empPage = 1; renderEmployeeTable(); };
  document.getElementById('emp-filter-dept').onchange = (e) => { _empDeptFilter = e.target.value; _empPage = 1; renderEmployeeTable(); };
  document.getElementById('emp-filter-status').onchange = (e) => { _empStatusFilter = e.target.value; _empPage = 1; renderEmployeeTable(); };
  document.getElementById('emp-sort').onchange = (e) => { _empSort = e.target.value; renderEmployeeTable(); };
  document.getElementById('emp-import-input').onchange = handleEmployeeImport;
  renderEmployeeTable();
};

function renderEmployeeTable() {
  const mount = document.getElementById('emp-table-mount');
  if (!mount) return;
  let list = Store.getEmployees().slice();

  if (_empSearch.trim()) {
    const q = _empSearch.toLowerCase();
    list = list.filter(e => `${e.firstName} ${e.lastName} ${e.id} ${e.phone} ${e.department} ${e.designation}`.toLowerCase().includes(q));
  }
  if (_empDeptFilter) list = list.filter(e => e.department === _empDeptFilter);
  if (_empStatusFilter) list = list.filter(e => e.status === _empStatusFilter);

  list.sort((a,b) => {
    if (_empSort === 'name-asc') return (a.firstName+a.lastName).localeCompare(b.firstName+b.lastName);
    if (_empSort === 'name-desc') return (b.firstName+b.lastName).localeCompare(a.firstName+a.lastName);
    if (_empSort === 'date-desc') return new Date(b.joiningDate) - new Date(a.joiningDate);
    if (_empSort === 'date-asc') return new Date(a.joiningDate) - new Date(b.joiningDate);
    return 0;
  });

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / EMP_PAGE_SIZE));
  _empPage = Math.min(_empPage, pages);
  const pageList = list.slice((_empPage-1)*EMP_PAGE_SIZE, _empPage*EMP_PAGE_SIZE);

  if (total === 0) {
    mount.innerHTML = `<div class="card"><div class="empty-state"><div class="ic">&#128100;</div><h4>No employees found</h4><p>Add your first employee or generate sample data to get started.</p><button class="btn btn-primary" onclick="openEmployeeForm()">+ Add Employee</button></div></div>`;
    return;
  }

  mount.innerHTML = `
    <div class="card">
      ${_empSelected.size > 0 ? `<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--paper-dim);border-bottom:1px solid var(--line);font-size:12.5px;">
        <b style="color:var(--ink);">${_empSelected.size} selected</b>
        <button class="btn btn-sm btn-outline" onclick="bulkExportSelected()">&#128190; Export Selected</button>
        <button class="btn btn-sm btn-danger" onclick="bulkDeleteSelected()">&#128465; Delete Selected</button>
        <button class="btn btn-sm btn-ghost" onclick="_empSelected.clear();renderEmployeeTable();">Clear Selection</button>
      </div>` : ''}
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th style="width:34px;"><input type="checkbox" id="emp-select-all" ${pageList.length && pageList.every(e=>_empSelected.has(e.id))?'checked':''}></th><th>Employee</th><th>ID</th><th>Department</th><th>Designation</th><th>Phone</th><th>Joining Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${pageList.map(e => `
              <tr>
                <td><input type="checkbox" class="emp-row-check" data-id="${e.id}" ${_empSelected.has(e.id)?'checked':''} onchange="toggleEmpSelect('${e.id}',this.checked)"></td>
                <td><div class="cell-name"><div class="avatar-sm">${e.photo ? `<img src="${e.photo}">` : initials(e.firstName,e.lastName)}</div>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</div></td>
                <td class="mono">${e.id}</td>
                <td>${escapeHtml(e.department)}</td>
                <td>${escapeHtml(e.designation)}</td>
                <td class="mono">${e.phone}</td>
                <td>${fmtDate(e.joiningDate)}</td>
                <td><span class="badge badge-${statusSlug(e.status)}">${e.status}</span></td>
                <td><div class="actions-cell">
                  <button class="icon-action" title="View" onclick="viewEmployee('${e.id}')">&#128065;</button>
                  <button class="icon-action" title="Edit" onclick="openEmployeeForm('${e.id}')">&#9998;</button>
                  <button class="icon-action" title="Print" onclick="printEmployeeProfile('${e.id}')">&#128438;</button>
                  <button class="icon-action danger" title="Delete" onclick="deleteEmployeeConfirm('${e.id}')">&#128465;</button>
                </div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span>Showing ${pageList.length ? (_empPage-1)*EMP_PAGE_SIZE+1 : 0}–${(_empPage-1)*EMP_PAGE_SIZE+pageList.length} of ${total} employees</span>
        <div class="pg-btns">
          <button class="pg-btn" ${_empPage<=1?'disabled':''} onclick="empGoPage(${_empPage-1})">‹</button>
          ${Array.from({length: pages}, (_,i)=>i+1).filter(p => p===1||p===pages||Math.abs(p-_empPage)<=1).reduce((acc,p,i,arr)=>{
            if (i>0 && p-arr[i-1]>1) acc.push('…');
            acc.push(p); return acc;
          },[]).map(p => p==='…' ? `<span style="padding:0 4px;">…</span>` : `<button class="pg-btn ${p===_empPage?'active':''}" onclick="empGoPage(${p})">${p}</button>`).join('')}
          <button class="pg-btn" ${_empPage>=pages?'disabled':''} onclick="empGoPage(${_empPage+1})">›</button>
        </div>
      </div>
    </div>
  `;
  const selectAllBox = document.getElementById('emp-select-all');
  if (selectAllBox) selectAllBox.onchange = (e) => {
    if (e.target.checked) pageList.forEach(emp => _empSelected.add(emp.id));
    else pageList.forEach(emp => _empSelected.delete(emp.id));
    renderEmployeeTable();
  };
}
function empGoPage(p) { _empPage = p; renderEmployeeTable(); }

/* ---------------- Bulk Selection & Actions ---------------- */
function toggleEmpSelect(id, checked) {
  if (checked) _empSelected.add(id); else _empSelected.delete(id);
  renderEmployeeTable();
}
function bulkExportSelected() {
  const rows = [['Employee ID','First Name','Last Name','Gender','DOB','Department','Designation','Phone','Email','Joining Date','Employment Type','Salary','Status','City','District']];
  Store.getEmployees().filter(e => _empSelected.has(e.id)).forEach(e => rows.push([e.id,e.firstName,e.lastName,e.gender,e.dob,e.department,e.designation,e.phone,e.email,e.joiningDate,e.employmentType,e.salary,e.status,e.city,e.district]));
  exportCSV(`selected-employees-${todayISO()}.csv`, rows);
}
function bulkDeleteSelected() {
  const count = _empSelected.size;
  confirmAction(`Move <b>${count}</b> selected employee(s) to the Recycle Bin? They can be restored later from Settings.`, () => {
    _empSelected.forEach(id => Store.deleteEmployee(id));
    _empSelected.clear();
    toast(`✓ ${count} employee(s) moved to Recycle Bin`, 'success');
    renderEmployeeTable();
  });
}
function initials(f,l) { return ((f?.[0]||'')+(l?.[0]||'')).toUpperCase(); }

function deleteEmployeeConfirm(id) {
  const emp = Store.getEmployee(id);
  confirmAction(`Delete <b>${escapeHtml(emp.firstName+' '+emp.lastName)}</b> (${id})? They'll be moved to the Recycle Bin (Settings) and can be restored later.`, () => {
    Store.deleteEmployee(id);
    toast('Employee moved to Recycle Bin', 'success');
    renderEmployeeTable();
  });
}

function exportEmployeesCSV() {
  const rows = [['Employee ID','First Name','Last Name','Gender','DOB','Department','Designation','Phone','Email','Joining Date','Employment Type','Salary','Status','City','District']];
  Store.getEmployees().forEach(e => rows.push([e.id,e.firstName,e.lastName,e.gender,e.dob,e.department,e.designation,e.phone,e.email,e.joiningDate,e.employmentType,e.salary,e.status,e.city,e.district]));
  exportCSV(`employee-database-${todayISO()}.csv`, rows);
  Store.logDocument('Employee Database Export', 'ALL', 'Employee Database Export');
}

/* Minimal CSV parser handling quoted fields (matches the format produced by exportEmployeesCSV) */
function parseCSVText(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  const cleaned = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i], next = cleaned[i+1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function handleEmployeeImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const rows = parseCSVText(ev.target.result);
    if (rows.length < 2) return toast('That file has no employee rows to import', 'error');
    const header = rows[0].map(h => h.trim().toLowerCase());
    const idx = (name) => header.indexOf(name);
    const col = {
      id: idx('employee id'), fname: idx('first name'), lname: idx('last name'), gender: idx('gender'),
      dob: idx('dob'), dept: idx('department'), desig: idx('designation'), phone: idx('phone'),
      email: idx('email'), joining: idx('joining date'), emptype: idx('employment type'),
      salary: idx('salary'), status: idx('status'), city: idx('city'), district: idx('district')
    };
    if (col.fname === -1 || col.lname === -1) {
      return toast('This file doesn\'t match the expected template — export a sample first to see the required columns', 'error');
    }
    let added = 0, skipped = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const fname = (r[col.fname] || '').trim();
      const lname = (r[col.lname] || '').trim();
      if (!fname || !lname) { skipped++; continue; }
      let id = col.id !== -1 ? (r[col.id] || '').trim() : '';
      if (!id || Store.getEmployee(id)) id = uid('EMP'); // avoid ID collisions on import
      Store.addEmployee({
        id, firstName: fname, lastName: lname,
        gender: col.gender !== -1 ? (r[col.gender]||'').trim() || 'Male' : 'Male',
        dob: col.dob !== -1 ? (r[col.dob]||'').trim() || '2000-01-01' : '2000-01-01',
        department: col.dept !== -1 ? (r[col.dept]||'').trim() || DEPARTMENTS[0] : DEPARTMENTS[0],
        designation: col.desig !== -1 ? (r[col.desig]||'').trim() || 'Office Assistant' : 'Office Assistant',
        phone: col.phone !== -1 ? (r[col.phone]||'').trim() : '',
        email: col.email !== -1 ? (r[col.email]||'').trim() : `${fname.toLowerCase()}.${lname.toLowerCase()}@example.com`,
        joiningDate: col.joining !== -1 ? (r[col.joining]||'').trim() || todayISO() : todayISO(),
        employmentType: col.emptype !== -1 ? (r[col.emptype]||'').trim() || 'Permanent' : 'Permanent',
        salary: col.salary !== -1 ? Number(r[col.salary]) || 20000 : 20000,
        status: col.status !== -1 ? (r[col.status]||'').trim() || 'Active' : 'Active',
        city: col.city !== -1 ? (r[col.city]||'').trim() : '',
        district: col.district !== -1 ? (r[col.district]||'').trim() : ''
      });
      added++;
    }
    toast(`✓ Imported ${added} employee(s)${skipped ? `, skipped ${skipped} incomplete row(s)` : ''}`, 'success');
    renderEmployeeTable();
    e.target.value = '';
  };
  reader.readAsText(file);
}

/* ---------------- Employee Form (Module 1) ---------------- */
function openEmployeeForm(empId, prefill) {
  const emp = empId ? Store.getEmployee(empId) : (prefill || null);
  _empPhotoData = emp?.photo || null;
  openModal({
    title: empId ? `Edit Employee — ${emp.firstName} ${emp.lastName}` : (prefill ? `New Employee — from Candidate ${prefill.firstName} ${prefill.lastName}` : 'Employee Information Form'),
    wide: true,
    body: employeeFormHTML(emp || {}),
    foot: `<button class="btn btn-outline" id="ef-reset">Reset</button><button class="btn btn-outline" id="ef-cancel">Cancel</button><button class="btn btn-primary" id="ef-save">${empId ? 'Save Changes' : 'Save Employee'}</button>`
  });
  document.getElementById('ef-photo-input').onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { _empPhotoData = ev.target.result; document.getElementById('ef-photo-preview').innerHTML = `<img src="${_empPhotoData}">`; };
    reader.readAsDataURL(file);
  };
  document.getElementById('ef-dob').onchange = (e) => {
    if (e.target.value) document.getElementById('ef-age').value = calcAge(e.target.value);
  };
  document.getElementById('ef-dept').onchange = (e) => populateDesignations(e.target.value);
  document.getElementById('ef-cancel').onclick = closeModal;
  document.getElementById('ef-reset').onclick = () => openEmployeeForm(empId, prefill);
  document.getElementById('ef-save').onclick = () => saveEmployeeForm(empId);
  populateDesignations(document.getElementById('ef-dept').value);
}

function populateDesignations(dept) {
  const list = DESIGNATIONS[dept] || [];
  const dl = document.getElementById('ef-desig-options');
  if (dl) dl.innerHTML = list.map(d => `<option value="${escapeHtml(d)}">`).join('');
}

function employeeFormHTML(e = {}) {
  const g = (k, d='') => e[k] !== undefined && e[k] !== null ? e[k] : d;
  return `
    <div class="form-section">
      <div class="sec-title">Photo &amp; Identity</div>
      <div class="photo-upload" style="margin-bottom:14px;">
        <div class="preview" id="ef-photo-preview">${e.photo ? `<img src="${e.photo}">` : '&#128100;'}</div>
        <div>
          <label class="btn btn-outline btn-sm" style="cursor:pointer;">Upload Photo<input type="file" id="ef-photo-input" accept="image/*" style="display:none;"></label>
          <div class="helptext" style="margin-top:6px;">JPG/PNG, passport style preferred</div>
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Employee ID</label><input id="ef-id" value="${g('id', uid('EMP'))}" ${e.id ? 'readonly' : ''}></div>
        <div class="field"><label>First Name <span class="req">*</span></label><input id="ef-fname" value="${escapeHtml(g('firstName'))}" required></div>
        <div class="field"><label>Last Name <span class="req">*</span></label><input id="ef-lname" value="${escapeHtml(g('lastName'))}" required></div>
        <div class="field"><label>Gender <span class="req">*</span></label><select id="ef-gender"><option ${g('gender')==='Male'?'selected':''}>Male</option><option ${g('gender')==='Female'?'selected':''}>Female</option><option ${g('gender')==='Other'?'selected':''}>Other</option></select></div>
        <div class="field"><label>Date of Birth <span class="req">*</span></label><input type="date" id="ef-dob" value="${g('dob')}"></div>
        <div class="field"><label>Age</label><input id="ef-age" value="${g('dob') ? calcAge(g('dob')) : ''}" readonly></div>
        <div class="field"><label>Father's Name</label><input id="ef-father" value="${escapeHtml(g('fatherName'))}"></div>
        <div class="field"><label>Mother's Name</label><input id="ef-mother" value="${escapeHtml(g('motherName'))}"></div>
        <div class="field"><label>Blood Group</label><select id="ef-blood">${BLOOD_GROUPS.map(b=>`<option ${g('bloodGroup')===b?'selected':''}>${b}</option>`).join('')}</select></div>
        <div class="field"><label>Nationality</label><input id="ef-nationality" value="${escapeHtml(g('nationality','Indian'))}"></div>
        <div class="field"><label>Marital Status</label><select id="ef-marital">${MARITAL_STATUS.map(m=>`<option ${g('maritalStatus')===m?'selected':''}>${m}</option>`).join('')}</select></div>
      </div>
    </div>
    <div class="form-section">
      <div class="sec-title">Contact Details</div>
      <div class="form-grid">
        <div class="field"><label>Email <span class="req">*</span></label><input type="email" id="ef-email" value="${escapeHtml(g('email'))}"></div>
        <div class="field"><label>Phone <span class="req">*</span></label><input id="ef-phone" value="${escapeHtml(g('phone'))}"></div>
        <div class="field"><label>Emergency Contact</label><input id="ef-emergency" value="${escapeHtml(g('emergencyContact'))}"></div>
        <div class="field span-3"><label>Address</label><textarea id="ef-address">${escapeHtml(g('address'))}</textarea></div>
        <div class="field"><label>City</label><input id="ef-city" value="${escapeHtml(g('city'))}"></div>
        <div class="field"><label>District</label><input id="ef-district" value="${escapeHtml(g('district'))}"></div>
        <div class="field"><label>State</label><input id="ef-state" value="${escapeHtml(g('state','Kerala'))}"></div>
        <div class="field"><label>PIN Code</label><input id="ef-pin" value="${escapeHtml(g('pin'))}"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="sec-title">Employment Details</div>
      <div class="form-grid">
        <div class="field"><label>Department <span class="req">*</span></label><select id="ef-dept">${DEPARTMENTS.map(d=>`<option ${g('department')===d?'selected':''}>${d}</option>`).join('')}</select></div>
        <div class="field"><label>Designation <span class="req">*</span></label><input id="ef-desig" list="ef-desig-options" value="${escapeHtml(g('designation'))}" placeholder="Select or type a custom designation"><datalist id="ef-desig-options"></datalist></div>
        <div class="field"><label>Joining Date <span class="req">*</span></label><input type="date" id="ef-joining" value="${g('joiningDate', todayISO())}"></div>
        <div class="field"><label>Salary (₹/month)</label><input type="number" id="ef-salary" value="${g('salary')}"></div>
        <div class="field"><label>Employment Type</label><select id="ef-emptype">${EMPLOYMENT_TYPES.map(t=>`<option ${g('employmentType')===t?'selected':''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Reporting Manager</label><select id="ef-manager"><option value="">— No Manager / Top Level —</option>${Store.getEmployees().filter(x=>x.id!==g('id')).map(x=>`<option value="${x.id}" ${g('managerId')===x.id?'selected':''}>${escapeHtml(x.firstName)} ${escapeHtml(x.lastName)} — ${escapeHtml(x.designation)}</option>`).join('')}</select></div>
        <div class="field"><label>Status</label><select id="ef-status">${['Active','Inactive','Probation','Confirmed','Notice Period','Resigned','Relieved','Terminated','Retired','Former Employee'].map(s=>`<option ${g('status','Active')===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Shift</label><select id="ef-shift">${Object.keys(SHIFT_PRESETS).map(s=>`<option ${(Store.getShift(g('id')).shiftName)===s?'selected':''}>${s}</option>`).join('')}</select></div>
      </div>
    </div>
    <div class="form-section">
      <div class="sec-title">Bank &amp; Statutory Details</div>
      <div class="form-grid">
        <div class="field"><label>Bank Name</label><input id="ef-bank" value="${escapeHtml(g('bankName'))}"></div>
        <div class="field"><label>Account Number</label><input id="ef-account" value="${escapeHtml(g('accountNumber'))}"></div>
        <div class="field"><label>IFSC Code</label><input id="ef-ifsc" value="${escapeHtml(g('ifsc'))}"></div>
        <div class="field"><label>Aadhaar Number</label><input id="ef-aadhaar" value="${escapeHtml(g('aadhaar'))}" placeholder="XXXX XXXX XXXX"></div>
        <div class="field"><label>PAN Number</label><input id="ef-pan" value="${escapeHtml(g('pan'))}" placeholder="ABCDE1234F"></div>
        <div class="field"><label>PF Number</label><input id="ef-pf" value="${escapeHtml(g('pfNumber'))}"></div>
        <div class="field"><label>ESI Number</label><input id="ef-esi" value="${escapeHtml(g('esiNumber'))}"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="sec-title">Education, Experience &amp; Skills</div>
      <div class="form-grid">
        <div class="field span-3"><label>Education</label><input id="ef-education" value="${escapeHtml(g('education'))}" placeholder="e.g. B.Com, Annamalai University"></div>
        <div class="field span-3"><label>Experience</label><input id="ef-experience" value="${escapeHtml(g('experience'))}" placeholder="e.g. 2 years prior experience"></div>
        <div class="field span-3"><label>Skills</label><input id="ef-skills" value="${escapeHtml(g('skills'))}" placeholder="e.g. MS Office, Tally, Communication"></div>
      </div>
    </div>
  `;
}

function saveEmployeeForm(existingId) {
  const val = id => document.getElementById(id).value.trim();
  const fname = val('ef-fname'), lname = val('ef-lname'), email = val('ef-email'), phone = val('ef-phone');
  const dept = val('ef-dept'), desig = val('ef-desig'), dob = val('ef-dob'), joining = val('ef-joining');
  const empId = val('ef-id');
  if (!fname || !lname) return toast('First and last name are required', 'error');
  if (!dob) return toast('Date of birth is required', 'error');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Valid email is required', 'error');
  if (!phone || phone.length < 10) return toast('Valid phone number is required', 'error');
  if (!desig) return toast('Please enter a designation', 'error');
  if (!empId) return toast('Employee ID cannot be empty', 'error');
  if (!existingId && Store.getEmployee(empId)) return toast(`Employee ID "${empId}" is already in use — please choose a different one`, 'error');

  const managerId = val('ef-manager');
  const managerEmp = managerId ? Store.getEmployee(managerId) : null;
  const emp = {
    id: empId, firstName: fname, lastName: lname, gender: val('ef-gender'), dob,
    fatherName: val('ef-father'), motherName: val('ef-mother'), bloodGroup: val('ef-blood'),
    nationality: val('ef-nationality'), maritalStatus: val('ef-marital'), email, phone,
    emergencyContact: val('ef-emergency'), address: val('ef-address'), city: val('ef-city'),
    district: val('ef-district'), state: val('ef-state'), pin: val('ef-pin'),
    department: dept, designation: desig, joiningDate: joining, salary: Number(val('ef-salary')) || 0,
    employmentType: val('ef-emptype'), managerId: managerId || null,
    reportingManager: managerEmp ? `${managerEmp.firstName} ${managerEmp.lastName}` : '', status: val('ef-status'),
    bankName: val('ef-bank'), accountNumber: val('ef-account'), ifsc: val('ef-ifsc'),
    aadhaar: val('ef-aadhaar'), pan: val('ef-pan'), pfNumber: val('ef-pf'), esiNumber: val('ef-esi'),
    education: val('ef-education'), experience: val('ef-experience'), skills: val('ef-skills'),
    photo: _empPhotoData
  };

  if (existingId) {
    Store.updateEmployee(existingId, emp);
    toast('✓ Employee updated', 'success');
  } else {
    Store.addEmployee(emp);
    toast('✓ Employee saved to database', 'success');
  }
  const shiftName = val('ef-shift');
  Store.setShift(emp.id, { shiftName, ...SHIFT_PRESETS[shiftName] });
  closeModal();
  if (document.getElementById('emp-table-mount')) renderEmployeeTable();
  refreshTopbarBadges();
}

/* Pulls together this employee's footprint across Payroll, Assets and Performance -
   the profile becomes a real hub instead of an isolated record. */
function renderEmployeeCrossModuleSnapshot(empId) {
  const heldAssets = Store.getAssets().filter(a => a.assignedTo === empId);
  const runs = Store.getPayrollRuns().filter(r => r.payslips.some(p => p.empId === empId)).sort((a,b) => b.month.localeCompare(a.month));
  const latestPayslip = runs.length ? runs[0].payslips.find(p => p.empId === empId) : null;
  const appraisals = Store.load().appraisals.filter(a => a.empId === empId && a.status === 'Finalized').sort((a,b) => (b.id||'').localeCompare(a.id||''));
  const latestAppraisal = appraisals[0];

  return `
    <h4 style="font-size:13px;margin-bottom:10px;">Cross-Module Snapshot</h4>
    <div class="grid grid-3">
      <div class="card card-pad" style="padding:14px;">
        <div class="stat-label" style="margin-bottom:6px;">Company Assets Held</div>
        ${heldAssets.length ? heldAssets.map(a => `<div style="font-size:12px;margin-bottom:3px;">💻 ${escapeHtml(a.name)}</div>`).join('') : `<div class="text-faint" style="font-size:12px;">None currently</div>`}
        <button class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="navigate('assets');closeModal();">Open Assets →</button>
      </div>
      <div class="card card-pad" style="padding:14px;">
        <div class="stat-label" style="margin-bottom:6px;">Latest Payslip</div>
        ${latestPayslip ? `<div style="font-size:12px;">${monthLabel(runs[0].month)}<br><b style="color:var(--ink);">₹${latestPayslip.netPay.toLocaleString('en-IN')}</b> net pay</div>` : `<div class="text-faint" style="font-size:12px;">No payroll run yet</div>`}
        <button class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="navigate('payroll');closeModal();">Open Payroll →</button>
      </div>
      <div class="card card-pad" style="padding:14px;">
        <div class="stat-label" style="margin-bottom:6px;">Latest Appraisal</div>
        ${latestAppraisal ? `<div style="font-size:12px;">${'★'.repeat(Math.round(latestAppraisal.overallRating))}${'☆'.repeat(5-Math.round(latestAppraisal.overallRating))} (${latestAppraisal.overallRating}/5)</div>` : `<div class="text-faint" style="font-size:12px;">No finalized review yet</div>`}
        <button class="btn btn-sm btn-outline" style="margin-top:8px;" onclick="navigate('performance');closeModal();">Open Performance →</button>
      </div>
    </div>
  `;
}

/* ---------------- Offboarding Checklist ---------------- */
function renderOffboardingChecklist(empId) {
  const docs = Store.getDocuments().filter(d => d.empId === empId);
  const assets = Store.getAssets().filter(a => a.assignedTo === empId);
  const items = [
    { label: 'All company assets returned', done: assets.length === 0 },
    { label: 'Relieving Letter issued', done: docs.some(d => d.type === 'Relieving Letter') },
    { label: 'Experience Certificate issued', done: docs.some(d => d.type === 'Experience Certificate') },
    { label: 'Full &amp; Final settlement (final payslip) generated', done: docs.some(d => d.type === 'Payslip') }
  ];
  const doneCount = items.filter(i => i.done).length;
  return `
    <div class="divider"></div>
    <div style="background:#FFF8ED;border:1px solid #F0DFB8;border-radius:8px;padding:14px 16px;">
      <div class="flex-between" style="margin-bottom:8px;"><h4 style="font-size:13px;">Exit Checklist</h4><span class="text-faint" style="font-size:11.5px;">${doneCount}/${items.length} complete</span></div>
      ${items.map(i => `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:4px 0;color:${i.done?'var(--sage-dark)':'var(--text-dim)'};">${i.done ? '✅' : '⬜'} ${i.label}</div>`).join('')}
      ${assets.length ? `<div style="margin-top:8px;font-size:11.5px;color:var(--clay-dark);">⚠ Still holding: ${assets.map(a=>escapeHtml(a.name)).join(', ')}</div>` : ''}
    </div>
  `;
}

/* ---------------- View / Print Employee ---------------- */
function viewEmployee(id) {
  const e = Store.getEmployee(id);
  if (!e) return;
  const bal = Store.getLeaveBalance(id);
  openModal({
    title: 'Employee Profile',
    wide: true,
    body: `
      <div class="profile-header" style="padding:0 0 18px;">
        <div class="avatar-lg">${e.photo ? `<img src="${e.photo}">` : initials(e.firstName,e.lastName)}</div>
        <div>
          <h2>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</h2>
          <div class="role">${escapeHtml(e.designation)} · ${escapeHtml(e.department)}</div>
          <div class="tags"><span class="badge badge-${statusSlug(e.status)}">${e.status}</span><span class="badge badge-info">${escapeHtml(e.employmentType||'')}</span></div>
        </div>
      </div>
      <div class="grid grid-2">
        <div class="kv-list">
          <div class="kv-row"><span class="k">Employee ID</span><span class="v mono">${e.id}</span></div>
          <div class="kv-row"><span class="k">Gender</span><span class="v">${e.gender}</span></div>
          <div class="kv-row"><span class="k">Date of Birth</span><span class="v">${fmtDate(e.dob)} (${calcAge(e.dob)} yrs)</span></div>
          <div class="kv-row"><span class="k">Blood Group</span><span class="v">${e.bloodGroup||'—'}</span></div>
          <div class="kv-row"><span class="k">Phone</span><span class="v">${e.phone}</span></div>
          <div class="kv-row"><span class="k">Email</span><span class="v">${e.email}</span></div>
          <div class="kv-row"><span class="k">Address</span><span class="v" style="text-align:right;max-width:220px;">${escapeHtml(e.address)}, ${escapeHtml(e.city)}, ${escapeHtml(e.district)} - ${e.pin}</span></div>
        </div>
        <div class="kv-list">
          <div class="kv-row"><span class="k">Joining Date</span><span class="v">${fmtDate(e.joiningDate)}</span></div>
          <div class="kv-row"><span class="k">Reporting Manager</span><span class="v">${e.reportingManager||'—'}</span></div>
          <div class="kv-row"><span class="k">Salary</span><span class="v">₹${Number(e.salary||0).toLocaleString('en-IN')}/mo</span></div>
          <div class="kv-row"><span class="k">Bank</span><span class="v">${e.bankName||'—'} ${e.accountNumber ? '•• '+String(e.accountNumber).slice(-4) : ''}</span></div>
          <div class="kv-row"><span class="k">PAN</span><span class="v mono">${e.pan||'—'}</span></div>
          <div class="kv-row"><span class="k">Leave Balance</span><span class="v">CL ${bal.CL} · SL ${bal.SL} · EL ${bal.EL}</span></div>
          <div class="kv-row"><span class="k">Skills</span><span class="v" style="text-align:right;max-width:220px;">${escapeHtml(e.skills)||'—'}</span></div>
        </div>
      </div>
      ${(e.status === 'Inactive' || e.status === 'Former Employee') ? renderOffboardingChecklist(e.id) : ''}
      <div class="divider"></div>
      ${renderEmployeeCrossModuleSnapshot(e.id)}
      <div class="divider"></div>
      <h4 style="font-size:13px;margin-bottom:10px;">Employee Timeline</h4>
      <div style="max-height:180px;overflow-y:auto;">
        ${Store.getTimeline(e.id).length ? Store.getTimeline(e.id).map(t => `<div class="activity-item"><div class="a-dot"></div><div><div>${t.text}</div><div class="a-time">${new Date(t.at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div></div></div>`).join('') : `<p class="text-dim" style="font-size:12.5px;">No history yet.</p>`}
      </div>
    `,
    foot: `<button class="btn btn-outline" onclick="navigate('personal-file');closeModal();">Open Personal File</button><button class="btn btn-primary" onclick="printEmployeeProfile('${e.id}')">Print Profile</button>`
  });
}

function printEmployeeProfile(id) {
  const e = Store.getEmployee(id);
  const html = `<div class="doc-page">
    ${letterheadHTML('Employee Master Record')}
    <div class="doc-ref-row"><span>Confidential — HR Use Only</span><span>Generated ${fmtDate(todayISO())}</span></div>
    <div class="doc-title">EMPLOYEE PROFILE</div>
    <table class="doc-table">
      <tr><th>Employee ID</th><td>${e.id}</td><th>Status</th><td>${e.status}</td></tr>
      <tr><th>Full Name</th><td>${escapeHtml(e.firstName)} ${escapeHtml(e.lastName)}</td><th>Gender</th><td>${e.gender}</td></tr>
      <tr><th>Date of Birth</th><td>${fmtDate(e.dob)}</td><th>Blood Group</th><td>${e.bloodGroup||'—'}</td></tr>
      <tr><th>Department</th><td>${escapeHtml(e.department)}</td><th>Designation</th><td>${escapeHtml(e.designation)}</td></tr>
      <tr><th>Joining Date</th><td>${fmtDate(e.joiningDate)}</td><th>Employment Type</th><td>${e.employmentType}</td></tr>
      <tr><th>Phone</th><td>${e.phone}</td><th>Email</th><td>${e.email}</td></tr>
      <tr><th>Address</th><td colspan="3">${escapeHtml(e.address)}, ${escapeHtml(e.city)}, ${escapeHtml(e.district)}, ${e.state} - ${e.pin}</td></tr>
      <tr><th>Bank</th><td>${e.bankName||'—'}</td><th>A/C No.</th><td>${e.accountNumber||'—'}</td></tr>
      <tr><th>PAN</th><td>${e.pan||'—'}</td><th>Aadhaar</th><td>${e.aadhaar||'—'}</td></tr>
    </table>
    <p style="margin-top:30px;font-size:10.5px;color:#888;">This is a system-generated document for training/simulation purposes only.</p>
  </div>`;
  printArea(html);
}

/* ---------------- Personal File (Module 8) ---------------- */
const PF_TABS = ['Personal Details','Educational Certificates','Experience Certificates','Identity Proof','Address Proof','Bank Details','Nomination','Medical','Performance','Promotion','Transfer','Disciplinary Records'];
let _pfEmpId = null, _pfActiveTab = 'Personal Details';

Modules['personal-file'] = function(container) {
  const employees = Store.getEmployees();
  if (!_pfEmpId && employees.length) _pfEmpId = employees[0].id;
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">Module 8</div><h1>Employee Personal File</h1><p class="desc">Exactly like a physical HR file — organized into tabs, each employee's complete record in one place.</p></div>
      <div class="page-actions"><select id="pf-emp-select" style="padding:9px 12px;border:1px solid var(--line-strong);border-radius:6px;min-width:220px;"></select></div>
    </div>
    <div id="pf-mount"></div>
  `;
  const sel = document.getElementById('pf-emp-select');
  sel.innerHTML = employees.length ? employees.map(e => `<option value="${e.id}" ${e.id===_pfEmpId?'selected':''}>${e.firstName} ${e.lastName} (${e.id})</option>`).join('') : `<option>No employees yet</option>`;
  sel.onchange = (e) => { _pfEmpId = e.target.value; renderPersonalFile(); };
  renderPersonalFile();
};

function renderPersonalFile() {
  const mount = document.getElementById('pf-mount');
  if (!mount) return;
  const emp = Store.getEmployee(_pfEmpId);
  if (!emp) { mount.innerHTML = `<div class="card"><div class="empty-state"><div class="ic">&#128193;</div><h4>No employee selected</h4><p>Add an employee first to build their personal file.</p><button class="btn btn-primary" onclick="navigate('employees')">Go to Employees</button></div></div>`; return; }

  mount.innerHTML = `
    <div class="card">
      <div class="profile-header">
        <div class="avatar-lg">${emp.photo ? `<img src="${emp.photo}">` : initials(emp.firstName,emp.lastName)}</div>
        <div><h2>${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}</h2><div class="role">${escapeHtml(emp.designation)} · File No. ${emp.id}</div><span class="badge badge-${statusSlug(emp.status)}" style="margin-top:6px;display:inline-flex;">${emp.status}</span></div>
      </div>
      <div class="divider" style="margin:0;"></div>
      <div class="file-tabs-layout card-pad">
        <div class="file-tab-list" id="pf-tab-list">
          ${PF_TABS.map(t => `<button class="${t===_pfActiveTab?'active':''}" data-tab="${t}">${t}</button>`).join('')}
        </div>
        <div id="pf-tab-content"></div>
      </div>
    </div>
  `;
  document.querySelectorAll('#pf-tab-list button').forEach(btn => btn.onclick = () => { _pfActiveTab = btn.dataset.tab; renderPersonalFile(); });
  renderPFTabContent(emp);
}

function renderPFTabContent(emp) {
  const el = document.getElementById('pf-tab-content');
  const uploadKey = `pf_${emp.id}_${_pfActiveTab.replace(/\s/g,'_')}`;
  const uploaded = JSON.parse(localStorage.getItem(uploadKey) || 'null');

  if (_pfActiveTab === 'Personal Details') {
    el.innerHTML = `<div class="kv-list">
      <div class="kv-row"><span class="k">Father's Name</span><span class="v">${escapeHtml(emp.fatherName)||'—'}</span></div>
      <div class="kv-row"><span class="k">Mother's Name</span><span class="v">${escapeHtml(emp.motherName)||'—'}</span></div>
      <div class="kv-row"><span class="k">Marital Status</span><span class="v">${emp.maritalStatus||'—'}</span></div>
      <div class="kv-row"><span class="k">Nationality</span><span class="v">${escapeHtml(emp.nationality)||'—'}</span></div>
      <div class="kv-row"><span class="k">Emergency Contact</span><span class="v">${emp.emergencyContact||'—'}</span></div>
      <div class="kv-row"><span class="k">Education</span><span class="v">${escapeHtml(emp.education)||'—'}</span></div>
      <div class="kv-row"><span class="k">Experience</span><span class="v">${escapeHtml(emp.experience)||'—'}</span></div>
    </div>`;
    return;
  }
  if (['Nomination','Medical','Performance','Promotion','Transfer','Disciplinary Records'].includes(_pfActiveTab)) {
    const notesKey = `pfnotes_${emp.id}_${_pfActiveTab.replace(/\s/g,'_')}`;
    const notes = localStorage.getItem(notesKey) || '';
    el.innerHTML = `
      <div class="field" style="margin-bottom:14px;"><label>${_pfActiveTab} — Remarks / Record Entry</label><textarea id="pf-notes" rows="5" placeholder="Enter ${_pfActiveTab.toLowerCase()} details...">${escapeHtml(notes)}</textarea></div>
      <button class="btn btn-primary btn-sm" id="pf-save-notes">Save Entry</button>
      ${renderUploadSlot(uploadKey, uploaded)}
    `;
    document.getElementById('pf-save-notes').onclick = () => {
      localStorage.setItem(notesKey, document.getElementById('pf-notes').value);
      toast('Entry saved', 'success');
    };
    bindUploadSlot(uploadKey);
    return;
  }
  // Document-upload style tabs
  el.innerHTML = `<p class="text-dim" style="font-size:12.5px;margin-bottom:14px;">Upload a scanned copy or sample document to complete this section of the personal file.</p>${renderUploadSlot(uploadKey, uploaded)}`;
  bindUploadSlot(uploadKey);
}

function renderUploadSlot(key, uploaded) {
  return `
    <div class="upload-slot ${uploaded ? 'filled' : ''}" id="pf-upload-slot">
      ${uploaded ? `&#9989; <b>${escapeHtml(uploaded.name)}</b> uploaded — <a href="#" id="pf-remove-upload">remove</a>` : `<div>&#128194; No document uploaded yet</div>`}
    </div>
    <label class="btn btn-outline btn-sm" style="cursor:pointer;">Upload Document<input type="file" id="pf-file-input" style="display:none;"></label>
  `;
}
function bindUploadSlot(key) {
  const input = document.getElementById('pf-file-input');
  if (input) input.onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    localStorage.setItem(key, JSON.stringify({ name: file.name, uploadedOn: todayISO() }));
    toast('✓ Document uploaded', 'success');
    renderPersonalFile();
  };
  const rm = document.getElementById('pf-remove-upload');
  if (rm) rm.onclick = (e) => { e.preventDefault(); localStorage.removeItem(key); renderPersonalFile(); };
}
