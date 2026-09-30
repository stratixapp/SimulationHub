/* ============================================================
   CADENCE — accuracy metrics
   ============================================================ */
(function () {
  'use strict';

  function computeMetrics(actual, fitted) {
    let n = 0, sumAbsPct = 0, sumAbs = 0, sumErr = 0, sumSq = 0;
    for (let i = 0; i < actual.length; i++) {
      const f = fitted[i];
      if (f === null || f === undefined || isNaN(f)) continue;
      const a = actual[i];
      const err = a - f;
      n++;
      sumErr += err;
      sumAbs += Math.abs(err);
      sumSq += err * err;
      if (a !== 0) sumAbsPct += Math.abs(err / a);
    }
    if (n === 0) {
      return { n: 0, mape: null, mad: null, bias: null, rmse: null, accuracy: null };
    }
    const mape = (sumAbsPct / n) * 100;
    const mad = sumAbs / n;
    const bias = sumErr / n;
    const rmse = Math.sqrt(sumSq / n);
    const accuracy = Math.max(0, 100 - mape);
    return { n, mape, mad, bias, rmse, accuracy };
  }

  function grade(mape) {
    if (mape === null) return { label: 'N/A', tone: 'muted' };
    if (mape < 10) return { label: 'Excellent', tone: 'good' };
    if (mape < 20) return { label: 'Acceptable', tone: 'ok' };
    if (mape < 30) return { label: 'Weak', tone: 'warn' };
    return { label: 'Poor', tone: 'bad' };
  }

  window.CADENCE_METRICS = { computeMetrics, grade };
})();
