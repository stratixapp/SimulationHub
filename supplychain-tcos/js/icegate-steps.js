/* ============================================================
   TCOS — FULL ICEGATE FILING STEPS (Shipping Bill / Bill of Entry)
   ------------------------------------------------------------
   The Logistics Documentation Simulator walks a student through a 14-step Shipping Bill and a
   15-step Bill of Entry, field-for-field like ICEGATE. TCOS now asks for exactly the same
   particulars. The ones TCOS already collects in its own core steps (parties, shipment, invoice,
   items, containers, documents) are NOT asked twice; every other ICEGATE field comes from
   icegate-config.js (generated from the Doc-Sim configs, same field names) and is stored in
   filing.icegate[name]  (flat field)  or  filing.icegate[name] = [rows]  (table).
   Item-aligned tables (one row per item) are rebuilt from filing.items.
   icegate-print.js overlays all of it on the renderer data, so the final PDF is the
   same real-format Shipping Bill / Bill of Entry as the Doc-Sim.
   ============================================================ */

const TCOS_ITEM_EXTRA_COLS = {
  export: [
    { key: 'presentMarketValue', label: 'Present Market Value', numeric: true },
    { key: 'sourceState', label: 'State of Origin of Item' },
    { key: 'endUse', label: 'End Use' }
  ],
  import: [
    { key: 'brand', label: 'Brand' },
    { key: 'model', label: 'Model' },
    { key: 'endUse', label: 'End Use' },
    { key: 'prefDutyClaim', label: 'Preferential Duty Claimed (Y/N)', options: ['Y', 'N'] }
  ]
};

/* the steps that follow each core TCOS step, in Doc-Sim order */
function tcosIcegateStepsAfter(type, coreKey) {
  const spec = (typeof TCOS_ICEGATE_SPEC !== 'undefined' && TCOS_ICEGATE_SPEC[type]) || [];
  const coreTitles = (typeof tcosCoreTitles === 'function') ? tcosCoreTitles(type) : [];
  const out = spec.filter(s => s.after === coreKey).map(s => ({
    key: s.key, title: coreTitles.indexOf(s.title) > -1 ? s.title + ' (ICEGATE)' : s.title, special: 'igspec', spec: s,
    docSimStep: s.docSimStep
  }));
  if (coreKey === 'items') {
    out.unshift({
      key: 'itemExtra', title: 'Item Particulars (Brand / End Use / Origin)', special: 'igspec',
      spec: { key: 'itemExtra', title: 'Item Particulars', fields: [{
        name: 'itemExtra', label: 'Additional particulars for each item', type: 'table', itemAligned: true,
        columns: TCOS_ITEM_EXTRA_COLS[type]
      }] }
    });
  }
  return out;
}

/* wrap a list of core steps with the ICEGATE steps that follow each of them */
function tcosCoreTitles(type) { return tcosCoreTitlesCache; }
var tcosCoreTitlesCache = [];
function tcosWithIcegateSteps(type, core) {
  tcosCoreTitlesCache = core.map(c => c.title);
  const out = [];
  core.forEach(st => {
    out.push(st);
    if (st.key === 'review') return;
    const extra = tcosIcegateStepsAfter(type, st.key);
    extra.forEach(e => out.push(e));
  });
  /* keep `review` last */
  const ri = out.findIndex(s => s.key === 'review');
  if (ri > -1 && ri !== out.length - 1) out.push(out.splice(ri, 1)[0]);
  return out;
}

/* ---------- state helpers ---------- */
function tcosIgStore(filing) {
  filing.icegate = filing.icegate || {};
  /* filings saved by the earlier simplified steps: carry their per-item rows over */
  if (!filing.icegate.__migrated) {
    filing.icegate.__migrated = true;
    if (Array.isArray(filing.itemScheme) && filing.itemScheme.length && !filing.icegate.itemScheme) filing.icegate.itemScheme = filing.itemScheme.map(r => Object.assign({}, r));
    if (Array.isArray(filing.itemDuty) && filing.itemDuty.length) {
      if (!filing.icegate.itemDutyRates) filing.icegate.itemDutyRates = filing.itemDuty.map(r => Object.assign({}, r));
      if (!filing.icegate.itemExtra) filing.icegate.itemExtra = filing.itemDuty.map(r => ({ brand: r.brand, model: r.model, endUse: r.endUse }));
    }
  }
  return filing.icegate;
}
function tcosIgCtx(filing) {
  const ig = tcosIgStore(filing);
  const ctx = Object.assign({}, ig);
  ctx.schemeType = (filing.scheme && filing.scheme.type) || ig.schemeType || '';
  if (/^(none|no scheme|-)?$/i.test(ctx.schemeType)) ctx.schemeType = ctx.schemeType || 'None';
  ctx.invoiceCurrency = (filing.invoice && filing.invoice.currency) || '';
  ctx.paymentMethod = ig.paymentMethod || (filing.payment && filing.payment.method) || '';
  return ctx;
}
function tcosShowIf(f, filing) {
  if (!f.showIf) return true;
  try { return !!(new Function('return (' + f.showIf + ')')())(tcosIgCtx(filing)); } catch (e) { return true; }
}
function tcosIgDefault(name, filing) {
  const S = filing.shipment || {}, C = filing.counterparty || {}, I = filing.invoice || {};
  const imp = filing.type === 'import';
  switch (name) {
    case 'customsHouseCode': return tcosCodeFromPortName(S.portOfLoading) || '';
    case 'portCode': return tcosCodeFromPortName(S.portOfDischarge) || '';
    case 'jobDate': return icDay(filing.createdAt);
    case 'importDate': return icDay(filing.createdAt);
    case 'branchSerialNo': return '0';
    case 'countryExport': return C.country || '';
    case 'portOfShipment': return S.portOfLoading || '';
    case 'exchangeRate': return (typeof FX_TO_INR !== 'undefined' && FX_TO_INR[I.currency]) || '';
    case 'countryDischarge': return S.countryOfDestination || C.country || '';
    case 'portFinalDestination': return C.port || '';
    case 'consigneeCountryCode': return icShortCountryCode(C.country);
    default: return '';
  }
}

/* ---------- rendering ---------- */
function tcosIgFieldHTML(f, filing, idx) {
  const ig = tcosIgStore(filing);
  let v = ig[f.name];
  if (v === undefined || v === null || v === '') { v = tcosIgDefault(f.name, filing); if (v !== '') ig[f.name] = v; }
  const id = 'ig__' + f.name;
  const req = f.required ? ' *' : '';
  const ro = '';
  let input;
  if (f.type === 'select') {
    input = `<select id="${id}" data-igf="${f.name}"><option value="">Select…</option>${(f.options || []).map(o => `<option value="${esc(o)}" ${String(o) === String(v) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    input = `<textarea id="${id}" data-igf="${f.name}" rows="2" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
  } else {
    input = `<input id="${id}" data-igf="${f.name}" type="${f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text')}" ${f.type === 'number' ? 'step="any"' : ''} value="${esc(v == null ? '' : v)}" placeholder="${esc(f.placeholder || '')}" ${f.uppercase ? 'style="text-transform:uppercase"' : ''} ${ro}>`;
  }
  const wide = f.full || f.type === 'textarea' ? 'full' : '';
  return `<div class="field ${wide}"><label for="${id}">${esc(f.label)}${req}</label>${input}${f.help ? `<div class="hint">${esc(f.help)}</div>` : ''}<div class="ferr" id="err_${id}"></div></div>`;
}

function tcosIgColInput(col, val, attrs) {
  const v = val === undefined || val === null ? '' : val;
  if (col.options) return `<select class="cell" ${attrs}><option value=""></option>${col.options.map(o => `<option ${String(o) === String(v) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  return `<input class="cell" ${attrs} type="${col.numeric ? 'number' : 'text'}" ${col.numeric ? 'step="any"' : ''} value="${esc(v)}" placeholder="${esc(col.placeholder || '')}" style="min-width:${col.numeric ? 80 : 110}px">`;
}
function tcosIgTableHTML(f, filing) {
  const ig = tcosIgStore(filing);
  const cols = f.columns.filter(c => c.key !== 'itemNo');
  let rows = ig[f.name] = Array.isArray(ig[f.name]) ? ig[f.name] : [];
  const items = filing.items || [];
  const req = new Set(f.requiredCols || []);
  const head = cols.map(c => `<th>${esc(c.label)}${req.has(c.key) ? ' *' : ''}</th>`).join('');
  let body = '', note = '';
  if (f.itemAligned) {
    if (!items.length) return `<div class="alert alert-amber">Add at least one item on the Item Details step first.</div>`;
    while (rows.length < items.length) rows.push({});
    rows.length = items.length;
    rows.forEach((r, i) => cols.forEach(c => {
      if ((r[c.key] === undefined || r[c.key] === '') && c.options && c.options.indexOf('N') > -1 && c.options.length <= 3) r[c.key] = 'N';
      if (f.name === 'itemScheme' && c.key === 'igstRatePct' && (r[c.key] === undefined || r[c.key] === '')) r[c.key] = 18;
      if (f.name === 'itemScheme' && c.key === 'igstStatus' && !r[c.key]) r[c.key] = (ig.lut === 'Y' ? 'LUT' : (c.options && c.options.indexOf('P') > -1 ? 'P' : ''));
      if (f.name === 'itemCompliance' && c.key === 'ceth' && !r[c.key]) r[c.key] = 'NOEXCISE';
    }));
    body = rows.map((r, i) => `<tr data-i="${i}"><td>${i + 1}</td><td style="min-width:140px">${esc(items[i].description || '—')}<div class="hint">${esc(items[i].hsCode || '')}</div></td>${cols.map(c => `<td>${tcosIgColInput(c, r[c.key], `data-igt="${f.name}" data-i="${i}" data-k="${c.key}"`)}</td>`).join('')}</tr>`).join('');
    return `<div class="field full"><label>${esc(f.label)}</label><div class="table-wrap"><table class="data-table items-table"><thead><tr><th>#</th><th>Item</th>${head}</tr></thead><tbody>${body}</tbody></table></div>${f.help ? `<div class="hint">${esc(f.help)}</div>` : ''}<div class="ferr" id="err_igt_${f.name}"></div></div>`;
  }
  body = rows.map((r, i) => `<tr data-i="${i}"><td>${i + 1}</td>${cols.map(c => `<td>${tcosIgColInput(c, r[c.key], `data-igt="${f.name}" data-i="${i}" data-k="${c.key}"`)}</td>`).join('')}<td><button class="row-del" type="button" data-igdel="${f.name}" data-i="${i}" title="Remove row">✕</button></td></tr>`).join('');
  if (!rows.length) note = '<div class="hint">No rows - add one if it applies to this filing.</div>';
  return `<div class="field full"><label>${esc(f.label)}</label><div class="table-wrap"><table class="data-table items-table"><thead><tr><th>#</th>${head}<th></th></tr></thead><tbody>${body}</tbody></table></div>${note}<button class="btn-ghost" type="button" data-igadd="${f.name}">+ Add row</button>${f.help ? `<div class="hint">${esc(f.help)}</div>` : ''}<div class="ferr" id="err_igt_${f.name}"></div></div>`;
}

function tcosSpecStepHTML(filing, step) {
  tcosIgStore(filing);
  const spec = step.spec;
  const fields = spec.fields.filter(f => tcosShowIf(f, filing));
  const flat = fields.filter(f => f.type !== 'table');
  const tables = fields.filter(f => f.type === 'table');
  const hasRerender = false;
  const intro = step.docSimStep ? `<p class="hint">Real ICEGATE ${filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry'} particulars (${esc(spec.title)}). These print on the final document exactly as you enter them.</p>` : `<p class="hint">Fill these for every item - they print in the Items part of the ${filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry'}.</p>`;
  return intro + (flat.length ? `<div class="grid">${flat.map(f => tcosIgFieldHTML(f, filing)).join('')}</div>` : '') + tables.map(f => tcosIgTableHTML(f, filing)).join('');
}

function tcosSyncSpecStep(filing, step) {
  const ig = tcosIgStore(filing);
  const pane = $('#wzPane');
  if (!pane) return;
  $all('[data-igf]', pane).forEach(n => {
    const f = step.spec.fields.find(x => x.name === n.dataset.igf);
    let v = n.value;
    if (f && f.uppercase) v = String(v).toUpperCase();
    ig[n.dataset.igf] = v;
  });
  $all('[data-igt]', pane).forEach(n => {
    const name = n.dataset.igt, i = Number(n.dataset.i), k = n.dataset.k;
    const f = step.spec.fields.find(x => x.name === name);
    const col = f && f.columns.find(c => c.key === k);
    ig[name] = ig[name] || [];
    ig[name][i] = ig[name][i] || {};
    ig[name][i][k] = (col && col.numeric) ? (n.value === '' ? '' : Number(n.value)) : n.value;
  });
}

function tcosWireSpecStep(filing, step) {
  const pane = $('#wzPane');
  if (!pane) return;
  const ig = tcosIgStore(filing);
  const rerenderNames = new Set(step.spec.fields.filter(f => f.reRenderOnChange).map(f => f.name));
  /* fields that other fields' showIf depend on, in this step */
  const depends = new Set();
  step.spec.fields.forEach(f => { if (f.showIf) (f.showIf.match(/d\.([A-Za-z0-9_]+)/g) || []).forEach(m => depends.add(m.slice(2))); });
  pane.oninput = e => { if (e.target.matches('[data-igf],[data-igt]')) { tcosSyncSpecStep(filing, step); saveState(); } };
  pane.onchange = e => {
    if (!e.target.matches('[data-igf],[data-igt]')) return;
    tcosSyncSpecStep(filing, step); saveState();
    const n = e.target.dataset.igf;
    if (n && (rerenderNames.has(n) || depends.has(n))) renderWizardPane();
  };
  $all('[data-igadd]', pane).forEach(b => b.addEventListener('click', () => {
    tcosSyncSpecStep(filing, step);
    const name = b.dataset.igadd; ig[name] = ig[name] || []; ig[name].push({}); saveState(); renderWizardPane();
  }));
  $all('[data-igdel]', pane).forEach(b => b.addEventListener('click', () => {
    tcosSyncSpecStep(filing, step);
    const name = b.dataset.igdel; ig[name].splice(Number(b.dataset.i), 1); saveState(); renderWizardPane();
  }));
}

/* ---------- validation: same rules as the Doc-Sim step ---------- */
function tcosValidateSpecStep(filing, step) {
  const ig = tcosIgStore(filing);
  const errs = [];
  step.spec.fields.forEach(f => {
    if (!tcosShowIf(f, filing)) return;
    if (f.type === 'table') {
      const rows = Array.isArray(ig[f.name]) ? ig[f.name] : [];
      (f.requiredCols || []).filter(k => k !== 'itemNo').forEach(k => {
        if (errs.some(e => e.table === f.name)) return;
        const col = f.columns.find(c => c.key === k);
        rows.forEach((r, i) => {
          if (errs.some(e => e.table === f.name)) return;
          if (!f.itemAligned && !Object.keys(r).some(x => r[x] !== '' && r[x] != null)) return;
          if (r[k] === undefined || r[k] === null || String(r[k]).trim() === '') errs.push({ table: f.name, id: 'igt_' + f.name, message: `${f.label}: row ${i + 1} - "${col ? col.label : k}" is required.` });
        });
      });
      return;
    }
    const v = ig[f.name];
    const has = v !== undefined && v !== null && String(v).trim() !== '';
    if (f.required && !has) { errs.push({ id: 'ig__' + f.name, message: `${f.label} is required.` }); return; }
    if (has && f.pattern) {
      try { if (!new RegExp(f.pattern).test(String(v))) errs.push({ id: 'ig__' + f.name, message: f.patternMsg || `${f.label} is not in the expected format.` }); } catch (e) { /* bad pattern: skip */ }
    }
  });
  return errs;
}
function tcosShowSpecErrors(errs) {
  const pane = $('#wzPane');
  errs.forEach(e => showFieldError(pane, e.id, e.message));
}
