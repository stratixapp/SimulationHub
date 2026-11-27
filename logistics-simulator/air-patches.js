/* =========================================================================
   air-patches.js — Air Freight corrections to the shared document catalog.
   Loaded right after documents-data.js (dashboard + workstation).

   WHY A SEPARATE FILE
   documents-data.js is ~18,000 lines of hand-written document definitions.
   Most documents are shared between Sea and Air, and a few Air documents
   never listened to the Job's flight details. Rather than hand-edit dozens
   of places in that file, every Air-related correction lives here, in three
   plain tables, applied by three small functions at the bottom:

   1. SK_DOC_PATCHES        applied ONCE at load, for every Job and for the
                            Document Library. Wiring fields to the Job's
                            flight details (so the Air Waybill, ULD Manifest
                            etc. fill themselves), IATA-pattern fixes, and the
                            new Aircraft Type / Registration fields.
   2. SK_AIR_MODE_PATCHES   applied ONLY while the student's active Job is
                            Air Export / Air Import (engine.js boot). Turns the
                            sea wording of shared documents into air wording
                            (Vessel -> Airline / Flight, B/L -> Air Waybill,
                            Container -> ULD) and stops forcing container /
                            seal / IMO / B-L fields that an air shipment
                            simply doesn't have.
   3. SK_AIR_REVIEW_SWAPS   label swaps for the hand-coded "Review Document"
                            page of those shared documents, same condition.

   A patch names a field by its `name`. A name that no longer exists is
   skipped with a console warning rather than throwing, so a future edit to
   documents-data.js can never take the whole app down.
   ========================================================================= */

const SK_AIRCRAFT_REG_PATTERN = "^[A-Z0-9]{1,2}-?[A-Z0-9]{2,5}$";
const SK_AIRCRAFT_REG_MSG = "Aircraft registration looks like VT-AIX, A6-EPA or N123FX.";
// A flight designator is a 2-character airline code (letters or digits: LH, 6E, D0) + 1-4 digits.
// The old pattern only allowed two LETTERS, which rejected real IndiGo (6E) / DHL (D0) / Silk Way (7L) flights.
const SK_FLIGHT_NO_PATTERN = "^[A-Z0-9]{2}\\d{1,4}$";
const SK_AIRLINE_CODE_PATTERN = "^[A-Z0-9]{2}$";

/* ---- 1. always applied ---- */
const SK_DOC_PATCHES = {
  "air-waybill": {
    fields: {
      airlinePrefix: {contextKey: "txn.airlinePrefix",
        help: "The 3-digit code IATA assigns to each airline — e.g. 020 (Lufthansa Cargo), 098 (Air India), 125 (British Airways). Filled in from the flight on your Job when it is one of the listed airlines."},
      airlineName:   {contextKey: "txn.carrierName"},
      firstCarrier:  {contextKey: "txn.airlineCode", pattern: SK_AIRLINE_CODE_PATTERN, patternMsg: "Enter a valid 2-character IATA airline code, e.g. LH or 6E."},
      // Final Carrier and Routing are deliberately NOT tied to the Job: on a connecting journey the last carrier is legitimately a
      // different airline and the routing lists transfer airports, so a Job-derived value would raise false cross-document mismatches.
      finalCarrier:  {pattern: SK_AIRLINE_CODE_PATTERN, patternMsg: "Enter a valid 2-character IATA airline code, e.g. LH or 6E."},
      flightNumber:  {contextKey: "txn.voyageNo", pattern: SK_FLIGHT_NO_PATTERN, patternMsg: "Enter a valid flight number, e.g. LH756 or 6E512."},
      flightDate:    {contextKey: "txn.flightDate"}
    }
  },
  "uld-manifest": {
    fields: {
      flightNumber: {contextKey: "txn.voyageNo"},
      flightDate:   {contextKey: "txn.flightDate"}
    },
    addAfter: {
      flightDate: [
        {name: "aircraftType", contextKey: "txn.aircraftType", label: "Aircraft Type", type: "text", required: false,
         placeholder: "Boeing 777F", help: "The aircraft the ULDs are loaded onto. Optional."},
        {name: "aircraftRegistration", contextKey: "txn.aircraftRegistration", label: "Aircraft Registration", type: "text", required: false,
         uppercase: true, placeholder: "A6-EFA", pattern: SK_AIRCRAFT_REG_PATTERN, patternMsg: SK_AIRCRAFT_REG_MSG,
         help: "The tail number painted on the aircraft. Optional."}
      ]
    },
    review: function(html, d){
      const carrier = '<div class="dv">' + (d.carrierName || "—") + '</div>';
      if(!html.includes(carrier)) return html;
      const extra = (d.aircraftType || d.aircraftRegistration)
        ? dline("Aircraft", d.aircraftType) + dline("Registration", d.aircraftRegistration) : "";
      return html.replace(carrier, '<div class="dv">' + (d.carrierName || "—") + extra + '</div>');
    }
  },
  "air-freight-invoice": {fields: {flightNo: {contextKey: "txn.voyageNo"}}},
  // "Mode of Transport" dropdowns: filled from the Job's Shipment Mode (job-engine.js, txn.transportMode & friends)
  "commercial-invoice":           {fields: {modeTransport: {contextKey: "txn.transportMode"}}},
  "packing-list":                 {fields: {modeOfTransport: {contextKey: "txn.transportMode"}}},
  "bill-of-entry":                {fields: {modeOfTransport: {contextKey: "txn.transportMode"}, vesselFlightDetails: {contextKey: "txn.vesselFlightDetails"}}},
  "import-invoice":               {fields: {modeOfTransport: {contextKey: "txn.transportMode"}}},
  "insurance-certificate":        {fields: {modeOfTransportIns: {contextKey: "txn.transportMode"}, vesselFlightVehicle: {contextKey: "txn.vesselFlightDetails"}}},
  "forwarders-cargo-receipt":     {fields: {modeOfTransportFCR: {contextKey: "txn.transportMode"}}},
  "letter-of-credit":             {fields: {modeOfTransport: {contextKey: "txn.transportMode"}}},
  "proforma-invoice":             {fields: {modeOfTransport: {contextKey: "txn.transportMode"}}},
  "sales-order":                  {fields: {transportMode: {contextKey: "txn.transportMode"}}},
  "purchase-order":               {fields: {shipVia: {contextKey: "txn.transportModeFreight"}}},
  "security-declaration":         {fields: {shipmentType: {contextKey: "txn.shipmentTypeAir"}}},
  // One free-text "<vessel or airline> / <voyage or flight>" box in three documents — built from the Job.
  "dangerous-goods-declaration":  {fields: {vesselFlightDetails: {contextKey: "txn.vesselFlightDetails"}, transportMode: {contextKey: "txn.transportModeDG"}}}
};

/* ---- 2. only while the active Job is Air Export / Air Import ---- */
const SK_HIDDEN = {hidden: true};   // not shown, not validated: the field has no meaning on an aircraft
const SK_NOT_AN_AIR_FIELD = {required: false};   // shorthand: the field exists but an air shipment has no such thing
const SK_AIR_MODE_PATCHES = {
  "cargo-manifest": {
    steps: {0: {title: "Manifest Reference & Aircraft Particulars"}, 1: {title: "Carrier / Airline Agent Details"}, 2: {title: "Airport & Customs Station Details"}, 3: {title: "Air Waybill Summary"}},
    fields: {
      vesselName:  {label: "Airline / Flight Name", placeholder: "Air India Cargo"},
      vesselImoNo: {label: "Aircraft Registration No.", placeholder: "VT-AIX", uppercase: true, contextKey: "txn.aircraftRegistration",
                    pattern: SK_AIRCRAFT_REG_PATTERN, patternMsg: "Enter the aircraft registration, e.g. VT-AIX or A6-EPA.",
                    help: "An aircraft has a registration (tail number), not a 7-digit IMO number — that is a ship identifier."},
      voyageNo:    {label: "Flight Number", placeholder: "AI508"},
      carrierName: {label: "Carrier / Airline Name", placeholder: "Air India Cargo"},
      agentName:   {label: "Airline / Ground Handling Agent Name"},
      portOfCall:  {label: "Airport of Call"},
      blSummary:   {label: "Air Waybill Summary", columns: {
                      blNo: {label: "AWB Number", placeholder: "098-12345678"},
                      blType: {label: "AWB Type", placeholder: "Master / House"},
                      containerNo: {label: "ULD (if any)", placeholder: "AKE12345AI"}}}
    }
  },
  "arrival-notice": {
    steps: {2: {title: "Flight Reference"}, 3: {title: "ULD & Cargo Details"}},
    fields: {
      vesselName: {label: "Airline / Flight Name", placeholder: "Air India Cargo"},
      voyageNo:   {label: "Flight No.", placeholder: "AI508"},
      blNumber:   {label: "Air Waybill No."},
      anContainers: {label: "ULDs / Packages (only if the cargo is on a ULD)", required: false, requiredCols: [],
                     columns: {containerNo: {label: "ULD No.", placeholder: "AKE12345AI"}, sealNo: {label: "Seal No. (if any)"}, sizeType: {label: "ULD Type", placeholder: "AKE (LD3)"}}},
      demurrageRatePerDay: {required: false, label: "Storage / Demurrage Rate (per day, per consignment)"}
    }
  },
  "delivery-order": {
    fields: {
      shippingLineName: {label: "Airline / Handling Agent Name"},
      blNumber:         {label: "Air Waybill Number"},
      voyageNumber:     {label: "Flight Number", placeholder: "AI508", pattern: "^[A-Z0-9]{2,10}$", patternMsg: "Flight number should be 2–10 letters/digits, e.g. AI508."},
      vesselName:       {label: "Airline / Flight Name", placeholder: "Air India Cargo"},
      blOriginalCopies: SK_HIDDEN, blEndorsed: SK_HIDDEN,   // an Air Waybill is non-negotiable: nothing to endorse, no "original copies" to surrender
      containerAvailabilityConfirmed: SK_HIDDEN,
      containers: {label: "ULD / Package Details", required: false, requiredCols: [], cellPatterns: {},
                   help: "Loose air cargo has no container — add a row only if the shipment travelled on a ULD.",
                   columns: {containerNo: {label: "ULD No.", placeholder: "AKE12345AI"}, sealNo: {label: "Seal No. (if any)"}, containerType: {label: "ULD Type", placeholder: "AKE (LD3)"}}}
    }
  },
  "shipping-instructions": {
    fields: {
      vesselName: {label: "Airline / Flight Name", placeholder: "Air India Cargo"},
      voyageNo:   {label: "Flight No.", placeholder: "AI508"},
      containerSizeType: SK_HIDDEN, numberOfContainers: SK_HIDDEN, stuffingLocation: SK_HIDDEN, blTypeRequested: SK_HIDDEN,
      numberOfOriginals: {required: false, label: "Number of Original AWB Copies"},
      imoClass: {required: false, label: "IATA DG Class"}
    }
  },
  "booking-confirmation": {
    steps: {1: {title: "Flight Nomination"}, 2: {title: "Uplift & Equipment Allocation"}},
    fields: {
      // sea-only machinery of a container booking: FCL/LCL, sailing loop, equipment types & the computed container rate table,
      // empty pick-up, VGM cut-off, reefer plug-in, roll-over to a new voyage
      serviceType: SK_HIDDEN, serviceLoopName: SK_HIDDEN, equipmentTypeRequested: SK_HIDDEN, equipmentType: SK_HIDDEN,
      availableContainersAndRates: SK_HIDDEN, containerReleaseOrderIssued: SK_HIDDEN, emptyPickupDepot: SK_HIDDEN, emptyPickupCutoff: SK_HIDDEN,
      tareWeight: SK_HIDDEN, reeferPlugInstructions: SK_HIDDEN, reeferPreCoolRequired: SK_HIDDEN, vgmCutoff: SK_HIDDEN,
      requestedSailingWindow: {label: "Requested Flight Window"},
      numberOfUnits: {label: "Number of Units (ULDs / pieces)"},
      bookedFreightRateUSD: {label: "Booked Air Freight Rate (USD)"},
      demurrageDetentionFreeTime: {label: "Storage / Free Time at Cargo Terminal"},
      gateInCutoff: {label: "Cargo Acceptance Cut-off"},
      reeferRequired: {label: "Temperature Controlled (Cool Chain)"},
      reeferTemperatureRange: {label: "Temperature Range"},
      imdgClassApproved: {label: "IATA DG Class Approved"},
      rolledToNextSailing: {label: "Offloaded / Moved to Next Flight"},
      newVesselVoyageAfterRoll: {label: "New Flight After Offload"}
    }
  },
  "letter-of-indemnity": {
    fields: {
      vesselName:     {label: "Airline / Flight Name", placeholder: "Air India Cargo"},
      blNo:           {label: "Air Waybill Number"},
      blDate:         {label: "Air Waybill Date"},
      portOfLoading:  {label: "Airport of Loading (per AWB)"},
      portOfDischarge:{label: "Airport of Discharge (per AWB)"}
    }
  },
  "customs-declaration": {fields: {flightNo: {contextKey: "txn.voyageNo"}}},
  "duty-calculation": {fields: {oceanFreight: {help: "For goods imported by air, customs counts the actual freight only up to 20% of the FOB value (Customs Valuation Rules 2007, Rule 10(2)) — this calculator applies that cap automatically."}}},
  "proforma-invoice":            {fields: {containerRequirement: SK_NOT_AN_AIR_FIELD}},
  "fumigation-certificate":      {fields: {temporarySealNo: SK_NOT_AN_AIR_FIELD, containerNumber: SK_NOT_AN_AIR_FIELD, sealNumber: SK_NOT_AN_AIR_FIELD}},
  "weight-certificate":          {fields: {containerNo: SK_NOT_AN_AIR_FIELD, containerTareWeight: SK_NOT_AN_AIR_FIELD}},
  "security-declaration":        {fields: {sealNumber: SK_NOT_AN_AIR_FIELD, destinationSealNumber: SK_NOT_AN_AIR_FIELD}},
  "dangerous-goods-declaration": {fields: {sealNo: SK_NOT_AN_AIR_FIELD, containerNo: SK_NOT_AN_AIR_FIELD}},
  "export-general-manifest":     {fields: {totalContainersEGM: SK_NOT_AN_AIR_FIELD}},
  "import-packing-list":         {fields: {containerNo: SK_NOT_AN_AIR_FIELD, sealNo: SK_NOT_AN_AIR_FIELD}},
  "examination-report":          {fields: {containerNo: SK_NOT_AN_AIR_FIELD, sealNoAsPerBL: SK_NOT_AN_AIR_FIELD, sealFoundIntact: SK_NOT_AN_AIR_FIELD, sealDiscrepancyNotes: SK_NOT_AN_AIR_FIELD}},
  "warehouse-receipt":           {fields: {sealNumberGate: SK_NOT_AN_AIR_FIELD, sealTypeGate: SK_NOT_AN_AIR_FIELD, sealIntegrityStatus: SK_NOT_AN_AIR_FIELD,
                                           sealExceptionDetails: SK_NOT_AN_AIR_FIELD, containerNoGate: SK_NOT_AN_AIR_FIELD, containerDamageDetails: SK_NOT_AN_AIR_FIELD}},
  "out-of-charge":               {fields: {containerNo: SK_NOT_AN_AIR_FIELD}}
};

/* ---- 3. review-page label swaps (Air Jobs only). Exact substrings of the rendered HTML:
   dline("Vessel", x) renders `...>Vessel:</b> x`, so a label is matched as `>Label:</b>`. ---- */
const SK_AIR_REVIEW_SWAPS = {
  "cargo-manifest": [
    ["<h4>Vessel / Voyage</h4>", "<h4>Aircraft / Flight</h4>"], [">Vessel:</b>", ">Airline / Flight:</b>"], [">IMO No.:</b>", ">Aircraft Reg.:</b>"], [">Voyage:</b>", ">Flight No.:</b>"],
    [">Steamer Agent:</b>", ">Handling Agent:</b>"], ["<h4>Port Details</h4>", "<h4>Airport Details</h4>"], [">Port of Call:</b>", ">Airport of Call:</b>"],
    [">Last/Next Port:</b>", ">Last/Next Airport:</b>"], [">Bill of Lading Summary</h4>", ">Air Waybill Summary</h4>"], ["<th>B/L No.</th>", "<th>AWB No.</th>"],
    ["<th>Container</th>", "<th>ULD</th>"], [">Total B/Ls:</b>", ">Total AWBs:</b>"]
  ],
  "arrival-notice": [
    [">B/L No.:</b>", ">AWB No.:</b>"], [">Vessel:</b>", ">Airline / Flight:</b>"], [">Voyage No.:</b>", ">Flight No.:</b>"], ["<h4>Vessel &amp; Voyage</h4>", "<h4>Flight Reference</h4>"],
    ["<th>Container No.</th>", "<th>ULD No.</th>"]
  ],
  "delivery-order": [
    [">B/L No.:</b>", ">AWB No.:</b>"], [">Shipping Line:</b>", ">Airline / Handling Agent:</b>"], [">Vessel / Voyage:</b>", ">Airline / Flight:</b>"],
    ["<h4>Shipping Line &amp; Reference</h4>", "<h4>Airline &amp; Reference</h4>"], ["<th>Container No.</th>", "<th>ULD No.</th>"]
  ],
  "shipping-instructions": [[">Vessel:</b>", ">Airline / Flight:</b>"], [">Voyage:</b>", ">Flight No.:</b>"]],
  "booking-confirmation": [[">Voyage:</b>", ">Flight No.:</b>"]]
};

/* ---------------------------------------------------------------------
   appliers
   --------------------------------------------------------------------- */
function _skFindDocField(cfg, name){
  for(const st of (cfg.steps || [])){
    for(const f of (st.fields || [])){ if(f && f.name === name) return {field: f, step: st}; }
  }
  return null;
}
function _skApplyFieldProps(field, props){
  Object.keys(props).forEach(k => {
    if(k === "hidden"){
      // hide = never rendered and skipped by validation (the engine's existing showIf hook) and never required
      if(props.hidden){ field.showIf = function(){ return false; }; field.required = false; }
    } else if(k === "columns" && props.columns && !Array.isArray(props.columns)){
      // per-column patch map {columnKey: {label, placeholder...}} — merged into the existing columns, nothing dropped
      (field.columns || []).forEach(col => { if(props.columns[col.key]) Object.assign(col, props.columns[col.key]); });
    } else {
      field[k] = props[k];
    }
  });
}
function _skApplyDocPatch(slug, patch){
  const cfg = (typeof DOCUMENT_CONFIGS !== "undefined") ? DOCUMENT_CONFIGS[slug] : null;
  if(!cfg || !patch) return;
  Object.keys(patch.fields || {}).forEach(name => {
    const hit = _skFindDocField(cfg, name);
    if(!hit){ try{ console.warn("[air-patches] " + slug + " has no field '" + name + "' — skipped"); }catch(e){} return; }
    _skApplyFieldProps(hit.field, patch.fields[name]);
  });
  Object.keys(patch.steps || {}).forEach(i => {
    const st = (cfg.steps || [])[Number(i)];
    if(st) Object.assign(st, patch.steps[i]);
  });
}

/* 1. once, at load */
(function skApplyAlwaysPatches(){
  if(typeof DOCUMENT_CONFIGS === "undefined") return;
  Object.keys(SK_DOC_PATCHES).forEach(slug => {
    const patch = SK_DOC_PATCHES[slug];
    _skApplyDocPatch(slug, patch);
    const cfg = DOCUMENT_CONFIGS[slug];
    if(!cfg) return;
    // new fields, inserted right after a named existing field (skipped if they already exist, so double-loading is harmless)
    Object.keys(patch.addAfter || {}).forEach(afterName => {
      const hit = _skFindDocField(cfg, afterName);
      if(!hit) return;
      const toAdd = patch.addAfter[afterName].filter(nf => !_skFindDocField(cfg, nf.name));
      if(toAdd.length){
        const idx = hit.step.fields.indexOf(hit.field);
        hit.step.fields.splice.apply(hit.step.fields, [idx + 1, 0].concat(toAdd.map(f => Object.assign({}, f))));
      }
    });
    // extended review page
    if(patch.review){
      const rv = (cfg.steps || []).find(st => typeof st.renderReview === "function");
      if(rv && !rv.__airPatched){
        const orig = rv.renderReview;
        rv.renderReview = function(d){ return patch.review(orig(d), d); };
        rv.__airPatched = true;
      }
    }
  });
})();


/* =========================================================================
   WORDING FOR SHARED DOCUMENTS  ("Sea / Flight")
   Most documents serve Sea AND Air but were written in sea words (Vessel, Voyage,
   Bill of Lading, Container, Port of Loading, Shipping Line...). The same field now
   reads differently depending on where the student is:
     - an AIR Job is active      -> pure air wording   (Airline / Flight, Air Waybill, ULD, Airport of Loading)
     - NO Job (Document Library) -> dual wording       (Vessel / Flight Name, Bill of Lading / AWB No., Port / Airport of Loading)
     - Sea / Road / Warehouse Job -> the original wording, untouched
   Only SHORT text is rewritten: field labels, short placeholders, column labels and step
   titles. Longer explanatory prose (step intros, help text) is deliberately left alone —
   mechanically swapping "Bill of Lading" for "Air Waybill" inside a sentence like "unlike a
   negotiable Bill of Lading..." would make it factually wrong (an Air Waybill is not negotiable).
   Dropdown option values are never touched either: they are stored values the engine compares.
   Phrases are applied in order, longest/most specific first.
   ========================================================================= */
const SK_AIR_PHRASES = [
  // transport document
  ["Bill of Lading Number / Air Waybill Number", "Air Waybill Number"], ["Bill of Lading / Air Waybill Issued", "Air Waybill Issued"],
  ["Bill of Lading / Air Waybill", "Air Waybill"], ["Bill of Lading / Airway Bill", "Air Waybill"], ["Bill of Lading / AWB No.", "AWB No."],
  ["B/L or Airway Bill Number", "Air Waybill Number"], ["B/L or AWB No.", "AWB No."], ["(B/L or AWB Number)", "(AWB Number)"], ["LR / B/L / AWB", "LR / AWB"],
  ["Booking / B/L No.", "Booking / AWB No."], ["Vessel & Bill of Lading", "Flight & Air Waybill"],
  ["Original Bill of Lading (or Bank Release Letter / Telex Release)", "Air Waybill Copy (or Bank Release Letter)"],
  ["House Bill of Lading", "House Air Waybill"], ["Draft B/L", "Draft AWB"], ["Bill of Lading", "Air Waybill"], ["B/L Number", "AWB Number"], ["B/L Type", "AWB Type"], ["B/L", "AWB"],
  // vessel / voyage -> airline / flight
  ["Vessel / Flight / Vehicle Details", "Flight / Vehicle Details"], ["Vessel / Flight Details", "Flight Details"], ["Vessel / Flight Name", "Airline / Flight Name"],
  ["Vessel / Flight Number", "Flight Number"], ["Vessel / Flight (if known)", "Flight (if known)"], ["Vessel Name / Flight Number", "Airline / Flight Number"],
  ["Vessel Name / Flight No.", "Airline / Flight No."], ["Vessel / Aircraft Name", "Airline / Aircraft Name"], ["Vessel / Conveyance Name", "Airline / Flight (Conveyance)"],
  ["Vessel / Container Reference", "Flight / ULD Reference"], ["Cargo Loaded onto Vessel / Aircraft", "Cargo Loaded onto Aircraft"], ["Vessel / Voyage", "Aircraft / Flight"],
  ["Vessel & Voyage", "Flight"], ["Vessel Particulars", "Aircraft Particulars"], ["Vessel Details", "Flight Details"], ["Vessel IMO Number", "Aircraft Registration No."],
  ["Vessel Name", "Airline / Flight Name"], ["New Vessel / Voyage After Roll", "New Flight After Offload"], ["Insured & Voyage Details", "Insured & Flight Details"],
  ["Voyage / Trip Number", "Flight / Trip Number"], ["vehicle/container", "vehicle/ULD"],
  ["Voyage / Flight Number", "Flight Number"], ["Voyage Number", "Flight Number"], ["Voyage No.", "Flight No."], ["Voyage From", "Flight From"], ["Voyage To", "Flight To"],
  // containers -> ULDs
  ["Packaging / Rotation / Container Details", "Packaging / Flight / ULD Details"], ["per container", "per ULD / consignment"], ["Containers", "ULDs"], ["Container", "ULD"],
  // shipping line / steamer agent -> airline
  ["Carrier / Shipping Line Name", "Carrier / Airline Name"], ["Shipping Line Name", "Airline / Handling Agent Name"], ["Shipping Line / Airline", "Airline"],
  ["Shipping Line", "Airline"], ["Steamer Agent Name", "Airline Handling Agent Name"], ["Steamer Agent", "Airline Agent"],
  // ports -> airports
  ["Port / Airport of Loading", "Airport of Loading"], ["Port / Airport of Discharge", "Airport of Discharge"],
  ["Port of Loading (ICEGATE Port Code)", "Airport of Loading (ICEGATE Location Code)"], ["Port of Loading (POL)", "Airport of Loading (AOL)"], ["Port of Discharge (POD)", "Airport of Discharge (AOD)"],
  ["Port of Loading", "Airport of Loading"], ["Port of Discharge", "Airport of Discharge"], ["Port of Destination", "Airport of Destination"], ["Port of Export", "Airport of Export"],
  ["Port of Call", "Airport of Call"], ["Last Port Called / Next Port", "Last / Next Airport"], ["Transhipment Port", "Transhipment Airport"],
  ["Intended Port/Place of Loading", "Intended Airport/Place of Loading"], ["(if beyond port)", "(if beyond airport)"], ["Officer at Port", "Officer at Airport"],
  ["Certification at Port", "Certification at Airport"], ["Submitted to Port Authority", "Submitted to Airport Authority"], ["Port & Customs Station", "Airport & Customs Station"],
  ["Port, Route & Departure", "Airport, Route & Departure"], ["(Port-Specific)", "(Airport-Specific)"], ["Port Code", "Airport / Customs Location Code"],
  // charges, rotation, reefer, DG class
  ["Ocean Freight", "Air Freight"], ["Terminal Handling Charges", "Cargo Terminal Handling Charges"], ["Rotation Number", "Flight Reference / Rotation No."], ["Rotation Date", "Flight / Rotation Date"],
  ["Reefer / Temperature Controlled", "Temperature Controlled (Cool Chain)"], ["Reefer Temperature Log Reference", "Temperature Log Reference"], ["IMO Class", "IATA DG Class"],
  ["Cargo Stuffed Into", "Cargo Built Up Into"],
  // sample values that were obviously sea
  ["Kochi Port (Vallarpadam)", "Cochin International Airport (COK)"], ["Kochi Port, India", "Cochin International Airport (COK), India"],
  ["Port of Hamburg, Germany", "Frankfurt Airport (FRA), Germany"], ["Port of Colombo, Sri Lanka", "Colombo Airport (CMB), Sri Lanka"],
  ["OOCL Shipping Line", "Air India Cargo"], ["Oceanic Container Lines", "Air India Cargo"], ["Ocean Star Shipping Agency", "Skyline Air Cargo Agency"],
  ["Sea — Vessel MSC ANNA, Voyage 234E", "Air — Flight AI508"], ["Authorized Steamer Agent Signatory", "Authorized Airline Agent Signatory"], ["JNPT Container Freight Station", "Air Cargo Complex"]
];
const SK_NEUTRAL_PHRASES = [
  ["Vessel IMO Number", "Vessel IMO No. / Aircraft Reg. No."], ["Vessel & Voyage", "Vessel / Flight"], ["Vessel Particulars", "Vessel / Aircraft Particulars"], ["Vessel Details", "Vessel / Flight Details"],
  ["Vessel Name", "Vessel / Flight Name"], ["Insured & Voyage Details", "Insured & Voyage / Flight Details"],
  ["Voyage Number", "Voyage / Flight Number"], ["Voyage No.", "Voyage / Flight No."], ["Voyage From", "Voyage / Flight From"], ["Voyage To", "Voyage / Flight To"],
  ["House Bill of Lading Number", "House B/L / HAWB Number"], ["Bill of Lading Summary", "Bill of Lading / AWB Summary"], ["Bill of Lading Number", "Bill of Lading / AWB Number"],
  ["Bill of Lading No.", "Bill of Lading / AWB No."], ["Bill of Lading Date", "Bill of Lading / AWB Date"], ["B/L Number", "B/L / AWB Number"], ["B/L Type", "B/L / AWB Type"],
  ["Container Number", "Container / ULD Number"], ["Container No.", "Container / ULD No."], ["Container Details", "Container / ULD Details"], ["Containers", "Containers / ULDs"],
  ["Carrier / Shipping Line Name", "Carrier / Shipping Line / Airline Name"], ["Shipping Line Name", "Shipping Line / Airline Name"], ["Steamer Agent Name", "Steamer / Airline Agent Name"],
  ["Port of Loading", "Port / Airport of Loading"], ["Port of Discharge", "Port / Airport of Discharge"], ["Port of Destination", "Port / Airport of Destination"],
  ["Port of Export", "Port / Airport of Export"], ["Port of Call", "Port / Airport of Call"], ["Transhipment Port", "Transhipment Port / Airport"], ["Port Code", "Port / Airport Code"],
  ["Ocean Freight", "Ocean / Air Freight"]
];
const SK_ALREADY_DUAL_OR_AIR = /(Flight|Aircraft|Airline|Airport|AWB|HAWB|Air Waybill|Airway|ULD)/;
function _skApplyPhrases(text, list){
  let t = text;
  for(let i = 0; i < list.length; i++){ if(t.indexOf(list[i][0]) !== -1) t = t.split(list[i][0]).join(list[i][1]); }
  return t;
}
function skAirWording(text){ return _skApplyPhrases(text, SK_AIR_PHRASES); }
function skNeutralWording(text){ return SK_ALREADY_DUAL_OR_AIR.test(text) ? text : _skApplyPhrases(text, SK_NEUTRAL_PHRASES); }

function _skRewriteConfig(cfg, fn){
  (cfg.steps || []).forEach(st => {
    if(typeof st.title === "string") st.title = fn(st.title);
    (st.fields || []).forEach(f => {
      if(!f) return;
      if(typeof f.label === "string") f.label = fn(f.label);
      if(typeof f.placeholder === "string" && f.placeholder.length <= 70) f.placeholder = fn(f.placeholder);
      (f.columns || []).forEach(c => {
        if(typeof c.label === "string") c.label = fn(c.label);
        if(typeof c.placeholder === "string" && c.placeholder.length <= 70) c.placeholder = fn(c.placeholder);
      });
    });
  });
}
function _skIsAirApplicableDoc(slug){
  return typeof skIsDocumentApplicableForMode === "function"
    && (skIsDocumentApplicableForMode(slug, "Air Export") || skIsDocumentApplicableForMode(slug, "Air Import"));
}

/* engine.js calls this once at boot, before CONFIG is used. Order matters: the bulk wording rewrite first, then the
   explicit per-field patches, so a hand-written patch always wins over the generic phrase rules. */
function skPrepareDocumentForMode(slug){
  const cfg = (typeof DOCUMENT_CONFIGS !== "undefined") ? DOCUMENT_CONFIGS[slug] : null;
  if(!cfg) return;
  const mode = skActiveJobMode();
  const isAir = /^Air /.test(mode);
  if(_skIsAirApplicableDoc(slug)){
    if(isAir) _skRewriteConfig(cfg, skAirWording);
    else if(!mode) _skRewriteConfig(cfg, skNeutralWording);   // Sea / Road / Warehouse jobs keep the original wording
  }
  if(isAir) skApplyAirModePatches(slug);
}

/* ---- review pages: label text only (bold "Label:" lines, table headers, section headings) ---- */
const SK_NEUTRAL_REVIEW_SWAPS = {
  "cargo-manifest": [["<h4>Vessel / Voyage</h4>", "<h4>Vessel / Aircraft</h4>"], [">Vessel:</b>", ">Vessel / Flight:</b>"], [">IMO No.:</b>", ">IMO / Reg. No.:</b>"], [">Voyage:</b>", ">Voyage / Flight:</b>"], [">Steamer Agent:</b>", ">Steamer / Airline Agent:</b>"]],
  "arrival-notice": [[">Vessel:</b>", ">Vessel / Flight:</b>"], [">Voyage No.:</b>", ">Voyage / Flight No.:</b>"], ["<h4>Vessel &amp; Voyage</h4>", "<h4>Vessel / Flight</h4>"]],
  "delivery-order": [[">Vessel / Voyage:</b>", ">Vessel / Flight:</b>"], [">Shipping Line:</b>", ">Shipping Line / Airline:</b>"]],
  "shipping-instructions": [[">Vessel:</b>", ">Vessel / Flight:</b>"], [">Voyage:</b>", ">Voyage / Flight:</b>"]],
  "booking-confirmation": [[">Voyage:</b>", ">Voyage / Flight:</b>"]]
};
function _skRewriteReviewLabels(html, fn){
  return html.replace(/(<(b|strong|th|h3|h4|h5|label)\b[^>]*>)([^<]{1,90})(<\/\2>)/g, function(m, open, tag, text, close){
    if((tag === "b" || tag === "strong") && !/:\s*$/.test(text)) return m;   // a bold VALUE, not a label
    return open + fn(text) + close;
  });
}


/* =========================================================================
   CARGO-PLANE MARK on Air documents
   Every document already carries a faint container-ship watermark. Air documents get a cargo-plane
   watermark instead, plus a small "AIR FREIGHT" badge with a cargo-plane icon above the document
   title, so an Air document is recognisable at a glance:
     - documents that only exist in Air modes (Air Waybill, ULD Manifest, Air Freight Invoice,
       Flight Schedule, Cargo Acceptance) always carry it;
     - shared documents (Commercial Invoice, Packing List, Cargo Manifest...) carry it while the
       student's active Job is an Air Job, and keep the ship mark otherwise.
   ========================================================================= */
function skIsAirOnlyDocument(slug){
  return typeof skIsDocumentApplicableForMode === "function"
    && _skIsAirApplicableDoc(slug)
    && !skIsDocumentApplicableForMode(slug, "Sea Export") && !skIsDocumentApplicableForMode(slug, "Sea Import");
}
function skIsAirDocument(slug){
  return skIsAirOnlyDocument(slug) || (skIsAirJobActive() && _skIsAirApplicableDoc(slug));
}
const SK_CARGO_PLANE_ICON = '<svg viewBox="0 0 24 14" width="24" height="14" aria-hidden="true" focusable="false"><g fill="currentColor">'
  + '<path d="M1,7.4 C1,6 2.2,5.4 3.8,5.4 L17,5.4 C20,5.4 22.4,6.3 23.2,7.4 C22.4,8.5 20,9.3 17,9.3 L3.8,9.3 C2.2,9.3 1,8.8 1,7.4 Z"/>'
  + '<path d="M4,6.2 L2.2,1.4 L4.2,1.4 L7.6,5.6 Z"/><path d="M11,8.6 L7,13 L9.6,13 L15,8.8 Z"/><path d="M3.4,7.8 L0.6,9.2 L2.8,9.2 L5.6,8.4 Z"/></g></svg>';
function skCargoPlaneWatermarkHtml(){
  return '<div class="doc-ship-watermark doc-plane-watermark" aria-hidden="true"><svg viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg"><g fill="currentColor">'
    + '<path d="M70,122 C70,102 96,92 130,92 L478,92 C546,92 598,108 618,128 C598,148 546,156 478,156 L130,156 C96,156 70,146 70,122 Z"/>'
    + '<path d="M424,92 C432,72 460,62 494,64 C522,66 542,82 552,96 Z"/><path d="M82,108 L46,36 L92,36 L166,96 Z"/><path d="M70,128 L16,150 L62,152 L138,136 Z"/>'
    + '<path d="M300,150 L190,208 L250,210 L396,154 Z"/><ellipse cx="318" cy="186" rx="34" ry="12"/><ellipse cx="246" cy="198" rx="30" ry="11"/>'
    + '<rect x="500" y="76" width="9" height="8" rx="2" fill="#fff"/><rect x="514" y="78" width="9" height="8" rx="2" fill="#fff"/><rect x="528" y="82" width="8" height="8" rx="2" fill="#fff"/>'
    + '<rect x="184" y="102" width="112" height="44" rx="3" fill="none" stroke="#fff" stroke-width="3.5"/><line x1="240" y1="102" x2="240" y2="146" stroke="#fff" stroke-width="2.5"/>'
    + '</g></svg></div>';
}
function skAirBadgeHtml(){
  return '<div class="doc-air-badge" title="Air freight document">' + SK_CARGO_PLANE_ICON + '<span>Air Freight</span></div>';
}
/* For documents with their own hand-built print layout (the Shipping Bill specimen): add just the badge on top. */
function skAirDecorate(slug, html){
  if(typeof html !== "string" || !skIsAirDocument(slug)) return html;
  return '<div class="doc-air-strip">' + skAirBadgeHtml() + '</div>' + html;
}

/* ---------------------------------------------------------------------
   Customs valuation of AIR imports: the freight/transport cost added to the assessable value is limited to 20% of the
   FOB value (Customs Valuation (Determination of Value of Imported Goods) Rules, 2007, Rule 10(2)). The duty calculator
   (documents-data.js) adds the actual freight; while the student's active Job is an Air Job, the transport part
   (freight + includable inland freight) is capped at 20% of FOB. Loading / unloading / handling charges are separate
   items under Rule 10(1)(b) and are not capped. With no Job (Document Library) the plain, uncapped sum is used.
   --------------------------------------------------------------------- */
(function skInstallAirFreightCap(){
  if(typeof dcFreightTotal !== "function" || typeof dcFobValue !== "function" || dcFreightTotal.__airCapped) return;
  const original = dcFreightTotal;
  const capped = function(d){
    const total = original(d);
    if(!(typeof skIsAirJobActive === "function" && skIsAirJobActive())) return total;
    const handling = (parseFloat(d.loadingCharges) || 0) + (parseFloat(d.handlingCharges) || 0);
    return Math.min(total - handling, 0.20 * dcFobValue(d)) + handling;
  };
  capped.__airCapped = true;
  dcFreightTotal = capped;
})();

/* The student's active Job mode ("" when there is none). */
function skActiveJobMode(){
  try{
    if(typeof skGetSessionId !== "function" || typeof skGetActiveJob !== "function") return "";
    const uid = skGetSessionId();
    const job = uid ? skGetActiveJob(uid) : null;
    return (job && job.status === "in-progress" && job.fields && job.fields.mode) ? String(job.fields.mode) : "";
  }catch(e){ return ""; }
}
function skIsAirJobActive(){ return /^Air /.test(skActiveJobMode()); }

/* 2. engine.js calls this at boot, once the document is known. No-op unless the active Job is an Air Job. */
function skApplyAirModePatches(slug){
  if(!skIsAirJobActive()) return false;
  const patch = SK_AIR_MODE_PATCHES[slug];
  if(!patch) return false;
  _skApplyDocPatch(slug, patch);
  return true;
}

/* 3. engine.js passes every rendered review page through this. */
function skAirReviewSwap(slug, html){
  if(typeof html !== "string") return html;
  const mode = skActiveJobMode();
  const isAir = /^Air /.test(mode);
  if(!isAir && mode) return html;                 // Sea / Road / Warehouse Job: original wording
  if(!_skIsAirApplicableDoc(slug)) return html;
  const explicit = isAir ? SK_AIR_REVIEW_SWAPS[slug] : SK_NEUTRAL_REVIEW_SWAPS[slug];
  (explicit || []).forEach(pair => { html = html.split(pair[0]).join(pair[1]); });
  return _skRewriteReviewLabels(html, isAir ? skAirWording : skNeutralWording);
}
