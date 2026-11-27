/* =========================================================================
   pdf-parity.js (v51) - keeps the Document Simulator in step with the workbook PDF.
   The PDF fills these fields on every run, but the simulator hid them behind a showIf (a status / mode choice the
   PDF does not make), so a student following the PDF could not find the box. They are now always visible and not
   mandatory; every other rule on the field is untouched. Loaded right after air-patches.js (dashboard + workstation).
   ========================================================================= */
(function skPdfParity(){
  if(typeof DOCUMENT_CONFIGS === "undefined") return;
  const SHOW = {
    "vgm-certificate": ["Weighbridge Registration Number","Weighing Slip Number","Calculation Method Details"],
    "vehicle-inspection-report": ["Defects Noted"],
    "bill-of-exchange": ["Acceptance Recorded On","Negotiating Bank (if any)","Payment Confirmation Date","Payment Confirmation Reference","Reason for Dishonour"],
    "proforma-invoice": ["UN Number / DG Class"],
    "sales-order": ["Backorder Quantity"],
    "commercial-invoice": ["Tax Rate (%)"],
    "export-declaration": ["Dangerous Goods Declaration No."],
    "dock-receipt": ["Damage / Discrepancy Remarks","Hazmat Declaration Reference","Liability Marking","Reefer Set-Point Temperature"],
    "warehouse-receipt": ["Invoice Buyer","Invoice Currency","Invoice Seller"],
    "damage-report": ["Insurance Claim Reference Number"],
    "e-way-bill": ["Transport Document Number"],
    "delivery-order": ["Original AWB Copies Presented"],
    "bill-of-lading-sea": ["Linked Master B/L Number"]
  };
  const norm = s => String(s||"").replace(/&amp;/g,"&").replace(/\s+/g," ").trim().toLowerCase();
  Object.keys(SHOW).forEach(slug => {
    const cfg = DOCUMENT_CONFIGS[slug]; if(!cfg) return;
    const want = new Set(SHOW[slug].map(norm));
    (cfg.steps||[]).forEach(st => (st.fields||[]).forEach(f => {
      if(f && want.has(norm(f.label))){ if(f.showIf) f.showIf = null; f.required = false; delete f.pattern; delete f.patternMsg; }
    }));
  });

  /* EDI Copy: "Original Document Number" was always tied to the Bill of Entry number, so on an EXPORT lot it stayed empty
     even after the Shipping Bill was filed. On export lots it now follows the Shipping Bill number. */
  try{
    const u = (typeof skGetCurrentUser === "function") ? skGetCurrentUser() : null;
    const job = (u && typeof skGetActiveJob === "function") ? skGetActiveJob(u.id) : null;
    const mode = job && job.fields && job.fields.mode || "";
    if(/Export/i.test(mode) && DOCUMENT_CONFIGS["edi-copy"]){
      (DOCUMENT_CONFIGS["edi-copy"].steps||[]).forEach(st => (st.fields||[]).forEach(f => { if(f && f.name === "originalDocNo") f.contextKey = "txn.shippingBillNo"; }));
    }
  }catch(e){ /* no job / no user: leave as is */ }

  /* Fields the PDF fills from an OPTIONAL document that a student doing only the MANDATORY documents never creates:
     they stay visible and still autofill when that document exists, but no longer block the step when it does not. */
  const REQUIRED_OFF = { "export-declaration": ["Certificate of Origin No."] };
  Object.keys(REQUIRED_OFF).forEach(slug => {
    const cfg = DOCUMENT_CONFIGS[slug]; if(!cfg) return;
    const want = new Set(REQUIRED_OFF[slug].map(norm));
    (cfg.steps||[]).forEach(st => (st.fields||[]).forEach(f => { if(f && want.has(norm(f.label))) f.required = false; }));
  });

  /* An importer / buyer abroad has no GSTIN, so the importer / buyer / customer GSTIN is optional in every document.
     (Domestic B2B tax invoices only show it for a registered buyer and keep it mandatory; the E-Way Bill recipient
     keeps its own rule where "URP" is accepted.) */
  Object.keys(DOCUMENT_CONFIGS).forEach(slug => {
    const cfg = DOCUMENT_CONFIGS[slug];
    (cfg.steps||[]).forEach(st => (st.fields||[]).forEach(f => {
      if(!f) return;
      const buyerGst = f.contextKey === "txn.buyerGSTIN" || /^importerGSTIN$/.test(f.name || "");
      if(!buyerGst || f.name === "toGSTIN") return;
      if(f.showIf && /B2B/.test(String(f.showIf))) return;
      f.required = false;
    }));
  });
})();
