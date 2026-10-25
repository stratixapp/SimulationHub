/* ============================================================
   ICEGATE TRAINING SIMULATOR — MANIFEST MODULE (IGM / EGM)
   Real customs rule modeled: a Bill of Entry can only reference
   cargo that already appears on a carrier-filed Import General
   Manifest (IGM) line. A Shipping Bill is only truly closed once
   the carrier files the Export General Manifest (EGM) after sailing.
   ============================================================ */

/* -------- IGM (Import) -------- */
function autoFileIGMForBooking(booking) {
  if (booking.mode !== 'Sea' && booking.mode !== 'Air') return null;
  const existing = STATE.igms.find(g => g.bookingId === booking.id);
  if (existing) return existing;
  const igm = {
    igmNo: uniqueId('IGM', () => 'IGM-' + Math.floor(100000 + Math.random() * 900000)),
    date: todayISO(),
    vessel: booking.carrierName,
    voyageFlight: '',
    portOfArrival: booking.portOfDischarge,
    mode: booking.mode,
    bookingId: booking.id,
    lines: [{
      lineNo: '1', blAwbNo: (booking.bl && booking.bl.houseNo) || 'PENDING-' + booking.id,
      consignee: booking.consigneeName, description: booking.commodity,
      packages: booking.mode === 'Sea' ? (booking.containers || []).reduce((s, c) => s + Number(c.qty || 0), 0) : Number(booking.pieces || 0),
      status: 'ARRIVED'
    }]
  };
  STATE.igms.unshift(igm);
  addNotification(`IGM ${igm.igmNo} filed by carrier for booking ${booking.id}.`, null);
  saveState();
  return igm;
}

function fileStandaloneIGMLine(filing) {
  const bl = filing.shipment.blAwbNo;
  const igm = {
    igmNo: uniqueId('IGM', () => 'IGM-' + Math.floor(100000 + Math.random() * 900000)),
    date: todayISO(),
    vessel: filing.shipment.vesselFlight,
    voyageFlight: filing.shipment.voyageFlight,
    portOfArrival: filing.shipment.portOfDischarge,
    mode: filing.shipment.modeOfTransport,
    bookingId: null,
    lines: [{
      lineNo: '1', blAwbNo: bl,
      consignee: filing.party.importerName, description: (filing.items[0] && filing.items[0].description) || filing.invoice.invoiceNo,
      packages: filing.packages.numberOfPackages || 0, status: 'ARRIVED'
    }]
  };
  STATE.igms.unshift(igm);
  addNotification(`IGM ${igm.igmNo} filed by carrier (simulated) for BL/AWB ${bl}.`, filing.id);
  saveState();
  return igm;
}

function manifestStepHTML(filing) {
  const bl = filing.shipment.blAwbNo;
  const found = filing.igm && filing.igm.verified ? filing.igm : null;
  return `<p class="hint">A Bill of Entry can only be filed against cargo that the carrier has already declared on the Import General Manifest (IGM). Search the IGM register using the Bill of Lading / AWB number entered in Shipment Details.</p>
  <table class="kv-table"><tr><td>Bill of Lading / AWB No.</td><td>${esc(bl || '(not entered — go back to Shipment Details)')}</td></tr></table>
  <div id="igmResult">
    ${found ? `<div class="alert alert-success"><b>IGM Verified</b><br>IGM No.: ${esc(found.igmNo)} &nbsp;|&nbsp; Line No.: ${esc(found.lineNo)} &nbsp;|&nbsp; Filed: ${fmtDate(found.date)}</div>`
      : `<div class="alert alert-amber">IGM not yet verified for this consignment.</div>`}
  </div>
  <div class="actions" style="justify-content:flex-start;margin-top:10px">
    <button class="btn-ghost" id="igmSearchBtn" type="button">Search IGM Register</button>
    <button class="btn-ghost" id="igmFileBtn" type="button">File Standalone IGM (simulate carrier filing)</button>
  </div>
  <div class="ferr" id="err_igm"></div>`;
}
function wireManifestStep(filing) {
  $('#igmSearchBtn').addEventListener('click', () => {
    const bl = filing.shipment.blAwbNo;
    if (!bl) { toast('Enter the Bill of Lading / AWB number in Shipment Details first.', 'error'); return; }
    const found = findIGMLineByBL(bl);
    if (found) {
      filing.igm = { igmNo: found.igm.igmNo, lineNo: found.line.lineNo, date: found.igm.date, verified: true, verifiedBl: bl };
      saveState();
      toast('IGM line found and verified.', 'success');
    } else {
      toast('No IGM found for this BL/AWB number yet. The carrier may not have filed it — you can simulate standalone filing below.', 'error');
    }
    renderWizardPane();
  });
  $('#igmFileBtn').addEventListener('click', () => {
    const bl = filing.shipment.blAwbNo;
    if (!bl) { toast('Enter the Bill of Lading / AWB number in Shipment Details first.', 'error'); return; }
    if (findIGMLineByBL(bl)) { toast('An IGM already exists for this BL/AWB — use Search instead.', 'error'); return; }
    const igm = fileStandaloneIGMLine(filing);
    filing.igm = { igmNo: igm.igmNo, lineNo: igm.lines[0].lineNo, date: igm.date, verified: true, verifiedBl: bl };
    saveState();
    toast('IGM filed and verified (training simulation).', 'success');
    renderWizardPane();
  });
}
function validateManifestStep(filing) {
  const errs = [];
  if (!filing.igm || !filing.igm.verified) {
    errs.push({ field: 'igm', message: 'IGM verification required — search or simulate-file the Import General Manifest before a Bill of Entry can be filed against this consignment.' });
  } else if (filing.igm.verifiedBl !== filing.shipment.blAwbNo) {
    /* Section 8/9: the BL/AWB number was changed after IGM verification — the old
       verification no longer matches the current shipment details, so it must not
       silently pass. Re-verification is required against the new BL/AWB number. */
    errs.push({ field: 'igm', message: 'The Bill of Lading / AWB number was changed after IGM verification — please re-verify the IGM against the current BL/AWB number.' });
  }
  return errs;
}
STEP_VALIDATORS.manifest = validateManifestStep;

/* -------- EGM (Export) -------- */
function fileEGM(filingId) {
  const filing = getFiling(filingId);
  if (!filing) return;
  if (!filing.leo) { toast('LEO must be issued before the Export General Manifest can be filed.', 'error'); return; }
  const egm = {
    egmNo: uniqueId('EGM', () => 'EGM-' + Math.floor(100000 + Math.random() * 900000)),
    date: todayISO(), vessel: filing.shipment.vesselFlight, voyageFlight: filing.shipment.voyageFlight,
    filingId: filing.id
  };
  STATE.egms.unshift(egm);
  filing.egm = egm;
  pushTimeline(filing, filing.status, `Export General Manifest filed by carrier: ${egm.egmNo}. Shipping Bill closed.`);
  addDocument('Export General Manifest', filing.id, `EGM — ${filing.id}`);
  addNotification(`EGM ${egm.egmNo} filed for ${filing.id}. Shipping Bill is now fully closed.`, filing.id);
  saveState();
  if (typeof renderFilingDetail === 'function') renderFilingDetail(filing.id);
  toast('EGM filed. Shipping Bill closed out.', 'success');
  if (typeof DotBridge !== 'undefined') {
    const wasBridged = DotBridge.markCompleted('export', filing.id, 'shipping-bill');
    if (wasBridged) {
      const b = DotBridge.getBridge();
      if (b && b.userId) DotBridge.silentCompleteLogisticsDoc(b.userId, 'export-general-manifest', filing.id, 'Export General Manifest');
      showBridgeReturnPrompt(filing.id, 'Shipping Bill');
    }
  }
}
