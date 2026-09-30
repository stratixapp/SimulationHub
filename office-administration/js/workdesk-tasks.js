/* =========================================================
   workdesk-tasks.js — Office Work Requests (the request bank)
   ---------------------------------------------------------
   Every request is written the way a colleague would actually
   send it: a short message with a business reason. Nothing here
   names a formula. The expected answer is computed from the
   student's own live data using the same rows the Excel extract
   contains, so the checker and the spreadsheet always agree.

   Request definition:
     ses    session id           lvl   1 easy .. 3 demanding
     src    extract sheets the student may pull for this request
     req    data prerequisites (see WD.REQ in workdesk.js)
     pick   (C,R) -> params | null (not applicable) — frozen per student
     subj   (p,C) -> subject line          body (p,C) -> message text
     ans    (p,C) -> expected answer       kind  num|text|date|set
     dp     decimals expected (num)        unit  label shown beside the box
     nudge  plain-language hint offered after a couple of misses
   ========================================================= */

const WD_SENDERS = {
  meera:    ['Meera Pillai', 'HR Manager'],
  suresh:   ['Suresh Nambiar', 'Administration Manager'],
  karan:    ['Karan Malhotra', 'Sales Manager'],
  finance:  ['R. Krishnamurthy', 'Finance Controller'],
  sneha:    ['Sneha Kulkarni', 'Accounts Executive'],
  rohan:    ['Rohan Mehta', 'HR Executive'],
  director: ['Office of the Director', 'Executive Office'],
  audit:    ['Internal Audit Cell', 'Compliance'],
  vikram:   ['Vikram Singh', 'Procurement Officer'],
  aditi:    ['Aditi Rao', 'Front Office Executive'],
  priya:    ['Priya Nair', 'Operations Executive'],
  arjun:    ['Arjun Verma', 'IT Support Engineer']
};

const WD_SESSIONS = [
  { id: 'mis', icon: '&#128202;', title: 'Session 9 — Director\'s Headcount & Salary Pack',
    narrative: 'The Director\'s office wants the quarterly headcount and salary pack by end of day. Meera Pillai (HR Manager) will send you the queries one at a time. Pull the Employee Master from the system and answer from the actual records — estimates will not do.' },
  { id: 'leave', icon: '&#128197;', title: 'Session 10 — Attendance & Leave Audit',
    narrative: 'Internal Audit is reviewing last month\'s attendance and the leave register. Every figure you send goes into the audit file, so it must tie back to the register exactly.' },
  { id: 'payroll', icon: '&#128176;', title: 'Session 11 — Payroll Reconciliation for Accounts',
    narrative: 'Payroll has been processed and Accounts is reconciling the bank transfer, statutory dues and provisions. Answer their queries from the Payroll Register.' },
  { id: 'records', icon: '&#128193;', title: 'Session 12 — HR Records Audit & Data Clean-up',
    narrative: 'Before the annual compliance audit, HR is cleaning up the records: contact details, ID formats, registers with duplicate or untidy entries. Spot the problems and report the numbers.' },
  { id: 'dates', icon: '&#128198;', title: 'Session 13 — Service Records, Milestones & Compliance Calendar',
    narrative: 'Long-service awards, probation reviews, retirements and contract renewals all hang on dates. Work out the dates and figures the department heads are waiting for.' },
  { id: 'spend', icon: '&#128722;', title: 'Session 14 — Admin Spend, Stock & Procurement Review',
    narrative: 'Finance wants a review of what the admin office spends: petty cash, stationery stock, purchase quotations and travel claims. Reconcile each figure against the registers.' },
  { id: 'service', icon: '&#127970;', title: 'Session 15 — Facilities, Front Desk & Service Levels',
    narrative: 'The Administration Manager is preparing a service-level review covering maintenance, grievances, visitors, mail and room usage. Pull the numbers.' },
  { id: 'yearend', icon: '&#127942;', title: 'Session 16 — Year-End Review Pack (Advanced)',
    narrative: 'The year-end pack needs figures that pull together several registers at once. These are the demanding ones — take your time and cross-check.' }
];

const WD_TASKS = [];
function WT(id, def) { def.id = id; WD_TASKS.push(def); }

const _fN = (e) => `${e.first} ${e.last}`.trim();
const _inr = (n) => '\u20B9' + Number(n).toLocaleString('en-IN');
const _cnt = (a, f) => a.filter(f).length;
const _sumBy = (a, f, k) => WD.x.sum(a.filter(f).map(r => r[k]));
const _lc = (s) => String(s == null ? '' : s).toLowerCase();

/* ================= SESSION 9 — HEADCOUNT & SALARY MIS ================= */
WT('M01', { ses: 'mis', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'meera', kind: 'num', unit: 'employees',
  pick: (C, R) => { const d = C.pickDept(R, 3, e => e.status === 'Active'); return d ? { d } : null; },
  subj: p => `Active headcount — ${p.d}`,
  body: p => `Please confirm how many people in the ${p.d} department currently have their Status recorded as "Active". The figure goes straight into the board pack this afternoon, so I need the exact number, not an approximation.`,
  ans: (p, C) => _cnt(C.E, e => e.dept === p.d && e.status === 'Active'),
  nudge: 'Two things must be true for every person you count: the department and the status.' });

WT('M02', { ses: 'mis', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'finance', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const d = C.pickDept(R, 3); return d ? { d } : null; },
  subj: p => `Monthly salary bill — ${p.d}`,
  body: p => `For the budget revision I need the total monthly salary bill of the ${p.d} department — everyone on the master list for that department, whatever their status. Use the Monthly Salary column.`,
  ans: (p, C) => _sumBy(C.E, e => e.dept === p.d, 'gross'),
  nudge: 'You are adding up one column, but only for the rows that belong to that department.' });

WT('M03', { ses: 'mis', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'meera', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const combos = []; ['Male', 'Female'].forEach(g => C.uniq(C.E.map(e => e.etype)).forEach(t => { if (t && _cnt(C.E, e => e.gender === g && e.etype === t) >= 2) combos.push({ g, t }); })); const c = C.choice(R, combos); return c || null; },
  subj: p => `Average basic — ${p.g} staff on ${p.t} terms`,
  body: p => `We are benchmarking pay across employment types. What is the average Basic salary of ${p.g.toLowerCase()} employees whose Employment Type is ${p.t}? Round it to the nearest rupee.`,
  ans: (p, C) => WD.x.round(WD.x.avg(C.E.filter(e => e.gender === p.g && e.etype === p.t).map(e => e.basic)), 0),
  nudge: 'An average, but of a filtered group — gender and employment type together decide who is included.' });

WT('M04', { ses: 'mis', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'finance', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const t = C.choice(R, C.uniq(C.E.map(e => e.etype)).filter(t => t && _cnt(C.E, e => e.etype === t) >= 2)); return t ? { t } : null; },
  subj: p => `Highest pay on ${p.t} terms`,
  body: p => `What is the highest Monthly Salary drawn by anyone whose Employment Type is ${p.t}? I am checking it against the sanctioned pay ceiling for that category.`,
  ans: (p, C) => WD.x.max(C.E.filter(e => e.etype === p.t).map(e => e.gross)),
  nudge: 'You want the largest value, but only among one category of employee.' });

WT('M05', { ses: 'mis', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'finance', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const d = C.pickDept(R, 3); return d ? { d } : null; },
  subj: p => `Entry-level pay — ${p.d}`,
  body: p => `We are reviewing the minimum pay band. What is the lowest Monthly Salary currently paid in the ${p.d} department?`,
  ans: (p, C) => WD.x.min(C.E.filter(e => e.dept === p.d).map(e => e.gross)),
  nudge: 'The smallest value in the salary column, restricted to that one department.' });

WT('M06', { ses: 'mis', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'director', kind: 'num', unit: 'employees',
  pick: (C) => ({}),
  subj: () => 'Who earns above the company average?',
  body: () => `The Director wants to know how many employees earn more than the average Monthly Salary of the whole company (all employees on the master). Please give me the head-count.`,
  ans: (p, C) => { const a = WD.x.avg(C.E.map(e => e.gross)); return _cnt(C.E, e => e.gross > a); },
  nudge: 'First work out the company-wide average, then count how many are strictly above it.' });

WT('M07', { ses: 'mis', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'finance', kind: 'num', unit: '\u20B9',
  pick: (C, R) => ({ k: 2 + Math.floor(R() * 3) }),
  subj: p => `Salary ranking — position ${p.k}`,
  body: p => `For the compensation committee: what is the ${p.k === 2 ? '2nd' : p.k === 3 ? '3rd' : '4th'} highest Monthly Salary on the employee master? If two people share a figure, each counts as a separate position.`,
  ans: (p, C) => WD.x.large(C.E.map(e => e.gross), p.k),
  nudge: 'You are looking for a position in the ranked list of salaries, not the top or bottom one.' });

WT('M08', { ses: 'mis', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'finance', kind: 'num', unit: '\u20B9',
  pick: (C, R) => ({ k: 2 + Math.floor(R() * 3) }),
  subj: p => `Lowest-paid list — position ${p.k}`,
  body: p => `Now from the other end: what is the ${p.k === 2 ? '2nd' : p.k === 3 ? '3rd' : '4th'} lowest Monthly Salary on the employee master? Duplicates count as separate positions.`,
  ans: (p, C) => WD.x.small(C.E.map(e => e.gross), p.k),
  nudge: 'Same idea as the highest-paid ranking, but counting up from the bottom.' });

WT('M09', { ses: 'mis', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'director', kind: 'num', unit: '\u20B9', dp: 1,
  pick: () => ({}),
  subj: () => 'Median salary',
  body: () => `The average is being skewed by a few senior salaries. Please send me the median Monthly Salary of all employees on the master list.`,
  ans: (p, C) => WD.x.median(C.E.map(e => e.gross)),
  nudge: 'The middle value once every salary is put in order — not the average.' });

WT('M10', { ses: 'mis', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'rohan', kind: 'num', unit: 'rank',
  pick: (C, R) => { const e = C.pickEmp(R, () => true); return e ? { id: e.id, name: _fN(e) } : null; },
  subj: p => `Where does ${p.name} stand on pay?`,
  body: p => `${p.name} (${p.id}) has asked HR where they stand. Ranking everyone on the master by Monthly Salary, with the highest salary as rank 1, what rank does ${p.name} hold? People with identical salaries share a rank.`,
  ans: (p, C) => { const e = C.E.find(x => x.id === p.id); return e ? WD.x.rank(e.gross, C.E.map(x => x.gross)) : null; },
  nudge: 'Find that person\u2019s salary first, then see where it falls among everyone\u2019s.' });

WT('M11', { ses: 'mis', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'director', kind: 'num', unit: '%', dp: 1,
  pick: () => ({}),
  subj: () => 'Gender mix for the annual report',
  body: () => `What percentage of employees on the master list are Female? Please round to one decimal place — it goes into the diversity section of the annual report.`,
  ans: (p, C) => WD.x.round(_cnt(C.E, e => e.gender === 'Female') / C.E.length * 100, 1),
  nudge: 'Count the women, divide by everyone, and express it as a percentage.' });

WT('M12', { ses: 'mis', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'audit', kind: 'num', unit: 'records',
  pick: (C) => (_cnt(C.E, e => !e.pan) >= 1 ? {} : null),
  subj: () => 'Employees with no PAN on record',
  body: () => `The tax team is chasing missing documents. How many employee records have nothing entered in the PAN column?`,
  ans: (p, C) => _cnt(C.E, e => !e.pan),
  nudge: 'You are counting empty cells in one column.' });

WT('M13', { ses: 'mis', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'rohan', kind: 'num', unit: 'employees',
  pick: (C, R) => { const ks = ['Tally', 'Excel', 'CRM', 'GST', 'Typing', 'Data Entry', 'Communication'].filter(k => _cnt(C.E, e => _lc(e.skills).includes(_lc(k))) >= 2); const k = C.choice(R, ks); return k ? { k } : null; },
  subj: p => `Who has ${p.k} skills?`,
  body: p => `A project needs people with ${p.k} skills. The Skills column holds several skills per person in one cell. How many employees list ${p.k} anywhere in their skills?`,
  ans: (p, C) => _cnt(C.E, e => _lc(e.skills).includes(_lc(p.k))),
  nudge: 'The word you want sits somewhere inside a longer piece of text — you need a partial match.' });

WT('M14', { ses: 'mis', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'suresh', kind: 'num', unit: 'employees',
  pick: (C, R) => { const ds = C.depts().filter(d => _cnt(C.E, e => e.dept === d) >= 2); if (ds.length < 2) return null; const a = C.choice(R, ds); const b = C.choice(R, ds.filter(d => d !== a)); return { a, b }; },
  subj: p => `Combined headcount — ${p.a} and ${p.b}`,
  body: p => `We are planning a shared floor for ${p.a} and ${p.b}. How many employees in total belong to either of these two departments (any status)?`,
  ans: (p, C) => _cnt(C.E, e => e.dept === p.a || e.dept === p.b),
  nudge: 'A person counts if they belong to the first department or the second — never both at once.' });

WT('M15', { ses: 'mis', lvl: 3, src: ['Employees'], req: ['emp8'], from: 'finance', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const d = C.pickDept(R, 3, e => e.status === 'Active'); return d ? { d } : null; },
  subj: p => `Annual salary liability — active staff in ${p.d}`,
  body: p => `For the annual budget, what is the yearly salary liability (twelve months of Monthly Salary) for Active employees in ${p.d}? Please do it in one calculation rather than by adding rows by hand.`,
  ans: (p, C) => 12 * _sumBy(C.E, e => e.dept === p.d && e.status === 'Active', 'gross'),
  nudge: 'Multiply the monthly figure by twelve — but only for rows that are both in the department and Active.' });

WT('M16', { ses: 'mis', lvl: 3, src: ['Employees'], req: ['emp8'], from: 'director', kind: 'text',
  pick: () => ({}),
  subj: () => 'Our largest department',
  body: () => `Which department has the most employees on the master list? Type the department name exactly as it appears in the data.`,
  ans: (p, C) => { const m = {}; C.E.forEach(e => { m[e.dept] = (m[e.dept] || 0) + 1; }); const mx = Math.max.apply(null, Object.values(m)); return Object.keys(m).filter(k => m[k] === mx); },
  nudge: 'Count people per department, then find which count is the biggest. A summary table makes this quick.' });

WT('M17', { ses: 'mis', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'finance', kind: 'num', unit: 'employees',
  pick: (C) => { const s = C.E.map(e => e.gross); const lo = WD.x.round(WD.x.percentile(s, 0.25), -3), hi = WD.x.round(WD.x.percentile(s, 0.75), -3); return hi > lo ? { lo, hi } : null; },
  subj: p => `Mid-band earners (${_inr(p.lo)} to ${_inr(p.hi)})`,
  body: p => `How many employees earn a Monthly Salary of at least ${_inr(p.lo)} and at most ${_inr(p.hi)}? Both limits are inclusive.`,
  ans: (p, C) => _cnt(C.E, e => e.gross >= p.lo && e.gross <= p.hi),
  nudge: 'The same column has to satisfy a lower limit and an upper limit together.' });

WT('M18', { ses: 'mis', lvl: 3, src: ['Employees'], req: ['emp8'], from: 'director', kind: 'num', unit: '\u20B9', dp: 2,
  pick: () => ({}),
  subj: () => 'Top-quartile salary threshold',
  body: () => `Compensation wants to know the salary level at which the top 25% of earners begin — the third quartile of Monthly Salary across the whole master list. Two decimals, please.`,
  ans: (p, C) => WD.x.percentile(C.E.map(e => e.gross), 0.75),
  nudge: 'A statistical position in the data, not a count or an average.' });

WT('M19', { ses: 'mis', lvl: 3, src: ['Employees'], req: ['emp8'], from: 'finance', kind: 'num', unit: '\u20B9', dp: 2,
  pick: () => ({}),
  subj: () => 'How spread out are our salaries?',
  body: () => `For a pay-equity note, I need the sample standard deviation of Monthly Salary across all employees on the master. Give it to two decimal places.`,
  ans: (p, C) => { const a = C.E.map(e => e.gross), m = WD.x.avg(a); return Math.sqrt(WD.x.sum(a.map(v => (v - m) * (v - m))) / (a.length - 1)); },
  nudge: 'A measure of dispersion. Note it is the sample version, not the population one.' });

/* ================= SESSION 10 — ATTENDANCE & LEAVE AUDIT ================= */
const _approved = (C) => C.LV.filter(l => l.status === 'Approved');

WT('L01', { ses: 'leave', lvl: 1, src: ['Leave Register'], req: ['leave10'], from: 'audit', kind: 'num', unit: 'days',
  pick: (C, R) => { const ids = C.uniq(_approved(C).map(l => l.empId)).filter(id => _cnt(_approved(C), l => l.empId === id) >= 2); const id = C.choice(R, ids); if (!id) return null; const l = C.LV.find(x => x.empId === id); return { id, name: l.name }; },
  subj: p => `Leave taken by ${p.name}`,
  body: p => `${p.name} (${p.id}) has queried the leave deducted from their records. Find the total number of leave days taken — approved leave only — and let me know so I can reconcile it.`,
  ans: (p, C) => _sumBy(C.LV, l => l.empId === p.id && l.status === 'Approved', 'days'),
  nudge: 'Applications that were rejected or are still pending are not leave that was actually taken.' });

WT('L02', { ses: 'leave', lvl: 1, src: ['Leave Register'], req: ['leave10'], from: 'audit', kind: 'num', unit: 'applications',
  pick: (C, R) => { const t = C.choice(R, C.uniq(_approved(C).map(l => l.type)).filter(t => _cnt(_approved(C), l => l.type === t) >= 2)); return t ? { t } : null; },
  subj: p => `Approved ${p.t} applications`,
  body: p => `How many ${p.t} (leave type) applications have been approved so far? Audit needs the count of applications, not the number of days.`,
  ans: (p, C) => _cnt(C.LV, l => l.type === p.t && l.status === 'Approved'),
  nudge: 'Count rows — each application is one row, however many days it covers.' });

WT('L03', { ses: 'leave', lvl: 1, src: ['Leave Register'], req: ['leave10'], from: 'meera', kind: 'num', unit: 'applications',
  pick: (C, R) => { const ds = C.uniq(C.LV.filter(l => l.status === 'Pending').map(l => l.dept)).filter(Boolean); const d = C.choice(R, ds); return d ? { d } : null; },
  subj: p => `Pending leave decisions — ${p.d}`,
  body: p => `I want to clear the backlog. How many leave applications from the ${p.d} department are still Pending?`,
  ans: (p, C) => _cnt(C.LV, l => l.dept === p.d && l.status === 'Pending'),
  nudge: 'Department and status are both conditions on the same rows.' });

WT('L04', { ses: 'leave', lvl: 2, src: ['Leave Register'], req: ['leave10'], from: 'audit', kind: 'num', unit: 'days', dp: 2,
  pick: (C, R) => { const t = C.choice(R, C.uniq(_approved(C).map(l => l.type)).filter(t => _cnt(_approved(C), l => l.type === t) >= 2)); return t ? { t } : null; },
  subj: p => `Typical length of ${p.t}`,
  body: p => `What is the average number of days per application for approved ${p.t} leave? Two decimals.`,
  ans: (p, C) => WD.x.avg(_approved(C).filter(l => l.type === p.t).map(l => l.days)),
  nudge: 'An average over approved applications of one leave type only.' });

WT('L05', { ses: 'leave', lvl: 2, src: ['Leave Register'], req: ['leave10'], from: 'audit', kind: 'num', unit: 'days',
  pick: () => ({}),
  subj: () => 'Longest approved leave',
  body: () => `Policy caps continuous leave. What is the largest number of days in any single approved leave application?`,
  ans: (p, C) => WD.x.max(_approved(C).map(l => l.days)),
  nudge: 'The biggest value in the Days column, among approved applications only.' });

WT('L06', { ses: 'leave', lvl: 3, src: ['Leave Register'], req: ['leave10'], from: 'audit', kind: 'num', unit: 'days',
  pick: (C, R) => { const ms = C.uniq(_approved(C).map(l => l.from.slice(0, 7))).filter(m => _cnt(_approved(C), l => l.from.slice(0, 7) === m) >= 2); const m = C.choice(R, ms); return m ? { m } : null; },
  subj: p => `Leave starting in ${WD.dt.monthName(+p.m.slice(5))} ${p.m.slice(0, 4)}`,
  body: p => `For the month-wise leave liability, total the Days of all approved leave applications whose From Date falls in ${WD.dt.monthName(+p.m.slice(5))} ${p.m.slice(0, 4)}. Use the start date to decide which month an application belongs to.`,
  ans: (p, C) => _sumBy(_approved(C), l => l.from.slice(0, 7) === p.m, 'days'),
  nudge: 'The dates themselves are the condition here: on or after the first of the month and on or before the last.' });

WT('L07', { ses: 'leave', lvl: 2, src: ['Leave Register', 'Leave Policy'], req: ['leave10'], from: 'rohan', kind: 'num', unit: 'days',
  pick: (C, R) => { const opts = []; C.uniq(_approved(C).map(l => l.empId)).forEach(id => WD.LEAVE_POLICY.types.forEach(t => { if (_cnt(_approved(C), l => l.empId === id && l.type === t)) opts.push({ id, t }); })); const o = C.choice(R, opts); if (!o) return null; return { ...o, name: C.LV.find(l => l.empId === o.id).name }; },
  subj: p => `${p.t} balance — ${p.name}`,
  body: p => `How many ${p.t} days does ${p.name} (${p.id}) have left for the year? Take the annual entitlement from the Leave Policy sheet and deduct the approved ${p.t} days in the register. A negative number means they have overdrawn.`,
  ans: (p, C) => WD.LEAVE_POLICY.entitlement[WD.LEAVE_POLICY.types.indexOf(p.t)] - _sumBy(C.LV, l => l.empId === p.id && l.type === p.t && l.status === 'Approved', 'days'),
  nudge: 'Two sources are involved: the policy gives the allowance, the register gives what has been used.' });

WT('L08', { ses: 'leave', lvl: 1, src: ['Attendance'], req: ['att'], from: 'audit', kind: 'num', unit: 'employees',
  pick: (C, R) => { const idx = C.days.map((d, i) => i).filter(i => _cnt(C.ATT, r => r.codes[i] === 'A') >= 1); const i = C.choice(R, idx); return i === undefined ? null : { date: C.days[i] }; },
  subj: p => `Absentees on ${WD.dt.human(p.date)}`,
  body: p => `How many employees were marked Absent (A) on ${WD.dt.dayName(p.date)}, ${WD.dt.human(p.date)}? The floor manager disputes the head-count for that day.`,
  ans: (p, C) => { const i = C.days.indexOf(p.date); return i < 0 ? null : _cnt(C.ATT, r => r.codes[i] === 'A'); },
  nudge: 'Find that date\u2019s column and count one particular code in it.' });

WT('L09', { ses: 'leave', lvl: 1, src: ['Attendance'], req: ['att'], from: 'rohan', kind: 'num', unit: 'days',
  pick: (C, R) => { const e = C.choice(R, C.ATT.filter(r => r.codes.filter(c => c === 'A').length >= 2)); return e ? { id: e.id, name: e.name } : null; },
  subj: p => `Absences — ${p.name}`,
  body: p => `${p.name} (${p.id}) is disputing the Loss-of-Pay days. How many days is ${p.name} marked Absent (A) in the attendance register this month?`,
  ans: (p, C) => { const r = C.ATT.find(x => x.id === p.id); return r ? r.codes.filter(c => c === 'A').length : null; },
  nudge: 'Look along that person\u2019s row and count only the absent marks.' });

WT('L10', { ses: 'leave', lvl: 2, src: ['Attendance'], req: ['att'], from: 'rohan', kind: 'num', unit: 'days',
  pick: (C, R) => { const e = C.choice(R, C.ATT.filter(r => r.codes.filter(c => ['P', 'WFH', 'OD'].includes(c)).length >= 8)); return e ? { id: e.id, name: e.name } : null; },
  subj: p => `Days present — ${p.name}`,
  body: p => `For the attendance certificate: on how many days was ${p.name} (${p.id}) actually present this month? Count office presence (P), work-from-home (WFH) and on-duty (OD) days; leave, half-days, absences and holidays do not count.`,
  ans: (p, C) => { const r = C.ATT.find(x => x.id === p.id); return r ? r.codes.filter(c => ['P', 'WFH', 'OD'].includes(c)).length : null; },
  nudge: 'Three different codes all mean \u201Cpresent\u201D — make sure each of them is included.' });

WT('L11', { ses: 'leave', lvl: 3, src: ['Attendance'], req: ['att'], from: 'audit', kind: 'num', unit: 'absent marks',
  pick: (C, R) => { const ds = C.uniq(C.ATT.map(r => r.dept)).filter(d => d && _cnt(C.ATT, r => r.dept === d) >= 3); const d = C.choice(R, ds); return d ? { d } : null; },
  subj: p => `Absent marks in ${p.d}`,
  body: p => `How many Absent (A) marks are there in total across the whole month for everyone in ${p.d}? I need one department-level figure for the audit file, not a person-by-person list.`,
  ans: (p, C) => WD.x.sum(C.ATT.filter(r => r.dept === p.d).map(r => r.codes.filter(c => c === 'A').length)),
  nudge: 'It is a count over a block of cells — many employees and many days at once — restricted to one department.' });

WT('L12', { ses: 'leave', lvl: 1, src: ['Attendance'], req: ['att'], from: 'audit', kind: 'num', unit: 'half-days',
  pick: (C) => (C.ATT.some(r => r.codes.includes('HD')) ? {} : null),
  subj: () => 'Half-day marks this month',
  body: () => `How many Half-Day (HD) entries are there in the whole attendance register for the month, across all employees?`,
  ans: (p, C) => WD.x.sum(C.ATT.map(r => r.codes.filter(c => c === 'HD').length)),
  nudge: 'One code, counted across the entire table of attendance marks.' });

WT('L13', { ses: 'leave', lvl: 3, src: ['Attendance'], req: ['att'], from: 'audit', kind: 'text',
  pick: (C) => (C.ATT.some(r => r.codes.filter(c => c === 'A').length >= 2) ? {} : null),
  subj: () => 'Who has the most absences?',
  body: () => `Which employee has the highest number of Absent (A) marks this month? Type the name exactly as it appears in the Employee Name column.`,
  ans: (p, C) => { const m = C.ATT.map(r => r.codes.filter(c => c === 'A').length); const mx = Math.max.apply(null, m); return C.ATT.filter((r, i) => m[i] === mx).map(r => r.name); },
  nudge: 'Count absences person by person, then look up whose count is highest.' });

WT('L14', { ses: 'leave', lvl: 3, src: ['Attendance', 'Holidays'], req: ['att'], from: 'aditi', kind: 'num', unit: 'days',
  pick: (C) => ({ m: C.attMonth }),
  subj: p => `Working days in ${WD.dt.monthName(+p.m.slice(5))} ${p.m.slice(0, 4)}`,
  body: p => `How many working days does ${WD.dt.monthName(+p.m.slice(5))} ${p.m.slice(0, 4)} have? We work Monday to Saturday, Sundays are off, and any date on the Holiday List is also off. Use the Holidays sheet.`,
  ans: (p, C) => { const y = +p.m.slice(0, 4), m = +p.m.slice(5); return WD.dt.networkdays(WD.dt.fmt(y, m, 1), WD.dt.fmt(y, m, WD.dt.daysIn(y, m)), C.holidays, 11); },
  nudge: 'Excel has a working-days calculation that lets you choose which weekdays count as the weekend and accepts a holiday list.' });

WT('L15', { ses: 'leave', lvl: 3, src: ['Leave Register', 'Holidays'], req: ['leave10'], from: 'sneha', kind: 'date',
  pick: (C, R) => { const l = C.choice(R, _approved(C).filter(l => l.from)); return l ? { id: l.id, name: l.name } : null; },
  subj: p => `Payroll cut-off for ${p.name}'s leave`,
  body: p => `Payroll needs leave details 3 working days before the leave starts (Monday to Friday, skipping dates on the Holiday List). For leave application ${p.id} (${p.name}), what is the last date by which we must hand it over? Enter the date.`,
  ans: (p, C) => { const l = C.LV.find(x => x.id === p.id); return l ? WD.dt.workday(l.from, -3, C.holidays) : null; },
  nudge: 'Count backwards in working days from the start date.' });

WT('L16', { ses: 'leave', lvl: 2, src: ['Leave Register'], req: ['leave10'], from: 'audit', kind: 'num', unit: 'days',
  pick: (C, R) => { const l = C.choice(R, C.LV.filter(l => l.days >= 3 && l.from && l.to)); return l ? { id: l.id, name: l.name } : null; },
  subj: p => `Working days inside leave ${p.id}`,
  body: p => `The client-facing team works Monday to Friday only. Between the From Date and To Date of leave application ${p.id} (${p.name}), inclusive, how many Monday–Friday working days fall inside the leave?`,
  ans: (p, C) => { const l = C.LV.find(x => x.id === p.id); return l ? WD.dt.networkdays(l.from, l.to, [], 1) : null; },
  nudge: 'Do not count calendar days — weekends fall inside the leave period and have to be excluded.' });

WT('L17', { ses: 'leave', lvl: 3, src: ['Leave Register'], req: ['leave10'], from: 'suresh', kind: 'num', unit: 'employees',
  pick: (C, R) => { const l = C.choice(R, _approved(C).filter(l => l.from && l.to)); return l ? { date: l.from } : null; },
  subj: p => `Who is on leave on ${WD.dt.human(p.date)}?`,
  body: p => `How many approved leave applications cover ${WD.dt.dayName(p.date)}, ${WD.dt.human(p.date)}? A leave covers a date if the date is on or after its From Date and on or before its To Date.`,
  ans: (p, C) => _cnt(_approved(C), l => l.from <= p.date && l.to >= p.date),
  nudge: 'The date has to sit between the start and the end of the leave — two comparisons on two different columns.' });

WT('L18', { ses: 'leave', lvl: 3, src: ['Attendance'], req: ['att'], from: 'audit', kind: 'num', unit: 'absent marks',
  pick: (C, R) => { const ws = [1, 2, 3, 4, 5, 6].filter(w => WD.x.sum(C.ATT.map(r => r.codes.filter((c, i) => c === 'A' && WD.dt.weekday(C.days[i], 2) === w).length)) >= 1); const w = C.choice(R, ws); return w ? { w } : null; },
  subj: p => `Absences falling on ${['', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][p.w]}`,
  body: p => `Management suspects a pattern. Across all employees, how many Absent (A) marks fall on a ${['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][p.w]} this month?`,
  ans: (p, C) => WD.x.sum(C.ATT.map(r => r.codes.filter((c, i) => c === 'A' && WD.dt.weekday(C.days[i], 2) === p.w).length)),
  nudge: 'The column headings are real dates — the day of the week can be worked out from them.' });

/* ================= SESSION 11 — PAYROLL RECONCILIATION ================= */
WT('P01', { ses: 'payroll', lvl: 1, src: ['Payroll'], req: ['pay'], from: 'sneha', kind: 'num', unit: '\u20B9',
  pick: () => ({}),
  subj: () => 'Total net pay for the bank transfer',
  body: () => `The bank wants the total amount to be transferred for this payroll run. What is the total Net Pay across all employees on the Payroll Register?`,
  ans: (p, C) => WD.x.sum(C.PAY.map(r => r.net)),
  nudge: 'A straight total of one column.' });

WT('P02', { ses: 'payroll', lvl: 1, src: ['Payroll'], req: ['pay'], from: 'sneha', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const d = C.choice(R, C.uniq(C.PAY.map(r => r.dept)).filter(d => d && _cnt(C.PAY, r => r.dept === d) >= 2)); return d ? { d } : null; },
  subj: p => `Net pay — ${p.d}`,
  body: p => `The ${p.d} department head has asked what his team\u2019s payroll cost this month. What is the total Net Pay for ${p.d}?`,
  ans: (p, C) => _sumBy(C.PAY, r => r.dept === p.d, 'net'),
  nudge: 'Total of one column for only one department\u2019s rows.' });

WT('P03', { ses: 'payroll', lvl: 2, src: ['Payroll'], req: ['pay'], from: 'finance', kind: 'num', unit: '\u20B9',
  pick: (C) => { const x = WD.x.round(WD.x.median(C.PAY.map(r => r.gross)), -3); return _cnt(C.PAY, r => r.gross > x) >= 1 ? { x } : null; },
  subj: p => `PF on salaries above ${_inr(p.x)}`,
  body: p => `How much Provident Fund (PF) was deducted in total from employees whose Gross is above ${_inr(p.x)}?`,
  ans: (p, C) => _sumBy(C.PAY, r => r.gross > p.x, 'pf'),
  nudge: 'You are totalling one column, but the condition is on a different column (a comparison, not an exact match).' });

WT('P04', { ses: 'payroll', lvl: 2, src: ['Payroll'], req: ['pay'], from: 'sneha', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const g = C.choice(R, ['Male', 'Female'].filter(g => _cnt(C.PAY, r => r.gender === g) >= 2)); return g ? { g } : null; },
  subj: p => `Average gross — ${p.g} employees`,
  body: p => `What is the average Gross pay of ${p.g.toLowerCase()} employees on this payroll, rounded to the nearest rupee?`,
  ans: (p, C) => WD.x.round(WD.x.avg(C.PAY.filter(r => r.gender === p.g).map(r => r.gross)), 0),
  nudge: 'An average for one group, then rounded.' });

WT('P05', { ses: 'payroll', lvl: 1, src: ['Payroll'], req: ['pay'], from: 'sneha', kind: 'num', unit: 'employees',
  pick: (C) => (_cnt(C.PAY, r => r.lopDays > 0) >= 1 ? {} : null),
  subj: () => 'Employees with Loss of Pay',
  body: () => `How many employees had any Loss-of-Pay days (LOP Days above zero) in this payroll run?`,
  ans: (p, C) => _cnt(C.PAY, r => r.lopDays > 0),
  nudge: 'Count only the rows where the LOP Days figure is greater than zero.' });

WT('P06', { ses: 'payroll', lvl: 1, src: ['Payroll'], req: ['pay'], from: 'finance', kind: 'num', unit: '\u20B9',
  pick: () => ({}),
  subj: () => 'Total LOP recovered',
  body: () => `What is the total LOP Deduction recovered from employees in this run?`,
  ans: (p, C) => WD.x.sum(C.PAY.map(r => r.lopAmt)),
  nudge: 'A single-column total.' });

WT('P07', { ses: 'payroll', lvl: 2, src: ['Payroll'], req: ['pay'], from: 'director', kind: 'text',
  pick: () => ({}),
  subj: () => 'Highest take-home this month',
  body: () => `Who received the highest Net Pay in this run? Type the employee\u2019s name as shown in the register.`,
  ans: (p, C) => { const mx = WD.x.max(C.PAY.map(r => r.net)); return C.PAY.filter(r => r.net === mx).map(r => r.name); },
  nudge: 'First find the largest Net Pay, then look up whose it is.' });

WT('P08', { ses: 'payroll', lvl: 1, src: ['Payroll'], req: ['pay'], from: 'sneha', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const g = C.choice(R, ['Male', 'Female'].filter(g => _cnt(C.PAY, r => r.gender === g) >= 1)); return g ? { g } : null; },
  subj: p => `Professional Tax — ${p.g} staff`,
  body: p => `What is the total Professional Tax (PT) deducted this month from ${p.g.toLowerCase()} employees? The PT return is separate for each gender slab.`,
  ans: (p, C) => _sumBy(C.PAY, r => r.gender === p.g, 'pt'),
  nudge: 'Total one column, only where the gender matches.' });

WT('P09', { ses: 'payroll', lvl: 2, src: ['Payroll'], req: ['pay'], from: 'finance', kind: 'num', unit: '\u20B9',
  pick: () => ({}),
  subj: () => 'Bank float required',
  body: () => `The bank accepts transfer limits only in blocks of \u20B910,000. Take the total Net Pay for this run and round it UP to the next multiple of \u20B910,000 — what float should we ask for?`,
  ans: (p, C) => WD.x.roundup(WD.x.sum(C.PAY.map(r => r.net)), -4),
  nudge: 'Rounding has to go upwards, never down, and to the nearest ten thousand.' });

WT('P10', { ses: 'payroll', lvl: 2, src: ['Payroll'], req: ['pay'], from: 'sneha', kind: 'num', unit: '\u20B9',
  pick: () => ({}),
  subj: () => 'Average take-home in whole rupees',
  body: () => `What is the average Net Pay across all employees on the register? Ignore the paise — drop everything after the decimal point without rounding up.`,
  ans: (p, C) => Math.floor(WD.x.avg(C.PAY.map(r => r.net))),
  nudge: 'Cut off the decimals rather than rounding them.' });

WT('P11', { ses: 'payroll', lvl: 2, src: ['Payroll'], req: ['pay'], from: 'finance', kind: 'num', unit: '%', dp: 2,
  pick: (C, R) => { const d = C.choice(R, C.uniq(C.PAY.map(r => r.dept)).filter(d => d && _cnt(C.PAY, r => r.dept === d) >= 2)); return d ? { d } : null; },
  subj: p => `${p.d}'s share of payroll cost`,
  body: p => `What percentage of the company\u2019s total Gross payroll is contributed by the ${p.d} department? Two decimal places.`,
  ans: (p, C) => WD.x.round(_sumBy(C.PAY, r => r.dept === p.d, 'gross') / WD.x.sum(C.PAY.map(r => r.gross)) * 100, 2),
  nudge: 'The department\u2019s total divided by the overall total, as a percentage.' });

WT('P12', { ses: 'payroll', lvl: 2, src: ['Payroll'], req: ['pay'], from: 'finance', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const d = C.choice(R, C.uniq(C.PAY.map(r => r.dept)).filter(d => d && _cnt(C.PAY, r => r.dept === d) >= 2)); return d ? { d } : null; },
  subj: p => `Statutory deductions — ${p.d}`,
  body: p => `What is the combined PF + ESI + Professional Tax deducted from the ${p.d} department this month?`,
  ans: (p, C) => _sumBy(C.PAY, r => r.dept === p.d, 'pf') + _sumBy(C.PAY, r => r.dept === p.d, 'esi') + _sumBy(C.PAY, r => r.dept === p.d, 'pt'),
  nudge: 'Three columns, one department, one grand total.' });

WT('P13', { ses: 'payroll', lvl: 3, src: ['Payroll'], req: ['pay'], from: 'finance', kind: 'num', unit: '\u20B9',
  pick: () => ({}),
  subj: () => 'Festival bonus provision',
  body: () => `Accounts must provision the festival bonus. Bonus is a percentage of each employee\u2019s Basic depending on Gross: 10% if Gross is \u20B940,000 or more; 7.5% if Gross is \u20B925,000 to \u20B939,999; 5% otherwise. Round each employee\u2019s bonus to the nearest rupee, then give me the total for everyone on the register.`,
  ans: (p, C) => WD.x.sum(C.PAY.map(r => WD.x.round(r.basic * (r.gross >= 40000 ? 0.10 : r.gross >= 25000 ? 0.075 : 0.05), 0))),
  nudge: 'Each person gets a rate depending on their Gross band. Work it out per row, then add the results up.' });

WT('P14', { ses: 'payroll', lvl: 3, src: ['Payroll'], req: ['pay'], from: 'meera', kind: 'num', unit: '\u20B9',
  pick: () => ({}),
  subj: () => 'Attendance incentive payout',
  body: () => `Attendance incentive this month: employees with 0 LOP days earn \u20B91,000; those with 1 or 2 LOP days earn \u20B9500; anyone with more earns nothing. What is the total incentive to be paid across the register?`,
  ans: (p, C) => WD.x.sum(C.PAY.map(r => r.lopDays === 0 ? 1000 : r.lopDays <= 2 ? 500 : 0)),
  nudge: 'Three outcomes depending on the LOP days — set the rule up for one row and apply it to all.' });

WT('P15', { ses: 'payroll', lvl: 3, src: ['Payroll'], req: ['pay'], from: 'director', kind: 'num', unit: '\u20B9',
  pick: (C) => (C.PAY.length >= 6 ? {} : null),
  subj: () => 'Cost of our five highest take-homes',
  body: () => `What is the combined Net Pay of the five employees with the highest Net Pay in this run?`,
  ans: (p, C) => WD.x.sum(C.PAY.map(r => r.net).sort((a, b) => b - a).slice(0, 5)),
  nudge: 'You need the five largest values added together — not just the single largest.' });

WT('P16', { ses: 'payroll', lvl: 2, src: ['Payroll'], req: ['pay'], from: 'rohan', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const r = C.choice(R, C.PAY); return r ? { id: r.empId, name: r.name } : null; },
  subj: p => `Net pay of ${p.id}`,
  body: p => `${p.name} has asked for a copy of the salary details. What was the Net Pay of employee ${p.id} in this run? Look it up from the register — please do not scroll and copy by eye.`,
  ans: (p, C) => { const r = C.PAY.find(x => x.empId === p.id); return r ? r.net : null; },
  nudge: 'This is a lookup: find the row by Employee ID and read another column from that same row.' });

WT('P17', { ses: 'payroll', lvl: 2, src: [], req: ['emp8'], from: 'finance', kind: 'num', unit: '\u20B9', dp: 2,
  pick: (C, R) => { const e = C.pickEmp(R, () => true); if (!e) return null; return { name: _fN(e), P: C.choice(R, [30000, 45000, 60000, 75000, 90000]), r: C.choice(R, [9, 10.5, 12]), n: C.choice(R, [6, 10, 12, 18]) }; },
  subj: p => `Salary advance for ${p.name}`,
  body: p => `${p.name} has been sanctioned a salary advance of ${_inr(p.P)}, recoverable in ${p.n} equal monthly instalments at ${p.r}% interest per year (reducing balance, interest charged monthly). What will each monthly instalment be? Two decimals.`,
  ans: (p) => WD.x.pmt(p.r / 100 / 12, p.n, p.P),
  nudge: 'It is a standard loan repayment calculation — rate per month, number of months, amount borrowed.' });

WT('P18', { ses: 'payroll', lvl: 1, src: ['Payroll'], req: ['pay'], from: 'sneha', kind: 'num', unit: 'employees',
  pick: () => ({}),
  subj: () => 'ESI-covered employees',
  body: () => `How many employees had ESI deducted in this run (ESI above zero)? The ESIC portal upload needs the head-count.`,
  ans: (p, C) => _cnt(C.PAY, r => r.esi > 0),
  nudge: 'Count the rows where the ESI figure is more than zero.' });

WT('P19', { ses: 'payroll', lvl: 3, src: ['Payroll'], req: ['pay'], from: 'director', kind: 'num', unit: '\u20B9',
  pick: (C) => (_cnt(C.PAY, r => r.gender === 'Male') >= 2 && _cnt(C.PAY, r => r.gender === 'Female') >= 2 ? {} : null),
  subj: () => 'Average pay gap between men and women',
  body: () => `What is the difference between the average Gross of male employees and the average Gross of female employees (male minus female), rounded to the nearest rupee? A negative figure means women earn more on average.`,
  ans: (p, C) => WD.x.round(WD.x.avg(C.PAY.filter(r => r.gender === 'Male').map(r => r.gross)) - WD.x.avg(C.PAY.filter(r => r.gender === 'Female').map(r => r.gross)), 0),
  nudge: 'Two group averages, one subtracted from the other.' });

WT('P20', { ses: 'payroll', lvl: 3, src: ['Payroll'], req: ['pay'], from: 'finance', kind: 'text',
  pick: (C) => (C.uniq(C.PAY.map(r => r.dept)).length >= 2 ? {} : null),
  subj: () => 'Costliest department',
  body: () => `Which department has the highest total Net Pay this month? Type the department name as it appears in the register.`,
  ans: (p, C) => { const m = {}; C.PAY.forEach(r => { m[r.dept] = (m[r.dept] || 0) + r.net; }); const mx = Math.max.apply(null, Object.values(m)); return Object.keys(m).filter(k => m[k] === mx); },
  nudge: 'Total the Net Pay per department first, then see which total is the largest.' });

/* ================= SESSION 12 — RECORDS AUDIT & DATA CLEAN-UP ================= */
WT('R01', { ses: 'records', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'audit', kind: 'num', unit: 'records',
  pick: (C) => (_cnt(C.E, e => !e.phone || String(e.phone).length < 10) >= 1 ? {} : null),
  subj: () => 'Incomplete phone numbers',
  body: () => `How many employee records have a Phone number that is missing or shorter than 10 digits? These need to be corrected before the HR system export.`,
  ans: (p, C) => _cnt(C.E, e => !e.phone || String(e.phone).length < 10),
  nudge: 'Check the length of the text in the Phone column, plus any blank cells.' });

WT('R02', { ses: 'records', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'audit', kind: 'num', unit: 'records',
  pick: (C) => (_cnt(C.E, e => !/^[A-Z]{5}\d{4}[A-Z]$/.test(e.pan || '')) >= 1 ? {} : null),
  subj: () => 'Invalid PAN formats',
  body: () => `A valid PAN is exactly 5 letters, then 4 digits, then 1 letter (e.g. ABCDE1234F) — 10 characters, no exceptions. How many employee records have a PAN that does NOT match this pattern (blank cells included)?`,
  ans: (p, C) => _cnt(C.E, e => !/^[A-Z]{5}\d{4}[A-Z]$/.test(e.pan || '')),
  nudge: 'You need to check the length and the pattern of the text, not just whether the cell is empty.' });

WT('R03', { ses: 'records', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'rohan', kind: 'text',
  pick: (C, R) => { const e = C.pickEmp(R, () => true); return e ? { first: e.first, last: e.last } : null; },
  subj: p => `Official email ID`,
  body: p => `HR needs to issue an official email ID for a new joiner named "${p.first} ${p.last}" (typed exactly like this, mixed case, extra thought not needed). The company format is firstname.lastname, all in lower case, followed by @dotoffice.in — with no spaces. Give me the email ID exactly as it should be created.`,
  ans: (p) => `${_lc(p.first)}.${_lc(p.last)}@dotoffice.in`,
  nudge: 'Join two pieces of text together and change the case of the letters — no formula needed for the @ part.' });

WT('R04', { ses: 'records', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'rohan', kind: 'text',
  pick: (C, R) => { const e = C.pickEmp(R, (e) => e.first || e.last); return e ? { first: e.first, last: e.last } : null; },
  subj: () => 'Employee ID initials check',
  body: p => `For the ID card, I need the initials of "${p.first} ${p.last}" — first letter of the first name and first letter of the last name, both capitals, no space or full stop between them (e.g. "Anil Kumar" \u2192 "AK").`,
  ans: (p) => (p.first[0] + p.last[0]).toUpperCase(),
  nudge: 'Take one character from each name and put them together in capitals.' });

WT('R05', { ses: 'records', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'audit', kind: 'num', unit: 'records',
  pick: (C, R) => { const dis = C.uniq(C.E.map(e => e.district)).filter(d => d && _cnt(C.E, e => e.district === d) >= 2); const d = C.choice(R, dis); return d ? { d } : null; },
  subj: p => `Staff strength — ${p.d} district`,
  body: p => `For the regional HR report, how many employees have their District recorded as ${p.d}?`,
  ans: (p, C) => _cnt(C.E, e => e.district === p.d),
  nudge: 'A straightforward count against one column.' });

WT('R06', { ses: 'records', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'audit', kind: 'num', unit: 'characters',
  pick: (C, R) => { const e = C.pickEmp(R, (e) => e.email && e.email.includes('@')); return e ? { email: e.email } : null; },
  subj: () => 'Email domain length check',
  body: p => `IT is validating email domains. In the address "${p.email}", how many characters come after the "@" symbol (count everything to the end, including any dots)?`,
  ans: (p) => p.email.length - p.email.indexOf('@') - 1,
  nudge: 'Find the position of the @ symbol, then work out how much text remains after it.' });

WT('R07', { ses: 'records', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'audit', kind: 'num', unit: 'records',
  pick: (C) => { const withDup = C.E.filter(e => _cnt(C.E, e2 => e2.phone === e.phone) >= 2 && e.phone); return withDup.length ? {} : null; },
  subj: () => 'Duplicate phone numbers',
  body: () => `Two employees cannot share the same contact number in a clean master. How many employee records share their Phone number with at least one other employee (count every such record, not just the extra copies)?`,
  ans: (p, C) => _cnt(C.E, e => e.phone && _cnt(C.E, e2 => e2.phone === e.phone) >= 2),
  nudge: 'For each row, check how many rows in total (including itself) share that same phone number.' });

WT('R08', { ses: 'records', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'audit', kind: 'num', unit: 'records',
  pick: (C, R) => { const b = C.choice(R, C.uniq(C.E.map(e => (e.bank || '').trim())).filter(b => b)); return b ? { b } : null; },
  subj: p => `Employees banking with ${p.b}`,
  body: p => `The finance team is checking NEFT batches by bank. How many employees have ${p.b} recorded as their Bank Name?`,
  ans: (p, C) => _cnt(C.E, e => (e.bank || '').trim() === p.b),
  nudge: 'Match the bank name exactly and count the matching rows.' });

WT('R09', { ses: 'records', lvl: 2, src: ['Inward Mail'], req: ['mail'], from: 'aditi', kind: 'num', unit: 'entries',
  pick: (C) => { const seen = {}; let dup = 0; C.IN.forEach(m => { const k = m.date + '|' + _lc(WD.x.trim(m.subject)) + '|' + m.from; seen[k] = (seen[k] || 0) + 1; }); Object.values(seen).forEach(n => { if (n >= 2) dup += n; }); return dup >= 1 ? {} : null; },
  subj: () => 'Duplicate mail-register entries',
  body: () => `The mailroom sometimes double-enters a letter that came in with the day\u2019s bundle. How many rows in the Inward Mail register are duplicates — same Date, same From, and the same Subject (ignore any extra spaces) as another row? Count every row involved, not just the repeat.`,
  ans: (p, C) => { const seen = {}; C.IN.forEach(m => { const k = m.date + '|' + _lc(WD.x.trim(m.subject)) + '|' + m.from; seen[k] = (seen[k] || 0) + 1; }); return C.IN.filter(m => seen[m.date + '|' + _lc(WD.x.trim(m.subject)) + '|' + m.from] >= 2).length; },
  nudge: 'Two rows are duplicates of each other when three fields together are identical — the Subject needs its extra spaces cleaned before comparing.' });

WT('R10', { ses: 'records', lvl: 1, src: ['Inward Mail'], req: ['mail'], from: 'aditi', kind: 'num', unit: 'letters',
  pick: (C) => (_cnt(C.IN, m => m.action === 'Pending') >= 1 ? {} : null),
  subj: () => 'Inward mail still pending',
  body: () => `How many entries in the Inward Mail register have Action still marked as Pending?`,
  ans: (p, C) => _cnt(C.IN, m => m.action === 'Pending'),
  nudge: 'Count rows matching one status value.' });

WT('R11', { ses: 'records', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'rohan', kind: 'text',
  pick: (C, R) => { const e = C.pickEmp(R, (e) => e.exp && e.exp.length > 3); return e ? { exp: e.exp, name: _fN(e) } : null; },
  subj: p => `Tidy up ${p.name}'s Experience field`,
  body: p => `The Experience field for ${p.name} currently reads: "${p.exp}" — with irregular spacing. Please give me it back with every run of extra spaces reduced to a single space, and no leading or trailing space, exactly as it should appear on the printed record.`,
  ans: (p) => WD.x.trim(p.exp),
  nudge: 'Excel has a function built exactly for cleaning up stray spaces in text.' });

WT('R12', { ses: 'records', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'rohan', kind: 'text',
  pick: (C, R) => { const e = C.pickEmp(R, (e) => e.desig); return e ? { desig: e.desig.toUpperCase() } : null; },
  subj: () => 'Fix the designation casing',
  body: p => `Someone entered a designation in capitals by mistake: "${p.desig}". Please give me it back in proper title case (first letter of each word capitalised, rest lower case), exactly as it should appear on the ID card.`,
  ans: (p) => WD.x.proper(p.desig.toLowerCase()),
  nudge: 'Excel has a text function that automatically capitalises the first letter of every word.' });

WT('R13', { ses: 'records', lvl: 3, src: ['Employees'], req: ['emp8'], from: 'audit', kind: 'num', unit: 'records',
  pick: (C) => { const dups = C.E.filter(e => _cnt(C.E, e2 => _lc(e2.first) === _lc(e.first) && _lc(e2.last) === _lc(e.last)) >= 2); return dups.length ? {} : null; },
  subj: () => 'Possible duplicate employee entries',
  body: () => `Two records with the exact same First Name and Last Name (regardless of case) suggest a duplicate entry into the system. How many employee records fall into such a duplicate pair or group?`,
  ans: (p, C) => _cnt(C.E, e => _cnt(C.E, e2 => _lc(e2.first) === _lc(e.first) && _lc(e2.last) === _lc(e.last)) >= 2),
  nudge: 'For each row, count how many rows (itself included) share the same first and last name, ignoring case.' });

WT('R14', { ses: 'records', lvl: 2, src: ['Grievances'], req: ['griev'], from: 'meera', kind: 'num', unit: 'cases',
  pick: (C, R) => { const c = C.choice(R, C.uniq(C.GRV.map(g => g.cat)).filter(c => c && _cnt(C.GRV, g => g.cat === c) >= 2)); return c ? { c } : null; },
  subj: p => `Open cases — ${p.c}`,
  body: p => `For the HR dashboard: how many grievances under the category "${p.c}" are still Open or In Progress (i.e. not yet Resolved or Closed)?`,
  ans: (p, C) => _cnt(C.GRV, g => g.cat === p.c && (g.status === 'Open' || g.status === 'In Progress')),
  nudge: 'Two different statuses both count — the category has to match too.' });

WT('R15', { ses: 'records', lvl: 2, src: ['Visitors'], req: ['vis'], from: 'aditi', kind: 'num', unit: 'entries',
  pick: (C) => (_cnt(C.VIS, v => WD.x.trim(_lc(v.company)) === '') === 0 && C.VIS.length ? {} : null),
  subj: () => 'Front desk company-name clean-up',
  body: () => `Companies have been typed inconsistently in the visitor log (extra spaces, mixed case). After trimming spaces and ignoring case, how many DIFFERENT companies actually appear in the Visitor Log?`,
  ans: (p, C) => C.uniq(C.VIS.map(v => _lc(WD.x.trim(v.company)))).length,
  nudge: 'Clean the text first — trim and lower-case it — then count how many distinct values remain.' });

/* ================= SESSION 13 — SERVICE RECORDS, MILESTONES & COMPLIANCE ================= */
WT('D01', { ses: 'dates', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'rohan', kind: 'num', unit: 'years',
  pick: (C, R) => { const e = C.pickEmp(R, e => e.join); return e ? { id: e.id, name: _fN(e), join: e.join } : null; },
  subj: p => `Completed years of service — ${p.name}`,
  body: p => `${p.name} (${p.id}) is asking how many FULL years they have completed with us as of today (${WD.dt.human(WD.dt.today())}). Part of a year does not count.`,
  ans: (p) => WD.dt.datedif(p.join, WD.dt.today(), 'Y'),
  nudge: 'A years-between-dates calculation, rounded down to only completed years.' });

WT('D02', { ses: 'dates', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'rohan', kind: 'text',
  pick: (C, R) => { const e = C.pickEmp(R, e => e.join); return e ? { id: e.id, name: _fN(e), join: e.join } : null; },
  subj: p => `Service duration in words — ${p.name}`,
  body: p => `For ${p.name}\u2019s (${p.id}) service certificate, I need the tenure expressed as "X years and Y months" as of today. Type it exactly in that form, e.g. "4 years and 7 months" (use "0 years" or "0 months" where applicable, and always include both parts).`,
  ans: (p) => { const y = WD.dt.datedif(p.join, WD.dt.today(), 'Y'), m = WD.dt.datedif(p.join, WD.dt.today(), 'YM'); return [`${y} years and ${m} months`, `${y} year${y===1?'':'s'} and ${m} month${m===1?'':'s'}`]; },
  nudge: 'Two separate calculations — completed years, and the leftover completed months — then combine the text.' });

WT('D03', { ses: 'dates', lvl: 2, src: ['Employees', 'Service Award Policy'], req: ['emp8'], from: 'meera', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const e = C.pickEmp(R, e => WD.dt.datedif(e.join, WD.dt.today(), 'Y') >= 3); return e ? { id: e.id, name: _fN(e), join: e.join } : null; },
  subj: p => `Long-service award — ${p.name}`,
  body: p => `Using the Service Award Policy sheet and ${p.name}\u2019s (${p.id}) completed years of service as of today, what long-service award is ${p.name} entitled to?`,
  ans: (p, C) => WD.approxLookup(WD.SERVICE_AWARD, WD.dt.datedif(p.join, WD.dt.today(), 'Y'))[1],
  nudge: 'Work out completed years first, then find which award band that falls into on the policy sheet — the nearest one at or below.' });

WT('D04', { ses: 'dates', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'rohan', kind: 'date',
  pick: (C, R) => { const e = C.pickEmp(R, e => e.join); return e ? { id: e.id, name: _fN(e), join: e.join } : null; },
  subj: p => `Probation end date — ${p.name}`,
  body: p => `${p.name} (${p.id}) joined on ${WD.dt.human(p.join)}. Probation is exactly 6 months. What is the probation end date?`,
  ans: (p) => WD.dt.edate(p.join, 6),
  nudge: 'Add a fixed number of months to the joining date.' });

WT('D05', { ses: 'dates', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'meera', kind: 'date',
  pick: (C, R) => { const e = C.pickEmp(R, e => e.dob); return e ? { id: e.id, name: _fN(e), dob: e.dob } : null; },
  subj: p => `Retirement date — ${p.name}`,
  body: p => `Company retirement age is 58, effective on the last day of the month in which the employee turns 58. ${p.name}\u2019s (${p.id}) date of birth is ${WD.dt.human(p.dob)}. What is the retirement date?`,
  ans: (p) => WD.dt.eomonth(WD.dt.edate(p.dob, 58 * 12), 0),
  nudge: 'Add 58 years to the birth date, then move to the last day of that month.' });

WT('D06', { ses: 'dates', lvl: 3, src: ['Employees'], req: ['emp8'], from: 'meera', kind: 'num', unit: 'employees',
  pick: (C, R) => { const y = C.choice(R, [3, 5, 10]); return { y }; },
  subj: p => `Employees crossing ${p.y} years this year`,
  body: p => `How many employees will complete exactly ${p.y} years of service (their service anniversary) at some point during ${WD.dt.today().slice(0, 4)}?`,
  ans: (p, C) => _cnt(C.E, e => { const j = WD.dt.parse(e.join); if (!j) return false; return j.y + p.y === +WD.dt.today().slice(0, 4); }),
  nudge: 'Find each employee\u2019s joining year, add the milestone, and see whose total lands on the current year.' });

WT('D07', { ses: 'dates', lvl: 1, src: ['Employees'], req: ['emp8'], from: 'meera', kind: 'num', unit: 'employees',
  pick: (C, R) => { const m = C.choice(R, [1, 2, 3, 4]); return { m, name: WD.dt.monthName(m) }; },
  subj: p => `Birthdays in ${p.name}`,
  body: p => `HR sends birthday cards a week in advance. How many employees have their Date of Birth falling in the month of ${p.name} (any year)?`,
  ans: (p, C) => _cnt(C.E, e => e.dob && WD.dt.parse(e.dob).m === p.m),
  nudge: 'Only the month part of the date matters here, not the year.' });

WT('D08', { ses: 'dates', lvl: 2, src: ['Vendors'], req: ['vend'], from: 'vikram', kind: 'num', unit: 'contracts',
  pick: (C) => ({}),
  subj: () => 'Contracts expiring in the next 30 days',
  body: () => `Procurement needs advance notice. As of today (${WD.dt.human(WD.dt.today())}), how many vendor contracts have their Contract End date within the next 30 days (today counts as day 0, so up to and including today+30)?`,
  ans: (p, C) => { const t = WD.dt.ser(WD.dt.today()); return _cnt(C.VND, v => { const s = WD.dt.ser(v.end); return s >= t && s <= t + 30; }); },
  nudge: 'Work out today\u2019s date plus 30 days, then count contracts whose end date falls between today and that date.' });

WT('D09', { ses: 'dates', lvl: 2, src: ['Vendors'], req: ['vend'], from: 'vikram', kind: 'num', unit: 'contracts',
  pick: (C) => (_cnt(C.VND, v => WD.dt.ser(v.end) < WD.dt.ser(WD.dt.today())) >= 1 ? {} : null),
  subj: () => 'Already-expired contracts',
  body: () => `How many vendor contracts have already passed their Contract End date as of today, and are still showing in the tracker unrenewed?`,
  ans: (p, C) => _cnt(C.VND, v => WD.dt.ser(v.end) < WD.dt.ser(WD.dt.today())),
  nudge: 'Compare the end date of each contract with today\u2019s date.' });

WT('D10', { ses: 'dates', lvl: 3, src: ['Vendors'], req: ['vend'], from: 'audit', kind: 'text',
  pick: (C, R) => { const c = C.choice(R, C.uniq(C.VND.map(v => v.cat))); return c ? { c } : null; },
  subj: p => `Nearest renewal — ${p.c}`,
  body: p => `Among all vendors under the "${p.c}" category, which one has the nearest (soonest) Contract End date from today? Type the vendor name.`,
  ans: (p, C) => { const rows = C.VND.filter(v => v.cat === p.c && WD.dt.ser(v.end) >= WD.dt.ser(WD.dt.today())); if (!rows.length) return null; const mn = Math.min.apply(null, rows.map(v => WD.dt.ser(v.end))); return rows.filter(v => WD.dt.ser(v.end) === mn).map(v => v.name); },
  nudge: 'Filter to that category, then find whichever contract end date is closest to today (and not already past).' });

WT('D11', { ses: 'dates', lvl: 2, src: ['Employees'], req: ['emp8'], from: 'rohan', kind: 'text',
  pick: (C, R) => { const e = C.pickEmp(R, e => e.join); return e ? { id: e.id, name: _fN(e), join: e.join } : null; },
  subj: p => `Confirmation letter wording — ${p.name}`,
  body: p => `The confirmation letter template needs the joining date written out in full, e.g. "3rd June 2023". ${p.name}\u2019s (${p.id}) joining date is stored as ${p.join}. Type it out in the required format (use st/nd/rd/th correctly for the day).`,
  ans: (p) => { const d = WD.dt.parse(p.join); const suf = (n) => (n % 10 === 1 && n !== 11) ? 'st' : (n % 10 === 2 && n !== 12) ? 'nd' : (n % 10 === 3 && n !== 13) ? 'rd' : 'th'; return `${d.d}${suf(d.d)} ${WD.dt.monthName(d.m)} ${d.y}`; },
  nudge: 'Excel can format a date any way you like, including spelling out the month and adding the correct suffix.' });

WT('D12', { ses: 'dates', lvl: 1, src: ['Room Bookings'], req: ['room'], from: 'aditi', kind: 'num', unit: 'minutes',
  pick: (C, R) => { const b = C.choice(R, C.RB); return b ? { id: b.id, start: b.start, end: b.end, title: b.title } : null; },
  subj: () => 'Meeting duration check',
  body: p => `Booking ${p.id} ("${p.title}") is logged from ${p.start} to ${p.end}. How many minutes long is that meeting?`,
  ans: (p) => Math.round((WD.timeFrac(p.end) - WD.timeFrac(p.start)) * 1440),
  nudge: 'Subtract the start time from the end time, and convert the result into minutes.' });

WT('D13', { ses: 'dates', lvl: 3, src: ['Employees'], req: ['emp8'], from: 'meera', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const e = C.pickEmp(R, e => WD.dt.datedif(e.join, WD.dt.today(), 'Y') >= 0); return e ? { id: e.id, name: _fN(e), join: e.join, basic: e.basic } : null; },
  subj: p => `Annual increment — ${p.name}`,
  body: p => `Using ${p.name}\u2019s (${p.id}) completed years of service as of today and the Increment Policy sheet, what is the increment AMOUNT they are due on their current Basic of ${_inr(p.basic)}? Round to the nearest rupee.`,
  ans: (p, C) => WD.x.round(p.basic * WD.approxLookup(WD.INCREMENT_POLICY, WD.dt.datedif(p.join, WD.dt.today(), 'Y'))[1], 0),
  nudge: 'Find the applicable percentage from the policy band for that many completed years, then apply it to the Basic.' });

/* ================= SESSION 14 — ADMIN SPEND, STOCK & PROCUREMENT ================= */
WT('S01', { ses: 'spend', lvl: 1, src: ['Petty Cash'], req: ['petty'], from: 'sneha', kind: 'num', unit: '\u20B9',
  pick: () => ({}),
  subj: () => 'Petty cash balance',
  body: () => `What is the current petty cash balance — the Balance figure on the most recent voucher in the Petty Cash Book?`,
  ans: (p, C) => C.PC.length ? C.PC[C.PC.length - 1].bal : null,
  nudge: 'The register keeps a running balance — you want the very last one, by date.' });

WT('S02', { ses: 'spend', lvl: 1, src: ['Petty Cash'], req: ['petty'], from: 'sneha', kind: 'num', unit: '\u20B9',
  pick: () => ({}),
  subj: () => 'Total petty cash paid out this period',
  body: () => `What is the total of all Payment-type entries in the Petty Cash Book (ignore Receipt entries)?`,
  ans: (p, C) => _sumBy(C.PC, v => v.type === 'Payment', 'amount'),
  nudge: 'Total the Amount column, but only for one type of entry.' });

WT('S03', { ses: 'spend', lvl: 2, src: ['Petty Cash'], req: ['petty'], from: 'audit', kind: 'num', unit: 'vouchers',
  pick: (C, R) => { const t = C.choice(R, [500, 1000, 1500, 2000]); return _cnt(C.PC, v => v.type === 'Payment' && v.amount > t) >= 1 ? { t } : null; },
  subj: p => `Payments above ${_inr(p.t)} — sample check`,
  body: p => `For the internal audit sample, how many petty cash Payment vouchers are for an amount above ${_inr(p.t)}?`,
  ans: (p, C) => _cnt(C.PC, v => v.type === 'Payment' && v.amount > p.t),
  nudge: 'Two conditions on the same rows: the type of entry, and the amount.' });

WT('S04', { ses: 'spend', lvl: 2, src: ['Petty Cash'], req: ['petty'], from: 'sneha', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const kw = C.choice(R, ['Courier', 'Tea', 'Stationery', 'Conveyance', 'Xerox', 'Printer']); return _cnt(C.PC, v => _lc(v.part).includes(_lc(kw))) >= 1 ? { kw } : null; },
  subj: p => `Spend on "${p.kw}"`,
  body: p => `We are categorising petty-cash spend. Total up all Payment amounts where Particulars mentions "${p.kw}" anywhere in the text.`,
  ans: (p, C) => _sumBy(C.PC, v => v.type === 'Payment' && _lc(v.part).includes(_lc(p.kw)), 'amount'),
  nudge: 'A partial text match inside the Particulars column decides which rows to total.' });

WT('S05', { ses: 'spend', lvl: 1, src: ['Stock Register'], req: ['stock'], from: 'suresh', kind: 'num', unit: 'items',
  pick: () => ({}),
  subj: () => 'Items below reorder level',
  body: () => `How many items in the Stock Register have Current Stock at or below their Reorder Level? These need a purchase requisition raised today.`,
  ans: (p, C) => _cnt(C.STK, s => s.stock <= s.reorder),
  nudge: 'Compare two columns of the same row against each other, for every row.' });

WT('S06', { ses: 'spend', lvl: 1, src: ['Stock Register'], req: ['stock'], from: 'suresh', kind: 'text',
  pick: (C, R) => { const c = C.choice(R, C.uniq(C.STK.map(s => s.cat))); return c ? { c } : null; },
  subj: p => `Lowest-stock item — ${p.c}`,
  body: p => `Within the "${p.c}" category, which item currently has the least Current Stock? Type the item name.`,
  ans: (p, C) => { const rows = C.STK.filter(s => s.cat === p.c); const mn = WD.x.min(rows.map(s => s.stock)); return rows.filter(s => s.stock === mn).map(s => s.name); },
  nudge: 'Filter to the category, then find the smallest stock figure within it.' });

WT('S07', { ses: 'spend', lvl: 2, src: ['Stock Transactions'], req: ['stock'], from: 'suresh', kind: 'num', unit: 'units',
  pick: (C, R) => { const it = C.choice(R, C.uniq(C.STX.map(t => t.item))); return it ? { it } : null; },
  subj: p => `Total issued — ${p.it}`,
  body: p => `Across the whole Stock Movements log, how many units of "${p.it}" have been issued out (Stock Out entries only) in total?`,
  ans: (p, C) => _sumBy(C.STX, t => t.item === p.it && t.type === 'Stock Out', 'qty'),
  nudge: 'Filter by item name and by movement type, then total the quantities.' });

WT('S08', { ses: 'spend', lvl: 2, src: ['Purchase Requisitions', 'Quotations'], req: ['proc'], from: 'vikram', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const r = C.choice(R, C.REQ.filter(r => C.QT.filter(q => q.ref === r.ref).length >= 2)); return r ? { ref: r.ref, item: r.item } : null; },
  subj: p => `Lowest quotation — ${p.ref}`,
  body: p => `For requisition ${p.ref} (${p.item}), what is the lowest Quoted Amount received among all the vendor quotations for that requisition?`,
  ans: (p, C) => WD.x.min(C.QT.filter(q => q.ref === p.ref).map(q => q.amount)),
  nudge: 'Filter the quotations to that one requisition reference, then find the smallest amount.' });

WT('S09', { ses: 'spend', lvl: 2, src: ['Purchase Requisitions', 'Quotations'], req: ['proc'], from: 'vikram', kind: 'text',
  pick: (C, R) => { const r = C.choice(R, C.REQ.filter(r => C.QT.filter(q => q.ref === r.ref).length >= 2)); return r ? { ref: r.ref, item: r.item } : null; },
  subj: p => `Which vendor quoted lowest — ${p.ref}`,
  body: p => `For requisition ${p.ref} (${p.item}), which vendor gave the lowest quotation? Type the vendor name exactly.`,
  ans: (p, C) => { const rows = C.QT.filter(q => q.ref === p.ref); const mn = WD.x.min(rows.map(q => q.amount)); return rows.filter(q => q.amount === mn).map(q => q.vendor); },
  nudge: 'Find the lowest quoted amount for that requisition, then look up which vendor it belongs to.' });

WT('S10', { ses: 'spend', lvl: 1, src: ['Purchase Requisitions'], req: ['proc'], from: 'vikram', kind: 'num', unit: 'requisitions',
  pick: () => ({}),
  subj: () => 'Requisitions awaiting quotations',
  body: () => `How many purchase requisitions still have Status "Pending" (no quotations added yet)?`,
  ans: (p, C) => _cnt(C.REQ, r => r.status === 'Pending'),
  nudge: 'Count rows matching one status.' });

WT('S11', { ses: 'spend', lvl: 2, src: ['Purchase Requisitions'], req: ['proc'], from: 'vikram', kind: 'num', unit: 'requisitions',
  pick: (C, R) => { const d = C.choice(R, C.uniq(C.REQ.map(r => r.dept)).filter(d => d && _cnt(C.REQ, r => r.dept === d) >= 2)); return d ? { d } : null; },
  subj: p => `Requisitions raised by ${p.d}`,
  body: p => `How many purchase requisitions in total have been raised by the ${p.d} department (any status)?`,
  ans: (p, C) => _cnt(C.REQ, r => r.dept === p.d),
  nudge: 'Count rows matching one department.' });

WT('S12', { ses: 'spend', lvl: 2, src: ['Travel Claims'], req: ['trav'], from: 'sneha', kind: 'num', unit: '\u20B9',
  pick: () => ({}),
  subj: () => 'Total travel reimbursement payable',
  body: () => `What is the total Net Payable across all travel claims currently on file?`,
  ans: (p, C) => WD.x.sum(C.TRV.map(t => t.net)),
  nudge: 'A single-column total.' });

WT('S13', { ses: 'spend', lvl: 2, src: ['Travel Claims'], req: ['trav'], from: 'sneha', kind: 'num', unit: 'claims',
  pick: (C, R) => { const m = C.choice(R, C.uniq(C.TRV.map(t => t.mode))); return m ? { m } : null; },
  subj: p => `Claims for ${p.m} travel`,
  body: p => `For the travel-policy review: how many travel claims have Mode recorded as ${p.m}?`,
  ans: (p, C) => _cnt(C.TRV, t => t.mode === p.m),
  nudge: 'Count rows matching one travel mode.' });

WT('S14', { ses: 'spend', lvl: 3, src: ['Travel Claims', 'Expense Items'], req: ['trav'], from: 'sneha', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const c = C.choice(R, C.uniq(C.EXI.map(x => x.cat))); return c ? { c } : null; },
  subj: p => `Total spend on ${p.c}`,
  body: p => `Across all travel claims, what is the total amount claimed under the "${p.c}" expense category?`,
  ans: (p, C) => _sumBy(C.EXI, x => x.cat === p.c, 'amount'),
  nudge: 'The expense categories are broken out in a separate line-items sheet, not the claims sheet itself.' });

WT('S15', { ses: 'spend', lvl: 2, src: ['Employees', 'Rate Card'], req: ['emp8'], from: 'suresh', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const e = C.pickEmp(R, () => true); if (!e) return null; return { name: _fN(e), desig: e.desig, nights: C.choice(R, [2, 3, 4, 5]) }; },
  subj: p => `Lodging entitlement — ${p.name}`,
  body: p => `${p.name} (Designation: ${p.desig}) is travelling for ${p.nights} nights. Using the Grade Master and the Rate Card, what is the maximum total lodging amount ${p.name} can claim (Lodging Cap per night \u00d7 number of nights)?`,
  ans: (p, C) => { const grade = WD.GRADE_RULES(p.desig); const row = WD.RATE_CARD.find(r => r[0] === grade); return row[2] * p.nights; },
  nudge: 'First work out the grade for that designation, then look up that grade\u2019s lodging cap and multiply by the nights.' });

/* ================= SESSION 15 — FACILITIES, FRONT DESK & SERVICE LEVELS ================= */
WT('V01', { ses: 'service', lvl: 1, src: ['Maintenance Tickets'], req: ['maint'], from: 'suresh', kind: 'num', unit: 'tickets',
  pick: () => ({}),
  subj: () => 'Open maintenance tickets',
  body: () => `How many maintenance tickets are currently NOT Resolved and NOT Closed (i.e. still open in some form)?`,
  ans: (p, C) => _cnt(C.MT, t => t.status !== 'Resolved' && t.status !== 'Closed'),
  nudge: 'This is everything except two particular status values — an exclusion, not a single match.' });

WT('V02', { ses: 'service', lvl: 1, src: ['Maintenance Tickets'], req: ['maint'], from: 'suresh', kind: 'num', unit: 'tickets',
  pick: (C, R) => { const c = C.choice(R, C.uniq(C.MT.map(t => t.cat))); return c ? { c } : null; },
  subj: p => `${p.c} tickets logged`,
  body: p => `How many maintenance tickets in total fall under the "${p.c}" category?`,
  ans: (p, C) => _cnt(C.MT, t => t.cat === p.c),
  nudge: 'Count rows matching one category.' });

WT('V03', { ses: 'service', lvl: 2, src: ['Maintenance Tickets'], req: ['maint'], from: 'suresh', kind: 'num', unit: 'tickets',
  pick: () => ({}),
  subj: () => 'Urgent tickets outstanding',
  body: () => `How many tickets marked Priority "Urgent" are still not Resolved or Closed? These need to be escalated today.`,
  ans: (p, C) => _cnt(C.MT, t => t.priority === 'Urgent' && t.status !== 'Resolved' && t.status !== 'Closed'),
  nudge: 'Two conditions together: the priority level, and the ticket not yet being closed out.' });

WT('V04', { ses: 'service', lvl: 2, src: ['Maintenance Tickets'], req: ['maint'], from: 'suresh', kind: 'num', unit: 'days', dp: 1,
  pick: (C) => (_cnt(C.MT, t => t.resolved) >= 2 ? {} : null),
  subj: () => 'Average turnaround time',
  body: () => `For tickets that have been Resolved or Closed, what is the average number of days between Date Reported and Date Resolved? One decimal place.`,
  ans: (p, C) => WD.x.avg(C.MT.filter(t => t.resolved).map(t => WD.dt.ser(t.resolved) - WD.dt.ser(t.reported))),
  nudge: 'Work out the gap in days for each resolved ticket, then average those gaps.' });

WT('V05', { ses: 'service', lvl: 2, src: ['Maintenance Tickets'], req: ['maint'], from: 'suresh', kind: 'text',
  pick: (C) => (C.uniq(C.MT.map(t => t.loc)).length >= 3 ? {} : null),
  subj: () => 'Location raising the most tickets',
  body: () => `Which Location has the highest number of maintenance tickets logged against it? Type the location name exactly.`,
  ans: (p, C) => { const m = {}; C.MT.forEach(t => { m[t.loc] = (m[t.loc] || 0) + 1; }); const mx = Math.max.apply(null, Object.values(m)); return Object.keys(m).filter(k => m[k] === mx); },
  nudge: 'Count tickets per location, then find which location has the highest count.' });

WT('V06', { ses: 'service', lvl: 1, src: ['Visitors'], req: ['vis'], from: 'aditi', kind: 'num', unit: 'visitors',
  pick: (C, R) => { const d = C.choice(R, C.uniq(C.VIS.map(v => v.date))); return d ? { d } : null; },
  subj: p => `Footfall on ${WD.dt.human(p.d)}`,
  body: p => `Security wants the visitor count for ${WD.dt.dayName(p.d)}, ${WD.dt.human(p.d)}. How many visitor entries are logged for that date?`,
  ans: (p, C) => _cnt(C.VIS, v => v.date === p.d),
  nudge: 'Count rows matching one date.' });

WT('V07', { ses: 'service', lvl: 2, src: ['Visitors'], req: ['vis'], from: 'aditi', kind: 'num', unit: 'minutes', dp: 0,
  pick: (C, R) => { const v = C.choice(R, C.VIS.filter(v => v.out)); return v ? { badge: v.badge, name: v.name, in: v.in, out: v.out } : null; },
  subj: () => 'How long did the visitor stay?',
  body: p => `Visitor badge ${p.badge} (${p.name}) signed in at ${p.in} and signed out at ${p.out}. How many minutes did the visit last?`,
  ans: (p) => Math.round((WD.timeFrac(p.out) - WD.timeFrac(p.in)) * 1440),
  nudge: 'Subtract the sign-in time from the sign-out time, then convert to minutes.' });

WT('V08', { ses: 'service', lvl: 2, src: ['Visitors'], req: ['vis'], from: 'aditi', kind: 'num', unit: 'visitors',
  pick: (C, R) => { const e = C.pickEmp(R, () => true); if (!e) return null; const cnt = _cnt(C.VIS, v => v.whom === e.id); return cnt >= 1 ? { id: e.id, name: _fN(e) } : null; },
  subj: p => `Visitors received by ${p.name}`,
  body: p => `For the front-office monthly report: how many visitor entries record "Whom To Meet" as ${p.name} (${p.id})?`,
  ans: (p, C) => _cnt(C.VIS, v => v.whom === p.id),
  nudge: 'Count rows where that one column matches the employee.' });

WT('V09', { ses: 'service', lvl: 1, src: ['Room Bookings'], req: ['room'], from: 'aditi', kind: 'num', unit: 'bookings',
  pick: (C, R) => { const r = C.choice(R, C.uniq(C.RB.map(b => b.room))); return r ? { r } : null; },
  subj: p => `Usage of ${p.r}`,
  body: p => `How many bookings in total are recorded for ${p.r}?`,
  ans: (p, C) => _cnt(C.RB, b => b.room === p.r),
  nudge: 'Count rows matching one room.' });

WT('V10', { ses: 'service', lvl: 3, src: ['Room Bookings'], req: ['room'], from: 'aditi', kind: 'num', unit: 'hours', dp: 1,
  pick: (C, R) => { const r = C.choice(R, C.uniq(C.RB.map(b => b.room))); return r ? { r } : null; },
  subj: p => `Total hours booked — ${p.r}`,
  body: p => `For the utilisation report, what is the total number of hours ${p.r} has been booked for, across every booking on file? One decimal place.`,
  ans: (p, C) => WD.x.round(WD.x.sum(C.RB.filter(b => b.room === p.r).map(b => (WD.timeFrac(b.end) - WD.timeFrac(b.start)) * 24)), 1),
  nudge: 'Work out the duration of each booking in that room, then add all the durations together.' });

WT('V11', { ses: 'service', lvl: 2, src: ['Grievances'], req: ['griev'], from: 'meera', kind: 'num', unit: 'days', dp: 1,
  pick: (C) => (_cnt(C.GRV, g => g.resolved) >= 2 ? {} : null),
  subj: () => 'Average grievance resolution time',
  body: () => `For grievances that have been Resolved or Closed, what is the average number of days from Date Filed to Resolved Date? One decimal place.`,
  ans: (p, C) => WD.x.round(WD.x.avg(C.GRV.filter(g => g.resolved).map(g => WD.dt.ser(g.resolved) - WD.dt.ser(g.filed))), 1),
  nudge: 'Work out how many days each resolved case took, then average those figures.' });

WT('V12', { ses: 'service', lvl: 1, src: ['Outward Mail'], req: ['mail'], from: 'aditi', kind: 'num', unit: 'items',
  pick: () => ({}),
  subj: () => 'Dispatches without a tracking number',
  body: () => `How many entries in the Outward Mail register have no Tracking No recorded at all?`,
  ans: (p, C) => _cnt(C.OUT, m => !m.tracking),
  nudge: 'Count the blank cells in one column.' });

WT('V13', { ses: 'service', lvl: 2, src: ['Assets'], req: ['asset'], from: 'arjun', kind: 'num', unit: 'assets',
  pick: (C, R) => { const c = C.choice(R, C.uniq(C.AST.map(a => a.cat))); return c ? { c } : null; },
  subj: p => `Assets issued — ${p.c}`,
  body: p => `For the IT asset audit: how many assets under the category "${p.c}" currently have Status "Issued"?`,
  ans: (p, C) => _cnt(C.AST, a => a.cat === p.c && a.status === 'Issued'),
  nudge: 'Two conditions on the same rows: category and status.' });

WT('V14', { ses: 'service', lvl: 2, src: ['Assets'], req: ['asset'], from: 'arjun', kind: 'text',
  pick: (C, R) => { const e = C.pickEmp(R, () => true); if (!e) return null; const has = _cnt(C.AST, a => a.assignedTo === e.id); return has >= 1 ? { id: e.id, name: _fN(e) } : null; },
  subj: p => `Assets issued to ${p.name}`,
  body: p => `IT is doing a spot-check. Which asset(s) are currently assigned to ${p.name} (${p.id})? If there is more than one, name all of them.`,
  ans: (p, C) => { const rows = C.AST.filter(a => a.assignedTo === p.id); return rows.map(a => a.name); },
  nudge: 'Filter the Assets sheet by the person\u2019s ID in the Assigned To column.' });

/* ================= SESSION 16 — YEAR-END REVIEW PACK (ADVANCED) ================= */
WT('Y01', { ses: 'yearend', lvl: 3, src: ['Employees', 'Leave Register'], req: ['emp8', 'leave10'], from: 'director', kind: 'text',
  pick: (C, R) => { const d = C.pickDept(R, 3); return d ? { d } : null; },
  subj: p => `Most leave-days taken — ${p.d}`,
  body: p => `Within the ${p.d} department, which employee has taken the most total approved leave days this year? Type the name.`,
  ans: (p, C) => { const ids = C.E.filter(e => e.dept === p.d).map(e => e.id); const tot = {}; ids.forEach(id => { tot[id] = _sumBy(C.LV, l => l.empId === id && l.status === 'Approved', 'days'); }); const mx = Math.max.apply(null, Object.values(tot).concat([0])); if (mx === 0) return null; const winners = Object.keys(tot).filter(id => tot[id] === mx); return winners.map(id => _fN(C.E.find(e => e.id === id))); },
  nudge: 'This spans two sheets: find who belongs to the department on the Employee Master, then total their approved leave from the Leave Register.' });

WT('Y02', { ses: 'yearend', lvl: 3, src: ['Employees', 'Payroll'], req: ['emp8', 'pay'], from: 'finance', kind: 'num', unit: '\u20B9',
  pick: (C, R) => { const d = C.pickDept(R, 3); return d ? { d } : null; },
  subj: p => `Payroll cost vs sanctioned budget — ${p.d}`,
  body: p => `Take this month\u2019s total Net Pay for the ${p.d} department from the Payroll Register, and compare it against 12 times that department\u2019s total Monthly Salary on the Employee Master (the annual sanctioned figure). What is the difference (annual sanctioned minus twelve times this month\u2019s net pay)?`,
  ans: (p, C) => 12 * _sumBy(C.E, e => e.dept === p.d, 'gross') - 12 * _sumBy(C.PAY, r => r.dept === p.d, 'net'),
  nudge: 'Two totals from two different sheets, each multiplied by 12, then subtracted.' });

WT('Y03', { ses: 'yearend', lvl: 3, src: ['Employees', 'Assets'], req: ['emp8', 'asset'], from: 'arjun', kind: 'num', unit: 'employees',
  pick: (C, R) => { const d = C.pickDept(R, 3, e => e.status === 'Active'); return d ? { d } : null; },
  subj: p => `Active staff with no asset issued — ${p.d}`,
  body: p => `IT is closing gaps before the audit. In the ${p.d} department, how many Active employees currently have NO asset assigned to them at all (they do not appear as "Assigned To" on the Assets sheet)?`,
  ans: (p, C) => { const withAsset = new Set(C.AST.filter(a => a.status === 'Issued').map(a => a.assignedTo)); return _cnt(C.E, e => e.dept === p.d && e.status === 'Active' && !withAsset.has(e.id)); },
  nudge: 'Build the list of active people in the department, then remove anyone whose ID shows up on the Assets sheet.' });

WT('Y04', { ses: 'yearend', lvl: 3, src: ['Leave Register', 'Attendance'], req: ['leave10', 'att'], from: 'audit', kind: 'num', unit: 'employees',
  pick: () => ({}),
  subj: () => 'Attendance vs leave mismatch',
  body: () => `Cross-check needed: how many employees have at least one Absent (A) mark in the Attendance sheet on a date that also falls inside one of their OWN approved leave applications (which should have been marked L, not A)?`,
  ans: (p, C) => { let n = 0; C.ATT.forEach(r => { const mine = _approved(C).filter(l => l.empId === r.id); const bad = r.codes.some((c, i) => c === 'A' && mine.some(l => l.from <= C.days[i] && l.to >= C.days[i])); if (bad) n++; }); return n; },
  nudge: 'For each person, check their Absent dates against the date ranges of their own approved leave — an overlap is the error you are looking for.' });

WT('Y05', { ses: 'yearend', lvl: 3, src: ['Employees', 'Payroll'], req: ['emp8', 'pay'], from: 'director', kind: 'text',
  pick: () => ({}),
  subj: () => 'Department with the best net-to-gross ratio',
  body: () => `Comparing every department on the Payroll Register, which one has the highest ratio of total Net Pay to total Gross (i.e. proportionally the least eaten up by deductions)? Type the department name.`,
  ans: (p, C) => { const depts = C.uniq(C.PAY.map(r => r.dept)); const ratio = {}; depts.forEach(d => { const g = _sumBy(C.PAY, r => r.dept === d, 'gross'); ratio[d] = g ? _sumBy(C.PAY, r => r.dept === d, 'net') / g : 0; }); const mx = Math.max.apply(null, Object.values(ratio)); return depts.filter(d => ratio[d] === mx); },
  nudge: 'Work out each department\u2019s Net-to-Gross ratio separately, then compare the ratios, not the raw totals.' });
