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

  const watchIds = ["docDate", "supplyDate", "customerName", "customerTrn", "customerAddress", "description", "quantity", "unitPrice", "discountPct", "reverseCharge", "taxTreatment", "invFormat", "currency", "fxRate", "relatedInvoice", "cnReason", "relatedFiling"];
  watchIds.forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", renderPreview);
    el.addEventListener("change", renderPreview);
  });

  const ROWHTML = '<div class="xl-row" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1.4fr auto;gap:6px;margin:6px 0"><input data-k="description" placeholder="Description" /><input data-k="quantity" type="number" min="0" step="0.01" placeholder="Qty" /><input data-k="unitPrice" type="number" min="0" step="0.01" placeholder="Unit price" /><input data-k="discountPct" type="number" min="0" max="100" step="0.01" placeholder="Disc %" /><select data-k="taxTreatment"><option value="standard">5%</option><option value="zero">0% zero-rated</option><option value="exempt">Exempt</option></select><button type="button" class="btn btn-outline btn-sm" data-rm>×</button></div>';
  const extra = document.getElementById("extraLines");
  document.getElementById("btnAddLine").addEventListener("click", () => { if (extra.children.length >= 5) { VATSIM.toast("Up to 6 lines per invoice.", "error"); return; } extra.insertAdjacentHTML("beforeend", ROWHTML); renderPreview(); });
  extra.addEventListener("input", () => renderPreview()); extra.addEventListener("change", () => renderPreview());
  extra.addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) { b.closest(".xl-row").remove(); renderPreview(); } });

  function getFormData() {
    const d = {
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
      taxTreatment: document.getElementById("taxTreatment").value,
      invFormat: document.getElementById("invFormat").value,
      currency: document.getElementById("currency").value,
      fxRate: document.getElementById("fxRate").value,
      relatedInvoiceNumber: document.getElementById("relatedInvoice").value.trim(),
      reason: document.getElementById("cnReason").value.trim(),
      relatedFilingId: document.getElementById("relatedFiling").value,
    };
    d.lines = [{ description: d.description, quantity: d.quantity, unitPrice: d.unitPrice, discountPct: d.discountPct, taxTreatment: d.taxTreatment }].concat(Array.from(document.querySelectorAll("#extraLines .xl-row")).map((row) => { const g = (k) => row.querySelector('[data-k="' + k + '"]').value; return { description: g("description").trim(), quantity: g("quantity"), unitPrice: g("unitPrice"), discountPct: g("discountPct") || "0", taxTreatment: g("taxTreatment") }; }));
    return d;
  }

  function curOf(d) { return d.currency || "AED"; }
  function fxOf(d) { const r = Number(d.fxRate); return curOf(d) === "AED" || !(r > 0) ? 1 : r; }
  function rateLabel(d) { return d.taxTreatment === "zero" ? "0% zero-rated" : d.taxTreatment === "exempt" ? "exempt" : "5%"; }

  function linesOf(d) { return d.lines && d.lines.length ? d.lines : [{ description: d.description, quantity: d.quantity, unitPrice: d.unitPrice, discountPct: d.discountPct, taxTreatment: d.taxTreatment }]; }
  function vatLabel(d) { const t = Array.from(new Set(linesOf(d).map((l) => l.taxTreatment || "standard"))); return t.length > 1 ? "mixed rates" : rateLabel({ taxTreatment: t[0] }); }
  function computeAmounts(data) {
    let taxableAmount = 0, vatAmount = 0;
    const rows = linesOf(data).map((l) => {
      const tx = VATSIM.round2(VATSIM.n(l.quantity) * VATSIM.n(l.unitPrice) * (1 - VATSIM.n(l.discountPct) / 100)), t = l.taxTreatment || "standard";
      const v = data.reverseCharge || t === "zero" || t === "exempt" ? 0 : VATSIM.round2(tx * 0.05);
      taxableAmount += tx; vatAmount += v; return { l: l, tx: tx, v: v, t: t };
    });
    taxableAmount = VATSIM.round2(taxableAmount); vatAmount = VATSIM.round2(vatAmount);
    return { taxableAmount, vatAmount, total: VATSIM.round2(taxableAmount + vatAmount), rows };
  }
  function previewRows(data, amt) {
    const multi = amt.rows.length > 1;
    return amt.rows.map((x) => '<tr><td style="padding:4px 0">' + (x.l.description || "—") + (multi || x.t !== "standard" ? " [" + rateLabel({ taxTreatment: x.t }) + "]" : "") + '</td><td style="text-align:right">' + (x.l.quantity || "0") + '</td><td style="text-align:right">' + VATSIM.fmtAED(VATSIM.n(x.l.unitPrice)) + '</td><td style="text-align:right">' + VATSIM.fmtAED(x.tx) + "</td></tr>").join("");
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
      '<tbody>' + previewRows(data, amt) + "</tbody></table>" +
      '<div style="text-align:right;font-size:11px;line-height:1.8">' +
      "Taxable Amount: " + curOf(data) + " " + VATSIM.fmtAED(amt.taxableAmount) + "<br/>" +
      (data.reverseCharge ? "VAT: Reverse charge — recipient to self-account for VAT<br/>" : "VAT (" + vatLabel(data) + "): " + curOf(data) + " " + VATSIM.fmtAED(amt.vatAmount) + "<br/>" + (curOf(data) !== "AED" && amt.vatAmount ? "VAT in AED: " + VATSIM.fmtAED(VATSIM.round2(amt.vatAmount * fxOf(data))) + " (rate 1 " + curOf(data) + " = " + fxOf(data) + " AED)<br/>" : "")) +
      '<strong style="font-size:13px">Total: ' + curOf(data) + ' ' + VATSIM.fmtAED(amt.total) + "</strong></div>";

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

    const badLine = linesOf(data).slice(1).findIndex((l) => !l.description || VATSIM.n(l.quantity) <= 0 || VATSIM.n(l.unitPrice) <= 0);
    if (badLine >= 0) { VATSIM.toast("Complete line " + (badLine + 2) + " (description, quantity and unit price).", "error"); return; }
    const chk = computeAmounts(data);
    let ruleMsg = "";
    if (data.customerTrn && !/^\d{15}$/.test(data.customerTrn)) ruleMsg = "Customer TRN must be exactly 15 digits.";
    else if (data.reverseCharge && linesOf(data).some((l) => l.taxTreatment !== "standard")) ruleMsg = "Reverse charge applies only to standard-rated (5%) supplies.";
    else if (data.invFormat === "simplified" && data.customerTrn && chk.total * fxOf(data) > 10000) ruleMsg = "A simplified tax invoice to a VAT-registered customer is allowed only up to AED 10,000 - issue a full tax invoice (FTA VATP006).";
    if (!ruleMsg && curOf(data) !== "AED" && !(Number(data.fxRate) > 0)) ruleMsg = "Enter the UAE Central Bank exchange rate used (AED per 1 unit). The VAT must also be shown in AED (FTA VATP006).";
    if (!ruleMsg && data.type === "Tax Credit Note" && !data.reason) ruleMsg = "A tax credit note must give a brief explanation of why it is issued (Art. 60(1)).";
    if (!ruleMsg && data.type === "Tax Credit Note" && data.customerTrn && !data.customerAddress) ruleMsg = "A tax credit note to a VAT-registered customer must show the customer's name, address and TRN (Art. 60(1)).";
    if (!ruleMsg && data.type === "Tax Invoice" && data.invFormat === "full" && data.customerTrn && !data.customerAddress) ruleMsg = "A full tax invoice to a VAT-registered customer must show the customer's address (Art. 59(1)).";
    if (!ruleMsg && data.reverseCharge && data.invFormat === "simplified") ruleMsg = "A simplified tax invoice cannot be used where the reverse charge applies - issue a full tax invoice (amended Art. 59(5); FTA VATP040).";
    if (!ruleMsg && data.type === "Tax Invoice" && data.supplyDate && data.date) {
      const days = Math.round((new Date(data.date) - new Date(data.supplyDate)) / 86400000);
      if (data.invFormat === "summary") {
        const sd = new Date(data.supplyDate), eom = new Date(Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth() + 1, 0));
        if (Math.round((new Date(data.date) - eom) / 86400000) > 14) ruleMsg = "A summary tax invoice must be issued within 14 days of the end of the calendar month of supply (Art. 59 as amended 2024).";
      } else if (days > 14) ruleMsg = "A tax invoice must be issued within 14 days of the date of supply (Decree-Law Art. 67).";
      else if (data.invFormat === "simplified" && days !== 0) ruleMsg = "A simplified tax invoice must be issued on the date of supply (Art. 59 as amended by Cabinet Decision 100 of 2024).";
    }
    if (ruleMsg) { VATSIM.toast(ruleMsg, "error"); return; }

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
    doc.text("Amount (" + curOf(inv) + ")", pageW - marginX - 2, y, { align: "right" });
    y += 9;
    doc.setFont("helvetica", "normal");
    const plines = linesOf(inv);
    plines.forEach((l) => {
      doc.text(String(l.description) + (plines.length > 1 || (l.taxTreatment && l.taxTreatment !== "standard") ? " [" + rateLabel({ taxTreatment: l.taxTreatment }) + "]" : ""), marginX + 2, y);
      doc.text(String(l.quantity), marginX + 100, y, { align: "right" });
      doc.text(VATSIM.fmtAED(l.unitPrice), marginX + 130, y, { align: "right" });
      doc.text(VATSIM.fmtAED(l.taxable !== undefined ? l.taxable : inv.taxableAmount), pageW - marginX - 2, y, { align: "right" });
      y += 7;
    });
    y += 5;

    doc.setDrawColor(224, 228, 233);
    doc.line(marginX + 90, y, pageW - marginX, y);
    y += 6;
    doc.text("Taxable Amount", marginX + 90, y);
    doc.text(curOf(inv) + " " + VATSIM.fmtAED(inv.taxableAmount), pageW - marginX - 2, y, { align: "right" });
    y += 6;
    if (inv.reverseCharge) {
      doc.text("VAT", marginX + 90, y);
      doc.text("Reverse charge — recipient self-accounts", pageW - marginX - 2, y, { align: "right" });
    } else {
      doc.text("VAT (" + vatLabel(inv) + ")", marginX + 90, y);
      doc.text(curOf(inv) + " " + VATSIM.fmtAED(inv.vatAmount), pageW - marginX - 2, y, { align: "right" });
      if (curOf(inv) !== "AED" && inv.vatAmount) { y += 6; doc.text("VAT in AED (1 " + curOf(inv) + " = " + fxOf(inv) + " AED)", marginX + 90, y); doc.text("AED " + VATSIM.fmtAED(inv.vatAed), pageW - marginX - 2, y, { align: "right" }); }
    }
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Total " + (isCN ? "Credited" : "Payable"), marginX + 90, y);
    doc.text(curOf(inv) + " " + VATSIM.fmtAED(inv.total), pageW - marginX - 2, y, { align: "right" });
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
              "</td><td>" + curOf(inv) + " " + VATSIM.fmtAED(inv.taxableAmount) + "</td><td>" + curOf(inv) + " " + VATSIM.fmtAED(inv.vatAmount) + "</td><td>" + curOf(inv) + " " + VATSIM.fmtAED(inv.total) + "</td>" +
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
