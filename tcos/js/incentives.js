/* ============================================================
   TCOS TRAINING SIMULATOR — EXPORT INCENTIVES & REALISATION
   Duty Drawback (AIR) · RoDTEP · Advance Authorization/EPCG
   Export Obligation & Redemption · Bank Realisation Certificate (BRC)
   All rates/figures are illustrative training data — always verify
   current AIR/RoDTEP schedules and DGFT norms against official sources.
   ============================================================ */

function fxToINR(currency) { return FX_TO_INR[currency] || 1; }
/* Merged from the parallel FINAL hardening pass: claim/scrip amounts are whole rupees
   (matching the original Math.round display), just clamped so a bad rate/qty can never
   render as negative or non-finite. */
function safeAmount(n) { const v = Math.round(n); return (!isFinite(v) || v < 0) ? 0 : v; }

function eligibleIncentiveFilings() {
  return STATE.filings.filter(f => f.type === 'export' && ['LEO', 'COMPLETED'].includes(f.status));
}

/* ---------------- DUTY DRAWBACK (AIR) ---------------- */
function computeDrawbackAmount(filing) {
  const fx = fxToINR(filing.invoice.currency);
  let total = 0;
  (filing.items || []).forEach(it => {
    const rate = clampRate((HS_CODE_TABLE[it.hsCode] && HS_CODE_TABLE[it.hsCode].drawbackAIR) || 0);
    const itemValueINR = Math.max(0, num(it.qty)) * Math.max(0, num(it.unitPrice)) * fx;
    total += itemValueINR * rate;
  });
  return safeAmount(total);
}
function drawbackClaimFor(filingId) { return STATE.drawbackClaims.find(c => c.filingId === filingId); }
function fileDrawbackClaim(filingId) {
  const filing = getFiling(filingId);
  if (!filing) return;
  if (drawbackClaimFor(filingId)) { toast('A Duty Drawback claim already exists for this filing.', 'error'); return; }
  const amount = computeDrawbackAmount(filing);
  if (amount <= 0) { toast('No Duty Drawback AIR rate applies to the items in this filing.', 'error'); return; }
  const claim = { id: newId('DBK'), filingId, ts: Date.now(), amount, status: 'FILED', sanctionedAmount: null, sanctionedTs: null, disbursedTs: null, shippingBillNo: filing.id };
  STATE.drawbackClaims.unshift(claim);
  addNotification(`Duty Drawback claim ${claim.id} filed for ${filing.id} — claimed amount ₹${amount.toLocaleString('en-IN')}.`, filing.id);
  saveState();
  toast('Duty Drawback claim filed.', 'success');
  renderIncentivesCentre();
}
function sanctionDrawbackClaim(claimId) {
  const c = STATE.drawbackClaims.find(x => x.id === claimId);
  if (!c || c.status !== 'FILED') return;
  /* simulated customs check — occasionally a small variance is sanctioned instead of the full claim */
  const variance = Math.random() < 0.2 ? 0.97 : 1;
  c.sanctionedAmount = Math.round(c.amount * variance);
  c.status = 'SANCTIONED';
  c.sanctionedTs = Date.now();
  addDocument('Duty Drawback Sanction Order', c.filingId, `Duty Drawback Sanction Order — ${c.id}`);
  addNotification(`Duty Drawback claim ${c.id} sanctioned for ₹${c.sanctionedAmount.toLocaleString('en-IN')}.`, c.filingId);
  saveState();
  toast('Drawback claim sanctioned.', 'success');
  renderIncentivesCentre();
}
function disburseDrawbackClaim(claimId) {
  const c = STATE.drawbackClaims.find(x => x.id === claimId);
  if (!c || c.status !== 'SANCTIONED') return;
  c.status = 'DISBURSED';
  c.disbursedTs = Date.now();
  addDocument('Duty Drawback Disbursement Advice', c.filingId, `Duty Drawback Disbursement Advice — ${c.id}`);
  addNotification(`Duty Drawback ₹${c.sanctionedAmount.toLocaleString('en-IN')} disbursed to bank account for claim ${c.id}.`, c.filingId);
  saveState();
  toast('Drawback amount disbursed (simulated bank credit).', 'success');
  renderIncentivesCentre();
}

/* ---------------- RoDTEP ---------------- */
function computeRodtepAmount(filing) {
  const fx = fxToINR(filing.invoice.currency);
  let total = 0;
  (filing.items || []).forEach(it => {
    const rate = clampRate((HS_CODE_TABLE[it.hsCode] && HS_CODE_TABLE[it.hsCode].rodtepRate) || 0);
    const itemValueINR = Math.max(0, num(it.qty)) * Math.max(0, num(it.unitPrice)) * fx;
    total += itemValueINR * rate;
  });
  return safeAmount(total);
}
function rodtepScripFor(filingId) { return STATE.rodtepScrips.find(s => s.filingId === filingId); }
function generateRodtepScrip(filingId) {
  const filing = getFiling(filingId);
  if (!filing) return;
  if (rodtepScripFor(filingId)) { toast('A RoDTEP e-scrip has already been generated for this filing.', 'error'); return; }
  const amount = computeRodtepAmount(filing);
  if (amount <= 0) { toast('No RoDTEP rate applies to the items in this filing.', 'error'); return; }
  const scrip = { id: uniqueId('RODTEP', () => 'RODTEP-' + Math.floor(1000000 + Math.random() * 9000000)), filingId, ts: Date.now(), expiryDate: addDaysISO(Date.now(), 365), creditAmount: amount, utilizedAmount: 0, status: 'GENERATED' };
  STATE.rodtepScrips.unshift(scrip);
  addDocument('RoDTEP e-Scrip', filing.id, `RoDTEP e-Scrip — ${scrip.id}`);
  addNotification(`RoDTEP e-scrip ${scrip.id} generated for ${filing.id} — credit ₹${amount.toLocaleString('en-IN')} in the ICEGATE e-scrip ledger (simulated). Valid for 1 year from generation.`, filing.id);
  saveState();
  toast('RoDTEP e-scrip generated.', 'success');
  renderIncentivesCentre();
}
function rodtepScripExpired(s) { return new Date(s.expiryDate).getTime() < Date.now(); }
/* Section 20 realism: e-scrips are drawn down against multiple Bills of Entry over their
   validity window, not spent in one shot — support a partial-amount utilization like the real
   ICEGATE ledger, while still guaranteeing the balance can never go negative or over-utilize
   an expired scrip. */
function utilizeRodtepScrip(scripId, amount) {
  const s = STATE.rodtepScrips.find(x => x.id === scripId);
  if (!s) return;
  if (rodtepScripExpired(s) && s.status !== 'FULLY UTILIZED') { toast('This e-scrip expired on ' + s.expiryDate + ' and can no longer be utilized.', 'error'); s.status = 'EXPIRED'; saveState(); renderIncentivesCentre(); return; }
  const available = s.creditAmount - s.utilizedAmount;
  if (available <= 0) { toast('This e-scrip has already been fully utilized.', 'error'); return; }
  const amt = amount === undefined || amount === null || amount === '' ? available : Math.round(num(amount));
  if (!(amt > 0)) { toast('Enter a valid amount to utilize.', 'error'); return; }
  if (amt > available) { toast(`Only ₹${available.toLocaleString('en-IN')} is available on this e-scrip.`, 'error'); return; }
  s.utilizedAmount += amt;
  if (s.utilizedAmount >= s.creditAmount) s.status = 'FULLY UTILIZED';
  addNotification(`₹${amt.toLocaleString('en-IN')} utilized from RoDTEP e-scrip ${s.id} against import duty (simulated). Balance: ₹${(s.creditAmount - s.utilizedAmount).toLocaleString('en-IN')}.`, s.filingId);
  saveState();
  toast('e-Scrip utilized against an import Bill of Entry.', 'success');
  renderIncentivesCentre();
}

/* ---------------- LICENSE / EXPORT OBLIGATION REDEMPTION ---------------- */
function eoFulfilledValue(lic) { return Math.max(0, lic.exportObligationValue - lic.balance); }
function eoProgressPct(lic) { return Math.min(100, Math.round(100 * eoFulfilledValue(lic) / lic.exportObligationValue)); }
function applyForEODC(licenseNo) {
  const lic = getLicense(licenseNo);
  if (!lic) return;
  if (lic.balance > 0) { toast(`Export Obligation not yet fully met — ₹${lic.balance.toLocaleString('en-IN')} remaining.`, 'error'); return; }
  if (lic.redeemed) { toast('This license has already been redeemed.', 'error'); return; }
  lic.redeemed = true;
  lic.redeemedTs = Date.now();
  addDocument('Export Obligation Discharge Certificate (EODC)', lic.linkedFilingIds[lic.linkedFilingIds.length - 1] || null, `EODC — ${lic.licenseNo}`);
  addNotification(`Export Obligation Discharge Certificate issued for license ${lic.licenseNo} — full EO of ₹${lic.exportObligationValue.toLocaleString('en-IN')} fulfilled.`, null);
  saveState();
  toast('EODC issued — license redeemed.', 'success');
  renderIncentivesCentre();
}

/* ---------------- BANK REALISATION CERTIFICATE (BRC) ---------------- */
function brcFor(filingId) { return STATE.brcRecords.find(b => b.filingId === filingId); }
function ensureBRCRecord(filing) {
  let b = brcFor(filing.id);
  if (!b) {
    b = { id: newId('BRC'), filingId: filing.id, status: 'PENDING_REALIZATION', fircNo: null, realizedValue: null, realizedCurrency: filing.invoice.currency, realizedDate: null, dueDate: addDaysISO(filing.updatedAt, 270) };
    STATE.brcRecords.unshift(b);
    saveState();
  }
  return b;
}
/* Section 20 realism: a BRC that has passed its FEMA realisation window and is still not
   realized is a genuine compliance event (XOS — Export Outstanding Statement risk), distinct
   from one that's simply still within its normal window. Surface that difference to the student
   instead of showing every unrealized BRC the same way. */
function brcEffectiveStatus(b) {
  if (b.status === 'REALIZED') return 'REALIZED';
  return (new Date(b.dueDate).getTime() < Date.now()) ? 'OVERDUE' : 'PENDING_REALIZATION';
}
function addDaysISO(ts, days) { const d = new Date(ts + days * 86400000); return d.toISOString().slice(0, 10); }
function uploadBRC(filingId) {
  const filing = getFiling(filingId);
  if (!filing) return;
  const b = ensureBRCRecord(filing);
  if (b.status === 'REALIZED') { toast('BRC already realized for this filing.', 'error'); return; }
  const variance = 0.97 + Math.random() * 0.05; /* small realistic FX/collection variance */
  b.realizedValue = Math.round(num(filing.invoice.invoiceValue) * variance);
  b.fircNo = uniqueId('FIRC', () => 'FIRC-' + Math.floor(100000000 + Math.random() * 900000000));
  b.realizedDate = Date.now();
  b.status = 'REALIZED';
  addDocument('Bank Realisation Certificate (BRC)', filing.id, `Bank Realisation Certificate — ${b.id}`);
  addNotification(`Export proceeds realized for ${filing.id}: ${filing.invoice.currency} ${b.realizedValue.toLocaleString('en-IN')} (FIRC ${b.fircNo}).`, filing.id);
  saveState();
  toast('Bank Realisation Certificate uploaded — proceeds marked realized.', 'success');
  renderIncentivesCentre();
  if (typeof DotBridge !== 'undefined') {
    const wasBridged = DotBridge.markCompleted('brc', filing.id, 'bank-realization-certificate');
    if (wasBridged && typeof showBridgeReturnPrompt === 'function') {
      showBridgeReturnPrompt(b.id, 'Bank Realisation Certificate (BRC)');
    }
  }
}

/* ---------------- SCREEN: EXPORT INCENTIVES & REALISATION CENTRE ---------------- */
var INCENTIVE_TAB = 'drawback';
function renderIncentivesCentre() {
  const host = $('#screen-incentives');
  if (!host) return;
  const filings = eligibleIncentiveFilings();
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Export Benefits</div><h1>Export Incentives &amp; Realisation Centre</h1></div></div>
  <p class="hint">Training reference only — Duty Drawback AIR rates, RoDTEP rates, and Export Obligation figures are illustrative. Always verify current schedules against official CBIC/DGFT notifications.</p>
  <div class="filter-tabs" style="margin-bottom:14px">
    <button class="${INCENTIVE_TAB === 'drawback' ? 'on' : ''}" onclick="switchIncentiveTab('drawback')">Duty Drawback</button>
    <button class="${INCENTIVE_TAB === 'rodtep' ? 'on' : ''}" onclick="switchIncentiveTab('rodtep')">RoDTEP</button>
    <button class="${INCENTIVE_TAB === 'license' ? 'on' : ''}" onclick="switchIncentiveTab('license')">Licenses &amp; Export Obligation</button>
    <button class="${INCENTIVE_TAB === 'brc' ? 'on' : ''}" onclick="switchIncentiveTab('brc')">Bank Realisation (BRC)</button>
  </div>
  <div id="incentivePane"></div>`;
  renderIncentivePane(filings);
}
function switchIncentiveTab(t) { INCENTIVE_TAB = t; renderIncentivesCentre(); }
function renderIncentivePane(filings) {
  const pane = $('#incentivePane');
  if (INCENTIVE_TAB === 'drawback') {
    pane.innerHTML = `
    <h3>File a New Claim</h3>
    ${filings.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Filing</th><th>FOB Value</th><th>Estimated Drawback</th><th></th></tr></thead><tbody>
      ${filings.map(f => `<tr><td>${esc(f.id)}</td><td>${fmtMoney(f.invoice.fobValue, f.invoice.currency)}</td><td>₹${computeDrawbackAmount(f).toLocaleString('en-IN')}</td>
      <td>${drawbackClaimFor(f.id) ? '<span class="badge badge-grey">Already Claimed</span>' : `<button class="btn-ghost sm" onclick="fileDrawbackClaim('${f.id}')">File Claim</button>`}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="hint">No completed export filings eligible yet — complete an export filing through LEO first.</p>'}
    <h3 style="margin-top:20px">Claims</h3>
    ${STATE.drawbackClaims.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Claim ID</th><th>Filing</th><th>Claimed Amount</th><th>Sanctioned Amount</th><th>Status</th><th></th></tr></thead><tbody>
      ${STATE.drawbackClaims.map(c => `<tr><td>${esc(c.id)}</td><td>${esc(c.filingId)}</td><td>₹${c.amount.toLocaleString('en-IN')}</td><td>${c.sanctionedAmount !== null ? '₹' + c.sanctionedAmount.toLocaleString('en-IN') : '—'}</td>
      <td><span class="badge ${c.status === 'DISBURSED' ? 'badge-green' : (c.status === 'SANCTIONED' ? 'badge-blue' : 'badge-amber')}">${esc(c.status)}</span></td>
      <td>${c.status === 'FILED' ? `<button class="btn-ghost sm" onclick="sanctionDrawbackClaim('${c.id}')">Sanction</button>` : ''}${c.status === 'SANCTIONED' ? `<button class="btn-ghost sm" onclick="disburseDrawbackClaim('${c.id}')">Disburse</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="hint">No claims filed yet.</p>'}`;
  } else if (INCENTIVE_TAB === 'rodtep') {
    pane.innerHTML = `
    <h3>Generate e-Scrip</h3>
    ${filings.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Filing</th><th>FOB Value</th><th>Estimated RoDTEP Credit</th><th></th></tr></thead><tbody>
      ${filings.map(f => `<tr><td>${esc(f.id)}</td><td>${fmtMoney(f.invoice.fobValue, f.invoice.currency)}</td><td>₹${computeRodtepAmount(f).toLocaleString('en-IN')}</td>
      <td>${rodtepScripFor(f.id) ? '<span class="badge badge-grey">Already Generated</span>' : `<button class="btn-ghost sm" onclick="generateRodtepScrip('${f.id}')">Generate e-Scrip</button>`}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="hint">No completed export filings eligible yet.</p>'}
    <h3 style="margin-top:20px">e-Scrip Ledger</h3>
    ${STATE.rodtepScrips.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Scrip No.</th><th>Filing</th><th>Credit</th><th>Utilized</th><th>Available</th><th>Expiry</th><th>Status</th><th></th></tr></thead><tbody>
      ${STATE.rodtepScrips.map(s => { const expired = rodtepScripExpired(s) && s.status !== 'FULLY UTILIZED'; const eff = expired ? 'EXPIRED' : s.status; const badgeClass = eff === 'FULLY UTILIZED' ? 'badge-grey' : (eff === 'EXPIRED' ? 'badge-red' : 'badge-green'); return `<tr><td>${esc(s.id)}</td><td>${esc(s.filingId)}</td><td>₹${s.creditAmount.toLocaleString('en-IN')}</td><td>₹${s.utilizedAmount.toLocaleString('en-IN')}</td><td>₹${(s.creditAmount - s.utilizedAmount).toLocaleString('en-IN')}</td><td>${esc(s.expiryDate)}</td>
      <td><span class="badge ${badgeClass}">${esc(eff)}</span></td>
      <td>${(!expired && s.status === 'GENERATED') ? `<input type="number" id="rodtepAmt-${s.id}" placeholder="Amount (blank = full)" style="width:150px;margin-right:6px"><button class="btn-ghost sm" onclick="utilizeRodtepScrip('${s.id}', document.getElementById('rodtepAmt-${s.id}').value)">Utilize</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="hint">No e-scrips generated yet.</p>'}`;
  } else if (INCENTIVE_TAB === 'license') {
    pane.innerHTML = `
    <p class="hint">Advance Authorization / EPCG licenses let you import inputs or capital goods duty-free against a committed Export Obligation (EO). Exporting against the license (selected during Shipping Bill filing under "Export Scheme") reduces the remaining EO. Once fully met, apply for the Export Obligation Discharge Certificate (EODC) below.</p>
    ${STATE.licenses.map(l => `
    <div class="wz-card">
      <h3>${esc(l.licenseNo)} — ${esc(l.type)} ${l.redeemed ? '<span class="badge badge-green">Redeemed</span>' : ''}</h3>
      <table class="kv-table">
        <tr><td>IEC</td><td>${esc(l.iec)}</td></tr>
        <tr><td>CIF Value of Duty-Free Import</td><td>₹${l.cifValue.toLocaleString('en-IN')}</td></tr>
        <tr><td>Duty Saved</td><td>₹${l.dutySavedAmount.toLocaleString('en-IN')}</td></tr>
        <tr><td>Export Obligation (EO) Target</td><td>₹${l.exportObligationValue.toLocaleString('en-IN')}</td></tr>
        <tr><td>EO Fulfilled So Far</td><td>₹${eoFulfilledValue(l).toLocaleString('en-IN')} (${eoProgressPct(l)}%)</td></tr>
        <tr><td>EO Remaining</td><td>₹${l.balance.toLocaleString('en-IN')}</td></tr>
        <tr><td>Validity</td><td>${esc(l.validityDate)}</td></tr>
        <tr><td>Linked Export Filings</td><td>${l.linkedFilingIds.length ? l.linkedFilingIds.map(id => `<a href="#" onclick="navToFiling('${id}');return false;">${esc(id)}</a>`).join(', ') : '—'}</td></tr>
      </table>
      <div class="progress-bar"><div class="progress-fill" style="width:${eoProgressPct(l)}%"></div></div>
      ${!l.redeemed ? (l.balance <= 0 ? `<button class="btn-ghost" onclick="applyForEODC('${l.licenseNo}')">Apply for EODC (Redemption)</button>` : `<p class="hint">Export Obligation not yet fully met.</p>`) : '<p class="hint">This license has been fully redeemed with an EODC on file.</p>'}
    </div>`).join('')}`;
  } else if (INCENTIVE_TAB === 'brc') {
    filings.forEach(ensureBRCRecord);
    pane.innerHTML = `
    <p class="hint">Under FEMA, export proceeds must normally be realized within 9 months (270 days) of shipment (RBI has periodically extended this window for specific categories — always check the current circular). A BRC still pending past its due date becomes an FEMA compliance exposure (tracked via the RBI's Export Outstanding Statement / XOS) until realized. Upload the (simulated) bank confirmation below once payment is received.</p>
    ${STATE.brcRecords.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>BRC ID</th><th>Filing</th><th>Realization Due</th><th>FIRC No.</th><th>Realized Value</th><th>Status</th><th></th></tr></thead><tbody>
      ${STATE.brcRecords.map(b => { const eff = brcEffectiveStatus(b); const badgeClass = eff === 'REALIZED' ? 'badge-green' : (eff === 'OVERDUE' ? 'badge-red' : 'badge-amber'); const label = eff === 'REALIZED' ? 'Realized' : (eff === 'OVERDUE' ? 'Overdue — FEMA Risk' : 'Pending Realization'); return `<tr><td>${esc(b.id)}</td><td>${esc(b.filingId)}</td><td>${esc(b.dueDate)}</td><td>${esc(b.fircNo || '—')}</td><td>${b.realizedValue !== null ? esc(b.realizedCurrency) + ' ' + b.realizedValue.toLocaleString('en-IN') : '—'}</td>
      <td><span class="badge ${badgeClass}">${label}</span></td>
      <td>${b.status !== 'REALIZED' ? `<button class="btn-ghost sm" onclick="uploadBRC('${b.filingId}')">Upload BRC</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div>` : '<p class="hint">No export filings eligible for realization tracking yet.</p>'}`;
  }
}
