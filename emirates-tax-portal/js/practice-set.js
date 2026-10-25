/* practice-set.js - shared Jul-Sep 2026 practice company documents used by registers.js and vat-ledger.js.
   Treatments verified against FTA VATP005 / VATP006 / VAT Returns User Guide (see tests/QA_REPORT.md Rounds 3-7). */
window.VATPS = (function () {
  const SALES = [
    { id: "S1", date: "2026-07-05", doc: "INV-0101", party: "Al Noor Trading LLC", trn: "100234567800003", desc: "Sale of goods to a local customer", net: 100000, ans: "std", why: "Local taxable supply of goods - standard rated 5%." },
    { id: "S2", date: "2026-07-19", doc: "INV-0102", party: "Marina Retail LLC", trn: "100345678900003", desc: "Consulting services in the UAE", net: 40000, ans: "std", why: "Services supplied in the UAE - standard rated 5%." },
    { id: "S3", date: "2026-08-02", doc: "INV-0103", party: "Riyadh Foods Co. (Saudi Arabia)", trn: "-", desc: "Export of goods shipped outside the UAE", net: 60000, ans: "zero", why: "Goods exported out of the UAE are zero rated (Box 4), not exempt." },
    { id: "S4", date: "2026-08-10", doc: "INV-0104", party: "Mr. Faisal (tenant)", trn: "-", desc: "Rent of a residential apartment", net: 24000, ans: "exempt", why: "Residential lease is an exempt supply (Box 5) - no VAT charged." },
    { id: "S5", date: "2026-09-04", doc: "CN-0001", party: "Al Noor Trading LLC", trn: "100234567800003", desc: "Tax credit note against INV-0101 (goods returned)", net: -10000, ans: "std", why: "A credit note reverses the original supply, so it is reported in Box 1 net of the credit note." },
  ];
  const PURCH = [
    { id: "P1", date: "2026-07-03", doc: "SUP-771", party: "Gulf Wholesale LLC", trn: "100456789100003", desc: "Stock-in-trade, full tax invoice", net: 50000, vat: 2500, ans: "rec", why: "Business purchase with a valid tax invoice - input VAT recoverable." },
    { id: "P2", date: "2026-07-08", doc: "SUP-772", party: "Bluewave Properties", trn: "100567891200003", desc: "Office rent (standard rated)", net: 12000, vat: 600, ans: "rec", why: "Standard-rated business expense - recoverable." },
    { id: "P3", date: "2026-07-21", doc: "SUP-773", party: "Creek Grill Restaurant", trn: "100678912300003", desc: "Dinner hosting existing customers", net: 4000, vat: 200, ans: "blk", why: "Entertainment to non-employees (customers) is blocked in full - Art. 53(1)(a), FTA VATP005." },
    { id: "P4", date: "2026-08-14", doc: "SUP-774", party: "Palm Banquet LLC", trn: "100789123400003", desc: "Ramadan Iftar organised for staff", net: 3000, vat: 150, ans: "blk", why: "Lunch/dinner for employees is entertainment - blocked (VATP005 gives the Ramadan Iftar example)." },
    { id: "P5", date: "2026-08-18", doc: "SUP-775", party: "FreshMart Supplies", trn: "100891234500003", desc: "Tea, coffee and dates for general office and meeting use", net: 1000, vat: 50, ans: "rec", why: "Sundry office refreshments for general use are recoverable - VATP005 'sundry office expenses'." },
    { id: "P6", date: "2026-08-25", doc: "SUP-776", party: "Sharjah Stay Hotel", trn: "100912345600003", desc: "Hotel for an employee on a domestic overnight business trip", net: 2000, vat: 100, ans: "rec", why: "Overnight accommodation on a domestic business trip is recoverable - VATP005 'employee expenses'." },
    { id: "P7", date: "2026-09-09", doc: "SUP-777", party: "Grand Events LLC", trn: "100123456700003", desc: "Gala dinner event for clients, no attendance fee", net: 8000, vat: 400, ans: "blk", why: "Gala dinner is an end in itself and no fee is charged - blocked (VATP005)." },
    { id: "P8", date: "2026-09-12", doc: "LON-5521", party: "Atlas Advisory Ltd (UK, no UAE presence)", trn: "-", desc: "Consulting services from an overseas supplier, no VAT charged", net: 20000, vat: 0, ans: "rc", why: "Imported service with the UAE recipient accounting: reverse charge - declare in Box 3 and recover in Box 10." },
    { id: "P9", date: "2026-09-15", doc: "SUP-778", party: "Prime Auto Leasing", trn: "100234500900003", desc: "Lease of a saloon car available for staff private use", net: 15000, vat: 750, ans: "blk", why: "Motor vehicle available for private use is blocked under Art. 53 (also listed as excluded from Box 9 in the FTA VAT Returns User Guide)." },
  ];
  return { SALES: SALES, PURCH: PURCH };
})();
