/* =========================================================================
   BILL OF ENTRY — ICEGATE print layout (Parts I - VI)
   Uses the SkIC helpers from customs-forms.js.  Part I Summary, Part II
   Invoice & Valuation, Part III Duties, Part IV Additional Details, Part V
   Other Compliances, Part VI Declaration.  All values come from the
   student's formData; totals are computed from the item rows.
   ========================================================================= */
(function(root){
  "use strict";
  const IC = root.SkIC;
  if(!IC) return;
  const {esc, has, vt, num, amt, pad2, dMon, dSlash, dDash, dtMon, dtHM, yn, stamp, seqDigits, qrSvg, emblemSvg, colgroup, eq, TH, TD, sideLabel, lines, kvLine, splitLines, paginate, pageHtml, wrapDoc} = IC;

  const BE_TYPE = {"Home Consumption":["H","BILL OF ENTRY FOR HOME CONSUMPTION"], "Warehouse":["W","BILL OF ENTRY FOR WAREHOUSING"], "Ex-Bond":["X","BILL OF ENTRY FOR EX-BOND CLEARANCE"]};
  const DECLARATIONS = [
    "Declaration for 0/0:  I/We declare that the contents of this Bill of Entry for goods imported against above mentioned Bill of Lading/ Airway Bill /Lorry Receipt/Railway Receipt numbers are in accordance with the above mentioned invoice(s) No(s)and other documents presented herewith.",
    "Declaration for 0/0:  I/We declare that the contents of the above mentioned invoice(s) and documents are true and correct in every respect.I/We have not received and do not know of any other documents or information showing a different description, quantity, price, value, of the said goods and that if at any time hereafter I/We discover any document / information showing different facts, I/We will immediately make the same known to the Commissioner of Customs.",
    "Declaration for 1/0:  I/We declare that all conditions or restrictions, if any, imposed by the seller of any third party on the disposition or use of the imported goods [as per proviso to Rule 3(2)) of the Customs Valuation Rules, 2007] are specified above.",
    "Declaration for 1/0:  I/We declare that the price paid or payable by the importer is as per the details provided above, and any price paid or payable in addition to the above will be settled with the seller at the end of a defined period by means of debit note / credit note (post import price adjustment), which are as per the contract attached as a supporting document.",
    "Declaration for 1/0:  I/We declare that there are no payments actually paid or payable for the imported goods by way of cost and services [in terms of Rules 10(1)(a)(i), Rule 10(1)(a)(ii), Rule 10 (1) (a) (iii) and Rule 10 (1) (b) of Customs Valuation Rules, 2007], Royalty / Licence Fee / subsequent resale or use of goods /other payment as a condition of sale [(Please see Rule 10 (1) (c), (d) & (e) of Customs Valuation Rules, 2007] other than those declared in the invoice which are mentioned as miscellaneous charges in this Bill of Entry."
  ];

  function renderBillOfEntrySpecimen(dIn){
    const d = dIn || (typeof formData !== "undefined" ? formData : {}) || {};
    const submitted = !!d.submitToIcegate;
    const items = (Array.isArray(d.itemDetails) ? d.itemDetails : []).filter(r => r && (has(r.hsCode) || has(r.description) || has(r.quantity)));
    const comp = Array.isArray(d.itemCompliance) ? d.itemCompliance : [];
    const duty = Array.isArray(d.itemDutyRates) ? d.itemDutyRates : [];
    const conts = (Array.isArray(d.containerDetails) ? d.containerDetails : []).filter(r => r && has(r.containerNo));
    const cur = has(d.currency) ? String(d.currency).trim().toUpperCase() : "";
    const rate = num(d.exchangeRate);
    const assTotal = items.reduce((a,r)=>a+num(r.assessableValue), 0);
    const dutyOf = r => num(r.customsDuty)+num(r.igst)+num(r.sws)+num(r.antiDumpingDuty)+num(r.safeguardDuty);
    const bcd = num(d.bcdTotal), sws = num(d.swsTotal), igst = num(d.igstTotal), gcess = num(d.compensationCess), add = num(d.antiDumpingTotal), sg = num(d.safeguardTotal);
    const acd = num(d.acdTotal), nccd = num(d.nccdTotal), cvd = num(d.cvdTotal), saed = num(d.saedTotal), gsia = num(d.gsiaTotal), tta = num(d.ttaTotal), health = num(d.healthTotal);
    const totDuty = Math.round(bcd+acd+sws+nccd+add+cvd+igst+gcess+sg+saed+gsia+tta+health);   // duty is rounded off to the rupee
    const intr = num(d.interest), pnl = num(d.penalty), fine = num(d.fine);
    const totAmt = Math.round(totDuty + intr + pnl + fine);

    let genNo = d.beNumberGenerated;
    if(!genNo && submitted && typeof findFieldByName === "function"){ try{ const gf = findFieldByName("beNumberGenerated"); if(gf && typeof gf.compute === "function") genNo = gf.compute(d); }catch(e){} }
    const beNo = (submitted && genNo) ? seqDigits(genNo, 7) : "";
    const tSub = stamp(d, "beSubmittedAt", submitted, 0);
    const tAss = tSub ? new Date(tSub.getTime() + 2*60000) : null;
    const tExam = (tSub && yn(d.exam) === "Y") ? new Date(tSub.getTime() + 26*3600000) : null;
    const typ = BE_TYPE[d.beType] || ["H", "BILL OF ENTRY FOR HOME CONSUMPTION"];
    const beDate = has(d.importDate) ? dSlash(d.importDate) : (tSub ? dSlash(isoOfDate(tSub)) : "");
    function isoOfDate(dt){ return `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}`; }
    const oocT = has(d.oocTime) ? vt(d.oocTime) : "";
    const refBase = has(d.oocDate) ? d.oocDate : (tSub ? isoOfDate(tSub) : "");
    const refP = String(refBase||"").split("-");
    const ref = (refP.length === 3 && submitted) ? `BE1${refP[2]}${refP[1]}${refP[0]}${(oocT||dtHM(tSub||new Date())).replace(":","")}` : "";
    const statusTxt = vt(d.beStatus) || "";
    const gstinTxt = has(d.gstin) ? `${vt(d.gstin)}/${vt(d.gstinType || "G")}` : "";
    const mode = has(d.modeOfTransport) ? vt(d.modeOfTransport) : "";
    const port = has(d.customsLocation) ? "PORT : " + esc(String(d.customsLocation).trim().toUpperCase()) : "";

    const hdr = `<div class="ic-hdr">
      <div class="ic-hdr-l"><div class="ic-hdr-brand">${emblemSvg(40)}</div>
        <div class="ic-hdr-banner">INDIAN CUSTOMS</div>
        <div class="ic-hdr-port">${port}<br>${esc(typ[1])}</div></div>
      <div class="ic-hdr-r"><table class="ic-hdr-tbl">${eq(8)}
        <tr>${TD("Port Code",2,"k")}${TD("BE No",2,"k","style=\"text-align:center\"")}${TD("BE Date",2,"k","style=\"text-align:center\"")}${TD("BE Type",2,"k","style=\"text-align:center\"")}</tr>
        <tr>${TD(vt(d.portCode),2)}${TD(esc(beNo),2)}${TD(beDate,2)}${TD(typ[0],2)}</tr>
        <tr>${TD("IEC/Br",2,"k")}${TD(vt(d.iecNumber) + (has(d.branchSerialNo) ? "/" + vt(d.branchSerialNo) : ""),3)}${TD(statusTxt,3)}</tr>
        <tr>${TD("GSTIN/TYPE",2,"k")}${TD(gstinTxt,6)}</tr>
        <tr>${TD("CB CODE",2,"k")}${TD(vt(d.cbCode),6)}</tr>
        <tr>${TD("TYPE",2,"k")}${TD("INV",2,"k","style=\"text-align:center\"")}${TD("ITEM",2,"k","style=\"text-align:center\"")}${TD("CONT",2,"k","style=\"text-align:center\"")}</tr>
        <tr>${TD("Nos",2,"k")}${TD(has(d.commInvoiceNo)?"1":"",2)}${TD(String(items.length||""),2)}${TD(String(conts.length||""),2)}</tr>
        <tr>${TD("PKG",1,"k")}${TD(vt(d.noOfPackages),2)}${TD("G.WT (KGS)",3,"k")}${TD(has(d.totalGrossWeight)?amt(num(d.totalGrossWeight),2):"",2)}</tr>
      </table><div class="ic-hdr-qr">${qrSvg(ref || "BE")}<div class="ref">${ref}</div></div></div>
    </div>`;

    const padRows = (n, cols) => Array.from({length:Math.max(0,n)}, ()=>`<tr class="blank">${"<td></td>".repeat(cols)}</tr>`).join("");
    const money = x => amt(x, 2) || "0";
    const hasItems = items.length > 0;

    /* ---------------------------------------------------------------- PART I */
    const flags = [["1.BE STATUS",statusTxt],["2.MODE",mode],["3.DEF BE",yn(d.defBe)],["4.KACHA",yn(d.kacha)],["5.SEC 48",yn(d.sec48)],["6.REIMP",yn(d.reimp)],["7.ADV BE (Y/N/P)",yn(d.advBe)],["8.ASSESS",yn(d.assess)],["9.EXAM",yn(d.exam)],["10.HSS",yn(d.hss)],["11.FIRST CHECK",yn(d.firstCheck)],["12. PROV/ FINAL",yn(d.provFinal,"F")]];
    const A = `<div class="ic-row ic-sec">${sideLabel("A. STATUS")}<div style="flex:1"><table class="ic-t">${eq(24)}
      <tr>${flags.map(f=>TH(f[0],2)).join("")}</tr>
      <tr>${flags.map(f=>TD(f[1],2,"c")).join("")}</tr>
      <tr>${TD("13.COUNTRY OF ORIGIN",6,"lb")}${TD(vt(d.countryOrigin),6,"c")}${TD("14.COUNTRY OF CONSIGNMENT",6,"lb")}${TD(vt(d.countryExport),6,"c")}</tr>
      <tr>${TD("15.PORT OF LOADING",6,"lb")}${TD(vt(d.portLoading),6,"c")}${TD("16.PORT OF SHIPMENT",6,"lb")}${TD(vt(d.portOfShipment||d.portLoading),6,"c")}</tr></table></div></div>`;
    const impLines = [vt(d.importerName)].concat(splitLines(d.importerAddress, 4));
    const B = `<div class="ic-row ic-sec">${sideLabel("B. DECLARANT")}<div style="flex:1"><table class="ic-t">${colgroup([50,50])}
      <tr><td style="padding:0;vertical-align:top">${kvLine("1.IMPORTER &nbsp;NAME &amp; ADDRESS","")}${lines(impLines,5)}${kvLine("AD CODE", vt(d.adCode))}</td>
          <td style="padding:0;vertical-align:top">${lines([],1)}${kvLine("2.CB NAME", vt(d.chaDetails))}${kvLine("3.AEO", vt(d.aeoStatus))}${lines([],1)}${kvLine("4.UCR", vt(d.ucr))}</td></tr></table></div></div>`;
    const C = `<div class="ic-row ic-sec">${sideLabel("C. DUTY SUMMARY")}<div style="flex:1"><table class="ic-t">${eq(20)}
      <tr>${["1.BCD","2.ACD","3.SWS","4.NCCD","5.ADD","6.CVD","7.IGST","8.G.CESS"].map(t=>TH(t,2)).join("")}${TH("18.TOT.ASS VAL",4)}</tr>
      <tr>${[bcd,acd,sws,nccd,add,cvd,igst,gcess].map(x=>TD(hasItems?money(x):"",2,"c")).join("")}${TD(hasItems?money(assTotal):"",4,"c")}</tr>
      <tr>${["9.SG","10.SAED","11.GSIA","12.TTA","13.HEALTH","14.TOTAL DUTY","15.INT","16.PNLTY","17.FINE","19.TOT. AMOUNT"].map((t,i)=>TH(t,i===9?4:2)).join("").replace(/colspan="4"/,"colspan=\"2\"")}</tr>
      <tr>${[sg,saed,gsia,tta,health,totDuty,intr,pnl,fine].map(x=>TD(hasItems?money(x):"",2,"c")).join("")}${TD(hasItems?money(totAmt):"",2,"c")}</tr></table></div></div>`;
    const D = `<div class="ic-row ic-sec">${sideLabel("D.MANIFEST DETAILS")}<div style="flex:1"><table class="ic-t">${colgroup([10,10,10,8,8,13,9,8,8,6,10])}
      <tr>${["1.IGM NO","2.IGM DATE","3.INW DATE","4.GIGMNO","5.GIGMDT","6.MAWB NO","7.DATE","8.HAWB NO","9.DATE","10.PKG","11.GW"].map(t=>TH(t)).join("")}</tr>
      <tr>${[vt(d.igmNumber),dSlash(d.igmDate),dSlash(d.arrivalDate),vt(d.gigmNo),dSlash(d.gigmDate),vt(d.blAwbNumber),dSlash(d.blAwbDate),vt(d.hawbNo),dSlash(d.hawbDate),vt(d.noOfPackages),has(d.totalGrossWeight)?amt(num(d.totalGrossWeight),2):""].map(t=>TD(t,1,"c")).join("")}</tr>
      <tr class="blank"><td colspan="11" style="height:26px"></td></tr></table></div></div>`;
    const E = `<div class="ic-row ic-sec">${sideLabel("E. BOND DETAILS")}<div style="flex:1.18"><table class="ic-t">${colgroup([22,20,18,22,18])}
        <tr>${["1.BOND NO.","2.PORT","3.BOND CD","4.DEBT AMT","5.BG AMT"].map(t=>TH(t)).join("")}</tr>
        <tr>${[vt(d.bondNo),vt(d.bondPort),vt(d.bondCd),vt(d.bondDebtAmt),vt(d.bgAmt)].map(t=>TD(t,1,"c")).join("")}</tr>${padRows(4,5)}</table></div>
      ${sideLabel("F. PAYMENT DETAILS")}<div style="flex:1"><table class="ic-t">${colgroup([16,34,22,28])}
        <tr>${["1.SR NO","2.CHALLAN NO","3.PAID ON","4.AMOUNT(Rs.)"].map(t=>TH(t)).join("")}</tr>
        <tr>${has(d.challanNumber)?[ "1",vt(d.challanNumber),dSlash(d.challanDate),hasItems?money(totAmt):""].map(t=>TD(t,1,"c")).join(""):"<td></td><td></td><td></td><td></td>"}</tr>${padRows(4,4)}</table></div></div>`;
    const evRow = (n, dt, tm) => `<tr>${TD(n,1,"lb")}${TD(dt,1,"c")}${TD(tm,1,"c")}</tr>`;
    const oocDate = has(d.oocDate) ? dDash(d.oocDate) : "";
    const G = `<div class="ic-row ic-sec">${sideLabel("G. WH")}<div style="flex:1"><table class="ic-t">${colgroup([26,18,26,30])}
        <tr>${["1.WBE NO.","2.DATE","3.WBE SITE","4.WH CODE"].map(t=>TH(t)).join("")}</tr>
        <tr>${[vt(d.wbeNo),dSlash(d.wbeDate),vt(d.wbeSite),vt(d.whCode)].map(t=>TD(t,1,"c")).join("")}</tr></table></div></div>`;
    const Hh = `<div class="ic-row ic-sec">${sideLabel("H. PROCESSING DETAILS")}<div style="flex:1"><table class="ic-t">${colgroup([24,26,18,32])}
        <tr>${TH("1.EVENT")}${TH("2.DATE")}${TH("3.TIME")}${TH("EXCHANGE RATE")}</tr>
        <tr>${TD("Submission",1,"lb")}${TD(tSub?dMon(isoOfDate(tSub)):"",1,"c")}${TD(tSub?dtHM(tSub):"",1,"c")}${TD(cur&&rate?"INR=INR":"",1,"c")}</tr>
        <tr>${TD("Assessment",1,"lb")}${TD(tAss?dMon(isoOfDate(tAss)):"",1,"c")}${TD(tAss?dtHM(tAss):"",1,"c")}${TD(cur&&rate?`1 ${esc(cur)}=${amt(rate,4)}INR`:"",1,"c")}</tr>
        <tr>${TD("Examination",1,"lb")}${TD(tExam?dMon(isoOfDate(tExam)):"",1,"c")}${TD(tExam?dtHM(tExam):"",1,"c")}${TD("",1,"c")}</tr>
        <tr>${TD("OOC",1,"lb")}${TD(oocDate,1,"c")}${TD(oocT,1,"c")}${TD("",1,"c")}</tr></table></div></div>`;
    const cRows = conts.map((r,i)=>`<tr>${TD(String(i+1),1,"c")}${TD(vt(r.lclFcl)||"F",1,"c")}${TD(vt(r.truckNo),1,"c")}${TD(vt(r.sealNumber)||"N.A.",1,"c")}${TD(vt(r.containerNo),1,"c")}</tr>`).join("");
    const Jc = `<div class="ic-row ic-sec" style="min-height:120px">${sideLabel("J. CONTAINER DETAILS *")}<div style="flex:1;display:flex"><table class="ic-t" style="height:100%">${colgroup([8,12,20,24,36])}
        <tr>${TH("1.SNO")}${TH("2.LCL/ FCL")}${TH("3.TRUCK")}${TH("4.SEAL")}${TH("5.CONTAINER NUMBER")}</tr>${cRows}${padRows(5-conts.length,5)}</table></div></div>`;
    const invSum = `<div class="ic-row ic-sec" style="flex:1">${sideLabel("I. INVOICE DETAILS - SUMMARY#")}<div style="flex:1;display:flex"><table class="ic-t" style="height:100%">${colgroup([12,38,32,18])}
        <tr>${["1.S.NO","2.INVOICE NO","3.INV. AMT","4.CUR"].map(t=>TH(t)).join("")}</tr>
        <tr>${has(d.commInvoiceNo)?[ "1",vt(d.commInvoiceNo),hasItems||has(d.totalInvoiceValue)?amt(num(d.totalInvoiceValue),2):"",esc(cur)].map(t=>TD(t,1,"c")).join(""):"<td></td><td></td><td></td><td></td>"}</tr><tr><td colspan="4" style="height:100%"></td></tr></table></div></div>`;
    const oocBox = `<table class="ic-t" style="margin-top:-1px">${colgroup([22,78])}<tr>${TD("OOC NO.",1,"lb")}${TD(vt(d.oocNumber),1,"c")}</tr><tr>${TD("OOC DATE",1,"lb")}${TD(oocDate,1,"c")}</tr></table>`;
    const lowerBlock = `<div style="display:flex;align-items:stretch"><div style="flex:1.05;min-width:0">${G}${Hh}${Jc}</div><div style="flex:1;min-width:0;display:flex;flex-direction:column;border-left:0">${invSum}${oocBox}</div></div>`;
    const sigOverlay = submitted ? `<div class="ic-sig"><div class="big">Signature (Simulated)</div>Digitally signed by SKELORA SIMULATOR<span class="mk">i</span><br>Date: ${tSub.getFullYear()}.${pad2(tSub.getMonth()+1)}.${pad2(tSub.getDate())} ${dtHM(tSub)} IST<br>Reason: CUSTOMS<br>Location: INDIA</div>` : "";
    const gl1 = ["<b>A :</b> DEF - Deferred Payment, REIMP - Reimport, ADV - Advance, P - Prior, HSS - HighSeaSale; <b>B :</b> CB - Customs Broker, AEO - Authorized","Economic Operator, UCR - Unique Customs Reference; <b>D :</b> GIGM - Gateway IGM; <b>G :</b> WBE - WareHouse BE; <b>I :</b> OOC - Out of Charge, # Refer Part","IV for full list of Invoices <b>J :</b> * Refer Part IV for full list of Containers;"];
    const part1 = {title:"PART - I - BILL OF ENTRY SUMMARY", glossaryTitle:"GLOSSARY", glossary:gl1, overlay:sigOverlay, blocks:[{html:A},{html:B},{html:C},{html:D},{html:E},{html:lowerBlock}]};

    /* ---------------------------------------------------------------- PART II */
    const poTxt = has(d.poNumber) ? `${vt(d.poNumber)} ${has(d.poDate)?dDash(d.poDate):""}` : "";
    const lcTxt = has(d.lcNumber) ? `${vt(d.lcNumber)} ${has(d.lcDate)?dDash(d.lcDate):""}` : "";
    const ctTxt = has(d.contractNo) ? `${vt(d.contractNo)} ${has(d.contractDate)?dDash(d.contractDate):""}` : "";
    const II_A = `<div class="ic-row ic-sec">${sideLabel("A. INVOICE")}<div style="flex:1"><table class="ic-t">${colgroup([6,22,24,24,24])}
      <tr>${["1.S.NO","2.INVOICE NO. &amp; DT.","3.PURCHASE ORDER NO &amp; DT","4.LC NO &amp; DATE","5.CONTRACT NO &amp; DATE"].map(t=>TH(t)).join("")}</tr>
      <tr>${TD(has(d.commInvoiceNo)?"1":"",1,"c")}${TD(`${vt(d.commInvoiceNo)}<br>${dMon(d.invoiceDate)}`,1,"c")}${TD(poTxt,1,"c")}${TD(lcTxt,1,"c")}${TD(ctTxt,1,"c")}</tr></table></div></div>`;
    const supLines = [vt(d.supplierName)].concat(splitLines(d.supplierAddress, 3));
    const II_B = `<div class="ic-row ic-sec">${sideLabel("B. TRANSACTING PARTIES")}<div style="flex:1"><table class="ic-t">${eq(2)}
      <tr><th>1.BUYER'S NAME &amp; ADDRESS</th><th>2.SELLER'S NAME &amp; ADDRESS</th></tr>
      <tr><td style="padding:0">${lines([vt(d.importerName)].concat(splitLines(d.importerAddress,4)),5)}</td><td style="padding:0">${lines([vt(d.sellerName)].concat(splitLines(d.sellerAddress,4)),5)}</td></tr>
      <tr><th>3.SUPPLIER NAME &amp; ADDRESS</th><th>4.THIRD PARTY NAME &amp; ADDRESS</th></tr>
      <tr><td style="padding:0">${lines(supLines,5)}</td><td style="padding:0">${lines([vt(d.thirdPartyName)].concat(splitLines(d.thirdPartyAddress,4)),5)}</td></tr>
      <tr><td style="padding:0">${kvLine("5.AEO", vt(d.supplierAeo))}</td><td style="padding:0">${kvLine("6. AD CODE", vt(d.adCode))}</td></tr></table></div></div>`;
    const II_C = `<div class="ic-row ic-sec">${sideLabel("C. VALUATION")}<div style="flex:1"><table class="ic-t">${colgroup([13,12,11,10,12,11,10,21])}
      <tr>${["1.INV VALUE","2.FREIGHT","3.INSURANCE","4.HSS.","5.LOADING","6.COMMN","7.PAY TERMS","8.VALUATION METHOD"].map(t=>TH(t)).join("")}</tr>
      <tr>${[has(d.totalInvoiceValue)?amt(num(d.totalInvoiceValue),2):"", has(d.freight)?amt(num(d.freight),2):"", has(d.insurance)?amt(num(d.insurance),2):"", has(d.hssAmt)?amt(num(d.hssAmt),2):"", has(d.loadingCharges)?amt(num(d.loadingCharges),2):"", has(d.commissionAmt)?amt(num(d.commissionAmt),2):"", vt(d.payTerms), vt(d.valuationMethod)].map(t=>TD(t,1,"c")).join("")}</tr>
      <tr>${TD("14.Cur",1,"lb")}${TD(esc(cur),1,"c")}${TH("9.RELTD")}${TH("10.SVB CH")}${TH("11.SVB NO")}${TH("12.DATE")}${TH("13LOA")}${TD("",1,"nb")}</tr>
      <tr>${TD("15.Term",1,"lb")}${TD(vt(d.incoterm),1,"c")}${TD(yn(d.relatedParty),1,"c")}${TD(yn(d.svbCh),1,"c")}${TD(vt(d.svbNo),1,"c")}${TD(dSlash(d.svbDate),1,"c")}${TD(yn(d.loa),1,"c")}${TD("",1,"nb")}</tr></table></div></div>`;
    const II_D = `<div class="ic-row ic-sec">${sideLabel("D. COST &amp; SERVICES")}<div style="flex:1"><table class="ic-t">${eq(14)}
      <tr>${["1.C&amp;B","2.CoC","3.CoP","4.HND CHG","5.G&amp;S","6.DOC. CH"].map(t=>TH(t,2)).join("")}${TD("",2,"nb")}</tr>
      <tr>${[d.cbAmt,d.cocAmt,d.copAmt,d.hndChg,d.gsAmt,d.docChg].map(x=>TD(has(x)?amt(num(x),2):"",2,"c")).join("")}${TD("",2,"nb")}</tr>
      <tr>${["7.COO","8.R &amp; LF","9.OTH COST","10.LD / ULD","11.WS","12.OTC"].map(t=>TH(t,2)).join("")}${TH("13.MISC CHARGE",2)}</tr>
      <tr>${[d.cooChg,d.rlfAmt,d.othCost,d.ldUld,d.wsAmt,d.otcAmt,d.miscCharge].map(x=>TD(has(x)?amt(num(x),2):"",2,"c")).join("")}</tr>
      <tr>${TD("",10,"nb")}${TH("14.ASS. VALUE",4)}</tr>
      <tr>${TD("",10,"nb")}${TD(hasItems?amt(assTotal,2):"",4,"c")}</tr></table></div></div>`;
    const itemBlockII = {rows:items.map((r,i)=>({r,i})), render:(rows)=>`<div class="ic-row ic-sec">${sideLabel("E. ITEM DETAILS")}<div style="flex:1"><table class="ic-t">${colgroup([7,13,38,13,12,8,14])}
      <tr>${["1.S NO.","2.CTH","3.DESCRIPTION","4.UNIT PRICE","5.QUANTITY","6.UQC","7.AMOUNT"].map(t=>TH(t)).join("")}</tr>
      ${rows.map(o=>`<tr>${TD(String(o.i+1),1,"c")}${TD(vt(o.r.hsCode),1,"c")}${TD(vt(o.r.description))}${TD(has(o.r.unitPrice)?amt(num(o.r.unitPrice),6):"",1,"r")}${TD(has(o.r.quantity)?amt(num(o.r.quantity),6):"",1,"r")}${TD(vt(o.r.unit),1,"c")}${TD(has(o.r.unitPrice)&&has(o.r.quantity)?amt(num(o.r.unitPrice)*num(o.r.quantity),2):"",1,"r")}</tr>`).join("")}${rows.length<3?padRows(3-rows.length,7):""}</table></div></div>`};
    const part2 = {title:`PART - II - INVOICE &amp; VALUATION DETAILS (Invoice &nbsp; 1 / 1 &nbsp;)`, glossaryTitle:"GLOSSARY", blocks:[{html:II_A+II_B+II_C+II_D}, itemBlockII],
      glossary:["<b>A :</b> LC - Letter of Credit; <b>B :</b> AD - Authorized Dealer; <b>C :</b> HSS - High Sea Sale; <b>D :</b> C&amp;B Commission &amp; Brokerage, CoC - Cost of Container,CoP - Co","of Packing, HND CHG - Handling Charges, G&amp;S - Goods and Service input cost, DOC CH - Document Charges, CoO - Country of Origin Certificate,","R&amp;LF - Royalty and Licence Fees, LD/ULD - Loading Unloading Charges, WS - Warranty Services, OTC - Other Costs, CTH - Customs Tariff Head,","UQC - Unit Quantity Code"]};

    /* ---------------------------------------------------------------- PART III */
    const itemBlock = o => {
      const r = o.r, cp = comp[o.i] || {}, dr = duty[o.i] || {};
      const dutyAmt = dutyOf(r);
      const t1 = `<div class="ic-row">${sideLabel("A. ITEM DETAILS")}<div style="flex:1"><table class="ic-t">${colgroup([6,6,10,11,34,5,5,5,5,5])}
        <tr>${["1.INVSNO","2.ITEMSN","3.CTH","4.CETH","5.ITEM DESCRIPTION","6.FS","7.PQ","8.DC","9.WC","10.AQ"].map(t=>TH(t)).join("")}</tr>
        <tr>${TD("1",1,"c")}${TD(String(o.i+1),1,"c")}${TD(vt(r.hsCode),1,"c")}${TD(vt(cp.ceth),1,"c")}${TD(vt(r.description))}${["fs","pq","dc","wc","aq"].map(k=>TD(yn(cp[k]),1,"c")).join("")}</tr></table>
        <table class="ic-t" style="margin-top:-1px">${colgroup([8,6,7,7,9,7,6,8,6,7,6,19])}
        <tr>${["11.UPI","12.COO","13.C.QTY","14.C.UQC","15.S.QTY","16.S.UQC","17.SCH","18.STND/PR","19.RSP","20.REIMP","21.PROV","22.END USE"].map(t=>TH(t)).join("")}</tr>
        <tr>${[has(r.unitPrice)?amt(num(r.unitPrice),0):"", vt(cp.coo), vt(r.quantity), vt(r.unit), vt(cp.sQty), vt(cp.sUqc), vt(cp.schCode), vt(cp.stndPr), vt(cp.rsp), vt(cp.reimpFlag||""), vt(cp.prov), vt(r.endUse)].map(t=>TD(t,1,"c")).join("")}</tr></table>
        <table class="ic-t" style="margin-top:-1px">${colgroup([9,9,9,9,9,10,17,28])}
        <tr>${["23.PRODN","24.CNTRL","25.QUALFR","26.CONTNT","27.STMNT","28.SUP DOCS","29.ASSESS VALUE","30. TOTAL DUTY"].map(t=>TH(t)).join("")}</tr>
        <tr>${["prodn","cntrl","qualfr","contnt","stmnt","supDocs"].map(k=>TD(yn(cp[k]),1,"c")).join("")}${TD(amt(num(r.assessableValue),2),1,"c")}${TD(amt(dutyAmt,2),1,"c")}</tr></table></div></div>`;
      const dcell = (k, x) => TD(x==null||x===""?"":x,1,"c");
      const t2 = `<div class="ic-row" style="margin-top:-1px">${sideLabel("B. ITEM DUTY")}<div style="flex:1"><table class="ic-t">${colgroup([9,10,9,9,9,10,9,9,9,9,8])}
        <tr>${["DUTY","1. BCD","2.ACD","3.SWS","4.SAD","5.IGST","6.G. CESS","7.ADD","8.CVD","9.SG","10.T. VALUE"].map(t=>TH(t)).join("")}</tr>
        <tr>${TD("Notn No.",1,"lb")}${dcell(0,vt(dr.bcdNotnNo))}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,vt(dr.igstNotnNo))}${dcell(0,vt(dr.gcessNotnNo))}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}</tr>
        <tr>${TD("Notn SNo.",1,"lb")}${dcell(0,vt(dr.bcdNotnSno))}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,vt(dr.igstNotnSno))}${dcell(0,vt(dr.gcessNotnSno))}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}</tr>
        <tr>${TD("Rate",1,"lb")}${dcell(0,vt(dr.bcdRatePct))}${dcell(0,"")}${dcell(0,vt(dr.swsRatePct))}${dcell(0,"")}${dcell(0,vt(dr.igstRatePct))}${dcell(0,vt(dr.gcessRatePct))}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}</tr>
        <tr>${TD("Amount",1,"lb")}${dcell(0,has(r.customsDuty)?amt(num(r.customsDuty),2):"")}${dcell(0,"")}${dcell(0,has(r.sws)?amt(num(r.sws),2):"")}${dcell(0,"")}${dcell(0,has(r.igst)?amt(num(r.igst),2):"")}${dcell(0,"")}${dcell(0,has(r.antiDumpingDuty)?amt(num(r.antiDumpingDuty),2):"")}${dcell(0,"")}${dcell(0,has(r.safeguardDuty)?amt(num(r.safeguardDuty),2):"")}${dcell(0,"")}</tr>
        <tr>${TD("Duty Fg",1,"lb")}${dcell(0,vt(dr.bcdDutyFg))}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}</tr></table></div></div>`;
      const t3 = `<div class="ic-row" style="margin-top:-1px">${sideLabel("C. OTHER DUTIES")}<div style="flex:1"><table class="ic-t">${colgroup([9,10,9,9,9,10,9,9,9,9,8])}
        <tr>${["DUTY","1.SP EXD","2.CHCESS","3.TTA","4.CESS","5.CAIDC","6.EAIDC","7.CUS EDC","8.CUS HEC","9.NCD","10.AGGR"].map(t=>TH(t)).join("")}</tr>
        <tr>${TD("Notn No.",1,"lb")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,vt(dr.caidcNotnNo))}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}</tr>
        <tr>${TD("Notn SNo.",1,"lb")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,vt(dr.caidcNotnSno))}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}</tr>
        <tr>${TD("Rate",1,"lb")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,vt(dr.caidcRatePct))}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}</tr>
        <tr>${TD("Amount",1,"lb")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,vt(dr.caidcRatePct)?"0":"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}</tr>
        <tr>${TD("Duty Fg",1,"lb")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,vt(dr.caidcDutyFg))}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}${dcell(0,"")}</tr></table></div></div>`;
      return `<div style="margin-bottom:8px">${t1}${t2}${t3}</div>`;
    };
    const part3 = {title:"PART - III - DUTIES", glossaryTitle:"GLOSSARY", blocks:[{rows:items.map((r,i)=>({r,i})), render:(rows)=>rows.map(itemBlock).join("")}],
      glossary:["<b>A :</b> INVSNO - Invoice Sr. No., UPI - Unit Price Invoiced, C.Qty - Commercial Quantity, S.Qty - Standard Quantity, FS - Food Safety and Standards","Authority of India, PQ - Plant Quarantine, DC - Central Drugs Standard Control Organisation, WC - WildLife Crime Control Bureau , AQ - Animal","Quarantine and Certification Services, SCH - Scheme Code"]};

    /* ---------------------------------------------------------------- PART IV */
    const section = (title, widths, heads, rowsHtml, blank) => `<div class="ic-bar" style="margin-top:-1px">${title}</div><table class="ic-t" style="margin-top:-1px">${colgroup(widths)}<tr>${heads.map(h=>TH(h)).join("")}</tr>${rowsHtml}${padRows(blank==null?1:blank, widths.length)}</table>`;
    const sec = (title, widths, heads, rows, rowFn, blank) => ({rows, render:(subset,cont)=>section(cont?title+" (continued)":title, widths, heads, subset.map(rowFn).join(""), subset.length?0:blank)});
    const arr = k => (Array.isArray(d[k]) ? d[k].filter(r=>r && Object.values(r).some(v=>has(v))) : []);
    const cell = (t,cls) => TD(t,1,cls===undefined ? "c" : cls);
    const blkA = sec("A. SVB DETAILS",[9,9,16,12,10,9,8,17,10],["1.INVSNO","2.ITMSNO","3.REF NO","4. REF DT","5. PRT CD","6.LAB","7.P/F","8.LOAD DATE","9.P/F"],[],()=>"",1);
    const blkB = sec("B. PREVIOUS BEs",[10,10,22,16,14,14,14],["1.INVSNO","2.ITMSNO","3. BE NO","4. BE DATE","5. PRT CD","6.UNITPRICE","7.CURRENCY CODE"],arr("previousBes"),r=>`<tr>${cell(vt(r.invsno)||"1")}${cell(vt(r.itmsno))}${cell(vt(r.beNo))}${cell(dSlash(r.beDate))}${cell(vt(r.prtCd))}${cell(vt(r.unitPrice))}${cell(vt(r.currencyCode))}</tr>`,1);
    const blkC = sec("C. RE-IMPORT AFTER EXPORT",[8,8,10,8,7,7,8,9,10,10,8,7],["1.INVSNO","2.ITMSNO","3.NOTN NO","4.SLNO","5.FRT","6.INS","7.DUTY","8.SB NO","9.SB DT","10.PORTCD","11.SINV","12.SITEMN"],[],()=>"",1);
    const blkD = sec("D. ITEM MANUFACTURER/PRODUCER/GROWER DETAILS",[9,9,9,18,14,12,29],["1.INVSNO","2.ITMSNO","3.TYPE","4.MANUFACT CD","5.SOURCE CY","6.TRANS CY","7.ADDRESS"],arr("mfrDetails"),r=>`<tr>${cell(vt(r.invsno)||"1")}${cell(vt(r.itmsno))}${cell(vt(r.type))}${cell(vt(r.manufactCd))}${cell(vt(r.sourceCy))}${cell(vt(r.transCy))}${cell(vt(r.address),"")}</tr>`,1);
    const blkE = sec("E. ACCESSORY STATUS",[10,10,80],["1.INVSNO","2.ITMSNO","3.ACESSORY ITEM DETAILS"],[],()=>"",1);
    const lic = sec("F. LICENCE DETAILS",[8,8,9,16,11,7,10,12,7,6,8],["1.INVSNO","2.ITMSNO","3.LIC SLNO","4.LIC NO","5.LIC DATE","6.CODE","7.PORT","8.DEBIT VALUE","9.QTY","10.UQC","11.DEBIT DUTY"],arr("beLicences"),r=>`<tr>${cell(vt(r.invsno)||"1")}${cell(vt(r.itmsno))}${cell(vt(r.licSlno))}${cell(vt(r.licNo))}${cell(dSlash(r.licDate))}${cell(vt(r.code))}${cell(vt(r.port))}${cell(vt(r.debitValue))}${cell(vt(r.qty))}${cell(vt(r.uqc))}${cell(vt(r.debitDuty))}</tr>`,1);
    const certs = arr("beCertificates");
    const blkGH = {html:`<div style="display:flex"><div style="flex:1.45"><div class="ic-bar" style="margin-top:-1px">G. CERTIFICATE DETAILS</div><table class="ic-t" style="margin-top:-1px">${colgroup([40,30,30])}<tr>${["1.CERTIFICATE NUMBER","2.DATE","3.TYPE"].map(h=>TH(h)).join("")}</tr>${certs.map(r=>`<tr>${cell(vt(r.certNo))}${cell(dSlash(r.certDate))}${cell(vt(r.certType))}</tr>`).join("")}${padRows(certs.length?0:1,3)}</table></div>
        <div style="flex:1"><div class="ic-bar" style="margin-top:-1px">H.HSS DETAILS</div><table class="ic-t" style="margin-top:-1px">${colgroup([30,30,40])}<tr>${["1.PRC LEVEL","2.IEC","3.BRANCH SLNO"].map(h=>TH(h)).join("")}</tr>${padRows(1,3)}</table></div></div>`};
    const swdRows = arr("swdLines");
    const blkI = sec("I. SINGLE WINDOW DECLARATION",[8,8,10,20,14,22,12,6],["1.INVSN","2.ITMSNO","3.INFO TYP","4.QUALIFIER","5.INFO CD","6.INFO TEXT","7.INFO MSR","8.UQC"],swdRows,r=>`<tr>${cell(vt(r.invsn)||"1")}${cell(vt(r.itmsn)||"1")}${cell(vt(r.infoTyp))}${cell(vt(r.qualifier))}${cell(vt(r.infoCd))}${cell(vt(r.infoText))}${cell(vt(r.infoMsr))}${cell(vt(r.uqc))}</tr>`,1);
    const blkJ = sec("J. SINGLE WINDOW DECLARATION - CONSTITUENTS",[9,9,9,30,12,12,10,9],["1.INVSN","2.ITMSNO","3.C SNO","4.NAME","5.CODE","6.PERCENTAGE","7.YIELD PCT","8.ING"],[],()=>"",1);
    const blkK = sec("K. SINGLE WINDOW DECLARATION - CONTROL",[9,9,18,16,10,10,9,19],["1.INVSN","2.ITMSNO","3.CONTROL TYPE","4.LOCATION","5.SRT DT","6.END DT","7.RES CD","8.RES TEXT"],[],()=>"",1);
    const blkL = sec("L. SUPPORTING DOCUMENTS",[7,7,9,14,26,8,12,9,8],["1.INVSN","2.ITMSNO","3.TYP","4.ICEGATE ID","5.IRN","6.DOC CODE","7.ISSUE PLACE","8.ISSUE DT","9.EXP DT"],arr("beSupportingDocs"),r=>`<tr>${cell(vt(r.invsn)||"0")}${cell(vt(r.itmsn)||"0")}${cell(vt(r.typ))}${cell(vt(r.icegateId))}${cell(vt(r.irn))}${cell(vt(r.docCode))}${cell(vt(r.issuePlace))}${cell(dMon(r.issueDt))}${cell(dMon(r.expDt))}</tr>`,1);
    const blkM = sec("M. CONTAINER DETAILS",[26,26,26,22],["1.CONTAINER NUMBER","2.TRUCK NUMBER","3.SEAL NUMBER","4.FCL/LCL"],conts,r=>`<tr>${cell(vt(r.containerNo))}${cell(vt(r.truckNo))}${cell(vt(r.sealNumber)||"N.A.")}${cell(vt(r.lclFcl)||"F")}</tr>`,1);
    const blkN = {html:section("N. INVOICE DETAILS",[10,40,28,22],["1. S NO","2. INVOICE NO","3. INVOICE AMOUNT","4. CUR"], has(d.commInvoiceNo)?`<tr>${cell("1")}${cell(vt(d.commInvoiceNo))}${cell(amt(num(d.totalInvoiceValue),2))}${cell(esc(cur))}</tr>`:"",1)};
    const part4 = {title:"PART - IV - ADDITIONAL DETAILS", glossaryTitle:"GLOSSARY",
      wrapMeasure:inner=>`<div style="margin-left:25px">${inner}</div>`, wrap:inner=>`<div class="ic-row ic-tight" style="min-height:100%">${sideLabel("OTHER ADDITIONAL INFORMATION")}<div style="flex:1">${inner}</div></div>`,
      blocks:[blkA,blkB,blkC,blkD,blkE,lic,blkGH,blkI,blkJ,blkK,blkL,blkM,blkN],
      glossary:["<b>A :</b> Ref No - SVB Reference Number, Ref Dt - SVB Reference Date; <b>F :</b> Code - Licence Scheme Code; <b>G :</b> PRC - Preceding; <b>J :</b> ING - Ingredient","<b>K :</b> RES CD - Control Result Code, RES TXT - Control Result Text"]};

    /* ---------------------------------------------------------------- PART V */
    const bar = t => `<div class="ic-bar" style="margin-top:-1px">${t}</div>`;
    const txtBox = (t, h) => `<div class="ic-txt" style="border-bottom:1px solid #000;min-height:${h||14}px">${t||"&nbsp;"}</div>`;
    const pga = arr("pgaLines");
    const V = `${bar("A. EXAMINATION ORDER RMS")}${txtBox("")}${bar("A1.EXAMINATION ORDER")}${txtBox(vt(d.examinationOrder))}${bar("B.EXAMINATION INSTRUCTIONS")}${bar("B1. PGA EXAMINATION INSTRUCTIONS")}
      <table class="ic-t" style="margin-top:-1px">${colgroup([9,9,52,30])}<tr>${["Inv No","Item No","Agency","Status"].map(h=>TH(h)).join("")}</tr>${pga.map(r=>`<tr>${cell(vt(r.invNo))}${cell(vt(r.itemNo))}${cell(vt(r.agency),"")}${cell(vt(r.status))}</tr>`).join("")}${padRows(pga.length?0:1,4)}</table>
      ${bar("C.COMPULSORY COMPLIANCE")}${txtBox(vt(d.compulsoryCompliance).replace(/\n/g,"<br>"), 30)}${bar("D. AC REMARKS")}${txtBox(vt(d.acRemarks).replace(/\n/g,"<br>"))}${bar("E. EXAMINATION REPORT")}${txtBox(vt(d.examReport).replace(/\n/g,"<br>"))}${bar("F.SUPERINTENDENT COMMENTS")}${txtBox(vt(d.superintendentComments).replace(/\n/g,"<br>"))}
      <table class="ic-t" style="margin-top:-1px">${colgroup([10,38,10,42])}<tr>${TD("OOC No",1,"lb")}${TD(vt(d.oocNumber),1,"c")}${TD("OOC Date",1,"lb")}${TD(oocDate,1,"c")}</tr></table>`;
    const part5 = {title:"PART - V - OTHER COMPLIANCES", noGlossary:true, wrapMeasure:inner=>`<div style="margin-left:25px">${inner}</div>`, wrap:inner=>`<div class="ic-row" style="min-height:100%">${sideLabel("COMPLIANCES")}<div style="flex:1">${inner}</div></div>`, blocks:[{html:V}]};

    /* ---------------------------------------------------------------- PART VI */
    const declDate = has(d.declDate) ? dMon(d.declDate) : "";
    const VI = `<div style="display:flex;flex-direction:column;height:100%">
      <div class="ic-row" style="flex:1;border-bottom:1px solid #000">${sideLabel("A.DECLARATION STATEMENT")}<div style="flex:1;padding:2px 3px">${DECLARATIONS.map(t=>`<div style="font-size:9px;line-height:10.8px;margin-bottom:1px;border-bottom:1px solid #000;padding-bottom:1px">${esc(t)}</div>`).join("")}</div></div>
      <div class="ic-row" style="height:104px">${sideLabel("B. AUTHORIZED<br>SIGNATORY")}<div style="flex:1;position:relative;font-size:9.4px">
        <div style="position:absolute;left:10px;top:22px;font-weight:700">DATE <span style="font-weight:400;margin-left:8px">${declDate}</span></div>
        <div style="position:absolute;left:10px;top:58px;font-weight:700">PLACE <span style="font-weight:400;margin-left:8px">${vt(d.declPlace)}</span></div>
        <div style="position:absolute;left:230px;top:58px;font-weight:700">AUTHORISED SIGNATORY <span style="font-weight:400;margin-left:14px">CHA NAME :${vt(d.chaDetails)}</span></div>
        <div style="position:absolute;left:230px;top:76px;font-size:9px">${vt(d.signatoryName)}${has(d.signatoryDesignation)?", "+vt(d.signatoryDesignation):""}${d.digitalSignatureApplied?" &nbsp;(Class 3 DSC applied - simulated)":""}</div>
      </div></div></div>`;
    const part6 = {title:"PART - VI - DECLARATION", noGlossary:true, blocks:[{html:VI}]};

    const parts = [part1, part2, part3, part4, part5, part6];
    try{
      return wrapDoc(paginate("boe", hdr, parts));
    }catch(e){
      console.warn("Bill of Entry pagination fell back to one page per Part:", e);
      return wrapDoc(parts.map((p,i)=>{ const inner = p.blocks.map(b=>b.rows ? b.render(b.rows,false) : b.html).join(""); return pageHtml("boe", hdr, p, p.wrap ? p.wrap(inner) : inner, i+1, parts.length); }).join(""));
    }
  }
  root.renderBillOfEntrySpecimen = renderBillOfEntrySpecimen;
})(typeof window !== "undefined" ? window : globalThis);
