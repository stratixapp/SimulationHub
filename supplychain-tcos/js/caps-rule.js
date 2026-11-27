/* ============================================================
   CAPITAL-LETTER RULE FOR THE WHOLE ICEGATE FILING - v56
   Real ICEGATE accepts text in CAPITAL letters only. Every text box and text area of the Shipping Bill / Bill of Entry
   filing (party, invoice, shipment, items, containers, scheme and compliance details, documents, manifest ...) now follows the rule:
     - the moment a student types a SMALL letter the box turns red and says "Type in CAPITAL LETTERS only" (nothing is changed silently);
     - Next is blocked until every such box is retyped in capitals.
   Values the app itself filled in (for example names carried over from the Logistics Simulator, or the default country) are not
   the student's mistake, so those are converted to capitals when the student presses Next.
   Not covered: dropdowns, numbers, dates, e-mail / URL / password boxes, read-only boxes. Add data-nocaps to a box to exempt it.
   ============================================================ */
const TCOS_CAPS_EXEMPT = /e-?mail|password|website|\burl\b/i;
let TCOS_CAPS_TYPED = new Set();      // boxes the student typed in (survives the page being redrawn)
let TCOS_CAPS_FILING = null;

function tcosCapsKey(el) {
  const d = Object.keys(el.dataset || {}).map(k => k + '=' + el.dataset[k]).join(',');
  const tr = el.closest ? el.closest('tr') : null, td = el.closest ? el.closest('td') : null;
  return [(typeof WZ !== 'undefined' && WZ) ? WZ.stepIndex : '', el.id || '', d, tr && tr.dataset ? tr.dataset.i : '', td ? td.cellIndex : ''].join('|');
}

function tcosCapsInputs() {
  const pane = document.getElementById('wzPane');
  if (!pane) return [];
  return Array.from(pane.querySelectorAll('input, textarea')).filter(el => {
    if (el.tagName === 'INPUT') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t !== 'text' && t !== 'search') return false;
    }
    if (el.readOnly || el.disabled || el.hasAttribute('data-nocaps')) return false;
    const label = [el.id, el.name, el.getAttribute('data-igf'), el.getAttribute('data-k'), el.getAttribute('placeholder') || ''].join(' ');
    return !TCOS_CAPS_EXEMPT.test(label);
  });
}

function tcosCapsMark(el, bad) {
  el.classList.toggle('caps-bad', bad);
  let m = el._capsMsg;
  if (bad) {
    if (!m || !m.isConnected) {
      m = document.createElement('div');
      m.className = 'ferr caps-msg';
      m.textContent = 'Type in CAPITAL LETTERS only.';
      el.insertAdjacentElement('afterend', m);
      el._capsMsg = m;
    }
  } else if (m) { m.remove(); el._capsMsg = null; }
}

/* run when the student presses Next: returns the boxes still holding small letters that the student typed */
function tcosCapsPass() {
  if (typeof WZ !== 'undefined' && WZ && WZ.filing && TCOS_CAPS_FILING !== WZ.filing.id) { TCOS_CAPS_FILING = WZ.filing.id; TCOS_CAPS_TYPED = new Set(); }
  const bad = [];
  tcosCapsInputs().forEach(el => {
    const v = el.value || '';
    if (!/[a-z]/.test(v)) { tcosCapsMark(el, false); return; }
    if (el._tcosTyped || TCOS_CAPS_TYPED.has(tcosCapsKey(el))) { tcosCapsMark(el, true); bad.push(el); return; }
    el.value = v.toUpperCase();                                   // prefilled by the app, not typed by the student
    el.dispatchEvent(new Event('input', { bubbles: true }));
    tcosCapsMark(el, false);
  });
  return bad;
}

/* live: show the error as soon as a small letter is typed */
document.addEventListener('input', function (e) {
  if (!e.isTrusted) return;
  const el = e.target;
  if (!el || !el.closest || !el.closest('#wzPane')) return;
  if (tcosCapsInputs().indexOf(el) < 0) return;
  el._tcosTyped = true;
  TCOS_CAPS_TYPED.add(tcosCapsKey(el));
  tcosCapsMark(el, /[a-z]/.test(el.value));
}, true);

(function injectCapsCss() {
  if (document.getElementById('capsCss')) return;
  const st = document.createElement('style'); st.id = 'capsCss';
  st.textContent = '.caps-bad{border-color:#C6362F !important;background:#FFF5F5 !important;box-shadow:0 0 0 2px rgba(198,54,47,.15);}.caps-msg{color:#C6362F;font-size:11.5px;font-weight:600;margin-top:2px;white-space:normal;}';
  document.head.appendChild(st);
})();
