/* =============================================================================
   DOT ERP — pages/notifications.js
   Module 06: Notifications

   Uses window.ERP (shared runtime from ../script.js), specifically the
   notification data-layer (getAllNotifications / addCustomNotification /
   dismissNotification / read tracking) so this page and the topbar bell
   always agree with each other.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, formatDateTime, formatRelativeTime, escapeHtml,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    getAllNotifications, addCustomNotification, updateCustomNotification,
    getReadNotificationIds, markNotificationRead, dismissNotification,
    renderNotifications, logSystemActivity, STORAGE_KEYS
  } = window.ERP;

  const PAGE_SIZE = 6;
  const TYPE_LABEL = { info: "Info", warning: "Warning", danger: "Danger", success: "Success" };

  let filterType = "all";
  let filterRead = "all";
  let searchTerm = "";
  let sortOrder = "desc";
  let page = 1;
  let editingId = null; // notification id currently being edited, or null when creating

  /* -----------------------------------------------------------------------
     LOCAL READ-STATE HELPERS (unread<->read toggle; markNotificationRead
     only ever adds, so "mark unread" is handled here against the same key)
     --------------------------------------------------------------------- */
  function isRead(id) { return getReadNotificationIds().includes(id); }
  function markUnread(id) {
    const ids = getReadNotificationIds().filter((x) => x !== id);
    localStorage.setItem(STORAGE_KEYS.notificationsRead, JSON.stringify(ids));
  }
  function toggleRead(id) {
    if (isRead(id)) markUnread(id); else markNotificationRead(id);
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = getAllNotifications();

    if (filterType !== "all") rows = rows.filter((n) => n.type === filterType);
    if (filterRead === "unread") rows = rows.filter((n) => !isRead(n.id));
    else if (filterRead === "read") rows = rows.filter((n) => isRead(n.id));
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((n) => n.title.toLowerCase().includes(term) || n.message.toLowerCase().includes(term));
    }

    rows = rows.slice().sort((a, b) => {
      const diff = new Date(a.time) - new Date(b.time);
      return sortOrder === "desc" ? -diff : diff;
    });
    return rows;
  }


  /* -----------------------------------------------------------------------
     SUMMARY CARDS (always reflect the true totals, independent of filters)
     --------------------------------------------------------------------- */
  function renderSummary() {
    const all = getAllNotifications();
    const readIds = getReadNotificationIds();
    $("#notifSummaryTotal").textContent = String(all.length);
    $("#notifSummaryUnread").textContent = String(all.filter((n) => !readIds.includes(n.id)).length);
    $("#notifSummaryWarnings").textContent = String(all.filter((n) => n.type === "warning" || n.type === "danger").length);
    $("#notifSummaryCustom").textContent = String(all.filter((n) => n.source === "custom").length);
  }


  /* -----------------------------------------------------------------------
     FEED LIST + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#notificationFeedPagination");
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
    container.appendChild(makeBtn("‹", page === 1, () => { page--; renderFeed(); }));
    for (let p = 1; p <= totalPages; p++) {
      container.appendChild(makeBtn(String(p), false, () => { page = p; renderFeed(); }, p === page));
    }
    container.appendChild(makeBtn("›", page === totalPages, () => { page++; renderFeed(); }));
  }

  function renderFeed() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#notificationFeedEmptyState").hidden = all.length !== 0;
    $("#notificationFeedList").hidden = all.length === 0;

    $("#notificationFeedList").innerHTML = pageItems.map((n) => {
      const unread = !isRead(n.id);
      return `
      <li class="notif-feed-item ${unread ? "is-unread" : ""}" data-id="${n.id}">
        <span class="notif-dot notif-dot--${n.type}"></span>
        <div class="notif-feed-item__body">
          <div class="notif-feed-item__top">
            <p class="notif-feed-item__title">${escapeHtml(n.title)}</p>
            <span class="status-badge status-badge--${n.type}">${TYPE_LABEL[n.type] || n.type}</span>
            ${n.source === "custom" ? '<span class="status-badge status-badge--info">Custom</span>' : ""}
          </div>
          <p class="notif-feed-item__message">${escapeHtml(n.message)}</p>
          <p class="notif-feed-item__time">${formatRelativeTime(n.time)} · ${formatDateTime(new Date(n.time))}</p>
        </div>
        <div class="notif-feed-item__actions">
          <button type="button" class="link-btn" data-action="view" data-id="${n.id}">View</button>
          ${n.source === "custom" ? `<button type="button" class="link-btn" data-action="edit" data-id="${n.id}">Edit</button>` : ""}
          <button type="button" class="link-btn" data-action="toggle-read" data-id="${n.id}">${unread ? "Mark read" : "Mark unread"}</button>
          <button type="button" class="link-btn link-btn--danger" data-action="delete" data-id="${n.id}">Delete</button>
        </div>
      </li>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() {
    renderSummary();
    renderFeed();
  }


  /* -----------------------------------------------------------------------
     TOOLBAR: type filter, read filter, sort, search, mark-all-read, clear all
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $("#notifTypeFilter").addEventListener("change", (e) => {
      filterType = e.target.value;
      page = 1;
      renderFeed();
    });

    $$("#notifReadFilterChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#notifReadFilterChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterRead = chip.dataset.read;
        page = 1;
        renderFeed();
      });
    });

    $("#notifSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#notifSortBtn").textContent = sortOrder === "desc" ? "Newest first" : "Oldest first";
      page = 1;
      renderFeed();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderFeed();
    });

    $("#markAllReadPageBtn").addEventListener("click", () => {
      const ids = getAllNotifications().map((n) => n.id);
      localStorage.setItem(STORAGE_KEYS.notificationsRead, JSON.stringify(ids));
      renderNotifications();
      renderAll();
      showToast("All notifications marked as read.", "success");
    });

    $("#notifClearAllBtn").addEventListener("click", () => {
      const visible = getFilteredSorted();
      if (!visible.length) { showToast("Nothing to clear with the current filters.", "warning"); return; }
      openConfirm({
        title: "Clear these notifications?",
        message: `This dismisses ${visible.length} notification${visible.length === 1 ? "" : "s"} matching your current filters. This cannot be undone.`,
        confirmLabel: "Clear notifications",
        onConfirm: () => {
          visible.forEach((n) => dismissNotification(n.id));
          renderNotifications();
          renderAll();
          showToast("Notifications cleared.", "success");
        }
      });
    });
  }


  /* -----------------------------------------------------------------------
     EXPORT / PRINT
     --------------------------------------------------------------------- */
  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["ID", "Type", "Title", "Message", "Timestamp", "Read", "Source"];
    const csvRows = [header.join(",")];
    rows.forEach((n) => {
      const line = [n.id, TYPE_LABEL[n.type] || n.type, n.title, n.message, formatDateTime(new Date(n.time)), isRead(n.id) ? "Read" : "Unread", n.source]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "erp-notifications.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Notifications exported as CSV.", "success", { title: "Export complete" });
  }

  function printFeed() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((n) => `
      <tr><td>${escapeHtml(n.title)}</td><td>${TYPE_LABEL[n.type] || n.type}</td><td>${escapeHtml(n.message)}</td><td>${formatDateTime(new Date(n.time))}</td><td>${isRead(n.id) ? "Read" : "Unread"}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Notifications</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>Dot ERP — Notifications</h1>
        <p>Generated ${formatDateTime(new Date())} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Title</th><th>Type</th><th>Message</th><th>Timestamp</th><th>Status</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast("Opened the print dialog.", "info", { title: "Print" });
  }


  /* -----------------------------------------------------------------------
     CREATE / EDIT MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() { setFormError("notifFormTitle", ""); setFormError("notifFormMessage", ""); }

  function openCreateModal() {
    editingId = null;
    $("#notificationFormTitle").textContent = "Create notification";
    $("#notificationFormIntro").textContent = "Send a test notification to see how the feed and topbar bell respond — this simulates what another module would trigger automatically.";
    $("#notifFormSaveBtn").textContent = "Create Notification";
    $("#notifFormTitle").value = "";
    $("#notifFormType").value = "info";
    $("#notifFormMessage").value = "";
    clearFormErrors();
    openModal("notificationFormModal");
  }

  function openEditModal(notification) {
    editingId = notification.id;
    $("#notificationFormTitle").textContent = "Edit notification";
    $("#notificationFormIntro").textContent = "This is a notification you created — update it below.";
    $("#notifFormSaveBtn").textContent = "Save Changes";
    $("#notifFormTitle").value = notification.title;
    $("#notifFormType").value = notification.type;
    $("#notifFormMessage").value = notification.message;
    clearFormErrors();
    openModal("notificationFormModal");
  }

  function validateForm() {
    let valid = true;
    const title = $("#notifFormTitle").value.trim();
    const message = $("#notifFormMessage").value.trim();
    clearFormErrors();

    if (!title) { setFormError("notifFormTitle", "Title is required."); valid = false; }
    else if (title.length > 80) { setFormError("notifFormTitle", "Maximum 80 characters allowed."); valid = false; }
    else {
      // Duplicate check: no two active notifications should share a title (case-insensitive).
      const clash = getAllNotifications().some((n) => n.id !== editingId && n.title.trim().toLowerCase() === title.toLowerCase());
      if (clash) { setFormError("notifFormTitle", "A notification with this title already exists."); valid = false; }
    }

    if (!message) { setFormError("notifFormMessage", "Message is required."); valid = false; }
    else if (message.length > 200) { setFormError("notifFormMessage", "Maximum 200 characters allowed."); valid = false; }

    return valid;
  }

  function bindFormModal() {
    $("#createNotificationBtn").addEventListener("click", openCreateModal);

    $("#notifFormResetBtn").addEventListener("click", () => {
      if (editingId) {
        const original = getAllNotifications().find((n) => n.id === editingId);
        if (original) { openEditModal(original); return; }
      }
      $("#notifFormTitle").value = "";
      $("#notifFormType").value = "info";
      $("#notifFormMessage").value = "";
      clearFormErrors();
    });

    $("#notifFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;
      const payload = {
        title: $("#notifFormTitle").value.trim(),
        type: $("#notifFormType").value,
        message: $("#notifFormMessage").value.trim()
      };

      if (editingId) {
        updateCustomNotification(editingId, payload);
        logSystemActivity({ module: "Notifications", action: "Update", description: `Updated notification "${payload.title}"` });
        showToast("Notification updated.", "success");
      } else {
        addCustomNotification(payload);
        logSystemActivity({ module: "Notifications", action: "Create", description: `Created notification "${payload.title}"` });
        showToast("Notification created.", "success");
      }
      closeModal("notificationFormModal");
      renderNotifications();
      renderAll();
    });
  }


  /* -----------------------------------------------------------------------
     VIEW DETAIL MODAL + FEED ROW ACTIONS
     --------------------------------------------------------------------- */
  function openDetailModal(n) {
    $("#notificationDetailBody").innerHTML = `
      <div><dt>Title</dt><dd>${escapeHtml(n.title)}</dd></div>
      <div><dt>Type</dt><dd>${TYPE_LABEL[n.type] || n.type}</dd></div>
      <div><dt>Message</dt><dd>${escapeHtml(n.message)}</dd></div>
      <div><dt>Received</dt><dd>${formatDateTime(new Date(n.time))}</dd></div>
      <div><dt>Source</dt><dd>${n.source === "custom" ? "Created by you" : "System"}</dd></div>
      <div><dt>Status</dt><dd>${isRead(n.id) ? "Read" : "Unread"}</dd></div>
    `;
    const footer = $("#notificationDetailFooter");
    footer.innerHTML = "";
    if (n.source === "custom") {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn--primary";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => { closeModal("notificationDetailModal"); openEditModal(n); });
      footer.appendChild(editBtn);
    }
    if (!isRead(n.id)) {
      markNotificationRead(n.id);
      renderNotifications();
      renderAll();
    }
    openModal("notificationDetailModal");
  }

  function bindFeedActions() {
    $("#notificationFeedList").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      const notification = getAllNotifications().find((n) => n.id === id);
      if (!notification) return;

      const action = btn.dataset.action;
      if (action === "view") {
        openDetailModal(notification);
      } else if (action === "edit") {
        openEditModal(notification);
      } else if (action === "toggle-read") {
        toggleRead(id);
        renderNotifications();
        renderAll();
      } else if (action === "delete") {
        dismissNotification(id);
        logSystemActivity({ module: "Notifications", action: "Delete", description: `Dismissed notification "${notification.title}"` });
        renderNotifications();
        renderAll();
        showToast("Notification dismissed.", "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    const session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "notifications")) return;

    runBootSequence([
      { p: 30, t: "Authenticating session…" },
      { p: 65, t: "Loading notifications…" },
      { p: 100, t: "Ready." }
    ]);

    renderAll();
    bindToolbar();
    bindFormModal();
    bindFeedActions();
    $("#notifExportCsvBtn").addEventListener("click", exportCsv);
    $("#notifPrintBtn").addEventListener("click", printFeed);

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
