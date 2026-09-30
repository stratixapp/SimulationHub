/* ============================================================
   CONSIGNIA DESK — Export Job Master & Document Planner
   ------------------------------------------------------------
   An Export Job is a shipment-level wrapper. It LINKS to an existing
   Shipping Bill filing and/or freight booking by id — it never
   duplicates or reinterprets their fields (Section 5 of the
   integration plan). Everything here is additive to TCOS.
   ============================================================ */

var XD_BRIEF_DRAFT = null; // in-progress Export Brief form state, before a job exists

function startNewExportJob() {
  XD_BRIEF_DRAFT = {
    buyerName: '', commodity: '', commodityCategory: '', hsCode: '', quantity: '', unit: '',
    currency: '', incoterm: '', paymentMethod: '', mode: '', destinationCountry: '',
    ftaClaim: false, dangerousGoods: false, scomet: false, packagingMaterial: '',
    linkedFilingId: '', linkedBookingId: '', notes: ''
  };
  navTo('exportJobBrief');
}

function exportBriefFieldDefs() {
  return [
    { key: 'buyerName', label: 'Buyer Name', required: true },
    { key: 'commodity', label: 'Commodity / Product', required: true },
    { key: 'commodityCategory', label: 'Commodity Category', required: true, type: 'select', options: COMMODITY_CATEGORIES },
    { key: 'hsCode', label: 'HS Code (8-digit)', required: true, placeholder: 'e.g. 61091000' },
    { key: 'quantity', label: 'Quantity', required: true, type: 'number', number: true },
    { key: 'unit', label: 'Unit', required: true, type: 'select', options: UNITS },
    { key: 'currency', label: 'Currency', required: true, type: 'select', options: CURRENCIES },
    { key: 'incoterm', label: 'Incoterm', required: true, type: 'select', options: INCOTERMS },
    { key: 'paymentMethod', label: 'Payment Method', required: true, type: 'select', options: PAYMENT_METHODS },
    { key: 'mode', label: 'Mode of Transport', required: true, type: 'select', options: MODES_OF_TRANSPORT },
    { key: 'destinationCountry', label: 'Country of Destination', required: true, type: 'select', options: COUNTRIES },
    { key: 'packagingMaterial', label: 'Packaging Material', type: 'select', options: PACKAGING_MATERIALS },
    { key: 'notes', label: 'Brief / Notes', full: true, type: 'textarea' }
  ];
}

function renderExportJobBrief() {
  const host = $('#screen-exportJobBrief');
  const b = XD_BRIEF_DRAFT;
  const openExportFilings = STATE.filings.filter(f => f.type === 'export');
  const bookings = STATE.bookings;
  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / <b>New Export Job</b></div>
      <h1>Export Brief</h1>
      <p class="hint">Capture the shipment's commercial facts once. The Document Planner below will use this to work out what your export file actually needs — nothing is force-filled into any document.</p></div>
    </div>
    <div class="xd-card">
      <h3>Shipment Facts</h3>
      <div class="grid">${exportBriefFieldDefs().map(f => fieldHTML({ id: 'xdb__' + f.key, label: f.label, required: f.required, full: f.full, type: f.type, options: f.options, placeholder: f.placeholder }, b[f.key])).join('')}</div>
      <div class="grid" style="margin-top:6px">
        <label class="xd-check"><input type="checkbox" id="xdb__ftaClaim" ${b.ftaClaim ? 'checked' : ''}> Buyer/contract claims preferential tariff treatment (FTA)</label>
        <label class="xd-check"><input type="checkbox" id="xdb__dangerousGoods" ${b.dangerousGoods ? 'checked' : ''}> Cargo is Dangerous Goods</label>
        <label class="xd-check"><input type="checkbox" id="xdb__scomet" ${b.scomet ? 'checked' : ''}> Item is SCOMET / export-controlled</label>
      </div>
    </div>
    <div class="xd-card">
      <h3>Link to Existing Filing / Booking <span class="hint">(optional)</span></h3>
      <p class="hint">If a Shipping Bill or freight booking already exists for this shipment, link it here so Duty Drawback, RoDTEP, BRC and the freight lifecycle keep working exactly as before — Consignia Desk documents sit alongside them, not instead of them.</p>
      <div class="grid">
        <div class="field"><label>Shipping Bill (Export Filing)</label>
          <select id="xdb__linkedFilingId"><option value="">— None —</option>
            ${openExportFilings.map(f => `<option value="${esc(f.id)}" ${b.linkedFilingId === f.id ? 'selected' : ''}>${esc(f.id)} — ${esc(f.party.exporterName || 'Unnamed exporter')}</option>`).join('')}
          </select></div>
        <div class="field"><label>Freight Booking</label>
          <select id="xdb__linkedBookingId"><option value="">— None —</option>
            ${bookings.map(bk => `<option value="${esc(bk.id)}" ${b.linkedBookingId === bk.id ? 'selected' : ''}>${esc(bk.id)} — ${esc(bk.consigneeName || 'Unnamed consignee')}</option>`).join('')}
          </select></div>
      </div>
    </div>
    <div class="ferr" id="err_exportBrief"></div>
    <div class="actions">
      <button class="back2" onclick="navTo('exportDesk')">Cancel</button>
      <button class="next" onclick="submitExportBrief()">Create Export Job &amp; View Document Plan</button>
    </div>
  </div>`;
}

function submitExportBrief() {
  const host = $('#screen-exportJobBrief');
  clearFieldErrors(host);
  const b = XD_BRIEF_DRAFT;
  exportBriefFieldDefs().forEach(f => {
    const node = $('#xdb__' + f.key, host);
    if (!node) return;
    b[f.key] = f.number ? (node.value === '' ? '' : Number(node.value)) : node.value;
  });
  b.ftaClaim = $('#xdb__ftaClaim', host).checked;
  b.dangerousGoods = $('#xdb__dangerousGoods', host).checked;
  b.scomet = $('#xdb__scomet', host).checked;
  b.linkedFilingId = $('#xdb__linkedFilingId', host).value || null;
  b.linkedBookingId = $('#xdb__linkedBookingId', host).value || null;

  const missing = exportBriefFieldDefs().filter(f => f.required && !b[f.key] && b[f.key] !== 0);
  if (missing.length) {
    missing.forEach(f => showFieldError(host, 'xdb__' + f.key, 'Required'));
    showFieldError(host, 'exportBrief', `Please complete: ${missing.map(f => f.label).join(', ')}`);
    return;
  }
  if (b.hsCode && !/^[0-9]{8}$/.test(String(b.hsCode))) {
    showFieldError(host, 'xdb__hsCode', 'HS Code must be 8 digits');
    return;
  }

  const id = newId('EXJ');
  const job = {
    id, status: 'PLANNING', createdAt: Date.now(), updatedAt: Date.now(),
    linkedFilingId: b.linkedFilingId, linkedBookingId: b.linkedBookingId,
    brief: { ...b },
    documentPlan: computeDocumentPlan(b),
    documentIds: {}
  };
  setExportJobStatus(job, 'DOCUMENTS_IN_PROGRESS');
  STATE.exportJobs.unshift(job);
  saveState();
  toast('Export Job created — Document Plan ready.', 'success');
  if (XD_BRIDGE_TARGET_DOC_TYPE && XD_DOC_WORKSTATIONS[XD_BRIDGE_TARGET_DOC_TYPE]) {
    const targetType = XD_BRIDGE_TARGET_DOC_TYPE;
    XD_BRIDGE_TARGET_DOC_TYPE = null;
    XD_DOC_WORKSTATIONS[targetType](id);
  } else {
    navToExportJobDetail(id);
  }
}

function navToExportJobDetail(id) { CURRENT_EXPORT_JOB_ID = id; navTo('exportJobDetail'); }
var CURRENT_EXPORT_JOB_ID = null;

const XD_STATUS_BADGE = {
  REQUIRED: 'badge-red', CONDITIONAL: 'badge-amber', RECOMMENDED: 'badge-blue', NOT_APPLICABLE: 'badge-grey'
};
const XD_DOC_STATUS_BADGE = { NOT_STARTED: 'badge-grey', DRAFT: 'badge-amber', READY: 'badge-green' };

/* Which documents already have a real workstation built (Phase order — Section 9
   of the integration plan). Everything else in the catalog shows its planner
   status honestly, with a "not yet built" note instead of a dead link. */
const XD_DOC_WORKSTATIONS = {
  COMMERCIAL_INVOICE: (jobId) => openInvoiceWorkstation(jobId),
  PACKING_LIST: (jobId) => openPackingListWorkstation(jobId),
  BILL_OF_LADING: (jobId) => openTransportDocWorkstation(jobId),
  AIR_WAYBILL: (jobId) => openTransportDocWorkstation(jobId),
  CERTIFICATE_OF_ORIGIN: (jobId) => openCooWorkstation(jobId),
  INSURANCE_CERTIFICATE: (jobId) => openInsuranceWorkstation(jobId),
  LETTER_OF_CREDIT: (jobId) => openLcWorkstation(jobId),
  BILL_OF_EXCHANGE: (jobId) => openBoeWorkstation(jobId),
  EXPORT_LICENSE: (jobId) => openLicenseWorkstation(jobId),
  PHYTOSANITARY_CERTIFICATE: (jobId) => openCommodityCertWorkstation('PHYTOSANITARY_CERTIFICATE', jobId),
  HEALTH_CERTIFICATE: (jobId) => openCommodityCertWorkstation('HEALTH_CERTIFICATE', jobId),
  FUMIGATION_CERTIFICATE: (jobId) => openCommodityCertWorkstation('FUMIGATION_CERTIFICATE', jobId),
  CATCH_CERTIFICATE: (jobId) => openCommodityCertWorkstation('CATCH_CERTIFICATE', jobId),
  HACCP_CERTIFICATE: (jobId) => openCommodityCertWorkstation('HACCP_CERTIFICATE', jobId),
  DG_DECLARATION: (jobId) => openCommodityCertWorkstation('DG_DECLARATION', jobId)
};

function exportJobDocStatus(job, docType) {
  const doc = currentDocOfType(job.id, docType);
  if (!doc) return { status: 'NOT_STARTED', version: null };
  return { status: doc.status, version: doc.version };
}

function renderExportJobDetail(id) {
  const job = getExportJob(id || CURRENT_EXPORT_JOB_ID);
  const host = $('#screen-exportJobDetail');
  if (!job) { host.innerHTML = '<div class="xd-root"><p class="hint">Export Job not found.</p></div>'; return; }
  const groups = ['CORE', 'TRANSPORT', 'ORIGIN', 'FINANCIAL', 'REGULATORY', 'COMMODITY'];
  const filing = job.linkedFilingId ? getFiling(job.linkedFilingId) : null;
  const booking = job.linkedBookingId ? getBooking(job.linkedBookingId) : null;
  const check = STATE.consistencyChecks.find(c => c.exportJobId === job.id && !c.kind);
  const lcCheck = STATE.consistencyChecks.find(c => c.exportJobId === job.id && c.kind === 'LC_COMPLIANCE');

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Export Documentation Desk / <b>${esc(job.id)}</b></div>
      <h1>${esc(job.brief.commodity)} <span class="badge badge-blue">${esc(job.status.replace(/_/g, ' '))}</span></h1>
      <p class="hint">${esc(job.brief.buyerName)} · ${esc(job.brief.destinationCountry)} · ${esc(job.brief.mode)} · ${esc(job.brief.incoterm)} · ${esc(job.brief.paymentMethod)}</p></div>
      <button class="btn-ghost" onclick="navTo('exportDesk')">Back to Desk</button>
    </div>

    <div class="xd-card">
      <h3>Linked Records</h3>
      <p class="hint">${filing ? `Shipping Bill: <b>${esc(filing.id)}</b> (${esc(filing.status)})` : 'No Shipping Bill linked yet.'} &nbsp;·&nbsp; ${booking ? `Freight Booking: <b>${esc(booking.id)}</b> (${esc(booking.status)})` : 'No freight booking linked yet.'}</p>
    </div>

    <div class="xd-card">
      <h3>Document Plan</h3>
      ${groups.map(g => {
        const docs = job.documentPlan.filter(d => d.category === g);
        if (!docs.length) return '';
        return `<h4 class="xd-subhead">${esc(g)}</h4><div class="table-wrap"><table class="data-table">
          <thead><tr><th>Document</th><th>Applicability</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${docs.map(d => {
            const ds = exportJobDocStatus(job, d.doc);
            const hasWorkstation = !!XD_DOC_WORKSTATIONS[d.doc];
            const actionable = d.status !== 'NOT_APPLICABLE' && hasWorkstation;
            return `<tr>
              <td>${esc(d.label)}</td>
              <td><span class="badge ${XD_STATUS_BADGE[d.status]}">${esc(d.status.replace(/_/g, ' '))}</span></td>
              <td class="hint">${esc(d.reason)}</td>
              <td>${d.status === 'NOT_APPLICABLE' ? '—' : `<span class="badge ${XD_DOC_STATUS_BADGE[ds.status]}">${esc(ds.status.replace(/_/g, ' '))}${ds.version ? ' v' + ds.version : ''}</span>`}</td>
              <td>${actionable ? `<button class="btn-ghost sm" onclick="XD_DOC_WORKSTATIONS['${d.doc}']('${job.id}')">${ds.status === 'NOT_STARTED' ? 'Start' : 'Open'}</button>` : (d.status === 'NOT_APPLICABLE' ? '' : '<span class="hint">Not yet built</span>')}</td>
            </tr>`;
          }).join('')}</tbody></table></div>`;
      }).join('')}
    </div>

    <div class="xd-card">
      <h3>Cross-Document Consistency</h3>
      ${check ? renderConsistencySummary(check) : '<p class="hint">Run once at least two documents (e.g. Commercial Invoice + Packing List) have a Ready draft.</p>'}
      <button class="btn-ghost sm" onclick="runConsistencyCheck('${job.id}'); renderExportJobDetail('${job.id}')">Run Consistency Check</button>
    </div>
    ${currentDocOfType(job.id, 'LETTER_OF_CREDIT') ? `<div class="xd-card">
      <h3>LC Document Compliance</h3>
      ${lcCheck ? renderLcComplianceSummary(lcCheck) : '<p class="hint">Run from the Letter of Credit screen, or here.</p>'}
      <button class="btn-ghost sm" onclick="runLCComplianceCheck('${job.id}'); renderExportJobDetail('${job.id}')">Run Compliance Check</button>
    </div>` : ''}

    <div class="xd-card">
      <h3>Final Export File Audit</h3>
      <p class="hint">Pulls document completeness, cross-document consistency, and LC compliance (if applicable) into one READY / NOT READY result.</p>
      <button class="next sm" onclick="navToExportAudit('${job.id}')">Open Final Audit</button>
    </div>
  </div>`;
}

function navToExportAudit(jobId) { CURRENT_EXPORT_JOB_ID = jobId; navTo('exportAudit'); }

/* ---------------- Start from an existing TCOS scenario ----------------
   Interconnection point (not a new/duplicate scenario library): reuses
   TCOS's own SCENARIOS data. Follows TCOS's own established rule (see
   startNewFiling's comment in filingForm.js) of never silently filling
   a document — the linked Shipping Bill filing stays blank exactly as
   a normal new filing does, and the Export Brief is pre-filled but
   still requires the student's review and explicit "Create" action. */
function startExportJobFromScenario(scenarioId) {
  const scenario = SCENARIOS.find(s => s.id === scenarioId && s.type === 'export');
  if (!scenario) return;
  const filing = startNewFiling('export', scenario);
  const p = scenario.prefill;
  const firstItem = (p.items && p.items[0]) || {};
  const mappedPayment = PAYMENT_METHODS.includes(p.invoice.paymentTerms) ? p.invoice.paymentTerms : '';
  const mappedMode = MODES_OF_TRANSPORT.includes(p.shipment.modeOfTransport) ? p.shipment.modeOfTransport : '';
  const mappedUnit = UNITS.includes(firstItem.unit) ? firstItem.unit : '';
  XD_BRIEF_DRAFT = {
    buyerName: p.counterparty.consigneeName || '', commodity: firstItem.description || '', commodityCategory: '',
    hsCode: firstItem.hsCode || '', quantity: firstItem.qty || '', unit: mappedUnit,
    currency: p.invoice.currency || '', incoterm: p.invoice.incoterm || '', paymentMethod: mappedPayment,
    mode: mappedMode, destinationCountry: p.shipment.countryOfDestination || '',
    ftaClaim: false, dangerousGoods: false, scomet: false, packagingMaterial: '',
    linkedFilingId: filing.id, linkedBookingId: '',
    notes: `Started from TCOS scenario ${scenario.id} — ${scenario.title}. Review every field below before creating the job; nothing here was filled in silently.`
  };
  navTo('exportJobBrief');
}

function renderExportDesk() {
  const host = $('#screen-exportDesk');
  const jobs = STATE.exportJobs;
  const active = jobs.filter(j => j.status !== 'COMPLETE');
  const docsPending = jobs.reduce((n, j) => n + j.documentPlan.filter(d => d.status !== 'NOT_APPLICABLE' && exportJobDocStatus(j, d.doc).status !== 'READY').length, 0);

  host.innerHTML = `
  <div class="xd-root">
    <div class="page-head">
      <div><div class="crumb">Consignia Desk</div><h1>Export Documentation Desk</h1>
      <p class="hint">Build the real export document file for a shipment — Commercial Invoice, Packing List, and the rest of the document plan — cross-checked against each other and against the Shipping Bill.</p></div>
      <button class="next" onclick="startNewExportJob()">+ New Export Job</button>
    </div>
    <div class="xd-cards">
      <div class="xd-stat"><b>${active.length}</b><span>Active Export Jobs</span></div>
      <div class="xd-stat"><b>${jobs.length - active.length}</b><span>Complete</span></div>
      <div class="xd-stat"><b>${docsPending}</b><span>Documents Pending</span></div>
    </div>
    <div class="xd-card">
      <h3>Start from a TCOS Scenario</h3>
      <p class="hint">Reuses TCOS's own scenario library — creates a linked Shipping Bill filing (blank, exactly like a normal new filing) and pre-fills the Export Brief for you to review, not silently commit.</p>
      <div class="grid">${SCENARIOS.filter(s => s.type === 'export').map(s => `
        <div class="field full" style="border:1px solid var(--xd-line);border-radius:2px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div><b>${esc(s.title)}</b><br><span class="hint">${esc(s.desc)}</span></div>
          <button class="btn-ghost sm" onclick="startExportJobFromScenario('${s.id}')">Use This</button>
        </div>`).join('')}</div>
    </div>
    <div class="xd-card">
      <h3>Export Jobs</h3>
      ${jobs.length ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Job</th><th>Commodity</th><th>Buyer</th><th>Destination</th><th>Status</th><th></th></tr></thead>
        <tbody>${jobs.map(j => `<tr>
          <td>${esc(j.id)}</td><td>${esc(j.brief.commodity)}</td><td>${esc(j.brief.buyerName)}</td><td>${esc(j.brief.destinationCountry)}</td>
          <td><span class="badge badge-blue">${esc(j.status.replace(/_/g, ' '))}</span></td>
          <td><button class="btn-ghost sm" onclick="navToExportJobDetail('${j.id}')">Open</button></td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="hint">No Export Jobs yet — create one to get started.</p>'}
    </div>
  </div>`;
}
