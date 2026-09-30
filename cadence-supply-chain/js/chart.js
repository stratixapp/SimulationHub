/* ============================================================
   CADENCE — SVG demand chart (no external libraries)
   ============================================================ */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // points: [{x:index, y:value|null, kind:'actual'|'fitted'|'forecast'|'revealed'}]
  function renderChart(svg, opts) {
    const { periods, actual, fitted, forecast, revealed, forecastStart, unit } = opts;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const W = 900, H = 340, padL = 54, padR = 18, padT = 18, padB = 34;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const totalPoints = periods.length;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const xStep = plotW / Math.max(1, totalPoints - 1);
    const x = (i) => padL + i * xStep;

    const allVals = [];
    actual.forEach((v) => v !== null && allVals.push(v));
    fitted.forEach((v) => v !== null && allVals.push(v));
    forecast.forEach((v) => v !== null && allVals.push(v));
    revealed.forEach((v) => v !== null && allVals.push(v));
    let maxV = Math.max(1, ...allVals);
    let minV = Math.min(0, ...allVals);
    maxV = maxV * 1.12;
    const y = (v) => padT + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;

    // gridlines + y labels
    const gridN = 4;
    for (let g = 0; g <= gridN; g++) {
      const v = minV + ((maxV - minV) * g) / gridN;
      const gy = y(v);
      svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: gy, y2: gy, class: 'gl' }));
      const t = el('text', { x: padL - 8, y: gy + 3, class: 'axlbl', 'text-anchor': 'end' });
      t.textContent = Math.round(v).toLocaleString('en-IN');
      svg.appendChild(t);
    }

    // x labels (every ~3rd month to avoid crowding)
    const step = Math.ceil(totalPoints / 12);
    periods.forEach((p, i) => {
      if (i % step !== 0 && i !== totalPoints - 1) return;
      const t = el('text', { x: x(i), y: H - 10, class: 'axlbl', 'text-anchor': 'middle' });
      t.textContent = p.split(' ')[0] + " '" + p.split(' ')[1].slice(2);
      svg.appendChild(t);
    });

    // forecast-start divider
    if (forecastStart !== null && forecastStart < totalPoints) {
      svg.appendChild(el('line', {
        x1: x(forecastStart), x2: x(forecastStart), y1: padT, y2: padT + plotH, class: 'divider'
      }));
      const lbl = el('text', { x: x(forecastStart) + 5, y: padT + 12, class: 'axlbl accent' });
      lbl.textContent = 'FORECAST →';
      svg.appendChild(lbl);
    }

    function path(values, cls, dashed) {
      let d = '';
      let started = false;
      values.forEach((v, i) => {
        if (v === null || v === undefined) { started = false; return; }
        d += (started ? ' L ' : ' M ') + x(i).toFixed(1) + ' ' + y(v).toFixed(1);
        started = true;
      });
      if (!d) return;
      const p = el('path', { d: d.trim(), class: cls });
      if (dashed) p.setAttribute('stroke-dasharray', '6 5');
      svg.appendChild(p);
    }

    // fitted (backcast) line — thin, muted
    path(fitted, 'ln-fitted');
    // actual history — solid cyan
    path(actual, 'ln-actual');
    // revealed future actuals (rolling reveal) — solid, slightly different marker
    path(revealed, 'ln-revealed');
    // forecast — dashed amber
    path(forecast, 'ln-forecast', true);

    // dots on actual + revealed
    function dots(values, cls) {
      values.forEach((v, i) => {
        if (v === null || v === undefined) return;
        svg.appendChild(el('circle', { cx: x(i), cy: y(v), r: 2.6, class: cls }));
      });
    }
    dots(actual, 'dot-actual');
    dots(revealed, 'dot-revealed');
    dots(forecast, 'dot-forecast');

    // hover targets
    periods.forEach((p, i) => {
      const hit = el('rect', {
        x: x(i) - xStep / 2, y: padT, width: xStep, height: plotH, class: 'hit'
      });
      hit.addEventListener('mouseenter', () => {
        opts.onHover && opts.onHover(i);
      });
      hit.addEventListener('mouseleave', () => {
        opts.onHover && opts.onHover(null);
      });
      svg.appendChild(hit);
    });
  }

  // Inventory sawtooth: points=[{day,level}], rop, safetyStock, unit label
  function renderInventoryChart(svg, opts) {
    const { points, rop, safetyStock, unit, onHover } = opts;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const W = 900, H = 320, padL = 60, padR = 18, padT = 18, padB = 30;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxDay = points[points.length - 1].day;
    const x = (d) => padL + (d / (maxDay || 1)) * plotW;
    const maxLevel = Math.max(...points.map((p) => p.level), rop) * 1.1;
    const y = (v) => padT + plotH - (v / (maxLevel || 1)) * plotH;

    const gridN = 4;
    for (let g = 0; g <= gridN; g++) {
      const v = (maxLevel * g) / gridN;
      const gy = y(v);
      svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: gy, y2: gy, class: 'gl' }));
      const t = el('text', { x: padL - 8, y: gy + 3, class: 'axlbl', 'text-anchor': 'end' });
      t.textContent = Math.round(v).toLocaleString('en-IN');
      svg.appendChild(t);
    }
    for (let d = 0; d <= maxDay; d += 14) {
      const t = el('text', { x: x(d), y: H - 8, class: 'axlbl', 'text-anchor': 'middle' });
      t.textContent = 'D' + d;
      svg.appendChild(t);
    }

    // filled area under the inventory line
    let areaD = 'M ' + x(0).toFixed(1) + ' ' + y(0).toFixed(1);
    points.forEach((p) => { areaD += ' L ' + x(p.day).toFixed(1) + ' ' + y(p.level).toFixed(1); });
    areaD += ' L ' + x(maxDay).toFixed(1) + ' ' + y(0).toFixed(1) + ' Z';
    svg.appendChild(el('path', { d: areaD, class: 'inv-fill' }));

    // reorder point + safety stock reference lines
    svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: y(rop), y2: y(rop), class: 'ln-inv-rop' }));
    const ropLbl = el('text', { x: W - padR, y: y(rop) - 5, class: 'axlbl accent', 'text-anchor': 'end' });
    ropLbl.textContent = 'Reorder point: ' + Math.round(rop).toLocaleString('en-IN');
    svg.appendChild(ropLbl);

    svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: y(safetyStock), y2: y(safetyStock), class: 'ln-inv-ss' }));
    const ssLbl = el('text', { x: W - padR, y: y(safetyStock) + 12, class: 'axlbl danger', 'text-anchor': 'end' });
    ssLbl.textContent = 'Safety stock: ' + Math.round(safetyStock).toLocaleString('en-IN');
    svg.appendChild(ssLbl);

    // main sawtooth line
    let d = '';
    points.forEach((p, i) => { d += (i === 0 ? 'M ' : ' L ') + x(p.day).toFixed(1) + ' ' + y(p.level).toFixed(1); });
    svg.appendChild(el('path', { d, class: 'ln-inv-position' }));

    points.forEach((p) => {
      const hit = el('rect', { x: x(p.day) - 6, y: padT, width: 12, height: plotH, class: 'hit' });
      hit.addEventListener('mouseenter', () => onHover && onHover(p));
      hit.addEventListener('mouseleave', () => onHover && onHover(null));
      svg.appendChild(hit);
    });
  }

  // Horizontal ranked bar chart. items: [{label, value, color}], sorted desc by caller.
  function renderBarChart(svg, opts) {
    const { items, maxValue, unit, target } = opts;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const rowH = 28, padL = 150, padR = 70, padT = 10, padB = 10;
    const W = 900, H = padT + padB + items.length * rowH;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const plotW = W - padL - padR;
    const max = maxValue || Math.max(...items.map((i) => i.value)) * 1.05;
    const xw = (v) => (v / (max || 1)) * plotW;

    items.forEach((it, i) => {
      const rowY = padT + i * rowH;
      const lbl = el('text', { x: padL - 10, y: rowY + rowH / 2 + 4, class: 'axlbl', 'text-anchor': 'end' });
      lbl.textContent = it.label;
      svg.appendChild(lbl);

      svg.appendChild(el('rect', { x: padL, y: rowY + 5, width: plotW, height: rowH - 12, rx: 4, class: 'gl', fill: 'none', stroke: 'none' }));
      const bg = el('rect', { x: padL, y: rowY + 5, width: plotW, height: rowH - 12, rx: 4 });
      bg.setAttribute('fill', 'rgba(255,255,255,.03)');
      svg.appendChild(bg);

      const bar = el('rect', { x: padL, y: rowY + 5, width: Math.max(2, xw(it.value)), height: rowH - 12, rx: 4 });
      bar.setAttribute('fill', it.color || '#3ddcc7');
      svg.appendChild(bar);

      const vlbl = el('text', { x: padL + xw(it.value) + 8, y: rowY + rowH / 2 + 4, class: 'axlbl' });
      vlbl.textContent = it.value.toFixed(1) + (unit || '');
      svg.appendChild(vlbl);
    });

    if (typeof target === 'number') {
      const tx = padL + xw(target);
      svg.appendChild(el('line', { x1: tx, x2: tx, y1: padT, y2: H - padB, class: 'ln-inv-rop' }));
    }
  }

  // Monthly demand bars vs a flat supply-capacity line. Bars turn red where
  // demand exceeds capacity for that month (unmet demand / gap).
  function renderSupplyDemandChart(svg, opts) {
    const { periods, demand, capacity } = opts;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const W = 900, H = 320, padL = 60, padR = 18, padT = 18, padB = 34;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const n = periods.length;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const slot = plotW / n;
    const barW = slot * 0.5;
    const x = (i) => padL + i * slot + slot / 2;
    const maxV = Math.max(...demand, ...capacity) * 1.15 || 1;
    const y = (v) => padT + plotH - (v / maxV) * plotH;
    const base = padT + plotH;

    const gridN = 4;
    for (let g = 0; g <= gridN; g++) {
      const v = (maxV * g) / gridN;
      const gy = y(v);
      svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: gy, y2: gy, class: 'gl' }));
      const t = el('text', { x: padL - 8, y: gy + 3, class: 'axlbl', 'text-anchor': 'end' });
      t.textContent = Math.round(v).toLocaleString('en-IN');
      svg.appendChild(t);
    }

    demand.forEach((v, i) => {
      const over = v > capacity[i];
      const bh = Math.max(1, base - y(v));
      const bar = el('rect', { x: x(i) - barW / 2, y: y(v), width: barW, height: bh, rx: 3 });
      bar.setAttribute('fill', over ? '#e5484d' : '#3ddcc7');
      bar.setAttribute('fill-opacity', over ? '0.85' : '0.8');
      svg.appendChild(bar);

      const t = el('text', { x: x(i), y: H - 10, class: 'axlbl', 'text-anchor': 'middle' });
      t.textContent = periods[i].split(' ')[0] + " '" + periods[i].split(' ')[1].slice(2);
      svg.appendChild(t);
    });

    let capD = '';
    capacity.forEach((v, i) => { capD += (i === 0 ? 'M ' : ' L ') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });
    const capLine = el('path', { d: capD, class: 'ln-inv-rop' });
    svg.appendChild(capLine);
  }

  window.CADENCE_CHART = { renderChart, renderInventoryChart, renderBarChart, renderSupplyDemandChart };
})();
