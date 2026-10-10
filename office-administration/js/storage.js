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
// Exit-checklist item -> Asset Register category (used to keep both lists in sync)
const EXIT_ASSET_CATEGORY_MAP = {
  laptop: ['Laptop', 'Desktop'], monitor: ['Monitor'], id_card: ['ID Badge'],
  access_card: ['Access Card'], sim_card: ['SIM Card'], company_phone: ['Mobile Phone']
};
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
const HOLIDAYS_2027 = [
  {date:'2027-01-01', name:"New Year's Day"}, {date:'2027-01-14', name:'Makar Sankranti'},
  {date:'2027-01-26', name:'Republic Day'}, {date:'2027-03-10', name:'Eid-ul-Fitr'},
  {date:'2027-04-15', name:'Vishu'}, {date:'2027-05-01', name:'May Day'},
  {date:'2027-08-15', name:'Independence Day'}, {date:'2027-09-12', name:'Onam'},
  {date:'2027-10-02', name:'Gandhi Jayanti'}, {date:'2027-10-29', name:'Deepavali'},
  {date:'2027-12-25', name:'Christmas'}
];
const HOLIDAYS_ALL = HOLIDAYS_2026.concat(HOLIDAYS_2027);

function pad(n, len=2) { return String(n).padStart(len, '0'); }
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function uid(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random()*9000+1000); }
/* Local-date helpers — toISOString() is UTC and gives yesterday's date for IST mornings. */
function isoLocal(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayISO() { return isoLocal(new Date()); }
function isHolidayISO(iso) { return HOLIDAYS_ALL.some(h => h.date === iso); }
function isWorkingDay(y, m, d) { return new Date(y, m - 1, d).getDay() !== 0 && !isHolidayISO(y + '-' + pad(m) + '-' + pad(d)); }
/* Working dates (excl. Sundays & holidays) between two ISO dates, inclusive */
function leaveWorkingDates(fromISO, toISO) {
  const out = [], a = new Date(fromISO + 'T00:00:00'), b = new Date(toISO + 'T00:00:00');
  if (isNaN(a) || isNaN(b) || b < a) return out;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) { const iso = isoLocal(d); if (d.getDay() !== 0 && !isHolidayISO(iso)) out.push(iso); }
  return out;
}
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

/* Sequential, human-readable Employee IDs (ASG-EMP-0001, 0002 ...). Older random IDs keep working. */
function nextEmployeeId() {
  let max = 0;
  try {
    const all = (Store.load().employees || []);
    all.forEach(e => { const m = /^(?:ASG-EMP-|SKL)(\d+)$/.exec(e.id || ''); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  } catch (e) {}
  return 'ASG-EMP-' + String(max + 1).padStart(4, '0');
}

/* Standard Indian-style CTC breakup from a monthly gross figure */
function defaultSalaryStructure(monthlyGross, gender) {
  const gross = Number(monthlyGross) || 20000;
  const basic = Math.round(gross * 0.45);
  const da = Math.round(basic * 0.10);
  const hra = Math.round(basic * 0.40);
  const conveyance = 1600;
  const medical = 1250;
  const special = Math.max(0, gross - basic - da - hra - conveyance - medical);
  const fullGross = basic + da + hra + conveyance + medical + special;
  const stat = calcStatutoryDeductions(basic, da, fullGross, gender, todayISO().slice(0,7));
  return { basic, da, hra, conveyance, medical, special, pf: stat.pf, esi: stat.esi, pt: stat.pt, otherDeduction: 0 };
}

/* Real Indian statutory formulas (verified 2026):
   - EPF: 12% of (Basic + DA), mandatory wage ceiling ₹15,000/month → max ₹1,800.
   - ESI: 0.75% of Gross, only if Gross ≤ ₹21,000/month; otherwise not applicable.
   - Professional Tax (Maharashtra slabs, gender-based): men ≤₹7,500 nil, ₹7,501–10,000 ₹175,
     above ₹10,000 ₹200 (₹300 in February to reach the ₹2,500/year cap);
     women ≤₹25,000 nil, above ₹25,000 ₹200 (₹300 in February). */
function calcStatutoryDeductions(basic, da, gross, gender, monthStr) {
  const pf = Math.round(0.12 * Math.min((Number(basic)||0) + (Number(da)||0), 15000));
  const esi = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
  const isFeb = monthStr && monthStr.split('-')[1] === '02';
  let pt = 0;
  if (gender === 'Female') {
    if (gross > 25000) pt = isFeb ? 300 : 200;
  } else {
    if (gross > 10000) pt = isFeb ? 300 : 200;
    else if (gross > 7500) pt = 175;
  }
  return { pf, esi, pt };
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
      exitInterviews: {},      // { resignationId: { whyLeaving,enjoyed,improve,recommend,rejoin,ratings:{...},suggestions,overallRating,conductedOn } }

      // ---- General Office Skills: Correspondence & Drafting (additive) ----
      correspondence: [],      // { id, type, exerciseId, title, to, from, subject, date, body, status: Draft|Finalized, createdOn }

      // ---- General Office Skills: Mail & Dispatch Register (additive) ----
      inwardMail: [],   // { id, refNo, date, from, mode, subject, addressedTo, receivedBy, remarks, action }
      outwardMail: [],  // { id, refNo, date, to, mode, subject, dispatchedBy, trackingNo, remarks }

      // ---- General Office Skills: Front Office & Reception (additive) ----
      visitors: [],      // { id, name, company, purpose, whomToMeet, date, timeIn, timeOut, badgeNo }
      appointments: [],  // { id, visitorName, purpose, withEmpId, date, time, status: Scheduled|Completed|Cancelled }
      callLog: [],        // { id, direction: Incoming|Outgoing, party, forEmpId, date, time, message, callBack }

      // ---- General Office Skills: Meetings & Minutes (additive) ----
      meetings: [],       // { id, title, date, time, venue, attendeeIds:[], agenda:[], status: Scheduled|Completed, minutes: { discussion, actionItems:[{task,ownerId,dueDate,status}] } }

      // ---- General Office Skills: Office Work Requests (replaces the old standalone Excel lab) ----
      excelAttempts: {},  // legacy (kept so old saved data still loads) - no longer used
      workRequests: { params: {}, attempts: {} }, // params: frozen per-student picks; attempts: { reqId: { tries, last, correct, revealed, at } }

      // ---- General Office Skills: Bulk Mailing assignments (mail merge) ----
      bulkMailings: {},   // { assignmentId: { stage, answers, selection, template, generatedOn, dispatchedOn, completedOn } }

      // ---- General Office Skills: Procurement & Petty Cash (additive) ----
      requisitions: [],   // { id, refNo, item, quantity, department, requestedBy, date, status, quotations:[{vendor,amount,deliveryDays}], selectedVendor, poNumber, poDate }
      pettyCash: { openingBalance: 5000, vouchers: [] }, // vouchers: { id, date, particulars, type: Receipt|Payment, amount, balance, approvedBy }

      // ---- General Office Skills: Stationery & Inventory Stock Register (additive) ----
      stockItems: [],        // { id, name, category, unit, reorderLevel, currentStock }
      stockTransactions: [], // { id, itemId, type: 'Stock In'|'Stock Out', quantity, date, issuedTo, remarks }

      // ---- General Office Skills: Travel & Expense (TA/DA) Claims (additive) ----
      travelRequests: [],  // { id, empId, purpose, fromCity, toCity, fromDate, toDate, mode, advanceRequested, status }
      expenseClaims: [],   // { id, travelId, empId, items:[{category,amount,billNo}], totalClaimed, advanceAdjusted, netPayable, status, date }

      // ---- General Office Skills: Facility & Meeting Room Booking (additive) ----
      facilityRooms: [
        { id: 'RM-A', name: 'Conference Room A', capacity: 12 },
        { id: 'RM-B', name: 'Conference Room B', capacity: 6 },
        { id: 'RM-C', name: 'Training Hall', capacity: 30 }
      ],
      roomBookings: [],   // { id, roomId, title, date, startTime, endTime, bookedBy }

      // ---- General Office Skills: Vendor & Compliance Renewal Tracker (additive) ----
      vendors: [],        // { id, name, category, contactPerson, phone, contractStart, contractEnd }

      // ---- General Office Skills: Grievance / Complaint Register (additive) ----
      grievances: [],     // { id, empId, category, description, dateFiled, assignedTo, status, resolutionNotes, resolvedDate }

      // ---- General Office Skills: Facility Maintenance Ticket Log (additive) ----
      maintenanceTickets: [], // { id, ticketNo, category, description, location, reportedBy, priority, assignedTo, status, dateReported, dateResolved, resolutionNotes }

      // ---- General Office Skills: Executive Calendar / Diary Management (additive) ----
      diaryEntries: [],   // { id, ownerId, title, date, startTime, endTime, type, notes, status }

      // ---- General Office Skills: Inbox Management (additive) ----
      inboxAttempts: {},  // { emailId: { action, replyText, correct, at } }

      // ---- General Office Skills: Data Entry Practice (additive) ----
      dataEntryAttempts: [], // { id, passageId, wpm, accuracy, date }

      // ---- General Office Skills: Filing System Simulator (additive) ----
      filingAttempts: {}, // { docId: { folder, retention, correct } }

      // ---- General Office Skills: Day Planner / Interruption Simulator (additive) ----
      dayPlannerAttempts: {} // { eventId: { quadrant, correct } }
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
    emp.id = emp.id || nextEmployeeId();
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
  decideRegularization(id, status, remark) {
    const d = this.load();
    const reg = d.regularizations.find(r => r.id === id);
    if (!reg) return null;
    reg.status = status;
    reg.decidedOn = todayISO();
    if (status === 'Rejected' && remark) reg.rejectionReason = remark;
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
  /* Approving a leave: deduct balance once + mark attendance (L) on working days. Reverting undoes both. */
  _leaveApply(d, app) {
    if (app.effectsApplied) return;
    const bal = d.leaveBalances[app.empId];
    if (bal && bal[app.leaveType] !== undefined) bal[app.leaveType] = Math.max(0, bal[app.leaveType] - app.days);
    const code = app.leaveType === 'LOP' ? 'A' : 'L';
    app.attMarked = [];
    leaveWorkingDates(app.from, app.to).forEach(iso => {
      const mo = iso.slice(0, 7), dd = iso.slice(8, 10);
      if (!d.attendance[mo]) d.attendance[mo] = {};
      if (!d.attendance[mo][app.empId]) d.attendance[mo][app.empId] = {};
      app.attMarked.push({ date: iso, prev: d.attendance[mo][app.empId][dd] || '' });
      d.attendance[mo][app.empId][dd] = code;
    });
    app.effectsApplied = true;
  },
  _leaveRevert(d, app) {
    if (!app.effectsApplied) return;
    const bal = d.leaveBalances[app.empId];
    if (bal && bal[app.leaveType] !== undefined) bal[app.leaveType] += app.days;
    const code = app.leaveType === 'LOP' ? 'A' : 'L';
    (app.attMarked || []).forEach(m => {
      const mo = m.date.slice(0, 7), dd = m.date.slice(8, 10), rec = d.attendance[mo] && d.attendance[mo][app.empId];
      if (rec && rec[dd] === code) { if (m.prev) rec[dd] = m.prev; else delete rec[dd]; }
    });
    app.attMarked = []; app.effectsApplied = false;
  },
  updateLeaveStatus(id, status, approver, reason) {
    const d = this.load();
    const app = d.leaveApplications.find(a => a.id === id);
    if (!app) return null;
    if (status === 'Approved' && !app.effectsApplied) {
      const bal = d.leaveBalances[app.empId];
      if (bal && bal[app.leaveType] !== undefined && app.leaveType !== 'LOP' && bal[app.leaveType] < app.days)
        return { error: `Insufficient ${app.leaveType} balance — only ${bal[app.leaveType]} day(s) available, ${app.days} requested.` };
    }
    app.status = status;
    app.approvedBy = approver || 'HR Manager';
    app.decidedOn = todayISO();
    if (status === 'Rejected') app.rejectionReason = reason || '';
    else delete app.rejectionReason;
    if (status === 'Approved') this._leaveApply(d, app); else this._leaveRevert(d, app);
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

  // ---------- Correspondence & Drafting ----------
  addCorrespondence(item) {
    const d = this.load();
    item.id = uid('CORR');
    item.createdOn = todayISO();
    item.status = item.status || 'Draft';
    d.correspondence.unshift(item);
    this.log(`${escapeHtml(item.type)} "<b>${escapeHtml(item.title)}</b>" ${item.status === 'Finalized' ? 'finalized' : 'drafted'}`);
    this.save();
    return item;
  },
  updateCorrespondence(id, patch) {
    const d = this.load();
    const idx = d.correspondence.findIndex(c => c.id === id);
    if (idx === -1) return null;
    d.correspondence[idx] = { ...d.correspondence[idx], ...patch };
    if (patch.status === 'Finalized') this.log(`${escapeHtml(d.correspondence[idx].type)} "<b>${escapeHtml(d.correspondence[idx].title)}</b>" finalized`);
    this.save();
    return d.correspondence[idx];
  },
  deleteCorrespondence(id) {
    const d = this.load();
    d.correspondence = d.correspondence.filter(c => c.id !== id);
    this.save();
  },
  getCorrespondence() { return this.load().correspondence; },
  getCorrespondenceItem(id) { return this.load().correspondence.find(c => c.id === id); },

  // ---------- Mail & Dispatch Register ----------
  addInwardMail(item) {
    const d = this.load();
    item.id = uid('DAKI');
    item.refNo = item.refNo || `INW/${new Date().getFullYear()}/${String(d.inwardMail.length + 1).padStart(4, '0')}`;
    item.action = item.action || 'Pending';
    d.inwardMail.unshift(item);
    this.log(`Inward mail logged: <b>${escapeHtml(item.subject)}</b> from ${escapeHtml(item.from)}`);
    this.save();
    return item;
  },
  updateInwardMail(id, patch) {
    const d = this.load();
    const idx = d.inwardMail.findIndex(m => m.id === id);
    if (idx === -1) return null;
    d.inwardMail[idx] = { ...d.inwardMail[idx], ...patch };
    this.save();
    return d.inwardMail[idx];
  },
  deleteInwardMail(id) { const d = this.load(); d.inwardMail = d.inwardMail.filter(m => m.id !== id); this.save(); },
  getInwardMail() { return this.load().inwardMail; },

  addOutwardMail(item) {
    const d = this.load();
    item.id = uid('DAKO');
    item.refNo = item.refNo || `OUT/${new Date().getFullYear()}/${String(d.outwardMail.length + 1).padStart(4, '0')}`;
    d.outwardMail.unshift(item);
    this.log(`Outward mail dispatched: <b>${escapeHtml(item.subject)}</b> to ${escapeHtml(item.to)}`);
    this.save();
    return item;
  },
  deleteOutwardMail(id) { const d = this.load(); d.outwardMail = d.outwardMail.filter(m => m.id !== id); this.save(); },
  getOutwardMail() { return this.load().outwardMail; },

  // ---------- Front Office & Reception ----------
  addVisitor(v) {
    const d = this.load();
    v.id = uid('VIS');
    v.badgeNo = v.badgeNo || `V-${String(d.visitors.length + 1).padStart(3, '0')}`;
    d.visitors.unshift(v);
    this.log(`Visitor <b>${escapeHtml(v.name)}</b> checked in`);
    this.save();
    return v;
  },
  checkOutVisitor(id, time) {
    const d = this.load();
    const v = d.visitors.find(x => x.id === id);
    if (!v) return null;
    v.timeOut = time;
    this.save();
    return v;
  },
  deleteVisitor(id) { const d = this.load(); d.visitors = d.visitors.filter(v => v.id !== id); this.save(); },
  getVisitors() { return this.load().visitors; },

  addAppointment(a) {
    const d = this.load();
    a.id = uid('APT');
    a.status = a.status || 'Scheduled';
    d.appointments.unshift(a);
    this.log(`Appointment scheduled with <b>${escapeHtml(a.visitorName)}</b>`);
    this.save();
    return a;
  },
  updateAppointment(id, patch) {
    const d = this.load();
    const idx = d.appointments.findIndex(a => a.id === id);
    if (idx === -1) return null;
    d.appointments[idx] = { ...d.appointments[idx], ...patch };
    this.save();
    return d.appointments[idx];
  },
  deleteAppointment(id) { const d = this.load(); d.appointments = d.appointments.filter(a => a.id !== id); this.save(); },
  getAppointments() { return this.load().appointments; },

  addCallLog(c) {
    const d = this.load();
    c.id = uid('CALL');
    d.callLog.unshift(c);
    this.save();
    return c;
  },
  deleteCallLog(id) { const d = this.load(); d.callLog = d.callLog.filter(c => c.id !== id); this.save(); },
  getCallLog() { return this.load().callLog; },

  // ---------- Meetings & Minutes ----------
  addMeeting(m) {
    const d = this.load();
    m.id = uid('MTG');
    m.status = 'Scheduled';
    m.minutes = { discussion: '', actionItems: [] };
    d.meetings.unshift(m);
    this.log(`Meeting scheduled: <b>${escapeHtml(m.title)}</b>`);
    this.save();
    return m;
  },
  updateMeeting(id, patch) {
    const d = this.load();
    const idx = d.meetings.findIndex(m => m.id === id);
    if (idx === -1) return null;
    d.meetings[idx] = { ...d.meetings[idx], ...patch };
    if (patch.status === 'Completed') this.log(`Minutes finalized for <b>${escapeHtml(d.meetings[idx].title)}</b>`);
    this.save();
    return d.meetings[idx];
  },
  deleteMeeting(id) { const d = this.load(); d.meetings = d.meetings.filter(m => m.id !== id); this.save(); },
  getMeetings() { return this.load().meetings; },
  getMeeting(id) { return this.load().meetings.find(m => m.id === id); },

  // ---------- Office Work Requests ----------
  getWorkRequests() { const d = this.load(); if (!d.workRequests) d.workRequests = { params: {}, attempts: {} }; if (!d.workRequests.params) d.workRequests.params = {}; if (!d.workRequests.attempts) d.workRequests.attempts = {}; return d.workRequests; },
  saveWorkRequestParams(id, params) { this.getWorkRequests().params[id] = params; this.save(); },
  recordWorkAttempt(id, patch) {
    const w = this.getWorkRequests();
    const cur = w.attempts[id] || { tries: 0, correct: false, revealed: false };
    w.attempts[id] = { ...cur, ...patch, at: todayISO() };
    this.save();
    return w.attempts[id];
  },

  // ---------- Bulk Mailings ----------
  getBulkMailing(id) { const d = this.load(); if (!d.bulkMailings) d.bulkMailings = {}; return d.bulkMailings[id] || null; },
  saveBulkMailing(id, patch) { const d = this.load(); if (!d.bulkMailings) d.bulkMailings = {}; d.bulkMailings[id] = { ...(d.bulkMailings[id] || {}), ...patch }; this.save(); return d.bulkMailings[id]; },
  getBulkMailings() { const d = this.load(); if (!d.bulkMailings) d.bulkMailings = {}; return d.bulkMailings; },

  // ---------- Procurement & Petty Cash ----------
  addPurchaseRequisition(item) {
    const d = this.load();
    item.id = uid('REQ');
    item.refNo = `PR/${new Date().getFullYear()}/${String(d.requisitions.length + 1).padStart(4, '0')}`;
    item.status = 'Pending';
    item.quotations = [];
    d.requisitions.unshift(item);
    this.log(`Purchase requisition raised: <b>${escapeHtml(item.item)}</b>`);
    this.save();
    return item;
  },
  addQuotation(reqId, q) {
    const d = this.load();
    const r = d.requisitions.find(x => x.id === reqId);
    if (!r) return null;
    r.quotations.push(q);
    r.status = 'Quotations Added';
    this.save();
    return r;
  },
  raisePO(reqId, selectedVendor) {
    const d = this.load();
    const r = d.requisitions.find(x => x.id === reqId);
    if (!r) return null;
    r.selectedVendor = selectedVendor;
    r.poNumber = `PO/${new Date().getFullYear()}/${String(d.requisitions.filter(x=>x.poNumber).length + 1).padStart(4, '0')}`;
    r.poDate = todayISO();
    r.status = 'PO Raised';
    this.log(`Purchase order raised for <b>${escapeHtml(r.item)}</b> — vendor ${escapeHtml(selectedVendor)}`);
    this.save();
    return r;
  },
  deletePurchaseRequisition(id) { const d = this.load(); d.requisitions = d.requisitions.filter(r => r.id !== id); this.save(); },
  getPurchaseRequisitions() { return this.load().requisitions; },
  getPurchaseRequisition(id) { return this.load().requisitions.find(r => r.id === id); },

  getPettyCash() { return this.load().pettyCash; },
  addPettyCashVoucher(v) {
    const d = this.load();
    const bal = d.pettyCash.vouchers.length ? d.pettyCash.vouchers[d.pettyCash.vouchers.length-1].balance : d.pettyCash.openingBalance;
    v.id = uid('PCV');
    v.balance = v.type === 'Receipt' ? bal + Number(v.amount) : bal - Number(v.amount);
    d.pettyCash.vouchers.push(v);
    this.log(`Petty cash ${v.type.toLowerCase()}: <b>${escapeHtml(v.particulars)}</b> — ₹${v.amount}`);
    this.save();
    return v;
  },
  setPettyCashOpening(amount) { const d = this.load(); d.pettyCash.openingBalance = amount; this.save(); },
  deletePettyCashVoucher(id) {
    const d = this.load();
    d.pettyCash.vouchers = d.pettyCash.vouchers.filter(v => v.id !== id);
    let bal = d.pettyCash.openingBalance;
    d.pettyCash.vouchers.forEach(v => { bal = v.type === 'Receipt' ? bal + Number(v.amount) : bal - Number(v.amount); v.balance = bal; });
    this.save();
  },

  // ---------- Stationery & Inventory Stock Register ----------
  addStockItem(item) {
    const d = this.load();
    item.id = uid('ITM');
    item.currentStock = item.currentStock || 0;
    d.stockItems.push(item);
    this.save();
    return item;
  },
  deleteStockItem(id) { const d = this.load(); d.stockItems = d.stockItems.filter(i => i.id !== id); d.stockTransactions = d.stockTransactions.filter(t => t.itemId !== id); this.save(); },
  getStockItems() { return this.load().stockItems; },
  getStockItem(id) { return this.load().stockItems.find(i => i.id === id); },
  addStockTransaction(tx) {
    const d = this.load();
    tx.id = uid('STX');
    const item = d.stockItems.find(i => i.id === tx.itemId);
    if (item) item.currentStock += tx.type === 'Stock In' ? Number(tx.quantity) : -Number(tx.quantity);
    d.stockTransactions.unshift(tx);
    this.log(`${tx.type}: <b>${escapeHtml(item ? item.name : '')}</b> — ${tx.quantity} ${item ? item.unit : ''}`);
    this.save();
    return tx;
  },
  getStockTransactions() { return this.load().stockTransactions; },

  // ---------- Travel & Expense (TA/DA) Claims ----------
  addTravelRequest(t) {
    const d = this.load();
    t.id = uid('TRV');
    t.status = 'Pending';
    d.travelRequests.unshift(t);
    this.log(`Travel request submitted: <b>${escapeHtml(t.purpose)}</b>`);
    this.save();
    return t;
  },
  updateTravelRequest(id, patch) {
    const d = this.load();
    const t = d.travelRequests.find(x => x.id === id);
    if (!t) return null;
    Object.assign(t, patch);
    this.save();
    return t;
  },
  deleteTravelRequest(id) { const d = this.load(); d.travelRequests = d.travelRequests.filter(t => t.id !== id); this.save(); },
  getTravelRequests() { return this.load().travelRequests; },
  getTravelRequest(id) { return this.load().travelRequests.find(t => t.id === id); },

  addExpenseClaim(c) {
    const d = this.load();
    c.id = uid('EXP');
    c.status = 'Submitted';
    c.date = todayISO();
    d.expenseClaims.unshift(c);
    this.log(`Expense claim submitted — Net Payable ₹${c.netPayable}`);
    this.save();
    return c;
  },
  updateExpenseClaim(id, patch) {
    const d = this.load();
    const c = d.expenseClaims.find(x => x.id === id);
    if (!c) return null;
    Object.assign(c, patch);
    this.save();
    return c;
  },
  deleteExpenseClaim(id) { const d = this.load(); d.expenseClaims = d.expenseClaims.filter(c => c.id !== id); this.save(); },
  getExpenseClaims() { return this.load().expenseClaims; },

  // ---------- Facility & Meeting Room Booking ----------
  getFacilityRooms() { return this.load().facilityRooms; },
  bookingConflict(roomId, date, startTime, endTime, excludeId) {
    const d = this.load();
    return d.roomBookings.some(b => b.id !== excludeId && b.roomId === roomId && b.date === date &&
      startTime < b.endTime && endTime > b.startTime);
  },
  addRoomBooking(b) {
    const d = this.load();
    b.id = uid('BK');
    d.roomBookings.push(b);
    this.log(`Room booked: <b>${escapeHtml(b.title)}</b>`);
    this.save();
    return b;
  },
  deleteRoomBooking(id) { const d = this.load(); d.roomBookings = d.roomBookings.filter(b => b.id !== id); this.save(); },
  getRoomBookings() { return this.load().roomBookings; },

  // ---------- Vendor & Compliance Renewal Tracker ----------
  addVendor(v) {
    const d = this.load();
    v.id = uid('VND');
    d.vendors.push(v);
    this.save();
    return v;
  },
  updateVendor(id, patch) {
    const d = this.load();
    const v = d.vendors.find(x => x.id === id);
    if (!v) return null;
    Object.assign(v, patch);
    this.save();
    return v;
  },
  deleteVendor(id) { const d = this.load(); d.vendors = d.vendors.filter(v => v.id !== id); this.save(); },
  getVendors() { return this.load().vendors; },

  // ---------- Grievance / Complaint Register ----------
  addGrievance(g) {
    const d = this.load();
    g.id = uid('GRV');
    g.status = 'Open';
    d.grievances.unshift(g);
    this.log(`Grievance filed: <b>${escapeHtml(g.category)}</b>`);
    this.save();
    return g;
  },
  updateGrievance(id, patch) {
    const d = this.load();
    const g = d.grievances.find(x => x.id === id);
    if (!g) return null;
    Object.assign(g, patch);
    this.save();
    return g;
  },
  deleteGrievance(id) { const d = this.load(); d.grievances = d.grievances.filter(g => g.id !== id); this.save(); },
  getGrievances() { return this.load().grievances; },

  // ---------- Facility Maintenance Ticket Log ----------
  addMaintenanceTicket(t) {
    const d = this.load();
    t.id = uid('TKT');
    t.ticketNo = `TKT/${new Date().getFullYear()}/${String(d.maintenanceTickets.length + 1).padStart(4, '0')}`;
    t.status = t.status || 'Open';
    d.maintenanceTickets.unshift(t);
    this.log(`Maintenance ticket raised: <b>${escapeHtml(t.category)}</b> — ${escapeHtml(t.location)}`);
    this.save();
    return t;
  },
  updateMaintenanceTicket(id, patch) {
    const d = this.load();
    const t = d.maintenanceTickets.find(x => x.id === id);
    if (!t) return null;
    Object.assign(t, patch);
    if (patch.status === 'Resolved' || patch.status === 'Closed') t.dateResolved = todayISO();
    this.save();
    return t;
  },
  deleteMaintenanceTicket(id) { const d = this.load(); d.maintenanceTickets = d.maintenanceTickets.filter(t => t.id !== id); this.save(); },
  getMaintenanceTickets() { return this.load().maintenanceTickets; },

  // ---------- Executive Calendar / Diary Management ----------
  diaryConflict(ownerId, date, startTime, endTime, excludeId) {
    const d = this.load();
    return d.diaryEntries.some(e => e.id !== excludeId && e.ownerId === ownerId && e.date === date && e.status !== 'Cancelled' &&
      startTime < e.endTime && endTime > e.startTime);
  },
  addDiaryEntry(e) {
    const d = this.load();
    e.id = uid('DIARY');
    e.status = e.status || 'Scheduled';
    d.diaryEntries.push(e);
    this.save();
    return e;
  },
  updateDiaryEntry(id, patch) {
    const d = this.load();
    const e = d.diaryEntries.find(x => x.id === id);
    if (!e) return null;
    Object.assign(e, patch);
    this.save();
    return e;
  },
  deleteDiaryEntry(id) { const d = this.load(); d.diaryEntries = d.diaryEntries.filter(e => e.id !== id); this.save(); },
  getDiaryEntries(ownerId) { const all = this.load().diaryEntries; return ownerId ? all.filter(e => e.ownerId === ownerId) : all; },
  findFreeSlot(ownerId, date, durationMinutes) {
    const dayStart = '09:30', dayEnd = '18:30';
    const toMin = (t) => { const [h,m] = t.split(':').map(Number); return h*60+m; };
    const toTime = (m) => `${pad(Math.floor(m/60))}:${pad(m%60)}`;
    const busy = this.getDiaryEntries(ownerId).filter(e => e.date === date && e.status !== 'Cancelled')
      .map(e => [toMin(e.startTime), toMin(e.endTime)]).sort((a,b) => a[0]-b[0]);
    let cursor = toMin(dayStart);
    const end = toMin(dayEnd);
    for (const [s,e] of busy) {
      if (s - cursor >= durationMinutes) return { startTime: toTime(cursor), endTime: toTime(cursor+durationMinutes) };
      cursor = Math.max(cursor, e);
    }
    if (end - cursor >= durationMinutes) return { startTime: toTime(cursor), endTime: toTime(cursor+durationMinutes) };
    return null;
  },

  // ---------- Inbox Management (Email Triage) ----------
  getInboxAttempts() { return this.load().inboxAttempts; },
  recordInboxAction(emailId, action, replyText) {
    const email = INBOX_EMAILS.find(e => e.id === emailId);
    if (!email) return null;
    const correct = email.correctAction === action;
    const d = this.load();
    d.inboxAttempts[emailId] = { action, replyText: replyText || '', correct, at: todayISO() };
    this.log(`Inbox item actioned: <b>${escapeHtml(email.subject)}</b> — marked ${escapeHtml(action)}`);
    this.save();
    return d.inboxAttempts[emailId];
  },

  // ---------- Data Entry Practice ----------
  getDataEntryAttempts() { return this.load().dataEntryAttempts; },
  addDataEntryAttempt(a) {
    const d = this.load();
    a.id = uid('DE');
    a.date = todayISO();
    d.dataEntryAttempts.unshift(a);
    this.log(`Data entry practice completed: <b>${a.wpm} WPM, ${a.accuracy}% accuracy</b>`);
    this.save();
    return a;
  },

  // ---------- Filing System Simulator ----------
  getFilingAttempts() { return this.load().filingAttempts; },
  recordFiling(docId, folder, retention) {
    const doc = FILING_DOCUMENTS.find(x => x.id === docId);
    if (!doc) return null;
    const correct = doc.correctFolder === folder && doc.correctRetention === retention;
    const d = this.load();
    d.filingAttempts[docId] = { folder, retention, correct, at: todayISO() };
    this.save();
    return d.filingAttempts[docId];
  },

  // ---------- Day Planner (Interruption Simulator) ----------
  getDayPlannerAttempts() { return this.load().dayPlannerAttempts; },
  recordPlannerQuadrant(eventId, quadrant) {
    const ev = DAY_PLANNER_EVENTS.find(x => x.id === eventId);
    if (!ev) return null;
    const correct = ev.correctQuadrant === quadrant;
    const d = this.load();
    d.dayPlannerAttempts[eventId] = { quadrant, correct, at: todayISO() };
    this.save();
    return d.dayPlannerAttempts[eventId];
  },

  // ---------- Sample Data Generator ----------
  generateSampleEmployees(count) {
    const d = this.load();
    const usedIds = new Set(d.employees.map(e => e.id));
    let counter = parseInt(nextEmployeeId().slice(8), 10);
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
      do { empId = 'ASG-EMP-' + pad(counter++, 4); } while (usedIds.has(empId));
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
        phone: Math.random() < 0.04 ? '9' + randInt(10000000, 99999999) : '9' + randInt(100000000, 999999999), // a few short numbers = realistic data-entry slips
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
        pan: Math.random() < 0.08 ? '' : `${rand(['ABCDE','FGHIJ','KLMNO','PQRST'])}${randInt(1000,9999)}${rand(['A','B','C','D'])}`, // ~8% not yet collected
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

  generateSampleAttendance(month, allowFuture) {
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
        const holiday = HOLIDAYS_ALL.find(h => h.date === `${y}-${pad(m)}-${pad(day)}`);
        if (holiday) { d.attendance[month][emp.id][pad(day)] = 'H'; continue; }
        if (!allowFuture && new Date(y, m-1, day) > new Date()) continue; // seed data skips future days; Auto-fill button allows full month
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
      while (!isWorkingDay(from.getFullYear(), from.getMonth() + 1, from.getDate())) from.setDate(from.getDate() + 1);
      const to = new Date(from); to.setDate(to.getDate() + randInt(1,4) - 1);
      const days = leaveWorkingDates(isoLocal(from), isoLocal(to)).length;
      const app = {
        id: uid('LV'), empId: emp.id, leaveType: rand(types),
        from: isoLocal(from), to: isoLocal(to), days,
        reason: rand(reasons), appliedOn: todayISO(),
        status: rand(['Pending','Approved','Approved','Rejected'])
      };
      if (app.status !== 'Pending') { app.approvedBy = 'HR Manager'; app.decidedOn = todayISO(); }
      if (app.status === 'Approved') this._leaveApply(d, app);
      d.leaveApplications.push(app);
    }
    this.log(`${count} sample leave applications generated`);
    this.save();
    return count;
  },

  /* Populates every office register with realistic (and deliberately slightly imperfect) data so the
     Office Work Requests have genuine material to analyse — messy company names, a few duplicate mail
     entries, missing tracking numbers, etc., exactly the sort of thing a real register contains.
     Runs once per student account; never deletes or overwrites existing records. */
  generateSampleRegisters() {
    const d = this.load();
    if (d.meta.sampleRegisters) return false;
    const emps = d.employees.filter(e => !e.deletedAt);
    if (emps.length < 5) return false;
    const pool = emps.filter(e => e.status === 'Active').length >= 5 ? emps.filter(e => e.status === 'Active') : emps;
    const now = new Date();
    const isoOff = (n) => { const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`; };
    const addDays = (iso, n) => { const p = iso.split('-').map(Number); const x = new Date(p[0], p[1]-1, p[2] + n); return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`; };
    const nameOf = (e) => `${e.firstName} ${e.lastName}`;
    const hhmm = (m) => `${pad(Math.floor(m/60))}:${pad(m%60)}`;
    const yr = now.getFullYear();
    const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

    // --- Attendance + payroll for the latest attendance month (so payroll-based requests have data) ---
    let month = Object.keys(d.attendance).sort().pop();
    if (!month) { month = todayISO().slice(0,7); this.generateSampleAttendance(month); }
    // Payroll is never auto-run — it stays a deliberate action the student takes in the
    // Payroll unit itself. Modules that read payroll data (e.g. Office Work Requests,
    // Reports) already handle "no run yet" gracefully and simply show fewer/blank items
    // until the student runs it themselves.

    // --- Petty cash book: ~4 months of vouchers with a correct running balance ---
    if (d.pettyCash.vouchers.length < 10) {
      if (!d.pettyCash.vouchers.length) d.pettyCash.openingBalance = 10000;
      const PAY = ['Tea & refreshments for visitors','Courier charges - Blue Dart','Printer cartridge refill','Auto fare - bank visit','Stationery - files & folders','Drinking water can refill','Postage stamps','Xerox & lamination','Cleaning materials','Courier charges - DTDC','Tube light replacement','Local conveyance - document delivery','Tea & refreshments for meeting','Pantry milk & sugar'];
      const APPROVERS = ['Suresh Kumar','Priya Menon','Thomas Abraham','Deepa Nair'];
      const days = Array.from({length: 30}, () => -randInt(1, 110)).sort((a,b) => a - b);
      let bal = d.pettyCash.vouchers.length ? d.pettyCash.vouchers[d.pettyCash.vouchers.length-1].balance : d.pettyCash.openingBalance;
      days.forEach(off => {
        let type = Math.random() < 0.85 ? 'Payment' : 'Receipt', amount;
        if (type === 'Payment') { amount = randInt(4, 36) * 50; if (amount > bal) type = 'Receipt'; }
        if (type === 'Receipt') amount = rand([3000, 5000, 8000]);
        bal = type === 'Receipt' ? bal + amount : bal - amount;
        d.pettyCash.vouchers.push({ id: uid('PCV'), date: isoOff(off), particulars: type === 'Receipt' ? rand(['Cash top-up from Head Office','Cash reimbursement from Accounts']) : rand(PAY), type, amount, balance: bal, approvedBy: rand(APPROVERS) });
      });
    }

    // --- Stationery & stock register ---
    if (d.stockItems.length < 6) {
      const ITEMS = [['A4 Paper','Stationery','reams',10],['Ball Pens','Stationery','boxes',5],['Notebooks','Stationery','pcs',20],['Stapler Pins','Stationery','boxes',6],['File Folders','Stationery','pcs',40],['Sticky Notes','Stationery','packets',10],['Whiteboard Markers','Stationery','boxes',4],['Toner Cartridge','IT Consumables','pcs',3],['Tea Bags','Pantry Supplies','packets',4],['Sugar','Pantry Supplies','kg',5],['Coffee Powder','Pantry Supplies','packets',3],['Floor Cleaner','Cleaning Supplies','liters',4],['Hand Wash','Cleaning Supplies','liters',4]];
      ITEMS.forEach(([name, category, unit, reorderLevel]) => {
        const it = this.addStockItem({ name, category, unit, reorderLevel, currentStock: 0 });
        this.addStockTransaction({ itemId: it.id, type: 'Stock In', quantity: randInt(30, 90), date: isoOff(-100), issuedTo: '', remarks: 'Opening stock' });
        for (let k = 0; k < randInt(4, 8); k++) {
          const off = -randInt(1, 95); const cur = this.getStockItem(it.id).currentStock;
          if (Math.random() < 0.25) this.addStockTransaction({ itemId: it.id, type: 'Stock In', quantity: randInt(10, 40), date: isoOff(off), issuedTo: '', remarks: 'Purchase received' });
          else { const q = Math.min(cur, randInt(2, 15)); if (q > 0) this.addStockTransaction({ itemId: it.id, type: 'Stock Out', quantity: q, date: isoOff(off), issuedTo: rand([nameOf(rand(pool)), rand(DEPARTMENTS)]), remarks: 'Issued on request' }); }
        }
      });
      shuffle(d.stockItems).slice(0, 3).forEach(it => { const target = Math.max(0, it.reorderLevel - randInt(0, 2)); const out = it.currentStock - target; if (out > 0) this.addStockTransaction({ itemId: it.id, type: 'Stock Out', quantity: out, date: isoOff(-randInt(1, 6)), issuedTo: rand(DEPARTMENTS), remarks: 'Bulk issue' }); });
    }

    // --- Purchase requisitions with vendor quotations ---
    if (d.requisitions.length < 5) {
      const REQ_ITEMS = ['Laptop bags','Office chairs','Whiteboards','Water dispenser','UPS batteries','Laser printer','Projector','Filing cabinets','Ergonomic keyboards','Wall clocks','First-aid kits','Fire extinguishers'];
      const VENDORS = ['Om Traders','Kerala Office Supplies','Sree Enterprises','Metro Stationers','Galaxy Systems','Nila Furniture Mart','Prime IT Solutions','Bharat Stores'];
      const base = d.requisitions.length;
      REQ_ITEMS.forEach((item, i) => {
        const date = isoOff(-randInt(8, 130));
        const vs = shuffle(VENDORS).slice(0, randInt(2, 4));
        const quotations = vs.map(v => ({ vendor: v, amount: randInt(8, 90) * 500, deliveryDays: randInt(2, 21) }));
        const r = { id: uid('REQ'), refNo: `PR/${yr}/${String(base + i + 1).padStart(4, '0')}`, item, quantity: randInt(1, 25), department: rand(DEPARTMENTS), requestedBy: nameOf(rand(pool)), date, status: 'Quotations Added', quotations };
        if (i >= 10) { r.quotations = []; r.status = 'Pending'; }
        else if (i < 8) {
          const lowest = quotations.slice().sort((a,b) => a.amount - b.amount)[0];
          r.selectedVendor = Math.random() < 0.8 ? lowest.vendor : rand(quotations).vendor;
          r.poNumber = `PO/${yr}/${String(i + 1).padStart(4, '0')}`; r.poDate = addDays(date, randInt(2, 6)); r.status = 'PO Raised';
        }
        d.requisitions.unshift(r);
      });
    }

    // --- Travel requests + expense claims ---
    if (d.travelRequests.length < 4) {
      const PURPOSE = ['Client meeting','Vendor audit','Training programme','Branch inspection','Statutory filing','Trade fair','Site visit'];
      const CITIES = ['Kochi','Bengaluru','Chennai','Mumbai','Coimbatore','Hyderabad','Thiruvananthapuram','Delhi'];
      for (let i = 0; i < 10; i++) {
        const e = rand(pool); const from = isoOff(-randInt(5, 100)); const nd = randInt(1, 5);
        const status = i < 8 ? 'Approved' : (i === 8 ? 'Pending' : 'Rejected');
        const mode = rand(['Flight','Train','Cab','Own Vehicle','Bus']);
        const tr = { id: uid('TRV'), empId: e.id, purpose: rand(PURPOSE), fromCity: 'Thiruvalla', toCity: rand(CITIES), fromDate: from, toDate: addDays(from, nd - 1), mode, advanceRequested: rand([0, 2000, 3000, 5000]), status };
        d.travelRequests.unshift(tr);
        if (status === 'Approved') {
          const items = [{ category: 'Travel Fare', amount: randInt(6, 60) * 100, billNo: 'B-' + randInt(1000, 9999) }];
          if (nd > 1) items.push({ category: 'Lodging', amount: (nd - 1) * randInt(15, 35) * 100, billNo: 'B-' + randInt(1000, 9999) });
          items.push({ category: 'Food', amount: nd * randInt(3, 6) * 100, billNo: 'B-' + randInt(1000, 9999) });
          items.push({ category: 'Local Conveyance', amount: randInt(2, 12) * 100, billNo: 'B-' + randInt(1000, 9999) });
          if (Math.random() < 0.3) items.push({ category: 'Other', amount: randInt(1, 5) * 100, billNo: 'B-' + randInt(1000, 9999) });
          const total = items.reduce((s, x) => s + x.amount, 0); const adj = Math.min(tr.advanceRequested, total);
          d.expenseClaims.unshift({ id: uid('EXP'), travelId: tr.id, empId: e.id, items, totalClaimed: total, advanceAdjusted: adj, netPayable: total - adj, status: rand(['Submitted','Approved','Approved','Reimbursed']), date: addDays(tr.toDate, randInt(1, 5)) });
        }
      }
    }

    // --- Vendor & compliance contracts (a spread of expired / expiring / healthy) ---
    if (d.vendors.length < 5) {
      const V = [['Sree Elevators (AMC)','AMC / Maintenance'],['Kerala Fire Safety Services','License / Compliance'],['Orient Insurance Broker','Insurance'],['NetGear IT Solutions','IT Services'],['CleanCo Facility Services','Facility Services'],['Shakti Pest Control','Facility Services'],['Pollution Control Board Licence','License / Compliance'],['Cool Air AC Services','AMC / Maintenance'],['Metro Security Services','Facility Services'],['DataSafe Backup Services','IT Services'],['Lift Safety Certification','License / Compliance'],['Fire NOC Renewal','License / Compliance']];
      const offs = shuffle([-45, -10, 12, 25, 40, 58, 75, 90, 120, 200, 300, 420]);
      V.forEach(([name, category], i) => {
        const end = isoOff(offs[i]); const p = end.split('-').map(Number);
        d.vendors.push({ id: uid('VND'), name, category, contactPerson: nameOf(rand(pool)), phone: '9' + randInt(100000000, 999999999), contractStart: `${p[0]-1}-${pad(p[1])}-${pad(Math.min(p[2], 28))}`, contractEnd: end });
      });
    }

    // --- Facility maintenance tickets ---
    if (d.maintenanceTickets.length < 8) {
      const CATS = { 'Electrical': ['Tube light not working','Socket sparking near desk','Fan making noise'], 'Plumbing': ['Tap leaking in pantry','Washroom flush not working'], 'IT Equipment': ['Printer jam - recurring','Monitor flickering','Wi-Fi drops in conference room'], 'Furniture': ['Chair wheel broken','Cabinet door loose'], 'Cleaning': ['Carpet stain in lobby','Washroom needs deep cleaning'], 'Other': ['Door lock stuck','Signage fallen'] };
      const LOC = ['Reception','Conference Room A','Accounts Section','Server Room','Pantry','Ground Floor Lobby','IT Bay','HR Cabin','Store Room'];
      const TECH = ['Rajan (Electrician)','Sunil (Plumber)','IT Helpdesk','Housekeeping','Carpenter - Babu'];
      const base = d.maintenanceTickets.length;
      for (let i = 0; i < 24; i++) {
        const cat = rand(Object.keys(CATS)); const rep = isoOff(-randInt(1, 75));
        const priority = rand(['Urgent','High','High','Normal','Normal','Normal','Low']);
        const st = rand(['Resolved','Resolved','Closed','Closed','Open','Assigned','In Progress']);
        const t = { id: uid('TKT'), ticketNo: `TKT/${yr}/${String(base + i + 1).padStart(4, '0')}`, category: cat, description: rand(CATS[cat]), location: rand(LOC), reportedBy: rand(pool).id, priority, assignedTo: st === 'Open' ? '' : rand(TECH), status: st, dateReported: rep };
        if (st === 'Resolved' || st === 'Closed') { t.dateResolved = addDays(rep, priority === 'Urgent' ? randInt(0, 4) : randInt(0, 9)); t.resolutionNotes = 'Fixed and verified'; }
        d.maintenanceTickets.unshift(t);
      }
    }

    // --- Grievances ---
    if (d.grievances.length < 4) {
      const GC = ['Harassment','Payroll / Compensation','Facilities','Interpersonal Conflict','Policy Concern','Other'];
      for (let i = 0; i < 14; i++) {
        const filed = isoOff(-randInt(3, 110)); const st = rand(['Open','Open','In Progress','Resolved','Closed']);
        const g = { id: uid('GRV'), empId: rand(emps).id, category: rand(GC), description: 'Raised through the HR desk — details on file.', dateFiled: filed, assignedTo: rand(pool).id, status: st };
        if (st === 'Resolved' || st === 'Closed') { g.resolvedDate = addDays(filed, randInt(2, 30)); g.resolutionNotes = 'Discussed with the employee and closed.'; }
        d.grievances.unshift(g);
      }
    }

    // --- Front-office visitor log (messy company names, as real front desks produce) ---
    if (d.visitors.length < 6) {
      const CO = ['Om Traders','Orion Logistics','Kerala Office Supplies','Metro Stationers','Sree Enterprises','Prime IT Solutions','Bharat Stores','Regional PF Office'];
      const mess = (c) => { const r = Math.random(); return r < 0.15 ? c.toUpperCase() : r < 0.30 ? c.toLowerCase() : r < 0.42 ? c + ' ' : r < 0.50 ? ' ' + c : c; };
      const base = d.visitors.length;
      const rows = [];
      for (let i = 0; i < 36; i++) {
        let off = -randInt(0, 14); const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + off); if (dt.getDay() === 0) off -= 1;
        const tin = randInt(9 * 60 + 30, 16 * 60 + 30), dur = randInt(10, 120);
        rows.push({ id: uid('VIS'), name: `${rand(FIRST_NAMES_M.concat(FIRST_NAMES_F))} ${rand(LAST_NAMES)}`, company: mess(rand(CO)), purpose: rand(['Vendor meeting','Client meeting','Interview','Delivery','Audit','Courier pickup']), whomToMeet: rand(pool).id, date: isoOff(off), timeIn: hhmm(tin), timeOut: Math.random() < 0.95 ? hhmm(tin + dur) : '' });
      }
      rows.sort((a, b) => (b.date + b.timeIn).localeCompare(a.date + a.timeIn)).forEach((v, i, arr) => { v.badgeNo = `V-${String(base + arr.length - i).padStart(3, '0')}`; d.visitors.push(v); });
    }

    // --- Inward / outward mail registers (with a few duplicate and untidy entries) ---
    if (d.inwardMail.length < 6) {
      const FROM = ['Om Traders','Orion Logistics','Regional Provident Fund Office','Kerala Office Supplies','Federal Bank','Income Tax Department','Sree Enterprises','Metro Stationers','Prime IT Solutions'];
      const SUBJ = ['Invoice for last month supplies','Meeting confirmation','Annual compliance notice','Revised delivery schedule','Quotation for office furniture','Statement of account','Payment reminder','Contract renewal proposal','Response to our complaint letter'];
      const MODES = ['Post','Courier','Hand Delivery','Email','Fax'];
      const made = [];
      for (let i = 0; i < 24; i++) made.push({ date: isoOff(-randInt(1, 50)), from: rand(FROM), mode: rand(MODES), subject: rand(SUBJ), addressedTo: nameOf(rand(pool)), receivedBy: rand(['Front Desk','Mailroom','Reception']), remarks: '', action: rand(['Pending','Pending','Forwarded','Replied','Filed']) });
      shuffle(made).slice(0, 3).forEach(m => made.push({ ...m }));            // duplicates (entered twice)
      shuffle(made).slice(0, 3).forEach(m => { m.subject = m.subject + ' '; }); // trailing spaces
      made.sort((a, b) => a.date.localeCompare(b.date)).forEach((m, i) => { d.inwardMail.unshift({ id: uid('DAKI'), refNo: `INW/${yr}/${String(d.inwardMail.length + 1).padStart(4, '0')}`, ...m }); });
    }
    if (d.outwardMail.length < 6) {
      const TO = ['Om Traders','Orion Logistics','Regional PF Office','Federal Bank','Kerala Office Supplies','Metro Stationers','Income Tax Department','Dr. Meena Kapoor'];
      const SUBJ = ['Formal complaint about delayed order','Compliance documents submitted','Purchase order','Thank-you letter','Reply to quotation','Payment advice','Meeting confirmation'];
      const rowsO = [];
      for (let i = 0; i < 20; i++) { const mode = rand(['Post','Courier','Courier','Hand Delivery','Email']); rowsO.push({ date: isoOff(-randInt(1, 50)), to: rand(TO), mode, subject: rand(SUBJ), dispatchedBy: rand(['Mailroom','Front Desk']), trackingNo: (mode === 'Courier' || mode === 'Post') && Math.random() < 0.7 ? 'TRK' + randInt(1000000, 9999999) : '', remarks: '' }); }
      rowsO.sort((a, b) => a.date.localeCompare(b.date)).forEach(m => { d.outwardMail.unshift({ id: uid('DAKO'), refNo: `OUT/${yr}/${String(d.outwardMail.length + 1).padStart(4, '0')}`, ...m }); });
    }

    // --- Meeting-room bookings (conflict-free) ---
    if (d.roomBookings.length < 4) {
      let made = 0, tries = 0;
      while (made < 16 && tries < 200) {
        tries++;
        const room = rand(d.facilityRooms); const date = isoOff(randInt(-20, 10)); const s = randInt(9, 16) * 60; const e2 = s + rand([60, 90, 120]);
        const st = hhmm(s), en = hhmm(e2);
        if (this.bookingConflict(room.id, date, st, en)) continue;
        d.roomBookings.push({ id: uid('BK'), roomId: room.id, title: rand(['Weekly review','Client presentation','HR interviews','Training session','Vendor negotiation','Budget discussion','Team stand-up']), date, startTime: st, endTime: en, bookedBy: rand(pool).id });
        made++;
      }
    }

    // --- Company assets ---
    if (d.assets.length < 5) {
      const A = [['Dell Latitude 5420','Laptop'],['HP ProBook 450','Laptop'],['Lenovo ThinkPad E14','Laptop'],['Dell OptiPlex 3080','Desktop'],['HP 24" Monitor','Monitor'],['Dell 22" Monitor','Monitor'],['Samsung Galaxy A34','Mobile Phone'],['Ergonomic Chair','Furniture (Chair/Desk)'],['Standing Desk','Furniture (Chair/Desk)'],['Airtel SIM','SIM Card'],['Vodafone SIM','SIM Card'],['Access Card - Floor 2','Access Card'],['Lenovo ThinkPad T14','Laptop'],['HP LaserJet M126','Other']];
      A.forEach(([name, category], i) => {
        const a = { id: uid('AST'), name, category, serialNo: 'SN' + randInt(100000, 999999), status: 'Available', assignedTo: null };
        if (i < 9) { a.status = 'Issued'; a.assignedTo = rand(pool).id; a.issuedOn = isoOff(-randInt(10, 400)); a.returnedOn = null; }
        d.assets.push(a);
      });
    }

    d.meta.sampleRegisters = true;
    this.log('Sample office registers generated (petty cash, stock, procurement, travel, vendors, maintenance, grievances, visitors, mail, rooms, assets)');
    this.save();
    return true;
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
      d.salaryStructures[empId] = defaultSalaryStructure(emp ? emp.salary : 20000, emp ? emp.gender : 'Male');
    }
    return d.salaryStructures[empId];
  },
  setSalaryStructure(empId, structure) {
    const d = this.load();
    d.salaryStructures[empId] = structure;
    this.logTimeline(empId, 'Salary structure updated');
    this.save();
  },
  calcStatutoryDeductions(basic, da, gross, gender, monthStr) { return calcStatutoryDeductions(basic, da, gross, gender, monthStr); },
  computePayslip(empId, month) {
    const s = this.getSalaryStructure(empId);
    const gross = s.basic + (s.da||0) + s.hra + s.conveyance + s.medical + s.special;
    const deductions = s.pf + s.esi + s.pt + (s.otherDeduction || 0);
    const daysInMonth = daysInMonthOf(month);
    const monthData = this.getMonthAttendance(month)[empId] || {};
    const [py, pm] = month.split('-').map(Number);
    const workingDays = Array.from({length:daysInMonth},(_,i)=>i+1).filter(d => isWorkingDay(py, pm, d)).length;
    let lopDays = 0;   // Absent = full day LOP, Half Day = 0.5 day LOP
    Object.values(monthData).forEach(c => { if (c === 'A') lopDays += 1; else if (c === 'HD') lopDays += 0.5; });
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
    // Keep the Asset Register in step with the exit checklist: when an asset item is marked
    // Returned, release the matching asset(s) still issued to this employee.
    if (item && patch.status === 'Returned') {
      const cats = EXIT_ASSET_CATEGORY_MAP[key];
      const res = this.load().resignations.find(r => r.id === resignationId);
      if (cats && res) {
        this.load().assets.filter(a => a.status === 'Issued' && a.assignedTo === res.empId && cats.includes(a.category))
          .forEach(a => this.returnAsset(a.id));
      }
    }
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
    const dailyGross = (salary.basic + (salary.da||0) + salary.hra + salary.conveyance + salary.medical + salary.special) / 30;
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
