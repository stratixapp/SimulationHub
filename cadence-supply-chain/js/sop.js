/* ============================================================
   CADENCE — S&OP Scenario Planner engine
   Layers a scenario adjustment on top of the statistical baseline
   (best-fit method from the Demand module) and compares it to a
   supply/capacity plan to surface gaps and revenue at risk —
   the core Demand Review -> Supply Review -> Reconciliation loop.
   ============================================================ */
(function () {
  'use strict';
  const D = window.CADENCE_DATA;
  const F = window.CADENCE_FORECAST;

  // approximate category sell-through margin over landed unit cost
  const MARKUP = { ELEC: 1.35, FMCG: 1.22, PHARMA: 1.55, APPAREL: 1.65, AUTO: 1.30 };

  const SCENARIOS = {
    conservative: { key: 'conservative', label: 'Conservative', pct: -15 },
    base: { key: 'base', label: 'Base', pct: 0 },
    optimistic: { key: 'optimistic', label: 'Optimistic', pct: 20 }
  };

  function sellPrice(sku) { return sku.unitCost * (MARKUP[sku.cat] || 1.3); }

  // best-fit statistical baseline forecast for the next `horizon` months
  function baselineForecast(values, horizon) {
    const M = window.CADENCE_METRICS;
    let best = null;
    Object.keys(F.METHODS).forEach((k) => {
      const defParams = {};
      F.METHODS[k].params.forEach((p) => { defParams[p.key] = p.def; });
      const r = F.run(k, values, defParams, horizon);
      const m = M.computeMetrics(values, r.fitted);
      if (m.mape !== null && (best === null || m.mape < best.mape)) {
        best = { key: k, forecast: r.forecast, mape: m.mape, label: F.METHODS[k].name };
      }
    });
    return best || { key: 'ses', forecast: new Array(horizon).fill(values[values.length - 1]), mape: null, label: 'SES' };
  }

  function computeScenarioPlan(sku, values, horizon, scenarioPct, capacityPerMonth) {
    const baseline = baselineForecast(values, horizon);
    const demand = baseline.forecast.map((v) => Math.max(0, v * (1 + scenarioPct / 100)));
    const capacity = new Array(horizon).fill(capacityPerMonth);
    const gap = demand.map((v, i) => Math.max(0, v - capacity[i]));
    const totalDemand = demand.reduce((a, b) => a + b, 0);
    const totalCapacity = capacity.reduce((a, b) => a + b, 0);
    const totalGap = gap.reduce((a, b) => a + b, 0);
    const price = sellPrice(sku);
    return {
      methodLabel: baseline.label, demand, capacity, gap,
      totalDemand, totalCapacity, totalGap,
      revenuePlan: totalDemand * price, revenueAtRisk: totalGap * price, price
    };
  }

  window.CADENCE_SOP = { SCENARIOS, MARKUP, sellPrice, baselineForecast, computeScenarioPlan };
})();
