/* =========================================================
   dayplanner.js — Day Planner (Interruption Simulator)
   A simulated day where things keep landing on your desk. For
   each, the student sorts it into one of the four classic
   prioritization quadrants (urgent/important) instead of just
   reacting to whatever arrived most recently.
   ========================================================= */

const PLANNER_QUADRANTS = ['Do First', 'Schedule', 'Delegate', 'Eliminate'];
const PLANNER_QUADRANT_HELP = {
  'Do First': 'Urgent AND important — drop what you\u2019re doing.',
  'Schedule': 'Important, but not urgent — block time for it, don\u2019t do it right now.',
  'Delegate': 'Urgent, but not really yours to own — hand it off.',
  'Eliminate': 'Neither urgent nor important — let it go.'
};

const DAY_PLANNER_EVENTS = [
  { id: 'P1', time: '9:05 AM', text: 'The MD calls asking for the board report you\u2019re already working on — needed within the hour.',
    correctQuadrant: 'Do First', why: 'A same-hour deadline from the MD on core work is both urgent and important.' },
  { id: 'P2', time: '9:20 AM', text: 'A reminder pops up: your own annual performance appraisal review is scheduled for next month.',
    correctQuadrant: 'Schedule', why: 'Matters for your career, but nothing needs doing about it today.' },
  { id: 'P3', time: '9:40 AM', text: 'A colleague asks you to quickly photocopy some documents for a meeting they\u2019re about to walk into.',
    correctQuadrant: 'Delegate', why: 'Urgent for them, but a photocopying task isn\u2019t something that needs your specific judgment — hand it to available support staff.' },
  { id: 'P4', time: '10:00 AM', text: 'A colleague shares a funny meme in the office group chat.',
    correctQuadrant: 'Eliminate', why: 'Pleasant, but has no bearing on any deadline or outcome.' },
  { id: 'P5', time: '10:15 AM', text: 'The office printer jams and three people are waiting on it, visibly annoyed.',
    correctQuadrant: 'Delegate', why: 'Genuinely urgent for the office, but fixing a jammed printer isn\u2019t the best use of an admin executive\u2019s time — call IT support or a junior colleague.' },
  { id: 'P6', time: '10:45 AM', text: 'You need to plan next quarter\u2019s training calendar for the team — nothing due this week.',
    correctQuadrant: 'Schedule', why: 'Important for the team\u2019s development, but there\u2019s no deadline pressing today.' },
  { id: 'P7', time: '11:10 AM', text: 'A client calls, visibly upset, saying their shipment hasn\u2019t arrived and they need an answer right now.',
    correctQuadrant: 'Do First', why: 'An upset client with an unresolved issue is both time-critical and high-stakes for the business.' },
  { id: 'P8', time: '11:30 AM', text: 'An old newsletter subscription email arrives about office interior design trends.',
    correctQuadrant: 'Eliminate', why: 'Purely informational, with no task or deadline attached.' },
  { id: 'P9', time: '11:50 AM', text: 'Your manager asks you to review and approve tomorrow\u2019s payroll run before you leave today.',
    correctQuadrant: 'Do First', why: 'A same-day deadline on something that directly affects everyone\u2019s salary is both urgent and important.' },
  { id: 'P10', time: '12:15 PM', text: 'A vendor invites you to a free lunch seminar next month, no obligation to attend.',
    correctQuadrant: 'Eliminate', why: 'Low-stakes, optional, and a month away — not worth planning around right now.' }
];

Modules.dayplanner = function(container) {
  const attempts = Store.getDayPlannerAttempts();
  const done = DAY_PLANNER_EVENTS.filter(e => attempts[e.id]).length;
  const correct = DAY_PLANNER_EVENTS.filter(e => attempts[e.id] && attempts[e.id].correct).length;
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Day Planner — Interruption Simulator</h1><p class="desc">Ten things land on your desk over one morning. Sort each into <b>Do First</b>, <b>Schedule</b>, <b>Delegate</b> or <b>Eliminate</b> — the classic urgent/important matrix — instead of just handling things in the order they arrived.</p></div>
      <div class="page-actions"><span class="badge">${done}/${DAY_PLANNER_EVENTS.length} sorted &middot; ${correct} correct</span></div>
    </div>
    <div class="card" style="margin-bottom:14px;"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;padding:14px 18px;font-size:12px;">
      ${PLANNER_QUADRANTS.map(q => `<div><b>${q}</b><br><span style="color:var(--text-dim);">${PLANNER_QUADRANT_HELP[q]}</span></div>`).join('')}
    </div></div>
    <div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>Time</th><th>What lands on your desk</th><th>Your call</th><th></th></tr></thead>
      <tbody>${DAY_PLANNER_EVENTS.map(e => {
        const a = attempts[e.id];
        return `<tr>
          <td style="white-space:nowrap;">${escapeHtml(e.time)}</td>
          <td>${escapeHtml(e.text)}${a ? `<br><span style="font-size:11.5px;color:${a.correct ? 'var(--success,#1a8a4a)' : 'var(--danger,#c0392b)'};">${a.correct ? '\u2713' : '\u2717'} ${escapeHtml(e.why)}</span>` : ''}</td>
          <td>${a ? `<span class="badge ${a.correct ? 'badge-approved' : 'badge-rejected'}">${escapeHtml(a.quadrant)}</span>` : `<div style="display:flex;gap:6px;flex-wrap:wrap;">${PLANNER_QUADRANTS.map(q => `<button class="btn btn-outline btn-sm" onclick="sortPlannerEvent('${e.id}','${q}')">${q}</button>`).join('')}</div>`}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div></div>
  `;
};

function sortPlannerEvent(id, quadrant) {
  const result = Store.recordPlannerQuadrant(id, quadrant);
  toast(result.correct ? '\u2713 Good call' : '\u2717 Not quite — see the note below it', result.correct ? 'success' : 'error');
  navigate('dayplanner');
}
