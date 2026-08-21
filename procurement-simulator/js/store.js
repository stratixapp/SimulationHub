// ─────────────────────────────────────────────────────────────
// Store — single source of truth + pub/sub, no framework.
// Any module can do: Store.subscribe(fn), Store.state, Store.actions.xxx()
//
// Two shared engines live here, used by every module that touches
// a PR — this is what makes the whole simulator interconnected
// instead of each module having its own private copy of the rules:
//
// 1. Approval engine (Module 4): every PR's approval.steps follows
//    the same APPROVAL_LEVELS pipeline (constants.js). approveCurrentLevel /
//    rejectCurrentLevel / returnCurrentLevel / forwardCurrentLevel are
//    the ONE engine — the Dashboard's quick-approve icon, the PR list
//    (Module 3), and the Approver Dashboard (Module 4) all call these
//    same functions.
//
// 2. Budget engine (Module 5): submitting a PR reserves its value
//    against its department's budget and runs a Sufficient/Insufficient
//    check. approveCurrentLevel WILL NOT let an Insufficient PR clear
//    a level — it has to be validated/overridden in Module 5 first.
//    Reject or Return releases the reservation. Final approval moves
//    the reservation from "reserved" to "used".
// ─────────────────────────────────────────────────────────────
var Store = (function () {
  const STORAGE_PREFIX = 'procurement-simulator-v1:';
  let activeStudentId = null; // set by Store.setActiveUser() after login

  function hasLocalStorage() {
    try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch (e) { return false; }
  }

  function storageKeyFor(studentId) {
    return STORAGE_PREFIX + studentId;
  }

  function loadPersistedState(studentId) {
    if (!hasLocalStorage() || !studentId) return null;
    try {
      const raw = localStorage.getItem(storageKeyFor(studentId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Sanity check — a handful of required arrays must exist, or we
      // treat it as corrupt/incompatible and fall back to a fresh start.
      const requiredKeys = ['users', 'vendors', 'budgets', 'requirements', 'prs', 'rfqs', 'quotations', 'pos', 'deliveries', 'grns', 'invoices', 'payments', 'activity', 'notifications'];
      if (!requiredKeys.every((k) => Array.isArray(parsed[k]))) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function persistState() {
    if (!hasLocalStorage() || !activeStudentId) return;
    try {
      localStorage.setItem(storageKeyFor(activeStudentId), JSON.stringify(state));
    } catch (e) {
      // Storage full or unavailable (e.g. private browsing) — the
      // session still works in-memory, it just won't survive a reload.
    }
  }

  // No student is logged in yet at script-load time — this is just a
  // placeholder so Store.state is never undefined. Store.setActiveUser()
  // (called right after a successful sign-in) replaces it with that
  // student's own saved dataset, or a fresh one if they're new.
  let state = generateDataset();
  const listeners = new Set();

  function notify() {
    persistState();
    listeners.forEach((fn) => fn(state));
  }
  function today() { return new Date().toISOString().slice(0, 10); }

  function currentPendingStep(pr) {
    return pr.approval.steps.find((s) => s.status === 'Pending');
  }

  function logHistory(pr, level, action, actor, comment) {
    if (!pr.approvalHistory) pr.approvalHistory = [];
    pr.approvalHistory.unshift({ level, action, actor, comment: comment || '', timestamp: today() });
  }

  function notifyInfo(title, detail, severity) {
    state.notifications.unshift({ id: 'n-' + Date.now(), title, detail, severity: severity || 'info', timestamp: today(), read: false });
  }

  function logVendorActivity(vendor, action, actor, comment) {
    if (!vendor.activityLog) vendor.activityLog = [];
    vendor.activityLog.unshift({ action, actor, comment: comment || '', timestamp: today() });
  }

  // ── Module 5: Budget engine ─────────────────────────────────
  function findBudgetLine(department) {
    return state.budgets.find((b) => b.department === department);
  }

  function runBudgetCheck(pr) {
    const line = findBudgetLine(pr.department);
    if (!line) {
      pr.budgetCheck = { status: 'Insufficient', costCenter: '—', glAccount: '—', projectCode: '—', available: 0, requested: pr.estimatedValue, checkedAt: today() };
      return pr.budgetCheck;
    }
    const selfReserved = pr.budgetReservedAmount || 0;
    const availableExcludingSelf = line.allocated - line.used - (line.reserved - selfReserved);
    const status = pr.estimatedValue <= availableExcludingSelf ? 'Sufficient' : 'Insufficient';
    pr.budgetCheck = {
      status, costCenter: line.costCenter, glAccount: line.glAccount, projectCode: line.projectCode,
      available: availableExcludingSelf, requested: pr.estimatedValue, checkedAt: today(),
    };
    return pr.budgetCheck;
  }

  function reserveBudget(pr) {
    const line = findBudgetLine(pr.department);
    if (!line) return;
    line.reserved += pr.estimatedValue;
    pr.budgetReservedAmount = pr.estimatedValue;
  }

  function releaseBudgetReservation(pr) {
    const line = findBudgetLine(pr.department);
    if (line) line.reserved = Math.max(0, line.reserved - (pr.budgetReservedAmount || 0));
    pr.budgetReservedAmount = 0;
  }

  function commitBudgetToUsed(pr) {
    const line = findBudgetLine(pr.department);
    if (line) {
      line.reserved = Math.max(0, line.reserved - (pr.budgetReservedAmount || 0));
      line.used += (pr.budgetReservedAmount || 0);
    }
    pr.budgetReservedAmount = 0;
  }

  // Called whenever a PR becomes Submitted, from any module.
  function enterApprovalPipeline(pr) {
    pr.approval = { currentLevel: APPROVAL_LEVELS[0], steps: buildFreshApprovalSteps() };
    pr.approvalHistory = pr.approvalHistory || [];
    runBudgetCheck(pr);
    reserveBudget(pr);
    if (pr.budgetCheck.status === 'Insufficient') {
      notifyInfo('Budget check failed on submit', pr.prNumber + ' exceeds available budget for ' + pr.department + ' — validate it in Budget Verification (Module 5) before it can be approved.', 'warning');
    }
  }

  function seedQuotationStubs(rfq) {
    rfq.vendorIds.forEach((vendorId) => {
      state.quotations.push({
        id: 'quo-' + rfq.id + '-' + vendorId,
        rfqId: rfq.id, vendorId,
        price: 0, leadTimeDays: 0, tax: 0, discount: 0, warrantyMonths: 0,
        validityDate: '', technicalOffer: '', commercialOffer: '', attachmentName: '',
        status: 'Pending', receivedDate: null,
        technicallyQualified: null, recommended: false, negotiatedPrice: null,
      });
    });
  }

  function recomputeRfqQuotationsReceived(rfqId) {
    const rfq = state.rfqs.find((r) => r.id === rfqId);
    if (!rfq) return;
    rfq.quotationsReceived = state.quotations.filter((q) => q.rfqId === rfqId && q.status !== 'Pending').length;
  }

  function freshSelection() {
    return {
      status: 'Not Started', // 'Not Started' | 'Under Review' | 'Approved' | 'Awarded'
      committeeReviews: [], negotiations: [],
      proposedVendorId: null, approvedVendorId: null, approvedBy: null, approvedDate: null,
      finalVendorId: null, finalPrice: null, awardedDate: null,
    };
  }

  const actions = {
    // ── Module 4: Approval Workflow engine ────────────────────
    approveCurrentLevel(prId, opts) {
      opts = opts || {};
      const pr = state.prs.find((p) => p.id === prId);
      if (!pr) return;
      const step = currentPendingStep(pr);
      if (!step) return;

      if (pr.budgetCheck && pr.budgetCheck.status === 'Insufficient') {
        notifyInfo('Approval blocked', pr.prNumber + ' cannot be approved — budget is insufficient. Validate or override it in Budget Verification (Module 5) first.', 'warning');
        notify();
        return;
      }

      step.status = 'Approved';
      step.actedAt = today();
      step.comment = opts.comment || '';
      step.signature = opts.signature || '';
      logHistory(pr, step.level, 'Approved', opts.signature || step.approver, opts.comment);

      const next = currentPendingStep(pr);
      if (next) {
        pr.approval.currentLevel = next.level;
      } else {
        pr.status = 'Approved';
        pr.approval.currentLevel = 'Completed';
        commitBudgetToUsed(pr);
      }
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PR Approved', refNumber: pr.prNumber,
        actor: opts.signature || 'You', timestamp: today(),
        detail: step.level + ' approved' + (next ? ' — now with ' + next.level : ' — fully approved'),
      });
      notify();
    },

    rejectCurrentLevel(prId, opts) {
      opts = opts || {};
      const pr = state.prs.find((p) => p.id === prId);
      if (!pr) return;
      const step = currentPendingStep(pr);
      if (!step) return;
      step.status = 'Rejected';
      step.actedAt = today();
      step.comment = opts.comment || '';
      step.signature = opts.signature || '';
      logHistory(pr, step.level, 'Rejected', opts.signature || step.approver, opts.comment);

      pr.status = 'Rejected';
      pr.approval.currentLevel = 'Completed';
      releaseBudgetReservation(pr);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PR Rejected', refNumber: pr.prNumber,
        actor: opts.signature || 'You', timestamp: today(),
        detail: opts.comment || (step.level + ' rejected the request'),
      });
      notify();
    },

    returnCurrentLevel(prId, opts) {
      opts = opts || {};
      const pr = state.prs.find((p) => p.id === prId);
      if (!pr) return;
      const step = currentPendingStep(pr);
      if (!step) return;
      logHistory(pr, step.level, 'Returned', opts.signature || step.approver, opts.comment);

      releaseBudgetReservation(pr);
      pr.status = 'Draft';
      pr.approval = { currentLevel: APPROVAL_LEVELS[0], steps: [] };
      pr.budgetCheck = null;
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PR Rejected', refNumber: pr.prNumber,
        actor: opts.signature || 'You', timestamp: today(),
        detail: 'Returned to requester for revision: ' + (opts.comment || 'no comment provided'),
      });
      notify();
    },

    forwardCurrentLevel(prId, opts) {
      opts = opts || {};
      const pr = state.prs.find((p) => p.id === prId);
      if (!pr) return;
      const step = currentPendingStep(pr);
      if (!step || !opts.forwardTo) return;
      const fromApprover = step.approver;
      step.approver = opts.forwardTo;
      logHistory(pr, step.level, 'Forwarded', opts.signature || fromApprover, (opts.comment || '') + ' (to ' + opts.forwardTo + ')');
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PR Submitted', refNumber: pr.prNumber,
        actor: opts.signature || fromApprover, timestamp: today(),
        detail: step.level + ' forwarded from ' + fromApprover + ' to ' + opts.forwardTo,
      });
      notify();
    },

    // Quick-action aliases used by the Dashboard (Module 1) and PR
    // list (Module 3) icon buttons — same engine, default signature,
    // so the budget gate above applies to them too.
    approvePR(prId) {
      actions.approveCurrentLevel(prId, { comment: 'Approved via quick action', signature: 'Rahul Mehta' });
    },
    rejectPR(prId, comment) {
      actions.rejectCurrentLevel(prId, { comment: comment || 'Rejected via quick action', signature: 'Rahul Mehta' });
    },

    markNotificationRead(id) {
      const n = state.notifications.find((x) => x.id === id);
      if (n) n.read = true;
      notify();
    },

    markAllNotificationsRead() {
      state.notifications.forEach((n) => (n.read = true));
      notify();
    },

    // ── Module 2: Department Requirement ──────────────────────
    createRequirement(payload, status) {
      const seq = state.requirements.length + 2001;
      const req = {
        id: 'req-new-' + Date.now(),
        requirementNo: 'DR-2026-' + seq,
        date: today(),
        department: payload.department,
        requestedBy: payload.requestedBy,
        costCenter: payload.costCenter,
        project: payload.project || undefined,
        priority: payload.priority,
        requiredDate: payload.requiredDate,
        itemCategory: payload.itemCategory,
        justification: payload.justification,
        items: payload.items,
        status: status, // 'Draft' | 'Submitted'
        convertedPrId: undefined,
        attachments: payload.attachments || [],
      };
      state.requirements.unshift(req);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: status === 'Draft' ? 'Requirement Drafted' : 'Requirement Submitted',
        refNumber: req.requirementNo, actor: 'You', timestamp: req.date,
        detail: req.department + ' raised a requirement for ' + req.items.length + ' item(s)',
      });
      notify();
      return req.id;
    },

    submitRequirement(reqId) {
      const req = state.requirements.find((r) => r.id === reqId);
      if (!req || req.status !== 'Draft') return;
      req.status = 'Submitted';
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Requirement Submitted', refNumber: req.requirementNo,
        actor: 'You', timestamp: today(), detail: 'Draft submitted for review',
      });
      notify();
    },

    rejectRequirement(reqId, reason) {
      const req = state.requirements.find((r) => r.id === reqId);
      if (!req || req.status !== 'Submitted') return;
      req.status = 'Rejected';
      req.rejectionReason = reason || 'Rejected by reviewer';
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Requirement Rejected', refNumber: req.requirementNo,
        actor: 'You', timestamp: today(), detail: req.rejectionReason,
      });
      notify();
    },

    // The real cross-module link: turns a Submitted requirement into a
    // live Purchase Requisition that the Dashboard (Module 1) picks up
    // immediately — Pending Approvals, PR Pending KPI, the funnel, etc.
    convertRequirementToPR(reqId) {
      const req = state.requirements.find((r) => r.id === reqId);
      if (!req || req.status !== 'Submitted') return null;

      const items = req.items.map((it) => ({
        materialCode: it.itemCode, description: it.description, qty: it.qty, unit: it.unit,
        price: it.estimatedPrice, tax: Math.round(it.estimatedPrice * it.qty * 0.18),
        discount: Math.round(it.estimatedPrice * it.qty * 0.02), requiredDate: req.requiredDate,
      }));
      const estimatedValue = items.reduce((s, it) => s + it.price * it.qty + it.tax - it.discount, 0);
      const prId = 'pr-new-' + Date.now();
      const prNumber = 'PR-2026-' + (1000 + state.prs.length);

      const pr = {
        id: prId, prNumber, prDate: today(),
        department: req.department, requester: req.requestedBy, budgetCode: req.costCenter,
        currency: 'INR', deliveryLocation: (req.items[0] && req.items[0].warehouse) || 'Chennai Plant 1',
        items, status: 'Submitted',
        estimatedValue, linkedRfqId: undefined, sourceRequirementId: req.id,
      };
      enterApprovalPipeline(pr);
      state.prs.unshift(pr);
      req.status = 'Converted';
      req.convertedPrId = prId;

      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PR Submitted', refNumber: prNumber, actor: 'You',
        timestamp: pr.prDate, detail: 'Converted from requirement ' + req.requirementNo + ' for ' + Format.inr(estimatedValue),
      });
      notify();
      return prId;
    },

    // ── Module 3: Purchase Requisition ────────────────────────
    createPR(payload, status) {
      const items = payload.items.map((it) => ({
        materialCode: it.materialCode, description: it.description, qty: it.qty, unit: it.unit,
        price: it.price, tax: it.tax, discount: it.discount, requiredDate: it.requiredDate,
      }));
      const estimatedValue = items.reduce((s, it) => s + it.price * it.qty + it.tax - it.discount, 0);
      const prId = 'pr-new-' + Date.now();
      const prNumber = 'PR-2026-' + (1000 + state.prs.length);

      const pr = {
        id: prId, prNumber, prDate: payload.prDate, department: payload.department,
        requester: payload.requester, budgetCode: payload.budgetCode, currency: payload.currency,
        deliveryLocation: payload.deliveryLocation, items, status,
        approval: { currentLevel: APPROVAL_LEVELS[0], steps: [] },
        approvalHistory: [],
        estimatedValue, linkedRfqId: undefined, sourceRequirementId: undefined,
        budgetCheck: null,
      };
      if (status === 'Submitted') enterApprovalPipeline(pr);
      state.prs.unshift(pr);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PR Submitted', refNumber: prNumber, actor: 'You',
        timestamp: pr.prDate, detail: (status === 'Draft' ? 'Draft saved' : 'Raised directly') + ' for ' + Format.inr(estimatedValue),
      });
      notify();
      return prId;
    },

    submitDraftPR(prId) {
      const pr = state.prs.find((p) => p.id === prId);
      if (!pr || pr.status !== 'Draft') return;
      pr.status = 'Submitted';
      enterApprovalPipeline(pr);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PR Submitted', refNumber: pr.prNumber,
        actor: 'You', timestamp: today(), detail: 'Draft submitted for approval',
      });
      notify();
    },

    closePR(prId) {
      const pr = state.prs.find((p) => p.id === prId);
      if (!pr || pr.status !== 'Approved') return;
      pr.status = 'Closed';
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PR Approved', refNumber: pr.prNumber,
        actor: 'You', timestamp: today(), detail: 'PR closed out',
      });
      notify();
    },

    // ── Module 5: Budget Verification ─────────────────────────
    revalidateBudget(prId) {
      const pr = state.prs.find((p) => p.id === prId);
      if (!pr || pr.status !== 'Submitted') return;
      runBudgetCheck(pr);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PR Submitted', refNumber: pr.prNumber,
        actor: 'You', timestamp: today(), detail: 'Budget re-validated — ' + pr.budgetCheck.status,
      });
      notify();
    },

    overrideBudgetCheck(prId, opts) {
      opts = opts || {};
      const pr = state.prs.find((p) => p.id === prId);
      if (!pr || !pr.budgetCheck || pr.budgetCheck.status !== 'Insufficient') return;
      pr.budgetCheck.status = 'Overridden';
      pr.budgetCheck.overrideBy = opts.signature || 'Unsigned';
      pr.budgetCheck.overrideComment = opts.comment || '';
      logHistory(pr, 'Finance', 'Budget Override', opts.signature || 'Finance', opts.comment);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PR Approved', refNumber: pr.prNumber,
        actor: opts.signature || 'Finance', timestamp: today(),
        detail: 'Budget shortfall overridden: ' + (opts.comment || 'no comment provided'),
      });
      notify();
    },

    rejectFromBudgetCheck(prId, opts) {
      actions.rejectCurrentLevel(prId, opts);
    },

    // ── Module 6: Vendor Management ───────────────────────────
    registerVendor(payload, status) {
      const vendor = {
        id: 'v-new-' + Date.now(),
        name: payload.name,
        category: payload.category,
        city: payload.city,
        registrationDate: today(),
        gst: payload.gst, pan: payload.pan, tradeLicense: payload.tradeLicense,
        bankDetails: {
          accountHolder: payload.accountHolder, accountNumber: payload.accountNumber,
          ifsc: payload.ifsc, bankName: payload.bankName, branch: payload.branch,
        },
        contacts: payload.contacts,
        rating: 0, onTimeDeliveryPct: 0, qualityScore: 0,
        riskTier: 'Low', riskNote: '',
        approvalStatus: status, // 'Draft' | 'Pending'
        blacklistReason: undefined,
        activePOs: 0, totalSpendYtd: 0,
        performanceReviews: [], activityLog: [],
      };
      state.vendors.unshift(vendor);
      logVendorActivity(vendor, status === 'Draft' ? 'Registered (Draft)' : 'Submitted for Approval', 'You', '');
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Vendor Registered', refNumber: vendor.name,
        actor: 'You', timestamp: today(), detail: (status === 'Draft' ? 'Draft saved' : 'Submitted for approval') + ' — ' + vendor.category,
      });
      notify();
      return vendor.id;
    },

    updateVendorRisk(vendorId, opts) {
      opts = opts || {};
      const v = state.vendors.find((x) => x.id === vendorId);
      if (!v || !['Low', 'Medium', 'High'].includes(opts.riskTier)) return false;
      const previousTier = v.riskTier;
      v.riskTier = opts.riskTier;
      v.riskNote = opts.riskNote || '';
      logVendorActivity(v, 'Risk Rating Updated', opts.signature || 'You', previousTier + ' → ' + v.riskTier + (v.riskNote ? ' — ' + v.riskNote : ''));
      notify();
      return true;
    },

    submitVendorDraft(vendorId) {
      const v = state.vendors.find((x) => x.id === vendorId);
      if (!v || v.approvalStatus !== 'Draft') return;
      v.approvalStatus = 'Pending';
      logVendorActivity(v, 'Submitted for Approval', 'You', '');
      notify();
    },

    approveVendor(vendorId, opts) {
      opts = opts || {};
      const v = state.vendors.find((x) => x.id === vendorId);
      if (!v || v.approvalStatus !== 'Pending') return;
      if (!opts.coiDeclared) return; // conflict-of-interest declaration is mandatory before vendor approval
      v.approvalStatus = 'Approved';
      v.coiDeclaration = { declaredBy: opts.signature || 'You', date: today() };
      logVendorActivity(v, 'Approved', opts.signature || 'You', opts.comment);
      logVendorActivity(v, 'Conflict of Interest Declared', opts.signature || 'You', 'No personal/financial relationship with this vendor declared');
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Vendor Registered', refNumber: v.name,
        actor: opts.signature || 'You', timestamp: today(), detail: 'Vendor approved and added to the active master list',
      });
      notify();
    },

    rejectVendor(vendorId, opts) {
      opts = opts || {};
      const v = state.vendors.find((x) => x.id === vendorId);
      if (!v || v.approvalStatus !== 'Pending') return;
      v.approvalStatus = 'Rejected';
      logVendorActivity(v, 'Rejected', opts.signature || 'You', opts.comment);
      notify();
    },

    blacklistVendor(vendorId, opts) {
      opts = opts || {};
      const v = state.vendors.find((x) => x.id === vendorId);
      if (!v || v.approvalStatus !== 'Approved') return;
      v.approvalStatus = 'Blacklisted';
      v.blacklistReason = opts.comment || 'No reason provided';
      logVendorActivity(v, 'Blacklisted', opts.signature || 'You', opts.comment);
      notifyInfo('Vendor blacklisted', v.name + ' has been blacklisted and will not be selectable in RFQ/PO workflows.', 'warning');
      notify();
    },

    reinstateVendor(vendorId, opts) {
      opts = opts || {};
      const v = state.vendors.find((x) => x.id === vendorId);
      if (!v || v.approvalStatus !== 'Blacklisted') return;
      v.approvalStatus = 'Approved';
      v.blacklistReason = undefined;
      logVendorActivity(v, 'Reinstated', opts.signature || 'You', opts.comment);
      notify();
    },

    addPerformanceReview(vendorId, opts) {
      opts = opts || {};
      const v = state.vendors.find((x) => x.id === vendorId);
      if (!v) return;
      const review = {
        id: 'rev-' + Date.now(), date: today(),
        ratingGiven: Number(opts.ratingGiven) || 0,
        qualityScore: Number(opts.qualityScore) || 0,
        onTime: !!opts.onTime,
        notes: opts.notes || '',
        reviewer: opts.reviewer || 'You',
      };
      v.performanceReviews.unshift(review);
      v.rating = Number((v.performanceReviews.reduce((s, r) => s + r.ratingGiven, 0) / v.performanceReviews.length).toFixed(1));
      v.qualityScore = Math.round(v.performanceReviews.reduce((s, r) => s + r.qualityScore, 0) / v.performanceReviews.length);
      v.onTimeDeliveryPct = Math.round((v.performanceReviews.filter((r) => r.onTime).length / v.performanceReviews.length) * 100);
      logVendorActivity(v, 'Performance Review Added', review.reviewer, review.notes);
      notify();
    },

    // ── Module 7: Request for Quotation ───────────────────────
    createRFQ(payload, status) {
      const pr = state.prs.find((p) => p.id === payload.prId);
      if (!pr || pr.status !== 'Approved' || pr.linkedRfqId) return null;

      const rfqId = 'rfq-new-' + Date.now();
      const rfqNumber = 'RFQ-2026-' + (500 + state.rfqs.length);
      const rfq = {
        id: rfqId, rfqNumber,
        issueDate: payload.issueDate, closingDate: payload.closingDate,
        buyer: payload.buyer, vendorIds: payload.vendorIds,
        deliveryTerms: payload.deliveryTerms, paymentTerms: payload.paymentTerms, incoterms: payload.incoterms,
        items: pr.items.map((it) => ({ materialCode: it.materialCode, description: it.description, qty: it.qty, unit: it.unit })),
        status, // 'Draft' | 'Issued'
        linkedPrId: pr.id,
        quotationsReceived: 0,
        activityLog: [],
        selection: freshSelection(),
      };
      state.rfqs.unshift(rfq);
      pr.linkedRfqId = rfqId;
      seedQuotationStubs(rfq);

      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'RFQ Issued', refNumber: rfqNumber, actor: 'You', timestamp: today(),
        detail: (status === 'Draft' ? 'Drafted' : 'Issued') + ' to ' + payload.vendorIds.length + ' vendor(s) for ' + pr.prNumber,
      });
      notify();
      return rfqId;
    },

    issueRFQDraft(rfqId) {
      const rfq = state.rfqs.find((r) => r.id === rfqId);
      if (!rfq || rfq.status !== 'Draft') return;
      rfq.status = 'Issued';
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'RFQ Issued', refNumber: rfq.rfqNumber, actor: 'You', timestamp: today(),
        detail: 'Draft issued to ' + rfq.vendorIds.length + ' vendor(s)',
      });
      notify();
    },

    closeRFQ(rfqId) {
      const rfq = state.rfqs.find((r) => r.id === rfqId);
      if (!rfq || rfq.status !== 'Issued') return;
      rfq.status = 'Closed';
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'RFQ Issued', refNumber: rfq.rfqNumber, actor: 'You', timestamp: today(),
        detail: 'Closed for bidding',
      });
      notify();
    },

    cancelRFQ(rfqId, opts) {
      opts = opts || {};
      const rfq = state.rfqs.find((r) => r.id === rfqId);
      if (!rfq || rfq.status === 'Cancelled' || rfq.status === 'Closed') return;
      rfq.status = 'Cancelled';
      const pr = state.prs.find((p) => p.id === rfq.linkedPrId);
      if (pr && pr.linkedRfqId === rfqId) pr.linkedRfqId = undefined; // free the PR up for a new RFQ attempt
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'RFQ Issued', refNumber: rfq.rfqNumber, actor: 'You', timestamp: today(),
        detail: 'Cancelled: ' + (opts.comment || 'no reason provided'),
      });
      notify();
    },

    duplicateRFQ(rfqId) {
      const src = state.rfqs.find((r) => r.id === rfqId);
      if (!src) return null;
      const newId = 'rfq-new-' + Date.now();
      const copy = {
        ...src, id: newId, rfqNumber: 'RFQ-2026-' + (500 + state.rfqs.length),
        status: 'Draft', linkedPrId: undefined, quotationsReceived: 0, activityLog: [],
        issueDate: today(), closingDate: today(), selection: freshSelection(),
      };
      state.rfqs.unshift(copy);
      seedQuotationStubs(copy);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'RFQ Issued', refNumber: copy.rfqNumber, actor: 'You', timestamp: today(),
        detail: 'Duplicated from ' + src.rfqNumber + ' (not linked to a PR — edit terms and issue when ready)',
      });
      notify();
      return newId;
    },

    // ── Module 8: Quotation Management ────────────────────────
    submitQuotation(quotationId, payload) {
      const q = state.quotations.find((x) => x.id === quotationId);
      if (!q) return;
      q.price = Number(payload.price) || 0;
      q.leadTimeDays = Number(payload.leadTimeDays) || 0;
      q.tax = Number(payload.tax) || 0;
      q.discount = Number(payload.discount) || 0;
      q.warrantyMonths = Number(payload.warrantyMonths) || 0;
      q.validityDate = payload.validityDate || '';
      q.technicalOffer = payload.technicalOffer || '';
      q.commercialOffer = payload.commercialOffer || '';
      q.attachmentName = payload.attachmentName || q.attachmentName;
      q.status = 'Received';
      q.receivedDate = today();
      recomputeRfqQuotationsReceived(q.rfqId);

      const vendor = state.vendors.find((v) => v.id === q.vendorId);
      const rfq = state.rfqs.find((r) => r.id === q.rfqId);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Quotation Received', refNumber: rfq ? rfq.rfqNumber : q.rfqId,
        actor: vendor ? vendor.name : 'Vendor', timestamp: today(),
        detail: 'Quote received: ' + Format.inr(q.price) + ', ' + q.leadTimeDays + ' day lead time',
      });
      notify();
    },

    rejectQuotation(quotationId, opts) {
      opts = opts || {};
      const q = state.quotations.find((x) => x.id === quotationId);
      if (!q) return;
      q.status = 'Rejected';
      q.rejectReason = opts.comment || '';
      recomputeRfqQuotationsReceived(q.rfqId);
      notify();
    },

    acceptQuotation(quotationId, opts) {
      opts = opts || {};
      const q = state.quotations.find((x) => x.id === quotationId);
      if (!q || q.status !== 'Received') return;
      q.status = 'Accepted';
      recomputeRfqQuotationsReceived(q.rfqId);
      const vendor = state.vendors.find((v) => v.id === q.vendorId);
      const rfq = state.rfqs.find((r) => r.id === q.rfqId);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Quotation Received', refNumber: rfq ? rfq.rfqNumber : q.rfqId,
        actor: opts.signature || 'You', timestamp: today(),
        detail: (vendor ? vendor.name : 'Vendor') + "'s quotation marked Accepted" + (opts.comment ? ' — ' + opts.comment : ''),
      });
      notify();
    },

    // ── Module 9: Quotation Comparison ────────────────────────
    setTechnicalQualification(quotationId, qualified) {
      const q = state.quotations.find((x) => x.id === quotationId);
      if (!q) return;
      q.technicallyQualified = qualified;
      notify();
    },

    toggleRecommended(quotationId) {
      const q = state.quotations.find((x) => x.id === quotationId);
      if (!q) return;
      q.recommended = !q.recommended;
      if (q.recommended) {
        const vendor = state.vendors.find((v) => v.id === q.vendorId);
        const rfq = state.rfqs.find((r) => r.id === q.rfqId);
        state.activity.unshift({
          id: 'act-' + Date.now(), type: 'Quotation Received', refNumber: rfq ? rfq.rfqNumber : q.rfqId,
          actor: 'You', timestamp: today(),
          detail: (vendor ? vendor.name : 'Vendor') + ' marked as recommended vendor from comparison',
        });
      }
      notify();
    },

    // ── Module 10: Vendor Selection ───────────────────────────
    addCommitteeReview(rfqId, opts) {
      opts = opts || {};
      const rfq = state.rfqs.find((r) => r.id === rfqId);
      if (!rfq || !opts.vendorId) return;
      rfq.selection.committeeReviews.unshift({
        id: 'rev-' + Date.now(), reviewer: opts.reviewer || 'Unnamed Reviewer', role: opts.role || 'Procurement Officer',
        vendorId: opts.vendorId, comment: opts.comment || '', date: today(),
      });
      if (rfq.selection.status === 'Not Started') rfq.selection.status = 'Under Review';
      notify();
    },

    recordNegotiation(rfqId, opts) {
      opts = opts || {};
      const rfq = state.rfqs.find((r) => r.id === rfqId);
      if (!rfq || !opts.vendorId) return;
      const q = state.quotations.find((x) => x.rfqId === rfqId && x.vendorId === opts.vendorId);
      if (!q) return;
      const fromPrice = q.negotiatedPrice || q.price;
      const toPrice = Number(opts.toPrice) || fromPrice;
      rfq.selection.negotiations.unshift({
        id: 'neg-' + Date.now(), vendorId: opts.vendorId, fromPrice, toPrice,
        notes: opts.notes || '', date: today(), by: opts.by || 'You',
      });
      q.negotiatedPrice = toPrice;
      const vendor = state.vendors.find((v) => v.id === opts.vendorId);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Quotation Received', refNumber: rfq.rfqNumber, actor: opts.by || 'You',
        timestamp: today(), detail: 'Negotiated ' + (vendor ? vendor.name : 'vendor') + ' from ' + Format.inr(fromPrice) + ' to ' + Format.inr(toPrice),
      });
      notify();
    },

    approveVendorSelection(rfqId, opts) {
      opts = opts || {};
      const rfq = state.rfqs.find((r) => r.id === rfqId);
      if (!rfq || !opts.vendorId || rfq.selection.committeeReviews.length === 0) return;
      rfq.selection.status = 'Approved';
      rfq.selection.approvedVendorId = opts.vendorId;
      rfq.selection.approvedBy = opts.signature || 'Unsigned';
      rfq.selection.approvedDate = today();
      const vendor = state.vendors.find((v) => v.id === opts.vendorId);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Quotation Received', refNumber: rfq.rfqNumber, actor: opts.signature || 'You',
        timestamp: today(), detail: 'Vendor selection approved: ' + (vendor ? vendor.name : opts.vendorId) + (opts.comment ? ' — ' + opts.comment : ''),
      });
      notify();
    },

    awardVendor(rfqId) {
      const rfq = state.rfqs.find((r) => r.id === rfqId);
      if (!rfq || rfq.selection.status !== 'Approved') return;
      const vendorId = rfq.selection.approvedVendorId;
      const q = state.quotations.find((x) => x.rfqId === rfqId && x.vendorId === vendorId);
      rfq.selection.status = 'Awarded';
      rfq.selection.finalVendorId = vendorId;
      rfq.selection.finalPrice = q ? (q.negotiatedPrice || q.price) + q.tax - q.discount : 0;
      rfq.selection.awardedDate = today();
      const vendor = state.vendors.find((v) => v.id === vendorId);
      if (vendor) vendor.activePOs += 1;
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Quotation Received', refNumber: rfq.rfqNumber, actor: 'You',
        timestamp: today(), detail: 'Awarded to ' + (vendor ? vendor.name : vendorId) + ' at ' + Format.inr(rfq.selection.finalPrice),
      });
      notifyInfo('Vendor awarded', rfq.rfqNumber + ' awarded to ' + (vendor ? vendor.name : vendorId) + '. Ready for Purchase Order in Module 11.', 'info');
      notify();
    },

    // ── Module 11: Purchase Order ─────────────────────────────
    createPO(rfqId, payload) {
      payload = payload || {};
      const rfq = state.rfqs.find((r) => r.id === rfqId);
      if (!rfq || rfq.selection.status !== 'Awarded' || rfq.linkedPoId) return null;
      const q = state.quotations.find((x) => x.rfqId === rfqId && x.vendorId === rfq.selection.finalVendorId);
      const vendor = state.vendors.find((v) => v.id === rfq.selection.finalVendorId);
      if (!q || !vendor) return null;
      const pr = rfq.linkedPrId ? state.prs.find((p) => p.id === rfq.linkedPrId) : null;

      const subtotal = q.negotiatedPrice || q.price;
      const taxTotal = q.tax || 0;
      const discountTotal = q.discount || 0;
      const total = subtotal + taxTotal - discountTotal;

      const poId = 'po-new-' + Date.now();
      const poNumber = 'PO-2026-' + (700 + state.pos.length);
      const po = {
        id: poId, poNumber, poDate: today(), poType: 'Goods',
        department: pr ? pr.department : 'Procurement', vendorId: vendor.id,
        sourceRfqId: rfq.id, sourcePrId: pr ? pr.id : null,
        items: rfq.items.map((it) => ({ ...it })),
        subtotal, taxTotal, discountTotal, total, currency: 'INR',
        deliveryLocation: payload.deliveryLocation || (pr ? pr.deliveryLocation : 'Chennai Plant 1'),
        deliveryTerms: rfq.deliveryTerms, paymentTerms: payload.paymentTerms || rfq.paymentTerms, incoterms: rfq.incoterms,
        status: 'Open', grnStatus: 'Pending',
        approval: { status: 'Pending', approver: 'Rahul Mehta', actedAt: null, comment: '' },
        vendorAcceptance: { status: 'Pending', date: null, note: '' },
        activityLog: [{ action: 'PO Created', actor: 'You', comment: 'Generated from ' + rfq.rfqNumber, timestamp: today() }],
      };
      state.pos.unshift(po);
      rfq.linkedPoId = poId;

      // Budget reconciliation: swap the PR's original estimate reservation
      // for the real negotiated PO amount now that it's known.
      if (pr) {
        const line = findBudgetLine(pr.department);
        if (line) {
          line.reserved = Math.max(0, line.reserved - (pr.budgetReservedAmount || 0));
          line.reserved += total;
        }
        pr.budgetReservedAmount = total;
      }
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PO Created', refNumber: poNumber, actor: 'You', timestamp: today(),
        detail: 'Raised against ' + vendor.name + ' for ' + Format.inr(total) + ' from ' + rfq.rfqNumber,
      });
      notify();
      return poId;
    },

    approvePO(poId, opts) {
      opts = opts || {};
      const po = state.pos.find((p) => p.id === poId);
      if (!po || po.status !== 'Open') return;
      if (!opts.coiDeclared) return; // conflict-of-interest declaration is mandatory before internal approval
      po.status = 'Approved';
      po.approval.status = 'Approved';
      po.approval.actedAt = today();
      po.approval.comment = opts.comment || '';
      po.approval.approver = opts.signature || po.approval.approver;
      po.approval.coiDeclaration = { declaredBy: opts.signature || 'You', note: opts.coiNote || '', date: today() };
      po.activityLog.unshift({ action: 'PO Approved', actor: opts.signature || 'You', comment: opts.comment || '', timestamp: today() });
      po.activityLog.unshift({ action: 'Conflict of Interest Declared', actor: opts.signature || 'You', comment: 'No personal/financial relationship with this vendor declared' + (opts.coiNote ? ' — ' + opts.coiNote : ''), timestamp: today() });

      // Commit the reservation to "used" and recognize vendor spend now
      // that the order is internally approved. A contract call-off or
      // Service PO has no source PR (so nothing was "reserved"), but
      // its spend still needs to hit the department's budget directly
      // or Module 5 / Reports would silently disagree on what's spent.
      const pr = po.sourcePrId ? state.prs.find((p) => p.id === po.sourcePrId) : null;
      if (pr) {
        commitBudgetToUsed(pr);
      } else {
        const line = findBudgetLine(po.department);
        if (line) line.used += po.total;
      }
      const vendor = state.vendors.find((v) => v.id === po.vendorId);
      if (vendor) vendor.totalSpendYtd += po.total;

      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PO Approved', refNumber: po.poNumber, actor: opts.signature || 'You',
        timestamp: today(), detail: 'Internally approved for ' + Format.inr(po.total),
      });
      notify();
    },

    rejectPO(poId, opts) {
      opts = opts || {};
      const po = state.pos.find((p) => p.id === poId);
      if (!po || po.status !== 'Open') return;
      actions.cancelPO(poId, Object.assign({}, opts, { reason: opts.comment || 'Rejected at internal approval' }));
    },

    releasePO(poId) {
      const po = state.pos.find((p) => p.id === poId);
      if (!po || po.status !== 'Approved') return;
      po.status = 'Released';
      po.activityLog.unshift({ action: 'PO Released to Vendor', actor: 'You', comment: '', timestamp: today() });
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PO Approved', refNumber: po.poNumber, actor: 'You', timestamp: today(),
        detail: 'Released to vendor — ready for delivery tracking in Module 12',
      });
      notifyInfo('PO released', po.poNumber + ' has been released to the vendor. Track its shipment in Delivery Tracking (Module 12).', 'info');
      notify();
    },

    recordVendorAcceptance(poId, opts) {
      opts = opts || {};
      const po = state.pos.find((p) => p.id === poId);
      if (!po || po.status !== 'Released') return;
      po.vendorAcceptance = { status: opts.status === 'Declined' ? 'Declined' : 'Accepted', date: today(), note: opts.note || '' };
      po.activityLog.unshift({ action: 'Vendor ' + po.vendorAcceptance.status, actor: 'Vendor Portal', comment: opts.note || '', timestamp: today() });
      notify();
    },

    cancelPO(poId, opts) {
      opts = opts || {};
      const po = state.pos.find((p) => p.id === poId);
      if (!po || po.status === 'Released' || po.status === 'Closed' || po.status === 'Cancelled') return;
      const wasApproved = po.status === 'Approved';
      po.status = 'Cancelled';
      po.activityLog.unshift({ action: 'PO Cancelled', actor: opts.signature || 'You', comment: opts.reason || opts.comment || '', timestamp: today() });

      const pr = po.sourcePrId ? state.prs.find((p) => p.id === po.sourcePrId) : null;
      const line = findBudgetLine(po.department);
      if (pr) {
        if (line) {
          if (wasApproved) line.used = Math.max(0, line.used - po.total);
          else line.reserved = Math.max(0, line.reserved - (pr.budgetReservedAmount || 0));
        }
        pr.budgetReservedAmount = 0;
      } else if (line && wasApproved) {
        line.used = Math.max(0, line.used - po.total);
      }
      const vendor = state.vendors.find((v) => v.id === po.vendorId);
      if (vendor) {
        vendor.activePOs = Math.max(0, vendor.activePOs - 1);
        if (wasApproved) vendor.totalSpendYtd = Math.max(0, vendor.totalSpendYtd - po.total);
      }
      const rfq = po.sourceRfqId ? state.rfqs.find((r) => r.id === po.sourceRfqId) : null;
      if (rfq) rfq.linkedPoId = undefined;

      if (po.sourceContractId) {
        const c = state.contracts.find((x) => x.id === po.sourceContractId);
        if (c) {
          c.consumedValue = Math.max(0, c.consumedValue - po.total);
          c.consumedQty = Math.max(0, c.consumedQty - po.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0));
          c.activityLog.unshift({ action: 'Call-off Cancelled', actor: opts.signature || 'You', comment: po.poNumber + ' — balance released', timestamp: today() });
        }
      }

      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PR Rejected', refNumber: po.poNumber, actor: opts.signature || 'You',
        timestamp: today(), detail: 'PO cancelled: ' + (opts.reason || opts.comment || 'no reason provided'),
      });
      notify();
    },

    // Amend an already-approved/released PO — price, terms, or
    // delivery details changed after the fact (a real and common
    // event in procurement: a vendor renegotiates, a quantity
    // changes, a delivery date slips). Locked once an invoice has
    // actually been verified or paid against the original figures —
    // amend before that point, or raise a fresh PO after.
    amendPO(poId, opts) {
      opts = opts || {};
      const po = state.pos.find((p) => p.id === poId);
      if (!po || (po.status !== 'Approved' && po.status !== 'Released')) return null;
      const lockedInvoice = state.invoices.some((inv) => inv.poId === poId && (inv.status === 'Verified' || inv.status === 'Paid'));
      if (lockedInvoice) return null;

      const oldTotal = po.total;
      const subtotal = opts.subtotal !== undefined && opts.subtotal !== '' ? Number(opts.subtotal) : po.subtotal;
      const taxTotal = opts.taxTotal !== undefined && opts.taxTotal !== '' ? Number(opts.taxTotal) : po.taxTotal;
      const discountTotal = opts.discountTotal !== undefined && opts.discountTotal !== '' ? Number(opts.discountTotal) : po.discountTotal;
      const newTotal = subtotal + taxTotal - discountTotal;

      const snapshot = {
        subtotal: po.subtotal, taxTotal: po.taxTotal, discountTotal: po.discountTotal, total: po.total,
        deliveryLocation: po.deliveryLocation, paymentTerms: po.paymentTerms, deliveryTerms: po.deliveryTerms,
      };

      po.subtotal = subtotal; po.taxTotal = taxTotal; po.discountTotal = discountTotal; po.total = newTotal;
      if (opts.deliveryLocation) po.deliveryLocation = opts.deliveryLocation;
      if (opts.paymentTerms) po.paymentTerms = opts.paymentTerms;
      if (opts.deliveryTerms) po.deliveryTerms = opts.deliveryTerms;

      po.amendments = po.amendments || [];
      po.amendments.unshift({
        previous: snapshot, newTotal, reason: opts.reason || 'No reason provided', signature: opts.signature || 'You', timestamp: today(),
      });
      po.activityLog.unshift({ action: 'PO Amended', actor: opts.signature || 'You', comment: (opts.reason || '') + ' — total ' + Format.inr(oldTotal) + ' → ' + Format.inr(newTotal), timestamp: today() });

      // Reconcile budget "used" and vendor spend to the new total —
      // the PO was already approved (committed to used, credited to
      // vendor spend), so only the delta needs adjusting.
      const pr = po.sourcePrId ? state.prs.find((p) => p.id === po.sourcePrId) : null;
      const line = findBudgetLine(po.department);
      if (line) { line.used = Math.max(0, line.used - oldTotal + newTotal); }
      if (pr) pr.budgetReservedAmount = newTotal;
      const vendor = state.vendors.find((v) => v.id === po.vendorId);
      if (vendor) vendor.totalSpendYtd = Math.max(0, vendor.totalSpendYtd - oldTotal + newTotal);
      if (po.sourceContractId) {
        const c = state.contracts.find((x) => x.id === po.sourceContractId);
        if (c) c.consumedValue = Math.max(0, c.consumedValue - oldTotal + newTotal);
      }

      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PO Approved', refNumber: po.poNumber, actor: opts.signature || 'You', timestamp: today(),
        detail: 'Amended: ' + (opts.reason || 'no reason provided') + ' (' + Format.inr(oldTotal) + ' → ' + Format.inr(newTotal) + ')',
      });
      notifyInfo('PO amended', po.poNumber + ' was updated from ' + Format.inr(oldTotal) + ' to ' + Format.inr(newTotal) + '.', 'info');
      notify();
      return poId;
    },

    // ── Contract Types: Framework Agreements & Rate Contracts ───
    // Extends the PO architecture rather than replacing it: a Rate
    // Contract locks a unit rate with an approved vendor for a time
    // window and/or a value/quantity ceiling. Once the contract is
    // Active, "call-off" POs can be raised straight against it —
    // no fresh RFQ/Quotation/Comparison/Selection cycle — and each
    // call-off flows through the exact same Delivery → GRN →
    // Invoice → Payment pipeline as any other PO. The contract just
    // tracks how much of its ceiling has been committed so far.
    createContract(payload) {
      payload = payload || {};
      const vendor = state.vendors.find((v) => v.id === payload.vendorId && v.approvalStatus === 'Approved');
      const items = (payload.items || []).filter((it) => it.materialCode && it.rate > 0);
      if (!vendor || items.length === 0) return null;

      const contractId = 'ctr-new-' + Date.now();
      const contractNumber = 'RC-2026-' + (500 + state.contracts.length);
      const contract = {
        id: contractId, contractNumber, type: payload.type === 'Framework Agreement' ? 'Framework Agreement' : 'Rate Contract',
        vendorId: vendor.id, department: payload.department || 'Procurement',
        items: items.map((it) => ({ materialCode: it.materialCode, description: it.description, unit: it.unit || 'Nos', rate: Number(it.rate) || 0 })),
        validFrom: payload.validFrom || today(), validTo: payload.validTo || today(),
        valueCeiling: payload.valueCeiling ? Number(payload.valueCeiling) : null,
        quantityCeiling: payload.quantityCeiling ? Number(payload.quantityCeiling) : null,
        consumedValue: 0, consumedQty: 0,
        status: 'Pending',
        approval: { status: 'Pending', approver: 'Rahul Mehta', actedAt: null, comment: '' },
        callOffPoIds: [],
        createdDate: today(),
        activityLog: [{ action: 'Contract Drafted', actor: 'You', comment: 'For ' + vendor.name, timestamp: today() }],
      };
      state.contracts.unshift(contract);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PO Created', refNumber: contractNumber, actor: 'You', timestamp: today(),
        detail: contract.type + ' drafted with ' + vendor.name + (contract.valueCeiling ? ' — ceiling ' + Format.inr(contract.valueCeiling) : ''),
      });
      notify();
      return contractId;
    },

    approveContract(contractId, opts) {
      opts = opts || {};
      const c = state.contracts.find((x) => x.id === contractId);
      if (!c || c.status !== 'Pending') return;
      c.status = 'Active';
      c.approval = { status: 'Approved', approver: opts.signature || 'Rahul Mehta', actedAt: today(), comment: opts.comment || '' };
      c.activityLog.unshift({ action: 'Contract Approved', actor: opts.signature || 'You', comment: opts.comment || '', timestamp: today() });
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PO Approved', refNumber: c.contractNumber, actor: opts.signature || 'You', timestamp: today(),
        detail: 'Activated — call-off POs can now be raised against it',
      });
      notifyInfo('Contract active', c.contractNumber + ' is now Active. Raise call-off POs against it from the Contracts tab.', 'info');
      notify();
    },

    rejectContract(contractId, opts) {
      opts = opts || {};
      const c = state.contracts.find((x) => x.id === contractId);
      if (!c || c.status !== 'Pending') return;
      c.status = 'Rejected';
      c.approval = { status: 'Rejected', approver: opts.signature || 'Rahul Mehta', actedAt: today(), comment: opts.comment || '' };
      c.activityLog.unshift({ action: 'Contract Rejected', actor: opts.signature || 'You', comment: opts.comment || '', timestamp: today() });
      notify();
    },

    closeContract(contractId, opts) {
      opts = opts || {};
      const c = state.contracts.find((x) => x.id === contractId);
      if (!c || c.status !== 'Active') return;
      c.status = 'Closed';
      c.activityLog.unshift({ action: 'Contract Closed', actor: opts.signature || 'You', comment: opts.reason || 'Closed early', timestamp: today() });
      notify();
    },

    // A call-off PO reuses the exact same `pos` array and PO
    // lifecycle as a normal PO — it just carries sourceContractId
    // instead of sourceRfqId/sourcePrId, and its price comes from
    // the contract's locked rate instead of a fresh quotation.
    createCallOffPO(contractId, payload) {
      payload = payload || {};
      const c = state.contracts.find((x) => x.id === contractId);
      if (!c || c.status !== 'Active' || c.validTo < today()) return null;
      const vendor = state.vendors.find((v) => v.id === c.vendorId);
      if (!vendor) return null;

      const lines = (payload.items || []).map((line, idx) => {
        const ci = c.items[idx];
        const qty = Math.max(0, Number(line.qty) || 0);
        return ci ? { materialCode: ci.materialCode, description: ci.description, unit: ci.unit, qty, rate: ci.rate, lineTotal: qty * ci.rate } : null;
      }).filter((l) => l && l.qty > 0);
      if (lines.length === 0) return null;

      const total = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const qtySum = lines.reduce((sum, l) => sum + l.qty, 0);
      const remainingValue = c.valueCeiling === null ? Infinity : c.valueCeiling - c.consumedValue;
      const remainingQty = c.quantityCeiling === null ? Infinity : c.quantityCeiling - c.consumedQty;
      if (total > remainingValue || qtySum > remainingQty) return null; // over the contract's ceiling

      const poId = 'po-new-' + Date.now();
      const poNumber = 'PO-2026-' + (700 + state.pos.length);
      const po = {
        id: poId, poNumber, poDate: today(), poType: 'Goods',
        department: c.department, vendorId: vendor.id,
        sourceRfqId: null, sourcePrId: null, sourceContractId: c.id,
        items: lines.map((l) => ({ materialCode: l.materialCode, description: l.description, unit: l.unit, qty: l.qty })),
        subtotal: total, taxTotal: 0, discountTotal: 0, total, currency: 'INR',
        deliveryLocation: payload.deliveryLocation || 'Chennai Plant 1',
        deliveryTerms: payload.deliveryTerms || 'Standard', paymentTerms: payload.paymentTerms || 'Net 30', incoterms: 'N/A',
        status: 'Open', grnStatus: 'Pending',
        approval: { status: 'Pending', approver: 'Rahul Mehta', actedAt: null, comment: '' },
        vendorAcceptance: { status: 'Pending', date: null, note: '' },
        activityLog: [{ action: 'PO Created', actor: 'You', comment: 'Call-off against ' + c.contractNumber, timestamp: today() }],
      };
      state.pos.unshift(po);
      vendor.activePOs += 1;
      c.callOffPoIds.unshift(poId);
      c.consumedValue += total;
      c.consumedQty += qtySum;
      c.activityLog.unshift({ action: 'Call-off Raised', actor: 'You', comment: poNumber + ' for ' + Format.inr(total), timestamp: today() });

      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PO Created', refNumber: poNumber, actor: 'You', timestamp: today(),
        detail: 'Call-off PO raised against ' + c.contractNumber + ' (' + vendor.name + ') for ' + Format.inr(total),
      });
      notify();
      return poId;
    },

    // ── Service Procurement mode ─────────────────────────────────
    // A lighter PO variant for services (consulting, logistics
    // contracts, software licenses) where "receiving goods" makes no
    // sense. Deliverables/milestones + an SLA replace item quantities;
    // milestone sign-off replaces GRN. Under the hood a sign-off
    // posts a real GRN line for that milestone through the exact
    // same createGRN() used by goods POs, so grnStatus, PO closure,
    // and the Invoice/Payment 3-way match all keep working untouched.
    createServicePO(payload) {
      payload = payload || {};
      const vendor = state.vendors.find((v) => v.id === payload.vendorId && v.approvalStatus === 'Approved');
      const rawMilestones = (payload.milestones || []).filter((m) => m.title && Number(m.amount) > 0);
      if (!vendor || rawMilestones.length === 0) return null;

      const poId = 'po-new-' + Date.now();
      const poNumber = 'PO-2026-' + (700 + state.pos.length);
      const milestones = rawMilestones.map((m, idx) => ({
        id: 'ms-' + idx, materialCode: 'MS-' + (idx + 1), title: m.title, description: m.description || '',
        dueDate: m.dueDate || today(), amount: Number(m.amount) || 0,
        status: 'Pending', signOffDate: null, signOffBy: null, remarks: '',
      }));
      const total = milestones.reduce((sum, m) => sum + m.amount, 0);

      const po = {
        id: poId, poNumber, poDate: today(), poType: 'Service',
        department: payload.department || 'Procurement', vendorId: vendor.id,
        sourceRfqId: null, sourcePrId: null, sourceContractId: null,
        sla: payload.sla || '',
        milestones,
        items: milestones.map((m) => ({ materialCode: m.materialCode, description: m.title, unit: 'Milestone', qty: 1 })),
        subtotal: total, taxTotal: 0, discountTotal: 0, total, currency: 'INR',
        deliveryLocation: 'N/A — Service Engagement', deliveryTerms: 'N/A', paymentTerms: payload.paymentTerms || 'Net 30', incoterms: 'N/A',
        status: 'Open', grnStatus: 'Pending',
        approval: { status: 'Pending', approver: 'Rahul Mehta', actedAt: null, comment: '' },
        vendorAcceptance: { status: 'Pending', date: null, note: '' },
        activityLog: [{ action: 'PO Created', actor: 'You', comment: 'Service PO for ' + vendor.name + ' — ' + milestones.length + ' milestone(s)', timestamp: today() }],
      };
      state.pos.unshift(po);
      vendor.activePOs += 1;
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PO Created', refNumber: poNumber, actor: 'You', timestamp: today(),
        detail: 'Service PO raised with ' + vendor.name + ' for ' + Format.inr(total) + ' across ' + milestones.length + ' milestone(s)',
      });
      notify();
      return poId;
    },

    signOffMilestone(poId, milestoneId, opts) {
      opts = opts || {};
      const po = state.pos.find((p) => p.id === poId);
      if (!po || po.poType !== 'Service' || po.status !== 'Released') return false;
      const milestone = po.milestones.find((m) => m.id === milestoneId);
      if (!milestone || milestone.status === 'Signed Off') return false;

      const itemsPayload = po.items.map((it) => it.materialCode === milestone.materialCode
        ? { receivedQty: 1, acceptedQty: 1, remarks: opts.remarks || '' }
        : { receivedQty: 0, acceptedQty: 0 });
      const grnId = actions.createGRN(poId, { items: itemsPayload, warehouse: 'N/A — Service Engagement', inspector: opts.signature || 'You' });
      if (!grnId) return false;

      milestone.status = 'Signed Off';
      milestone.signOffDate = today();
      milestone.signOffBy = opts.signature || 'You';
      milestone.remarks = opts.remarks || '';
      po.activityLog.unshift({ action: 'Milestone Signed Off', actor: opts.signature || 'You', comment: milestone.title, timestamp: today() });
      notify();
      return true;
    },

    rejectMilestone(poId, milestoneId, opts) {
      opts = opts || {};
      const po = state.pos.find((p) => p.id === poId);
      if (!po || po.poType !== 'Service' || po.status !== 'Released') return false;
      const milestone = po.milestones.find((m) => m.id === milestoneId);
      if (!milestone || milestone.status === 'Signed Off') return false;
      milestone.status = 'Rejected';
      milestone.remarks = opts.reason || 'Deliverable did not meet the SLA.';
      po.activityLog.unshift({ action: 'Milestone Rejected', actor: opts.signature || 'You', comment: milestone.remarks, timestamp: today() });
      notify();
      return true;
    },

    // ── Module 12: Delivery Tracking ───────────────────────────
    createDelivery(poId, payload) {
      payload = payload || {};
      const po = state.pos.find((p) => p.id === poId);
      if (!po || po.status !== 'Released') return null;
      const deliveryId = 'del-new-' + Date.now();
      const delivery = {
        id: deliveryId, poId, courier: payload.courier || 'Trident Logistics',
        trackingNumber: payload.trackingNumber || ('TRK' + Math.floor(Math.random() * 900000 + 100000)),
        dispatchDate: payload.dispatchDate || today(), eta: payload.eta || today(),
        status: 'On Time', delayDays: 0, remarks: payload.remarks || '',
        activityLog: [{ action: 'Dispatched', actor: 'Vendor', comment: '', timestamp: today() }],
      };
      state.deliveries.unshift(delivery);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PO Approved', refNumber: po.poNumber, actor: 'You', timestamp: today(),
        detail: 'Shipment dispatched via ' + delivery.courier + ' · tracking ' + delivery.trackingNumber,
      });
      notify();
      return deliveryId;
    },

    reportDelay(deliveryId, opts) {
      opts = opts || {};
      const del = state.deliveries.find((x) => x.id === deliveryId);
      if (!del || del.status === 'Complete') return;
      del.status = 'Delayed';
      del.delayDays = Number(opts.delayDays) || 1;
      del.remarks = opts.remarks || del.remarks;
      del.activityLog.unshift({ action: 'Delay Reported', actor: 'You', comment: opts.remarks || '', timestamp: today() });
      const po = state.pos.find((p) => p.id === del.poId);
      notifyInfo('Delivery delayed', (po ? po.poNumber : del.poId) + ' is running ' + del.delayDays + ' day(s) late.', 'warning');
      notify();
    },

    markDeliveryPartial(deliveryId, opts) {
      opts = opts || {};
      const del = state.deliveries.find((x) => x.id === deliveryId);
      if (!del) return;
      del.status = 'Partial';
      del.remarks = opts.remarks || del.remarks;
      del.activityLog.unshift({ action: 'Partial Delivery Recorded', actor: 'You', comment: opts.remarks || '', timestamp: today() });
      notify();
    },

    markDeliveryComplete(deliveryId) {
      const del = state.deliveries.find((x) => x.id === deliveryId);
      if (!del) return;
      del.status = 'Complete'; del.delayDays = 0;
      del.activityLog.unshift({ action: 'Delivery Completed', actor: 'You', comment: '', timestamp: today() });
      const po = state.pos.find((p) => p.id === del.poId);
      notifyInfo('Delivery complete', (po ? po.poNumber : del.poId) + ' has arrived. Post a GRN in Module 13 to record receipt.', 'info');
      notify();
    },

    // ── Module 13: Goods Receipt (GRN) ─────────────────────────
    createGRN(poId, payload) {
      payload = payload || {};
      const po = state.pos.find((p) => p.id === poId);
      if (!po || (po.status !== 'Released' && po.status !== 'Closed')) return null;
      const grnId = 'grn-new-' + Date.now();
      const grnNumber = 'GRN-2026-' + (900 + state.grns.length);
      const items = po.items.map((it, idx) => {
        const line = (payload.items && payload.items[idx]) || {};
        const receivedQty = Number(line.receivedQty) || 0;
        const acceptedQty = Math.min(receivedQty, Number(line.acceptedQty) || 0);
        const rejectedQty = Math.max(0, receivedQty - acceptedQty);
        return { materialCode: it.materialCode, description: it.description, unit: it.unit, orderedQty: it.qty, receivedQty, acceptedQty, rejectedQty, remarks: line.remarks || '' };
      });
      const anyRejected = items.some((it) => it.rejectedQty > 0);
      const fullyReceived = items.every((it) => it.receivedQty >= it.orderedQty);
      const overallResult = anyRejected ? (items.some((it) => it.acceptedQty > 0) ? 'Partial' : 'Rejected') : (fullyReceived ? 'Accepted' : 'Partial');

      const grn = {
        id: grnId, grnNumber, grnDate: payload.grnDate || today(), poId, vendorId: po.vendorId,
        warehouse: payload.warehouse || po.deliveryLocation, inspector: payload.inspector || 'Suresh Pillai',
        items, overallResult, status: 'Posted', activityLog: [{ action: 'GRN Posted', actor: 'You', comment: '', timestamp: today() }],
      };
      state.grns.unshift(grn);

      // Recompute the PO's aggregate GRN status across every GRN posted against it.
      const poGrns = state.grns.filter((g) => g.poId === poId);
      const totals = {};
      po.items.forEach((it) => { totals[it.materialCode] = { ordered: it.qty, accepted: 0 }; });
      poGrns.forEach((g) => g.items.forEach((it) => { if (totals[it.materialCode]) totals[it.materialCode].accepted += it.acceptedQty; }));
      const allComplete = Object.values(totals).every((t) => t.accepted >= t.ordered);
      const anyReceived = Object.values(totals).some((t) => t.accepted > 0);
      po.grnStatus = allComplete ? 'Complete' : (anyReceived ? 'Partial' : 'Pending');

      const vendor = state.vendors.find((v) => v.id === po.vendorId);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'GRN Posted', refNumber: grnNumber, actor: payload.inspector || 'You', timestamp: today(),
        detail: overallResult + ' receipt against ' + po.poNumber + (vendor ? ' from ' + vendor.name : ''),
      });
      if (anyRejected) notifyInfo('Quality rejection on GRN', grnNumber + ' has rejected quantity — review before invoice verification.', 'warning');
      notify();
      return grnId;
    },

    // ── Module 14: Invoice Verification ────────────────────────
    submitInvoice(poId, payload) {
      payload = payload || {};
      const po = state.pos.find((p) => p.id === poId);
      if (!po) return null;
      const vendor = state.vendors.find((v) => v.id === po.vendorId);

      const isDuplicate = state.invoices.some((inv) => inv.poId === poId && inv.vendorInvoiceNumber === payload.vendorInvoiceNumber && inv.status !== 'Rejected');

      const subtotal = Number(payload.subtotal) || po.subtotal;
      const taxTotal = Number(payload.taxTotal) || po.taxTotal;
      const discountTotal = Number(payload.discountTotal) || po.discountTotal;
      const total = subtotal + taxTotal - discountTotal;

      const grns = state.grns.filter((g) => g.poId === poId);
      const acceptedQty = grns.reduce((s, g) => s + g.items.reduce((s2, it) => s2 + it.acceptedQty, 0), 0);
      const orderedQty = po.items.reduce((s, it) => s + it.qty, 0);
      const qtyMatch = acceptedQty > 0 && acceptedQty <= orderedQty;
      const priceMatch = Math.abs(total - po.total) <= Math.max(1, po.total * 0.02);
      const grnMatch = grns.length > 0;

      let status, note;
      if (isDuplicate) { status = 'Blocked'; note = 'Duplicate invoice number submitted for this PO.'; }
      else if (!grnMatch) { status = 'Blocked'; note = 'No GRN posted yet for this PO — post receipt in Module 13 first.'; }
      else if (priceMatch && qtyMatch) { status = 'Matched'; note = '3-way match passed (PO ↔ GRN ↔ Invoice) — ready for verification.'; }
      else { status = 'Pending'; note = 'Mismatch found against PO/GRN — needs manual review.'; }

      const invId = 'inv-new-' + Date.now();
      const internalRefNumber = 'INV-2026-' + (1100 + state.invoices.length);
      const invoice = {
        id: invId, internalRefNumber, vendorInvoiceNumber: payload.vendorInvoiceNumber || ('VI-' + Math.floor(Math.random() * 90000 + 10000)),
        invoiceDate: payload.invoiceDate || today(), poId, grnId: grns[0] ? grns[0].id : null, vendorId: po.vendorId,
        subtotal, taxTotal, discountTotal, total,
        status, matchResult: { poMatch: priceMatch, grnMatch, qtyMatch, priceMatch, note },
        activityLog: [{ action: 'Invoice Submitted', actor: vendor ? vendor.name : 'Vendor', comment: note, timestamp: today() }],
      };
      state.invoices.unshift(invoice);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Invoice Verified', refNumber: internalRefNumber, actor: vendor ? vendor.name : 'Vendor',
        timestamp: today(), detail: status + ' — ' + note,
      });
      if (status === 'Blocked') notifyInfo('Invoice blocked', internalRefNumber + ': ' + note, 'warning');
      notify();
      return invId;
    },

    verifyInvoice(invoiceId, opts) {
      opts = opts || {};
      const inv = state.invoices.find((x) => x.id === invoiceId);
      if (!inv || inv.status === 'Blocked' || inv.status === 'Paid') return;
      inv.status = 'Verified';
      inv.activityLog.unshift({ action: 'Verified', actor: opts.signature || 'Finance Officer', comment: opts.comment || '', timestamp: today() });
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Invoice Verified', refNumber: inv.internalRefNumber, actor: opts.signature || 'You',
        timestamp: today(), detail: 'Verified and cleared for payment' + (opts.comment ? ' — ' + opts.comment : ''),
      });
      notify();
    },

    rejectInvoice(invoiceId, opts) {
      opts = opts || {};
      const inv = state.invoices.find((x) => x.id === invoiceId);
      if (!inv || inv.status === 'Paid') return;
      inv.status = 'Rejected';
      inv.activityLog.unshift({ action: 'Rejected', actor: opts.signature || 'Finance Officer', comment: opts.comment || '', timestamp: today() });
      notify();
    },

    overrideInvoiceBlock(invoiceId, opts) {
      opts = opts || {};
      const inv = state.invoices.find((x) => x.id === invoiceId);
      if (!inv || inv.status !== 'Blocked') return;
      inv.status = 'Pending';
      inv.matchResult.note = 'Manually released from block: ' + (opts.comment || 'no comment provided');
      inv.activityLog.unshift({ action: 'Block Overridden', actor: opts.signature || 'Finance Officer', comment: opts.comment || '', timestamp: today() });
      notify();
    },

    // ── Dispute / Escalation flow ────────────────────────────────
    // Raised from a rejected GRN line or a Blocked invoice — instead
    // of a silent reject/override, this opens a tracked record with
    // a reason, a vendor response, and a resolution + resolved-by,
    // so the back-and-forth is auditable. Resolving an Invoice
    // dispute is what actually clears or rejects the invoice now —
    // there's no separate direct override button anymore.
    raiseDispute(payload) {
      payload = payload || {};
      let poId = null; let vendorId = null;
      if (payload.source === 'GRN') {
        const grn = state.grns.find((g) => g.id === payload.sourceId);
        if (!grn || grn.overallResult === 'Accepted') return null;
        poId = grn.poId; vendorId = grn.vendorId;
      } else if (payload.source === 'Invoice') {
        const inv = state.invoices.find((i) => i.id === payload.sourceId);
        if (!inv || inv.status !== 'Blocked') return null;
        poId = inv.poId; vendorId = inv.vendorId;
      } else {
        return null;
      }
      if (!payload.reason || !payload.reason.trim()) return null;
      const alreadyOpen = state.disputes.some((dd) => dd.source === payload.source && dd.sourceId === payload.sourceId && dd.status !== 'Resolved');
      if (alreadyOpen) return null;

      const po = state.pos.find((p) => p.id === poId);
      const disputeId = 'dsp-new-' + Date.now();
      const disputeNumber = 'DSP-2026-' + (100 + state.disputes.length);
      const dispute = {
        id: disputeId, disputeNumber, source: payload.source, sourceId: payload.sourceId, poId, vendorId,
        reason: payload.reason.trim(), raisedBy: payload.signature || 'You', raisedDate: today(),
        status: 'Open', vendorResponse: '', vendorRespondedDate: null,
        resolution: '', resolutionOutcome: null, resolvedBy: null, resolvedDate: null,
        activityLog: [{ action: 'Dispute Raised', actor: payload.signature || 'You', comment: payload.reason.trim(), timestamp: today() }],
      };
      state.disputes.unshift(dispute);
      if (po) po.activityLog.unshift({ action: 'Dispute Raised', actor: payload.signature || 'You', comment: disputeNumber + ' — ' + dispute.reason, timestamp: today() });
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'PR Rejected', refNumber: disputeNumber, actor: payload.signature || 'You', timestamp: today(),
        detail: (payload.source === 'GRN' ? 'GRN rejection' : 'Blocked invoice') + ' escalated to a tracked dispute: ' + dispute.reason,
      });
      notify();
      return disputeId;
    },

    addDisputeVendorResponse(disputeId, opts) {
      opts = opts || {};
      const dd = state.disputes.find((x) => x.id === disputeId);
      if (!dd || dd.status === 'Resolved' || !opts.response || !opts.response.trim()) return false;
      dd.vendorResponse = opts.response.trim();
      dd.vendorRespondedDate = today();
      dd.status = 'Vendor Responded';
      dd.activityLog.unshift({ action: 'Vendor Responded', actor: opts.signature || 'Vendor', comment: dd.vendorResponse, timestamp: today() });
      notify();
      return true;
    },

    resolveDispute(disputeId, opts) {
      opts = opts || {};
      const dd = state.disputes.find((x) => x.id === disputeId);
      if (!dd || dd.status === 'Resolved' || !opts.resolution || !opts.resolution.trim()) return false;
      dd.resolution = opts.resolution.trim();
      dd.resolutionOutcome = opts.outcome || null;
      dd.resolvedBy = opts.signature || 'You';
      dd.resolvedDate = today();
      dd.status = 'Resolved';
      dd.activityLog.unshift({ action: 'Dispute Resolved', actor: dd.resolvedBy, comment: (dd.resolutionOutcome ? dd.resolutionOutcome + ' — ' : '') + dd.resolution, timestamp: today() });

      if (dd.source === 'Invoice') {
        const inv = state.invoices.find((i) => i.id === dd.sourceId);
        if (inv && inv.status === 'Blocked') {
          if (dd.resolutionOutcome === 'Cleared') {
            inv.status = 'Pending';
            inv.matchResult.note = 'Cleared via ' + dd.disputeNumber + ': ' + dd.resolution;
            inv.activityLog.unshift({ action: 'Block Cleared via Dispute', actor: dd.resolvedBy, comment: dd.disputeNumber, timestamp: today() });
          } else if (dd.resolutionOutcome === 'Rejected') {
            inv.status = 'Rejected';
            inv.activityLog.unshift({ action: 'Rejected via Dispute', actor: dd.resolvedBy, comment: dd.disputeNumber + ': ' + dd.resolution, timestamp: today() });
          }
        }
      }
      const po = state.pos.find((p) => p.id === dd.poId);
      if (po) po.activityLog.unshift({ action: 'Dispute Resolved', actor: dd.resolvedBy, comment: dd.disputeNumber + ' — ' + dd.resolution, timestamp: today() });
      notify();
      return true;
    },

    // ── Module 15: Payment Processing ──────────────────────────
    createPayment(invoiceId, payload) {
      payload = payload || {};
      const inv = state.invoices.find((x) => x.id === invoiceId);
      if (!inv || inv.status !== 'Verified') return null;
      if (state.payments.some((p) => p.invoiceId === invoiceId && p.status !== 'Failed')) return null;

      const payId = 'pay-new-' + Date.now();
      const paymentNumber = 'PAY-2026-' + (1300 + state.payments.length);
      const payment = {
        id: payId, paymentNumber, paymentDate: payload.paymentDate || today(),
        invoiceId, poId: inv.poId, vendorId: inv.vendorId, amount: inv.total,
        mode: payload.mode || 'NEFT', bankRef: payload.bankRef || ('REF' + Math.floor(Math.random() * 900000 + 100000)),
        status: 'Pending', approvedBy: null, activityLog: [{ action: 'Payment Voucher Created', actor: 'You', comment: '', timestamp: today() }],
      };
      state.payments.unshift(payment);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Payment Made', refNumber: paymentNumber, actor: 'You', timestamp: today(),
        detail: 'Voucher raised for ' + Format.inr(payment.amount) + ' against ' + inv.internalRefNumber,
      });
      notify();
      return payId;
    },

    processPayment(paymentId, opts) {
      opts = opts || {};
      const payment = state.payments.find((p) => p.id === paymentId);
      if (!payment || payment.status !== 'Pending') return;
      payment.status = 'Processed';
      payment.approvedBy = opts.signature || 'Finance Manager';
      payment.activityLog.unshift({ action: 'Processed', actor: payment.approvedBy, comment: opts.comment || '', timestamp: today() });

      const inv = state.invoices.find((x) => x.id === payment.invoiceId);
      if (inv) { inv.status = 'Paid'; inv.activityLog.unshift({ action: 'Paid', actor: payment.approvedBy, comment: '', timestamp: today() }); }
      const po = state.pos.find((x) => x.id === payment.poId);
      if (po && po.grnStatus === 'Complete') po.status = 'Closed';

      const vendor = state.vendors.find((v) => v.id === payment.vendorId);
      state.activity.unshift({
        id: 'act-' + Date.now(), type: 'Payment Made', refNumber: payment.paymentNumber, actor: payment.approvedBy, timestamp: today(),
        detail: 'Payment processed to ' + (vendor ? vendor.name : 'vendor') + ' via ' + payment.mode + ' · ref ' + payment.bankRef,
      });
      notifyInfo('Payment processed', payment.paymentNumber + ' of ' + Format.inr(payment.amount) + ' has been processed' + (po && po.status === 'Closed' ? '. ' + po.poNumber + ' is now fully closed.' : '.'), 'info');
      notify();
    },

    markPaymentFailed(paymentId, opts) {
      opts = opts || {};
      const payment = state.payments.find((p) => p.id === paymentId);
      if (!payment || payment.status !== 'Pending') return;
      payment.status = 'Failed';
      payment.activityLog.unshift({ action: 'Failed', actor: opts.signature || 'You', comment: opts.comment || 'Bank returned the transfer', timestamp: today() });
      notify();
    },

    // ── Persistence controls (Reset / Export / Import) ─────────
    resetAll() {
      state = generateDataset();
      if (hasLocalStorage() && activeStudentId) {
        try { localStorage.removeItem(storageKeyFor(activeStudentId)); } catch (e) { /* ignore */ }
      }
      notify();
    },

    exportSnapshot() {
      return JSON.stringify(state, null, 2);
    },

    importSnapshot(jsonString) {
      let parsed;
      try {
        parsed = JSON.parse(jsonString);
      } catch (e) {
        return { ok: false, error: 'That file is not valid JSON.' };
      }
      const requiredKeys = ['users', 'vendors', 'budgets', 'requirements', 'prs', 'rfqs', 'quotations', 'pos', 'deliveries', 'grns', 'invoices', 'payments', 'activity', 'notifications'];
      if (!requiredKeys.every((k) => Array.isArray(parsed[k]))) {
        return { ok: false, error: "That file doesn't look like a Procurement Simulator export." };
      }
      state = parsed;
      notify();
      return { ok: true };
    },
  };

  return {
    get state() { return state; },
    get activeStudentId() { return activeStudentId; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    actions,
    storageKeyFor, // used by the Instructor Console to read OTHER students' saves

    // Called once, right after a successful sign-in. Loads that
    // student's own saved progress (or starts fresh for a new
    // student) and points all future saves at their own slot.
    setActiveUser(studentId) {
      activeStudentId = studentId;
      state = loadPersistedState(studentId) || generateDataset();
      if (!state.activeRole) state.activeRole = 'Employee'; // sessions saved before role-switching existed
      if (!Array.isArray(state.contracts)) state.contracts = []; // sessions saved before Contract Types existed
      state.vendors.forEach((v) => { if (!v.riskTier) v.riskTier = 'Low'; if (v.riskNote === undefined) v.riskNote = ''; }); // sessions saved before Supplier Risk existed
      if (!Array.isArray(state.disputes)) state.disputes = []; // sessions saved before the Dispute/Escalation flow existed
      notify();
    },

    // Which org role the student is currently "acting as" — enforced
    // by js/roles.js against every state-changing action.
    setActiveRole(role) {
      if (typeof Roles !== 'undefined' && Roles.ROLE_LIST.indexOf(role) === -1) return;
      state.activeRole = role;
      notify();
    },

    // Called on Logout. Does NOT touch the student's saved data —
    // it's still there under their Student ID for next time. Just
    // stops this session from reading/writing it.
    logout() {
      activeStudentId = null;
      state = generateDataset();
    },
  };
})();
