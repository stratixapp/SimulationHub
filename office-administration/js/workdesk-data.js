/* =========================================================
   workdesk-data.js — Data layer for Office Work Requests
   ---------------------------------------------------------
   Turns the student's live OATS registers into the same kind
   of typed Excel extract a colleague in MIS/IT would hand over
   (real dates, real numbers, real times), and provides the
   Excel-equivalent helper functions that the request checker
   uses to compute the expected answer from that *same* data.

   Pure logic only — no DOM access — so it can also be loaded
   headlessly for automated verification.
   ========================================================= */

const WD = {};

/* ---------------------------------------------------------
   Seeded random (stable picks per student + request)
   --------------------------------------------------------- */
WD.hash = function(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
};
WD.rng = function(seedStr) {
  let a = WD.hash(String(seedStr)) || 1;
  return function() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/* ---------------------------------------------------------
   Date helpers — ISO 'YYYY-MM-DD' strings in, ISO strings out.
   Serial numbers follow Excel's 1900 date system.
   --------------------------------------------------------- */
WD.dt = {
  pad(n) { return String(n).padStart(2, '0'); },
  parse(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; },
  fmt(y, m, d) { return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; },
  ser(iso) { const p = WD.dt.parse(iso); if (!p) return null; return Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(1899, 11, 30)) / 86400000); },
  fromSer(n) { const ms = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000; const d = new Date(ms); return WD.dt.fmt(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); },
  addDays(iso, n) { return WD.dt.fromSer(WD.dt.ser(iso) + n); },
  daysIn(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); },
  // Excel WEEKDAY: type 1 => Sun=1..Sat=7 ; type 2 => Mon=1..Sun=7
  weekday(iso, type) {
    const s = WD.dt.ser(iso); const dow = ((s - 1) % 7 + 7) % 7; // Excel serial 1 = Sunday 1900-01-01 -> dow 0 = Sunday
    const sun0 = (new Date(Date.UTC(WD.dt.parse(iso).y, WD.dt.parse(iso).m - 1, WD.dt.parse(iso).d))).getUTCDay(); // 0=Sun
    if (type === 2) return sun0 === 0 ? 7 : sun0;
    return sun0 + 1;
  },
  dayName(iso) { return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][WD.dt.weekday(iso, 1) - 1]; },
  monthName(m) { return ['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1]; },
  mon3(m) { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]; },
  human(iso) { const p = WD.dt.parse(iso); return p ? `${WD.dt.pad(p.d)} ${WD.dt.mon3(p.m)} ${p.y}` : ''; },
  // Excel EDATE / EOMONTH
  edate(iso, months) {
    const p = WD.dt.parse(iso); let idx = p.y * 12 + (p.m - 1) + months;
    const y = Math.floor(idx / 12), m = (idx % 12 + 12) % 12 + 1;
    return WD.dt.fmt(y, m, Math.min(p.d, WD.dt.daysIn(y, m)));
  },
  eomonth(iso, months) {
    const p = WD.dt.parse(iso); let idx = p.y * 12 + (p.m - 1) + months;
    const y = Math.floor(idx / 12), m = (idx % 12 + 12) % 12 + 1;
    return WD.dt.fmt(y, m, WD.dt.daysIn(y, m));
  },
  // Excel DATEDIF for units Y, M, D, YM, MD
  datedif(a, b, unit) {
    const s = WD.dt.parse(a), e = WD.dt.parse(b);
    if (WD.dt.ser(a) > WD.dt.ser(b)) return null;
    let months = (e.y - s.y) * 12 + (e.m - s.m); if (e.d < s.d) months--;
    switch (unit) {
      case 'Y': return Math.floor(months / 12);
      case 'M': return months;
      case 'D': return WD.dt.ser(b) - WD.dt.ser(a);
      case 'YM': return ((months % 12) + 12) % 12;
      case 'MD': { let d = e.d - s.d; if (d < 0) { const pm = e.m === 1 ? 12 : e.m - 1, py = e.m === 1 ? e.y - 1 : e.y; d += WD.dt.daysIn(py, pm); } return d; }
    }
    return null;
  },
  // Excel YEARFRAC basis 0 (US NASD 30/360)
  yearfrac0(a, b) {
    let s = WD.dt.parse(a), e = WD.dt.parse(b);
    if (WD.dt.ser(a) > WD.dt.ser(b)) { const t = s; s = e; e = t; }
    const lastFeb = (p) => p.m === 2 && p.d === WD.dt.daysIn(p.y, 2);
    let d1 = s.d, d2 = e.d;
    if (lastFeb(s) && lastFeb(e)) d2 = 30;
    if (lastFeb(s)) d1 = 30;
    if (d2 === 31 && d1 >= 30) d2 = 30;
    if (d1 === 31) d1 = 30;
    return ((e.y - s.y) * 360 + (e.m - s.m) * 30 + (d2 - d1)) / 360;
  },
  // Excel WEEKNUM(date, 2)  (week starts Monday; week 1 contains 1 January)
  weeknum2(iso) {
    const p = WD.dt.parse(iso);
    const doy = WD.dt.ser(iso) - WD.dt.ser(WD.dt.fmt(p.y, 1, 1)) + 1;
    const jan1 = WD.dt.weekday(WD.dt.fmt(p.y, 1, 1), 2) - 1; // Mon=0
    return Math.floor((doy - 1 + jan1) / 7) + 1;
  },
  // NETWORKDAYS.INTL — weekend: 1 => Sat+Sun ; 11 => Sunday only
  networkdays(a, b, holidays, weekendCode) {
    const wk = weekendCode || 1; const hol = new Set((holidays || []).map(WD.dt.ser));
    let s = WD.dt.ser(a), e = WD.dt.ser(b), sign = 1;
    if (s > e) { const t = s; s = e; e = t; sign = -1; }
    let n = 0;
    for (let x = s; x <= e; x++) {
      const iso = WD.dt.fromSer(x); const wd = WD.dt.weekday(iso, 1); // Sun=1
      const off = wk === 11 ? wd === 1 : (wd === 1 || wd === 7);
      if (!off && !hol.has(x)) n++;
    }
    return sign * n;
  },
  // WORKDAY (Sat/Sun weekend)
  workday(iso, n, holidays) {
    const hol = new Set((holidays || []).map(WD.dt.ser));
    let x = WD.dt.ser(iso); const step = n >= 0 ? 1 : -1; let left = Math.abs(n);
    while (left > 0) {
      x += step; const wd = WD.dt.weekday(WD.dt.fromSer(x), 1);
      if (wd !== 1 && wd !== 7 && !hol.has(x)) left--;
    }
    return WD.dt.fromSer(x);
  },
  // local "today" (matches what Excel's TODAY() returns on the student's PC)
  today() { const d = new Date(); return WD.dt.fmt(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
};

/* ---------------------------------------------------------
   Excel-style numeric helpers
   --------------------------------------------------------- */
WD.x = {
  round(v, dp) { dp = dp || 0; const f = Math.pow(10, dp); const s = v < 0 ? -1 : 1; return s * Math.round(Number((Math.abs(v) * f).toPrecision(15))) / f; },
  roundup(v, dp) { dp = dp || 0; const f = Math.pow(10, dp); const s = v < 0 ? -1 : 1; return s * Math.ceil(Number((Math.abs(v) * f).toPrecision(15)) - 1e-9) / f; },
  rounddown(v, dp) { dp = dp || 0; const f = Math.pow(10, dp); const s = v < 0 ? -1 : 1; return s * Math.floor(Number((Math.abs(v) * f).toPrecision(15)) + 1e-9) / f; },
  sum(a) { return a.reduce((s, v) => s + (Number(v) || 0), 0); },
  avg(a) { return a.length ? WD.x.sum(a) / a.length : 0; },
  max(a) { return a.length ? Math.max.apply(null, a) : 0; },
  min(a) { return a.length ? Math.min.apply(null, a) : 0; },
  median(a) { const s = a.slice().sort((x, y) => x - y), n = s.length; if (!n) return 0; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; },
  large(a, k) { const s = a.slice().sort((x, y) => y - x); return s[k - 1]; },
  small(a, k) { const s = a.slice().sort((x, y) => x - y); return s[k - 1]; },
  rank(v, a) { return a.filter(x => x > v).length + 1; },
  // Excel MODE: first value (in sheet order) among those with the highest frequency (needs freq >= 2)
  mode(a) { const f = new Map(); a.forEach(v => f.set(v, (f.get(v) || 0) + 1)); let best = null, bc = 1; a.forEach(v => { if (f.get(v) > bc) { bc = f.get(v); best = v; } }); return best; },
  // QUARTILE.INC / PERCENTILE.INC
  percentile(a, p) { const s = a.slice().sort((x, y) => x - y); if (!s.length) return 0; const r = p * (s.length - 1); const lo = Math.floor(r), hi = Math.ceil(r); return s[lo] + (s[hi] - s[lo]) * (r - lo); },
  pmt(rate, nper, pv) { return rate === 0 ? -pv / nper : -(pv * rate) / (1 - Math.pow(1 + rate, -nper)); },
  uniq(a) { return Array.from(new Set(a)); },
  trim(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/^ | $/g, ''); },
  proper(s) { return String(s).toLowerCase().replace(/(^|[^a-z0-9])([a-z])/g, (m, p, c) => p + c.toUpperCase()); }
};

/* ---------------------------------------------------------
   Reference data (the "policy sheets" a real office keeps)
   --------------------------------------------------------- */
WD.HOLIDAYS = () => (typeof HOLIDAYS_ALL !== 'undefined' ? HOLIDAYS_ALL : []);

WD.LEAVE_POLICY = { types: ['CL', 'SL', 'EL'], entitlement: [12, 12, 15], maxPerApplication: [3, 5, 10] };

WD.GRADE_RULES = function(desig) {
  const s = String(desig || '');
  if (/manager|lead/i.test(s)) return 'A';
  if (/executive|officer|accountant|coordinator|supervisor|engineer|technician|administrator|recruitment|analyst/i.test(s)) return 'B';
  return 'C';
};
WD.GRADE_MASTER = function() {
  const rows = [];
  if (typeof DESIGNATIONS !== 'undefined') Object.values(DESIGNATIONS).forEach(list => list.forEach(d => { if (!rows.some(r => r[0] === d)) rows.push([d, WD.GRADE_RULES(d)]); }));
  return rows;
};
WD.RATE_CARD = [['A', 1500, 4500, 600], ['B', 1000, 3000, 400], ['C', 700, 2000, 300]];
WD.SERVICE_AWARD = [[0, 0], [3, 2000], [5, 5000], [8, 9000], [10, 15000]];      // completed years (lower bound) -> award ₹
WD.INCREMENT_POLICY = [[0, 0.05], [3, 0.07], [5, 0.09], [8, 0.11]];             // completed years (lower bound) -> increment %
WD.approxLookup = function(table, v) { let r = null; table.forEach(row => { if (row[0] <= v) r = row; }); return r; };

/* ---------------------------------------------------------
   Sheet schemas
   type: t=text, n=number, d=date, m=time-of-day, i=integer
   --------------------------------------------------------- */
WD.SCHEMA = {
  'Employees': [
    ['id', 'Employee ID', 't', 14], ['first', 'First Name', 't', 14], ['last', 'Last Name', 't', 14], ['gender', 'Gender', 't', 9],
    ['dob', 'Date of Birth', 'd', 14], ['dept', 'Department', 't', 20], ['desig', 'Designation', 't', 26], ['join', 'Joining Date', 'd', 14],
    ['etype', 'Employment Type', 't', 16], ['status', 'Status', 't', 12], ['gross', 'Monthly Salary', 'n', 14], ['basic', 'Basic', 'n', 10],
    ['da', 'DA', 'n', 8], ['hra', 'HRA', 'n', 8], ['city', 'City', 't', 18], ['district', 'District', 't', 18], ['phone', 'Phone', 't', 14],
    ['email', 'Email', 't', 34], ['pan', 'PAN', 't', 13], ['bank', 'Bank Name', 't', 18], ['ifsc', 'IFSC Code', 't', 13],
    ['mgr', 'Reporting Manager', 't', 20], ['exp', 'Experience', 't', 34], ['skills', 'Skills', 't', 36]
  ],
  'Leave Register': [
    ['id', 'Leave ID', 't', 18], ['empId', 'Employee ID', 't', 14], ['name', 'Employee Name', 't', 22], ['dept', 'Department', 't', 20],
    ['type', 'Leave Type', 't', 11], ['from', 'From Date', 'd', 13], ['to', 'To Date', 'd', 13], ['days', 'Days', 'n', 7],
    ['reason', 'Reason', 't', 24], ['status', 'Status', 't', 11], ['applied', 'Applied On', 'd', 13], ['decided', 'Decided On', 'd', 13], ['by', 'Approved By', 't', 14]
  ],
  'Payroll': [
    ['month', 'Month', 't', 9], ['empId', 'Employee ID', 't', 14], ['name', 'Employee Name', 't', 22], ['dept', 'Department', 't', 20], ['gender', 'Gender', 't', 9],
    ['basic', 'Basic', 'n', 9], ['da', 'DA', 'n', 8], ['hra', 'HRA', 'n', 9], ['conv', 'Conveyance', 'n', 11], ['med', 'Medical', 'n', 9], ['special', 'Special', 'n', 9],
    ['gross', 'Gross', 'n', 10], ['pf', 'PF', 'n', 8], ['esi', 'ESI', 'n', 8], ['pt', 'PT', 'n', 8], ['lopDays', 'LOP Days', 'n', 9], ['lopAmt', 'LOP Deduction', 'n', 13], ['net', 'Net Pay', 'n', 10]
  ],
  'Petty Cash': [
    ['id', 'Voucher ID', 't', 18], ['date', 'Date', 'd', 13], ['part', 'Particulars', 't', 34], ['type', 'Type', 't', 10], ['amount', 'Amount', 'n', 10], ['bal', 'Balance', 'n', 10], ['by', 'Approved By', 't', 16]
  ],
  'Stock Register': [
    ['id', 'Item ID', 't', 18], ['name', 'Item Name', 't', 28], ['cat', 'Category', 't', 18], ['unit', 'Unit', 't', 9], ['reorder', 'Reorder Level', 'n', 13], ['stock', 'Current Stock', 'n', 13]
  ],
  'Stock Transactions': [
    ['id', 'Txn ID', 't', 18], ['itemId', 'Item ID', 't', 18], ['item', 'Item Name', 't', 28], ['type', 'Type', 't', 11], ['qty', 'Quantity', 'n', 10], ['date', 'Date', 'd', 13], ['to', 'Issued To', 't', 22], ['remarks', 'Remarks', 't', 24]
  ],
  'Purchase Requisitions': [
    ['ref', 'Ref No', 't', 16], ['item', 'Item', 't', 28], ['qty', 'Quantity', 'n', 10], ['dept', 'Department', 't', 20], ['by', 'Requested By', 't', 20], ['date', 'Date', 'd', 13],
    ['status', 'Status', 't', 16], ['vendor', 'Selected Vendor', 't', 22], ['po', 'PO Number', 't', 16], ['poDate', 'PO Date', 'd', 13]
  ],
  'Quotations': [
    ['ref', 'Ref No', 't', 16], ['vendor', 'Vendor', 't', 24], ['amount', 'Quoted Amount', 'n', 15], ['days', 'Delivery Days', 'n', 14]
  ],
  'Travel Claims': [
    ['id', 'Claim ID', 't', 18], ['empId', 'Employee ID', 't', 14], ['name', 'Employee Name', 't', 22], ['purpose', 'Purpose', 't', 28], ['from', 'From City', 't', 16], ['to', 'To City', 't', 16],
    ['start', 'Start Date', 'd', 13], ['end', 'End Date', 'd', 13], ['mode', 'Mode', 't', 12], ['advance', 'Advance', 'n', 10], ['claimed', 'Total Claimed', 'n', 14], ['net', 'Net Payable', 'n', 13], ['status', 'Status', 't', 11]
  ],
  'Expense Items': [
    ['claim', 'Claim ID', 't', 18], ['cat', 'Category', 't', 18], ['amount', 'Amount', 'n', 10], ['bill', 'Bill No', 't', 14]
  ],
  'Vendors': [
    ['id', 'Vendor ID', 't', 18], ['name', 'Vendor Name', 't', 26], ['cat', 'Category', 't', 22], ['contact', 'Contact Person', 't', 20], ['phone', 'Phone', 't', 14], ['start', 'Contract Start', 'd', 14], ['end', 'Contract End', 'd', 14]
  ],
  'Maintenance Tickets': [
    ['no', 'Ticket No', 't', 16], ['cat', 'Category', 't', 14], ['desc', 'Description', 't', 34], ['loc', 'Location', 't', 20], ['by', 'Reported By', 't', 22], ['priority', 'Priority', 't', 10],
    ['assigned', 'Assigned To', 't', 18], ['status', 'Status', 't', 12], ['reported', 'Date Reported', 'd', 14], ['resolved', 'Date Resolved', 'd', 14]
  ],
  'Grievances': [
    ['id', 'Grievance ID', 't', 18], ['empId', 'Employee ID', 't', 14], ['cat', 'Category', 't', 24], ['filed', 'Date Filed', 'd', 13], ['assigned', 'Assigned To', 't', 22], ['status', 'Status', 't', 12], ['resolved', 'Resolved Date', 'd', 14]
  ],
  'Visitors': [
    ['badge', 'Badge No', 't', 10], ['name', 'Visitor Name', 't', 24], ['company', 'Company', 't', 26], ['purpose', 'Purpose', 't', 22], ['whom', 'Whom To Meet', 't', 22], ['date', 'Date', 'd', 13], ['in', 'Time In', 'm', 10], ['out', 'Time Out', 'm', 10]
  ],
  'Inward Mail': [
    ['ref', 'Ref No', 't', 16], ['date', 'Date', 'd', 13], ['from', 'From', 't', 28], ['mode', 'Mode', 't', 14], ['subject', 'Subject', 't', 40], ['to', 'Addressed To', 't', 22], ['by', 'Received By', 't', 18], ['action', 'Action', 't', 12]
  ],
  'Outward Mail': [
    ['ref', 'Ref No', 't', 16], ['date', 'Date', 'd', 13], ['to', 'To', 't', 28], ['mode', 'Mode', 't', 14], ['subject', 'Subject', 't', 40], ['by', 'Dispatched By', 't', 18], ['tracking', 'Tracking No', 't', 16]
  ],
  'Room Bookings': [
    ['id', 'Booking ID', 't', 18], ['room', 'Room', 't', 20], ['title', 'Title', 't', 28], ['date', 'Date', 'd', 13], ['start', 'Start Time', 'm', 11], ['end', 'End Time', 'm', 11], ['by', 'Booked By', 't', 22]
  ],
  'Assets': [
    ['id', 'Asset ID', 't', 18], ['name', 'Asset Name', 't', 26], ['cat', 'Category', 't', 22], ['serial', 'Serial No', 't', 16], ['status', 'Status', 't', 11], ['assignedTo', 'Assigned To', 't', 14], ['issued', 'Issued On', 'd', 13], ['returned', 'Returned On', 'd', 13]
  ]
};

/* Human-friendly label for each extract sheet (used on request cards) */
WD.SHEET_LABEL = {
  'Employees': 'Employee Master', 'Attendance': 'Attendance Register', 'Leave Register': 'Leave Register', 'Payroll': 'Payroll Register',
  'Petty Cash': 'Petty Cash Book', 'Stock Register': 'Stock Register', 'Stock Transactions': 'Stock Movements', 'Purchase Requisitions': 'Purchase Requisitions',
  'Quotations': 'Vendor Quotations', 'Travel Claims': 'Travel Claims', 'Expense Items': 'Expense Line Items', 'Vendors': 'Vendor & Contract Tracker',
  'Maintenance Tickets': 'Maintenance Log', 'Grievances': 'Grievance Register', 'Visitors': 'Visitor Log', 'Inward Mail': 'Inward Mail Register',
  'Outward Mail': 'Outward Mail Register', 'Room Bookings': 'Room Bookings', 'Assets': 'Company Assets', 'Holidays': 'Holiday List',
  'Leave Policy': 'Leave Policy', 'Grade Master': 'Grade Master', 'Rate Card': 'TA/DA Rate Card', 'Service Award Policy': 'Service Award Policy', 'Increment Policy': 'Increment Policy'
};

/* ---------------------------------------------------------
   Table builders — read live Store data into typed row objects
   --------------------------------------------------------- */
WD.empName = function(emp) { return emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : ''; };

WD.attMonth = function() {
  const S = Store.load(); let best = '';
  Object.keys(S.attendance || {}).forEach(m => {
    const recs = S.attendance[m] || {};
    const n = Object.keys(recs).filter(id => Object.keys(recs[id]).length >= 5).length;
    if (n >= Math.min(5, Math.max(1, Store.getEmployees().length)) && m > best) best = m;
  });
  return best || '';
};
WD.payMonth = function() {
  const runs = Store.getPayrollRuns(); let best = '';
  runs.forEach(r => { if (r.month > best) best = r.month; });
  return best;
};

WD.buildTables = function() {
  const S = Store.load();
  const emps = Store.getEmployees();
  const byId = {}; emps.forEach(e => byId[e.id] = e);
  const nm = (id) => WD.empName(byId[id]) || (id || '');
  const T = { _emp: byId };

  /* Employees */
  T['Employees'] = emps.map(e => {
    const s = Store.getSalaryStructure(e.id);
    return { id: e.id, first: e.firstName || '', last: e.lastName || '', gender: e.gender || '', dob: e.dob || '', dept: e.department || '', desig: e.designation || '',
      join: e.joiningDate || '', etype: e.employmentType || '', status: e.status || '', gross: Number(e.salary) || 0, basic: Number(s.basic) || 0, da: Number(s.da) || 0, hra: Number(s.hra) || 0,
      city: e.city || '', district: e.district || '', phone: e.phone || '', email: e.email || '', pan: e.pan || '', bank: e.bankName || '', ifsc: e.ifsc || '',
      mgr: e.reportingManager || '', exp: e.experience || '', skills: e.skills || '' };
  });

  /* Attendance grid for the latest month with data */
  const am = WD.attMonth();
  T._attMonth = am;
  if (am) {
    const [y, m] = am.split('-').map(Number); const n = WD.dt.daysIn(y, m);
    const days = Array.from({ length: n }, (_, i) => WD.dt.fmt(y, m, i + 1));
    const data = Store.getMonthAttendance(am);
    T._attDays = days;
    T['Attendance'] = emps.map(e => { const rec = data[e.id] || {}; return { id: e.id, name: WD.empName(e), dept: e.department || '', codes: days.map((_, i) => rec[WD.dt.pad(i + 1)] || '') }; });
  } else { T._attDays = []; T['Attendance'] = []; }

  /* Leave register */
  T['Leave Register'] = (S.leaveApplications || []).map(l => ({ id: l.id, empId: l.empId, name: nm(l.empId), dept: (byId[l.empId] || {}).department || '', type: l.leaveType || '',
    from: l.from || '', to: l.to || '', days: Number(l.days) || 0, reason: l.reason || '', status: l.status || '', applied: l.appliedOn || '', decided: l.decidedOn || '', by: l.approvedBy || '' }));

  /* Payroll for the latest run */
  const pm = WD.payMonth(); T._payMonth = pm;
  const run = pm ? Store.getPayrollRun(pm) : null;
  T['Payroll'] = run ? run.payslips.filter(p => byId[p.empId]).map(p => ({ month: pm, empId: p.empId, name: nm(p.empId), dept: byId[p.empId].department || '', gender: byId[p.empId].gender || '',
    basic: p.basic || 0, da: p.da || 0, hra: p.hra || 0, conv: p.conveyance || 0, med: p.medical || 0, special: p.special || 0, gross: p.gross || 0, pf: p.pf || 0, esi: p.esi || 0, pt: p.pt || 0,
    lopDays: p.lopDays || 0, lopAmt: p.lopDeduction || 0, net: p.netPay || 0 })) : [];

  /* Petty cash */
  T['Petty Cash'] = (S.pettyCash.vouchers || []).map(v => ({ id: v.id, date: v.date || '', part: v.particulars || '', type: v.type || '', amount: Number(v.amount) || 0, bal: Number(v.balance) || 0, by: v.approvedBy || '' }));
  T._pettyOpening = Number(S.pettyCash.openingBalance) || 0;

  /* Stock */
  T['Stock Register'] = (S.stockItems || []).map(i => ({ id: i.id, name: i.name || '', cat: i.category || '', unit: i.unit || '', reorder: Number(i.reorderLevel) || 0, stock: Number(i.currentStock) || 0 }));
  const itemById = {}; (S.stockItems || []).forEach(i => itemById[i.id] = i);
  T['Stock Transactions'] = (S.stockTransactions || []).slice().reverse().map(t => ({ id: t.id, itemId: t.itemId, item: (itemById[t.itemId] || {}).name || '', type: t.type || '', qty: Number(t.quantity) || 0, date: t.date || '', to: t.issuedTo || '', remarks: t.remarks || '' }));

  /* Procurement */
  const reqs = (S.requisitions || []).slice().reverse();
  T['Purchase Requisitions'] = reqs.map(r => ({ ref: r.refNo || '', item: r.item || '', qty: Number(r.quantity) || 0, dept: r.department || '', by: r.requestedBy || '', date: r.date || '', status: r.status || '', vendor: r.selectedVendor || '', po: r.poNumber || '', poDate: r.poDate || '' }));
  T['Quotations'] = []; reqs.forEach(r => (r.quotations || []).forEach(q => T['Quotations'].push({ ref: r.refNo || '', vendor: q.vendor || '', amount: Number(q.amount) || 0, days: Number(q.deliveryDays) || 0 })));

  /* Travel */
  const trById = {}; (S.travelRequests || []).forEach(t => trById[t.id] = t);
  const claims = (S.expenseClaims || []).slice().reverse();
  T['Travel Claims'] = claims.map(c => { const t = trById[c.travelId] || {}; return { id: c.id, empId: c.empId || t.empId || '', name: nm(c.empId || t.empId), purpose: t.purpose || '', from: t.fromCity || '', to: t.toCity || '',
    start: t.fromDate || '', end: t.toDate || '', mode: t.mode || '', advance: Number(c.advanceAdjusted) || 0, claimed: Number(c.totalClaimed) || 0, net: Number(c.netPayable) || 0, status: c.status || '' }; });
  T['Expense Items'] = []; claims.forEach(c => (c.items || []).forEach(it => T['Expense Items'].push({ claim: c.id, cat: it.category || '', amount: Number(it.amount) || 0, bill: it.billNo || '' })));

  /* Vendors, maintenance, grievances */
  T['Vendors'] = (S.vendors || []).map(v => ({ id: v.id, name: v.name || '', cat: v.category || '', contact: v.contactPerson || '', phone: v.phone || '', start: v.contractStart || '', end: v.contractEnd || '' }));
  T['Maintenance Tickets'] = (S.maintenanceTickets || []).slice().reverse().map(t => ({ no: t.ticketNo || '', cat: t.category || '', desc: t.description || '', loc: t.location || '', by: nm(t.reportedBy), priority: t.priority || '', assigned: t.assignedTo || '', status: t.status || '', reported: t.dateReported || '', resolved: t.dateResolved || '' }));
  T['Grievances'] = (S.grievances || []).slice().reverse().map(g => ({ id: g.id, empId: g.empId || '', cat: g.category || '', filed: g.dateFiled || '', assigned: nm(g.assignedTo), status: g.status || '', resolved: g.resolvedDate || '' }));

  /* Front office / mail / rooms / assets */
  T['Visitors'] = (S.visitors || []).slice().reverse().map(v => ({ badge: v.badgeNo || '', name: v.name || '', company: v.company || '', purpose: v.purpose || '', whom: nm(v.whomToMeet), date: v.date || '', in: v.timeIn || '', out: v.timeOut || '' }));
  T['Inward Mail'] = (S.inwardMail || []).slice().reverse().map(m => ({ ref: m.refNo || '', date: m.date || '', from: m.from || '', mode: m.mode || '', subject: m.subject || '', to: m.addressedTo || '', by: m.receivedBy || '', action: m.action || '' }));
  T['Outward Mail'] = (S.outwardMail || []).slice().reverse().map(m => ({ ref: m.refNo || '', date: m.date || '', to: m.to || '', mode: m.mode || '', subject: m.subject || '', by: m.dispatchedBy || '', tracking: m.trackingNo || '' }));
  const roomById = {}; (S.facilityRooms || []).forEach(r => roomById[r.id] = r);
  T['Room Bookings'] = (S.roomBookings || []).map(b => ({ id: b.id, room: (roomById[b.roomId] || {}).name || b.roomId || '', title: b.title || '', date: b.date || '', start: b.startTime || '', end: b.endTime || '', by: nm(b.bookedBy) }));
  T['Assets'] = (S.assets || []).map(a => ({ id: a.id, name: a.name || '', cat: a.category || '', serial: a.serialNo || '', status: a.status || '', assignedTo: a.assignedTo || '', issued: a.issuedOn || '', returned: a.returnedOn || '' }));

  return T;
};

/* ---------------------------------------------------------
   Extract workbook builder (typed cells, filters, widths)
   --------------------------------------------------------- */
WD.timeFrac = function(hhmm) { const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || ''); return m ? (+m[1] * 60 + +m[2]) / 1440 : null; };

WD._cell = function(type, v) {
  if (v === '' || v === null || v === undefined) return null;
  if (type === 'n' || type === 'i') return { t: 'n', v: Number(v), z: '#,##0.##' };
  if (type === 'd') { const s = WD.dt.ser(v); return s == null ? { t: 's', v: String(v) } : { t: 'n', v: s, z: 'dd-mmm-yyyy' }; }
  if (type === 'm') { const f = WD.timeFrac(v); return f == null ? { t: 's', v: String(v) } : { t: 'n', v: f, z: 'hh:mm' }; }
  return { t: 's', v: String(v) };
};

WD._sheetFromRows = function(headers, types, widths, rows) {
  const ws = {}; let maxC = headers.length - 1;
  headers.forEach((h, c) => { ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h }; });
  rows.forEach((row, r) => row.forEach((val, c) => { const cell = WD._cell(types[c], val); if (cell) ws[XLSX.utils.encode_cell({ r: r + 1, c })] = cell; }));
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 0), c: maxC } });
  ws['!cols'] = widths.map(w => ({ wch: w || 12 }));
  if (rows.length) ws['!autofilter'] = { ref: ws['!ref'] };
  return ws;
};

WD.buildSheet = function(name, T) {
  if (WD.SCHEMA[name]) {
    const cols = WD.SCHEMA[name];
    return WD._sheetFromRows(cols.map(c => c[1]), cols.map(c => c[2]), cols.map(c => c[3]), (T[name] || []).map(r => cols.map(c => r[c[0]])));
  }
  if (name === 'Attendance') {
    const days = T._attDays || [];
    const ws = {}; const nC = 3 + days.length;
    ['Employee ID', 'Employee Name', 'Department'].forEach((h, c) => ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h });
    days.forEach((d, i) => ws[XLSX.utils.encode_cell({ r: 0, c: 3 + i })] = { t: 'n', v: WD.dt.ser(d), z: 'ddd d-mmm' });
    (T['Attendance'] || []).forEach((r, ri) => {
      ws[XLSX.utils.encode_cell({ r: ri + 1, c: 0 })] = { t: 's', v: r.id };
      ws[XLSX.utils.encode_cell({ r: ri + 1, c: 1 })] = { t: 's', v: r.name };
      ws[XLSX.utils.encode_cell({ r: ri + 1, c: 2 })] = { t: 's', v: r.dept };
      r.codes.forEach((code, i) => { if (code) ws[XLSX.utils.encode_cell({ r: ri + 1, c: 3 + i })] = { t: 's', v: code }; });
    });
    const nR = (T['Attendance'] || []).length;
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: nR, c: nC - 1 } });
    ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 20 }].concat(days.map(() => ({ wch: 8 })));
    return ws;
  }
  const aoa = (rows, types, widths) => WD._sheetFromRows(rows[0], types, widths, rows.slice(1));
  switch (name) {
    case 'Holidays': return aoa([['Date', 'Holiday']].concat(WD.HOLIDAYS().map(h => [h.date, h.name])), ['d', 't'], [14, 26]);
    case 'Leave Policy': { const p = WD.LEAVE_POLICY; const ws = {};
      const rows = [['Leave Type'].concat(p.types), ['Annual Entitlement (days)'].concat(p.entitlement), ['Max Days Per Application'].concat(p.maxPerApplication)];
      rows.forEach((r, ri) => r.forEach((v, ci) => ws[XLSX.utils.encode_cell({ r: ri, c: ci })] = typeof v === 'number' ? { t: 'n', v } : { t: 's', v }));
      ws['!ref'] = 'A1:D3'; ws['!cols'] = [{ wch: 28 }, { wch: 8 }, { wch: 8 }, { wch: 8 }]; return ws; }
    case 'Grade Master': return aoa([['Designation', 'Grade']].concat(WD.GRADE_MASTER()), ['t', 't'], [30, 8]);
    case 'Rate Card': return aoa([['Grade', 'Daily Allowance', 'Lodging Cap (per night)', 'Local Conveyance (per day)']].concat(WD.RATE_CARD), ['t', 'n', 'n', 'n'], [8, 16, 22, 24]);
    case 'Service Award Policy': return aoa([['Completed Years of Service (from)', 'Award Amount']].concat(WD.SERVICE_AWARD), ['n', 'n'], [32, 16]);
    case 'Increment Policy': return aoa([['Completed Years of Service (from)', 'Increment %']].concat(WD.INCREMENT_POLICY), ['n', 'n'], [32, 14]);
  }
  return null;
};

WD.infoSheet = function(T, names) {
  const meta = Store.load().meta;
  const rows = [
    ['System Extract — Office Administration MIS'],
    [`This file has one sheet tab per dataset — your data is in: ${names.join(', ')}`],
    ['Organisation', meta.institution || ''],
    ['Extract generated on', WD.dt.human(WD.dt.today())],
    ['Attendance month in this extract', T._attMonth ? `${WD.dt.monthName(+T._attMonth.slice(5))} ${T._attMonth.slice(0, 4)}` : '(no attendance recorded)'],
    ['Payroll month in this extract', T._payMonth ? `${WD.dt.monthName(+T._payMonth.slice(5))} ${T._payMonth.slice(0, 4)}` : '(no payroll run)'],
    [''],
    ['Sheet', 'Records']
  ];
  names.forEach(n => { const cnt = WD.SCHEMA[n] || n === 'Attendance' ? (T[n] || []).length : ''; rows.push([n, cnt]); });
  const ws = {};
  rows.forEach((r, ri) => r.forEach((v, ci) => { if (v === '') return; ws[XLSX.utils.encode_cell({ r: ri, c: ci })] = typeof v === 'number' ? { t: 'n', v } : { t: 's', v: String(v) }; }));
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: 1 } });
  ws['!cols'] = [{ wch: 38 }, { wch: 30 }];
  return ws;
};

/* Build a workbook object holding the requested sheets (plus an Info sheet
   for reference). Excel/Sheets always opens on the FIRST sheet in the file
   — this library can't set a separate "active tab" pointer — so the real
   data sheet(s) are added first and Info last, otherwise a student who
   doesn't notice the tabs at the bottom of the screen opens the file,
   sees only the short Info summary, and assumes that's the whole export. */
WD.buildWorkbook = function(names, T) {
  T = T || WD.buildTables();
  const wb = XLSX.utils.book_new();
  names.forEach(n => { const ws = WD.buildSheet(n, T); if (ws) XLSX.utils.book_append_sheet(wb, ws, n); });
  XLSX.utils.book_append_sheet(wb, WD.infoSheet(T, names), 'Info');
  return wb;
};

WD.downloadExtract = function(names, label) {
  if (typeof XLSX === 'undefined') { toast('The Excel library did not load — reload the page and try again', 'error'); return; }
  const wb = WD.buildWorkbook(names);
  const slug = String(label || 'MIS-Extract').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  XLSX.writeFile(wb, `${slug}-${WD.dt.today()}.xlsx`);
  toast('✓ System extract downloaded — open it in Excel', 'success');
};
