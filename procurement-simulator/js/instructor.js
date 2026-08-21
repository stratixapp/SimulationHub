// ─────────────────────────────────────────────────────────────
// Instructor — an Administrator-only console for reviewing every
// student registered ON THIS COMPUTER. There is no backend, so
// this works by reading each student's own save-slot directly out
// of the same browser's localStorage (the same slot that keeps
// their data isolated from each other during normal use). That
// means it only sees students who have signed in on THIS browser —
// it cannot see a student's work from a different computer, and
// scores/feedback left here live in a separate localStorage key
// on this machine only, not attached to the student's own account.
// ─────────────────────────────────────────────────────────────
var Instructor = (function () {
  const GRADES_KEY = 'procurement-simulator-grades';

  function hasLocalStorage() {
    try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch (e) { return false; }
  }

  function readStudentSnapshot(studentId) {
    if (!hasLocalStorage()) return null;
    try {
      const raw = localStorage.getItem(Store.storageKeyFor(studentId));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function loadGrades() {
    if (!hasLocalStorage()) return {};
    try {
      const raw = localStorage.getItem(GRADES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveGrade(studentId, score, feedback, gradedBy) {
    if (!hasLocalStorage()) return;
    const grades = loadGrades();
    grades[studentId] = { score: score === '' || score === null ? null : Number(score), feedback: feedback || '', gradedBy: gradedBy || 'Administrator', gradedAt: new Date().toISOString() };
    try { localStorage.setItem(GRADES_KEY, JSON.stringify(grades)); } catch (e) { /* storage full/unavailable */ }
  }

  function getGrade(studentId) {
    return loadGrades()[studentId] || null;
  }

  // One row per registered student: their snapshot (or null if they
  // registered but never actually saved any progress yet), a summary
  // via the existing Selectors (pure functions — work on any snapshot,
  // not just the live logged-in one), and their grade if any.
  function listStudents() {
    return Auth.listStudentIds().map((studentId) => {
      const snapshot = readStudentSnapshot(studentId);
      const summary = snapshot ? Selectors.procurementSummary(snapshot) : null;
      const lastActivity = snapshot && snapshot.activity && snapshot.activity[0] ? snapshot.activity[0].timestamp : null;
      const hasClosedCycle = !!(snapshot && snapshot.pos && snapshot.pos.some((p) => p.status === 'Closed'));
      return { studentId, snapshot, summary, lastActivity, hasClosedCycle, grade: getGrade(studentId) };
    });
  }

  function classSummary(students) {
    const withData = students.filter((s) => s.snapshot);
    const totalSpend = withData.reduce((sum, s) => sum + (s.summary ? s.summary.totalSpend : 0), 0);
    const closedCount = students.filter((s) => s.hasClosedCycle).length;
    return {
      totalStudents: students.length,
      activeStudents: withData.length,
      totalSpend,
      closedCount,
    };
  }

  return { GRADES_KEY, readStudentSnapshot, loadGrades, saveGrade, getGrade, listStudents, classSummary };
})();
