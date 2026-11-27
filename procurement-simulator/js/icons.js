// ─────────────────────────────────────────────────────────────
// Minimal inline SVG icon set — no external icon library.
// Each fn takes an optional size (px) and returns an <svg> string.
// ─────────────────────────────────────────────────────────────
const Icon = {
  _wrap(size, inner) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  },
  dashboard(s = 15) { return this._wrap(s, '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'); },
  clipboard(s = 15) { return this._wrap(s, '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 3h6v3H9z"/><path d="M9 10h6M9 14h6"/>'); },
  file(s = 15) { return this._wrap(s, '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'); },
  gitBranch(s = 15) { return this._wrap(s, '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M6 12c4 0 6-3 10-3"/>'); },
  wallet(s = 15) { return this._wrap(s, '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="14" r="1.2"/>'); },
  building(s = 15) { return this._wrap(s, '<rect x="4" y="3" width="16" height="18"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/>'); },
  send(s = 15) { return this._wrap(s, '<path d="M4 4l17 8-17 8 4-8z"/>'); },
  fileSearch(s = 15) { return this._wrap(s, '<path d="M6 3h8l4 4v14H6z"/><circle cx="10" cy="14" r="2"/><path d="M11.5 15.5L14 18"/>'); },
  scale(s = 15) { return this._wrap(s, '<path d="M12 3v18M5 8l-3 6a3 3 0 006 0zM19 8l-3 6a3 3 0 006 0zM5 8h14M9 3h6"/>'); },
  award(s = 15) { return this._wrap(s, '<circle cx="12" cy="8" r="5"/><path d="M8.5 12.5L7 21l5-3 5 3-1.5-8.5"/>'); },
  cart(s = 15) { return this._wrap(s, '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2 3h2l2.4 12.2a2 2 0 002 1.8h8.6a2 2 0 002-1.6L21 8H6"/>'); },
  truck(s = 15) { return this._wrap(s, '<rect x="1" y="6" width="13" height="10"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="6" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>'); },
  packageCheck(s = 15) { return this._wrap(s, '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'); },
  receipt(s = 15) { return this._wrap(s, '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'); },
  landmark(s = 15) { return this._wrap(s, '<path d="M3 21h18M4 10h16M12 3l9 5H3z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/>'); },
  barChart(s = 15) { return this._wrap(s, '<path d="M4 20V10M12 20V4M20 20v-7"/>'); },
  lock(s = 11) { return this._wrap(s, '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 018 0v4"/>'); },
  search(s = 14) { return this._wrap(s, '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'); },
  bell(s = 16) { return this._wrap(s, '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>'); },
  check(s = 13) { return this._wrap(s, '<path d="M20 6L9 17l-5-5"/>'); },
  x(s = 13) { return this._wrap(s, '<path d="M18 6L6 18M6 6l12 12"/>'); },
  alertTriangle(s = 13) { return this._wrap(s, '<path d="M12 3l10 18H2z"/><path d="M12 10v4"/><circle cx="12" cy="17.3" r="0.6" fill="currentColor"/>'); },
  info(s = 13) { return this._wrap(s, '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="8" r="0.6" fill="currentColor"/>'); },
  alertOctagon(s = 13) { return this._wrap(s, '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M12 8v5"/><circle cx="12" cy="16.3" r="0.6" fill="currentColor"/>'); },
  helpCircle(s = 15) { return this._wrap(s, '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 2-3 4"/><circle cx="12" cy="17.3" r="0.6" fill="currentColor"/>'); },
  download(s = 15) { return this._wrap(s, '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>'); },
  upload(s = 15) { return this._wrap(s, '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 19h16"/>'); },
  refreshCcw(s = 15) { return this._wrap(s, '<path d="M3 12a9 9 0 0115.3-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15.3 6.4L3 16"/><path d="M3 21v-5h5"/>'); },
  arrowRight(s = 13) { return this._wrap(s, '<path d="M5 12h14M13 6l6 6-6 6"/>'); },
  logout(s = 15) { return this._wrap(s, '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'); },
  settings(s = 15) { return this._wrap(s, '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.04 1.56V21a2 2 0 01-4 0v-.09A1.7 1.7 0 009 19.4a1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.56-1.04H3a2 2 0 010-4h.09A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001.04-1.56V3a2 2 0 014 0v.09A1.7 1.7 0 0015 4.6a1.7 1.7 0 001.87.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9a1.7 1.7 0 001.56 1.04H21a2 2 0 010 4h-.09A1.7 1.7 0 0019.4 15z"/>'); },
  users(s = 15) { return this._wrap(s, '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>'); },
  book(s = 15) { return this._wrap(s, '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>'); },
};
