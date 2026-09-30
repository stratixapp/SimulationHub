/* =============================================================================
   DOT ERP — pages/user-role-management.js
   User & Role Management (Administrator only): create accounts, assign roles,
   activate / deactivate, reset passwords, and review recent sign-in activity.
   All account data goes through ERP_UserRepository (data/users.js).
   ========================================================================== */
(function () {
  "use strict";

  const { $, showToast, requireSession, runBootSequence, logSystemActivity, openModal, closeModal, openConfirm, escapeHtml, formatDateTime } = window.ERP;
  let session = null;

  function tempPassword() {
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ", a = "abcdefghjkmnpqrstuvwxyz", d = "23456789", all = A + a + d;
    const b = ERP_Crypto.randomBytes(12); const pick = (set, i) => set[b[i] % set.length];
    const chars = [pick(A, 0), pick(a, 1), pick(d, 2), pick(d, 3)];
    for (let i = 4; i < 12; i++) chars.push(pick(all, i));
    return chars.join("");
  }
  function setErr(id, msg) { const el = $("#" + id + "Error"); if (el) el.textContent = msg || ""; }

  function renderRoleReference() {
    $("#urmRoleReference").innerHTML = ERP_RBAC_ROLES.map((role) => {
      const desc = role === ERP_RBAC_ADMIN_ROLE ? "Every module, without exception."
        : role === ERP_RBAC_VIEWER_ROLE ? "Every module, view-only — no saving, posting, approving or deleting anywhere."
        : Object.keys(ERP_PAGE_ROLE_MAP).filter((k) => { const e = ERP_PAGE_ROLE_MAP[k]; return Array.isArray(e) && e.includes(role); }).length + " module(s), full rights within them.";
      return `<div><dt>${escapeHtml(role)}</dt><dd>${escapeHtml(desc)}</dd></div>`;
    }).join("");
  }

  function renderTable() {
    const users = ERP_UserRepository.all();
    $("#urmCount").textContent = users.length + (users.length === 1 ? " account" : " accounts");
    $("#urmTableBody").innerHTML = users.map((u) => {
      const self = session.username.toLowerCase() === u.username.toLowerCase();
      const opts = ERP_RBAC_ROLES.map((r) => `<option value="${escapeHtml(r)}"${r === u.role ? " selected" : ""}>${escapeHtml(r)}</option>`).join("");
      const active = u.status === "Active";
      return `<tr data-username="${escapeHtml(u.username)}">
        <td><div style="display:flex;align-items:center;gap:10px"><span class="avatar-circle" style="width:32px;height:32px;font-size:12px">${escapeHtml(initials(u.fullName))}</span>
          <div><div>${escapeHtml(u.fullName)}${self ? ' <span class="status-badge status-badge--info">You</span>' : ""}</div><div class="profile-subtle" style="font-size:12px">${escapeHtml(u.email || "")}</div></div></div></td>
        <td><code>${escapeHtml(u.username)}</code></td>
        <td>${escapeHtml(u.department || "—")}</td>
        <td><select class="select-field urm-role-select" data-username="${escapeHtml(u.username)}" ${self ? 'disabled title="You can\'t change your own role"' : ""}>${opts}</select></td>
        <td><span class="status-badge ${active ? "status-badge--success" : "status-badge--danger"}">${active ? "Active" : "Inactive"}</span>${u.mustChangePassword ? ' <span class="status-badge status-badge--info" title="Has a temporary password">Temp password</span>' : ""}</td>
        <td>${u.lastLoginAt ? escapeHtml(formatDateTime(new Date(u.lastLoginAt))) : '<span class="profile-subtle">Never</span>'}</td>
        <td><div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn btn--ghost btn--sm" data-act="reset" data-username="${escapeHtml(u.username)}">Reset password</button>
          ${self ? "" : `<button type="button" class="btn ${active ? "btn--danger-outline" : "btn--ghost"} btn--sm" data-act="${active ? "deactivate" : "activate"}" data-username="${escapeHtml(u.username)}">${active ? "Deactivate" : "Activate"}</button>`}
        </div></td></tr>`;
    }).join("");
  }
  function initials(n) { return String(n || "").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "U"; }

  function renderActivity() {
    const rows = ERP_UserRepository.signInHistory().slice(0, 12);
    const label = { SUCCESS: ["Signed in", "success"], FAILED: ["Failed", "danger"], PASSWORD_RESET: ["Password reset", "info"], PASSWORD_RESET_REQUEST: ["Reset requested", "info"] };
    $("#urmActivityBody").innerHTML = rows.length ? rows.map((e) => {
      const l = label[e.status] || [e.status, "info"];
      return `<tr><td>${escapeHtml(formatDateTime(new Date(e.timestamp)))}</td><td>${escapeHtml(e.username)}</td><td><span class="status-badge status-badge--${l[1]}">${escapeHtml(l[0])}</span></td><td>${escapeHtml(e.device)}</td></tr>`;
    }).join("") : '<tr><td colspan="4" class="profile-subtle">No sign-in activity recorded yet.</td></tr>';
  }

  function refresh() { renderTable(); renderRoleReference(); renderActivity(); }

  function share(username, password) {
    $("#urmShareUser").textContent = username; $("#urmSharePass").textContent = password;
    openModal("urmShareModal");
  }

  /* ---- add user ---- */
  function bindAdd() {
    $("#urmRole").innerHTML = '<option value="">Select a role…</option>' + ERP_RBAC_ROLES.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
    $("#urmAddBtn").addEventListener("click", () => {
      $("#urmUserForm").reset(); ["urmName", "urmEmail", "urmUsername", "urmRole", "urmTemp"].forEach((i) => setErr(i, ""));
      $("#urmTemp").value = tempPassword(); openModal("urmUserModal"); $("#urmName").focus();
    });
    $("#urmGenBtn").addEventListener("click", () => { $("#urmTemp").value = tempPassword(); });
    $("#urmUserSaveBtn").addEventListener("click", () => {
      ["urmName", "urmEmail", "urmUsername", "urmRole", "urmTemp"].forEach((i) => setErr(i, ""));
      const d = { fullName: $("#urmName").value.trim(), email: $("#urmEmail").value.trim(), username: $("#urmUsername").value.trim(), department: $("#urmDept").value.trim(), role: $("#urmRole").value, password: $("#urmTemp").value };
      let ok = true;
      if (d.fullName.length < 2) { setErr("urmName", "Enter the person's full name."); ok = false; }
      if (!ERP_EMAIL_PATTERN.test(d.email)) { setErr("urmEmail", "Enter a valid email address."); ok = false; }
      if (!ERP_USERNAME_PATTERN.test(d.username)) { setErr("urmUsername", "3–30 letters, numbers, dot or underscore."); ok = false; }
      if (!d.role) { setErr("urmRole", "Choose a role."); ok = false; }
      const pp = ERP_UserRepository.passwordProblem(d.password); if (pp) { setErr("urmTemp", pp); ok = false; }
      if (!ok) return;
      const res = ERP_UserRepository.createUser(d, ERP_RBAC_ROLES);
      if (!res.ok) {
        if (/username/i.test(res.error)) setErr("urmUsername", res.error); else if (/email/i.test(res.error)) setErr("urmEmail", res.error); else showToast(res.error, "danger");
        return;
      }
      logSystemActivity({ module: "User & Role Management", action: "Create", description: `Created user ${d.username} as ${d.role}` });
      closeModal("urmUserModal"); refresh(); share(d.username, d.password);
    });
  }

  /* ---- reset password ---- */
  let resetTarget = null;
  function bindReset() {
    $("#urmResetGenBtn").addEventListener("click", () => { $("#urmResetTemp").value = tempPassword(); });
    $("#urmResetSaveBtn").addEventListener("click", () => {
      setErr("urmResetTemp", "");
      const pw = $("#urmResetTemp").value; const pp = ERP_UserRepository.passwordProblem(pw);
      if (pp) { setErr("urmResetTemp", pp); return; }
      const res = ERP_UserRepository.adminResetPassword(resetTarget, pw);
      if (!res.ok) { setErr("urmResetTemp", res.error); return; }
      logSystemActivity({ module: "User & Role Management", action: "Update", description: `Reset password for ${resetTarget}` });
      closeModal("urmResetModal"); refresh(); share(resetTarget, pw);
    });
    $("#urmShareCopyBtn").addEventListener("click", async () => {
      const text = `Username: ${$("#urmShareUser").textContent}\nTemporary password: ${$("#urmSharePass").textContent}`;
      try { await navigator.clipboard.writeText(text); showToast("Copied.", "success"); } catch { showToast("Select the text and copy it manually.", "info"); }
    });
  }

  /* ---- table actions ---- */
  function bindTable() {
    $("#urmTableBody").addEventListener("change", (e) => {
      const sel = e.target.closest(".urm-role-select"); if (!sel) return;
      const res = ERP_UserRepository.setRole(sel.dataset.username, sel.value, ERP_RBAC_ROLES);
      if (res.ok) {
        logSystemActivity({ module: "User & Role Management", action: "Update", description: `Changed ${sel.dataset.username}'s role to "${sel.value}"` });
        showToast(`${sel.dataset.username} is now ${sel.value}. It applies on their next page load.`, "success");
        renderRoleReference();
      } else { showToast(res.error || "Couldn't save that change.", "danger"); }
      renderTable();
    });
    $("#urmTableBody").addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const username = b.dataset.username, act = b.dataset.act;
      if (act === "reset") {
        resetTarget = username; setErr("urmResetTemp", "");
        $("#urmResetIntro").textContent = `Set a temporary password for ${username}. They'll be asked to choose their own at next sign-in.`;
        $("#urmResetTemp").value = tempPassword(); openModal("urmResetModal");
      } else {
        const to = act === "deactivate" ? "Inactive" : "Active";
        openConfirm({
          title: `${act === "deactivate" ? "Deactivate" : "Activate"} ${username}?`,
          message: act === "deactivate" ? "They will be signed out on their next page load and won't be able to sign in until reactivated. Their records stay intact." : "They will be able to sign in again.",
          confirmLabel: act === "deactivate" ? "Deactivate" : "Activate",
          onConfirm: () => {
            const res = ERP_UserRepository.setStatus(username, to);
            if (!res.ok) { showToast(res.error, "danger"); return; }
            logSystemActivity({ module: "User & Role Management", action: "Update", description: `${to === "Inactive" ? "Deactivated" : "Reactivated"} user ${username}` });
            refresh(); showToast(`${username} is now ${to.toLowerCase()}.`, "success");
          }
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "user-role-management")) return;
    runBootSequence([{ p: 35, t: "Authenticating session…" }, { p: 70, t: "Loading user accounts…" }, { p: 100, t: "Ready." }]);
    refresh(); bindAdd(); bindReset(); bindTable();
    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
