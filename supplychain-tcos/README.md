# TCOS — India Trade & Customs Operations Simulator (MERGED build)

This build reconciles two zips that had diverged from a common base into two
different engineering-hardening passes:

- **HARDENED_v4** — continued a 3-round hardening pass: data isolation, ID
  collision guards, a formal filing/booking state machine, accessibility,
  reload-safe amendment/document resolution, and content-accuracy fixes.
- **FINAL** — branched separately and added a few genuine improvements of its
  own, but was missing v4's later rounds, including one **critical, app-breaking
  bug**: the CSS rule that hides inactive screens was never added, so every
  screen rendered stacked on top of every other screen simultaneously. Verified
  by actually executing the app (jsdom): 27 of 27 screens visible after login,
  instead of 1.

**This build uses HARDENED_v4 as the base** (the only one of the two that
renders correctly) and merges in FINAL's worthwhile additions on top, with the
one factual regression in FINAL (an incorrect PGA routing) left out.

Nothing here is a rewrite from scratch — every change below is a small, scoped
patch on top of a codebase that was already reviewed and tested across two
prior rounds. Total diff: 6 of 15 JS files touched, ~120 lines changed.

---

## What was merged in from FINAL

1. **Scenario "Client Brief" instead of auto-fill.** Selecting a training
   scenario no longer pre-fills the Shipping Bill / Bill of Entry form. Instead
   a reference card ("📋 Client Brief") appears above each wizard step showing
   the scenario's client and shipment details — the trainee reads it and types
   every field in themselves, the way they would from a real client's
   documents. The scenario stays linked to the filing internally, so
   scenario-driven query/examination/discrepancy triggers still fire exactly
   as designed.

2. **Editable training identity in Settings.** Name / IEC / GSTIN / PAN under
   Settings → Profile are now editable instead of a static table. The saved
   name is reflected on the DSC signature, Training Certificate, and the
   top-bar user label.

3. **Financial calculation hardening.** Added `safeDuty()` / `safeAmount()` /
   `clampRate()` and wired them through duty assessment (`workflow.js`) and
   Duty Drawback / RoDTEP computation (`incentives.js`). Rates are clamped to
   0–100%, and no duty/incentive figure can render as negative, `NaN`, or
   `Infinity` regardless of what garbage a filing's invoice/item data
   contains. This sits on top of, not instead of, the existing `num()`
   coercion and RoDTEP expiry / partial-utilization / BRC-overdue logic v4
   already had.

4. **Popup-blocker guards.** `printDocument()` and `printCertificate()` now
   check whether `window.open()` actually returned a window before writing to
   it. Previously a blocked popup would throw and silently do nothing; now the
   trainee gets a clear "allow pop-ups and try again" message.

5. **"Not found" messaging.** `viewDocument`, `printDocument`,
   `downloadDocument`, `viewCertificate`, `printCertificate` now show an error
   toast instead of doing nothing when the ID doesn't resolve (e.g. cross-profile
   ID leakage attempts).

6. **Two extra freight preconditions**, matching the defense-in-depth pattern
   v4 already used elsewhere in the same file:
   - `issueDraftBL`: for Sea-mode bookings, blocks generating a draft Bill of
     Lading until VGM (Verified Gross Mass) has been submitted — matches the
     real-world SOLAS requirement, and the simulator already has a full VGM
     step, it just wasn't being enforced as a precondition.
   - `requestDeliveryOrder`: blocks requesting a Delivery Order until the
     **final** BL/AWB (not just a draft) has been issued.

7. **`conductExamination` double-run guard.** The discrepancy branch already
   checked `examination.result === 'SCHEDULED'`; the PASS branch didn't. A
   second call now hits a single guard at the top of the function either way.

8. **New learning-tip content** for the IGM validation field (why it's
   required, how to fix it) — content only, no logic change.

## What was deliberately *not* merged from FINAL

- **The CSS visibility bug** — not merged, obviously; this is v4's fix, kept.
- **A reverted PGA mapping.** FINAL's data.js routed Cotton woven fabric (HS
  52081100) to `PLANT_QUARANTINE` and had no `TEXTILE_COMMITTEE` agency at
  all. v4's routing (`TEXTILE_COMMITTEE`), which was verified against
  DGFT/CBIC sources in the original hardening pass, is what's kept here.
- **FINAL's state-machine-free status assignment, non-persistent ID
  generation, and non-persistent amendment/document-upload timers.** v4's
  versions of all of these (`setFilingStatus`/`setBookingStatus`,
  `uniqueId()`, `resolveAt`) are the ones in this build, unchanged.
- **FINAL's accessibility gap.** v4's focus-visible CSS, `aria-modal` /
  focus-trapped confirm dialogs, and keyboard-operable cards are unchanged
  and still present.

## Verification

This was tested by actually running the merged code in a headless DOM
(jsdom) — not just read — for every change above plus the existing v4
protections, to make sure nothing regressed:

| # | Check | Result |
|---|---|---|
| 1 | Only the active screen is visible after login (the critical bug, re-checked) | 1 of 27 panels visible — pass |
| 2 | Double-clicking Submit doesn't duplicate the acknowledgement | ack # and timeline length unchanged on 2nd click — pass |
| 3 | Selecting a scenario leaves party/items blank; Client Brief renders and toggles | pass |
| 4 | Editing and saving the Settings profile persists and updates the header | pass |
| 5 | Cotton fabric (52081100) still routes to Textile Committee | pass |
| 6 | Adversarial (negative/`NaN`/garbage) invoice input never produces a negative or non-finite duty figure | pass |
| 7 | Trainer login via the UI's Trainer/Instructor toggle | pass |
| 8 | `issueDraftBL` blocked pre-VGM for Sea bookings, succeeds after VGM submitted | pass |
| 9 | `requestDeliveryOrder` blocked before final BL issuance, succeeds after | pass |
| 10 | Re-running `conductExamination` a second time adds no duplicate timeline entries | pass |
| 11 | A full export filing (Draft → Submit → Acknowledged) runs with no thrown exceptions | pass |
| 12 | `uniqueId`, `setFilingStatus`/`setBookingStatus`, `resolveAt`, and the a11y CSS are all still present at their original call-count | pass |

All 15 JS files pass `node --check` (syntax-valid).

### Honestly not covered by this pass

- No UI was visually inspected pixel-by-pixel in a real browser — jsdom
  verifies DOM/CSS computed state and logic, not visual layout on every
  screen.
- The full 20-scenario library and every job-simulator track weren't
  individually replayed end-to-end; the export/import/freight flows tested
  above exercise the shared underlying functions those scenarios all run
  through, but that's inference from shared code paths, not a per-scenario
  run.
- No test file was included in either source zip, so the "17/55 assertions"
  figures either README quoted couldn't be verified either way — this
  README's test table is the actual replacement for that.

Everything else in the simulator (module list, scenario content, job
simulator, knowledge base, PGA/incentive data beyond the one HS code above) is
unchanged from HARDENED_v4 and was not touched by this merge.

---

## Home screen replacement (post-merge)

The old `#home` landing screen (neutral TCOS branding, no government marks)
has been fully replaced with a new govt-portal-style demo design (animated
ship/sea hero, ticker, GSTIN/Tax/Compliance cards, footer). Nothing about the
workflow changed:

- **Login / Sign Up** (nav) and **Explore Services →** (hero CTA) both call
  the existing `showLogin()` — same loader → login-screen transition as
  before.
- **Registration** is reached exactly as before: Login screen → "Register
  Now" → the existing 12-step `#reg` modal. Nothing in the registration flow
  itself was touched.
- The three home cards call the existing `moduleInfo()` (same toast-only
  behavior the old feature cards had).
- The old `#home`-specific CSS block was removed and replaced with the new
  design's CSS, entirely scoped under `#home ...` so none of it can leak into
  the login screen or the app shell (and nothing from those can leak in).
- The clock reuses the app's existing `id="liveDateTime"` /
  `updateLiveDateTime()` (already running from `app.js`) instead of adding a
  second timer.
- The "TRAINING SIMULATOR — NOT AN OFFICIAL GOVERNMENT PORTAL" disclaimer
  bar was carried over unchanged, since the new design's own government-style
  branding (Hindi text, "TCOS 2.0" portal look) makes that disclosure more
  important, not less.

Verified in jsdom: initial screen state (`home` active, `login`/`app` not),
Login/Sign Up → loader → login screen, demo login → app shell with correct
user label, Register Now → 12-step modal opens/closes, Back to Portal →
home again — all pass with no thrown exceptions.
