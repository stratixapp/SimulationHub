// ─────────────────────────────────────────────────────────────
// Procurement Simulator — Starting Dataset
//
// This is a TRAINING SANDBOX, not a filled-in demo. Only master /
// reference data is pre-populated — the "given" configuration a
// real company would already have before anyone does any work:
//   - Departments and the org roster (who exists, what role)
//   - The vendor master list (vendors a company already onboarded,
//     with their known track record — but zero transaction history)
//   - Budget allocations per department (Cost Center / GL Account /
//     Project Code / Allocated amount — but zero used, zero reserved)
//
// Every TRANSACTIONAL record — Department Requirements, Purchase
// Requisitions, RFQs, Quotations, Purchase Orders, Deliveries, GRNs,
// Invoices, Payments, the activity feed — starts EMPTY. A student
// builds all of it themselves by using the modules: raise a
// requirement, convert it to a PR, push it through the approval
// workflow, validate it against budget, and so on. That's the point
// of the exercise — nothing is faked or pre-seeded for them.
//
// Data shape (per record) — kept here as the single source of
// truth for field names every module should reuse:
//
// User            { id, name, role, department, avatarColor }
// Vendor          { id, name, category, gst, rating, onTimeDeliveryPct,
//                   qualityScore, approvalStatus, activePOs, totalSpendYtd }
// BudgetLine      { id, costCenter, glAccount, projectCode, department,
//                   allocated, reserved, used }
// DepartmentRequirement, PurchaseRequisition, RFQ, Quotation,
// PurchaseOrder, Delivery, GRN, Invoice, Payment, ActivityEvent,
// AppNotification — all created at runtime by Store actions; see
// store.js for the exact shape each action builds.
// ─────────────────────────────────────────────────────────────

const DEPARTMENTS = ['Operations', 'Engineering', 'Warehouse', 'IT', 'Finance', 'Plant Maintenance', 'Quality'];

const USERS = [
  { id: 'u1', name: 'Ananya Rao', role: 'Employee', department: 'Operations', avatarColor: '#38BDF8' },
  { id: 'u2', name: 'Vikram Sen', role: 'Department Manager', department: 'Engineering', avatarColor: '#A78BFA' },
  { id: 'u3', name: 'Priya Nair', role: 'Procurement Officer', department: 'Procurement', avatarColor: '#2DD4BF' },
  { id: 'u4', name: 'Rahul Mehta', role: 'Procurement Manager', department: 'Procurement', avatarColor: '#F5A623' },
  { id: 'u5', name: 'Kavita Iyer', role: 'Finance Officer', department: 'Finance', avatarColor: '#4ADE80' },
  { id: 'u6', name: 'Arjun Das', role: 'Finance Manager', department: 'Finance', avatarColor: '#F0555A' },
  { id: 'u7', name: 'Suresh Pillai', role: 'Warehouse Officer', department: 'Warehouse', avatarColor: '#38BDF8' },
  { id: 'u8', name: 'Meera Krishnan', role: 'System Administrator', department: 'IT', avatarColor: '#A78BFA' },
];

const VENDOR_CATS = ['Domestic', 'International', 'Manufacturer', 'Distributor', 'Service Provider'];

// Budget allocations — the "given" annual budget plan per department.
// Used and reserved both start at zero: they only grow as the student
// submits and approves real Purchase Requisitions (see store.js).
const BUDGET_PLAN = {
  Operations:         { allocated: 8000000, glAccount: 'GL-4010', projectCode: 'PRJ-OPS-2026' },
  Engineering:        { allocated: 6000000, glAccount: 'GL-4020', projectCode: 'PRJ-ENG-2026' },
  Warehouse:          { allocated: 3500000, glAccount: 'GL-4030', projectCode: 'PRJ-WH-2026' },
  IT:                 { allocated: 4500000, glAccount: 'GL-4040', projectCode: 'PRJ-IT-2026' },
  Finance:            { allocated: 2000000, glAccount: 'GL-4050', projectCode: 'PRJ-FIN-2026' },
  'Plant Maintenance':{ allocated: 5000000, glAccount: 'GL-4060', projectCode: 'PRJ-PM-2026' },
  Quality:            { allocated: 2500000, glAccount: 'GL-4070', projectCode: 'PRJ-QA-2026' },
};

function buildBudgets() {
  return DEPARTMENTS.map((dept, i) => {
    const plan = BUDGET_PLAN[dept];
    return {
      id: 'bud' + (i + 1),
      costCenter: 'CC-' + dept.slice(0, 3).toUpperCase(),
      glAccount: plan.glAccount,
      projectCode: plan.projectCode,
      department: dept,
      allocated: plan.allocated,
      reserved: 0,
      used: 0,
    };
  });
}

function generateDataset() {
  return {
    users: USERS,
    vendors: [],
    budgets: buildBudgets(),
    activeRole: 'Employee', // which role this student is currently acting as — see js/roles.js

    // Transactional data — empty. The student builds all of this.
    requirements: [],
    prs: [],
    rfqs: [],
    quotations: [],
    pos: [],
    contracts: [],
    deliveries: [],
    grns: [],
    disputes: [],
    invoices: [],
    payments: [],
    activity: [],
    notifications: [
      {
        id: 'n-welcome',
        title: 'Welcome to the Procurement Simulator',
        detail: 'Nothing is pre-filled — not even vendors. Register and approve your first vendor in Module 6, then start a requirement in Module 2 or a PR in Module 3.',
        severity: 'info',
        timestamp: new Date().toISOString().slice(0, 10),
        read: false,
      },
    ],
  };
}
