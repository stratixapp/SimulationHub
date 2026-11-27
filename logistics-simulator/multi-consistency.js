/* =========================================================================
   MULTI-CONTAINER / MULTI-HSN CONSISTENCY ACROSS DOCUMENTS
   -------------------------------------------------------------------------
   A Job can carry several containers (number + container company) and several
   items with different HS / HSN codes.  The first container / HS code has
   always autofilled into every document that restates it, but a second or
   third one had nowhere to go.  This file makes all of those documents
   consistent, without touching documents-data.js:

   1. CONTAINER_FIELDS - documents with a single "Container No." box get an
      optional "Additional Containers" table (number, company, seal) right
      below it, pre-filled with Container 2..n from the Job.
   2. HS_FIELDS - documents with a single "HS Code" box get an optional
      "Additional HS / HSN Codes" table, pre-filled with the Job's other
      DISTINCT HS codes (and their descriptions).
   3. CONTAINER_TABLES - documents that already list containers in a table
      (Bill of Lading, Mate Receipt, Delivery Order, Shipping Bill ...) now
      autofill one row per Job container instead of a single row.
   4. The review / PDF of every touched document prints all containers and all
      HS codes in the original box (comma separated), so what the student
      typed is what the document shows.

   Cross-document checks accept ANY of the Job's containers / HS codes (see
   _sk_multiAccepted in workflow-rules.js).  Loaded after documents-data.js and
   the other config extensions, before engine.js.
   ========================================================================= */
(function(){
  "use strict";
  if(typeof DOCUMENT_CONFIGS === "undefined") return;

  const C = (key,label,placeholder,extra) => Object.assign({key,label,placeholder}, extra||{});
  const ISO = {pattern:"^[A-Z]{4}[0-9]{7}$", msg:"must be 4 letters + 7 digits (ISO 6346), e.g. TCLU7654321."};

  /* [slug, container field name, (optional) insert the table after this field instead] */
  const CONTAINER_FIELDS = [
    ["container-packing-certificate","containerNo","containerSizeType"],
    ["seal-report","containerNo"],
    ["commercial-invoice","containerNo"], ["lorry-receipt","containerNumber"], ["insurance-certificate","containerNumberIns"],
    ["warehouse-receipt","containerNoGate"], ["fumigation-certificate","containerNumber"], ["weight-certificate","containerNo"],
    ["sea-waybill","containerNumberSwb"], ["dangerous-goods-declaration","containerNo"], ["out-of-charge","containerNo"],
    ["vgm-certificate","containerNo"], ["import-packing-list","containerNo"], ["examination-report","containerNo"],
    ["freight-invoice-sea","containerNo"], ["container-destuffing","containerNo"], ["customs-gate-pass","containerNo"],
    ["equipment-interchange-receipt","containerNo"], ["demurrage-detention-invoice","containerNo"], ["weighbridge-slip","containerNo"]
  ];
  /* [slug, HS field name] - the item's HS code is also given the Job's txn.hsCode key where it had none */
  const HS_FIELDS = [
    ["mate-receipt","hsCode"], ["shipping-instructions","hsCode"], ["warehouse-receipt","hsCode"], ["sea-waybill","hsCodeSwb"],
    ["insurance-certificate","hsCodeIns"], ["export-declaration","hsCodeClassified"], ["out-of-charge","hsCodeAssessed"],
    ["import-permit","hsCode"], ["export-permit","hsCode"]
  ];
  /* [slug, table name, container column, {other column: whole-shipment contextKey filled only when there is ONE container}] */
  const CONTAINER_TABLES = [
    ["bill-of-lading-sea","containers","containerNo",{sealNo:"txn.sealNo"}],
    ["shipping-bill","containerDetails","containerNo",{sealNumber:"txn.sealNo"}],
    ["bill-of-entry","containerDetails","containerNo",{sealNumber:"txn.sealNo"}],
    ["delivery-order","containers","containerNo",{sealNo:"txn.sealNo"}],
    ["mate-receipt","mrContainers","containerNo",{sealNo:"txn.sealNo"}],
    ["arrival-notice","anContainers","containerNo",{sealNo:"txn.sealNo"}],
    ["master-bill-of-lading","containerCargo","containerNo",{sealNumber:"txn.sealNo", noOfPackages:"txn.noOfPackages", grossWeight:"txn.grossWeight"}],
    ["shipping-order","cargoToLoad","containerNo",{noOfPackages:"txn.noOfPackages", grossWeight:"txn.grossWeight"}],
    ["cfs-gate-pass","containerDetailsGP","containerNumberGP",{sealNumberGP:"txn.sealNo", packagesGP:"txn.noOfPackages", grossWeightGP:"txn.grossWeight"}],
    ["transshipment-permit","cargoDetailsTP","containerNumberTP",{sealNumberTP:"txn.sealNo", grossWeightTP:"txn.grossWeight"}]
  ];

  const has = v => v !== undefined && v !== null && String(v).trim() !== "";
  function locate(cfg, fieldName){
    for(let i=0;i<cfg.steps.length;i++){
      const fs = cfg.steps[i].fields || [];
      const j = fs.findIndex(f => f.name === fieldName);
      if(j >= 0) return {step:cfg.steps[i], fields:fs, j};
    }
    return null;
  }
  function tableByName(cfg, name){ for(const s of cfg.steps) for(const f of (s.fields||[])) if(f.type==="table" && f.name===name) return f; return null; }

  const reviewJobs = {};          // slug -> {containers:[fieldNames], hs:[fieldNames]}
  const job = slug => (reviewJobs[slug] = reviewJobs[slug] || {containers:[], hs:[]});

  /* ---- 1. additional containers */
  CONTAINER_FIELDS.forEach(([slug, fieldName, afterField])=>{
    const cfg = DOCUMENT_CONFIGS[slug]; if(!cfg) return;
    const at = locate(cfg, fieldName); if(!at){ console.warn("[multi-consistency] container field not found:", slug, fieldName); return; }
    job(slug).containers.push(fieldName);
    if(tableByName(cfg, "moreContainers")) return;
    let idx = at.j;
    if(afterField){ const k = at.fields.findIndex(f => f.name === afterField); if(k >= 0) idx = k; }
    at.fields.splice(idx + 1, 0, {
      type:"table", name:"moreContainers", label:"Additional Containers (if more than one)", required:false, addLabel:"Add Another Container",
      help:"The container above is Container 1. If the Job has more containers, each extra one is listed here - pre-filled from your Shipment Lot (number and container company). Add a row for any container that is missing.",
      autofillRows:[{from:"jobContainers", skip:1, map:{containerNo:"txn.containerNo", containerCompany:"txn.containerCompany"}}],
      cellPatterns:{containerNo:ISO},
      columns:[ C("containerNo","Container No. (ISO 6346)","TCLU7654321"), C("containerCompany","Container Company","MSC"), C("sealNo","Seal No. (optional)","ML-5520185") ]
    });
  });

  /* ---- 2. additional HS / HSN codes */
  HS_FIELDS.forEach(([slug, fieldName])=>{
    const cfg = DOCUMENT_CONFIGS[slug]; if(!cfg) return;
    const at = locate(cfg, fieldName); if(!at){ console.warn("[multi-consistency] HS field not found:", slug, fieldName); return; }
    job(slug).hs.push(fieldName);
    const f = at.fields[at.j];
    if(!f.contextKey) f.contextKey = "txn.hsCode";          // so the Job's HS code reaches this document too
    if(tableByName(cfg, "moreHsCodes")) return;
    at.fields.splice(at.j + 1, 0, {
      type:"table", name:"moreHsCodes", label:"Additional HS / HSN Codes (if the goods have more than one)", required:false, addLabel:"Add Another HS Code",
      help:"The HS code above is for the first item. If your Shipment Lot has goods under other HS / HSN codes, every distinct code is listed here with its description - pre-filled from the Job. Add a row for any code that is missing.",
      autofillRows:[{from:"jobItems", skip:1, distinct:"hsCode", map:{hsCode:"txn.hsCode", description:"txn.itemDescription"}}],
      cellPatterns:{hsCode:{pattern:"^\\d{6,10}$", msg:"must be a 6 to 10 digit HS / HSN code."}},
      columns:[ C("hsCode","HS / HSN Code","38190010"), C("description","Description of Goods","Brake fluid, 250 gm plastic bottles") ]
    });
  });

  /* ---- 3. container tables autofill one row per Job container */
  CONTAINER_TABLES.forEach(([slug, tableName, contCol, others])=>{
    const cfg = DOCUMENT_CONFIGS[slug]; if(!cfg) return;
    const t = tableByName(cfg, tableName); if(!t){ console.warn("[multi-consistency] container table not found:", slug, tableName); return; }
    if(t.autofillRows) return;
    const colKeys = (t.columns||[]).map(c=>c.key);
    const own = {}; Object.keys(others||{}).forEach(k=>{ if(colKeys.includes(k)) own[k] = others[k]; });
    const company = colKeys.includes("containerCompany") ? {containerCompany:"txn.containerCompany"} : {};
    t.autofillRows = [
      {from:"jobContainers", map:Object.assign({[contCol]:"txn.containerNo"}, company), singleOnly:own},
      {from:"context", map:Object.assign({[contCol]:"txn.containerNo"}, company, own)}
    ];
    if(t.help === undefined || t.help === "") t.help = "Pre-filled from the containers on your Shipment Lot - one row per container. Add a row for any container that is missing.";
  });

  /* ---- 4. GST e-invoice: HSN-wise tax summary gets the Job's HSN codes */
  (function(){
    const cfg = DOCUMENT_CONFIGS["gst-e-invoice-irn"]; if(!cfg) return;
    const t = tableByName(cfg, "taxSummaryEINV"); if(!t) return;
    // one row per DISTINCT HSN (a tax summary is HSN-wise, not item-wise); no contextKey so the per-item mismatch check does not apply
    if(!t.autofillRows) t.autofillRows = [{from:"jobItems", distinct:"hsnCodeEINV", map:{hsnCodeEINV:"txn.hsCode"}}, {from:"context", map:{hsnCodeEINV:"txn.hsCode"}}];
  })();

  /* ---- 5. review / PDF prints every container and every HS code in the original box */
  Object.keys(reviewJobs).forEach(slug=>{
    const cfg = DOCUMENT_CONFIGS[slug];
    const st = cfg.steps.find(s => typeof s.renderReview === "function");
    if(!st || st.__multiWrapped) return;
    const orig = st.renderReview, spec = reviewJobs[slug];
    const joinWith = (first, rows, key) => [first].concat(rows.map(r => r && r[key])).map(v => String(v==null?"":v).trim()).filter(Boolean).join(", ");
    st.renderReview = function(d){
      let d2 = d;
      try{
        d2 = Object.assign({}, d);
        const cr = (Array.isArray(d.moreContainers) ? d.moreContainers : []).filter(r => r && r.containerNo);
        const hr = (Array.isArray(d.moreHsCodes) ? d.moreHsCodes : []).filter(r => r && r.hsCode);
        if(cr.length) spec.containers.forEach(n => { d2[n] = joinWith(d[n], cr, "containerNo"); });
        if(hr.length) spec.hs.forEach(n => { d2[n] = joinWith(d[n], hr, "hsCode"); });
        if(slug === "mate-receipt" && has(d.cargoDescription)){ d2.cargoDescription = String(d.cargoDescription).trim() + "\nHS / HSN: " + joinWith(d.hsCode, hr, "hsCode"); }
      }catch(e){ d2 = d; }
      return orig.call(this, d2);
    };
    st.__multiWrapped = true;
  });
})();
