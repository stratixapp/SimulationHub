/* =====================================================================
   LYRA — the Skelora shipment assistant (rule-based, offline, no AI service)
   ---------------------------------------------------------------------
   A teaching helper for the document workstation. It never calls the
   internet and never "guesses": every reply is a pre-written explanation
   attached to a rule that fired. It watches the document the student is
   filling and, when something is off, shows
     - what they entered,
     - what it should be, exactly as written in “Create a Job” (or the earlier
       document it comes from),
     - WHY it matters and what goes wrong in a real shipment,
     - a one-tap "Use the correct value" fix.

   What it checks
     1. Cross-document consistency — the same fact (buyer, container no.,
        HS code, quantity, weights, invoice no., ports...) typed
        differently from the Shipment Lot / an earlier completed
        document. This reuses the simulator's own canonical context
        (workflow-rules.js) and the same comparison rules, but reports
        them while the student is typing, not only on the review page.
     2. A few self-contained rules that are always true: gross weight is
        never below net weight, arrival is never before departure, and a
        container number's check digit (ISO 6346).

   Design rules
     - Never blocks: the student can always "Continue anyway" (a real
       shipment would also let you submit a wrong form — and then pay for
       it). Faculty can switch the assistant off per student/browser.
     - Everything user-typed is HTML-escaped before it is shown.
     - Every entry point is wrapped in try/catch: if anything here ever
       throws, the workstation carries on exactly as it did before.
     - Needs from the page: CONFIG, formData, currentStep, CURRENT_USER,
       CURRENT_SLUG (engine.js) and, for rule 1, skGetTransactionContext /
       _sk_valuesMatch / SK_ITEM_CONTEXT_KEYS (workflow-rules.js). Missing
       ones simply switch that check off.
   ===================================================================== */
(function(){
  "use strict";

  /* ------------------------------------------------------------------
     1. KNOWLEDGE BASE — pre-written explanations per canonical fact
        (contextKey). label = how the field is named in plain English;
        why / risk / where are shown to the student.
     ------------------------------------------------------------------ */
  const KB = {
    "txn.buyerName":      {label:"Buyer name", why:"The buyer is a legal entity, and every document must name it exactly the same way.", risk:"Banks check the Letter of Credit, invoice and B/L letter-by-letter. Even \u201cPvt Ltd\u201d vs \u201cPrivate Limited\u201d is a discrepancy: payment is held and the bank charges a discrepancy fee.", where:"Copy it from the Shipment Lot / Sales Order."},
    "txn.sellerName":     {label:"Seller / exporter name", why:"The exporter\u2019s legal name links the invoice, Shipping Bill, B/L and the bank record.", risk:"Customs matches the exporter name against the IEC. A different spelling can stop the Shipping Bill or the export incentive claim.", where:"It is fixed in the Shipment Lot — copy it exactly."},
    "txn.buyerAddress":   {label:"Buyer address", why:"The address tells the carrier and customs where the goods are going.", risk:"A different address means the arrival notice, delivery order or duty bill can reach the wrong place.", where:"Use the address from the Shipment Lot."},
    "txn.sellerAddress":  {label:"Seller address", why:"The exporter\u2019s registered address appears on the invoice, Shipping Bill and certificates.", risk:"Customs and the bank compare it to the IEC and GST records.", where:"Use the address from the Shipment Lot."},
    "txn.currency":       {label:"Invoice currency", why:"The currency decides the value Customs assesses and the amount the bank pays.", risk:"If one document says USD and another EUR, the declared value is wrong, the LC amount does not match and the exchange rate is applied to the wrong figure.", where:"One shipment is invoiced in one currency — the one in the Shipment Lot."},
    "txn.containerNo":    {label:"Container number", why:"The container number is the box\u2019s identity: it is on the B/L, VGM, Shipping Bill, gate-in and the port\u2019s EDI message.", risk:"One wrong digit and the terminal cannot find the box, the VGM does not match the B/L and the container can be rolled to the next vessel.", where:"Look at the Container / Mate Receipt or the Shipment Lot."},
    "txn.hsCode":         {label:"HS code", why:"The HS code classifies the goods. It drives duty, export incentives (RoDTEP / drawback) and licensing checks.", risk:"A different HS code between invoice and Shipping Bill is treated as mis-declaration: queries, penalty, delay and possible loss of the incentive.", where:"Use the code from the Shipment Lot / Commercial Invoice."},
    "txn.portOfLoading":  {label:"Port of loading", why:"This is where the goods leave India and where Customs clears them.", risk:"A different port on the B/L and Shipping Bill means the Let Export Order is for the wrong port; the cargo cannot be loaded.", where:"Use the port from the Shipment Lot."},
    "txn.portOfDischarge":{label:"Port of discharge", why:"This is where the vessel unloads the cargo and the importer clears it.", risk:"If documents disagree, the carrier discharges at one port and the buyer clears at another \u2014 extra freight and storage cost.", where:"Use the port from the Shipment Lot."},
    "txn.sealNo":         {label:"Seal number", why:"The seal proves the container was not opened after stuffing.", risk:"A seal number that differs from the B/L and the Container Packing Certificate looks like tampering: the box is held for inspection.", where:"It is on the Seal Report / Container Packing Certificate."},
    "txn.vesselName":     {label:"Vessel name", why:"The vessel carries the box; its name ties the B/L to the voyage and the manifest.", risk:"A different vessel name makes the B/L and the manifest disagree; the importer cannot clear the cargo.", where:"Use the name from the Booking Confirmation / Mate Receipt."},
    "txn.voyageNo":       {label:"Voyage number", why:"Vessel + voyage together identify one sailing.", risk:"A wrong voyage means the cargo is tracked on the wrong sailing and the arrival date is wrong.", where:"Use the voyage from the Booking Confirmation."},
    "txn.grossWeight":    {label:"Gross weight", why:"Gross weight is goods plus packing. It is used for freight, VGM and customs.", risk:"Different gross weights on invoice, packing list and B/L cause freight re-billing and a weight-declaration mismatch at the terminal.", where:"Use the total gross weight from the Packing List / Shipment Lot."},
    "txn.noOfPackages":   {label:"Number of packages", why:"The package count is how Customs and the carrier physically count the shipment.", risk:"If the count differs between documents the shipment is held for a re-count and may be short-landed.", where:"Use the count from the Packing List / Shipment Lot."},
    "txn.commercialInvoiceNo": {label:"Commercial invoice number", why:"The invoice number is the key that links the invoice to the Packing List, Shipping Bill, LC and BRC.", risk:"A different invoice number means Customs and the bank cannot match the Shipping Bill to the invoice, so the export is not recognised.", where:"Use the number on your Commercial Invoice."},
    "txn.blNo":           {label:"Bill of Lading number", why:"The B/L number identifies the contract of carriage and is used to release the cargo.", risk:"A wrong B/L number means the importer cannot take delivery and the LC bank cannot pay.", where:"Use the number on the Bill of Lading."},
    "txn.itemQuantity":   {label:"Quantity", why:"Quantity is the core of the declaration \u2014 invoice, packing list, Shipping Bill and B/L must show the same quantity.", risk:"A different quantity is a short- or excess-shipment: Customs queries it and the buyer can reject the claim.", where:"Use the quantity from the Shipment Lot / Commercial Invoice."},
    "txn.sellerGSTIN":    {label:"Seller GSTIN", why:"GSTIN links the export to the supplier\u2019s tax registration (for LUT / refund).", risk:"A different GSTIN means the IGST refund or LUT export is rejected.", where:"Use the GSTIN from the Shipment Lot."},
    "txn.buyerGSTIN":     {label:"Buyer GSTIN", why:"For domestic movements it identifies the receiving taxpayer.", risk:"A wrong GSTIN makes the GST invoice / e-way bill invalid.", where:"Use the GSTIN from the Shipment Lot."},
    "txn.sellerIEC":      {label:"Importer-Exporter Code (IEC)", why:"The IEC is the exporter\u2019s licence to trade; it is on the invoice, Shipping Bill and BRC.", risk:"Customs rejects a Shipping Bill whose IEC does not match the exporter.", where:"Use the IEC from the Shipment Lot."},
    "txn.iecNo":          {label:"IEC number", why:"The IEC is the exporter\u2019s licence to trade.", risk:"A different IEC on any document stops the filing.", where:"Use the IEC from the Shipment Lot."},
    "txn.carrierName":    {label:"Carrier / shipping line", why:"The carrier issued the booking and will issue the B/L.", risk:"A different carrier name means the booking, B/L and freight invoice do not tie up.", where:"Use the carrier from the Booking Confirmation."},
    "txn.destinationCountry": {label:"Destination country", why:"The destination decides duty, certificates and trade rules.", risk:"A wrong country can mean the wrong Certificate of Origin and failed import clearance.", where:"Use the destination from the Shipment Lot."},
    "txn.poNumber":       {label:"Purchase order number", why:"The PO is the buyer\u2019s order reference tying every document to one deal.", risk:"If the PO differs, the buyer\u2019s accounts team cannot match the shipment to the order and payment is delayed.", where:"Use the PO from the Shipment Lot."},
    "txn.itemUnit":       {label:"Unit of measure", why:"The unit tells everyone what the quantity means (kg, pcs, MT...).", risk:"20 MT typed as 20 KG on one document is a thousand-fold error in quantity and value.", where:"Use the unit from the Shipment Lot."},
    "txn.bookingNo":      {label:"Booking number", why:"The booking number is the carrier\u2019s reference for your cargo space.", risk:"A wrong booking number means the terminal cannot find the booking when the box arrives.", where:"Use the number on the Booking Confirmation."},
    "txn.incoterm":       {label:"Incoterm", why:"The Incoterm decides who pays freight, insurance and risk at each stage.", risk:"If documents show different Incoterms, the seller and buyer disagree on who should have paid what \u2014 a classic dispute.", where:"Use the Incoterm from the Shipment Lot."},
    "txn.itemUnitPrice":  {label:"Unit price", why:"Unit price \u00d7 quantity is the invoice value that Customs and the bank rely on.", risk:"A different price changes the declared value, duty and the LC amount.", where:"Use the price from the Shipment Lot."},
    "txn.shippingBillNo": {label:"Shipping Bill number", why:"The Shipping Bill number is Customs\u2019 export record.", risk:"A wrong number breaks the link to the Let Export Order and the BRC.", where:"Use the number on your Shipping Bill."},
    "txn.itemWeight":     {label:"Item weight", why:"Item weights add up to the shipment totals.", risk:"If item weights do not match the other documents, the total weight is wrong.", where:"Use the weight from the Shipment Lot."},
    "txn.itemNetWeight":  {label:"Net weight", why:"Net weight is the goods alone, without packing.", risk:"It must match the Packing List; Customs uses it to check the quantity.", where:"Use the net weight from the Shipment Lot."},
    "txn.itemDescription":{label:"Goods description", why:"The description tells Customs what is physically inside the box.", risk:"A different description on the invoice and the Shipping Bill is treated as mis-declaration.", where:"Use the description from the Shipment Lot."},
    "txn.awbNo":          {label:"Air Waybill number", why:"The AWB number identifies the air shipment.", risk:"A wrong AWB number makes the cargo untraceable at the airline and in customs.", where:"Use the number on the Air Waybill."},
    "txn.billOfEntryNo":  {label:"Bill of Entry number", why:"The Bill of Entry is the importer\u2019s customs declaration.", risk:"A wrong number breaks the link to the duty payment and Out-of-Charge order.", where:"Use the number on your Bill of Entry."},
    "txn.vehicleNumber":  {label:"Vehicle number", why:"The vehicle registration number identifies the truck that carried the cargo.", risk:"A different number between the Lorry Receipt, e-way bill and gate pass makes the movement look unauthorised; the truck can be stopped.", where:"Use the number from the Lorry Receipt."}
  };

  /* Fallback explanation for any other canonical fact: still specific, built from the key. */
  function kbFor(key, fieldLabel){
    if(KB[key]) return KB[key];
    const name = fieldLabel || String(key).replace(/^[a-z]+\./,"").replace(/([A-Z])/g," $1").toLowerCase();
    return {
      label: name,
      why: "This is the same fact as on an earlier document of this shipment, so it has to be identical everywhere it appears.",
      risk: "Customs, the bank and the carrier cross-check documents against each other. A value that differs between two documents is a discrepancy \u2014 the shipment can be held and the bank can refuse to pay.",
      where: "Copy it from the document or the Shipment Lot named above."
    };
  }

  /* ------------------------------------------------------------------
     2. HELPERS
     ------------------------------------------------------------------ */
  const esc = x => String(x == null ? "" : x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const num = x => { const n = parseFloat(String(x).replace(/,/g,"")); return isFinite(n) ? n : NaN; };
  const present = v => v !== undefined && v !== null && String(v).trim() !== "";
  /* Read page-level let/const bindings (engine.js / workflow-rules.js) without eval. */
  const G = name => {
    try{
      switch(name){
        case "CONFIG": return typeof CONFIG !== "undefined" ? CONFIG : undefined;
        case "formData": return typeof formData !== "undefined" ? formData : undefined;
        case "currentStep": return typeof currentStep !== "undefined" ? currentStep : undefined;
        case "CURRENT_USER": return typeof CURRENT_USER !== "undefined" ? CURRENT_USER : undefined;
        case "CURRENT_SLUG": return typeof CURRENT_SLUG !== "undefined" ? CURRENT_SLUG : undefined;
        case "skGetTransactionContext": return typeof skGetTransactionContext === "function" ? skGetTransactionContext : undefined;
        case "_sk_valuesMatch": return typeof _sk_valuesMatch === "function" ? _sk_valuesMatch : undefined;
        case "SK_ITEM_CONTEXT_KEYS": return typeof SK_ITEM_CONTEXT_KEYS !== "undefined" ? SK_ITEM_CONTEXT_KEYS : undefined;
        case "skGetActiveJob": return typeof skGetActiveJob === "function" ? skGetActiveJob : undefined;
        case "skUpdateJobFields": return typeof skUpdateJobFields === "function" ? skUpdateJobFields : undefined;
      }
    }catch(e){}
    return undefined;
  };
  const store = {
    get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
    set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  };

  const keyOn = () => { const u = G("CURRENT_USER"); return "skelora_assistant_v1_" + (u && u.id ? u.id : "guest"); };
  /* The switch lives on the Shipment Lot ("Create a Job" form): job.fields.lyra = "on" | "off".
     No Lot (or an older Lot saved before Lyra existed) -> the per-student fallback, default on. */
  function jobSwitch(){
    try{ const u = G("CURRENT_USER"), get = G("skGetActiveJob"); const j = u && u.id && get ? get(u.id) : null; if(j && j.fields && (j.fields.lyra === "on" || j.fields.lyra === "off")) return j.fields.lyra === "on"; }catch(e){}
    return null;
  }
  function isOn(){ const j = jobSwitch(); return j !== null ? j : store.get(keyOn()) !== "off"; }
  function setOn(v){
    store.set(keyOn(), v ? "on" : "off");
    try{ const u = G("CURRENT_USER"), upd = G("skUpdateJobFields"), get = G("skGetActiveJob"); if(u && u.id && upd && get && get(u.id)) upd(u.id, {lyra: v ? "on" : "off"}); }catch(e){}
  }

  /* ISO 6346 container check digit */
  function containerCheckDigit(first10){
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"; const val = {}; let n = 10;
    for(const ch of letters){ if(n % 11 === 0) n++; val[ch] = n; n++; }
    let sum = 0;
    for(let i = 0; i < 10; i++){ const ch = first10[i]; const v = /[A-Z]/.test(ch) ? val[ch] : parseInt(ch, 10); sum += v * Math.pow(2, i); }
    return (sum % 11) % 10;
  }

  /* ------------------------------------------------------------------
     3. THE CHECKER  — pure function: (config, step, formData, context)
     ------------------------------------------------------------------ */
  const WEIGHT_PAIRS = [["grossWeight","netWeight"],["totalGrossWeight","totalNetWeight"]];
  const DATE_PAIRS = [["etdDate","etaDate","departure (ETD)","arrival (ETA)"],["etd","eta","departure (ETD)","arrival (ETA)"],["etdSwb","etaSwb","departure (ETD)","arrival (ETA)"],
    ["vesselDepartureDate","vesselArrivalDate","vessel departure","vessel arrival"],["actualDepartureDate","actualArrivalDate","actual departure","actual arrival"],["loadedOnBoardDate","etaDate","loaded-on-board date","arrival (ETA)"]];

  function allFieldNames(cfg){ const s = new Set(); (cfg.steps||[]).forEach(st => (st.fields||[]).forEach(f => { if(f.name) s.add(f.name); })); return s; }
  function fieldLabel(cfg, name){ for(const st of (cfg.steps||[])) for(const f of (st.fields||[])) if(f.name === name) return f.label || name; return name; }
  function stepOfField(cfg, name){ for(let i = 0; i < (cfg.steps||[]).length; i++) if((cfg.steps[i].fields||[]).some(f => f.name === name)) return i; return -1; }

  function valuesMatch(key, a, b){
    if(typeof G("_sk_valuesMatch") === "function") return G("_sk_valuesMatch")(key, a, b);
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  /* Where a canonical value came from, in the student's words. */
  function srcOf(canon){
    if(canon && canon.sourceSlug === "job-master") return {text:"Create a Job" + (canon.sourceTitle ? " (" + canon.sourceTitle + ")" : ""), fromJob:true};
    return {text:(canon && canon.sourceTitle) || "an earlier document", fromJob:false};
  }
  /* Same fact, but typed differently (capitals, spaces, punctuation). Only for free-text boxes the
     student really can retype: never for dropdowns / lists, numbers, dates or fields the form
     upper-cases by itself, so the student can always actually satisfy it. */
  function formatDiffers(def, a, b){
    if(def && (def.type === "select" || def.type === "datalist" || def.options || def.optionsFrom || def.uppercase || def.readonly || def.type === "computed")) return false;
    const x = String(a).trim(), y = String(b).trim();
    if(x === y) return false;
    const numLike = t => /^-?[\d,]*\.?\d+$/.test(t), dateLike = t => /^\d{4}-\d{2}-\d{2}$/.test(t);
    if(numLike(x) || numLike(y) || dateLike(x) || dateLike(y)) return false;
    return true;
  }

  function mismatchIssues(cfg, step, stepIdx, formData, context){
    const out = [];
    if(!context) return out;
    const ITEM_KEYS = G("SK_ITEM_CONTEXT_KEYS");
    (step.fields||[]).forEach(f => {
      if(f.contextKey && context[f.contextKey] && f.name){
        const v = formData[f.name], canon = context[f.contextKey];
        if(present(v) && present(canon.value)){
          const src = srcOf(canon);
          if(!valuesMatch(f.contextKey, v, canon.value)){
            out.push({kind:"mismatch", sev:"warn", key:f.contextKey, stepIdx, ref:{name:f.name}, label:f.label || f.name, entered:v, expected:canon.value, source:src.text, fromJob:src.fromJob});
          } else if(formatDiffers(f, v, canon.value)){
            out.push({kind:"format", sev:"warn", key:f.contextKey, stepIdx, ref:{name:f.name}, label:f.label || f.name, entered:v, expected:canon.value, source:src.text, fromJob:src.fromJob});
          }
        }
      }
      if(f.type === "table" && f.name && Array.isArray(formData[f.name])){
        (f.columns||[]).forEach(col => {
          if(!col.contextKey) return;
          const multi = ITEM_KEYS && ITEM_KEYS.has && ITEM_KEYS.has(col.contextKey) && Array.isArray(context.__jobItems) && context.__jobItems.length > 1;
          formData[f.name].forEach((row, i) => {
            const v = row && row[col.key];
            if(!present(v)) return;
            let canonVal, src;
            if(multi){ const ic = context.__jobItems[i]; if(!ic || ic[col.contextKey] === undefined) return; canonVal = ic[col.contextKey]; src = {text:"Create a Job (item " + (i+1) + ")", fromJob:true}; }
            else { const c = context[col.contextKey]; if(!c) return; canonVal = c.value; src = srcOf(c); }
            const lbl = (f.label || f.name) + " \u2014 " + (col.label || col.key) + " (row " + (i+1) + ")";
            if(present(canonVal) && !valuesMatch(col.contextKey, v, canonVal)){
              out.push({kind:"mismatch", sev:"warn", key:col.contextKey, stepIdx, ref:{table:f.name, row:i, col:col.key}, label:lbl, entered:v, expected:canonVal, source:src.text, fromJob:src.fromJob});
            } else if(present(canonVal) && formatDiffers(col, v, canonVal)){
              out.push({kind:"format", sev:"warn", key:col.contextKey, stepIdx, ref:{table:f.name, row:i, col:col.key}, label:lbl, entered:v, expected:canonVal, source:src.text, fromJob:src.fromJob});
            }
          });
        });
      }
    });
    return out;
  }

  function ruleIssues(cfg, step, stepIdx, formData, onlyThisStep){
    const out = [];
    const names = allFieldNames(cfg);
    const inStep = n => !onlyThisStep || (step.fields||[]).some(f => f.name === n);
    // gross < net  (single fields)
    WEIGHT_PAIRS.forEach(([g, n]) => {
      if(!names.has(g) || !names.has(n)) return;
      const gv = num(formData[g]), nv = num(formData[n]);
      if(isFinite(gv) && isFinite(nv) && gv < nv && (inStep(g) || inStep(n))){
        out.push({kind:"rule", sev:"error", rule:"grossNet", stepIdx:stepOfField(cfg, g), ref:{name:g}, label:fieldLabel(cfg, g), entered:formData[g], expected:"at least " + formData[n], source:"the net weight you entered (" + formData[n] + ")"});
      }
    });
    // gross < net in table rows
    (step.fields||[]).forEach(f => {
      if(f.type !== "table" || !Array.isArray(formData[f.name])) return;
      const cols = (f.columns||[]).map(c => c.key);
      if(!cols.includes("grossWeight") || !cols.includes("netWeight")) return;
      formData[f.name].forEach((row, i) => {
        const gv = num(row && row.grossWeight), nv = num(row && row.netWeight);
        if(isFinite(gv) && isFinite(nv) && gv < nv) out.push({kind:"rule", sev:"error", rule:"grossNet", stepIdx, ref:{table:f.name, row:i, col:"grossWeight"}, label:(f.label || f.name) + " \u2014 Gross weight (row " + (i+1) + ")", entered:row.grossWeight, expected:"at least " + row.netWeight, source:"the net weight in the same row (" + row.netWeight + ")"});
      });
    });
    // arrival before departure
    DATE_PAIRS.forEach(([d, a, dl, al]) => {
      if(!names.has(d) || !names.has(a)) return;
      const dv = formData[d], av = formData[a];
      if(present(dv) && present(av) && String(av) < String(dv) && (inStep(d) || inStep(a))){
        out.push({kind:"rule", sev:"error", rule:"dates", dl, al, stepIdx:stepOfField(cfg, a), ref:{name:a}, label:fieldLabel(cfg, a), entered:av, expected:"on or after " + dv, source:"the " + dl + " date you entered (" + dv + ")"});
      }
    });
    // container check digit (tip only: the simulator does not require real, valid numbers)
    const checkContainer = (v, ref, label) => {
      const s = String(v || "").trim().toUpperCase();
      if(!/^[A-Z]{4}\d{7}$/.test(s)) return;
      const cd = containerCheckDigit(s.slice(0,10));
      if(cd !== parseInt(s[10], 10)) out.push({kind:"rule", sev:"tip", rule:"containerCheck", stepIdx, ref, label, entered:s, expected:s.slice(0,10) + cd, source:"the ISO 6346 check-digit calculation"});
    };
    (step.fields||[]).forEach(f => {
      if(f.contextKey === "txn.containerNo" && f.name && present(formData[f.name])) checkContainer(formData[f.name], {name:f.name}, f.label || f.name);
      if(f.type === "table" && Array.isArray(formData[f.name])) (f.columns||[]).forEach(col => {
        if(col.contextKey === "txn.containerNo") formData[f.name].forEach((row, i) => { if(row && present(row[col.key])) checkContainer(row[col.key], {table:f.name, row:i, col:col.key}, (f.label || f.name) + " \u2014 " + (col.label || col.key) + " (row " + (i+1) + ")"); });
      });
    });
    return out;
  }

  /* Explanation text for an issue (all pre-written). */
  function explain(issue){
    if(issue.kind === "mismatch"){
      const k = kbFor(issue.key, issue.label);
      return {title:"\u201c" + k.label + "\u201d doesn\u2019t match", why:k.why, risk:k.risk, how:k.where};
    }
    if(issue.kind === "format") return {title:"Right details, but written differently", why:"All the documents of one shipment must read exactly the same \u2014 same spelling, capitals, spaces and punctuation. That is how Customs, the bank and the carrier match them automatically.", risk:"Automated systems and bank officers compare text character by character. \u201cGulf Pearl Trading L.L.C.\u201d on one paper and \u201cGULF PEARL TRADING LLC\u201d on another is logged as a discrepancy, even though a person can see it is the same company.", how:"Don\u2019t retype it \u2014 copy it exactly from " + issue.source + "."};
    if(issue.rule === "grossNet") return {title:"Gross weight is lower than net weight", why:"Gross weight = the goods + their packing (bags, cartons, pallets). Net weight = the goods alone. So gross can never be smaller than net.", risk:"Customs and the carrier reject a weight declaration that is physically impossible; the VGM and freight would also be wrong.", how:"Recheck both numbers. Gross is usually a little higher than net (packing adds weight)."};
    if(issue.rule === "dates") return {title:"Arrival is before departure", why:"A vessel or flight must leave before it can arrive, so the " + issue.al + " date cannot come before the " + issue.dl + " date.", risk:"Wrong dates break the transit-time commitment, the LC shipment window and the importer\u2019s clearance planning.", how:"Check the dates against the Booking Confirmation / schedule."};
    if(issue.rule === "containerCheck") return {title:"Container number check digit looks wrong", why:"The 11th character of a container number is a check digit calculated from the first 10 (ISO 6346). Terminals and customs systems reject numbers where it does not fit.", risk:"A container number with an invalid check digit is usually a typing error: the box cannot be found in the port system.", how:"For these first 10 characters the correct last digit is " + issue.expected.slice(-1) + ". If your Shipment Lot uses a sample number, you can ignore this tip."};
    return {title:"Check this field", why:"", risk:"", how:""};
  }

  function issueId(i){ return [i.kind, i.rule || i.key, i.ref.name || (i.ref.table + ":" + i.ref.row + ":" + i.ref.col), String(i.entered)].join("|"); }

  /* Evaluate one step (or, with step = null, the whole document). Never throws. */
  function evaluate(cfg, stepIdxOrAll, formData, context){
    const all = [];
    try{
      const steps = cfg && cfg.steps || [];
      const range = stepIdxOrAll === "all" ? steps.map((s, i) => i) : [stepIdxOrAll];
      range.forEach(i => {
        const st = steps[i]; if(!st || !st.fields || st.custom) return;
        mismatchIssues(cfg, st, i, formData, context).forEach(x => all.push(x));
        ruleIssues(cfg, st, i, formData, stepIdxOrAll !== "all").forEach(x => all.push(x));
      });
    }catch(e){ try{ console.warn("Assistant check skipped:", e); }catch(e2){} }
    // de-duplicate (the same weight rule can be reached from two steps)
    const seen = new Set(); const out = [];
    all.forEach(i => { i.id = issueId(i); if(seen.has(i.id)) return; seen.add(i.id); i.ex = explain(i); out.push(i); });
    const order = {error:0, warn:1, tip:2};
    out.sort((a, b) => order[a.sev] - order[b.sev]);
    return out;
  }

  /* ------------------------------------------------------------------
     4. PAGE INTEGRATION + UI  (Lyra)
     ------------------------------------------------------------------ */
  let panelOpen = false, panelTab = "check", bubbleTimer = null, lastCount = 0, evalTimer = null, delegated = false, popFor = null, popRef = null;

  /* ---------- DEVELOPER-CODE LOCK (lyra-lock.js) ----------------------------------
     Lyra is locked. Any click on a Lyra "presence" (floating button, \u2726 buttons, \u2726 Explain)
     asks for the developer code first. The unlock lasts only while Lyra's panel / popup / gate is
     on screen; the moment the last of them is closed (X, Esc, Keep mine...) she locks again, so
     the next click asks for the code again. While locked she is completely silent: no popups,
     no bubble, no badge, no red-box flags, no "wait a moment" gate. Nothing is stored. */
  let unlockedFlag = false, graceOpen = false;
  const uiVisible = () => panelOpen || !!el("skAsstPop") || !!el("skAsstGate");
  function stillUnlocked(){ if(graceOpen) return true; if(unlockedFlag && !uiVisible()) unlockedFlag = false; return unlockedFlag; }
  function needCode(fn){
    if(stillUnlocked()) return fn();
    if(!window.LyraLock || typeof window.LyraLock.ask !== "function") return;   // fail closed
    window.LyraLock.ask(() => { unlockedFlag = true; graceOpen = true; try{ fn(); }finally{ graceOpen = false; try{ refresh(); }catch(e){} } });   // graceOpen: lets the action open its UI before the "is anything visible?" check runs
  }
  let invalidSnap = null, askQuery = "", askWeb = null;
  const dismissedKey = () => "skelora_lyra_dismissed_" + (G("CURRENT_SLUG") || "doc") + "_" + ((G("CURRENT_USER") || {}).id || "g");
  function dismissed(){ try{ return new Set(JSON.parse(sessionStorage.getItem(dismissedKey()) || "[]")); }catch(e){ return new Set(); } }
  function dismiss(id){ const d = dismissed(); d.add(id); try{ sessionStorage.setItem(dismissedKey(), JSON.stringify([...d])); }catch(e){} }
  const KB_ = () => window.LyraKnowledge || null;
  const WEB_ = () => window.LyraWeb || null;

  function currentContext(){
    try{ const f = G("skGetTransactionContext"), u = G("CURRENT_USER"); if(f && u && u.id) return f(u.id); }catch(e){}
    return null;
  }
  function currentIssues(scope){
    const cfg = G("CONFIG"), fd = G("formData"); if(!cfg || !fd) return [];
    const ds = dismissed();
    return evaluate(cfg, scope === "all" ? "all" : G("currentStep"), fd, currentContext()).filter(i => !ds.has(i.id));
  }

  const el = id => document.getElementById(id);
  const AVATAR = '<span class="sk-lyra-av" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.5l2.2 5.3 5.8.5-4.4 3.8 1.4 5.6L12 14.6 7 17.7l1.4-5.6L4 8.3l5.8-.5z"/></svg></span>';
  const ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.2 5.3 5.8.5-4.4 3.8 1.4 5.6L12 14.6 7 17.7l1.4-5.6L4 8.3l5.8-.5z"/><circle cx="19" cy="18.5" r="1.4"/><circle cx="5" cy="19.5" r="1"/></svg>';

  function ensureShell(){
    if(el("skAsstBtn")) return;
    const b = document.createElement("button");
    b.id = "skAsstBtn"; b.type = "button"; b.setAttribute("aria-label", "Open Lyra, your shipment assistant");
    b.innerHTML = ICON + '<span class="sk-btn-name">Lyra</span><span class="sk-asst-badge" id="skAsstBadge" hidden>0</span>';
    b.addEventListener("click", () => togglePanel());   // locked: openPanel() asks for the developer code
    document.body.appendChild(b);
    const bub = document.createElement("div"); bub.id = "skAsstBubble"; bub.hidden = true; bub.setAttribute("role", "status");
    bub.addEventListener("click", () => { hideBubble(); openPanel(); });
    document.body.appendChild(bub);
    const p = document.createElement("aside"); p.id = "skAsstPanel"; p.hidden = true; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Lyra"); p.setAttribute("aria-live", "polite");
    document.body.appendChild(p);
  }

  /* ---------- field / column lookup on the current step ---------- */
  function stepFieldDef(name){
    const cfg = G("CONFIG"), st = cfg && cfg.steps[G("currentStep")]; if(!st) return null;
    return (st.fields || []).find(f => f.name === name) || null;
  }
  function defForRef(ref){
    if(!ref) return null;
    if(ref.name) return stepFieldDef(ref.name);
    const t = stepFieldDef(ref.table); if(!t) return null;
    const col = (t.columns || []).find(c => c.key === ref.col) || {key: ref.col, label: ref.col};
    const cp = t.cellPatterns && t.cellPatterns[ref.col];
    return Object.assign({}, col, {name: ref.table + "." + ref.col, label: col.label || col.key, pattern: cp ? cp.pattern : col.pattern, patternMsg: cp ? cp.msg : col.patternMsg, contextKey: col.contextKey, required: false});
  }
  const valueOfRef = ref => { const fd = G("formData") || {}; return ref.name ? fd[ref.name] : (Array.isArray(fd[ref.table]) && fd[ref.table][ref.row] ? fd[ref.table][ref.row][ref.col] : undefined); };

  /* ---------- sentences + explanation HTML ---------- */
  function sentence(i){
    const c = v => "<code>" + esc(v) + "</code>";
    if(i.kind === "mismatch") return "In <b>" + esc(i.source) + "</b> it was written " + c(i.expected) + ". Here you wrote " + c(i.entered) + ". Please write " + c(i.expected) + "." + (i.patternNote ? " <b>Also:</b> " + esc(i.patternNote) : "");
    if(i.kind === "format") return "Right details, but not written the same way. In <b>" + esc(i.source) + "</b> it is " + c(i.expected) + "; here it is " + c(i.entered) + ". Write it exactly like " + c(i.expected) + " so every document looks identical.";
    if(i.kind === "invalid"){
      const val = present(i.entered) ? "You wrote " + c(i.entered) + ", " : "Nothing is entered yet, ";
      let t = val + "but this box needs a specific format. <b>" + esc(i.msg) + "</b>";
      if(i.example && !i.fix) t += " It should look like " + c(i.example) + ".";
      if(i.fix) t += i.source ? " In <b>" + esc(i.source) + "</b> it is " + c(i.fix) + "." : " I can tidy yours into " + c(i.fix) + ".";
      return t;
    }
    if(i.kind === "required"){
      let t = "<b>" + esc(i.msg) + "</b> This box can\u2019t stay empty.";
      if(i.fix) t += " In " + esc(i.source) + " it is " + c(i.fix) + ".";
      else if(i.example) t += " For example: " + c(i.example) + ".";
      return t;
    }
    if(i.rule === "grossNet") return "Gross weight " + c(i.entered) + " is lower than the net weight (" + c(String(i.expected).replace(/^at least /, "")) + "). Gross includes the packing, so it can never be smaller.";
    if(i.rule === "dates") return "Arrival " + c(i.entered) + " is before departure. It must be " + c(i.expected) + ".";
    if(i.rule === "containerCheck") return "The check digit of " + c(i.entered) + " doesn\u2019t fit. For these 10 characters the last digit should be " + c(i.expected.slice(-1)) + " (" + c(i.expected) + ").";
    return esc(i.ex ? i.ex.title : "Check this field");
  }
  const fixValue = i => (i.kind === "invalid" || i.kind === "required") ? i.fix : i.expected;
  const canFix = i => (i.kind === "mismatch" || i.kind === "format" || i.rule === "containerCheck") ? present(i.expected) : ((i.kind === "invalid" || i.kind === "required") && present(i.fix));

  function sectionsHtml(exp, only){
    if(!exp) return "";
    return exp.sections.filter(s => !only || only.includes(s.k)).map(s => '<p class="sk-sec sk-sec-' + s.k + '"><b>' + esc(s.h) + (s.k === "req" ? "" : ":") + '</b> ' + (s.k === "req" ? "" : esc(s.t)) + (s.k === "req" ? esc(s.t) : "") + '</p>').join("");
  }
  function whyHtml(i){
    if(i.whyHtml) return i.whyHtml;
    return (i.ex && i.ex.why ? '<p>' + esc(i.ex.why) + '</p>' : '') + (i.ex && i.ex.risk ? '<p><b>In a real shipment:</b> ' + esc(i.ex.risk) + '</p>' : '') + (i.ex && i.ex.how ? '<p><b>How to find it:</b> ' + esc(i.ex.how) + '</p>' : '');
  }
  function explainFor(def){
    const K = KB_(); if(!K || !def) return null;
    const cfg = G("CONFIG"), st = cfg && cfg.steps[G("currentStep")];
    try{ return K.explainField(def, {cfg, step: st}); }catch(e){ return null; }
  }
  const webLinks = q => { const W = WEB_(); return W ? '<div class="sk-web-actions"><button type="button" class="sk-ghost" data-web="' + esc(q) + '">\ud83c\udf10 Search the web</button><a class="sk-link" target="_blank" rel="noopener noreferrer" href="' + esc(W.googleUrl(q)) + '">Open in Google \u2197</a></div><div class="sk-web-out" data-for="' + esc(q) + '"></div>' : ""; };

  /* ---------- invalid / required explanations (what the red box under a field really means) ---------- */
  function buildInvalidItem(ref, msg, kind){
    const def = defForRef(ref); if(!def) return null;
    const K = KB_(); const value = valueOfRef(ref);
    const label = ref.name ? stripLabel(def.label || def.name) : (stripLabel((stepFieldDef(ref.table) || {}).label || ref.table) + " \u2014 " + stripLabel(def.label || ref.col) + " (row " + (ref.row + 1) + ")");
    let fix = "", example = "", source = "";
    if(K){ example = K.exampleFor(def); if(present(value)) fix = K.suggestFix(value, def); }
    if(kind === "required" || !fix){
      // the Create a Job / earlier-document value, when this fact is tracked, is the best "correct value"
      try{ const ctx = currentContext(); const ck = def.contextKey; if(ctx && ck && ctx[ck] && present(ctx[ck].value)){ const re = def.pattern ? new RegExp(def.pattern) : null; const cv = String(ctx[ck].value); if(!re || re.test(cv.trim())){ if(kind === "required" || !present(value)){ fix = cv; source = srcOf(ctx[ck]).text; } } } }catch(e){}
    }
    const exp = explainFor(def);
    return {id: "inv|" + (ref.name || ref.table + ":" + ref.row + ":" + ref.col) + "|" + String(value), kind, sev: "error", ref, stepIdx: G("currentStep"), label, entered: present(value) ? value : "", msg, example, fix, source, def,
      ex: {title: kind === "required" ? "Required box is empty" : "Not in the right format"}, whyHtml: exp ? sectionsHtml(exp, ["what","help","why","format","example","mistakes","hint","term"]) : ""};
  }
  const stripLabel = x => String(x == null ? "" : x).replace(/<[^>]*>/g, "").replace(/\s*\*\s*$/, "").trim();

  /* ---------- the popup next to a field ---------- */
  function hidePopup(){ const p = el("skAsstPop"); if(p) p.remove(); popFor = null; popRef = null; }
  function placePopup(pop, inp){
    const mobile = window.innerWidth < 640;
    if(mobile || !inp){ pop.classList.add("sheet"); pop.style.left = pop.style.top = ""; return; }
    pop.classList.remove("sheet");
    const r = inp.getBoundingClientRect(), w = Math.min(390, window.innerWidth - 24);
    pop.style.width = w + "px";
    const avail = window.innerHeight - 20;
    pop.style.maxHeight = avail + "px";                       // never taller than the screen: it scrolls inside instead
    const h = Math.min(pop.offsetHeight || 220, avail);
    let top = r.bottom + 10;
    if(top + h > window.innerHeight - 10) top = r.top - h - 10;   // try above the field
    top = Math.min(Math.max(10, top), Math.max(10, window.innerHeight - h - 10));   // always fully on screen (even if the field itself is scrolled out of view)
    const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
  function popupShell(cls, headLabel){
    ensureShell(); hidePopup();
    const pop = document.createElement("div"); pop.id = "skAsstPop"; pop.setAttribute("role", "alertdialog"); pop.setAttribute("aria-label", "Lyra"); pop.className = cls;
    pop.innerHTML = '<div class="sk-pop-head">' + AVATAR + '<div><b>Lyra</b><small>' + esc(headLabel) + '</small></div><button type="button" class="sk-x" data-p="close" aria-label="Close">\u00d7</button></div><div class="sk-pop-main"></div>';
    document.body.appendChild(pop); return pop;
  }
  function showPopup(issue, inp){
    const pop = popupShell("sev-" + issue.sev, issue.label);
    pop.querySelector(".sk-pop-main").innerHTML =
      '<div class="sk-pop-msg">' + sentence(issue) + '</div>' +
      '<details class="sk-pop-why"' + (issue.kind === "invalid" || issue.kind === "required" ? " open" : "") + '><summary>' + (issue.kind === "invalid" || issue.kind === "required" ? "What is this box?" : "Why does this matter?") + '</summary>' + whyHtml(issue) + '</details>' +
      '<div class="sk-actions">' + (canFix(issue) ? '<button type="button" class="sk-fix" data-p="fix">Use ' + esc(String(fixValue(issue)).length > 20 ? "correct value" : fixValue(issue)) + '</button>' : '') +
        '<button type="button" class="sk-ghost" data-p="keep">Keep mine</button></div>';
    popFor = issue.id; popRef = issue.ref; placePopup(pop, inp); requestAnimationFrame(() => { if(el("skAsstPop") === pop) placePopup(pop, inp); });
    pop.addEventListener("click", ev => {
      const t = ev.target.closest("[data-p]"); if(!t) return;
      if(t.dataset.p === "close"){ hidePopup(); refresh(); }
      else if(t.dataset.p === "keep"){ dismiss(issue.id); hidePopup(); refresh(); }
      else if(t.dataset.p === "fix"){ setValue(issue.ref, String(fixValue(issue))); hidePopup(); showBubble("\u2713 Fixed."); refresh(); }
    });
  }
  /* "what is this box?" popup opened by the \u2726 button next to every label */
  function showHelp(def, anchor, titleOverride){
    if(!stillUnlocked()){ needCode(() => showHelp(def, anchor, titleOverride)); return; }
    const exp = explainFor(def); if(!exp){ showBubble("Lyra\u2019s knowledge file didn\u2019t load \u2014 refresh the page."); return; }
    const pop = popupShell("help", stripLabel(titleOverride || def.label || def.name));
    pop.querySelector(".sk-pop-main").innerHTML =
      '<div class="sk-help-body">' + sectionsHtml(exp) + '</div>' + webLinks(stripLabel(def.label || def.name) + (exp.terms[0] ? "" : "")) +
      '<div class="sk-actions"><button type="button" class="sk-ghost" data-p="ask">Ask Lyra something else</button></div>';
    popRef = null; placePopup(pop, anchor); requestAnimationFrame(() => { if(el("skAsstPop") === pop) placePopup(pop, anchor); });
    pop.addEventListener("click", ev => {
      const t = ev.target.closest("[data-p]"); if(t){ if(t.dataset.p === "close"){ hidePopup(); try{ refresh(); }catch(e){} } else if(t.dataset.p === "ask"){ openPanel("step", "ask"); } return; }
      const w = ev.target.closest("[data-web]"); if(w) runWeb(w.dataset.web, pop.querySelector(".sk-web-out"), w);
    });
  }
  window.addEventListener("keydown", e => { if(e.key === "Escape" && el("skAsstPop")){ hidePopup(); try{ refresh(); }catch(e2){} } });
  const reposition = () => { const p = el("skAsstPop"); if(p && popRef) placePopup(p, findInput(popRef)); };
  window.addEventListener("resize", reposition); window.addEventListener("scroll", reposition, {passive: true});

  /* ---------- web lookup (user-initiated, optional) ---------- */
  async function runWeb(q, out, btn){
    const W = WEB_(); if(!W || !out) return;
    if(btn) btn.disabled = true; out.innerHTML = '<div class="sk-web-msg">Searching the web\u2026</div>';
    let r; try{ r = await W.search(q); }catch(e){ r = {ok: false, reason: "error", googleUrl: W.googleUrl(q)}; }
    if(btn) btn.disabled = false;
    if(!r.ok){
      out.innerHTML = '<div class="sk-web-msg">' + (r.reason === "offline" ? "You\u2019re offline, so I can\u2019t search the web right now. My built-in answers still work." : r.reason === "timeout" ? "The web search took too long. Try again, or open Google below." : "I couldn\u2019t reach the web search just now. You can open Google below instead.") + '</div>';
      return;
    }
    if(!r.results.length){ out.innerHTML = '<div class="sk-web-msg">No clear web result for \u201c' + esc(q) + '\u201d. Try different words, or open Google.</div>'; return; }
    out.innerHTML = r.results.map(x => '<div class="sk-web-card"><b>' + esc(x.title) + '</b>' + (x.description ? '<small>' + esc(x.description) + '</small>' : '') + '<p>' + esc(x.extract) + '</p><a class="sk-link" target="_blank" rel="noopener noreferrer" href="' + esc(x.url) + '">Read more on ' + esc(x.source) + ' \u2197</a></div>').join("") +
      '<div class="sk-web-note">From the web (Wikipedia) \u2014 general information, not specific to your exercise. Check it against your course notes.</div>';
  }

  /* ---------- "Ask Lyra" tab ---------- */
  function askHtml(){
    const K = KB_();
    if(!K) return '<div class="sk-empty"><b>Knowledge file not loaded.</b><p>Refresh the page to load Lyra\u2019s glossary.</p></div>';
    const cfg = G("CONFIG"), st = cfg && cfg.steps[G("currentStep")];
    const chips = []; const seen = new Set();
    ((st && st.fields) || []).forEach(f => { if(!f.label || chips.length >= 6) return; try{ const m = K.matchGlossary(stripLabel(f.label), 1)[0]; if(m && !seen.has(m.t) && m.t.length < 34 && !/^(Date|Place|Address|Contact|Name of|Remarks|Status|Signature|Prepared|Copies|Revision)/.test(m.t)){ seen.add(m.t); chips.push(m.t); } }catch(e){} });
    let h = '<form class="sk-ask-form" id="skAskForm"><input id="skAskInput" type="text" placeholder="Ask about any term \u2014 e.g. consignee, voyage no., IEC, FOB" value="' + esc(askQuery) + '" autocomplete="off"><button type="submit" class="sk-fix">Ask</button></form>';
    h += '<div class="sk-chips"><button type="button" class="sk-chip" data-q="__doc">\ud83d\udcc4 What is this document?</button>' + chips.map(c => '<button type="button" class="sk-chip" data-q="' + esc(c) + '">' + esc(c) + '</button>').join("") + '</div>';
    if(askQuery === "__doc") h += docHtml();
    else if(askQuery) h += resultsHtml(K.search(askQuery), askQuery);
    else h += '<div class="sk-empty"><b>Ask me anything about this shipment.</b><p>I know ' + K.stats().terms + '+ trade and logistics terms plus every box in all ' + (typeof DOCUMENT_CONFIGS !== "undefined" ? Object.keys(DOCUMENT_CONFIGS).length : "the") + ' documents. Tap the \u2726 next to any field label for that field\u2019s meaning.</p></div>';
    return h;
  }
  function docHtml(){
    const K = KB_(), cfg = G("CONFIG"); const d = K && K.explainDoc(cfg); if(!d) return "";
    return '<div class="sk-card sev-tip"><div class="sk-card-top"><span class="sk-sev">Document</span><b>' + esc(d.title) + '</b></div>' + (d.subtitle ? '<p class="sk-sec"><b>' + esc(d.subtitle) + '</b></p>' : '') + (d.what ? '<p class="sk-sec">' + esc(d.what) + '</p>' : '') +
      (d.objectives.length ? '<p class="sk-sec"><b>What you will learn:</b></p><ul class="sk-list">' + d.objectives.map(o => '<li>' + esc(o) + '</li>').join("") + '</ul>' : '') + '</div>';
  }
  function resultsHtml(r, q){
    let h = "";
    r.glossary.forEach(g => { h += '<div class="sk-card sev-tip"><div class="sk-card-top"><span class="sk-sev">Term</span><b>' + esc(g.t) + '</b></div><p class="sk-sec">' + esc(g.d) + '</p>' + (g.x ? '<p class="sk-sec"><b>Example:</b> <code>' + esc(g.x) + '</code></p>' : '') + (g.w ? '<p class="sk-sec"><b>Why it matters:</b> ' + esc(g.w) + '</p>' : '') + '</div>'; });
    r.docs.forEach(d => { const dd = KB_().explainDoc(d.c); h += '<div class="sk-card sev-tip"><div class="sk-card-top"><span class="sk-sev">Document</span><b>' + esc(dd.title) + '</b></div><p class="sk-sec">' + esc(dd.what.length > 360 ? dd.what.slice(0, 357) + "\u2026" : dd.what) + '</p></div>'; });
    if(r.fields.length) h += '<div class="sk-seen"><b>Boxes with this name:</b><ul class="sk-list">' + r.fields.map(f => '<li>\u201c' + esc(f.label) + '\u201d \u2014 in ' + esc(f.docs.join(", ")) + '</li>').join("") + '</ul></div>';
    if(!r.glossary.length && !r.docs.length && !r.fields.length) h += '<div class="sk-empty"><b>I don\u2019t have a built-in answer for \u201c' + esc(q) + '\u201d.</b><p>Try another spelling, or search the web below.</p></div>';
    return h + webLinks(q);
  }
  function bindAsk(root){
    const f = root.querySelector("#skAskForm");
    if(f) f.addEventListener("submit", e => { e.preventDefault(); askQuery = (root.querySelector("#skAskInput").value || "").trim(); renderPanel(); const i = el("skAskInput"); if(i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } });
    root.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { askQuery = b.dataset.q; renderPanel(); });
    root.querySelectorAll("[data-web]").forEach(b => b.onclick = () => runWeb(b.dataset.web, root.querySelector('.sk-web-out[data-for="' + CSS.escape(b.dataset.web) + '"]'), b));
  }

  /* ---------- the side panel ---------- */
  let shown = [];
  function cardHtml(i, idx){
    const sevLabel = i.sev === "error" ? (i.kind === "required" ? "Required" : i.kind === "invalid" ? "Format" : "Needs fixing") : i.sev === "warn" ? (i.kind === "format" ? "Format" : "Doesn\u2019t match") : "Tip";
    const attr = i.ref && i.ref.name ? ' data-ref="' + esc(i.ref.name) + '"' : (i.ref ? ' data-ref="' + esc(i.ref.table + ":" + i.ref.row + ":" + i.ref.col) + '"' : "");
    return '<div class="sk-card sev-' + i.sev + '"' + attr + '>' +
      '<div class="sk-card-top"><span class="sk-sev">' + sevLabel + '</span><b>' + esc(i.label) + '</b></div>' +
      '<div class="sk-pop-msg">' + sentence(i) + '</div>' +
      '<details' + (i.kind === "invalid" || i.kind === "required" ? " open" : "") + '><summary>' + (i.kind === "invalid" || i.kind === "required" ? "What is this box?" : "Why does this matter?") + '</summary>' + whyHtml(i) + '</details>' +
      '<div class="sk-actions">' + (canFix(i) ? '<button type="button" class="sk-fix" data-act="fix" data-idx="' + idx + '">Use ' + esc(String(fixValue(i)).length > 20 ? "correct value" : fixValue(i)) + '</button>' : '') +
        '<button type="button" data-act="show" data-idx="' + idx + '">Show me</button>' + (i.kind === "invalid" || i.kind === "required" ? '' : '<button type="button" class="sk-ghost" data-act="ignore" data-idx="' + idx + '">Keep mine</button>') + '</div></div>';
  }
  function pendingInvalids(){
    if(!invalidSnap || invalidSnap.step !== G("currentStep")) return [];
    const out = [];
    invalidSnap.items.forEach(it => {
      const def = defForRef(it.ref); const v = valueOfRef(it.ref); const has = present(v);
      let still = true;
      if(it.kind === "required") still = !has; else if(def && def.pattern && has){ try{ still = !new RegExp(def.pattern).test(String(v).trim()); }catch(e){ still = true; } } else if(it.kind === "invalid") still = !has ? true : false;
      if(it.table) still = it.kind === "required" ? true : still;
      if(still){ const fresh = (it.kind === "required" || it.kind === "invalid") ? buildInvalidItem(it.ref, it.msg, it.kind) : null; out.push(fresh || it); }
    });
    return out;
  }
  function renderPanel(scope){
    ensureShell();
    const p = el("skAsstPanel"), on = isOn(); scope = scope || p.dataset.scope || "step";
    const tab = panelTab;
    const invalids = on && tab === "check" && scope === "step" ? pendingInvalids() : [];
    let issuesNow = on && tab === "check" ? currentIssues(scope) : [];
    if(invalids.length){
      // one card per box: fold the "doesn't match Create a Job" info into the red-box card
      issuesNow = issuesNow.filter(is => {
        const inv = invalids.find(x => sameRef(x.ref, is.ref)); if(!inv || (is.kind !== "mismatch" && is.kind !== "format")) return true;
        if(!inv.fix && present(is.expected)){ inv.fix = String(is.expected); inv.source = is.source; }
        return false;
      });
    }
    shown = on ? invalids.concat(issuesNow) : [];
    let body;
    if(!on) body = '<div class="sk-empty"><b>Lyra is switched off for this Shipment Lot.</b><p>Switch her on to get live checks while you fill each document.</p></div>';
    else if(tab === "ask") body = askHtml();
    else if(!shown.length) body = '<div class="sk-empty ok"><b>All good here \u2713</b><p>I compared this ' + (scope === "all" ? "document" : "step") + ' with what you wrote in <i>Create a Job</i> and the documents you already finished. Nothing to flag. Not sure what a box means? Tap the \u2726 next to its label, or open <i>Ask Lyra</i>.</p></div>';
    else body = '<div class="sk-lead">' + (invalids.length ? 'These boxes stopped <b>Save &amp; Continue</b>. ' : 'I found <b>' + shown.length + '</b> thing' + (shown.length > 1 ? "s" : "") + (scope === "all" ? " in this document" : " on this step") + '. ') + 'Fix with one tap, or tap <i>Show me</i>.</div>' + shown.map(cardHtml).join("");
    p.innerHTML =
      '<div class="sk-head"><div class="sk-title">' + AVATAR + '<div><b>Lyra</b><small>Your shipment assistant \u00b7 works offline</small></div></div>' +
        '<label class="sk-switch" title="Turn Lyra on or off for this Shipment Lot"><input type="checkbox" id="skAsstToggle" ' + (on ? "checked" : "") + '><span>' + (on ? "On" : "Off") + '</span></label>' +
        '<button type="button" class="sk-x" id="skAsstClose" aria-label="Close Lyra">\u00d7</button></div>' +
      '<div class="sk-tabs" role="tablist"><button type="button" role="tab" class="' + (tab === "check" ? "on" : "") + '" id="skTabCheck">Check my work</button><button type="button" role="tab" class="' + (tab === "ask" ? "on" : "") + '" id="skTabAsk">Ask Lyra</button></div>' +
      '<div class="sk-body">' + body + '</div>' +
      (tab === "check" && on ? '<div class="sk-foot"><button type="button" id="skAsstAll">Check the whole document</button><button type="button" id="skAsstStep">This step</button></div>' : "");
    p.dataset.scope = scope;
    el("skAsstClose").onclick = closePanel;
    el("skAsstToggle").onchange = e => { setOn(e.target.checked); hidePopup(); refresh(); injectHelpers(); renderPanel(scope); };
    el("skTabCheck").onclick = () => { panelTab = "check"; renderPanel(scope); };
    el("skTabAsk").onclick = () => { panelTab = "ask"; renderPanel(scope); };
    const a = el("skAsstAll"), s = el("skAsstStep"); if(a) a.onclick = () => renderPanel("all"); if(s) s.onclick = () => renderPanel("step");
    p.querySelectorAll("[data-act]").forEach(b => b.onclick = () => act(b.dataset.act, +b.dataset.idx));
    if(tab === "ask" && on) bindAsk(p);
  }
  function openPanel(scope, tab){ ensureShell(); if(!stillUnlocked()){ needCode(() => openPanel(scope, tab)); return; } hidePopup(); panelOpen = true; if(tab) panelTab = tab; el("skAsstPanel").hidden = false; document.body.classList.add("sk-asst-open"); renderPanel(scope || "step"); }
  function closePanel(){ panelOpen = false; const p = el("skAsstPanel"); if(p) p.hidden = true; document.body.classList.remove("sk-asst-open"); if(!uiVisible()) unlockedFlag = false; try{ refresh(); }catch(e){} }   // closing Lyra locks her again
  function togglePanel(){ panelOpen ? closePanel() : openPanel(); }

  function findInput(ref){
    if(!ref) return null;
    if(ref.name) return document.querySelector('[data-field="' + CSS.escape(ref.name) + '"]') || document.getElementById("tbody-" + ref.name);
    return document.querySelector('[data-table="' + CSS.escape(ref.table) + '"][data-row="' + ref.row + '"][data-col="' + CSS.escape(ref.col) + '"]');
  }
  function refOf(inp){
    if(inp.dataset.field) return {name: inp.dataset.field};
    if(inp.dataset.table) return {table: inp.dataset.table, row: +inp.dataset.row, col: inp.dataset.col};
    return null;
  }
  const sameRef = (a, b) => a && b && ((a.name && a.name === b.name) || (a.table && a.table === b.table && a.row === b.row && a.col === b.col));
  function setValue(ref, value){
    const inp = findInput(ref);
    if(inp && "value" in inp){ inp.value = value; inp.dispatchEvent(new Event("input", {bubbles: true})); inp.dispatchEvent(new Event("change", {bubbles: true})); return true; }
    const fd = G("formData"); if(!fd) return false;
    if(ref.name){ fd[ref.name] = value; return true; }
    if(Array.isArray(fd[ref.table]) && fd[ref.table][ref.row]){ fd[ref.table][ref.row][ref.col] = value; return true; }
    return false;
  }
  function highlight(ref){
    const inp = findInput(ref); if(!inp) return false;
    inp.scrollIntoView({block: "center", behavior: "smooth"});
    inp.classList.add("sk-asst-hl"); try{ if(inp.focus) inp.focus({preventScroll: true}); }catch(e){}
    setTimeout(() => inp.classList.remove("sk-asst-hl"), 2600); return true;
  }
  function act(kind, idx){
    const i = shown[idx]; if(!i) return;
    if(kind === "fix"){ setValue(i.ref, String(fixValue(i))); }
    else if(kind === "show"){
      if(!highlight(i.ref) && i.stepIdx >= 0 && i.stepIdx !== G("currentStep")){ try{ currentStep = i.stepIdx; renderStep(i.stepIdx); setTimeout(() => highlight(i.ref), 200); }catch(e){} }
      return;
    }
    else if(kind === "ignore"){ dismiss(i.id); }
    refresh(); renderPanel(el("skAsstPanel").dataset.scope);
  }

  function showBubble(text){
    ensureShell(); const b = el("skAsstBubble"); b.textContent = text; b.hidden = false;
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(hideBubble, 6000);
  }
  function hideBubble(){ const b = el("skAsstBubble"); if(b) b.hidden = true; }

  function refresh(){
    ensureShell();
    const btn = el("skAsstBtn"), badge = el("skAsstBadge");
    const lk = !stillUnlocked(); btn.classList.toggle("sk-locked", lk); btn.title = lk ? "Lyra is locked \u2014 developer code needed" : "";
    const on = isOn() && !lk; btn.classList.toggle("off", !isOn());
    document.querySelectorAll(".sk-asst-flag").forEach(n => n.classList.remove("sk-asst-flag"));
    if(!on){ badge.hidden = true; lastCount = 0; return []; }
    const issues = currentIssues("step");
    const real = issues.filter(i => i.sev !== "tip");
    const pend = pendingInvalids().length;
    badge.textContent = String(real.length + pend || issues.length); badge.hidden = (issues.length + pend) === 0; badge.classList.toggle("tip", real.length + pend === 0);
    issues.forEach(i => { const inp = findInput(i.ref); if(inp && i.sev !== "tip") inp.classList.add("sk-asst-flag"); });
    return issues;
  }

  /* ---------- the \u2726 help buttons beside every label / column header, and beside red error messages ---------- */
  function injectHelpers(){
    document.querySelectorAll(".sk-qbtn").forEach(b => b.remove());
    if(!isOn() || !KB_()) return;
    const cfg = G("CONFIG"), st = cfg && cfg.steps[G("currentStep")]; if(!st) return;
    const mk = (def, titleOverride) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "sk-qbtn"; b.textContent = "\u2726";
      b.setAttribute("aria-label", "Ask Lyra what \u201c" + stripLabel(titleOverride || def.label || def.name) + "\u201d means"); b.title = "Ask Lyra what this means";
      b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); showHelp(def, b, titleOverride); });
      return b;
    };
    (st.fields || []).forEach(f => {
      if(!f.name || f.type === "static" || f.type === "heading") return;
      if(f.type === "table"){
        const tb = document.getElementById("tbody-" + f.name); const table = tb && tb.closest("table"); if(!table) return;
        const ths = Array.from(table.querySelectorAll("thead th"));
        (f.columns || []).forEach(col => {
          const lab = stripLabel(col.label || col.key).toLowerCase(); if(!lab) return;
          const th = ths.find(t => t.textContent.replace(/\u2726/g, "").replace(/\*/g, "").trim().toLowerCase().startsWith(lab));
          if(th && !th.querySelector(".sk-qbtn")){ const cd = Object.assign({}, col, {name: f.name + "." + col.key, label: col.label || col.key, required: false}); th.appendChild(mk(cd, (f.label ? stripLabel(f.label) + " \u2014 " : "") + (col.label || col.key))); }
        });
        const wrap = tb.closest(".field"); const lab = wrap && wrap.querySelector("label"); if(lab && !lab.querySelector(".sk-qbtn")) lab.appendChild(mk(f));
        return;
      }
      const inp = document.querySelector('[data-field="' + CSS.escape(f.name) + '"]'); if(!inp) return;
      const wrap = inp.closest(".field"); const lab = wrap && wrap.querySelector("label"); if(lab && !lab.querySelector(".sk-qbtn")) lab.appendChild(mk(f));
    });
    // red error messages get an "Explain" button that opens Lyra's card for that box
    document.querySelectorAll(".ferr").forEach(fe => {
      if(fe.querySelector(".sk-ferr-btn")) return;
      const wrap = fe.closest(".field"); if(!wrap) return;
      const inp = wrap.querySelector("[data-field]"); const tb = wrap.querySelector("tbody[id^='tbody-']");
      const name = inp ? inp.dataset.field : (tb ? tb.id.replace(/^tbody-/, "") : null); if(!name) return;
      const b = document.createElement("button"); b.type = "button"; b.className = "sk-ferr-btn"; b.textContent = "\u2726 Explain";
      b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); needCode(() => { if(!invalidSnap || invalidSnap.step !== G("currentStep")) captureInvalid(); openPanel("step", "check"); const card = el("skAsstPanel").querySelector('[data-ref="' + CSS.escape(name) + '"]') || el("skAsstPanel").querySelector('[data-ref^="' + CSS.escape(name) + ':"]'); if(card) card.scrollIntoView({block: "center"}); else { const d = stepFieldDef(name); if(d) showHelp(d, b); } }); });
      fe.appendChild(document.createTextNode(" ")); fe.appendChild(b);
    });
  }

  /* what stopped Save & Continue: read the engine's own validation result */
  function captureInvalid(){
    const items = [];
    try{
      const FE = typeof fieldErrors !== "undefined" ? fieldErrors : null, MSG = typeof fieldErrorMsgs !== "undefined" ? fieldErrorMsgs : {}, CE = typeof tableCellErrors !== "undefined" ? tableCellErrors : null;
      const seenTables = new Set();
      if(CE) Array.from(CE).forEach(key => { const [tbl, row, col] = String(key).split(":"); const def = stepFieldDef(tbl); const cp = def && def.cellPatterns && def.cellPatterns[col]; const it = buildInvalidItem({table: tbl, row: +row, col}, (cp && cp.msg) || "This cell isn\u2019t in the right format.", "invalid"); if(it){ items.push({ref: it.ref, kind: "invalid", msg: it.msg}); seenTables.add(tbl); } });
      if(FE) Array.from(FE).forEach(name => {
        const def = stepFieldDef(name); if(!def) return;
        if(def.type === "table"){ if(!seenTables.has(name)){ const msgs = (typeof tableErrorMsgs !== "undefined" && tableErrorMsgs[name]) || []; items.push({ref: {name}, kind: "required", msg: msgs[0] || def.errorMsg || "Please complete at least one row."}); } return; }
        const v = (G("formData") || {})[name]; const has = present(v);
        items.push({ref: {name}, kind: has ? "invalid" : "required", msg: MSG[name] || (has ? "Invalid format." : "This field is required.")});
      });
    }catch(e){}
    invalidSnap = {step: G("currentStep"), items};
    return items;
  }
  window.skAssistantOnInvalid = function(){
    try{
      if(!isOn()) return;
      if(!stillUnlocked()){ try{ injectHelpers(); }catch(e){} return; }   // locked: stay silent
      ensureShell(); hidePopup();
      const items = captureInvalid(); if(!items.length) return;
      injectHelpers(); refresh();
      openPanel("step", "check");
      const first = items[0]; setTimeout(() => { try{ highlight(first.ref); }catch(e){} }, 120);
    }catch(e){}
  };

  /* A field was edited: pop up for a mismatch (priority) or a wrong format. */
  function onFieldActivity(ev){
    if(!isOn() || !stillUnlocked()) return;   // locked: no popups, no bubble
    const inp = ev.target && ev.target.closest ? ev.target.closest("[data-field],[data-table]") : null;
    const run = () => {
      try{
        const issues = refresh();
        const real = issues.filter(i => i.sev !== "tip");
        const ref = inp ? refOf(inp) : null;
        let mine = ref ? real.find(i => sameRef(i.ref, ref)) : null;
        // wrong format (only when the student leaves the box, never while typing)
        if(mine && ref && ev.type === "change" && mine.kind === "mismatch"){
          const d0 = defForRef(ref), v0 = valueOfRef(ref);
          if(d0 && d0.pattern && present(v0)){ let bad0 = false; try{ bad0 = !new RegExp(d0.pattern).test(String(v0).trim()); }catch(e){} if(bad0) mine.patternNote = d0.patternMsg || "This box also has a required format."; }
        }
        if(!mine && ref && ev.type === "change"){
          const def = defForRef(ref), v = valueOfRef(ref);
          if(def && def.pattern && present(v)){ let bad = false; try{ bad = !new RegExp(def.pattern).test(String(v).trim()); }catch(e){} if(bad){ const it = buildInvalidItem(ref, def.patternMsg || "Invalid format.", "invalid"); if(it && !dismissed().has(it.id)) mine = it; } }
        }
        if(mine && !panelOpen){ showPopup(mine, findInput(mine.ref)); }
        else if(ref && popFor && !(real.some(i => i.id === popFor)) && !(mine && mine.id === popFor)) hidePopup();
        else if(!mine && real.length > lastCount && !panelOpen && !el("skAsstPop")){ const f = real[0]; showBubble("Lyra: I noticed something in \u201c" + (f.label.length > 36 ? f.label.slice(0, 34) + "\u2026" : f.label) + "\u201d \u2014 tap to see."); }
        lastCount = real.length;
        if(panelOpen) renderPanel(el("skAsstPanel").dataset.scope);
      }catch(e){}
    };
    clearTimeout(evalTimer);
    if(ev.type === "change") run(); else evalTimer = setTimeout(run, 1300);
  }

  /* --- hooks called by engine.js --------------------------------------------------- */
  window.skAssistantAfterRender = function(){
    try{
      ensureShell(); hidePopup();
      if(!delegated){
        const body = document.getElementById("stepBody");
        if(body){ body.addEventListener("input", onFieldActivity); body.addEventListener("change", onFieldActivity); delegated = true; }
      }
      if(invalidSnap && invalidSnap.step !== G("currentStep")) invalidSnap = null;
      lastCount = 0; hideBubble();
      const issues = refresh(); lastCount = issues.filter(i => i.sev !== "tip").length;
      injectHelpers();
      if(panelOpen) renderPanel(el("skAsstPanel").dataset.scope);
    }catch(e){}
  };

  /* Called by goNext() after the engine's own required-field validation has passed.
     Return false to hold the step change; the student always has "Continue anyway". */
  window.skAssistantGate = function(){
    try{
      if(!isOn() || !stillUnlocked() || window.skAssistantBypassOnce) return true;   // locked: never holds navigation
      const cfg = G("CONFIG"); const step = cfg && cfg.steps[G("currentStep")];
      const scope = step && step.custom === "review" ? "all" : "step";
      const real = currentIssues(scope).filter(i => i.sev !== "tip");
      if(!real.length) return true;
      hidePopup(); showGate(real, scope);
      return false;
    }catch(e){ return true; }
  };

  function showGate(real, scope){
    ensureShell();
    let m = el("skAsstGate"); if(m) m.remove();
    m = document.createElement("div"); m.id = "skAsstGate"; m.setAttribute("role", "alertdialog"); m.setAttribute("aria-modal", "true");
    const first = real.slice(0, 3).map(i => '<li><b>' + esc(i.label) + '</b><br>' + sentence(i) + '</li>').join("");
    m.innerHTML = '<div class="sk-gate-card"><div class="sk-gate-head">' + AVATAR + '<h3>Lyra here \u2014 wait a moment</h3></div><p class="sk-gate-sub">I spotted ' + real.length + ' thing' + (real.length > 1 ? "s" : "") + (scope === "all" ? " in this document" : " on this step") + ':</p>' +
      '<ul>' + first + (real.length > 3 ? '<li>\u2026and ' + (real.length - 3) + ' more</li>' : '') + '</ul>' +
      '<p class="sk-gate-note">In a real shipment a mismatch like this is what gets cargo held or a bank payment refused.</p>' +
      '<div class="sk-gate-actions"><button type="button" id="skGateReview" class="sk-fix">Review &amp; fix</button><button type="button" id="skGateGo" class="sk-ghost">Continue anyway</button></div></div>';
    document.body.appendChild(m);
    const close = () => m.remove();
    el("skGateReview").onclick = () => { openPanel(scope, "check"); close(); };
    el("skGateGo").onclick = () => { close(); window.skAssistantBypassOnce = true; try{ goNext(); }finally{ window.skAssistantBypassOnce = false; } };
    m.addEventListener("keydown", e => { if(e.key === "Escape") close(); });
    el("skGateReview").focus();
  }

  window.SkAssistant = {evaluate, kbFor, containerCheckDigit, isOn, setOn, KB, open: openPanel, close: closePanel, refresh, sentence, injectHelpers, captureInvalid, showHelp: (name) => { const d = stepFieldDef(name); if(d) showHelp(d, findInput({name})); }};
})();
