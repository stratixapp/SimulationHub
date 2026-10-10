/* =============================================================================
   DOT ERP
   FILE:  data/gl-posting-data.js
   ROLE:  The Phase 6 retrofit pass itself (item 10) — "the single most
          important piece of this entire extension" — PLUS Phase 9's own
          Payroll retrofit, added later the same way. Seven functions now:
          the original five (GRN, Invoice Verification, Vendor Payment,
          Tax Invoice, Receipt) plus two more for Payroll Processing
          (`postPayrollProcessing`, `postSalaryPayment`). Each one builds
          and posts a real, balanced Journal Entry from a real business
          document's own data.

   THE PAYROLL RETROFIT WAS A NAMED, DEFERRED GAP, NOT AN OVERSIGHT: when
   Phase 9's own Payroll Processing module first shipped, its own file
   header said plainly that GL posting was being left for "a future
   dedicated pass," the same scale of work Phase 6 gave its own GL
   Mapping / GL Posting effort. This is that pass. Nothing about
   `payroll-data.js` itself needed to change to support it — the same
   "business module doesn't know GL posting exists" separation below
   already applied cleanly; `pages/payroll.js` just gained two more calls
   into this file, the same shape every other retrofitted page's own
   controller already uses.

   WHY THIS IS ITS OWN FILE, NOT FIVE (NOW SEVEN) EDITS TO SEVEN ALREADY-
   SHIPPED DATA FILES: grn-data.js, invoice-verification-data.js, vendor-
   payment-data.js, tax-invoice-data.js, receipt-data.js, and payroll-
   data.js are all left completely unmodified by this file's own logic.
   Reaching into six already-tested, already-documented files to bolt an
   accounting side effect onto each one's own lifecycle method would
   tangle a business module's own domain logic with GL posting concerns
   it was never designed around. Instead, each retrofitted page's own
   controller — after calling `grn.post()`/`verification.verify()`/
   `payment.markPaid()`/`invoice.raise()`/`receipt.markReceived()`/
   `payrollRun` being Processed or Paid exactly as it always did — makes
   ONE additional call into this file, typeof-guarded the same way every
   other cross-repository call in this project already is. The business
   module doesn't know GL posting exists; this file doesn't know how to
   run a GRN, or a payroll run, through its own workflow. Clean
   separation, each side testable alone.

   NEVER THROWS. EVERY FUNCTION RETURNS {success, entry?, reason?}.
   A trainee who hasn't finished configuring GL Mapping (data/gl-mapping-
   data.js) yet, or hasn't linked a bank account to a Ledger account yet
   (data/bank-data.js's own `linkedAccountId` retrofit), is in a normal,
   expected, mid-setup state — not causing an error. Every function below
   checks its own prerequisites first and returns a specific,
   human-readable `reason` the calling page is expected to show as a
   toast ("This wasn't posted to the books yet — configure the Inventory
   and GR/IR Clearing accounts in Posting Rules first.") rather than
   silently failing or throwing past the caller.

   AUTO-POSTED ENTRIES ARE POSTED, NEVER LEFT AS DRAFT: this is the one
   real, deliberate divergence from Journal Entry's own default. A
   manually-created entry starts as Draft because a human might still be
   assembling it. An auto-posted entry is generated complete, from a
   business event that already fully happened (goods were received, an
   invoice was verified, money actually moved, a payroll run was
   Processed or Paid) — there's nothing left to assemble, and leaving it
   sitting in Draft would just be an extra, pointless click before
   General Ledger/Trial Balance could see it. Every function below calls
   `ERP_JournalEntryRepository.create()` immediately followed by
   `.post()`.

   THE FIVE ORIGINAL POSTINGS, EACH REASONED FROM THE REAL ACCOUNTING
   EVENT:

   1. GRN (on `post()`, the "goods physically received" transition):
      Dr Inventory / Cr GR/IR Clearing, for the GRN's own computed total.
      GR/IR Clearing is a real, standard accrual concept (SAP's own name
      for it) for exactly this gap: goods have arrived and have real
      value sitting in the warehouse, but the vendor's own bill hasn't
      been verified yet, so there's no real Accounts Payable liability
      to a specific vendor to recognize YET — just a provisional one.

   2. Invoice Verification (on `verify()`): Dr GR/IR Clearing / Cr
      Accounts Payable, for the verification's own computed total —
      clearing the provisional liability GRN created and replacing it
      with a real, vendor-owed liability now that the bill itself has
      been checked. NO Input Tax leg: re-checked directly (not assumed)
      that `computeGrandTotal()` on Invoice Verification never separates
      a tax component at all, so there is nothing to split out.
      SIMPLIFICATION, STATED PLAINLY: this assumes the GRN total and the
      Invoice Verification total match exactly, clearing GR/IR fully. A
      mature system handles price/quantity variance between the two with
      its own variance account; this project's Invoice Verification
      module already has its own "informational only" two-way match
      check (see that file's header) rather than a hard variance-posting
      mechanism, so this retrofit doesn't invent one either — it posts
      the verification's own total, whatever that is.

   3. Vendor Payment (on `markPaid()`): Dr Accounts Payable / Cr [the
      Ledger account linked to the payment's own `bankId`], for
      `amountPaid`. Requires the payment to actually have a bank
      selected AND that bank to have a `linkedAccountId` — both
      retrofits this same pass added; a payment made before either
      existed, or one where "Not set" was left on the bank picker,
      simply can't auto-post, and says so.

   4. Tax Invoice (on `raise()`): Dr Accounts Receivable / Cr Sales
      Revenue (the subtotal) / Cr Output Tax Payable (the tax portion,
      ONLY if `computeGrandTotal().taxTotal` is actually nonzero — an
      untaxed invoice gets a clean two-line entry, not a zero-amount
      third line cluttering Journal Entry's own display).

   5. Receipt (on `markReceived()`): Dr [the Ledger account linked to
      the receipt's own `bankId`] / Cr Accounts Receivable, for
      `amountReceived`. Same bank-link requirement as Vendor Payment.

   TWO MORE, ADDED FOR PHASE 9's PAYROLL RETROFIT, EACH ITS OWN REAL
   ACCOUNTING EVENT RATHER THAN ONE COMBINED POSTING:

   6. Payroll Processing (on a run being Processed): Dr Salary Expense
      (the run's own total gross earnings, always present and always
      posted) / Cr PF Payable, Cr Professional Tax Payable, Cr TDS
      Payable (each only when that run's own total for it is actually
      nonzero — the same "no zero-amount line" discipline Tax Invoice's
      own conditional Output Tax leg already established) / Cr Salary
      Payable (the run's own total net pay, always present). Balances by
      construction: gross earnings always equals PF + Professional Tax +
      TDS + net pay, since net pay is defined as gross minus those three
      deductions — never independently verified against Chart of
      Accounts, but genuinely guaranteed by `payroll-data.js`'s own math
      (Node-sandbox verified, see this project's own verification
      scripts). The entry's own date is the PERIOD's last calendar day,
      not the date someone clicked Process — payroll expense is
      recognized for the period it covers, an accrual concept, the same
      reasoning GRN and Invoice Verification's own entry dates already
      use their source document's own date rather than "today."

   7. Salary Payment (on a run being marked Paid): Dr Salary Payable /
      Cr [the Ledger account linked to the bank chosen at the moment of
      marking a run Paid], for the run's own total net pay. This is
      Payroll's own mirror of Vendor Payment's Dr AP / Cr Bank shape —
      but Vendor Payment's own `bankId` is chosen once, at the payment
      record's own creation; a payroll run has no equivalent moment
      before Mark Paid, so `pages/payroll.js` asks for the bank account
      right there, in a small dedicated modal, rather than adding a
      bank-account field to `payroll-data.js`'s own run schema that
      would sit unused until that exact moment.

   `source` on every auto-posted entry is set to the originating event's
   own display name ("GRN", "Invoice Verification", "Vendor Payment",
   "Tax Invoice", "Receipt", "Payroll Processing", "Salary Payment") and
   `sourceRecordId` to that record's own id — exactly the schema
   `journal-entry-data.js` reserved for this from the moment it shipped.
   Payroll Processing and Salary Payment deliberately use TWO DIFFERENT
   `source` values for the SAME `sourceRecordId` (the payroll run's own
   id) — they're genuinely different accounting events (an expense
   recognition vs. a cash disbursement), the same way GRN and Invoice
   Verification are two different postings for the same overall
   procurement flow, never collapsed into one.

   TWO MORE, ADDED FOR PHASE 10's MANUFACTURING RETROFIT — BUILT IN THE
   SAME PASS AS THE MODULES THEMSELVES, NOT DEFERRED THE WAY PAYROLL'S
   OWN GL POSTING WAS: the roadmap explicitly offered either choice here;
   this one was built immediately because depreciation-style reasoning
   applies early — a Work-in-Progress account with no GL impact isn't
   really modeling manufacturing accounting at all, the whole point of a
   WIP account being the journal trail it produces as materials become
   finished goods.

   8. Material Issue for Production (on `post()`): Dr Work-in-Progress /
      Cr Inventory, for the issue's own `totalMaterialCost` (the ACTUAL
      FIFO-weighted-average cost of what was consumed — see material-
      issue-data.js's own header). Reuses the EXISTING `inventoryAccountId`
      role for the credit side, the same account GRN's own posting
      already debits when goods first arrive — a deliberate choice not to
      add a redundant "Raw Materials Inventory" role when one already
      exists and already means "value currently sitting in the
      warehouse." A skipped line (see material-issue-data.js — insufficient
      stock) contributes nothing to `totalMaterialCost`, so this posting
      only ever reflects what actually, physically moved.

   9. Finished Goods Receipt (on `post()`): Dr Finished Goods Inventory /
      Cr Work-in-Progress, for the receipt's own `totalCostCaptured` — the
      allocation math finished-goods-receipt-data.js's own header
      explains in full. This is the entry that actually clears WIP as
      production completes: at any point, [sum of Material Issue debits
      to WIP] − [sum of Finished Goods Receipt credits to WIP] is what's
      genuinely still in progress for a Work Order, the same live
      relationship `work-order-data.js`'s own `getRemainingWipCost()`
      computes for the page to display.
   ROLE-COUNT NOTE: 18 became 19 in the Phase 15 tax-capture retrofit —
   Input Tax Credit Receivable, alongside Invoice Verification's own new
   `invoicedTaxId` field (see that file's own header). Only ONE new role
   was needed, reused by both Invoice Verification (Dr, when tax is
   captured) and Debit Note (Cr, reversing it) — the same "check before
   adding a role" discipline every earlier retrofit pass in this project
   has followed.

   PHASE 19 RETROFIT (item 1): GL posting for the four remaining stock
   movements — Stock Adjustment, Opening Stock, Sales Return, Purchase
   Return. Four more functions, ten through thirteen below, plus a real
   change to `postDebitNote()` (nine) forced by what building thirteen
   found. Two new roles: `inventoryWriteOffAccountId`,
   `openingBalanceEquityAccountId` — see gl-mapping-data.js's own header.

   10. Stock Adjustment (on `post()`): a NET entry across every line in
       one count session, not one entry per line. Shrinkage lines (a
       negative `adjustmentQuantity`) are costed via
       `ERP_StockValuationRepository.computeConsumptionCost()` — the
       identical FIFO-layer-consumption engine `postDeliveryCogs()`
       already uses, threaded through the same way: computed inside
       `stock-adjustment-data.js`'s own `post()` loop, one line at a
       time, BEFORE that line's outgoing Stock Ledger entry is written,
       so a second shrinkage line for the same item on the same
       adjustment costs correctly against what the first one left
       behind. Surplus lines (positive `adjustmentQuantity`) don't need
       that engine at all — `stock-adjustment-data.js` already requires
       a manually-entered `unitCost` on every surplus line (a real
       constraint from the module's own original build, not something
       this retrofit added; see that file's own header), so the surplus
       amount is just `adjustmentQuantity * unitCost`, summed. COST BASIS
       DECISION: found stock is valued at that item's CURRENT WEIGHTED-
       AVERAGE cost in the adjusted warehouse (the usual real-world
       choice), not FIFO — there is no consumed layer to price, and
       inventing a new layer at last-purchase cost would be a guess.
       stock-adjustment.js's form now derives that average live and
       defaults the (still required, still editable) cost field to it
       the moment a line turns into a surplus, rather than leaving a
       blank box for someone to type a number that can drift from the
       Stock Ledger; the field stays blank, and the line therefore
       unpostable until filled by hand, for an item with no valued stock
       to average.
       `Dr Inventory Write-off / Cr Inventory` for the shrinkage total,
       `Dr Inventory / Cr Inventory Write-off` for the surplus total —
       BOTH pairs can appear in the same entry if one count session
       found some items short and others over, and the entry still
       balances by construction either way (shrinkage total and surplus
       total each appear once as a debit and once as a credit, just on
       opposite pairs). A session where every line's cost rounds to
       zero (nothing usable to post) is the one case this returns
       `{success: true, skipped: true}` rather than an entry.

   11. Opening Stock (on `confirm()`): `Dr Inventory / Cr Opening
       Balance Equity`, for `openingQuantity * unitCost` — both already
       sitting on the record itself with nothing to derive, since this
       is the FIRST entry for that (item, warehouse) pair and there is
       no FIFO history yet to consume. `opening-stock-data.js` already
       hard-blocks a second non-Cancelled record for the same (item,
       warehouse) pair (`hasDuplicateForItemWarehouse()`, checked by
       the page before a Draft can even be created) — exactly the
       "postable once" rule this phase's own brief asked for, already
       built before this retrofit began; nothing new needed there.

   12. Sales Return (on `post()`): the missing physical-inventory half
       Credit Note's own header already names ("NO GL POSTING ON THIS
       MODULE... Credit Note... is where the financial reversal
       happens" — checked directly: Credit Note posts
       `Dr Sales Revenue [+ Dr Output Tax] / Cr Accounts Receivable`
       and never touches Inventory or COGS at all). This function fills
       that gap, independently of whether or when a Credit Note is ever
       raised — the same physical/financial split Delivery Challan
       (COGS, physical) and Tax Invoice (Revenue, financial) already
       keep on the way out. Needs a real, NEW per-line fact Sales
       Return didn't capture before this retrofit: `condition`
       (`"Resalable"` or `"Damaged / Scrap"`, defaulting to Resalable
       for lines that predate this field), added to `returnLines[]` —
       see sales-return-data.js's own header for why the GL treatment
       genuinely depends on it. `sales-return-data.js`'s own `post()`
       already looks up each line's cost via
       `ERP_StockValuationRepository.getWeightedAverageCost()` before
       writing its Stock Ledger entry (an INCOMING movement — nothing
       to consume, so no `computeConsumptionCost()` needed here, unlike
       Stock Adjustment's shrinkage lines or Purchase Return below);
       this retrofit only adds capturing that same per-line cost into a
       `costedLines` array threaded out to this function, the identical
       shape `postDeliveryCogs()` already receives from
       `postDeliveryIssue()`. Resalable-line cost is debited to
       Inventory (it genuinely went back into sellable stock — matches
       what the Stock Ledger entry already recorded); Damaged/Scrap-
       line cost is debited to Inventory Write-off instead (physically
       received, but carries no resalable value — the SAME role Stock
       Adjustment's own shrinkage leg uses, reused rather than adding a
       third new role for what is, in both cases, a real loss of usable
       stock value). Either way, the FULL returned cost is credited to
       Cost of Goods Sold — the original sale's COGS is being reversed
       regardless of what happens to the physical unit next; only the
       debit side depends on condition. NAMED SIMPLIFICATION, inherited
       unchanged from sales-return-data.js's own: this still doesn't
       model a separate quarantine/blocked-stock bucket, so a Damaged/
       Scrap line's Stock Ledger quantity (and therefore Stock
       Valuation Report) still shows the same on-hand uplift a Resalable
       line would — only the GENERAL LEDGER now knows the difference.
       A fuller system would need its own blocked-stock warehouse
       status to close that gap; out of scope for this pass, named
       here rather than silently inconsistent.

   13. Purchase Return (on `post()`): the Procurement mirror of 12,
       and genuinely the trickiest of the four, because of what
       already existed here. `purchase-return-data.js`'s own `post()`
       used to write its outgoing Stock Ledger entry UNCOSTED
       (`unitCost: null`, the same convention every other outgoing
       movement in this codebase used) — this retrofit changes that:
       it now costs each active line via `computeConsumptionCost()`
       BEFORE that line's entry is written, the identical interleaved
       pattern `postDeliveryIssue()` established, and returns the
       result as `costedLines` for this function to post against.
       `Dr [Accounts Payable OR GR/IR Clearing] / Cr Inventory`, for
       the FIFO cost — WHICHEVER account is correct depends on whether
       the underlying GRN's own vendor bill has actually been verified
       yet, resolved fresh at post time by walking the SAME GRN -> ...
       -> PO chain `purchase-return-data.js`'s own
       `resolveChainForGrn()` already walks to resolve item ids, then
       checking `ERP_InvoiceVerificationRepository.findVerificationForPo()`
       for a `"Verified"` (not just non-Cancelled — a Draft
       verification hasn't posted anything yet either) result: Verified
       means `postInvoiceVerification()` already moved this GRN's
       liability from GR/IR Clearing into a real Accounts Payable debt,
       so THIS reversal has to debit AP to match; still un-verified
       means the liability is still sitting in GR/IR Clearing, so THAT
       is what a return has to debit instead. Getting this wrong in
       either direction would leave a permanent residual sitting in
       whichever account was never actually credited by the return.

       WHY THIS FORCED A REAL CHANGE TO `postDebitNote()` (NOT JUST A
       NEW FUNCTION SITTING ALONSIDE IT): `postDebitNote()` already
       existed, and for a `"Goods Return"`-type note ALREADY posted
       `Dr Accounts Payable (total) / Cr Inventory (subtotal) / Cr
       Input Tax Credit Receivable (tax)` — the COMBINED reversal of
       both GRN and Invoice Verification, built from the SAME Purchase
       Return's own lines (`buildLinesFromReturn()`, joined by
       `prLineItemId`), priced at the PO's own rate rather than FIFO
       cost. A "Goods Return" Debit Note can only exist for lines that
       have already been through Invoice Verification at all (its own
       `buildLinesFromReturn()` needs a priced Invoice Verification
       line to join against — checked directly before assuming), so in
       practice it only ever debits Accounts Payable, never GR/IR
       Clearing, and that part of its own existing logic stays correct
       unchanged. But its own Inventory credit is a real problem now:
       the physical Purchase Return this note is built from has, by the
       time a trainee could ever raise the note, ALREADY credited
       Inventory once via THIS function (13), at FIFO cost, the moment
       the return itself was posted — a Debit Note credit Inventory a
       SECOND time for the identical physical event would silently
       double the reversal. Sales Return/Credit Note never had this
       problem (checked and confirmed above at 12: Credit Note never
       touched Inventory to begin with), so this is a genuine, new
       asymmetry between the two sides of this codebase, not something
       a shared pattern already handled. THE FIX: `postDebitNote()`
       below now branches on `note.noteType`. A `"Price Adjustment"`
       note (no physical Purchase Return behind it — nothing else has
       ever touched Inventory for it) keeps its ORIGINAL, unmodified
       three-line behavior. A `"Goods Return"` note now posts ONLY the
       tax delta this function (13) has no way to know about at all
       (Purchase Return carries no pricing or tax, by design — see its
       own header): `Dr Accounts Payable / Cr Input Tax Credit
       Receivable`, for `taxTotal`, ONLY when the note actually carries
       tax; a Goods Return note with no tax component now posts
       nothing at all (`{success: true, skipped: true}`) because
       function 13 already finished the entire reversal on its own.
       NAMED SIMPLIFICATION: this means the small residual between
       Purchase Return's own FIFO cost and the Debit Note's PO-priced
       subtotal (the two amounts are USUALLY equal — same layer, same
       price — but can genuinely drift apart if other transactions
       consumed part of that specific FIFO layer in between) is never
       separately reconciled or posted anywhere; the same class of
       named gap Invoice Verification's own header already accepts for
       the GRN/Invoice-Verification match this project doesn't
       variance-account for either.
   ========================================================================== */

const ERP_GlPostingRepository = {
  _missingRoles(mapping, keys) {
    return keys.filter((k) => !mapping[k]);
  },

  _roleLabel(key) {
    const role = ERP_GL_MAPPING_ROLES.find((r) => r.key === key);
    return role ? role.label : key;
  },

  postGrnReceipt(company, grn, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["inventoryAccountId", "grIrClearingAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    const amount = ERP_GrnRepository.computeGrandTotal(grn).total;
    if (!amount) return { success: false, reason: "This GRN has no priced lines, so there's nothing to post." };

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: (grn.postedAt || new Date().toISOString()).slice(0, 10),
      narration: `Goods received against GRN ${grn.grnNumber}`,
      source: "GRN",
      sourceRecordId: grn.id,
      lines: [
        { accountId: mapping.inventoryAccountId, debit: amount, credit: 0, lineNarration: "Inventory received" },
        { accountId: mapping.grIrClearingAccountId, debit: 0, credit: amount, lineNarration: "Provisional liability — invoice not yet verified" }
      ]
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  /** Retrofitted (Phase 15): now genuinely reflects captured tax rather
      than assuming an invoice never carries one. Dr GR/IR Clearing at
      `subtotal` — deliberately still the taxable value only, so this
      leg still exactly matches what postGrnReceipt() already credited
      to the same account; changing that would leave a permanent
      residual balance sitting in a clearing account that's supposed to
      net to zero. Dr Input Tax Credit Receivable at `taxTotal`, ONLY
      when a line actually captured real tax — a vendor bill with no
      tax on it is common and legitimate, not a missing configuration.
      Cr Accounts Payable at the full tax-inclusive `total` — what's
      genuinely owed to the vendor. */
  postInvoiceVerification(company, verification, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["grIrClearingAccountId", "accountsPayableAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    const totals = ERP_InvoiceVerificationRepository.computeGrandTotal(verification);
    if (!totals.subtotal) return { success: false, reason: "This verification has no priced lines, so there's nothing to post." };
    if (totals.taxTotal > 0 && !mapping.inputTaxCreditAccountId) {
      return { success: false, reason: `Not posted to the books yet — this invoice captured tax, so set up ${this._roleLabel("inputTaxCreditAccountId")} in Posting Rules first.` };
    }

    const lines = [
      { accountId: mapping.grIrClearingAccountId, debit: totals.subtotal, credit: 0, lineNarration: "Clearing provisional liability from GRN" }
    ];
    if (totals.taxTotal > 0) {
      lines.push({ accountId: mapping.inputTaxCreditAccountId, debit: totals.taxTotal, credit: 0, lineNarration: "Input tax credit claimed on this bill" });
    }
    lines.push({ accountId: mapping.accountsPayableAccountId, debit: 0, credit: totals.total, lineNarration: "Real liability now owed to vendor" });

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: (verification.invoiceDate || verification.verifiedAt || new Date().toISOString()).slice(0, 10),
      narration: `Vendor invoice verified — ${verification.verificationCode}`,
      source: "Invoice Verification",
      sourceRecordId: verification.id,
      lines
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  /** Delivery Challan's own COGS leg — Dr Cost of Goods Sold, Cr Inventory,
      at the FIFO cost `ERP_StockPostingRepository.postDeliveryIssue()` already
      worked out per line (see that function — cost has to be computed BEFORE
      the outgoing Stock Ledger entry exists, so it's threaded through here as
      `costedLines` rather than re-derived from a ledger that would already
      show the goods gone). This is what makes Sales actually recognise a cost
      against its own revenue: before this function existed, a Tax Invoice's
      own postTaxInvoice() booked Dr AR / Cr Sales / Cr Output Tax and nothing
      ever reduced Inventory or hit an expense account, so Inventory stayed at
      its full purchase value forever and P&L profit was overstated by exactly
      what was sold — a real bug in a real book, not merely a training gap.
      Posted from the Delivery Challan (the actual moment stock leaves), not
      the Tax Invoice — matching how the two documents already divide the
      work here (Delivery Challan moves stock, Tax Invoice recognises revenue)
      and how a perpetual-inventory ERP normally times the two: goods issue
      relieves inventory and books COGS; billing, separately, books revenue.
      Silently does nothing (not an error) if every line was skipped — a
      Delivery Challan with no resolvable items has nothing to cost either. */
  postDeliveryCogs(company, challan, costedLines, actorUsername) {
    const priced = (costedLines || []).filter((l) => l.cost > 0);
    if (!priced.length) return { success: true, skipped: true, reason: "Nothing costed on this challan." };

    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["inventoryAccountId", "costOfGoodsSoldAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Stock moved, but not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }

    const amount = priced.reduce((sum, l) => sum + l.cost, 0);
    const hadShortfall = priced.some((l) => l.shortfallQuantity > 0);

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: (challan.issuedAt || new Date().toISOString()).slice(0, 10),
      narration: `Cost of goods sold — Delivery Challan ${challan.challanCode}`,
      source: "Delivery Challan",
      sourceRecordId: challan.id,
      lines: [
        { accountId: mapping.costOfGoodsSoldAccountId, debit: amount, credit: 0, lineNarration: "Cost of goods delivered" },
        { accountId: mapping.inventoryAccountId, debit: 0, credit: amount, lineNarration: "Inventory relieved at FIFO cost" }
      ]
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername), amount, hadShortfall };
  },

  postVendorPayment(company, payment, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["accountsPayableAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    const bank = payment.bankId ? ERP_BankRepository.findById(payment.bankId) : null;
    if (!bank) return { success: false, reason: "Not posted to the books yet — this payment has no bank account selected." };
    if (!bank.linkedAccountId) return { success: false, reason: `Not posted to the books yet — "${bank.bankName}" isn't linked to a Ledger account. Link one in Bank Master.` };

    const amount = Number(payment.amountPaid) || 0;
    if (!amount) return { success: false, reason: "This payment has no amount, so there's nothing to post." };

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: (payment.paymentDate || new Date().toISOString()).slice(0, 10),
      narration: `Vendor payment ${payment.paymentCode}`,
      source: "Vendor Payment",
      sourceRecordId: payment.id,
      lines: [
        { accountId: mapping.accountsPayableAccountId, debit: amount, credit: 0, lineNarration: "Settling amount owed" },
        { accountId: bank.linkedAccountId, debit: 0, credit: amount, lineNarration: `Paid via ${bank.bankName}` }
      ]
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  postTaxInvoice(company, invoice, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["accountsReceivableAccountId", "salesRevenueAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    const totals = ERP_TaxInvoiceRepository.computeGrandTotal(invoice);
    if (!totals.total) return { success: false, reason: "This invoice has no priced lines, so there's nothing to post." };
    if (totals.taxTotal > 0 && !mapping.outputTaxAccountId) {
      return { success: false, reason: `Not posted to the books yet — this invoice carries tax, so set up ${this._roleLabel("outputTaxAccountId")} in Posting Rules first.` };
    }

    const lines = [
      { accountId: mapping.accountsReceivableAccountId, debit: totals.total, credit: 0, lineNarration: "Amount owed by customer" },
      { accountId: mapping.salesRevenueAccountId, debit: 0, credit: totals.subtotal, lineNarration: "Revenue recognized" }
    ];
    if (totals.taxTotal > 0) {
      lines.push({ accountId: mapping.outputTaxAccountId, debit: 0, credit: totals.taxTotal, lineNarration: "Tax collected, owed to the tax authority" });
    }

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: (invoice.invoiceDate || invoice.raisedAt || new Date().toISOString()).slice(0, 10),
      narration: `Tax invoice raised — ${invoice.invoiceCode}`,
      source: "Tax Invoice",
      sourceRecordId: invoice.id,
      lines
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  /** Phase 15, Module 02 — the exact reverse of postTaxInvoice() above,
      including its own conditional third line. NO new GL mapping roles
      were needed: accountsReceivableAccountId, salesRevenueAccountId and
      outputTaxAccountId already existed and already mean the right thing,
      checked in gl-mapping-data.js before assuming. Deliberately NOT
      booked to a separate "Sales Returns" contra-revenue account — that
      would need a role whose only purpose is presentation, and this
      project's Profit & Loss has no contra-revenue section to show it in;
      named here rather than left as a silent simplification. */
  postCreditNote(company, note, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["accountsReceivableAccountId", "salesRevenueAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    const totals = ERP_CreditNoteRepository.computeGrandTotal(note);
    if (!totals.total) return { success: false, reason: "This credit note has no valued lines, so there's nothing to post." };
    if (totals.taxTotal > 0 && !mapping.outputTaxAccountId) {
      return { success: false, reason: `Not posted to the books yet — this credit note carries tax, so set up ${this._roleLabel("outputTaxAccountId")} in Posting Rules first.` };
    }

    const lines = [
      { accountId: mapping.salesRevenueAccountId, debit: totals.subtotal, credit: 0, lineNarration: "Revenue reversed on credit note" }
    ];
    if (totals.taxTotal > 0) {
      lines.push({ accountId: mapping.outputTaxAccountId, debit: totals.taxTotal, credit: 0, lineNarration: "Tax reversed — no longer owed to the tax authority" });
    }
    lines.push({ accountId: mapping.accountsReceivableAccountId, debit: 0, credit: totals.total, lineNarration: "Amount no longer owed by customer" });

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: (note.noteDate || note.issuedAt || new Date().toISOString()).slice(0, 10),
      narration: `Credit note issued — ${note.noteCode}`,
      source: "Credit Note",
      sourceRecordId: note.id,
      lines
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  /** Phase 15, Module 03b, RETROFITTED IN PHASE 19 (see this file's own
      header, item 13, for the full reasoning) — now TWO different
      postings depending on `note.noteType`, not one.

      "Price Adjustment" (no physical Purchase Return behind it, so
      nothing else has ever touched Inventory for it): UNCHANGED from
      the original — the reverse of the COMBINED GRN + Invoice
      Verification pair. Dr Accounts Payable at the full `total` / Cr
      Inventory at `subtotal` / Cr Input Tax Credit Receivable at
      `taxTotal`, only when nonzero.

      "Goods Return" (built from a Purchase Return that has, by
      construction, already posted its own Dr AP-or-GR/IR / Cr
      Inventory at FIFO cost via `postPurchaseReturnCogs()` the moment
      it was itself posted): posts ONLY the tax delta neither Purchase
      Return nor anything else has reversed yet — Dr Accounts Payable /
      Cr Input Tax Credit Receivable, for `taxTotal`. A Goods Return
      note with no tax component has nothing left for THIS function to
      do at all (`{success: true, skipped: true}`), because function 13
      already finished the whole reversal on its own when the return
      itself posted. `note.noteType` missing entirely (a record from
      before this retrofit, if one somehow exists) falls back to the
      original "Price Adjustment" shape — the safer of the two, since
      it's the one that still works correctly with no physical return
      behind it. */
  postDebitNote(company, note, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const totals = ERP_DebitNoteRepository.computeGrandTotal(note);
    if (!totals.total) return { success: false, reason: "This debit note has no valued lines, so there's nothing to post." };

    if (note.noteType === "Goods Return") {
      if (!totals.taxTotal) {
        return { success: true, skipped: true, reason: "No tax portion to reverse — the inventory and payable value were already posted when the purchase return itself was posted." };
      }
      const missing = this._missingRoles(mapping, ["accountsPayableAccountId", "inputTaxCreditAccountId"]);
      if (missing.length) {
        return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
      }
      const entry = ERP_JournalEntryRepository.create(company, {
        entryDate: (note.noteDate || note.issuedAt || new Date().toISOString()).slice(0, 10),
        narration: `Debit note issued (tax portion) — ${note.noteCode}`,
        source: "Debit Note",
        sourceRecordId: note.id,
        lines: [
          { accountId: mapping.accountsPayableAccountId, debit: totals.taxTotal, credit: 0, lineNarration: "Tax portion no longer owed to vendor" },
          { accountId: mapping.inputTaxCreditAccountId, debit: 0, credit: totals.taxTotal, lineNarration: "Input tax credit reversed — no longer claimable" }
        ]
      }, actorUsername);
      return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
    }

    const missing = this._missingRoles(mapping, ["accountsPayableAccountId", "inventoryAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    if (totals.taxTotal > 0 && !mapping.inputTaxCreditAccountId) {
      return { success: false, reason: `Not posted to the books yet — this debit note reverses tax, so set up ${this._roleLabel("inputTaxCreditAccountId")} in Posting Rules first.` };
    }

    const lines = [
      { accountId: mapping.accountsPayableAccountId, debit: totals.total, credit: 0, lineNarration: "Amount no longer owed to vendor" },
      { accountId: mapping.inventoryAccountId, debit: 0, credit: totals.subtotal, lineNarration: "Inventory value reversed on debit note" }
    ];
    if (totals.taxTotal > 0) {
      lines.push({ accountId: mapping.inputTaxCreditAccountId, debit: 0, credit: totals.taxTotal, lineNarration: "Input tax credit reversed — no longer claimable" });
    }

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: (note.noteDate || note.issuedAt || new Date().toISOString()).slice(0, 10),
      narration: `Debit note issued — ${note.noteCode}`,
      source: "Debit Note",
      sourceRecordId: note.id,
      lines
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  postReceipt(company, receipt, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["accountsReceivableAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    const bank = receipt.bankId ? ERP_BankRepository.findById(receipt.bankId) : null;
    if (!bank) return { success: false, reason: "Not posted to the books yet — this receipt has no bank account selected." };
    if (!bank.linkedAccountId) return { success: false, reason: `Not posted to the books yet — "${bank.bankName}" isn't linked to a Ledger account. Link one in Bank Master.` };

    const amount = Number(receipt.amountReceived) || 0;
    if (!amount) return { success: false, reason: "This receipt has no amount, so there's nothing to post." };

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: (receipt.receivedDate || new Date().toISOString()).slice(0, 10),
      narration: `Receipt ${receipt.receiptCode}`,
      source: "Receipt",
      sourceRecordId: receipt.id,
      lines: [
        { accountId: bank.linkedAccountId, debit: amount, credit: 0, lineNarration: `Received via ${bank.bankName}` },
        { accountId: mapping.accountsReceivableAccountId, debit: 0, credit: amount, lineNarration: "Reducing amount owed by customer" }
      ]
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  _payrollPeriodLabel(payrollRun) {
    const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${MONTH_NAMES[payrollRun.periodMonth - 1]} ${payrollRun.periodYear}`;
  },

  _payrollRunTotals(payrollRun) {
    return (payrollRun.payslipLines || []).reduce((acc, l) => {
      acc.gross += l.grossEarnings;
      acc.pf += l.pfAmount;
      acc.professionalTax += l.professionalTax;
      acc.tds += l.tds;
      acc.net += l.netPay;
      return acc;
    }, { gross: 0, pf: 0, professionalTax: 0, tds: 0, net: 0 });
  },

  /** Called when a payroll run is Processed. Dr Salary Expense / Cr PF
      Payable, Professional Tax Payable, TDS Payable (each conditional —
      see file header) / Cr Salary Payable. Entry-dated to the period's
      own last calendar day, not today. */
  postPayrollProcessing(company, payrollRun, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["salaryExpenseAccountId", "salaryPayableAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }

    const totals = this._payrollRunTotals(payrollRun);
    if (!totals.gross) return { success: false, reason: "This payroll run has no payslip lines, so there's nothing to post." };

    if (totals.pf > 0 && !mapping.pfPayableAccountId) {
      return { success: false, reason: `Not posted to the books yet — this run has PF, so set up ${this._roleLabel("pfPayableAccountId")} in Posting Rules first.` };
    }
    if (totals.professionalTax > 0 && !mapping.professionalTaxPayableAccountId) {
      return { success: false, reason: `Not posted to the books yet — this run has Professional Tax, so set up ${this._roleLabel("professionalTaxPayableAccountId")} in Posting Rules first.` };
    }
    if (totals.tds > 0 && !mapping.tdsPayableAccountId) {
      return { success: false, reason: `Not posted to the books yet — this run has TDS, so set up ${this._roleLabel("tdsPayableAccountId")} in Posting Rules first.` };
    }

    const lines = [
      { accountId: mapping.salaryExpenseAccountId, debit: totals.gross, credit: 0, lineNarration: "Gross salary expense for the period" }
    ];
    if (totals.pf > 0) lines.push({ accountId: mapping.pfPayableAccountId, debit: 0, credit: totals.pf, lineNarration: "PF — employee contribution payable" });
    if (totals.professionalTax > 0) lines.push({ accountId: mapping.professionalTaxPayableAccountId, debit: 0, credit: totals.professionalTax, lineNarration: "Professional Tax payable" });
    if (totals.tds > 0) lines.push({ accountId: mapping.tdsPayableAccountId, debit: 0, credit: totals.tds, lineNarration: "TDS payable" });
    lines.push({ accountId: mapping.salaryPayableAccountId, debit: 0, credit: totals.net, lineNarration: "Net salary payable to employees" });

    const periodEnd = new Date(payrollRun.periodYear, payrollRun.periodMonth, 0).toISOString().slice(0, 10);
    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: periodEnd,
      narration: `Payroll processed — ${this._payrollPeriodLabel(payrollRun)}`,
      source: "Payroll Processing",
      sourceRecordId: payrollRun.id,
      lines
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  /** Called when a payroll run is marked Paid. Dr Salary Payable / Cr
      [the Ledger account linked to `bankId`], for the run's own total
      net pay — Payroll's own mirror of Vendor Payment's Dr AP / Cr Bank
      shape, with the bank chosen at the moment of payment rather than
      stored on the run beforehand (see file header). */
  postSalaryPayment(company, payrollRun, bankId, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["salaryPayableAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    const bank = bankId ? ERP_BankRepository.findById(bankId) : null;
    if (!bank) return { success: false, reason: "Not posted to the books yet — no bank account was selected for this payment." };
    if (!bank.linkedAccountId) return { success: false, reason: `Not posted to the books yet — "${bank.bankName}" isn't linked to a Ledger account. Link one in Bank Master.` };

    const totals = this._payrollRunTotals(payrollRun);
    if (!totals.net) return { success: false, reason: "This payroll run has no net pay to disburse, so there's nothing to post." };

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: new Date().toISOString().slice(0, 10),
      narration: `Salary paid — ${this._payrollPeriodLabel(payrollRun)}`,
      source: "Salary Payment",
      sourceRecordId: payrollRun.id,
      lines: [
        { accountId: mapping.salaryPayableAccountId, debit: totals.net, credit: 0, lineNarration: "Settling net salary payable" },
        { accountId: bank.linkedAccountId, debit: 0, credit: totals.net, lineNarration: `Paid via ${bank.bankName}` }
      ]
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  /** Called when a Material Issue for Production is posted (Draft →
      Issued). Dr Work-in-Progress / Cr Inventory, for the issue's own
      actual, FIFO-weighted-average `totalMaterialCost`. */
  postMaterialIssue(company, materialIssue, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["workInProgressAccountId", "inventoryAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    const amount = Number(materialIssue.totalMaterialCost) || 0;
    if (!amount) return { success: false, reason: "This material issue has no costed lines, so there's nothing to post." };

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: (materialIssue.issueDate || new Date().toISOString()).slice(0, 10),
      narration: `Material issued to production — ${materialIssue.materialIssueCode}`,
      source: "Material Issue",
      sourceRecordId: materialIssue.id,
      lines: [
        { accountId: mapping.workInProgressAccountId, debit: amount, credit: 0, lineNarration: "Materials moved into Work-in-Progress" },
        { accountId: mapping.inventoryAccountId, debit: 0, credit: amount, lineNarration: "Raw materials issued from inventory" }
      ]
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  /** Called when a Finished Goods Receipt is posted (Draft → Received).
      Dr Finished Goods Inventory / Cr Work-in-Progress, for the
      receipt's own allocated `totalCostCaptured` — see finished-goods-
      receipt-data.js's own header for the allocation math. */
  postFinishedGoodsReceipt(company, receipt, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["finishedGoodsInventoryAccountId", "workInProgressAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    const amount = Number(receipt.totalCostCaptured) || 0;
    if (!amount) return { success: false, reason: "This receipt captured no cost, so there's nothing to post." };

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: (receipt.receiptDate || new Date().toISOString()).slice(0, 10),
      narration: `Finished goods received — ${receipt.receiptCode}`,
      source: "Finished Goods Receipt",
      sourceRecordId: receipt.id,
      lines: [
        { accountId: mapping.finishedGoodsInventoryAccountId, debit: amount, credit: 0, lineNarration: "Finished goods capitalized into inventory" },
        { accountId: mapping.workInProgressAccountId, debit: 0, credit: amount, lineNarration: "Clearing Work-in-Progress for units produced" }
      ]
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  /** Called when a Depreciation Run is processed (Draft -> Processed).
      Dr Depreciation Expense / Cr Accumulated Depreciation, for the
      run's own total charge across every asset's own line — built in
      the same pass as depreciation-run-data.js itself, not deferred the
      way Payroll's first GL posting was (see that file's own header). */
  postDepreciationRun(company, run, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["depreciationExpenseAccountId", "accumulatedDepreciationAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    const amount = Number(run.totalCharge) || 0;
    if (!amount) return { success: false, reason: "This run has no depreciation charge, so there's nothing to post." };

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: new Date(run.periodYear, run.periodMonth, 0).toISOString().slice(0, 10),
      narration: `Depreciation for ${run.periodMonth}/${run.periodYear} — ${run.runCode}`,
      source: "Depreciation Run",
      sourceRecordId: run.id,
      lines: [
        { accountId: mapping.depreciationExpenseAccountId, debit: amount, credit: 0, lineNarration: `Depreciation charge across ${(run.lines || []).length} asset(s)` },
        { accountId: mapping.accumulatedDepreciationAccountId, debit: 0, credit: amount, lineNarration: "Accumulating depreciation against fixed assets" }
      ]
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  /** Called when an Asset Disposal is posted (Draft -> Disposed). A real
      compound entry, not a simplified two-line one — see asset-disposal-
      data.js's own header for the full gain/loss reasoning and the Node
      verification that this balances across a gain case, a loss case,
      and a fully-depreciated write-off. Clears the asset at its own
      ORIGINAL COST (never net book value — the Fixed Asset account only
      ever holds cost, exactly the way Accumulated Depreciation as a
      separate contra-account exists to net against it), clears
      whatever's accumulated against it (including this disposal's own
      final partial-period charge), books sale proceeds through the
      SAME bank the disposal itself picked (reusing Vendor Payment's own
      "pick a bank at settlement time" pattern rather than a fixed GL
      role), and posts exactly ONE balancing gain-or-loss line — never
      both, and none at all if the disposal happened to land at exactly
      book value. */
  postAssetDisposal(company, disposal, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const requiredRoles = ["fixedAssetAccountId", "accumulatedDepreciationAccountId"];
    if (disposal.gainOrLoss > 0) requiredRoles.push("gainOnDisposalAccountId");
    if (disposal.gainOrLoss < 0) requiredRoles.push("lossOnDisposalAccountId");
    const missing = this._missingRoles(mapping, requiredRoles);
    if (missing.length) {
      return { success: false, reason: `Not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    const asset = ERP_AssetRepository.findById(disposal.assetId);
    if (!asset) return { success: false, reason: "Linked asset not found." };

    const cost = Number(asset.acquisitionCost) || 0;
    const accumulatedTotal = cost - disposal.netBookValue; // full accumulated incl. this disposal's own final charge
    const lines = [];
    if (accumulatedTotal > 0) lines.push({ accountId: mapping.accumulatedDepreciationAccountId, debit: accumulatedTotal, credit: 0, lineNarration: "Clearing accumulated depreciation" });

    if (disposal.disposalType === "Sale" && disposal.saleProceeds > 0 && disposal.bankId) {
      const bank = typeof ERP_BankRepository !== "undefined" ? ERP_BankRepository.findById(disposal.bankId) : null;
      if (bank && bank.linkedAccountId) {
        lines.push({ accountId: bank.linkedAccountId, debit: disposal.saleProceeds, credit: 0, lineNarration: `Sale proceeds via ${bank.bankName}` });
      }
    }

    lines.push({ accountId: mapping.fixedAssetAccountId, debit: 0, credit: cost, lineNarration: `Removing ${asset.assetName} at original cost` });

    if (disposal.gainOrLoss > 0.005) {
      lines.push({ accountId: mapping.gainOnDisposalAccountId, debit: 0, credit: disposal.gainOrLoss, lineNarration: "Gain on disposal" });
    } else if (disposal.gainOrLoss < -0.005) {
      lines.push({ accountId: mapping.lossOnDisposalAccountId, debit: Math.abs(disposal.gainOrLoss), credit: 0, lineNarration: "Loss on disposal" });
    }

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: disposal.disposalDate,
      narration: `${disposal.disposalType === "Sale" ? "Sale" : "Write-off"} of ${asset.assetName} — ${disposal.disposalCode}`,
      source: "Asset Disposal",
      sourceRecordId: disposal.id,
      lines
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername) };
  },

  /** Called once, right after stock-adjustment-data.js's own post() —
      see this file's own header, item 10. `costedLines` is
      `[{itemId, adjustmentQuantity, cost}]`, one entry per line that
      actually moved (zero-delta lines never reach here), computed and
      returned by that same post() call. A NET entry, not one line per
      movement — see header for why both pairs can legitimately appear
      together. */
  postStockAdjustment(company, adjustment, costedLines, actorUsername) {
    const lines = (costedLines || []).filter((l) => l.cost > 0);
    if (!lines.length) return { success: true, skipped: true, reason: "Nothing costed on this adjustment." };

    const shrinkageAmount = lines.filter((l) => l.adjustmentQuantity < 0).reduce((s, l) => s + l.cost, 0);
    const surplusAmount = lines.filter((l) => l.adjustmentQuantity > 0).reduce((s, l) => s + l.cost, 0);
    if (!shrinkageAmount && !surplusAmount) return { success: true, skipped: true, reason: "Nothing costed on this adjustment." };

    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["inventoryAccountId", "inventoryWriteOffAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Stock moved, but not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }

    const glLines = [];
    if (surplusAmount > 0) glLines.push({ accountId: mapping.inventoryAccountId, debit: surplusAmount, credit: 0, lineNarration: "Surplus found on physical count" });
    if (shrinkageAmount > 0) glLines.push({ accountId: mapping.inventoryWriteOffAccountId, debit: shrinkageAmount, credit: 0, lineNarration: "Shrinkage/loss on physical count" });
    if (shrinkageAmount > 0) glLines.push({ accountId: mapping.inventoryAccountId, debit: 0, credit: shrinkageAmount, lineNarration: "Inventory relieved for shrinkage at FIFO cost" });
    if (surplusAmount > 0) glLines.push({ accountId: mapping.inventoryWriteOffAccountId, debit: 0, credit: surplusAmount, lineNarration: "Surplus offsetting inventory write-off/loss" });

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: adjustment.adjustmentDate || new Date().toISOString().slice(0, 10),
      narration: `Stock adjustment — ${adjustment.adjustmentNumber} (${adjustment.reason || "Physical Count Variance"})`,
      source: "Stock Adjustment",
      sourceRecordId: adjustment.id,
      lines: glLines
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername), shrinkageAmount, surplusAmount };
  },

  /** Called once, right after opening-stock-data.js's own confirm() —
      see this file's own header, item 11. Nothing to cost: both figures
      already sit on the record itself, since this is the first entry
      that will ever exist for this (item, warehouse) pair. */
  postOpeningStock(company, record, actorUsername) {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["inventoryAccountId", "openingBalanceEquityAccountId"]);
    if (missing.length) {
      return { success: false, reason: `Stock moved, but not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }
    const amount = (Number(record.openingQuantity) || 0) * (Number(record.unitCost) || 0);
    if (!amount) return { success: true, skipped: true, reason: "This opening balance has no value, so there's nothing to post." };

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: record.asOfDate || new Date().toISOString().slice(0, 10),
      narration: `Opening stock confirmed — item/warehouse opening balance`,
      source: "Opening Stock",
      sourceRecordId: record.id,
      lines: [
        { accountId: mapping.inventoryAccountId, debit: amount, credit: 0, lineNarration: "Opening inventory balance" },
        { accountId: mapping.openingBalanceEquityAccountId, debit: 0, credit: amount, lineNarration: "Opening balance — offsetting equity" }
      ]
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername), amount };
  },

  /** Called once, right after sales-return-data.js's own post() — see
      this file's own header, item 12. `costedLines` is
      `[{itemId, quantity, cost, condition}]`, one entry per active
      line, computed and returned by that same post() call from the
      SAME weighted-average lookup it already used for its own Stock
      Ledger entry. Full cost always credits COGS; the debit side
      splits by condition. */
  postSalesReturnCogs(company, salesReturn, costedLines, actorUsername) {
    const lines = (costedLines || []).filter((l) => l.cost > 0);
    if (!lines.length) return { success: true, skipped: true, reason: "Nothing costed on this return." };

    const resalableAmount = lines.filter((l) => l.condition !== "Damaged / Scrap").reduce((s, l) => s + l.cost, 0);
    const damagedAmount = lines.filter((l) => l.condition === "Damaged / Scrap").reduce((s, l) => s + l.cost, 0);
    const totalAmount = resalableAmount + damagedAmount;
    if (!totalAmount) return { success: true, skipped: true, reason: "Nothing costed on this return." };

    const mapping = ERP_GLMappingRepository.get(company.id);
    const requiredRoles = ["costOfGoodsSoldAccountId"];
    if (resalableAmount > 0) requiredRoles.push("inventoryAccountId");
    if (damagedAmount > 0) requiredRoles.push("inventoryWriteOffAccountId");
    const missing = this._missingRoles(mapping, requiredRoles);
    if (missing.length) {
      return { success: false, reason: `Stock moved, but not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }

    const glLines = [];
    if (resalableAmount > 0) glLines.push({ accountId: mapping.inventoryAccountId, debit: resalableAmount, credit: 0, lineNarration: "Resalable stock returned to inventory" });
    if (damagedAmount > 0) glLines.push({ accountId: mapping.inventoryWriteOffAccountId, debit: damagedAmount, credit: 0, lineNarration: "Damaged/scrap stock returned — no resale value" });
    glLines.push({ accountId: mapping.costOfGoodsSoldAccountId, debit: 0, credit: totalAmount, lineNarration: "Cost of goods sold reversed on return" });

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: (salesReturn.returnedAt || new Date().toISOString()).slice(0, 10),
      narration: `Cost reversed on sales return — ${salesReturn.returnCode}`,
      source: "Sales Return",
      sourceRecordId: salesReturn.id,
      lines: glLines
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername), resalableAmount, damagedAmount };
  },

  /** Called once, right after purchase-return-data.js's own post() —
      see this file's own header, item 13 for the full reasoning,
      including why this also changed `postDebitNote()` above.
      `costedLines` is `[{itemId, quantity, cost}]`, one entry per line
      that actually posted (a line skipped for insufficient stock never
      reaches here), computed via the SAME `computeConsumptionCost()`
      FIFO engine `postDeliveryCogs()` uses, threaded through the same
      interleaved way. Debits Accounts Payable if the underlying GRN's
      vendor bill has already been Verified, GR/IR Clearing otherwise —
      resolved fresh here by walking the same chain purchase-return-
      data.js's own resolveChainForGrn() already walks. */
  postPurchaseReturnCogs(company, purchaseReturn, costedLines, actorUsername) {
    const lines = (costedLines || []).filter((l) => l.cost > 0);
    if (!lines.length) return { success: true, skipped: true, reason: "Nothing costed on this return." };
    const amount = lines.reduce((s, l) => s + l.cost, 0);
    if (!amount) return { success: true, skipped: true, reason: "Nothing costed on this return." };

    let originalLegIsAp = false;
    if (typeof ERP_PurchaseReturnRepository !== "undefined" && typeof ERP_InvoiceVerificationRepository !== "undefined") {
      const grn = purchaseReturn.linkedGrnId && typeof ERP_GrnRepository !== "undefined" ? ERP_GrnRepository.findById(purchaseReturn.linkedGrnId) : null;
      if (grn) {
        const { po } = ERP_PurchaseReturnRepository.resolveChainForGrn(grn);
        if (po) {
          const verification = ERP_InvoiceVerificationRepository.findVerificationForPo(company.id, po.id);
          if (verification && verification.status === "Verified") originalLegIsAp = true;
        }
      }
    }
    const legRoleKey = originalLegIsAp ? "accountsPayableAccountId" : "grIrClearingAccountId";

    const mapping = ERP_GLMappingRepository.get(company.id);
    const missing = this._missingRoles(mapping, ["inventoryAccountId", legRoleKey]);
    if (missing.length) {
      return { success: false, reason: `Stock moved, but not posted to the books yet — set up ${missing.map((k) => this._roleLabel(k)).join(" and ")} in Posting Rules first.` };
    }

    const entry = ERP_JournalEntryRepository.create(company, {
      entryDate: (purchaseReturn.returnedAt || new Date().toISOString()).slice(0, 10),
      narration: `Goods returned to vendor — ${purchaseReturn.returnCode}`,
      source: "Purchase Return",
      sourceRecordId: purchaseReturn.id,
      lines: [
        { accountId: mapping[legRoleKey], debit: amount, credit: 0, lineNarration: originalLegIsAp ? "Amount no longer owed to vendor" : "Clearing provisional liability for returned goods" },
        { accountId: mapping.inventoryAccountId, debit: 0, credit: amount, lineNarration: "Inventory relieved at FIFO cost" }
      ]
    }, actorUsername);
    return { success: true, entry: ERP_JournalEntryRepository.post(entry.id, actorUsername), amount, originalLegIsAp };
  }
};

