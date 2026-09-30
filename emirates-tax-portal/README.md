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
