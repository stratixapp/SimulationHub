/* =========================================================
   OATS — Office Administration Training Simulator
   storage.js — persistence layer, data models, sample data
   ========================================================= */

let DB_KEY = 'oats_db_v1__guest'; // overwritten by Auth on login via Store.setStudent()

/* Cross-tab safety: if the same student is logged in on two tabs (same browser, same
   computer), localStorage is genuinely shared between them, but each tab keeps its own
   in-memory copy of the data. Without this, editing in Tab A wouldn't show in Tab B until
   a manual refresh, and Tab B could silently overwrite Tab A's changes on its next save
   (last-write-wins). This listens for the browser's real 'storage' event (fires in OTHER
   tabs on the same origin whenever localStorage changes) and invalidates this tab's cache
   so it re-reads fresh data on its next access. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY) {
      Store._data = null;
      if (typeof navigate === 'function' && typeof currentRoute !== 'undefined') navigate(currentRoute);
    }
  });
}

const DEPARTMENTS = ['Administration', 'Human Resources', 'Accounts & Finance', 'Sales & Marketing', 'Operations', 'IT & Systems', 'Customer Support', 'Procurement'];
const DESIGNATIONS = {
  'Administration': ['Office Assistant', 'Administrative Executive', 'Office Manager', 'Front Desk Executive'],
  'Human Resources': ['HR Executive', 'HR Manager', 'Recruitment Officer', 'HR Assistant'],
  'Accounts & Finance': ['Accountant', 'Accounts Executive', 'Finance Manager', 'Billing Clerk'],
  'Sales & Marketing': ['Sales Executive', 'Marketing Executive', 'Sales Manager', 'Business Development Officer'],
  'Operations': ['Operations Executive', 'Operations Manager', 'Logistics Coordinator', 'Store Supervisor'],
  'IT & Systems': ['IT Support Executive', 'System Administrator', 'Software Trainee', 'Network Technician'],
  'Customer Support': ['Customer Care Executive', 'Support Team Lead', 'Helpdesk Associate'],
  'Procurement': ['Purchase Executive', 'Procurement Officer', 'Vendor Coordinator']
};
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const EMPLOYMENT_TYPES = ['Permanent', 'Probation', 'Contract', 'Intern'];

// ---- Exit Management constants (additive) ----
const RESIGNATION_REASONS = ['Better Opportunity', 'Higher Studies', 'Relocation', 'Health Reasons', 'Family Reasons', 'Compensation', 'Work Environment', 'Career Change', 'Retirement', 'Other'];
const CLEARANCE_DEPARTMENTS = ['HR', 'Finance', 'IT', 'Admin', 'Security', 'Reporting Manager', 'Operations'];
const EXIT_CHECKLIST_TEMPLATE = [
  { key: 'kt', label: 'Knowledge Transfer', category: 'General' },
  { key: 'handover', label: 'Project Handover', category: 'General' },
  { key: 'tasks', label: 'Pending Tasks Closed', category: 'General' },
  { key: 'mgr_approval', label: 'Manager Approval', category: 'General' },
  { key: 'laptop', label: 'Laptop', category: 'Asset Return' },
  { key: 'monitor', label: 'Monitor', category: 'Asset Return' },
  { key: 'keyboard', label: 'Keyboard', category: 'Asset Return' },
  { key: 'mouse', label: 'Mouse', category: 'Asset Return' },
  { key: 'headset', label: 'Headset', category: 'Asset Return' },
  { key: 'id_card', label: 'ID Card', category: 'Asset Return' },
  { key: 'access_card', label: 'Access Card', category: 'Asset Return' },
  { key: 'office_keys', label: 'Office Keys', category: 'Asset Return' },
  { key: 'sim_card', label: 'SIM Card', category: 'Asset Return' },
  { key: 'company_phone', label: 'Company Phone', category: 'Asset Return' },
  { key: 'documents', label: 'Documents', category: 'Documents' },
  { key: 'uniform', label: 'Uniform', category: 'Documents' },
  { key: 'others', label: 'Others', category: 'Documents' }
];
const EXIT_ITEM_STATUSES = ['Pending', 'Returned', 'Damaged', 'Lost'];
const SHIFT_PRESETS = {
  'General': { start: '09:30', end: '18:30' },
  'Morning': { start: '06:00', end: '14:00' },
  'Evening': { start: '14:00', end: '22:00' },
  'Night':   { start: '22:00', end: '06:00' }
};
const MARITAL_STATUS = ['Single', 'Married'];
const FIRST_NAMES_M = ['Arjun','Anand','Vishnu','Nikhil','Sarath','Rahul','Akhil','Sreejith','Manoj','Vivek','Ajay','Basil','Christo','Dilip','Gokul','Harish','Jithin','Kiran','Muhammed','Naveen','Pranav','Rohit','Sabin','Tinu','Ullas'];
const FIRST_NAMES_F = ['Anjali','Aparna','Athira','Divya','Fathima','Gayathri','Haritha','Jisha','Kavya','Lekshmi','Meera','Nithya','Parvathy','Reshma','Sandra','Sneha','Swathi','Teena','Vidya','Ashwathy','Devika','Farsana','Greeshma','Jinsy','Krishnapriya'];
const LAST_NAMES = ['Nair','Menon','Pillai','Kumar','Varma','Thomas','George','Jose','Mathew','Abraham','Krishnan','Raj','Suresh','Prasad','Chandran','Babu','Mohan','Das','Iyer','Panicker'];
const CITIES_KERALA = [
  {city:'Thiruvalla', district:'Pathanamthitta'},{city:'Kottayam', district:'Kottayam'},
  {city:'Changanassery', district:'Kottayam'},{city:'Thiruvananthapuram', district:'Thiruvananthapuram'},
  {city:'Kochi', district:'Ernakulam'},{city:'Alappuzha', district:'Alappuzha'},
  {city:'Pathanamthitta', district:'Pathanamthitta'},{city:'Kollam', district:'Kollam'},
  {city:'Thodupuzha', district:'Idukki'},{city:'Muvattupuzha', district:'Ernakulam'}
];
const HOLIDAYS_2026 = [
  {date:'2026-01-01', name:"New Year's Day"}, {date:'2026-01-14', name:'Makar Sankranti'},
  {date:'2026-01-26', name:'Republic Day'}, {date:'2026-03-21', name:'Eid-ul-Fitr'},
  {date:'2026-04-14', name:'Vishu'}, {date:'2026-05-01', name:'May Day'},
  {date:'2026-08-15', name:'Independence Day'}, {date:'2026-08-26', name:'Onam'},
  {date:'2026-10-02', name:'Gandhi Jayanti'}, {date:'2026-11-08', name:'Deepavali'},
  {date:'2026-12-25', name:'Christmas'}
];

function pad(n, len=2) { return String(n).padStart(len, '0'); }
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function uid(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random()*9000+1000); }
function todayISO() { return new Date().toISOString().slice(0,10); }
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function calcAge(dobISO) {
  const dob = new Date(dobISO);
  const diff = Date.now() - dob.getTime();
  return Math.abs(new Date(diff).getUTCFullYear() - 1970);
}
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* Converts a multi-word status like "Notice Period" into a CSS-safe class suffix "notice-period" */
function statusSlug(status) {
  return String(status || '').toLowerCase().replace(/\s+/g, '-');
}

/* Shared letterhead markup used by every generated document, driven by Settings */
function letterheadHTML(subtitle) {
  const meta = Store.load().meta;
  return `<div class="doc-letterhead">
    <div>${meta.companyLogo ? `<img src="${meta.companyLogo}" style="height:34px;margin-bottom:6px;">` : ''}<div class="co-name">${escapeHtml(meta.institution)}</div><div class="co-tag">${escapeHtml(subtitle || 'Human Resources Department')}</div></div>
    <div class="co-addr">${escapeHtml(meta.companyAddress)}<br>${escapeHtml(meta.companyPhone)}<br>${escapeHtml(meta.companyEmail)}</div>
  </div>`;
}

/* Standard Indian-style CTC breakup from a monthly gross figure */
function defaultSalaryStructure(monthlyGross) {
  const gross = Number(monthlyGross) || 20000;
  const basic = Math.round(gross * 0.45);
  const hra = Math.round(basic * 0.40);
  const conveyance = 1600;
  const medical = 1250;
  const special = Math.max(0, gross - basic - hra - conveyance - medical);
  const pf = Math.round(basic * 0.12);
  const esi = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
  const pt = gross > 12500 ? 200 : 0;
  return { basic, hra, conveyance, medical, special, pf, esi, pt, otherDeduction: 0 };
}

const Store = {
  _data: null,

  load() {
    if (this._data) return this._data;
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      try { this._data = this.migrate(JSON.parse(raw)); return this._data; } catch(e) { console.error('DB parse error', e); }
    }
    this._data = this.emptyDB();
    return this._data;
  },

  save() {
    localStorage.setItem(DB_KEY, JSON.stringify(this._data));
  },

  emptyDB() {
    return {
      meta: {
        institution: 'Skelora Institute',
        companyAddress: 'Thiruvalla, Kottayam Dist., Kerala, India — 689101',
        companyPhone: '+91 469 000 0000',
        companyEmail: 'hr@skelorainstitute.com',
        companyLogo: null,
        courseTrack: 'full', // 'full' | 'core' — controls sidebar/practicals/sessions visibility, defaults to showing everything
        createdAt: todayISO(), studentName: '', batch: ''
      },
      employees: [],
      attendance: {},   // { 'YYYY-MM': { empId: { '01': 'P', '02': 'A', ... } } }
      shifts: {},       // { empId: { shiftName, start, end } }
      attendanceTimes: {}, // { 'YYYY-MM': { empId: { '01': { in, out } } } }
      regularizations: [], // { id, empId, date, reason, requestedCode, status }
      leaveApplications: [],
      leaveBalances: {}, // { empId: { CL: n, SL: n, EL: n, LOP: n } }
      documents: [],     // generated document log {id, type, empId, date, title}
      notices: [],
      activityLog: [],
      empTimeline: {},   // { empId: [ {id, at, text} ] }
      salaryStructures: {}, // { empId: { basic, hra, conveyance, medical, special, pf, esi, pt, otherDeduction } }
      payrollRuns: [],   // { id, month, generatedOn, payslips: [{empId, ...breakdown, netPay}] }
      assets: [],        // { id, name, category, serialNo, status, assignedTo, issuedOn, returnedOn, condition }
      jobRequisitions: [], // { id, title, department, openings, status, postedOn, description }
      candidates: [],    // { id, name, phone, email, requisitionId, stage, appliedOn, resumeNote, rating }
      appraisalCycles: [], // { id, name, period, status, createdOn }
      appraisals: [],     // { id, cycleId, empId, kpis:[{label,score,comments}], overallRating, managerComments, status }

      // ---- Exit Management (additive) ----
      resignations: [],       // { id, empId, resignationDate, lastWorkingDay, noticePeriodDays, reason, notes, letterFileName,
                               //   status: Pending|Manager Approved|HR Approved|Rejected|Cancelled,
                               //   noticeStatus: Running|Completed|Released, earlyReleaseApproved, createdAt }
      exitChecklists: {},     // { resignationId: [ {key,label,category,status,remarks} ] }
      departmentClearances: {}, // { resignationId: { HR:{status,comments,completionDate,responsible}, Finance:{...}, ... } }
      finalSettlements: {},    // { resignationId: { pendingSalary,leaveEncashment,bonus,incentives,commission,overtime,
                               //   recoveries,assetDamage,advanceSalary,loans,tax,otherDeductions,status,paidDate,paymentMethod } }
      exitInterviews: {}       // { resignationId: { whyLeaving,enjoyed,improve,recommend,rejoin,ratings:{...},suggestions,overallRating,conductedOn } }
    };
  },

  /* Backfill any keys missing from an older saved DB (schema migration) */
  migrate(d) {
    const blank = this.emptyDB();
    Object.keys(blank).forEach(k => { if (d[k] === undefined) d[k] = blank[k]; });
    // Deep-merge meta specifically, since it's an object that gains new sub-fields over versions
    d.meta = { ...blank.meta, ...d.meta };
    return d;
  },

  reset() {
    this._data = this.emptyDB();
    this.save();
  },

  log(action) {
    const d = this.load();
    d.activityLog.unshift({ id: uid('ACT'), action, at: new Date().toISOString() });
    d.activityLog = d.activityLog.slice(0, 100);
  },

  logTimeline(empId, text) {
    const d = this.load();
    if (!d.empTimeline[empId]) d.empTimeline[empId] = [];
    d.empTimeline[empId].unshift({ id: uid('TL'), text, at: new Date().toISOString() });
    d.empTimeline[empId] = d.empTimeline[empId].slice(0, 60);
  },
  getTimeline(empId) { return this.load().empTimeline[empId] || []; },

  // ---------- Employees ----------
  addEmployee(emp) {
    const d = this.load();
    emp.id = emp.id || uid('EMP');
    emp.status = emp.status || 'Active';
    emp.createdAt = todayISO();
    d.employees.push(emp);
    d.leaveBalances[emp.id] = { CL: 12, SL: 12, EL: 15, ML: emp.gender === 'Female' ? 182 : 0, PL: emp.gender === 'Male' ? 15 : 0, LOP: 0 };
    d.salaryStructures[emp.id] = defaultSalaryStructure(emp.salary);
    this.log(`Employee <b>${escapeHtml(emp.firstName + ' ' + emp.lastName)}</b> added to ${escapeHtml(emp.department)}`);
    this.logTimeline(emp.id, `Joined as ${escapeHtml(emp.designation)} in ${escapeHtml(emp.department)}`);
    this.save();
    return emp;
  },
  updateEmployee(id, patch) {
    const d = this.load();
    const idx = d.employees.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const before = d.employees[idx];
    if (patch.department && patch.department !== before.department) this.logTimeline(id, `Transferred from ${escapeHtml(before.department)} to ${escapeHtml(patch.department)}`);
    if (patch.designation && patch.designation !== before.designation) this.logTimeline(id, `Designation changed from ${escapeHtml(before.designation)} to ${escapeHtml(patch.designation)}`);
    if (patch.status && patch.status !== before.status) this.logTimeline(id, `Status changed to ${escapeHtml(patch.status)}`);
    d.employees[idx] = { ...d.employees[idx], ...patch };
    this.log(`Employee <b>${escapeHtml(d.employees[idx].firstName + ' ' + d.employees[idx].lastName)}</b> updated`);
    this.save();
    return d.employees[idx];
  },
  deleteEmployee(id) {
    // Soft delete: moves to Recycle Bin instead of permanent removal (Feature 13 - "cannot
    // permanently delete records"). getEmployees()/getEmployee() both filter these out, so
    // every other module in the app behaves exactly as it did with a hard delete - the record
    // is simply recoverable from Settings > Recycle Bin instead of being gone forever.
    const d = this.load();
    const emp = d.employees.find(e => e.id === id);
    if (!emp) return;
    emp.deletedAt = new Date().toISOString();
    // Release any assets this employee was holding, instead of leaving them "issued to" a ghost record
    d.assets.forEach(a => { if (a.assignedTo === id) { a.status = 'Available'; a.assignedTo = null; a.returnedOn = todayISO(); } });
    // Clear this employee as anyone else's manager, so the org chart doesn't reference a deleted person
    d.employees.forEach(e => { if (e.managerId === id) { e.managerId = null; e.reportingManager = ''; } });
    this.log(`Employee <b>${escapeHtml(emp.firstName + ' ' + emp.lastName)}</b> moved to Recycle Bin`);
    this.save();
  },
  getEmployee(id) { return this.load().employees.find(e => e.id === id && !e.deletedAt); },
  getEmployees() { return this.load().employees.filter(e => !e.deletedAt); },

  // ---------- Recycle Bin ----------
  getDeletedEmployees() { return this.load().employees.filter(e => e.deletedAt); },
  getEmployeeIncludingDeleted(id) { return this.load().employees.find(e => e.id === id); },
  restoreDeletedEmployee(id) {
    const d = this.load();
    const emp = d.employees.find(e => e.id === id);
    if (!emp) return;
    delete emp.deletedAt;
    this.logTimeline(id, 'Restored from Recycle Bin');
    this.log(`Employee <b>${escapeHtml(emp.firstName + ' ' + emp.lastName)}</b> restored from Recycle Bin`);
    this.save();
  },
  purgeDeletedEmployee(id) {
    const d = this.load();
    d.employees = d.employees.filter(e => e.id !== id);
    delete d.leaveBalances[id];
    delete d.salaryStructures[id];
    this.save();
  },
  purgeAllDeletedEmployees() {
    const d = this.load();
    const ids = d.employees.filter(e => e.deletedAt).map(e => e.id);
    d.employees = d.employees.filter(e => !e.deletedAt);
    ids.forEach(id => { delete d.leaveBalances[id]; delete d.salaryStructures[id]; });
    this.save();
    return ids.length;
  },

  // ---------- Attendance ----------
  markAttendance(month, empId, day, code) {
    const d = this.load();
    if (!d.attendance[month]) d.attendance[month] = {};
    if (!d.attendance[month][empId]) d.attendance[month][empId] = {};
    d.attendance[month][empId][pad(day)] = code;
    this.save();
  },
  getAttendance(month, empId) {
    const d = this.load();
    return (d.attendance[month] && d.attendance[month][empId]) || {};
  },
  getMonthAttendance(month) {
    const d = this.load();
    return d.attendance[month] || {};
  },

  // ---------- Shifts ----------
  setShift(empId, shift) {
    const d = this.load();
    d.shifts[empId] = shift;
    this.save();
  },
  getShift(empId) {
    return this.load().shifts[empId] || { shiftName: 'General', start: '09:30', end: '18:30' };
  },

  // ---------- Check-in / Check-out Time Log ----------
  setAttendanceTime(month, empId, day, times) {
    const d = this.load();
    if (!d.attendanceTimes[month]) d.attendanceTimes[month] = {};
    if (!d.attendanceTimes[month][empId]) d.attendanceTimes[month][empId] = {};
    d.attendanceTimes[month][empId][pad(day)] = times;
    this.save();
  },
  getAttendanceTime(month, empId, day) {
    const d = this.load();
    return (d.attendanceTimes[month] && d.attendanceTimes[month][empId] && d.attendanceTimes[month][empId][pad(day)]) || { in: '', out: '' };
  },
  isLateArrival(empId, checkInTime) {
    if (!checkInTime) return false;
    const shift = this.getShift(empId);
    return checkInTime > shift.start;
  },

  // ---------- Attendance Regularization ----------
  requestRegularization(empId, date, requestedCode, reason) {
    const d = this.load();
    const reg = { id: uid('REG'), empId, date, requestedCode, reason, status: 'Pending', requestedOn: todayISO() };
    d.regularizations.push(reg);
    this.log(`Attendance regularization requested by <b>${escapeHtml((this.getEmployee(empId)||{}).firstName || empId)}</b> for ${fmtDate(date)}`);
    this.save();
    return reg;
  },
  decideRegularization(id, status) {
    const d = this.load();
    const reg = d.regularizations.find(r => r.id === id);
    if (!reg) return null;
    reg.status = status;
    reg.decidedOn = todayISO();
    if (status === 'Approved') {
      const month = reg.date.slice(0,7);
      const day = parseInt(reg.date.slice(8,10), 10);
      this.markAttendance(month, reg.empId, day, reg.requestedCode);
    }
    this.save();
    return reg;
  },
  getRegularizations() { return this.load().regularizations; },

  // ---------- Leave ----------
  addLeaveApplication(app) {
    const d = this.load();
    app.id = uid('LV');
    app.status = 'Pending';
    app.appliedOn = todayISO();
    d.leaveApplications.push(app);
    const emp = this.getEmployee(app.empId);
    this.log(`Leave application submitted by <b>${escapeHtml(emp ? emp.firstName + ' ' + emp.lastName : app.empId)}</b>`);
    this.save();
    return app;
  },
  updateLeaveStatus(id, status, approver) {
    const d = this.load();
    const app = d.leaveApplications.find(a => a.id === id);
    if (!app) return null;
    app.status = status;
    app.approvedBy = approver || 'HR Manager';
    app.decidedOn = todayISO();
    if (status === 'Approved') {
      const bal = d.leaveBalances[app.empId];
      if (bal && bal[app.leaveType] !== undefined) {
        bal[app.leaveType] = Math.max(0, bal[app.leaveType] - app.days);
      }
    }
    this.save();
    return app;
  },
  getLeaveApplications() { return this.load().leaveApplications; },
  getLeaveBalance(empId) { return this.load().leaveBalances[empId] || { CL:0, SL:0, EL:0, ML:0, PL:0, LOP:0 }; },

  // ---------- Documents ----------
  logDocument(type, empId, title) {
    const d = this.load();
    const doc = { id: uid('DOC'), type, empId, title, date: todayISO() };
    d.documents.push(doc);
    const emp = this.getEmployee(empId);
    this.log(`${escapeHtml(type)} generated for <b>${escapeHtml(emp ? emp.firstName + ' ' + emp.lastName : empId)}</b>`);
    this.save();
    return doc;
  },
  getDocuments() { return this.load().documents; },

  // ---------- Notices ----------
  addNotice(notice) {
    const d = this.load();
    notice.id = uid('NOT');
    notice.postedOn = todayISO();
    d.notices.unshift(notice);
    this.log(`Notice posted: <b>${escapeHtml(notice.title)}</b>`);
    this.save();
    return notice;
  },
  getNotices() { return this.load().notices; },
  deleteNotice(id) {
    const d = this.load();
    d.notices = d.notices.filter(n => n.id !== id);
    this.save();
  },

  // ---------- Sample Data Generator ----------
  generateSampleEmployees(count) {
    const d = this.load();
    const usedIds = new Set(d.employees.map(e => e.id));
    let counter = d.employees.length + 1;
    for (let i = 0; i < count; i++) {
      const gender = Math.random() > 0.5 ? 'Male' : 'Female';
      const fname = gender === 'Male' ? rand(FIRST_NAMES_M) : rand(FIRST_NAMES_F);
      const lname = rand(LAST_NAMES);
      const dept = rand(DEPARTMENTS);
      const desig = rand(DESIGNATIONS[dept]);
      const loc = rand(CITIES_KERALA);
      const joinYear = randInt(2019, 2026);
      const joinMonth = randInt(1, 12);
      const joinDay = randInt(1, 28);
      const dobYear = randInt(1975, 2003);
      let empId;
      do { empId = 'SKL' + pad(counter++, 4); } while (usedIds.has(empId));
      usedIds.add(empId);

      const emp = {
        id: empId,
        firstName: fname,
        lastName: lname,
        gender,
        dob: `${dobYear}-${pad(randInt(1,12))}-${pad(randInt(1,28))}`,
        fatherName: rand(FIRST_NAMES_M) + ' ' + lname,
        motherName: rand(FIRST_NAMES_F) + ' ' + lname,
        bloodGroup: rand(BLOOD_GROUPS),
        nationality: 'Indian',
        maritalStatus: rand(MARITAL_STATUS),
        email: `${fname.toLowerCase()}.${lname.toLowerCase()}${randInt(1,99)}@skelora-mail.com`,
        phone: '9' + randInt(100000000, 999999999),
        emergencyContact: '9' + randInt(100000000, 999999999),
        address: `${randInt(1,99)}, ${rand(['MG Road','Church Road','Temple Street','Market Road','Jn Road','Bypass Road'])}`,
        city: loc.city, district: loc.district, state: 'Kerala', pin: '68' + randInt(6000,6999).toString().slice(0,4),
        department: dept, designation: desig,
        joiningDate: `${joinYear}-${pad(joinMonth)}-${pad(joinDay)}`,
        salary: randInt(15, 65) * 1000,
        employmentType: rand(EMPLOYMENT_TYPES),
        reportingManager: rand(['Suresh Kumar','Priya Menon','Thomas Abraham','Deepa Nair']),
        bankName: rand(['SBI','Federal Bank','South Indian Bank','HDFC Bank','ICICI Bank']),
        accountNumber: String(randInt(100000000000, 999999999999)),
        ifsc: rand(['SBIN0001234','FDRL0001987','SIBL0000456','HDFC0002345']),
        aadhaar: `${randInt(1000,9999)} ${randInt(1000,9999)} ${randInt(1000,9999)}`,
        pan: `${rand(['ABCDE','FGHIJ','KLMNO','PQRST'])}${randInt(1000,9999)}${rand(['A','B','C','D'])}`,
        pfNumber: 'KR/KTM/' + randInt(10000,99999),
        esiNumber: randInt(1000000000, 9999999999).toString(),
        education: rand(['B.Com, Annamalai University','BBA, Mahatma Gandhi University','B.A., Kerala University','Diploma in Office Management','M.Com, MG University','Plus Two, State Board']),
        experience: `${randInt(0,8)} years prior experience`,
        skills: rand(['MS Office, Tally','Communication, Typing','Tally, GST Filing','MS Excel, Data Entry','Customer Handling, CRM']),
        status: Math.random() > 0.1 ? 'Active' : 'Inactive',
        photo: null,
        createdAt: todayISO()
      };
      d.employees.push(emp);
      d.leaveBalances[emp.id] = { CL: randInt(4,12), SL: randInt(4,12), EL: randInt(6,15), ML: gender==='Female'?182:0, PL: gender==='Male'?15:0, LOP: randInt(0,2) };
    }
    this.log(`<b>${count}</b> sample employees generated`);
    this.save();
    return count;
  },

  generateSampleAttendance(month) {
    const d = this.load();
    if (!d.attendance[month]) d.attendance[month] = {};
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const codes = ['P','P','P','P','P','P','P','A','L','OD','WFH','HD'];
    d.employees.forEach(emp => {
      if (!d.attendance[month][emp.id]) d.attendance[month][emp.id] = {};
      for (let day = 1; day <= daysInMonth; day++) {
        const dow = new Date(y, m-1, day).getDay();
        if (dow === 0) { d.attendance[month][emp.id][pad(day)] = 'H'; continue; } // Sunday holiday
        const holiday = HOLIDAYS_2026.find(h => h.date === `${y}-${pad(m)}-${pad(day)}`);
        if (holiday) { d.attendance[month][emp.id][pad(day)] = 'H'; continue; }
        if (new Date(y, m-1, day) > new Date()) continue; // don't mark future days
        d.attendance[month][emp.id][pad(day)] = rand(codes);
      }
    });
    this.log(`Sample attendance generated for ${month}`);
    this.save();
  },

  generateSampleLeaves(count) {
    const d = this.load();
    if (d.employees.length === 0) return 0;
    const types = ['CL','SL','EL'];
    const reasons = ['Personal work','Family function','Medical treatment','Fever and cold','Travel to hometown','Household emergency','Wedding in family'];
    for (let i = 0; i < count; i++) {
      const emp = rand(d.employees);
      const fromOffset = randInt(-40, 15);
      const from = new Date(); from.setDate(from.getDate() + fromOffset);
      const days = randInt(1,4);
      const to = new Date(from); to.setDate(to.getDate() + days - 1);
      const app = {
        id: uid('LV'), empId: emp.id, leaveType: rand(types),
        from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10), days,
        reason: rand(reasons), appliedOn: todayISO(),
        status: rand(['Pending','Approved','Approved','Rejected'])
      };
      if (app.status !== 'Pending') { app.approvedBy = 'HR Manager'; app.decidedOn = todayISO(); }
      d.leaveApplications.push(app);
    }
    this.log(`${count} sample leave applications generated`);
    this.save();
    return count;
  },

  wipeAllData() {
    localStorage.removeItem(DB_KEY);
    this._data = null;
    this.load();
  },

  // ---------- Payroll ----------
  getSalaryStructure(empId) {
    const d = this.load();
    if (!d.salaryStructures[empId]) {
      const emp = this.getEmployee(empId);
      d.salaryStructures[empId] = defaultSalaryStructure(emp ? emp.salary : 20000);
    }
    return d.salaryStructures[empId];
  },
  setSalaryStructure(empId, structure) {
    const d = this.load();
    d.salaryStructures[empId] = structure;
    this.logTimeline(empId, 'Salary structure updated');
    this.save();
  },
  computePayslip(empId, month) {
    const s = this.getSalaryStructure(empId);
    const gross = s.basic + s.hra + s.conveyance + s.medical + s.special;
    const deductions = s.pf + s.esi + s.pt + (s.otherDeduction || 0);
    const daysInMonth = daysInMonthOf(month);
    const monthData = this.getMonthAttendance(month)[empId] || {};
    const workingDays = Array.from({length:daysInMonth},(_,i)=>i+1).filter(d => {
      const [y,m] = month.split('-').map(Number);
      return new Date(y,m-1,d).getDay() !== 0;
    }).length;
    let lopDays = 0;
    Object.values(monthData).forEach(c => { if (c === 'A') lopDays++; });
    const perDayGross = workingDays ? gross / workingDays : gross;
    const lopDeduction = Math.round(perDayGross * lopDays);
    const netPay = Math.max(0, gross - deductions - lopDeduction);
    return { empId, month, ...s, gross, deductions, lopDays, lopDeduction, netPay, workingDays };
  },
  runPayroll(month) {
    const d = this.load();
    const payslips = d.employees.filter(e => e.status === 'Active').map(e => this.computePayslip(e.id, month));
    const run = { id: uid('PAY'), month, generatedOn: todayISO(), payslips };
    d.payrollRuns = d.payrollRuns.filter(r => r.month !== month);
    d.payrollRuns.push(run);
    this.log(`Payroll run generated for <b>${month}</b> — ${payslips.length} payslips`);
    payslips.forEach(p => this.logTimeline(p.empId, `Payslip generated for ${month} — Net Pay ₹${p.netPay.toLocaleString('en-IN')}`));
    this.save();
    return run;
  },
  getPayrollRun(month) { return this.load().payrollRuns.find(r => r.month === month); },
  getPayrollRuns() { return this.load().payrollRuns; },

  // ---------- Assets ----------
  addAsset(asset) {
    const d = this.load();
    asset.id = uid('AST');
    asset.status = 'Available';
    asset.assignedTo = null;
    d.assets.push(asset);
    this.log(`Asset <b>${escapeHtml(asset.name)}</b> added to inventory`);
    this.save();
    return asset;
  },
  issueAsset(assetId, empId) {
    const d = this.load();
    const asset = d.assets.find(a => a.id === assetId);
    if (!asset) return null;
    asset.status = 'Issued';
    asset.assignedTo = empId;
    asset.issuedOn = todayISO();
    asset.returnedOn = null;
    const emp = this.getEmployee(empId);
    this.log(`Asset <b>${escapeHtml(asset.name)}</b> issued to <b>${escapeHtml(emp ? emp.firstName+' '+emp.lastName : empId)}</b>`);
    this.logTimeline(empId, `Issued asset: ${escapeHtml(asset.name)} (${asset.serialNo || 'no serial'})`);
    this.save();
    return asset;
  },
  returnAsset(assetId) {
    const d = this.load();
    const asset = d.assets.find(a => a.id === assetId);
    if (!asset) return null;
    const empId = asset.assignedTo;
    asset.status = 'Available';
    asset.returnedOn = todayISO();
    if (empId) this.logTimeline(empId, `Returned asset: ${escapeHtml(asset.name)}`);
    asset.assignedTo = null;
    this.save();
    return asset;
  },
  retireAsset(assetId) {
    const d = this.load();
    const asset = d.assets.find(a => a.id === assetId);
    if (!asset) return null;
    asset.status = 'Retired'; asset.assignedTo = null;
    this.save();
    return asset;
  },
  deleteAsset(assetId) {
    const d = this.load();
    d.assets = d.assets.filter(a => a.id !== assetId);
    this.save();
  },
  getAssets() { return this.load().assets; },

  // ---------- Recruitment ----------
  addRequisition(req) {
    const d = this.load();
    req.id = uid('REQ'); req.status = 'Open'; req.postedOn = todayISO();
    d.jobRequisitions.push(req);
    this.log(`Job requisition opened: <b>${escapeHtml(req.title)}</b>`);
    this.save();
    return req;
  },
  updateRequisitionStatus(id, status) {
    const d = this.load();
    const r = d.jobRequisitions.find(x => x.id === id);
    if (r) { r.status = status; this.save(); }
    return r;
  },
  deleteRequisition(id) {
    const d = this.load();
    d.jobRequisitions = d.jobRequisitions.filter(r => r.id !== id);
    d.candidates = d.candidates.filter(c => c.requisitionId !== id);
    this.save();
  },
  getRequisitions() { return this.load().jobRequisitions; },

  addCandidate(cand) {
    const d = this.load();
    cand.id = uid('CAND'); cand.stage = 'Applied'; cand.appliedOn = todayISO();
    d.candidates.push(cand);
    this.log(`New candidate <b>${escapeHtml(cand.name)}</b> applied`);
    this.save();
    return cand;
  },
  moveCandidateStage(id, stage) {
    const d = this.load();
    const c = d.candidates.find(x => x.id === id);
    if (c) { c.stage = stage; this.save(); }
    return c;
  },
  deleteCandidate(id) {
    const d = this.load();
    d.candidates = d.candidates.filter(c => c.id !== id);
    this.save();
  },
  getCandidates(requisitionId) {
    const d = this.load();
    return requisitionId ? d.candidates.filter(c => c.requisitionId === requisitionId) : d.candidates;
  },
  hireCandidate(candId) {
    const d = this.load();
    const c = d.candidates.find(x => x.id === candId);
    if (!c) return null;
    c.stage = 'Hired';
    const req = d.jobRequisitions.find(r => r.id === c.requisitionId);
    this.log(`Candidate <b>${escapeHtml(c.name)}</b> hired${req ? ' for '+escapeHtml(req.title) : ''}`);
    this.save();
    return c;
  },

  // ---------- Performance / Appraisals ----------
  addAppraisalCycle(cycle) {
    const d = this.load();
    cycle.id = uid('CYC'); cycle.status = 'Open'; cycle.createdOn = todayISO();
    d.appraisalCycles.push(cycle);
    this.log(`Appraisal cycle created: <b>${escapeHtml(cycle.name)}</b>`);
    this.save();
    return cycle;
  },
  closeCycle(id) {
    const d = this.load();
    const c = d.appraisalCycles.find(x => x.id === id);
    if (c) { c.status = 'Closed'; this.save(); }
  },
  getCycles() { return this.load().appraisalCycles; },
  getAppraisal(cycleId, empId) { return this.load().appraisals.find(a => a.cycleId === cycleId && a.empId === empId); },
  saveAppraisal(appraisal) {
    const d = this.load();
    const idx = d.appraisals.findIndex(a => a.cycleId === appraisal.cycleId && a.empId === appraisal.empId);
    appraisal.id = appraisal.id || uid('APR');
    if (idx === -1) d.appraisals.push(appraisal); else d.appraisals[idx] = appraisal;
    if (appraisal.status === 'Finalized') this.logTimeline(appraisal.empId, `Appraisal finalized — Overall rating ${appraisal.overallRating}/5`);
    this.save();
    return appraisal;
  },
  getAppraisalsForCycle(cycleId) { return this.load().appraisals.filter(a => a.cycleId === cycleId); },

  // =========================================================
  // Exit Management (additive - does not alter any existing
  // employee/attendance/leave/payroll logic or fields)
  // =========================================================

  // ---------- Resignation Requests ----------
  addResignation(res) {
    const d = this.load();
    res.id = uid('RES');
    res.status = 'Pending';
    res.noticeStatus = 'Running';
    res.earlyReleaseApproved = false;
    res.createdAt = todayISO();
    d.resignations.push(res);
    const emp = this.getEmployee(res.empId);
    // Note: employee.status intentionally stays as-is (usually 'Active') through the resignation
    // process, since they're still a working, payable employee during notice. Only archiveEmployee()
    // below changes status to 'Former Employee' - this avoids breaking Payroll/Org Chart/any other
    // module that filters on status === 'Active'.
    this.log(`Resignation submitted for <b>${escapeHtml(emp ? emp.firstName+' '+emp.lastName : res.empId)}</b>`);
    this.logTimeline(res.empId, `Resignation submitted — last working day ${fmtDate(res.lastWorkingDay)}`);
    this.save();
    return res;
  },
  getResignations() { return this.load().resignations; },
  getResignation(id) { return this.load().resignations.find(r => r.id === id); },
  getActiveResignationForEmployee(empId) {
    // Most recent non-cancelled/non-rejected resignation for this employee
    return this.load().resignations.filter(r => r.empId === empId && !['Rejected','Cancelled'].includes(r.status)).sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0];
  },
  updateResignationStatus(id, status) {
    const d = this.load();
    const res = d.resignations.find(r => r.id === id);
    if (!res) return null;
    res.status = status;
    this.logTimeline(res.empId, `Resignation status changed to ${escapeHtml(status)}`);
    this.save();
    return res;
  },

  // ---------- Notice Period Tracker ----------
  computeNoticeProgress(res) {
    const start = new Date(res.resignationDate);
    const end = new Date(res.lastWorkingDay);
    const today = new Date();
    const totalDays = Math.max(1, Math.round((end - start) / 86400000));
    const daysCompleted = Math.min(totalDays, Math.max(0, Math.round((Math.min(today,end) - start) / 86400000)));
    const daysRemaining = Math.max(0, totalDays - daysCompleted);
    const pct = Math.min(100, Math.round((daysCompleted / totalDays) * 100));
    return { totalDays, daysCompleted, daysRemaining, pct, isOverdue: today > end && res.noticeStatus === 'Running' };
  },
  extendNotice(id, newLastWorkingDay, remarks) {
    const res = this.getResignation(id);
    if (!res) return null;
    res.lastWorkingDay = newLastWorkingDay;
    res.hrRemarks = remarks || res.hrRemarks;
    this.logTimeline(res.empId, `Notice period extended to ${fmtDate(newLastWorkingDay)}`);
    this.save();
    return res;
  },
  reduceNotice(id, newLastWorkingDay, remarks) {
    const res = this.getResignation(id);
    if (!res) return null;
    res.lastWorkingDay = newLastWorkingDay;
    res.managerRemarks = remarks || res.managerRemarks;
    this.logTimeline(res.empId, `Notice period reduced to ${fmtDate(newLastWorkingDay)}`);
    this.save();
    return res;
  },
  releaseEarly(id, remarks) {
    const res = this.getResignation(id);
    if (!res) return null;
    res.noticeStatus = 'Released';
    res.earlyReleaseApproved = true;
    res.lastWorkingDay = todayISO();
    res.hrRemarks = remarks || res.hrRemarks;
    this.logTimeline(res.empId, 'Early release approved — notice period ended today');
    this.save();
    return res;
  },
  markNoticeCompleted(id) {
    const res = this.getResignation(id);
    if (!res) return null;
    res.noticeStatus = 'Completed';
    this.logTimeline(res.empId, 'Notice period completed');
    this.save();
    return res;
  },

  // ---------- Exit Checklist ----------
  getExitChecklist(resignationId) {
    const d = this.load();
    if (!d.exitChecklists[resignationId]) {
      d.exitChecklists[resignationId] = EXIT_CHECKLIST_TEMPLATE.map(t => ({ ...t, status: 'Pending', remarks: '' }));
    }
    return d.exitChecklists[resignationId];
  },
  updateChecklistItem(resignationId, key, patch) {
    const list = this.getExitChecklist(resignationId);
    const item = list.find(i => i.key === key);
    if (item) Object.assign(item, patch);
    this.save();
    return item;
  },
  checklistProgress(resignationId) {
    const list = this.getExitChecklist(resignationId);
    const done = list.filter(i => i.status === 'Returned' || i.status === 'Damaged' || i.status === 'Lost').length;
    return { total: list.length, done, pct: Math.round(done / list.length * 100) };
  },

  // ---------- Department Clearance ----------
  getClearance(resignationId) {
    const d = this.load();
    if (!d.departmentClearances[resignationId]) {
      const obj = {};
      CLEARANCE_DEPARTMENTS.forEach(dept => { obj[dept] = { status: 'Pending', comments: '', completionDate: null, responsible: '' }; });
      d.departmentClearances[resignationId] = obj;
    }
    return d.departmentClearances[resignationId];
  },
  updateClearance(resignationId, dept, patch) {
    const clearance = this.getClearance(resignationId);
    if (!clearance[dept]) return null;
    Object.assign(clearance[dept], patch);
    if (patch.status === 'Approved') clearance[dept].completionDate = todayISO();
    this.save();
    return clearance[dept];
  },
  clearanceProgress(resignationId) {
    const clearance = this.getClearance(resignationId);
    const depts = Object.values(clearance);
    const approved = depts.filter(c => c.status === 'Approved').length;
    return { total: depts.length, approved, pct: Math.round(approved / depts.length * 100), allApproved: approved === depts.length };
  },

  // ---------- Final Settlement ----------
  computeSettlementDefaults(resignationId) {
    const res = this.getResignation(resignationId);
    if (!res) return null;
    const emp = this.getEmployee(res.empId);
    const salary = this.getSalaryStructure(res.empId);
    const bal = this.getLeaveBalance(res.empId);
    const dailyGross = (salary.basic + salary.hra + salary.conveyance + salary.medical + salary.special) / 30;
    const leaveEncashment = Math.round(dailyGross * ((bal.EL||0) + (bal.CL||0)));
    return {
      pendingSalary: Math.round(dailyGross * 15), leaveEncashment, bonus: 0, incentives: 0, commission: 0, overtime: 0,
      recoveries: 0, assetDamage: 0, advanceSalary: 0, loans: 0, tax: 0, otherDeductions: 0,
      status: 'Pending', paidDate: null, paymentMethod: 'Bank Transfer'
    };
  },
  getSettlement(resignationId) {
    const d = this.load();
    if (!d.finalSettlements[resignationId]) {
      d.finalSettlements[resignationId] = this.computeSettlementDefaults(resignationId);
    }
    return d.finalSettlements[resignationId];
  },
  saveSettlement(resignationId, patch) {
    const d = this.load();
    d.finalSettlements[resignationId] = { ...this.getSettlement(resignationId), ...patch };
    this.save();
    return d.finalSettlements[resignationId];
  },
  settlementTotals(resignationId) {
    const s = this.getSettlement(resignationId);
    const gross = s.pendingSalary + s.leaveEncashment + s.bonus + s.incentives + s.commission + s.overtime;
    const deductions = s.recoveries + s.assetDamage + s.advanceSalary + s.loans + s.tax + s.otherDeductions;
    return { gross, deductions, net: Math.max(0, gross - deductions) };
  },
  markSettlementPaid(resignationId, method) {
    const res = this.getResignation(resignationId);
    const clearance = this.clearanceProgress(resignationId);
    if (!clearance.allApproved) return { ok: false, error: 'All department clearances must be approved before settlement can be paid.' };
    const d = this.load();
    d.finalSettlements[resignationId] = { ...this.getSettlement(resignationId), status: 'Paid', paidDate: todayISO(), paymentMethod: method };
    this.logTimeline(res.empId, 'Final settlement paid');
    this.save();
    return { ok: true };
  },

  // ---------- Exit Interview ----------
  getExitInterview(resignationId) { return this.load().exitInterviews[resignationId] || null; },
  saveExitInterview(resignationId, data) {
    const d = this.load();
    const res = this.getResignation(resignationId);
    data.conductedOn = todayISO();
    d.exitInterviews[resignationId] = data;
    if (res) this.logTimeline(res.empId, 'Exit interview completed');
    this.save();
    return data;
  },

  // ---------- Archive / Former Employees (with Feature 17 validation) ----------
  canArchiveEmployee(resignationId) {
    const res = this.getResignation(resignationId);
    if (!res) return { ok: false, error: 'Resignation record not found.' };
    if (res.noticeStatus !== 'Completed' && res.noticeStatus !== 'Released') {
      return { ok: false, error: 'Notice period must be Completed or an Early Release approved before archiving.' };
    }
    const clearance = this.clearanceProgress(resignationId);
    if (!clearance.allApproved) return { ok: false, error: 'All department clearances must be approved before archiving.' };
    const docs = this.getDocuments().filter(dd => dd.empId === res.empId);
    if (!docs.some(dd => dd.type === 'Relieving Letter')) return { ok: false, error: 'Relieving Letter must be generated before archiving.' };
    if (!docs.some(dd => dd.type === 'Experience Certificate')) return { ok: false, error: 'Experience Certificate must be generated before archiving.' };
    const settlement = this.getSettlement(resignationId);
    if (settlement.status !== 'Paid') return { ok: false, error: 'Final settlement must be marked Paid before archiving.' };
    return { ok: true };
  },
  archiveEmployee(resignationId) {
    const check = this.canArchiveEmployee(resignationId);
    if (!check.ok) return check;
    const res = this.getResignation(resignationId);
    this.updateEmployee(res.empId, { status: 'Former Employee' });
    this.logTimeline(res.empId, 'Employee archived to Former Employees');
    this.log(`Employee <b>${escapeHtml((this.getEmployee(res.empId)||{}).firstName || res.empId)}</b> archived as a Former Employee`);
    this.save();
    return { ok: true };
  },
  restoreFormerEmployee(empId) {
    this.updateEmployee(empId, { status: 'Active' });
    this.logTimeline(empId, 'Restored from Former Employees (rehired)');
    this.save();
  },
  getFormerEmployees() { return this.load().employees.filter(e => e.status === 'Former Employee' && !e.deletedAt); },

  // ---------- Student context switching (called by Auth) ----------
  setStudent(studentId) {
    DB_KEY = 'oats_db_v1__' + studentId;
    this._data = null;
    this.load();
  }
};
