/* =========================================================================
   OCEAN BILL OF LADING — print layout
   -------------------------------------------------------------------------
   Renders the sea Bill of Lading exercise as a standard liner / combined-
   transport B/L: Shipper, Consignee, Notify party, pre-carriage, place of
   receipt, vessel & voyage, ports, "particulars furnished by shipper" cargo
   table (marks, containers & seals, packages, description, gross weight,
   measurement), total in words, freight & charges (prepaid / collect),
   shipped-on-board clause, number of originals, place & date of issue and the
   carrier's signature - then the reverse-side conditions of carriage.
   Layout follows the box arrangement common to the public liner / BIMCO
   templates; the conditions of carriage are generic training text, not the
   terms of any real carrier.  Uses the SkIC helpers from customs-forms.js, so
   it pages, watermarks ("SIMULATOR DATA") and exports to PDF exactly like the
   Shipping Bill and Bill of Entry.
   ========================================================================= */
(function(root){
  "use strict";
  const IC = root.SkIC;
  if(!IC) return;
  const {esc, has, vt, num, amt, pad2, dSlash, stamp, qrSvg, colgroup, eq, TH, TD, splitLines, paginate, pageHtml, wrapDoc} = IC;

  const ONES = ["","ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN","ELEVEN","TWELVE","THIRTEEN","FOURTEEN","FIFTEEN","SIXTEEN","SEVENTEEN","EIGHTEEN","NINETEEN"];
  const TENS = ["","","TWENTY","THIRTY","FORTY","FIFTY","SIXTY","SEVENTY","EIGHTY","NINETY"];
  function words(n){
    n = Math.floor(Math.abs(n)||0);
    if(n === 0) return "ZERO";
    const under1000 = x => { let s = ""; if(x >= 100){ s += ONES[Math.floor(x/100)] + " HUNDRED"; x %= 100; if(x) s += " "; } if(x >= 20){ s += TENS[Math.floor(x/10)]; if(x%10) s += " " + ONES[x%10]; } else if(x) s += ONES[x]; return s; };
    let out = "";
    if(n >= 1000000){ out += under1000(Math.floor(n/1000000)) + " MILLION "; n %= 1000000; }
    if(n >= 1000){ out += under1000(Math.floor(n/1000)) + " THOUSAND "; n %= 1000; }
    if(n) out += under1000(n);
    return out.trim();
  }
  const ORIGINALS = [[/full set|3 original/i,"THREE (3)"],[/^2 original/i,"TWO (2)"],[/^1 original/i,"ONE (1)"],[/waybill/i,"NIL (SEA WAYBILL)"]];
  const originalsText = v => { for(const [re,t] of ORIGINALS) if(re.test(String(v||""))) return t; return vt(v); };

  const TERMS = [
    ["1. Definitions","'Carrier' means the party on whose behalf this Bill of Lading is issued. 'Merchant' includes the shipper, holder, consignee, receiver and owner of the goods and anyone acting on their behalf. 'Goods' means the cargo described on the front and any packing, container or equipment not supplied by the Carrier."],
    ["2. Carrier's Tariff","The terms of the Carrier's applicable tariff are incorporated in this Bill of Lading. Copies are obtainable from the Carrier on request. In case of conflict, this Bill of Lading prevails."],
    ["3. Warranty","The Merchant warrants that the particulars of the goods furnished on the front - marks, number, quantity, weight, measure and description - are complete and correct, and that the goods are properly packed, marked and, where required, declared as dangerous."],
    ["4. Carrier's Responsibility","The Carrier is responsible for the goods from the time of receipt at the place of receipt (or port of loading) until delivery at the port of discharge (or place of delivery), subject to these conditions and to the Hague-Visby Rules as enacted in the country of shipment."],
    ["5. Limitation of Liability","Unless the nature and value of the goods were declared before shipment and inserted on the front, the Carrier's liability is limited to the amount per package or per kilogram provided by the applicable convention. Weight, measure, quantity, quality, condition, contents and value are unknown to the Carrier unless expressly acknowledged."],
    ["6. Containers","Where goods are packed in a container by or for the Merchant, the Carrier is not responsible for loss or damage caused by the manner of packing or by the container's unsuitability. A seal number recorded on the front is for identification only. Containers remain the property of the Carrier or its lessor."],
    ["7. Carrier's Right to Inspect","The Carrier may open any package or container at any time to verify the contents. If the Merchant's description is found inaccurate, the Merchant bears all resulting costs and the Carrier's liability is excluded."],
    ["8. Deck Cargo & Live Animals","Goods may be carried on or under deck without notice. Cargo carried on deck and live animals are carried at the Merchant's risk, and the Carrier is not liable for loss or damage arising from the special risks of such carriage."],
    ["9. Dangerous Goods","Goods of a dangerous, flammable, explosive or noxious nature shall not be tendered without prior written agreement and proper marking, labelling and declaration under the IMDG Code. Non-compliant goods may be landed, destroyed or rendered harmless at the Merchant's expense."],
    ["10. Freight & Charges","Freight is earned on receipt of the goods by the Carrier and is not returnable. Prepaid freight is due on shipment; collect freight and all other charges are due on delivery. The Merchant is liable for freight, demurrage, detention, storage and all costs incurred by reason of non-payment or inaccurate declaration."],
    ["11. Delivery","Delivery is made only against surrender of one duly endorsed original Bill of Lading (or on the release instruction applicable to a waybill / telex release). The Carrier may deliver the goods to the party named as consignee or notify party only as these conditions permit. Notice of arrival is a courtesy and failure to give it does not relieve the Merchant of any obligation."],
    ["12. Lien","The Carrier has a lien on the goods and any documents relating to them for all sums due under this Bill of Lading and may sell the goods, by public auction or private treaty and without notice, to recover those sums."],
    ["13. Notification of Loss or Damage","Unless notice of loss or damage and its general nature is given in writing to the Carrier at the port of discharge before or at the time of removal of the goods, the removal is prima facie evidence of delivery as described in this Bill of Lading. Where the loss or damage is not apparent, notice must be given within three consecutive days of delivery. The Carrier is discharged from all liability unless suit is brought within one year of delivery."],
    ["14. Deviation & Substitution","The Carrier may call at any port, in any order, for any purpose, may substitute another vessel or means of transport, may tranship, and may deviate to save or attempt to save life or property, without being in breach of contract."],
    ["15. Force Majeure & Delay","The Carrier is not liable for loss, damage or delay arising from war, strikes, quarantine, port congestion, government order, weather, ice or any cause beyond its reasonable control. Time schedules are estimates only and are not guaranteed."],
    ["16. General Average","General Average shall be adjusted at the port chosen by the Carrier according to the York-Antwerp Rules in force on the date of this Bill of Lading. The Merchant shall provide security as required."],
    ["17. Both-to-Blame Collision","If the vessel comes into collision with another ship through the negligence of the other ship and any act, neglect or default of the master, mariner, pilot or servants of the Carrier in navigation or management of the vessel, the Merchant will indemnify the Carrier against all loss or liability to the other ship or its owners, to the extent the Carrier is relieved of liability to the Merchant."],
    ["18. Customs, Taxes & Duties","The Merchant shall comply with all customs, port, health and other regulations, and shall pay all duties, taxes, fines and expenses imposed on the goods or the Carrier by reason of the goods. The Carrier may refuse to carry goods without full export and import documentation."],
    ["19. Law & Jurisdiction","This Bill of Lading and any dispute arising from it are governed by the law of the country of the Carrier's principal place of business, and the courts of that country have exclusive jurisdiction, save that the Carrier may sue in any court having jurisdiction over the goods."],
    ["20. Signature","The number of original Bills of Lading stated on the front have been signed. One original, duly endorsed, must be surrendered in exchange for the goods; when one original has been accomplished the others stand void. The Merchant, by accepting this Bill of Lading, agrees to be bound by all its terms whether written, printed or stamped on the front or the reverse."]
  ];

  function renderBillOfLadingSpecimen(dIn){
    const d = dIn || (typeof formData !== "undefined" ? formData : {}) || {};
    const rows = (Array.isArray(d.cargoLines) ? d.cargoLines : []).filter(r => r && (has(r.description) || has(r.marksNumbers) || has(r.noOfPackages)));
    const conts = (Array.isArray(d.containers) ? d.containers : []).filter(r => r && has(r.containerNo));
    const yes = v => v === true || /^(y|yes|true)/i.test(String(v==null?"":v));
    const waybill = /waybill/i.test(String(d.blOrWaybill||""));
    const telex = /telex/i.test(String(d.blOrWaybill||""));
    const negot = /negotiable/i.test(String(d.blNegotiability||"")) && !/straight|non/i.test(String(d.blNegotiability||""));
    const docName = waybill ? "SEA WAYBILL" : "BILL OF LADING";
    const scope = /combined|multimodal/i.test(String(d.blTransportScope||"")) ? "FOR COMBINED TRANSPORT" : "FOR PORT TO PORT SHIPMENT";
    const status = waybill ? "NON-NEGOTIABLE" : telex ? "TELEX RELEASE / SURRENDERED" : (negot ? "ORIGINAL - NEGOTIABLE" : "ORIGINAL - NON-NEGOTIABLE");
    const carrier = vt(d.oceanCarrier) || "CARRIER";
    const blNo = vt(d.blNumber);
    const sumPk = rows.reduce((t,r)=>t+num(r.noOfPackages), 0);
    const sumGross = rows.reduce((t,r)=>t+num(r.grossWeight), 0);
    const sumCbm = rows.reduce((t,r)=>t+num(r.measurement), 0);
    const totPk = has(d.cargoTotalPackages) ? num(d.cargoTotalPackages) : sumPk;
    const totGross = has(d.cargoTotalGrossWt) ? num(d.cargoTotalGrossWt) : sumGross;
    const totCbm = has(d.cargoTotalCbm) ? num(d.cargoTotalCbm) : sumCbm;
    const nCont = conts.length;
    const pkgKind = vt(d.cargoPackageType) || ((rows[0] && has(rows[0].packageType)) ? vt(rows[0].packageType) : "PACKAGES");
    const sayLine = (nCont || totPk) ? `SAY: ${nCont ? `${words(nCont)} (${nCont}) CONTAINER${nCont>1?"S":""}` : ""}${nCont && totPk ? " CONTAINING " : ""}${totPk ? `${words(totPk)} (${totPk}) ${String(pkgKind).toUpperCase()}` : ""} ONLY` : "";
    const tIssue = has(d.dateOfIssue) ? dSlash(d.dateOfIssue) : "";
    const prepaid = /prepaid/i.test(String(d.freightTerm||""));
    const collect = /collect/i.test(String(d.freightTerm||""));
    const cur = vt(d.currency);

    /* ---------------------------------------------------------------- running header */
    const hdr = `<div class="ic-hdr"><div class="ic-hdr-l"><div class="ic-hdr-brand"><div><div class="t1">${carrier}</div><div class="t2" style="margin-top:3px">${docName} ${scope}</div></div></div></div>
      <div class="ic-hdr-r" style="width:300px"><table class="ic-hdr-tbl">${eq(6)}
        <tr>${TD("B/L No.",2,"k")}${TD(blNo,4)}</tr><tr>${TD("Booking No.",2,"k")}${TD(vt(d.bookingNo),4)}</tr>
        <tr>${TD("Vessel / Voy.",2,"k")}${TD(`${vt(d.vesselName)} ${vt(d.voyageNo)}`,4)}</tr><tr>${TD("Status",2,"k")}${TD(esc(status),4)}</tr>
      </table><div class="ic-hdr-qr">${qrSvg(d.blNumber || "BL")}<div class="ref">${blNo}</div></div></div></div>`;

    /* ---------------------------------------------------------------- front: party & routing boxes */
    const box = (label, inner, span, extra) => `<td colspan="${span}" class="bl-box"${extra?` style="${extra}"`:""}><div class="bl-l">${label}</div><div class="bl-v">${inner || "&nbsp;"}</div></td>`;
    const ml = arr => arr.filter(Boolean).join("<br>");
    const shipper = ml([`<b>${vt(d.shipperCompany)}</b>`].concat(splitLines(d.shipperAddress, 4)).concat([vt(d.shipperCountry)]));
    const orderMap = [[/shipper/i, "TO ORDER OF SHIPPER"],[/bank/i, `TO THE ORDER OF ${vt(d.lcIssuingBank) || "ISSUING BANK"}`],[/blank/i, "TO ORDER"]];
    const orderLine = (() => { const t = String(d.consigneeOrderType||""); for(const [re,x] of orderMap) if(re.test(t)) return x; return ""; })();
    const consignee = ml([orderLine ? `<b>${orderLine}</b>` : "", `<b>${vt(d.consigneeCompany)}</b>`].concat(splitLines(d.consigneeAddress, 4)).concat([vt(d.consigneeCountry)]));
    const second = yes(d.hasSecondNotify);
    const notify = ml([`<b>${vt(d.notifyName)}</b>`].concat(splitLines(d.notifyAddress, 3)).concat([has(d.notifyContact) ? "TEL/CONTACT: " + vt(d.notifyContact) : ""]).concat(second ? ["<br>ALSO NOTIFY: <b>" + vt(d.secondNotifyName) + "</b>"].concat(splitLines(d.secondNotifyAddress, 2)) : []));
    const front = `<table class="ic-t bl-t">${eq(12)}
      <tr>${box("Shipper", shipper, 7, "height:78px")}${box("B/L No. &nbsp;/&nbsp; Booking No.", ml([`<b>${blNo}</b>`, vt(d.bookingNo) ? "BOOKING: " + vt(d.bookingNo) : "", vt(d.exportRef) ? "EXPORT REF: " + vt(d.exportRef) : ""]), 5)}</tr>
      <tr>${box("Consignee <i>(if &quot;To Order&quot; so indicate)</i>", consignee, 7, "height:78px")}${box("Forwarding agent references", ml([vt(d.forwarderRef), has(d.shipperIECRef) ? "IEC: " + vt(d.shipperIECRef) : "", has(d.shipperGSTINRef) ? "GSTIN: " + vt(d.shipperGSTINRef) : ""]), 5)}</tr>
      <tr>${box("Notify party <i>(no claim shall attach for failure to notify)</i>", notify, 7, "height:72px")}${box("Carrier &nbsp;/&nbsp; Agent", ml([`<b>${carrier}</b>`, has(d.carrierAgent) ? "AGENT: " + vt(d.carrierAgent) : ""]), 5)}</tr>
      <tr>${box("Pre-carriage by", vt(d.preCarriageBy), 4)}${box("Place of receipt", vt(d.placeReceipt), 4)}${box("Ocean vessel / Voyage no.", `${vt(d.vesselName)}${has(d.voyageNo) ? " &nbsp;V." + vt(d.voyageNo) : ""}`, 4)}</tr>
      <tr>${box("Port of loading", vt(d.portLoading), 3)}${box("Port of discharge", vt(d.portDischarge), 3)}${box("Place of delivery", vt(d.finalPlaceDelivery), 3)}${box("Final destination", vt(d.finalDestination), 3)}</tr>
      <tr>${box("Transshipment at", vt(d.transshipmentPort), 4)}${box("ETD &nbsp;/&nbsp; ETA", `${has(d.etdDate)?dSlash(d.etdDate):""} &nbsp;/&nbsp; ${has(d.etaDate)?dSlash(d.etaDate):""}`, 4)}${box("Freight payable at", vt(d.freightPayableAt), 4)}</tr></table>
      <div class="ic-bar" style="margin-top:-1px">PARTICULARS FURNISHED BY SHIPPER</div>`;

    /* ---------------------------------------------------------------- cargo table (splittable) */
    const cargoHead = `<tr>${["Marks &amp; Numbers","No. of containers or packages","Kind of packages; description of goods","Gross weight (kgs)","Measurement (cbm)"].map(t=>TH(t)).join("")}</tr>`;
    const cargoRow = r => `<tr class="bl-cargo">${TD(vt(r.marksNumbers).replace(/\n/g,"<br>"),1)}${TD(`${vt(r.noOfPackages)}<br>${vt(r.packageType)}`,1,"c")}${TD(ml([vt(r.description).replace(/\n/g,"<br>"), has(r.commodity) ? vt(r.commodity) : "", has(r.hsCode) ? "HS CODE: " + vt(r.hsCode) : ""]),1)}${TD(has(r.grossWeight)?amt(num(r.grossWeight),3):"",1,"r")}${TD(has(r.measurement)?amt(num(r.measurement),3):"",1,"r")}</tr>`;
    const cargoBlock = {rows, render:(subset,cont)=>`<table class="ic-t bl-t" style="margin-top:-1px">${colgroup([22,13,41,12,12])}${cargoHead}${subset.map(cargoRow).join("")}${subset.length<2?`<tr class="bl-cargo">${TD("&nbsp;")}${TD("")}${TD("")}${TD("")}${TD("")}</tr>`:""}</table>${cont?`<div class="bl-cont">(continued from previous page)</div>`:""}`};
    const contBlock = {html:`<table class="ic-t bl-t" style="margin-top:-1px">${colgroup([40,30,30])}
        <tr>${TH("Container No. (shipper's load, count &amp; seal)")}${TH("Seal No.")}${TH("Size / type")}</tr>
        ${conts.map(r=>`<tr>${TD(vt(r.containerNo))}${TD(vt(r.sealNo),1,"c")}${TD(vt(r.containerType),1,"c")}</tr>`).join("") || `<tr>${TD("&nbsp;")}${TD("")}${TD("")}</tr>`}
        <tr>${TD(`<b>${esc(has(d.movementType) ? String(d.movementType).toUpperCase() : "")}${has(d.movementType) ? "&nbsp;&nbsp;" : ""}SHIPPER'S LOAD, COUNT &amp; SEAL.</b> SAID TO CONTAIN, WEIGHT AND MEASURE UNKNOWN TO THE CARRIER.`,3)}</tr></table>`};
    const totalBlock = {html:`<table class="ic-t bl-t" style="margin-top:-1px">${colgroup([22,13,41,12,12])}
        <tr>${TD("<b>Total no. of containers or packages (in words)</b>",2)}${TD(`<b>${sayLine}</b>`,1)}${TD(`<b>${amt(totGross,3)}</b>`,1,"r")}${TD(`<b>${amt(totCbm,3)}</b>`,1,"r")}</tr></table>`};

    /* ---------------------------------------------------------------- freight & charges */
    const chargeRows = [["OCEAN FREIGHT", d.freightCharges],["TERMINAL HANDLING CHARGES (THC)", d.thcCharges],["BUNKER ADJUSTMENT FACTOR (BAF)", d.bafCharges],["CURRENCY ADJUSTMENT FACTOR (CAF)", d.cafCharges],["OTHER CHARGES", d.otherFreightCharges]].filter(x=>has(x[1]) && num(x[1]));
    const chTotal = chargeRows.reduce((t,x)=>t+num(x[1]), 0);
    const chargesBlock = {html:`<div class="ic-bar" style="margin-top:-1px">FREIGHT &amp; CHARGES</div><table class="ic-t bl-t" style="margin-top:-1px">${colgroup([34,12,12,10,12,12,8])}
        <tr>${["Charges","Rate","Unit","Currency","Prepaid","Collect","Ex. rate"].map(t=>TH(t)).join("")}</tr>
        ${chargeRows.map(x=>`<tr>${TD(x[0])}${TD("",1,"c")}${TD("LUMPSUM",1,"c")}${TD(cur,1,"c")}${TD(prepaid?amt(num(x[1]),2):"",1,"r")}${TD(collect?amt(num(x[1]),2):"",1,"r")}${TD(has(d.exchangeRateBl)?amt(num(d.exchangeRateBl),4):"",1,"c")}</tr>`).join("") || `<tr>${TD(`${/prepaid|collect/i.test(String(d.freightTerm||"")) ? "FREIGHT " + vt(d.freightTerm).toUpperCase() : "&nbsp;"}`,7)}</tr>`}
        ${chargeRows.length ? `<tr>${TD("<b>TOTAL</b>",3)}${TD(cur,1,"c")}${TD(prepaid?`<b>${amt(chTotal,2)}</b>`:"",1,"r")}${TD(collect?`<b>${amt(chTotal,2)}</b>`:"",1,"r")}${TD("",1)}</tr>` : ""}
      </table>`};

    /* ---------------------------------------------------------------- issue block */
    const shipped = (yes(d.shippedOnBoardClausePresent) || d.shippedOnBoardClausePresent === undefined) && has(d.shippedOnBoardDate);
    const sig = has(d.signatoryName) ? `${vt(d.signatoryName)}${has(d.signatoryTitle) ? ", " + vt(d.signatoryTitle) : ""}` : "";
    const issueBlock = {html:`<table class="ic-t bl-t" style="margin-top:-1px">${eq(12)}
        <tr>${box("Freight prepaid at", prepaid ? vt(d.freightPayableAt) : "", 3)}${box("Freight payable at", collect ? vt(d.freightPayableAt) : "", 3)}${box("Declared value (if any)", has(d.declaredValue) ? `${cur} ${amt(num(d.declaredValue),2)}` : "", 3)}${box("No. of original B/L(s)", `<b>${originalsText(d.originalsIssued)}</b>`, 3)}</tr>
        <tr>${box("Place and date of issue", `${vt(d.placeOfIssue)} &nbsp;&nbsp; ${tIssue}`, 4, "height:64px")}
          <td colspan="8" class="bl-box" rowspan="2" style="vertical-align:top"><div class="bl-l">Received / shipped</div><div class="bl-v" style="font-size:8.2px;line-height:10.2px">RECEIVED by the Carrier the goods as specified above in apparent good order and condition unless otherwise stated, to be transported to such place as agreed, authorised or permitted herein and subject to all the terms and conditions appearing on the front and reverse of this Bill of Lading, to which the Merchant agrees by accepting it. The particulars given above are as stated by the shipper; the weight, measure, quantity, condition, contents and value of the goods are unknown to the Carrier. ${shipped ? `<br><br><b>SHIPPED ON BOARD</b> the vessel <b>${vt(d.vesselName)}</b>${has(d.voyageNo)?" V."+vt(d.voyageNo):""} at <b>${vt(d.portLoading)}</b> on <b>${dSlash(d.shippedOnBoardDate)}</b>${has(d.onBoardNotation) ? " - " + vt(d.onBoardNotation) : ""}.` : ""}<br><br>IN WITNESS whereof the number of original Bills of Lading stated here have been signed, one of which being accomplished, the others to stand void.</div></td></tr>
        <tr>${box(`Signed for the Carrier${has(d.signingCapacity) ? " - " + esc(String(d.signingCapacity).toLowerCase()) : ""}`, `<br><br><b>${carrier}</b><br>${sig}${d.signatureApplied ? "<br><i style='font-size:8px'>(digitally signed - simulated)</i>" : ""}`, 4, "height:74px")}</tr></table>`};

    const frontPart = {title:`${docName} &mdash; ${scope.replace("FOR ","")}`, noGlossary:true, blocks:[{html:front}, cargoBlock, contBlock, totalBlock, chargesBlock, issueBlock]};

    /* ---------------------------------------------------------------- reverse: conditions of carriage */
    const half = Math.ceil(TERMS.length / 2);
    const col = list => list.map(t=>`<div class="bl-term"><b>${t[0]}.</b> ${t[1]}</div>`).join("");
    const termsHtml = `<div class="bl-terms-note">TERMS &amp; CONDITIONS OF CARRIAGE - these generic conditions are provided for training and simulation only and are not the terms of any real carrier.</div>
      <div class="bl-terms"><div>${col(TERMS.slice(0, half))}</div><div>${col(TERMS.slice(half))}</div></div>`;
    const termsPart = {title:"CONDITIONS OF CARRIAGE (REVERSE)", noGlossary:true, blocks:[{html:termsHtml}]};

    const parts = [frontPart, termsPart];
    try{ return wrapDoc(paginate("bl", hdr, parts)); }
    catch(e){
      console.warn("Bill of Lading pagination fell back to one page per part:", e);
      return wrapDoc(parts.map((p,i)=>pageHtml("bl", hdr, p, p.blocks.map(b=>b.rows ? b.render(b.rows,false) : b.html).join(""), i+1, parts.length)).join(""));
    }
  }
  root.renderBillOfLadingSpecimen = renderBillOfLadingSpecimen;
})(typeof window !== "undefined" ? window : globalThis);
