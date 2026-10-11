/* ============================================================
   ICEGATE TRAINING SIMULATOR — FREIGHT FORWARDING WORKFLOW
   Booking Confirmation -> Shipping Instructions -> VGM (sea) ->
   Draft/Final BL-AWB -> Arrival -> Delivery Order -> Gate Out -> POD
   ============================================================ */

/* ---------------- BOOKING CONFIRMATION ---------------- */
function confirmBooking(bookingId) {
  const b = getBooking(bookingId);
  if (!b) return;
  if (b.status !== 'REQUESTED') { toast('This booking has already been processed by the carrier.', 'info'); return; }
  b.bookingAttempts = (b.bookingAttempts || 0) + 1;
  /* first attempt has a real chance of "no space available" like a real carrier booking; guaranteed confirm on retry */
  const rejected = b.bookingAttempts === 1 && Math.random() < 0.3;
  if (rejected) {
    setBookingStatus(b, 'REJECTED');
    const reasons = ['No space available on requested sailing — vessel fully booked.', 'Equipment (container) shortage at load port for requested date.', 'Carrier cut-off already passed for the requested sailing date.'];
    b.rejectionReason = reasons[Math.floor(Math.random() * reasons.length)];
    pushTimeline(b, 'REJECTED', `Booking rejected by carrier: ${b.rejectionReason}`);
    addNotification(`Booking ${b.id} rejected by ${b.carrierName}: ${b.rejectionReason}`, null);
  } else {
    setBookingStatus(b, 'CONFIRMED');
    b.bookingConfirmationNo = uniqueId('BKG', () => 'BKG-' + Math.floor(100000 + Math.random() * 900000));
    pushTimeline(b, 'CONFIRMED', `Carrier confirmed booking. Confirmation No: ${b.bookingConfirmationNo}`);
    addDocument('Booking Confirmation', null, `Freight Booking Confirmation — ${b.id}`, b.id);
    addNotification(`Booking ${b.id} confirmed by ${b.carrierName}. Confirmation: ${b.bookingConfirmationNo}`, null);
    if (typeof freightBridgeStage === 'function') freightBridgeStage(b, 'booking-confirmation', b.bookingConfirmationNo, 'Booking Confirmation');
  }
  saveState();
  renderFreightDetail(b.id);
}

function resubmitBooking(bookingId, newSailingDate, newCarrier) {
  const b = getBooking(bookingId);
  if (!b) return;
  if (!newSailingDate) { toast('Please select an alternate sailing / flight date.', 'error'); return; }
  b.requestedSailingDate = newSailingDate;
  if (newCarrier) b.carrierName = newCarrier;
  pushTimeline(b, 'REQUESTED', `Resubmitted with revised date ${fmtDate(newSailingDate)}${newCarrier ? ' via ' + newCarrier : ''}.`);
  setBookingStatus(b, 'REQUESTED');
  saveState();
  confirmBooking(bookingId);
}

/* ---------------- SHIPPING INSTRUCTIONS ---------------- */
function submitSI(bookingId, siData) {
  const b = getBooking(bookingId);
  if (!b) return;
  if (!siData.marksNumbers || !siData.description) { toast('Marks & Numbers and Description of Goods are mandatory.', 'error'); return; }
  if (b.mode === 'Sea') {
    const bad = siData.containers.find(c => !RE_CONTAINER.test((c.containerNo || '').replace(/\s/g, '')));
    if (bad) { toast('Invalid container number format — expected e.g. MSCU1234567.', 'error'); return; }
    const noSeal = siData.containers.find(c => !c.sealNo);
    if (noSeal) { toast('Seal number is mandatory for every container.', 'error'); return; }
  }
  b.si = { marksNumbers: siData.marksNumbers, description: siData.description, containers: siData.containers || [], submittedAt: Date.now(), status: 'SUBMITTED' };
  setBookingStatus(b, 'SI_SUBMITTED');
  pushTimeline(b, 'SI_SUBMITTED', 'Shipping Instructions submitted to carrier.');
  addNotification(`Shipping Instructions submitted for ${b.id}.`, null);
  saveState();
  renderFreightDetail(b.id);
  toast('Shipping Instructions submitted.', 'success');
}

/* ---------------- VGM (sea only — SOLAS requirement) ---------------- */
function submitVGM(bookingId, weight, method, declarant) {
  const b = getBooking(bookingId);
  if (!b) return;
  if (!weight || Number(weight) <= 0) { toast('VGM weight must be greater than zero.', 'error'); return; }
  if (!method) { toast('Please select a VGM weighing method.', 'error'); return; }
  if (!declarant) { toast('Declarant name is mandatory for VGM submission.', 'error'); return; }
  b.vgm = { weight: Number(weight), method, declarant, submittedAt: Date.now(), status: 'SUBMITTED' };
  setBookingStatus(b, 'VGM_SUBMITTED');
  pushTimeline(b, 'VGM_SUBMITTED', `VGM submitted: ${weight} KG via ${method}.`);
  addNotification(`VGM submitted for ${b.id}.`, null);
  saveState();
  renderFreightDetail(b.id);
  toast('VGM submitted before carrier cut-off.', 'success');
  if (typeof freightBridgeStage === 'function') freightBridgeStage(b, 'vgm-certificate', 'VGM-' + b.id, 'VGM Certificate');
}

/* ---------------- DRAFT BL/AWB ---------------- */
function issueDraftBL(bookingId) {
  const b = getBooking(bookingId);
  if (!b) return;
  if (b.bl && b.bl.draftNo) { toast('A draft BL/AWB has already been issued for this booking.', 'info'); return; }
  /* Section 36: don't rely solely on the button only being rendered once SI is submitted —
     guard the state transition itself so a draft BL/AWB can never be generated (and the
     detail screen can never try to render b.si.*) before Shipping Instructions exist. */
  if (!b.si) { toast('Submit Shipping Instructions before generating the draft BL/AWB.', 'error'); return; }
  /* Merged from the parallel FINAL hardening pass: SOLAS requires a Verified Gross Mass
     declaration before a vessel can load a container — a sea-mode draft BL should not be
     generatable ahead of it, even though VGM is technically a separate wizard step. */
  if (b.mode === 'Sea' && !b.vgm) { toast('Submit VGM (Verified Gross Mass) before a draft Bill of Lading can be generated for a sea shipment.', 'error'); return; }
  b.bl = b.bl || {};
  b.bl.draftNo = uniqueId('DFT-BL', () => (b.mode === 'Sea' ? 'DFT-BL-' : 'DFT-AWB-') + Math.floor(100000 + Math.random() * 900000));
  b.bl.status = 'DRAFT';
  setBookingStatus(b, 'DRAFT_BL');
  pushTimeline(b, 'DRAFT_BL', `Draft ${b.mode === 'Sea' ? 'Bill of Lading' : 'Air Waybill'} issued for verification: ${b.bl.draftNo}`);
  addDocument('Draft ' + (b.mode === 'Sea' ? 'Bill of Lading' : 'Air Waybill'), null, `Draft ${b.mode === 'Sea' ? 'BL' : 'AWB'} — ${b.id}`, b.id);
  addNotification(`Draft ${b.mode === 'Sea' ? 'BL' : 'AWB'} issued for ${b.id}. Please verify before finalizing.`, null);
  saveState();
  renderFreightDetail(b.id);
}

function requestBLCorrection(bookingId, note) {
  const b = getBooking(bookingId);
  if (!b) return;
  if (!note || note.trim().length < 8) { toast('Please describe the correction required (minimum 8 characters).', 'error'); return; }
  b.bl = null; // the old draft is void once a correction is requested — a fresh draft must be generated
  setBookingStatus(b, 'SI_SUBMITTED');
  pushTimeline(b, 'SI_SUBMITTED', `Correction requested on draft BL/AWB: ${note.trim()}`);
  addNotification(`Draft BL/AWB correction requested for ${b.id}.`, null);
  saveState();
  renderFreightDetail(b.id);
  toast('Correction request sent. Resubmit Shipping Instructions to regenerate the draft.', 'success');
}

function finalizeBL(bookingId, releaseType) {
  const b = getBooking(bookingId);
  if (!b) return;
  if (b.bl && b.bl.status === 'ISSUED') { toast('The BL/AWB has already been finalized for this booking.', 'info'); return; }
  if (!releaseType) { toast('Please select a release type before finalizing.', 'error'); return; }
  const isSea = b.mode === 'Sea';
  b.bl = b.bl || {};
  b.bl.houseNo = uniqueId('HBL', () => (isSea ? 'HBL-' : 'HAWB-') + Math.floor(100000 + Math.random() * 900000));
  b.bl.masterNo = uniqueId('MBL', () => (isSea ? 'MBL-' : 'MAWB-') + Math.floor(100000 + Math.random() * 900000));
  b.bl.releaseType = releaseType;
  b.bl.originalsIssued = releaseType === (isSea ? 'Original Bill of Lading' : 'Original AWB') ? 3 : 0;
  b.bl.status = 'ISSUED';
  b.bl.issuedAt = Date.now();
  setBookingStatus(b, 'BL_ISSUED');
  pushTimeline(b, 'BL_ISSUED', `${isSea ? 'Bill of Lading' : 'Air Waybill'} finalized — House No: ${b.bl.houseNo}, Release Type: ${releaseType}`);
  addDocument(isSea ? 'House Bill of Lading' : 'House Air Waybill', null, `${isSea ? 'House Bill of Lading' : 'House Air Waybill'} — ${b.id}`, b.id);
  addNotification(`${isSea ? 'House BL' : 'House AWB'} finalized for ${b.id}: ${b.bl.houseNo}`, null);
  saveState();
  renderFreightDetail(b.id);
  toast('BL/AWB finalized.', 'success');
  if (typeof freightBridgeStage === 'function') freightBridgeStage(b, isSea ? 'bill-of-lading-sea' : 'air-waybill', b.bl.houseNo, isSea ? 'Bill of Lading' : 'Air Waybill');
}

/* ---------------- ARRIVAL ---------------- */
function markArrival(bookingId) {
  const b = getBooking(bookingId);
  if (!b) return;
  if (b.arrival) { toast('Arrival has already been recorded for this booking.', 'info'); return; }
  b.arrival = { eta: b.requestedSailingDate, ata: todayISO(), status: 'ARRIVED' };
  setBookingStatus(b, 'ARRIVED');
  pushTimeline(b, 'ARRIVED', `${b.mode === 'Sea' ? 'Vessel' : 'Flight'} arrived at ${b.portOfDischarge}.`);
  addDocument('Arrival Notice', null, `Arrival Notice — ${b.id}`, b.id);
  addNotification(`Arrival notice for ${b.id}: cargo has arrived at ${b.portOfDischarge}.`, null);
  /* Real customs rule: the carrier files the IGM once the vessel/flight physically arrives in India */
  if (INDIAN_PORTS.includes(b.portOfDischarge) && typeof autoFileIGMForBooking === 'function') {
    autoFileIGMForBooking(b);
  }
  saveState();
  renderFreightDetail(b.id);
  if (typeof freightBridgeStage === 'function') freightBridgeStage(b, 'arrival-notice', b.id, 'Arrival Notice');
}

/* ---------------- DELIVERY ORDER ---------------- */
function requestDeliveryOrder(bookingId, blSurrendered) {
  const b = getBooking(bookingId);
  if (!b) return;
  if (b.deliveryOrder) { toast('A Delivery Order has already been issued for this booking.', 'info'); return; }
  /* Merged from the parallel FINAL hardening pass: don't rely solely on the button only being
     rendered once the final BL/AWB is issued — guard the state transition itself, matching the
     Section 36 pattern already used elsewhere in this file. */
  if (!b.bl || b.bl.status !== 'ISSUED') { toast('The final BL/AWB must be issued before a Delivery Order can be requested.', 'error'); return; }
  const isSea = b.mode === 'Sea';
  const needsSurrender = b.bl.releaseType === (isSea ? 'Original Bill of Lading' : 'Original AWB');
  if (needsSurrender && !blSurrendered) {
    toast('Original ' + (isSea ? 'Bill of Lading' : 'AWB') + ' must be surrendered at destination before a Delivery Order can be issued.', 'error');
    return;
  }
  if (b.linkedFilingId) {
    const f = getFiling(b.linkedFilingId);
    if (f && !['LEO', 'OOC', 'COMPLETED'].includes(f.status)) {
      toast(`Cannot issue Delivery Order — linked customs filing ${f.id} has not yet cleared (current status: ${STATUS_LABELS[f.status]}).`, 'error');
      return;
    }
  }
  b.deliveryOrder = { doNo: uniqueId('DO', () => 'DO-' + Math.floor(100000 + Math.random() * 900000)), date: Date.now(), status: 'ISSUED' };
  setBookingStatus(b, 'DO_ISSUED');
  pushTimeline(b, 'DO_ISSUED', `Delivery Order issued: ${b.deliveryOrder.doNo}`);
  addDocument('Delivery Order', null, `Delivery Order — ${b.id}`, b.id);
  addNotification(`Delivery Order issued for ${b.id}: ${b.deliveryOrder.doNo}`, null);
  saveState();
  renderFreightDetail(b.id);
  toast('Delivery Order issued.', 'success');
  if (typeof freightBridgeStage === 'function') freightBridgeStage(b, 'delivery-order', b.deliveryOrder.doNo, 'Delivery Order');
}

/* ---------------- GATE OUT / EIR ---------------- */
function gateOutCargo(bookingId) {
  const b = getBooking(bookingId);
  if (!b) return;
  if (b.gateOut) { toast('Cargo has already been gated out for this booking.', 'info'); return; }
  b.gateOut = { eirNo: b.mode === 'Sea' ? uniqueId('EIR', () => 'EIR-' + Math.floor(100000 + Math.random() * 900000)) : uniqueId('GATEPASS', () => 'GATEPASS-' + Math.floor(100000 + Math.random() * 900000)), date: Date.now() };
  setBookingStatus(b, 'GATE_OUT');
  pushTimeline(b, 'GATE_OUT', `Cargo gated out. Reference: ${b.gateOut.eirNo}`);
  addDocument(b.mode === 'Sea' ? 'Equipment Interchange Receipt' : 'Gate Pass', null, `${b.mode === 'Sea' ? 'EIR' : 'Gate Pass'} — ${b.id}`, b.id);
  addNotification(`Cargo gated out for ${b.id}.`, null);
  saveState();
  renderFreightDetail(b.id);
  if (b.mode === 'Sea' && typeof freightBridgeStage === 'function') freightBridgeStage(b, 'equipment-interchange-receipt', b.gateOut.eirNo, 'Equipment Interchange Receipt');
}

/* ---------------- PROOF OF DELIVERY ---------------- */
function submitPOD(bookingId, signedBy) {
  const b = getBooking(bookingId);
  if (!b) return;
  if (b.pod) { toast('Proof of Delivery has already been recorded for this booking.', 'info'); return; }
  if (!signedBy || signedBy.trim().length < 3) { toast('Please enter the name of the person who received the cargo.', 'error'); return; }
  b.pod = { signedBy: signedBy.trim(), date: Date.now(), status: 'DELIVERED' };
  setBookingStatus(b, 'COMPLETED');
  pushTimeline(b, 'COMPLETED', `Proof of Delivery collected — signed by ${signedBy.trim()}. Shipment delivered.`);
  addDocument('Proof of Delivery', null, `Proof of Delivery — ${b.id}`, b.id);
  addNotification(`${b.id} delivered — Proof of Delivery collected.`, null);
  saveState();
  renderFreightDetail(b.id);
  toast('Delivery confirmed. Freight booking completed.', 'success');
  if (typeof freightBridgeStage === 'function') freightBridgeStage(b, 'proof-of-delivery', b.id, 'Proof of Delivery');
}
