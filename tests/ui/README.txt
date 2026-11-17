Optional UI smoke tests (drive the REAL Create Job screen in a headless DOM).
Need:  npm i jsdom   and the hub served on http://localhost:8765  (e.g. `python3 -m http.server 8765` from the hub root).
Run :  node tests/ui/ui_save_test.js
Covers: old-placeholder gross/invoice mismatch blocked, road vehicle number normalised, air flight-number format,
short HS code blocked, DG UN Number (UN1090) rules, net > gross blocked, valid Sea Export / Air Export saves.
The main suite (node tests/run-all.js) needs nothing installed.

v44 - TCOS PDF upload backup (real Chromium, needs:  npm i playwright  +  npx playwright install chromium,
and the hub served on http://localhost:8765):
  node tests/ui/tcos_upload_sb_flow.js   Shipping Bill: real TCOS filing -> LEO -> real PDF -> (A) automatic return, (B) upload backup
  node tests/ui/tcos_upload_boe_flow.js  Bill of Entry: real import filing -> OOC -> real PDF -> upload, companions completed
  node tests/ui/tcos_upload_matrix.js    wrong doc / other student / before LEO / other lot / edited / plain PDF / non-PDF / prerequisites /
                                         already-completed / upload strip / freight-document stamps
