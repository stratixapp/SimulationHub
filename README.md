# Dot Ecosystem — Institute Training Simulator Hub

Single-page launcher for the Dot Ecosystem training simulator suite. Open
`index.html` (GitHub Pages serves this automatically as the site root).

## Structure
```
index.html                 → the hub itself
favicon.ico / favicon-*.png
uae-vat/                   → UAE VAT & Tax Training Simulator (entry: login.html)
gst-simulator/              → GST Portal Training Simulator (entry: index.html)
office-administration/      → OATS — Office Administration Training Simulator (entry: index.html)
hr-payroll/                 → SKELORA HR & Payroll Simulator (entry: index.html)
procurement-simulator/      → Procurement & Purchase-to-Pay Simulator (entry: index.html)
```

## Not yet connected
This card is on the hub but still points at a placeholder path — the
real project files weren't available when this package was built:
- Full ERP Simulator → expects `./full-erp-simulator/index.html`

## Connected
- Logistics Simulator → `./logistics-simulator/index.html` (Skelora, merged build v14)
- UAE VAT & Tax Training Simulator → `./uae-vat/index.html` (v27, with the
  Box 8 total fix, session-timeout, card-decline simulation, and
  accessibility pass)
- Supply Chain Analysis (Cadence) → `./cadence-supply-chain/index.html`
  (Demand Planning Workbench — forecasting, EOQ/safety stock, KPI center,
  S&OP planner)
- `shared/suite-auth.js` — a small cross-app account bridge Cadence and
  TCOS both read, so signing in via TCOS is recognized by Cadence too
  without a second login screen (same-origin hosting required for this
  to work; harmless no-op if missing).

Drop the remaining project's files into a folder with the exact name
above at the repo root and the matching card will start working
immediately — no other changes needed.

## Editing simulator info
Open `index.html` and search for `const SIMULATORS = [` — each entry's
`name`, `desc`, and `path` can be edited directly.

## Deploying to GitHub Pages
1. Push this folder's contents to a GitHub repo (root, or a `/docs` folder).
2. Repo → Settings → Pages → set source to that location.
3. GitHub Pages is case-sensitive — keep folder/file names exactly as-is.

© 2026–2030 Dot Ecosystem. Developed by Ananthu Shaji.
