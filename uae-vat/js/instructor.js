/* ==========================================================================
   instructor.js — Instructor / Grading Mode
   Created By Ananthu Shaji
   ========================================================================== */

(function () {
  "use strict";

  const session = VATSIM.requireSession("../login.html");
  if (!session) return;
  const account = VATSIM.getAccount();
  if (!account) {
    window.location.href = "../index.html";
    return;
  }
  VATSIM.wireChrome();
  document.getElementById("instructorDate").value = VATSIM.todayISO();

  const registry = VATSIM.getStudentRegistry();
  const activeId = VATSIM.getActiveStudentId();
  const rosterBody = document.getElementById("rosterBody");

  let viewingId = activeId;
  let viewingLabel = account.companyName + " (" + account.trn + ")";
  let grade = null;

  function getTbAttemptsFor(studentId) {
    if (!studentId || studentId === activeId) return VATSIM.getTbAttempts();
    return VATSIM.readForStudent(studentId, "tbattempts", []);
  }

  function renderDetail() {
    grade = viewingId === activeId ? VATSIM.gradeAccount() : VATSIM.gradeStudentById(viewingId);

    document.querySelector("h1 span[data-company-name]").textContent = viewingLabel;
    document.getElementById("overallScore").textContent = grade.overallScore + "%";
    document.getElementById("overallFilingsCount").textContent = grade.totalFilings + " tax period(s) on record · " + grade.voluntaryDisclosureCount + " Voluntary Disclosure(s) filed";
    document.getElementById("scoreOnTime").textContent = grade.onTimeRate + "%";
    document.getElementById("scoreCompletion").textContent = grade.completionRate + "%";
    document.getElementById("scoreClean").textContent = grade.cleanRate + "%";
    document.getElementById("scorePenaltyFree").textContent = grade.penaltyFreeRate + "%";
    document.getElementById("scoreVd").textContent = grade.vdRate + "%";
    document.getElementById("totalPenaltyOut").textContent = "AED " + VATSIM.fmtAED(grade.totalPenalties);

    const body = document.getElementById("detailBody");
    body.innerHTML = grade.detail.length
      ? grade.detail
          .map((d) => {
            const onTimeCell = d.onTime === null ? "—" : d.onTime ? '<span style="color:var(--success)">✓ Yes</span>' : '<span style="color:var(--danger)">✕ Late</span>';
            const entryCell = d.status !== "Submitted" ? "—" : d.issues.length ? '<span style="color:var(--danger)" title="' + d.issues.join("; ") + '">✕ ' + d.issues.length + " issue(s)</span>" : '<span style="color:var(--success)">✓ Clean</span>';
            const penaltyCell = d.penalty > 0 ? '<span style="color:var(--danger)">AED ' + VATSIM.fmtAED(d.penalty) + "</span>" : "—";
            const vdCell = d.voluntaryDisclosure ? "✓ " + d.voluntaryDisclosure.referenceNumber : "—";
            return (
              "<tr><td>" + d.period + "</td><td>" + d.referenceNumber + "</td><td>" + d.status + "</td><td>" +
              onTimeCell + "</td><td>" + entryCell + "</td><td>" + penaltyCell + "</td><td>" + vdCell + "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="7" style="text-align:center;color:var(--text-faint);padding:24px">No tax periods on record yet.</td></tr>';

    const tbAttempts = getTbAttemptsFor(viewingId);
    document.getElementById("tbAttemptsBody").innerHTML = tbAttempts.length
      ? tbAttempts.map((a) => "<tr><td>" + VATSIM.fmtDate(a.date) + "</td><td>" + a.scorePct + "%</td><td>" + a.correctCount + " / " + a.total + "</td></tr>").join("")
      : '<tr><td colspan="3" style="text-align:center;color:var(--text-faint);padding:24px">No Trial Balance Exercise attempts yet.</td></tr>';
  }

  function paintRoster() {
    rosterBody.innerHTML = registry
      .slice()
      .sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))
      .map((s) => {
        const g = VATSIM.gradeStudentById(s.id);
        const isViewing = s.id === viewingId;
        return (
          "<tr" + (isViewing ? ' style="background:var(--gold-100)"' : "") + "><td>" + s.companyName +
          (s.id === activeId ? ' <span style="font-size:10px;color:var(--text-faint)">(logged in)</span>' : "") + "</td>" +
          "<td>" + s.trn + "</td><td><strong>" + g.overallScore + "%</strong></td><td>" + g.totalFilings +
          "</td><td>AED " + VATSIM.fmtAED(g.totalPenalties) + "</td>" +
          '<td><button class="btn btn-outline btn-sm" data-view="' + s.id + '">' + (isViewing ? "Viewing ↓" : "View Full Report") + "</button></td></tr>"
        );
      })
      .join("");
    rosterBody.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-view");
        const s = registry.find((r) => r.id === id);
        viewingId = id;
        viewingLabel = s.companyName + " (" + s.trn + ")" + (id !== activeId ? " — viewed by instructor" : "");
        renderDetail();
        paintRoster();
        document.getElementById("overallScore").scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  if (registry.length <= 1) {
    document.getElementById("rosterPanel").style.display = "none";
  } else {
    paintRoster();
  }
  renderDetail();

  /* ---------------- Print sign-off mirror ---------------- */
  window.addEventListener("beforeprint", () => {
    document.getElementById("printSignoff").style.display = "block";
    document.getElementById("printInstructorName").textContent = document.getElementById("instructorName").value || "—";
    document.getElementById("printInstructorDate").textContent = VATSIM.fmtDate(document.getElementById("instructorDate").value || VATSIM.todayISO());
    document.getElementById("printInstructorComments").textContent = document.getElementById("instructorComments").value || "";
  });

  /* ---------------- PDF report ---------------- */
  document.getElementById("btnDownloadReport").addEventListener("click", () => {
    VATSIM.showLoading("Preparing assessment report PDF…", 700).then(() => {
      const rows = [
        ["Student / Company", viewingLabel],
        ["Tax Periods on Record", String(grade.totalFilings)],
        ["Voluntary Disclosures Filed", String(grade.voluntaryDisclosureCount)],
        ["On-Time Filing Rate", grade.onTimeRate + "%"],
        ["Completion Rate", grade.completionRate + "%"],
        ["Box-Entry Accuracy", grade.cleanRate + "%"],
        ["Penalty-Free Rate", grade.penaltyFreeRate + "%"],
        ["Voluntary Disclosure Use", grade.vdRate + "%"],
        ["Overall Score", grade.overallScore + "%"],
        ["Total Estimated Penalties", "AED " + VATSIM.fmtAED(grade.totalPenalties)],
        ["Instructor", document.getElementById("instructorName").value || "—"],
        ["Assessment Date", VATSIM.fmtDate(document.getElementById("instructorDate").value || VATSIM.todayISO())],
      ];
      const comments = document.getElementById("instructorComments").value.trim();
      const ok = VATSIM.generatePdf({
        title: "Instructor Assessment Report",
        subtitle: "VAT201 Training Simulator — Skelora Institute",
        rows,
        bodyParas: comments ? ["Instructor Comments: " + comments] : [],
        filename: "Assessment_Report_" + viewingId + ".pdf",
      });
      if (ok) VATSIM.toast("Assessment report PDF downloaded.", "success");
    });
  });
})();
