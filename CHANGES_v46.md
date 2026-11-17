# SimulatorHub v46 - ZIP downloads now contain the real TCOS PDFs

Found while checking the existing ZIP options ("Download All Completed Documents (ZIP)" in My Progress, and "Download This Job's Documents (ZIP)"
on a finished Shipment Lot): a document completed through TCOS only stores its number in Logistics, so the ZIP rendered a mostly BLANK form for it
(Shipping Bill with no SB No, etc.).

Now:
- TCOS keeps a copy of each FINAL PDF it produces (Shipping Bill after LEO, Bill of Entry after OOC, and the freight documents) in a small browser
  database (IndexedDB "dot-tcos-pdfs", shared by TCOS and Logistics - same origin). The upload backup (v44) keeps the accepted PDF the same way.
- Both ZIP exports use that real PDF for TCOS-completed documents. Documents completed in Logistics are rendered exactly as before.
- TCOS companions that have no PDF of their own (Out of Charge, Assessment Copy, Duty Calculation, Duty Challan, Examination Report, EGM) are NOT zipped
  as blank forms; they are listed in README_TCOS_documents.txt inside the ZIP, and the progress line says how many.
Limits: the copy lives in that browser (same as all progress); a document finished in TCOS BEFORE v46 has no stored copy until its PDF is downloaded from
TCOS again (or uploaded via the v44 upload) - until then it is listed in the README.
Files: shared/tcos-bridge.js (savePdf/getPdf) - tcos/js/pdf-export.js - logistics-simulator/engine.js - skelora-institute-dashboard.html - cache skelora-v101.
Test: tests/ui/zip_tcos_pdfs.js
