// ─────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────
const Format = {
  inr(n, compact) {
    if (compact) {
      if (Math.abs(n) >= 10000000) return '₹' + (n / 10000000).toFixed(2) + 'Cr';
      if (Math.abs(n) >= 100000) return '₹' + (n / 100000).toFixed(2) + 'L';
      if (Math.abs(n) >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
    }
    return '₹' + n.toLocaleString('en-IN');
  },

  relativeDate(iso) {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffDays = Math.round((now - then) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays === -1) return 'Tomorrow';
    if (diffDays > 1) return diffDays + 'd ago';
    return 'in ' + Math.abs(diffDays) + 'd';
  },

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};
