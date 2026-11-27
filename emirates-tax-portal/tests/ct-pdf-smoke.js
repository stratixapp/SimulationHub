/* Penalty lines in the acknowledgement and the receipt PDFs. jsdom has no PDF viewer, so jsPDF is replaced by a recorder and the text sent to it is checked.
   This proves the content, not the look of the PDF (real-browser untested). Run from emirates-tax-portal/ :  node tests/ct-pdf-smoke.js */
const fs = require("fs"); const { Browser } = require("./e2e-agent.js");
(async () => {
  const b = new Browser(() => {}); await b.goto("ct/index.html", 100); const w = b.w, ET = w.ET; let bad = 0;
  const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) bad++; };
  let rec = [];
  w.jspdf = { jsPDF: function () { const self = new Proxy({}, { get(t, k) { if (k === "internal") return { pageSize: { getWidth: () => 595, getHeight: () => 842 }, getNumberOfPages: () => 1 }; if (k === "text") return (...a) => { rec.push(String(Array.isArray(a[0]) ? a[0].join(" ") : a[0])); return self; }; if (k === "splitTextToSize") return (x) => [x]; if (k === "getTextWidth") return () => 50; if (k === "save") return (n) => { rec.push("SAVE:" + n); }; return () => self; } }); return self; } };
  w.eval(fs.readFileSync("ct/assets/js/ct-pdf.js", "utf8"));
  ET.Store.reset(); ET.SimDate.set("2026-10-21"); ET.Reg.set({ status: "Approved", ctTrn: "100111222333444", form: { relevantDate: "2025-01-10", fyMonth: 12, fyDay: 31, legalNameEn: "Test LLC" }, history: [] });
  ET.Store.update((s) => { s.filing.status = "Submitted"; s.filing.appNumber = "CTRN-2026-123456"; s.filing.submittedOn = "21 October 2026, 10:00 GST"; s.filing.netPosition = 25200; s.filing.lateFilingMonths = 1; s.filing.lateFilingPenalty = 500; s.filing.snapshot = { accountingIncome: 0, netPayable: 25200 }; });
  rec = []; const r1 = w.ET_CT_PDF.generate(); const t1 = rec.join(" | ");
  ok("acknowledgement PDF is generated without errors", r1 === true && /SAVE:/.test(t1) && b.errs.length === 0);
  ok("acknowledgement PDF lists the late filing penalty (1 month, AED 500)", /Late filing penalty \(1 month or part of a month\)/.test(t1) && /500/.test(t1));
  ok("acknowledgement PDF lists the late payment penalty (14% a year, 1 month = 294) and the total 25,994", /Late payment penalty \(14% a year, 1 month or part of a month\)/.test(t1) && /294/.test(t1) && /25,994/.test(t1));
  ET.Store.update((s) => { s.filing.payment = { status: "Paid", reference: "CTPAY-1", paidOn: "21 October 2026, 10:05 GST", method: "Card", instrument: "Visa 4242", gatewayTxn: "T1", authCode: "A1", amount: 25994, breakdown: { tax: 25200, lateFilingMonths: 1, lateFiling: 500, latePaymentMonths: 1, latePayment: 294, total: 25994 } }; });
  rec = []; const r2 = w.ET_CT_PDF.receipt(); const t2 = rec.join(" | ");
  ok("receipt PDF is generated and shows how the payment was allocated", r2 === true && /Allocation of this payment/i.test(t2) && /Identified to/.test(t2) && /Corporate Tax, period 10\/01\/2025/.test(t2));
  ok("receipt PDF lists tax 25,200, late filing 500, late payment 294 and total paid 25,994", /25,200/.test(t2) && /Late filing penalty \(1 month/.test(t2) && /294/.test(t2) && /Total paid/.test(t2) && /25,994/.test(t2));
  ok("after payment the acknowledgement keeps the frozen penalty breakdown (as paid)", (rec = [], w.ET_CT_PDF.generate(), /as paid/i.test(rec.join(" | "))));
  ET.SimDate.set(""); console.log(bad ? bad + " FAILED" : "CT PDF OK"); process.exit(bad ? 1 : 0);
})();
