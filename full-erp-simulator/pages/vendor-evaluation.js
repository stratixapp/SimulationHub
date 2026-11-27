/* =============================================================================
   DOT ERP — pages/vendor-evaluation.js
   Phase 4, Module 8: Vendor Evaluation

   See data/vendor-evaluation-data.js's header for the full design
   rationale (no workflow, no duplicate check, the four-criteria average).
   UI notes:

   - THE SCORE FIELDS ARE BUILT FROM THE REPOSITORY'S OWN
     `.scoreCriteria` ARRAY, not hardcoded four times — the form loops
     over `ERP_VendorEvaluationRepository.scoreCriteria` to render one
     labeled 1-5 select per criterion (`renderScoreFormFields()`), so a
     future criterion only needs to be added in one place (the data file).
   - Vendor Master's own page (`pages/vendors.js`) picks up the same small
     retrofit Department Need's and Purchase Requisition's did: a live
     "Average Rating" line via `ERP_VendorEvaluationRepository
     .getAverageScoreForVendor()`.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let filterStatus = "all";
  let sortOrder = "desc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;


  function statusBadgeClass(status) {
    return status === "Final" ? "success" : "neutral";
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_VendorEvaluationRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((e) => e.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((e) => {
        const vendor = ERP_VendorRepository.findById(e.vendorId);
        return e.evaluationCode.toLowerCase().includes(term) || (vendor && vendor.vendorName.toLowerCase().includes(term));
      });
    }
    const base = rows.slice();
    if (sortOrder === "asc") base.reverse();
    return base;
  }

  function renderSummary() {
    const all = ERP_VendorEvaluationRepository.getAllForCompany(company.id);
    $("#veSummaryTotal").textContent = String(all.length);
    $("#veSummaryDraft").textContent = String(all.filter((e) => e.status === "Draft").length);
    const finals = all.filter((e) => e.status === "Final");
    $("#veSummaryFinal").textContent = String(finals.length);

    const scores = finals.map((e) => ERP_VendorEvaluationRepository.computeOverallScore(e)).filter((s) => s != null);
    $("#veSummaryAverage").textContent = scores.length
      ? (Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10).toFixed(1)
      : "—";
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#vePagination");
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

    $("#veEmptyState").hidden = all.length !== 0;
    $("#veTable").hidden = all.length === 0;

    $("#veTableBody").innerHTML = pageItems.map((e) => {
      const vendor = ERP_VendorRepository.findById(e.vendorId);
      const rfq = e.relatedRfqId ? ERP_RfqRepository.findById(e.relatedRfqId) : null;
      const overall = ERP_VendorEvaluationRepository.computeOverallScore(e);
      const statusBadge = `<span class="status-badge status-badge--${statusBadgeClass(e.status)}">${e.status}</span>`;
      const quickActionHtml = e.status === "Draft"
        ? `<button type="button" class="link-btn" data-action="finalize" data-id="${e.id}">Finalize</button>`
        : "";

      return `
      <tr>
        <td><code>${escapeHtml(e.evaluationCode)}</code></td>
        <td>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Removed</span>`}</td>
        <td>${overall != null ? overall.toFixed(1) : `<span class="profile-subtle">—</span>`}</td>
        <td>${rfq ? `<code>${escapeHtml(rfq.rfqCode)}</code>` : `<span class="profile-subtle">—</span>`}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${e.id}">View</button>
          ${quickActionHtml}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#veStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#veStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#veSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "desc" ? "asc" : "desc";
      $("#veSortBtn").textContent = sortOrder === "desc" ? "Newest First" : "Oldest First";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#veExportCsvBtn").addEventListener("click", exportCsv);
    $("#vePrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Evaluation Code", "Vendor", "Overall Score", "Quality", "Delivery", "Pricing", "Communication", "Related RFQ", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((e) => {
      const vendor = ERP_VendorRepository.findById(e.vendorId);
      const rfq = e.relatedRfqId ? ERP_RfqRepository.findById(e.relatedRfqId) : null;
      const overall = ERP_VendorEvaluationRepository.computeOverallScore(e);
      const line = [
        e.evaluationCode, vendor ? vendor.vendorName : "", overall != null ? overall : "",
        e.qualityScore != null ? e.qualityScore : "", e.deliveryScore != null ? e.deliveryScore : "",
        e.pricingScore != null ? e.pricingScore : "", e.communicationScore != null ? e.communicationScore : "",
        rfq ? rfq.rfqCode : "", e.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-vendor-evaluations-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Vendor evaluations exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((e) => {
      const vendor = ERP_VendorRepository.findById(e.vendorId);
      const overall = ERP_VendorEvaluationRepository.computeOverallScore(e);
      return `<tr><td>${escapeHtml(e.evaluationCode)}</td><td>${vendor ? escapeHtml(vendor.vendorName) : ""}</td><td>${overall != null ? overall.toFixed(1) : ""}</td><td>${escapeHtml(e.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Vendor Evaluation Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Vendor Evaluation Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Evaluation Code</th><th>Vendor</th><th>Overall Score</th><th>Status</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast('Opened the print dialog — choose "Save as PDF" to export.', "info", { title: "Export PDF" });
  }


  /* -----------------------------------------------------------------------
     RECENT CHANGES
     --------------------------------------------------------------------- */
  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Vendor Evaluation")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#veActivityEmptyState").hidden = relevant.length !== 0;
    $("#veActivityList").innerHTML = relevant.map((e) => `
      <li class="activity-item">
        <span class="activity-item__icon">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </span>
        <div>
          <p class="activity-item__text">${escapeHtml(e.description)}</p>
          <p class="activity-item__time">${formatDateTime(new Date(e.timestamp))}</p>
        </div>
      </li>
    `).join("");
  }


  /* -----------------------------------------------------------------------
     ADD / EDIT FORM — score fields are built from .scoreCriteria, not
     hardcoded. See file header.
     --------------------------------------------------------------------- */
  function renderScoreFormFields(evaluation) {
    $("#veFormScoreFields").innerHTML = ERP_VendorEvaluationRepository.scoreCriteria.map((c) => {
      const current = evaluation ? evaluation[c.key] : null;
      const options = [1, 2, 3, 4, 5].map((n) => `<option value="${n}"${current === n ? " selected" : ""}>${n}</option>`).join("");
      return `
      <div class="form-field">
        <label for="veScore_${c.key}">${escapeHtml(c.label)}</label>
        <select id="veScore_${c.key}" class="select-field" data-criterion="${c.key}">
          <option value="">Not rated</option>
          ${options}
        </select>
      </div>`;
    }).join("");
  }

  function collectScores() {
    const scores = {};
    ERP_VendorEvaluationRepository.scoreCriteria.forEach((c) => {
      const el = $(`#veScore_${c.key}`);
      scores[c.key] = el && el.value !== "" ? Number(el.value) : null;
    });
    return scores;
  }

  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }

  function populateVendorOptions(currentId) {
    let vendors = ERP_VendorRepository.getAllForCompany(company.id).filter((v) => v.status === "Active");
    if (currentId && !vendors.some((v) => v.id === currentId)) {
      const current = ERP_VendorRepository.findById(currentId);
      if (current) vendors = vendors.concat([current]);
    }
    vendors = vendors.slice().sort((a, b) => a.vendorName.localeCompare(b.vendorName));
    $("#veFormVendor").innerHTML = vendors.map((v) => `<option value="${v.id}">${escapeHtml(v.vendorName)}</option>`).join("");
  }

  function populateRfqOptions(companyId, currentId) {
    const rfqs = ERP_RfqRepository.getAllForCompany(companyId).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    $("#veFormRfq").innerHTML = `<option value="">Not linked</option>` + rfqs.map((r) => `<option value="${r.id}"${currentId === r.id ? " selected" : ""}>${escapeHtml(r.rfqCode)}</option>`).join("");
  }

  function openAddModal() {
    editingId = null;
    $("#veFormTitle").textContent = "Rate a vendor";
    $("#veFormIntro").textContent = "Score this vendor across each criterion — 1 is poor, 5 is excellent.";
    $("#veFormSaveBtn").textContent = "Save as Draft";
    populateVendorOptions(null);
    populateRfqOptions(company.id, null);
    renderScoreFormFields(null);
    $("#veFormComments").value = "";
    setFormError("veFormVendor", "");
    openModal("veFormModal");
  }

  function openEditModal(e) {
    if (!ERP_VendorEvaluationRepository.canEdit(e)) {
      showToast(`"${e.evaluationCode}" is Final and can't be edited directly. Revise it back to Draft first.`, "warning", { title: "Can't edit" });
      return;
    }
    editingId = e.id;
    $("#veFormTitle").textContent = "Edit evaluation";
    $("#veFormIntro").textContent = "Update this vendor's scores or comments.";
    $("#veFormSaveBtn").textContent = "Save Changes";
    populateVendorOptions(e.vendorId);
    $("#veFormVendor").value = e.vendorId;
    populateRfqOptions(company.id, e.relatedRfqId);
    renderScoreFormFields(e);
    $("#veFormComments").value = e.comments || "";
    setFormError("veFormVendor", "");
    openModal("veFormModal");
  }

  function validateForm() {
    let valid = true;
    setFormError("veFormVendor", "");
    if (!$("#veFormVendor").value) { setFormError("veFormVendor", "Select a vendor."); valid = false; }
    return valid;
  }

  function bindFormModal() {
    $("#veAddBtn").addEventListener("click", openAddModal);

    $("#veFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        vendorId: $("#veFormVendor").value,
        relatedRfqId: $("#veFormRfq").value || null,
        comments: $("#veFormComments").value.trim(),
        ...collectScores()
      };
      const vendor = ERP_VendorRepository.findById(payload.vendorId);
      const vendorLabel = vendor ? vendor.vendorName : "this vendor";

      if (editingId) {
        openConfirm({
          title: "Save changes to this evaluation?",
          message: `This evaluation of ${vendorLabel} will be updated.`,
          confirmLabel: "Save Changes",
          onConfirm: () => {
            ERP_VendorEvaluationRepository.update(editingId, payload);
            logSystemActivity({ module: "Vendor Evaluation", action: "Update", description: `Updated evaluation of ${vendorLabel} (${company.name})` });
            closeModal("veFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_VendorEvaluationRepository.findById(editingId));
            showToast("Evaluation updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Save this evaluation?",
          message: `A new evaluation of ${vendorLabel} will be saved as a Draft.`,
          confirmLabel: "Save as Draft",
          onConfirm: () => {
            payload.createdByUsername = session.username;
            const created = ERP_VendorEvaluationRepository.create(company, payload);
            logSystemActivity({ module: "Vendor Evaluation", action: "Create", description: `Rated ${vendorLabel} — "${created.evaluationCode}" (${company.name})` });
            closeModal("veFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.evaluationCode}" saved as a Draft.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     WORKFLOW ACTIONS
     --------------------------------------------------------------------- */
  function requestFinalize(e) {
    openConfirm({
      title: "Finalize this evaluation?",
      message: `"${e.evaluationCode}" will be locked and counted toward the vendor's average rating.`,
      confirmLabel: "Finalize",
      onConfirm: () => {
        ERP_VendorEvaluationRepository.finalize(e.id, session.username);
        logSystemActivity({ module: "Vendor Evaluation", action: "Finalize", description: `Finalized evaluation "${e.evaluationCode}" (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === e.id) openDetailModal(ERP_VendorEvaluationRepository.findById(e.id));
        showToast(`"${e.evaluationCode}" finalized.`, "success");
      }
    });
  }

  function requestRevise(e) {
    openConfirm({
      title: "Revise this evaluation?",
      message: `"${e.evaluationCode}" will move back to Draft so you can correct it.`,
      confirmLabel: "Revise",
      onConfirm: () => {
        ERP_VendorEvaluationRepository.revise(e.id);
        logSystemActivity({ module: "Vendor Evaluation", action: "Revise", description: `Reopened evaluation "${e.evaluationCode}" to Draft (${company.name})` });
        renderAll();
        renderActivity();
        if (detailId === e.id) openDetailModal(ERP_VendorEvaluationRepository.findById(e.id));
        showToast(`"${e.evaluationCode}" is back in Draft.`, "info");
      }
    });
  }

  function requestDelete(e) {
    if (!ERP_VendorEvaluationRepository.canDelete(e)) {
      showToast(`"${e.evaluationCode}" is Final and can't be deleted. Revise it back to Draft first if it needs to be removed.`, "warning", { title: "Can't delete" });
      return;
    }
    openConfirm({
      title: "Delete this evaluation?",
      message: `"${e.evaluationCode}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_VendorEvaluationRepository.remove(e.id);
        logSystemActivity({ module: "Vendor Evaluation", action: "Delete", description: `Deleted evaluation "${e.evaluationCode}" (${company.name})`, severity: "warning" });
        if (detailId === e.id) closeModal("veDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${e.evaluationCode}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(e) {
    const footer = $("#veDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    if (e.status === "Draft") {
      addBtn("Delete", "btn btn--danger-outline", () => requestDelete(e));
      addBtn("Edit", "btn btn--ghost", () => { closeModal("veDetailModal"); openEditModal(e); });
      addBtn("Finalize", "btn btn--primary", () => requestFinalize(e));
    } else {
      addBtn("Revise", "btn btn--ghost", () => requestRevise(e));
    }
  }

  function openDetailModal(e) {
    detailId = e.id;
    const vendor = ERP_VendorRepository.findById(e.vendorId);
    const rfq = e.relatedRfqId ? ERP_RfqRepository.findById(e.relatedRfqId) : null;
    const overall = ERP_VendorEvaluationRepository.computeOverallScore(e);

    $("#veDetailTitle").textContent = `${e.evaluationCode} · ${e.status}`;

    const rows = [];
    rows.push(`<div><dt>Evaluation Code</dt><dd><code>${escapeHtml(e.evaluationCode)}</code></dd></div>`);
    rows.push(`<div><dt>Vendor</dt><dd>${vendor ? escapeHtml(vendor.vendorName) : `<span class="profile-subtle">Removed</span>`}</dd></div>`);
    rows.push(`<div><dt>Related RFQ</dt><dd>${rfq ? `<code>${escapeHtml(rfq.rfqCode)}</code>` : "—"}</dd></div>`);
    ERP_VendorEvaluationRepository.scoreCriteria.forEach((c) => {
      const val = e[c.key];
      rows.push(`<div><dt>${escapeHtml(c.label)}</dt><dd>${val != null ? val + " / 5" : "—"}</dd></div>`);
    });
    rows.push(`<div><dt>Overall Score</dt><dd>${overall != null ? overall.toFixed(1) + " / 5" : "—"}</dd></div>`);
    rows.push(`<div><dt>Status</dt><dd><span class="status-badge status-badge--${statusBadgeClass(e.status)}">${e.status}</span></dd></div>`);
    if (e.finalizedAt) rows.push(`<div><dt>Finalized</dt><dd>${formatDateTime(new Date(e.finalizedAt))} by ${escapeHtml(ERP_VendorEvaluationRepository.actorLabel(e.finalizedByUsername))}</dd></div>`);
    if (e.comments) rows.push(`<div><dt>Comments</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(e.comments)}</dd></div>`);

    $("#veDetailBody").innerHTML = rows.join("");
    renderDetailFooter(e);
    openModal("veDetailModal");
  }

  function bindDetailModal() {
    $("#veTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const ev = ERP_VendorEvaluationRepository.findById(viewBtn.dataset.id);
        if (ev) openDetailModal(ev);
        return;
      }
      if (actionBtn) {
        const ev = ERP_VendorEvaluationRepository.findById(actionBtn.dataset.id);
        if (ev && actionBtn.dataset.action === "finalize") requestFinalize(ev);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "vendor-evaluation")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading vendor evaluations…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#noAnchorState").hidden = true;
      $("#veContent").hidden = true;
      $("#veSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#veSubtitle").textContent = `Managing vendor evaluations for ${company.name} (${company.companyCode}).`;

      const anyVendor = ERP_VendorRepository.getAllForCompany(company.id).some((v) => v.status === "Active");

      if (!anyVendor) {
        $("#noAnchorState").hidden = false;
        $("#veContent").hidden = true;
        $("#veHeaderActions").hidden = true;
      } else {
        $("#noAnchorState").hidden = true;
        $("#veContent").hidden = false;
        $("#veHeaderActions").hidden = false;
        renderAll();
        renderActivity();
        bindToolbar();
        bindFormModal();
        bindDetailModal();

        if (new URLSearchParams(window.location.search).get("action") === "add") {
          openAddModal();
        }
      }
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
