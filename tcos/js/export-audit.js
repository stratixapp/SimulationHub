/* ============================================================
   CONSIGNIA DESK — Final Export File Audit
   ------------------------------------------------------------
   Aggregates: document completeness against the plan, the
   Cross-Document Consistency Engine, and the LC Compliance
   Check (if an LC is on file) into a single READY / NOT READY
   result — Section 28/39 of the master brief.
   ============================================================ */

function ensureJobInAuditableState(job) {
  if (job.status === 'AUDIT_FAILED' || job.status === 'AUDIT_PASSED' || job.status === 'COMPLETE') setExportJobStatus(job, 'DOCUMENTS_IN_PROGRESS');
  if (job.status === 'DOCUMENTS_IN_PROGRESS') setExportJobStatus(job, 'READY_FOR_AUDIT');
}

function computeExportAudit(jobId) {
  const job = getExportJob(jobId);
  const docRows = job.documentPlan.filter(d => d.status !== 'NOT_APPLICABLE').map(d => {
    const doc = currentDocOfType(jobId, d.doc);
    return { label: d.label, planStatus: d.status, docStatus: doc ? doc.status : 'NOT_STARTED', ready: !!doc && doc.status === 'READY' };
  });
  const requiredRows = docRows.filter(r => r.planStatus === 'REQUIRED');
  const completenessPct = requiredRows.length ? Math.round((requiredRows.filter(r => r.ready).length / requiredRows.length) * 100) : 100;

  const consistency = runConsistencyCheck(jobId);
  const hasLC = !!currentDocOfType(jobId, 'LETTER_OF_CREDIT');
  const lcCheck = hasLC ? runLCComplianceCheck(jobId) : null;

  const criticalIssues = (consistency.counts.CRITICAL || 0) + (consistency.counts.MISMATCH || 0) + (lcCheck ? (lcCheck.counts.DISCREPANCY || 0) : 0);
  const warnings = (consistency.counts.WARNING || 0) + (lcCheck ? (lcCheck.counts['DATA MISMATCH'] || 0) : 0);
  const missingDocs = requiredRows.filter(r => !r.ready).length;

  const overallReady = completenessPct === 100 && criticalIssues === 0 && missingDocs === 0;

  return { job, docRows, requiredRows, completenessPct, consistency, lcCheck, criticalIssues, warnings, missingDocs, overallReady };
}

function renderExportAudit() {
  const jobId = CURRENT_EXPORT_JOB_ID;
  const job = getExportJob(jobId);
  const host = $('#screen-exportAudit');
  if (!job) { host.innerHTML = '<div class="xd-root"><p class="hint">Export Job not found.</p></div>'; return; }
  ensureJobInAuditableState(job);
  saveState();

  const a = computeExportAudit(jobId);
  if (a.overallReady) { if (job.status === 'READY_FOR_AUDIT') setExportJobStatus(job, 'AUDIT_PASSED'); }
  else { if (job.status === 'READY_FOR_AUDIT') setExportJobStatus(job, 'AUDIT_FAILED'); }
  saveState();

  const docBadge = (s) => s === 'READY' ? 'badge-green' : (s === 'DRAFT' ? 'badge-amber' : 'badge-grey');

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / ${esc(job.id)} / <b>Final Export File Audit</b></div>
      <h1>Export File Audit</h1>
      <p class="hint">${esc(job.brief.commodity)} · ${esc(job.brief.destinationCountry)} · ${esc(job.brief.mode)}</p></div>
      <button class="btn-ghost" onclick="navToExportJobDetail('${job.id}')">Back to Export Job</button>
    </div>

    <div class="xd-card" style="border-left-color:${a.overallReady ? '#1e7d3c' : '#b3261e'}">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px">
        <div>
          <div class="xd-subhead">Document Completeness</div>
          <div style="font-size:32px;font-weight:700;font-family:'Courier New',monospace">${a.completenessPct}%</div>
        </div>
        <div class="xd-cards" style="margin:0">
          <div class="xd-stat"><b>${a.criticalIssues}</b><span>Critical Issues</span></div>
          <div class="xd-stat"><b>${a.warnings}</b><span>Warnings</span></div>
          <div class="xd-stat"><b>${a.missingDocs}</b><span>Missing Required Docs</span></div>
        </div>
        <div class="badge ${a.overallReady ? 'badge-green' : 'badge-red'}" style="font-size:15px;padding:8px 16px">${a.overallReady ? 'EXPORT FILE READY' : 'NOT READY'}</div>
      </div>
    </div>

    <div class="xd-card"><h3>Document-by-Document Audit</h3>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Document</th><th>Plan</th><th>Status</th></tr></thead>
        <tbody>${a.docRows.map(r => `<tr><td>${esc(r.label)}</td><td><span class="badge ${XD_STATUS_BADGE[r.planStatus]}">${esc(r.planStatus.replace(/_/g, ' '))}</span></td><td><span class="badge ${docBadge(r.docStatus)}">${esc(r.docStatus.replace(/_/g, ' '))}</span></td></tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="xd-card"><h3>Cross-Document Consistency</h3>${renderConsistencySummary(a.consistency)}</div>
    ${a.lcCheck ? `<div class="xd-card"><h3>LC Document Compliance</h3>${renderLcComplianceSummary(a.lcCheck)}</div>` : ''}

    <div class="actions">
      <button class="btn-ghost" onclick="renderExportAudit()">Re-run Full Audit</button>
      ${a.overallReady
        ? `<button class="next" onclick="markExportJobComplete('${job.id}')">Mark Export Job Complete</button>`
        : `<button class="next" onclick="navToExportJobDetail('${job.id}')">Return to Document Plan</button>`}
    </div>
  </div>`;
}

function markExportJobComplete(jobId) {
  const job = getExportJob(jobId);
  if (job.status !== 'AUDIT_PASSED') { toast('Audit must pass before the job can be marked complete.', 'error'); return; }
  setExportJobStatus(job, 'COMPLETE');
  saveState();
  toast('Export Job marked Complete.', 'success');
  navTo('exportDesk');
}
