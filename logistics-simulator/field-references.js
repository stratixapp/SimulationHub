/* =========================================================================
   REFERENCE DATA FOR THE NEWLY ADDED FIELDS
   -------------------------------------------------------------------------
   The split-screen Reference panel (engine.js renderReferenceEntry) shows each
   field's label, an example value and a help line.  Fields added by
   customs-forms-config.js and bill-of-lading-forms-config.js that did not carry
   a placeholder / help of their own get theirs here:
       field name -> [example value, help text]
   `example` is reference-only (it is not put into the input as a placeholder),
   so selects / dates / numbers - which have no placeholder - show a real
   worked example too.  Nothing is overwritten: a field that already has a
   placeholder, example or help keeps it.
   Loaded after every config extension, before engine.js.
   ========================================================================= */
(function(){
  "use strict";
  if(typeof DOCUMENT_CONFIGS === "undefined") return;

  const AMT_INV = "Amount in the invoice currency. Leave blank if it does not apply to this shipment.";
  const AMT_INR = "Amount in INR as shown on the duty statement. Leave blank (or 0) when this duty is not levied.";

  const REFS = {
    "shipping-bill": {
      mawbDate:["2023-06-02","Date printed on the master bill of lading / master airway bill (Part I, section E)."],
      hawbDate:["2023-06-03","Date of the house B/L or house airway bill, if a house document exists."],
      cinNo:["CIN2023060110234","Cargo Information Number issued by the port system, if any (optional)."],
      cinDate:["2023-06-06","Date the CIN was issued."],
      cinSiteId:["INNSA1","Port / terminal site that issued the CIN."],
      poDate:["2023-05-02","Date of the buyer's purchase order quoted above."],
      locDate:["2023-05-15","Date of the Letter of Credit, if payment is under a LC."],
      contractNo:["CNT/2023/044","Sales contract number between exporter and buyer (optional)."],
      contractDate:["2023-04-18","Date of the sales contract."],
      thirdPartyName:["ABC Trading FZE","Name of the third party in the transaction - leave blank if there is none."],
      thirdPartyAddress:["Office 12, Jebel Ali Free Zone, Dubai, UAE","Address of the third party named above."],
      buyerAeoStatus:["AEO-T2","The buyer's Authorised Economic Operator status abroad, if known."],
      loosePackets:["0","Number of loose (un-containerised) packets in the consignment; 0 for a fully containerised cargo."],
      discountAmt:["0",AMT_INV], commissionAmt:["0",AMT_INV], deductionsAmt:["0",AMT_INV], packingCharges:["0",AMT_INV],
      declDate:["2023-06-06","The date you sign the declaration - printed in Part V."],
      assess:["Y","Y when Customs assesses the Shipping Bill - normal for an EDI Shipping Bill."],
      exmn:["N","Y only if the goods were physically examined by Customs."],
      jobbing:["N","Y for job-work exports where raw material is imported duty-free for processing."],
      meis:["N","Y if the Merchandise Exports from India Scheme reward is claimed."],
      dbk:["Y","Y if duty drawback is claimed on at least one item. Keep it consistent with the item-wise scheme table."],
      rodtp:["Y","Y if RoDTEP is claimed on at least one item. Keep it consistent with the item-wise scheme table."],
      deecDfia:["N","Y if the export is under an Advance Authorisation / DFIA licence."],
      dfrc:["N","Y for exports against a Duty Free Replenishment Certificate."],
      reExp:["N","Y if goods imported earlier are being re-exported."],
      lut:["N","Y if exported under a Letter of Undertaking, i.e. without paying IGST."]
    },
    "bill-of-entry": {
      defBe:["N","Y if payment of duty is deferred under the deferred-payment facility."],
      kacha:["N","Y for a 'kacha' Bill of Entry filed with provisional particulars."],
      sec48:["N","Y if goods not cleared in time are being dealt with under Section 48 of the Customs Act."],
      reimp:["N","Y if goods exported earlier are being re-imported."],
      advBe:["N","Y / P when the Bill of Entry is filed in advance of the vessel's arrival (prior filing)."],
      assess:["N","Y if assessment has been prescribed for this Bill of Entry by the Risk Management System."],
      exam:["N","Y if physical examination has been prescribed."],
      hss:["N","Y when the goods are imported under a High Sea Sale."],
      firstCheck:["N","Y when the Bill of Entry is assessed on a first-check basis."],
      relatedParty:["N","Y when the buyer and seller are related persons under the Customs Valuation Rules."],
      svbCh:["N","Y if a Special Valuation Branch check applies to this importer / supplier pair."],
      loa:["N","Y if a Letter of Assessment applies to this Bill of Entry."],
      aeoStatus:["AEO-T2","The importer's Authorised Economic Operator status, if any."],
      ucr:["1IN24AAUCS9806K1","Unique Consignment Reference, if one has been allotted."],
      sellerName:["LG CHEM LTD","Fill only if the seller differs from the supplier named above."],
      sellerAddress:["LG Twin Towers, 128 Yeoui-daero, Seoul, South Korea","Seller's address, when the seller differs from the supplier."],
      contractNo:["CNT/2024/009","Contract number between buyer and seller (optional)."],
      thirdPartyName:["XYZ Trading Pte Ltd","Third party in the transaction, if any."],
      thirdPartyAddress:["8 Marina Boulevard, Singapore","Address of the third party."],
      supplierAeo:["AEO-T1","The supplier's AEO status abroad, if known."],
      svbNo:["SVB/2023/118","Special Valuation Branch reference, when the SVB check is Y."],
      hawbNo:["HLCUSEL240612345","House airway bill / house bill of lading number, if a house document exists."],
      gigmNo:["2382001","Gateway IGM number when the cargo came through a gateway port."],
      bondNo:["BOND/INCCU1/2023/044","Bond number when the goods are cleared under a bond (e.g. EOU / warehouse)."],
      bondPort:["INCCU1","Customs port that holds the bond."],
      bondCd:["EOU","Bond type code."],
      wbeNo:["WBE/2024/0098","Warehouse Bill of Entry number, for ex-bond clearance."],
      wbeSite:["INCCU1","Site / port of the warehouse Bill of Entry."],
      whCode:["WH-KOL-014","Code of the bonded warehouse."],
      oocNumber:["2058071977","Out of Charge number issued by Customs once duty is paid - optional until then."],
      compulsoryCompliance:["Mandatory compliance requirements (CTH 39041020): comply with the notifications listed against the tariff item.","Compliance instructions shown against the tariff heading after assessment."],
      acRemarks:["No remarks.","Remarks recorded by the Assistant Commissioner, if any."],
      examReport:["Examination not prescribed.","Examination report entered by the Customs officer, if examination was done."],
      superintendentComments:["Cleared for out of charge.","Comments recorded by the Superintendent, if any."],
      poDate:["2024-05-10","Date of the purchase order."],
      lcDate:["2024-05-15","Date of the Letter of Credit."],
      contractDate:["2024-04-20","Date of the contract."],
      svbDate:["2023-11-02","Date of the SVB reference."],
      blAwbDate:["2024-06-02","Date of the master bill of lading / master airway bill."],
      hawbDate:["2024-06-03","Date of the house airway bill / bill of lading."],
      gigmDate:["2024-07-04","Date of the Gateway IGM."],
      wbeDate:["2024-06-20","Date of the warehouse Bill of Entry."],
      challanDate:["2024-07-07","Date the duty was paid (printed as PAID ON)."],
      oocDate:["2024-07-13","Date Customs granted Out of Charge."],
      declDate:["2024-07-06","Date you sign the declaration - printed in Part VI."],
      commissionAmt:["0",AMT_INV], hssAmt:["0",AMT_INV],
      cbAmt:["0",AMT_INV], cocAmt:["0",AMT_INV], copAmt:["0",AMT_INV], hndChg:["0",AMT_INV], gsAmt:["0",AMT_INV], docChg:["0",AMT_INV],
      cooChg:["0",AMT_INV], rlfAmt:["0",AMT_INV], othCost:["0",AMT_INV], ldUld:["0",AMT_INV], wsAmt:["0",AMT_INV], otcAmt:["0",AMT_INV], miscCharge:["0",AMT_INV],
      bondDebtAmt:["0","Debt amount under the bond (INR), if a bond applies."], bgAmt:["0","Bank guarantee amount (INR), if a bank guarantee was furnished."],
      acdTotal:["0",AMT_INR], nccdTotal:["0",AMT_INR], cvdTotal:["0",AMT_INR], saedTotal:["0",AMT_INR], gsiaTotal:["0",AMT_INR], ttaTotal:["0",AMT_INR], healthTotal:["0",AMT_INR]
    },
    "bill-of-lading-sea": {
      declaredValue:["25000","Only when the shipper declares a value above the carrier's package limitation (ad valorem freight). Leave blank otherwise."],
      exchangeRateBl:["83.45","Rate used to convert the charges currency to local currency, printed in the 'Ex. rate' column."]
    }
  };

  Object.keys(REFS).forEach(slug=>{
    const cfg = DOCUMENT_CONFIGS[slug]; if(!cfg) return;
    const dict = REFS[slug];
    cfg.steps.forEach(st => (st.fields||[]).forEach(f=>{
      const r = dict[f.name]; if(!r || f.type === "table") return;
      if(!f.help && r[1]) f.help = r[1];
      if(!f.placeholder && !f.example && r[0] !== "" && f.type !== "select") f.example = r[0];
      if(f.type === "select" && !f.example && r[0]) f.example = "e.g. " + r[0] + "  (choose from: " + (f.options||[]).join(" · ") + ")";
    }));
  });
})();
