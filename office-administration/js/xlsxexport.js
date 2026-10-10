/* =========================================================
   xlsxexport.js — hand-rolled .xlsx writer (no libraries) +
   Attendance Excel Practice export (Data / Questions / Answer Key)
   ========================================================= */

const XLSX_CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function xlsxCrc(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = XLSX_CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function xlsxZip(files) { // files: [{name, data:string}] — stored (no compression)
  const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
  files.forEach(f => {
    const name = enc.encode(f.name), data = enc.encode(f.data), crc = xlsxCrc(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  });
  const cenSize = central.reduce((a, p) => a + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function xlsxCol(n) { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; }
function xlsxEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* Styles: 1 header · 2 answer box (yellow) · 3 wrapped text · 4 title · 5 centred bordered · 6 bordered */
const XLSX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F3A5F"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBBBBBB"/></left><right style="thin"><color rgb="FFBBBBBB"/></right><top style="thin"><color rgb="FFBBBBBB"/></top><bottom style="thin"><color rgb="FFBBBBBB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/></cellXfs></styleSheet>`;

function xlsxCell(ref, c) {
  if (c === null || c === undefined || c === '') return '';
  const o = (typeof c === 'object') ? c : { v: c };
  const s = o.s ? ` s="${o.s}"` : '';
  if (o.f !== undefined) return `<c r="${ref}"${s}><f>${xlsxEsc(o.f)}</f></c>`;
  if (o.v === '' || o.v === null || o.v === undefined) return `<c r="${ref}"${s}/>`;
  if (typeof o.v === 'number') return `<c r="${ref}"${s}><v>${o.v}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xlsxEsc(o.v)}</t></is></c>`;
}

/* sheets: [{name, rows:[[cell,...],...], widths:[..], freeze:{col,row}}] */
function buildXlsx(sheets) {
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ${ns} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xlsxEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr fullCalcOnLoad="1"/></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: XLSX_STYLES }
  ];
  sheets.forEach((sh, i) => {
    const fz = sh.freeze ? `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${sh.freeze.col}" ySplit="${sh.freeze.row}" topLeftCell="${xlsxCol(sh.freeze.col)}${sh.freeze.row + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>` : '';
    const cols = sh.widths ? `<cols>${sh.widths.map((w, k) => `<col min="${k + 1}" max="${k + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const rows = sh.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => xlsxCell(xlsxCol(ci) + (ri + 1), c)).join('')}</row>`).join('');
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ${ns}>${fz}${cols}<sheetData>${rows}</sheetData></worksheet>` });
  });
  return xlsxZip(files);
}

function xlsxDownload(filename, blob) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Exported ' + filename, 'success');
}

/* ---------- Attendance practice set ---------- */
function attPracticeModel(month) {
  const emps = Store.getEmployees(), days = daysInMonthOf(month), md = Store.getMonthAttendance(month);
  const code = (e, d) => (md[e.id] || {})[pad(d)] || '';
  const name = e => `${e.firstName} ${e.lastName}`;
  const cnt = (e, c) => { let n = 0; for (let d = 1; d <= days; d++) if (code(e, d) === c) n++; return n; };
  const marked = e => { let n = 0; for (let d = 1; d <= days; d++) if (code(e, d)) n++; return n; };
  if (!emps.length || !emps.some(e => marked(e))) return null;
  const lastCol = xlsxCol(2 + days);                       // days start in column D
  const rowOf = e => emps.indexOf(e) + 2;                  // Attendance sheet row
  const rng = e => `Attendance!D${rowOf(e)}:${lastCol}${rowOf(e)}`;
  const all = `Attendance!D2:${lastCol}${emps.length + 1}`;
  const pick = i => emps[Math.min(i, emps.length - 1)];
  const q = [];
  const e1 = pick(0), e2 = pick(1), e3 = pick(2);
  q.push({ q: `How many days was ${name(e1)} marked Present (P) in ${monthLabel(month)}?`, a: cnt(e1, 'P'), f: `=COUNTIF(${rng(e1)},"P")` });
  q.push({ q: `How many days was ${name(e2)} marked Absent (A)?`, a: cnt(e2, 'A'), f: `=COUNTIF(${rng(e2)},"A")` });
  let bestD = 1, bestN = -1;
  for (let d = 1; d <= days; d++) { const n = emps.filter(e => code(e, d) === 'A').length; if (n > bestN) { bestN = n; bestD = d; } }
  const dcol = xlsxCol(2 + bestD);
  q.push({ q: `How many employees were marked Absent (A) on day ${pad(bestD)} of the month?`, a: bestN, f: `=COUNTIF(Attendance!${dcol}2:${dcol}${emps.length + 1},"A")` });
  const top = emps.slice().sort((x, y) => cnt(y, 'A') - cnt(x, 'A'))[0];
  q.push({ q: 'Which employee has the highest number of Absent (A) days? Write the employee name.', a: name(top), f: `Add a total-Absent column per employee, then use =INDEX(B2:B${emps.length + 1},MATCH(MAX(total),total,0))` });
  let hd = 0; emps.forEach(e => { hd += cnt(e, 'HD'); });
  q.push({ q: 'What is the total number of Half Days (HD) across all employees for the month?', a: hd, f: `=COUNTIF(${all},"HD")` });
  const depts = {}; emps.forEach(e => { depts[e.department] = (depts[e.department] || 0) + cnt(e, 'P'); });
  const dTop = Object.keys(depts).sort((x, y) => depts[y] - depts[x])[0];
  q.push({ q: `What is the total number of Present (P) days for the ${dTop} department?`, a: depts[dTop], f: `Add a total-P column per employee (=COUNTIF(row,"P")), then =SUMIF(C2:C${emps.length + 1},"${dTop}",total-P column)` });
  const pct = Math.round(cnt(e3, 'P') / marked(e3) * 1000) / 10;
  q.push({ q: `What is ${name(e3)}'s Present % = days marked P ÷ total days marked (all codes, blanks excluded)? Round to 1 decimal.`, a: pct, f: `=ROUND(COUNTIF(${rng(e3)},"P")/COUNTA(${rng(e3)})*100,1)` });
  q.push({ q: 'How many employees have zero Absent (A) days?', a: emps.filter(e => cnt(e, 'A') === 0).length, f: `Add a total-Absent column, then =COUNTIF(total,0)` });
  return { emps, days, md, code, name, q };
}

function attDataSheets(m, lab) {
  const emp = [['Emp ID', 'Name', 'Department', 'Designation', 'Joining Date'].map(v => ({ v, s: 1 }))];
  m.emps.forEach(e => emp.push([e.id, m.name(e), e.department, e.designation || '', e.joiningDate || ''].map(v => ({ v, s: 6 }))));
  const att = [[{ v: 'Emp ID', s: 1 }, { v: 'Name', s: 1 }, { v: 'Department', s: 1 }, ...Array.from({ length: m.days }, (_, i) => ({ v: i + 1, s: 1 }))]];
  m.emps.forEach(e => att.push([{ v: e.id, s: 6 }, { v: m.name(e), s: 6 }, { v: e.department, s: 6 }, ...Array.from({ length: m.days }, (_, i) => ({ v: m.code(e, i + 1), s: 5 }))]));
  att.push([]); att.push([{ v: 'Codes: P Present · A Absent · L Leave · H Holiday · OD On Duty · WFH Work From Home · HD Half Day. Row 1 = day of month (' + lab + ').' }]);
  return [
    { name: 'Employees', rows: emp, widths: [12, 24, 18, 24, 14], freeze: { col: 2, row: 1 } },
    { name: 'Attendance', rows: att, widths: [12, 24, 18, ...Array(m.days).fill(4.5)], freeze: { col: 3, row: 1 } }];
}

function attQuestionSheet(m, lab, sheetsHint) {
  const rows = [[{ v: `Attendance Practice — ${lab}`, s: 4 }], [{ v: sheetsHint }], [],
    [{ v: 'Q.No', s: 1 }, { v: 'Question — what to find', s: 1 }, { v: 'Your Answer', s: 1 }]];
  m.q.forEach((x, i) => rows.push([{ v: i + 1, s: 5 }, { v: x.q, s: 3 }, { v: '', s: 2 }]));
  return { name: 'Questions', rows, widths: [8, 90, 24] };
}

function attExportPractice(kind) {
  const m = attPracticeModel(_attMonth);
  if (!m) return toast('Mark or Auto-fill attendance for this month first', 'error');
  const lab = monthLabel(_attMonth), tag = _attMonth;
  if (kind === 'single') {
    const qs = attQuestionSheet(m, lab, 'Use the Employees and Attendance sheets in this same workbook. Find each answer with Excel formulas and type it in the yellow cell.');
    return xlsxDownload(`attendance-practice-${tag}.xlsx`, buildXlsx([qs, ...attDataSheets(m, lab)]));
  }
  if (kind === 'data') return xlsxDownload(`attendance-data-${tag}.xlsx`, buildXlsx(attDataSheets(m, lab)));
  if (kind === 'questions') {
    const qs = attQuestionSheet(m, lab, 'Open the Data workbook (sheets: Employees, Attendance) and find the answers using Excel formulas. Type each answer in the yellow cell.');
    return xlsxDownload(`attendance-questions-${tag}.xlsx`, buildXlsx([qs]));
  }
  const rows = [[{ v: `Answer Key (Instructor) — ${lab}`, s: 4 }], [],
    [{ v: 'Q.No', s: 1 }, { v: 'Question', s: 1 }, { v: 'Correct Answer', s: 1 }, { v: 'Formula (sheet names as in the Data / Practice workbook)', s: 1 }]];
  m.q.forEach((x, i) => rows.push([{ v: i + 1, s: 5 }, { v: x.q, s: 3 }, { v: typeof x.a === 'number' ? x.a : String(x.a), s: 2 }, { v: x.f, s: 3 }]));
  xlsxDownload(`attendance-answerkey-${tag}.xlsx`, buildXlsx([{ name: 'Answer Key', rows, widths: [8, 70, 18, 70] }]));
}
