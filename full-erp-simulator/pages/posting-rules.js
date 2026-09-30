/* =============================================================================
   DOT ERP — pages/posting-rules.js
   Phase 6, retrofit pass (item 10): Posting Rules — the configuration
   screen data/gl-mapping-data.js's own header describes.

   LIVE-SAVING, SAME PATTERN BANK RECONCILIATION'S WORKSHEET ESTABLISHED:
   every account picker saves on `change` immediately via
   `ERP_GLMappingRepository.set()` — no separate Save button, no unsaved-
   state to lose. Small, independent settings, not one big form — eleven
   of them now (Phase 9 added the five Payroll roles; see
   data/gl-mapping-data.js's own header), rendered generically from
   `ERP_GL_MAPPING_ROLES` so this file never needed to change shape to
   grow, only `PAYROLL_ROLES` below for the new readiness card.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    requireSession, runBootSequence
  } = window.ERP;

  let session = null;
  let company = null;

  const PROCUREMENT_ROLES = ["inventoryAccountId", "grIrClearingAccountId", "accountsPayableAccountId"];
  const SALES_ROLES = ["accountsReceivableAccountId", "salesRevenueAccountId", "inventoryAccountId", "costOfGoodsSoldAccountId"]; // outputTaxAccountId is conditional, not required for readiness
  const PAYROLL_ROLES = ["salaryExpenseAccountId", "salaryPayableAccountId"]; // pfPayableAccountId/professionalTaxPayableAccountId/tdsPayableAccountId are conditional, same reasoning as outputTaxAccountId above
  // Stock Adjustment, Opening Stock, Sales Return (damaged/scrap leg) and Purchase Return all need Inventory; the two roles unique to these
  // documents are the write-off account and Opening Balance Equity. COGS, GR/IR and Accounts Payable are already covered by the Sales and
  // Procurement checks above, so they aren't repeated here.
  const STOCK_ROLES = ["inventoryAccountId", "inventoryWriteOffAccountId", "openingBalanceEquityAccountId"];


  /* -----------------------------------------------------------------------
     SUMMARY
     --------------------------------------------------------------------- */
  function renderSummary() {
    const mapping = ERP_GLMappingRepository.get(company.id);
    const configured = ERP_GLMappingRepository.configuredCount(company.id);

    $("#prSummaryConfigured").textContent = `${configured} of ${ERP_GL_MAPPING_ROLES.length}`;
    $("#prProgressIcon").className = "kpi-card__icon " + (configured === ERP_GL_MAPPING_ROLES.length ? "kpi-card__icon--success" : "kpi-card__icon--warning");

    const procurementReady = PROCUREMENT_ROLES.every((k) => !!mapping[k]);
    const salesReady = SALES_ROLES.every((k) => !!mapping[k]);
    const payrollReady = PAYROLL_ROLES.every((k) => !!mapping[k]);
    const stockReady = STOCK_ROLES.every((k) => !!mapping[k]);

    $("#prSummaryProcurement").textContent = procurementReady ? "Ready" : "Not ready";
    $("#prSummaryProcurement").style.color = procurementReady ? "var(--color-success)" : "var(--color-text-muted)";
    $("#prProcurementIcon").className = "kpi-card__icon " + (procurementReady ? "kpi-card__icon--success" : "kpi-card__icon--warning");

    $("#prSummarySales").textContent = salesReady ? "Ready" : "Not ready";
    $("#prSummarySales").style.color = salesReady ? "var(--color-success)" : "var(--color-text-muted)";
    $("#prSalesIcon").className = "kpi-card__icon " + (salesReady ? "kpi-card__icon--success" : "kpi-card__icon--warning");

    $("#prSummaryPayroll").textContent = payrollReady ? "Ready" : "Not ready";
    $("#prSummaryPayroll").style.color = payrollReady ? "var(--color-success)" : "var(--color-text-muted)";
    $("#prPayrollIcon").className = "kpi-card__icon " + (payrollReady ? "kpi-card__icon--success" : "kpi-card__icon--warning");

    $("#prSummaryStock").textContent = stockReady ? "Ready" : "Not ready";
    $("#prSummaryStock").style.color = stockReady ? "var(--color-success)" : "var(--color-text-muted)";
    $("#prStockIcon").className = "kpi-card__icon " + (stockReady ? "kpi-card__icon--success" : "kpi-card__icon--warning");

    const autoPosted = ERP_JournalEntryRepository.getAllForCompany(company.id).filter((e) => e.source !== "Manual");
    $("#prSummaryAutoPosted").textContent = String(autoPosted.length);
  }


  /* -----------------------------------------------------------------------
     ROLE PICKERS — one row per role, live-saving
     --------------------------------------------------------------------- */
  function accountOptionsHtml(selectedId) {
    const accounts = ERP_ChartOfAccountsRepository.getPostableForCompany(company.id);
    const options = accounts.map((a) => {
      const label = ERP_ChartOfAccountsRepository.getBreadcrumbLabel(company.id, a.id);
      const sel = a.id === selectedId ? " selected" : "";
      return `<option value="${a.id}"${sel}>${escapeHtml(label)}</option>`;
    }).join("");
    return `<option value="">Not set</option>` + options;
  }

  function renderRoles() {
    const mapping = ERP_GLMappingRepository.get(company.id);
    $("#prRolesList").innerHTML = ERP_GL_MAPPING_ROLES.map((role) => `
      <div class="wizard-field-row pr-role-row" style="align-items:flex-end;border-bottom:1px solid var(--color-border);padding-bottom:14px;margin-bottom:14px;">
        <div class="form-field" style="flex:0 0 220px;">
          <label>${escapeHtml(role.label)} <span class="profile-subtle">(${escapeHtml(role.type)})</span></label>
          <p class="profile-subtle" style="margin:2px 0 0;font-size:12px;">${escapeHtml(role.usedBy)}</p>
        </div>
        <div class="form-field">
          <select class="select-field pr-role-select" data-role="${role.key}">${accountOptionsHtml(mapping[role.key])}</select>
        </div>
      </div>
    `).join("");
  }

  function renderActivity() {
    const autoPosted = ERP_JournalEntryRepository.getAllForCompany(company.id)
      .filter((e) => e.source !== "Manual")
      .sort((a, b) => new Date(b.postedAt || b.createdAt) - new Date(a.postedAt || a.createdAt))
      .slice(0, 8);

    $("#prActivityEmptyState").hidden = autoPosted.length !== 0;
    $("#prActivityList").innerHTML = autoPosted.map((e) => {
      const totals = ERP_JournalEntryRepository.computeTotals(e);
      return `
      <li class="activity-item">
        <span class="activity-item__icon">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </span>
        <div>
          <p class="activity-item__text">${escapeHtml(e.entryNumber)} — ${escapeHtml(e.narration)} <span class="profile-subtle">(${escapeHtml(e.source)})</span></p>
          <p class="activity-item__time">${formatDateTime(new Date(e.postedAt || e.createdAt))} · ₹${totals.totalDebit.toLocaleString("en-IN")}</p>
        </div>
      </li>`;
    }).join("");
  }

  function bindRoles() {
    $("#prRolesList").addEventListener("change", (e) => {
      if (!e.target.classList.contains("pr-role-select")) return;
      const role = e.target.dataset.role;
      ERP_GLMappingRepository.set(company.id, { [role]: e.target.value || null });
      renderSummary();
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "posting-rules")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading posting rules…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#prContent").hidden = true;
      $("#prSubtitle").textContent = "No active company yet.";
    } else if (ERP_ChartOfAccountsRepository.getPostableForCompany(company.id).length === 0) {
      $("#noAccountsState").hidden = false;
      $("#prContent").hidden = true;
      $("#prSubtitle").textContent = `No postable accounts yet for ${company.name}.`;
    } else {
      $("#noCompanyState").hidden = true;
      $("#noAccountsState").hidden = true;
      $("#prContent").hidden = false;
      $("#prSubtitle").textContent = `Posting rules for ${company.name} (${company.companyCode}).`;
      renderSummary();
      renderRoles();
      renderActivity();
      bindRoles();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
