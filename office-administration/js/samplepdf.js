/* =========================================================
   samplepdf.js — Sample documents for Personal Files
   Builds a real, single-page A4 PDF in the browser (no library,
   works offline) from the selected employee's own record, so every
   Personal File tab has something to download and re-upload.
   ========================================================= */
const _PDF_W = {"Helvetica": [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584], "Helvetica-Bold": [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584]};

function _pdfAscii(s) {
  return String(s == null ? '' : s)
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-').replace(/\u20B9/g, 'Rs.')
    .replace(/[^\x20-\x7E]/g, '?');
}
function _pdfEsc(s) { return _pdfAscii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function _pdfW(text, font, size) {
  const w = _PDF_W[font === 'Helvetica-Bold' ? 'Helvetica-Bold' : 'Helvetica'];
  let n = 0; for (const ch of _pdfAscii(text)) n += w[ch.charCodeAt(0) - 32];
  return n * size / 1000;
}
function _pdfWrap(text, font, size, maxW) {
  const words = _pdfAscii(text).split(/\s+/).filter(Boolean); const lines = []; let cur = '';
  words.forEach(wd => {
    const t = cur ? cur + ' ' + wd : wd;
    if (_pdfW(t, font, size) <= maxW || !cur) cur = t; else { lines.push(cur); cur = wd; }
  });
  if (cur) lines.push(cur);
  return lines;
}
const _PDF_COL = { navy: '0.106 0.165 0.290', gold: '0.722 0.569 0.184', grey: '0.42 0.45 0.50', ink: '0.13 0.19 0.31', light: '0.80 0.78 0.72', wm: '0.93 0.93 0.93' };

function _pdfDoc() {
  const W = 595.28, H = 841.89, ops = [];
  const F = { 'Helvetica': 'F1', 'Helvetica-Bold': 'F2', 'Helvetica-Oblique': 'F3' };
  const api = {
    W, H,
    text(x, y, s, font = 'Helvetica', size = 11, col = 'ink') {
      ops.push(`BT /${F[font]} ${size} Tf ${_PDF_COL[col]} rg ${x.toFixed(2)} ${(H - y).toFixed(2)} Td (${_pdfEsc(s)}) Tj ET`);
    },
    center(cx, y, s, font, size, col) { this.text(cx - _pdfW(s, font, size) / 2, y, s, font, size, col); },
    right(rx, y, s, font, size, col) { this.text(rx - _pdfW(s, font, size), y, s, font, size, col); },
    line(x1, y1, x2, y2, lw = 0.6, col = 'navy', dash = false) {
      ops.push(`q ${lw} w ${_PDF_COL[col]} RG ${dash ? '[3 3] 0 d' : ''} ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S Q`);
    },
    rect(x, y, w, h, lw = 0.8, col = 'navy', dash = false) {
      ops.push(`q ${lw} w ${_PDF_COL[col]} RG ${dash ? '[4 3] 0 d' : ''} ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S Q`);
    },
    para(x, y, s, maxW, font = 'Helvetica', size = 11, lead = 16, col = 'ink') {
      _pdfWrap(s, font, size, maxW).forEach((ln, i) => this.text(x, y + i * lead, ln, font, size, col));
      return y + _pdfWrap(s, font, size, maxW).length * lead;
    },
    watermark(s) {
      const c = Math.cos(0.55), n = Math.sin(0.55);
      [0, 1].forEach(i => ops.unshift(`BT /F2 26 Tf ${_PDF_COL.wm} rg ${c.toFixed(3)} ${n.toFixed(3)} ${(-n).toFixed(3)} ${c.toFixed(3)} ${(55 + i * 34).toFixed(1)} ${(H / 2 - 150 - i * 90).toFixed(1)} Tm (${_pdfEsc(s)}) Tj ET`));
    },
    build() {
      const content = ops.join('\n');
      const objs = [null,
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R >>`,
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>'];
      let out = '%PDF-1.4\n'; const offs = [];
      for (let i = 1; i < objs.length; i++) { offs[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
      const xref = out.length;
      out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
      out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      return new Blob([out], { type: 'application/pdf' });
    }
  };
  return api;
}

/* One document per Personal File tab, filled from the employee's own record */
const PF_DOC_LABEL = {
  'Educational Certificates': 'educational certificate', 'Experience Certificates': 'experience certificate',
  'Identity Proof': 'identity proof cover sheet', 'Address Proof': 'address proof declaration',
  'Bank Details': 'bank details form', 'Nomination': 'nomination form', 'Medical': 'medical self-declaration',
  'Performance': 'performance review summary', 'Promotion': 'promotion letter', 'Transfer': 'transfer order',
  'Disciplinary Records': 'show-cause notice'
};

function pfDocSpec(tab, emp) {
  const name = `${emp.firstName} ${emp.lastName}`.trim();
  const v = (x) => (x === undefined || x === null || String(x).trim() === '') ? '-' : String(x);
  const addr = [emp.address, emp.city, emp.district, emp.state, emp.pin].filter(Boolean).join(', ') || '-';
  const deptDesig = `${v(emp.department)} / ${v(emp.designation)}`;
  const nextMonth1 = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return fmtDate(d.toISOString().slice(0, 10)); })();
  const in15 = (() => { const d = new Date(); d.setDate(d.getDate() + 15); return fmtDate(d.toISOString().slice(0, 10)); })();
  const sal = Number(emp.salary) || 0;
  switch (tab) {
    case 'Educational Certificates': {
      const edu = (emp.education || '').trim();
      const parts = edu.split(',');
      const degree = (parts[0] || 'Bachelor\'s Degree').trim();
      const inst = (parts.slice(1).join(',') || 'Affiliated University').trim();
      return { issuer: inst, sub: '(Recognized by the University Grants Commission)', title: 'DEGREE CERTIFICATE',
        intro: `This is to certify that ${name}, having completed the course of study and passed the examinations prescribed by this institution, is hereby awarded the degree of`,
        big: degree.toUpperCase(), outro: 'having secured a place in the First Class. Given under the seal of the institution.',
        fields: [], sigs: ['Controller of Examinations', 'Registrar'], seal: true };
    }
    case 'Identity Proof':
      return { title: 'IDENTITY PROOF - SELF-ATTESTED COPY (COVER SHEET)',
        intro: 'The employee named below has submitted a self-attested photocopy of an identity document for the personal file maintained by the HR department.',
        fields: [['Employee name', name], ['Employee ID', emp.id], ['Date of birth', emp.dob ? fmtDate(emp.dob) : '-'], ['Department / Designation', deptDesig], ['Aadhaar No. (as per record)', v(emp.aadhaar)], ['PAN (as per record)', v(emp.pan)]],
        box: 'Self-attested photocopy of the identity document to be affixed here',
        outro: 'I certify that the attached copy is a true copy of the original document.', sigs: ['Employee signature & date', 'Received by HR (name / date)'] };
    case 'Address Proof':
      return { title: 'ADDRESS PROOF - SELF-DECLARATION OF RESIDENCE',
        intro: `I, ${name}, declare that my current residential address is as stated below, and that I will inform the HR department in writing of any change.`,
        fields: [['Employee name', name], ['Employee ID', emp.id], ['Residential address', addr], ['Contact phone', v(emp.phone)]],
        box: 'Supporting document (utility bill / rent agreement / bank statement) to be attached here',
        sigs: ['Employee signature & date', 'Received by HR (name / date)'] };
    case 'Bank Details':
      return { title: 'BANK ACCOUNT DETAILS FORM (SALARY CREDIT)',
        intro: 'Please credit my monthly salary to the bank account given below.',
        fields: [['Account holder name', name], ['Employee ID', emp.id], ['Bank name', v(emp.bankName)], ['Account number', v(emp.accountNumber)], ['IFSC code', v(emp.ifsc)], ['Account type', 'Savings']],
        box: 'Cancelled cheque / first page of the passbook to be attached here',
        sigs: ['Employee signature & date', 'Verified by Accounts (name / date)'] };
    case 'Nomination': {
      const nominee = emp.fatherName || emp.motherName || '-';
      const rel = emp.fatherName ? 'Father' : (emp.motherName ? 'Mother' : '-');
      return { title: 'NOMINATION FORM (PROVIDENT FUND / GRATUITY)',
        intro: `I, ${name}, nominate the person named below to receive any benefits payable under the Provident Fund and Gratuity rules in the event of my death.`,
        fields: [['Employee name', name], ['Employee ID', emp.id], ['Nominee name', nominee], ['Relationship', rel], ['Share of benefit', '100%'], ['Nominee address', addr]],
        sigs: ['Employee signature & date', 'Witness signature & date'] };
    }
    case 'Medical':
      return { title: 'MEDICAL SELF-DECLARATION FORM',
        intro: `I, ${name}, declare that, to the best of my knowledge, I am medically fit to perform the duties of my position, and that I will inform the HR department of any condition that may affect my work or the safety of others.`,
        fields: [['Employee name', name], ['Employee ID', emp.id], ['Department / Designation', deptDesig], ['Emergency contact', v(emp.emergencyContact)]],
        sigs: ['Employee signature & date', 'Received by HR (name / date)'] };
    case 'Performance':
      return { title: 'ANNUAL PERFORMANCE REVIEW - SUMMARY SHEET',
        intro: 'Summary of the most recent annual appraisal, filed in the personal file for reference.',
        fields: [['Employee name', name], ['Department / Designation', deptDesig], ['Review period', 'April - March (last financial year)'], ['Overall rating', 'Meets Expectations (3 / 5)'], ['Key strengths', 'Reliable, punctual, works well with the team'], ['Areas to develop', 'Advanced Excel and report writing']],
        sigs: ['Reporting Manager', 'HR Manager'] };
    case 'Promotion':
      return { title: 'PROMOTION LETTER',
        intro: `Dear ${emp.firstName}, we are pleased to inform you that, in recognition of your performance, you are promoted as detailed below.`,
        fields: [['Employee name', name], ['Current designation', v(emp.designation)], ['New designation', 'Senior ' + v(emp.designation)], ['Effective date', nextMonth1], ['Revised monthly salary', sal ? 'Rs. ' + (Math.round(sal * 1.1 / 100) * 100).toLocaleString('en-IN') : '-']],
        outro: 'All other terms and conditions of your employment remain unchanged. Congratulations.', sigs: ['Employee acknowledgement', 'HR Manager'] };
    case 'Transfer': {
      const cur = emp.department || 'Administration';
      const to = cur === 'Operations' ? 'Administration' : 'Operations';
      return { title: 'TRANSFER ORDER',
        intro: `Dear ${emp.firstName}, in the interest of the organisation you are transferred as detailed below.`,
        fields: [['Employee name', name], ['Employee ID', emp.id], ['Current department', cur], ['New department', to], ['Effective date', in15]],
        outro: 'Please hand over your current responsibilities and report to the new department head on the effective date.', sigs: ['Employee acknowledgement', 'HR Manager'] };
    }
    case 'Disciplinary Records':
      return { title: 'SHOW-CAUSE NOTICE (SAMPLE)',
        intro: `Dear ${emp.firstName}, it has been noticed that you were absent from duty without prior intimation. You are required to submit a written explanation within three working days of receiving this notice.`,
        fields: [['Employee name', name], ['Department / Designation', deptDesig], ['Nature of issue', 'Unauthorised absence'], ['Reply due within', '3 working days']],
        outro: 'Failure to reply may result in further action as per company policy.', sigs: ['Employee acknowledgement', 'HR Manager'] };
  }
  return null;
}

function buildSamplePdf(tab, emp) {
  const spec = pfDocSpec(tab, emp); if (!spec) return null;
  const meta = Store.load().meta || {};
  const d = _pdfDoc(), W = d.W, H = d.H, L = 56, R = W - 56, MW = R - L;
  d.watermark('SPECIMEN - FOR TRAINING USE ONLY');
  d.rect(22, 22, W - 44, H - 44, 2.2, 'gold'); d.rect(27, 27, W - 54, H - 54, 0.8, 'navy');
  d.center(W / 2, 78, spec.issuer || meta.institution || 'AS Group of Industries', 'Helvetica-Bold', 17, 'navy');
  d.center(W / 2, 94, spec.sub || [meta.companyAddress, 'Human Resources Department'].filter(Boolean).join(' | '), 'Helvetica', 8.5, 'grey');
  d.line(W / 2 - 90, 104, W / 2 + 90, 104, 1, 'gold');
  d.center(W / 2, 140, spec.title, 'Helvetica-Bold', 13.5, 'navy');
  d.text(L, 168, `Ref No.: SPEC/${tab.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()}/${String(emp.id).slice(-6)}`, 'Helvetica', 8.5, 'grey');
  d.right(R, 168, `Date: ${fmtDate(todayISO())}`, 'Helvetica', 8.5, 'grey');
  let y = 200;
  if (spec.intro) y = d.para(L, y, spec.intro, MW, 'Helvetica', 11, 16) + 6;
  if (spec.big) { d.center(W / 2, y + 14, spec.big, 'Helvetica-Bold', 15, 'navy'); y += 40; }
  spec.fields.forEach(([k, val]) => {
    d.text(L, y, k, 'Helvetica', 10, 'grey');
    const lines = _pdfWrap(val, 'Helvetica-Bold', 10.5, MW - 175);
    lines.forEach((ln, i) => d.text(L + 175, y + i * 14, ln, 'Helvetica-Bold', 10.5, 'ink'));
    const h = Math.max(1, lines.length) * 14; d.line(L, y + h - 2, R, y + h - 2, 0.4, 'light'); y += h + 8;
  });
  if (spec.box) {
    y += 6; d.rect(L, y, MW, 118, 0.9, 'gold', true);
    d.center(W / 2, y + 62, spec.box, 'Helvetica-Oblique', 9.5, 'grey'); y += 118 + 18;
  }
  if (spec.outro) y = d.para(L, y + 4, spec.outro, MW, 'Helvetica', 11, 16) + 6;
  if (spec.seal) { d.center(W / 2, H - 175, '(OFFICIAL SEAL)', 'Helvetica', 8, 'gold'); }
  const sy = H - 120;
  d.line(L, sy, L + 170, sy, 0.6, 'navy'); d.center(L + 85, sy + 14, spec.sigs[0], 'Helvetica', 9, 'ink');
  d.line(R - 170, sy, R, sy, 0.6, 'navy'); d.center(R - 85, sy + 14, spec.sigs[1], 'Helvetica', 9, 'ink');
  d.center(W / 2, H - 52, 'Specimen document generated by OATS for office-administration training only - not a genuine record.', 'Helvetica', 7.5, 'grey');
  return d.build();
}

function pfDownloadSample(empId, tabIdx) {
  const emp = Store.getEmployee(empId), tab = PF_TABS[tabIdx];
  const blob = emp && buildSamplePdf(tab, emp); if (!blob) return toast('Could not build the sample document', 'error');
  const fname = `${emp.firstName}-${emp.lastName}-${tab.replace(/\s+/g, '-')}-Sample.pdf`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('\u2713 Sample document downloaded \u2014 now upload the same file below', 'success');
}
