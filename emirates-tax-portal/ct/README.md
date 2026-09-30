# UAE Corporate Tax Filing Simulator (EmaraTax training replica)

An offline, browser-based training simulator that walks a learner through filing a
UAE Corporate Tax Return on a replica of the EmaraTax portal.

Reached from the EmaraTax portal (VAT service dashboard → Corporate Tax), or directly at `ct/index.html`.

The company, TRN, Emirates ID, UAE PASS and contact details are read live from the VAT registration on this browser — the student registers once and both services show the same taxable person.

---

## The learner journey

| # | Page | What happens |
|---|------|--------------|
| 1 | `index.html` | FTA EmaraTax landing page → *Sign in with UAE PASS* |
| 2 | `uaepass.html` | UAE PASS login (any value is accepted, the field cannot be left empty) |
| 3 | `taxable-persons.html` | Taxable Person List → *View* |
| 4 | `dashboard.html` | Registration Overview, required actions, 5 working tabs |
| 5 | `corporate-tax.html` | Corporate Tax service tiles → *Corporate Tax Filings* |
| 6 | `ct-filings.html` | Filing Details table, live status (Open → Draft → Submitted) → *File* |
| 7 | `return-instructions.html` | Guidelines, accordions, confirmation checkbox → *Start filing* |
| 8 | `return.html` | The 8-step Corporate Tax Return |
| 9 | `submitted.html` | Acknowledgement with application number and net tax position |

Progress is stored in the browser (localStorage), so a learner can close the tab and
continue later. **Reset exercise** in the top ribbon clears everything and starts again.

## The 8 return steps

1. **Taxpayer Details** – read-only registration data, editable address, taxable person
   information, business activity table (add/remove rows, percentages must total 100%), Free Zone questions
2. **Elections** – realisation basis, transitional rules, Small Business Relief
3. **Accounting Schedules** – figures from the financial statements
4. **Accounting Adjustments and Exempt Income** – dividends, foreign PE, other exemptions
5. **Reliefs** – qualifying group, restructuring, tax losses brought forward
6. **Other Adjustments** – non-deductible expenditure, interest limitation, transfer pricing
7. **Tax Liability and Tax Credits** – full computation chain, foreign and withholding tax credits
8. **Review and Declaration** – generated summary, declaration, submission

## Tax rules built into the calculation

| Rule | Treatment in the simulator |
|------|---------------------------|
| Standard rate | 0% on the first AED 375,000 of taxable income, 9% on the balance |
| Small Business Relief | Revenue ≤ AED 3,000,000 in this **and every previous** tax period, not a QFZP or MNE member, tax period ending on or before **31 Dec 2029** (Ministerial Decision No. 131 of 2026). Taxable income treated as nil; that period's losses and net interest cannot be carried forward |
| Qualifying Free Zone Person | 0% on Qualifying Income, 9% on Non-Qualifying Income, no 375,000 threshold; lost if the standard-regime election is made or if Non-Qualifying Revenue exceeds the de minimis (lower of 5% of revenue or AED 5,000,000) |
| Entertainment expenditure | 50% added back as non-deductible |
| General interest deduction limitation | Deductible interest = higher of 30% of adjusted EBITDA or AED 12,000,000; the excess is added back |
| Tax losses | Offset capped at 75% of taxable income before the offset; the balance is carried forward |
| Tax credits | Foreign tax credit and withholding tax credit, capped at the tax before credits |
| Domestic Minimum Top-up Tax | MNE Groups with consolidated revenue ≥ AED 3,150,000,000 (EUR 750m) are topped up to a 15% minimum effective rate (Pillar Two, periods from 1 Jan 2025), unless the UAE jurisdiction passes the **Transitional CbCR Safe Harbour** — de minimis (revenue < EUR 10m and profit < EUR 1m), routine profits (profit ≤ Substance-based Income Exclusion), or simplified ETR (≥ 15%/16%/17% depending on the year) |

Validation runs continuously. The counter beside *Cancel* shows how many items still need
attention across the whole return; clicking it lists them and jumps to the right step.

## Files

```
index.html  uaepass.html  taxable-persons.html  dashboard.html
corporate-tax.html  ct-filings.html  return-instructions.html
return.html  submitted.html
assets/css/emaratax.css      all styling (no CDN, no Tailwind)
assets/js/emaratax.js        shared portal behaviour + saved state
assets/js/return.js          return binding, validation and tax engine
```

Everything is self-contained: no Tailwind CDN, no Font Awesome, no Google Fonts, no
external images. Icons are inline SVG, so the simulator works on a classroom machine
with no internet access.

## Paying the Corporate Tax (Magnati Pay)

After a return is submitted, `submitted.html` and `ct-filings.html` show a **Pay now** button
(when the net Corporate Tax payable is above AED 0). It opens `payment.html`:

1. **Review** – amount, period, due date, consent tick-box.
2. **Fund account** – the simulator auto-credits the student's linked training bank account
   (*Al Noor Training Bank*) with the exact amount due. No real bank is contacted.
3. **Magnati Pay** – training replica of the gateway. Pay by account or by card, with a
   simulated SMS one-time password (shown as an on-screen message, 3 attempts, 3-minute
   life, resend after 30 s) and a 10-minute session timer.
4. **Processing** – authorise, debit, confirm with FTA, issue receipt.
5. **Receipt** – payment reference (`CTPAY-YYYY-xxxxxx`), print or download PDF.

Test cards (any future expiry, any 3-digit CVV): `4111 1111 1111 1111` approves,
`4000 0000 0000 0002` is declined (05), `4000 0000 0000 9995` has insufficient funds (51).

The payment is saved under `filing.payment` in the Corporate Tax store. Card numbers and
CVVs are never stored, only brand + last 4. Resetting the exercise clears the payment.

Files: `payment.html`, `assets/js/ct-payment.js`, `assets/css/ct-payment.css`; the receipt
PDF is `ET_CT_PDF.receipt()` in `assets/js/ct-pdf.js`.

## Customising the exercise

- Taxable person, TRN, period dates and due dates: `DEFAULTS` at the top of
  `assets/js/emaratax.js`
- Thresholds and rates: the constants at the top of `assets/js/return.js`
  (`THRESHOLD`, `RATE`, `SBR_REVENUE_CAP`, `INTEREST_SAFE_HARBOUR`, `LOSS_CAP_RATE`)
- Business activity choices: `ACTIVITY_OPTIONS` in `assets/js/return.js`

## Note

This is a training replica for classroom use. It is not connected to the Federal Tax
Authority, no data leaves the browser, and no return is actually filed. Screens are
modelled on the public EmaraTax interface for teaching purposes; all rights in the
original design and marks belong to the FTA.
