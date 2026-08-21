/* ============================================================
   ICEGATE TRAINING SIMULATOR — FREIGHT FORWARDING REFERENCE DATA
   ============================================================ */

const OCEAN_CARRIERS = ['Maersk Line', 'MSC Mediterranean Shipping', 'CMA CGM', 'Hapag-Lloyd', 'ONE (Ocean Network Express)', 'COSCO Shipping'];
const AIR_CARRIERS = ['Air India Cargo', 'Emirates SkyCargo', 'Singapore Airlines Cargo', 'Lufthansa Cargo', 'Qatar Airways Cargo', 'IndiGo CarGo'];

const FREIGHT_TERMS = ['Prepaid', 'Collect'];
const BL_RELEASE_TYPES_SEA = ['Original Bill of Lading', 'Telex Release', 'Surrendered Bill of Lading'];
const AWB_RELEASE_TYPES_AIR = ['Original AWB', 'Express / Telex Release'];
const VGM_METHODS = ['Method 1 — Weighbridge Weighing', 'Method 2 — Calculation of Component Weights'];
const SPECIAL_CARGO_TAGS = ['General Cargo', 'Hazardous (IMDG/DGR)', 'Reefer / Temperature Controlled', 'Out of Gauge (OOG)', 'High Value'];

const FREIGHT_STATUS_LABELS = {
  REQUESTED: 'Booking Requested',
  REJECTED: 'Booking Rejected — Resubmission Required',
  CONFIRMED: 'Booking Confirmed',
  SI_SUBMITTED: 'Shipping Instructions Submitted',
  VGM_SUBMITTED: 'VGM Submitted',
  DRAFT_BL: 'Draft BL/AWB Issued',
  BL_ISSUED: 'BL/AWB Finalized',
  ARRIVED: 'Vessel/Flight Arrived',
  DO_ISSUED: 'Delivery Order Issued',
  GATE_OUT: 'Cargo Gated Out',
  COMPLETED: 'Delivered — Completed'
};
const FREIGHT_STATUS_BADGE = {
  REQUESTED: 'badge-amber', REJECTED: 'badge-red', CONFIRMED: 'badge-blue', SI_SUBMITTED: 'badge-blue',
  VGM_SUBMITTED: 'badge-blue', DRAFT_BL: 'badge-amber', BL_ISSUED: 'badge-blue', ARRIVED: 'badge-blue',
  DO_ISSUED: 'badge-blue', GATE_OUT: 'badge-blue', COMPLETED: 'badge-green'
};
