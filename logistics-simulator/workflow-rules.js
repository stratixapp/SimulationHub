/* =========================================================================
   SHARED CATALOG DATA — moved here (from the dashboard's inline script) so
   the workstation/engine can also see EXERCISES and WORKFLOW_ORDER for the
   prerequisite graph and transaction context below. The dashboard now reads
   these as globals from this file instead of declaring its own copies.
   ========================================================================= */

/* Documents with a full fill-in learning exercise built out so far. */
const EXERCISES = {
  "Air Waybill": "workstation.html?doc=air-waybill",
  "House Bill of Lading (HBL)": "workstation.html?doc=house-bill-of-lading",
  "Master Bill of Lading (MBL)": "workstation.html?doc=master-bill-of-lading",
  "Container Load Plan (CLP)": "workstation.html?doc=container-load-plan",
  "Request for Quotation (RFQ)": "workstation.html?doc=request-for-quotation",
  "ICEGATE Forms (Registration)": "workstation.html?doc=icegate-registration-form",
  "Equipment Interchange Receipt (EIR)": "workstation.html?doc=equipment-interchange-receipt",
  "Letter of Indemnity (LOI)": "workstation.html?doc=letter-of-indemnity",
  "Bank Realization Certificate (eBRC)": "workstation.html?doc=bank-realization-certificate",
  "GSP Certificate of Origin (Form A)": "workstation.html?doc=gsp-certificate-of-origin",
  "Importer Security Filing — ISF (10+2)": "workstation.html?doc=importer-security-filing",
  "Letter of Undertaking (LUT)": "workstation.html?doc=letter-of-undertaking",
  "Registration-cum-Membership Certificate (RCMC)": "workstation.html?doc=registration-cum-membership-certificate",
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
  // BUGFIX (requested): these 9 catalog entries under "Import" had a
  // title/description in the Documents In Library list but no real
  // exercise behind them. Of the 9, three (Import Insurance, Container
  // Release, Cargo Release) turned out to already be fully covered by an
  // existing document under a different catalog name — Insurance
  // Certificate, Delivery Order and CFS Gate Pass respectively — so
  // those are linked to the real thing instead of being duplicated. The
  // other six are genuinely new documents, added below.
  "Import Packing List": "workstation.html?doc=import-packing-list",
  "Import Permit": "workstation.html?doc=import-permit",
  "Duty Challan": "workstation.html?doc=duty-challan",
  "Examination Report": "workstation.html?doc=examination-report",
  "Importer Authorization": "workstation.html?doc=importer-authorization",
  "Import Checklist": "workstation.html?doc=import-checklist",
  "Import Insurance": "workstation.html?doc=insurance-certificate",
  "Container Release": "workstation.html?doc=delivery-order",
  "Cargo Release": "workstation.html?doc=cfs-gate-pass",
  // Same pattern for Sea: all 3 catalog gaps turned out to already be
  // covered by an existing document under a different catalog name.
  "House BL": "workstation.html?doc=house-bill-of-lading",
  "Master BL": "workstation.html?doc=master-bill-of-lading",
  "Container Stuffing": "workstation.html?doc=container-load-plan",
  // Air: Air Cargo Manifest is the same real document as the existing
  // Cargo Manifest (which already covers air, per its own heroDesc citing
  // both Customs Act Section 30/import and Section 41/export).
  "Air Cargo Manifest": "workstation.html?doc=cargo-manifest",
  // These two are genuinely new — built below.
  "Flight Schedule": "workstation.html?doc=flight-schedule",
  "Cargo Acceptance": "workstation.html?doc=cargo-acceptance",
  // Export: Cargo Receipt and Export Invoice are the same real documents
  // as the existing Forwarder's Cargo Receipt (FCR) and Commercial
  // Invoice under their catalog-standard names.
  "Cargo Receipt": "workstation.html?doc=forwarders-cargo-receipt",
  "Export Invoice": "workstation.html?doc=commercial-invoice",
  // These two are genuinely new — built below. Export Permit is the
  // PGA-specific counterpart to the existing Export License (which
  // covers DGFT's own SCOMET/restricted-goods authorization) — the same
  // License-vs-Permit split already built for Import.
  "Export Permit": "workstation.html?doc=export-permit",
  "Export Checklist": "workstation.html?doc=export-checklist",
  // Finance: Tax Invoice was already fully built (8-step "Tax Invoice
  // (GST)" exercise, correctly mode-scoped) — it just had no catalog
  // link at all under its exact "Tax Invoice" name. Zero new content
  // needed, just this one line.
  "Tax Invoice": "workstation.html?doc=tax-invoice-gst",
  // Transport: Driver Assignment and Vehicle Checklist are the same real
  // documents as the existing Trip Sheet (driver/vehicle/route locked in
  // before departure) and Vehicle Inspection Report (its own subtitle is
  // literally "Pre-Dispatch Vehicle Checklist").
  "Driver Assignment": "workstation.html?doc=trip-sheet",
  "Vehicle Checklist": "workstation.html?doc=vehicle-inspection-report",
  // These four are genuinely new — built below.
  "Fuel Slip": "workstation.html?doc=fuel-slip",
  "Toll Receipt": "workstation.html?doc=toll-receipt",
  "Freight Memo": "workstation.html?doc=freight-memo",
  "Transport Invoice": "workstation.html?doc=transport-invoice",
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
  "Health Certificate": "workstation.html?doc=health-certificate",
  "Catch Certificate": "workstation.html?doc=catch-certificate",
  "HACCP Certificate": "workstation.html?doc=haccp-certificate",
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
const STEP_COUNTS = {"health-certificate":5,"catch-certificate":5,"haccp-certificate":5,"export-license":7,"import-license":7,"are-1":7,"uld-manifest":6,"vendor-comparison-statement":6,"bin-card":6,"cycle-count-sheet":6,"trip-sheet":7,"weighbridge-slip":6,"commercial-invoice":12,"bill-of-lading-sea":21,"packing-list":8,"shipping-bill":10,"bill-of-entry":9,"certificate-of-origin":10,"letter-of-credit":12,"air-waybill":11,"lorry-receipt":14,"goods-receipt-note":12,"insurance-certificate":13,"bill-of-exchange":15,"delivery-order":18,"phytosanitary-certificate":8,"bank-guarantee":10,"shipping-instructions":11,"warehouse-receipt":37,"proforma-invoice":12,"purchase-order":12,"fumigation-certificate":10,"certificate-of-analysis":10,"weight-certificate":11,"sea-waybill":7,"credit-note":16,"debit-note":16,"dock-receipt":17,"sales-order":13,"export-declaration":11,"security-declaration":13,"e-way-bill":9,"mate-receipt":14,"arrival-notice":11,"dangerous-goods-declaration":11,"inspection-certificate":11,"container-packing-certificate":11,"proof-of-delivery":17,"msds":18,"duty-calculation":16,"booking-confirmation":11,"out-of-charge":10,"house-bill-of-lading":9,"master-bill-of-lading":9,"cargo-manifest":8,"vgm-certificate":7,"import-invoice":10,"customs-declaration":8,"assessment-copy":7,"container-load-plan":8,"freight-invoice-sea":9,"air-freight-invoice":9,"shipping-order":8,"seal-report":7,"container-destuffing":8,"ocean-freight-quotation":8,"delivery-challan":8,"road-permit":8,"vehicle-inspection-report":7,"stock-transfer-note":8,"picking-slip":7,"dispatch-note":7,"damage-report":7,"goods-issue-note":7,"put-away-slip":7,"tax-invoice-gst":8,"payment-voucher":7,"vendor-bill":8,"purchase-requisition":7,"request-for-quotation":8,"supplier-evaluation":7,"icegate-registration-form":7,"edi-copy":7,"customs-gate-pass":7,"vendor-master":8,"inventory-valuation-report":7,"equipment-interchange-receipt":7,"letter-of-indemnity":8,"bank-realization-certificate":7,"gsp-certificate-of-origin":9,"demurrage-detention-invoice":8,"marine-insurance-claim-form":9,"halal-kosher-certificate":8,"letter-of-undertaking":8,"import-packing-list":7,"import-permit":7,"duty-challan":7,"examination-report":8,"importer-authorization":7,"import-checklist":6,"flight-schedule":7,"cargo-acceptance":8,"export-permit":7,"export-checklist":6,"fuel-slip":6,"toll-receipt":4,"freight-memo":7,"transport-invoice":7,"registration-cum-membership-certificate":6,"gst-e-invoice-irn":7,"softex-form":8,"export-general-manifest":7,"importer-security-filing":9,"transshipment-permit":7,"multimodal-transport-document":8,"forwarders-cargo-receipt":8,"marine-insurance-policy":8,"cargo-survey-damage-claim-report":8,"cfs-gate-pass":8};


/* Real-world document sequence (matches the export shipment lifecycle) — also
   used as the tie-breaker ordering for the transaction context below. */
const WORKFLOW_ORDER = [
  "ICEGATE Forms (Registration)","Registration-cum-Membership Certificate (RCMC)",
  "Vendor Master","Supplier Evaluation","Purchase Requisition","Request for Quotation (RFQ)","Vendor Comparison Statement","Purchase Order","Vendor Bill","Payment Voucher",
  "Proforma Invoice","Sales Order",
  "Stock Transfer Note","Picking Slip","Goods Issue Note",
  "Commercial Invoice","Tax Invoice (GST)","GST e-Invoice (IRN Registration)","Packing List",
  "Certificate of Origin","GSP Certificate of Origin (Form A)","Certificate of Analysis","Fumigation Certificate","Phytosanitary Certificate","Weight Certificate","Halal / Kosher Certificate","Health Certificate","Catch Certificate","HACCP Certificate",
  "Insurance Certificate","Marine Insurance Policy","Letter of Credit","Bill of Exchange","Bank Guarantee","Letter of Undertaking (LUT)",
  "Export License","Export Permit","Export Checklist","Export Declaration","SOFTEX Form (Software Export Declaration)","Dangerous Goods Declaration","MSDS",
  "Ocean Freight Quotation","Shipping Instructions","Forwarder's Cargo Receipt (FCR)","Booking Confirmation","VGM Certificate","Shipping Order","Security Declaration",
  "Container Load Plan (CLP)","Container Packing Certificate","Equipment Interchange Receipt (EIR)","Seal Report","CFS Gate Pass",
  "Freight Memo","Vehicle Inspection Report","Road Permit","Trip Sheet","Delivery Challan","Dispatch Note","Lorry Receipt","Fuel Slip","Toll Receipt","Weighbridge Slip","Dock Receipt","Transport Invoice",
  "ARE-1","Shipping Bill","EDI Copy","Export General Manifest (EGM)","Inspection Certificate","Mate Receipt",
  "Master Bill of Lading (MBL)","House Bill of Lading (HBL)","Bill of Lading","Multimodal Transport Document (MTD)","Freight Invoice (Sea)","Sea Waybill","Flight Schedule","Cargo Acceptance","Air Waybill","ULD Manifest","Air Freight Invoice","Transshipment Permit",
  "Cargo Manifest","Arrival Notice","Container Destuffing Report",
  "Importer Security Filing — ISF (10+2)","Import License","Import Permit","Import Invoice","Import Packing List","Importer Authorization","Import Checklist","Bill of Entry","Examination Report","Assessment Copy","Customs Declaration","Duty Calculation","Duty Challan","Out of Charge","Customs Gate Pass","E-Way Bill",
  "Letter of Indemnity (LOI)","Delivery Order","Demurrage / Detention Invoice","Goods Receipt Note","Put Away Slip","Damage Report","Cargo Survey / Damage Claim Report","Marine Insurance Claim Form","Warehouse Receipt","Bin Card","Cycle Count Sheet","Proof of Delivery",
  "Credit Note","Debit Note","Bank Realization Certificate (eBRC)","Inventory Valuation Report"
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
  "health-certificate": ["packing-list"],
  "catch-certificate": ["packing-list"],
  "haccp-certificate": [],
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

  // Road leg — BUGFIX: delivery-challan/e-way-bill used to chain into the
  // export spine (delivery-challan needed packing-list, e-way-bill needed
  // customs-gate-pass — an IMPORT customs-clearance doc) even for a
  // purely domestic Road/Warehouse Job, so picking just one road document
  // silently dragged in the entire international document set as
  // "auto-added prerequisites". delivery-challan is now its own root —
  // still perfectly usable as the road-to-port leg of a full Sea Export
  // Job too, just via an explicit pick of Packing List rather than a
  // forced one.
  "vehicle-inspection-report": [],
  "trip-sheet": ["vehicle-inspection-report"],
  "road-permit": [],
  "delivery-challan": [],
  "dispatch-note": ["delivery-challan", "vehicle-inspection-report"],
  "lorry-receipt": ["dispatch-note"],
  "weighbridge-slip": ["lorry-receipt"],
  "e-way-bill": ["delivery-challan"],
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
  "delivery-order": ["out-of-charge"],
  "customs-gate-pass": ["out-of-charge"],

  // Destination warehouse — BUGFIX: goods-receipt-note/warehouse-receipt
  // used to point at each other backwards (warehouse-receipt needed
  // goods-receipt-note to exist first, the reverse of "book storage, then
  // receive goods into it"), inventory-valuation-report needed
  // warehouse-receipt directly (skipping bin-card, even though a
  // valuation report is a stock-ledger summary), and goods-receipt-note
  // needed delivery-order — an import shipping-line release doc, wrong
  // for the domestic road-delivery GRN this simulator's Warehouse &
  // Transport fields are actually built around. Corrected order now
  // matches the PDF scenario's own stated sequence: booking -> receiving
  // -> stock ledger -> valuation.
  "warehouse-receipt": [],
  "goods-receipt-note": ["warehouse-receipt"],
  "bin-card": ["goods-receipt-note"],
  "cycle-count-sheet": ["bin-card"],
  "put-away-slip": ["goods-receipt-note"],
  "damage-report": ["goods-receipt-note"],
  "proof-of-delivery": ["lorry-receipt"],
  "inventory-valuation-report": ["bin-card"],
  "stock-transfer-note": ["bin-card"],

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
// contextKeys that identify an "item row" column (description, HS code,
// quantity, etc.) — shared by the multi-item cascade fix below and by
// skFindDocumentMismatches further down, so both agree on what counts as
// an item table instead of keeping two separate lists in sync by hand.
const SK_ITEM_CONTEXT_KEYS = new Set(["txn.itemDescription","txn.hsCode","txn.itemQuantity","txn.itemUnit","txn.itemUnitPrice","txn.itemWeight","txn.itemProduct","txn.itemProductCode","txn.itemDiscount","txn.itemCountryMfg","txn.itemBrandModel","txn.itemPackageType","txn.itemNetWeight"]);

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
        // BUGFIX: a multi-item document (2+ rows) completed WITHOUT going
        // through the Job Master used to only ever hand its FIRST row's
        // values forward (via the single-value context[col.contextKey]
        // above) — every later row was silently dropped, so the next
        // document's item table only ever got one line, no matter how many
        // items the completed document actually had. This mirrors
        // skGetJobContext's __jobItems (job-engine.js) so the SAME "one row
        // per item, not just item #1" carry-forward applies whether the
        // items came from the Job Master or from a completed document.
        // Job Master data always wins if it's already set (checked first,
        // above, in the loop's earlier iterations) — this only fills the
        // gap when __jobItems was never set at all.
        if(context.__jobItems === undefined && rows.length>1 && (f.columns||[]).some(c=>c.contextKey && SK_ITEM_CONTEXT_KEYS.has(c.contextKey))){
          const itemRows = rows.map(r=>{
            const rowCtx = {};
            let any = false;
            (f.columns||[]).forEach(col=>{
              if(!col.contextKey) return;
              const v = r[col.key];
              if(v===undefined || v===null || v==="") return;
              rowCtx[col.contextKey] = v;
              any = true;
            });
            return any ? rowCtx : null;
          }).filter(Boolean);
          if(itemRows.length>1) context.__jobItems = itemRows;
        }
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
   never overwrites rows a student already started.

   PHASE 13: if context.__jobItems is present (the Job has multiple Item
   rows, see skBuildJobContextFromData in job-engine.js), writes ONE ROW
   PER ITEM instead of a single row — a Job with 3 products fills 3 rows
   into every matching item table, not just the first product. Falls back
   to the single-row behavior when __jobItems isn't there (e.g. context
   built purely from a completed document's table, which still only
   exposes one row's worth of values per contextKey). */
function skApplyContextAutofill(cfg, formData, context){
  if(!cfg || !context) return formData;
  (cfg.steps||[]).forEach(step=>{
    (step.fields||[]).forEach(f=>{
      if(f.type==="table"){
        if(!f.columns || !f.columns.some(c=>c.contextKey)) return; // nothing on this table can be autofilled
        const existing = formData[f.name];
        if(Array.isArray(existing) && existing.length>0) return; // never overwrite rows the student already has
        if(Array.isArray(context.__jobItems) && context.__jobItems.length){
          const rows = context.__jobItems.map(itemCtx=>{
            const row = {};
            let filledAny = false;
            f.columns.forEach(c=>{
              if(c.computed) return;
              row[c.key] = "";
              if(c.contextKey && itemCtx[c.contextKey]!==undefined){
                row[c.key] = itemCtx[c.contextKey];
                filledAny = true;
              }
            });
            return {row, filledAny};
          }).filter(r=>r.filledAny).map(r=>r.row);
          if(rows.length) formData[f.name] = rows;
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
const SK_NUMERIC_CONTEXT_KEYS = new Set(["txn.grossWeight", "txn.noOfPackages", "txn.itemWeight", "txn.itemQuantity", "txn.itemUnitPrice", "txn.itemDiscount"]);

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
          if(!col.contextKey) return;
          const isMultiItem = SK_ITEM_CONTEXT_KEYS.has(col.contextKey) && Array.isArray(context.__jobItems) && context.__jobItems.length>1;
          if(isMultiItem){
            // Multi-item Job Master: compare row i against ITS OWN item
            // (same index) in context.__jobItems, not the single flattened
            // canonical value — a real typo on item #2's HS Code still
            // gets caught, while item #2 legitimately differing from item
            // #1 does NOT get false-flagged.
            formData[f.name].forEach((row,i)=>{
              const val = row[col.key];
              const itemCtx = context.__jobItems[i];
              if(!itemCtx || itemCtx[col.contextKey]===undefined) return; // no matching item at this row (extra/blank row) — nothing to check
              const canonVal = itemCtx[col.contextKey]; // raw value, not a {value,...} wrapper — see skBuildJobContextFromData
              if(val!==undefined && val!==null && val!=="" && !_sk_valuesMatch(col.contextKey, val, canonVal)){
                mismatches.push({contextKey:col.contextKey, label:`${f.label} — ${col.label} (row ${i+1})`, thisValue:val, canonicalValue:canonVal, canonicalSource:"Job Master (this item)"});
              }
            });
            return;
          }
          if(!context[col.contextKey]) return;
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

/* ---------------------------------------------------------------------
   CASCADING CONSEQUENCES — turns a raw mismatch list into "here's what
   this actually costs you in the real world", not just a red flag on a
   field. Each contextKey maps to the real operational/financial/legal
   consequence a mismatch on it typically causes downstream (customs
   query, LC document rejection, carrier rejection, delay/demurrage) —
   this is what a working professional actually cares about, not the
   abstract fact that two fields don't match.
   --------------------------------------------------------------------- */
const CASCADE_CONSEQUENCES = {
  "txn.hsCode": {severity:"high", tag:"Customs Duty / Query",
    consequence:"A wrong HS Code recalculates Customs Duty incorrectly and is one of the most common triggers for a Customs Query or physical examination on the Shipping Bill / Bill of Entry — misdeclaration penalties can apply if it's not corrected before assessment."},
  "txn.itemDescription": {severity:"high", tag:"Goods Description Mismatch",
    consequence:"Goods description differing across the Invoice, Packing List, and transport documents is routinely flagged during customs examination, and can hold the container at the port for physical inspection."},
  "txn.itemQuantity": {severity:"medium", tag:"Quantity Discrepancy",
    consequence:"A quantity mismatch between the Invoice and Packing List raises a short-shipment / over-shipment query at destination customs, and can trigger a payment dispute if the shipment is under a Letter of Credit."},
  "txn.itemWeight": {severity:"medium", tag:"Weight Discrepancy",
    consequence:"Weight not matching the Bill of Lading / Airway Bill can cause the carrier to reject the cargo at check-in, or trigger a chargeable-weight recalculation and a freight cost dispute."},
  "txn.grossWeight": {severity:"medium", tag:"Weight Discrepancy",
    consequence:"Gross weight not matching the transport document is a common carrier-side rejection point at check-in, and can trigger a chargeable-weight recalculation and freight cost dispute."},
  "txn.sellerName": {severity:"high", tag:"LC Document Rejection",
    consequence:"Exporter name not matching exactly across trade documents is a classic Letter of Credit \"discrepancy\" — banks routinely reject the document set for negotiation, delaying payment realization."},
  "txn.buyerName": {severity:"high", tag:"LC Document Rejection",
    consequence:"Importer name not matching exactly across trade documents is a classic Letter of Credit \"discrepancy\" — banks routinely reject the document set for negotiation, delaying payment realization."},
  "txn.currency": {severity:"high", tag:"Payment Reconciliation",
    consequence:"A currency mismatch breaks invoice value reconciliation against the payment received, and can distort GST/RoDTEP claim values calculated off the invoice."},
  "txn.portOfLoading": {severity:"medium", tag:"Routing / BL Validity",
    consequence:"Port of Loading not matching the carrier's actual routing can invalidate the Bill of Lading's routing instructions and cause confusion at transshipment."},
  "txn.portOfDischarge": {severity:"medium", tag:"Routing / BL Validity",
    consequence:"Port of Discharge not matching the carrier's actual routing can misroute the shipment or invalidate the Bill of Lading's routing instructions."},
  "txn.incoterm": {severity:"medium", tag:"Cost/Risk Dispute",
    consequence:"Incoterm mismatch changes who is contractually responsible for freight, insurance, and the point where risk transfers from seller to buyer — a common source of buyer-seller disputes if discovered after shipment."},
  "txn.poNumber": {severity:"low", tag:"Payment Processing Delay",
    consequence:"A PO Number that doesn't match makes it harder for the buyer's accounts team to match the shipment to their purchase order, slowing down payment processing on their end."},
  "txn.hsCodeItem": {severity:"high", tag:"Customs Duty / Query",
    consequence:"A wrong HS Code recalculates Customs Duty incorrectly and is one of the most common triggers for a Customs Query."}
};
function skGetCascadeConsequence(contextKey){
  return CASCADE_CONSEQUENCES[contextKey] || {severity:"low", tag:"Cross-Check Inconsistency",
    consequence:"A minor inconsistency like this can still cause confusion during document cross-checking by customs, the bank, or the buyer's accounts team."};
}
/* Groups a flat mismatch list (from skGetAllCrossDocumentMismatches) into
   cascade chains: one entry per (contextKey + correct value), with every
   document that's carrying the WRONG value underneath it, plus the real
   consequence. Sorted worst-first so the panel leads with what actually
   matters. */
function skGroupMismatchesIntoCascades(mismatches){
  const bySource = {};
  (mismatches||[]).forEach(m=>{
    const groupKey = m.contextKey + "|" + m.canonicalValue;
    if(!bySource[groupKey]){
      bySource[groupKey] = {
        contextKey: m.contextKey,
        label: (m.label||"").split(" — ")[0] || m.label,
        correctValue: m.canonicalValue,
        correctSource: m.canonicalSource,
        affected: []
      };
    }
    bySource[groupKey].affected.push({docTitle: m.docTitle, slug: m.slug, wrongValue: m.thisValue});
  });
  const sevRank = {high:0, medium:1, low:2};
  return Object.values(bySource)
    .map(chain => Object.assign({}, chain, skGetCascadeConsequence(chain.contextKey)))
    .sort((a,b) => (sevRank[a.severity]-sevRank[b.severity]) || (b.affected.length-a.affected.length));
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
