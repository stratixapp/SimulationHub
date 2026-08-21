// ─────────────────────────────────────────────────────────────
// Selectors — pure functions deriving dashboard data from Store.state
// ─────────────────────────────────────────────────────────────
const Selectors = {
  kpis(d) {
    const prPending = d.prs.filter((p) => p.status === 'Submitted').length;
    const rfqOpen = d.rfqs.filter((r) => r.status === 'Issued' || r.status === 'Closing Soon').length;
    const poIssued = d.pos.filter((p) => p.status === 'Released' || p.status === 'Approved').length;
    const awaitingGrn = d.pos.filter((p) => p.grnStatus !== 'Complete' && p.status !== 'Cancelled').length;
    const invoicePending = d.invoices.filter((i) => i.status === 'Pending' || i.status === 'Blocked').length;
    const overdueDeliveries = d.deliveries.filter((x) => x.status === 'Delayed').length;
    const budgetBalance = d.budgets.reduce((s, b) => s + (b.allocated - b.used - b.reserved), 0);
    return { prPending, rfqOpen, poIssued, awaitingGrn, invoicePending, overdueDeliveries, budgetBalance };
  },

  pendingApprovals(d) {
    return d.prs
      .filter((p) => p.status === 'Submitted')
      .map((p) => ({
        pr: p,
        level: p.approval.currentLevel,
        waitingOn: (p.approval.steps.find((s) => s.status === 'Pending') || {}).approver || '—',
      }))
      .sort((a, b) => b.pr.estimatedValue - a.pr.estimatedValue);
  },

  todaysPurchases(d) {
    const today = new Date().toISOString().slice(0, 10);
    const posToday = d.pos.filter((p) => p.poDate === today);
    const value = posToday.reduce((s, p) => s + p.total, 0);
    return { pos: posToday, count: posToday.length, value };
  },

  rfqStatusBreakdown(d) {
    const buckets = {};
    d.rfqs.forEach((r) => { buckets[r.status] = (buckets[r.status] || 0) + 1; });
    return Object.entries(buckets).map(([status, count]) => ({ status, count }));
  },

  poStatusBreakdown(d) {
    const buckets = {};
    d.pos.forEach((p) => { buckets[p.status] = (buckets[p.status] || 0) + 1; });
    return Object.entries(buckets).map(([status, count]) => ({ status, count }));
  },

  vendorLeaderboard(d) {
    return [...d.vendors].sort((a, b) => (b.rating * b.onTimeDeliveryPct) - (a.rating * a.onTimeDeliveryPct));
  },

  budgetUsage(d) {
    return d.budgets.map((b) => ({
      ...b,
      usedPct: Math.round((b.used / b.allocated) * 100),
      reservedPct: Math.round((b.reserved / b.allocated) * 100),
    }));
  },

  deliveryStatusBoard(d) {
    return d.deliveries
      .map((del) => {
        const po = d.pos.find((p) => p.id === del.poId);
        const vendor = po ? d.vendors.find((v) => v.id === po.vendorId) : undefined;
        return { ...del, po, vendor };
      })
      .sort((a) => (a.status === 'Delayed' ? -1 : 1));
  },

  recentActivity(d, limit) {
    return d.activity.slice(0, limit || 12);
  },

  unreadNotifications(d) {
    return d.notifications.filter((n) => !n.read);
  },

  // ── Module 2: Department Requirement ────────────────────────
  requirementsList(d, statusFilter) {
    const rows = [...d.requirements].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!statusFilter || statusFilter === 'All') return rows;
    return rows.filter((r) => r.status === statusFilter);
  },

  requirementCounts(d) {
    const counts = { Draft: 0, Submitted: 0, Converted: 0, Rejected: 0 };
    d.requirements.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  },

  // ── Module 3: Purchase Requisition ──────────────────────────
  prsList(d, statusFilter) {
    const rows = [...d.prs].sort((a, b) => (a.prDate < b.prDate ? 1 : -1));
    if (!statusFilter || statusFilter === 'All') return rows;
    return rows.filter((p) => p.status === statusFilter);
  },

  prCounts(d) {
    const counts = { Draft: 0, Submitted: 0, Approved: 0, Rejected: 0, Closed: 0 };
    d.prs.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  },

  // ── Module 4: Approval Workflow ─────────────────────────────
  approvalQueue(d) {
    return d.prs
      .filter((p) => p.status === 'Submitted')
      .map((p) => {
        const step = p.approval.steps.find((s) => s.status === 'Pending');
        return { pr: p, level: p.approval.currentLevel, approver: step ? step.approver : '—' };
      })
      .sort((a, b) => b.pr.estimatedValue - a.pr.estimatedValue);
  },

  approvalLevelCounts(d) {
    const counts = {};
    APPROVAL_LEVELS.forEach((l) => { counts[l] = 0; });
    d.prs.forEach((p) => { if (p.status === 'Submitted') counts[p.approval.currentLevel] = (counts[p.approval.currentLevel] || 0) + 1; });
    return counts;
  },

  approvalHistoryFlat(d, limit) {
    const rows = [];
    d.prs.forEach((p) => {
      (p.approvalHistory || []).forEach((h) => rows.push(Object.assign({ prNumber: p.prNumber, prId: p.id }, h)));
    });
    rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    return limit ? rows.slice(0, limit) : rows;
  },

  // ── Module 5: Budget Verification ───────────────────────────
  budgetOverview(d) {
    return d.budgets.map((b) => ({
      ...b,
      balance: b.allocated - b.used - b.reserved,
      usedPct: Math.round((b.used / b.allocated) * 100),
      reservedPct: Math.round((b.reserved / b.allocated) * 100),
    }));
  },

  budgetCheckQueue(d, filter) {
    const rows = d.prs
      .filter((p) => p.status === 'Submitted' && p.budgetCheck)
      .sort((a, b) => (a.budgetCheck.checkedAt < b.budgetCheck.checkedAt ? 1 : -1));
    if (!filter || filter === 'All') return rows;
    return rows.filter((p) => p.budgetCheck.status === filter);
  },

  budgetCheckCounts(d) {
    const counts = { Sufficient: 0, Insufficient: 0, Overridden: 0 };
    d.prs.forEach((p) => { if (p.status === 'Submitted' && p.budgetCheck) counts[p.budgetCheck.status] = (counts[p.budgetCheck.status] || 0) + 1; });
    return counts;
  },

  // ── Module 6: Vendor Management ─────────────────────────────
  vendorDirectory(d, categoryFilter, statusFilter) {
    let rows = [...d.vendors].sort((a, b) => a.name.localeCompare(b.name));
    if (categoryFilter && categoryFilter !== 'All') rows = rows.filter((v) => v.category === categoryFilter);
    if (statusFilter && statusFilter !== 'All') rows = rows.filter((v) => v.approvalStatus === statusFilter);
    return rows;
  },

  vendorStatusCounts(d) {
    const counts = { Draft: 0, Pending: 0, Approved: 0, Rejected: 0, Blacklisted: 0 };
    d.vendors.forEach((v) => { counts[v.approvalStatus] = (counts[v.approvalStatus] || 0) + 1; });
    return counts;
  },

  vendorApprovalQueue(d) {
    return d.vendors.filter((v) => v.approvalStatus === 'Pending').sort((a, b) => a.registrationDate < b.registrationDate ? -1 : 1);
  },

  // ── Module 7: Request for Quotation ─────────────────────────
  rfqList(d, statusFilter) {
    const rows = [...d.rfqs].sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));
    if (!statusFilter || statusFilter === 'All') return rows;
    return rows.filter((r) => r.status === statusFilter);
  },

  rfqCounts(d) {
    const counts = { Draft: 0, Issued: 0, Closed: 0, Cancelled: 0 };
    d.rfqs.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  },

  eligiblePRsForRFQ(d) {
    return d.prs.filter((p) => p.status === 'Approved' && !p.linkedRfqId).sort((a, b) => (a.prDate < b.prDate ? 1 : -1));
  },

  eligibleVendorsForRFQ(d) {
    return [...d.vendors].filter((v) => v.approvalStatus === 'Approved').sort((a, b) => a.name.localeCompare(b.name));
  },

  isRfqClosingSoon(rfq) {
    if (rfq.status !== 'Issued') return false;
    const days = Math.round((new Date(rfq.closingDate) - new Date()) / 86400000);
    return days >= 0 && days <= 3;
  },
};

// ── Module 8: Quotation Management ────────────────────────────
Object.assign(Selectors, {
  quotationInbox(d, statusFilter) {
    const rows = d.quotations
      .map((q) => ({
        q,
        rfq: d.rfqs.find((r) => r.id === q.rfqId),
        vendor: d.vendors.find((v) => v.id === q.vendorId),
      }))
      .filter((row) => row.rfq && (row.rfq.status === 'Issued' || row.rfq.status === 'Closed'))
      .sort((a, b) => (a.rfq.closingDate < b.rfq.closingDate ? -1 : 1));
    if (!statusFilter || statusFilter === 'All') return rows;
    return rows.filter((row) => row.q.status === statusFilter);
  },

  quotationCounts(d) {
    const counts = { Pending: 0, Received: 0, Rejected: 0, Accepted: 0 };
    d.quotations.forEach((q) => {
      const rfq = d.rfqs.find((r) => r.id === q.rfqId);
      if (rfq && (rfq.status === 'Issued' || rfq.status === 'Closed')) counts[q.status] = (counts[q.status] || 0) + 1;
    });
    return counts;
  },

  rfqQuotationSummary(d) {
    return d.rfqs
      .filter((r) => r.status === 'Issued' || r.status === 'Closed')
      .map((rfq) => {
        const quotes = d.quotations.filter((q) => q.rfqId === rfq.id);
        const received = quotes.filter((q) => q.status !== 'Pending');
        const prices = received.filter((q) => q.status !== 'Rejected').map((q) => q.price).filter((p) => p > 0);
        const leadTimes = received.filter((q) => q.status !== 'Rejected').map((q) => q.leadTimeDays).filter((n) => n > 0);
        return {
          rfq,
          invited: quotes.length,
          received: received.length,
          lowestPrice: prices.length ? Math.min(...prices) : null,
          avgLeadTime: leadTimes.length ? Math.round(leadTimes.reduce((s, n) => s + n, 0) / leadTimes.length) : null,
        };
      })
      .sort((a, b) => (a.rfq.closingDate < b.rfq.closingDate ? -1 : 1));
  },
});

// ── Module 9: Quotation Comparison ─────────────────────────────
Object.assign(Selectors, {
  comparableRFQs(d) {
    return d.rfqs.filter((rfq) => d.quotations.some((q) => q.rfqId === rfq.id && (q.status === 'Received' || q.status === 'Accepted')));
  },

  comparisonMatrix(d, rfqId) {
    const rfq = d.rfqs.find((r) => r.id === rfqId);
    if (!rfq) return { rfq: null, rows: [] };

    const quotes = d.quotations.filter((q) => q.rfqId === rfqId && (q.status === 'Received' || q.status === 'Accepted'));
    const withVendor = quotes.map((q) => ({ q, vendor: d.vendors.find((v) => v.id === q.vendorId) })).filter((r) => r.vendor);

    const netPrices = withVendor.map((r) => (r.q.negotiatedPrice || r.q.price) + r.q.tax - r.q.discount);
    const leadTimes = withVendor.map((r) => r.q.leadTimeDays);
    const minPrice = netPrices.length ? Math.min(...netPrices) : 0;
    const minLead = leadTimes.length ? Math.min(...leadTimes.filter((n) => n > 0)) || Math.min(...leadTimes) : 0;

    const rows = withVendor.map(({ q, vendor }) => {
      const netPrice = (q.negotiatedPrice || q.price) + q.tax - q.discount;
      const priceScore = netPrice > 0 && minPrice > 0 ? Math.round((minPrice / netPrice) * 100) : 0;
      const deliveryScore = q.leadTimeDays > 0 && minLead > 0 ? Math.round((minLead / q.leadTimeDays) * 100) : 0;
      const ratingScore = Math.round(((vendor.rating || 0) / 5) * 100);
      const performanceScore = vendor.onTimeDeliveryPct || 0;
      const overallScore = Math.round(priceScore * 0.4 + deliveryScore * 0.2 + ratingScore * 0.2 + performanceScore * 0.2);
      return { q, vendor, netPrice, priceScore, deliveryScore, ratingScore, performanceScore, overallScore };
    }).sort((a, b) => b.overallScore - a.overallScore);

    return { rfq, rows };
  },

  recommendationEngine(rows) {
    if (!rows.length) return null;
    const lowestCost = [...rows].sort((a, b) => a.netPrice - b.netPrice)[0];
    const bestValue = [...rows].sort((a, b) => b.overallScore - a.overallScore)[0];
    const technicallyQualified = rows.filter((r) => r.q.technicallyQualified === true);
    return { lowestCost, bestValue, technicallyQualified };
  },
});

// ── Module 10: Vendor Selection ────────────────────────────────
Object.assign(Selectors, {
  selectableRFQs(d) {
    return Selectors.comparableRFQs(d);
  },

  committeeVoteTally(rfq, rows) {
    const tally = {};
    rows.forEach((r) => { tally[r.vendor.id] = { vendor: r.vendor, votes: 0 }; });
    rfq.selection.committeeReviews.forEach((rev) => {
      if (tally[rev.vendorId]) tally[rev.vendorId].votes += 1;
    });
    return Object.values(tally).sort((a, b) => b.votes - a.votes);
  },

  negotiationHistory(rfq) {
    return [...rfq.selection.negotiations].sort((a, b) => (a.date < b.date ? 1 : -1));
  },
});

// ── Module 11: Purchase Order ──────────────────────────────────
Object.assign(Selectors, {
  poList(d, statusFilter) {
    const rows = [...d.pos].sort((a, b) => (a.poDate < b.poDate ? 1 : -1));
    if (!statusFilter || statusFilter === 'All') return rows;
    return rows.filter((p) => p.status === statusFilter);
  },
  poCounts(d) {
    const counts = { Open: 0, Approved: 0, Released: 0, Cancelled: 0, Closed: 0 };
    d.pos.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  },
  eligibleRfqsForPO(d) {
    return d.rfqs.filter((r) => r.selection.status === 'Awarded' && !r.linkedPoId);
  },
});

// ── Contract Types: Framework Agreements & Rate Contracts ────────
Object.assign(Selectors, {
  contractList(d, statusFilter) {
    const rows = [...d.contracts].sort((a, b) => (a.createdDate < b.createdDate ? 1 : -1));
    if (!statusFilter || statusFilter === 'All') return rows;
    return rows.filter((c) => c.status === statusFilter);
  },
  contractCounts(d) {
    const counts = { Pending: 0, Active: 0, Rejected: 0, Closed: 0 };
    d.contracts.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });
    return counts;
  },
  eligibleContractsForCallOff(d) {
    const t = new Date().toISOString().slice(0, 10);
    return d.contracts.filter((c) => c.status === 'Active' && c.validTo >= t);
  },
  contractRemaining(c) {
    return {
      value: c.valueCeiling === null ? null : Math.max(0, c.valueCeiling - c.consumedValue),
      qty: c.quantityCeiling === null ? null : Math.max(0, c.quantityCeiling - c.consumedQty),
    };
  },
});

// ── Dispute / Escalation flow ─────────────────────────────────────
Object.assign(Selectors, {
  disputeList(d, statusFilter) {
    const rows = [...d.disputes].sort((a, b) => (a.raisedDate < b.raisedDate ? 1 : -1));
    if (!statusFilter || statusFilter === 'All') return rows;
    return rows.filter((dd) => dd.status === statusFilter);
  },
  disputeCounts(d) {
    const counts = { Open: 0, 'Vendor Responded': 0, Resolved: 0 };
    d.disputes.forEach((dd) => { counts[dd.status] = (counts[dd.status] || 0) + 1; });
    return counts;
  },
  openDisputeForSource(d, source, sourceId) {
    return d.disputes.find((dd) => dd.source === source && dd.sourceId === sourceId && dd.status !== 'Resolved')
      || [...d.disputes].reverse().find((dd) => dd.source === source && dd.sourceId === sourceId) || null;
  },
});

// ── Module 12: Delivery Tracking ────────────────────────────────
Object.assign(Selectors, {
  deliveryList(d, statusFilter) {
    const rows = Selectors.deliveryStatusBoard(d);
    if (!statusFilter || statusFilter === 'All') return rows;
    return rows.filter((r) => r.status === statusFilter);
  },
  deliveryCounts(d) {
    const counts = { 'On Time': 0, Delayed: 0, Partial: 0, Complete: 0 };
    d.deliveries.forEach((x) => { counts[x.status] = (counts[x.status] || 0) + 1; });
    return counts;
  },
  eligiblePOsForDelivery(d) {
    return d.pos.filter((p) => p.status === 'Released');
  },
});

// ── Module 13: Goods Receipt (GRN) ───────────────────────────────
Object.assign(Selectors, {
  grnList(d) {
    return [...d.grns].sort((a, b) => (a.grnDate < b.grnDate ? 1 : -1));
  },
  eligiblePOsForGRN(d) {
    return d.pos.filter((p) => (p.status === 'Released' || p.status === 'Closed') && p.grnStatus !== 'Complete' && p.poType !== 'Service');
  },
});

// ── Module 14: Invoice Verification ─────────────────────────────
Object.assign(Selectors, {
  invoiceList(d, statusFilter) {
    const rows = [...d.invoices].sort((a, b) => (a.invoiceDate < b.invoiceDate ? 1 : -1));
    if (!statusFilter || statusFilter === 'All') return rows;
    return rows.filter((i) => i.status === statusFilter);
  },
  invoiceCounts(d) {
    const counts = { Pending: 0, Matched: 0, Blocked: 0, Verified: 0, Rejected: 0, Paid: 0 };
    d.invoices.forEach((i) => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return counts;
  },
  eligiblePOsForInvoice(d) {
    return d.pos.filter((p) => p.status === 'Released' || p.status === 'Closed');
  },
});

// ── Module 15: Payment Processing ───────────────────────────────
Object.assign(Selectors, {
  paymentList(d, statusFilter) {
    const rows = [...d.payments].sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1));
    if (!statusFilter || statusFilter === 'All') return rows;
    return rows.filter((p) => p.status === statusFilter);
  },
  paymentCounts(d) {
    const counts = { Pending: 0, Processed: 0, Failed: 0 };
    d.payments.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  },
  eligibleInvoicesForPayment(d) {
    return d.invoices.filter((i) => i.status === 'Verified');
  },
});

// ── Module 16: Reports & Audit ──────────────────────────────────
Object.assign(Selectors, {
  procurementSummary(d) {
    return {
      requirements: d.requirements.length, prs: d.prs.length, rfqs: d.rfqs.length,
      pos: d.pos.length, grns: d.grns.length, invoices: d.invoices.length, payments: d.payments.length,
      contracts: (d.contracts || []).length, disputes: (d.disputes || []).length,
      totalSpend: d.pos.filter((p) => p.status !== 'Cancelled').reduce((s, p) => s + p.total, 0),
      openPOs: d.pos.filter((p) => p.status !== 'Closed' && p.status !== 'Cancelled').length,
      paidInvoices: d.invoices.filter((i) => i.status === 'Paid').length,
    };
  },
  monthlySpend(d) {
    const buckets = {};
    d.pos.filter((p) => p.status !== 'Cancelled').forEach((p) => {
      const month = (p.poDate || '').slice(0, 7) || 'Unknown';
      buckets[month] = (buckets[month] || 0) + p.total;
    });
    return Object.entries(buckets).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, total]) => ({ month, total }));
  },
  departmentSpend(d) {
    const buckets = {};
    d.pos.filter((p) => p.status !== 'Cancelled').forEach((p) => {
      buckets[p.department] = (buckets[p.department] || 0) + p.total;
    });
    return Object.entries(buckets).map(([department, total]) => ({ department, total })).sort((a, b) => b.total - a.total);
  },
  openPOReport(d) {
    return d.pos.filter((p) => p.status !== 'Closed' && p.status !== 'Cancelled').sort((a, b) => (a.poDate < b.poDate ? 1 : -1));
  },
  fullAuditLog(d, typeFilter, query) {
    let rows = [...d.activity];
    if (typeFilter && typeFilter !== 'All') rows = rows.filter((a) => a.type === typeFilter);
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter((a) => (a.refNumber || '').toLowerCase().includes(q) || (a.detail || '').toLowerCase().includes(q) || (a.actor || '').toLowerCase().includes(q));
    }
    return rows;
  },
  auditActivityTypes(d) {
    return Array.from(new Set(d.activity.map((a) => a.type))).sort();
  },
});
