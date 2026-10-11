/* ==========================================================================
   invoice-generator.js — Tax Invoice / Tax Credit Note generator
   Created By Ananthu Shaji
   ========================================================================== */

(function () {
  "use strict";

  const session = VATSIM.requireSession("../login.html");
  if (!session) return;
  const account = VATSIM.getAccount();
  if (!account) {
    window.location.href = "../index.html";
    return;
  }
  VATSIM.wireChrome();

  document.getElementById("docDate").value = VATSIM.todayISO();

  const relatedFilingSelect = document.getElementById("relatedFiling");
  VATSIM.getFilings()
    .sort((a, b) => new Date(b.period.from) - new Date(a.period.from))
    .forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.period.label + " (" + f.status + ")";
      relatedFilingSelect.appendChild(opt);
    });
  const params = new URLSearchParams(window.location.search);
  if (params.get("filingId")) relatedFilingSelect.value = params.get("filingId");

  const typeRadios = document.querySelectorAll('input[name="docType"]');
  function isCreditNote() {
    return document.querySelector('input[name="docType"]:checked').value === "Tax Credit Note";
  }
  typeRadios.forEach((r) =>
    r.addEventListener("change", () => {
      const cn = isCreditNote();
      document.getElementById("f_relatedInvoice").style.display = cn ? "block" : "none";
      document.getElementById("f_reason").style.display = cn ? "block" : "none";
      renderPreview();
    })
  );

  const watchIds = ["docDate", "supplyDate", "customerName", "customerTrn", "customerAddress", "description", "quantity", "unitPrice", "discountPct", "reverseCharge", "relatedInvoice", "cnReason", "relatedFiling"];
  watchIds.forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", renderPreview);
    el.addEventListener("change", renderPreview);
  });

  function getFormData() {
    return {
      type: isCreditNote() ? "Tax Credit Note" : "Tax Invoice",
      date: document.getElementById("docDate").value || VATSIM.todayISO(),
      supplyDate: document.getElementById("supplyDate").value,
      customerName: document.getElementById("customerName").value.trim(),
      customerTrn: document.getElementById("customerTrn").value.trim(),
      customerAddress: document.getElementById("customerAddress").value.trim(),
      description: document.getElementById("description").value.trim(),
      quantity: document.getElementById("quantity").value,
      unitPrice: document.getElementById("unitPrice").value,
      discountPct: document.getElementById("discountPct").value || "0",
      reverseCharge: document.getElementById("reverseCharge").checked,
      relatedInvoiceNumber: document.getElementById("relatedInvoice").value.trim(),
      reason: document.getElementById("cnReason").value.trim(),
      relatedFilingId: document.getElementById("relatedFiling").value,
    };
  }

  function computeAmounts(data) {
    const qty = VATSIM.n(data.quantity);
    const price = VATSIM.n(data.unitPrice);
    const taxableAmount = VATSIM.round2(qty * price * (1 - VATSIM.n(data.discountPct) / 100));
    const vatAmount = data.reverseCharge ? 0 : VATSIM.round2(taxableAmount * 0.05);
    const total = VATSIM.round2(taxableAmount + vatAmount);
    return { taxableAmount, vatAmount, total };
  }

  function renderPreview() {
    const data = getFormData();
    const amt = computeAmounts(data);
    const previewNumber = "(will be assigned on generation — e.g. " + (data.type === "Tax Credit Note" ? "CN-00001" : "INV-00001") + ")";
    const box = document.getElementById("invoicePreview");
    box.innerHTML =
      '<div style="text-align:center;font-weight:800;font-size:15px;letter-spacing:.5px;color:' + (data.type === "Tax Credit Note" ? "#7a2c22" : "#0c1f38") + '">' + data.type.toUpperCase() + "</div>" +
      '<div style="text-align:center;font-size:10px;color:#8b98a6;margin-bottom:14px">' + previewNumber + "</div>" +
      '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:10px">' +
      '<div><strong>Supplier</strong><br/>' + account.companyName + "<br/>TRN: " + account.trn + "<br/>" + (account.address || "") + "</div>" +
      '<div style="text-align:right"><strong>Customer</strong><br/>' + (data.customerName || "—") + (data.customerTrn ? "<br/>TRN: " + data.customerTrn : "") + (data.customerAddress ? "<br/>" + data.customerAddress : "") + "</div>" +
      "</div>" +
      '<div style="font-size:11px;margin-bottom:10px">Date: ' + VATSIM.fmtDate(data.date) + (data.supplyDate ? " · Supply Date: " + VATSIM.fmtDate(data.supplyDate) : "") +
      (data.type === "Tax Credit Note" && data.relatedInvoiceNumber ? "<br/>Relates to Invoice: " + data.relatedInvoiceNumber : "") + "</div>" +
      '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px"><thead><tr style="border-bottom:1px solid #ccc"><th style="text-align:left;padding:4px 0">Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th></tr></thead>' +
      '<tbody><tr><td style="padding:4px 0">' + (data.description || "—") + "</td><td style=\"text-align:right\">" + (data.quantity || "0") + '</td><td style="text-align:right">' + VATSIM.fmtAED(VATSIM.n(data.unitPrice)) + '</td><td style="text-align:right">' + VATSIM.fmtAED(amt.taxableAmount) + "</td></tr></tbody></table>" +
      '<div style="text-align:right;font-size:11px;line-height:1.8">' +
      "Taxable Amount: AED " + VATSIM.fmtAED(amt.taxableAmount) + "<br/>" +
      (data.reverseCharge ? "VAT: Reverse charge — recipient to self-account for VAT<br/>" : "VAT (5%): AED " + VATSIM.fmtAED(amt.vatAmount) + "<br/>") +
      '<strong style="font-size:13px">Total: AED ' + VATSIM.fmtAED(amt.total) + "</strong></div>";

    document.getElementById("btnDownloadPdf").disabled = true;
  }
  renderPreview();

  let lastGenerated = null;

  document.getElementById("btnGenerate").addEventListener("click", () => {
    const data = getFormData();
    let ok = true;
    function markInvalid(fieldId, invalid) {
      document.getElementById(fieldId).classList.toggle("invalid", invalid);
      if (invalid) ok = false;
    }
    markInvalid("f_customerName", !data.customerName);
    markInvalid("f_description", !data.description);
    markInvalid("f_quantity", VATSIM.n(data.quantity) <= 0);
    markInvalid("f_unitPrice", VATSIM.n(data.unitPrice) <= 0);
    if (data.type === "Tax Credit Note") markInvalid("f_relatedInvoice", !data.relatedInvoiceNumber);

    if (!ok) {
      VATSIM.toast("Please complete all required fields.", "error");
      return;
    }

    lastGenerated = VATSIM.addInvoice(account, data);
    VATSIM.toast(lastGenerated.type + " " + lastGenerated.invoiceNumber + " generated.", "success");
    renderHistory();
    document.getElementById("btnDownloadPdf").disabled = false;

    // Repaint preview with the real assigned number
    const box = document.getElementById("invoicePreview");
    box.querySelector("div:nth-child(2)").textContent = lastGenerated.invoiceNumber;
  });

  document.getElementById("btnDownloadPdf").addEventListener("click", () => {
    if (!lastGenerated) return;
    downloadInvoicePdf(lastGenerated);
  });

  function downloadInvoicePdf(inv) {
    if (!window.jspdf) {
      VATSIM.toast("PDF library did not load — check your internet connection and try again.", "error");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 16;
    let y = 20;

    const isCN = inv.type === "Tax Credit Note";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(isCN ? 122 : 12, isCN ? 44 : 31, isCN ? 34 : 56);
    doc.text(inv.type.toUpperCase(), pageW / 2, y, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(inv.invoiceNumber, pageW / 2, y, { align: "center" });
    y += 12;

    doc.setDrawColor(224, 228, 233);
    doc.line(marginX, y, pageW - marginX, y);
    y += 8;

    doc.setFontSize(9.5);
    doc.setTextColor(30, 42, 56);
    doc.setFont("helvetica", "bold");
    doc.text("Supplier", marginX, y);
    doc.text("Customer", pageW - marginX - 70, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const supplierLines = [inv.supplierName, "TRN: " + inv.supplierTrn, inv.supplierAddress || ""];
    const customerLines = [inv.customerName, inv.customerTrn ? "TRN: " + inv.customerTrn : "", inv.customerAddress || ""];
    let sy = y, cy = y;
    supplierLines.filter(Boolean).forEach((l) => { doc.text(l, marginX, sy); sy += 4.5; });
    customerLines.filter(Boolean).forEach((l) => { doc.text(l, pageW - marginX - 70, cy); cy += 4.5; });
    y = Math.max(sy, cy) + 6;

    doc.setFont("helvetica", "normal");
    doc.text("Invoice Date: " + VATSIM.fmtDate(inv.date), marginX, y);
    doc.text("Date of Supply: " + VATSIM.fmtDate(inv.supplyDate), marginX + 70, y);
    y += 5;
    if (isCN && inv.relatedInvoiceNumber) {
      doc.text("Relates to Invoice: " + inv.relatedInvoiceNumber + (inv.reason ? " — " + inv.reason : ""), marginX, y);
      y += 5;
    }
    if (inv.relatedFilingId) {
      const f = VATSIM.getFiling(inv.relatedFilingId);
      if (f) {
        doc.text("Supports VAT Return Period: " + f.period.label, marginX, y);
        y += 5;
      }
    }
    y += 4;

    doc.setFillColor(246, 248, 250);
    doc.rect(marginX, y - 4.5, pageW - marginX * 2, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Description", marginX + 2, y);
    doc.text("Qty", marginX + 100, y, { align: "right" });
    doc.text("Unit Price", marginX + 130, y, { align: "right" });
    doc.text("Amount (AED)", pageW - marginX - 2, y, { align: "right" });
    y += 9;
    doc.setFont("helvetica", "normal");
    doc.text(String(inv.description), marginX + 2, y);
    doc.text(String(inv.quantity), marginX + 100, y, { align: "right" });
    doc.text(VATSIM.fmtAED(inv.unitPrice), marginX + 130, y, { align: "right" });
    doc.text(VATSIM.fmtAED(inv.taxableAmount), pageW - marginX - 2, y, { align: "right" });
    y += 12;

    doc.setDrawColor(224, 228, 233);
    doc.line(marginX + 90, y, pageW - marginX, y);
    y += 6;
    doc.text("Taxable Amount", marginX + 90, y);
    doc.text("AED " + VATSIM.fmtAED(inv.taxableAmount), pageW - marginX - 2, y, { align: "right" });
    y += 6;
    if (inv.reverseCharge) {
      doc.text("VAT", marginX + 90, y);
      doc.text("Reverse charge — recipient self-accounts", pageW - marginX - 2, y, { align: "right" });
    } else {
      doc.text("VAT (5%)", marginX + 90, y);
      doc.text("AED " + VATSIM.fmtAED(inv.vatAmount), pageW - marginX - 2, y, { align: "right" });
    }
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Total " + (isCN ? "Credited" : "Payable"), marginX + 90, y);
    doc.text("AED " + VATSIM.fmtAED(inv.total), pageW - marginX - 2, y, { align: "right" });
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(139, 152, 166);
    const disclaimer = doc.splitTextToSize(
      "This is a simulated document generated by the UAE VAT Simulator (Training Edition, Created By Ananthu Shaji) for educational purposes only. It is not a legally valid tax invoice or credit note and carries no fiscal effect.",
      pageW - marginX * 2
    );
    doc.text(disclaimer, marginX, y);

    doc.save(inv.invoiceNumber + "_" + inv.customerName.replace(/[^a-z0-9]/gi, "_") + ".pdf");
    VATSIM.toast("Document PDF downloaded.", "success");
  }

  function renderHistory() {
    const list = VATSIM.getInvoices();
    const body = document.getElementById("invoiceHistoryBody");
    body.innerHTML = list.length
      ? list
          .map(
            (inv) =>
              "<tr><td>" + inv.invoiceNumber + "</td><td>" + inv.type + "</td><td>" + VATSIM.fmtDate(inv.date) + "</td><td>" + inv.customerName +
              "</td><td>AED " + VATSIM.fmtAED(inv.taxableAmount) + "</td><td>AED " + VATSIM.fmtAED(inv.vatAmount) + "</td><td>AED " + VATSIM.fmtAED(inv.total) + "</td>" +
              '<td><button class="btn btn-outline btn-sm" data-dl="' + inv.id + '">⬇ PDF</button></td></tr>'
          )
          .join("")
      : '<tr><td colspan="8" style="text-align:center;color:var(--text-faint);padding:24px">No documents generated yet.</td></tr>';
    body.querySelectorAll("[data-dl]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const inv = list.find((i) => i.id === btn.getAttribute("data-dl"));
        if (inv) downloadInvoicePdf(inv);
      });
    });
  }
  renderHistory();
})();
