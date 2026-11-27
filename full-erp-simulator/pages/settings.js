/* =============================================================================
   DOT ERP — pages/settings.js
   Settings

   Uses window.ERP (shared runtime from ../script.js). Preferences set here
   are read by formatDateTime / formatCurrency / the notification feed /
   the session-timeout timer / the logout confirmation — all defined once
   in script.js so this page only has to change the stored value.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, escapeHtml, showToast, openConfirm, openModal, closeModal, requireSession,
    getPreferences, savePreferences, applyDensityPreference, renderNotifications,
    defaultPreferences, logSystemActivity, STORAGE_KEYS
  } = window.ERP;

  let session = null;
  let draftPrefs = null;

  const FIELD_IDS = [
    "prefDateFormat", "prefNumberFormat", "prefDensity",
    "notifyLowStock", "notifyApprovals", "notifyOnboarding", "notifyCompliance", "notifySystem",
    "prefSessionTimeout", "prefConfirmLogout"
  ];

  /* -----------------------------------------------------------------------
     FORM <-> PREFERENCES OBJECT
     --------------------------------------------------------------------- */
  function populateForm(prefs) {
    $("#prefDateFormat").value = prefs.dateFormat;
    $("#prefNumberFormat").value = prefs.numberFormat;
    $("#prefDensity").value = prefs.density;

    $("#notifyLowStock").checked = prefs.notifyLowStock;
    $("#notifyApprovals").checked = prefs.notifyApprovals;
    $("#notifyOnboarding").checked = prefs.notifyOnboarding;
    $("#notifyCompliance").checked = prefs.notifyCompliance;
    $("#notifySystem").checked = prefs.notifySystem;

    $("#prefSessionTimeout").value = String(prefs.sessionTimeoutMinutes);
    $("#prefConfirmLogout").checked = prefs.confirmLogout;
  }

  function readFormIntoDraft() {
    draftPrefs = {
      dateFormat: $("#prefDateFormat").value,
      numberFormat: $("#prefNumberFormat").value,
      density: $("#prefDensity").value,
      notifyLowStock: $("#notifyLowStock").checked,
      notifyApprovals: $("#notifyApprovals").checked,
      notifyOnboarding: $("#notifyOnboarding").checked,
      notifyCompliance: $("#notifyCompliance").checked,
      notifySystem: $("#notifySystem").checked,
      sessionTimeoutMinutes: Number($("#prefSessionTimeout").value),
      confirmLogout: $("#prefConfirmLogout").checked
    };
    return draftPrefs;
  }


  /* -----------------------------------------------------------------------
     SAVE / DISCARD / RESET
     --------------------------------------------------------------------- */
  function bindPreferencesForm() {
    $("#settingsForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const next = readFormIntoDraft();
      savePreferences(next);
      applyDensityPreference();
      renderNotifications();
      if (window.ERP.bindSessionTimeout) window.ERP.bindSessionTimeout();
      logSystemActivity({ module: "Settings", action: "Update", description: "Saved preference changes" });
      showToast("Preferences saved.", "success", { title: "Settings" });
    });

    $("#discardPreferencesBtn").addEventListener("click", () => {
      populateForm(getPreferences());
      showToast("Unsaved changes discarded.", "info");
    });

    $("#resetPreferencesBtn").addEventListener("click", () => {
      openConfirm({
        title: "Reset preferences to defaults?",
        message: "This resets the form below to the default settings. Click Save Preferences afterwards to apply them.",
        confirmLabel: "Reset form",
        onConfirm: () => {
          populateForm(defaultPreferences);
          showToast("Form reset to defaults — click Save Preferences to apply.", "info");
        }
      });
    });
  }


  /* -----------------------------------------------------------------------
     DATA & PRIVACY
     --------------------------------------------------------------------- */
  function bindDataPrivacy() {
    $("#exportMyDataBtn").addEventListener("click", () => {
      let auditLog = [];
      let activityLog = [];
      try { auditLog = JSON.parse(localStorage.getItem(STORAGE_KEYS.auditLog)) || []; } catch { /* ignore */ }
      try { activityLog = JSON.parse(localStorage.getItem("erp_profile_activity_log")) || []; } catch { /* ignore */ }

      const username = session.username.toLowerCase();
      const user = (typeof ERP_UserRepository !== "undefined") ? ERP_UserRepository.findByUsername(username) : null;
      const profileSafe = user ? { ...user } : null;
      if (profileSafe) delete profileSafe.password;

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        account: profileSafe,
        preferences: getPreferences(),
        myLoginHistory: auditLog.filter((e) => e.username.toLowerCase() === username),
        myAccountActivity: activityLog.filter((e) => e.username.toLowerCase() === username)
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `erp-my-data-${username}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      logSystemActivity({ module: "Settings", action: "Export", description: "Exported personal data as JSON" });
      showToast("Your data was exported as a JSON file.", "success", { title: "Export complete" });
    });

    /* ---- administrator-only: company data backup / restore / factory reset ---- */
    const isAdmin = typeof ERP_RBAC_ADMIN_ROLE !== "undefined" && session.role === ERP_RBAC_ADMIN_ROLE;
    if (!isAdmin) return;
    $("#adminDataCard").hidden = false;
    $("#factoryResetCard").hidden = false;

    const LOCAL_ONLY_KEYS = new Set([
      "erp_active_session", "erp_login_attempts", "erp_remembered_username", "erp_sidebar_collapsed",
      "erp_sidebar_groups_expanded", "erp_theme_preference", "erp_user_preferences",
      "erp_notifications_read", "erp_notifications_dismissed", "erp_active_company_id"
    ]);
    const companyKeys = () => Object.keys(localStorage).filter((k) => k.indexOf("erp_") === 0 && !LOCAL_ONLY_KEYS.has(k));
    const BACKUP_LAST_KEY = "erp_last_backup_at";

    function refreshBackupNote() {
      const last = localStorage.getItem(BACKUP_LAST_KEY);
      $("#lastBackupNote").textContent = last ? `Last backup downloaded ${window.ERP.formatDateTime(new Date(last))}.` : "No backup has been downloaded from this device yet.";
    }
    refreshBackupNote();

    $("#backupCompanyBtn").addEventListener("click", () => {
      const store = {};
      companyKeys().forEach((k) => { store[k] = localStorage.getItem(k); });
      const payload = { format: "dot-erp-backup", version: 1, exportedAt: new Date().toISOString(), exportedBy: session.username, store };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `dot-erp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      localStorage.setItem(BACKUP_LAST_KEY, new Date().toISOString());
      refreshBackupNote();
      logSystemActivity({ module: "Settings", action: "Export", description: "Downloaded a full company data backup" });
      showToast("Backup downloaded. Keep it somewhere safe.", "success", { title: "Backup complete" });
    });

    $("#restoreCompanyBtn").addEventListener("click", () => $("#restoreCompanyInput").click());
    $("#restoreCompanyInput").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let payload;
        try { payload = JSON.parse(reader.result); } catch { showToast("That file isn't valid JSON.", "danger", { title: "Restore failed" }); return; }
        if (payload.format !== "dot-erp-backup" || typeof payload.store !== "object" || !payload.store) {
          showToast("That doesn't look like a Dot ERP backup file.", "danger", { title: "Restore failed" });
          return;
        }
        const keyCount = Object.keys(payload.store).length;
        openConfirm({
          title: "Restore this backup?",
          message: `This replaces all current company data on this device with the ${keyCount} record set${keyCount === 1 ? "" : "s"} from a backup taken ${payload.exportedAt ? window.ERP.formatDateTime(new Date(payload.exportedAt)) : "at an unknown time"}. Anything entered since then will be lost. You'll be signed out so the restored data loads cleanly.`,
          confirmLabel: "Restore & sign out",
          onConfirm: () => {
            companyKeys().forEach((k) => localStorage.removeItem(k));
            Object.keys(payload.store).forEach((k) => { if (k.indexOf("erp_") === 0 && !LOCAL_ONLY_KEYS.has(k)) localStorage.setItem(k, payload.store[k]); });
            sessionStorage.clear();
            window.location.href = "../index.html?reason=expired";
          }
        });
      };
      reader.readAsText(file);
    });

    /* ---- factory reset: admin-only, requires typing RESET ---- */
    const resetInput = $("#factoryResetPhrase"), resetConfirmBtn = $("#factoryResetConfirmBtn");
    $("#resetDemoDataBtn").addEventListener("click", () => {
      resetInput.value = ""; resetConfirmBtn.disabled = true;
      openModal("factoryResetModal");
      setTimeout(() => resetInput.focus(), 50);
    });
    resetInput.addEventListener("input", () => { resetConfirmBtn.disabled = resetInput.value.trim() !== "RESET"; });
    resetConfirmBtn.addEventListener("click", () => {
      if (resetInput.value.trim() !== "RESET") return;
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "../index.html";
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return; // requireSession already redirected
    if (!window.ERP.enforcePageAccess(session, "settings")) return;

    window.ERP.runBootSequence([
      { p: 30, t: "Authenticating session…" },
      { p: 65, t: "Loading your preferences…" },
      { p: 100, t: "Ready." }
    ]);

    populateForm(getPreferences());
    bindPreferencesForm();
    bindDataPrivacy();
    bindInstallApp();

    $("#footerYear").textContent = new Date().getFullYear();
  });

  /* ---- PWA install (assets/pwa.js captures the browser's own prompt on every page) ---- */
  function bindInstallApp() {
    const card = $("#installAppCard"), btn = $("#installAppBtn");
    if (!window.ERP_PWA) return;   // unsupported browser — assets/pwa.js didn't run its setup
    const show = () => { card.hidden = false; };
    if (window.ERP_PWA.canInstall) show();
    document.addEventListener("erp:install-available", show);
    window.addEventListener("appinstalled", () => { card.hidden = true; showToast("Dot ERP is installed.", "success"); });
    btn.addEventListener("click", () => {
      btn.disabled = true;
      window.ERP_PWA.promptInstall().then((choice) => {
        btn.disabled = false;
        if (choice.outcome === "accepted") card.hidden = true;
        else if (choice.outcome === "dismissed") showToast("You can install it anytime from here.", "info");
      });
    });
  }
})();
