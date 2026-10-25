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
