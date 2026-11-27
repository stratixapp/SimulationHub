/* =============================================================================
   DOT ERP — pages/company-settings.js
   Phase 2, Module 10: Company Settings (closes out Phase 2)

   No Add/Edit/Delete/Search/Filter/Sort/Pagination/Detail-modal — see
   data/company-settings-data.js's header and this page's own Training
   Guide for why: there is exactly ONE settings record per company, so the
   whole page IS that record's editor, the same explicit-save form shape
   Phase 1's Settings page (per-USER) uses, just scoped per-COMPANY here.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openConfirm, requireSession, runBootSequence, logSystemActivity
  } = window.ERP;

  let session = null;
  let company = null;
  let savedSettings = null; // last-saved snapshot, restored by "Discard Changes"


  /* -----------------------------------------------------------------------
     CONFIGURATION OVERVIEW (read-only, owned by earlier modules)
     --------------------------------------------------------------------- */
  function renderOverview() {
    // Same "safe/idempotent to call from any page" anchor calls Departments
    // and Cost Centers already rely on — guarantees these summaries reflect
    // Company Profile even if Currency/GST/Branches were never opened yet.
    const baseCurrency = ERP_CurrencyRepository.ensureBaseCurrency(company);
    const primaryGst = ERP_GstRepository.ensurePrimaryRegistration(company);
    const headOffice = ERP_BranchRepository.ensurePrimaryBranch(company);
    const currentFy = ERP_FinancialYearRepository.getCurrent(company.id);

    $("#csOverviewCurrency").textContent = baseCurrency ? `${baseCurrency.symbol} ${baseCurrency.code}` : "—";
    $("#csOverviewFY").textContent = currentFy ? currentFy.name : "None set";
    $("#csOverviewGst").textContent = primaryGst ? primaryGst.gstin : "Not registered";
    $("#csOverviewBranch").textContent = headOffice ? `${headOffice.branchName} · ${headOffice.city}` : "—";
  }


  /* -----------------------------------------------------------------------
     FORM <-> SETTINGS OBJECT
     --------------------------------------------------------------------- */
  function renderNumberingTable(numbering) {
    $("#csNumberingBody").innerHTML = ERP_CompanySettingsRepository.documentTypes.map((dt) => {
      const row = numbering[dt.key] || { prefix: dt.defaultPrefix, nextNumber: 1, resetFrequency: "Yearly" };
      return `
        <tr data-doc-key="${dt.key}">
          <td>${escapeHtml(dt.label)}</td>
          <td><div class="input-wrap"><input type="text" class="cs-num-prefix" maxlength="8" value="${escapeHtml(row.prefix)}" /></div></td>
          <td><div class="input-wrap"><input type="number" class="cs-num-next" min="1" step="1" value="${row.nextNumber}" /></div></td>
          <td>
            <select class="select-field cs-num-reset">
              ${ERP_CompanySettingsRepository.resetFrequencies.map((f) => `<option ${f === row.resetFrequency ? "selected" : ""}>${f}</option>`).join("")}
            </select>
          </td>
        </tr>`;
    }).join("");
  }

  function refreshApprovalThresholdVisibility() {
    $("#csApprovalThresholdRow").hidden = !$("#csRequireApproval").checked;
  }

  function populateForm(settings) {
    renderNumberingTable(settings.numbering);

    $("#csRequireApproval").checked = settings.requireApprovalAboveThreshold;
    $("#csApprovalThreshold").value = String(settings.approvalThreshold);
    $("#csMultiCurrency").checked = settings.enableMultiCurrency;
    $("#csBatchTracking").checked = settings.enableBatchTracking;
    $("#csNegativeStock").checked = settings.allowNegativeStock;
    $("#csGrnBeforeInvoice").checked = settings.requireGrnBeforeInvoice;
    refreshApprovalThresholdVisibility();

    $("#csPaymentTerms").value = String(settings.defaultPaymentTermsDays);
    $("#csOrderValidity").value = String(settings.defaultOrderValidityDays);
    $("#csLowStockThreshold").value = String(settings.lowStockThresholdPct);

    clearFormErrors();
  }

  function readFormIntoDraft() {
    const numbering = {};
    $$("#csNumberingBody tr").forEach((row) => {
      numbering[row.dataset.docKey] = {
        prefix: row.querySelector(".cs-num-prefix").value.trim().toUpperCase(),
        nextNumber: parseInt(row.querySelector(".cs-num-next").value, 10) || 1,
        resetFrequency: row.querySelector(".cs-num-reset").value
      };
    });

    return {
      numbering,
      requireApprovalAboveThreshold: $("#csRequireApproval").checked,
      approvalThreshold: parseFloat($("#csApprovalThreshold").value) || 0,
      enableMultiCurrency: $("#csMultiCurrency").checked,
      enableBatchTracking: $("#csBatchTracking").checked,
      allowNegativeStock: $("#csNegativeStock").checked,
      requireGrnBeforeInvoice: $("#csGrnBeforeInvoice").checked,
      defaultPaymentTermsDays: parseInt($("#csPaymentTerms").value, 10) || 0,
      defaultOrderValidityDays: parseInt($("#csOrderValidity").value, 10) || 0,
      lowStockThresholdPct: parseFloat($("#csLowStockThreshold").value) || 0
    };
  }


  /* -----------------------------------------------------------------------
     VALIDATION
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["csNumbering", "csApprovalThreshold", "csPaymentTerms", "csOrderValidity", "csLowStockThreshold"].forEach((f) => setFormError(f, ""));
  }

  function validateForm(draft) {
    let valid = true;
    clearFormErrors();

    // Duplicate-prefix check across document types — the same "sensibly
    // adapted duplicate check" every other module's form requires, adapted
    // here to a fixed small set instead of a growing list.
    const prefixes = Object.values(draft.numbering).map((n) => n.prefix);
    const emptyPrefix = prefixes.some((p) => !p);
    const dupPrefix = prefixes.some((p, i) => p && prefixes.indexOf(p) !== i);
    if (emptyPrefix) { setFormError("csNumbering", "Every document type needs a prefix."); valid = false; }
    else if (dupPrefix) { setFormError("csNumbering", "Two document types can't share the same prefix."); valid = false; }
    else if (Object.values(draft.numbering).some((n) => !n.nextNumber || n.nextNumber < 1)) {
      setFormError("csNumbering", "Next Number must be 1 or higher for every document type.");
      valid = false;
    }

    if (draft.requireApprovalAboveThreshold && (isNaN(draft.approvalThreshold) || draft.approvalThreshold < 0)) {
      setFormError("csApprovalThreshold", "Enter a threshold of 0 or more.");
      valid = false;
    }
    if (isNaN(draft.defaultPaymentTermsDays) || draft.defaultPaymentTermsDays < 0) { setFormError("csPaymentTerms", "Enter 0 or more days."); valid = false; }
    if (isNaN(draft.defaultOrderValidityDays) || draft.defaultOrderValidityDays < 0) { setFormError("csOrderValidity", "Enter 0 or more days."); valid = false; }
    if (isNaN(draft.lowStockThresholdPct) || draft.lowStockThresholdPct < 0 || draft.lowStockThresholdPct > 100) {
      setFormError("csLowStockThreshold", "Enter a percentage between 0 and 100.");
      valid = false;
    }

    return valid;
  }


  /* -----------------------------------------------------------------------
     SAVE / DISCARD / RESET
     --------------------------------------------------------------------- */
  function bindForm() {
    $("#csForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const draft = readFormIntoDraft();
      if (!validateForm(draft)) return;

      savedSettings = ERP_CompanySettingsRepository.update(company.id, draft);
      populateForm(savedSettings);
      logSystemActivity({ module: "Company Settings", action: "Update", description: `Updated company settings for ${company.name}` });
      renderActivity();
      showToast("Settings saved.", "success", { title: "Company Settings" });
    });

    $("#csRequireApproval").addEventListener("change", refreshApprovalThresholdVisibility);

    $("#csDiscardBtn").addEventListener("click", () => {
      populateForm(savedSettings);
      showToast("Unsaved changes discarded.", "info");
    });

    $("#csResetBtn").addEventListener("click", () => {
      openConfirm({
        title: "Reset settings to defaults?",
        message: "Document numbering, toggles, and defaults will all revert to their starting values for this company. This cannot be undone.",
        confirmLabel: "Reset to defaults",
        onConfirm: () => {
          savedSettings = ERP_CompanySettingsRepository.resetToDefaults(company.id);
          populateForm(savedSettings);
          logSystemActivity({ module: "Company Settings", action: "Reset", description: `Reset company settings to defaults for ${company.name}`, severity: "warning" });
          renderActivity();
          showToast("Settings reset to defaults.", "success");
        }
      });
    });
  }


  /* -----------------------------------------------------------------------
     EXPORT / PRINT
     --------------------------------------------------------------------- */
  function bindExportPrint() {
    $("#csExportJsonBtn").addEventListener("click", () => {
      const payload = { exportedAt: new Date().toISOString(), company: company.name, companyCode: company.companyCode, settings: savedSettings };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `erp-company-settings-${company.companyCode}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      showToast("Settings exported as JSON.", "success", { title: "Export complete" });
    });

    $("#csPrintBtn").addEventListener("click", () => {
      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
      const s = savedSettings;
      const numberingRows = ERP_CompanySettingsRepository.documentTypes.map((dt) => {
        const n = s.numbering[dt.key];
        return `<tr><td>${escapeHtml(dt.label)}</td><td>${escapeHtml(n.prefix)}</td><td>${n.nextNumber}</td><td>${n.resetFrequency}</td></tr>`;
      }).join("");
      win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Company Settings</title>
        <style>
          body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
          h1{font-size:18px;margin:0 0 2px;} h2{font-size:13px;margin:22px 0 6px;}
          p{color:#64748B;font-size:12px;margin:0 0 6px;}
          table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px;}
          th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
          th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
        </style></head>
        <body>
          <h1>${escapeHtml(company.name)} — Company Settings</h1>
          <p>Generated ${escapeHtml(formatDateTime(new Date()))}</p>
          <h2>Document Numbering</h2>
          <table><thead><tr><th>Document Type</th><th>Prefix</th><th>Next Number</th><th>Resets</th></tr></thead><tbody>${numberingRows}</tbody></table>
          <h2>Operational Toggles</h2>
          <p>Require approval above ${s.approvalThreshold}: ${s.requireApprovalAboveThreshold ? "Yes" : "No"} · Multi-currency: ${s.enableMultiCurrency ? "Yes" : "No"} · Batch tracking: ${s.enableBatchTracking ? "Yes" : "No"} · Allow negative stock: ${s.allowNegativeStock ? "Yes" : "No"} · Require GRN before invoice: ${s.requireGrnBeforeInvoice ? "Yes" : "No"}</p>
          <h2>Defaults</h2>
          <p>Payment terms: ${s.defaultPaymentTermsDays} days · Order validity: ${s.defaultOrderValidityDays} days · Low stock threshold: ${s.lowStockThresholdPct}%</p>
        </body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
      showToast('Opened the print dialog — choose "Save as PDF" to export.', "info", { title: "Export PDF" });
    });
  }


  /* -----------------------------------------------------------------------
     RECENT CHANGES
     --------------------------------------------------------------------- */
  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Company Settings")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#csActivityEmptyState").hidden = relevant.length !== 0;
    $("#csActivityList").innerHTML = relevant.map((e) => `
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
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "company-settings")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading company settings…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#csContent").hidden = true;
      $("#csSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#csContent").hidden = false;
      $("#csHeaderActions").hidden = false;
      $("#csSubtitle").textContent = `Configuring settings for ${company.name} (${company.companyCode}).`;

      renderOverview();
      savedSettings = ERP_CompanySettingsRepository.getForCompany(company.id);
      populateForm(savedSettings);
      bindForm();
      bindExportPrint();
      renderActivity();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
