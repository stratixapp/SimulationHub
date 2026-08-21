/* =========================================================================
   PHASE 1 — JOB / SHIPMENT MASTER ENGINE
   =========================================================================
   Adds a central "Logistics Job / Shipment File" entity that becomes the
   source-of-truth transaction context for every document a student fills
   in, sitting ON TOP of the existing document-to-document transaction
   context already built in workflow-rules.js (skGetTransactionContext).

   This file is purely additive:
     - No existing function signature in engine.js / workflow-rules.js /
       documents-data.js changes.
     - Nothing here is required for the pre-Phase-1 simulator (no job
       created) to keep working exactly as it did before — skGetJobContext()
       simply returns {} until a student creates a Job.
     - Everything is scoped per student (localStorage, same pattern as
       skGetAllProgress in auth.js), so lab computers still don't need a
       shared backend for this phase.

   WHAT THIS PHASE DOES NOT DO YET (later phases, per the master prompt):
     - No scenario templates (Phase 5) — the student fills the Job form
       themselves for now.
     - No cross-document mismatch warnings (Phase 3) — if a student edits a
       job-sourced value inside a document, that correction is NOT currently
       propagated back into the shared Job Master or flagged as a mismatch.
       This is a deliberate Phase-1 simplification: the Job Master is the
       single source of truth and documents consume/verify it, they don't
       yet feed corrections back upstream. Flagging for domain review before
       Phase 3, as instructed.
     - No scoring/audit/instructor dashboard hooks (Phases 6/7).
   ========================================================================= */

const SKELORA_JOB_PREFIX = "skelora_job_v1_";
const SKELORA_JOB_SEQ_PREFIX = "skelora_job_seq_v1_";

/* Every field the Job Master captures. `contextKey` ties a field to the
   SAME txn.* namespace already used by 458 field definitions across the
   built documents (see workflow-rules.js's transaction context) — so a
   Job's Exporter Name, for example, autofills into every document whose
   own field already declares contextKey:"txn.sellerName", with zero changes
   needed to documents-data.js. Fields with contextKey:null (mode, cargo
   description, invoice value, and the two Bank reference fields below)
   aren't part of that namespace; they're captured for the Job record and
   the Job strip UI, but don't propagate into a document field anywhere.
   `section` groups fields for the Job form UI (skJobFormSectionsHTML). */
/* Port & vessel reference data for the searchable dropdowns on the Job
   Master form (Port of Loading, Port of Discharge, Vessel Name). Each
   port carries a "sea" or "air" type so the dropdown can automatically
   show the right kind of port for the selected Shipment Mode (Sea
   Export/Import -> seaports, Air Export/Import -> airports) without
   needing a separate "port type" field of its own. */
const INDIA_LOADING_PORTS = [
  {name:"Nhava Sheva (JNPT), Mumbai", type:"sea"},
  {name:"Mumbai Port", type:"sea"},
  {name:"Mundra Port, Gujarat", type:"sea"},
  {name:"Kandla Port (Deendayal), Gujarat", type:"sea"},
  {name:"Chennai Port, Tamil Nadu", type:"sea"},
  {name:"Ennore Port (Kamarajar), Tamil Nadu", type:"sea"},
  {name:"Tuticorin Port (V.O. Chidambaranar), Tamil Nadu", type:"sea"},
  {name:"Cochin Port (Kochi), Kerala", type:"sea"},
  {name:"Visakhapatnam Port, Andhra Pradesh", type:"sea"},
  {name:"Krishnapatnam Port, Andhra Pradesh", type:"sea"},
  {name:"Kolkata Port (Haldia), West Bengal", type:"sea"},
  {name:"Paradip Port, Odisha", type:"sea"},
  {name:"New Mangalore Port, Karnataka", type:"sea"},
  {name:"Mumbai (BOM) Airport", type:"air"},
  {name:"Delhi (DEL) Airport", type:"air"},
  {name:"Chennai (MAA) Airport", type:"air"},
  {name:"Bengaluru (BLR) Airport", type:"air"},
  {name:"Kochi (COK) Airport", type:"air"},
  {name:"Hyderabad (HYD) Airport", type:"air"},
  {name:"Ahmedabad (AMD) Airport", type:"air"},
  {name:"Kolkata (CCU) Airport", type:"air"}
];
const DISCHARGE_PORTS_BY_COUNTRY = {
  "UAE": [
    {name:"Jebel Ali Port, Dubai", type:"sea"}, {name:"Port Rashid, Dubai", type:"sea"},
    {name:"Khalifa Port, Abu Dhabi", type:"sea"}, {name:"Port Khalid, Sharjah", type:"sea"},
    {name:"Dubai (DXB) Airport", type:"air"}, {name:"Abu Dhabi (AUH) Airport", type:"air"}
  ],
  "Sri Lanka": [
    {name:"Port of Colombo", type:"sea"}, {name:"Hambantota Port", type:"sea"},
    {name:"Colombo (CMB) Airport", type:"air"}
  ],
  "Singapore": [
    {name:"Port of Singapore (PSA)", type:"sea"}, {name:"Jurong Port", type:"sea"},
    {name:"Singapore Changi (SIN) Airport", type:"air"}
  ],
  "China": [
    {name:"Port of Shanghai", type:"sea"}, {name:"Port of Shenzhen", type:"sea"},
    {name:"Ningbo-Zhoushan Port", type:"sea"}, {name:"Port of Guangzhou", type:"sea"},
    {name:"Port of Qingdao", type:"sea"}, {name:"Port of Tianjin", type:"sea"},
    {name:"Shanghai Pudong (PVG) Airport", type:"air"}, {name:"Guangzhou (CAN) Airport", type:"air"}
  ],
  "USA": [
    {name:"Port of Los Angeles", type:"sea"}, {name:"Port of Long Beach", type:"sea"},
    {name:"Port of New York/New Jersey", type:"sea"}, {name:"Port of Savannah", type:"sea"},
    {name:"Port of Houston", type:"sea"}, {name:"Port of Oakland", type:"sea"},
    {name:"New York (JFK) Airport", type:"air"}, {name:"Los Angeles (LAX) Airport", type:"air"}
  ],
  "Egypt": [
    {name:"Port Said", type:"sea"}, {name:"Port of Alexandria", type:"sea"},
    {name:"Damietta Port", type:"sea"}, {name:"Cairo (CAI) Airport", type:"air"}
  ],
  "Germany": [
    {name:"Port of Hamburg", type:"sea"}, {name:"Port of Bremerhaven", type:"sea"},
    {name:"Frankfurt (FRA) Airport", type:"air"}
  ],
  "UK": [
    {name:"Port of Felixstowe", type:"sea"}, {name:"Port of Southampton", type:"sea"},
    {name:"Port of London Tilbury", type:"sea"}, {name:"London Heathrow (LHR) Airport", type:"air"}
  ],
  "France": [
    {name:"Port of Le Havre", type:"sea"}, {name:"Port of Marseille-Fos", type:"sea"},
    {name:"Paris Charles de Gaulle (CDG) Airport", type:"air"}
  ],
  "Spain": [
    {name:"Port of Valencia", type:"sea"}, {name:"Port of Barcelona", type:"sea"},
    {name:"Port of Algeciras", type:"sea"}, {name:"Madrid-Barajas (MAD) Airport", type:"air"}
  ],
  "Argentina": [
    {name:"Port of Buenos Aires", type:"sea"}, {name:"Port of Rosario", type:"sea"},
    {name:"Buenos Aires Ezeiza (EZE) Airport", type:"air"}
  ],
  "Brazil": [
    {name:"Port of Santos", type:"sea"}, {name:"Port of Rio de Janeiro", type:"sea"},
    {name:"Port of Paranaguá", type:"sea"}, {name:"São Paulo Guarulhos (GRU) Airport", type:"air"}
  ]
};
const DISCHARGE_COUNTRIES = Object.keys(DISCHARGE_PORTS_BY_COUNTRY);
const VESSEL_NAMES = [
  "MV Kota Ratna", "MSC Aria", "MSC Anna", "MSC Gülsün", "Maersk Denver", "Maersk Sentosa",
  "Maersk Edinburgh", "CMA CGM Marco Polo", "CMA CGM Antoine de Saint Exupéry",
  "COSCO Shipping Universe", "Ever Given", "Ever Ace", "Hapag-Lloyd Berlin Express",
  "ONE Innovation", "NYK Constellation", "OOCL Hong Kong", "Yang Ming Wellhead",
  "HMM Algeciras", "APL Temasek", "Wan Hai 307"
];

const JOB_FIELD_MAP = [
  // — Shipment —
  {key:"mode",            label:"Shipment Mode",                contextKey:null,  section:"Shipment", required:true,
    type:"select", options:["Sea Export","Sea Import","Air Export","Air Import","Road / Domestic","Warehouse Transfer"]},
  {key:"origin",          label:"Origin",                        contextKey:null,             type:"text", placeholder:"Cochin, India", section:"Shipment", required:true},
  {key:"destination",     label:"Destination",                   contextKey:null,             type:"text", placeholder:"Dubai, UAE", section:"Shipment", required:true},

  // NOTE: the single item/product fields that used to live here (cargo,
  // hsCode, itemQuantity, itemUnit, itemUnitPrice) are now a repeatable
  // "Items" list instead of one fixed row — see JOB_ITEM_FIELDS below and
  // skJobItemsHTML() in the dashboard. A Job's `fields.items` array
  // replaces the old flat cargo/hsCode/itemQuantity/itemUnit/itemUnitPrice
  // keys; skBuildJobContextFromData reads items[0] for the existing
  // single-value txn.* keys (so every document field that only has room
  // for one item still works exactly as before) and ALSO exposes the full
  // items array so skApplyContextAutofill can pre-fill one TABLE ROW PER
  // ITEM on documents with a proper line-item table.

  // — Exporter / Seller —
  {key:"sellerName",      label:"Exporter / Seller",             contextKey:"txn.sellerName", type:"text", placeholder:"Meridian Exports Pvt. Ltd.", section:"Exporter (Seller)", required:true},
  {key:"sellerAddress",   label:"Exporter Address",              contextKey:"txn.sellerAddress", type:"text", placeholder:"Plot 14, MIDC Industrial Area, Pune", section:"Exporter (Seller)", required:true},
  {key:"sellerGSTIN",     label:"Exporter GSTIN",                contextKey:"txn.sellerGSTIN", type:"text", placeholder:"27ABCDE1234F1Z5", section:"Exporter (Seller)"},
  {key:"sellerIEC",       label:"Exporter IEC Code",             contextKey:"txn.sellerIEC",  type:"text", placeholder:"0388012345", section:"Exporter (Seller)"},
  {key:"sellerPhone",     label:"Exporter Phone",                contextKey:"txn.sellerPhone", type:"text", placeholder:"+91 98200 12345", section:"Exporter (Seller)", help:"Auto-fills the Shipper/Exporter/Beneficiary phone field on documents that ask for one."},
  {key:"sellerEmail",     label:"Exporter Email",                contextKey:"txn.sellerEmail", type:"text", placeholder:"exports@meridian.co.in", section:"Exporter (Seller)", help:"Auto-fills the Shipper/Exporter/Beneficiary email field on documents that ask for one."},
  {key:"authorizedSignatory", label:"Authorized Signatory Name", contextKey:"txn.authorizedSignatory", type:"text", placeholder:"Priya Sharma", section:"Exporter (Seller)", required:true, help:"The person who signs and certifies documents on the exporter's behalf. Auto-fills the Signatory Name field on the Commercial Invoice, Packing List and other documents that ask for one."},

  // — Importer / Buyer —
  {key:"buyerName",       label:"Importer / Buyer",              contextKey:"txn.buyerName",  type:"text", placeholder:"Nordic Trading GmbH", section:"Importer (Buyer)", required:true},
  {key:"buyerAddress",    label:"Importer Address",              contextKey:"txn.buyerAddress", type:"text", placeholder:"Hafenstrasse 22, 20457 Hamburg", section:"Importer (Buyer)", required:true},
  {key:"buyerGSTIN",      label:"Importer GSTIN (if applicable)", contextKey:"txn.buyerGSTIN", type:"text", placeholder:"07XYZAB5678G1Z2", section:"Importer (Buyer)"},
  {key:"buyerPhone",      label:"Importer Phone",                contextKey:"txn.buyerPhone", type:"text", placeholder:"+49 40 3312 0098", section:"Importer (Buyer)", help:"Auto-fills the Buyer/Consignee/Applicant phone field on documents that ask for one."},
  {key:"buyerEmail",      label:"Importer Email",                contextKey:"txn.buyerEmail", type:"text", placeholder:"procurement@nordictrading.de", section:"Importer (Buyer)", help:"Auto-fills the Buyer/Consignee/Applicant email field on documents that ask for one."},

  // — Bank Details — bankName is the only one of these three that
  // currently matches a real document field (the ICEGATE AD Code
  // Registration form) — the other two are genuinely used by OTHER
  // parties' banks elsewhere (a carrier's or airline's own bank on their
  // freight invoices), so auto-filling them with the exporter's bank
  // would be factually wrong on those documents. Captured for the Job
  // record either way; contextKey:null on these two is deliberate, not
  // an oversight.
  {key:"bankName",        label:"Bank Name",                     contextKey:"txn.bankName",   type:"text", placeholder:"HDFC Bank", section:"Bank Details"},
  {key:"bankAccountNo",   label:"Bank Account Number",           contextKey:null,             type:"text", placeholder:"50100123456789", section:"Bank Details", help:"Reference only — not currently linked to a specific document field, since account numbers on other documents (e.g. a carrier's freight invoice) belong to a different party's bank."},
  {key:"bankIfscCode",    label:"Bank IFSC Code",                contextKey:null,             type:"text", placeholder:"HDFC0001234", section:"Bank Details", help:"Reference only — same reason as Account Number above."},

  // — Order & Cargo —
  {key:"poNumber",        label:"Purchase Order / Order Ref. No.", contextKey:"txn.poNumber",  type:"text", placeholder:"PO-88213", help:"The buyer's order reference. Auto-fills the PO Number field wherever a document asks for it (Commercial Invoice, Certificate of Origin, GRN, Bank Guarantee and others) — a Proforma Invoice itself has no PO field, since it's the quotation that comes BEFORE an order exists.", section:"Order & Cargo", required:true},
  {key:"quantity",        label:"Quantity (packages)",           contextKey:"txn.noOfPackages", type:"number", placeholder:"500", section:"Order & Cargo", required:true},
  {key:"grossWeight",     label:"Gross Weight (KG)",             contextKey:"txn.grossWeight", type:"number", placeholder:"8500", section:"Order & Cargo", required:true},
  {key:"invoiceValue",    label:"Invoice Value",                 contextKey:null,             type:"number", placeholder:"40000", section:"Order & Cargo", required:true},
  {key:"currency",        label:"Currency",                      contextKey:"txn.currency",   type:"select", options:["USD","EUR","INR","AED"], section:"Order & Cargo", required:true},
  {key:"paymentTerms",    label:"Payment Terms",                 contextKey:null,             type:"select", options:["Advance Payment","Letter of Credit (L/C)","Documents Against Payment (D/P)","Documents Against Acceptance (D/A)","Open Account / Credit Terms"], section:"Order & Cargo", help:"Reference only — captured for the Job record; not currently linked to a specific document field."},
  {key:"expectedShipDate", label:"Expected Shipment Date",       contextKey:null,             type:"date", section:"Order & Cargo", help:"Reference only — captured for the Job record; not currently linked to a specific document field."},

  // — Transport —
  {key:"incoterm",        label:"Incoterm",                      contextKey:"txn.incoterm",   type:"select", options:["EXW","FCA","FOB","CFR","CIF","CPT","CIP","DAP","DPU","DDP"], section:"Transport", required:true},
  {key:"portOfLoading",   label:"Port / Airport of Loading",     contextKey:"txn.portOfLoading", type:"datalist", datalistId:"jobPortsLoading", placeholder:"Type to search Indian ports/airports…", section:"Transport", help:"Pulled from India's major seaports and airports — matches the type (sea/air) of the Shipment Mode above. You can also type your own if it's not on the list."},
  {key:"portOfDischargeCountry", label:"Discharge Country",      contextKey:null, type:"select", options:DISCHARGE_COUNTRIES, section:"Transport", help:"Pick the country first — the Port/Airport of Discharge list below narrows to that country's ports."},
  {key:"portOfDischarge", label:"Port / Airport of Discharge",   contextKey:"txn.portOfDischarge", type:"datalist", datalistId:"jobPortsDischarge", placeholder:"Pick a Discharge Country first…", section:"Transport"},
  {key:"containerNo",     label:"Container Number",              contextKey:"txn.containerNo", type:"text", placeholder:"MSKU1234567 (optional)", section:"Transport"},
  {key:"vesselName",      label:"Vessel / Flight Name",          contextKey:"txn.vesselName", type:"datalist", datalistId:"jobVesselNames", placeholder:"Type to search vessel names…", section:"Transport", help:"A curated list of real container-vessel names to pick from — or type your own."},
  {key:"voyageNo",        label:"Voyage / Flight No.",           contextKey:"txn.voyageNo",   type:"text", placeholder:"V.221E", section:"Transport"},
  {key:"carrierName",     label:"Carrier Name",                  contextKey:"txn.carrierName", type:"text", placeholder:"Maersk Line", section:"Transport"},
  {key:"vehicleNumber",   label:"Vehicle Number (Road)",         contextKey:"txn.vehicleNumber", type:"text", placeholder:"KL-07-AB-1234", section:"Transport"},
  {key:"sealNo",          label:"Seal Number",                   contextKey:"txn.sealNo",     type:"text", placeholder:"SL-994231", section:"Transport"},
  {key:"cfsTerminalName", label:"CFS / Terminal Name",           contextKey:"txn.terminalName", type:"text", placeholder:"Balmer Lawrie CFS, JNPT", section:"Transport", help:"Auto-fills the Terminal Name field on the CFS Gate Pass and similar terminal-facing documents."}
];

/* The repeatable "Items" list — Product Name and Product Description are
   deliberately two separate boxes (not one combined field). Only
   `description` carries a contextKey today (matching the "Description of
   Goods" column every item table already has); `product` is a short name
   captured for the Job record, since no document currently has a matching
   short-name column of its own. quantity/unit/unitPrice/hsCode keep the
   SAME contextKeys the old flat fields used, so nothing downstream changes
   — only how the student enters them (a list instead of one fixed row). */
const JOB_ITEM_FIELDS = [
  {key:"product",     label:"Product Name",        contextKey:null,                type:"text", placeholder:"Cotton T-Shirts", required:true},
  {key:"description", label:"Product Description", contextKey:"txn.itemDescription", type:"text", placeholder:"Men's crew-neck cotton T-shirts, assorted colours", required:true},
  {key:"hsCode",      label:"HSN / HS Code",        contextKey:"txn.hsCode",        type:"text", placeholder:"6109.10.00", required:true},
  {key:"quantity",    label:"Quantity",             contextKey:"txn.itemQuantity",  type:"number", placeholder:"5000", required:true},
  {key:"unit",        label:"Unit",                 contextKey:"txn.itemUnit",      type:"select", options:["PCS","SET","KG","MT","DZN","CTN","BOX","LTR","SQM","PAIR"], required:true},
  {key:"unitPrice",   label:"Unit Price",           contextKey:"txn.itemUnitPrice", type:"number", placeholder:"8.50", required:true},
  {key:"weight",      label:"Weight (KG)",          contextKey:"txn.itemWeight",    type:"number", placeholder:"210.00"}
];
function skBlankJobItem(){
  const row = {};
  JOB_ITEM_FIELDS.forEach(f=> row[f.key] = "");
  return row;
}

/* A Job saved before this multi-item rework has no job.fields.items at
   all — just the old flat cargo/hsCode/itemQuantity/itemUnit/itemUnitPrice
   keys directly on job.fields. Without this, a returning student's
   existing Job would silently stop auto-filling its item into documents,
   and the Edit Shipment Lot modal would show an empty Items list even
   though their product data is still sitting right there. Synthesizes a
   single legacy item row from those old fields so both paths keep working
   exactly as before; returns [] if there's genuinely no item data either way. */
function skJobItemsWithLegacyFallback(fields){
  if(!fields) return [];
  if(Array.isArray(fields.items) && fields.items.some(it=> it && (it.description || it.product || it.hsCode))){
    return fields.items;
  }
  const legacy = {
    product: "", description: fields.cargo || "", hsCode: fields.hsCode || "",
    quantity: fields.itemQuantity || "", unit: fields.itemUnit || "", unitPrice: fields.itemUnitPrice || ""
  };
  if(legacy.description || legacy.hsCode || legacy.quantity){
    return [legacy];
  }
  return Array.isArray(fields.items) ? fields.items : [];
}

function _sk_jobKey(userId){ return SKELORA_JOB_PREFIX + userId; }
function _sk_jobSeqKey(userId){ return SKELORA_JOB_SEQ_PREFIX + userId; }

/* SKL-YYYY-NNNNN, sequential per student, never reused even if a job is
   later closed — matches the master prompt's example format exactly. */
function skGenerateJobId(userId){
  let n = 1;
  try{
    n = parseInt(localStorage.getItem(_sk_jobSeqKey(userId)) || "0", 10) + 1;
    localStorage.setItem(_sk_jobSeqKey(userId), String(n));
  }catch(e){ /* localStorage unavailable — fall back to n=1, non-fatal */ }
  const year = new Date().getFullYear();
  return `SKL-${year}-${String(n).padStart(5,"0")}`;
}

function skGetActiveJob(userId){
  if(!userId) return null;
  try{
    const raw = localStorage.getItem(_sk_jobKey(userId));
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

/* PHASE 9: a Job now also carries its OWN document scope — docSlugs, the
   list of exercises the student themselves picked when creating this Job
   (distinct from an assignment's docSlugs, which is faculty-authored and
   shared computer-wide). skIsDocumentAllowedForJob() below checks both:
   assignment scope wins if the Job is following one, otherwise the Job's
   own docSlugs governs, otherwise (neither set — a legacy job, or one
   genuinely started with no scope) everything stays open as before. */

/* Walks the PREREQUISITES chain (workflow-rules.js) and returns `slugs`
   plus every direct/transitive prerequisite those slugs need — so a
   student can never select a document whose dependencies aren't also in
   scope (which would otherwise lock that document forever inside this
   Job, since skCheckPrerequisites and the Job's own doc-scope would then
   permanently disagree). Returns {expanded, added} so callers can tell
   the student which extra documents were pulled in automatically. */
function skExpandDocSlugsWithPrerequisites(slugs){
  const result = new Set((slugs||[]).filter(Boolean));
  const originalSize = result.size;
  let changed = true;
  while(changed){
    changed = false;
    Array.from(result).forEach(slug=>{
      const prereqs = (typeof skGetPrerequisites === "function") ? skGetPrerequisites(slug) : [];
      prereqs.forEach(p=>{ if(!result.has(p)){ result.add(p); changed = true; } });
    });
  }
  const expanded = Array.from(result);
  return {expanded, added: expanded.length - originalSize};
}

/* Creates a new Job and makes it the active one for this student. Only one
   active job at a time — starting a new job replaces it (the dashboard UI
   confirms with the student first if the current job has any fields
   filled in, see skelora-institute-dashboard.html). docSlugs is the
   student's own document selection for this Job (already expanded with
   prerequisites by the caller); an assignment's docSlugs (if any) takes
   precedence over it wherever scope is checked. */
function skCreateJob(userId, fields, assignmentId, docSlugs, autofillTier, autoAddedSlugs){
  if(!userId) return null;
  const job = {
    jobId: skGenerateJobId(userId),
    createdAt: new Date().toISOString(),
    status: "in-progress",
    fields: Object.assign({}, fields),
    assignmentId: assignmentId || null,
    docSlugs: Array.isArray(docSlugs) ? docSlugs.slice() : [],
    autofillTier: (autofillTier==="half"||autofillTier==="full") ? autofillTier : "basic",
    autoAddedSlugs: Array.isArray(autoAddedSlugs) ? autoAddedSlugs.slice() : []
  };
  try{ localStorage.setItem(_sk_jobKey(userId), JSON.stringify(job)); }catch(e){}
  return job;
}

function skUpdateJobFields(userId, patch){
  const job = skGetActiveJob(userId);
  if(!job) return null;
  job.fields = Object.assign({}, job.fields, patch);
  try{ localStorage.setItem(_sk_jobKey(userId), JSON.stringify(job)); }catch(e){}
  return job;
}

/* Changes which documents THIS Job's own scope covers (used by "Edit Job
   Details"). Has no effect on an assignment's scope, if the Job is
   following one — that's changed separately via skSetJobAssignment.
   autoAddedSlugs (optional) records which of docSlugs were pulled in by
   the "Auto-add prerequisite documents" toggle rather than hand-picked,
   so the Document Library can show a persistent "Auto-added" badge on
   them instead of relying on the one-time save-time toast alone. */
function skUpdateJobDocSlugs(userId, docSlugs, autoAddedSlugs){
  const job = skGetActiveJob(userId);
  if(!job) return null;
  job.docSlugs = Array.isArray(docSlugs) ? docSlugs.slice() : [];
  job.autoAddedSlugs = Array.isArray(autoAddedSlugs) ? autoAddedSlugs.slice() : [];
  try{ localStorage.setItem(_sk_jobKey(userId), JSON.stringify(job)); }catch(e){}
  return job;
}

/* Sets which of the 3 autofill tiers this Job uses — "basic" (A),
   "half" (B), or "full" (C). See JOB_MASTER_AUTOFILL_KEYS /
   JOB_AUTOFILL_HALF_KEYS above for exactly what each tier includes
   (the Items list is always-on regardless of tier — see
   skBuildJobContextFromData below). */
function skUpdateJobAutofillMode(userId, autofillTier){
  const job = skGetActiveJob(userId);
  if(!job) return null;
  job.autofillTier = (autofillTier==="half"||autofillTier==="full") ? autofillTier : "basic";
  delete job.fullAutofill; // fully migrated off the old boolean now that this job has been touched
  try{ localStorage.setItem(_sk_jobKey(userId), JSON.stringify(job)); }catch(e){}
  return job;
}

/* Attach/change/clear which assignment the active job is following.
   Pass null to unlink (job goes back to unrestricted). */
function skSetJobAssignment(userId, assignmentId){
  const job = skGetActiveJob(userId);
  if(!job) return null;
  job.assignmentId = assignmentId || null;
  try{ localStorage.setItem(_sk_jobKey(userId), JSON.stringify(job)); }catch(e){}
  return job;
}

function skCloseJob(userId){
  const job = skGetActiveJob(userId);
  if(!job) return null;
  job.status = "closed";
  job.closedAt = new Date().toISOString();
  try{ localStorage.setItem(_sk_jobKey(userId), JSON.stringify(job)); }catch(e){}
  return job;
}

/* Clears the active job slot entirely (used before starting a fresh one). */
function skDeleteActiveJob(userId){
  try{ localStorage.removeItem(_sk_jobKey(userId)); }catch(e){}
}

/* =========================================================================
   PHASE 9 — JOB HISTORY / "SCENARIOS COMPLETED"
   =========================================================================
   Before Phase 9, closing a Job just flipped its status in the SAME single
   active-job slot — the moment a new Job was created, that old record was
   silently overwritten and gone for good. There was no way to answer "how
   many scenarios has this student finished?" at all. This section adds a
   real, append-only history, per student, of every Job that has ever been
   finished (completed in full, or closed early) — same storage pattern as
   the audit log in auth.js. ========================================================================= */
const SKELORA_JOB_HISTORY_PREFIX = "skelora_job_history_v1_";
function _sk_jobHistoryKey(userId){ return SKELORA_JOB_HISTORY_PREFIX + userId; }

function skGetJobHistory(userId){
  try{
    const raw = localStorage.getItem(_sk_jobHistoryKey(userId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  }catch(e){ return []; }
}
function _sk_saveJobHistory(userId, list){
  const capped = list.length > 200 ? list.slice(list.length - 200) : list;
  try{ localStorage.setItem(_sk_jobHistoryKey(userId), JSON.stringify(capped)); }catch(e){}
}

/* The document scope THIS job is actually measured against: an assignment
   (if it's following one) takes precedence, otherwise the job's own
   self-selected docSlugs. A job with neither has no measurable scope
   (returns []) — same "unrestricted, nothing to complete" case as
   skIsDocumentAllowedForJob below. */
function skGetJobDocScope(job){
  if(!job) return [];
  if(job.assignmentId){
    const assignment = (typeof skGetAssignment === "function") ? skGetAssignment(job.assignmentId) : null;
    if(assignment) return assignment.docSlugs.slice();
  }
  return Array.isArray(job.docSlugs) ? job.docSlugs.slice() : [];
}

/* PHASE 9c BUGFIX: the set of documents this Job can actually REACH —
   skGetJobDocScope() plus every one of THEIR prerequisites, transitively,
   computed live rather than stored. This exists because "Auto-add
   prerequisites" (the toggle in the Job doc-picker) being OFF means the
   Job's own docSlugs can legitimately be missing a real prerequisite —
   e.g. picking VGM Certificate + Insurance Certificate + Shipping
   Instructions without Booking Confirmation / Commercial Invoice / Sales
   Order / Proforma Invoice also selected. Before this function existed,
   skIsDocumentAllowedForJob() checked docSlugs membership ALONE — so those
   missing prerequisites were locked as "not part of this Shipment Lot",
   while the originally-picked documents were ALSO locked by their own
   normal "complete this first" prerequisite check. Neither could ever be
   opened: a permanent dead end with no document reachable at all, exactly
   what the OFF-mode gap warning at save time tries to flag in advance —
   but a student clicking "create anyway" still hit it. skIsDocumentAllowedForJob
   and the guided workflow (skTopologicalOrderDocs / skGetNextJobDocument)
   both use THIS reachable scope now, so a prerequisite is always openable
   the moment it's actually needed — without being force-added to the
   Job's own docSlugs, so it still doesn't count toward "X of Y documents
   finished in this Job" (skGetJobScopeProgress, below, deliberately keeps
   using the narrower skGetJobDocScope for that count — completing a
   detour prerequisite isn't itself a documents the student set out to do). */
function skGetJobReachableScope(job){
  const scope = skGetJobDocScope(job);
  if(scope.length === 0) return [];
  return (typeof skExpandDocSlugsWithPrerequisites === "function")
    ? skExpandDocSlugsWithPrerequisites(scope).expanded
    : scope;
}

/* {completed, total, done} against this job's own scope, reading this
   student's real progress store — done is true only once every document
   in scope has status "completed". A job with no scope (total:0) is never
   "done" this way; it just isn't tracked as a scenario. Deliberately uses
   skGetJobDocScope (the student's own picks), NOT skGetJobReachableScope —
   see the note on that function for why. */
function skGetJobScopeProgress(userId, job){
  const scope = skGetJobDocScope(job);
  if(scope.length === 0) return {completed: 0, total: 0, done: false};
  const all = (typeof skGetAllProgress === "function") ? skGetAllProgress(userId) : {};
  const completed = scope.filter(slug => all[slug] && all[slug].status === "completed").length;
  return {completed, total: scope.length, done: completed === scope.length};
}

/* =========================================================================
   PHASE 9b — GUIDED JOB WORKFLOW (work through a Job's documents in order)
   ========================================================================= */

/* Orders `slugs` so every document's prerequisites (per workflow-rules.js's
   DOC_PREREQUISITES chain) come before it — a plain topological sort
   (DFS-based). Callers now pass skGetJobReachableScope(job) (already
   expanded with prerequisites), not the raw docScope, so this ordering is
   always completable top-to-bottom without ever hitting a document still
   locked by an unmet prerequisite — regardless of whether the student's
   own picks included those prerequisites or not. Slugs outside `slugs`
   (or ones skGetPrerequisites doesn't know about) are simply not chased
   further. */
function skTopologicalOrderDocs(slugs){
  const inScope = new Set(slugs || []);
  const visited = new Set();
  const order = [];
  function visit(slug){
    if(visited.has(slug) || !inScope.has(slug)) return;
    visited.add(slug);
    const prereqs = (typeof skGetPrerequisites === "function") ? skGetPrerequisites(slug) : [];
    prereqs.forEach(visit);
    order.push(slug);
  }
  (slugs || []).forEach(visit);
  return order;
}

/* The next document the student should work on for their active Job — in
   prerequisite-safe order, skipping anything already completed. Walks the
   REACHABLE scope (docScope + prerequisites, see skGetJobReachableScope)
   so a detour prerequisite the student didn't explicitly pick still gets
   surfaced and worked through automatically, same as a document they did
   pick — the guided flow never stalls on something reachable-but-not-
   selected. Returns null once every reachable document is done (or if the
   Job has no scope at all). This is what powers both the dashboard's
   "Start Working" button and the auto-advance prompt on each document's
   completion screen (see engine.js renderComplete()). */
function skGetNextJobDocument(userId, job){
  const scope = skGetJobReachableScope(job);
  if(scope.length === 0) return null;
  const ordered = skTopologicalOrderDocs(scope);
  const all = (typeof skGetAllProgress === "function") ? skGetAllProgress(userId) : {};
  return ordered.find(slug => !(all[slug] && all[slug].status === "completed")) || null;
}

/* Archives the active Job into this student's Job History and clears the
   active slot so a new Job can start clean. Marks it "completed" if every
   document in scope is done, otherwise "closed" (an early/manual close,
   e.g. via the dashboard's "Close This Job" button) — only "completed"
   entries count toward the "Scenarios Completed" stat. Does NOT touch any
   completed document or its saved progress — only the Job record itself
   moves into history. Returns the archived record, or null if there was
   no active job. */
function skFinishJob(userId){
  const job = skGetActiveJob(userId);
  if(!job) return null;
  const scopeProgress = skGetJobScopeProgress(userId, job);
  const finished = Object.assign({}, job, {
    status: scopeProgress.done ? "completed" : "closed",
    finishedAt: new Date().toISOString(),
    docSlugs: skGetJobDocScope(job),
    documentsCompleted: scopeProgress.completed,
    documentsTotal: scopeProgress.total
  });
  const history = skGetJobHistory(userId);
  history.push(finished);
  _sk_saveJobHistory(userId, history);
  skDeleteActiveJob(userId);
  return finished;
}

/* Merges an imported Job History array (from another lab computer's "My
   Progress" export) into this student's own history — deduped by jobId,
   so re-importing the same file twice (or importing after already having
   some local history) never double-counts a scenario. Same shape/pattern
   as skMergeAuditLog in auth.js. Returns how many NEW entries were added. */
function skMergeJobHistory(userId, importedHistory){
  if(!userId || !Array.isArray(importedHistory) || importedHistory.length===0) return 0;
  const existing = skGetJobHistory(userId);
  const seen = new Set(existing.map(j => j.jobId));
  let added = 0;
  importedHistory.forEach(j=>{
    if(!j || !j.jobId || seen.has(j.jobId)) return;
    seen.add(j.jobId);
    existing.push(j);
    added++;
  });
  existing.sort((a,b) => new Date(a.finishedAt||a.createdAt) - new Date(b.finishedAt||b.createdAt));
  _sk_saveJobHistory(userId, existing);
  return added;
}

/* Restores a Job object exactly as exported from another lab computer's
   "My Progress" file — used when a student switches computers mid-
   semester. Also bumps this computer's Job ID sequence counter past the
   imported job's number if needed, so the NEXT Job this student creates
   here can't collide with one they already made elsewhere (e.g. importing
   SKL-2026-00003 on a computer whose local counter is still at 1). */
function skRestoreJob(userId, job){
  if(!userId || !job || !job.jobId) return null;
  try{
    localStorage.setItem(_sk_jobKey(userId), JSON.stringify(job));
    const m = /-(\d+)$/.exec(job.jobId);
    if(m){
      const importedN = parseInt(m[1], 10);
      const currentN = parseInt(localStorage.getItem(_sk_jobSeqKey(userId)) || "0", 10);
      if(importedN > currentN) localStorage.setItem(_sk_jobSeqKey(userId), String(importedN));
    }
  }catch(e){}
  return job;
}

/* PHASE 9: by default, only these Job Master fields are allowed to
   silently pre-fill a fresh document — the exporter/importer's basic
/* PHASE 12: replaced the old single ON/OFF "fullAutofill" toggle with 3
   tiers (job.autofillTier: "basic" | "half" | "full") plus a 4th category
   that ALWAYS propagates no matter what tier is picked. Old jobs saved
   before this phase only have job.fullAutofill (boolean) - see the
   fallback in skBuildJobContextFromData below, so they keep working
   without needing a migration step.
   - ALWAYS: item/goods identity (description, HSN code, quantity, unit,
     unit price) - the user explicitly needs these to flow into every
     selected document's item table regardless of tier, since re-typing
     the same HSN code into 10 different documents is exactly the
     repetitive busywork autofill exists to remove.
   - A / "basic": just Exporter/Importer name + address + signatory.
   - B / "half": basic + the trade-essential identifiers a student would
     want without yet wanting every operational/logistics field.
   - C / "full": everything JOB_FIELD_MAP defines a contextKey for. */
const JOB_MASTER_AUTOFILL_KEYS = ["sellerName", "sellerAddress", "buyerName", "buyerAddress", "authorizedSignatory"];
const JOB_AUTOFILL_HALF_KEYS = JOB_MASTER_AUTOFILL_KEYS.concat([
  "sellerGSTIN", "sellerIEC", "sellerPhone", "sellerEmail",
  "buyerGSTIN", "buyerPhone", "buyerEmail",
  "poNumber", "currency", "incoterm",
  "portOfLoading", "portOfDischarge", "quantity", "grossWeight"
]);

/* Returns the Job Master's fields as a transaction-context map, in the
   EXACT {contextKey: {value, sourceSlug, sourceTitle}} shape that
   skGetTransactionContext() in workflow-rules.js builds from completed
   documents — so the two merge with a single Object.assign, no new
   plumbing needed in engine.js. sourceSlug is a synthetic "job-master"
   (not a real document slug) purely for provenance if ever displayed. */
function skGetJobContext(userId){
  return skBuildJobContextFromData(skGetActiveJob(userId));
}

/* Same job-context logic as skGetJobContext, but takes a Job object
   directly instead of reading localStorage via userId — needed so the
   Phase 7 instructor dashboard can score an imported student's Job (from
   another lab computer's export file, see skExportComputerData). */
function skBuildJobContextFromData(job){
  const context = {};
  if(!job || job.status !== "in-progress") return context;
  // Backward compatible: a job saved before Phase 12 only has the old
  // boolean job.fullAutofill (true meant everything, false/undefined
  // meant basic-only) - map that onto the new 3-tier system once.
  const tier = job.autofillTier || (job.fullAutofill ? "full" : "basic");
  const allowedKeys = tier==="full" ? null /* null = no filter, everything with a contextKey */
    : tier==="half" ? JOB_AUTOFILL_HALF_KEYS
    : JOB_MASTER_AUTOFILL_KEYS;
  JOB_FIELD_MAP.forEach(f=>{
    if(!f.contextKey) return;
    if(allowedKeys && !allowedKeys.includes(f.key)) return; // outside this tier
    const val = job.fields[f.key];
    if(val===undefined || val===null || val==="") return;
    context[f.contextKey] = {value: val, sourceSlug: "job-master", sourceTitle: `Shipment Lot ${job.jobId}`};
  });
  // Items list (goods identity) is always-on regardless of tier, same as
  // the old flat cargo/hsCode/itemQuantity/itemUnit/itemUnitPrice fields
  // were. items[0] still populates every single-value txn.item* key above
  // (so documents with just ONE description/HSN/qty/unit/price field keep
  // working exactly as before); the full list additionally goes into
  // txn.items so skApplyContextAutofill (workflow-rules.js) can give a
  // document's line-item TABLE one row per item instead of only one row.
  const items = skJobItemsWithLegacyFallback(job.fields).filter(it=> it && (it.description || it.product || it.hsCode));
  if(items.length){
    const first = items[0];
    JOB_ITEM_FIELDS.forEach(f=>{
      if(!f.contextKey) return;
      const val = first[f.key];
      if(val===undefined || val===null || val==="") return;
      context[f.contextKey] = {value: val, sourceSlug: "job-master", sourceTitle: `Shipment Lot ${job.jobId}`};
    });
    context["txn.items"] = {value: items, sourceSlug: "job-master", sourceTitle: `Shipment Lot ${job.jobId}`};
  }
  return context;
}

/* =========================================================================
   PHASE 5 — SCENARIO TEMPLATES
   Pre-built realistic Job Master starting points, so a student doesn't have
   to invent every shipment detail from scratch before they can even begin.
   Each template supplies the SAME fields JOB_FIELD_MAP already defines —
   picking one just pre-fills the Job creation form, which the student can
   still edit before (or after) creating the Job. Nothing here bypasses
   verification: it's a starting point, not an autofill-and-forget shortcut.

   Scope note: this phase does NOT yet filter which of the 81 documents are
   "required" vs "optional" per scenario, or enforce mode-specific workflow
   branching (e.g. hiding Bill of Lading fields for a Road scenario) — that
   is Phase 8 in the master prompt (mode-specific workflows), a separate,
   later step. Every document remains available regardless of scenario,
   exactly as it does today.
   ========================================================================= */
const SCENARIO_TEMPLATES = [
  {
    id: "sea-export", title: "Sea Export — Cochin → Dubai",
    summary: "A standard FCL sea export of finished goods, CIF terms.",
    fields: {
      mode: "Sea Export", origin: "Cochin, India", destination: "Dubai, UAE",
      sellerName: "Malabar Spices Exporters Pvt. Ltd.", sellerAddress: "12 Export Promotion Industrial Estate, Kochi, Kerala, India",
      sellerGSTIN: "32AABCM1234F1Z8", sellerIEC: "0388012345", authorizedSignatory: "Priya Nair", bankName: "State Bank of India",
      buyerName: "Al Fahim Trading LLC", buyerAddress: "Al Quoz Industrial Area 3, Dubai, UAE", buyerGSTIN: "", poNumber: "PO-88213",
      items: [{product:"Cotton T-Shirts", description:"Garments — Assorted Cotton T-Shirts", hsCode:"6109.10.00", quantity:"5000", unit:"PCS", unitPrice:"8.50"}],
      quantity: "500", grossWeight: "8500",
      invoiceValue: "40000", currency: "USD", incoterm: "CIF",
      portOfLoading: "Kochi Port (Vallarpadam)", portOfDischarge: "Jebel Ali Port", containerNo: "MSKU1234567",
      vesselName: "MV Kota Ratna", voyageNo: "V.221E", carrierName: "Maersk Line", sealNo: "SL-994231"
    }
  },
  {
    id: "sea-import", title: "Sea Import — Dubai → Cochin",
    summary: "A standard FCL sea import of raw materials into India.",
    fields: {
      mode: "Sea Import", origin: "Dubai, UAE", destination: "Cochin, India",
      sellerName: "Al Fahim Trading LLC", sellerAddress: "Al Quoz Industrial Area 3, Dubai, UAE", sellerGSTIN: "", sellerIEC: "",
      authorizedSignatory: "Rahul Menon", bankName: "HDFC Bank",
      buyerName: "Meridian Imports Pvt. Ltd.", buyerAddress: "Plot 14, MIDC Industrial Area, Pune, Maharashtra, India", buyerGSTIN: "27ABCDE1234F1Z5", poNumber: "PO-77410",
      items: [{product:"Industrial Chemicals", description:"Industrial Chemicals — Bulk Packed Drums", hsCode:"2909.19.00", quantity:"200", unit:"CTN", unitPrice:"325.00"}],
      quantity: "200", grossWeight: "18000",
      invoiceValue: "65000", currency: "USD", incoterm: "CIF",
      portOfLoading: "Jebel Ali Port", portOfDischarge: "Kochi Port (Vallarpadam)", containerNo: "TCLU7654321",
      vesselName: "MSC Aria", voyageNo: "V.114W", carrierName: "MSC", sealNo: "SL-772104"
    }
  },
  {
    id: "air-export", title: "Air Export — Cochin → Dubai",
    summary: "A time-sensitive air export shipment, high value, low weight.",
    fields: {
      mode: "Air Export", origin: "Kochi, India", destination: "Dubai, UAE",
      sellerName: "Kerala Chemical Exports Pvt. Ltd.", sellerAddress: "Cochin Special Economic Zone, Kakkanad, Kochi, Kerala, India",
      sellerGSTIN: "32AABCK5678F1Z2", sellerIEC: "0388067890", authorizedSignatory: "Anjali Pillai", bankName: "ICICI Bank",
      buyerName: "Nordic Trading GmbH", buyerAddress: "Hafenstrasse 22, 20457 Hamburg, Germany", buyerGSTIN: "", poNumber: "PO-91027",
      items: [{product:"Pharmaceutical Intermediates", description:"Pharmaceutical Intermediates — Cold-Chain Packed", hsCode:"2941.90.00", quantity:"40", unit:"CTN", unitPrice:"700.00"}],
      quantity: "40", grossWeight: "620",
      invoiceValue: "28000", currency: "USD", incoterm: "FOB",
      portOfLoading: "Cochin International Airport (COK)", portOfDischarge: "Dubai International Airport (DXB)", containerNo: "",
      vesselName: "", voyageNo: "EK 543", carrierName: "Emirates SkyCargo", sealNo: ""
    }
  },
  {
    id: "air-import", title: "Air Import — Dubai → Cochin",
    summary: "An urgent air import of spare parts.",
    fields: {
      mode: "Air Import", origin: "Dubai, UAE", destination: "Cochin, India",
      sellerName: "Gulf Precision Parts LLC", sellerAddress: "Jebel Ali Free Zone, Dubai, UAE", sellerGSTIN: "", sellerIEC: "",
      authorizedSignatory: "Vishnu Kumar", bankName: "Axis Bank",
      buyerName: "Meridian Manufacturing Pvt. Ltd.", buyerAddress: "Plot 14, MIDC Industrial Area, Pune, Maharashtra, India", buyerGSTIN: "27ABCDE1234F1Z5", poNumber: "PO-63558",
      items: [{product:"Ball Bearings", description:"Precision-Machined Ball Bearings", hsCode:"8482.10.00", quantity:"240", unit:"PCS", unitPrice:"25.00"}],
      quantity: "240", grossWeight: "310",
      invoiceValue: "6000", currency: "USD", incoterm: "CIP",
      portOfLoading: "Dubai International Airport (DXB)", portOfDischarge: "Cochin International Airport (COK)", containerNo: "",
      vesselName: "", voyageNo: "EK 544", carrierName: "Emirates SkyCargo", sealNo: ""
    }
  },
  {
    id: "domestic-road", title: "Domestic Road Movement",
    summary: "A domestic B2B delivery within India, GST-invoiced.",
    fields: {
      mode: "Road / Domestic", origin: "Pune, Maharashtra, India", destination: "Navi Mumbai, Maharashtra, India",
      sellerName: "Meridian Exports Pvt. Ltd.", sellerAddress: "Plot 14, MIDC Industrial Area, Pune, Maharashtra, India",
      sellerGSTIN: "27AABCM9988F1Z3", sellerIEC: "", authorizedSignatory: "Sanjay Deshmukh", bankName: "Bank of Baroda",
      buyerName: "Sunrise Imports Pvt. Ltd.", buyerAddress: "14 Industrial Estate, Navi Mumbai, Maharashtra, India", buyerGSTIN: "27XYZAB1122G1Z9", poNumber: "PO-45092",
      items: [{product:"Cotton T-Shirts", description:"Cotton T-Shirts, Assorted Sizes", hsCode:"6109.10.00", quantity:"240", unit:"CTN", unitPrice:"2500.00"}],
      quantity: "240", grossWeight: "5760",
      invoiceValue: "600000", currency: "INR", incoterm: "DAP",
      portOfLoading: "", portOfDischarge: "", containerNo: "",
      vesselName: "", voyageNo: "", carrierName: "Meridian Fleet Transport", sealNo: ""
    }
  },
  {
    id: "warehouse-transfer", title: "Warehouse Transfer",
    summary: "An internal stock transfer between two of the same company's warehouses.",
    fields: {
      mode: "Warehouse Transfer", origin: "Kochi Warehouse 2, Kerala, India", destination: "Chennai Distribution Centre, Tamil Nadu, India",
      sellerName: "Malabar Spices Exporters Pvt. Ltd.", sellerAddress: "12 Export Promotion Industrial Estate, Kochi, Kerala, India",
      sellerGSTIN: "32AABCM1234F1Z8", sellerIEC: "", authorizedSignatory: "Priya Nair", bankName: "State Bank of India",
      buyerName: "Malabar Spices Exporters Pvt. Ltd. (Chennai DC)", buyerAddress: "Distribution Centre, Ambattur Industrial Estate, Chennai, Tamil Nadu, India", buyerGSTIN: "33AABCM1234F2Z1", poNumber: "PO-INTERNAL-2201",
      items: [{product:"Black Pepper", description:"Premium Black Pepper — Bulk Stock", hsCode:"0904.11.00", quantity:"1200", unit:"KG", unitPrice:"0"}],
      quantity: "1200", grossWeight: "24000",
      invoiceValue: "0", currency: "INR", incoterm: "",
      portOfLoading: "", portOfDischarge: "", containerNo: "",
      vesselName: "", voyageNo: "", carrierName: "", sealNo: ""
    }
  },
  {
    id: "dangerous-goods", title: "Dangerous Goods Shipment (Sea Export)",
    summary: "A sea export requiring a Dangerous Goods Declaration and MSDS alongside the standard document set.",
    fields: {
      mode: "Sea Export", origin: "Mundra, India", destination: "Jebel Ali, UAE",
      sellerName: "Konkan Specialty Chemicals Pvt. Ltd.", sellerAddress: "GIDC Industrial Estate, Ankleshwar, Gujarat, India",
      sellerGSTIN: "24AABCK5566F1Z7", sellerIEC: "0388099887", authorizedSignatory: "Nikhil Rao", bankName: "Kotak Mahindra Bank",
      buyerName: "Gulf Petrochemical Trading LLC", buyerAddress: "Jebel Ali Free Zone, Dubai, UAE", buyerGSTIN: "", poNumber: "PO-30871",
      items: [{product:"Ethanol Solution (UN1170)", description:"UN1170 — Ethanol Solution, Class 3 Flammable Liquid", hsCode:"2207.10.00", quantity:"160", unit:"BOX", unitPrice:"325.00"}],
      quantity: "160", grossWeight: "19200",
      invoiceValue: "52000", currency: "USD", incoterm: "FOB",
      portOfLoading: "Mundra Port", portOfDischarge: "Jebel Ali Port", containerNo: "MSCU2345678",
      vesselName: "MSC Anna", voyageNo: "V.309E", carrierName: "MSC", sealNo: "SL-118820"
    }
  }
];

/* =========================================================================
   PHASE 8 — MODE-SPECIFIC WORKFLOWS
   =========================================================================
   Classifies which of the 81 documents genuinely apply to which of the 6
   Job modes, based on (a) each document's own moduleLabel in
   documents-data.js, and (b) its real position in the PREREQUISITES chain
   in workflow-rules.js (e.g. Mate Receipt only ever appears in the sea leg
   of that chain, so it's Sea-only regardless of label; Dispatch Note
   appears both in the road-to-port leg AND is labeled "Warehouse
   Documentation", so it's tagged for both).

   This is INFORMATIONAL ONLY, per the master prompt's own "do not over-
   automate" instruction (section 15) — a document not applicable to the
   active Job's mode is labeled as such and excluded from that Job's
   completion denominator, but a student can still open and complete it.
   Nothing here changes lock/unlock logic (PREREQUISITES, section 6) or
   removes access to any of the 81 documents.

   A handful of these are genuinely ambiguous even after checking both
   signals (e.g. whether Purchase Order/RFQ/Vendor Bill represent a
   separate domestic-procurement track or are themselves part of importing
   raw materials internationally) — those are tagged ALL_MODES (available
   everywhere, never marked "not applicable"), which is the safe default
   whenever the classification was uncertain rather than guessing narrow.
   ========================================================================= */
const ALL_MODES = ["Sea Export","Sea Import","Air Export","Air Import","Road / Domestic","Warehouse Transfer"];

const MODE_APPLICABILITY = {
  "export-license": ["Sea Export", "Air Export"],
  "import-license": ["Sea Import", "Air Import"],
  "are-1": ["Sea Export", "Air Export"],
  "uld-manifest": ["Air Export", "Air Import"],
  "vendor-comparison-statement": ALL_MODES,
  "bin-card": ["Sea Import", "Air Import", "Road / Domestic", "Warehouse Transfer"],
  "cycle-count-sheet": ["Sea Import", "Air Import", "Road / Domestic", "Warehouse Transfer"],
  "trip-sheet": ["Road / Domestic", "Sea Export", "Air Export"],
  "weighbridge-slip": ["Road / Domestic", "Sea Export", "Air Export", "Warehouse Transfer"],
  "icegate-registration-form": ["Sea Export", "Sea Import", "Air Export", "Air Import", "Road / Domestic", "Warehouse Transfer"],
  "vendor-master": ["Sea Export", "Sea Import", "Air Export", "Air Import", "Road / Domestic", "Warehouse Transfer"],
  "supplier-evaluation": ["Sea Export", "Sea Import", "Air Export", "Air Import", "Road / Domestic", "Warehouse Transfer"],
  "purchase-requisition": ["Sea Export", "Sea Import", "Air Export", "Air Import", "Road / Domestic", "Warehouse Transfer"],
  "request-for-quotation": ["Sea Export", "Sea Import", "Air Export", "Air Import", "Road / Domestic", "Warehouse Transfer"],
  "purchase-order": ["Sea Export", "Sea Import", "Air Export", "Air Import", "Road / Domestic", "Warehouse Transfer"],
  "vendor-bill": ["Sea Export", "Sea Import", "Air Export", "Air Import", "Road / Domestic", "Warehouse Transfer"],
  "payment-voucher": ["Sea Export", "Sea Import", "Air Export", "Air Import", "Road / Domestic", "Warehouse Transfer"],
  "inventory-valuation-report": ["Sea Export", "Sea Import", "Air Export", "Air Import", "Road / Domestic", "Warehouse Transfer"],
  "proforma-invoice": ["Sea Export", "Air Export"],
  "sales-order": ["Sea Export", "Air Export", "Road / Domestic"],
  "commercial-invoice": ["Sea Export", "Air Export"],
  "tax-invoice-gst": ["Road / Domestic", "Warehouse Transfer", "Sea Import", "Air Import"],
  "packing-list": ["Sea Export", "Air Export"],
  "stock-transfer-note": ["Warehouse Transfer", "Road / Domestic"],
  "picking-slip": ["Warehouse Transfer", "Road / Domestic"],
  "goods-issue-note": ["Warehouse Transfer", "Road / Domestic"],
  "certificate-of-origin": ["Sea Export", "Air Export"],
  "certificate-of-analysis": ["Sea Export", "Air Export"],
  "fumigation-certificate": ["Sea Export", "Air Export"],
  "phytosanitary-certificate": ["Sea Export", "Air Export"],
  "weight-certificate": ["Sea Export", "Air Export"],
  "insurance-certificate": ["Sea Export", "Air Export", "Sea Import", "Air Import"],
  "letter-of-credit": ["Sea Export", "Air Export", "Sea Import", "Air Import"],
  "bill-of-exchange": ["Sea Export", "Air Export", "Sea Import", "Air Import"],
  "bank-guarantee": ["Sea Export", "Air Export", "Sea Import", "Air Import"],
  "export-declaration": ["Sea Export", "Air Export"],
  "dangerous-goods-declaration": ["Sea Export", "Air Export"],
  "msds": ["Sea Export", "Air Export", "Sea Import", "Air Import"],
  "ocean-freight-quotation": ["Sea Export", "Sea Import"],
  "shipping-instructions": ["Sea Export", "Air Export"],
  "booking-confirmation": ["Sea Export", "Air Export"],
  "vgm-certificate": ["Sea Export"],
  "shipping-order": ["Sea Export"],
  "security-declaration": ["Sea Export", "Air Export"],
  "container-load-plan": ["Sea Export"],
  "container-packing-certificate": ["Sea Export"],
  "seal-report": ["Sea Export"],
  "vehicle-inspection-report": ["Road / Domestic", "Sea Export", "Air Export"],
  "road-permit": ["Road / Domestic", "Sea Export", "Air Export"],
  "delivery-challan": ["Road / Domestic", "Sea Export", "Air Export"],
  "dispatch-note": ["Road / Domestic", "Warehouse Transfer", "Sea Export", "Air Export"],
  "lorry-receipt": ["Road / Domestic", "Sea Export", "Air Export"],
  "dock-receipt": ["Sea Export"],
  "shipping-bill": ["Sea Export", "Air Export"],
  "edi-copy": ["Sea Export", "Air Export"],
  "inspection-certificate": ["Sea Export", "Air Export"],
  "mate-receipt": ["Sea Export"],
  "master-bill-of-lading": ["Sea Export"],
  "house-bill-of-lading": ["Sea Export"],
  "bill-of-lading-sea": ["Sea Export"],
  "freight-invoice-sea": ["Sea Export"],
  "sea-waybill": ["Sea Export"],
  "air-waybill": ["Air Export", "Air Import"],
  "air-freight-invoice": ["Air Export", "Air Import"],
  "cargo-manifest": ["Sea Import", "Air Import"],
  "arrival-notice": ["Sea Import", "Air Import"],
  "container-destuffing": ["Sea Import"],
  "import-invoice": ["Sea Import", "Air Import"],
  "bill-of-entry": ["Sea Import", "Air Import"],
  "assessment-copy": ["Sea Import", "Air Import"],
  "customs-declaration": ["Sea Import", "Air Import"],
  "duty-calculation": ["Sea Import", "Air Import"],
  "out-of-charge": ["Sea Import", "Air Import"],
  "customs-gate-pass": ["Sea Import", "Air Import"],
  "e-way-bill": ["Sea Import", "Air Import", "Road / Domestic", "Warehouse Transfer"],
  "delivery-order": ["Sea Import", "Air Import"],
  "goods-receipt-note": ["Sea Import", "Air Import", "Warehouse Transfer"],
  "put-away-slip": ["Sea Import", "Air Import", "Warehouse Transfer"],
  "damage-report": ["Sea Import", "Air Import", "Warehouse Transfer", "Road / Domestic"],
  "warehouse-receipt": ["Sea Import", "Air Import", "Warehouse Transfer"],
  "proof-of-delivery": ["Road / Domestic", "Sea Import", "Air Import", "Warehouse Transfer"],
  "equipment-interchange-receipt": ["Sea Export", "Sea Import"],
  "letter-of-indemnity": ["Sea Import", "Air Import"],
  "bank-realization-certificate": ["Sea Export", "Air Export"],
  "gsp-certificate-of-origin": ["Sea Export", "Air Export"],
  "demurrage-detention-invoice": ["Sea Import", "Air Import"],
  "marine-insurance-claim-form": ["Sea Export", "Air Export", "Sea Import", "Air Import"],
  "halal-kosher-certificate": ["Sea Export", "Air Export"],
  "credit-note": ["Sea Export", "Air Export", "Road / Domestic"],
  "debit-note": ["Sea Export", "Air Export", "Road / Domestic"],

  /* ---- Ported from v2 ---- */
  "letter-of-undertaking": ["Sea Export", "Air Export"],
  "registration-cum-membership-certificate": ["Sea Export", "Air Export"],
  "gst-e-invoice-irn": ALL_MODES,
  "softex-form": ["Sea Export", "Air Export"],
  "export-general-manifest": ["Sea Export", "Air Export"],
  "importer-security-filing": ["Sea Import"],
  "transshipment-permit": ["Sea Export", "Sea Import"],
  "multimodal-transport-document": ["Sea Export", "Sea Import", "Road / Domestic"],
  "forwarders-cargo-receipt": ["Sea Export", "Air Export"],
  "marine-insurance-policy": ["Sea Export", "Air Export", "Sea Import", "Air Import"],
  "cargo-survey-damage-claim-report": ["Sea Import", "Air Import", "Warehouse Transfer", "Road / Domestic"],
  "cfs-gate-pass": ["Sea Export", "Sea Import"],
};

/* True if this document is tagged as applying to the given mode, OR if the
   slug isn't in the table at all (defensive default — never silently hide
   a document just because it's missing from this classification; that
   would be a regression, not a feature). Passing a falsy mode (no active
   Job, or Job has no mode set yet) always returns true — mode filtering
   only ever activates once a Job with a mode actually exists. */
function skIsDocumentApplicableForMode(slug, mode){
  if(!mode) return true;
  const modes = MODE_APPLICABILITY[slug];
  if(!modes) return true;
  return modes.includes(mode);
}

/* Given the full catalog of exercise slugs (EXERCISE_SLUGS, built from
   EXERCISES in workflow-rules.js) and a mode, returns just the ones
   genuinely applicable — the denominator a mode-aware Final Job Audit
   should use, instead of "all 81" for every Job regardless of mode. */
function skGetApplicableSlugsForMode(allSlugs, mode){
  if(!mode) return allSlugs.slice();
  return allSlugs.filter(slug => skIsDocumentApplicableForMode(slug, mode));
}

/* =========================================================================
   ASSIGNMENTS — faculty-authored tasks that scope a student's Job to a
   specific, hand-picked set of documents.
   =========================================================================
   Unlike everything else in this file (per-student, keyed by userId),
   assignments are SHARED across every account on this computer — the same
   "lab computer, no server" model the Administration panel already uses
   for its class-wide analytics (see skGetAllProgress usage in
   skelora-institute-dashboard.html). A faculty account creates an
   assignment here; every student account on the SAME computer can then see
   and follow it when starting a Job.

   An assignment does not replace the existing scenario/mode system — it
   layers on top of it. skIsDocumentAllowedForJob() is the single gate both
   the dashboard's Document Library and workstation.html's boot() call
   through, so "only the documents in the assignment can be filled" is
   enforced in one place, not re-implemented per screen. */
/* PHASE 11: the AS Group of Industries assignment bank, seeded once so
   students have real scenarios to work from on first launch instead of an
   empty Assignments list. 10 questions for the 1-Year track (full 102-doc
   catalog, advanced scenarios) + 10 for the 6-Months track (60-doc
   foundational core, simpler scenarios) — see skSeedAssignmentsIfEmpty(). */
const SKELORA_ASSIGNMENT_SEEDS = [
  {
    title: "1 \u2014 Vita Nova Pharmaceuticals",
    track: "1-year",
    question: "Vita Nova Pharmaceuticals, the group's pharma manufacturing arm, has won a tender to supply finished antibiotic formulations (Amoxicillin 500mg capsules, 2 pallets, temperature-controlled) to a distributor in the Netherlands. Because the cargo is temperature-sensitive and the buyer needs stock on their shelves within the week, the shipment moves by air freight through AS Logistics and Shipping Company, Chennai.\\n\\nBuild the complete paper trail for this shipment from quotation to realization of export proceeds \u2014 as if you are the documentation executive at Vita Nova Pharmaceuticals working with AS Logistics. Pay special attention to the quality/compliance documents a pharma shipment can't move without, and make sure every figure (invoice value, weight, package count) matches across every document you touch.",
    docSlugs: ["proforma-invoice", "commercial-invoice", "packing-list", "certificate-of-origin", "certificate-of-analysis", "insurance-certificate", "letter-of-credit", "bill-of-exchange", "air-waybill", "air-freight-invoice", "export-license", "bank-realization-certificate", "gst-e-invoice-irn", "tax-invoice-gst", "security-declaration", "uld-manifest"]
  },
  {
    title: "2 \u2014 AS Global Hospital Chain",
    track: "1-year",
    question: "AS Global Hospital Chain is opening a new diagnostic wing and has imported two MRI scanners and a batch of patient-monitoring systems from a German medical equipment manufacturer. The equipment moves by sea (too heavy and bulky for air freight) into Nhava Sheva, and AS Logistics and Shipping Company handles customs clearance on the hospital chain's behalf before the equipment can be delivered, installed and put into use.\\n\\nWork this shipment from the import side \u2014 as if you are the procurement/logistics coordinator at AS Global Hospital Chain receiving this consignment. Walk it from the overseas invoice through customs assessment and duty payment, all the way to the equipment landing in the hospital's own store. Watch for any damage noted on arrival \u2014 high-value medical equipment claims don't get a second chance.",
    docSlugs: ["import-invoice", "bill-of-entry", "import-license", "delivery-order", "arrival-notice", "assessment-copy", "edi-copy", "out-of-charge", "duty-calculation", "customs-declaration", "insurance-certificate", "inspection-certificate", "container-destuffing", "weighbridge-slip", "damage-report", "letter-of-indemnity", "warehouse-receipt"]
  },
  {
    title: "3 \u2014 ElanFi Luxury Brand",
    track: "1-year",
    question: "ElanFi Luxury Brand is restocking its flagship Mumbai boutique ahead of the festive season with a fresh collection of handcrafted Italian leather handbags and accessories. Given the value and time-sensitivity of the goods, the shipment is flown in, and AS Logistics and Shipping Company clears it through customs and delivers it directly to ElanFi's Mumbai warehouse.\\n\\nWork this shipment from the moment it lands to the moment it's shelf-ready inside ElanFi's own warehouse \u2014 as if you are ElanFi's supply chain executive. This one leans more on the warehouse/inventory side than the earlier questions: once customs releases the goods, they still have to be received, checked in, put away and made ready to issue to the boutique.",
    docSlugs: ["import-invoice", "bill-of-entry", "customs-gate-pass", "security-declaration", "put-away-slip", "bin-card", "cycle-count-sheet", "inventory-valuation-report", "proof-of-delivery", "delivery-challan", "weight-certificate"]
  },
  {
    title: "4 \u2014 HeraLife Healthcare Solutions",
    track: "1-year",
    question: "HeraLife Healthcare Solutions manufactures medical disposables and diagnostic consumables \u2014 syringes, PPE kits and rapid-test reagents. A public health distributor in Kenya has placed a bulk order ahead of a regional immunization drive. The consignment moves by sea out of Mundra, arranged by AS Logistics and Shipping Company, and includes reagents that carry a small percentage of hazardous chemical content \u2014 so this shipment isn't paperwork-simple.\\n\\nTake this shipment from booking to vessel departure \u2014 as if you are HeraLife's export documentation executive. Because part of the cargo is hazard-classified, treat the safety and dangerous-goods paperwork as seriously as the trade paperwork: a shipping line will reject cargo outright if that part of the file isn't right.",
    docSlugs: ["commercial-invoice", "packing-list", "shipping-bill", "bill-of-lading-sea", "certificate-of-origin", "inspection-certificate", "export-declaration", "shipping-instructions", "booking-confirmation", "mate-receipt", "vgm-certificate", "freight-invoice-sea", "letter-of-undertaking", "seal-report", "dangerous-goods-declaration", "msds"]
  },
  {
    title: "5 \u2014 AS GIMEB \u2014 Global Industrial & Machines Equipment Building",
    track: "1-year",
    question: "AS GIMEB manufactures heavy industrial machinery \u2014 CNC machining centres and industrial presses. A Brazilian metalworks has ordered two machines, shipped as two 40ft containers out of Visakhapatnam via a transshipment hub, consolidated and carried under a forwarder's own house bill alongside the carrier's master bill \u2014 the kind of multi-party paperwork heavy-engineering exports usually involve.\\n\\nWork this one end-to-end at the port/container level \u2014 as if you are AS GIMEB's freight executive coordinating directly with AS Logistics and Shipping Company. This shipment leans heavily on container and terminal documentation (stuffing, sealing, interchange, transshipment) alongside the usual trade paperwork, so take your time getting the container-level detail consistent.",
    docSlugs: ["proforma-invoice", "commercial-invoice", "packing-list", "house-bill-of-lading", "master-bill-of-lading", "container-load-plan", "container-packing-certificate", "dock-receipt", "forwarders-cargo-receipt", "equipment-interchange-receipt", "cargo-manifest", "multimodal-transport-document", "transshipment-permit", "ocean-freight-quotation", "weight-certificate", "bank-guarantee", "cfs-gate-pass"]
  },
  {
    title: "6 \u2014 AS ADR \u2014 Advance Defence Research",
    track: "1-year",
    question: "AS ADR designs avionics and radar sub-components and has secured export clearance to supply a licensed research partner in South Korea, along with embedded firmware supplied electronically. This is a compliance-heavy shipment \u2014 dual-use and defence-adjacent goods need export licensing and security paperwork well beyond a normal commercial shipment, and this question also folds in AS ADR's domestic sourcing side, since the company procures specialised components from local vendors before it can export anything.\\n\\nThis is the most document-heavy question in the set, deliberately \u2014 as if you are AS ADR's compliance and logistics executive handling both ends: sourcing components domestically (purchase requisition through to vendor selection) and exporting the finished sub-assembly by air under strict security and licensing controls. This is purely a documentation exercise in export-compliance paperwork \u2014 treat every field as you would any other simulator document; no technical product detail is required or expected anywhere in this exercise.",
    docSlugs: ["commercial-invoice", "packing-list", "export-license", "air-waybill", "air-freight-invoice", "security-declaration", "uld-manifest", "letter-of-indemnity", "bank-guarantee", "certificate-of-origin", "insurance-certificate", "softex-form", "icegate-registration-form", "gsp-certificate-of-origin", "e-way-bill", "lorry-receipt", "road-permit", "trip-sheet", "vehicle-inspection-report", "purchase-order", "purchase-requisition", "request-for-quotation", "vendor-comparison-statement", "supplier-evaluation", "vendor-master"]
  },
  {
    title: "7 \u2014 AS Spices Export and Import",
    track: "1-year",
    question: "AS Spices Export and Import \u2014 trading out of Kochi, in Skelora Institute's own backyard \u2014 has a confirmed order from a US spice importer for a container of black pepper, cardamom and turmeric. Agricultural cargo like this carries its own layer of certification most other AS Group shipments don't need, on top of the fact that anything moving into the US by sea needs its import security data filed well before the vessel arrives.\\n\\nWork this shipment from the domestic sales side (this order didn't appear out of nowhere \u2014 it came through a quotation and a confirmed sales order) through to the ship sailing out of Kochi \u2014 as if you are AS Spices' export executive. Give the phytosanitary and fumigation paperwork the same care as the trade documents: a US port authority will hold agricultural cargo at the border over either one.",
    docSlugs: ["commercial-invoice", "packing-list", "shipping-bill", "bill-of-lading-sea", "certificate-of-origin", "insurance-certificate", "letter-of-credit", "bank-realization-certificate", "fumigation-certificate", "phytosanitary-certificate", "halal-kosher-certificate", "importer-security-filing", "sea-waybill", "export-general-manifest", "sales-order", "shipping-order", "picking-slip", "goods-issue-note", "dispatch-note", "cargo-survey-damage-claim-report", "marine-insurance-policy", "registration-cum-membership-certificate"]
  },
  {
    title: "8 \u2014 AS Chemicals",
    track: "1-year",
    question: "AS Chemicals manufactures specialty industrial chemicals, and a long-standing Japanese buyer has placed a repeat order \u2014 corrosive-class material moving in drums inside a 20ft container out of Kandla. This is the group's most finance-and-billing-heavy question: alongside the usual export and hazard paperwork, this order involves a prior part-shipment adjustment, a demurrage charge from an earlier container that sat too long at the yard, and a vendor payment for the drums themselves.\\n\\nWork this one as AS Chemicals' combined export-and-accounts executive \u2014 the shipment itself, plus the finance paperwork sitting around it (a credit note correcting a prior invoice, a debit note, an outstanding vendor bill, and a demurrage invoice AS Logistics has raised on a previous container). Treat the dangerous-goods declaration and MSDS as non-negotiable \u2014 get those two exactly right before anything else.",
    docSlugs: ["commercial-invoice", "packing-list", "shipping-bill", "bill-of-lading-sea", "certificate-of-origin", "insurance-certificate", "letter-of-credit", "bank-guarantee", "gst-e-invoice-irn", "tax-invoice-gst", "dangerous-goods-declaration", "msds", "are-1", "credit-note", "debit-note", "demurrage-detention-invoice", "goods-receipt-note", "marine-insurance-claim-form", "payment-voucher", "stock-transfer-note", "vendor-bill"]
  },
  {
    title: "9 \u2014 AS Logistics and Shipping Company: Central Distribution Warehouse, Chennai",
    track: "1-year",
    question: "AS Logistics and Shipping Company doesn't only forward international shipments for its sister companies \u2014 it also runs a central multi-client warehouse in Chennai. Finished stock arrives here from HeraLife, ElanFi and Vita Nova, gets counted, shelved and tracked, and then goes back out by road to regional stockists on a rolling schedule. This question is a full warehouse operations cycle, almost entirely independent of any international shipment.\\n\\nRun the complete inbound-to-outbound warehouse cycle \u2014 as if you are AS Logistics' warehouse executive in Chennai. Receive stock in, put it away, keep the bin/cycle-count records straight, pick and release an outbound order, and get it onto a truck correctly \u2014 this question is deliberately warehouse-and-road heavy (76% of its document list), with just enough surrounding paperwork (purchase order, sales order, tax invoice) to tie the warehouse activity to a real transaction.",
    docSlugs: ["warehouse-receipt", "goods-receipt-note", "put-away-slip", "bin-card", "cycle-count-sheet", "inventory-valuation-report", "picking-slip", "goods-issue-note", "delivery-challan", "dispatch-note", "damage-report", "stock-transfer-note", "proof-of-delivery", "weighbridge-slip", "lorry-receipt", "e-way-bill", "purchase-order", "sales-order", "tax-invoice-gst", "vendor-master", "delivery-order"]
  },
  {
    title: "10 \u2014 AS Chemicals: Regional Depot Distribution by Road",
    track: "1-year",
    question: "Before any container reaches a port, AS Chemicals first moves packaged product from its Kandla plant to three regional depots by road, where local distributors collect smaller lot sizes. This is the domestic road leg most students never see documented \u2014 legally getting a loaded truck from a factory gate to a depot, and the paperwork a depot itself has to keep once the goods land.\\n\\nWork the depot-distribution cycle \u2014 as if you are AS Chemicals' regional logistics executive. Get each truckload legally onto the road (permit, inspection, trip sheet), receive it correctly at the depot end, and handle the vendor/billing paperwork sitting around a regional distribution network. This question is the road-transport counterpart to Question 9's warehouse focus (73% of its document list is warehouse-and-road).",
    docSlugs: ["lorry-receipt", "e-way-bill", "road-permit", "trip-sheet", "vehicle-inspection-report", "shipping-order", "warehouse-receipt", "goods-receipt-note", "stock-transfer-note", "delivery-challan", "weighbridge-slip", "purchase-requisition", "request-for-quotation", "credit-note", "debit-note"]
  },
  {
    title: "1 \u2014 Vita Nova Pharmaceuticals",
    track: "6-months",
    question: "Vita Nova Pharmaceuticals has a confirmed order from a regional distributor in Sri Lanka for a straightforward container of finished pharmaceutical formulations. This is a simple, neighbouring-country sea export \u2014 the whole standard export cycle, start to finish, without any extra complications.\\n\\nTake this shipment through the complete standard sea-export cycle, from proforma quotation to the export proceeds being realised \u2014 as if you are the documentation trainee at Vita Nova Pharmaceuticals. This question is your first full pass through the core export document set; every figure (value, weight, package count) must match across every document.",
    docSlugs: ["proforma-invoice", "commercial-invoice", "packing-list", "certificate-of-origin", "insurance-certificate", "letter-of-credit", "bill-of-exchange", "bank-realization-certificate", "tax-invoice-gst", "shipping-bill", "bill-of-lading-sea", "export-declaration", "shipping-instructions", "booking-confirmation", "mate-receipt", "freight-invoice-sea", "seal-report", "vgm-certificate", "dock-receipt", "customs-declaration", "weight-certificate", "export-license"]
  },
  {
    title: "2 \u2014 AS Global Hospital Chain",
    track: "6-months",
    question: "AS Global Hospital Chain has imported a routine container of hospital consumables and basic diagnostic equipment from a UK supplier. Nothing exotic \u2014 a standard sea import that has to be cleared through customs and received into the hospital's own store.\\n\\nWork this shipment from the import side, start to finish \u2014 as if you are the procurement/logistics trainee at AS Global Hospital Chain. Follow it from the overseas invoice through customs clearance and duty payment, right up to the goods being received and logged into the store, noting anything found damaged on arrival.",
    docSlugs: ["import-invoice", "bill-of-entry", "delivery-order", "arrival-notice", "assessment-copy", "out-of-charge", "duty-calculation", "edi-copy", "import-license", "customs-gate-pass", "warehouse-receipt", "goods-receipt-note", "damage-report", "proof-of-delivery", "weighbridge-slip"]
  },
  {
    title: "3 \u2014 ElanFi Luxury Brand",
    track: "6-months",
    question: "ElanFi Luxury Brand has flown in a routine restock of accessories from a supplier in Kuala Lumpur for its Mumbai boutique. Once customs releases the shipment, it still has to move through the warehouse \u2014 received, checked in, put away and made ready to issue to the store.\\n\\nWork this shipment from touchdown to shelf-ready \u2014 as if you are ElanFi's supply chain trainee. This question leans on the warehouse/inventory side more than the others: get comfortable with the receive \u2192 put-away \u2192 issue sequence, since it repeats behind almost every import.",
    docSlugs: ["air-waybill", "air-freight-invoice", "import-invoice", "bill-of-entry", "customs-gate-pass", "put-away-slip", "picking-slip", "bin-card", "cycle-count-sheet", "inventory-valuation-report", "stock-transfer-note", "delivery-challan", "dispatch-note"]
  },
  {
    title: "4 \u2014 HeraLife Healthcare Solutions",
    track: "6-months",
    question: "HeraLife Healthcare Solutions is exporting a container of medical disposables to a distributor in Dubai. Before the cargo even reaches Mundra port, though, it has to travel by road from HeraLife's factory \u2014 which is the part of the journey most students skip past without realising it needs its own paperwork.\\n\\nWork the domestic leg of this shipment \u2014 as if you are HeraLife's logistics trainee getting the cargo from the factory gate onto the truck and legally onto the highway to Mundra port. This question is entirely about what happens BEFORE a container is even loaded onto a ship; the core export set from Question 1 covers what happens after.",
    docSlugs: ["commercial-invoice", "packing-list", "shipping-bill", "bill-of-lading-sea", "certificate-of-origin", "insurance-certificate", "lorry-receipt", "e-way-bill", "road-permit", "trip-sheet", "vehicle-inspection-report", "shipping-order"]
  },
  {
    title: "5 \u2014 AS GIMEB \u2014 Global Industrial & Machines Equipment Building",
    track: "6-months",
    question: "AS GIMEB has a confirmed export order to Durban, but before it can manufacture the machine parts it needs, it first has to buy in raw components from its own local vendors \u2014 this question is about that sourcing step, not the shipment itself.\\n\\nWork the buying side of this order \u2014 as if you are AS GIMEB's junior procurement executive. Follow the process from asking vendors for quotes through to raising a purchase order and paying the chosen vendor, before AS GIMEB's own export documentation for Question 1's core set even begins.",
    docSlugs: ["proforma-invoice", "commercial-invoice", "packing-list", "purchase-order", "purchase-requisition", "request-for-quotation", "vendor-master", "payment-voucher"]
  },
  {
    title: "6 \u2014 AS ADR \u2014 Advance Defence Research",
    track: "6-months",
    question: "AS ADR runs a general instrumentation line alongside its research work, and this order is from that general line \u2014 a plain, uncomplicated sea export of standard industrial electronic instruments, with none of the export-licensing complexity its defence-adjacent work involves (that side of AS ADR is covered in the advanced 1-year assignment bank instead).\\n\\nTreat this as revision \u2014 as if you are AS ADR's newest documentation trainee, put the complete core export set together on your own with no extra hints. If you can do this one without looking back at Question 1, the fundamentals have landed.",
    docSlugs: ["commercial-invoice", "packing-list", "certificate-of-origin", "export-license", "insurance-certificate", "bill-of-lading-sea", "shipping-bill"]
  },
  {
    title: "7 \u2014 AS Spices Export and Import",
    track: "6-months",
    question: "AS Spices Export and Import \u2014 trading out of Kochi \u2014 has a confirmed sales order from a buyer in Jeddah for a container of mixed spices. This one starts from the moment the order is confirmed and the warehouse is told to release stock for it.\\n\\nWork this shipment from the sales side first \u2014 as if you are AS Spices' order-processing trainee. Confirm the sales order and release the stock from the warehouse before moving into the same core export paperwork you built in Question 1.",
    docSlugs: ["commercial-invoice", "packing-list", "shipping-bill", "bill-of-lading-sea", "certificate-of-origin", "insurance-certificate", "letter-of-credit", "bank-realization-certificate", "sales-order", "goods-issue-note"]
  },
  {
    title: "8 \u2014 AS Chemicals",
    track: "6-months",
    question: "AS Chemicals has a repeat order from a long-standing buyer in Vietnam \u2014 a plain export of packaged industrial chemicals with nothing unusual in the shipment itself.\\n\\nOne more full pass through the core export set on your own \u2014 as if you are AS Chemicals' documentation trainee closing out this rotation. By the end of this question you should be able to build Questions 1, 6 and 8's document sets from memory, without needing to check the list.",
    docSlugs: ["commercial-invoice", "packing-list", "shipping-bill", "bill-of-lading-sea", "certificate-of-origin", "insurance-certificate", "letter-of-credit", "tax-invoice-gst"]
  },
  {
    title: "9 \u2014 AS Logistics and Shipping Company: Central Distribution Warehouse, Chennai",
    track: "6-months",
    question: "AS Logistics and Shipping Company doesn't only forward international shipments for its sister companies \u2014 it also runs a central multi-client warehouse in Chennai. Finished stock arrives here from HeraLife, ElanFi and Vita Nova, gets counted, shelved and tracked, and then goes back out by road to regional stockists on a rolling schedule. This question is a full warehouse operations cycle, almost entirely independent of any international shipment.\\n\\nRun the complete inbound-to-outbound warehouse cycle \u2014 as if you are AS Logistics' warehouse executive in Chennai. Receive stock in, put it away, keep the bin/cycle-count records straight, pick and release an outbound order, and get it onto a truck correctly \u2014 this question is deliberately warehouse-and-road heavy (76% of its document list), with just enough surrounding paperwork (purchase order, sales order, tax invoice) to tie the warehouse activity to a real transaction.",
    docSlugs: ["warehouse-receipt", "goods-receipt-note", "put-away-slip", "bin-card", "cycle-count-sheet", "inventory-valuation-report", "picking-slip", "goods-issue-note", "delivery-challan", "dispatch-note", "damage-report", "stock-transfer-note", "proof-of-delivery", "weighbridge-slip", "lorry-receipt", "e-way-bill", "purchase-order", "sales-order", "tax-invoice-gst", "vendor-master", "delivery-order"]
  },
  {
    title: "10 \u2014 AS Chemicals: Regional Depot Distribution by Road",
    track: "6-months",
    question: "Before any container reaches a port, AS Chemicals first moves packaged product from its Kandla plant to three regional depots by road, where local distributors collect smaller lot sizes. This is the domestic road leg most students never see documented \u2014 legally getting a loaded truck from a factory gate to a depot, and the paperwork a depot itself has to keep once the goods land.\\n\\nWork the depot-distribution cycle \u2014 as if you are AS Chemicals' regional logistics executive. Get each truckload legally onto the road (permit, inspection, trip sheet), receive it correctly at the depot end, and handle the vendor/billing paperwork sitting around a regional distribution network. This question is the road-transport counterpart to Question 9's warehouse focus (73% of its document list is warehouse-and-road).",
    docSlugs: ["lorry-receipt", "e-way-bill", "road-permit", "trip-sheet", "vehicle-inspection-report", "shipping-order", "warehouse-receipt", "goods-receipt-note", "stock-transfer-note", "delivery-challan", "weighbridge-slip", "purchase-requisition", "request-for-quotation", "credit-note", "debit-note"]
  },
];

const SKELORA_ASSIGNMENTS_KEY = "skelora_assignments_v1";

function skGetAssignments(){
  try{
    const raw = localStorage.getItem(SKELORA_ASSIGNMENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  }catch(e){ return []; }
}
function _sk_saveAssignments(list){
  try{ localStorage.setItem(SKELORA_ASSIGNMENTS_KEY, JSON.stringify(list)); }catch(e){}
}
function skGetAssignment(id){
  if(!id) return null;
  return skGetAssignments().find(a=>a.id===id) || null;
}
/* data: {title, question, docSlugs:[...], createdByName, track} — docSlugs
   must have at least 1 entry; the caller (UI) is responsible for that
   minimum, this layer just stores whatever list it's given. `track` is
   optional free-form grouping (e.g. "1-year" / "6-months") a student-facing
   browser can filter by — plain faculty-created assignments just leave it
   null and show up ungrouped. */
function skCreateAssignment(data){
  const list = skGetAssignments();
  const assignment = {
    id: "ASG-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random()*900+100),
    title: (data.title||"Untitled Assignment").trim(),
    question: (data.question||"").trim(),
    docSlugs: Array.isArray(data.docSlugs) ? data.docSlugs.slice() : [],
    createdByName: data.createdByName || "Faculty",
    track: data.track || null,
    createdAt: new Date().toISOString()
  };
  list.push(assignment);
  _sk_saveAssignments(list);
  return assignment;
}
function skUpdateAssignment(id, patch){
  const list = skGetAssignments();
  const idx = list.findIndex(a=>a.id===id);
  if(idx===-1) return null;
  list[idx] = Object.assign({}, list[idx], patch, {docSlugs: patch.docSlugs ? patch.docSlugs.slice() : list[idx].docSlugs});
  _sk_saveAssignments(list);
  return list[idx];
}
function skDeleteAssignment(id){
  _sk_saveAssignments(skGetAssignments().filter(a=>a.id!==id));
}

/* Loads the AS Group assignment bank (SKELORA_ASSIGNMENT_SEEDS, 20
   scenarios) the very first time this app runs on a computer — i.e. only
   when no assignment exists yet at all, so it never overwrites or
   duplicates anything a faculty member has since created or deleted. Safe
   to call on every dashboard load; it's a no-op once assignments exist.

   IMPORTANT: every one of the 20 source document lists, as written, had at
   least one document whose real prerequisite (per workflow-rules.js's
   DOC_PREREQUISITES chain) wasn't itself on the list — e.g. Commercial
   Invoice listed without Sales Order. Unlike a student's own Job (where
   skExpandDocSlugsWithPrerequisites runs at creation time), an assignment's
   docSlugs is the student's ENTIRE reachable scope while following it —
   they can't add a missing document themselves. Left as originally
   written, every single one of these 20 would have permanently locked a
   student out of some document with no way to unlock it. So each seed's
   list is expanded to its full prerequisite closure here, same function,
   same guarantee as the student-authored path — every seeded assignment is
   completable end-to-end as shipped. */
function skSeedAssignmentsIfEmpty(){
  if(skGetAssignments().length > 0) return;
  if(typeof SKELORA_ASSIGNMENT_SEEDS === "undefined") return;
  SKELORA_ASSIGNMENT_SEEDS.forEach(seed=>{
    const expanded = (typeof skExpandDocSlugsWithPrerequisites === "function")
      ? skExpandDocSlugsWithPrerequisites(seed.docSlugs).expanded
      : seed.docSlugs;
    skCreateAssignment({
      title: seed.title,
      question: seed.question,
      docSlugs: expanded,
      track: seed.track,
      createdByName: "AS Group Assignment Bank"
    });
  });
}

/* Which track ("1-year" | "6-months") a student picked, so the Shipment
   Lot panel knows which 10 of the 20 seeded assignments to show them.
   Per-student (keyed by userId), remembered across sessions; a student can
   switch it later from the same panel. */
const SKELORA_TRACK_PREFIX = "skelora_track_v1_";
function skGetStudentTrack(userId){
  try{ return localStorage.getItem(SKELORA_TRACK_PREFIX + userId) || null; }catch(e){ return null; }
}
function skSetStudentTrack(userId, track){
  try{
    if(track) localStorage.setItem(SKELORA_TRACK_PREFIX + userId, track);
    else localStorage.removeItem(SKELORA_TRACK_PREFIX + userId); // setItem would stringify null to "null" (truthy) — must removeItem to actually clear
  }catch(e){}
}

/* True whenever there's no restriction in play (no active job, job not
   following an assignment, or the assignment was since deleted — fail
   OPEN rather than silently locking a student out of everything because
   an instructor removed an assignment after the fact). Only returns false
   when a job is actively following an assignment AND this slug is
   genuinely not on that assignment's list. */
/* PHASE 9c BUGFIX: checks membership in the REACHABLE scope (docSlugs/
   assignment docs PLUS their prerequisites — see skGetJobReachableScope
   above), not just the literal docSlugs list. Before this fix, a document
   that was a genuine prerequisite of something the student picked — but
   wasn't itself picked (this is expected when "Auto-add prerequisites" is
   off) — was locked as "not part of this Shipment Lot", while the
   student's own pick was ALSO locked waiting for that same prerequisite to
   be completed. Neither was reachable: a permanent dead end. A job with no
   scope at all (no assignment, no self-selected docSlugs — e.g. one
   created before Phase 9, or genuinely left unscoped) stays fully open,
   exactly as before — skGetJobDocScope already resolves assignment vs.
   self-scope vs. "deleted assignment, fall back to own docSlugs" for us,
   so this only needs the one extra "is there any scope at all" check. */
function skIsDocumentAllowedForJob(slug, job){
  if(!job) return true;
  if(skGetJobDocScope(job).length === 0) return true;
  return skGetJobReachableScope(job).includes(slug);
}

/* =========================================================================
   PHASE 12 — COMPANY MASTER (Customers / Suppliers address book)
   =========================================================================
   A free-form company record per student — NOT a fixed schema. Beyond
   name/role/parent, every other detail (Address, GSTIN, Annual Turnover,
   Destination, Position of contact, or anything else a student wants) is
   just a {label, value} pair in `fields`, so the list is genuinely
   unlimited and never needs a code change to add a new kind of detail.

   `role` is "Seller", "Buyer", or "Both" — used to decide which section of
   the Job form a company shows up as a pick-list option for.
   `parentCompanyId` marks a company as a subsidiary of another company
   already in this student's list (or null for a standalone/parent company).
   ========================================================================= */
const SKELORA_COMPANIES_PREFIX = "skelora_companies_v1_";
function _sk_companiesKey(userId){ return SKELORA_COMPANIES_PREFIX + userId; }

function skGetCompanies(userId){
  if(!userId) return [];
  try{ return JSON.parse(localStorage.getItem(_sk_companiesKey(userId))) || []; }
  catch(e){ return []; }
}
function _sk_saveCompanies(userId, list){
  try{ localStorage.setItem(_sk_companiesKey(userId), JSON.stringify(list)); }catch(e){}
}
function skGetCompany(userId, id){
  return skGetCompanies(userId).find(c=>c.id===id) || null;
}
/* Creates (no id given) or updates (id given) a company record.
   `fields` is always saved as an array of {label, value} — the caller
   controls the shape entirely, this function never assumes which labels
   exist. */
function skSaveCompany(userId, company){
  const list = skGetCompanies(userId);
  if(!company.id){
    company.id = "CO-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,6).toUpperCase();
    company.createdAt = new Date().toISOString();
  }
  company.fields = Array.isArray(company.fields) ? company.fields.filter(f=>f && (f.label||"").trim()) : [];
  const idx = list.findIndex(c=>c.id===company.id);
  if(idx>=0) list[idx] = company; else list.push(company);
  _sk_saveCompanies(userId, list);
  return company;
}
/* Deleting a parent never deletes its subsidiaries — they just become
   standalone companies (parentCompanyId cleared) rather than silently
   disappearing along with the parent. */
function skDeleteCompany(userId, id){
  let list = skGetCompanies(userId).filter(c=>c.id!==id);
  list = list.map(c=> c.parentCompanyId===id ? Object.assign({}, c, {parentCompanyId:null}) : c);
  _sk_saveCompanies(userId, list);
}
function skGetCompanyChildren(userId, id){
  return skGetCompanies(userId).filter(c=>c.parentCompanyId===id);
}
/* Every id in the given company's OWN ancestor chain, plus itself — used
   to stop a company being set as its own (grand)parent when picking a
   Parent Company in the edit form. */
function skGetCompanyAndDescendantIds(userId, id){
  const all = skGetCompanies(userId);
  const out = new Set([id]);
  let added = true;
  while(added){
    added = false;
    all.forEach(c=>{ if(c.parentCompanyId && out.has(c.parentCompanyId) && !out.has(c.id)){ out.add(c.id); added = true; } });
  }
  return out;
}
/* Fuzzy label match against a company's free-form fields — used to map
   saved details (Address, GSTIN, IEC, Bank Name, Authorized Signatory...)
   onto the fixed Job Master fields when a student picks a saved company.
   Labels a student typed themselves (Annual Turnover, Destination, a
   contact's Position, etc.) simply won't match anything here and are
   left for the reference list instead — nothing is lost, just not
   auto-mapped, since the Job Master has no field for them. */
function skCompanyFieldMatch(company, keywords){
  if(!company || !Array.isArray(company.fields)) return "";
  const hit = company.fields.find(f => f.label && keywords.some(k => f.label.toLowerCase().includes(k)));
  return hit ? hit.value : "";
}

/* ---------------------------------------------------------------------
   Full account deletion (Settings -> "Delete My Account"). auth.js's
   skDeleteUser() already removes the account record, progress, and
   audit log; this clears the remaining per-student keys that live in
   this file (Job Master, job sequence counter, job history, chosen
   track, and the Company Directory) so a deleted account leaves
   nothing behind on this computer. Every key here is namespaced by
   userId already, so this only ever touches the one student who asked
   for it - nobody else's data is read or written. --------------------- */
function skDeleteAllJobData(userId){
  if(!userId) return;
  try{ localStorage.removeItem(_sk_jobKey(userId)); }catch(e){}
  try{ localStorage.removeItem(_sk_jobSeqKey(userId)); }catch(e){}
  try{ localStorage.removeItem(_sk_jobHistoryKey(userId)); }catch(e){}
  try{ localStorage.removeItem(SKELORA_TRACK_PREFIX + userId); }catch(e){}
  try{ localStorage.removeItem(_sk_companiesKey(userId)); }catch(e){}
}
