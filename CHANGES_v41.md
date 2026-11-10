# SimulatorHub v41 — Logistics Job / Documents / TCOS bridge bug-fix release

Audit basis: v40. Every fix below was reproduced first (executed in Node against the real code), then fixed, then covered by `node tests/run-all.js` (39 checks) and by driving the real Create Job screen headlessly (`tests/ui/`).

## A. Create a Job -> Documents
1. **Vehicle Number** — placeholder `KL-07-AB-1234` failed 10 documents. Job now normalises to `KL07AB1234` (hyphens/spaces stripped, upper-cased) and validates; placeholder + 2 document placeholders updated.
2. **UN Number** — placeholder `1090` failed the DG Declaration (`UN1090`). Placeholder fixed, Job validates `UN` + 4 digits.
3. **Bill of Lading — Port of Loading** — was a hard-coded dropdown that rejected 153 of 154 Job ports (and every foreign port on an import). Now free text like Port of Discharge.
4. **HS Code** — Job accepted any text, 26 documents require 8 digits. Job now enforces 8 digits (items get the same format validation as Job fields).
5. **Import Invoice — Payment Terms** — added "Documentary Collection" (existed on the Job, missing on the document).
6. Format rules added on the Job for seal no., phone, Importer GSTIN, PO no., packages, weights, prices, e-way bill, challan, LR no., product code, mfg/expiry date; packing group is now a I/II/III dropdown. Voyage/Flight pattern is mode-aware (Air = airline code + digits).
7. **Cross-field checks** — Invoice Value = Σ items, Gross Weight = Σ item weights (TCOS enforced this and the Job placeholders themselves violated it), Net ≤ Gross. Placeholders corrected (gross 2100, invoice 42500).
8. **Dead fields wired** — Item Product -> all "Product Name" fields; Tank Type + EmS Code -> Dangerous Goods Declaration (2 new columns, shown in the review table too).
9. Fields flagged `uppercase` are now actually upper-cased as the student types; the error toast shows the specific rule instead of the generic "every field is required".

## B. Logistics -> TCOS bridge (Shipping Bill / Bill of Entry)
1. **Port matcher** — fuzzy word matching silently picked WRONG ports (Mumbai Port -> Nhava Sheva, Kandla -> Mundra, Mumbai Airport -> a seaport, Bahrain -> UAE ...). Now exact match only (blank when unsure). Applied to the Export-Documents bridge too (it shares the matcher). All 154 Job ports verified.
2. **Vocabulary** — units (KG->KGS, MT->MTS, DZN->DOZ, LTR, SQM), package types (Cartons->Carton, Boxes->Box ...), currency CNY, incoterms CPT/DPU/DDP now carry over; TCOS lists extended accordingly (CNY at a static simulator rate of 11.6; CPT validated like CFR).
3. **Importer IEC / PAN** — now passed for imports (PAN derived from the importer GSTIN, which embeds it).
4. **Import country of origin** — uses the Job's "Country of Origin" (Destination field relabelled for imports), not the exporter-country default "India".
5. **Invoice / FOB value** — now Σ (qty × price − discount), the same figure the Job validates.
6. Mirrored into `supplychain-tcos/` (filingForm.js, export-bridge.js, scrutiny.js, data.js lists).

## Files changed
logistics-simulator: documents-data.js, job-engine.js, skelora-institute-dashboard.html, service-worker.js (cache v98), CREATE_A_JOB_STEPS_AND_DOCUMENTS.md
tcos/js: data.js, filingForm.js, export-bridge.js, scrutiny.js · shared/tcos-bridge.js · supplychain-tcos/js: data.js, filingForm.js, export-bridge.js, scrutiny.js · tests/ (new)

## Not verified (be honest)
Visual layout / print output of the new DG columns, a full manual TCOS filing end to end (DSC/OTP, LEO/EGM/OOC), and customs-rule factual accuracy were not re-checked. Jobs saved before v41 are not re-validated until opened and saved again.
