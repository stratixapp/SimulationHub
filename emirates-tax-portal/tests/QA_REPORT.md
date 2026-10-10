# VAT201 QA report (Emirates Tax Portal — VAT side)

Run: `node tests/vat-engine.test.js` from `emirates-tax-portal/` (isolated vm sandbox, in-memory storage).
Baseline on original code: 20 passed / 6 failed (26 tests). After all fixes: 36 tests, 0 failed (10 added for penalty logic).
Scope: calculation engine + validation rules + code review. The browser UI was NOT click-tested.

## Defects fixed
| # | Defect | Fix | File |
|---|--------|-----|------|
| 1 | Box 8 Amount left out Box 2 and Box 3 amounts (VAT column was right) | Amount = 1 - |2| + 3 + 4 + 5 + 6 + 7 | js/storage.js `computeTotals` |
| 2 | Box 7 forced non-negative; FTA allows +/- adjustments | Box 7 inputs signed; pair check compares |VAT| vs |amount| | js/return.js, js/storage.js |
| 3 | Box 1 Adjustment accepted positive values (FTA: always negative) | Validation error if > 0 | js/storage.js, js/return.js |
| 4 | Inputs accepted >2 decimals | `sanitizeMoney` (max 2 dp) on all money inputs | js/storage.js, js/return.js |
| 5 | Box 2 shown positive (real form: negative) | Displayed negative on return screen | js/return.js |
| 6 | review.html?id=… could submit a return that skipped Return-screen validation | Re-validates; redirects back to return.html | js/review.js |
| 7 | Double-click on Submit could submit twice | `submitting` guard + button disabled | js/review.js |
| 9 | Late payment escaped when the return was filed on time but paid late (early return on !isFilingLate) | Late filing and late payment computed independently | js/storage.js `computeFilingPenalty` |
| 10 | Late-payment months used ceil(days/30) | Calendar months: each month or part, first period starts day after due date (`lateMonths`) | js/storage.js |
| 8 | Service worker precache missed general-login.html, general-login.js, auto-return-login.js, shared/identity.js | Added; cache bumped to v13 | sw.js |

## Root cause of the "automatic" Box 6 = AED 19,173 / Box 2 = AED 16,169
`seedIntegrationFeeds()` (js/storage.js) fills Box 2 and Box 6 with simulated feeds:
`Box 2 = 5000 + hash(filingId+"b2") % 40000`, `Box 6 = 8000 + hash(filingId+"b6") % 90000`, VAT = 5%.
It is a documented design choice (README), flagged `seeded`, stable across reload, and unrelated to the
registration thresholds (verified: register.js never touches return boxes). Values are NOT tied to any
real import/tourist-refund record, company or period.

## Verified against outside sources (secondary — FTA PDF itself not retrievable here)
- Box 8 = sum of Boxes 1-7 (Zoho, Jaxa Auditors, Velmont Crest guides). Box 2 amounts always negative. Box 7 may be +/-. Box 1 adjustment always negative.
- Cabinet Decision 129 of 2025, effective 14 April 2026: late payment 14% p.a., charged monthly for each month or part of a month from the day after the due date; late filing AED 1,000 first / 2,000 repeat (several consultancy summaries agree).

## Unverified / open
- The "other-services" late-payment calculator estimates from a typed number of days (ceil(days/30)); it has no dates, so it stays approximate.
- Violations before 14 April 2026 are reportedly assessed under the old rules; the simulator applies 14% to any date.
- No 5% rate check on entered VAT (only |VAT| <= |amount|); the real portal does not enforce it either.
- No upper cap on amounts; no per-box audit trail; draft/submitted data lives in browser localStorage.
- Browser UI was not click-tested.

## Round 2 — box logic aligned to the real VAT201 (47 tests, 0 failed; UI smoke-tested in jsdom)
Sources: FTA VAT Returns User Guide (via BusinessDubai / Tally / Firstbit summaries), ICAI Dubai note on the portal's 5% check.
| # | Change | Where |
|---|--------|-------|
| 1 | Box 2 and Box 6 are locked feeds that are **0.00 unless records exist**. Default now 0.00; the old random figures became an opt-in "training feed" in Settings. Submitted returns never change. | storage.js `seedIntegrationFeeds`, settings.html |
| 2 | Figures are **net of credit notes**: negative Amount/VAT accepted in Boxes 1, 3, 4, 5, 7, 9, 10 (Box 1 Adjustment still must be <= 0). | return.js |
| 3 | "VAT is not 5% of net value" is a **warning, not a block** (as on the real portal). Boxes 9/10 may recover less than 5% but not more. Incomplete pairs are warnings too. Hard errors: Box 1 adjustment > 0. Warnings still count against a "clean return" in grading. | storage.js `validateBoxes`, return.js, review.js |
| 4 | **Box 10 = recovery side of Boxes 3, 6, 7**: live hint under Box 10; warns when Box 10 exceeds what 3+6+7 declared, or is empty although reverse charge was declared. | storage.js `reverseChargeDeclared` |
| 5 | Demo-scenario loader: Box 1 goes in the **registered Emirate** (fixed-establishment rule, not customer location), Box 7 left empty (it only corrects Box 6), Box 10 mirrors 3+6+7, partial-exemption ratio applied to Box 9/10. | return.js `applyScenario` |
| 6 | Designated Zone text corrected: out-of-scope DZ supplies are **not reported in any box**; in-zone consumption is standard rated (Box 1); exports are Box 4. | return.html / return.js |
| 7 | Tooltips fixed: Box 3 is purchases you self-account for (not "sales"), Box 7 only corrects Box 6, Box 9 excludes blocked input tax. | return.html |
| 8 | Template import rounds to 2 dp. Service-worker cache bumped to v15. | return.js, sw.js |

Still open: carry-forward credit when Box 15 = "No" is only a label (it does not net against the next period's payable); other-services late-payment calculator still uses days; Stagger 1/2 labels in Settings ("Monthly"/"Quarterly") should be checked against FTA tax-period definitions.

## Round 3 — full audit before giving the simulator to students (80 tests, 0 failed; UI smoke test added)
Method: every VAT-side rule was compared with the FTA VAT201 box structure (worked example from Sarmat's Jul–Sep 2026 guide, Zoho, Firstbit, ClearTax, FTA manual snippets; the FTA PDF itself could not be opened by the tool, so these are secondary sources) and the code was run, not just read. Tests run in 5 timezones (UTC, Asia/Kolkata, Asia/Dubai, America/Los_Angeles, Pacific/Auckland).
Worked example reproduced exactly: Box 8 = 688,000 / 28,400, Box 11 = 326,000 / 16,300, Box 12 = 28,400, Box 13 = 16,300, Box 14 = 12,100.

| # | Defect | Fix | Where |
|---|--------|-----|-------|
| 1 | A return filed or paid ON the due date counted as late (AED 1,000). The due date was compared as midnight UTC. Same cause: "Overdue" badges, days-left in notifications. | Whole due day is on time (23:59:59 local). New `isPastDue`, `daysUntilDue`. | storage.js, excise.js, liabilities.js |
| 2 | Voluntary Disclosure dropped the original Box 1 / Box 9 Adjustment columns, so an unchanged VD showed a phantom tax difference (AED 250 in the test). | Original adjustments are carried into the corrected boxes. | storage.js `buildCorrectedBoxes` |
| 3 | VD penalty months = ceil(days/30). 28 Jul to 28 Aug gave 2 months (real: 1). | Calendar months, month or part of a month, same `lateMonths` as late payment. VD on/before the original due date: no monthly penalty. | storage.js `computeVdPenalty` |
| 4 | Box 15 = "No" only printed "carried forward"; nothing was carried. | Credit really is set off against later payable returns (`creditBroughtForward`, `netPayable`): Liabilities, Dashboard, Payment, Success, Review, late-payment penalty. Box 14 itself is never altered. | storage.js, liabilities.js, dashboard.js, payment.js, success.js, review.js |
| 5 | "Stagger 1 = Monthly / Stagger 2 = Quarterly" is not how the FTA numbers staggers (sources disagree on the numbering). | Neutral wording: "Quarterly (calendar quarters)" / "Monthly (calendar months)"; old saved wording is mapped on display. Settings explains that the real FTA assigns the periods. | storage.js, settings.html, success/review/return.js |
| 6 | success.html threw "Cannot access 'timer' before initialization" for any return older than ~60 s: penalty panel, Edit button and PDF buttons never wired up. | `timer` declared before first use. | success.js |
| 7 | `fmtDate("2026-10-28")` showed the previous day west of UTC; `todayISO()` used the UTC date, so a payment made between 00:00 and 04:00 UAE time was dated the day before. | Both use local calendar dates. | storage.js |

Added: `tests/vat-engine.test.js` T30–T37 (33 new tests), `tests/ui-smoke.js` (jsdom: opens 15 real pages against a seeded account, fails on any script error; run `npm i --no-save jsdom@24 && node tests/ui-smoke.js`). Service-worker cache bumped to v16.

Deliberately NOT modelled (tell students the simulator is a simplification): fixed AED 500 penalty for an incorrect return; weekend/public-holiday shift of the 28th-day due date; the 1 Oct 2026 input-VAT rules (FTA Decision 13/2026 supplier checks, Cabinet Decision 149/2026 cash-payment block); the 5-year limit on refund claims (from 1 Jan 2026); partial-exemption apportionment is left to the student (as on the real form).
Still unverified: Box 2 sign handling (no worked example with a non-zero Box 2 found); the VD screen's statement that a late VD adds no monetary penalty; the exact FTA stagger numbering.
Not audited: Corporate Tax side, registration / UAE PASS / Emirates ID flows, invoice generator, trial balance, instructor grading. The browser flow was smoke-tested in jsdom, not clicked through in a real browser.

## Round 4 — end-to-end filing check with the AS Group of Industries practice set (80 engine tests, 0 failed)
Method: the real pages (return.html, review.html, success.html) were opened in jsdom against a fresh account and driven the way a student would: figures typed into the boxes, Profit Margin answered, Review declaration ticked, Submit, then the two PDF buttons on the success page. A real browser was not used.
Results (all matched a hand calculation, no validation errors, no warnings):
- Payable return (Jul-Sep 2026): Box 8 = 820,000 / 32,000 / adj -400, Box 11 = 240,000 / 12,000, Box 12 = 31,600, Box 13 = 12,000, Box 14 = 19,600 payable, penalty 0 (filed before the due date).
- Refund return, Box 15 = Yes: Box 14 = -12,500 shown as "Refundable"; Box 15 appears; success page tells the student to file Form VAT311.
- Refund return, Box 15 = No, then next quarter payable 5,000: 12,500 is carried forward, net payable 0, success page shows the credit brought forward.
| # | Defect | Fix | Where |
|---|--------|-----|-------|
| 1 | The Arabic heading above the Terms block in every generated PDF printed as garbled characters (jsPDF's built-in Helvetica has no Arabic glyphs). | The heading is now drawn through the same canvas-to-image path (`pdfArabicBlockToImage`) as the Arabic terms text. | js/storage.js `generatePdf` |
| 2 | Service worker would keep serving the old storage.js to installed copies. | Cache bumped to v17. | sw.js |
Not verified: the PDF check was done with a headless canvas and a DejaVu font standing in for the browser's Segoe UI/Tahoma; click through once in a real browser.
