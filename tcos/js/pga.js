/* ============================================================
   ICEGATE TRAINING SIMULATOR — PGA / NOC MODULE (SWIFT)
   Real rule modeled: certain commodities need a No Objection
   Certificate from a Participating Government Agency (FSSAI,
   Plant Quarantine, Drug Controller, BIS, Wildlife) before LEO/OOC
   can be granted, regardless of how clean the customs paperwork is.
   ============================================================ */

function computePGARequirements(filing) {
  const agencies = new Set();
  (filing.items || []).forEach(it => {
    const meta = HS_CODE_TABLE[it.hsCode];
    if (meta && meta.pgaAgency) agencies.add(meta.pgaAgency);
  });
  return Array.from(agencies);
}

function initializePGAForFiling(filing) {
  const agencies = computePGARequirements(filing);
  filing.pga = agencies.map(a => ({ agency: a, status: 'NOT_APPLIED', refNo: null, note: '' }));
  if (filing.pga.length) {
    pushTimeline(filing, filing.status, `PGA/NOC clearance required from: ${filing.pga.map(p => PGA_AGENCIES[p.agency].name).join(', ')}.`);
    addNotification(`${filing.id} requires PGA clearance from ${filing.pga.length} agenc${filing.pga.length > 1 ? 'ies' : 'y'} before LEO/OOC.`, filing.id);
  }
}

function pgaAllClear(filing) {
  return !filing.pga || filing.pga.every(p => p.status === 'CLEARED');
}

function applyForPGAClearance(filingId, agency) {
  const filing = getFiling(filingId);
  if (!filing) return;
  const p = filing.pga.find(x => x.agency === agency);
  if (!p) return;
  p.status = 'APPLIED';
  saveState();
  const queried = Math.random() < 0.3;
  if (queried) {
    p.status = 'QUERY';
    p.note = `${PGA_AGENCIES[agency].name} has requested additional supporting documentation before granting the ${PGA_AGENCIES[agency].noc}.`;
    addNotification(`${PGA_AGENCIES[agency].name} raised a query on ${filing.id}.`, filing.id);
  } else {
    p.status = 'CLEARED';
    p.refNo = uniqueId('NOC', () => 'NOC-' + agency.slice(0, 3) + '-' + Math.floor(100000 + Math.random() * 900000));
    pushTimeline(filing, filing.status, `${PGA_AGENCIES[agency].name} granted ${PGA_AGENCIES[agency].noc}: ${p.refNo}`);
    addDocument(PGA_AGENCIES[agency].noc, filing.id, `${PGA_AGENCIES[agency].name} — NOC`);
    addNotification(`${PGA_AGENCIES[agency].name} cleared ${filing.id}: ${p.refNo}`, filing.id);
  }
  saveState();
  if (typeof renderFilingDetail === 'function') renderFilingDetail(filing.id);
}

function respondToPGAQuery(filingId, agency, note) {
  const filing = getFiling(filingId);
  if (!filing) return;
  const p = filing.pga.find(x => x.agency === agency);
  if (!p) return;
  if (!note || note.trim().length < 10) { toast('Please provide a response of at least 10 characters.', 'error'); return; }
  p.status = 'CLEARED';
  p.refNo = uniqueId('NOC', () => 'NOC-' + agency.slice(0, 3) + '-' + Math.floor(100000 + Math.random() * 900000));
  pushTimeline(filing, filing.status, `Response submitted to ${PGA_AGENCIES[agency].name}; NOC granted: ${p.refNo}`);
  addDocument(PGA_AGENCIES[agency].noc, filing.id, `${PGA_AGENCIES[agency].name} — NOC`);
  addNotification(`${PGA_AGENCIES[agency].name} cleared ${filing.id} after response: ${p.refNo}`, filing.id);
  saveState();
  if (typeof renderFilingDetail === 'function') renderFilingDetail(filing.id);
  toast('PGA query response submitted and cleared.', 'success');
}

function pgaPanelHTML(filing) {
  if (!filing.pga || !filing.pga.length) return '';
  return `<div class="wz-card"><h3>PGA / NOC Clearance (Single Window)</h3>
    <p class="hint">This consignment requires clearance from the following Participating Government Agencies before ${filing.type === 'export' ? 'LEO' : 'Out of Charge'} can be granted.</p>
    ${filing.pga.map(p => `
      <div class="pga-row">
        <b>${esc(PGA_AGENCIES[p.agency].name)}</b> — <span class="badge ${p.status === 'CLEARED' ? 'badge-green' : (p.status === 'QUERY' ? 'badge-red' : 'badge-amber')}">${esc(p.status.replace('_', ' '))}</span>
        ${p.status === 'NOT_APPLIED' ? `<div><button class="btn-ghost sm" onclick="applyForPGAClearance('${filing.id}','${p.agency}')">Apply for ${esc(PGA_AGENCIES[p.agency].noc)}</button></div>` : ''}
        ${p.status === 'QUERY' ? `<div class="alert alert-error" style="margin:6px 0">${esc(p.note)}</div>
          <textarea id="pgaResp_${esc(p.agency)}" rows="2" placeholder="Response to agency query…"></textarea>
          <button class="btn-ghost sm" style="margin-top:6px" onclick="respondToPGAQuery('${filing.id}','${p.agency}', document.getElementById('pgaResp_${esc(p.agency)}').value)">Submit Response</button>` : ''}
        ${p.status === 'CLEARED' ? `<div class="hint">NOC Reference: ${esc(p.refNo)}</div>` : ''}
      </div>`).join('<hr style="border:none;border-top:1px solid #eee;margin:10px 0">')}
  </div>`;
}
