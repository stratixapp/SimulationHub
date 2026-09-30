/* =============================================================================
   DOT ERP — pages/depreciation-run.js
   Phase 12, Module 03: Depreciation Run

   Mirrors pages/payroll.js's own page-level shape closely (period picker,
   live preview before generating, Draft review, Process to post) — the
   similarity was confirmed by reading that file directly rather than
   assumed, exactly as the roadmap asked. The one real page-level
   difference: no "Mark Paid" action at all, since a depreciation run has
   no cash leg (see data/depreciation-run-data.js's own header).

   The duplicate-period BLOCK lives here, at the page, not in the
   repository — matching Payroll's own precedent exactly: the repository
   just answers findActiveRunForPeriod(), and the page decides what to do
   about it.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity, actorLabel
  } = window.ERP;

  const PAGE_SIZE = 8;
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  let session = null;
  let company = null;
  let filterStatus = "all";
  let page = 1;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }
  function assetLabel(id) { const a = ERP_AssetRepository.findById(id); return a ? `${a.assetCode} — ${a.assetName}` : "Unknown asset"; }
  function assetMethod(id) { const a = ERP_AssetRepository.findById(id); return a ? a.depreciationMethod : "—"; }
  function periodLabel(run) { return `${MONTH_NAMES[run.periodMonth - 1]} ${run.periodYear}`; }
  function statusBadge(status) {
    const tone = status === "Processed" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }

  function getFilteredSorted() {
    let rows = ERP_DepreciationRunRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    return rows;
  }

  function renderSummary() {
    const all = ERP_DepreciationRunRepository.getAllForCompany(company.id);
    $("#drSummaryTotal").textContent = String(all.length);
    $("#drSummaryDraft").textContent = String(all.filter((r) => r.status === "Draft").length);
    $("#drSummaryProcessed").textContent = String(all.filter((r) => r.status === "Processed").length);
    const posted = all.filter((r) => r.status === "Processed").reduce((sum, r) => sum + (Number(r.totalCharge) || 0), 0);
    $("#drSummaryPosted").textContent = formatMoney(posted);
  }

  function renderPagination(totalPages) {
    const container = $("#drPagination");
    container.innerHTML = "";
    if (totalPages <= 1) return;
    const makeBtn = (label, disabled, onClick, active) => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "page-btn" + (active ? " is-active" : ""); btn.textContent = label; btn.disabled = !!disabled;
      btn.addEventListener("click", onClick);
      return btn;
    };
    container.appendChild(makeBtn("‹", page === 1, () => { page--; renderTable(); }));
    for (let p = 1; p <= totalPages; p++) container.appendChild(makeBtn(String(p), false, () => { page = p; renderTable(); }, p === page));
    container.appendChild(makeBtn("›", page === totalPages, () => { page++; renderTable(); }));
  }

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const pageItems = all.slice((page - 1) * PAGE_SIZE, (page - 1) * PAGE_SIZE + PAGE_SIZE);

    $("#drEmptyState").hidden = all.length !== 0;
    $("#drTable").hidden = all.length === 0;

    $("#drTableBody").innerHTML = pageItems.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.runCode)}</code></td>
        <td>${periodLabel(r)}</td>
        <td class="text-right">${(r.lines || []).length}</td>
        <td class="text-right">${formatMoney(r.totalCharge)}</td>
        <td>${statusBadge(r.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">View</button></td>
      </tr>`).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#drStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#drStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#drExportCsvBtn").addEventListener("click", exportCsv);
    $("#drPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const lines = [["Run Code", "Period", "Assets", "Total Charge", "Status"].join(",")];
    rows.forEach((r) => lines.push([r.runCode, periodLabel(r), (r.lines || []).length, Number(r.totalCharge).toFixed(2), r.status].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `depreciation-runs-${company.companyCode}.csv`;
    link.click();
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log.filter((e) => e.module === "Depreciation Run").sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8);
    $("#drActivityEmptyState").hidden = relevant.length !== 0;
    $("#drActivityList").innerHTML = relevant.map((e) => `
      <li class="activity-item">
        <span class="activity-item__icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>
        <div><p class="activity-item__text">${escapeHtml(e.description)}</p><p class="activity-item__time">${formatDateTime(new Date(e.timestamp))}</p></div>
      </li>`).join("");
  }

  /* --- Create modal: period picker + live preview --- */
  function renderPreview() {
    const year = Number($("#drFormYear").value) || 0;
    const month = Number($("#drFormMonth").value) || 0;
    $("#drFormPeriodError").textContent = "";
    if (!(year > 0 && month > 0)) { $("#drPreviewTableBody").innerHTML = ""; $("#drPreviewTotal").textContent = ""; return; }

    const existing = ERP_DepreciationRunRepository.findActiveRunForPeriod(company.id, year, month);
    if (existing && existing.status === "Processed") {
      $("#drFormPeriodError").textContent = `${MONTH_NAMES[month - 1]} ${year} has already been processed (${existing.runCode}). Pick another period.`;
    }

    const lines = ERP_DepreciationRunRepository.buildLines(company.id, year, month);
    $("#drPreviewEmpty").hidden = lines.length !== 0;
    $("#drPreviewTable").hidden = lines.length === 0;
    $("#drPreviewTableBody").innerHTML = lines.map((l) => `
      <tr>
        <td>${escapeHtml(assetLabel(l.assetId))}</td>
        <td class="text-right">${formatMoney(l.openingBookValue)}</td>
        <td class="text-right">${formatMoney(l.chargeAmount)}</td>
        <td class="text-right">${formatMoney(l.closingBookValue)}</td>
      </tr>`).join("");
    const total = lines.reduce((s, l) => s + l.chargeAmount, 0);
    $("#drPreviewTotal").textContent = lines.length ? `Total depreciation for this period: ${formatMoney(total)}` : "";
  }

  function openAddModal() {
    const now = new Date();
    $("#drFormMonth").innerHTML = MONTH_NAMES.map((n, i) => `<option value="${i + 1}"${i === now.getMonth() ? " selected" : ""}>${n}</option>`).join("");
    $("#drFormYear").value = now.getFullYear();
    renderPreview();
    openModal("drFormModal");
  }

  function bindFormModal() {
    $("#drAddBtn").addEventListener("click", openAddModal);
    $("#drFormMonth").addEventListener("change", renderPreview);
    $("#drFormYear").addEventListener("input", renderPreview);

    $("#drFormSaveBtn").addEventListener("click", () => {
      const year = Number($("#drFormYear").value) || 0;
      const month = Number($("#drFormMonth").value) || 0;
      if (!(year > 0 && month > 0)) { $("#drFormPeriodError").textContent = "Pick a valid period."; return; }

      const existing = ERP_DepreciationRunRepository.findActiveRunForPeriod(company.id, year, month);
      if (existing && existing.status === "Processed") {
        $("#drFormPeriodError").textContent = `${MONTH_NAMES[month - 1]} ${year} has already been processed (${existing.runCode}). Pick another period.`;
        return;
      }

      const run = ERP_DepreciationRunRepository.generateRun(company, year, month, session.username);
      logSystemActivity({ module: "Depreciation Run", action: existing ? "Regenerate" : "Create", description: `${existing ? "Regenerated" : "Generated"} depreciation run "${run.runCode}" for ${company.name}` });
      closeModal("drFormModal");
      renderAll();
      renderActivity();
      showToast(existing ? "Draft run regenerated." : "Draft run generated — review it, then Process to post.", "success");
    });
  }

  /* --- Detail modal + lifecycle --- */
  function renderDetailFooter(run) {
    const footer = $("#drDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, onClick) => {
      const btn = document.createElement("button"); btn.type = "button"; btn.className = cls; btn.textContent = label; btn.addEventListener("click", onClick); footer.appendChild(btn);
    };
    if (run.status === "Draft") {
      addBtn("Process (posts to books)", "btn btn--primary", () => requestProcess(run));
      addBtn("Cancel Run", "btn btn--danger-outline", () => requestCancel(run));
    } else if (run.status === "Processed") {
      addBtn("Cancel Run", "btn btn--danger-outline", () => requestCancel(run));
    }
    addBtn("Close", "btn btn--ghost", () => closeModal("drDetailModal"));
  }

  function openDetailModal(run) {
    $("#drDetailTitle").textContent = `Depreciation Run — ${run.runCode}`;
    $("#drDetailBody").innerHTML = `
      <div><dt>Run Code</dt><dd><code>${escapeHtml(run.runCode)}</code></dd></div>
      <div><dt>Period</dt><dd>${periodLabel(run)}</dd></div>
      <div><dt>Assets Covered</dt><dd>${(run.lines || []).length}</dd></div>
      <div><dt>Total Charge</dt><dd>${formatMoney(run.totalCharge)}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(run.status)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(run.createdAt))} by ${escapeHtml(actorLabel(run.createdByUsername))}</dd></div>
      ${run.status === "Processed" ? `<div><dt>Processed</dt><dd>${formatDateTime(new Date(run.processedAt))} by ${escapeHtml(actorLabel(run.processedByUsername))}</dd></div>` : ""}
    `;
    $("#drLineTableBody").innerHTML = (run.lines || []).map((l) => `
      <tr>
        <td>${escapeHtml(assetLabel(l.assetId))}</td>
        <td>${escapeHtml(assetMethod(l.assetId))}</td>
        <td class="text-right">${formatMoney(l.openingBookValue)}</td>
        <td class="text-right">${formatMoney(l.chargeAmount)}</td>
        <td class="text-right">${formatMoney(l.closingBookValue)}</td>
      </tr>`).join("");
    $("#drDetailTotal").textContent = `Total: ${formatMoney(run.totalCharge)}`;
    renderDetailFooter(run);
    openModal("drDetailModal");
  }

  function requestProcess(run) {
    openConfirm({
      title: "Process this depreciation run?",
      message: "This posts a journal entry to the General Ledger and locks the run. There's no un-posting.",
      confirmLabel: "Process",
      onConfirm: () => {
        const processed = ERP_DepreciationRunRepository.process(run.id, session.username);
        if (!processed) { showToast("Couldn't process this run.", "danger"); return; }
        logSystemActivity({ module: "Depreciation Run", action: "Process", description: `Processed depreciation run "${processed.runCode}" (${company.name})` });

        // Auto-post to the General Ledger — built in the same pass as this
        // module, not deferred (see data/depreciation-run-data.js's header).
        if (typeof ERP_GlPostingRepository !== "undefined") {
          const glResult = ERP_GlPostingRepository.postDepreciationRun(company, processed, session.username);
          if (glResult.success) {
            logSystemActivity({ module: "Depreciation Run", action: "Auto-Post", description: `Auto-posted journal entry ${glResult.entry.entryNumber} for "${processed.runCode}" (${company.name})` });
          } else {
            showToast(glResult.reason, "warning", { title: "Not posted to the books" });
          }
        }

        closeModal("drDetailModal");
        renderAll();
        renderActivity();
        showToast("Depreciation run processed.", "success");
      }
    });
  }

  function requestCancel(run) {
    const wasProcessed = run.status === "Processed";
    openConfirm({
      title: "Cancel this run?",
      message: wasProcessed
        ? "This run has already posted to the General Ledger. Cancelling stops it counting toward accumulated depreciation here, but does NOT reverse the journal entry — you'd need a manual reversing entry for that."
        : "This draft was never processed, so nothing has been posted — cancelling is safe.",
      confirmLabel: "Cancel Run",
      onConfirm: () => {
        const cancelled = ERP_DepreciationRunRepository.cancel(run.id, session.username);
        if (!cancelled) { showToast("Couldn't cancel this run.", "danger"); return; }
        logSystemActivity({ module: "Depreciation Run", action: "Cancel", description: `Cancelled depreciation run "${cancelled.runCode}" (${company.name})` });
        closeModal("drDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#drTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      if (!viewBtn) return;
      const run = ERP_DepreciationRunRepository.findById(viewBtn.dataset.id);
      if (run) openDetailModal(run);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "depreciation-run")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading depreciation runs…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#drContent").hidden = true;
      $("#drSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#drContent").hidden = false;
      $("#drHeaderActions").hidden = false;
      $("#drSubtitle").textContent = `Running depreciation for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
