/* =========================================================================
   ICEGATE-FORMAT EXTENSIONS FOR THE SHIPPING BILL AND BILL OF ENTRY
   -------------------------------------------------------------------------
   The real ICEGATE printouts of a Shipping Bill (5 Parts) and a Bill of Entry
   (6 Parts) carry far more data than the original exercises collected.  This
   file adds every extra field those printouts show, as new steps and as extra
   fields on existing steps, so that the document the student finishes is
   rendered in the real layout (see customs-forms.js / customs-forms-boe.js)
   from data the student actually entered.

   Loaded after documents-data.js and before engine.js.  It only ADDS to the
   existing configs - no existing field is renamed or removed - so context
   keys, cross-document checks and the other documents are untouched.
   Most of the new fields are optional: the real documents leave many of them
   blank too.  STEP_COUNTS in workflow-rules.js is kept in step with the new
   step totals (shipping-bill 14, bill-of-entry 15).
   ========================================================================= */
(function(){
  "use strict";
  if(typeof DOCUMENT_CONFIGS === "undefined") return;

  /* ------------------------------------------------------------ small builders */
  const F = (type, name, label, extra) => Object.assign({name, label, type, required:false}, extra||{});
  const T   = (n,l,e) => F("text", n, l, e);
  const TA  = (n,l,e) => F("textarea", n, l, Object.assign({full:true}, e||{}));
  const NUM = (n,l,e) => F("number", n, l, e);
  const DT  = (n,l,e) => F("date", n, l, e);
  const SEL = (n,l,options,e) => F("select", n, l, Object.assign({options}, e||{}));
  const req = f => Object.assign(f, {required:true});
  const C = (key,label,placeholder,extra) => Object.assign({key,label,placeholder}, extra||{});
  const TBL = (name,label,columns,extra) => Object.assign({type:"table", name, label, required:false, columns}, extra||{});
  const YNpat = {pattern:"^[YN]$", msg:"must be Y or N."};

  function stepIndex(cfg, title){ return cfg.steps.findIndex(s => s.title === title); }
  function addFields(cfg, title, fields){ const i = stepIndex(cfg, title); if(i >= 0) cfg.steps[i].fields.push.apply(cfg.steps[i].fields, fields); else console.warn("[customs-forms-config] step not found:", title); }
  function insertStep(cfg, beforeTitle, step){ const i = stepIndex(cfg, beforeTitle); cfg.steps.splice(i >= 0 ? i : cfg.steps.length, 0, step); }
  function tableOf(cfg, name){ for(const s of cfg.steps) for(const f of (s.fields||[])) if(f.type === "table" && f.name === name) return f; return null; }
  function addColumns(cfg, tableName, afterKey, cols){
    const t = tableOf(cfg, tableName); if(!t) return;
    const at = t.columns.findIndex(c => c.key === afterKey);
    t.columns.splice(at >= 0 ? at + 1 : t.columns.length, 0, ...cols);
  }
  const INCOTERMS = ["EXW","FCA","FOB","CFR","CIF","CPT","CIP","DAP","DPU","DDP"];

  /* =========================================================================
     SHIPPING BILL
     ========================================================================= */
  const SB = DOCUMENT_CONFIGS["shipping-bill"];
  if(SB && !SB.__icegateExtended){
    SB.__icegateExtended = true;

    // --- NEW step: declarant, consignee & bank details (Part I, section B)
    insertStep(SB, "Cargo & Shipment Particulars", {
      title:"Declarant, Consignee & Bank Details", est:8,
      sub:"Part I - section B of the Shipping Bill: who declares it, who receives the goods, and where refunds are paid.",
      intro:"Section B of the printed Shipping Bill names the exporter's Authorised Dealer bank, the Customs Broker, the foreign consignee and the bank accounts into which Customs pays drawback and RoDTEP. Fill them exactly as they will appear on the printout.",
      fields:[
        req(SEL("gstinType","GSTIN Type",["GSN","ARN","UIN","NA"],{help:"Shown as 'GSTIN/TYPE' in the header and in section B. GSN = a regular GST Identification Number."})),
        req(T("cbName","Customs Broker (CB) Name",{placeholder:"SAI DUTTA SHIPPING AGENCY PVT. LTD.",help:"The Customs House Agent filing this Shipping Bill. The CB CODE in the header is the CHA licence number you entered earlier."})),
        req(T("adCode","AD Code",{placeholder:"6390055",pattern:"^\\d{7}$",patternMsg:"AD Code is a 7-digit code issued by the Authorised Dealer bank's customs office.",help:"7-digit Authorised Dealer code registered with the Customs port."})),
        T("rbiWaiverNoDt","RBI Waiver No. & Date",{placeholder:"Leave blank if there is no RBI waiver",help:"Only when RBI has waived the EDF / realisation requirement for this shipment."}),
        T("aeoStatus","Exporter AEO Status",{placeholder:"e.g. AEO-T2 (leave blank if none)"}),
        req(T("consigneeName","Consignee Name",{placeholder:"T,I,S",help:"The party abroad the goods are consigned to. It can differ from the buyer who is invoiced in Part II."})),
        req(TA("consigneeAddress","Consignee Address",{placeholder:"18 BP 843 ABIDJAN 18\nCOTE DIVOIRE WEST AFRICA"})),
        req(T("consigneeCountryCode","Consignee Country Code",{placeholder:"CI",pattern:"^[A-Z]{2}$",patternMsg:"Enter the 2-letter ISO country code, e.g. CI, AE, US.",uppercase:true})),
        req(T("forexBankAcNo","Forex Bank A/c No.",{placeholder:"00XXXXXXX301",help:"Account where export proceeds are credited."})),
        T("dbkBankAcNo","Drawback (DBK) Bank A/c No.",{placeholder:"00XXXXXXX301",help:"Account that receives drawback / RoDTEP credit."}),
        req(T("ifscNo","IFSC Code",{placeholder:"ICIC0000062",pattern:"^[A-Z]{4}0[A-Z0-9]{6}$",patternMsg:"IFSC is 4 letters, a zero, then 6 letters/digits (e.g. ICIC0000062).",uppercase:true}))
      ]
    });

    // --- extra fields on existing steps
    addFields(SB, "Cargo & Shipment Particulars", [
      req(T("portOfLoading","Port of Loading",{contextKey:"txn.portOfLoading",placeholder:"INNSA1 (Jawaharlal Nehru (Nh)",help:"Item 12 of Part I - code and name of the Indian port the cargo is loaded at."})),
      req(T("stateOfOrigin","State of Origin",{placeholder:"Maharashtra",help:"Item 14 of Part I - the Indian state where the goods were manufactured."})),
      req(T("portFinalDestination","Port of Final Destination",{placeholder:"CIABJ (Abidjan)",help:"Item 15 - the port abroad where the goods finally arrive (may differ from the port of discharge)."})),
      req(T("countryDischarge","Country of Discharge",{placeholder:"COTE D IVOIRE",help:"Item 17 - country of the port of discharge."})),
      DT("mawbDate","MAWB / MBL Date",{help:"Master airway / bill of lading date (Part I, section E)."}),
      DT("hawbDate","HAWB / HBL Date"),
      T("cinNo","CIN No.",{help:"Cargo Information Number, if the port has issued one (section E)."}),
      DT("cinDate","CIN Date"),
      T("cinSiteId","CIN Site ID"),
      NUM("loosePackets","Loose Packets",{help:"Item 5 of section I - loose (un-containerised) packets, if any."})
    ]);
    addFields(SB, "Invoice Details", [
      req(SEL("invoiceTerm","Invoice Terms (Incoterm)",INCOTERMS,{contextKey:"txn.incoterm",help:"Printed as INVTERM. It decides whether freight and insurance are part of the invoice value and are deducted to reach the FOB value."})),
      T("poNo","Purchase Order No.",{contextKey:"txn.poNumber",placeholder:"PO/2023/118"}),
      DT("poDate","Purchase Order Date"),
      T("locNo","Letter of Credit (LoC) No.",{placeholder:"If payment is under a LC"}),
      DT("locDate","LoC Date"),
      T("contractNo","Contract No."),
      DT("contractDate","Contract Date"),
      T("thirdPartyName","Third Party Name",{help:"Only if a third party is involved in the transaction (Part II section B)."}),
      TA("thirdPartyAddress","Third Party Address"),
      T("buyerAeoStatus","Buyer AEO Status"),
      NUM("discountAmt","Discount (invoice currency)"),
      NUM("commissionAmt","Commission (invoice currency)"),
      NUM("deductionsAmt","Deductions (invoice currency)"),
      NUM("packingCharges","Packing Charges P/C (invoice currency)")
    ]);

    // --- NEW step: item-wise scheme & tax particulars (Part III + Part IV)
    insertStep(SB, "Exchange Rate Details", {
      title:"Item-Wise Scheme & Tax Particulars", est:14,
      sub:"Part III & IV of the Shipping Bill: for every item - IGST, drawback, RoDTEP and scheme particulars.",
      intro:"The printed Shipping Bill repeats a block of tax and scheme data for every item (IGST status/value/amount, drawback claim, scheme code, SQC, state & district of origin, RoDTEP ...). Add ONE row here for each item you entered in Item Details, in the same order. The IGST value, IGST amount, FOB value in INR, drawback amount and RoDTEP amount on the printout are calculated from these rates and your exchange rate.",
      fields:[
        TBL("itemScheme","Item-Wise Scheme & Tax Details",[
          C("itemNo","Item No.","1",{numeric:true}),
          C("dbkClaimed","Drawback Claimed (Y/N)","Y"),
          C("dbkSlNo","Drawback Sr.No.","3819B"),
          C("dbkRatePct","DBK Rate (%)","1.3",{numeric:true}),
          C("rodtepClaimed","RoDTEP Claimed (Y/N)","Y"),
          C("rodtepRatePct","RoDTEP Rate (%)","0.8",{numeric:true}),
          C("igstStatus","IGST Status (P = paid)","P"),
          C("igstRatePct","IGST Rate (%)","18",{numeric:true}),
          C("schemeCode","Scheme Code","19"),
          C("schemeDescription","Scheme Description","Drawback"),
          C("sqcMsr","SQC Measure","5429",{numeric:true}),
          C("sqcUqc","SQC UQC","KGS"),
          C("districtOrigin","District of Origin","PALGHAR"),
          C("ptAbroad","PT Abroad","NCPTI"),
          C("compCess","Comp. Cess (INR)","0",{numeric:true}),
          C("ftaBenefit","FTA Benefit Availed (Y/N)","Y"),
          C("rewardBenefit","Reward Benefit (Yes/No)","Yes"),
          C("thirdPartyItem","Third Party Item (Y/N)","N")
        ],{
          required:true,
          requiredCols:["itemNo","dbkClaimed","rodtepClaimed","igstStatus","igstRatePct","schemeCode","schemeDescription","sqcMsr","sqcUqc","districtOrigin","ptAbroad","ftaBenefit","rewardBenefit","thirdPartyItem"],
          errorMsg:"Add a scheme & tax row for each item (item no., drawback / RoDTEP flags, IGST status and rate, scheme code and description, SQC, district, PT abroad, FTA, reward and third-party flags).",
          addLabel:"Add Item Row",
          help:"Flags are Y or N. Rates are percentages - e.g. IGST 18, drawback 1.3, RoDTEP 0.8. Scheme codes: 19 = Drawback, 03 = Advance Authorisation, 00 = none. SQC = Standard Quantity Code (weight / quantity in the unit shown).",
          cellPatterns:{ dbkClaimed:YNpat, rodtepClaimed:YNpat, ftaBenefit:YNpat, thirdPartyItem:YNpat, schemeCode:{pattern:"^\\d{2}$", msg:"must be a 2-digit scheme code."} }
        })
      ]
    });

    // --- NEW step: status flags (Part I, section A)
    insertStep(SB, "Licence / DFIA / Job Work Details", {
      title:"Shipping Bill Status Flags", est:4,
      sub:"Part I - section A: the 11 status indicators printed across the top of the Shipping Bill.",
      intro:"These are the Y/N indicators in the STATUS strip of the printed Shipping Bill. Choose them so they agree with what you declared in the item-wise scheme details (for example DBK = Y only if drawback is claimed, RODTP = Y only if RoDTEP is claimed). MODE (Sea / Air) is worked out from the transport documents you entered.",
      fields:[
        req(SEL("assess","2. ASSESS - assessed by Customs",["Y","N"])),
        req(SEL("exmn","3. EXMN - physically examined",["N","Y"])),
        req(SEL("jobbing","4. JOBBING - job work export",["N","Y"])),
        req(SEL("meis","5. MEIS - Merchandise Exports from India Scheme claimed",["N","Y"])),
        req(SEL("dbk","6. DBK - drawback claimed",["Y","N"])),
        req(SEL("rodtp","7. RODTP - RoDTEP claimed",["Y","N"])),
        req(SEL("deecDfia","8. DEEC / DFIA - advance authorisation / duty free import",["N","Y"])),
        req(SEL("dfrc","9. DFRC - Duty Free Replenishment Certificate",["N","Y"])),
        req(SEL("reExp","10. RE-EXP - re-export",["N","Y"])),
        req(SEL("lut","11. LUT - exported under Letter of Undertaking (no IGST paid)",["N","Y"]))
      ]
    });

    // --- licence / jobbing tables (Part IV sections B & C)
    addFields(SB, "Licence / DFIA / Job Work Details", [
      TBL("licenceLines","AA / DFIA Licence Details (Part IV - B)",[
        C("invSno","Inv S.No.","1"), C("itemSno","Item S.No.","5"), C("licenceNo","Licence No.","0311020417"),
        C("descnExportItem","Description of Export Item","H23 ARTICLES MADE OF HDPE"), C("expSno","Export S.No.","1"), C("expQty","Export Qty","1291",{numeric:true}),
        C("uqc","UQC","KGS"), C("fobValue","FOB Value (INR)","161580.41",{numeric:true}), C("sion","SION","63 23"),
        C("descnImportItem","Description of Import Item","HDPE Granules"), C("impSno","Import S.No.","1"), C("impQty","Import Qty","1356",{numeric:true}),
        C("impUqc","Import UQC","KGS"), C("indigImp","Indigenous / Imported","Imp")
      ],{ addLabel:"Add Licence Line", help:"One row per export item that is covered by an Advance Authorisation / DFIA licence.",
          showIf:d=>/advance|dfia|authori[sz]ation/i.test(String(d.schemeType||"")) }),
      TBL("jobbingLines","Jobbing Details (Part IV - C)",[
        C("beNo","BE No.","4355337"), C("beDate","BE Date","2023-05-02"), C("portCode","Port Code","INNSA1"),
        C("descnImported","Description of Imported Goods","Steel coils"), C("qtyImp","Qty Imported","1000",{numeric:true}), C("qtyUsed","Qty Used","900",{numeric:true})
      ],{ addLabel:"Add Jobbing Line", help:"Only for job-work exports - the Bill of Entry the raw material was imported under.",
          showIf:d=>/job/i.test(String(d.schemeType||"")) })
    ]);

    // --- container table: seal date
    addColumns(SB, "containerDetails", "sealNumber", [C("sealDate","Seal Date","2023-06-06")]);

    // --- NEW step: Part IV supporting annexures
    insertStep(SB, "Digital Signature & Submission", {
      title:"Supporting Documents & Annexures", est:8,
      sub:"Part IV of the Shipping Bill: supporting documents, challans and the other annexure tables.",
      intro:"These tables print under 'OTHER ADDITIONAL INFORMATION' in Part IV. The Single Window Declaration, RoDTEP, Invoice and Container sections are generated for you from the data you have already entered; the sections below need your own entries. Leave a table empty if it does not apply to this shipment - the printed Shipping Bill leaves it blank too.",
      fields:[
        TBL("supportingDocs","Supporting Documents (Part IV - G)",[
          C("invsn","Inv S.No.","1"), C("itmsn","Item S.No.","1"), C("docTypeCd","Doc Type Code","934000"), C("icegateId","ICEGATE ID","SHASHIKANTGOPAL"),
          C("irn","Image Reference No. (IRN)","2023060600101296"), C("partyCd","Party Code",""), C("issuePlace","Issue Place",""), C("issueDt","Issue Date","2023-06-06"), C("expDt","Expiry Date","")
        ],{addLabel:"Add Supporting Document", help:"Documents uploaded to e-Sanchit for this Shipping Bill (invoice, packing list, certificates ...)."}),
        TBL("challanLines","Challan Details (Part I - H)",[
          C("srNo","Sr.No.","1"), C("challanNo","Challan No.",""), C("paymtDt","Payment Date","2023-06-06"), C("amount","Amount (INR)","",{numeric:true})
        ],{addLabel:"Add Challan", help:"Only if a duty / fee challan was paid on this Shipping Bill (e.g. export duty)."}),
        TBL("ar4Lines","AR4 Details (Part IV - J)",[
          C("invsn","Inv S.No.","1"), C("itmsn","Item S.No.","1"), C("ar4No","AR4 Number",""), C("ar4Dt","AR4 Date","2023-05-30"),
          C("commissionerate","Commissionerate",""), C("division","Division",""), C("range","Range","")
        ],{addLabel:"Add AR4 Row", help:"Central Excise AR4 particulars - for goods cleared from a central excise registered factory."}),
        TBL("thirdPartyLines","Third Party Details (Part IV - K)",[
          C("invsn","Inv S.No.","1"), C("itmsn","Item S.No.","1"), C("iec","IEC",""), C("exporterName","Exporter Name",""), C("address","Address",""), C("gstnIdType","GSTN ID & Type","")
        ],{addLabel:"Add Third Party Row", help:"Fill if the goods are exported on behalf of a third party (merchant-manufacturer exports)."}),
        TBL("manufacturerLines","Item Manufacturer / Producer / Grower (Part IV - L)",[
          C("invsn","Inv S.No.","1"), C("itmsn","Item S.No.","1"), C("type","Type","M"), C("manufactCd","Manufacturer Code",""),
          C("sourceState","Source State","27"), C("transCy","Trans CY",""), C("address","Address","")
        ],{addLabel:"Add Manufacturer Row", help:"Where the goods are made by someone other than the exporter."})
      ]
    });

    // --- declaration place / date (Part V)
    addFields(SB, "Digital Signature & Submission", [
      T("declPlace","Place of Declaration",{placeholder:"Mumbai",help:"Printed in Part V (Declarations)."}),
      DT("declDate","Date of Declaration")
    ]);
  }

  /* =========================================================================
     BILL OF ENTRY
     ========================================================================= */
  const BE = DOCUMENT_CONFIGS["bill-of-entry"];
  if(BE && !BE.__icegateExtended){
    BE.__icegateExtended = true;

    addFields(BE, "General Details", [
      req(T("portOfShipment","Port of Shipment",{placeholder:"Kwangyang",help:"Item 16 of Part I - the port the goods were shipped from (can differ from the port of loading)."}))
    ]);

    // --- NEW step: status flags (Part I, section A)
    insertStep(BE, "Importer Details", {
      title:"Bill of Entry Status Flags", est:4,
      sub:"Part I - section A: the status indicators printed across the top of the Bill of Entry.",
      intro:"These are the indicators in the STATUS strip of the printed Bill of Entry. MODE (Sea / Air / Road / Rail) is taken from the transport mode you entered. Most are N for an ordinary home-consumption import; Advance BE and Provisional / Final matter for special cases.",
      fields:[
        req(SEL("beStatus","1. BE Status",["Filed","Assessed","OOC COPY"],{help:"Where the Bill of Entry is in its lifecycle. 'OOC COPY' once Customs has granted Out of Charge."})),
        req(SEL("defBe","3. DEF BE - deferred payment BE",["N","Y"])),
        req(SEL("kacha","4. KACHA - kacha Bill of Entry",["N","Y"])),
        req(SEL("sec48","5. SEC 48 - goods not cleared in time",["N","Y"])),
        req(SEL("reimp","6. REIMP - re-import",["N","Y"])),
        req(SEL("advBe","7. ADV BE - advance Bill of Entry (Y / N / P)",["N","Y","P"])),
        req(SEL("assess","8. ASSESS - assessment prescribed",["N","Y"])),
        req(SEL("exam","9. EXAM - examination prescribed",["N","Y"])),
        req(SEL("hss","10. HSS - high sea sale",["N","Y"])),
        req(SEL("firstCheck","11. FIRST CHECK",["N","Y"])),
        req(SEL("provFinal","12. PROV / FINAL assessment",["F","P"],{help:"F = final, P = provisional assessment."}))
      ]
    });

    addFields(BE, "Importer Details", [
      req(T("cbCode","CB Code",{placeholder:"AAGCC0275LCH001",help:"Customs Broker (CHA) licence code - printed as 'CB CODE' in the header. The CB name is the CHA details above."})),
      SEL("gstinType","GSTIN Type",["G","T","U"],{help:"Printed after the GSTIN in the header (G = GSTIN)."}),
      T("aeoStatus","Importer AEO Status"),
      T("ucr","UCR - Unique Consignment Reference")
    ]);

    // --- supplier & invoice extras (Part II)
    addFields(BE, "Supplier & Invoice Details", [
      T("sellerName","Seller's Name (if different from supplier)"),
      TA("sellerAddress","Seller's Address"),
      DT("poDate","Purchase Order Date"),
      DT("lcDate","LC Date"),
      T("contractNo","Contract No."),
      DT("contractDate","Contract Date"),
      T("thirdPartyName","Third Party Name"),
      TA("thirdPartyAddress","Third Party Address"),
      T("supplierAeo","Supplier AEO Status"),
      NUM("commissionAmt","Commission (invoice currency)"),
      NUM("hssAmt","High Sea Sale Amount"),
      T("payTerms","Payment Terms",{placeholder:"LC",help:"Item 7 of the valuation section - LC, TT, DA, DP ..."}),
      SEL("valuationMethod","Valuation Method",["RULE 3 (TRANSACTION VALUE)","RULE 4 (IDENTICAL GOODS)","RULE 5 (SIMILAR GOODS)","RULE 7 (DEDUCTIVE VALUE)","RULE 8 (COMPUTED VALUE)","RULE 9 (RESIDUAL METHOD)"],{help:"Customs Valuation Rules, 2007 - the rule under which the assessable value is determined."}),
      SEL("relatedParty","Related Buyer & Seller (RELTD)",["N","Y"]),
      SEL("svbCh","SVB Check (SVB CH)",["N","Y"]),
      T("svbNo","SVB No."),
      DT("svbDate","SVB Date"),
      SEL("loa","Letter of Assessment (LOA)",["N","Y"])
    ]);

    // --- NEW step: cost & services (Part II section D)
    insertStep(BE, "Item Details", {
      title:"Cost & Services (Valuation Adjustments)", est:8,
      sub:"Part II - section D: the cost-and-service adjustments added to or loaded on the invoice value.",
      intro:"Under the Customs Valuation Rules, costs such as commission, packing, royalties and handling that are not in the invoice price are added to reach the assessable value. Enter the amounts (in the invoice currency) that apply; leave a box blank when it does not - the printed Bill of Entry leaves those cells blank.",
      fields:[
        NUM("cbAmt","1. C&B - commission & brokerage"), NUM("cocAmt","2. CoC - cost of container"), NUM("copAmt","3. CoP - cost of packing"),
        NUM("hndChg","4. HND CHG - handling charges"), NUM("gsAmt","5. G&S - goods & services input cost"), NUM("docChg","6. DOC CH - document charges"),
        NUM("cooChg","7. COO - country of origin certificate"), NUM("rlfAmt","8. R&LF - royalty & licence fees"), NUM("othCost","9. OTH COST - other costs"),
        NUM("ldUld","10. LD / ULD - loading / unloading charges"), NUM("wsAmt","11. WS - warranty services"), NUM("otcAmt","12. OTC - other costs"), NUM("miscCharge","13. MISC CHARGE")
      ]
    });

    // --- item table: unit price
    addColumns(BE, "itemDetails", "description", [C("unitPrice","Unit Price (invoice currency)","800",{contextKey:"txn.itemUnitPrice",numeric:true})]);

    // --- NEW step: item compliance + duty notifications (Part III)
    insertStep(BE, "Container & Package Details", {
      title:"Item Compliance & Duty Notifications", est:14,
      sub:"Part III of the Bill of Entry: the flags, standard quantity and notification particulars printed for each item.",
      intro:"For every item you entered in Item Details, add one row in each table below, in the same order. The first table holds the item flags and standard-quantity data (items 4 and 6-30 of Part III). The second holds the duty rates and exemption-notification numbers; the duty AMOUNTS themselves come from the figures you typed in Item Details.",
      fields:[
        TBL("itemCompliance","Item Compliance Flags (Part III - A)",[
          C("itemNo","Item No.","1",{numeric:true}), C("ceth","CETH (central excise tariff head)","NOEXCISE"),
          C("fs","FS (Y/N)","N"), C("pq","PQ (Y/N)","N"), C("dc","DC (Y/N)","N"), C("wc","WC (Y/N)","N"), C("aq","AQ (Y/N)","N"),
          C("coo","Country of Origin Code","KR"), C("sQty","Standard Qty","105000",{numeric:true}), C("sUqc","Standard UQC","KGS"),
          C("schCode","Scheme Code",""), C("stndPr","STND/PR","S"), C("rsp","RSP (Y/N)","N"), C("reimpFlag","REIMP (Y/N)","N"), C("prov","PROV",""),
          C("prodn","PRODN (Y/N)","N"), C("cntrl","CNTRL (Y/N)","N"), C("qualfr","QUALFR (Y/N)","Y"), C("contnt","CONTNT (Y/N)","N"), C("stmnt","STMNT (Y/N)","Y"), C("supDocs","SUP DOCS (Y/N)","N")
        ],{
          required:true, requiredCols:["itemNo","ceth","coo"], addLabel:"Add Item Row",
          errorMsg:"Add a compliance row for each item (item no., CETH and country-of-origin code at least).",
          help:"FS / PQ / DC / WC / AQ = Food-Safety, Plant-Quarantine, Drugs, Wildlife and Animal-Quarantine clearance needed (Y/N). Leave the rest as N unless the item needs it.",
          cellPatterns:{ fs:YNpat, pq:YNpat, dc:YNpat, wc:YNpat, aq:YNpat, rsp:YNpat, reimpFlag:YNpat, prodn:YNpat, cntrl:YNpat, qualfr:YNpat, contnt:YNpat, stmnt:YNpat, supDocs:YNpat, coo:{pattern:"^[A-Z]{2}$", msg:"must be a 2-letter country code (KR, CN, US ...)."} }
        }),
        TBL("itemDutyRates","Duty Rates & Notifications (Part III - B / C)",[
          C("itemNo","Item No.","1",{numeric:true}),
          C("bcdNotnNo","BCD Notn No.","050/2017"), C("bcdNotnSno","BCD Notn S.No.","267"), C("bcdRatePct","BCD Rate (%)","7.5",{numeric:true}), C("bcdDutyFg","BCD Duty Foregone","230193.8",{numeric:true}),
          C("swsRatePct","SWS Rate (%)","10",{numeric:true}),
          C("igstNotnNo","IGST Notn No.","001/2017"), C("igstNotnSno","IGST Notn S.No.","III100"), C("igstRatePct","IGST Rate (%)","18",{numeric:true}),
          C("gcessNotnNo","G.Cess Notn No.",""), C("gcessNotnSno","G.Cess Notn S.No.",""), C("gcessRatePct","G.Cess Rate (%)","0",{numeric:true}),
          C("caidcNotnNo","CAIDC Notn No.",""), C("caidcNotnSno","CAIDC Notn S.No.",""), C("caidcRatePct","CAIDC Rate (%)","",{numeric:true}), C("caidcDutyFg","CAIDC Duty Foregone","",{numeric:true})
        ],{
          required:false, addLabel:"Add Duty Row",
          help:"Rates are percentages. Notification numbers are the exemption notifications under which the concessional rate is claimed. Duty Foregone is the duty saved by the exemption."
        })
      ]
    });

    // --- container table extras
    addColumns(BE, "containerDetails", "sealNumber", [C("lclFcl","LCL / FCL","F"), C("truckNo","Truck No.","")]);

    // --- Part I extras on the duty step
    addFields(BE, "Duty & Payment Details", [
      NUM("acdTotal","Additional Customs Duty (ACD)"), NUM("nccdTotal","NCCD"), NUM("cvdTotal","Countervailing Duty (CVD)"),
      NUM("saedTotal","SAED"), NUM("gsiaTotal","GSIA"), NUM("ttaTotal","TTA"), NUM("healthTotal","Health Cess"),
      DT("challanDate","Challan / Payment Date",{help:"Printed as 'PAID ON' in Part I section F."})
    ]);

    // --- NEW step: manifest, bond & warehouse (Part I D/E/G)
    insertStep(BE, "Duty & Payment Details", {
      title:"Manifest, Bond & Warehouse Details", est:6,
      sub:"Part I - sections D, E and G: gateway manifest, bond and warehouse particulars.",
      intro:"The printed Bill of Entry carries the House airway / bill of lading details, the Gateway IGM, any bond the goods are cleared under and any warehouse Bill of Entry. Fill the ones that apply to this shipment.",
      fields:[
        DT("blAwbDate","MAWB / MBL Date",{help:"Date of the master airway bill / bill of lading (printed next to the MAWB number)."}),
        T("hawbNo","HAWB / HBL No."), DT("hawbDate","HAWB / HBL Date"),
        T("gigmNo","Gateway IGM No. (GIGM)"), DT("gigmDate","Gateway IGM Date"),
        T("bondNo","Bond No."), T("bondPort","Bond Port"), T("bondCd","Bond Code"), NUM("bondDebtAmt","Debt Amount"), NUM("bgAmt","Bank Guarantee Amount"),
        T("wbeNo","Warehouse BE No."), DT("wbeDate","Warehouse BE Date"), T("wbeSite","WBE Site"), T("whCode","Warehouse Code")
      ]
    });

    // --- NEW step: Part IV additional details
    insertStep(BE, "Declaration & Submission", {
      title:"Additional Details (Part IV)", est:10,
      sub:"Part IV of the Bill of Entry: previous BEs, manufacturer, licences, certificates and Single Window particulars.",
      intro:"These tables print under 'OTHER ADDITIONAL INFORMATION'. The Container and Invoice sections are generated from what you already entered. Add rows only where they apply - for example, chapter 39 plastics need Single Window qualifier lines (SQC, CPC, IUP, CAS), exactly like the sample Bill of Entry.",
      fields:[
        TBL("previousBes","Previous Bills of Entry (Part IV - B)",[
          C("invsno","Inv S.No.","1"), C("itmsno","Item S.No.","1"), C("beNo","BE No.",""), C("beDate","BE Date","2024-05-02"), C("prtCd","Port Code","INCCU1"), C("unitPrice","Unit Price",""), C("currencyCode","Currency","USD")
        ],{addLabel:"Add Previous BE"}),
        TBL("mfrDetails","Manufacturer / Producer / Grower (Part IV - D)",[
          C("invsno","Inv S.No.","1"), C("itmsno","Item S.No.","1"), C("type","Type","M"), C("manufactCd","Manufacturer Code",""), C("sourceCy","Source Country","KR"), C("transCy","Trans Country",""), C("address","Address","")
        ],{addLabel:"Add Manufacturer Row"}),
        TBL("beLicences","Licence Details (Part IV - F)",[
          C("invsno","Inv S.No.","1"), C("itmsno","Item S.No.","1"), C("licSlno","Licence S.No.","1"), C("licNo","Licence No.",""), C("licDate","Licence Date","2024-01-15"),
          C("code","Code",""), C("port","Port",""), C("debitValue","Debit Value","",{numeric:true}), C("qty","Qty","",{numeric:true}), C("uqc","UQC",""), C("debitDuty","Debit Duty","",{numeric:true})
        ],{addLabel:"Add Licence Row", help:"For imports under Advance Authorisation, EPCG or other licences."}),
        TBL("beCertificates","Certificate Details (Part IV - G)",[
          C("certNo","Certificate Number",""), C("certDate","Date","2024-05-02"), C("certType","Type","")
        ],{addLabel:"Add Certificate"}),
        TBL("swdLines","Single Window Declaration (Part IV - I)",[
          C("invsn","Inv S.No.","1"), C("itmsn","Item S.No.","1"), C("infoTyp","Info Type","CHR"), C("qualifier","Qualifier","SQC"),
          C("infoCd","Info Code",""), C("infoText","Info Text",""), C("infoMsr","Info Measure","105000"), C("uqc","UQC","KGS")
        ],{addLabel:"Add Single Window Row", help:"Additional qualifiers required by other-government-agency rules - e.g. SQC (standard quantity), CPC (commodity product code), IUP (IUPAC name) and CAS (CAS number) for chapter 28/29/32/39 goods."}),
        TBL("beSupportingDocs","Supporting Documents (Part IV - L)",[
          C("invsn","Inv S.No.","0"), C("itmsn","Item S.No.","0"), C("typ","Type","70500"), C("icegateId","ICEGATE ID","ACCIECUS"),
          C("irn","IRN","2024070500121077"), C("docCode","Doc Code",""), C("issuePlace","Issue Place","Korea, Republic"), C("issueDt","Issue Date","2024-06-02"), C("expDt","Expiry Date","")
        ],{addLabel:"Add Supporting Document", help:"e-Sanchit documents: invoice (type 380000), packing list, B/L, LC, certificate of origin ..."})
      ]
    });

    // --- NEW step: Part V other compliances
    insertStep(BE, "Declaration & Submission", {
      title:"Other Compliances (Part V)", est:6,
      sub:"Part V of the Bill of Entry: examination order, compliance instructions and officer remarks.",
      intro:"After assessment, Customs records the examination order and any mandatory compliance instructions on the Bill of Entry. Enter what applies to your consignment; the Out of Charge number and date are filled in only once Customs grants Out of Charge, so they are optional here.",
      fields:[
        T("examinationOrder","Examination Order (RMS)",{placeholder:"Assessment and Examination has not been prescribed for this BE.",help:"What the Risk Management System decided for this Bill of Entry."}),
        TBL("pgaLines","PGA Examination Instructions (Part V - B1)",[
          C("invNo","Inv No.","1"), C("itemNo","Item No.","1"), C("agency","Agency","FSSAI"), C("status","Status","Pending")
        ],{addLabel:"Add PGA Row", help:"Other-government-agency (FSSAI, PQ, AQ, DC ...) checks prescribed for the item."}),
        TA("compulsoryCompliance","Compulsory Compliance Instructions",{help:"Mandatory compliance requirements / examination instructions shown against the CTH."}),
        TA("acRemarks","AC Remarks"),
        TA("examReport","Examination Report"),
        TA("superintendentComments","Superintendent Comments"),
        T("oocNumber","OOC No.",{help:"Out of Charge number - issued by Customs after duty is paid. Optional until then."}),
        DT("oocDate","OOC Date"),
        T("oocTime","OOC Time",{placeholder:"11:21"})
      ]
    });

    addFields(BE, "Declaration & Submission", [
      T("declPlace","Place of Declaration",{placeholder:"Kolkata",help:"Printed in Part VI (Declaration)."}),
      DT("declDate","Date of Declaration")
    ]);
  }
})();
