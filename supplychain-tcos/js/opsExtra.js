/* ============================================================
   TCOS TRAINING SIMULATOR — CUSTOMS OPS EXTRAS & FREIGHT COMMERCIAL
   Bond / Bank Guarantee Register · Container Track & Trace ·
   Freight Job Costing · Customer Invoice · Carrier Rate Comparison
   ============================================================ */

/* ---------------- BOND / BANK GUARANTEE REGISTER ---------------- */
const BOND_TYPES = ['Provisional Duty (PD) Bond', 'Continuity (General) Bond', 'Bank Guarantee', 'Warehousing Bond'];
function createBond(type, value, bankName, filingId) {
  const bond = { id: newId('BOND'), type, value: num(value), bankName: bankName || '', ts: Date.now(), utilized: 0, status: 'ACTIVE', linkedFilingIds: filingId ? [filingId] : [] };
  STATE.bonds.unshift(bond);
  addDocument(type, filingId, `${type} — ${bond.id}`);
  addNotification(`${type} of ₹${bond.value.toLocaleString('en-IN')} registered (${bond.id}).`, filingId || null);
  saveState();
  return bond;
}
function utilizeBond(bondId, amount, filingId) {
  const b = STATE.bonds.find(x => x.id === bondId);
  if (!b) return;
  const avail = b.value - b.utilized;
  amount = num(amount);
  if (amount <= 0 || amount > avail) { toast(`Enter an amount up to the available bond balance (₹${avail.toLocaleString('en-IN')}).`, 'error'); return; }
  b.utilized += amount;
  if (filingId && !b.linkedFilingIds.includes(filingId)) b.linkedFilingIds.push(filingId);
  if (b.utilized >= b.value) b.status = 'FULLY UTILIZED';
  addNotification(`₹${amount.toLocaleString('en-IN')} debited against bond ${b.id}${filingId ? ' for ' + filingId : ''}.`, filingId || null);
  saveState();
  toast('Bond debited.', 'success');
  renderBondRegister();
}
function releaseBond(bondId) {
  const b = STATE.bonds.find(x => x.id === bondId);
  if (!b) return;
  confirmDialog(`Release/cancel bond ${b.id}? This simulates the bond being returned once all linked obligations are cleared.`, () => {
    b.status = 'RELEASED';
    addNotification(`Bond ${b.id} released/cancelled.`, null);
    saveState();
    renderBondRegister();
  });
}
function renderBondRegister() {
  const host = $('#screen-bonds');
  if (!host) return;
  const importFilings = STATE.filings.filter(f => f.type === 'import' && !['DRAFT'].includes(f.status));
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Customs Operations</div><h1>Bond &amp; Bank Guarantee Register</h1></div></div>
  <p class="hint">Bonds/BGs are executed to cover duty on provisional assessments, warehoused goods, or EPCG/Advance Authorization commitments before a final/EODC clearance. Training reference only.</p>
  <div class="wz-card">
    <h3>Register a New Bond / Bank Guarantee</h3>
    <div class="grid">
      <div class="field"><label>Type</label><select id="bondType">${BOND_TYPES.map(t => `<option>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Value (₹)</label><input id="bondValue" type="number" placeholder="e.g. 500000"></div>
      <div class="field"><label>Bank</label><input id="bondBank" placeholder="e.g. HDFC Bank, Nhava Sheva Branch"></div>
      <div class="field"><label>Link to Import Filing (optional)</label><select id="bondFiling"><option value="">None</option>${importFilings.map(f => `<option value="${esc(f.id)}">${esc(f.id)}</option>`).join('')}</select></div>
    </div>
    <button class="btn-ghost" onclick="submitNewBond()">Register Bond</button>
  </div>
  <h3 style="margin-top:20px">Bond Register</h3>
  ${STATE.bonds.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Bond ID</th><th>Type</th><th>Bank</th><th>Value</th><th>Utilized</th><th>Available</th><th>Linked Filings</th><th>Status</th><th></th></tr></thead><tbody>
  ${STATE.bonds.map(b => `<tr><td>${esc(b.id)}</td><td>${esc(b.type)}</td><td>${esc(b.bankName || '—')}</td><td>₹${b.value.toLocaleString('en-IN')}</td><td>₹${b.utilized.toLocaleString('en-IN')}</td><td>₹${(b.value - b.utilized).toLocaleString('en-IN')}</td>
  <td>${b.linkedFilingIds.map(id => `<a href="#" onclick="navToFiling('${id}');return false;">${esc(id)}</a>`).join(', ') || '—'}</td>
  <td><span class="badge ${b.status === 'ACTIVE' ? 'badge-green' : (b.status === 'RELEASED' ? 'badge-grey' : 'badge-amber')}">${esc(b.status)}</span></td>
  <td>${b.status === 'ACTIVE' ? `<button class="btn-ghost sm" onclick="promptUtilizeBond('${b.id}')">Debit</button> <button class="btn-ghost sm" onclick="releaseBond('${b.id}')">Release</button>` : ''}</td></tr>`).join('')}
  </tbody></table></div>` : '<p class="hint">No bonds registered yet.</p>'}`;
}
function submitNewBond() {
  const type = $('#bondType').value;
  const value = $('#bondValue').value;
  const bank = $('#bondBank').value;
  const filingId = $('#bondFiling').value || null;
  if (!value || num(value) <= 0) { toast('Enter a valid bond value.', 'error'); return; }
  createBond(type, value, bank, filingId);
  toast('Bond registered.', 'success');
  renderBondRegister();
}
function promptUtilizeBond(bondId) {
  const b = STATE.bonds.find(x => x.id === bondId);
  if (!b) return;
  const avail = b.value - b.utilized;
  const amt = window.prompt(`Debit amount against ${b.id} (available ₹${avail.toLocaleString('en-IN')}):`, '');
  if (amt === null) return;
  utilizeBond(bondId, amt, b.linkedFilingIds[0] || null);
}

/* ---------------- CONTAINER TRACK & TRACE ---------------- */
const CONTAINER_MILESTONES = ['Empty Picked Up', 'Gate In (Origin)', 'Loaded on Vessel', 'Vessel Sailed', 'Arrived at Destination Port', 'Discharged', 'Gate Out', 'Empty Returned'];
function hashSeed(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; } return h; }
function findContainerAcrossFilings(containerNo) {
  const q = containerNo.trim().toUpperCase();
  for (const f of STATE.filings) {
    const c = (f.containers || []).find(c => (c.containerNo || '').toUpperCase() === q);
    if (c) return { filing: f, container: c };
  }
  return null;
}
function renderContainerTracker(prefillNo) {
  const host = $('#screen-containertrack');
  if (!host) return;
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Freight Forwarding</div><h1>Container Track &amp; Trace</h1></div></div>
  <p class="hint">Simulated milestone tracking based on containers declared on your filings — not a live carrier feed.</p>
  <div class="search-row" style="margin-bottom:14px">
    <input id="containerTrackInput" placeholder="Enter container number, e.g. MSCU1234567" value="${esc(prefillNo || '')}">
    <button class="btn-ghost" onclick="runContainerTrack()">Track</button>
  </div>
  <div id="containerTrackResult"></div>`;
  if (prefillNo) runContainerTrack();
}
function runContainerTrack() {
  const no = $('#containerTrackInput').value.trim();
  const result = $('#containerTrackResult');
  if (!no) { result.innerHTML = '<p class="hint">Enter a container number to track.</p>'; return; }
  const found = findContainerAcrossFilings(no);
  if (!found) { result.innerHTML = `<div class="alert alert-amber">No filing in your training records declares container ${esc(no.toUpperCase())}. Check the number or file a Shipping Bill/Bill of Entry with this container first.</div>`; return; }
  const { filing, container } = found;
  const seed = hashSeed(no.toUpperCase() + filing.id);
  const totalMs = filing.status === 'COMPLETED' ? CONTAINER_MILESTONES.length : Math.max(2, (seed % CONTAINER_MILESTONES.length) + 1);
  const baseTs = filing.createdAt || filing.updatedAt || Date.now();
  result.innerHTML = `
  <div class="wz-card">
    <h3>Container ${esc(container.containerNo)} — ${esc(container.containerType || '')} ${container.sealNo ? '(Seal ' + esc(container.sealNo) + ')' : ''}</h3>
    <table class="kv-table">
      <tr><td>Linked Filing</td><td><a href="#" onclick="navToFiling('${filing.id}');return false;">${esc(filing.id)}</a> (${filing.type === 'export' ? 'Export' : 'Import'})</td></tr>
      <tr><td>Port of Loading</td><td>${esc(filing.shipment.portOfLoading || '—')}</td></tr>
      <tr><td>Port of Discharge</td><td>${esc(filing.shipment.portOfDischarge || '—')}</td></tr>
      <tr><td>Vessel / Voyage</td><td>${esc(filing.shipment.vesselFlight || '—')} / ${esc(filing.shipment.voyageFlight || '—')}</td></tr>
    </table>
    <div class="milestone-track">
      ${CONTAINER_MILESTONES.map((m, i) => {
        const done = i < totalMs;
        const current = i === totalMs - 1 && filing.status !== 'COMPLETED';
        const dateStr = done ? new Date(baseTs + i * 36 * 3600 * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';
        return `<div class="milestone ${done ? 'done' : ''}"><div class="dot ${current ? 'current' : ''}"></div>${esc(m)}${dateStr ? '<br>' + dateStr : ''}</div>`;
      }).join('')}
    </div>
  </div>`;
}

/* ---------------- FREIGHT COMMERCIAL OPS: JOB COSTING ---------------- */
const DEFAULT_COST_HEADS = ['Ocean/Air Freight', 'Origin THC', 'Destination THC', 'Documentation Fee', 'Customs Clearance Fee', 'Inland Haulage'];
function jobCostingFor(bookingId) {
  if (!STATE.jobCostings[bookingId]) {
    STATE.jobCostings[bookingId] = { heads: DEFAULT_COST_HEADS.map(h => ({ head: h, buy: 0, sell: 0 })), invoiced: false };
  }
  return STATE.jobCostings[bookingId];
}
function renderJobCosting(bookingId) {
  const host = $('#screen-jobcosting');
  if (!host) return;
  const b = getBooking(bookingId);
  if (!b) { host.innerHTML = '<p class="hint">Booking not found.</p>'; return; }
  const jc = jobCostingFor(bookingId);
  const totalBuy = jc.heads.reduce((s, h) => s + num(h.buy), 0);
  const totalSell = jc.heads.reduce((s, h) => s + num(h.sell), 0);
  const margin = totalSell - totalBuy;
  const marginPct = totalSell ? Math.round(1000 * margin / totalSell) / 10 : 0;
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Freight Forwarding</div><h1>Job Costing — ${esc(b.id)}</h1></div></div>
  <p class="hint">Buy rate = what you pay the carrier/vendor. Sell rate = what you quote the customer. This is standard freight-forwarder commercial practice, separate from the ICEGATE customs process.</p>
  <div class="table-wrap"><table class="data-table cost-table"><thead><tr><th>Cost Head</th><th>Buy Rate (₹)</th><th>Sell Rate (₹)</th><th>Margin (₹)</th></tr></thead><tbody>
  ${jc.heads.map((h, i) => `<tr><td>${esc(h.head)}</td>
    <td><input type="number" value="${h.buy}" onchange="updateCostHead('${bookingId}',${i},'buy',this.value)"></td>
    <td><input type="number" value="${h.sell}" onchange="updateCostHead('${bookingId}',${i},'sell',this.value)"></td>
    <td>₹${(num(h.sell) - num(h.buy)).toLocaleString('en-IN')}</td></tr>`).join('')}
  </tbody><tfoot><tr><td><b>Total</b></td><td><b>₹${totalBuy.toLocaleString('en-IN')}</b></td><td><b>₹${totalSell.toLocaleString('en-IN')}</b></td><td><b>₹${margin.toLocaleString('en-IN')} (${marginPct}%)</b></td></tr></tfoot></table></div>
  <button class="btn-ghost" onclick="generateCustomerInvoice('${bookingId}')">Generate Customer Invoice (Sell Side)</button>
  <div id="jcInvoiceNote"></div>`;
}
function updateCostHead(bookingId, idx, kind, val) {
  const jc = jobCostingFor(bookingId);
  jc.heads[idx][kind] = num(val);
  saveState();
  renderJobCosting(bookingId);
}
function generateCustomerInvoice(bookingId) {
  const b = getBooking(bookingId);
  const jc = jobCostingFor(bookingId);
  const totalSell = jc.heads.reduce((s, h) => s + num(h.sell), 0);
  if (totalSell <= 0) { toast('Enter sell rates before generating the customer invoice.', 'error'); return; }
  const doc = addDocument('Customer Invoice', null, `Customer Invoice — ${b.id}`, bookingId);
  jc.invoiced = true;
  jc.lastInvoiceId = doc.id;
  jc.lastInvoiceTotal = totalSell;
  addNotification(`Customer invoice generated for booking ${b.id} — total ₹${totalSell.toLocaleString('en-IN')} (buy-side rates not shown to customer).`, null);
  saveState();
  toast('Customer invoice generated — buy-side costs are never shown to the customer, only the sell total.', 'success');
  renderJobCosting(bookingId);
}

/* ---------------- CARRIER RATE COMPARISON ---------------- */
const CARRIER_RATE_SHEET = [
  { lane: 'Nhava Sheva (INNSA1) → Jebel Ali (AEJEA)', mode: 'Sea (FCL 20\')', rates: [{ carrier: 'Maersk', rate: 32000 }, { carrier: 'MSC', rate: 29500 }, { carrier: 'CMA CGM', rate: 31000 }] },
  { lane: 'Nhava Sheva (INNSA1) → Rotterdam (NLRTM)', mode: 'Sea (FCL 40\')', rates: [{ carrier: 'Maersk', rate: 118000 }, { carrier: 'Hapag-Lloyd', rate: 121500 }, { carrier: 'MSC', rate: 114000 }] },
  { lane: 'Mundra (INMUN1) → Hamburg (DEHAM)', mode: 'Sea (FCL 40\')', rates: [{ carrier: 'CMA CGM', rate: 124000 }, { carrier: 'Hapag-Lloyd', rate: 119500 }, { carrier: 'ONE', rate: 122000 }] },
  { lane: 'Chennai (INMAA1) → Singapore (SGSIN)', mode: 'Sea (FCL 20\')', rates: [{ carrier: 'ONE', rate: 21000 }, { carrier: 'Evergreen', rate: 19800 }, { carrier: 'MSC', rate: 20500 }] },
  { lane: 'Mumbai Air Cargo (INBOM4) → Dubai (AEDXB)', mode: 'Air (per kg)', rates: [{ carrier: 'Emirates SkyCargo', rate: 145 }, { carrier: 'Air India', rate: 132 }, { carrier: 'IndiGo CarGo', rate: 128 }] },
  { lane: 'Delhi Air Cargo (INDEL4) → Shanghai (CNSHA)', mode: 'Air (per kg)', rates: [{ carrier: 'Air India', rate: 165 }, { carrier: 'China Eastern', rate: 158 }, { carrier: 'IndiGo CarGo', rate: 172 }] }
];
function renderRateComparison() {
  const host = $('#screen-ratecompare');
  if (!host) return;
  host.innerHTML = `
  <div class="page-head"><div><div class="crumb">Freight Forwarding</div><h1>Carrier Rate Comparison</h1></div></div>
  <p class="hint">Illustrative reference spot rates for common trade lanes, for quoting practice — not live market rates.</p>
  ${CARRIER_RATE_SHEET.map(l => `
  <div class="wz-card">
    <h3>${esc(l.lane)} <span class="badge badge-blue">${esc(l.mode)}</span></h3>
    <table class="kv-table">
    ${l.rates.slice().sort((a, b) => a.rate - b.rate).map((r, i) => `<tr><td>${esc(r.carrier)} ${i === 0 ? '<span class="badge badge-green">Lowest</span>' : ''}</td><td>₹${r.rate.toLocaleString('en-IN')}</td></tr>`).join('')}
    </table>
  </div>`).join('')}`;
}
