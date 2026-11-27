/* ============================================================
   SKELORA — HR & Payroll ERP Training Simulator
   script.js — application shell + Phase 1: Job Vacancy Management

   Structure:
     1. Config & constants
     2. Storage helper (LocalStorage wrapper)
     3. Generic utilities
     4. Toast notifications
     5. Confirm dialog
     6. Theme (light/dark)
     7. Sidebar + Router (phase lock/unlock)
     8. Activity log + Notification center
     9. Dashboard rendering
    10. Phase 1: Job Vacancy Management module
    11. Global search
    12. Bootstrap / init
   ============================================================ */
'use strict';

/* ---------------------------------------------------------------
   1. CONFIG & CONSTANTS
--------------------------------------------------------------- */
const STORAGE_KEYS = {
  theme: 'skelora_theme',
  sidebarCollapsed: 'skelora_sidebar_collapsed',
  vacancies: 'skelora_vacancies',
  vacancyCounter: 'skelora_vacancy_counter',
  resumes: 'skelora_resumes',
  resumeCounter: 'skelora_resume_counter',
  screenings: 'skelora_screenings',
  screeningCounter: 'skelora_screening_counter',
  shortlists: 'skelora_shortlists',
  shortlistCounter: 'skelora_shortlist_counter',
  interviews: 'skelora_interview_rounds',
  selections: 'skelora_selections',
  offers: 'skelora_offers',
  offerCounter: 'skelora_offer_counter',
  joinings: 'skelora_joinings',
  joiningCounter: 'skelora_joining_counter',
  employees: 'skelora_employees',
  employeeCounter: 'skelora_employee_counter',
  attendance: 'skelora_attendance',
  leaves: 'skelora_leaves',
  leaveCounter: 'skelora_leave_counter',
  payroll: 'skelora_payroll',
  payrollCounter: 'skelora_payroll_counter',
  exits: 'skelora_exits',
  exitCounter: 'skelora_exit_counter',
  settlements: 'skelora_settlements',
  settlementCounter: 'skelora_settlement_counter',
  activityLog: 'skelora_activity_log',
  currentRoute: 'skelora_current_route',
  companySettings: 'skelora_company_settings',
  users: 'skelora_users',
  userCounter: 'skelora_user_counter',
  session: 'skelora_session',
  auditLog: 'skelora_audit_log',
  complianceLog: 'skelora_compliance_log',
  letters: 'skelora_letters',
  letterCounter: 'skelora_letter_counter'
};

const DEPARTMENTS = [
  'Human Resources', 'Finance & Accounts', 'Sales & Marketing',
  'Information Technology', 'Operations', 'Customer Support',
  'Procurement', 'Logistics & Supply Chain', 'Legal & Compliance',
  'Administration', 'Production / Manufacturing', 'Research & Development'
];

const QUALIFICATIONS = [
  '10th Pass', '12th Pass', 'Diploma', 'Any Graduate', 'B.Com', 'B.B.A',
  'B.A', 'B.Sc', 'B.Tech / B.E.', 'M.Com', 'M.B.A', 'M.A', 'M.Tech',
  'Professional Certification (CA / CS / CMA)', 'Ph.D'
];

// Icon paths reused across the sidebar (feather-style, stroke based)
const ICONS = {
  dashboard: '<path d="M3 13h8V3H3v10Zm10 8h8V9h-8v12ZM3 21h8v-6H3v6ZM13 3v4h8V3h-8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  vacancy: '<path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  resume: '<path d="M6 3h9l3 3v15H6V3Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12h6M9 16h6M9 8h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  screening: '<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.6"/><path d="M20 20l-4.3-4.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  shortlist: '<path d="M5 6h14M5 12h9M5 18h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="m16 16 2 2 3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  interview: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  selection: '<path d="M9 12.5 11.5 15 16 9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>',
  offer: '<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" opacity="0"/><path d="M7 3h10l2 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7l2-4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12h6M9 16h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  joining: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M19 8v6M22 11h-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  employee: '<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M4 21v-1a8 8 0 0 1 16 0v1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  attendance: '<rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="m8 15 2.5 2.5L16 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  leave: '<rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M9 15h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  payroll: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M9.5 15.5c.4.7 1.3 1.2 2.5 1.2 1.7 0 2.6-.8 2.6-1.9 0-1.2-1-1.6-2.6-2-1.6-.4-2.5-.9-2.5-2 0-1 .9-1.8 2.5-1.8 1.2 0 2 .5 2.4 1.1M12 7.5v9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  payslip: '<path d="M7 3h10l2 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7l2-4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 11h6M9 14h6M9 17h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  exit: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  settlement: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  settings: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1.04-1.56V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10a1.7 1.7 0 0 0 1.56 1.04H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.56 1.04Z" stroke="currentColor" stroke-width="1.4"/>',
  lock: '<rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" stroke-width="1.5"/>'
};

// The 15-phase HR lifecycle. Only Phase 1 has a working module right now —
// the rest render the "locked" placeholder until they're built, per the
// project's "one phase at a time" development rule.
const PHASES = [
  { id: 1, key: 'vacancy', label: 'Job Vacancy', group: 'Recruitment', icon: 'vacancy', built: true },
  { id: 2, key: 'resume', label: 'Resume Management', group: 'Recruitment', icon: 'resume', built: true },
  { id: 3, key: 'screening', label: 'Resume Screening', group: 'Recruitment', icon: 'screening', built: true },
  { id: 4, key: 'shortlisting', label: 'Shortlisting', group: 'Recruitment', icon: 'shortlist', built: true },
  { id: 5, key: 'interview', label: 'Interview Management', group: 'Recruitment', icon: 'interview', built: true },
  { id: 6, key: 'selection', label: 'Candidate Selection', group: 'Recruitment', icon: 'selection', built: true },
  { id: 7, key: 'offer', label: 'Offer Letter', group: 'Recruitment', icon: 'offer', built: true },
  { id: 8, key: 'joining', label: 'Joining Formalities', group: 'Onboarding', icon: 'joining', built: true },
  { id: 9, key: 'employee', label: 'Employee Master', group: 'Onboarding', icon: 'employee', built: true },
  { id: 10, key: 'attendance', label: 'Attendance', group: 'Workforce', icon: 'attendance', built: true },
  { id: 11, key: 'leave', label: 'Leave Management', group: 'Workforce', icon: 'leave', built: true },
  { id: 12, key: 'payroll', label: 'Payroll Processing', group: 'Payroll', icon: 'payroll', built: true },
  { id: 13, key: 'payslip', label: 'Salary Slip', group: 'Payroll', icon: 'payslip', built: true },
  { id: 14, key: 'exit', label: 'Exit Management', group: 'Separation', icon: 'exit', built: true },
  { id: 15, key: 'settlement', label: 'Full & Final Settlement', group: 'Separation', icon: 'settlement', built: true }
];

const ROUTE_TITLES = { dashboard: 'Dashboard', settings: 'Settings', 'my-team': 'My Team', 'my-workspace': 'My Workspace', reports: 'Reports & Analytics', audit: 'Audit Log', compliance: 'Compliance Calendar', letters: 'Letters Generator' };
PHASES.forEach(p => { ROUTE_TITLES[p.key] = p.label; });

// The four interview rounds tracked in Phase 5, in order.
const ROUND_TYPES = [
  { key: 'hr', label: 'HR Round' },
  { key: 'technical', label: 'Technical Round' },
  { key: 'manager', label: 'Manager Round' },
  { key: 'final', label: 'Final Round' }
];

// Pre-approved offer-letter signatories (Phase 7) — real signatories for this
// organization, so students pick from a short authorized list rather than
// typing a name freehand on every offer letter.
const AUTHORIZED_SIGNATORIES = [
  { name: 'Midhun Das', title: 'Accounting Expert' }
];

// Recurring Indian statutory payroll compliance obligations. 'monthly' rules
// fall due on `dueDay` of the month AFTER the payroll month they cover.
// 'annual-fixed' rules occur once per calendar year on a fixed month/day.
// Reference dates only — actual due dates can shift with government notifications.
const COMPLIANCE_RULES = [
  { id: 'pf', title: 'EPF Payment & ECR Filing', category: 'PF', frequency: 'monthly', dueDay: 15,
    description: 'Employer + employee PF contribution deposit and ECR return for the previous month\u2019s payroll.' },
  { id: 'esi', title: 'ESI Contribution Payment', category: 'ESI', frequency: 'monthly', dueDay: 15,
    description: 'ESI contribution deposit for the previous month\u2019s payroll (applicable employees only).' },
  { id: 'pt', title: 'Professional Tax Payment', category: 'PT', frequency: 'monthly', dueDay: 20,
    description: 'State Professional Tax deposit for the previous month (exact due date varies by state).' },
  { id: 'tds', title: 'TDS on Salary Deposit (Sec 192)', category: 'TDS', frequency: 'monthly', dueDay: 7,
    description: 'Income tax TDS deducted from salaries during the previous month, deposited to the Central Government.' },
  { id: '24q-q1', title: 'Form 24Q \u2014 Q1 TDS Return (Apr\u2013Jun)', category: 'TDS', frequency: 'annual-fixed', month: 7, day: 31,
    description: 'Quarterly TDS return for the April\u2013June quarter.' },
  { id: '24q-q2', title: 'Form 24Q \u2014 Q2 TDS Return (Jul\u2013Sep)', category: 'TDS', frequency: 'annual-fixed', month: 10, day: 31,
    description: 'Quarterly TDS return for the July\u2013September quarter.' },
  { id: '24q-q3', title: 'Form 24Q \u2014 Q3 TDS Return (Oct\u2013Dec)', category: 'TDS', frequency: 'annual-fixed', month: 1, day: 31,
    description: 'Quarterly TDS return for the October\u2013December quarter.' },
  { id: '24q-q4', title: 'Form 24Q \u2014 Q4 TDS Return (Jan\u2013Mar)', category: 'TDS', frequency: 'annual-fixed', month: 5, day: 31,
    description: 'Quarterly TDS return for the January\u2013March quarter.' },
  { id: 'form16-issue', title: 'Form 16 Issuance to Employees', category: 'TDS', frequency: 'annual-fixed', month: 6, day: 15,
    description: 'Annual TDS certificate must be issued to all employees for the previous financial year.' },
  { id: 'bonus', title: 'Statutory Bonus Payment', category: 'Bonus', frequency: 'annual-fixed', month: 11, day: 30,
    description: 'Bonus under the Payment of Bonus Act must be paid within 8 months of the financial year end.' }
];

// Letter types the Letters Generator can produce, and the fields each one collects.
const LETTER_TYPES = [
  { key: 'increment', label: 'Increment Letter', fields: ['newSalary', 'effectiveDate'] },
  { key: 'promotion', label: 'Promotion Letter', fields: ['newDesignation', 'newSalary', 'effectiveDate'] },
  { key: 'warning', label: 'Warning Letter', fields: ['incidentDate', 'reason'] },
  { key: 'relieving', label: 'Relieving Letter', fields: ['lastWorkingDay'] },
  { key: 'experience', label: 'Experience Certificate', fields: ['joiningDate', 'lastWorkingDay'] }
];

// The 12-item onboarding checklist tracked in Phase 8.
const CHECKLIST_ITEMS = [
  { key: 'pan', label: 'PAN' },
  { key: 'aadhaar', label: 'Aadhaar' },
  { key: 'passportPhoto', label: 'Passport Photo' },
  { key: 'bankDetails', label: 'Bank Details' },
  { key: 'address', label: 'Address' },
  { key: 'emergencyContact', label: 'Emergency Contact' },
  { key: 'educationalDocuments', label: 'Educational Documents' },
  { key: 'experienceCertificate', label: 'Experience Certificate' },
  { key: 'pf', label: 'PF' },
  { key: 'esi', label: 'ESI' },
  { key: 'medicalDeclaration', label: 'Medical Declaration' },
  { key: 'backgroundVerification', label: 'Background Verification' }
];

// Employee Master presets (Phase 9) — also reused by Attendance (Phase 10)
// and Leave Management (Phase 11) once those are built.
const ATTENDANCE_RULES = ['General Shift (9:30 AM - 6:30 PM)', 'Flexible Hours', 'Field Duty'];
const LEAVE_POLICIES = ['Standard Policy (12 CL + 12 SL + 15 EL)', 'Probation Policy (No Leave)', 'Senior Management Policy (Unlimited CL)'];
const SHIFTS = ['Day Shift', 'Night Shift', 'Rotational Shift'];

// Recurring company holidays (MM-DD, applies every year) and standard shift
// hours used to auto-detect weekends/holidays and calculate overtime in
// Attendance Management (Phase 10).
const COMPANY_HOLIDAYS_MMDD = ['01-26', '08-15', '10-02', '12-25'];
const STANDARD_CHECK_IN = '09:30';
const STANDARD_CHECK_OUT = '18:30';
const STANDARD_WORK_HOURS = 9;

// Leave Management (Phase 11) — annual allocations per Leave Policy (assigned
// in Employee Master) for the three quota-based leave types. Maternity and
// Paternity are fixed one-time allocations regardless of policy; Loss of Pay
// is uncapped by design (no balance check).
const LEAVE_TYPES = ['Casual', 'Sick', 'Earned', 'Maternity', 'Paternity', 'Loss of Pay'];
const LEAVE_ALLOCATIONS = {
  'Standard Policy (12 CL + 12 SL + 15 EL)': { Casual: 12, Sick: 12, Earned: 15 },
  'Probation Policy (No Leave)': { Casual: 0, Sick: 0, Earned: 0 },
  'Senior Management Policy (Unlimited CL)': { Casual: Infinity, Sick: 12, Earned: 15 }
};
const FIXED_LEAVE_ALLOCATIONS = { Maternity: 180, Paternity: 15 };

// Asset return checklist tracked in Exit Management (Phase 14).
const ASSET_ITEMS = [
  { key: 'laptop', label: 'Laptop' },
  { key: 'idCard', label: 'ID Card' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'accessCard', label: 'Access Card' },
  { key: 'documents', label: 'Documents' }
];

// Full & Final Settlement engine constants (Phase 15).
const SETTLEMENT = {
  GRATUITY_MIN_YEARS: 5,
  GRATUITY_DAYS_PER_YEAR: 15,
  GRATUITY_MONTH_DIVISOR: 26,
  OTHER_RECOVERY_PER_MISSING_ASSET: 2000
};

// Payroll engine constants (Phase 12) — standard Indian payroll formulas,
// simplified for a training simulator (e.g. Income Tax is a flat estimate,
// not a full slab calculation).
const PAYROLL = {
  BASIC_PCT: 0.50,        // Basic = 50% of monthly salary
  HRA_PCT_OF_BASIC: 0.40, // HRA = 40% of Basic
  DA_PCT_OF_BASIC: 0.10,  // DA = 10% of Basic
  MEDICAL_FIXED: 1250,
  TRAVEL_FIXED: 1600,
  PF_RATE: 0.12, PF_CAP: 1800,
  ESI_RATE: 0.0075, ESI_GROSS_THRESHOLD: 21000,
  LATE_GRACE_DAYS: 3, LATE_PENALTY_PER_DAY: 200,
  OT_MONTHLY_HOURS: 208, OT_MULTIPLIER: 2
};

/* ---------------------------------------------------------------
   1B. INCOME TAX ENGINE (FY 2025-26 / AY 2026-27 rates, per Budget
   2025 — unchanged for FY 2026-27 per Budget 2026). Built for
   training/simulation purposes: mirrors the real slab, rebate,
   surcharge and cess mechanics so students see how actual TDS-on-
   salary is derived. Rates change every Union Budget — if you are
   adapting this for a live payroll, verify against the latest
   CBDT notification before relying on it.
--------------------------------------------------------------- */
const TAX_REGIMES = {
  new: {
    label: 'New Regime',
    standardDeduction: 75000,
    slabs: [
      { upto: 400000, rate: 0 },
      { upto: 800000, rate: 0.05 },
      { upto: 1200000, rate: 0.10 },
      { upto: 1600000, rate: 0.15 },
      { upto: 2000000, rate: 0.20 },
      { upto: 2400000, rate: 0.25 },
      { upto: Infinity, rate: 0.30 }
    ],
    rebate87A: { maxTaxableIncome: 1200000, maxRebate: 60000 },
    allowHRA: false,
    allow80C: false,
    max80C: 0
  },
  old: {
    label: 'Old Regime',
    standardDeduction: 50000,
    slabs: [
      { upto: 250000, rate: 0 },
      { upto: 500000, rate: 0.05 },
      { upto: 1000000, rate: 0.20 },
      { upto: Infinity, rate: 0.30 }
    ],
    rebate87A: { maxTaxableIncome: 500000, maxRebate: 12500 },
    allowHRA: true,
    allow80C: true,
    max80C: 150000
  }
};
const CESS_RATE = 0.04; // Health & Education Cess, both regimes
// Simplified surcharge ladder (applies above ₹50L net taxable income; capped
// at 25% under the new regime by design — old regime can legally exceed this
// above ₹5Cr, which this training build does not model).
const SURCHARGE_SLABS = [
  { upto: 5000000, rate: 0 },
  { upto: 10000000, rate: 0.10 },
  { upto: 20000000, rate: 0.15 },
  { upto: Infinity, rate: 0.25 }
];
// Only Delhi, Mumbai, Kolkata & Chennai count as "metro" for the 50%-of-
// (Basic+DA) HRA exemption limb — every other city, including Bengaluru,
// Hyderabad, Pune and Kochi, gets 40%. This trips up a lot of real payroll
// clerks, so the simulator enforces it correctly on purpose.
const HRA_METRO_CITIES = ['Delhi', 'Mumbai', 'Kolkata', 'Chennai'];
const CITIES = ['Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Bengaluru', 'Hyderabad', 'Pune', 'Ahmedabad',
  'Kochi', 'Thiruvananthapuram', 'Kozhikode', 'Coimbatore', 'Jaipur', 'Chandigarh', 'Bhopal', 'Other'];

// State-wise monthly Professional Tax (PT). Most states deduct monthly;
// Tamil Nadu & Kerala levy it half-yearly (Apr–Sep, Oct–Mar) — this build
// spreads the half-yearly amount evenly across 6 payslips so the payroll
// register stays consistent month to month (a common practical approach;
// some employers instead deduct the full half-yearly sum in a single month).
// States with no PT (Delhi, UP, Haryana, Rajasthan, Punjab) return ₹0.
const PT_SLABS = {
  'Karnataka': { period: 'monthly', febBump: 300, slabs: [
    { upto: 15000, amount: 0 }, { upto: 25000, amount: 150 }, { upto: Infinity, amount: 200 } ] },
  'Maharashtra': { period: 'monthly', febBump: 300, slabs: [
    { upto: 7500, amount: 0 }, { upto: 10000, amount: 175 }, { upto: Infinity, amount: 200 } ] },
  'West Bengal': { period: 'monthly', slabs: [
    { upto: 10000, amount: 0 }, { upto: 15000, amount: 110 }, { upto: 25000, amount: 130 },
    { upto: 40000, amount: 150 }, { upto: Infinity, amount: 200 } ] },
  'Andhra Pradesh': { period: 'monthly', slabs: [
    { upto: 15000, amount: 0 }, { upto: 20000, amount: 150 }, { upto: Infinity, amount: 200 } ] },
  'Telangana': { period: 'monthly', slabs: [
    { upto: 15000, amount: 0 }, { upto: 20000, amount: 150 }, { upto: Infinity, amount: 200 } ] },
  'Gujarat': { period: 'monthly', slabs: [
    { upto: 5999, amount: 0 }, { upto: 8999, amount: 80 }, { upto: 11999, amount: 150 }, { upto: Infinity, amount: 200 } ] },
  'Madhya Pradesh': { period: 'monthly', slabs: [
    { upto: 18750, amount: 0 }, { upto: 25000, amount: 125 }, { upto: Infinity, amount: 208 } ] },
  'Tamil Nadu': { period: 'half-yearly', slabs: [
    { upto: 21000, amount: 0 }, { upto: 30000, amount: 135 }, { upto: 45000, amount: 315 },
    { upto: 60000, amount: 690 }, { upto: 75000, amount: 1025 }, { upto: Infinity, amount: 1250 } ] },
  'Kerala': { period: 'half-yearly', slabs: [
    { upto: 11999, amount: 0 }, { upto: 17999, amount: 120 }, { upto: 29999, amount: 180 },
    { upto: 44999, amount: 300 }, { upto: 59999, amount: 450 }, { upto: 74999, amount: 600 },
    { upto: 99999, amount: 750 }, { upto: 124999, amount: 1000 }, { upto: Infinity, amount: 1250 } ] },
  'Delhi': { period: 'none', slabs: [] },
  'Uttar Pradesh': { period: 'none', slabs: [] },
  'Haryana': { period: 'none', slabs: [] },
  'Rajasthan': { period: 'none', slabs: [] },
  'Punjab': { period: 'none', slabs: [] }
};
const STATES = Object.keys(PT_SLABS);

const TaxEngine = {
  computeSlabTax(taxableIncome, slabs) {
    let tax = 0, lastLimit = 0;
    for (const slab of slabs) {
      if (taxableIncome <= lastLimit) break;
      const taxableInSlab = Math.min(taxableIncome, slab.upto) - lastLimit;
      tax += taxableInSlab * slab.rate;
      lastLimit = slab.upto;
    }
    return tax;
  },

  // HRA exemption (Sec 10(13A)) — least of: HRA actually received,
  // rent paid minus 10% of Basic+DA, or 50%/40% of Basic+DA (metro/non-metro).
  computeHRAExemption(hraReceivedAnnual, basicPlusDaAnnual, rentPaidAnnual, isMetro) {
    if (!rentPaidAnnual) return 0;
    const rentMinusTenPct = Math.max(0, rentPaidAnnual - 0.10 * basicPlusDaAnnual);
    const pctOfBasic = (isMetro ? 0.50 : 0.40) * basicPlusDaAnnual;
    return Math.max(0, Math.round(Math.min(hraReceivedAnnual, rentMinusTenPct, pctOfBasic)));
  },

  computeSurcharge(taxAfterRebate, taxableIncome) {
    const slab = SURCHARGE_SLABS.find(s => taxableIncome <= s.upto) || SURCHARGE_SLABS[SURCHARGE_SLABS.length - 1];
    return Math.round(taxAfterRebate * slab.rate);
  },

  computeProfessionalTax(grossMonthlySalary, state, monthStr) {
    const config = PT_SLABS[state] || PT_SLABS['Karnataka'];
    if (!config.slabs.length) return 0;
    const mm = monthStr ? monthStr.split('-')[1] : null;
    if (config.period === 'monthly') {
      const slab = config.slabs.find(s => grossMonthlySalary <= s.upto) || config.slabs[config.slabs.length - 1];
      let amount = slab.amount;
      if (config.febBump && amount === 200 && mm === '02') amount = config.febBump;
      return amount;
    }
    // half-yearly: average the half-year liability evenly across 6 months
    const halfYearlyIncome = grossMonthlySalary * 6;
    const slab = config.slabs.find(s => halfYearlyIncome <= s.upto) || config.slabs[config.slabs.length - 1];
    return Math.round(slab.amount / 6);
  },

  // Full annual computation. All *Annual figures should already be
  // annualized (monthly figure × 12) by the caller.
  computeAnnualTax({ grossAnnual, basicAnnual, daAnnual, hraReceivedAnnual, rentPaidAnnual,
    isMetro, declared80CAnnual, regime, professionalTaxAnnual }) {
    const config = TAX_REGIMES[regime] || TAX_REGIMES.new;
    let taxableIncome = grossAnnual;

    // Professional tax is deductible under Sec 16(iii) in BOTH regimes.
    taxableIncome -= (professionalTaxAnnual || 0);
    // Standard deduction for salaried employees — both regimes.
    taxableIncome -= config.standardDeduction;

    let hraExemption = 0;
    let deduction80C = 0;
    if (config.allowHRA) {
      hraExemption = this.computeHRAExemption(hraReceivedAnnual || 0, (basicAnnual || 0) + (daAnnual || 0), rentPaidAnnual || 0, isMetro);
      taxableIncome -= hraExemption;
    }
    if (config.allow80C) {
      deduction80C = Math.min(declared80CAnnual || 0, config.max80C);
      taxableIncome -= deduction80C;
    }
    taxableIncome = Math.max(0, Math.round(taxableIncome));

    let tax = this.computeSlabTax(taxableIncome, config.slabs);

    let rebate = 0;
    if (taxableIncome <= config.rebate87A.maxTaxableIncome) {
      rebate = Math.min(tax, config.rebate87A.maxRebate);
    }
    const taxAfterRebate = tax - rebate;

    const surcharge = this.computeSurcharge(taxAfterRebate, taxableIncome);
    const cess = Math.round((taxAfterRebate + surcharge) * CESS_RATE);
    const totalTax = Math.round(taxAfterRebate + surcharge + cess);

    return {
      regime, regimeLabel: config.label, taxableIncome,
      standardDeduction: config.standardDeduction, hraExemption, deduction80C,
      slabTax: Math.round(tax), rebate, surcharge, cess, totalTax
    };
  },

  computeMonthlyTDS(inputs) {
    const annual = this.computeAnnualTax(inputs);
    return Object.assign({ monthlyTDS: Math.round(annual.totalTax / 12) }, annual);
  }
};

/* ---------------------------------------------------------------
   1C. COMPANY / DEDUCTOR SETTINGS (for payslip masthead & Form 16)
--------------------------------------------------------------- */
const CompanySettingsStore = {
  DEFAULTS: {
    name: 'Skelora Technologies Pvt. Ltd.',
    tagline: 'HR & Payroll Systems',
    address: 'Infopark Phase II, Kochi, Kerala – 682030',
    tan: 'COCS12345D',
    employerPan: 'AACCS1234F',
    state: 'Kerala'
  },
  get() {
    return Object.assign({}, this.DEFAULTS, Storage.get(STORAGE_KEYS.companySettings, {}));
  },
  set(partial) {
    const merged = Object.assign({}, this.get(), partial);
    Storage.set(STORAGE_KEYS.companySettings, merged);
    return merged;
  }
};

/* ---------------------------------------------------------------
   2. STORAGE HELPER
--------------------------------------------------------------- */
const Storage = {
  // Keys that are shared machine-wide across every student using this browser
  // (the login account list itself, and pure UI prefs) — never namespaced.
  GLOBAL_KEYS: new Set([
    STORAGE_KEYS.users, STORAGE_KEYS.userCounter, STORAGE_KEYS.session,
    STORAGE_KEYS.theme, STORAGE_KEYS.sidebarCollapsed
  ]),

  // Everything else (vacancies, employees, payroll, audit log, company
  // settings, etc.) is namespaced per "workspace" so that several students
  // sharing one computer/browser each get their own private company data,
  // even though LocalStorage itself is shared across the whole origin.
  // Workspace = the logged-in user's workspace id (set at login/signup);
  // falls back to a single shared 'default' space when nobody is logged in
  // yet (e.g. very first paint before the login screen mounts).
  _namespacedKey(key) {
    if (this.GLOBAL_KEYS.has(key)) return key;
    let workspace = 'default';
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.session);
      if (raw) {
        const session = JSON.parse(raw);
        if (session && session.workspace) workspace = session.workspace;
      }
    } catch (e) { /* fall through to default */ }
    return 'ws__' + workspace + '__' + key;
  },
  get(key, fallback) {
    const k = this._namespacedKey(key);
    try {
      const raw = localStorage.getItem(k);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Storage.get failed for', k, e);
      return fallback;
    }
  },
  set(key, value) {
    const k = this._namespacedKey(key);
    try {
      localStorage.setItem(k, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage.set failed for', k, e);
      Toast.show('Could not save — browser storage may be full.', 'error');
      return false;
    }
  },
  remove(key) {
    const k = this._namespacedKey(key);
    try { localStorage.removeItem(k); } catch (e) { /* noop */ }
  }
};

/* ---------------------------------------------------------------
   3. GENERIC UTILITIES
--------------------------------------------------------------- */
const Utils = {
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  formatCurrency(n) {
    const num = Number(n) || 0;
    const sign = num < 0 ? '-' : '';
    return sign + '₹' + Math.abs(num).toLocaleString('en-IN');
  },
  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  timeAgo(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  },
  debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  },
  pad(num, len) {
    return String(num).padStart(len, '0');
  },
  todayStr() {
    return new Date().toISOString().slice(0, 10);
  },
  isFutureOrToday(dateStr) {
    if (!dateStr) return false;
    return dateStr >= Utils.todayStr();
  },
  uuid() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
};

/* ---------------------------------------------------------------
   3B. PDF EXPORT — renders a "paper" element to a real, downloadable
   .pdf file (html2canvas + jsPDF, vendored locally in assets/js/vendor
   so this keeps working offline). Paginates automatically if the
   content is taller than one A4 page.
--------------------------------------------------------------- */
const PdfExport = {
  async downloadElement(elementId, filename, triggerBtn) {
    const el = document.getElementById(elementId);
    if (!el) { Toast.show('Nothing to export.', 'error'); return; }
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      Toast.show('PDF engine did not load — use Print \u2192 Save as PDF instead.', 'error');
      return;
    }
    const originalLabel = triggerBtn ? triggerBtn.innerHTML : null;
    if (triggerBtn) { triggerBtn.disabled = true; triggerBtn.textContent = 'Generating PDF\u2026'; }

    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');

      const { jsPDF } = window.jspdf;
      const pageWidthMm = 210, pageHeightMm = 297, marginMm = 10;
      const usableWidthMm = pageWidthMm - marginMm * 2;
      const usableHeightMm = pageHeightMm - marginMm * 2;
      const imgHeightMm = (canvas.height * usableWidthMm) / canvas.width;

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      let heightLeft = imgHeightMm;
      let position = marginMm;

      doc.addImage(imgData, 'PNG', marginMm, position, usableWidthMm, imgHeightMm);
      heightLeft -= usableHeightMm;

      while (heightLeft > 0) {
        doc.addPage();
        position = marginMm - (imgHeightMm - heightLeft);
        doc.addImage(imgData, 'PNG', marginMm, position, usableWidthMm, imgHeightMm);
        heightLeft -= usableHeightMm;
      }

      doc.save(filename);
    } catch (err) {
      console.error('PDF export failed:', err);
      Toast.show('Could not generate PDF \u2014 use Print \u2192 Save as PDF instead.', 'error');
    } finally {
      if (triggerBtn) { triggerBtn.disabled = false; triggerBtn.innerHTML = originalLabel; }
    }
  }
};

/* ---------------------------------------------------------------
   4. TOAST NOTIFICATIONS
--------------------------------------------------------------- */
const Toast = {
  icons: {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="m8.5 12.5 2.3 2.3L16 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 8v5M12 16h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9v4m0 4h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5m0-8h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  },
  show(message, type = 'info', duration = 3600) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML =
      '<span class="toast-icon">' + this.icons[type] + '</span>' +
      '<span class="toast-msg">' + Utils.escapeHtml(message) + '</span>' +
      '<button class="toast-close" aria-label="Dismiss">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>';
    container.appendChild(el);
    const remove = () => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 200);
    };
    el.querySelector('.toast-close').addEventListener('click', remove);
    if (duration > 0) setTimeout(remove, duration);
  }
};

/* ---------------------------------------------------------------
   5. CONFIRM DIALOG (generic, reused across the app)
--------------------------------------------------------------- */
const Confirm = {
  _resolve: null,
  ask(title, message, okLabel = 'Confirm') {
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmOkBtn').textContent = okLabel;
    overlay.hidden = false;
    return new Promise((resolve) => { this._resolve = resolve; });
  },
  resolveWith(val) {
    const overlay = document.getElementById('confirmOverlay');
    overlay.hidden = true;
    if (this._resolve) { this._resolve(val); this._resolve = null; }
  }
};

/* ---------------------------------------------------------------
   ModalExclusivity — the app has 19 separate modal-overlay dialogs
   across its phases, each toggled independently by its own module.
   Nothing previously stopped more than one being open at the same
   time (e.g. an Edit form, a preview, and a confirm dialog all
   stacked on top of each other — confusing and hard to click out
   of). Rather than patch every individual open*() function across
   every module, this watches all .modal-overlay elements once and
   auto-closes any others the instant a new one becomes visible, so
   at most one is ever shown regardless of which code opened it.
--------------------------------------------------------------- */
function initModalExclusivity() {
  const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
  const observer = new MutationObserver((mutations) => {
    // Multiple opens can land in the same batch (e.g. two modals opened in
    // quick succession before the microtask queue had a chance to flush) —
    // the LAST one to open should win, not the first, since that's the one
    // most recently requested. Scanning the whole batch first avoids the
    // first-opened overlay incorrectly closing the second-opened one.
    let lastOpened = null;
    mutations.forEach((m) => {
      if (m.attributeName === 'hidden' && !m.target.hidden) lastOpened = m.target;
    });
    if (!lastOpened) return;
    overlays.forEach((other) => {
      if (other !== lastOpened && !other.hidden) other.hidden = true;
    });
  });
  overlays.forEach((el) => observer.observe(el, { attributes: true, attributeFilter: ['hidden'] }));
}

/* ---------------------------------------------------------------
   6. THEME
--------------------------------------------------------------- */
const Theme = {
  init() {
    const saved = Storage.get(STORAGE_KEYS.theme, 'light');
    this.apply(saved);
    document.getElementById('themeToggleBtn').addEventListener('click', () => this.toggle());
    const settingsBtn = document.getElementById('settingsThemeBtn');
    if (settingsBtn) settingsBtn.addEventListener('click', () => this.toggle());
  },
  apply(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    document.getElementById('themeIconSun').style.display = mode === 'dark' ? 'none' : '';
    document.getElementById('themeIconMoon').style.display = mode === 'dark' ? '' : 'none';
    Storage.set(STORAGE_KEYS.theme, mode);
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    this.apply(current === 'dark' ? 'light' : 'dark');
  }
};

/* ---------------------------------------------------------------
   6B. ROLES & AUTH
--------------------------------------------------------------- */
const ROLE_LABELS = { admin: 'Admin', hr: 'HR', manager: 'Manager', employee: 'Employee' };
const ROLE_HOME = { admin: 'dashboard', hr: 'dashboard', manager: 'my-team', employee: 'my-workspace' };
// Routes each role may open directly. 'admin' sees everything (checked separately).
const ROLE_ROUTES = {
  hr: ['dashboard', 'vacancy', 'resume', 'screening', 'shortlisting', 'interview', 'selection', 'offer',
    'joining', 'employee', 'attendance', 'leave', 'payroll', 'payslip', 'exit', 'settlement', 'settings', 'reports', 'compliance', 'letters'],
  manager: ['my-team', 'settings'],
  employee: ['my-workspace', 'settings']
};

const Auth = {
  seedDefaultUsers() {
    if (Storage.get(STORAGE_KEYS.users, []).length) return;
    const now = Date.now();
    Storage.set(STORAGE_KEYS.users, [
      { id: 'USR-0001', username: 'admin', password: 'admin123', role: 'admin', employeeId: null, displayName: 'Training Admin', active: true, createdAt: now, workspace: 'default' },
      { id: 'USR-0002', username: 'hr', password: 'hr123', role: 'hr', employeeId: null, displayName: 'HR Executive', active: true, createdAt: now, workspace: 'default' }
    ]);
    Storage.set(STORAGE_KEYS.userCounter, 2);
  },

  getUsers() { return Storage.get(STORAGE_KEYS.users, []); },

  nextUserId() {
    const n = Storage.get(STORAGE_KEYS.userCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.userCounter, n);
    return 'USR-' + Utils.pad(n, 4);
  },

  getSession() { return Storage.get(STORAGE_KEYS.session, null); },

  login(username, password) {
    const user = this.getUsers().find(u =>
      u.username.toLowerCase() === (username || '').trim().toLowerCase() && u.password === password);
    if (!user) return { ok: false, error: 'Invalid username or password.' };
    if (user.active === false) return { ok: false, error: 'This login account has been deactivated.' };
    const session = {
      userId: user.id, username: user.username, role: user.role,
      employeeId: user.employeeId, displayName: user.displayName, loginAt: Date.now(),
      // Legacy accounts created before workspaces existed fall back to 'default'.
      workspace: user.workspace || 'default'
    };
    Storage.set(STORAGE_KEYS.session, session);
    return { ok: true, session };
  },

  // Self-service sign-up (e.g. for students setting up their own practice
  // account). Always creates an HR-role login — full workflow access,
  // no admin-only settings/user-management surface.
  signUp(displayName, username, password) {
    const trimmedUsername = (username || '').trim();
    const trimmedName = (displayName || '').trim();
    if (!trimmedName) return { ok: false, error: 'Enter your full name.' };
    if (!trimmedUsername || trimmedUsername.length < 3) return { ok: false, error: 'Username must be at least 3 characters.' };
    if (!password || password.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };
    const users = this.getUsers();
    if (users.some(u => u.username.toLowerCase() === trimmedUsername.toLowerCase())) {
      return { ok: false, error: 'That username is already taken \u2014 pick another.' };
    }
    const newUser = {
      id: this.nextUserId(), username: trimmedUsername, password, role: 'hr',
      employeeId: null, displayName: trimmedName, active: true, createdAt: Date.now(),
      // Every self-signup gets its own private workspace, keyed to their
      // username — this is what keeps several students on one shared
      // computer/browser from seeing or overwriting each other's data.
      workspace: trimmedUsername
    };
    users.push(newUser);
    Storage.set(STORAGE_KEYS.users, users);
    const session = {
      userId: newUser.id, username: newUser.username, role: newUser.role,
      employeeId: null, displayName: newUser.displayName, loginAt: Date.now(),
      workspace: newUser.workspace
    };
    Storage.set(STORAGE_KEYS.session, session);
    return { ok: true, session };
  },

  logout() {
    Storage.remove(STORAGE_KEYS.session);
    location.reload();
  },

  canAccess(route) {
    const session = this.getSession();
    if (!session) return false;
    if (session.role === 'admin') return true;
    return (ROLE_ROUTES[session.role] || []).includes(route);
  },

  generatePassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 8; i++) pass += chars[Math.floor(Math.random() * chars.length)];
    return pass;
  },

  usernameSlug(name, employeeId) {
    const base = (name || '').toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.');
    return base || employeeId.toLowerCase();
  },

  getUserForEmployee(employeeId) {
    return this.getUsers().find(u => u.employeeId === employeeId);
  },

  hasDirectReports(employeeId) {
    return EmployeeModule.getAll().some(e => e.reportingManagerId === employeeId && e.status === 'Active');
  },

  createLoginForEmployee(employee, role) {
    const users = this.getUsers();
    let username = this.usernameSlug(employee.name, employee.id);
    let n = 1;
    const baseUsername = username;
    while (users.some(u => u.username === username)) { username = baseUsername + n; n++; }
    const password = this.generatePassword();
    // Manager/Employee self-service logins belong to whichever student's
    // workspace they were created from (the HR account currently logged
    // in) — NOT a workspace of their own — so they land in the same
    // company data the creating student has been building.
    const creatorSession = this.getSession();
    const newUser = {
      id: this.nextUserId(), username, password, role,
      employeeId: employee.id, displayName: employee.name, active: true, createdAt: Date.now(),
      workspace: (creatorSession && creatorSession.workspace) || 'default'
    };
    users.push(newUser);
    Storage.set(STORAGE_KEYS.users, users);
    AuditLog.log('User Accounts', 'Login Created', newUser.displayName + ' (' + newUser.username + ')', 'Role: ' + (ROLE_LABELS[role] || role));
    return newUser;
  },

  resetPassword(userId) {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    user.password = this.generatePassword();
    Storage.set(STORAGE_KEYS.users, users);
    AuditLog.log('User Accounts', 'Password Reset', user.displayName + ' (' + user.username + ')', '');
    return user;
  },

  setActive(userId, active) {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;
    user.active = active;
    Storage.set(STORAGE_KEYS.users, users);
    AuditLog.log('User Accounts', active ? 'Login Reactivated' : 'Login Deactivated', user.displayName + ' (' + user.username + ')', '');
  }
};

/* ---------------------------------------------------------------
   6C. AUDIT LOG — compliance-relevant mutations only (not every
   click across all 15 phases; salary/status/bank/tax changes,
   payroll runs and overrides, leave decisions, login account
   actions, and company settings — the things a real HR/payroll
   audit actually asks "who changed this and when").
--------------------------------------------------------------- */
const AuditLog = {
  MAX_ENTRIES: 1000,

  log(module, action, target, detail) {
    const session = Auth.getSession();
    const entries = Storage.get(STORAGE_KEYS.auditLog, []);
    entries.unshift({
      id: Utils.uuid(), ts: Date.now(),
      user: session ? session.displayName : 'System',
      role: session ? (ROLE_LABELS[session.role] || session.role) : '',
      module, action, target, detail: detail || ''
    });
    if (entries.length > this.MAX_ENTRIES) entries.length = this.MAX_ENTRIES;
    Storage.set(STORAGE_KEYS.auditLog, entries);
  },

  getAll() { return Storage.get(STORAGE_KEYS.auditLog, []); },

  // Diffs a small set of compliance-sensitive employee fields and logs
  // only if something in that set actually changed.
  logEmployeeChange(before, after) {
    const watched = [
      ['salary', 'Salary'], ['status', 'Status'], ['bankName', 'Bank Name'],
      ['accountNumber', 'Account Number'], ['taxRegime', 'Tax Regime'],
      ['reportingManagerId', 'Reporting Manager'], ['department', 'Department'], ['designation', 'Designation']
    ];
    const changes = [];
    watched.forEach(([key, label]) => {
      if (before[key] !== after[key]) {
        changes.push(label + ': ' + (before[key] || '\u2014') + ' \u2192 ' + (after[key] || '\u2014'));
      }
    });
    if (changes.length) {
      this.log('Employee Master', 'Updated', after.name + ' (' + after.id + ')', changes.join('; '));
    }
  }
};

/* ---------------------------------------------------------------
   7. SIDEBAR + ROUTER
--------------------------------------------------------------- */
const Router = {
  current: 'dashboard',

  isPhaseUnlocked(phase) {
    // Right now, unlock == built. As later phases are built, this is
    // where real workflow gating (e.g. "at least one candidate selected
    // in Phase 6") will be checked before granting access to the next one.
    return !!phase.built;
  },

  buildSidebar() {
    const nav = document.getElementById('sidebarNav');
    const session = Auth.getSession();
    const role = session ? session.role : 'admin';
    let html = '';

    if (role === 'manager') {
      html += this.navItemHtml({ key: 'my-team', label: 'My Team', icon: 'dashboard' }, true, null);
      html += '<div class="nav-group-label">System</div>';
      html += this.navItemHtml({ key: 'settings', label: 'Settings', icon: 'settings' }, true, null);
      nav.innerHTML = html;
      this.bindNavClicks(nav);
      document.getElementById('workflowProgress').hidden = true;
      return;
    }
    if (role === 'employee') {
      html += this.navItemHtml({ key: 'my-workspace', label: 'My Workspace', icon: 'dashboard' }, true, null);
      html += '<div class="nav-group-label">System</div>';
      html += this.navItemHtml({ key: 'settings', label: 'Settings', icon: 'settings' }, true, null);
      nav.innerHTML = html;
      this.bindNavClicks(nav);
      document.getElementById('workflowProgress').hidden = true;
      return;
    }

    document.getElementById('workflowProgress').hidden = false;
    html += this.navItemHtml({ key: 'dashboard', label: 'Dashboard', icon: 'dashboard' }, true, null);

    let lastGroup = null;
    PHASES.forEach((phase) => {
      if (phase.group !== lastGroup) {
        html += '<div class="nav-group-label">' + Utils.escapeHtml(phase.group) + '</div>';
        lastGroup = phase.group;
      }
      const unlocked = this.isPhaseUnlocked(phase);
      html += this.navItemHtml(phase, unlocked, phase.id);
    });

    html += '<div class="nav-group-label">System</div>';
    html += this.navItemHtml({ key: 'reports', label: 'Reports & Analytics', icon: 'settings' }, true, null);
    html += this.navItemHtml({ key: 'compliance', label: 'Compliance Calendar', icon: 'settings' }, true, null);
    html += this.navItemHtml({ key: 'letters', label: 'Letters Generator', icon: 'settings' }, true, null);
    if (role === 'admin') html += this.navItemHtml({ key: 'audit', label: 'Audit Log', icon: 'settings' }, true, null);
    html += this.navItemHtml({ key: 'settings', label: 'Settings', icon: 'settings' }, true, null);

    nav.innerHTML = html;
    this.bindNavClicks(nav);
    this.updateProgress();
  },

  bindNavClicks(nav) {
    nav.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', () => {
        const route = item.getAttribute('data-nav-route');
        const locked = item.classList.contains('locked');
        if (locked) {
          const label = item.getAttribute('data-nav-label');
          const phaseNum = item.getAttribute('data-phase-num');
          this.showLocked(label, phaseNum);
          return;
        }
        this.go(route);
      });
    });
  },

  navItemHtml(item, unlocked, phaseNum) {
    const iconSvg = ICONS[item.icon] || '';
    const lockedClass = unlocked ? '' : ' locked';
    const phaseTag = phaseNum ? '<span class="nav-phase-num">P' + phaseNum + '</span>' : '';
    const lockIcon = unlocked ? '' :
      '<span class="lock-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none">' + ICONS.lock + '</svg></span>';
    return (
      '<div class="nav-item' + lockedClass + '" data-nav-route="' + item.key + '" data-nav-label="' +
      Utils.escapeHtml(item.label) + '" data-phase-num="' + (phaseNum || '') + '">' +
      '<span class="nav-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none">' + iconSvg + '</svg></span>' +
      '<span class="nav-label">' + Utils.escapeHtml(item.label) + '</span>' +
      phaseTag + lockIcon +
      '</div>'
    );
  },

  updateProgress() {
    const unlockedCount = PHASES.filter(p => this.isPhaseUnlocked(p)).length;
    const pct = Math.round((unlockedCount / PHASES.length) * 100);
    document.getElementById('workflowProgressFill').style.width = pct + '%';
    document.getElementById('workflowProgressLabel').textContent =
      'Phase ' + unlockedCount + ' of ' + PHASES.length + ' unlocked';
  },

  go(route) {
    const session = Auth.getSession();
    if (session && !Auth.canAccess(route)) {
      Toast.show('That section isn\u2019t available for your role.', 'error');
      route = ROLE_HOME[session.role] || 'dashboard';
    }
    this.current = route;
    Storage.set(STORAGE_KEYS.currentRoute, route);

    document.querySelectorAll('.view').forEach(v => { v.hidden = true; });
    const targetId = 'view-' + route;
    let target = document.getElementById(targetId);
    if (!target) target = document.getElementById('view-dashboard');
    target.hidden = false;

    document.getElementById('breadcrumbCurrent').textContent = ROUTE_TITLES[route] || route;
    document.title = (ROUTE_TITLES[route] || 'SKELORA') + ' | SKELORA HR & Payroll ERP';

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-nav-route') === route);
    });

    // Close mobile sidebar / popovers on navigation
    document.getElementById('appShell').classList.remove('sidebar-mobile-open');
    Popovers.closeAll();

    if (route === 'dashboard') Dashboard.render();
    if (route === 'vacancy') VacancyModule.render();
    if (route === 'resume') ResumeModule.render();
    if (route === 'screening') ScreeningModule.render();
    if (route === 'shortlisting') ShortlistModule.render();
    if (route === 'interview') InterviewModule.render();
    if (route === 'selection') SelectionModule.render();
    if (route === 'offer') OfferModule.render();
    if (route === 'joining') JoiningModule.render();
    if (route === 'employee') EmployeeModule.render();
    if (route === 'attendance') AttendanceModule.render();
    if (route === 'leave') LeaveModule.render();
    if (route === 'payroll') PayrollModule.render();
    if (route === 'payslip') SalarySlipModule.render();
    if (route === 'exit') ExitModule.render();
    if (route === 'settlement') SettlementModule.render();
    if (route === 'my-team') ManagerModule.render();
    if (route === 'my-workspace') SelfServiceModule.render();
    if (route === 'reports') ReportsModule.render();
    if (route === 'audit') AuditViewModule.render();
    if (route === 'compliance') ComplianceModule.render();
    if (route === 'letters') LettersModule.render();
    if (route === 'settings') { populateCompanySettingsForm(); renderLoginAccountsPanel(); }
  },

  showLocked(label, phaseNum) {
    document.getElementById('lockedPhaseTitle').textContent = label + ' is locked';
    const prevPhase = phaseNum ? PHASES.find(p => p.id === Number(phaseNum) - 1) : null;
    const prevLabel = prevPhase ? prevPhase.label : 'the previous phase';
    document.getElementById('lockedPhaseDesc').textContent =
      'This module isn\u2019t available in this build yet. It unlocks once ' + prevLabel + ' is completed.';
    this.go('locked');
  },

  initSidebarToggles() {
    document.getElementById('sidebarCollapseBtn').addEventListener('click', () => {
      const shell = document.getElementById('appShell');
      shell.classList.toggle('sidebar-collapsed');
      Storage.set(STORAGE_KEYS.sidebarCollapsed, shell.classList.contains('sidebar-collapsed'));
    });
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
      document.getElementById('appShell').classList.toggle('sidebar-mobile-open');
    });
    document.getElementById('sidebarBackdrop').addEventListener('click', () => {
      document.getElementById('appShell').classList.remove('sidebar-mobile-open');
    });
    if (Storage.get(STORAGE_KEYS.sidebarCollapsed, false)) {
      document.getElementById('appShell').classList.add('sidebar-collapsed');
    }
  }
};

/* ---------------------------------------------------------------
   Popovers (notifications / profile menu) — small shared helper
--------------------------------------------------------------- */
const Popovers = {
  all: [],
  register(btnId, popId) {
    const btn = document.getElementById(btnId);
    const pop = document.getElementById(popId);
    if (!btn || !pop) return;
    this.all.push(pop);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = pop.classList.contains('open');
      this.closeAll();
      if (!wasOpen) pop.classList.add('open');
    });
    pop.addEventListener('click', (e) => e.stopPropagation());
  },
  closeAll() {
    this.all.forEach(p => p.classList.remove('open'));
  },
  init() {
    this.register('notifBtn', 'notifPopover');
    this.register('profileBtn', 'profilePopover');
    document.addEventListener('click', () => this.closeAll());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeAll(); });
  }
};

/* ---------------------------------------------------------------
   Row menu — a single shared floating "more actions" dropdown,
   anchored to whichever table row's kebab button was clicked.
   Reused by any module that needs contextual workflow actions
   (Resume Management's Accept / Reject / Move to Screening, and
   future phases) without cluttering each row with extra icons.
--------------------------------------------------------------- */
const RowMenu = {
  el: null,
  init() {
    this.el = document.createElement('div');
    this.el.className = 'row-menu';
    this.el.hidden = true;
    document.body.appendChild(this.el);
    document.addEventListener('click', (e) => { if (!this.el.contains(e.target)) this.close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
    window.addEventListener('resize', () => this.close());
  },
  open(anchorEl, items) {
    // items: [{ label, onClick, disabled }]
    this.el.innerHTML = items.map((it, i) =>
      '<div class="row-menu-item' + (it.disabled ? ' disabled' : '') + (it.danger ? ' danger-item' : '') + '" data-idx="' + i + '">' +
      Utils.escapeHtml(it.label) + '</div>'
    ).join('');
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = 190;
    this.el.style.top = (window.scrollY + rect.bottom + 4) + 'px';
    this.el.style.left = (window.scrollX + rect.right - menuWidth) + 'px';
    this.el.hidden = false;
    this.el.querySelectorAll('.row-menu-item').forEach((elItem, i) => {
      if (items[i].disabled) return;
      elItem.addEventListener('click', () => { this.close(); items[i].onClick(); });
    });
  },
  close() {
    if (this.el) this.el.hidden = true;
  }
};

/* ---------------------------------------------------------------
   8. ACTIVITY LOG + NOTIFICATION CENTER
--------------------------------------------------------------- */
const Activity = {
  MAX_ENTRIES: 50,

  log(text) {
    const entries = Storage.get(STORAGE_KEYS.activityLog, []);
    entries.unshift({ id: Utils.uuid(), text, ts: Date.now(), read: false });
    if (entries.length > this.MAX_ENTRIES) entries.length = this.MAX_ENTRIES;
    Storage.set(STORAGE_KEYS.activityLog, entries);
    this.renderNotifDot();
  },

  getAll() {
    return Storage.get(STORAGE_KEYS.activityLog, []);
  },

  renderNotifDot() {
    const entries = this.getAll();
    const hasUnread = entries.some(e => !e.read);
    document.getElementById('notifDot').hidden = !hasUnread;
  },

  renderNotifList() {
    const list = document.getElementById('notifList');
    const entries = this.getAll();
    if (!entries.length) {
      list.innerHTML = '<div class="popover-empty">You\u2019re all caught up.</div>';
      return;
    }
    list.innerHTML = entries.slice(0, 10).map(e =>
      '<div class="notif-item"><div class="notif-title">' + Utils.escapeHtml(e.text) +
      '</div><div class="notif-time">' + Utils.timeAgo(e.ts) + '</div></div>'
    ).join('');
    entries.forEach(e => { e.read = true; });
    Storage.set(STORAGE_KEYS.activityLog, entries);
  },

  clear() {
    Storage.set(STORAGE_KEYS.activityLog, []);
    this.renderNotifList();
    this.renderNotifDot();
    Dashboard.renderRecentActivities();
  },

  init() {
    document.getElementById('notifBtn').addEventListener('click', () => this.renderNotifList());
    document.getElementById('clearNotifsBtn').addEventListener('click', () => this.clear());
    this.renderNotifDot();
  }
};

/* ---------------------------------------------------------------
   9. DASHBOARD
--------------------------------------------------------------- */
const Dashboard = {
  render() {
    this.renderKpis();
    this.renderRecentActivities();
    this.renderUpcomingInterviews();
    this.renderUpcomingJoining();
    this.renderQuickActions();
  },

  renderKpis() {
    const vacancies = VacancyModule.getAll();
    const openPostings = vacancies.filter(v => v.status === 'Open' || v.status === 'In Progress');
    const totalOpenings = openPostings.reduce((sum, v) => sum + (Number(v.vacanciesCount) || 0), 0);

    const schedules = ShortlistModule.getAll();
    let pendingInterviews, pendingSub;
    if (schedules.length) {
      pendingInterviews = schedules.filter(s =>
        Utils.isFutureOrToday(s.interviewDate) && (s.status === 'Scheduled' || s.status === 'Rescheduled')
      ).length;
      pendingSub = 'from the interview schedule';
    } else {
      pendingInterviews = vacancies.filter(v =>
        Utils.isFutureOrToday(v.interviewDate) && (v.status === 'Open' || v.status === 'In Progress')
      ).length;
      pendingSub = 'from scheduled vacancies';
    }

    const iconWrap = (svgInner) => '<svg width="17" height="17" viewBox="0 0 24 24" fill="none">' + svgInner + '</svg>';

    const employees = EmployeeModule.getAll();
    const activeEmployees = employees.filter(e => e.status === 'Active').length;

    let attendanceValue = '—', attendanceSub = 'Unlocks in Phase 10';
    let attendanceBg = 'var(--neutral-bg)', attendanceColor = 'var(--neutral)';
    if (activeEmployees > 0) {
      const today = Utils.todayStr();
      if (AttendanceModule.isWeekend(today)) {
        attendanceValue = 'Weekend'; attendanceSub = 'company non-working day';
      } else if (AttendanceModule.isHoliday(today)) {
        attendanceValue = 'Holiday'; attendanceSub = 'company non-working day';
      } else {
        const activeList = employees.filter(e => e.status === 'Active');
        const presentToday = activeList.filter(e => {
          const s = AttendanceModule.getEffectiveStatus(e.id, today);
          return s === 'Present' || s === 'Late Entry';
        }).length;
        attendanceValue = presentToday + ' / ' + activeEmployees;
        attendanceSub = 'employees present today';
        attendanceBg = 'var(--info-bg)'; attendanceColor = 'var(--info)';
      }
    }

    let onLeaveValue = '—', onLeaveSub = 'Unlocks in Phase 11';
    let onLeaveBg = 'var(--neutral-bg)', onLeaveColor = 'var(--neutral)';
    if (activeEmployees > 0 && LeaveModule.getAll().length > 0) {
      const today = Utils.todayStr();
      const onLeaveCount = employees.filter(e => e.status === 'Active' && LeaveModule.getAll().some(l =>
        l.employeeId === e.id && l.status === 'Approved' && l.startDate <= today && l.endDate >= today
      )).length;
      onLeaveValue = String(onLeaveCount);
      onLeaveSub = 'out of ' + activeEmployees + ' active';
      onLeaveBg = 'var(--warning-bg)'; onLeaveColor = 'var(--warning)';
    }

    let payrollPendingValue = '—', payrollPendingSub = 'Unlocks in Phase 12';
    let payrollCompletedValue = '—', payrollCompletedSub = 'Unlocks in Phase 12';
    let payrollPendingBg = 'var(--neutral-bg)', payrollPendingColor = 'var(--neutral)';
    let payrollCompletedBg = 'var(--neutral-bg)', payrollCompletedColor = 'var(--neutral)';
    const thisMonthPayroll = PayrollModule.getAll().filter(p => p.month === Utils.todayStr().slice(0, 7));
    if (thisMonthPayroll.length > 0) {
      const pending = thisMonthPayroll.filter(p => p.status !== 'Paid').length;
      const paid = thisMonthPayroll.filter(p => p.status === 'Paid').length;
      payrollPendingValue = String(pending); payrollPendingSub = 'this month, not yet paid';
      payrollCompletedValue = String(paid); payrollCompletedSub = 'paid this month';
      payrollPendingBg = 'var(--warning-bg)'; payrollPendingColor = 'var(--warning)';
      payrollCompletedBg = 'var(--success-bg)'; payrollCompletedColor = 'var(--success)';
    }

    const cards = [
      { label: 'Total Employees', value: employees.length ? String(employees.length) : '—', sub: employees.length ? 'across all departments' : 'Unlocks in Phase 9', icon: ICONS.employee, bg: employees.length ? 'var(--info-bg)' : 'var(--neutral-bg)', color: employees.length ? 'var(--info)' : 'var(--neutral)' },
      { label: 'Active Employees', value: employees.length ? String(activeEmployees) : '—', sub: employees.length ? (employees.length - activeEmployees) + ' inactive' : 'Unlocks in Phase 9', icon: ICONS.employee, bg: employees.length ? 'var(--success-bg)' : 'var(--neutral-bg)', color: employees.length ? 'var(--success)' : 'var(--neutral)' },
      { label: 'Open Vacancies', value: String(totalOpenings), sub: openPostings.length + ' active posting' + (openPostings.length === 1 ? '' : 's'), icon: ICONS.vacancy, bg: 'var(--info-bg)', color: 'var(--info)' },
      { label: 'Pending Interviews', value: String(pendingInterviews), sub: pendingSub, icon: ICONS.interview, bg: 'var(--warning-bg)', color: 'var(--warning)' },
      { label: 'Attendance Today', value: attendanceValue, sub: attendanceSub, icon: ICONS.attendance, bg: attendanceBg, color: attendanceColor },
      { label: 'Employees On Leave', value: onLeaveValue, sub: onLeaveSub, icon: ICONS.leave, bg: onLeaveBg, color: onLeaveColor },
      { label: 'Payroll Pending', value: payrollPendingValue, sub: payrollPendingSub, icon: ICONS.payroll, bg: payrollPendingBg, color: payrollPendingColor },
      { label: 'Payroll Completed', value: payrollCompletedValue, sub: payrollCompletedSub, icon: ICONS.payroll, bg: payrollCompletedBg, color: payrollCompletedColor }
    ];

    document.getElementById('kpiGrid').innerHTML = cards.map(c =>
      '<div class="kpi-card">' +
      '<div class="kpi-top">' +
      '<span class="kpi-label">' + c.label + '</span>' +
      '<span class="kpi-icon" style="background:' + c.bg + ';color:' + c.color + '">' + iconWrap(c.icon) + '</span>' +
      '</div>' +
      '<div class="kpi-value">' + c.value + '</div>' +
      '<div class="kpi-sub">' + c.sub + '</div>' +
      '</div>'
    ).join('');
  },

  renderRecentActivities() {
    const el = document.getElementById('recentActivities');
    const entries = Activity.getAll().slice(0, 6);
    if (!entries.length) {
      el.innerHTML = '<div class="empty-state small">No activity yet. Actions you take will show up here.</div>';
      return;
    }
    el.innerHTML = entries.map(e =>
      '<div class="activity-item"><span class="activity-dot"></span><div>' +
      '<div class="activity-text">' + Utils.escapeHtml(e.text) + '</div>' +
      '<div class="activity-time">' + Utils.timeAgo(e.ts) + '</div>' +
      '</div></div>'
    ).join('');
  },

  renderUpcomingInterviews() {
    const el = document.getElementById('upcomingInterviews');
    const schedules = ShortlistModule.getAll();

    if (schedules.length) {
      const upcoming = schedules
        .filter(s => Utils.isFutureOrToday(s.interviewDate) && (s.status === 'Scheduled' || s.status === 'Rescheduled'))
        .sort((a, b) => a.interviewDate.localeCompare(b.interviewDate))
        .slice(0, 6);
      if (!upcoming.length) {
        el.innerHTML = '<div class="empty-state small">No interviews scheduled.</div>';
        return;
      }
      el.innerHTML = upcoming.map(s =>
        '<div class="interview-item"><div>' +
        '<div class="interview-role">' + Utils.escapeHtml(s.candidateName) + '</div>' +
        '<div class="interview-dept">' + Utils.escapeHtml(s.appliedForDesignation) + ' · ' + Utils.escapeHtml(s.assignedHR) + '</div>' +
        '</div><span class="interview-date-chip">' + Utils.formatDate(s.interviewDate) + '</span></div>'
      ).join('');
      return;
    }

    const vacancies = VacancyModule.getAll()
      .filter(v => Utils.isFutureOrToday(v.interviewDate) && (v.status === 'Open' || v.status === 'In Progress'))
      .sort((a, b) => a.interviewDate.localeCompare(b.interviewDate))
      .slice(0, 6);
    if (!vacancies.length) {
      el.innerHTML = '<div class="empty-state small">No interviews scheduled.</div>';
      return;
    }
    el.innerHTML = vacancies.map(v =>
      '<div class="interview-item"><div>' +
      '<div class="interview-role">' + Utils.escapeHtml(v.designation) + '</div>' +
      '<div class="interview-dept">' + Utils.escapeHtml(v.department) + '</div>' +
      '</div><span class="interview-date-chip">' + Utils.formatDate(v.interviewDate) + '</span></div>'
    ).join('');
  },

  renderUpcomingJoining() {
    const el = document.getElementById('upcomingJoining');
    const offers = OfferModule.getAll();
    const upcoming = JoiningModule.getAll()
      .filter(j => j.status !== 'Completed')
      .map(j => ({ checklist: j, joiningDate: (offers.find(o => o.id === j.offerId) || {}).joiningDate || '' }))
      .filter(x => x.joiningDate && Utils.isFutureOrToday(x.joiningDate))
      .sort((a, b) => a.joiningDate.localeCompare(b.joiningDate))
      .slice(0, 6);

    if (!upcoming.length) {
      el.innerHTML = '<div class="empty-state small">No upcoming joinings.</div>';
      return;
    }
    el.innerHTML = upcoming.map(x =>
      '<div class="interview-item"><div>' +
      '<div class="interview-role">' + Utils.escapeHtml(x.checklist.candidateName) + '</div>' +
      '<div class="interview-dept">' + Utils.escapeHtml(x.checklist.appliedForDesignation) +
      (x.checklist.department ? ' \u00b7 ' + Utils.escapeHtml(x.checklist.department) : '') + '</div>' +
      '</div><span class="interview-date-chip">' + Utils.formatDate(x.joiningDate) + '</span></div>'
    ).join('');
  },

  renderQuickActions() {
    const el = document.getElementById('quickActions');
    const actions = [
      { label: 'Create Job Vacancy', route: 'vacancy', icon: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
      { label: 'View All Vacancies', route: 'vacancy', icon: ICONS.vacancy },
      { label: 'Receive Resumes', route: 'resume', icon: ICONS.resume },
      { label: 'Simulator Settings', route: 'settings', icon: ICONS.settings }
    ];
    el.innerHTML = actions.map(a =>
      '<div class="quick-action-btn" data-qa-route="' + a.route + '">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">' + a.icon + '</svg>' +
      '<span>' + a.label + '</span></div>'
    ).join('');
    el.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-qa-route');
        const phase = PHASES.find(p => p.key === route);
        if (phase && !Router.isPhaseUnlocked(phase)) { Router.showLocked(phase.label, phase.id); return; }
        Router.go(route);
      });
    });
  }
};

/* ---------------------------------------------------------------
   10. PHASE 1 — JOB VACANCY MANAGEMENT
--------------------------------------------------------------- */
const VacancyModule = {
  state: {
    search: '',
    department: '',
    status: '',
    sortKey: 'interviewDate',
    sortDir: 'asc',
    page: 1,
    pageSize: 8,
    editingId: null,
    skills: []
  },

  STATUS_OPTIONS: ['Open', 'In Progress', 'On Hold', 'Closed'],

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.vacancies, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.vacancies, list);
  },
  nextId() {
    const counter = Storage.get(STORAGE_KEYS.vacancyCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.vacancyCounter, counter);
    const year = new Date().getFullYear();
    return 'VAC-' + year + '-' + Utils.pad(counter, 4);
  },

  /* ---------- init ---------- */
  init() {
    this.populateDropdowns();
    this.bindToolbar();
    this.bindForm();
    this.bindModals();
    document.getElementById('newVacancyBtn').addEventListener('click', () => this.openForm());
    document.getElementById('emptyStateNewVacancyBtn').addEventListener('click', () => this.openForm());
    document.getElementById('loadSampleDataBtn').addEventListener('click', () => this.loadSampleData());
    document.getElementById('exportVacancyBtn').addEventListener('click', () => {
      Toast.show('Export is a UI preview in this simulator — no file is generated.', 'info');
    });
  },

  populateDropdowns() {
    const deptOptions = DEPARTMENTS.map(d => '<option>' + Utils.escapeHtml(d) + '</option>').join('');
    document.getElementById('f_department').insertAdjacentHTML('beforeend', deptOptions);
    document.getElementById('filterDepartment').insertAdjacentHTML('beforeend', deptOptions);
    const qualOptions = QUALIFICATIONS.map(q => '<option>' + Utils.escapeHtml(q) + '</option>').join('');
    document.getElementById('f_qualification').insertAdjacentHTML('beforeend', qualOptions);
  },

  bindToolbar() {
    const searchInput = document.getElementById('vacancySearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.render();
    }, 200));

    document.getElementById('filterDepartment').addEventListener('change', (e) => {
      this.state.department = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('filterStatus').addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.department = ''; this.state.status = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterDepartment').value = '';
      document.getElementById('filterStatus').value = '';
      this.render();
    });

    document.querySelectorAll('#vacancyTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'asc';
        }
        this.render();
      });
    });
  },

  bindModals() {
    document.getElementById('vacancyModalCloseBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('vacancyCancelBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('vacancyModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'vacancyModalOverlay') this.closeForm();
    });
    document.getElementById('viewModalCloseBtn').addEventListener('click', () => this.closeView());
    document.getElementById('viewModalCloseBtn2').addEventListener('click', () => this.closeView());
    document.getElementById('viewModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'viewModalOverlay') this.closeView();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('vacancyModalOverlay').hidden) this.closeForm();
      if (!document.getElementById('viewModalOverlay').hidden) this.closeView();
    });
  },

  /* ---------- skills tag input ---------- */
  bindForm() {
    const skillInput = document.getElementById('f_skillsInput');
    skillInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = skillInput.value.trim().replace(/,$/, '');
        if (val && !this.state.skills.includes(val)) {
          this.state.skills.push(val);
          this.renderSkillTags();
        }
        skillInput.value = '';
      } else if (e.key === 'Backspace' && !skillInput.value) {
        this.state.skills.pop();
        this.renderSkillTags();
      }
    });

    document.getElementById('vacancyForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });
  },

  renderSkillTags() {
    const wrap = document.getElementById('skillsTagList');
    wrap.innerHTML = this.state.skills.map((s, i) =>
      '<span class="tag-chip">' + Utils.escapeHtml(s) +
      '<button type="button" data-skill-index="' + i + '" aria-label="Remove ' + Utils.escapeHtml(s) + '">' +
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>' +
      '</button></span>'
    ).join('');
    document.getElementById('f_skills').value = JSON.stringify(this.state.skills);
    wrap.querySelectorAll('button[data-skill-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.skills.splice(Number(btn.getAttribute('data-skill-index')), 1);
        this.renderSkillTags();
      });
    });
  },

  /* ---------- form open/close ---------- */
  openForm(vacancy) {
    const form = document.getElementById('vacancyForm');
    form.reset();
    this.clearErrors();
    this.state.skills = vacancy ? [...(vacancy.skills || [])] : [];
    this.renderSkillTags();

    if (vacancy) {
      this.state.editingId = vacancy.id;
      document.getElementById('vacancyModalTitle').textContent = 'Edit Job Vacancy — ' + vacancy.id;
      document.getElementById('f_department').value = vacancy.department;
      document.getElementById('f_designation').value = vacancy.designation;
      document.getElementById('f_employmentType').value = vacancy.employmentType;
      document.getElementById('f_qualification').value = vacancy.qualification;
      document.getElementById('f_expMin').value = vacancy.expMin;
      document.getElementById('f_expMax').value = vacancy.expMax;
      document.getElementById('f_salaryMin').value = vacancy.salaryMin;
      document.getElementById('f_salaryMax').value = vacancy.salaryMax;
      document.getElementById('f_vacanciesCount').value = vacancy.vacanciesCount;
      document.getElementById('f_location').value = vacancy.location;
      document.getElementById('f_reportingManager').value = vacancy.reportingManager;
      document.getElementById('f_interviewDate').value = vacancy.interviewDate;
      document.getElementById('f_status').value = vacancy.status;
    } else {
      this.state.editingId = null;
      document.getElementById('vacancyModalTitle').textContent = 'New Job Vacancy';
      document.getElementById('f_status').value = 'Open';
    }
    document.getElementById('vacancyModalOverlay').hidden = false;
    setTimeout(() => document.getElementById('f_department').focus(), 30);
  },

  closeForm() {
    document.getElementById('vacancyModalOverlay').hidden = true;
  },

  openView(vacancy) {
    document.getElementById('viewModalTitle').textContent = vacancy.designation + ' — ' + vacancy.id;
    const skillsHtml = (vacancy.skills || []).map(s => '<span class="mini-tag">' + Utils.escapeHtml(s) + '</span>').join(' ');
    document.getElementById('viewModalBody').innerHTML =
      '<div class="detail-grid">' +
      this.detailItem('Vacancy ID', vacancy.id) +
      this.detailItem('Status', this.statusBadge(vacancy.status)) +
      this.detailItem('Department', vacancy.department) +
      this.detailItem('Designation', vacancy.designation) +
      this.detailItem('Employment Type', vacancy.employmentType) +
      this.detailItem('Qualification', vacancy.qualification) +
      this.detailItem('Experience', vacancy.expMin + ' – ' + vacancy.expMax + ' yrs') +
      this.detailItem('Salary Range', Utils.formatCurrency(vacancy.salaryMin) + ' – ' + Utils.formatCurrency(vacancy.salaryMax) + ' / month') +
      this.detailItem('Number of Vacancies', String(vacancy.vacanciesCount)) +
      this.detailItem('Location', vacancy.location) +
      this.detailItem('Reporting Manager', vacancy.reportingManager) +
      this.detailItem('Interview Date', Utils.formatDate(vacancy.interviewDate)) +
      '<div class="detail-item detail-full">' +
      '<span class="detail-label">Skills</span>' +
      '<div class="detail-value">' + (skillsHtml || '—') + '</div></div>' +
      this.detailItem('Created', new Date(vacancy.createdAt).toLocaleString('en-IN')) +
      this.detailItem('Last Updated', new Date(vacancy.updatedAt).toLocaleString('en-IN')) +
      '</div>';
    document.getElementById('viewModalOverlay').hidden = false;
  },

  detailItem(label, value) {
    return '<div class="detail-item"><span class="detail-label">' + Utils.escapeHtml(label) +
      '</span><span class="detail-value">' + (typeof value === 'string' ? Utils.escapeHtml(value) : value) + '</span></div>';
  },

  closeView() {
    document.getElementById('viewModalOverlay').hidden = true;
  },

  /* ---------- validation ---------- */
  clearErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.form-field input, .form-field select').forEach(el => el.classList.remove('invalid'));
  },

  setError(fieldId, errId, message) {
    document.getElementById(errId).textContent = message;
    const field = document.getElementById(fieldId);
    if (field) field.classList.add('invalid');
  },

  validate() {
    this.clearErrors();
    let valid = true;
    const val = (id) => document.getElementById(id).value.trim();

    if (!val('f_department')) { this.setError('f_department', 'err_department', 'Department is required.'); valid = false; }
    if (!val('f_designation')) { this.setError('f_designation', 'err_designation', 'Designation is required.'); valid = false; }
    if (!val('f_employmentType')) { this.setError('f_employmentType', 'err_employmentType', 'Employment type is required.'); valid = false; }
    if (!val('f_qualification')) { this.setError('f_qualification', 'err_qualification', 'Qualification is required.'); valid = false; }

    const expMin = val('f_expMin'), expMax = val('f_expMax');
    if (expMin === '' || expMax === '') {
      this.setError('f_expMin', 'err_experience', 'Enter both minimum and maximum experience.'); valid = false;
    } else if (Number(expMin) < 0 || Number(expMax) < 0) {
      this.setError('f_expMin', 'err_experience', 'Experience cannot be negative.'); valid = false;
    } else if (Number(expMin) > Number(expMax)) {
      this.setError('f_expMin', 'err_experience', 'Minimum experience cannot exceed maximum.'); valid = false;
    }

    const salMin = val('f_salaryMin'), salMax = val('f_salaryMax');
    if (salMin === '' || salMax === '') {
      this.setError('f_salaryMin', 'err_salary', 'Enter both minimum and maximum salary.'); valid = false;
    } else if (Number(salMin) <= 0 || Number(salMax) <= 0) {
      this.setError('f_salaryMin', 'err_salary', 'Salary must be greater than zero.'); valid = false;
    } else if (Number(salMin) > Number(salMax)) {
      this.setError('f_salaryMin', 'err_salary', 'Minimum salary cannot exceed maximum.'); valid = false;
    }

    const vc = val('f_vacanciesCount');
    if (!vc || Number(vc) < 1) { this.setError('f_vacanciesCount', 'err_vacanciesCount', 'Enter at least 1 vacancy.'); valid = false; }

    if (!val('f_location')) { this.setError('f_location', 'err_location', 'Location is required.'); valid = false; }
    if (!val('f_reportingManager')) { this.setError('f_reportingManager', 'err_reportingManager', 'Reporting manager is required.'); valid = false; }

    if (!val('f_interviewDate')) {
      this.setError('f_interviewDate', 'err_interviewDate', 'Interview date is required.'); valid = false;
    }

    if (!val('f_status')) { this.setError('f_status', 'err_status', 'Status is required.'); valid = false; }

    if (!this.state.skills.length) {
      document.getElementById('err_skills').textContent = 'Add at least one skill.'; valid = false;
    }

    return valid;
  },

  handleSave() {
    if (!this.validate()) {
      Toast.show('Please fix the highlighted fields.', 'error');
      return;
    }
    const val = (id) => document.getElementById(id).value.trim();
    const now = Date.now();
    const list = this.getAll();

    const record = {
      id: this.state.editingId || this.nextId(),
      department: val('f_department'),
      designation: val('f_designation'),
      employmentType: val('f_employmentType'),
      qualification: val('f_qualification'),
      expMin: Number(val('f_expMin')),
      expMax: Number(val('f_expMax')),
      salaryMin: Number(val('f_salaryMin')),
      salaryMax: Number(val('f_salaryMax')),
      vacanciesCount: Number(val('f_vacanciesCount')),
      location: val('f_location'),
      reportingManager: val('f_reportingManager'),
      interviewDate: val('f_interviewDate'),
      status: val('f_status'),
      skills: [...this.state.skills],
      createdAt: this.state.editingId ? (list.find(v => v.id === this.state.editingId) || {}).createdAt || now : now,
      updatedAt: now
    };

    if (this.state.editingId) {
      const idx = list.findIndex(v => v.id === this.state.editingId);
      if (idx > -1) list[idx] = record;
      Activity.log('Vacancy ' + record.id + ' (' + record.designation + ') updated');
      Toast.show('Vacancy ' + record.id + ' updated.', 'success');
    } else {
      // Safety net: IDs are auto-generated and sequential, but guard against
      // duplicates in case of manual storage tampering between sessions.
      if (list.some(v => v.id === record.id)) {
        Toast.show('A vacancy with this ID already exists. Please try saving again.', 'error');
        return;
      }
      list.unshift(record);
      Activity.log('Vacancy ' + record.id + ' (' + record.designation + ') created');
      Toast.show('Vacancy ' + record.id + ' created.', 'success');
    }

    this.saveAll(list);
    this.closeForm();
    this.render();
    Dashboard.render();
  },

  async handleDelete(id) {
    const list = this.getAll();
    const vacancy = list.find(v => v.id === id);
    if (!vacancy) return;
    const confirmed = await Confirm.ask(
      'Delete this vacancy?',
      vacancy.id + ' — ' + vacancy.designation + ' will be permanently removed.',
      'Delete'
    );
    if (!confirmed) return;
    this.saveAll(list.filter(v => v.id !== id));
    Activity.log('Vacancy ' + vacancy.id + ' (' + vacancy.designation + ') deleted');
    Toast.show('Vacancy ' + vacancy.id + ' deleted.', 'success');
    this.render();
    Dashboard.render();
  },

  quickStatusChange(id, newStatus) {
    const list = this.getAll();
    const idx = list.findIndex(v => v.id === id);
    if (idx === -1) return;
    list[idx].status = newStatus;
    list[idx].updatedAt = Date.now();
    this.saveAll(list);
    Activity.log('Vacancy ' + list[idx].id + ' marked as ' + newStatus);
    Toast.show(list[idx].id + ' marked as ' + newStatus + '.', 'success');
    this.render();
    Dashboard.render();
  },

  loadSampleData() {
    const today = new Date();
    const inDays = (n) => {
      const d = new Date(today);
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const samples = [
      {
        department: 'Human Resources', designation: 'HR Executive', employmentType: 'Full-Time',
        qualification: 'Any Graduate', expMin: 1, expMax: 3, salaryMin: 18000, salaryMax: 25000,
        vacanciesCount: 2, location: 'Kochi, Kerala', reportingManager: 'Meera Pillai',
        interviewDate: inDays(5), status: 'Open', skills: ['Recruitment', 'HRMS', 'Communication']
      },
      {
        department: 'Finance & Accounts', designation: 'Senior Accountant', employmentType: 'Full-Time',
        qualification: 'B.Com', expMin: 3, expMax: 6, salaryMin: 30000, salaryMax: 45000,
        vacanciesCount: 1, location: 'Thiruvananthapuram, Kerala', reportingManager: 'Rahul Menon',
        interviewDate: inDays(9), status: 'In Progress', skills: ['Tally', 'GST', 'Excel']
      },
      {
        department: 'Logistics & Supply Chain', designation: 'Logistics Coordinator', employmentType: 'Contract',
        qualification: 'Diploma', expMin: 0, expMax: 2, salaryMin: 20000, salaryMax: 28000,
        vacanciesCount: 3, location: 'Kozhikode, Kerala', reportingManager: 'Anoop Thomas',
        interviewDate: inDays(2), status: 'Open', skills: ['Inventory Management', 'MS Excel', 'Coordination']
      }
    ];
    const list = this.getAll();
    samples.forEach(s => {
      const now = Date.now();
      list.unshift(Object.assign({ id: this.nextId(), createdAt: now, updatedAt: now }, s));
    });
    this.saveAll(list);
    Activity.log('Loaded 3 sample vacancies');
    Toast.show('3 sample vacancies added.', 'success');
    this.render();
    Dashboard.render();
  },

  /* ---------- rendering ---------- */
  statusBadge(status) {
    const map = {
      'Open': 'badge-success', 'In Progress': 'badge-info',
      'On Hold': 'badge-warning', 'Closed': 'badge-danger'
    };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + Utils.escapeHtml(status) + '</span>';
  },

  getFilteredSorted() {
    let list = this.getAll();
    const { search, department, status, sortKey, sortDir } = this.state;

    if (search) {
      list = list.filter(v =>
        (v.designation || '').toLowerCase().includes(search) ||
        (v.department || '').toLowerCase().includes(search) ||
        (v.location || '').toLowerCase().includes(search) ||
        (v.id || '').toLowerCase().includes(search)
      );
    }
    if (department) list = list.filter(v => v.department === department);
    if (status) list = list.filter(v => v.status === status);

    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av, bv;
      if (sortKey === 'experience') { av = a.expMin; bv = b.expMin; }
      else if (sortKey === 'salary') { av = a.salaryMin; bv = b.salaryMin; }
      else { av = a[sortKey]; bv = b[sortKey]; }
      if (av === undefined) av = '';
      if (bv === undefined) bv = '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  render() {
    const all = this.getAll();
    this.renderStatusStrip(all);

    // keep filter dropdown options in sync (kept static since DEPARTMENTS is fixed)
    document.getElementById('filterDepartment').value = this.state.department;
    document.getElementById('filterStatus').value = this.state.status;
    document.getElementById('vacancySearch').value = this.state.search;

    const filtered = this.getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('vacancyEmptyState').hidden = all.length !== 0;
    document.querySelector('#vacancyTable').style.display = all.length === 0 ? 'none' : '';

    document.getElementById('vacancyTableBody').innerHTML = pageItems.map(v => this.rowHtml(v)).join('');

    document.querySelectorAll('#vacancyTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort')
        ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('vacancyTableCount').textContent =
      filtered.length === 0 ? 'No vacancies match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  renderStatusStrip(all) {
    const counts = { Open: 0, 'In Progress': 0, 'On Hold': 0, Closed: 0 };
    all.forEach(v => { if (counts[v.status] !== undefined) counts[v.status]++; });
    const strip = document.getElementById('vacancyStatusStrip');
    strip.innerHTML =
      this.chip('open', 'Open', counts.Open) +
      this.chip('progress', 'In Progress', counts['In Progress']) +
      this.chip('hold', 'On Hold', counts['On Hold']) +
      this.chip('closed', 'Closed', counts.Closed);
  },

  chip(cls, label, count) {
    return '<div class="status-chip ' + cls + '"><span class="status-chip-count">' + count +
      '</span><span class="status-chip-label">' + label + '</span></div>';
  },

  rowHtml(v) {
    const skillsHtml = (v.skills || []).slice(0, 2).map(s => '<span class="mini-tag">' + Utils.escapeHtml(s) + '</span>').join('');
    return (
      '<tr data-id="' + Utils.escapeHtml(v.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(v.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(v.designation) + '</td>' +
      '<td>' + Utils.escapeHtml(v.department) + '</td>' +
      '<td>' + Utils.escapeHtml(v.employmentType) + '</td>' +
      '<td class="cell-secondary">' + v.expMin + '–' + v.expMax + ' yrs</td>' +
      '<td>' + v.vacanciesCount + '</td>' +
      '<td class="cell-secondary">' + Utils.formatCurrency(v.salaryMin) + '–' + Utils.formatCurrency(v.salaryMax) + '</td>' +
      '<td>' + Utils.escapeHtml(v.location) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatDate(v.interviewDate) + '</td>' +
      '<td>' + this.statusBadge(v.status) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      this.rowActionBtn('view', v.id, 'View', '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/>') +
      this.rowActionBtn('edit', v.id, 'Edit', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>') +
      this.rowActionBtn('delete', v.id, 'Delete', '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', true) +
      this.rowActionBtn('more', v.id, 'More actions', '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>') +
      '</div></td>' +
      '</tr>' +
      '<tr class="row-skills-hint" data-skills-for="' + Utils.escapeHtml(v.id) + '" style="display:none;"><td colspan="11">' + skillsHtml + '</td></tr>'
    );
  },

  rowActionBtn(action, id, title, iconPath, danger) {
    return '<button class="row-action-btn' + (danger ? ' danger' : '') + '" data-action="' + action + '" data-id="' +
      Utils.escapeHtml(id) + '" title="' + title + '" aria-label="' + title + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' + iconPath + '</svg></button>';
  },

  bindRowActions() {
    document.querySelectorAll('#vacancyTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const vacancy = this.getAll().find(v => v.id === id);
        if (!vacancy) return;
        if (action === 'view') this.openView(vacancy);
        if (action === 'edit') this.openForm(vacancy);
        if (action === 'delete') this.handleDelete(id);
        if (action === 'more') {
          e.stopPropagation();
          RowMenu.open(btn, this.STATUS_OPTIONS
            .filter(s => s !== vacancy.status)
            .map(s => ({ label: 'Mark as ' + s, danger: s === 'Closed', onClick: () => this.quickStatusChange(id, s) })));
        }
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('vacancyPagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.render();
      });
    });
  }
};

/* ---------------------------------------------------------------
   11. PHASE 2 — RESUME MANAGEMENT
--------------------------------------------------------------- */
const ResumeModule = {
  state: {
    search: '',
    vacancyId: '',
    status: '',
    sortKey: 'name',
    sortDir: 'asc',
    page: 1,
    pageSize: 8,
    editingId: null,
    skills: []
  },

  STATUSES: ['Received', 'Accepted', 'Rejected', 'Moved to Screening'],

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.resumes, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.resumes, list);
  },
  nextId() {
    const counter = Storage.get(STORAGE_KEYS.resumeCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.resumeCounter, counter);
    const year = new Date().getFullYear();
    return 'RES-' + year + '-' + Utils.pad(counter, 4);
  },

  /* ---------- init ---------- */
  init() {
    const qualOptions = QUALIFICATIONS.map(q => '<option>' + Utils.escapeHtml(q) + '</option>').join('');
    document.getElementById('r_education').insertAdjacentHTML('beforeend', qualOptions);

    this.bindToolbar();
    this.bindForm();
    this.bindModals();
    document.getElementById('newResumeBtn').addEventListener('click', () => this.openForm());
    document.getElementById('emptyStateNewResumeBtn').addEventListener('click', () => this.openForm());
    document.getElementById('loadSampleResumeDataBtn').addEventListener('click', () => this.loadSampleData());
    document.getElementById('exportResumeBtn').addEventListener('click', () => {
      Toast.show('Export is a UI preview in this simulator — no file is generated.', 'info');
    });
  },

  /* ---------- vacancy <-> resume linkage helpers ---------- */
  vacancyOptionsHtml(selectedId, fallbackLabel) {
    const vacancies = VacancyModule.getAll();
    let html = vacancies.map(v =>
      '<option value="' + Utils.escapeHtml(v.id) + '"' + (v.id === selectedId ? ' selected' : '') + '>' +
      Utils.escapeHtml(v.designation) + ' (' + Utils.escapeHtml(v.id) + ')</option>'
    ).join('');
    if (selectedId && !vacancies.some(v => v.id === selectedId)) {
      html += '<option value="' + Utils.escapeHtml(selectedId) + '" selected disabled>' +
        Utils.escapeHtml(fallbackLabel || selectedId) + ' (vacancy deleted)</option>';
    }
    return html;
  },

  populateFilterVacancyOptions() {
    const select = document.getElementById('filterVacancy');
    const current = this.state.vacancyId;
    select.innerHTML = '<option value="">All Vacancies</option>' + this.vacancyOptionsHtml(current || null);
    select.value = current;
  },

  /* ---------- resume score suggestion (Phase 3 will replace this with the full breakdown scorer) ---------- */
  computeScore(vacancy, education, experienceYears, skills) {
    if (!vacancy) return 50;
    let eduScore = education === vacancy.qualification ? 20 : 8;

    let expScore;
    const min = vacancy.expMin, max = vacancy.expMax;
    if (experienceYears >= min && experienceYears <= max) expScore = 30;
    else if (experienceYears >= min - 1 && experienceYears <= max + 1) expScore = 20;
    else if (experienceYears >= min - 2 && experienceYears <= max + 2) expScore = 10;
    else expScore = 0;

    let skillScore = 25; // neutral default if vacancy lists no skills
    const vacSkills = (vacancy.skills || []).map(s => s.toLowerCase());
    if (vacSkills.length) {
      const candSkills = (skills || []).map(s => s.toLowerCase());
      const overlap = candSkills.filter(s => vacSkills.includes(s)).length;
      skillScore = Math.round((overlap / vacSkills.length) * 50);
    }

    return Math.max(0, Math.min(100, eduScore + expScore + skillScore));
  },

  /* ---------- toolbar ---------- */
  bindToolbar() {
    const searchInput = document.getElementById('resumeSearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.render();
    }, 200));

    document.getElementById('filterVacancy').addEventListener('change', (e) => {
      this.state.vacancyId = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('filterResumeStatus').addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('clearResumeFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.vacancyId = ''; this.state.status = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterResumeStatus').value = '';
      this.render();
    });

    document.querySelectorAll('#resumeTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'asc';
        }
        this.render();
      });
    });
  },

  bindModals() {
    document.getElementById('resumeModalCloseBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('resumeCancelBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('resumeModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'resumeModalOverlay') this.closeForm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('resumeModalOverlay').hidden) this.closeForm();
    });
  },

  /* ---------- skills tag input ---------- */
  bindForm() {
    const skillInput = document.getElementById('r_skillsInput');
    skillInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = skillInput.value.trim().replace(/,$/, '');
        if (val && !this.state.skills.includes(val)) {
          this.state.skills.push(val);
          this.renderSkillTags();
        }
        skillInput.value = '';
      } else if (e.key === 'Backspace' && !skillInput.value) {
        this.state.skills.pop();
        this.renderSkillTags();
      }
    });

    document.getElementById('r_suggestScoreBtn').addEventListener('click', () => {
      const vacancy = VacancyModule.getAll().find(v => v.id === document.getElementById('r_vacancyId').value);
      if (!vacancy) {
        Toast.show('Select a vacancy first so a score can be suggested.', 'warning');
        return;
      }
      const education = document.getElementById('r_education').value;
      const experienceYears = Number(document.getElementById('r_experienceYears').value) || 0;
      const suggested = this.computeScore(vacancy, education, experienceYears, this.state.skills);
      document.getElementById('r_resumeScore').value = suggested;
    });

    document.getElementById('resumeForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });
  },

  renderSkillTags() {
    const wrap = document.getElementById('r_skillsTagList');
    wrap.innerHTML = this.state.skills.map((s, i) =>
      '<span class="tag-chip">' + Utils.escapeHtml(s) +
      '<button type="button" data-skill-index="' + i + '" aria-label="Remove ' + Utils.escapeHtml(s) + '">' +
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>' +
      '</button></span>'
    ).join('');
    document.getElementById('r_skills').value = JSON.stringify(this.state.skills);
    wrap.querySelectorAll('button[data-skill-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.skills.splice(Number(btn.getAttribute('data-skill-index')), 1);
        this.renderSkillTags();
      });
    });
  },

  /* ---------- form open/close ---------- */
  openForm(candidate) {
    const form = document.getElementById('resumeForm');
    form.reset();
    this.clearErrors();
    this.state.skills = candidate ? [...(candidate.skills || [])] : [];
    this.renderSkillTags();

    const vacancySelect = document.getElementById('r_vacancyId');
    vacancySelect.innerHTML = '<option value="">Select a vacancy</option>' +
      this.vacancyOptionsHtml(candidate ? candidate.vacancyId : null, candidate ? candidate.appliedForDesignation : null);

    if (candidate) {
      this.state.editingId = candidate.id;
      document.getElementById('resumeModalTitle').textContent = 'Edit Candidate — ' + candidate.id;
      vacancySelect.value = candidate.vacancyId;
      document.getElementById('r_name').value = candidate.name;
      document.getElementById('r_phone').value = candidate.phone;
      document.getElementById('r_email').value = candidate.email;
      document.getElementById('r_education').value = candidate.education;
      document.getElementById('r_experienceYears').value = candidate.experienceYears;
      document.getElementById('r_expectedSalary').value = candidate.expectedSalary;
      document.getElementById('r_location').value = candidate.location;
      document.getElementById('r_status').value = candidate.status;
      document.getElementById('r_resumeScore').value = candidate.resumeScore;
    } else {
      this.state.editingId = null;
      document.getElementById('resumeModalTitle').textContent = 'Add Candidate';
      document.getElementById('r_status').value = 'Received';
    }
    document.getElementById('resumeModalOverlay').hidden = false;
    setTimeout(() => vacancySelect.focus(), 30);
  },

  closeForm() {
    document.getElementById('resumeModalOverlay').hidden = true;
  },

  openView(candidate) {
    const initials = (candidate.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const skillsHtml = (candidate.skills || []).map(s => '<span class="mini-tag">' + Utils.escapeHtml(s) + '</span>').join(' ');
    document.getElementById('viewModalTitle').textContent = candidate.name + ' — ' + candidate.id;
    document.getElementById('viewModalBody').innerHTML =
      '<div class="resume-preview-header">' +
      '<div class="resume-preview-avatar">' + Utils.escapeHtml(initials) + '</div>' +
      '<div><div class="resume-preview-name">' + Utils.escapeHtml(candidate.name) + '</div>' +
      '<div class="resume-preview-meta">' + Utils.escapeHtml(candidate.phone) + ' &middot; ' + Utils.escapeHtml(candidate.email) + ' &middot; ' + Utils.escapeHtml(candidate.location) + '</div>' +
      '</div></div>' +
      '<div class="detail-grid">' +
      VacancyModule.detailItem('Candidate ID', candidate.id) +
      VacancyModule.detailItem('Status', this.statusBadge(candidate.status)) +
      VacancyModule.detailItem('Applied For', candidate.appliedForDesignation + ' (' + candidate.vacancyId + ')') +
      VacancyModule.detailItem('Department', candidate.appliedForDepartment || '—') +
      VacancyModule.detailItem('Education', candidate.education) +
      VacancyModule.detailItem('Experience', candidate.experienceYears + ' yrs') +
      VacancyModule.detailItem('Expected Salary', Utils.formatCurrency(candidate.expectedSalary) + ' / month') +
      VacancyModule.detailItem('Resume Score', this.scoreBadge(candidate.resumeScore)) +
      VacancyModule.detailItem('Resume File', candidate.resumeFileName || '—') +
      '<div class="detail-item detail-full"><span class="detail-label">Skills</span>' +
      '<div class="detail-value">' + (skillsHtml || '—') + '</div></div>' +
      VacancyModule.detailItem('Received', new Date(candidate.createdAt).toLocaleString('en-IN')) +
      VacancyModule.detailItem('Last Updated', new Date(candidate.updatedAt).toLocaleString('en-IN')) +
      '</div>';
    document.getElementById('viewModalOverlay').hidden = false;
  },

  /* ---------- validation ---------- */
  clearErrors() {
    ['r_vacancyId', 'r_resumeFile', 'r_name', 'r_phone', 'r_email', 'r_education', 'r_experienceYears',
      'r_expectedSalary', 'r_location', 'r_status', 'r_resumeScore', 'r_skills'].forEach(id => {
      const errEl = document.getElementById('err_' + id);
      if (errEl) errEl.textContent = '';
      const field = document.getElementById(id);
      if (field) field.classList.remove('invalid');
    });
  },

  setError(fieldId, message) {
    const errEl = document.getElementById('err_' + fieldId);
    if (errEl) errEl.textContent = message;
    const field = document.getElementById(fieldId);
    if (field) field.classList.add('invalid');
  },

  validate() {
    this.clearErrors();
    let valid = true;
    const val = (id) => document.getElementById(id).value.trim();

    if (!val('r_vacancyId')) { this.setError('r_vacancyId', 'Select which vacancy this candidate applied for.'); valid = false; }
    if (!val('r_name')) { this.setError('r_name', 'Candidate name is required.'); valid = false; }

    const phoneDigits = val('r_phone').replace(/[^0-9]/g, '');
    if (!val('r_phone')) { this.setError('r_phone', 'Phone number is required.'); valid = false; }
    else if (phoneDigits.length < 10 || phoneDigits.length > 15) { this.setError('r_phone', 'Enter a valid phone number (10-15 digits).'); valid = false; }

    const email = val('r_email');
    if (!email) { this.setError('r_email', 'Email is required.'); valid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this.setError('r_email', 'Enter a valid email address.'); valid = false; }

    if (!val('r_education')) { this.setError('r_education', 'Education is required.'); valid = false; }

    const exp = val('r_experienceYears');
    if (exp === '') { this.setError('r_experienceYears', 'Experience is required.'); valid = false; }
    else if (Number(exp) < 0 || Number(exp) > 45) { this.setError('r_experienceYears', 'Enter a realistic number of years.'); valid = false; }

    const salary = val('r_expectedSalary');
    if (!salary || Number(salary) <= 0) { this.setError('r_expectedSalary', 'Expected salary must be greater than zero.'); valid = false; }

    if (!val('r_location')) { this.setError('r_location', 'Location is required.'); valid = false; }
    if (!val('r_status')) { this.setError('r_status', 'Status is required.'); valid = false; }

    const score = val('r_resumeScore');
    if (score === '') { this.setError('r_resumeScore', 'Resume score is required — use Suggest or enter one manually.'); valid = false; }
    else if (Number(score) < 0 || Number(score) > 100) { this.setError('r_resumeScore', 'Score must be between 0 and 100.'); valid = false; }

    if (!this.state.skills.length) {
      document.getElementById('err_r_skills').textContent = 'Add at least one skill.'; valid = false;
    }

    return valid;
  },

  handleSave() {
    if (!this.validate()) {
      Toast.show('Please fix the highlighted fields.', 'error');
      return;
    }
    const val = (id) => document.getElementById(id).value.trim();
    const now = Date.now();
    const list = this.getAll();
    const vacancy = VacancyModule.getAll().find(v => v.id === val('r_vacancyId'));

    const fileInput = document.getElementById('r_resumeFile');
    const existing = this.state.editingId ? list.find(v => v.id === this.state.editingId) : null;
    let resumeFileName = existing ? existing.resumeFileName : null;
    if (fileInput.files && fileInput.files[0]) {
      resumeFileName = fileInput.files[0].name;
    } else if (!resumeFileName) {
      resumeFileName = val('r_name').replace(/\s+/g, '_') + '_resume.pdf';
    }

    const record = {
      id: this.state.editingId || this.nextId(),
      vacancyId: val('r_vacancyId'),
      appliedForDesignation: vacancy ? vacancy.designation : (existing ? existing.appliedForDesignation : 'Unknown position'),
      appliedForDepartment: vacancy ? vacancy.department : (existing ? existing.appliedForDepartment : ''),
      resumeFileName: resumeFileName,
      name: val('r_name'),
      phone: val('r_phone'),
      email: val('r_email'),
      education: val('r_education'),
      experienceYears: Number(val('r_experienceYears')),
      expectedSalary: Number(val('r_expectedSalary')),
      location: val('r_location'),
      status: val('r_status'),
      resumeScore: Number(val('r_resumeScore')),
      skills: [...this.state.skills],
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };

    if (this.state.editingId) {
      const idx = list.findIndex(v => v.id === this.state.editingId);
      if (idx > -1) list[idx] = record;
      Activity.log('Candidate ' + record.id + ' (' + record.name + ') updated');
      Toast.show('Candidate ' + record.id + ' updated.', 'success');
    } else {
      if (list.some(v => v.id === record.id)) {
        Toast.show('A candidate with this ID already exists. Please try saving again.', 'error');
        return;
      }
      list.unshift(record);
      Activity.log('Candidate ' + record.id + ' (' + record.name + ') received for ' + record.appliedForDesignation);
      Toast.show('Candidate ' + record.id + ' added.', 'success');
    }

    this.saveAll(list);
    this.closeForm();
    this.render();
  },

  async handleDelete(id) {
    const list = this.getAll();
    const candidate = list.find(v => v.id === id);
    if (!candidate) return;
    const confirmed = await Confirm.ask(
      'Delete this candidate?',
      candidate.id + ' — ' + candidate.name + ' will be permanently removed.',
      'Delete'
    );
    if (!confirmed) return;
    this.saveAll(list.filter(v => v.id !== id));
    Activity.log('Candidate ' + candidate.id + ' (' + candidate.name + ') deleted');
    Toast.show('Candidate ' + candidate.id + ' deleted.', 'success');
    this.render();
  },

  changeStatus(id, newStatus) {
    const list = this.getAll();
    const idx = list.findIndex(v => v.id === id);
    if (idx === -1) return;
    list[idx].status = newStatus;
    list[idx].updatedAt = Date.now();
    this.saveAll(list);
    Activity.log('Candidate ' + list[idx].id + ' marked as ' + newStatus);
    Toast.show(list[idx].id + ' marked as ' + newStatus + '.', 'success');
    this.render();
  },

  loadSampleData() {
    const vacancies = VacancyModule.getAll();
    if (!vacancies.length) {
      Toast.show('Create a vacancy first — sample candidates need one to apply against.', 'warning');
      return;
    }
    const templates = [
      { name: 'Anjali Krishnan', phone: '9847012345', email: 'anjali.krishnan@example.com', statusPick: 'Received', expOffset: 0 },
      { name: 'Vishnu Nair', phone: '9995512345', email: 'vishnu.nair@example.com', statusPick: 'Accepted', expOffset: 1 },
      { name: 'Fathima Rasheed', phone: '8281234567', email: 'fathima.rasheed@example.com', statusPick: 'Moved to Screening', expOffset: -1 }
    ];
    const list = this.getAll();
    templates.forEach((t, i) => {
      const vacancy = vacancies[i % vacancies.length];
      const experienceYears = Math.max(0, vacancy.expMin + t.expOffset);
      const skills = (vacancy.skills || []).slice(0, 2);
      skills.push('Teamwork');
      const now = Date.now();
      const record = {
        id: this.nextId(),
        vacancyId: vacancy.id,
        appliedForDesignation: vacancy.designation,
        appliedForDepartment: vacancy.department,
        resumeFileName: t.name.replace(/\s+/g, '_') + '_resume.pdf',
        name: t.name,
        phone: t.phone,
        email: t.email,
        education: vacancy.qualification,
        experienceYears: experienceYears,
        expectedSalary: Math.round((vacancy.salaryMin + vacancy.salaryMax) / 2),
        location: vacancy.location,
        status: t.statusPick,
        resumeScore: this.computeScore(vacancy, vacancy.qualification, experienceYears, skills),
        skills: skills,
        createdAt: now,
        updatedAt: now
      };
      list.unshift(record);
    });
    this.saveAll(list);
    Activity.log('Loaded sample candidates');
    Toast.show('Sample candidates added.', 'success');
    this.render();
  },

  /* ---------- rendering ---------- */
  statusBadge(status) {
    const map = {
      'Received': 'badge-info', 'Accepted': 'badge-success',
      'Rejected': 'badge-danger', 'Moved to Screening': 'badge-warning'
    };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + Utils.escapeHtml(status) + '</span>';
  },

  scoreBadge(score) {
    const cls = score >= 75 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-danger';
    return '<span class="badge ' + cls + '">' + score + ' / 100</span>';
  },

  getFilteredSorted() {
    let list = this.getAll();
    const { search, vacancyId, status, sortKey, sortDir } = this.state;

    if (search) {
      list = list.filter(v =>
        (v.name || '').toLowerCase().includes(search) ||
        (v.phone || '').toLowerCase().includes(search) ||
        (v.email || '').toLowerCase().includes(search) ||
        (v.appliedForDesignation || '').toLowerCase().includes(search) ||
        (v.id || '').toLowerCase().includes(search)
      );
    }
    if (vacancyId) list = list.filter(v => v.vacancyId === vacancyId);
    if (status) list = list.filter(v => v.status === status);

    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === undefined) av = '';
      if (bv === undefined) bv = '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  render() {
    const vacancies = VacancyModule.getAll();
    const hasVacancies = vacancies.length > 0;
    document.getElementById('resumeNoVacancyGuard').hidden = hasVacancies;
    document.getElementById('resumeMainArea').style.display = hasVacancies ? '' : 'none';
    if (!hasVacancies) return;

    const all = this.getAll();
    this.renderStatusStrip(all);
    this.populateFilterVacancyOptions();

    document.getElementById('filterResumeStatus').value = this.state.status;
    document.getElementById('resumeSearch').value = this.state.search;

    const filtered = this.getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('resumeEmptyState').hidden = all.length !== 0;
    document.querySelector('#resumeTable').style.display = all.length === 0 ? 'none' : '';

    document.getElementById('resumeTableBody').innerHTML = pageItems.map(v => this.rowHtml(v)).join('');

    document.querySelectorAll('#resumeTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort')
        ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('resumeTableCount').textContent =
      filtered.length === 0 ? 'No candidates match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  renderStatusStrip(all) {
    const counts = { Received: 0, Accepted: 0, Rejected: 0, 'Moved to Screening': 0 };
    all.forEach(v => { if (counts[v.status] !== undefined) counts[v.status]++; });
    const strip = document.getElementById('resumeStatusStrip');
    strip.innerHTML =
      this.chip('received', 'Received', counts.Received) +
      this.chip('accepted', 'Accepted', counts.Accepted) +
      this.chip('screening', 'Moved to Screening', counts['Moved to Screening']) +
      this.chip('rejected', 'Rejected', counts.Rejected);
  },

  chip(cls, label, count) {
    return '<div class="status-chip ' + cls + '"><span class="status-chip-count">' + count +
      '</span><span class="status-chip-label">' + label + '</span></div>';
  },

  rowHtml(v) {
    return (
      '<tr data-id="' + Utils.escapeHtml(v.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(v.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(v.name) + '</td>' +
      '<td>' + Utils.escapeHtml(v.appliedForDesignation) + '</td>' +
      '<td class="cell-secondary">' + Utils.escapeHtml(v.phone) + '</td>' +
      '<td>' + Utils.escapeHtml(v.education) + '</td>' +
      '<td class="cell-secondary">' + v.experienceYears + ' yrs</td>' +
      '<td>' + this.scoreBadge(v.resumeScore) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatCurrency(v.expectedSalary) + '</td>' +
      '<td>' + Utils.escapeHtml(v.location) + '</td>' +
      '<td>' + this.statusBadge(v.status) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      this.rowActionBtn('view', v.id, 'View', '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/>') +
      this.rowActionBtn('edit', v.id, 'Edit', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>') +
      this.rowActionBtn('delete', v.id, 'Delete', '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', true) +
      this.rowActionBtn('more', v.id, 'More actions', '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>') +
      '</div></td>' +
      '</tr>'
    );
  },

  rowActionBtn(action, id, title, iconPath, danger) {
    return '<button class="row-action-btn' + (danger ? ' danger' : '') + '" data-action="' + action + '" data-id="' +
      Utils.escapeHtml(id) + '" title="' + title + '" aria-label="' + title + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' + iconPath + '</svg></button>';
  },

  bindRowActions() {
    document.querySelectorAll('#resumeTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const candidate = this.getAll().find(v => v.id === id);
        if (!candidate) return;
        if (action === 'view') this.openView(candidate);
        if (action === 'edit') this.openForm(candidate);
        if (action === 'delete') this.handleDelete(id);
        if (action === 'more') {
          e.stopPropagation(); // otherwise this same click bubbles to document and RowMenu closes itself instantly
          RowMenu.open(btn, [
            { label: 'Accept', disabled: candidate.status === 'Accepted', onClick: () => this.changeStatus(id, 'Accepted') },
            { label: 'Reject', danger: true, disabled: candidate.status === 'Rejected', onClick: () => this.changeStatus(id, 'Rejected') },
            { label: 'Move to Screening', disabled: candidate.status === 'Moved to Screening', onClick: () => this.changeStatus(id, 'Moved to Screening') }
          ]);
        }
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('resumePagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.render();
      });
    });
  }
};

/* ---------------------------------------------------------------
   12. PHASE 3 — RESUME SCREENING
--------------------------------------------------------------- */
const ScreeningModule = {
  state: {
    search: '',
    decision: '',
    sortKey: 'totalScore',
    sortDir: 'desc',
    page: 1,
    pageSize: 8,
    editingId: null,
    certifications: []
  },

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.screenings, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.screenings, list);
  },
  nextId() {
    const counter = Storage.get(STORAGE_KEYS.screeningCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.screeningCounter, counter);
    const year = new Date().getFullYear();
    return 'SCR-' + year + '-' + Utils.pad(counter, 4);
  },

  /* ---------- automatic component scores ---------- */
  scoreEducation(resume, vacancy) {
    if (!vacancy) return 8;
    return resume.education === vacancy.qualification ? 20 : 8;
  },
  scoreExperience(resume, vacancy) {
    if (!vacancy) return 0;
    const yrs = resume.experienceYears, min = vacancy.expMin, max = vacancy.expMax;
    if (yrs >= min && yrs <= max) return 20;
    if (yrs >= min - 1 && yrs <= max + 1) return 14;
    if (yrs >= min - 2 && yrs <= max + 2) return 7;
    return 0;
  },
  scoreSkillsMatch(resume, vacancy) {
    if (!vacancy) return 15;
    const vacSkills = (vacancy.skills || []).map(s => s.toLowerCase());
    if (!vacSkills.length) return 15;
    const candSkills = (resume.skills || []).map(s => s.toLowerCase());
    const overlap = candSkills.filter(s => vacSkills.includes(s)).length;
    return Math.round((overlap / vacSkills.length) * 30);
  },
  scoreCertifications(certifications) {
    return Math.min(15, (certifications || []).length * 5);
  },

  /* ---------- ensure every screening-eligible resume has a record ---------- */
  getEligibleResumes() {
    const resumes = ResumeModule.getAll();
    const screenings = this.getAll();
    const screenedResumeIds = new Set(screenings.map(s => s.resumeId));
    return resumes.filter(r => r.status === 'Moved to Screening' || screenedResumeIds.has(r.id));
  },

  syncQueue() {
    const eligible = this.getEligibleResumes();
    const screenings = this.getAll();
    const existingIds = new Set(screenings.map(s => s.resumeId));
    let changed = false;

    eligible.forEach(resume => {
      if (existingIds.has(resume.id)) return;
      const vacancy = VacancyModule.getAll().find(v => v.id === resume.vacancyId);
      const now = Date.now();
      const educationScore = this.scoreEducation(resume, vacancy);
      const experienceScore = this.scoreExperience(resume, vacancy);
      const skillsMatchScore = this.scoreSkillsMatch(resume, vacancy);
      screenings.push({
        id: this.nextId(),
        resumeId: resume.id,
        vacancyId: resume.vacancyId,
        candidateName: resume.name,
        appliedForDesignation: resume.appliedForDesignation,
        educationScore, experienceScore, skillsMatchScore,
        certifications: [],
        certificationsScore: 0,
        communicationScore: 0,
        totalScore: educationScore + experienceScore + skillsMatchScore,
        decision: 'Pending Review',
        remarks: '',
        createdAt: now,
        updatedAt: now
      });
      changed = true;
    });

    if (changed) this.saveAll(screenings);
    return screenings;
  },

  /* ---------- init ---------- */
  init() {
    this.bindToolbar();
    this.bindForm();
    this.bindModals();
    document.getElementById('exportScreeningBtn').addEventListener('click', () => {
      Toast.show('Export is a UI preview in this simulator — no file is generated.', 'info');
    });
  },

  bindToolbar() {
    const searchInput = document.getElementById('screeningSearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.render();
    }, 200));
    document.getElementById('filterScreeningDecision').addEventListener('change', (e) => {
      this.state.decision = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('clearScreeningFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.decision = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterScreeningDecision').value = '';
      this.render();
    });
    document.querySelectorAll('#screeningTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'desc';
        }
        this.render();
      });
    });
  },

  bindModals() {
    document.getElementById('screeningModalCloseBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('screeningCancelBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('screeningModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'screeningModalOverlay') this.closeForm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('screeningModalOverlay').hidden) this.closeForm();
    });
  },

  bindForm() {
    const certInput = document.getElementById('s_certificationsInput');
    certInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = certInput.value.trim().replace(/,$/, '');
        if (val && !this.state.certifications.includes(val)) {
          this.state.certifications.push(val);
          this.renderCertTags();
        }
        certInput.value = '';
      } else if (e.key === 'Backspace' && !certInput.value) {
        this.state.certifications.pop();
        this.renderCertTags();
      }
    });
    document.getElementById('s_communicationScore').addEventListener('input', () => this.recalcTotal());
    document.getElementById('screeningForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });
  },

  renderCertTags() {
    const wrap = document.getElementById('s_certificationsTagList');
    wrap.innerHTML = this.state.certifications.map((c, i) =>
      '<span class="tag-chip">' + Utils.escapeHtml(c) +
      '<button type="button" data-cert-index="' + i + '" aria-label="Remove ' + Utils.escapeHtml(c) + '">' +
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>' +
      '</button></span>'
    ).join('');
    wrap.querySelectorAll('button[data-cert-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.certifications.splice(Number(btn.getAttribute('data-cert-index')), 1);
        this.renderCertTags();
        this.recalcTotal();
      });
    });
    this.recalcTotal();
  },

  recalcTotal() {
    const certScore = this.scoreCertifications(this.state.certifications);
    document.getElementById('s_certificationsScore').value = certScore;
    const edu = Number(document.getElementById('s_educationScore').value) || 0;
    const exp = Number(document.getElementById('s_experienceScore').value) || 0;
    const skills = Number(document.getElementById('s_skillsMatchScore').value) || 0;
    const comm = Number(document.getElementById('s_communicationScore').value) || 0;
    document.getElementById('s_totalScore').value = edu + exp + skills + certScore + comm;
  },

  /* ---------- form open/close ---------- */
  openForm(screening) {
    const form = document.getElementById('screeningForm');
    form.reset();
    this.clearErrors();
    this.state.editingId = screening.id;
    this.state.certifications = [...(screening.certifications || [])];

    const initials = (screening.candidateName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    document.getElementById('screeningAvatarInitials').textContent = initials;
    document.getElementById('screeningCandidateName').textContent = screening.candidateName;
    document.getElementById('screeningCandidateMeta').textContent =
      'Applied for ' + screening.appliedForDesignation + ' · ' + screening.resumeId;
    document.getElementById('screeningModalTitle').textContent = 'Screen Candidate — ' + screening.id;

    document.getElementById('s_educationScore').value = screening.educationScore;
    document.getElementById('s_experienceScore').value = screening.experienceScore;
    document.getElementById('s_skillsMatchScore').value = screening.skillsMatchScore;
    document.getElementById('s_communicationScore').value = screening.communicationScore;
    document.getElementById('s_decision').value = screening.decision;
    document.getElementById('s_remarks').value = screening.remarks || '';
    this.renderCertTags(); // also fills certifications score + recalculates total

    document.getElementById('screeningModalOverlay').hidden = false;
    setTimeout(() => document.getElementById('s_communicationScore').focus(), 30);
  },

  closeForm() {
    document.getElementById('screeningModalOverlay').hidden = true;
  },

  openView(screening) {
    const initials = (screening.candidateName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const certsHtml = (screening.certifications || []).map(c => '<span class="mini-tag">' + Utils.escapeHtml(c) + '</span>').join(' ');
    document.getElementById('viewModalTitle').textContent = screening.candidateName + ' — ' + screening.id;
    document.getElementById('viewModalBody').innerHTML =
      '<div class="resume-preview-header">' +
      '<div class="resume-preview-avatar">' + Utils.escapeHtml(initials) + '</div>' +
      '<div><div class="resume-preview-name">' + Utils.escapeHtml(screening.candidateName) + '</div>' +
      '<div class="resume-preview-meta">Applied for ' + Utils.escapeHtml(screening.appliedForDesignation) + ' &middot; ' + Utils.escapeHtml(screening.resumeId) + '</div>' +
      '</div></div>' +
      '<div class="detail-grid">' +
      VacancyModule.detailItem('Screening ID', screening.id) +
      VacancyModule.detailItem('Decision', this.decisionBadge(screening.decision)) +
      VacancyModule.detailItem('Education', screening.educationScore + ' / 20') +
      VacancyModule.detailItem('Experience', screening.experienceScore + ' / 20') +
      VacancyModule.detailItem('Skills Match', screening.skillsMatchScore + ' / 30') +
      VacancyModule.detailItem('Certifications', screening.certificationsScore + ' / 15') +
      VacancyModule.detailItem('Communication', screening.communicationScore + ' / 15') +
      VacancyModule.detailItem('Total Score', this.totalScoreBadge(screening.totalScore)) +
      '<div class="detail-item detail-full"><span class="detail-label">Certifications Held</span>' +
      '<div class="detail-value">' + (certsHtml || '—') + '</div></div>' +
      '<div class="detail-item detail-full"><span class="detail-label">Remarks</span>' +
      '<div class="detail-value">' + Utils.escapeHtml(screening.remarks || '—') + '</div></div>' +
      VacancyModule.detailItem('Last Updated', new Date(screening.updatedAt).toLocaleString('en-IN')) +
      '</div>';
    document.getElementById('viewModalOverlay').hidden = false;
  },

  /* ---------- validation ---------- */
  clearErrors() {
    ['s_communicationScore', 's_decision'].forEach(id => {
      const errEl = document.getElementById('err_' + id);
      if (errEl) errEl.textContent = '';
      const field = document.getElementById(id);
      if (field) field.classList.remove('invalid');
    });
  },

  validate() {
    this.clearErrors();
    let valid = true;
    const comm = document.getElementById('s_communicationScore').value.trim();
    if (comm === '') {
      document.getElementById('err_s_communicationScore').textContent = 'Enter a communication score from your assessment.';
      document.getElementById('s_communicationScore').classList.add('invalid');
      valid = false;
    } else if (Number(comm) < 0 || Number(comm) > 15) {
      document.getElementById('err_s_communicationScore').textContent = 'Score must be between 0 and 15.';
      document.getElementById('s_communicationScore').classList.add('invalid');
      valid = false;
    }
    if (!document.getElementById('s_decision').value) {
      document.getElementById('err_s_decision').textContent = 'Select a decision.';
      valid = false;
    }
    return valid;
  },

  handleSave() {
    if (!this.validate()) {
      Toast.show('Please fix the highlighted fields.', 'error');
      return;
    }
    const list = this.getAll();
    const idx = list.findIndex(s => s.id === this.state.editingId);
    if (idx === -1) return;

    const communicationScore = Number(document.getElementById('s_communicationScore').value);
    const certificationsScore = this.scoreCertifications(this.state.certifications);
    const decision = document.getElementById('s_decision').value;
    const remarks = document.getElementById('s_remarks').value.trim();

    list[idx].communicationScore = communicationScore;
    list[idx].certifications = [...this.state.certifications];
    list[idx].certificationsScore = certificationsScore;
    list[idx].decision = decision;
    list[idx].remarks = remarks;
    list[idx].totalScore = list[idx].educationScore + list[idx].experienceScore +
      list[idx].skillsMatchScore + certificationsScore + communicationScore;
    list[idx].updatedAt = Date.now();

    this.saveAll(list);
    Activity.log('Screening ' + list[idx].id + ' (' + list[idx].candidateName + ') updated — ' + decision);
    Toast.show('Screening for ' + list[idx].candidateName + ' saved.', 'success');
    this.closeForm();
    this.render();
  },

  async handleDelete(id) {
    const list = this.getAll();
    const screening = list.find(s => s.id === id);
    if (!screening) return;
    const confirmed = await Confirm.ask(
      'Remove from screening?',
      screening.id + ' — ' + screening.candidateName + ' will be removed from the screening queue, and their resume status reset to Received so they aren\u2019t re-added automatically.',
      'Remove'
    );
    if (!confirmed) return;
    this.saveAll(list.filter(s => s.id !== id));

    // Pull the underlying resume back out of the screening pool — otherwise the
    // self-healing queue (syncQueue) would just recreate this record on the next render.
    const resumes = ResumeModule.getAll();
    const rIdx = resumes.findIndex(r => r.id === screening.resumeId);
    if (rIdx > -1 && resumes[rIdx].status === 'Moved to Screening') {
      resumes[rIdx].status = 'Received';
      resumes[rIdx].updatedAt = Date.now();
      ResumeModule.saveAll(resumes);
    }

    Activity.log('Screening ' + screening.id + ' (' + screening.candidateName + ') removed; candidate returned to Received status');
    Toast.show(screening.candidateName + ' removed from screening.', 'success');
    this.render();
  },

  changeDecision(id, decision) {
    const list = this.getAll();
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return;
    list[idx].decision = decision;
    list[idx].updatedAt = Date.now();
    this.saveAll(list);
    Activity.log('Candidate ' + list[idx].candidateName + ' marked ' + decision + ' at screening');
    Toast.show(list[idx].candidateName + ' marked ' + decision + '.', 'success');
    this.render();
  },

  /* ---------- rendering ---------- */
  decisionBadge(decision) {
    const map = { 'Pending Review': 'badge-neutral', 'Shortlisted': 'badge-success', 'Rejected': 'badge-danger' };
    return '<span class="badge ' + (map[decision] || 'badge-neutral') + '">' + Utils.escapeHtml(decision) + '</span>';
  },

  totalScoreBadge(score) {
    const cls = score >= 75 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-danger';
    return '<span class="badge ' + cls + '">' + score + ' / 100</span>';
  },

  getFilteredSorted() {
    let list = this.syncQueue();
    const { search, decision, sortKey, sortDir } = this.state;

    if (search) {
      list = list.filter(s =>
        (s.candidateName || '').toLowerCase().includes(search) ||
        (s.appliedForDesignation || '').toLowerCase().includes(search) ||
        (s.id || '').toLowerCase().includes(search)
      );
    }
    if (decision) list = list.filter(s => s.decision === decision);

    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === undefined) av = '';
      if (bv === undefined) bv = '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  render() {
    const eligible = this.getEligibleResumes();
    const hasEligible = eligible.length > 0;
    document.getElementById('screeningNoCandidateGuard').hidden = hasEligible;
    document.getElementById('screeningMainArea').style.display = hasEligible ? '' : 'none';
    if (!hasEligible) return;

    const all = this.syncQueue();
    this.renderStatusStrip(all);
    document.getElementById('filterScreeningDecision').value = this.state.decision;
    document.getElementById('screeningSearch').value = this.state.search;

    const filtered = this.getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('screeningTableBody').innerHTML = pageItems.map(s => this.rowHtml(s)).join('');

    document.querySelectorAll('#screeningTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort')
        ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('screeningTableCount').textContent =
      filtered.length === 0 ? 'No screening records match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  renderStatusStrip(all) {
    const counts = { 'Pending Review': 0, Shortlisted: 0, Rejected: 0 };
    all.forEach(s => { if (counts[s.decision] !== undefined) counts[s.decision]++; });
    const strip = document.getElementById('screeningStatusStrip');
    strip.innerHTML =
      this.chip('pending', 'Pending Review', counts['Pending Review']) +
      this.chip('shortlisted', 'Shortlisted', counts.Shortlisted) +
      this.chip('rejected', 'Rejected', counts.Rejected);
  },

  chip(cls, label, count) {
    return '<div class="status-chip ' + cls + '"><span class="status-chip-count">' + count +
      '</span><span class="status-chip-label">' + label + '</span></div>';
  },

  rowHtml(s) {
    return (
      '<tr data-id="' + Utils.escapeHtml(s.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(s.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(s.candidateName) + '</td>' +
      '<td>' + Utils.escapeHtml(s.appliedForDesignation) + '</td>' +
      '<td class="cell-secondary">' + s.educationScore + '/20</td>' +
      '<td class="cell-secondary">' + s.experienceScore + '/20</td>' +
      '<td class="cell-secondary">' + s.skillsMatchScore + '/30</td>' +
      '<td class="cell-secondary">' + s.certificationsScore + '/15</td>' +
      '<td class="cell-secondary">' + s.communicationScore + '/15</td>' +
      '<td>' + this.totalScoreBadge(s.totalScore) + '</td>' +
      '<td>' + this.decisionBadge(s.decision) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      this.rowActionBtn('view', s.id, 'View', '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/>') +
      this.rowActionBtn('edit', s.id, 'Screen / Edit', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>') +
      this.rowActionBtn('delete', s.id, 'Delete', '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', true) +
      this.rowActionBtn('more', s.id, 'More actions', '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>') +
      '</div></td>' +
      '</tr>'
    );
  },

  rowActionBtn(action, id, title, iconPath, danger) {
    return '<button class="row-action-btn' + (danger ? ' danger' : '') + '" data-action="' + action + '" data-id="' +
      Utils.escapeHtml(id) + '" title="' + title + '" aria-label="' + title + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' + iconPath + '</svg></button>';
  },

  bindRowActions() {
    document.querySelectorAll('#screeningTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const screening = this.getAll().find(s => s.id === id);
        if (!screening) return;
        if (action === 'view') this.openView(screening);
        if (action === 'edit') this.openForm(screening);
        if (action === 'delete') this.handleDelete(id);
        if (action === 'more') {
          e.stopPropagation();
          RowMenu.open(btn, [
            { label: 'Shortlist', disabled: screening.decision === 'Shortlisted', onClick: () => this.changeDecision(id, 'Shortlisted') },
            { label: 'Reject', danger: true, disabled: screening.decision === 'Rejected', onClick: () => this.changeDecision(id, 'Rejected') }
          ]);
        }
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('screeningPagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.render();
      });
    });
  }
};

/* ---------------------------------------------------------------
   13. PHASE 4 — CANDIDATE SHORTLISTING (interview scheduling)
--------------------------------------------------------------- */
const ShortlistModule = {
  state: {
    search: '',
    status: '',
    sortKey: 'interviewDate',
    sortDir: 'asc',
    page: 1,
    pageSize: 8,
    selectedScreeningIds: new Set(),
    mode: 'bulk', // 'bulk' (schedule from pool) or 'edit' (single existing record)
    editingId: null,
    panel: []
  },

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.shortlists, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.shortlists, list);
  },
  nextId() {
    const counter = Storage.get(STORAGE_KEYS.shortlistCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.shortlistCounter, counter);
    const year = new Date().getFullYear();
    return 'INT-' + year + '-' + Utils.pad(counter, 4);
  },

  /* ---------- pool: shortlisted-at-screening candidates without a schedule yet ---------- */
  getPool() {
    const scheduledScreeningIds = new Set(this.getAll().map(s => s.screeningId));
    return ScreeningModule.getAll().filter(s => s.decision === 'Shortlisted' && !scheduledScreeningIds.has(s.id));
  },

  /* ---------- init ---------- */
  init() {
    document.getElementById('poolSelectAll').addEventListener('change', (e) => {
      const pool = this.getPool();
      if (e.target.checked) pool.forEach(s => this.state.selectedScreeningIds.add(s.id));
      else this.state.selectedScreeningIds.clear();
      this.renderPool();
    });
    document.getElementById('scheduleSelectedBtn').addEventListener('click', () => this.openBulkForm());

    this.bindToolbar();
    this.bindForm();
    this.bindModals();
    document.getElementById('exportShortlistBtn').addEventListener('click', () => {
      Toast.show('Export is a UI preview in this simulator — no file is generated.', 'info');
    });
  },

  bindToolbar() {
    const searchInput = document.getElementById('shortlistSearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.render();
    }, 200));
    document.getElementById('filterShortlistStatus').addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('clearShortlistFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.status = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterShortlistStatus').value = '';
      this.render();
    });
    document.querySelectorAll('#shortlistTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'asc';
        }
        this.render();
      });
    });
  },

  bindModals() {
    document.getElementById('shortlistModalCloseBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('shortlistCancelBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('shortlistModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'shortlistModalOverlay') this.closeForm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('shortlistModalOverlay').hidden) this.closeForm();
    });
  },

  bindForm() {
    const panelInput = document.getElementById('sl_panelInput');
    panelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = panelInput.value.trim().replace(/,$/, '');
        if (val && !this.state.panel.includes(val)) {
          this.state.panel.push(val);
          this.renderPanelTags();
        }
        panelInput.value = '';
      } else if (e.key === 'Backspace' && !panelInput.value) {
        this.state.panel.pop();
        this.renderPanelTags();
      }
    });
    document.getElementById('shortlistForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });
  },

  renderPanelTags() {
    const wrap = document.getElementById('sl_panelTagList');
    wrap.innerHTML = this.state.panel.map((p, i) =>
      '<span class="tag-chip">' + Utils.escapeHtml(p) +
      '<button type="button" data-panel-index="' + i + '" aria-label="Remove ' + Utils.escapeHtml(p) + '">' +
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>' +
      '</button></span>'
    ).join('');
    wrap.querySelectorAll('button[data-panel-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.panel.splice(Number(btn.getAttribute('data-panel-index')), 1);
        this.renderPanelTags();
      });
    });
  },

  /* ---------- pool selection rendering ---------- */
  renderPool() {
    const pool = this.getPool();
    document.getElementById('poolEmptyState').hidden = pool.length !== 0;
    document.getElementById('poolTable').style.display = pool.length === 0 ? 'none' : '';

    document.getElementById('poolTableBody').innerHTML = pool.map(s =>
      '<tr data-screening-id="' + Utils.escapeHtml(s.id) + '">' +
      '<td><input type="checkbox" class="pool-checkbox" data-screening-id="' + Utils.escapeHtml(s.id) + '" ' +
      (this.state.selectedScreeningIds.has(s.id) ? 'checked' : '') + ' /></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(s.candidateName) + '</td>' +
      '<td>' + Utils.escapeHtml(s.appliedForDesignation) + '</td>' +
      '<td><span class="id-badge">' + Utils.escapeHtml(s.id) + '</span></td>' +
      '<td>' + ScreeningModule.totalScoreBadge(s.totalScore) + '</td>' +
      '</tr>'
    ).join('');

    document.querySelectorAll('.pool-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-screening-id');
        if (cb.checked) this.state.selectedScreeningIds.add(id);
        else this.state.selectedScreeningIds.delete(id);
        this.updateSelectionUI();
      });
    });

    // prune selections for candidates no longer in the pool (e.g. already scheduled elsewhere)
    const poolIds = new Set(pool.map(s => s.id));
    [...this.state.selectedScreeningIds].forEach(id => { if (!poolIds.has(id)) this.state.selectedScreeningIds.delete(id); });
    this.updateSelectionUI();
  },

  updateSelectionUI() {
    const count = this.state.selectedScreeningIds.size;
    document.getElementById('poolSelectedCount').textContent = count + ' selected';
    document.getElementById('scheduleSelectedBtn').disabled = count === 0;
    const pool = this.getPool();
    document.getElementById('poolSelectAll').checked = pool.length > 0 && count === pool.length;
  },

  /* ---------- form open/close (bulk create vs single edit) ---------- */
  openBulkForm() {
    const form = document.getElementById('shortlistForm');
    form.reset();
    this.clearErrors();
    this.state.mode = 'bulk';
    this.state.editingId = null;
    this.state.panel = [];
    this.renderPanelTags();

    const selected = ScreeningModule.getAll().filter(s => this.state.selectedScreeningIds.has(s.id));
    document.getElementById('shortlistModalTitle').textContent =
      'Schedule Interview — ' + selected.length + ' candidate' + (selected.length === 1 ? '' : 's');
    document.getElementById('shortlistCandidateList').innerHTML =
      'Scheduling: <strong>' + selected.map(s => Utils.escapeHtml(s.candidateName)).join(', ') + '</strong>';
    document.getElementById('sl_statusField').hidden = true;
    document.getElementById('shortlistSaveBtn').textContent = 'Schedule';

    document.getElementById('shortlistModalOverlay').hidden = false;
    setTimeout(() => document.getElementById('sl_interviewDate').focus(), 30);
  },

  openForm(schedule) {
    const form = document.getElementById('shortlistForm');
    form.reset();
    this.clearErrors();
    this.state.mode = 'edit';
    this.state.editingId = schedule.id;
    this.state.panel = [...(schedule.interviewPanel || [])];
    this.renderPanelTags();

    document.getElementById('shortlistModalTitle').textContent = 'Edit Interview Schedule — ' + schedule.id;
    document.getElementById('shortlistCandidateList').innerHTML =
      'Candidate: <strong>' + Utils.escapeHtml(schedule.candidateName) + '</strong> — ' + Utils.escapeHtml(schedule.appliedForDesignation);
    document.getElementById('sl_statusField').hidden = false;
    document.getElementById('sl_interviewDate').value = schedule.interviewDate;
    document.getElementById('sl_assignedHR').value = schedule.assignedHR;
    document.getElementById('sl_status').value = schedule.status;
    document.getElementById('shortlistSaveBtn').textContent = 'Save Changes';

    document.getElementById('shortlistModalOverlay').hidden = false;
    setTimeout(() => document.getElementById('sl_interviewDate').focus(), 30);
  },

  closeForm() {
    document.getElementById('shortlistModalOverlay').hidden = true;
  },

  openView(schedule) {
    const panelHtml = (schedule.interviewPanel || []).map(p => '<span class="mini-tag">' + Utils.escapeHtml(p) + '</span>').join(' ');
    document.getElementById('viewModalTitle').textContent = schedule.candidateName + ' — ' + schedule.id;
    document.getElementById('viewModalBody').innerHTML =
      '<div class="detail-grid">' +
      VacancyModule.detailItem('Interview ID', schedule.id) +
      VacancyModule.detailItem('Status', this.statusBadge(schedule.status)) +
      VacancyModule.detailItem('Candidate', schedule.candidateName) +
      VacancyModule.detailItem('Applied For', schedule.appliedForDesignation) +
      VacancyModule.detailItem('Interview Date', Utils.formatDate(schedule.interviewDate)) +
      VacancyModule.detailItem('Assigned HR', schedule.assignedHR) +
      VacancyModule.detailItem('Screening ID', schedule.screeningId) +
      VacancyModule.detailItem('Resume ID', schedule.resumeId) +
      '<div class="detail-item detail-full"><span class="detail-label">Interview Panel</span>' +
      '<div class="detail-value">' + (panelHtml || '—') + '</div></div>' +
      VacancyModule.detailItem('Created', new Date(schedule.createdAt).toLocaleString('en-IN')) +
      VacancyModule.detailItem('Last Updated', new Date(schedule.updatedAt).toLocaleString('en-IN')) +
      '</div>';
    document.getElementById('viewModalOverlay').hidden = false;
  },

  /* ---------- validation ---------- */
  clearErrors() {
    ['sl_interviewDate', 'sl_assignedHR', 'sl_panel'].forEach(id => {
      const errEl = document.getElementById('err_' + id);
      if (errEl) errEl.textContent = '';
      const field = document.getElementById(id);
      if (field) field.classList.remove('invalid');
    });
  },

  validate() {
    this.clearErrors();
    let valid = true;
    if (!document.getElementById('sl_interviewDate').value) {
      document.getElementById('err_sl_interviewDate').textContent = 'Interview date is required.';
      document.getElementById('sl_interviewDate').classList.add('invalid');
      valid = false;
    }
    if (!document.getElementById('sl_assignedHR').value.trim()) {
      document.getElementById('err_sl_assignedHR').textContent = 'Assign an HR coordinator.';
      document.getElementById('sl_assignedHR').classList.add('invalid');
      valid = false;
    }
    if (!this.state.panel.length) {
      document.getElementById('err_sl_panel').textContent = 'Add at least one interview panel member.';
      valid = false;
    }
    return valid;
  },

  handleSave() {
    if (!this.validate()) {
      Toast.show('Please fix the highlighted fields.', 'error');
      return;
    }
    const interviewDate = document.getElementById('sl_interviewDate').value;
    const assignedHR = document.getElementById('sl_assignedHR').value.trim();
    const panel = [...this.state.panel];

    if (this.state.mode === 'bulk') {
      const list = this.getAll();
      const selected = ScreeningModule.getAll().filter(s => this.state.selectedScreeningIds.has(s.id));
      const now = Date.now();
      selected.forEach(s => {
        const record = {
          id: this.nextId(),
          screeningId: s.id,
          resumeId: s.resumeId,
          vacancyId: s.vacancyId,
          candidateName: s.candidateName,
          appliedForDesignation: s.appliedForDesignation,
          interviewDate, assignedHR,
          interviewPanel: panel,
          status: 'Scheduled',
          createdAt: now,
          updatedAt: now
        };
        list.push(record);
        Activity.log('Interview ' + record.id + ' scheduled for ' + record.candidateName + ' (' + record.appliedForDesignation + ') on ' + Utils.formatDate(interviewDate));
      });
      this.saveAll(list);
      this.state.selectedScreeningIds.clear();
      Toast.show(selected.length + ' interview' + (selected.length === 1 ? '' : 's') + ' scheduled.', 'success');
    } else {
      const list = this.getAll();
      const idx = list.findIndex(s => s.id === this.state.editingId);
      if (idx === -1) return;
      list[idx].interviewDate = interviewDate;
      list[idx].assignedHR = assignedHR;
      list[idx].interviewPanel = panel;
      list[idx].status = document.getElementById('sl_status').value;
      list[idx].updatedAt = Date.now();
      this.saveAll(list);
      Activity.log('Interview ' + list[idx].id + ' (' + list[idx].candidateName + ') updated');
      Toast.show('Interview schedule updated.', 'success');
    }

    this.closeForm();
    this.render();
  },

  async handleDelete(id) {
    const list = this.getAll();
    const schedule = list.find(s => s.id === id);
    if (!schedule) return;
    const confirmed = await Confirm.ask(
      'Delete this interview schedule?',
      schedule.id + ' — ' + schedule.candidateName + ' will be removed and returned to the shortlist pool.',
      'Delete'
    );
    if (!confirmed) return;
    this.saveAll(list.filter(s => s.id !== id));
    Activity.log('Interview ' + schedule.id + ' (' + schedule.candidateName + ') deleted');
    Toast.show('Interview schedule deleted.', 'success');
    this.render();
  },

  changeStatus(id, status) {
    const list = this.getAll();
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return;
    list[idx].status = status;
    list[idx].updatedAt = Date.now();
    this.saveAll(list);
    Activity.log('Interview ' + list[idx].id + ' (' + list[idx].candidateName + ') marked ' + status);
    Toast.show(list[idx].candidateName + '\u2019s interview marked ' + status + '.', 'success');
    this.render();
  },

  /* ---------- rendering ---------- */
  statusBadge(status) {
    const map = { 'Scheduled': 'badge-success', 'Rescheduled': 'badge-warning', 'Cancelled': 'badge-danger' };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + Utils.escapeHtml(status) + '</span>';
  },

  getFilteredSorted() {
    let list = this.getAll();
    const { search, status, sortKey, sortDir } = this.state;
    if (search) {
      list = list.filter(s =>
        (s.candidateName || '').toLowerCase().includes(search) ||
        (s.appliedForDesignation || '').toLowerCase().includes(search) ||
        (s.id || '').toLowerCase().includes(search)
      );
    }
    if (status) list = list.filter(s => s.status === status);
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === undefined) av = '';
      if (bv === undefined) bv = '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  render() {
    const hasAnyShortlistedEver = ScreeningModule.getAll().some(s => s.decision === 'Shortlisted');
    const hasAnySchedule = this.getAll().length > 0;
    const showMain = hasAnyShortlistedEver || hasAnySchedule;
    document.getElementById('shortlistNoCandidateGuard').hidden = showMain;
    document.getElementById('shortlistMainArea').style.display = showMain ? '' : 'none';
    if (!showMain) return;

    this.renderPool();

    const all = this.getAll();
    this.renderStatusStrip(all);
    document.getElementById('filterShortlistStatus').value = this.state.status;
    document.getElementById('shortlistSearch').value = this.state.search;

    const filtered = this.getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('shortlistEmptyState').hidden = all.length !== 0;
    document.getElementById('shortlistTable').style.display = all.length === 0 ? 'none' : '';
    document.getElementById('shortlistTableBody').innerHTML = pageItems.map(s => this.rowHtml(s)).join('');

    document.querySelectorAll('#shortlistTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort')
        ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('shortlistTableCount').textContent =
      filtered.length === 0 ? 'No interviews match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  renderStatusStrip(all) {
    const counts = { Scheduled: 0, Rescheduled: 0, Cancelled: 0 };
    all.forEach(s => { if (counts[s.status] !== undefined) counts[s.status]++; });
    const strip = document.getElementById('shortlistStatusStrip');
    strip.innerHTML =
      this.chip('open', 'Scheduled', counts.Scheduled) +
      this.chip('screening', 'Rescheduled', counts.Rescheduled) +
      this.chip('closed', 'Cancelled', counts.Cancelled);
  },

  chip(cls, label, count) {
    return '<div class="status-chip ' + cls + '"><span class="status-chip-count">' + count +
      '</span><span class="status-chip-label">' + label + '</span></div>';
  },

  rowHtml(s) {
    const panelPreview = (s.interviewPanel || []).slice(0, 2).map(p => '<span class="mini-tag">' + Utils.escapeHtml(p) + '</span>').join('');
    return (
      '<tr data-id="' + Utils.escapeHtml(s.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(s.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(s.candidateName) + '</td>' +
      '<td>' + Utils.escapeHtml(s.appliedForDesignation) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatDate(s.interviewDate) + '</td>' +
      '<td>' + Utils.escapeHtml(s.assignedHR) + '</td>' +
      '<td>' + panelPreview + '</td>' +
      '<td>' + this.statusBadge(s.status) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      this.rowActionBtn('view', s.id, 'View', '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/>') +
      this.rowActionBtn('edit', s.id, 'Edit', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>') +
      this.rowActionBtn('delete', s.id, 'Delete', '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', true) +
      this.rowActionBtn('more', s.id, 'More actions', '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>') +
      '</div></td>' +
      '</tr>'
    );
  },

  rowActionBtn(action, id, title, iconPath, danger) {
    return '<button class="row-action-btn' + (danger ? ' danger' : '') + '" data-action="' + action + '" data-id="' +
      Utils.escapeHtml(id) + '" title="' + title + '" aria-label="' + title + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' + iconPath + '</svg></button>';
  },

  bindRowActions() {
    document.querySelectorAll('#shortlistTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const schedule = this.getAll().find(s => s.id === id);
        if (!schedule) return;
        if (action === 'view') this.openView(schedule);
        if (action === 'edit') this.openForm(schedule);
        if (action === 'delete') this.handleDelete(id);
        if (action === 'more') {
          e.stopPropagation();
          RowMenu.open(btn, [
            { label: 'Cancel Interview', disabled: schedule.status === 'Cancelled', danger: true, onClick: () => this.changeStatus(id, 'Cancelled') },
            { label: 'Reinstate to Scheduled', disabled: schedule.status !== 'Cancelled', onClick: () => this.changeStatus(id, 'Scheduled') }
          ]);
        }
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('shortlistPagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.render();
      });
    });
  }
};

/* ---------------------------------------------------------------
   14. PHASE 5 — INTERVIEW MANAGEMENT (HR / Technical / Manager / Final rounds)
--------------------------------------------------------------- */
const InterviewModule = {
  state: {
    search: '',
    status: '',
    sortKey: 'interviewDate',
    sortDir: 'asc',
    editingId: null,
    // panels[roundKey] = array of panel member name strings for that round, while the form is open
    panels: { hr: [], technical: [], manager: [], final: [] },
    page: 1,
    pageSize: 8
  },

  emptyRound() {
    return { date: '', time: '', panelMembers: [], remarks: '', score: null, recommendation: '' };
  },

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.interviews, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.interviews, list);
  },

  /* ---------- eligible schedules + self-healing queue ---------- */
  getEligibleSchedules() {
    return ShortlistModule.getAll().filter(s => s.status !== 'Cancelled');
  },

  syncQueue() {
    const eligible = this.getEligibleSchedules();
    const list = this.getAll();
    const existingIds = new Set(list.map(p => p.id));
    let changed = false;

    eligible.forEach(schedule => {
      if (existingIds.has(schedule.id)) return;
      const now = Date.now();
      list.push({
        id: schedule.id,
        resumeId: schedule.resumeId,
        vacancyId: schedule.vacancyId,
        screeningId: schedule.screeningId,
        candidateName: schedule.candidateName,
        appliedForDesignation: schedule.appliedForDesignation,
        interviewDate: schedule.interviewDate,
        rounds: {
          hr: this.emptyRound(),
          technical: this.emptyRound(),
          manager: this.emptyRound(),
          final: this.emptyRound()
        },
        finalScore: null,
        overallStatus: 'Not Started',
        createdAt: now,
        updatedAt: now
      });
      changed = true;
    });

    if (changed) this.saveAll(list);
    return list;
  },

  /* ---------- derived status / scoring ---------- */
  roundStatus(round) {
    if (round.score !== null && round.score !== undefined && round.score !== '') return 'Completed';
    if (round.date) return 'Scheduled';
    return 'Not Scheduled';
  },

  computeFinalScore(rounds) {
    const scores = ROUND_TYPES
      .map(rt => rounds[rt.key].score)
      .filter(s => s !== null && s !== undefined && s !== '')
      .map(Number);
    if (!scores.length) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  },

  computeOverallStatus(rounds) {
    const statuses = ROUND_TYPES.map(rt => this.roundStatus(rounds[rt.key]));
    if (statuses.every(s => s === 'Completed')) return 'Completed';
    if (statuses.every(s => s === 'Not Scheduled')) return 'Not Started';
    return 'In Progress';
  },

  /* ---------- init ---------- */
  init() {
    this.buildRoundSections();
    this.bindToolbar();
    this.bindForm();
    this.bindModals();
    document.getElementById('exportInterviewBtn').addEventListener('click', () => {
      Toast.show('Export is a UI preview in this simulator — no file is generated.', 'info');
    });
  },

  /* ---------- build the 4 round sections once into #roundsContainer ---------- */
  buildRoundSections() {
    const container = document.getElementById('roundsContainer');
    container.innerHTML = ROUND_TYPES.map(rt =>
      '<div class="round-section" data-round="' + rt.key + '">' +
      '<div class="round-section-header"><span class="round-section-title">' + Utils.escapeHtml(rt.label) + '</span>' +
      '<span class="badge badge-neutral" id="roundStatus_' + rt.key + '">Not Scheduled</span></div>' +
      '<div class="round-grid">' +
      '<div class="form-field"><label for="ir_' + rt.key + '_date">Date</label><input type="date" id="ir_' + rt.key + '_date" /></div>' +
      '<div class="form-field"><label for="ir_' + rt.key + '_time">Time</label><input type="time" id="ir_' + rt.key + '_time" /></div>' +
      '<div class="form-field form-field-wide"><label for="ir_' + rt.key + '_panelInput">Panel Members</label>' +
      '<input type="text" id="ir_' + rt.key + '_panelInput" placeholder="Type a name and press Enter" />' +
      '<div class="tag-list" id="ir_' + rt.key + '_panelTagList"></div></div>' +
      '<div class="form-field form-field-wide"><label for="ir_' + rt.key + '_remarks">Remarks</label>' +
      '<input type="text" id="ir_' + rt.key + '_remarks" placeholder="Interviewer notes…" maxlength="200" /></div>' +
      '<div class="form-field"><label for="ir_' + rt.key + '_score">Score <span class="muted-text" style="font-weight:400;">(0-100)</span></label>' +
      '<input type="number" id="ir_' + rt.key + '_score" min="0" max="100" placeholder="e.g. 78" />' +
      '<span class="field-error" id="err_ir_' + rt.key + '_score"></span></div>' +
      '<div class="form-field"><label for="ir_' + rt.key + '_recommendation">Recommendation</label>' +
      '<select id="ir_' + rt.key + '_recommendation">' +
      '<option value="">Not set</option><option>Strongly Recommend</option><option>Recommend</option>' +
      '<option>Neutral</option><option>Do Not Recommend</option></select></div>' +
      '</div></div>'
    ).join('');

    ROUND_TYPES.forEach(rt => {
      const panelInput = document.getElementById('ir_' + rt.key + '_panelInput');
      panelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const val = panelInput.value.trim().replace(/,$/, '');
          if (val && !this.state.panels[rt.key].includes(val)) {
            this.state.panels[rt.key].push(val);
            this.renderPanelTags(rt.key);
          }
          panelInput.value = '';
        } else if (e.key === 'Backspace' && !panelInput.value) {
          this.state.panels[rt.key].pop();
          this.renderPanelTags(rt.key);
        }
      });
      document.getElementById('ir_' + rt.key + '_date').addEventListener('input', () => this.recalcLive());
      document.getElementById('ir_' + rt.key + '_score').addEventListener('input', () => this.recalcLive());
    });
  },

  renderPanelTags(roundKey) {
    const wrap = document.getElementById('ir_' + roundKey + '_panelTagList');
    wrap.innerHTML = this.state.panels[roundKey].map((p, i) =>
      '<span class="tag-chip">' + Utils.escapeHtml(p) +
      '<button type="button" data-panel-role="' + roundKey + '" data-panel-index="' + i + '" aria-label="Remove ' + Utils.escapeHtml(p) + '">' +
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>' +
      '</button></span>'
    ).join('');
    wrap.querySelectorAll('button[data-panel-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const role = btn.getAttribute('data-panel-role');
        this.state.panels[role].splice(Number(btn.getAttribute('data-panel-index')), 1);
        this.renderPanelTags(role);
      });
    });
  },

  /* ---------- live recalculation while the form is open ---------- */
  readFormRounds() {
    const rounds = {};
    ROUND_TYPES.forEach(rt => {
      const scoreVal = document.getElementById('ir_' + rt.key + '_score').value;
      rounds[rt.key] = {
        date: document.getElementById('ir_' + rt.key + '_date').value,
        time: document.getElementById('ir_' + rt.key + '_time').value,
        panelMembers: [...this.state.panels[rt.key]],
        remarks: document.getElementById('ir_' + rt.key + '_remarks').value.trim(),
        score: scoreVal === '' ? null : Number(scoreVal),
        recommendation: document.getElementById('ir_' + rt.key + '_recommendation').value
      };
    });
    return rounds;
  },

  recalcLive() {
    const rounds = this.readFormRounds();
    ROUND_TYPES.forEach(rt => {
      const badge = document.getElementById('roundStatus_' + rt.key);
      const status = this.roundStatus(rounds[rt.key]);
      const map = { 'Not Scheduled': 'badge-neutral', 'Scheduled': 'badge-info', 'Completed': 'badge-success' };
      badge.className = 'badge ' + map[status];
      badge.textContent = status;
    });
    const finalScore = this.computeFinalScore(rounds);
    document.getElementById('finalScoreValue').textContent = finalScore === null ? '—' : finalScore + ' / 100';
  },

  /* ---------- toolbar ---------- */
  bindToolbar() {
    const searchInput = document.getElementById('interviewSearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.render();
    }, 200));
    document.getElementById('filterInterviewStatus').addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('clearInterviewFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.status = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterInterviewStatus').value = '';
      this.render();
    });
    document.querySelectorAll('#interviewTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'asc';
        }
        this.render();
      });
    });
  },

  bindModals() {
    document.getElementById('interviewModalCloseBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('interviewCancelBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('interviewModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'interviewModalOverlay') this.closeForm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('interviewModalOverlay').hidden) this.closeForm();
    });
  },

  bindForm() {
    document.getElementById('interviewForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });
  },

  /* ---------- form open/close ---------- */
  openForm(process) {
    const form = document.getElementById('interviewForm');
    form.reset();
    this.clearErrors();
    this.state.editingId = process.id;

    const initials = (process.candidateName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    document.getElementById('interviewAvatarInitials').textContent = initials;
    document.getElementById('interviewCandidateName').textContent = process.candidateName;
    document.getElementById('interviewCandidateMeta').textContent =
      'Applied for ' + process.appliedForDesignation + ' · ' + process.id;
    document.getElementById('interviewModalTitle').textContent = 'Manage Interview — ' + process.id;

    ROUND_TYPES.forEach(rt => {
      const round = process.rounds[rt.key];
      document.getElementById('ir_' + rt.key + '_date').value = round.date || '';
      document.getElementById('ir_' + rt.key + '_time').value = round.time || '';
      document.getElementById('ir_' + rt.key + '_remarks').value = round.remarks || '';
      document.getElementById('ir_' + rt.key + '_score').value = (round.score === null || round.score === undefined) ? '' : round.score;
      document.getElementById('ir_' + rt.key + '_recommendation').value = round.recommendation || '';
      this.state.panels[rt.key] = [...(round.panelMembers || [])];
      this.renderPanelTags(rt.key);
    });
    this.recalcLive();

    document.getElementById('interviewModalOverlay').hidden = false;
    setTimeout(() => document.getElementById('ir_hr_date').focus(), 30);
  },

  closeForm() {
    document.getElementById('interviewModalOverlay').hidden = true;
  },

  openView(process) {
    const initials = (process.candidateName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const roundsHtml = ROUND_TYPES.map(rt => {
      const r = process.rounds[rt.key];
      const status = this.roundStatus(r);
      const panelHtml = (r.panelMembers || []).map(p => '<span class="mini-tag">' + Utils.escapeHtml(p) + '</span>').join(' ');
      return '<div class="round-section" style="margin-bottom:10px;">' +
        '<div class="round-section-header"><span class="round-section-title">' + Utils.escapeHtml(rt.label) + '</span>' +
        this.roundStatusBadge(status) + '</div>' +
        '<div class="detail-grid">' +
        VacancyModule.detailItem('Date', r.date ? Utils.formatDate(r.date) : '—') +
        VacancyModule.detailItem('Time', r.time || '—') +
        VacancyModule.detailItem('Score', (r.score === null || r.score === undefined) ? '—' : r.score + ' / 100') +
        VacancyModule.detailItem('Recommendation', r.recommendation || '—') +
        '<div class="detail-item detail-full"><span class="detail-label">Panel Members</span><div class="detail-value">' + (panelHtml || '—') + '</div></div>' +
        '<div class="detail-item detail-full"><span class="detail-label">Remarks</span><div class="detail-value">' + Utils.escapeHtml(r.remarks || '—') + '</div></div>' +
        '</div></div>';
    }).join('');

    document.getElementById('viewModalTitle').textContent = process.candidateName + ' — ' + process.id;
    document.getElementById('viewModalBody').innerHTML =
      '<div class="resume-preview-header">' +
      '<div class="resume-preview-avatar">' + Utils.escapeHtml(initials) + '</div>' +
      '<div><div class="resume-preview-name">' + Utils.escapeHtml(process.candidateName) + '</div>' +
      '<div class="resume-preview-meta">Applied for ' + Utils.escapeHtml(process.appliedForDesignation) + ' &middot; Overall: ' + Utils.escapeHtml(process.overallStatus) + '</div>' +
      '</div></div>' +
      roundsHtml +
      '<div class="final-score-summary" style="margin-top:6px;"><span>Final Score</span><span class="final-score-value">' +
      (process.finalScore === null ? '—' : process.finalScore + ' / 100') + '</span></div>';
    document.getElementById('viewModalOverlay').hidden = false;
  },

  /* ---------- validation ---------- */
  clearErrors() {
    ROUND_TYPES.forEach(rt => {
      const errEl = document.getElementById('err_ir_' + rt.key + '_score');
      if (errEl) errEl.textContent = '';
      const field = document.getElementById('ir_' + rt.key + '_score');
      if (field) field.classList.remove('invalid');
    });
  },

  validate() {
    this.clearErrors();
    let valid = true;
    ROUND_TYPES.forEach(rt => {
      const val = document.getElementById('ir_' + rt.key + '_score').value;
      if (val !== '' && (Number(val) < 0 || Number(val) > 100)) {
        document.getElementById('err_ir_' + rt.key + '_score').textContent = 'Score must be between 0 and 100.';
        document.getElementById('ir_' + rt.key + '_score').classList.add('invalid');
        valid = false;
      }
    });
    return valid;
  },

  handleSave() {
    if (!this.validate()) {
      Toast.show('Please fix the highlighted fields.', 'error');
      return;
    }
    const list = this.getAll();
    const idx = list.findIndex(p => p.id === this.state.editingId);
    if (idx === -1) return;

    const rounds = this.readFormRounds();
    list[idx].rounds = rounds;
    list[idx].finalScore = this.computeFinalScore(rounds);
    list[idx].overallStatus = this.computeOverallStatus(rounds);
    list[idx].updatedAt = Date.now();

    this.saveAll(list);
    Activity.log('Interview rounds updated for ' + list[idx].candidateName + ' (' + list[idx].id + ') — ' + list[idx].overallStatus);
    Toast.show('Interview record saved for ' + list[idx].candidateName + '.', 'success');
    this.closeForm();
    this.render();
  },

  async handleDelete(id) {
    const list = this.getAll();
    const process = list.find(p => p.id === id);
    if (!process) return;
    const confirmed = await Confirm.ask(
      'Delete this interview record?',
      process.id + ' — ' + process.candidateName + '\u2019s round data will be permanently removed. A fresh record will be regenerated if their interview schedule is still active.',
      'Delete'
    );
    if (!confirmed) return;
    this.saveAll(list.filter(p => p.id !== id));
    Activity.log('Interview record ' + process.id + ' (' + process.candidateName + ') deleted');
    Toast.show('Interview record deleted.', 'success');
    this.render();
  },

  /* ---------- rendering ---------- */
  roundStatusBadge(status) {
    const map = { 'Not Scheduled': 'badge-neutral', 'Scheduled': 'badge-info', 'Completed': 'badge-success' };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + status + '</span>';
  },

  overallStatusBadge(status) {
    const map = { 'Not Started': 'badge-neutral', 'In Progress': 'badge-warning', 'Completed': 'badge-success' };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + Utils.escapeHtml(status) + '</span>';
  },

  finalScoreBadge(score) {
    if (score === null || score === undefined) return '<span class="badge badge-neutral">—</span>';
    const cls = score >= 75 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-danger';
    return '<span class="badge ' + cls + '">' + score + ' / 100</span>';
  },

  getFilteredSorted() {
    let list = this.syncQueue();
    const { search, status, sortKey, sortDir } = this.state;
    if (search) {
      list = list.filter(p =>
        (p.candidateName || '').toLowerCase().includes(search) ||
        (p.appliedForDesignation || '').toLowerCase().includes(search) ||
        (p.id || '').toLowerCase().includes(search)
      );
    }
    if (status) list = list.filter(p => p.overallStatus === status);
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === undefined || av === null) av = '';
      if (bv === undefined || bv === null) bv = '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  render() {
    const eligible = this.getEligibleSchedules();
    const hasAny = eligible.length > 0 || this.getAll().length > 0;
    document.getElementById('interviewNoCandidateGuard').hidden = hasAny;
    document.getElementById('interviewMainArea').style.display = hasAny ? '' : 'none';
    if (!hasAny) return;

    const all = this.syncQueue();
    this.renderStatusStrip(all);
    document.getElementById('filterInterviewStatus').value = this.state.status;
    document.getElementById('interviewSearch').value = this.state.search;

    const filtered = this.getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('interviewTableBody').innerHTML = pageItems.map(p => this.rowHtml(p)).join('');

    document.querySelectorAll('#interviewTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort')
        ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('interviewTableCount').textContent =
      filtered.length === 0 ? 'No interview records match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  renderStatusStrip(all) {
    const counts = { 'Not Started': 0, 'In Progress': 0, 'Completed': 0 };
    all.forEach(p => { if (counts[p.overallStatus] !== undefined) counts[p.overallStatus]++; });
    const scored = all.filter(p => p.finalScore !== null && p.finalScore !== undefined);
    const avg = scored.length ? Math.round(scored.reduce((sum, p) => sum + p.finalScore, 0) / scored.length) : null;

    const strip = document.getElementById('interviewStatusStrip');
    strip.innerHTML =
      this.chip('pending', 'Not Started', counts['Not Started']) +
      this.chip('screening', 'In Progress', counts['In Progress']) +
      this.chip('accepted', 'Completed', counts.Completed) +
      '<div class="status-chip open"><span class="status-chip-count">' + (avg === null ? '—' : avg) +
      '</span><span class="status-chip-label">Avg. Final Score</span></div>';
  },

  chip(cls, label, count) {
    return '<div class="status-chip ' + cls + '"><span class="status-chip-count">' + count +
      '</span><span class="status-chip-label">' + label + '</span></div>';
  },

  rowHtml(p) {
    return (
      '<tr data-id="' + Utils.escapeHtml(p.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(p.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(p.candidateName) + '</td>' +
      '<td>' + Utils.escapeHtml(p.appliedForDesignation) + '</td>' +
      '<td>' + this.roundStatusBadge(this.roundStatus(p.rounds.hr)) + '</td>' +
      '<td>' + this.roundStatusBadge(this.roundStatus(p.rounds.technical)) + '</td>' +
      '<td>' + this.roundStatusBadge(this.roundStatus(p.rounds.manager)) + '</td>' +
      '<td>' + this.roundStatusBadge(this.roundStatus(p.rounds.final)) + '</td>' +
      '<td>' + this.finalScoreBadge(p.finalScore) + '</td>' +
      '<td>' + this.overallStatusBadge(p.overallStatus) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      this.rowActionBtn('view', p.id, 'View', '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/>') +
      this.rowActionBtn('edit', p.id, 'Manage rounds', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>') +
      this.rowActionBtn('delete', p.id, 'Delete', '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', true) +
      '</div></td>' +
      '</tr>'
    );
  },

  rowActionBtn(action, id, title, iconPath, danger) {
    return '<button class="row-action-btn' + (danger ? ' danger' : '') + '" data-action="' + action + '" data-id="' +
      Utils.escapeHtml(id) + '" title="' + title + '" aria-label="' + title + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' + iconPath + '</svg></button>';
  },

  bindRowActions() {
    document.querySelectorAll('#interviewTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const process = this.getAll().find(p => p.id === id);
        if (!process) return;
        if (action === 'view') this.openView(process);
        if (action === 'edit') this.openForm(process);
        if (action === 'delete') this.handleDelete(id);
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('interviewPagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.render();
      });
    });
  }
};

/* ---------------------------------------------------------------
   15. PHASE 6 — CANDIDATE SELECTION (comparison table per vacancy)
--------------------------------------------------------------- */
const SelectionModule = {
  state: {
    status: ''
  },

  RECOMMENDATION_SCORES: { 'Strongly Recommend': 2, 'Recommend': 1, 'Neutral': 0, 'Do Not Recommend': -1 },

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.selections, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.selections, list);
  },

  /* ---------- eligible: fully-completed interviews ---------- */
  getEligibleProcesses() {
    return InterviewModule.getAll().filter(p => p.overallStatus === 'Completed');
  },

  syncQueue() {
    const eligible = this.getEligibleProcesses();
    const list = this.getAll();
    const existingIds = new Set(list.map(s => s.id));
    let changed = false;

    eligible.forEach(process => {
      if (existingIds.has(process.id)) return;
      const now = Date.now();
      list.push({
        id: process.id,
        resumeId: process.resumeId,
        vacancyId: process.vacancyId,
        candidateName: process.candidateName,
        appliedForDesignation: process.appliedForDesignation,
        status: 'Pending',
        createdAt: now,
        updatedAt: now
      });
      changed = true;
    });

    if (changed) this.saveAll(list);
    return list;
  },

  /* ---------- derived comparison data (recomputed live from source phases) ---------- */
  computeRecommendation(process) {
    if (!process) return null;
    const values = ROUND_TYPES
      .map(rt => process.rounds[rt.key].recommendation)
      .filter(Boolean)
      .map(r => this.RECOMMENDATION_SCORES[r]);
    if (!values.length) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    if (avg >= 1.5) return 'Strongly Recommend';
    if (avg >= 0.5) return 'Recommend';
    if (avg >= -0.5) return 'Neutral';
    return 'Do Not Recommend';
  },

  enrich(selection) {
    const process = InterviewModule.getAll().find(p => p.id === selection.id);
    const resume = ResumeModule.getAll().find(r => r.id === selection.resumeId);
    return {
      ...selection,
      interviewScore: process ? process.finalScore : null,
      resumeScore: resume ? resume.resumeScore : null,
      experienceYears: resume ? resume.experienceYears : null,
      education: resume ? resume.education : null,
      skills: resume ? resume.skills : [],
      recommendation: this.computeRecommendation(process)
    };
  },

  /* ---------- init ---------- */
  init() {
    document.getElementById('exportSelectionBtn').addEventListener('click', () => {
      Toast.show('Export is a UI preview in this simulator — no file is generated.', 'info');
    });
  },

  /* ---------- decisions ---------- */
  select(id) {
    const list = this.getAll();
    const target = list.find(s => s.id === id);
    if (!target) return;
    list.forEach(s => {
      if (s.vacancyId !== target.vacancyId) return;
      s.status = s.id === id ? 'Selected' : 'Rejected';
      s.updatedAt = Date.now();
    });
    this.saveAll(list);
    Activity.log(target.candidateName + ' selected for ' + target.appliedForDesignation + ' — other finalists rejected');
    Toast.show(target.candidateName + ' selected. Other finalists for this role were rejected.', 'success');
    this.render();
  },

  reject(id) {
    const list = this.getAll();
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return;
    list[idx].status = 'Rejected';
    list[idx].updatedAt = Date.now();
    this.saveAll(list);
    Activity.log(list[idx].candidateName + ' rejected at Candidate Selection');
    Toast.show(list[idx].candidateName + ' marked Rejected.', 'success');
    this.render();
  },

  resetToPending(id) {
    const list = this.getAll();
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) return;
    list[idx].status = 'Pending';
    list[idx].updatedAt = Date.now();
    this.saveAll(list);
    Activity.log(list[idx].candidateName + '\u2019s selection status reset to Pending');
    Toast.show(list[idx].candidateName + ' reset to Pending.', 'success');
    this.render();
  },

  /* ---------- view ---------- */
  openView(selection) {
    const enriched = this.enrich(selection);
    const skillsHtml = (enriched.skills || []).map(s => '<span class="mini-tag">' + Utils.escapeHtml(s) + '</span>').join(' ');
    document.getElementById('viewModalTitle').textContent = enriched.candidateName + ' — ' + enriched.id;
    document.getElementById('viewModalBody').innerHTML =
      '<div class="detail-grid">' +
      VacancyModule.detailItem('Applied For', enriched.appliedForDesignation) +
      VacancyModule.detailItem('Selection Status', this.statusBadge(enriched.status)) +
      VacancyModule.detailItem('Interview Score', InterviewModule.finalScoreBadge(enriched.interviewScore)) +
      VacancyModule.detailItem('Resume Score', enriched.resumeScore === null ? '—' : ResumeModule.scoreBadge(enriched.resumeScore)) +
      VacancyModule.detailItem('Experience', enriched.experienceYears === null ? '—' : enriched.experienceYears + ' yrs') +
      VacancyModule.detailItem('Education', enriched.education || '—') +
      VacancyModule.detailItem('Recommendation', enriched.recommendation || '—') +
      '<div class="detail-item detail-full"><span class="detail-label">Skills</span><div class="detail-value">' + (skillsHtml || '—') + '</div></div>' +
      VacancyModule.detailItem('Last Updated', new Date(enriched.updatedAt).toLocaleString('en-IN')) +
      '</div>';
    document.getElementById('viewModalOverlay').hidden = false;
  },

  /* ---------- rendering ---------- */
  statusBadge(status) {
    const map = { 'Pending': 'badge-neutral', 'Selected': 'badge-success', 'Rejected': 'badge-danger' };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + Utils.escapeHtml(status) + '</span>';
  },

  render() {
    const eligible = this.getEligibleProcesses();
    const hasAny = eligible.length > 0 || this.getAll().length > 0;
    document.getElementById('selectionNoCandidateGuard').hidden = hasAny;
    document.getElementById('selectionMainArea').style.display = hasAny ? '' : 'none';
    if (!hasAny) return;

    const all = this.syncQueue().map(s => this.enrich(s));
    this.renderStatusStrip(all);

    const vacancies = VacancyModule.getAll();
    const groups = {};
    all.forEach(s => {
      if (!groups[s.vacancyId]) groups[s.vacancyId] = [];
      groups[s.vacancyId].push(s);
    });

    const container = document.getElementById('selectionGroupsContainer');
    const vacancyIds = Object.keys(groups);
    if (!vacancyIds.length) {
      container.innerHTML = '<div class="panel"><div class="empty-state small">No finalists yet.</div></div>';
      return;
    }

    container.innerHTML = vacancyIds.map(vId => {
      const vacancy = vacancies.find(v => v.id === vId);
      const rows = groups[vId].sort((a, b) => (b.interviewScore || 0) - (a.interviewScore || 0));
      const label = vacancy ? vacancy.designation + ' (' + vacancy.department + ')' : (rows[0].appliedForDesignation + ' (vacancy deleted)');
      return (
        '<div class="comparison-group panel table-panel">' +
        '<div class="comparison-group-header">' +
        '<span class="comparison-group-title">' + Utils.escapeHtml(label) + '</span>' +
        '<span class="comparison-group-meta">' + rows.length + ' finalist' + (rows.length === 1 ? '' : 's') + '</span>' +
        '</div>' +
        '<div class="table-scroll"><table class="data-table">' +
        '<thead><tr><th>Candidate</th><th>Interview Score</th><th>Resume Score</th><th>Experience</th><th>Education</th><th>Skills</th><th>Recommendation</th><th>Status</th><th class="col-actions">Actions</th></tr></thead>' +
        '<tbody>' + rows.map(r => this.rowHtml(r)).join('') + '</tbody>' +
        '</table></div></div>'
      );
    }).join('');

    this.bindRowActions();
  },

  renderStatusStrip(all) {
    const counts = { Pending: 0, Selected: 0, Rejected: 0 };
    all.forEach(s => { if (counts[s.status] !== undefined) counts[s.status]++; });
    const strip = document.getElementById('selectionStatusStrip');
    strip.innerHTML =
      this.chip('pending', 'Pending', counts.Pending) +
      this.chip('shortlisted', 'Selected', counts.Selected) +
      this.chip('rejected', 'Rejected', counts.Rejected);
  },

  chip(cls, label, count) {
    return '<div class="status-chip ' + cls + '"><span class="status-chip-count">' + count +
      '</span><span class="status-chip-label">' + label + '</span></div>';
  },

  rowHtml(r) {
    const skillsPreview = (r.skills || []).slice(0, 3).map(s => '<span class="mini-tag">' + Utils.escapeHtml(s) + '</span>').join('');
    return (
      '<tr data-id="' + Utils.escapeHtml(r.id) + '">' +
      '<td class="cell-primary">' + Utils.escapeHtml(r.candidateName) + '</td>' +
      '<td>' + InterviewModule.finalScoreBadge(r.interviewScore) + '</td>' +
      '<td>' + (r.resumeScore === null ? '—' : ResumeModule.scoreBadge(r.resumeScore)) + '</td>' +
      '<td class="cell-secondary">' + (r.experienceYears === null ? '—' : r.experienceYears + ' yrs') + '</td>' +
      '<td>' + Utils.escapeHtml(r.education || '—') + '</td>' +
      '<td>' + skillsPreview + '</td>' +
      '<td class="cell-secondary">' + Utils.escapeHtml(r.recommendation || '—') + '</td>' +
      '<td>' + this.statusBadge(r.status) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      this.rowActionBtn('view', r.id, 'View', '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/>') +
      this.rowActionBtn('more', r.id, 'More actions', '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>') +
      '</div></td></tr>'
    );
  },

  rowActionBtn(action, id, title, iconPath) {
    return '<button class="row-action-btn" data-action="' + action + '" data-id="' +
      Utils.escapeHtml(id) + '" title="' + title + '" aria-label="' + title + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' + iconPath + '</svg></button>';
  },

  bindRowActions() {
    document.querySelectorAll('#selectionGroupsContainer .row-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const selection = this.getAll().find(s => s.id === id);
        if (!selection) return;
        if (action === 'view') this.openView(this.enrich(selection));
        if (action === 'more') {
          e.stopPropagation();
          RowMenu.open(btn, [
            { label: 'Select This Candidate', disabled: selection.status === 'Selected', onClick: () => this.select(id) },
            { label: 'Reject', danger: true, disabled: selection.status === 'Rejected', onClick: () => this.reject(id) },
            { label: 'Reset to Pending', disabled: selection.status === 'Pending', onClick: () => this.resetToPending(id) }
          ]);
        }
      });
    });
  }
};

/* ---------------------------------------------------------------
   16. PHASE 7 — OFFER LETTER
--------------------------------------------------------------- */
const OfferModule = {
  state: {
    search: '',
    status: '',
    sortKey: 'joiningDate',
    sortDir: 'asc',
    editingId: null,
    allowances: [],
    page: 1,
    pageSize: 8
  },

  DEFAULT_TERMS: 'This offer is valid for 7 days from the date of issue. Please confirm your acceptance in writing within this period.',
  DEFAULT_CONDITIONS: 'This offer is subject to verification of original documents, satisfactory reference and background checks, and successful completion of any pre-joining formalities.',
  DEFAULT_ALLOWANCES: ['HRA', 'Conveyance Allowance', 'Medical Allowance'],
  get COMPANY_NAME() { return CompanySettingsStore.get().name; },

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.offers, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.offers, list);
  },
  nextId() {
    const counter = Storage.get(STORAGE_KEYS.offerCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.offerCounter, counter);
    const year = new Date().getFullYear();
    return 'OFR-' + year + '-' + Utils.pad(counter, 4);
  },

  /* ---------- eligible: Selected candidates ---------- */
  getEligibleSelections() {
    return SelectionModule.getAll().filter(s => s.status === 'Selected');
  },

  syncQueue() {
    const eligible = this.getEligibleSelections();
    const list = this.getAll();
    const existingIds = new Set(list.map(o => o.selectionId));
    let changed = false;

    eligible.forEach(selection => {
      if (existingIds.has(selection.id)) return;
      const resume = ResumeModule.getAll().find(r => r.id === selection.resumeId);
      const vacancy = VacancyModule.getAll().find(v => v.id === selection.vacancyId);
      const now = Date.now();
      list.push({
        id: this.nextId(),
        selectionId: selection.id,
        resumeId: selection.resumeId,
        vacancyId: selection.vacancyId,
        candidateName: selection.candidateName,
        appliedForDesignation: selection.appliedForDesignation,
        department: vacancy ? vacancy.department : '',
        joiningDate: '',
        salary: resume ? resume.expectedSalary : (vacancy ? Math.round((vacancy.salaryMin + vacancy.salaryMax) / 2) : 0),
        allowances: [...this.DEFAULT_ALLOWANCES],
        terms: this.DEFAULT_TERMS,
        conditions: this.DEFAULT_CONDITIONS,
        signatoryName: '',
        signatoryTitle: '',
        status: 'Draft',
        createdAt: now,
        updatedAt: now
      });
      changed = true;
    });

    if (changed) this.saveAll(list);
    return list;
  },

  /* ---------- init ---------- */
  init() {
    const options = AUTHORIZED_SIGNATORIES.map(s =>
      '<option value="' + Utils.escapeHtml(s.name) + '|' + Utils.escapeHtml(s.title) + '">' +
      Utils.escapeHtml(s.name) + ' — ' + Utils.escapeHtml(s.title) + '</option>'
    ).join('');
    document.getElementById('o_signatory').insertAdjacentHTML('beforeend', options);

    this.bindToolbar();
    this.bindForm();
    this.bindModals();
    document.getElementById('exportOfferBtn').addEventListener('click', () => {
      Toast.show('Export is a UI preview in this simulator — no file is generated.', 'info');
    });
  },

  bindToolbar() {
    const searchInput = document.getElementById('offerSearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.render();
    }, 200));
    document.getElementById('filterOfferStatus').addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('clearOfferFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.status = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterOfferStatus').value = '';
      this.render();
    });
    document.querySelectorAll('#offerTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'asc';
        }
        this.render();
      });
    });
  },

  bindModals() {
    document.getElementById('offerModalCloseBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('offerCancelBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('offerModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'offerModalOverlay') this.closeForm();
    });
    document.getElementById('offerPreviewCloseBtn').addEventListener('click', () => this.closePreview());
    document.getElementById('offerPreviewCloseBtn2').addEventListener('click', () => this.closePreview());
    document.getElementById('offerPreviewOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'offerPreviewOverlay') this.closePreview();
    });
    document.getElementById('offerPrintBtn').addEventListener('click', () => window.print());
    document.getElementById('offerDownloadBtn').addEventListener('click', (e) => {
      PdfExport.downloadElement('offerLetterPaper', this.state.previewFilename || 'Offer-Letter.pdf', e.currentTarget);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('offerModalOverlay').hidden) this.closeForm();
      if (!document.getElementById('offerPreviewOverlay').hidden) this.closePreview();
    });
  },

  bindForm() {
    const input = document.getElementById('o_allowancesInput');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = input.value.trim().replace(/,$/, '');
        if (val && !this.state.allowances.includes(val)) {
          this.state.allowances.push(val);
          this.renderAllowanceTags();
        }
        input.value = '';
      } else if (e.key === 'Backspace' && !input.value) {
        this.state.allowances.pop();
        this.renderAllowanceTags();
      }
    });
    document.getElementById('offerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });
  },

  renderAllowanceTags() {
    const wrap = document.getElementById('o_allowancesTagList');
    wrap.innerHTML = this.state.allowances.map((a, i) =>
      '<span class="tag-chip">' + Utils.escapeHtml(a) +
      '<button type="button" data-allowance-index="' + i + '" aria-label="Remove ' + Utils.escapeHtml(a) + '">' +
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>' +
      '</button></span>'
    ).join('');
    wrap.querySelectorAll('button[data-allowance-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.allowances.splice(Number(btn.getAttribute('data-allowance-index')), 1);
        this.renderAllowanceTags();
      });
    });
  },

  /* ---------- form open/close ---------- */
  openForm(offer) {
    const form = document.getElementById('offerForm');
    form.reset();
    this.clearErrors();
    this.state.editingId = offer.id;
    this.state.allowances = [...(offer.allowances || [])];
    this.renderAllowanceTags();

    const initials = (offer.candidateName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    document.getElementById('offerAvatarInitials').textContent = initials;
    document.getElementById('offerCandidateName').textContent = offer.candidateName;
    document.getElementById('offerCandidateMeta').textContent =
      offer.appliedForDesignation + (offer.department ? ' · ' + offer.department : '') + ' · ' + offer.id;
    document.getElementById('offerModalTitle').textContent = 'Edit Offer Letter — ' + offer.id;

    document.getElementById('o_joiningDate').value = offer.joiningDate || '';
    document.getElementById('o_salary').value = offer.salary || '';
    document.getElementById('o_signatory').value = offer.signatoryName ? (offer.signatoryName + '|' + offer.signatoryTitle) : '';
    document.getElementById('o_status').value = offer.status;
    document.getElementById('o_terms').value = offer.terms || '';
    document.getElementById('o_conditions').value = offer.conditions || '';

    document.getElementById('offerModalOverlay').hidden = false;
    setTimeout(() => document.getElementById('o_joiningDate').focus(), 30);
  },

  closeForm() {
    document.getElementById('offerModalOverlay').hidden = true;
  },

  /* ---------- letter preview ---------- */
  openPreview(offer) {
    document.getElementById('offerLetterPaper').innerHTML = this.renderLetterHtml(offer);
    this.state.previewFilename = 'Offer-Letter-' + offer.candidateName.replace(/\s+/g, '-') + '.pdf';
    document.getElementById('offerPreviewOverlay').hidden = false;
  },

  closePreview() {
    document.getElementById('offerPreviewOverlay').hidden = true;
  },

  renderLetterHtml(offer) {
    const allowancesText = (offer.allowances || []).length ? (offer.allowances || []).join(', ') : 'none';
    const issueDate = new Date(offer.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const joiningText = offer.joiningDate ? Utils.formatDate(offer.joiningDate) : '[joining date to be confirmed]';
    const salaryText = offer.salary ? Utils.formatCurrency(offer.salary) + ' per month' : '[salary to be confirmed]';
    const hasSignatory = !!offer.signatoryName;

    return (
      '<div class="offer-letter-header">' +
      '<span class="offer-letter-company">' + Utils.escapeHtml(this.COMPANY_NAME) + '</span>' +
      '</div>' +
      '<div class="offer-letter-meta-row"><span>Offer Number: <strong>' + Utils.escapeHtml(offer.id) + '</strong></span><span>Date: ' + issueDate + '</span></div>' +
      '<div class="offer-letter-body">' +
      '<p>Dear ' + Utils.escapeHtml(offer.candidateName) + ',</p>' +
      '<p>We are pleased to offer you the position of <strong>' + Utils.escapeHtml(offer.appliedForDesignation) + '</strong>' +
      (offer.department ? ' in the <strong>' + Utils.escapeHtml(offer.department) + '</strong> department' : '') +
      ' at ' + Utils.escapeHtml(this.COMPANY_NAME) + '.</p>' +
      '<p>Your date of joining will be <strong>' + joiningText + '</strong>. Your monthly compensation will be <strong>' + salaryText +
      '</strong>, along with the following allowances: <strong>' + Utils.escapeHtml(allowancesText) + '</strong>.</p>' +
      '<div class="offer-letter-section-title">Terms</div><p>' + Utils.escapeHtml(offer.terms || '—') + '</p>' +
      '<div class="offer-letter-section-title">Conditions</div><p>' + Utils.escapeHtml(offer.conditions || '—') + '</p>' +
      '<p>We look forward to welcoming you to our team.</p>' +
      '</div>' +
      '<div class="offer-letter-signature">' +
      '<p>Sincerely,</p>' +
      '<div class="offer-letter-sign-line">' +
      '<div class="offer-letter-sign-name">' + (hasSignatory ? Utils.escapeHtml(offer.signatoryName) : '[Authorized Signatory]') + '</div>' +
      '<div class="offer-letter-sign-title">' + (hasSignatory ? Utils.escapeHtml(offer.signatoryTitle) : '') + '</div>' +
      '</div></div>'
    );
  },

  /* ---------- validation ---------- */
  clearErrors() {
    ['o_joiningDate', 'o_salary', 'o_signatory', 'o_terms', 'o_conditions'].forEach(id => {
      const errEl = document.getElementById('err_' + id);
      if (errEl) errEl.textContent = '';
      const field = document.getElementById(id);
      if (field) field.classList.remove('invalid');
    });
  },

  validate() {
    this.clearErrors();
    let valid = true;
    if (!document.getElementById('o_joiningDate').value) {
      document.getElementById('err_o_joiningDate').textContent = 'Joining date is required.';
      document.getElementById('o_joiningDate').classList.add('invalid');
      valid = false;
    }
    const salary = document.getElementById('o_salary').value;
    if (!salary || Number(salary) <= 0) {
      document.getElementById('err_o_salary').textContent = 'Salary must be greater than zero.';
      document.getElementById('o_salary').classList.add('invalid');
      valid = false;
    }
    if (!document.getElementById('o_signatory').value) {
      document.getElementById('err_o_signatory').textContent = 'Select an authorized signatory.';
      document.getElementById('o_signatory').classList.add('invalid');
      valid = false;
    }
    if (!document.getElementById('o_terms').value.trim()) {
      document.getElementById('err_o_terms').textContent = 'Terms cannot be empty.';
      valid = false;
    }
    if (!document.getElementById('o_conditions').value.trim()) {
      document.getElementById('err_o_conditions').textContent = 'Conditions cannot be empty.';
      valid = false;
    }
    return valid;
  },

  handleSave() {
    if (!this.validate()) {
      Toast.show('Please fix the highlighted fields.', 'error');
      return;
    }
    const list = this.getAll();
    const idx = list.findIndex(o => o.id === this.state.editingId);
    if (idx === -1) return;

    const [signatoryName, signatoryTitle] = document.getElementById('o_signatory').value.split('|');

    list[idx].joiningDate = document.getElementById('o_joiningDate').value;
    list[idx].salary = Number(document.getElementById('o_salary').value);
    list[idx].allowances = [...this.state.allowances];
    list[idx].terms = document.getElementById('o_terms').value.trim();
    list[idx].conditions = document.getElementById('o_conditions').value.trim();
    list[idx].signatoryName = signatoryName;
    list[idx].signatoryTitle = signatoryTitle;
    list[idx].status = document.getElementById('o_status').value;
    list[idx].updatedAt = Date.now();

    this.saveAll(list);
    Activity.log('Offer letter ' + list[idx].id + ' (' + list[idx].candidateName + ') updated — ' + list[idx].status);
    Toast.show('Offer letter saved for ' + list[idx].candidateName + '.', 'success');
    this.closeForm();
    this.render();
  },

  async handleDelete(id) {
    const list = this.getAll();
    const offer = list.find(o => o.id === id);
    if (!offer) return;
    const confirmed = await Confirm.ask(
      'Delete this offer letter?',
      offer.id + ' — ' + offer.candidateName + '\u2019s offer will be permanently removed. A fresh draft will be regenerated since they are still marked Selected.',
      'Delete'
    );
    if (!confirmed) return;
    this.saveAll(list.filter(o => o.id !== id));
    Activity.log('Offer letter ' + offer.id + ' (' + offer.candidateName + ') deleted');
    Toast.show('Offer letter deleted.', 'success');
    this.render();
  },

  changeStatus(id, status) {
    const list = this.getAll();
    const idx = list.findIndex(o => o.id === id);
    if (idx === -1) return;
    list[idx].status = status;
    list[idx].updatedAt = Date.now();
    this.saveAll(list);
    Activity.log('Offer letter ' + list[idx].id + ' (' + list[idx].candidateName + ') marked ' + status);
    Toast.show(list[idx].candidateName + '\u2019s offer marked ' + status + '.', 'success');
    this.render();
  },

  /* ---------- rendering ---------- */
  statusBadge(status) {
    const map = { 'Draft': 'badge-neutral', 'Issued': 'badge-info', 'Accepted': 'badge-success', 'Declined': 'badge-danger' };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + Utils.escapeHtml(status) + '</span>';
  },

  getFilteredSorted() {
    let list = this.syncQueue();
    const { search, status, sortKey, sortDir } = this.state;
    if (search) {
      list = list.filter(o =>
        (o.candidateName || '').toLowerCase().includes(search) ||
        (o.appliedForDesignation || '').toLowerCase().includes(search) ||
        (o.id || '').toLowerCase().includes(search)
      );
    }
    if (status) list = list.filter(o => o.status === status);
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === undefined || av === null || av === '') av = sortKey === 'joiningDate' ? '9999-99-99' : '';
      if (bv === undefined || bv === null || bv === '') bv = sortKey === 'joiningDate' ? '9999-99-99' : '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  render() {
    const eligible = this.getEligibleSelections();
    const hasAny = eligible.length > 0 || this.getAll().length > 0;
    document.getElementById('offerNoCandidateGuard').hidden = hasAny;
    document.getElementById('offerMainArea').style.display = hasAny ? '' : 'none';
    if (!hasAny) return;

    const all = this.syncQueue();
    this.renderStatusStrip(all);
    document.getElementById('filterOfferStatus').value = this.state.status;
    document.getElementById('offerSearch').value = this.state.search;

    const filtered = this.getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('offerTableBody').innerHTML = pageItems.map(o => this.rowHtml(o)).join('');

    document.querySelectorAll('#offerTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort')
        ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('offerTableCount').textContent =
      filtered.length === 0 ? 'No offer letters match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  renderStatusStrip(all) {
    const counts = { Draft: 0, Issued: 0, Accepted: 0, Declined: 0 };
    all.forEach(o => { if (counts[o.status] !== undefined) counts[o.status]++; });
    const strip = document.getElementById('offerStatusStrip');
    strip.innerHTML =
      this.chip('pending', 'Draft', counts.Draft) +
      this.chip('received', 'Issued', counts.Issued) +
      this.chip('accepted', 'Accepted', counts.Accepted) +
      this.chip('rejected', 'Declined', counts.Declined);
  },

  chip(cls, label, count) {
    return '<div class="status-chip ' + cls + '"><span class="status-chip-count">' + count +
      '</span><span class="status-chip-label">' + label + '</span></div>';
  },

  rowHtml(o) {
    return (
      '<tr data-id="' + Utils.escapeHtml(o.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(o.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(o.candidateName) + '</td>' +
      '<td>' + Utils.escapeHtml(o.appliedForDesignation) + '</td>' +
      '<td>' + Utils.escapeHtml(o.department || '—') + '</td>' +
      '<td class="cell-secondary">' + (o.joiningDate ? Utils.formatDate(o.joiningDate) : '—') + '</td>' +
      '<td class="cell-secondary">' + (o.salary ? Utils.formatCurrency(o.salary) : '—') + '</td>' +
      '<td>' + this.statusBadge(o.status) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      this.rowActionBtn('preview', o.id, 'Preview', '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/>') +
      this.rowActionBtn('edit', o.id, 'Edit', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>') +
      this.rowActionBtn('delete', o.id, 'Delete', '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', true) +
      this.rowActionBtn('more', o.id, 'More actions', '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>') +
      '</div></td>' +
      '</tr>'
    );
  },

  rowActionBtn(action, id, title, iconPath, danger) {
    return '<button class="row-action-btn' + (danger ? ' danger' : '') + '" data-action="' + action + '" data-id="' +
      Utils.escapeHtml(id) + '" title="' + title + '" aria-label="' + title + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' + iconPath + '</svg></button>';
  },

  bindRowActions() {
    document.querySelectorAll('#offerTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const offer = this.getAll().find(o => o.id === id);
        if (!offer) return;
        if (action === 'preview') this.openPreview(offer);
        if (action === 'edit') this.openForm(offer);
        if (action === 'delete') this.handleDelete(id);
        if (action === 'more') {
          e.stopPropagation();
          RowMenu.open(btn, [
            { label: 'Mark Accepted', disabled: offer.status === 'Accepted', onClick: () => this.changeStatus(id, 'Accepted') },
            { label: 'Mark Declined', danger: true, disabled: offer.status === 'Declined', onClick: () => this.changeStatus(id, 'Declined') }
          ]);
        }
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('offerPagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.render();
      });
    });
  }
};

/* ---------------------------------------------------------------
   17. PHASE 8 — JOINING FORMALITIES (onboarding checklist)
--------------------------------------------------------------- */
const JoiningModule = {
  state: {
    search: '',
    status: '',
    sortKey: 'candidateName',
    sortDir: 'asc',
    editingId: null,
    items: {},
    page: 1,
    pageSize: 8
  },

  emptyItems() {
    const obj = {};
    CHECKLIST_ITEMS.forEach(ci => { obj[ci.key] = false; });
    return obj;
  },

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.joinings, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.joinings, list);
  },
  nextId() {
    const counter = Storage.get(STORAGE_KEYS.joiningCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.joiningCounter, counter);
    const year = new Date().getFullYear();
    return 'JOIN-' + year + '-' + Utils.pad(counter, 4);
  },

  /* ---------- eligible: Accepted offers ---------- */
  getEligibleOffers() {
    return OfferModule.getAll().filter(o => o.status === 'Accepted');
  },

  syncQueue() {
    const eligible = this.getEligibleOffers();
    const list = this.getAll();
    const existingOfferIds = new Set(list.map(j => j.offerId));
    let changed = false;

    eligible.forEach(offer => {
      if (existingOfferIds.has(offer.id)) return;
      const now = Date.now();
      list.push({
        id: this.nextId(),
        offerId: offer.id,
        resumeId: offer.resumeId,
        vacancyId: offer.vacancyId,
        candidateName: offer.candidateName,
        appliedForDesignation: offer.appliedForDesignation,
        department: offer.department,
        items: this.emptyItems(),
        completionPercent: 0,
        status: 'Not Started',
        createdAt: now,
        updatedAt: now
      });
      changed = true;
    });

    if (changed) this.saveAll(list);
    return list;
  },

  computeCompletion(items) {
    const total = CHECKLIST_ITEMS.length;
    const done = CHECKLIST_ITEMS.filter(ci => items[ci.key]).length;
    return Math.round((done / total) * 100);
  },

  computeStatus(percent) {
    if (percent === 0) return 'Not Started';
    if (percent === 100) return 'Completed';
    return 'In Progress';
  },

  /* ---------- init ---------- */
  init() {
    this.buildChecklistItems();
    this.bindToolbar();
    this.bindForm();
    this.bindModals();
    document.getElementById('exportJoiningBtn').addEventListener('click', () => {
      Toast.show('Export is a UI preview in this simulator — no file is generated.', 'info');
    });
  },

  buildChecklistItems() {
    const container = document.getElementById('checklistItemsContainer');
    container.innerHTML = CHECKLIST_ITEMS.map(ci =>
      '<div class="checklist-item">' +
      '<input type="checkbox" id="chk_' + ci.key + '" data-checklist-key="' + ci.key + '" />' +
      '<label for="chk_' + ci.key + '">' + Utils.escapeHtml(ci.label) + '</label>' +
      '</div>'
    ).join('');
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => this.recalcLive());
    });
  },

  recalcLive() {
    const items = this.readFormItems();
    const percent = this.computeCompletion(items);
    document.getElementById('joiningProgressFill').style.width = percent + '%';
    document.getElementById('joiningProgressLabel').textContent = percent + '% complete';
  },

  readFormItems() {
    const items = {};
    CHECKLIST_ITEMS.forEach(ci => {
      items[ci.key] = document.getElementById('chk_' + ci.key).checked;
    });
    return items;
  },

  /* ---------- toolbar ---------- */
  bindToolbar() {
    const searchInput = document.getElementById('joiningSearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.render();
    }, 200));
    document.getElementById('filterJoiningStatus').addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('clearJoiningFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.status = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterJoiningStatus').value = '';
      this.render();
    });
    document.querySelectorAll('#joiningTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'asc';
        }
        this.render();
      });
    });
  },

  bindModals() {
    document.getElementById('joiningModalCloseBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('joiningCancelBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('joiningModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'joiningModalOverlay') this.closeForm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('joiningModalOverlay').hidden) this.closeForm();
    });
  },

  bindForm() {
    document.getElementById('joiningForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });
  },

  /* ---------- form open/close ---------- */
  openForm(checklist) {
    const form = document.getElementById('joiningForm');
    form.reset();
    this.state.editingId = checklist.id;

    const initials = (checklist.candidateName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    document.getElementById('joiningAvatarInitials').textContent = initials;
    document.getElementById('joiningCandidateName').textContent = checklist.candidateName;
    document.getElementById('joiningCandidateMeta').textContent =
      checklist.appliedForDesignation + (checklist.department ? ' · ' + checklist.department : '') + ' · ' + checklist.id;
    document.getElementById('joiningModalTitle').textContent = 'Onboarding Checklist — ' + checklist.id;

    CHECKLIST_ITEMS.forEach(ci => {
      document.getElementById('chk_' + ci.key).checked = !!checklist.items[ci.key];
    });
    this.recalcLive();

    document.getElementById('joiningModalOverlay').hidden = false;
  },

  closeForm() {
    document.getElementById('joiningModalOverlay').hidden = true;
  },

  openView(checklist) {
    const initials = (checklist.candidateName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const itemsHtml = CHECKLIST_ITEMS.map(ci => {
      const done = !!checklist.items[ci.key];
      return '<div class="checklist-item"><span class="badge ' + (done ? 'badge-success' : 'badge-neutral') + '">' +
        (done ? '\u2713' : '\u2014') + '</span>&nbsp; ' + Utils.escapeHtml(ci.label) + '</div>';
    }).join('');
    document.getElementById('viewModalTitle').textContent = checklist.candidateName + ' — ' + checklist.id;
    document.getElementById('viewModalBody').innerHTML =
      '<div class="resume-preview-header">' +
      '<div class="resume-preview-avatar">' + Utils.escapeHtml(initials) + '</div>' +
      '<div><div class="resume-preview-name">' + Utils.escapeHtml(checklist.candidateName) + '</div>' +
      '<div class="resume-preview-meta">' + Utils.escapeHtml(checklist.appliedForDesignation) + ' &middot; ' + this.statusBadgeText(checklist.status) + '</div>' +
      '</div></div>' +
      '<div class="progress-summary"><div class="progress-bar-track"><div class="progress-bar-fill" style="width:' + checklist.completionPercent + '%"></div></div>' +
      '<span class="progress-summary-label">' + checklist.completionPercent + '% complete</span></div>' +
      '<div class="checklist-grid">' + itemsHtml + '</div>';
    document.getElementById('viewModalOverlay').hidden = false;
  },

  statusBadgeText(status) {
    return this.statusBadge(status).replace(/<[^>]+>/g, '');
  },

  handleSave() {
    const list = this.getAll();
    const idx = list.findIndex(j => j.id === this.state.editingId);
    if (idx === -1) return;

    const items = this.readFormItems();
    const percent = this.computeCompletion(items);
    list[idx].items = items;
    list[idx].completionPercent = percent;
    list[idx].status = this.computeStatus(percent);
    list[idx].updatedAt = Date.now();

    this.saveAll(list);
    Activity.log('Onboarding checklist for ' + list[idx].candidateName + ' (' + list[idx].id + ') updated — ' + percent + '% complete');
    Toast.show('Checklist saved for ' + list[idx].candidateName + '.', 'success');
    this.closeForm();
    this.render();
  },

  async handleDelete(id) {
    const list = this.getAll();
    const checklist = list.find(j => j.id === id);
    if (!checklist) return;
    const confirmed = await Confirm.ask(
      'Delete this checklist?',
      checklist.id + ' — ' + checklist.candidateName + '\u2019s onboarding checklist will be permanently removed. A fresh one will be regenerated since their offer is still Accepted.',
      'Delete'
    );
    if (!confirmed) return;
    this.saveAll(list.filter(j => j.id !== id));
    Activity.log('Onboarding checklist ' + checklist.id + ' (' + checklist.candidateName + ') deleted');
    Toast.show('Checklist deleted.', 'success');
    this.render();
  },

  /* ---------- rendering ---------- */
  statusBadge(status) {
    const map = { 'Not Started': 'badge-neutral', 'In Progress': 'badge-warning', 'Completed': 'badge-success' };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + Utils.escapeHtml(status) + '</span>';
  },

  getFilteredSorted() {
    let list = this.syncQueue();
    const { search, status, sortKey, sortDir } = this.state;
    if (search) {
      list = list.filter(j =>
        (j.candidateName || '').toLowerCase().includes(search) ||
        (j.appliedForDesignation || '').toLowerCase().includes(search) ||
        (j.id || '').toLowerCase().includes(search)
      );
    }
    if (status) list = list.filter(j => j.status === status);
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === undefined) av = '';
      if (bv === undefined) bv = '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  render() {
    const eligible = this.getEligibleOffers();
    const hasAny = eligible.length > 0 || this.getAll().length > 0;
    document.getElementById('joiningNoCandidateGuard').hidden = hasAny;
    document.getElementById('joiningMainArea').style.display = hasAny ? '' : 'none';
    if (!hasAny) return;

    const all = this.syncQueue();
    this.renderStatusStrip(all);
    document.getElementById('filterJoiningStatus').value = this.state.status;
    document.getElementById('joiningSearch').value = this.state.search;

    const filtered = this.getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('joiningTableBody').innerHTML = pageItems.map(j => this.rowHtml(j)).join('');

    document.querySelectorAll('#joiningTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort')
        ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('joiningTableCount').textContent =
      filtered.length === 0 ? 'No checklists match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  renderStatusStrip(all) {
    const counts = { 'Not Started': 0, 'In Progress': 0, 'Completed': 0 };
    all.forEach(j => { if (counts[j.status] !== undefined) counts[j.status]++; });
    const avg = all.length ? Math.round(all.reduce((sum, j) => sum + j.completionPercent, 0) / all.length) : 0;
    const strip = document.getElementById('joiningStatusStrip');
    strip.innerHTML =
      this.chip('pending', 'Not Started', counts['Not Started']) +
      this.chip('screening', 'In Progress', counts['In Progress']) +
      this.chip('accepted', 'Completed', counts.Completed) +
      '<div class="status-chip open"><span class="status-chip-count">' + avg + '%</span><span class="status-chip-label">Avg. Completion</span></div>';
  },

  chip(cls, label, count) {
    return '<div class="status-chip ' + cls + '"><span class="status-chip-count">' + count +
      '</span><span class="status-chip-label">' + label + '</span></div>';
  },

  rowHtml(j) {
    return (
      '<tr data-id="' + Utils.escapeHtml(j.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(j.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(j.candidateName) + '</td>' +
      '<td>' + Utils.escapeHtml(j.appliedForDesignation) + '</td>' +
      '<td><span class="mini-progress-track"><span class="mini-progress-fill" style="width:' + j.completionPercent + '%"></span></span> ' + j.completionPercent + '%</td>' +
      '<td>' + this.statusBadge(j.status) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      this.rowActionBtn('view', j.id, 'View', '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/>') +
      this.rowActionBtn('edit', j.id, 'Update checklist', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>') +
      this.rowActionBtn('delete', j.id, 'Delete', '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', true) +
      '</div></td>' +
      '</tr>'
    );
  },

  rowActionBtn(action, id, title, iconPath, danger) {
    return '<button class="row-action-btn' + (danger ? ' danger' : '') + '" data-action="' + action + '" data-id="' +
      Utils.escapeHtml(id) + '" title="' + title + '" aria-label="' + title + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' + iconPath + '</svg></button>';
  },

  bindRowActions() {
    document.querySelectorAll('#joiningTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const checklist = this.getAll().find(j => j.id === id);
        if (!checklist) return;
        if (action === 'view') this.openView(checklist);
        if (action === 'edit') this.openForm(checklist);
        if (action === 'delete') this.handleDelete(id);
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('joiningPagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.render();
      });
    });
  }
};

/* ---------------------------------------------------------------
   18. PHASE 9 — EMPLOYEE MASTER
--------------------------------------------------------------- */
const EmployeeModule = {
  state: {
    search: '',
    department: '',
    status: '',
    sortKey: 'name',
    sortDir: 'asc',
    editingId: null,
    page: 1,
    pageSize: 8
  },

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.employees, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.employees, list);
  },
  nextId() {
    const counter = Storage.get(STORAGE_KEYS.employeeCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.employeeCounter, counter);
    const year = new Date().getFullYear();
    return 'EMP-' + year + '-' + Utils.pad(counter, 4);
  },

  suggestOfficialEmail(name) {
    const slug = (name || '').trim().toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).join('.');
    return (slug || 'employee') + '@skelora.com';
  },

  /* ---------- eligible: fully-completed onboarding checklists ---------- */
  getEligibleJoinings() {
    return JoiningModule.getAll().filter(j => j.status === 'Completed');
  },

  syncQueue() {
    const eligible = this.getEligibleJoinings();
    const list = this.getAll();
    const existingJoiningIds = new Set(list.map(e => e.joiningId));
    let changed = false;

    eligible.forEach(joining => {
      if (existingJoiningIds.has(joining.id)) return;
      const offer = OfferModule.getAll().find(o => o.id === joining.offerId);
      const resume = ResumeModule.getAll().find(r => r.id === joining.resumeId);
      const vacancy = VacancyModule.getAll().find(v => v.id === joining.vacancyId);
      const selectionId = offer ? offer.selectionId : null;
      const shortlist = selectionId ? ShortlistModule.getAll().find(s => s.id === selectionId) : null;
      const screeningId = shortlist ? shortlist.screeningId : null;
      const now = Date.now();

      list.push({
        id: this.nextId(),
        joiningId: joining.id,
        offerId: joining.offerId,
        selectionId: selectionId,
        screeningId: screeningId,
        resumeId: joining.resumeId,
        vacancyId: joining.vacancyId,

        name: joining.candidateName,
        phone: resume ? resume.phone : '',
        email: resume ? resume.email : '',
        address: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        photoFileName: '',

        designation: joining.appliedForDesignation,
        department: joining.department || (vacancy ? vacancy.department : ''),
        manager: vacancy ? vacancy.reportingManager : '',
        reportingManagerId: '',
        officialEmail: this.suggestOfficialEmail(joining.candidateName),
        salary: offer ? offer.salary : 0,
        attendanceRule: '',
        leavePolicy: '',
        shift: '',

        bankName: '',
        accountNumber: '',
        ifsc: '',

        pan: '',
        state: '',
        city: '',
        taxRegime: 'new',
        rentPaidMonthly: 0,
        declared80CAnnual: 0,

        status: 'Active',
        createdAt: now,
        updatedAt: now
      });
      changed = true;
    });

    if (changed) this.saveAll(list);
    return list;
  },

  /* ---------- init ---------- */
  init() {
    const deptOptions = DEPARTMENTS.map(d => '<option>' + Utils.escapeHtml(d) + '</option>').join('');
    document.getElementById('e_department').insertAdjacentHTML('beforeend', deptOptions);
    document.getElementById('filterEmployeeDepartment').insertAdjacentHTML('beforeend', deptOptions);
    document.getElementById('e_attendanceRule').insertAdjacentHTML('beforeend',
      ATTENDANCE_RULES.map(r => '<option>' + Utils.escapeHtml(r) + '</option>').join(''));
    document.getElementById('e_leavePolicy').insertAdjacentHTML('beforeend',
      LEAVE_POLICIES.map(p => '<option>' + Utils.escapeHtml(p) + '</option>').join(''));
    document.getElementById('e_shift').insertAdjacentHTML('beforeend',
      SHIFTS.map(s => '<option>' + Utils.escapeHtml(s) + '</option>').join(''));
    document.getElementById('e_state').insertAdjacentHTML('beforeend',
      STATES.map(s => '<option>' + Utils.escapeHtml(s) + '</option>').join(''));
    document.getElementById('e_city').insertAdjacentHTML('beforeend',
      CITIES.map(c => '<option>' + Utils.escapeHtml(c) + '</option>').join(''));

    document.getElementById('e_taxRegime').addEventListener('change', (e) => this.toggleRegimeFields(e.target.value));

    this.bindToolbar();
    this.bindForm();
    this.bindModals();
    document.getElementById('exportEmployeeBtn').addEventListener('click', () => {
      Toast.show('Export is a UI preview in this simulator — no file is generated.', 'info');
    });
  },

  bindToolbar() {
    const searchInput = document.getElementById('employeeSearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.render();
    }, 200));
    document.getElementById('filterEmployeeDepartment').addEventListener('change', (e) => {
      this.state.department = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('filterEmployeeStatus').addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('clearEmployeeFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.department = ''; this.state.status = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterEmployeeDepartment').value = '';
      document.getElementById('filterEmployeeStatus').value = '';
      this.render();
    });
    document.querySelectorAll('#employeeTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'asc';
        }
        this.render();
      });
    });
  },

  bindModals() {
    document.getElementById('employeeModalCloseBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('employeeCancelBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('employeeModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'employeeModalOverlay') this.closeForm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('employeeModalOverlay').hidden) this.closeForm();
    });

    document.getElementById('employeeCreateLoginBtn').addEventListener('click', () => {
      const employee = this.getAll().find(e => e.id === this.state.editingId);
      if (!employee) return;
      const role = Auth.hasDirectReports(employee.id) ? 'manager' : 'employee';
      const user = Auth.createLoginForEmployee(employee, role);
      this.renderLoginSection(employee);
      showCredentialsModal(user, 'Login Created');
    });
    document.getElementById('employeeResetLoginBtn').addEventListener('click', () => {
      const employee = this.getAll().find(e => e.id === this.state.editingId);
      if (!employee) return;
      const user = Auth.getUserForEmployee(employee.id);
      if (!user) return;
      const updated = Auth.resetPassword(user.id);
      showCredentialsModal(updated, 'Password Reset');
    });
    document.getElementById('employeeDeactivateLoginBtn').addEventListener('click', () => {
      const employee = this.getAll().find(e => e.id === this.state.editingId);
      if (!employee) return;
      const user = Auth.getUserForEmployee(employee.id);
      if (!user) return;
      Auth.setActive(user.id, user.active === false);
      this.renderLoginSection(employee);
      Toast.show(user.active === false ? 'Login reactivated.' : 'Login deactivated.', 'success');
    });
  },

  bindForm() {
    document.getElementById('employeeForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });
  },

  toggleRegimeFields(regime) {
    const isOld = regime === 'old';
    document.querySelectorAll('[data-regime-only="old"]').forEach(el => {
      el.style.display = isOld ? '' : 'none';
      const input = el.querySelector('input');
      if (input && !isOld) input.value = 0;
    });
    document.getElementById('regimeHint').textContent = isOld
      ? 'Old regime: HRA exemption + up to ₹1,50,000 of 80C investments reduce taxable income. Standard deduction ₹50,000.'
      : 'New regime: flat slabs with ₹75,000 standard deduction. HRA and 80C are not claimable.';
  },

  /* ---------- form open/close ---------- */
  openForm(employee) {
    const form = document.getElementById('employeeForm');
    form.reset();
    this.clearErrors();
    this.state.editingId = employee.id;

    const initials = (employee.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    document.getElementById('employeeAvatarInitials').textContent = initials;
    document.getElementById('employeeProfileName').textContent = employee.name;
    document.getElementById('employeeProfileMeta').textContent = employee.id + ' · ' + employee.designation;
    document.getElementById('employeeModalTitle').textContent = 'Edit Employee Profile — ' + employee.id;

    document.getElementById('e_phone').value = employee.phone || '';
    document.getElementById('e_email').value = employee.email || '';
    document.getElementById('e_address').value = employee.address || '';
    document.getElementById('e_emergencyContactName').value = employee.emergencyContactName || '';
    document.getElementById('e_emergencyContactPhone').value = employee.emergencyContactPhone || '';

    document.getElementById('e_designation').value = employee.designation || '';
    document.getElementById('e_department').value = employee.department || '';
    const managerSelect = document.getElementById('e_manager');
    const otherEmployees = EmployeeModule.getAll().filter(e => e.status === 'Active' && e.id !== employee.id);
    managerSelect.innerHTML = '<option value="">No reporting manager (top of hierarchy)</option>' +
      otherEmployees.map(e => '<option value="' + Utils.escapeHtml(e.id) + '">' + Utils.escapeHtml(e.name) + '</option>').join('');
    let resolvedManagerId = employee.reportingManagerId || '';
    if (!resolvedManagerId && employee.manager) {
      const legacyMatch = otherEmployees.find(e => e.name === employee.manager);
      if (legacyMatch) resolvedManagerId = legacyMatch.id;
    }
    managerSelect.value = resolvedManagerId;
    document.getElementById('e_officialEmail').value = employee.officialEmail || '';
    document.getElementById('e_salary').value = employee.salary || '';
    document.getElementById('e_status').value = employee.status || 'Active';
    document.getElementById('e_attendanceRule').value = employee.attendanceRule || '';
    document.getElementById('e_leavePolicy').value = employee.leavePolicy || '';
    document.getElementById('e_shift').value = employee.shift || '';

    document.getElementById('e_bankName').value = employee.bankName || '';
    document.getElementById('e_accountNumber').value = employee.accountNumber || '';
    document.getElementById('e_ifsc').value = employee.ifsc || '';

    document.getElementById('e_pan').value = employee.pan || '';
    document.getElementById('e_state').value = employee.state || '';
    document.getElementById('e_city').value = employee.city || '';
    document.getElementById('e_taxRegime').value = employee.taxRegime || 'new';
    document.getElementById('e_rentPaidMonthly').value = employee.rentPaidMonthly || 0;
    document.getElementById('e_declared80C').value = employee.declared80CAnnual || 0;
    this.toggleRegimeFields(employee.taxRegime || 'new');

    this.renderDocumentsList(employee);
    this.renderLoginSection(employee);

    document.getElementById('employeeModalOverlay').hidden = false;
    setTimeout(() => document.getElementById('e_phone').focus(), 30);
  },

  renderLoginSection(employee) {
    document.getElementById('employeeLoginSection').hidden = false;
    const user = Auth.getUserForEmployee(employee.id);
    const statusEl = document.getElementById('employeeLoginStatus');
    const createBtn = document.getElementById('employeeCreateLoginBtn');
    const resetBtn = document.getElementById('employeeResetLoginBtn');
    const deactivateBtn = document.getElementById('employeeDeactivateLoginBtn');

    if (!user) {
      const suggestedRole = Auth.hasDirectReports(employee.id) ? 'Manager' : 'Employee';
      statusEl.textContent = 'No login account yet. Will be created as: ' + suggestedRole + '.';
      createBtn.hidden = false;
      resetBtn.hidden = true;
      deactivateBtn.hidden = true;
    } else {
      const active = user.active !== false;
      statusEl.innerHTML = 'Username: <strong style="font-family:var(--font-mono);">' + Utils.escapeHtml(user.username) +
        '</strong> &middot; Role: ' + Utils.escapeHtml(ROLE_LABELS[user.role] || user.role) +
        ' &middot; <span class="badge ' + (active ? 'badge-success' : 'badge-neutral') + '">' + (active ? 'Active' : 'Deactivated') + '</span>';
      createBtn.hidden = true;
      resetBtn.hidden = false;
      deactivateBtn.hidden = false;
      deactivateBtn.textContent = active ? 'Deactivate Login' : 'Reactivate Login';
    }
  },

  closeForm() {
    document.getElementById('employeeModalOverlay').hidden = true;
  },

  renderDocumentsList(employee) {
    const joining = JoiningModule.getAll().find(j => j.id === employee.joiningId);
    const wrap = document.getElementById('employeeDocumentsList');
    if (!joining) { wrap.innerHTML = '<span class="muted-text">No onboarding record found.</span>'; return; }
    const docs = CHECKLIST_ITEMS.filter(ci => joining.items[ci.key]);
    wrap.innerHTML = docs.length
      ? docs.map(ci => '<span class="mini-tag">' + Utils.escapeHtml(ci.label) + '</span>').join('')
      : '<span class="muted-text">No documents on file yet.</span>';
  },

  /* ---------- Employee Timeline: fully derived from existing records, no new data entry ---------- */
  buildTimeline(employee) {
    const events = [];
    const resume = ResumeModule.getAll().find(r => r.id === employee.resumeId);
    const screening = employee.screeningId ? ScreeningModule.getAll().find(s => s.id === employee.screeningId) : null;
    const shortlist = employee.selectionId ? ShortlistModule.getAll().find(s => s.id === employee.selectionId) : null;
    const process = employee.selectionId ? InterviewModule.getAll().find(p => p.id === employee.selectionId) : null;
    const selection = employee.selectionId ? SelectionModule.getAll().find(s => s.id === employee.selectionId) : null;
    const offer = OfferModule.getAll().find(o => o.id === employee.offerId);
    const joining = JoiningModule.getAll().find(j => j.id === employee.joiningId);

    if (resume) events.push({ label: 'Application Received', ts: resume.createdAt });
    if (screening) events.push({ label: 'Moved to Screening', ts: screening.createdAt });
    if (screening && screening.decision === 'Shortlisted') events.push({ label: 'Shortlisted at Screening', ts: screening.updatedAt });
    if (shortlist) events.push({ label: 'Interview Scheduled', ts: shortlist.createdAt });
    if (process && process.overallStatus === 'Completed') events.push({ label: 'Interview Completed', ts: process.updatedAt });
    if (selection && selection.status === 'Selected') events.push({ label: 'Selected for Offer', ts: selection.updatedAt });
    if (offer) events.push({ label: 'Offer Issued', ts: offer.createdAt });
    if (offer && offer.status !== 'Draft') events.push({ label: 'Offer ' + offer.status, ts: offer.updatedAt });
    if (joining && joining.status === 'Completed') events.push({ label: 'Onboarding Completed', ts: joining.updatedAt });
    events.push({ label: 'Joined as Employee (' + employee.id + ')', ts: employee.createdAt });

    return events.sort((a, b) => a.ts - b.ts);
  },

  openView(employee) {
    const initials = (employee.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const timeline = this.buildTimeline(employee);
    const joining = JoiningModule.getAll().find(j => j.id === employee.joiningId);
    const docs = joining ? CHECKLIST_ITEMS.filter(ci => joining.items[ci.key]) : [];
    const docsHtml = docs.map(ci => '<span class="mini-tag">' + Utils.escapeHtml(ci.label) + '</span>').join('');

    const timelineHtml = timeline.map(ev =>
      '<div class="timeline-item"><span class="timeline-dot"></span>' +
      '<div class="timeline-label">' + Utils.escapeHtml(ev.label) + '</div>' +
      '<div class="timeline-date">' + new Date(ev.ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + '</div>' +
      '</div>'
    ).join('');

    document.getElementById('viewModalTitle').textContent = employee.name + ' — ' + employee.id;
    document.getElementById('viewModalBody').innerHTML =
      '<div class="resume-preview-header">' +
      '<div class="resume-preview-avatar">' + Utils.escapeHtml(initials) + '</div>' +
      '<div><div class="resume-preview-name">' + Utils.escapeHtml(employee.name) + '</div>' +
      '<div class="resume-preview-meta">' + Utils.escapeHtml(employee.designation) + ' &middot; ' + Utils.escapeHtml(employee.department) + ' &middot; ' + this.statusBadge(employee.status) + '</div>' +
      '</div></div>' +
      '<div class="detail-grid">' +
      VacancyModule.detailItem('Phone', employee.phone) +
      VacancyModule.detailItem('Personal Email', employee.email) +
      VacancyModule.detailItem('Official Email', employee.officialEmail) +
      VacancyModule.detailItem('Reporting Manager', employee.manager) +
      VacancyModule.detailItem('Salary', Utils.formatCurrency(employee.salary) + ' / month') +
      VacancyModule.detailItem('Shift', employee.shift || '—') +
      VacancyModule.detailItem('Attendance Rule', employee.attendanceRule || '—') +
      VacancyModule.detailItem('Leave Policy', employee.leavePolicy || '—') +
      VacancyModule.detailItem('Bank', (employee.bankName || '—') + (employee.ifsc ? ' · ' + employee.ifsc : '')) +
      VacancyModule.detailItem('Emergency Contact', (employee.emergencyContactName || '—') + (employee.emergencyContactPhone ? ' · ' + employee.emergencyContactPhone : '')) +
      '<div class="detail-item detail-full"><span class="detail-label">Address</span><div class="detail-value">' + Utils.escapeHtml(employee.address || '—') + '</div></div>' +
      '<div class="detail-item detail-full"><span class="detail-label">Documents on File</span><div class="detail-value">' + (docsHtml || '—') + '</div></div>' +
      '</div>' +
      '<div class="form-section-title" style="margin-top:18px;">Employee Timeline</div>' +
      '<div class="timeline">' + timelineHtml + '</div>';
    document.getElementById('viewModalOverlay').hidden = false;
  },

  /* ---------- validation ---------- */
  clearErrors() {
    ['e_phone', 'e_email', 'e_address', 'e_emergencyContactName', 'e_emergencyContactPhone',
      'e_designation', 'e_department', 'e_manager', 'e_officialEmail', 'e_salary',
      'e_attendanceRule', 'e_leavePolicy', 'e_shift', 'e_bankName', 'e_accountNumber', 'e_ifsc',
      'e_pan', 'e_state', 'e_city'].forEach(id => {
      const errEl = document.getElementById('err_' + id);
      if (errEl) errEl.textContent = '';
      const field = document.getElementById(id);
      if (field) field.classList.remove('invalid');
    });
  },

  setError(fieldId, message) {
    const errEl = document.getElementById('err_' + fieldId);
    if (errEl) errEl.textContent = message;
    const field = document.getElementById(fieldId);
    if (field) field.classList.add('invalid');
  },

  validate() {
    this.clearErrors();
    let valid = true;
    const val = (id) => document.getElementById(id).value.trim();

    if (!val('e_phone')) { this.setError('e_phone', 'Phone is required.'); valid = false; }
    const email = val('e_email');
    if (!email) { this.setError('e_email', 'Personal email is required.'); valid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this.setError('e_email', 'Enter a valid email address.'); valid = false; }
    if (!val('e_address')) { this.setError('e_address', 'Address is required.'); valid = false; }
    if (!val('e_emergencyContactName')) { this.setError('e_emergencyContactName', 'Emergency contact name is required.'); valid = false; }
    if (!val('e_emergencyContactPhone')) { this.setError('e_emergencyContactPhone', 'Emergency contact phone is required.'); valid = false; }

    if (!val('e_designation')) { this.setError('e_designation', 'Designation is required.'); valid = false; }
    if (!val('e_department')) { this.setError('e_department', 'Department is required.'); valid = false; }
        const officialEmail = val('e_officialEmail');
    if (!officialEmail) { this.setError('e_officialEmail', 'Official email is required.'); valid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officialEmail)) { this.setError('e_officialEmail', 'Enter a valid email address.'); valid = false; }
    const salary = val('e_salary');
    if (!salary || Number(salary) <= 0) { this.setError('e_salary', 'Salary must be greater than zero.'); valid = false; }
    if (!val('e_attendanceRule')) { this.setError('e_attendanceRule', 'Select an attendance rule.'); valid = false; }
    if (!val('e_leavePolicy')) { this.setError('e_leavePolicy', 'Select a leave policy.'); valid = false; }
    if (!val('e_shift')) { this.setError('e_shift', 'Select a shift.'); valid = false; }

    if (!val('e_bankName')) { this.setError('e_bankName', 'Bank name is required.'); valid = false; }
    if (!val('e_accountNumber')) { this.setError('e_accountNumber', 'Account number is required.'); valid = false; }
    if (!val('e_ifsc')) { this.setError('e_ifsc', 'IFSC code is required.'); valid = false; }

    const pan = val('e_pan').toUpperCase();
    if (!pan) { this.setError('e_pan', 'PAN is required.'); valid = false; }
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) { this.setError('e_pan', 'Enter a valid PAN (format: ABCDE1234F).'); valid = false; }
    if (!val('e_state')) { this.setError('e_state', 'Select a state for Professional Tax.'); valid = false; }
    if (!val('e_city')) { this.setError('e_city', 'Select a city.'); valid = false; }

    return valid;
  },

  handleSave() {
    if (!this.validate()) {
      Toast.show('Please fix the highlighted fields.', 'error');
      return;
    }
    const val = (id) => document.getElementById(id).value.trim();
    const list = this.getAll();
    const idx = list.findIndex(e => e.id === this.state.editingId);
    if (idx === -1) return;
    const beforeSnapshot = Object.assign({}, list[idx]);

    const fileInput = document.getElementById('e_photoFile');
    if (fileInput.files && fileInput.files[0]) list[idx].photoFileName = fileInput.files[0].name;

    list[idx].phone = val('e_phone');
    list[idx].email = val('e_email');
    list[idx].address = val('e_address');
    list[idx].emergencyContactName = val('e_emergencyContactName');
    list[idx].emergencyContactPhone = val('e_emergencyContactPhone');

    list[idx].designation = val('e_designation');
    list[idx].department = val('e_department');
    const selectedManagerId = val('e_manager');
    const selectedManagerEmp = selectedManagerId ? list.find(e => e.id === selectedManagerId) : null;
    list[idx].reportingManagerId = selectedManagerId;
    list[idx].manager = selectedManagerEmp ? selectedManagerEmp.name : '';
    list[idx].officialEmail = val('e_officialEmail');
    list[idx].salary = Number(val('e_salary'));
    list[idx].status = document.getElementById('e_status').value;
    list[idx].attendanceRule = val('e_attendanceRule');
    list[idx].leavePolicy = val('e_leavePolicy');
    list[idx].shift = val('e_shift');

    list[idx].bankName = val('e_bankName');
    list[idx].accountNumber = val('e_accountNumber');
    list[idx].ifsc = val('e_ifsc').toUpperCase();

    list[idx].pan = val('e_pan').toUpperCase();
    list[idx].state = val('e_state');
    list[idx].city = val('e_city');
    list[idx].taxRegime = document.getElementById('e_taxRegime').value;
    list[idx].rentPaidMonthly = Number(val('e_rentPaidMonthly')) || 0;
    list[idx].declared80CAnnual = Number(val('e_declared80C')) || 0;
    list[idx].updatedAt = Date.now();

    this.saveAll(list);
    Activity.log('Employee profile ' + list[idx].id + ' (' + list[idx].name + ') updated');
    AuditLog.logEmployeeChange(beforeSnapshot, list[idx]);
    Toast.show('Employee profile saved for ' + list[idx].name + '.', 'success');
    this.closeForm();
    this.render();
    Dashboard.render();
  },

  async handleDelete(id) {
    const list = this.getAll();
    const employee = list.find(e => e.id === id);
    if (!employee) return;

    const hasHistory =
      PayrollModule.getAll().some(p => p.employeeId === id) ||
      LeaveModule.getAll().some(l => l.employeeId === id) ||
      AttendanceModule.getAll().some(a => a.employeeId === id) ||
      ExitModule.getAll().some(x => x.employeeId === id) ||
      SettlementModule.getAll().some(s => s.employeeId === id);

    if (hasHistory) {
      Toast.show(employee.name + ' has payroll, leave, attendance, or exit records on file and can\u2019t be permanently deleted \u2014 real payroll history is never destroyed. Set their status to \u201cExited\u201d through Exit Management instead.', 'error');
      return;
    }

    const confirmed = await Confirm.ask(
      'Delete this employee record?',
      employee.id + ' — ' + employee.name + '\u2019s Employee Master record will be permanently removed. A fresh record will be regenerated since their onboarding checklist is still Completed.',
      'Delete'
    );
    if (!confirmed) return;
    this.saveAll(list.filter(e => e.id !== id));
    Activity.log('Employee record ' + employee.id + ' (' + employee.name + ') deleted');
    AuditLog.log('Employee Master', 'Deleted', employee.name + ' (' + employee.id + ')', 'Record permanently removed');
    Toast.show('Employee record deleted.', 'success');
    this.render();
    Dashboard.render();
  },

  /* ---------- rendering ---------- */
  statusBadge(status) {
    return '<span class="badge ' + (status === 'Active' ? 'badge-success' : 'badge-neutral') + '">' + Utils.escapeHtml(status) + '</span>';
  },

  getFilteredSorted() {
    let list = this.syncQueue();
    const { search, department, status, sortKey, sortDir } = this.state;
    if (search) {
      list = list.filter(e =>
        (e.name || '').toLowerCase().includes(search) ||
        (e.designation || '').toLowerCase().includes(search) ||
        (e.department || '').toLowerCase().includes(search) ||
        (e.id || '').toLowerCase().includes(search)
      );
    }
    if (department) list = list.filter(e => e.department === department);
    if (status) list = list.filter(e => e.status === status);
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === undefined) av = '';
      if (bv === undefined) bv = '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  render() {
    const eligible = this.getEligibleJoinings();
    const hasAny = eligible.length > 0 || this.getAll().length > 0;
    document.getElementById('employeeNoCandidateGuard').hidden = hasAny;
    document.getElementById('employeeMainArea').style.display = hasAny ? '' : 'none';
    if (!hasAny) return;

    const all = this.syncQueue();
    this.renderStatusStrip(all);
    document.getElementById('filterEmployeeDepartment').value = this.state.department;
    document.getElementById('filterEmployeeStatus').value = this.state.status;
    document.getElementById('employeeSearch').value = this.state.search;

    const filtered = this.getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('employeeTableBody').innerHTML = pageItems.map(e => this.rowHtml(e)).join('');

    document.querySelectorAll('#employeeTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort')
        ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('employeeTableCount').textContent =
      filtered.length === 0 ? 'No employees match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  renderStatusStrip(all) {
    const active = all.filter(e => e.status === 'Active').length;
    const inactive = all.length - active;
    const complete = all.filter(e =>
      e.attendanceRule && e.leavePolicy && e.shift && e.bankName && e.accountNumber && e.address
    ).length;
    const strip = document.getElementById('employeeStatusStrip');
    strip.innerHTML =
      '<div class="status-chip open"><span class="status-chip-count">' + all.length + '</span><span class="status-chip-label">Total Employees</span></div>' +
      '<div class="status-chip accepted"><span class="status-chip-count">' + active + '</span><span class="status-chip-label">Active</span></div>' +
      '<div class="status-chip closed"><span class="status-chip-count">' + inactive + '</span><span class="status-chip-label">Inactive</span></div>' +
      '<div class="status-chip screening"><span class="status-chip-count">' + complete + '</span><span class="status-chip-label">Profile Complete</span></div>';
  },

  rowHtml(e) {
    return (
      '<tr data-id="' + Utils.escapeHtml(e.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(e.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(e.name) + '</td>' +
      '<td>' + Utils.escapeHtml(e.designation) + '</td>' +
      '<td>' + Utils.escapeHtml(e.department) + '</td>' +
      '<td class="cell-secondary">' + Utils.escapeHtml(e.manager || '—') + '</td>' +
      '<td class="cell-secondary">' + Utils.escapeHtml(e.phone) + '</td>' +
      '<td>' + this.statusBadge(e.status) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      this.rowActionBtn('view', e.id, 'View', '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/>') +
      this.rowActionBtn('edit', e.id, 'Edit', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>') +
      this.rowActionBtn('delete', e.id, 'Delete', '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', true) +
      '</div></td>' +
      '</tr>'
    );
  },

  rowActionBtn(action, id, title, iconPath, danger) {
    return '<button class="row-action-btn' + (danger ? ' danger' : '') + '" data-action="' + action + '" data-id="' +
      Utils.escapeHtml(id) + '" title="' + title + '" aria-label="' + title + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' + iconPath + '</svg></button>';
  },

  bindRowActions() {
    document.querySelectorAll('#employeeTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const employee = this.getAll().find(e => e.id === id);
        if (!employee) return;
        if (action === 'view') this.openView(employee);
        if (action === 'edit') this.openForm(employee);
        if (action === 'delete') this.handleDelete(id);
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('employeePagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.render();
      });
    });
  }
};

/* ---------------------------------------------------------------
   19. PHASE 10 — ATTENDANCE MANAGEMENT
--------------------------------------------------------------- */
const AttendanceModule = {
  state: {
    activeTab: 'daily',
    dailyDate: Utils.todayStr(),
    calendarEmployeeId: '',
    calendarMonth: Utils.todayStr().slice(0, 7),
    summaryMonth: Utils.todayStr().slice(0, 7),
    editingEmployeeId: null,
    editingDate: null
  },

  STATUS_OPTIONS: ['Present', 'Late Entry', 'Half Day', 'Absent', 'Holiday', 'Weekend'],

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.attendance, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.attendance, list);
  },

  /* ---------- weekend / holiday / overtime helpers ---------- */
  isWeekend(date) {
    const day = new Date(date + 'T00:00:00').getDay();
    return day === 0 || day === 6;
  },
  isHoliday(date) {
    return COMPANY_HOLIDAYS_MMDD.includes(date.slice(5));
  },
  getRecord(employeeId, date) {
    return this.getAll().find(a => a.employeeId === employeeId && a.date === date);
  },
  getEffectiveStatus(employeeId, date) {
    const record = this.getRecord(employeeId, date);
    if (record) return record.status;
    if (this.isWeekend(date)) return 'Weekend';
    if (this.isHoliday(date)) return 'Holiday';
    return null; // not yet marked
  },
  computeOvertime(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const toHours = (t) => { const [h, m] = t.split(':').map(Number); return h + m / 60; };
    const diff = toHours(checkOut) - toHours(checkIn);
    return Math.max(0, Math.round((diff - STANDARD_WORK_HOURS) * 10) / 10);
  },

  upsertRecord(employeeId, employeeName, date, status, checkIn, checkOut) {
    const list = this.getAll();
    const idx = list.findIndex(a => a.employeeId === employeeId && a.date === date);
    const overtimeHours = (status === 'Present' || status === 'Late Entry') ? this.computeOvertime(checkIn, checkOut) : 0;
    const now = Date.now();
    if (idx > -1) {
      list[idx].status = status;
      list[idx].checkIn = checkIn || '';
      list[idx].checkOut = checkOut || '';
      list[idx].overtimeHours = overtimeHours;
      list[idx].updatedAt = now;
    } else {
      list.push({
        id: employeeId + '_' + date,
        employeeId, employeeName, date, status,
        checkIn: checkIn || '', checkOut: checkOut || '', overtimeHours,
        createdAt: now, updatedAt: now
      });
    }
    this.saveAll(list);
  },

  /* ---------- init ---------- */
  init() {
    document.getElementById('dailyDateInput').value = this.state.dailyDate;
    document.getElementById('calendarMonthInput').value = this.state.calendarMonth;
    document.getElementById('summaryMonthInput').value = this.state.summaryMonth;

    document.querySelectorAll('#attendanceTabs .local-tab').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.getAttribute('data-tab')));
    });

    document.getElementById('dailyDateInput').addEventListener('change', (e) => {
      this.state.dailyDate = e.target.value || Utils.todayStr();
      this.renderDailyTab();
    });
    document.getElementById('markAllPresentBtn').addEventListener('click', () => this.markAllPresent());

    document.getElementById('calendarEmployeeSelect').addEventListener('change', (e) => {
      this.state.calendarEmployeeId = e.target.value;
      this.renderCalendarTab();
    });
    document.getElementById('calendarMonthInput').addEventListener('change', (e) => {
      this.state.calendarMonth = e.target.value || this.state.calendarMonth;
      this.renderCalendarTab();
    });
    document.getElementById('summaryMonthInput').addEventListener('change', (e) => {
      this.state.summaryMonth = e.target.value || this.state.summaryMonth;
      this.renderSummaryTab();
    });

    this.bindModal();
  },

  switchTab(tab) {
    this.state.activeTab = tab;
    document.querySelectorAll('#attendanceTabs .local-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.attendance-tab-panel').forEach(panel => { panel.hidden = true; });
    document.getElementById('tab-' + tab).hidden = false;
    if (tab === 'daily') this.renderDailyTab();
    if (tab === 'calendar') this.renderCalendarTab();
    if (tab === 'summary') this.renderSummaryTab();
  },

  bindModal() {
    document.getElementById('attendanceModalCloseBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('attendanceCancelBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('attendanceModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'attendanceModalOverlay') this.closeForm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('attendanceModalOverlay').hidden) this.closeForm();
    });
    ['a_checkIn', 'a_checkOut'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.recalcOvertimePreview());
    });
    document.getElementById('a_status').addEventListener('change', () => this.recalcOvertimePreview());
    document.getElementById('attendanceForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });
  },

  recalcOvertimePreview() {
    const status = document.getElementById('a_status').value;
    const checkIn = document.getElementById('a_checkIn').value;
    const checkOut = document.getElementById('a_checkOut').value;
    const ot = (status === 'Present' || status === 'Late Entry') ? this.computeOvertime(checkIn, checkOut) : 0;
    document.getElementById('a_overtime').value = ot + ' hrs';
  },

  openEditModal(employeeId, date) {
    const employee = EmployeeModule.getAll().find(e => e.id === employeeId);
    if (!employee) return;
    this.state.editingEmployeeId = employeeId;
    this.state.editingDate = date;

    const initials = (employee.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    document.getElementById('attendanceAvatarInitials').textContent = initials;
    document.getElementById('attendanceEmployeeName').textContent = employee.name;
    document.getElementById('attendanceEmployeeMeta').textContent = employee.id + ' · ' + Utils.formatDate(date);
    document.getElementById('attendanceModalTitle').textContent = 'Mark Attendance — ' + Utils.formatDate(date);

    const record = this.getRecord(employeeId, date);
    const effectiveStatus = this.getEffectiveStatus(employeeId, date) || 'Present';
    document.getElementById('a_status').value = effectiveStatus;
    document.getElementById('a_checkIn').value = record ? record.checkIn : (effectiveStatus === 'Present' ? STANDARD_CHECK_IN : '');
    document.getElementById('a_checkOut').value = record ? record.checkOut : (effectiveStatus === 'Present' ? STANDARD_CHECK_OUT : '');
    this.recalcOvertimePreview();

    document.getElementById('attendanceModalOverlay').hidden = false;
  },

  closeForm() {
    document.getElementById('attendanceModalOverlay').hidden = true;
  },

  handleSave() {
    const status = document.getElementById('a_status').value;
    const checkIn = document.getElementById('a_checkIn').value;
    const checkOut = document.getElementById('a_checkOut').value;
    const employee = EmployeeModule.getAll().find(e => e.id === this.state.editingEmployeeId);
    if (!employee) return;

    this.upsertRecord(employee.id, employee.name, this.state.editingDate, status, checkIn, checkOut);
    Activity.log('Attendance for ' + employee.name + ' on ' + Utils.formatDate(this.state.editingDate) + ' marked ' + status);
    Toast.show('Attendance saved for ' + employee.name + '.', 'success');
    this.closeForm();
    this.render();
  },

  markAllPresent() {
    const employees = EmployeeModule.getAll().filter(e => e.status === 'Active');
    employees.forEach(e => {
      this.upsertRecord(e.id, e.name, this.state.dailyDate, 'Present', STANDARD_CHECK_IN, STANDARD_CHECK_OUT);
    });
    Activity.log('Marked all ' + employees.length + ' active employees Present for ' + Utils.formatDate(this.state.dailyDate));
    Toast.show('Marked ' + employees.length + ' employee(s) Present for ' + Utils.formatDate(this.state.dailyDate) + '.', 'success');
    this.render();
  },

  /* ---------- rendering ---------- */
  statusBadgeClass(status) {
    const map = {
      'Present': 'badge-success', 'Late Entry': 'badge-warning', 'Half Day': 'badge-info',
      'Absent': 'badge-danger', 'Holiday': 'badge-neutral', 'Weekend': 'badge-neutral'
    };
    return map[status] || 'badge-neutral';
  },
  statusBadge(status) {
    if (!status) return '<span class="badge badge-neutral">Not Marked</span>';
    return '<span class="badge ' + this.statusBadgeClass(status) + '">' + Utils.escapeHtml(status) + '</span>';
  },

  render() {
    const employees = EmployeeModule.getAll();
    const hasAny = employees.length > 0;
    document.getElementById('attendanceNoEmployeeGuard').hidden = hasAny;
    document.getElementById('attendanceMainArea').style.display = hasAny ? '' : 'none';
    if (!hasAny) return;

    this.renderDashboardStrip();
    this.populateEmployeeSelect();
    if (this.state.activeTab === 'daily') this.renderDailyTab();
    if (this.state.activeTab === 'calendar') this.renderCalendarTab();
    if (this.state.activeTab === 'summary') this.renderSummaryTab();
  },

  populateEmployeeSelect() {
    const select = document.getElementById('calendarEmployeeSelect');
    const current = this.state.calendarEmployeeId;
    const employees = EmployeeModule.getAll().filter(e => e.status === 'Active');
    select.innerHTML = employees.map(e => '<option value="' + Utils.escapeHtml(e.id) + '">' + Utils.escapeHtml(e.name) + '</option>').join('');
    if (employees.length) {
      const stillValid = employees.some(e => e.id === current);
      select.value = stillValid ? current : employees[0].id;
      this.state.calendarEmployeeId = select.value;
    }
  },

  renderDashboardStrip() {
    const employees = EmployeeModule.getAll().filter(e => e.status === 'Active');
    const today = Utils.todayStr();
    let presentToday = 0, absentToday = 0, lateToday = 0;
    employees.forEach(e => {
      const status = this.getEffectiveStatus(e.id, today);
      if (status === 'Present') presentToday++;
      else if (status === 'Late Entry') lateToday++;
      else if (status === 'Absent') absentToday++;
    });

    // average attendance % this month across active employees
    const monthDays = this.getElapsedWorkingDays(today.slice(0, 7));
    let avgPercent = 0;
    if (employees.length && monthDays.length) {
      const percents = employees.map(e => this.computeAttendancePercent(e.id, monthDays));
      avgPercent = Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
    }

    const strip = document.getElementById('attendanceStatusStrip');
    strip.innerHTML =
      '<div class="status-chip open"><span class="status-chip-count">' + presentToday + '</span><span class="status-chip-label">Present Today</span></div>' +
      '<div class="status-chip closed"><span class="status-chip-count">' + absentToday + '</span><span class="status-chip-label">Absent Today</span></div>' +
      '<div class="status-chip hold"><span class="status-chip-count">' + lateToday + '</span><span class="status-chip-label">Late Today</span></div>' +
      '<div class="status-chip accepted"><span class="status-chip-count">' + avgPercent + '%</span><span class="status-chip-label">Avg. Attendance (MTD)</span></div>';
  },

  /* ---------- Daily tab ---------- */
  renderDailyTab() {
    document.getElementById('dailyDateInput').value = this.state.dailyDate;
    const employees = EmployeeModule.getAll().filter(e => e.status === 'Active');
    const date = this.state.dailyDate;

    document.getElementById('dailyTableBody').innerHTML = employees.map(e => {
      const record = this.getRecord(e.id, date);
      const status = this.getEffectiveStatus(e.id, date);
      const checkIn = record ? record.checkIn : '';
      const checkOut = record ? record.checkOut : '';
      const overtime = record ? record.overtimeHours : 0;
      return '<tr data-employee-id="' + Utils.escapeHtml(e.id) + '">' +
        '<td class="cell-primary">' + Utils.escapeHtml(e.name) + '</td>' +
        '<td>' + Utils.escapeHtml(e.department) + '</td>' +
        '<td>' + this.statusBadge(status) + '</td>' +
        '<td class="cell-secondary">' + (checkIn || '—') + '</td>' +
        '<td class="cell-secondary">' + (checkOut || '—') + '</td>' +
        '<td class="cell-secondary">' + (overtime ? overtime + ' hrs' : '—') + '</td>' +
        '<td class="col-actions"><div class="row-actions">' +
        '<button class="row-action-btn" data-action="edit-daily" data-employee-id="' + Utils.escapeHtml(e.id) + '" title="Mark attendance" aria-label="Mark attendance">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>' +
        '</div></td></tr>';
    }).join('');

    document.querySelectorAll('#dailyTableBody .row-action-btn[data-action="edit-daily"]').forEach(btn => {
      btn.addEventListener('click', () => this.openEditModal(btn.getAttribute('data-employee-id'), this.state.dailyDate));
    });
  },

  /* ---------- Calendar tab ---------- */
  renderCalendarTab() {
    document.getElementById('calendarMonthInput').value = this.state.calendarMonth;
    const employeeId = this.state.calendarEmployeeId;
    if (!employeeId) { document.getElementById('calendarGrid').innerHTML = ''; return; }

    const legend = document.getElementById('calendarLegend');
    legend.innerHTML = [
      ['status-present', 'Present'], ['status-late', 'Late Entry'], ['status-half', 'Half Day'],
      ['status-absent', 'Absent'], ['status-holiday', 'Holiday'], ['status-weekend', 'Weekend'], ['status-unmarked', 'Not Marked']
    ].map(([cls, label]) => '<span class="calendar-legend-item"><span class="calendar-legend-swatch ' + cls + '"></span>' + label + '</span>').join('');

    const [year, month] = this.state.calendarMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startOffset = firstDay.getDay();

    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      .map(d => '<div class="calendar-weekday-label">' + d + '</div>').join('');

    let cells = '';
    for (let i = 0; i < startOffset; i++) cells += '<div class="calendar-day empty"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = year + '-' + Utils.pad(month, 2) + '-' + Utils.pad(day, 2);
      const status = this.getEffectiveStatus(employeeId, dateStr);
      const statusClass = {
        'Present': 'status-present', 'Late Entry': 'status-late', 'Half Day': 'status-half',
        'Absent': 'status-absent', 'Holiday': 'status-holiday', 'Weekend': 'status-weekend'
      }[status] || 'status-unmarked';
      cells += '<div class="calendar-day ' + statusClass + '" data-date="' + dateStr + '">' +
        '<div class="calendar-day-num">' + day + '</div>' +
        '<div class="calendar-day-status">' + (status || 'Not Marked') + '</div></div>';
    }

    document.getElementById('calendarGrid').innerHTML = weekdayLabels + cells;
    document.querySelectorAll('.calendar-day[data-date]').forEach(cell => {
      cell.addEventListener('click', () => this.openEditModal(employeeId, cell.getAttribute('data-date')));
    });
  },

  /* ---------- Monthly Summary tab ---------- */
  getElapsedWorkingDays(monthStr) {
    const [year, month] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = Utils.todayStr();
    const isCurrentMonth = monthStr === today.slice(0, 7);
    const lastDay = isCurrentMonth ? Number(today.slice(8, 10)) : daysInMonth;
    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = year + '-' + Utils.pad(month, 2) + '-' + Utils.pad(d, 2);
      if (!this.isWeekend(dateStr) && !this.isHoliday(dateStr)) days.push(dateStr);
    }
    return days;
  },

  computeAttendancePercent(employeeId, workingDays) {
    if (!workingDays.length) return 0;
    let presentEquivalent = 0;
    workingDays.forEach(d => {
      const status = this.getEffectiveStatus(employeeId, d);
      if (status === 'Present' || status === 'Late Entry') presentEquivalent += 1;
      else if (status === 'Half Day') presentEquivalent += 0.5;
    });
    return Math.round((presentEquivalent / workingDays.length) * 100);
  },

  renderSummaryTab() {
    document.getElementById('summaryMonthInput').value = this.state.summaryMonth;
    const employees = EmployeeModule.getAll().filter(e => e.status === 'Active');
    const [year, month] = this.state.summaryMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const allDates = [];
    for (let d = 1; d <= daysInMonth; d++) allDates.push(year + '-' + Utils.pad(month, 2) + '-' + Utils.pad(d, 2));
    const workingDays = this.getElapsedWorkingDays(this.state.summaryMonth);

    document.getElementById('summaryTableBody').innerHTML = employees.map(e => {
      let present = 0, late = 0, half = 0, absent = 0, holidays = 0, overtime = 0;
      allDates.forEach(d => {
        const status = this.getEffectiveStatus(e.id, d);
        const record = this.getRecord(e.id, d);
        if (record) overtime += record.overtimeHours || 0;
        if (status === 'Present') present++;
        else if (status === 'Late Entry') late++;
        else if (status === 'Half Day') half++;
        else if (status === 'Absent') absent++;
        else if (status === 'Holiday' || status === 'Weekend') holidays++;
      });
      const percent = this.computeAttendancePercent(e.id, workingDays);
      const percentCls = percent >= 90 ? 'badge-success' : percent >= 75 ? 'badge-warning' : 'badge-danger';
      return '<tr><td class="cell-primary">' + Utils.escapeHtml(e.name) + '</td>' +
        '<td>' + present + '</td><td>' + late + '</td><td>' + half + '</td><td>' + absent + '</td><td>' + holidays + '</td>' +
        '<td>' + (Math.round(overtime * 10) / 10) + '</td>' +
        '<td><span class="badge ' + percentCls + '">' + percent + '%</span></td></tr>';
    }).join('');
  }
};

/* ---------------------------------------------------------------
   20. PHASE 11 — LEAVE MANAGEMENT
--------------------------------------------------------------- */
const LeaveModule = {
  state: {
    activeTab: 'history',
    search: '',
    type: '',
    status: '',
    sortKey: 'startDate',
    sortDir: 'desc',
    page: 1,
    pageSize: 8,
    editingId: null,
    calendarEmployeeId: '',
    calendarMonth: Utils.todayStr().slice(0, 7)
  },

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.leaves, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.leaves, list);
  },
  nextId() {
    const counter = Storage.get(STORAGE_KEYS.leaveCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.leaveCounter, counter);
    const year = new Date().getFullYear();
    return 'LV-' + year + '-' + Utils.pad(counter, 4);
  },

  /* ---------- balances ---------- */
  getAllocation(employee, leaveType) {
    if (leaveType === 'Loss of Pay') return Infinity;
    if (FIXED_LEAVE_ALLOCATIONS[leaveType] !== undefined) return FIXED_LEAVE_ALLOCATIONS[leaveType];
    const policy = LEAVE_ALLOCATIONS[employee.leavePolicy];
    return policy ? (policy[leaveType] !== undefined ? policy[leaveType] : 0) : 0;
  },

  getUsedOrPending(employeeId, leaveType, excludeId) {
    return this.getAll()
      .filter(l => l.employeeId === employeeId && l.leaveType === leaveType && l.id !== excludeId &&
        (l.status === 'Approved' || l.status === 'Pending Manager Approval' || l.status === 'Pending HR Approval'))
      .reduce((sum, l) => sum + l.days, 0);
  },

  getBalance(employee, leaveType, excludeId) {
    const allocation = this.getAllocation(employee, leaveType);
    if (allocation === Infinity) return Infinity;
    const used = this.getUsedOrPending(employee.id, leaveType, excludeId);
    return Math.max(0, allocation - used);
  },

  computeDays(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diff = Math.round((end - start) / 86400000) + 1;
    return diff > 0 ? diff : 0;
  },

  /* ---------- init ---------- */
  init() {
    document.getElementById('lv_leaveType').insertAdjacentHTML('beforeend',
      LEAVE_TYPES.map(t => '<option>' + Utils.escapeHtml(t) + '</option>').join(''));
    document.getElementById('filterLeaveType').insertAdjacentHTML('beforeend',
      LEAVE_TYPES.map(t => '<option>' + Utils.escapeHtml(t) + '</option>').join(''));
    document.getElementById('leaveCalendarMonthInput').value = this.state.calendarMonth;

    document.querySelectorAll('#leaveTabs .local-tab').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.getAttribute('data-tab')));
    });

    this.bindToolbar();
    this.bindApplyForm();
    this.bindModals();

    document.getElementById('leaveCalendarEmployeeSelect').addEventListener('change', (e) => {
      this.state.calendarEmployeeId = e.target.value;
      this.renderCalendarTab();
    });
    document.getElementById('leaveCalendarMonthInput').addEventListener('change', (e) => {
      this.state.calendarMonth = e.target.value || this.state.calendarMonth;
      this.renderCalendarTab();
    });
  },

  switchTab(tab) {
    this.state.activeTab = tab;
    document.querySelectorAll('#leaveTabs .local-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.leave-tab-panel').forEach(panel => { panel.hidden = true; });
    document.getElementById('leavetab-' + tab).hidden = false;
    if (tab === 'history') this.renderHistoryTab();
    if (tab === 'balance') this.renderBalanceTab();
    if (tab === 'calendar') this.renderCalendarTab();
  },

  bindToolbar() {
    document.getElementById('applyLeaveBtn').addEventListener('click', () => this.openApplyForm());
    const searchInput = document.getElementById('leaveSearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.renderHistoryTab();
    }, 200));
    document.getElementById('filterLeaveType').addEventListener('change', (e) => {
      this.state.type = e.target.value;
      this.state.page = 1;
      this.renderHistoryTab();
    });
    document.getElementById('filterLeaveStatus').addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.renderHistoryTab();
    });
    document.getElementById('clearLeaveFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.type = ''; this.state.status = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterLeaveType').value = '';
      document.getElementById('filterLeaveStatus').value = '';
      this.renderHistoryTab();
    });
    document.querySelectorAll('#leaveTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'asc';
        }
        this.renderHistoryTab();
      });
    });
  },

  bindModals() {
    document.getElementById('leaveModalCloseBtn').addEventListener('click', () => this.closeApplyForm());
    document.getElementById('leaveCancelBtn').addEventListener('click', () => this.closeApplyForm());
    document.getElementById('leaveModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'leaveModalOverlay') this.closeApplyForm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('leaveModalOverlay').hidden) this.closeApplyForm();
    });
  },

  bindApplyForm() {
    ['lv_employeeId', 'lv_leaveType', 'lv_startDate', 'lv_endDate'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this.recalcApplyPreview());
    });
    document.getElementById('leaveForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleApplySave();
    });
  },

  recalcApplyPreview() {
    const employeeId = document.getElementById('lv_employeeId').value;
    const leaveType = document.getElementById('lv_leaveType').value;
    const startDate = document.getElementById('lv_startDate').value;
    const endDate = document.getElementById('lv_endDate').value;
    const days = this.computeDays(startDate, endDate);
    document.getElementById('lv_daysPreview').value = days ? days + ' day' + (days === 1 ? '' : 's') : '—';

    const employee = EmployeeModule.getAll().find(e => e.id === employeeId);
    if (employee && leaveType) {
      const balance = this.getBalance(employee, leaveType);
      document.getElementById('lv_balancePreview').value = balance === Infinity ? 'Unlimited' : balance + ' day' + (balance === 1 ? '' : 's');
    } else {
      document.getElementById('lv_balancePreview').value = '—';
    }
  },

  /* ---------- apply form ---------- */
  openApplyForm(lockedEmployeeId) {
    const form = document.getElementById('leaveForm');
    form.reset();
    this.clearErrors();
    this.state.editingId = null;

    const select = document.getElementById('lv_employeeId');
    const employees = EmployeeModule.getAll().filter(e => e.status === 'Active');
    if (lockedEmployeeId) {
      const only = employees.filter(e => e.id === lockedEmployeeId);
      select.innerHTML = only.map(e => '<option value="' + Utils.escapeHtml(e.id) + '">' + Utils.escapeHtml(e.name) + '</option>').join('');
      select.value = lockedEmployeeId;
      select.disabled = true;
    } else {
      select.innerHTML = '<option value="">Select employee</option>' +
        employees.map(e => '<option value="' + Utils.escapeHtml(e.id) + '">' + Utils.escapeHtml(e.name) + '</option>').join('');
      select.disabled = false;
    }

    document.getElementById('lv_daysPreview').value = '—';
    document.getElementById('lv_balancePreview').value = '—';
    document.getElementById('leaveModalTitle').textContent = 'Apply Leave';
    document.getElementById('leaveModalOverlay').hidden = false;
    this.recalcApplyPreview();
  },

  closeApplyForm() {
    document.getElementById('leaveModalOverlay').hidden = true;
  },

  clearErrors() {
    ['lv_employeeId', 'lv_leaveType', 'lv_startDate', 'lv_endDate', 'lv_reason'].forEach(id => {
      const errEl = document.getElementById('err_' + id);
      if (errEl) errEl.textContent = '';
      const field = document.getElementById(id);
      if (field) field.classList.remove('invalid');
    });
  },

  setError(fieldId, message) {
    document.getElementById('err_' + fieldId).textContent = message;
    document.getElementById(fieldId).classList.add('invalid');
  },

  validateApply() {
    this.clearErrors();
    let valid = true;
    const employeeId = document.getElementById('lv_employeeId').value;
    const leaveType = document.getElementById('lv_leaveType').value;
    const startDate = document.getElementById('lv_startDate').value;
    const endDate = document.getElementById('lv_endDate').value;
    const reason = document.getElementById('lv_reason').value.trim();

    if (!employeeId) { this.setError('lv_employeeId', 'Select an employee.'); valid = false; }
    if (!leaveType) { this.setError('lv_leaveType', 'Select a leave type.'); valid = false; }
    if (!startDate) { this.setError('lv_startDate', 'Start date is required.'); valid = false; }
    if (!endDate) { this.setError('lv_endDate', 'End date is required.'); valid = false; }
    if (startDate && endDate && endDate < startDate) {
      this.setError('lv_endDate', 'End date cannot be before the start date.'); valid = false;
    }
    if (!reason) { this.setError('lv_reason', 'Enter a reason for the leave.'); valid = false; }

    if (valid && employeeId && leaveType) {
      const employee = EmployeeModule.getAll().find(e => e.id === employeeId);
      const days = this.computeDays(startDate, endDate);
      const balance = this.getBalance(employee, leaveType);
      if (balance !== Infinity && days > balance) {
        this.setError('lv_endDate', 'Only ' + balance + ' day(s) of ' + leaveType + ' leave remaining.');
        valid = false;
      }
    }
    return valid;
  },

  handleApplySave() {
    if (!this.validateApply()) {
      Toast.show('Please fix the highlighted fields.', 'error');
      return;
    }
    const employeeId = document.getElementById('lv_employeeId').value;
    const employee = EmployeeModule.getAll().find(e => e.id === employeeId);
    const leaveType = document.getElementById('lv_leaveType').value;
    const startDate = document.getElementById('lv_startDate').value;
    const endDate = document.getElementById('lv_endDate').value;
    const reason = document.getElementById('lv_reason').value.trim();
    const days = this.computeDays(startDate, endDate);
    const now = Date.now();

    const list = this.getAll();
    list.unshift({
      id: this.nextId(),
      employeeId: employee.id,
      employeeName: employee.name,
      department: employee.department,
      leaveType, startDate, endDate, days, reason,
      status: 'Pending Manager Approval',
      appliedDate: Utils.todayStr(),
      createdAt: now, updatedAt: now
    });
    this.saveAll(list);
    Activity.log(employee.name + ' applied for ' + days + ' day(s) of ' + leaveType + ' leave');
    Toast.show('Leave application submitted for ' + employee.name + '.', 'success');
    this.closeApplyForm();
    this.render();
  },

  async handleDelete(id) {
    const list = this.getAll();
    const leave = list.find(l => l.id === id);
    if (!leave) return;
    const confirmed = await Confirm.ask(
      'Delete this leave application?',
      leave.id + ' — ' + leave.employeeName + '\u2019s ' + leave.leaveType + ' leave application will be permanently removed.',
      'Delete'
    );
    if (!confirmed) return;
    this.saveAll(list.filter(l => l.id !== id));
    Activity.log('Leave application ' + leave.id + ' (' + leave.employeeName + ') deleted');
    Toast.show('Leave application deleted.', 'success');
    this.render();
  },

  changeStatus(id, status) {
    const list = this.getAll();
    const idx = list.findIndex(l => l.id === id);
    if (idx === -1) return;
    list[idx].status = status;
    list[idx].updatedAt = Date.now();
    this.saveAll(list);
    Activity.log(list[idx].employeeName + '\u2019s leave ' + list[idx].id + ' marked ' + status);
    AuditLog.log('Leave', status, list[idx].employeeName + ' (' + list[idx].id + ')', list[idx].leaveType + ', ' + list[idx].days + ' day(s)');
    Toast.show(list[idx].employeeName + '\u2019s leave marked ' + status + '.', 'success');
    this.render();
  },

  openView(leave) {
    document.getElementById('viewModalTitle').textContent = leave.employeeName + ' — ' + leave.id;
    document.getElementById('viewModalBody').innerHTML =
      '<div class="detail-grid">' +
      VacancyModule.detailItem('Leave ID', leave.id) +
      VacancyModule.detailItem('Status', this.statusBadge(leave.status)) +
      VacancyModule.detailItem('Employee', leave.employeeName) +
      VacancyModule.detailItem('Department', leave.department) +
      VacancyModule.detailItem('Leave Type', leave.leaveType) +
      VacancyModule.detailItem('Days', String(leave.days)) +
      VacancyModule.detailItem('From', Utils.formatDate(leave.startDate)) +
      VacancyModule.detailItem('To', Utils.formatDate(leave.endDate)) +
      VacancyModule.detailItem('Applied On', Utils.formatDate(leave.appliedDate)) +
      '<div class="detail-item detail-full"><span class="detail-label">Reason</span><div class="detail-value">' + Utils.escapeHtml(leave.reason) + '</div></div>' +
      '</div>';
    document.getElementById('viewModalOverlay').hidden = false;
  },

  /* ---------- rendering ---------- */
  statusBadge(status) {
    const map = {
      'Pending Manager Approval': 'badge-warning', 'Pending HR Approval': 'badge-info',
      'Approved': 'badge-success', 'Rejected': 'badge-danger'
    };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + Utils.escapeHtml(status) + '</span>';
  },

  render() {
    const employees = EmployeeModule.getAll();
    const hasAny = employees.length > 0;
    document.getElementById('leaveNoEmployeeGuard').hidden = hasAny;
    document.getElementById('leaveMainArea').style.display = hasAny ? '' : 'none';
    if (!hasAny) return;

    this.renderDashboardStrip();
    this.populateCalendarEmployeeSelect();
    if (this.state.activeTab === 'history') this.renderHistoryTab();
    if (this.state.activeTab === 'balance') this.renderBalanceTab();
    if (this.state.activeTab === 'calendar') this.renderCalendarTab();
  },

  renderDashboardStrip() {
    const all = this.getAll();
    const counts = { 'Pending Manager Approval': 0, 'Pending HR Approval': 0, Approved: 0, Rejected: 0 };
    all.forEach(l => { if (counts[l.status] !== undefined) counts[l.status]++; });
    const employees = EmployeeModule.getAll().filter(e => e.status === 'Active');
    const today = Utils.todayStr();
    const onLeaveToday = employees.filter(e =>
      all.some(l => l.employeeId === e.id && l.status === 'Approved' && l.startDate <= today && l.endDate >= today)
    ).length;

    const strip = document.getElementById('leaveStatusStrip');
    strip.innerHTML =
      '<div class="status-chip hold"><span class="status-chip-count">' + (counts['Pending Manager Approval'] + counts['Pending HR Approval']) + '</span><span class="status-chip-label">Pending Approval</span></div>' +
      '<div class="status-chip accepted"><span class="status-chip-count">' + counts.Approved + '</span><span class="status-chip-label">Approved</span></div>' +
      '<div class="status-chip closed"><span class="status-chip-count">' + counts.Rejected + '</span><span class="status-chip-label">Rejected</span></div>' +
      '<div class="status-chip open"><span class="status-chip-count">' + onLeaveToday + '</span><span class="status-chip-label">On Leave Today</span></div>';
  },

  getFilteredSorted() {
    let list = this.getAll();
    const { search, type, status, sortKey, sortDir } = this.state;
    if (search) list = list.filter(l => (l.employeeName || '').toLowerCase().includes(search) || (l.id || '').toLowerCase().includes(search));
    if (type) list = list.filter(l => l.leaveType === type);
    if (status) list = list.filter(l => l.status === status);
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === undefined) av = '';
      if (bv === undefined) bv = '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  renderHistoryTab() {
    document.getElementById('leaveSearch').value = this.state.search;
    document.getElementById('filterLeaveType').value = this.state.type;
    document.getElementById('filterLeaveStatus').value = this.state.status;

    const filtered = this.getFilteredSorted();
    const all = this.getAll();
    document.getElementById('leaveEmptyState').hidden = all.length !== 0;
    document.getElementById('leaveTable').style.display = all.length === 0 ? 'none' : '';

    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('leaveTableBody').innerHTML = pageItems.map(l => this.rowHtml(l)).join('');

    document.querySelectorAll('#leaveTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort') ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('leaveTableCount').textContent =
      filtered.length === 0 ? 'No leave applications match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  rowHtml(l) {
    return '<tr data-id="' + Utils.escapeHtml(l.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(l.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(l.employeeName) + '</td>' +
      '<td>' + Utils.escapeHtml(l.leaveType) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatDate(l.startDate) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatDate(l.endDate) + '</td>' +
      '<td>' + l.days + '</td>' +
      '<td>' + this.statusBadge(l.status) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      '<button class="row-action-btn" data-action="view" data-id="' + Utils.escapeHtml(l.id) + '" title="View" aria-label="View"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/></svg></button>' +
      '<button class="row-action-btn danger" data-action="delete" data-id="' + Utils.escapeHtml(l.id) + '" title="Delete" aria-label="Delete"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<button class="row-action-btn" data-action="more" data-id="' + Utils.escapeHtml(l.id) + '" title="More actions" aria-label="More actions"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/></svg></button>' +
      '</div></td></tr>';
  },

  bindRowActions() {
    document.querySelectorAll('#leaveTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const leave = this.getAll().find(l => l.id === id);
        if (!leave) return;
        if (action === 'view') this.openView(leave);
        if (action === 'delete') this.handleDelete(id);
        if (action === 'more') {
          e.stopPropagation();
          const items = [];
          if (leave.status === 'Pending Manager Approval') {
            items.push({ label: 'Manager Approve', onClick: () => this.changeStatus(id, 'Pending HR Approval') });
            items.push({ label: 'Manager Reject', danger: true, onClick: () => this.changeStatus(id, 'Rejected') });
          } else if (leave.status === 'Pending HR Approval') {
            items.push({ label: 'HR Approve', onClick: () => this.changeStatus(id, 'Approved') });
            items.push({ label: 'HR Reject', danger: true, onClick: () => this.changeStatus(id, 'Rejected') });
          } else {
            items.push({ label: 'Reset to Pending (Manager)', onClick: () => this.changeStatus(id, 'Pending Manager Approval') });
          }
          RowMenu.open(btn, items);
        }
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('leavePagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.renderHistoryTab();
      });
    });
  },

  /* ---------- Balance tab ---------- */
  renderBalanceTab() {
    const employees = EmployeeModule.getAll().filter(e => e.status === 'Active');
    document.getElementById('balanceTableBody').innerHTML = employees.map(e => {
      const fmt = (v) => v === Infinity ? 'Unlimited' : v;
      return '<tr><td class="cell-primary">' + Utils.escapeHtml(e.name) + '</td>' +
        '<td class="cell-secondary">' + Utils.escapeHtml(e.leavePolicy || '—') + '</td>' +
        '<td>' + fmt(this.getBalance(e, 'Casual')) + '</td>' +
        '<td>' + fmt(this.getBalance(e, 'Sick')) + '</td>' +
        '<td>' + fmt(this.getBalance(e, 'Earned')) + '</td>' +
        '<td>' + fmt(this.getBalance(e, 'Maternity')) + '</td>' +
        '<td>' + fmt(this.getBalance(e, 'Paternity')) + '</td></tr>';
    }).join('');
  },

  /* ---------- Calendar tab ---------- */
  populateCalendarEmployeeSelect() {
    const select = document.getElementById('leaveCalendarEmployeeSelect');
    const current = this.state.calendarEmployeeId;
    const employees = EmployeeModule.getAll().filter(e => e.status === 'Active');
    select.innerHTML = employees.map(e => '<option value="' + Utils.escapeHtml(e.id) + '">' + Utils.escapeHtml(e.name) + '</option>').join('');
    if (employees.length) {
      const stillValid = employees.some(e => e.id === current);
      select.value = stillValid ? current : employees[0].id;
      this.state.calendarEmployeeId = select.value;
    }
  },

  leaveTypeOnDate(employeeId, date) {
    const leave = this.getAll().find(l => l.employeeId === employeeId && l.status === 'Approved' && l.startDate <= date && l.endDate >= date);
    return leave ? leave.leaveType : null;
  },

  renderCalendarTab() {
    document.getElementById('leaveCalendarMonthInput').value = this.state.calendarMonth;
    const employeeId = this.state.calendarEmployeeId;
    if (!employeeId) { document.getElementById('leaveCalendarGrid').innerHTML = ''; return; }

    const legend = document.getElementById('leaveCalendarLegend');
    legend.innerHTML = [
      ['status-casual', 'Casual'], ['status-sick', 'Sick'], ['status-earned', 'Earned'],
      ['status-maternity', 'Maternity / Paternity'], ['status-lop', 'Loss of Pay']
    ].map(([cls, label]) => '<span class="calendar-legend-item"><span class="calendar-legend-swatch ' + cls + '"></span>' + label + '</span>').join('');

    const [year, month] = this.state.calendarMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startOffset = firstDay.getDay();
    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      .map(d => '<div class="calendar-weekday-label">' + d + '</div>').join('');

    const typeClass = { Casual: 'status-casual', Sick: 'status-sick', Earned: 'status-earned', Maternity: 'status-maternity', Paternity: 'status-maternity', 'Loss of Pay': 'status-lop' };

    let cells = '';
    for (let i = 0; i < startOffset; i++) cells += '<div class="calendar-day empty"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = year + '-' + Utils.pad(month, 2) + '-' + Utils.pad(day, 2);
      const leaveType = this.leaveTypeOnDate(employeeId, dateStr);
      const cls = leaveType ? typeClass[leaveType] : 'status-unmarked';
      cells += '<div class="calendar-day ' + cls + '"><div class="calendar-day-num">' + day + '</div>' +
        (leaveType ? '<div class="calendar-day-status">' + Utils.escapeHtml(leaveType) + '</div>' : '') + '</div>';
    }
    document.getElementById('leaveCalendarGrid').innerHTML = weekdayLabels + cells;
  }
};

/* ---------------------------------------------------------------
   21. PHASE 12 — PAYROLL PROCESSING (automatic payroll engine)
--------------------------------------------------------------- */
const PayrollModule = {
  state: {
    month: Utils.todayStr().slice(0, 7),
    search: '',
    status: '',
    sortKey: 'employeeName',
    sortDir: 'asc',
    editingId: null,
    page: 1,
    pageSize: 8
  },

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.payroll, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.payroll, list);
  },
  nextId() {
    const counter = Storage.get(STORAGE_KEYS.payrollCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.payrollCounter, counter);
    const year = new Date().getFullYear();
    return 'PAY-' + year + '-' + Utils.pad(counter, 4);
  },

  /* ---------- salary structure & auto-calculations ---------- */
  computeStructure(salary) {
    const basic = Math.round(salary * PAYROLL.BASIC_PCT);
    const hra = Math.round(basic * PAYROLL.HRA_PCT_OF_BASIC);
    const da = Math.round(basic * PAYROLL.DA_PCT_OF_BASIC);
    const medical = PAYROLL.MEDICAL_FIXED;
    const travel = PAYROLL.TRAVEL_FIXED;
    const specialAllowance = Math.max(0, salary - (basic + hra + da + medical + travel));
    return { basic, hra, da, medical, travel, specialAllowance };
  },

  computeOvertimeAmount(employeeId, month, basic, da) {
    const [year, mo] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mo, 0).getDate();
    let totalHours = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = year + '-' + Utils.pad(mo, 2) + '-' + Utils.pad(d, 2);
      const record = AttendanceModule.getRecord(employeeId, dateStr);
      if (record) totalHours += record.overtimeHours || 0;
    }
    const hourlyRate = (basic + da) / PAYROLL.OT_MONTHLY_HOURS;
    return Math.round(totalHours * hourlyRate * PAYROLL.OT_MULTIPLIER);
  },

  computeLeaveDeduction(employeeId, month, fixedGross) {
    const [year, mo] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mo, 0).getDate();
    const monthStart = month + '-01';
    const monthEnd = month + '-' + Utils.pad(daysInMonth, 2);
    const lopDays = LeaveModule.getAll()
      .filter(l => l.employeeId === employeeId && l.leaveType === 'Loss of Pay' && l.status === 'Approved' &&
        l.startDate <= monthEnd && l.endDate >= monthStart)
      .reduce((sum, l) => {
        const overlapStart = l.startDate > monthStart ? l.startDate : monthStart;
        const overlapEnd = l.endDate < monthEnd ? l.endDate : monthEnd;
        return sum + LeaveModule.computeDays(overlapStart, overlapEnd);
      }, 0);
    const perDayRate = fixedGross / 30;
    return { lopDays, amount: Math.round(lopDays * perDayRate) };
  },

  computeLatePenalty(employeeId, month) {
    const [year, mo] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mo, 0).getDate();
    let lateDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = year + '-' + Utils.pad(mo, 2) + '-' + Utils.pad(d, 2);
      if (AttendanceModule.getEffectiveStatus(employeeId, dateStr) === 'Late Entry') lateDays++;
    }
    return Math.max(0, lateDays - PAYROLL.LATE_GRACE_DAYS) * PAYROLL.LATE_PENALTY_PER_DAY;
  },

  computePF(basic) {
    return Math.min(Math.round(basic * PAYROLL.PF_RATE), PAYROLL.PF_CAP);
  },
  computeESI(grossSalary) {
    return grossSalary <= PAYROLL.ESI_GROSS_THRESHOLD ? Math.round(grossSalary * PAYROLL.ESI_RATE) : 0;
  },
  computeProfessionalTax(grossSalary, employee, month) {
    return TaxEngine.computeProfessionalTax(grossSalary, employee ? employee.state : '', month);
  },
  // Returns the full annual tax breakdown (not just a number) so callers can
  // surface taxable income, HRA exemption, 80C, rebate, surcharge & cess —
  // used by the payslip, the payroll edit drawer and Form 16.
  computeIncomeTax(structure, grossSalary, employee, professionalTaxMonthly) {
    const isMetro = HRA_METRO_CITIES.includes(employee ? employee.city : '');
    return TaxEngine.computeMonthlyTDS({
      grossAnnual: grossSalary * 12,
      basicAnnual: structure.basic * 12,
      daAnnual: structure.da * 12,
      hraReceivedAnnual: structure.hra * 12,
      rentPaidAnnual: ((employee && employee.rentPaidMonthly) || 0) * 12,
      isMetro,
      declared80CAnnual: (employee && employee.declared80CAnnual) || 0,
      regime: (employee && employee.taxRegime) || 'new',
      professionalTaxAnnual: (professionalTaxMonthly || 0) * 12
    });
  },

  generatePayrollRecord(employee, month) {
    const structure = this.computeStructure(employee.salary);
    const overtime = this.computeOvertimeAmount(employee.id, month, structure.basic, structure.da);
    const fixedGross = structure.basic + structure.hra + structure.da + structure.medical + structure.travel + structure.specialAllowance;
    const bonus = 0, incentives = 0, advance = 0, loanEmi = 0;
    const grossSalary = fixedGross + bonus + overtime + incentives;

    const pf = this.computePF(structure.basic);
    const esi = this.computeESI(grossSalary);
    const professionalTax = this.computeProfessionalTax(grossSalary, employee, month);
    const taxCalc = this.computeIncomeTax(structure, grossSalary, employee, professionalTax);
    const incomeTax = taxCalc.monthlyTDS;
    const leaveInfo = this.computeLeaveDeduction(employee.id, month, fixedGross);
    const latePenalty = this.computeLatePenalty(employee.id, month);
    const totalDeductions = pf + esi + professionalTax + incomeTax + leaveInfo.amount + latePenalty + advance + loanEmi;
    const now = Date.now();

    return {
      id: this.nextId(),
      employeeId: employee.id, employeeName: employee.name,
      department: employee.department, designation: employee.designation,
      month,
      basic: structure.basic, hra: structure.hra, da: structure.da,
      specialAllowance: structure.specialAllowance, medical: structure.medical, travel: structure.travel,
      bonus, overtime, incentives, grossSalary,
      pf, esi, professionalTax, incomeTax,
      taxRegime: (employee && employee.taxRegime) || 'new',
      taxableIncomeAnnual: taxCalc.taxableIncome,
      hraExemptionAnnual: taxCalc.hraExemption,
      deduction80CAnnual: taxCalc.deduction80C,
      rebate87A: taxCalc.rebate, surcharge: taxCalc.surcharge, cess: taxCalc.cess,
      leaveDeduction: leaveInfo.amount, lopDays: leaveInfo.lopDays,
      latePenalty, advance, loanEmi, totalDeductions,
      netSalary: grossSalary - totalDeductions,
      status: 'Draft',
      createdAt: now, updatedAt: now
    };
  },

  generatePayroll(month) {
    const employees = EmployeeModule.getAll().filter(e => e.status === 'Active');
    const list = this.getAll();
    const existing = new Set(list.filter(p => p.month === month).map(p => p.employeeId));
    let created = 0;
    employees.forEach(e => {
      if (existing.has(e.id)) return;
      list.push(this.generatePayrollRecord(e, month));
      created++;
    });
    this.saveAll(list);
    if (created > 0) AuditLog.log('Payroll', 'Generated', month, created + ' payroll record(s) created');
    return created;
  },

  /* ---------- init ---------- */
  init() {
    document.getElementById('payrollMonthInput').value = this.state.month;
    document.getElementById('payrollMonthInput').addEventListener('change', (e) => {
      this.state.month = e.target.value || this.state.month;
      this.render();
    });
    document.getElementById('generatePayrollBtn').addEventListener('click', () => {
      const created = this.generatePayroll(this.state.month);
      if (created > 0) {
        Activity.log('Payroll generated for ' + created + ' employee(s) — ' + this.state.month);
        Toast.show('Payroll generated for ' + created + ' employee(s).', 'success');
      } else {
        Toast.show('Payroll already exists for every active employee this month.', 'info');
      }
      this.render();
    });

    this.bindToolbar();
    this.bindForm();
    this.bindModals();
  },

  bindToolbar() {
    const searchInput = document.getElementById('payrollSearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.render();
    }, 200));
    document.getElementById('filterPayrollStatus').addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('clearPayrollFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.status = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterPayrollStatus').value = '';
      this.render();
    });
    document.querySelectorAll('#payrollTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'asc';
        }
        this.render();
      });
    });
  },

  bindModals() {
    document.getElementById('payrollModalCloseBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('payrollCancelBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('payrollModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'payrollModalOverlay') this.closeForm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('payrollModalOverlay').hidden) this.closeForm();
    });
  },

  bindForm() {
    ['p_bonus', 'p_incentives', 'p_advance', 'p_loanEmi'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.recalcLive());
    });
    document.getElementById('payrollForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });
  },

  recalcLive() {
    const record = this.getAll().find(p => p.id === this.state.editingId);
    if (!record) return;
    const employee = EmployeeModule.getAll().find(e => e.id === record.employeeId);
    const bonus = Number(document.getElementById('p_bonus').value) || 0;
    const incentives = Number(document.getElementById('p_incentives').value) || 0;
    const advance = Number(document.getElementById('p_advance').value) || 0;
    const loanEmi = Number(document.getElementById('p_loanEmi').value) || 0;

    const fixedGross = record.basic + record.hra + record.da + record.specialAllowance + record.medical + record.travel;
    const grossSalary = fixedGross + bonus + record.overtime + incentives;
    const esi = this.computeESI(grossSalary);
    const professionalTax = this.computeProfessionalTax(grossSalary, employee, record.month);
    const structure = { basic: record.basic, hra: record.hra, da: record.da };
    const incomeTax = this.computeIncomeTax(structure, grossSalary, employee, professionalTax).monthlyTDS;
    const totalDeductions = record.pf + esi + professionalTax + incomeTax + record.leaveDeduction + record.latePenalty + advance + loanEmi;
    const netSalary = grossSalary - totalDeductions;

    document.getElementById('p_grossSalary').value = Utils.formatCurrency(grossSalary);
    document.getElementById('p_esi').value = Utils.formatCurrency(esi);
    document.getElementById('p_professionalTax').value = Utils.formatCurrency(professionalTax);
    document.getElementById('p_incomeTax').value = Utils.formatCurrency(incomeTax);
    document.getElementById('p_totalDeductions').value = Utils.formatCurrency(totalDeductions);
    document.getElementById('p_netSalaryPreview').textContent = Utils.formatCurrency(netSalary);
  },

  /* ---------- form open/close ---------- */
  openForm(record) {
    const form = document.getElementById('payrollForm');
    form.reset();
    this.state.editingId = record.id;

    const initials = (record.employeeName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    document.getElementById('payrollAvatarInitials').textContent = initials;
    document.getElementById('payrollEmployeeName').textContent = record.employeeName;
    document.getElementById('payrollEmployeeMeta').textContent = record.designation + ' · ' + record.month + ' · ' + record.id;
    document.getElementById('payrollModalTitle').textContent = 'Edit Payroll — ' + record.id;

    document.getElementById('p_basic').value = Utils.formatCurrency(record.basic);
    document.getElementById('p_hra').value = Utils.formatCurrency(record.hra);
    document.getElementById('p_da').value = Utils.formatCurrency(record.da);
    document.getElementById('p_specialAllowance').value = Utils.formatCurrency(record.specialAllowance);
    document.getElementById('p_medical').value = Utils.formatCurrency(record.medical);
    document.getElementById('p_travel').value = Utils.formatCurrency(record.travel);
    document.getElementById('p_overtime').value = Utils.formatCurrency(record.overtime);
    document.getElementById('p_bonus').value = record.bonus;
    document.getElementById('p_incentives').value = record.incentives;

    document.getElementById('p_pf').value = Utils.formatCurrency(record.pf);
    document.getElementById('p_leaveDeduction').value = Utils.formatCurrency(record.leaveDeduction) + (record.lopDays ? ' (' + record.lopDays + ' LOP day' + (record.lopDays === 1 ? '' : 's') + ')' : '');
    document.getElementById('p_latePenalty').value = Utils.formatCurrency(record.latePenalty);
    document.getElementById('p_advance').value = record.advance;
    document.getElementById('p_loanEmi').value = record.loanEmi;
    document.getElementById('p_status').value = record.status;

    this.recalcLive();
    document.getElementById('payrollModalOverlay').hidden = false;
  },

  closeForm() {
    document.getElementById('payrollModalOverlay').hidden = true;
  },

  handleSave() {
    const list = this.getAll();
    const idx = list.findIndex(p => p.id === this.state.editingId);
    if (idx === -1) return;
    const record = list[idx];

    record.bonus = Number(document.getElementById('p_bonus').value) || 0;
    record.incentives = Number(document.getElementById('p_incentives').value) || 0;
    record.advance = Number(document.getElementById('p_advance').value) || 0;
    record.loanEmi = Number(document.getElementById('p_loanEmi').value) || 0;
    record.status = document.getElementById('p_status').value;

    const employee = EmployeeModule.getAll().find(e => e.id === record.employeeId);
    const fixedGross = record.basic + record.hra + record.da + record.specialAllowance + record.medical + record.travel;
    record.grossSalary = fixedGross + record.bonus + record.overtime + record.incentives;
    record.esi = this.computeESI(record.grossSalary);
    record.professionalTax = this.computeProfessionalTax(record.grossSalary, employee, record.month);
    const structure = { basic: record.basic, hra: record.hra, da: record.da };
    const taxCalc = this.computeIncomeTax(structure, record.grossSalary, employee, record.professionalTax);
    record.incomeTax = taxCalc.monthlyTDS;
    record.taxRegime = (employee && employee.taxRegime) || 'new';
    record.taxableIncomeAnnual = taxCalc.taxableIncome;
    record.hraExemptionAnnual = taxCalc.hraExemption;
    record.deduction80CAnnual = taxCalc.deduction80C;
    record.rebate87A = taxCalc.rebate; record.surcharge = taxCalc.surcharge; record.cess = taxCalc.cess;
    record.totalDeductions = record.pf + record.esi + record.professionalTax + record.incomeTax +
      record.leaveDeduction + record.latePenalty + record.advance + record.loanEmi;
    record.netSalary = record.grossSalary - record.totalDeductions;
    record.updatedAt = Date.now();

    this.saveAll(list);
    Activity.log('Payroll ' + record.id + ' (' + record.employeeName + ') updated — ' + record.status);
    AuditLog.log('Payroll', 'Manually Adjusted', record.employeeName + ' (' + record.month + ')',
      'Bonus ' + Utils.formatCurrency(record.bonus) + ', Incentives ' + Utils.formatCurrency(record.incentives) +
      ', Net ' + Utils.formatCurrency(record.netSalary) + ', Status: ' + record.status);
    Toast.show('Payroll saved for ' + record.employeeName + '.', 'success');
    this.closeForm();
    this.render();
    Dashboard.render();
  },

  async handleDelete(id) {
    const list = this.getAll();
    const record = list.find(p => p.id === id);
    if (!record) return;
    const confirmed = await Confirm.ask(
      'Delete this payroll record?',
      record.id + ' — ' + record.employeeName + '\u2019s payroll for ' + record.month + ' will be permanently removed.',
      'Delete'
    );
    if (!confirmed) return;
    this.saveAll(list.filter(p => p.id !== id));
    Activity.log('Payroll record ' + record.id + ' (' + record.employeeName + ') deleted');
    Toast.show('Payroll record deleted.', 'success');
    this.render();
    Dashboard.render();
  },

  openView(record) {
    document.getElementById('viewModalTitle').textContent = record.employeeName + ' — ' + record.id;
    document.getElementById('viewModalBody').innerHTML =
      '<div class="detail-grid">' +
      VacancyModule.detailItem('Month', record.month) +
      VacancyModule.detailItem('Status', this.statusBadge(record.status)) +
      VacancyModule.detailItem('Basic', Utils.formatCurrency(record.basic)) +
      VacancyModule.detailItem('HRA', Utils.formatCurrency(record.hra)) +
      VacancyModule.detailItem('DA', Utils.formatCurrency(record.da)) +
      VacancyModule.detailItem('Special Allowance', Utils.formatCurrency(record.specialAllowance)) +
      VacancyModule.detailItem('Medical', Utils.formatCurrency(record.medical)) +
      VacancyModule.detailItem('Travel', Utils.formatCurrency(record.travel)) +
      VacancyModule.detailItem('Overtime', Utils.formatCurrency(record.overtime)) +
      VacancyModule.detailItem('Bonus', Utils.formatCurrency(record.bonus)) +
      VacancyModule.detailItem('Incentives', Utils.formatCurrency(record.incentives)) +
      VacancyModule.detailItem('Gross Salary', Utils.formatCurrency(record.grossSalary)) +
      VacancyModule.detailItem('PF', Utils.formatCurrency(record.pf)) +
      VacancyModule.detailItem('ESI', Utils.formatCurrency(record.esi)) +
      VacancyModule.detailItem('Professional Tax', Utils.formatCurrency(record.professionalTax)) +
      VacancyModule.detailItem('Income Tax', Utils.formatCurrency(record.incomeTax)) +
      VacancyModule.detailItem('Leave Deduction', Utils.formatCurrency(record.leaveDeduction)) +
      VacancyModule.detailItem('Late Penalty', Utils.formatCurrency(record.latePenalty)) +
      VacancyModule.detailItem('Advance', Utils.formatCurrency(record.advance)) +
      VacancyModule.detailItem('Loan EMI', Utils.formatCurrency(record.loanEmi)) +
      VacancyModule.detailItem('Total Deductions', Utils.formatCurrency(record.totalDeductions)) +
      VacancyModule.detailItem('Net Salary', Utils.formatCurrency(record.netSalary)) +
      '</div>';
    document.getElementById('viewModalOverlay').hidden = false;
  },

  /* ---------- rendering ---------- */
  statusBadge(status) {
    const map = { 'Draft': 'badge-neutral', 'Processed': 'badge-info', 'Paid': 'badge-success' };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + Utils.escapeHtml(status) + '</span>';
  },

  getFilteredSorted() {
    let list = this.getAll().filter(p => p.month === this.state.month);
    const { search, status, sortKey, sortDir } = this.state;
    if (search) list = list.filter(p => (p.employeeName || '').toLowerCase().includes(search) || (p.id || '').toLowerCase().includes(search));
    if (status) list = list.filter(p => p.status === status);
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === undefined) av = '';
      if (bv === undefined) bv = '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  render() {
    const employees = EmployeeModule.getAll();
    const hasAny = employees.length > 0;
    document.getElementById('payrollNoEmployeeGuard').hidden = hasAny;
    document.getElementById('payrollMainArea').style.display = hasAny ? '' : 'none';
    if (!hasAny) return;

    document.getElementById('payrollMonthInput').value = this.state.month;
    this.renderStatusStrip();
    document.getElementById('payrollSearch').value = this.state.search;
    document.getElementById('filterPayrollStatus').value = this.state.status;

    const filtered = this.getFilteredSorted();
    const monthRecords = this.getAll().filter(p => p.month === this.state.month);
    document.getElementById('payrollEmptyState').hidden = monthRecords.length !== 0;
    document.getElementById('payrollTable').style.display = monthRecords.length === 0 ? 'none' : '';

    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('payrollTableBody').innerHTML = pageItems.map(p => this.rowHtml(p)).join('');

    document.querySelectorAll('#payrollTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort') ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('payrollTableCount').textContent =
      filtered.length === 0 ? 'No payroll records match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  renderStatusStrip() {
    const monthRecords = this.getAll().filter(p => p.month === this.state.month);
    const counts = { Draft: 0, Processed: 0, Paid: 0 };
    let totalNet = 0;
    monthRecords.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; totalNet += p.netSalary; });
    const strip = document.getElementById('payrollStatusStrip');
    strip.innerHTML =
      this.chip('pending', 'Draft', counts.Draft) +
      this.chip('screening', 'Processed', counts.Processed) +
      this.chip('accepted', 'Paid', counts.Paid) +
      '<div class="status-chip open"><span class="status-chip-count">' + Utils.formatCurrency(totalNet) + '</span><span class="status-chip-label">Total Net Payout</span></div>';
  },

  chip(cls, label, count) {
    return '<div class="status-chip ' + cls + '"><span class="status-chip-count">' + count +
      '</span><span class="status-chip-label">' + label + '</span></div>';
  },

  rowHtml(p) {
    return '<tr data-id="' + Utils.escapeHtml(p.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(p.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(p.employeeName) + '</td>' +
      '<td class="cell-secondary">' + p.month + '</td>' +
      '<td class="cell-secondary">' + Utils.formatCurrency(p.grossSalary) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatCurrency(p.totalDeductions) + '</td>' +
      '<td class="cell-primary">' + Utils.formatCurrency(p.netSalary) + '</td>' +
      '<td>' + this.statusBadge(p.status) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      '<button class="row-action-btn" data-action="view" data-id="' + Utils.escapeHtml(p.id) + '" title="View" aria-label="View"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/></svg></button>' +
      '<button class="row-action-btn" data-action="edit" data-id="' + Utils.escapeHtml(p.id) + '" title="Edit" aria-label="Edit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>' +
      '<button class="row-action-btn danger" data-action="delete" data-id="' + Utils.escapeHtml(p.id) + '" title="Delete" aria-label="Delete"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '</div></td></tr>';
  },

  bindRowActions() {
    document.querySelectorAll('#payrollTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const record = this.getAll().find(p => p.id === id);
        if (!record) return;
        if (action === 'view') this.openView(record);
        if (action === 'edit') this.openForm(record);
        if (action === 'delete') this.handleDelete(id);
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('payrollPagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.render();
      });
    });
  }
};

/* ---------------------------------------------------------------
   22. PHASE 13 — SALARY SLIP
   A thin, storage-free presentation layer: everything a slip needs
   (earnings, deductions, net pay, bank details) already exists on
   the Payroll record and the Employee record, so this phase just
   formats and displays it — no new data to collect.
--------------------------------------------------------------- */
const SalarySlipModule = {
  state: {
    search: '',
    month: '',
    sortKey: 'month',
    sortDir: 'desc',
    page: 1,
    pageSize: 8
  },

  get COMPANY_NAME() { return CompanySettingsStore.get().name; },
  get COMPANY_TAGLINE() { return CompanySettingsStore.get().tagline; },

  /* ---------- init ---------- */
  init() {
    this.bindToolbar();
    this.bindModal();
    this.bindForm16();
  },

  bindToolbar() {
    const searchInput = document.getElementById('payslipSearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.render();
    }, 200));
    document.getElementById('filterPayslipMonth').addEventListener('change', (e) => {
      this.state.month = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('clearPayslipFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.month = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterPayslipMonth').value = '';
      this.render();
    });
    document.querySelectorAll('#payslipTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'asc';
        }
        this.render();
      });
    });
  },

  bindModal() {
    document.getElementById('payslipPreviewCloseBtn').addEventListener('click', () => this.closePreview());
    document.getElementById('payslipPreviewCloseBtn2').addEventListener('click', () => this.closePreview());
    document.getElementById('payslipPreviewOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'payslipPreviewOverlay') this.closePreview();
    });
    document.getElementById('payslipPrintBtn').addEventListener('click', () => window.print());
    document.getElementById('payslipDownloadBtn').addEventListener('click', (e) => {
      PdfExport.downloadElement('payslipPaper', this.state.previewFilename || 'Salary-Slip.pdf', e.currentTarget);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('payslipPreviewOverlay').hidden) this.closePreview();
    });
  },

  closePreview() {
    document.getElementById('payslipPreviewOverlay').hidden = true;
  },

  /* ---------- Form 16 / Annual Tax Statement ---------- */
  bindForm16() {
    document.getElementById('openForm16Btn').addEventListener('click', () => this.openForm16Selector());
    document.getElementById('form16SelectCloseBtn').addEventListener('click', () => this.closeForm16Selector());
    document.getElementById('form16SelectCancelBtn').addEventListener('click', () => this.closeForm16Selector());
    document.getElementById('form16SelectModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'form16SelectModalOverlay') this.closeForm16Selector();
    });
    document.getElementById('form16GenerateBtn').addEventListener('click', () => this.handleGenerateForm16());
  },

  openForm16Selector() {
    const empSelect = document.getElementById('f16_employee');
    const empIdsWithPayroll = new Set(PayrollModule.getAll().map(p => p.employeeId));
    const employees = EmployeeModule.getAll().filter(e => empIdsWithPayroll.has(e.id));
    empSelect.innerHTML = '<option value="">Select employee</option>' +
      employees.map(e => '<option value="' + Utils.escapeHtml(e.id) + '">' + Utils.escapeHtml(e.name) + ' (' + Utils.escapeHtml(e.id) + ')</option>').join('');

    const fySelect = document.getElementById('f16_fy');
    fySelect.innerHTML = '<option value="">Select financial year</option>' +
      this.getAvailableFYs().map(fy => '<option value="' + fy + '">FY ' + fy + '</option>').join('');

    document.getElementById('err_f16_employee').textContent = '';
    document.getElementById('err_f16_fy').textContent = '';
    document.getElementById('form16SelectModalOverlay').hidden = false;
  },

  closeForm16Selector() {
    document.getElementById('form16SelectModalOverlay').hidden = true;
  },

  monthToFY(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    return m >= 4 ? (y + '-' + String(y + 1).slice(-2)) : ((y - 1) + '-' + String(y).slice(-2));
  },

  fyToMonths(fy) {
    const startY = Number(fy.split('-')[0]);
    const months = [];
    for (let m = 4; m <= 12; m++) months.push(startY + '-' + Utils.pad(m, 2));
    for (let m = 1; m <= 3; m++) months.push((startY + 1) + '-' + Utils.pad(m, 2));
    return months;
  },

  getAvailableFYs() {
    const fys = new Set(PayrollModule.getAll().map(p => this.monthToFY(p.month)));
    return [...fys].sort().reverse();
  },

  handleGenerateForm16() {
    const employeeId = document.getElementById('f16_employee').value;
    const fy = document.getElementById('f16_fy').value;
    let valid = true;
    if (!employeeId) { document.getElementById('err_f16_employee').textContent = 'Select an employee.'; valid = false; }
    if (!fy) { document.getElementById('err_f16_fy').textContent = 'Select a financial year.'; valid = false; }
    if (!valid) return;

    const employee = EmployeeModule.getAll().find(e => e.id === employeeId);
    const months = new Set(this.fyToMonths(fy));
    const records = PayrollModule.getAll().filter(p => p.employeeId === employeeId && months.has(p.month))
      .sort((a, b) => a.month.localeCompare(b.month));

    if (records.length === 0) {
      document.getElementById('err_f16_fy').textContent = 'No payroll runs found for this employee in FY ' + fy + '.';
      return;
    }

    const data = this.computeForm16Data(employee, fy, records);
    document.getElementById('payslipPreviewTitle').textContent = 'Form 16 — ' + employee.name + ' — FY ' + fy;
    document.getElementById('payslipPaper').innerHTML = this.renderForm16Html(data);
    this.state.previewFilename = 'Form16-' + employee.name.replace(/\s+/g, '-') + '-FY' + fy + '.pdf';
    this.closeForm16Selector();
    document.getElementById('payslipPreviewOverlay').hidden = false;
  },

  computeForm16Data(employee, fy, records) {
    const sum = (key) => records.reduce((acc, r) => acc + (r[key] || 0), 0);
    const grossAnnual = sum('grossSalary');
    const basicAnnual = sum('basic');
    const daAnnual = sum('da');
    const hraReceivedAnnual = sum('hra');
    const professionalTaxAnnual = sum('professionalTax');
    const tdsAlreadyDeducted = sum('incomeTax');
    const monthsCount = records.length;
    const isMetro = HRA_METRO_CITIES.includes(employee.city);
    const regime = employee.taxRegime || 'new';

    const annual = TaxEngine.computeAnnualTax({
      grossAnnual, basicAnnual, daAnnual, hraReceivedAnnual,
      rentPaidAnnual: (employee.rentPaidMonthly || 0) * monthsCount,
      isMetro,
      declared80CAnnual: employee.declared80CAnnual || 0,
      regime,
      professionalTaxAnnual
    });

    const quarters = [
      { label: 'Q1 (Apr–Jun)', months: this.fyToMonths(fy).slice(0, 3) },
      { label: 'Q2 (Jul–Sep)', months: this.fyToMonths(fy).slice(3, 6) },
      { label: 'Q3 (Oct–Dec)', months: this.fyToMonths(fy).slice(6, 9) },
      { label: 'Q4 (Jan–Mar)', months: this.fyToMonths(fy).slice(9, 12) }
    ].map(q => ({
      label: q.label,
      tds: records.filter(r => q.months.includes(r.month)).reduce((acc, r) => acc + (r.incomeTax || 0), 0)
    }));

    return {
      employee, fy, monthsCount, grossAnnual, professionalTaxAnnual, tdsAlreadyDeducted, quarters,
      company: CompanySettingsStore.get(), annual
    };
  },

  renderForm16Html(d) {
    const row = (label, amount, opts) => '<div class="payslip-line' + (opts && opts.total ? ' total' : '') + '"><span>' + Utils.escapeHtml(label) + '</span><span>' + Utils.formatCurrency(amount) + '</span></div>';
    const balance = d.annual.totalTax - d.tdsAlreadyDeducted;
    const balanceLabel = balance > 0 ? 'Net Tax Payable' : balance < 0 ? 'Refund Due' : 'Balance';

    return (
      '<div class="payslip-header">' +
      '<div class="payslip-logo-mark">ST</div>' +
      '<div class="payslip-company-block">' +
      '<div class="payslip-company-name">' + Utils.escapeHtml(d.company.name) + '</div>' +
      '<div class="payslip-company-tagline">' + Utils.escapeHtml(d.company.address) + '</div>' +
      '</div>' +
      '<div class="payslip-meta-label" style="text-align:right;">Form 16 (Part A &amp; B)<br/><strong style="color:#1b2430;font-size:13px;">FY ' + d.fy + '</strong></div>' +
      '</div>' +

      '<div class="payslip-meta-grid">' +
      '<div><div class="payslip-meta-label">Employee</div><div class="payslip-meta-value">' + Utils.escapeHtml(d.employee.name) + '</div></div>' +
      '<div><div class="payslip-meta-label">Employee PAN</div><div class="payslip-meta-value">' + Utils.escapeHtml(d.employee.pan || '—') + '</div></div>' +
      '<div><div class="payslip-meta-label">Designation</div><div class="payslip-meta-value">' + Utils.escapeHtml(d.employee.designation) + '</div></div>' +
      '<div><div class="payslip-meta-label">Tax Regime</div><div class="payslip-meta-value">' + Utils.escapeHtml(d.annual.regimeLabel) + '</div></div>' +
      '<div><div class="payslip-meta-label">Deductor TAN</div><div class="payslip-meta-value">' + Utils.escapeHtml(d.company.tan) + '</div></div>' +
      '<div><div class="payslip-meta-label">Deductor PAN</div><div class="payslip-meta-value">' + Utils.escapeHtml(d.company.employerPan) + '</div></div>' +
      '</div>' +

      '<div class="payslip-col-title" style="margin-top:6px;">Part A — Quarterly TDS Summary (' + d.monthsCount + ' payroll run' + (d.monthsCount === 1 ? '' : 's') + ' on record)</div>' +
      d.quarters.map(q => row(q.label, q.tds)).join('') +
      '<div class="payslip-line total"><span>Total TDS Deducted (Part A)</span><span>' + Utils.formatCurrency(d.tdsAlreadyDeducted) + '</span></div>' +

      '<div class="payslip-col-title" style="margin-top:18px;">Part B — Annexure: Computation of Total Income &amp; Tax</div>' +
      row('Gross Salary (Sec 17(1))', d.grossAnnual) +
      row('Less: Professional Tax (Sec 16(iii))', d.professionalTaxAnnual) +
      row('Less: Standard Deduction (Sec 16(ia))', d.annual.standardDeduction) +
      (d.annual.hraExemption ? row('Less: HRA Exemption (Sec 10(13A))', d.annual.hraExemption) : '') +
      (d.annual.deduction80C ? row('Less: Deduction under Chapter VI-A (80C)', d.annual.deduction80C) : '') +
      '<div class="payslip-line total"><span>Total Taxable Income</span><span>' + Utils.formatCurrency(d.annual.taxableIncome) + '</span></div>' +
      row('Tax on Total Income (slab-wise)', d.annual.slabTax) +
      (d.annual.rebate ? row('Less: Rebate u/s 87A', d.annual.rebate) : '') +
      (d.annual.surcharge ? row('Add: Surcharge', d.annual.surcharge) : '') +
      row('Add: Health &amp; Education Cess @4%', d.annual.cess) +
      '<div class="payslip-line total"><span>Total Tax Liability</span><span>' + Utils.formatCurrency(d.annual.totalTax) + '</span></div>' +
      row('Less: Total TDS Already Deducted', d.tdsAlreadyDeducted) +

      '<div class="payslip-netpay-box' + (balance > 0 ? ' negative' : '') + '"><span>' + balanceLabel + '</span><span class="payslip-netpay-amount">' + Utils.formatCurrency(Math.abs(balance)) + '</span></div>' +

      '<div class="payslip-footer-row"><div class="payslip-qr-placeholder">QR CODE<br/>PLACEHOLDER</div>' +
      '<div style="text-align:right;"><div class="offer-letter-sign-line" style="margin-top:0;">' +
      '<div class="offer-letter-sign-name">Midhun Das</div><div class="offer-letter-sign-title">Accounting Expert (Digital Signature)</div></div></div></div>' +

      '<p style="font-size:10.5px;color:#8a94a3;margin-top:14px;">This is a system-generated training document from the SKELORA simulator (FY2025-26 slabs per Union Budget 2025) and is not a valid statutory Form 16. It does not represent a real deduction or deposit of tax.</p>'
    );
  },

  /* ---------- slip rendering ---------- */
  maskAccount(accountNumber) {
    if (!accountNumber) return '—';
    const last4 = accountNumber.slice(-4);
    return 'XXXX-XXXX-' + last4;
  },

  openPreview(payrollRecord) {
    const employee = EmployeeModule.getAll().find(e => e.id === payrollRecord.employeeId);
    document.getElementById('payslipPreviewTitle').textContent = 'Salary Slip — ' + payrollRecord.month;
    document.getElementById('payslipPaper').innerHTML = this.renderSlipHtml(payrollRecord, employee);
    this.state.previewFilename = 'Payslip-' + payrollRecord.employeeName.replace(/\s+/g, '-') + '-' + payrollRecord.month + '.pdf';
    document.getElementById('payslipPreviewOverlay').hidden = false;
  },

  renderSlipHtml(p, employee) {
    const line = (label, amount) => '<div class="payslip-line"><span>' + Utils.escapeHtml(label) + '</span><span>' + Utils.formatCurrency(amount) + '</span></div>';
    const totalEarnings = p.basic + p.hra + p.da + p.specialAllowance + p.medical + p.travel + p.bonus + p.overtime + p.incentives;

    return (
      '<div class="payslip-header">' +
      '<div class="payslip-logo-mark">ST</div>' +
      '<div class="payslip-company-block">' +
      '<div class="payslip-company-name">' + Utils.escapeHtml(this.COMPANY_NAME) + '</div>' +
      '<div class="payslip-company-tagline">' + Utils.escapeHtml(this.COMPANY_TAGLINE) + '</div>' +
      '</div>' +
      '<div class="payslip-meta-label" style="text-align:right;">Payslip for<br/><strong style="color:#1b2430;font-size:13px;">' + p.month + '</strong></div>' +
      '</div>' +

      '<div class="payslip-meta-grid">' +
      '<div><div class="payslip-meta-label">Employee</div><div class="payslip-meta-value">' + Utils.escapeHtml(p.employeeName) + '</div></div>' +
      '<div><div class="payslip-meta-label">Employee ID</div><div class="payslip-meta-value">' + Utils.escapeHtml(p.employeeId) + '</div></div>' +
      '<div><div class="payslip-meta-label">Designation</div><div class="payslip-meta-value">' + Utils.escapeHtml(p.designation) + '</div></div>' +
      '<div><div class="payslip-meta-label">Department</div><div class="payslip-meta-value">' + Utils.escapeHtml(p.department) + '</div></div>' +
      '<div><div class="payslip-meta-label">Bank</div><div class="payslip-meta-value">' + Utils.escapeHtml(employee ? employee.bankName : '—') + '</div></div>' +
      '<div><div class="payslip-meta-label">Account No.</div><div class="payslip-meta-value">' + this.maskAccount(employee ? employee.accountNumber : '') + '</div></div>' +
      '</div>' +

      '<div class="payslip-columns">' +
      '<div><div class="payslip-col-title">Earnings</div>' +
      line('Basic', p.basic) + line('HRA', p.hra) + line('DA', p.da) + line('Special Allowance', p.specialAllowance) +
      line('Medical', p.medical) + line('Travel', p.travel) + line('Bonus', p.bonus) + line('Overtime', p.overtime) + line('Incentives', p.incentives) +
      '<div class="payslip-line total"><span>Gross Earnings</span><span>' + Utils.formatCurrency(totalEarnings) + '</span></div>' +
      '</div>' +
      '<div><div class="payslip-col-title">Deductions</div>' +
      line('PF', p.pf) + line('ESI', p.esi) + line('Professional Tax', p.professionalTax) + line('Income Tax', p.incomeTax) +
      line('Leave Deduction', p.leaveDeduction) + line('Late Penalty', p.latePenalty) + line('Advance', p.advance) + line('Loan EMI', p.loanEmi) +
      '<div class="payslip-line total"><span>Total Deductions</span><span>' + Utils.formatCurrency(p.totalDeductions) + '</span></div>' +
      '</div>' +
      '</div>' +

      '<div class="payslip-netpay-box' + (p.netSalary < 0 ? ' negative' : '') + '"><span>Net Pay</span><span class="payslip-netpay-amount">' + Utils.formatCurrency(p.netSalary) + '</span></div>' +

      '<div class="payslip-footer-row">' +
      '<div class="payslip-qr-placeholder">QR CODE<br/>PLACEHOLDER</div>' +
      '<div style="text-align:right;">' +
      '<div class="offer-letter-sign-line" style="margin-top:0;"><div class="offer-letter-sign-name">Midhun Das</div><div class="offer-letter-sign-title">Accounting Expert (Digital Signature)</div></div>' +
      '</div></div>' +
      '<p style="font-size:10.5px;color:#8a94a3;margin-top:14px;">This is a system-generated payslip from the SKELORA training simulator and does not represent a real payment.</p>'
    );
  },

  /* ---------- table rendering ---------- */
  populateMonthFilter() {
    const months = [...new Set(PayrollModule.getAll().map(p => p.month))].sort().reverse();
    const select = document.getElementById('filterPayslipMonth');
    const current = this.state.month;
    select.innerHTML = '<option value="">All Months</option>' + months.map(m => '<option' + (m === current ? ' selected' : '') + '>' + m + '</option>').join('');
  },

  getFilteredSorted() {
    let list = PayrollModule.getAll();
    const { search, month, sortKey, sortDir } = this.state;
    if (search) list = list.filter(p => (p.employeeName || '').toLowerCase().includes(search) || (p.id || '').toLowerCase().includes(search));
    if (month) list = list.filter(p => p.month === month);
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === undefined) av = '';
      if (bv === undefined) bv = '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  render() {
    const hasAny = PayrollModule.getAll().length > 0;
    document.getElementById('payslipNoDataGuard').hidden = hasAny;
    document.getElementById('payslipMainArea').style.display = hasAny ? '' : 'none';
    if (!hasAny) return;

    this.populateMonthFilter();
    document.getElementById('payslipSearch').value = this.state.search;

    const filtered = this.getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('payslipTableBody').innerHTML = pageItems.map(p => this.rowHtml(p)).join('');

    document.querySelectorAll('#payslipTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort') ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('payslipTableCount').textContent =
      filtered.length === 0 ? 'No payroll runs match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  rowHtml(p) {
    return '<tr data-id="' + Utils.escapeHtml(p.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(p.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(p.employeeName) + '</td>' +
      '<td>' + Utils.escapeHtml(p.department) + '</td>' +
      '<td class="cell-secondary">' + p.month + '</td>' +
      '<td class="cell-primary">' + Utils.formatCurrency(p.netSalary) + '</td>' +
      '<td>' + PayrollModule.statusBadge(p.status) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      '<button class="row-action-btn" data-action="preview" data-id="' + Utils.escapeHtml(p.id) + '" title="View Slip" aria-label="View Slip"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/></svg></button>' +
      '</div></td></tr>';
  },

  bindRowActions() {
    document.querySelectorAll('#payslipTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const record = PayrollModule.getAll().find(p => p.id === id);
        if (record) this.openPreview(record);
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('payslipPagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.render();
      });
    });
  }
};

/* ---------------------------------------------------------------
   23. PHASE 14 — EXIT MANAGEMENT
--------------------------------------------------------------- */
const ExitModule = {
  state: {
    search: '',
    status: '',
    sortKey: 'resignationDate',
    sortDir: 'desc',
    page: 1,
    pageSize: 8,
    editingId: null
  },

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.exits, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.exits, list);
  },
  nextId() {
    const counter = Storage.get(STORAGE_KEYS.exitCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.exitCounter, counter);
    const year = new Date().getFullYear();
    return 'EXIT-' + year + '-' + Utils.pad(counter, 4);
  },

  emptyAssets() {
    const obj = {};
    ASSET_ITEMS.forEach(a => { obj[a.key] = false; });
    return obj;
  },

  addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + Number(days));
    return d.toISOString().slice(0, 10);
  },

  computeClearance(assets) {
    const total = ASSET_ITEMS.length;
    const done = ASSET_ITEMS.filter(a => assets[a.key]).length;
    return Math.round((done / total) * 100);
  },
  computeClearanceStatus(percent) {
    if (percent === 0) return 'Not Started';
    if (percent === 100) return 'Cleared';
    return 'In Progress';
  },

  /* ---------- init ---------- */
  init() {
    this.buildAssetItems();
    document.getElementById('newResignationBtn').addEventListener('click', () => this.openResignationForm());
    this.bindToolbar();
    this.bindResignationForm();
    this.bindExitForm();
    this.bindModals();
  },

  buildAssetItems() {
    const container = document.getElementById('assetItemsContainer');
    container.innerHTML = ASSET_ITEMS.map(a =>
      '<div class="checklist-item"><input type="checkbox" id="asset_' + a.key + '" data-asset-key="' + a.key + '" />' +
      '<label for="asset_' + a.key + '">' + Utils.escapeHtml(a.label) + '</label></div>'
    ).join('');
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => this.recalcClearanceLive());
    });
  },

  recalcClearanceLive() {
    const assets = this.readFormAssets();
    const percent = this.computeClearance(assets);
    document.getElementById('exitProgressFill').style.width = percent + '%';
    document.getElementById('exitProgressLabel').textContent = percent + '% complete';
  },

  readFormAssets() {
    const assets = {};
    ASSET_ITEMS.forEach(a => { assets[a.key] = document.getElementById('asset_' + a.key).checked; });
    return assets;
  },

  bindToolbar() {
    const searchInput = document.getElementById('exitSearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.render();
    }, 200));
    document.getElementById('filterExitStatus').addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('clearExitFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.status = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterExitStatus').value = '';
      this.render();
    });
    document.querySelectorAll('#exitTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'asc';
        }
        this.render();
      });
    });
  },

  bindModals() {
    document.getElementById('resignationModalCloseBtn').addEventListener('click', () => this.closeResignationForm());
    document.getElementById('resignationCancelBtn').addEventListener('click', () => this.closeResignationForm());
    document.getElementById('resignationModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'resignationModalOverlay') this.closeResignationForm();
    });
    document.getElementById('exitModalCloseBtn').addEventListener('click', () => this.closeExitForm());
    document.getElementById('exitCancelBtn').addEventListener('click', () => this.closeExitForm());
    document.getElementById('exitModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'exitModalOverlay') this.closeExitForm();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('resignationModalOverlay').hidden) this.closeResignationForm();
      if (!document.getElementById('exitModalOverlay').hidden) this.closeExitForm();
    });
  },

  /* ---------- resignation form ---------- */
  bindResignationForm() {
    ['rs_resignationDate', 'rs_noticePeriod'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this.recalcResignationPreview());
    });
    document.getElementById('resignationForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleResignationSave();
    });
  },

  recalcResignationPreview() {
    const resignationDate = document.getElementById('rs_resignationDate').value;
    const noticePeriod = document.getElementById('rs_noticePeriod').value;
    document.getElementById('rs_lastWorkingDayPreview').value = resignationDate
      ? Utils.formatDate(this.addDays(resignationDate, noticePeriod))
      : '—';
  },

  openResignationForm() {
    const form = document.getElementById('resignationForm');
    form.reset();
    this.clearResignationErrors();

    const select = document.getElementById('rs_employeeId');
    const employees = EmployeeModule.getAll().filter(e => e.status === 'Active');
    select.innerHTML = '<option value="">Select employee</option>' +
      employees.map(e => '<option value="' + Utils.escapeHtml(e.id) + '">' + Utils.escapeHtml(e.name) + '</option>').join('');

    document.getElementById('rs_resignationDate').value = Utils.todayStr();
    document.getElementById('rs_noticePeriod').value = '30';
    this.recalcResignationPreview();
    document.getElementById('resignationModalOverlay').hidden = false;
  },

  closeResignationForm() {
    document.getElementById('resignationModalOverlay').hidden = true;
  },

  clearResignationErrors() {
    ['rs_employeeId', 'rs_resignationDate', 'rs_reason'].forEach(id => {
      const errEl = document.getElementById('err_' + id);
      if (errEl) errEl.textContent = '';
      document.getElementById(id).classList.remove('invalid');
    });
  },

  validateResignation() {
    this.clearResignationErrors();
    let valid = true;
    if (!document.getElementById('rs_employeeId').value) {
      document.getElementById('err_rs_employeeId').textContent = 'Select an employee.';
      document.getElementById('rs_employeeId').classList.add('invalid');
      valid = false;
    }
    if (!document.getElementById('rs_resignationDate').value) {
      document.getElementById('err_rs_resignationDate').textContent = 'Resignation date is required.';
      document.getElementById('rs_resignationDate').classList.add('invalid');
      valid = false;
    }
    if (!document.getElementById('rs_reason').value.trim()) {
      document.getElementById('err_rs_reason').textContent = 'Enter a reason for the resignation.';
      valid = false;
    }
    return valid;
  },

  handleResignationSave() {
    if (!this.validateResignation()) {
      Toast.show('Please fix the highlighted fields.', 'error');
      return;
    }
    const employeeId = document.getElementById('rs_employeeId').value;
    const employee = EmployeeModule.getAll().find(e => e.id === employeeId);
    const resignationDate = document.getElementById('rs_resignationDate').value;
    const noticePeriodDays = Number(document.getElementById('rs_noticePeriod').value);
    const reason = document.getElementById('rs_reason').value.trim();
    const lastWorkingDay = this.addDays(resignationDate, noticePeriodDays);
    const now = Date.now();

    const list = this.getAll();
    list.unshift({
      id: this.nextId(),
      employeeId: employee.id, employeeName: employee.name,
      department: employee.department, designation: employee.designation,
      resignationDate, reason, noticePeriodDays, lastWorkingDay,
      status: 'Pending Manager Approval',
      assets: this.emptyAssets(),
      clearancePercent: 0, clearanceStatus: 'Not Started',
      interviewDate: '', interviewFeedback: '',
      createdAt: now, updatedAt: now
    });
    this.saveAll(list);
    Activity.log(employee.name + ' submitted resignation — last working day ' + Utils.formatDate(lastWorkingDay));
    Toast.show('Resignation recorded for ' + employee.name + '.', 'success');
    this.closeResignationForm();
    this.render();
  },

  /* ---------- manage exit form ---------- */
  bindExitForm() {
    ['ex_interviewDate', 'ex_interviewFeedback'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {});
    });
    document.getElementById('exitForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleExitSave();
    });
  },

  openExitForm(exitRecord) {
    const form = document.getElementById('exitForm');
    form.reset();
    this.state.editingId = exitRecord.id;

    const initials = (exitRecord.employeeName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    document.getElementById('exitAvatarInitials').textContent = initials;
    document.getElementById('exitEmployeeName').textContent = exitRecord.employeeName;
    document.getElementById('exitEmployeeMeta').textContent =
      'Last working day ' + Utils.formatDate(exitRecord.lastWorkingDay) + ' · ' + exitRecord.id;
    document.getElementById('exitModalTitle').textContent = 'Manage Exit — ' + exitRecord.id;

    ASSET_ITEMS.forEach(a => { document.getElementById('asset_' + a.key).checked = !!(exitRecord.assets && exitRecord.assets[a.key]); });
    this.recalcClearanceLive();

    document.getElementById('ex_interviewDate').value = exitRecord.interviewDate || '';
    document.getElementById('ex_interviewFeedback').value = exitRecord.interviewFeedback || '';

    document.getElementById('exitModalOverlay').hidden = false;
  },

  closeExitForm() {
    document.getElementById('exitModalOverlay').hidden = true;
  },

  handleExitSave() {
    const list = this.getAll();
    const idx = list.findIndex(e => e.id === this.state.editingId);
    if (idx === -1) return;

    const assets = this.readFormAssets();
    const percent = this.computeClearance(assets);
    list[idx].assets = assets;
    list[idx].clearancePercent = percent;
    list[idx].clearanceStatus = this.computeClearanceStatus(percent);
    list[idx].interviewDate = document.getElementById('ex_interviewDate').value;
    list[idx].interviewFeedback = document.getElementById('ex_interviewFeedback').value.trim();
    list[idx].updatedAt = Date.now();

    // Once the resignation is Approved and all assets are cleared, the employee is relieved.
    if (list[idx].status === 'Approved' && list[idx].clearanceStatus === 'Cleared') {
      const employees = EmployeeModule.getAll();
      const eIdx = employees.findIndex(e => e.id === list[idx].employeeId);
      if (eIdx > -1 && employees[eIdx].status === 'Active') {
        employees[eIdx].status = 'Inactive';
        employees[eIdx].updatedAt = Date.now();
        EmployeeModule.saveAll(employees);
        Activity.log(list[idx].employeeName + ' relieved — clearance complete, marked Inactive in Employee Master');
      }
    }

    this.saveAll(list);
    Toast.show('Exit record saved for ' + list[idx].employeeName + '.', 'success');
    this.closeExitForm();
    this.render();
    Dashboard.render();
  },

  async handleDelete(id) {
    const list = this.getAll();
    const record = list.find(e => e.id === id);
    if (!record) return;
    const confirmed = await Confirm.ask(
      'Delete this exit record?',
      record.id + ' — ' + record.employeeName + '\u2019s resignation record will be permanently removed.',
      'Delete'
    );
    if (!confirmed) return;
    this.saveAll(list.filter(e => e.id !== id));
    Activity.log('Exit record ' + record.id + ' (' + record.employeeName + ') deleted');
    Toast.show('Exit record deleted.', 'success');
    this.render();
  },

  changeStatus(id, status) {
    const list = this.getAll();
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) return;
    list[idx].status = status;
    list[idx].updatedAt = Date.now();
    this.saveAll(list);
    Activity.log(list[idx].employeeName + '\u2019s resignation ' + list[idx].id + ' marked ' + status);
    Toast.show(list[idx].employeeName + '\u2019s resignation marked ' + status + '.', 'success');
    this.render();
  },

  openView(record) {
    document.getElementById('viewModalTitle').textContent = record.employeeName + ' — ' + record.id;
    const assetsHtml = ASSET_ITEMS.map(a => {
      const done = !!(record.assets && record.assets[a.key]);
      return '<span class="badge ' + (done ? 'badge-success' : 'badge-neutral') + '">' + (done ? '\u2713 ' : '') + Utils.escapeHtml(a.label) + '</span> ';
    }).join('');
    document.getElementById('viewModalBody').innerHTML =
      '<div class="detail-grid">' +
      VacancyModule.detailItem('Exit ID', record.id) +
      VacancyModule.detailItem('Status', this.statusBadge(record.status)) +
      VacancyModule.detailItem('Employee', record.employeeName) +
      VacancyModule.detailItem('Department', record.department) +
      VacancyModule.detailItem('Resignation Date', Utils.formatDate(record.resignationDate)) +
      VacancyModule.detailItem('Notice Period', record.noticePeriodDays + ' days') +
      VacancyModule.detailItem('Last Working Day', Utils.formatDate(record.lastWorkingDay)) +
      VacancyModule.detailItem('Clearance', this.clearanceBadge(record.clearanceStatus, record.clearancePercent)) +
      '<div class="detail-item detail-full"><span class="detail-label">Reason</span><div class="detail-value">' + Utils.escapeHtml(record.reason) + '</div></div>' +
      '<div class="detail-item detail-full"><span class="detail-label">Asset Return</span><div class="detail-value">' + assetsHtml + '</div></div>' +
      VacancyModule.detailItem('Exit Interview Date', record.interviewDate ? Utils.formatDate(record.interviewDate) : '—') +
      '<div class="detail-item detail-full"><span class="detail-label">Exit Interview Feedback</span><div class="detail-value">' + Utils.escapeHtml(record.interviewFeedback || '—') + '</div></div>' +
      '</div>';
    document.getElementById('viewModalOverlay').hidden = false;
  },

  /* ---------- rendering ---------- */
  statusBadge(status) {
    const map = {
      'Pending Manager Approval': 'badge-warning', 'Pending HR Approval': 'badge-info',
      'Approved': 'badge-success', 'Rejected': 'badge-danger'
    };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + Utils.escapeHtml(status) + '</span>';
  },
  clearanceBadge(status, percent) {
    const map = { 'Not Started': 'badge-neutral', 'In Progress': 'badge-warning', 'Cleared': 'badge-success' };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + Utils.escapeHtml(status) + ' (' + percent + '%)</span>';
  },

  getFilteredSorted() {
    let list = this.getAll();
    const { search, status, sortKey, sortDir } = this.state;
    if (search) list = list.filter(e => (e.employeeName || '').toLowerCase().includes(search) || (e.id || '').toLowerCase().includes(search));
    if (status) list = list.filter(e => e.status === status);
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === undefined) av = '';
      if (bv === undefined) bv = '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  render() {
    const employees = EmployeeModule.getAll();
    const hasAny = employees.length > 0;
    document.getElementById('exitNoEmployeeGuard').hidden = hasAny;
    document.getElementById('exitMainArea').style.display = hasAny ? '' : 'none';
    if (!hasAny) return;

    const all = this.getAll();
    this.renderStatusStrip(all);
    document.getElementById('exitSearch').value = this.state.search;
    document.getElementById('filterExitStatus').value = this.state.status;

    const filtered = this.getFilteredSorted();
    document.getElementById('exitEmptyState').hidden = all.length !== 0;
    document.getElementById('exitTable').style.display = all.length === 0 ? 'none' : '';

    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('exitTableBody').innerHTML = pageItems.map(e => this.rowHtml(e)).join('');

    document.querySelectorAll('#exitTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort') ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('exitTableCount').textContent =
      filtered.length === 0 ? 'No exit records match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  renderStatusStrip(all) {
    const counts = { 'Pending Manager Approval': 0, 'Pending HR Approval': 0, Approved: 0, Rejected: 0 };
    all.forEach(e => { if (counts[e.status] !== undefined) counts[e.status]++; });
    const cleared = all.filter(e => e.clearanceStatus === 'Cleared').length;
    const strip = document.getElementById('exitStatusStrip');
    strip.innerHTML =
      '<div class="status-chip hold"><span class="status-chip-count">' + (counts['Pending Manager Approval'] + counts['Pending HR Approval']) + '</span><span class="status-chip-label">Pending Approval</span></div>' +
      '<div class="status-chip accepted"><span class="status-chip-count">' + counts.Approved + '</span><span class="status-chip-label">Approved</span></div>' +
      '<div class="status-chip closed"><span class="status-chip-count">' + counts.Rejected + '</span><span class="status-chip-label">Rejected</span></div>' +
      '<div class="status-chip open"><span class="status-chip-count">' + cleared + '</span><span class="status-chip-label">Cleared</span></div>';
  },

  rowHtml(e) {
    return '<tr data-id="' + Utils.escapeHtml(e.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(e.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(e.employeeName) + '</td>' +
      '<td>' + Utils.escapeHtml(e.department) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatDate(e.resignationDate) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatDate(e.lastWorkingDay) + '</td>' +
      '<td><span class="mini-progress-track"><span class="mini-progress-fill" style="width:' + e.clearancePercent + '%"></span></span> ' + e.clearancePercent + '%</td>' +
      '<td>' + this.statusBadge(e.status) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      '<button class="row-action-btn" data-action="view" data-id="' + Utils.escapeHtml(e.id) + '" title="View" aria-label="View"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/></svg></button>' +
      '<button class="row-action-btn" data-action="manage" data-id="' + Utils.escapeHtml(e.id) + '" title="Manage assets / interview" aria-label="Manage"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>' +
      '<button class="row-action-btn danger" data-action="delete" data-id="' + Utils.escapeHtml(e.id) + '" title="Delete" aria-label="Delete"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<button class="row-action-btn" data-action="more" data-id="' + Utils.escapeHtml(e.id) + '" title="More actions" aria-label="More actions"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/></svg></button>' +
      '</div></td></tr>';
  },

  bindRowActions() {
    document.querySelectorAll('#exitTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const record = this.getAll().find(x => x.id === id);
        if (!record) return;
        if (action === 'view') this.openView(record);
        if (action === 'manage') this.openExitForm(record);
        if (action === 'delete') this.handleDelete(id);
        if (action === 'more') {
          e.stopPropagation();
          const items = [];
          if (record.status === 'Pending Manager Approval') {
            items.push({ label: 'Manager Approve', onClick: () => this.changeStatus(id, 'Pending HR Approval') });
            items.push({ label: 'Manager Reject', danger: true, onClick: () => this.changeStatus(id, 'Rejected') });
          } else if (record.status === 'Pending HR Approval') {
            items.push({ label: 'HR Approve', onClick: () => this.changeStatus(id, 'Approved') });
            items.push({ label: 'HR Reject', danger: true, onClick: () => this.changeStatus(id, 'Rejected') });
          } else {
            items.push({ label: 'Reset to Pending (Manager)', onClick: () => this.changeStatus(id, 'Pending Manager Approval') });
          }
          RowMenu.open(btn, items);
        }
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('exitPagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.render();
      });
    });
  }
};

/* ---------------------------------------------------------------
   24. PHASE 15 — FULL & FINAL SETTLEMENT
   The deepest cross-module phase in the app: pulls the employee's
   salary structure from Payroll's own engine, attendance from
   Phase 10 for pending salary, Earned Leave balance from Phase 11
   for encashment, tenure from the Employee Master record's own
   creation date for gratuity eligibility, and the asset-return
   checklist from Exit Management for recovery suggestions.
--------------------------------------------------------------- */
const SettlementModule = {
  state: {
    search: '',
    status: '',
    sortKey: 'actualLastWorkingDay',
    sortDir: 'desc',
    page: 1,
    pageSize: 8,
    editingId: null
  },

  get COMPANY_NAME() { return CompanySettingsStore.get().name; },

  /* ---------- data access ---------- */
  getAll() {
    return Storage.get(STORAGE_KEYS.settlements, []);
  },
  saveAll(list) {
    return Storage.set(STORAGE_KEYS.settlements, list);
  },
  nextId() {
    const counter = Storage.get(STORAGE_KEYS.settlementCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.settlementCounter, counter);
    const year = new Date().getFullYear();
    return 'FNF-' + year + '-' + Utils.pad(counter, 4);
  },

  /* ---------- eligible: approved exits (clearance need not be 100% —
     unreturned assets instead feed the Other Recovery deduction below) ---------- */
  getEligibleExits() {
    return ExitModule.getAll().filter(e => e.status === 'Approved');
  },

  syncQueue() {
    const eligible = this.getEligibleExits();
    let list = this.getAll();
    const existingExitIds = new Set(list.map(s => s.exitId));
    let changed = false;

    eligible.forEach(exitRecord => {
      if (existingExitIds.has(exitRecord.id)) return;
      const employee = EmployeeModule.getAll().find(e => e.id === exitRecord.employeeId);
      if (!employee) return;
      // Pass undefined (not 0) for otherRecovery so computeSettlement falls through
      // to its asset-based suggestion instead of treating an explicit 0 as an override.
      list.push(this.computeSettlement(exitRecord, employee, exitRecord.lastWorkingDay, 0, 0, undefined));
      changed = true;
    });

    // Keep already-existing settlements' auto-calculated figures in sync with
    // anything changed afterward upstream (Attendance corrected, more assets
    // returned in Exit Management, Leave approved, etc.) — recompute() only
    // touches a record when its derived figures actually differ, and always
    // preserves status, manual overrides, and the original createdAt.
    const recomputedList = list.map(record => this.recompute(record));
    if (recomputedList.some((r, i) => r !== list[i])) changed = true;
    list = recomputedList;

    if (changed) this.saveAll(list);
    return list;
  },

  /* ---------- the deep cross-module calculation engine ---------- */
  perDayRate(salary) {
    return salary / 30;
  },

  computePendingSalary(employee, actualLastWorkingDay) {
    const month = actualLastWorkingDay.slice(0, 7);
    // Already paid through regular Payroll Processing for this month? Don't double-pay.
    const alreadyPaid = PayrollModule.getAll().some(p => p.employeeId === employee.id && p.month === month);
    if (alreadyPaid) {
      return { amount: 0, note: 'Already covered by Payroll Processing for ' + month };
    }
    const [year, mo] = month.split('-').map(Number);
    const lastDayNum = Number(actualLastWorkingDay.slice(8, 10));
    let payableDays = 0, workingDays = 0;
    for (let d = 1; d <= lastDayNum; d++) {
      const dateStr = year + '-' + Utils.pad(mo, 2) + '-' + Utils.pad(d, 2);
      if (AttendanceModule.isWeekend(dateStr) || AttendanceModule.isHoliday(dateStr)) continue;
      workingDays++;
      const status = AttendanceModule.getEffectiveStatus(employee.id, dateStr);
      if (status === 'Present' || status === 'Late Entry' || status === null) payableDays += 1;
      else if (status === 'Half Day') payableDays += 0.5;
      // Absent contributes 0
    }
    const amount = Math.round(payableDays * this.perDayRate(employee.salary));
    return { amount, note: payableDays + ' of ' + workingDays + ' working day(s) in ' + month + ' (from Attendance)' };
  },

  computeLeaveEncashment(employee) {
    const balance = LeaveModule.getBalance(employee, 'Earned');
    const days = balance === Infinity ? 0 : balance;
    return { days, amount: Math.round(days * this.perDayRate(employee.salary)) };
  },

  computeGratuity(employee, actualLastWorkingDay) {
    const joinedAt = employee.createdAt;
    const lastDay = new Date(actualLastWorkingDay + 'T00:00:00').getTime();
    const yearsOfService = (lastDay - joinedAt) / (365.25 * 86400000);
    const completedYears = Math.floor(yearsOfService) + (yearsOfService % 1 >= 0.5 ? 1 : 0);
    const eligible = completedYears >= SETTLEMENT.GRATUITY_MIN_YEARS;
    if (!eligible) return { eligible: false, years: Math.round(yearsOfService * 10) / 10, completedYears, amount: 0 };
    const structure = PayrollModule.computeStructure(employee.salary);
    const amount = Math.round((structure.basic + structure.da) * SETTLEMENT.GRATUITY_DAYS_PER_YEAR / SETTLEMENT.GRATUITY_MONTH_DIVISOR * completedYears);
    return { eligible: true, years: Math.round(yearsOfService * 10) / 10, completedYears, amount };
  },

  computeNoticeRecovery(employee, exitRecord, actualLastWorkingDay) {
    const shortfallDays = Math.max(0, Math.round(
      (new Date(exitRecord.lastWorkingDay + 'T00:00:00') - new Date(actualLastWorkingDay + 'T00:00:00')) / 86400000
    ));
    const amount = Math.round(shortfallDays * this.perDayRate(employee.salary));
    return { shortfallDays, amount };
  },

  suggestOtherRecovery(exitRecord) {
    const missing = ASSET_ITEMS.filter(a => !(exitRecord.assets && exitRecord.assets[a.key])).length;
    return { missingCount: missing, suggested: missing * SETTLEMENT.OTHER_RECOVERY_PER_MISSING_ASSET };
  },

  computeSettlement(exitRecord, employee, actualLastWorkingDay, bonus, loanRecovery, otherRecoveryOverride) {
    const pendingSalaryInfo = this.computePendingSalary(employee, actualLastWorkingDay);
    const leaveInfo = this.computeLeaveEncashment(employee);
    const gratuityInfo = this.computeGratuity(employee, actualLastWorkingDay);
    const noticeInfo = this.computeNoticeRecovery(employee, exitRecord, actualLastWorkingDay);
    const assetSuggestion = this.suggestOtherRecovery(exitRecord);
    const otherRecovery = otherRecoveryOverride !== undefined && otherRecoveryOverride !== null ? otherRecoveryOverride : assetSuggestion.suggested;

    const grossSettlement = pendingSalaryInfo.amount + leaveInfo.amount + bonus + gratuityInfo.amount;
    const totalRecovery = loanRecovery + noticeInfo.amount + otherRecovery;
    const now = Date.now();

    return {
      id: this.nextId(),
      exitId: exitRecord.id, employeeId: employee.id, employeeName: employee.name,
      department: employee.department, designation: employee.designation,
      exitLastWorkingDay: exitRecord.lastWorkingDay,
      actualLastWorkingDay,
      pendingSalary: pendingSalaryInfo.amount, pendingSalaryNote: pendingSalaryInfo.note,
      leaveEncashmentDays: leaveInfo.days, leaveEncashment: leaveInfo.amount,
      bonus,
      yearsOfService: gratuityInfo.years, gratuityEligible: gratuityInfo.eligible, gratuity: gratuityInfo.amount,
      grossSettlement,
      loanRecovery,
      noticeShortfallDays: noticeInfo.shortfallDays, noticeRecovery: noticeInfo.amount,
      otherRecovery, missingAssetsCount: assetSuggestion.missingCount,
      totalRecovery,
      netSettlement: grossSettlement - totalRecovery,
      status: 'Draft',
      createdAt: now, updatedAt: now
    };
  },

  recompute(record) {
    const exitRecord = ExitModule.getAll().find(e => e.id === record.exitId);
    const employee = EmployeeModule.getAll().find(e => e.id === record.employeeId);
    if (!exitRecord || !employee) return record;
    const fresh = this.computeSettlement(exitRecord, employee, record.actualLastWorkingDay, record.bonus, record.loanRecovery, record.otherRecovery);
    const watched = ['pendingSalary', 'leaveEncashment', 'gratuity', 'gratuityEligible', 'yearsOfService',
      'noticeRecovery', 'noticeShortfallDays', 'otherRecovery', 'missingAssetsCount',
      'grossSettlement', 'totalRecovery', 'netSettlement'];
    const hasChanged = watched.some(k => fresh[k] !== record[k]);
    if (!hasChanged) return record; // nothing upstream changed — keep the record exactly as-is
    fresh.id = record.id;
    fresh.status = record.status;
    fresh.createdAt = record.createdAt;
    fresh.updatedAt = Date.now();
    return fresh;
  },

  /* ---------- init ---------- */
  init() {
    this.bindToolbar();
    this.bindForm();
    this.bindModals();
  },

  bindToolbar() {
    const searchInput = document.getElementById('settlementSearch');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this.state.page = 1;
      this.render();
    }, 200));
    document.getElementById('filterSettlementStatus').addEventListener('change', (e) => {
      this.state.status = e.target.value;
      this.state.page = 1;
      this.render();
    });
    document.getElementById('clearSettlementFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.status = ''; this.state.page = 1;
      searchInput.value = '';
      document.getElementById('filterSettlementStatus').value = '';
      this.render();
    });
    document.querySelectorAll('#settlementTable thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-sort');
        if (this.state.sortKey === key) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortKey = key;
          this.state.sortDir = 'asc';
        }
        this.render();
      });
    });
  },

  bindModals() {
    document.getElementById('settlementModalCloseBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('settlementCancelBtn').addEventListener('click', () => this.closeForm());
    document.getElementById('settlementModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'settlementModalOverlay') this.closeForm();
    });
    document.getElementById('settlementPreviewCloseBtn').addEventListener('click', () => this.closePreview());
    document.getElementById('settlementPreviewCloseBtn2').addEventListener('click', () => this.closePreview());
    document.getElementById('settlementPreviewOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'settlementPreviewOverlay') this.closePreview();
    });
    document.getElementById('settlementPrintBtn').addEventListener('click', () => window.print());
    document.getElementById('settlementDownloadBtn').addEventListener('click', (e) => {
      PdfExport.downloadElement('settlementCertPaper', this.state.previewFilename || 'FNF-Settlement.pdf', e.currentTarget);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!document.getElementById('settlementModalOverlay').hidden) this.closeForm();
      if (!document.getElementById('settlementPreviewOverlay').hidden) this.closePreview();
    });
  },

  bindForm() {
    ['s_actualLastWorkingDay', 's_bonus', 's_loanRecovery', 's_otherRecovery'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.recalcLive());
      document.getElementById(id).addEventListener('change', () => this.recalcLive());
    });
    document.getElementById('settlementForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });
  },

  recalcLive() {
    const record = this.getAll().find(s => s.id === this.state.editingId);
    if (!record) return;
    const exitRecord = ExitModule.getAll().find(e => e.id === record.exitId);
    const employee = EmployeeModule.getAll().find(e => e.id === record.employeeId);
    if (!exitRecord || !employee) return;

    const actualLastWorkingDay = document.getElementById('s_actualLastWorkingDay').value || record.actualLastWorkingDay;
    const bonus = Number(document.getElementById('s_bonus').value) || 0;
    const loanRecovery = Number(document.getElementById('s_loanRecovery').value) || 0;
    const otherRecovery = Number(document.getElementById('s_otherRecovery').value) || 0;

    const fresh = this.computeSettlement(exitRecord, employee, actualLastWorkingDay, bonus, loanRecovery, otherRecovery);

    document.getElementById('s_pendingSalary').value = Utils.formatCurrency(fresh.pendingSalary);
    document.getElementById('s_pendingSalaryNote').textContent = fresh.pendingSalaryNote;
    document.getElementById('s_leaveEncashment').value = Utils.formatCurrency(fresh.leaveEncashment) + ' (' + fresh.leaveEncashmentDays + ' days)';
    document.getElementById('s_gratuity').value = fresh.gratuityEligible
      ? Utils.formatCurrency(fresh.gratuity) + ' (' + fresh.yearsOfService + ' yrs service)'
      : 'Not eligible (' + fresh.yearsOfService + ' yrs, needs 5+)';
    document.getElementById('s_grossSettlement').value = Utils.formatCurrency(fresh.grossSettlement);
    document.getElementById('s_noticeRecovery').value = Utils.formatCurrency(fresh.noticeRecovery) + (fresh.noticeShortfallDays ? ' (' + fresh.noticeShortfallDays + ' day shortfall)' : '');
    document.getElementById('s_totalRecovery').value = Utils.formatCurrency(fresh.totalRecovery);
    document.getElementById('s_netSettlementPreview').textContent = Utils.formatCurrency(fresh.netSettlement);
  },

  /* ---------- form open/close ---------- */
  openForm(record) {
    const form = document.getElementById('settlementForm');
    form.reset();
    this.state.editingId = record.id;

    const initials = (record.employeeName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    document.getElementById('settlementAvatarInitials').textContent = initials;
    document.getElementById('settlementEmployeeName').textContent = record.employeeName;
    document.getElementById('settlementEmployeeMeta').textContent = record.designation + ' · ' + record.department + ' · ' + record.id;
    document.getElementById('settlementModalTitle').textContent = 'Edit Settlement — ' + record.id;

    document.getElementById('s_exitLastWorkingDay').value = Utils.formatDate(record.exitLastWorkingDay);
    document.getElementById('s_actualLastWorkingDay').value = record.actualLastWorkingDay;
    document.getElementById('s_bonus').value = record.bonus;
    document.getElementById('s_loanRecovery').value = record.loanRecovery;
    document.getElementById('s_otherRecovery').value = record.otherRecovery;
    document.getElementById('s_status').value = record.status;

    this.recalcLive();
    document.getElementById('settlementModalOverlay').hidden = false;
  },

  closeForm() {
    document.getElementById('settlementModalOverlay').hidden = true;
  },

  handleSave() {
    const list = this.getAll();
    const idx = list.findIndex(s => s.id === this.state.editingId);
    if (idx === -1) return;
    const exitRecord = ExitModule.getAll().find(e => e.id === list[idx].exitId);
    const employee = EmployeeModule.getAll().find(e => e.id === list[idx].employeeId);
    if (!exitRecord || !employee) return;

    const actualLastWorkingDay = document.getElementById('s_actualLastWorkingDay').value;
    const bonus = Number(document.getElementById('s_bonus').value) || 0;
    const loanRecovery = Number(document.getElementById('s_loanRecovery').value) || 0;
    const otherRecovery = Number(document.getElementById('s_otherRecovery').value) || 0;
    const status = document.getElementById('s_status').value;

    const fresh = this.computeSettlement(exitRecord, employee, actualLastWorkingDay, bonus, loanRecovery, otherRecovery);
    fresh.id = list[idx].id;
    fresh.status = status;
    fresh.createdAt = list[idx].createdAt;
    list[idx] = fresh;

    this.saveAll(list);
    Activity.log('Settlement ' + fresh.id + ' (' + fresh.employeeName + ') updated — ' + status +
      (status === 'Settled' ? '. Employment lifecycle closed.' : ''));
    Toast.show('Settlement saved for ' + fresh.employeeName + '.', 'success');
    this.closeForm();
    this.render();
  },

  async handleDelete(id) {
    const list = this.getAll();
    const record = list.find(s => s.id === id);
    if (!record) return;
    const confirmed = await Confirm.ask(
      'Delete this settlement?',
      record.id + ' — ' + record.employeeName + '\u2019s settlement will be permanently removed. A fresh one will be regenerated since their exit is still Approved and Cleared.',
      'Delete'
    );
    if (!confirmed) return;
    this.saveAll(list.filter(s => s.id !== id));
    Activity.log('Settlement ' + record.id + ' (' + record.employeeName + ') deleted');
    Toast.show('Settlement deleted.', 'success');
    this.render();
  },

  openView(record) {
    document.getElementById('viewModalTitle').textContent = record.employeeName + ' — ' + record.id;
    document.getElementById('viewModalBody').innerHTML =
      '<div class="detail-grid">' +
      VacancyModule.detailItem('Settlement ID', record.id) +
      VacancyModule.detailItem('Status', this.statusBadge(record.status)) +
      VacancyModule.detailItem('Last Working Day', Utils.formatDate(record.actualLastWorkingDay)) +
      VacancyModule.detailItem('Years of Service', record.yearsOfService + ' yrs') +
      VacancyModule.detailItem('Pending Salary', Utils.formatCurrency(record.pendingSalary)) +
      VacancyModule.detailItem('Leave Encashment', Utils.formatCurrency(record.leaveEncashment) + ' (' + record.leaveEncashmentDays + ' days)') +
      VacancyModule.detailItem('Bonus', Utils.formatCurrency(record.bonus)) +
      VacancyModule.detailItem('Gratuity', record.gratuityEligible ? Utils.formatCurrency(record.gratuity) : 'Not eligible') +
      VacancyModule.detailItem('Gross Settlement', Utils.formatCurrency(record.grossSettlement)) +
      VacancyModule.detailItem('Loan Recovery', Utils.formatCurrency(record.loanRecovery)) +
      VacancyModule.detailItem('Notice Recovery', Utils.formatCurrency(record.noticeRecovery)) +
      VacancyModule.detailItem('Other Recovery', Utils.formatCurrency(record.otherRecovery)) +
      VacancyModule.detailItem('Total Recovery', Utils.formatCurrency(record.totalRecovery)) +
      VacancyModule.detailItem('Net Settlement', Utils.formatCurrency(record.netSettlement)) +
      '</div>';
    document.getElementById('viewModalOverlay').hidden = false;
  },

  /* ---------- settlement certificate ---------- */
  openPreview(record) {
    const employee = EmployeeModule.getAll().find(e => e.id === record.employeeId);
    document.getElementById('settlementPreviewTitle').textContent = 'Settlement Certificate — ' + record.id;
    document.getElementById('settlementCertPaper').innerHTML = this.renderCertificateHtml(record, employee);
    this.state.previewFilename = 'FNF-Settlement-' + record.employeeName.replace(/\s+/g, '-') + '.pdf';
    document.getElementById('settlementPreviewOverlay').hidden = false;
  },
  closePreview() {
    document.getElementById('settlementPreviewOverlay').hidden = true;
  },

  renderCertificateHtml(r, employee) {
    const line = (label, amount) => '<div class="payslip-line"><span>' + Utils.escapeHtml(label) + '</span><span>' + Utils.formatCurrency(amount) + '</span></div>';
    const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    return (
      '<div class="payslip-header">' +
      '<div class="payslip-logo-mark">ST</div>' +
      '<div class="payslip-company-block"><div class="payslip-company-name">' + Utils.escapeHtml(this.COMPANY_NAME) + '</div>' +
      '<div class="payslip-company-tagline">Full &amp; Final Settlement Certificate</div></div>' +
      '<div class="payslip-meta-label" style="text-align:right;">Issued<br/><strong style="color:#1b2430;font-size:13px;">' + issueDate + '</strong></div>' +
      '</div>' +
      '<div class="payslip-meta-grid">' +
      '<div><div class="payslip-meta-label">Employee</div><div class="payslip-meta-value">' + Utils.escapeHtml(r.employeeName) + '</div></div>' +
      '<div><div class="payslip-meta-label">Employee ID</div><div class="payslip-meta-value">' + Utils.escapeHtml(r.employeeId) + '</div></div>' +
      '<div><div class="payslip-meta-label">Designation</div><div class="payslip-meta-value">' + Utils.escapeHtml(r.designation) + '</div></div>' +
      '<div><div class="payslip-meta-label">Department</div><div class="payslip-meta-value">' + Utils.escapeHtml(r.department) + '</div></div>' +
      '<div><div class="payslip-meta-label">Last Working Day</div><div class="payslip-meta-value">' + Utils.formatDate(r.actualLastWorkingDay) + '</div></div>' +
      '<div><div class="payslip-meta-label">Years of Service</div><div class="payslip-meta-value">' + r.yearsOfService + ' yrs</div></div>' +
      '</div>' +
      '<div class="payslip-columns">' +
      '<div><div class="payslip-col-title">Payable</div>' +
      line('Pending Salary', r.pendingSalary) + line('Leave Encashment', r.leaveEncashment) + line('Bonus', r.bonus) + line('Gratuity', r.gratuity) +
      '<div class="payslip-line total"><span>Gross Settlement</span><span>' + Utils.formatCurrency(r.grossSettlement) + '</span></div></div>' +
      '<div><div class="payslip-col-title">Recoveries</div>' +
      line('Loan Recovery', r.loanRecovery) + line('Notice Recovery', r.noticeRecovery) + line('Other Recovery', r.otherRecovery) +
      '<div class="payslip-line total"><span>Total Recovery</span><span>' + Utils.formatCurrency(r.totalRecovery) + '</span></div></div>' +
      '</div>' +
      '<div class="payslip-netpay-box' + (r.netSettlement < 0 ? ' negative' : '') + '"><span>Net Settlement</span><span class="payslip-netpay-amount">' + Utils.formatCurrency(r.netSettlement) + '</span></div>' +
      '<div class="payslip-footer-row">' +
      '<div class="payslip-qr-placeholder">QR CODE<br/>PLACEHOLDER</div>' +
      '<div style="text-align:right;"><div class="offer-letter-sign-line" style="margin-top:0;">' +
      '<div class="offer-letter-sign-name">Midhun Das</div><div class="offer-letter-sign-title">Accounting Expert (Digital Signature)</div></div></div>' +
      '</div>' +
      '<p style="font-size:10.5px;color:#8a94a3;margin-top:14px;">This certifies that the full and final settlement for the above employee has been computed and processed. System-generated from the SKELORA training simulator.</p>'
    );
  },

  /* ---------- rendering ---------- */
  statusBadge(status) {
    const map = { 'Draft': 'badge-neutral', 'Processed': 'badge-info', 'Settled': 'badge-success' };
    return '<span class="badge ' + (map[status] || 'badge-neutral') + '">' + Utils.escapeHtml(status) + '</span>';
  },

  getFilteredSorted() {
    let list = this.syncQueue();
    const { search, status, sortKey, sortDir } = this.state;
    if (search) list = list.filter(s => (s.employeeName || '').toLowerCase().includes(search) || (s.id || '').toLowerCase().includes(search));
    if (status) list = list.filter(s => s.status === status);
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (av === undefined) av = '';
      if (bv === undefined) bv = '';
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return list;
  },

  render() {
    const eligible = this.getEligibleExits();
    const hasAny = eligible.length > 0 || this.getAll().length > 0;
    document.getElementById('settlementNoDataGuard').hidden = hasAny;
    document.getElementById('settlementMainArea').style.display = hasAny ? '' : 'none';
    if (!hasAny) return;

    const all = this.syncQueue();
    this.renderStatusStrip(all);
    document.getElementById('settlementSearch').value = this.state.search;
    document.getElementById('filterSettlementStatus').value = this.state.status;

    const filtered = this.getFilteredSorted();
    document.getElementById('settlementEmptyState').hidden = filtered.length !== 0;

    const totalPages = Math.max(1, Math.ceil(filtered.length / this.state.pageSize));
    if (this.state.page > totalPages) this.state.page = totalPages;
    const start = (this.state.page - 1) * this.state.pageSize;
    const pageItems = filtered.slice(start, start + this.state.pageSize);

    document.getElementById('settlementTableBody').innerHTML = pageItems.map(s => this.rowHtml(s)).join('');

    document.querySelectorAll('#settlementTable thead th[data-sort]').forEach(th => {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === this.state.sortKey);
      const arrow = this.state.sortKey === th.getAttribute('data-sort') ? (this.state.sortDir === 'asc' ? '▲' : '▼') : '▲';
      th.innerHTML = th.textContent.replace(/[▲▼]/g, '').trim() + ' <span class="sort-arrow">' + arrow + '</span>';
    });

    document.getElementById('settlementTableCount').textContent =
      filtered.length === 0 ? 'No settlements match your filters' :
      'Showing ' + (start + 1) + '–' + Math.min(start + this.state.pageSize, filtered.length) + ' of ' + filtered.length;

    this.renderPagination(totalPages);
    this.bindRowActions();
  },

  renderStatusStrip(all) {
    const counts = { Draft: 0, Processed: 0, Settled: 0 };
    let totalNet = 0;
    all.forEach(s => { if (counts[s.status] !== undefined) counts[s.status]++; totalNet += s.netSettlement; });
    const strip = document.getElementById('settlementStatusStrip');
    strip.innerHTML =
      this.chip('pending', 'Draft', counts.Draft) +
      this.chip('screening', 'Processed', counts.Processed) +
      this.chip('accepted', 'Settled', counts.Settled) +
      '<div class="status-chip open"><span class="status-chip-count">' + Utils.formatCurrency(totalNet) + '</span><span class="status-chip-label">Total Net Settlements</span></div>';
  },

  chip(cls, label, count) {
    return '<div class="status-chip ' + cls + '"><span class="status-chip-count">' + count +
      '</span><span class="status-chip-label">' + label + '</span></div>';
  },

  rowHtml(s) {
    return '<tr data-id="' + Utils.escapeHtml(s.id) + '">' +
      '<td><span class="id-badge">' + Utils.escapeHtml(s.id) + '</span></td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(s.employeeName) + '</td>' +
      '<td>' + Utils.escapeHtml(s.department) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatDate(s.actualLastWorkingDay) + '</td>' +
      '<td class="cell-primary">' + Utils.formatCurrency(s.netSettlement) + '</td>' +
      '<td>' + this.statusBadge(s.status) + '</td>' +
      '<td class="col-actions"><div class="row-actions">' +
      '<button class="row-action-btn" data-action="view" data-id="' + Utils.escapeHtml(s.id) + '" title="View" aria-label="View"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/></svg></button>' +
      '<button class="row-action-btn" data-action="edit" data-id="' + Utils.escapeHtml(s.id) + '" title="Edit" aria-label="Edit"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>' +
      '<button class="row-action-btn" data-action="certificate" data-id="' + Utils.escapeHtml(s.id) + '" title="Settlement Certificate" aria-label="Settlement Certificate"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M7 3h10l2 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7l2-4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>' +
      '<button class="row-action-btn danger" data-action="delete" data-id="' + Utils.escapeHtml(s.id) + '" title="Delete" aria-label="Delete"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '</div></td></tr>';
  },

  bindRowActions() {
    document.querySelectorAll('#settlementTableBody .row-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const record = this.getAll().find(s => s.id === id);
        if (!record) return;
        if (action === 'view') this.openView(record);
        if (action === 'edit') this.openForm(record);
        if (action === 'certificate') this.openPreview(record);
        if (action === 'delete') this.handleDelete(id);
      });
    });
  },

  renderPagination(totalPages) {
    const el = document.getElementById('settlementPagination');
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    let html = '';
    html += '<button class="page-btn" data-page="prev" ' + (this.state.page === 1 ? 'disabled' : '') + '>‹</button>';
    for (let i = 1; i <= totalPages; i++) {
      html += '<button class="page-btn' + (i === this.state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="page-btn" data-page="next" ' + (this.state.page === totalPages ? 'disabled' : '') + '>›</button>';
    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        if (p === 'prev') this.state.page = Math.max(1, this.state.page - 1);
        else if (p === 'next') this.state.page = Math.min(totalPages, this.state.page + 1);
        else this.state.page = Number(p);
        this.render();
      });
    });
  }
};

/* ---------------------------------------------------------------
   24B. MANAGER SELF-SERVICE — "My Team"
--------------------------------------------------------------- */
const ManagerModule = {
  icon(svgInner) { return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none">' + svgInner + '</svg>'; },

  init() {
    document.getElementById('myTeamApprovalsTableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-leave-action]');
      if (!btn) return;
      const leaveId = btn.getAttribute('data-leave-id');
      const action = btn.getAttribute('data-leave-action');
      LeaveModule.changeStatus(leaveId, action === 'approve' ? 'Pending HR Approval' : 'Rejected');
      this.render();
    });
  },

  getMyReports() {
    const session = Auth.getSession();
    if (!session || !session.employeeId) return [];
    return EmployeeModule.getAll().filter(e => e.reportingManagerId === session.employeeId && e.status === 'Active');
  },

  render() {
    const session = Auth.getSession();
    const reports = this.getMyReports();
    document.getElementById('myTeamGreeting').textContent = 'My Team' + (session && session.displayName ? ' — ' + session.displayName : '');

    const reportIds = new Set(reports.map(e => e.id));
    const pending = LeaveModule.getAll().filter(l => reportIds.has(l.employeeId) && l.status === 'Pending Manager Approval');

    document.getElementById('myTeamApprovalsEmpty').hidden = pending.length > 0;
    document.getElementById('myTeamApprovalsTable').style.display = pending.length ? '' : 'none';
    document.getElementById('myTeamApprovalsTableBody').innerHTML = pending.map(l =>
      '<tr><td class="cell-primary">' + Utils.escapeHtml(l.employeeName) + '</td>' +
      '<td>' + Utils.escapeHtml(l.leaveType) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatDate(l.startDate) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatDate(l.endDate) + '</td>' +
      '<td>' + l.days + '</td>' +
      '<td class="col-actions">' +
      '<button class="btn btn-secondary btn-sm" data-leave-action="approve" data-leave-id="' + Utils.escapeHtml(l.id) + '">Approve</button> ' +
      '<button class="btn btn-danger-ghost btn-sm" data-leave-action="reject" data-leave-id="' + Utils.escapeHtml(l.id) + '">Reject</button>' +
      '</td></tr>'
    ).join('');

    const today = Utils.todayStr();
    let present = 0, absent = 0, onLeave = 0, other = 0;
    reports.forEach(e => {
      const onLeaveToday = LeaveModule.getAll().some(l => l.employeeId === e.id && l.status === 'Approved' && l.startDate <= today && l.endDate >= today);
      if (onLeaveToday) { onLeave++; return; }
      const status = AttendanceModule.getEffectiveStatus(e.id, today);
      if (status === 'Present' || status === 'Late Entry') present++;
      else if (status === 'Absent') absent++;
      else other++;
    });
    const cards = [
      { label: 'Team Size', value: String(reports.length), color: 'var(--info)', bg: 'var(--info-bg)', icon: ICONS.employee },
      { label: 'Present Today', value: String(present), color: 'var(--success)', bg: 'var(--success-bg)', icon: ICONS.attendance },
      { label: 'On Leave Today', value: String(onLeave), color: 'var(--warning)', bg: 'var(--warning-bg)', icon: ICONS.leave },
      { label: 'Absent Today', value: String(absent), color: 'var(--danger)', bg: 'var(--danger-bg)', icon: ICONS.attendance }
    ];
    document.getElementById('myTeamAttendanceKpis').innerHTML = cards.map(c =>
      '<div class="kpi-card"><div class="kpi-top"><span class="kpi-label">' + c.label + '</span>' +
      '<span class="kpi-icon" style="background:' + c.bg + ';color:' + c.color + '">' + this.icon(c.icon) + '</span></div>' +
      '<div class="kpi-value">' + c.value + '</div></div>'
    ).join('');

    document.getElementById('myTeamRosterEmpty').hidden = reports.length > 0;
    document.getElementById('myTeamRosterTable').style.display = reports.length ? '' : 'none';
    document.getElementById('myTeamRosterTableBody').innerHTML = reports.map(e =>
      '<tr><td class="cell-primary">' + Utils.escapeHtml(e.name) + '</td>' +
      '<td class="cell-secondary">' + Utils.escapeHtml(e.designation) + '</td>' +
      '<td class="cell-secondary">' + Utils.escapeHtml(e.department) + '</td>' +
      '<td><span class="badge badge-success">' + Utils.escapeHtml(e.status) + '</span></td></tr>'
    ).join('');
  }
};

/* ---------------------------------------------------------------
   24C. EMPLOYEE SELF-SERVICE — "My Workspace"
--------------------------------------------------------------- */
const SelfServiceModule = {
  init() {
    document.getElementById('myWorkspaceApplyLeaveBtn').addEventListener('click', () => {
      const session = Auth.getSession();
      if (session && session.employeeId) LeaveModule.openApplyForm(session.employeeId);
    });
    document.getElementById('myWorkspaceForm16Btn').addEventListener('click', () => {
      const session = Auth.getSession();
      if (!session || !session.employeeId) return;
      const employee = EmployeeModule.getAll().find(e => e.id === session.employeeId);
      if (!employee) return;
      const fys = SalarySlipModule.getAvailableFYs().filter(fy =>
        PayrollModule.getAll().some(p => p.employeeId === employee.id && SalarySlipModule.monthToFY(p.month) === fy));
      if (!fys.length) { Toast.show('No payslips on record yet.', 'error'); return; }
      const fy = fys[0];
      const months = new Set(SalarySlipModule.fyToMonths(fy));
      const records = PayrollModule.getAll().filter(p => p.employeeId === employee.id && months.has(p.month)).sort((a, b) => a.month.localeCompare(b.month));
      const data = SalarySlipModule.computeForm16Data(employee, fy, records);
      document.getElementById('payslipPreviewTitle').textContent = 'Form 16 — ' + employee.name + ' — FY ' + fy;
      document.getElementById('payslipPaper').innerHTML = SalarySlipModule.renderForm16Html(data);
      SalarySlipModule.state.previewFilename = 'Form16-' + employee.name.replace(/\s+/g, '-') + '-FY' + fy + '.pdf';
      document.getElementById('payslipPreviewOverlay').hidden = false;
    });
    document.getElementById('myPayslipsTableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-payslip-id]');
      if (!btn) return;
      const record = PayrollModule.getAll().find(p => p.id === btn.getAttribute('data-payslip-id'));
      if (record) SalarySlipModule.openPreview(record);
    });
  },

  render() {
    const session = Auth.getSession();
    if (!session || !session.employeeId) return;
    const employee = EmployeeModule.getAll().find(e => e.id === session.employeeId);
    if (!employee) {
      document.getElementById('myWorkspaceGreeting').textContent = 'My Workspace';
      document.getElementById('myProfileGrid').innerHTML =
        '<p class="muted-text">Your login is no longer linked to an active employee record. Contact HR or your administrator.</p>';
      document.getElementById('myLeaveBalanceKpis').innerHTML = '';
      document.getElementById('myLeaveHistoryTableBody').innerHTML = '<tr><td colspan="5" class="muted-text">Not available.</td></tr>';
      document.getElementById('myPayslipsEmpty').hidden = true;
      document.getElementById('myPayslipsTable').style.display = 'none';
      document.getElementById('myPayslipsTableBody').innerHTML = '';
      document.getElementById('myWorkspaceApplyLeaveBtn').disabled = true;
      document.getElementById('myWorkspaceForm16Btn').disabled = true;
      return;
    }
    document.getElementById('myWorkspaceApplyLeaveBtn').disabled = false;
    document.getElementById('myWorkspaceForm16Btn').disabled = false;
    document.getElementById('myWorkspaceGreeting').textContent = 'My Workspace — ' + employee.name;

    document.getElementById('myProfileGrid').innerHTML = [
      ['Employee ID', employee.id], ['Designation', employee.designation], ['Department', employee.department],
      ['Official Email', employee.officialEmail || '—'], ['Reporting Manager', employee.manager || '—'],
      ['Status', employee.status]
    ].map(([label, value]) =>
      '<div><div class="payslip-meta-label">' + Utils.escapeHtml(label) + '</div><div class="payslip-meta-value">' + Utils.escapeHtml(String(value)) + '</div></div>'
    ).join('');

    const balanceTypes = ['Casual', 'Sick', 'Earned'];
    document.getElementById('myLeaveBalanceKpis').innerHTML = balanceTypes.map(t => {
      const bal = LeaveModule.getBalance(employee, t);
      return '<div class="kpi-card"><div class="kpi-top"><span class="kpi-label">' + t + ' Leave</span></div>' +
        '<div class="kpi-value">' + (bal === Infinity ? '∞' : bal) + '</div></div>';
    }).join('');

    const myLeaves = LeaveModule.getAll().filter(l => l.employeeId === employee.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
    document.getElementById('myLeaveHistoryTableBody').innerHTML = myLeaves.length ? myLeaves.map(l =>
      '<tr><td>' + Utils.escapeHtml(l.leaveType) + '</td><td class="cell-secondary">' + Utils.formatDate(l.startDate) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatDate(l.endDate) + '</td><td>' + l.days + '</td>' +
      '<td>' + LeaveModule.statusBadge(l.status) + '</td></tr>'
    ).join('') : '<tr><td colspan="5" class="muted-text">No leave applications yet.</td></tr>';

    const myPayslips = PayrollModule.getAll().filter(p => p.employeeId === employee.id).sort((a, b) => b.month.localeCompare(a.month));
    document.getElementById('myPayslipsEmpty').hidden = myPayslips.length > 0;
    document.getElementById('myPayslipsTable').style.display = myPayslips.length ? '' : 'none';
    document.getElementById('myPayslipsTableBody').innerHTML = myPayslips.map(p =>
      '<tr><td class="cell-primary">' + Utils.escapeHtml(p.month) + '</td>' +
      '<td>' + Utils.formatCurrency(p.grossSalary) + '</td>' +
      '<td>' + Utils.formatCurrency(p.totalDeductions) + '</td>' +
      '<td class="cell-primary">' + Utils.formatCurrency(p.netSalary) + '</td>' +
      '<td class="col-actions"><button class="btn btn-ghost btn-sm" data-payslip-id="' + Utils.escapeHtml(p.id) + '">View</button></td></tr>'
    ).join('');
  }
};

/* ---------------------------------------------------------------
   24D. REPORTS & ANALYTICS (Admin + HR)
--------------------------------------------------------------- */
const ReportsModule = {
  init() {
    document.getElementById('exportEmployeesCsvBtn').addEventListener('click', () => this.exportEmployeesCsv());
    document.getElementById('exportPayrollCsvBtn').addEventListener('click', () => this.exportPayrollCsv());
    document.getElementById('exportBankAdviceBtn').addEventListener('click', () => this.exportBankAdvice());
    document.getElementById('exportLeaveCsvBtn').addEventListener('click', () => this.exportLeaveCsv());
  },

  downloadCsv(filename, rows) {
    const csv = rows.map(row => row.map(cell => {
      const s = String(cell === null || cell === undefined ? '' : cell);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  exportEmployeesCsv() {
    const rows = [['Employee ID', 'Name', 'Department', 'Designation', 'Status', 'Official Email', 'Salary', 'PAN', 'State', 'Tax Regime', 'Reporting Manager']];
    EmployeeModule.getAll().forEach(e => rows.push([e.id, e.name, e.department, e.designation, e.status, e.officialEmail, e.salary, e.pan, e.state, e.taxRegime, e.manager || '']));
    this.downloadCsv('employee-master.csv', rows);
    AuditLog.log('Reports', 'Exported', 'Employee Master', (rows.length - 1) + ' record(s)');
  },

  exportPayrollCsv() {
    const month = document.getElementById('exportPayrollMonthSelect').value;
    const records = PayrollModule.getAll().filter(p => p.month === month);
    const rows = [['Payroll ID', 'Employee', 'Month', 'Gross', 'PF', 'ESI', 'Professional Tax', 'Income Tax', 'Total Deductions', 'Net Salary', 'Status']];
    records.forEach(p => rows.push([p.id, p.employeeName, p.month, p.grossSalary, p.pf, p.esi, p.professionalTax, p.incomeTax, p.totalDeductions, p.netSalary, p.status]));
    this.downloadCsv('payroll-register-' + (month || 'all') + '.csv', rows);
    AuditLog.log('Reports', 'Exported', 'Payroll Register (' + month + ')', (rows.length - 1) + ' record(s)');
  },

  exportBankAdvice() {
    const month = document.getElementById('exportPayrollMonthSelect').value;
    if (!month) { Toast.show('No payroll month available to export.', 'error'); return; }
    const records = PayrollModule.getAll().filter(p => p.month === month);
    const employees = EmployeeModule.getAll();
    const company = CompanySettingsStore.get();
    const rows = [['Sl No', 'Beneficiary Name', 'Bank Name', 'Account Number', 'IFSC Code', 'Amount (INR)', 'Transfer Mode', 'Narration']];
    let total = 0;
    records.forEach((p, i) => {
      const emp = employees.find(e => e.id === p.employeeId) || {};
      total += p.netSalary;
      rows.push([
        i + 1, p.employeeName, emp.bankName || '', emp.accountNumber || '', (emp.ifsc || '').toUpperCase(),
        p.netSalary, p.netSalary > 200000 ? 'RTGS' : 'NEFT', 'Salary for ' + month + ' - ' + (company.name || '')
      ]);
    });
    rows.push(['', 'TOTAL', '', '', '', total, '', '']);
    this.downloadCsv('bank-transfer-advice-' + (month || 'all') + '.csv', rows);
    AuditLog.log('Reports', 'Exported', 'Bank Transfer Advice (' + month + ')', records.length + ' beneficiary(ies), total ' + Utils.formatCurrency(total));
  },

  exportLeaveCsv() {
    const rows = [['Leave ID', 'Employee', 'Type', 'From', 'To', 'Days', 'Status']];
    LeaveModule.getAll().forEach(l => rows.push([l.id, l.employeeName, l.leaveType, l.startDate, l.endDate, l.days, l.status]));
    this.downloadCsv('leave-register.csv', rows);
    AuditLog.log('Reports', 'Exported', 'Leave Register', (rows.length - 1) + ' record(s)');
  },

  render() {
    const employees = EmployeeModule.getAll();
    const active = employees.filter(e => e.status === 'Active');
    const payrollRecords = PayrollModule.getAll();
    const months = [...new Set(payrollRecords.map(p => p.month))].sort();
    const latestMonth = months[months.length - 1];
    const latestMonthCost = latestMonth ? payrollRecords.filter(p => p.month === latestMonth).reduce((a, p) => a + p.netSalary, 0) : 0;
    const avgCTC = active.length ? Math.round(active.reduce((a, e) => a + (Number(e.salary) || 0) * 12, 0) / active.length) : 0;
    const attritionCount = ExitModule.getAll().length;

    document.getElementById('reportsKpis').innerHTML = [
      { label: 'Active Employees', value: String(active.length) },
      { label: latestMonth ? 'Payroll Cost (' + latestMonth + ')' : 'Payroll Cost', value: Utils.formatCurrency(latestMonthCost) },
      { label: 'Average CTC (Annual)', value: Utils.formatCurrency(avgCTC) },
      { label: 'Total Exits Filed', value: String(attritionCount) }
    ].map(c => '<div class="kpi-card"><div class="kpi-top"><span class="kpi-label">' + c.label + '</span></div><div class="kpi-value">' + c.value + '</div></div>').join('');

    const deptCounts = {};
    active.forEach(e => { deptCounts[e.department] = (deptCounts[e.department] || 0) + 1; });
    const maxDept = Math.max(1, ...Object.values(deptCounts), 0);
    const deptEntries = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);
    document.getElementById('reportsDeptChart').innerHTML = deptEntries.length ? deptEntries.map(([dept, count]) =>
      '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span>' + Utils.escapeHtml(dept) + '</span><span class="muted-text">' + count + '</span></div>' +
      '<div style="background:var(--border-color);border-radius:4px;height:8px;overflow:hidden;"><div style="width:' + (count / maxDept * 100) + '%;background:var(--accent-blue-light);height:100%;"></div></div></div>'
    ).join('') : '<p class="muted-text">No active employees yet.</p>';

    const trendMonths = months.slice(-12);
    const monthTotals = trendMonths.map(m => payrollRecords.filter(p => p.month === m).reduce((a, p) => a + p.netSalary, 0));
    const maxMonth = Math.max(1, ...monthTotals, 0);
    document.getElementById('reportsPayrollTrend').innerHTML = trendMonths.length ? trendMonths.map((m, i) =>
      '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span>' + m + '</span><span class="muted-text">' + Utils.formatCurrency(monthTotals[i]) + '</span></div>' +
      '<div style="background:var(--border-color);border-radius:4px;height:8px;overflow:hidden;"><div style="width:' + (monthTotals[i] / maxMonth * 100) + '%;background:var(--success);height:100%;"></div></div></div>'
    ).join('') : '<p class="muted-text">No payroll runs yet.</p>';

    const select = document.getElementById('exportPayrollMonthSelect');
    select.innerHTML = months.length ? months.slice().reverse().map(m => '<option value="' + m + '">' + m + '</option>').join('') : '<option value="">No payroll runs</option>';
  }
};

/* ---------------------------------------------------------------
   24E. AUDIT LOG VIEW (Admin only)
--------------------------------------------------------------- */
const AuditViewModule = {
  state: { search: '', module: '' },

  init() {
    document.getElementById('auditSearch').addEventListener('input', (e) => {
      this.state.search = e.target.value.toLowerCase();
      this.render();
    });
    document.getElementById('filterAuditModule').addEventListener('change', (e) => {
      this.state.module = e.target.value;
      this.render();
    });
    document.getElementById('clearAuditFiltersBtn').addEventListener('click', () => {
      this.state.search = ''; this.state.module = '';
      document.getElementById('auditSearch').value = '';
      document.getElementById('filterAuditModule').value = '';
      this.render();
    });
    document.getElementById('exportAuditCsvBtn').addEventListener('click', () => {
      const rows = [['Time', 'User', 'Role', 'Module', 'Action', 'Target', 'Detail']];
      AuditLog.getAll().forEach(e => rows.push([new Date(e.ts).toLocaleString('en-IN'), e.user, e.role, e.module, e.action, e.target, e.detail]));
      ReportsModule.downloadCsv('audit-log.csv', rows);
    });
  },

  render() {
    let entries = AuditLog.getAll();
    const modules = [...new Set(entries.map(e => e.module))].sort();
    const moduleSelect = document.getElementById('filterAuditModule');
    moduleSelect.innerHTML = '<option value="">All Modules</option>' +
      modules.map(m => '<option value="' + Utils.escapeHtml(m) + '">' + Utils.escapeHtml(m) + '</option>').join('');
    moduleSelect.value = this.state.module;

    if (this.state.module) entries = entries.filter(e => e.module === this.state.module);
    if (this.state.search) {
      entries = entries.filter(e =>
        (e.user || '').toLowerCase().includes(this.state.search) || (e.target || '').toLowerCase().includes(this.state.search));
    }

    document.getElementById('auditEmptyState').hidden = entries.length > 0;
    document.getElementById('auditTable').style.display = entries.length ? '' : 'none';
    document.getElementById('auditTableBody').innerHTML = entries.map(e =>
      '<tr><td class="cell-secondary">' + Utils.timeAgo(e.ts) + '</td>' +
      '<td class="cell-primary">' + Utils.escapeHtml(e.user) + '</td>' +
      '<td>' + Utils.escapeHtml(e.role) + '</td>' +
      '<td>' + Utils.escapeHtml(e.module) + '</td>' +
      '<td>' + Utils.escapeHtml(e.action) + '</td>' +
      '<td class="cell-secondary">' + Utils.escapeHtml(e.target) + '</td>' +
      '<td class="cell-secondary">' + Utils.escapeHtml(e.detail) + '</td></tr>'
    ).join('');
  }
};

/* ---------------------------------------------------------------
   24F. COMPLIANCE CALENDAR (Admin + HR)
--------------------------------------------------------------- */
const ComplianceModule = {
  getOccurrences() {
    const today = new Date();
    const occurrences = [];

    COMPLIANCE_RULES.forEach(rule => {
      if (rule.frequency === 'monthly') {
        for (let offset = -1; offset <= 1; offset++) {
          const payrollDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
          const dueDate = new Date(payrollDate.getFullYear(), payrollDate.getMonth() + 1, rule.dueDay);
          occurrences.push({
            ruleId: rule.id, title: rule.title, category: rule.category, description: rule.description,
            periodLabel: payrollDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
            periodKey: payrollDate.getFullYear() + '-' + Utils.pad(payrollDate.getMonth() + 1, 2),
            dueDate: Utils.pad(dueDate.getDate(), 2) + '-' + Utils.pad(dueDate.getMonth() + 1, 2) + '-' + dueDate.getFullYear(),
            dueDateSort: dueDate.getFullYear() + '-' + Utils.pad(dueDate.getMonth() + 1, 2) + '-' + Utils.pad(dueDate.getDate(), 2)
          });
        }
      } else if (rule.frequency === 'annual-fixed') {
        let year = today.getFullYear();
        let candidate = new Date(year, rule.month - 1, rule.day);
        const sixtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 60);
        if (candidate < sixtyDaysAgo) { year += 1; candidate = new Date(year, rule.month - 1, rule.day); }
        occurrences.push({
          ruleId: rule.id, title: rule.title, category: rule.category, description: rule.description,
          periodLabel: String(year),
          periodKey: 'ANNUAL-' + year,
          dueDate: Utils.pad(candidate.getDate(), 2) + '-' + Utils.pad(candidate.getMonth() + 1, 2) + '-' + candidate.getFullYear(),
          dueDateSort: candidate.getFullYear() + '-' + Utils.pad(candidate.getMonth() + 1, 2) + '-' + Utils.pad(candidate.getDate(), 2)
        });
      }
    });

    occurrences.sort((a, b) => a.dueDateSort.localeCompare(b.dueDateSort));
    return occurrences;
  },

  getFiledRecord(ruleId, periodKey) {
    return Storage.get(STORAGE_KEYS.complianceLog, []).find(r => r.ruleId === ruleId && r.periodKey === periodKey);
  },

  markFiled(ruleId, periodKey, title) {
    const logs = Storage.get(STORAGE_KEYS.complianceLog, []);
    const session = Auth.getSession();
    logs.push({ ruleId, periodKey, filedOn: Utils.todayStr(), filedBy: session ? session.displayName : 'System' });
    Storage.set(STORAGE_KEYS.complianceLog, logs);
    AuditLog.log('Compliance', 'Marked Filed', title, 'Period: ' + periodKey);
  },

  unmarkFiled(ruleId, periodKey) {
    const logs = Storage.get(STORAGE_KEYS.complianceLog, []).filter(r => !(r.ruleId === ruleId && r.periodKey === periodKey));
    Storage.set(STORAGE_KEYS.complianceLog, logs);
  },

  init() {
    document.getElementById('complianceTableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-comp-action]');
      if (!btn) return;
      const ruleId = btn.getAttribute('data-rule-id');
      const periodKey = btn.getAttribute('data-period-key');
      if (btn.getAttribute('data-comp-action') === 'file') {
        this.markFiled(ruleId, periodKey, btn.getAttribute('data-title'));
      } else {
        this.unmarkFiled(ruleId, periodKey);
      }
      this.render();
    });
  },

  render() {
    const todayStr = Utils.todayStr();
    const occurrences = this.getOccurrences();
    document.getElementById('complianceTableBody').innerHTML = occurrences.map(o => {
      const filed = this.getFiledRecord(o.ruleId, o.periodKey);
      const overdue = !filed && o.dueDateSort < todayStr;
      const statusHtml = filed
        ? '<span class="badge badge-success">Filed ' + Utils.formatDate(filed.filedOn) + '</span>'
        : (overdue ? '<span class="badge badge-danger">Overdue</span>' : '<span class="badge badge-warning">Pending</span>');
      const actionHtml = filed
        ? '<button class="btn btn-ghost btn-sm" data-comp-action="unfile" data-rule-id="' + o.ruleId + '" data-period-key="' + o.periodKey + '">Undo</button>'
        : '<button class="btn btn-secondary btn-sm" data-comp-action="file" data-rule-id="' + o.ruleId + '" data-period-key="' + o.periodKey + '" data-title="' + Utils.escapeHtml(o.title) + '">Mark as Filed</button>';
      return '<tr' + (overdue ? ' style="background:var(--danger-bg);"' : '') + '>' +
        '<td>' + Utils.escapeHtml(o.category) + '</td>' +
        '<td class="cell-primary">' + Utils.escapeHtml(o.title) + '<div class="muted-text" style="font-size:11px;margin-top:2px;font-weight:400;">' + Utils.escapeHtml(o.description) + '</div></td>' +
        '<td class="cell-secondary">' + Utils.escapeHtml(o.periodLabel) + '</td>' +
        '<td class="cell-secondary">' + o.dueDate + '</td>' +
        '<td>' + statusHtml + '</td>' +
        '<td class="col-actions">' + actionHtml + '</td></tr>';
    }).join('');
  }
};

/* ---------------------------------------------------------------
   24G. LETTERS GENERATOR (Admin + HR) — increment, promotion,
   warning, relieving, experience certificate.
--------------------------------------------------------------- */
const LETTER_FIELD_CONFIG = {
  newSalary: { label: 'New Monthly Salary (\u20b9)', type: 'number' },
  effectiveDate: { label: 'Effective Date', type: 'date' },
  newDesignation: { label: 'New Designation', type: 'text' },
  incidentDate: { label: 'Incident Date', type: 'date' },
  reason: { label: 'Reason / Description', type: 'textarea' },
  lastWorkingDay: { label: 'Last Working Day', type: 'date' },
  joiningDate: { label: 'Joining Date', type: 'date' }
};

const LettersModule = {
  nextId() {
    const n = Storage.get(STORAGE_KEYS.letterCounter, 0) + 1;
    Storage.set(STORAGE_KEYS.letterCounter, n);
    return 'LTR-' + Utils.pad(n, 4);
  },
  getAll() { return Storage.get(STORAGE_KEYS.letters, []); },
  saveAll(list) { Storage.set(STORAGE_KEYS.letters, list); },

  init() {
    document.getElementById('lt_type').innerHTML = '<option value="">Select type</option>' +
      LETTER_TYPES.map(t => '<option value="' + t.key + '">' + Utils.escapeHtml(t.label) + '</option>').join('');
    document.getElementById('lt_type').addEventListener('change', () => this.renderDynamicFields());
    document.getElementById('lt_generateBtn').addEventListener('click', () => this.handleGenerate());
    document.getElementById('lettersTableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-letter-id]');
      if (!btn) return;
      const letter = this.getAll().find(l => l.id === btn.getAttribute('data-letter-id'));
      if (letter) this.openPreview(letter);
    });
  },

  renderDynamicFields() {
    const typeKey = document.getElementById('lt_type').value;
    const type = LETTER_TYPES.find(t => t.key === typeKey);
    const container = document.getElementById('lt_dynamicFields');
    if (!type) { container.innerHTML = ''; return; }
    container.innerHTML = type.fields.map(f => {
      const cfg = LETTER_FIELD_CONFIG[f];
      const inputHtml = cfg.type === 'textarea'
        ? '<textarea id="lt_f_' + f + '" rows="3"></textarea>'
        : '<input type="' + cfg.type + '" id="lt_f_' + f + '" />';
      return '<div class="form-field"><label for="lt_f_' + f + '">' + Utils.escapeHtml(cfg.label) + '</label>' + inputHtml + '</div>';
    }).join('');
  },

  render() {
    const employees = EmployeeModule.getAll().filter(e => e.status === 'Active' || e.status === 'Exited');
    document.getElementById('lt_employee').innerHTML = '<option value="">Select employee</option>' +
      employees.map(e => '<option value="' + Utils.escapeHtml(e.id) + '">' + Utils.escapeHtml(e.name) + '</option>').join('');

    const letters = this.getAll().slice().sort((a, b) => b.createdAt - a.createdAt);
    document.getElementById('lettersEmptyState').hidden = letters.length > 0;
    document.getElementById('lettersTable').style.display = letters.length ? '' : 'none';
    document.getElementById('lettersTableBody').innerHTML = letters.map(l =>
      '<tr><td class="cell-primary">' + Utils.escapeHtml(l.employeeName) + '</td>' +
      '<td>' + Utils.escapeHtml((LETTER_TYPES.find(t => t.key === l.letterType) || {}).label || l.letterType) + '</td>' +
      '<td class="cell-secondary">' + Utils.formatDate(l.issueDate) + '</td>' +
      '<td class="col-actions"><button class="btn btn-ghost btn-sm" data-letter-id="' + Utils.escapeHtml(l.id) + '">View</button></td></tr>'
    ).join('');
  },

  handleGenerate() {
    const employeeId = document.getElementById('lt_employee').value;
    const typeKey = document.getElementById('lt_type').value;
    if (!employeeId) { Toast.show('Select an employee.', 'error'); return; }
    if (!typeKey) { Toast.show('Select a letter type.', 'error'); return; }
    const employee = EmployeeModule.getAll().find(e => e.id === employeeId);
    const type = LETTER_TYPES.find(t => t.key === typeKey);
    const data = {};
    let valid = true;
    type.fields.forEach(f => {
      const val = document.getElementById('lt_f_' + f).value;
      if (!val) valid = false;
      data[f] = val;
    });
    if (!valid) { Toast.show('Fill in all fields for this letter type.', 'error'); return; }

    const letter = {
      id: this.nextId(), employeeId, employeeName: employee.name, letterType: typeKey,
      issueDate: Utils.todayStr(), data, createdAt: Date.now()
    };
    const list = this.getAll();
    list.push(letter);
    this.saveAll(list);
    AuditLog.log('Letters', 'Generated', employee.name + ' \u2014 ' + type.label, '');
    Toast.show(type.label + ' generated for ' + employee.name + '.', 'success');
    this.render();
    this.openPreview(letter);
  },

  openPreview(letter) {
    const employee = EmployeeModule.getAll().find(e => e.id === letter.employeeId) || { name: letter.employeeName, designation: '', department: '' };
    const type = LETTER_TYPES.find(t => t.key === letter.letterType);
    document.getElementById('payslipPreviewTitle').textContent = type.label + ' \u2014 ' + letter.employeeName;
    document.getElementById('payslipPaper').innerHTML = this.renderLetterHtml(letter, employee, type);
    SalarySlipModule.state.previewFilename = type.label.replace(/\s+/g, '-') + '-' + letter.employeeName.replace(/\s+/g, '-') + '.pdf';
    document.getElementById('payslipPreviewOverlay').hidden = false;
  },

  renderLetterHtml(letter, employee, type) {
    const company = CompanySettingsStore.get();
    const issueDate = new Date(letter.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const d = letter.data;
    let bodyHtml = '';

    if (letter.letterType === 'increment') {
      bodyHtml =
        '<p>Dear ' + Utils.escapeHtml(employee.name) + ',</p>' +
        '<p>We are pleased to inform you that, based on your performance and contribution, your monthly salary has been revised to <strong>' + Utils.formatCurrency(Number(d.newSalary)) + '</strong>, effective from <strong>' + Utils.formatDate(d.effectiveDate) + '</strong>.</p>' +
        '<p>This revision reflects the organization\u2019s appreciation of your continued commitment. We look forward to your ongoing contribution.</p>';
    } else if (letter.letterType === 'promotion') {
      bodyHtml =
        '<p>Dear ' + Utils.escapeHtml(employee.name) + ',</p>' +
        '<p>We are pleased to inform you that you have been promoted to the position of <strong>' + Utils.escapeHtml(d.newDesignation) + '</strong>, with a revised monthly salary of <strong>' + Utils.formatCurrency(Number(d.newSalary)) + '</strong>, effective from <strong>' + Utils.formatDate(d.effectiveDate) + '</strong>.</p>' +
        '<p>Congratulations on this achievement. We are confident you will continue to excel in your new role.</p>';
    } else if (letter.letterType === 'warning') {
      bodyHtml =
        '<p>Dear ' + Utils.escapeHtml(employee.name) + ',</p>' +
        '<p>This letter serves as a formal warning regarding an incident on <strong>' + Utils.formatDate(d.incidentDate) + '</strong>.</p>' +
        '<p><strong>Details:</strong> ' + Utils.escapeHtml(d.reason) + '</p>' +
        '<p>You are advised to take corrective action immediately. Any repetition of similar conduct may result in further disciplinary action, up to and including termination of employment.</p>';
    } else if (letter.letterType === 'relieving') {
      bodyHtml =
        '<p>Dear ' + Utils.escapeHtml(employee.name) + ',</p>' +
        '<p>This is to confirm that you have been relieved from your duties as <strong>' + Utils.escapeHtml(employee.designation) + '</strong> at ' + Utils.escapeHtml(company.name) + ', with effect from <strong>' + Utils.formatDate(d.lastWorkingDay) + '</strong>.</p>' +
        '<p>We thank you for your contribution during your tenure and wish you success in your future endeavors.</p>';
    } else if (letter.letterType === 'experience') {
      bodyHtml =
        '<p>This is to certify that <strong>' + Utils.escapeHtml(employee.name) + '</strong> was employed with ' + Utils.escapeHtml(company.name) + ' as <strong>' + Utils.escapeHtml(employee.designation) + '</strong>' +
        (employee.department ? ' in the <strong>' + Utils.escapeHtml(employee.department) + '</strong> department' : '') +
        ', from <strong>' + Utils.formatDate(d.joiningDate) + '</strong> to <strong>' + Utils.formatDate(d.lastWorkingDay) + '</strong>.</p>' +
        '<p>During this period, we found ' + Utils.escapeHtml(employee.name) + ' to be sincere, hardworking, and professional. We wish them the very best in their future endeavors.</p>';
    }

    return (
      '<div class="offer-letter-header"><span class="offer-letter-company">' + Utils.escapeHtml(company.name) + '</span></div>' +
      '<div class="offer-letter-meta-row"><span>' + Utils.escapeHtml(type.label) + ': <strong>' + Utils.escapeHtml(letter.id) + '</strong></span><span>Date: ' + issueDate + '</span></div>' +
      '<div class="offer-letter-body">' + bodyHtml + '</div>' +
      '<div class="offer-letter-signature">' +
      '<p>Sincerely,</p>' +
      '<div class="offer-letter-sign-line"><div class="offer-letter-sign-name">Midhun Das</div><div class="offer-letter-sign-title">Accounting Expert (Digital Signature)</div></div>' +
      '</div>' +
      '<p style="font-size:10.5px;color:#8a94a3;margin-top:14px;">This is a system-generated training document from the SKELORA simulator.</p>'
    );
  }
};

/* ---------------------------------------------------------------
   25. GLOBAL SEARCH (topnav)
--------------------------------------------------------------- */
const GlobalSearch = {
  init() {
    const input = document.getElementById('globalSearch');
    const results = document.getElementById('globalSearchResults');

    input.addEventListener('input', Utils.debounce(() => this.run(), 150));
    input.addEventListener('focus', () => { if (input.value.trim()) this.run(); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.topnav-search')) results.classList.remove('open');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input && !this.isTyping(e)) {
        e.preventDefault();
        input.focus();
      }
      if (e.key === 'Escape') results.classList.remove('open');
    });
  },

  isTyping(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'select' || tag === 'textarea';
  },

  run() {
    const input = document.getElementById('globalSearch');
    const results = document.getElementById('globalSearchResults');
    const q = input.value.trim().toLowerCase();
    if (!q) { results.classList.remove('open'); return; }

    const vacancyMatches = VacancyModule.getAll().filter(v =>
      (v.designation || '').toLowerCase().includes(q) ||
      (v.department || '').toLowerCase().includes(q) ||
      (v.location || '').toLowerCase().includes(q) ||
      (v.id || '').toLowerCase().includes(q)
    ).slice(0, 4).map(v => ({
      type: 'Vacancy', route: 'vacancy', id: v.id,
      title: v.designation + ' · ' + v.id,
      meta: v.department + ' · ' + v.location + ' · ' + v.status
    }));

    const resumeMatches = ResumeModule.getAll().filter(v =>
      (v.name || '').toLowerCase().includes(q) ||
      (v.phone || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.appliedForDesignation || '').toLowerCase().includes(q) ||
      (v.id || '').toLowerCase().includes(q)
    ).slice(0, 4).map(v => ({
      type: 'Candidate', route: 'resume', id: v.id,
      title: v.name + ' · ' + v.id,
      meta: 'Applied for ' + v.appliedForDesignation + ' · ' + v.status
    }));

    const screeningMatches = ScreeningModule.getAll().filter(s =>
      (s.candidateName || '').toLowerCase().includes(q) ||
      (s.appliedForDesignation || '').toLowerCase().includes(q) ||
      (s.id || '').toLowerCase().includes(q)
    ).slice(0, 4).map(s => ({
      type: 'Screening', route: 'screening', id: s.id,
      title: s.candidateName + ' · ' + s.id,
      meta: 'Total score ' + s.totalScore + '/100 · ' + s.decision
    }));

    const shortlistMatches = ShortlistModule.getAll().filter(s =>
      (s.candidateName || '').toLowerCase().includes(q) ||
      (s.appliedForDesignation || '').toLowerCase().includes(q) ||
      (s.id || '').toLowerCase().includes(q)
    ).slice(0, 4).map(s => ({
      type: 'Interview', route: 'shortlisting', id: s.id,
      title: s.candidateName + ' · ' + s.id,
      meta: Utils.formatDate(s.interviewDate) + ' · ' + s.status
    }));

    const roundsMatches = InterviewModule.getAll().filter(p =>
      (p.candidateName || '').toLowerCase().includes(q) ||
      (p.appliedForDesignation || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q)
    ).slice(0, 4).map(p => ({
      type: 'Interview Rounds', route: 'interview', id: p.id,
      title: p.candidateName + ' · ' + p.id,
      meta: p.overallStatus + (p.finalScore !== null ? ' · ' + p.finalScore + '/100' : '')
    }));

    const selectionMatches = SelectionModule.getAll().filter(s =>
      (s.candidateName || '').toLowerCase().includes(q) ||
      (s.appliedForDesignation || '').toLowerCase().includes(q) ||
      (s.id || '').toLowerCase().includes(q)
    ).slice(0, 4).map(s => ({
      type: 'Selection', route: 'selection', id: s.id,
      title: s.candidateName + ' · ' + s.id,
      meta: 'Applied for ' + s.appliedForDesignation + ' · ' + s.status
    }));

    const offerMatches = OfferModule.getAll().filter(o =>
      (o.candidateName || '').toLowerCase().includes(q) ||
      (o.appliedForDesignation || '').toLowerCase().includes(q) ||
      (o.id || '').toLowerCase().includes(q)
    ).slice(0, 4).map(o => ({
      type: 'Offer', route: 'offer', id: o.id,
      title: o.candidateName + ' · ' + o.id,
      meta: o.appliedForDesignation + ' · ' + o.status
    }));

    const joiningMatches = JoiningModule.getAll().filter(j =>
      (j.candidateName || '').toLowerCase().includes(q) ||
      (j.appliedForDesignation || '').toLowerCase().includes(q) ||
      (j.id || '').toLowerCase().includes(q)
    ).slice(0, 4).map(j => ({
      type: 'Joining', route: 'joining', id: j.id,
      title: j.candidateName + ' · ' + j.id,
      meta: j.completionPercent + '% complete · ' + j.status
    }));

    const employeeMatches = EmployeeModule.getAll().filter(e =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.designation || '').toLowerCase().includes(q) ||
      (e.department || '').toLowerCase().includes(q) ||
      (e.id || '').toLowerCase().includes(q)
    ).slice(0, 4).map(e => ({
      type: 'Employee', route: 'employee', id: e.id,
      title: e.name + ' · ' + e.id,
      meta: e.designation + ' · ' + e.department
    }));

    const matches = [...vacancyMatches, ...resumeMatches, ...screeningMatches, ...shortlistMatches, ...roundsMatches, ...selectionMatches, ...offerMatches, ...joiningMatches, ...employeeMatches];

    if (!matches.length) {
      results.innerHTML = '<div class="gsr-empty">No matches in Job Vacancies or Resume Management.</div>';
    } else {
      results.innerHTML = matches.map(m =>
        '<div class="gsr-item" data-gsr-type="' + m.type + '" data-gsr-id="' + Utils.escapeHtml(m.id) + '">' +
        '<div class="gsr-title">' + Utils.escapeHtml(m.title) + '</div>' +
        '<div class="gsr-meta">' + Utils.escapeHtml(m.type) + ' · ' + Utils.escapeHtml(m.meta) + '</div>' +
        '</div>'
      ).join('');
      results.querySelectorAll('.gsr-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.getAttribute('data-gsr-id');
          const type = item.getAttribute('data-gsr-type');
          results.classList.remove('open');
          input.value = '';
          if (type === 'Vacancy') {
            const vacancy = VacancyModule.getAll().find(v => v.id === id);
            Router.go('vacancy');
            if (vacancy) VacancyModule.openView(vacancy);
          } else if (type === 'Screening') {
            const screening = ScreeningModule.getAll().find(s => s.id === id);
            Router.go('screening');
            if (screening) ScreeningModule.openView(screening);
          } else if (type === 'Interview') {
            const schedule = ShortlistModule.getAll().find(s => s.id === id);
            Router.go('shortlisting');
            if (schedule) ShortlistModule.openView(schedule);
          } else if (type === 'Interview Rounds') {
            const process = InterviewModule.getAll().find(p => p.id === id);
            Router.go('interview');
            if (process) InterviewModule.openView(process);
          } else if (type === 'Selection') {
            const selection = SelectionModule.getAll().find(s => s.id === id);
            Router.go('selection');
            if (selection) SelectionModule.openView(selection);
          } else if (type === 'Offer') {
            const offer = OfferModule.getAll().find(o => o.id === id);
            Router.go('offer');
            if (offer) OfferModule.openPreview(offer);
          } else if (type === 'Joining') {
            const checklist = JoiningModule.getAll().find(j => j.id === id);
            Router.go('joining');
            if (checklist) JoiningModule.openView(checklist);
          } else if (type === 'Employee') {
            const employee = EmployeeModule.getAll().find(e => e.id === id);
            Router.go('employee');
            if (employee) EmployeeModule.openView(employee);
          } else {
            const candidate = ResumeModule.getAll().find(v => v.id === id);
            Router.go('resume');
            if (candidate) ResumeModule.openView(candidate);
          }
        });
      });
    }
    results.classList.add('open');
  }
};


/* ---------------------------------------------------------------
   12. BOOTSTRAP
--------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  Auth.seedDefaultUsers();
  Theme.init();
  Router.initSidebarToggles();
  Popovers.init();
  RowMenu.init();
  initModalExclusivity();
  Activity.init();
  VacancyModule.init();
  ResumeModule.init();
  ScreeningModule.init();
  ShortlistModule.init();
  InterviewModule.init();
  SelectionModule.init();
  OfferModule.init();
  JoiningModule.init();
  EmployeeModule.init();
  AttendanceModule.init();
  LeaveModule.init();
  PayrollModule.init();
  SalarySlipModule.init();
  ExitModule.init();
  SettlementModule.init();
  ManagerModule.init();
  SelfServiceModule.init();
  ReportsModule.init();
  AuditViewModule.init();
  ComplianceModule.init();
  LettersModule.init();
  GlobalSearch.init();

  document.getElementById('confirmCancelBtn').addEventListener('click', () => Confirm.resolveWith(false));
  document.getElementById('confirmOkBtn').addEventListener('click', () => Confirm.resolveWith(true));
  document.getElementById('confirmOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'confirmOverlay') Confirm.resolveWith(false);
  });

  document.getElementById('resetDataBtn').addEventListener('click', () => handleResetData());
  document.getElementById('settingsResetBtn').addEventListener('click', () => handleResetData());
  document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());

  const aboutToggleBtn = document.getElementById('aboutToggleBtn');
  if (aboutToggleBtn) {
    aboutToggleBtn.addEventListener('click', () => {
      const fullDetails = document.getElementById('aboutFullDetails');
      const nowHidden = !fullDetails.hidden;
      fullDetails.hidden = nowHidden;
      aboutToggleBtn.setAttribute('aria-expanded', String(!nowHidden));
      aboutToggleBtn.textContent = nowHidden ? 'View full ecosystem details' : 'Hide full ecosystem details';
    });
  }

  document.getElementById('credentialsModalCloseBtn').addEventListener('click', () => {
    document.getElementById('credentialsModalOverlay').hidden = true;
  });
  document.getElementById('credentialsModalDoneBtn').addEventListener('click', () => {
    document.getElementById('credentialsModalOverlay').hidden = true;
  });
  document.getElementById('credentialsModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'credentialsModalOverlay') document.getElementById('credentialsModalOverlay').hidden = true;
  });

  populateCompanySettingsForm();
  document.getElementById('settingsSaveCompanyBtn').addEventListener('click', () => {
    const tan = document.getElementById('cs_tan').value.trim().toUpperCase();
    const employerPan = document.getElementById('cs_employerPan').value.trim().toUpperCase();
    CompanySettingsStore.set({
      name: document.getElementById('cs_name').value.trim() || CompanySettingsStore.DEFAULTS.name,
      address: document.getElementById('cs_address').value.trim() || CompanySettingsStore.DEFAULTS.address,
      tan: tan || CompanySettingsStore.DEFAULTS.tan,
      employerPan: employerPan || CompanySettingsStore.DEFAULTS.employerPan
    });
    AuditLog.log('Settings', 'Company Details Updated', CompanySettingsStore.get().name, '');
    Toast.show('Company details saved.', 'success');
  });

  document.querySelectorAll('[data-route]').forEach(el => {
    el.addEventListener('click', () => Router.go(el.getAttribute('data-route')));
  });

  /* ---------- login gate ---------- */
  function applySessionToChrome(session) {
    const initials = (session.displayName || session.username || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    document.getElementById('profileAvatar').textContent = initials || '?';
    document.getElementById('profileName').textContent = session.displayName || session.username;
    document.getElementById('profileRoleLabel').textContent = 'Signed in as ' + (ROLE_LABELS[session.role] || session.role);
    const settingsCompanyPanel = document.getElementById('cs_name') && document.getElementById('cs_name').closest('.panel');
    const isAdmin = session.role === 'admin';
    document.getElementById('settingsResetBtn').closest('.settings-row').style.display = isAdmin ? '' : 'none';
    if (settingsCompanyPanel) settingsCompanyPanel.style.display = isAdmin ? '' : 'none';
    renderLoginAccountsPanel();
  }

  function enterApp() {
    const session = Auth.getSession();
    document.getElementById('authShell').hidden = true;
    document.getElementById('appShell').hidden = false;
    applySessionToChrome(session);
    Router.buildSidebar();

    const restorable = ['vacancy', 'resume', 'screening', 'shortlisting', 'interview', 'selection', 'offer',
      'joining', 'employee', 'attendance', 'leave', 'payroll', 'payslip', 'exit', 'settlement', 'settings',
      'my-team', 'my-workspace', 'reports', 'audit', 'compliance', 'letters'];
    const startRoute = Storage.get(STORAGE_KEYS.currentRoute, ROLE_HOME[session.role] || 'dashboard');
    const validRoute = (restorable.includes(startRoute) && Auth.canAccess(startRoute)) ? startRoute : (ROLE_HOME[session.role] || 'dashboard');
    Router.go(validRoute);
  }

  document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('login_username').value;
    const password = document.getElementById('login_password').value;
    const result = Auth.login(username, password);
    const errorEl = document.getElementById('loginError');
    if (!result.ok) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    enterApp();
  });

  function setAuthTab(mode) {
    const isSignUp = mode === 'signup';
    document.getElementById('authTabSignIn').classList.toggle('active', !isSignUp);
    document.getElementById('authTabSignUp').classList.toggle('active', isSignUp);
    document.getElementById('authTabSignIn').setAttribute('aria-selected', String(!isSignUp));
    document.getElementById('authTabSignUp').setAttribute('aria-selected', String(isSignUp));
    document.getElementById('loginForm').hidden = isSignUp;
    document.getElementById('signupForm').hidden = !isSignUp;
    document.getElementById('authDemoBox').hidden = isSignUp;
    document.getElementById('authFormTitle').textContent = isSignUp ? 'Create your account' : 'Sign in';
  }
  document.getElementById('authTabSignIn').addEventListener('click', () => setAuthTab('signin'));
  document.getElementById('authTabSignUp').addEventListener('click', () => setAuthTab('signup'));

  document.getElementById('signupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const displayName = document.getElementById('signup_displayName').value;
    const username = document.getElementById('signup_username').value;
    const password = document.getElementById('signup_password').value;
    const confirmPassword = document.getElementById('signup_confirmPassword').value;
    const errorEl = document.getElementById('signupError');

    if (password !== confirmPassword) {
      errorEl.textContent = 'Passwords don\u2019t match.';
      errorEl.hidden = false;
      return;
    }
    const result = Auth.signUp(displayName, username, password);
    if (!result.ok) {
      errorEl.textContent = result.error;
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;
    enterApp();
  });

  const existingSession = Auth.getSession();
  if (existingSession) {
    enterApp();
  } else {
    document.getElementById('appShell').hidden = true;
    document.getElementById('authShell').hidden = false;
  }
});

function populateCompanySettingsForm() {
  const c = CompanySettingsStore.get();
  document.getElementById('cs_name').value = c.name;
  document.getElementById('cs_address').value = c.address;
  document.getElementById('cs_tan').value = c.tan;
  document.getElementById('cs_employerPan').value = c.employerPan;
}

function renderLoginAccountsPanel() {
  const session = Auth.getSession();
  const panel = document.getElementById('loginAccountsPanel');
  if (!session || session.role !== 'admin') { panel.style.display = 'none'; return; }
  panel.style.display = '';

  const users = Auth.getUsers();
  document.getElementById('loginAccountsTableBody').innerHTML = users.map(u => {
    const active = u.active !== false;
    return '<tr>' +
      '<td class="cell-primary">' + Utils.escapeHtml(u.displayName || u.username) + '</td>' +
      '<td class="cell-secondary" style="font-family:var(--font-mono);">' + Utils.escapeHtml(u.username) + '</td>' +
      '<td>' + Utils.escapeHtml(ROLE_LABELS[u.role] || u.role) + '</td>' +
      '<td><span class="badge ' + (active ? 'badge-success' : 'badge-neutral') + '">' + (active ? 'Active' : 'Deactivated') + '</span></td>' +
      '<td class="col-actions">' +
      (u.role !== 'admin' && u.role !== 'hr'
        ? '<button class="btn btn-ghost btn-sm" data-user-action="reset" data-user-id="' + Utils.escapeHtml(u.id) + '">Reset Password</button> ' +
          '<button class="btn btn-ghost btn-sm" data-user-action="' + (active ? 'deactivate' : 'activate') + '" data-user-id="' + Utils.escapeHtml(u.id) + '">' + (active ? 'Deactivate' : 'Reactivate') + '</button>'
        : '<span class="muted-text">Built-in</span>') +
      '</td></tr>';
  }).join('');

  document.querySelectorAll('#loginAccountsTableBody [data-user-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-user-id');
      const action = btn.getAttribute('data-user-action');
      if (action === 'reset') {
        const updated = Auth.resetPassword(userId);
        if (updated) {
          showCredentialsModal(updated, 'Password Reset');
        }
      } else if (action === 'deactivate') {
        Auth.setActive(userId, false);
        Toast.show('Login deactivated.', 'success');
        renderLoginAccountsPanel();
      } else if (action === 'activate') {
        Auth.setActive(userId, true);
        Toast.show('Login reactivated.', 'success');
        renderLoginAccountsPanel();
      }
    });
  });
}

function showCredentialsModal(user, title) {
  document.getElementById('credentialsModalTitle').textContent = title || 'Login Created';
  document.getElementById('cred_role').textContent = ROLE_LABELS[user.role] || user.role;
  document.getElementById('cred_username').textContent = user.username;
  document.getElementById('cred_password').textContent = user.password;
  document.getElementById('credentialsModalOverlay').hidden = false;
}

async function handleResetData() {
  Popovers.closeAll();
  const session = Auth.getSession();
  const confirmed = await Confirm.ask(
    'Reset all simulator data?',
    'This clears every record across all 15 phases — vacancies, candidates, employees, attendance, leave, payroll, exits, settlements, everything — in YOUR workspace only. Other students sharing this computer are not affected. Theme and sidebar preferences are kept. This cannot be undone.',
    'Reset data'
  );
  if (!confirmed) return;
  // Loop over STORAGE_KEYS instead of listing keys by hand, so this can't go
  // stale again the way it did for 14 phases after Phase 1 (theme and sidebar
  // collapse state are UI preferences, not simulator data, so they're kept).
  // NOTE: users/userCounter/session are GLOBAL_KEYS (shared machine-wide
  // across every student's login), so Storage.remove on them would log out
  // and delete accounts for the whole shared computer, not just this
  // student. They're excluded here and handled explicitly below instead.
  const preserve = new Set([
    STORAGE_KEYS.theme, STORAGE_KEYS.sidebarCollapsed,
    STORAGE_KEYS.users, STORAGE_KEYS.userCounter, STORAGE_KEYS.session
  ]);
  Object.values(STORAGE_KEYS).forEach(key => {
    if (!preserve.has(key)) Storage.remove(key);
  });
  // Remove only this account from the shared login list (matches the old
  // "reset wipes my account too" behaviour) without touching any other
  // student's account on this same shared browser.
  if (session) {
    const users = Auth.getUsers().filter(u => u.id !== session.userId);
    Storage.set(STORAGE_KEYS.users, users);
  }
  Storage.remove(STORAGE_KEYS.session);
  Toast.show('Your workspace has been reset.', 'success');
  setTimeout(() => location.reload(), 600);
}
