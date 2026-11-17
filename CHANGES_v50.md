# SimulatorHub v50 - guided document order + Autofill level, and the corrected Practice Workbook PDF

Why: following the Practice Workbook PDF, many fields marked "auto-filled" were empty in the simulator, and the document order in the PDF did not match
the simulator's own "Next:" order (e.g. after the Sales Order the simulator offers the Commercial Invoice, the PDF listed ICEGATE Forms / RCMC).

What was found (the simulator's real autofill code replayed on all 6 shipments, ~1,390 "auto-filled" claims):
- Numbers that come from an EARLIER DOCUMENT (Commercial Invoice no. from the Sales Order, Sales Order no., SB / BL / seal numbers ...) do auto-fill.
- Values that come from the JOB MASTER (IEC, GSTIN, PAN, PO no., ports, container, seal, voyage, HS code, weights ...) only auto-fill at Autofill level C (Full).
  The default was A (Basic) and nothing told the student to change it: at level A about half of the claims stayed empty (Russia 199 of 410),
  at B 9-64 per shipment, at C none (apart from 3 vehicle-number rows, fixed in the PDF below).

Simulator
1. Create a Shipment Lot: the three autofill levels are named and explained (A Basic / B Half / C Full) and NEW lots default to C - Full.
   (existing lots keep their level. To go back to A as the default change 'full' to 'basic' at the end of the currentAutofillTier line in skelora-institute-dashboard.html)
2. The guided order ("Next:" after a document, the Lot's document list) now follows the Recommended Document Workflow chain, not the order the documents were
   ticked in the picker (alphabetical per category, which e.g. went Commercial Invoice -> Bill of Exchange, or started an import with Bill of Exchange).
   Prerequisites are still pulled in front. IMPORT lots use their own chain (importer paperwork -> freight -> customs clearance -> delivery -> inland transport).
   Chain tweaks: Weight Certificate after Booking Confirmation; ARE-1 + Shipping Bill before the Container Load Plan / Seal Report (they quote the SB number).
   Files: job-engine.js (skSortSlugsByWorkflow, SK_IMPORT_CHAIN), workflow-rules.js (WORKFLOW_ORDER), skelora-institute-dashboard.html.
3. Tests: tests/run-all.js section [7] (guided order), tests/ui/dashboard_v45.js (default level, Next after Sales Order). Cache skelora-v105.

PDF (Logistics_Documentation_Customs_Filing_Workbook_with_Theory_ICEGATE_v2.pdf)
- The "Working order" table of all 6 shipments is rebuilt in the simulator's guided order (same page numbers, working links).
- Cover: "Needs SimulatorHub v50" + a "Before you start" box (Autofill level C).  Job Master heading now says "choose Autofill level C - Full".
- 3 rows changed because the first document to carry the vehicle number is now different: South Korea Equipment Interchange Receipt (typed WB19G2026),
  South Korea Vehicle Inspection Report (auto-filled from DOC 36), Zimbabwe Vehicle Inspection Report (typed AP39TV4817).
- Document sections were NOT physically re-bound: they stay where they were, the Working order table (page numbers, clickable) gives the sequence.
- Verified: PDF re-read and replayed through the real simulator code at level C in the guided order: all ~1,390 auto-filled claims are filled. 17 of 347 pages changed.
