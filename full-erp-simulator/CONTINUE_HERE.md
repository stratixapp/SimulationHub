# Dot ERP Training Simulator — Continue Here

## 1. What this project is

A single-page-app-style ERP training simulator: a realistic, fully client-side (localStorage-backed, no real backend) Indian-context ERP whose purpose is to TEACH how enterprise resource planning software works — real business processes, real validation rules, real terminology (GSTIN, HSN/SAC, IFSC, CGST/SGST/IGST, three-way matching, etc.) — through an actually-usable, professionally-designed UI. Every module ships with its own "Training Guide" drawer (Purpose / Business Process / Real Industry Usage / Tips / Common Mistakes / ERP Best Practices) so a learner understands not just HOW to click through a screen but WHY it works that way in a real company.

**The person you're working with wants REAL DEPTH — genuine ERP behavior, not a simplified toy.** Every module so far has earned its complexity by modeling something a real procurement/finance team actually does (line items, approval splits, exclusivity rules, composite-key uniqueness, etc.). Keep that bar. Don't simplify a module just to move faster — if a real ERP would have a concept, model it, and explain the trade-off in the file header if you simplify anything.

## 2. Core build rules (do not deviate from these)

1. Every list-type module gets: search, filter chips, sort, pagination, CSV export, Print.
2. Every form gets: validation, a sensible duplicate check (or an explicit, documented decision that none applies — see Section 9), Save/Cancel (Reset only on genuinely single-record settings-style forms — Company Profile, Financial Year, Notifications, user Profile — never on a list module's Add/Edit modal), a confirmation dialog before anything consequential, auto-generated codes.
3. Every destructive or state-changing action goes through the shared confirm dialog — UNLESS it needs to capture free text first (e.g. a rejection reason), in which case a small dedicated modal replaces it for that one action only.
4. Multi-state lifecycle records keep the table row to one View + one contextual quick-action button; everything else lives in the Detail modal's footer. For a genuine multi-branch WORKFLOW, both the quick-action AND the footer button set change per status, not just their labels or colors.
5. Reuse the shared `window.ERP` runtime API and existing `style.css` component classes before writing anything new. Grep first.
6. Think through each module's REAL-WORLD shape deliberately — don't copy-paste the previous module's pattern out of habit. Flat vs. hierarchical, workflow vs. simple record, hard vs. soft vs. no duplicate-check, which field is actually unique, whether a status is a reversible filter or a one-way pipeline, whether this module even needs its own data file or should extend an existing repository — these are judgment calls made fresh per module, justified in that module's own file header.
7. **Full validation pass after every module**: `node --check` on every `.js` file, HTML tag-balance + duplicate-ID check, CSS brace-balance check, and ID cross-referencing between each page's `.js` and its own `.html`. `validate.py` exists at the project root's parent — see Section 11. Run it after EVERY module, no exceptions. **Known blind spot**: it does not catch a CSS class referenced in HTML/JS that doesn't actually exist in `style.css` (bitten by this once already — `.kpi-card__icon--info` doesn't exist, only `--accent/--success/--warning/--danger` do). Grep `style.css` yourself before trusting a new class renders.
8. **A recurring copy-splice mistake to avoid**: when building a new page from `cp <template>.html <new>.html` and then Python-splicing in new content-header/training/modals blocks by line-number range, it's very easy to leave a duplicate `#confirmDialog` block behind (happened 3 times across this project so far). The reliable fix: when replacing the modals section, either (a) replace ALL THE WAY THROUGH the old `#confirmDialog`'s closing `</div>` and include exactly one new `#confirmDialog` in the replacement block, or (b) replace only UP TO (not including) the old `#confirmDialog` and don't include one in the new block at all, leaving the original untouched. Approach (b) proved more reliable in practice. **Always `grep -c 'id="confirmDialog"' <file>` immediately after any modal splice** — it should print exactly `1` — before moving on to the next step.
9. **New as of Phase 11, non-negotiable from here on**: every module from Phase 12 onward must be RBAC-aware from its own FIRST version, not retrofitted later. Concretely, that means: (a) add the new page's own `pageKey` to `ERP_PAGE_ROLE_MAP` in `data/rbac-data.js` as part of building that page, choosing the functional role(s) that genuinely own it (or `"*"` if it's a true personal/utility page) — an unlisted page fails CLOSED (Admin-only) by design, so forgetting this step doesn't fail silently, but it does mean nobody else can reach a module they should be able to; (b) call `if (!window.ERP.enforcePageAccess(session, "pageKey")) return;` immediately after the existing `requireSession()` check, the same calling convention every one of the 85 pages retrofitted in Phase 11 already follows; (c) load `<script src="../data/rbac-data.js"></script>` immediately after `<script src="../script.js"></script>`. If the new module has any mutating action that does NOT go through `window.ERP.openConfirm()` or `window.ERP.openModal()` (an inline per-row save, the one shape Phase 11 found doesn't get caught for free — see Vendor Selection's own retrofit in `pages/vendor-selection.js` for the exact pattern), add its own direct Viewer check at that action's own point, not just the page-level gate.

## 3. Full roadmap & current progress

### Phase 1 — System Foundation ✅ **COMPLETE (10/10)**
### Phase 2 — Company Setup ✅ **COMPLETE (10/10)**
### Phase 3 — Master Data ✅ **COMPLETE (10/10)**
1. Customer Master · 2. Vendor Master · 3. Warehouse Master · 4. Category Master · 5. Unit Master · 6. Item Master · 7. Tax Master · 8. HSN Master · 9. Payment Terms · 10. Bank Master

### Phase 4 — Procurement ✅ **COMPLETE (20/20)** — detailed procure-to-pay simulator

1. ✅ **Department Need** — first TRANSACTIONAL/WORKFLOW module (everything in Phases 1-3 was Master Data). 5-state lifecycle (Draft→Submitted→Approved/Rejected, +Cancelled). Introduced: status-gated edit/delete, a non-blocking soft duplicate nudge, live-resolved actor identity via login username.
2. ✅ **Purchase Requisition** — first LINE-ITEM (header + child records) document. Header (`raisedByEmployeeId` required) + `lineItems[]`, each optionally linking ONE Department Need and/or ONE catalog Item. Introduced: cross-module EXCLUSIVITY (a Need claimed by at most one PR — `getLinkedNeedIds`/`getAvailableNeedsForCompany`), a duplicate check scoped to a parent's own child collection, and the pattern of a module whose OWN approval step is deliberately owned by a different, later module (`approve()`/`reject()` built but never wired to a button here).
3. ✅ **PR Approval** — first module with **no data file of its own** — reads/writes `ERP_PurchaseRequisitionRepository` exclusively, finally calling the `approve()`/`reject()` Module 2 left unwired. First list whose default filter isn't "All" (defaults to the Submitted queue). Introduced soft, non-blocking role realism (`praRoleHint`) without enforcement.
4. ✅ **RFQ Creation** — `data/rfq-data.js`. Required, exclusive link to ONE Approved PR (same claim-a-resource shape as #2). First genuinely simpler status lifecycle (Draft→Sent→Closed+Cancelled, NO approval gate — an RFQ commits to nothing financially). First multi-select UI (`.checkbox-list` — new CSS, invited vendors).
5. ✅ **Vendor Selection** — **no new data file** — retrofits `rfq-data.js` with `vendorDecisions` (keyed by vendor id) rather than inventing a new document type. Decisions save immediately per-row (no big form Save) — the first "quick, individually-reversible working decision" UI shape.
6. ✅ **Quotation Receipt** — `data/quotation-data.js`. Per-LINE pricing (`lineQuotes[]`, mirroring the PR's own line items one hop downstream). First HARD uniqueness constraint on a COMPOSITE (rfqId, vendorId) key — a genuinely new duplicate-check shape (not a single field, not a cross-parent exclusivity claim). Vendor pool is further narrowed than "invited" — only vendors Module 5 marked Selected.
7. ✅ **Quotation Comparison** — **no new data file** — retrofits `quotation-data.js` with `isRecommended`/`recommendedAt`/`recommendedByUsername`, and `recommend()` enforces "at most one Recommended per RFQ" (auto-un-recommends any prior pick — a mutual-exclusivity toggle, not just a flag). Operates on RFQs (not individual quotations) — opening one shows every Received quotation side-by-side, deliberately summary-level (totals/delivery/validity), not per-line — full per-line detail is one click away in Quotation Receipt's own Detail modal.
8. ✅ **Vendor Evaluation** — `data/vendor-evaluation-data.js`. Deliberately **NOT a workflow module** — only Draft/Final, no approval gate, because rating a vendor commits to nothing. Deliberately **NO duplicate check** — rating the same vendor multiple times over a relationship is normal, not an error (first explicit "not applicable, and here's why" resolution). Four fixed criteria built from a `.scoreCriteria` array (loop, don't hardcode 4 near-identical fields). `getAverageScoreForVendor()` is the FK-surface hook — Vendor Master's own page (`vendors.js`) was retrofitted with a live "Average Rating" display line.
9. ✅ **Purchase Order** — `data/po-data.js`. THIRD header + line-items document, but a fundamentally different shape from PR's: built entirely FROM one Recommended quotation (`ERP_QuotationRepository`'s `isRecommended`), copying its vendor + per-line pricing over as an editable starting point — `lineItems` is never freely added/removed by the user (no line-item modal at all), the whole array is replaced together on save, mirroring `quotation-data.js`'s own `lineQuotes` shape rather than PR's per-line CRUD. Exclusivity again (`getLinkedQuotationIds`/`getAvailableRecommendedQuotationsForCompany`, a Recommended quotation claimed by at most one PO). RICHEST status lifecycle in the phase — 8 states (Draft/Submitted/Approved/Rejected/Sent/Confirmed/Vendor Declined/Cancelled) — because internal approval (Module 10) and the VENDOR accepting the order (Module 11) are separate real-world events; `sendToVendor()` (Approved→Sent) is WIRED into this module's own page (a dispatch action, not a decision), while `confirm()`/`declineByVendor()` were implemented but deliberately left unwired, reserved for Module 11. First module to link TWO previously-untouched Phase 3 masters in one pass — `deliveryWarehouseId` (Warehouse Master) and `paymentTermsId` (Payment Terms). **Also the trigger point Section 9 predicted**: `actorLabel()` becoming a 5th duplicated copy is why it's now centralized as `window.ERP.actorLabel()` in `script.js` — see that file and po-data.js's own header. By the end of the phase, PO's own Detail modal had accumulated retrofit rows from SIX later modules (Vendor Confirmation, Delivery Schedule, Invoice Verification, Purchase Closure, plus the two-decision-transitions themselves) — see Section 9's note on this.
10. ✅ **PO Approval** — **no data file of its own** (4th instance of that shape) — reads/writes `ERP_PurchaseOrderRepository` exclusively, calling the `approve()`/`reject()` Module 9 left unwired. Exact PR/PR Approval split, with one deliberate difference: Approved→Sent stays with Module 9's own page rather than moving here, because dispatching an already-approved document is an administrative action, not a decision — see po-data.js's header for the full reasoning.
11. ✅ **Vendor Confirmation** — **no data file of its own** (5th instance of that shape) — reads/writes `ERP_PurchaseOrderRepository` exclusively, calling the `confirm()`/`declineByVendor()` Module 9 left unwired (the last of its three build-ahead hooks). The one real difference from PR Approval/PO Approval: this represents an OUTSIDE PARTY'S decision (the vendor's), not an internal one — so no role-restriction hint, just a plain always-visible explanation of what the module represents, and Confirm gets its own small modal (captures the vendor's own promised delivery date, a retrofit onto `po-data.js`'s `confirm()` signature) rather than a bare confirm-dialog. Decline has NO revise-and-resend — unlike PO Approval's Reject, a vendor decline is a dead end for that record; real renegotiation means a fresh PO.
12. ✅ **Delivery Schedule** — `data/delivery-schedule-data.js`. FOURTH header + line-items document, built FROM one Confirmed PO (`linkedPoId`, exclusive), `scheduleLines[]` one row per PO line (whole array replaced together, no free-form add — same shape as PO's own `lineItems`), pre-filled with the vendor's own confirmed delivery date (falling back to the originally requested one) but genuinely meant to be split across different planned dates per line. Simple RFQ-shaped 3-state lifecycle (`Draft → Finalized → Cancelled`, no approval gate — a logistics-coordination document, not a financial commitment) — named `Finalized` rather than reusing `Confirmed`/`Approved` to keep status-history readable. Retrofits Purchase Order's own Detail modal with a live "Linked to Delivery Schedule" row / "Next Step" hint.
13. ✅ **Goods Receipt** — `data/goods-receipt-data.js`. FIFTH header + line-items document, built FROM one Finalized schedule (`linkedScheduleId`, exclusive), `receiptLines[]` one row per schedule line, pre-filled with the PLANNED quantity but genuinely meant to be overwritten — the first line-count field in this whole session where a discrepancy from the default is the NORMAL case, not the exception. Same simple 3-state shape as Delivery Schedule (`Draft → Logged → Cancelled`, named `Logged` to stay distinct from `Finalized`/`Confirmed`). First module where a field (Received At Warehouse) DEFAULTS from an upstream record but is independently overridable, rather than being purely derived/read-only. Reuses Employee Master again for Received By. Deliberately does NOT try to be the "official" receiving document — GRN's job, one module up.
14. ✅ **GRN** — `data/grn-data.js`. SIXTH header + line-items document, built FROM one Logged receipt (`linkedReceiptId`, exclusive), `grnLines[]` copied 1:1 from the receipt (quantity) plus the ORIGINAL PO's own price — the first chain-walk this session that skips two intermediate hops (past Goods Receipt and Delivery Schedule, neither of which carry price) to reach the field it needs. Lines are NOT independently editable even in the create form — a GRN is a faithful, price-bearing copy, not a place to revise numbers. Same simple 3-state shape (`Draft → Posted → Cancelled`) — posting is administrative formalization, not a quality judgment (that's Module 15's job). Deliberately kept separate from Goods Receipt despite looking similar — GRN is the formal document Invoice Verification and Three-Way Matching actually reference by name.
15. ✅ **Quality Inspection** — `data/quality-inspection-data.js`. SEVENTH header + line-items document, built FROM one Posted GRN (`linkedGrnId`, exclusive), `inspectionLines[]` split into `acceptedQuantity`/`rejectedQuantity` (a genuine split, not just an overwritten single number) plus a per-line `rejectionReason`. Each line starts fully Accepted — an active default that must be overridden, not assumed. **Deliberate scoping decision**: this module's numbers do NOT feed forward into Three-Way Matching's math — the roadmap names that module "PO vs GRN vs Invoice," not Quality Inspection, so Three-Way Matching checks GRN quantities, keeping this an independent, browsable quality record rather than a silent modifier of numbers another module trusts. Same simple 3-state shape (`Draft → Completed → Cancelled`).
16. ✅ **Invoice Verification** — `data/invoice-verification-data.js`. EIGHTH header + line-items document, but built from a PO DIRECTLY (not the receiving chain — a vendor's invoice references the PO, not internal receiving paperwork). `invoiceLines[]` is the FIRST line array this whole session that does NOT pre-fill its own quantity/price from the parent — typing in what the PO already says would defeat the entire point of a check. A lightweight, informational two-way match (`computeMatchSummary()`) flags per-line agreement with the PO, distinct from the FORMAL three-way decision one module later. Simplification documented honestly in the file header: at most ONE invoice per PO in this simulator (a real PO can receive several for partial shipments).
17. ✅ **Three-Way Matching** — `data/three-way-matching-data.js`. THE multi-chain-read module CONTINUE_HERE.md flagged ahead of time — built from one Invoice Verification, but resolves the PO and GRN by walking FOUR hops (invoice → PO → schedule → receipt → GRN) rather than storing either as its own field. `computeMatchLines()` is a pure, unstored, per-line PO/GRN/Invoice comparison, recomputed fresh on every read — never cached, since a Draft invoice or unposted GRN can still change underneath it. First module since Vendor Confirmation with a REAL decision gate: `Draft → Approved for Payment / On Hold, +Cancelled` — the first genuinely new status pair (not another "administrative formalize" transition) since PO's own Approved/Rejected. The form itself has NO line table at all — the comparison only ever renders in the Detail view, computed live.
18. ✅ **Payment Request** — `data/payment-request-data.js`. Built from one Approved-for-Payment match, header-only (no line items — a single amount, not a per-line breakdown). `requestedAmount` defaults from the matched invoice's total but stays genuinely editable (a real request can legitimately differ). **THE FULL APPROVAL GATE LIVES ON THIS ONE PAGE** — `Draft → Submitted → Approved/Rejected, +Cancelled` all wired directly here, the first return to Department Need's ORIGINAL "no separate approval module" precedent since PR Approval established the two-page split eight modules ago; the roadmap simply lists no "Payment Request Approval" as its own module, so don't assume every approval-gated document needs a sibling page — check the roadmap first. FIRST Phase 4 use of Bank Master — pay-to details are resolved read-only from the vendor's own `getEffectiveBankDetails()`, never chosen.
19. ✅ **Vendor Payment** — `data/vendor-payment-data.js`. Built from one Approved payment request, header-only, same shape as Payment Request one hop up. `amountPaid` defaults but stays editable — partial payments are a normal, legitimate case, mirroring Payment Request's own "defaults but doesn't lock" treatment of the same underlying number. Back to the simple 3-state shape (`Draft → Paid → Cancelled`) — the decision already happened in Payment Request, this module only records execution (`markPaid()`, the same "administrative dispatch, not a new decision" reasoning as PO's `sendToVendor()`). Payment Method is a small fixed vocabulary looped into a `<select>`, matching Vendor Evaluation's `.scoreCriteria` discipline.
20. ✅ **Purchase Closure** — `data/purchase-closure-data.js`. **THE CAPSTONE, AND THE FINAL MODULE OF PHASE 4.** Deliberately built from the PO itself, not any downstream artifact — every other module built from whatever sat immediately upstream, but "closing the purchase" is about the PO's OWN lifecycle ending. `computeCompletionChecklist()` walks all EIGHT downstream modules this phase built (Schedule → Receipt → GRN → Inspection [optional] → Invoice → Match → Request → Payment) live, every time — the `computeMatchLines()` "pure, unstored computation" discipline taken to its natural conclusion across the whole phase. The checklist is purely informational and never gates `close()` — a real company can legitimately force-close an incomplete purchase, and this module trusts the person closing it to look at the full picture rather than blocking them. Simplest lifecycle in the entire phase on purpose: `Draft → Closed, +Cancelled`, with NO reopen from Closed — a formally closed purchase is a bigger deal to undo than a status flag.

All 20 Procurement modules are converted to live sidebar links. Phase 4 is complete — the entire chain from Department Need through Purchase Closure is connected, validated, and internally consistent.

### Phase 5 — Sales — **COMPLETE (10/10).** All 10 modules built, validated, and connected end to end. See Section 10 for the phase-complete summary.

1. ✅ **Customer Inquiry** — `data/customer-inquiry-data.js`. First SALES module, and the mirror of Department Need — but the mirror deliberately BREAKS on the approval gate: Department Need is an internal spend request needing authorization; a Customer Inquiry is an external signal (a customer asking) with nothing to authorize. So instead of DN's Draft→Submitted→Approved/Rejected shape, this is a 5-state PIPELINE PROGRESSION — New→In Progress→Converted/Lost, +Cancelled — same cardinality as DN, genuinely different meaning (a **7th workflow shape**, see Section 9). New concepts Procurement never needed: `source` (a fixed vocabulary — Phone/Email/Website/Walk-in/Referral/Trade Show/Other — looped into a `<select>`, same `.xTypes` discipline as `.paymentMethods`) and an assignment gate (`assignedToEmployeeId` optional at creation, but required before `startFollowUp()` — the page validates this, not the repository). `customerId` is required and always resolves to an existing Customer Master record — a documented simplification (a real CRM would also support not-yet-onboarded "Lead" prospects); this is also the FIRST module to actually use `data/customer-data.js`, unused since Phase 1. Reuses Department Need's own duplicate-check resolution (#5, non-blocking soft nudge) exactly — no 9th resolution needed. FIRST module to default `actorLabel()` straight to the centralized `window.ERP.actorLabel()` from day one (no local copy, unlike Department Need's own pre-centralization one). `getConvertibleForCompany()` is the FK-surface hook Quotation (Module 2) is expected to read from — no `linkedQuotationId` field built ahead of time (Quotation doesn't exist yet).

2. ✅ **Quotation** — `data/sales-quotation-data.js`. Built FROM one Converted Customer Inquiry (exclusivity-claimed the same way PR claims a Department Need — `getLinkedInquiryIds()`/`getAvailableConvertedInquiriesForCompany()` are the identical live-scan shape, one hop earlier). **Named `ERP_SalesQuotationRepository` / `-SQ-` codes in code — deliberately NOT `ERP_QuotationRepository`/`-QT-`, which Phase 4 Module 6 (Quotation Receipt) already owns.** Same English word, opposite direction (this company's price OUT vs a vendor's price IN); the sidebar/training content still just says "Quotation," matching the roadmap — only the code-level identifiers disambiguate. Line items are CRUD-added (PR's shape — `addLineItem`/`updateLineItem`/`removeLineItem`), NOT pre-filled-whole-array-replaced (Quotation Receipt/PO's shape) — the source inquiry only ever carries one optional item, nowhere near enough structure to copy wholesale; the page seeds ONE starting line from it as a convenience only. **A genuinely new combination**: freely-added lines (PR's shape) where `unitPrice` is REQUIRED per line (Quotation Receipt's shape) — no earlier module combined both. `unitPrice`/`taxId` default from a linked Item's own `salePrice`/`getEffectiveTaxCode()` chain but stay fully editable (a real quote discounts off list). `computeGrandTotal()` returns a richer `{subtotal, taxTotal, total, pricedCount, totalCount}` — the FIRST document total in the codebase to separate tax from subtotal, and the first real use of Tax Master (Phase 3, unused until now) against an actual total. 5-state shape (Draft→Sent→Accepted/Declined, +Cancelled) that LOOKS like shape (a) but is actually the Vendor Confirmation decline shape one level up: **Declined has NO reopen/revise** — a customer's decline is an outside party's call, same reasoning as a vendor's PO decline, reused directly rather than DN's freely-revisable internal reject. `customerId` is a stored copy captured once at creation (mirrors PO's own `vendorId`), never independently choosable. Retrofits Customer Inquiry's Detail modal with a "Linked to Quotation" row (`findQuotationForInquiry()`), the same shape as PR's own Department Need retrofit — `customer-inquiry.html` now also loads `../data/sales-quotation-data.js`.

3. ✅ **Sales Order** — `data/sales-order-data.js`. Built FROM one Accepted Quotation (exclusivity, same live-scan shape one hop further — `getLinkedQuotationIds()`/`getAvailableAcceptedQuotationsForCompany()`). **A deliberate, explicitly-reasoned divergence from PO's own 8-state two-party shape**: PO needs Vendor Confirmation as a SEPARATE module because the vendor hasn't committed yet; a Sales Order's customer already committed the moment they Accepted the quotation, so what's missing is an INTERNAL decision — exactly what the roadmap's very next module, Order Approval, is for. So this reuses PR's 5-state shape (Draft/Submitted/Approved/Rejected/Cancelled) instead, with `approve()`/`reject()` built here but deliberately UNWIRED from this module's own page — reserved for Order Approval (Module 4), the exact PR/PR-Approval division of responsibility. `reopen()` (Rejected→Draft) IS wired on this module's own page, mirroring PR's own precedent that revising-after-rejection is the requester's move, not the approver's. **Line items are a FROZEN COPY, not CRUD** — the opposite call from Quotation's own module: the source quotation is already a complete, customer-agreed, priced document, so `create()` copies its `lineItems[]` array verbatim (PO/Quotation Receipt's "whole array" shape) and the Detail modal only ever displays it, never edits it — no line-item modal exists on this page at all. **Discovered, not invented, credit check**: `data/customer-data.js` already exposed `getCreditUsage()`/`getCreditUtilizationBand()` from Phase 3, with its own `setStatus()` comment saying outright "Blocked is a credit hold... can't take new orders once Sales exists" — `getAvailableAcceptedQuotationsForCompany()` filters out any quotation whose customer isn't currently Active, keeping that promise without adding a single new field. The credit-utilization band surfaces as a live badge on both the create form and the Detail view, read directly from Customer Master's own methods — this file doesn't duplicate that logic. `customerId` is a stored copy (mirrors Quotation's own `vendorId`-style copy). Retrofits Quotation's Detail modal with a "Linked to Sales Order" row (`findSalesOrderForQuotation()`) — `sales-quotation.html` now also loads `../data/sales-order-data.js`. `getApprovedForCompany()` is the FK-surface hook Delivery Challan (Module 5) is expected to read from once Order Approval (Module 4) starts setting it.

4. ✅ **Order Approval** — no data file of its own, the **8th instance** of this shape (see Section 7). Reads/writes `ERP_SalesOrderRepository` exclusively, calling the `approve()`/`reject()` methods Module 3 built but never wired to a button. Otherwise a direct structural copy of PR Approval: defaults its status chips to "Awaiting Approval" (Submitted) instead of "All," has no `#noAnchorState` (it never creates anything, only reviews), and reuses the EXACT SAME `APPROVER_ROLES = ["Purchase & Sales Manager", "System Administrator"]` soft role-hint check — "Purchase & Sales Manager" already names both sides of the business, so no new role was needed. Detail modal is read-only (no Edit, no line-item controls — Sales Order's own lines were already read-only, so nothing new to strip there) but keeps Sales Order's Customer Credit badge front and center, since checking it is a real part of what this approval decision is actually about. Activity feed shares the "Sales Order" module name with Module 3, so Approve/Reject entries show up in both pages' Recent Changes.

5. ✅ **Delivery Challan** — `data/delivery-challan-data.js`. Built FROM one Approved Sales Order (exclusivity, one hop further — `getLinkedSalesOrderIds()`/`getAvailableApprovedSalesOrdersForCompany()`). Mirrors Goods Receipt's own shape from the SHIPPING side rather than the receiving side: same 3-state `Draft/X/Cancelled` lifecycle (no approval gate — an operational record, not a financial commitment; Order Approval one step back already covered the money decision), same "copy the parent's lines as an editable starting point, not a lock" pattern for `challanLines[]` (`orderedQuantity` frozen for reference, `deliveredQuantity` pre-filled equal to it but genuinely meant to be overwritten for a partial shipment). **The terminal status is `Issued`, deliberately NOT `Dispatched`** — Dispatch is Module 07's own name and job later in this same roadmap, and reusing it here would make status-history displays read like the same event happened twice; "Issued" was picked instead because that's genuinely how a delivery challan is described in real business practice, so the word choice isn't a stretch even as it dodges the collision. **A real scope line drawn against the next two modules**: `challanLines[]` carries NO `unitPrice`/`taxId` at all — the one line-items collection in the whole codebase that's quantity-only on purpose (Tax Invoice, Module 6, owns pricing/billing) — and no transporter/vehicle/tracking fields either, even though a real challan often has one (Dispatch, Module 7, owns logistics; don't reach back into this file to bolt that on later). `hasShortfall()` is a plain, non-blocking derived flag surfaced as a "Partial" badge, never a validation gate. No chain-walk needed to resolve a line's own description (unlike Goods Receipt's five-hop schedule→PO→quotation→RFQ→PR walk) — `lineDescription` is already sitting right there on the sales order's own frozen copy, one hop. Retrofits Sales Order's Detail modal with a "Linked to Delivery Challan" row (`findChallanForSalesOrder()`) — `sales-order.html` now also loads `../data/delivery-challan-data.js`. `getIssuedForCompany()` is the FK-surface hook Tax Invoice (Module 6) is expected to read from.

6. ✅ **Tax Invoice** — `data/tax-invoice-data.js`. Built FROM one Issued Delivery Challan (exclusivity, one hop further). **The first genuine TWO-HOP JOIN in the codebase, not just a chain-walk past intermediate hops** — GRN set the precedent of walking past a price-less immediate parent to reach a distant ancestor's pricing, but this module actually MATCHES two records' lines together BY LINE ID (`buildInvoiceLines()`): quantity comes from the challan (`deliveredQuantity` — bill for what shipped), price/tax/item comes from the matching sales-order line found by the SAME id, since every module in this chain has quietly preserved each line's own id from Quotation all the way down. Lines are computed ONCE at creation and never recomputed or edited again, even more strictly frozen than Sales Order's own copy — by this point both the quantity (confirmed at shipping) and the price (agreed at quotation) are already-settled facts; corrections belong upstream. **First real use of HSN Master** (Phase 3, untouched until now) — each line resolves `hsnCodeId` from its linked catalog item, a legally-required field for a real GST invoice. **Another discovered-not-invented hook**: `dueDate` defaults from `invoiceDate + customer.creditPeriodDays`, a Customer Master field (Phase 3) that had sat unused exactly like `getCreditUsage()` had before Sales Order found it. **Terminal status is `Raised`** — deliberately not GRN's own "Posted" (different phase, less risk, but still a fresh, authentic word) and definitely not Delivery Challan's own "Issued" (same phase, adjacent step, would have repeated the exact collision Delivery Challan's own header warned against). **No payment tracking at all** — a deliberate scope line against Payment Collection (#8) and Receipt (#9), mirroring Invoice Verification/Vendor Payment's own "creation vs. money changing hands are different modules" boundary on the Procurement side. Caught and fixed the same "re-enable a picker disabled by Edit mode" bug proactively this time, before it shipped (see Delivery Challan's own entry for where it was first found). Retrofits Delivery Challan's Detail modal with a "Linked to Tax Invoice" row (`findInvoiceForChallan()`) — `delivery-challan.html` now also loads `../data/tax-invoice-data.js`. `getRaisedForCompany()` is the FK-surface hook later Sales modules are expected to read from.

7. ✅ **Dispatch** — `data/dispatch-data.js`. Built FROM one Raised Tax Invoice, NOT the Delivery Challan sitting right beside it in the roadmap — a deliberate call, not the default one: the roadmap's own ordering (Tax Invoice immediately before Dispatch) plus real GST transport practice (an e-way bill/lorry receipt legally references the INVOICE's own number, not the challan's) both point the same direction. **Header-only, no line items** — the first Sales module to skip a line-items collection entirely, mirroring Payment Request/Vendor Payment's own shape but for a different reason: "what's inside the shipment" already has two homes (Delivery Challan's quantities, Tax Invoice's pricing), so Dispatch's real job — WHO's carrying it, what vehicle, what tracking number — never needed one. `transporterName` stays free text, a documented simplification (no Transporter Master exists in Phase 3, the same "no master yet" reasoning Vendor Master's original bank fields used before Bank Master caught up); `modeOfTransport` is a small fixed vocabulary (`.transportModes`) looped into a `<select>`, the `.paymentMethods` discipline again. `dispatchedByEmployeeId` reuses Employee Master the same way Goods Receipt's own "Received By" did. **Terminal status is `Dispatched`** — the exact word Delivery Challan's own header deliberately reserved rather than reusing for its own terminal state, specifically so this module could have it clean. Simple 3-state `Draft→Dispatched→Cancelled`, no approval gate (arranging transport is logistics, not a financial decision — Order Approval already covered that, three modules back). No duplicate check needed (resolution #8 — structurally not applicable, same as every other exclusivity-only module with no child array). **Tax Invoice is now a genuine hub, not just a link in a chain**: Dispatch is the first of THREE modules (this one, Payment Collection, Receipt) that will all independently build FROM the same Raised invoice rather than chaining through each other — logistics fulfillment and financial collection are separate real-world concerns that both start from "the invoice is final," not a relay race. Retrofits Tax Invoice's Detail modal with a "Linked to Dispatch" row (`findDispatchForInvoice()`) — `tax-invoice.html` now also loads `../data/dispatch-data.js`. `getDispatchedForCompany()` is the FK-surface hook Sales Close (#10) is expected to read from.

8. ✅ **Payment Collection** — `data/payment-collection-data.js`. **The first Phase 5 module to deliberately REJECT a Section 10 prediction rather than confirm it** — Section 10 predicted this would "likely mirror Vendor Payment's shape, reversed"; instead it reuses Customer Inquiry's own 5-state pipeline shape (workflow shape (g)) almost field-for-field, because a real AR "collection" effort is a multi-touch follow-up process (a call, an email, a promised date), not a single authorization-then-execution act the way releasing a vendor payment is. States: `Open → In Progress → Collected/Written Off`, plus `Cancelled` — Customer Inquiry's New/In Progress/Converted/Lost/Cancelled with collections-specific meaning, `writeOffReason` required the same "capture the why" discipline as `lostReason` before it, captured in its own small modal rather than the plain confirm dialog. **NOT EXCLUSIVE over its parent invoice — the first genuine break from the "one downstream record per upstream one" shape used by every module since Delivery Schedule.** The same Raised invoice can have several follow-up entries logged against it over time; `linkedInvoiceId` is a plain foreign key, not an exclusivity claim, reusing Vendor Evaluation's own "no duplicate check — rating multiple times is normal" resolution rather than inventing a new one. The invoice picker offers every Raised invoice every time, never filtered down to "available" ones, and the picker is never locked even in Edit mode (edits only happen pre-follow-up, while still Open — the same reasoning Customer Inquiry's own unlocked Customer field used). `assignedToEmployeeId` reuses Employee Master with the exact same "required before follow-up starts, not at save time" gate Customer Inquiry's own assignment uses. `promisedAmount`/`promisedDate` are their own named fields, not buried in free-text notes — a customer who keeps promises is a different risk from one who doesn't, and that only shows up if promises are their own data. Retrofits Tax Invoice's Detail modal with an AGGREGATE "Collection Follow-Ups" row (count + most recent status via `getAllForInvoice()`), not a single "Linked to X" link — mirroring Vendor Evaluation's own "Average Rating" retrofit into Vendor Master rather than any exclusive module's shape, since there's no single "the" linked record here. `tax-invoice.html` now also loads `../data/payment-collection-data.js`.

9. ✅ **Receipt** — `data/receipt-data.js`. **The mirror held this time** — unlike Payment Collection one module ago, Receipt genuinely confirms Vendor Payment's own shape: a simple, header-only `Draft → Received → Cancelled` execution record, because recording that money landed in the bank is a single factual event, not a multi-touch process. Terminal status is deliberately `Received`, not `Collected` — a near-miss naming collision with Payment Collection's own terminal state, resolved the same way Dispatch/Delivery Challan resolved theirs: the two words describe genuinely different facts (a follow-up succeeding vs. money confirmed in the bank), so reusing one for the other would have implied a false equivalence. **Built FROM the Tax Invoice directly — the third and final independent branch off the same hub Dispatch and Payment Collection already read from** — not from Payment Collection, since which follow-up (if any) led to payment isn't material to a receipt voucher. **EXCLUSIVE over its parent invoice again** (unlike Payment Collection, back to the shape every module since Delivery Schedule used) — at most one receipt per invoice, a documented simplification against real-world multi-installment settlement, mirroring Invoice Verification's own "at most one per parent" trade-off; `amountReceived` still defaults from the invoice's own `computeGrandTotal()` but stays fully editable, so a single partial payment is still representable. **Bank Master used in a genuinely REVERSED direction from Payment Request/Vendor Payment** — those resolved a linked VENDOR's own bank account, read-only; Receipt is the company's OWN account, chosen via a plain picker over `getActiveForCompany()`, defaulting to `getDefault()` but freely changeable, displayed through the bank module's own `maskedLabel()` helper (reused, not reinvented). `.paymentMethods` is its own deliberately expanded 5-item vocabulary (adds `UPI` as its own category, distinct from Vendor Payment's own 4-item list), reflecting a genuinely common B2B collection channel that an outbound-payment list had no reason to include. `receivedByEmployeeId` reuses Employee Master, the same convention as Dispatch's "Dispatched By." Retrofits Tax Invoice's Detail modal with a genuine single "Linked to Receipt" row (`findReceiptForInvoice()`) — the same single-link shape as Dispatch's own retrofit, not Payment Collection's aggregate one, since this module IS exclusive. `tax-invoice.html` now also loads `../data/receipt-data.js` (not `bank-data.js` — the retrofit row only reads `receiptCode`/`status`, never resolves the bank account, so that dependency stays where it belongs, in `receipt.html` itself).

10. ✅ **Sales Close** — `data/sales-close-data.js`. **THE FINAL MODULE OF THE WHOLE PROJECT.** Built from the Sales Order ITSELF (exclusive, pool = every non-Draft/non-Cancelled order not already claimed — deliberately not narrowed to "fully collected" ones, force-closing an incomplete sale is legitimate), mirroring Purchase Closure's own capstone shape (Phase 4, #20) closely — simplest lifecycle in the phase (`Draft → Closed, +Cancelled`, no reopen from Closed), a pure, unstored, live `computeCompletionChecklist()`, checklist entirely informational and never gates `close()`. **Where the mirror genuinely breaks: the WALK MECHANISM, not the shape.** Purchase Closure's own checklist was a clean linear relay, one record found from the previous stage's own id, all the way down. Sales Close's own chain is linear only as far as Tax Invoice (Sales Order → Delivery Challan via `salesOrderId` → Tax Invoice via `challanId`) — past that it BRANCHES three ways off the same invoice (Dispatch, Payment Collection, Receipt all read `linkedInvoiceId` off Tax Invoice directly, independently, not off each other), the hub shape Dispatch's own header first named. Copying Purchase Closure's exact chain-walk code structure unchanged would have silently broken here. `.checklistStages` (5 stages, one optional — smaller than Purchase Closure's 8/1 because Phase 5 simply has fewer total modules). **Payment Collection is the one stage that can't reuse the simple `record.status === doneStatus` check every other stage uses** — since it's not a single record (Section 9's own entry on Payment Collection's lack of exclusivity), its own stage status is computed from the FULL SET via `getAllForInvoice()`: `"Complete"` if any follow-up ever reached `Collected`, `"In Progress"` if any exist at all, `"Not Started"` if none — flagged `optional: true`, the same as Quality Inspection was in Purchase Closure's own list. `findClosureForSalesOrder()` is the retrofit hook — the LAST retrofit this whole project adds, wired into Sales Order's own Detail modal as a genuine single "Linked to Sales Close" row. `sales-order.html` now also loads `../data/sales-close-data.js`. The page's own script-tag list is deliberately leaner than Purchase Closure's own — that page loaded Item/PR/RFQ/Quotation despite never calling into any of them directly; this page only loads what `computeCompletionChecklist()` and its own rendering genuinely touch.
### Phase 6 — Finance & Accounting ✅ **COMPLETE — all 9 numbered modules + the retrofit pass** — the highest-priority addition: every module below is expected to genuinely auto-post to the General Ledger where a real transaction implies one, which is what makes Procurement and Sales feel like one connected system instead of two adjacent demos.

1. ✅ **Chart of Accounts** — `data/chart-of-accounts-data.js`. The master data every other Phase 6 module ultimately posts against or reads from — nothing else in Finance can start until accounts exist to post to. Reuses Category Master's exact hierarchy machinery (parentAccountId / getChildren / getDescendants / getAncestors / wouldCreateCycle / hasChildren-gated delete / getBreadcrumbLabel) — a chart of accounts nests exactly the way item categories do. **The one genuine divergence from that template**: every account is either a Group (a pure header/subtotal — can have children, can never be posted to) or a Ledger (a real postable account — can carry an Opening Balance, can never have children) — a distinction Category Master has no equivalent of, because you can debit "Cash in Hand" but never "Current Assets." `canAddChild()`/`canToggleGroup()` enforce the split; the Add/Edit form's Account Kind chips show/hide the Opening Balance row live depending on it. Account Type (Asset/Liability/Equity/Income/Expense) determines both `getNormalBalance()` (Debit for Asset/Expense, Credit for Liability/Equity/Income) and `getStatement()` (Balance Sheet vs. Profit & Loss) — Journal Entry, Trial Balance and the two statements are all expected to read these rather than re-deriving them. Account codes are DELIBERATELY FLAT, not depth-encoded (Asset 1000s / Liability 2000s / Equity 3000s / Income 4000s / Expense 5000s, next-available-in-block) — a depth-encoded scheme needs re-numbering the moment an account is re-parented, and this project's other tree-shaped modules have never needed that; the tree itself still carries the real hierarchy via `parentAccountId`. Opening Balance lives on Ledger accounts only, stored as `{amount, side}` rather than a signed number — how a trial balance is actually read. Duplicate-checks BOTH Account Name (the usual company-wide hard block) AND Account Code (new — this module lets the user override the suggested code, unlike Category Code which is always system-generated). **Deliberately does NOT auto-seed a starter chart of accounts** — every other master data module here starts empty and makes the trainee build it; pre-loading default ledgers would be exactly the fake-data problem this project just spent a pass removing from the Dashboard (see Section 10a). Sidebar: new "Finance & Accounting" nav group added across all pages (`data-group-key="finance"`). **RETROFITTED once Journal Entry shipped**: `remove()`/`canToggleGroup()` now also refuse if the account has posted journal entries against it (`ERP_JournalEntryRepository.hasPostedEntriesForAccount()`, typeof-guarded) — this was originally left as a deliberate TODO (see Journal Entry's own entry below) and the page now also loads `journal-entry-data.js` so the guard is actually live where the delete button lives, not just theoretically available.
2. ✅ **Journal Entry** — `data/journal-entry-data.js`. The first module that actually posts to something — every account Chart of Accounts creates was inert until now. One repository holds BOTH manual entries and (once the Phase 6 retrofit pass below reaches it) every auto-posted entry the system generates — a `source` field (`"Manual"` vs. the originating module's name) plus `sourceRecordId` distinguish them; nothing sets a non-Manual source yet, but the schema and the UI's Source filter chip (All / Manual / Auto-Posted) are ready for that pass rather than needing a follow-up schema change. **Genuinely new UI shape for this project**: a live, single-screen, add/remove-row line-item table with a totals footer recomputing on every keystroke — deliberately NOT modeled on Purchase Requisition's per-line modal (double-entry balancing is a whole-entry constraint you need to see across every line at once, which a modal-per-line can't show) nor Purchase Order's fixed-rows-from-a-quotation table (a journal entry has no upstream document dictating its lines). Typing a Debit clears that row's Credit and vice versa, enforced live, not just at save time. **Lifecycle is real accounting immutability, a deliberate divergence from this project's usual edit-until-approved shape**: Draft is freely editable/deletable and allowed to be temporarily unbalanced (the totals footer shows exactly how far off, in red); `post()` only succeeds once `canPost()` passes (≥2 lines, every line valid against a real Active Ledger account, balanced to zero); **once Posted, `update()`/`remove()` both hard-refuse** — a posted entry is real accounting history the moment General Ledger/Trial Balance start reading it, and this project doesn't get to silently rewrite that. The only undo is `reverse()`: creates a NEW, already-Posted entry with every line's debit/credit swapped, links both entries to each other, leaves the original untouched — same principle Tally's reversing journals and QuickBooks use. Entry Number (`JE-00001`...) is purely sequential, not a user-chosen identifier — first document-shaped module with no `isDuplicateXxx()` check at all. **Owed retrofit, paid back**: Chart of Accounts' own header flagged "whoever builds Journal Entry next" needs to add a check blocking deletion of a posted-against account — done (see item 1 above). This makes Chart of Accounts and Journal Entry the first two data files in this project with a genuine TWO-WAY dependency rather than strictly one-directional layering, and both files' headers say so explicitly rather than leaving it implicit.
3. ✅ **General Ledger** — `data/general-ledger-data.js`. **The first data file in this project with no storage key of its own** — no `getAll()`/`_saveAll()`, because there's nothing to save. General Ledger creates, edits, and deletes nothing; every function is a pure read-and-compute over `ERP_ChartOfAccountsRepository` and `ERP_JournalEntryRepository`, recomputed fresh on every call (same "no caching, cheap to recompute" reasoning `dashboard-data.js` already settled on). The one real piece of new logic: a **running balance kept as a single signed number in "normal-balance terms"** internally (positive = same side as the account's own `getNormalBalance()`, negative = a contra position), converted to the `{amount, side}` shape a page actually displays only at the boundary (`signedBalanceToDisplay()`) — one addition per line regardless of whether the account is Debit- or Credit-normal, not a branching if/else at every step. Verified against a hand-computed scenario (Node sandbox, not just eyeballed) before shipping: Asset account, Opening 1000 Dr → +500 Dr line → 1500 Dr → -200 line → 1300 Dr → -1500 line → 200 Cr (a contra balance, correctly flipped to the opposite side and shown positive, not as -200). Date-range filtering (`fromDate`/`toDate`) still walks the FULL history up to `fromDate` first to get a correct opening balance for the range, then only emits rows inside it — a believable partial-period ledger, not a truncated one starting from zero; verified this too. **Draws an explicit scope line against Trial Balance** (not built yet): General Ledger answers "what happened to THIS account, in order" (per-account transaction history); Trial Balance will answer "what's the closing balance of EVERY account, right now" (company-wide snapshot) — `getAccountSummary()` is what THIS module needs for its own account-list table, and Trial Balance is expected to call it once per postable account rather than re-deriving the same debit/credit-totaling logic, genuine reuse forward rather than this file reaching forward to build something only Trial Balance would need. **Includes Inactive accounts on purpose** — Journal Entry's own account picker correctly filters to Active only (can't post NEW entries to a retired account), but General Ledger is a historical record; filtering Inactive accounts out here would make old postings vanish from the books. Page is read-only throughout — no Add button, no Detail-modal lifecycle footer, `#confirmDialog` wired up but never actually invoked (the shared modal helpers assume it exists on every page; this is the first page where it's genuinely unused).

   **⚠️ RETROACTIVE BUG FIX (found while building Balance Sheet, Module 06 — see that entry below for the full account):** `getLedgerForAccount()`'s `toDate` handling had a real, live bug for one full session: the loop incremented the running balance for EVERY line before checking whether that line was dated after `toDate`, so `closingBalance` silently included postings dated AFTER the "as of"/"to" date whenever any existed — even though the `rows` array itself was (correctly) filtered to exclude them. Concretely, on THIS page: open the ledger drill-down for any account, set a "To" date, and if any real postings existed after that date, the Closing Balance shown would have been wrong (it would reflect the FULL history, not the history up to the chosen date) even though the row list above it looked correct. Trial Balance's own "As of" date and Balance Sheet's own "As of" date both call the same underlying function and were equally exposed. Fixed by reordering the check (`toDate` excluded — and skipped entirely, before `running` is touched at all — BEFORE the `fromDate` check, not after `running` already moved). Re-verified with a purpose-built regression test (three entries, a `toDate` cutoff sitting between the 2nd and 3rd) confirming `closingBalance` now correctly excludes the post-cutoff entry, plus re-ran every previously-passing General Ledger/Trial Balance sandbox test to confirm no regression. Profit & Loss was NEVER affected — confirmed explicitly, not assumed — because it only ever reads `getLedgerForAccount()`'s `rows` (which were always correctly filtered), never `closingBalance` (the one field the bug lived in).
4. ✅ **Trial Balance** — `data/trial-balance-data.js` (report). General Ledger answers "what happened to THIS account, in full history"; this answers "what's the closing balance of EVERY account, right now, side by side" — the explicit scope line General Ledger's own header drew is now real on both sides. Genuinely thin: doesn't re-derive any balance math at all, just calls `ERP_GeneralLedgerRepository.getAccountSummary()` once per postable account (exactly the reuse that file's header called for) and does only the two things that are actually this report's own job — **reshape `{amount,side}` into two columns** (Debit/Credit side by side is what a trial balance IS, not a stylistic choice) and **"as of" a date, default today** (which needed a small, additive, backward-compatible extension to `getAccountSummary()` itself, documented in both files). Ordered in standard financial-statement order (Asset→Liability→Equity→Income→Expense, code within type) using `ERP_ChartOfAccountsRepository.accountTypes`' own existing order — no new ordering concept invented. **The Difference figure is stated as a claim worth verifying, not just asserting**: it should read exactly ₹0 for any company, any date, as a direct consequence of `canPost()`'s balance check plus `reverse()`'s construction (an already-balanced entry with sides swapped is still balanced) — both already enforced upstream in Journal Entry. Verified end-to-end in a Node sandbox (Asset debited, Equity credited, correct columns, correct order, zero difference) before shipping, same discipline as General Ledger's own running-balance test. UI is simpler than General Ledger's own page in one deliberate way: **no drill-down modal at all** — a trial balance is a snapshot report meant to be scanned/exported/printed as a whole; General Ledger already owns "click into one account's history," and duplicating that here would just be two ways to ask the same question. Read-only throughout, same as General Ledger — no Add, no lifecycle, `#confirmDialog` present but unused.
5. ✅ **Profit & Loss Statement** — `data/profit-and-loss-data.js` (report). **The one real new idea: a PERIOD, not a point in time.** Trial Balance asks "what's every account's balance as of a date" (a snapshot); this asks "how much Income and Expense happened during a date range" (a flow) — and that's not a UI variation, it's what Income/Expense accounts actually mean: a real system closes them to zero every fiscal period via closing entries, so their balance only ever makes sense relative to a period. This project has no closing-entries mechanism, so the honest equivalent — and the one this file implements — is to **never look at an account's Opening Balance at all**, summing only the raw debit/credit movement from `ERP_GeneralLedgerRepository.getLedgerForAccount()`'s own period-bounded `rows` (never its `closingBalance`, which is the one field that DOES fold in the opening balance). Verified in a Node sandbox with a deliberately huge, deliberately irrelevant Income account opening balance (99999) sitting right next to an in-period sale (5000) and an out-of-period sale (99000, dated before `fromDate`) — confirmed both were correctly excluded and only the real period activity counted. **Single-stage, deliberately**: Total Income minus Total Expense equals Net Profit/Loss, full stop — not the staged Gross-Profit-then-Operating-Profit version some real P&Ls use, because Chart of Accounts' five Account Types have no "Direct" vs. "Indirect" or "COGS" vs. "Operating" sub-classification to build those stages on top of honestly; a future staged version needs a Chart of Accounts change first, not a Profit & Loss one. **Forward line drawn to Balance Sheet** (not built yet, explicitly in this file's header): a real Balance Sheet's Equity section includes the period's Net Profit, and whoever builds Balance Sheet next is expected to call `getProfitAndLoss()` and fold `netProfit` into Equity rather than the books simply not balancing — same courtesy Chart of Accounts extended to Journal Entry, General Ledger extended to Trial Balance. Read-only, no drill-down, same pattern as Trial Balance and General Ledger.
6. ⏳ Balance Sheet (report). **Next up.** Expected to call `getProfitAndLoss()` for current-period Net Profit and fold it into Equity — see item 5's own forward-line note.
6. ✅ **Balance Sheet** — `data/balance-sheet-data.js` (report). **The culmination of the reporting chain so far, and the first module to consume TWO earlier reports at once**: General Ledger's `getAccountSummary()` for Asset/Liability/Equity's own point-in-time balances (same function, same reasoning Trial Balance already uses — "as of a date," not a period, because ownership/debt/investment are point-in-time concepts), AND Profit & Loss's `getProfitAndLoss()` for the one genuinely hard problem this module has to solve: **where does the profit go?** Summing only Asset/Liability/Equity accounts' own balances would NOT balance the instant anything had ever been posted — a cash sale moves an Asset but touches an Income account, which this module doesn't otherwise look at, so nothing on the other side would match it. Real accounting fixes this with a period-end closing entry that formally moves Income/Expense's net result into Retained Earnings; this project has no closing-entry mechanism (the same gap Profit & Loss's own header names), so this file computes what one WOULD move, live, on every call — `currentEarnings` = `getProfitAndLoss(companyId, undefined, asOfDate).netProfit`, no `fromDate` (all-time cumulative, not fiscal-year-scoped, since no closing entry has ever reset that clock) — and folds it into the Equity total as its **own explicit, visibly-labeled line** ("Current Earnings (unclosed)"), never silently merged in, because it's a computed figure, not a real Ledger account balance. Same live-computation idea Tally's own Balance Sheet uses ("Profit & Loss A/c" under Capital), independently arrived at here from the same underlying constraint. **Deliberately does NOT reuse Trial Balance's Dr/Cr two-column layout** — a Balance Sheet asks "how much do we own/owe/have invested" (plain signed amounts grouped Assets vs. Liabilities-and-Equity), not "which side of the ledger" (Trial Balance's actual question); copying that column shape here would answer the wrong question correctly. Contra-balance sign handling (`_signedContribution()`) mirrors General Ledger's own `signedBalanceToDisplay()` logic, just applied at the summing stage: an overdrawn Asset subtracts from that section's total rather than silently not counting.

   **Verified with 5 independent Node-sandbox scenarios, not one** — the most rigorous pre-ship check of any module yet, matching a "maximum deep" ask: (1) a simple investment→purchase→sale chain, hand-computed and confirmed to balance exactly; (2) the same books extended with a bank loan (Liability) and a rent payment (Expense), confirmed to still balance; (3) **a mid-period snapshot taken BEFORE later transactions existed** — this is the test that caught a real bug (below); (4) zero-activity edge case (before any posting existed at all), confirmed to trivially balance at ₹0; (5) a deliberate overdraft pushing an Asset account into a contra (Credit) position, confirmed the sheet still balances with the account correctly shown as a negative contribution.

   **⚠️ A real bug was found and fixed during scenario (3), in already-shipped code — see General Ledger's own Section 3 entry above for the full account.** `general-ledger-data.js`'s `getLedgerForAccount()` had been incrementing its running balance for every line BEFORE checking whether that line fell after the requested `toDate`, so `closingBalance` silently included postings dated after the cutoff whenever any existed — a bug that had been live in General Ledger's own per-account drill-down and in Trial Balance's "As of" date for one full session, undetected because neither module's own original sandbox test happened to include a later-dated posting beyond the chosen cutoff. Balance Sheet's own scenario (3) — a mid-period snapshot with real future entries already in the dataset — was the first test in this project's history to actually exercise that combination, which is exactly why testing a NEW module against REALISTIC, evolving data (not just a fresh single-purpose dataset per test) matters. Fixed in `general-ledger-data.js` directly (reordered the date check so `toDate` exclusion happens before `running` is touched at all), then re-verified: the original General Ledger test, the original Trial Balance test (extended with a deliberately-later, deliberately-irrelevant entry), and all 5 Balance Sheet scenarios above, all re-run against the fixed source and all passing. Profit & Loss was checked too and confirmed genuinely unaffected — it only reads `rows`, never `closingBalance`, so this particular bug never had a path to reach it.

7. ✅ **Bank Reconciliation** — `data/bank-reconciliation-data.js`. **The first Phase 6 module to reach outside the Chart of Accounts/Journal Entry/General Ledger system entirely** — into Bank Master (Phase 3) and real Vendor Payment/Receipt transactions (Phases 4/5) — because the Phase 6 retrofit pass that will make those modules post to Journal Entry automatically (item 10, still not started) hasn't happened yet, and Bank Master has no link to a Chart of Accounts Ledger account at all (it predates Chart of Accounts by three phases). Rather than inventing a bank-to-ledger mapping this project has no other use for, this module works from what genuinely already exists: Vendor Payment and Receipt records, each carrying a `bankId` pointing at a specific real bank account — the honest interim shape for a company whose AP/AR modules aren't yet posting to a general ledger automatically, which happens to be exactly this project's own current state. **Also the first genuine transactional module in Phase 6 since Journal Entry itself** — General Ledger/Trial Balance/P&L/Balance Sheet all own no storage; a real bank reconciliation is something a business performs monthly and keeps a permanent record of, so this file has a real `create()`/`update()`/lifecycle like Journal Entry's own.

   **A real, pre-existing inconsistency was found and fixed as a prerequisite**: Receipt already carried `bankId` (added when Receipt itself was built); Vendor Payment did not, despite Bank Master existing chronologically before Vendor Payment was ever built — an inconsistency, not a deliberate choice, only surfaced because this module needed both sides symmetrically. Retrofitted directly into `vendor-payment-data.js` (new `bankId` field, new `getPaidForCompany()` mirroring Receipt's own `getReceivedForCompany()`) and `vendor-payment.js`/`.html` (a "Paid From" bank picker in the form, using the exact same picker shape — masked label, defaults to the company's default bank — Receipt's own retrofit already established), documented in that file's own updated header.

   **The reconciliation math, hand-traced before being coded, then verified against the traced numbers in a Node sandbox**: Book Balance = (Receipts for this bank, dated on/before the statement date) − (Vendor Payments, same filter) + Interest adjustments − Charge adjustments. Adjusted Bank Balance = Statement Balance (typed from the physical statement) + Deposits in Transit (uncleared Receipts) − Outstanding Payments (uncleared Vendor Payments, e.g. an uncashed cheque). These should be equal when reconciliation is correct — verified with 3 sandbox scenarios (a clean match with a bank charge, a second version adding interest, and a deliberately-wrong statement balance producing a genuine flagged difference) all producing exactly the hand-computed numbers.

   **A genuinely new UI shape for this project: a live-saving working view, not a list + detail modal.** Every "Cleared" checkbox toggle and every adjustment add/remove calls `update()` and re-renders the summary IMMEDIATELY — there's no separate Save step for the worksheet, because a reconciliation-in-progress is real work someone is actively doing, and batching a dozen checkbox toggles behind one Save button risks losing all of it. Mirrors how Chart of Accounts' `toggleStatus()` or Journal Entry's `post()`/`cancel()` already commit immediately — just applied to many small toggles on one screen instead of a single action.

   **Lifecycle mirrors Journal Entry's own immutability philosophy deliberately**: `Draft -> Reconciled`, and once Reconciled, `update()`/`remove()` both hard-refuse — a finished reconciliation is a dated audit record; a later-discovered mistake gets fixed with a NEW reconciliation, not by reopening the old one, the identical "correction is a new entry, not a rewrite" principle Journal Entry's `reverse()` established. Unlike Journal Entry's `canPost()`, though, `markReconciled()` does NOT refuse when the two balances don't match — a trainee can close a period out and flag the difference for follow-up rather than being locked out of ever finishing it, the way real bookkeeping sometimes carries a small unexplained variance forward rather than never closing the books; the page is expected to warn clearly before that call, not the repository to block it.

   **One deliberate, explicitly-documented gap at the time — now closed**: this module originally did NOT automatically post a Journal Entry for any bank charge/interest it surfaces, because doing so would have required guessing which Chart of Accounts Ledger account represents this bank, which didn't exist without a bank-to-ledger link. That link now exists (`linkedAccountId` on Bank Master, added by the Phase 6 retrofit pass — see item 10 below) — but this module's own reconciliation math still doesn't auto-post discovered adjustments to Journal Entry, and that remains a deliberate choice, not an oversight: a bank reconciliation's own charges/interest are discovered DURING reconciliation, potentially for a past period already closed elsewhere, and auto-posting them the instant "Add Adjustment" is clicked would bypass the same deliberate-review step Journal Entry's own Draft-then-Post lifecycle exists to provide. Left as a stated manual follow-up in the training guide; a future session could offer a "Post this adjustment to Journal Entry" button that opens a pre-filled Draft rather than auto-posting directly, which would fit this module's own live-saving worksheet UI without skipping review.

8. ✅ **Accounts Payable Aging** — `data/ap-aging-data.js` (report). Built from Payment Request, not Journal Entry — the roadmap's own choice, and the right one: Payment Request already carries both `requestedAmount` and, critically, `dueDate`, which is the one fact an aging report cannot function without and which nothing in the Chart-of-Accounts/Journal-Entry system tracks at all. **A genuine 4-hop chain walk to find who's owed the money**: Payment Request has no `vendorId` of its own, so `resolveVendor()` walks Payment Request → (`linkedMatchId`) → Three-Way Matching → (`linkedInvoiceVerificationId`) → Invoice Verification → (`linkedPoId`) → Purchase Order → (`vendorId`) → Vendor, four hops deep, each individually null-checked. Not a new pattern — GRN's own three-hop chain-walk (Section 9) already established walking several hops as the honest approach when nothing along the way denormalizes the field being sought; this is simply one hop longer, since Payment Request sits one module further downstream. Verified the resolution actually works, not just reads plausibly, with a full mock of all four hops in a Node sandbox.

   **Which payables count, and for how much, carefully reasoned**: only Approved requests (Draft/Submitted aren't authorized; Rejected/Cancelled never will be paid). For each, `getOutstandingAmount()` checks `ERP_VendorPaymentRepository.findPaymentForRequest()` — the same retrofit hook Payment Request's own Detail modal already reads — and returns the full `requestedAmount` unless an actively-Paid Vendor Payment exists, in which case it's `requestedAmount − amountPaid`, floored at zero, honoring Vendor Payment's own explicit support for partial payments rather than treating them as an edge case. A request with zero outstanding balance doesn't appear at all — settled, not aging.

   **Standard 5 aging buckets (Current, 1-30/31-60/61-90/90+ days), plus an honest 6th**: "No Due Date," because `dueDate` can genuinely be null and this report refuses to fabricate an answer to "how overdue is this" when the one fact it depends on isn't there — defaulting to Current would understate real risk, defaulting to 90+ would overstate it, so the gap gets named instead. Verified all three date-dependent cases (a 10-day-overdue payable, a 45-day-overdue payable, a not-yet-due payable, plus a fully-paid payable that must NOT appear and a Draft request that must NOT appear) in a single hand-traced sandbox scenario matching exactly.

   Grouped by vendor, sorted largest-total-first (the shape a real AP Aging report is actually read in — "who do we owe the most"), with a "Vendor Unknown" group for any request whose chain resolution failed rather than silently dropping it — `unresolvedCount` surfaces this as a real data-quality signal on the page, not a hidden one. Per-vendor "View" drill-down reuses General Ledger's own established "summary table + detail modal for one row" shape rather than inventing a third variant.

9. ✅ **Accounts Receivable Aging** — `data/ar-aging-data.js` (report). The mirror of AP Aging — but genuinely, measurably simpler, exactly as that module's own header flagged was worth checking rather than assuming. Tax Invoice already carries `customerId` directly (denormalized on the invoice itself) and its own `dueDate` (defaulting from Customer Master's `creditPeriodDays`, independently editable) — **zero chain-walk hops needed**, where AP Aging needed four. Both facts this report depends on were already sitting on the source document; the asymmetry between the two files' length is the honest result of Procurement and Sales genuinely having different document shapes, not an inconsistency to paper over.

   **Outstanding amount and bucket logic mirror AP Aging's own reasoning exactly** — full invoice total unless an active, Received Receipt exists (via `findReceiptForInvoice()`, the same retrofit hook Tax Invoice's own Detail modal reads), in which case `total − amountReceived`, floored at zero, honoring partial payments as the normal case. Same 5 standard buckets plus the same honest "No Due Date" 6th bucket, for the same reason: refusing to guess an answer this report doesn't actually have.

   **The one genuine addition AP Aging had no equivalent for**: written-off receivables. Accounts Payable has no concept of unilaterally deciding a debt no longer exists; Accounts Receivable does — Payment Collection (Phase 5) already models a formal "Written Off" status. `isWrittenOff()` checks `ERP_PaymentCollectionRepository.getLatestFollowUpForInvoice()` — an already-established Phase 5 hook, not a new one — and this report excludes a written-off invoice from Total Outstanding entirely, the way real accounting removes a recognized bad debt from the active AR list. The same hook also surfaces genuinely useful AR-only context in the page's own drill-down: last collections follow-up date, method, and status per receivable, something AP Aging's own drill-down has no equivalent column for, since collections follow-up is a receivables-side-only business process this project already modeled.

   Verified end-to-end in a single Node sandbox scenario covering every exclusion case at once — a genuinely overdue receivable, a not-yet-due one, a fully-paid one that must vanish, a Draft invoice that must never count, AND a written-off one that must also vanish — plus a second scenario specifically confirming a non-written-off ("In Progress") follow-up still counts toward the total while its context correctly surfaces in the drill-down. All matched exactly.

**Phase 6's 9 numbered modules are now all built, validated, and cross-verified — Chart of Accounts, Journal Entry, General Ledger, Trial Balance, Profit & Loss, Balance Sheet, Bank Reconciliation, AP Aging, AR Aging.** What remains is item 10 below, the retrofit pass — described in the original brief as "the single most important piece of this entire extension," and correctly saved for last: it can only be done well once every report it needs to feed (General Ledger, Trial Balance, the two statements) already exists and is trustworthy, which is exactly the case now. Two smaller, honestly-documented gaps surfaced along the way that the retrofit pass is expected to help close: Bank Reconciliation currently reads Vendor Payment/Receipt directly instead of Journal Entry (no Bank Master-to-Ledger-account link exists yet), and neither AP nor AR Aging can show a "days since last activity" figure without real posted history to check against. Neither blocks the retrofit pass from starting; both are worth revisiting once it lands.

10. ✅ **Retrofit pass** — GRN, Invoice Verification, Vendor Payment (Procurement) and Tax Invoice, Receipt (Sales) now each generate a real, balanced journal entry on their own key transition. This is genuinely the largest single piece of work in Phase 6, and it needed real infrastructure that didn't exist yet before any of the five business modules could be touched.

    **The problem that had to be solved first**: auto-posting needs a real Chart of Accounts account id to debit/credit, and nothing anywhere in this project had ever recorded "which account IS Inventory" or "which account IS Accounts Payable" — a trainee's own chart could name that account anything, at any code. `data/gl-mapping-data.js` is the answer every real ERP gives to this same problem (SAP: Account Determination; Tally: Ledger Mapping; QuickBooks/Zoho: default accounts) — **6 roles, one mapping per company**: Inventory, GR/IR Clearing, Accounts Payable, Accounts Receivable, Sales Revenue, Output Tax Payable. **Deliberately not 7** — no Input Tax role, because Invoice Verification's own `computeGrandTotal()` was checked directly (not assumed) and confirmed to never separate a tax component at all; a mapping role nothing could ever populate would teach the wrong lesson.

    **A second, smaller gap had to close first too**: Vendor Payment and Receipt both needed to know which REAL Ledger account a specific bank account's money moves through, which meant Bank Master itself needed a link to Chart of Accounts — exactly the gap Bank Reconciliation's own header had explicitly deferred and flagged for this exact moment. Retrofitted directly: Bank Master gained `linkedAccountId`, with a picker in its own form (Active, postable Ledger accounts only, same rule Journal Entry's own picker enforces) and a display row in its own Detail modal.

    **The actual posting logic lives in ONE new file, `data/gl-posting-data.js`, not scattered across five edits to five already-shipped data files.** `grn-data.js`, `invoice-verification-data.js`, `vendor-payment-data.js`, `tax-invoice-data.js` and `receipt-data.js` are all completely unmodified by this pass — each retrofitted PAGE controller, after calling its own existing `post()`/`verify()`/`markPaid()`/`raise()`/`markReceived()` exactly as it always did, makes one additional typeof-guarded call into `gl-posting-data.js`. The business module never learns GL posting exists; the posting layer never learns how a GRN workflow runs. Five debit/credit pairs, each reasoned from the real accounting event, not guessed:
    - **GRN** (on `post()`): Dr Inventory / Cr GR/IR Clearing — a real, standard accrual concept (SAP's own term) for exactly this gap: goods have arrived with real value, but the vendor's bill hasn't been verified yet, so there's no real vendor-specific liability to recognize YET, just a provisional one.
    - **Invoice Verification** (on `verify()`): Dr GR/IR Clearing / Cr Accounts Payable — clearing the provisional liability and replacing it with a real one now that the bill's been checked. Stated plainly as a simplification: this assumes the GRN total and the verification's own total match exactly; a mature system would post any price/quantity variance to its own account, which this project's Invoice Verification (already "informational only" on its own two-way match check) doesn't attempt either.
    - **Vendor Payment** (on `markPaid()`): Dr Accounts Payable / Cr [the Ledger account linked to the payment's own `bankId`] — requires BOTH the GL Mapping AND the bank-to-ledger link; missing either fails gracefully with a specific reason naming which one.
    - **Tax Invoice** (on `raise()`): Dr Accounts Receivable / Cr Sales Revenue (subtotal) / Cr Output Tax Payable (tax portion, only ever added as a third line when `taxTotal` is actually nonzero — an untaxed invoice gets a clean two-line entry).
    - **Receipt** (on `markReceived()`): Dr [the Ledger account linked to the receipt's own `bankId`] / Cr Accounts Receivable.

    **Every function returns `{success, entry?, reason?}` and never throws.** A trainee mid-setup — GL Mapping half-configured, a bank not yet linked — is a normal, expected state, not an error; the calling page shows the specific `reason` as a warning toast ("Not posted to the books yet — set up Accounts Payable in Posting Rules first.") rather than failing silently or crashing. **Auto-posted entries are Posted immediately, never left as Draft** — the one deliberate divergence from Journal Entry's own default: a manual entry starts as Draft because a human might still be assembling it; an auto-posted entry is generated complete from a business event that already fully happened, so there's nothing left to assemble.

    **Verified far more rigorously than a single scenario before touching any page**: each of the 5 posting functions tested individually (including every failure mode — no mapping configured, a payment with no bank selected, a bank selected but not linked, an untaxed vs. taxed invoice), then a full end-to-end procure-to-pay-and-order-to-cash cycle run through the actual shipped files — all 5 real business events, all 5 resulting journal entries individually balanced, and the grand total debit across all 5 matching the grand total credit exactly (₹338,800 = ₹338,800). Journal Entry's own `source`/`sourceRecordId` fields — reserved, unpopulated, from the moment that module first shipped — finally have real data in them, and its own "Auto-Posted" filter chip finally has something to show.

    **New module born from necessity, not originally in the numbered list**: `pages/posting-rules.html`/`.js` — the configuration screen a trainee actually uses to set the 6 roles, with live-saving pickers (same immediate-commit pattern Bank Reconciliation's own worksheet established), a readiness readout ("Procurement: Ready/Not ready," "Sales: Ready/Not ready"), and a "Recently Auto-Posted" feed reading real Journal Entry activity — concrete proof the whole pass is actually working, not just configured. Added to the Finance & Accounting sidebar group as a 10th live link.

### Phase 7 — Inventory Management (✅ COMPLETE, 6/6 modules): Opening Stock, Stock Ledger (retrofitted into GRN/Delivery Challan), Stock Adjustment, Stock Transfer, Stock Valuation Report (FIFO — chosen deliberately, see `stock-valuation-data.js`'s own header), Low Stock/Reorder Level report. GRN and Delivery Challan now move the same real, shared stock number instead of each writing to its own silo. Dashboard's inventory VALUE and category-split tiles now read real FIFO valuation instead of the old at-cost approximation; `inventoryChangePct`/`lowStockChange` were still hardcoded to 0 as of this phase (closed by Phase 8's own historical-snapshot mechanism — see below).

**Real dependency order beat roadmap numbering twice this phase, both noted honestly rather than hidden**: `stock-ledger-data.js` had to exist before `opening-stock-data.js`'s own file even though the roadmap lists Opening Stock first (its own `confirm()` needs somewhere to post to); and `stock-valuation-data.js`'s FIFO engine had to be built before Stock Transfer could use it for cost carry-forward, even though Valuation Report is roadmap module 5 and Transfer is module 4. Both files say so in their own headers. The lesson generalizes from Phase 6's own "Stock Ledger built before Opening Stock's own file" situation, now confirmed twice in the same phase: roadmap order is a presentation order for the trainee, not always the true build-dependency order for the person writing the code.

1. ✅ **Opening Stock** — `data/opening-stock-data.js` + `pages/opening-stock.html/js`. One record per (item, warehouse) pair — NOT a multi-line document, the first Phase 7 module to establish that a "starting balance" module can be simple master-data-shaped (list + Add modal) rather than needing a line-item table. Duplicate-check resolution #7 (hard uniqueness on a composite key) reused exactly, for the third time in the project — `(itemId, warehouseId)`, at most one non-Cancelled record per pair. Draft → Confirmed/Cancelled lifecycle, deliberately with **no reopen from Confirmed at all** (not even a reversal path) — a genuinely stricter immutability than Journal Entry's own Posted-then-reversible shape, because there's no safe "undo" for a ledger's own starting point the way a balanced reversing entry can safely undo a normal posting. `confirm()` calls `ERP_StockLedgerRepository.recordMovement()` directly (typeof-guarded) rather than through a retrofit orchestration file — a brand-new module built alongside Stock Ledger in the same session has no "keep it ignorant of a concept that didn't exist when it shipped" constraint to honor, unlike the GRN/Delivery Challan retrofit below.

2. ✅ **Stock Ledger** — `data/stock-ledger-data.js` (genuine storage) + `pages/stock-ledger.html/js` (read-only summary + per-pair drill-down modal, structurally copied from General Ledger's own account-ledger shape). **The module this phase was explicitly asked to reason about, not assume**: unlike General Ledger (pure computation over Journal Entry's already-real storage), Stock Ledger has NO upstream "Journal Entry equivalent" in this phase's roadmap — nothing else is positioned to hold the actual stock-movement records — so it has genuine storage of its own, structurally closer to Journal Entry than to General Ledger, even though its ROLE in the reporting chain that follows it (Stock Valuation Report, Low Stock Report both read from it) matches General Ledger's own role exactly. Storage architecture and reporting role turned out to be two separable questions, decided independently rather than assumed to move together. `recordMovement()` is the ONLY way an entry is created — there is no `update()`/`remove()` AT ALL, not even a conditionally-refused one; a stock movement records a fact that already, physically happened, and the only honest correction is a new entry, never a rewrite. Signed quantity (not debit/credit) — the first ledger-shaped module in the project without a normal-balance/contra-side concept, since physical stock only ever moves in or out.

3. ✅ **Stock Adjustment** — `data/stock-adjustment-data.js` + `pages/stock-adjustment.html/js`. Physical count corrections, one session covering several items in one warehouse, `.reasons` a 6-item controlled vocabulary (Section 9's own `.xTypes` convention, reused). Own live add/remove line-item table (Journal Entry's own established shape, delegated tbody-level event binding, no per-row listeners to rebind) — but a genuinely new field-level rule worth naming: **unit cost is required on a line ONLY when that line's own adjustment quantity is positive (a surplus)** — a shortage consumes existing FIFO layers automatically and needs no cost input at all, while a surplus creates a brand-new incoming layer out of nothing and would corrupt valuation downstream if left at zero. `systemQuantity` is snapshotted once, at the moment a line is added (a live Stock Ledger balance read), and never re-derived at post time — a physical count is honestly a comparison against "what the system said when I counted," not "what the system says right now."

4. ✅ **Stock Transfer** — `data/stock-transfer-data.js` + `pages/stock-transfer.html/js`. Warehouse-to-warehouse moves. Writes a MATCHED PAIR of Stock Ledger entries per line (Transfer Out + Transfer In) — both or neither; a line without enough stock in the From warehouse is skipped on both sides rather than posting a lopsided half-move. **Reads FORWARD into Stock Valuation's own FIFO engine for the destination's cost basis** — the same "genuine reuse forward, not duplicated logic" discipline Trial Balance (reading General Ledger) and Balance Sheet (reading Profit & Loss) established in Phase 6, now confirmed for the first time as "a transactional WRITE reads a valuation computation," not just "one report reads another." Deliberately uses the source warehouse's CURRENT WEIGHTED-AVERAGE cost rather than peeling an exact FIFO slice for the transferred quantity specifically — a named, honest simplification (see the file's own header), not a shortcut passed off as precise.

5. ✅ **Stock Valuation Report** — `data/stock-valuation-data.js` (FIFO engine, built early — see the dependency-order note above) + `pages/stock-valuation.html/js` (report table + per-item FIFO-layer drill-down modal). **FIFO chosen deliberately over Weighted Average**, weighed honestly in the file's own header: Weighted Average is the simpler implementation (one running number, no queue), FIFO is genuinely harder (an ordered, partially-consumable layer queue — the first data structure of this shape in the whole project) but was chosen anyway because it's the more standard "first" costing method taught in accounting curricula and gives the training simulator real, concrete depth — watching layers actually get consumed oldest-first teaches something Weighted Average's single number can't show. Verified against 4 hand-traced Node-sandbox scenarios before being trusted (basic layering, a shortfall-then-recovery case where a Delivery Issue posts before Opening Stock exists for that item, exact layer-boundary consumption, multi-warehouse aggregation) — the same rigor bar General Ledger's running balance and Balance Sheet's five scenarios set in Phase 6. The core invariant protected throughout: a FIFO layer walk's own remaining quantity always equals Stock Ledger's own plain signed-sum balance for the same inputs — verified explicitly in the shortfall scenario, not just assumed to hold.

6. ✅ **Low Stock / Reorder Level report** — `data/low-stock-data.js` + `pages/low-stock.html/js`. The thinnest module this phase — no new computation at all, purely a filter+sort over `ERP_ItemRepository`'s own already-live `getStockUsage()`/`getStockHealthBand()`. Reuses Item Master's existing `reorderLevel` field completely unchanged, exactly as this phase's own brief specified — a company-wide threshold, not split per-warehouse, even though Opening Stock/Stock Transfer both introduced real per-warehouse quantities. Sorted by urgency (current stock as a FRACTION of reorder level, ascending), not by the raw size of the gap — a small item well below a small threshold outranks a large item slightly below a large one.

**The `currentStock` architectural decision, made explicitly rather than assumed either direction (per this phase's own brief)**: Item Master's `currentStock` field — added in Phase 3 as a plain editable placeholder, before this project had any real stock-tracking concept — becomes a COMPUTED ROLLUP once Stock Ledger exists, the same way Chart of Accounts' balance became computed once Journal Entry existed. `ERP_ItemRepository.getLiveCurrentStock(item)` is the new seam: reads the live, ledger-computed total across every warehouse once any Stock Ledger activity exists for that item, falling back to the legacy stored field only for an item that hasn't been through Opening Stock yet. `getStockUsage()`/`getStockHealthBand()` were retrofitted to read through this helper internally — a small, additive, SIGNATURE-UNCHANGED change (both already took the whole item object, not a raw number), so every existing call site (Dashboard, the Items list, PR/PO stock-health badges) picked up the fix with zero code changes of its own. `items.js`'s own Add/Edit form still accepts a starting legacy value for a brand-new item (nothing to compute from yet), but on Edit, once real ledger activity exists, the Current Stock field becomes read-only with the live figure shown instead — real-ERP fidelity (Tally/SAP both make this field non-editable once perpetual inventory is active), not just a cosmetic choice.

**The GRN/Delivery Challan retrofit mirrors Phase 6's own `gl-posting-data.js` shape exactly, confirmed as a pattern worth reusing beyond its original phase**: `stock-posting-data.js` is the one new orchestration file both already-shipped modules gained a single typeof-guarded call into (right after their own `post()`/`issue()`), keeping `grn-data.js`/`delivery-challan-data.js` themselves completely untouched. The two retrofit points needed genuinely different item-resolution paths, worth naming explicitly: Delivery Challan's own lines already carry `itemId` directly (easy, though still nullable — a Sales Order line can be a free-text description with no catalog item); GRN's own lines only carry `prLineItemId`, requiring the exact same multi-hop chain-walk (GRN→Receipt→Schedule→PO→Quotation→RFQ→PR) `grn.js`'s own `resolveChain()` already does, reused rather than re-derived. Both retrofit functions skip unresolvable lines gracefully (never throw) and report a `skippedCount` back to the calling page — the same "surface the gap, don't hide it" discipline `ap-aging-data.js`'s own `unresolvedCount` established in Phase 6.

### Phase 8 — Cross-Module Reporting & Dashboard (✅ COMPLETE, 4/4 modules): Sales Register, Purchase Register, GST Summary, Inventory Valuation Report. Also: a real historical snapshot mechanism, so Dashboard's day-over-day deltas stopped being hardcoded to 0.

**The first phase whose whole job was pulling data BACK OUT across modules that were never designed to be read together — and the first phase where a report needed to be reusable BY another report, not just by a page.** Sales Register and Purchase Register both earned their own data files (not page-only computation, and not Low Stock's own "thin file, no storage" shape either — see each file's own header) for exactly one reason: GST Summary reads both of their own `getRows()`/`groupByRate()`/`groupByHsn()` outputs directly, the first time in this project a report calls into another report rather than into a transactional module. Every report in this phase reuses computation forward rather than re-deriving it — Sales Register reuses Tax Invoice's own `computeLineTotal()`/`computeLineTax()`; Purchase Register reuses a one-hop-shorter sibling of GRN's own chain-walk; Inventory Valuation Report reuses Stock Valuation's own FIFO engine outright, adding only category grouping.

1. ✅ **Sales Register** — `data/sales-register-data.js` + `pages/sales-register.html/js`. One row per Raised Tax Invoice LINE, not per invoice — decided, not defaulted, because GST Summary needs HSN/rate-level granularity and a per-invoice grain would only have to be re-exploded a step later. The first real transactional use of Tax Master's own `getIntraStateSplit()`/`getInterStateSplit()` — those functions existed since Phase 3 but, checked directly, had only ever been called by `tax-master.js` itself to build a descriptive string; this file is where they're finally applied to an actual transaction, comparing the active company's own `state` against each invoice's customer's `state`. Full "list module" mechanics (search-free, but filter/sort/paginate/CSV/print) laid over a read-only report — a genuinely new combination, closer in shell to a transactional list page than to AP Aging's small ungrouped table, because row count here scales with invoice-line history rather than a bounded master list.

2. ✅ **Purchase Register** — `data/purchase-register-data.js` + `pages/purchase-register.html/js`. Built from "Verified" Invoice Verification records, NOT GRN — checked, not assumed: GRN is Procurement's own mirror of Delivery Challan (goods movement, no tax), Invoice Verification is Procurement's own mirror of Tax Invoice (the actual billing document), so the real mirror of "Sales Register reads Tax Invoice" is "Purchase Register reads Invoice Verification." Resolving each line's item takes a genuine chain-walk one hop SHORTER than GRN's own `resolveChain()` (verification→PO→Quotation→RFQ→PR, four hops, since Invoice Verification links straight to the PO and skips Schedule/Receipt/GRN entirely) — read directly from `grn.js` before writing, not assumed reusable as-is. **The one honest gap this phase couldn't paper over**: no document anywhere in the Procurement chain (PR/RFQ/Quotation/PO/Invoice Verification, all checked directly) ever captures a tax rate — the same absence Phase 6's own `gl-mapping-data.js` already found and documented. Input tax here is therefore an ESTIMATE, resolved from each line's chain-walked item's own CURRENT effective tax code (`ERP_ItemRepository.getEffectiveTaxCode()`), not the rate that was actually on the vendor's bill — every row carries `taxIsEstimated: true`, and both this page and GST Summary say so out loud rather than presenting it as fact alongside Sales Register's own exact figures.

3. ✅ **GST Summary** — `data/gst-summary-data.js` + `pages/gst-summary.html/js`. Reconciles output tax (Sales Register) against input tax (Purchase Register) by tax rate AND by HSN code — the first report in the project built by merging two OTHER reports' own already-computed rows rather than reading a transactional module directly. A PERIOD report (From/To, like Profit & Loss), not an as-of-a-date one (like Trial Balance) — GST liability is filed over a range, the same reasoning P&L already established. `netTax` is a deliberate, NAMED simplification (output minus input, no Input Tax Credit eligibility rules, no cross-head offsetting) — a real, useful approximation, explicitly not a claim to have modeled actual GST liability, and it inherits Purchase Register's own estimated-input-tax caveat by construction.

4. ✅ **Inventory Valuation Report** — `data/inventory-valuation-data.js` + `pages/inventory-valuation.html/js`. The roadmap named this separately from Phase 7's own Stock Valuation Report; read that file's own header first, then decided it's genuinely different, not a rewire — Stock Valuation Report is an OPERATIONAL tool (flat, per-item, live FIFO-layer drill-down); this is a CLOSING tool (formal, category-grouped, subtotaled, the same financial-statement shape Trial Balance/Balance Sheet already use, applied to inventory). Grouped by each item's TOP-LEVEL category (climbing Category Master's own `getAncestors()` chain), not an item's own leaf category, so a deeply-nested catalog still produces a clean, small set of groups. Deliberately does NOT add a Weighted-Average comparison even though `getWeightedAverageCost()` already exists on Stock Valuation's own file — read directly before deciding, that function returns the blended cost of CURRENT layers (used narrowly by Stock Transfer), not a true from-day-one Weighted Average method; presenting it as an alternative valuation total would conflate two different costing methods rather than compare them, so it was left undone rather than done wrong.

**The historical snapshot mechanism — `data/snapshot-data.js`, no page of its own, infrastructure exactly like `gl-posting-data.js`/`stock-posting-data.js` before it.** Audited directly, not assumed: only TWO Dashboard KPI tiles were ever hardcoded to 0 — `inventoryChangePct` and `lowStockChange` — because both are CURRENT-STATE rollups with no historical trail of their own, unlike sales/purchases (already dated on their own source records, needing no snapshot at all). Captured BOTH automatically (`ensureTodaySnapshot()`, once per calendar day, called from Dashboard's own boot) AND on demand (a "Capture Snapshot Now" button, an honest manual override so a trainee can see the mechanism work without waiting for a real calendar day to roll over). Today's own row is upserted (overwritten on re-capture); every earlier row is left alone — a deliberate, explained departure from Stock Ledger's own "no update, ever" stance, since today genuinely hasn't finished happening yet each time this runs. Deltas always diff current live figures against the latest snapshot strictly BEFORE today, never against today's own (still-forming) row. **No prior snapshot → `null`, never 0** — `dashboard.js`'s own `renderKpiTrend()` now shows "No prior-day data yet," visibly distinct from a genuine "No change vs yesterday," so this mechanism can never silently lie about a baseline that doesn't exist.

### Phase 9 — HR & Payroll (✅ COMPLETE, 4/4 modules): Attendance, Leave Application & Approval, Salary Structure, Payroll Processing/Payslip Generation. Employee Master already existed (Phase 3) but had no transactional workflows built on it until this phase.

**The first phase where the real dependency order matched the roadmap's own presentation order for once** (Attendance → Leave → Salary Structure → Payroll, each genuinely needed by the one after it) — worth noting because Phase 7 (Stock Ledger before Opening Stock) and other phases have shown this ISN'T guaranteed, so it was checked, not assumed. Also the first phase to build a real day-level RECONCILIATION between two independently-built modules that can legitimately disagree about the same day (Attendance's own Absent mark vs. Leave Application's own Approved leave) — Payroll (Module 04) is where that gets resolved, with an explicit precedence rule, not an implicit one.

1. ✅ **Attendance** — `data/attendance-data.js` + `pages/attendance.html/js`. Genuine storage, one record per (employeeId, date) — but UPSERT, not resolution #7's hard block, a third variant of composite-key uniqueness enforcement alongside Opening Stock's own block and Snapshot's today-only upsert: correcting a mismarked day is normal HR work, not a mistake to prevent, for ANY date, not just today. No lifecycle at all — the closest precedent is plain master-data CRUD, not a transactional Draft/Posted document, because marking attendance has no real-world approval gate (Leave Application, built right after, genuinely does). Bulk Mark reuses RFQ Creation's own `.checkbox-list` multi-select pattern for the real workflow ("mark everyone Present, then flag exceptions") rather than one-employee-at-a-time entry. Deliberately has NO "On Leave" status of its own, so the same fact is never recorded in two places that could disagree.

2. ✅ **Leave Application & Approval** — `data/leave-data.js` + `pages/leave.html/js`. A real decision gate (Pending → Approved/Rejected, +Cancelled from either Pending or Approved) — checked directly against Three-Way Matching's own `Draft → Approved/On Hold, +Cancelled` shape and found to need a different STARTING state, not the same one: nothing here is ever "drafted," a leave request is submitted complete and immediately awaits someone else's decision. The approver is derived, never chosen — frozen from the applicant's own `managerId` in Employee Master at the moment of application, the same "resolve once, freeze" shape used throughout this project. Overlap validation (two Pending/Approved applications can't claim the same days for the same employee) is a genuinely NEW kind of check, not a fit for any numbered duplicate-check resolution — it hard-blocks, because the conflict is a real impossibility (being on leave twice at once), not a redundant record. Leave balance is a fixed, flat, not-user-configurable annual figure per paid type (Casual/Sick: 12 days, Earned: 15) — Unpaid Leave has no entitlement to run out of, by definition, and `getLeaveBalance()` returns `null` for it rather than a fabricated number.

3. ✅ **Salary Structure** — `data/salary-structure-data.js` + `pages/salary-structure.html/js`. Master data with a real twist: a raise never edits history, it creates a NEW dated record — multiple structures per employee is the normal, GOOD outcome, not something resolution #7 should prevent. What that resolution DOES still apply to is two structures sharing the exact same `effectiveFrom` for one employee, a genuine ambiguity. No Edit action anywhere, on purpose — only New and Cancel; Cancel is unconditional, needing no usage guard, because Payroll (Module 04) always freezes its own computed figures at processing time, so cancelling a structure never reaches back and corrupts a past run's own history. `getEffectiveStructure()` resolves purely by date (latest `effectiveFrom` on or before the date asked), with no separate `effectiveTo` field to ever drift out of sync.

4. ✅ **Payroll Processing / Payslip Generation** — `data/payroll-data.js` + `pages/payroll.html/js`. The module every other one this phase was built toward, and the first place all three earlier modules' own outputs actually meet. `computeLopForPeriod()` walks every calendar day of a period for one employee with an explicit precedence: an Approved leave application (if one covers that day) always wins over Attendance's own record, since a leave decision is authorized while Attendance is just an unexplained fact — Attendance applies only where Leave says nothing, and a day with neither is assumed PAID, the same deliberate default Attendance's own header already committed to. Salary Structure is resolved once, as of the period's own last day (a raise landing mid-period pays the WHOLE period at the new rate — a named simplification, not true intra-month structure-splitting). Earnings prorate with any loss of pay; PF prorates along with the now-smaller Basic it's a percentage of; Professional Tax and TDS stay flat, since both are already-estimated figures in this simulator, not amounts tied to days worked. A Draft run is fully regenerable in place (same run id, fresh numbers); Processing freezes it as permanent history, immune to any later edit to Attendance, Leave, or Salary Structure — the same "resolve once, freeze" shape used everywhere else in this project, applied here for the first time to a whole BATCH of records at once rather than a single document's own fields. Payslip Generation is a VIEW over an already-computed line, not a second stored document — and, since a retrofit pass below, that view now also renders as a real, downloadable PDF, not just an on-screen modal. **GL posting was deliberately NOT built when this module first shipped** — a real, named gap, closed in a dedicated retrofit pass shortly after (see this section's own closing note and Section 4's own Payroll GL Retrofit entry for the full account of what changed and why).

**Payroll GL Retrofit (post-Phase-9 pass) — closing the one gap Phase 9 itself named on the way out.** Two new functions in `data/gl-posting-data.js`: `postPayrollProcessing()` (Dr Salary Expense / Cr PF Payable, Professional Tax Payable, TDS Payable — each conditional, only when a run's own total for it is actually nonzero — / Cr Salary Payable, entry-dated to the period's own last calendar day) and `postSalaryPayment()` (Dr Salary Payable / Cr the bank account chosen at the moment of marking a run Paid, Payroll's own mirror of Vendor Payment's Dr AP / Cr Bank shape). Five new roles in `data/gl-mapping-data.js` (Salary Expense, PF Payable, Professional Tax Payable, TDS Payable, Salary Payable — eleven roles total now), surfaced automatically on Posting Rules with zero code changes to that page's own rendering (it was already generic over `ERP_GL_MAPPING_ROLES`), plus a new "Payroll Ready" readiness card requiring only the two unconditional roles, the same pattern Sales' own readiness check already used for Output Tax. `pages/payroll.js` gained two calls into `gl-posting-data.js` — after `process()` and after `markPaid()` — plus a small new "Mark Paid" modal that asks which bank account disbursed the run right at that moment, rather than adding a `bankId` field to `payroll-data.js`'s own schema that would sit unused until then. Every balance was Node-verified across 9 scenarios (missing roles, a missing conditional role, all-deductions-nonzero, zero-TDS, zero-deductions-at-all, an empty run, no bank selected, an unlinked bank, and a fully valid payment) — the entry always balances by construction, since gross earnings is defined as PF + Professional Tax + TDS + net pay by `payroll-data.js`'s own math, never independently re-verified against Chart of Accounts. `payroll-data.js` itself needed zero changes — the same "business module doesn't know GL posting exists" separation this project has held to since Phase 6's own original retrofit.

**Payslip PDF (same pass).** The Payslip modal's own "Download PDF" button generates a real, multi-section PDF client-side using jsPDF, vendored locally at `assets/vendor/jspdf.umd.min.js` (fetched once via npm during development, MIT-licensed, committed into the project) rather than loaded from a CDN — consistent with this whole project's own offline-simulator framing; the generated file needs no network access to produce. One real, concrete lesson from building it: jsPDF's default standard PDF fonts (Helvetica, Times, Courier) have no ₹ glyph — a generated PDF silently dropped the currency symbol entirely until caught by actually rendering the output and looking at it, not just trusting that the code ran without throwing. The fix is "Rs." — the same plain-ASCII fallback real printed Indian financial documents already use for this exact reason, applied only inside PDF generation (`formatMoneyPdf()`, a separate function from the shared `formatMoney()` every on-screen figure and CSV export still uses, since HTML/CSS render the real ₹ through the browser's own system fonts without this limitation at all).

### Phase 10 — Manufacturing (✅ COMPLETE, 4/4 modules, stretch/optional): Bill of Materials, Work Order/Production Order, Material Issue for Production, Finished Goods Receipt (writes into Phase 7's stock ledger). Real full-suite ERPs include this; plenty of real deployments (trading companies, services businesses) never touch it — it stayed genuinely optional for "90% ERP coverage," and was the one tier of this whole roadmap explicitly allowed to stay undone. Built anyway, with the exact same rigor every required phase got — see the closing note to Phase 9's own entry above.

**The first phase whose own two "event" modules (Material Issue, Finished Goods Receipt) are a genuinely new pair — neither GRN's one-sided receiving shape nor Delivery Challan's one-sided issuing shape, because a Work Order is a real two-sided consumption/output relationship.** Checked directly against `ERP_StockLedgerRepository.recordMovement()`'s own existing signature before assuming anything needed to change — it already took a generic `referenceType`/`referenceId` pair, so the only genuinely new thing needed was two additive entries in its own `transactionTypes` vocabulary ("Material Issue", "Finished Goods Receipt"), not a new write path. Also the first phase to model a real, live-computed Work-in-Progress balance — material cost moves from Inventory into WIP on one event, then out of WIP into Finished Goods Inventory on the other, with the running difference always readable straight off the Work Order's own detail view, never stored redundantly anywhere.

1. ✅ **Bill of Materials** — `data/bom-data.js` + `pages/bill-of-materials.html/js`. Master data with a real twist of its own: nesting is genuinely supported (a component can be a Semi-Finished Good with its own Active BOM, a real sub-assembly), which meant this module had to own two things a flat BOM wouldn't need — cycle protection (`wouldCreateCycle()`, a hard block at save, the same "structurally impossible claim" shape Leave Application's overlap check established, not a numbered duplicate-check resolution) and a recursive cost rollup (`computeMaterialCostPerUnit()`, cycle-guarded a second, defensive time). That rollup is a deliberately different NUMBER from what Material Issue later posts — a STANDARD-COST estimate off Item Master's own static `purchasePrice`, for planning before any Work Order exists at all, the same estimate-vs-fact discipline Purchase Register's own `taxIsEstimated` flag already established, never quietly collapsed into one figure. "At most one Active BOM per finished item" turned out to be a genuinely new duplicate-check shape, not a fit for resolution #7's flat hard block — Draft BOMs for the same item coexist freely (the same freedom Salary Structure's own effectiveFrom versioning established), so `activate()` instead reuses Quotation Comparison's own MUTUAL-EXCLUSIVITY TOGGLE shape, auto-superseding whichever BOM was previously Active for that item rather than blocking the save. `scrapPercent` per line is a real, simple, deliberately-scoped wastage allowance rather than a separate wastage-tracking subsystem.

2. ✅ **Work Order / Production Order** — `data/work-order-data.js` + `pages/work-order.html/js`. Checked, not assumed, per the roadmap's own instruction, and found to be a genuinely new workflow shape — not GRN's, not Delivery Challan's, but closer to PO's own "hub" pattern: one parent record several independent downstream modules (Material Issue, Finished Goods Receipt) build from over time without chaining through each other. **Not exclusive over its own BOM** — unlike almost every earlier "build one from one" relationship in this project, the same BOM is meant to be reused across many Work Orders, the same "not applicable, and here's why" reasoning Vendor Evaluation established first. `start()` is a deliberate, explicit action (not an automatic side effect of the first Material Issue), keeping the two modules from silently mutating each other mid-flight. Every quantity/cost rollup on this module (`getProducedQuantity()`, `getTotalMaterialCostIssued()`, `getTotalCapitalizedCost()`, `getRemainingWipCost()`) is live-computed, never stored, the same discipline Item Master's own `getLiveCurrentStock()` established — and `computeCompletionChecklist()` is purely informational, exactly like Purchase Closure's own, never gating `complete()`. No reopen from Completed or Cancelled, the same terminal-state immutability Purchase Closure/Sales Close both settled on. Cancellation does NOT reverse already-posted stock movements — named plainly in the file header, not hidden, the same "a stock movement records a fact that already happened" reasoning Stock Ledger's own header already established.

3. ✅ **Material Issue for Production** — `data/material-issue-data.js` + `pages/material-issue.html/js`. The first module in the whole codebase whose Stock Ledger "destination" is a Work Order rather than a customer or a transfer — confirmed to need no new API shape, just the additive vocabulary entry noted above. Lines are DERIVED from the picked Work Order's own BOM (a resolution #8 variant, no free-form add/remove), pre-filled with whatever's still OUTSTANDING against the full planned batch (not the full requirement again after a partial issue), genuinely meant to be overwritten — Goods Receipt's own "a discrepancy is the normal case" precedent, reused a step further downstream. Costs the ACTUAL FIFO-weighted-average cost via `ERP_StockValuationRepository.getWeightedAverageCost()` at posting time — reused directly from Stock Transfer's own established cost-carry-forward convention, not reinvented — a deliberately DIFFERENT number from BOM's own standard-cost estimate. Insufficient stock skips a line rather than posting it lopsided, the exact same precedent Stock Transfer's own `post()` already set, with the skipped count reported back for the page to announce. `Draft → Issued → Cancelled` (Cancelled only from Draft) — the same "administrative formalization, immutable once posted" shape GRN and Stock Adjustment both use, for the same underlying reason (Stock Ledger has no update()/remove() at all).

4. ✅ **Finished Goods Receipt** — `data/finished-goods-receipt-data.js` + `pages/finished-goods-receipt.html/js`. The mirror event, closing the pair: a Work Order's own completed output arrives into Stock Ledger as the finished item, at a cost computed — never typed in — from what's genuinely still in Work-in-Progress for that order (material issued so far, minus whatever earlier receipts on the same order already capitalized), spread across the units still planned. That allocation is a MOVING AVERAGE across the remaining planned run, not an exact per-batch trace — named plainly as a limitation in the file header, the same way GRN/Invoice Verification's own assumed-exact-match simplification is named in `gl-posting-data.js`. **Deliberately capitalizes materials cost only — no labor/overhead absorption modeled in this phase**, a real, named scope cut rather than a shallow fake of one: full overhead absorption needs its own Applied-vs-Actual variance account and a cost-driver concept (labor/machine hours) nothing in this project tracks until Time Tracking exists (Phase 15). `quantityProduced` defaults to the order's own remaining planned quantity, genuinely meant to be overwritten. Same `Draft → Received → Cancelled` shape and reasoning as Material Issue.

**Manufacturing GL posting — built in the same pass as the modules themselves, deliberately NOT deferred the way Payroll's own GL posting first was.** Two new functions in `data/gl-posting-data.js`: `postMaterialIssue()` (Dr Work-in-Progress / Cr Inventory — reusing the EXISTING `inventoryAccountId` role for the credit side rather than adding a redundant "Raw Materials Inventory" role, since one already means "value currently sitting in the warehouse") and `postFinishedGoodsReceipt()` (Dr Finished Goods Inventory / Cr Work-in-Progress, clearing WIP as production completes). Two new roles in `data/gl-mapping-data.js` (Work-in-Progress, Finished Goods Inventory — thirteen roles total now), both REQUIRED rather than conditional (unlike Payroll's own PF/PT/TDS roles) since there's no legitimate "zero this period" case once any material has been issued at all — surfaced automatically on Posting Rules with zero code changes to that page's own rendering, the same `ERP_GL_MAPPING_ROLES`-generic pattern the Payroll GL Retrofit already proved out. `pages/material-issue.js` and `pages/finished-goods-receipt.js` each gained one call into `gl-posting-data.js`, right after their own `post()` call, the identical typeof-guarded pattern every other auto-posting page in this project already follows.

**A whole new sidebar group, not incrementally-converted stubs.** Since all four modules shipped in one pass rather than across separate sessions, the "Manufacturing" sidebar group was inserted directly as four live links across all 81 already-shipped pages in one retrofit sweep (`data-group-key="manufacturing"`, placed after "HR & Payroll") — the same "add the whole group at once" approach the Sales group used earlier in this project, rather than the locked-stub-per-module treatment that only makes sense across genuinely separate sessions.

**Phase 10 is now complete — every tier this roadmap named, required or optional, is done.** 88 modules total (30+20+10+10+6+4+4+4 across Phases 1-10), fully built, retrofitted, and validated. This was a marathon, not a single-session task, worked through across many conversation turns / sessions, each ending with a validated, working state and an updated version of this document — see Section 10 for the full closing status.

### Phase 11 — Role-Based Access Control (✅ COMPLETE — cross-cutting retrofit + new module). Read the roadmap's own "architecture ceiling" note first — this can only ever be a UI-level simulation (hiding/disabling actions per a selected role), never real security, the same honesty the dummy login system already has, now stated explicitly in `data/rbac-data.js`'s own header. **The single most invasive retrofit this project has done** — touched the sidebar, the page-load gate, and the shared modal/confirm system on every one of the 85 already-shipped pages, not just a handful of `post()`/`raise()` call sites the way the GL Posting retrofit did.

**The role model, decided and justified, not defaulted to a role-per-phase.** Six roles — System Administrator, Purchase & Sales Manager, Finance Executive, Inventory Controller, HR Manager, Student Trainee — reusing the exact `role` strings `data/users.js` already carried on every dummy user (discovered, not invented: that field was already flowing into `session.role` at login and already being used as a soft, non-blocking hint in three Procurement approval modules). Only one new role was needed — HR Manager, the one functional area with no existing persona — which meant one new dummy user (`hr` / `HrTeam@123`, USR-1006) and one new login-page quick-login chip, both wired in without touching any of the other five. "Current role" deliberately isn't a separate per-session choice; it's simply whatever `role` the signed-in account carries, exactly the way a real system's access follows the account rather than a login-time picker.

**Two genuinely different shapes of restriction, applied to two genuinely different kinds of role, not one blanket mechanism forced onto both.** The four functional roles each get a NARROWED sidebar (only their own department's own pages, built from a real, audited page-by-page classification of all 85 pages — independent of which sidebar group/phase originally shipped a page, since Warehouses and Cost Centers both shipped under Company Setup but are classified here by what they're actually FOR) with FULL action rights inside that scope, plus a redirect-with-toast if they reach a restricted page directly by URL. Student Trainee gets the opposite shape on purpose — every page stays visible (a genuine read-everywhere learner/auditor persona, not a department), but zero mutating rights anywhere, enforced at the RUNTIME level rather than per-module: `window.ERP.openConfirm()` and `window.ERP.openModal()` (the two established, universal choke points every destructive/state-changing action and every create/edit form already funnel through — Section 2's own Rule 3) were each given one Viewer check at their own top, reaching the overwhelming majority of the ~90-module surface with ZERO changes to any individual module's own file. `openModal()`'s own allow-list (`VIEWER_ALLOWED_MODAL_IDS`) is a real, audited list, not a guess — every one of the 143 modal ids across the whole project was checked by hand and sorted into "ends in DetailModal, always a read-only view, always allowed," "ends in FormModal, always blocked," or one of a small number of individually-named exceptions (ledger/FIFO-layer/payslip drill-downs — genuinely read-only despite their own bespoke names; `changePasswordModal` — a personal account action on the signed-in user's OWN login, not a business-data mutation, exempted for that reason specifically).

**One honestly-named exception, found by that same audit and closed directly rather than left as a silent gap.** Vendor Selection's own per-row vendor decision (Phase 4) saves immediately on click with no `openConfirm()`/`openModal()` in between at all — the first "quick, individually-reversible working decision" UI shape this project ever built, and the one place in ~90 modules where a real mutation doesn't funnel through either shared choke point. Rather than claim coverage the centralized mechanism doesn't actually have, `pages/vendor-selection.js` got one small, direct, honestly-commented Viewer check of its own at that exact click handler — the ONE module-specific retrofit this phase needed beyond the generic mechanism, and it's named as exactly that in both files' own comments, not folded silently into "handled."

**A new small admin module, as the roadmap's own brief asked for**: **User & Role Management** (`pages/user-role-management.html/js`, Admin-only, added to the Company Setup sidebar group) — a settings-style page, not a full CRUD list, since the user set is a small fixed set of six. Reuses Vendor Selection's own "saves immediately, no big form Save" shape a second time (a role dropdown per user row) and `ERP_UserRepository.saveOverride()` — the exact mechanism Profile edits already use — for persistence, needing zero new plumbing. An account can't change its own role (a small, deliberate self-lockout guard); a role change takes effect the next time that account signs in, not instantly for an already-open session elsewhere, a real and named limitation rather than a solved one (nothing here has any way to reach into a different browser tab's own sessionStorage).

**A stale piece of foreshadowing text, written all the way back in Phase 1, finally caught up to reality.** The login page's own training guide said "this simulator seeds five roles so you can feel that difference once the Dashboard module ships" — true when Login was built, increasingly wrong every phase since (RBAC didn't actually exist until now, many phases after Dashboard), and now updated to describe what's ACTUALLY true: six roles, genuinely enforced throughout the app. A small thing, but worth naming — a training tool's own explanatory copy can go stale exactly the way its code can, and it's worth grep-checking old copy against current reality when a phase finally delivers on something an earlier phase's own text was already describing.

**Fail-closed on an unregistered page, not fail-open — a deliberate choice for a TEACHING tool about access control specifically.** An unlisted `pageKey` in `ERP_PAGE_ROLE_MAP` defaults to Admin-only with a loud `console.warn`, not universally open — see Section 2's own new Rule 9, the standing process rule this phase adds for every module from Phase 12 onward.

Retrofit mechanics: `data/rbac-data.js` (new, pure repository, no UI side effects) is loaded on all 87 pages immediately after `script.js`; `script.js` itself gained `enforcePageAccess()` (sidebar hiding + the page-load gate) plus the Viewer checks inside `openModal()`/`openConfirm()`; all 85 already-shipped pages' own JS got one scripted, verified insertion (`if (!window.ERP.enforcePageAccess(session, "pageKey")) return;`, right after the existing `requireSession()` check) — the page key was derived from each file's own filename and cross-checked against `ERP_PAGE_ROLE_MAP` programmatically (0 missing, 0 typos, 0 duplicates) before any file was touched.

### Phase 12 — Fixed Assets (✅ COMPLETE, 4/4 modules): Asset Register, Depreciation Schedule, Depreciation Run, Asset Disposal. The roadmap's own brief allowed 4-5 modules; this shipped 4, with the optional fifth deliberately not invented just to hit a number — the four cover the full lifecycle (acquire → project → post → dispose) with nothing genuinely missing between them.

**Every formula in this phase was Node-verified against hand-traced numbers BEFORE shipping — and that verification caught a real, subtle, already-written bug that no syntax check or code review would have.** The first version of `depreciation-run-data.js`'s own monthly WDV math applied `annualRate / 12` to the declining monthly balance, which LOOKS obviously right and is wrong: compounding a naive twelfth of the annual rate for 12 periods does not equal one annual reduction at the full rate (`1-(1-r/12)^12 ≠ r`). Traced in Node against a real 5-year, ₹120,000-cost, ₹6,000-residual asset, it left the asset sitting at ₹10,140 with its full useful life already elapsed — roughly 40% short of where it should have landed. The corrected, verified formula derives the true monthly-equivalent rate instead (`1 - (1 - annualRate)^(1/12)`), which closes at precisely ₹6,000.00 after the full life, to the paisa. **This is the single best argument this project has produced for why Rule 6 (Node-verify every nontrivial computation) exists**, and it's now Section 9's own closing lesson for the phase.

1. ✅ **Asset Register** — `data/asset-data.js` + `pages/asset-register.html/js`. Master data, deliberately NOT a GL-posting event of its own (the same boundary Item Master already draws — a real capitalization entry is what the general-purpose Journal Entry module exists for; this phase's GL work is scoped to the two events it can actually COMPUTE). Asset category is a fixed 8-value enum (Schedule II's own vocabulary), reusing Item Master's own embedded-vocabulary shape rather than adding a 6th master-data CRUD module for eight rarely-changing names. Depreciation method is chosen PER ASSET, not one company-wide policy — real companies genuinely run Straight-Line on Buildings and WDV on Plant & Machinery in the same books, the same "policy lives on the record" shape Salary Structure already established. Both Schedule II formulas live here and are the real ones, not guessed flat percentages. Accumulated depreciation and net book value are live-computed across two sibling modules, never stored. **Duplicate check: not applicable, named explicitly** — a company routinely owns ten identical chairs; this is the first time this project's own "repeat is normal, not a duplicate" reasoning (Vendor Evaluation, Payment Collection) was applied to MASTER data rather than a transactional record. Editing is locked the moment any depreciation has posted against an asset, since changing cost/life/method retroactively would silently corrupt every month already charged.

2. ✅ **Depreciation Schedule** — `pages/depreciation-schedule.html/js`, **and no `data/` file at all, deliberately**. A pure read-only projection: it stores nothing and decides nothing, so it earns no repository — the same "a report reuses forward, it doesn't re-derive" discipline every Phase 8 report follows, taken one step further. Crucially, the projection REUSES Asset Register's own verified annual formulas plus Depreciation Run's own verified monthly-equivalent rate rather than reimplementing them a third time; that reuse was then itself verified in Node by running the projection and the real Depreciation Run side by side month-for-month across both methods — **max per-month difference: ₹0.0000, total difference: ₹0.0000**. Yearly/monthly toggle; the monthly view is where acquisition-month proration and final-month clamping are actually visible.

3. ✅ **Depreciation Run** — `data/depreciation-run-data.js` + `pages/depreciation-run.html/js`. **Checked directly against `data/payroll-data.js` before writing a line, exactly as the roadmap instructed — and the similarity genuinely held**, so it was reused rather than reinvented: `findActiveRunForPeriod()` mirrors Payroll's byte-for-byte in shape, `generateRun()` is create-or-refresh for a Draft the same way Payroll's is, one-run-per-period excluding Cancelled is resolution #7's familiar shape with its familiar exception intact, and the duplicate-period BLOCK lives at the page rather than the repository, matching Payroll's own split precisely. Where it genuinely differs: **no `markPaid()` equivalent at all** — a depreciation run has no cash leg, so the lifecycle is two-stage (Draft → Processed) not Payroll's three. Three rules apply to every line every run: acquisition-month proration by days, clamping so book value can never fall below residual, and exclusion of an already-disposed asset (whose own final charge lives on its disposal record instead, so it's never double-counted). A ₹0 line for a fully-depreciated asset is shown, not hidden — the same "show the zero" ethos Trial Balance and Material Issue already hold to. **Cancelling a Processed run does NOT reverse its own GL posting — named plainly as the same limitation Payroll's own `cancel()` already carries**, rather than quietly implying this module handles it better.

4. ✅ **Asset Disposal** — `data/asset-disposal-data.js` + `pages/asset-disposal.html/js`. Real gain/loss accounting, not a placeholder. **The final partial-period depreciation charge is computed right here rather than requiring a stub Depreciation Run first** — a deliberate UX and accounting decision (real accounting charges depreciation to the disposal date before computing gain/loss, and forcing a separate run for it would be clunky and forgettable), prorated by days from whatever was last actually posted, using the same verified annual math applied as a fraction of a year. That charge is stored on the disposal record itself, and `asset-data.js`'s own rollup reads both sources and adds them — the same cross-module live-rollup shape Work Order already established. A write-off is simply a sale with ₹0 proceeds, which makes the loss equal whatever book value remained. `previewDisposal()` is called by BOTH the live create-form preview and `post()` itself, so what's previewed can never drift from what posts — Finished Goods Receipt's own Phase 10 precedent, reused.

**Fixed Assets GL posting — built in the same pass as the modules themselves, exactly as the roadmap's own brief recommended.** Five new roles in `data/gl-mapping-data.js` (Fixed Assets at cost, Accumulated Depreciation, Depreciation Expense, Gain on Disposal, Loss on Disposal — **eighteen roles total now**), all surfaced on Posting Rules with zero code changes to that page, the same `ERP_GL_MAPPING_ROLES`-generic pattern now proven for a third phase running. Gain and Loss stay as two SEPARATE roles rather than one net account, because a real P&L keeps Other Income and Other Expense apart. Per-asset-category GL segregation was considered and deliberately not built — one Fixed Assets account covers every category, the same proportionate call the single `inventoryAccountId` role already made. Two new functions in `gl-posting-data.js`: `postDepreciationRun()` (Dr Depreciation Expense / Cr Accumulated Depreciation) and `postAssetDisposal()` — a genuine COMPOUND entry (clear accumulated depreciation, remove the asset at original cost, record proceeds through the disposal's own chosen bank reusing Vendor Payment's pick-a-bank pattern, and post exactly ONE gain-or-loss line, never both). **Verified in Node to balance to the paisa across a gain case (Dr 107,999.92 / Cr 107,999.92), a fully-depreciated write-off (Dr 20,000.00 / Cr 20,000.00), and a depreciation run posting** — using the real, unmodified posting function, not a reimplementation.

**RBAC-aware from its own first version — Section 2's Rule 9 honored on its first real test.** All four pages were registered in `ERP_PAGE_ROLE_MAP` (Finance Executive, the same real-world ownership call already made for Cost Centers — asset accounting is a finance function despite physically involving machinery) and each calls `enforcePageAccess()` from its own first line of boot, as part of building them rather than as a later retrofit. A new "Fixed Assets" sidebar group was added across all 86 previously-shipped pages in one verified sweep.


### Phase 13 — Budgeting & Forecasting (✅ COMPLETE, 2/2 modules): Budget Master, Budget vs. Actual. The roadmap allowed 2-3 and explicitly warned "don't pad it with modules it doesn't need just to match the others' scope" — **so it shipped 2, and that instruction was honored rather than quietly ignored.** A third module was considered (a forecast/reforecast concept) and rejected: it would have been a thinner copy of Budget Master with a different status label, which is exactly the padding the brief warned against.

**The Cost Center dimension question — the roadmap left it genuinely open ("or Cost Center, if you want that dimension too"), and it was settled by READING THE DATA rather than by preference.** Checked `data/journal-entry-data.js` directly before designing anything: a journal entry LINE carries exactly `accountId`, `debit`, `credit`, `lineNarration` — there is **no `costCenterId` on it anywhere**, and no module writes one. That means cost-center ACTUALS cannot be derived from the General Ledger at all, by anyone, today. Budgeting by cost center would therefore have produced a budget comparable against nothing — a variance report with a populated budget column and a permanently empty actual column, which is worse than not offering the dimension. Budget Master is scoped to **GL account × period**, and `data/budget-data.js`'s own header records both the decision and its real prerequisite (putting `costCenterId` on the journal line and populating it from every auto-posting module — a Phase 11-scale retrofit, not a field added to one file) so a future phase doesn't re-litigate it from scratch.

**A pre-existing overlap, named honestly rather than silently duplicated or overwritten.** `data/cost-center-data.js` (Phase 2) already carries its own `annualBudget`, `actualSpend` and `getVariance()`. Verified by grep that `actualSpend` is a **manually typed number no transactional module ever writes** — so Cost Center's variance is a hand-maintained estimate, not a GL-derived figure. Phase 13 deliberately does not touch, extend, or attempt to reconcile with it: two things both called "budget" is confusing, but a new module silently overwriting an older module's own fields would be worse. Budget Master is the GL-anchored, genuinely-comparable budget; Cost Center's pair remains exactly what it always was.

1. ✅ **Budget Master** — `data/budget-data.js` + `pages/budget-master.html/js`. **Periods are reused from Financial Year, never reinvented**: an FY record already generates its own 12 monthly `periods` (each with `id`/`name`/`startDate`/`endDate`), so a budget line references a period by that same id and Budget vs. Actual reads the date range straight off the FY record — no second period concept, no duplicated date math. **Only Income and Expense accounts are budgetable**, a real decision rather than a limitation: those are period FLOWS, while Asset/Liability/Equity hold point-in-time BALANCES whose planning is a genuinely different exercise (cash-flow forecasting). The scoping deliberately matches `profit-and-loss-data.js`'s own exactly, so the two reports can never disagree about what's in scope. **One Approved budget per FY via Quotation Comparison's mutual-exclusivity toggle, now reused a third time** (after BOM's `activate()` in Phase 10) — Drafts coexist freely because multiple scenarios is what real budgeting looks like, so a flat duplicate block would be wrong; what needs exclusivity is which ONE budget is live. Entry UX is annual-amount-plus-distribution rather than 144 hand-typed cells, with `buildEvenDistribution()` **Node-verified across 10 edge cases** (including amounts that don't divide by 12, sub-rupee totals, and zero) to sum to EXACTLY the annual figure — remainder lands on the final period, because a naive `round(annual/12)*12` silently loses or invents paisa.

2. ✅ **Budget vs. Actual** — `pages/budget-vs-actual.html/js`, **and no `data/` file at all** — the second module in the project to earn that, after Phase 12's Depreciation Schedule, for the same reason: it stores nothing and decides nothing. Actuals come from `ERP_GeneralLedgerRepository.getLedgerForAccount()` with the period's own dates — the exact same call `profit-and-loss-data.js` makes — and the period-movement formula is deliberately the SAME one P&L uses, so the two reports can never disagree. This is the "reuse forward, don't re-derive" discipline the roadmap's own Phase 13 brief asked for by name.

**The variance convention — the roadmap explicitly flagged this as something to decide deliberately, not by accident, and it was.** A raw "actual minus budget" figure means OPPOSITE things by account type, and presenting both as one undifferentiated signed number is precisely how a real report misleads people. So: **Income variance = actual − budget** (earning more is good); **Expense variance = budget − actual** (spending more is bad). Both are oriented so **positive ALWAYS means favourable**, the standard management-accounting convention — and the only framing under which a single "Total Variance" line across mixed Income and Expense rows is arithmetically meaningful at all. **Node-verified across all six directional cases plus the critical mixed-type property** (income +₹20,000 favourable and expense ₹20,000 unfavourable must cancel to exactly 0 — it does). Every row is additionally labelled Favourable/Unfavourable in words, because a bare signed number in a column still invites the exact misreading the convention exists to prevent. Variance % guards against a zero budget rather than dividing by it, the same guard `cost-center-data.js` already uses.

**Design-system addition:** three new scoped CSS classes (`.budget-period-grid`, `.budget-period-cell`, `.budget-period-details`) for the collapsed 12-period editor — progressive disclosure inside a `<details>` rather than blowing out the row or adding a second modal layer. All three use existing design tokens; no new CSS variables were introduced.

**RBAC-aware from its own first version** (Rule 9, second phase running): Budget Master is Finance Executive; Budget vs. Actual additionally opens to Purchase & Sales Manager, the same overlap reasoning Purchase/Sales Register already use — a department head genuinely needs to see performance against their own budget.


### Phase 14 — CRM Extension (✅ COMPLETE, 3/3 modules): Lead Pipeline, Support Tickets / Case Management, Contract Management. The roadmap allowed 3-4 and listed exactly 3; it shipped 3 — no invented fourth.

**The roadmap told this phase to read `data/customer-inquiry-data.js`'s own header before building anything, and that instruction paid off immediately: the header describes this module in advance.** Its own words: *"A real CRM would also support inquiries from not-yet-onboarded prospects (a 'Lead' concept distinct from 'Customer'), logging a name/phone/email before any formal customer account exists. This simulator deliberately doesn't build that distinction."* That was an honest, documented simplification in Phase 5; Lead Pipeline is the module that finally earns it out — the same "a named gap gets closed later, deliberately" arc Phase 16 is scheduled to complete for Salary Structure's TDS. **Customer Inquiry itself was not modified at all** — its `customerId` stays required, exactly as its header describes, because an Inquiry genuinely is a question from a known customer. The Lead is what sits *before* that.

**The roadmap's explicit question — "is this really a NEW workflow shape, or close enough to Customer Inquiry's to share? Don't assume either answer" — was checked, and the answer is SHARE IT.** Side by side: Customer Inquiry runs New → In Progress → Converted / Lost (+ Cancelled); Lead Pipeline runs New → Qualified → Converted / Lost (+ Cancelled). "Qualified" and "In Progress" are the same state wearing a different domain label. Converted and Lost mean structurally identical things. Both are pipeline progression, not a permission gate — which is precisely what Section 9's 7th shape *is*. So Lead Pipeline reuses shape 7 wholesale (same required-`lostReason` discipline, same reopen-from-Lost allowance, same Cancelled-vs-Lost distinction) rather than adding a near-duplicate 8th entry that would have been **catalog noise, not a real distinction.**

**And then Support Tickets ran the same check and got the opposite answer — which is the point of running it honestly.** Open → In Progress → Resolved → Closed is genuinely NOT a pipeline: a pipeline has *mutually exclusive* terminal outcomes (Converted XOR Lost) where the whole question is which branch you land on. A support lifecycle has one success path with a *sequential two-stage ending* — Resolved (we believe it's fixed) then Closed (the customer agrees). Those aren't competing outcomes; they're consecutive confirmations, and the gap between them is where real support lives. Nothing in the existing catalog had that structure, so this is a genuine **8th shape**. Two modules, one phase, same check, opposite answers, each recorded with its reason.

1. ✅ **Lead Pipeline** — `data/lead-data.js` + `pages/lead-pipeline.html/js`. The one real departure from this project's long-standing "name a real master record, don't accept free text" discipline: a Lead carries free-text `leadName`/`phone`/`email` and **no `customerId` at all**, because the entire point is that no Customer exists yet. Deliberate, not a lapse — creating Customer records for prospects who never buy is exactly the pollution real CRMs use a separate Lead entity to avoid. `convert()` is the only place a Lead becomes real data: it creates a genuine Customer Master record, and **optionally** a follow-on Customer Inquiry (optional because forcing one would invent a question the prospect never asked). Both ids are stored back, so the chain Lead → Customer → Inquiry → Quotation stays walkable. Conversion rate is measured against leads that reached a conclusion (Converted + Lost), excluding Cancelled — counting withdrawn records would understate performance for reasons that have nothing to do with sales.

2. ✅ **Support Tickets / Case Management** — `data/support-ticket-data.js` + `pages/support-tickets.html/js`. **Priority and severity are modeled as two separate dimensions, not one field**, because they measure genuinely different things: severity is impact (a factual property of the problem), priority is scheduling (a business decision weighing severity against who the customer is). A Low-severity issue for the largest account can legitimately be High priority; one field destroys that. Severity *suggests* a priority via `suggestPriorityFor()` — pre-filled and freely overridable, Goods Receipt's own precedent. **`reopen()` is a first-class transition, not an error path** — deliberately unlike every other reopen in this project, which all recover from a *negative* terminal state (Lost/Rejected); this one reopens from a *positive* state that turned out premature, which is why `reopenCount` is tracked: a ticket reopened three times is a real signal about fix quality. Closed is terminal and cannot be reopened — a recurrence is a new ticket, so resolution-time metrics stay honest. **No SLA deadline engine — a named scope cut**: that needs business-hours calendars and escalation workflow; `getAgeHours()` gives the honest raw number instead of faking a clock.

3. ✅ **Contract Management** — `data/contract-data.js` + `pages/contracts.html/js`. **Status is date-derived, reusing Cost Center's own established `isExpired()` precedent rather than inventing one**: an Active contract whose `endDate` has passed reports Expired via `getEffectiveStatus()`, so a contract nobody renewed stops claiming to be live. Stored status records the administrative decision; derived status records reality; the detail view shows both when they differ — the same two-number honesty running through this project since Purchase Register's `taxIsEstimated`. **`renew()` creates a NEW contract, never mutates dates in place** — the single most important decision in the file, because extending `endDate` would destroy exactly the history contract management exists to keep. Three genuinely different endings stay distinct (Expired / Renewed / Terminated-with-reason) where a single "Closed" would have flattened them. Overlapping contracts for one customer are a **soft warn, deliberately NOT Leave Application's hard block** — a leave overlap is structurally impossible, but concurrent contracts with one customer is a real arrangement. **Auto-renew is a flag, not an engine** (no scheduler exists offline), and **no GL posting** — a contract is an agreement, not a transaction; posting its value at signature would recognize unearned revenue, which isn't merely out of scope but accounting-wrong.

**Verification:** all three lifecycles were driven end-to-end in Node against the real shipped repositories — **37 assertions, all passing** — covering the full lead funnel including a conversion that genuinely creates a Customer with a real code plus a linked Inquiry, the optional-no-inquiry path, lost-and-reopen, the ticket path through resolve → reopen (count increments, `resolvedAt` clears) → resolve → close with Closed confirmed unreopenable, and the contract path proving date-derived Expired, that renewal creates a new record with the history chain intact both ways and **the original's dates untouched**, that a contract can't be renewed twice, and that renewal-due windows and active-value metrics exclude what they should.

**RBAC-aware from first version** (Rule 9, third phase running): all three registered to Purchase & Sales Manager — leads, post-sale support and customer contracts are all customer-facing commercial work, the same functional-ownership call that placed every Phase 5 Sales module.


### Phase 15 — Returns, Credit & Debit Notes (COMPLETE, 3/3 modules — plus a necessary cross-cutting retrofit). **A phase that was NOT in the original 17-phase roadmap at all** — it came out of a full gap audit of the shipped project, which found that the single largest functional hole wasn't any of the named-but-unbuilt phases: it was that nothing anywhere could send goods back or correct an invoice. Every document in Phases 4-10 moves value in exactly one direction. A real ERP that can't process a return or issue a credit note isn't usable by any real business, and under GST a credit note is legally required, not optional. So this phase was inserted AHEAD of the original Phases 15-17, which are renumbered 18-20 below and otherwise unchanged.

1. ✅ **Sales Return** — `data/sales-return-data.js` + `pages/sales-return.html/js`. **The first document in this project that moves stock BACKWARDS along a chain.** Built FROM a Raised Tax Invoice, not the Delivery Challan — checked, not defaulted: a customer returns against the document they actually hold, which is the invoice, the same call Dispatch made one phase earlier for the same underlying reason. That makes Tax Invoice a genuine FOUR-way hub (Dispatch, Payment Collection, Receipt, Sales Return), not the three-way one Dispatch's own header first named.

   **QUANTITY ONLY, NO PRICING — the Delivery Challan precedent mirrored onto the reverse side.** `returnLines[]` deliberately carries no `unitPrice`/`taxId`, exactly the way `challanLines[]` doesn't. Physical fact here, money fact in Credit Note (#2), which will resolve pricing by joining each return line back to its own invoice line BY LINE ID — the same two-hop join `tax-invoice-data.js`'s own `buildInvoiceLines()` performs forward, made possible because every module in this chain has preserved each line's id unbroken since Sales Quotation. **Do not bolt pricing onto this file later.**

   **NOT exclusive over its parent invoice** — the second module to break that shape after Payment Collection (Phase 5, #8), because several partial returns against one invoice over months is normal reality. **What replaces exclusivity is a genuinely NEW kind of check in this codebase**: a cumulative over-return guard. Per invoice LINE, the sum of every non-Cancelled return's `returnQuantity` can never exceed what was invoiced. It hard-blocks (returning more than was sold is a real impossibility, the same reasoning as Leave Application's overlap check, applied to a quantity rather than a date range), and `getReturnedQuantityForLine()` is a live scan rather than a stored running total, so cancelling a draft frees its claim back up automatically with nothing to reconcile. A Draft DOES reserve its claim against other returns while it exists, but never against itself when being edited (`excludeReturnId`) — both behaviours verified, not assumed.

   Terminal status is `Returned`, NOT `Received` — a near-miss collision with Receipt's own terminal state (money confirmed in the bank), resolved the way every status-word collision in this project has been. Stock comes back at `ERP_StockValuationRepository.getWeightedAverageCost()`, reusing Stock Transfer/Material Issue's own convention; NAMED SIMPLIFICATION, in the file header rather than implied: a fully precise system would restore the exact FIFO layers the original sale consumed at their own original costs, and this creates one new layer at current weighted-average instead. `"Sales Return"` was added to `stock-ledger-data.js`'s own `transactionTypes` vocabulary — additive only, the same treatment Phase 10 gave its two entries, and checked first: `recordMovement()`'s existing generic `referenceType`/`referenceId` pair already fit, and a return is an ordinary positive inbound movement, so no new write path or sign handling was needed.

   **NO GL posting on this module, deliberately** — a direct consequence of the quantity-only decision: no pricing means no amount to post. Credit Note (#2) owns the financial reversal (Dr Sales Revenue + Dr Output Tax Payable / Cr Accounts Receivable). Same split Delivery Challan (no GL) and Tax Invoice (GL) already use forward.

   **Verified in a Node sandbox against the real shipped repositories before shipping — 32 assertions across 6 scenarios, all passing**: line building with zero defaults and no price fields, the over-return guard at 11/10/8/7 and at exactly-remaining, negative and all-zero rejection, the self-exclusion case when editing a draft, posting (status, stock balance, movement type, per-line count), the cumulative guard tightening after a post, refusal of update/cancel/double-post on a posted record, a cancelled draft freeing its quantity back up and posting nothing to stock, non-exclusivity (two returns on one invoice), the picker pool dropping a fully-returned invoice, and `canPost()` refusing with no warehouse.

   RBAC-aware from its first version (Rule 9, fourth phase running): `["Purchase & Sales Manager", "Inventory Controller"]` — genuine dual ownership, not hedging (accepting a return is commercial, booking goods into a warehouse is stores), the same reasoning Budget vs. Actual and AP/AR Aging already use. A new "Returns & Credit Notes" sidebar group (`data-group-key="returns"`) was inserted across all 96 pages in one verified sweep, placed between Sales and Finance. Retrofits Tax Invoice's own Detail modal with an AGGREGATE "Sales Returns" row (count + total quantity + most recent status), mirroring Payment Collection's aggregate retrofit rather than Dispatch/Receipt's single-link one, since this module isn't exclusive; `tax-invoice.html` now also loads `../data/sales-return-data.js`.

2. ✅ **Credit Note** — `data/credit-note-data.js` + `pages/credit-note.html/js`. **The first module in this project built from TWO parents, and that is unusual enough here to be justified rather than assumed.** Every other document in the codebase has exactly one upstream record. A credit note doesn't, because there are two genuinely different real reasons to raise one and collapsing them would model one of them wrongly: a **Goods Return** (a posted Sales Return came back — quantity-driven, lines derived, price frozen, nothing typed) and a **Price Adjustment** (nothing came back at all — a rate was wrong, a discount was agreed late — value-driven, no quantity exists, only an amount per line). Forcing the second through a quantity × price shape would mean inventing either a fake quantity or a fake rate, and both lie in the books. Both types are standard in Tally, Zoho Books and SAP alike, and a GST credit note is legally required for either.

   **The two line shapes meet in exactly ONE function** — `computeLineTotal()`: a line carrying its own `creditAmount` IS that amount; any other line is quantity × unitPrice. One branch in one place, rather than two parallel repositories. Everything downstream (totals, the guard, GL posting, AR Aging) is shape-agnostic by construction.

   **THE LINE-ID JOIN SALES RETURN PROMISED IS NOW KEPT.** `buildLinesFromReturn()` recovers each returned line's price and tax by finding the invoice line with the SAME id — the same unbroken-line-id property `tax-invoice-data.js`'s own `buildInvoiceLines()` relies on forward. This is precisely why Sales Return was built quantity-only. A return line whose invoice counterpart has vanished is SKIPPED rather than credited at zero (a ₹0 priced line looks like a real decision; a missing one is honest).

   **EXCLUSIVE OVER A SALES RETURN, NOT OVER AN INVOICE** — both halves deliberate. One return gets at most one note (crediting the same goods twice is simply wrong); one invoice can collect many notes over time (a partial return's credit plus later adjustments), so `linkedInvoiceId` stays a plain FK, the same call Sales Return made one module earlier.

   **A VALUE GUARD, WHERE SALES RETURN HAS A QUANTITY GUARD — a genuinely different check, not the same one reused.** Across every non-Cancelled note, total credit can never exceed the invoice's own grand total: crediting more than you billed isn't a correction, it's a payment, and a payment is a different document. Live scan, never stored, so cancelling frees value back up with nothing to reconcile. Both guards round to paisa before comparing — floating-point tax math leaves remainders of ~1e-12 that would otherwise read as "still creditable" forever, and the same rounding was added to AR Aging's own outstanding figure for the identical reason.

   **GL posting on `issue()`: the exact reverse of `postTaxInvoice()`**, conditional third line included — Dr Sales Revenue (subtotal) + Dr Output Tax Payable (only when nonzero) / Cr Accounts Receivable (total). **NO new GL mapping roles were added** — all three already existed and already meant the right thing, checked in `gl-mapping-data.js` before assuming; the role count stays at eighteen. Deliberately NOT booked to a separate contra-revenue "Sales Returns" account: that would need a nineteenth role whose only purpose is presentation, and this project's Profit & Loss has no contra-revenue section to show it in. Named in the file header rather than left silent.

   **Terminal status is `Credited`** — checked against every terminal word already in use (Raised, Issued, Dispatched, Received, Returned, Posted, Logged, Finalized, Confirmed, Paid, Collected, Closed, Processed, Completed, Verified, Approved) and found free. `Issued` would have collided with Delivery Challan and `Raised` with Tax Invoice — the two collisions most likely to appear beside this document in a status history. Cancel is Draft-only: once Credited there's a real posted journal entry behind the note, and this project does not rewrite posted accounting history (Journal Entry's own stance). A mistake on an issued note is corrected the way accounting actually corrects one — reverse the entry, raise a fresh note — stated plainly in the file header and in the issue confirmation dialog.

   **AR AGING RETROFIT — the real reason this module matters beyond paperwork.** `ar-aging-data.js`'s `getOutstandingAmount()` now subtracts `getIssuedCreditForInvoice()` alongside the receipt it already subtracted, typeof-guarded the same way. Only `Credited` notes count; a Draft has promised the customer nothing. A fully-credited invoice now correctly disappears from the aging report entirely rather than aging forever.

   **Verified in a Node sandbox against the real shipped repositories — 41 assertions across 9 scenarios, all passing**: invoice baseline totals; the derived goods-return note (active lines only, price and tax recovered by line id, 3 × ₹100 + 18% = ₹354, lines non-editable); the value guard (draft reserves its own claim, self-exclusion when editing, over-credit rejected, exactly-remaining accepted, zero and negative rejected); return-exclusivity vs invoice-non-exclusivity in both picker pools; the issued journal entry (Posted, `source` tagged, three lines, **Dr 354 = Cr 354 exactly**, revenue and output tax both DEBITED, AR CREDITED); an untaxed note producing a clean balanced two-line entry; immutability of an issued note plus cancel freeing value back up; AR Aging outstanding dropping by exactly the credited amount on two separate invoices and the grand total matching; and a fully-credited invoice falling out of the creditable pool, the outstanding figure and the aging report together.

   RBAC: `["Purchase & Sales Manager", "Finance Executive"]` — Sales + FINANCE here, not Sales + Inventory as Sales Return has, because no goods move but a real journal entry posts. Sidebar link added to the Returns & Credit Notes group across all 97 pages. Retrofits Sales Return's own Detail modal with a genuine single "Credit Note" row (this module IS exclusive over a return) — the forward-looking, typeof-guarded `creditNoteRow()` Sales Return shipped with now resolves for real — and Tax Invoice's own Detail modal with an AGGREGATE row (count + credited + still-creditable), since it isn't exclusive over an invoice. `sales-return.html`, `tax-invoice.html` and `ar-aging.html` all now load `../data/credit-note-data.js`.

3a. ✅ **INVOICE VERIFICATION TAX-CAPTURE RETROFIT (prerequisite, done first).** Checked before assuming a real Debit Note could even be built: no line item ANYWHERE upstream in Procurement (PR → RFQ → Quotation → PO) carries a tax rate — the same absence `purchase-register-data.js`'s and `gl-mapping-data.js`'s own original headers had already named. Invoice Verification's own lines are the one place in this chain that is manually entered rather than copied, so they're the honest place to close the gap: each line now carries an optional `invoicedTaxId` — a REAL CAPTURED FACT, not Purchase Register's own estimate. `computeGrandTotal()` now returns `{subtotal, taxTotal, total, ...}`, matching Tax Invoice's and Credit Note's own convention; `subtotal` is exactly what `.total` used to mean (taxable value, still matching what a GRN posted to GR/IR Clearing), `total` is now genuinely tax-inclusive. **Every existing caller was checked and updated, not just the definition**: `postInvoiceVerification()` now splits Dr GR/IR Clearing (subtotal, unchanged) + Dr a NEW Input Tax Credit Receivable role (taxTotal, only when nonzero) / Cr Accounts Payable (the real total) — 18 GL roles became 19; `payment-request-data.js`'s own `computeDefaultAmount()` needed no code change at all and became more correct on its own (suggests the full tax-inclusive amount, not the taxable value alone); `purchase-register-data.js` now prefers this real captured tax over its own estimate whenever a line has one, flagging `taxIsEstimated` honestly per row instead of blanket-`true`. UI: an "Invoiced Tax" picker and a live taxable/tax/total preview were added to the Invoice Verification form and detail view. **19 assertions, all passing**, covering the richer totals shape, the split GL posting (subtotal to GR/IR, tax to ITC, full total to AP), an untaxed invoice needing no ITC role, a missing-role refusal naming the exact role, and the Payment Request default silently improving.

3b. ✅ **Purchase Return** — `data/purchase-return-data.js` + `pages/purchase-return.html/js`. The Procurement mirror of Sales Return. Built FROM ONE POSTED GRN, not the PO or the informal Goods Receipt — checked, not assumed: GRN is this project's own formal, price-bearing, numbered receiving record every downstream accounting module already references by name. Quantity-only, no pricing, mirroring Sales Return's own line shape exactly — the money side is Debit Note's job.

   **ITEM RESOLUTION NEEDED A GENUINE SEVENTH-HOP CHAIN-WALK** GRN's own lines don't carry — checked directly in `grn-data.js` and `pages/grn.js` before assuming otherwise: a GRN line stores `prLineItemId`/`quantity`/`unitPrice`, never `itemId`. `resolveChainForGrn()` walks GRN → Receipt → Schedule → PO → Quotation → RFQ → PR, one hop further than `pages/grn.js`'s own `resolveChain()` because this module starts one level higher than that page does. Resolved ONCE at return-creation time and frozen onto the line — "resolve once, freeze," the same discipline Payroll's own Salary Structure resolution already uses.

   **THE JOIN KEY IS `prLineItemId`, NOT `id`** — the Procurement chain's own stable line identifier since Phase 4, genuinely different from the Sales chain's own preserved `id`, and named as such rather than treated as an inconsistency. This is exactly the join key Debit Note (3c) needs and gets.

   **NOT exclusive over its parent GRN**, the same call Sales Return made over its invoice; what replaces it is the identical KIND of cumulative-QUANTITY guard Sales Return already established, scoped to the GRN's own line instead of an invoice's.

   **A GENUINE, DOCUMENTED DIVERGENCE FROM SALES RETURN: an available-stock check on `post()`.** Sales Return brings stock IN and never needed one. This module sends stock OUT, and by return time some of what a GRN brought in may already be consumed elsewhere. Reusing Material Issue's and Stock Transfer's own precedent, a line with insufficient stock is SKIPPED at post time rather than posted lopsided, with the skipped count reported back; the page's own confirmation dialog and result toast both say so plainly. "Purchase Return" was added to `stock-ledger-data.js`'s own vocabulary, posting `quantity: -Math.abs(qty)` and `unitCost: null` — the same outbound convention Delivery Issue/Transfer Out/Material Issue already use.

   Terminal status is `Returned` — the SAME word Sales Return uses, deliberately: two different repositories, two different storage keys, no shared activity feed to collide in, and it's honestly the same real-world action on both sides of a sale. RBAC: `["Purchase & Sales Manager", "Inventory Controller"]` — checked against GRN/PO/PR's own actual role assignments first, catching and fixing an initial mistake (reaching for "Procurement Officer," a role that exists in the vocabulary but was never assigned to a single page or seeded user anywhere in this project — that would have been a real access dead-end). Retrofits GRN's own Detail modal with an AGGREGATE "Purchase Returns" row, mirroring Sales Return's own retrofit into Tax Invoice. **24 assertions, all passing**, including the seven-hop chain-walk resolving real items, the quantity guard, the availability check actually skipping an insufficient-stock line and refusing a fully-skipped post rather than silently succeeding, immutability, and non-exclusivity.

3c. ✅ **Debit Note** — `data/debit-note-data.js` + `pages/debit-note.html/js`. The exact Procurement mirror of Credit Note — same two-parent shape (Goods Return from a posted Purchase Return / Price Adjustment from a Verified invoice directly), same single `computeLineTotal()` meeting point, same value guard shape. Genuinely different from Credit Note only where Procurement itself is genuinely different:

   **THE JOIN IS `prLineItemId`, not `id`** — Purchase Return's own line-id promise, now kept, for the same reason Sales Return's own `id`-based promise was kept by Credit Note one module earlier: two different chains, two different native join keys, each the real one for its own side.

   **REAL CAPTURED TAX FLOWS THROUGH FOR THE FIRST TIME** — the entire reason 3a happened first this phase. `buildLinesFromReturn()` recovers price AND, where captured, real tax from Invoice Verification's own `invoicedTaxId`, not an estimate.

   **ITEM RESOLUTION FOR THE PRICE ADJUSTMENT PATH NEEDED ITS OWN SHORT CHAIN-WALK** — Invoice Verification's lines don't carry `itemId` either, and the relevant chain from a PO (Quotation → RFQ → PR) is shorter than Purchase Return's own seven-hop GRN walk, so it's resolved directly in this file rather than forcing an unrelated repository's GRN-shaped entry point.

   GL posting on `issue()` reverses the COMBINED GRN + Invoice Verification pair, not either alone: Dr Accounts Payable (total) / Cr Inventory (subtotal, reverses GRN's own Dr) + Cr Input Tax Credit Receivable (tax, only when nonzero, reverses the ITC 3a made postable). **No new GL roles needed** — all three existed by the time this module was reached. Terminal status `Debited`, checked against every status word in use across BOTH sides of this project and found free. RBAC: `["Purchase & Sales Manager", "Finance Executive"]`, mirroring Credit Note's own Sales + Finance pairing. Retrofits Invoice Verification's own Detail modal with an AGGREGATE "Debit Notes" row and Purchase Return's own Detail modal with a genuine single "Debit Note" row (this module IS exclusive over a return) — the forward-looking `debitNoteRow()` Purchase Return shipped with now resolves for real. **33 assertions, all passing**, covering the `prLineItemId` join recovering real tax, the value guard, the PO-side item-resolution chain-walk, a balanced reversing journal entry (AP debited, Inventory and ITC both credited), an untaxed note needing no ITC role, and immutability.

**Phase 15 in total: 6 shipped pieces (Sales Return, Credit Note, the Invoice Verification tax retrofit, Purchase Return, Debit Note, plus every retrofit hook between them), 150 Node-sandbox assertions across 5 test files, all passing, `validate.py` clean at 190 JS / 100 HTML files.**

### Phase 16 — GST Compliance (COMPLETE, 4/4 modules): GSTR-1 ✅, GSTR-3B ✅, E-Invoice/IRN ✅, E-Way Bill ✅.

1. ✅ **GSTR-1** — `data/gstr1-data.js` + `pages/gstr1.html/js`. **The first module in this project shaped as an actual statutory return rather than an internal reconciliation.** GST Summary (Phase 8) already answers "what does our GST position look like" — but nobody files "GST Summary" with the government. This is the real outward-supply return, in the real return's own table shapes, with a real filing action.

   **READS SALES REGISTER AND CREDIT NOTE, WRITES NEITHER** — the same "genuine reuse forward" restraint GST Summary itself already showed. No new sales-side computation was added; existing line-grain rows are simply re-grouped into GSTR-1's own required shapes.

   **OUTWARD ONLY — NO DEBIT NOTES, AND THAT'S CORRECT, NOT AN OMISSION.** The Debit Note this project built in Phase 15 is issued BY this business TO a vendor — it belongs in the VENDOR'S OWN GSTR-1, not ours, and affects our own GSTR-3B as an ITC reversal, not this return. Named explicitly in the file header rather than left as a silent gap.

   **B2B vs B2C decided by whether the customer record carries a GSTIN** — the only real signal this project has. B2B rows are grouped (invoice, rate) — real Table 4 shape, since one invoice can carry more than one tax rate. B2C is grouped (place of supply, rate) with no invoice-wise detail — the real, CURRENT simplified Table 7 shape. NAMED SIMPLIFICATION: does not model the older B2C-Large invoice-wise threshold rule, phased out of standard filing for most taxpayers.

   **CREDIT NOTES REPORT IN THE PERIOD THEY WERE ISSUED, NOT THE PERIOD OF THE ORIGINAL SALE** — the real GST rule, and it falls out naturally: every note is filtered by its own `noteDate`, never the invoice's `invoiceDate`. Verified directly: a credit note against a February sale, issued in March, appears only in March's return, with the February return of that same invoice completely unaffected.

   **THE INTERSTATE SPLIT IS RE-COMPUTED INDEPENDENTLY**, not reused from Sales Register's own private `_resolveSplit()` — that function is private to its own file, so this file computes the identical logic via Tax Master's own PUBLIC split functions instead, the same restraint Purchase Register's own private helper already required of anyone outside it.

   **FILING IS A SEPARATE, MINIMAL FROZEN RECORD, NOT A SNAPSHOT OF EVERY ROW.** Every table is computed LIVE every time; `file()` adds one frozen totals record per (company, year, month) — proof of what was reported and when, the same "immutable once posted" instinct Journal Entry and every lifecycle document in this project already share. One filing per period, ever — refiling is refused. Named honestly: this project has no period-lock mechanism anywhere else either, so filing doesn't prevent a later transaction from landing in an already-filed month; a real business would correct that on next period's return, the way real GST law works, and this file makes no attempt to reconcile it automatically.

   Period is `(year, month)` numbers, not a "YYYY-MM" string — checked and matched to Payroll's and Depreciation Run's own existing convention for exactly this shape of period, including reusing Payroll's own `MONTH_NAMES` + year-select population logic on the page itself rather than inventing a new picker.

   **Two real bugs were caught and fixed before shipping, not glossed over:** a test-harness mistake (a fake repository stub silently failed to override an already-loaded real file's own lexical binding inside the Node sandbox — fixed by building real fixtures through the actual repository's own `create()` API instead of hand-rolled objects) and a genuine shipped-code typo (`pages/gstr1.js`'s CSV export was missing one closing parenthesis on its B2B row line — found by systematic bisection down to the exact character, not guessed at, and confirmed fixed via `node --check`).

   RBAC: `["Finance Executive"]`, matching GST Summary's own. Sidebar link added next to GST Summary in the Reporting group across all 100 pages. **31 assertions, all passing**, covering intra/inter-state GST splits, B2B/B2C classification by GSTIN presence, period boundaries (a March invoice never leaking into February), credit notes landing in their own issue-period rather than the sale's, gross-vs-net totals including a genuine net-negative period, HSN netting against credit notes, and the file-once lifecycle.

2. ✅ **GSTR-3B** — `data/gstr3b-data.js` + `pages/gstr3b.html/js`. The monthly summary return: 3.1 output tax liability, 4(A)/4(B)/4(C) input tax credit (gross, reversed, net), 6.1 net tax payable — following the real return's own section numbers directly.

   **OUTPUT SIDE REUSES GSTR-1's OWN NUMBER, WITH A GENUINE FILED-VS-LIVE DISTINCTION NOT NEEDED ANYWHERE ELSE IN THIS PROJECT.** If a GSTR-1 filing already exists for the period, this file uses THAT FROZEN RECORD, not a live recompute — verified directly: a late invoice added AFTER GSTR-1 was filed does NOT change GSTR-3B's own output figure, even though it WOULD change GSTR-1's own live totals if that filing didn't exist yet. If no GSTR-1 filing exists, this file falls back to GSTR-1's own live `computeTotals()` and says so plainly on the page — `outputSource` is `"filed"` or `"live"` on every summary object, surfaced as a warning banner rather than presented as settled.

   **INPUT SIDE REUSES PURCHASE REGISTER'S OWN ROWS DIRECTLY**, adding one honest figure Purchase Register's own per-row flag didn't yet surface in aggregate: `pctEstimated` — the share of THIS PERIOD's own input tax that rests on an estimate rather than a captured fact. This is the same honesty Phase 15's Invoice Verification retrofit made possible; this module is the first to turn it into a percentage a filer actually sees before filing.

   **ITC TREATED AS FULLY ELIGIBLE — A NAMED SIMPLIFICATION INHERITED FROM GST SUMMARY, NOT RE-LITIGATED.** GST Summary's own header (Phase 8) already states this simulator has no concept of ITC eligibility rules (blocked credits, reverse charge, capital goods restrictions). This file inherits that exact stance rather than re-solving a problem an earlier module already named honestly.

   **DEBIT NOTES REVERSE ITC, AND NEEDED THE SAME INDEPENDENTLY-RECOMPUTED SPLIT GSTR-1's OWN HSN NETTING ALREADY SOLVED FOR CREDIT NOTES.** Debit Note's own `computeGrandTotal()` returns only a flat `taxTotal` — checked directly before assuming otherwise, because that module was never asked to file a return either. This file recomputes the CGST/SGST/IGST split per debit line independently via Tax Master's own PUBLIC split functions, using the note's own `vendorId` (already stored directly, no chain-walk needed) against the company's home state.

   **NO CARRY-FORWARD BETWEEN PERIODS — A NAMED, DELIBERATE LIMITATION**, not an oversight. A real electronic credit ledger lets excess ITC from one period reduce a LATER period's cash payment; this project has no running ledger anywhere (Depreciation Run doesn't carry forward a WDV error beyond its own book-value field; GST Summary doesn't either), so each period's `netTaxPayable` here stands entirely on its own transactions. Verified directly: a period with unusually large ITC produces a genuine negative `netTaxPayable` — shown as a real "net credit available" figure, never floored at zero or hidden — and that excess is never read by any other period's own calculation.

   Filing mirrors GSTR-1's own shape exactly: one frozen record per (company, year, month), refused a second time, computed at file-time and never silently recomputed after.

   **Three genuine test-harness bugs were caught and fixed while verifying this module, none glossed over:** a missing `invoiceDate` on synthetic Invoice Verification fixtures (Purchase Register's own date filter silently excluded every row until this was set); a direct-object-mutation mistake identical in kind to dn-test.js's own earlier one (`item1.hsnCodeId = ...` doesn't persist — `findById()` always re-reads fresh JSON from storage — fixed via the repository's own real `update()` call); and a missing `noteDate` on a synthetic Debit Note (defaulted to the sandbox's own real current date, landing outside the test period's filter window entirely).

   RBAC: `["Finance Executive"]`, matching GSTR-1 and GST Summary. Sidebar link added next to GSTR-1 in the Reporting group across all 101 pages. **28 assertions, all passing**, covering the filed-vs-live output distinction (including the late-invoice-after-filing case), gross ITC with both real-captured and estimated tax lines mixed in the same period, the independently-recomputed Debit Note split at both intra- and inter-state, net ITC and net payable arithmetic, a genuine net-negative period, and the file-once lifecycle.

**Phase 16 progress: 2/4 modules shipped (GSTR-1, GSTR-3B), 59 Node-sandbox assertions across 2 test files for this phase alone (228 total across all of Phase 15 + 16), all passing, `validate.py` clean at 194 JS / 102 HTML files.**

3. ✅ **E-Invoice / IRN** — `data/e-invoice-data.js` + `pages/e-invoice.html/js`. Per-invoice, not a return: takes ONE Raised, B2B Tax Invoice and produces an Invoice Reference Number (IRN) and QR payload — the two artifacts that make an invoice legally valid under the real mandate. **Not a document with a "+ New" flow** — the page's own list of eligible invoices IS the action surface, Generate/View per row, the first module in this project shaped that way.

   **THE THRESHOLD WAS CHECKED LIVE, NOT ASSUMED FROM TRAINING DATA** — exactly the caution this file's own header names: a web search confirmed the mandatory e-invoicing threshold is ₹5 crore aggregate annual turnover (CBIC Notification 10/2023, effective 1 August 2023, unchanged as of mid-2026 sources), and that a SEPARATE ₹10 crore threshold (effective 1 April 2025) triggers a 30-day reporting window. Both figures are real, current, and were verified rather than pulled from memory before being hard-coded into a training simulator meant to teach the actual rule.

   **APPLICABILITY IS COMPUTED FROM THIS COMPANY'S OWN DATA, PERMANENTLY, NOT A MANUAL TOGGLE** — `isApplicable()` walks every Financial Year this company has on record, sums Raised Tax Invoice totals within each one, and reports the FIRST year that crossed ₹5 crore — matching the real "crossed once, applies forever" rule exactly, including a year where turnover later falls back below the line. Reports not just a boolean but WHICH year and what turnover triggered it, the same "show the reasoning" instinct GST Summary's own header already insists on. The identical machinery, at a second threshold, drives the ₹10 crore fast-reporting check.

   **B2B ONLY — THE SAME GSTIN-PRESENCE TEST GSTR-1 ALREADY ESTABLISHED.** This project has no export/SEZ concept anywhere yet, so this module's own eligibility check is honestly narrower than the full real rule (B2B alone, not B2B+export+SEZ) — named in the file header rather than presented as complete.

   **THE IRN IS A STRUCTURAL SIMULATION, NOT A REAL SHA-256 HASH** — the identical honesty `gst-data.js`'s own header already applies to GSTIN validation. Same canonical-string inputs (supplier GSTIN + doc type + doc number + financial year) and same 64-hex-character, fully deterministic output shape as the real algorithm, produced via a simple synchronous hash rather than the Web Crypto API's async SHA-256 — a deliberate choice, named directly: introducing this project's first `async`/Promise code path for one module would be a bigger, riskier change than the realism it would buy, in a 100+ page codebase that has never needed one anywhere else. Verified directly: the same invoice always reproduces the identical IRN from its own canonical string.

   **THE QR PAYLOAD IS SHOWN AS TEXT, NOT A FAKE SCANNABLE IMAGE** — this project loads zero external libraries anywhere (every `<script src>` in all 100+ pages points at a local file); hand-rolling a real QR bitmap generator would be a first for this codebase, and faking one would be less honest than showing the real payload string plainly.

   **THE 24-HOUR CANCELLATION WINDOW IS REAL AND CHECKED AGAINST ACTUAL ELAPSED CLOCK TIME** — verified directly with both a fresh record (cancellable) and a synthetic 25-hour-old one (correctly refused, naming Credit Note as the real-world correct instrument past that window, since this project already built one in Phase 15).

   **THE 30-DAY REPORTING RULE IS A VISIBLE FLAG, NOT A BLOCK** — deliberately, because a training simulator that hard-refuses a late demo invoice teaches less than one that shows exactly what a real ₹10-crore-plus business would now be exposed to. `isLate`/`daysSinceInvoice` are computed and shown, generation still succeeds.

   **GENERATING OR CANCELLING AN E-INVOICE NEVER TOUCHES TAX INVOICE'S OWN STATUS** — a named, deliberate boundary against a cross-module cancellation cascade this codebase has never built anywhere else.

   RBAC: `["Purchase & Sales Manager", "Finance Executive"]` — Sales + Finance, since the person who raises an invoice is typically the one generating its IRN day to day, with Finance needing it for compliance oversight. Sidebar link added next to GSTR-3B in the Reporting group across all 102 pages. Retrofits Tax Invoice's own Detail modal with a genuine SINGLE-link row (this module IS exclusive over an invoice, unlike Sales Return/Credit Note's own aggregate rows) — `tax-invoice.html` now also loads `financial-year-data.js` and `e-invoice-data.js`.

   **27 assertions, all passing**, including: inapplicability below ₹5cr and the exact FY/turnover figure once crossed; B2C invoices always ineligible even when the company itself is in scope; IRN format and full determinism (recomputing from the same canonical string reproduces the identical 64-hex-character string); exclusivity (a second generation attempt on the same invoice refused); the 24-hour window enforced both ways (cancellable when fresh, refused — naming Credit Note — once past 25 simulated hours); the ₹10cr fast-reporting flag activating only once that separate threshold is crossed, with a genuinely overdue invoice correctly flagged late and a same-day one correctly not.

   **Two genuine test-harness mistakes were made and corrected while writing this suite's own Scenario 8, both left as comments rather than erased** — an attempt to backdate a fixture invoice to make it "more late" twice accidentally pushed its date outside the very financial year the ₹10cr crossing depended on, silently un-counting it from that year's own turnover and undoing the crossing the scenario was testing. The invoice's own original date already satisfied every condition needed; no backdating was ever necessary, and the mistake — plus why it happened — is preserved in the test file itself as a warning against repeating it.

**Phase 16 progress: 3/4 modules shipped (GSTR-1, GSTR-3B, E-Invoice/IRN), 86 Node-sandbox assertions across 3 test files for this phase alone (255 total across all of Phase 15 + 16), all passing, `validate.py` clean at 196 JS / 103 HTML files.**

4. ✅ **E-Way Bill** — `data/e-way-bill-data.js` + `pages/e-way-bill.html/js`. Per-shipment, the last module of this phase: takes ONE Dispatched Dispatch record and produces an E-Way Bill Number (EBN) that legally has to accompany the goods while they physically move.

   **BUILT FROM DISPATCH, NOT DELIVERY CHALLAN OR TAX INVOICE DIRECTLY** — confirmed by the real rule itself (triggered by the MOVEMENT of goods, not by billing) and, genuinely convenient rather than engineered around, Dispatch already carries every Part-B field this module needs (`transporterName`, `vehicleNumber`, `modeOfTransport`, `dispatchDate`) because it was built with exactly that logistics-event job one phase before this one existed. Nothing new had to be added to Dispatch itself.

   **THE THRESHOLD WAS CHECKED LIVE, THE SAME DISCIPLINE E-INVOICE'S OWN HEADER ALREADY APPLIED.** A web search confirmed ₹50,000 consignment value, uniform for both inter-state and intra-state movement as the national baseline under CGST Rule 138 — not assumed from memory. **ONLY THE UNIFORM NATIONAL BASELINE IS MODELED, A NAMED GAP**: real intra-state thresholds vary by state (up to ₹2,00,000 in some, intra-city exempt in Gujarat, intra-state exempt entirely in J&K) — this project has no state-by-state threshold master and none of its other GST modules have needed one either, so the uniform figure applies to every movement alike, named rather than silently presented as complete.

   **THE 180-DAY DOCUMENT-AGE RULE IS A HARD BLOCK, UNLIKE E-INVOICE'S OWN 30-DAY SOFT FLAG — A DELIBERATE DIFFERENCE, NOT AN INCONSISTENCY.** Checked directly: the real e-way bill portal refuses generation outright past 180 days, where e-invoicing's own late-reporting rule still lets generation proceed with a flag. Two different real enforcement postures, modeled as two different UX postures on purpose. Verified directly: a 2020-dated invoice is refused by both `isEligible()` and `generate()` itself, not just flagged.

   **VALIDITY IS DISTANCE-DRIVEN, TYPED BY THE TRAINEE** — this project has no distance/route data anywhere, so `generate()` takes `distanceKm` directly rather than inventing a source. One day of validity per 200 km (the CURRENT rule, checked live rather than risking an older "100 km per day" figure that still circulates), rounded up, one-day minimum — verified at both a 250 km (2-day) and a 50 km (1-day-minimum-honored) shipment. Over-dimensional cargo's own different rate (1 day per 20 km) is a named, un-modeled exclusion — this project has no cargo-dimension concept to key it off.

   **THE EBN ITSELF IS A STRUCTURAL SIMULATION, THE SAME HONESTY E-INVOICE'S OWN IRN ALREADY ESTABLISHED** — 12 numeric digits (a real EBN's own shape), fully deterministic from the dispatch's own facts, via the identical simple synchronous hash approach, INDEPENDENTLY implemented here rather than shared with `e-invoice-data.js` — the same "each module owns its own structural simulation" restraint `_resolveSplit()` already follows independently in both `gstr1-data.js` and `gstr3b-data.js`. Verified directly: recomputing from the same canonical string reproduces the identical EBN.

   **24-HOUR CANCELLATION MIRRORS E-INVOICE'S OWN EXACT SHAPE AND REASONING** — verified both ways (a fresh record cancellable, a synthetic 25-hour-old one correctly refused). **NO VALIDITY EXTENSION** — a named, deliberate exclusion; this project has no live transit-tracking concept to hang that real workflow off of, so `isExpired()` simply reports whether `validUntil` has passed rather than offering to push it out.

   RBAC: `["Purchase & Sales Manager"]` — checked directly against Dispatch's and GRN's own real RBAC entries before writing this, catching and fixing a mistake in an EARLIER DRAFT of this same line, which had reached for an invented "Sales + Inventory" pairing before verification showed Dispatch and GRN both actually use "Purchase & Sales Manager" alone. Sidebar link added next to E-Invoice/IRN in the Reporting group across all 103 pages. Retrofits Dispatch's own Detail modal with a genuine SINGLE-link row (this module IS exclusive over a dispatch, the same shape E-Invoice's own retrofit into Tax Invoice used one module earlier) — `dispatch.html` now also loads `e-way-bill-data.js`.

   **27 assertions, all passing**, covering below/above threshold eligibility, intra- vs inter-state classification, EBN format and full determinism, exclusivity, the 180-day hard block (both `isEligible()` and `generate()` refusing alike), a missing/zero distance refusal, the 24-hour cancellation window enforced both ways, expiry detection, and the list helper's own row shape.

   **A second RBAC mistake caught in this same module, on top of the one already named above**: while drafting the justifying comment for the RBAC line, an early version invented a plausible-sounding "matches GRN/Dispatch's own Inventory Controller pairing" justification before that claim was actually checked against the real file — it was wrong on both counts (neither module uses Inventory Controller at all). Caught and corrected before shipping, and left as a reminder in the file's own comment: a plausible-sounding precedent is not a verified one.

**Phase 16 complete: 4/4 modules shipped (GSTR-1, GSTR-3B, E-Invoice/IRN, E-Way Bill), 113 Node-sandbox assertions across 4 test files for this phase alone (282 total across all of Phase 15 + 16), all passing, `validate.py` clean at 198 JS / 104 HTML files.**

### Phase 18 (was 15) — Project Accounting (IN PROGRESS, 2/4 modules): Project Master ✅, Time Tracking ✅, Milestone Billing ⏳, Project Profitability ⏳.

1. ✅ **Project Master** — `data/project-data.js` + `pages/project.html/js`. The foundation everything else in this phase is built on. New sidebar group ("Project Accounting") added after CRM across all 104 pages — the first new top-level group since Phase 15's own "Returns & Credit Notes."

   **PROJECT IS A PARALLEL DIMENSION TO COST CENTER, NOT A ROLLUP INTO IT** — the deliberate decision this roadmap entry itself asked for, reasoned rather than left implicit. Checked directly in `cost-center-data.js` before deciding: a Cost Center is a permanent organizational unit with no client, no start/end date, no billing concept — and its own `actualSpend` is a MANUALLY MAINTAINED figure today, confirmed by search to appear in no Journal Entry or GL Posting code anywhere in this project. A Project is the opposite shape: temporary, bounded, with a real profitability question a Cost Center was never built to answer. `costCenterId` is an OPTIONAL field on a Project instead — the same "store the id, look it up live" pattern Cost Center itself already uses for its own Department/Branch links — independent but interoperable, a genuine third answer built from checking what each master actually is rather than picking one of the roadmap's own two offered options by default.

   **INTERNAL VS. CLIENT PROJECTS — `customerId` IS OPTIONAL, NEVER DEFAULTED.** `isClientProject()` is the single derived predicate the rest of this phase (Milestone Billing especially) will key off.

   **A RICHER, GENUINELY GUARDED LIFECYCLE THAN MOST MASTERS IN THIS PROJECT** — unlike Cost Center's own free-form `setStatus()` (checked directly: any status to any status, no guard at all), a Project's own transitions are validated: `Planning -> Active`, `Active <-> On Hold` (genuinely bidirectional, unlike Support Ticket's own strictly linear progression, checked as a precedent before diverging from it on purpose), either `-> Completed`, and `Cancelled` reachable from any non-terminal state. `Completed` and `Cancelled` are BOTH terminal — verified directly: attempting to reopen either is refused, with a reason naming the specific blocked transition. `getValidNextStatuses()` is the single source of truth the page's own status buttons are built from, so the UI can never offer a transition the repository would refuse.

   **BUDGET IS A PROJECT TOTAL, NOT AN ANNUAL FIGURE** — named deliberately differently from Cost Center's own `annualBudget`. `actualCost` starts and stays at zero from this module alone; `getVariance()`/`getUtilizationBand()` are written now, against whatever `actualCost` holds, so Time Tracking (Module 02) has a stable function to feed rather than needing its own parallel computation later.

   RBAC: `["Purchase & Sales Manager", "Finance Executive"]`, mirroring Sales Return/Credit Note's own dual-ownership reasoning (commercial relationship + budget oversight).

   **41 assertions, all passing**, covering internal-vs-client classification, every guarded transition including the genuinely bidirectional Active⇄On Hold pair, both terminal states refusing to reopen with a specific named reason, editability and deletability correctly following status (only a fresh Planning project is deletable; a status field passed to `update()` is silently ignored, changeable only through `setStatus()`), budget variance and utilization banding including the zero-budget-but-spending edge case, and duplicate-name detection.

   **A genuine test-authoring mistake was made and caught while writing this module's own suite, not glossed over**: two assertions in Scenario 4 and 6 asserted facts about a fixture project ("p2 is Active," "p2 is in the active pool") that the test itself had never actually transitioned out of Planning — the repository was correct throughout; the test was checking the wrong state. Fixed by actually performing the transition the narrative assumed, with a comment left in the test file explaining the mistake for the next person reading it.

2. ✅ **Time Tracking** — `data/time-tracking-data.js` + `pages/time-tracking.html/js`. Checked both `attendance-data.js`'s and `leave-data.js`'s own headers first, the roadmap's own instruction — borrows one real idea from each, diverges from each where the real process genuinely differs, named at every point.

   **NOT AN (employeeId, date) UPSERT LIKE ATTENDANCE** — checked directly before assuming the precedent transferred whole. A person doing real project work logs SEVERAL entries on the same day (different projects, different tasks); this file is a genuine multi-row-per-day log, verified directly: the same employee can hold two entries on the same date as two independent records, neither overwriting the other.

   **A DRAFT PHASE LEAVE APPLICATION DELIBERATELY DOESN'T HAVE** — checked against that file's own header (a leave request is submitted complete in one sitting; a time entry is filled in progressively through a day, genuinely benefiting from save-without-submitting). `Draft -> Submitted -> Approved / Rejected`, `Cancelled` from `Draft` or `Submitted`.

   **REJECTED IS NOT TERMINAL HERE — A NAMED DIVERGENCE FROM LEAVE APPLICATION'S OWN REJECTED**, not an inconsistency: a denied leave request was refused on its actual merits (nothing to withdraw); a rejected time entry is, in real practice, overwhelmingly a data-quality correction ("wrong project code"). `resubmitForCorrection()` loops `Rejected -> Draft`, verified directly, including that the approver clears on the way back and the entry becomes editable again.

   **THE APPROVER IS FROZEN AT SUBMIT, NOT AT CREATE** — the same "resolve once, freeze" instinct Leave Application's own `approverEmployeeId` uses, timed to the moment that actually matters (a Draft isn't awaiting anyone's decision yet). Resolved from the employee's CURRENT `managerId` at that moment. A missing manager is a display gap, not a functional block — verified directly: an employee with no manager on file still submits successfully, showing "No manager on file" rather than refusing.

   **THE HOURLY COST RATE IS DERIVED FROM SALARY STRUCTURE, NOT A NEW FIELD INVENTED FOR THIS MODULE** — checked directly that Employee Master carries no rate field of its own. `getHourlyCostRate()` calls the SAME `getEffectiveStructure()` Payroll itself calls, for whichever structure was actually in effect ON THE ENTRY'S OWN WORK DATE (not today, not frozen at creation), divided by a named constant, `STANDARD_MONTHLY_HOURS` (208 = 8h × 26 days, named as a convention, not a precise measurement). Verified directly: a mid-year raise correctly changes the rate an entry resolves to depending on which side of the raise its own work date falls, and an employee with NO salary structure at all resolves to `null` — never silently `0`.

   **PROJECT'S OWN `actualCost` FIELD IS DELIBERATELY LEFT UNWRITTEN — THE DECISION PROJECT MASTER'S OWN HEADER FLAGGED AS OPEN, NOW MADE.** `getActualCostForProject()` is a LIVE-COMPUTED READ, the same "compute at report time, don't cache a figure that can drift" instinct GSTR-1/GSTR-3B already chose. Verified directly: after approving entries, `Project.actualCost` still reads exactly `0` — nothing in this file ever writes to it. Project's own Detail modal is retrofitted with a "Logged Labor (Approved)" row reading this live function directly, honestly noting when some of its own hours have no resolvable cost rate (`pctHoursWithoutRate`), the same "flag what's missing rather than pretend zero" honesty Purchase Register's own `taxIsEstimated` and GSTR-3B's own `pctEstimated` already established.

   Only Approved entries ever count toward the rollup — verified directly: a Draft, a Submitted, and a corrected-back-to-Draft entry are all excluded, only the genuinely Approved one contributes hours and cost.

   RBAC: `["HR Manager"]` — checked directly against Attendance's and Leave Application's own real RBAC entries (both `"HR Manager"` alone) before reusing it, rather than assuming.

   **47 assertions, all passing**, covering the derived cost rate at two different salary-structure effective dates, an employee with no structure at all, multi-entry-per-day, the full Draft→Submit→Approve and Draft→Submit→Reject→resubmit→Draft loops, validation (missing fields, zero hours, hours over 24), status-gated editability/cancellability/deletability, the live rollup counting only Approved entries and being honest about missing cost rates, and Project's own `actualCost` staying untouched throughout.

   **A genuine arithmetic mistake was made and caught while writing this module's own test suite, left as a corrected comment rather than silently fixed**: an assertion expected a post-raise gross salary of ₹57,000 by mentally reusing the OLD structure's own HRA figure instead of recalculating HRA against the NEW basic — the real figure is ₹61,000 (₹40,000 basic + ₹16,000 HRA + ₹5,000 special). The test's own failure caught it; the repository's `getHourlyCostRate()` was correct throughout.

3. ⏳ **Milestone Billing — NEXT UP.** A real trigger into Tax Invoice, not a parallel invoicing path (per this roadmap entry's own original instruction) — a milestone marked billable/complete calls Tax Invoice's own `create()` flow directly, the same "forward into a real downstream document" discipline every phase since 15 has followed (Sales Return → Credit Note, Purchase Return → Debit Note). Read `tax-invoice-data.js`'s own header for its real create signature before assuming one.

4. ⏳ **Project Profitability.** A report reusing Time Tracking's own data directly (`getActualCostForProject()`) plus whatever Milestone Billing (Module 03) contributes as revenue — the module where Project's own manually-entered `actualCost` (non-labor costs) and Time Tracking's own live labor cost actually get added together into one total-cost figure, named explicitly as the first place that combination happens.

### Phase 19 (was 16) — Advanced Payroll & Statutory Compliance (not yet built; retrofit + 2-3 modules). Closes the honesty gap Salary Structure's own header names on the way out (Professional Tax/TDS as flat, manually-estimated figures). Real Indian income-tax slab TDS computation — likely the most complex single computation in the whole project once built correctly, needing the same Node-sandbox verification every nontrivial computation here gets — plus thin statutory report exports (PF ECR format, Form 16-shaped summary) that reuse Payroll's own already-computed data rather than building new engines. Retrofits Salary Structure's own header once shipped, the same "gap named, now closed" treatment the Payroll GL Retrofit got.

### Phase 20 (was 17) — Multi-Currency & Multi-Company (not yet built; the largest, most architecturally invasive phase — do it last). Currency Master with effective-dated rate history (the same "resolve as-of-a-date" shape Salary Structure's revision history established), multi-currency transactions converted to home currency at posting (decide retrofit-vs-parallel-path for Tax Invoice/PO/GL Posting and justify it), realized/unrealized exchange gain-loss (genuinely complex, needs its own careful scoping the way TDS does), and multi-company — check directly whether `ERP_CompanyRepository` already supports more than one company per login before assuming a from-scratch data model is needed; the real gap may only be a Consolidated Financial Statements view.

**If time is limited across Phases 11-17, the roadmap's own suggested priority**: Phase 11 (RBAC) and Phase 16 (real TDS) most directly address "doesn't feel like a real ERP yet" rather than missing industry breadth; Phase 17 (Multi-Currency) is legitimate to save for last or skip, the same honest reasoning that kept Manufacturing optional in the original brief.

## 4. Folder structure

```
ERP Simulator/
  index.html            Login (pre-auth, no sidebar/topbar shell)
  CONTINUE_HERE.md       This file.
  tools/                 validate.py + update_sidebar.py — see Section 11.
  style.css             ONE shared stylesheet. Notable additions beyond
                         Phase 3's baseline: `.status-badge--neutral` (a
                         5th tone for workflow Draft/Cancelled states);
                         `.sidebar-group.is-expanded .sidebar-group__items`
                         max-height bumped 640px→1100px (20-item
                         Procurement group); `.checkbox-list` (bordered
                         scrollable multi-select checkbox container, first
                         used by RFQ Creation's invited-vendors picker).
                         `.kpi-card__icon` only has 4 color modifiers
                         (--accent/--success/--warning/--danger) — NO
                         --info, unlike `.status-badge`. Check before use.
  script.js              ONE shared runtime. Two fixes/additions this
                         project: the Escape-key handler used to close the
                         FIRST open `.modal-overlay` in DOM order; now
                         closes the LAST (topmost) one, needed once
                         Purchase Requisition's Detail modal could have a
                         Line Item modal nested on top of it. And, once
                         Purchase Order became a 5th duplicate copy,
                         `actorLabel()` is now centralized here as
                         `window.ERP.actorLabel()` (the four earlier
                         modules keep their own local copies unchanged).
  data/
    (Phases 1-3 files unchanged: users.js, dashboard-data.js, help-data.js,
    company-data.js, financial-year-data.js, currency-data.js, gst-data.js,
    branch-data.js, department-data.js, cost-center-data.js,
    warehouse-data.js, company-settings-data.js, employee-data.js,
    vendor-data.js, customer-data.js, category-data.js, unit-data.js,
    item-data.js, tax-data.js, hsn-data.js, payment-terms-data.js,
    bank-data.js — see each file's own header for its design rationale)

    department-need-data.js  ERP_DepartmentNeedRepository — Phase 4 #1.
    pr-data.js                ERP_PurchaseRequisitionRepository — #2.
                              `approve()`/`reject()` exist but are only
                              ever called from PR Approval's page (#3),
                              never from Purchase Requisition's own.
    rfq-data.js                ERP_RfqRepository — #4. Also owns Vendor
                              Selection's (#5) `vendorDecisions`.
    quotation-data.js          ERP_QuotationRepository — #6. Also owns
                              Quotation Comparison's (#7) `isRecommended`.
    vendor-evaluation-data.js  ERP_VendorEvaluationRepository — #8.
    po-data.js                  ERP_PurchaseOrderRepository — #9. Built
                              FROM a Recommended quotation (`linkedQuotation
                              Id`, exclusive), `vendorId`/`deliveryWarehouse
                              Id`/`paymentTermsId` its own fields. 8-state
                              lifecycle. `approve()`/`reject()` only ever
                              called from PO Approval's page (#10);
                              `sendToVendor()` IS wired from this module's
                              own page; `confirm()`/`declineByVendor()`
                              only ever called from Vendor Confirmation's
                              page (#11). RETROFITTED once #11 shipped:
                              `confirm()` gained a third `vendorConfirmed
                              DeliveryDate` argument.
    delivery-schedule-data.js   ERP_DeliveryScheduleRepository — #12. Built
                              FROM a Confirmed PO (`linkedPoId`, exclusive),
                              `scheduleLines[]` one row per PO line. Simple
                              3-state lifecycle (`Draft/Finalized/Cancelled`),
                              no approval gate.
    goods-receipt-data.js       ERP_GoodsReceiptRepository — #13. Built
                              FROM a Finalized schedule (`linkedScheduleId`,
                              exclusive), `receiptLines[]` one row per
                              schedule line. Same simple 3-state shape,
                              named `Draft/Logged/Cancelled`.
    grn-data.js                   ERP_GrnRepository — #14. Built FROM a
                              Logged receipt (`linkedReceiptId`, exclusive),
                              `grnLines[]` quantity from the receipt +
                              PRICE FROM THE PO (skips two hops). Lines not
                              independently editable. `Draft/Posted/Cancelled`.
    quality-inspection-data.js    ERP_QualityInspectionRepository — #15.
                              Built FROM a Posted GRN (`linkedGrnId`,
                              exclusive), `inspectionLines[]` splits
                              acceptedQuantity/rejectedQuantity + a per-line
                              reason. Numbers do NOT feed Three-Way
                              Matching (documented, deliberate scoping).
                              `Draft/Completed/Cancelled`.
    invoice-verification-data.js  ERP_InvoiceVerificationRepository — #16.
                              Built FROM a PO DIRECTLY (not the receiving
                              chain), `invoiceLines[]` manually entered, NOT
                              pre-filled — the one line array this session
                              that doesn't copy from its parent. Lightweight
                              `computeMatchSummary()` (informational, not
                              Module 17's decision). At most one invoice per
                              PO (documented simplification). `Draft/
                              Verified/Cancelled`.
    three-way-matching-data.js    ERP_ThreeWayMatchingRepository — #17.
                              Built FROM one Invoice Verification;
                              `resolveChain()` walks invoice->PO->schedule
                              ->receipt->GRN LIVE, nothing stored but the
                              invoice link. `computeMatchLines()` is a pure,
                              unstored per-line comparison, recomputed every
                              read. Real decision gate: `Draft/Approved for
                              Payment/On Hold/Cancelled`.
    payment-request-data.js       ERP_PaymentRequestRepository — #18. Built
                              FROM an Approved-for-Payment match, header
                              only (no lines). `requestedAmount` defaults
                              from the invoice total but stays editable.
                              FULL approval gate WIRED ON THIS PAGE (no
                              separate approval module in the roadmap) —
                              `Draft/Submitted/Approved/Rejected/Cancelled`.
                              First Phase 4 use of Bank Master (pay-to
                              details via vendor's own `getEffectiveBank
                              Details()`).
    vendor-payment-data.js        ERP_VendorPaymentRepository — #19. Built
                              FROM an Approved payment request, header only.
                              `amountPaid` defaults but stays editable
                              (partial payments are normal). Simple 3-state
                              shape again: `Draft/Paid/Cancelled` — the
                              decision already happened one module up.
                              RETROFITTED (Phase 6, Bank Reconciliation
                              build): added `bankId` — Receipt got this
                              field when IT was built; this module simply
                              didn't, an inconsistency rather than a
                              choice, only caught once Bank Reconciliation
                              needed both sides symmetrically. Same picker
                              shape Receipt's own field already
                              established. Added `getPaidForCompany()` at
                              the same time, mirroring Receipt's own
                              `getReceivedForCompany()`.
    purchase-closure-data.js      ERP_PurchaseClosureRepository — #20, THE
                              FINAL MODULE. Built FROM the PO ITSELF (not
                              any downstream artifact). `computeCompletion
                              Checklist()` walks ALL EIGHT downstream
                              modules live, informational only, never gates
                              `close()`. Simplest lifecycle in the phase:
                              `Draft/Closed/Cancelled`, no reopen from
                              Closed.

    customer-inquiry-data.js      ERP_CustomerInquiryRepository — Phase 5
                              #1. NO approval gate (deliberate divergence
                              from Department Need — see its own header).
                              5-state PIPELINE shape: `New/In Progress/
                              Converted/Lost/Cancelled`. `.sources` (7-item
                              fixed vocabulary). `customerId` required
                              (Customer Master); `assignedToEmployeeId`
                              optional until `startFollowUp()`.
                              `getConvertibleForCompany()` is the FK-surface
                              hook Quotation (#2) is expected to read from.

    sales-quotation-data.js       ERP_SalesQuotationRepository — Phase 5
                              #2. Named "SalesQuotation"/`-SQ-`, NOT
                              "Quotation"/`-QT-` (Quotation Receipt, Phase
                              4 #6, already owns those identifiers — see
                              its own header for the full disambiguation).
                              Built FROM one Converted Customer Inquiry
                              (exclusivity, same shape as PR's need claim).
                              `lineItems[]` CRUD-added like PR's, but
                              `unitPrice` REQUIRED per line (a genuinely
                              new combination — see header).
                              `computeGrandTotal()` returns `{subtotal,
                              taxTotal, total, pricedCount, totalCount}` —
                              first document total to separate tax out.
                              Declined is terminal, NO reopen (mirrors
                              Vendor Confirmation's decline, not DN's
                              reject). `customerId` stored once at
                              creation (mirrors PO's `vendorId`).

    sales-order-data.js           ERP_SalesOrderRepository — Phase 5 #3.
                              Built FROM one Accepted Quotation
                              (exclusivity, one hop further). Reuses PR's
                              5-state Draft/Submitted/Approved/Rejected/
                              Cancelled shape (NOT PO's 8-state one) — a
                              deliberate, reasoned call: the customer
                              already committed by Accepting the
                              quotation, so what's missing is an INTERNAL
                              decision (Order Approval, #4), not a second
                              party's confirmation. `approve()`/`reject()`
                              built here, UNWIRED from this module's own
                              page — reserved for Order Approval, the 8th
                              "no data file of its own" instance (Section
                              7). `lineItems[]` is a FROZEN COPY from the
                              quotation (PO/Quotation Receipt's
                              whole-array shape), never CRUD — the
                              opposite call from Quotation's own module.
                              Credit check via Customer Master's own
                              pre-existing `getCreditUsage()`/
                              `getCreditUtilizationBand()` — a hook
                              Customer Master (Phase 3) was already built
                              anticipating, not a new field invented here.

    delivery-challan-data.js      ERP_DeliveryChallanRepository — Phase 5
                              #5. Built FROM one Approved Sales Order
                              (exclusivity). Mirrors Goods Receipt's own
                              3-state `Draft/X/Cancelled` shape from the
                              SHIPPING side — terminal status named
                              `Issued`, deliberately NOT `Dispatched`
                              (Module 7's own name, later). `challanLines[]`
                              is a copied-and-editable starting point like
                              Goods Receipt's `receivedQuantity` (here:
                              `orderedQuantity` frozen, `deliveredQuantity`
                              editable) — but carries NO price/tax at all,
                              on purpose (Tax Invoice, #6, owns billing)
                              and no logistics fields either (Dispatch,
                              #7, owns that). `hasShortfall()` — plain,
                              non-blocking derived flag.

    tax-invoice-data.js           ERP_TaxInvoiceRepository — Phase 5 #6.
                              Built FROM one Issued Delivery Challan
                              (exclusivity). `buildInvoiceLines()` is the
                              FIRST real two-hop JOIN in the codebase —
                              matches challan lines to sales-order lines
                              BY ID (preserved down the whole chain since
                              Quotation), combining shipped quantity with
                              agreed price/tax/item. Lines computed once
                              at `create()`, never recomputed — stricter
                              frozen than even Sales Order's own copy.
                              FIRST real use of HSN Master (Phase 3,
                              untouched until now). `dueDate` defaults
                              from `invoiceDate + customer.creditPeriodDays`
                              — another Phase 3 Customer Master field
                              discovered unused, not invented. Terminal
                              status `Raised` (not GRN's "Posted," not
                              Delivery Challan's own "Issued"). NO payment
                              tracking — deliberate scope line against
                              Payment Collection (#8)/Receipt (#9).

    dispatch-data.js              ERP_DispatchRepository — Phase 5 #7.
                              Built FROM one Raised Tax Invoice, NOT
                              Delivery Challan — the roadmap's own
                              ordering plus real GST transport practice
                              both point at the invoice (see its own
                              header). HEADER-ONLY, no line items — the
                              first Sales module to skip a line array
                              entirely. `.transportModes` (5-item fixed
                              vocabulary). `transporterName` free text
                              (no Transporter Master exists in Phase 3 —
                              documented simplification). `dispatchedBy
                              EmployeeId` reuses Employee Master, same
                              convention as Goods Receipt's "Received
                              By". Terminal status `Dispatched` — the
                              word Delivery Challan's own header
                              deliberately reserved rather than using
                              itself. Simple 3-state `Draft/Dispatched/
                              Cancelled`, no approval gate. Tax Invoice
                              is now a hub: this is the first of THREE
                              modules (Dispatch, Payment Collection,
                              Receipt) that independently build FROM it
                              rather than chaining through each other.
                              `getDispatchedForCompany()` is the
                              FK-surface hook Sales Close (#10) is
                              expected to read from.

    payment-collection-data.js    ERP_PaymentCollectionRepository —
                              Phase 5 #8. REJECTED Section 10's own
                              "mirrors Vendor Payment" prediction —
                              reuses Customer Inquiry's 5-state pipeline
                              shape instead (`Open/In Progress/Collected/
                              Written Off/Cancelled`), because AR
                              collection is multi-touch follow-up, not a
                              one-time authorization. NOT EXCLUSIVE over
                              its parent invoice — the first break from
                              the "one downstream record per upstream
                              one" shape since Delivery Schedule; reuses
                              Vendor Evaluation's own "no duplicate
                              check, multiple over time is normal"
                              resolution instead. `.collectionMethods`
                              (6-item fixed vocabulary). `promisedAmount`/
                              `promisedDate` are their own named fields,
                              not buried in notes. `assignedToEmployee
                              Id` reuses Employee Master with Customer
                              Inquiry's exact "required before follow-up
                              starts" gate. `getAllForInvoice()`/
                              `getLatestFollowUpForInvoice()` are the
                              retrofit hooks — an AGGREGATE (count +
                              latest status) into Tax Invoice's Detail
                              modal, not a single link, mirroring Vendor
                              Evaluation's own "Average Rating" retrofit
                              shape.

    receipt-data.js               ERP_ReceiptRepository — Phase 5 #9.
                              THE MIRROR HELD THIS TIME — confirms Vendor
                              Payment's own 3-state `Draft/Received/
                              Cancelled` shape (unlike Payment
                              Collection, one module ago), since money
                              landing in the bank is a single factual
                              event. Terminal status `Received`,
                              deliberately not `Collected` — a near-miss
                              naming collision with Payment Collection's
                              own terminal state, resolved on purpose.
                              Built FROM Tax Invoice directly (the third
                              of three independent hub branches), NOT
                              from Payment Collection. EXCLUSIVE again
                              (one receipt per invoice — a documented
                              simplification vs. real multi-installment
                              settlement, Invoice Verification's own
                              "one per parent" trade-off reused).
                              `amountReceived` defaults from `computeGrand
                              Total()`, stays editable. Bank Master used
                              in a REVERSED direction from Payment
                              Request/Vendor Payment — the COMPANY's own
                              account, CHOSEN via `getActiveForCompany()`/
                              `getDefault()`, not resolved through a
                              linked party. `.paymentMethods` is its own
                              5-item vocabulary (adds `UPI`, distinct
                              from Vendor Payment's 4-item outbound
                              list). `receivedByEmployeeId` reuses
                              Employee Master. `findReceiptForInvoice()`
                              is the retrofit hook — a genuine single
                              link into Tax Invoice's Detail modal, not
                              an aggregate.

    sales-close-data.js           ERP_SalesCloseRepository — Phase 5
                              #10, THE FINAL MODULE OF THE PROJECT. Built
                              from the Sales Order itself, exclusive.
                              Mirrors Purchase Closure's own OVERALL
                              SHAPE (simplest lifecycle, pure unstored
                              checklist, informational-only) but the WALK
                              MECHANISM diverges — linear only as far as
                              Tax Invoice, then BRANCHES three ways
                              (Dispatch/Payment Collection/Receipt all
                              read off the same invoice independently,
                              not off each other — the hub shape Dispatch
                              first named). `.checklistStages` (5, one
                              optional — Payment Collection, computed
                              from its own full result set via
                              `getAllForInvoice()` since it has no single
                              record to check, unlike every other stage).
                              `findClosureForSalesOrder()` is the retrofit
                              hook — the LAST one this project adds,
                              wired into Sales Order's own Detail modal.

    chart-of-accounts-data.js  ERP_ChartOfAccountsRepository — Phase 6
                              #1. Category Master's hierarchy machinery,
                              renamed for accounts — plus ONE genuine
                              addition Category Master never needed:
                              every account is a Group (header, can have
                              children, never posted to) or a Ledger
                              (postable, can carry an Opening Balance,
                              never has children). Account Type (5 fixed
                              values) drives `getNormalBalance()`/
                              `getStatement()` — every later Phase 6
                              module is expected to read these, not
                              re-derive them. Account codes are FLAT per
                              type block (Asset 1000s/Liability 2000s/
                              Equity 3000s/Income 4000s/Expense 5000s),
                              deliberately not depth-encoded. No starter
                              chart of accounts is auto-seeded — see
                              Section 3's own entry for why. RETROFITTED
                              once Journal Entry shipped: `remove()`/
                              `canToggleGroup()` now also refuse if the
                              account has posted journal entries against
                              it (typeof-guarded call into
                              ERP_JournalEntryRepository) — see that
                              file's own header for the full two-way-
                              dependency reasoning.

    journal-entry-data.js    ERP_JournalEntryRepository — Phase 6 #2, the
                              first module that actually posts to
                              anything. One shape holds both manual
                              entries and (once the retrofit pass lands)
                              every auto-posted one — a `source` field
                              distinguishes them, nothing sets a non-
                              "Manual" value yet. `computeTotals()`/
                              `isLineValid()`/`canPost()` are the checking
                              trio the page calls before enabling its own
                              Post button — `post()` re-checks regardless
                              (defense in depth, same as every other
                              lifecycle transition in this project).
                              LIFECYCLE IS A DELIBERATE DIVERGENCE from
                              this project's usual edit-until-approved
                              shape: once Posted, `update()`/`remove()`
                              both hard-refuse — permanent, matching real
                              accounting immutability — and the only undo
                              is `reverse()`, which creates a NEW already-
                              Posted entry with debit/credit swapped
                              rather than touching the original.
                              `hasPostedEntriesForAccount()` is the
                              retrofit hook Chart of Accounts' own header
                              asked "whoever builds Journal Entry next" to
                              add — done, and documented on both sides.

    general-ledger-data.js   ERP_GeneralLedgerRepository — Phase 6 #3.
                              FIRST data file in this project with NO
                              storage key of its own — nothing to create,
                              edit, or delete, purely a read-and-compute
                              layer over Chart of Accounts + Journal
                              Entry, recomputed fresh every call (same
                              no-caching reasoning dashboard-data.js
                              already settled on). Running balance is kept
                              as ONE signed number in "normal-balance
                              terms" internally (positive = same side as
                              `getNormalBalance()`, negative = contra),
                              converted to `{amount,side}` only at the
                              display boundary via
                              `signedBalanceToDisplay()`. Date-range
                              filtering still walks the FULL history up to
                              `fromDate` for a correct opening balance,
                              then only emits rows inside the range.
                              `getAccountSummary()` is what Trial Balance
                              is expected to call once per account rather
                              than re-deriving the same totals — the
                              scope line between the two reports (per-
                              account history here, company-wide snapshot
                              there) is drawn explicitly in this file's
                              own header. RETROFITTED once Trial Balance
                              shipped: `getAccountSummary()` now takes an
                              optional `opts` ({fromDate,toDate}) passed
                              straight through to `getLedgerForAccount()`
                              — small and backward-compatible, every
                              existing call site (this file's own
                              `getAllAccountSummaries()`, the General
                              Ledger page) still calls it with no third
                              argument and behaves identically to before.
                              BUG FIXED (found while building Balance
                              Sheet — full account in Section 3's own
                              entry): `getLedgerForAccount()`'s date-range
                              loop incremented `running` for every line
                              BEFORE checking whether it fell after
                              `toDate`, so `closingBalance` — not `rows`,
                              which was always correctly filtered —
                              silently included postings dated after the
                              cutoff whenever any existed. Reordered so
                              the `toDate` check happens first and skips
                              entirely, before `running` is touched.
                              Re-verified against every prior sandbox test
                              for this file plus a new regression test
                              built specifically for this scenario.

    trial-balance-data.js    ERP_TrialBalanceRepository — Phase 6 #4, the
                              first genuine (report) module rather than
                              just a read-only view. Even thinner than
                              general-ledger-data.js: doesn't re-derive
                              any balance math, calls that file's own
                              `getAccountSummary()` once per account (the
                              reuse its header called for). Does exactly
                              two things that are genuinely its own job:
                              reshapes {amount,side} into a Debit/Credit
                              two-column layout, and adds "as of [date]"
                              support — which needed a small, additive,
                              backward-compatible opts parameter added to
                              `getAccountSummary()` itself (see that
                              file's own updated header). Ordered in
                              standard financial-statement order using
                              Chart of Accounts' own existing type order,
                              no new ordering concept. The Difference
                              figure should always be exactly 0 — a
                              verified consequence of Journal Entry's
                              `canPost()` balance check, not a hope.

    profit-and-loss-data.js  ERP_ProfitAndLossRepository — Phase 6 #5.
                              The one real new idea: a PERIOD (From/To),
                              not a point in time — Income/Expense only
                              mean something relative to a range, since a
                              real system closes them to zero every
                              fiscal period (which this project doesn't
                              model), so this file NEVER reads an
                              account's Opening Balance, summing only
                              general-ledger-data.js's own period-bounded
                              `rows` (never `closingBalance`, which folds
                              opening balance in — exactly the field a
                              point-in-time report would want instead).
                              Single-stage (Income minus Expense, no
                              Gross/Operating Profit sub-stages) because
                              Chart of Accounts' 5 types have no COGS/
                              Operating sub-classification to build those
                              stages on honestly. Draws its own forward
                              line to Balance Sheet (not built yet):
                              `getProfitAndLoss().netProfit` is expected
                              to fold into that report's own Equity total.

    balance-sheet-data.js    ERP_BalanceSheetRepository — Phase 6 #6, the
                              culmination of the reporting chain so far —
                              first module to consume TWO earlier reports
                              at once (General Ledger's
                              `getAccountSummary()` for point-in-time
                              Asset/Liability/Equity balances, Profit &
                              Loss's `getProfitAndLoss()` for the profit
                              side). The hard problem this file solves:
                              summing only Asset/Liability/Equity balances
                              would never balance once anything had
                              posted, since Income/Expense activity moves
                              Assets without touching Equity directly (no
                              closing-entry mechanism exists to move it
                              there). Fix: compute what a closing entry
                              WOULD move, live — `currentEarnings =
                              getProfitAndLoss(companyId, undefined,
                              asOfDate).netProfit`, no fromDate (all-time,
                              not fiscal-year-scoped) — shown as its own
                              explicit Equity line, never silently merged
                              in. Deliberately does NOT reuse Trial
                              Balance's Dr/Cr column shape — a balance
                              sheet asks "how much do we own/owe/have
                              invested" (plain signed amounts), not
                              "which side of the ledger" (Trial Balance's
                              actual question). Verified with 5 sandbox
                              scenarios (investment/purchase/sale,
                              +liability+expense, mid-period snapshot,
                              zero-activity, contra/overdraft) — the
                              mid-period one caught a real, live bug in
                              general-ledger-data.js itself; see that
                              file's own Section 4 entry above.

    bank-reconciliation-data.js  ERP_BankReconciliationRepository — Phase
                              6 #7. First Phase 6 module reaching OUTSIDE
                              Chart of Accounts/Journal Entry entirely —
                              into Bank Master (Phase 3) and real Vendor
                              Payment/Receipt (Phases 4/5), because the
                              retrofit pass that would let it read
                              Journal Entry instead hasn't happened, and
                              Bank Master has no Chart-of-Accounts link.
                              Also the first genuine transactional module
                              (real storage, real lifecycle) in Phase 6
                              since Journal Entry itself — every report
                              before this owned no storage. Required a
                              retrofit to vendor-payment-data.js first
                              (see that file's own updated header) to add
                              `bankId`, matching Receipt's own field, for
                              symmetric AP/AR coverage. Reconciliation
                              math (Book Balance vs. Adjusted Bank
                              Balance) hand-traced before being coded,
                              then verified against those exact numbers
                              in 3 sandbox scenarios. Lifecycle mirrors
                              Journal Entry's Draft->Posted immutability
                              (Draft->Reconciled here, same "correction is
                              a new record, not a rewrite" principle) —
                              but deliberately does NOT block
                              `markReconciled()` when the balances don't
                              match, unlike Journal Entry's `canPost()`;
                              a trainee can close a period with a flagged,
                              unresolved difference rather than being
                              locked out of ever finishing it.

    ap-aging-data.js         ERP_APAgingRepository — Phase 6 #8. Built
                              from Payment Request (has `dueDate`,
                              nothing in Chart of Accounts/Journal Entry
                              does). `resolveVendor()` walks a genuine
                              4-hop chain (Payment Request -> Three-Way
                              Matching -> Invoice Verification -> PO ->
                              Vendor) since nothing along the way
                              denormalizes vendorId — one hop longer than
                              GRN's own established three-hop precedent,
                              same reasoning. `getOutstandingAmount()`
                              reads the same `findPaymentForRequest()`
                              hook Payment Request's own Detail modal
                              uses; honors partial payments (Vendor
                              Payment's own explicit support for them)
                              rather than treating them as an edge case.
                              Standard 5 aging buckets plus an honest 6th
                              ("No Due Date") — refuses to guess when
                              `dueDate` is genuinely unset rather than
                              defaulting to Current (understates risk) or
                              90+ (overstates it). Grouped by vendor,
                              sorted largest-owed-first; unresolved chain
                              walks surface as their own "Vendor Unknown"
                              group with a page-level count, not silently
                              dropped.

    ar-aging-data.js         ERP_ARAgingRepository — Phase 6 #9, the LAST
                              numbered module of the phase. Mirrors
                              ap-aging-data.js's own shape but genuinely
                              simpler — Tax Invoice already carries
                              customerId AND dueDate directly, zero
                              chain-walk hops needed where AP Aging needed
                              four. The one addition AP Aging had no
                              equivalent for: `isWrittenOff()` reads
                              Payment Collection's own already-established
                              `getLatestFollowUpForInvoice()` hook and
                              excludes a formally written-off invoice from
                              Total Outstanding entirely — Accounts
                              Payable has no concept of unilaterally
                              deciding a debt no longer exists; Accounts
                              Receivable does. The same hook also surfaces
                              last-follow-up date/method/status per
                              receivable in the page's own drill-down,
                              genuine AR-only context with no AP
                              equivalent.

    gl-mapping-data.js       ERP_GLMappingRepository — Phase 6 #10 (the
                              retrofit pass), the configuration backbone
                              everything else in the pass depends on.
                              6 roles, one mapping per company: Inventory,
                              GR/IR Clearing, Accounts Payable, Accounts
                              Receivable, Sales Revenue, Output Tax
                              Payable. Deliberately NOT 7 — no Input Tax
                              role, since Invoice Verification's own
                              `computeGrandTotal()` was checked directly
                              and confirmed to never separate a tax
                              component. `get()` always returns a full
                              object (every role key present, null where
                              unset) so callers never need a separate
                              "does a mapping exist" check.

    gl-posting-data.js       ERP_GlPostingRepository — Phase 6 #10, the
                              actual retrofit logic. One file, not five
                              edits to five already-shipped data files —
                              grn/invoice-verification/vendor-payment/
                              tax-invoice/receipt-data.js are all
                              untouched; each retrofitted PAGE calls one
                              typeof-guarded function here after its own
                              existing lifecycle method. Five functions,
                              each building one real, balanced Journal
                              Entry: `postGrnReceipt()` (Dr Inventory / Cr
                              GR-IR), `postInvoiceVerification()` (Dr
                              GR-IR / Cr Accounts Payable),
                              `postVendorPayment()` (Dr Accounts Payable /
                              Cr the payment's own linked bank account),
                              `postTaxInvoice()` (Dr Accounts Receivable /
                              Cr Sales Revenue / Cr Output Tax if any),
                              `postReceipt()` (Dr the receipt's own linked
                              bank account / Cr Accounts Receivable).
                              NEVER THROWS — every function returns
                              `{success, entry?, reason?}`, and a
                              half-configured GL Mapping or an unlinked
                              bank account is treated as a normal,
                              expected mid-setup state with a specific,
                              human-readable reason, not an error. Every
                              auto-posted entry is Posted immediately,
                              never left Draft — the one deliberate
                              divergence from Journal Entry's own default,
                              since an auto-posted entry represents a
                              business event that already fully happened,
                              nothing left to assemble. Verified with
                              individual tests per function (including
                              every failure mode) plus a full end-to-end
                              procure-to-pay-and-order-to-cash cycle run
                              against the actual shipped files — 5 real
                              postings, all individually balanced, grand
                              total debit matching grand total credit
                              exactly.

  pages/
    (Phases 1-3 pages unchanged — dashboard, profile, settings,
    notifications, activity-log, theme, help, create-company,
    company-profile, financial-year, currency, gst-details, branches,
    departments, cost-centers, warehouses, company-settings, employees,
    vendors [+ retrofit, see below], customers, categories, units, items
    [+ ?action=add retrofit], tax-master, hsn-master, payment-terms,
    bank-master)

    department-need.html/.js         Phase 4 #1. Detail modal retrofitted
                                     with a live "Linked to PR" row once
                                     #2 shipped (`ERP_PurchaseRequisition
                                     Repository.findPrForNeed()`).
    purchase-requisition.html/.js    #2. Detail modal retrofitted with a
                                     live "Linked to RFQ" row once #4
                                     shipped, and a "Next Step: see PR
                                     Approval" line once #3 shipped.
    pr-approval.html/.js             #3. No data file of its own.
    rfq-creation.html/.js            #4.
    vendor-selection.html/.js        #5. No data file of its own.
    quotation-receipt.html/.js       #6. Detail modal retrofitted TWICE:
                                     a "Recommended" badge once #7 shipped
                                     (same repository, zero new script tag
                                     needed), and a live "Linked to PO" row
                                     once #9 shipped (`ERP_PurchaseOrder
                                     Repository.findPoForQuotation()`, new
                                     `po-data.js` script tag added).
    quotation-comparison.html/.js    #7. No data file of its own.
    vendor-evaluation.html/.js       #8.
    purchase-order.html/.js          #9. Built from an available Recommended
                                     quotation picker (toast if none
                                     available). No line-item modal. Detail
                                     modal is the most-retrofitted page in
                                     the whole phase — SIX additions across
                                     Modules 11-20: a "Vendor's Promised
                                     Delivery" row (#11), a live "Linked to
                                     Delivery Schedule" row (#12), a live
                                     "Linked to Invoice Verification" row
                                     (#16), and a live "Linked to Purchase
                                     Closure" row (#20), each purely
                                     additive — never a rewrite.
    po-approval.html/.js             #10. No data file of its own.
    vendor-confirmation.html/.js     #11. No data file of its own (5th
                                     instance). Own Confirm modal (captures
                                     the vendor's promised date) instead of
                                     a bare confirm-dialog; Decline modal
                                     has no revise-and-resend action.
    delivery-schedule.html/.js       #12. Built from an available Confirmed
                                     PO picker. No line-item modal. Detail
                                     modal retrofitted once #13 shipped: a
                                     live "Linked to Goods Receipt" row.
    goods-receipt.html/.js           #13. Built from an available Finalized
                                     schedule picker. Received Qty defaults
                                     but is meant to be overwritten. Detail
                                     modal retrofitted once #14 shipped: a
                                     live "Linked to GRN" row.
    grn.html/.js                     #14. Built from an available Logged
                                     receipt picker. Line table is READ-ONLY
                                     display even in the create form (first
                                     time this session) — a GRN is a copy,
                                     not a place to type new numbers. Detail
                                     modal retrofitted once #15 shipped: a
                                     live "Linked to Quality Inspection" row.
    quality-inspection.html/.js      #15. Built from an available Posted GRN
                                     picker. Each line starts fully Accepted
                                     — an active default, not a neutral one.
    invoice-verification.html/.js    #16. Built from an available PO picker
                                     (any non-Draft/non-Cancelled status —
                                     deliberately not narrowed further).
                                     Detail modal retrofitted once #17
                                     shipped: a live "Linked to Three-Way
                                     Match" row.
    three-way-matching.html/.js      #17. Built from an available Verified
                                     invoice picker. NO line table in the
                                     create form at all — the comparison
                                     only ever renders in the Detail view,
                                     computed fresh via `computeMatchLines()`.
                                     Detail modal retrofitted once #18
                                     shipped: a live "Linked to Payment
                                     Request" row.
    payment-request.html/.js         #18. Built from an available Approved
                                     match picker. Mirrors department-
                                     need.js's full-lifecycle-on-one-page
                                     shape (Submit/Withdraw/Approve/Reject/
                                     Revise/Cancel/Delete all here). Detail
                                     modal retrofitted once #19 shipped: a
                                     live "Linked to Vendor Payment" row.
    vendor-payment.html/.js          #19. Built from an available Approved
                                     request picker. No approval gate — just
                                     Draft/Mark Paid/Cancel/Delete.
    purchase-closure.html/.js        #20, the final page. Built from an
                                     available PO picker (any non-Draft/
                                     non-Cancelled PO). The checklist table
                                     renders identically in both the create
                                     form (preview) and the Detail view
                                     (final record), both computed fresh
                                     from `computeCompletionChecklist()`.

    customer-inquiry.html/.js        Phase 5 #1. No "built from" upstream
                                     link — it's the pipeline's own start.
                                     Assigned To picker has an explicit
                                     "Unassigned" option DN's required
                                     Requester picker never needed. Mark
                                     Lost gets its own small modal
                                     (captures a required reason), mirroring
                                     DN's Reject modal exactly. No dashboard
                                     Quick Actions tile added (Section 10's
                                     discipline holds) but `?action=add` is
                                     still wired for free, same as later
                                     Procurement modules that kept it
                                     without a tile pointing to it. Detail
                                     modal retrofitted (Phase 5 #2) with a
                                     "Linked to Quotation" row — now also
                                     loads `../data/sales-quotation-data.js`.

    sales-quotation.html/.js         Phase 5 #2. Detail modal is the
                                     workspace (PR's split — Add only
                                     creates the header, line items live
                                     inside Detail), two nested modals
                                     (header form + line-item form). A
                                     THIRD small modal (#sqDeclineModal)
                                     captures the mandatory decline reason
                                     — terminal, no reopen action anywhere
                                     on the page (see sales-quotation-
                                     data.js's header). Customer is a
                                     read-only derived display
                                     (#sqFormCustomerDisplay), never its
                                     own dropdown. Loads `tax-data.js` for
                                     the FIRST time outside Phase 3's own
                                     tax-master.html. Detail modal
                                     retrofitted (Phase 5 #3) with a
                                     "Linked to Sales Order" row — now
                                     also loads `../data/sales-order-data.js`.

    sales-order.html/.js             Phase 5 #3. Detail modal shows line
                                     items but NEVER edits them — no
                                     line-item modal exists on this page
                                     at all (contrast with Quotation's own
                                     page). Header form's "link a
                                     quotation" field is HIDDEN entirely
                                     in Edit mode (#soFormQuotationField)
                                     — the linked quotation is locked once
                                     created, since the frozen lineItems
                                     copy would go stale if it changed.
                                     Live credit-utilization badge on both
                                     the create form and Detail view, read
                                     straight from `ERP_CustomerRepository
                                     .getCreditUsage()`/
                                     `getCreditUtilizationBand()`. NO
                                     Item Master script tag — the frozen
                                     `lineDescription` is self-sufficient
                                     for display, so this page's
                                     dependency list stays intentionally
                                     minimal.

    order-approval.html/.js          Phase 5 #4. NO data file of its own
                                     — the 8th instance of this shape
                                     (Section 7). A near-direct structural
                                     copy of `pr-approval.html/.js`: same
                                     "defaults to Awaiting Approval, not
                                     All" chip behavior, same missing
                                     `#noAnchorState` (reviews only, never
                                     creates), same `APPROVER_ROLES` role
                                     hint (literally the same array — see
                                     data/users.js's "Purchase & Sales
                                     Manager" role). Detail modal keeps
                                     Sales Order's own Customer Credit
                                     badge front and center, since
                                     checking it is part of the actual
                                     decision here.

    delivery-challan.html/.js        Phase 5 #5. Structural copy of
                                     `goods-receipt.html/.js`'s "inline
                                     editable table in the create/edit
                                     form" pattern (no separate line-item
                                     modal). Picking a sales order
                                     re-renders the line table live from
                                     its OWN frozen lineItems, one hop —
                                     no five-hop chain-walk needed the way
                                     Goods Receipt required. The sales
                                     order picker is DISABLED in Edit mode
                                     (locked once created) and explicitly
                                     re-enabled when Add opens next — a
                                     real bug caught and fixed this
                                     session (a shared DOM element's
                                     `.disabled` state doesn't reset
                                     itself between modal opens). No
                                     price/tax/logistics columns anywhere
                                     — see delivery-challan-data.js's
                                     header for why both are deliberately
                                     out of scope here.

    tax-invoice.html/.js             Phase 5 #6. Structural copy of
                                     `grn.html/.js`'s "computed, read-only
                                     line display, even inside the create
                                     form" pattern. `resolveJoin()` is a
                                     ONE-HOP lookup (challan ->
                                     salesOrderId direct) — nowhere near
                                     GRN's own three-hop chain-walk,
                                     because every earlier module in this
                                     chain already stored its own direct
                                     copies rather than making the next
                                     module walk back through everything.
                                     Same "picker disabled in Edit,
                                     explicitly re-enabled in Add" fix
                                     applied proactively from the start
                                     this time, learned from Delivery
                                     Challan's own bug.
    dispatch.html/.js                Phase 5 #7. Structural copy of
                                     `vendor-payment.html/.js`'s
                                     "header-only, picker-built, simple
                                     3-state" shape — no line-item table
                                     anywhere on this page at all, the
                                     first Sales page to go without one.
                                     Customer is resolved straight off
                                     the invoice's own stored `customer
                                     Id`, no chain-walk. Same invoice-
                                     picker-locked-in-Edit-mode fix
                                     applied proactively. Retrofits Tax
                                     Invoice's own Detail modal with a
                                     live "Linked to Dispatch" row
                                     (`findDispatchForInvoice()`) —
                                     `tax-invoice.html` now also loads
                                     `../data/dispatch-data.js`.
    payment-collection.html/.js      Phase 5 #8. Structural copy of
                                     `customer-inquiry.html/.js`'s
                                     5-state pipeline shape, not Vendor
                                     Payment's — see its own data file's
                                     header for why. Status chips only
                                     (no second Source-style chip row —
                                     a deliberate scope-trim, not an
                                     oversight). Invoice picker offers
                                     EVERY Raised invoice always, never
                                     filtered to "available," and is
                                     never locked even in Edit mode —
                                     mirrors Customer Inquiry's own
                                     unlocked Customer field exactly.
                                     Write Off gets its own small modal
                                     (`#pcolWriteOffModal`) capturing a
                                     required reason, the same shape as
                                     Customer Inquiry's own Mark Lost
                                     modal. Retrofits Tax Invoice's own
                                     Detail modal with an AGGREGATE
                                     "Collection Follow-Ups" row (count +
                                     latest status), not a single link —
                                     `tax-invoice.html` now also loads
                                     `../data/payment-collection-data.js`.
    receipt.html/.js                 Phase 5 #9. Structural copy of
                                     `dispatch.html/.js`'s header-only,
                                     picker-built, simple 3-state shape —
                                     the mirror held this time, see its
                                     own data file's header for why.
                                     Amount Received defaults live from
                                     the selected invoice's own
                                     `computeGrandTotal()`, refreshed on
                                     invoice change, editable after.
                                     Bank picker defaults to the
                                     company's own `getDefault()` account
                                     but is a free choice, each option
                                     rendered through `ERP_BankRepository
                                     .maskedLabel()` — the same masked
                                     format Vendor Master's own retrofit
                                     already uses. Same invoice-picker-
                                     locked-in-Edit-mode fix applied
                                     proactively. Retrofits Tax Invoice's
                                     own Detail modal with a genuine
                                     single "Linked to Receipt" row —
                                     `tax-invoice.html` now also loads
                                     `../data/receipt-data.js`.
    sales-close.html/.js             Phase 5 #10, THE FINAL MODULE.
                                     Structural copy of `purchase-
                                     closure.html/.js`'s capstone
                                     checklist shape — same overall
                                     rendering (checklist table live in
                                     both form and detail, completion
                                     summary, no reopen from Closed), but
                                     `computeCompletionChecklist()`'s own
                                     call site just passes the resolved
                                     Sales Order through unchanged; the
                                     branching happens inside the
                                     repository, not this page. Script
                                     tag list deliberately leaner than
                                     Purchase Closure's own copy-paste
                                     source — no Item/PR/RFQ/Quotation,
                                     since this page never calls into any
                                     of them. Retrofits Sales Order's own
                                     Detail modal with a genuine single
                                     "Linked to Sales Close" row — the
                                     LAST retrofit this project adds —
                                     `sales-order.html` now also loads
                                     `../data/sales-close-data.js`.
    (flat — no subfolders; add new modules here the same way going forward)

  vendors.html/.js — RETROFITTED (Phase 3 file touched by Phase 4 #8):
  a live "Average Rating" line via `ERP_VendorEvaluationRepository
  .getAverageScoreForVendor()`, script tag added.

  dashboard.html — Quick Actions grid: "Add Item" converted from a stale
  stub to `items.html?action=add` (Item Master existed before the stub
  was ever converted); "Raise Department Need" and "New Purchase
  Requisition" tiles added when those modules shipped, then **deliberately
  STOPPED** — Phase 4 shipped 18 more modules after that decision and the
  grid never grew past those two procurement tiles. The sidebar is already
  the full index; Quick Actions stays a spotlight on the most common entry
  points, not a mirror of the whole nav tree. Same discipline held into
  Phase 5 — Customer Inquiry shipped with NO new Quick Actions tile.

  Sidebar (every `pages/*.html`, bulk-updated via `update_sidebar.py`) —
  a new "Sales" group (`data-group-key="sales"`) was added right after
  Procurement's, ALL 10 Phase 5 modules present from the start: Customer
  Inquiry as a live link, the other 9 as locked `.sidebar-link--locked`
  stubs (`data-not-built="..."`, a "Soon" badge) that unlock one at a time
  as each module ships — same shape Procurement itself used early in
  Phase 4. One new CSS class needed: `.sidebar-link__main` (groups a
  locked link's own icon+label so `.sidebar-link--locked`'s
  `justify-content:space-between` only pushes the badge right, not all
  three children apart) — first needed here since Phase 4's own
  Procurement stubs were all long since converted to live links, leaving
  no earlier locked-link markup to copy.

  --- PHASE 7 (Inventory Management) additions below ---

  data/
    stock-ledger-data.js     ERP_StockLedgerRepository — Phase 7 #2, the
                              genuine-storage backbone every other Phase 7
                              module writes to (see Section 3 for the
                              full "storage vs. General Ledger's pure
                              computation" reasoning). `.transactionTypes`
                              (6-item vocabulary). `recordMovement()` is
                              the ONLY write path — no `update()`/
                              `remove()` exist at all. `getBalance()`/
                              `getTotalStockForItem()` (plain signed-sum,
                              no FIFO layers — fast, used by Item Master's
                              own rollup and the Low Stock report).
                              `getActivePairsForCompany()`/
                              `getLedgerRows()` (the summary-table +
                              drill-down shape the page itself reads).

    opening-stock-data.js    ERP_OpeningStockRepository — Phase 7 #1
                              (roadmap order), built second (real
                              dependency order — see Section 3). One
                              record per (item, warehouse) pair, NOT a
                              multi-line document. Duplicate-check
                              resolution #7 reused a third time (hard
                              uniqueness on the composite key). Draft →
                              Confirmed/Cancelled, no reopen from
                              Confirmed at all. `confirm()` calls
                              `ERP_StockLedgerRepository.recordMovement()`
                              directly (typeof-guarded) — a brand-new
                              module built alongside Stock Ledger, no
                              "keep an already-shipped module ignorant"
                              constraint to honor.

    stock-valuation-data.js  ERP_StockValuationRepository — Phase 7 #5
                              (roadmap order), built third (its FIFO
                              engine had to exist before Stock Transfer
                              could use it). No storage — same "thin
                              computation over an already-real ledger"
                              shape as Trial Balance/P&L/Balance Sheet.
                              `computeFifoState(companyId, itemId,
                              warehouseId, asOfDate)` — the layer-queue
                              walk, verified against 4 hand-traced
                              Node-sandbox scenarios (see Section 3).
                              `getWeightedAverageCost()` (what Stock
                              Transfer reads). `getValuationReport()` —
                              one row per item, aggregated across
                              warehouses when none is specified.

    stock-posting-data.js    ERP_StockPostingRepository — the Phase 7
                              equivalent of `gl-posting-data.js`, same
                              exact shape (see Section 3 for the full
                              parallel). `postGrnReceipt()` (the
                              multi-hop chain-walk reused from
                              `grn.js`'s own `resolveChain()`) and
                              `postDeliveryIssue()` (itemId already
                              direct, still nullable). Both never throw;
                              both return `{success, entries?,
                              skippedCount?, reason?}`. Neither
                              `grn-data.js` nor `delivery-challan-
                              data.js` was touched — only their page
                              controllers gained one typeof-guarded call
                              each, right after `post()`/`issue()`.

    stock-adjustment-data.js ERP_StockAdjustmentRepository — Phase 7 #3.
                              `.reasons` (6-item vocabulary). Own live
                              add/remove line table (Journal Entry's
                              shape). Unit cost required on a line only
                              when its own adjustment quantity is
                              positive (a surplus) — a shortage needs no
                              cost input, consumed via FIFO automatically.
                              `systemQuantity` snapshotted once, at
                              line-add time, never re-derived at post.
                              Draft → Posted (immutable) or Cancelled.
                              `post()` writes one Stock Ledger entry per
                              non-zero line, typeof-guarded.

    stock-transfer-data.js   ERP_StockTransferRepository — Phase 7 #4.
                              `fromWarehouseId`/`toWarehouseId` must
                              differ. Writes a matched Transfer Out /
                              Transfer In pair per line — both or
                              neither; an under-stocked line is skipped
                              on both sides, never posted lopsided.
                              Reads FORWARD into
                              `ERP_StockValuationRepository
                              .getWeightedAverageCost()` for the
                              destination's cost basis — a transactional
                              write reading a valuation computation, the
                              same "genuine reuse forward" discipline
                              Trial Balance/Balance Sheet established,
                              extended to a new direction. Draft →
                              Completed/Cancelled.

    low-stock-data.js        ERP_LowStockRepository — Phase 7 #6, the
                              thinnest module this phase. No storage, no
                              new computation — filters/sorts
                              `ERP_ItemRepository`'s own already-live
                              `getStockUsage()`/`getStockHealthBand()`
                              for items with a real `reorderLevel` set.
                              Sorted by urgency (current stock as a
                              FRACTION of reorder level), not raw gap
                              size.

  data/item-data.js — RETROFITTED. `currentStock` becomes a computed
                              rollup once Stock Ledger exists (see
                              Section 3 for the full Chart-of-Accounts-
                              balance parallel). New:
                              `getLiveCurrentStock(item)` (live ledger
                              total, typeof-guarded, falls back to the
                              legacy stored field) and
                              `getStockBreakdownByWarehouse(item)` (the
                              per-warehouse list Item Detail's own
                              retrofit row shows). `getStockUsage()`/
                              `getStockHealthBand()` retrofitted
                              internally to read through
                              `getLiveCurrentStock()` — SIGNATURE
                              UNCHANGED, so every existing call site
                              (Dashboard, Items list, PR/PO stock-health
                              badges) picked up the fix for free.

  data/dashboard-data.js — RETROFITTED (Phase 7). `inventoryValue` and
                              `buildCategorySplit()` now read
                              `ERP_StockValuationRepository
                              .getValuationReport()` when loaded
                              (typeof-guarded), falling back to the old
                              currentStock×purchasePrice approximation
                              only if Stock Valuation genuinely isn't
                              available — in practice dead code once
                              Phase 7 shipped. `inventoryChangePct`/
                              `lowStockChange` remained hardcoded to 0 as
                              of this phase — see the Phase 8 retrofit
                              note further below for how that gap closed.

  pages/opening-stock.html/js — Phase 7 #1. List + Add modal (item,
                              warehouse, quantity, unit cost, as-of
                              date) — closest template was Warehouse
                              Master's own simple CRUD shape, NOT
                              Journal Entry's line-table shape, since
                              each record is a single (item, warehouse)
                              fact, not a multi-line document. Row-level
                              Confirm/Cancel/Delete actions in the
                              Detail modal footer, genuinely different
                              per status.

  pages/stock-ledger.html/js — Phase 7 #2. Read-only — no Add, no Edit,
                              no Delete, `#confirmDialog` present but
                              never triggered. Structurally copied from
                              General Ledger's own summary-table +
                              per-account drill-down modal shape, quantity-
                              only (no debit/credit sides).

  pages/stock-adjustment.html/js — Phase 7 #3. Header (warehouse, date,
                              reason, notes) + live add/remove line
                              table (Journal Entry's shape) with a
                              conditionally-shown Unit Cost column —
                              appears only on a surplus line, teaching
                              the same rule the data layer enforces.

  pages/stock-transfer.html/js — Phase 7 #4. Header (from/to warehouse,
                              date, notes) + live line table showing
                              live "available in From warehouse" per
                              line, so a shortfall is visible before
                              attempting to complete.

  pages/stock-valuation.html/js — Phase 7 #5. Report table (one row per
                              item) + as-of-date and warehouse filters +
                              a FIFO-layer drill-down modal per item —
                              the same summary+drill-down shape Stock
                              Ledger's own page uses, applied to layers
                              instead of raw entries.

  pages/low-stock.html/js — Phase 7 #6. The simplest page this phase —
                              no filters, no drill-down, no lifecycle.
                              Just a sorted table and an export.

  Sidebar — a new "Inventory" group (`data-group-key="inventory"`)
  added across all `pages/*.html` (bulk insertion, since no earlier
  locked-stub markup survived to reuse — this project was 100% unlocked
  before this phase started, unlike Phase 5's own group addition which
  at least had Phase 4's now-live links to consult). Opening Stock live
  from the start, the other 5 modules locked `.sidebar-link--locked`
  stubs, unlocked one at a time via `update_sidebar.py` exactly as each
  module shipped — same shape Phase 5/6 both used.

  --- PHASE 8 (Cross-Module Reporting & Dashboard) additions below ---

    sales-register-data.js   ERP_SalesRegisterRepository — Phase 8 #1.
                              No storage — but NOT page-only either
                              (unlike Low Stock): GST Summary reads this
                              file's own `getRows()`/`groupByRate()`/
                              `groupByHsn()` directly, the first time a
                              report needed to be reusable by ANOTHER
                              report. One row per Raised Tax Invoice
                              LINE. Reuses `ERP_TaxInvoiceRepository
                              .computeLineTotal()`/`.computeLineTax()`
                              rather than re-deriving; adds the first
                              real transactional CGST/SGST/IGST split via
                              Tax Master's own `getIntraStateSplit()`/
                              `getInterStateSplit()`.

    purchase-register-data.js ERP_PurchaseRegisterRepository — Phase 8
                              #2. Sales Register's own mirror, built from
                              "Verified" Invoice Verification (NOT GRN —
                              see this file's own header for why GRN is
                              the wrong mirror). Chain-walks
                              verification→PO→Quotation→RFQ→PR (one hop
                              shorter than GRN's own `resolveChain()`) to
                              resolve each line's item/HSN. Every row
                              carries `taxIsEstimated: true` — no tax
                              rate is ever captured anywhere in the
                              Procurement chain (confirmed by direct
                              check, matching Phase 6's own
                              `gl-mapping-data.js` finding), so input tax
                              here is imputed from each item's CURRENT
                              effective tax code, not read off the
                              vendor's original bill.

    gst-summary-data.js      ERP_GstSummaryRepository — Phase 8 #3.
                              Reconciles Sales Register's own output tax
                              against Purchase Register's own input tax,
                              by rate and by HSN — the first report built
                              by merging two OTHER reports rather than
                              reading a transactional module. A PERIOD
                              report (From/To), matching Profit & Loss's
                              own reasoning, not Trial Balance's
                              as-of-a-date shape. `netTax` is a named,
                              deliberate simplification (output minus
                              input, no ITC eligibility rules).

    inventory-valuation-data.js ERP_InventoryValuationRepository — Phase
                              8 #4. Wraps `ERP_StockValuationRepository
                              .getValuationReport()` unchanged and adds
                              exactly one thing: grouping by each item's
                              TOP-LEVEL category (via Category Master's
                              own `getAncestors()`), with subtotals and a
                              grand total — the formal, closing-pack
                              shape Trial Balance/Balance Sheet already
                              use, genuinely distinct from Stock
                              Valuation Report's own flat, operational,
                              per-item view. Deliberately does NOT add a
                              Weighted-Average comparison (see this
                              file's own header for why
                              `getWeightedAverageCost()` would be a real
                              conflation here, not a fair comparison).

    snapshot-data.js         ERP_SnapshotRepository — Phase 8's actual
                              hard infrastructure module, no page of its
                              own (same shape as `gl-posting-data.js`/
                              `stock-posting-data.js`). GENUINE STORAGE
                              (`erp_daily_snapshots`), unlike every other
                              Phase 8 file — closer to Stock Ledger than
                              to a report. `captureSnapshot()` upserts
                              TODAY's own row only (a deliberate, explained
                              departure from Stock Ledger's "no update,
                              ever" stance — today hasn't finished
                              happening yet); every earlier row is left
                              alone once written. `ensureTodaySnapshot()`
                              is the automatic trigger (Dashboard's own
                              boot, once per calendar day, a no-op if
                              today's row already exists);
                              `captureSnapshot()` is also called directly
                              by Dashboard's own manual "Capture Snapshot
                              Now" button — both triggers exist on
                              purpose, since a trainee in one sitting
                              will never see a real calendar day roll
                              over. `getDeltas()` diffs current live
                              figures against the latest snapshot
                              strictly BEFORE today (never today's own
                              still-forming row) and returns `null` — not
                              0 — for both delta fields when no prior
                              snapshot exists at all.

  data/dashboard-data.js — RETROFITTED (Phase 8). `buildKpis()` now
                              calls `ERP_SnapshotRepository.getDeltas()`
                              (typeof-guarded) for `inventoryChangePct`/
                              `lowStockChange`, returning `null` instead
                              of 0 when there's no prior-day baseline —
                              closes the gap this file's own header
                              flagged back in Phase 6. `emptySnapshot()`
                              and `buildSnapshot()`'s own return object
                              both gained a `snapshotInfo` field (baseline
                              date + today's own capture metadata) for
                              the page to render.

  pages/dashboard.html/js — RETROFITTED (Phase 8). New script include
                              (`snapshot-data.js`, loaded right before
                              `dashboard-data.js`). New "Capture Snapshot
                              Now" button + a small snapshot-info line
                              next to the existing date label.
                              `renderKpiTrend()` now renders a `null`
                              value as "No prior-day data yet" — visibly
                              distinct from a genuine "No change vs
                              yesterday" (which is what a real, tiny 0%
                              still shows) — so this mechanism can never
                              silently claim "no change" when the honest
                              answer is "no data yet." Boot sequence
                              calls `ensureTodaySnapshot()` once, right
                              after resolving the active company.

  pages/sales-register.html/js — Phase 8 #1. Full "list module" shell
                              (search-free, but filter/sort/paginate/
                              CSV/print) laid over a read-only report —
                              closer in mechanics to a transactional list
                              page than to AP Aging's small ungrouped
                              table, since row count scales with invoice-
                              line history. From/To date + customer +
                              item filters, "This Month" quick button.

  pages/purchase-register.html/js — Phase 8 #2. Same list-module shell
                              as Sales Register, vendor instead of
                              customer. Leads with an explicit "tax
                              figures are estimated" note above the KPI
                              row — not buried in the training drawer.

  pages/gst-summary.html/js — Phase 8 #3. Ungrouped-table shape (no
                              pagination, like AP Aging) — this report's
                              row count is bounded by distinct rates/HSN
                              codes, not transaction volume. From/To
                              period picker (P&L's own shape). Net Tax
                              KPI card relabels itself "Net Credit Carried
                              Forward" and switches to the success icon
                              when negative, rather than showing a
                              confusing negative "payable" figure.

  pages/inventory-valuation.html/js — Phase 8 #4. Reuses Trial
                              Balance/Balance Sheet's own established
                              `tb-type-header`/`je-totals-row` CSS
                              classes for category header rows and
                              subtotal rows — an existing visual
                              convention, not a new one. As-of-date +
                              warehouse filters (Stock Valuation's own
                              shape).

  Sidebar — a new "Reporting" group (`data-group-key="reporting"`)
  added across all `pages/*.html` (bulk insertion, same shape as
  Phase 7's own "Inventory" group addition). All 4 modules locked
  `.sidebar-link--locked` stubs at first, unlocked one at a time via
  `update_sidebar.py` exactly as each shipped. The snapshot mechanism
  has no sidebar entry at all — it has no page, the same way GL
  Mapping's own posting logic never got one.

  --- PHASE 9 (HR & Payroll) additions below ---

    attendance-data.js       ERP_AttendanceRepository — Phase 9 #1.
                              Genuine storage, one record per (employeeId,
                              date) — UPSERT on that key, not resolution
                              #7's hard block (see this file's own header
                              for the third-variant reasoning). No
                              lifecycle at all; plain master-data CRUD is
                              the real shape here, not a transactional
                              document. `getMonthlySummary()` and
                              `getForEmployeeInRange()` are the hooks
                              Payroll (#4) reads from.

    leave-data.js             ERP_LeaveRepository — Phase 9 #2. Genuine
                              storage. `Pending → Approved/Rejected,
                              +Cancelled` — a real decision gate, checked
                              directly against Three-Way Matching's own
                              shape and found to need a different
                              starting state (no Draft-equivalent phase).
                              Overlap validation hard-blocks two
                              Pending/Approved applications from claiming
                              the same employee's same days — a
                              genuinely new kind of check, not a fit for
                              any numbered duplicate-check resolution.
                              `approverEmployeeId` is frozen from the
                              applicant's own `managerId` at application
                              time. `getApprovedLeaveDaysInRange()` is
                              the hook Payroll (#4) reads from, with
                              priority over Attendance's own records.

    salary-structure-data.js  ERP_SalaryStructureRepository — Phase 9
                              #3. Genuine storage. Multiple records per
                              employee is the intended, GOOD outcome (a
                              raise creates a new dated record rather
                              than editing history) — resolution #7 only
                              blocks two records sharing the exact same
                              (employeeId, effectiveFrom). No Edit
                              action, ever — only New and unconditional
                              Cancel (safe because Payroll always freezes
                              its own figures at processing time).
                              `getEffectiveStructure()` and
                              `computeFigures()` are the hooks Payroll
                              (#4) reads from.

    payroll-data.js           ERP_PayrollRepository — Phase 9 #4, and
                              the module the other three were built
                              toward. Genuine storage
                              (`erp_payroll_runs`). `computeLopForPeriod()`
                              is the actual reconciliation this whole
                              phase exists for — Leave Application beats
                              Attendance when both describe the same day,
                              an unmarked day with neither assumes paid.
                              Structure resolved once, as of the
                              period's own last day (no intra-month
                              structure-splitting). Earnings prorate with
                              LOP; Professional Tax/TDS stay flat. A
                              Draft run is regenerable in place;
                              Processing freezes its own `payslipLines`
                              as permanent history. One run per
                              (companyId, periodYear, periodMonth),
                              excluding Cancelled. Payslip Generation is
                              a VIEW (`getPayslipView()`), not separate
                              storage. GL posting deliberately NOT built
                              — a named gap, not a hidden one; see this
                              file's own header.

  pages/attendance.html/js — Phase 9 #1. Plain CRUD list (no pagination-
                              worthy lifecycle filters beyond date/
                              employee/status) plus a Bulk Mark modal
                              reusing RFQ Creation's own `.checkbox-list`
                              multi-select pattern.

  pages/leave.html/js — Phase 9 #2. List + status chips (Pending/
                              Approved/Rejected/Cancelled) + an Apply
                              modal showing a live leave-balance note +
                              a separate Approve/Reject decision modal
                              with required notes on Reject.

  pages/salary-structure.html/js — Phase 9 #3. New-only creation modal
                              with a live-computed Preview panel
                              (Gross/Deductions/Net recalculating on
                              every keystroke); table rows derive and
                              show Current/Historical/Scheduled/Cancelled
                              state rather than just the raw storage
                              status.

  pages/payroll.html/js — Phase 9 #4. A genuinely new page shape for
                              this project — period picker →
                              generate/regenerate → review → Process →
                              Mark Paid, plus an "All Runs" history table
                              and a Payslip view/print modal. Closest in
                              spirit to Bank Reconciliation's own
                              worksheet shape, not to any list-module
                              template.

  Sidebar — a new "HR & Payroll" group (`data-group-key="hr-payroll"`)
  added across all `pages/*.html` (bulk insertion, same shape as every
  earlier phase's own group addition). All 4 modules locked
  `.sidebar-link--locked` stubs at first, unlocked one at a time via
  `update_sidebar.py` exactly as each shipped, in dependency order
  (Attendance → Leave → Salary Structure → Payroll) — which, unlike
  Phase 7, happened to match the roadmap's own presentation order this
  time (checked, not assumed).

  --- PAYROLL GL RETROFIT (post-Phase-9 pass) additions below ---

    data/gl-mapping-data.js — RETROFITTED. `ERP_GL_MAPPING_ROLES` grew
                              from 6 to 11 — five new Payroll roles
                              (Salary Expense, PF Payable, Professional
                              Tax Payable, TDS Payable, Salary Payable)
                              appended after the original six, in the
                              order Payroll's own posting flow introduces
                              them (the Dr side, then the Cr liabilities).
                              No other structural change — `get()`,
                              `set()`, `configuredCount()` were already
                              generic over the roles array.

    data/gl-posting-data.js — RETROFITTED. Two new functions,
                              `postPayrollProcessing()` and
                              `postSalaryPayment()` — see this section's
                              own "Payroll GL Retrofit" entry above for
                              the full accounting reasoning. The five
                              original functions are byte-for-byte
                              unchanged.

    pages/posting-rules.js/html — RETROFITTED. A third readiness card
                              ("Payroll Ready," alongside the existing
                              Procurement/Sales ones), requiring only the
                              two unconditional roles
                              (`salaryExpenseAccountId`/
                              `salaryPayableAccountId`) — the three
                              payroll liability roles stay conditional,
                              same reasoning `outputTaxAccountId` already
                              established for Sales. The role LIST itself
                              needed no page changes at all to grow from
                              6 to 11 — confirmation the original page
                              really was built generically over
                              `ERP_GL_MAPPING_ROLES`, not just claimed to
                              be.

    data/payroll-data.js — header comment updated only (the "GL posting
                              deliberately not built" note now points to
                              gl-posting-data.js instead) — zero logic
                              changes. `process()`/`markPaid()` are
                              exactly what they were; the two new GL
                              calls live entirely in the page's own
                              controller.

    pages/payroll.js/html — RETROFITTED. New script includes (bank,
                              chart-of-accounts, journal-entry, GL
                              mapping, GL posting, plus the vendored
                              jsPDF library). `processRun()` now calls
                              `postPayrollProcessing()` right after a
                              successful `process()`; a new "Mark Paid"
                              modal (bank picker + summary) replaces the
                              old bare confirm dialog, asking for the
                              disbursing bank account at the one moment
                              this module actually needs one. The Payslip
                              modal gained a "Download PDF" button
                              generating a real, letterhead-style,
                              multi-section PDF via the vendored jsPDF
                              library — see this section's own "Payslip
                              PDF" entry above for the ₹-glyph lesson.

    assets/vendor/jspdf.umd.min.js — NEW. jsPDF v4.2.1, MIT-licensed,
                              vendored locally (fetched once via npm
                              during development, not loaded from a CDN)
                              so PDF generation works fully offline —
                              consistent with this project's own
                              "offline training environment" framing.
                              License text alongside it at
                              `jspdf.LICENSE.txt`.
  data/bom-data.js — NEW, Phase 10 #1. `ERP_BomRepository`. Recursive,
                              cycle-guarded cost rollup and cycle-blocked
                              nesting; `activate()` reuses Quotation
                              Comparison's own mutual-exclusivity toggle
                              shape rather than a flat hard block. See
                              this file's own header for the full
                              estimate-vs-actual-cost reasoning.

  data/work-order-data.js — NEW, Phase 10 #2. `ERP_WorkOrderRepository`.
                              A hub, not a chain — Material Issue and
                              Finished Goods Receipt both read
                              `workOrderId` directly, never through each
                              other. Every quantity/cost figure is live-
                              computed from those two sibling modules,
                              never stored on the Work Order itself.

  data/material-issue-data.js — NEW, Phase 10 #3.
                              `ERP_MaterialIssueRepository`. The first
                              caller of `ERP_StockLedgerRepository.
                              recordMovement()` whose reference is a Work
                              Order. Actual FIFO-weighted-average costing
                              via `ERP_StockValuationRepository`, reusing
                              Stock Transfer's own established convention.
                              Insufficient stock skips a line rather than
                              posting it lopsided (Stock Transfer's own
                              precedent again).

  data/finished-goods-receipt-data.js — NEW, Phase 10 #4.
                              `ERP_FinishedGoodsReceiptRepository`. Costs
                              a receipt from what's genuinely still in
                              Work-in-Progress for its own Work Order — a
                              moving average across the remaining planned
                              run, named as a limitation in this file's
                              own header. Deliberately materials-cost-only
                              — no labor/overhead absorption this phase.

  data/stock-ledger-data.js — RETROFITTED, Phase 10. Two additive entries
                              in `transactionTypes` ("Material Issue",
                              "Finished Goods Receipt") — nothing else
                              changed; the existing generic `referenceType`
                              /`referenceId` pair already fit a Work Order.

  data/gl-mapping-data.js — RETROFITTED, Phase 10. Two new REQUIRED
                              roles (Work-in-Progress, Finished Goods
                              Inventory — thirteen roles total now),
                              surfaced on Posting Rules with zero code
                              changes to that page (already generic over
                              `ERP_GL_MAPPING_ROLES`).

  data/gl-posting-data.js — RETROFITTED, Phase 10. Two new functions,
                              `postMaterialIssue()` (Dr WIP / Cr the
                              existing Inventory role) and
                              `postFinishedGoodsReceipt()` (Dr Finished
                              Goods Inventory / Cr WIP) — built in the
                              same pass as the modules themselves, not
                              deferred the way Payroll's first was.

  pages/bill-of-materials.html/js — Phase 10 #1. Own live add/remove
                              component-line table (Stock Adjustment's
                              own shape), a live estimated-cost preview
                              recalculating on every line/output-quantity
                              change, and a per-line cycle check firing
                              the moment a component is picked, not only
                              at save time.

  pages/work-order.html/js — Phase 10 #2. No line table of its own — a
                              read-only completion checklist (component
                              required-vs-issued) plus two related-records
                              lists (Material Issues, Finished Goods
                              Receipts raised against this order) on the
                              Detail modal, the hub pattern in its page
                              form.

  pages/material-issue.html/js — Phase 10 #3. Lines are DERIVED from the
                              picked Work Order's own BOM on selection —
                              no add/remove line controls at all, only a
                              per-line quantity field, pre-filled with
                              whatever's still outstanding against the
                              full planned batch.

  pages/finished-goods-receipt.html/js — Phase 10 #4. Header-only form,
                              no line table (a receipt always has exactly
                              one output item) — a live cost-per-unit
                              preview reads the exact same allocation
                              function the repository's own `post()`
                              later uses, so what's previewed matches
                              what actually posts.

  pages/*.html (all 81 previously-shipped pages) — RETROFITTED, Phase
                              10. New "Manufacturing" sidebar group
                              (`data-group-key="manufacturing"`, after
                              "HR & Payroll") inserted as four live links
                              directly — no locked-stub intermediate
                              stage, since all four modules shipped in
                              one pass. See Section 11's own
                              `update_sidebar.py` note for the exact old-
                              block/new-block mechanism used.

  data/rbac-data.js — NEW, Phase 11. `ERP_RbacRepository`. Pure lookup
                              layer only — `ERP_PAGE_ROLE_MAP` (all 86
                              page keys, audited against the real
                              `pages/` directory programmatically before
                              use), `canAccessPage()`, `getAllowedPageKeys()`.
                              No UI side effects live here — see
                              script.js's own `enforcePageAccess()` for
                              the acting-on-it layer. Fails CLOSED
                              (Admin-only + console.warn) on an unlisted
                              page key — see this file's own header and
                              Section 2's new Rule 9.

  script.js — RETROFITTED, Phase 11. New `enforcePageAccess(session,
                              pageKey)` on `window.ERP` (sidebar link/
                              group hiding + the actual page-load gate +
                              redirect-with-toast), called from every
                              page right after `requireSession()`. The
                              existing `openModal()`/`openConfirm()`
                              functions each gained one Viewer check at
                              their own top — the two universal choke
                              points that reach the Viewer-role action
                              lockdown across ~90 modules with zero
                              per-module changes; see this file's own
                              inline comments (right where `openModal`/
                              `openConfirm` are defined) for the full
                              reasoning and the audited
                              `VIEWER_ALLOWED_MODAL_IDS` allow-list.

  data/users.js — RETROFITTED, Phase 11. One new dummy user (USR-1006,
                              `hr` / `HrTeam@123`, role "HR Manager") —
                              the one functional area with no existing
                              persona among the original five. Every
                              other user record, and the `role` field
                              itself, unchanged.

  index.html — RETROFITTED, Phase 11. New "HR" quick-login chip and demo-
                              credentials row for USR-1006. The Login
                              module's own training-guide copy (written
                              in Phase 1, before RBAC existed) updated
                              from "five roles… once the Dashboard module
                              ships" to describe what's now actually
                              true — see Section 3's own Phase 11 entry
                              for why this particular fix mattered enough
                              to call out on its own.

  pages/user-role-management.html/js — NEW, Phase 11, Admin-only. A
                              settings-style page (not a full CRUD list —
                              the user set is a small fixed six), reusing
                              Vendor Selection's own "saves immediately,
                              no big form Save" shape for a per-row role
                              dropdown, persisted through
                              `ERP_UserRepository.saveOverride()` — the
                              same mechanism Profile edits already use.
                              Can't change your own role (self-lockout
                              guard).

  pages/vendor-selection.js — RETROFITTED, Phase 11. One direct,
                              module-specific Viewer check added to its
                              own per-row decision click handler — the
                              one place in ~90 modules where a real
                              mutation doesn't funnel through
                              `openConfirm()`/`openModal()` at all, found
                              by this phase's own modal-id audit and
                              closed directly rather than left as a
                              silent gap. See this file's own inline
                              comment at that handler.

  pages/*.html (all 85 previously-shipped pages) — RETROFITTED, Phase
                              11. `<script src="../data/rbac-data.js">`
                              inserted immediately after `../script.js`;
                              a new "User & Role Management" sidebar link
                              added to the Company Setup group.

  pages/*.js (all 85 previously-shipped pages) — RETROFITTED, Phase 11.
                              One scripted insertion each:
                              `if (!window.ERP.enforcePageAccess(session,
                              "pageKey")) return;` immediately after the
                              existing `if (!session) return;` following
                              `requireSession()` — the pageKey derived
                              from each file's own filename and cross-
                              checked against `ERP_PAGE_ROLE_MAP`
                              programmatically before any file was
                              touched (0 missing, 0 typos, 0 duplicates).
  data/asset-data.js — NEW, Phase 12 #1. `ERP_AssetRepository`. Master
                              data + both Schedule II depreciation
                              formulas (annual SLM charge, annual WDV
                              rate), Node-verified. Accumulated
                              depreciation / net book value are live-
                              computed across Depreciation Run AND Asset
                              Disposal, never stored. Editing locks the
                              moment any depreciation has posted.

  data/depreciation-run-data.js — NEW, Phase 12 #3.
                              `ERP_DepreciationRunRepository`. Checked
                              against payroll-data.js first and reused
                              its shape where it genuinely fit (see this
                              file's own header); two-stage lifecycle, no
                              markPaid() equivalent. Owns the verified
                              MONTHLY math — including the corrected
                              monthly-equivalent WDV rate that Node
                              verification caught as wrong on the first
                              attempt.

  data/asset-disposal-data.js — NEW, Phase 12 #4.
                              `ERP_AssetDisposalRepository`. Computes its
                              own final partial-period depreciation
                              charge (prorated by days, no stub run
                              required), then real gain/loss.
                              `previewDisposal()` is shared by the create
                              form and post(), so preview and reality
                              can't drift.

  data/gl-mapping-data.js — RETROFITTED, Phase 12. Five new REQUIRED
                              roles (Fixed Assets at cost, Accumulated
                              Depreciation, Depreciation Expense, Gain on
                              Disposal, Loss on Disposal — eighteen
                              total), surfaced on Posting Rules with zero
                              changes to that page.

  data/gl-posting-data.js — RETROFITTED, Phase 12. `postDepreciationRun()`
                              and `postAssetDisposal()` (a real compound
                              entry, Node-verified to balance across
                              gain, loss and write-off cases) — built in
                              the same pass as the modules, per the
                              roadmap's own recommendation.

  data/rbac-data.js — RETROFITTED, Phase 12. Four new page keys
                              registered (all Finance Executive) as part
                              of building the pages, per Section 2's own
                              Rule 9 — its first real test since Phase 11
                              introduced it.

  pages/asset-register.html/js — Phase 12 #1. Live annual-rate preview
                              that recalculates as cost/life/method
                              change; residual auto-fills to 5% of cost
                              until manually touched.

  pages/depreciation-schedule.html/js — Phase 12 #2. NO data file of its
                              own, deliberately — a pure projection that
                              stores and decides nothing. Reuses (never
                              reimplements) the two verified formula
                              sources; verified against real posted runs
                              at ₹0.0000 drift. Yearly/monthly toggle.

  pages/depreciation-run.html/js — Phase 12 #3. Period picker with a live
                              preview of every asset's own computed
                              charge before generating. Duplicate-period
                              block lives here, at the page, matching
                              Payroll's own precedent.

  pages/asset-disposal.html/js — Phase 12 #4. Live gain/loss preview
                              driven by the same function post() uses;
                              Sale vs. Write-off toggles the proceeds and
                              bank fields.

  pages/*.html (all 86 previously-shipped pages) — RETROFITTED, Phase
                              12. New "Fixed Assets" sidebar group
                              (`data-group-key="fixed-assets"`, after
                              "Manufacturing") inserted as four live
                              links in one verified sweep.

  data/budget-data.js — NEW, Phase 13 #1. `ERP_BudgetRepository`. GL
                              account x period, scoped to one Financial
                              Year whose own `periods` array IS the
                              period dimension (never reinvented).
                              Income/Expense accounts only — deliberately
                              matching profit-and-loss-data.js's own
                              scoping. Approve() reuses Quotation
                              Comparison's mutual-exclusivity toggle a
                              third time. `buildEvenDistribution()` is
                              Node-verified to sum EXACTLY (remainder on
                              the last period). Header records why the
                              Cost Center dimension was rejected — see
                              Section 3's Phase 13 entry.

  pages/budget-master.html/js — Phase 13 #1. Annual-figure entry with
                              "distribute evenly", plus a collapsed
                              12-period grid where every cell stays
                              individually editable.

  pages/budget-vs-actual.html/js — Phase 13 #2. NO data file of its own,
                              deliberately (the second such module, after
                              Depreciation Schedule). Reads actuals
                              FORWARD from
                              `ERP_GeneralLedgerRepository`, using the
                              same period-movement formula P&L uses.
                              Owns the favourable/unfavourable variance
                              convention — Node-verified, including the
                              mixed-type cancellation property.

  style.css — RETROFITTED, Phase 13. Three scoped classes for the budget
                              period editor (`.budget-period-grid`,
                              `.budget-period-cell`,
                              `.budget-period-details`). Existing design
                              tokens only; no new CSS variables.

  data/rbac-data.js — RETROFITTED, Phase 13. Two new page keys
                              registered as part of building the pages
                              (Rule 9, second phase running).

  pages/*.html (all 90 previously-shipped pages) — RETROFITTED, Phase
                              13. New "Budgeting & Forecasting" sidebar
                              group (`data-group-key="budgeting"`, after
                              "Fixed Assets") inserted as two live links
                              in one verified sweep.

  data/lead-data.js — NEW, Phase 14 #1. `ERP_LeadRepository`. Closes the
                              "Lead concept" gap customer-inquiry-data.js's
                              own header named back in Phase 5. REUSES
                              shape 7 rather than adding an 8th (see
                              Section 3's Phase 14 entry). Free-text
                              contact details and NO customerId, by
                              design; convert() creates the real Customer
                              (+ optional Inquiry).

  data/support-ticket-data.js — NEW, Phase 14 #2.
                              `ERP_SupportTicketRepository`. The genuine
                              8th workflow shape — one success path with
                              a sequential two-stage ending
                              (Resolved -> Closed), not competing
                              outcomes. Severity and priority as two
                              separate dimensions. reopen() is
                              first-class and counted.

  data/contract-data.js — NEW, Phase 14 #3. `ERP_ContractRepository`.
                              Date-derived effective status reusing Cost
                              Center's own isExpired() precedent. renew()
                              creates a NEW contract and never mutates
                              dates in place, preserving history. Three
                              distinct endings (Expired / Renewed /
                              Terminated). No GL posting, deliberately.

  pages/lead-pipeline.html/js — Phase 14 #1. Funnel board with a
                              conversion modal that optionally raises a
                              Customer Inquiry alongside the new Customer.

  pages/support-tickets.html/js — Phase 14 #2. Status + priority filter
                              chips, severity-suggests-priority on the
                              form, reopen count surfaced inline.

  pages/contracts.html/js — Phase 14 #3. Renewals-due panel, renewal
                              modal pre-filled with the next term, and
                              every status shown as the EFFECTIVE one.

  data/rbac-data.js — RETROFITTED, Phase 14. Three new page keys (all
                              Purchase & Sales Manager), registered as
                              part of building the pages.

  pages/*.html (all 92 previously-shipped pages) — RETROFITTED, Phase
                              14. New "CRM" sidebar group
                              (`data-group-key="crm"`, after "Budgeting &
                              Forecasting") inserted as three live links
                              in one verified sweep.
```

## 5. The page template (every file under `pages/` follows this exactly)

- `<body data-page="KEY">` — `KEY` matches that page's own `data-page-key` in the sidebar
- Boot loader + toast container markup — copy verbatim from any existing page
- `.app-shell` → `#appSidebar` (full nav tree, copy verbatim) → `#sidebarBackdrop`
- `.app-main` → `.app-topbar` (only change breadcrumb text + search placeholder/visibility) → `.app-content` (the page's unique content) → `.page-footer`
- Training Guide FAB (`#trainingFabBtn`) + drawer (`#trainingDrawer`) with that module's own six-section content
- Generic `#confirmDialog` — copy verbatim, exactly once (Section 2, rule 8)
- Any page-specific modals (a dedicated reason modal for a rejection; a nested Line Item modal on top of a Detail modal; etc.)
- Scripts, in order: `../script.js`, then any needed `../data/*.js`, then that page's own `pagename.js`

**Fastest way to build a new page:** `cp <closest-existing-module>.html <new-module>.html`, then patch title/breadcrumb/search-placeholder/body-data-page with `str_replace`, then splice in unique content by exact line-number range using a small Python script (`with open() as f: lines = f.readlines(); ... assert lines[N].strip() == "expected text"; new_lines = lines[:N] + [new_content] + lines[M:]`). Pick the CLOSEST existing module as your template — e.g. a module with no create-flow (just reviews/decides on existing records) should copy PR Approval or Vendor Selection, not Purchase Requisition. Always re-run full validation afterward (Section 2 rule 7) AND check for the duplicate-confirmDialog mistake (Section 2 rule 8).

### Sidebar nav tree
Pinned link: Dashboard. Four collapsible groups: **System**, **Company Setup** (10/10 live), **Master Data** (10/10 live), **Procurement** (20/20 live — Phase 4 complete). `tools/update_sidebar.py` converts one stub to a live link at a time — given an "old block" text file (the exact locked-stub markup) and a "new block" text file (the live `<a>` version), it finds-and-replaces across every `pages/*.html` where the old block appears. Used once per module (the new page itself gets the change baked in from the start via its own copy-and-edit); Modules 9+10 (Purchase Order/PO Approval) were converted together in ONE run since their two stub buttons sit back-to-back in the sidebar markup — every other module got its own individual run. Phase 5 (Sales) modules are still stubbed — the exact same tool and workflow applies there.

## 6. Shared `script.js` → `window.ERP` API (use these; don't reinvent)

```
$, $$, generateId, formatDateTime, formatRelativeTime, formatCurrency, formatCurrencyShort,
escapeHtml, showToast, openModal, closeModal, openConfirm, runBootSequence,
openTrainingDrawer, closeTrainingDrawer, getActiveSession, clearActiveSession,
requireSession, updateActiveSession, renderNotifications, getAllNotifications,
getSystemNotifications, getCustomNotifications, addCustomNotification,
updateCustomNotification, getReadNotificationIds, markNotificationRead,
getDismissedNotificationIds, dismissNotification, logSystemActivity,
getUnifiedActivityLog, clearUnifiedActivityLog, getPreferences, savePreferences,
applyDensityPreference, defaultPreferences, bindSessionTimeout, getThemePreference,
getEffectiveTheme, applyTheme, passwordLimits, panPattern, emailPattern, actorLabel, STORAGE_KEYS
```

`actorLabel(username)` is the newest addition (Section 4) — centralized once Purchase Order became a 5th duplicated local copy across data files. New modules should call `window.ERP.actorLabel()` directly rather than adding another local copy.

`getActiveSession()`'s `.username`/`.role`/`.fullName` fields are what every workflow module's `actorLabel(username)` live-resolves against via `ERP_UserRepository.findByUsername()` — now centralized as `window.ERP.actorLabel()` (Section 4/6). The one internal fix: the Escape-key handler now closes the topmost open modal, not the first in DOM order (Section 4).

## 7. Data-access layers (repository pattern — go through these, never touch `localStorage` raw)

Phases 1-3 (unchanged, see each file's own header): `ERP_DashboardData`, `ERP_HELP_FAQS`/`ERP_HELP_QUICK_LINKS`, `ERP_FinancialYearRepository`, `ERP_CurrencyRepository`, `ERP_GstRepository`, `ERP_BranchRepository`, `ERP_DepartmentRepository`, `ERP_CostCenterRepository`, `ERP_WarehouseRepository`, `ERP_CompanySettingsRepository`, `ERP_EmployeeRepository`, `ERP_VendorRepository`, `ERP_CustomerRepository`, `ERP_CategoryRepository`, `ERP_UnitRepository`, `ERP_ItemRepository`, `ERP_TaxRepository`, `ERP_HsnRepository`, `ERP_PaymentTermsRepository`, `ERP_BankRepository`.

Phase 4 so far:
- **`ERP_DepartmentNeedRepository`** (`data/department-need-data.js`) — `.statuses` (5), `.urgencyLevels` (4). `getAllForCompany` (newest-first — EVERY Phase 4 repository follows this chronological default, never alphabetical). `canEdit`/`canDelete` (Draft-only edit; Draft/Rejected/Cancelled delete). `isOverdue(need, todayISO?)`. `getApprovedForCompany` (FIFO — the hook #2 reads from). `findPossibleDuplicate` (soft). `actorLabel(username)` (local copy — see po-data.js's note on why it wasn't retrofitted). Full transition set: `submit/withdraw/approve/reject/reopen/cancel/remove`.
- **`ERP_PurchaseRequisitionRepository`** (`data/pr-data.js`) — `.statuses` (5, same vocabulary). `canEdit`/`canDelete` (same shape). `computeLineTotal`/`computeGrandTotal` (`{total, pricedCount, totalCount}` — this partial-aware shape recurs everywhere pricing exists). `getLinkedNeedIds`/`getAvailableNeedsForCompany` (exclusivity). `findPrForNeed` (retrofit hook). `findDuplicateLineItemByItem` (soft, child-collection-scoped). `addLineItem`/`updateLineItem`/`removeLineItem`. Full transition set including `approve`/`reject` (unwired in this module's own page — #3 calls them).
- **`ERP_RfqRepository`** (`data/rfq-data.js`) — `.statuses` (4 — Draft/Sent/Closed/Cancelled, NO approval gate). `getLinkedPrIds`/`getAvailablePrsForCompany` (exclusivity, same shape as above one hop up). `findRfqForPr` (retrofit hook). `recordVendorDecision`/`getSelectedVendorIds` (Vendor Selection's whole data model, added directly here). Transitions: `send/cancel/close` — no submit/approve/reject, this module doesn't need them.
- **`ERP_QuotationRepository`** (`data/quotation-data.js`) — `.statuses` (3 — Draft/Received/Cancelled). `hasQuotationForRfqAndVendor` (hard composite-key uniqueness). `computeQuotedTotal`. `recommend`/`unrecommend`/`findRecommendedForRfq` (Quotation Comparison's whole data model — `recommend()` auto-clears any other quotation's `isRecommended` on the same RFQ, enforcing at-most-one). Transitions: `markReceived/reviseToDraft/cancel/remove`.
- **`ERP_VendorEvaluationRepository`** (`data/vendor-evaluation-data.js`) — `.statuses` (2 — Draft/Final, no workflow). `.scoreCriteria` (array of `{key, label}` — loop over this, don't hardcode fields). `computeOverallScore`/`getAverageScoreForVendor` (the retrofit hook `vendors.js` reads from). No duplicate check, no exclusivity — multiple evaluations per vendor over time are the whole point. Transitions: `finalize/revise/remove`.
- **`ERP_PurchaseOrderRepository`** (`data/po-data.js`) — `.statuses` (8 — Draft/Submitted/Approved/Rejected/Sent/Confirmed/Vendor Declined/Cancelled, the richest lifecycle yet). `canEdit`/`canDelete` (same shape as PR). `computeLineTotal`/`computeGrandTotal` (same partial-aware shape). `getLinkedQuotationIds`/`getAvailableRecommendedQuotationsForCompany` (exclusivity, pool = `isRecommended` quotations). `findPoForQuotation` (retrofit hook — Quotation Receipt's Detail modal reads it). `actorLabel(username)` — now a one-line delegate to `window.ERP.actorLabel()`, not a local copy (see Section 4/6). No line-item CRUD (`addLineItem` etc.) — the whole `lineItems` array is replaced together via `update()`, same shape as `quotation-data.js`'s `lineQuotes`. Full transition set including `approve`/`reject` (unwired here — #10 calls them) and `confirm`/`declineByVendor` (unwired here too — #11 calls them; `confirm()` takes a third `vendorConfirmedDeliveryDate` argument, added once #11 shipped); `sendToVendor` IS wired from this module's own page.
- **`ERP_DeliveryScheduleRepository`** (`data/delivery-schedule-data.js`) — `.statuses` (3 — Draft/Finalized/Cancelled, no approval gate). `canEdit`/`canDelete` (Draft-only edit; Draft/Cancelled delete). `getLinkedPoIds`/`getAvailableConfirmedPosForCompany` (exclusivity, pool = Confirmed POs). `findScheduleForPo` (retrofit hook — Purchase Order's Detail modal reads it). No line-item CRUD — `scheduleLines[]` replaced together via `update()`. Transitions: `finalize/reopen/cancel/remove`.
- **`ERP_GoodsReceiptRepository`** (`data/goods-receipt-data.js`) — `.statuses` (3 — Draft/Logged/Cancelled, no approval gate). Same shape as Delivery Schedule one hop up: `getLinkedScheduleIds`/`getAvailableFinalizedSchedulesForCompany` (exclusivity, pool = Finalized schedules), `findReceiptForSchedule` (retrofit hook — Delivery Schedule's Detail modal reads it). No line-item CRUD — `receiptLines[]` replaced together via `update()`. Transitions: `logReceipt/reopen/cancel/remove`.
- **`ERP_GrnRepository`** (`data/grn-data.js`) — `.statuses` (3 — Draft/Posted/Cancelled). `computeLineValue`/`computeGrandTotal` (same partial-aware shape, priced this time). `getLinkedReceiptIds`/`getAvailableLoggedReceiptsForCompany` (exclusivity, pool = Logged receipts). `findGrnForReceipt` (retrofit hook — Goods Receipt's Detail modal reads it). Lines carry price sourced from the PO, not the receipt. Transitions: `post/reopen/cancel/remove`.
- **`ERP_QualityInspectionRepository`** (`data/quality-inspection-data.js`) — `.statuses` (3 — Draft/Completed/Cancelled). `computeTotalRejected`. `getLinkedGrnIds`/`getAvailablePostedGrnsForCompany` (exclusivity, pool = Posted GRNs). `findInspectionForGrn` (retrofit hook — GRN's Detail modal reads it). Transitions: `complete/reopen/cancel/remove`.
- **`ERP_InvoiceVerificationRepository`** (`data/invoice-verification-data.js`) — `.statuses` (3 — Draft/Verified/Cancelled). `computeLineValue`/`computeGrandTotal`. `computeMatchSummary` (informational two-way check vs the PO — NOT Three-Way Matching's own decision). `getLinkedPoIds`/`getAvailablePosForCompany` (exclusivity, pool = any non-Draft/non-Cancelled PO). `findVerificationForPo` (retrofit hook). Transitions: `verify/reopen/cancel/remove`.
- **`ERP_ThreeWayMatchingRepository`** (`data/three-way-matching-data.js`) — `.statuses` (4 — Draft/Approved for Payment/On Hold/Cancelled, a REAL decision gate). `resolveChain` (invoice→PO→schedule→receipt→GRN, live, nothing stored). `computeMatchLines` (pure, unstored per-line comparison — the pattern Purchase Closure later generalizes across the whole phase). `getLinkedInvoiceVerificationIds`/`getAvailableVerifiedInvoicesForCompany` (exclusivity, pool = Verified invoices). `findMatchForInvoice` (retrofit hook). Transitions: `approveForPayment/putOnHold/reopen/cancel/remove`.
- **`ERP_PaymentRequestRepository`** (`data/payment-request-data.js`) — `.statuses` (5 — Draft/Submitted/Approved/Rejected/Cancelled, the FULL approval gate, wired directly on this module's own page — no separate approval module in the roadmap). `computeDefaultAmount` (walks match→invoice for a sensible starting requestedAmount). `getLinkedMatchIds`/`getAvailableApprovedMatchesForCompany` (exclusivity, pool = Approved-for-Payment matches). `findRequestForMatch` (retrofit hook). Full transition set: `submit/withdraw/approve/reject/reopen/cancel/remove`.
- **`ERP_VendorPaymentRepository`** (`data/vendor-payment-data.js`) — `.statuses` (3 — Draft/Paid/Cancelled). `.paymentMethods` (fixed small vocabulary, looped into a `<select>`). `getLinkedRequestIds`/`getAvailableApprovedRequestsForCompany` (exclusivity, pool = Approved payment requests). `findPaymentForRequest` (retrofit hook). Transitions: `markPaid/reopen/cancel/remove`.
- **`ERP_PurchaseClosureRepository`** (`data/purchase-closure-data.js`) — `.statuses` (3 — Draft/Closed/Cancelled, no reopen from Closed). `.checklistStages` (8-item controlled array driving `computeCompletionChecklist`, which walks EVERY downstream repository live and is never gated on). `getLinkedPoIds`/`getAvailablePosForCompany` (exclusivity, pool = any non-Draft/non-Cancelled PO). `findClosureForPo` (retrofit hook — the LAST one this session adds, on Purchase Order's own Detail modal). Transitions: `close/cancel/remove`.

Phase 4 is complete — the pattern above (a small `data/<module>-data.js` scoped by `companyId`, OR no new file at all when a module is really a new PAGE + DECISION on an existing repository) held for all 20 modules. **7 of the 20 had no data file of their own**: PR Approval, Vendor Selection, Quotation Comparison, PO Approval, Vendor Confirmation, plus Payment Request's own approval gate living on its creation page rather than a sibling module.

Phase 5 so far:
- **`ERP_CustomerInquiryRepository`** (`data/customer-inquiry-data.js`) — `.statuses` (5 — New/In Progress/Converted/Lost/Cancelled, a pipeline progression, NOT an approval gate — see its own file header). `.sources` (7-item fixed vocabulary). `getAllForCompany` (newest-first, same chronological default). `canEdit`/`canDelete` (New-only edit; New/Lost/Cancelled delete). `isOverdue(inquiry, todayISO?)` (scoped to `expectedResponseDate`, New/In Progress only). `getConvertibleForCompany` (FIFO — the hook Quotation, #2, is expected to read from). `findPossibleDuplicate` (reuses Department Need's resolution #5 exactly — same customer + same wording + still open). `actorLabel(username)` — a one-line delegate to `window.ERP.actorLabel()` from day one, the first Phase 5 module with no local copy to begin with. Full transition set: `startFollowUp/returnToNew/convert/markLost/reopen/cancel/remove`.
- **`ERP_SalesQuotationRepository`** (`data/sales-quotation-data.js`) — named `SalesQuotation`/`-SQ-`, NOT `Quotation`/`-QT-` (Phase 4 #6, Quotation Receipt, already owns those). `.statuses` (5 — Draft/Sent/Accepted/Declined/Cancelled). `computeLineTotal`/`computeLineTax`/`computeGrandTotal` (the richer `{subtotal, taxTotal, total, pricedCount, totalCount}` shape — first document total to separate tax out). `getLinkedInquiryIds`/`getAvailableConvertedInquiriesForCompany` (exclusivity over Customer Inquiry's `getConvertibleForCompany()` pool — same live-scan shape as PR's need exclusivity). `findQuotationForInquiry` (the retrofit hook now wired into Customer Inquiry's own Detail modal). `getAcceptedForCompany` (FIFO — the hook Sales Order, #3, is expected to read from). `findDuplicateLineItemByItem` (reuses resolution #6, child-collection-scoped — no new resolution needed). `addLineItem`/`updateLineItem`/`removeLineItem` (PR's CRUD shape, not the whole-array-replace shape). Full transition set: `send/withdraw/markAccepted/markDeclined/cancel/remove` — deliberately NO `reopen()`/`revise()` for Declined (see its own file header for why that's not an oversight).
- **`ERP_SalesOrderRepository`** (`data/sales-order-data.js`) — `.statuses` (5 — reuses PR's exact Draft/Submitted/Approved/Rejected/Cancelled vocabulary, a deliberate divergence from PO's own 8-state shape — see its own file header). `computeLineTotal`/`computeLineTax`/`computeGrandTotal` (same shape as Quotation's, applied to the frozen copied lines). `getLinkedQuotationIds`/`getAvailableAcceptedQuotationsForCompany` (exclusivity over Quotation's `getAcceptedForCompany()` pool, ALSO filters out any quotation whose customer isn't currently Active — the credit-hold enforcement Customer Master was already built for). `findSalesOrderForQuotation` (the retrofit hook now wired into Quotation's own Detail modal). `getApprovedForCompany` (FIFO — the hook Delivery Challan, #5, is expected to read from, set by `approve()` which only Order Approval, #4, is meant to call). `approve`/`reject` exist here but are UNWIRED from this module's own page — the 8th "no data file of its own" instance is coming for Order Approval, which will read/write this repository exclusively. `reopen` (Rejected→Draft) IS wired on this module's own page (PR's own precedent: revising after rejection is the requester's move). `create(company, quotation, data)` copies `quotation.lineItems` verbatim — the one repository method in this whole catalog whose signature takes a full parent record, not just an id, because the copy needs to happen at that exact moment.

- **Order Approval (#4) confirmed the prediction from Module 3's own entry** — no data file of its own, the 8th "reads/writes an existing repository exclusively" instance in the whole codebase (PR Approval, Vendor Selection, Quotation Comparison, PO Approval, Vendor Confirmation, Payment Request's inline gate, then this one). It calls `ERP_SalesOrderRepository.approve()`/`.reject()` directly — nothing new to catalog here beyond confirming the shape held.
- **`ERP_DeliveryChallanRepository`** (`data/delivery-challan-data.js`) — `.statuses` (3 — `Draft/Issued/Cancelled`, Goods Receipt's own shape mirrored from the shipping side; terminal status deliberately NOT called `Dispatched`, since that's Module 7's own name later — see its own file header). `hasShortfall` (plain, non-blocking derived flag). `getLinkedSalesOrderIds`/`getAvailableApprovedSalesOrdersForCompany` (exclusivity over Sales Order's `getApprovedForCompany()` pool). `findChallanForSalesOrder` (the retrofit hook now wired into Sales Order's own Detail modal). `getIssuedForCompany` (FIFO — the hook Tax Invoice, #6, is expected to read from). `create(company, salesOrder, data)` copies `salesOrder.lineItems` into `challanLines[]`, dropping `unitPrice`/`taxId` entirely and adding `orderedQuantity` (frozen) + `deliveredQuantity` (the editable starting point) — another parent-record-signature method, same reasoning as Sales Order's own `create()`.
- **`ERP_TaxInvoiceRepository`** (`data/tax-invoice-data.js`) — `.statuses` (3 — `Draft/Raised/Cancelled`, GRN's own shape; terminal status `Raised`, deliberately neither GRN's "Posted" nor Delivery Challan's own "Issued"). `buildInvoiceLines(challan, salesOrder)` — the codebase's first genuine two-hop JOIN: matches each challan line to its sales-order counterpart BY LINE ID (preserved unbroken since Quotation), combining shipped `deliveredQuantity` with agreed `unitPrice`/`taxId`, and resolves each line's `hsnCodeId` from its linked item. `computeLineTotal`/`computeLineTax`/`computeGrandTotal` (same richer shape as Quotation's/Sales Order's own). `getLinkedChallanIds`/`getAvailableIssuedChallansForCompany` (exclusivity over Delivery Challan's `getIssuedForCompany()` pool). `findInvoiceForChallan` (the retrofit hook now wired into Delivery Challan's own Detail modal). `getRaisedForCompany` (FIFO — the hook later Sales modules are expected to read from). `create(company, challan, salesOrder, data)` calls `buildInvoiceLines()` once — a third parent-record-signature method, continuing the same pattern Sales Order and Delivery Challan both established.
- **`ERP_DispatchRepository`** (`data/dispatch-data.js`) — `.statuses` (3 — `Draft/Dispatched/Cancelled`, no approval gate). `.transportModes` (5-item fixed vocabulary — Road/Rail/Air/Sea/Courier). HEADER-ONLY — no line-item array, no `computeLineTotal`/`computeGrandTotal` at all, the first Phase 5 repository without one. `getLinkedInvoiceIds`/`getAvailableRaisedInvoicesForCompany` (exclusivity over Tax Invoice's `getRaisedForCompany()` pool — resolved to build from the INVOICE, not the challan, after weighing both against the roadmap's own ordering and real GST transport practice — see its own file header for the full reasoning). `findDispatchForInvoice` (the retrofit hook now wired into Tax Invoice's own Detail modal — Tax Invoice's first of what will be three independent downstream branches). `getDispatchedForCompany` (FIFO — the hook Sales Close, #10, is expected to read from). Transitions: `markDispatched/reopen/cancel/remove` — no `submit`/`approve`/`reject` at all, the simplest transition set in Phase 5 so far.
- **`ERP_PaymentCollectionRepository`** (`data/payment-collection-data.js`) — `.statuses` (5 — `Open/In Progress/Collected/Written Off/Cancelled`, Customer Inquiry's own pipeline shape reused almost field-for-field, NOT Vendor Payment's shape Section 10 predicted — see its own file header for the full reasoning). `.collectionMethods` (6-item fixed vocabulary — Phone Call/Email/SMS/Site Visit/Legal Notice/Other). **NO `getLinkedXIds`/`getAvailableXForCompany` exclusivity pair at all** — the first Phase 5 repository to skip it entirely; `getAllForInvoice` is a plain foreign-key read instead, since multiple follow-ups per invoice are the whole point (reuses Vendor Evaluation's own "no duplicate check" resolution, not a new one). `getLatestFollowUpForInvoice` is the retrofit hook — an AGGREGATE (most recent of `getAllForInvoice()`'s results), not a single-record link, mirroring Vendor Evaluation's own `getAverageScoreForVendor()` retrofit shape into Vendor Master rather than any exclusive module's shape. Transitions: `startFollowUp/returnToOpen/markCollected/markWrittenOff/reopen/cancel/remove` — a near-exact rename of Customer Inquiry's own `startFollowUp/returnToNew/convert/markLost/reopen/cancel/remove`, including the same `assignedToEmployeeId`-required-before-`startFollowUp()` gate (validated by the calling page, not the repository).
- **`ERP_ReceiptRepository`** (`data/receipt-data.js`) — `.statuses` (3 — `Draft/Received/Cancelled`, THE MIRROR HELD THIS TIME, confirming Vendor Payment's own shape rather than breaking from it — see its own file header for why that's not a contradiction of Payment Collection's own break one module ago). `.paymentMethods` (its own 5-item vocabulary — Cash/Cheque/Bank Transfer/UPI/Online Payment — deliberately NOT a copy of Vendor Payment's 4-item outbound list). HEADER-ONLY, exclusive again over Tax Invoice (`getLinkedInvoiceIds`/`getAvailableRaisedInvoicesForCompany`, the same pool Dispatch independently reads from). `findReceiptForInvoice` (the retrofit hook — a genuine single link into Tax Invoice's Detail modal, unlike Payment Collection's own aggregate one module ago, because this module IS exclusive). `getReceivedForCompany` (FIFO — the hook Sales Close, #10, is expected to read from). Bank Master used in a REVERSED direction from Payment Request/Vendor Payment: `ERP_BankRepository.getActiveForCompany()`/`getDefault()` resolve the COMPANY's own account, chosen, not a linked party's account read-only. Transitions: `markReceived/reopen/cancel/remove` — Vendor Payment's own transition set, unchanged.

- **`ERP_SalesCloseRepository`** (`data/sales-close-data.js`) — THE FINAL REPOSITORY OF THE PROJECT. `.statuses` (3 — `Draft/Closed/Cancelled`, Purchase Closure's own simplest-lifecycle shape, unchanged). `.checklistStages` (5 stages, one optional — Delivery Challan/Tax Invoice/Dispatch/Payment Collection[optional]/Receipt — smaller than Purchase Closure's own 8/1 because Phase 5 has fewer total downstream modules). `computeCompletionChecklist(companyId, salesOrder)` — mirrors Purchase Closure's OVERALL SHAPE (pure, unstored, recomputed on every call) but diverges on MECHANISM: linear only as far as Tax Invoice (Sales Order → Delivery Challan via `salesOrderId` → Tax Invoice via `challanId`), then BRANCHES three ways off that same invoice (Dispatch/Payment Collection/Receipt all read `linkedInvoiceId` independently, not off each other — the hub shape Dispatch's own header first named). Payment Collection's own stage status can't reuse the single-record `record.status === doneStatus` check every other stage uses (it has no exclusivity — Section 9's own entry on this); computed instead from `getAllForInvoice()`'s full result set. `getLinkedSalesOrderIds`/`getAvailableSalesOrdersForCompany` (exclusivity over Sales Order, pool = every non-Draft/non-Cancelled order not already claimed, deliberately not narrowed to "fully collected" ones). `findClosureForSalesOrder` — THE LAST RETROFIT HOOK THIS PROJECT ADDS, wired into Sales Order's own Detail modal. Transitions: `close/cancel/remove` — no `reopen()` from Closed at all, the same deliberate omission Purchase Closure's own file made.

**Phase 5 is now complete — 10/10 modules, matching Phase 4's own 20/20. This project, as originally scoped across two phases (Procurement and Sales), is now fully built, retrofitted, and validated end to end.** See Section 10 for the full phase-complete summary — what the Procurement/Sales mirror confirmed overall, which predictions held and which didn't across all 10 modules, and the project's own closing state.

## 8. Design system (`style.css`)

CSS custom properties in `:root`; dark-mode overrides in `body[data-theme="dark"]`. **Never hardcode a color** — always `var(--color-*)`. Key tokens: `--color-bg`, `--color-card`, `--color-border(-strong)`, `--color-text(-secondary/-muted)`, `--color-surface-muted`, `--color-accent(-hover/-tint)`, `--color-success/warning/danger(-tint)`, `--color-warning-text`, `--radius(-sm/-lg/-pill)`, `--shadow-soft/elevated/fab`, `--font-sans/-mono`.

Reusable classes — reuse, don't recreate: `.btn` (`--primary/--ghost/--danger/--danger-outline/--block/--sm`), `.status-badge` (`--success/--warning/--danger/--info/--neutral`), `.kpi-card__icon` (`--accent/--success/--warning/--danger` ONLY, no `--info`), `.chip`/`.chip-group`, `.data-table` (+ `.data-table--compact-inputs` for inline row editing, `.row-detail-btn`, `.link-btn`), `.pagination`/`.page-btn`, `.modal-overlay`/`.modal` (`--sm/--wide`), `.checkbox-field` (single boolean toggle) vs. `.checkbox-list` (scrollable multi-select container of several `.checkbox-field` rows), `.toast`, `.profile-card`, `.kpi-grid`/`.kpi-card`, `.form-field`/`.field-error`/`.field-hint` (`--warning`)/`.input-wrap`/`.select-field`/`.textarea-field`, `.wizard-field-row` (2-col form grid), `.detail-list`, `.card-header-row`/`.card-toolbar`, `.activity-list`/`.activity-item`, `.sidebar-link--locked`/`.sidebar-link__soon`/`.sidebar-link__main` (groups a locked link's icon+label — added Phase 5 #1, see Section 4).

Before using ANY class you haven't used yourself in this session, grep `style.css` to confirm it exists and check which modifiers it actually supports — `.kpi-card__icon--info` looked like it should exist (since `.status-badge--info` does) and didn't.

## 9. Established UX conventions (read before building anything)

**Every list:** search + filter chips + sort toggle (chronological default for transactional Phase 4 modules, newest-first) + pagination (5-8/page) + Export CSV + Print.
**Every form:** required + max/min validation, a duplicate check (see below — "none applicable" is a valid, documented resolution now), Save + Cancel, a confirm dialog before anything consequential, auto-generated codes.
**Multi-state lifecycle records:** one View + one contextual quick-action in the table row; everything else in the Detail modal's footer, genuinely different PER STATUS (not just relabeled).

**The duplicate-check lesson ended the phase with EIGHT numbered resolutions** — no module after Purchase Order needed a ninth; GRN, Quality Inspection, and Invoice Verification all landed on an existing resolution (#8's "not applicable," for the same derived-array reason, EXCEPT Invoice Verification, whose own lines genuinely ARE free-form entered — see below). Pick the one that actually fits, don't default to the first one you remember:
1. Hard-blocked name (Departments/Cost Centers/Warehouses/Category Master)
2. Name skipped for a different hard field (Employee Master's `workEmail`)
3. Soft-name + hard-other-field (Vendor/Customer Master)
4. Both fields hard-blocked independently (Unit Master's name AND symbol)
5. Non-blocking soft NUDGE (Department Need — a transactional duplicate isn't actually forbidden)
6. Duplicate check scoped to a PARENT's own CHILD COLLECTION (Purchase Requisition — same item twice in one PR's own lines)
7. **Hard uniqueness on a COMPOSITE (parent, parent) key** (Quotation Receipt — at most one quotation per (RFQ, vendor) pair)
8. **Explicitly NOT APPLICABLE, documented as a deliberate decision** (Vendor Evaluation; every derived-line-array module: PO/Delivery Schedule/Goods Receipt/GRN/Quality Inspection; and every header-only document with no line collection at all: Payment Request/Vendor Payment/Dispatch — no free-form entry point to have a duplicate IN, whether because the array is derived-not-added-to or because there's no array at all)

**Invoice Verification is the one exception worth flagging explicitly**: its `invoiceLines[]` ARE typed in by a person (not copied from a parent), yet it still has no duplicate check — because there's exactly one line per PO line item by construction (the form renders one row per PO line, no add/remove), so there's structurally nothing to duplicate even though the VALUES are free-form. A fourth variant of "not applicable," worth remembering if a future module has typed values but a fixed row structure.

**Phase 5 #1 (Customer Inquiry) reused resolution #5 exactly, unchanged — no 9th resolution needed.** Same customer + same wording (trimmed/case-folded) + still open (New/In Progress) → soft nudge, never a block, for the identical reason DN uses it: two genuinely separate inquiries about the same thing (a callback, a second channel) are completely normal. Confirms Section 9's own catalog carries into Phase 5 as-is rather than needing its own parallel version — check here before reaching for a 9th.

**Phase 5 #2 (Quotation) reused resolution #6 exactly (child-collection-scoped soft nudge)** — the same item added as a second line within one quotation, nudged not blocked, identical shape to PR's own line-item duplicate check. Two Phase 5 modules in, zero new resolutions needed — the catalog built across all of Phase 4 is holding up as genuinely reusable, not just superficially similar.

**Check the roadmap's module name against EVERY existing global identifier before naming a new repository — Phase 5 #2 (Quotation) is why this matters.** The Sales roadmap names a module "Quotation," but Phase 4 #6 (Quotation Receipt) already owns `ERP_QuotationRepository`/`ERP_QUOTATION_KEY`/`ERP_QUOTATION_STATUSES` for the opposite-direction document (a vendor's price IN, not this company's price OUT). Reusing those names would silently shadow one repository with the other. The fix was a code-level-only disambiguation: `ERP_SalesQuotationRepository`, `-SQ-` codes (not `-QT-`), while the sidebar label and training content still just say "Quotation" to match the roadmap — only the identifiers a person doesn't see needed to change. Sales Order (#3) turned out not to collide with anything (Purchase Order already disambiguates by direction in its own name) — worth a deliberate check on every future module regardless, not just an assumption that Sales and Procurement's vocabularies won't overlap.

**Check earlier phases' master data for hooks already built anticipating a later phase — Phase 5 #3 (Sales Order) is why this matters.** `data/customer-data.js` (Phase 3) already exposed `getCreditUsage()`/`getCreditUtilizationBand()`, and its own `setStatus()` comment said outright: "Blocked is a credit hold... can't take new orders once Sales exists." Nothing needed inventing — Sales Order's own "only Active customers' quotations are pickable" filter just kept a promise Customer Master had already made. Before adding a new field or new logic to solve what looks like a new problem, grep the relevant Phase 1-4 master data file's own header and comments first; an earlier module may have already anticipated exactly this and left the hook waiting.

**When a module "should" mirror PO's two-party 8-state shape, check who's actually missing a decision first — Phase 5 #3 (Sales Order) is why this matters.** PO's complexity exists because TWO separate real-world parties each need their own say (internal approval AND separate vendor confirmation). Sales Order looked at first glance like it should mirror that (it's the "commitment" document, same as PO), but the customer already committed by Accepting the quotation — there's no second external party left to confirm. What was actually missing was a single INTERNAL decision, which is exactly PR's shape, not PO's. The lesson generalizes: don't pattern-match a new module to whichever earlier module SOUNDS most similar in name or role; identify which real-world parties still need to weigh in, then pick the shape that has exactly that many decision points, no more.

**When a module's own roadmap has a LATER module with an obvious-sounding name, don't let that word slip into an earlier module's status vocabulary — Phase 5 #5 (Delivery Challan) is why this matters.** The natural word for "this shipment is ready to go" is "Dispatched" — but Dispatch is Module 7's own name later in this same roadmap. Reusing it as Delivery Challan's terminal status would make activity feeds and status-history displays read like the same event happened under two different modules. "Issued" was picked instead — a real, natural word for what a delivery challan actually does in practice, not a forced substitute. The general check: before finalizing a status vocabulary, scan the REST of the roadmap's module names, not just the modules already built, the same way this section's own repository-naming-collision check (two entries up) already covers modules already shipped.

**A document can deliberately carry LESS than its parent, not just copy everything forward — Phase 5 #5 (Delivery Challan) is why this matters.** Every earlier "copy the parent's lines" module (PO from Quotation Receipt, Sales Order from Quotation) copied pricing forward along with quantity, because pricing was still relevant at that step. Delivery Challan is the first to deliberately DROP fields its parent had (`unitPrice`/`taxId`) — not an oversight, but a real scope line: this document proves what shipped, Tax Invoice bills for it. When building a "copy from parent" module, check what the parent carries that this module's own real-world job simply doesn't need, rather than defaulting to copying the whole shape.

**When a document's own immediate parent doesn't carry a field it needs, check whether the chain has quietly preserved a matching key you can JOIN on before defaulting to a chain-walk — Phase 5 #6 (Tax Invoice) is why this matters.** GRN set the precedent for walking past a price-less parent to a distant ancestor's own pricing (three hops: receipt → schedule → PO). Tax Invoice needed the same kind of fix — Delivery Challan deliberately carries no price — but the actual solution turned out simpler: every line `id` in this Sales chain has survived unbroken since Quotation (Quotation's own id → Sales Order's copy → Delivery Challan's copy), so `buildInvoiceLines()` just matches challan lines to sales-order lines BY THAT SHARED ID and combines the two, no walking required. Before writing a multi-hop chain-walk, check whether an id has already been quietly carried through every intermediate copy — a same-session precedent (Sales Order/Delivery Challan's own `create()` both spread `{ ...l }` or explicit `id: l.id`) may have already done the hard part.

**Customer Master (Phase 3) keeps turning out to have already anticipated Sales — Tax Invoice's `creditPeriodDays` is the second such find, not the first.** Sales Order discovered `getCreditUsage()`/`getCreditUtilizationBand()` sitting unused; Tax Invoice found `creditPeriodDays` sitting unused right next to them, both on the same customer record, both written back in Phase 3 with no transactional module to consume them until now. This isn't a coincidence worth re-discovering by accident each time — before adding ANY new field to solve a Sales-side problem, check `data/customer-data.js` specifically first; it may already carry what's needed.

**A bug pattern caught once should be checked for proactively on every subsequent module of the same shape, not just fixed where it was found.** Delivery Challan shipped with a real bug: its "link the parent record" picker gets `.disabled = true` in Edit mode (since the link is locked once created) but was never explicitly re-enabled when Add mode opens next — a shared DOM element's disabled state doesn't reset itself between modal opens. Caught and fixed there, then applied proactively to Tax Invoice's own identical picker before it ever shipped with the same bug. Any future module with a "locked-once-created, picker disabled in Edit" field should get this same explicit re-enable in its own Add-mode function from the start.

**"The ordering is a real hint, not an accident" — confirmed, not just asserted, by Phase 5 #7 (Dispatch).** Section 10 flagged two plausible parents ahead of time (Tax Invoice vs. Delivery Challan) and predicted the roadmap's own sequencing (Tax Invoice immediately before Dispatch) pointed at the right answer. It did — and real-world GST transport practice independently agreed (an e-way bill/lorry receipt references the invoice's own number, not the challan's), so the two reasons converged rather than one overriding the other. When a "built from" ambiguity like this comes up again, check BOTH the roadmap's own sequencing and the real-world document reference chain — if they agree, that's real confidence, not a coincidence to double-check away.

**Header-only documents are a FOURTH variant of duplicate-check resolution #8, alongside derived-line-array modules and Invoice Verification's fixed-row-structure case.** Payment Request and Vendor Payment (Phase 4) were already header-only with no duplicate check discussed for either; Dispatch (Phase 5 #7) is the first Sales module to confirm the same reasoning explicitly: no line-item collection AT ALL, not even a derived/uneditable one, means there is structurally nothing to duplicate — the "not applicable" resolution covers this case even more directly than the derived-array one. Worth naming outright so a future header-only module doesn't go looking for a fifth resolution that doesn't need to exist.

**The "hub" shape — one parent record with several INDEPENDENT downstream branches that never chain through each other — re-emerged at Tax Invoice, and is worth naming as its own recognized pattern, not a one-off.** Purchase Order was the first hub (Vendor Confirmation, Delivery Schedule's own chain, Invoice Verification's own chain, and Purchase Closure all read from it, accumulating SIX retrofit rows on its own Detail modal by the end of Phase 4). Tax Invoice is the second: Dispatch, Payment Collection, and Receipt are all expected to build FROM it directly rather than relaying through one another, because logistics fulfillment and financial collection are genuinely separate real-world concerns that both simply start from "the invoice is now final." The tell for recognizing a hub ahead of time: does the roadmap have MULTIPLE later modules whose real-world job could plausibly reference the same upstream document, without any of them logically depending on each other's own output first? If so, expect several independent retrofit rows to land on that one Detail modal over time, not a single linear chain.

**A Section 10 prediction is a hypothesis to weigh, not a default to fall back on when nothing better comes to mind — Payment Collection (Phase 5, #8) is the first module to actually test that discipline by disagreeing with one.** Section 10 explicitly predicted Payment Collection would "likely mirror Vendor Payment's shape, reversed." That prediction was taken seriously, weighed against the real-world shape of an AR collections process, and set aside in favor of Customer Inquiry's own pipeline shape instead — a genuinely different, better-reasoned answer than the one written down ahead of time. This is the system working as intended, not a deviation from it: Section 10's predictions exist to give the next session a starting hypothesis worth taking seriously, not an answer to rubber-stamp. When a future module's own real-world shape points somewhere Section 10 didn't anticipate, that's a signal to follow the reasoning, document why the prediction didn't hold, and update Section 10's own next-module note accordingly — exactly what happened here.

**Not every module needs a `getLinkedXIds()`/`getAvailableXForCompany()` exclusivity pair — Payment Collection is the first Phase 5 repository to skip it entirely, and the tell for when to skip it is worth naming.** Every module from Delivery Schedule (Phase 4) through Dispatch (Phase 5, #7) claimed its upstream parent exclusively, because in each of those cases the real-world parent record genuinely gets "used up" by exactly one downstream action (a PO gets one delivery schedule, an invoice gets one dispatch). The tell for when exclusivity does NOT apply: does the real-world process allow — or even expect — the SAME upstream record to be the subject of multiple independent downstream actions over time, none of which supersede or cancel the others? A collections effort against an invoice is exactly this case (multiple follow-up touches, each its own record); Vendor Evaluation (Phase 4, #8) was the first instance of this same shape, and Payment Collection is the second. When this applies, skip the exclusivity pair entirely — a plain foreign-key read (`getAllForInvoice()`-style) and an un-filtered picker are the honest shape, not a workaround.

**Resolution #9: a purely sequential, system-generated identifier needs no duplicate check at all — Journal Entry's `entryNumber` is the first field in this project that isn't even a candidate for one.** Every earlier resolution (1-8) was about a value a PERSON types or picks that might collide with another person's choice. `entryNumber` (`JE-00001`...) is never typed — it's assigned by `nextEntryNumber()` the same instant the record is created, so "could two records end up with the same value" isn't a validation question, it's a counter-correctness question, categorically different from resolutions 1-8's real subject. Worth naming as its own numbered case rather than folding it into #8's "not applicable" — #8 covers fields that COULD have collided but structurally don't get a chance to; this covers a field that was never a candidate for user-driven collision in the first place.

**A module can owe a retrofit to code that was already shipped, not just receive retrofits from later modules — Journal Entry paying back Chart of Accounts is the first instance of this direction in the project.** Every retrofit so far has flowed the same way: an EARLIER module ships first, then a LATER module reaches backward to add a hook on the earlier one's Detail modal or a check on its own delete guard (PO's six retrofit rows, Tax Invoice's three, GRN's three-hop chain-walk). Chart of Accounts' own file header made this debt explicit ahead of time — "whoever builds Journal Entry next needs to add that guard on ITS side" — rather than leaving a future session to rediscover the gap by accident. When Journal Entry shipped, it paid that debt back immediately: `hasPostedEntriesForAccount()` lives in the NEW module (the correct owner, per the standing "referencing module owns the check" convention), but `chart-of-accounts-data.js`'s own `remove()`/`canToggleGroup()` needed a real edit too (a typeof-guarded call out), and `chart-of-accounts.html` needed a new script tag so the guard is actually live where the delete button is — not just theoretically available from journal-entry.html. The general lesson: when a module's own header flags a specific TODO for "whoever builds X next," treat that as a checklist item for X's own session, not a suggestion — and expect it to mean editing files outside the new module's own folder, not just inside it.

**A single-purpose sandbox test with a fresh, isolated dataset can pass cleanly while a real bug sits right next to it — Balance Sheet's own verification is the case study.** Every report module before Balance Sheet (General Ledger, Trial Balance, Profit & Loss) shipped with its own Node-sandbox test, and every one of them passed. None of them caught the `toDate` ordering bug documented in this file's own general-ledger-data.js and Section 3 entries, because none of them happened to construct a dataset where real postings existed AFTER the date being filtered to — each test's dataset was built fresh, just large enough to exercise the feature being tested in isolation, and then discarded. Balance Sheet's own test suite did something different almost by necessity, not by deliberate strategy at the time: because a balance sheet has to reflect an evolving set of books, its five scenarios were built as one GROWING dataset across the same in-memory entries array (Test 1's postings still present for Test 2, Test 2's for Test 3, and so on), and Test 3 deliberately asked for a snapshot from BEFORE Test 2's postings existed — which is exactly the shape needed to expose a `toDate` bug in the function both this module and two earlier ones all share. The lesson to carry forward: for any future report or aggregation module that reads data other modules already wrote, prefer growing one realistic, evolving dataset across the test's own scenarios over resetting to a fresh minimal dataset per scenario — the growing version is more work to construct but is what actually exercises "this is being asked about a moment in a longer history," which single-purpose fresh datasets structurally cannot do. Also worth naming: a claim like "module X was never affected by this bug" was verified with its own explicit test here (Profit & Loss, confirmed to only ever read `rows` and never `closingBalance`) rather than asserted from reading the code once — the same "verify, don't assert" standard the bug-hunting itself was held to.

**A field can be missing from a module not because a real decision excluded it, but because the module simply predates the reason it would have needed it — and the only way to catch that is a LATER module actually needing the missing thing symmetrically.** Receipt (Phase 5) carries `bankId`; Vendor Payment (Phase 4, built before Bank Master's own header even existed as a cross-reference target for anything) did not, even though Bank Master itself (Phase 3) chronologically predates both. Neither this document nor Vendor Payment's own file header ever flagged this as a deliberate simplification — because it wasn't one; it was simply never needed until Bank Reconciliation (Phase 6) came along wanting to treat "money out" and "money in" symmetrically. This is a different category of gap from the Chart-of-Accounts/Journal-Entry TODO (which was NAMED explicitly, ahead of time, as a debt owed to a specific future module) or the General-Ledger `toDate` bug (a real logic error, always wrong, just never exercised) — this is a field that was simply never wrong for its OWN module's purposes, only revealed as incomplete once a THIRD module needed to read both sibling modules the same way. The general lesson: when a new module needs to treat two or more EARLIER, already-shipped modules symmetrically (same kind of field, same kind of lookup, same kind of filter), and one of them already has what's needed while another doesn't, don't build around the gap — that's the signal to go check whether the missing side is a real, documented, deliberate difference or just an oversight nobody had a reason to notice yet. Here it was the latter, fixed directly in the older module rather than worked around in the new one.

**Closing note on Phase 6's 9 numbered modules: "mirror the sibling module, but verify the mirror rather than assume it" paid off in both directions, not just one.** AP Aging's own header predicted AR Aging might turn out simpler and said so explicitly rather than waiting to find out. It was right — by a full four hops — and that asymmetry turned out to be the honest, correct result of Procurement and Sales genuinely having different document shapes (Payment Request denormalizes nothing; Tax Invoice denormalizes both `customerId` and `dueDate` directly), not an inconsistency needing a fix the way the Vendor Payment `bankId` gap did two modules earlier. That's the real point worth carrying forward: checking a symmetry assumption doesn't always surface a bug to fix — sometimes it confirms a genuine, defensible difference, and the value is in HAVING CHECKED and documented which case it turned out to be, rather than either blindly copying one module's shape onto the other or blindly assuming they'd diverge. Across this session's four cross-module checks — Chart of Accounts' named TODO paid back by Journal Entry, General Ledger's `toDate` bug caught by Balance Sheet's growing-dataset test, Vendor Payment's missing `bankId` caught by Bank Reconciliation, and AP/AR Aging's confirmed real asymmetry — two turned out to be real bugs, one was a real gap, and one was a real (and fine) difference. All four got the same treatment: checked directly against the actual code or a sandbox test, never assumed, and the actual finding written down either way.

**A line-range splice into a copied page template needs the SAME post-edit structural audit a `str_replace` edit gets — copying Chart of Accounts to build Journal Entry and General Ledger dropped `.app-shell`'s own closing `</div>` and the training-fab button from BOTH new pages, and `tools/validate.py` caught neither.** The pattern that caused it: rather than a scoped `str_replace`, the new-page-from-template workflow sliced the file at a line number (everything from `<h3 id="trainingDrawerTitle">` onward) and spliced in new content ending in `</html>` — which silently assumed the ORIGINAL tail being replaced was self-contained, when it actually contained the tail end of TWO still-open elements from further up the file (`.app-shell`'s wrapper div, and the training-fab button that sits between `.app-shell` and the training drawer). `tools/validate.py`'s structural checks didn't catch it because they check things like brace-balance and script-tag pairing, not full DOM nesting — the exact "validate.py has blind spots, do a real pass" warning Step 0 gave for CSS classes turns out to apply here too. What actually caught it: a manual `<div>`/`</div>` count comparison against the already-shipped, known-good `chart-of-accounts.html`, which is what surfaced the same off-by-one bug already sitting live in `journal-entry.html` from the previous session — it had shipped with this exact bug and passed every check at the time. The general lesson: whenever a new page is built by slicing/splicing a copied template rather than a scoped `str_replace`, diff the resulting file's tag-count "shape" (div counts, and the presence of every shared trailing element — footer, training-fab, training-drawer aside) against the known-good template it was copied from, not just against `tools/validate.py`'s narrower checks — and if the bug is found, check whether it also shipped in an earlier page built the same way, the way it had here.

**PHASE 6 COMPLETE — the retrofit pass confirms a design principle worth stating explicitly now that it's been tested under real pressure: keep a cross-cutting concern in ITS OWN file, reached by a typeof-guarded call from each affected module, rather than editing every affected module to know about the concern directly.** Five already-shipped, already-documented data files (grn/invoice-verification/vendor-payment/tax-invoice/receipt-data.js) needed to gain a real accounting side effect. The alternative to `gl-posting-data.js` existing as its own file would have been five separate edits, each one tangling a business module's own domain logic (what does "receiving goods" mean) with an unrelated concern (what does receiving goods mean FOR THE BOOKS) it was never designed around — and each edit would have needed the SAME typeof-guard, the SAME "did GL Mapping resolve" check, duplicated five times with five chances to drift out of sync. One file instead: each business module stayed completely untouched, each PAGE controller gained one small, uniform addition (call the posting function, show its result), and the actual accounting logic — the part genuinely worth getting right — lives in exactly one place to review, test, and extend. This is the same instinct behind `window.ERP.actorLabel()` staying centralized for two full phases (Section 9's own "live-resolve, fall back gracefully" entry) and behind `computeCompletionChecklist()` generalizing to eight downstream modules without a rewrite — but this is the first time the concern being centralized was a SIDE EFFECT (creating new records in another module entirely) rather than a read-only lookup or computation, and the same principle held without needing a new shape invented for it. **Worth carrying into Phase 7 and beyond**: when a new module needs to affect several already-shipped modules the same way, reach for one new orchestration file before reaching for N edits to N existing ones.

**Disagreeing with a Section 10 prediction one module doesn't mean the NEXT module should disagree too — Receipt (Phase 5, #9) confirms the discipline is about testing each module on its own terms, not developing a house habit of skepticism.** Payment Collection rejected its own predicted mirror one module ago; Receipt, right after it, confirms Vendor Payment's shape cleanly, for a genuinely different reason (a single factual event vs. a multi-touch process — see receipt-data.js's own header). Both outcomes came from the exact same discipline applied honestly each time — the point was never "assume the mirror is wrong," only "don't assume it's right without checking." A near-miss naming collision came up in the same module and is worth naming as its own small pattern: `Received` (Receipt's terminal status) and `Collected` (Payment Collection's) describe two DIFFERENT facts about the same invoice that could easily read as synonyms in casual conversation. Resolving that required recognizing the near-miss explicitly and picking distinct words on purpose — the same discipline Dispatch/Delivery Challan used for `Dispatched` vs. `Issued`, now confirmed as a recurring category of naming check (not just "check against every existing status string," but "check against every existing status string that describes something CONCEPTUALLY similar to what you're about to name," since those are the pairs a person skimming the app is most likely to actually confuse).

**A mirror can hold at one LEVEL of a module's design while breaking at another — Sales Close (Phase 5, #10, the final module) is the cleanest example of this in the whole project, and worth naming as its own distinct case from either "the mirror held" or "the mirror broke."** Every earlier data point in this catalog treated a mirror as basically holding (Order Approval, Receipt) or basically breaking (Sales Order's lifecycle, Payment Collection's whole shape) as a single yes/no per module. Sales Close doesn't fit that binary: its OVERALL SHAPE confirms Purchase Closure's own precedent almost exactly (built from the root record, pure unstored checklist, simplest lifecycle, informational-not-a-gate philosophy) — genuinely nothing to second-guess there. But its WALK MECHANISM — the actual code shape that produces the checklist — breaks completely, because Purchase Closure's chain was a clean single-file linear relay and Sales Close's own chain branches into three independent parts partway through (the Tax Invoice hub, first named at Dispatch). Copying Purchase Closure's chain-walk code unchanged would have LOOKED like a successful mirror (same function name, same return shape, same call sites) while silently producing wrong data forever, since a `recordFor` object built by reading each stage from the previous stage's own id simply has no "previous stage" to read Dispatch, Payment Collection, or Receipt from — they all read from Tax Invoice directly. The lesson: when a mirror candidate is a strong match at the conceptual/architectural level, don't let that confidence carry over unchecked into the IMPLEMENTATION level — verify the actual data shape (linear chain vs. branching hub, single record vs. multiple, one FK vs. several) independently of whether the overall design pattern fits, because those are genuinely separate questions with genuinely separate answers.

**PHASE 5 COMPLETE — 10/10 MODULES, MATCHING PHASE 4's OWN 20/20. THE PROJECT AS ORIGINALLY SCOPED IS NOW FULLY BUILT.** Final tally on the Procurement/Sales mirror across all 10 modules: it held cleanly at Order Approval (an exact match, the 8th "no data file of its own" instance) and at Receipt (Vendor Payment's shape, confirmed); it held at the CONCEPTUAL level but broke at the MECHANICAL one at Sales Close (this entry, just above); it broke on a specific dimension while holding on others at Quotation (line-pricing shape held, CRUD-vs-frozen split was new), Sales Order (commitment concept held, lifecycle cardinality broke), Delivery Challan (operational-record shape held, WHAT gets copied broke), and Tax Invoice (concept held, JOIN mechanism improved); it broke almost entirely at Customer Inquiry (a new 7th workflow shape) and Payment Collection (rejected its own Section 10 prediction outright, reused Customer Inquiry's shape instead); and Dispatch needed its own reasoned tie-break between two live candidates rather than a single obvious mirror. **Ten modules, and not one of them was safe to build by pattern-matching alone — each one earned its own file-header reasoning, and that reasoning is now preserved for whoever reads this next.** If a Phase 6 is ever added to this project, start by re-reading this whole section before writing a single line — it's the accumulated cost of getting these two phases right, and every dollar of it is still spendable.

**The "live-resolve, fall back gracefully" helper shape** — `actorLabel(username)` stayed centralized at `window.ERP.actorLabel()` for the rest of the phase; every module from PO Approval through Purchase Closure called it as a one-line repository delegate, never a new local copy. **This held into Phase 5**: Customer Inquiry is the first module with no "before centralization" history at all — its `actorLabel()` was a one-line delegate from the moment the file was created, nothing to migrate.

**Cross-module EXCLUSIVITY was used TWELVE times across the phase**, ending with Delivery Schedule→Goods Receipt, Goods Receipt→GRN, GRN→Quality Inspection, PO→Invoice Verification (direct, skipping the receiving chain), Invoice Verification→Three-Way Matching, Three-Way Matching→Payment Request, Payment Request→Vendor Payment, and PO→Purchase Closure (reaching back to the ORIGINAL record, not the immediately-upstream one — see below). Identical code shape every single time: a live scan across the claiming repository's OWN records, excluding Cancelled only, always excluding the record currently being edited. **This is the single most reliable pattern in the whole codebase — write it without re-deriving the reasoning for any new "built from exactly one upstream record" module.**

**Not every "built from" relationship points at the IMMEDIATELY upstream record — sometimes it deliberately reaches further back.** Every module from Delivery Schedule through Payment Request built from whatever sat one hop upstream. Two modules broke that pattern on purpose: Invoice Verification built from the PO directly (a vendor's invoice references the PO, not internal receiving paperwork — see its own file header), and Purchase Closure built from the PO directly too, reaching all the way back past eight intermediate modules, because "closing the purchase" is about the PO's OWN lifecycle, not any single downstream artifact. Before wiring a new module's `linkedXId` to whatever shipped immediately before it, ask what the REAL document actually references in the real world — it isn't always the previous module.

**The RETROFIT PATTERN's live-query resolution won EVERY time this session, ending TWELVE instances deep.** Every retrofit added a new `<script>` tag + a few lines to an OLDER module's Detail modal; zero fields were ever added to an older repository to support a newer module's lookup. Purchase Order's own Detail modal is the standout example of this compounding cleanly — by the end of the phase it had picked up retrofit rows from SIX later modules (Vendor Confirmation, Delivery Schedule, Invoice Verification, Purchase Closure, plus its own two decision-transitions) without ever needing a structural rewrite, only incremental, purely-additive changes. **This pattern held with zero exceptions across all 20 modules — treat it as proven, not just convenient, going into Phase 5.**

**A PURE, UNSTORED, MULTI-HOP COMPUTATION is its own established pattern now, first appearing at Three-Way Matching and reaching its natural conclusion at Purchase Closure.** `computeMatchLines()` walked a 4-hop chain (invoice→PO→schedule→receipt→GRN) live, every read, never cached — because a Draft invoice or unposted GRN can change underneath a cached value. `computeCompletionChecklist()` generalized this to ALL EIGHT downstream modules at once. The rule this establishes: **when a module's whole value is a COMPARISON or SUMMARY across several other records rather than a document in its own right, don't store the comparison — store only the minimal link (or nothing at all beyond what's already derivable) and recompute the summary on every read.** This is the same "prefer live-query over a stored field" bias Section 9 already had for single-hop retrofits, now confirmed to scale cleanly to multi-hop, whole-chain computations too.

**Not every module is a workflow, and not every workflow has the SAME shape — SEVEN shapes as of Phase 5 #1.** (a) full 5-state Draft→Submitted→Approved/Rejected+Cancelled (Need, PR — AND, closing the loop, Payment Request, which returned to this exact shape after ten modules of simpler ones); (b) simpler, no approval gate (RFQ's Draft→Sent→Closed+Cancelled); (c) no lifecycle at all (Vendor Evaluation); (d) an 8-state lifecycle where TWO separate real-world parties each need their own status transition (Purchase Order); (e) a plain 3-state `Draft→X→Cancelled` shape for operational records that commit nothing financially (Delivery Schedule, Goods Receipt, GRN, Quality Inspection, Invoice Verification, Vendor Payment — SIX modules used this exact shape, the single most common lifecycle in Phase 4); (f) **a 4-state DECISION gate without a full approval workflow** (Three-Way Matching's `Draft/Approved for Payment/On Hold/Cancelled` — a real judgment call, but only two people ever touch it, so it didn't need Need/PR's full 5-state ceremony); and (g) **a 5-state PIPELINE PROGRESSION that only LOOKS like shape (a)** (Customer Inquiry's `New/In Progress/Converted/Lost/Cancelled` — same cardinality as (a), but triage/ownership, not authorization; nobody "approves" a customer asking a question). Don't assume matching cardinality means matching meaning — check what's actually being decided, and by whom, before reusing a shape. Worth the reminder Section 9 made at Delivery Schedule and it held all the way through: give each "this is settled" status its own word (`Finalized`/`Logged`/`Posted`/`Completed`/`Verified`/`Approved for Payment`/`Paid`/`Closed`/`Converted`/`Lost` — ten distinct words for ten distinct settling events) rather than reusing one across modules.

**"One repository, multiple pages" was used to its fullest with Purchase Order (three pages) and, in a new variant, Payment Request folding the SPLIT back into ONE page.** PR/PR Approval established two pages sharing one repository; PO went further with three (creation, PO Approval, Vendor Confirmation) because its 8-state lifecycle needed three modules to each own a segment. Payment Request then did the OPPOSITE on purpose: its full approval gate (Submit/Approve/Reject) lives entirely on its own creation page, the same "no separate approval module" shape Department Need used before PR Approval ever existed — because the roadmap simply never named a "Payment Request Approval" module. **Always check the roadmap's own module list before assuming an approval-gated document needs a sibling page; sometimes it doesn't.**

**Decisions that save immediately (no big form Save)** are their own established UI shape (Vendor Selection's per-vendor Select/Not-Selected, Quotation Comparison's per-quotation Recommend) — used specifically for "quick, individually-reversible working decisions," as opposed to a proper Add/Edit form for a record with real structure.

**A controlled vocabulary with more than 2-3 members earns a `.xCriteria`/`.xTypes`-style array the UI loops over** — Vendor Evaluation's `.scoreCriteria`, Purchase Closure's `.checklistStages`, Vendor Payment's `.paymentMethods` all used this same discipline. Don't hardcode N near-identical fields or options when N might grow or when a future module might need to extend the same list.

**Dashboard Quick Actions is a spotlight, not an index** — the grid never grew past the two tiles added early in Phase 4, across 18 more modules. The sidebar is the complete, always-current index; Quick Actions stays a spotlight on the handful of most common entry points. Same discipline applies going into Phase 5.

**A module can earn real depth by linking to Phase 3 masters no earlier Phase 4 module had touched, not just by adding new fields.** By the end of the phase, every Phase 3 master had been referenced from Procurement at least once: Warehouse and Payment Terms via PO, Employee via PR/Goods Receipt/Quality Inspection, and — the LAST one, Payment Request's own contribution — Bank Master, via the vendor's own `getEffectiveBankDetails()`. Check `data/*.js` for an existing, ready-to-use repository before defaulting to a free-text field.

**A field can default from an upstream record while still being independently overridable — a different, equally valid choice from making it fully derived/read-only.** Vendor on a PO/schedule/receipt/GRN/etc. is always fully derived (never independently choosable). Goods Receipt's "Received At Warehouse," Payment Request's `requestedAmount`, and Vendor Payment's `amountPaid` are the opposite: each DEFAULTS from an upstream number but can diverge, because the real-world equivalent (a different receiving dock, a negotiated adjustment, a partial payment) genuinely can differ. Decide per-field which of the two a real-world equivalent actually needs.

**"Starting point, meant to be overwritten" has a genuine INTENSITY gradient, from "usually stays close to default" to "diverging is the expected, normal case."** PO's copied price/qty from a quotation is usually near-final. Delivery Schedule's planned date is a real plan, adjusted when reality diverges. Goods Receipt's received quantity and Quality Inspection's accepted/rejected split are where diverging from the default IS the normal case, not the exception — both get visual warning badges in their own line tables for exactly that reason, a UI emphasis earlier "usually stays close" fields never needed.

*(All of Phases 1-3's own established conventions — hierarchy patterns, `getEffectiveX()` helpers, budget-bar reuse, `isDefault` singleton patterns, the reference-list-vs-closed-set distinction, deferred-vs-immediate retrofit judgment, etc. — remain in force. Read the relevant existing file's header when a new module resembles an old one; the reasoning is preserved there rather than re-summarized here.)*

**Real dependency order can diverge from roadmap presentation order — and can do so MORE THAN ONCE in the same phase.** Phase 7's roadmap lists Opening Stock before Stock Ledger and Stock Transfer before Stock Valuation Report, because that's the order a trainee should encounter them in. But Opening Stock's own `confirm()` needs a Stock Ledger to post into, and Stock Transfer's own cost carry-forward needs Stock Valuation's FIFO engine — so both times, the file that's needed EARLIER got built earlier, regardless of its roadmap number, with the divergence stated plainly in both files' own headers rather than left for someone to puzzle out later. Roadmap order is a presentation order for the person learning the system; it is not automatically the build-dependency order for the person writing it, and conflating the two is a trap worth naming explicitly now that it's happened twice in one phase.

**Storage architecture and reporting ROLE are two separate questions — a module can genuinely store its own records while still playing the same role in a reporting chain that a purely-computed module plays elsewhere.** General Ledger has no storage of its own because Journal Entry already IS the real transactional record; Stock Ledger has genuine storage of its own because nothing else in Phase 7's roadmap was positioned to hold real stock-movement facts — yet Stock Valuation Report and Low Stock Report both read FROM Stock Ledger exactly the way Trial Balance reads from General Ledger. Don't assume a new module must copy an old one's storage shape just because it's about to play a similar role in what reads from it afterward; ask the storage question and the role question separately, the way Stock Ledger's own file header does explicitly.

**A conditional field requirement can be taught live in the UI, not just enforced at validation time.** Stock Adjustment's Unit Cost column only renders on a line once that line's own adjustment quantity goes positive (a surplus) — the same rule `isLineValid()` enforces at save time, but shown as the form itself changing shape as you type, not just a rejected submit. A field that's "required sometimes, depending on another field's current value" is worth surfacing as a visibly appearing/disappearing input, not a static field with a validation message that only fires on save.

**"Genuine reuse forward" (Trial Balance reading General Ledger, Balance Sheet reading Profit & Loss) now has a new variant: a TRANSACTIONAL WRITE reading a REPORT-shaped computation, not just one report reading another.** Stock Transfer's own `complete()` calls `ERP_StockValuationRepository.getWeightedAverageCost()` to decide what cost basis the destination warehouse's new layer should carry — a business action reaching into what would otherwise look like a read-only report module. The precedent generalizes past "reports reading reports": if a report-shaped module already computes something a transactional module genuinely needs, read it forward rather than re-deriving the same computation inside the transactional module a second time.

**A backward-compatible retrofit is strongest when it changes a function's INTERNALS without touching its SIGNATURE.** `getStockUsage(item)`/`getStockHealthBand(item)` already took the whole item object, not a raw stock number — so retrofitting them to read a live, Stock-Ledger-computed figure instead of a stale stored field required editing exactly those two functions, and every existing call site (Dashboard's low-stock list, the Items page's own table/CSV/KPI, PR/PO's stock-health badges) picked up the fix automatically, with zero code changes anywhere else. Worth deliberately designing NEW helper functions to take the full record rather than a raw extracted value, specifically so a future retrofit like this one stays this cheap.



Before any Phase 6 work started, the project was rebranded and put through the "fresh-company walkthrough" and consistency-sweep items Step 0 calls for. Recorded here, not folded into Section 9, because it's a one-time cross-cutting pass rather than a per-module lesson.

**Rebrand: NexERP → Dot ERP.** A straight, exhaustive substring replace (`NexERP` → `Dot ERP`, plus the lowercase `nexerp-training.local` seed-user email domain) across all 117 files that referenced the old name — HTML, JS, CSS, this document, both tooling scripts. Verified zero remaining case-insensitive hits afterward. The small brand-mark SVG (boot loader, sidebar, login page — 58 files, same inline markup repeated in each) was redrawn from the old "growth arrow" glyph to a small hub-and-three-dots mark, specifically because it echoes the *existing* login page's `flowCanvas` hero animation (a central node with connected satellite nodes, drawn in `script.js`, captioned "Central node = shared database, outer nodes = functional modules") — "Dot ERP" and a literal connected-dots mark is not an arbitrary rebrand, it's naming the metaphor the project already had.

**Recolor: pure white + blue.** `--color-primary`/`--color-secondary` (the tokens driving the sidebar, login brand panel, boot loader, status bar and training FAB — see their own comment in `style.css`, they intentionally stay identical in both Light and Dark theme) changed from near-black navy (`#0F172A`/`#1E293B`) to a blue-on-blue gradient (`#1E3A8A`/`#2563EB`, the latter matching the existing `--color-accent`). `--color-bg` changed from a faint blue-tinted off-white (`#F8FAFC`) to true `#FFFFFF`. **Deliberately NOT touched**: `--color-success`/`--color-warning`/`--color-danger` (status-badge greens/ambers/reds) — those are functional semantics a real ERP needs regardless of brand color (Approved vs. Pending vs. Rejected has to stay visually distinct), not a decorative choice, so "pure white and blue" was read as the brand chrome, not as a mandate to monochrome away status coding. If that reading's wrong, say so and it's a small follow-up. Also left alone: the login brand panel's own on-dark supporting grays (`#93A5C7`, `#B8C4DA`, etc.) — already blue-family grays tuned for readability on a dark panel, not an unrelated color needing correction.

**Dashboard de-fake-ified — the big one.** `data/dashboard-data.js` used to be 100% `Math.random()` — invented party names from a fixed pool, a hardcoded fake "New employee record created: Priya Nair" activity line, KPIs that changed on every page load with no relationship to anything in the company. Rewritten to compute every tile from real repositories: today's-sales/purchases and the 7-day chart come from Tax Invoices (status "Raised") and Purchase Orders (status Submitted/Approved/Sent/Confirmed) bucketed by date; inventory value and the category split come from `ERP_ItemRepository`'s real `currentStock × purchasePrice`; Low Stock reuses Item Master's own `getStockHealthBand()` critical/low bands instead of inventing separate thresholds; Recent Transactions merges real POs, Tax Invoices and Delivery Challans (their party is stored directly on the record — Vendor Payment/Receipt were deliberately left out of this list rather than faked, since their party only resolves through a multi-hop join this pass didn't build); Recent Activity reads the same unified `logSystemActivity` stream every other module already writes to, filtered to the active company. `dashboard.html`'s `<script>` list grew accordingly (it used to load only `script.js` + the dummy data file — now it loads every repository the real snapshot reads from, in the same master-data-then-transactional order every other multi-repository page already uses). The sessionStorage snapshot cache is gone too — it bought nothing here (aggregation is cheap array scans, not an expensive query) and was a live correctness bug (add an invoice, come back, see stale cached numbers). Two honest gaps, not silently glossed over: `inventoryChangePct`/`lowStockChange` are hardcoded to 0 (no historical daily snapshot exists yet to diff against — that needs a real point-in-time mechanism, arguably a Phase 8 reporting concern), and inventory valuation is a straight current-stock-×-cost approximation, not FIFO/Weighted-Average (Phase 7 owns that once a real Stock Ledger exists).

**Audited, not just asserted:** grepped every `class="..."` in every HTML/JS file against every selector defined in `style.css` (the check Step 0 flagged `validate.py` as blind to — this bit the project once already with `.kpi-card__icon--info`). 27 raw hits, all but one resolved to non-bugs on inspection (JS-only selector hooks like `.po-line-qty` that inherit real styling from `.input-wrap input`'s type selector, not their own class; `.profile-card--overview`, an unused-but-harmless modifier since the base `.profile-card` already carries its own full styling). Found no actual broken reference this pass — worth recording as a real negative result, not just skipped. Also spot-checked 5 of the project's 18 `findXForY(...)` retrofit hooks across both phases (`findPoForQuotation`, `findChallanForSalesOrder`, `findDispatchForInvoice`, `findReceiptForInvoice`, `findMatchForInvoice`) for the "target repository undefined / linked record missing" case Step 0 calls out — all five correctly gate on `typeof X !== "undefined"` before calling, then null-check the lookup result before rendering. Did not exhaustively re-check all 18 by hand; if a future session has reason to doubt one, the pattern to check for is exactly those two guards.

**Not done in this pass, and worth being upfront about:** the full manual "fresh-company walkthrough" (creating a brand-new company and clicking through every step of both the procure-to-pay and quote-to-cash chains by hand) wasn't performed — this pass was a targeted rebrand/recolor/de-fake-data/audit sweep, not the complete Step 0 checklist. `tools/validate.py` passes clean (104 JS, 58 HTML, zero errors) after every change in this pass, which catches structural breakage but not a genuinely wrong empty-state string or a stale "Next Step" hint. If Phase 6 surfaces one of those while retrofitting a Procurement/Sales module, fix it there and log it in Section 9 same as any other lesson — don't assume this pass already caught it.

**"Genuine reuse forward" now has a REPORT-READS-REPORT variant, not just "report reads transactional module."** Every report through Phase 7 (Trial Balance, Balance Sheet, AP/AR Aging, Stock Valuation) read a transactional module's own storage or computation. GST Summary is the first to read TWO OTHER REPORTS' own already-computed rows and grouping helpers (Sales Register's/Purchase Register's `getRows()`/`groupByRate()`/`groupByHsn()`) instead — which is also why Sales Register and Purchase Register both needed real data files of their own rather than staying page-only or Low-Stock-thin: the moment a second module needs to CALL a report's own output, "page-only" stops being an option, the same test that already justified every earlier module's own data file. When a new report's job is explicitly to reconcile or combine other reports (not read one upstream module), check whether those other reports expose reusable functions before writing any merge logic of your own.

**A read-only report can legitimately need the FULL "list module" shell (search/filter/sort/paginate/CSV/print), not just AP Aging's small ungrouped-table shape — the deciding factor is row-count SCALE, not read-only-ness.** Every Phase 6/7 report (Trial Balance, AP/AR Aging, Stock Valuation) grouped by a bounded-cardinality dimension (accounts, vendors, customers, items) and never needed pagination. Sales Register and Purchase Register don't — their own row count scales with invoice-LINE history, unbounded over time, closer in shape to a transactional list page than to any earlier report. Decide per-report which shell actually fits by asking "does this group by something bounded, or does it flatten a whole transaction history" — not by defaulting to whichever shell the nearest analog happened to use.

**An honest "this figure is an estimate, not a captured fact" label has to PROPAGATE through everything downstream that uses it, not just live once at the source.** Purchase Register's own `taxIsEstimated: true` (input tax imputed from an item's current tax config, since the Procurement chain never captures a rate) isn't just documented in that one file's header — GST Summary's own Net Tax figure inherits the same uncertainty by construction, and both pages say so in their own UI text, not buried in the training drawer alone. When a new module consumes a figure an upstream module has already flagged as approximate, restate that flag rather than letting it quietly disappear a hop downstream.

**A genuine-storage module can have a NARROW, EXPLAINED exception to "no update, ever" without abandoning the discipline itself.** Every prior genuine-storage module (Journal Entry, Stock Ledger) never updates a record once written — a posted fact is a posted fact. `snapshot-data.js` breaks this, on purpose, for exactly one case: TODAY's own row, upserted rather than appended-anew, because a day that hasn't finished happening yet isn't a settled fact the way a physical stock movement or a posted journal entry already is. Every PAST day's row is left alone once written, same as before. The lesson: "no update, ever" is the right default for a fact that already happened; a fact that's still actively forming (today, in progress) can earn a narrow, explicitly-reasoned exception without the rest of the module's storage discipline weakening — state the boundary precisely (today only, nothing else) rather than either blanket-refusing all updates or quietly allowing them everywhere.

**"No prior data exists" must render as `null`, never as a real-looking 0 — a reusable principle beyond this one Dashboard fix.** `ERP_SnapshotRepository.getDeltas()` returns `null` for both delta fields when no baseline snapshot exists, and `dashboard.js`'s own `renderKpiTrend()` renders that as a visibly different message ("No prior-day data yet") from a genuine, tiny, real 0% ("No change vs yesterday"). The two are NOT the same claim — one says "nothing changed," the other says "there's nothing to compare against yet" — and collapsing them into the same 0 (or the same message) is exactly the kind of silent-lie shortcut this whole project has refused everywhere else a fact is genuinely unavailable (AP Aging's "No Due Date" bucket, Invoice Verification's unresolved lines, Purchase Register's `taxIsEstimated`). Any future module facing a genuinely-missing baseline, not just a genuinely-zero one, should reach for the same `null`-vs-real-value distinction rather than defaulting a gap to a number that looks like data.

**Composite-key uniqueness isn't one rule with one enforcement shape — Phase 9 alone produced a THIRD and FOURTH variant.** Resolution #7 (Opening Stock) hard-blocks a second record outright. `snapshot-data.js` upserts, but only for today's own row. Attendance's own `markAttendance()` upserts UNCONDITIONALLY on (employeeId, date) — any date, because correcting a past mismarked day is always legitimate, not time-bound the way Snapshot's exception is. Salary Structure hard-blocks, resolution-#7-style, but only on the exact (employeeId, effectiveFrom) pair — a LATER effectiveFrom for the same employee isn't a duplicate at all, it's the intended outcome (a raise). The lesson: before reusing resolution #7's shape (or any established shape) for a new composite key, ask what a SECOND record with a different value on the varying field actually MEANS in the real process — sometimes it's an error, sometimes it's a correction, sometimes it's the whole point.

**A genuinely new kind of validation doesn't have to be force-fit into the existing duplicate-check catalog.** Leave Application's own overlap check (two Pending/Approved applications can't claim the same employee's same days) isn't a duplicate in the sense any of the seven numbered resolutions describe — it's two DIFFERENT, mutually IMPOSSIBLE claims, not one thing recorded twice. It hard-blocks at `create()`, invented as its own shape rather than stretched to fit a resolution that was never built for this kind of conflict. The lesson generalizes past this one check: this project's own numbered catalog is a set of PRECEDENTS to check against, not an exhaustive enum a new validation must be squeezed into — when a real conflict genuinely doesn't match any of them, say so and design the real shape rather than mislabeling it as the nearest existing number.

**When two independently-built modules can each make a claim about the same real-world fact, the module that RECONCILES them needs an explicit precedence rule, not an implicit one.** Attendance and Leave Application can each describe the same calendar day (an Absent mark; an Approved leave covering that date) and can genuinely disagree. Payroll — the first module built specifically to combine two OTHER modules' own day-level outputs — states outright which one wins (Leave, because it represents an authorized decision, outranking an unexplained fact) rather than letting whichever code path happens to run first silently decide. Any future module reconciling two sources that can both speak to the same fact should name its own precedence the same way, in its own file header, rather than leaving it as an implementation accident.

**A named gap can be closed in a genuinely separate, later pass without becoming a new phase — Payroll's own GL posting is the second time this project has done this, not the first.** Dashboard's own `inventoryChangePct`/`lowStockChange` were flagged as a real gap in Phase 6, carried forward through Phase 7's own header, and finally closed in Phase 8 by a purpose-built mechanism (`snapshot-data.js`) — a different phase than the one that named the gap. Payroll Processing's own GL posting followed the identical shape: named honestly the moment the module shipped ("a future dedicated pass"), then actually closed in its own retrofit pass once asked for, reusing `gl-posting-data.js`'s own established "business module doesn't know GL posting exists" separation rather than reopening `payroll-data.js` itself. The generalizable lesson: naming a gap honestly and closing it later are two separate, equally real commitments — a file header that says "not built yet, and here's why" is doing its job whether the close comes in the same session or several sessions later, as long as whichever session closes it actually reads that header first instead of re-deriving the reasoning from scratch.

**Ask for a missing piece of context at the exact moment it's actually needed, rather than adding a field to a schema that would sit unused until then.** Vendor Payment's own `bankId` is chosen once, at the payment record's own creation, because that's the one and only moment a vendor payment needs a bank. Payroll's own run has no equivalent moment before Mark Paid — adding a `bankId` field to `payroll-data.js`'s own schema back when the run is first generated would mean carrying a field that means nothing until weeks later, when the run finally gets paid. The retrofit instead asks for it in a small, dedicated "Mark Paid" modal at the exact point of use. The reusable rule: a data field's own existence should track the moment its value first becomes meaningful, not the moment the record itself is created — if those two moments are genuinely different, ask in a UI step at the later moment rather than pre-declaring a field that would sit empty and meaningless in between.

**Client-side PDF generation through a standard font silently drops any glyph that font doesn't have — this has to be caught by actually rendering the output, not just by the code running without an error.** jsPDF's own standard PDF fonts (Helvetica, Times, Courier) don't include the ₹ (Indian Rupee) glyph; a payslip PDF built with the same `formatMoney()` used everywhere else in the app compiled and ran without any error at all, and simply produced a blank space where every currency figure's own ₹ symbol should have been — a silent, easy-to-miss defect no unit test or static check would ever catch, since nothing THREW. It was only caught by actually converting the generated PDF to an image and looking at it. The fix — a separate `formatMoneyPdf()` using the real-world "Rs." fallback, scoped only to PDF generation, leaving every on-screen and CSV figure's own real ₹ symbol untouched — is specific to this one defect, but the METHOD generalizes: any code path that renders through a constrained font or character set (a generated PDF, a barcode, a receipt printer) needs its OWN visual verification pass, distinct from and in addition to whatever passes the rest of the codebase's own logic already gets.

**Two honestly different numbers can both be correct answers to two different questions about the same underlying thing — Bill of Materials' own estimated cost vs. Material Issue's own actual cost is the clearest instance of this project's estimate-vs-fact discipline yet.** Purchase Register's `taxIsEstimated` flag was the first time this project named a figure as an estimate rather than silently treating it as exact; Phase 10 needed the SAME discipline applied to two entirely separate, independently-computed numbers describing the same real quantity (what a unit of output costs) rather than one number with an uncertainty flag on it. `bom-data.js`'s own `computeMaterialCostPerUnit()` answers "what SHOULD this cost," recursively, off Item Master's own static `purchasePrice`, useful before any Work Order or stock movement exists at all. `material-issue-data.js`'s own posting cost answers "what DID this actually cost," from real, current, FIFO-weighted-average Stock Ledger data at the moment of consumption — reusing Stock Transfer's own established costing convention rather than inventing a third way to answer a question that module had already answered honestly. Neither number is wrong; they're deliberately different questions, and the file headers say so explicitly rather than letting a learner assume the BOM's own planning figure is what actually posts to the books.

**A mutual-exclusivity toggle (Quotation Comparison's `recommend()`) turned out to be the right shape for a duplicate-check problem, not just a workflow-decision problem — worth naming as a reusable shape ACROSS categories, not filed away as workflow-only.** BOM's own "at most one Active recipe per finished item" needed real exclusivity, but resolution #7's flat hard block was wrong for it (Draft BOMs for the same item coexist freely while a recipe is worked out, the same freedom Salary Structure's own effectiveFrom versioning already established). The actual fit came from a different corner of the project entirely — Quotation Comparison's `recommend()`, which auto-un-recommends whatever was previously picked rather than blocking a second pick outright. Applying that same auto-supersede shape to `activate()` solved BOM's own uniqueness problem cleanly. The generalizable lesson: when a new module's own uniqueness need doesn't fit any of the eight duplicate-check resolutions, don't stop at "must be a new, ninth resolution" — check whether an existing WORKFLOW pattern from a completely unrelated module already solves the same underlying shape (something can have at most one live/current/active instance among several coexisting drafts), since that's a genuinely different category of problem than "did two people type the same thing."

**A batch process that consumes from one running total and produces into another needs its own explicit, named allocation rule — Finished Goods Receipt's own WIP-capitalization math is this project's first real instance of that shape.** Every earlier module reading a running balance (Stock Valuation's FIFO layers, Bank Reconciliation's own running total) either consumed a balance or built one, never both across two DIFFERENT sibling modules feeding into and out of a third, shared, live-computed figure (Work-in-Progress) at the same time. The allocation chosen — remaining WIP cost divided by remaining planned quantity, a moving average over the rest of the run rather than an exact per-batch trace — was picked deliberately and its own known limitation (a receipt's rate can over/under-capitalize if issues run far out of step with output) was named in the file header the same way GRN/Invoice Verification's own assumed-exact-match simplification already is in `gl-posting-data.js`, rather than presented as an exact figure it isn't. Any future module facing the same shape (two sibling modules independently feeding a shared running balance from opposite directions) should look at this allocation function as the template, not re-derive an averaging rule from scratch.

**PHASE 10 COMPLETE — the one explicitly optional tier, built anyway, to the same standard as every required one, and the first phase whose own "closest analogous module" check came back negative for BOTH of its transactional modules at once.** Every earlier phase had at least one module that cleanly mirrored something already built (Order Approval ≈ PR Approval, Receipt ≈ Vendor Payment). Work Order checked against GRN and Delivery Challan and genuinely fit neither (a two-sided consumption/output relationship, not a one-sided receipt or issue) — it landed on PO's own "hub" shape instead, a real but different precedent. Material Issue and Finished Goods Receipt, similarly, aren't new variations on GRN/Delivery Challan's own shapes; they're this project's first real WIP-accounting pair, needing their own costing logic (estimate vs. actual, moving-average capitalization) with no direct precedent to check against at all — only individual PIECES borrowed from elsewhere (Stock Transfer's costing convention, PO's hub shape, Quotation Comparison's exclusivity toggle) recombined into something genuinely new. The lesson worth carrying into Phase 11 and beyond: "check the closest analogous module" doesn't always resolve into "found a match, adapted it" or "broke from it entirely" — sometimes the honest answer is "no single close analog exists, borrow the individual mechanisms that do fit from wherever they live, and say so plainly in the header," and that's not a failure of the mirror-checking discipline, it's that discipline doing exactly its job on a module that was never going to have a clean precedent in the first place.

**A cross-cutting retrofit that would be impossibly large as a per-module audit becomes tractable the moment you find the small number of choke points every module ALREADY shares — the single biggest lesson Phase 11 has to offer any future retrofit.** Blocking mutation for a read-only role sounds, on first read, like it needs individual attention on every button across ~90 modules — exactly the scale the roadmap's own warning anticipated. It didn't, because Section 2's own Rule 3 ("every destructive or state-changing action goes through the shared confirm dialog") and Rule 5 ("reuse the shared runtime, don't reinvent") had ALREADY, unintentionally, built the choke points this phase needed: `openConfirm()` and `openModal()` are called from every single module, by design, because THAT rule existed since Phase 1. Two functions gained one check each, and the coverage that bought was enormous. The generalizable lesson for Phase 12 onward: before assuming a cross-cutting concern needs a per-module retrofit, ask whether the modules ALREADY funnel through a small number of shared functions for the relevant kind of action — if Rule 3/Rule 5 discipline has been followed consistently (it has, audited directly this phase), the answer is very often yes, and the retrofit is a handful of edits, not ninety.

**A "we'll get to this later" line of copy, written honestly at the time, is still a debt — and it's worth grep-checking old training text against current reality once the feature it was foreshadowing actually ships.** The Login page's own training guide said, all the way back in Phase 1, "this simulator seeds five roles so you can feel that difference once the Dashboard module ships" — true in the sense that the roles already existed, false in the sense that nothing actually enforced them until Phase 11, many phases later, and stale in a second, smaller way too (five roles became six along the way). Nobody caught this by re-reading Phase 1's own file from scratch; it was caught by deliberately checking what OTHER files said about a concept before shipping it for real. The lesson: when a phase finally delivers on something an earlier phase's own copy already gestured at, search the project for that gesture and reconcile it — training copy can go stale exactly the way code can, and nothing besides deliberately checking catches it.

**An audited allow-list beats a plausible-sounding naming convention, even inside your own project's own established conventions.** `DetailModal`/`FormModal` suffix naming covered 80% of this project's own 143 modal ids cleanly — good enough that it would have been tempting to write a two-branch rule and call the Viewer lockdown done. The other 20% (29 modals) had their own bespoke names for real reasons — some genuinely read-only despite not saying "Detail" anywhere in their own id (`slLedgerModal`, `payslipModal`, `svLayerModal`), one a personal-account action that shouldn't be blocked by a BUSINESS-data restriction at all (`changePasswordModal`). Guessing from the dominant pattern would have either over-blocked (a Viewer unable to view their own stock ledger drill-down) or under-blocked (a genuinely mutating modal slipping through because its name didn't match the expected suffix). The actual list was built by reading all 143 ids by hand and classifying each — slower than trusting the pattern, and the only way to be honestly confident the resulting allow-list was correct rather than merely plausible.

**PHASE 11 COMPLETE — the single most invasive retrofit this project has done, and also, in the end, one of the smallest DIFFS relative to its own scope, because the retrofit rode on discipline this project had already been holding itself to since Phase 1.** 87 pages now carry a role-gate; every one of ~90 modules' own mutating actions is now covered for the Viewer role, through exactly two functions plus one honestly-named, individually-closed exception. The role model, the page classification, and the modal audit were each real, deliberate, justified work — but the MECHANISM that made ~90 modules enforceable from two functions wasn't invented this phase, it was ALREADY THERE, waiting on Rule 3 and Rule 5 having been followed consistently for ten phases before this one needed them. Section 2's own Rule 9, added this phase, keeps that true going forward: every module from Phase 12 on registers itself in `ERP_PAGE_ROLE_MAP` and calls `enforcePageAccess()` from its own first version, so Phase 17's own eventual RBAC audit (if the roadmap ever needs one) finds zero retrofit debt waiting for it, the same way this one, mostly, didn't.

**The single most valuable defect this project's own verification discipline has ever caught — and it was in code that looked completely correct.** Phase 12's first version of the monthly WDV depreciation charge applied `annualRate / 12` to the declining monthly balance. That is the intuitive thing to write, it reads as obviously right, it throws no error, it produces plausible-looking numbers every single month, and it is WRONG — compounding a naive twelfth of an annual rate across 12 periods does not reproduce one annual reduction at that rate (`1-(1-r/12)^12 ≠ r`). It was caught only because Rule 6 says to trace a real scenario end-to-end in Node before shipping: a 5-year, ₹120,000-cost, ₹6,000-residual asset was still sitting at ₹10,140 with its entire useful life elapsed, ~40% short of where it had to land. The corrected monthly-equivalent rate (`1 - (1-annualRate)^(1/12)`) closes at exactly ₹6,000.00. **The transferable lesson is not about depreciation at all**: a formula that is dimensionally sensible, reads naturally, and yields believable per-period numbers can still be systematically wrong in a way that only shows up when you run it to its own terminal condition and check where it actually lands. Per-period plausibility is not verification. Trace to the end state, and check the end state against a number you derived independently.

**When two modules must agree on a computation, have one REUSE the other rather than reimplement it — then verify the agreement anyway.** Depreciation Schedule projects what Depreciation Run will post. The tempting shape is two independent implementations of "the same" math (a projection engine and a posting engine), which is exactly how two modules silently drift apart over time. Instead the projection calls `ERP_AssetRepository.computeAnnualDepreciation()` and reuses the same monthly-equivalent rate derivation, so there is exactly one source of truth for each formula. That reuse was then still verified empirically — running the projection and real posted runs side by side, month for month, across both methods (max per-month difference ₹0.0000). Reuse makes drift unlikely; verifying makes the claim of agreement honest rather than assumed.

**"Check the closest analogous module before assuming" resolved cleanly to REUSE this phase, which is worth recording precisely because the previous phase's own check resolved the opposite way.** Phase 10's Work Order checked against GRN and Delivery Challan and genuinely matched neither, and Section 9 recorded that "no single close analog exists" is a legitimate outcome of the check. Phase 12's Depreciation Run checked against Payroll Processing and matched almost exactly — the period-lock shape, the create-or-refresh Draft, the resolution #7 duplicate scoping with its Cancelled exception, even the page-vs-repository split of where the duplicate block lives. Both outcomes came from running the same check honestly. The discipline is the check itself, not a preference for either answer; a phase that reuses a shape wholesale because it genuinely fits is exactly as rigorous as one that breaks from every precedent because none did.

**A module that stores nothing and decides nothing does not earn a repository — and saying so explicitly prevents a future session from "fixing" its absence.** Depreciation Schedule is the first module in twelve phases with no `data/` file at all. It would have been easy, and consistent-looking, to create `data/depreciation-schedule-data.js` purely for symmetry with its three sibling modules. That file would have had no state, no persistence, and no decisions — only a copy of math that already lives in two verified places. Its absence is documented in the page file's own header specifically so the gap reads as a deliberate architectural call rather than an oversight waiting to be corrected.

**PHASE 12 COMPLETE — and the first phase built entirely under Phase 11's own Rule 9, which held without friction.** All four modules registered themselves in `ERP_PAGE_ROLE_MAP` and wired `enforcePageAccess()` as part of their own first version; there was no RBAC retrofit pass at the end of this phase, because there was nothing left to retrofit. That is the whole point of a standing rule introduced at the moment a cross-cutting concern lands, rather than rediscovered as debt three phases later — and it's the pattern every remaining phase (13-17) should expect to keep following.

**A design question left open by a brief is often already answered by the data — check the schema before forming a preference.** The roadmap explicitly offered Phase 13 a choice: budget per GL account, or per Cost Center too. That reads like a scope/taste decision, and it would have been easy to answer it by picking the more impressive-sounding option. It wasn't a taste decision at all: reading `data/journal-entry-data.js` took under a minute and settled it definitively — journal lines carry no `costCenterId`, so cost-center actuals are underivable, so a cost-center budget could never be compared against anything. The generalizable move: when a brief offers an optional dimension, **go look at whether the fact table can actually support it** before deciding whether you want it. A budget column with a permanently empty actual column beside it is worse than an absent feature, because it looks like it works.

**Two things in a codebase can share a name without being the same thing — and the honest move is to name the overlap, not to merge, extend, or silently overwrite it.** Cost Center has carried `annualBudget`/`actualSpend`/`getVariance()` since Phase 2. Discovering that while building a module literally called Budget Master created three tempting wrong moves: extend Cost Center's fields, have Budget Master write into them, or quietly deprecate them. All three are worse than what was done — establishing by grep that Cost Center's `actualSpend` is hand-typed and GL-independent, leaving it entirely alone, and recording in `budget-data.js`'s own header exactly what each of the two "budgets" is and why they don't talk. A future session now finds an explanation instead of an apparent contradiction.

**Follow an explicit scope instruction even when the surrounding pattern pulls the other way.** Every phase from 4 onward shipped 4-10 modules; Phase 13's brief said 2-3 and warned against padding. The gravitational pull toward "make it look substantial like the others" is real, and a third module was genuinely considered before being rejected as a thinner restatement of the first. **Consistency with sibling phases is not a reason to override an explicit instruction about this phase** — and a 2-module phase that does exactly what was asked is a better outcome than a 3-module phase that pads.

**When a single total sums across rows that mean opposite things, the sign convention isn't presentation — it's correctness.** Budget vs. Actual shows one "Total Variance" figure across mixed Income and Expense rows. That figure is only arithmetically meaningful because both variance formulas are oriented favourable-positive; under a naive `actual - budget` applied uniformly, the total would add a good ₹20,000 of extra revenue to a bad ₹20,000 of overspend and report ₹40,000 of something that doesn't exist. The Node check that mattered most here wasn't any individual row — it was verifying that a favourable income variance and an equal unfavourable expense variance **cancel to exactly zero**. Any time a report totals a column whose rows carry different semantics, that cancellation property is the thing to test.

**PHASE 13 COMPLETE — the smallest phase in the project, and the one that most tested whether stated discipline survives contact with an easier option.** Three separate moments invited a shortcut: pad to a third module for symmetry; take the Cost Center dimension because the roadmap offered it; merge with Cost Center's existing budget fields because they were already there. Each was declined for a recorded reason rather than a felt one. Meanwhile the two things this phase genuinely owed — an exact distribution and a correct variance convention — both got Node verification, and both had a property (exact summation, mixed-type cancellation) that eyeballing the output would not have caught.

**Running the same check twice in one phase and accepting two opposite answers is what makes the check real rather than ceremonial.** Phase 14 asked "is this a new workflow shape?" about both of its lifecycle modules. Lead Pipeline: compared against Customer Inquiry, found New→Qualified→Converted/Lost to be the *same* pipeline-progression structure wearing different domain labels, and reused shape 7 wholesale. Support Tickets: compared against the same catalog, found Open→In Progress→Resolved→Closed to be structurally different — one success path with a *sequential two-stage ending* rather than *mutually exclusive* terminal outcomes — and registered a genuine 8th shape. **If a check only ever returns "new shape," it is a formality for justifying novelty; if it only ever returns "reuse," it is a formality for avoiding work.** The distinction that decided it here is worth keeping: a pipeline's endings *compete* (Converted XOR Lost), a support lifecycle's endings *accumulate* (Resolved, then Closed). That question — do the terminal states compete or accumulate — generalizes to any future lifecycle.

**A documented simplification is a promissory note, and a later phase should go looking for it rather than waiting to stumble across it.** Customer Inquiry's header wrote down, in Phase 5, exactly what it was not building and why. Nine phases later the roadmap said "read that header first," and the header turned out to describe Phase 14's first module in advance — including the reason the gap was acceptable at the time. The practice worth generalizing: **when a module documents an omission, that text is a specification for a future module, not an apology.** Anything in this project that names something as deliberately out of scope (Finished Goods Receipt's absent overhead absorption, Salary Structure's flat TDS, Budget Master's rejected Cost Center dimension) should be read the same way by whichever phase eventually reaches it.

**When a new module must break an established project-wide discipline, breaking it loudly in the header is the difference between a decision and a lapse.** Lead Pipeline stores free-text `leadName`/`phone`/`email` and no `customerId` — directly contrary to the "name a real master record, don't accept free text" rule this codebase has followed since Phase 4. That is correct here for a concrete reason (creating Customer records for prospects who never buy is the exact pollution a Lead entity exists to prevent), but a future reader finding free text in a repository would reasonably assume sloppiness unless the file says otherwise. **The rule to carry forward: any deliberate violation of an established convention must state, in the file that commits it, both that it is a violation and why it is right here** — otherwise the next session either "fixes" it or, worse, copies it as precedent.

**Preserving history means creating a new record, not editing an old one — and this is now the third module in three phases to land on that answer independently.** Contract renewal creates a new contract rather than extending `endDate`, because extending would destroy what the previous terms actually were. Phase 12's Asset Register locks editing once depreciation has posted, for the same reason. Phase 13's Budget Master supersedes rather than edits an approved budget, for the same reason. None of these copied each other; each reached it from its own domain. **When a record's past values are themselves meaningful data, mutation is data loss** — and that test ("would someone later need to know what this said before?") is quicker than reasoning it out fresh each time.

**PHASE 14 COMPLETE — the phase that most directly demonstrates the value of this project's own written record.** Its first module was specified, in advance and in detail, by a file header written nine phases earlier; its second and third each made a decision (a genuine 8th shape; renewal-as-new-record) that only holds up because the reasoning sits next to the code rather than in someone's memory. The 37-assertion Node verification mattered too, but the more transferable result is that **a codebase that writes down why it did things can be extended correctly by someone who was not there when it did them.**

## 10. Project status: Phases 1-14 complete — every tier this roadmap named, plus RBAC, Fixed Assets, Budgeting and CRM, built and validated; Phases 15-17 (see Section 3) remain, not yet started

**Phases 1-3 (System Foundation, Company Setup, Master Data): 30/30 modules. Phase 4 (Procurement): 20/20 modules. Phase 5 (Sales): 10/10 modules. Phase 6 (Finance & Accounting): 9/9 modules + the full GL-posting retrofit pass + Posting Rules (a bonus 10th module born from that pass). Phase 7 (Inventory Management): 6/6 modules, retrofitted into GRN and Delivery Challan. Phase 8 (Cross-Module Reporting & Dashboard): 4/4 modules + the historical-snapshot mechanism, retrofitted into Dashboard. Phase 9 (HR & Payroll): 4/4 modules + its own post-ship Payroll GL Retrofit. Phase 10 (Manufacturing, the one tier explicitly allowed to stay undone): 4/4 modules anyway, plus its own same-pass Manufacturing GL Retrofit and a whole-group sidebar retrofit across all 81 previously-shipped pages. Phase 11 (Role-Based Access Control): the cross-cutting retrofit itself (a role-gate on all 87 pages, a role-aware sidebar, a universal Viewer action lockdown reached through two shared runtime functions) plus one new admin module (User & Role Management) and one new role/user (HR Manager) — the single most invasive retrofit this project has done. Phase 12 (Fixed Assets): 4/4 modules — Asset Register, Depreciation Schedule, Depreciation Run, Asset Disposal — plus its own same-pass Fixed Assets GL Retrofit (two new gl-posting-data.js functions, five new GL Mapping roles) and a whole-group sidebar retrofit across all 86 previously-shipped pages; the phase whose Node verification caught a genuinely wrong monthly-WDV formula before it shipped, see Section 9's own closing lessons. Phase 13 (Budgeting & Forecasting): 2/2 modules — Budget Master and Budget vs. Actual — deliberately NOT padded to a third, honoring the roadmap's own explicit warning; the phase that settled its one open design question (the Cost Center dimension) by reading the journal-entry line shape rather than by preference. Phase 14 (CRM Extension): 3/3 modules — Lead Pipeline, Support Tickets, Contract Management — the phase where the same "is this a new workflow shape?" check was run twice and honestly returned opposite answers (Lead Pipeline reuses shape 7; Support Tickets earns a genuine 8th).** 98 modules total (30+20+10+10+6+4+4+4+1+4+2+3), fully built, retrofitted, and validated end to end. Every module across all fourteen phases has its own reasoned data-layer file header; every "built from" link, exclusivity claim, workflow shape, and duplicate-check resolution was a deliberate, documented call, not a default. `tools/validate.py` passes clean on the full project (182 JS files, 96 HTML files, zero errors as of Phase 14 shipping — the most recent work). Every sidebar stub across all fourteen phases has been converted to a live link — there are no locked `.sidebar-link--locked` modules left anywhere in `pages/*.html`. If a fresh session opens this project expecting more modules from Phases 1-14 to build, check Section 3's own progress line for every phase first — Phases 1-14 should all read COMPLETE — and treat anything suggesting otherwise as a sign the project has since been extended beyond what this document currently describes. Phases 15-17 (Section 3's own stub entries) are the genuine next work, starting with Phase 15 (Project Accounting) in roadmap order, or per the roadmap's own suggested-priority note (Phase 16's real TDS is the remaining one flagged as most directly addressing "doesn't feel like a real ERP yet") if time across them is limited.

**No seeded or fabricated business data exists anywhere in this project, by design, confirmed by direct audit rather than assumed:** every repository file was checked for a seed/bootstrap function and none exists; `create-company.js` calls `ERP_CompanyRepository.create()` exactly once and creates no child records of any kind; the only "dummy" content anywhere is `data/users.js`'s own login credentials, clearly self-labeled in its own header as a stand-in for a real authentication backend this offline simulator doesn't have — not business data, and not something removing would leave the simulator usable. HSN Master's own `ERP_HSN_REFERENCE_LIST` and similar reference lists are real, accurate reference data used to power a "quick add" convenience (the user still explicitly creates the record) rather than auto-populated storage. A fresh company starts genuinely empty; nothing shows up that the person using it didn't create themselves.

**The Procurement/Sales mirror, in full, across all 30 Phase 4-5 modules:** Sales was built second, deliberately checked against Procurement's own precedents module by module rather than copied wholesale. The final tally (Section 9 carries the full reasoning for each): the mirror held EXACTLY in a small number of cases (Order Approval ≈ PR Approval, both "no data file of its own"; Receipt ≈ Vendor Payment, a clean confirmed match). It held at the CONCEPTUAL level while diverging on specific dimensions in most cases (Quotation, Sales Order, Delivery Challan, Tax Invoice, Sales Close — each kept the parent precedent's overall shape or philosophy while genuinely earning its own answer on lifecycle cardinality, what gets copied vs. left out, the actual join/walk mechanism, or similar). It broke outright in a couple of cases where the real-world process simply wasn't the same shape as its Procurement counterpart (Customer Inquiry needed its own 7th workflow shape; Payment Collection rejected its own predicted mirror and reused Customer Inquiry's pipeline instead). And Dispatch needed its own tie-break between two live candidate parents rather than a single obvious mirror. **No module in either phase was safe to build by pattern-matching alone.** Phase 8 confirmed the SAME discipline applies to REPORT mirrors, not just transactional ones — Purchase Register genuinely is Sales Register's own mirror at the conceptual level, but the brief's own "GRN/Invoice Verification" phrasing had to be checked, not assumed, before landing on Invoice Verification as the real match. Phase 9 had no Procurement/Sales-style mirror to check at all — HR & Payroll is its own domain with no earlier-phase precedent to compare against, which is exactly why its own four modules leaned so heavily on checking real-world process shape directly (Section 9's own Phase 9 entries) rather than any cross-phase analogy.

**Phase 6 confirmed that a whole NEW KIND of module — a cross-cutting concern retrofitted into several already-shipped modules at once — needs its own orchestration file, not N scattered edits; Phase 7 confirmed it generalizes past its original phase; Phase 8's own `snapshot-data.js` confirmed it a THIRD time, in a TIME-triggered variant. Phase 9's own `payroll-data.js` is a fourth, genuinely different shape again: not an orchestration file retrofitting other modules' existing actions, but a RECONCILIATION file that reads three sibling modules' own outputs to produce brand-new records of its own** (a payroll run's own payslip lines don't exist anywhere until Payroll computes them, unlike GL Posting's or Stock Posting's own entries, which mirror a transaction that already happened elsewhere). Its own `computeLopForPeriod()` is the first place in this project two independently-built modules' outputs (Attendance, Leave Application) needed an EXPLICIT precedence rule because they could each make a real, conflicting claim about the same fact — see Section 9's own entry on this for the full reasoning, and treat it as the template for any future module that has to reconcile two sources rather than just read one.

**This project is now being extended into Phase 15 and beyond**: re-read this entire document — Sections 1-9 in full, not just this closing note — before writing any code. The specific facts in Sections 3, 4, and 7 (which files exist, what they're built from, which repository methods and fields are already established) will still be accurate as ground truth. The PATTERNS in Section 9 — the workflow shapes, the duplicate-check resolutions, the "hub" structure, the orchestration-vs-reconciliation file discipline, the discipline of testing every mirror and every dependency-order assumption rather than assuming either, the "find the shared choke point before assuming a per-module retrofit" lesson Phase 11 added, and Phase 12's own "trace a computation to its terminal state, because per-period plausibility is not verification" lesson — are the actual hard-won value of this whole build and should keep being applied, extended, and added to exactly the way they were across these 98 modules. **Every module from Phase 12 onward must register itself in `data/rbac-data.js`'s own `ERP_PAGE_ROLE_MAP` and call `window.ERP.enforcePageAccess()` as part of its own first version — Section 2's own new Rule 9, non-negotiable, the same way `validate.py` and Node verification already are.** Phase 15 (Project Accounting) is next in roadmap order, and its own Section 3 entry carries a design question the roadmap explicitly says is **worth researching rather than guessing**: how a Project relates to a Cost Center — does it roll up INTO one, or are they parallel dimensions? Phase 13 already established the relevant precedent for answering this kind of question: **go read what the fact table can actually support** (there, the journal-entry line's missing `costCenterId` settled it in under a minute) before forming a preference. Phase 15's Time Tracking should also be checked against Attendance and Leave Application's own Phase 9 conventions rather than inventing new ones, and Milestone Billing should trigger Tax Invoice rather than becoming a parallel invoicing path.

**Standing execution discipline, unchanged for any future work on this project**: full validation after every change (Section 2 rule 7, watch for the duplicate-confirmDialog trap in rule 8), a deliberately-reasoned file header for every new data file, checking Sections 4-9 before reinventing anything that might already exist, verifying any nontrivial computation in a Node sandbox against hand-traced numbers before trusting it, and periodically auditing the actual filesystem state (`ls data/*.js pages/*.html`, grep for any remaining locked sidebar stubs) rather than trusting conversation memory alone — a quick `python3 tools/validate.py "path/to/ERP Simulator"` plus a directory listing is always the reliable ground truth, especially in a long session where earlier context may have been trimmed while the actual files on disk persist.

## 11. Validation tooling

**Now persisted inside the project itself at `tools/validate.py` and `tools/update_sidebar.py`** — they weren't carried forward into this session's upload (only described here), so both were recreated from this section's spec and copied into `tools/` this time specifically so a future session doesn't have to redo that. Keep them there going forward.

`tools/validate.py`: runs `node --check` on every `.js` file, an `HTMLParser`-based tag-balance + duplicate-`id` check on every `.html` file, a comment-stripped brace-balance check on `style.css`, and an ID cross-reference between each `page.js` (`getElementById("x")`/`"#x"` references) and its matching `page.html`'s actual `id` attributes. Run: `python3 tools/validate.py "path/to/ERP Simulator"` for a full sweep, or `--js file1 file2 --html file1 file2` for just the touched files. Exits non-zero, prints exactly which file/line. Run after every module — no exceptions. **Known blind spot**: doesn't catch nonexistent CSS class references (Section 2 rule 7). It DOES catch duplicate `id="confirmDialog"` — caught all 3 duplicate-confirmDialog mistakes made so far — but don't rely on it exclusively; the `grep -c` check in Section 2 rule 8 is faster feedback.

`tools/update_sidebar.py` does the bulk sidebar find-and-replace (Section 5): given an "old block" text file and a "new block" text file, replaces every `pages/*.html` where the old block appears exactly once, skipping (and reporting) any file where it appears zero or multiple times rather than partially patching. Used to add the whole Sales group (Section 4) and, most recently, the whole Manufacturing group (Section 3's own Phase 10 entry) — old block = the HR & Payroll group's own closing markup through the sidebar-search-empty line, new block = that same tail with the new Manufacturing group (four live links, no locked stubs — see Section 3's own note on why this phase skipped the locked-stub treatment) inserted just before it; verified beforehand to appear exactly once in all 81 files, applied, then re-verified with a full `tools/validate.py` sweep. The same workflow applies to converting a future phase's own locked stub to a live link as its module ships: old block = that module's exact `<button class="sidebar-link--locked" data-not-built="...">...</button>` markup, new block = the equivalent live `<a>` link.
