# OATS — Office Administration Training Simulator

A fully offline, browser-based HR/Office Administration practical trainer for Skelora Institute. No backend, no internet dependency once loaded — all data lives in the browser (`localStorage`), scoped per logged-in student.

## 1. Host it on GitHub Pages

1. Create a new GitHub repository (e.g. `oats-simulator`) and upload everything **inside this `oats` folder** to the repository root (not the `oats` folder itself — its *contents*: `index.html`, `css/`, `js/`, `assets/`, `manifest.json`, `sw.js`).
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source: Deploy from a branch**, branch: `main`, folder: `/ (root)`. Save.
4. GitHub gives you a URL like `https://yourusername.github.io/oats-simulator/`. Share this with students.

It can take a minute or two for the first deploy to go live.

## 2. "Install" it like an app

Once hosted on GitHub Pages (HTTPS is required for this part — it won't work opening the file directly from disk):

- **On a computer (Chrome/Edge):** open the site → click the install icon (⊕) in the address bar → **Install**. It opens in its own window, in the Start Menu / Applications folder, no browser chrome.
- **On Android:** open the site in Chrome → menu (⋮) → **Add to Home screen**.
- **On iPhone/iPad:** open the site in Safari → Share icon → **Add to Home Screen**.

This works because of the included `manifest.json` and `sw.js` (service worker), which also cache the app so it keeps working with a flaky or no internet connection after the first visit.

If you'd rather not use GitHub Pages, students can still just open `index.html` directly by double-clicking it — everything works the same way, they just won't get the "Install" button (that specifically requires HTTPS).

## 3. Course Track (Core Office Administration vs Full HRMS)

Each student can pick their own track from Settings → Course Track:

- **Full HRMS (All Modules)** — the default. Nothing changes; every module, practical, and session stays visible.
- **Core Office Administration Only** — hides Payroll, Recruitment, Performance, Org Chart, and the entire Exit Management section from the sidebar and dashboard. Practicals and Practice Sessions automatically trim down to only the office-administration-relevant tasks (a session that touches an advanced module keeps only its core-relevant steps; sessions with no core steps at all — like the Performance Review cycle — are hidden entirely).

This is entirely a display setting, not a data restriction — switching tracks never deletes or locks anything, and Instructor Mode always scores every module regardless of the student's track, so you get an honest full picture either way. Use this if a given batch or course only needs the office administration fundamentals rather than the full HR Management scope.

## 4. Student login system

Each student creates their own account (Student ID + password) the first time they use it on a given computer:

- **New Student** tab → name, chosen Student ID, batch, password.
- **Student Login** tab, afterwards, to resume where they left off.
- All of a student's employees, attendance, leave records, and documents are stored under their Student ID only — separate from every other student who logs into the same computer.

**Important — this is a training-appropriate login, not bank-grade security.** Passwords are hashed but stored locally in the browser, not on a server. It exists to keep students' practice data from overwriting each other on shared lab PCs, not to protect sensitive real data.

## 5. Instructor Mode

Click the **Instructor** tab on the login screen.

- Default password: `skelora123` — change it immediately from the roster page ("Change Instructor Password").
- Shows every student registered **on that computer**, with a one-click "Open Dashboard" to view/grade their full simulation (including the automatic scoring in Instructor Mode → Practical Assessment).
- You can remove a student's account and data from there too.

**Note on multi-computer labs:** since there's no server, the instructor roster only shows students who registered *on that same machine*. If your lab has students on different PCs, review each machine separately, or standardize on one grading PC where students log in briefly for review at the end of the practical.

## 6. Backing up data

Each student (Settings → Data Management) can download a JSON backup of their own data and restore it later — useful if they switch computers, or before a browser/profile gets cleared.

## File structure
```
index.html           — app shell, login screen, sidebar/topbar
manifest.json        — PWA install config
sw.js                — offline caching / installability
css/style.css        — full design system
js/storage.js        — data layer, sample data generator, shared letterhead helper
js/auth.js           — login, registration, instructor roster
js/employees.js      — employee form, database, personal files, CSV import/export, exit checklist
js/attendance.js     — daily register, monthly sheet, regularization requests
js/leave.js          — leave application, register, balance calculator
js/documents.js      — letter/certificate generator, ID cards
js/payroll.js        — salary structures, monthly payroll run, payslips
js/recruitment.js    — job requisitions, candidate pipeline
js/performance.js    — appraisal cycles, KPI ratings
js/assets.js         — company asset inventory and issuance
js/orgchart.js       — reporting hierarchy visualization
js/reports.js        — reports, search, notifications, notices, calendar, instructor scoring
js/app.js            — router, dashboard, practicals, settings, error handling
assets/              — app icons
```

## Changelog highlights (latest version)
- Fixed: student data no longer leaks between logins on shared computers (stale employee/cycle/pipeline references).
- Fixed: the "Other" designation option in the employee form (now a proper searchable text field).
- Fixed: document letterhead is now driven by Settings (address/phone/email/logo) instead of being hardcoded.
- Fixed: a crash risk when exporting payroll for a since-deleted employee.
- Fixed: document/payslip print previews now size correctly regardless of content length.
- Added: Payroll & Payslips, Recruitment pipeline, Performance Appraisals, Asset Management, Org Chart.
- Added: CSV bulk import for employees, Recruitment→Employee hire flow, Employee Exit Checklist, Attendance Regularization requests.
- Added: a friendly error screen instead of a blank page if something ever breaks.

