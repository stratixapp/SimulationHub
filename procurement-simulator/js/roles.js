// ─────────────────────────────────────────────────────────────
// Roles — real access-control enforcement inside a single student's
// session. One student still plays every part (there's no backend
// to have two different logged-in people collaborate live — see
// the Settings/About note on architecture), but they can only take
// an action while "acting as" the role that actually owns it. An
// Employee cannot approve their own PR; a Finance Officer cannot
// create a Purchase Order. To complete the full cycle, the student
// has to switch roles in the topbar as they move through it — which
// is the point: it teaches segregation of duties, not just the
// happy-path clicks.
// ─────────────────────────────────────────────────────────────
var Roles = (function () {
  // Switching the role dropdown to Administrator requires this code —
  // otherwise any student could pick "Administrator" from the dropdown
  // and browse every other student's saved data in the Instructor
  // Console. Same idea as a staff access code at registration; still
  // client-side only, so treat it as classroom convention, not a real
  // security boundary.
  const ADMIN_ACCESS_CODE = 'SKELORA-STAFF-2026';

  const ROLE_LIST = [
    'Employee',
    'Department Manager',
    'Procurement Officer',
    'Senior Procurement Manager',
    'Finance Officer',
    'Warehouse Supervisor',
    'Vendor',
    'Administrator',
  ];

  const ROLE_BLURB = {
    'Employee': 'Raises department requirements and purchase requisitions.',
    'Department Manager': 'First-line approver on a PR — the "Department Head" step.',
    'Procurement Officer': 'Manages vendors, issues RFQs, and raises purchase orders.',
    'Senior Procurement Manager': 'Owns the "Purchase Manager" approval step, awards RFQs, and approves/releases POs.',
    'Finance Officer': 'Owns the "Finance" approval step, verifies budgets, invoices, and processes payments.',
    'Warehouse Supervisor': 'Tracks deliveries and posts Goods Receipt Notes.',
    'Vendor': 'Submits quotations, accepts POs, dispatches shipments, and submits invoices.',
    'Administrator': 'Owns the "Director" approval step and has full access everywhere, including Reset.',
  };

  // Which role owns each level of the 4-step PR approval pipeline
  // (constants.js: APPROVAL_LEVELS). Matches the org-chart names
  // already used for the named approvers in that pipeline.
  const APPROVAL_LEVEL_ROLE = {
    'Department Head': 'Department Manager',
    'Finance': 'Finance Officer',
    'Purchase Manager': 'Senior Procurement Manager',
    'Director': 'Administrator',
  };

  // Which role owns each state-changing action, by its data-action
  // name. Anything NOT listed here (navigation, filters, drawers,
  // print/export, drafts, tour, auth) is unrestricted — segregation
  // of duties applies to decisions and commitments, not to reading
  // or organizing your own screen.
  const ACTION_ROLE = {
    'submit-req': 'Employee', 'submit-draft-req': 'Employee',
    'submit-pr': 'Employee', 'submit-draft-pr': 'Employee', 'convert-req-to-pr': 'Employee', 'close-pr': 'Employee',

    'budget-continue': 'Finance Officer', 'budget-override': 'Finance Officer',
    'budget-reject': 'Finance Officer', 'budget-revalidate': 'Finance Officer',

    'submit-vendor': 'Procurement Officer', 'add-vendor-review': 'Procurement Officer', 'update-vendor-risk': 'Procurement Officer',
    'approve-vendor': 'Senior Procurement Manager', 'reject-vendor': 'Senior Procurement Manager',
    'blacklist-vendor': 'Senior Procurement Manager', 'reinstate-vendor': 'Senior Procurement Manager',

    'issue-rfq': 'Procurement Officer', 'cancel-rfq': 'Procurement Officer', 'duplicate-rfq': 'Procurement Officer',

    'submit-quotation': 'Vendor',
    'accept-quotation': 'Procurement Officer', 'reject-quotation': 'Procurement Officer', 'set-tech-qualified': 'Procurement Officer',

    'add-committee-review': 'Senior Procurement Manager', 'approve-selection': 'Senior Procurement Manager',
    'award-vendor': 'Senior Procurement Manager', 'record-negotiation': 'Procurement Officer',

    'create-po': 'Procurement Officer',
    'approve-po': 'Senior Procurement Manager', 'reject-po': 'Senior Procurement Manager',
    'release-po': 'Senior Procurement Manager', 'cancel-po': 'Senior Procurement Manager', 'amend-po': 'Senior Procurement Manager',
    'vendor-accept-po': 'Vendor', 'vendor-decline-po': 'Vendor',

    'submit-contract': 'Procurement Officer',
    'approve-contract': 'Senior Procurement Manager', 'reject-contract': 'Senior Procurement Manager', 'close-contract': 'Senior Procurement Manager',
    'submit-calloff': 'Procurement Officer',
    'submit-service-po': 'Procurement Officer',
    'signoff-milestone': 'Department Manager', 'reject-milestone': 'Department Manager',

    'create-delivery': 'Vendor',
    'report-delay': 'Warehouse Supervisor', 'mark-delivery-partial': 'Warehouse Supervisor', 'mark-delivery-complete': 'Warehouse Supervisor',

    'post-grn': 'Warehouse Supervisor',

    'submit-invoice': 'Vendor',
    'verify-invoice': 'Finance Officer', 'reject-invoice': 'Finance Officer', 'override-invoice-block': 'Finance Officer',
    'raise-dispute': 'Procurement Officer', 'respond-dispute': 'Vendor', 'resolve-dispute': 'Senior Procurement Manager',

    'create-payment': 'Finance Officer', 'process-payment': 'Finance Officer', 'mark-payment-failed': 'Finance Officer',

    'confirm-reset': 'Administrator',
    'save-instructor-grade': 'Administrator',
  };

  // These actions all ultimately approve/reject/forward/return a PR
  // at whatever level it currently sits at — so the required role
  // depends on runtime state (pr.approval.currentLevel), not a fixed
  // action->role mapping.
  const LEVEL_AWARE_ACTIONS = { 'approve-pr': 1, 'reject-pr': 1, 'drawer-approve': 1, 'drawer-reject': 1, 'drawer-forward': 1, 'drawer-return': 1 };

  function requiredRoleFor(action, context) {
    if (LEVEL_AWARE_ACTIONS[action]) {
      const level = context && context.approvalLevel;
      return APPROVAL_LEVEL_ROLE[level] || null;
    }
    return ACTION_ROLE[action] || null; // null = unrestricted
  }

  function canPerform(action, activeRole, context) {
    if (activeRole === 'Administrator') return true;
    const required = requiredRoleFor(action, context);
    if (!required) return true;
    return required === activeRole;
  }

  return { ROLE_LIST, ROLE_BLURB, APPROVAL_LEVEL_ROLE, ACTION_ROLE, LEVEL_AWARE_ACTIONS, ADMIN_ACCESS_CODE, requiredRoleFor, canPerform };
})();
