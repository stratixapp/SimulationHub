/* ============================================================
   ICEGATE TRAINING SIMULATOR — PGA / NOC MODULE (SWIFT)
   Real rule modeled: certain commodities need a No Objection
   Certificate from a Participating Government Agency (FSSAI,
   Plant Quarantine, Drug Controller, BIS, Wildlife) before LEO/OOC
   can be granted, regardless of how clean the customs paperwork is.
   ============================================================ */

function computePGARequirements(filing) {
  const agencies = new Set();
  (filing.items || []).forEach(it => {
    const meta = HS_CODE_TABLE[it.hsCode];
    if (meta && meta.pgaAgency) agencies.add(meta.pgaAgency);
  });
  return Array.from(agencies);
}

function initializePGAForFiling(filing) {
  const agencies = computePGARequirements(filing);
  filing.pga = agencies.map(a => ({ agency: a, status: 'NOT_APPLIED', refNo: null, note: '' }));
  if (filing.pga.length) {
    pushTimeline(filing, filing.status, `PGA/NOC clearance required from ${filing.pga.length} Ministry / agenc${filing.pga.length > 1 ? 'ies' : 'y'} for the goods declared.`);
    addNotification(`${filing.id} requires PGA clearance from ${filing.pga.length} Ministry / agenc${filing.pga.length > 1 ? 'ies' : 'y'} before LEO/OOC.`, filing.id);
  }
}

function pgaAllClear(filing) {
  return !filing.pga || filing.pga.every(p => p.status === 'CLEARED');
}

function applyForPGAClearance(filingId, agency) {
  const filing = getFiling(filingId);
  if (!filing) return;
  const p = filing.pga.find(x => x.agency === agency);
  if (!p) return;
  p.status = 'APPLIED';
  saveState();
  const queried = true;   /* v51: every PGA application draws a query first */
  if (queried) {
    p.status = 'QUERY';
    p.note = `${PGA_AGENCIES[agency].name} has requested additional supporting documentation before granting the ${PGA_AGENCIES[agency].noc}. Reply to this query with the details asked for.`;
    addNotification(`${PGA_AGENCIES[agency].name} raised a query on ${filing.id}.`, filing.id);
  } else {
    p.status = 'CLEARED';
    p.refNo = uniqueId('NOC', () => 'NOC-' + agency.slice(0, 3) + '-' + Math.floor(100000 + Math.random() * 900000));
    pushTimeline(filing, filing.status, `${PGA_AGENCIES[agency].name} granted ${PGA_AGENCIES[agency].noc}: ${p.refNo}`);
    addDocument(PGA_AGENCIES[agency].noc, filing.id, `${PGA_AGENCIES[agency].name} — NOC`);
    addNotification(`${PGA_AGENCIES[agency].name} cleared ${filing.id}: ${p.refNo}`, filing.id);
  }
  saveState();
  if (typeof renderFilingDetail === 'function') renderFilingDetail(filing.id);
}

function respondToPGAQuery(filingId, agency, note) {
  const filing = getFiling(filingId);
  if (!filing) return;
  const p = filing.pga.find(x => x.agency === agency);
  if (!p) return;
  if (!note || note.trim().length < 10) { toast('Please provide a response of at least 10 characters.', 'error'); return; }
  p.response = note.trim();
  p.status = 'CLEARED';
  p.refNo = uniqueId('NOC', () => 'NOC-' + agency.slice(0, 3) + '-' + Math.floor(100000 + Math.random() * 900000));
  pushTimeline(filing, filing.status, `Response submitted to ${PGA_AGENCIES[agency].name}; NOC granted: ${p.refNo}`);
  addDocument(PGA_AGENCIES[agency].noc, filing.id, `${PGA_AGENCIES[agency].name} — NOC`);
  addNotification(`${PGA_AGENCIES[agency].name} cleared ${filing.id} after response: ${p.refNo}`, filing.id);
  saveState();
  if (typeof renderFilingDetail === 'function') renderFilingDetail(filing.id);
  toast('PGA query response submitted and cleared.', 'success');
}

/* ---------- v51: Ministry / Department list, application form and panel ---------- */
const PGA_MINISTRIES = [
  { id: 'MIN_AGRI', label: 'Ministry of Agriculture & Farmers Welfare', alt: 'PLANT_QUARANTINE', sub: 'Department of Agriculture - Plant Quarantine (DPPQS)' },
  { id: 'MIN_AYUSH', label: 'Ministry of Ayush' },
  { id: 'MIN_CABSEC', label: 'Cabinet Secretariat', alt: 'NACWC', sub: 'National Authority - Chemical Weapons Convention (NACWC)' },
  { id: 'MIN_CIVAV', label: 'Ministry of Civil Aviation', alt: 'DGCA', sub: 'Directorate General of Civil Aviation (DGCA)' },
  { id: 'MIN_CHEM', label: 'Ministry of Chemicals & Fertilizers' },
  { id: 'MIN_COAL', label: 'Ministry of Coal' },
  { id: 'MIN_COMM', label: 'Ministry of Commerce & Industry', alt: 'DGFT_SCOMET', sub: 'DGFT - SCOMET Authorisation Cell' },
  { id: 'MIN_COMM2', label: 'Ministry of Commerce & Industry', alt: 'PESO', sub: 'Petroleum & Explosives Safety Organisation (PESO)' },
  { id: 'MIN_CONS', label: 'Ministry of Consumer Affairs, Food & Public Distribution', alt: 'BIS', sub: 'Bureau of Indian Standards (BIS)' },
  { id: 'MIN_CORP', label: 'Ministry of Corporate Affairs' },
  { id: 'MIN_CULT', label: 'Ministry of Culture' },
  { id: 'MIN_DAE', label: 'Department of Atomic Energy', alt: 'AERB_DAE', sub: 'Atomic Energy Regulatory Board (AERB)' },
  { id: 'MIN_DEF', label: 'Ministry of Defence', alt: 'MOD_DDP', sub: 'Department of Defence Production' },
  { id: 'MIN_EARTH', label: 'Ministry of Earth Sciences' },
  { id: 'MIN_EDU', label: 'Ministry of Education' },
  { id: 'MIN_IT', label: 'Ministry of Electronics & Information Technology' },
  { id: 'MIN_ENV', label: 'Ministry of Environment, Forest & Climate Change', alt: 'WILDLIFE', sub: 'Wildlife Crime Control Bureau' },
  { id: 'MIN_EXT', label: 'Ministry of External Affairs' },
  { id: 'MIN_FIN', label: 'Ministry of Finance' },
  { id: 'MIN_FISH', label: 'Ministry of Fisheries, Animal Husbandry & Dairying' },
  { id: 'MIN_FOODP', label: 'Ministry of Food Processing Industries' },
  { id: 'MIN_HEALTH', label: 'Ministry of Health & Family Welfare', alt: 'DRUG_CONTROLLER', sub: 'Central Drugs Standard Control Organisation (CDSCO)' },
  { id: 'MIN_HEALTH2', label: 'Ministry of Health & Family Welfare', alt: 'FSSAI', sub: 'Food Safety and Standards Authority of India (FSSAI)' },
  { id: 'MIN_HEAVY', label: 'Ministry of Heavy Industries' },
  { id: 'MIN_HOME', label: 'Ministry of Home Affairs' },
  { id: 'MIN_HOUSE', label: 'Ministry of Housing & Urban Affairs' },
  { id: 'MIN_INFO', label: 'Ministry of Information & Broadcasting' },
  { id: 'MIN_JAL', label: 'Ministry of Jal Shakti' },
  { id: 'MIN_LABOUR', label: 'Ministry of Labour & Employment' },
  { id: 'MIN_LAW', label: 'Ministry of Law & Justice' },
  { id: 'MIN_MSME', label: 'Ministry of Micro, Small & Medium Enterprises' },
  { id: 'MIN_MINES', label: 'Ministry of Mines' },
  { id: 'MIN_NRE', label: 'Ministry of New & Renewable Energy' },
  { id: 'MIN_PETRO', label: 'Ministry of Petroleum & Natural Gas' },
  { id: 'MIN_PORTS', label: 'Ministry of Ports, Shipping & Waterways' },
  { id: 'MIN_POWER', label: 'Ministry of Power' },
  { id: 'MIN_RAIL', label: 'Ministry of Railways' },
  { id: 'MIN_ROAD', label: 'Ministry of Road Transport & Highways' },
  { id: 'MIN_SCI', label: 'Ministry of Science & Technology' },
  { id: 'MIN_SPACE', label: 'Department of Space', alt: 'DOS_IN_SPACE', sub: 'IN-SPACe' },
  { id: 'MIN_STEEL', label: 'Ministry of Steel' },
  { id: 'MIN_TELE', label: 'Ministry of Communications (Department of Telecommunications)' },
  { id: 'MIN_TEXT', label: 'Ministry of Textiles', alt: 'TEXTILE_COMMITTEE', sub: 'Textile Committee' },
  { id: 'MIN_TOUR', label: 'Ministry of Tourism' },
  { id: 'MIN_TRIBAL', label: 'Ministry of Tribal Affairs' }
];

function pgaMinistryLabel(m) { return m.sub ? `${m.label} - ${m.sub}` : m.label; }

function pgaStartApplication(filingId) {
  const filing = getFiling(filingId);
  if (!filing) return;
  const sel = document.getElementById('pgaMinSel');
  const id = sel ? sel.value : '';
  if (!id) { toast('Select the Ministry / Department that must clear this consignment.', 'error'); return; }
  const m = PGA_MINISTRIES.find(x => x.id === id);
  if (!m) return;
  const p = m.alt ? (filing.pga || []).find(x => x.agency === m.alt) : null;
  const box = document.getElementById('pgaMinMsg');
  if (!p) {
    const msg = `Clearance from ${pgaMinistryLabel(m)} is not required for the goods declared in this ${filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry'}. Check the HS codes, description and end-use of your items and choose the Ministry or Department that regulates them.`;
    if (box) { box.className = 'alert alert-error'; box.textContent = msg; }
    toast('That Ministry / Department is not related to this consignment.', 'error');
    return;
  }
  if (p.status !== 'NOT_APPLIED') {
    const msg = `You have already applied to ${pgaMinistryLabel(m)} for this filing (status: ${p.status.replace('_', ' ')}).`;
    if (box) { box.className = 'alert alert-error'; box.textContent = msg; }
    return;
  }
  if (box) { box.className = 'hint'; box.textContent = ''; }
  pgaOpenApplicationForm(filing, p, m);
}

function pgaOpenApplicationForm(filing, p, m) {
  const bg = document.createElement('div'); bg.className = 'modal-bg show';
  bg.innerHTML = `<div class="modal" style="width:min(560px,94vw)"><div class="modal-head">Application for ${esc(PGA_AGENCIES[p.agency].noc)} <span class="close" role="button" tabindex="0" aria-label="Close dialog">×</span></div>
  <div style="padding:20px 22px">
    <p class="hint" style="margin-top:0">To: <b>${esc(pgaMinistryLabel(m))}</b> &middot; ${esc(filing.id)}</p>
    <div class="alert alert-error" id="pgaFormErr" style="display:none;margin-bottom:10px"></div>
    <div class="field"><label>Name of Authorised Signatory (in CAPITAL LETTERS) *</label><input id="pgaF_name" type="text" autocomplete="off" oninput="this.value=this.value.toUpperCase()"></div>
    <div class="field"><label>Designation of Authorised Signatory *</label><input id="pgaF_desig" type="text" autocomplete="off"></div>
    <div class="field"><label>IEC *</label><input id="pgaF_iec" type="text" maxlength="10" autocomplete="off" oninput="this.value=this.value.toUpperCase()"></div>
    <div class="field"><label>GSTIN *</label><input id="pgaF_gstin" type="text" maxlength="15" autocomplete="off" oninput="this.value=this.value.toUpperCase()"></div>
    <div class="field"><label>PAN *</label><input id="pgaF_pan" type="text" maxlength="10" autocomplete="off" oninput="this.value=this.value.toUpperCase()"></div>
    <p class="hint">IEC, GSTIN and PAN must be exactly as declared in your ${filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry'}.</p>
    <div class="actions"><button class="back2 close">Cancel</button><button class="next" id="pgaF_submit">Submit Application</button></div>
  </div></div>`;
  document.body.appendChild(bg);
  bg.addEventListener('click', e => { if (e.target === bg || e.target.classList.contains('close')) bg.remove(); });
  const val = id => (document.getElementById(id).value || '').trim();
  document.getElementById('pgaF_submit').addEventListener('click', () => {
    const errs = [];
    const name = val('pgaF_name');
    if (!/^[A-Z][A-Z .'-]{2,}$/.test(name)) errs.push('Enter the name of the authorised signatory in CAPITAL LETTERS (at least 3 letters).');
    if (val('pgaF_desig').length < 2) errs.push('Enter the designation of the authorised signatory.');
    const party = filing.party || {};
    [['IEC', 'pgaF_iec', party.iec], ['GSTIN', 'pgaF_gstin', party.gstin], ['PAN', 'pgaF_pan', party.pan]].forEach(([lab, id, exp]) => {
      const v = val(id).toUpperCase();
      if (!v) errs.push(`Enter the ${lab}.`);
      else if (exp && String(exp).trim().toUpperCase() !== v) errs.push(`The ${lab} does not match the ${lab} declared in your ${filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry'}.`);
    });
    const box = document.getElementById('pgaFormErr');
    if (errs.length) { box.style.display = 'block'; box.innerHTML = errs.map(esc).join('<br>'); return; }
    const applicant = { name, designation: val('pgaF_desig'), iec: val('pgaF_iec'), gstin: val('pgaF_gstin'), pan: val('pgaF_pan') };
    bg.remove();
    pgaSubmitApplication(filing.id, p.agency, applicant);
  });
}

function pgaSubmitApplication(filingId, agency, applicant) {
  const filing = getFiling(filingId);
  if (!filing) return;
  const p = filing.pga.find(x => x.agency === agency);
  if (!p) return;
  p.applicant = applicant;
  p.appRef = uniqueId('PGAAPP', () => 'PGA-APP-' + Math.floor(100000 + Math.random() * 900000));
  pushTimeline(filing, filing.status, `Application ${p.appRef} submitted to ${PGA_AGENCIES[agency].name} by ${applicant.name} (${applicant.designation}).`);
  applyForPGAClearance(filingId, agency);   // draws the agency's query
}

function pgaPanelHTML(filing) {
  if (!filing.pga || !filing.pga.length) return '';
  const total = filing.pga.length, done = filing.pga.filter(p => p.status === 'CLEARED').length;
  const opts = PGA_MINISTRIES.map(m => `<option value="${m.id}">${esc(pgaMinistryLabel(m))}</option>`).join('');
  const pending = filing.pga.some(p => p.status === 'NOT_APPLIED');
  const applied = filing.pga.filter(p => p.status !== 'NOT_APPLIED');
  return `<div class="wz-card"><h3>PGA / NOC Clearance (Single Window)</h3>
    <p class="hint">The goods declared in this ${filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry'} need clearance from <b>${total}</b> Ministry / agenc${total > 1 ? 'ies' : 'y'} before ${filing.type === 'export' ? 'the Let Export Order (LEO)' : 'Out of Charge'} can be given. Study the HS codes, description and end-use of your items, then choose the Ministry or Department that regulates them. Clearances completed: <b>${done}</b> of ${total}.</p>
    ${pending ? `<div class="field" style="max-width:640px"><label>Ministry / Department of the Government of India</label>
      <select id="pgaMinSel"><option value="">Select Ministry / Department…</option>${opts}</select></div>
      <div id="pgaMinMsg" class="hint"></div>
      <button class="btn-ghost sm" onclick="pgaStartApplication('${filing.id}')">Apply for clearance</button>` : ''}
    ${applied.length ? '<hr style="border:none;border-top:1px solid #eee;margin:12px 0">' : ''}
    ${applied.map(p => `
      <div class="pga-row">
        <b>${esc(PGA_AGENCIES[p.agency].name)}</b> — <span class="badge ${p.status === 'CLEARED' ? 'badge-green' : (p.status === 'QUERY' ? 'badge-red' : 'badge-amber')}">${esc(p.status.replace('_', ' '))}</span>
        ${p.appRef ? `<div class="hint">Application: ${esc(p.appRef)}</div>` : ''}
        ${p.status === 'QUERY' ? `<div class="alert alert-error" style="margin:6px 0">${esc(p.note)}</div>
          ${pgaQueryReplyHTML(filing, p)}` : ''}
        ${p.status === 'CLEARED' ? `<div class="hint">NOC Reference: ${esc(p.refNo)}</div>` : ''}
      </div>`).join('<hr style="border:none;border-top:1px solid #eee;margin:10px 0">')}
  </div>`;
}


/* ============================================================
   v53: PGA QUERY REPLY - the student TYPES the reply
   - A short example FORMAT (placeholders only) is shown. It cannot be selected or copied.
   - The reply box does not accept paste / drag-drop / autofill; typed characters are counted.
   - A reply is accepted only if it quotes this filing's number, an HSN code of the goods this agency is asking about, and
     names a supporting document. If it does not, the student is told what is missing and a DETAILED example (with this
     filing's own details) appears - typing that out is accepted.
   Which Ministries must be cleared is unchanged: it follows the HSN codes declared (and the country / risk rules), and the
   student still picks the Ministry herself/himself.
   Note: a browser can stop paste, drop, right-click and copy; it cannot stop someone retyping from a screenshot - which is still typing.
   ============================================================ */
const PGA_QUERY_DOCS = {
  FSSAI:             { docs: 'the FSSAI import licence / registration of the importer, the FSSAI-recognised laboratory test report and the manufacturer\'s health certificate', re: /fssai|food safety|licen[cs]e|registration|test report|lab|health certificate/i },
  PLANT_QUARANTINE:  { docs: 'the phytosanitary certificate issued by the exporting country, the import permit and the fumigation certificate', re: /phytosanitary|import permit|plant quarantine|fumigation|dppqs|certificate/i },
  DRUG_CONTROLLER:   { docs: 'the CDSCO import licence, the registration certificate and the manufacturer\'s certificate of analysis', re: /cdsco|registration|import licen[cs]e|certificate of analysis|coa|drug|certificate/i },
  BIS:               { docs: 'the BIS CRS registration certificate (R-number) and the test report from a BIS-recognised laboratory', re: /\bbis\b|crs|registration|r-?\d{5,}|test report|licen[cs]e|certificate/i },
  WILDLIFE:          { docs: 'the CITES permit and the certificate of legal acquisition of the goods', re: /cites|wildlife|permit|legal|certificate/i },
  TEXTILE_COMMITTEE: { docs: 'the textile test report and the quality certificate for the fabric', re: /textile|test report|quality|certificate|fibre|fiber|azo/i },
  DGFT_SCOMET:       { docs: 'the SCOMET authorisation / licence together with the end-use and end-user certificate', re: /scomet|authori[sz]ation|licen[cs]e|end[- ]use|end[- ]user|dgft/i },
  MOD_DDP:           { docs: 'the Ministry of Defence NOC / licence together with the end-use certificate', re: /defence|noc|end[- ]use|licen[cs]e|ddp|authori[sz]ation/i },
  DOS_IN_SPACE:      { docs: 'the IN-SPACe authorisation together with the end-use certificate', re: /in-?space|isro|space|satellite|end[- ]use|authori[sz]ation|licen[cs]e/i },
  AERB_DAE:          { docs: 'the AERB licence / authorisation for the radioactive source and the supplier\'s source certificate', re: /aerb|radioactive|licen[cs]e|authori[sz]ation|source|nuclear/i },
  NACWC:             { docs: 'the NACWC registration with the end-use declaration for the scheduled chemical', re: /nacwc|cwc|chemical weapons|schedule|end[- ]use|licen[cs]e|registration|declaration/i },
  DGCA:              { docs: 'the DGCA import permit and the type certificate / RPAS authorisation', re: /dgca|import permit|type certificate|rpas|drone|aircraft|airworth|authori[sz]ation|noc/i },
  PESO:              { docs: 'the PESO licence and the safety data sheet (MSDS) for the hazardous goods', re: /peso|licen[cs]e|safety data|msds|explosive|hazardous|petroleum/i }
};
const PGA_QUERY_GENERIC_RE = /certificate|licen[cs]e|permit|noc|authori[sz]ation|test report|registration/i;

function pgaQueryItems(filing, agency) {
  return (filing.items || []).filter(it => { const m = HS_CODE_TABLE[it.hsCode]; return m && m.pgaAgency === agency; });
}

function pgaQueryExampleShort(filing) {
  const doc = filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry';
  return `Sir/Madam, in reply to your query on ${doc} no. [filing number], I am submitting [name of the supporting document] for the goods covered by HSN [HSN code] ([description of goods]). The goods are [imported / exported] by [party name] for [end use]. Kindly grant the clearance.`;
}

function pgaQueryExampleDetailed(filing, agency) {
  const a = PGA_AGENCIES[agency];
  const d = PGA_QUERY_DOCS[agency] || { docs: 'the supporting licence / certificate for the goods' };
  const items = pgaQueryItems(filing, agency);
  const isExport = filing.type === 'export';
  const party = filing.party || {};
  const who = (isExport ? party.exporterName : party.importerName) || 'the declarant';
  const codes = items.map(it => it.hsCode).join(', ');
  const goods = items.map(it => it.description || (HS_CODE_TABLE[it.hsCode] || {}).desc || 'goods').join(', ');
  const qty = items.map(it => (it.qty || '') + (it.unit ? ' ' + it.unit : '')).filter(Boolean).join(' and ');
  return `Sir/Madam, in reply to your query on ${isExport ? 'Shipping Bill' : 'Bill of Entry'} no. ${filing.id}, I am submitting ${d.docs} for the goods covered by HSN ${codes} (${goods}${qty ? ', quantity ' + qty : ''}). The goods are ${isExport ? 'exported' : 'imported'} by ${who}${party.iec ? ', IEC ' + party.iec : ''}, for ${isExport ? 'sale to our overseas buyer' : 'our own business use'}. Kindly grant the ${a.noc}.`;
}

/* returns [] when the reply is acceptable, otherwise the list of things that are missing */
function pgaCheckQueryReply(filing, agency, text) {
  const t = String(text || '').trim();
  const missing = [];
  if (t.length < 60) missing.push('Write a complete reply to the agency (at least a couple of sentences).');
  const flat = t.toUpperCase().replace(/[\s]+/g, '');
  if (flat.indexOf(String(filing.id).toUpperCase().replace(/[\s]+/g, '')) < 0) missing.push(`Quote this ${filing.type === 'export' ? 'Shipping Bill' : 'Bill of Entry'} number in your reply.`);
  const digits = t.replace(/\D/g, '');
  const codes = pgaQueryItems(filing, agency).map(it => String(it.hsCode).replace(/\D/g, ''));
  if (codes.length && !codes.some(c => digits.indexOf(c) >= 0)) missing.push('Mention the HSN code of the goods this agency is asking about.');
  const d = PGA_QUERY_DOCS[agency];
  if (!((d && d.re.test(t)) || PGA_QUERY_GENERIC_RE.test(t))) missing.push('Name the supporting document you are submitting (for example a licence, certificate or test report).');
  return missing;
}

/* the blocks below keep the example un-copyable and the reply box type-only */
const PGA_NOCOPY = 'oncopy="return false" oncut="return false" oncontextmenu="return false" onselectstart="return false" ondragstart="return false" style="user-select:none;-webkit-user-select:none"';

function pgaQueryReplyHTML(filing, p) {
  const ag = esc(p.agency);
  return `<div class="pgaq">
    <div class="pga-ex" ${PGA_NOCOPY}><b>Example of how to reply</b> <span class="hint-inline">(for format only - you must type your own reply; copy and paste are switched off)</span>
      <div style="margin-top:4px">${esc(pgaQueryExampleShort(filing))}</div></div>
    <textarea id="pgaResp_${ag}" rows="4" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Type your reply to the agency query…"
      onpaste="return pgaBlockPaste(event)" ondrop="return pgaBlockPaste(event)" onbeforeinput="pgaQBeforeInput(this,event)"></textarea>
    <div class="alert alert-error" id="pgaQErr_${ag}" style="display:none;margin:6px 0"></div>
    <div class="pga-ex pga-ex-detail" id="pgaQDetail_${ag}" style="display:none" ${PGA_NOCOPY}><b>Detailed example for this filing</b> <span class="hint-inline">(type it out in the box above - pasting is not allowed)</span>
      <div style="margin-top:4px">${esc(pgaQueryExampleDetailed(filing, p.agency))}</div></div>
    <button class="btn-ghost sm" style="margin-top:6px" onclick="pgaSubmitQueryReply('${esc(filing.id)}','${ag}')">Submit Response</button>
  </div>`;
}

function pgaBlockPaste(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  if (typeof toast === 'function') toast('Pasting is switched off - please type your reply yourself.', 'error');
  return false;
}
function pgaQBeforeInput(el, ev) {
  const t = (ev && ev.inputType) || '';
  if (/^insertFrom|^insertReplacementText|^insertTranspose/.test(t)) { if (ev.preventDefault) ev.preventDefault(); pgaBlockPaste(null); return; }
  if (/^insert(Text|CompositionText|LineBreak|Paragraph)$/.test(t)) el._typed = (el._typed || 0) + (ev.data ? ev.data.length : 1);
}

function pgaSubmitQueryReply(filingId, agency) {
  const filing = getFiling(filingId);
  if (!filing) return;
  const p = (filing.pga || []).find(x => x.agency === agency);
  if (!p || p.status !== 'QUERY') return;
  const ta = document.getElementById('pgaResp_' + agency);
  const err = document.getElementById('pgaQErr_' + agency);
  const detail = document.getElementById('pgaQDetail_' + agency);
  const text = ta ? ta.value.trim() : '';
  const show = lines => { if (err) { err.style.display = 'block'; err.innerHTML = lines.map(esc).join('<br>'); } };
  if (ta && (ta._typed || 0) < text.length * 0.7) { show(['Please type your reply yourself - pasted or auto-filled text is not accepted.']); if (ta) { ta.value = ''; ta._typed = 0; } return; }
  const missing = pgaCheckQueryReply(filing, agency, text);
  if (missing.length) {
    p.queryAttempts = (p.queryAttempts || 0) + 1;
    saveState();
    show(['Your reply was not accepted by ' + PGA_AGENCIES[agency].name + ':'].concat(missing.map(m => '• ' + m)).concat(['A detailed example is shown below - type it out in your own words / as written and submit again.']));
    if (detail) detail.style.display = 'block';
    return;
  }
  respondToPGAQuery(filingId, agency, text);
}

(function pgaInjectCss() {
  if (typeof document === 'undefined' || document.getElementById('pgaqCss')) return;
  const st = document.createElement('style'); st.id = 'pgaqCss';
  st.textContent = '.pga-ex{border:1px dashed #9fb3cf;background:#f5f8fd;border-radius:4px;padding:8px 12px;margin:6px 0 8px;font-size:13px;color:#2b3a52;cursor:default}.pga-ex-detail{background:#fffaf0;border-color:#e0b96a}.pgaq textarea{width:100%}';
  document.head.appendChild(st);
})();
