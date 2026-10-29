/* ============================================================
   TCOS — ICEGATE-FORMAT PRINT OF THE SHIPPING BILL / BILL OF ENTRY
   ------------------------------------------------------------
   The Shipping Bill and Bill of Entry that TCOS files are printed with the SAME
   renderers the Skelora Logistics Documentation Simulator uses
   (logistics-simulator/customs-forms.js -> renderShippingBillSpecimen,
    logistics-simulator/customs-forms-boe.js -> renderBillOfEntrySpecimen),
   so the TCOS PDF is the same A4 ICEGATE printout (Parts I-V / I-VI).

   This file is only the ADAPTER:
     tcosIcegateData(filing)  filing (+ timeline / duty / LEO / OOC / DSC)  ->  the formData
                              shape those renderers read. Blank optional fields are derived
                              from what the student did enter, so a print never shows
                              NaN / undefined.
     tcosRenderIcegateHtml()  -> .sb-page HTML      tcosIcegatePdf() -> jsPDF (one A4 page per .sb-page)
     tcosViewIcegateDoc / tcosPrintIcegateDoc / tcosDownloadIcegatePdf   UI entry points.
   The print is regenerated from the LIVE filing every time it is opened, so it always reflects the
   filing's current status (assessment, examination, LEO, OOC, challan ...).
   ============================================================ */

/* ICEGATE location codes for the Indian ports / airports offered in TCOS. */
const TCOS_ICEGATE_PORT_CODES = [
  ['Nhava Sheva', 'INNSA1'], ['Mumbai Port', 'INBOM4'], ['Mundra', 'INMUN1'], ['Kandla', 'INKDL1'],
  ['Chennai Port', 'INMAA1'], ['Ennore', 'INENR1'], ['Tuticorin', 'INTUT1'], ['Cochin Port', 'INCOK1'],
  ['Visakhapatnam', 'INVTZ1'], ['Krishnapatnam', 'INKRI1'], ['Kolkata', 'INCCU1'], ['Paradip', 'INPBD1'],
  ['New Mangalore', 'INNML1'], ['Mumbai (BOM) Airport', 'INBOM4'], ['Delhi (DEL) Airport', 'INDEL4'],
  ['Chennai (MAA) Airport', 'INMAA4'], ['Bengaluru (BLR) Airport', 'INBLR4'], ['Kochi (COK) Airport', 'INCOK4'],
  ['Hyderabad (HYD) Airport', 'INHYD4'], ['Ahmedabad (AMD) Airport', 'INAMD4'], ['Kolkata (CCU) Airport', 'INCCU4']
];
/* options shown in the wizard's "Customs House Code" dropdown ("CODE - location") */
const TCOS_ICEGATE_CODE_OPTIONS = (function () {
  const seen = new Set(), out = [];
  TCOS_ICEGATE_PORT_CODES.forEach(([name, code]) => { if (!seen.has(code)) { seen.add(code); out.push(code + ' - ' + name.replace(/ Airport$/, ' Air Cargo').replace(/^Mumbai Port$/, 'Mumbai Sea')); } });
  return out;
})();
function tcosCodeFromPortName(portName) {
  const n = String(portName || '').toLowerCase();
  if (!n) return '';
  for (const [name, code] of TCOS_ICEGATE_PORT_CODES) { if (n.indexOf(name.toLowerCase()) === 0 || n.indexOf(name.toLowerCase()) > -1) return code; }
  return '';
}
function tcosLeadingCode(v) { const m = /^([A-Za-z]{2}[A-Za-z0-9]{3,4})\b/.exec(String(v || '').trim()); return m ? m[1].toUpperCase() : ''; }

/* ---------- small helpers ---------- */
function icIso(ts) { const t = new Date(ts); return isNaN(t.getTime()) ? '' : t.toISOString(); }
function icDay(ts) { const t = new Date(ts); if (isNaN(t.getTime())) return ''; return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }
function icHM(ts) { const t = new Date(ts); return isNaN(t.getTime()) ? '' : String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); }
function icNum(v) { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
function icHas(v) { return v !== undefined && v !== null && String(v).trim() !== ''; }
function icPick() { for (let i = 0; i < arguments.length; i++) if (icHas(arguments[i])) return arguments[i]; return ''; }
function icTimelineTs(filing, stage) { const t = (filing.timeline || []).find(x => x.stage === stage); return t ? t.ts : null; }
function icSeqNo(id) { const tail = String(id || '').split('-').pop().replace(/\D/g, ''); return (tail || '1').slice(-7).padStart(7, '0'); }
function icShortCountryCode(country) {
  const map = { 'United Arab Emirates': 'AE', 'United States of America': 'US', 'United Kingdom': 'GB', 'Germany': 'DE', 'France': 'FR', 'Singapore': 'SG', 'Japan': 'JP', 'China': 'CN', 'Australia': 'AU', 'Netherlands': 'NL', 'Saudi Arabia': 'SA', 'Sri Lanka': 'LK', 'Bangladesh': 'BD', 'Malaysia': 'MY', 'South Korea': 'KR', 'Italy': 'IT', 'Canada': 'CA', 'Kenya': 'KE', 'South Africa': 'ZA', 'Thailand': 'TH', 'Vietnam': 'VN', 'Indonesia': 'ID', 'Qatar': 'QA', 'Oman': 'OM', 'Kuwait': 'KW' };
  return map[country] || (country ? String(country).slice(0, 2).toUpperCase() : '');
}

/* the person the print says it was prepared by (name + the role picked at Skelora login, when bridged) */
function tcosPreparedBy() {
  try {
    const p = (typeof STATE !== 'undefined' && STATE && STATE.user && STATE.user.profile) || {};
    let bridge = null;
    try { if (typeof DotBridge !== 'undefined' && DotBridge.getBridge) bridge = DotBridge.getBridge(); } catch (e) { /* ignore */ }
    const name = p.name || (STATE && STATE.user && STATE.user.userId) || '';
    if (!name) return null;
    const role = icPick(p.workRole, bridge && bridge.workRole, p.role);
    return { name: name, role: role, id: (STATE && STATE.user && STATE.user.userId) || p.userId || '' };
  } catch (e) { return null; }
}


/* Everything the student typed on the ICEGATE steps (filing.icegate, same field names as the Doc-Sim form)
   goes onto the renderer data - flat fields as-is, item-aligned tables merged row by row, other tables as rows. */
function tcosOverlayIcegate(d, ig, type) {
  const spec = (typeof TCOS_ICEGATE_SPEC !== 'undefined' && TCOS_ICEGATE_SPEC[type]) || [];
  spec.forEach(st => st.fields.forEach(f => {
    const v = ig[f.name];
    if (f.type !== 'table') { if (icHas(v)) d[f.name] = v; return; }
    if (!Array.isArray(v)) return;
    if (f.itemAligned) {
      const base = Array.isArray(d[f.name]) ? d[f.name] : [];
      d[f.name] = v.map((row, i) => {
        const o = Object.assign({}, base[i] || {}, { itemNo: i + 1 });
        Object.keys(row || {}).forEach(k => { if (icHas(row[k])) o[k] = row[k]; });
        return o;
      });
    } else {
      d[f.name] = v.filter(r => r && Object.keys(r).some(k => icHas(r[k])));
    }
  }));
}

/* ============================ SHIPPING BILL ============================ */
function tcosBuildSbData(filing) {
  const ig = filing.icegate || {}, P = filing.party || {}, C = filing.counterparty || {}, S = filing.shipment || {}, I = filing.invoice || {}, K = filing.packages || {};
  const items = Array.isArray(filing.items) ? filing.items : [];
  const sch = items.map((_, i) => Object.assign({}, (filing.itemScheme || [])[i], (ig.itemScheme || [])[i], (ig.itemExtra || [])[i]));
  const cur = icPick(I.currency, 'USD');
  const code = tcosLeadingCode(ig.customsHouseCode) || tcosCodeFromPortName(S.portOfLoading) || '';
  const ackTs = filing.ack ? filing.ack.date : null;
  const sbNo = filing.id ? icSeqNo(filing.id) : '';
  const submitted = !!filing.ack;
  const containers = (filing.containers || []).filter(c => c && icHas(c.containerNo));
  const hasDsc = !!filing.dsc;
  const d = {
    customsHouseCode: code,
    jobNumber: icPick(ig.jobNumber, filing.id), jobDate: icPick(ig.jobDate, icDay(filing.createdAt)),
    chaLicenseNo: icPick(ig.chaLicenseNo, ig.cbCode), iecNumber: P.iec, branchSerialNo: icPick(ig.branchSerialNo, '0'),
    exporterType: icPick(ig.exporterType, 'Manufacturer Exporter'), exporterName: P.exporterName, exporterAddress: P.address,
    gstin: P.gstin, gstinType: icPick(ig.gstinType, 'GSN'),
    cbName: icPick(ig.cbName, filing.brokerClientIec ? (STATE.user.profile && STATE.user.profile.name) : ''),
    adCode: ig.adCode, rbiWaiverNoDt: ig.rbiWaiverNoDt,
    aeoStatus: icPick(ig.aeoStatus, (typeof STATE !== 'undefined' && STATE.riskProfile && STATE.riskProfile.aeo) ? 'AEO' : ''),
    consigneeName: C.consigneeName, consigneeAddress: C.address,
    consigneeCountryCode: icPick(ig.consigneeCountryCode, icShortCountryCode(C.country)),
    forexBankAcNo: ig.forexBankAcNo, dbkBankAcNo: ig.dbkBankAcNo, ifscNo: ig.ifscNo,
    /* cargo & shipment */
    countryDestination: icPick(S.countryOfDestination, C.country), portDischarge: S.portOfDischarge,
    portOfLoading: S.portOfLoading ? (code ? code + ' (' + S.portOfLoading + ')' : S.portOfLoading) : '',
    natureOfCargo: icPick(ig.natureOfCargo, containers.length ? 'Containerized Cargo' : 'General Cargo'),
    grossWeight: K.grossWeight, netWeight: K.netWeight, noOfPackages: K.numberOfPackages, marksNumbers: K.marksNumbers,
    noOfContainers: icPick(ig.noOfContainers, containers.length || ''), mawbNumber: ig.mawbNumber, hawbNumber: ig.hawbNumber,
    mawbDate: ig.mawbDate, hawbDate: ig.hawbDate, sealType: ig.sealType, loosePackets: ig.loosePackets,
    stateOfOrigin: ig.stateOfOrigin, portFinalDestination: icPick(ig.portFinalDestination, C.port), countryDischarge: icPick(ig.countryDischarge, S.countryOfDestination, C.country),
    cinNo: ig.cinNo, cinDate: ig.cinDate, cinSiteId: ig.cinSiteId,
    /* invoice */
    commInvoiceNo: I.invoiceNo, invoiceDate: I.invoiceDate, invoiceCurrency: cur,
    buyerName: icPick(ig.buyerName, C.consigneeName), buyerAddress: icPick(ig.buyerAddress, C.address),
    natureOfContract: icPick(ig.natureOfContract, 'Sale'), freightCurrency: icPick(ig.freightCurrency, cur),
    freightAmount: I.freight, insuranceAmount: I.insurance, invoiceTerm: I.incoterm,
    poNo: ig.poNo, poDate: ig.poDate, locNo: ig.locNo, locDate: ig.locDate, contractNo: ig.contractNo, contractDate: ig.contractDate,
    thirdPartyName: ig.thirdPartyName, thirdPartyAddress: ig.thirdPartyAddress, buyerAeoStatus: ig.buyerAeoStatus,
    discountAmt: ig.discountAmt, commissionAmt: ig.commissionAmt, deductionsAmt: ig.deductionsAmt, packingCharges: ig.packingCharges,
    currencyCode: cur, exchangeRate: icPick(ig.exchangeRate, (typeof FX_TO_INR !== 'undefined' && FX_TO_INR[cur]) || (cur === 'INR' ? 1 : '')),
    /* items */
    itemDetails: items.map((it, i) => {
      const s = sch[i] || {};
      return {
        hsCode: it.hsCode, description: it.description, quantity: it.qty, unit: it.unit, unitPrice: it.unitPrice,
        presentMarketValue: s.presentMarketValue, countryMfg: it.origin, sourceState: icPick(s.sourceState, ig.stateOfOrigin), endUse: s.endUse
      };
    }),
    itemScheme: items.map((it, i) => {
      const s = sch[i] || {};
      return {
        itemNo: i + 1, dbkClaimed: icPick(s.dbkClaimed, 'N'), dbkSlNo: s.dbkSlNo, dbkRatePct: s.dbkRatePct,
        rodtepClaimed: icPick(s.rodtepClaimed, 'N'), rodtepRatePct: s.rodtepRatePct,
        igstStatus: icPick(s.igstStatus, (ig.lut === 'Y') ? 'LUT' : 'P'), igstRatePct: icPick(s.igstRatePct, 18),
        schemeCode: s.schemeCode, schemeDescription: s.schemeDescription, sqcMsr: s.sqcMsr, sqcUqc: s.sqcUqc,
        districtOrigin: s.districtOrigin, ptAbroad: s.ptAbroad, compCess: s.compCess, ftaBenefit: s.ftaBenefit, rewardBenefit: s.rewardBenefit, thirdPartyItem: s.thirdPartyItem
      };
    }),
    containerDetails: containers.map(c => ({ containerNo: c.containerNo, containerSize: c.containerType, sealNumber: c.sealNo, sealDate: icDay(ackTs) })),
    /* flags — blank means "derive" inside the renderer */
    assess: icPick(ig.assess, 'Y'),
    exmn: icPick(ig.exmn, (filing.examination && filing.examination.required) ? 'Y' : 'N'),
    jobbing: ig.jobbing, meis: ig.meis, dbk: ig.dbk, rodtp: ig.rodtp,
    deecDfia: icPick(ig.deecDfia, (filing.scheme && filing.scheme.type === 'Advance Authorization') ? 'Y' : 'N'),
    dfrc: ig.dfrc, reExp: ig.reExp, lut: ig.lut,
    licenceLines: (filing.scheme && filing.scheme.licenseNo) ? [{
      invSno: '1', itemSno: '1', licenceNo: filing.scheme.licenseNo, descnExportItem: items[0] && items[0].description,
      expSno: '1', expQty: items[0] && items[0].qty, uqc: items[0] && items[0].unit, fobValue: I.fobValue
    }] : [],
    supportingDocs: (filing.documents || []).filter(x => x && x.status === 'ATTACHED TO FILING').map(x => ({
      invsn: '1', itmsn: '1', docTypeCd: (typeof ESANCHIT_CODES !== 'undefined' && ESANCHIT_CODES[x.type]) || '', icegateId: String(P.iec || '').toUpperCase(),
      irn: x.refNo || '', issueDt: icDay(x.uploadStartedAt || ackTs)
    })),
    /* declaration */
    signatoryName: icPick(ig.signatoryName, P.authorizedPerson), signatoryDesignation: icPick(ig.signatoryDesignation, 'Authorised Signatory'),
    digitalSignatureApplied: hasDsc, validateInfo: true, submitToIcegate: submitted,
    declPlace: icPick(ig.declPlace, (S.portOfLoading || '').split(',')[0]), declDate: icPick(ig.declDate, icDay(ackTs)),
    sbNumberGenerated: sbNo, sbSubmittedAt: submitted ? icIso(ackTs) : '',
    /* live process data */
    assessedAt: (function () { const t = icTimelineTs(filing, 'UNDER_PROCESS') || icTimelineTs(filing, 'CLEARED'); return t ? icIso(t + 60000) : ''; })(),
    examAt: (function () { const t = icTimelineTs(filing, 'EXAMINATION'); return t ? icIso(t) : ''; })(),
    leoNumber: filing.leo ? filing.leo.refNo : '', leoAt: filing.leo ? icIso(filing.leo.date) : '',
    __preparedBy: tcosPreparedBy()
  };
  tcosOverlayIcegate(d, ig, 'export');
  return d;
}

/* ============================ BILL OF ENTRY ============================ */
function tcosBuildBoeData(filing) {
  const ig = filing.icegate || {}, P = filing.party || {}, C = filing.counterparty || {}, S = filing.shipment || {}, I = filing.invoice || {}, K = filing.packages || {};
  const items = Array.isArray(filing.items) ? filing.items : [];
  const cmp = items.map((_, i) => Object.assign({}, (filing.itemDuty || [])[i], (ig.itemCompliance || [])[i], (ig.itemDutyRates || [])[i], (ig.itemExtra || [])[i]));
  const cur = icPick(I.currency, 'USD');
  const fx = icNum(icPick(ig.exchangeRate, (typeof FX_TO_INR !== 'undefined' && FX_TO_INR[cur]) || 1)) || 1;
  const ackTs = filing.ack ? filing.ack.date : null;
  const submitted = !!filing.ack;
  const duty = filing.duty || null;
  const A = filing.assessment || {};
  const containers = (filing.containers || []).filter(c => c && icHas(c.containerNo));
  const portCode = tcosLeadingCode(ig.portCode) || tcosCodeFromPortName(S.portOfDischarge);
  /* per-item share of the (filing-level) assessment, by item value */
  const itemVals = items.map(it => icNum(it.qty) * icNum(it.unitPrice));
  const sumVals = itemVals.reduce((a, b) => a + b, 0) || 1;
  const src = duty || null;
  const itemDetails = items.map((it, i) => {
    const share = itemVals[i] / sumVals;
    const meta = (typeof HS_CODE_TABLE !== 'undefined' && HS_CODE_TABLE[it.hsCode]) || {};
    const row = {
      hsCode: it.hsCode, description: it.description, unitPrice: it.unitPrice, quantity: it.qty, unit: it.unit,
      grossWeight: it.grossWeight, netWeight: it.netWeight, itemCountryOrigin: icPick(it.origin, S.countryOfOrigin),
      notificationNo: (cmp[i] || {}).bcdNotnNo, prefDutyClaim: (cmp[i] || {}).prefDutyClaim, endUse: (cmp[i] || {}).endUse, brand: (cmp[i] || {}).brand, model: (cmp[i] || {}).model
    };
    if (src) {
      const ass = src.assessableValue * share, bcd = src.bcd * share, sws = src.sws * share;
      const cess = src.cess * share, add = src.add * share;
      row.assessableValue = ass.toFixed(2); row.customsDuty = bcd.toFixed(2); row.sws = sws.toFixed(2);
      row.igst = (src.igst * share).toFixed(2); row.antiDumpingDuty = add.toFixed(2); row.cess = cess.toFixed(2);
    }
    row.__meta = meta;
    return row;
  });
  const itemCompliance = items.map((it, i) => {
    const c = cmp[i] || {}, meta = itemDetails[i].__meta || {};
    return {
      itemNo: i + 1, ceth: icPick(c.ceth, 'NOEXCISE'), fs: icPick(c.fs, meta.pgaAgency === 'FSSAI' ? 'Y' : 'N'), pq: icPick(c.pq, meta.pgaAgency === 'PLANT_QUARANTINE' ? 'Y' : 'N'),
      dc: icPick(c.dc, meta.pgaAgency === 'DRUG_CONTROLLER' ? 'Y' : 'N'), wc: icPick(c.wc, meta.pgaAgency === 'WILDLIFE' ? 'Y' : 'N'), aq: icPick(c.aq, 'N'),
      coo: icPick(c.coo, icShortCountryCode(S.countryOfOrigin)), sQty: icPick(c.sQty, it.qty), sUqc: icPick(c.sUqc, it.unit), schCode: c.schCode, stndPr: c.stndPr, rsp: c.rsp
    };
  });
  const itemDutyRates = items.map((it, i) => {
    const c = cmp[i] || {}, meta = itemDetails[i].__meta || {};
    return {
      itemNo: i + 1, bcdNotnNo: c.bcdNotnNo, bcdNotnSno: c.bcdNotnSno,
      bcdRatePct: icPick(c.bcdRatePct, duty ? (duty.bcdRate * 100) : (meta.bcdRate != null ? meta.bcdRate * 100 : '')),
      swsRatePct: icPick(c.swsRatePct, 10), igstNotnNo: c.igstNotnNo, igstNotnSno: c.igstNotnSno,
      igstRatePct: icPick(c.igstRatePct, duty ? (duty.igstRate * 100) : 18), gcessRatePct: icPick(c.gcessRatePct, duty ? (duty.cessRate * 100) : '')
    };
  });
  const payTs = icTimelineTs(filing, 'DUTY_PAID');
  const d = {
    beType: icPick(ig.beType, 'Home Consumption'), customsLocation: String(S.portOfDischarge || '').toUpperCase(), portCode: portCode,
    importDate: icPick(ig.importDate, icDay(ackTs)), igmNumber: filing.igm && filing.igm.igmNo, igmDate: filing.igm && (typeof filing.igm.date === 'number' ? icDay(filing.igm.date) : filing.igm.date),
    blAwbNumber: S.blAwbNo, modeOfTransport: String(S.modeOfTransport || '').replace(/^Land.*/, 'Road'),
    countryExport: icPick(ig.countryExport, C.country), countryOrigin: S.countryOfOrigin, portLoading: S.portOfLoading,
    portOfShipment: icPick(ig.portOfShipment, S.portOfLoading), vesselFlightDetails: [S.vesselFlight, S.voyageFlight].filter(icHas).join(' / '),
    arrivalDate: ig.arrivalDate, portDischarge: S.portOfDischarge,
    /* status flags */
    beStatus: filing.ooc ? 'OOC COPY' : (duty ? 'Assessed' : 'Filed'),
    defBe: ig.defBe, kacha: ig.kacha, sec48: ig.sec48, reimp: ig.reimp, advBe: ig.advBe, assess: icPick(ig.assess, 'Y'),
    exam: icPick(ig.exam, (filing.examination && filing.examination.required) ? 'Y' : 'N'), hss: ig.hss,
    firstCheck: icPick(ig.firstCheck, String(filing.checkType || '').indexOf('First Check') === 0 ? 'Y' : 'N'), provFinal: icPick(ig.provFinal, 'F'),
    /* importer */
    iecNumber: P.iec, gstin: P.gstin, gstinType: icPick(ig.gstinType, 'G'), importerName: P.importerName, importerAddress: P.address,
    branchSerialNo: icPick(ig.branchSerialNo, '0'), pan: P.pan, adCode: ig.adCode, chaDetails: icPick(ig.chaDetails, filing.brokerClientIec ? (STATE.user.profile && STATE.user.profile.name) : ''),
    importerCategory: ig.importerCategory, cbCode: ig.cbCode, aeoStatus: icPick(ig.aeoStatus, (typeof STATE !== 'undefined' && STATE.riskProfile && STATE.riskProfile.aeo) ? 'AEO' : ''), ucr: ig.ucr,
    /* supplier & invoice */
    supplierName: C.supplierName, supplierAddress: C.address, sellerName: icPick(ig.sellerName, C.supplierName), sellerAddress: icPick(ig.sellerAddress, C.address),
    commInvoiceNo: I.invoiceNo, invoiceDate: I.invoiceDate, poNumber: ig.poNumber, poDate: ig.poDate, lcNumber: ig.lcNumber, lcDate: ig.lcDate,
    contractNo: ig.contractNo, contractDate: ig.contractDate, thirdPartyName: ig.thirdPartyName, thirdPartyAddress: ig.thirdPartyAddress, supplierAeo: ig.supplierAeo,
    currency: cur, exchangeRate: fx, freight: I.freight, insurance: I.insurance, loadingCharges: ig.loadingCharges, discounts: ig.discounts,
    incoterm: I.incoterm, totalInvoiceValue: I.invoiceValue, commissionAmt: ig.commissionAmt, hssAmt: ig.hssAmt, payTerms: I.paymentTerms,
    valuationMethod: icPick(ig.valuationMethod, 'RULE 3 (TRANSACTION VALUE)'), relatedParty: ig.relatedParty, svbCh: ig.svbCh, svbNo: ig.svbNo, svbDate: ig.svbDate, loa: ig.loa,
    cbAmt: ig.cbAmt, cocAmt: ig.cocAmt, copAmt: ig.copAmt, hndChg: ig.hndChg, gsAmt: ig.gsAmt, docChg: ig.docChg, cooChg: ig.cooChg, rlfAmt: ig.rlfAmt,
    othCost: ig.othCost, ldUld: ig.ldUld, wsAmt: ig.wsAmt, otcAmt: ig.otcAmt, miscCharge: ig.miscCharge,
    itemDetails: itemDetails.map(r => { const o = Object.assign({}, r); delete o.__meta; return o; }), itemCompliance: itemCompliance, itemDutyRates: itemDutyRates,
    containerDetails: containers.map(c => ({ containerNo: c.containerNo, containerSize: c.containerType, sealNumber: c.sealNo, lclFcl: icPick(c.lclFcl, 'F') })),
    noOfPackages: K.numberOfPackages, packageType: K.packageType, marksNumbers: K.marksNumbers, totalGrossWeight: K.grossWeight, totalNetWeight: K.netWeight,
    blAwbDate: ig.blAwbDate, hawbNo: ig.hawbNo, hawbDate: ig.hawbDate, gigmNo: ig.gigmNo, gigmDate: ig.gigmDate,
    bondNo: ig.bondNo, bondPort: ig.bondPort, bondCd: ig.bondCd, bondDebtAmt: ig.bondDebtAmt, bgAmt: ig.bgAmt, wbeNo: ig.wbeNo, wbeDate: ig.wbeDate, wbeSite: ig.wbeSite, whCode: ig.whCode,
    /* duty (live from the customs assessment, else what the student entered on the Duty Assessment step) */
    bcdTotal: duty ? duty.bcd : A.bcdAmount, swsTotal: duty ? duty.sws : A.swsAmount, igstTotal: duty ? duty.igst : A.igstAmount,
    compensationCess: duty ? duty.cess : A.cessAmount, antiDumpingTotal: duty ? duty.add : A.antiDumpingDuty,
    paymentMethod: filing.payment && filing.payment.method, challanNumber: filing.payment && filing.payment.status === 'SUCCESS' ? filing.payment.challanNo : '',
    challanDate: payTs ? icDay(payTs) : '',
    /* part V */
    pgaLines: (filing.pga || []).map(p => ({ invNo: '1', itemNo: '1', agency: (typeof PGA_AGENCIES !== 'undefined' && PGA_AGENCIES[p.agency]) ? PGA_AGENCIES[p.agency].name : p.agency, status: p.status })),
    examinationOrder: filing.checkType, examReport: filing.examination && filing.examination.remarks || '',
    beSupportingDocs: (filing.documents || []).filter(x => x && x.status === 'ATTACHED TO FILING').map(x => ({
      invsn: '1', itmsn: '1', typ: (typeof ESANCHIT_CODES !== 'undefined' && ESANCHIT_CODES[x.type]) || '', icegateId: String(P.iec || '').toUpperCase(), irn: x.refNo || '', issueDt: icDay(x.uploadStartedAt || ackTs)
    })),
    oocNumber: filing.ooc ? filing.ooc.refNo : '', oocDate: filing.ooc ? icDay(filing.ooc.date) : '', oocTime: filing.ooc ? icHM(filing.ooc.date) : '',
    /* declaration */
    declarationBy: icPick(ig.declarationBy, 'Importer'), signatoryName: icPick(ig.signatoryName, P.authorizedPerson), signatoryDesignation: icPick(ig.signatoryDesignation, 'Authorised Signatory'),
    digitalSignatureApplied: !!filing.dsc, validateInfo: true, submitToIcegate: submitted,
    declPlace: icPick(ig.declPlace, (S.portOfDischarge || '').split(',')[0]), declDate: icPick(ig.declDate, icDay(ackTs)),
    beNumberGenerated: filing.id ? icSeqNo(filing.id) : '', beSubmittedAt: submitted ? icIso(ackTs) : '',
    assessedAt: (function () { const t = icTimelineTs(filing, 'ASSESSED'); return t ? icIso(t) : ''; })(),
    examAt: (function () { const t = icTimelineTs(filing, 'EXAMINATION'); return t ? icIso(t) : ''; })(),
    __preparedBy: tcosPreparedBy()
  };
  tcosOverlayIcegate(d, ig, 'import');
  return d;
}

function tcosIcegateData(filing) { return filing.type === 'export' ? tcosBuildSbData(filing) : tcosBuildBoeData(filing); }

/* HTML (.sb-page pages inside .sb-scroll) for a filing; throws if the shared renderers are not loaded */
function tcosRenderIcegateHtml(filing) {
  if (filing.type === 'export') {
    if (typeof renderShippingBillSpecimen !== 'function') throw new Error('Shipping Bill renderer is not loaded.');
    return renderShippingBillSpecimen(tcosBuildSbData(filing));
  }
  if (typeof renderBillOfEntrySpecimen !== 'function') throw new Error('Bill of Entry renderer is not loaded.');
  return renderBillOfEntrySpecimen(tcosBuildBoeData(filing));
}

function tcosIsIcegateDoc(doc) {
  if (!doc || !doc.filingId) return false;
  return doc.type === 'Shipping Bill' || doc.type === 'Bill of Entry';
}

/* make sure every submitted filing has its Shipping Bill / Bill of Entry document (older filings pre-date this) */
function tcosEnsureIcegateDoc(filing) {
  if (!filing || !filing.ack || typeof addDocument !== 'function') return null;
  const type = filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry';
  let doc = STATE.documentsGenerated.find(d => d.filingId === filing.id && d.type === type);
  if (!doc) {
    doc = addDocument(type, filing.id, type);
    const ackDoc = STATE.documentsGenerated.find(d => d.filingId === filing.id && d.type === 'Acknowledgement');
    if (ackDoc) doc.ts = ackDoc.ts;
    saveState();
  }
  return doc;
}
function tcosBackfillIcegateDocs() { (STATE.filings || []).forEach(f => { try { tcosEnsureIcegateDoc(f); } catch (e) { /* ignore */ } }); }

/* ---------- PDF: one A4 page per .sb-page (same capture as Skelora's skBuildSbPdf) ---------- */
async function tcosIcegatePdf(filing) {
  const { jsPDF } = window.jspdf;
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;left:-10000px;top:0;width:820px;background:#fff;';
  holder.innerHTML = tcosRenderIcegateHtml(filing);
  document.body.appendChild(holder);
  try {
    const pages = holder.querySelectorAll('.sb-page');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: Math.max(window.innerWidth, 1000) });
      let w = pw, h = (canvas.height * w) / canvas.width;
      if (h > ph) { const k = ph / h; w *= k; h = ph; }
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (pw - w) / 2, 0, w, h);
    }
    return { pdf, pageCount: pages.length };
  } finally { holder.remove(); }
}
function tcosIcegateFileName(doc, filing) {
  return (filing.type === 'export' ? 'Shipping_Bill_' : 'Bill_of_Entry_') + (filing ? filing.id : doc.refNo) + '.pdf';
}
async function tcosDownloadIcegatePdf(docId) {
  const doc = STATE.documentsGenerated.find(d => d.id === docId);
  const filing = doc && getFiling(doc.filingId);
  if (!doc || !filing) { toast('That document could not be found — it may belong to a different profile.', 'error'); return; }
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') { toast("PDF tools didn't load — check your connection and try again.", 'error'); return; }
  toast('Generating ICEGATE-format PDF…', 'info');
  try {
    const { pdf } = await tcosIcegatePdf(filing);
    pdf.save(tcosIcegateFileName(doc, filing));
    toast('PDF downloaded.', 'success');
  } catch (err) {
    console.error('[TCOS ICEGATE PDF]', err);
    toast('Could not generate the PDF — please try again.', 'error');
  }
}

/* ---------- on-screen view / print ---------- */
function tcosViewIcegateFiling(filing, title) {
  let html;
  try { html = tcosRenderIcegateHtml(filing); } catch (e) { console.error(e); toast('Could not render the document: ' + e.message, 'error'); return; }
  const bg = el('div', 'modal-bg show');
  bg.innerHTML = `<div class="modal" style="width:min(860px,96vw)"><div class="modal-head">${esc(title || (filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry'))} — ICEGATE format <span class="close">×</span></div>
    <div class="icegate-view" style="max-height:78vh;overflow:auto;background:#e9edf2;padding:10px">${html}</div></div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click', e => { if (e.target === bg || e.target.classList.contains('close')) bg.remove(); });
}
function tcosViewIcegateDoc(docId) {
  const doc = STATE.documentsGenerated.find(d => d.id === docId);
  const filing = doc && getFiling(doc.filingId);
  if (!doc || !filing) { toast('That document could not be found — it may belong to a different profile.', 'error'); return; }
  tcosViewIcegateFiling(filing, doc.title);
}
function tcosPrintIcegateDoc(docId) {
  const doc = STATE.documentsGenerated.find(d => d.id === docId);
  const filing = doc && getFiling(doc.filingId);
  if (!doc || !filing) { toast('That document could not be found — it may belong to a different profile.', 'error'); return; }
  let html;
  try { html = tcosRenderIcegateHtml(filing); } catch (e) { console.error(e); toast('Could not render the document: ' + e.message, 'error'); return; }
  const w = window.open('', '_blank');
  if (!w) { toast('Your browser blocked the print window — allow pop-ups for this site and try again.', 'error'); return; }
  const css = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).filter(l => /customs-forms\.css|icegate-print\.css/.test(l.href)).map(l => `<link rel="stylesheet" href="${l.href}">`).join('');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(doc.title)}</title>${css}<style>body{margin:0;background:#fff}.sb-page{margin:0 auto!important;outline:none!important}@page{size:A4;margin:0}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 700);
}
