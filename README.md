# Dot Ecosystem — Institute Training Simulator Hub

Single-page launcher for the Dot Ecosystem training simulator suite. Open
`index.html` (GitHub Pages serves this automatically as the site root).

## Structure
```
index.html                  -> the hub itself (cards are listed in `const SIMULATORS = [`)
install.html                -> first-run "Enterprise Deployment" wizard
sw.js / manifest.json       -> hub service worker + PWA manifest (icons and favicons at the root)
shared/                     -> code shared by several simulators
  access-id.js              -> the access / developer code check (stored as a hash)
  tcos-bridge.js            -> Logistics <-> TCOS single sign-on + data hand-off
  suite-auth.js             -> cross-app account bridge (Cadence and TCOS)
  vendor/                   -> third-party libraries (Chart.js, jsPDF, html2canvas, JSZip, SheetJS)
logistics-simulator/        -> Skelora Logistics Simulator (entry: index.html)
emirates-tax-portal/        -> Emirates Tax Portal, UAE VAT + Corporate Tax (entry: index.html)
tcos/                       -> TCOS, India Trade & Customs Operations Simulator, incl. Consignia Desk
gst-simulator/              -> GST Portal Training Simulator
office-administration/      -> OATS, Office Administration Training Simulator
hr-payroll/                 -> SKELORA HR & Payroll Simulator
procurement-simulator/      -> Procurement & Purchase-to-Pay Simulator
full-erp-simulator/         -> Integrated ERP Training Simulator
cadence-supply-chain/       -> Cadence, Demand Planning & Supply Chain Simulator
supplychain-tcos/           -> copy of TCOS bundled with the Cadence suite (separate saved progress)
```
All ten hub cards point at an existing folder. GitHub Pages is case-sensitive,
so keep folder and file names exactly as they are.

## Access codes
- Restricted cards (TCOS, Cadence, Cadence-suite TCOS) ask for the 9-digit access ID in the hub.
- The Logistics -> TCOS bridge asks for the same ID, and Lyra (the Logistics assistant)
  asks for it as her developer code every time she is opened.
- All of them are checked by `shared/access-id.js`; there is no plain-text copy of the code anywhere.
  To change it, replace `CODE_HASH` in that one file (the file explains how).
- This is checked in the browser, so it keeps students out but is not real security.
  The code is a 9-digit number and the hash is a fast non-cryptographic one, so anyone who reads the
  hash can recover the code offline in seconds. Treat it as a classroom gate, never as protection for
  anything confidential. Real protection would need a server-side check.

## supplychain-tcos
It is the same program as `tcos/` with its own saved progress. The only intended differences are
three storage keys (`SESSION_KEY`, `STORAGE_PREFIX` in `js/state.js`, `REGISTERED_USERS_KEY` in
`js/app.js`). When you update `tcos/js/`, copy the files over and keep those three lines.

## Editing simulator info
Open `index.html` and search for `const SIMULATORS = [` — each entry's `name`, `desc` and `path`
can be edited directly.

## First-run install wizard
- `index.html` redirects to `install.html` until the key `dot_hub_installed_v1` exists in this
  browser's localStorage. The key is saved when the 60-second deployment finishes; **Launch** then
  opens the hub (and, where the browser offers it, the native "Install app" dialog).
- Bypass for staff: open `index.html?skipinstall=1`. To run the wizard again: open `install.html`
  or delete the key.
- If storage is blocked (private mode) the hub never redirects, so nobody is trapped in a loop.
- The wizard registers the hub service worker, so the hub and wizard open offline afterwards.
- Developer Verification page: the name is checked in the page itself (client-side) and any
  non-empty code is accepted.

## Service workers (important when adding or editing a simulator)
Every app on one origin shares the same browser CacheStorage. So each service worker must only delete
OLD caches that carry ITS OWN prefix, never "everything that is not mine" (that wipes the other apps'
offline caches). Current prefixes:
`dot-ecosystem-hub-` (hub), `vatsim-cache-` (Emirates), `oats-cache-` (Office Admin),
`skelora-v<number>` (Logistics), `skelora-hr-` (HR & Payroll), `dot-erp-` (Full ERP), `gst-simulator-pwa-` (GST).
A new simulator needs its own unique prefix and the same filter in its `activate` handler.
`shared/access-id.js` is network-first in the hub worker, so a changed code reaches students on the next load.

## Deploying to GitHub Pages
1. Push this folder's contents to a GitHub repo (root, or a `/docs` folder).
2. Repo -> Settings -> Pages -> set source to that location.

(c) 2026-2030 Dot Ecosystem. Developed by Ananthu Shaji.
