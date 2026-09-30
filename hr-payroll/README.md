# SKELORA — HR & Payroll ERP Training Simulator

An industry-grade HR & Payroll ERP training simulator for HR, MBA, BBA, BCom
and Payroll students — the full employee lifecycle from Job Vacancy through
Full & Final Settlement, styled and behaving like a real corporate HRMS
(SAP SuccessFactors / Oracle HCM / Zoho People / Darwinbox / GreytHR class of
product), built for classroom training rather than production payroll use.

**Stack:** HTML, CSS, vanilla JavaScript only. No backend, no build step,
no framework. All data is stored in the browser's LocalStorage.

## ⚠️ Read this before rolling out to a class

**There is no shared server or database.** Every browser (and every separate
device) keeps its own independent copy of all data. This means:

- Each student's computer/browser has its **own** vacancies, employees,
  payroll runs, etc. — nothing syncs between machines.
- If a student uses a different browser, a different computer, or an
  Incognito/Private window, they'll start with a **blank slate** again.
- There's no way for an instructor to see a live dashboard of all students'
  work from one place — each install is fully independent.

This is by design (it's what keeps the whole thing running with zero backend
and zero hosting cost), but it's worth briefing students on before their
first session, and worth deciding as an institute whether each student gets
their own device/profile, or a shared computer resets between sessions.

## Running it

**Quickest — just open the file:**
Double-click `index.html`. It works immediately in any modern browser.
The one thing that *won't* work this way is installing it as a PWA
(browsers require a real http/https origin — or `localhost` — for that,
not a plain `file://` path).

**To enable PWA install (recommended for a lab/classroom):**
Serve the folder over http instead of opening the file directly. Any static
file server works, for example, from inside this folder:

```
python3 -m http.server 8080
```

then visit `http://localhost:8080` in the browser. You'll see an install
icon in the address bar (Chrome/Edge) or an "Install App" option in the
browser menu. Once installed, it opens as its own window/app icon and
works fully offline — the service worker caches the whole app shell.

**Hosting it for real (GitHub Pages, free):**
1. Push this folder to a GitHub repository.
2. Repo → Settings → Pages → Deploy from a branch → pick `main` and `/ (root)`.
3. GitHub gives you a `https://<username>.github.io/<repo>/` URL — open that,
   and the install prompt / offline support works there too, for anyone with
   the link.

## Logging in

Students can create their own account directly from the login screen —
click **Create Account**, pick a username and password, and they're
signed in immediately with the HR role (full access to every phase, Job
Vacancy through Full & Final Settlement). This gives each student their
own name/identity in the app (e.g. in the Audit Log) — it does **not**
give them separate data. Everyone on the same browser still shares the
same Employee Master, Payroll, etc. (see the warning at the top);
separate accounts mainly matter when each student has their own device.

| Role | Username | Password | Sees |
|---|---|---|---|
| Admin | `admin` | `admin123` | Everything, incl. Settings & Login Accounts |
| HR | `hr` | `hr123` | All 15 phases, Reports, Compliance, Letters |
| Manager | *(created per-employee)* | | Team leave approvals, team attendance |
| Employee | *(created per-employee)* | | Own profile, leave, payslips |

Manager and Employee logins are created from **Employee Master → Self-Service
Login** once an employee record exists — see the in-app hint on the login
screen. Change the default Admin/HR passwords before real classroom use if
that matters for your setting (they're hardcoded as `seedDefaultUsers()` near
the top of `script.js`).

## What's inside

- **15-phase recruitment-to-exit workflow**, locked in sequence: Job Vacancy →
  Resume → Screening → Shortlisting → Interview → Selection → Offer Letter →
  Joining Formalities → Employee Master → Attendance → Leave → Payroll
  Processing → Salary Slip → Exit Management → Full & Final Settlement.
- **Real Indian payroll tax engine** — old/new regime slabs, HRA exemption,
  80C, rebate u/s 87A, surcharge, cess, and state-wise Professional Tax.
- **Documents, all PDF-downloadable**: Offer Letter, Salary Slip, Form 16 /
  Annual Tax Statement, Full & Final Settlement Certificate, and a Letters
  Generator (Increment, Promotion, Warning, Relieving, Experience Certificate).
- **Role-based logins**: Admin, HR, Manager, Employee self-service, each with
  their own views and permissions.
- **Reports & Analytics**, an **Audit Log**, a **Compliance Calendar** (PF/
  ESI/PT/TDS due dates), and CSV exports (Employee Master, Payroll Register,
  Leave Register, Bank Transfer Advice).

## Updating it later

If you edit `index.html`, `script.js`, `style.css`, or anything under
`assets/`, bump `CACHE_NAME` in `sw.js` (e.g. `skelora-v1` → `skelora-v2`).
Otherwise browsers that already installed it will keep serving the old
cached version instead of picking up your changes.
