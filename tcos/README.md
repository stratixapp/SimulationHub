# TCOS — India Trade & Customs Operations Simulator

ICEGATE-style Shipping Bill (export) and Bill of Entry (import) filing simulator, with PGA / Ministry
clearances, scrutiny, duty payment, LEO / OOC, EGM and Logistics Simulator hand-off. Training use only —
nothing here is a live ICEGATE, bank or customs system.

Run it through the hub (`START_LOCAL_SERVER.bat`, then open the TCOS card). The `supplychain-tcos/` folder is the
copy bundled with the Cadence Supply Chain suite (see "Keeping supplychain-tcos in sync" at the end of this section).

## Current behaviour (v52 - v56)

### 1. CAPITAL-letter rule for the whole filing (Shipping Bill and Bill of Entry) — `js/caps-rule.js` (v56)
Real ICEGATE accepts text in **CAPITAL letters only**, so every text box and text area in the filing wizard follows the rule
(party, invoice, shipment, items, containers, scheme and compliance details, documents, manifest, ...):

- As soon as the student types a **small letter** the box turns red and says *"Type in CAPITAL LETTERS only."* Nothing is changed silently.
- **Next** is blocked (with a message saying how many boxes have small letters) until they are retyped in capitals.
- Y / N and YES / NO flag columns (Drawback, RoDTEP, FTA, FS, PQ, DC, ...) must be exactly `Y` / `N` (or `YES` / `NO`), as before.
- Values the app filled in itself (names carried over from the Logistics Simulator, the default country, saved drafts) are not the student's mistake;
  these are converted to capitals when Next is pressed.
- Not covered: dropdowns, numbers, dates, e-mail / URL / password boxes, read-only boxes. Add `data-nocaps` to a box to exempt it.
- Phones get the capital-letter keyboard (`autocapitalize="characters"`).

### 2. PGA / Ministry clearance — student finds the Ministry, then types the query reply
- **Which Ministries must clear the consignment depends only on the HSN codes declared** (every HSN that maps to a Ministry /
  agency in `HS_CODE_TABLE.pgaAgency` adds one clearance; all of them must be cleared). The student still picks the Ministry
  / Department herself — the app does **not** show which HSN belongs to which Ministry (a wrong pick just says it is not related and to check
  the HS codes / end-use). The country of origin / destination is not used in this module.
- Each agency then raises a **query**. The student types the reply in the box. A short **example format** (placeholders only) is shown
  above the box; it cannot be selected or copied (right-click, cut, copy, drag are switched off).
- **Paste, drag-and-drop and autofill are blocked** in the reply box (typed characters are counted; if less than 70% of the reply was typed it is
  rejected and cleared). Note: a browser cannot stop someone retyping from a screenshot — that is still typing.
- A reply is accepted when it (a) quotes this filing's Shipping Bill / BoE number, (b) mentions the HSN code of the goods that agency is asking
  about, (c) names a supporting document (licence / certificate / permit / test report … — agency-specific words in `PGA_QUERY_DOCS`), and (d) is at
  least 60 characters. If not, the student is told what is missing and a **detailed example for that filing** (real filing no., HSN, goods, quantity, party, IEC and the
  agency's usual documents) appears; typing that out is accepted. Failed attempts are counted in `p.queryAttempts`; the accepted text is kept in `p.response`.
- Code: bottom of `js/pga.js` (`pgaQueryReplyHTML`, `pgaCheckQueryReply`, `pgaSubmitQueryReply`).

### 2b. Filing timer — Shipping Bill and Bill of Entry (`js/step-timer.js`)
- Every ICEGATE step is timed. A live bar above the steps shows *time on this step* and *total time on this filing*; each step in the
  left list shows its own time.
- Only **active** time counts: it pauses when the browser tab is hidden or the student leaves the filing screen, and continues when a saved draft is reopened.
- After submission the filing page shows **⏱ Time taken to file** with the total and a per-step table, and the submit message includes the total.
- It is a record only — nothing is limited or marked down. Data: `filing.timing` (`stepMs`, `order`, `titles`, `finishedMs`).

### 3. Save Draft → come back later → finish → return to the Logistics Simulator
- When a filing is started from the Logistics Simulator, the bridge now remembers **which filing it opened**
  (`DotBridge.bindFiling`, `shared/tcos-bridge.js`).
- A bridge that owns a saved draft stays valid for **7 days** (was 6 hours for everything), so *Save Draft & Exit* → log out →
  return tomorrow → finish still sends the student back.
- Finishing some *other* filing in ICEGATE no longer triggers the return / marks the Logistics document done.
- The return is now **automatic**: when the filing genuinely finishes, a dialog shows a 10-second countdown, downloads the
  ICEGATE-format PDF where there is one, and returns. **Stay in ICEGATE** cancels the countdown.
- Shipping Bill: return fires after the Shipping Bill PDF is downloaded (post LEO / EGM, unchanged).
  Bill of Entry: return fires after **duty payment** (see 4).

### 4. Bill of Entry — automatic duty and animated e-Payment (`js/epayment.js`)
- Duty is calculated **automatically from what the student typed in the Bill of Entry**: invoice value, currency, Incoterm,
  freight, insurance, exchange rate (CIF value; no notional 1% landing charge, which was removed on 26 Sep 2017), each item's HS code (BCD / SWS / Cess / ADD) and any FTA claim,
  then IGST. The payment screen shows the working and an **item-wise duty table**. Change a value in the filing and it recalculates.
- The student fills **nothing extra**: one button, **Pay Duty — ICEGATE e-Payment**, uses the challan number already entered
  in the filing.
- A government-style gateway animation runs (validate → ICEGATE gateway → bank → debit → bank confirmation → CIN / e-Receipt),
  then a **Payment Successful** screen with BoE no., CIN, bank reference, amount, date/time and a **Payment Receipt PDF**.
- Started from the Logistics Simulator: after payment the student gets the return dialog (Bill of Entry PDF download + automatic
  return). The Assessment Copy, Duty Calculation, Duty Challan (and Examination Report if one was required) are marked complete in the
  Logistics Simulator. **Out of Charge is no longer needed for the bridged return** (it is still available in ICEGATE).
- `tcosComputeDuty()` now also returns `lines` (item-wise duty), stored in `filing.duty.lines`.

### 5. PDF speed and the way back to the Logistics Simulator (v56)
- The ICEGATE PDF used to take ~25 s for a 9-page Shipping Bill (3.5x capture, lossless PNG per page). It now takes ~6 s (2.6x capture, high-quality
  JPEG) and a **progress box** shows "Page 3 of 9" while it works. To get the old maximum sharpness back, run
  `window.TCOS_PDF_OPTS = { maxScale: 3.5, png: true }` in the console (or set it in `tcosPdfOpts()` in `js/icegate-print.js`).
- After **every** PDF download of a filing that was opened from the Logistics Simulator, a *PDF saved* dialog offers **Return to Logistics Simulator**
  (before, the way back only appeared after the Let Export Order). The exercise is still marked done only at the same points as before
  (Shipping Bill: after LEO + PDF; Bill of Entry: after the duty is paid). The countdown dialog's own "Download PDF & return" is unchanged.
- The time ICEGATE measured for the filing is passed to the Logistics Simulator, so the Shipment Completed summary shows the real filing time
  for the ICEGATE document instead of 0s (`DotBridge.recordFilingSeconds`).

### Keeping supplychain-tcos in sync (v57)
`supplychain-tcos/` (the copy bundled with the Cadence Supply Chain suite) is the **same program** as `tcos/`. It is rebuilt from `tcos/` by one command,
run from the hub folder:

    py tools/sync-supplychain-tcos.py        (or: python3 tools/sync-supplychain-tcos.py)

Only three files differ afterwards (10 lines): `js/state.js` and `js/app.js` use their own storage keys (`..._supplychain_v1`) so progress and logins in the
Supply Chain suite never mix with the hub's TCOS, and `intro.html` + the message handler in `js/app.js` add a **Cadence** quick link on the home page.
The script stops with an error if a line it needs to change is missing, so run it again after every change to `tcos/`.

---

## History: how this build was assembled (v4 + FINAL merge)

This build reconciles two zips that had diverged from a common base into two
different engineering-hardening passes:

- **HARDENED_v4** — continued a 3-round hardening pass: data isolation, ID
  collision guards, a formal filing/booking state machine, accessibility,
  reload-safe amendment/document resolution, and content-accuracy fixes.
- **FINAL** — branched separately and added a few genuine improvements of its
  own, but was missing v4's later rounds, including one **critical, app-breaking
  bug**: the CSS rule that hides inactive screens was never added, so every
  screen rendered stacked on top of every other screen simultaneously. Verified
  by actually executing the app (jsdom): 27 of 27 screens visible after login,
  instead of 1.

**This build uses HARDENED_v4 as the base** (the only one of the two that
renders correctly) and merges in FINAL's worthwhile additions on top, with the
one factual regression in FINAL (an incorrect PGA routing) left out.

Nothing here is a rewrite from scratch — every change below is a small, scoped
patch on top of a codebase that was already reviewed and tested across two
prior rounds. Total diff: 6 of 15 JS files touched, ~120 lines changed.

---

## What was merged in from FINAL

1. **Scenario "Client Brief" instead of auto-fill.** Selecting a training
   scenario no longer pre-fills the Shipping Bill / Bill of Entry form. Instead
   a reference card ("📋 Client Brief") appears above each wizard step showing
   the scenario's client and shipment details — the trainee reads it and types
   every field in themselves, the way they would from a real client's
   documents. The scenario stays linked to the filing internally, so
   scenario-driven query/examination/discrepancy triggers still fire exactly
   as designed.

2. **Editable training identity in Settings.** Name / IEC / GSTIN / PAN under
   Settings → Profile are now editable instead of a static table. The saved
   name is reflected on the DSC signature, Training Certificate, and the
   top-bar user label.

3. **Financial calculation hardening.** Added `safeDuty()` / `safeAmount()` /
   `clampRate()` and wired them through duty assessment (`workflow.js`) and
   Duty Drawback / RoDTEP computation (`incentives.js`). Rates are clamped to
   0–100%, and no duty/incentive figure can render as negative, `NaN`, or
   `Infinity` regardless of what garbage a filing's invoice/item data
   contains. This sits on top of, not instead of, the existing `num()`
   coercion and RoDTEP expiry / partial-utilization / BRC-overdue logic v4
   already had.

4. **Popup-blocker guards.** `printDocument()` and `printCertificate()` now
   check whether `window.open()` actually returned a window before writing to
   it. Previously a blocked popup would throw and silently do nothing; now the
   trainee gets a clear "allow pop-ups and try again" message.

5. **"Not found" messaging.** `viewDocument`, `printDocument`,
   `downloadDocument`, `viewCertificate`, `printCertificate` now show an error
   toast instead of doing nothing when the ID doesn't resolve (e.g. cross-profile
   ID leakage attempts).

6. **Two extra freight preconditions**, matching the defense-in-depth pattern
   v4 already used elsewhere in the same file:
   - `issueDraftBL`: for Sea-mode bookings, blocks generating a draft Bill of
     Lading until VGM (Verified Gross Mass) has been submitted — matches the
     real-world SOLAS requirement, and the simulator already has a full VGM
     step, it just wasn't being enforced as a precondition.
   - `requestDeliveryOrder`: blocks requesting a Delivery Order until the
     **final** BL/AWB (not just a draft) has been issued.

7. **`conductExamination` double-run guard.** The discrepancy branch already
   checked `examination.result === 'SCHEDULED'`; the PASS branch didn't. A
   second call now hits a single guard at the top of the function either way.

8. **New learning-tip content** for the IGM validation field (why it's
   required, how to fix it) — content only, no logic change.

## What was deliberately *not* merged from FINAL

- **The CSS visibility bug** — not merged, obviously; this is v4's fix, kept.
- **A reverted PGA mapping.** FINAL's data.js routed Cotton woven fabric (HS
  52081100) to `PLANT_QUARANTINE` and had no `TEXTILE_COMMITTEE` agency at
  all. v4's routing (`TEXTILE_COMMITTEE`), which was verified against
  DGFT/CBIC sources in the original hardening pass, is what's kept here.
- **FINAL's state-machine-free status assignment, non-persistent ID
  generation, and non-persistent amendment/document-upload timers.** v4's
  versions of all of these (`setFilingStatus`/`setBookingStatus`,
  `uniqueId()`, `resolveAt`) are the ones in this build, unchanged.
- **FINAL's accessibility gap.** v4's focus-visible CSS, `aria-modal` /
  focus-trapped confirm dialogs, and keyboard-operable cards are unchanged
  and still present.

## Verification

This was tested by actually running the merged code in a headless DOM
(jsdom) — not just read — for every change above plus the existing v4
protections, to make sure nothing regressed:

| # | Check | Result |
|---|---|---|
| 1 | Only the active screen is visible after login (the critical bug, re-checked) | 1 of 27 panels visible — pass |
| 2 | Double-clicking Submit doesn't duplicate the acknowledgement | ack # and timeline length unchanged on 2nd click — pass |
| 3 | Selecting a scenario leaves party/items blank; Client Brief renders and toggles | pass |
| 4 | Editing and saving the Settings profile persists and updates the header | pass |
| 5 | Cotton fabric (52081100) still routes to Textile Committee | pass |
| 6 | Adversarial (negative/`NaN`/garbage) invoice input never produces a negative or non-finite duty figure | pass |
| 7 | Trainer login via the UI's Trainer/Instructor toggle | pass |
| 8 | `issueDraftBL` blocked pre-VGM for Sea bookings, succeeds after VGM submitted | pass |
| 9 | `requestDeliveryOrder` blocked before final BL issuance, succeeds after | pass |
| 10 | Re-running `conductExamination` a second time adds no duplicate timeline entries | pass |
| 11 | A full export filing (Draft → Submit → Acknowledged) runs with no thrown exceptions | pass |
| 12 | `uniqueId`, `setFilingStatus`/`setBookingStatus`, `resolveAt`, and the a11y CSS are all still present at their original call-count | pass |

All 15 JS files pass `node --check` (syntax-valid).

### Honestly not covered by this pass

- No UI was visually inspected pixel-by-pixel in a real browser — jsdom
  verifies DOM/CSS computed state and logic, not visual layout on every
  screen.
- The full 20-scenario library and every job-simulator track weren't
  individually replayed end-to-end; the export/import/freight flows tested
  above exercise the shared underlying functions those scenarios all run
  through, but that's inference from shared code paths, not a per-scenario
  run.
- No test file was included in either source zip, so the "17/55 assertions"
  figures either README quoted couldn't be verified either way — this
  README's test table is the actual replacement for that.

Everything else in the simulator (module list, scenario content, job
simulator, knowledge base, PGA/incentive data beyond the one HS code above) is
unchanged from HARDENED_v4 and was not touched by this merge.

---

## Home screen replacement (post-merge)

The old `#home` landing screen (neutral TCOS branding, no government marks)
has been fully replaced with a new govt-portal-style demo design (animated
ship/sea hero, ticker, GSTIN/Tax/Compliance cards, footer). Nothing about the
workflow changed:

- **Login / Sign Up** (nav) and **Explore Services →** (hero CTA) both call
  the existing `showLogin()` — same loader → login-screen transition as
  before.
- **Registration** is reached exactly as before: Login screen → "Register
  Now" → the existing 12-step `#reg` modal. Nothing in the registration flow
  itself was touched.
- The three home cards call the existing `moduleInfo()` (same toast-only
  behavior the old feature cards had).
- The old `#home`-specific CSS block was removed and replaced with the new
  design's CSS, entirely scoped under `#home ...` so none of it can leak into
  the login screen or the app shell (and nothing from those can leak in).
- The clock reuses the app's existing `id="liveDateTime"` /
  `updateLiveDateTime()` (already running from `app.js`) instead of adding a
  second timer.
- The "TRAINING SIMULATOR — NOT AN OFFICIAL GOVERNMENT PORTAL" disclaimer
  bar was carried over unchanged, since the new design's own government-style
  branding (Hindi text, "TCOS 2.0" portal look) makes that disclosure more
  important, not less.

Verified in jsdom: initial screen state (`home` active, `login`/`app` not),
Login/Sign Up → loader → login screen, demo login → app shell with correct
user label, Register Now → 12-step modal opens/closes, Back to Portal →
home again — all pass with no thrown exceptions.


---

## ICEGATE-format Shipping Bill / Bill of Entry (Oct 2026)
The Shipping Bill and Bill of Entry are now printed with the same renderers as the Logistics Document Simulator
(`../logistics-simulator/customs-forms.js`, `customs-forms-boe.js`, `customs-forms.css`) - A4 pages, Parts I-V / I-VI.
- `js/icegate-print.js`: adapter filing -> renderer data (regenerated live, so LEO / OOC / challan / examination show as they happen),
  on-screen view, print and PDF (one A4 page per `.sb-page`). A Shipping Bill / Bill of Entry document is created at submission.
- `js/icegate-config.js` (generated from the Doc-Sim configs, same field names) + `js/icegate-steps.js` + `filingForm.js`: the wizard now
  has the full real ICEGATE field coverage - Shipping Bill = the Doc-Sim's 14 steps (21 wizard steps: TCOS core steps + 11 ICEGATE steps),
  Bill of Entry = the Doc-Sim's 15 steps (24 wizard steps: core + 12 ICEGATE steps). Fields TCOS already collects (parties, shipment, invoice,
  items, containers, documents) are not asked twice. Required fields / patterns / conditional (showIf) fields / tables follow the Doc-Sim.
  Data is in `filing.icegate[name]` (flat value, or an array of rows for tables; item-aligned tables have one row per item).
  `tcosOverlayIcegate()` in icegate-print.js puts all of it on the print, so the final PDF is the same real-format document.
- The print footer shows "Prepared by: name - role" (role comes from the Logistics sign-in via the bridge).
- Mirrored into `supplychain-tcos/` by `tools/sync-supplychain-tcos.py` (see "Keeping supplychain-tcos in sync").

## Customs scrutiny, source documents & scroll (Oct 2026)
- `js/scrutiny.js`: (1) hard ICEGATE-style validation (`tcosDeepErrors`: GSTIN state code, PAN-in-GSTIN, dates, FOB vs incoterm, mode vs port, weight totals);
  (2) `tcosScrutinize` compares what the student typed with the job's source documents (commercial invoice, packing list, booking / BL, IEC) - mismatches are
  NOT blocked at filing; Customs raises a specific query naming the particular. Reply with corrections: 2 rounds, a wrong correction sends the goods for
  examination with a discrepancy and marks the risk profile; (3) "Documents on your desk" viewer; (4) "Where am I" guide on every step (Part, what, read from, checks,
  common mistake); (5) after EGM: SB-EGM matching + scroll - a mismatch holds the IGST refund until the SB is corrected (Section 149 amendment).
- ICEGATE-style screen: banner + vertical step list + guide panel (style.css, `.ig-*`). Source-document scrutiny applies to scenario filings.
- Bill of Entry: self-assessed duty (assessable value, BCD, SWS, IGST, cess, anti-dumping, total) is compared with the duty Customs computes
  (`tcosComputeDuty` in workflow.js: CIF value per incoterm, no notional 1% landing charge since 26 Sep 2017, HS tariff rates). A difference draws a query; correct values in the reply.
  Fixed: CIF invoices no longer add freight / insurance twice. Scenario data S3 / S7 / S10 made internally consistent so the brief can be filed as given.

## Doc-Sim → TCOS Shipping Bill flow (v16)
- Top bar shows the role chosen in the Document Simulator (not "Importer").
- Export Brief now has multiple Product/HSN rows, a Containers & Seals table, a Consignment Details card, and a "From your Document Simulator job" card; consignee/consignment auto-fill from the Doc-Sim job.
- Document Planner has a separate **Shipping Bill (ICEGATE e-filing)** row that opens the real filing wizard prefilled from the job.
- On completion (LEO + EGM) the student can download the ICEGATE-format PDF and is returned automatically to the Document Simulator.

## Navigation (v17)
Sidebar restyled to an ICEGATE-style navy menu with ICEGATE section names (e-Filing, Services, e-Sanchit, Enquiry – Document Status, e-Payment). Exact real-portal menu layout is not copied (site menus not publicly documented); training tools sit in a separate group.

## v21 additions
- HSN table now has ~120 more high-value / controlled goods (defence & arms, aircraft, satellites and space equipment, capital machinery, precious metals/stones, SCOMET chemicals). Controlled lines carry a SCOMET flag (auto-ticks SCOMET in the Export Brief) and new PGA agencies (DGFT SCOMET, MoD, Dept of Space, AERB, NACWC, DGCA, PESO). Duty/drawback/RoDTEP figures are training approximations.
- IEC accepts 10 letters/digits (e.g. AABCT4521K); exporter PAN flows from the Document Simulator job into the filing and the Shipping Bill header.

## Shipping Bill — "Submit & Sign" console (final filing step)
The last step of an EXPORT filing is no longer two ticks and a button. `js/final-filing.js` runs an ICEGATE-style
gauntlet: pre-submission validation → draft-checklist verification + re-keying IEC / invoice value / package count →
five Section 50 declarations + signatory name → DSC (detect token, pick the right Class-3 certificate, token PIN, 3 wrong
tries lock it) → OTP (3-minute, 3 tries) → submission to ICES (can answer "503 busy" — retry). No form fields were added.
Tune or switch it off with `window.TCOS_FINAL_FILING = { export:false }` (or `import:true` to use it for the Bill of Entry)
before the script loads. Typeface: Noto Sans (bundled, `fonts/`), set once via `--icg-font` in `css/final-filing.css`.
