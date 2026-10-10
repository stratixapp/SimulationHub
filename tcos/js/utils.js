/* ============================================================
   TCOS TRAINING SIMULATOR — UTILITIES
   ============================================================ */

function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function esc(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtMoney(n, cur) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  const c = cur || '';
  return (c ? c + ' ' : '') + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtINR(n) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(ts) {
  if (!ts) return '—';
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}
function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(d);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- Toast ---------- */
function toast(msg, kind) {
  let host = $('#toastHost');
  if (!host) {
    host = el('div', 'toast-host'); host.id = 'toastHost';
    document.body.appendChild(host);
  }
  const t = el('div', 'toast ' + (kind || 'info'), esc(msg));
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3600);
}

/* ---------- Confirm modal (simple) ---------- */
function confirmDialog(message, onYes) {
  const bg = el('div', 'modal-bg show');
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirmDialogTitle" style="width:min(440px,92vw)">
    <div class="modal-head" id="confirmDialogTitle">Confirm <span class="close" role="button" tabindex="0" aria-label="Close dialog">×</span></div>
    <div style="padding:22px"><p style="margin:0 0 18px">${esc(message)}</p>
    <div class="actions"><button class="back2" data-x="no">Cancel</button><button class="next" data-x="yes">Confirm</button></div></div>
  </div>`;
  document.body.appendChild(bg);
  /* Section 48: move focus into the dialog on open, restore it to whatever triggered the
     dialog on close, and let Escape close it like Cancel — standard modal keyboard behavior
     that doesn't touch anything visual. */
  const previouslyFocused = document.activeElement;
  const confirmBtn = bg.querySelector('button[data-x="yes"]');
  const cancelBtn = bg.querySelector('button[data-x="no"]');
  if (cancelBtn) cancelBtn.focus();
  function closeDialog() {
    bg.remove();
    document.removeEventListener('keydown', onKeydown);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
  }
  function onKeydown(e) {
    if (e.key === 'Escape') { closeDialog(); }
    else if (e.key === 'Tab') {
      /* simple focus trap between the two buttons since the dialog only ever has these two */
      const focusables = [cancelBtn, confirmBtn].filter(Boolean);
      if (focusables.length) {
        const idx = focusables.indexOf(document.activeElement);
        e.preventDefault();
        const next = e.shiftKey ? (idx <= 0 ? focusables.length - 1 : idx - 1) : (idx === focusables.length - 1 ? 0 : idx + 1);
        focusables[next].focus();
      }
    }
  }
  document.addEventListener('keydown', onKeydown);
  bg.addEventListener('click', e => {
    if (e.target === bg || e.target.classList.contains('close') || e.target.dataset.x === 'no') { closeDialog(); }
    if (e.target.dataset.x === 'yes') { closeDialog(); onYes(); }
  });
}

/* ---------- Field builder for forms ---------- */
function fieldHTML(f, val) {
  const v = val === undefined || val === null ? '' : val;
  const req = f.required ? ' *' : '';
  let input = '';
  if (f.type === 'select') {
    input = `<select id="${f.id}" data-field="${f.id}">` + '<option value="">Select…</option>' +
      f.options.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('') + `</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea id="${f.id}" data-field="${f.id}" rows="2">${esc(v)}</textarea>`;
  } else {
    input = `<input id="${f.id}" data-field="${f.id}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.readonly ? 'readonly' : ''}>`;
  }
  return `<div class="field ${f.full ? 'full' : ''}"><label for="${f.id}">${esc(f.label)}${req}</label>${input}<div class="ferr" id="err_${f.id}"></div></div>`;
}

function readFields(container, fields) {
  const out = {};
  fields.forEach(f => {
    const node = $('#' + f.id, container);
    if (!node) return;
    let v = node.value;
    if (f.number) v = v === '' ? '' : Number(v);
    out[f.key || f.id] = v;
  });
  return out;
}

function clearFieldErrors(container) {
  $all('.ferr', container).forEach(n => n.textContent = '');
  $all('.field.has-error', container).forEach(n => n.classList.remove('has-error'));
}

function showFieldError(container, fieldId, msg) {
  const errNode = $('#err_' + fieldId, container);
  if (errNode) {
    errNode.textContent = msg;
    const fieldNode = errNode.closest('.field');
    if (fieldNode) fieldNode.classList.add('has-error');
  }
}
