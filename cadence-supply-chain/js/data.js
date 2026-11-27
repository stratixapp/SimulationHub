/* ============================================================
   CADENCE — synthetic demand dataset
   Deterministic (seeded PRNG) so every trainee sees identical
   data and results are reproducible/gradeable.
   ============================================================ */
(function () {
  'use strict';

  // ---- seeded PRNG (mulberry32) + gaussian noise ----
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gaussian(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function normalizeSeason(raw) {
    const sum = raw.reduce((a, b) => a + b, 0);
    const factor = 12 / sum;
    return raw.map((v) => v * factor);
  }

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const CATEGORIES = {
    ELEC: { label: 'Electronics', color: '#3ddcc7' },
    FMCG: { label: 'FMCG', color: '#f0a83c' },
    PHARMA: { label: 'Pharma', color: '#8b7ff0' },
    APPAREL: { label: 'Apparel', color: '#e5484d' },
    AUTO: { label: 'Auto Parts', color: '#5aa9e6' }
  };

  // raw[] = Jan..Dec seasonal multipliers (unnormalized, normalized below)
  // unitCost = approx landed cost per unit/case/carton in INR (for inventory carrying-cost calcs)
  const SKU_DEFS = [
    { id: 'ELE-TV43', name: 'LED TV 43"', cat: 'ELEC', uom: 'units', base: 420, trend: 3.0, noise: 0.13, lead: 21, unitCost: 18000,
      raw: [1.1,1.3,0.9,0.8,0.8,0.8,0.8,0.9,1.0,1.6,1.8,1.3] },
    { id: 'ELE-BTSPK', name: 'Bluetooth Speaker', cat: 'ELEC', uom: 'units', base: 650, trend: 5.0, noise: 0.14, lead: 18, unitCost: 1500,
      raw: [0.9,0.8,0.8,0.8,0.9,0.9,0.9,1.0,1.0,1.4,1.7,1.9] },
    { id: 'ELE-PWBK', name: 'Power Bank 10000mAh', cat: 'ELEC', uom: 'units', base: 800, trend: 9.0, noise: 0.12, lead: 16, unitCost: 900,
      raw: [0.95,0.9,0.9,0.9,0.95,0.95,0.95,1.0,1.05,1.3,1.5,1.3] },
    { id: 'FMC-RICE', name: 'Basmati Rice 5kg', cat: 'FMCG', uom: 'cases', base: 1500, trend: 1.0, noise: 0.06, lead: 7, unitCost: 550,
      raw: [0.95,0.95,1.0,1.0,1.0,1.0,1.0,1.0,1.05,1.15,1.3,1.1] },
    { id: 'FMC-OIL', name: 'Cooking Oil 1L', cat: 'FMCG', uom: 'cases', base: 2200, trend: 0.0, noise: 0.06, lead: 7, unitCost: 140,
      raw: [0.95,0.95,1.0,1.0,1.0,1.0,1.0,1.0,1.05,1.2,1.35,1.05] },
    { id: 'FMC-NOOD', name: 'Instant Noodles Pack', cat: 'FMCG', uom: 'cases', base: 1800, trend: -4.0, noise: 0.07, lead: 5, unitCost: 120,
      raw: [0.95,0.9,0.9,0.95,1.0,1.15,1.2,1.1,1.0,1.0,0.95,0.95] },
    { id: 'PHM-PARA', name: 'Paracetamol 500mg', cat: 'PHARMA', uom: 'cartons', base: 3000, trend: 2.0, noise: 0.09, lead: 10, unitCost: 800,
      raw: [1.15,1.05,0.9,0.8,0.8,1.1,1.25,1.2,0.95,0.85,1.0,1.15] },
    { id: 'PHM-VITC', name: 'Vitamin C Tablets', cat: 'PHARMA', uom: 'cartons', base: 1200, trend: 10.0, noise: 0.10, lead: 10, unitCost: 650,
      raw: [1.2,1.0,0.85,0.8,0.8,1.05,1.15,1.1,0.9,0.85,0.95,1.2] },
    { id: 'PHM-ANTI', name: 'Antiseptic Liquid', cat: 'PHARMA', uom: 'cartons', base: 900, trend: 3.0, noise: 0.08, lead: 9, unitCost: 300,
      raw: [0.9,0.9,0.95,1.0,1.05,1.2,1.25,1.1,0.95,0.9,0.85,0.95] },
    { id: 'APP-TSHRT', name: 'Cotton T-Shirt', cat: 'APPAREL', uom: 'units', base: 1100, trend: 2.0, noise: 0.14, lead: 30, unitCost: 350,
      raw: [0.7,0.75,1.1,1.35,1.5,1.4,1.15,1.0,0.85,0.75,0.7,0.75] },
    { id: 'APP-JCKT', name: 'Winter Jacket', cat: 'APPAREL', uom: 'units', base: 700, trend: 1.0, noise: 0.16, lead: 35, unitCost: 1800,
      raw: [1.6,1.2,0.6,0.35,0.3,0.25,0.25,0.3,0.5,0.9,1.7,2.0] },
    { id: 'APP-SHIRT', name: 'Formal Shirt', cat: 'APPAREL', uom: 'units', base: 850, trend: -3.0, noise: 0.12, lead: 28, unitCost: 700,
      raw: [0.95,0.9,0.95,0.95,0.9,0.85,0.9,1.0,1.1,1.35,1.2,1.0] },
    { id: 'AUT-BRAKE', name: 'Brake Pad Set', cat: 'AUTO', uom: 'units', base: 480, trend: 2.0, noise: 0.09, lead: 14, unitCost: 1200,
      raw: [0.9,0.9,0.95,0.95,1.0,1.15,1.25,1.15,1.0,0.95,0.9,0.9] },
    { id: 'AUT-OIL4', name: 'Engine Oil 4L', cat: 'AUTO', uom: 'units', base: 1400, trend: 1.0, noise: 0.08, lead: 12, unitCost: 850,
      raw: [0.95,0.95,1.0,1.0,1.0,1.1,1.15,1.1,1.0,1.0,0.95,0.9] },
    { id: 'AUT-BATT', name: 'Car Battery 45Ah', cat: 'AUTO', uom: 'units', base: 380, trend: 2.0, noise: 0.10, lead: 15, unitCost: 4200,
      raw: [1.2,1.1,0.9,0.8,0.8,1.0,1.05,0.95,0.85,0.9,1.15,1.3] }
  ];

  const HIST_MONTHS = 24;   // visible history at app start
  const HIDDEN_MONTHS = 6;  // rolling "future actuals" revealed one at a time
  const START_YEAR = 2024, START_MONTH_IDX = 7; // Aug 2024 (0=Jan)

  function periodLabel(offset) {
    const total = START_MONTH_IDX + offset;
    const y = START_YEAR + Math.floor(total / 12);
    const m = total % 12;
    return { label: MONTH_NAMES[m] + ' ' + y, monthIdx: m, year: y };
  }

  const SKUS = [];
  const SERIES = {}; // id -> { history: [{period,value,monthIdx}], hidden: [...] }

  SKU_DEFS.forEach((def, skuOrdinal) => {
    const season = normalizeSeason(def.raw);
    const rng = mulberry32(0x9E3779B1 ^ (skuOrdinal * 2654435761));
    const totalMonths = HIST_MONTHS + HIDDEN_MONTHS;
    const values = [];
    for (let t = 0; t < totalMonths; t++) {
      const { label, monthIdx } = periodLabel(t);
      const level = def.base + def.trend * t;
      const seasonal = season[monthIdx];
      const noise = gaussian(rng) * def.noise * level;
      const value = Math.max(0, Math.round(level * seasonal + noise));
      values.push({ period: label, monthIdx, t, value });
    }
    SERIES[def.id] = {
      history: values.slice(0, HIST_MONTHS),
      hidden: values.slice(HIST_MONTHS)
    };
    SKUS.push({ id: def.id, name: def.name, cat: def.cat, uom: def.uom, lead: def.lead, unitCost: def.unitCost, noise: def.noise });
  });

  function stats(values) {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
    return { mean, std: Math.sqrt(variance) };
  }

  window.CADENCE_DATA = {
    CATEGORIES, SKUS, SERIES, HIST_MONTHS, HIDDEN_MONTHS,
    MONTH_NAMES, periodLabel, stats
  };
})();
