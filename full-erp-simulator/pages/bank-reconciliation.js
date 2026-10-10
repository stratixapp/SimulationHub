/* =============================================================================
   DOT ERP — pages/bank-reconciliation.js
   Phase 6, Module 07: Bank Reconciliation

   THE FIRST PHASE 6 MODULE WITH A REAL WORKING VIEW, NOT JUST A LIST +
   DETAIL MODAL. Every Cleared checkbox and every adjustment add/remove
   saves to the repository IMMEDIATELY (via `ERP_BankReconciliationRepository
   .update()`) and re-renders the summary live — there's no separate "Save"
   step for the worksheet itself, because a reconciliation-in-progress is
   exactly that: a Draft the trainee is actively working through, and
   losing a dozen checkbox toggles because a browser tab closed would be a
   real, avoidable annoyance a batch-save design would risk. This mirrors
   how Chart of Accounts' own toggleStatus() or Journal Entry's own
   post()/cancel() commit immediately rather than waiting for a form
   submit — just applied to many small toggles in one screen instead of
   one big action.
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, formatDateTime, formatCurrency,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity
  } = window.ERP;

  const PAGE_SIZE = 8;

  let session = null;
  let company = null;
  let filterBank = "all";
  let filterStatus = "all";
  let page = 1;
  let worksheetId = null; // the reconciliation currently open in the worksheet modal


  /* -----------------------------------------------------------------------
     FILTER / SUMMARY
     --------------------------------------------------------------------- */
  function getFilteredList() {
    let rows = ERP_BankReconciliationRepository.getAllForCompany(company.id);
    if (filterBank !== "all") rows = rows.filter((r) => r.bankId === filterBank);
    if (filterStatus !== "all") rows = rows.filter((r) => r.status === filterStatus);
    return rows;
  }

  function renderSummary() {
    const all = ERP_BankReconciliationRepository.getAllForCompany(company.id);
    const draft = all.filter((r) => r.status === "Draft");
    const reconciled = all.filter((r) => r.status === "Reconciled");
    const withDiscrepancy = reconciled.filter((r) => {
      const s = ERP_BankReconciliationRepository.computeSummary(company.id, r);
      return !s.isReconciled;
    });

    $("#brcSummaryTotal").textContent = String(all.length);
    $("#brcSummaryDraft").textContent = String(draft.length);
    $("#brcSummaryReconciled").textContent = String(reconciled.length);
    $("#brcSummaryDiscrepancy").textContent = String(withDiscrepancy.length);
  }


  /* -----------------------------------------------------------------------
     MASTER LIST TABLE
     --------------------------------------------------------------------- */
  function renderPagination(totalPages) {
    const container = $("#brcPagination");
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

  function bankLabel(bankId) {
    const bank = ERP_BankRepository.findById(bankId);
    return bank ? ERP_BankRepository.maskedLabel(bank) : `<span class="profile-subtle">— bank removed —</span>`;
  }

  function renderTable() {
    const all = getFilteredList();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    $("#brcEmptyState").hidden = all.length !== 0;
    $("#brcTable").hidden = all.length === 0;

    $("#brcTableBody").innerHTML = pageItems.map((r) => {
      const s = ERP_BankReconciliationRepository.computeSummary(company.id, r);
      const diffClass = s.isReconciled ? "je-balance-ok" : "je-balance-off";
      const statusBadge = r.status === "Reconciled"
        ? `<span class="status-badge status-badge--${s.isReconciled ? "success" : "warning"}">${r.status}</span>`
        : `<span class="status-badge status-badge--neutral">${r.status}</span>`;

      return `
      <tr>
        <td>${bankLabel(r.bankId)}</td>
        <td>${escapeHtml(r.statementDate)}</td>
        <td class="text-right">${formatCurrency(s.statementBalance)}</td>
        <td class="text-right">${formatCurrency(s.bookBalance)}</td>
        <td class="text-right"><span class="${diffClass}">${formatCurrency(Math.abs(s.difference))}</span></td>
        <td>${statusBadge}</td>
        <td><button type="button" class="row-detail-btn" data-id="${r.id}">${r.status === "Draft" ? "Continue" : "View"}</button></td>
      </tr>`;
    }).join("");

    renderPagination(totalPages);
  }

  function renderAll() {
    renderSummary();
    renderTable();
  }


  /* -----------------------------------------------------------------------
     TOOLBAR
     --------------------------------------------------------------------- */
  function populateBankFilter() {
    const banks = ERP_BankRepository.getAllForCompany(company.id);
    $("#brcBankFilter").innerHTML = `<option value="all">All Banks</option>` +
      banks.map((b) => `<option value="${b.id}">${escapeHtml(ERP_BankRepository.maskedLabel(b))}</option>`).join("");
  }

  function bindToolbar() {
    $("#brcBankFilter").addEventListener("change", (e) => {
      filterBank = e.target.value;
      page = 1;
      renderTable();
    });

    $$("#brcStatusChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#brcStatusChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        filterStatus = chip.dataset.status;
        page = 1;
        renderTable();
      });
    });

    $("#brcTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest(".row-detail-btn");
      if (!btn) return;
      const recon = ERP_BankReconciliationRepository.findById(btn.dataset.id);
      if (recon) openWorksheet(recon.id);
    });
  }


  /* -----------------------------------------------------------------------
     NEW RECONCILIATION FORM
     --------------------------------------------------------------------- */
  function populateFormBankOptions() {
    const banks = ERP_BankRepository.getActiveForCompany(company.id);
    $("#brcFormBank").innerHTML = `<option value="">Select bank account…</option>` +
      banks.map((b) => `<option value="${b.id}">${escapeHtml(ERP_BankRepository.maskedLabel(b))}</option>`).join("");
  }

  function openAddModal() {
    populateFormBankOptions();
    $("#brcFormDate").value = new Date().toISOString().slice(0, 10);
    $("#brcFormBalance").value = "";
    $("#brcFormBankError").textContent = "";
    openModal("brcFormModal");
  }

  function bindFormModal() {
    $("#brcAddBtn").addEventListener("click", openAddModal);

    $("#brcFormSaveBtn").addEventListener("click", () => {
      const bankId = $("#brcFormBank").value;
      if (!bankId) { $("#brcFormBankError").textContent = "Select which bank account this statement is for."; return; }

      const payload = {
        bankId,
        statementDate: $("#brcFormDate").value || new Date().toISOString().slice(0, 10),
        statementBalance: parseFloat($("#brcFormBalance").value) || 0
      };
      const created = ERP_BankReconciliationRepository.create(company, payload, session.username);
      logSystemActivity({ module: "Bank Reconciliation", action: "Create", description: `Started reconciliation for ${ERP_BankRepository.maskedLabel(ERP_BankRepository.findById(bankId))} for ${company.name}` });
      closeModal("brcFormModal");
      renderAll();
      openWorksheet(created.id);
    });
  }


  /* -----------------------------------------------------------------------
     WORKSHEET — live-saving checkboxes, live-recomputing summary
     --------------------------------------------------------------------- */
  function refreshWorksheetSummary() {
    const recon = ERP_BankReconciliationRepository.findById(worksheetId);
    const s = ERP_BankReconciliationRepository.computeSummary(company.id, recon);

    $("#brcWorkBookBalance").textContent = formatCurrency(s.bookBalance);
    $("#brcWorkAdjustedBalance").textContent = formatCurrency(s.adjustedBankBalance);
    const diffEl = $("#brcWorkDifference");
    diffEl.textContent = formatCurrency(Math.abs(s.difference));
    diffEl.style.color = s.isReconciled ? "var(--color-success)" : "var(--color-danger)";

    return { recon, s };
  }

  function renderTransactionRows(tbodyId, emptyId, items, dateField, amountField, refField, clearedIds, isReadOnly) {
    $(`#${emptyId}`).hidden = items.length !== 0;
    $(`#${tbodyId}`).innerHTML = items.map((item) => {
      const isCleared = clearedIds.includes(item.id);
      const checkbox = isReadOnly
        ? `<span class="status-badge status-badge--${isCleared ? "success" : "neutral"}">${isCleared ? "✓" : "—"}</span>`
        : `<input type="checkbox" class="brc-cleared-toggle" data-id="${item.id}" ${isCleared ? "checked" : ""} />`;
      return `
        <tr>
          <td>${checkbox}</td>
          <td>${escapeHtml(item[dateField] || "—")}</td>
          <td>${escapeHtml(item[refField] || "—")}</td>
          <td class="text-right">${formatCurrency(item[amountField] || 0)}</td>
        </tr>`;
    }).join("");
  }

  function renderAdjustments(recon, isReadOnly) {
    const adjustments = recon.adjustments || [];
    $("#brcAdjustmentsEmptyState").hidden = adjustments.length !== 0;
    $("#brcAdjustmentsTableBody").innerHTML = adjustments.map((a) => `
      <tr>
        <td>${escapeHtml(a.description)}</td>
        <td>${escapeHtml(a.type)}</td>
        <td class="text-right">${formatCurrency(a.amount)}</td>
        <td>${isReadOnly ? "" : `<button type="button" class="link-btn brc-remove-adjustment" data-id="${a.id}">Remove</button>`}</td>
      </tr>
    `).join("");
    $("#brcAddAdjustmentBtn").hidden = isReadOnly;
  }

  function renderWorksheetFooter(recon) {
    const footer = $("#brcWorksheetFooter");
    footer.innerHTML = "";
    if (recon.status !== "Draft") return;

    const addBtn = (label, cls, handler) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener("click", handler);
      footer.appendChild(btn);
    };
    addBtn("Delete", "btn btn--danger-outline", () => requestDeleteFromWorksheet(recon));
    addBtn("Mark Reconciled", "btn btn--primary", () => requestMarkReconciled(recon));
  }

  function openWorksheet(id) {
    worksheetId = id;
    const recon = ERP_BankReconciliationRepository.findById(id);
    const bank = ERP_BankRepository.findById(recon.bankId);
    const isReadOnly = recon.status !== "Draft";

    $("#brcWorksheetTitle").textContent = `${bank ? ERP_BankRepository.maskedLabel(bank) : "Bank account"} · ${recon.statementDate}`;
    $("#brcWorksheetSubtitle").textContent = isReadOnly
      ? `Reconciled ${formatDateTime(new Date(recon.reconciledAt))} by ${escapeHtml(recon.reconciledByUsername || "")} — this record is permanent.`
      : "Mark each item Cleared as you confirm it against the real statement. Every change saves immediately.";

    $("#brcWorkStatementBalance").value = recon.statementBalance;
    $("#brcWorkStatementBalance").disabled = isReadOnly;

    const { s } = refreshWorksheetSummary();
    renderTransactionRows("brcReceiptsTableBody", "brcReceiptsEmptyState", s.receipts, "receivedDate", "amountReceived", "receiptCode", recon.clearedReceiptIds || [], isReadOnly);
    renderTransactionRows("brcPaymentsTableBody", "brcPaymentsEmptyState", s.payments, "paymentDate", "amountPaid", "paymentCode", recon.clearedPaymentIds || [], isReadOnly);
    renderAdjustments(recon, isReadOnly);
    renderWorksheetFooter(recon);

    openModal("brcWorksheetModal");
  }

  function requestDeleteFromWorksheet(recon) {
    openConfirm({
      title: "Delete this reconciliation?",
      message: "This Draft will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete",
      onConfirm: () => {
        ERP_BankReconciliationRepository.remove(recon.id);
        logSystemActivity({ module: "Bank Reconciliation", action: "Delete", description: `Deleted a Draft reconciliation for ${company.name}`, severity: "warning" });
        closeModal("brcWorksheetModal");
        renderAll();
        showToast("Reconciliation deleted.", "info");
      }
    });
  }

  function requestMarkReconciled(recon) {
    const s = ERP_BankReconciliationRepository.computeSummary(company.id, recon);
    const message = s.isReconciled
      ? "Book Balance and Adjusted Bank Balance match exactly. This reconciliation will be marked complete and can no longer be edited."
      : `This does NOT balance — a difference of ${formatCurrency(Math.abs(s.difference))} remains. You can still close it out and follow up later, but it will be flagged and can no longer be edited afterward.`;

    openConfirm({
      title: "Mark this reconciliation complete?",
      message,
      confirmLabel: "Mark Reconciled",
      onConfirm: () => {
        ERP_BankReconciliationRepository.markReconciled(recon.id, session.username);
        logSystemActivity({ module: "Bank Reconciliation", action: "Reconcile", description: `Closed reconciliation for ${ERP_BankRepository.maskedLabel(ERP_BankRepository.findById(recon.bankId))} for ${company.name}${s.isReconciled ? "" : " (with an unresolved difference)"}`, severity: s.isReconciled ? "info" : "warning" });
        renderAll();
        openWorksheet(recon.id);
        showToast(s.isReconciled ? "Reconciliation complete." : "Reconciliation closed with a flagged difference.", s.isReconciled ? "success" : "warning");
      }
    });
  }

  function bindWorksheet() {
    $("#brcWorkStatementBalance").addEventListener("change", (e) => {
      ERP_BankReconciliationRepository.update(worksheetId, { statementBalance: parseFloat(e.target.value) || 0 });
      refreshWorksheetSummary();
    });

    $("#brcReceiptsTableBody").addEventListener("change", (e) => {
      if (!e.target.classList.contains("brc-cleared-toggle")) return;
      const recon = ERP_BankReconciliationRepository.findById(worksheetId);
      const ids = new Set(recon.clearedReceiptIds || []);
      e.target.checked ? ids.add(e.target.dataset.id) : ids.delete(e.target.dataset.id);
      ERP_BankReconciliationRepository.update(worksheetId, { clearedReceiptIds: [...ids] });
      refreshWorksheetSummary();
    });

    $("#brcPaymentsTableBody").addEventListener("change", (e) => {
      if (!e.target.classList.contains("brc-cleared-toggle")) return;
      const recon = ERP_BankReconciliationRepository.findById(worksheetId);
      const ids = new Set(recon.clearedPaymentIds || []);
      e.target.checked ? ids.add(e.target.dataset.id) : ids.delete(e.target.dataset.id);
      ERP_BankReconciliationRepository.update(worksheetId, { clearedPaymentIds: [...ids] });
      refreshWorksheetSummary();
    });

    $("#brcAdjustmentsTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest(".brc-remove-adjustment");
      if (!btn) return;
      const recon = ERP_BankReconciliationRepository.findById(worksheetId);
      const adjustments = (recon.adjustments || []).filter((a) => a.id !== btn.dataset.id);
      ERP_BankReconciliationRepository.update(worksheetId, { adjustments });
      const { s } = refreshWorksheetSummary();
      renderAdjustments(ERP_BankReconciliationRepository.findById(worksheetId), false);
    });

    $("#brcAddAdjustmentBtn").addEventListener("click", () => {
      $("#brcAdjFormDescription").value = "";
      $("#brcAdjFormType").value = "Charge";
      $("#brcAdjFormAmount").value = "";
      $("#brcAdjFormDescriptionError").textContent = "";
      $("#brcAdjFormAmountError").textContent = "";
      openModal("brcAdjustmentModal");
    });

    $("#brcAdjFormSaveBtn").addEventListener("click", () => {
      const description = $("#brcAdjFormDescription").value.trim();
      const amount = parseFloat($("#brcAdjFormAmount").value);
      let valid = true;
      if (!description) { $("#brcAdjFormDescriptionError").textContent = "Description is required."; valid = false; }
      if (!amount || amount <= 0) { $("#brcAdjFormAmountError").textContent = "Enter an amount greater than zero."; valid = false; }
      if (!valid) return;

      const recon = ERP_BankReconciliationRepository.findById(worksheetId);
      const adjustment = { id: "ADJ-" + Date.now().toString(36).toUpperCase(), description, type: $("#brcAdjFormType").value, amount };
      const adjustments = [...(recon.adjustments || []), adjustment];
      ERP_BankReconciliationRepository.update(worksheetId, { adjustments });
      closeModal("brcAdjustmentModal");
      refreshWorksheetSummary();
      renderAdjustments(ERP_BankReconciliationRepository.findById(worksheetId), false);
      showToast("Adjustment added.", "success");
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "bank-reconciliation")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading bank reconciliations…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#brcContent").hidden = true;
      $("#brcSubtitle").textContent = "No active company yet.";
    } else if (ERP_BankRepository.getAllForCompany(company.id).length === 0) {
      $("#noBanksState").hidden = false;
      $("#brcContent").hidden = true;
      $("#brcSubtitle").textContent = `No bank accounts on file for ${company.name}.`;
    } else {
      $("#noCompanyState").hidden = true;
      $("#noBanksState").hidden = true;
      $("#brcContent").hidden = false;
      $("#brcHeaderActions").hidden = false;
      $("#brcSubtitle").textContent = `Reconciliations for ${company.name} (${company.companyCode}).`;
      populateBankFilter();
      renderAll();
      bindToolbar();
      bindFormModal();
      bindWorksheet();
    }

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
