/* =============================================================================
   DOT ERP — pages/e-way-bill.js
   Phase 16, Module 04: E-Way Bill

   The same "list of eligible records IS the action surface" shape
   `pages/e-invoice.js` already established one module earlier — except
   generation here needs one extra input the trainee supplies (distance
   in km), so the confirm step is replaced with a small inline prompt
   inside the detail modal itself rather than a bare confirm dialog.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity, actorLabel
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let filterStatus = "all";
  let searchTerm = "";
  let page = 1;

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function customerLabel(id) { const c = id ? ERP_CustomerRepository.findById(id) : null; return c ? c.customerName : "Unknown customer"; }

  function ewbStatusOf(row) {
    if (!row.ewayBill) return "Not Generated";
    if (row.ewayBill.status === "Generated" && ERP_EWayBillRepository.isExpired(row.ewayBill)) return "Expired";
    return row.ewayBill.status; // "Generated" | "Cancelled"
  }

  function statusBadge(status) {
    const tone = status === "Generated" ? "success" : status === "Cancelled" ? "danger" : status === "Expired" ? "warning" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }


  /* -----------------------------------------------------------------------
     SUMMARY + LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_EWayBillRepository.getDispatchesForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => ewbStatusOf(r) === filterStatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((r) =>
        (r.dispatch.dispatchCode || "").toLowerCase().includes(q) ||
        customerLabel(ERP_TaxInvoiceRepository.findById(r.dispatch.linkedInvoiceId)?.customerId).toLowerCase().includes(q) ||
        (r.ewayBill && r.ewayBill.ebn || "").includes(q)
      );
    }
    return rows;
  }

  function renderSummary() {
    const all = ERP_EWayBillRepository.getDispatchesForCompany(company.id);
    $("#ewbSummaryTotal").textContent = String(all.length);
    $("#ewbSummaryGenerated").textContent = String(all.filter((r) => ewbStatusOf(r) === "Generated").length);
    $("#ewbSummaryPending").textContent = String(all.filter((r) => ewbStatusOf(r) === "Not Generated").length);
    $("#ewbSummaryExpired").textContent = String(all.filter((r) => ewbStatusOf(r) === "Expired").length);
  }

  function renderPagination(totalPages) {
    const container = $("#ewbPagination");
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

    $("#ewbEmptyState").hidden = all.length !== 0;
    $("#ewbTable").hidden = all.length === 0;

    $("#ewbTableBody").innerHTML = pageItems.map(({ dispatch, ewayBill }) => {
      const invoice = ERP_TaxInvoiceRepository.findById(dispatch.linkedInvoiceId);
      const status = ewbStatusOf({ dispatch, ewayBill });
      const ebnCell = ewayBill ? `<code>${escapeHtml(ewayBill.ebn)}</code>` : "<span class=\"profile-subtle\">—</span>";
      const totals = invoice ? ERP_TaxInvoiceRepository.computeGrandTotal(invoice) : null;
      return `
      <tr>
        <td>${escapeHtml(dispatch.dispatchCode)}</td>
        <td>${dispatch.dispatchDate || "—"}</td>
        <td>${escapeHtml(customerLabel(invoice ? invoice.customerId : null))}</td>
        <td class="text-right">${totals ? formatMoney(totals.total) : "—"}</td>
        <td>${ebnCell}</td>
        <td>${statusBadge(status)}</td>
        <td><button type="button" class="row-detail-btn" data-dispatch-id="${dispatch.id}">${ewayBill ? "View" : "Generate"}</button></td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderSummary(); renderTable(); }

  function bindChips() {
    $$("#ewbStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#ewbStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });
    $("#topbarSearchInput")?.addEventListener("input", (e) => {
      searchTerm = e.target.value.trim();
      page = 1;
      renderTable();
    });
  }

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const relevant = log
      .filter((e) => e.module === "E-Way Bill")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#ewbActivityEmptyState").hidden = relevant.length !== 0;
    $("#ewbActivityList").innerHTML = relevant.map((e) => `
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
     DETAIL / GENERATE MODAL — the one page in this phase whose
     generate step needs a typed input (distance), so the modal grows a
     small inline form rather than staying a bare confirm dialog.
     --------------------------------------------------------------------- */
  function renderDetailFooter(dispatch, ewayBill) {
    const footer = $("#ewbDetailFooter");
    footer.innerHTML = "";

    if (!ewayBill) {
      const check = ERP_EWayBillRepository.isEligible(company.id, dispatch);
      const genBtn = document.createElement("button");
      genBtn.type = "button";
      genBtn.className = "btn btn--primary";
      genBtn.textContent = "Generate E-Way Bill";
      genBtn.disabled = !check.eligible;
      genBtn.addEventListener("click", () => requestGenerate(dispatch));
      footer.appendChild(genBtn);
      if (!check.eligible) {
        const note = document.createElement("p");
        note.className = "field-error";
        note.style.margin = "0";
        note.style.alignSelf = "center";
        note.textContent = check.reason;
        footer.appendChild(note);
      }
    } else if (ewayBill.status === "Generated") {
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn--danger-outline";
      cancelBtn.textContent = "Cancel";
      const cancellable = ERP_EWayBillRepository.canCancel(ewayBill);
      cancelBtn.disabled = !cancellable;
      cancelBtn.title = cancellable ? "" : "More than 24 hours have passed since generation.";
      cancelBtn.addEventListener("click", () => requestCancel(ewayBill));
      footer.appendChild(cancelBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn btn--ghost";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => closeModal("ewbDetailModal"));
    footer.appendChild(closeBtn);
  }

  function openDetailModal(dispatch) {
    const ewayBill = ERP_EWayBillRepository.findForDispatch(company.id, dispatch.id);
    const invoice = ERP_TaxInvoiceRepository.findById(dispatch.linkedInvoiceId);
    const totals = invoice ? ERP_TaxInvoiceRepository.computeGrandTotal(invoice) : null;
    const status = ewbStatusOf({ dispatch, ewayBill });

    $("#ewbDetailTitle").textContent = `E-Way Bill — ${dispatch.dispatchCode}`;
    $("#ewbDetailBody").innerHTML = `
      <div><dt>Dispatch</dt><dd>${escapeHtml(dispatch.dispatchCode)}</dd></div>
      <div><dt>Invoice</dt><dd>${invoice ? escapeHtml(invoice.invoiceCode) : "—"}</dd></div>
      <div><dt>Customer</dt><dd>${escapeHtml(customerLabel(invoice ? invoice.customerId : null))}</dd></div>
      <div><dt>Consignment Value</dt><dd>${totals ? formatMoney(totals.total) : "—"}</dd></div>
      <div><dt>Transporter</dt><dd>${escapeHtml(dispatch.transporterName || "—")}</dd></div>
      <div><dt>Vehicle</dt><dd>${escapeHtml(dispatch.vehicleNumber || "—")}</dd></div>
      ${ewayBill ? `
      <div><dt>EBN</dt><dd><code>${escapeHtml(ewayBill.ebn)}</code></dd></div>
      <div><dt>Movement Type</dt><dd>${ewayBill.isInterState ? "Inter-State" : "Intra-State"}</dd></div>
      <div><dt>Distance</dt><dd>${ewayBill.distanceKm} km</dd></div>
      <div><dt>Validity</dt><dd>${ewayBill.validityDays} day(s) — until ${formatDateTime(new Date(ewayBill.validUntil))}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(status)}</dd></div>
      <div><dt>Generated</dt><dd>${formatDateTime(new Date(ewayBill.generatedAt))} by ${escapeHtml(actorLabel(ewayBill.generatedByUsername))}</dd></div>
      ${ewayBill.status === "Cancelled" ? `<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(ewayBill.cancelledAt))} by ${escapeHtml(actorLabel(ewayBill.cancelledByUsername))}</dd></div>` : ""}
      ` : `
      <div><dt>Status</dt><dd>${statusBadge("Not Generated")}</dd></div>
      `}
    `;

    const genField = $("#ewbDistanceField");
    const check = ERP_EWayBillRepository.isEligible(company.id, dispatch);
    genField.hidden = !!ewayBill || !check.eligible;
    if (!ewayBill && check.eligible) $("#ewbDistanceInput").value = "";

    renderDetailFooter(dispatch, ewayBill);
    openModal("ewbDetailModal");
  }

  function requestGenerate(dispatch) {
    const km = Number($("#ewbDistanceInput").value);
    if (!km || km <= 0) { showToast("Enter the approximate distance in km first.", "warning"); return; }
    openConfirm({
      title: "Generate an e-way bill for this dispatch?",
      message: `This produces an E-Way Bill Number (EBN) covering ${dispatch.dispatchCode}, valid for ${Math.max(1, Math.ceil(km / 200))} day(s) at ${km} km. It can be cancelled within 24 hours; after that, the shipment must complete on this EBN as issued.`,
      confirmLabel: "Generate",
      onConfirm: () => {
        const result = ERP_EWayBillRepository.generate(company, dispatch, km, session.username);
        if (!result.success) { showToast(result.reason, "danger"); return; }
        logSystemActivity({ module: "E-Way Bill", action: "Generate", description: `Generated e-way bill for dispatch "${dispatch.dispatchCode}" — ${km}km, ${result.record.validityDays} day(s) valid (${company.name})` });
        closeModal("ewbDetailModal");
        renderAll();
        renderActivity();
        showToast(`E-way bill generated — valid ${result.record.validityDays} day(s).`, "success");
      }
    });
  }

  function requestCancel(ewayBill) {
    if (!ERP_EWayBillRepository.canCancel(ewayBill)) return;
    openConfirm({
      title: "Cancel this e-way bill?",
      message: "This is only possible within 24 hours of generation, matching the real rule for an unused EBN.",
      confirmLabel: "Cancel",
      onConfirm: () => {
        const result = ERP_EWayBillRepository.cancel(ewayBill.id, session.username);
        if (!result.success) { showToast(result.reason, "danger"); return; }
        logSystemActivity({ module: "E-Way Bill", action: "Cancel", description: `Cancelled e-way bill for dispatch "${ewayBill.dispatchCode}" (${company.name})` });
        closeModal("ewbDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#ewbTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest(".row-detail-btn");
      if (!btn) return;
      const dispatch = ERP_DispatchRepository.findById(btn.dataset.dispatchId);
      if (dispatch) openDetailModal(dispatch);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "e-way-bill")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading dispatches…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#ewbContent").hidden = true;
      $("#ewbSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#ewbContent").hidden = false;
      $("#ewbSubtitle").textContent = `Dispatched shipments for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
