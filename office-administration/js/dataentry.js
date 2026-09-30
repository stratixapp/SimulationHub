/* =========================================================
   dataentry.js — Data Entry Practice
   Fixed typing passages (a memo, a data row, an email reply)
   timed from the first keystroke, scored on speed (WPM) and
   character accuracy against the original text.
   ========================================================= */

const DATA_ENTRY_PASSAGES = [
  { id: 'DEP1', title: 'Quick Warm-up', level: 'Beginner',
    text: 'Please find attached the agenda for tomorrow\u2019s 10 AM meeting in Conference Room A.' },
  { id: 'DEP2', title: 'Office Memo', level: 'Beginner',
    text: 'All staff are reminded that the office will remain closed on the 15th on account of a public holiday. Please plan your pending work accordingly and inform your reporting manager of any urgent deliverables.' },
  { id: 'DEP3', title: 'Invoice Data Row', level: 'Intermediate',
    text: 'Invoice No: INV-2026-0451, Date: 12-03-2026, Vendor: Om Traders, Amount: Rs. 24,850.00, GSTIN: 27AAAPZ1234C1Z5, Payment Terms: Net 30 Days' },
  { id: 'DEP4', title: 'Client Email Reply', level: 'Intermediate',
    text: 'Dear Mr. Iyer, Thank you for your email. We confirm that your order has been dispatched and should reach you within 3 to 5 business days. Please let us know if you need the tracking number or have any other questions.' },
  { id: 'DEP5', title: 'Full Paragraph', level: 'Advanced',
    text: 'As part of our ongoing effort to improve office efficiency, all departments are requested to submit their monthly expense reports no later than the 5th working day of the following month. Reports submitted after this deadline will be processed only in the subsequent payroll cycle. For any clarification, please reach out to the Accounts & Finance team.' }
];

Modules.dataentry = function(container) {
  const attempts = Store.getDataEntryAttempts();
  const bestFor = (id) => attempts.filter(a => a.passageId === id).sort((a,b) => b.wpm - a.wpm)[0];
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Data Entry Practice</h1><p class="desc">Speed and accuracy both matter in real office data entry. Pick a passage, type it out, and see your Words Per Minute and accuracy — timed from your first keystroke.</p></div>
    </div>
    <div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Passage</th><th>Level</th><th>Your Best</th><th></th></tr></thead>
      <tbody>${DATA_ENTRY_PASSAGES.map(p => {
        const best = bestFor(p.id);
        return `<tr>
          <td>${escapeHtml(p.title)}</td>
          <td><span class="badge">${escapeHtml(p.level)}</span></td>
          <td>${best ? `${best.wpm} WPM &middot; ${best.accuracy}% accuracy` : '—'}</td>
          <td><button class="btn btn-primary btn-sm" onclick="openDataEntryPassage('${p.id}')">${best ? 'Practice Again' : 'Start'}</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div></div>
  `;
};

function openDataEntryPassage(id) {
  const p = DATA_ENTRY_PASSAGES.find(x => x.id === id);
  let startTime = null;
  openModal({
    title: p.title,
    wide: true,
    body: `
      <p style="font-size:13px;line-height:1.6;padding:12px;background:var(--bg-soft);border-radius:8px;user-select:none;">${escapeHtml(p.text)}</p>
      <div class="field" style="margin-top:12px;"><label>Type it here — the timer starts on your first keystroke</label>
        <textarea id="de-input" placeholder="Start typing..." style="min-height:110px;"></textarea>
      </div>
      <p id="de-result" style="font-size:13px;margin-top:10px;"></p>
    `,
    foot: `<button class="btn btn-outline" id="de-cancel">Cancel</button><button class="btn btn-primary" id="de-submit">Submit</button>`
  });
  document.getElementById('de-cancel').onclick = closeModal;
  const input = document.getElementById('de-input');
  input.oninput = () => { if (startTime === null) startTime = Date.now(); };
  input.onpaste = (ev) => { ev.preventDefault(); toast('Pasting is disabled in this exercise. Please type the passage yourself.', 'error'); };
  input.ondrop = (ev) => { ev.preventDefault(); };
  document.getElementById('de-submit').onclick = () => {
    const typed = input.value;
    if (!typed.trim()) return toast('Type the passage first', 'error');
    const elapsedMin = startTime ? Math.max((Date.now() - startTime) / 60000, 0.05) : 0.05;
    const wpm = Math.round((typed.length / 5) / elapsedMin);
    let matches = 0;
    const len = Math.max(p.text.length, typed.length);
    for (let i = 0; i < len; i++) { if (typed[i] === p.text[i]) matches++; }
    const accuracy = Math.max(0, Math.round((matches / p.text.length) * 100));
    const attempt = Store.addDataEntryAttempt({ passageId: id, wpm, accuracy });
    document.getElementById('de-result').innerHTML = `<b>${wpm} WPM</b> &middot; <b>${accuracy}% accuracy</b> — ${accuracy >= 95 ? 'excellent precision.' : accuracy >= 85 ? 'good, but re-check a few characters next time.' : 'accuracy needs work — slow down and re-check as you type.'}`;
    input.disabled = true;
    document.getElementById('de-submit').disabled = true;
  };
}
