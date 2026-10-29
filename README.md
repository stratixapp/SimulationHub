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
logistics-simulator/        -> Skelora Logistics Simulator (entry: index.html = night-ship boot loader, then dashboard / intro)
  boot-loader/              -> the 3D loader: night-ship-scene.js, boot-loader.css, vendor/ (three.js r128 + post-processing), fonts/ (Montserrat)
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

## Logistics boot loader (night ship)
`logistics-simulator/index.html` is the app's entry point. It plays the 3D night-ship loader (Three.js scene in
`boot-loader/`), then `replace()`s to the dashboard (signed-in student) or `intro.html`.
- **Tunables** are the first block of the inline script in `index.html`: `LOADER_SECONDS` (default 12, keep it 11 or
  more), `HOLD_SECONDS` (berthed ship before the fade), `MIN_FPS`, `MAX_WAIT_MS`. Total time on screen is about
  `LOADER_SECONDS + HOLD_SECONDS + 0.5`. The progress ring is paced by time, and it waits at 99% (up to 8 s) until the next
  screen has been fetched.
- **Fallback**: the old light SVG ship is shown (about 3 s) when WebGL is missing, Save-Data is on, a script fails to load,
  the scene throws, or the WebGL context is lost. `prefers-reduced-motion` users get it for about 1.2 s. A device that cannot
  hold `MIN_FPS` even at pixel-ratio 1 leaves the animation early. After `MAX_WAIT_MS` the page navigates regardless.
- **Staff shortcut**: open `logistics-simulator/index.html?skiploader=1` to go straight through.
- **Offline**: three.js r128, its post-processing add-ons and Montserrat are bundled (licences sit beside them) and
  precached by `logistics-simulator/service-worker.js` (cache `skelora-v73`). Bump `CACHE_VERSION` whenever any file there changes.
- Scene text lives at the top of `boot-loader/night-ship-scene.js` (`TEXT`, `STAGES`); container shipping-line names are in `LINES`.
- The smaller ship loaders inside the app (PDF export, ZIP export, document-open transition) still use `ship-loader.css`.

## Logistics Login Monitor (faculty)
Administration -> **Login Monitor** (faculty accounts only). Shows the account signed in right now (Student ID + password) and
every sign-in on this computer: name, Student ID, password, role, signed-in / signed-out time and how long. Passwords are masked
until "Show passwords" (or a row's Show) is used. Entries come from `auth.js` (`skGetLoginLog`, key `skelora_login_log_v1`,
capped at 1000); failed attempts are not logged and nothing is recorded for sign-ins made before this feature existed. The
history travels in the Export/Import file so several lab PCs can be reviewed together, but **passwords never go into export
files** - those rows say the password stays on that computer. `skChangePassword` now also refreshes the readable copy.

**Settings -> Password**: every account's own Settings page shows its Student ID and password (masked, Show / Copy), so faculty
can check which login a computer is using without opening Administration. The sign-in screen's *Recent Logins* chips now fill
the Student ID only - they no longer fill the password, so nobody can sign in as a classmate with one tap.

## Logistics document logic: modes, prerequisites, Air details
- **Mode-aware prerequisites** (`job-engine.js` -> `skResolvePrerequisitesForMode`, `MODE_PREREQUISITE_OVERRIDES`). The shared
  `PREREQUISITES` chain is one trade lifecycle. For a Job, prerequisites that don't exist in its mode are dropped and their own
  prerequisites spliced in, so an **Import** job no longer needs the seller's export paperwork and an **Air** job no longer needs
  sea/container documents (cargo manifest rests on the Air Waybill). Documents the student ticked themselves are never dropped.
  With no mode (Document Library free-play) behaviour is exactly as before. Seeded assignments are expanded the same way using
  a mode inferred from their documents (`skInferModeFromDocSlugs`); assignments already saved on a computer are not changed.
- **Create Job**: the document picker offers only documents that exist in the chosen Sea/Air mode (an already-ticked document is
  never hidden when editing a Job), "Full shipment" ticks only applicable documents, and switching mode drops ticked documents
  the new mode doesn't have. Corrected `MODE_APPLICABILITY`: Health/HACCP/Catch certificates classified, ICEGATE registration is
  international-only, Cargo Acceptance is export-side, Demurrage/Detention is sea-import only, Certificate of Origin and
  Phytosanitary also apply to imports.
- **Air flight details**: picking a flight now fills Airline, Flight No., **Flight Date**, **Aircraft Type** and **Aircraft
  Registration** (new optional Job fields). Per-airline AWB prefix, fleet and registration style live in `AIR_CARRIER_PROFILE`
  (illustrative data - verify AWB prefixes against IATA's directory before real use). The Air Waybill, ULD Manifest, Air Freight
  Invoice, Customs Declaration, Bill of Entry, Dangerous Goods Declaration and Insurance Certificate now fill from the Job.
  The Air Waybill number also reaches downstream `txn.blNo` / `txn.blNumber` fields.
  The ~15 required "Mode of Transport" dropdowns (Commercial Invoice, Packing List, Bill of Entry, Insurance Certificate, Letter of
  Credit, Purchase Order "Ship Via", DG Declaration...) now fill from the Job's Shipment Mode (`txn.transportMode` & variants,
  half/full autofill tiers). The AWB's Final Carrier and Routing are intentionally left to the student: on a connecting journey
  they legitimately differ from the Job's flight, so tying them would raise false cross-document mismatches.
- **air-patches.js** holds every Air correction to the 18,000-line `documents-data.js` in three plain tables (always-applied
  patches, Air-Job-only variants, review-page label swaps). Air Jobs see "Airline / Flight", "Air Waybill", "ULD" wording and are
  no longer forced to enter container / seal / IMO / original-B/L fields. Sea Jobs are untouched.

## Logistics: documents per mode, "Sea / Flight" wording, cargo-plane mark
- **Documents per Shipment Mode** (`MODE_APPLICABILITY` in `job-engine.js`, reviewed document by document): Sea Export 79, Sea Import 68,
  Air Export 66, Air Import 62, Road / Domestic 35, Warehouse Transfer 27. The Create Job picker now uses this table for *every* mode
  (Road and Warehouse used to use a coarse category filter). Import jobs also get the road-leg documents (lorry receipt, trip sheet,
  weighbridge slip, vehicle inspection); export goods moving to the port can carry an e-way bill; the US Importer Security Filing moved
  to Sea Export (it applies to US-bound cargo); Sea Import's Master B/L has no prerequisites (the carrier issues it at origin).
- **Shared documents read "Sea / Flight"** (`air-patches.js`): the same field is worded by context - an Air Job shows pure air wording
  (Airline / Flight, Air Waybill, ULD, Airport of Loading), the Document Library with no Job shows dual wording (Vessel / Flight Name,
  Bill of Lading / AWB Number, Port / Airport of Loading), and a Sea / Road / Warehouse Job keeps the original wording. Only labels,
  short placeholders, column labels, step titles and the review page's label text are rewritten - never explanatory prose (an Air
  Waybill is non-negotiable, so a mechanical swap inside "a negotiable Bill of Lading" would make it wrong) and never dropdown values.
  Edit the phrase lists `SK_AIR_PHRASES` / `SK_NEUTRAL_PHRASES` to change the wording.
- **Air jobs hide what an aircraft doesn't have** (`SK_AIR_MODE_PATCHES`, `hidden:true`): FCL/LCL, container equipment & empty pick-up,
  reefer plug-in, VGM cut-off, B/L endorsement / original copies, container size & stuffing instructions. Other container / seal fields
  become optional rather than hidden.
- **Cargo-plane mark**: documents that exist only in Air modes (Air Waybill, ULD Manifest, Air Freight Invoice, Flight Schedule, Cargo
  Acceptance) always carry a cargo-plane watermark and an "AIR FREIGHT" badge; shared documents carry them while an Air Job is active;
  everything else keeps the container-ship watermark. The Document Library shows a small plane icon on those documents.

## Regulatory accuracy review (Oct 2026)
The 412 regulatory-flavoured statements in the documents were extracted and the risky ones checked against current sources.
Corrected: e-invoice reporting window (30 days for aggregate turnover of Rs 10 crore or more since 1 Apr 2025; the "7 days" rule no
longer applies) - the old GST slabs 12% / 28% (since 22 Sep 2025: 0 / 5 / 18 / 40%) incl. Goods Transport Agency 5% (no ITC) or 18%
(with ITC) - notional 1% landing charges (removed from 26 Sep 2017, Notification 91/2017-Customs (N.T.)) - air-import freight capped at
20% of FOB in the duty calculator while an Air Job is active (Customs Valuation Rules 2007, Rule 10(2)) - UCP 600 charges wording
(Art. 37) - export realisation period now "9 months" (calendar months, not 270 days; RBI briefly allowed 15 months in late 2025) - the
SOFTEX form is marked as a legacy process: from 1 Oct 2026 it is replaced by the unified Export Declaration Form (EDF) under the FEMA
(Export and Import of Goods and Services) Regulations 2026 - eBRC GST-invoice field cites DGFT Public Notice 42/2025-26 - IEC is
the entity's PAN (10-character alphanumeric) in the Lyra tutor - LUT prosecution threshold is "exceeding" Rs 2.5 crore.
Confirmed as correct: UCP 600 (21 days / 5 banking days / 110% insurance), e-way bill (Rs 50,000, 1 day per 200 km), LUT (one FY,
3 months, 18% interest), Customs Act ss. 41 / 54 / 148, Circular 26/2017-Customs (self-sealing), duty cascade (CIF > AV > BCD > SWS 10%
of BCD > IGST on AV+BCD+SWS), SOFTEX number issued by RBI, IATA 6000 volumetric divisor, AWB check digit (serial mod 7).
Rules change: re-verify against the CBIC / DGFT / RBI notifications before teaching from any figure here.

## Oct 2026 update: sign-in role, auto B/L number, EGM, TCOS = Doc-Sim Shipping Bill / BOE
- **Logistics sign-in** (`logistics-simulator/login.html`) is now the SKELORA Premium sign-in design. Every sign-in asks for a **Role**
  (working position; "Faculty / Instructor" creates a faculty account). `auth.js`: `skSetWorkRole / skGetWorkRole / skGetPreparedBy`
  (key `skelora_session_workrole_v1`, cleared at sign-out). The role is printed beside the student's name on every document PDF
  ("Document Prepared By - Name - Role"; "Prepared by: ..." footer line on the ICEGATE Shipping Bill / Bill of Entry / B-L pages),
  on the Certificate of Completion, and is passed to TCOS by `shared/tcos-bridge.js` (`workRole`). Password recovery uses
  `shared/access-id.js` (hash), the old captcha was dropped with the new design. Three.js now comes from `boot-loader/vendor` (offline).
- **Bill of Lading Number** is auto-generated (carrier SCAC from the Job + yy + mm + serial) - `bill-of-lading-forms-config.js`,
  generic hook `autoGenerateWith` in `engine.js`.
- **Export General Manifest**: first cargo-listing column is "Shipping Bill No. / IEC No." (context key `txn.shippingBillOrIEC`,
  SB number when it exists, otherwise the exporter's IEC).
- **TCOS Shipping Bill / Bill of Entry** now print with the Doc-Sim ICEGATE renderers (see `tcos/README.md`). `customs-forms*.js/css`
  in `logistics-simulator/` are loaded by `tcos/` and `supplychain-tcos/`. Logistics service-worker cache is `skelora-v81`.

## First-run install wizard
- `index.html` redirects to `install.html` until the key `dot_hub_installed_v1` exists in this
  browser's localStorage. The key is saved when the 60-second deployment finishes; **Launch** then
  opens the hub (and, where the browser offers it, the native "Install app" dialog).
- **Launch** opens `index.html?installed=1`, which saves the key in the hub page's own storage (fixes Firefox looping back to the wizard). Opening the hub straight from a folder (`file://`) skips the wizard. Each browser still shows the wizard once, because every browser has its own storage.
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

## Firefox / file:// note (v20)
Opened from a folder, Firefox keeps each page's storage separate, so Logistics sign-in loops. Logistics pages now show a clear message in Firefox on file:// (use Chrome/Edge or START_LOCAL_SERVER.bat -> http://localhost:8000). Sign-in/dashboard redirect loops also stop after 5 bounces. Favicon is embedded (Chrome ignores favicon files on file://).
