/* ============================================================
   ICEGATE e-PAYMENT (Bill of Entry duty) - v52
   - Duty is worked out AUTOMATICALLY from what the student typed in the Bill of Entry (invoice value, currency,
     Incoterm, freight, insurance, exchange rate, HS codes, FTA claim). The student fills NOTHING extra here.
   - One click opens a government-style payment gateway animation (validate -> gateway -> bank -> debit -> CIN / e-Receipt).
   - On success: Payment Receipt + Bill of Entry PDF can be downloaded, and a bridged student is sent back to the
     Logistics Simulator automatically (see showBridgeReturnPrompt in app.js).
   Training simulation only - no real payment is made.
   ============================================================ */

function tcosEpIsBridgedImport(filing) {
  try {
    if (typeof DotBridge === 'undefined') return false;
    const b = DotBridge.getBridge();
    return !!(b && b.active && !b.completed && b.filingType === 'import' && b.returnSlug === 'bill-of-entry' && (!b.filingId || b.filingId === filing.id));
  } catch (e) { return false; }
}

/* How the duty was worked out, using the student's own Bill of Entry figures */
function tcosEpWorkingHTML(filing) {
  const inv = filing.invoice || {};
  const c = tcosComputeDuty(filing);
  const d = filing.duty || c;
  const term = String(inv.incoterm || '').toUpperCase();
  const cur = inv.currency || 'INR';
  const fx = (typeof FX_TO_INR !== 'undefined' && FX_TO_INR[cur]) || 1;
  const n = v => Number(v) || 0;
  let basis;
  if (term === 'CIF' || term === 'CIP') basis = 'Incoterm ' + term + ' already includes freight and insurance';
  else if (term === 'CFR' || term === 'CNF' || term === 'CPT') basis = 'Incoterm ' + term + ' + insurance';
  else basis = 'Incoterm ' + (term || '-') + ' + freight + insurance';
  const lines = (d.lines && d.lines.length) ? d.lines : c.lines;
  const pct = r => (Number(r) * 100).toFixed(r * 100 % 1 ? 1 : 0) + '%';
  return `<div class="ep-work">
    <h4>How your duty was calculated <span class="hint-inline">(from the details you entered in this Bill of Entry)</span></h4>
    <table class="kv-table">
      <tr><td>Invoice value</td><td>${esc(cur)} ${n(inv.invoiceValue).toLocaleString('en-IN')}</td></tr>
      <tr><td>Freight / Insurance</td><td>${esc(cur)} ${n(inv.freight).toLocaleString('en-IN')} / ${esc(cur)} ${n(inv.insurance).toLocaleString('en-IN')} <span class="hint-inline">(${esc(basis)})</span></td></tr>
      <tr><td>CIF value (${esc(cur)})</td><td>${esc(cur)} ${(c.cif || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>
      <tr><td>Exchange rate</td><td>1 ${esc(cur)} = ₹${fx}</td></tr>
      <tr><td>Landing charges</td><td>Not added (the notional 1% was removed from 26 Sep 2017 - Notification 91/2017-Customs (N.T.))</td></tr>
      <tr><td><b>Assessable Value</b></td><td><b>${fmtINR(d.assessableValue)}</b></td></tr>
    </table>
    ${lines && lines.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>HSN</th><th>Goods</th><th>Assessable value</th><th>BCD</th><th>SWS</th><th>Cess</th><th>ADD</th><th>IGST</th><th>Duty</th></tr></thead><tbody>
      ${lines.map(l => `<tr><td><b>${esc(l.hsCode)}</b></td><td>${esc(l.desc)}</td><td>${fmtINR(l.av)}</td><td>${fmtINR(l.bcd)}<div class="hint" style="margin:0">${pct(l.bcdRate)}</div></td><td>${fmtINR(l.sws)}</td><td>${fmtINR(l.cess)}</td><td>${fmtINR(l.add)}</td><td>${fmtINR(l.igst)}</td><td><b>${fmtINR(l.total)}</b></td></tr>`).join('')}
    </tbody></table></div>` : ''}
    <p class="hint">BCD = assessable value × HS-code rate. SWS = 10% of BCD. IGST = 18% × (assessable value + BCD + SWS + Cess + ADD). Change an invoice value, freight, Incoterm or HS code in the filing and this recalculates.</p>
  </div>`;
}

function tcosEpPanelHTML(filing) {
  const d = filing.duty;
  const p = filing.payment;
  if (p && p.status === 'SUCCESS') {
    const rc = (STATE.documentsGenerated || []).find(x => x.filingId === filing.id && x.type === 'Payment Receipt');
    return `<div class="alert alert-success">Payment successful. Challan / CIN: <b>${esc(p.challanNo)}</b>${p.bankRef ? ` &middot; Bank ref: ${esc(p.bankRef)}` : ''}.</div>
      ${rc ? `<button class="btn-ghost sm" onclick="downloadDocumentPDF('${rc.id}')">⬇ Payment Receipt PDF</button>` : ''}`;
  }
  const resume = p && p.status === 'INITIATED';
  return `${tcosEpWorkingHTML(filing)}
    <div class="ep-cta">
      <div><div class="ep-cta-l">Total duty payable (auto-calculated)</div><div class="ep-cta-n">${fmtINR(d.total)}</div></div>
      <button class="next" onclick="tcosStartEPayment('${filing.id}')">💳 ${resume ? 'Resume' : 'Pay Duty'} — ICEGATE e-Payment</button>
    </div>
    <p class="hint">Nothing more to fill in: the challan number you entered in the Bill of Entry is used for this payment.</p>`;
}

function tcosEpInjectCss() {
  if (document.getElementById('epCss')) return;
  const st = document.createElement('style');
  st.id = 'epCss';
  st.textContent = `
.ep-work{margin:6px 0 14px}.ep-work h4{margin:10px 0 6px}
.ep-cta{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:14px 0 6px;padding:14px 16px;background:#f3f7fd;border:1px solid #cfdcf0;border-radius:6px}
.ep-cta-l{font-size:12.5px;color:#5b6a80}.ep-cta-n{font-size:24px;font-weight:700;color:#12365f}
.ep-ov{position:fixed;inset:0;z-index:9999;background:rgba(10,24,48,.72);display:flex;align-items:center;justify-content:center;padding:14px}
.ep-card{background:#fff;width:min(560px,96vw);max-height:94vh;overflow:auto;border-radius:6px;box-shadow:0 18px 60px rgba(0,0,0,.45);font-family:inherit}
.ep-flag{height:6px;background:linear-gradient(90deg,#ff9933 0 33.3%,#fff 33.3% 66.6%,#138808 66.6% 100%);border-bottom:1px solid #e3e8ef}
.ep-head{display:flex;align-items:center;gap:12px;padding:12px 18px;background:#12365f;color:#fff}
.ep-emb{width:38px;height:38px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:19px;flex:none}
.ep-head b{display:block;font-size:14px;letter-spacing:.2px}.ep-head span{font-size:11.5px;opacity:.85}
.ep-body{padding:18px 20px 20px}
.ep-amt{display:flex;justify-content:space-between;align-items:baseline;border:1px solid #d7dfeb;background:#f7f9fc;border-radius:4px;padding:10px 14px;margin-bottom:14px}
.ep-amt small{color:#5b6a80;font-size:12px}.ep-amt strong{font-size:22px;color:#12365f}
.ep-bar{height:8px;background:#e6ebf2;border-radius:6px;overflow:hidden;margin:2px 0 14px}
.ep-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ff9933,#138808);transition:width .9s ease}
.ep-steps{list-style:none;margin:0;padding:0}
.ep-steps li{display:flex;align-items:center;gap:10px;padding:7px 2px;font-size:13.5px;color:#9aa6b8;transition:color .3s}
.ep-steps li.on{color:#12365f;font-weight:600}.ep-steps li.done{color:#0b6b3a}
.ep-dot{width:20px;height:20px;border-radius:50%;border:2px solid #cdd6e3;flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff}
li.on .ep-dot{border-color:#12365f;border-top-color:transparent;animation:epSpin .8s linear infinite}
li.done .ep-dot{background:#0b6b3a;border-color:#0b6b3a;animation:none}
.ep-warn{margin-top:12px;padding:8px 12px;border-radius:4px;background:#fff7e6;border:1px solid #f1d9a6;color:#7a5200;font-size:12.5px}
.ep-ok{width:74px;height:74px;border-radius:50%;margin:2px auto 10px;background:#0b6b3a;display:flex;align-items:center;justify-content:center;animation:epPop .5s cubic-bezier(.2,1.4,.4,1)}
.ep-ok svg{width:40px;height:40px;stroke:#fff;stroke-width:5;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:60;stroke-dashoffset:60;animation:epTick .55s .25s ease forwards}
.ep-title{text-align:center;font-size:18px;font-weight:700;color:#0b6b3a;margin:0 0 2px}.ep-sub{text-align:center;color:#5b6a80;font-size:13px;margin:0 0 14px}
.ep-rcpt{width:100%;border-collapse:collapse;font-size:13.5px}.ep-rcpt td{padding:6px 8px;border-bottom:1px solid #edf0f5}.ep-rcpt td:first-child{color:#5b6a80;width:42%}
.ep-act{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:16px}
@keyframes epSpin{to{transform:rotate(360deg)}}@keyframes epPop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}@keyframes epTick{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.ep-ok,.ep-ok svg,li.on .ep-dot{animation:none}.ep-ok svg{stroke-dashoffset:0}.ep-bar i{transition:none}}`;
  document.head.appendChild(st);
}

function tcosEpHead() {
  return `<div class="ep-flag"></div><div class="ep-head"><div class="ep-emb">🏛️</div><div><b>भारत सरकार · Government of India</b><span>Central Board of Indirect Taxes &amp; Customs — ICEGATE e-Payment Gateway</span></div></div>`;
}

let TCOS_EP_BUSY = false;
function tcosStartEPayment(filingId) {
  const filing = getFiling(filingId);
  if (!filing || !filing.duty) return;
  if (filing.payment && filing.payment.status === 'SUCCESS') { toast('Payment has already been completed for this filing.', 'info'); return; }
  if (TCOS_EP_BUSY) return;
  TCOS_EP_BUSY = true;
  tcosEpInjectCss();
  if (!filing.payment) initiatePayment(filing.id, 'ICEGATE e-Payment');   // challan no. = the CIN typed in the filing
  const pay = filing.payment;
  const steps = [
    'Validating Bill of Entry and duty challan',
    'Connecting to ICEGATE e-Payment gateway (secure)',
    'Redirecting to the authorised bank',
    'Debiting the importer\'s account',
    'Bank confirmation received',
    'Generating CIN and e-Receipt'
  ];
  const bg = document.createElement('div');
  bg.className = 'ep-ov';
  bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', 'ICEGATE e-Payment');
  bg.innerHTML = `<div class="ep-card">${tcosEpHead()}<div class="ep-body">
    <div class="ep-amt"><div><small>Bill of Entry</small><div><b>${esc(filing.id)}</b></div></div><div style="text-align:right"><small>Duty payable</small><div><strong>${fmtINR(pay.amount)}</strong></div></div></div>
    <div class="ep-bar"><i id="epBar"></i></div>
    <ul class="ep-steps">${steps.map((t, i) => `<li data-s="${i}"><span class="ep-dot"></span>${esc(t)}</li>`).join('')}</ul>
    <div class="ep-warn">⚠ Please do not press Back or Refresh while the payment is being processed.</div>
  </div></div>`;
  document.body.appendChild(bg);
  const lis = Array.from(bg.querySelectorAll('li'));
  const bar = bg.querySelector('#epBar');
  let i = 0;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gap = reduce ? 250 : 1050;
  function tick() {
    if (i > 0) { lis[i - 1].classList.remove('on'); lis[i - 1].classList.add('done'); lis[i - 1].querySelector('.ep-dot').textContent = '✓'; }
    if (i >= steps.length) { bar.style.width = '100%'; setTimeout(finish, reduce ? 100 : 500); return; }
    lis[i].classList.add('on');
    bar.style.width = Math.round((i + 1) / steps.length * 92) + '%';
    i += 1;
    setTimeout(tick, gap);
  }
  setTimeout(tick, 350);

  function finish() {
    pay.bankRef = 'BNK' + Math.floor(1e9 + Math.random() * 9e9);
    confirmPayment(filing.id);   // marks DUTY_PAID, adds the Payment Receipt document, re-renders behind this overlay
    TCOS_EP_BUSY = false;
    const rc = (STATE.documentsGenerated || []).find(x => x.filingId === filing.id && x.type === 'Payment Receipt');
    const bridged = tcosEpIsBridgedImport(filing);
    const now = new Date();
    bg.querySelector('.ep-card').innerHTML = `${tcosEpHead()}<div class="ep-body">
      <div class="ep-ok"><svg viewBox="0 0 52 52"><path d="M12 27 l10 10 l19 -21"/></svg></div>
      <h3 class="ep-title">Payment Successful</h3><p class="ep-sub">Customs duty has been credited to the Government account.</p>
      <table class="ep-rcpt">
        <tr><td>Bill of Entry No.</td><td><b>${esc(filing.id)}</b></td></tr>
        <tr><td>Challan / CIN</td><td><b>${esc(pay.challanNo)}</b></td></tr>
        <tr><td>Bank reference</td><td>${esc(pay.bankRef)}</td></tr>
        <tr><td>Amount paid</td><td><b>${fmtINR(pay.amount)}</b></td></tr>
        <tr><td>Mode</td><td>ICEGATE e-Payment</td></tr>
        <tr><td>Date &amp; time</td><td>${esc(now.toLocaleString('en-IN'))}</td></tr>
      </table>
      <div class="ep-act">
        ${rc ? `<button class="back2" id="epRcpt">⬇ Payment Receipt PDF</button>` : ''}
        <button class="${bridged ? 'back2' : 'next'}" id="epClose">${bridged ? 'Stay in ICEGATE' : 'Continue'}</button>
        ${bridged ? '<button class="next" id="epReturn">⬇ Download PDF &amp; return to Logistics Simulator</button>' : ''}
      </div>
      ${bridged ? '<p class="hint" style="text-align:right;margin:8px 0 0">You will be taken back to the Logistics Simulator automatically.</p>' : ''}
    </div>`;
    const rb = bg.querySelector('#epRcpt');
    if (rb) rb.addEventListener('click', () => { Promise.resolve(downloadDocumentPDF(rc.id)).catch(() => {}); });
    bg.querySelector('#epClose').addEventListener('click', () => { bg.remove(); if (typeof renderBridgeBanner === 'function') renderBridgeBanner(); });
    if (bridged) {
      const go = () => { bg.remove(); tcosEpBridgeComplete(filing); };
      bg.querySelector('#epReturn').addEventListener('click', go);
      /* the student sees the success screen for a few seconds, then the standard return prompt (countdown + PDF) opens */
      bg._epTimer = setTimeout(() => { if (document.body.contains(bg)) go(); }, 4500);
      bg.querySelector('#epClose').addEventListener('click', () => clearTimeout(bg._epTimer));
    }
  }
}

/* Bridged Bill of Entry: duty is paid -> the Logistics exercise is done. Same companion documents the Out-of-Charge
   path completes (minus the OOC itself, which is a later step in ICEGATE), then the return prompt (PDF + auto-return). */
function tcosEpBridgeComplete(filing) {
  try {
    if (typeof DotBridge === 'undefined') return;
    if (!DotBridge.markCompleted('import', filing.id, 'bill-of-entry')) return;
    const b = DotBridge.getBridge();
    if (b && b.userId) {
      const challanNo = (filing.payment && filing.payment.challanNo) || (filing.assessment && filing.assessment.dutyChallanNo) || '';
      DotBridge.silentCompleteLogisticsDoc(b.userId, 'assessment-copy', filing.id, 'Assessment Copy', null, { originalDocType: 'Bill of Entry', originalDocNo: filing.id });
      DotBridge.silentCompleteLogisticsDoc(b.userId, 'duty-calculation', filing.id, 'Duty Calculation', null, { boeNumber: filing.id, challanNo: challanNo, oocNumber: '' });
      DotBridge.silentCompleteLogisticsDoc(b.userId, 'duty-challan', filing.id, 'Duty Challan', null, { boeNo: filing.id, cin: challanNo });
      if (filing.examination && filing.examination.required) DotBridge.silentCompleteLogisticsDoc(b.userId, 'examination-report', filing.id, 'Examination Report', null, { boeNo: filing.id });
    }
    if (typeof showBridgeReturnPrompt === 'function') showBridgeReturnPrompt(filing.id, 'Bill of Entry', { paymentDone: true });
  } catch (e) { if (typeof console !== 'undefined') console.warn('Bridge completion after payment skipped:', e); }
}
