# SimulatorHub v47 - ICEGATE login screen + "TCOS" renamed to "ICEGATE"

1. **New login screen** - the ICEGATE login screen from the supplied "ICEGATE Vizhinjam Portal" page replaces the old TCOS login:
   Sign In -> ICEGATE loading screen -> login card over a port photo (6 photos in tcos/assets/login/), User ID / ICEGATE ID, Password (SHOW/HIDE),
   Captcha, Register Now, Forgot ..., Login using DSC. Kept from before: Trainer / Instructor sign-in, Register Now, and the training demo
   credentials (inside "Training demo credentials"), so standalone use works as it did.
2. **From the Logistics Simulator** - choosing the ICEGATE option for Shipping Bill / Bill of Entry (and the other bridged documents) no longer signs the student
   in silently. ICEGATE opens its login screen with the student's Logistics ID + password already filled in (captcha too) and a "Welcome, <name>" line;
   the student just clicks Login. The app then uses their Logistics name, and the filing starts pre-filled from the Shipment Lot exactly as before.
   Any leftover ICEGATE session is cleared at that moment, so the login screen always appears.
3. **Return to Logistics** - unchanged: finish the filing (LEO + PDF / OOC) and you are taken back automatically; the PDF-upload backup (v44) still works.
4. **Rename** - every visible "TCOS" is now "ICEGATE" (ICEGATE pages, Logistics popup/banners/completion screens/dashboard, hub cards, PDF properties,
   upload messages, ZIP README is now README_ICEGATE_documents.txt). Folder names, file names and code identifiers (tcos/, DotBridge, tcosXxx ...) are unchanged on purpose.
   NOT renamed: the Cadence copy (supplychain-tcos/), the README/CHANGES documents.
Tests: tests/ui/icegate_login.js (new, 19 checks) + all earlier suites updated for the login step. Cache skelora-v102.
