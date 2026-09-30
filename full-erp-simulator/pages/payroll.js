/* =============================================================================
   DOT ERP — pages/payroll.js
   Phase 9, Module 04: Payroll Processing / Payslip Generation
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, escapeHtml, requireSession, runBootSequence, showToast,
    openModal, closeModal, openConfirm, logSystemActivity, actorLabel
  } = window.ERP;

  let session = null;
  let company = null;
  let selectedYear = null;
  let selectedMonth = null; // 1-indexed
  let currentRun = null; // the run for the selected period, or null

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const RUN_STATUS_TONE = { Draft: "warning", Processed: "info", Paid: "success", Cancelled: "neutral" };

  function formatMoney(n) { return "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

  function employeeName(id) {
    const e = ERP_EmployeeRepository.findById(id);
    return e ? e.fullName : "Removed employee";
  }

  function periodLabel(year, month) { return `${MONTH_NAMES[month - 1]} ${year}`; }

  function runTotals(run) {
    return run.payslipLines.reduce((acc, l) => {
      acc.gross += l.grossEarnings;
      acc.deductions += l.totalDeductions;
      acc.net += l.netPay;
      return acc;
    }, { gross: 0, deductions: 0, net: 0 });
  }

  /* -----------------------------------------------------------------------
     PERIOD PICKER
     --------------------------------------------------------------------- */
  function populatePeriodSelects() {
    $("#pyrMonthSelect").innerHTML = MONTH_NAMES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [];
    for (let y = currentYear - 2; y <= currentYear + 1; y++) years.push(y);
    $("#pyrYearSelect").innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
    selectedMonth = now.getMonth() + 1;
    selectedYear = currentYear;
    $("#pyrMonthSelect").value = String(selectedMonth);
    $("#pyrYearSelect").value = String(selectedYear);
  }

  /* -----------------------------------------------------------------------
     RUN DETAIL
     --------------------------------------------------------------------- */
  function loadCurrentRun() {
    currentRun = ERP_PayrollRepository.findActiveRunForPeriod(company.id, selectedYear, selectedMonth);
    renderRunDetail();
    renderRunsTable();
  }

  function renderRunDetail() {
    $("#pyrPeriodNote").textContent = `Currently viewing ${periodLabel(selectedYear, selectedMonth)}.`;

    if (!currentRun) {
      $("#pyrNoRunState").hidden = false;
      $("#pyrRunDetail").hidden = true;
      $("#pyrGenerateBtn").textContent = "Generate Payroll";
      return;
    }

    $("#pyrNoRunState").hidden = true;
    $("#pyrRunDetail").hidden = false;
    $("#pyrGenerateBtn").textContent = currentRun.status === "Draft" ? "Regenerate" : "Generate Payroll";

    $("#pyrRunPeriodLabel").textContent = periodLabel(currentRun.periodYear, currentRun.periodMonth);
    $("#pyrRunStatusBadge").className = `status-badge status-badge--${RUN_STATUS_TONE[currentRun.status] || "neutral"}`;
    $("#pyrRunStatusBadge").textContent = currentRun.status;

    // Action buttons visible per status
    $("#pyrRegenerateBtn").hidden = currentRun.status !== "Draft";
    $("#pyrProcessBtn").hidden = currentRun.status !== "Draft";
    $("#pyrMarkPaidBtn").hidden = currentRun.status !== "Processed";
    $("#pyrCancelRunBtn").hidden = !(currentRun.status === "Draft" || currentRun.status === "Processed");

    if (currentRun.skippedEmployees.length) {
      $("#pyrSkippedNote").hidden = false;
      $("#pyrSkippedNote").textContent = `${currentRun.skippedEmployees.length} employee(s) skipped — no salary structure effective for this period: ${currentRun.skippedEmployees.map((s) => employeeName(s.employeeId)).join(", ")}.`;
    } else {
      $("#pyrSkippedNote").hidden = true;
    }

    const totals = runTotals(currentRun);
    $("#pyrSummaryCount").textContent = String(currentRun.payslipLines.length);
    $("#pyrSummaryGross").textContent = formatMoney(totals.gross);
    $("#pyrSummaryDeductions").textContent = formatMoney(totals.deductions);
    $("#pyrSummaryNet").textContent = formatMoney(totals.net);

    $("#pyrLinesTableBody").innerHTML = currentRun.payslipLines.map((l) => `
      <tr>
        <td>${escapeHtml(employeeName(l.employeeId))}</td>
        <td class="text-right">${l.payableDays} / ${l.daysInMonth}</td>
        <td class="text-right">${l.lopDays}</td>
        <td class="text-right">${formatMoney(l.grossEarnings)}</td>
        <td class="text-right">${formatMoney(l.totalDeductions)}</td>
        <td class="text-right"><strong>${formatMoney(l.netPay)}</strong></td>
        <td class="text-right"><button type="button" class="btn btn--ghost btn--sm" data-payslip="${l.employeeId}">View Payslip</button></td>
      </tr>`).join("");

    $$("#pyrLinesTableBody [data-payslip]").forEach((btn) => btn.addEventListener("click", () => openPayslip(btn.dataset.payslip)));
  }

  function renderRunsTable() {
    const runs = ERP_PayrollRepository.getAllForCompany(company.id);
    $("#pyrRunsEmptyState").hidden = runs.length !== 0;
    $("#pyrRunsTable").hidden = runs.length === 0;
    $("#pyrRunsTableBody").innerHTML = runs.map((r) => {
      const totals = runTotals(r);
      return `
      <tr>
        <td>${periodLabel(r.periodYear, r.periodMonth)}</td>
        <td><span class="status-badge status-badge--${RUN_STATUS_TONE[r.status] || "neutral"}">${r.status}</span></td>
        <td class="text-right">${r.payslipLines.length}</td>
        <td class="text-right">${formatMoney(totals.net)}</td>
        <td>${escapeHtml(new Date(r.generatedAt).toLocaleDateString())}</td>
        <td class="text-right"><button type="button" class="btn btn--ghost btn--sm" data-view-period="${r.periodYear}:${r.periodMonth}">View</button></td>
      </tr>`;
    }).join("");

    $$("#pyrRunsTableBody [data-view-period]").forEach((btn) => btn.addEventListener("click", () => {
      const [y, m] = btn.dataset.viewPeriod.split(":").map(Number);
      selectedYear = y; selectedMonth = m;
      $("#pyrYearSelect").value = String(y);
      $("#pyrMonthSelect").value = String(m);
      loadCurrentRun();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }));
  }

  /* -----------------------------------------------------------------------
     ACTIONS
     --------------------------------------------------------------------- */
  function generate() {
    const result = ERP_PayrollRepository.generateRun(company, selectedYear, selectedMonth, actorLabel(session.username));
    if (!result) { showToast("Could not generate — this period already has a Processed or Paid run.", "danger"); return; }
    logSystemActivity({ module: "Payroll", action: currentRun ? "Regenerate" : "Generate", description: `${currentRun ? "Regenerated" : "Generated"} payroll for ${periodLabel(selectedYear, selectedMonth)}, ${result.payslipLines.length} employee(s), for ${company.name}` });
    currentRun = result;
    renderRunDetail();
    renderRunsTable();
    showToast(`Payroll ${result.payslipLines.length === 0 ? "generated (no eligible employees)" : "generated"} for ${periodLabel(selectedYear, selectedMonth)}.`, "success");
  }

  function processRun() {
    if (!currentRun) return;
    openConfirm({
      title: "Process this payroll run?",
      message: `${periodLabel(currentRun.periodYear, currentRun.periodMonth)}'s ${currentRun.payslipLines.length} payslip line(s) will be locked as permanent history. This cannot be regenerated afterward.`,
      confirmLabel: "Process",
      onConfirm: () => {
        const processed = ERP_PayrollRepository.process(currentRun.id, actorLabel(session.username));
        logSystemActivity({ module: "Payroll", action: "Process", description: `Processed payroll for ${periodLabel(currentRun.periodYear, currentRun.periodMonth)} for ${company.name}` });

        // PHASE 9 GL RETROFIT: Dr Salary Expense / Cr PF, Professional
        // Tax, TDS Payable (conditional) / Cr Salary Payable. Never
        // blocks the state transition itself — see
        // gl-posting-data.js's own header for why this can't throw.
        if (typeof ERP_GlPostingRepository !== "undefined") {
          const glResult = ERP_GlPostingRepository.postPayrollProcessing(company, processed, actorLabel(session.username));
          if (glResult.success) {
            showToast(`Payroll run processed and posted to the books (${glResult.entry.entryNumber}).`, "success");
          } else {
            showToast(glResult.reason, "warning");
          }
        } else {
          showToast("Payroll run processed.", "success");
        }

        loadCurrentRun();
      }
    });
  }

  function openMarkPaidModal() {
    if (!currentRun) return;
    const totals = runTotals(currentRun);
    $("#mpSummary").textContent = `${periodLabel(currentRun.periodYear, currentRun.periodMonth)} — total net pay ${formatMoney(totals.net)} across ${currentRun.payslipLines.length} employee(s). This is final and can't be cancelled afterward.`;

    const banks = (typeof ERP_BankRepository !== "undefined") ? ERP_BankRepository.getActiveForCompany(company.id) : [];
    const defaultBank = (typeof ERP_BankRepository !== "undefined") ? ERP_BankRepository.getDefault(company.id) : null;
    $("#mpBankSelect").innerHTML = `<option value="">Not set</option>` +
      banks.map((b) => `<option value="${b.id}">${escapeHtml(ERP_BankRepository.maskedLabel(b))}</option>`).join("");
    $("#mpBankSelect").value = defaultBank ? defaultBank.id : "";
    updateMarkPaidBankNote();

    openModal("markPaidModal");
  }

  function updateMarkPaidBankNote() {
    const bankId = $("#mpBankSelect").value;
    const bank = bankId && typeof ERP_BankRepository !== "undefined" ? ERP_BankRepository.findById(bankId) : null;
    if (!bankId) {
      $("#mpBankNote").textContent = "Choosing a bank account lets this payment post to the books automatically — you can still mark this Paid without one, it just won't post.";
    } else if (bank && !bank.linkedAccountId) {
      $("#mpBankNote").textContent = `"${bank.bankName}" isn't linked to a Ledger account yet, so this still won't post — link one in Bank Master first if you want it to.`;
    } else {
      $("#mpBankNote").textContent = "";
    }
  }

  function confirmMarkPaid() {
    if (!currentRun) return;
    const bankId = $("#mpBankSelect").value || null;

    const paid = ERP_PayrollRepository.markPaid(currentRun.id, actorLabel(session.username));
    logSystemActivity({ module: "Payroll", action: "Mark Paid", description: `Marked payroll for ${periodLabel(currentRun.periodYear, currentRun.periodMonth)} as Paid for ${company.name}` });

    // PHASE 9 GL RETROFIT: Dr Salary Payable / Cr the chosen bank's own
    // linked Ledger account, for the run's total net pay.
    if (typeof ERP_GlPostingRepository !== "undefined") {
      const glResult = ERP_GlPostingRepository.postSalaryPayment(company, paid, bankId, actorLabel(session.username));
      if (glResult.success) {
        showToast(`Payroll marked Paid and posted to the books (${glResult.entry.entryNumber}).`, "success");
      } else {
        showToast(glResult.reason, "warning");
      }
    } else {
      showToast("Payroll run marked Paid.", "success");
    }

    closeModal("markPaidModal");
    loadCurrentRun();
  }

  function cancelRun() {
    if (!currentRun) return;
    openConfirm({
      title: "Cancel this payroll run?",
      message: `${periodLabel(currentRun.periodYear, currentRun.periodMonth)} will be marked Cancelled. A new run can be generated for this period afterward.`,
      confirmLabel: "Cancel Run",
      onConfirm: () => {
        ERP_PayrollRepository.cancel(currentRun.id, actorLabel(session.username));
        logSystemActivity({ module: "Payroll", action: "Cancel", description: `Cancelled payroll run for ${periodLabel(currentRun.periodYear, currentRun.periodMonth)} for ${company.name}`, severity: "warning" });
        loadCurrentRun();
        showToast("Payroll run cancelled.", "info");
      }
    });
  }

  /* -----------------------------------------------------------------------
     PAYSLIP MODAL
     --------------------------------------------------------------------- */
  let currentPayslipView = null; // { run, line, employeeId } for whichever payslip is open — the PDF download reads from this rather than re-querying

  function openPayslip(employeeId) {
    if (!currentRun) return;
    const view = ERP_PayrollRepository.getPayslipView(currentRun.id, employeeId);
    if (!view) return;
    const { run, line } = view;
    currentPayslipView = { run, line, employeeId };

    $("#pslEmployee").textContent = employeeName(employeeId);
    $("#pslPeriod").textContent = periodLabel(run.periodYear, run.periodMonth);
    $("#pslDaysInMonth").textContent = String(line.daysInMonth);
    $("#pslPayableDays").textContent = String(line.payableDays);
    $("#pslLopDays").textContent = String(line.lopDays);

    $("#pslBasic").textContent = formatMoney(line.basic);
    $("#pslHra").textContent = formatMoney(line.hraAmount);
    $("#pslSpecial").textContent = formatMoney(line.specialAllowance);
    $("#pslGross").textContent = formatMoney(line.grossEarnings);

    $("#pslPf").textContent = formatMoney(line.pfAmount);
    $("#pslPt").textContent = formatMoney(line.professionalTax);
    $("#pslTds").textContent = formatMoney(line.tds);
    $("#pslDeductions").textContent = formatMoney(line.totalDeductions);

    $("#pslNetPay").textContent = formatMoney(line.netPay);

    openModal("payslipModal");
  }

  /** Builds a real, downloadable PDF for whichever payslip is currently
      open, using the jsPDF library vendored locally at
      assets/vendor/jspdf.umd.min.js (so this works fully offline, no CDN
      dependency — consistent with this project's own offline-simulator
      framing). Every figure comes straight from the same already-computed
      `line` the on-screen modal itself reads — this is a rendering of
      existing data, not a second computation that could drift from it. */
  /** jsPDF's default "helvetica" font is a standard PDF font with no ₹
      glyph — the on-screen modal and every other export in this project
      can use the real ₹ symbol freely because HTML/CSS render through
      the browser's own system fonts, but a generated PDF embedding only
      the standard 14 PDF fonts genuinely cannot. "Rs." is the real,
      widely-used fallback on actual printed Indian financial documents
      for exactly this reason — not a workaround invented for this
      project. Used only inside PDF generation; every other display of
      money in this module keeps the real ₹ symbol. */
  function formatMoneyPdf(n) { return "Rs. " + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

  function downloadPayslipPdf() {
    if (!currentPayslipView || typeof window.jspdf === "undefined") {
      showToast("PDF generation isn't available right now.", "danger");
      return;
    }
    const { run, line, employeeId } = currentPayslipView;
    const emp = ERP_EmployeeRepository.findById(employeeId);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 48;
    let y = 56;

    // --- Letterhead ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(company.name || "Company", marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    const addressParts = [company.address1, company.address2, company.city, company.state, company.pincode].filter(Boolean);
    if (addressParts.length) { y += 14; doc.text(addressParts.join(", "), marginX, y); }
    if (company.gstin) { y += 13; doc.text(`GSTIN: ${company.gstin}`, marginX, y); }
    doc.setTextColor(0);

    y += 26;
    doc.setDrawColor(210);
    doc.line(marginX, y, pageWidth - marginX, y);

    y += 26;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`Payslip — ${periodLabel(run.periodYear, run.periodMonth)}`, marginX, y);

    // --- Employee + days info ---
    y += 24;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const infoRows = [
      ["Employee", emp ? emp.fullName : "Removed employee"],
      ["Employee Code", emp ? emp.employeeCode : "—"],
      ["Days in Month", String(line.daysInMonth)],
      ["Payable Days", String(line.payableDays)],
      ["LOP Days", String(line.lopDays)]
    ];
    infoRows.forEach(([label, value]) => {
      doc.setTextColor(110);
      doc.text(label, marginX, y);
      doc.setTextColor(0);
      doc.text(String(value), marginX + 130, y);
      y += 16;
    });

    // --- Earnings / Deductions two-column table ---
    y += 14;
    const colGap = 24;
    const colWidth = (pageWidth - marginX * 2 - colGap) / 2;
    const leftX = marginX;
    const rightX = marginX + colWidth + colGap;
    const tableTop = y;

    function drawColumn(x, title, rows, totalLabel, totalValue) {
      let cy = tableTop;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text(title, x, cy);
      cy += 8;
      doc.setDrawColor(220);
      doc.line(x, cy, x + colWidth, cy);
      cy += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      rows.forEach(([label, value]) => {
        doc.setTextColor(90);
        doc.text(label, x, cy);
        doc.setTextColor(0);
        doc.text(formatMoneyPdf(value), x + colWidth, cy, { align: "right" });
        cy += 17;
      });
      cy += 3;
      doc.setDrawColor(220);
      doc.line(x, cy, x + colWidth, cy);
      cy += 16;
      doc.setFont("helvetica", "bold");
      doc.text(totalLabel, x, cy);
      doc.text(formatMoneyPdf(totalValue), x + colWidth, cy, { align: "right" });
      return cy;
    }

    const leftBottom = drawColumn(leftX, "Earnings", [
      ["Basic", line.basic], ["HRA", line.hraAmount], ["Special Allowance", line.specialAllowance]
    ], "Gross Earnings", line.grossEarnings);

    const rightBottom = drawColumn(rightX, "Deductions", [
      ["PF (Employee Contribution)", line.pfAmount], ["Professional Tax", line.professionalTax], ["TDS", line.tds]
    ], "Total Deductions", line.totalDeductions);

    y = Math.max(leftBottom, rightBottom) + 36;

    // --- Net Pay banner ---
    doc.setFillColor(243, 246, 250);
    doc.roundedRect(marginX, y - 20, pageWidth - marginX * 2, 34, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Net Pay", marginX + 14, y + 2);
    doc.text(formatMoneyPdf(line.netPay), pageWidth - marginX - 14, y + 2, { align: "right" });

    // --- Footer ---
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Generated by Dot ERP on ${new Date().toLocaleDateString()}.`,
      marginX, pageHeight - 36
    );

    const employeeFileLabel = (emp ? emp.fullName : "employee").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const periodFileLabel = `${run.periodYear}-${String(run.periodMonth).padStart(2, "0")}`;
    doc.save(`payslip-${employeeFileLabel}-${periodFileLabel}.pdf`);
  }

  /* -----------------------------------------------------------------------
     CSV EXPORT
     --------------------------------------------------------------------- */
  function exportCsv() {
    if (!currentRun || !currentRun.payslipLines.length) { showToast("Nothing to export — no payslip lines for this period.", "warning"); return; }
    const lines = [["Employee", "Days in Month", "Payable Days", "LOP Days", "Basic", "HRA", "Special Allowance", "Gross", "PF", "Professional Tax", "TDS", "Total Deductions", "Net Pay"].join(",")];
    currentRun.payslipLines.forEach((l) => {
      lines.push([
        `"${employeeName(l.employeeId).replace(/"/g, '""')}"`, l.daysInMonth, l.payableDays, l.lopDays,
        l.basic.toFixed(2), l.hraAmount.toFixed(2), l.specialAllowance.toFixed(2), l.grossEarnings.toFixed(2),
        l.pfAmount.toFixed(2), l.professionalTax.toFixed(2), l.tds.toFixed(2), l.totalDeductions.toFixed(2), l.netPay.toFixed(2)
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payroll-${periodLabel(currentRun.periodYear, currentRun.periodMonth).replace(" ", "-")}-${company.companyCode}.csv`;
    link.click();
  }

  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "payroll")) return;

    runBootSequence([
      { p: 30, t: "Loading employees…" },
      { p: 55, t: "Loading attendance and leave records…" },
      { p: 80, t: "Loading salary structures…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    if (!company) {
      $("#noCompanyState").hidden = false;
      $("#pyrContent").hidden = true;
      $("#pyrSubtitle").textContent = "No active company yet.";
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    const hasEmployees = ERP_EmployeeRepository.getAllForCompany(company.id).some((e) => e.status !== "Inactive");
    if (!hasEmployees) {
      $("#noCompanyState").hidden = true;
      $("#noEmployeesState").hidden = false;
      $("#pyrContent").hidden = true;
      $("#pyrSubtitle").textContent = `No employees yet for ${company.name} (${company.companyCode}).`;
      $("#footerYear").textContent = new Date().getFullYear();
      return;
    }

    $("#noCompanyState").hidden = true;
    $("#noEmployeesState").hidden = true;
    $("#pyrContent").hidden = false;
    $("#pyrHeaderActions").hidden = false;
    $("#pyrSubtitle").textContent = `Payroll for ${company.name} (${company.companyCode}).`;

    populatePeriodSelects();

    $("#pyrMonthSelect").addEventListener("change", () => { selectedMonth = Number($("#pyrMonthSelect").value); loadCurrentRun(); });
    $("#pyrYearSelect").addEventListener("change", () => { selectedYear = Number($("#pyrYearSelect").value); loadCurrentRun(); });

    $("#pyrGenerateBtn").addEventListener("click", generate);
    $("#pyrRegenerateBtn").addEventListener("click", generate);
    $("#pyrProcessBtn").addEventListener("click", processRun);
    $("#pyrMarkPaidBtn").addEventListener("click", openMarkPaidModal);
    $("#pyrCancelRunBtn").addEventListener("click", cancelRun);
    $("#mpBankSelect").addEventListener("change", updateMarkPaidBankNote);
    $("#mpConfirmBtn").addEventListener("click", confirmMarkPaid);

    $("#pslPrintBtn").addEventListener("click", () => window.print());
    $("#pslDownloadPdfBtn").addEventListener("click", downloadPayslipPdf);

    $("#pyrExportCsvBtn").addEventListener("click", exportCsv);

    loadCurrentRun();
    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
