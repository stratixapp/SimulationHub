# SimulatorHub v35 — changes over v34 (all verified in source before changing)

## Logistics Simulator
1. **Computed numbers are now saved** (engine.js `skPersistComputedContextFields`, called from `saveProgressSnapshot`).
   BoE No., OOC No., DO No., Shipping Bill No., Sales Order No., AWB No., Warehouse Receipt No., Gate Pass No. were only
   displayed, never stored, so cross-document autofill only worked when TCOS wrote the number. Placeholder text is never
   stored; a number typed by the student / written by TCOS is never overwritten.
2. **One key for the Bill of Entry number**: `txn.boeNo` (Duty Challan, Examination Report, Importer Authorization) -> `txn.billOfEntryNo`.
3. **Orphan keys connected**: Import Packing List invoice/BL now use `txn.commercialInvoiceNo` / `txn.blNo`; Import Invoice
   (supplier invoice no.) and Duty Calculation supplier invoice no. now carry `txn.commercialInvoiceNo`, so Bill of Entry and
   Delivery Order autofill the invoice number; Import Packing List no. carries `txn.packingListNo`.
4. **No more fake numbers**: Delivery Order "Customs Entry No." and CFS Gate Pass "Bill of Entry No." autofill the student's
   Bill of Entry number (`txn.billOfEntryNo`); Gate Pass numbers share `txn.gatePassNo` (Out of Charge -> Delivery Order -> CFS Gate Pass).
   Out of Charge gate pass format is now GP-YYYY-NNNNNN (it was GP-NNNNN, which the Delivery Order rejected). Delivery Order
   customs-entry pattern widened to 30 chars (a generated BoE number is 21).
5. **Customs Declaration** never adds different currencies (USD 1000 + INR 20000); totals are per currency, dutiable value is INR lines only.
6. Delivery Order Packing List pattern no longer rejects the Import Packing List's own example (IPL/2026/005812).
7. Out of Charge Importer IEC pattern aligned with every other document (10 letters/digits).
8. Arrival Notice demurrage is measured to the notice's Sign/Issue Date, not today's date.
9. Required quantity / weight / volume / price / value fields reject 0 (tax, rate, charge, freight, discount ... still allow 0).
10. Duty Challan IGST placeholder 89,100 -> 89,910 (18% x (450,000 + 45,000 + 4,500)).
11. **7-digit Shipping Bill / Bill of Entry number** (customs-forms.js `seqDigits`) no longer picks up the year digit
    (`INENR1/SB/2026/001123` printed 6001123, now 0001123; a TCOS number printed differently in the two apps).
12. Prerequisites added: Import Packing List <- Import Invoice, Duty Challan <- Duty Calculation, Examination Report <- Bill of Entry.
13. Service worker cache skelora-v92 -> v93.

## TCOS bridge
14. Duty Challan: the CIN the student must type in the Bill of Entry wizard is now the challan number used at payment
    (it used to issue a second number, CHLN-xxxxxx).
15. Returning from a bridged import now completes Out of Charge **and** Assessment Copy, Duty Calculation, Duty Challan
    and (if an examination happened) Examination Report. `DotBridge.silentCompleteLogisticsDoc` accepts an optional `extraFields` object.

## Not changed (needs a decision) — see chat
- Bill of Entry needs duty totals but Duty Calculation comes after it.
- Import Permit / Import Checklist / Importer Authorization are still prerequisite-free.
- EDI Copy / Assessment Copy `originalDocNo` is always tagged `txn.billOfEntryNo`, even for a Shipping Bill.


## v36
- Create a Job: item **Expiry Date** is optional.

## v37
- Create a Job: item **Batch No.** and **Manufacturing Date** optional too. **Vizhinjam Port, Kerala** added (Create a Job ports, Booking dropdown, TCOS port lists).

## v38
- **Mandatory / Optional label** for Sea Export Shipment Lots (36 Mandatory, rest Optional) on the document cards, in the Create a Job document picker and in the document banner. Label only.

## v39
- **Vessel IMO Number** accepts 7 digits with or without the `IMO` prefix in every document. Booking Confirmation Special Cargo Type: new option `High Value`. Container Packing Certificate Cargo Classification: new option `Special Cargo — Controlled / High Value`. Service worker cache skelora-v97.

## v40
- TCOS HS code table (tcos + supplychain-tcos): added **84314310** (parts of boring or sinking machinery) and **84148090** (air compressors, other), both 7.5% BCD, so the Italy -> Cochin import dataset (mining drilling rigs, spares, compressors) can be filed in TCOS with matching HS codes. 84304100 already existed.
- Matching data: Italy_to_Cochin_Import_Shipment_29_Documents_TCOS_BoE_v1.txt.
