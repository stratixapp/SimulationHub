/* =============================================================================
   DOT ERP — pages/vendors.js
   Phase 3, Module 02: Vendor Master

   Flat list, like every master-data module so far. See data/vendor-data.js's
   header for the full reasoning behind reusing GST Details' GSTIN
   validation/state-derivation, the soft-name/hard-GSTIN duplicate split,
   the Active/Blocked/Inactive three-state lifecycle, the payment-terms
   fallback to Company Settings, and the deliberate "build bank fields now,
   retrofit into Bank Master later" call.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity,
    emailPattern: EMAIL_PATTERN, panPattern: PAN_PATTERN
  } = window.ERP;

  const PAGE_SIZE = 6;

  let session = null;
  let company = null;
  let filterType = "all";
  let filterStatus = "all";
  let sortOrder = "asc";
  let searchTerm = "";
  let page = 1;
  let editingId = null;
  let detailId = null;


  /* -----------------------------------------------------------------------
     HELPERS
     --------------------------------------------------------------------- */
  function formatPaymentTerms(vendor) {
    const { days, source } = ERP_VendorRepository.getEffectivePaymentTerms(vendor, company);
    return source === "vendor" ? `${days} days` : `${days} days (company default)`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_VendorRepository.getAllForCompany(company.id);

    if (filterType !== "all") rows = rows.filter((v) => v.vendorType === filterType);
    if (filterStatus !== "all") rows = rows.filter((v) => v.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((v) =>
        v.vendorName.toLowerCase().includes(term) ||
        v.vendorCode.toLowerCase().includes(term) ||
        (v.gstin || "").toLowerCase().includes(term) ||
        (v.contactPerson || "").toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.vendorName.localeCompare(b.vendorName);
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  function renderSummary() {
    const all = ERP_VendorRepository.getAllForCompany(company.id);
    $("#venSummaryTotal").textContent = String(all.length);
    $("#venSummaryActive").textContent = String(all.filter((v) => v.status === "Active").length);
    $("#venSummaryBlocked").textContent = String(all.filter((v) => v.status === "Blocked").length);
    const withGstin = all.filter((v) => (v.gstin || "").trim()).length;
    $("#venSummaryGst").textContent = `${withGstin} / ${all.length}`;
  }


  /* -----------------------------------------------------------------------
     TYPE CHIPS (built from the fixed reference list)
     --------------------------------------------------------------------- */
  function buildTypeChips() {
    const container = $("#venTypeChips");
    const extra = ERP_VendorRepository.vendorTypes.map((type) =>
      `<button type="button" class="chip" data-type="${escapeHtml(type)}">${escapeHtml(type)}</button>`
    ).join("");
    container.insertAdjacentHTML("beforeend", extra);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#venPagination");
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

  const STATUS_BADGE = { Active: "success", Blocked: "warning", Inactive: "danger" };

  function renderTable() {
    const all = getFilteredSorted();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#venEmptyState").hidden = all.length !== 0;
    $("#venTable").hidden = all.length === 0;

    $("#venTableBody").innerHTML = pageItems.map((v) => {
      const statusBadge = `<span class="status-badge status-badge--${STATUS_BADGE[v.status]}">${v.status}</span>`;
      let quickAction = "";
      if (v.status === "Active") quickAction = `<button type="button" class="link-btn" data-action="Blocked" data-id="${v.id}">Block</button>`;
      else if (v.status === "Blocked") quickAction = `<button type="button" class="link-btn" data-action="Active" data-id="${v.id}">Unblock</button>`;
      else quickAction = `<button type="button" class="link-btn" data-action="Active" data-id="${v.id}">Reactivate</button>`;

      return `
      <tr>
        <td><code>${escapeHtml(v.vendorCode)}</code></td>
        <td>${escapeHtml(v.vendorName)}</td>
        <td>${escapeHtml(v.vendorType)}</td>
        <td>${v.gstin ? `<code>${escapeHtml(v.gstin)}</code>` : `<span class="profile-subtle">Not registered</span>`}</td>
        <td>${escapeHtml(formatPaymentTerms(v))}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${v.id}">View</button>
          ${quickAction}
        </td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }


  /* -----------------------------------------------------------------------
     TOOLBAR: type + status chips, sort, search, export, print
     --------------------------------------------------------------------- */
  function bindToolbar() {
    $$("#venTypeChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#venTypeChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterType = chip.dataset.type;
        page = 1;
        renderTable();
      });
    });

    $$("#venStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#venStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#venSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#venSortBtn").textContent = sortOrder === "asc" ? "Name A-Z" : "Name Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#venExportCsvBtn").addEventListener("click", exportCsv);
    $("#venPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Type", "GSTIN", "PAN", "City", "State", "Contact Person", "Email", "Phone", "Payment Terms (days)", "Bank Name", "Account Number", "IFSC", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((v) => {
      const { days } = ERP_VendorRepository.getEffectivePaymentTerms(v, company);
      const bankDetails = ERP_VendorRepository.getEffectiveBankDetails(v);
      const line = [
        v.vendorCode, v.vendorName, v.vendorType, v.gstin || "", v.pan || "",
        v.city || "", v.state || "", v.contactPerson || "", v.email || "", v.phone || "",
        days, bankDetails.bankName || "", bankDetails.accountNumber || "", bankDetails.ifscCode || "", v.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-vendors-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Vendors exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((v) => `<tr><td>${escapeHtml(v.vendorCode)}</td><td>${escapeHtml(v.vendorName)}</td><td>${escapeHtml(v.vendorType)}</td><td>${escapeHtml(v.gstin || "—")}</td><td>${escapeHtml(formatPaymentTerms(v))}</td><td>${escapeHtml(v.status)}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Vendor Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Vendor Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>GSTIN</th><th>Payment Terms</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Vendor Master")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#venActivityEmptyState").hidden = relevant.length !== 0;
    $("#venActivityList").innerHTML = relevant.map((e) => `
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
     GSTIN -> STATE AUTO-FILL (reuses GST Details' own validation/derivation)
     --------------------------------------------------------------------- */
  function refreshGstinDerivedState() {
    const gstin = $("#venFormGstin").value.trim().toUpperCase();
    if (!gstin) {
      $("#venFormGstinHint").textContent = "Valid GSTINs auto-fill the State field below.";
      return;
    }
    if (ERP_GstRepository.gstinPattern.test(gstin)) {
      const derived = ERP_GstRepository.deriveState(gstin);
      $("#venFormState").value = derived;
      $("#venFormGstinHint").textContent = `State auto-detected as ${derived} from this GSTIN — change it below if that's wrong.`;
    } else {
      $("#venFormGstinHint").textContent = "Valid GSTINs auto-fill the State field below.";
    }
  }


  /* -----------------------------------------------------------------------
     ADD / EDIT VENDOR MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["venFormName", "venFormGstin", "venFormPan", "venFormAddress1", "venFormCity", "venFormState", "venFormEmail", "venFormPaymentTerms", "venFormBankIfsc"].forEach((f) => setFormError(f, ""));
  }

  function populateTypeOptions() {
    $("#venFormType").innerHTML = ERP_VendorRepository.vendorTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
  }

  function refreshNameDupHint() {
    const name = $("#venFormName").value.trim();
    $("#venFormNameDupHint").hidden = !name || !ERP_VendorRepository.hasDuplicateVendorName(company.id, name, editingId);
  }

  function populateBankOptions() {
    if (typeof ERP_BankRepository === "undefined") { $("#venFormBank").innerHTML = `<option value="">Not linked</option>`; return; }
    const options = ERP_BankRepository.getActiveForCompany(company.id);
    $("#venFormBank").innerHTML = `<option value="">Not linked</option>` +
      options.map((b) => `<option value="${b.id}">${escapeHtml(ERP_BankRepository.maskedLabel(b))}</option>`).join("");
  }

  /** Same shape as Warehouses' refreshAddressMode() — shows the linked
      account as a read-only preview unless "enter different bank details"
      is ticked, in which case the free-text fields underneath take over. */
  function refreshBankMode() {
    const bankId = $("#venFormBank").value;
    const toggleRow = $("#venFormBankToggleRow");
    const preview = $("#venFormBankPreview");
    const fields = $("#venFormBankFields");

    if (!bankId) {
      toggleRow.hidden = true;
      preview.hidden = true;
      fields.hidden = false;
      $("#venFormCustomBank").checked = true;
      return;
    }

    toggleRow.hidden = false;
    const useCustom = $("#venFormCustomBank").checked;
    if (useCustom) {
      preview.hidden = true;
      fields.hidden = false;
    } else {
      fields.hidden = true;
      const bank = (typeof ERP_BankRepository !== "undefined") ? ERP_BankRepository.findById(bankId) : null;
      preview.hidden = false;
      preview.textContent = bank
        ? `Linked to Bank Master: ${ERP_BankRepository.maskedLabel(bank)}, IFSC ${bank.ifscCode}.`
        : "This bank account could not be found.";
    }
  }

  function openAddModal() {
    editingId = null;
    $("#venFormTitle").textContent = "Add vendor";
    $("#venFormIntro").textContent = "Add a vendor — a supplier or service provider your company buys from.";
    $("#venFormSaveBtn").textContent = "Add Vendor";
    $("#venFormName").value = "";
    populateTypeOptions();
    $("#venFormGstin").value = "";
    $("#venFormPan").value = "";
    $("#venFormAddress1").value = "";
    $("#venFormAddress2").value = "";
    $("#venFormCity").value = "";
    $("#venFormState").value = "";
    $("#venFormPincode").value = "";
    $("#venFormContact").value = "";
    $("#venFormEmail").value = "";
    $("#venFormPhone").value = "";
    $("#venFormPaymentTerms").value = "";
    populateBankOptions();
    $("#venFormBank").value = "";
    $("#venFormBankName").value = "";
    $("#venFormBankAccount").value = "";
    $("#venFormBankIfsc").value = "";
    $("#venFormCustomBank").checked = true;
    refreshBankMode();
    $("#venFormNotes").value = "";
    clearFormErrors();
    refreshGstinDerivedState();
    refreshNameDupHint();
    openModal("venFormModal");
  }

  function openEditModal(v) {
    editingId = v.id;
    $("#venFormTitle").textContent = "Edit vendor";
    $("#venFormIntro").textContent = "Update this vendor's details.";
    $("#venFormSaveBtn").textContent = "Save Changes";
    $("#venFormName").value = v.vendorName;
    populateTypeOptions();
    $("#venFormType").value = v.vendorType;
    $("#venFormGstin").value = v.gstin || "";
    $("#venFormPan").value = v.pan || "";
    $("#venFormAddress1").value = v.address1 || "";
    $("#venFormAddress2").value = v.address2 || "";
    $("#venFormCity").value = v.city || "";
    $("#venFormState").value = v.state || "";
    $("#venFormPincode").value = v.pincode || "";
    $("#venFormContact").value = v.contactPerson || "";
    $("#venFormEmail").value = v.email || "";
    $("#venFormPhone").value = v.phone || "";
    $("#venFormPaymentTerms").value = (v.paymentTermsDays === null || v.paymentTermsDays === undefined) ? "" : String(v.paymentTermsDays);
    populateBankOptions();
    $("#venFormBank").value = v.bankId || "";
    $("#venFormBankName").value = v.bankName || "";
    $("#venFormBankAccount").value = v.bankAccountNumber || "";
    $("#venFormBankIfsc").value = v.bankIfsc || "";
    $("#venFormCustomBank").checked = !v.bankId;
    refreshBankMode();
    $("#venFormNotes").value = v.notes || "";
    clearFormErrors();
    refreshGstinDerivedState();
    refreshNameDupHint();
    openModal("venFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#venFormName").value.trim();
    if (!name) { setFormError("venFormName", "Vendor name is required."); valid = false; }
    else if (name.length > 80) { setFormError("venFormName", "Maximum 80 characters allowed."); valid = false; }

    const gstin = $("#venFormGstin").value.trim().toUpperCase();
    if (gstin) {
      if (!ERP_GstRepository.gstinPattern.test(gstin)) { setFormError("venFormGstin", "That doesn't look like a valid GSTIN (15 characters: e.g. 27ABCDE1234F1Z5)."); valid = false; }
      else if (ERP_VendorRepository.hasDuplicateGstin(company.id, gstin, editingId)) { setFormError("venFormGstin", "Another vendor already uses this GSTIN."); valid = false; }
    }

    const pan = $("#venFormPan").value.trim().toUpperCase();
    if (pan && !PAN_PATTERN.test(pan)) { setFormError("venFormPan", "PAN must look like ABCDE1234F."); valid = false; }

    if (!$("#venFormAddress1").value.trim()) { setFormError("venFormAddress1", "Address line 1 is required."); valid = false; }
    if (!$("#venFormCity").value.trim()) { setFormError("venFormCity", "City is required."); valid = false; }
    if (!$("#venFormState").value) { setFormError("venFormState", "State is required."); valid = false; }

    const email = $("#venFormEmail").value.trim();
    if (email && !EMAIL_PATTERN.test(email)) { setFormError("venFormEmail", "Enter a valid email address."); valid = false; }

    const termsValue = $("#venFormPaymentTerms").value;
    if (termsValue !== "" && (isNaN(parseInt(termsValue, 10)) || parseInt(termsValue, 10) < 0)) {
      setFormError("venFormPaymentTerms", "Enter 0 or more days, or leave blank to use the company default.");
      valid = false;
    }

    // Only validate the free-text IFSC when it's actually the active mode
    // (no bank linked, or "enter different bank details" is ticked) — a
    // linked Bank Master account has already been validated on its own page.
    const usingCustomBank = !$("#venFormBank").value || $("#venFormCustomBank").checked;
    if (usingCustomBank) {
      const ifsc = $("#venFormBankIfsc").value.trim().toUpperCase();
      const ifscPattern = (typeof ERP_BankRepository !== "undefined") ? ERP_BankRepository.ifscPattern : ERP_VendorRepository.ifscPattern;
      if (ifsc && !ifscPattern.test(ifsc)) { setFormError("venFormBankIfsc", "That doesn't look like a valid IFSC code (e.g. SBIN0001234)."); valid = false; }
    }

    return valid;
  }

  function bindFormModal() {
    $("#venAddBtn").addEventListener("click", openAddModal);
    $("#venFormGstin").addEventListener("input", refreshGstinDerivedState);
    $("#venFormName").addEventListener("input", refreshNameDupHint);
    $("#venFormBank").addEventListener("change", () => { $("#venFormCustomBank").checked = false; refreshBankMode(); });
    $("#venFormCustomBank").addEventListener("change", refreshBankMode);

    $("#venFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const termsValue = $("#venFormPaymentTerms").value;
      const payload = {
        vendorName: $("#venFormName").value.trim(),
        vendorType: $("#venFormType").value,
        gstin: $("#venFormGstin").value.trim().toUpperCase(),
        pan: $("#venFormPan").value.trim().toUpperCase(),
        address1: $("#venFormAddress1").value.trim(),
        address2: $("#venFormAddress2").value.trim(),
        city: $("#venFormCity").value.trim(),
        state: $("#venFormState").value,
        pincode: $("#venFormPincode").value.trim(),
        contactPerson: $("#venFormContact").value.trim(),
        email: $("#venFormEmail").value.trim(),
        phone: $("#venFormPhone").value.trim(),
        paymentTermsDays: termsValue === "" ? null : parseInt(termsValue, 10),
        bankId: $("#venFormBank").value || null,
        bankName: $("#venFormBankName").value.trim(),
        bankAccountNumber: $("#venFormBankAccount").value.trim(),
        bankIfsc: $("#venFormBankIfsc").value.trim().toUpperCase(),
        notes: $("#venFormNotes").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this vendor?",
          message: `"${payload.vendorName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_VendorRepository.update(editingId, payload);
            logSystemActivity({ module: "Vendor Master", action: "Update", description: `Updated vendor "${payload.vendorName}" for ${company.name}` });
            closeModal("venFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_VendorRepository.findById(editingId));
            showToast("Vendor updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this vendor?",
          message: `"${payload.vendorName}" (${payload.vendorType}) will be added.`,
          confirmLabel: "Add Vendor",
          onConfirm: () => {
            const created = ERP_VendorRepository.create(company, payload);
            logSystemActivity({ module: "Vendor Master", action: "Create", description: `Added vendor "${created.vendorName}" (${created.vendorCode}) for ${company.name}` });
            closeModal("venFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.vendorName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (three-state: Active / Blocked / Inactive)
     --------------------------------------------------------------------- */
  function requestSetStatus(v, newStatus) {
    const labels = {
      Active: v.status === "Blocked" ? "Unblock" : "Reactivate",
      Blocked: "Block",
      Inactive: "Deactivate"
    };
    const pastTense = {
      Active: v.status === "Blocked" ? "Unblocked" : "Reactivated",
      Blocked: "Blocked",
      Inactive: "Deactivated"
    };
    const messages = {
      Active: `"${v.vendorName}" will become Active again.`,
      Blocked: `"${v.vendorName}" will be marked Blocked — it won't be usable on new purchase orders once Procurement exists, but nothing already on record is affected. Reversible any time.`,
      Inactive: `"${v.vendorName}" will be marked Inactive. It stays on record and can be reactivated any time.`
    };
    openConfirm({
      title: `${labels[newStatus]}?`,
      message: messages[newStatus],
      confirmLabel: labels[newStatus],
      onConfirm: () => {
        ERP_VendorRepository.setStatus(v.id, newStatus);
        logSystemActivity({ module: "Vendor Master", action: labels[newStatus], description: `${pastTense[newStatus]} vendor "${v.vendorName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === v.id) openDetailModal(ERP_VendorRepository.findById(v.id));
        showToast(`"${v.vendorName}" is now ${newStatus}.`, "success");
      }
    });
  }

  function requestDelete(v) {
    openConfirm({
      title: "Delete this vendor?",
      message: `"${v.vendorName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_VendorRepository.remove(v.id);
        logSystemActivity({ module: "Vendor Master", action: "Delete", description: `Deleted vendor "${v.vendorName}" for ${company.name}`, severity: "warning" });
        if (detailId === v.id) closeModal("venDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${v.vendorName}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(v) {
    const footer = $("#venDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(v));
    if (v.status === "Active") {
      addBtn("Block", "btn btn--ghost", () => requestSetStatus(v, "Blocked"));
      addBtn("Deactivate", "btn btn--ghost", () => requestSetStatus(v, "Inactive"));
    } else if (v.status === "Blocked") {
      addBtn("Unblock", "btn btn--ghost", () => requestSetStatus(v, "Active"));
      addBtn("Deactivate", "btn btn--ghost", () => requestSetStatus(v, "Inactive"));
    } else {
      addBtn("Reactivate", "btn btn--ghost", () => requestSetStatus(v, "Active"));
    }
    addBtn("Edit", "btn btn--primary", () => { closeModal("venDetailModal"); openEditModal(v); });
  }

  function openDetailModal(v) {
    detailId = v.id;
    const { days, source } = ERP_VendorRepository.getEffectivePaymentTerms(v, company);
    const bankDetails = ERP_VendorRepository.getEffectiveBankDetails(v);
    const bankSourceTag = bankDetails.source === "bank-master" ? `<span class="profile-subtle">(from Bank Master)</span>` : `<span class="profile-subtle">(entered here)</span>`;
    const avgRating = (typeof ERP_VendorEvaluationRepository !== "undefined") ? ERP_VendorEvaluationRepository.getAverageScoreForVendor(v.id) : null;
    const avgRatingRow = avgRating != null
      ? `<div><dt>Average Rating</dt><dd>${avgRating.toFixed(1)} / 5 <span class="profile-subtle">(from Vendor Evaluation)</span></dd></div>`
      : "";

    $("#venDetailTitle").textContent = `${v.vendorName} · ${v.vendorCode}`;
    $("#venDetailBody").innerHTML = `
      <div><dt>Vendor Name</dt><dd>${escapeHtml(v.vendorName)}</dd></div>
      <div><dt>Vendor Code</dt><dd>${escapeHtml(v.vendorCode)}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(v.vendorType)}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${STATUS_BADGE[v.status]}">${v.status}</span></dd></div>
      ${avgRatingRow}
      <div><dt>GSTIN</dt><dd>${v.gstin ? escapeHtml(v.gstin) : "Not registered"}</dd></div>
      <div><dt>PAN</dt><dd>${escapeHtml(v.pan || "—")}</dd></div>
      <div><dt>Address</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(`${v.address1}${v.address2 ? ", " + v.address2 : ""}, ${v.city}, ${v.state} ${v.pincode || ""}`.trim())}</dd></div>
      <div><dt>Contact Person</dt><dd>${escapeHtml(v.contactPerson || "—")}</dd></div>
      <div><dt>Email</dt><dd>${escapeHtml(v.email || "—")}</dd></div>
      <div><dt>Phone</dt><dd>${escapeHtml(v.phone || "—")}</dd></div>
      <div><dt>Payment Terms</dt><dd>${days} days ${source === "company-default" ? `<span class="profile-subtle">(company default)</span>` : `<span class="profile-subtle">(vendor-specific)</span>`}</dd></div>
      <div><dt>Bank Name</dt><dd>${bankDetails.bankName ? escapeHtml(bankDetails.bankName) + " " + bankSourceTag : "—"}</dd></div>
      <div><dt>Account Number</dt><dd>${escapeHtml(bankDetails.accountNumber || "—")}</dd></div>
      <div><dt>IFSC</dt><dd>${escapeHtml(bankDetails.ifscCode || "—")}</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(v.createdAt))}</dd></div>
      ${v.notes ? `<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(v.notes)}</dd></div>` : ""}
    `;

    renderDetailFooter(v);
    openModal("venDetailModal");
  }

  function bindDetailModal() {
    $("#venTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const v = ERP_VendorRepository.findById(viewBtn.dataset.id);
        if (v) openDetailModal(v);
        return;
      }
      if (actionBtn) {
        const v = ERP_VendorRepository.findById(actionBtn.dataset.id);
        if (v) requestSetStatus(v, actionBtn.dataset.action);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "vendors")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading vendors…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#venContent").hidden = true;
      $("#venSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#venContent").hidden = false;
      $("#venHeaderActions").hidden = false;
      $("#venSubtitle").textContent = `Managing vendors for ${company.name} (${company.companyCode}).`;
      buildTypeChips();
      renderAll();
      renderActivity();
      bindToolbar();
      bindFormModal();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
