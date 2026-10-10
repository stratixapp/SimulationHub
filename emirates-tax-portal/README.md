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
`node tests/vat-engine.test.js` (calculation engine, penalties, Voluntary Disclosure, Box 15 credit, date handling; no dependencies)
and `npm i --no-save jsdom@24 && node tests/ui-smoke.js` (opens the real pages against a seeded account). See `tests/QA_REPORT.md`.
