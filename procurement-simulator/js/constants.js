// ─────────────────────────────────────────────────────────────
// Shared approval workflow constants (Module 4).
// Every PR — however it was created (Module 3 direct entry,
// Module 2 requirement conversion, or seed data) — moves through
// this same 4-level pipeline, one level at a time.
// ─────────────────────────────────────────────────────────────
var APPROVAL_LEVELS = ['Department Head', 'Finance', 'Purchase Manager', 'Director'];
var APPROVAL_APPROVERS = {
  'Department Head': 'Vikram Sen',
  'Finance': 'Kavita Iyer',
  'Purchase Manager': 'Rahul Mehta',
  'Director': 'Suresh Menon',
};

function buildFreshApprovalSteps() {
  return APPROVAL_LEVELS.map((level) => ({ level, approver: APPROVAL_APPROVERS[level], status: 'Pending' }));
}
