/* ============================================================
   Corporate Tax Return PDF — generated only after a successful
   submission, entirely from the snapshot captured at that moment
   (see return.js, btn-submit handler) plus the shared taxpayer
   profile (ET.person()). Nothing here is hardcoded sample data;
   if the snapshot is missing (e.g. this page was reached without
   a real submission), the download button explains that instead
   of producing a fake PDF.
   ============================================================ */
(function (global) {
  "use strict";

  function aedNum(n) {
    return "AED " + ET.money(n);
  }

  /* jsPDF's built-in fonts (Helvetica/Times/Courier) only cover Latin
     script — there is no Arabic glyph coverage, and Arabic text also
     needs contextual letter shaping and right-to-left layout that
     jsPDF's plain text() does not perform. Attempting to render Arabic
     with the built-in font doesn't fail loudly; it silently prints
     mojibake (wrong-glyph garbage), which looks broken and is worse
     than omitting the value. Until an Arabic-shaping font is vendored
     in, show a clear, honest placeholder instead. */
  function isArabicScript(text) {
    return /[\u0600-\u06FF]/.test(String(text || ""));
  }
  function safeText(text) {
    if (!text) return "";
    return isArabicScript(text) ? "(Arabic name on file \u2014 not renderable in this offline export)" : text;
  }

  function buildAddress(ct) {
    var parts = [ct.addr_building, ct.addr_street, ct.addr_area, ct.addr_emirate]
      .filter(function (v) { return v && String(v).trim(); });
    var line = parts.join(", ");
    return ct.addr_pobox ? (line + (line ? " \u2014 " : "") + "P.O. Box " + ct.addr_pobox) : line;
  }

  function generateCtPdf() {
    var state = ET.Store.get();
    var f = state.filing || {};
    var snap = f.snapshot;
    if (!snap || f.status !== "Submitted") {
      ET.toast("A Corporate Tax return must be successfully submitted before the return PDF can be generated.", "warn");
      return false;
    }
    var jspdfLib = global.jspdf;
    if (!jspdfLib || !jspdfLib.jsPDF) {
      ET.toast("PDF engine failed to load \u2014 check that assets/js/vendor/jspdf.umd.min.js is present.", "warn");
      return false;
    }

    var p = ET.person();
    var per = ET.period();
    var ct = state.ct || {};
    var doc = new jspdfLib.jsPDF({ unit: "pt", format: "a4" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 48;
    var y = 56;

    function h(text, size, bold, color) {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor.apply(doc, color || [17, 24, 39]);
      doc.text(text, margin, y);
      y += size * 0.9;
    }
    function rule() {
      y += 6;
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y, pageW - margin, y);
      y += 16;
    }
    function row(label, value) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text(String(value == null || value === "" ? "\u2014" : value), pageW - margin, y, { align: "right" });
      y += 16;
    }
    function sectionTitle(text) {
      y += 6;
      doc.setFillColor(240, 245, 249);
      doc.rect(margin - 8, y - 12, pageW - 2 * margin + 16, 20, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(text.toUpperCase(), margin, y + 2);
      y += 24;
    }
    function ensureRoom(needed) {
      if (y + needed > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = 56;
      }
    }

    h("Federal Tax Authority \u2014 EmaraTax", 15, true);
    h("Corporate Tax Return \u2014 Filing Summary", 11.5, false, [71, 85, 105]);
    rule();

    sectionTitle("Taxpayer Details");
    row("Taxable Person Name (English)", p.nameEn);
    row("Taxable Person Name (Arabic)", safeText(p.nameAr));
    row("Tax Registration Number (TRN)", p.trn);
    row("Emirates ID", p.emiratesId);
    row("Entity Type", p.entityType);
    row("Entity Sub-Type", p.entitySubType);
    row("Registered Address", buildAddress(ct));

    ensureRoom(120);
    sectionTitle("Tax Period");
    row("Period", per.from + " \u2013 " + per.to);
    row("Tax Year End", per.yearEnd);
    row("Return Due Date", per.due);

    ensureRoom(180);
    sectionTitle("Accounting & Taxable Income");
    row("Revenue", aedNum(snap.revenue));
    row("Gross Profit", aedNum(snap.grossProfit));
    row("Net Accounting Income / (Loss)", aedNum(snap.accountingIncome));
    row("Total Exempt Income", aedNum(snap.exemptTotal));
    row("Total Adjustments Added Back", aedNum(snap.addBacks));
    row("Reliefs Claimed", aedNum(snap.reliefs));
    row("Tax Losses Utilised", aedNum(snap.lossesUsed));
    row("Taxable Income", aedNum(snap.taxableIncome));

    ensureRoom(160);
    sectionTitle("Corporate Tax Calculation");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    var regimeLines = doc.splitTextToSize(snap.regime || "", pageW - 2 * margin);
    doc.text(regimeLines, margin, y);
    y += regimeLines.length * 11 + 6;
    row("Taxable Income at 0%", aedNum(snap.band0));
    row("Taxable Income at 9%", aedNum(snap.band9));
    row("Corporate Tax before Credits", aedNum(snap.taxBefore));
    row("Tax Credits Applied", aedNum(snap.creditsUsed));
    row("Corporate Tax after Credits", aedNum(snap.taxAfterCredits));
    row("Domestic Minimum Top-up Tax", aedNum(snap.dmttTopUp));

    ensureRoom(90);
    y += 4;
    doc.setFillColor(17, 24, 39);
    doc.rect(margin - 8, y - 14, pageW - 2 * margin + 16, 30, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(255, 255, 255);
    doc.text("NET CORPORATE TAX PAYABLE", margin, y + 5);
    doc.text(aedNum(snap.netPayable), pageW - margin, y + 5, { align: "right" });
    y += 34;

    ensureRoom(100);
    sectionTitle("Submission");
    row("Submission Reference", f.appNumber);
    row("Submission Date", f.submittedOn);
    row("Status", f.status);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Training simulator output \u2014 not connected to the Federal Tax Authority. This document does not represent an actual filed Corporate Tax return.",
      margin, doc.internal.pageSize.getHeight() - 30, { maxWidth: pageW - 2 * margin }
    );

    var fileSafeName = (p.nameEn || "Corporate_Tax_Return").replace(/[^a-z0-9]+/gi, "_");
    doc.save(fileSafeName + "_" + (f.appNumber || "return") + ".pdf");
    return true;
  }

  /* Payment receipt — built only from the payment record saved by
     ct-payment.js after a successful Magnati Pay transaction. */
  function generateReceiptPdf() {
    var state = ET.Store.get();
    var f = state.filing || {};
    var pay = f.payment;
    if (!pay || pay.status !== "Paid") {
      ET.toast("A Corporate Tax payment must be completed before a receipt can be generated.", "warn");
      return false;
    }
    var jspdfLib = global.jspdf;
    if (!jspdfLib || !jspdfLib.jsPDF) {
      ET.toast("PDF engine failed to load \u2014 check that assets/js/vendor/jspdf.umd.min.js is present.", "warn");
      return false;
    }
    var p = ET.person();
    var per = ET.period();
    var doc = new jspdfLib.jsPDF({ unit: "pt", format: "a4" });
    var pageW = doc.internal.pageSize.getWidth();
    var margin = 48;
    var y = 56;

    function row(label, value) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text(String(value == null || value === "" ? "\u2014" : value), pageW - margin, y, { align: "right" });
      y += 17;
    }
    function section(text) {
      y += 8;
      doc.setFillColor(240, 245, 249);
      doc.rect(margin - 8, y - 12, pageW - 2 * margin + 16, 20, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(text.toUpperCase(), margin, y + 2);
      y += 26;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(17, 24, 39);
    doc.text("Federal Tax Authority \u2014 EmaraTax", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Corporate Tax Payment Receipt", margin, y);
    y += 10;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageW - margin, y);
    y += 18;

    doc.setFillColor(4, 120, 87);
    doc.rect(margin - 8, y - 14, pageW - 2 * margin + 16, 26, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(255, 255, 255);
    doc.text("PAYMENT SUCCESSFUL", margin, y + 3);
    doc.text(pay.reference, pageW - margin, y + 3, { align: "right" });
    y += 30;

    section("Taxpayer");
    row("Taxable Person Name (English)", p.nameEn);
    row("Taxable Person Name (Arabic)", safeText(p.nameAr));
    row("Tax Registration Number (TRN)", p.trn);

    section("Return");
    row("Return Application Number", f.appNumber);
    row("Return Submitted On", f.submittedOn);
    row("Corporate Tax Period", per.from + " \u2013 " + per.to);
    row("Payment Due Date", per.due);

    section("Payment");
    row("Payment Reference", pay.reference);
    row("Payment Date & Time", pay.paidOn);
    row("Payment Method", "Magnati Pay \u2014 " + pay.method);
    row("Paid With", pay.instrument);
    row("Magnati Transaction ID", pay.gatewayTxn);
    row("Authorisation Code", pay.authCode);

    y += 10;
    doc.setFillColor(17, 24, 39);
    doc.rect(margin - 8, y - 14, pageW - 2 * margin + 16, 30, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(255, 255, 255);
    doc.text("AMOUNT PAID", margin, y + 5);
    doc.text(aedNum(pay.amount), pageW - margin, y + 5, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "Training simulator output \u2014 not connected to the Federal Tax Authority or Magnati. No real payment was made and this is not a valid tax receipt.",
      margin, doc.internal.pageSize.getHeight() - 30, { maxWidth: pageW - 2 * margin }
    );

    var fileSafeName = (p.nameEn || "Corporate_Tax").replace(/[^a-z0-9]+/gi, "_");
    doc.save(fileSafeName + "_Payment_Receipt_" + pay.reference + ".pdf");
    return true;
  }

  global.ET_CT_PDF = { generate: generateCtPdf, receipt: generateReceiptPdf };
})(window);
