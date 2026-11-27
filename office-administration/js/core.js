/* =========================================================
   core.js — MUST be the first script loaded.
   Declares the shared globals that every module file writes
   into at parse time (Modules.xxx = ...). If this loads after
   any module file, those modules silently fail to register.
   ========================================================= */

const Modules = {}; // populated by each module file: Modules.<route> = function(container){...}

const ROUTES = {
  'dashboard':      { label: 'Dashboard', track: 'always' },
  'employees':      { label: 'Employees', track: 'core' },
  'personal-file':  { label: 'Personal Files', track: 'core' },
  'orgchart':       { label: 'Org Chart', track: 'advanced' },
  'attendance':     { label: 'Attendance Register', track: 'core' },
  'leave':          { label: 'Leave Register', track: 'core' },
  'leave-balance':  { label: 'Leave Balance Calculator', track: 'core' },
  'payroll':        { label: 'Payroll & Payslips', track: 'advanced' },
  'assets':         { label: 'Company Assets', track: 'advanced' },
  'recruitment':    { label: 'Recruitment', track: 'advanced' },
  'performance':    { label: 'Performance Appraisals', track: 'advanced' },
  'documents':      { label: 'Document Center', track: 'core' },
  'idcard':         { label: 'ID Card Generator', track: 'core' },
  'correspondence': { label: 'Correspondence & Drafting', track: 'core' },
  'mailroom':       { label: 'Mail & Dispatch Register', track: 'core' },
  'frontoffice':    { label: 'Front Office & Reception', track: 'core' },
  'meetings':       { label: 'Meetings & Minutes', track: 'core' },
  'excellab':       { label: 'Office Work Requests', track: 'core' },
  'procurement':    { label: 'Procurement & Petty Cash', track: 'core' },
  'inventory':      { label: 'Stationery & Inventory', track: 'core' },
  'travel':         { label: 'Travel & Expense (TA/DA)', track: 'core' },
  'facility':       { label: 'Facility & Room Booking', track: 'core' },
  'vendors':        { label: 'Vendor & Compliance Tracker', track: 'core' },
  'grievances':     { label: 'Grievance Register', track: 'core' },
  'maintenance':    { label: 'Facility Maintenance Log', track: 'core' },
  'diary':          { label: 'Executive Calendar & Diary', track: 'core' },
  'inbox':          { label: 'Inbox Management', track: 'core' },
  'dataentry':      { label: 'Data Entry Practice', track: 'core' },
  'filing':         { label: 'Filing System Simulator', track: 'core' },
  'dayplanner':     { label: 'Day Planner', track: 'core' },
  'resignations':   { label: 'Resignations', track: 'advanced' },
  'notice-period':  { label: 'Notice Period Tracker', track: 'advanced' },
  'clearance':      { label: 'Department Clearance', track: 'advanced' },
  'final-settlement': { label: 'Final Settlement', track: 'advanced' },
  'exit-interviews': { label: 'Exit Interviews', track: 'advanced' },
  'former-employees': { label: 'Former Employees', track: 'advanced' },
  'notices':        { label: 'Notice Board', track: 'core' },
  'calendar':       { label: 'HR Calendar', track: 'core' },
  'notifications':  { label: 'Notifications', track: 'always' },
  'reports':        { label: 'HR Reports', track: 'core' },
  'search':         { label: 'Search Employee', track: 'always' },
  'sessions':       { label: 'Practice Sessions', track: 'always' },
  'practicals':     { label: 'Practical Tasks', track: 'always' },
  'instructor':     { label: 'Instructor Mode', track: 'always' },
  'settings':       { label: 'Settings', track: 'always' }
};

const COURSE_TRACKS = {
  'full': { label: 'Full HRMS (All Modules)' },
  'core': { label: 'Core Office Administration Only' }
};

let currentRoute = 'dashboard';
