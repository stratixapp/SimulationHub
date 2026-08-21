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
These four cards are on the hub but still point at placeholder paths —
the real project files weren't available when this package was built:
- Logistics Simulator → expects `./logistics-simulator/index.html`
- Export Import Workflow (TCOS) → expects `./tcos/index.html`
- Full ERP Simulator → expects `./full-erp-simulator/index.html`
- Supply Chain Analysis (Cadence) → expects `./cadence-supply-chain/index.html`

Drop each project's files into a folder with that exact name at the repo
root and the matching card will start working immediately — no other
changes needed.

## Editing simulator info
Open `index.html` and search for `const SIMULATORS = [` — each entry's
`name`, `desc`, and `path` can be edited directly.

## Deploying to GitHub Pages
1. Push this folder's contents to a GitHub repo (root, or a `/docs` folder).
2. Repo → Settings → Pages → set source to that location.
3. GitHub Pages is case-sensitive — keep folder/file names exactly as-is.

© 2026–2030 Dot Ecosystem. Developed by Ananthu Shaji.
