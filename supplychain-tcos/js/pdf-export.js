/* ============================================================
   TCOS — PROFESSIONAL PDF EXPORT
   ============================================================
   Replaces the old browser-print-based "Download" with a real,
   generated PDF file (html2canvas + jsPDF, same libraries and
   approach as the Skelora Logistics Simulator's document export),
   so a TCOS document looks and behaves the same way a Skelora
   document does: genuine letterhead, a large faint ship watermark,
   a hologram-style digital seal, a Code128 barcode, and — for the
   documents that are genuinely government-issued (Shipping Bill,
   Bill of Entry, LEO Order, Out of Charge Order, Bank Realisation
   Certificate) — a "GOVERNMENT OF INDIA" band. Carrier-issued
   freight documents (Booking Confirmation, BL/AWB, Delivery Order,
   etc.) do NOT get the govt band, same rule Skelora follows.
   ============================================================ */

/* ---------------- Code128 barcode (shared logic with Skelora) ---------------- */
const TCOS_CODE128_BARS = [
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
function tcosCode128Modules(text){
  const START_B = 104, STOP = 106, MODULO = 103;
  const safe = String(text).toUpperCase().replace(/[^\x20-\x7E]/g, "").slice(0, 24) || "TCOS";
  const chars = safe.split("").map(c => c.charCodeAt(0) - 32);
  let modules = TCOS_CODE128_BARS[START_B].toString();
  let checksum = START_B;
  chars.forEach((v,i)=>{ modules += TCOS_CODE128_BARS[v].toString(); checksum += v*(i+1); });
  checksum = checksum % MODULO;
  modules += TCOS_CODE128_BARS[checksum].toString();
  modules += TCOS_CODE128_BARS[STOP].toString();
  return {modules, text: safe};
}
function tcosRenderBarcodeSVG(text){
  const {modules, text: safe} = tcosCode128Modules(text);
  const moduleW = 2, height = 40;
  let x = 0, rects = "";
  for(const m of modules){
    if(m === "1") rects += `<rect x="${x}" y="0" width="${moduleW}" height="${height}" fill="#111"/>`;
    x += moduleW;
  }
  const totalWidth = modules.length * moduleW;
  return `<div class="tcos-pdf-barcode">
    <svg viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}" height="${height}" preserveAspectRatio="xMinYMin meet">${rects}</svg>
    <div class="tcos-pdf-barcode-text">${safe}</div>
  </div>`;
}

/* ---------------- Hologram digital seal (deterministic per document) ---------------- */
function tcosSealSeedRng(seedStr){
  let h = 1779033703 ^ seedStr.length;
  for(let i=0;i<seedStr.length;i++){ h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h<<13)|(h>>>19); }
  return function(){ h = Math.imul(h ^ (h>>>16), 2246822507); h = Math.imul(h ^ (h>>>13), 3266489909); return ((h ^= h>>>16)>>>0) / 4294967296; };
}
const TCOS_SEAL_RING_TEXTS = ["TCOS TRAINING • VERIFIED • ", "OFFICIAL SIMULATOR RECORD • ", "AUTHENTICATED COPY • ", "DIGITALLY SEALED • "];
function tcosSealInnerPattern(kind, hue){
  const c = `hsl(${hue},70%,42%)`;
  if(kind===0) return `<circle cx="50" cy="50" r="30" fill="none" stroke="${c}" stroke-width="2"/><circle cx="50" cy="50" r="21" fill="none" stroke="${c}" stroke-width="1.4"/><circle cx="50" cy="50" r="12" fill="none" stroke="${c}" stroke-width="1"/>`;
  if(kind===1){ let l=""; for(let i=0;i<12;i++){ const a=(i*30)*Math.PI/180; l+=`<line x1="50" y1="50" x2="${50+30*Math.cos(a)}" y2="${50+30*Math.sin(a)}" stroke="${c}" stroke-width="1.6"/>`; } return l; }
  if(kind===2){ let d=""; for(let i=0;i<6;i++){ const a=(i*60)*Math.PI/180; d+=`<circle cx="${50+18*Math.cos(a)}" cy="${50+18*Math.sin(a)}" r="4" fill="${c}"/>`; } return d+`<circle cx="50" cy="50" r="4" fill="${c}"/>`; }
  if(kind===3){ let l=""; for(let r=8;r<=30;r+=7){ l+=`<circle cx="50" cy="50" r="${r}" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="3 3"/>`; } return l; }
  let d=""; for(let i=0;i<8;i++){ const a1=(i*45)*Math.PI/180, a2=((i*45)+22)*Math.PI/180; d+=`<path d="M50,50 L${50+26*Math.cos(a1)},${50+26*Math.sin(a1)} L${50+26*Math.cos(a2)},${50+26*Math.sin(a2)} Z" fill="${c}" opacity=".55"/>`; } return d;
}
function tcosRenderHologramSeal(seedStr, initials){
  const rng = tcosSealSeedRng(seedStr);
  const hue = Math.floor(rng()*360);
  const kind = Math.floor(rng()*5);
  const ringText = TCOS_SEAL_RING_TEXTS[Math.floor(rng()*TCOS_SEAL_RING_TEXTS.length)];
  const rotation = Math.floor(rng()*360);
  const arcId = "tcosSealArc" + Math.abs(seedStr.split("").reduce((a,c)=>a+c.charCodeAt(0),0));
  const fullRingText = (ringText + ringText).slice(0, 40);
  return `<div class="tcos-pdf-seal" style="transform:rotate(${rotation}deg);">
    <svg viewBox="0 0 100 100" width="92" height="92">
      <defs><path id="${arcId}" d="M50,50 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0"/></defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(${hue},70%,42%)" stroke-width="1.2" opacity=".5"/>
      <text font-size="6.4" fill="hsl(${hue},70%,32%)" font-weight="700" letter-spacing="1">
        <textPath href="#${arcId}">${fullRingText}</textPath>
      </text>
      ${tcosSealInnerPattern(kind, hue)}
    </svg>
    <div class="tcos-pdf-seal-initials">${(initials||"TCOS").slice(0,4)}</div>
  </div>`;
}

/* ---------------- Ship watermark (same design as the Skelora suite, for brand consistency) ---------------- */
function tcosShipWatermarkSVG(){
  return `<svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg">
    <g fill="currentColor">
      <path d="M40,168 L580,168 L556,196 Q400,208 300,208 Q160,208 70,196 Z"/>
      <rect x="55" y="158" width="510" height="10"/>
      <rect x="80" y="118" width="52" height="40"/><rect x="136" y="118" width="52" height="40"/>
      <rect x="192" y="106" width="52" height="52"/><rect x="248" y="106" width="52" height="52"/>
      <rect x="304" y="118" width="52" height="40"/><rect x="360" y="106" width="52" height="52"/>
      <rect x="192" y="70" width="52" height="34"/><rect x="248" y="70" width="52" height="34"/><rect x="360" y="70" width="52" height="34"/>
      <rect x="432" y="86" width="86" height="72"/><rect x="450" y="60" width="50" height="28"/><rect x="466" y="34" width="10" height="28"/>
      <rect x="444" y="98" width="16" height="14" fill="#fff"/><rect x="466" y="98" width="16" height="14" fill="#fff"/><rect x="488" y="98" width="16" height="14" fill="#fff"/>
      <rect x="96" y="52" width="6" height="66"/><path d="M99,52 L150,86 L146,92 L99,64 Z"/>
      <rect x="500" y="70" width="14" height="18"/>
    </g>
  </svg>`;
}

/* Which TCOS document titles are genuinely government-issued (gets the
   GOVERNMENT OF INDIA band) vs carrier/private-issued (does not) — same
   distinction Skelora's DOCUMENT_CONFIGS[*].govtIssuer flag makes. */
const TCOS_GOVT_DOC_TITLES = new Set([
  "Shipping Bill", "Bill of Entry", "Let Export Order (LEO)", "Out of Charge (OOC) Order",
  "Bank Realisation Certificate", "Bank Realization Certificate", "Examination Order", "Assessment Order"
]);

function tcosDocIssuerBlock(doc, f){
  const isGovt = TCOS_GOVT_DOC_TITLES.has(doc.title) || (f && ["LEO","OOC"].includes(f.status) && /order|leo|ooc/i.test(doc.title));
  if(!isGovt) return "";
  return `<div class="tcos-pdf-govtband">GOVERNMENT OF INDIA — MINISTRY OF FINANCE — DEPARTMENT OF REVENUE — CENTRAL BOARD OF INDIRECT TAXES &amp; CUSTOMS<br><span>Training Simulator Reproduction — Not a Valid Legal Instrument</span></div>`;
}

/* ---------------- Letterhead builder ---------------- */
function tcosDocumentLetterheadHTML(doc){
  const f = doc.filingId ? getFiling(doc.filingId) : null;
  const b = doc.bookingId ? getBooking(doc.bookingId) : null;
  const issuer = f ? "TCOS — Customs Portal Simulation" : "TCOS — Freight Booking Module";
  const sealInitials = (STATE.user && STATE.user.profile && STATE.user.profile.name || "TCOS").split(" ").map(w=>w[0]).join("").toUpperCase();

  let rows = "";
  if(f){
    rows += `<div class="tcos-pdf-box"><h4>Filing Number</h4><div class="dv">${esc(doc.filingId)}</div></div>`;
    rows += `<div class="tcos-pdf-box"><h4>${f.type === "export" ? "Exporter" : "Importer"}</h4><div class="dv">${esc(f.type === "export" ? (f.party.exporterName||"—") : (f.party.importerName||"—"))}</div></div>`;
    rows += `<div class="tcos-pdf-box"><h4>${f.type === "export" ? "Consignee" : "Supplier"}</h4><div class="dv">${esc(f.type === "export" ? (f.counterparty.consigneeName||"—") : (f.counterparty.supplierName||"—"))}</div></div>`;
    rows += `<div class="tcos-pdf-box"><h4>Invoice No.</h4><div class="dv">${esc(f.invoice.invoiceNo||"—")}</div></div>`;
    rows += `<div class="tcos-pdf-box"><h4>Status</h4><div class="dv">${esc(STATUS_LABELS[f.status]||f.status)}</div></div>`;
    rows += `<div class="tcos-pdf-box"><h4>Port</h4><div class="dv">${esc((f.shipment && (f.shipment.portOfLoading||f.shipment.portOfDischarge))||"—")}</div></div>`;
  }
  if(b){
    rows += `<div class="tcos-pdf-box"><h4>Booking Number</h4><div class="dv">${esc(doc.bookingId)}</div></div>`;
    rows += `<div class="tcos-pdf-box"><h4>Shipper</h4><div class="dv">${esc(b.shipperName||"—")}</div></div>`;
    rows += `<div class="tcos-pdf-box"><h4>Consignee</h4><div class="dv">${esc(b.consigneeName||"—")}</div></div>`;
    rows += `<div class="tcos-pdf-box"><h4>Carrier</h4><div class="dv">${esc(b.carrierName||"—")}</div></div>`;
    rows += `<div class="tcos-pdf-box"><h4>Mode</h4><div class="dv">${esc(b.mode||"—")}</div></div>`;
    rows += `<div class="tcos-pdf-box"><h4>Status</h4><div class="dv">${esc(FREIGHT_STATUS_LABELS[b.status]||b.status)}</div></div>`;
    if(b.bl && b.bl.houseNo) rows += `<div class="tcos-pdf-box"><h4>House ${b.mode === "Sea" ? "BL" : "AWB"} No.</h4><div class="dv">${esc(b.bl.houseNo)}</div></div>`;
  }

  return `<div class="tcos-pdf-letterhead">
    <div class="tcos-pdf-watermark"><span>${esc(doc.title)}</span></div>
    <div class="tcos-pdf-shipmark">${tcosShipWatermarkSVG()}</div>
    ${tcosDocIssuerBlock(doc, f)}
    <div class="tcos-pdf-head">
      <div>
        <div class="tcos-pdf-name">TCOS <span>Trade &amp; Customs Operations Simulator</span></div>
        <div class="tcos-pdf-sub">Training Document — ${esc(issuer)}</div>
      </div>
      <div class="tcos-pdf-type">
        <div class="t">${esc(doc.title)}</div>
        <div class="n">Ref: ${esc(doc.refNo)}</div>
        <div class="n">${fmtDateTime(doc.ts)}</div>
      </div>
    </div>
    <div class="tcos-pdf-rule"></div>
    <div class="tcos-pdf-grid">${rows}</div>
    <div class="tcos-pdf-stamprow">
      <div>
        <div class="tcos-pdf-issuedline">Generated: <b>${fmtDateTime(doc.ts)}</b></div>
        ${tcosRenderBarcodeSVG(doc.refNo)}
      </div>
      ${tcosRenderHologramSeal(doc.title + doc.refNo, sealInitials)}
    </div>
    <div class="tcos-pdf-footer">TRAINING SIMULATOR — NOT AN OFFICIAL GOVERNMENT DOCUMENT — GENERATED BY TCOS FOR EDUCATIONAL USE ONLY</div>
  </div>`;
}

/* ---------------- Real PDF generation (html2canvas + jsPDF) ---------------- */
async function downloadDocumentPDF(docId){
  const doc = STATE.documentsGenerated.find(d => d.id === docId);
  if (!doc) { toast('That document could not be found — it may belong to a different profile.', 'error'); return; }
  if(typeof html2canvas === "undefined" || typeof window.jspdf === "undefined"){
    toast("PDF tools didn't load — check your internet connection and try again.", "error");
    return;
  }
  toast("Generating professional PDF…", "info");

  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-9999px;top:0;width:800px;background:#fff;";
  holder.innerHTML = tcosDocumentLetterheadHTML(doc);
  document.body.appendChild(holder);

  try{
    const canvas = await html2canvas(holder.firstElementChild, {scale:2, useCORS:true, backgroundColor:"#ffffff"});
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({orientation:"portrait", unit:"mm", format:"a4"});
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    let heightLeft = imgHeight, position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while(heightLeft > 0){
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(doc.title.replace(/\s+/g, "_") + "_" + doc.refNo + ".pdf");
    toast("PDF downloaded.", "success");
  } catch(err){
    console.error("[TCOS PDF export]", err);
    toast("Could not generate the PDF — please try again.", "error");
  } finally {
    holder.remove();
  }
}
