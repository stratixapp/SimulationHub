/* ============================================================
   ICEGATE TRAINING SIMULATOR — CUSTOMS PROCESSING WORKFLOW
   ============================================================ */

function scenarioFor(filing) {
  return SCENARIOS.find(s => s.id === filing.scenarioId);
}

function round2(n) { return Math.round(n * 100) / 100; }
/* Merged from the parallel FINAL hardening pass (financial hardening): a rounded duty/incentive
   figure must never render as negative or non-finite to a trainee — clamp defensively at the
   point figures are finalized, on top of the existing num()/isFinite guards. */
function safeDuty(n) { const v = round2(n); return (!isFinite(v) || v < 0) ? 0 : v; }
function clampRate(r) { r = num(r); return Math.min(1, Math.max(0, r)); }

function submitFiling(filing) {
  /* Section 25: guard against double-submission (e.g. a fast double-click before the UI
     re-renders past the Submit button) creating a second acknowledgement/timeline/PGA-init. */
  if (filing.status !== 'DRAFT') { toast('This filing has already been submitted.', 'info'); return; }
  setFilingStatus(filing, 'SUBMITTED');
  pushTimeline(filing, 'SUBMITTED', 'Filing submitted by student for processing.');
  const ackNo = uniqueId('TRN-ACK', () => 'TRN-ACK-' + Math.floor(100000 + Math.random() * 900000));
  filing.ack = { refNo: ackNo, date: Date.now() };
  setFilingStatus(filing, 'ACKNOWLEDGED');
  pushTimeline(filing, 'ACKNOWLEDGED', `Acknowledgement generated: ${ackNo}`);
  addDocument('Acknowledgement', filing.id, (filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry') + ' Acknowledgement');
  initializePGAForFiling(filing);
  addNotification(`${filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry'} ${filing.id} submitted successfully — TRAINING ENVIRONMENT. Ack: ${ackNo}`, filing.id);
  saveState();
  navToFiling(filing.id);
  toast('Filing submitted successfully. Acknowledgement generated.', 'success');
}

/* ---------------- RISK MANAGEMENT SYSTEM (RMS) ---------------- */
function computeRiskScore(filing) {
  let score = 25;
  const factors = [];
  const tiers = filing.items.map(it => (HS_CODE_TABLE[it.hsCode] || {}).riskTier || 'Medium');
  const worstTier = tiers.includes('High') ? 'High' : (tiers.includes('Medium') ? 'Medium' : 'Low');
  const tierScore = { Low: 0, Medium: 15, High: 30 }[worstTier];
  score += tierScore; factors.push(`Commodity risk tier (${worstTier}): +${tierScore}`);

  const country = filing.counterparty.country;
  const countryTier = COUNTRY_RISK[country] || 'Medium';
  const countryScore = { Low: 0, Medium: 10, High: 20 }[countryTier];
  score += countryScore; factors.push(`Country risk tier (${countryTier}): +${countryScore}`);

  const violScore = STATE.riskProfile.violations * 10;
  if (violScore) { score += violScore; factors.push(`Past examination discrepancies on record: +${violScore}`); }
  const cleanBonus = Math.min(20, STATE.riskProfile.cleanFilings * 2);
  if (cleanBonus) { score -= cleanBonus; factors.push(`Clean filing history (${STATE.riskProfile.cleanFilings} filings): -${cleanBonus}`); }

  if (STATE.riskProfile.aeo) {
    const before = score;
    score = Math.round(score * 0.2);
    factors.push(`AEO (Authorized Economic Operator) accreditation: score reduced from ${before} to ${score}`);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const band = score >= 55 ? 'High' : (score >= 28 ? 'Medium' : 'Low');
  return { score, band, factors };
}

/* Determine (once) whether this filing gets a query / examination / discrepancy */
function determineProcessingOutcome(filing) {
  if (filing.processingOutcome) return filing.processingOutcome;
  const sc = scenarioFor(filing);
  const risk = computeRiskScore(filing);
  filing.riskAssessment = risk;
  let needsQuery, needsExam, discrepancy;
  if (sc) {
    needsQuery = !!sc.forceQuery;
    needsExam = !!sc.forceExam;
    discrepancy = !!sc.forceDiscrepancy;
  } else {
    const examProb = { High: 0.6, Medium: 0.3, Low: 0.05 }[risk.band];
    const queryProb = { High: 0.5, Medium: 0.25, Low: 0.05 }[risk.band];
    needsExam = Math.random() < examProb;
    needsQuery = Math.random() < queryProb;
    discrepancy = needsExam && Math.random() < 0.35;
  }
  /* First Check: examination is mandatory before assessment, regardless of RMS selection */
  if (filing.type === 'import' && filing.checkType && filing.checkType.indexOf('First Check') === 0) {
    needsExam = true;
  }
  filing.processingOutcome = { needsQuery, needsExam, discrepancy };
  saveState();
  return filing.processingOutcome;
}

/* Step button: "Proceed with Customs Processing" */
function runCustomsProcessing(filingId) {
  const filing = getFiling(filingId);
  if (!filing) return;
  setFilingStatus(filing, 'UNDER_PROCESS');
  pushTimeline(filing, 'UNDER_PROCESS', 'System validation and risk assessment in progress.');
  const outcome = determineProcessingOutcome(filing);
  if (outcome.needsQuery) {
    raiseQuery(filing);
  } else if (outcome.needsExam) {
    scheduleExamination(filing);
  } else {
    advancePastProcessing(filing);
  }
  saveState();
  renderFilingDetail(filing.id);
}

function advancePastProcessing(filing) {
  if (filing.type === 'import') {
    runAssessment(filing);
  } else {
    setFilingStatus(filing, 'CLEARED');
    pushTimeline(filing, 'CLEARED', 'Risk assessment complete. No query or examination required. Ready for Let Export Order.');
    addNotification(`No query or examination required for ${filing.id}. Ready for LEO.`, filing.id);
  }
}

/* ---------------- QUERY MODULE ---------------- */
function raiseQuery(filing) {
  setFilingStatus(filing, 'QUERY_RAISED');
  const officers = ['Appraising Officer, Group 3', 'Assistant Commissioner, Export Shed', 'Superintendent, Docks', 'Appraising Officer, Group 5'];
  const descs = filing.type === 'export'
    ? ['Clarification required regarding declared HS classification of the goods.', 'Discrepancy noted between declared FOB value and market indicative value — please clarify.', 'Please confirm the country of origin declaration for the exported items.']
    : ['Clarification required regarding declared assessable value.', 'Please clarify the classification (HS Code) declared for the imported goods.', 'Discrepancy noted in declared quantity vis-à-vis packing list — please clarify.'];
  filing.query = {
    number: uniqueId('QRY', () => 'QRY-' + Math.floor(100000 + Math.random() * 900000)),
    date: Date.now(),
    officer: officers[Math.floor(Math.random() * officers.length)],
    description: descs[Math.floor(Math.random() * descs.length)],
    status: 'QUERY RAISED',
    reply: ''
  };
  pushTimeline(filing, 'QUERY_RAISED', `Query ${filing.query.number} raised by Customs.`);
  addNotification(`Query raised on ${filing.id}: ${filing.query.number}. Response required.`, filing.id);
}

function submitQueryReply(filingId, replyText, attachedDocName) {
  const filing = getFiling(filingId);
  if (!filing || !filing.query) return;
  if (!replyText || replyText.trim().length < 15) { toast('Reply must be at least 15 characters and address the query.', 'error'); return; }
  filing.query.reply = replyText.trim();
  filing.query.replyAttachment = attachedDocName || null;
  filing.query.status = 'QUERY RESOLVED';
  setFilingStatus(filing, 'QUERY_REPLIED');
  pushTimeline(filing, 'QUERY_REPLIED', `Reply submitted for query ${filing.query.number}.`);
  addNotification(`Reply submitted for query ${filing.query.number} on ${filing.id}.`, filing.id);
  saveState();
  toast('Query reply submitted.', 'success');
  /* continue processing after query resolved */
  const outcome = determineProcessingOutcome(filing);
  if (outcome.needsExam) { scheduleExamination(filing); }
  else { advancePastProcessing(filing); }
  saveState();
  renderFilingDetail(filing.id);
}

/* ---------------- EXAMINATION MODULE ---------------- */
function scheduleExamination(filing) {
  setFilingStatus(filing, 'EXAMINATION');
  const locations = filing.type === 'export' ? ['Export Shed, CFS Nhava Sheva', 'Air Cargo Export Examination Bay', 'Dock Examination Yard'] : ['Import Shed, CFS Nhava Sheva', 'Air Cargo Import Examination Bay', 'Container Freight Station Bay 4'];
  filing.examination = {
    required: true, location: locations[Math.floor(Math.random() * locations.length)],
    date: todayISO(), result: 'SCHEDULED', remarks: ''
  };
  pushTimeline(filing, 'EXAMINATION', `Examination scheduled at ${filing.examination.location}.`);
  addNotification(`Examination scheduled for ${filing.id} at ${filing.examination.location}.`, filing.id);
}

function conductExamination(filingId) {
  const filing = getFiling(filingId);
  if (!filing) return;
  /* Merged from the parallel FINAL hardening pass: the discrepancy branch below already
     checked filing.examination.result === 'SCHEDULED', but the PASS branch had no equivalent
     guard — a second call (double-click, or a stray re-trigger) would re-run
     advancePastProcessing() and duplicate timeline/notification entries. Guard the whole
     function up front instead. */
  if (!filing.examination || filing.examination.result !== 'SCHEDULED') {
    toast('This examination has already been conducted — its result cannot be re-rolled.', 'error');
    return;
  }
  const outcome = determineProcessingOutcome(filing);
  if (outcome.discrepancy) {
    filing.examination.result = 'DISCREPANCY';
    filing.examination.remarks = filing.type === 'export'
      ? 'Physical package count does not match declared package count. Corrective action required before LEO can be granted.'
      : 'Physical examination reveals declared quantity does not match packing list. Corrective action required before duty assessment can proceed.';
    pushTimeline(filing, 'EXAMINATION', 'Examination conducted — discrepancy found. Corrective action required.');
    addNotification(`Examination discrepancy found on ${filing.id}. Corrective action required.`, filing.id);
  } else {
    filing.examination.result = 'PASS';
    filing.examination.remarks = 'Physical examination completed. Goods conform to declaration. No discrepancy found.';
    pushTimeline(filing, 'EXAMINATION', 'Examination conducted — result: PASS.');
    addNotification(`Examination completed for ${filing.id}: PASS.`, filing.id);
    advancePastProcessing(filing);
  }
  saveState();
  renderFilingDetail(filing.id);
}

function submitCorrectiveAction(filingId, note) {
  const filing = getFiling(filingId);
  if (!filing) return;
  if (!note || note.trim().length < 10) { toast('Please describe the corrective action taken (minimum 10 characters).', 'error'); return; }
  filing.examination.remarks += ' | Corrective action by student: ' + note.trim();
  filing.examination.result = 'PASS';
  pushTimeline(filing, 'EXAMINATION', 'Corrective action submitted and accepted. Examination result updated to PASS.');
  addNotification(`Corrective action accepted for ${filing.id}. Examination now shows PASS.`, filing.id);
  advancePastProcessing(filing);
  saveState();
  renderFilingDetail(filing.id);
  toast('Corrective action accepted.', 'success');
}

/* ---------------- DUTY CALCULATION (import only) ---------------- */
function runAssessment(filing) {
  setFilingStatus(filing, 'ASSESSED');
  const inv = filing.invoice;
  const fx = FX_TO_INR[inv.currency] || 1;
  const assessableValue = Math.max(0, (num(inv.invoiceValue) + num(inv.freight) + num(inv.insurance)) * fx);
  const firstItem = filing.items[0];
  const meta = firstItem && HS_CODE_TABLE[firstItem.hsCode];
  let bcdRate = clampRate(meta ? meta.bcdRate : 0.10);
  let cessRate = clampRate(meta ? (meta.cessRate || 0) : 0);
  let addRate = clampRate(meta ? (meta.addRate || 0) : 0);
  let ftaApplied = false;
  if (filing.ftaClaim) {
    const agreement = FTA_AGREEMENTS.find(a => a.code === filing.ftaClaim.code);
    const hasCOO = (filing.documents || []).some(d => d.type === 'Certificate of Origin' && d.status === 'ATTACHED TO FILING');
    if (agreement && hasCOO) { bcdRate = clampRate(agreement.preferentialBcdRate); ftaApplied = true; }
  }
  const bcd = assessableValue * bcdRate;
  const sws = bcd * SWS_RATE;
  const cess = assessableValue * cessRate;
  const add = assessableValue * addRate;
  const igstBase = assessableValue + bcd + sws + cess + add;
  const igst = igstBase * IGST_RATE_DEFAULT;
  const total = bcd + sws + cess + add + igst;
  filing.duty = {
    assessableValue: safeDuty(assessableValue),
    bcdRate, bcd: safeDuty(bcd),
    swsRate: SWS_RATE, sws: safeDuty(sws),
    cessRate, cess: safeDuty(cess),
    addRate, add: safeDuty(add),
    igstRate: IGST_RATE_DEFAULT, igst: safeDuty(igst),
    total: safeDuty(total),
    ftaApplied,
    note: 'Training calculation only. Rates are illustrative for this simulator — verify against the current CBIC Customs Tariff and notifications before real-world use.'
  };
  setFilingStatus(filing, 'DUTY_PENDING');
  pushTimeline(filing, 'ASSESSED', `Assessable value ₹${filing.duty.assessableValue.toLocaleString('en-IN')} — duty computed${ftaApplied ? ' with FTA preferential rate applied' : ''}.`);
  pushTimeline(filing, 'DUTY_PENDING', `Total duty payable: ₹${filing.duty.total.toLocaleString('en-IN')} (BCD + SWS + Cess + ADD + IGST)`);
  addDocument('Duty Challan', filing.id, 'Duty Assessment & Challan');
  addNotification(`Duty assessed for ${filing.id}: ₹${filing.duty.total.toLocaleString('en-IN')} payable.`, filing.id);
}

/* ---------------- CFS GATE-IN (import, non-DPD only) ---------------- */
function confirmCFSGateIn(filingId) {
  const filing = getFiling(filingId);
  if (!filing) return;
  filing.cfsGateIn = { ts: Date.now(), refNo: uniqueId('CFS-GATE', () => 'CFS-GATE-' + Math.floor(100000 + Math.random() * 900000)) };
  pushTimeline(filing, filing.status, `Cargo gated in at CFS: ${filing.cfsGateIn.refNo}`);
  addNotification(`Cargo gated in at CFS for ${filing.id}.`, filing.id);
  saveState();
  renderFilingDetail(filing.id);
}

/* ---------------- PAYMENT SIMULATION (import only) ---------------- */
function initiatePayment(filingId, method) {
  const filing = getFiling(filingId);
  if (!filing || !filing.duty) return;
  if (filing.payment && filing.payment.status === 'SUCCESS') { toast('Payment has already been completed for this filing.', 'info'); return; }
  if (filing.payment && filing.payment.status === 'INITIATED') { toast('A payment has already been initiated — confirm or wait for that one.', 'info'); return; }
  filing.payment = { challanNo: uniqueId('CHLN', () => 'CHLN-' + Math.floor(100000 + Math.random() * 900000)), amount: filing.duty.total, method, status: 'INITIATED' };
  pushTimeline(filing, 'DUTY_PENDING', `Payment initiated via ${method}. Challan ${filing.payment.challanNo}.`);
  saveState();
  renderFilingDetail(filing.id);
}
function confirmPayment(filingId) {
  const filing = getFiling(filingId);
  if (!filing || !filing.payment) return;
  if (filing.payment.status === 'SUCCESS') { toast('Payment has already been confirmed for this filing.', 'info'); return; }
  filing.payment.status = 'SUCCESS';
  setFilingStatus(filing, 'DUTY_PAID');
  pushTimeline(filing, 'DUTY_PAID', `Payment successful. Challan ${filing.payment.challanNo}.`);
  addDocument('Payment Receipt', filing.id, 'Duty Payment Receipt');
  addNotification(`Duty paid for ${filing.id}. Ready for Out of Charge.`, filing.id);
  saveState();
  renderFilingDetail(filing.id);
  toast('Payment successful. Receipt generated.', 'success');
}

/* ---------------- LEO (export) ---------------- */
function issueLEO(filingId) {
  const filing = getFiling(filingId);
  if (!filing) return;
  if (filing.leo) { toast('LEO has already been issued for this filing.', 'info'); return; }
  if (filing.query && filing.query.status !== 'QUERY RESOLVED') { toast('Cannot issue LEO — query is not yet resolved.', 'error'); return; }
  if (filing.examination && filing.examination.required && filing.examination.result !== 'PASS') { toast('Cannot issue LEO — examination has not passed.', 'error'); return; }
  if (!pgaAllClear(filing)) { toast('Cannot issue LEO — PGA/NOC clearance is still pending. See the PGA clearance panel below.', 'error'); return; }
  filing.leo = { refNo: uniqueId('LEO', () => 'LEO-' + Math.floor(100000 + Math.random() * 900000)), date: Date.now() };
  setFilingStatus(filing, 'LEO');
  pushTimeline(filing, 'LEO', `Let Export Order issued: ${filing.leo.refNo}`);
  addDocument('Let Export Order', filing.id, 'Let Export Order (LEO)');
  addNotification(`LEO granted for ${filing.id}: ${filing.leo.refNo}`, filing.id);
  setFilingStatus(filing, 'COMPLETED');
  pushTimeline(filing, 'COMPLETED', 'Export shipment cleared and completed.');
  computeAssessmentScore(filing);
  saveState();
  renderFilingDetail(filing.id);
  toast('LEO granted. Export shipment completed.', 'success');
}

/* ---------------- OOC (import) ---------------- */
function grantOOC(filingId) {
  const filing = getFiling(filingId);
  if (!filing) return;
  if (filing.ooc) { toast('Out of Charge has already been granted for this filing.', 'info'); return; }
  if (!filing.payment || filing.payment.status !== 'SUCCESS') { toast('Cannot grant Out of Charge — duty payment not completed.', 'error'); return; }
  if (filing.examination && filing.examination.required && filing.examination.result !== 'PASS') { toast('Cannot grant Out of Charge — examination has not passed.', 'error'); return; }
  if (!pgaAllClear(filing)) { toast('Cannot grant Out of Charge — PGA/NOC clearance is still pending. See the PGA clearance panel below.', 'error'); return; }
  if (filing.cfsRoute === 'CFS' && !filing.cfsGateIn) { toast('Cannot grant Out of Charge — cargo has not been gated in at the CFS.', 'error'); return; }
  filing.ooc = { refNo: uniqueId('OOC', () => 'OOC-' + Math.floor(100000 + Math.random() * 900000)), date: Date.now() };
  setFilingStatus(filing, 'OOC');
  pushTimeline(filing, 'OOC', `Out of Charge granted: ${filing.ooc.refNo}`);
  addDocument('Out of Charge Order', filing.id, 'Out of Charge (OOC)');
  addNotification(`OOC granted for ${filing.id}: ${filing.ooc.refNo}`, filing.id);
  setFilingStatus(filing, 'COMPLETED');
  pushTimeline(filing, 'COMPLETED', 'Import cargo released and shipment completed.');
  computeAssessmentScore(filing);
  saveState();
  renderFilingDetail(filing.id);
  toast('Out of Charge granted. Import shipment completed.', 'success');
  if (typeof DotBridge !== 'undefined') {
    const wasBridged = DotBridge.markCompleted('import', filing.id, 'bill-of-entry');
    if (wasBridged) {
      const b = DotBridge.getBridge();
      if (b && b.userId) DotBridge.silentCompleteLogisticsDoc(b.userId, 'out-of-charge', filing.id, 'Out of Charge Order');
      showBridgeReturnPrompt(filing.id, 'Bill of Entry');
    }
  }
}

/* ---------------- ASSESSMENT / SCORING ---------------- */
function computeAssessmentScore(filing) {
  let documentation = 20, dataEntry = 20, classification = 15, workflowKnowledge = 20, errorHandling = 15, timeManagement = 10;
  const errCount = (filing.validationErrors || []).length;
  dataEntry = Math.max(0, 20 - errCount * 3);
  const allDocsAttached = (filing.documents || []).every(d => d.status === 'ATTACHED TO FILING');
  documentation = allDocsAttached && filing.documents.length > 0 ? 20 : 10;
  const validHS = filing.items.every(it => /^[0-9]{8}$/.test(it.hsCode || ''));
  classification = validHS ? 15 : 7;
  const handledQuery = !filing.query || filing.query.status === 'QUERY RESOLVED';
  const handledExam = !filing.examination.required || filing.examination.result === 'PASS';
  const handledPGA = pgaAllClear(filing);
  workflowKnowledge = (handledQuery && handledExam && handledPGA) ? 20 : 12;
  errorHandling = filing.examination.remarks && filing.examination.remarks.includes('Corrective action by student') ? 15 : (filing.examination.required ? 10 : 15);
  timeManagement = 10; // simulator does not track wall-clock realism
  const total = documentation + dataEntry + classification + workflowKnowledge + errorHandling + timeManagement;
  const verdict = total >= 70 ? 'PASS' : 'NEEDS IMPROVEMENT';
  const record = {
    id: 'ASM' + Date.now(), filingId: filing.id, ts: Date.now(),
    breakdown: { documentation, dataEntry, classification, workflowKnowledge, errorHandling, timeManagement },
    total, verdict
  };
  STATE.assessments.unshift(record);
  addNotification(`Training assessment completed for ${filing.id}: ${total}/100 (${verdict}).`, filing.id);
  /* feed back into the training RMS trader-history profile */
  const hadDiscrepancy = filing.examination && filing.examination.result === 'DISCREPANCY';
  const hadCorrectedDiscrepancy = filing.examination && filing.examination.remarks && filing.examination.remarks.indexOf('Corrective action by student') !== -1;
  if (hadDiscrepancy || hadCorrectedDiscrepancy) STATE.riskProfile.violations = Math.min(5, STATE.riskProfile.violations + 1);
  else STATE.riskProfile.cleanFilings = Math.min(50, STATE.riskProfile.cleanFilings + 1);
  saveState();
  return record;
}

/* ---------------- AMENDMENTS (Section 149, Customs Act 1962, for post-clearance cases) ---------------- */
function requestAmendment(filingId, reasonType, reasonText, section149Justification) {
  const filing = getFiling(filingId);
  if (!filing) return;
  if (!reasonText || reasonText.trim().length < 10) { toast('Please describe the amendment reason (minimum 10 characters).', 'error'); return; }
  const postClearance = ['LEO', 'OOC', 'COMPLETED'].includes(filing.status);
  if (postClearance && (!section149Justification || section149Justification.trim().length < 15)) {
    toast('Post-clearance amendments require a Section 149 justification (minimum 15 characters).', 'error');
    return;
  }
  const delayMs = postClearance ? 2400 : 1600;
  const amend = {
    id: newId('AMD'), type: reasonType, reason: reasonText.trim(), status: 'UNDER REVIEW', ts: Date.now(), decision: '',
    postClearance, section149Justification: section149Justification ? section149Justification.trim() : null,
    /* Section 39/24 fix: persist WHEN this should resolve, not just a page-scoped setTimeout.
       A setTimeout is destroyed by any page reload/close, which would otherwise leave the
       amendment stuck at "UNDER REVIEW" forever with nothing to ever resolve it. Storing this
       on the record itself lets resolvePendingAmendments() catch it up on the next app load or
       screen render, using real elapsed time, regardless of whether this exact tab stayed open. */
    resolveAt: Date.now() + delayMs
  };
  filing.amendments = filing.amendments || [];
  filing.amendments.push(amend);
  pushTimeline(filing, filing.status, `Amendment requested (${reasonType}${postClearance ? ' — Section 149 application' : ''}): ${amend.id}`);
  addNotification(`Amendment ${amend.id} requested for ${filing.id}.`, filing.id);
  saveState();
  toast(postClearance ? 'Post-clearance amendment submitted for Assistant Commissioner review under Section 149.' : 'Amendment request submitted for review.', 'success');
  setTimeout(() => resolveAmendment(filingId, amend.id), delayMs);
}

/* Decides and applies the approval/rejection outcome for one pending amendment. Guarded so it's
   safe to call from multiple paths (the live setTimeout AND the reload catch-up sweep) without
   ever re-deciding an amendment that's already been resolved. */
function resolveAmendment(filingId, amendId) {
  const f2 = getFiling(filingId);
  const a2 = f2 && f2.amendments && f2.amendments.find(a => a.id === amendId);
  if (!a2 || a2.status !== 'UNDER REVIEW') return;
  const approved = Math.random() < (a2.postClearance ? 0.45 : 0.75);
  a2.status = approved ? 'APPROVED' : 'REJECTED';
  a2.decision = approved
    ? (a2.postClearance ? 'Amendment approved by the Assistant/Deputy Commissioner under Section 149 of the Customs Act, 1962 (training simulation).' : 'Amendment approved by Customs (training simulation).')
    : (a2.postClearance ? 'Amendment rejected under Section 149 — documentary evidence in existence at the time of clearance was not established (training simulation).' : 'Amendment rejected — insufficient supporting justification (training simulation).');
  pushTimeline(f2, f2.status, `Amendment ${a2.id} ${a2.status.toLowerCase()}.`);
  addNotification(`Amendment ${a2.id} ${a2.status.toLowerCase()} for ${filingId}.`, filingId);
  saveState();
  if (CURRENT_SCREEN === 'filingDetail' && CURRENT_FILING_ID === filingId) renderFilingDetail(filingId);
  if (CURRENT_SCREEN === 'amendments') renderAmendments();
}

/* Catch-up sweep: resolves any amendment whose resolveAt has already passed, regardless of
   whether the tab that requested it is still open. Called on login/session-restore and whenever
   the Amendments screen renders, so a stuck "UNDER REVIEW" from a prior reload gets cleaned up
   the moment the student is looking at something that would show it. */
function resolvePendingAmendments() {
  if (!STATE || !STATE.filings) return;
  const now = Date.now();
  STATE.filings.forEach(f => {
    (f.amendments || []).forEach(a => {
      if (a.status === 'UNDER REVIEW' && a.resolveAt && a.resolveAt <= now) {
        resolveAmendment(f.id, a.id);
      }
    });
  });
}
