# UAE VAT Return Filing Simulator (VAT201) — Training Edition
Created By Ananthu Shaji

An offline, front-end recreation of the Federal Tax Authority EmaraTax VAT201
return filing workflow, built for training/educational purposes. No backend,
no real API — everything runs in the browser with `localStorage`.

## How to run
Just open `index.html` in a browser (double-click it, or serve the folder
with any static file server, e.g. `python3 -m http.server` from this folder
and visit `http://localhost:8000`).

## Structure
```
index.html              Login (Step 1) + Sign Up
css/style.css            Shared design system
js/storage.js            Shared state model, localStorage layer, calculations
js/login.js               Login screen logic
pages/dashboard.html      Home / dashboard (Step 2 overview)
pages/filings.html        My Filings list (Step 2 table)
js/dashboard.js  js/filings.js
pages/start.html          Service details / instructions gate (Step 3)
js/start.js
pages/return.html         VAT 201 Return — Boxes 1-14 (Steps 4-17)
js/return.js
pages/review.html         Review & Declaration (Steps 18-19)
js/review.js
pages/success.html        Submission success (Step 20)
js/success.js
pages/payment.html, payment-confirmation.html   Payment flow
js/payment.js
pages/registers.html      Sales & Purchase VAT Register practice set, VAT calculation sheet, VAT 201 working paper (js/registers.js)
pages/place-of-supply.html Place of Supply & Intra-GCC practice set (js/place-of-supply.js)
pages/vat-ledger.html     VAT ledger posting, period closing, control account and input VAT reconciliation (js/vat-ledger.js; shared data js/practice-set.js)
pages/employee-expenses.html Input VAT on employee expenses from 1 Oct 2026 practice set (js/employee-expenses.js)
pages/profile.html        Taxable person details
pages/payments.html       Payment history
pages/settings.html       Settings, credits, Reset Simulator
```

## Notes on data
- Signing up creates your own practice company/TRN — nothing is pre-filled.
- Every VAT box you're responsible for (1, 3, 4, 5, 7, 9, 10) starts blank.
- Box 2 (tourist refunds) and Box 6 (customs imports) are shown read-only,
  exactly like the real portal, as simulated integration feeds — visible via
  "View Details", never silently placed in your editable boxes.
- Use "Reset Simulator" in Settings to erase everything and start over.

## Back button (VAT and Corporate Tax pages)

Every page loads `shared/nav-back.js`, which adds a small round **Back** arrow (←) in the top-left corner (top-right on Arabic/RTL pages; it slides down the edge by itself when something is underneath) that opens the page the student was on just before, not a fixed page. It keeps a per-tab trail, stays in step with the browser's own Back/Forward, and skips pages that only redirect onward (e.g. a signed-out dashboard that bounces to the login page). With no earlier page it falls back to the section's dashboard / sign-in, and on the portal home it returns to where the student came from (the Simulator Hub). **New pages must include this script as the FIRST script tag**, so it runs before the page's own scripts can redirect.

## Tests
`node tests/registers-smoke.js`, `node tests/place-of-supply-smoke.js` and `node tests/invoice-rules-smoke.js` and `node tests/ledger-smoke.js` and `node tests/employee-smoke.js` (practice sets and invoice rules). `node tests/ct-penalty-smoke.js` checks the Corporate Tax late filing and late payment penalty maths. `node tests/e2e-human-flow.js` runs a person end to end (Emirates ID, UAE PASS, VAT registration, VAT return and payment, Corporate Tax return and payment) in jsdom; it needs `npm i jsdom acorn acorn-walk` and writes tests/e2e-last-run.json and `node tests/vat-engine.test.js` (calculation engine, penalties, Voluntary Disclosure, Box 15 credit, date handling; no dependencies)
and `npm i --no-save jsdom@24 && node tests/ui-smoke.js` (opens the real pages against a seeded account). See `tests/QA_REPORT.md`.

## Corporate Tax registration (Round 16)
Corporate Tax is now a separate registration: `ct/register.html` (five sections, pre-filled from the VAT registration, same EmaraTax login, no second password). Corporate Tax filing and payment stay blocked until the application is Approved. A training panel ("FTA reviewer") moves it through Under review, Approved, More information requested or Rejected. Late registration (AED 10,000) is calculated from the FTA Decision 3 of 2024 deadlines. Test: `node tests/ct-registration-smoke.js`. The CT number format, effective date, certificate wording and status labels are simulated. jsdom is pinned to ^24 (jsdom 30 breaks `tests/e2e-agent.js`).

## Tax periods and trainer simulated date (Round 17)
Corporate Tax periods follow the financial year end chosen at registration (first period 6 to 18 months, then 12 months; due 9 months after the end). The filings list shows each period with its own return. Trainers open `ct/trainer.html` (ribbon link) to set a simulated date (on time / 1 month late / 13 months late / own date); default is the real date. Tests: `node tests/ct-periods-smoke.js`; `node tests/e2e-human-flow.js` (late scenario) and `E2E_SCENARIO=ontime node tests/e2e-human-flow.js`.

## Voluntary disclosure, refunds and PDF penalty lines (Round 18)
`ct/disclosure.html` (link on each submitted return in the filings list): corrected tax, 1% per month penalty, 15% if an audit was notified, AED 500 incorrect return, refund request when tax was overstated. The acknowledgement and receipt PDFs now list the penalties and how the payment was allocated. Tests: `node tests/ct-disclosure-smoke.js`, `node tests/ct-pdf-smoke.js`. Not built: part payments, FTA decision on disclosures and refunds, public holidays in working days.

## Rules and sources (Round 19)
`ct/sources.html` lists every rule the Corporate Tax service encodes with its source and status (VERIFIED, SECONDARY, UNVERIFIED, NOT BUILT). Teach SECONDARY and UNVERIFIED rows only after checking tax.gov.ae. All tests: vat-engine.test, ui-smoke, registers-smoke, place-of-supply-smoke, invoice-rules-smoke, ledger-smoke, employee-smoke, ct-penalty-smoke, ct-registration-smoke, ct-periods-smoke, ct-disclosure-smoke, ct-pdf-smoke, ct-rules-smoke, ct-pages-smoke, e2e-human-flow (late and `E2E_SCENARIO=ontime`). Needs `npm i jsdom@24 acorn acorn-walk`.
