/* =============================================================================
   DOT ERP — pages/customers.js
   Phase 3, Module 03: Customer Master

   Flat list, Vendor Master's mirror. See data/customer-data.js's header for
   the full reasoning behind reusing GST Details' GSTIN validation/state-
   derivation, the soft-name/hard-GSTIN duplicate split, the Active/Blocked/
   Inactive three-state lifecycle (Blocked = credit hold), and why Credit
   Period is deliberately its OWN field rather than sharing Vendor Master's
   Company Settings payment-terms fallback.
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
  let baseCurrency = null;
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
  function formatMoney(amount) {
    const n = Number(amount) || 0;
    const decimals = baseCurrency ? baseCurrency.decimalPlaces : 0;
    return `${baseCurrency ? baseCurrency.symbol : "₹"}${n.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
  }
  function formatPct(pct) {
    if (!isFinite(pct)) return "—";
    return `${Math.round(pct)}%`;
  }
  function creditBarHtml(c, extraClass) {
    const { utilizationPct } = ERP_CustomerRepository.getCreditUsage(c);
    const band = ERP_CustomerRepository.getCreditUtilizationBand(c);
    const fillClass = band === "over" ? "budget-bar__fill--over" : band === "near" ? "budget-bar__fill--near" : "";
    const widthPct = Math.min(100, isFinite(utilizationPct) ? utilizationPct : 100);
    return `<div class="budget-bar ${extraClass || ""}"><div class="budget-bar__fill ${fillClass}" style="width:${widthPct}%"></div></div>`;
  }


  /* -----------------------------------------------------------------------
     FILTER / SORT / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_CustomerRepository.getAllForCompany(company.id);

    if (filterType !== "all") rows = rows.filter((c) => c.customerType === filterType);
    if (filterStatus !== "all") rows = rows.filter((c) => c.status === filterStatus);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((c) =>
        c.customerName.toLowerCase().includes(term) ||
        c.customerCode.toLowerCase().includes(term) ||
        (c.gstin || "").toLowerCase().includes(term) ||
        (c.contactPerson || "").toLowerCase().includes(term)
      );
    }

    return rows.slice().sort((a, b) => {
      const diff = a.customerName.localeCompare(b.customerName);
      return sortOrder === "desc" ? -diff : diff;
    });
  }

  function renderSummary() {
    const all = ERP_CustomerRepository.getAllForCompany(company.id);
    $("#cusSummaryTotal").textContent = String(all.length);
    $("#cusSummaryActive").textContent = String(all.filter((c) => c.status === "Active").length);
    $("#cusSummaryBlocked").textContent = String(all.filter((c) => c.status === "Blocked").length);
    const totalOutstanding = all.reduce((sum, c) => sum + ERP_CustomerRepository.getCreditUsage(c).outstanding, 0);
    $("#cusSummaryOutstanding").textContent = formatMoney(totalOutstanding);
  }


  /* -----------------------------------------------------------------------
     TYPE CHIPS (built from the fixed reference list)
     --------------------------------------------------------------------- */
  function buildTypeChips() {
    const container = $("#cusTypeChips");
    const extra = ERP_CustomerRepository.customerTypes.map((type) =>
      `<button type="button" class="chip" data-type="${escapeHtml(type)}">${escapeHtml(type)}</button>`
    ).join("");
    container.insertAdjacentHTML("beforeend", extra);
  }


  /* -----------------------------------------------------------------------
     TABLE + PAGINATION
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#cusPagination");
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

    $("#cusEmptyState").hidden = all.length !== 0;
    $("#cusTable").hidden = all.length === 0;

    $("#cusTableBody").innerHTML = pageItems.map((c) => {
      const { utilizationPct } = ERP_CustomerRepository.getCreditUsage(c);
      const statusBadge = `<span class="status-badge status-badge--${STATUS_BADGE[c.status]}">${c.status}</span>`;
      let quickAction = "";
      if (c.status === "Active") quickAction = `<button type="button" class="link-btn" data-action="Blocked" data-id="${c.id}">Block</button>`;
      else if (c.status === "Blocked") quickAction = `<button type="button" class="link-btn" data-action="Active" data-id="${c.id}">Unblock</button>`;
      else quickAction = `<button type="button" class="link-btn" data-action="Active" data-id="${c.id}">Reactivate</button>`;

      return `
      <tr>
        <td><code>${escapeHtml(c.customerCode)}</code></td>
        <td>${escapeHtml(c.customerName)}</td>
        <td>${escapeHtml(c.customerType)}</td>
        <td>${c.gstin ? `<code>${escapeHtml(c.gstin)}</code>` : `<span class="profile-subtle">Not registered</span>`}</td>
        <td>${formatMoney(c.creditLimit)}</td>
        <td>${formatPct(utilizationPct)}${creditBarHtml(c, "budget-bar--sm")}</td>
        <td>${statusBadge}</td>
        <td>
          <button type="button" class="row-detail-btn" data-id="${c.id}">View</button>
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
    $$("#cusTypeChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#cusTypeChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterType = chip.dataset.type;
        page = 1;
        renderTable();
      });
    });

    $$("#cusStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#cusStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#cusSortBtn").addEventListener("click", () => {
      sortOrder = sortOrder === "asc" ? "desc" : "asc";
      $("#cusSortBtn").textContent = sortOrder === "asc" ? "Name A-Z" : "Name Z-A";
      page = 1;
      renderTable();
    });

    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value;
      page = 1;
      renderTable();
    });

    $("#cusExportCsvBtn").addEventListener("click", exportCsv);
    $("#cusPrintBtn").addEventListener("click", printList);
  }

  function exportCsv() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Code", "Name", "Type", "GSTIN", "PAN", "City", "State", "Contact Person", "Email", "Phone", "Credit Period (days)", "Credit Limit", "Current Outstanding", "Status"];
    const csvRows = [header.join(",")];
    rows.forEach((c) => {
      const line = [
        c.customerCode, c.customerName, c.customerType, c.gstin || "", c.pan || "",
        c.city || "", c.state || "", c.contactPerson || "", c.email || "", c.phone || "",
        c.creditPeriodDays, c.creditLimit, ERP_CustomerRepository.getCreditUsage(c).outstanding, c.status
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `erp-customers-${company.companyCode}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Customers exported as CSV.", "success", { title: "Export complete" });
  }

  function printList() {
    const rows = getFilteredSorted();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((c) => {
      const { utilizationPct } = ERP_CustomerRepository.getCreditUsage(c);
      return `<tr><td>${escapeHtml(c.customerCode)}</td><td>${escapeHtml(c.customerName)}</td><td>${escapeHtml(c.customerType)}</td><td>${escapeHtml(c.gstin || "—")}</td><td>${escapeHtml(formatMoney(c.creditLimit))}</td><td>${escapeHtml(formatPct(utilizationPct))}</td><td>${escapeHtml(c.status)}</td></tr>`;
    }).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Customer Register</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>${escapeHtml(company.name)} — Customer Register</h1>
        <p>Generated ${escapeHtml(formatDateTime(new Date()))} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th>GSTIN</th><th>Credit Limit</th><th>Utilization</th><th>Status</th></tr></thead>
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
      .filter((e) => e.module === "Customer Master")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    $("#cusActivityEmptyState").hidden = relevant.length !== 0;
    $("#cusActivityList").innerHTML = relevant.map((e) => `
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
    const gstin = $("#cusFormGstin").value.trim().toUpperCase();
    if (!gstin) {
      $("#cusFormGstinHint").textContent = "Valid GSTINs auto-fill the State field below.";
      return;
    }
    if (ERP_GstRepository.gstinPattern.test(gstin)) {
      const derived = ERP_GstRepository.deriveState(gstin);
      $("#cusFormState").value = derived;
      $("#cusFormGstinHint").textContent = `State auto-detected as ${derived} from this GSTIN — change it below if that's wrong.`;
    } else {
      $("#cusFormGstinHint").textContent = "Valid GSTINs auto-fill the State field below.";
    }
  }


  /* -----------------------------------------------------------------------
     ADD / EDIT CUSTOMER MODAL
     --------------------------------------------------------------------- */
  function setFormError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearFormErrors() {
    ["cusFormName", "cusFormGstin", "cusFormPan", "cusFormAddress1", "cusFormCity", "cusFormState", "cusFormEmail", "cusFormCreditPeriod", "cusFormCreditLimit", "cusFormOutstanding"].forEach((f) => setFormError(f, ""));
  }

  function populateTypeOptions() {
    $("#cusFormType").innerHTML = ERP_CustomerRepository.customerTypes.map((t) => `<option>${escapeHtml(t)}</option>`).join("");
  }

  function refreshNameDupHint() {
    const name = $("#cusFormName").value.trim();
    $("#cusFormNameDupHint").hidden = !name || !ERP_CustomerRepository.hasDuplicateCustomerName(company.id, name, editingId);
  }

  function openAddModal() {
    editingId = null;
    $("#cusFormTitle").textContent = "Add customer";
    $("#cusFormIntro").textContent = "Add a customer — someone your company sells to.";
    $("#cusFormSaveBtn").textContent = "Add Customer";
    $("#cusFormName").value = "";
    populateTypeOptions();
    $("#cusFormGstin").value = "";
    $("#cusFormPan").value = "";
    $("#cusFormAddress1").value = "";
    $("#cusFormAddress2").value = "";
    $("#cusFormCity").value = "";
    $("#cusFormState").value = "";
    $("#cusFormPincode").value = "";
    $("#cusFormContact").value = "";
    $("#cusFormEmail").value = "";
    $("#cusFormPhone").value = "";
    $("#cusFormCreditPeriod").value = "30";
    $("#cusFormCreditLimit").value = "0";
    $("#cusFormOutstanding").value = formatMoney(0) + " (no invoices yet)";
    $("#cusFormNotes").value = "";
    clearFormErrors();
    refreshGstinDerivedState();
    refreshNameDupHint();
    openModal("cusFormModal");
  }

  function openEditModal(c) {
    editingId = c.id;
    $("#cusFormTitle").textContent = "Edit customer";
    $("#cusFormIntro").textContent = "Update this customer's details.";
    $("#cusFormSaveBtn").textContent = "Save Changes";
    $("#cusFormName").value = c.customerName;
    populateTypeOptions();
    $("#cusFormType").value = c.customerType;
    $("#cusFormGstin").value = c.gstin || "";
    $("#cusFormPan").value = c.pan || "";
    $("#cusFormAddress1").value = c.address1 || "";
    $("#cusFormAddress2").value = c.address2 || "";
    $("#cusFormCity").value = c.city || "";
    $("#cusFormState").value = c.state || "";
    $("#cusFormPincode").value = c.pincode || "";
    $("#cusFormContact").value = c.contactPerson || "";
    $("#cusFormEmail").value = c.email || "";
    $("#cusFormPhone").value = c.phone || "";
    $("#cusFormCreditPeriod").value = String(c.creditPeriodDays);
    $("#cusFormCreditLimit").value = String(c.creditLimit || 0);
    $("#cusFormOutstanding").value = formatMoney(ERP_CustomerRepository.getCreditUsage(c).outstanding);
    $("#cusFormNotes").value = c.notes || "";
    clearFormErrors();
    refreshGstinDerivedState();
    refreshNameDupHint();
    openModal("cusFormModal");
  }

  function validateForm() {
    let valid = true;
    clearFormErrors();

    const name = $("#cusFormName").value.trim();
    if (!name) { setFormError("cusFormName", "Customer name is required."); valid = false; }
    else if (name.length > 80) { setFormError("cusFormName", "Maximum 80 characters allowed."); valid = false; }

    const gstin = $("#cusFormGstin").value.trim().toUpperCase();
    if (gstin) {
      if (!ERP_GstRepository.gstinPattern.test(gstin)) { setFormError("cusFormGstin", "That doesn't look like a valid GSTIN (15 characters: e.g. 27ABCDE1234F1Z5)."); valid = false; }
      else if (ERP_CustomerRepository.hasDuplicateGstin(company.id, gstin, editingId)) { setFormError("cusFormGstin", "Another customer already uses this GSTIN."); valid = false; }
    }

    const pan = $("#cusFormPan").value.trim().toUpperCase();
    if (pan && !PAN_PATTERN.test(pan)) { setFormError("cusFormPan", "PAN must look like ABCDE1234F."); valid = false; }

    if (!$("#cusFormAddress1").value.trim()) { setFormError("cusFormAddress1", "Address line 1 is required."); valid = false; }
    if (!$("#cusFormCity").value.trim()) { setFormError("cusFormCity", "City is required."); valid = false; }
    if (!$("#cusFormState").value) { setFormError("cusFormState", "State is required."); valid = false; }

    const email = $("#cusFormEmail").value.trim();
    if (email && !EMAIL_PATTERN.test(email)) { setFormError("cusFormEmail", "Enter a valid email address."); valid = false; }

    const creditPeriod = parseInt($("#cusFormCreditPeriod").value, 10);
    if ($("#cusFormCreditPeriod").value === "" || isNaN(creditPeriod) || creditPeriod < 0) { setFormError("cusFormCreditPeriod", "Enter 0 or more days."); valid = false; }

    const creditLimit = parseFloat($("#cusFormCreditLimit").value);
    if ($("#cusFormCreditLimit").value === "" || isNaN(creditLimit) || creditLimit < 0) { setFormError("cusFormCreditLimit", "Enter a credit limit of 0 or more."); valid = false; }

    return valid;
  }

  function bindFormModal() {
    $("#cusAddBtn").addEventListener("click", openAddModal);
    $("#cusFormGstin").addEventListener("input", refreshGstinDerivedState);
    $("#cusFormName").addEventListener("input", refreshNameDupHint);

    $("#cusFormSaveBtn").addEventListener("click", () => {
      if (!validateForm()) return;

      const payload = {
        customerName: $("#cusFormName").value.trim(),
        customerType: $("#cusFormType").value,
        gstin: $("#cusFormGstin").value.trim().toUpperCase(),
        pan: $("#cusFormPan").value.trim().toUpperCase(),
        address1: $("#cusFormAddress1").value.trim(),
        address2: $("#cusFormAddress2").value.trim(),
        city: $("#cusFormCity").value.trim(),
        state: $("#cusFormState").value,
        pincode: $("#cusFormPincode").value.trim(),
        contactPerson: $("#cusFormContact").value.trim(),
        email: $("#cusFormEmail").value.trim(),
        phone: $("#cusFormPhone").value.trim(),
        creditPeriodDays: parseInt($("#cusFormCreditPeriod").value, 10) || 0,
        creditLimit: parseFloat($("#cusFormCreditLimit").value) || 0,
        notes: $("#cusFormNotes").value.trim()
      };

      if (editingId) {
        openConfirm({
          title: "Save changes to this customer?",
          message: `"${payload.customerName}"'s details will be updated.`,
          confirmLabel: "Save changes",
          onConfirm: () => {
            ERP_CustomerRepository.update(editingId, payload);
            logSystemActivity({ module: "Customer Master", action: "Update", description: `Updated customer "${payload.customerName}" for ${company.name}` });
            closeModal("cusFormModal");
            renderAll();
            renderActivity();
            if (detailId === editingId) openDetailModal(ERP_CustomerRepository.findById(editingId));
            showToast("Customer updated.", "success");
          }
        });
      } else {
        openConfirm({
          title: "Add this customer?",
          message: `"${payload.customerName}" (${payload.customerType}) will be added.`,
          confirmLabel: "Add Customer",
          onConfirm: () => {
            const created = ERP_CustomerRepository.create(company, payload);
            logSystemActivity({ module: "Customer Master", action: "Create", description: `Added customer "${created.customerName}" (${created.customerCode}) for ${company.name}` });
            closeModal("cusFormModal");
            renderAll();
            renderActivity();
            showToast(`"${created.customerName}" added.`, "success");
          }
        });
      }
    });
  }


  /* -----------------------------------------------------------------------
     LIFECYCLE ACTIONS (three-state: Active / Blocked / Inactive)
     --------------------------------------------------------------------- */
  function requestSetStatus(c, newStatus) {
    const labels = {
      Active: c.status === "Blocked" ? "Unblock" : "Reactivate",
      Blocked: "Block",
      Inactive: "Deactivate"
    };
    const pastTense = {
      Active: c.status === "Blocked" ? "Unblocked" : "Reactivated",
      Blocked: "Blocked",
      Inactive: "Deactivated"
    };
    const messages = {
      Active: `"${c.customerName}" will become Active again.`,
      Blocked: `"${c.customerName}" will be placed on credit hold — no new orders once Sales exists, but nothing already on record is affected. Reversible any time.`,
      Inactive: `"${c.customerName}" will be marked Inactive. It stays on record and can be reactivated any time.`
    };
    openConfirm({
      title: `${labels[newStatus]}?`,
      message: messages[newStatus],
      confirmLabel: labels[newStatus],
      onConfirm: () => {
        ERP_CustomerRepository.setStatus(c.id, newStatus);
        logSystemActivity({ module: "Customer Master", action: labels[newStatus], description: `${pastTense[newStatus]} customer "${c.customerName}" for ${company.name}` });
        renderAll();
        renderActivity();
        if (detailId === c.id) openDetailModal(ERP_CustomerRepository.findById(c.id));
        showToast(`"${c.customerName}" is now ${newStatus}.`, "success");
      }
    });
  }

  function requestDelete(c) {
    openConfirm({
      title: "Delete this customer?",
      message: `"${c.customerName}" will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_CustomerRepository.remove(c.id);
        logSystemActivity({ module: "Customer Master", action: "Delete", description: `Deleted customer "${c.customerName}" for ${company.name}`, severity: "warning" });
        if (detailId === c.id) closeModal("cusDetailModal");
        renderAll();
        renderActivity();
        showToast(`"${c.customerName}" deleted.`, "info");
      }
    });
  }


  /* -----------------------------------------------------------------------
     DETAIL MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(c) {
    const footer = $("#cusDetailFooter");
    footer.innerHTML = "";
    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };

    addBtn("Delete", "btn btn--danger-outline", () => requestDelete(c));
    if (c.status === "Active") {
      addBtn("Block", "btn btn--ghost", () => requestSetStatus(c, "Blocked"));
      addBtn("Deactivate", "btn btn--ghost", () => requestSetStatus(c, "Inactive"));
    } else if (c.status === "Blocked") {
      addBtn("Unblock", "btn btn--ghost", () => requestSetStatus(c, "Active"));
      addBtn("Deactivate", "btn btn--ghost", () => requestSetStatus(c, "Inactive"));
    } else {
      addBtn("Reactivate", "btn btn--ghost", () => requestSetStatus(c, "Active"));
    }
    addBtn("Edit", "btn btn--primary", () => { closeModal("cusDetailModal"); openEditModal(c); });
  }

  function openDetailModal(c) {
    detailId = c.id;
    const { limit, outstanding, available, utilizationPct } = ERP_CustomerRepository.getCreditUsage(c);
    const band = ERP_CustomerRepository.getCreditUtilizationBand(c);

    $("#cusDetailTitle").textContent = `${c.customerName} · ${c.customerCode}`;
    $("#cusDetailBody").innerHTML = `
      <div><dt>Customer Name</dt><dd>${escapeHtml(c.customerName)}</dd></div>
      <div><dt>Customer Code</dt><dd>${escapeHtml(c.customerCode)}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(c.customerType)}</dd></div>
      <div><dt>Status</dt><dd><span class="status-badge status-badge--${STATUS_BADGE[c.status]}">${c.status}</span></dd></div>
      <div><dt>GSTIN</dt><dd>${c.gstin ? escapeHtml(c.gstin) : "Not registered"}</dd></div>
      <div><dt>PAN</dt><dd>${escapeHtml(c.pan || "—")}</dd></div>
      <div><dt>Address</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(`${c.address1}${c.address2 ? ", " + c.address2 : ""}, ${c.city}, ${c.state} ${c.pincode || ""}`.trim())}</dd></div>
      <div><dt>Contact Person</dt><dd>${escapeHtml(c.contactPerson || "—")}</dd></div>
      <div><dt>Email</dt><dd>${escapeHtml(c.email || "—")}</dd></div>
      <div><dt>Phone</dt><dd>${escapeHtml(c.phone || "—")}</dd></div>
      <div><dt>Credit Period</dt><dd>${c.creditPeriodDays} days</dd></div>
      <div><dt>Created</dt><dd>${formatDateTime(new Date(c.createdAt))}</dd></div>
      ${c.notes ? `<div><dt>Notes</dt><dd style="text-align:left;font-family:var(--font-sans);font-weight:400;">${escapeHtml(c.notes)}</dd></div>` : ""}
    `;

    const fillClass = band === "over" ? "budget-bar__fill--over" : band === "near" ? "budget-bar__fill--near" : "";
    $("#cusDetailCreditBarFill").className = `budget-bar__fill ${fillClass}`;
    $("#cusDetailCreditBarFill").style.width = `${Math.min(100, isFinite(utilizationPct) ? utilizationPct : 100)}%`;
    const availableLabel = available >= 0 ? "available" : "over the limit";
    $("#cusDetailCreditText").textContent =
      `Limit ${formatMoney(limit)} · Outstanding ${formatMoney(outstanding)} · ${formatMoney(Math.abs(available))} ${availableLabel} (${formatPct(utilizationPct)} utilized)`;

    renderDetailFooter(c);
    openModal("cusDetailModal");
  }

  function bindDetailModal() {
    $("#cusTableBody").addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".row-detail-btn");
      const actionBtn = e.target.closest("[data-action]");
      if (viewBtn) {
        const c = ERP_CustomerRepository.findById(viewBtn.dataset.id);
        if (c) openDetailModal(c);
        return;
      }
      if (actionBtn) {
        const c = ERP_CustomerRepository.findById(actionBtn.dataset.id);
        if (c) requestSetStatus(c, actionBtn.dataset.action);
      }
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "customers")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading customers…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#cusContent").hidden = true;
      $("#cusSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#cusContent").hidden = false;
      $("#cusHeaderActions").hidden = false;
      $("#cusSubtitle").textContent = `Managing customers for ${company.name} (${company.companyCode}).`;
      baseCurrency = ERP_CurrencyRepository.ensureBaseCurrency(company);
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
