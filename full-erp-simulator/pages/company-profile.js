/* =============================================================================
   DOT ERP — pages/company-profile.js
   Phase 2, Module 02: Company Profile

   Always shows the ACTIVE company (ERP_CompanyRepository.getActive()) — to
   work on a different company, switch which one is active from Module 1's
   company list first. Validation rules mirror Module 1's wizard exactly,
   since the data has to stay just as clean after creation as at creation.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, formatDateTime, formatRelativeTime, escapeHtml,
    showToast, openConfirm, requireSession, runBootSequence, logSystemActivity,
    panPattern: PAN_RE, emailPattern: EMAIL_RE
  } = window.ERP;

  // GSTIN validation reuses GST Details' own pattern (data/gst-data.js) rather
  // than a third local copy — see that file's header for why it's kept as the
  // one canonical source.
  const GSTIN_RE = ERP_GstRepository.gstinPattern;
  const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;
  const PINCODE_INDIA_RE = /^[0-9]{6}$/;
  const MAX_LOGO_BYTES = 300 * 1024;

  const EDIT_FIELDS = [
    "editCoName", "editCoIndustry", "editCoBusinessType", "editCoAddress1", "editCoCity", "editCoState",
    "editCoPincode", "editCoPhone", "editCoEmail", "editCoWebsite", "editCoPAN", "editCoGSTIN", "editCoCIN"
  ];

  let session = null;
  let company = null;


  /* -----------------------------------------------------------------------
     VIEW MODE RENDER
     --------------------------------------------------------------------- */
  function formatAddress(c) {
    const parts = [c.address1, c.address2, c.city, c.state, c.country, c.pincode].filter(Boolean);
    return parts.join(", ");
  }

  function renderView() {
    const hasLogo = !!company.logoDataUrl;
    $("#companyLogoInitials").hidden = hasLogo;
    $("#companyLogoImg").hidden = !hasLogo;
    if (hasLogo) $("#companyLogoImg").src = company.logoDataUrl;
    else $("#companyLogoInitials").textContent = (company.name || "?").slice(0, 2).toUpperCase();
    $("#removeLogoBtn").hidden = !hasLogo;

    $("#companyName").textContent = company.name;
    $("#companyCodeDisplay").textContent = company.companyCode;
    $("#companyCodeInForm").textContent = company.companyCode;
    $("#companyLegalName").textContent = company.legalName;
    $("#companyIndustryType").textContent = `${company.industry} · ${company.businessType}`;
    $("#companyCurrency").textContent = company.baseCurrency;
    $("#companyPhone").textContent = company.phone || "—";
    $("#companyEmail").textContent = company.email || "—";
    $("#companyWebsiteDisplay").textContent = company.website || "—";
    $("#companyPAN").textContent = company.pan || "—";
    $("#companyGSTIN").textContent = company.gstin || "—";
    $("#companyCIN").textContent = company.cin || "—";
    $("#companyCreated").textContent = formatDateTime(new Date(company.createdAt));
    $("#companyAddress").textContent = formatAddress(company) || "—";
    $("#companyProfileSubtitle").textContent = `Viewing ${company.name} (${company.companyCode}) — your active company.`;
  }


  /* -----------------------------------------------------------------------
     EDIT MODE
     --------------------------------------------------------------------- */
  function setFieldError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFieldErrors() { EDIT_FIELDS.forEach((f) => setFieldError(f, "")); }

  function populateEditForm(c) {
    $("#editCoName").value = c.name;
    $("#editCoLegalName").value = c.legalName;
    $("#editCoIndustry").value = c.industry;
    $("#editCoBusinessType").value = c.businessType;
    $("#editCoAddress1").value = c.address1;
    $("#editCoAddress2").value = c.address2;
    $("#editCoCity").value = c.city;
    $("#editCoState").value = c.state;
    $("#editCoCountry").value = c.country;
    $("#editCoPincode").value = c.pincode;
    $("#editCoPhone").value = c.phone;
    $("#editCoEmail").value = c.email;
    $("#editCoWebsite").value = c.website;
    $("#editCoPAN").value = c.pan;
    $("#editCoGSTIN").value = c.gstin;
    $("#editCoCIN").value = c.cin;
    $("#editCoBaseCurrency").value = c.baseCurrency;
    clearFieldErrors();
  }

  function enterEditMode() {
    populateEditForm(company);
    $("#companyViewMode").hidden = true;
    $("#companyEditForm").hidden = false;
    $("#companyProfileHeaderActions").hidden = true;
  }
  function exitEditMode() {
    $("#companyViewMode").hidden = false;
    $("#companyEditForm").hidden = true;
    $("#companyProfileHeaderActions").hidden = false;
  }

  function validateEditForm() {
    let valid = true;
    clearFieldErrors();

    const name = $("#editCoName").value.trim();
    if (!name) { setFieldError("editCoName", "Company name is required."); valid = false; }
    else if (name.length > 100) { setFieldError("editCoName", "Maximum 100 characters allowed."); valid = false; }
    else {
      const clash = ERP_CompanyRepository.getAll().find((c) => c.id !== company.id && c.name.trim().toLowerCase() === name.toLowerCase());
      if (clash) { setFieldError("editCoName", "Another company already uses this name."); valid = false; }
    }

    if (!$("#editCoIndustry").value) { setFieldError("editCoIndustry", "Select an industry."); valid = false; }
    if (!$("#editCoBusinessType").value) { setFieldError("editCoBusinessType", "Select a business type."); valid = false; }
    if (!$("#editCoAddress1").value.trim()) { setFieldError("editCoAddress1", "Address is required."); valid = false; }
    if (!$("#editCoCity").value.trim()) { setFieldError("editCoCity", "City is required."); valid = false; }
    if (!$("#editCoState").value) { setFieldError("editCoState", "Select a state."); valid = false; }

    const pincode = $("#editCoPincode").value.trim();
    if (!pincode) { setFieldError("editCoPincode", "Pincode / ZIP is required."); valid = false; }
    else if ($("#editCoCountry").value === "India" && !PINCODE_INDIA_RE.test(pincode)) { setFieldError("editCoPincode", "Enter a valid 6-digit Indian pincode."); valid = false; }

    const phone = $("#editCoPhone").value.trim();
    if (!phone) { setFieldError("editCoPhone", "Phone is required."); valid = false; }
    else if (!PHONE_RE.test(phone)) { setFieldError("editCoPhone", "Enter a valid phone number."); valid = false; }

    const email = $("#editCoEmail").value.trim();
    if (!email) { setFieldError("editCoEmail", "Email is required."); valid = false; }
    else if (!EMAIL_RE.test(email)) { setFieldError("editCoEmail", "Enter a valid email address."); valid = false; }

    const website = $("#editCoWebsite").value.trim();
    if (website && (website.includes(" ") || !website.includes("."))) { setFieldError("editCoWebsite", "Enter a valid website, or leave it blank."); valid = false; }

    const pan = $("#editCoPAN").value.trim().toUpperCase();
    if (pan && !PAN_RE.test(pan)) { setFieldError("editCoPAN", "PAN must look like ABCDE1234F."); valid = false; }

    const gstin = $("#editCoGSTIN").value.trim().toUpperCase();
    if (gstin && !GSTIN_RE.test(gstin)) { setFieldError("editCoGSTIN", "GSTIN must look like 27ABCDE1234F1Z5."); valid = false; }

    const cin = $("#editCoCIN").value.trim().toUpperCase();
    if (cin && cin.length < 15) { setFieldError("editCoCIN", "CIN looks too short — double-check it, or leave it blank."); valid = false; }

    return valid;
  }

  function bindEditForm() {
    $("#editCompanyProfileBtn").addEventListener("click", enterEditMode);
    $("#cancelCompanyProfileBtn").addEventListener("click", exitEditMode);
    $("#resetCompanyProfileBtn").addEventListener("click", () => {
      populateEditForm(company);
      showToast("Changes reset to the saved profile.", "info");
    });

    $("#companyEditForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateEditForm()) return;

      openConfirm({
        title: "Save company profile changes?",
        message: "This updates the active company's record — changes are logged to Recent Changes below.",
        confirmLabel: "Save changes",
        onConfirm: () => {
          const partial = {
            name: $("#editCoName").value.trim(),
            legalName: $("#editCoLegalName").value.trim() || $("#editCoName").value.trim(),
            industry: $("#editCoIndustry").value,
            businessType: $("#editCoBusinessType").value,
            address1: $("#editCoAddress1").value.trim(),
            address2: $("#editCoAddress2").value.trim(),
            city: $("#editCoCity").value.trim(),
            state: $("#editCoState").value,
            country: $("#editCoCountry").value,
            pincode: $("#editCoPincode").value.trim(),
            phone: $("#editCoPhone").value.trim(),
            email: $("#editCoEmail").value.trim(),
            website: $("#editCoWebsite").value.trim(),
            pan: $("#editCoPAN").value.trim().toUpperCase(),
            gstin: $("#editCoGSTIN").value.trim().toUpperCase(),
            cin: $("#editCoCIN").value.trim().toUpperCase(),
            baseCurrency: $("#editCoBaseCurrency").value
          };
          company = ERP_CompanyRepository.update(company.id, partial);
          logSystemActivity({ module: "Company Profile", action: "Update", description: `Updated profile details for "${company.name}"` });
          renderView();
          renderActivity();
          exitEditMode();
          showToast("Company profile updated.", "success");
        }
      });
    });
  }


  /* -----------------------------------------------------------------------
     LOGO UPLOAD
     --------------------------------------------------------------------- */
  function bindLogoUpload() {
    $("#changeLogoBtn").addEventListener("click", () => $("#logoFileInput").click());

    $("#logoFileInput").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;

      if (!file.type.startsWith("image/")) { showToast("Please choose an image file.", "warning"); return; }
      if (file.size > MAX_LOGO_BYTES) { showToast("Logo is too large — please choose a file under 300 KB.", "warning"); return; }

      const reader = new FileReader();
      reader.onload = () => {
        company = ERP_CompanyRepository.update(company.id, { logoDataUrl: reader.result });
        renderView();
        logSystemActivity({ module: "Company Profile", action: "Update", description: `Updated the logo for "${company.name}"` });
        renderActivity();
        showToast("Company logo updated.", "success");
      };
      reader.onerror = () => showToast("Could not read that image file.", "danger");
      reader.readAsDataURL(file);
    });

    $("#removeLogoBtn").addEventListener("click", () => {
      openConfirm({
        title: "Remove company logo?",
        message: "The company avatar will go back to showing initials.",
        confirmLabel: "Remove logo",
        onConfirm: () => {
          company = ERP_CompanyRepository.update(company.id, { logoDataUrl: null });
          renderView();
          logSystemActivity({ module: "Company Profile", action: "Update", description: `Removed the logo for "${company.name}"` });
          renderActivity();
          showToast("Company logo removed.", "info");
        }
      });
    });
  }


  /* -----------------------------------------------------------------------
     RECENT CHANGES
     --------------------------------------------------------------------- */
  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "Company Profile" || e.module === "Create Company")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#companyActivityEmptyState").hidden = relevant.length !== 0;
    $("#companyActivityList").innerHTML = relevant.map((e) => `
      <li class="activity-item">
        <span class="activity-item__icon">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </span>
        <div>
          <p class="activity-item__text">${escapeHtml(e.description)}</p>
          <p class="activity-item__time">${formatRelativeTime(new Date(e.timestamp))}</p>
        </div>
      </li>
    `).join("");
  }


  /* -----------------------------------------------------------------------
     EXPORT / PRINT
     --------------------------------------------------------------------- */
  function exportProfileCsv() {
    const header = ["Code", "Name", "Legal Name", "Industry", "Business Type", "Address", "Phone", "Email", "Website", "PAN", "GSTIN", "CIN", "Base Currency"];
    const row = [
      company.companyCode, company.name, company.legalName, company.industry, company.businessType,
      formatAddress(company), company.phone, company.email, company.website, company.pan, company.gstin, company.cin, company.baseCurrency
    ].map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(",");
    const blob = new Blob([header.join(",") + "\n" + row], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-company-profile-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Company profile exported as CSV.", "success", { title: "Export complete" });
  }

  function exportProfilePdf() {
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(company.name)} - Company Profile</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:40px;color:#0F172A;}
        h1{font-size:22px;margin:0 0 2px;} .code{color:#64748B;font-size:12px;margin:0 0 28px;}
        table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:22px;}
        td{padding:7px 4px;border-bottom:1px solid #E2E8F0;} td:first-child{color:#64748B;width:180px;}
        h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#334155;margin:22px 0 8px;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)}</h1>
        <p class="code">Company Code: ${escapeHtml(company.companyCode)} · Generated ${escapeHtml(formatDateTime(new Date()))}</p>
        <h2>Basics</h2>
        <table>
          <tr><td>Legal Name</td><td>${escapeHtml(company.legalName)}</td></tr>
          <tr><td>Industry</td><td>${escapeHtml(company.industry)}</td></tr>
          <tr><td>Business Type</td><td>${escapeHtml(company.businessType)}</td></tr>
          <tr><td>Base Currency</td><td>${escapeHtml(company.baseCurrency)}</td></tr>
        </table>
        <h2>Address &amp; Contact</h2>
        <table>
          <tr><td>Address</td><td>${escapeHtml(formatAddress(company))}</td></tr>
          <tr><td>Phone</td><td>${escapeHtml(company.phone)}</td></tr>
          <tr><td>Email</td><td>${escapeHtml(company.email)}</td></tr>
          <tr><td>Website</td><td>${escapeHtml(company.website || "—")}</td></tr>
        </table>
        <h2>Registration &amp; Tax</h2>
        <table>
          <tr><td>PAN</td><td>${escapeHtml(company.pan || "—")}</td></tr>
          <tr><td>GSTIN</td><td>${escapeHtml(company.gstin || "—")}</td></tr>
          <tr><td>CIN</td><td>${escapeHtml(company.cin || "—")}</td></tr>
        </table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast('Opened the print dialog — choose "Save as PDF" to export.', "info", { title: "Export PDF" });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "company-profile")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading company profile…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#companyProfileContent").hidden = true;
      $("#companyProfileSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#companyProfileContent").hidden = false;
      $("#companyProfileHeaderActions").hidden = false;
      renderView();
      renderActivity();
      bindEditForm();
      bindLogoUpload();
      $("#exportProfileCsvBtn").addEventListener("click", exportProfileCsv);
      $("#exportProfilePdfBtn").addEventListener("click", exportProfilePdf);
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
