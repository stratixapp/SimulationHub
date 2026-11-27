/* =============================================================================
   DOT ERP
   FILE:  data/payroll-data.js
   ROLE:  Data-access layer for Payroll Processing / Payslip Generation —
          Phase 9, Module 04, and the module every other one this phase
          was actually building toward. Genuine storage
          (`erp_payroll_runs`) — a payroll run and its own payslip lines
          are the real, final financial fact of what each employee was
          actually paid for a period.

   THE RECONCILIATION THIS WHOLE PHASE WAS SET UP FOR — LEAVE TAKES
   PRIORITY OVER ATTENDANCE, UNMARKED DAYS ASSUME PAID: `computeLopForPeriod()`
   below walks every calendar day of a period for one employee and decides
   paid/unpaid using a strict precedence: (1) if Leave Application's own
   `getApprovedLeaveDaysInRange()` says anything about that day, that
   wins — an Approved leave is an authorized DECISION, outranking
   Attendance's own unexplained fact-recording if the two ever disagree
   (e.g. HR marked someone Absent on a day they had approved leave for).
   (2) Otherwise, Attendance's own record for that day applies —
   Present/Week Off/Holiday pay in full, Half Day pays half, Absent is a
   real loss of pay. (3) A day with NEITHER a leave record NOR an
   attendance record is assumed PAID, not penalized — the same
   deliberate, named simplification Attendance's own header already
   committed to (a trainee shouldn't have to mark every single routine
   Present day just to avoid an incorrect LOP deduction). This file is
   the ONE place all three modules' own outputs finally meet.

   STRUCTURE RESOLVED AS OF THE PERIOD'S LAST DAY, NOT SPLIT ACROSS A
   MID-MONTH RAISE: if a raise's own `effectiveFrom` falls inside the
   period being processed, the WHOLE period pays at the new rate — a
   deliberate simplification. Real payroll systems can split a single
   month's pay across two structures when a raise lands mid-month;
   modeling that properly would mean prorating not just by LOP days but
   by which STRUCTURE was in effect on each individual day, a real jump
   in complexity this module doesn't take on. `getEffectiveStructure()`
   is called once, with the period's own last date, per employee.

   EARNINGS PRORATE WITH LOP; PROFESSIONAL TAX AND TDS DON'T: Basic, HRA,
   and Special Allowance all scale down by `payableDays / daysInMonth`
   when there's any LOP — a real loss of pay should actually reduce pay.
   PF then naturally prorates too, since it's computed as a percentage of
   the now-prorated Basic. Professional Tax and TDS stay exactly as
   Salary Structure defined them regardless of LOP — both are flat,
   statutory/estimated monthly figures in this simulator (see that
   file's own header), not amounts that scale with days worked.

   A DRAFT RUN IS REGENERABLE; PROCESSING FREEZES IT FOR GOOD:
   `generateRun()` doubles as both "create" and "refresh" — calling it
   again for a period that already has a Draft run recomputes every line
   in place (useful if Attendance or Leave records changed after the
   first generation but before anyone signed off on it). Once a run is
   Processed, its own `payslipLines` become the permanent historical
   record — the same "resolve once, freeze, don't re-derive later" shape
   Sales Order's own copied fields and Salary Structure's own frozen
   history both already use. A later edit to Salary Structure, Attendance,
   or Leave Application never reaches back and changes a Processed run's
   own numbers.

   ONE RUN PER (companyId, periodYear, periodMonth), EXCLUDING CANCELLED
   — the familiar resolution #7 shape, with the same "Cancelled doesn't
   block a redo" exception most of this project's own transactional
   uniqueness checks already carry.

   PAYSLIP GENERATION IS A VIEW, NOT A SEPARATE STORED DOCUMENT: every
   figure a payslip needs already lives on its own run's own
   `payslipLines` entry. `getPayslipView()` below just reshapes one line
   for display/print, the same "genuine storage vs. pure computation"
   judgment call this project has made explicitly every time a second
   storage location would only risk drifting from the first.

   GL POSTING LIVES IN gl-posting-data.js, NOT HERE — BUILT IN A LATER
   PASS, EXACTLY AS THIS FILE ORIGINALLY SAID IT WOULD BE: this file's own
   first version deliberately left GL integration for a dedicated future
   pass, the same scale of work as Phase 6's own GL Mapping / GL Posting
   effort — that pass has since happened. `pages/payroll.js` now calls
   `ERP_GlPostingRepository.postPayrollProcessing()` right after a
   successful `process()` and `.postSalaryPayment()` right after a
   successful `markPaid()`, the same "business module doesn't know GL
   posting exists" separation every other Phase 6 retrofit point already
   uses. Nothing in THIS file changed to support it — `process()` and
   `markPaid()` below are exactly what they always were; the page's own
   controller is where the two calls were added. See gl-posting-data.js's
   own header for the full accounting reasoning (which liabilities post,
   why Salary Payable is asked about at Mark-Paid time rather than stored
   on the run beforehand, and why Processing and Payment are two
   genuinely separate postings, not one combined entry).
   ========================================================================== */

const ERP_PAYROLL_KEY = "erp_payroll_runs";

const ERP_PayrollRepository = {

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_PAYROLL_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_PAYROLL_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((r) => r.companyId === companyId)
      .sort((a, b) => (b.periodYear - a.periodYear) || (b.periodMonth - a.periodMonth));
  },

  findById(id) {
    return this.getAll().find((r) => r.id === id) || null;
  },

  findActiveRunForPeriod(companyId, year, month) {
    return this.getAllForCompany(companyId).find((r) => r.periodYear === year && r.periodMonth === month && r.status !== "Cancelled") || null;
  },

  _periodBounds(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStr = String(month).padStart(2, "0");
    return {
      daysInMonth,
      periodFrom: `${year}-${monthStr}-01`,
      periodTo: `${year}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`
    };
  },

  /** {daysInMonth, payableDays, lopDays, presentDays, halfDays,
      weekOffDays, holidayDays, paidLeaveDays, unpaidLeaveDays,
      unmarkedDays} for one employee over [fromDate, toDate] — see file
      header for the Leave-over-Attendance-over-assume-paid precedence
      this walks day by day. */
  computeLopForPeriod(companyId, employeeId, fromDate, toDate) {
    const leaveMap = typeof ERP_LeaveRepository !== "undefined"
      ? ERP_LeaveRepository.getApprovedLeaveDaysInRange(companyId, employeeId, fromDate, toDate) : {};
    const attendanceByDate = {};
    if (typeof ERP_AttendanceRepository !== "undefined") {
      ERP_AttendanceRepository.getForEmployeeInRange(companyId, employeeId, fromDate, toDate).forEach((r) => { attendanceByDate[r.date] = r.status; });
    }

    const counts = { presentDays: 0, halfDays: 0, weekOffDays: 0, holidayDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0, unmarkedDays: 0 };
    let payableDays = 0;
    let totalDays = 0;

    let cursor = new Date(fromDate + "T00:00:00");
    const last = new Date(toDate + "T00:00:00");
    while (cursor <= last) {
      const iso = cursor.toISOString().slice(0, 10);
      totalDays++;

      if (leaveMap[iso]) {
        if (leaveMap[iso].isPaid) { payableDays += 1; counts.paidLeaveDays++; }
        else { counts.unpaidLeaveDays++; }
      } else if (attendanceByDate[iso]) {
        const status = attendanceByDate[iso];
        if (status === "Present") { payableDays += 1; counts.presentDays++; }
        else if (status === "Week Off") { payableDays += 1; counts.weekOffDays++; }
        else if (status === "Holiday") { payableDays += 1; counts.holidayDays++; }
        else if (status === "Half Day") { payableDays += 0.5; counts.halfDays++; }
        // Absent contributes 0 payable days — a real LOP day.
      } else {
        payableDays += 1; // unmarked, no leave -> assume paid
        counts.unmarkedDays++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return { daysInMonth: totalDays, payableDays, lopDays: totalDays - payableDays, ...counts };
  },

  /** Creates (or, if a Draft run for this period already exists,
      REGENERATES it in place) a run for `year`/`month` (month 1-indexed).
      Refuses — returns null — if an existing run for this period is
      already Processed or Paid; a Cancelled one never blocks a fresh
      run. Every Active employee without an effective Salary Structure as
      of the period's last day is recorded in `skippedEmployees`, not
      silently left off the run. */
  generateRun(company, year, month, actorUsername) {
    const existing = this.findActiveRunForPeriod(company.id, year, month);
    if (existing && existing.status !== "Draft") return null;

    const { daysInMonth, periodFrom, periodTo } = this._periodBounds(year, month);
    const employees = typeof ERP_EmployeeRepository !== "undefined"
      ? ERP_EmployeeRepository.getAllForCompany(company.id).filter((e) => e.status !== "Inactive") : [];

    const payslipLines = [];
    const skippedEmployees = [];

    employees.forEach((emp) => {
      const structure = typeof ERP_SalaryStructureRepository !== "undefined"
        ? ERP_SalaryStructureRepository.getEffectiveStructure(company.id, emp.id, periodTo) : null;
      if (!structure) { skippedEmployees.push({ employeeId: emp.id, reason: "No salary structure effective for this period" }); return; }

      const lop = this.computeLopForPeriod(company.id, emp.id, periodFrom, periodTo);
      const ratio = daysInMonth > 0 ? lop.payableDays / daysInMonth : 0;
      const figs = ERP_SalaryStructureRepository.computeFigures(structure);

      const basic = figs.basic * ratio;
      const hraAmount = figs.hraAmount * ratio;
      const specialAllowance = figs.specialAllowance * ratio;
      const grossEarnings = basic + hraAmount + specialAllowance;
      const pfAmount = basic * (Number(structure.pfPercent) || 0) / 100;
      const professionalTax = figs.professionalTax;
      const tds = figs.tds;
      const totalDeductions = pfAmount + professionalTax + tds;

      payslipLines.push({
        employeeId: emp.id,
        structureId: structure.id,
        daysInMonth,
        payableDays: lop.payableDays,
        lopDays: lop.lopDays,
        basic, hraAmount, specialAllowance, grossEarnings,
        pfAmount, professionalTax, tds, totalDeductions,
        netPay: grossEarnings - totalDeductions
      });
    });

    const record = {
      id: existing ? existing.id : ("PAY-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()),
      companyId: company.id,
      periodYear: year,
      periodMonth: month,
      status: "Draft",
      payslipLines,
      skippedEmployees,
      generatedAt: new Date().toISOString(),
      generatedByUsername: actorUsername || "system",
      processedAt: null,
      processedByUsername: null,
      paidAt: null,
      paidByUsername: null
    };

    const all = this.getAll();
    if (existing) {
      const idx = all.findIndex((r) => r.id === existing.id);
      all[idx] = record;
    } else {
      all.push(record);
    }
    this._saveAll(all);
    return record;
  },

  _update(id, partial) {
    const all = this.getAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...partial };
    this._saveAll(all);
    return all[idx];
  },

  /** Draft -> Processed. Locks the run's own payslipLines as permanent
      history — see file header. */
  process(id, actorUsername) {
    const run = this.findById(id);
    if (!run || run.status !== "Draft") return null;
    return this._update(id, { status: "Processed", processedAt: new Date().toISOString(), processedByUsername: actorUsername || "system" });
  },

  /** Processed -> Paid. */
  markPaid(id, actorUsername) {
    const run = this.findById(id);
    if (!run || run.status !== "Processed") return null;
    return this._update(id, { status: "Paid", paidAt: new Date().toISOString(), paidByUsername: actorUsername || "system" });
  },

  /** Draft or Processed -> Cancelled. Never available from Paid — money
      already marked paid is final, the same immutability Opening Stock's
      own Confirmed state carries. */
  cancel(id, actorUsername) {
    const run = this.findById(id);
    if (!run || (run.status !== "Draft" && run.status !== "Processed")) return null;
    return this._update(id, { status: "Cancelled", cancelledAt: new Date().toISOString(), cancelledByUsername: actorUsername || "system" });
  },

  /** Reshapes one payslip line for display/print — see file header for
      why this is a view over already-stored data, not a second storage
      location. Returns null if the run or the line doesn't exist. */
  getPayslipView(runId, employeeId) {
    const run = this.findById(runId);
    if (!run) return null;
    const line = run.payslipLines.find((l) => l.employeeId === employeeId);
    if (!line) return null;
    return { run, line };
  }
};
