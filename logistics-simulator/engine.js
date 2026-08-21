/* =========================================================================
   SKELORA INSTITUTE LOGISTICS SIMULATOR — SHARED EXERCISE ENGINE
   This file is intentionally generic: it knows nothing about any specific
   document. Each document (Commercial Invoice, Bill of Lading, ...) is just
   a config object in documents-data.js. To add a new document, add a new
   config — you should not need to touch this file.
   ========================================================================= */

const ICONS = {
  check:'<circle cx="12" cy="12" r="9"/><polyline points="8,12.5 11,15.5 16,9"/>',
  x:'<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  plus:'<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
  printer:'<polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  refresh:'<polyline points="23,4 23,10 17,10"/><polyline points="1,20 1,14 7,14"/><path d="M3.5 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.65 4.36A9 9 0 0 0 20.5 15"/>',
  chevRight:'<polyline points="9,6 15,12 9,18"/>',
  chevLeft:'<polyline points="15,18 9,12 15,6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 16,14"/>'
};
const ic = (n)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]||''}</svg>`;

/* ---------------------------------------------------------------------
   STATE
   --------------------------------------------------------------------- */
let CONFIG = null;
let CURRENT_SLUG = null;
let CURRENT_USER = null;
let formData = {};
let currentStep = 0;
let maxReached = 0;
let expandedPhases = new Set(); /* which phase names are expanded in the sidebar tracker (collapsible phase groups) */
let fieldErrors = new Set();
let fieldErrorMsgs = {};
let tableCellErrors = new Set();   /* keys: "tableName:rowIdx:colKey" — cells that failed a cellPatterns check */
let tableErrorMsgs = {};           /* tableName -> array of specific human-readable messages for its ferr banner */
let startTime = Date.now();
let timerInterval = null;

/* ---------------------------------------------------------------------
   GENERIC FIELD RENDERING
   Supported field.type: text, textarea, date, select, checkbox,
   static (read-only HTML block), computed (derived value display),
   table (repeatable rows)
   --------------------------------------------------------------------- */
function renderLearnPanel(f){
  if(!f.learn) return "";
  const l = f.learn;
  const row = (icon,label,content)=> content ? `<div style="margin-bottom:8px;"><div style="font-weight:600;font-size:11.5px;color:var(--text-2);margin-bottom:2px;">${icon} ${label}</div><div style="font-size:12.5px;color:var(--text-2);line-height:1.55;">${content}</div></div>` : "";
  return `<details class="learn-panel" style="margin-top:6px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2,#F7F6F2);">
    <summary style="cursor:pointer;padding:8px 12px;font-size:12px;font-weight:600;color:var(--accent,#8A6D3B);list-style:none;">💡 Learn about this field</summary>
    <div style="padding:4px 14px 12px;">
      ${row("📖","Explanation",l.explanation)}
      ${row("🎯","Purpose",l.purpose)}
      ${row("📝","Example",l.example)}
      ${row("⚠️","Common Mistakes",l.mistakes)}
      ${row("✅","Validation",l.validation)}
      ${row("⭐","Hint",l.hint)}
    </div>
  </details>`;
}

/* Escapes a value before it's dropped into an HTML attribute or element
   content. Fixes a real data-loss bug: without this, typing a double-quote
   into any text/date field or table cell (e.g. a 40" container size, or an
   Indian trade name written as M/s "Golden Star Textiles") broke the
   surrounding value="..." attribute on re-render (Next/Back, add/remove
   row) and silently truncated whatever the student typed after the quote. */
function escAttr(v){
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderField(f){
  if(f.showIf && !f.showIf(formData)) return "";
  if(f.type==="static"){
    return `<div class="declaration-box" style="grid-column:1/-1;">${f.html}</div>`;
  }
  if(f.type==="table") return renderTableField(f);
  if(f.type==="computed") return renderComputedField(f);

  const val = formData[f.name] ?? "";
  const req = f.required ? '<span class="req">*</span>' : "";
  const errCls = fieldErrors.has(f.name) ? "field-error" : "";
  const fullCls = f.full ? "field full" : "field";

  if(f.type==="checkbox"){
    return `<div class="${fullCls}"><label class="check-row"><input type="checkbox" data-field="${f.name}" ${formData[f.name]?"checked":""}/> <span>${f.label}</span></label>${renderLearnPanel(f)}</div>`;
  }
  let input;
  if(f.type==="textarea"){
    input = `<textarea class="finput ${errCls}" data-field="${f.name}" placeholder="${escAttr(f.placeholder||"")}">${escAttr(val)}</textarea>`;
  } else if(f.type==="select"){
    input = `<select class="finput ${errCls}" data-field="${f.name}"><option value="">Select…</option>${f.options.map(o=>`<option value="${escAttr(o)}" ${val===o?"selected":""}>${escAttr(o)}</option>`).join("")}</select>`;
  } else {
    const upStyle = f.uppercase ? ' style="text-transform:uppercase;letter-spacing:.3px;"' : "";
    input = `<input class="finput ${errCls}" type="${f.type}" data-field="${f.name}" placeholder="${escAttr(f.placeholder||"")}" value="${escAttr(val)}"${upStyle}/>`;
  }
  return `<div class="${fullCls}">
    <label>${f.label}${req}</label>
    ${input}
    ${f.help?`<div class="fhelp">${f.help}</div>`:""}
    ${fieldErrors.has(f.name)?`<div class="ferr">${fieldErrorMsgs[f.name]||"This field is required."}</div>`:""}
    ${renderLearnPanel(f)}
  </div>`;
}

function renderComputedField(f){
  const value = f.compute(formData);
  const fullCls = f.full ? "field full" : "field";
  return `<div class="${fullCls}">
    <label>${f.label}</label>
    <div class="computed-box" id="computed-${f.name}">${value}</div>
    ${f.help?`<div class="fhelp">${f.help}</div>`:""}
    ${renderLearnPanel(f)}
  </div>`;
}

function renderTableField(f){
  if(!formData[f.name] || formData[f.name].length===0){
    formData[f.name] = f.defaultRows ? f.defaultRows.map(r=>({...r})) : [ emptyRow(f) ];
  }
  const rows = formData[f.name].map((row,i)=>{
    const cells = f.columns.map(col=>{
      if(col.computed){
        const v = col.computed(row);
        return `<td class="li-amount" id="cell-${f.name}-${i}-${col.key}">${v}</td>`;
      }
      const cellErr = tableCellErrors.has(`${f.name}:${i}:${col.key}`) ? "field-error" : "";
      return `<td><input class="li-input ${col.numeric?"li-num":""} ${cellErr}" data-table="${f.name}" data-row="${i}" data-col="${col.key}" value="${escAttr(row[col.key]||"")}" placeholder="${escAttr(col.placeholder||"")}"/></td>`;
    }).join("");
    const removeBtn = formData[f.name].length>1 ? `<button class="li-remove" data-table-remove="${f.name}" data-row="${i}">${ic("x")}</button>` : "";
    return `<tr>${cells}<td>${removeBtn}</td></tr>`;
  }).join("");
  let footerRow = "";
  if(f.footer){
    footerRow = `<tfoot><tr>
      <td colspan="${f.columns.length-1}" style="text-align:right;font-weight:700;">${f.footer.label}</td>
      <td id="footer-${f.name}" style="font-weight:700;font-family:var(--mono);">${f.footer.compute(formData[f.name])}</td>
      <td></td>
    </tr></tfoot>`;
  }
  const errMsgs = tableErrorMsgs[f.name];
  const errBlock = fieldErrors.has(f.name)
    ? `<div class="ferr" style="margin-top:8px;">${
        errMsgs && errMsgs.length
          ? errMsgs.slice(0,5).map(m=>`• ${m}`).join("<br>") + (errMsgs.length>5 ? `<br>+ ${errMsgs.length-5} more` : "")
          : (f.errorMsg||"Please complete at least one row.")
      }</div>`
    : "";
  return `<div class="field full">
    <label>${f.label}${f.required?'<span class="req">*</span>':""}</label>
    ${f.help?`<div class="fhelp" style="margin-bottom:10px;">${f.help}</div>`:""}
    <div class="li-table-wrap"><table class="li-table">
      <thead><tr>${f.columns.map(c=>`<th>${c.label}</th>`).join("")}<th></th></tr></thead>
      <tbody id="tbody-${f.name}">${rows}</tbody>
      ${footerRow}
    </table></div>
    <button class="btn-secondary" data-table-add="${f.name}" style="margin-top:12px;">${ic("plus")} ${f.addLabel||"Add Row"}</button>
    ${errBlock}
  </div>`;
}
function emptyRow(f){ const r={}; f.columns.forEach(c=>{ if(!c.computed) r[c.key]=""; }); return r; }

/* Recompute a table's row + footer without a full re-render (keeps input focus) */
function refreshTableRow(tableName, rowIdx){
  const f = findFieldByName(tableName);
  if(!f) return;
  const row = formData[tableName][rowIdx];
  f.columns.forEach(col=>{
    if(col.computed){
      const cell = document.getElementById(`cell-${tableName}-${rowIdx}-${col.key}`);
      if(cell) cell.textContent = col.computed(row);
    }
  });
  if(f.footer){
    const footCell = document.getElementById(`footer-${tableName}`);
    if(footCell) footCell.textContent = f.footer.compute(formData[tableName]);
  }
  refreshDependentComputed(tableName);
}
function findFieldByName(name){
  for(const step of CONFIG.steps){
    if(step.fields){
      const f = step.fields.find(x=>x.name===name);
      if(f) return f;
    }
  }
  return null;
}

/* Update any top-level "computed" field whose deps include the changed field/table */
function refreshDependentComputed(changedName){
  CONFIG.steps.forEach(step=>{
    if(!step.fields) return;
    step.fields.forEach(f=>{
      if(f.type==="computed" && f.deps && f.deps.includes(changedName)){
        const el = document.getElementById(`computed-${f.name}`);
        if(el) el.textContent = f.compute(formData);
      }
    });
  });
}

/* ---------------------------------------------------------------------
   STEP RENDERING
   --------------------------------------------------------------------- */
const stepBody = () => document.getElementById("stepBody");

/* ===================== PHASE 8: SPLIT-SCREEN REFERENCE MODE =====================
   Opt-in only (default off, same as every existing document). When enabled, shows a
   left-hand reference panel built from each field's own label/placeholder/help - the
   exact same real example data already defined in documents-data.js - next to the
   normal editable field grid, so a student can copy from a worked example the way
   they would in a real documentation office. Nothing about the existing single-column
   layout changes unless this is switched on. */
function isSplitScreenOn(){
  try { return localStorage.getItem("skelora_split_v1") === "on"; } catch(e){ return false; }
}
function renderReferenceEntry(f){
  if(f.showIf && !f.showIf(formData)) return "";
  if(f.type==="static" || f.type==="computed") return "";
  if(f.type==="table"){
    return `<div class="ref-entry"><div class="ref-label">${f.label}</div><div class="ref-value ref-value-muted">${f.help || "See the required columns below for the exact format expected in each row."}</div></div>`;
  }
  if(f.type==="checkbox"){
    return `<div class="ref-entry"><div class="ref-label">${f.label}</div><div class="ref-value ref-value-muted">${f.help || "Confirm this once it is true for this shipment."}</div></div>`;
  }
  const example = f.placeholder ? f.placeholder : null;
  return `<div class="ref-entry">
    <div class="ref-label">${f.label}${f.required ? ' <span class="req">*</span>' : ''}</div>
    ${example ? `<div class="ref-value">${example}</div>` : `<div class="ref-value ref-value-muted">No fixed example — enter your own value.</div>`}
    ${f.help ? `<div class="ref-help">${f.help}</div>` : ""}
  </div>`;
}
function renderReferencePanel(step){
  const entries = (step.fields||[]).map(renderReferenceEntry).filter(Boolean).join("");
  if(!entries) return "";
  return `<aside class="ref-panel">
    <div class="ref-panel-head"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg> Reference Example</div>
    <div class="ref-panel-body">${entries}</div>
  </aside>`;
}

function renderStep(idx){
  const step = CONFIG.steps[idx];
  if(step.phase){
    const phaseSteps = CONFIG.steps.filter(s=>s.phase===step.phase);
    const phaseNames = [...new Set(CONFIG.steps.map(s=>s.phase).filter(Boolean))];
    const phaseNum = phaseNames.indexOf(step.phase)+1;
    const stepInPhase = phaseSteps.indexOf(step)+1;
    document.getElementById("stepEyebrow").textContent = `Phase ${phaseNum} of ${phaseNames.length} · ${step.phase} · Step ${stepInPhase} of ${phaseSteps.length} · ~${step.est} min`;
  } else {
    document.getElementById("stepEyebrow").textContent = `Step ${idx+1} of ${CONFIG.steps.length} · ~${step.est} min`;
  }
  document.getElementById("stepTitle").textContent = step.title;
  document.getElementById("stepSub").textContent = step.sub || "";
  document.getElementById("progressPill").textContent = `Step ${idx+1} of ${CONFIG.steps.length}`;

  let html = "";
  if(step.intro) html += `<div class="step-intro">${step.intro}</div>`;

  if(step.custom==="review"){
    html += renderMismatchBanner();
    html += wrapAsLetterhead(step.renderReview(formData));
    html += `<div class="pdf-download-row">
      <button class="btn-secondary" id="downloadOriginalBtn">${ic("printer")} Download Original (PDF)</button>
      <button class="btn-secondary" id="downloadCopyBtn">${ic("printer")} Download Copy (PDF)</button>
      <span id="pdfGenStatus" class="pdf-gen-status"></span>
    </div>
    <div id="pdfGenShipWrap" style="display:none;margin-top:10px;">
      <div class="ship-loader" aria-hidden="true">
        <svg viewBox="0 0 300 80" preserveAspectRatio="xMidYMid meet">
          <clipPath id="shipWaterClipPdf"><rect x="0" y="0" width="300" height="80"/></clipPath>
          <g clip-path="url(#shipWaterClipPdf)">
            <path class="sl-wave sl-wave1" d="M-50,55 Q-25,45 0,55 T50,55 T100,55 T150,55 T200,55 T250,55 T300,55 T350,55 V80 H-50 Z" fill="#1F6FEB" opacity=".5"/>
            <path class="sl-wave sl-wave2" d="M-50,60 Q-25,52 0,60 T50,60 T100,60 T150,60 T200,60 T250,60 T300,60 T350,60 V80 H-50 Z" fill="#12467D" opacity=".85"/>
            <g class="sl-ship">
              <path d="M-20,44 L46,44 L38,56 L-12,56 Z" fill="#F5820A" stroke="#111318" stroke-width="2" stroke-linejoin="round"/>
              <rect x="0" y="27" width="22" height="17" rx="2" fill="#111318"/>
              <rect x="16" y="17" width="6" height="11" rx="1" fill="#F5820A" stroke="#111318" stroke-width="1"/>
              <text x="11" y="39" font-size="8.5" font-weight="800" fill="#F5820A" text-anchor="middle" font-family="Arial,sans-serif">AS</text>
            </g>
          </g>
        </svg>
      </div>
    </div>`;
  } else if(step.custom==="complete"){
    html += renderComplete();
  } else {
    const fieldGridHtml = `<div class="field-grid">${(step.fields||[]).map(renderField).join("")}</div>`;
    if(isSplitScreenOn()){
      const refPanelHtml = renderReferencePanel(step);
      html += refPanelHtml ? `<div class="step-split">${refPanelHtml}<div class="step-split-main">${fieldGridHtml}</div></div>` : fieldGridHtml;
    } else {
      html += fieldGridHtml;
    }
  }
  stepBody().innerHTML = html;
  /* Phase 8: retrigger the fade-in animation (removing then re-adding the class,
     with a forced reflow in between, is required for CSS animations to replay) */
  const sb = stepBody();
  sb.classList.remove("step-fade-in");
  void sb.offsetWidth;
  sb.classList.add("step-fade-in");

  document.getElementById("backBtn").disabled = (idx===0);
  const nextBtn = document.getElementById("nextBtn");
  if(idx===CONFIG.steps.length-1){
    nextBtn.style.display = "none";
  } else if(step.custom==="review"){
    nextBtn.style.display = "flex";
    nextBtn.innerHTML = `Mark Complete ${ic("check")}`;
  } else {
    nextBtn.style.display = "flex";
    nextBtn.innerHTML = `Save & Continue ${ic("chevRight")}`;
  }
  renderTracker();
  bindStepButtons(step);
}

/* ---------------------------------------------------------------------
   PROGRESS PERSISTENCE (offline, per-student, this computer only)
   --------------------------------------------------------------------- */
function saveProgressSnapshot(status){
  if(!CURRENT_USER || !CURRENT_SLUG) return;
  skSaveDocProgress(CURRENT_USER.id, CURRENT_SLUG, {
    status,
    currentStep,
    maxReached,
    formData,
    docTitle: CONFIG.title
  });
  if(typeof skAppendAudit === "function"){
    const stepTitle = CONFIG.steps[currentStep] ? CONFIG.steps[currentStep].title : null;
    skAppendAudit(CURRENT_USER.id, CURRENT_SLUG, status==="completed" ? "completed" : "saved",
      {currentStep, maxReached, stepTitle, docTitle: CONFIG.title});
  }
}

/* ---------------------------------------------------------------------
   GENERIC LETTERHEAD WRAPPER
   Every one of the 11 (and future) exercise configs already renders its
   own review document via renderReview(). This wraps that output in a
   shared, professional letterhead — company name, doc-type/number,
   watermark, footer metadata, and a terms strip — without any config
   needing to know about it.
   --------------------------------------------------------------------- */
let letterheadMeta = null;
function getLetterheadMeta(){
  if(!letterheadMeta){
    letterheadMeta = {
      docId: "DOC-" + Math.random().toString(36).slice(2,10).toUpperCase(),
      verifyCode: Math.random().toString(36).slice(2,10).toUpperCase()
    };
  }
  return letterheadMeta;
}
const ISSUER_NAME_FIELDS = ["terminalName","carrierName","oceanCarrier","airlineName","issuingBankName","bankName","insuranceCompany","transporterName","vendorName","accreditedAgencyName","labName","inspectionAgency","packerCompanyName","preparedByCompany","warehouseNameOnReceipt","manufacturerName",
  "consignorName","expName","exporterName","exporterNamePhyto","importerName","shipperName","buyerName","supName","supplierName","applicantName","beneficiaryName","sellerName","fromName","drawerName","shippingLineName"];
const DOC_NUMBER_FIELDS = ["jobNumber","igmNumber","requestNumber","referenceNo","billNo","creditNoteNo","debitNoteNo","receiptNo","invoiceNo","blNumber","plNumber","lrNumber","grnNumber","flightNumber","documentNumber",
  "certificateNo","bgNumber","swbNumber",
  "lcNumber","poNumber","mawbNumber","blAwbNo",
  "packingListNo","challanNo","leoNumber","lcNo","deliveryNoteNo","ewayBillNo",
  "awbNumber","sbNumberGenerated","beNumberGenerated","lcMt700Ref","ebnGenerated","swbNumberGenerated","soNumberGenerated","proformaNo","mrNumberGenerated","declarationNo","dutyWorksheetNo","whrNumberGenerated","msdsNo","oocNumberGenerated","bookingNo","podNumber"];

function firstNonEmpty(fields, data){
  for(const f of fields){ if(data[f] && String(data[f]).trim()) return data[f]; }
  return null;
}

/* ===================== REAL CODE128B BARCODE (scannable) =====================
   This is the exact, standard Code 128 Set-B symbol table (ISO/IEC 15417) — the
   same table used by production barcode libraries. Each entry is a sequence of
   11 modules (13 for the STOP symbol), read left-to-right as bar(1)/space(0).
   Encoding: START_B + each character (ASCII 32-126, code - 32) + checksum + STOP,
   checksum = (104 + sum(charValue * position)) mod 103, position starting at 1.
   This produces a genuinely scannable barcode, not a decorative stand-in. */
const CODE128_BARS = [
  11011001100,11001101100,11001100110,10010011000,10010001100,10001001100,10011001000,10011000100,
  10001100100,11001001000,11001000100,11000100100,10110011100,10011011100,10011001110,10111001100,
  10011101100,10011100110,11001110010,11001011100,11001001110,11011100100,11001110100,11101101110,
  11101001100,11100101100,11100100110,11101100100,11100110100,11100110010,11011011000,11011000110,
  11000110110,10100011000,10001011000,10001000110,10110001000,10001101000,10001100010,11010001000,
  11000101000,11000100010,10110111000,10110001110,10001101110,10111011000,10111000110,10001110110,
  11101110110,11010001110,11000101110,11011101000,11011100010,11011101110,11101011000,11101000110,
  11100010110,11101101000,11101100010,11100011010,11101111010,11001000010,11110001010,10100110000,
  10100001100,10010110000,10010000110,10000101100,10000100110,10110010000,10110000100,10011010000,
  10011000010,10000110100,10000110010,11000010010,11001010000,11110111010,11000010100,10001111010,
  10100111100,10010111100,10010011110,10111100100,10011110100,10011110010,11110100100,11110010100,
  11110010010,11011011110,11011110110,11110110110,10101111000,10100011110,10001011110,10111101000,
  10111100010,11110101000,11110100010,10111011110,10111101110,11101011110,11110101110,11010000100,
  11010010000,11010011100,1100011101011
];
function code128Modules(text){
  const START_B = 104, STOP = 106, MODULO = 103;
  const safe = String(text).toUpperCase().replace(/[^\x20-\x7E]/g, "").slice(0, 24) || "SKELORA";
  const chars = safe.split("").map(c => c.charCodeAt(0) - 32);
  let modules = CODE128_BARS[START_B].toString();
  let checksum = START_B;
  chars.forEach((v,i)=>{ modules += CODE128_BARS[v].toString(); checksum += v*(i+1); });
  checksum = checksum % MODULO;
  modules += CODE128_BARS[checksum].toString();
  modules += CODE128_BARS[STOP].toString();
  return {modules, text: safe};
}
function renderBarcodeSVG(text){
  const {modules, text: safe} = code128Modules(text);
  const moduleW = 2;
  const height = 44;
  let x = 0, rects = "";
  for(const m of modules){
    if(m === "1") rects += `<rect x="${x}" y="0" width="${moduleW}" height="${height}" fill="#111"/>`;
    x += moduleW;
  }
  const totalWidth = modules.length * moduleW;
  return `<div class="doc-barcode-block">
    <svg viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}" height="${height}" style="display:block;max-width:100%;" preserveAspectRatio="xMinYMin meet">${rects}</svg>
    <div class="doc-barcode-text">${safe}</div>
  </div>`;
}

/* ===================== HOLOGRAM DIGITAL SEAL =====================
   A deterministic, seeded design per document type - each of the 40 document
   types gets its own combination of pattern, hue, ring text and rotation, so no
   two documents look identical, while the same document always renders the
   same seal. The color-shift "hologram" look is a real animated CSS effect
   (conic-gradient + blend mode), not a static image. */
function sealSeedRng(seedStr){
  let h = 1779033703 ^ seedStr.length;
  for(let i=0;i<seedStr.length;i++){ h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h<<13)|(h>>>19); }
  return function(){ h = Math.imul(h ^ (h>>>16), 2246822507); h = Math.imul(h ^ (h>>>13), 3266489909); return ((h ^= h>>>16)>>>0) / 4294967296; };
}
const SEAL_RING_TEXTS = [
  "SKELORA INSTITUTE • VERIFIED • ", "OFFICIAL TRAINING DOCUMENT • ", "AUTHENTICATED COPY • ", "DIGITALLY SEALED • "
];
function sealInnerPattern(kind, hue){
  const c = `hsl(${hue},70%,42%)`;
  if(kind===0) return `<circle cx="50" cy="50" r="30" fill="none" stroke="${c}" stroke-width="2"/><circle cx="50" cy="50" r="21" fill="none" stroke="${c}" stroke-width="1.4"/><circle cx="50" cy="50" r="12" fill="none" stroke="${c}" stroke-width="1"/>`;
  if(kind===1){ let l=""; for(let i=0;i<12;i++){ const a=(i*30)*Math.PI/180; l+=`<line x1="50" y1="50" x2="${50+30*Math.cos(a)}" y2="${50+30*Math.sin(a)}" stroke="${c}" stroke-width="1.6"/>`; } return l; }
  if(kind===2){ let d=""; for(let i=0;i<6;i++){ const a=(i*60)*Math.PI/180; d+=`<circle cx="${50+18*Math.cos(a)}" cy="${50+18*Math.sin(a)}" r="4" fill="${c}"/>`; } return d+`<circle cx="50" cy="50" r="4" fill="${c}"/>`; }
  if(kind===3){ let l=""; for(let r=8;r<=30;r+=7){ l+=`<circle cx="50" cy="50" r="${r}" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="3 3"/>`; } return l; }
  let d=""; for(let i=0;i<8;i++){ const a1=(i*45)*Math.PI/180, a2=((i*45)+22)*Math.PI/180; d+=`<path d="M50,50 L${50+26*Math.cos(a1)},${50+26*Math.sin(a1)} L${50+26*Math.cos(a2)},${50+26*Math.sin(a2)} Z" fill="${c}" opacity=".55"/>`; } return d;
}
function renderHologramSeal(seedStr, initials){
  const rng = sealSeedRng(seedStr);
  const hue = Math.floor(rng()*360);
  const kind = Math.floor(rng()*5);
  const ringText = SEAL_RING_TEXTS[Math.floor(rng()*SEAL_RING_TEXTS.length)];
  const rotation = Math.floor(rng()*360);
  const arcId = "sealArc" + Math.abs(seedStr.split("").reduce((a,c)=>a+c.charCodeAt(0),0));
  const fullRingText = (ringText + ringText).slice(0, 40);
  return `<div class="holo-seal" style="transform:rotate(${rotation}deg);" title="Hologram digital seal — training specimen, not a real security feature">
    <svg viewBox="0 0 100 100" width="100" height="100">
      <defs><path id="${arcId}" d="M 50,50 m -42,0 a 42,42 0 1,1 84,0 a 42,42 0 1,1 -84,0"/></defs>
      <circle cx="50" cy="50" r="47" fill="#fff" stroke="hsl(${hue},60%,55%)" stroke-width="1"/>
      <text font-size="6.4" fill="hsl(${hue},55%,38%)" letter-spacing="1" font-family="var(--mono)">
        <textPath href="#${arcId}" startOffset="0%">${fullRingText}</textPath>
      </text>
      <g transform="rotate(${-rotation} 50 50)">${sealInnerPattern(kind, hue)}</g>
      <text x="50" y="53" text-anchor="middle" font-size="11" font-weight="800" fill="hsl(${hue},60%,32%)" font-family="var(--sans)" transform="rotate(${-rotation} 50 50)">${initials}</text>
    </svg>
    <div class="holo-shimmer" style="--holo-hue:${hue}deg;"></div>
  </div>`;
}

/* PHASE 3: Cross-document validation banner — generic for every document,
   nothing here is per-document config. Compares this document's own
   contextKey-tagged fields against the canonical transaction context from
   other already-completed documents (and the active Job, if any), and
   shows a plain-language warning if any disagree. Purely informational —
   never blocks "Mark Complete". Falls back to "" if workflow-rules.js
   isn't loaded, so nothing breaks on a page that predates this feature. */
function renderMismatchBanner(){
  if(typeof skGetTransactionContext !== "function" || typeof skFindDocumentMismatches !== "function") return "";
  const context = skGetTransactionContext(CURRENT_USER.id);
  const mismatches = skFindDocumentMismatches(CONFIG, formData, context);
  if(mismatches.length === 0) return "";
  const rows = mismatches.map(m => `
    <li style="margin-bottom:8px;">
      <b>${m.label}</b>: this document says <code>${m.thisValue}</code>, but <b>${m.canonicalSource}</b> already says <code>${m.canonicalValue}</code>.
    </li>`).join("");
  return `<div id="mismatchBanner" style="margin-bottom:18px;padding:16px 20px;border-radius:10px;background:#FBF1DE;border:1.5px solid #E8C77A;color:#5B4400;">
    <div style="font-weight:700;font-size:13.5px;margin-bottom:8px;">⚠️ Cross-Document Mismatch — ${mismatches.length} field${mismatches.length>1?'s':''} disagree with an earlier document</div>
    <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.5;">${rows}</ul>
    <div style="font-size:12px;margin-top:8px;opacity:.85;">You can still mark this complete — but in a real transaction this is exactly the kind of discrepancy that gets a shipment held at customs or a bank presentation rejected. Worth double-checking before moving on.</div>
  </div>`;
}

function wrapAsLetterhead(innerHtml){
  const issuer = firstNonEmpty(ISSUER_NAME_FIELDS, formData) || "Skelora Institute Logistics Simulator";
  const docNumber = firstNonEmpty(DOC_NUMBER_FIELDS, formData) || CONFIG.docCodeExample;
  const meta = getLetterheadMeta();
  const placeOfIssue = firstNonEmpty(["placeOfIssue","portOfLoading","originCity","issuePlace","signPlace"], formData) || "—";
  const issueDate = firstNonEmpty(["shippedOnBoardDate","issueDate","dateOfIssue","jobDate","importDate","invoiceDate","docDate","signDate"], formData) || new Date().toISOString().slice(0,10);
  const sealInitials = CONFIG.title.split(/\s+/).map(w=>w[0]).join("").slice(0,3).toUpperCase();
  const barcodeValue = String(docNumber).toUpperCase() !== String(CONFIG.docCodeExample).toUpperCase() ? docNumber : (meta.docId + meta.verifyCode);
  const govtBand = CONFIG.govtIssuer ? `<div class="doc-govt-band">
    <div class="doc-govt-emblem" title="Specimen mark for training purposes only — not an official Government of India emblem">
      <svg viewBox="0 0 40 40" width="34" height="34"><circle cx="20" cy="20" r="18" fill="none" stroke="#8a6d1f" stroke-width="1.6"/><circle cx="20" cy="20" r="12" fill="none" stroke="#8a6d1f" stroke-width="1"/>${Array.from({length:24}).map((_,i)=>{const a=i*15*Math.PI/180;return `<line x1="20" y1="20" x2="${20+17*Math.cos(a)}" y2="${20+17*Math.sin(a)}" stroke="#8a6d1f" stroke-width="0.6"/>`;}).join("")}</svg>
    </div>
    <div class="doc-govt-text">
      <div class="l1">${CONFIG.govtIssuer.line1}</div>
      <div class="l2">${CONFIG.govtIssuer.line2}</div>
      <div class="l3">${CONFIG.govtIssuer.line3}</div>
    </div>
  </div>` : "";
  const govtFiledVia = CONFIG.govtIssuer ? `<div class="doc-govt-filedvia">${CONFIG.govtIssuer.filedVia}</div>` : "";
  const regulatoryNoteHtml = CONFIG.regulatoryNote ? `<div class="doc-regulatory-note">${CONFIG.regulatoryNote}</div>` : "";
  return `<div class="doc-letterhead">
    <div class="doc-watermark"><span>${CONFIG.title}</span></div>
    ${govtBand}
    <div class="doc-lh-head">
      <div>
        <div class="doc-lh-name">${issuer}</div>
        <div class="doc-lh-sub">${CONFIG.subtitle}</div>
        ${govtFiledVia}
        ${regulatoryNoteHtml}
      </div>
      <div class="doc-lh-type">
        <div class="t">${CONFIG.title}</div>
        <div class="n">No. ${docNumber}</div>
      </div>
    </div>
    <div class="doc-lh-rule"></div>
    ${innerHtml}
    <div class="doc-stamp-row">
      <div style="display:flex;align-items:flex-end;gap:16px;">
        <div>
          <div style="font-size:11.5px;color:var(--text-2);margin-bottom:10px;">Issued: <b>${issueDate}</b> — Place of Issue: <b>${placeOfIssue}</b></div>
          <div class="doc-stamp-circle">Official<br>Stamp Area</div>
        </div>
        ${renderHologramSeal(CONFIG.title + docNumber, sealInitials)}
      </div>
      <div class="doc-sig-blank">
        <div class="box"></div>
        <div class="cap">Authorized Signatory — ${issuer}</div>
      </div>
    </div>
    <div class="doc-barcode-row">
      ${renderBarcodeSVG(barcodeValue)}
    </div>
    <div class="doc-footer-meta">
      <span>Document ID: ${meta.docId}</span>
      <span>Verification Code: ${meta.verifyCode}</span>
      <span>Issued: ${new Date().toISOString()}</span>
      <span>Rev. 1 · Page 1 of 1</span>
    </div>
    <div class="doc-terms">
      <h5>Terms &amp; Conditions (Training Reference Copy)</h5>
      <ol>
        <li>This document is a specimen produced for educational purposes within a training simulation and carries no legal or commercial validity.</li>
        <li>In practice, the issuer's full liability terms, jurisdiction, and governing conventions would be printed in full on the reverse of an original document.</li>
        <li>The party who supplied these particulars warrants their accuracy; the simulator does not verify them against any real-world registry.</li>
        <li>This training document should be used strictly for classroom, assessment, and simulation purposes.</li>
      </ol>
    </div>
  </div>`;
}

function renderComplete(){
  clearInterval(timerInterval);
  const secs = Math.floor((Date.now()-startTime)/1000);
  const mm = String(Math.floor(secs/60)).padStart(2,"0"), ss=String(secs%60).padStart(2,"0");
  saveProgressSnapshot("completed");

  // PHASE 9b: if this document belongs to the student's active Job, offer
  // a one-click path straight into the NEXT document that Job still
  // needs — in prerequisite-safe order (skGetNextJobDocument, job-engine.js)
  // — instead of sending them back to the Document Library to find it
  // themselves. Once every document in the Job is done, point at the
  // dashboard instead, where the completed scenario + ZIP download live.
  let jobNextHtml = "";
  if(CURRENT_USER && typeof skGetActiveJob === "function" && typeof skGetNextJobDocument === "function"){
    const activeJob = skGetActiveJob(CURRENT_USER.id);
    if(activeJob){
      const nextSlug = skGetNextJobDocument(CURRENT_USER.id, activeJob);
      if(nextSlug){
        const nextTitle = (typeof DOCUMENT_CONFIGS !== "undefined" && DOCUMENT_CONFIGS[nextSlug]) ? DOCUMENT_CONFIGS[nextSlug].title : nextSlug;
        jobNextHtml = `<a class="btn-primary" id="nextJobDocBtn" href="workstation.html?doc=${encodeURIComponent(nextSlug)}">${ic("chevRight")} Continue — Next: ${nextTitle}</a>`;
      } else if(typeof skGetJobDocScope === "function" && skGetJobDocScope(activeJob).length > 0){
        jobNextHtml = `<a class="btn-primary" id="jobDoneBtn" href="skelora-institute-dashboard.html">${ic("check")} Every document in this Shipment Lot is done — Back to Dashboard</a>`;
      }
    }
  }

  return `<div class="cert">
    <div class="cert-ic">${ic("check")}</div>
    <h2>Exercise Completed</h2>
    <p>${CONFIG.completionMessage}</p>
    <div class="cert-stats">
      <div class="cert-stat"><div class="v">${CONFIG.docCodeExample}</div><div class="l">Document Number Assigned</div></div>
      <div class="cert-stat"><div class="v">${mm}:${ss}</div><div class="l">Time Taken</div></div>
      <div class="cert-stat"><div class="v">${CONFIG.steps.length} / ${CONFIG.steps.length}</div><div class="l">Sections Completed</div></div>
    </div>
    <div class="cert-actions">
      ${jobNextHtml}
      <button class="btn-secondary" id="restartBtn">${ic("refresh")} Restart Exercise</button>
      <button class="btn-secondary" id="reviewAgainBtn">Review Document Again</button>
      <a class="btn-secondary" href="skelora-institute-dashboard.html">Back to Document Library</a>
    </div>
  </div>`;
}

/* ===================== REAL PDF DOWNLOAD (Original / Copy, with watermark) =====================
   Uses html2canvas + jsPDF (loaded via CDN in workstation.html) to produce a genuine, real PDF
   file download - not the browser's print dialog. Captures the actual letterhead exactly as
   rendered (barcode, hologram seal, tables, all included), adds a real "ORIGINAL" or "COPY"
   watermark for this specific download, and supports multi-page output for long documents. */
async function generateDocumentPDF(variant){
  const statusEl = document.getElementById("pdfGenStatus");
  const shipWrap = document.getElementById("pdfGenShipWrap");
  const letterheadEl = document.querySelector(".doc-letterhead");
  if(!letterheadEl){ showToast("Could not find the document to export."); return; }
  if(typeof html2canvas === "undefined" || typeof window.jspdf === "undefined"){
    showToast("PDF tools didn't load — check your internet connection and try again.");
    return;
  }
  if(statusEl) statusEl.textContent = "Generating " + variant + " PDF…";
  if(shipWrap) shipWrap.style.display = "block";
  const shipShownAt = Date.now();
  const MIN_SHIP_MS = 3000;
  async function waitOutMinShipTime(){
    const elapsed = Date.now() - shipShownAt;
    if(elapsed < MIN_SHIP_MS) await new Promise(r=>setTimeout(r, MIN_SHIP_MS - elapsed));
  }
  document.getElementById("downloadOriginalBtn").disabled = true;
  document.getElementById("downloadCopyBtn").disabled = true;

  /* Temporary watermark overlay - added just for this capture, then removed */
  const watermark = document.createElement("div");
  watermark.className = "pdf-variant-watermark";
  watermark.textContent = variant;
  letterheadEl.appendChild(watermark);

  try {
    const canvas = await html2canvas(letterheadEl, {scale:2, useCORS:true, backgroundColor:"#ffffff"});
    watermark.remove();

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({orientation:"portrait", unit:"mm", format:"a4"});
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while(heightLeft > 0){
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const meta = getLetterheadMeta();
    const docNumber = (firstNonEmpty(DOC_NUMBER_FIELDS, formData) || CONFIG.docCodeExample).toString().replace(/[^a-zA-Z0-9_-]+/g, "-");
    const filename = `${CONFIG.title.replace(/[^a-zA-Z0-9_-]+/g,"-")}-${docNumber}-${variant}.pdf`;
    pdf.save(filename);
    if(statusEl) statusEl.textContent = variant + " PDF downloaded.";
    await waitOutMinShipTime();
    if(shipWrap) shipWrap.style.display = "none";
    if(CURRENT_USER && CURRENT_SLUG && typeof skAppendAudit === "function"){
      skAppendAudit(CURRENT_USER.id, CURRENT_SLUG, "saved", {note:variant + " PDF exported", docTitle:CONFIG.title});
    }
  } catch(err){
    watermark.remove();
    showToast("Couldn't generate the PDF. Please try again.");
    if(statusEl) statusEl.textContent = "";
    await waitOutMinShipTime();
    if(shipWrap) shipWrap.style.display = "none";
  } finally {
    document.getElementById("downloadOriginalBtn").disabled = false;
    document.getElementById("downloadCopyBtn").disabled = false;
  }
}

function bindStepButtons(step){
  const downloadOriginalBtn = document.getElementById("downloadOriginalBtn");
  if(downloadOriginalBtn) downloadOriginalBtn.addEventListener("click", ()=>generateDocumentPDF("ORIGINAL"));
  const downloadCopyBtn = document.getElementById("downloadCopyBtn");
  if(downloadCopyBtn) downloadCopyBtn.addEventListener("click", ()=>generateDocumentPDF("COPY"));
  const restartBtn = document.getElementById("restartBtn");
  if(restartBtn) restartBtn.addEventListener("click", ()=>{
    formData = {};
    if(typeof skGetTransactionContext === "function" && typeof skApplyContextAutofill === "function" && CURRENT_USER){
      formData = skApplyContextAutofill(CONFIG, formData, skGetTransactionContext(CURRENT_USER.id));
    }
    currentStep = 0; maxReached = 0; fieldErrors.clear();
    startTime = Date.now();
    letterheadMeta = null;
    clearInterval(timerInterval); timerInterval = setInterval(updateTimer,1000);
    if(CURRENT_USER && CURRENT_SLUG) skSaveDocProgress(CURRENT_USER.id, CURRENT_SLUG, {status:'in-progress', currentStep:0, maxReached:0, formData, docTitle:CONFIG.title});
    if(CURRENT_USER && CURRENT_SLUG && typeof skAppendAudit === "function") skAppendAudit(CURRENT_USER.id, CURRENT_SLUG, "restarted", {docTitle:CONFIG.title});
    renderStep(0);
  });
  const reviewAgainBtn = document.getElementById("reviewAgainBtn");
  if(reviewAgainBtn) reviewAgainBtn.addEventListener("click", ()=>{
    const reviewIdx = CONFIG.steps.findIndex(s=>s.custom==="review");
    currentStep = reviewIdx; renderStep(currentStep);
  });
}

/* ---------------------------------------------------------------------
   PHASE OVERVIEW (at-a-glance panel for documents with phase-grouped steps)
   --------------------------------------------------------------------- */
function renderPhaseOverview(){
  const el = document.getElementById("bannerPhaseOverview");
  if(!el) return;
  const phaseNames = [...new Set(CONFIG.steps.map(s=>s.phase).filter(Boolean))];
  if(phaseNames.length === 0){ el.innerHTML = ""; el.style.display = "none"; return; }

  el.style.display = "";
  const firstIndexOfPhase = {};
  CONFIG.steps.forEach((s,i)=>{ if(s.phase && !(s.phase in firstIndexOfPhase)) firstIndexOfPhase[s.phase] = i; });
  const stepCountOfPhase = {};
  CONFIG.steps.forEach(s=>{ if(s.phase) stepCountOfPhase[s.phase] = (stepCountOfPhase[s.phase]||0)+1; });

  el.innerHTML = `<div class="phase-overview-title">${phaseNames.length} Phases · ${CONFIG.steps.filter(s=>s.phase).length} Steps — Full Lifecycle Overview</div>
    <div class="phase-overview-grid">
      ${phaseNames.map((name,i)=>{
        const idx = firstIndexOfPhase[name];
        const reachable = idx <= maxReached || idx === currentStep;
        const done = idx < maxReached;
        return `<div class="phase-chip${done?" done":""}${!reachable?" locked":""}" data-jump="${idx}">
          <span class="phase-chip-num">${i+1}</span>
          <span class="phase-chip-text"><span class="phase-chip-name">${name}</span><span class="phase-chip-count">${stepCountOfPhase[name]} steps</span></span>
        </div>`;
      }).join("")}
    </div>`;

  el.querySelectorAll(".phase-chip").forEach(chip=>{
    chip.addEventListener("click", ()=>{
      const idx = +chip.dataset.jump;
      if(idx<=maxReached || idx===currentStep){ currentStep=idx; renderStep(idx); window.scrollTo({top:0,behavior:"smooth"}); }
      else showToast("Complete the current phase first.");
    });
  });
}

/* ---------------------------------------------------------------------
   TRACKER
   --------------------------------------------------------------------- */
function renderTracker(){
  renderPhaseOverview();
  const t = document.getElementById("tracker");
  const steps = CONFIG.steps;
  const hasPhases = steps.some(s=>s.phase);

  if(!hasPhases){
    /* Unchanged behavior for every document without phases - flat step list, exactly as before */
    t.innerHTML = steps.map((s,i)=>{
      let cls = "track-item";
      if(i===currentStep) cls+=" current";
      else if(i<=maxReached) cls+=" done";
      const showCheck = (i<maxReached || i<currentStep);
      const num = showCheck ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><polyline points="20,6 9,17 4,12"/></svg>` : (i+1);
      return `<div class="${cls}" data-step="${i}">
        <div class="track-num">${num}</div>
        <div class="track-text"><div class="track-title">${s.title}</div><div class="track-time">~${s.est} min</div></div>
      </div>`;
    }).join("");
    t.querySelectorAll(".track-item").forEach(el=>{
      el.addEventListener("click", ()=>{
        const idx = +el.dataset.step;
        if(idx<=maxReached || idx===currentStep){ currentStep=idx; renderStep(idx); window.scrollTo({top:0,behavior:"smooth"}); }
        else showToast("Complete the current section first.");
      });
    });
    return;
  }

  /* Phase-grouped documents (currently: Bill of Lading) - collapsible phase headers.
     Sidebar shows 19 phase rows by default; expanding one reveals its 10 steps.
     Total step count is unchanged (192) - this only changes how the tracker displays them. */
  const currentPhase = steps[currentStep] ? steps[currentStep].phase : null;
  if(currentPhase) expandedPhases.add(currentPhase); /* always keep the phase you're in visible */

  const phaseOrder = [];
  const phaseSteps = {};
  steps.forEach((s,i)=>{
    if(!s.phase) return;
    if(!phaseSteps[s.phase]){ phaseSteps[s.phase] = []; phaseOrder.push(s.phase); }
    phaseSteps[s.phase].push(i);
  });

  let html = "";
  phaseOrder.forEach((phaseName, pIdx)=>{
    const indices = phaseSteps[phaseName];
    const doneCount = indices.filter(i => i<=maxReached && i!==currentStep).length;
    const isExpanded = expandedPhases.has(phaseName);
    const isCurrentPhase = phaseName===currentPhase;
    const chevron = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="track-phase-chevron ${isExpanded?'open':''}"><polyline points="9,6 15,12 9,18"/></svg>`;
    html += `<div class="track-phase-header ${isCurrentPhase?'active-phase':''}" data-phase="${encodeURIComponent(phaseName)}">
      <span class="track-phase-num">${pIdx+1}.</span>
      <span class="track-phase-name">${phaseName}</span>
      <span class="track-phase-count">${doneCount}/${indices.length}</span>
      ${chevron}
    </div>`;
    if(isExpanded){
      indices.forEach(i=>{
        const s = steps[i];
        let cls = "track-item track-item-sub";
        if(i===currentStep) cls+=" current";
        else if(i<=maxReached) cls+=" done";
        const showCheck = (i<maxReached || i<currentStep);
        const num = showCheck ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><polyline points="20,6 9,17 4,12"/></svg>` : (i+1);
        html += `<div class="${cls}" data-step="${i}">
          <div class="track-num">${num}</div>
          <div class="track-text"><div class="track-title">${s.title}</div><div class="track-time">~${s.est} min</div></div>
        </div>`;
      });
    }
  });

  /* Non-phase steps at the end (Review Document, Completion) always show, ungrouped */
  steps.forEach((s,i)=>{
    if(s.phase) return;
    let cls = "track-item";
    if(i===currentStep) cls+=" current";
    else if(i<=maxReached) cls+=" done";
    const showCheck = (i<maxReached || i<currentStep);
    const num = showCheck ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><polyline points="20,6 9,17 4,12"/></svg>` : (i+1);
    html += `<div class="${cls}" data-step="${i}">
      <div class="track-num">${num}</div>
      <div class="track-text"><div class="track-title">${s.title}</div><div class="track-time">~${s.est} min</div></div>
    </div>`;
  });

  t.innerHTML = html;

  t.querySelectorAll(".track-phase-header").forEach(el=>{
    el.addEventListener("click", ()=>{
      const phaseName = decodeURIComponent(el.dataset.phase);
      if(expandedPhases.has(phaseName)) expandedPhases.delete(phaseName);
      else expandedPhases.add(phaseName);
      renderTracker();
    });
  });
  t.querySelectorAll(".track-item").forEach(el=>{
    el.addEventListener("click", ()=>{
      const idx = +el.dataset.step;
      if(idx<=maxReached || idx===currentStep){ currentStep=idx; renderStep(idx); window.scrollTo({top:0,behavior:"smooth"}); }
      else showToast("Complete the current section first.");
    });
  });
}

/* ---------------------------------------------------------------------
   VALIDATION
   --------------------------------------------------------------------- */
/* Turn a cellPatterns regex into a plain-English hint, so a rejected cell tells the
   student what's actually wrong instead of a generic "add at least one item" message. */
function describeCellPattern(pattern){
  if(pattern === "^\\d{6,10}$") return "must be 6–10 digits only — no spaces, dots or letters.";
  if(pattern.indexOf("\\.\\d{1,2}") !== -1 || pattern.indexOf("\\.\\d{1,3}") !== -1) return "must be a plain number (no commas or currency symbols), with only a few decimal places.";
  if(pattern === "^\\d+$") return "must be a whole number, digits only.";
  if(pattern.indexOf("[A-Z0-9\\-]") !== -1) return "should only contain capital letters, numbers and hyphens.";
  if(pattern.indexOf("[A-Za-z0-9") !== -1) return "contains a character that isn't allowed for this field.";
  return "doesn't match the expected format for this field.";
}

function validateStep(idx){
  const step = CONFIG.steps[idx];
  fieldErrors.clear();
  fieldErrorMsgs = {};
  tableCellErrors.clear();
  tableErrorMsgs = {};
  let valid = true;
  (step.fields||[]).forEach(f=>{
    if(f.type==="static" || f.type==="computed") return;
    if(f.showIf && !f.showIf(formData)) return;
    if(f.type==="table"){
      const rows = formData[f.name]||[];
      let tableOk = true;
      const msgs = [];

      // Strict per-cell pattern checks (e.g. container numbers, HS codes) on any filled cell,
      // tracked per-cell so we can point at exactly which row/column is wrong and why.
      if(f.cellPatterns){
        rows.forEach((r,ri)=>{
          Object.keys(f.cellPatterns).forEach(colKey=>{
            const cv = r[colKey];
            if(cv && String(cv).trim()!==""){
              const patDef = f.cellPatterns[colKey];
              const re = new RegExp(patDef.pattern);
              if(!re.test(String(cv).trim())){
                tableCellErrors.add(`${f.name}:${ri}:${colKey}`);
                tableOk = false;
                const col = (f.columns||[]).find(c=>c.key===colKey);
                const colLabel = col ? col.label : colKey;
                msgs.push(`Row ${ri+1}: "${colLabel}" ${patDef.msg || describeCellPattern(patDef.pattern)}`);
              }
            }
          });
        });
      }

      if(f.required){
        const hasCleanRow = rows.some((r,ri) => (f.requiredCols||[]).every(c=>{
          const v = r[c];
          const filled = v!==undefined && v!==null && String(v).trim()!=="";
          return filled && !tableCellErrors.has(`${f.name}:${ri}:${c}`);
        }));
        if(!hasCleanRow){
          tableOk = false;
          // Only fall back to the generic "add an item" message when nothing more specific applies —
          // otherwise a student who DID fill the row correctly but mistyped one cell sees a message
          // that tells them to add a row that's already there.
          if(msgs.length===0) msgs.push(f.errorMsg || "Please complete at least one row.");
        }
      }

      if(!tableOk){ fieldErrors.add(f.name); tableErrorMsgs[f.name] = msgs; valid=false; }
      return;
    }
    const v = formData[f.name];
    if(f.type==="checkbox"){
      if(f.required && !v){ fieldErrors.add(f.name); valid=false; }
      return;
    }
    const has = v!==undefined && v!==null && String(v).trim()!=="";
    if(f.required && !has){ fieldErrors.add(f.name); fieldErrorMsgs[f.name]=f.requiredMsg||"This field is required."; valid=false; return; }
    if(has && f.pattern){
      const re = new RegExp(f.pattern);
      if(!re.test(String(v).trim())){ fieldErrors.add(f.name); fieldErrorMsgs[f.name]=f.patternMsg||"Invalid format."; valid=false; }
    }
  });
  return valid;
}

/* ---------------------------------------------------------------------
   NAVIGATION
   --------------------------------------------------------------------- */
/* A short (2-3s, randomized) full-screen wave transition — used between
   a student clicking Next (after their step already validated) and the
   next step actually appearing. Purely cosmetic pacing, so it always
   fires the callback even if something about the overlay itself fails. */
let _skWaveTransitionActive = false;
function skShowWaveTransition(callback){
  if(_skWaveTransitionActive){ return; } // ignore a double-click while one is already running
  _skWaveTransitionActive = true;
  try{
    const overlay = document.createElement("div");
    overlay.className = "wave-transition-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `<div class="ship-loader">
      <svg viewBox="0 0 300 80" preserveAspectRatio="xMidYMid meet">
        <clipPath id="shipWaterClipTrans"><rect x="0" y="0" width="300" height="80"/></clipPath>
        <g clip-path="url(#shipWaterClipTrans)">
          <path class="sl-wave sl-wave1" d="M-50,55 Q-25,45 0,55 T50,55 T100,55 T150,55 T200,55 T250,55 T300,55 T350,55 V80 H-50 Z" fill="#1F6FEB" opacity=".5"/>
          <path class="sl-wave sl-wave2" d="M-50,60 Q-25,52 0,60 T50,60 T100,60 T150,60 T200,60 T250,60 T300,60 T350,60 V80 H-50 Z" fill="#12467D" opacity=".85"/>
          <g class="sl-ship">
            <path d="M-20,44 L46,44 L38,56 L-12,56 Z" fill="#F5820A" stroke="#111318" stroke-width="2" stroke-linejoin="round"/>
            <rect x="0" y="27" width="22" height="17" rx="2" fill="#111318"/>
            <rect x="16" y="17" width="6" height="11" rx="1" fill="#F5820A" stroke="#111318" stroke-width="1"/>
            <text x="11" y="39" font-size="8.5" font-weight="800" fill="#F5820A" text-anchor="middle" font-family="Arial,sans-serif">AS</text>
          </g>
        </g>
      </svg>
    </div>`;
    document.body.appendChild(overlay);
    const duration = 2000 + Math.floor(Math.random() * 1001); // 2000-3000ms, varies each time
    setTimeout(()=>{ overlay.remove(); _skWaveTransitionActive = false; callback(); }, duration);
  } catch(e){
    _skWaveTransitionActive = false;
    callback(); // never let a cosmetic overlay block real navigation
  }
}

function goNext(){
  if(!validateStep(currentStep)){ renderStep(currentStep); showToast("Please complete the required fields before continuing."); return; }
  skShowWaveTransition(()=>{
    maxReached = Math.max(maxReached, currentStep+1);
    currentStep = Math.min(currentStep+1, CONFIG.steps.length-1);
    saveProgressSnapshot('in-progress');
    renderStep(currentStep);
    window.scrollTo({top:0,behavior:"smooth"});
  });
}
function goBack(){
  if(currentStep>0){ currentStep--; renderStep(currentStep); window.scrollTo({top:0,behavior:"smooth"}); }
}

/* ---------------------------------------------------------------------
   EVENT DELEGATION (bound once, works for every step since content is
   swapped inside #stepBody)
   --------------------------------------------------------------------- */
function attachDelegation(){
  const body = stepBody();
  body.addEventListener("input", e=>{
    const t = e.target;
    if(t.dataset.field){
      const f = findFieldByName(t.dataset.field);
      let val = t.value;
      if(f && f.uppercase){ val = val.toUpperCase(); t.value = val; }
      formData[t.dataset.field] = val;
      fieldErrors.delete(t.dataset.field);
      t.classList.remove("field-error");
      refreshDependentComputed(t.dataset.field);
    } else if(t.dataset.table!==undefined){
      const tableName = t.dataset.table, rowIdx = +t.dataset.row, col = t.dataset.col;
      formData[tableName][rowIdx][col] = t.value;
      tableCellErrors.delete(`${tableName}:${rowIdx}:${col}`);
      t.classList.remove("field-error");
      refreshTableRow(tableName, rowIdx);
    }
  });
  body.addEventListener("change", e=>{
    const t = e.target;
    if(t.type==="checkbox" && t.dataset.field){
      formData[t.dataset.field] = t.checked;
      fieldErrors.delete(t.dataset.field);
      const f = findFieldByName(t.dataset.field);
      if(f && f.reRenderOnChange) renderStep(currentStep);
    } else if(t.tagName==="SELECT" && t.dataset.field){
      formData[t.dataset.field] = t.value;
      fieldErrors.delete(t.dataset.field);
      const f = findFieldByName(t.dataset.field);
      if(f && f.reRenderOnChange) renderStep(currentStep);
    }
  });
  body.addEventListener("click", e=>{
    const addBtn = e.target.closest("[data-table-add]");
    if(addBtn){
      const name = addBtn.dataset.tableAdd;
      const f = findFieldByName(name);
      formData[name].push(emptyRow(f));
      renderStep(currentStep);
      return;
    }
    const remBtn = e.target.closest("[data-table-remove]");
    if(remBtn){
      const name = remBtn.dataset.tableRemove, row = +remBtn.dataset.row;
      formData[name].splice(row,1);
      // Row indices shifted — any per-cell error keys for this table are now unreliable.
      Array.from(tableCellErrors).forEach(key=>{ if(key.indexOf(name+":")===0) tableCellErrors.delete(key); });
      renderStep(currentStep);
    }
  });
  document.getElementById("nextBtn").addEventListener("click", goNext);
  document.getElementById("backBtn").addEventListener("click", goBack);
}

/* ---------------------------------------------------------------------
   TIMER + TOAST
   --------------------------------------------------------------------- */
function updateTimer(){
  const secs = Math.floor((Date.now()-startTime)/1000);
  const m = String(Math.floor(secs/60)).padStart(2,"0");
  const s = String(secs%60).padStart(2,"0");
  const el = document.getElementById("timerDisplay");
  if(el) el.textContent = `${m}:${s}`;
}
let toastTimer;
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.opacity = "1"; t.style.transform = "translateX(-50%) translateY(0)";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.style.opacity="0"; t.style.transform="translateX(-50%) translateY(20px)"; }, 3200);
}

/* ---------------------------------------------------------------------
   BOOT
   --------------------------------------------------------------------- */
function boot(){
  CURRENT_USER = skRequireAuth();
  if(!CURRENT_USER) return; // skRequireAuth already redirects to login.html

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("doc") || Object.keys(DOCUMENT_CONFIGS)[0];
  CURRENT_SLUG = slug;
  CONFIG = DOCUMENT_CONFIGS[slug];
  if(!CONFIG){
    document.body.innerHTML = `<div style="max-width:560px;margin:80px auto;text-align:center;font-family:sans-serif;color:#5B6472;">
      <h2 style="color:#101828;">Exercise not found</h2>
      <p>No fill-in exercise is configured for "<b>${slug}</b>" yet.</p>
      <a href="skelora-institute-dashboard.html" style="color:#1F6FEB;font-weight:700;">← Back to Document Library</a>
    </div>`;
    return;
  }

  // ---- Job scope rule: if this student's active Job is following a
  // faculty-created assignment, only documents on that assignment's list
  // are reachable; otherwise, only the documents the student themselves
  // picked when creating the Shipment Lot are — including by typing the URL
  // directly, not just via the dashboard's Document Library UI. ----
  if(typeof skGetActiveJob === "function" && typeof skIsDocumentAllowedForJob === "function"){
    const activeJob = skGetActiveJob(CURRENT_USER.id);
    if(activeJob && !skIsDocumentAllowedForJob(slug, activeJob)){
      const assignment = (activeJob.assignmentId && typeof skGetAssignment === "function") ? skGetAssignment(activeJob.assignmentId) : null;
      const heading = assignment ? "Not part of your assignment" : "Not part of your current Shipment Lot";
      const body = assignment
        ? `Your active Shipment Lot is following the assignment "<b>${assignment.title}</b>", which doesn't include this document. Ask your instructor if this looks wrong, or open the Shipment Lot panel on the dashboard to change or remove the assignment.`
        : `Your active Shipment Lot only unlocks the documents you picked when you created it, and this one isn't in that list. Open the Shipment Lot panel on the dashboard to edit the Shipment Lot and add it, or finish this Shipment Lot and start a new one that includes it.`;
      document.body.innerHTML = `<div style="max-width:560px;margin:80px auto;text-align:center;font-family:sans-serif;color:#5B6472;padding:0 20px;">
        <h2 style="color:#101828;">${heading}</h2>
        <p>${body}</p>
        <a href="skelora-institute-dashboard.html" style="color:#1F6FEB;font-weight:700;">← Back to Document Library</a>
      </div>`;
      return;
    }
  }

  // ---- Strict workflow rule: block this document if a real prerequisite isn't done yet ----
  if(typeof skCheckPrerequisites === "function"){
    const gate = skCheckPrerequisites(CURRENT_USER.id, slug);
    if(!gate.ok){
      const missingList = gate.missing.map(m=>{
        const missingUrl = (typeof EXERCISES!=="undefined") ? Object.values(EXERCISES).find(u=>u.includes("doc="+m.slug)) : null;
        return `<li style="margin-bottom:8px;">
          <b>${m.title}</b> — not completed yet
          ${missingUrl ? `<a href="${missingUrl}" style="margin-left:8px;color:#1F6FEB;font-weight:600;">Start this first →</a>` : ""}
        </li>`;
      }).join("");
      document.body.innerHTML = `<div style="max-width:620px;margin:80px auto;text-align:center;font-family:sans-serif;color:#5B6472;padding:0 20px;">
        <h2 style="color:#101828;">This document isn't available yet</h2>
        <p>In a real logistics transaction, <b>${CONFIG.title}</b> can't exist before the documents it depends on. Complete the following first:</p>
        <ul style="text-align:left;list-style:none;padding:0;margin:24px 0;background:#F8F9FB;border-radius:10px;padding:18px 22px;">${missingList}</ul>
        <a href="skelora-institute-dashboard.html" style="color:#1F6FEB;font-weight:700;">← Back to Document Library</a>
      </div>`;
      return;
    }
  }
  document.title = `${CONFIG.title} — Fill & Learn Exercise | Skelora Institute Logistics Simulator`;
  document.getElementById("tbTitle1").textContent = CONFIG.title;
  document.getElementById("tbTitle2").textContent = CONFIG.subtitle;
  document.getElementById("bannerEyebrow").textContent = CONFIG.moduleLabel;
  document.getElementById("bannerTitle").textContent = CONFIG.heroTitle;
  document.getElementById("bannerDesc").textContent = CONFIG.heroDesc;
  document.getElementById("bannerObjectives").innerHTML = CONFIG.objectives.map(o=>
    `<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>${o}</li>`
  ).join("");
  renderPhaseOverview();

  // Resume saved progress for this student, if any exists on this computer.
  const saved = skGetDocProgress(CURRENT_USER.id, slug);
  const alreadyCompleted = saved && saved.status === 'completed';
  if(saved && saved.formData && !alreadyCompleted){
    formData = saved.formData || {};
    currentStep = Math.min(saved.currentStep || 0, CONFIG.steps.length-1);
    maxReached = saved.maxReached || 0;
  } else {
    formData = {};
    currentStep = 0; maxReached = 0;
    // ---- Data consistency rule: carry forward shared transaction fields from
    // already-completed documents, without ever overwriting anything the
    // student has already typed (formData is empty here, so this only fills). ----
    if(typeof skGetTransactionContext === "function" && typeof skApplyContextAutofill === "function"){
      const context = skGetTransactionContext(CURRENT_USER.id);
      formData = skApplyContextAutofill(CONFIG, formData, context);
    }
    if(!saved && CURRENT_USER && CURRENT_USER.id && typeof skAppendAudit === "function"){
      skAppendAudit(CURRENT_USER.id, slug, "started", {docTitle: CONFIG.title});
    }
  }
  fieldErrors.clear();
  startTime = Date.now();
  letterheadMeta = null;
  timerInterval = setInterval(updateTimer, 1000);

  attachDelegation();

  // ---- Bulk export mode: used only by the dashboard's "Download All Completed
  // Documents (ZIP)" feature, via a hidden iframe with ?bulkExport=1. Completely
  // separate code path from normal boot — normal single-document use is untouched. ----
  const bulkExportMode = params.get("bulkExport") === "1";
  if(bulkExportMode && alreadyCompleted && saved && saved.formData){
    formData = saved.formData;
    const reviewIdx = CONFIG.steps.findIndex(s=>s.custom==="review");
    if(reviewIdx === -1){
      window.parent.postMessage({type:"skelora-bulk-pdf-error", slug: CURRENT_SLUG, reason:"no review step"}, "*");
      return;
    }
    currentStep = reviewIdx; maxReached = reviewIdx;
    renderStep(reviewIdx);
    setTimeout(async ()=>{
      try{
        if(typeof html2canvas === "undefined" || typeof window.jspdf === "undefined") throw new Error("PDF libs unavailable");
        const letterheadEl = document.querySelector(".doc-letterhead");
        if(!letterheadEl) throw new Error("letterhead not found");
        const canvas = await html2canvas(letterheadEl, {scale:2, useCORS:true, backgroundColor:"#ffffff"});
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({orientation:"portrait", unit:"mm", format:"a4"});
        const pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth, imgHeight = (canvas.height*imgWidth)/canvas.width;
        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        let heightLeft = imgHeight, position = 0;
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        while(heightLeft > 0){ position = heightLeft - imgHeight; pdf.addPage(); pdf.addImage(imgData,"JPEG",0,position,imgWidth,imgHeight); heightLeft -= pageHeight; }
        const docNumber = (firstNonEmpty(DOC_NUMBER_FIELDS, formData) || CONFIG.docCodeExample).toString().replace(/[^a-zA-Z0-9_-]+/g,"-");
        const filename = `${CONFIG.title.replace(/[^a-zA-Z0-9_-]+/g,"-")}-${docNumber}.pdf`;
        const base64 = pdf.output("datauristring");
        window.parent.postMessage({type:"skelora-bulk-pdf-result", slug: CURRENT_SLUG, filename, dataUri: base64}, "*");
      } catch(e){
        window.parent.postMessage({type:"skelora-bulk-pdf-error", slug: CURRENT_SLUG, reason: e.message}, "*");
      }
    }, 500); // small delay lets the review step's DOM/fonts/hologram settle before capture
    return; // skip all normal-mode logic below entirely
  }

  renderStep(currentStep);
  if(saved && saved.formData && !alreadyCompleted && currentStep>0){
    showToast(`Resuming your saved progress on ${CONFIG.title}.`);
  } else if(alreadyCompleted){
    showToast(`You already completed this exercise — starting a fresh attempt.`);
    formData = {};
    if(typeof skGetTransactionContext === "function" && typeof skApplyContextAutofill === "function"){
      formData = skApplyContextAutofill(CONFIG, formData, skGetTransactionContext(CURRENT_USER.id));
    }
    currentStep = 0; maxReached = 0;
    renderStep(0);
  }
}
document.addEventListener("DOMContentLoaded", boot);
