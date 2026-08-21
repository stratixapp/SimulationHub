# GST Simulator — Educational Training Tool

An independent, offline-first training simulator that walks through the real-world workflow of India's GST Portal — registration, returns filing, ledgers, e-Way Bill, e-Invoice, refunds, and more — for classroom and self-study use.

> **Disclaimer:** This project is **not affiliated with, endorsed by, or connected to** the Government of India, GSTN, or the real GST Portal in any way. It is licensed for **educational and training purposes only**. No real GSTN, PAN, Aadhaar, or banking service is ever contacted — every registration, filing, payment, and approval is entirely simulated and stored only in your own browser.

## Try it live

Enable **GitHub Pages** for this repository (Settings → Pages → Deploy from branch → `main` → `/root`) and it will be live at:

```
https://<your-username>.github.io/<repo-name>/
```

## Run locally

**Option 1 — with the interactive map (recommended)**
Requires Python (already installed on most systems):
```bash
python -m http.server 8000
```
Then open `http://localhost:8000/index.html`. On Windows, just double-click `START_LOCAL_SERVER.bat`.

**Option 2 — quick look, no server**
Just open `index.html` directly in a browser. Everything works except the address-lookup map on the registration screens, which needs an actual web server (not a `file://` page) to load its map tiles.

An internet connection is only needed for the map tiles — every other part of the simulator works fully offline.

## First use

On opening the app, you'll be asked for a name or roll number. Each name gets its own separate, private progress on that browser/computer — a second student typing a different name never sees the first student's data, and typing the same name again later resumes exactly where it left off. The header's **SWITCH STUDENT** button hands the computer to the next person.

## What's inside

- **New Registration** — Part A, TRN generation/login, Part B (all 10 tabs including Aadhaar authentication), EVC/DSC submission, simulated approval
- **Taxpayer login & dashboard**
- **Returns** — GSTR-1 and GSTR-3B filing
- **Ledgers** — Electronic Cash / Credit / Liability registers
- **e-Way Bill** — generate, update, extend, consolidate, cancel
- **e-Invoice** — IRN generation and verification
- **Refunds** — application and status tracking
- **Amendments, cancellation, and application tracking**
- **Search & support** — HSN/Taxpayer search, Grievance Redressal, Help Desk content

A fixed **Universal TRN** (`270000000000001`) is available on the TRN-login screen as a one-step shortcut into a fresh Part-B application, useful for demos.

## Tech

Single-page vanilla HTML/CSS/JS — no build step, no framework, no backend. Installable as a PWA (offline-capable via a service worker). Map screens use [Leaflet](https://leafletjs.com/) with OpenStreetMap tiles, loaded from a CDN.

## License

© 2026 Ananthu Shaji. All Rights Reserved. See [LICENSE](LICENSE).
