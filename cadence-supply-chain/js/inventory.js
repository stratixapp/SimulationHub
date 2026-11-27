/* ============================================================
   CADENCE — inventory optimization engine
   Classic deterministic-demand-with-safety-stock model:
   EOQ from the Wilson formula, safety stock sized off lead-time
   demand variability at a chosen service level.
   ============================================================ */
(function () {
  'use strict';
  const D = window.CADENCE_DATA;

  // service level -> Z score (standard normal, one-sided)
  const Z_TABLE = [
    { pct: 90, z: 1.28 },
    { pct: 95, z: 1.65 },
    { pct: 97.5, z: 1.96 },
    { pct: 99, z: 2.33 },
    { pct: 99.9, z: 3.09 }
  ];

  function zFor(pct) {
    let best = Z_TABLE[0];
    Z_TABLE.forEach((row) => { if (Math.abs(row.pct - pct) < Math.abs(best.pct - pct)) best = row; });
    return best.z;
  }

  // values: monthly demand history (units). leadDays: supplier lead time.
  // orderingCost: INR per PO. holdingPct: annual holding cost as % of unit value.
  // unitCost: INR. servicePct: target cycle service level.
  function computeInventoryPlan(values, opts) {
    const { leadDays, orderingCost, holdingPct, unitCost, servicePct } = opts;
    const st = D.stats(values);
    const avgMonthly = st.mean;
    const stdMonthly = st.std;
    const avgDaily = avgMonthly / 30;
    const stdDaily = stdMonthly / Math.sqrt(30);

    const annualDemand = avgMonthly * 12;
    const holdingCostPerUnit = Math.max(0.01, holdingPct / 100) * unitCost;

    const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit);
    const leadTimeDemandMean = avgDaily * leadDays;
    const leadTimeDemandStd = stdDaily * Math.sqrt(Math.max(1, leadDays));
    const z = zFor(servicePct);
    const safetyStock = z * leadTimeDemandStd;
    const reorderPoint = leadTimeDemandMean + safetyStock;

    const ordersPerYear = eoq > 0 ? annualDemand / eoq : 0;
    const cycleStock = eoq / 2;
    const avgInventory = cycleStock + safetyStock;
    const annualOrderingCost = ordersPerYear * orderingCost;
    const annualHoldingCost = avgInventory * holdingCostPerUnit;
    const annualCarryingValue = avgInventory * unitCost;
    const totalAnnualCost = annualOrderingCost + annualHoldingCost;
    const daysOfSupply = avgDaily > 0 ? avgInventory / avgDaily : 0;
    const cycleDays = ordersPerYear > 0 ? 365 / ordersPerYear : 0;

    return {
      avgMonthly, stdMonthly, avgDaily, stdDaily, annualDemand,
      eoq, leadTimeDemandMean, leadTimeDemandStd, safetyStock, reorderPoint, z,
      ordersPerYear, cycleStock, avgInventory, annualOrderingCost, annualHoldingCost,
      annualCarryingValue, totalAnnualCost, daysOfSupply, cycleDays, holdingCostPerUnit
    };
  }

  // Build a sawtooth inventory-position series over `weeks` weeks for the chart:
  // starts at reorderPoint + (eoq - what's been consumed since last order), simplified
  // to a clean repeating sawtooth from (eoq+safetyStock) down to safetyStock, with the
  // reorder point marked as a horizontal reference line.
  function buildSawtooth(plan, totalDays, stepDays) {
    const points = [];
    const cycleDays = Math.max(1, plan.cycleDays);
    const dailyRate = plan.avgDaily;
    let level = plan.eoq + plan.safetyStock;
    let sinceOrder = 0;
    for (let d = 0; d <= totalDays; d += stepDays) {
      if (sinceOrder >= cycleDays) { level = plan.eoq + plan.safetyStock; sinceOrder = 0; }
      points.push({ day: d, level: Math.max(plan.safetyStock * 0.15, level) });
      level -= dailyRate * stepDays;
      sinceOrder += stepDays;
    }
    return points;
  }

  window.CADENCE_INVENTORY = { computeInventoryPlan, buildSawtooth, Z_TABLE, zFor };
})();
