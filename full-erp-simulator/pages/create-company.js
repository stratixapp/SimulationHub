/* =============================================================================
   DOT ERP — pages/create-company.js
   Phase 2, Module 01: Create Company

   Uses window.ERP (shared runtime) and ERP_CompanyRepository (data layer
   from ../data/company-data.js) — the repository every later Company Setup
   module will read the active company from.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, formatDateTime, escapeHtml,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity,
    panPattern: PAN_RE, emailPattern: EMAIL_RE
  } = window.ERP;

  const TOTAL_STEPS = 4;
  const PAGE_SIZE = 6;

  let session = null;
  let currentStep = 1;
  let companiesSortOrder = "desc";
  let companiesPage = 1;
  let detailCompanyId = null;

  // GSTIN validation reuses GST Details' own pattern (data/gst-data.js) rather
  // than a third local copy — see that file's header for why it's kept as the
  // one canonical source.
  const GSTIN_RE = ERP_GstRepository.gstinPattern;
  const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
  const PINCODE_INDIA_RE = /^[0-9]{6}$/;


  /* -----------------------------------------------------------------------
     FIELD ERROR HELPERS
     --------------------------------------------------------------------- */
  function setFieldError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFieldErrors(fields) { fields.forEach((f) => setFieldError(f, "")); }


  /* -----------------------------------------------------------------------
     STEP VALIDATION
     --------------------------------------------------------------------- */
  function validateStep1() {
    let valid = true;
    clearFieldErrors(["coName", "coIndustry", "coBusinessType"]);

    const name = $("#coName").value.trim();
    if (!name) { setFieldError("coName", "Company name is required."); valid = false; }
    else if (name.length > 100) { setFieldError("coName", "Maximum 100 characters allowed."); valid = false; }
    else if (ERP_CompanyRepository.findByName(name)) { setFieldError("coName", "A company with this name already exists."); valid = false; }

    if (!$("#coIndustry").value) { setFieldError("coIndustry", "Select an industry."); valid = false; }
    if (!$("#coBusinessType").value) { setFieldError("coBusinessType", "Select a business type."); valid = false; }

    return valid;
  }

  function validateStep2() {
    let valid = true;
    clearFieldErrors(["coAddress1", "coCity", "coState", "coPincode", "coPhone", "coEmail", "coWebsite"]);

    if (!$("#coAddress1").value.trim()) { setFieldError("coAddress1", "Address is required."); valid = false; }
    if (!$("#coCity").value.trim()) { setFieldError("coCity", "City is required."); valid = false; }
    if (!$("#coState").value) { setFieldError("coState", "Select a state."); valid = false; }

    const pincode = $("#coPincode").value.trim();
    if (!pincode) { setFieldError("coPincode", "Pincode / ZIP is required."); valid = false; }
    else if ($("#coCountry").value === "India" && !PINCODE_INDIA_RE.test(pincode)) { setFieldError("coPincode", "Enter a valid 6-digit Indian pincode."); valid = false; }

    const phone = $("#coPhone").value.trim();
    if (!phone) { setFieldError("coPhone", "Phone is required."); valid = false; }
    else if (!PHONE_RE.test(phone)) { setFieldError("coPhone", "Enter a valid phone number."); valid = false; }

    const email = $("#coEmail").value.trim();
    if (!email) { setFieldError("coEmail", "Email is required."); valid = false; }
    else if (!EMAIL_RE.test(email)) { setFieldError("coEmail", "Enter a valid email address."); valid = false; }

    const website = $("#coWebsite").value.trim();
    if (website && (website.includes(" ") || !website.includes("."))) { setFieldError("coWebsite", "Enter a valid website, or leave it blank."); valid = false; }

    return valid;
  }

  function validateStep3() {
    let valid = true;
    clearFieldErrors(["coPAN", "coGSTIN", "coCIN"]);

    const pan = $("#coPAN").value.trim().toUpperCase();
    if (pan && !PAN_RE.test(pan)) { setFieldError("coPAN", "PAN must look like ABCDE1234F."); valid = false; }

    const gstin = $("#coGSTIN").value.trim().toUpperCase();
    if (gstin && !GSTIN_RE.test(gstin)) { setFieldError("coGSTIN", "GSTIN must look like 27ABCDE1234F1Z5."); valid = false; }

    const cin = $("#coCIN").value.trim().toUpperCase();
    if (cin && cin.length < 15) { setFieldError("coCIN", "CIN looks too short — double-check it, or leave it blank."); valid = false; }

    return valid;
  }

  function validateStep(step) {
    if (step === 1) return validateStep1();
    if (step === 2) return validateStep2();
    if (step === 3) return validateStep3();
    return true;
  }


  /* -----------------------------------------------------------------------
     WIZARD NAVIGATION
     --------------------------------------------------------------------- */
  function goToStep(step) {
    currentStep = step;
    $$(".wizard-step-indicator").forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle("is-active", n === step);
      el.classList.toggle("is-complete", n < step);
    });
    $$(".wizard-panel").forEach((el) => {
      el.classList.toggle("is-active", Number(el.dataset.stepPanel) === step);
    });
    $("#wizardBackBtn").hidden = step === 1;
    $("#wizardNextBtn").hidden = step === TOTAL_STEPS;
    $("#wizardSubmitBtn").hidden = step !== TOTAL_STEPS;
    if (step === TOTAL_STEPS) renderReview();
    $("#wizardCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderReview() {
    const state = $("#coState").value ? `, ${$("#coState").value}` : "";
    const legalName = $("#coLegalName").value.trim() || $("#coName").value.trim();
    $("#wizardReviewBody").innerHTML = `
      <div><dt>Company Name</dt><dd>${escapeHtml($("#coName").value.trim())}</dd></div>
      <div><dt>Legal Name</dt><dd>${escapeHtml(legalName)}</dd></div>
      <div><dt>Industry</dt><dd>${escapeHtml($("#coIndustry").value)}</dd></div>
      <div><dt>Business Type</dt><dd>${escapeHtml($("#coBusinessType").value)}</dd></div>
      <div><dt>Address</dt><dd>${escapeHtml($("#coAddress1").value.trim())}${$("#coAddress2").value.trim() ? ", " + escapeHtml($("#coAddress2").value.trim()) : ""}</dd></div>
      <div><dt>City / State</dt><dd>${escapeHtml($("#coCity").value.trim())}${escapeHtml(state)}</dd></div>
      <div><dt>Country / Pincode</dt><dd>${escapeHtml($("#coCountry").value)} · ${escapeHtml($("#coPincode").value.trim())}</dd></div>
      <div><dt>Phone / Email</dt><dd>${escapeHtml($("#coPhone").value.trim())} · ${escapeHtml($("#coEmail").value.trim())}</dd></div>
      <div><dt>PAN</dt><dd>${escapeHtml($("#coPAN").value.trim().toUpperCase() || "—")}</dd></div>
      <div><dt>GSTIN</dt><dd>${escapeHtml($("#coGSTIN").value.trim().toUpperCase() || "—")}</dd></div>
      <div><dt>Base Currency</dt><dd>${escapeHtml($("#coBaseCurrency").value)}</dd></div>
    `;
  }

  function resetWizardForm() {
    $("#companyWizardForm").reset();
    clearFieldErrors(["coName", "coIndustry", "coBusinessType", "coAddress1", "coCity", "coState", "coPincode", "coPhone", "coEmail", "coWebsite", "coPAN", "coGSTIN", "coCIN"]);
    goToStep(1);
  }

  function openWizard() {
    resetWizardForm();
    $("#wizardCard").hidden = false;
    $("#wizardCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindWizard() {
    $("#startWizardBtn").addEventListener("click", openWizard);
    $("#closeWizardBtn").addEventListener("click", () => { $("#wizardCard").hidden = true; });

    $("#wizardNextBtn").addEventListener("click", () => {
      if (!validateStep(currentStep)) return;
      goToStep(Math.min(TOTAL_STEPS, currentStep + 1));
    });
    $("#wizardBackBtn").addEventListener("click", () => goToStep(Math.max(1, currentStep - 1)));
    $("#wizardResetBtn").addEventListener("click", () => {
      resetWizardForm();
      showToast("Form cleared.", "info");
    });

    $("#companyWizardForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateStep1() || !validateStep2() || !validateStep3()) {
        showToast("Please fix the highlighted fields before creating the company.", "warning");
        return;
      }
      openConfirm({
        title: "Create this company?",
        message: "A company code will be generated automatically and can't be changed afterwards.",
        confirmLabel: "Create company",
        onConfirm: createCompanyFromForm
      });
    });
  }

  function createCompanyFromForm() {
    const legalName = $("#coLegalName").value.trim() || $("#coName").value.trim();
    const record = ERP_CompanyRepository.create({
      name: $("#coName").value.trim(),
      legalName,
      industry: $("#coIndustry").value,
      businessType: $("#coBusinessType").value,
      address1: $("#coAddress1").value.trim(),
      address2: $("#coAddress2").value.trim(),
      city: $("#coCity").value.trim(),
      state: $("#coState").value,
      country: $("#coCountry").value,
      pincode: $("#coPincode").value.trim(),
      phone: $("#coPhone").value.trim(),
      email: $("#coEmail").value.trim(),
      website: $("#coWebsite").value.trim(),
      pan: $("#coPAN").value.trim().toUpperCase(),
      gstin: $("#coGSTIN").value.trim().toUpperCase(),
      cin: $("#coCIN").value.trim().toUpperCase(),
      baseCurrency: $("#coBaseCurrency").value,
      createdBy: session.username
    });

    logSystemActivity({ module: "Create Company", action: "Create", description: `Created company "${record.name}" (${record.companyCode})` });
    $("#wizardCard").hidden = true;
    companiesPage = 1;
    renderCompanies();
    showToast(`${record.name} created as ${record.companyCode}.`, "success", { title: "Company created" });
  }


  /* -----------------------------------------------------------------------
     COMPANIES LIST
     --------------------------------------------------------------------- */
  function getSortedCompanies() {
    return ERP_CompanyRepository.getAll().slice().sort((a, b) => {
      const diff = new Date(a.createdAt) - new Date(b.createdAt);
      return companiesSortOrder === "desc" ? -diff : diff;
    });
  }

  function renderCompaniesPagination(totalPages) {
    const container = $("#companiesPagination");
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
    container.appendChild(makeBtn("‹", companiesPage === 1, () => { companiesPage--; renderCompanies(); }));
    for (let p = 1; p <= totalPages; p++) {
      container.appendChild(makeBtn(String(p), false, () => { companiesPage = p; renderCompanies(); }, p === companiesPage));
    }
    container.appendChild(makeBtn("›", companiesPage === totalPages, () => { companiesPage++; renderCompanies(); }));
  }

  function renderCompanies() {
    const all = getSortedCompanies();
    const activeId = ERP_CompanyRepository.getActiveId();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    companiesPage = Math.min(companiesPage, totalPages);
    const start = (companiesPage - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#companiesEmptyState").hidden = all.length !== 0;
    $("#companiesTable").hidden = all.length === 0;

    $("#companiesTableBody").innerHTML = pageItems.map((c) => `
      <tr>
        <td><code>${escapeHtml(c.companyCode)}</code></td>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.industry)}</td>
        <td>${escapeHtml(c.city)}</td>
        <td>${c.id === activeId
          ? '<span class="status-badge status-badge--success">Active</span>'
          : `<button type="button" class="link-btn" data-action="set-active" data-id="${c.id}">Set Active</button>`}</td>
        <td><button type="button" class="row-detail-btn" data-action="view" data-id="${c.id}">View</button></td>
      </tr>
    `).join("");

    renderCompaniesPagination(totalPages);
  }

  function openCompanyDetail(company) {
    detailCompanyId = company.id;
    const activeId = ERP_CompanyRepository.getActiveId();
    $("#companyDetailBody").innerHTML = `
      <div><dt>Company Code</dt><dd>${escapeHtml(company.companyCode)}</dd></div>
      <div><dt>Company Name</dt><dd>${escapeHtml(company.name)}</dd></div>
      <div><dt>Legal Name</dt><dd>${escapeHtml(company.legalName)}</dd></div>
      <div><dt>Industry</dt><dd>${escapeHtml(company.industry)}</dd></div>
      <div><dt>Business Type</dt><dd>${escapeHtml(company.businessType)}</dd></div>
      <div><dt>Address</dt><dd>${escapeHtml(company.address1)}${company.address2 ? ", " + escapeHtml(company.address2) : ""}, ${escapeHtml(company.city)}, ${escapeHtml(company.state)}</dd></div>
      <div><dt>Country / Pincode</dt><dd>${escapeHtml(company.country)} · ${escapeHtml(company.pincode)}</dd></div>
      <div><dt>Phone</dt><dd>${escapeHtml(company.phone)}</dd></div>
      <div><dt>Email</dt><dd>${escapeHtml(company.email)}</dd></div>
      <div><dt>Website</dt><dd>${escapeHtml(company.website || "—")}</dd></div>
      <div><dt>PAN</dt><dd>${escapeHtml(company.pan || "—")}</dd></div>
      <div><dt>GSTIN</dt><dd>${escapeHtml(company.gstin || "—")}</dd></div>
      <div><dt>CIN</dt><dd>${escapeHtml(company.cin || "—")}</dd></div>
      <div><dt>Base Currency</dt><dd>${escapeHtml(company.baseCurrency)}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(company.createdAt))}</dd></div>
    `;
    $("#setActiveFromDetailBtn").hidden = company.id === activeId;
    openModal("companyDetailModal");
  }

  function exportCompaniesCsv() {
    const rows = getSortedCompanies();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Legal Name", "Industry", "Business Type", "City", "State", "Country", "GSTIN", "Base Currency", "Created"];
    const csvRows = [header.join(",")];
    rows.forEach((c) => {
      const line = [c.companyCode, c.name, c.legalName, c.industry, c.businessType, c.city, c.state, c.country, c.gstin, c.baseCurrency, formatDateTime(new Date(c.createdAt))]
        .map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "erp-companies.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Companies exported as CSV.", "success", { title: "Export complete" });
  }

  function printCompanies() {
    const rows = getSortedCompanies();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((c) => `
      <tr><td>${escapeHtml(c.companyCode)}</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.industry)}</td><td>${escapeHtml(c.city)}</td><td>${escapeHtml(c.state)}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Companies</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>Dot ERP — Companies</h1>
        <p>Generated ${formatDateTime(new Date())} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Industry</th><th>City</th><th>State</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast("Opened the print dialog.", "info", { title: "Print" });
  }

  function setCompanyActive(id) {
    const company = ERP_CompanyRepository.findById(id);
    if (!company) return;
    ERP_CompanyRepository.setActive(id);
    logSystemActivity({ module: "Create Company", action: "Update", description: `Set "${company.name}" as the active company` });
    renderCompanies();
    showToast(`${company.name} is now your active company.`, "success");
  }

  function bindCompaniesList() {
    $("#companiesSortBtn").addEventListener("click", () => {
      companiesSortOrder = companiesSortOrder === "desc" ? "asc" : "desc";
      $("#companiesSortBtn").textContent = companiesSortOrder === "desc" ? "Newest first" : "Oldest first";
      companiesPage = 1;
      renderCompanies();
    });
    $("#companiesExportCsvBtn").addEventListener("click", exportCompaniesCsv);
    $("#companiesPrintBtn").addEventListener("click", printCompanies);

    $("#companiesTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const company = ERP_CompanyRepository.findById(btn.dataset.id);
      if (!company) return;
      if (btn.dataset.action === "view") openCompanyDetail(company);
      else if (btn.dataset.action === "set-active") setCompanyActive(company.id);
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      const term = e.target.value.trim().toLowerCase();
      $$("#companiesTableBody tr").forEach((tr) => {
        tr.hidden = term.length > 0 && !tr.textContent.toLowerCase().includes(term);
      });
    });

    $("#setActiveFromDetailBtn").addEventListener("click", () => {
      if (!detailCompanyId) return;
      setCompanyActive(detailCompanyId);
      closeModal("companyDetailModal");
    });

    $("#deleteFromDetailBtn").addEventListener("click", () => {
      if (!detailCompanyId) return;
      const company = ERP_CompanyRepository.findById(detailCompanyId);
      if (!company) return;
      closeModal("companyDetailModal");
      openConfirm({
        title: `Delete ${company.name}?`,
        message: "This permanently removes the company record. This cannot be undone.",
        confirmLabel: "Delete company",
        onConfirm: () => {
          ERP_CompanyRepository.remove(company.id);
          logSystemActivity({ module: "Create Company", action: "Delete", description: `Deleted company "${company.name}" (${company.companyCode})` });
          renderCompanies();
          showToast("Company deleted.", "info");
        }
      });
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "create-company")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading company records…" },
      { p: 100, t: "Ready." }
    ]);

    renderCompanies();
    bindCompaniesList();
    bindWizard();

    // First-time users land straight in the wizard instead of an empty list.
    if (!ERP_CompanyRepository.getAll().length) openWizard();

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
