/* =============================================================================
   DOT ERP
   FILE:  data/attendance-data.js
   ROLE:  Data-access layer for Attendance — Phase 9, Module 01. Genuine
          storage (`erp_attendance`) — a day's attendance is a real,
          independent fact (nothing else in this project records "was this
          person here on this date"), the same reasoning that gave Stock
          Ledger and Journal Entry their own storage rather than staying
          computed.

   ONE RECORD PER (employeeId, date) — BUT UPSERT, NOT RESOLUTION #7's
   HARD BLOCK — A THIRD VARIANT, NOT A COPY OF EITHER EXISTING ONE:
   Opening Stock's own (itemId, warehouseId) uniqueness (resolution #7)
   BLOCKS a second record outright — a second opening balance for the same
   item/warehouse is a real error to prevent. `snapshot-data.js`'s own
   upsert is narrower still — only TODAY's row is overwritable, because
   only today hasn't finished happening yet. Attendance needs a third
   shape: marking the same employee/date TWICE, for ANY date past or
   present, is normal, expected CORRECTION behavior in real HR practice
   (fixing a day someone mismarked), not a mistake to block. So
   `markAttendance()` below finds-or-creates on the (employeeId, date) key
   unconditionally — no date restriction the way Snapshot's own upsert
   has, because there's no "today hasn't settled yet" reasoning to lean
   on here; the reasoning is simply "corrections are normal and dates
   don't stop being correctable."

   NO LIFECYCLE AT ALL — THE CLOSEST PRECEDENT ISN'T A TRANSACTIONAL
   DOCUMENT, IT'S PLAIN MASTER-DATA CRUD: every other module built this
   project long has at least a Draft/Posted-style state, because recording
   the fact IS the business event worth gating. Marking attendance has no
   real-world approval gate — a real HRIS just records "present" or
   "absent" directly, the way Warehouse Master or Cost Centers record a
   fact with no workflow around it. (Contrast Leave Application, built
   right after this file, which genuinely DOES need an approval gate —
   the same phase, two genuinely different answers to "does this need a
   lifecycle," decided by what the real process actually requires, not by
   habit.)

   BULK MARK IS A REAL FEATURE, NOT A CONVENIENCE AFTERTHOUGHT: marking
   attendance one employee at a time through an Add modal would make this
   module practically unusable for its actual job (a company with even a
   modest headcount marking every employee, every working day). `bulkMark()`
   applies one date + one status to a list of employee ids in a single
   call, reusing `markAttendance()`'s own upsert per employee — the real
   workflow is "mark everyone Present, then individually flag the day's
   exceptions," not "mark everyone one at a time."

   NO "ON LEAVE" STATUS HERE, ON PURPOSE: Employee Master already has an
   "On Leave" employee STATUS (a long-term designation — sabbatical,
   maternity leave — set manually on the employee record itself), and
   Leave Application (this phase's next module) tracks day-level leave
   requests in its own right. Giving Attendance its own "On Leave" status
   too would mean the same fact could be recorded in three different
   places that could disagree. Attendance's own vocabulary is deliberately
   about PHYSICAL PRESENCE only (Present/Absent/Half Day/Week Off/
   Holiday); Payroll (Module 04) is the one place that reads BOTH this
   file and Leave Application together to work out a day's true paid/
   unpaid status — see that file's own header for how it reconciles the
   two without double-counting a single day.
   ========================================================================== */

const ERP_ATTENDANCE_KEY = "erp_attendance";

const ERP_ATTENDANCE_STATUSES = ["Present", "Absent", "Half Day", "Week Off", "Holiday"];

const ERP_AttendanceRepository = {
  statuses: ERP_ATTENDANCE_STATUSES,

  getAll() {
    try { return JSON.parse(localStorage.getItem(ERP_ATTENDANCE_KEY)) || []; }
    catch { return []; }
  },
  _saveAll(list) {
    try { localStorage.setItem(ERP_ATTENDANCE_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  },

  getAllForCompany(companyId) {
    return this.getAll()
      .filter((a) => a.companyId === companyId)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },

  findById(id) {
    return this.getAll().find((a) => a.id === id) || null;
  },

  getForEmployeeAndDate(companyId, employeeId, date) {
    return this.getAllForCompany(companyId).find((a) => a.employeeId === employeeId && a.date === date) || null;
  },

  getForEmployeeInRange(companyId, employeeId, fromDate, toDate) {
    return this.getAllForCompany(companyId)
      .filter((a) => a.employeeId === employeeId && a.date >= fromDate && a.date <= toDate);
  },

  /** The one real write path — see file header for why this upserts on
      (employeeId, date) rather than blocking a second write. Returns the
      created-or-updated record. */
  markAttendance(company, employeeId, date, status, notes, actorUsername) {
    const all = this.getAll();
    const idx = all.findIndex((a) => a.companyId === company.id && a.employeeId === employeeId && a.date === date);
    if (idx >= 0) {
      all[idx] = { ...all[idx], status, notes: notes || "", markedByUsername: actorUsername || all[idx].markedByUsername, updatedAt: new Date().toISOString() };
      this._saveAll(all);
      return all[idx];
    }
    const record = {
      id: "ATT-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      companyId: company.id,
      employeeId, date, status,
      notes: notes || "",
      markedByUsername: actorUsername || "system",
      createdAt: new Date().toISOString()
    };
    all.push(record);
    this._saveAll(all);
    return record;
  },

  /** Applies one date + one status to every id in `employeeIds`, one
      upsert each — see file header for why this is real functionality,
      not a nicety. Returns the list of resulting records. */
  bulkMark(company, employeeIds, date, status, actorUsername) {
    return (employeeIds || []).map((employeeId) => this.markAttendance(company, employeeId, date, status, "", actorUsername));
  },

  remove(id) {
    const all = this.getAll().filter((a) => a.id !== id);
    this._saveAll(all);
    return true;
  },

  /** {daysInMonth, presentDays, absentDays, halfDays, weekOffDays,
      holidayDays, markedDays, payableDaysFromAttendance}. `month` is
      1-indexed (January = 1), matching how it's shown and entered on
      screen — converted to JS's own 0-indexed Date internally.
      `payableDaysFromAttendance` counts Present/Week Off/Holiday as a
      full paid day and Half Day as half a paid day; Absent contributes
      0. This is ATTENDANCE's own view only — Payroll (Module 04) still
      has to cross-check Leave Application before treating an Absent or
      unmarked day as unpaid, since an Absent day covered by an Approved
      paid leave application is not actually a loss of pay. */
  getMonthlySummary(companyId, employeeId, year, month) {
    const daysInMonth = new Date(year, month, 0).getDate(); // month is 1-indexed; day 0 of next month = last day of this one
    const monthStr = String(month).padStart(2, "0");
    const fromDate = `${year}-${monthStr}-01`;
    const toDate = `${year}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;
    const rows = this.getForEmployeeInRange(companyId, employeeId, fromDate, toDate);

    const counts = { presentDays: 0, absentDays: 0, halfDays: 0, weekOffDays: 0, holidayDays: 0 };
    rows.forEach((r) => {
      if (r.status === "Present") counts.presentDays++;
      else if (r.status === "Absent") counts.absentDays++;
      else if (r.status === "Half Day") counts.halfDays++;
      else if (r.status === "Week Off") counts.weekOffDays++;
      else if (r.status === "Holiday") counts.holidayDays++;
    });

    const payableDaysFromAttendance = counts.presentDays + counts.halfDays * 0.5 + counts.weekOffDays + counts.holidayDays;

    return {
      daysInMonth,
      ...counts,
      markedDays: rows.length,
      payableDaysFromAttendance
    };
  }
};
