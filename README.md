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
supplychain-tcos/           -> copy of TCOS bundled with the Cadence suite (separate saved progress); rebuilt by tools/sync-supplychain-tcos.py
tools/                      -> sync-supplychain-tcos.py (keeps supplychain-tcos identical to tcos)
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

## v44 note
TCOS PDF upload backup: see CHANGES_v44.md.

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

---

## v52 / v53 — TCOS (ICEGATE simulator) changes

CAPITAL-letter rule for Y/N and YES/NO fields; PGA query replies are typed by the student (example shown, copy/paste blocked, detailed
example after a wrong reply); Save-Draft-safe return to the Logistics Simulator (automatic 10 s countdown); Bill of Entry duty auto-calculated
with an animated government-style e-Payment, receipt/PDF and return; per-step and total filing timer for Shipping Bill and Bill of Entry.
Details: `tcos/README.md`. Changed: `tcos/js/{icegate-steps,pga,workflow,app,filingForm,epayment,step-timer}.js`, `tcos/index.html`,
`shared/tcos-bridge.js`. `supplychain-tcos/` was not changed (see the note in `tcos/README.md`).

---

## v54 — Logistics Simulator: new dashboard, certification exams, new-lot fix

**Dashboard (logistics-simulator/skelora-institute-dashboard.html)** - the side menu is now a top navigation bar. Only the group names show
(Overview, My Workspace, Operations, Business, Academic); a click opens that group's features, a click on a feature opens it. A
*Certification Exams* button sits at the right of the bar. The dashboard is always the first screen, and the logo takes you back to it.
Phones get the same menu as a slide-out drawer. Glass bars, softer cards, an exam progress card on the dashboard.

**Certification exams (logistics-simulator/exam/)**
- `exam-bank.js` - 250 questions, 5 exams x 50, 4 options each (Easy, Medium, Tough, Hard, Hard), covering logistics and supply chain
  management, inventory and warehousing, procurement, sea / air / road / rail, Incoterms, export and import documentation, customs,
  trade finance and insurance, dangerous goods and cold chain. Format of each entry: `[question, correct, wrong, wrong, wrong]`. The engine
  shuffles the options for every student, so the right answer is not always in the same place.
- `exam.js` - marking +2 / -0.66 / 0 (each exam out of 100); 60 minutes of ACTIVE time (change `CFG.minutes`), which stops when the
  browser is closed, the tab is hidden or the student leaves the exam, so the exam can be finished the next day with the time left; answers
  saved on every click; exams unlock in order; marks and the full review of questions and correct answers appear only after submitting;
  one attempt per exam; auto-submit when time ends.
- `certificate.js` + `assets/` - after the 5th exam the student gets a Certificate of Completion (the supplied Blue Wave artwork) with their
  name, the exact average of the five exam scores (a negative exam counts as 0), a certificate number (DLSC-year-6 digits) and the date of issue,
  as PDF or PNG. The existing Trade & Customs completion certificate (`dot-certificate.js`) is unchanged.

**Fix: a new shipment lot no longer sees the previous lot.** Saved document progress used to survive in some cases (documents the app added as
prerequisites, or older saved values), so after a lot was finished the next Create a Job showed cross-document mismatches against the old
documents and "You already completed this exercise" on the first document. Now (1) finishing a lot clears every record worked during that lot,
and (2) while a Job is active, anything saved before that Job was created is ignored by the document opener, the prerequisite check and the
cross-document check (`skGetJobScopedProgress`, `skGetDocProgressForJob` in job-engine.js). This also repairs accounts that already have leftovers.
Changed: `auth.js`, `job-engine.js`, `workflow-rules.js`, `engine.js`.

---

## v55 — Overview polish, question fact-check, valuation fix

- **Dashboard:** the red welcome line now scrolls across the top as a news ticker (WELCOME badge, pauses on hover, static for reduced-motion users).
  Dashboard Overview has a new hero (eyebrow, greeting, date / role / exercises chips, live completion ring) and new KPI cards (accent bar, count-up
  numbers, progress bars). Seven cards sit in one row on wide screens and four per row on laptops, so no card is left alone. Phone top bar tidied.
- **Exam questions cross-checked against published sources** (ICC UCP 600, ICAO, DGFT / FTP 2023, CBEC / CBIC circulars, ICC Incoterms 2020, CBIC AEO
  pages). Two answers were wrong or out of date and were corrected:
  - Montreal Convention cargo limit is **26 SDR per kg** since 28 Dec 2024 (it was 22 SDR from 2019). Question rewritten.
  - The **notional 1% landing charge on CIF was removed on 26 Sep 2017** (Notification 91/2017-Customs (N.T.), CBEC Circular 39/2017). The question now tests that.
  Confirmed correct: UCP 600 Art. 3, 14(b) five banking days, 14(c) 21 days, 30(a) 10% / 30(b) 5%; Hague-Visby 666.67 SDR or 2 SDR/kg; CMR 8.33 SDR/kg;
  CIP minimum cover ICC (A) at 110% and CIF minimum ICC (C); EPCG six times duty saved in six years; SWS 10% of BCD; AEO T1 / T2 / T3 (T3 highest) and AEO-LO;
  rule 10(2) insurance 1.125% of FOB. An IEC is described as 10 *characters* (it is alphanumeric).
- **TCOS duty calculation:** the same 1% landing charge was still being added in `tcosComputeDuty` (assessable value = CIF x 1.01). It is now CIF value only,
  in line with the Logistics Simulator documents. Texts on the Assessable Value field, the e-Payment working and the README were updated.
  Regression suite: `node tests/run-all.js` -> ALL GREEN, 67 checks.

---

## v56 — ICEGATE capitals rule, shipment summary, PDF speed and bridge

- **ICEGATE: capital letters everywhere.** Small letters typed in any filing box show a red error and block Next (`tcos/js/caps-rule.js`).
- **Shipment Completed summary** now lists *every* document of the lot, including the prerequisite documents the app added (marked AUTO-ADDED), each with its time
  taken. ICEGATE documents show the real filing time ICEGATE measured (or "—" if none was recorded) instead of 0s (`job-engine.js`, `shared/tcos-bridge.js`).
- **ICEGATE PDF** is about 4x faster, shows a progress box, and every download of a bridged filing offers *Return to Logistics Simulator* (`tcos/js/icegate-print.js`, `tcos/js/app.js`).

---

## v57 — supplychain-tcos brought up to date

`supplychain-tcos/` had fallen behind `tcos/` (it still had the old home / login look and none of the later fixes). It is now rebuilt from `tcos/`, so it has the ICEGATE
home and login, the capital-letters rule, the PGA query replies, the filing timer, the e-Payment, the faster PDF and the Logistics bridge. The three differences it keeps
(separate saved progress, separate registered logins, and a Cadence link on the home page) are re-applied by `tools/sync-supplychain-tcos.py`. Run that script after any change to
`tcos/`. Details: `tcos/README.md`.

