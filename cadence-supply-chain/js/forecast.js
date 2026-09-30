/* ============================================================
   CADENCE — forecasting engine
   Every method returns { fitted: number[]|null[], forecast: number[] }
   fitted[i] is null wherever the method has no one-step-ahead
   estimate yet (warm-up period) — metrics.js skips those.
   ============================================================ */
(function () {
  'use strict';

  function simpleMovingAverage(values, params, horizon) {
    const n = Math.max(2, Math.min(12, params.window || 3));
    const fitted = values.map((_, i) => {
      if (i < n) return null;
      let sum = 0;
      for (let k = i - n; k < i; k++) sum += values[k];
      return sum / n;
    });
    let tail = values.slice(-n);
    const lastAvg = tail.reduce((a, b) => a + b, 0) / tail.length;
    const forecast = new Array(horizon).fill(lastAvg);
    return { fitted, forecast, label: 'SMA(' + n + ')' };
  }

  function weightedMovingAverage(values, params, horizon) {
    const n = Math.max(2, Math.min(12, params.window || 3));
    const weights = [];
    for (let w = 1; w <= n; w++) weights.push(w);
    const wSum = weights.reduce((a, b) => a + b, 0);
    const fitted = values.map((_, i) => {
      if (i < n) return null;
      let sum = 0;
      for (let k = 0; k < n; k++) sum += values[i - n + k] * weights[k];
      return sum / wSum;
    });
    let sum = 0;
    for (let k = 0; k < n; k++) sum += values[values.length - n + k] * weights[k];
    const lastWavg = sum / wSum;
    const forecast = new Array(horizon).fill(lastWavg);
    return { fitted, forecast, label: 'WMA(' + n + ')' };
  }

  function simpleExpSmoothing(values, params, horizon) {
    const alpha = clamp01(params.alpha, 0.3);
    let level = values[0];
    const fitted = [null];
    for (let i = 1; i < values.length; i++) {
      fitted.push(level);
      level = alpha * values[i] + (1 - alpha) * level;
    }
    const forecast = new Array(horizon).fill(level);
    return { fitted, forecast, label: 'SES(α=' + alpha.toFixed(2) + ')' };
  }

  function holtLinear(values, params, horizon) {
    const alpha = clamp01(params.alpha, 0.3);
    const beta = clamp01(params.beta, 0.15);
    let level = values[0];
    let trend = values.length > 1 ? values[1] - values[0] : 0;
    const fitted = [null];
    for (let i = 1; i < values.length; i++) {
      fitted.push(level + trend);
      const prevLevel = level;
      level = alpha * values[i] + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }
    const forecast = [];
    for (let h = 1; h <= horizon; h++) forecast.push(Math.max(0, level + h * trend));
    return { fitted, forecast, label: 'Holt(α=' + alpha.toFixed(2) + ',β=' + beta.toFixed(2) + ')' };
  }

  function holtWinters(values, params, horizon) {
    const L = 12;
    const alpha = clamp01(params.alpha, 0.25);
    const beta = clamp01(params.beta, 0.10);
    const gamma = clamp01(params.gamma, 0.25);
    if (values.length < L * 2) {
      // not enough history for a seasonal model yet — fall back gracefully
      return holtLinear(values, params, horizon);
    }
    // init: average level of first season, trend from first two seasons,
    // seasonal indices from ratio to first-season average
    const firstSeason = values.slice(0, L);
    const secondSeason = values.slice(L, 2 * L);
    const avg1 = firstSeason.reduce((a, b) => a + b, 0) / L;
    const avg2 = secondSeason.reduce((a, b) => a + b, 0) / L;
    let level = avg1;
    let trend = (avg2 - avg1) / L;
    let seasonal = firstSeason.map((v) => (avg1 === 0 ? 1 : v / avg1));

    const fitted = new Array(L).fill(null);
    for (let i = L; i < values.length; i++) {
      const s = seasonal[i % L];
      fitted.push((level + trend) * s);
      const prevLevel = level;
      level = alpha * (values[i] / (s || 1)) + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
      seasonal[i % L] = gamma * (values[i] / (level || 1)) + (1 - gamma) * s;
    }
    const forecast = [];
    for (let h = 1; h <= horizon; h++) {
      const idx = (values.length + h - 1) % L;
      forecast.push(Math.max(0, (level + h * trend) * seasonal[idx]));
    }
    return { fitted, forecast, label: 'Holt-Winters(α=' + alpha.toFixed(2) + ',β=' + beta.toFixed(2) + ',γ=' + gamma.toFixed(2) + ')' };
  }

  function clamp01(v, fallback) {
    v = (typeof v === 'number' && !isNaN(v)) ? v : fallback;
    return Math.max(0.01, Math.min(0.99, v));
  }

  const METHODS = {
    sma: { key: 'sma', name: 'Moving Average', fn: simpleMovingAverage,
      params: [{ key: 'window', label: 'Window (months)', min: 2, max: 12, step: 1, def: 3 }] },
    wma: { key: 'wma', name: 'Weighted Moving Avg', fn: weightedMovingAverage,
      params: [{ key: 'window', label: 'Window (months)', min: 2, max: 12, step: 1, def: 3 }] },
    ses: { key: 'ses', name: 'Simple Exp. Smoothing', fn: simpleExpSmoothing,
      params: [{ key: 'alpha', label: 'α — level weight', min: 0.05, max: 0.95, step: 0.05, def: 0.3 }] },
    holt: { key: 'holt', name: "Holt's Linear Trend", fn: holtLinear,
      params: [
        { key: 'alpha', label: 'α — level weight', min: 0.05, max: 0.95, step: 0.05, def: 0.3 },
        { key: 'beta', label: 'β — trend weight', min: 0.05, max: 0.95, step: 0.05, def: 0.15 }
      ] },
    hw: { key: 'hw', name: 'Holt-Winters (Seasonal)', fn: holtWinters,
      params: [
        { key: 'alpha', label: 'α — level weight', min: 0.05, max: 0.95, step: 0.05, def: 0.25 },
        { key: 'beta', label: 'β — trend weight', min: 0.05, max: 0.95, step: 0.05, def: 0.10 },
        { key: 'gamma', label: 'γ — seasonal weight', min: 0.05, max: 0.95, step: 0.05, def: 0.25 }
      ] }
  };

  window.CADENCE_FORECAST = { METHODS, run: (methodKey, values, params, horizon) => METHODS[methodKey].fn(values, params || {}, horizon) };
})();
