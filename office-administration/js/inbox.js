/* =========================================================
   inbox.js — Inbox Management (Email Triage)
   A fixed set of realistic office emails. For each, the student
   must pick the right action — Reply, Escalate, File, or No
   Action Needed — rather than treating every email the same way.
   ========================================================= */

const INBOX_ACTIONS = ['Reply', 'Escalate', 'File', 'No Action Needed'];
const INBOX_ACTION_HELP = {
  'Reply': 'You have what you need to respond or act on this yourself, today.',
  'Escalate': 'This needs a manager\u2019s or another department\u2019s decision — forward it, don\u2019t decide it yourself.',
  'File': 'No reply needed, but keep it for the record.',
  'No Action Needed': 'Purely informational — nothing to do or keep.'
};

const INBOX_EMAILS = [
  { id: 'E1', from: 'Priya Nair (Accounts & Finance)', subject: 'Need last month\u2019s attendance sheet', date: '2 hours ago',
    body: 'Hi, could you share last month\u2019s attendance sheet? We need it for payroll reconciliation by end of day today.',
    correctAction: 'Reply', why: 'You can pull this from Attendance and send it yourself — no one else\u2019s decision is needed.' },
  { id: 'E2', from: 'Om Traders (Vendor)', subject: 'Invoice #4521 overdue — 45 days', date: '1 day ago',
    body: 'This is a reminder that Invoice #4521 for stationery supplies has been unpaid for 45 days. Please clear it at the earliest, or we may have to pause further supply.',
    correctAction: 'Escalate', why: 'Releasing vendor payment isn\u2019t an admin call to make alone — forward it to Accounts/your manager.' },
  { id: 'E3', from: 'OfficeTips Weekly (Newsletter)', subject: '5 Excel shortcuts every office worker should know', date: '3 days ago',
    body: 'This week: five keyboard shortcuts to speed up your spreadsheet work, plus a reader Q&A.',
    correctAction: 'No Action Needed', why: 'A subscription newsletter — nothing to do or keep.' },
  { id: 'E4', from: 'Suresh Nambiar (Sales Manager)', subject: 'Urgent: client meeting moved to 3 PM today', date: '20 minutes ago',
    body: 'The Orion Logistics meeting has moved from 5 PM to 3 PM today. Please block the Conference Room and let Aditi and Karan know.',
    correctAction: 'Reply', why: 'Room booking and notifying two colleagues are both things you can do yourself, right now.' },
  { id: 'E5', from: 'Divya Iyer (Customer Support)', subject: 'Uncomfortable with how a colleague spoke to me', date: '5 hours ago',
    body: 'I wanted to flag that a colleague spoke to me in a way that made me uncomfortable in front of the team yesterday. Not sure who I should be telling this to.',
    correctAction: 'Escalate', why: 'A conduct/harassment concern always goes to HR or a manager — never handle this solo or sit on it.' },
  { id: 'E6', from: 'ShipFast Couriers', subject: 'Delivered: your parcel to Zenith Facilities Mgmt', date: '1 day ago',
    body: 'Your parcel (AWB 88213456) was delivered to Zenith Facilities Management at 11:42 AM today. Signed for by: Security Desk.',
    correctAction: 'File', why: 'A delivery confirmation — no reply needed, but worth keeping as proof of dispatch.' },
  { id: 'E7', from: 'Farhan Sheikh (Job Applicant)', subject: 'Following up on my Guest Relations Executive application', date: '6 hours ago',
    body: 'I applied for the Guest Relations Executive role two weeks ago and wanted to check on my application status. Happy to share any additional information needed.',
    correctAction: 'Reply', why: 'A courteous status update costs you nothing and keeps a good candidate\u2019s experience positive.' },
  { id: 'E8', from: 'accounts-verify@secure-payroll-alert.net', subject: 'ACTION REQUIRED: Your account will be suspended', date: '10 minutes ago',
    body: 'We detected unusual activity. Click here within 24 hours to verify your account or it will be permanently suspended.',
    correctAction: 'Escalate', why: 'Classic phishing signs (urgency, mismatched sender domain, a click-here link) — report it to IT/security, never click through yourself.' },
  { id: 'E9', from: 'Head Office HR', subject: 'Revised Leave Policy — effective next month', date: '2 days ago',
    body: 'Please find attached the revised leave policy, effective from the 1st of next month. Circulate to all staff and retain for your records.',
    correctAction: 'File', why: 'An official policy update to keep on record — not something you personally reply to.' },
  { id: 'E10', from: 'IT & Systems (CC\u2019d)', subject: 'FYI: office WiFi upgrade this weekend', date: '4 hours ago',
    body: 'Heads up — the office WiFi will be upgraded this Saturday between 10 AM and 1 PM. You were CC\u2019d for awareness; no action needed from your side.',
    correctAction: 'No Action Needed', why: 'You were CC\u2019d purely for awareness — the email says so itself.' },
  { id: 'E11', from: 'Karan Malhotra (Procurement)', subject: 'Vendor quote for the new printer — need budget sign-off', date: '3 hours ago',
    body: 'Got a quotation for the new office printer (\u20b942,000). Can you confirm if this fits this quarter\u2019s admin budget before I raise the PO?',
    correctAction: 'Escalate', why: 'Budget sign-off sits above an admin executive\u2019s own authority — pass it up before a PO is raised.' },
  { id: 'E12', from: 'Dr. Meena Kapoor (Guest Speaker)', subject: 'Thank you for having me!', date: '1 day ago',
    body: 'Just wanted to say thank you again for hosting me — I\u2019d be glad to come back and speak anytime.',
    correctAction: 'Reply', why: 'A warm, quick acknowledgment is the professional courtesy here.' }
];

Modules.inbox = function(container) {
  const attempts = Store.getInboxAttempts();
  const done = INBOX_EMAILS.filter(e => attempts[e.id]).length;
  const correct = INBOX_EMAILS.filter(e => attempts[e.id] && attempts[e.id].correct).length;
  container.innerHTML = `
    <div class="page-head">
      <div><div class="eyebrow">General Office Skills</div><h1>Inbox Management</h1><p class="desc">A real inbox mixes urgent requests, routine confirmations, newsletters and the occasional phishing attempt. Open each item and choose the right action — don\u2019t just reply to everything.</p></div>
      <div class="page-actions"><span class="badge">${done}/${INBOX_EMAILS.length} actioned &middot; ${correct} correct</span></div>
    </div>
    <div class="card"><div class="table-wrap"><table class="data-table">
      <thead><tr><th>From</th><th>Subject</th><th>Received</th><th>Status</th><th></th></tr></thead>
      <tbody>${INBOX_EMAILS.map(e => {
        const a = attempts[e.id];
        return `<tr>
          <td>${escapeHtml(e.from)}</td>
          <td>${escapeHtml(e.subject)}</td>
          <td>${escapeHtml(e.date)}</td>
          <td>${a ? `<span class="badge ${a.correct ? 'badge-approved' : 'badge-rejected'}">${a.correct ? '&#10003; ' + escapeHtml(a.action) : '&#10007; Marked ' + escapeHtml(a.action)}</span>` : `<span class="badge">Unread</span>`}</td>
          <td><button class="btn btn-outline btn-sm" onclick="openInboxEmail('${e.id}')">${a ? 'Review' : 'Open'}</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div></div>
  `;
};

function openInboxEmail(id) {
  const e = INBOX_EMAILS.find(x => x.id === id);
  const attempt = Store.getInboxAttempts()[id];
  openModal({
    title: e.subject,
    wide: true,
    body: `
      <p style="font-size:12.5px;"><b>From:</b> ${escapeHtml(e.from)} &nbsp; <b>Received:</b> ${escapeHtml(e.date)}</p>
      <p style="font-size:13px;white-space:pre-wrap;margin-top:10px;padding:12px;background:var(--bg-soft);border-radius:8px;">${escapeHtml(e.body)}</p>
      <div class="field" style="margin-top:14px;"><label>What should you do with this?</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${INBOX_ACTIONS.map(a => `<button class="btn ${attempt && attempt.action === a ? 'btn-primary' : 'btn-outline'} btn-sm" data-inbox-action="${a}" title="${escapeHtml(INBOX_ACTION_HELP[a])}">${a}</button>`).join('')}
        </div>
      </div>
      <div id="inbox-reply-wrap" class="field" style="margin-top:10px;${attempt && attempt.action === 'Reply' ? '' : 'display:none;'}">
        <label>Your reply (if action is Reply)</label>
        <textarea id="inbox-reply-text" placeholder="Write a short reply...">${escapeHtml((attempt && attempt.replyText) || '')}</textarea>
        <button class="btn btn-primary btn-sm" id="inbox-reply-send" style="margin-top:8px;">Send Reply</button>
      </div>
      ${attempt ? `<p style="font-size:12px;margin-top:12px;"><b style="color:${attempt.correct ? 'var(--success,#1a8a4a)' : 'var(--danger,#c0392b)'};">${attempt.correct ? '\u2713 Correct.' : '\u2717 Not quite.'}</b> ${escapeHtml(e.why)}</p>` : ''}
    `,
    foot: `<button class="btn btn-outline" id="ib-close">Close</button>`
  });
  document.getElementById('ib-close').onclick = closeModal;
  document.querySelectorAll('[data-inbox-action]').forEach(btn => {
    btn.onclick = () => {
      const action = btn.dataset.inboxAction;
      const replyWrap = document.getElementById('inbox-reply-wrap');
      if (action === 'Reply') { replyWrap.style.display = ''; return; }
      Store.recordInboxAction(id, action, '');
      closeModal(); openInboxEmail(id);
    };
  });
  const replyBox = document.getElementById('inbox-reply-text');
  const sendBtn = document.getElementById('inbox-reply-send');
  if (replyBox && sendBtn) {
    sendBtn.onclick = () => {
      const text = replyBox.value.trim();
      if (!text) return toast('Write your reply before sending', 'error');
      Store.recordInboxAction(id, 'Reply', text); closeModal(); openInboxEmail(id);
    };
  }
}
