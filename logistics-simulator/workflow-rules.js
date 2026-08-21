/* =========================================================================
   SHARED CATALOG DATA — moved here (from the dashboard's inline script) so
   the workstation/engine can also see EXERCISES and WORKFLOW_ORDER for the
   prerequisite graph and transaction context below. The dashboard now reads
   these as globals from this file instead of declaring its own copies.
   ========================================================================= */

/* Documents with a full fill-in learning exercise built out so far. */
const EXERCISES = {
  "Export License": "workstation.html?doc=export-license",
  "Import License": "workstation.html?doc=import-license",
  "ARE-1": "workstation.html?doc=are-1",
  "ULD Manifest": "workstation.html?doc=uld-manifest",
  "Vendor Comparison Statement": "workstation.html?doc=vendor-comparison-statement",
  "Bin Card": "workstation.html?doc=bin-card",
  "Cycle Count Sheet": "workstation.html?doc=cycle-count-sheet",
  "Trip Sheet": "workstation.html?doc=trip-sheet",
  "Weighbridge Slip": "workstation.html?doc=weighbridge-slip",
  "Commercial Invoice": "workstation.html?doc=commercial-invoice",
  "Bill of Lading": "workstation.html?doc=bill-of-lading-sea",
  "Packing List": "workstation.html?doc=packing-list",
  "Shipping Bill": "workstation.html?doc=shipping-bill",
  "Bill of Entry": "workstation.html?doc=bill-of-entry",
  "Certificate of Origin": "workstation.html?doc=certificate-of-origin",
  "Letter of Credit": "workstation.html?doc=letter-of-credit",
  "Master AWB": "workstation.html?doc=air-waybill",
  "Master AWB (Air Waybill)": "workstation.html?doc=air-waybill",
  "House AWB": "workstation.html?doc=air-waybill",
  "Lorry Receipt": "workstation.html?doc=lorry-receipt",
  "Consignment Note": "workstation.html?doc=lorry-receipt",
  "Goods Consignment Note": "workstation.html?doc=lorry-receipt",
  "Goods Receipt Note": "workstation.html?doc=goods-receipt-note",
  "Insurance Certificate": "workstation.html?doc=insurance-certificate",
  "Bill of Exchange": "workstation.html?doc=bill-of-exchange",
  "Delivery Order": "workstation.html?doc=delivery-order",
  "Phytosanitary Certificate": "workstation.html?doc=phytosanitary-certificate",
  "Bank Guarantee": "workstation.html?doc=bank-guarantee",
  "Shipping Instructions": "workstation.html?doc=shipping-instructions",
  "Warehouse Receipt": "workstation.html?doc=warehouse-receipt",
  "Proforma Invoice": "workstation.html?doc=proforma-invoice",
  "Purchase Order": "workstation.html?doc=purchase-order",
  "Fumigation Certificate": "workstation.html?doc=fumigation-certificate",
  "Certificate of Analysis": "workstation.html?doc=certificate-of-analysis",
  "Weight Certificate": "workstation.html?doc=weight-certificate",
  "Sea Waybill": "workstation.html?doc=sea-waybill",
  "Credit Note": "workstation.html?doc=credit-note",
  "Debit Note": "workstation.html?doc=debit-note",
  "Dock Receipt": "workstation.html?doc=dock-receipt",
  "Sales Order": "workstation.html?doc=sales-order",
  "Export Declaration": "workstation.html?doc=export-declaration",
  "Security Declaration": "workstation.html?doc=security-declaration",
  "E-Way Bill": "workstation.html?doc=e-way-bill",
  "Mate Receipt": "workstation.html?doc=mate-receipt",
  "Arrival Notice": "workstation.html?doc=arrival-notice",
  "Cargo Arrival Notice": "workstation.html?doc=arrival-notice",
  "Dangerous Goods Declaration": "workstation.html?doc=dangerous-goods-declaration",
  "Inspection Certificate": "workstation.html?doc=inspection-certificate",
  "Proof of Delivery": "workstation.html?doc=proof-of-delivery",
  "Container Packing Certificate": "workstation.html?doc=container-packing-certificate",
  "Container Stuffing Report": "workstation.html?doc=container-packing-certificate",
  "MSDS": "workstation.html?doc=msds",
  "Duty Calculation": "workstation.html?doc=duty-calculation",
  "Booking Confirmation": "workstation.html?doc=booking-confirmation",
  "Booking Note": "workstation.html?doc=booking-confirmation",
  "Out of Charge": "workstation.html?doc=out-of-charge",
  "House Bill of Lading": "workstation.html?doc=house-bill-of-lading",
  "Master Bill of Lading": "workstation.html?doc=master-bill-of-lading",
  "Cargo Manifest": "workstation.html?doc=cargo-manifest",
  "Manifest": "workstation.html?doc=cargo-manifest",
  "VGM Certificate": "workstation.html?doc=vgm-certificate",
  "VGM": "workstation.html?doc=vgm-certificate",
  "Import Invoice": "workstation.html?doc=import-invoice",
  "Customs Declaration": "workstation.html?doc=customs-declaration",
  "Assessment Copy": "workstation.html?doc=assessment-copy",
  "Container Load Plan": "workstation.html?doc=container-load-plan",
  "CLP": "workstation.html?doc=container-load-plan",
  "Freight Invoice (Sea)": "workstation.html?doc=freight-invoice-sea",
  "Air Freight Invoice": "workstation.html?doc=air-freight-invoice",
  "Shipping Order": "workstation.html?doc=shipping-order",
  "Seal Report": "workstation.html?doc=seal-report",
  "Container Destuffing": "workstation.html?doc=container-destuffing",
  "Container Destuffing Report": "workstation.html?doc=container-destuffing",
  "Ocean Freight Quotation": "workstation.html?doc=ocean-freight-quotation",
  "Delivery Challan": "workstation.html?doc=delivery-challan",
  "Road Permit": "workstation.html?doc=road-permit",
  "Vehicle Inspection Report": "workstation.html?doc=vehicle-inspection-report",
  "Stock Transfer Note": "workstation.html?doc=stock-transfer-note",
  "Picking Slip": "workstation.html?doc=picking-slip",
  "Dispatch Note": "workstation.html?doc=dispatch-note",
  "Damage Report": "workstation.html?doc=damage-report",
  "Goods Issue Note": "workstation.html?doc=goods-issue-note",
  "Put Away Slip": "workstation.html?doc=put-away-slip",
  "Tax Invoice (GST)": "workstation.html?doc=tax-invoice-gst",
  "Customer Invoice": "workstation.html?doc=tax-invoice-gst",
  "Customer Invoice (Tax Invoice / GST)": "workstation.html?doc=tax-invoice-gst",
  "Payment Voucher": "workstation.html?doc=payment-voucher",
  "Vendor Bill": "workstation.html?doc=vendor-bill",
  "Purchase Requisition": "workstation.html?doc=purchase-requisition",
  "Request for Quotation": "workstation.html?doc=request-for-quotation",
  "RFQ": "workstation.html?doc=request-for-quotation",
  "Supplier Evaluation": "workstation.html?doc=supplier-evaluation",
  "ICEGATE Forms": "workstation.html?doc=icegate-registration-form",
  "ICEGATE Registration": "workstation.html?doc=icegate-registration-form",
  "EDI Copy": "workstation.html?doc=edi-copy",
  "Customs Gate Pass": "workstation.html?doc=customs-gate-pass",
  "Port Delivery Order": "workstation.html?doc=delivery-order",
  "Exporter Declaration": "workstation.html?doc=export-declaration",
  "Exporter Declaration (SDF/EDF)": "workstation.html?doc=export-declaration",
  "Vendor Master": "workstation.html?doc=vendor-master",
  "Equipment Interchange Receipt": "workstation.html?doc=equipment-interchange-receipt",
  "EIR": "workstation.html?doc=equipment-interchange-receipt",
  "Letter of Indemnity": "workstation.html?doc=letter-of-indemnity",
  "Bank Realization Certificate": "workstation.html?doc=bank-realization-certificate",
  "eBRC": "workstation.html?doc=bank-realization-certificate",
  "GSP Certificate of Origin": "workstation.html?doc=gsp-certificate-of-origin",
  "Form A": "workstation.html?doc=gsp-certificate-of-origin",
  "Demurrage / Detention Invoice": "workstation.html?doc=demurrage-detention-invoice",
  "Marine Insurance Claim Form": "workstation.html?doc=marine-insurance-claim-form",
  "Halal / Kosher Certificate": "workstation.html?doc=halal-kosher-certificate",
  "Inventory Valuation Report": "workstation.html?doc=inventory-valuation-report",

  /* ---- Ported from v2 ---- */
  "Letter of Undertaking": "workstation.html?doc=letter-of-undertaking",
  "LUT": "workstation.html?doc=letter-of-undertaking",
  "Registration-cum-Membership Certificate": "workstation.html?doc=registration-cum-membership-certificate",
  "RCMC": "workstation.html?doc=registration-cum-membership-certificate",
  "GST e-Invoice (IRN Registration)": "workstation.html?doc=gst-e-invoice-irn",
  "e-Invoice": "workstation.html?doc=gst-e-invoice-irn",
  "IRN": "workstation.html?doc=gst-e-invoice-irn",
  "SOFTEX Form (Software Export Declaration)": "workstation.html?doc=softex-form",
  "SOFTEX": "workstation.html?doc=softex-form",
  "Export General Manifest (EGM)": "workstation.html?doc=export-general-manifest",
  "EGM": "workstation.html?doc=export-general-manifest",
  "Importer Security Filing (ISF 10+2)": "workstation.html?doc=importer-security-filing",
  "ISF": "workstation.html?doc=importer-security-filing",
  "Transshipment Permit": "workstation.html?doc=transshipment-permit",
  "Multimodal Transport Document (MTD)": "workstation.html?doc=multimodal-transport-document",
  "MTD": "workstation.html?doc=multimodal-transport-document",
  "Forwarder's Cargo Receipt (FCR)": "workstation.html?doc=forwarders-cargo-receipt",
  "FCR": "workstation.html?doc=forwarders-cargo-receipt",
  "Marine Insurance Policy": "workstation.html?doc=marine-insurance-policy",
  "Cargo Survey / Damage Claim Report": "workstation.html?doc=cargo-survey-damage-claim-report",
  "CFS Gate Pass": "workstation.html?doc=cfs-gate-pass"
};


/* Real per-document step counts (extracted from documents-data.js). */
const STEP_COUNTS = {"export-license":7,"import-license":7,"are-1":7,"uld-manifest":6,"vendor-comparison-statement":6,"bin-card":6,"cycle-count-sheet":6,"trip-sheet":7,"weighbridge-slip":6,"commercial-invoice":12,"bill-of-lading-sea":21,"packing-list":8,"shipping-bill":10,"bill-of-entry":9,"certificate-of-origin":10,"letter-of-credit":12,"air-waybill":11,"lorry-receipt":14,"goods-receipt-note":12,"insurance-certificate":13,"bill-of-exchange":15,"delivery-order":18,"phytosanitary-certificate":8,"bank-guarantee":10,"shipping-instructions":11,"warehouse-receipt":37,"proforma-invoice":12,"purchase-order":12,"fumigation-certificate":10,"certificate-of-analysis":10,"weight-certificate":11,"sea-waybill":7,"credit-note":16,"debit-note":16,"dock-receipt":17,"sales-order":13,"export-declaration":11,"security-declaration":13,"e-way-bill":9,"mate-receipt":14,"arrival-notice":11,"dangerous-goods-declaration":11,"inspection-certificate":11,"container-packing-certificate":11,"proof-of-delivery":17,"msds":18,"duty-calculation":16,"booking-confirmation":11,"out-of-charge":10,"house-bill-of-lading":9,"master-bill-of-lading":9,"cargo-manifest":8,"vgm-certificate":7,"import-invoice":10,"customs-declaration":8,"assessment-copy":7,"container-load-plan":8,"freight-invoice-sea":9,"air-freight-invoice":9,"shipping-order":8,"seal-report":7,"container-destuffing":8,"ocean-freight-quotation":8,"delivery-challan":8,"road-permit":8,"vehicle-inspection-report":7,"stock-transfer-note":8,"picking-slip":7,"dispatch-note":7,"damage-report":7,"goods-issue-note":7,"put-away-slip":7,"tax-invoice-gst":8,"payment-voucher":7,"vendor-bill":8,"purchase-requisition":7,"request-for-quotation":8,"supplier-evaluation":7,"icegate-registration-form":7,"edi-copy":7,"customs-gate-pass":7,"vendor-master":8,"inventory-valuation-report":7,"equipment-interchange-receipt":7,"letter-of-indemnity":8,"bank-realization-certificate":7,"gsp-certificate-of-origin":9,"demurrage-detention-invoice":8,"marine-insurance-claim-form":9,"halal-kosher-certificate":8,"letter-of-undertaking":8,"registration-cum-membership-certificate":6,"gst-e-invoice-irn":7,"softex-form":8,"export-general-manifest":7,"importer-security-filing":9,"transshipment-permit":7,"multimodal-transport-document":8,"forwarders-cargo-receipt":8,"marine-insurance-policy":8,"cargo-survey-damage-claim-report":8,"cfs-gate-pass":8};


/* Real-world document sequence (matches the export shipment lifecycle) — also
   used as the tie-breaker ordering for the transaction context below. */
const WORKFLOW_ORDER = [
  "ICEGATE Forms",
  "Vendor Master","Supplier Evaluation","Purchase Requisition","Request for Quotation","Vendor Comparison Statement","Purchase Order","Vendor Bill","Payment Voucher",
  "Proforma Invoice","Sales Order",
  "Stock Transfer Note","Picking Slip","Goods Issue Note",
  "Commercial Invoice","Tax Invoice (GST)","Packing List",
  "Certificate of Origin","GSP Certificate of Origin","Certificate of Analysis","Fumigation Certificate","Phytosanitary Certificate","Weight Certificate","Halal / Kosher Certificate",
  "Insurance Certificate","Letter of Credit","Bill of Exchange","Bank Guarantee",
  "Export License","Export Declaration","Dangerous Goods Declaration","MSDS",
  "Ocean Freight Quotation","Shipping Instructions","Booking Confirmation","VGM Certificate","Shipping Order","Security Declaration",
  "Container Load Plan","Container Packing Certificate","Equipment Interchange Receipt","Seal Report",
  "Vehicle Inspection Report","Road Permit","Trip Sheet","Delivery Challan","Dispatch Note","Lorry Receipt","Weighbridge Slip","Dock Receipt",
  "ARE-1","Shipping Bill","EDI Copy","Inspection Certificate","Mate Receipt",
  "Master Bill of Lading","House Bill of Lading","Bill of Lading","Freight Invoice (Sea)","Sea Waybill","Master AWB","ULD Manifest","Air Freight Invoice",
  "Cargo Manifest","Arrival Notice","Container Destuffing",
  "Import License","Import Invoice","Bill of Entry","Assessment Copy","Customs Declaration","Duty Calculation","Out of Charge","Customs Gate Pass","E-Way Bill",
  "Letter of Indemnity","Delivery Order","Demurrage / Detention Invoice","Goods Receipt Note","Put Away Slip","Damage Report","Marine Insurance Claim Form","Warehouse Receipt","Bin Card","Cycle Count Sheet","Proof of Delivery",
  "Credit Note","Debit Note","Bank Realization Certificate","Inventory Valuation Report"
];

/* =========================================================================
   SKELORA INSTITUTE LOGISTICS SIMULATOR — WORKFLOW RULES & TRANSACTION CONTEXT
   Two things live here, both purely additive — nothing in engine.js's
   rendering, validation, or storage functions is modified:

   1. PREREQUISITES — a real dependency graph (not just "previous item in a
      list"). A document can only be started once every document listed as
      its direct prerequisite has status "completed" for this student, on
      this computer. Because a document can only ever have been completed
      by *also* passing its own prerequisite check, requiring only the
      *direct* parents here is sufficient — transitive requirements (e.g.
      Packing List requiring Commercial Invoice requiring Sales Order) are
      automatically enforced by the chain itself.

   2. TRANSACTION CONTEXT — a small derived store, keyed per student, that
      carries forward shared transaction data (buyer/seller identity,
      PO/invoice/container numbers, ports, vessel, currency, HS codes, line
      items...) from completed documents into new ones. Individual fields
      opt in via an additive `contextKey` property already living on the
      field definition in documents-data.js (documents built before this
      feature carry no `contextKey` and simply don't participate — nothing
      about them changes). Context favours whichever completed document is
      *earliest* in the real workflow for a given key, since that's the
      document that actually originates that fact in the real world (e.g.
      the buyer's name is authoritative from the Sales Order, not whatever
      a much later Warehouse Receipt happens to also carry).
   ========================================================================= */

/* ---------------------------------------------------------------------
   1. PREREQUISITES
   Slug -> array of slugs that must be status:"completed" first.
   Independent/parallel starting points (registration, master data,
   internal procurement, vehicle-level docs) intentionally have no
   prerequisite — they don't block, and nothing should block on them
   unless they genuinely feed the same transaction.
   --------------------------------------------------------------------- */
const PREREQUISITES = {
  // Registration / master data / procurement (own track, independent of the shipment)
  "icegate-registration-form": [],
  "vendor-master": [],
  "supplier-evaluation": ["vendor-master"],
  "purchase-requisition": [],
  "request-for-quotation": ["purchase-requisition"],
  "vendor-comparison-statement": ["request-for-quotation"],
  "purchase-order": ["vendor-comparison-statement"],
  "vendor-bill": ["purchase-order"],
  "payment-voucher": ["vendor-bill"],

  // Sales / export transaction spine
  "proforma-invoice": [],
  "sales-order": ["proforma-invoice"],
  "stock-transfer-note": ["sales-order"],
  "picking-slip": ["sales-order"],
  "goods-issue-note": ["picking-slip"],
  "commercial-invoice": ["sales-order"],
  "export-license": ["proforma-invoice"],
  "are-1": ["commercial-invoice"],
  "tax-invoice-gst": ["sales-order"],
  "packing-list": ["commercial-invoice"],

  // Certificates that depend on the packed shipment existing
  "certificate-of-origin": ["packing-list"],
  "certificate-of-analysis": ["packing-list"],
  "fumigation-certificate": ["packing-list"],
  "phytosanitary-certificate": ["packing-list"],
  "weight-certificate": ["packing-list"],
  "insurance-certificate": ["commercial-invoice"],
  "letter-of-credit": ["sales-order"],
  "bill-of-exchange": ["commercial-invoice"],
  "bank-guarantee": ["sales-order"],
  "export-declaration": ["commercial-invoice", "packing-list"],
  "dangerous-goods-declaration": ["packing-list"],
  "msds": ["packing-list"],

  // Booking & container prep
  "ocean-freight-quotation": [],
  "shipping-instructions": ["commercial-invoice", "packing-list"],
  "booking-confirmation": ["shipping-instructions"],
  "uld-manifest": ["booking-confirmation"],
  "vgm-certificate": ["booking-confirmation"],
  "shipping-order": ["booking-confirmation"],
  "security-declaration": ["booking-confirmation"],
  "container-load-plan": ["packing-list"],
  "container-packing-certificate": ["container-load-plan"],
  "seal-report": ["container-packing-certificate"],

  // Road leg to port
  "vehicle-inspection-report": [],
  "trip-sheet": ["vehicle-inspection-report"],
  "road-permit": [],
  "delivery-challan": ["packing-list"],
  "dispatch-note": ["delivery-challan", "vehicle-inspection-report"],
  "lorry-receipt": ["dispatch-note"],
  "weighbridge-slip": ["lorry-receipt"],
  "dock-receipt": ["lorry-receipt"],

  // Export customs & loading
  "shipping-bill": ["commercial-invoice", "packing-list", "export-declaration"],
  "edi-copy": ["shipping-bill"],
  "inspection-certificate": ["shipping-bill"],
  "mate-receipt": ["dock-receipt", "seal-report"],

  // Bills of lading / air / sea onward
  "master-bill-of-lading": ["mate-receipt"],
  "house-bill-of-lading": ["master-bill-of-lading"],
  "bill-of-lading-sea": ["mate-receipt"],
  "freight-invoice-sea": ["master-bill-of-lading"],
  "sea-waybill": ["mate-receipt"],
  "air-waybill": ["booking-confirmation"],
  "air-freight-invoice": ["air-waybill"],

  // Arrival / import side
  "cargo-manifest": ["master-bill-of-lading"],
  "arrival-notice": ["cargo-manifest"],
  "container-destuffing": ["arrival-notice"],
  "import-license": ["cargo-manifest"],
  "import-invoice": ["commercial-invoice"],
  "bill-of-entry": ["import-invoice", "arrival-notice"],
  "assessment-copy": ["bill-of-entry"],
  "customs-declaration": ["arrival-notice"],
  "duty-calculation": ["assessment-copy"],
  "out-of-charge": ["duty-calculation"],
  "customs-gate-pass": ["out-of-charge"],
  "e-way-bill": ["customs-gate-pass"],

  // Destination warehouse
  "delivery-order": ["out-of-charge"],
  "goods-receipt-note": ["delivery-order"],
  "bin-card": ["goods-receipt-note"],
  "cycle-count-sheet": ["bin-card"],
  "put-away-slip": ["goods-receipt-note"],
  "damage-report": ["goods-receipt-note"],
  "warehouse-receipt": ["goods-receipt-note"],
  "proof-of-delivery": ["warehouse-receipt"],
  "inventory-valuation-report": ["warehouse-receipt"],

  // New batch: container handover, indemnity, export incentives, preferential origin, overstay billing, claims, religious dietary certification
  "equipment-interchange-receipt": ["container-packing-certificate"],
  "letter-of-indemnity": ["arrival-notice"],
  "bank-realization-certificate": ["commercial-invoice"],
  "gsp-certificate-of-origin": ["certificate-of-origin"],
  "demurrage-detention-invoice": ["delivery-order"],
  "marine-insurance-claim-form": ["damage-report"],
  "halal-kosher-certificate": ["certificate-of-origin"],

  // Financial close-out
  "credit-note": ["commercial-invoice"],
  "debit-note": ["commercial-invoice"]
};

/* Every slug not explicitly listed above (existing documents from before
   this feature, and any future ones added without a rule) defaults to no
   prerequisite — so nothing pre-existing silently becomes locked. */
function skGetPrerequisites(slug){
  return PREREQUISITES[slug] || [];
}

/* Returns {ok:boolean, missing:[{slug,title}]} — missing lists every
   direct prerequisite not yet completed by this student. Title lookup
   prefers EXERCISES (always available, even on the dashboard which
   deliberately doesn't load the full documents-data.js) and falls back
   to DOCUMENT_CONFIGS (only available on the workstation) or the raw slug. */
function _sk_slugToTitle(slug){
  if(typeof EXERCISES !== "undefined"){
    for(const title of Object.keys(EXERCISES)){
      const s = new URLSearchParams(EXERCISES[title].split("?")[1]).get("doc");
      if(s === slug) return title;
    }
  }
  if(typeof DOCUMENT_CONFIGS !== "undefined" && DOCUMENT_CONFIGS[slug]) return DOCUMENT_CONFIGS[slug].title;
  return slug;
}
function skCheckPrerequisites(userId, slug){
  const prereqs = skGetPrerequisites(slug);
  if(prereqs.length === 0) return {ok:true, missing:[]};
  const all = skGetAllProgress(userId);
  const missing = prereqs
    .filter(p => !(all[p] && all[p].status === "completed"))
    .map(p => ({slug:p, title:_sk_slugToTitle(p)}));
  return {ok: missing.length===0, missing};
}

/* ---------------------------------------------------------------------
   2. TRANSACTION CONTEXT
   Any field can opt in by carrying `contextKey:"someCanonicalKey"` in its
   definition (see documents-data.js). Once a document with such a field is
   completed, that field's value becomes available to every later document
   that has a field with the same contextKey — pre-filled automatically,
   never overwriting something the student already typed themselves.
   --------------------------------------------------------------------- */
const SKELORA_CONTEXT_PREFIX = "skelora_context_v1_";

function _sk_contextKey(userId){ return SKELORA_CONTEXT_PREFIX + userId; }

/* Rebuilds the full context from scratch every time it's requested, by
   walking every completed document in real WORKFLOW_ORDER sequence and
   letting the *earliest* completed document that defines a given
   contextKey win. This is deliberately recomputed (not incrementally
   patched) so it can never drift from the actual progress data — the
   progress store (already authoritative) is the only source of truth. */
function skGetTransactionContext(userId){
  const jobSeed = (typeof skGetJobContext === "function") ? skGetJobContext(userId) : {};
  return skBuildTransactionContextFromData(skGetAllProgress(userId), jobSeed);
}

/* Same context-building logic as skGetTransactionContext, but takes the
   progress object and job-context seed directly instead of reading
   localStorage via userId. Needed so the Phase 7 instructor dashboard can
   compute a real score for an IMPORTED student's data (from another lab
   computer's export file), which has no localStorage of its own to read -
   without duplicating the context-building rules in two places. */
function skBuildTransactionContextFromData(all, jobContextSeed){
  all = all || {};
  const order = (typeof WORKFLOW_ORDER !== "undefined") ? WORKFLOW_ORDER : [];
  const slugsInOrder = order
    .map(title => Object.keys(EXERCISES||{}).includes(title) ? new URLSearchParams(EXERCISES[title].split("?")[1]).get("doc") : null)
    .filter(Boolean);
  const allCompletedSlugs = Object.keys(all).filter(s => all[s] && all[s].status === "completed");
  const orderedSlugs = [
    ...slugsInOrder.filter(s => allCompletedSlugs.includes(s)),
    ...allCompletedSlugs.filter(s => !slugsInOrder.includes(s))
  ];

  const context = Object.assign({}, jobContextSeed || {});
  for(const slug of orderedSlugs){
    const cfg = (typeof DOCUMENT_CONFIGS!=="undefined") ? DOCUMENT_CONFIGS[slug] : null;
    const progress = all[slug];
    if(!cfg || !progress || !progress.formData) continue;
    (cfg.steps||[]).forEach(step=>{
      (step.fields||[]).forEach(f=>{
        if(!f.contextKey || !f.name) return;
        const val = progress.formData[f.name];
        if(val===undefined || val===null || val==="") return;
        if(context[f.contextKey] !== undefined) return; // earliest wins
        context[f.contextKey] = {value: val, sourceSlug: slug, sourceTitle: cfg.title};
      });
      // table rows can carry contextKey too, on individual columns (e.g. line items)
      (step.fields||[]).forEach(f=>{
        if(f.type!=="table" || !f.name) return;
        const rows = progress.formData[f.name];
        if(!Array.isArray(rows) || rows.length===0) return;
        (f.columns||[]).forEach(col=>{
          if(!col.contextKey) return;
          if(context[col.contextKey] !== undefined) return;
          const firstVal = rows.map(r=>r[col.key]).find(v=>v!==undefined && v!==null && v!=="");
          if(firstVal!==undefined) context[col.contextKey] = {value: firstVal, sourceSlug: slug, sourceTitle: cfg.title};
        });
      });
    });
  }
  return context;
}

/* Applies the transaction context to a fresh (empty) formData object for
   the document about to be opened. Only fills fields that are currently
   empty — never overwrites anything already present (e.g. resumed
   progress, or a value the student already typed this session).

   Also fills item-detail TABLES (line items, cargo lines, etc.), not just
   top-level fields — e.g. a Job's Item Description/HSN Code/Quantity/Unit
   Price autofill straight into the Commercial Invoice's, Shipping Bill's,
   Packing List's (and others') item table as one pre-filled row, the same
   way skBuildTransactionContextFromData already reads a column's
   contextKey back OUT of a completed document's table — this is the
   write-side counterpart of that existing read-side logic, so a column
   tagged contextKey:"txn.hsCode" round-trips both ways with no new
   plumbing. Only triggers when the whole table is still empty, so it
   never overwrites rows a student already started. */
function skApplyContextAutofill(cfg, formData, context){
  if(!cfg || !context) return formData;
  (cfg.steps||[]).forEach(step=>{
    (step.fields||[]).forEach(f=>{
      if(f.type==="table"){
        if(!f.columns || !f.columns.some(c=>c.contextKey)) return; // nothing on this table can be autofilled
        const existing = formData[f.name];
        if(Array.isArray(existing) && existing.length>0) return; // never overwrite a row the student already has
        // Multi-item Job Master: if the columns look like a goods/line-item
        // table (at least one column tagged with an item-family contextKey)
        // and the Job Master has more than one item, give the table one row
        // PER ITEM instead of a single row — same as a student would type
        // one row per product themselves, just pre-filled.
        const ITEM_KEYS = ["txn.itemDescription","txn.hsCode","txn.itemQuantity","txn.itemUnit","txn.itemUnitPrice","txn.itemWeight"];
        const isItemTable = f.columns.some(c=> c.contextKey && ITEM_KEYS.includes(c.contextKey));
        const itemsCtx = context["txn.items"];
        if(isItemTable && itemsCtx && Array.isArray(itemsCtx.value) && itemsCtx.value.length>0){
          const rows = itemsCtx.value.map(item=>{
            const row = {};
            f.columns.forEach(c=>{
              if(c.computed) return;
              row[c.key] = "";
              if(c.contextKey==="txn.itemDescription" && item.description) row[c.key] = item.description;
              else if(c.contextKey==="txn.hsCode" && item.hsCode) row[c.key] = item.hsCode;
              else if(c.contextKey==="txn.itemQuantity" && item.quantity) row[c.key] = item.quantity;
              else if(c.contextKey==="txn.itemUnit" && item.unit) row[c.key] = item.unit;
              else if(c.contextKey==="txn.itemUnitPrice" && item.unitPrice) row[c.key] = item.unitPrice;
              else if(c.contextKey==="txn.itemWeight" && item.weight) row[c.key] = item.weight;
              else if(c.contextKey && context[c.contextKey]) row[c.key] = context[c.contextKey].value;
            });
            return row;
          });
          formData[f.name] = rows;
          return;
        }
        const row = {};
        let filledAny = false;
        f.columns.forEach(c=>{
          if(c.computed) return;
          row[c.key] = "";
          if(c.contextKey && context[c.contextKey]){
            row[c.key] = context[c.contextKey].value;
            filledAny = true;
          }
        });
        if(filledAny) formData[f.name] = [row];
        return;
      }
      if(f.contextKey && context[f.contextKey] && (formData[f.name]===undefined || formData[f.name]==="")){
        formData[f.name] = context[f.contextKey].value;
      }
    });
  });
  return formData;
}

/* ---------------------------------------------------------------------
   3. CROSS-DOCUMENT VALIDATION (Phase 3)
   Compares a document's own submitted values, for every field or table
   column that carries a contextKey, against the SAME canonical
   transaction context built in section 2 (Job Master + earliest completed
   document). This is deliberately scoped to values that already share one
   contextKey — i.e. genuinely the same fact restated in two places (the
   same buyer name, the same container number, the same HS code) — not an
   invented business rule comparing two conceptually different numbers.

   One example from the ERP-upgrade brief is explicitly NOT handled here:
   Commercial Invoice weight vs. VGM weight. Those are legitimately
   different figures in the real world (invoice/packing weight vs. the
   SOLAS-verified gross mass of the packed container including tare), and
   documents-data.js correctly does NOT tag them with the same contextKey.
   Comparing them would need an explicit, named tolerance rule from you —
   flagging for domain review rather than inventing one, per the master
   prompt's own instruction not to guess at logistics rules.

   This is warning-level and non-blocking: a student can still complete a
   document with a flagged mismatch. Phase 13 (final job audit) is where a
   mismatch would actually count against completion — not this phase.
   --------------------------------------------------------------------- */

// contextKeys compared numerically (with a small rounding-only tolerance,
// not a business tolerance); everything else compares as trimmed,
// case-insensitive text. Kept short and explicit on purpose.
const SK_NUMERIC_CONTEXT_KEYS = new Set(["txn.grossWeight", "txn.noOfPackages", "txn.itemWeight", "txn.itemQuantity", "txn.itemUnitPrice"]);

function _sk_valuesMatch(key, a, b){
  if(SK_NUMERIC_CONTEXT_KEYS.has(key)){
    const na = parseFloat(a), nb = parseFloat(b);
    if(isNaN(na) || isNaN(nb)) return String(a).trim() === String(b).trim();
    return Math.abs(na - nb) < 0.005;
  }
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

/* Checks one document's own formData (completed or still in progress)
   against a canonical context, for every field/table-column that opts in
   via contextKey. Only flags where BOTH values are actually present and
   non-empty — an unfilled field is incomplete, not a mismatch. */
function skFindDocumentMismatches(cfg, formData, context){
  const mismatches = [];
  if(!cfg || !formData || !context) return mismatches;
  (cfg.steps||[]).forEach(step=>{
    (step.fields||[]).forEach(f=>{
      if(f.contextKey && context[f.contextKey]){
        const thisVal = formData[f.name];
        const canon = context[f.contextKey];
        if(thisVal!==undefined && thisVal!==null && thisVal!=="" && !_sk_valuesMatch(f.contextKey, thisVal, canon.value)){
          mismatches.push({contextKey:f.contextKey, label:f.label, thisValue:thisVal, canonicalValue:canon.value, canonicalSource:canon.sourceTitle});
        }
      }
      if(f.type==="table" && f.name && Array.isArray(formData[f.name])){
        (f.columns||[]).forEach(col=>{
          if(!col.contextKey || !context[col.contextKey]) return;
          // Multi-item Job Master: each row is EXPECTED to have its own
          // description/HSN/qty/unit/price when there's more than one
          // item, so don't flag row 2+ as a "mismatch" just for differing
          // from item #1's canonical value — only single-item Jobs (or
          // non-item contextKeys, e.g. a shared seller/buyer name column)
          // get row-by-row mismatch checking.
          const ITEM_KEYS = ["txn.itemDescription","txn.hsCode","txn.itemQuantity","txn.itemUnit","txn.itemUnitPrice","txn.itemWeight"];
          const itemsCtx = context["txn.items"];
          if(ITEM_KEYS.includes(col.contextKey) && itemsCtx && Array.isArray(itemsCtx.value) && itemsCtx.value.length>1) return;
          const canon = context[col.contextKey];
          formData[f.name].forEach((row,i)=>{
            const val = row[col.key];
            if(val!==undefined && val!==null && val!=="" && !_sk_valuesMatch(col.contextKey, val, canon.value)){
              mismatches.push({contextKey:col.contextKey, label:`${f.label} — ${col.label} (row ${i+1})`, thisValue:val, canonicalValue:canon.value, canonicalSource:canon.sourceTitle});
            }
          });
        });
      }
    });
  });
  return mismatches;
}

/* Dashboard-level convenience: re-checks EVERY completed document's own
   submitted values against the current canonical context in one pass —
   used for the "Cross-Document Validation" panel, not the live in-document
   banner (which calls skFindDocumentMismatches directly from engine.js). */
function skGetAllCrossDocumentMismatches(userId){
  const all = skGetAllProgress(userId);
  const context = skGetTransactionContext(userId);
  const results = [];
  Object.keys(all).forEach(slug=>{
    const progress = all[slug];
    if(!progress || progress.status !== "completed" || !progress.formData) return;
    const cfg = (typeof DOCUMENT_CONFIGS !== "undefined") ? DOCUMENT_CONFIGS[slug] : null;
    if(!cfg) return;
    skFindDocumentMismatches(cfg, progress.formData, context).forEach(m=>{
      results.push(Object.assign({slug, docTitle: cfg.title}, m));
    });
  });
  return results;
}

/* ---------------------------------------------------------------------
   4. STUDENT SCORING + FINAL JOB AUDIT (Phase 6)

   Deliberately built ONLY from data this simulator can genuinely measure,
   rather than inventing scores for things it has no way to verify:

   - Workflow Completion: real — every document's status is already
     tracked in the progress store.
   - Cross-Document Consistency: real — reuses the exact Phase 3 mismatch
     engine, counting every contextKey comparison actually performed
     across every completed document, not just the failures.
   - "Documentation Accuracy" / "Valid Formats" from the master prompt's
     scoring list are NOT scored separately here, because engine.js's
     validateStep() already REQUIRES every required field to be present
     and pattern-valid before a document can be marked complete — a
     completed document is by construction 100% on both, so scoring it
     again would just be redundant, not a real signal.
   - "Calculation Accuracy" is not scored: every computed field in
     documents-data.js is derived with a fixed formula (deps + compute),
     so it cannot be wrong by construction either — there's no incorrect
     total for a student to have entered.
   - Time Taken / Number of Attempts are shown as INFORMATION ONLY, never
     scored, per the master prompt's own instruction not to make speed
     more important than correctness — and because turning them into a
     score would require an arbitrary "good" time/attempt threshold this
     simulator has no real basis for. They're read from the existing
     audit log (skAppendAudit's "started"/"completed" entries in
     auth.js), not from any new tracking.
   --------------------------------------------------------------------- */

/* Counts total contextKey comparisons performed for one document (not just
   the failing ones) — the denominator skGetJobAudit needs for a percentage,
   not just a raw mismatch count. */
function skCountDocumentChecks(cfg, formData, context){
  let performed = 0, failed = 0;
  if(!cfg || !formData || !context) return {performed, failed};
  (cfg.steps||[]).forEach(step=>{
    (step.fields||[]).forEach(f=>{
      if(f.contextKey && context[f.contextKey]){
        const thisVal = formData[f.name];
        if(thisVal!==undefined && thisVal!==null && thisVal!==""){
          performed++;
          if(!_sk_valuesMatch(f.contextKey, thisVal, context[f.contextKey].value)) failed++;
        }
      }
      if(f.type==="table" && f.name && Array.isArray(formData[f.name])){
        (f.columns||[]).forEach(col=>{
          if(!col.contextKey || !context[col.contextKey]) return;
          formData[f.name].forEach(row=>{
            const val = row[col.key];
            if(val!==undefined && val!==null && val!==""){
              performed++;
              if(!_sk_valuesMatch(col.contextKey, val, context[col.contextKey].value)) failed++;
            }
          });
        });
      }
    });
  });
  return {performed, failed};
}

/* Reads attempts and time-on-last-attempt for one document straight from
   the existing audit log — no new tracking added. "Attempts" = number of
   times this document has ever been marked completed (redoing an already-
   completed exercise and completing it again counts as another attempt).
   Time is measured from the most recent "started" entry that precedes the
   most recent "completed" entry, so a redo's timing doesn't get muddled
   with the original attempt's. */
function skGetDocumentTiming(userId, slug){
  const log = (typeof skGetAuditLog === "function") ? skGetAuditLog(userId, slug) : [];
  return skBuildDocumentTimingFromLog(log);
}

/* Same timing/attempts logic as skGetDocumentTiming, but takes an already-
   filtered audit log array directly — used by the Phase 7 instructor
   dashboard for imported students (their auditLog comes from the export
   file, not this computer's localStorage). */
function skBuildDocumentTimingFromLog(log){
  log = log || [];
  const completions = log.filter(e=>e.action==="completed").sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  const starts = log.filter(e=>e.action==="started").sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  if(completions.length===0) return {attempts: 0, lastTimeSpentSeconds: null};
  const lastCompletion = completions[completions.length-1];
  const precedingStart = starts.filter(s=>new Date(s.ts) <= new Date(lastCompletion.ts)).pop();
  const lastTimeSpentSeconds = precedingStart
    ? Math.max(0, Math.round((new Date(lastCompletion.ts) - new Date(precedingStart.ts)) / 1000))
    : null;
  return {attempts: completions.length, lastTimeSpentSeconds};
}

/* THE FINAL JOB AUDIT. Runs the checks the master prompt's section 13
   describes, using only real, already-available data:
     - Documents: completed / total
     - Cross-document checks: performed / passed / failed
   Result is "PASS" only when every exercise is completed AND zero
   cross-document checks failed — matching "only then issue the
   completion certificate" from the brief. Anything else is "INCOMPLETE",
   never a hard failure state the student can't recover from. */
function skGetJobAudit(userId, totalExercises, applicableSlugs){
  const jobSeed = (typeof skGetJobContext === "function") ? skGetJobContext(userId) : {};
  return skBuildJobAuditFromData(skGetAllProgress(userId), jobSeed, totalExercises, applicableSlugs);
}

/* Same audit logic as skGetJobAudit, but takes the progress object and job-
   context seed directly — used by both skGetJobAudit (real localStorage
   data) and the Phase 7 instructor dashboard (imported/other-computer
   data, which has no localStorage of its own). One set of audit rules,
   two data sources.

   PHASE 8: optional applicableSlugs (array of slugs) scopes the ENTIRE
   audit — denominator, completed/in-progress counts, and cross-document
   checks — to just the documents that apply to the active Job's mode
   (see skGetApplicableSlugsForMode in job-engine.js). A Sea Export Job is
   audited only against Sea Export-relevant documents; it is never asked
   to complete Air Waybill or Lorry Receipt to pass. Omitting this
   parameter preserves the exact pre-Phase-8 behavior (audit against
   every document in the catalog), so existing calls are unaffected. */
function skBuildJobAuditFromData(all, jobContextSeed, totalExercises, applicableSlugs){
  all = all || {};
  const relevantSlugs = (applicableSlugs && applicableSlugs.length) ? new Set(applicableSlugs) : null;
  if(relevantSlugs) totalExercises = applicableSlugs.length;

  const entries = Object.entries(all)
    .filter(([slug, e]) => e && (!relevantSlugs || relevantSlugs.has(slug)))
    .map(([, e]) => e);
  const completed = entries.filter(e=>e.status==="completed").length;
  const inProgress = entries.filter(e=>e.status==="in-progress").length;
  const notStarted = Math.max(0, totalExercises - completed - inProgress);

  const context = skBuildTransactionContextFromData(all, jobContextSeed);
  let checksPerformed = 0, checksFailed = 0;
  Object.keys(all).forEach(slug=>{
    if(relevantSlugs && !relevantSlugs.has(slug)) return;
    const progress = all[slug];
    if(!progress || progress.status !== "completed" || !progress.formData) return;
    const cfg = (typeof DOCUMENT_CONFIGS !== "undefined") ? DOCUMENT_CONFIGS[slug] : null;
    if(!cfg) return;
    const stats = skCountDocumentChecks(cfg, progress.formData, context);
    checksPerformed += stats.performed;
    checksFailed += stats.failed;
  });
  const checksPassed = checksPerformed - checksFailed;

  const workflowPct = totalExercises > 0 ? Math.round((completed / totalExercises) * 100) : 0;
  const crossDocPct = checksPerformed > 0 ? Math.round((checksPassed / checksPerformed) * 100) : 100;
  const overallPct = Math.round((workflowPct + crossDocPct) / 2);

  const result = (totalExercises > 0 && completed >= totalExercises && checksFailed === 0) ? "PASS" : "INCOMPLETE";

  return {
    totalExercises, completed, inProgress, notStarted,
    checksPerformed, checksPassed, checksFailed,
    workflowPct, crossDocPct, overallPct, result
  };
}
