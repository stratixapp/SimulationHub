/* GENERATED from the Logistics Document Simulator Shipping Bill (14 steps) / Bill of Entry (15 steps) configs - the ICEGATE fields TCOS does not already collect in its own core steps.
   Same field names as the Doc-Sim, so filing.icegate feeds the shared print renderers directly. */
const TCOS_ICEGATE_SPEC = {
 "export": [
  {
   "after": "party",
   "docSimStep": 1,
   "key": "ig1",
   "title": "Customs & Exporter Reference",
   "fields": [
    {
     "name": "customsHouseCode",
     "label": "Customs House Code",
     "type": "text",
     "required": true,
     "uppercase": true,
     "placeholder": "INNSA1",
     "pattern": "^[A-Z]{2}[A-Z0-9]{2,6}$",
     "patternMsg": "Use the ICEGATE customs house code format, e.g. INNSA1 (Nhava Sheva) or INBOM4 (JNCH).",
     "help": "The 6-character code identifying the customs station where this Shipping Bill is filed."
    },
    {
     "name": "jobNumber",
     "label": "Job Number",
     "type": "text",
     "required": true,
     "uppercase": true,
     "placeholder": "JOB/2026/001123",
     "pattern": "^[A-Z0-9\\/\\-]{4,20}$",
     "patternMsg": "Use letters, numbers, slashes or hyphens, 4–20 characters."
    },
    {
     "name": "jobDate",
     "label": "Job Date",
     "type": "date",
     "required": true,
     "help": "The date the Customs House Agent (CHA) files this Shipping Bill job with ICEGATE."
    },
    {
     "name": "chaLicenseNo",
     "label": "CHA License Number",
     "type": "text",
     "required": true,
     "uppercase": true,
     "placeholder": "11/1234",
     "pattern": "^[A-Z0-9\\/\\-]{4,15}$",
     "patternMsg": "Enter a valid CHA licence number, e.g. 11/1234."
    },
    {
     "name": "branchSerialNo",
     "label": "Branch Serial Number",
     "type": "text",
     "required": true,
     "placeholder": "01",
     "pattern": "^\\d{1,3}$",
     "patternMsg": "Branch serial number must be 1–3 digits."
    },
    {
     "name": "exporterType",
     "label": "Exporter Type",
     "type": "select",
     "required": true,
     "options": [
      "Manufacturer Exporter",
      "Merchant Exporter",
      "Third Party Exporter",
      "EOU / SEZ Unit"
     ]
    },
    {
     "name": "exporterClass",
     "label": "Exporter Class",
     "type": "select",
     "required": true,
     "help": "Status-holder classification under India's Foreign Trade Policy, if applicable.",
     "options": [
      "Not Applicable",
      "One Star Export House",
      "Two Star Export House",
      "Three Star Export House",
      "Four Star Export House",
      "Five Star Export House"
     ]
    }
   ]
  },
  {
   "after": "counterparty",
   "docSimStep": 2,
   "key": "ig2",
   "title": "Declarant, Consignee & Bank Details",
   "fields": [
    {
     "name": "gstinType",
     "label": "GSTIN Type",
     "type": "select",
     "required": true,
     "help": "Shown as 'GSTIN/TYPE' in the header and in section B. GSN = a regular GST Identification Number.",
     "options": [
      "GSN",
      "ARN",
      "UIN",
      "NA"
     ]
    },
    {
     "name": "cbName",
     "label": "Customs Broker (CB) Name",
     "type": "text",
     "required": true,
     "placeholder": "SAI DUTTA SHIPPING AGENCY PVT. LTD.",
     "help": "The Customs House Agent filing this Shipping Bill. The CB CODE in the header is the CHA licence number you entered earlier."
    },
    {
     "name": "adCode",
     "label": "AD Code",
     "type": "text",
     "required": true,
     "placeholder": "6390055",
     "pattern": "^\\d{7}$",
     "patternMsg": "AD Code is a 7-digit code issued by the Authorised Dealer bank's customs office.",
     "help": "7-digit Authorised Dealer code registered with the Customs port."
    },
    {
     "name": "rbiWaiverNoDt",
     "label": "RBI Waiver No. & Date",
     "type": "text",
     "required": false,
     "placeholder": "Leave blank if there is no RBI waiver",
     "help": "Only when RBI has waived the EDF / realisation requirement for this shipment."
    },
    {
     "name": "aeoStatus",
     "label": "Exporter AEO Status",
     "type": "text",
     "required": false,
     "placeholder": "e.g. AEO-T2 (leave blank if none)"
    },
    {
     "name": "consigneeCountryCode",
     "label": "Consignee Country Code",
     "type": "text",
     "required": true,
     "uppercase": true,
     "placeholder": "CI",
     "pattern": "^[A-Z]{2}$",
     "patternMsg": "Enter the 2-letter ISO country code, e.g. CI, AE, US."
    },
    {
     "name": "forexBankAcNo",
     "label": "Forex Bank A/c No.",
     "type": "text",
     "required": true,
     "placeholder": "00XXXXXXX301",
     "help": "Account where export proceeds are credited."
    },
    {
     "name": "dbkBankAcNo",
     "label": "Drawback (DBK) Bank A/c No.",
     "type": "text",
     "required": false,
     "placeholder": "00XXXXXXX301",
     "help": "Account that receives drawback / RoDTEP credit."
    },
    {
     "name": "ifscNo",
     "label": "IFSC Code",
     "type": "text",
     "required": true,
     "uppercase": true,
     "placeholder": "ICIC0000062",
     "pattern": "^[A-Z]{4}0[A-Z0-9]{6}$",
     "patternMsg": "IFSC is 4 letters, a zero, then 6 letters/digits (e.g. ICIC0000062)."
    }
   ]
  },
  {
   "after": "shipment",
   "docSimStep": 3,
   "key": "ig3",
   "title": "Cargo & Shipment Particulars",
   "fields": [
    {
     "name": "natureOfCargo",
     "label": "Nature of Cargo",
     "type": "select",
     "required": true,
     "options": [
      "General Cargo",
      "Hazardous Cargo",
      "Perishable Cargo",
      "Containerized Cargo",
      "Bulk Cargo",
      "Break Bulk Cargo"
     ]
    },
    {
     "name": "uom",
     "label": "Unit of Measurement",
     "type": "select",
     "required": true,
     "options": [
      "KGS",
      "MTS",
      "LTR",
      "NOS",
      "BOX",
      "CTN"
     ]
    },
    {
     "name": "mawbNumber",
     "label": "MAWB Number (Air)",
     "type": "text",
     "required": false,
     "placeholder": "098-12345678",
     "pattern": "^\\d{3}-\\d{8}$",
     "patternMsg": "Use IATA format: 3-digit airline prefix, hyphen, 8-digit number, e.g. 098-12345678."
    },
    {
     "name": "hawbNumber",
     "label": "HAWB Number (Air)",
     "type": "text",
     "required": false,
     "uppercase": true,
     "placeholder": "HAWB2026778812"
    },
    {
     "name": "sealType",
     "label": "Seal Type",
     "type": "select",
     "required": false,
     "options": [
      "One-Time Lock (OTL)",
      "Electronic Seal",
      "RFID Seal",
      "Not Applicable"
     ]
    },
    {
     "name": "stateOfOrigin",
     "label": "State of Origin",
     "type": "text",
     "required": true,
     "placeholder": "Maharashtra",
     "help": "Item 14 of Part I - the Indian state where the goods were manufactured."
    },
    {
     "name": "portFinalDestination",
     "label": "Port of Final Destination",
     "type": "text",
     "required": true,
     "placeholder": "CIABJ (Abidjan)",
     "help": "Item 15 - the port abroad where the goods finally arrive (may differ from the port of discharge)."
    },
    {
     "name": "countryDischarge",
     "label": "Country of Discharge",
     "type": "text",
     "required": true,
     "placeholder": "COTE D IVOIRE",
     "help": "Item 17 - country of the port of discharge."
    },
    {
     "name": "mawbDate",
     "label": "MAWB / MBL Date",
     "type": "date",
     "required": false,
     "help": "Master airway / bill of lading date (Part I, section E)."
    },
    {
     "name": "hawbDate",
     "label": "HAWB / HBL Date",
     "type": "date",
     "required": false
    },
    {
     "name": "cinNo",
     "label": "CIN No.",
     "type": "text",
     "required": false,
     "help": "Cargo Information Number, if the port has issued one (section E)."
    },
    {
     "name": "cinDate",
     "label": "CIN Date",
     "type": "date",
     "required": false
    },
    {
     "name": "cinSiteId",
     "label": "CIN Site ID",
     "type": "text",
     "required": false
    },
    {
     "name": "loosePackets",
     "label": "Loose Packets",
     "type": "number",
     "required": false,
     "help": "Item 5 of section I - loose (un-containerised) packets, if any."
    }
   ]
  },
  {
   "after": "invoice",
   "docSimStep": 4,
   "key": "ig4",
   "title": "Invoice Details",
   "fields": [
    {
     "name": "buyerName",
     "label": "Buyer Name",
     "type": "text",
     "required": true,
     "placeholder": "Nordic Trading GmbH"
    },
    {
     "name": "buyerAddress",
     "label": "Buyer Address",
     "type": "textarea",
     "required": true,
     "placeholder": "Hafenstrasse 22, 20457 Hamburg, Germany",
     "full": true
    },
    {
     "name": "natureOfContract",
     "label": "Nature of Contract",
     "type": "select",
     "required": true,
     "options": [
      "Sale",
      "Consignment",
      "Job Work",
      "Sample",
      "Other"
     ]
    },
    {
     "name": "freightCurrency",
     "label": "Freight Currency",
     "type": "select",
     "required": false,
     "options": [
      "INR",
      "USD",
      "EUR",
      "GBP",
      "AED",
      "JPY"
     ]
    },
    {
     "name": "poNo",
     "label": "Purchase Order No.",
     "type": "text",
     "required": false,
     "placeholder": "PO/2023/118"
    },
    {
     "name": "poDate",
     "label": "Purchase Order Date",
     "type": "date",
     "required": false
    },
    {
     "name": "locNo",
     "label": "Letter of Credit (LoC) No.",
     "type": "text",
     "required": false,
     "placeholder": "If payment is under a LC"
    },
    {
     "name": "locDate",
     "label": "LoC Date",
     "type": "date",
     "required": false
    },
    {
     "name": "contractNo",
     "label": "Contract No.",
     "type": "text",
     "required": false
    },
    {
     "name": "contractDate",
     "label": "Contract Date",
     "type": "date",
     "required": false
    },
    {
     "name": "thirdPartyName",
     "label": "Third Party Name",
     "type": "text",
     "required": false,
     "help": "Only if a third party is involved in the transaction (Part II section B)."
    },
    {
     "name": "thirdPartyAddress",
     "label": "Third Party Address",
     "type": "textarea",
     "required": false,
     "full": true
    },
    {
     "name": "buyerAeoStatus",
     "label": "Buyer AEO Status",
     "type": "text",
     "required": false
    },
    {
     "name": "discountAmt",
     "label": "Discount (invoice currency)",
     "type": "number",
     "required": false
    },
    {
     "name": "commissionAmt",
     "label": "Commission (invoice currency)",
     "type": "number",
     "required": false
    },
    {
     "name": "deductionsAmt",
     "label": "Deductions (invoice currency)",
     "type": "number",
     "required": false
    },
    {
     "name": "packingCharges",
     "label": "Packing Charges P/C (invoice currency)",
     "type": "number",
     "required": false
    }
   ]
  },
  {
   "after": "items",
   "docSimStep": 6,
   "key": "ig6",
   "title": "Item-Wise Scheme & Tax Particulars",
   "fields": [
    {
     "name": "itemScheme",
     "label": "Item-Wise Scheme & Tax Details",
     "type": "table",
     "required": true,
     "help": "Flags are Y or N. Rates are percentages - e.g. IGST 18, drawback 1.3, RoDTEP 0.8. Scheme codes: 19 = Drawback, 03 = Advance Authorisation, 00 = none. SQC = Standard Quantity Code (weight / quantity in the unit shown).",
     "requiredCols": [
      "itemNo",
      "dbkClaimed",
      "rodtepClaimed",
      "igstStatus",
      "igstRatePct",
      "schemeCode",
      "schemeDescription",
      "sqcMsr",
      "sqcUqc",
      "districtOrigin",
      "ptAbroad",
      "ftaBenefit",
      "rewardBenefit",
      "thirdPartyItem"
     ],
     "addLabel": "Add Item Row",
     "columns": [
      {
       "key": "itemNo",
       "label": "Item No.",
       "placeholder": "1",
       "numeric": true
      },
      {
       "key": "dbkClaimed",
       "label": "Drawback Claimed (Y/N)",
       "placeholder": "Y"
      },
      {
       "key": "dbkSlNo",
       "label": "Drawback Sr.No.",
       "placeholder": "3819B"
      },
      {
       "key": "dbkRatePct",
       "label": "DBK Rate (%)",
       "placeholder": "1.3",
       "numeric": true
      },
      {
       "key": "rodtepClaimed",
       "label": "RoDTEP Claimed (Y/N)",
       "placeholder": "Y"
      },
      {
       "key": "rodtepRatePct",
       "label": "RoDTEP Rate (%)",
       "placeholder": "0.8",
       "numeric": true
      },
      {
       "key": "igstStatus",
       "label": "IGST Status (P = paid)",
       "placeholder": "P"
      },
      {
       "key": "igstRatePct",
       "label": "IGST Rate (%)",
       "placeholder": "18",
       "numeric": true
      },
      {
       "key": "schemeCode",
       "label": "Scheme Code",
       "placeholder": "19"
      },
      {
       "key": "schemeDescription",
       "label": "Scheme Description",
       "placeholder": "Drawback"
      },
      {
       "key": "sqcMsr",
       "label": "SQC Measure",
       "placeholder": "5429",
       "numeric": true
      },
      {
       "key": "sqcUqc",
       "label": "SQC UQC",
       "placeholder": "KGS"
      },
      {
       "key": "districtOrigin",
       "label": "District of Origin",
       "placeholder": "PALGHAR"
      },
      {
       "key": "ptAbroad",
       "label": "PT Abroad",
       "placeholder": "NCPTI"
      },
      {
       "key": "compCess",
       "label": "Comp. Cess (INR)",
       "placeholder": "0",
       "numeric": true
      },
      {
       "key": "ftaBenefit",
       "label": "FTA Benefit Availed (Y/N)",
       "placeholder": "Y"
      },
      {
       "key": "rewardBenefit",
       "label": "Reward Benefit (Yes/No)",
       "placeholder": "Yes"
      },
      {
       "key": "thirdPartyItem",
       "label": "Third Party Item (Y/N)",
       "placeholder": "N"
      }
     ],
     "itemAligned": true
    }
   ]
  },
  {
   "after": "items",
   "docSimStep": 7,
   "key": "ig7",
   "title": "Exchange Rate Details",
   "fields": [
    {
     "name": "currencyCode",
     "label": "Currency Code",
     "type": "text",
     "required": true,
     "uppercase": true,
     "placeholder": "USD",
     "showIf": "d=>d.invoiceCurrency && d.invoiceCurrency!==\"INR\""
    },
    {
     "name": "exchangeRate",
     "label": "Exchange Rate",
     "type": "number",
     "required": true,
     "placeholder": "83.20",
     "pattern": "^\\d+(\\.\\d{1,2})?$",
     "patternMsg": "Enter a valid non-negative number (up to 2 decimal places).",
     "showIf": "d=>d.invoiceCurrency && d.invoiceCurrency!==\"INR\""
    },
    {
     "name": "effectiveDate",
     "label": "Effective Date",
     "type": "date",
     "required": true,
     "help": "The date this Shipping Bill / scheme benefit becomes effective, once assessed by Customs.",
     "showIf": "d=>d.invoiceCurrency && d.invoiceCurrency!==\"INR\""
    }
   ]
  },
  {
   "after": "items",
   "docSimStep": 8,
   "key": "ig8",
   "title": "Shipping Bill Status Flags",
   "fields": [
    {
     "name": "assess",
     "label": "2. ASSESS - assessed by Customs",
     "type": "select",
     "required": true,
     "options": [
      "Y",
      "N"
     ]
    },
    {
     "name": "exmn",
     "label": "3. EXMN - physically examined",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "jobbing",
     "label": "4. JOBBING - job work export",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "meis",
     "label": "5. MEIS - Merchandise Exports from India Scheme claimed",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "dbk",
     "label": "6. DBK - drawback claimed",
     "type": "select",
     "required": true,
     "options": [
      "Y",
      "N"
     ]
    },
    {
     "name": "rodtp",
     "label": "7. RODTP - RoDTEP claimed",
     "type": "select",
     "required": true,
     "options": [
      "Y",
      "N"
     ]
    },
    {
     "name": "deecDfia",
     "label": "8. DEEC / DFIA - advance authorisation / duty free import",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "dfrc",
     "label": "9. DFRC - Duty Free Replenishment Certificate",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "reExp",
     "label": "10. RE-EXP - re-export",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "lut",
     "label": "11. LUT - exported under Letter of Undertaking (no IGST paid)",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    }
   ]
  },
  {
   "after": "items",
   "docSimStep": 9,
   "key": "ig9",
   "title": "Licence / DFIA / Job Work Details",
   "fields": [
    {
     "name": "schemeType",
     "label": "Exporting Under a Scheme?",
     "type": "select",
     "required": true,
     "options": [
      "None",
      "Advance Authorization",
      "DFIA",
      "Job Work",
      "Other"
     ],
     "reRenderOnChange": true
    },
    {
     "name": "advanceAuthNo",
     "label": "Advance Authorization Number",
     "type": "text",
     "required": false,
     "uppercase": true,
     "placeholder": "AA/2026/004521",
     "showIf": "d=>d.schemeType===\"Advance Authorization\""
    },
    {
     "name": "dfiaNo",
     "label": "DFIA Number",
     "type": "text",
     "required": false,
     "uppercase": true,
     "placeholder": "DFIA/2026/001187",
     "showIf": "d=>d.schemeType===\"DFIA\""
    },
    {
     "name": "sionNumber",
     "label": "SION Number",
     "type": "text",
     "required": false,
     "uppercase": true,
     "placeholder": "E-123",
     "showIf": "d=>d.schemeType===\"Advance Authorization\"||d.schemeType===\"DFIA\""
    },
    {
     "name": "licenceNumber",
     "label": "Licence Number",
     "type": "text",
     "required": false,
     "uppercase": true,
     "placeholder": "LIC/2026/00981",
     "showIf": "d=>d.schemeType!==\"None\""
    },
    {
     "name": "quantityUsed",
     "label": "Quantity Used",
     "type": "text",
     "required": false,
     "placeholder": "120 PCS against this licence",
     "showIf": "d=>d.schemeType!==\"None\""
    },
    {
     "name": "jobWorkDetails",
     "label": "Job Work Details",
     "type": "textarea",
     "required": false,
     "placeholder": "Description of job work performed and the sending unit's particulars",
     "full": true,
     "showIf": "d=>d.schemeType===\"Job Work\""
    },
    {
     "name": "boeNumber",
     "label": "Bill of Entry Number",
     "type": "text",
     "required": false,
     "uppercase": true,
     "placeholder": "BOE-2026-445210",
     "help": "Relevant where imported inputs under this scheme were originally cleared.",
     "showIf": "d=>d.schemeType!==\"None\""
    },
    {
     "name": "portCode",
     "label": "Port Code",
     "type": "text",
     "required": false,
     "uppercase": true,
     "placeholder": "INNSA1",
     "showIf": "d=>d.schemeType!==\"None\""
    },
    {
     "name": "licenceLines",
     "label": "AA / DFIA Licence Details (Part IV - B)",
     "type": "table",
     "required": false,
     "help": "One row per export item that is covered by an Advance Authorisation / DFIA licence.",
     "addLabel": "Add Licence Line",
     "showIf": "d=>/advance|dfia|authori[sz]ation/i.test(String(d.schemeType||\"\"))",
     "columns": [
      {
       "key": "invSno",
       "label": "Inv S.No.",
       "placeholder": "1"
      },
      {
       "key": "itemSno",
       "label": "Item S.No.",
       "placeholder": "5"
      },
      {
       "key": "licenceNo",
       "label": "Licence No.",
       "placeholder": "0311020417"
      },
      {
       "key": "descnExportItem",
       "label": "Description of Export Item",
       "placeholder": "H23 ARTICLES MADE OF HDPE"
      },
      {
       "key": "expSno",
       "label": "Export S.No.",
       "placeholder": "1"
      },
      {
       "key": "expQty",
       "label": "Export Qty",
       "placeholder": "1291",
       "numeric": true
      },
      {
       "key": "uqc",
       "label": "UQC",
       "placeholder": "KGS"
      },
      {
       "key": "fobValue",
       "label": "FOB Value (INR)",
       "placeholder": "161580.41",
       "numeric": true
      },
      {
       "key": "sion",
       "label": "SION",
       "placeholder": "63 23"
      },
      {
       "key": "descnImportItem",
       "label": "Description of Import Item",
       "placeholder": "HDPE Granules"
      },
      {
       "key": "impSno",
       "label": "Import S.No.",
       "placeholder": "1"
      },
      {
       "key": "impQty",
       "label": "Import Qty",
       "placeholder": "1356",
       "numeric": true
      },
      {
       "key": "impUqc",
       "label": "Import UQC",
       "placeholder": "KGS"
      },
      {
       "key": "indigImp",
       "label": "Indigenous / Imported",
       "placeholder": "Imp"
      }
     ],
     "itemAligned": false
    },
    {
     "name": "jobbingLines",
     "label": "Jobbing Details (Part IV - C)",
     "type": "table",
     "required": false,
     "help": "Only for job-work exports - the Bill of Entry the raw material was imported under.",
     "addLabel": "Add Jobbing Line",
     "showIf": "d=>/job/i.test(String(d.schemeType||\"\"))",
     "columns": [
      {
       "key": "beNo",
       "label": "BE No.",
       "placeholder": "4355337"
      },
      {
       "key": "beDate",
       "label": "BE Date",
       "placeholder": "2023-05-02"
      },
      {
       "key": "portCode",
       "label": "Port Code",
       "placeholder": "INNSA1"
      },
      {
       "key": "descnImported",
       "label": "Description of Imported Goods",
       "placeholder": "Steel coils"
      },
      {
       "key": "qtyImp",
       "label": "Qty Imported",
       "placeholder": "1000",
       "numeric": true
      },
      {
       "key": "qtyUsed",
       "label": "Qty Used",
       "placeholder": "900",
       "numeric": true
      }
     ],
     "itemAligned": false
    }
   ]
  },
  {
   "after": "containers",
   "docSimStep": 10,
   "key": "ig10",
   "title": "Packaging / Rotation / Container Details",
   "fields": [
    {
     "name": "rotationNumber",
     "label": "Rotation Number",
     "type": "text",
     "required": false,
     "uppercase": true,
     "placeholder": "ROT/2026/00871"
    },
    {
     "name": "rotationDate",
     "label": "Rotation Date",
     "type": "date",
     "required": false,
     "help": "The date the vessel's rotation number is assigned by the port — links this Shipping Bill to a specific sailing."
    },
    {
     "name": "packagingNumber",
     "label": "Packaging Number",
     "type": "text",
     "required": false,
     "uppercase": true,
     "placeholder": "PKG-2026-0451"
    },
    {
     "name": "movementDocNo",
     "label": "Movement Document Number",
     "type": "text",
     "required": false,
     "uppercase": true,
     "placeholder": "MDN/2026/00221"
    },
    {
     "name": "exciseSealNo",
     "label": "Excise Seal Number",
     "type": "text",
     "required": false,
     "uppercase": true,
     "placeholder": "ESN-778812",
     "pattern": "^[A-Z0-9\\-]{4,20}$",
     "patternMsg": "Seal number should be 4-20 characters: capital letters, digits or hyphens only."
    }
   ]
  },
  {
   "after": "documents",
   "docSimStep": 11,
   "key": "ig11",
   "title": "Supporting Documents & Annexures",
   "fields": [
    {
     "name": "challanLines",
     "label": "Challan Details (Part I - H)",
     "type": "table",
     "required": false,
     "help": "Only if a duty / fee challan was paid on this Shipping Bill (e.g. export duty).",
     "addLabel": "Add Challan",
     "columns": [
      {
       "key": "srNo",
       "label": "Sr.No.",
       "placeholder": "1"
      },
      {
       "key": "challanNo",
       "label": "Challan No.",
       "placeholder": ""
      },
      {
       "key": "paymtDt",
       "label": "Payment Date",
       "placeholder": "2023-06-06"
      },
      {
       "key": "amount",
       "label": "Amount (INR)",
       "placeholder": "",
       "numeric": true
      }
     ],
     "itemAligned": false
    },
    {
     "name": "ar4Lines",
     "label": "AR4 Details (Part IV - J)",
     "type": "table",
     "required": false,
     "help": "Central Excise AR4 particulars - for goods cleared from a central excise registered factory.",
     "addLabel": "Add AR4 Row",
     "columns": [
      {
       "key": "invsn",
       "label": "Inv S.No.",
       "placeholder": "1"
      },
      {
       "key": "itmsn",
       "label": "Item S.No.",
       "placeholder": "1"
      },
      {
       "key": "ar4No",
       "label": "AR4 Number",
       "placeholder": ""
      },
      {
       "key": "ar4Dt",
       "label": "AR4 Date",
       "placeholder": "2023-05-30"
      },
      {
       "key": "commissionerate",
       "label": "Commissionerate",
       "placeholder": ""
      },
      {
       "key": "division",
       "label": "Division",
       "placeholder": ""
      },
      {
       "key": "range",
       "label": "Range",
       "placeholder": ""
      }
     ],
     "itemAligned": false
    },
    {
     "name": "thirdPartyLines",
     "label": "Third Party Details (Part IV - K)",
     "type": "table",
     "required": false,
     "help": "Fill if the goods are exported on behalf of a third party (merchant-manufacturer exports).",
     "addLabel": "Add Third Party Row",
     "columns": [
      {
       "key": "invsn",
       "label": "Inv S.No.",
       "placeholder": "1"
      },
      {
       "key": "itmsn",
       "label": "Item S.No.",
       "placeholder": "1"
      },
      {
       "key": "iec",
       "label": "IEC",
       "placeholder": ""
      },
      {
       "key": "exporterName",
       "label": "Exporter Name",
       "placeholder": ""
      },
      {
       "key": "address",
       "label": "Address",
       "placeholder": ""
      },
      {
       "key": "gstnIdType",
       "label": "GSTN ID & Type",
       "placeholder": ""
      }
     ],
     "itemAligned": false
    },
    {
     "name": "manufacturerLines",
     "label": "Item Manufacturer / Producer / Grower (Part IV - L)",
     "type": "table",
     "required": false,
     "help": "Where the goods are made by someone other than the exporter.",
     "addLabel": "Add Manufacturer Row",
     "columns": [
      {
       "key": "invsn",
       "label": "Inv S.No.",
       "placeholder": "1"
      },
      {
       "key": "itmsn",
       "label": "Item S.No.",
       "placeholder": "1"
      },
      {
       "key": "type",
       "label": "Type",
       "placeholder": "M"
      },
      {
       "key": "manufactCd",
       "label": "Manufacturer Code",
       "placeholder": ""
      },
      {
       "key": "sourceState",
       "label": "Source State",
       "placeholder": "27"
      },
      {
       "key": "transCy",
       "label": "Trans CY",
       "placeholder": ""
      },
      {
       "key": "address",
       "label": "Address",
       "placeholder": ""
      }
     ],
     "itemAligned": false
    }
   ]
  },
  {
   "after": "documents",
   "docSimStep": 12,
   "key": "ig12",
   "title": "Digital Signature & Submission",
   "fields": [
    {
     "name": "signatoryName",
     "label": "Signatory Name",
     "type": "text",
     "required": true,
     "placeholder": "Priya Sharma"
    },
    {
     "name": "signatoryDesignation",
     "label": "Signatory Designation",
     "type": "text",
     "required": true,
     "placeholder": "Authorized CHA Signatory"
    },
    {
     "name": "declPlace",
     "label": "Place of Declaration",
     "type": "text",
     "required": false,
     "placeholder": "Mumbai",
     "help": "Printed in Part V (Declarations)."
    },
    {
     "name": "declDate",
     "label": "Date of Declaration",
     "type": "date",
     "required": false
    }
   ]
  }
 ],
 "import": [
  {
   "after": "shipment",
   "docSimStep": 1,
   "key": "ig1",
   "title": "General Details",
   "fields": [
    {
     "name": "beType",
     "label": "Bill of Entry Type",
     "type": "select",
     "required": true,
     "options": [
      "Home Consumption",
      "Warehouse",
      "Ex-Bond"
     ],
     "reRenderOnChange": true
    },
    {
     "name": "portCode",
     "label": "Port Code",
     "type": "text",
     "required": true,
     "uppercase": true,
     "placeholder": "INNSA1",
     "pattern": "^[A-Z]{2}[A-Z0-9]{2,6}$",
     "patternMsg": "Use the ICEGATE port code format, e.g. INNSA1 (Nhava Sheva) or INBOM4 (JNCH)."
    },
    {
     "name": "countryExport",
     "label": "Country of Export",
     "type": "text",
     "required": true,
     "placeholder": "Germany"
    },
    {
     "name": "arrivalDate",
     "label": "Arrival Date",
     "type": "date",
     "required": true,
     "help": "The actual date the carrying vessel/aircraft arrives at the Indian port/airport."
    },
    {
     "name": "portOfShipment",
     "label": "Port of Shipment",
     "type": "text",
     "required": true,
     "placeholder": "Kwangyang",
     "help": "Item 16 of Part I - the port the goods were shipped from (can differ from the port of loading)."
    }
   ]
  },
  {
   "after": "shipment",
   "docSimStep": 2,
   "key": "ig2",
   "title": "Bill of Entry Status Flags",
   "fields": [
    {
     "name": "defBe",
     "label": "3. DEF BE - deferred payment BE",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "kacha",
     "label": "4. KACHA - kacha Bill of Entry",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "sec48",
     "label": "5. SEC 48 - goods not cleared in time",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "reimp",
     "label": "6. REIMP - re-import",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "advBe",
     "label": "7. ADV BE - advance Bill of Entry (Y / N / P)",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y",
      "P"
     ]
    },
    {
     "name": "assess",
     "label": "8. ASSESS - assessment prescribed",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "hss",
     "label": "10. HSS - high sea sale",
     "type": "select",
     "required": true,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "provFinal",
     "label": "12. PROV / FINAL assessment",
     "type": "select",
     "required": true,
     "help": "F = final, P = provisional assessment.",
     "options": [
      "F",
      "P"
     ]
    }
   ]
  },
  {
   "after": "party",
   "docSimStep": 3,
   "key": "ig3",
   "title": "Importer Details",
   "fields": [
    {
     "name": "branchSerialNo",
     "label": "Branch Serial Number",
     "type": "text",
     "required": true,
     "placeholder": "01",
     "pattern": "^\\d{1,3}$",
     "patternMsg": "Branch serial number must be 1–3 digits."
    },
    {
     "name": "adCode",
     "label": "Authorized Dealer (AD) Code",
     "type": "text",
     "required": true,
     "placeholder": "0123456",
     "pattern": "^\\d{7}$",
     "patternMsg": "AD Code must be exactly 7 digits.",
     "help": "The 7-digit code assigned by the importer's bank branch, mandatory for remitting payment abroad."
    },
    {
     "name": "chaDetails",
     "label": "CHA (Customs Broker) Details",
     "type": "text",
     "required": true,
     "placeholder": "Mumbai Customs House Agency Pvt. Ltd., Licence 11/1234"
    },
    {
     "name": "importerCategory",
     "label": "Importer Category",
     "type": "select",
     "required": true,
     "options": [
      "Individual",
      "Proprietorship",
      "Partnership",
      "Private Limited",
      "Public Limited",
      "EOU",
      "SEZ Unit",
      "Government"
     ]
    },
    {
     "name": "cbCode",
     "label": "CB Code",
     "type": "text",
     "required": true,
     "placeholder": "AAGCC0275LCH001",
     "help": "Customs Broker (CHA) licence code - printed as 'CB CODE' in the header. The CB name is the CHA details above."
    },
    {
     "name": "gstinType",
     "label": "GSTIN Type",
     "type": "select",
     "required": false,
     "help": "Printed after the GSTIN in the header (G = GSTIN).",
     "options": [
      "G",
      "T",
      "U"
     ]
    },
    {
     "name": "aeoStatus",
     "label": "Importer AEO Status",
     "type": "text",
     "required": false
    },
    {
     "name": "ucr",
     "label": "UCR - Unique Consignment Reference",
     "type": "text",
     "required": false
    }
   ]
  },
  {
   "after": "invoice",
   "docSimStep": 4,
   "key": "ig4",
   "title": "Supplier & Invoice Details",
   "fields": [
    {
     "name": "poNumber",
     "label": "Purchase Order Number",
     "type": "text",
     "required": true,
     "uppercase": true,
     "placeholder": "PO-88213"
    },
    {
     "name": "lcNumber",
     "label": "Letter of Credit Number (if applicable)",
     "type": "text",
     "required": false,
     "uppercase": true,
     "placeholder": "LC/2026/00981"
    },
    {
     "name": "exchangeRate",
     "label": "Exchange Rate",
     "type": "number",
     "required": true,
     "placeholder": "90.10",
     "pattern": "^\\d+(\\.\\d{1,2})?$",
     "patternMsg": "Enter a valid non-negative number (up to 2 decimal places).",
     "help": "The Customs-notified exchange rate in effect on the date of filing, used to convert the invoice value to INR for duty assessment."
    },
    {
     "name": "loadingCharges",
     "label": "Loading Charges",
     "type": "number",
     "required": false,
     "placeholder": "70.00",
     "pattern": "^\\d+(\\.\\d{1,2})?$",
     "patternMsg": "Enter a valid non-negative number (up to 2 decimal places).",
     "help": "Notional landing charges, typically added at a fixed percentage of CIF value where not separately known."
    },
    {
     "name": "discounts",
     "label": "Discounts",
     "type": "number",
     "required": false,
     "placeholder": "0.00",
     "pattern": "^\\d+(\\.\\d{1,2})?$",
     "patternMsg": "Enter a valid non-negative number (up to 2 decimal places)."
    },
    {
     "name": "sellerName",
     "label": "Seller's Name (if different from supplier)",
     "type": "text",
     "required": false
    },
    {
     "name": "sellerAddress",
     "label": "Seller's Address",
     "type": "textarea",
     "required": false,
     "full": true
    },
    {
     "name": "poDate",
     "label": "Purchase Order Date",
     "type": "date",
     "required": false
    },
    {
     "name": "lcDate",
     "label": "LC Date",
     "type": "date",
     "required": false
    },
    {
     "name": "contractNo",
     "label": "Contract No.",
     "type": "text",
     "required": false
    },
    {
     "name": "contractDate",
     "label": "Contract Date",
     "type": "date",
     "required": false
    },
    {
     "name": "thirdPartyName",
     "label": "Third Party Name",
     "type": "text",
     "required": false
    },
    {
     "name": "thirdPartyAddress",
     "label": "Third Party Address",
     "type": "textarea",
     "required": false,
     "full": true
    },
    {
     "name": "supplierAeo",
     "label": "Supplier AEO Status",
     "type": "text",
     "required": false
    },
    {
     "name": "commissionAmt",
     "label": "Commission (invoice currency)",
     "type": "number",
     "required": false
    },
    {
     "name": "hssAmt",
     "label": "High Sea Sale Amount",
     "type": "number",
     "required": false
    },
    {
     "name": "valuationMethod",
     "label": "Valuation Method",
     "type": "select",
     "required": false,
     "help": "Customs Valuation Rules, 2007 - the rule under which the assessable value is determined.",
     "options": [
      "RULE 3 (TRANSACTION VALUE)",
      "RULE 4 (IDENTICAL GOODS)",
      "RULE 5 (SIMILAR GOODS)",
      "RULE 7 (DEDUCTIVE VALUE)",
      "RULE 8 (COMPUTED VALUE)",
      "RULE 9 (RESIDUAL METHOD)"
     ]
    },
    {
     "name": "relatedParty",
     "label": "Related Buyer & Seller (RELTD)",
     "type": "select",
     "required": false,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "svbCh",
     "label": "SVB Check (SVB CH)",
     "type": "select",
     "required": false,
     "options": [
      "N",
      "Y"
     ]
    },
    {
     "name": "svbNo",
     "label": "SVB No.",
     "type": "text",
     "required": false
    },
    {
     "name": "svbDate",
     "label": "SVB Date",
     "type": "date",
     "required": false
    },
    {
     "name": "loa",
     "label": "Letter of Assessment (LOA)",
     "type": "select",
     "required": false,
     "options": [
      "N",
      "Y"
     ]
    }
   ]
  },
  {
   "after": "invoice",
   "docSimStep": 5,
   "key": "ig5",
   "title": "Cost & Services (Valuation Adjustments)",
   "fields": [
    {
     "name": "cbAmt",
     "label": "1. C&B - commission & brokerage",
     "type": "number",
     "required": false
    },
    {
     "name": "cocAmt",
     "label": "2. CoC - cost of container",
     "type": "number",
     "required": false
    },
    {
     "name": "copAmt",
     "label": "3. CoP - cost of packing",
     "type": "number",
     "required": false
    },
    {
     "name": "hndChg",
     "label": "4. HND CHG - handling charges",
     "type": "number",
     "required": false
    },
    {
     "name": "gsAmt",
     "label": "5. G&S - goods & services input cost",
     "type": "number",
     "required": false
    },
    {
     "name": "docChg",
     "label": "6. DOC CH - document charges",
     "type": "number",
     "required": false
    },
    {
     "name": "cooChg",
     "label": "7. COO - country of origin certificate",
     "type": "number",
     "required": false
    },
    {
     "name": "rlfAmt",
     "label": "8. R&LF - royalty & licence fees",
     "type": "number",
     "required": false
    },
    {
     "name": "othCost",
     "label": "9. OTH COST - other costs",
     "type": "number",
     "required": false
    },
    {
     "name": "ldUld",
     "label": "10. LD / ULD - loading / unloading charges",
     "type": "number",
     "required": false
    },
    {
     "name": "wsAmt",
     "label": "11. WS - warranty services",
     "type": "number",
     "required": false
    },
    {
     "name": "otcAmt",
     "label": "12. OTC - other costs",
     "type": "number",
     "required": false
    },
    {
     "name": "miscCharge",
     "label": "13. MISC CHARGE",
     "type": "number",
     "required": false
    }
   ]
  },
  {
   "after": "items",
   "docSimStep": 7,
   "key": "ig7",
   "title": "Item Compliance & Duty Notifications",
   "fields": [
    {
     "name": "itemCompliance",
     "label": "Item Compliance Flags (Part III - A)",
     "type": "table",
     "required": true,
     "help": "FS / PQ / DC / WC / AQ = Food-Safety, Plant-Quarantine, Drugs, Wildlife and Animal-Quarantine clearance needed (Y/N). Leave the rest as N unless the item needs it.",
     "requiredCols": [
      "itemNo",
      "ceth",
      "coo"
     ],
     "addLabel": "Add Item Row",
     "columns": [
      {
       "key": "itemNo",
       "label": "Item No.",
       "placeholder": "1",
       "numeric": true
      },
      {
       "key": "ceth",
       "label": "CETH (central excise tariff head)",
       "placeholder": "NOEXCISE"
      },
      {
       "key": "fs",
       "label": "FS (Y/N)",
       "placeholder": "N"
      },
      {
       "key": "pq",
       "label": "PQ (Y/N)",
       "placeholder": "N"
      },
      {
       "key": "dc",
       "label": "DC (Y/N)",
       "placeholder": "N"
      },
      {
       "key": "wc",
       "label": "WC (Y/N)",
       "placeholder": "N"
      },
      {
       "key": "aq",
       "label": "AQ (Y/N)",
       "placeholder": "N"
      },
      {
       "key": "coo",
       "label": "Country of Origin Code",
       "placeholder": "KR"
      },
      {
       "key": "sQty",
       "label": "Standard Qty",
       "placeholder": "105000",
       "numeric": true
      },
      {
       "key": "sUqc",
       "label": "Standard UQC",
       "placeholder": "KGS"
      },
      {
       "key": "schCode",
       "label": "Scheme Code",
       "placeholder": ""
      },
      {
       "key": "stndPr",
       "label": "STND/PR",
       "placeholder": "S"
      },
      {
       "key": "rsp",
       "label": "RSP (Y/N)",
       "placeholder": "N"
      },
      {
       "key": "reimpFlag",
       "label": "REIMP (Y/N)",
       "placeholder": "N"
      },
      {
       "key": "prov",
       "label": "PROV",
       "placeholder": ""
      },
      {
       "key": "prodn",
       "label": "PRODN (Y/N)",
       "placeholder": "N"
      },
      {
       "key": "cntrl",
       "label": "CNTRL (Y/N)",
       "placeholder": "N"
      },
      {
       "key": "qualfr",
       "label": "QUALFR (Y/N)",
       "placeholder": "Y"
      },
      {
       "key": "contnt",
       "label": "CONTNT (Y/N)",
       "placeholder": "N"
      },
      {
       "key": "stmnt",
       "label": "STMNT (Y/N)",
       "placeholder": "Y"
      },
      {
       "key": "supDocs",
       "label": "SUP DOCS (Y/N)",
       "placeholder": "N"
      }
     ],
     "itemAligned": true
    },
    {
     "name": "itemDutyRates",
     "label": "Duty Rates & Notifications (Part III - B / C)",
     "type": "table",
     "required": false,
     "help": "Rates are percentages. Notification numbers are the exemption notifications under which the concessional rate is claimed. Duty Foregone is the duty saved by the exemption.",
     "addLabel": "Add Duty Row",
     "columns": [
      {
       "key": "itemNo",
       "label": "Item No.",
       "placeholder": "1",
       "numeric": true
      },
      {
       "key": "bcdNotnNo",
       "label": "BCD Notn No.",
       "placeholder": "050/2017"
      },
      {
       "key": "bcdNotnSno",
       "label": "BCD Notn S.No.",
       "placeholder": "267"
      },
      {
       "key": "bcdRatePct",
       "label": "BCD Rate (%)",
       "placeholder": "7.5",
       "numeric": true
      },
      {
       "key": "bcdDutyFg",
       "label": "BCD Duty Foregone",
       "placeholder": "230193.8",
       "numeric": true
      },
      {
       "key": "swsRatePct",
       "label": "SWS Rate (%)",
       "placeholder": "10",
       "numeric": true
      },
      {
       "key": "igstNotnNo",
       "label": "IGST Notn No.",
       "placeholder": "001/2017"
      },
      {
       "key": "igstNotnSno",
       "label": "IGST Notn S.No.",
       "placeholder": "III100"
      },
      {
       "key": "igstRatePct",
       "label": "IGST Rate (%)",
       "placeholder": "18",
       "numeric": true
      },
      {
       "key": "gcessNotnNo",
       "label": "G.Cess Notn No.",
       "placeholder": ""
      },
      {
       "key": "gcessNotnSno",
       "label": "G.Cess Notn S.No.",
       "placeholder": ""
      },
      {
       "key": "gcessRatePct",
       "label": "G.Cess Rate (%)",
       "placeholder": "0",
       "numeric": true
      },
      {
       "key": "caidcNotnNo",
       "label": "CAIDC Notn No.",
       "placeholder": ""
      },
      {
       "key": "caidcNotnSno",
       "label": "CAIDC Notn S.No.",
       "placeholder": ""
      },
      {
       "key": "caidcRatePct",
       "label": "CAIDC Rate (%)",
       "placeholder": "",
       "numeric": true
      },
      {
       "key": "caidcDutyFg",
       "label": "CAIDC Duty Foregone",
       "placeholder": "",
       "numeric": true
      }
     ],
     "itemAligned": true
    }
   ]
  },
  {
   "after": "containers",
   "docSimStep": 8,
   "key": "ig8",
   "title": "Container & Package Details",
   "fields": [
    {
     "name": "warehouseDetails",
     "label": "Warehouse Details (if applicable)",
     "type": "textarea",
     "required": false,
     "placeholder": "Bonded warehouse name, licence number, and location where goods are being stored pending clearance.",
     "full": true,
     "showIf": "d=>d.beType===\"Warehouse\"||d.beType===\"Ex-Bond\""
    }
   ]
  },
  {
   "after": "manifest",
   "docSimStep": 9,
   "key": "ig9",
   "title": "Manifest, Bond & Warehouse Details",
   "fields": [
    {
     "name": "blAwbDate",
     "label": "MAWB / MBL Date",
     "type": "date",
     "required": false,
     "help": "Date of the master airway bill / bill of lading (printed next to the MAWB number)."
    },
    {
     "name": "hawbNo",
     "label": "HAWB / HBL No.",
     "type": "text",
     "required": false
    },
    {
     "name": "hawbDate",
     "label": "HAWB / HBL Date",
     "type": "date",
     "required": false
    },
    {
     "name": "gigmNo",
     "label": "Gateway IGM No. (GIGM)",
     "type": "text",
     "required": false
    },
    {
     "name": "gigmDate",
     "label": "Gateway IGM Date",
     "type": "date",
     "required": false
    },
    {
     "name": "bondNo",
     "label": "Bond No.",
     "type": "text",
     "required": false
    },
    {
     "name": "bondPort",
     "label": "Bond Port",
     "type": "text",
     "required": false
    },
    {
     "name": "bondCd",
     "label": "Bond Code",
     "type": "text",
     "required": false
    },
    {
     "name": "bondDebtAmt",
     "label": "Debt Amount",
     "type": "number",
     "required": false
    },
    {
     "name": "bgAmt",
     "label": "Bank Guarantee Amount",
     "type": "number",
     "required": false
    },
    {
     "name": "wbeNo",
     "label": "Warehouse BE No.",
     "type": "text",
     "required": false
    },
    {
     "name": "wbeDate",
     "label": "Warehouse BE Date",
     "type": "date",
     "required": false
    },
    {
     "name": "wbeSite",
     "label": "WBE Site",
     "type": "text",
     "required": false
    },
    {
     "name": "whCode",
     "label": "Warehouse Code",
     "type": "text",
     "required": false
    }
   ]
  },
  {
   "after": "assessment",
   "docSimStep": 10,
   "key": "ig10",
   "title": "Duty & Payment Details",
   "fields": [
    {
     "name": "safeguardTotal",
     "label": "Safeguard Duty",
     "type": "number",
     "required": false,
     "placeholder": "0.00",
     "pattern": "^\\d+(\\.\\d{1,2})?$",
     "patternMsg": "Enter a valid non-negative number (up to 2 decimal places)."
    },
    {
     "name": "interest",
     "label": "Interest",
     "type": "number",
     "required": false,
     "placeholder": "0.00",
     "pattern": "^\\d+(\\.\\d{1,2})?$",
     "patternMsg": "Enter a valid non-negative number (up to 2 decimal places)."
    },
    {
     "name": "fine",
     "label": "Fine",
     "type": "number",
     "required": false,
     "placeholder": "0.00",
     "pattern": "^\\d+(\\.\\d{1,2})?$",
     "patternMsg": "Enter a valid non-negative number (up to 2 decimal places)."
    },
    {
     "name": "penalty",
     "label": "Penalty",
     "type": "number",
     "required": false,
     "placeholder": "0.00",
     "pattern": "^\\d+(\\.\\d{1,2})?$",
     "patternMsg": "Enter a valid non-negative number (up to 2 decimal places)."
    },
    {
     "name": "deferredDutyDetails",
     "label": "Deferred Duty Details (if applicable)",
     "type": "textarea",
     "required": false,
     "placeholder": "AEO/DPE authorization details and the deferred payment due date.",
     "full": true,
     "showIf": "d=>d.paymentMethod===\"Deferred Payment\""
    },
    {
     "name": "acdTotal",
     "label": "Additional Customs Duty (ACD)",
     "type": "number",
     "required": false
    },
    {
     "name": "nccdTotal",
     "label": "NCCD",
     "type": "number",
     "required": false
    },
    {
     "name": "cvdTotal",
     "label": "Countervailing Duty (CVD)",
     "type": "number",
     "required": false
    },
    {
     "name": "saedTotal",
     "label": "SAED",
     "type": "number",
     "required": false
    },
    {
     "name": "gsiaTotal",
     "label": "GSIA",
     "type": "number",
     "required": false
    },
    {
     "name": "ttaTotal",
     "label": "TTA",
     "type": "number",
     "required": false
    },
    {
     "name": "healthTotal",
     "label": "Health Cess",
     "type": "number",
     "required": false
    }
   ]
  },
  {
   "after": "assessment",
   "docSimStep": 11,
   "key": "ig11",
   "title": "Additional Details (Part IV)",
   "fields": [
    {
     "name": "previousBes",
     "label": "Previous Bills of Entry (Part IV - B)",
     "type": "table",
     "required": false,
     "addLabel": "Add Previous BE",
     "columns": [
      {
       "key": "invsno",
       "label": "Inv S.No.",
       "placeholder": "1"
      },
      {
       "key": "itmsno",
       "label": "Item S.No.",
       "placeholder": "1"
      },
      {
       "key": "beNo",
       "label": "BE No.",
       "placeholder": ""
      },
      {
       "key": "beDate",
       "label": "BE Date",
       "placeholder": "2024-05-02"
      },
      {
       "key": "prtCd",
       "label": "Port Code",
       "placeholder": "INCCU1"
      },
      {
       "key": "unitPrice",
       "label": "Unit Price",
       "placeholder": ""
      },
      {
       "key": "currencyCode",
       "label": "Currency",
       "placeholder": "USD"
      }
     ],
     "itemAligned": false
    },
    {
     "name": "mfrDetails",
     "label": "Manufacturer / Producer / Grower (Part IV - D)",
     "type": "table",
     "required": false,
     "addLabel": "Add Manufacturer Row",
     "columns": [
      {
       "key": "invsno",
       "label": "Inv S.No.",
       "placeholder": "1"
      },
      {
       "key": "itmsno",
       "label": "Item S.No.",
       "placeholder": "1"
      },
      {
       "key": "type",
       "label": "Type",
       "placeholder": "M"
      },
      {
       "key": "manufactCd",
       "label": "Manufacturer Code",
       "placeholder": ""
      },
      {
       "key": "sourceCy",
       "label": "Source Country",
       "placeholder": "KR"
      },
      {
       "key": "transCy",
       "label": "Trans Country",
       "placeholder": ""
      },
      {
       "key": "address",
       "label": "Address",
       "placeholder": ""
      }
     ],
     "itemAligned": false
    },
    {
     "name": "beLicences",
     "label": "Licence Details (Part IV - F)",
     "type": "table",
     "required": false,
     "help": "For imports under Advance Authorisation, EPCG or other licences.",
     "addLabel": "Add Licence Row",
     "columns": [
      {
       "key": "invsno",
       "label": "Inv S.No.",
       "placeholder": "1"
      },
      {
       "key": "itmsno",
       "label": "Item S.No.",
       "placeholder": "1"
      },
      {
       "key": "licSlno",
       "label": "Licence S.No.",
       "placeholder": "1"
      },
      {
       "key": "licNo",
       "label": "Licence No.",
       "placeholder": ""
      },
      {
       "key": "licDate",
       "label": "Licence Date",
       "placeholder": "2024-01-15"
      },
      {
       "key": "code",
       "label": "Code",
       "placeholder": ""
      },
      {
       "key": "port",
       "label": "Port",
       "placeholder": ""
      },
      {
       "key": "debitValue",
       "label": "Debit Value",
       "placeholder": "",
       "numeric": true
      },
      {
       "key": "qty",
       "label": "Qty",
       "placeholder": "",
       "numeric": true
      },
      {
       "key": "uqc",
       "label": "UQC",
       "placeholder": ""
      },
      {
       "key": "debitDuty",
       "label": "Debit Duty",
       "placeholder": "",
       "numeric": true
      }
     ],
     "itemAligned": false
    },
    {
     "name": "beCertificates",
     "label": "Certificate Details (Part IV - G)",
     "type": "table",
     "required": false,
     "addLabel": "Add Certificate",
     "columns": [
      {
       "key": "certNo",
       "label": "Certificate Number",
       "placeholder": ""
      },
      {
       "key": "certDate",
       "label": "Date",
       "placeholder": "2024-05-02"
      },
      {
       "key": "certType",
       "label": "Type",
       "placeholder": ""
      }
     ],
     "itemAligned": false
    },
    {
     "name": "swdLines",
     "label": "Single Window Declaration (Part IV - I)",
     "type": "table",
     "required": false,
     "help": "Additional qualifiers required by other-government-agency rules - e.g. SQC (standard quantity), CPC (commodity product code), IUP (IUPAC name) and CAS (CAS number) for chapter 28/29/32/39 goods.",
     "addLabel": "Add Single Window Row",
     "columns": [
      {
       "key": "invsn",
       "label": "Inv S.No.",
       "placeholder": "1"
      },
      {
       "key": "itmsn",
       "label": "Item S.No.",
       "placeholder": "1"
      },
      {
       "key": "infoTyp",
       "label": "Info Type",
       "placeholder": "CHR"
      },
      {
       "key": "qualifier",
       "label": "Qualifier",
       "placeholder": "SQC"
      },
      {
       "key": "infoCd",
       "label": "Info Code",
       "placeholder": ""
      },
      {
       "key": "infoText",
       "label": "Info Text",
       "placeholder": ""
      },
      {
       "key": "infoMsr",
       "label": "Info Measure",
       "placeholder": "105000"
      },
      {
       "key": "uqc",
       "label": "UQC",
       "placeholder": "KGS"
      }
     ],
     "itemAligned": false
    }
   ]
  },
  {
   "after": "assessment",
   "docSimStep": 12,
   "key": "ig12",
   "title": "Other Compliances (Part V)",
   "fields": [
    {
     "name": "compulsoryCompliance",
     "label": "Compulsory Compliance Instructions",
     "type": "textarea",
     "required": false,
     "help": "Mandatory compliance requirements / examination instructions shown against the CTH.",
     "full": true
    },
    {
     "name": "acRemarks",
     "label": "AC Remarks",
     "type": "textarea",
     "required": false,
     "full": true
    },
    {
     "name": "superintendentComments",
     "label": "Superintendent Comments",
     "type": "textarea",
     "required": false,
     "full": true
    }
   ]
  },
  {
   "after": "documents",
   "docSimStep": 13,
   "key": "ig13",
   "title": "Declaration & Submission",
   "fields": [
    {
     "name": "declarationBy",
     "label": "Declaration By",
     "type": "select",
     "required": true,
     "options": [
      "Importer",
      "CHA on behalf of Importer"
     ]
    },
    {
     "name": "signatoryName",
     "label": "Signatory Name",
     "type": "text",
     "required": true,
     "placeholder": "Priya Sharma"
    },
    {
     "name": "signatoryDesignation",
     "label": "Signatory Designation",
     "type": "text",
     "required": true,
     "placeholder": "Authorized CHA Signatory"
    },
    {
     "name": "declPlace",
     "label": "Place of Declaration",
     "type": "text",
     "required": false,
     "placeholder": "Kolkata",
     "help": "Printed in Part VI (Declaration)."
    },
    {
     "name": "declDate",
     "label": "Date of Declaration",
     "type": "date",
     "required": false
    }
   ]
  }
 ]
};
