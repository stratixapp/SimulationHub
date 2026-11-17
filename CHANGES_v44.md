# SimulatorHub v44 - Upload the TCOS PDF into the Logistics Simulator (backup for the automatic return)

## What it does
If the automatic "return to Logistics" from TCOS doesn't happen, the student uploads the PDF they downloaded from TCOS
into the SAME document's place in the Logistics Simulator. If it is the right document, the document is completed exactly
like the automatic return (own number carried forward, companion documents completed, "Next document" offered).

Upload places: (1) third option in the "Two ways to do this one" popup, (2) a permanent "Upload TCOS PDF" strip under the
banner of the document page (still there after "Do it here" was chosen; hidden once the document is complete).

Documents (10): Shipping Bill, Bill of Entry, Booking Confirmation, Bill of Lading, Air Waybill, Arrival Notice,
Delivery Order, Equipment Interchange Receipt, Proof of Delivery, Bank Realisation Certificate.
NOT uploadable: VGM Certificate (TCOS makes no PDF) and the Consignia Desk documents (commercial invoice, packing list, LC ...
- TCOS prints them with the browser's Save-as-PDF, which can't carry a stamp). Those stay "do it in TCOS and come back".

## How a PDF is checked (all must pass)
TCOS PDFs are page images, so TCOS now writes a checksummed stamp into the PDF Info/Keywords field; Logistics reads it from the bytes.
- right document for this place (Bill of Entry refused in the Shipping Bill place and vice versa)
- same login as the student   - filing finished (SB: LEO issued, BoE: Out of Charge granted)
- same Shipment Lot (lot id; if absent, exporter/importer IEC)   - export PDF refused for an Import lot and vice versa
- document is in the lot's scope, prerequisites done, not already completed
Stamp is a checksum, not a cryptographic signature (stops mistakes/casual edits, not a determined forger).
Bill of Entry upload also completes Out of Charge, Assessment Copy, Duty Calculation, Duty Challan (+ Examination Report only if an
examination really happened); Shipping Bill upload completes Export General Manifest if EGM was filed.

## Files
shared/tcos-bridge.js (stamp, parse, verify, companions) - tcos/js/pdf-export.js (stamp builder) - tcos/js/icegate-print.js (stamp on SB/BoE PDF)
tcos/js/filingForm.js + export-bridge.js (filing/booking remember the Lot id) - logistics-simulator/engine.js (UI + completion)
logistics-simulator/service-worker.js (cache skelora-v99) - tests/run-all.js (section 6) - tests/ui/tcos_upload_*.js (real browser)

## Known, not changed
- supplychain-tcos/ (Cadence copy) is NOT mirrored; its PDFs are unstamped.
- The old automatic path (tcos/js/workflow.js grantOOC) completes "Examination Report" even when no examination happened
  (filing.examination is always an object). The upload path does it correctly. One-line fix: `if (filing.examination && filing.examination.required)`.
- The automatic return does not check document prerequisites; the upload path does.
