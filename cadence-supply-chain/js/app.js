/* ============================================================
   CADENCE — app controller
   ============================================================ */
(function () {
  'use strict';
  const D = window.CADENCE_DATA;
  const F = window.CADENCE_FORECAST;
  const M = window.CADENCE_METRICS;
  const C = window.CADENCE_CHART;
  const INV = window.CADENCE_INVENTORY;

  const state = {
    query: '',
    activeCat: 'ALL',
    selectedSku: D.SKUS[0].id,
    methodKey: 'ses',
    params: {},          // methodKey -> {paramKey:value}
    revealed: {},         // skuId -> count of hidden months revealed
    forecastLog: {},       // skuId -> [{period,method,predicted,actual,errPct}]
    uplift: 0,
    module: 'demand',
    invParams: { orderingCost: 500, holdingPct: 20, servicePct: 95 },
    kpiMetric: 'perfectOrder',
    sopScenario: 'base',
    sopCustomPct: 0,
    sopCapMult: {}   // skuId -> capacity multiplier vs avg monthly demand (default 1.15)
  };

  // init default params
  Object.keys(F.METHODS).forEach((k) => {
    state.params[k] = {};
    F.METHODS[k].params.forEach((p) => { state.params[k][p.key] = p.def; });
  });

  function skuById(id) { return D.SKUS.find((s) => s.id === id); }

  function currentSeries(skuId) {
    const hist = D.SERIES[skuId].history;
    const hidden = D.SERIES[skuId].hidden;
    const revealedCount = state.revealed[skuId] || 0;
    const values = hist.map((v) => v.value).concat(hidden.slice(0, revealedCount).map((v) => v.value));
    const horizon = D.HIDDEN_MONTHS - revealedCount;
    return { hist, hidden, revealedCount, values, horizon, total: D.HIST_MONTHS + D.HIDDEN_MONTHS };
  }

  function runForecast(skuId, methodKey, values, horizon) {
    if (horizon <= 0) return { fitted: F.run(methodKey, values, state.params[methodKey], 1).fitted, forecast: [], label: F.METHODS[methodKey].name };
    return F.run(methodKey, values, state.params[methodKey], horizon);
  }

  function bestMethod(skuId) {
    const s = currentSeries(skuId);
    let best = null;
    Object.keys(F.METHODS).forEach((k) => {
      const defParams = {};
      F.METHODS[k].params.forEach((p) => { defParams[p.key] = p.def; });
      const r = F.run(k, s.values, defParams, 1);
      const m = M.computeMetrics(s.values, r.fitted);
      if (m.mape !== null && (best === null || m.mape < best.mape)) best = { key: k, mape: m.mape, name: F.METHODS[k].name };
    });
    return best;
  }

  // ---------- rendering ----------
  const el = {
    sidebarList: document.getElementById('sidebarList'),
    search: document.getElementById('search'),
    catchips: document.getElementById('catchips'),
    skuHeader: document.getElementById('skuHeader'),
    kpiStrip: document.getElementById('kpiStrip'),
    methodTabs: document.getElementById('methodTabs'),
    paramsRow: document.getElementById('paramsRow'),
    chartSvg: document.getElementById('chartSvg'),
    chartWrap: document.getElementById('chartWrap'),
    tooltip: document.getElementById('tooltip'),
    legend: document.getElementById('legend'),
    horizonBody: document.getElementById('horizonBody'),
    revealBtn: document.getElementById('revealBtn'),
    resetBtn: document.getElementById('resetBtn'),
    revealStatus: document.getElementById('revealStatus'),
    alertsList: document.getElementById('alertsList'),
    netAccuracy: document.getElementById('netAccuracy'),
    periodLabel: document.getElementById('periodLabel'),
    upliftSlider: document.getElementById('upliftSlider'),
    upliftVal: document.getElementById('upliftVal'),
    scenarioNote: document.getElementById('scenarioNote'),
    moduleNav: document.getElementById('moduleNav'),
    moduleDemand: document.getElementById('moduleDemand'),
    moduleInventory: document.getElementById('moduleInventory'),
    railDemand: document.getElementById('railDemand'),
    railInventory: document.getElementById('railInventory'),
    invKpiStrip: document.getElementById('invKpiStrip'),
    invParamsRow: document.getElementById('invParamsRow'),
    invChartSvg: document.getElementById('invChartSvg'),
    invChartWrap: document.getElementById('invChartWrap'),
    invTooltip: document.getElementById('invTooltip'),
    invCostTable: document.getElementById('invCostTable'),
    invAlertsList: document.getElementById('invAlertsList'),
    moduleKpi: document.getElementById('moduleKpi'),
    railKpi: document.getElementById('railKpi'),
    kpiNetStrip: document.getElementById('kpiNetStrip'),
    kpiMetricTabs: document.getElementById('kpiMetricTabs'),
    kpiBarSvg: document.getElementById('kpiBarSvg'),
    kpiTableBody: document.getElementById('kpiTableBody'),
    kpiWorstList: document.getElementById('kpiWorstList'),
    moduleSop: document.getElementById('moduleSop'),
    railSop: document.getElementById('railSop'),
    sopKpiStrip: document.getElementById('sopKpiStrip'),
    sopScenarioTabs: document.getElementById('sopScenarioTabs'),
    sopParamsRow: document.getElementById('sopParamsRow'),
    sopChartSvg: document.getElementById('sopChartSvg'),
    sopTableBody: document.getElementById('sopTableBody'),
    sopScenarioCompare: document.getElementById('sopScenarioCompare')
  };

  function renderSidebar() {
    el.sidebarList.innerHTML = '';
    const cats = Object.keys(D.CATEGORIES);
    const q = state.query.trim().toLowerCase();
    let shown = 0;
    cats.forEach((catKey) => {
      if (state.activeCat !== 'ALL' && state.activeCat !== catKey) return;
      const skus = D.SKUS.filter((s) => s.cat === catKey && s.name.toLowerCase().includes(q));
      if (skus.length === 0) return;
      shown += skus.length;
      const h = document.createElement('div');
      h.className = 'cat-heading';
      h.textContent = D.CATEGORIES[catKey].label;
      el.sidebarList.appendChild(h);
      skus.forEach((s) => {
        const best = bestMethod(s.id);
        const grade = M.grade(best ? best.mape : null);
        const row = document.createElement('div');
        row.className = 'sku-row' + (s.id === state.selectedSku ? ' active' : '');
        row.tabIndex = 0;
        row.innerHTML =
          '<span class="sku-dot" style="background:' + D.CATEGORIES[catKey].color + '"></span>' +
          '<span class="sku-info"><div class="sku-name">' + s.name + '</div>' +
          '<div class="sku-meta">' + s.uom + ' · lead ' + s.lead + 'd</div></span>' +
          (grade.tone === 'bad' || grade.tone === 'warn' ? '<span class="alert-dot" title="Forecast accuracy needs attention"></span>' : '') +
          '<span class="sku-badge badge-' + grade.tone + '">' + (best ? best.mape.toFixed(0) + '%' : 'N/A') + '</span>';
        row.addEventListener('click', () => { state.selectedSku = s.id; renderAll(); });
        row.addEventListener('keydown', (e) => { if (e.key === 'Enter') row.click(); });
        el.sidebarList.appendChild(row);
      });
    });
    if (shown === 0) {
      el.sidebarList.innerHTML = '<div class="empty-note">No SKUs match "' + state.query + '".</div>';
    }
  }

  function renderCatChips() {
    el.catchips.innerHTML = '';
    const all = document.createElement('span');
    all.className = 'chip' + (state.activeCat === 'ALL' ? ' active' : '');
    all.textContent = 'All';
    all.addEventListener('click', () => { state.activeCat = 'ALL'; renderSidebar(); renderCatChips(); });
    el.catchips.appendChild(all);
    Object.keys(D.CATEGORIES).forEach((k) => {
      const c = document.createElement('span');
      c.className = 'chip' + (state.activeCat === k ? ' active' : '');
      c.textContent = D.CATEGORIES[k].label;
      c.addEventListener('click', () => { state.activeCat = k; renderSidebar(); renderCatChips(); });
      el.catchips.appendChild(c);
    });
  }

  function renderHeader(sku) {
    el.skuHeader.innerHTML =
      '<h1>' + sku.name + '</h1>' +
      '<span class="cat-tag">' + D.CATEGORIES[sku.cat].label + '</span>' +
      '<span class="meta">' + sku.uom + ' &middot; lead time ' + sku.lead + ' days &middot; SKU ' + sku.id + '</span>';
  }

  function renderKpis(metrics) {
    const grade = M.grade(metrics.mape);
    const cards = [
      { label: 'Forecast Accuracy', val: metrics.accuracy === null ? '—' : metrics.accuracy.toFixed(1) + '%', sub: grade.label, tone: grade.tone },
      { label: 'Bias (mean error)', val: metrics.bias === null ? '—' : (metrics.bias > 0 ? '+' : '') + Math.round(metrics.bias), sub: metrics.bias === null ? '' : (metrics.bias > 0 ? 'Under-forecasting' : metrics.bias < 0 ? 'Over-forecasting' : 'No drift'), tone: 'muted' },
      { label: 'MAD', val: metrics.mad === null ? '—' : Math.round(metrics.mad).toLocaleString('en-IN'), sub: 'avg absolute error, units', tone: 'muted' },
      { label: 'RMSE', val: metrics.rmse === null ? '—' : Math.round(metrics.rmse).toLocaleString('en-IN'), sub: 'penalizes big misses', tone: 'muted' }
    ];
    el.kpiStrip.innerHTML = cards.map((c) =>
      '<div class="kpi-card"><div class="k-label">' + c.label + '</div>' +
      '<div class="k-val tone-' + c.tone + '">' + c.val + '</div>' +
      '<div class="k-sub">' + c.sub + '</div></div>'
    ).join('');
  }

  function renderMethodTabs(skuId) {
    const best = bestMethod(skuId);
    el.methodTabs.innerHTML = '';
    Object.keys(F.METHODS).forEach((k) => {
      const m = F.METHODS[k];
      const b = document.createElement('button');
      b.className = 'method-tab' + (k === state.methodKey ? ' active' : '');
      b.textContent = m.name;
      if (best && best.key === k) {
        const star = document.createElement('span');
        star.className = 'rec-star';
        star.textContent = 'BEST FIT';
        b.appendChild(star);
      }
      b.addEventListener('click', () => { state.methodKey = k; renderMain(); });
      el.methodTabs.appendChild(b);
    });
  }

  function renderParams() {
    const m = F.METHODS[state.methodKey];
    el.paramsRow.innerHTML = '';
    m.params.forEach((p) => {
      const wrap = document.createElement('div');
      wrap.className = 'param';
      const val = state.params[state.methodKey][p.key];
      wrap.innerHTML = '<label>' + p.label + ' <b id="pv-' + p.key + '">' + val + '</b></label>' +
        '<input type="range" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '" value="' + val + '" id="pi-' + p.key + '">';
      el.paramsRow.appendChild(wrap);
      const input = wrap.querySelector('input');
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        state.params[state.methodKey][p.key] = v;
        wrap.querySelector('b').textContent = v;
        renderMain(true);
      });
    });
  }

  function renderChartAndTable(sku) {
    const s = currentSeries(sku.id);
    const result = runForecast(sku.id, state.methodKey, s.values, s.horizon);
    const metrics = M.computeMetrics(s.values, result.fitted);

    const total = s.total;
    const periods = [];
    for (let t = 0; t < total; t++) periods.push(D.periodLabel(t).label);

    const actualArr = new Array(total).fill(null);
    for (let t = 0; t < D.HIST_MONTHS; t++) actualArr[t] = s.hist[t].value;

    const revealedArr = new Array(total).fill(null);
    for (let t = 0; t < s.revealedCount; t++) revealedArr[D.HIST_MONTHS + t] = s.hidden[t].value;

    const fittedArr = new Array(total).fill(null);
    for (let i = 0; i < result.fitted.length; i++) fittedArr[i] = result.fitted[i];

    const forecastStart = D.HIST_MONTHS + s.revealedCount;
    const forecastArr = new Array(total).fill(null);
    result.forecast.forEach((v, i) => { forecastArr[forecastStart + i] = v; });

    C.renderChart(el.chartSvg, {
      periods, actual: actualArr, fitted: fittedArr, forecast: forecastArr, revealed: revealedArr,
      forecastStart: s.horizon > 0 ? forecastStart : null,
      onHover: (i) => showTooltip(i, periods, actualArr, fittedArr, forecastArr, revealedArr)
    });

    // scenario adjustment (display only, doesn't affect metrics)
    const upliftFactor = 1 + state.uplift / 100;
    const baselineTotal = result.forecast.reduce((a, b) => a + b, 0);
    const adjustedTotal = baselineTotal * upliftFactor;
    el.scenarioNote.innerHTML = state.uplift === 0
      ? 'Baseline statistical forecast, no consensus adjustment applied.'
      : 'Baseline ' + Math.round(baselineTotal).toLocaleString('en-IN') + ' ' + sku.uom + ' &rarr; adjusted <b style="color:var(--amber)">' +
        Math.round(adjustedTotal).toLocaleString('en-IN') + ' ' + sku.uom + '</b> over the open horizon.';

    renderKpis(metrics);

    // horizon table: remaining forecast months + already revealed months w/ locked-in call
    el.horizonBody.innerHTML = '';
    const log = state.forecastLog[sku.id] || [];
    for (let h = 0; h < s.revealedCount; h++) {
      const rec = log[h];
      const p = s.hidden[h];
      const tr = document.createElement('tr');
      tr.className = 'revealed';
      const errTxt = rec && rec.errPct !== null ? rec.errPct.toFixed(1) + '%' : '—';
      tr.innerHTML = '<td>' + p.period + '</td><td>' + (rec ? Math.round(rec.predicted).toLocaleString('en-IN') : '—') +
        '</td><td>' + p.value.toLocaleString('en-IN') + '</td><td>' + errTxt + '</td>';
      el.horizonBody.appendChild(tr);
    }
    result.forecast.forEach((v, h) => {
      const p = s.hidden[h];
      const adj = v * upliftFactor;
      const tr = document.createElement('tr');
      tr.className = 'pending';
      tr.innerHTML = '<td>' + p.period + '</td><td>' + Math.round(v).toLocaleString('en-IN') +
        (state.uplift !== 0 ? ' <span style="color:var(--dim)">&rarr; ' + Math.round(adj).toLocaleString('en-IN') + '</span>' : '') +
        '</td><td>pending</td><td>—</td>';
      el.horizonBody.appendChild(tr);
    });

    el.revealBtn.disabled = s.horizon <= 0;
    el.revealBtn.textContent = s.horizon <= 0 ? 'All months revealed' : 'Advance 1 month \u2192 reveal ' + s.hidden[s.revealedCount].period;
    el.revealStatus.textContent = s.revealedCount + ' of ' + D.HIDDEN_MONTHS + ' future months revealed for this SKU';
  }

  function showTooltip(i, periods, actualArr, fittedArr, forecastArr, revealedArr) {
    if (i === null) { el.tooltip.style.display = 'none'; return; }
    const rows = [];
    if (actualArr[i] !== null) rows.push(['Actual', actualArr[i], '#3ddcc7']);
    if (revealedArr[i] !== null) rows.push(['Actual (revealed)', revealedArr[i], '#5aa9e6']);
    if (fittedArr[i] !== null) rows.push(['Model fit', fittedArr[i], '#8b7ff0']);
    if (forecastArr[i] !== null) rows.push(['Forecast', forecastArr[i], '#f0a83c']);
    if (rows.length === 0) { el.tooltip.style.display = 'none'; return; }
    el.tooltip.innerHTML = '<div class="tt-period">' + periods[i] + '</div>' +
      rows.map((r) => '<div class="tt-row"><span style="color:' + r[2] + '">' + r[0] + '</span><span>' + Math.round(r[1]).toLocaleString('en-IN') + '</span></div>').join('');
    el.tooltip.style.display = 'block';
  }

  el.chartWrap.addEventListener('mousemove', (e) => {
    const rect = el.chartWrap.getBoundingClientRect();
    el.tooltip.style.left = Math.min(rect.width - 170, e.clientX - rect.left + 14) + 'px';
    el.tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
  });

  function renderAlerts() {
    const flagged = D.SKUS.map((s) => ({ s, best: bestMethod(s.id) }))
      .filter((x) => x.best && x.best.mape >= 20)
      .sort((a, b) => b.best.mape - a.best.mape);
    el.alertsList.innerHTML = '';
    if (flagged.length === 0) {
      el.alertsList.innerHTML = '<div class="empty-note">No SKUs currently below the 20% MAPE threshold.</div>';
      return;
    }
    flagged.forEach(({ s, best }) => {
      const row = document.createElement('div');
      row.className = 'alert-item';
      row.innerHTML = '<span class="sku-dot" style="background:' + D.CATEGORIES[s.cat].color + '"></span>' +
        '<span class="ai-name">' + s.name + '<br><span style="color:var(--dim);font-size:10.5px">' + best.name + '</span></span>' +
        '<span class="ai-mape">' + best.mape.toFixed(0) + '%</span>';
      row.addEventListener('click', () => { state.selectedSku = s.id; renderAll(); });
      el.alertsList.appendChild(row);
    });
  }

  function renderTopbar() {
    const accs = D.SKUS.map((s) => bestMethod(s.id)).filter((b) => b !== null).map((b) => 100 - b.mape);
    const net = accs.reduce((a, b) => a + b, 0) / accs.length;
    el.netAccuracy.textContent = net.toFixed(1) + '%';
    const lastPeriod = D.periodLabel(D.HIST_MONTHS - 1).label;
    el.periodLabel.innerHTML = 'Planning month: <b>' + lastPeriod + '</b>';
  }

  // ---------- inventory optimization module ----------
  function invPlanFor(sku) {
    const s = currentSeries(sku.id);
    return INV.computeInventoryPlan(s.values, {
      leadDays: sku.lead,
      orderingCost: state.invParams.orderingCost,
      holdingPct: state.invParams.holdingPct,
      unitCost: sku.unitCost,
      servicePct: state.invParams.servicePct
    });
  }

  function renderInvKpis(plan, sku) {
    el.invKpiStrip.innerHTML = [
      { label: 'Economic Order Qty', val: Math.round(plan.eoq).toLocaleString('en-IN') + ' ' + sku.uom, sub: plan.ordersPerYear.toFixed(1) + ' orders/yr', tone: 'ok' },
      { label: 'Reorder Point', val: Math.round(plan.reorderPoint).toLocaleString('en-IN') + ' ' + sku.uom, sub: 'trigger next PO here', tone: 'ok' },
      { label: 'Safety Stock', val: Math.round(plan.safetyStock).toLocaleString('en-IN') + ' ' + sku.uom, sub: plan.z.toFixed(2) + 'σ · ' + state.invParams.servicePct + '% service', tone: 'muted' },
      { label: 'Total Annual Cost', val: '₹' + Math.round(plan.totalAnnualCost).toLocaleString('en-IN'), sub: 'ordering + holding', tone: 'warn' }
    ].map((c) =>
      '<div class="kpi-card"><div class="k-label">' + c.label + '</div>' +
      '<div class="k-val tone-' + c.tone + '">' + c.val + '</div>' +
      '<div class="k-sub">' + c.sub + '</div></div>'
    ).join('');
  }

  function renderInvParams() {
    el.invParamsRow.innerHTML = '';
    const defs = [
      { key: 'orderingCost', label: 'Ordering cost (₹ / PO)', min: 100, max: 5000, step: 100 },
      { key: 'holdingPct', label: 'Holding cost (% of value / yr)', min: 5, max: 40, step: 1 }
    ];
    defs.forEach((p) => {
      const wrap = document.createElement('div');
      wrap.className = 'param';
      const val = state.invParams[p.key];
      wrap.innerHTML = '<label>' + p.label + ' <b>' + (p.key === 'orderingCost' ? '₹' + val : val + '%') + '</b></label>' +
        '<input type="range" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '" value="' + val + '">';
      el.invParamsRow.appendChild(wrap);
      const input = wrap.querySelector('input');
      input.addEventListener('input', () => {
        state.invParams[p.key] = parseFloat(input.value);
        wrap.querySelector('b').textContent = p.key === 'orderingCost' ? '₹' + input.value : input.value + '%';
        renderInventoryModule();
      });
    });
    const svcWrap = document.createElement('div');
    svcWrap.className = 'param';
    svcWrap.innerHTML = '<label>Target service level</label>' +
      '<select style="background:var(--panel-alt);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:7px;font-family:var(--mono)">' +
      INV.Z_TABLE.map((z) => '<option value="' + z.pct + '"' + (z.pct === state.invParams.servicePct ? ' selected' : '') + '>' + z.pct + '%</option>').join('') +
      '</select>';
    el.invParamsRow.appendChild(svcWrap);
    svcWrap.querySelector('select').addEventListener('change', (e) => {
      state.invParams.servicePct = parseFloat(e.target.value);
      renderInventoryModule();
    });
  }

  function renderInvChartAndCosts(sku, plan) {
    const points = INV.buildSawtooth(plan, 90, 1);
    C.renderInventoryChart(el.invChartSvg, {
      points, rop: plan.reorderPoint, safetyStock: plan.safetyStock, unit: sku.uom,
      onHover: (p) => {
        if (!p) { el.invTooltip.style.display = 'none'; return; }
        el.invTooltip.innerHTML = '<div class="tt-period">Day ' + p.day + '</div><div class="tt-row"><span style="color:#3ddcc7">Position</span><span>' + Math.round(p.level).toLocaleString('en-IN') + '</span></div>';
        el.invTooltip.style.display = 'block';
      }
    });

    const rows = [
      ['Avg daily demand', plan.avgDaily.toFixed(1) + ' ' + sku.uom + '/day'],
      ['Lead-time demand (mean)', Math.round(plan.leadTimeDemandMean).toLocaleString('en-IN') + ' ' + sku.uom],
      ['Lead-time demand (σ)', Math.round(plan.leadTimeDemandStd).toLocaleString('en-IN') + ' ' + sku.uom],
      ['Order cycle length', plan.cycleDays.toFixed(1) + ' days'],
      ['Days of supply (avg inventory)', Math.round(plan.daysOfSupply) + ' days'],
      ['Annual ordering cost', '₹' + Math.round(plan.annualOrderingCost).toLocaleString('en-IN')],
      ['Annual holding cost', '₹' + Math.round(plan.annualHoldingCost).toLocaleString('en-IN')],
      ['Avg inventory value tied up', '₹' + Math.round(plan.annualCarryingValue).toLocaleString('en-IN')]
    ];
    el.invCostTable.innerHTML = '<tbody>' + rows.map((r) =>
      '<tr><td>' + r[0] + '</td><td colspan="3">' + r[1] + '</td></tr>'
    ).join('') + '</tbody>';
  }

  el.invChartWrap.addEventListener('mousemove', (e) => {
    const rect = el.invChartWrap.getBoundingClientRect();
    el.invTooltip.style.left = Math.min(rect.width - 170, e.clientX - rect.left + 14) + 'px';
    el.invTooltip.style.top = (e.clientY - rect.top - 10) + 'px';
  });

  function renderInvAlerts() {
    const rows = D.SKUS.map((s) => ({ s, plan: invPlanFor(s) }))
      .map((x) => {
        const risk = x.plan.daysOfSupply < x.s.lead * 1.2 ? 'stockout' : (x.plan.daysOfSupply > 90 ? 'overstock' : null);
        return { ...x, risk };
      })
      .filter((x) => x.risk)
      .sort((a, b) => (a.risk === 'stockout' ? -1 : 1) - (b.risk === 'stockout' ? -1 : 1));
    el.invAlertsList.innerHTML = '';
    if (rows.length === 0) {
      el.invAlertsList.innerHTML = '<div class="empty-note">No stockout or overstock risk at current policy settings.</div>';
      return;
    }
    rows.forEach(({ s, plan, risk }) => {
      const row = document.createElement('div');
      row.className = 'alert-item';
      row.innerHTML = '<span class="sku-dot" style="background:' + D.CATEGORIES[s.cat].color + '"></span>' +
        '<span class="ai-name">' + s.name + '<br><span style="color:var(--dim);font-size:10.5px">' +
        (risk === 'stockout' ? 'Days of supply < lead time' : 'Days of supply > 90d') + '</span></span>' +
        '<span class="ai-mape" style="color:' + (risk === 'stockout' ? 'var(--red)' : 'var(--amber)') + '">' + Math.round(plan.daysOfSupply) + 'd</span>';
      row.addEventListener('click', () => { state.selectedSku = s.id; renderAll(); });
      el.invAlertsList.appendChild(row);
    });
  }

  function renderInventoryModule() {
    const sku = skuById(state.selectedSku);
    const plan = invPlanFor(sku);
    renderInvKpis(plan, sku);
    renderInvChartAndCosts(sku, plan);
  }

  function switchModule(mod) {
    state.module = mod;
    el.moduleNav.querySelectorAll('.module-tab').forEach((b) => b.classList.toggle('active', b.dataset.module === mod));
    el.moduleDemand.style.display = mod === 'demand' ? '' : 'none';
    el.moduleInventory.style.display = mod === 'inventory' ? '' : 'none';
    el.moduleKpi.style.display = mod === 'kpi' ? '' : 'none';
    el.moduleSop.style.display = mod === 'sop' ? '' : 'none';
    el.railDemand.style.display = mod === 'demand' ? '' : 'none';
    el.railInventory.style.display = mod === 'inventory' ? '' : 'none';
    el.railKpi.style.display = mod === 'kpi' ? '' : 'none';
    el.railSop.style.display = mod === 'sop' ? '' : 'none';
    if (mod === 'inventory') { renderInvParams(); renderInventoryModule(); renderInvAlerts(); }
    if (mod === 'kpi') { renderKpiModule(); }
    if (mod === 'sop') { renderSopModule(); }
  }

  // ---------- S&OP Scenario Planner ----------
  const SOP = window.CADENCE_SOP;

  function capMultFor(skuId) {
    if (state.sopCapMult[skuId] === undefined) state.sopCapMult[skuId] = 1.15;
    return state.sopCapMult[skuId];
  }
  function activeScenarioPct() {
    return state.sopScenario === 'custom' ? state.sopCustomPct : SOP.SCENARIOS[state.sopScenario].pct;
  }

  function sopPlanFor(sku, scenarioPct, capMult) {
    const s = currentSeries(sku.id);
    const st = D.stats(s.values);
    const capacityPerMonth = st.mean * capMult;
    return SOP.computeScenarioPlan(sku, s.values, s.horizon > 0 ? s.horizon : D.HIDDEN_MONTHS, scenarioPct, capacityPerMonth);
  }

  function renderSopModule() {
    const sku = skuById(state.selectedSku);
    const pct = activeScenarioPct();
    const capMult = capMultFor(sku.id);
    const plan = sopPlanFor(sku, pct, capMult);
    const s = currentSeries(sku.id);
    const horizon = s.horizon > 0 ? s.horizon : D.HIDDEN_MONTHS;

    el.sopKpiStrip.innerHTML = [
      { label: 'Demand Plan (' + horizon + 'mo)', val: Math.round(plan.totalDemand).toLocaleString('en-IN') + ' ' + sku.uom, sub: plan.methodLabel + ' + ' + (pct >= 0 ? '+' : '') + pct + '%', tone: 'ok' },
      { label: 'Supply Capacity', val: Math.round(plan.totalCapacity).toLocaleString('en-IN') + ' ' + sku.uom, sub: capMult.toFixed(2) + '× avg monthly demand', tone: 'muted' },
      { label: 'Unmet Demand (Gap)', val: Math.round(plan.totalGap).toLocaleString('en-IN') + ' ' + sku.uom, sub: plan.totalGap > 0 ? 'capacity shortfall' : 'fully covered', tone: plan.totalGap > 0 ? 'bad' : 'good' },
      { label: 'Revenue at Risk', val: '₹' + Math.round(plan.revenueAtRisk).toLocaleString('en-IN'), sub: 'of ₹' + Math.round(plan.revenuePlan).toLocaleString('en-IN') + ' planned', tone: plan.revenueAtRisk > 0 ? 'warn' : 'good' }
    ].map((c) =>
      '<div class="kpi-card"><div class="k-label">' + c.label + '</div>' +
      '<div class="k-val tone-' + c.tone + '">' + c.val + '</div>' +
      '<div class="k-sub">' + c.sub + '</div></div>'
    ).join('');

    el.sopScenarioTabs.innerHTML = '';
    Object.keys(SOP.SCENARIOS).forEach((k) => {
      const sc = SOP.SCENARIOS[k];
      const b = document.createElement('button');
      b.className = 'method-tab' + (state.sopScenario === k ? ' active' : '');
      b.textContent = sc.label + ' (' + (sc.pct >= 0 ? '+' : '') + sc.pct + '%)';
      b.addEventListener('click', () => { state.sopScenario = k; renderSopModule(); });
      el.sopScenarioTabs.appendChild(b);
    });
    const customBtn = document.createElement('button');
    customBtn.className = 'method-tab' + (state.sopScenario === 'custom' ? ' active' : '');
    customBtn.textContent = 'Custom';
    customBtn.addEventListener('click', () => { state.sopScenario = 'custom'; renderSopModule(); });
    el.sopScenarioTabs.appendChild(customBtn);

    el.sopParamsRow.innerHTML = '';
    const pctWrap = document.createElement('div');
    pctWrap.className = 'param';
    pctWrap.innerHTML = '<label>Scenario adjustment vs baseline <b>' + (pct >= 0 ? '+' : '') + pct + '%</b></label>' +
      '<input type="range" min="-40" max="60" step="5" value="' + pct + '">';
    el.sopParamsRow.appendChild(pctWrap);
    pctWrap.querySelector('input').addEventListener('input', (e) => {
      state.sopScenario = 'custom';
      state.sopCustomPct = parseFloat(e.target.value);
      renderSopModule();
    });

    const capWrap = document.createElement('div');
    capWrap.className = 'param';
    capWrap.innerHTML = '<label>Supply capacity (× avg monthly demand) <b>' + capMult.toFixed(2) + '×</b></label>' +
      '<input type="range" min="0.6" max="2.0" step="0.05" value="' + capMult + '">';
    el.sopParamsRow.appendChild(capWrap);
    capWrap.querySelector('input').addEventListener('input', (e) => {
      state.sopCapMult[sku.id] = parseFloat(e.target.value);
      renderSopModule();
    });

    const periods = [];
    for (let h = 0; h < horizon; h++) periods.push(D.periodLabel(s.hist.length + s.revealedCount + h).label);
    C.renderSupplyDemandChart(el.sopChartSvg, { periods, demand: plan.demand, capacity: plan.capacity });

    const allRows = D.SKUS.map((sk) => ({ sk, plan: sopPlanFor(sk, pct, capMultFor(sk.id)) }))
      .sort((a, b) => b.plan.totalGap - a.plan.totalGap);
    el.sopTableBody.innerHTML = allRows.map(({ sk, plan: p }) =>
      '<tr' + (sk.id === sku.id ? ' style="color:var(--cyan)"' : '') + '><td style="text-align:left">' + sk.name + '</td>' +
      '<td>' + Math.round(p.totalDemand).toLocaleString('en-IN') + '</td>' +
      '<td>' + Math.round(p.totalCapacity).toLocaleString('en-IN') + '</td>' +
      '<td' + (p.totalGap > 0 ? ' style="color:var(--red)"' : '') + '>' + Math.round(p.totalGap).toLocaleString('en-IN') + '</td>' +
      '<td>₹' + Math.round(p.revenueAtRisk).toLocaleString('en-IN') + '</td></tr>'
    ).join('');

    // scenario comparison for the right rail — network totals per canonical scenario
    const compareRows = Object.keys(SOP.SCENARIOS).map((k) => {
      const sc = SOP.SCENARIOS[k];
      const total = D.SKUS.reduce((acc, sk) => acc + sopPlanFor(sk, sc.pct, capMultFor(sk.id)).revenueAtRisk, 0);
      return { label: sc.label, pct: sc.pct, total };
    });
    const maxTotal = Math.max(...compareRows.map((r) => r.total), 1);
    el.sopScenarioCompare.innerHTML = compareRows.map((r) =>
      '<div style="margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">' +
      '<span>' + r.label + ' (' + (r.pct >= 0 ? '+' : '') + r.pct + '%)</span>' +
      '<span style="font-family:var(--mono);color:var(--amber)">₹' + Math.round(r.total).toLocaleString('en-IN') + '</span></div>' +
      '<div style="background:var(--panel-alt);border-radius:5px;height:7px;overflow:hidden">' +
      '<div style="background:var(--amber);height:100%;width:' + Math.max(2, (r.total / maxTotal) * 100) + '%"></div></div></div>'
    ).join('');
  }

  // ---------- KPI Command Center ----------
  const KPI_METRICS = {
    perfectOrder: { label: 'Perfect Order %', unit: '%', color: '#3ddcc7', get: (r) => r.ops.perfectOrder },
    otif: { label: 'OTIF %', unit: '%', color: '#5aa9e6', get: (r) => r.ops.otif },
    fillRate: { label: 'Fill Rate %', unit: '%', color: '#8b7ff0', get: (r) => r.ops.fillRate },
    turns: { label: 'Inventory Turns/yr', unit: 'x', color: '#f0a83c', get: (r) => r.turn.turns }
  };

  function allSkuKpiRows() {
    return D.SKUS.map((s) => {
      const s2 = currentSeries(s.id);
      const plan = INV.computeInventoryPlan(s2.values, {
        leadDays: s.lead, orderingCost: state.invParams.orderingCost,
        holdingPct: state.invParams.holdingPct, unitCost: s.unitCost, servicePct: state.invParams.servicePct
      });
      const ops = window.CADENCE_KPI.operationalStats(s, s.noise);
      const turn = window.CADENCE_KPI.turnoverFor(s, plan);
      return { s, plan, ops, turn };
    });
  }

  function renderKpiModule() {
    const rows = allSkuKpiRows();
    const n = rows.length;
    const avg = (fn) => rows.reduce((a, r) => a + fn(r), 0) / n;
    const netPerfect = avg((r) => r.ops.perfectOrder);
    const netOtif = avg((r) => r.ops.otif);
    const netFill = avg((r) => r.ops.fillRate);
    const netTurns = avg((r) => r.turn.turns);
    const totalInvValue = rows.reduce((a, r) => a + r.turn.avgInvValue, 0);
    const atRisk = rows.filter((r) => r.plan.daysOfSupply < r.s.lead * 1.2 || r.plan.daysOfSupply > 90).length;

    el.kpiNetStrip.innerHTML = [
      { label: 'Perfect Order Rate', val: netPerfect.toFixed(1) + '%', sub: 'network avg', tone: netPerfect >= 80 ? 'good' : netPerfect >= 70 ? 'ok' : 'warn' },
      { label: 'OTIF', val: netOtif.toFixed(1) + '%', sub: 'on-time in-full', tone: netOtif >= 85 ? 'good' : netOtif >= 75 ? 'ok' : 'warn' },
      { label: 'Fill Rate', val: netFill.toFixed(1) + '%', sub: 'unit fill rate', tone: netFill >= 92 ? 'good' : 'ok' },
      { label: 'Inventory Turns', val: netTurns.toFixed(1) + 'x/yr', sub: '₹' + Math.round(totalInvValue).toLocaleString('en-IN') + ' tied up · ' + atRisk + ' SKUs at risk', tone: 'muted' }
    ].map((c) =>
      '<div class="kpi-card"><div class="k-label">' + c.label + '</div>' +
      '<div class="k-val tone-' + c.tone + '">' + c.val + '</div>' +
      '<div class="k-sub">' + c.sub + '</div></div>'
    ).join('');

    el.kpiMetricTabs.innerHTML = '';
    Object.keys(KPI_METRICS).forEach((k) => {
      const b = document.createElement('button');
      b.className = 'method-tab' + (k === state.kpiMetric ? ' active' : '');
      b.textContent = KPI_METRICS[k].label;
      b.addEventListener('click', () => { state.kpiMetric = k; renderKpiModule(); });
      el.kpiMetricTabs.appendChild(b);
    });

    const metric = KPI_METRICS[state.kpiMetric];
    const sorted = rows.slice().sort((a, b) => metric.get(b) - metric.get(a));
    C.renderBarChart(el.kpiBarSvg, {
      items: sorted.map((r) => ({ label: r.s.name, value: metric.get(r), color: metric.color })),
      unit: metric.unit
    });

    el.kpiTableBody.innerHTML = rows.slice().sort((a, b) => b.ops.perfectOrder - a.ops.perfectOrder).map((r) =>
      '<tr><td style="text-align:left">' + r.s.name + '</td>' +
      '<td>' + r.ops.fillRate.toFixed(1) + '%</td>' +
      '<td>' + r.ops.otif.toFixed(1) + '%</td>' +
      '<td>' + r.ops.perfectOrder.toFixed(1) + '%</td>' +
      '<td>' + r.turn.turns.toFixed(1) + '</td>' +
      '<td>' + Math.round(r.plan.daysOfSupply) + 'd</td></tr>'
    ).join('');

    const worst = rows.slice().sort((a, b) => a.ops.perfectOrder - b.ops.perfectOrder).slice(0, 5);
    el.kpiWorstList.innerHTML = worst.map((r) =>
      '<div class="alert-item"><span class="sku-dot" style="background:' + D.CATEGORIES[r.s.cat].color + '"></span>' +
      '<span class="ai-name">' + r.s.name + '<br><span style="color:var(--dim);font-size:10.5px">OTIF ' + r.ops.otif.toFixed(1) + '%</span></span>' +
      '<span class="ai-mape">' + r.ops.perfectOrder.toFixed(1) + '%</span></div>'
    ).join('');
    el.kpiWorstList.querySelectorAll('.alert-item').forEach((div, i) => {
      div.addEventListener('click', () => { state.selectedSku = worst[i].s.id; switchModule('demand'); renderAll(); });
    });
  }

  el.moduleNav.querySelectorAll('.module-tab').forEach((b) => {
    if (b.disabled) return;
    b.addEventListener('click', () => switchModule(b.dataset.module));
  });

  function renderMain(skipTabs) {
    const sku = skuById(state.selectedSku);
    renderHeader(sku);
    if (state.module === 'demand') {
      if (!skipTabs) { renderMethodTabs(sku.id); renderParams(); }
      renderChartAndTable(sku);
    } else if (state.module === 'inventory') {
      renderInventoryModule();
    } else if (state.module === 'kpi') {
      renderKpiModule();
    } else if (state.module === 'sop') {
      renderSopModule();
    }
  }

  function renderAll() {
    renderCatChips();
    renderSidebar();
    renderTopbar();
    if (state.module === 'demand') { renderAlerts(); }
    else if (state.module === 'inventory') { renderInvAlerts(); }
    renderMain(false);
  }

  // ---------- wiring ----------
  el.search.addEventListener('input', () => { state.query = el.search.value; renderSidebar(); });
  el.revealBtn.addEventListener('click', () => {
    const sku = skuById(state.selectedSku);
    const s = currentSeries(sku.id);
    if (s.horizon <= 0) return;
    const result = runForecast(sku.id, state.methodKey, s.values, s.horizon);
    const predicted = result.forecast[0];
    const nextActualRec = s.hidden[s.revealedCount];
    const errPct = nextActualRec.value !== 0 ? Math.abs((nextActualRec.value - predicted) / nextActualRec.value) * 100 : null;
    state.forecastLog[sku.id] = state.forecastLog[sku.id] || [];
    state.forecastLog[sku.id].push({ period: nextActualRec.period, method: state.methodKey, predicted, actual: nextActualRec.value, errPct });
    state.revealed[sku.id] = s.revealedCount + 1;
    renderAll();
  });
  el.resetBtn.addEventListener('click', () => {
    const sku = skuById(state.selectedSku);
    state.revealed[sku.id] = 0;
    state.forecastLog[sku.id] = [];
    renderAll();
  });
  el.upliftSlider.addEventListener('input', () => {
    state.uplift = parseFloat(el.upliftSlider.value);
    el.upliftVal.textContent = (state.uplift > 0 ? '+' : '') + state.uplift + '%';
    renderChartAndTable(skuById(state.selectedSku));
  });

  renderAll();

  // ---------- suite account badge (shared sign-in with TCOS) ----------
  function renderAccountBadge() {
    const badge = document.getElementById('accountBadge');
    if (!badge || !window.DOT_SUITE_AUTH) return;
    const acc = window.DOT_SUITE_AUTH.getAccount();
    if (!acc) {
      badge.className = 'account-badge signed-out';
      badge.innerHTML = 'Not signed in · <a href="../tcos/index.html">sign in via TCOS</a>';
      return;
    }
    const initial = (acc.name || '?').trim().charAt(0).toUpperCase();
    badge.className = 'account-badge';
    badge.innerHTML = '<span class="av">' + initial + '</span>' +
      '<span class="who"><b>' + acc.name + '</b><span>' + acc.role + (acc.isTrainer ? ' · Trainer' : '') + '</span></span>';
  }
  renderAccountBadge();
  if (window.DOT_SUITE_AUTH) window.DOT_SUITE_AUTH.onAccountChange(renderAccountBadge);
})();
