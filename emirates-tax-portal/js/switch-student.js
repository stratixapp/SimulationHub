/* ==========================================================================
   switch-student.js — pick which student profile is active on this browser
   Created By Ananthu Shaji
   ========================================================================== */

(function () {
  "use strict";

  VATSIM.applyTextScale();
  document.querySelectorAll("[data-textsize]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = VATSIM.getSettings();
      const dir = btn.getAttribute("data-textsize");
      if (dir === "up") s.textScale = Math.min(1.3, (s.textScale || 1) + 0.1);
      else if (dir === "down") s.textScale = Math.max(0.85, (s.textScale || 1) - 0.1);
      else s.textScale = 1;
      VATSIM.saveSettings(s);
      VATSIM.applyTextScale();
    });
  });

  const registry = VATSIM.getStudentRegistry();
  const activeId = VATSIM.getActiveStudentId();
  const list = document.getElementById("rosterList");

  if (!registry.length) {
    list.innerHTML = '<div class="panel panel-pad" style="text-align:center;color:var(--text-faint)">No student profiles found yet on this browser.</div>';
    return;
  }

  registry
    .slice()
    .sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt))
    .forEach((student) => {
      // Pull a couple of live stats straight from that student's own
      // namespace (without switching into it) so the chooser is useful,
      // not just a bare list of names.
      const filings = VATSIM.readForStudent(student.id, "filings", []) || [];
      const submittedCount = filings.filter((f) => f.status === "Submitted").length;

      const card = document.createElement("div");
      card.className = "panel panel-pad";
      card.style.marginBottom = "12px";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.alignItems = "center";
      card.style.flexWrap = "wrap";
      card.style.gap = "12px";
      card.innerHTML =
        "<div>" +
        '<div style="font-weight:700;font-size:14px;color:var(--navy-900)">' + student.companyName +
        (student.id === activeId ? ' <span style="font-size:10.5px;font-weight:700;color:var(--gold-600)">· CURRENTLY ACTIVE</span>' : "") + "</div>" +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:2px">TRN ' + student.trn + " · " + student.email + "</div>" +
        '<div style="font-size:11.5px;color:var(--text-faint);margin-top:4px">' + filings.length + " tax period(s) on record, " + submittedCount + " submitted</div>" +
        "</div>";
      const btn = document.createElement("button");
      btn.className = "btn " + (student.id === activeId ? "btn-outline" : "btn-gold");
      btn.textContent = student.id === activeId ? "Continue" : "Switch to this Profile";
      btn.addEventListener("click", () => {
        VATSIM.switchActiveStudent(student.id);
        window.location.href = "login.html";
      });
      card.appendChild(btn);
      list.appendChild(card);
    });
})();
