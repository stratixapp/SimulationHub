/* =============================================================================
   DOT ERP — pages/activity-log.js
   Module 07: Activity Log

   Deliberately read-only: this page has no create, no edit, and no per-row
   delete — only search/filter/sort/paginate/export/print and a single,
   fully-confirmed "Clear Log" that resets the whole timeline. See the
   Help Guide on this page for why that's a feature, not a limitation.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, formatDateTime, escapeHtml,
    showToast, openModal, openConfirm, requireSession, runBootSequence,
    getUnifiedActivityLog, clearUnifiedActivityLog
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let filterModule = "all";
  let filterSeverity = "all";
  let mineOnly = false;
  let searchTerm = "";
  let sortOrder = "desc";
  let page = 1;

  function severityBadgeClass(sev) { return sev === "warning" ? "status-badge--warning" : "status-badge--info"; }

  function getFilteredSorted() {
    let rows = getUnifiedActivityLog();

    if (filterModule !== "all") rows = rows.filter((r) => r.module === filterModule);
    if (filterSeverity !== "all") rows = rows.filter((r) => r.severity === filterSeverity);
    if (mineOnly) rows = rows.filter((r) => r.username.toLowerCase() === session.username.toLowerCase());
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((r) =>
        r.description.toLowerCase().includes(term) ||
        r.action.toLowerCase().includes(term) ||
        r.username.toLowerCase().includes(term) ||
        r.module.toLowerCase().includes(term)
      );
    }

    rows = rows.slice().sort((a, b) => {
      const diff = new Date(a.timestamp) - new Date(b.timestamp);
      return sortOrder === "desc" ? -diff : diff;
    });
    return rows;
  }

  function renderSummary() {
    const all = getUnifiedActivityLog();
    const todayStr = new Date().toDateString();
    $("#activitySummaryTotal").textContent = String(all.length);
    $("#activitySummaryToday").textContent = String(all.filter((r) => new Date(r.timestamp).toDateString() === todayStr).length);
    $("#activitySummaryWarnings").textContent = String(all.filter((r) => r.severity === "warning").length);
    $("#activitySummaryMine").textContent = String(all.filter((r) => r.username.toLowerCase() === session.username.toLowerCase()).length);
  }

  function renderPagination(totalPages) {
    const container = $("#activityPagination");
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
    container.appendChild(makeBtn("‹", page === 1, () => { page--; renderTable(); }));
    for (let p = 1; p <= totalPages; p++) {
      container.appendChild(makeBtn(String(p), false, () => { page = p; renderTable(); }, p === page));
    }
    container.appendChild(makeBtn("›", page === totalPages, () => { page++; renderTable(); }));
  }

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#activityEmptyState").hidden = all.length !== 0;
    $("#activityTable").hidden = all.length === 0;

    $("#activityTableBody").innerHTML = pageItems.map((r) => `
      <tr>
        <td>${formatDateTime(new Date(r.timestamp))}</td>
        <td>${escapeHtml(r.username)}</td>
        <td><span class="status-badge status-badge--info">${escapeHtml(r.module)}</span></td>
        <td><span class="status-badge ${severityBadgeClass(r.severity)}">${escapeHtml(r.action)}</span></td>
        <td>${escapeHtml(r.description)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">View</button></td>
      </tr>
    `).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindToolbar() {
    $("#activityModuleFilter").addEventListener("change", (e) => {
      filterModule = e.target.value;
      page = 1;
      renderTable();
    });

    $$("#activitySeverityChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#activitySeverityChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterSeverity = chip.dataset.severity;
        page = 1;
        renderTable();
      });
    });

    $("#activityMineOnlyChip").addEventListener("click", () => {
      mineOnly = !mineOnly;
      $("#activityMineOnlyChip").classList.toggle("is-active", mineOnly);
      page = 1;
      renderTable();
    });

    $("#activitySortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#activitySortBtn").textContent = sortOrder === "desc" ? "Newest first" : "Oldest first";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#activityClearLogBtn").addEventListener("click", () => {
      openConfirm({
        title: "Clear the entire activity log?",
        message: "This wipes Login History, Profile Activity and System events for everyone on this device — " +
          "all three feeds that make up this timeline. This cannot be undone.",
        confirmLabel: "Clear everything",
        onConfirm: () => {
          clearUnifiedActivityLog();
          page = 1;
          renderAll();
          showToast("Activity log cleared.", "success");
        }
      });
    });

    $("#activityExportCsvBtn").addEventListener("click", exportCsv);
    $("#activityPrintBtn").addEventListener("click", printLog);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Timestamp", "User", "Module", "Action", "Description"];
    const csvRows = [header.join(",")];
    rows.forEach((r) => {
      const line = [formatDateTime(new Date(r.timestamp)), r.username, r.module, r.action, r.description]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "erp-activity-log.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Activity log exported as CSV.", "success", { title: "Export complete" });
  }

  function printLog() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((r) => `
      <tr><td>${escapeHtml(formatDateTime(new Date(r.timestamp)))}</td><td>${escapeHtml(r.username)}</td><td>${escapeHtml(r.module)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(r.description)}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Activity Log</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>Dot ERP — Activity Log</h1>
        <p>Generated ${formatDateTime(new Date())} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Timestamp</th><th>User</th><th>Module</th><th>Action</th><th>Description</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast("Opened the print dialog.", "info", { title: "Print" });
  }

  function bindDetailModal() {
    $("#activityTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-id]");
      if (!btn) return;
      const row = getUnifiedActivityLog().find((r) => r.id === btn.dataset.id);
      if (!row) return;
      $("#activityDetailBody").innerHTML = `
        <div><dt>Timestamp</dt><dd>${formatDateTime(new Date(row.timestamp))}</dd></div>
        <div><dt>User</dt><dd>${escapeHtml(row.username)}</dd></div>
        <div><dt>Module</dt><dd>${escapeHtml(row.module)}</dd></div>
        <div><dt>Action</dt><dd>${escapeHtml(row.action)}</dd></div>
        <div><dt>Description</dt><dd>${escapeHtml(row.description)}</dd></div>
      `;
      openModal("activityDetailModal");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "activity-log")) return;

    runBootSequence([
      { p: 30, t: "Authenticating session…" },
      { p: 65, t: "Assembling the activity timeline…" },
      { p: 100, t: "Ready." }
    ]);

    renderAll();
    bindToolbar();
    bindDetailModal();

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
