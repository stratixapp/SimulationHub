/* ==========================================================================
   authorization.js — User Authorization: users, roles, permissions, log
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

  // Lazy-seed for accounts created before this module existed.
  if (!VATSIM.getAuthUsers().length) {
    VATSIM.generateInitialAuthUsers(account);
  }

  /* ---------------- Tabs ---------------- */
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector('.tab-panel[data-panel="' + btn.getAttribute("data-tab") + '"]').classList.add("active");
    });
  });

  /* ---------------- Authorized Users table ---------------- */
  function renderUsers() {
    const body = document.getElementById("usersBody");
    body.innerHTML = "";
    VATSIM.getAuthUsers().forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + u.name + (u.isOwner ? " <span style='color:var(--text-faint);font-size:11px'>(you)</span>" : "") + "</td>" +
        "<td>" + u.email + "</td>" +
        '<td><span class="role-badge ' + u.role + '">' + VATSIM.ROLES[u.role].label + "</span></td>" +
        '<td><span class="status-pill"><span class="status-dot ' + (u.status === "Active" ? "submitted" : "draft") + '"></span> ' + u.status + "</span></td>" +
        "<td>" + VATSIM.fmtDate(u.addedAt) + "</td>" +
        "<td></td>";
      const actionCell = tr.lastElementChild;
      if (!u.isOwner) {
        if (u.status === "Pending Approval") {
          const approveBtn = document.createElement("button");
          approveBtn.className = "btn btn-outline btn-sm";
          approveBtn.textContent = "✓ Approve";
          approveBtn.style.marginRight = "6px";
          approveBtn.addEventListener("click", () => { VATSIM.approveAuthUser(u.id); VATSIM.toast(u.name + " approved.", "success"); renderUsers(); renderLog(); });
          actionCell.appendChild(approveBtn);
        }
        const removeBtn = document.createElement("button");
        removeBtn.className = "btn btn-outline btn-sm";
        removeBtn.textContent = "✕ Remove";
        removeBtn.addEventListener("click", () => {
          if (confirm("Remove " + u.name + " from authorized users?")) {
            VATSIM.removeAuthUser(u.id);
            VATSIM.toast("User removed.", "info");
            renderUsers();
            renderLog();
          }
        });
        actionCell.appendChild(removeBtn);
      }
      body.appendChild(tr);
    });
  }

  /* ---------------- Role matrix ---------------- */
  function renderRoleMatrix() {
    const body = document.getElementById("roleMatrixBody");
    const perms = ["view", "file", "submit", "pay", "manage_users"];
    body.innerHTML = Object.keys(VATSIM.ROLES)
      .map((key) => {
        const r = VATSIM.ROLES[key];
        return (
          "<tr><td><span class='role-badge " + key + "'>" + r.label + "</span></td>" +
          perms.map((p) => '<td class="' + (r.perms.includes(p) ? "yes" : "no") + '">' + (r.perms.includes(p) ? "✓" : "—") + "</td>").join("") +
          "</tr>"
        );
      })
      .join("");
  }

  /* ---------------- Activity log ---------------- */
  function renderLog() {
    const body = document.getElementById("logBody");
    const log = VATSIM.getActivityLog();
    body.innerHTML = log.length
      ? log.map((l) => "<tr><td>" + VATSIM.fmtDate(l.ts) + " " + new Date(l.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + "</td><td>" + l.action + "</td><td>" + l.detail + "</td></tr>").join("")
      : '<tr><td colspan="3" style="text-align:center;color:var(--text-faint);padding:24px">No activity recorded yet.</td></tr>';
  }
  document.getElementById("btnExportLog").addEventListener("click", () => {
    const log = VATSIM.getActivityLog();
    if (!log.length) {
      VATSIM.toast("No activity to export yet.", "info");
      return;
    }
    const rows = log.map((l) => [
      VATSIM.fmtDate(l.ts) + " " + new Date(l.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      l.action,
      l.detail,
    ]);
    VATSIM.downloadCsv("Activity_Log_" + account.trn + "_" + VATSIM.todayISO() + ".csv", ["Date & Time", "Action", "Detail"], rows);
    VATSIM.toast("Activity log exported.", "success");
  });

  /* ---------------- Invite modal ---------------- */
  const modal = document.getElementById("inviteModal");
  function openModal() { modal.classList.add("open"); }
  function closeModal() {
    modal.classList.remove("open");
    document.getElementById("ivNameInput").value = "";
    document.getElementById("ivEmailInput").value = "";
    document.getElementById("ivName").classList.remove("invalid");
    document.getElementById("ivEmail").classList.remove("invalid");
  }
  document.getElementById("btnInvite").addEventListener("click", openModal);
  document.getElementById("closeInvite").addEventListener("click", closeModal);
  document.getElementById("cancelInvite").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  document.getElementById("submitInvite").addEventListener("click", () => {
    const name = document.getElementById("ivNameInput").value.trim();
    const email = document.getElementById("ivEmailInput").value.trim();
    const role = document.getElementById("ivRole").value;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    document.getElementById("ivName").classList.toggle("invalid", !name);
    document.getElementById("ivEmail").classList.toggle("invalid", !emailValid);
    if (!name || !emailValid) {
      VATSIM.toast("Please complete all required fields correctly.", "error");
      return;
    }
    if (VATSIM.getAuthUsers().some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      VATSIM.toast("This email is already an authorized user.", "error");
      document.getElementById("ivEmail").classList.add("invalid");
      return;
    }
    VATSIM.addAuthUser({ name, email, role });
    VATSIM.toast("Invitation sent to " + name + ". Awaiting approval.", "success");
    closeModal();
    renderUsers();
    renderLog();
  });

  renderUsers();
  renderRoleMatrix();
  renderLog();
})();
