# SimulatorHub v45 - Job Master, Shipment Lot panel, Shipments page

1. **Ports & ships (Job Master)** - Indian ports 22 -> 35 (Pipavav, Hazira, Dahej, Mormugao, Kakinada, Gangavaram, Kattupalli + airports Goa, Pune, Jaipur,
   Thiruvananthapuram, Kozhikode, Coimbatore); foreign ports +~60 across existing countries (e.g. Fujairah, Xiamen, Seattle, Bremen, Chabahar, Sohar ...);
   ships 20 -> 43 (MSC, Maersk, CMA CGM, COSCO, Evergreen, ONE, HMM, NYK, APL ... each with its carrier).
   Added to Logistics (job-engine.js) AND TCOS (tcos/ + supplychain-tcos/ data.js) so the bridge still matches every port; Indian ports also got ICEGATE
   location codes in icegate-print.js (sea codes checked against the ICEGATE list; the six new airports use the standard IATA+4 pattern).
   No new countries were added (country list is shared by every document dropdown / TCOS).
2. **Dashboard** - the 1-Year / 6-Month track picker and its document lists are removed. With no active lot the panel shows only "+ Create a Shipment Lot".
3. **Mandatory / Optional label** - replaced by one small fluorescent-yellow star on mandatory documents (nothing on optional ones); the explainer box is gone.
   Applies in the Create Lot picker, the library cards, the document page banner and the Shipments page.
4. **Shipments page** - the random "assigned scenario" is gone. It now shows the active Shipment Lot (route, every filled field grouped by section, items table,
   per-document status + progress) and Shipment History (each finished/closed lot expandable to the same details).

Tests: tests/run-all.js (57), tests/ui/dashboard_v45.js (new), tests/ui/tcos_upload_*.js (v44). Service-worker cache skelora-v100.

Fixed (v45): the "N selected" counter in the Create Lot picker stayed at 0 after the mode auto-ticked documents; it now matches the ticks.
