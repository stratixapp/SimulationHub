/* ============================================================
   TCOS TRAINING SIMULATOR — STATIC REFERENCE DATA
   Fictional/demo data only. Not connected to any real registry.
   ============================================================ */

const DEMO_CREDENTIALS = [
  { userId: 'TRAINING.EXPORTER', password: 'TRAIN@123', role: 'IEC Holder (Exporter)', name: 'Rahul Mehta', iec: '0301045678', gstin: '27AAACR5055K1Z8', pan: 'AAACR5055K', isTrainerAccount: false },
  { userId: 'TRAINING.IMPORTER', password: 'TRAIN@123', role: 'IEC Holder (Importer)', name: 'Sunita Rao', iec: '0301099821', gstin: '27AAACS8871L1Z2', pan: 'AAACS8871L', isTrainerAccount: false },
  { userId: 'TRAINING.BROKER', password: 'TRAIN@123', role: 'Customs Broker', name: 'Ashok Verma', iec: '—', gstin: '27AABCB4433M1Z5', pan: 'AABCB4433M', isTrainerAccount: false },
  { userId: 'TRAINING.FREIGHT', password: 'TRAIN@123', role: 'Freight Forwarder', name: 'Priya Iyer', iec: '—', gstin: '27AABCF2201N1Z9', pan: 'AABCF2201N', isTrainerAccount: false },
  { userId: 'TRAINING.EXIM', password: 'TRAIN@123', role: 'EXIM Executive', name: 'Deepak Nambiar', iec: '0301077453', gstin: '27AAACE6612P1Z3', pan: 'AAACE6612P', isTrainerAccount: false },
  { userId: 'TRAINING.STUDENT', password: 'TRAIN@123', role: 'Training Student', name: 'Student User', iec: '—', gstin: '—', pan: '—', isTrainerAccount: false },
  /* Trainer / Instructor is now a distinct credential, not a checkbox any trade-user account can tick.
     Section 5 hardening: trainer-only screens (Trainer Console) require signing in with THIS account. */
  { userId: 'TRAINER.ADMIN', password: 'TRAIN@ADMIN1', role: 'Trainer / Instructor', name: 'Training Administrator', iec: '—', gstin: '—', pan: '—', isTrainerAccount: true }
];

/* Which sidebar groups (matching the side-title labels in index.html) each role can see.
   Section 6 of the training build spec — role-specific access. */
const ROLE_SIDEBAR_GROUPS = {
  'IEC Holder (Exporter)': ['Main', 'Export Documentation Desk', 'Filing', 'Processing', 'Records', 'Training', 'Account'],
  'IEC Holder (Importer)': ['Main', 'Filing', 'Processing', 'Records', 'Training', 'Account'],
  'Customs Broker': ['Main', 'Export Documentation Desk', 'Filing', 'Freight Forwarding', 'Processing', 'Records', 'Training', 'Account'],
  'Freight Forwarder': ['Main', 'Freight Forwarding', 'Records', 'Training', 'Account'],
  'EXIM Executive': ['Main', 'Export Documentation Desk', 'Filing', 'Freight Forwarding', 'Processing', 'Records', 'Training', 'Account'],
  'Training Student': ['Main', 'Export Documentation Desk', 'Training', 'Records', 'Account'],
  'Trainer / Instructor': ['Main', 'Training', 'Account']
};

const INDIAN_PORTS = [
  "Nhava Sheva (JNPT), Mumbai",
  "Mumbai Port",
  "Mundra Port, Gujarat",
  "Kandla Port (Deendayal), Gujarat",
  "Chennai Port, Tamil Nadu",
  "Ennore Port (Kamarajar), Tamil Nadu",
  "Tuticorin Port (V.O. Chidambaranar), Tamil Nadu",
  "Cochin Port (Kochi), Kerala",
  "Visakhapatnam Port, Andhra Pradesh",
  "Krishnapatnam Port, Andhra Pradesh",
  "Kolkata Port (Haldia), West Bengal",
  "Paradip Port, Odisha",
  "New Mangalore Port, Karnataka",
  "Mumbai (BOM) Airport",
  "Delhi (DEL) Airport",
  "Chennai (MAA) Airport",
  "Bengaluru (BLR) Airport",
  "Kochi (COK) Airport",
  "Hyderabad (HYD) Airport",
  "Ahmedabad (AMD) Airport",
  "Kolkata (CCU) Airport"
];
const FOREIGN_PORTS = [
  "Jebel Ali Port, Dubai, UAE",
  "Port Rashid, Dubai, UAE",
  "Khalifa Port, Abu Dhabi, UAE",
  "Port Khalid, Sharjah, UAE",
  "Dubai (DXB) Airport, UAE",
  "Abu Dhabi (AUH) Airport, UAE",
  "Port of Colombo, Sri Lanka",
  "Hambantota Port, Sri Lanka",
  "Colombo (CMB) Airport, Sri Lanka",
  "Port of Singapore (PSA), Singapore",
  "Jurong Port, Singapore",
  "Singapore Changi (SIN) Airport, Singapore",
  "Port of Shanghai, China",
  "Port of Shenzhen, China",
  "Ningbo-Zhoushan Port, China",
  "Port of Guangzhou, China",
  "Port of Qingdao, China",
  "Port of Tianjin, China",
  "Shanghai Pudong (PVG) Airport, China",
  "Guangzhou (CAN) Airport, China",
  "Port of Los Angeles, USA",
  "Port of Long Beach, USA",
  "Port of New York/New Jersey, USA",
  "Port of Savannah, USA",
  "Port of Houston, USA",
  "Port of Oakland, USA",
  "New York (JFK) Airport, USA",
  "Los Angeles (LAX) Airport, USA",
  "Port Said, Egypt",
  "Port of Alexandria, Egypt",
  "Damietta Port, Egypt",
  "Cairo (CAI) Airport, Egypt",
  "Port of Hamburg, Germany",
  "Port of Bremerhaven, Germany",
  "Frankfurt (FRA) Airport, Germany",
  "Port of Felixstowe, UK",
  "Port of Southampton, UK",
  "Port of London Tilbury, UK",
  "London Heathrow (LHR) Airport, UK",
  "Port of Le Havre, France",
  "Port of Marseille-Fos, France",
  "Paris Charles de Gaulle (CDG) Airport, France",
  "Port of Valencia, Spain",
  "Port of Barcelona, Spain",
  "Port of Algeciras, Spain",
  "Madrid-Barajas (MAD) Airport, Spain",
  "Port of Buenos Aires, Argentina",
  "Port of Rosario, Argentina",
  "Buenos Aires Ezeiza (EZE) Airport, Argentina",
  "Port of Santos, Brazil",
  "Port of Rio de Janeiro, Brazil",
  "Port of Paranaguá, Brazil",
  "São Paulo Guarulhos (GRU) Airport, Brazil",
  "Port of Yokohama, Japan",
  "Port of Tokyo, Japan",
  "Port of Kobe, Japan",
  "Port of Nagoya, Japan",
  "Port of Osaka, Japan",
  "Tokyo Narita (NRT) Airport, Japan",
  "Osaka Kansai (KIX) Airport, Japan",
  "Port of Busan, South Korea",
  "Port of Incheon, South Korea",
  "Seoul Incheon (ICN) Airport, South Korea",
  "Port of Ho Chi Minh (Cat Lai), Vietnam",
  "Port of Hai Phong, Vietnam",
  "Ho Chi Minh Tan Son Nhat (SGN) Airport, Vietnam",
  "Laem Chabang Port, Thailand",
  "Port of Bangkok (Khlong Toei), Thailand",
  "Bangkok Suvarnabhumi (BKK) Airport, Thailand",
  "Port Klang, Malaysia",
  "Port of Tanjung Pelepas, Malaysia",
  "Kuala Lumpur (KUL) Airport, Malaysia",
  "Tanjung Priok Port, Jakarta, Indonesia",
  "Port of Tanjung Perak, Surabaya, Indonesia",
  "Jakarta Soekarno-Hatta (CGK) Airport, Indonesia",
  "Port of Chittagong, Bangladesh",
  "Port of Mongla, Bangladesh",
  "Dhaka (DAC) Airport, Bangladesh",
  "Birgunj ICD (Dry Port), Nepal",
  "Kathmandu Tribhuvan (KTM) Airport, Nepal",
  "Jeddah Islamic Port, Saudi Arabia",
  "King Abdulaziz Port, Dammam, Saudi Arabia",
  "Jeddah (JED) Airport, Saudi Arabia",
  "Riyadh (RUH) Airport, Saudi Arabia",
  "Hamad Port, Doha, Qatar",
  "Doha Hamad (DOH) Airport, Qatar",
  "Shuwaikh Port, Kuwait",
  "Shuaiba Port, Kuwait",
  "Kuwait City (KWI) Airport, Kuwait",
  "Port of Salalah, Oman",
  "Port Sultan Qaboos, Muscat, Oman",
  "Muscat (MCT) Airport, Oman",
  "Khalifa Bin Salman Port, Bahrain",
  "Bahrain (BAH) Airport, Bahrain",
  "Port of Rotterdam, Netherlands",
  "Port of Amsterdam, Netherlands",
  "Amsterdam Schiphol (AMS) Airport, Netherlands",
  "Port of Genoa, Italy",
  "Port of Gioia Tauro, Italy",
  "Port of La Spezia, Italy",
  "Milan Malpensa (MXP) Airport, Italy",
  "Port of Ambarli, Istanbul, Turkey",
  "Port of Mersin, Turkey",
  "Istanbul (IST) Airport, Turkey",
  "Port of Novorossiysk (RUNVS), Russia",
  "Port of St. Petersburg (RULED), Russia",
  "Port of Vladivostok (RUVVO), Russia",
  "Moscow Sheremetyevo (SVO) Airport, Russia",
  "Port of Durban (ZADUR), South Africa",
  "Port of Cape Town (ZACPT), South Africa",
  "Johannesburg O.R. Tambo (JNB) Airport, South Africa",
  "Port of Sydney (AUSYD), Australia",
  "Port of Melbourne (AUMEL), Australia",
  "Sydney Kingsford Smith (SYD) Airport, Australia",
  "Port of Vancouver (CAVAN), Canada",
  "Port of Montreal (CAMTR), Canada",
  "Toronto Pearson (YYZ) Airport, Canada",
  "Port of Veracruz (MXVER), Mexico",
  "Port of Manzanillo (MXZLO), Mexico",
  "Mexico City (MEX) Airport, Mexico",
  "Port of Mombasa (KEMBA), Kenya",
  "Nairobi Jomo Kenyatta (NBO) Airport, Kenya",
  "Port of Lagos, Apapa (NGAPP), Nigeria",
  "Lagos Murtala Muhammed (LOS) Airport, Nigeria",
  "Port of Bandar Abbas (IRBND), Iran",
  "Tehran Imam Khomeini (IKA) Airport, Iran",
  "Port of Haifa (ILHFA), Israel",
  "Port of Ashdod (ILASH), Israel",
  "Tel Aviv Ben Gurion (TLV) Airport, Israel",
  "Port of Gdansk (PLGDN), Poland",
  "Port of Gdynia (PLGDY), Poland",
  "Warsaw Chopin (WAW) Airport, Poland"
];

/* BUGFIX (requested): FOREIGN_PORTS above already carries full Sea + Air
   port/airport data for 38 countries — but this dropdown, which every
   filing form (Export AND Import alike, see filingForm.js) and every
   Consignia Desk export document (Invoice, Certificate of Origin,
   License, Commodity Certs) uses for its Country field, only listed 10 of
   them. That silently hid 28 of the 38 countries FOREIGN_PORTS already
   supports — a student could never file for Sri Lanka, France, Vietnam,
   Kenya, etc. even though the ports/airports were sitting right there in
   the data. Expanded to all 38, one shared list feeding every form at
   once. Same country set as the Logistics Simulator's own Discharge
   Country list (job-engine.js DISCHARGE_PORTS_BY_COUNTRY), so cross-app
   bridging (bridgeMatchCountry below) now matches far more shipments
   too — previously anything outside the original 10 + the 3 short-form
   aliases (UAE/USA/UK) silently failed to bridge and left the field
   blank for the student to fill in by hand. */
const COUNTRIES = [
  'United Arab Emirates', 'Sri Lanka', 'Singapore', 'China', 'United States of America', 'Egypt',
  'Germany', 'United Kingdom', 'France', 'Spain', 'Argentina', 'Brazil',
  'Japan', 'South Korea', 'Vietnam', 'Thailand', 'Malaysia', 'Indonesia',
  'Bangladesh', 'Nepal', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Oman',
  'Bahrain', 'Netherlands', 'Italy', 'Turkey', 'Russia', 'South Africa',
  'Australia', 'Canada', 'Mexico', 'Kenya', 'Nigeria', 'Iran',
  'Israel', 'Poland'
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'INR'];
const FX_TO_INR = { USD: 83.2, EUR: 90.1, GBP: 105.4, AED: 22.65, SGD: 61.8, JPY: 0.56, INR: 1 };

// BUGFIX: CIP was missing — under Incoterms 2020, CIF/CFR/FOB are valid
// only for sea/inland waterway transport; the correct equivalents for
// any other mode (air, road, multimodal) are CIP and FCA. FCA was
// already here, but an air/road shipment had no CIP option and could
// only be given the sea-only CIF/CFR terms, which is a real, common
// mistake this list should help a student avoid, not reinforce.
const INCOTERMS = ['FOB', 'CIF', 'CFR', 'CIP', 'EXW', 'DAP', 'FCA'];
const MODES_OF_TRANSPORT = ['Sea', 'Air', 'Land (ICD/LCS)'];
const UNITS = ['PCS', 'KGS', 'BOX', 'CTN', 'SET', 'MTR', 'DOZ', 'PAIR'];
const PACKAGE_TYPES = ['Carton', 'Wooden Crate', 'Pallet', 'Drum', 'Bag', 'Case'];
const CONTAINER_TYPES = ["20' Standard (Dry)", "40' Standard (Dry)", "40' High Cube", "Reefer 20'", "Reefer 40'", 'LCL (Not Containerized)'];

/* Training HS Code table: code -> real duty-structure fields (approximated for training —
   verify exact current rates against the CBIC Customs Tariff / notifications before real-world use) */
const HS_CODE_TABLE = {
  '30049099': { desc: 'Pharmaceutical products, other medicaments', bcdRate: 0.10, cessRate: 0, addRate: 0, pgaAgency: 'DRUG_CONTROLLER', riskTier: 'Medium', ftaPrefix: '30', drawbackAIR: 0.015, rodtepRate: 0.007 },
  '62034200': { desc: "Men's trousers, cotton, not knitted", bcdRate: 0.20, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '62', drawbackAIR: 0.019, rodtepRate: 0.025 },
  '85171200': { desc: 'Mobile phones / smartphones', bcdRate: 0.15, cessRate: 0, addRate: 0, pgaAgency: 'BIS', riskTier: 'Medium', ftaPrefix: '85', drawbackAIR: 0.011, rodtepRate: 0.010 },
  '09024010': { desc: 'Black tea, packaged', bcdRate: 0.10, cessRate: 0, addRate: 0, pgaAgency: 'FSSAI', riskTier: 'Low', ftaPrefix: '09', drawbackAIR: 0.010, rodtepRate: 0.005 },
  '39269099': { desc: 'Articles of plastics, other', bcdRate: 0.10, cessRate: 0, addRate: 0.15, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '39', drawbackAIR: 0.013, rodtepRate: 0.006 },
  '84713010': { desc: 'Laptop / portable computers', bcdRate: 0.00, cessRate: 0, addRate: 0, pgaAgency: 'BIS', riskTier: 'Low', ftaPrefix: '84', drawbackAIR: 0.010, rodtepRate: 0.008 },
  '61091000': { desc: 'T-shirts, cotton, knitted', bcdRate: 0.20, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '61', drawbackAIR: 0.022, rodtepRate: 0.028 },
  '71131900': { desc: 'Jewellery of precious metal', bcdRate: 0.25, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'High', ftaPrefix: '71', drawbackAIR: 0.002, rodtepRate: 0.003 },
  '87089900': { desc: 'Motor vehicle parts, other', bcdRate: 0.15, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '87', drawbackAIR: 0.017, rodtepRate: 0.015 },
  '52081100': { desc: 'Cotton woven fabric, unbleached', bcdRate: 0.10, cessRate: 0, addRate: 0, pgaAgency: 'TEXTILE_COMMITTEE', riskTier: 'Low', ftaPrefix: '52', drawbackAIR: 0.014, rodtepRate: 0.020 },
  /* BUGFIX (requested): HS Code here is a closed dropdown sourced from
     this table, not free text — a scenario needs the commodity's actual
     code to already exist here, or the Item Details step simply cannot
     be completed for it. These entries were missing entirely for two
     genuinely common categories: medical devices (as opposed to just
     "medicaments", which 30049099 already covered) and watches (no
     Chapter 91 entry existed at all). */
  '30043100': { desc: 'Medicaments containing insulin', bcdRate: 0.10, cessRate: 0, addRate: 0, pgaAgency: 'DRUG_CONTROLLER', riskTier: 'Medium', ftaPrefix: '30', drawbackAIR: 0.015, rodtepRate: 0.007 },
  '90183100': { desc: 'Syringes, with or without needles', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DRUG_CONTROLLER', riskTier: 'Low', ftaPrefix: '90', drawbackAIR: 0.012, rodtepRate: 0.006 },
  '90189099': { desc: 'Other medical/surgical instruments and appliances (BP monitors, infusion pumps, etc.)', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DRUG_CONTROLLER', riskTier: 'Medium', ftaPrefix: '90', drawbackAIR: 0.012, rodtepRate: 0.006 },
  '63079090': { desc: 'Made-up textile articles, other (incl. surgical/face masks)', bcdRate: 0.10, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '63', drawbackAIR: 0.014, rodtepRate: 0.018 },
  '91011900': { desc: 'Wrist-watches, case of precious metal, other than automatic', bcdRate: 0.20, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'High', ftaPrefix: '91', drawbackAIR: 0.005, rodtepRate: 0.003 },
  '91012100': { desc: 'Wrist-watches, case of precious metal, with automatic winding', bcdRate: 0.20, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'High', ftaPrefix: '91', drawbackAIR: 0.005, rodtepRate: 0.003 },
  '91021900': { desc: 'Wrist-watches, case not of precious metal, mechanical/automatic', bcdRate: 0.20, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '91', drawbackAIR: 0.008, rodtepRate: 0.005 },
  '91022900': { desc: 'Wrist-watches, case not of precious metal, electrically operated (quartz)', bcdRate: 0.20, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '91', drawbackAIR: 0.008, rodtepRate: 0.005 },
  '91119000': { desc: 'Watch cases and parts thereof, other', bcdRate: 0.10, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '91', drawbackAIR: 0.010, rodtepRate: 0.006 },
  '91131000': { desc: 'Watch straps/bands and parts, of precious or base metal', bcdRate: 0.10, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '91', drawbackAIR: 0.010, rodtepRate: 0.006 },
  /* ===== High-value & controlled goods (defence, aerospace / satellite, capital machinery, precious items, chemicals) — added for training.
     Duty, drawback and RoDTEP figures are approximations for practice only; SCOMET-flagged lines need an export authorisation and PGA lines need a No Objection Certificate. ===== */
  '93012000': { desc: 'Rocket launchers, flame-throwers, grenade launchers, torpedo tubes (military)', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '93', drawbackAIR: 0.002, rodtepRate: 0.002, scomet: true },
  '93019000': { desc: 'Military weapons (artillery, machine guns, assault rifles), other', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '93', drawbackAIR: 0.002, rodtepRate: 0.002, scomet: true },
  '93020000': { desc: 'Revolvers and pistols (military / law-enforcement)', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '93', drawbackAIR: 0.002, rodtepRate: 0.002, scomet: true },
  '93033000': { desc: 'Other sporting / hunting rifles', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '93', drawbackAIR: 0.002, rodtepRate: 0.002, scomet: true },
  '93059100': { desc: 'Parts and accessories of military weapons', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '93', drawbackAIR: 0.003, rodtepRate: 0.003, scomet: true },
  '93063000': { desc: 'Cartridges and ammunition, other, and parts thereof', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '93', drawbackAIR: 0.002, rodtepRate: 0.002, scomet: true },
  '93069000': { desc: 'Bombs, grenades, torpedoes, mines, missiles and similar munitions', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '93', drawbackAIR: 0.002, rodtepRate: 0.002, scomet: true },
  '87100000': { desc: 'Tanks and other armoured fighting vehicles, with or without weapons', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '87', drawbackAIR: 0.002, rodtepRate: 0.002, scomet: true },
  '89061000': { desc: 'Warships and naval combat vessels', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '89', drawbackAIR: 0.002, rodtepRate: 0.002, scomet: true },
  '88051000': { desc: 'Aircraft launching gear, deck-arrestor gear; parts thereof', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '88', drawbackAIR: 0.004, rodtepRate: 0.003, scomet: true },
  '85261000': { desc: 'Radar apparatus (surveillance / fire-control / airborne)', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '85', drawbackAIR: 0.006, rodtepRate: 0.004, scomet: true },
  '85269100': { desc: 'Radio navigational aid apparatus (GPS / inertial / direction-finding)', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '85', drawbackAIR: 0.006, rodtepRate: 0.004, scomet: true },
  '85402000': { desc: 'Image intensifier / night-vision tubes, television camera tubes', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '85', drawbackAIR: 0.005, rodtepRate: 0.004, scomet: true },
  '90132000': { desc: 'Lasers, other than laser diodes (range-finders, designators)', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '90', drawbackAIR: 0.005, rodtepRate: 0.004, scomet: true },
  '90131000': { desc: 'Telescopic sights for arms; periscopes; telescopes for machines', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '90', drawbackAIR: 0.005, rodtepRate: 0.004, scomet: true },
  '90151000': { desc: 'Rangefinders (optical / laser)', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '90', drawbackAIR: 0.005, rodtepRate: 0.004, scomet: true },
  '90142000': { desc: 'Instruments for aeronautical or space navigation (inertial, gyro, avionics)', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '90', drawbackAIR: 0.005, rodtepRate: 0.004, scomet: true },
  '90148000': { desc: 'Other navigational instruments and appliances', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '90', drawbackAIR: 0.005, rodtepRate: 0.004, scomet: true },
  '85176290': { desc: 'Secure communication / switching equipment (tactical radios, encrypted)', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '85', drawbackAIR: 0.008, rodtepRate: 0.006, scomet: true },
  '88062400': { desc: 'Unmanned aircraft / drones, remote-piloted, 25 kg to 150 kg', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'High', ftaPrefix: '88', drawbackAIR: 0.006, rodtepRate: 0.004, scomet: true },
  '88062900': { desc: 'Unmanned aircraft / drones, other', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'High', ftaPrefix: '88', drawbackAIR: 0.006, rodtepRate: 0.004, scomet: true },
  '88062200': { desc: 'Unmanned aircraft / drones, 250 g to 7 kg (remote-controlled)', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'Medium', ftaPrefix: '88', drawbackAIR: 0.006, rodtepRate: 0.004 },
  '88021100': { desc: 'Helicopters, unladen weight not exceeding 2,000 kg', bcdRate: 0.025, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'High', ftaPrefix: '88', drawbackAIR: 0.003, rodtepRate: 0.003 },
  '88021200': { desc: 'Helicopters, unladen weight exceeding 2,000 kg', bcdRate: 0.025, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'High', ftaPrefix: '88', drawbackAIR: 0.003, rodtepRate: 0.003 },
  '88023000': { desc: 'Aeroplanes, unladen weight 2,000 kg to 15,000 kg', bcdRate: 0.025, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'High', ftaPrefix: '88', drawbackAIR: 0.003, rodtepRate: 0.003 },
  '88024000': { desc: 'Aeroplanes, unladen weight exceeding 15,000 kg', bcdRate: 0.025, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'High', ftaPrefix: '88', drawbackAIR: 0.003, rodtepRate: 0.003 },
  '88026000': { desc: 'Spacecraft (including satellites), suborbital and spacecraft launch vehicles', bcdRate: 0.00, cessRate: 0, addRate: 0, pgaAgency: 'DOS_IN_SPACE', riskTier: 'High', ftaPrefix: '88', drawbackAIR: 0.002, rodtepRate: 0.002, scomet: true },
  '88073000': { desc: 'Other parts of aeroplanes or helicopters', bcdRate: 0.025, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'Medium', ftaPrefix: '88', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '88079000': { desc: 'Parts of spacecraft / launch vehicles and satellites, other', bcdRate: 0.00, cessRate: 0, addRate: 0, pgaAgency: 'DOS_IN_SPACE', riskTier: 'High', ftaPrefix: '88', drawbackAIR: 0.004, rodtepRate: 0.003, scomet: true },
  '85291090': { desc: 'Satellite dish antennas, antenna reflectors and parts thereof', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'DOS_IN_SPACE', riskTier: 'Medium', ftaPrefix: '85', drawbackAIR: 0.01, rodtepRate: 0.008 },
  '85256000': { desc: 'Transmission apparatus incorporating reception apparatus (satellite transponders, ground terminals)', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'DOS_IN_SPACE', riskTier: 'High', ftaPrefix: '85', drawbackAIR: 0.008, rodtepRate: 0.006, scomet: true },
  '85255000': { desc: 'Transmission apparatus for radio-broadcasting / television (satellite uplink)', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'DOS_IN_SPACE', riskTier: 'High', ftaPrefix: '85', drawbackAIR: 0.008, rodtepRate: 0.006, scomet: true },
  '85176100': { desc: 'Base stations for cellular / wireless networks', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '85', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '85299090': { desc: 'Parts of radar, radio navigation and satellite transmission apparatus', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'DOS_IN_SPACE', riskTier: 'Medium', ftaPrefix: '85', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '84111100': { desc: 'Turbo-jets, thrust not exceeding 25 kN (aircraft / missile engines)', bcdRate: 0.025, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'High', ftaPrefix: '84', drawbackAIR: 0.004, rodtepRate: 0.003, scomet: true },
  '84111200': { desc: 'Turbo-jets, thrust exceeding 25 kN (aircraft engines)', bcdRate: 0.025, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'High', ftaPrefix: '84', drawbackAIR: 0.004, rodtepRate: 0.003, scomet: true },
  '84112100': { desc: 'Turbo-propellers, power not exceeding 1,100 kW', bcdRate: 0.025, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'High', ftaPrefix: '84', drawbackAIR: 0.004, rodtepRate: 0.003, scomet: true },
  '84118100': { desc: 'Gas turbines, power not exceeding 5,000 kW', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'High', ftaPrefix: '84', drawbackAIR: 0.006, rodtepRate: 0.004 },
  '84118200': { desc: 'Gas turbines, power exceeding 5,000 kW', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'High', ftaPrefix: '84', drawbackAIR: 0.006, rodtepRate: 0.004 },
  '84119100': { desc: 'Parts of turbo-jets or turbo-propellers', bcdRate: 0.025, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '84071000': { desc: 'Aircraft spark-ignition reciprocating piston engines', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DGCA', riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '84011000': { desc: 'Nuclear reactors', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'AERB_DAE', riskTier: 'High', ftaPrefix: '84', drawbackAIR: 0.002, rodtepRate: 0.002, scomet: true },
  '84012000': { desc: 'Machinery and apparatus for isotopic separation, and parts', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'AERB_DAE', riskTier: 'High', ftaPrefix: '84', drawbackAIR: 0.002, rodtepRate: 0.002, scomet: true },
  '84021100': { desc: 'Watertube boilers, steam production exceeding 45 t/h', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '84068100': { desc: 'Steam turbines and other vapour turbines, output exceeding 40 MW', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.006, rodtepRate: 0.005 },
  '84061000': { desc: 'Steam turbines for marine propulsion', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.006, rodtepRate: 0.005 },
  '85023100': { desc: 'Wind-powered generating sets', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '85', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '85042300': { desc: 'Liquid dielectric transformers, power handling capacity exceeding 10,000 kVA', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '85', drawbackAIR: 0.01, rodtepRate: 0.008 },
  '85044090': { desc: 'Static converters / inverters, other', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '85', drawbackAIR: 0.01, rodtepRate: 0.008 },
  '84795000': { desc: 'Industrial robots, not elsewhere specified', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.01, rodtepRate: 0.008 },
  '84571000': { desc: 'Machining centres for working metal', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DGFT_SCOMET', riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.01, rodtepRate: 0.008, scomet: true },
  '84581100': { desc: 'Horizontal lathes, numerically controlled, for removing metal', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DGFT_SCOMET', riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.01, rodtepRate: 0.008, scomet: true },
  '84596100': { desc: 'Milling machines, numerically controlled (5-axis)', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DGFT_SCOMET', riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.01, rodtepRate: 0.008, scomet: true },
  '84563000': { desc: 'Machine-tools operated by electro-discharge (EDM)', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DGFT_SCOMET', riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.01, rodtepRate: 0.008, scomet: true },
  '84561100': { desc: 'Machine-tools operated by laser', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DGFT_SCOMET', riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.01, rodtepRate: 0.008, scomet: true },
  '84862000': { desc: 'Machines for the manufacture of semiconductor devices or integrated circuits', bcdRate: 0.00, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.004, rodtepRate: 0.003 },
  '84863000': { desc: 'Machines for the manufacture of flat panel displays', bcdRate: 0.00, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '84', drawbackAIR: 0.004, rodtepRate: 0.003 },
  '84261100': { desc: 'Overhead travelling cranes on fixed support', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '84', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '84263000': { desc: 'Portal or pedestal jib cranes', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '84', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '84295100': { desc: 'Self-propelled front-end shovel loaders', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '84', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '84304100': { desc: 'Self-propelled boring or sinking machinery, other', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '84', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '86011000': { desc: 'Rail locomotives powered from an external source of electricity', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '86', drawbackAIR: 0.01, rodtepRate: 0.008 },
  '86021000': { desc: 'Diesel-electric locomotives', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '86', drawbackAIR: 0.01, rodtepRate: 0.008 },
  '89012000': { desc: 'Tankers (crude oil / product carriers)', bcdRate: 0.05, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '89', drawbackAIR: 0.004, rodtepRate: 0.003 },
  '89039200': { desc: 'Motorboats and yachts, other than outboard motorboats', bcdRate: 0.25, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'High', ftaPrefix: '89', drawbackAIR: 0.004, rodtepRate: 0.003 },
  '84715000': { desc: 'Digital processing units / servers for data centres', bcdRate: 0.00, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '84', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '85423100': { desc: 'Electronic integrated circuits: processors and controllers', bcdRate: 0.00, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '85', drawbackAIR: 0.004, rodtepRate: 0.003 },
  '85423900': { desc: 'Electronic integrated circuits, other', bcdRate: 0.00, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '85', drawbackAIR: 0.004, rodtepRate: 0.003 },
  '85235100': { desc: 'Solid-state non-volatile storage devices (SSDs, flash)', bcdRate: 0.00, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '85', drawbackAIR: 0.006, rodtepRate: 0.005 },
  '85414300': { desc: 'Photovoltaic cells assembled in modules or panels (solar panels)', bcdRate: 0.4, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '85', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '85076000': { desc: 'Lithium-ion electric accumulators (batteries)', bcdRate: 0.2, cessRate: 0, addRate: 0, pgaAgency: 'BIS', riskTier: 'Medium', ftaPrefix: '85', drawbackAIR: 0.01, rodtepRate: 0.008 },
  '87038000': { desc: 'Motor cars with only electric motor for propulsion (EV)', bcdRate: 1.00, cessRate: 0, addRate: 0, pgaAgency: 'BIS', riskTier: 'High', ftaPrefix: '87', drawbackAIR: 0.006, rodtepRate: 0.005 },
  '90181300': { desc: 'Magnetic resonance imaging (MRI) apparatus', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DRUG_CONTROLLER', riskTier: 'Medium', ftaPrefix: '90', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '90181200': { desc: 'Ultrasonic scanning apparatus', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DRUG_CONTROLLER', riskTier: 'Medium', ftaPrefix: '90', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '90221200': { desc: 'Computed tomography (CT) apparatus', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DRUG_CONTROLLER', riskTier: 'Medium', ftaPrefix: '90', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '90221400': { desc: 'X-ray apparatus for medical, surgical or veterinary uses, other', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DRUG_CONTROLLER', riskTier: 'Medium', ftaPrefix: '90', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '90222100': { desc: 'Apparatus based on alpha, beta, gamma radiation (radiotherapy), medical', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'AERB_DAE', riskTier: 'High', ftaPrefix: '90', drawbackAIR: 0.004, rodtepRate: 0.003 },
  '90121000': { desc: 'Electron microscopes and diffraction apparatus', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '90', drawbackAIR: 0.006, rodtepRate: 0.005 },
  '90273000': { desc: 'Spectrometers, spectrophotometers and spectrographs using optical radiation', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '90', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '90301000': { desc: 'Instruments for measuring or detecting ionising radiations', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'AERB_DAE', riskTier: 'Medium', ftaPrefix: '90', drawbackAIR: 0.006, rodtepRate: 0.005 },
  '30022000': { desc: 'Vaccines for human medicine', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'DRUG_CONTROLLER', riskTier: 'Medium', ftaPrefix: '30', drawbackAIR: 0.01, rodtepRate: 0.006 },
  '71081300': { desc: 'Gold, semi-manufactured forms (non-monetary)', bcdRate: 0.06, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'High', ftaPrefix: '71', drawbackAIR: 0.001, rodtepRate: 0.001 },
  '71081200': { desc: 'Gold, other unwrought forms (bars / dore) (non-monetary)', bcdRate: 0.06, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'High', ftaPrefix: '71', drawbackAIR: 0.001, rodtepRate: 0.001 },
  '71023910': { desc: 'Diamonds, non-industrial, worked (cut and polished)', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'High', ftaPrefix: '71', drawbackAIR: 0.001, rodtepRate: 0.001 },
  '71023100': { desc: 'Diamonds, non-industrial, unworked or simply sawn / cleaved', bcdRate: 0.00, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'High', ftaPrefix: '71', drawbackAIR: 0.001, rodtepRate: 0.001 },
  '71039100': { desc: 'Rubies, sapphires and emeralds, otherwise worked', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'High', ftaPrefix: '71', drawbackAIR: 0.001, rodtepRate: 0.001 },
  '71101100': { desc: 'Platinum, unwrought or in powder form', bcdRate: 0.06, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'High', ftaPrefix: '71', drawbackAIR: 0.001, rodtepRate: 0.001 },
  '28441000': { desc: 'Natural uranium and its compounds; alloys, dispersions and ceramics containing them', bcdRate: 0.00, cessRate: 0, addRate: 0, pgaAgency: 'AERB_DAE', riskTier: 'High', ftaPrefix: '28', drawbackAIR: 0.002, rodtepRate: 0.002, scomet: true },
  '28469000': { desc: 'Compounds of rare-earth metals, yttrium or scandium, other', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DGFT_SCOMET', riskTier: 'Medium', ftaPrefix: '28', drawbackAIR: 0.008, rodtepRate: 0.006, scomet: true },
  '74031100': { desc: 'Refined copper cathodes and sections of cathodes', bcdRate: 0.025, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '74', drawbackAIR: 0.006, rodtepRate: 0.005 },
  '75021000': { desc: 'Nickel, not alloyed, unwrought', bcdRate: 0.025, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '75', drawbackAIR: 0.006, rodtepRate: 0.005 },
  '81082000': { desc: 'Titanium, unwrought; powders (aerospace grade)', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DGFT_SCOMET', riskTier: 'Medium', ftaPrefix: '81', drawbackAIR: 0.008, rodtepRate: 0.006, scomet: true },
  '81089000': { desc: 'Titanium, articles thereof, other', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'DGFT_SCOMET', riskTier: 'Medium', ftaPrefix: '81', drawbackAIR: 0.008, rodtepRate: 0.006, scomet: true },
  '28046100': { desc: 'Silicon containing not less than 99.99% silicon (semiconductor / solar grade)', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '28', drawbackAIR: 0.006, rodtepRate: 0.005 },
  '28369100': { desc: 'Lithium carbonates', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '28', drawbackAIR: 0.01, rodtepRate: 0.008 },
  '28252000': { desc: 'Lithium oxide and hydroxide', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '28', drawbackAIR: 0.01, rodtepRate: 0.008 },
  '28011000': { desc: 'Chlorine', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '28', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '28061000': { desc: 'Hydrogen chloride (hydrochloric acid)', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '28', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '28070010': { desc: 'Sulphuric acid', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '28', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '28080000': { desc: 'Nitric acid; sulphonitric acids', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'NACWC', riskTier: 'High', ftaPrefix: '28', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '28111100': { desc: 'Hydrogen fluoride (hydrofluoric acid)', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'NACWC', riskTier: 'High', ftaPrefix: '28', drawbackAIR: 0.012, rodtepRate: 0.01, scomet: true },
  '28121000': { desc: 'Chlorides and chloride oxides of phosphorus / sulphur (CWC-scheduled precursors)', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'NACWC', riskTier: 'High', ftaPrefix: '28', drawbackAIR: 0.012, rodtepRate: 0.01, scomet: true },
  '28151100': { desc: 'Sodium hydroxide (caustic soda), solid', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '28', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '28342100': { desc: 'Nitrates of potassium', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'PESO', riskTier: 'Medium', ftaPrefix: '28', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '31021000': { desc: 'Urea, whether or not in aqueous solution', bcdRate: 0.05, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '31', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '31023000': { desc: 'Ammonium nitrate, whether or not in aqueous solution', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'PESO', riskTier: 'High', ftaPrefix: '31', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '31053000': { desc: 'Diammonium hydrogenorthophosphate (DAP)', bcdRate: 0.05, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '31', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '31042000': { desc: 'Potassium chloride (muriate of potash)', bcdRate: 0.05, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '31', drawbackAIR: 0.008, rodtepRate: 0.006 },
  '29012100': { desc: 'Ethylene', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'PESO', riskTier: 'Medium', ftaPrefix: '29', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '29012200': { desc: 'Propene (propylene)', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'PESO', riskTier: 'Medium', ftaPrefix: '29', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '29022000': { desc: 'Benzene', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'PESO', riskTier: 'Medium', ftaPrefix: '29', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '29023000': { desc: 'Toluene', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'PESO', riskTier: 'Medium', ftaPrefix: '29', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '29051100': { desc: 'Methanol (methyl alcohol)', bcdRate: 0.05, cessRate: 0, addRate: 0, pgaAgency: 'PESO', riskTier: 'Medium', ftaPrefix: '29', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '29053100': { desc: 'Ethylene glycol (ethanediol)', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '29', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '29071100': { desc: 'Phenol (hydroxybenzene) and its salts', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Medium', ftaPrefix: '29', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '29153100': { desc: 'Ethyl acetate', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '29', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '29173600': { desc: 'Terephthalic acid and its salts (PTA)', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '29', drawbackAIR: 0.012, rodtepRate: 0.01 },
  '29309099': { desc: 'Organo-sulphur compounds, other', bcdRate: 0.075, cessRate: 0, addRate: 0, pgaAgency: 'NACWC', riskTier: 'High', ftaPrefix: '29', drawbackAIR: 0.012, rodtepRate: 0.01, scomet: true },
  '36010000': { desc: 'Propellent powders', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '36', drawbackAIR: 0.004, rodtepRate: 0.003, scomet: true },
  '36020000': { desc: 'Prepared explosives, other than propellent powders', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: 'MOD_DDP', riskTier: 'High', ftaPrefix: '36', drawbackAIR: 0.004, rodtepRate: 0.003, scomet: true },
  '38089400': { desc: 'Disinfectants, put up for retail sale or as preparations', bcdRate: 0.1, cessRate: 0, addRate: 0, pgaAgency: null, riskTier: 'Low', ftaPrefix: '38', drawbackAIR: 0.012, rodtepRate: 0.01 }
};
const IGST_RATE_DEFAULT = 0.18;
const SWS_RATE = 0.10; /* Social Welfare Surcharge — 10% of Basic Customs Duty, standard rate */

/* Participating Government Agencies under the Single Window Interface for Trade (SWIFT) —
   real agency set for these commodity categories; simplified NOC workflow for training */
const PGA_AGENCIES = {
  FSSAI: { name: 'Food Safety and Standards Authority of India (FSSAI)', noc: 'No Objection Certificate' },
  PLANT_QUARANTINE: { name: 'Plant Quarantine Authority (DPPQS)', noc: 'Phytosanitary / Import Permit Clearance' },
  DRUG_CONTROLLER: { name: 'Drug Controller (CDSCO)', noc: 'Import/Registration NOC' },
  BIS: { name: 'Bureau of Indian Standards (BIS)', noc: 'Compulsory Registration Scheme (CRS) Clearance' },
  WILDLIFE: { name: 'Wildlife Crime Control Bureau', noc: 'CITES / Wildlife Clearance' },
  TEXTILE_COMMITTEE: { name: 'Textile Committee', noc: 'Textile Testing / Quality NOC' },
  DGFT_SCOMET: { name: 'DGFT - SCOMET Authorisation Cell', noc: 'SCOMET Export / Import Authorisation' },
  MOD_DDP: { name: 'Ministry of Defence - Department of Defence Production', noc: 'Defence Stores Export / Import NOC' },
  DOS_IN_SPACE: { name: 'Department of Space / IN-SPACe', noc: 'Space & Satellite Equipment Clearance' },
  AERB_DAE: { name: 'Department of Atomic Energy / AERB', noc: 'Radioactive & Nuclear Material Clearance' },
  NACWC: { name: 'National Authority - Chemical Weapons Convention (NACWC)', noc: 'Scheduled Chemicals Clearance' },
  DGCA: { name: 'Directorate General of Civil Aviation (DGCA)', noc: 'Aircraft / RPAS Import-Export Clearance' },
  PESO: { name: 'Petroleum & Explosives Safety Organisation (PESO)', noc: 'Explosives / Hazardous Chemicals Licence' }
};

/* Free Trade Agreements — simplified preferential-rate model for training.
   Real preferential rates vary by exact tariff line and rules-of-origin criteria. */
const FTA_AGREEMENTS = [
  { code: 'INDIA_UAE_CEPA', name: 'India–UAE Comprehensive Economic Partnership Agreement (CEPA)', partnerCountries: ['United Arab Emirates'], preferentialBcdRate: 0 },
  { code: 'INDIA_ASEAN', name: 'India–ASEAN Trade in Goods Agreement', partnerCountries: ['Singapore'], preferentialBcdRate: 0.05 },
  { code: 'INDIA_JAPAN_CEPA', name: 'India–Japan CEPA', partnerCountries: ['Japan'], preferentialBcdRate: 0.05 }
];

/* Country risk tiers — used by the training Risk Management System (RMS) score */
const COUNTRY_RISK = {
  'United Arab Emirates': 'Low', 'Singapore': 'Low', 'Japan': 'Low', 'Germany': 'Low', 'United Kingdom': 'Low', 'Netherlands': 'Low',
  'United States of America': 'Medium', 'Australia': 'Medium', 'Saudi Arabia': 'Medium',
  'China': 'High',
  // BUGFIX: only 10 of the 38 countries in COUNTRIES had an explicit risk
  // tier here — every other country silently fell back to 'Medium'
  // (harmless, but incomplete). Filled in the rest so risk tiers are an
  // actual judgment call for every country, not a default for most of
  // them.
  'France': 'Low', 'Vietnam': 'Medium', 'Sri Lanka': 'Low', 'Egypt': 'Medium', 'Spain': 'Low', 'Argentina': 'Medium',
  'Brazil': 'Medium', 'South Korea': 'Low', 'Thailand': 'Low', 'Malaysia': 'Low', 'Indonesia': 'Medium', 'Bangladesh': 'Medium',
  'Nepal': 'Medium', 'Qatar': 'Low', 'Kuwait': 'Low', 'Oman': 'Low', 'Bahrain': 'Low', 'Italy': 'Low', 'Turkey': 'Medium',
  'Russia': 'High', 'South Africa': 'Medium', 'Canada': 'Low', 'Mexico': 'Medium', 'Kenya': 'Medium', 'Nigeria': 'High',
  'Iran': 'High', 'Israel': 'Low', 'Poland': 'Low'
};

const EXPORT_SCHEMES = ['None', 'Advance Authorization', 'EPCG (Export Promotion Capital Goods)', 'RoDTEP', 'Duty Drawback'];

/* e-Sanchit document type codes — illustrative of the real CBIC e-Sanchit coding pattern
   (Document Code Directory published by ICEGATE); treat as representative for training, not
   a verified live lookup of current codes. */
const ESANCHIT_CODES = {
  'Commercial Invoice': '0001004000001',
  'Packing List': '0003001500001',
  'Certificate of Origin': '0006001200001',
  'Insurance Certificate': '0005000900001',
  'Bill of Lading / Air Waybill': '0002000100001'
};

/* Demo DGFT scheme licenses (fictional, seeded per training exporter/importer IEC).
   'balance' = remaining Export Obligation (EO) value in INR still to be fulfilled by
   exporting against this license — it starts equal to exportObligationValue and is
   debited by the FOB value of every export filed against it, exactly as EO tracking
   works in practice under the Advance Authorization / EPCG schemes. */
const DEMO_LICENSE_SEED = [
  { licenseNo: 'AA/2026/001122', type: 'Advance Authorization', iec: '0301045678',
    cifValue: 4000000, dutySavedAmount: 800000, exportObligationValue: 5000000, balance: 5000000,
    validityDate: '2027-06-30', linkedFilingIds: [], redeemed: false },
  { licenseNo: 'EPCG/2026/004488', type: 'EPCG (Export Promotion Capital Goods)', iec: '0301099821',
    cifValue: 2500000, dutySavedAmount: 333333, exportObligationValue: 2000000, balance: 2000000,
    validityDate: '2032-03-31', linkedFilingIds: [], redeemed: false }
];

/* Demo clients a Customs Broker (CHA) can file on behalf of, under Power of Attorney */
const DEMO_CLIENTS = [
  { iec: '0301045678', name: 'Rahul Mehta (Exporter)', gstin: '27AAACR5055K1Z8', pan: 'AAACR5055K', poaRef: 'POA-2026-EXP-001', type: 'export' },
  { iec: '0301099821', name: 'Sunita Rao (Importer)', gstin: '27AAACS8871L1Z2', pan: 'AAACS8871L', poaRef: 'POA-2026-IMP-001', type: 'import' }
];

const CHECK_TYPES = ['Second Check (Assess, then Examine if selected)', 'First Check (Examine before Assessment)'];

const DOCUMENT_TYPES_EXPORT = ['Commercial Invoice', 'Packing List', 'Certificate of Origin', 'Insurance Certificate'];
const DOCUMENT_TYPES_IMPORT = ['Bill of Lading / Air Waybill', 'Commercial Invoice', 'Packing List', 'Certificate of Origin', 'Insurance Certificate'];

const STATUS_LABELS = {
  DRAFT: 'Draft',
  VALIDATION: 'Validation Pending',
  SUBMITTED: 'Submitted',
  ACKNOWLEDGED: 'Acknowledged',
  UNDER_PROCESS: 'Under Customs Process',
  QUERY_RAISED: 'Query Raised',
  QUERY_REPLIED: 'Query Replied',
  EXAMINATION: 'Examination',
  ASSESSED: 'Assessed',
  DUTY_PENDING: 'Duty Pending',
  DUTY_PAID: 'Duty Paid',
  CLEARED: 'Cleared',
  LEO: 'Let Export Order Issued',
  OOC: 'Out of Charge Granted',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected'
};

const STATUS_BADGE_CLASS = {
  DRAFT: 'badge-grey', VALIDATION: 'badge-amber', SUBMITTED: 'badge-blue', ACKNOWLEDGED: 'badge-blue',
  UNDER_PROCESS: 'badge-blue', QUERY_RAISED: 'badge-red', QUERY_REPLIED: 'badge-amber', EXAMINATION: 'badge-amber',
  ASSESSED: 'badge-blue', DUTY_PENDING: 'badge-amber', DUTY_PAID: 'badge-green', CLEARED: 'badge-green',
  LEO: 'badge-green', OOC: 'badge-green', COMPLETED: 'badge-green', REJECTED: 'badge-red'
};

/* Training scenarios — difficulty tiers: Beginner / Intermediate / Advanced / Professional
   (Section 31 of the training build spec — 20 scenarios across all levels) */
const SCENARIOS = [
  {
    id: 'S1', type: 'export', title: 'Scenario 1 — Simple Export',
    difficulty: 'Beginner', learningPoint: 'End-to-end straightforward export filing with no complications — learn the baseline workflow.',
    desc: 'Export 500 cartons of pharmaceutical products from India to UAE. Straightforward filing with no query or examination.',
    forceQuery: false, forceExam: false, forceDiscrepancy: false,
    prefill: {
      party: { exporterName: 'Rahul Mehta', iec: '0301045678', gstin: '27AAACR5055K1Z8', pan: 'AAACR5055K', address: 'Plot 14, MIDC Industrial Area, Pune, Maharashtra', contact: '+91 98220 11223', authorizedPerson: 'Rahul Mehta' },
      counterparty: { consigneeName: 'Al Noor Trading LLC', address: 'Warehouse 22, Jebel Ali Free Zone, Dubai', country: 'United Arab Emirates', port: 'AEJEA - Jebel Ali, UAE', contact: '+971 4 881 2200' },
      shipment: { portOfLoading: 'INNSA1 - Nhava Sheva (JNPT), Mumbai', portOfDischarge: 'AEJEA - Jebel Ali, UAE', countryOfDestination: 'United Arab Emirates', modeOfTransport: 'Sea', vesselFlight: 'MV KOTA LESTARI', voyageFlight: 'V.221E', shipmentRef: 'SHP-EXP-1001' },
      invoice: { invoiceNo: 'INV-EXP-8801', invoiceDate: '', currency: 'USD', invoiceValue: 42500, fobValue: 42500, freight: 1800, insurance: 300, incoterm: 'FOB', paymentTerms: 'Advance Payment' },
      items: [{ description: 'Pharmaceutical products, general medicaments (assorted)', hsCode: '30049099', qty: 500, unit: 'CTN', unitPrice: 85, origin: 'India', packages: 500, grossWeight: 5200, netWeight: 5000 }]
    }
  },
  {
    id: 'S2', type: 'export', title: 'Scenario 2 — Export with Customs Query',
    difficulty: 'Intermediate', learningPoint: 'Practice reading a customs query correctly, understanding what is being asked, and drafting a complete reply.',
    desc: 'Export of readymade garments to the USA. Customs raises a classification query that the student must resolve.',
    forceQuery: true, forceExam: false, forceDiscrepancy: false,
    prefill: {
      party: { exporterName: 'Rahul Mehta', iec: '0301045678', gstin: '27AAACR5055K1Z8', pan: 'AAACR5055K', address: 'Plot 14, MIDC Industrial Area, Pune, Maharashtra', contact: '+91 98220 11223', authorizedPerson: 'Rahul Mehta' },
      counterparty: { consigneeName: 'Liberty Apparel Inc.', address: '481 7th Avenue, New York, NY', country: 'United States of America', port: 'USNYC - New York, USA', contact: '+1 212 555 0148' },
      shipment: { portOfLoading: 'INNSA1 - Nhava Sheva (JNPT), Mumbai', portOfDischarge: 'USNYC - New York, USA', countryOfDestination: 'United States of America', modeOfTransport: 'Sea', vesselFlight: 'MSC ANNA', voyageFlight: 'V.115W', shipmentRef: 'SHP-EXP-1002' },
      invoice: { invoiceNo: 'INV-EXP-8802', invoiceDate: '', currency: 'USD', invoiceValue: 28000, fobValue: 28000, freight: 1600, insurance: 250, incoterm: 'FOB', paymentTerms: 'Letter of Credit' },
      items: [{ description: "Men's cotton trousers, assorted sizes", hsCode: '62034200', qty: 4000, unit: 'PCS', unitPrice: 7, origin: 'India', packages: 200, grossWeight: 2100, netWeight: 2000 }]
    }
  },
  {
    id: 'S3', type: 'export', title: 'Scenario 3 — Export with Examination',
    difficulty: 'Intermediate', learningPoint: 'Understand what customs examination checks for and how to respond to an examination finding.',
    desc: 'Export of cotton fabric to Germany. Cargo is selected for physical examination before Let Export Order.',
    forceQuery: false, forceExam: true, forceDiscrepancy: false,
    prefill: {
      party: { exporterName: 'Rahul Mehta', iec: '0301045678', gstin: '27AAACR5055K1Z8', pan: 'AAACR5055K', address: 'Plot 14, MIDC Industrial Area, Pune, Maharashtra', contact: '+91 98220 11223', authorizedPerson: 'Rahul Mehta' },
      counterparty: { consigneeName: 'Wagner Textilhandel GmbH', address: 'Industriestrasse 8, Hamburg', country: 'Germany', port: 'DEHAM - Hamburg, Germany', contact: '+49 40 5551 2200' },
      shipment: { portOfLoading: 'INMUN1 - Mundra Port, Gujarat', portOfDischarge: 'DEHAM - Hamburg, Germany', countryOfDestination: 'Germany', modeOfTransport: 'Sea', vesselFlight: 'CMA CGM RHONE', voyageFlight: 'V.077N', shipmentRef: 'SHP-EXP-1003' },
      invoice: { invoiceNo: 'INV-EXP-8803', invoiceDate: '', currency: 'EUR', invoiceValue: 19500, fobValue: 19500, freight: 900, insurance: 180, incoterm: 'FOB', paymentTerms: 'Advance Payment' },
      items: [{ description: 'Cotton woven fabric, unbleached, roll packed', hsCode: '52081100', qty: 12000, unit: 'MTR', unitPrice: 1.625, origin: 'India', packages: 60, grossWeight: 8400, netWeight: 8100 }]
    }
  },
  {
    id: 'S4', type: 'import', title: 'Scenario 4 — Import with Duty Payment',
    difficulty: 'Beginner', learningPoint: 'Learn the import assessment → duty calculation → payment → Out of Charge sequence.',
    desc: 'Import of laptops from Singapore. Standard assessment followed by duty payment and Out of Charge.',
    forceQuery: false, forceExam: false, forceDiscrepancy: false,
    prefill: {
      party: { importerName: 'Sunita Rao', iec: '0301099821', gstin: '27AAACS8871L1Z2', pan: 'AAACS8871L', address: 'Tower B, DLF Cyber City, Gurugram, Haryana', contact: '+91 98110 44556', authorizedPerson: 'Sunita Rao' },
      counterparty: { supplierName: 'Pacific Computing Pte Ltd', address: '10 Anson Road, Singapore', country: 'Singapore', contact: '+65 6221 5500' },
      shipment: { portOfLoading: 'SGSIN - Singapore', portOfDischarge: 'INBOM4 - Mumbai Air Cargo', countryOfOrigin: 'Singapore', modeOfTransport: 'Air', vesselFlight: 'SQ 424', voyageFlight: 'AWB-6183920', blAwbNo: '618-39201847' },
      invoice: { invoiceNo: 'INV-IMP-5501', invoiceDate: '', currency: 'USD', invoiceValue: 60000, fobValue: 59200, freight: 650, insurance: 150, incoterm: 'CIF', paymentTerms: 'Advance Payment' },
      items: [{ description: 'Laptop computers, 14-inch, assorted configuration', hsCode: '84713010', qty: 120, unit: 'PCS', unitPrice: 500, origin: 'Singapore', packages: 12, grossWeight: 620, netWeight: 580 }]
    }
  },
  {
    id: 'S5', type: 'import', title: 'Scenario 5 — Import with Documentation Discrepancy',
    difficulty: 'Advanced', learningPoint: 'Handle a real discrepancy found on examination and decide the correct corrective path (amend vs explain).',
    desc: 'Import of mobile phones from China. Physical examination reveals a discrepancy requiring corrective action.',
    forceQuery: false, forceExam: true, forceDiscrepancy: true,
    prefill: {
      party: { importerName: 'Sunita Rao', iec: '0301099821', gstin: '27AAACS8871L1Z2', pan: 'AAACS8871L', address: 'Tower B, DLF Cyber City, Gurugram, Haryana', contact: '+91 98110 44556', authorizedPerson: 'Sunita Rao' },
      counterparty: { supplierName: 'Shenzhen Xinwei Electronics Co.', address: 'Bao\'an District, Shenzhen', country: 'China', contact: '+86 755 8822 1190' },
      shipment: { portOfLoading: 'CNSHA - Shanghai, China', portOfDischarge: 'INNSA1 - Nhava Sheva (JNPT), Mumbai', countryOfOrigin: 'China', modeOfTransport: 'Sea', vesselFlight: 'OOCL SHENZHEN', voyageFlight: 'V.552E', blAwbNo: 'OOLU2245981' },
      invoice: { invoiceNo: 'INV-IMP-5502', invoiceDate: '', currency: 'USD', invoiceValue: 85000, fobValue: 83600, freight: 1200, insurance: 200, incoterm: 'CIF', paymentTerms: 'Letter of Credit' },
      items: [{ description: 'Smartphones, dual-SIM, assorted models', hsCode: '85171200', qty: 2000, unit: 'PCS', unitPrice: 42.5, origin: 'China', packages: 40, grossWeight: 980, netWeight: 900 }]
    }
  },
  {
    id: 'S6', type: 'export', title: 'Scenario 6 — Amendment Case',
    difficulty: 'Advanced', learningPoint: 'Practice filing a clean, well-justified amendment with correct old value / new value / reason / supporting document.',
    desc: 'A previously submitted Shipping Bill needs an amendment to correct the declared invoice value before it can proceed.',
    forceQuery: false, forceExam: false, forceDiscrepancy: false, needsAmendment: true,
    prefill: {
      party: { exporterName: 'Rahul Mehta', iec: '0301045678', gstin: '27AAACR5055K1Z8', pan: 'AAACR5055K', address: 'Plot 14, MIDC Industrial Area, Pune, Maharashtra', contact: '+91 98220 11223', authorizedPerson: 'Rahul Mehta' },
      counterparty: { consigneeName: 'Emerald Gems FZE', address: 'Gold Souk Extension, Dubai', country: 'United Arab Emirates', port: 'AEDXB - Dubai, UAE', contact: '+971 4 226 7788' },
      shipment: { portOfLoading: 'INBOM4 - Mumbai Air Cargo', portOfDischarge: 'AEDXB - Dubai, UAE', countryOfDestination: 'United Arab Emirates', modeOfTransport: 'Air', vesselFlight: 'AI 915', voyageFlight: 'AWB-0980112234', shipmentRef: 'SHP-EXP-1006' },
      invoice: { invoiceNo: 'INV-EXP-8806', invoiceDate: '', currency: 'USD', invoiceValue: 15000, fobValue: 15000, freight: 300, insurance: 90, incoterm: 'FOB', paymentTerms: 'Advance Payment' },
      items: [{ description: 'Gold jewellery, assorted designs, 22 carat', hsCode: '71131900', qty: 40, unit: 'SET', unitPrice: 375, origin: 'India', packages: 4, grossWeight: 18, netWeight: 15 }]
    }
  },
  {
    id: 'S7', type: 'export', title: 'Scenario 7 — Document Verification Drill',
    difficulty: 'Beginner', learningPoint: 'Before filing, always cross-check the Invoice, Packing List and Certificate of Origin against each other for consistency.',
    desc: 'Client has sent a full document set for a fabric export to the Netherlands. Verify invoice, packing list and certificate of origin before you begin the filing.',
    forceQuery: false, forceExam: false, forceDiscrepancy: false,
    prefill: {
      party: { exporterName: 'Rahul Mehta', iec: '0301045678', gstin: '27AAACR5055K1Z8', pan: 'AAACR5055K', address: 'Plot 14, MIDC Industrial Area, Pune, Maharashtra', contact: '+91 98220 11223', authorizedPerson: 'Rahul Mehta' },
      counterparty: { consigneeName: 'Van Dijk Textiles B.V.', address: 'Havenstraat 12, Rotterdam', country: 'Netherlands', port: 'NLRTM - Rotterdam, Netherlands', contact: '+31 10 445 8890' },
      shipment: { portOfLoading: 'INNSA1 - Nhava Sheva (JNPT), Mumbai', portOfDischarge: 'NLRTM - Rotterdam, Netherlands', countryOfDestination: 'Netherlands', modeOfTransport: 'Sea', vesselFlight: 'MAERSK SEVILLE', voyageFlight: 'V.309N', shipmentRef: 'SHP-EXP-1007' },
      invoice: { invoiceNo: 'INV-EXP-8807', invoiceDate: '', currency: 'EUR', invoiceValue: 22000, fobValue: 22000, freight: 750, insurance: 160, incoterm: 'FOB', paymentTerms: 'Advance Payment' },
      items: [{ description: 'Cotton woven fabric, dyed, roll packed', hsCode: '52081100', qty: 8800, unit: 'MTR', unitPrice: 2.5, origin: 'India', packages: 45, grossWeight: 6100, netWeight: 5900 }]
    }
  },
  {
    id: 'S8', type: 'import', title: 'Scenario 8 — Invoice Validation Check',
    difficulty: 'Beginner', learningPoint: 'Assessable value is built from invoice value plus freight and insurance under CIF — verify each component before entering it.',
    desc: 'Import of packaged tea from Sri Lanka-routed supplier network. Practice validating invoice value, freight and insurance breakup before assessment.',
    forceQuery: false, forceExam: false, forceDiscrepancy: false,
    prefill: {
      party: { importerName: 'Sunita Rao', iec: '0301099821', gstin: '27AAACS8871L1Z2', pan: 'AAACS8871L', address: 'Tower B, DLF Cyber City, Gurugram, Haryana', contact: '+91 98110 44556', authorizedPerson: 'Sunita Rao' },
      counterparty: { supplierName: 'Ceylon Estates Trading Co.', address: 'Galle Road, Colombo', country: 'Singapore', contact: '+65 6773 2210' },
      shipment: { portOfLoading: 'SGSIN - Singapore', portOfDischarge: 'INMAA1 - Chennai Sea Port', countryOfOrigin: 'Singapore', modeOfTransport: 'Sea', vesselFlight: 'APL DENVER', voyageFlight: 'V.220S', blAwbNo: 'APLU3345667' },
      invoice: { invoiceNo: 'INV-IMP-5508', invoiceDate: '', currency: 'USD', invoiceValue: 18000, fobValue: 17600, freight: 300, insurance: 100, incoterm: 'CIF', paymentTerms: 'Advance Payment' },
      items: [{ description: 'Black tea, packaged, retail cartons', hsCode: '09024010', qty: 6000, unit: 'CTN', unitPrice: 3, origin: 'Singapore', packages: 300, grossWeight: 4200, netWeight: 4000 }]
    }
  },
  {
    id: 'S9', type: 'import', title: 'Scenario 9 — Packing List Mismatch',
    difficulty: 'Beginner', learningPoint: 'The declared package count and weight must always reconcile with the Packing List — mismatches are a common rejection reason.',
    desc: 'Import of plastic articles from China. The packing list quantity does not initially match what the student is about to declare — catch it before submission.',
    forceQuery: false, forceExam: false, forceDiscrepancy: false,
    prefill: {
      party: { importerName: 'Sunita Rao', iec: '0301099821', gstin: '27AAACS8871L1Z2', pan: 'AAACS8871L', address: 'Tower B, DLF Cyber City, Gurugram, Haryana', contact: '+91 98110 44556', authorizedPerson: 'Sunita Rao' },
      counterparty: { supplierName: 'Yiwu Homeware Trading Co.', address: 'Futian Market, Yiwu', country: 'China', contact: '+86 579 8511 2200' },
      shipment: { portOfLoading: 'CNSHA - Shanghai, China', portOfDischarge: 'INNSA1 - Nhava Sheva (JNPT), Mumbai', countryOfOrigin: 'China', modeOfTransport: 'Sea', vesselFlight: 'COSCO ASIA', voyageFlight: 'V.441E', blAwbNo: 'COSU9987456' },
      invoice: { invoiceNo: 'INV-IMP-5509', invoiceDate: '', currency: 'USD', invoiceValue: 14000, fobValue: 13700, freight: 250, insurance: 80, incoterm: 'CIF', paymentTerms: 'Letter of Credit' },
      items: [{ description: 'Plastic household articles, assorted', hsCode: '39269099', qty: 8000, unit: 'PCS', unitPrice: 1.75, origin: 'China', packages: 160, grossWeight: 3600, netWeight: 3400 }]
    }
  },
  {
    id: 'S10', type: 'import', title: 'Scenario 10 — Customs Query on Import',
    difficulty: 'Intermediate', learningPoint: 'Import queries often relate to classification or PGA requirement — check whether a BIS/FSSAI NOC is needed before replying.',
    desc: 'Import of smartphones from China. A query is raised on BIS registration compliance for the declared HS code.',
    forceQuery: true, forceExam: false, forceDiscrepancy: false,
    prefill: {
      party: { importerName: 'Sunita Rao', iec: '0301099821', gstin: '27AAACS8871L1Z2', pan: 'AAACS8871L', address: 'Tower B, DLF Cyber City, Gurugram, Haryana', contact: '+91 98110 44556', authorizedPerson: 'Sunita Rao' },
      counterparty: { supplierName: 'Shenzhen Xinwei Electronics Co.', address: "Bao'an District, Shenzhen", country: 'China', contact: '+86 755 8822 1190' },
      shipment: { portOfLoading: 'CNSHA - Shanghai, China', portOfDischarge: 'INDEL4 - Delhi (IGI) Air Cargo', countryOfOrigin: 'China', modeOfTransport: 'Air', vesselFlight: 'AI 349', voyageFlight: 'AWB-7729004', blAwbNo: '772-90044567' },
      invoice: { invoiceNo: 'INV-IMP-5510', invoiceDate: '', currency: 'USD', invoiceValue: 45000, fobValue: 44000, freight: 700, insurance: 150, incoterm: 'CIF', paymentTerms: 'Letter of Credit' },
      items: [{ description: 'Smartphones, dual-SIM, assorted models', hsCode: '85171200', qty: 1000, unit: 'PCS', unitPrice: 45, origin: 'China', packages: 20, grossWeight: 500, netWeight: 460 }]
    }
  },
  {
    id: 'S11', type: 'export', title: 'Scenario 11 — HS Classification Issue',
    difficulty: 'Advanced', learningPoint: 'A wrongly classified HS code changes duty exposure and PGA requirement — always verify the tariff heading against the item description.',
    desc: 'Export of plastic articles to Australia where the declared HS code appears to be a borderline classification. Customs raises a classification objection.',
    forceQuery: true, forceExam: false, forceDiscrepancy: false,
    prefill: {
      party: { exporterName: 'Rahul Mehta', iec: '0301045678', gstin: '27AAACR5055K1Z8', pan: 'AAACR5055K', address: 'Plot 14, MIDC Industrial Area, Pune, Maharashtra', contact: '+91 98220 11223', authorizedPerson: 'Rahul Mehta' },
      counterparty: { consigneeName: 'Sydney Import Traders Pty Ltd', address: '18 Harbour St, Sydney', country: 'Australia', port: 'AEJEA - Jebel Ali, UAE', contact: '+61 2 9221 4477' },
      shipment: { portOfLoading: 'INMAA1 - Chennai Sea Port', portOfDischarge: 'AEJEA - Jebel Ali, UAE', countryOfDestination: 'Australia', modeOfTransport: 'Sea', vesselFlight: 'ANL WYONG', voyageFlight: 'V.061S', shipmentRef: 'SHP-EXP-1011' },
      invoice: { invoiceNo: 'INV-EXP-8811', invoiceDate: '', currency: 'USD', invoiceValue: 16000, fobValue: 16000, freight: 500, insurance: 120, incoterm: 'FOB', paymentTerms: 'Advance Payment' },
      items: [{ description: 'Articles of plastics, moulded components', hsCode: '39269099', qty: 20000, unit: 'PCS', unitPrice: 0.8, origin: 'India', packages: 100, grossWeight: 3200, netWeight: 3000 }]
    }
  },
  {
    id: 'S12', type: 'import', title: 'Scenario 12 — Invoice Value Mismatch',
    difficulty: 'Advanced', learningPoint: 'When the declared value looks under-invoiced against market reference, expect a valuation query — be ready with supporting commercial correspondence.',
    desc: 'Import of motor vehicle parts from Germany at a value customs considers low against reference data.',
    forceQuery: true, forceExam: false, forceDiscrepancy: false,
    prefill: {
      party: { importerName: 'Sunita Rao', iec: '0301099821', gstin: '27AAACS8871L1Z2', pan: 'AAACS8871L', address: 'Tower B, DLF Cyber City, Gurugram, Haryana', contact: '+91 98110 44556', authorizedPerson: 'Sunita Rao' },
      counterparty: { supplierName: 'Bergmann Autoteile GmbH', address: 'Industriepark 4, Stuttgart', country: 'Germany', contact: '+49 711 5544 9910' },
      shipment: { portOfLoading: 'DEHAM - Hamburg, Germany', portOfDischarge: 'INMUN1 - Mundra Port, Gujarat', countryOfOrigin: 'Germany', modeOfTransport: 'Sea', vesselFlight: 'HAPAG BERLIN', voyageFlight: 'V.188N', blAwbNo: 'HLCU5567823' },
      invoice: { invoiceNo: 'INV-IMP-5512', invoiceDate: '', currency: 'EUR', invoiceValue: 22000, fobValue: 21500, freight: 600, insurance: 140, incoterm: 'CIF', paymentTerms: 'Letter of Credit' },
      items: [{ description: 'Motor vehicle parts, brake assemblies', hsCode: '87089900', qty: 3000, unit: 'PCS', unitPrice: 7.3, origin: 'Germany', packages: 60, grossWeight: 5400, netWeight: 5100 }]
    }
  },
  {
    id: 'S13', type: 'export', title: 'Scenario 13 — Weight Discrepancy on Examination',
    difficulty: 'Advanced', learningPoint: 'Gross/net weight mismatches found on examination usually need a corrective declaration — learn to explain vs. amend correctly.',
    desc: 'Export of T-shirts to the UK. Examination finds the actual weighed cargo differs from the declared gross weight.',
    forceQuery: false, forceExam: true, forceDiscrepancy: true,
    prefill: {
      party: { exporterName: 'Rahul Mehta', iec: '0301045678', gstin: '27AAACR5055K1Z8', pan: 'AAACR5055K', address: 'Plot 14, MIDC Industrial Area, Pune, Maharashtra', contact: '+91 98220 11223', authorizedPerson: 'Rahul Mehta' },
      counterparty: { consigneeName: 'Highstreet Fashion Ltd', address: '22 Baker Street, London', country: 'United Kingdom', port: 'GBFXT - Felixstowe, UK', contact: '+44 20 7946 0958' },
      shipment: { portOfLoading: 'INNSA1 - Nhava Sheva (JNPT), Mumbai', portOfDischarge: 'GBFXT - Felixstowe, UK', countryOfDestination: 'United Kingdom', modeOfTransport: 'Sea', vesselFlight: 'MSC LONDON', voyageFlight: 'V.204W', shipmentRef: 'SHP-EXP-1013' },
      invoice: { invoiceNo: 'INV-EXP-8813', invoiceDate: '', currency: 'GBP', invoiceValue: 12500, fobValue: 12500, freight: 450, insurance: 95, incoterm: 'FOB', paymentTerms: 'Letter of Credit' },
      items: [{ description: 'T-shirts, cotton, knitted, assorted sizes', hsCode: '61091000', qty: 15000, unit: 'PCS', unitPrice: 0.83, origin: 'India', packages: 150, grossWeight: 3300, netWeight: 3150 }]
    }
  },
  {
    id: 'S14', type: 'import', title: 'Scenario 14 — Quantity Discrepancy',
    difficulty: 'Advanced', learningPoint: 'A short-landed or over-landed quantity against the Bill of Lading needs to be reconciled with the carrier before OOC can be granted.',
    desc: 'Import of laptops from Singapore. The examined quantity does not match the declared quantity on the Bill of Entry.',
    forceQuery: false, forceExam: true, forceDiscrepancy: true,
    prefill: {
      party: { importerName: 'Sunita Rao', iec: '0301099821', gstin: '27AAACS8871L1Z2', pan: 'AAACS8871L', address: 'Tower B, DLF Cyber City, Gurugram, Haryana', contact: '+91 98110 44556', authorizedPerson: 'Sunita Rao' },
      counterparty: { supplierName: 'Pacific Computing Pte Ltd', address: '10 Anson Road, Singapore', country: 'Singapore', contact: '+65 6221 5500' },
      shipment: { portOfLoading: 'SGSIN - Singapore', portOfDischarge: 'INBOM4 - Mumbai Air Cargo', countryOfOrigin: 'Singapore', modeOfTransport: 'Air', vesselFlight: 'SQ 402', voyageFlight: 'AWB-6183921', blAwbNo: '618-39201855' },
      invoice: { invoiceNo: 'INV-IMP-5514', invoiceDate: '', currency: 'USD', invoiceValue: 50000, fobValue: 49300, freight: 600, insurance: 130, incoterm: 'CIF', paymentTerms: 'Advance Payment' },
      items: [{ description: 'Laptop computers, 14-inch, assorted configuration', hsCode: '84713010', qty: 100, unit: 'PCS', unitPrice: 500, origin: 'Singapore', packages: 10, grossWeight: 520, netWeight: 490 }]
    }
  },
  {
    id: 'S15', type: 'export', title: 'Scenario 15 — Container / Seal Mismatch',
    difficulty: 'Advanced', learningPoint: 'Container and seal numbers on the Shipping Bill must exactly match the carrier equipment interchange receipt — a mismatch triggers examination.',
    desc: 'Export of cotton fabric via Mundra. The container/seal number on the filing does not match the number physically found on the container.',
    forceQuery: false, forceExam: true, forceDiscrepancy: true,
    prefill: {
      party: { exporterName: 'Rahul Mehta', iec: '0301045678', gstin: '27AAACR5055K1Z8', pan: 'AAACR5055K', address: 'Plot 14, MIDC Industrial Area, Pune, Maharashtra', contact: '+91 98220 11223', authorizedPerson: 'Rahul Mehta' },
      counterparty: { consigneeName: 'Nordic Fabrics AS', address: 'Havnegata 3, Oslo', country: 'Germany', port: 'DEHAM - Hamburg, Germany', contact: '+49 40 2200 5510' },
      shipment: { portOfLoading: 'INMUN1 - Mundra Port, Gujarat', portOfDischarge: 'DEHAM - Hamburg, Germany', countryOfDestination: 'Germany', modeOfTransport: 'Sea', vesselFlight: 'CMA CGM SEINE', voyageFlight: 'V.099N', shipmentRef: 'SHP-EXP-1015' },
      invoice: { invoiceNo: 'INV-EXP-8815', invoiceDate: '', currency: 'EUR', invoiceValue: 17500, fobValue: 17500, freight: 820, insurance: 150, incoterm: 'FOB', paymentTerms: 'Advance Payment' },
      items: [{ description: 'Cotton woven fabric, unbleached, roll packed', hsCode: '52081100', qty: 11000, unit: 'MTR', unitPrice: 1.6, origin: 'India', packages: 55, grossWeight: 7700, netWeight: 7400 }]
    }
  },
  {
    id: 'S16', type: 'import', title: 'Scenario 16 — Missing Supporting Document',
    difficulty: 'Intermediate', learningPoint: 'Missing documents (e.g. Certificate of Origin for an FTA claim) are one of the most common query causes — check the document checklist first.',
    desc: 'Import of goods claimed under India–UAE CEPA preferential rate, but the Certificate of Origin was not uploaded with the filing.',
    forceQuery: true, forceExam: false, forceDiscrepancy: false,
    prefill: {
      party: { importerName: 'Sunita Rao', iec: '0301099821', gstin: '27AAACS8871L1Z2', pan: 'AAACS8871L', address: 'Tower B, DLF Cyber City, Gurugram, Haryana', contact: '+91 98110 44556', authorizedPerson: 'Sunita Rao' },
      counterparty: { supplierName: 'Al Noor Trading LLC', address: 'Warehouse 22, Jebel Ali Free Zone, Dubai', country: 'United Arab Emirates', contact: '+971 4 881 2200' },
      shipment: { portOfLoading: 'AEJEA - Jebel Ali, UAE', portOfDischarge: 'INNSA1 - Nhava Sheva (JNPT), Mumbai', countryOfOrigin: 'United Arab Emirates', modeOfTransport: 'Sea', vesselFlight: 'MV KOTA LESTARI', voyageFlight: 'V.224W', blAwbNo: 'MVKL2245981' },
      invoice: { invoiceNo: 'INV-IMP-5516', invoiceDate: '', currency: 'USD', invoiceValue: 26000, fobValue: 25500, freight: 400, insurance: 110, incoterm: 'CIF', paymentTerms: 'Advance Payment' },
      items: [{ description: 'Pharmaceutical products, other medicaments', hsCode: '30049099', qty: 400, unit: 'CTN', unitPrice: 65, origin: 'United Arab Emirates', packages: 400, grossWeight: 4100, netWeight: 3950 }]
    }
  },
  {
    id: 'S17', type: 'export', title: 'Scenario 17 — Rejected Filing / Re-filing',
    difficulty: 'Advanced', learningPoint: 'A rejected filing must be corrected and re-submitted as a fresh filing — never try to reuse a rejected acknowledgement number.',
    desc: 'Export of jewellery to Dubai where a first filing attempt is rejected on a document error and the student must correct and re-file.',
    forceQuery: true, forceExam: false, forceDiscrepancy: false,
    prefill: {
      party: { exporterName: 'Rahul Mehta', iec: '0301045678', gstin: '27AAACR5055K1Z8', pan: 'AAACR5055K', address: 'Plot 14, MIDC Industrial Area, Pune, Maharashtra', contact: '+91 98220 11223', authorizedPerson: 'Rahul Mehta' },
      counterparty: { consigneeName: 'Emerald Gems FZE', address: 'Gold Souk Extension, Dubai', country: 'United Arab Emirates', port: 'AEDXB - Dubai, UAE', contact: '+971 4 226 7788' },
      shipment: { portOfLoading: 'INBOM4 - Mumbai Air Cargo', portOfDischarge: 'AEDXB - Dubai, UAE', countryOfDestination: 'United Arab Emirates', modeOfTransport: 'Air', vesselFlight: 'AI 915', voyageFlight: 'AWB-0980112255', shipmentRef: 'SHP-EXP-1017' },
      invoice: { invoiceNo: 'INV-EXP-8817', invoiceDate: '', currency: 'USD', invoiceValue: 21000, fobValue: 21000, freight: 350, insurance: 110, incoterm: 'FOB', paymentTerms: 'Advance Payment' },
      items: [{ description: 'Gold jewellery, assorted designs, 22 carat', hsCode: '71131900', qty: 55, unit: 'SET', unitPrice: 382, origin: 'India', packages: 6, grossWeight: 24, netWeight: 20 }]
    }
  },
  {
    id: 'S18', type: 'import', title: 'Scenario 18 — Duty Payment Failure & Retry',
    difficulty: 'Intermediate', learningPoint: 'A failed payment attempt does not cancel the assessment — retry the payment using a valid method rather than re-filing.',
    desc: 'Import of tea consignment where the first simulated duty payment attempt fails and must be retried.',
    forceQuery: false, forceExam: false, forceDiscrepancy: false,
    prefill: {
      party: { importerName: 'Sunita Rao', iec: '0301099821', gstin: '27AAACS8871L1Z2', pan: 'AAACS8871L', address: 'Tower B, DLF Cyber City, Gurugram, Haryana', contact: '+91 98110 44556', authorizedPerson: 'Sunita Rao' },
      counterparty: { supplierName: 'Ceylon Estates Trading Co.', address: 'Galle Road, Colombo', country: 'Singapore', contact: '+65 6773 2210' },
      shipment: { portOfLoading: 'SGSIN - Singapore', portOfDischarge: 'INCOK1 - Cochin Sea Port', countryOfOrigin: 'Singapore', modeOfTransport: 'Sea', vesselFlight: 'APL PHOENIX', voyageFlight: 'V.301S', blAwbNo: 'APLU4456778' },
      invoice: { invoiceNo: 'INV-IMP-5518', invoiceDate: '', currency: 'USD', invoiceValue: 15000, fobValue: 14700, freight: 250, insurance: 90, incoterm: 'CIF', paymentTerms: 'Advance Payment' },
      items: [{ description: 'Black tea, packaged, retail cartons', hsCode: '09024010', qty: 5000, unit: 'CTN', unitPrice: 3, origin: 'Singapore', packages: 250, grossWeight: 3500, netWeight: 3350 }]
    }
  },
  {
    id: 'S19', type: 'export', title: 'Scenario 19 — Complete Export Job Simulation',
    difficulty: 'Professional', learningPoint: 'A realistic full-cycle export job combining document check, filing, query, examination and amendment — the complete real-world sequence.',
    desc: 'Full professional-grade export job: client documents arrive with a minor error, filing is queried, cargo is examined, and a small amendment is required before Let Export Order.',
    forceQuery: true, forceExam: true, forceDiscrepancy: false,
    prefill: {
      party: { exporterName: 'Rahul Mehta', iec: '0301045678', gstin: '27AAACR5055K1Z8', pan: 'AAACR5055K', address: 'Plot 14, MIDC Industrial Area, Pune, Maharashtra', contact: '+91 98220 11223', authorizedPerson: 'Rahul Mehta' },
      counterparty: { consigneeName: 'Liberty Apparel Inc.', address: '481 7th Avenue, New York, NY', country: 'United States of America', port: 'USNYC - New York, USA', contact: '+1 212 555 0148' },
      shipment: { portOfLoading: 'INNSA1 - Nhava Sheva (JNPT), Mumbai', portOfDischarge: 'USNYC - New York, USA', countryOfDestination: 'United States of America', modeOfTransport: 'Sea', vesselFlight: 'MSC ANNA', voyageFlight: 'V.119W', shipmentRef: 'SHP-EXP-1019' },
      invoice: { invoiceNo: 'INV-EXP-8819', invoiceDate: '', currency: 'USD', invoiceValue: 31000, fobValue: 31000, freight: 1700, insurance: 280, incoterm: 'FOB', paymentTerms: 'Letter of Credit' },
      items: [{ description: "Men's cotton trousers, assorted sizes", hsCode: '62034200', qty: 4400, unit: 'PCS', unitPrice: 7.05, origin: 'India', packages: 220, grossWeight: 2300, netWeight: 2200 }]
    }
  },
  {
    id: 'S20', type: 'import', title: 'Scenario 20 — Complete Import Job Simulation',
    difficulty: 'Professional', learningPoint: 'A realistic full-cycle import job combining assessment, a PGA/BIS query, examination and duty payment — the complete real-world sequence.',
    desc: 'Full professional-grade import job: smartphone consignment requires BIS query resolution, is selected for examination, then proceeds through duty payment to Out of Charge.',
    forceQuery: true, forceExam: true, forceDiscrepancy: false,
    prefill: {
      party: { importerName: 'Sunita Rao', iec: '0301099821', gstin: '27AAACS8871L1Z2', pan: 'AAACS8871L', address: 'Tower B, DLF Cyber City, Gurugram, Haryana', contact: '+91 98110 44556', authorizedPerson: 'Sunita Rao' },
      counterparty: { supplierName: 'Shenzhen Xinwei Electronics Co.', address: "Bao'an District, Shenzhen", country: 'China', contact: '+86 755 8822 1190' },
      shipment: { portOfLoading: 'CNSHA - Shanghai, China', portOfDischarge: 'INNSA1 - Nhava Sheva (JNPT), Mumbai', countryOfOrigin: 'China', modeOfTransport: 'Sea', vesselFlight: 'OOCL SHENZHEN', voyageFlight: 'V.560E', blAwbNo: 'OOLU2246002' },
      invoice: { invoiceNo: 'INV-IMP-5520', invoiceDate: '', currency: 'USD', invoiceValue: 92000, fobValue: 90500, freight: 1300, insurance: 220, incoterm: 'CIF', paymentTerms: 'Letter of Credit' },
      items: [{ description: 'Smartphones, dual-SIM, assorted models', hsCode: '85171200', qty: 2200, unit: 'PCS', unitPrice: 41.8, origin: 'China', packages: 44, grossWeight: 1060, netWeight: 970 }]
    }
  }
];

function newId(prefix) {
  return uniqueId(prefix, () => {
    const n = Math.floor(100000 + Math.random() * 900000);
    const y = new Date().getFullYear();
    return `${prefix}-${y}-${n}`;
  });
}

/* ============================================================
   CONSIGNIA DESK — Export Documentation Desk
   New constants only. Nothing above this line was touched.
   ============================================================ */

/* Document registry. category groups drive the Document Planner's sectioning;
   'core' documents show REQUIRED unless a rule below says otherwise. */
const EXPORT_DOC_CATALOG = {
  SHIPPING_BILL: { label: 'Shipping Bill (ICEGATE e-filing)', category: 'CUSTOMS' },
  COMMERCIAL_INVOICE: { label: 'Commercial Invoice', category: 'CORE' },
  PACKING_LIST: { label: 'Packing List', category: 'CORE' },
  BILL_OF_LADING: { label: 'Bill of Lading', category: 'TRANSPORT', modes: ['Sea'] },
  AIR_WAYBILL: { label: 'Air Waybill', category: 'TRANSPORT', modes: ['Air'] },
  CERTIFICATE_OF_ORIGIN: { label: 'Certificate of Origin', category: 'ORIGIN' },
  INSURANCE_CERTIFICATE: { label: 'Insurance Certificate', category: 'FINANCIAL' },
  LETTER_OF_CREDIT: { label: 'Letter of Credit', category: 'FINANCIAL' },
  BILL_OF_EXCHANGE: { label: 'Bill of Exchange', category: 'FINANCIAL' },
  EXPORT_LICENSE: { label: 'Export License / SCOMET Authorization', category: 'REGULATORY' },
  PHYTOSANITARY_CERTIFICATE: { label: 'Phytosanitary Certificate', category: 'COMMODITY' },
  HEALTH_CERTIFICATE: { label: 'Health Certificate', category: 'COMMODITY' },
  FUMIGATION_CERTIFICATE: { label: 'Fumigation Certificate', category: 'COMMODITY' },
  CATCH_CERTIFICATE: { label: 'Catch Certificate', category: 'COMMODITY' },
  HACCP_CERTIFICATE: { label: 'HACCP / Food Safety Certificate', category: 'COMMODITY' },
  DG_DECLARATION: { label: 'Dangerous Goods Declaration', category: 'COMMODITY' }
};

/* Document Planner rules (Export Documentation Simulator spec, section 20).
   Each rule inspects the Export Job's brief and returns an applicability +
   a human-readable reason — never a bare "required", always WHY. */
const DOCUMENT_PLANNER_RULES = [
  { doc: 'SHIPPING_BILL', test: () => ({ status: 'REQUIRED', reason: 'Mandatory customs declaration for every export - filed on ICEGATE; Let Export Order and EGM follow. Prepared from this job\'s consignee, products, containers and consignment details.' }) },
  { doc: 'COMMERCIAL_INVOICE', test: () => ({ status: 'REQUIRED', reason: 'Mandatory for every export shipment — establishes the transaction value and terms.' }) },
  { doc: 'PACKING_LIST', test: () => ({ status: 'REQUIRED', reason: 'Mandatory for every export shipment — itemizes physical packages against the invoice.' }) },
  { doc: 'BILL_OF_LADING', test: (brief) => brief.mode === 'Sea'
      ? { status: 'REQUIRED', reason: 'Sea mode selected — the Bill of Lading is the carrier\'s transport document and title to the goods.' }
      : { status: 'NOT_APPLICABLE', reason: 'Shipment mode is not Sea.' } },
  { doc: 'AIR_WAYBILL', test: (brief) => brief.mode === 'Air'
      ? { status: 'REQUIRED', reason: 'Air mode selected — the Air Waybill is the carrier\'s transport document for air cargo.' }
      : { status: 'NOT_APPLICABLE', reason: 'Shipment mode is not Air.' } },
  { doc: 'CERTIFICATE_OF_ORIGIN', test: (brief) => brief.ftaClaim
      ? { status: 'REQUIRED', reason: 'Buyer/contract calls for preferential tariff treatment under a trade agreement — origin evidence is required to support the claim.' }
      : { status: 'CONDITIONAL', reason: 'Not required for tariff preference on this shipment, but many buyers/banks still request non-preferential origin evidence — confirm against the buyer\'s instructions or LC.' } },
  { doc: 'INSURANCE_CERTIFICATE', test: (brief) => (brief.incoterm === 'CIF' || brief.incoterm === 'CIP')
      ? { status: 'REQUIRED', reason: `Incoterm ${brief.incoterm || ''} places insurance obligation on the exporter.` }
      : { status: 'CONDITIONAL', reason: 'Under the selected Incoterm the buyer typically arranges insurance — confirm whether the exporter is still asked to provide a certificate (common under LC terms).' } },
  { doc: 'LETTER_OF_CREDIT', test: (brief) => brief.paymentMethod === 'Letter of Credit'
      ? { status: 'REQUIRED', reason: 'Payment method is Letter of Credit — the LC and its document-compliance check govern what must be presented to the bank.' }
      : { status: 'NOT_APPLICABLE', reason: 'Payment method is not Letter of Credit.' } },
  { doc: 'BILL_OF_EXCHANGE', test: (brief) => (brief.paymentMethod === 'Letter of Credit' || brief.paymentMethod === 'Documentary Collection')
      ? { status: 'REQUIRED', reason: `Payment method is ${brief.paymentMethod} — a Bill of Exchange (draft) is drawn for bank presentation.` }
      : { status: 'NOT_APPLICABLE', reason: 'Payment method does not require a bank-presented draft.' } },
  { doc: 'EXPORT_LICENSE', test: (brief) => brief.scomet
      ? { status: 'REQUIRED', reason: 'Item flagged as SCOMET / export-controlled — an authorization is required before shipment.' }
      : { status: 'NOT_APPLICABLE', reason: 'No export-control flag on this shipment.' } },
  { doc: 'PHYTOSANITARY_CERTIFICATE', test: (brief) => brief.commodityCategory === 'Agriculture'
      ? { status: 'REQUIRED', reason: 'Agricultural commodity — destination customs/plant-quarantine authorities typically require phytosanitary certification.' }
      : { status: 'NOT_APPLICABLE', reason: 'Not an agricultural commodity.' } },
  { doc: 'HEALTH_CERTIFICATE', test: (brief) => brief.commodityCategory === 'Food' || brief.commodityCategory === 'Seafood'
      ? { status: 'REQUIRED', reason: 'Food/seafood commodity — a health certificate is typically required by the importing country.' }
      : { status: 'NOT_APPLICABLE', reason: 'Not a food/seafood commodity.' } },
  { doc: 'CATCH_CERTIFICATE', test: (brief) => brief.commodityCategory === 'Seafood'
      ? { status: 'REQUIRED', reason: 'Seafood commodity — many destinations (notably the EU) require catch certification confirming legal, unreported and unregulated (IUU) compliance.' }
      : { status: 'NOT_APPLICABLE', reason: 'Not a seafood commodity.' } },
  { doc: 'HACCP_CERTIFICATE', test: (brief) => (brief.commodityCategory === 'Food' || brief.commodityCategory === 'Seafood')
      ? { status: 'CONDITIONAL', reason: 'Food/seafood commodity — many buyers and destination food-safety authorities request HACCP certification even where not strictly mandatory. Confirm against buyer instructions.' }
      : { status: 'NOT_APPLICABLE', reason: 'Not a food/seafood commodity.' } },
  { doc: 'FUMIGATION_CERTIFICATE', test: (brief) => brief.packagingMaterial === 'Wood'
      ? { status: 'REQUIRED', reason: 'Wooden packaging material declared — most destinations require ISPM-15 fumigation certification for wood packaging.' }
      : { status: 'NOT_APPLICABLE', reason: 'No wood packaging declared.' } },
  { doc: 'DG_DECLARATION', test: (brief) => brief.dangerousGoods
      ? { status: 'REQUIRED', reason: 'Cargo declared as dangerous goods — a DG Declaration is required for carrier acceptance and customs.' }
      : { status: 'NOT_APPLICABLE', reason: 'Cargo not declared as dangerous goods.' } }
];

function computeDocumentPlan(brief) {
  return DOCUMENT_PLANNER_RULES.map(rule => {
    const result = rule.test(brief || {});
    return { doc: rule.doc, label: EXPORT_DOC_CATALOG[rule.doc].label, category: EXPORT_DOC_CATALOG[rule.doc].category, status: result.status, reason: result.reason };
  });
}

const PAYMENT_METHODS = ['Advance Payment', 'Letter of Credit', 'Documentary Collection', 'Open Account'];
const COMMODITY_CATEGORIES = ['General Merchandise', 'Agriculture', 'Food', 'Seafood', 'Textiles/Garments', 'Electronics', 'Machinery', 'Chemicals', 'Pharmaceuticals'];
const PACKAGING_MATERIALS = ['Carton/Cardboard', 'Wood', 'Plastic', 'Metal Drum', 'Mixed'];
