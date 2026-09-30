/* =============================================================================
   DOT ERP — pages/e-invoice.js
   Phase 16, Module 03: E-Invoice / IRN

   Not a document with a "+ New" flow — this page acts ON existing
   Raised, B2B Tax Invoices, so its list IS the action surface: every
   eligible invoice, its own e-invoice status, and a Generate/View
   button per row. The applicability banner mirrors GSTR-1/3B's own
   status-banner shape, but reports a permanent company-wide fact
   rather than a per-period one.
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

  function eStatusOf(row) {
    if (!row.eInvoice) return "Not Generated";
    return row.eInvoice.status; // "Generated" | "Cancelled" (Cancelled ones are excluded from findForInvoice, so this only ever reads "Generated" in practice — kept generic rather than hardcoded)
  }

  function statusBadge(status) {
    const tone = status === "Generated" ? "success" : status === "Cancelled" ? "danger" : "warning";
    return `<span class="status-badge status-badge--${tone}">${status}</span>`;
  }


  /* -----------------------------------------------------------------------
     APPLICABILITY BANNER
     --------------------------------------------------------------------- */
  function renderApplicabilityBanner() {
    const applicability = ERP_EInvoiceRepository.isApplicable(company.id);
    const banner = $("#eiStatusBanner");
    if (applicability.applicable) {
      banner.className = "profile-card gstr1-banner gstr1-banner--filed";
      banner.innerHTML = `
        <div class="gstr1-banner__row">
          <span class="status-badge status-badge--success">Applicable</span>
          <div>
            <p class="gstr1-banner__title">E-invoicing is mandatory for ${escapeHtml(company.name)}.</p>
            <p class="profile-subtle">Turnover crossed ₹5 crore in ${escapeHtml(applicability.fyLabel)} (${formatMoney(applicability.turnover)}) — this obligation is permanent from that point on, even in a year where turnover later falls back below the line.</p>
          </div>
        </div>`;
    } else {
      banner.className = "profile-card gstr1-banner gstr1-banner--draft";
      banner.innerHTML = `
        <div class="gstr1-banner__row">
          <span class="status-badge status-badge--warning">Not Applicable</span>
          <div>
            <p class="gstr1-banner__title">E-invoicing isn't mandatory yet for ${escapeHtml(company.name)}.</p>
            <p class="profile-subtle">This company's own turnover hasn't crossed ₹5 crore in any financial year on record. Invoices can still be viewed below, but IRN generation is blocked until that threshold is crossed.</p>
          </div>
        </div>`;
    }

    const fastReporting = ERP_EInvoiceRepository.requiresFastReporting(company.id);
    $("#eiFastReportingNote").hidden = !fastReporting.applicable;
    if (fastReporting.applicable) {
      $("#eiFastReportingNote").textContent = `Turnover also crossed ₹10 crore in ${fastReporting.fyLabel} — the 30-day reporting window applies. Invoices generated more than 30 days after their own invoice date will be flagged late below.`;
    }
  }


  /* -----------------------------------------------------------------------
     LIST TABLE
     --------------------------------------------------------------------- */
  function getFilteredSorted() {
    let rows = ERP_EInvoiceRepository.getEligibleInvoicesForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((r) => eStatusOf(r) === filterStatus);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((r) =>
        (r.invoice.invoiceCode || "").toLowerCase().includes(q) ||
        customerLabel(r.invoice.customerId).toLowerCase().includes(q) ||
        (r.eInvoice && r.eInvoice.irn || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }

  function renderSummary() {
    const all = ERP_EInvoiceRepository.getEligibleInvoicesForCompany(company.id);
    $("#eiSummaryTotal").textContent = String(all.length);
    $("#eiSummaryGenerated").textContent = String(all.filter((r) => eStatusOf(r) === "Generated").length);
    $("#eiSummaryPending").textContent = String(all.filter((r) => eStatusOf(r) === "Not Generated").length);
    $("#eiSummaryLate").textContent = String(all.filter((r) => r.eInvoice && r.eInvoice.isLate).length);
  }

  function renderPagination(totalPages) {
    const container = $("#eiPagination");
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

    $("#eiEmptyState").hidden = all.length !== 0;
    $("#eiTable").hidden = all.length === 0;

    $("#eiTableBody").innerHTML = pageItems.map(({ invoice, eInvoice }) => {
      const status = eStatusOf({ invoice, eInvoice });
      const totals = ERP_TaxInvoiceRepository.computeGrandTotal(invoice);
      const irnCell = eInvoice ? `<code>${escapeHtml(eInvoice.irn.slice(0, 16))}…</code>` : "<span class=\"profile-subtle\">—</span>";
      const lateBadge = eInvoice && eInvoice.isLate ? ` <span class="status-badge status-badge--danger">Late</span>` : "";
      return `
      <tr>
        <td>${escapeHtml(invoice.invoiceCode)}</td>
        <td>${invoice.invoiceDate || "—"}</td>
        <td>${escapeHtml(customerLabel(invoice.customerId))}</td>
        <td class="text-right">${formatMoney(totals.total)}</td>
        <td>${irnCell}</td>
        <td>${statusBadge(status)}${lateBadge}</td>
        <td><button type="button" class="row-detail-btn" data-invoice-id="${invoice.id}">${eInvoice ? "View" : "Generate"}</button></td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() { renderApplicabilityBanner(); renderSummary(); renderTable(); }

  function bindChips() {
    $$("#eiStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#eiStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
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
      .filter((e) => e.module === "E-Invoice")
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);
    $("#eiActivityEmptyState").hidden = relevant.length !== 0;
    $("#eiActivityList").innerHTML = relevant.map((e) => `
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
     DETAIL / GENERATE MODAL
     --------------------------------------------------------------------- */
  function renderDetailFooter(invoice, eInvoice) {
    const footer = $("#eiDetailFooter");
    footer.innerHTML = "";

    if (!eInvoice) {
      const check = ERP_EInvoiceRepository.isEligibleInvoice(company.id, invoice);
      const genBtn = document.createElement("button");
      genBtn.type = "button";
      genBtn.className = "btn btn--primary";
      genBtn.textContent = "Generate IRN";
      genBtn.disabled = !check.eligible;
      genBtn.title = check.eligible ? "" : check.reason;
      genBtn.addEventListener("click", () => requestGenerate(invoice));
      footer.appendChild(genBtn);
      if (!check.eligible) {
        const note = document.createElement("p");
        note.className = "field-error";
        note.style.margin = "0";
        note.style.alignSelf = "center";
        note.textContent = check.reason;
        footer.appendChild(note);
      }
    } else if (eInvoice.status === "Generated") {
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn--danger-outline";
      cancelBtn.textContent = "Cancel IRN";
      cancelBtn.disabled = !ERP_EInvoiceRepository.canCancel(eInvoice);
      cancelBtn.title = ERP_EInvoiceRepository.canCancel(eInvoice) ? "" : "More than 24 hours have passed since this IRN was generated — raise a Credit Note instead.";
      cancelBtn.addEventListener("click", () => requestCancel(eInvoice));
      footer.appendChild(cancelBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn btn--ghost";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => closeModal("eiDetailModal"));
    footer.appendChild(closeBtn);
  }

  function openDetailModal(invoice) {
    const eInvoice = ERP_EInvoiceRepository.findForInvoice(company.id, invoice.id);
    const totals = ERP_TaxInvoiceRepository.computeGrandTotal(invoice);

    $("#eiDetailTitle").textContent = `E-Invoice — ${invoice.invoiceCode}`;
    $("#eiDetailBody").innerHTML = `
      <div><dt>Invoice</dt><dd>${escapeHtml(invoice.invoiceCode)}</dd></div>
      <div><dt>Date</dt><dd>${invoice.invoiceDate || "—"}</dd></div>
      <div><dt>Customer</dt><dd>${escapeHtml(customerLabel(invoice.customerId))}</dd></div>
      <div><dt>Invoice Value</dt><dd>${formatMoney(totals.total)}</dd></div>
      ${eInvoice ? `
      <div><dt>IRN</dt><dd style="word-break:break-all;"><code>${escapeHtml(eInvoice.irn)}</code></dd></div>
      <div><dt>QR Payload</dt><dd style="word-break:break-all;font-family:monospace;font-size:12px;">${escapeHtml(eInvoice.qrPayload)}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(eInvoice.status)}${eInvoice.isLate ? ' <span class="status-badge status-badge--danger">Late</span>' : ""}</dd></div>
      <div><dt>Generated</dt><dd>${formatDateTime(new Date(eInvoice.generatedAt))} by ${escapeHtml(actorLabel(eInvoice.generatedByUsername))}</dd></div>
      ${eInvoice.status === "Cancelled" ? `<div><dt>Cancelled</dt><dd>${formatDateTime(new Date(eInvoice.cancelledAt))} by ${escapeHtml(actorLabel(eInvoice.cancelledByUsername))}</dd></div>` : ""}
      ` : `<div><dt>Status</dt><dd>${statusBadge("Not Generated")}</dd></div>`}
    `;
    if (eInvoice) {
      $("#eiQrNote").hidden = false;
    } else {
      $("#eiQrNote").hidden = true;
    }

    renderDetailFooter(invoice, eInvoice);
    openModal("eiDetailModal");
  }

  function requestGenerate(invoice) {
    const check = ERP_EInvoiceRepository.isEligibleInvoice(company.id, invoice);
    if (!check.eligible) return;
    openConfirm({
      title: "Generate an e-invoice for this invoice?",
      message: `This produces an IRN and QR payload for ${invoice.invoiceCode}, the two artifacts that make this invoice legally valid under the e-invoicing mandate. It can be cancelled within 24 hours; after that, a Credit Note is the correct way to reverse it.`,
      confirmLabel: "Generate IRN",
      onConfirm: () => {
        const result = ERP_EInvoiceRepository.generate(company, invoice, session.username);
        if (!result.success) { showToast(result.reason, "danger"); return; }
        logSystemActivity({ module: "E-Invoice", action: "Generate", description: `Generated IRN for invoice "${invoice.invoiceCode}" (${company.name})` });
        closeModal("eiDetailModal");
        renderAll();
        renderActivity();
        const lateNote = result.record.isLate ? " This invoice is flagged late under the 30-day reporting rule." : "";
        showToast(`IRN generated for ${invoice.invoiceCode}.${lateNote}`, result.record.isLate ? "warning" : "success");
      }
    });
  }

  function requestCancel(eInvoice) {
    if (!ERP_EInvoiceRepository.canCancel(eInvoice)) return;
    openConfirm({
      title: "Cancel this IRN?",
      message: "This is only possible within 24 hours of generation, matching real GST law. Once cancelled, this invoice's e-invoice status resets — a fresh IRN can be generated again if needed.",
      confirmLabel: "Cancel IRN",
      onConfirm: () => {
        const result = ERP_EInvoiceRepository.cancel(eInvoice.id, session.username);
        if (!result.success) { showToast(result.reason, "danger"); return; }
        logSystemActivity({ module: "E-Invoice", action: "Cancel", description: `Cancelled IRN for invoice "${eInvoice.invoiceCode}" (${company.name})` });
        closeModal("eiDetailModal");
        renderAll();
        renderActivity();
      }
    });
  }

  function bindDetailModal() {
    $("#eiTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest(".row-detail-btn");
      if (!btn) return;
      const invoice = ERP_TaxInvoiceRepository.findById(btn.dataset.invoiceId);
      if (invoice) openDetailModal(invoice);
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "e-invoice")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Checking applicability…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#eiContent").hidden = true;
      $("#eiSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true;
      $("#eiContent").hidden = false;
      $("#eiSubtitle").textContent = `B2B invoices for ${company.name} (${company.companyCode}).`;
      renderAll();
      renderActivity();
      bindChips();
      bindDetailModal();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
