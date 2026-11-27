/* =========================================================================
   OCEAN BILL OF LADING — extra fields for the standard printed B/L
   -------------------------------------------------------------------------
   The sea Bill of Lading exercise already collects the whole lifecycle (booking
   to cargo release).  A printed ocean B/L (see bill-of-lading-forms.js) also
   carries a few boxes the exercise never asked for: pre-carriage, final
   destination, where freight is payable, declared value, movement type and the
   capacity in which the B/L is signed.  They are added here to the existing
   steps (no new steps, so STEP_COUNTS is unchanged) and are all optional or
   have a sensible blank, so existing in-progress Bills of Lading stay valid.
   Loaded after documents-data.js and before engine.js.
   ========================================================================= */
(function(){
  "use strict";
  if(typeof DOCUMENT_CONFIGS === "undefined") return;
  const BL = DOCUMENT_CONFIGS["bill-of-lading-sea"];
  if(!BL || BL.__printExtended) return;
  BL.__printExtended = true;

  /* Bill of Lading Number is assigned automatically, exactly as a carrier's system does it: the carrier's 4-letter
     SCAC code + year + month + a running serial (e.g. MAEU2610000123). The SCAC follows the carrier chosen on the Job
     (txn.carrierName) when there is one, otherwise a neutral SKEL prefix. The student can still overwrite the value. */
  const SCAC = [[/maersk/i,"MAEU"],[/\b(msc|mediterranean)/i,"MEDU"],[/cma\s*cgm/i,"CMDU"],[/cosco/i,"COSU"],[/hapag/i,"HLCU"],[/\bone\b|ocean network/i,"ONEY"],[/evergreen/i,"EGLV"],[/oocl|orient overseas/i,"OOLU"],[/\bzim\b/i,"ZIMU"],[/yang\s*ming/i,"YMLU"],[/\bhmm\b|hyundai/i,"HDMU"],[/\bpil\b|pacific international/i,"PCIU"]];
  function generateBlNumber(userId){
    let carrier = "";
    try{ const c = typeof skGetTransactionContext === "function" ? skGetTransactionContext(userId) : null; carrier = (c && c["txn.carrierName"] && c["txn.carrierName"].value) || ""; }catch(e){}
    const hit = SCAC.find(x => x[0].test(carrier));
    const d = new Date();
    const serial = (typeof skNextSeq === "function") ? skNextSeq(userId, "bill-of-lading-sea:blNumber") : Math.floor(Math.random()*900000)+100000;
    return (hit ? hit[1] : "SKEL") + String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,"0") + String(serial).padStart(6,"0");
  }
  (function(){
    for(const st of BL.steps){ const f = (st.fields||[]).find(x => x.name === "blNumber"); if(f){ f.autoGenerate = true; f.autoGenerateWith = generateBlNumber; f.help = (f.help ? f.help + " " : "") + "Generated automatically (carrier code + year/month + serial) - overwrite it only if your exercise gives you a specific B/L number."; return; } }
  })();

  const F = (type, name, label, extra) => Object.assign({name, label, type, required:false}, extra||{});
  const addFields = (title, fields) => {
    const s = BL.steps.find(x => x.title === title);
    if(s) s.fields.push.apply(s.fields, fields); else console.warn("[bill-of-lading-forms-config] step not found:", title);
  };

  addFields("Carrier, Vessel & Routing", [
    F("text","preCarriageBy","Pre-Carriage By",{placeholder:"Truck / Rail / Feeder vessel (leave blank for port-to-port)",help:"Box 'Pre-carriage by' on the printed B/L - the mode that brings the cargo from the place of receipt to the port of loading."}),
    F("text","finalDestination","Final Destination (for the Merchant's reference)",{placeholder:"e.g. Hamburg CFS",help:"Box 'Final destination' - printed for the merchant's reference only; the carrier's responsibility ends at the place of delivery."})
  ]);
  addFields("Container Stuffing & Sealing", [
    F("select","movementType","Movement Type (Service)",{options:["FCL/FCL - CY/CY","FCL/LCL - CY/CFS","LCL/FCL - CFS/CY","LCL/LCL - CFS/CFS"],help:"Printed in the cargo box, e.g. 'FCL/FCL - CY/CY  SHIPPER'S LOAD, COUNT & SEAL'."})
  ]);
  addFields("Freight, Charges & Incoterms", [
    F("text","freightPayableAt","Freight Payable At",{placeholder:"e.g. Mumbai (prepaid) / Hamburg (collect)",help:"Box 'Freight payable at' on the B/L. Prepaid freight is payable at origin, collect freight at destination."}),
    F("number","declaredValue","Declared Value of Goods (optional)",{help:"Only if the shipper wants to declare a value above the carrier's package limitation (ad valorem freight). Leave blank otherwise."}),
    F("number","exchangeRateBl","Ex. Rate (charges currency to local)",{help:"Printed in the 'Ex. Rate' column of the freight & charges table."})
  ]);
  addFields("Final B/L Issuance & Signature", [
    F("select","signingCapacity","Signed For The Carrier",{options:["As Carrier","As Agent for the Carrier","As Master"],help:"The capacity in which the B/L is signed. A B/L signed by an agent must name the carrier."}),
    F("text","onBoardNotation","On-Board Notation (optional)",{placeholder:"e.g. SHIPPED ON BOARD - 'CLEAN ON BOARD'",help:"An extra remark placed beside the shipped-on-board stamp, if the carrier adds one."})
  ]);
})();
