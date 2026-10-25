# GST simulator — QA notes (v27 + v28 + v29)

Method: the real index.html + script.js were run in a headless browser (jsdom, not a real browser). A full flow was driven
page by page: New Registration (Part A, TRN, Part B, Aadhaar OTP, EVC) -> approval -> first login -> GSTR-1 (B2B, B2C large/others/nil,
export, credit + debit note, HSN, documents, summary, validate, submit, file) -> GSTR-3B (3.1, 3.2, ITC, validate, challan,
payment, offset, file). Every figure was compared with a hand calculation. The 6 GSTR-3B/ITC rules were also unit-tested on the old and
new `gst3bLiability` (old code failed 5 of 6).

## Defects fixed
| # | Where | Defect | Fix |
|---|-------|--------|-----|
| 1 | GSTR-1 summary, dashboard table, preview, filing acknowledgement | Credit notes were ADDED to taxable value and tax (and ignored by Generate Summary), so the three screens disagreed. | Credit = minus, debit = plus, everywhere (`gstGstr1Summary`, `allTax`). |
| 2 | GSTR-3B 3.1(a) | Credit/debit notes ignored when auto-populating from GSTR-1. | Net of notes. |
| 3 | GSTR-3B 3.2 | Never auto-filled. | Taxable value of inter-State B2C supplies to unregistered persons is filled from GSTR-1. |
| 4 | GSTR-1 B2C nil/exempt/non-GST | Form defaults the rate to 18, so a nil/exempt invoice saved with the default got 18% tax. | No tax for Nil Rated / Exempt / Non-GST. |
| 5 | GSTR-3B table 4 | 4B(2) "Others" (a reversal) was ADDED to ITC; 4A(1) imports, 4A(2) import of services, 4A(4) ISD were ignored; 4A(3) RCM ITC was ADDED to output liability. | `gst3bLiability` rewritten: ITC = 4A(1..5) minus 4B(1)+4B(2). |
| 6 | GSTR-3B utilisation | ITC was netted head by head only (IGST ITC could not pay CGST/SGST). | Section 49 / Rule 88A order: IGST credit -> IGST, CGST, SGST; CGST credit -> CGST, IGST; SGST credit -> SGST, IGST. RCM tax (3.1(d)) is cash-only. |
| 7 | GSTR-3B payment page | Head table showed all zeros; "Total Liability" was really the net cash figure. | Table shows gross liability, ITC claimed, ITC utilised, cash per head; card shows gross and net. |
| 8 | GSTR-3B offset | After a successful offset the page still said "Remaining Liability" = full amount. | Remaining = total - credit - cash. |
| 9 | GSTR-2B generation | Previous-period check used a fixed year (2026) and the wrong FY key, so April of every year, January 2027 onward and every period outside 2026 could never generate GSTR-2B. | Real previous month/year/FY; months before the registration liability date need no earlier return. |
| 10 | Challan, e-Way Bill, all "Authorized Signatory" fields | Pre-filled with the DEMO GSTIN / "Demo Authorized Signatory" for a registered taxpayer. | Use the registered GSTIN and the primary authorized signatory. |

## v28 - real-GST rules added
| # | Area | Rule now implemented |
|---|------|----------------------|
| 11 | Tax rounding | CGST, SGST and IGST are each rounded to 2 decimals per line. |
| 12 | Due dates | Derived from the period (GSTR-1 11th, GSTR-3B 20th; QRMP 13th / 22nd). The old table was fixed to 2026/27 and wrong for other years. |
| 13 | Interest | Section 50: 18% p.a. on the cash portion of the tax, per head, from the day after the due date until today. Filled automatically in 3B table 5.1. |
| 14 | Late fee | Section 47: Rs 50/day (half CGST, half SGST), Rs 20/day for a nil return, capped at Rs 500 (nil) / 2,000 (AATO up to 1.5 cr) / 5,000 (1.5-5 cr) / 10,000 (above 5 cr). Shown in 3B 5.1 and as a notice on GSTR-1. |
| 15 | Rule 59(6) | GSTR-1 cannot be submitted while GSTR-3B of the two preceding months is pending (taxpayers registered through New Registration, months on/after the liability date). The demo login is not restricted. |
| 16 | GSTR-2B | Generated from the 14th of the following month; no longer depends on the previous GSTR-3B. |
| 17 | Credit ledger | Unused ITC claimed in 3B table 4 is credited to the Electronic Credit Ledger when the return is filed. |
| 18 | Advances | GSTR-1 table 11 (received minus adjusted) is in the GSTR-1 summary and in 3B 3.1(a). |
| 19 | Entry checks | Document date cannot be after the end of the return period or before the liability date; invoice value cannot be less than taxable value; exports without payment must have no IGST, with payment must have IGST (max 40%). |
| 20 | Challan (PMT-06) | Real major head x minor head matrix (Tax, Interest, Penalty, Fee, Others for IGST/CGST/SGST/Cess) and a real tax-period list. The old form credited all interest, penalty and fee to CGST. |

## PDF downloads (gst-pdf.js + vendor/jspdf)
- Registration certificate (FORM GST REG-06 style): button on the Registration Approved / Track Application page.
- GSTR-1 filing acknowledgement: button on the GSTR-1 filing acknowledgement page.
- GSTR-3B filing acknowledgement: button on the GSTR-3B return page once filed.
- Every PDF carries a training disclaimer, a watermark and "Developed by Dot Ecosystem".


## v29 - any state, not only Kerala
| # | Where | Defect | Fix |
|---|-------|--------|-----|
| 21 | Intra-/inter-State logic | `Kerala` was hard-coded as the home state in the B2B, B2C, notes, advances and export forms and in the tax calculation, so a taxpayer registered in any other state got CGST/SGST vs IGST wrong. | The home state is now the taxpayer's registered state (`gstHomeState()`); forms list it first. Verified with a Karnataka registration (GSTIN code 29). |
| 22 | ARN | Always started `AA32` (Kerala). | `AA` + the state code of the application + month + year + 8 characters (Karnataka: `AA29...`). |
| 23 | GSTR-2B / IMS seed documents | Supplier GSTINs, place of supply and ISD office were fixed to other states, so intra-/inter-State credit was wrong for most taxpayers. | Seed suppliers follow the taxpayer's state (one same-state supplier giving CGST+SGST, one other-state supplier giving IGST). |
| 24 | IMS seed | The original SEZ bill of entry and its amendment were both counted (ITC double counted by Rs 12,600). | The original is marked as superseded (rejected) so only the amendment is counted. |
| 25 | Registration certificate PDF | Business activity line was a fixed text. | It now lists the activities ticked on the Principal Place tab. |
| 26 | QRMP due date | GSTR-3B for quarterly filers was always the 22nd. | 22nd for Chhattisgarh, Madhya Pradesh, Gujarat, Maharashtra, Karnataka, Goa, Kerala, Tamil Nadu, Telangana, Andhra Pradesh, Dadra and Nagar Haveli and Daman and Diu, Puducherry, Andaman and Nicobar Islands and Lakshadweep; 24th for all other states and UTs. |

**All 36 states and union territories in the registration drop-down were tested one by one** (17 checks each, 612 in total, all passed): state code and GSTIN prefix (all 36 codes match the real GST state codes and every generated GSTIN passes the real check-character algorithm), ARN prefix, home state, GSTIN check, B2B intra/inter-State tax, B2C Large refusal for the home state, place-of-supply lists, export list, GSTR-2B seed suppliers (same-state CGST+SGST, other-state IGST), table 3.1(a), table 3.2 and ITC auto-population.

Verified by a full run for **AS Group of Industries Private Limited, Bengaluru, Karnataka (July 2026)**: registration -> GSTIN 29AAACA1234C1Z? -> GSTR-1 (taxable 11,45,000; IGST 51,300; CGST 15,800; SGST 15,800) -> GSTR-2B (ITC 48,960 / 10,500 / 10,500) -> GSTR-3B (4B(1) reversal 450 + 450; cash tax 2,340 / 5,750 / 5,750) -> challan -> offset -> filed -> PDFs. 18 expected-value checks passed. The Kerala story still passes.

## Noticed, NOT changed (judgement calls)
- GSTR-3B Table 3.1(a) puts outward invoices marked "reverse charge = Yes" into 3.1(a); the real portal treats these differently.
- GSTR-1 does not check that Table 12 (HSN) and Table 13 (documents) totals agree with the invoices (the real portal only warns).
- GSTR-1 late fee is shown but not debited from the cash ledger.
- QRMP (quarterly) taxpayers are not subject to the Rule 59(6) block.
