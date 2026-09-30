# SimulatorHub — Consignia Desk ⇄ Logistics Simulator Bridge

## What changed and why

Your SimulatorHub already had a genuinely well-built SSO bridge
(`shared/tcos-bridge.js` + the `TCOS_BRIDGE_SLUGS` popup in
`logistics-simulator/engine.js`) for Shipping Bill, Bill of Entry, and the
Freight Booking module. This extends the SAME mechanism — nothing about
the existing bridge for those was touched — to cover the 13 documents
where Consignia Desk (inside `/tcos`) now has a genuinely deeper
workstation than the Logistics Simulator's own fill-in exercise:

Commercial Invoice, Packing List, Certificate of Origin, Insurance
Certificate, Letter of Credit, Bill of Exchange, Export License/SCOMET,
Phytosanitary/Health/Fumigation/Catch/HACCP Certificates, and the
Dangerous Goods Declaration.

## The flow, exactly as you asked for

1. Student opens one of those 13 documents in the Logistics Simulator.
2. A popup offers a choice: do the fill-in exercise here, or **"Do it for
   real, in TCOS's Consignia Desk"**.
3. Choosing Consignia Desk asks for their password (confirms identity)
   and the **TCOS Access ID (111400112)** — same one already used
   elsewhere in the hub, nothing new to remember.
4. Correct ID → real SSO handoff (mirrors their account into TCOS,
   pre-signs the session) → lands in TCOS, **already logged in, no second
   login screen**.
5. Instead of TCOS's own scenario picker, it lands straight on the Export
   Brief — **pre-filled from the same Job data already typed in the
   Logistics Simulator** (buyer, HS code, currency, Incoterm, payment
   method, mode, destination — fuzzy-matched the same cautious way the
   existing Shipping Bill bridge already does: confident match or leave
   blank, never guess wrong). Student reviews, clicks Create — no
   scenario needed, exactly as you asked.
6. It opens **directly** on the one document that was bridged (e.g.
   Packing List) — not the Export Job dashboard, not a document list.
7. The moment that document is marked Ready in Consignia Desk, a "Return
   to Logistics Simulator" prompt appears, and going back marks it
   complete there too — same completion pattern as the existing bridge.

## What's verified (real tests, both directions, real localStorage — not
just code review)

Two jsdom integration tests, both served over a real local HTTP origin
(jsdom blocks localStorage entirely under `file://`, so this was
necessary to test the actual mechanism, not just the app logic around
it):

- **Logistics Simulator side**: the popup renders correctly labeled
  "Consignia Desk" for the new `packing-list` slug; a wrong access ID is
  rejected with no bridge record written; the correct access ID
  (111400112) writes a real bridge record with `filingType: 'consignia'`,
  the right target document, and the actual active Job's data (buyer
  name, HS code, items) attached — plus confirms the TCOS session is
  genuinely pre-signed (true SSO, not a disguised second login).
- **Consignia Desk / TCOS side**: booting with that real bridge record
  present lands directly on a pre-filled Export Brief (confirmed every
  fuzzy-matchable field carried over correctly, and confirmed
  `commodityCategory` — which has no Logistics Simulator equivalent — was
  correctly left blank rather than guessed); submitting it skips straight
  to the Packing List workstation with zero extra clicks; marking it
  Ready correctly fires the completion handoff and updates the real
  bridge record in localStorage to `completed: true`.

## What this doesn't touch

The existing Shipping Bill / Bill of Entry / Freight Booking / BRC bridge
— completely unchanged, same behavior as before. Your other simulators in
this hub (GST, Procurement, HR & Payroll, Office Administration, Cadence,
Emirates Tax Portal, supplychain-tcos) were not touched at all.

## Files actually changed

`shared/tcos-bridge.js` (added `consignaDocType` to the bridge record),
`logistics-simulator/engine.js` (13 new bridge slugs + label logic),
`tcos/index.html`, `tcos/css/style.css`, `tcos/js/app.js`,
`tcos/js/data.js`, `tcos/js/state.js` — plus 14 new files under
`tcos/js/export-*.js` (the whole Consignia Desk module, including the new
`export-bridge.js` that receives the handoff). Nothing in any other
simulator folder was touched.

---

## Update: ports, deeper Bill of Lading, a real Logistics Simulator bug fix, and cross-document suggestions

### 1. Port lists fixed (was genuinely too short)
`INDIAN_PORTS` and `FOREIGN_PORTS` in `tcos/js/data.js` went from 10+10 to
**21 + 132**, generated directly from the Logistics Simulator's own richer
port/country dataset (`job-engine.js`'s `INDIA_LOADING_PORTS` /
`DISCHARGE_PORTS_BY_COUNTRY`) — so port names now match exactly between
the two apps, which also makes the bridge's fuzzy-matching more accurate.
This affects every port dropdown across Consignia Desk, not just the BL.

### 2. Bill of Lading / Air Waybill made genuinely deeper
Was too quick to finish because containers/seals were a single flat text
field. Now:
- **Real container table** (like Invoice/Packing List's line items) —
  container no., seal no., type, package count/type, gross weight, volume
  per row, with live totals.
- **Booking Number**, **Shipping Instructions Reference**, **Number of
  Originals Issued**.
- **Verified Gross Mass (VGM)** section — method, responsible party,
  submission date (Sea only).
- **Freight charge breakdown** — ocean/air freight, THC, document fee,
  other charges (was just a Prepaid/Collect dropdown before).
- **Dangerous Goods flag** with a conditional DG reference field.
- **Clauses/Remarks** free text (e.g. "Clean on Board").
- "Apply from Booking" now populates the container table directly from
  the freight booking's own container list.

### 3. Real bug fixed in the Logistics Simulator's own Bill of Lading
Step 8 ("Dangerous Goods & Special Cargo") had a checkbox —
`specialCargoSignoff`, required — that was missing the `showIf` gate every
other field in that step has. Selecting "No" for dangerous goods correctly
hid the DG-specific fields, but this one still silently stayed required,
blocking "Next" with no visible reason why. Fixed by adding the same
`showIf:d=>d.isDangerousGoods==="Yes"` its siblings already use — in
`logistics-simulator/documents-data.js`.

### 4. Cross-document value suggestions (new)
If a value was typed correctly in one document, it now shows up as a
native browser suggestion (not an autofill — nothing is ever filled in
without the student picking it) when typing the same kind of value into
another document in the same Export Job. Wired into container number,
seal number, exporter/buyer/consignee names, IEC, GSTIN, invoice number,
currency, and HS code across Commercial Invoice, Packing List, Bill of
Lading/AWB, Certificate of Origin, and Insurance Certificate. Directly
targets the exact typo-driven mismatches the consistency engine keeps
catching.

### On the manifest.json error (screenshot)
Not a bug — `manifest.json` is correctly linked and present. That error
only appears when opening `index.html` directly by double-click
(`file://...`); browsers block PWA manifest loading under `file://` for
security, unconditionally. Serve the hub through any local web server
instead and it goes away.

### Verified
Full local jsdom test re-run end to end (Job creation → Invoice → Packing
List → Bill of Lading with the new container table sourced from a real
booking → CoO → Insurance → LC + compliance → Bill of Exchange → License
→ commodity cert → Final Audit fail-then-pass → scenario interconnection
→ print preview → **cross-document suggestion confirmed working**: a
container number typed earlier showed up as a real `<datalist>` option in
Packing List). Both bridge integration tests (Logistics-side popup +
access ID, TCOS-side receive + pre-fill + completion) re-run against the
updated build and still pass.
