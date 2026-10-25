/* =========================================================================
   ICEGATE-FORMAT PRINT LAYOUTS — shared helpers + SHIPPING BILL (Parts I-V)
   -------------------------------------------------------------------------
   renderShippingBillSpecimen()  - the Shipping Bill exactly as an ICEGATE
                                   printout is laid out: running header with
                                   Port Code / SB No / QR, Part I Summary,
                                   Part II Invoice, Part III Items, Part IV
                                   Export Schemes, Part V Declarations.
   The Bill of Entry renderer lives in customs-forms-boe.js and uses the
   SkIC helpers exported at the bottom of this file.

   Every page is a fixed A4 .sb-page (794 x 1123 px) carrying the diagonal
   "SIMULATOR DATA" watermark, so the review box and the PDF capture
   (skBuildSbPdf in engine.js) work unchanged.  Variable-length sections are
   measured in a hidden host and split across pages (header + side label
   repeated), so a Shipping Bill with 20 items or 12 containers still prints
   cleanly.  Every value comes from the student's own formData; the money
   columns (FOB INR, IGST, drawback, RoDTEP ...) are computed from it.
   ========================================================================= */
(function(root){
  "use strict";

  /* ------------------------------------------------------------------ helpers */
  const MON = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const has = x => x!==undefined && x!==null && String(x).trim()!=="";
  const vt  = x => esc(has(x) ? String(x).trim() : "");
  const num = x => { const n = parseFloat(String(x==null?"":x).replace(/,/g,"")); return isFinite(n) ? n : 0; };
  const pad2 = n => String(n).padStart(2,"0");
  function amt(x, dp){                     // "3723600.05", "163400", "582766.1"
    const n = +x; if(!isFinite(n)) return "";
    dp = dp==null ? 2 : dp;
    let s = n.toFixed(dp);
    if(s.indexOf(".")>-1) s = s.replace(/0+$/,"").replace(/\.$/,"");
    return s;
  }
  function parseISO(x){ const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(x||"").trim()); return m ? {y:+m[1], m:+m[2], d:+m[3]} : null; }
  const dMon   = x => { const p = parseISO(x); return p ? `${pad2(p.d)}-${MON[p.m-1]}-${String(p.y).slice(2)}` : vt(x); };   // 06-JUN-23
  const dSlash = x => { const p = parseISO(x); return p ? `${pad2(p.d)}/${pad2(p.m)}/${p.y}` : vt(x); };                       // 06/07/2024
  const dDash  = x => { const p = parseISO(x); return p ? `${pad2(p.d)}-${pad2(p.m)}-${p.y}` : vt(x); };                       // 13-07-2024
  const dtMon  = dt => `${pad2(dt.getDate())}-${MON[dt.getMonth()]}-${String(dt.getFullYear()).slice(2)}`;
  const dtHM   = dt => `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
  const isoOf  = dt => `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}`;
  const yn = (x, dflt) => { const t = String(x==null?"":x).trim().toUpperCase(); return t ? t : (dflt||"N"); };

  /* A timestamp that is created the first time a filing is submitted and then kept in formData, so the
     "SB Date / Submission time" on the printout does not change every time the page is re-rendered. */
  function stamp(d, key, submitted, offsetMin){
    if(!submitted) return null;
    if(!has(d[key])){ try{ d[key] = new Date().toISOString(); }catch(e){} }
    const t = new Date(has(d[key]) ? d[key] : Date.now());
    return new Date(t.getTime() + (offsetMin||0)*60000);
  }
  function seqDigits(str, len){          // trailing digits of a generated number, left-padded
    const dg = String(str||"").replace(/\D/g,"");
    return (dg.slice(-len) || "1").padStart(len,"0");
  }

  /* ---------------------------------------------------------------- QR + emblem */
  function qrSvg(seed){
    const N = 29;
    let h = 2166136261;
    String(seed||"SIMULATOR").split("").forEach(ch=>{ h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; });
    const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
    const inFinder = (x,y) => (x<8 && y<8) || (x>=N-8 && y<8) || (x<8 && y>=N-8);
    let p = "";
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ if(!inFinder(x,y) && rnd() < 0.5) p += `M${x} ${y}h1v1h-1z`; }
    const finder = (ox,oy) => `<path d="M${ox} ${oy}h7v7h-7zM${ox+1} ${oy+1}h5v5h-5z" fill-rule="evenodd"/><path d="M${ox+2} ${oy+2}h3v3h-3z"/>`;
    return `<svg viewBox="-1 -1 ${N+2} ${N+2}" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${N+2}" height="${N+2}" fill="#fff"/><path d="${p}"/>${finder(0,0)}${finder(N-7,0)}${finder(0,N-7)}</svg>`;
  }
  function emblemSvg(size){
    let ticks = "";
    for(let i=0;i<24;i++){ const a = i*Math.PI/12; ticks += `<line x1="${(32+19*Math.cos(a)).toFixed(1)}" y1="${(32+19*Math.sin(a)).toFixed(1)}" x2="${(32+25*Math.cos(a)).toFixed(1)}" y2="${(32+25*Math.sin(a)).toFixed(1)}" stroke="#8a6d1d" stroke-width="1.3"/>`; }
    return `<svg width="${size||62}" height="${size||62}" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#fff" stroke="#8a6d1d" stroke-width="1.6"/>${ticks}<circle cx="32" cy="32" r="16" fill="none" stroke="#1f2a44" stroke-width="1.4"/><path d="M24 40 L32 22 L40 40 Z" fill="#1f2a44"/><circle cx="32" cy="20" r="3" fill="#8a6d1d"/></svg>`;
  }

  /* ---------------------------------------------------------------- table helpers */
  const colgroup = widths => `<colgroup>${widths.map(w=>`<col style="width:${w}%">`).join("")}</colgroup>`;
  const eq = n => colgroup(Array.from({length:n}, ()=>100/n));
  const TH = (t, span, extra) => `<th${span>1?` colspan="${span}"`:""}${extra?` ${extra}`:""}>${t}</th>`;
  const TD = (t, span, cls, extra) => `<td${span>1?` colspan="${span}"`:""}${cls?` class="${cls}"`:""}${extra?` ${extra}`:""}>${t==null?"":t}</td>`;
  /* Rotated with a CSS transform (not writing-mode) because html2canvas, which captures the PDF, cannot render vertical
     writing modes. A rotated box does not change layout height, so the label's min-height is set from its text length. */
  const sideLabel = t => {
    const longest = String(t).split(/<br\s*\/?>/i).reduce((m,x)=>Math.max(m, x.replace(/<[^>]*>/g,"").replace(/&[a-z]+;/g,"x").length), 0);
    return `<div class="ic-sl" style="min-height:${Math.ceil(longest*4.7 + 10)}px"><span>${t}</span></div>`;
  };
  const lines = (arr, n) => {                       // n bordered text lines
    const a = arr.slice(0, n); while(a.length < n) a.push("");
    return `<div class="ic-lines">${a.map(t=>`<div>${t||"&nbsp;"}</div>`).join("")}</div>`;
  };
  const kvLine = (k, v) => `<div class="ic-kv"><span class="k">${k}</span><span class="v">${v||"&nbsp;"}</span></div>`;
  const splitLines = (txt, n) => {                  // address text -> at most n lines
    const parts = String(txt==null?"":txt).split(/\n/).map(s=>s.trim()).filter(Boolean);
    if(parts.length > n){ const head = parts.slice(0,n-1); head.push(parts.slice(n-1).join(", ")); return head.map(esc); }
    return parts.map(esc);
  };

  /* ---------------------------------------------------------------- page frame + pagination */
  const WATERMARK = `<div class="sb-wm"><div class="a">SIMULATOR DATA</div><div class="b">TRAINING COPY - NOT A VALID DOCUMENT</div></div>`;
  const SCAN = `Scan QR Code using ICETRAK Mobile App for authentication.<br>Visit ICEGATE portal to verify latest version*.`;

  function pageHtml(kind, headerHtml, part, bodyHtml, n, total){
    const credit = (typeof SK_CREDIT_LINE !== "undefined") ? SK_CREDIT_LINE : "Designed and Developed By DOT Ecosystem";
    const gl = (part.glossary||[]).map(t=>`<div class="gt">${t}</div>`).join("");
    return `<div class="sb-page ic-page ic-${kind}"><div class="sb-credit">${esc(credit)}</div>${WATERMARK}
      <div class="ic-frame">${headerHtml}<div class="ic-title">${part.title}</div>
        <div class="ic-body">${bodyHtml}${part.overlay ? part.overlay : ""}</div>
        ${part.noGlossary ? "" : `<div class="ic-glossary"><div class="g">${part.glossaryTitle || "Glossary"}</div>${gl}</div>`}
      </div>
      <div class="ic-foot"><div class="scan">${kind==="boe" ? "Verify using ICETRAK Mobile App (Google Play Store) for authentication &amp; latest version details from ICEGATE Enquiry" : kind==="bl" ? "Simulated Bill of Lading generated by the Skelora Institute Logistics Simulator - for training use only, not a valid transport document." : SCAN}</div><div class="pg">Page &nbsp;&nbsp;&nbsp; ${n} Of ${total}</div></div>
    </div>`;
  }

  /* Measure every block in a hidden page of the same CSS, then pack blocks onto as many pages as needed.
     A block is {html} (indivisible) or {rows, render(rowsSubset, isContinuation)} (splittable). */
  function paginate(kind, headerHtml, parts){
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;";
    document.body.appendChild(host);
    try{
      const pages = [];
      parts.forEach(part=>{
        host.innerHTML = pageHtml(kind, headerHtml, part, "", 1, 1);
        const bodyEl = host.querySelector(".ic-body");
        const budget = bodyEl.getBoundingClientRect().height;
        const hOf = html => {
          bodyEl.style.cssText = "flex:none;height:auto;overflow:visible;";
          bodyEl.innerHTML = part.wrap ? (part.wrapMeasure ? part.wrapMeasure(html) : part.wrap(html)) : html;
          const h = bodyEl.getBoundingClientRect().height;
          bodyEl.innerHTML = ""; bodyEl.style.cssText = "";
          return h;
        };
        let cur = {part, html:"", used:0}; pages.push(cur);
        const newPage = () => { cur = {part, html:"", used:0}; pages.push(cur); };
        const place = (html, h) => { if(cur.used && cur.used + h > budget) newPage(); cur.html += html; cur.used += h; };
        (part.blocks||[]).forEach(b=>{
          if(!b.rows){ if(has(b.html)) place(b.html, hOf(b.html)); return; }
          if(!b.rows.length){ const html = b.render([], false); place(html, hOf(html)); return; }
          let i = 0;
          while(i < b.rows.length){
            const remaining = budget - cur.used;
            let best = 0;
            for(let k=1; k<=b.rows.length-i; k++){
              if(hOf(b.render(b.rows.slice(i,i+k), i>0)) <= remaining) best = k; else break;
            }
            if(best === 0){ if(cur.used){ newPage(); continue; } best = 1; }
            const html = b.render(b.rows.slice(i,i+best), i>0);
            cur.html += html; cur.used += hOf(html);
            i += best;
            if(i < b.rows.length) newPage();
          }
        });
        if(part.overlay && pages.length){ /* overlay (digital-signature note) goes on the first page of its part only */ }
      });
      host.remove();
      // overlay only on the first page of each part
      const seen = new Set();
      const total = pages.length;
      return pages.map((pg,idx)=>{
        const first = !seen.has(pg.part); seen.add(pg.part);
        const part = first ? pg.part : Object.assign({}, pg.part, {overlay:""});
        return pageHtml(kind, headerHtml, part, part.wrap ? part.wrap(pg.html) : pg.html, idx+1, total);
      }).join("");
    }catch(e){
      try{ host.remove(); }catch(e2){}
      throw e;
    }
  }
  const wrapDoc = inner => `<div class="sb-scroll"><div class="doc-letterhead sb-letterhead">${inner}</div></div>`;

  /* ===================================================================================
     SHIPPING BILL
     =================================================================================== */
  const SB_PORTS = {
    INNSA1:["Jawaharlal Nehru (Nh)","JNCH, NHAVA SHEVA, TAL:URAN, DIST-RAIGAD-400707"],
    INBOM4:["Mumbai Sea (Nhava Sheva)","JNCH, NHAVA SHEVA, TAL:URAN, DIST-RAIGAD-400707"],
    INMUN1:["Mundra","MUNDRA PORT & SPECIAL ECONOMIC ZONE, DIST-KUTCH, GUJARAT-370421"],
    INMAA1:["Chennai Sea","CUSTOM HOUSE, 60 RAJAJI SALAI, CHENNAI-600001"],
    INCOK1:["Cochin Sea","CUSTOM HOUSE, WILLINGDON ISLAND, COCHIN-682009"],
    INTUT1:["Tuticorin Sea","CUSTOM HOUSE, TUTICORIN-628004"],
    INCCU1:["Kolkata Sea","CUSTOM HOUSE, 15/1 STRAND ROAD, KOLKATA-700001"],
    INVTZ1:["Visakhapatnam Sea","CUSTOM HOUSE, PORT AREA, VISAKHAPATNAM-530035"],
    INPAV1:["Pipavav","PIPAVAV PORT, DIST-AMRELI, GUJARAT-365560"],
    INBLR4:["Bangalore ICD","ICD WHITEFIELD, BENGALURU-560066"]
  };
  const STATE_CODE = {"JAMMU AND KASHMIR":"01","HIMACHAL PRADESH":"02","PUNJAB":"03","CHANDIGARH":"04","UTTARAKHAND":"05","HARYANA":"06","DELHI":"07","RAJASTHAN":"08","UTTAR PRADESH":"09","BIHAR":"10","SIKKIM":"11","ARUNACHAL PRADESH":"12","NAGALAND":"13","MANIPUR":"14","MIZORAM":"15","TRIPURA":"16","MEGHALAYA":"17","ASSAM":"18","WEST BENGAL":"19","JHARKHAND":"20","ODISHA":"21","CHHATTISGARH":"22","MADHYA PRADESH":"23","GUJARAT":"24","MAHARASHTRA":"27","ANDHRA PRADESH":"37","KARNATAKA":"29","GOA":"30","KERALA":"32","TAMIL NADU":"33","PUDUCHERRY":"34","TELANGANA":"36"};
  const FREIGHT_TERMS = ["CFR","CIF","CPT","CIP","DAP","DPU","DDP"];
  const INSURANCE_TERMS = ["CIF","CIP","DAP","DPU","DDP"];

  function sbCompute(d){
    const items = (Array.isArray(d.itemDetails) ? d.itemDetails : []).filter(r => r && (has(r.hsCode) || has(r.description) || has(r.quantity)));
    const scheme = Array.isArray(d.itemScheme) ? d.itemScheme : [];
    const cur = has(d.invoiceCurrency) ? String(d.invoiceCurrency).trim().toUpperCase() : "INR";
    const rate = cur === "INR" ? 1 : num(d.exchangeRate);
    const valFC = items.map(r => num(r.quantity) * num(r.unitPrice));
    const invVal = valFC.reduce((a,b)=>a+b, 0);
    const frCur = has(d.freightCurrency) ? String(d.freightCurrency).trim().toUpperCase() : cur;
    const toInv = v => (frCur === cur) ? v : (frCur === "INR" ? (rate ? v / rate : 0) : v);   // freight / insurance expressed in the invoice currency
    const freight = toInv(num(d.freightAmount)), insurance = toInv(num(d.insuranceAmount));
    const term = String(d.invoiceTerm||"").trim().toUpperCase() || ((freight||insurance) ? "CIF" : "FOB");
    const fobFC = invVal - (FREIGHT_TERMS.includes(term) ? freight : 0) - (INSURANCE_TERMS.includes(term) ? insurance : 0);
    const fobRatio = invVal > 0 ? fobFC / invVal : 1;
    const rows = items.map((r,i)=>{
      const s = scheme[i] || {};
      const vF = valFC[i];
      const fobInr = +(vF * rate * fobRatio).toFixed(2);
      const igstValue = +(vF * rate).toFixed(2);
      const igstPaid = /^(P|PAID)$/i.test(String(s.igstStatus||"").trim());
      const igstAmt = igstPaid ? +(igstValue * num(s.igstRatePct) / 100).toFixed(2) : 0;
      const dbkOn = yn(s.dbkClaimed) === "Y";
      const dbkAmt = dbkOn ? +(fobInr * num(s.dbkRatePct) / 100).toFixed(2) : 0;
      const rodOn = yn(s.rodtepClaimed) === "Y";
      const rodAmt = rodOn ? Math.round(fobInr * num(s.rodtepRatePct) / 100) : 0;
      return {r, s, i, vF, fobInr, igstValue, igstAmt, dbkOn, dbkAmt, rodOn, rodAmt};
    });
    const sum = f => rows.reduce((a,x)=>a+f(x), 0);
    return {
      items, rows, cur, rate, term, invVal, fobFC, freight, insurance,
      fobInr: sum(x=>x.fobInr),
      freightInr: Math.round(freight * rate), insuranceInr: Math.round(insurance * rate),
      discountInr: num(d.discountAmt) * rate, commissionInr: num(d.commissionAmt) * rate, deductionsInr: num(d.deductionsAmt) * rate, packingInr: num(d.packingCharges) * rate,
      dbkClaim: Math.round(sum(x=>x.dbkAmt)), igstAmt: sum(x=>x.igstAmt), igstValue: sum(x=>x.igstValue),
      rodtep: sum(x=>x.rodAmt), cess: sum(x=>num(x.s.compCess))
    };
  }

  function renderShippingBillSpecimen(dIn){
    const d = dIn || (typeof formData !== "undefined" ? formData : {}) || {};
    const c = sbCompute(d);
    const submitted = !!d.submitToIcegate;
    let genNo = d.sbNumberGenerated;
    if(!genNo && submitted && typeof findFieldByName === "function"){ try{ const gf = findFieldByName("sbNumberGenerated"); if(gf && typeof gf.compute === "function") genNo = gf.compute(d); }catch(e){} }
    const sbNo = (submitted && genNo) ? seqDigits(genNo, 7) : "";
    const tSub = stamp(d, "sbSubmittedAt", submitted, 0);
    const assessOn = yn(d.assess, "Y") === "Y";
    const tAss = tSub && assessOn ? new Date(tSub.getTime() + (((+sbNo||7) % 17) + 4) * 3600000 + ((+sbNo||7) % 50) * 60000) : null;
    const sbDate = tSub ? dtMon(tSub) : "";
    const code = String(d.customsHouseCode||"").trim().toUpperCase();
    const port = SB_PORTS[code] || [code, code ? "CUSTOMS HOUSE " + code : ""];
    const conts = (Array.isArray(d.containerDetails) ? d.containerDetails : []).filter(r => r && has(r.containerNo));
    const isAir = has(d.mawbNumber) && !/^(n\/?a|nil|none|-|—)$/i.test(String(d.mawbNumber).trim());
    const mode = isAir ? "AIR" : "SEA";
    const ref = tSub ? `SB21${pad2(tSub.getDate())}${pad2(tSub.getMonth()+1)}${tSub.getFullYear()}${pad2(tSub.getHours())}${pad2(tSub.getMinutes())}` : "";
    const gstinTxt = has(d.gstin) ? `${vt(d.gstin)} ${vt(d.gstinType || "GSN")}` : "";
    const hdr = `<div class="ic-hdr">
      <div class="ic-hdr-l"><div class="ic-hdr-brand">${emblemSvg()}<div><div class="t1">INDIAN&nbsp; CUSTOMS&nbsp; EDI&nbsp; SYSTEM</div><div class="t2">CENTRAL BOARD OF INDIRECT TAXES AND CUSTOMS<br>DEPARTMENT OF REVENUE - MINISTRY OF FINANCE<br>GOVERNMENT OF INDIA</div></div></div>
        <div class="ic-hdr-port">${esc(port[1])}</div></div>
      <div class="ic-hdr-r"><table class="ic-hdr-tbl">${eq(8)}
        <tr>${TD("Port Code",2,"k")}${TD("SB No",3,"k","style=\"text-align:center\"")}${TD("SB Date",3,"k","style=\"text-align:center\"")}</tr>
        <tr>${TD(esc(code),2)}${TD(esc(sbNo),3)}${TD(sbDate,3)}</tr>
        <tr>${TD("IEC/Br",2,"k")}${TD(vt(d.iecNumber),3)}${TD(vt(d.branchSerialNo),3)}</tr>
        <tr>${TD("GSTIN/TYPE",2,"k")}${TD(gstinTxt,6)}</tr>
        <tr>${TD("CB CODE",2,"k")}${TD(vt(d.chaLicenseNo),6)}</tr>
        <tr>${TD("TYPE",2,"k")}${TD("INV",2,"k","style=\"text-align:center\"")}${TD("ITEM",2,"k","style=\"text-align:center\"")}${TD("CONT",2,"k","style=\"text-align:center\"")}</tr>
        <tr>${TD("Nos",2,"k")}${TD(c.items.length ? "1" : "",2)}${TD(String(c.items.length||""),2)}${TD(String(conts.length||""),2)}</tr>
        <tr>${TD("PKG",1,"k")}${TD(vt(d.noOfPackages),2)}${TD("G.WT",2,"k")}${TD("KGS",1)}${TD(has(d.grossWeight)?amt(num(d.grossWeight),2):"",2)}</tr>
      </table><div class="ic-hdr-qr">${qrSvg(ref || "SB")}<div class="ref">${ref ? "* " + ref : "&nbsp;"}</div></div></div>
    </div>`;

    /* ---------------------------------------------------------------- PART I */
    const flags = [["1.MODE",mode],["2.ASSESS",yn(d.assess,"Y")],["3.EXMN",yn(d.exmn)],["4.JOBBING",yn(d.jobbing)],["5.MEIS",yn(d.meis)],["6.DBK",yn(d.dbk,c.dbkClaim?"Y":"N")],["7.RODTP",yn(d.rodtp,c.rodtep?"Y":"N")],["8.DEEC/DFIA",yn(d.deecDfia)],["9.DFRC",yn(d.dfrc)],["10.RE-EXP",yn(d.reExp)],["11.LUT",yn(d.lut)]];
    const portLoading = has(d.portOfLoading) ? vt(d.portOfLoading) : (code ? `${esc(code)} (${esc(port[0])})` : "");
    const A = `<div class="ic-row ic-sec">${sideLabel("A STATUS")}<div style="flex:1"><table class="ic-t">${eq(22)}
      <tr>${flags.map(f=>TH(f[0],2)).join("")}</tr>
      <tr>${flags.map(f=>TD(f[1],2,"c")).join("")}</tr>
      <tr>${TD("12.PORT OF LOADING",5,"lb")}${TD(portLoading,6)}${TD("13.COUNTRY OF FINAL DESTINATION",5,"lb")}${TD(vt(d.countryDestination),6)}</tr>
      <tr>${TD("14.STATE OF ORIGIN",5,"lb")}${TD(vt(d.stateOfOrigin),6)}${TD("15.PORT OF FINAL DESTINATION",5,"lb")}${TD(vt(d.portFinalDestination),6)}</tr>
      <tr>${TD("16.PORT OF DISCHARGE",5,"lb")}${TD(vt(d.portDischarge),6)}${TD("17.COUNTRY OF DISCHARGE",5,"lb")}${TD(vt(d.countryDischarge || d.countryDestination),6)}</tr>
    </table></div></div>`;
    const exLines = [vt(d.exporterName)].concat(splitLines(d.exporterAddress, 3));
    const left = lines(exLines, 4)
      + kvLine("2.Type", vt(d.exporterType))
      + kvLine("3. AD CODE:", vt(d.adCode))
      + kvLine("4.RBI WAIVER NO.& DT", vt(d.rbiWaiverNoDt))
      + kvLine("5.CB NAME", vt(d.cbName))
      + kvLine("6.AEO", vt(d.aeoStatus));
    const conLines = [vt(d.consigneeName)].concat(splitLines(d.consigneeAddress, 2)); if(has(d.consigneeCountryCode)) conLines.push(vt(d.consigneeCountryCode));
    const right = lines(conLines, 4)
      + kvLine("8. GSTIN / TYPE", gstinTxt)
      + kvLine("9.FOREX BANK A/C NO.", vt(d.forexBankAcNo))
      + kvLine("10.DBK BANK A/C NO.", vt(d.dbkBankAcNo))
      + kvLine("11. IFSC NO.", vt(d.ifscNo))
      + kvLine("&nbsp;", "");
    const B = `<div class="ic-row ic-sec">${sideLabel("B DECLARANT")}<div style="flex:1"><table class="ic-t">${eq(2)}
      <tr><th>1.EXPORTER'S NAME &amp; ADDRESS</th><th>7.CONSIGNEE NAME &amp; ADDRESS</th></tr>
      <tr><td style="padding:0;vertical-align:top">${left}</td><td style="padding:0;vertical-align:top">${right}</td></tr></table></div></div>`;
    const money = x => amt(x, 2) || "0";
    const CD = `<div class="ic-row ic-sec">${sideLabel("C.VALU SUMMA")}<div style="flex:1.6"><table class="ic-t">${eq(10)}
        <tr>${["1.FOB VALUE","2.FREIGHT","3.INSURANC","4.DISCOU","5.COM"].map(t=>TH(t,2)).join("")}</tr>
        <tr>${[c.fobInr, c.freightInr, c.insuranceInr, c.discountInr, c.commissionInr].map(x=>TD(c.items.length?money(x):"",2,"c")).join("")}</tr>
        <tr>${TH("6.DEDUCTIONS",2)}${TH("7.P/C",2)}${TH("8.DUTY",2)}${TH("9.CESS",2)}${TD("",2,"nb")}</tr>
        <tr>${[c.deductionsInr, c.packingInr, 0, 0].map(x=>TD(c.items.length?money(x):"",2,"c")).join("")}${TD("",2,"nb")}</tr></table></div>
      ${sideLabel("D. EX.PR.")}<div style="flex:1.05"><table class="ic-t">${eq(6)}
        <tr>${TH("1.DBK CLAIM",2)}${TH("2. IGST AMT",2)}${TH("3.CESS AMT",2)}</tr>
        <tr>${[c.dbkClaim, c.igstAmt, c.cess].map(x=>TD(c.items.length?money(x):"",2,"c")).join("")}</tr>
        <tr>${TH("4.IGST VALUE",2)}${TH("5.RODTEP AMT",2)}${TH("6.ROSCTL AMT",2)}</tr>
        <tr>${[c.igstValue, c.rodtep, 0].map(x=>TD(c.items.length?money(x):"",2,"c")).join("")}</tr></table></div></div>`;
    const EF = `<div class="ic-row ic-sec">${sideLabel("E MANIFEST DETAILS")}<div style="flex:1.45"><table class="ic-t">${eq(10)}
        <tr>${TH("1.MAWB NO.",2)}${TH("2.MAWB DT",2)}${TH("3.HAWB NO.",2)}${TH("4.HAWB DT",2)}${TH("N.O.C.",2)}</tr>
        <tr>${TD(vt(d.mawbNumber),2,"c")}${TD(dMon(d.mawbDate),2,"c")}${TD(vt(d.hawbNumber),2,"c")}${TD(dMon(d.hawbDate),2,"c")}${TD("",2,"c")}</tr>
        <tr>${TH("4. CIN NO.",4)}${TH("5. CIN DT.",3)}${TH("6. CIN SITE ID",3)}</tr>
        <tr>${TD(vt(d.cinNo),4,"c")}${TD(dMon(d.cinDate),3,"c")}${TD(vt(d.cinSiteId),3,"c")}</tr></table></div>
      ${sideLabel("F.INVOICE SUMMARY")}<div style="flex:1.2"><table class="ic-t">${colgroup([12,38,28,22])}
        <tr>${TH("1.SNO")}${TH("2.INV NO.")}${TH("3. INV AMT.")}${TH("4.CURRENC")}</tr>
        <tr>${TD(has(d.commInvoiceNo)?"1":"",1,"c")}${TD(vt(d.commInvoiceNo),1,"c")}${TD(c.items.length?amt(c.invVal,2):"",1,"c")}${TD(has(d.commInvoiceNo)?esc(c.cur):"",1,"c")}</tr>
        <tr class="blank"><td></td><td></td><td></td><td></td></tr><tr class="blank"><td></td><td></td><td></td><td></td></tr></table></div></div>`;
    const sealDate = r => has(r.sealDate) ? dMon(r.sealDate) : (tSub ? dtMon(tSub) : "");
    const contRows = conts.map((r,i)=>`<tr>${TD(vt(r.containerNo),1,"c")}${TD(vt(r.sealNumber),1,"c")}${TD(sealDate(r),1,"c")}${TD(String(i+1),1,"c")}</tr>`).join("");
    const chal = (Array.isArray(d.challanLines) ? d.challanLines : []).filter(r => r && (has(r.challanNo) || has(r.amount)));
    const chalRows = chal.map((r,i)=>`<tr>${TD(vt(r.srNo)||String(i+1),1,"c")}${TD(vt(r.challanNo),1,"c")}${TD(dMon(r.paymtDt),1,"c")}${TD(vt(r.amount),1,"c")}</tr>`).join("");
    const padRows = (n, cols) => Array.from({length:Math.max(0,n)}, ()=>`<tr class="blank">${"<td></td>".repeat(cols)}</tr>`).join("");
    const GH = `<div class="ic-row ic-sec" style="min-height:150px">${sideLabel("G. EQUIPMENT DETAILS")}<div style="flex:1.3;display:flex"><table class="ic-t" style="height:100%">${colgroup([32,32,22,14])}
        <tr>${TH("1.CONTAINER")}${TH("2.SEAL")}${TH("3.DATE")}${TH("4.S No")}</tr>${contRows}${padRows(9-conts.length,4)}</table></div>
      ${sideLabel("H CHALLAN DETAILS")}<div style="flex:1.15;display:flex"><table class="ic-t" style="height:100%">${colgroup([14,36,25,25])}
        <tr>${TH("1SR.NO")}${TH("2.CHALLAN NO")}${TH("3.PAYMT DT")}${TH("4.AMOUNT")}</tr>${chalRows}${padRows(9-chal.length,4)}</table></div></div>`;
    const I = `<div class="ic-row ic-sec">${sideLabel("I. ANNEX DETAILS")}<div style="flex:1"><table class="ic-t">${eq(22)}
      <tr>${TH("1.SEAL TYPE",4)}${TH("2.NATURE OF CARGO",6)}${TH("3.NO. OF PACKETS",4)}${TH("4.NO. OF CONTAINERS",4)}${TH("5.LOOSE PACKETS",4)}</tr>
      <tr>${TD(vt(d.sealType),4,"c")}${TD(vt(d.natureOfCargo).toUpperCase(),6,"c")}${TD(vt(d.noOfPackages),4,"c")}${TD(has(d.noOfContainers)?vt(d.noOfContainers):String(conts.length||""),4,"c")}${TD(vt(d.loosePackets),4,"c")}</tr>
      <tr>${TD("6.MARKS &amp; NUMBERS",4,"lb")}${TD(vt(d.marksNumbers),18)}</tr>
      <tr class="blank"><td colspan="22" style="height:30px"></td></tr></table></div></div>`;
    const J = `<div class="ic-row ic-sec">${sideLabel("J.PROCESS DETAILS")}<div style="flex:1"><table class="ic-t">${colgroup([13,17,17,3,18,32])}
      <tr>${TH("1.EVENT")}${TH("2.DATE")}${TH("3.TIME")}${TD("",1,"nb")}${TH("4.LEO NO.")}${TD("",1)}</tr>
      <tr>${TD("5.Submission",1,"lb")}${TD(tSub?dtMon(tSub):"",1,"c")}${TD(tSub?dtHM(tSub):"",1,"c")}${TD("",1,"nb")}${TH("6.LEO Date.")}${TD("",1)}</tr>
      <tr>${TD("5.Assessment",1,"lb")}${TD(tAss?dtMon(tAss):"",1,"c")}${TD(tAss?dtHM(tAss):"",1,"c")}${TD("",1,"nb")}${TH("8.BRC Realisation Date")}${TD("",1)}</tr>
      <tr>${TD("7.Examination",1,"lb")}${TD("",1)}${TD("",1)}${TD("",1,"nb")}${TD("",1,"nb")}${TD("",1,"nb")}</tr>
      <tr>${TD("9.LEO",1,"lb")}${TD("",1)}${TD("",1)}${TD("",1,"nb")}${TD("",1,"nb")}${TD("",1,"nb")}</tr></table></div></div>`;
    const sigOverlay = submitted ? `<div class="ic-sig"><div class="big">Signature (Simulated)</div>Digitally signed by SKELORA SIMULATOR<span class="mk">i</span><br>Date: ${tSub.getFullYear()}.${pad2(tSub.getMonth()+1)}.${pad2(tSub.getDate())} ${dtHM(tSub)} IST<br>Reason: CUSTOMS<br>Location: INDIA</div>` : "";
    const part1 = {title:"PART - I - SHIPPING BILL SUMMARY", glossaryTitle:"Glossary", blocks:[{html:A},{html:B},{html:CD},{html:EF},{html:GH},{html:I},{html:J}], overlay:sigOverlay,
      glossary:["<b>A:</b> ASSESS - Assessed, EXMN - Examined, MEIS - Merchandise Export Incentive Scheme, DBK - Drawback, ROSL - Rebate of State Levies,","DEEC - Duty Exemption Entitlement Certificate, DFRC - Duty Free Replenishment Certificate, LUT - Letter of Undertaking. <b>B:</b> CB - Customs Broker","AD Authorized Dealer, AEO - Authorized Economic Operator, UCR - Unique Customs Reference <b>C:</b> DISCOU - Discount, COM - Commission,","P/C Packing Charges, <b>D:</b> EX. PR.- Export Promotions <b>E:</b> MAWB / HAWB - Master / House Airway Bill Number <b>J:</b>BRC- Bank Realisation Certificate"]};

    /* ---------------------------------------------------------------- PART II */
    const invDate = dSlash(d.invoiceDate);
    const poTxt = has(d.poNo) ? `${vt(d.poNo)} ${has(d.poDate)?dSlash(d.poDate):""}` : "";
    const locTxt = has(d.locNo) ? `${vt(d.locNo)} ${has(d.locDate)?dSlash(d.locDate):""}` : "";
    const ctrTxt = has(d.contractNo) ? `${vt(d.contractNo)} ${has(d.contractDate)?dSlash(d.contractDate):""}` : "";
    const II_A = `<div class="ic-row ic-sec">${sideLabel("A. REF")}<div style="flex:1"><table class="ic-t">${colgroup([6,24,16,16,16,12,10])}
      <tr>${TH("1.S.No")}${TH("2.INVOICE No. &amp; Dt.")}${TH("3.P.O.No. &amp; Dt.")}${TH("4.LoC No. &amp; Dt")}${TH("5.Contract No.&amp;Dt")}${TH("6.AD code")}${TH("7.INVTERM")}</tr>
      <tr>${TD(has(d.commInvoiceNo)?"1":"",1,"c")}${TD(`${vt(d.commInvoiceNo)} ${invDate}`)}${TD(poTxt)}${TD(locTxt)}${TD(ctrTxt)}${TD(vt(d.adCode),1,"c")}${TD(esc(c.term),1,"c")}</tr></table></div></div>`;
    const II_B = `<div class="ic-row ic-sec">${sideLabel("B. TRANSACTION PARTIES")}<div style="flex:1"><table class="ic-t">${eq(2)}
      <tr><th>1.EXPORTER'S NAME &amp; ADDRESS</th><th>2.BUYER'S NAME &amp; ADDRESS</th></tr>
      <tr><td style="padding:0">${lines([vt(d.exporterName)].concat(splitLines(d.exporterAddress,3)),4)}</td><td style="padding:0">${lines([vt(d.buyerName)].concat(splitLines(d.buyerAddress,3)),4)}</td></tr>
      <tr><th>3.THIRD PARTY NAME &amp; ADDRESS</th><th>4.BUYER AEO STATUS</th></tr>
      <tr><td style="padding:0">${lines([vt(d.thirdPartyName)].concat(splitLines(d.thirdPartyAddress,3)),4)}</td><td style="padding:0">${lines([vt(d.buyerAeoStatus)],4)}</td></tr></table></div></div>`;
    const cu = esc(c.cur);
    const II_C = `<div class="ic-row ic-sec">${sideLabel("C.VAL DTLS")}<div style="flex:1"><table class="ic-t">${colgroup([12,11,9,11,10,10,9,7,21])}
      <tr>${["1.INVOICE VALUE","2.FOB VALUE","3.FREIGHT","4.INSURANCE","5.DISCOUNT","6.COMMISON","7.DEDUCT","8.P/C","9.EXCHANGE RATE"].map(t=>TH(t)).join("")}</tr>
      <tr>${[c.invVal, c.fobFC, c.freight, c.insurance, num(d.discountAmt), num(d.commissionAmt), num(d.deductionsAmt)].map(x=>TD(c.items.length?amt(x,2)||"0":"",1,"c")).join("")}${TD(c.items.length&&num(d.packingCharges)?amt(num(d.packingCharges),2):"",1,"c")}${TD(c.items.length&&c.cur!=="INR"?`1 ${cu} INR ${amt(c.rate,4)}`:"",1,"c")}</tr>
      <tr>${[0,1,2,3,4,5,6].map(()=>TD(c.items.length?cu:"",1,"c")).join("")}${TD("",1,"c")}${TD("",1,"c")}</tr></table></div></div>`;
    const itemRowsII = c.rows.map(x=>`<tr>${TD(String(x.i+1),1,"c")}${TD(vt(x.r.hsCode),1,"c")}${TD(vt(x.r.description),1)}${TD(vt(x.r.quantity),1,"r")}${TD(vt(x.r.unit),1,"c")}${TD(vt(x.r.unitPrice),1,"r")}${TD(amt(x.vF,2),1,"r")}</tr>`).join("");
    const IIitemBlock = {rows:c.rows, render:(rows,cont)=>`<div class="ic-row ic-sec">${sideLabel("D. ITEM DETAILS")}<div style="flex:1"><table class="ic-t">${colgroup([8,12,38,11,8,10,13])}
      <tr>${["1.ItemSNo","2.HS CD","3.DESCRIPTION","4.QUANTITY","5.UQC","6.RATE","7.VALUE(F/C)"].map(t=>TH(t)).join("")}</tr>
      ${rows.map(x=>`<tr>${TD(String(x.i+1),1,"c")}${TD(vt(x.r.hsCode),1,"c")}${TD(vt(x.r.description),1)}${TD(vt(x.r.quantity),1,"r")}${TD(vt(x.r.unit),1,"c")}${TD(vt(x.r.unitPrice),1,"r")}${TD(amt(x.vF,2),1,"r")}</tr>`).join("")}${rows.length < 3 ? padRows(3-rows.length,7) : ""}</table></div></div>`};
    const part2 = {title:"PART - II - INVOICE DETAILS", blocks:[{html:II_A+II_B+II_C}, IIitemBlock],
      glossary:["<b>A:</b> Ref - Reference P.O. - Purchase Order, LoC - Letter of Credit, AD - Authorised Dealer <b>C:</b> VAL DTLS - Valuation Details","FOB - Freight On Board, DEDUCT - Deduction , P/C - Packing Charge <b>D:</b> HS CD - Harmonized System Code, UQC - Unit Quantity Code"]};

    /* ---------------------------------------------------------------- PART III */
    const stateOf = x => String(x.r.sourceState || d.stateOfOrigin || "").trim();
    const itemBlock = x => {
      const r = x.r, s = x.s;
      const row = (heads, vals, widths) => `<table class="ic-t" style="margin-top:-1px">${colgroup(widths)}<tr>${heads.map(h=>TH(h)).join("")}</tr><tr>${vals.map((v,i)=>TD(v,1,i===1||i===2?"c":"c")).join("")}</tr></table>`;
      const t1 = `<table class="ic-t">${colgroup([6,7,11,28,9,7,7,9,10,6])}<tr>${["1INVSN","2ITEMSN","3.HS CD","4.DESCRIPTION","5.QUANTITY","6UQC","7.RATE","8VALUE(F/C)","9.FOB (INR)","10.PMV"].map(h=>TH(h)).join("")}</tr>
        <tr>${TD("1",1,"c")}${TD(String(x.i+1),1,"c")}${TD(vt(r.hsCode),1,"c")}${TD(vt(r.description),1)}${TD(vt(r.quantity),1,"c")}${TD(vt(r.unit),1,"c")}${TD(vt(r.unitPrice),1,"c")}${TD(amt(x.vF,2),1,"c")}${TD(amt(x.fobInr,2),1,"c")}${TD(vt(r.presentMarketValue),1,"c")}</tr></table>`;
      const t2 = row(["11.DUTYAMT","12.CESS RT","13CESAMT","14.DBKCLMD","15.IGSTSTAT","16. IGST VALUE","17. IGST AMOUNT","18SCHCOD"],
        ["","","",x.dbkOn?"Y":"N",vt(s.igstStatus),amt(x.igstValue,2),amt(x.igstAmt,2),vt(s.schemeCode)],[13,12,12,13,12,14,14,10]);
      const t3 = row(["19. SCHEME DESCRIPTION","20. SQC MSR","21. SQC UQC","22. STATE OF ORIGIN","23. DISTRICT OF ORIGIN"],
        [vt(s.schemeDescription),vt(s.sqcMsr),vt(s.sqcUqc),esc(stateOf(x)),vt(s.districtOrigin).toUpperCase()],[25,13,15,23,24]);
      const t4 = row(["24. PT Abroad","25.COMP CESS","26.END USE","27.FTA BENEFIT AVAILED","28. REWARD BENEFIT","29. THIRD PARTY ITEM"],
        [vt(s.ptAbroad),`${amt(num(s.compCess),2)||"0"} INR`,vt(r.endUse),yn(s.ftaBenefit),vt(s.rewardBenefit),yn(s.thirdPartyItem)],[14,14,15,21,18,18]);
      return `<div style="margin-bottom:6px">${t1}${t2}${t3}${t4}</div>`;
    };
    const measureLabelled = inner=>`<div style="margin-left:25px">${inner}</div>`;
    const part3 = {title:"PART - III - ITEM DETAILS", wrapMeasure:measureLabelled, wrap:inner=>`<div class="ic-row" style="min-height:100%">${sideLabel("INVOICE (1/1)")}<div style="flex:1;padding-bottom:2px">${inner}</div></div>`, blocks:[{rows:c.rows, render:(rows)=>rows.map(itemBlock).join("")}],
      glossary:["FOB - Freight On Board, HS CD Harmonized System Code, UQC - Unit Quantity Code, PMV - Present Market Value, CESAM - Cess Amount","IGSTSTA - IGST Payment Status, VAL - IGST Value, PAID - IGST Amount Paid, SCHCOD - Scheme Code, SQC MSR - Standard Quantity","Measurement, comp - compensatory, PT Abroad - Preferential treatment Availed Abroad"]};

    /* ---------------------------------------------------------------- PART IV */
    const wrapIV = inner => inner;   // the "OTHER ADDITIONAL INFORMATION" side label is drawn once per page (part4.wrap)
    const section = (title, widths, heads, rowsHtml, minBlank) => `<div class="ic-bar" style="margin-top:-1px">${title}</div><table class="ic-t" style="margin-top:-1px">${colgroup(widths)}<tr>${heads.map(h=>TH(h)).join("")}</tr>${rowsHtml}${padRows(minBlank==null?1:minBlank, widths.length)}</table>`;
    const splitSec = (title, widths, heads, rows, rowFn, minBlank) => ({rows, render:(subset,cont)=>wrapIV(section(cont?title+" (continued)":title, widths, heads, subset.map(rowFn).join(""), subset.length ? 0 : minBlank))});
    const dbkRows = c.rows.filter(x=>x.dbkOn);
    const secA = splitSec("A. DRAWBACK &amp; ROSL CLAIM",[8,9,12,11,15,9,13,8,8,7],["1.INV SNO","2.ITEM SNO","3.DBK SNO.","4.QTY/WT","5.VALUE","6.RATE","7.DBK AMT","8.STALEV","9.CENLEV","10.ROSCTL AMT"],dbkRows,
      x=>`<tr>${TD("1",1,"c")}${TD(String(x.i+1),1,"c")}${TD(vt(x.s.dbkSlNo),1,"c")}${TD(vt(x.s.sqcMsr||x.r.quantity),1,"c")}${TD(amt(x.fobInr,2),1,"c")}${TD(vt(x.s.dbkRatePct),1,"c")}${TD(amt(x.dbkAmt,2),1,"c")}${TD("0",1,"c")}${TD("0",1,"c")}${TD("0",1,"c")}</tr>`,1);
    const lic = Array.isArray(d.licenceLines) ? d.licenceLines.filter(r=>r&&(has(r.licenceNo)||has(r.descnExportItem))) : [];
    const secB = {rows:lic, render:(subset,cont)=>wrapIV(`<div class="ic-bar" style="margin-top:-1px">B. AA / DFIA LICENCE DETAILS${cont?" (continued)":""}</div><table class="ic-t" style="margin-top:-1px">${colgroup([9,9,14,28,8,10,8,14])}
        <tr>${["1.INV SNO","2.ITEM SNO","3.LICENCE NO","4.DESCN OF EXPORT ITEM","5.EXP SNO","6.EXPQTY","7.UQC","8.FOB VALUE"].map(h=>TH(h)).join("")}</tr>
        <tr>${TD("",2,"hd","style=\"background:#d9d9d9\"")}${TH("9.SION")}${TH("10.DESCN OF IMPORT ITEM")}${TH("11IMP SNO")}${TH("12IMPQT")}${TH("13.UQC")}${TH("14.INDIG / IMP")}</tr>
        ${subset.map(r=>`<tr>${TD(vt(r.invSno),1,"c")}${TD(vt(r.itemSno),1,"c")}${TD(vt(r.licenceNo),1,"c")}${TD(vt(r.descnExportItem))}${TD(vt(r.expSno),1,"c")}${TD(vt(r.expQty),1,"c")}${TD(vt(r.uqc),1,"c")}${TD(vt(r.fobValue),1,"c")}</tr>
        <tr>${TD("",2)}${TD(vt(r.sion),1,"c")}${TD(vt(r.descnImportItem))}${TD(vt(r.impSno),1,"c")}${TD(vt(r.impQty),1,"c")}${TD(vt(r.impUqc),1,"c")}${TD(vt(r.indigImp),1,"c")}</tr>`).join("")}${subset.length?"":padRows(2,8)}</table>`)};
    const job = Array.isArray(d.jobbingLines) ? d.jobbingLines.filter(r=>r&&(has(r.beNo)||has(r.descnImported))) : [];
    const secC = splitSec("C. JOBBING DETAILS",[16,14,12,34,12,12],["1.BE NO","2.BE DATE","3.PORT CODE","4.DESCN OF IMPORTED GOODS","5.QTY IMP","6.QTY USED"],job,
      r=>`<tr>${TD(vt(r.beNo),1,"c")}${TD(dMon(r.beDate),1,"c")}${TD(vt(r.portCode),1,"c")}${TD(vt(r.descnImported))}${TD(vt(r.qtyImp),1,"c")}${TD(vt(r.qtyUsed),1,"c")}</tr>`,1);
    // Single Window Declaration rows are generated from the item-scheme particulars
    const swd = [];
    c.rows.forEach(x=>{
      const inv = "1", it = String(x.i+1), s = x.s;
      if(has(s.ptAbroad)) swd.push([inv,it,"ORC","EPT",vt(s.ptAbroad),"","",""]);
      if(has(s.sqcMsr)) swd.push([inv,it,"CHR","SQC","","",vt(s.sqcMsr),vt(s.sqcUqc)]);
      swd.push([inv,it,"ORC","DOO","665","","",""]);
      const sc = STATE_CODE[String(stateOf(x)).toUpperCase()]; if(sc) swd.push([inv,it,"ORC","STO",sc,"","",""]);
      if(x.rodOn) swd.push([inv,it,"DTY","RDT","RODTEPY","Claimed",vt(s.sqcMsr),vt(s.sqcUqc)]);
      else if(yn(s.rodtepClaimed,"")==="N") swd.push([inv,it,"DTY","RDT","RODTEPN","",vt(s.sqcMsr),vt(s.sqcUqc)]);
      swd.push([inv,it,"DTY","GCESS","","",amt(num(s.compCess),2)||"0","INR"]);
    });
    const secD = splitSec("D. SINGLE WINDOW DECLARATION",[8,8,9,22,13,14,16,10],["1.INVSN","2.ITMSN","3.INFO","4.QUALIFIER","5.INFO CD","6.INFO TEXT","7.INFO MSR","8.UQC"],swd,
      r=>`<tr>${r.map((t,i)=>TD(t,1,i===3||i===5?"c":"c")).join("")}</tr>`,1);
    const secE = splitSec("E. SINGLE WINDOW DECLARATION - CONSTITUENTS",[9,9,9,30,12,12,10,9],["1.INVSN","2.ITMSNO","3.C SNO","4.NAME","5.CODE","6.PERCENTAGE","7.YIELD PCT","8.ING"],[],()=>"",2);
    const secF = splitSec("F. SINGLE WINDOW DECLARATION - CONTROL",[9,9,18,16,10,10,9,19],["1.INVSN","2.ITMSNO","3.CONTROL TYPE","4.LOCATION","5.ST DT","6.END DT","7.RES CD","8.RES TEXT"],[],()=>"",2);
    const sup = Array.isArray(d.supportingDocs) ? d.supportingDocs.filter(r=>r&&(has(r.docTypeCd)||has(r.irn))) : [];
    const secG = splitSec("G.SUPPORTING DOCUMENTS",[7,7,10,17,24,10,10,8,7],["1.INVSN","2.ITMSNO","3 DOCTYPCD","4. ICEGATE ID","5. IRN","6.PARTY CD","7.ISSUE PLA","8.ISS DT","9.EXP DT"],sup,
      r=>`<tr>${TD(vt(r.invsn)||"1",1,"c")}${TD(vt(r.itmsn)||"1",1,"c")}${TD(vt(r.docTypeCd),1,"c")}${TD(vt(r.icegateId),1,"c")}${TD(vt(r.irn),1,"c")}${TD(vt(r.partyCd),1,"c")}${TD(vt(r.issuePlace),1,"c")}${TD(dMon(r.issueDt),1,"c")}${TD(dMon(r.expDt),1,"c")}</tr>`,2);
    const secH = {html:wrapIV(section("H.INVOICE DETAILS",[10,40,30,20],["1.SNO","2.INVOICE NO","3.INVOICE AMOUNT","4.CURRENCY"], has(d.commInvoiceNo)?`<tr>${TD("1",1,"c")}${TD(vt(d.commInvoiceNo),1,"c")}${TD(amt(c.invVal,2),1,"c")}${TD(esc(c.cur),1,"c")}</tr>`:"",1))};
    const secI = splitSec("I.CONTAINER DETAILS",[10,44,30,16],["1.SNO","2.CONTAINER","3.SEAL","4.DATE"],conts.map((r,i)=>({r,i})),
      o=>`<tr>${TD(String(o.i+1),1,"c")}${TD(vt(o.r.containerNo),1,"c")}${TD(vt(o.r.sealNumber),1,"c")}${TD(sealDate(o.r),1,"c")}</tr>`,1);
    const ar4 = Array.isArray(d.ar4Lines) ? d.ar4Lines.filter(r=>r&&has(r.ar4No)) : [];
    const secJ = splitSec("J.AR4 DETAILS",[8,8,22,12,20,15,15],["1.INVSN","2.ITMSN","3.AR4 NUMBER","4.AR4 DATE","5.COMMISSIONERATE","6.DIVISION","7.RANGE"],ar4,
      r=>`<tr>${TD(vt(r.invsn)||"1",1,"c")}${TD(vt(r.itmsn),1,"c")}${TD(vt(r.ar4No),1,"c")}${TD(dMon(r.ar4Dt),1,"c")}${TD(vt(r.commissionerate),1,"c")}${TD(vt(r.division),1,"c")}${TD(vt(r.range),1,"c")}</tr>`,1);
    const tp = Array.isArray(d.thirdPartyLines) ? d.thirdPartyLines.filter(r=>r&&(has(r.iec)||has(r.exporterName))) : [];
    const secK = splitSec("K. THIRD PARTY DETAILS",[8,8,14,24,28,18],["1.INVSN","2.ITMSN","3.IEC","4. EXPORTER NAME","5. ADDRESS","6.GSTN ID AND TYPE"],tp,
      r=>`<tr>${TD(vt(r.invsn)||"1",1,"c")}${TD(vt(r.itmsn),1,"c")}${TD(vt(r.iec),1,"c")}${TD(vt(r.exporterName))}${TD(vt(r.address))}${TD(vt(r.gstnIdType),1,"c")}</tr>`,1);
    const mf = Array.isArray(d.manufacturerLines) ? d.manufacturerLines.filter(r=>r&&(has(r.manufactCd)||has(r.address))) : [];
    const secL = splitSec("L. ITEM MANUFACTURER/PRODUCER/GROWER DETAILS",[8,8,9,16,15,12,32],["1.INVSN","2.ITMSN","3.TYPE","4.MANUFACT CD","5.SOURCE STATE","6.TRANS CY","7.ADDRESS"],mf,
      r=>`<tr>${TD(vt(r.invsn)||"1",1,"c")}${TD(vt(r.itmsn),1,"c")}${TD(vt(r.type),1,"c")}${TD(vt(r.manufactCd),1,"c")}${TD(vt(r.sourceState),1,"c")}${TD(vt(r.transCy),1,"c")}${TD(vt(r.address))}</tr>`,1);
    const rodRows = c.rows.filter(x=>x.rodOn);
    const secM = splitSec("M. RODTEP DETAILS",[9,9,26,12,18,26],["1.INVSN","2.ITMSN","3. QUANTITY","4. UQC","5. NO. OF UNITS","6. VALUE"],rodRows,
      x=>`<tr>${TD("1",1,"c")}${TD(String(x.i+1),1,"c")}${TD(vt(x.s.sqcMsr||x.r.quantity),1,"c")}${TD(vt(x.s.sqcUqc||x.r.unit),1,"c")}${TD("1",1,"c")}${TD(String(x.rodAmt),1,"c")}</tr>`,1);
    const ivGlossary = ["INVSN - Invoice Serial Number ITMSN - Item Serial Number <b>A:</b> DBK - Drawback, ROSL - Rebate of State Levies, <b>B:</b> DFIA - Duty Free Import","Authorization, EXP - Export , IMP - Import , UQC-Unit Quanity CodeFOB - Freight On Board <b>D:</b> INFO - Information CD - Code MSR - Measurement","<b>E:</b> ING - Ingredient <b>F :</b> RES CD - Result Code, RES TXT - Result Text ST DT -Start Date <b>G:</b> IRN - Image Reference Number CD - Code PLA - Place"];
    const part4 = {title:"PART - IV - EXPORT SCHEME DETAILS", glossary:ivGlossary, wrapMeasure:measureLabelled, wrap:inner=>`<div class="ic-row ic-tight" style="min-height:100%">${sideLabel("OTHER ADDITIONAL INFORMATION")}<div style="flex:1">${inner}</div></div>`, blocks:[secA,secB,secC,secD,secE,secF,secG,secH,secI,secJ,secK,secL,secM]};

    /* ---------------------------------------------------------------- PART V */
    const cbCode = vt(d.chaLicenseNo);
    const declDate = has(d.declDate) ? dMon(d.declDate) : "";
    const V = `<div style="display:flex;flex-direction:column;height:100%">
      <div class="ic-row" style="flex:1;border-bottom:1px solid #000">${sideLabel("A. DECLARATION STATEMENT")}<div style="flex:1"></div></div>
      <div class="ic-row" style="height:112px">${sideLabel("B. AUTHORIZED<br>SIGNATORY")}<div style="flex:1;padding:14px 12px 8px;position:relative;font-size:9.4px">
        <div style="position:absolute;left:12px;bottom:34px;font-weight:700">DATE <span style="font-weight:400;margin-left:8px">${declDate}</span></div>
        <div style="position:absolute;left:12px;bottom:10px;font-weight:700">PLACE <span style="font-weight:400;margin-left:8px">${vt(d.declPlace)}</span></div>
        <div style="position:absolute;left:262px;bottom:34px;font-weight:700">AUTHORIZED SIGNATORY <span style="font-weight:400;margin-left:12px">CHA NAME :${cbCode}</span></div>
        <div style="position:absolute;left:262px;bottom:10px;font-size:9px">${vt(d.signatoryName)}${has(d.signatoryDesignation)?", "+vt(d.signatoryDesignation):""}${d.digitalSignatureApplied?" &nbsp;(Class 3 DSC applied - simulated)":""}</div>
      </div></div></div>`;
    const part5 = {title:"PART - V - DECLARATIONS", blocks:[{html:V}], glossary:[], noGlossary:true};

    const parts = [part1, part2, part3, part4, part5];
    try{
      return wrapDoc(paginate("sb", hdr, parts));
    }catch(e){
      console.warn("Shipping Bill pagination fell back to one page per Part:", e);
      return wrapDoc(parts.map((p,i)=>{ const inner = p.blocks.map(b=>b.rows ? b.render(b.rows,false) : b.html).join(""); return pageHtml("sb", hdr, p, p.wrap ? p.wrap(inner) : inner, i+1, parts.length); }).join(""));
    }
  }

  root.SkIC = {esc, has, vt, num, amt, pad2, dMon, dSlash, dDash, dtMon, dtHM, isoOf, yn, stamp, seqDigits, qrSvg, emblemSvg, colgroup, eq, TH, TD, sideLabel, lines, kvLine, splitLines, paginate, pageHtml, wrapDoc, STATE_CODE, SB_PORTS, sbCompute, MON};
  root.renderShippingBillSpecimen = renderShippingBillSpecimen;
})(typeof window !== "undefined" ? window : globalThis);
