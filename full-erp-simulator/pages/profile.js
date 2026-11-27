/* =============================================================================
   DOT ERP — pages/profile.js
   Module 04: User Profile

   Uses window.ERP (shared runtime from ../script.js) and ERP_UserRepository
   (user directory + overrides layer from ../data/users.js). Both load before
   this file — see the <script> order at the bottom of profile.html.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, generateId, formatDateTime, formatRelativeTime, escapeHtml,
    showToast, openModal, closeModal, openConfirm, requireSession,
    updateActiveSession, runBootSequence, passwordLimits, STORAGE_KEYS,
    emailPattern: EMAIL_RE
  } = window.ERP;

  const ACTIVITY_LOG_KEY = STORAGE_KEYS.profileActivityLog;
  const LOGIN_HISTORY_PAGE_SIZE = 5;
  const ACTIVITY_ICON = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M13 7.5 16.5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  let session = null;
  let currentUser = null;

  let loginHistorySortOrder = "desc";
  let loginHistorySearchTerm = "";
  let loginHistoryPage = 1;


  /* -----------------------------------------------------------------------
     PROFILE OVERVIEW (view mode)
     --------------------------------------------------------------------- */
  function formatDateOnly(date) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  function renderProfile(user) {
    const hasPhoto = !!user.photoDataUrl;
    $("#profileAvatarInitials").hidden = hasPhoto;
    $("#profileAvatarImg").hidden = !hasPhoto;
    if (hasPhoto) {
      $("#profileAvatarImg").src = user.photoDataUrl;
    } else {
      $("#profileAvatarInitials").textContent = user.avatarInitials || "--";
    }
    $("#removePhotoBtn").hidden = !hasPhoto;

    $("#profileFullName").textContent = user.fullName;
    $("#profileRoleDept").textContent = `${user.role} · ${user.department}`;
    $("#profileEmployeeId").textContent = user.id;
    $("#profileUsername").textContent = user.username;
    $("#profileEmail").textContent = user.email;
    $("#profilePhone").textContent = user.phone || "—";
    $("#profileJoined").textContent = user.joinedDate ? formatDateOnly(new Date(user.joinedDate)) : "—";
    $("#profileBio").textContent = user.bio || "No bio added yet.";

    $("#passwordLastChanged").textContent = user.passwordChangedAt
      ? formatDateTime(new Date(user.passwordChangedAt))
      : "Never — still using the password set when this account was created";
  }


  /* -----------------------------------------------------------------------
     EDIT PROFILE FORM
     --------------------------------------------------------------------- */
  function setFieldError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearEditErrors() { ["editFullName", "editEmail", "editPhone", "editBio"].forEach((f) => setFieldError(f, "")); }

  function enterEditMode(user) {
    $("#editFullName").value = user.fullName;
    $("#editEmail").value = user.email;
    $("#editPhone").value = user.phone || "";
    $("#editBio").value = user.bio || "";
    clearEditErrors();
    $("#profileViewMode").hidden = true;
    $("#profileEditForm").hidden = false;
    $("#editProfileBtn").hidden = true;
  }

  function exitEditMode() {
    $("#profileViewMode").hidden = false;
    $("#profileEditForm").hidden = true;
    $("#editProfileBtn").hidden = false;
  }

  function validateEditForm() {
    let valid = true;
    const fullName = $("#editFullName").value.trim();
    const email = $("#editEmail").value.trim();
    const phone = $("#editPhone").value.trim();
    const bio = $("#editBio").value.trim();
    clearEditErrors();

    if (!fullName) { setFieldError("editFullName", "Full name is required."); valid = false; }
    else if (fullName.length < 2) { setFieldError("editFullName", "Minimum 2 characters required."); valid = false; }
    else if (fullName.length > 60) { setFieldError("editFullName", "Maximum 60 characters allowed."); valid = false; }

    if (!email) { setFieldError("editEmail", "Email is required."); valid = false; }
    else if (email.length > 60) { setFieldError("editEmail", "Maximum 60 characters allowed."); valid = false; }
    else if (!EMAIL_RE.test(email)) { setFieldError("editEmail", "Enter a valid email address."); valid = false; }

    const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
    if (!phone) { setFieldError("editPhone", "Phone number is required."); valid = false; }
    else if (!PHONE_RE.test(phone)) { setFieldError("editPhone", "Enter a valid phone number."); valid = false; }

    if (bio.length > 180) { setFieldError("editBio", "Maximum 180 characters allowed."); valid = false; }

    return valid;
  }

  function bindEditProfile() {
    $("#editProfileBtn").addEventListener("click", () => enterEditMode(currentUser));
    $("#cancelProfileBtn").addEventListener("click", exitEditMode);
    $("#resetProfileBtn").addEventListener("click", () => {
      enterEditMode(currentUser);
      showToast("Changes reset to your saved profile.", "info");
    });

    $("#profileEditForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateEditForm()) return;

      openConfirm({
        title: "Save profile changes?",
        message: "Your name, email, phone and about section will be updated.",
        confirmLabel: "Save changes",
        onConfirm: () => {
          const partial = {
            fullName: $("#editFullName").value.trim(),
            email: $("#editEmail").value.trim(),
            phone: $("#editPhone").value.trim(),
            bio: $("#editBio").value.trim()
          };
          ERP_UserRepository.saveOverride(session.username, partial);
          updateActiveSession({ fullName: partial.fullName });
          logActivity("Profile details updated");

          currentUser = ERP_UserRepository.findByUsername(session.username);
          renderProfile(currentUser);
          renderActivity();
          exitEditMode();
          showToast("Profile updated.", "success");
        }
      });
    });
  }


  /* -----------------------------------------------------------------------
     AVATAR PHOTO (stored locally as a data URL — no backend needed)
     --------------------------------------------------------------------- */
  const MAX_PHOTO_BYTES = 300 * 1024; // 300 KB, kept modest to respect localStorage quota

  function bindAvatarUpload() {
    $("#changePhotoBtn").addEventListener("click", () => $("#avatarFileInput").click());

    $("#avatarFileInput").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ""; // allow re-selecting the same file next time
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        showToast("Please choose an image file.", "warning");
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        showToast("Image is too large — please choose a file under 300 KB.", "warning");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const ok = ERP_UserRepository.saveOverride(session.username, { photoDataUrl: reader.result });
        if (!ok) { showToast("Could not save photo — local storage is full.", "danger"); return; }
        currentUser = ERP_UserRepository.findByUsername(session.username);
        renderProfile(currentUser);
        logActivity("Profile photo updated");
        renderActivity();
        showToast("Profile photo updated.", "success");
      };
      reader.onerror = () => showToast("Could not read that image file.", "danger");
      reader.readAsDataURL(file);
    });

    $("#removePhotoBtn").addEventListener("click", () => {
      openConfirm({
        title: "Remove profile photo?",
        message: "Your avatar will go back to showing your initials.",
        confirmLabel: "Remove photo",
        onConfirm: () => {
          ERP_UserRepository.saveOverride(session.username, { photoDataUrl: null });
          currentUser = ERP_UserRepository.findByUsername(session.username);
          renderProfile(currentUser);
          logActivity("Profile photo removed");
          renderActivity();
          showToast("Profile photo removed.", "info");
        }
      });
    });
  }


  /* -----------------------------------------------------------------------
     CHANGE PASSWORD (writes through to the same repository Login reads)
     --------------------------------------------------------------------- */
  function clearPasswordErrors() {
    ["currentPassword", "newPassword", "confirmNewPassword"].forEach((id) => setFieldError(id, ""));
  }

  function bindChangePassword() {
    $("#openChangePasswordBtn").addEventListener("click", () => {
      ["currentPassword", "newPassword", "confirmNewPassword"].forEach((id) => { $("#" + id).value = ""; });
      clearPasswordErrors();
      openModal("changePasswordModal");
    });

    $("#submitChangePasswordBtn").addEventListener("click", () => {
      const current = $("#currentPassword").value;
      const next = $("#newPassword").value;
      const confirmVal = $("#confirmNewPassword").value;
      clearPasswordErrors();
      let valid = true;

      if (!current) { setFieldError("currentPassword", "Current password is required."); valid = false; }
      else if (!ERP_UserRepository.verifyPassword(session.username, current)) { setFieldError("currentPassword", "Current password is incorrect."); valid = false; }

      if (!next) { setFieldError("newPassword", "New password is required."); valid = false; }
      else if (ERP_UserRepository.passwordProblem(next)) { setFieldError("newPassword", ERP_UserRepository.passwordProblem(next)); valid = false; }
      else if (current && next === current) { setFieldError("newPassword", "New password must be different from your current password."); valid = false; }

      if (!confirmVal) { setFieldError("confirmNewPassword", "Please confirm your new password."); valid = false; }
      else if (confirmVal !== next) { setFieldError("confirmNewPassword", "Passwords do not match."); valid = false; }

      if (!valid) return;

      openConfirm({
        title: "Change your password?",
        message: "You'll need to use the new password the next time you sign in.",
        confirmLabel: "Change password",
        allowForViewer: true,
        onConfirm: () => {
          const btn = $("#submitChangePasswordBtn");
          btn.disabled = true;
          $("#changePasswordSpinner").hidden = false;
          btn.querySelector(".btn-label").textContent = "Updating…";

          setTimeout(() => {
            const result = ERP_UserRepository.changePassword(session.username, current, next);
            btn.disabled = false;
            $("#changePasswordSpinner").hidden = true;
            btn.querySelector(".btn-label").textContent = "Update Password";
            if (!result.ok) { setFieldError("newPassword", result.error); return; }
            currentUser = ERP_UserRepository.findByUsername(session.username);
            renderProfile(currentUser);
            logActivity("Password changed");
            renderActivity();
            closeModal("changePasswordModal");
            showToast("Password updated. Use it next time you sign in.", "success", { title: "Security" });
            if (new URLSearchParams(window.location.search).get("forcePassword")) window.location.href = "dashboard.html";
          }, 60);
        }
      });
    });
  }


  /* -----------------------------------------------------------------------
     ACCOUNT ACTIVITY (local audit trail of changes made on this page)
     --------------------------------------------------------------------- */
  function logActivity(text) {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY)) || []; } catch { /* ignore */ }
    log.unshift({ id: generateId("ACT"), username: session.username, text, timestamp: new Date().toISOString() });
    if (log.length > 40) log.length = 40;
    localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(log));
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY)) || []; } catch { /* ignore */ }
    log = log.filter((e) => e.username.toLowerCase() === session.username.toLowerCase()).slice(0, 10);

    $("#accountActivityEmptyState").hidden = log.length !== 0;
    $("#accountActivityList").innerHTML = log.map((e) => `
      <li class="activity-item">
        <span class="activity-item__icon">${ACTIVITY_ICON}</span>
        <div>
          <p class="activity-item__text">${escapeHtml(e.text)}</p>
          <p class="activity-item__time">${formatRelativeTime(new Date(e.timestamp))}</p>
        </div>
      </li>
    `).join("");
  }


  /* -----------------------------------------------------------------------
     LOGIN HISTORY (this user's slice of the Module 1 audit log)
     --------------------------------------------------------------------- */
  function statusLabel(status) {
    if (status === "PASSWORD_RESET_REQUEST") return "Reset requested";
    if (status === "PASSWORD_RESET") return "Password reset";
    return status.charAt(0) + status.slice(1).toLowerCase();
  }
  function statusBadgeClass(status) {
    if (status === "SUCCESS") return "status-badge--success";
    if (status === "FAILED") return "status-badge--danger";
    return "status-badge--info";
  }

  function getMyLoginHistory() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(STORAGE_KEYS.auditLog)) || []; } catch { /* ignore */ }
    log = log.filter((e) => e.username.toLowerCase() === session.username.toLowerCase());
    if (loginHistorySearchTerm) {
      const term = loginHistorySearchTerm.toLowerCase();
      log = log.filter((e) => statusLabel(e.status).toLowerCase().includes(term) || e.device.toLowerCase().includes(term));
    }
    log.sort((a, b) => {
      const diff = new Date(a.timestamp) - new Date(b.timestamp);
      return loginHistorySortOrder === "desc" ? -diff : diff;
    });
    return log;
  }

  function renderLoginHistoryPagination(totalPages) {
    const container = $("#loginHistoryPagination");
    container.innerHTML = "";
    if (totalPages <= 1) return;
    const makeBtn = (label, disabled, onClick, active) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "page-btn" + (active ? " is-active" : "");
      btn.textContent = label;
      btn.disabled = !!disabled;
      btn.addEventListener("click", onClick);
      return btn;
    };
    container.appendChild(makeBtn("‹", loginHistoryPage === 1, () => { loginHistoryPage--; renderLoginHistory(); }));
    for (let p = 1; p <= totalPages; p++) {
      container.appendChild(makeBtn(String(p), false, () => { loginHistoryPage = p; renderLoginHistory(); }, p === loginHistoryPage));
    }
    container.appendChild(makeBtn("›", loginHistoryPage === totalPages, () => { loginHistoryPage++; renderLoginHistory(); }));
  }

  function renderLoginHistory() {
    const all = getMyLoginHistory();
    const totalPages = Math.max(1, Math.ceil(all.length / LOGIN_HISTORY_PAGE_SIZE));
    loginHistoryPage = Math.min(loginHistoryPage, totalPages);
    const start = (loginHistoryPage - 1) * LOGIN_HISTORY_PAGE_SIZE;
    const pageItems = all.slice(start, start + LOGIN_HISTORY_PAGE_SIZE);

    $("#loginHistoryEmptyState").hidden = all.length !== 0;
    $("#loginHistoryTable").hidden = all.length === 0;

    $("#loginHistoryTableBody").innerHTML = pageItems.map((e) => `
      <tr>
        <td><code>${escapeHtml(e.id)}</code></td>
        <td>${formatDateTime(new Date(e.timestamp))}</td>
        <td><span class="status-badge ${statusBadgeClass(e.status)}">${escapeHtml(statusLabel(e.status))}</span></td>
        <td>${escapeHtml(e.device)}</td>
      </tr>
    `).join("");

    renderLoginHistoryPagination(totalPages);
  }

  function exportLoginHistoryCsv() {
    const rows = getMyLoginHistory();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Log ID", "Timestamp", "Status", "Device"];
    const csvRows = [header.join(",")];
    rows.forEach((r) => {
      const line = [r.id, formatDateTime(new Date(r.timestamp)), statusLabel(r.status), r.device]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "erp-my-login-history.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Login history exported as CSV.", "success", { title: "Export complete" });
  }

  function printLoginHistory() {
    const rows = getMyLoginHistory();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((r) => `
      <tr><td>${escapeHtml(r.id)}</td><td>${formatDateTime(new Date(r.timestamp))}</td><td>${escapeHtml(statusLabel(r.status))}</td><td>${escapeHtml(r.device)}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - My Login History</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>Dot ERP — My Login History</h1>
        <p>Account: ${escapeHtml(session.username)} · Generated ${formatDateTime(new Date())} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Log ID</th><th>Timestamp</th><th>Status</th><th>Device</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast("Opened the print dialog.", "info", { title: "Print" });
  }

  function bindLoginHistoryUi() {
    $("#loginHistorySortBtn").addEventListener("click", () => {
      loginHistorySortOrder = loginHistorySortOrder === "desc" ? "asc" : "desc";
      $("#loginHistorySortBtn").textContent = loginHistorySortOrder === "desc" ? "Newest first" : "Oldest first";
      loginHistoryPage = 1;
      renderLoginHistory();
    });
    $("#loginHistoryExportBtn").addEventListener("click", exportLoginHistoryCsv);
    $("#loginHistoryPrintBtn").addEventListener("click", printLoginHistory);

    // The shared topbar search box doubles as this page's Login History filter.
    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      loginHistorySearchTerm = e.target.value;
      loginHistoryPage = 1;
      renderLoginHistory();
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return; // requireSession already redirected
    if (!window.ERP.enforcePageAccess(session, "profile")) return;

    runBootSequence([
      { p: 30, t: "Authenticating session…" },
      { p: 65, t: "Loading your profile…" },
      { p: 100, t: "Ready." }
    ]);

    currentUser = ERP_UserRepository.findByUsername(session.username);
    renderProfile(currentUser);
    renderActivity();
    renderLoginHistory();

    bindEditProfile();
    bindAvatarUpload();
    bindChangePassword();
    bindLoginHistoryUi();

    if (currentUser && currentUser.mustChangePassword) {
      $("#openChangePasswordBtn").click();
      showToast("Your administrator gave you a temporary password. Choose your own to continue.", "info", { title: "Set a new password" });
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
