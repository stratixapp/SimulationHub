/* ============================================================
   CADENCE — KPI Command Center engine
   Synthesizes trailing-month operational performance (fill rate,
   OTIF, perfect order %) per SKU from its existing demand-noise
   and lead-time profile, deterministically seeded so results are
   stable across reloads. Combines with the Inventory module's
   turnover/days-of-supply output for a network rollup.
   ============================================================ */
(function () {
  'use strict';
  const D = window.CADENCE_DATA;

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Deterministic per-SKU operational performance for the trailing month.
  // Noisier demand + longer lead time => lower fill rate / OTIF, matching
  // real-world drivers of service failure.
  function operationalStats(sku, noisePct) {
    const rng = mulberry32(0xC0FFEE ^ (sku.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 97));
    const jitter = () => (rng() - 0.5) * 4;

    const fillRate = clamp(99.2 - noisePct * 100 * 0.55 - (sku.lead / 10) * 0.25 + jitter(), 78, 99.8);
    const otif = clamp(98.5 - (sku.lead / 4) - noisePct * 100 * 0.7 + jitter(), 65, 99.5);
    const qualityFactor = clamp(0.985 + (rng() - 0.5) * 0.02, 0.96, 0.999);
    const perfectOrder = clamp((fillRate / 100) * (otif / 100) * qualityFactor * 100, 50, 99.5);

    return { fillRate, otif, perfectOrder };
  }

  // invPlan: output of CADENCE_INVENTORY.computeInventoryPlan for this SKU
  function turnoverFor(sku, invPlan) {
    const cogsAnnual = invPlan.annualDemand * sku.unitCost;
    const avgInvValue = invPlan.avgInventory * sku.unitCost;
    const turns = avgInvValue > 0 ? cogsAnnual / avgInvValue : 0;
    return { turns, avgInvValue, cogsAnnual };
  }

  function grade(pct, goodAt, okAt) {
    if (pct >= goodAt) return 'good';
    if (pct >= okAt) return 'ok';
    if (pct >= okAt - 10) return 'warn';
    return 'bad';
  }

  window.CADENCE_KPI = { operationalStats, turnoverFor, grade };
})();
