/* GST Training Simulator - downloadable PDFs (registration certificate, GSTR-1, GSTR-3B)
   Developed by Dot Ecosystem. Training use only: not issued by GSTN / CBIC. */
(function () {
  'use strict';
  var NAVY = [11, 46, 92], NAVY2 = [24, 72, 138], SAFF = [255, 153, 51], GREEN = [19, 136, 8], INK = [27, 36, 54],
      MUTE = [102, 114, 133], LINE = [212, 221, 234], SOFT = [240, 245, 251], AMBER = [255, 245, 218], AMBERL = [226, 172, 44], WHITE = [255, 255, 255];
  var BRAND = 'Dot Ecosystem';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function lib() { var L = window.jspdf && window.jspdf.jsPDF; if (!L) throw new Error('PDF library not loaded'); return L; }
  function n2(v) { return Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function inr(v) { return 'Rs ' + n2(v); }
  function dt(v, withTime) {
    if (!v) return '-'; var d = new Date(v); if (isNaN(d)) return String(v);
    var s = ('0' + d.getDate()).slice(-2) + '-' + MON[d.getMonth()] + '-' + d.getFullYear();
    return withTime ? s + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) : s;
  }
  function rd(x) { return Math.round((Number(x) + Number.EPSILON) * 100) / 100; }
  function txt(v) { return (v === undefined || v === null || v === '') ? '-' : String(v); }
  function safeRead(k, f) { try { return typeof gstRead === 'function' ? gstRead(k, f) : f; } catch (e) { return f; } }
  function reg() { try { return JSON.parse(localStorage.getItem('gstRegistration') || 'null'); } catch (e) { return null; } }
  function tp() { return safeRead('gstTaxpayer', {}) || {}; }
  function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }

  /* ---------------------------------------------------------------- document kit */
  function Kit(title, code, subtitle, status) {
    var Doc = lib();
    this.doc = new Doc({ unit: 'mm', format: 'a4', compress: true });
    this.W = 210; this.H = 297; this.M = 14; this.y = 0; this.title = title; this.code = code; this.subtitle = subtitle; this.status = status;
    this.doc.setProperties({ title: title, subject: code, author: BRAND, creator: BRAND + ' - GST Training Simulator' });
    this.page(true);
  }
  Kit.prototype.fill = function (c) { this.doc.setFillColor(c[0], c[1], c[2]); };
  Kit.prototype.stroke = function (c) { this.doc.setDrawColor(c[0], c[1], c[2]); };
  Kit.prototype.color = function (c) { this.doc.setTextColor(c[0], c[1], c[2]); };
  Kit.prototype.watermark = function () {
    var d = this.doc; d.saveGraphicsState(); d.setGState(new d.GState({ opacity: 0.055 }));
    d.setTextColor(NAVY[0], NAVY[1], NAVY[2]); d.setFont('helvetica', 'bold');
    var a = 38 * Math.PI / 180, put = function (t, size, cx, cy) { d.setFontSize(size); var w = d.getTextWidth(t); d.text(t, cx - (w / 2) * Math.cos(a), cy + (w / 2) * Math.sin(a), { angle: 38 }); };
    put('TRAINING SIMULATOR', 44, 105, 156); put('NOT A GOVERNMENT DOCUMENT', 15, 111, 170);
    d.restoreGraphicsState();
  };
  Kit.prototype.page = function (first) {
    var d = this.doc; if (!first) d.addPage();
    this.watermark();
    if (first) {
      var i, bandTop = 5.2, bandH = 40;
      this.fill(SAFF); d.rect(0, 0, 210, 1.5, 'F'); this.fill(WHITE); d.rect(0, 1.5, 210, 1.4, 'F'); this.fill(GREEN); d.rect(0, 2.9, 210, 1.5, 'F');
      for (i = 0; i < 40; i++) { this.fill(mix(NAVY, NAVY2, i / 39)); d.rect(0, bandTop + i, 210, 1.02, 'F'); }
      d.saveGraphicsState(); d.setGState(new d.GState({ opacity: 0.07 })); this.fill(WHITE);
      d.circle(188, 14, 30, 'F'); d.circle(160, 44, 20, 'F'); d.circle(205, 44, 14, 'F'); d.restoreGraphicsState();
      this.fill(SAFF); d.rect(this.M, 13, 1.1, 24, 'F');
      this.color(SAFF); d.setFont('helvetica', 'bold'); d.setFontSize(7.4); d.setCharSpace(1.1);
      d.text('GOODS AND SERVICES TAX  |  TRAINING SIMULATOR', this.M + 4.5, 15.5); d.setCharSpace(0);
      this.color(WHITE); d.setFontSize(19.5); d.text(this.title, this.M + 4.5, 25);
      d.setFont('helvetica', 'normal'); d.setFontSize(9); this.color([205, 220, 242]); d.text(this.subtitle, this.M + 4.5, 31.2);
      d.setFontSize(8); d.text(this.code, this.M + 4.5, 36.4);
      if (this.status) {
        var bw = 38, bx = 210 - this.M - bw, by = 13;
        this.fill(GREEN); d.roundedRect(bx, by, bw, 8.2, 4.1, 4.1, 'F'); this.color(WHITE); d.setFont('helvetica', 'bold'); d.setFontSize(8.6);
        d.text(this.status, bx + bw / 2, by + 5.4, { align: 'center' });
      }
      d.setDrawColor(255, 255, 255); d.setLineWidth(0.3); d.roundedRect(210 - this.M - 38, 24, 38, 7.2, 3.6, 3.6, 'S');
      this.color(WHITE); d.setFont('helvetica', 'bold'); d.setFontSize(7.2); d.text('TRAINING COPY', 210 - this.M - 19, 28.7, { align: 'center' });
      this.y = bandTop + bandH + 8;
    } else {
      this.fill(NAVY); d.rect(0, 0, 210, 9, 'F'); this.fill(SAFF); d.rect(0, 9, 210, 0.9, 'F');
      this.color(WHITE); d.setFont('helvetica', 'bold'); d.setFontSize(8.5); d.text(this.title, this.M, 6);
      d.setFont('helvetica', 'normal'); d.text(this.code, 210 - this.M, 6, { align: 'right' });
      this.y = 17;
    }
  };
  Kit.prototype.need = function (h) { if (this.y + h > this.H - 20) this.page(false); };
  Kit.prototype.section = function (label) {
    this.need(16); var d = this.doc;
    this.fill(SAFF); d.rect(this.M, this.y, 1.6, 6.4, 'F');
    this.color(NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(11); d.text(label, this.M + 4.2, this.y + 5);
    this.stroke(LINE); d.setLineWidth(0.25); d.line(this.M + 4.2 + d.getTextWidth(label) + 3, this.y + 3.4, 210 - this.M, this.y + 3.4);
    this.y += 10.5;
  };
  Kit.prototype.note = function (t) {
    var d = this.doc; this.color(MUTE); d.setFont('helvetica', 'italic'); d.setFontSize(7.6);
    var lines = d.splitTextToSize(t, 210 - 2 * this.M); this.need(lines.length * 3.6 + 2); d.text(lines, this.M, this.y); this.y += lines.length * 3.6 + 2;
  };
  /* card grid: items = [[label, value], ...] */
  Kit.prototype.cards = function (items, cols, opt) {
    opt = opt || {}; var d = this.doc, gap = 3, w = (210 - 2 * this.M - gap * (cols - 1)) / cols, i, row = 0;
    for (i = 0; i < items.length; i += cols) {
      var slice = items.slice(i, i + cols), hmax = 0, k;
      d.setFont('helvetica', 'bold'); d.setFontSize(opt.vs || 9.4);
      for (k = 0; k < slice.length; k++) { var ls = d.splitTextToSize(txt(slice[k][1]), w - 6); hmax = Math.max(hmax, ls.length); }
      var h = 9.2 + hmax * 4.1; this.need(h + 3);
      for (k = 0; k < slice.length; k++) {
        var x = this.M + k * (w + gap);
        this.fill(SOFT); this.stroke(LINE); d.setLineWidth(0.25); d.roundedRect(x, this.y, w, h, 2, 2, 'FD');
        this.fill(SAFF); d.rect(x, this.y + 2.2, 0.9, h - 4.4, 'F');
        this.color(MUTE); d.setFont('helvetica', 'bold'); d.setFontSize(6.5); d.setCharSpace(0.35); d.text(String(slice[k][0]).toUpperCase(), x + 3.4, this.y + 4.4); d.setCharSpace(0);
        this.color(INK); d.setFont('helvetica', 'bold'); d.setFontSize(opt.vs || 9.4);
        d.text(d.splitTextToSize(txt(slice[k][1]), w - 6), x + 3.4, this.y + 9);
      }
      this.y += h + 3; row++;
    }
    this.y += 1.5;
  };
  /* table: cols=[{h,w,a}] ; rows=[[...]] ; opt.total = last row is a total */
  Kit.prototype.table = function (cols, rows, opt) {
    opt = opt || {}; var d = this.doc, M = this.M, self = this, fs = opt.fs || 7.8, lh = fs * 0.43 + 0.35;
    var total = cols.reduce(function (a, c) { return a + c.w; }, 0), scale = (210 - 2 * M) / total;
    var ws = cols.map(function (c) { return c.w * scale; });
    function header() {
      self.need(26); var x = M, hh = 7.2;
      self.fill(NAVY); d.roundedRect(M, self.y, 210 - 2 * M, hh, 1.4, 1.4, 'F');
      self.color(WHITE); d.setFont('helvetica', 'bold'); d.setFontSize(fs - 0.4);
      cols.forEach(function (c, i) { var tx = c.a === 'r' ? x + ws[i] - 2 : x + 2; var ls = d.splitTextToSize(c.h, ws[i] - 4); d.text(ls[0], tx, self.y + 4.7, { align: c.a === 'r' ? 'right' : 'left' }); x += ws[i]; });
      self.y += hh;
    }
    if (!rows.length) { rows = [cols.map(function (c, i) { return i === 0 ? 'No records' : ''; })]; }
    header();
    rows.forEach(function (r, ri) {
      var isTotal = opt.total && ri === rows.length - 1, maxL = 1;
      d.setFont('helvetica', isTotal ? 'bold' : 'normal'); d.setFontSize(fs);
      var cells = r.map(function (c, i) { var ls = d.splitTextToSize(String(c === undefined || c === null ? '' : c), ws[i] - 4); maxL = Math.max(maxL, ls.length); return ls; });
      var h = maxL * lh + 3.2;
      if (self.y + h > self.H - 20) { self.page(false); header(); }
      if (isTotal) { self.fill([229, 238, 250]); d.rect(M, self.y, 210 - 2 * M, h, 'F'); }
      else if (ri % 2 === 1) { self.fill(SOFT); d.rect(M, self.y, 210 - 2 * M, h, 'F'); }
      self.stroke(LINE); d.setLineWidth(0.18); d.line(M, self.y + h, 210 - M, self.y + h);
      var x = M; self.color(INK); d.setFont('helvetica', isTotal ? 'bold' : 'normal'); d.setFontSize(fs);
      cells.forEach(function (ls, i) { var tx = cols[i].a === 'r' ? x + ws[i] - 2 : x + 2; d.text(ls, tx, self.y + 3.9, { align: cols[i].a === 'r' ? 'right' : 'left' }); x += ws[i]; });
      self.y += h;
    });
    this.y += 4;
  };
  Kit.prototype.stats = function (items) { /* big-number tiles */
    var d = this.doc, n = items.length, gap = 3, w = (210 - 2 * this.M - gap * (n - 1)) / n, h = 20; this.need(h + 4);
    for (var i = 0; i < n; i++) {
      var x = this.M + i * (w + gap), c = items[i][2] || NAVY;
      this.fill(WHITE); this.stroke(LINE); d.setLineWidth(0.3); d.roundedRect(x, this.y, w, h, 2.4, 2.4, 'FD');
      this.fill(c); d.roundedRect(x, this.y, w, 2.2, 1.1, 1.1, 'F');
      this.color(MUTE); d.setFont('helvetica', 'bold'); d.setFontSize(6.4); d.setCharSpace(0.3); d.text(String(items[i][0]).toUpperCase(), x + 3, this.y + 7); d.setCharSpace(0);
      this.color(c); d.setFont('helvetica', 'bold'); d.setFontSize(items[i][1].length > 13 ? 10.5 : 12.5); d.text(items[i][1], x + 3, this.y + 15);
    }
    this.y += h + 5;
  };
  Kit.prototype.disclaimer = function () {
    var d = this.doc, w = 210 - 2 * this.M;
    var body = 'This document was generated by the GST Training Simulator for learning and practice only. It is NOT issued by, filed with, or connected to the GST Network (GSTN), the CBIC, any State tax authority or any government portal, and it has no legal, tax or evidentiary value. '
      + 'All names, GSTIN, TRN, ARN, reference numbers, amounts, dates and signatures are fictitious or simulated. Tax rules are simplified for teaching and may differ from the law in force. Do not submit, rely on, or present this document as a real return, acknowledgement or certificate.';
    d.setFont('helvetica', 'normal'); d.setFontSize(7.6);
    var ls = d.splitTextToSize(body, w - 10), h = ls.length * 3.5 + 12; this.need(h + 6);
    this.fill(AMBER); this.stroke(AMBERL); d.setLineWidth(0.4); d.roundedRect(this.M, this.y, w, h, 2.2, 2.2, 'FD');
    this.fill(AMBERL); d.rect(this.M, this.y + 2, 1.4, h - 4, 'F');
    this.color([122, 76, 0]); d.setFont('helvetica', 'bold'); d.setFontSize(8.4); d.text('DISCLAIMER - TRAINING DOCUMENT', this.M + 5, this.y + 5.6);
    d.setFont('helvetica', 'normal'); d.setFontSize(7.6); this.color([96, 62, 10]); d.text(ls, this.M + 5, this.y + 10.2);
    this.y += h + 4;
  };
  Kit.prototype.finish = function (filename) {
    var d = this.doc, n = d.getNumberOfPages(), i;
    for (i = 1; i <= n; i++) {
      d.setPage(i); this.stroke(LINE); d.setLineWidth(0.3); d.line(this.M, 285, 210 - this.M, 285);
      this.fill(SAFF); d.rect(this.M, 285.9, 8, 0.8, 'F'); this.fill(WHITE); this.fill(GREEN); d.rect(this.M + 8, 285.9, 8, 0.8, 'F');
      this.color(NAVY); d.setFont('helvetica', 'bold'); d.setFontSize(8); d.text('Developed by ' + BRAND, this.M, 290.6);
      this.color(MUTE); d.setFont('helvetica', 'normal'); d.setFontSize(7.2); d.text('GST Training Simulator  |  Generated ' + dt(new Date(), true), this.M, 294.2);
      d.text('Page ' + i + ' of ' + n, 210 - this.M, 290.6, { align: 'right' });
      d.text('Training copy - not a government document', 210 - this.M, 294.2, { align: 'right' });
    }
    d.save(filename);
  };

  /* ---------------------------------------------------------------- shared data helpers */
  function ctxInfo() { var c = typeof gstReturnContext === 'function' ? gstReturnContext() : { fy: '2026-27', period: 'Jul 2026' }; return c; }
  function who() {
    var p = tp(), r = reg() || {}, a = r.partA || {};
    return { gstin: p.gstin || r.gstin || '-', legal: p.legalName || r.legalName || a.legalName || '-', trade: p.tradeName || r.tradeName || (r.partB && r.partB.tradeName) || '-', state: p.state || r.state || a.state || '-', pan: r.pan || a.pan || (p.gstin ? p.gstin.slice(2, 12) : '-') };
  }
  function pName(o, pre) { return [o[pre + 'First'] || o.First, o[pre + 'Middle'] || o.Middle, o[pre + 'Last'] || o.Last].filter(Boolean).join(' '); }

  /* ================================================================ REGISTRATION CERTIFICATE */
  window.gstPdfRegistration = function () {
    var r = reg(); if (!r || !r.gstin) { alert('Registration is not approved yet.'); return; }
    var b = r.partB || {}, a = r.partA || {}, p = tp();
    var k = new Kit('Registration Certificate', 'FORM GST REG-06  |  Training Copy', 'Issued under the CGST Act, 2017 and SGST Act (simulated)', 'ACTIVE');
    var d = k.doc;
    /* GSTIN hero card */
    var w = 210 - 2 * k.M, h = 27; k.fill(WHITE); k.stroke(NAVY); d.setLineWidth(0.7); d.roundedRect(k.M, k.y, w, h, 3, 3, 'FD');
    k.fill(SAFF); d.roundedRect(k.M, k.y, 3, h, 1.5, 1.5, 'F');
    k.color(MUTE); d.setFont('helvetica', 'bold'); d.setFontSize(7); d.setCharSpace(0.6); d.text('REGISTRATION NUMBER (GSTIN)', k.M + 8, k.y + 7); d.setCharSpace(0);
    k.color(NAVY); d.setFont('courier', 'bold'); d.setFontSize(25); d.setCharSpace(1.6); d.text(r.gstin, k.M + 8, k.y + 18.5); d.setCharSpace(0);
    k.color(INK); d.setFont('helvetica', 'normal'); d.setFontSize(8.5); d.text('State code ' + r.gstin.slice(0, 2) + '   |   PAN ' + r.gstin.slice(2, 12) + '   |   Entity ' + r.gstin.charAt(12) + '   |   Check digit ' + r.gstin.charAt(14), k.M + 8, k.y + 23.6);
    k.y += h + 6;
    k.section('Registration details');
    k.cards([
      ['Legal name', r.legalName || a.legalName], ['Trade name', b.tradeName || r.tradeName],
      ['Constitution of business', b.constitution], ['Type of registration', 'Regular'],
      ['Date of liability', dt(b.liabilityDate)], ['Date of commencement', dt(b.commencementDate)],
      ['Period of validity', 'From ' + dt(r.approvedAt) + '  to  Not applicable'], ['Date of issue of certificate', dt(r.approvedAt)]
    ], 2);
    k.section('Address of principal place of business');
    var addr = [b.prinBuilding, b.prinFloor && ('Floor ' + b.prinFloor), b.prinPremises, b.prinRoad, b.prinLocality, b.prinCity, b.prinDistrict, b.prinState, b.prinPincode].filter(Boolean).join(', ');
    k.cards([['Address', addr], ['Nature of possession', b.prinNature], ['Nature of business activity', (Object.keys(b).filter(function (x) { return x.indexOf('prinact_') === 0 && b[x] === true; }).map(function (x) { return x.slice(8).replace(/___/g, ' / ').replace(/__/g, ' (').replace(/_$/, ')').replace(/_/g, ' '); }).join(', ') || 'Not specified')],
      ['Jurisdiction (State)', (b.prinSCWCU || b.prinCircle || 'Simulated State Jurisdiction') + ', ' + (b.prinState || a.state || '')], ['Jurisdiction (Centre)', (b.prinCommissionerate || 'Simulated Central Jurisdiction') + (b.prinDivision ? ' / ' + b.prinDivision : '')]], 1, { vs: 8.6 });
    k.section('Promoters / Partners / Directors');
    var pl = (b.promotersList || []).map(function (x, i) { return [String(i + 1), [x.First, x.Middle, x.Last].filter(Boolean).join(' '), txt(x.Designation), txt(x.Din), txt(x.Pan)]; });
    k.table([{ h: '#', w: 8 }, { h: 'Name', w: 62 }, { h: 'Designation', w: 42 }, { h: 'DIN', w: 34 }, { h: 'PAN', w: 36 }], pl);
    k.section('Primary authorised signatory');
    var sl = (b.signatoryList || []).map(function (x) { return [[x.First, x.Middle, x.Last].filter(Boolean).join(' '), txt(x.Designation), x.primary ? 'Primary' : 'Additional', txt(x.Pan)]; });
    k.table([{ h: 'Name', w: 64 }, { h: 'Designation', w: 46 }, { h: 'Type', w: 32 }, { h: 'PAN', w: 40 }], sl);
    k.section('Goods and services supplied');
    var gl = (b.goodsList || []).map(function (x) { return [txt(x.code), txt(x.desc)]; });
    k.table([{ h: 'HSN / SAC', w: 28 }, { h: 'Description', w: 154 }], gl);
    k.section('Application trail');
    k.cards([['ARN', r.arn], ['TRN', r.trn], ['Application submitted', dt(r.submittedAt, true)], ['Approved on', dt(r.approvedAt, true)],
      ['Verification', (r.method || 'Aadhaar + EVC')], ['Return frequency', p.frequency || 'Monthly']], 3, { vs: 8.6 });
    k.section('Next steps');
    k.note('1) Log in with your GSTIN, set your username and password.  2) File GSTR-1 by the 11th and GSTR-3B by the 20th of the following month (monthly filers).  3) Under Rule 59(6), GSTR-1 cannot be filed while GSTR-3B for the two preceding tax periods is pending.  4) Interest at 18% p.a. and late fee apply on delayed payment / filing.');
    k.y += 2;
    /* signature strip */
    k.need(26); k.stroke(LINE); d.setLineWidth(0.3); d.line(k.W - k.M - 62, k.y + 12, k.W - k.M, k.y + 12);
    k.color(INK); d.setFont('helvetica', 'bolditalic'); d.setFontSize(12); d.text('Simulated Proper Officer', k.W - k.M - 31, k.y + 9.5, { align: 'center' });
    k.color(MUTE); d.setFont('helvetica', 'normal'); d.setFontSize(7.4); d.text('Digitally generated for training | Not a valid signature', k.W - k.M - 31, k.y + 16, { align: 'center' });
    k.color(MUTE); d.text('Place: ' + (b.prinCity || b.prinDistrict || a.district || '-'), k.M, k.y + 9); d.text('Date: ' + dt(r.approvedAt), k.M, k.y + 14);
    k.y += 22;
    k.disclaimer();
    k.finish('GST_Registration_Certificate_' + r.gstin + '.pdf');
  };

  /* ================================================================ GSTR-1 */
  function sums(arr, sign) {
    var o = { n: 0, t: 0, i: 0, c: 0, s: 0, x: 0 };
    (arr || []).forEach(function (r) { var k = typeof sign === 'function' ? sign(r) : 1; o.n++; o.t += k * (+r.taxable || 0); o.i += k * (+r.igst || 0); o.c += k * (+r.cgst || 0); o.s += k * (+r.sgst || 0); o.x += k * (+r.cess || 0); });
    return o;
  }
  window.gstPdfGstr1 = function () {
    var g = gstGstr1Data(); var c = ctxInfo(), me = who();
    if (g.status !== 'Filed') { alert('GSTR-1 is not filed yet.'); return; }
    var late = typeof gstLateFee === 'function' ? gstLateFee('GSTR-1', c.period, false) : null;
    var k = new Kit('GSTR-1  Filing Acknowledgement', 'Details of outward supplies  |  FY ' + c.fy + '  |  ' + c.period, me.legal, 'FILED'), d = k.doc;
    k.section('Return particulars');
    k.cards([['GSTIN', me.gstin], ['Legal name', me.legal], ['Trade name', me.trade], ['Financial year', c.fy], ['Tax period', c.period], ['Form', 'GSTR-1'],
      ['ARN / reference', g.arn || g.reference], ['Date and time of filing', dt(g.filedAt, true)], ['Mode of verification', (g.filingMode || 'EVC') + ' - ' + txt(g.signatory)]], 3, { vs: 8.6 });
    var noteSign = function (r) { return /credit/i.test(r.noteType || '') ? -1 : 1; };
    var b2b = sums(g.invoices), bl = sums((g.b2c || []).filter(function (x) { return x.type === 'B2C Large'; })), bo = sums((g.b2c || []).filter(function (x) { return x.type === 'B2C Others'; })),
        bn = sums((g.b2c || []).filter(function (x) { return x.type === 'Nil / Exempt / Non-GST'; })), ex = sums(g.exports), nt = sums(g.notes, noteSign),
        adv = sums(g.advances, function (r) { return r.kind === 'Adjustment' ? -1 : 1; });
    var tot = typeof gstGstr1Summary === 'function' ? gstGstr1Summary(g) : { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
    k.stats([['Total taxable value', inr(tot.taxable), NAVY], ['Integrated tax', inr(tot.igst), NAVY2], ['Central + State tax', inr((tot.cgst || 0) + (tot.sgst || 0)), GREEN], ['Total tax liability', inr((tot.igst || 0) + (tot.cgst || 0) + (tot.sgst || 0) + (tot.cess || 0)), [190, 90, 0]]]);
    k.section('Summary of outward supplies');
    var R = function (tbl, desc, o) { return [tbl, desc, String(o.n), n2(o.t), n2(o.i), n2(o.c), n2(o.s), n2(o.x)]; };
    k.table([{ h: 'Table', w: 13 }, { h: 'Description', w: 52 }, { h: 'Docs', w: 11, a: 'r' }, { h: 'Taxable value', w: 26, a: 'r' }, { h: 'IGST', w: 22, a: 'r' }, { h: 'CGST', w: 20, a: 'r' }, { h: 'SGST/UTGST', w: 22, a: 'r' }, { h: 'Cess', w: 14, a: 'r' }], [
      R('4A,4B', 'B2B supplies to registered persons', b2b), R('5', 'B2C large (inter-State > Rs 1 lakh)', bl), R('6A', 'Exports with / without payment of tax', ex), R('7', 'B2C others', bo),
      R('8', 'Nil rated, exempt and non-GST supplies', bn), R('9B', 'Credit / debit notes (net: credit minus, debit plus)', nt), R('11', 'Advances received less adjusted (net)', adv),
      ['', 'TOTAL (net outward liability)', '', n2(tot.taxable), n2(tot.igst), n2(tot.cgst), n2(tot.sgst), n2(tot.cess || 0)]], { total: true });
    k.note('Credit notes reduce and debit notes increase the liability. Taxable value of nil / exempt supplies is shown in the total as in the simulator summary.');
    if ((g.invoices || []).length) {
      k.section('Table 4 - B2B invoices');
      k.table([{ h: 'Recipient (GSTIN)', w: 40 }, { h: 'Invoice no.', w: 18 }, { h: 'Date', w: 21 }, { h: 'Place of supply', w: 22 }, { h: 'Rate %', w: 10, a: 'r' }, { h: 'Taxable value', w: 22, a: 'r' }, { h: 'IGST', w: 19, a: 'r' }, { h: 'CGST', w: 17, a: 'r' }, { h: 'SGST', w: 17, a: 'r' }],
        g.invoices.map(function (x) { return [txt(x.recipientName) + ' (' + txt(x.recipientGstin) + ')', txt(x.invoiceNo), dt(x.invoiceDate || x.date), txt(x.pos), txt(x.rate), n2(x.taxable), n2(x.igst), n2(x.cgst), n2(x.sgst)]; }));
    }
    if ((g.b2c || []).length) {
      k.section('Tables 5, 7 and 8 - B2C and nil-rated supplies');
      k.table([{ h: 'Type', w: 30 }, { h: 'Invoice no.', w: 20 }, { h: 'Date', w: 22 }, { h: 'Place of supply', w: 26 }, { h: 'Taxable value', w: 24, a: 'r' }, { h: 'Rate %', w: 11, a: 'r' }, { h: 'IGST', w: 20, a: 'r' }, { h: 'CGST', w: 18, a: 'r' }, { h: 'SGST', w: 18, a: 'r' }],
        g.b2c.map(function (x) { return [txt(x.type), txt(x.invoiceNo), dt(x.date), txt(x.pos), n2(x.taxable), txt(x.rate), n2(x.igst), n2(x.cgst), n2(x.sgst)]; }));
    }
    if ((g.exports || []).length) {
      k.section('Table 6A - Exports');
      k.table([{ h: 'Export type', w: 40 }, { h: 'Invoice no.', w: 22 }, { h: 'Date', w: 22 }, { h: 'Port / shipping bill', w: 36 }, { h: 'Taxable value', w: 28, a: 'r' }, { h: 'IGST', w: 22, a: 'r' }],
        g.exports.map(function (x) { return [txt(x.type), txt(x.invoiceNo), dt(x.date), txt(x.port) + ' / ' + txt(x.sb), n2(x.taxable), n2(x.igst)]; }));
    }
    if ((g.notes || []).length) {
      k.section('Table 9B - Credit / debit notes');
      k.table([{ h: 'Note type', w: 22 }, { h: 'Note no.', w: 18 }, { h: 'Date', w: 22 }, { h: 'Recipient GSTIN', w: 32 }, { h: 'Original invoice', w: 22 }, { h: 'Taxable value', w: 24, a: 'r' }, { h: 'IGST', w: 18, a: 'r' }, { h: 'CGST', w: 18, a: 'r' }, { h: 'SGST', w: 18, a: 'r' }],
        g.notes.map(function (x) { return [txt(x.noteType), txt(x.noteNo), dt(x.noteDate), txt(x.recipient), txt(x.original), (noteSign(x) < 0 ? '-' : '') + n2(x.taxable), (noteSign(x) < 0 ? '-' : '') + n2(x.igst), (noteSign(x) < 0 ? '-' : '') + n2(x.cgst), (noteSign(x) < 0 ? '-' : '') + n2(x.sgst)]; }));
    }
    var hs = (g.hsn && g.hsn.length ? g.hsn : [].concat(g.hsnB2B || [], g.hsnB2C || []));
    k.section('Table 12 - HSN-wise summary of outward supplies');
    k.table([{ h: 'HSN', w: 16 }, { h: 'Description', w: 40 }, { h: 'UQC', w: 11 }, { h: 'Qty', w: 14, a: 'r' }, { h: 'Taxable value', w: 26, a: 'r' }, { h: 'Rate %', w: 11, a: 'r' }, { h: 'IGST', w: 20, a: 'r' }, { h: 'CGST', w: 20, a: 'r' }, { h: 'SGST', w: 20, a: 'r' }],
      hs.map(function (x) { return [txt(x.code || x.hsn), txt(x.desc || x.product), txt(x.uqc), txt(x.qty), n2(x.taxable), txt(x.rate), n2(x.igst), n2(x.cgst), n2(x.sgst)]; }));
    k.section('Table 13 - Documents issued');
    k.table([{ h: 'Nature of document', w: 70 }, { h: 'Sr. no. from', w: 30 }, { h: 'Sr. no. to', w: 30 }, { h: 'Total', w: 24, a: 'r' }, { h: 'Cancelled', w: 24, a: 'r' }],
      (g.documents || []).map(function (x) { return [txt(x.type), txt(x.from), txt(x.to), txt(x.total), txt(x.cancelled)]; }));
    if (late && late.days) {
      k.need(24); var w2 = 210 - 2 * k.M; k.fill([253, 236, 236]); k.stroke([214, 130, 130]); d.setLineWidth(0.4); d.roundedRect(k.M, k.y, w2, 15, 2, 2, 'FD');
      k.color([140, 30, 30]); d.setFont('helvetica', 'bold'); d.setFontSize(8.4); d.text('Late filing - late fee payable (section 47)', k.M + 4, k.y + 5.6);
      d.setFont('helvetica', 'normal'); d.setFontSize(7.8); d.text('Due date ' + dt(late.due) + ', filed ' + late.days + ' day(s) late. Rs ' + late.perDay + '/day, capped at Rs ' + late.cap.toLocaleString('en-IN') + ': late fee ' + inr(late.total) + ' (CGST ' + inr(late.cgst) + ' + SGST ' + inr(late.sgst) + ').', k.M + 4, k.y + 10.6);
      k.y += 19;
    }
    k.section('Declaration and verification');
    k.note('I hereby solemnly affirm and declare that the information given herein above is true and correct to the best of my knowledge and belief and nothing has been concealed therefrom. (Training declaration)');
    k.cards([['Verified by', txt(g.signatory)], ['Verification mode', (g.filingMode || 'EVC') + ' (OTP simulated)'], ['Filed on', dt(g.filedAt, true)]], 3, { vs: 8.6 });
    k.disclaimer();
    k.finish('GSTR1_' + me.gstin + '_' + String(c.period).replace(/\s+/g, '') + '.pdf');
  };

  /* ================================================================ GSTR-3B */
  window.gstPdfGstr3b = function () {
    var g = gst3bData(), c = ctxInfo(), me = who();
    if (g.status !== 'Filed') { alert('GSTR-3B is not filed yet.'); return; }
    var l = gst3bLiability(g), inp = g.input || {}, H = ['igst', 'cgst', 'sgst', 'cess'];
    var v = function (key, h) { return +((inp[key] || {})[h]) || 0; };
    var row = function (label, key) { return [label, n2(v(key, 'taxable')), n2(v(key, 'igst')), n2(v(key, 'cgst')), n2(v(key, 'sgst')), n2(v(key, 'cess'))]; };
    var pay = g.payment || {};
    var cashTax = {}, cashInt = {}, cashFee = {}; H.forEach(function (h) { cashTax[h] = rd(l.net[h] || 0); cashInt[h] = v('interest', h); cashFee[h] = v('lateFee', h); });
    var totOut = H.reduce(function (a, h) { return a + (l.out[h] || 0); }, 0), totItc = H.reduce(function (a, h) { return a + (l.itcUsed[h] || 0); }, 0),
        totCash = H.reduce(function (a, h) { return a + cashTax[h]; }, 0), totInt = H.reduce(function (a, h) { return a + cashInt[h]; }, 0), totFee = H.reduce(function (a, h) { return a + cashFee[h]; }, 0);
    var k = new Kit('GSTR-3B  Filing Acknowledgement', 'Monthly return  |  FY ' + c.fy + '  |  ' + c.period, me.legal, 'FILED'), d = k.doc;
    k.section('Return particulars');
    k.cards([['GSTIN', me.gstin], ['Legal name', me.legal], ['Trade name', me.trade], ['Financial year', c.fy], ['Tax period', c.period], ['Form', 'GSTR-3B'],
      ['ARN / reference', g.reference], ['Date and time of filing', dt(g.filedAt, true)], ['Mode of verification', (g.filingMode || 'EVC') + ' - ' + txt(g.signatory)]], 3, { vs: 8.6 });
    k.stats([['Output tax liability', inr(totOut), NAVY], ['ITC utilised', inr(totItc), NAVY2], ['Tax paid in cash', inr(totCash), GREEN], ['Interest + late fee', inr(totInt + totFee), [190, 90, 0]]]);
    k.section('3.1  Outward supplies and inward supplies liable to reverse charge');
    k.table([{ h: 'Nature of supplies', w: 70 }, { h: 'Taxable value', w: 28, a: 'r' }, { h: 'Integrated tax', w: 24, a: 'r' }, { h: 'Central tax', w: 22, a: 'r' }, { h: 'State/UT tax', w: 22, a: 'r' }, { h: 'Cess', w: 16, a: 'r' }], [
      row('(a) Outward taxable supplies (other than zero rated, nil rated and exempted)', 'a'), row('(b) Outward taxable supplies (zero rated)', 'b'), row('(c) Other outward supplies (nil rated, exempted)', 'c'),
      row('(d) Inward supplies (liable to reverse charge)', 'd'), row('(e) Non-GST outward supplies', 'e')]);
    k.section('3.2  Inter-State supplies');
    k.table([{ h: 'Supplies made to', w: 100 }, { h: 'Taxable value (Rs)', w: 82, a: 'r' }], [
      ['Unregistered persons', n2(inp.t32unreg)], ['Composition taxable persons', n2(inp.t32comp)], ['UIN holders', n2(inp.t32uin)]]);
    k.section('4  Eligible ITC');
    var itcRow = function (label, key) { return [label, n2(v(key, 'igst')), n2(v(key, 'cgst')), n2(v(key, 'sgst')), n2(v(key, 'cess'))]; };
    k.table([{ h: 'Details', w: 86 }, { h: 'Integrated tax', w: 26, a: 'r' }, { h: 'Central tax', w: 26, a: 'r' }, { h: 'State/UT tax', w: 26, a: 'r' }, { h: 'Cess', w: 18, a: 'r' }], [
      itcRow('(A)(1) Import of goods', 'impGoods'), itcRow('(A)(2) Import of services', 'impServices'), itcRow('(A)(3) Inward supplies liable to reverse charge', 'rcm'), itcRow('(A)(4) Inward supplies from ISD', 'isd'), itcRow('(A)(5) All other ITC', 'itcA'),
      itcRow('(B)(1) ITC reversed - Rules 38, 42 and 43', 'itcB'), itcRow('(B)(2) ITC reversed - others', 'other'),
      ['(C) Net ITC available (A - B)', n2(l.itc.igst), n2(l.itc.cgst), n2(l.itc.sgst), n2(l.itc.cess)]], { total: true });
    k.section('5.1  Interest and late fee');
    k.table([{ h: 'Details', w: 70 }, { h: 'Integrated tax', w: 28, a: 'r' }, { h: 'Central tax', w: 28, a: 'r' }, { h: 'State/UT tax', w: 28, a: 'r' }, { h: 'Cess', w: 28, a: 'r' }], [
      ['Interest (18% p.a. on tax paid late)', n2(cashInt.igst), n2(cashInt.cgst), n2(cashInt.sgst), n2(cashInt.cess)], ['Late fee', n2(cashFee.igst), n2(cashFee.cgst), n2(cashFee.sgst), n2(cashFee.cess)]]);
    k.section('6.1  Payment of tax');
    var used = l.used || {}, u = function (f, t) { return n2(((used[f] || {})[t]) || 0); };
    var names = { igst: 'Integrated tax', cgst: 'Central tax', sgst: 'State/UT tax', cess: 'Cess' };
    k.table([{ h: 'Description', w: 30 }, { h: 'Tax payable', w: 21, a: 'r' }, { h: 'ITC IGST', w: 18, a: 'r' }, { h: 'ITC CGST', w: 18, a: 'r' }, { h: 'ITC SGST', w: 18, a: 'r' }, { h: 'ITC Cess', w: 15, a: 'r' }, { h: 'Tax in cash', w: 21, a: 'r' }, { h: 'Interest', w: 17, a: 'r' }, { h: 'Late fee', w: 17, a: 'r' }],
      H.map(function (h) { return [names[h], n2(l.out[h] || 0), u('igst', h), u('cgst', h), u('sgst', h), u('cess', h), n2(cashTax[h]), n2(cashInt[h]), n2(cashFee[h])]; })
        .concat([['TOTAL', n2(totOut), '', '', '', '', n2(totCash), n2(totInt), n2(totFee)]]), { total: true, fs: 7.4 });
    k.note('ITC is utilised in the statutory order: IGST credit against IGST, CGST, SGST; CGST credit against CGST, IGST; SGST credit against SGST, IGST. Tax under reverse charge (3.1(d)) is payable in cash.');
    k.section('Payment and filing record');
    k.cards([['Offset reference', txt(pay.reference)], ['Credit ledger used', inr(pay.creditUsed)], ['Cash ledger used', inr(pay.cashUsed)], ['Offset date', dt(pay.at, true)],
      ['Verified by', txt(g.signatory)], ['Filed on', dt(g.filedAt, true)]], 3, { vs: 8.6 });
    if (g.chargeInfo && g.chargeInfo.days) k.note('Filed ' + g.chargeInfo.days + ' day(s) after the due date of ' + dt(g.chargeInfo.due) + '. Interest and late fee shown above were calculated automatically by the simulator.');
    k.section('Declaration');
    k.note('I hereby solemnly affirm and declare that the information given herein above is true and correct to the best of my knowledge and belief and nothing has been concealed therefrom. (Training declaration)');
    k.disclaimer();
    k.finish('GSTR3B_' + me.gstin + '_' + String(c.period).replace(/\s+/g, '') + '.pdf');
  };

  /* ================================================================ download buttons injected into the simulator pages */
  function mk(id, label, fn, ref) {
    if (document.getElementById(id)) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'gst-action'; b.textContent = label;
    b.style.cssText = 'background:linear-gradient(135deg,#0b2e5c,#1c4f94);color:#fff;border:0;border-radius:6px;padding:10px 16px;font-weight:700;cursor:pointer;margin:6px 8px 6px 0;box-shadow:0 2px 8px rgba(11,46,92,.35)';
    b.onclick = function () { try { fn(); } catch (e) { alert('Could not create the PDF: ' + e.message); } };
    if (ref && ref.parentNode) ref.parentNode.insertBefore(b, ref); else { var fb = document.getElementById('featureBody') || document.body; var w = document.createElement('div'); w.style.margin = '12px 0'; w.appendChild(b); fb.appendChild(w); }
  }
  function scan() {
    try {
      var login = document.querySelector('button[onclick*="gstProceedToLogin"]');
      if (login && reg() && reg().gstin) mk('gstRegPdfBtn', 'DOWNLOAD REGISTRATION CERTIFICATE (PDF)', window.gstPdfRegistration, login);
      var fb = document.getElementById('featureBody'); if (!fb) return; var t = fb.textContent || '';
      if (/GSTR-1/.test(t) && /Filing Acknowledgement/i.test(t) && typeof gstGstr1Data === 'function' && gstGstr1Data().status === 'Filed') {
        var row = fb.querySelector('.gst-action-row'); mk('gstG1PdfBtn', 'DOWNLOAD GSTR-1 ACKNOWLEDGEMENT (PDF)', window.gstPdfGstr1, row && row.firstElementChild);
      }
      if (/GSTR-3B/.test(t) && typeof gst3bData === 'function' && !fb.querySelector('#g3bSignatory')) {
        var s = gst3bData(); if (s.status === 'Filed') { var row2 = fb.querySelector('.gst-action-row'); mk('gstG3PdfBtn', 'DOWNLOAD GSTR-3B ACKNOWLEDGEMENT (PDF)', window.gstPdfGstr3b, row2 && row2.firstElementChild); }
      }
    } catch (e) { /* never break the simulator */ }
  }
  var pending = false;
  function schedule() { if (pending) return; pending = true; setTimeout(function () { pending = false; scan(); }, 120); }
  function start() { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); schedule(); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
