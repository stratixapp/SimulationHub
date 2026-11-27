/* =========================================================================
   SKELORA INSTITUTE - CERTIFICATION EXAMS (engine + screens)
   5 exams x 50 multiple-choice questions (questions: exam-bank.js)
     - marking: +2 for a correct answer, -0.66 for a wrong answer, 0 for an unanswered question  (exam = 100 marks)
     - difficulty: Exam 1 Easy, Exam 2 Medium, Exam 3 Tough, Exam 4 Hard, Exam 5 Hard; taken in order
     - timer: CFG.minutes of ACTIVE exam time. It only runs while the exam is open on screen: closing the browser, switching tab
       or going to another page stops the clock, and the student carries on the next day with the time that is left.
       Answers are saved on every click, so nothing is lost.
     - marks and the full question-by-question review are shown only AFTER an exam is submitted. One attempt per exam.
     - after the 5th exam the average of the five exam scores (a negative exam counts as 0) is issued as a certificate
       (certificate.js) with the student's name and the date of issue.
   Everything is stored in this browser under skelora_exam_v1_<user id>.
   ========================================================================= */
(function (global) {
  "use strict";

  const CFG = { count: 50, correct: 2, wrong: 0.66, minutes: 60, saveMs: 4000,
    levels: ["Easy", "Medium", "Tough", "Hard", "Hard"],
    blurb: ["Core terms and basic documents", "Applied knowledge across modes and documents", "Conceptual depth and trade finance", "Advanced trade law, valuation and planning", "Advanced operations, strategy and compliance"] };
  const KEY = "skelora_exam_v1_";
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  const r2 = function (x) { return Math.round(x * 100) / 100; };
  const fmtMarks = function (x) { return (x < 0 ? "−" : "") + String(Math.abs(r2(x))); };
  const fmtTime = function (ms) { ms = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(ms / 3600), m = Math.floor((ms % 3600) / 60), s = ms % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); };
  const fmtDur = function (ms) { ms = Math.round(ms / 1000); const m = Math.floor(ms / 60), s = ms % 60; return m + " min " + String(s).padStart(2, "0") + " s"; };

  let S = { root: null, user: null, st: null, view: "list", n: 0, tick: null, last: 0, lastSave: 0, certCanvas: null, busy: false };

  /* ---------------- storage ---------------- */
  function uid() { return (S.user && S.user.id) || "guest"; }
  function load() {
    try { const j = JSON.parse(localStorage.getItem(KEY + uid())); if (j && j.exams) return j; } catch (e) { /* fresh */ }
    return { v: 1, exams: {}, cert: null };
  }
  function save() { try { localStorage.setItem(KEY + uid(), JSON.stringify(S.st)); } catch (e) { /* storage full / blocked */ } }

  /* ---------------- helpers ---------------- */
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function bank(n) { return (global.SK_EXAM_BANK && global.SK_EXAM_BANK[n]) || []; }
  function ex(n) { return S.st.exams[n] || null; }
  function status(n) { const e = ex(n); return e ? e.status : "not_started"; }
  function unlocked(n) { return n === 1 || status(n - 1) === "completed"; }
  function completedCount() { let c = 0; for (let n = 1; n <= 5; n++) if (status(n) === "completed") c++; return c; }

  function newAttempt(n) {
    const rand = rng(hash(uid() + "|exam|" + n + "|" + Date.now()));
    const order = shuffle(bank(n).map(function (_, i) { return i; }), rand);
    const perm = order.map(function () { return shuffle([0, 1, 2, 3], rand); });   // display position -> original option index (0 = the correct one)
    return { status: "in_progress", startedAt: new Date().toISOString(), elapsedMs: 0, order: order, perm: perm, answers: order.map(function () { return null; }), flags: {}, cur: 0 };
  }

  function score(n) {
    const e = ex(n), b = bank(n);
    let c = 0, w = 0, u = 0;
    e.order.forEach(function (qi, pos) {
      const a = e.answers[pos];
      if (a === null || a === undefined) { u++; return; }
      (e.perm[pos][a] === 0) ? c++ : w++;
    });
    const marks = r2(c * CFG.correct - w * CFG.wrong);
    return { correct: c, wrong: w, unanswered: u, marks: marks, max: b.length * CFG.correct, pct: Math.max(0, r2(marks / (b.length * CFG.correct) * 100)) };
  }

  function average() {
    let sum = 0;
    for (let n = 1; n <= 5; n++) sum += (ex(n) && ex(n).result) ? ex(n).result.pct : 0;
    return r2(sum / 5);
  }

  /* ---------------- timer ---------------- */
  function stopTimer(persist) {
    if (S.tick) { clearInterval(S.tick); S.tick = null; }
    if (persist !== false && S.st) save();
  }
  function startTimer() {
    stopTimer(false);
    S.last = Date.now(); S.lastSave = S.last;
    S.tick = setInterval(function () {
      const e = ex(S.n);
      if (S.view !== "take" || !e || e.status !== "in_progress") { stopTimer(); return; }
      const now = Date.now();
      if (document.hidden) { S.last = now; return; }                 // tab in the background: clock paused
      e.elapsedMs += Math.min(now - S.last, 2000);                   // a sleeping laptop must not burn the exam time
      S.last = now;
      if (now - S.lastSave >= CFG.saveMs) { save(); S.lastSave = now; }
      paintTimer();
      if (remaining(e) <= 0) submit(true);
    }, 1000);
  }
  function remaining(e) { return CFG.minutes * 60000 - e.elapsedMs; }
  function paintTimer() {
    const e = ex(S.n); if (!e) return;
    const el = document.getElementById("exTimer"); if (!el) return;
    const rem = remaining(e);
    el.textContent = fmtTime(rem);
    el.parentNode.className = "ex-timer" + (rem < 5 * 60000 ? " danger" : rem < 10 * 60000 ? " warn" : "");
  }

  /* ---------------- styles ---------------- */
  function css() {
    if (document.getElementById("exCss")) return;
    const st = document.createElement("style"); st.id = "exCss";
    st.textContent = [
      ".ex-wrap{max-width:1180px;margin:0 auto}",
      ".ex-hero{position:relative;overflow:hidden;border-radius:18px;padding:28px 30px;color:#fff;background:linear-gradient(120deg,#0B2A4A 0%,#12467D 55%,#1F6FEB 100%);box-shadow:0 18px 40px rgba(11,42,74,.25)}",
      ".ex-hero:after{content:'';position:absolute;right:-60px;top:-60px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.18),transparent 65%)}",
      ".ex-hero h1{margin:0 0 6px;font-size:26px;letter-spacing:-.01em;color:#fff}.ex-hero p{margin:0;color:#D6E4F8;max-width:640px;font-size:14px;line-height:1.55}",
      ".ex-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.ex-chip{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);border-radius:20px;padding:5px 12px;font-size:12px;font-weight:600}",
      ".ex-prog{display:flex;align-items:center;gap:14px;margin-top:18px}.ex-bar{flex:1;height:8px;border-radius:6px;background:rgba(255,255,255,.2);overflow:hidden;max-width:360px}.ex-bar i{display:block;height:100%;background:linear-gradient(90deg,#7FF0FF,#fff);border-radius:6px}",
      ".ex-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin:20px 0}",
      ".ex-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:8px;box-shadow:var(--shadow-sm);transition:transform .15s,box-shadow .15s}",
      ".ex-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}.ex-card.locked{opacity:.6}",
      ".ex-no{font-size:12px;font-weight:700;color:var(--text-3);letter-spacing:.06em;text-transform:uppercase}.ex-card h3{margin:0;font-size:17px;color:var(--text-1)}",
      ".ex-lvl{align-self:flex-start;font-size:11.5px;font-weight:700;padding:3px 10px;border-radius:20px}.ex-lvl.l0{background:#E7F6ED;color:#15803D}.ex-lvl.l1{background:#E3F4F7;color:#0891B2}.ex-lvl.l2{background:#FBF1DE;color:#B8790A}.ex-lvl.l3,.ex-lvl.l4{background:#FBEAE9;color:#C6362F}",
      ".ex-meta{font-size:12.5px;color:var(--text-2);line-height:1.5;flex:1}",
      ".ex-score{font-size:24px;font-weight:800;color:var(--navy)}.ex-sub{font-size:12px;color:var(--text-3)}",
      ".ex-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:9px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer;background:var(--navy);color:#fff}.ex-btn:disabled{background:var(--border-strong);cursor:not-allowed;color:var(--text-3)}",
      ".ex-btn.alt{background:var(--surface);color:var(--navy);border:1px solid var(--border-strong)}.ex-btn.go{background:var(--accent)}.ex-btn.bad{background:var(--red)}",
      ".ex-panel{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px;margin-bottom:16px;box-shadow:var(--shadow-sm)}",
      ".ex-panel h3{margin:0 0 8px;font-size:16px}.ex-rules{margin:0;padding-left:18px;color:var(--text-2);font-size:13px;line-height:1.7}",
      ".ex-top{position:sticky;top:64px;z-index:20;display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:10px 16px;margin-bottom:14px;box-shadow:var(--shadow-sm)}",
      ".ex-top h2{margin:0;font-size:16px}.ex-top .sp{flex:1}.ex-timer{display:flex;align-items:baseline;gap:8px;padding:6px 14px;border-radius:10px;background:var(--accent-soft);color:var(--navy);font-weight:700}",
      ".ex-timer b{font-size:22px;font-variant-numeric:tabular-nums}.ex-timer small{font-size:11px;font-weight:600;color:var(--text-2)}.ex-timer.warn{background:var(--amber-soft);color:var(--amber)}.ex-timer.danger{background:var(--red-soft);color:var(--red)}",
      ".ex-body{display:grid;grid-template-columns:1fr 280px;gap:16px}@media(max-width:900px){.ex-body{grid-template-columns:1fr}.ex-top{top:56px}}",
      ".ex-q{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;box-shadow:var(--shadow-sm)}",
      ".ex-qh{font-size:12px;font-weight:700;color:var(--text-3);letter-spacing:.05em;text-transform:uppercase;display:flex;justify-content:space-between}",
      ".ex-qt{font-size:17px;line-height:1.55;margin:10px 0 16px;color:var(--text-1);font-weight:600}",
      ".ex-opt{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;background:var(--surface-alt);border:1.5px solid var(--border);border-radius:11px;padding:12px 14px;margin-bottom:10px;cursor:pointer;color:var(--text-1);font-size:14.5px;line-height:1.5}",
      ".ex-opt:hover{border-color:var(--accent);background:var(--accent-soft)}.ex-opt.sel{border-color:var(--accent);background:var(--accent-soft);box-shadow:0 0 0 3px rgba(31,111,235,.12)}",
      ".ex-opt .k{flex:none;width:26px;height:26px;border-radius:50%;border:1.5px solid var(--border-strong);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12.5px;color:var(--text-2);background:var(--surface)}",
      ".ex-opt.sel .k{background:var(--accent);border-color:var(--accent);color:#fff}",
      ".ex-nav{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;align-items:center}.ex-nav .sp{flex:1}",
      ".ex-map{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;box-shadow:var(--shadow-sm);align-self:start;position:sticky;top:132px}@media(max-width:900px){.ex-map{position:static}}",
      ".ex-map h4{margin:0 0 10px;font-size:13px}.ex-cells{display:grid;grid-template-columns:repeat(10,1fr);gap:5px}",
      ".ex-cell{aspect-ratio:1;border-radius:7px;border:1px solid var(--border);background:var(--surface-alt);font-size:11.5px;font-weight:700;color:var(--text-2);cursor:pointer;padding:0}",
      ".ex-cell.ans{background:#DCEBFF;border-color:#9CC3FA;color:var(--navy)}.ex-cell.flag{background:var(--amber-soft);border-color:#E8C27A;color:var(--amber)}.ex-cell.cur{outline:2px solid var(--navy);outline-offset:1px}",
      ".ex-key{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;font-size:11.5px;color:var(--text-2)}.ex-key i{display:inline-block;width:11px;height:11px;border-radius:3px;border:1px solid var(--border-strong);vertical-align:-1px;margin-right:4px}",
      ".ex-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0}.ex-stat{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px}",
      ".ex-stat b{display:block;font-size:24px;color:var(--navy)}.ex-stat span{font-size:12px;color:var(--text-2)}.ex-stat.g b{color:var(--green)}.ex-stat.r b{color:var(--red)}",
      ".ex-rv{border:1px solid var(--border);border-left-width:4px;border-radius:10px;padding:12px 14px;margin-bottom:10px;background:var(--surface)}.ex-rv.ok{border-left-color:var(--green)}.ex-rv.no{border-left-color:var(--red)}.ex-rv.na{border-left-color:var(--text-3)}",
      ".ex-rv h5{margin:0 0 8px;font-size:14px;line-height:1.45}.ex-rv .o{font-size:13px;padding:5px 9px;border-radius:7px;margin:3px 0;color:var(--text-2)}.ex-rv .o.good{background:var(--green-soft);color:var(--green);font-weight:700}.ex-rv .o.bad{background:var(--red-soft);color:var(--red);font-weight:700}",
      ".ex-tag{font-size:11.5px;font-weight:700;margin-left:8px}.ex-tag.ok{color:var(--green)}.ex-tag.no{color:var(--red)}.ex-tag.na{color:var(--text-3)}",
      ".ex-cert{display:grid;grid-template-columns:minmax(220px,340px) 1fr;gap:22px;align-items:start}@media(max-width:760px){.ex-cert{grid-template-columns:1fr}}",
      ".ex-cert canvas{width:100%;height:auto;border-radius:10px;box-shadow:0 12px 30px rgba(11,42,74,.25)}",
      ".ex-table{width:100%;border-collapse:collapse;font-size:13px}.ex-table th,.ex-table td{padding:7px 10px;border-bottom:1px solid var(--border);text-align:left}",
      ".ex-modal{position:fixed;inset:0;z-index:300;background:rgba(10,24,48,.6);display:flex;align-items:center;justify-content:center;padding:16px}.ex-dlg{background:var(--surface);color:var(--text-1);border-radius:14px;max-width:440px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.4)}",
      ".ex-dlg h3{margin:0 0 8px}.ex-dlg p{color:var(--text-2);font-size:14px;line-height:1.55}.ex-dlg .row{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}"
    ].join("\n");
    document.head.appendChild(st);
  }

  /* ---------------- rendering ---------------- */
  function render() {
    if (!S.root) return;
    css();
    if (S.view === "take") renderTake();
    else if (S.view === "result") renderResult();
    else renderList();
  }

  function renderList() {
    stopTimer();
    const done = completedCount();
    let h = '<div class="ex-wrap"><div class="ex-hero"><h1>Certification Exams</h1>' +
      '<p>Five exams that cover the whole of logistics and supply chain management, including export and import documentation. Finish all five and your average score is issued as a certificate in your name.</p>' +
      '<div class="ex-chips"><span class="ex-chip">5 exams</span><span class="ex-chip">' + CFG.count + ' questions each</span><span class="ex-chip">4 options</span><span class="ex-chip">+' + CFG.correct + ' correct</span><span class="ex-chip">−' + CFG.wrong + ' wrong</span><span class="ex-chip">' + CFG.minutes + ' min active time</span></div>' +
      '<div class="ex-prog"><div class="ex-bar"><i style="width:' + (done / 5 * 100) + '%"></i></div><b>' + done + ' of 5 completed</b></div></div>';
    h += '<div class="ex-grid">';
    for (let n = 1; n <= 5; n++) h += examCard(n);
    h += '</div>';
    h += '<div class="ex-panel"><h3>How the exams work</h3><ul class="ex-rules">' +
      '<li>Each exam has <b>' + CFG.count + ' questions</b> with <b>4 options</b>. A correct answer gives <b>+' + CFG.correct + '</b> marks, a wrong answer takes away <b>' + CFG.wrong + '</b>, and an unanswered question scores 0. Each exam is out of <b>' + (CFG.count * CFG.correct) + '</b>.</li>' +
      '<li>The difficulty rises exam by exam: Easy, Medium, Tough, Hard, Hard. Exam 2 opens after Exam 1, and so on.</li>' +
      '<li>You have <b>' + CFG.minutes + ' minutes</b> per exam. The clock runs <b>only while the exam is open on your screen</b>. If you close the browser or leave, it stops, and you continue later, even the next day, with the time that is left. Your answers are saved as you go.</li>' +
      '<li>Your marks and the correct answers are shown <b>after you submit</b> each exam. Each exam can be taken once.</li>' +
      '<li>After the fifth exam, the <b>average of your five scores</b> is printed on your certificate with your name and the date.</li></ul></div>';
    h += certPanel();
    h += '</div>';
    S.root.innerHTML = h;
    S.root.querySelectorAll("[data-ex-start]").forEach(function (b) { b.addEventListener("click", function () { startExam(+b.getAttribute("data-ex-start")); }); });
    S.root.querySelectorAll("[data-ex-result]").forEach(function (b) { b.addEventListener("click", function () { S.n = +b.getAttribute("data-ex-result"); S.view = "result"; render(); window.scrollTo({ top: 0 }); }); });
    afterCert();
  }

  function examCard(n) {
    const e = ex(n), st = status(n), lock = !unlocked(n);
    let body, btn;
    if (st === "completed") {
      body = '<div class="ex-score">' + fmtMarks(e.result.marks) + '<span class="ex-sub"> / ' + e.result.max + '</span></div><div class="ex-sub">' + e.result.correct + ' correct · ' + e.result.wrong + ' wrong · ' + e.result.pct + '%</div>';
      btn = '<button class="ex-btn alt" data-ex-result="' + n + '">View marks &amp; answers</button>';
    } else if (st === "in_progress") {
      const ans = e.answers.filter(function (a) { return a !== null && a !== undefined; }).length;
      body = '<div class="ex-meta">In progress: ' + ans + ' of ' + CFG.count + ' answered.<br>Time left: <b>' + fmtTime(remaining(e)) + '</b></div>';
      btn = '<button class="ex-btn go" data-ex-start="' + n + '">Resume exam</button>';
    } else {
      body = '<div class="ex-meta">' + esc(CFG.blurb[n - 1]) + '<br>' + CFG.count + ' questions · ' + (CFG.count * CFG.correct) + ' marks · ' + CFG.minutes + ' min</div>';
      btn = lock ? '<button class="ex-btn" disabled>Locked: finish Exam ' + (n - 1) + ' first</button>' : '<button class="ex-btn" data-ex-start="' + n + '">Start exam</button>';
    }
    return '<div class="ex-card' + (lock ? ' locked' : '') + '"><div class="ex-no">Exam ' + n + '</div><h3>' + esc(CFG.levels[n - 1]) + ' level</h3><span class="ex-lvl l' + (n - 1) + '">' + esc(CFG.levels[n - 1]) + '</span>' + body + btn + '</div>';
  }

  function certPanel() {
    const done = completedCount();
    if (done < 5) return '<div class="ex-panel"><h3>Your certificate</h3><p style="margin:0;color:var(--text-2);font-size:13.5px">Complete all 5 exams to receive your Certificate of Completion with your average score. ' + done + ' of 5 done.</p></div>';
    let rows = '';
    for (let n = 1; n <= 5; n++) rows += '<tr><td>Exam ' + n + ' (' + esc(CFG.levels[n - 1]) + ')</td><td>' + fmtMarks(ex(n).result.marks) + ' / ' + ex(n).result.max + '</td><td>' + ex(n).result.pct + '%</td></tr>';
    return '<div class="ex-panel"><h3>🎓 Your certificate is ready</h3><div class="ex-cert"><div><canvas id="exCertCv" width="1055" height="1491" aria-label="Certificate preview"></canvas></div><div>' +
      '<p style="margin-top:0;color:var(--text-2);font-size:14px">Average score of your 5 exams: <b style="font-size:20px;color:var(--navy)">' + average() + '%</b></p>' +
      '<table class="ex-table"><thead><tr><th>Exam</th><th>Marks</th><th>Score</th></tr></thead><tbody>' + rows + '<tr><td><b>Average</b></td><td></td><td><b>' + average() + '%</b></td></tr></tbody></table>' +
      '<p class="ex-sub" style="margin:10px 0">The name on the certificate is taken from your profile: <b>' + esc(displayName()) + '</b>. Certificate no. ' + esc(S.st.cert ? S.st.cert.no : '') + '.</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="ex-btn go" id="exPdf">⬇ Download PDF</button><button class="ex-btn alt" id="exPng">⬇ Download image (PNG)</button></div><div id="exCertMsg" class="ex-sub" style="margin-top:8px"></div></div></div></div>';
  }

  function displayName() { return ((S.user && S.user.name) || "Student").trim(); }

  function afterCert() {
    const cv = document.getElementById("exCertCv");
    if (!cv || !global.SkExamCert || !S.st.cert) return;
    const msg = document.getElementById("exCertMsg");
    const opts = { name: displayName(), avg: S.st.cert.avg, certNo: S.st.cert.no, date: S.st.cert.issuedAt };
    global.SkExamCert.render(opts).then(function (canvas) {
      S.certCanvas = canvas;
      const ctx = cv.getContext("2d"); ctx.drawImage(canvas, 0, 0);
    }).catch(function (e) { if (msg) msg.textContent = "The certificate preview could not be drawn: " + e.message; });
    const fname = "Skelora-Logistics-Exam-Certificate-" + displayName().replace(/[^a-zA-Z0-9]+/g, "-");
    const png = document.getElementById("exPng"), pdf = document.getElementById("exPdf");
    function ready(cb) { if (S.certCanvas) return cb(S.certCanvas); global.SkExamCert.render(opts).then(function (c) { S.certCanvas = c; cb(c); }).catch(function (e) { if (msg) msg.textContent = "Could not create the certificate: " + e.message; }); }
    if (png) png.addEventListener("click", function () { ready(function (c) { try { const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = fname + ".png"; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { if (msg) msg.textContent = "Download failed: " + e.message; } }); });
    if (pdf) pdf.addEventListener("click", function () {
      ready(function (c) {
        try {
          const J = global.jspdf && global.jspdf.jsPDF; if (!J) throw new Error("PDF library not loaded");
          const doc = new J({ unit: "mm", format: "a4", orientation: "portrait" });
          doc.addImage(c.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297);
          doc.save(fname + ".pdf");
        } catch (e) { if (msg) msg.textContent = "Download failed: " + e.message; }
      });
    });
  }

  /* ---------------- taking an exam ---------------- */
  function startExam(n) {
    if (!unlocked(n) || status(n) === "completed") return;
    if (!bank(n).length) { alert("The question bank did not load."); return; }
    if (!ex(n)) { S.st.exams[n] = newAttempt(n); save(); }
    S.n = n; S.view = "take"; render(); startTimer(); window.scrollTo({ top: 0 });
  }

  function qView(n, pos) {
    const e = ex(n), q = bank(n)[e.order[pos]];
    const perm = e.perm[pos];
    return { text: q[0], opts: perm.map(function (oi) { return q[1 + oi]; }), correctPos: perm.indexOf(0) };
  }

  function renderTake() {
    const n = S.n, e = ex(n);
    if (!e || e.status !== "in_progress") { S.view = "list"; return render(); }
    const pos = e.cur, qv = qView(n, pos), total = e.order.length;
    const answered = e.answers.filter(function (a) { return a !== null && a !== undefined; }).length;
    const letters = ["A", "B", "C", "D"];
    let cells = "";
    for (let i = 0; i < total; i++) {
      const a = e.answers[i] !== null && e.answers[i] !== undefined;
      cells += '<button class="ex-cell' + (i === pos ? ' cur' : '') + (e.flags[i] ? ' flag' : (a ? ' ans' : '')) + '" data-go="' + i + '" aria-label="Question ' + (i + 1) + (a ? ', answered' : '') + '">' + (i + 1) + '</button>';
    }
    S.root.innerHTML = '<div class="ex-wrap"><div class="ex-top"><h2>Exam ' + n + ' · ' + esc(CFG.levels[n - 1]) + '</h2><span class="ex-sub">' + answered + ' of ' + total + ' answered</span><span class="sp"></span>' +
      '<div class="ex-timer"><b id="exTimer">' + fmtTime(remaining(e)) + '</b><small>time left</small></div><button class="ex-btn alt" id="exLeave">Save &amp; exit</button><button class="ex-btn bad" id="exSubmit">Submit exam</button></div>' +
      '<div class="ex-body"><div><div class="ex-q"><div class="ex-qh"><span>Question ' + (pos + 1) + ' of ' + total + '</span><span>+' + CFG.correct + ' / −' + CFG.wrong + '</span></div><div class="ex-qt">' + esc(qv.text) + '</div>' +
      qv.opts.map(function (t, i) { return '<button class="ex-opt' + (e.answers[pos] === i ? ' sel' : '') + '" data-opt="' + i + '"><span class="k">' + letters[i] + '</span><span>' + esc(t) + '</span></button>'; }).join('') +
      '<div class="ex-nav"><button class="ex-btn alt" id="exPrev"' + (pos === 0 ? ' disabled' : '') + '>← Previous</button><button class="ex-btn alt" id="exClear"' + (e.answers[pos] === null || e.answers[pos] === undefined ? ' disabled' : '') + '>Clear answer</button><button class="ex-btn alt" id="exFlag">' + (e.flags[pos] ? '★ Marked for review' : '☆ Mark for review') + '</button><span class="sp"></span><button class="ex-btn" id="exNext"' + (pos === total - 1 ? ' disabled' : '') + '>Next →</button></div></div></div>' +
      '<div class="ex-map"><h4>Question navigator</h4><div class="ex-cells">' + cells + '</div><div class="ex-key"><span><i style="background:#DCEBFF"></i>Answered</span><span><i style="background:var(--amber-soft)"></i>Marked</span><span><i style="background:var(--surface-alt)"></i>Not answered</span></div></div></div></div>';
    paintTimer();
    const root = S.root;
    root.querySelectorAll("[data-opt]").forEach(function (b) { b.addEventListener("click", function () { e.answers[pos] = +b.getAttribute("data-opt"); save(); renderTake(); }); });
    root.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () { e.cur = +b.getAttribute("data-go"); save(); renderTake(); }); });
    const on = function (id, fn) { const x = document.getElementById(id); if (x) x.addEventListener("click", fn); };
    on("exPrev", function () { if (e.cur > 0) { e.cur--; save(); renderTake(); } });
    on("exNext", function () { if (e.cur < total - 1) { e.cur++; save(); renderTake(); } });
    on("exClear", function () { e.answers[pos] = null; save(); renderTake(); });
    on("exFlag", function () { if (e.flags[pos]) delete e.flags[pos]; else e.flags[pos] = true; save(); renderTake(); });
    on("exLeave", function () { stopTimer(); S.view = "list"; render(); window.scrollTo({ top: 0 }); });
    on("exSubmit", function () { confirmSubmit(); });
  }

  function dialog(html, buttons) {
    const bg = document.createElement("div"); bg.className = "ex-modal";
    bg.innerHTML = '<div class="ex-dlg" role="dialog" aria-modal="true">' + html + '<div class="row"></div></div>';
    const row = bg.querySelector(".row");
    buttons.forEach(function (b) { const x = document.createElement("button"); x.className = "ex-btn " + (b.cls || ""); x.textContent = b.label; x.addEventListener("click", function () { bg.remove(); if (b.fn) b.fn(); }); row.appendChild(x); });
    document.body.appendChild(bg);
    return bg;
  }

  function confirmSubmit() {
    const e = ex(S.n); if (!e) return;
    const un = e.answers.filter(function (a) { return a === null || a === undefined; }).length;
    dialog('<h3>Submit Exam ' + S.n + '?</h3><p>You have answered <b>' + (e.order.length - un) + '</b> of ' + e.order.length + ' questions' + (un ? ' and left <b>' + un + '</b> unanswered' : '') + '. Once you submit, you cannot change your answers or take this exam again.</p>',
      [{ label: "Keep working", cls: "alt" }, { label: "Submit now", cls: "bad", fn: function () { submit(false); } }]);
  }

  function submit(auto) {
    const n = S.n, e = ex(n);
    if (!e || e.status !== "in_progress") return;
    stopTimer(false);
    e.status = "completed";
    e.completedAt = new Date().toISOString();
    e.result = Object.assign(score(n), { timeMs: Math.min(e.elapsedMs, CFG.minutes * 60000), auto: !!auto });
    if (completedCount() === 5 && !S.st.cert) {
      const now = new Date().toISOString();
      S.st.cert = { no: global.SkExamCert ? global.SkExamCert.makeNumber(uid(), now) : "DLSC-" + new Date().getFullYear() + "-000000", issuedAt: now, avg: average() };
    }
    save();
    S.view = "result"; render(); window.scrollTo({ top: 0 });
    if (auto) dialog("<h3>Time is up</h3><p>Your exam was submitted automatically with the answers you had given.</p>", [{ label: "See my marks", cls: "go" }]);
  }

  /* ---------------- result and review ---------------- */
  function renderResult() {
    stopTimer();
    const n = S.n, e = ex(n);
    if (!e || e.status !== "completed") { S.view = "list"; return render(); }
    const r = e.result, letters = ["A", "B", "C", "D"];
    let rv = "";
    e.order.forEach(function (_, pos) {
      const qv = qView(n, pos), a = e.answers[pos];
      const cls = (a === null || a === undefined) ? "na" : (a === qv.correctPos ? "ok" : "no");
      const tag = cls === "ok" ? "Correct +" + CFG.correct : cls === "no" ? "Wrong −" + CFG.wrong : "Not answered 0";
      rv += '<div class="ex-rv ' + cls + '"><h5>Q' + (pos + 1) + '. ' + esc(qv.text) + '<span class="ex-tag ' + cls + '">' + tag + '</span></h5>' +
        qv.opts.map(function (t, i) { return '<div class="o' + (i === qv.correctPos ? ' good' : (i === a ? ' bad' : '')) + '">' + letters[i] + '. ' + esc(t) + (i === qv.correctPos ? '  ✓ correct answer' : (i === a ? '  ✗ your answer' : '')) + '</div>'; }).join('') + '</div>';
    });
    const nextN = n < 5 && status(n + 1) !== "completed" ? n + 1 : 0;
    S.root.innerHTML = '<div class="ex-wrap"><div class="ex-hero"><h1>Exam ' + n + ' · ' + esc(CFG.levels[n - 1]) + ' — Results</h1><p>' + (r.auto ? 'This exam was submitted automatically when the time ended. ' : '') + 'Submitted on ' + esc(new Date(e.completedAt).toLocaleString("en-IN")) + '.</p>' +
      '<div class="ex-prog"><b style="font-size:34px">' + fmtMarks(r.marks) + ' <span style="font-size:16px;opacity:.8">/ ' + r.max + '</span></b><b>' + r.pct + '%</b></div></div>' +
      '<div class="ex-sum"><div class="ex-stat g"><b>' + r.correct + '</b><span>Correct (+' + r2(r.correct * CFG.correct) + ')</span></div><div class="ex-stat r"><b>' + r.wrong + '</b><span>Wrong (−' + r2(r.wrong * CFG.wrong) + ')</span></div><div class="ex-stat"><b>' + r.unanswered + '</b><span>Not answered</span></div><div class="ex-stat"><b>' + fmtDur(r.timeMs) + '</b><span>Time used of ' + CFG.minutes + ' min</span></div>' +
      '<div class="ex-stat"><b>' + (r.correct + r.wrong ? Math.round(r.correct / (r.correct + r.wrong) * 100) : 0) + '%</b><span>Accuracy of attempted</span></div></div>' +
      (completedCount() === 5 ? '<div class="ex-panel"><b>All 5 exams are complete. Your certificate is ready.</b></div>' : '') +
      '<div class="ex-nav" style="margin:14px 0"><button class="ex-btn alt" id="exBack">← All exams</button>' + (nextN && unlocked(nextN) ? '<button class="ex-btn go" id="exNextExam">Go to Exam ' + nextN + ' →</button>' : '') + (completedCount() === 5 ? '<button class="ex-btn go" id="exToCert">View my certificate</button>' : '') + '</div>' +
      '<div class="ex-panel"><h3>Question-by-question review</h3>' + rv + '</div></div>';
    const on = function (id, fn) { const x = document.getElementById(id); if (x) x.addEventListener("click", fn); };
    on("exBack", function () { S.view = "list"; render(); window.scrollTo({ top: 0 }); });
    on("exToCert", function () { S.view = "list"; render(); const c = document.getElementById("exCertCv"); if (c) c.scrollIntoView({ behavior: "smooth", block: "center" }); });
    on("exNextExam", function () { S.view = "list"; render(); startExam(nextN); });
  }

  /* ---------------- keyboard ---------------- */
  document.addEventListener("keydown", function (ev) {
    if (S.view !== "take" || !S.root || !S.root.offsetParent) return;
    if (/input|textarea|select/i.test((ev.target && ev.target.tagName) || "")) return;
    const e = ex(S.n); if (!e || e.status !== "in_progress") return;
    const k = ev.key.toLowerCase(), idx = "abcd".indexOf(k) >= 0 ? "abcd".indexOf(k) : ("1234".indexOf(k));
    if (k.length === 1 && idx >= 0) { e.answers[e.cur] = idx; save(); renderTake(); }
    else if (k === "arrowright" && e.cur < e.order.length - 1) { e.cur++; save(); renderTake(); }
    else if (k === "arrowleft" && e.cur > 0) { e.cur--; save(); renderTake(); }
  });

  /* ---------------- lifecycle ---------------- */
  document.addEventListener("visibilitychange", function () { if (document.hidden) stopTimer(); else if (S.view === "take" && S.root && S.root.offsetParent) startTimer(); });
  global.addEventListener("pagehide", function () { stopTimer(); });

  global.SkExam = {
    CFG: CFG,
    mount: function (root, user) {
      S.root = root; S.user = user || { id: null, name: "Student" };
      S.st = load(); S.view = "list";      // always land on the exam list: an unfinished exam shows "Resume exam" with the time left
      render();
    },
    /* call when the student leaves the Exams screen: stops the clock and saves */
    hide: function () { stopTimer(); },
    summary: function (user) {
      const prevU = S.user, prevS = S.st; S.user = user || S.user || { id: null }; const st = load(); S.user = prevU; S.st = prevS;
      let done = 0, prog = 0, sum = 0;
      for (let n = 1; n <= 5; n++) { const e = st.exams[n]; if (e && e.status === "completed") { done++; sum += e.result.pct; } else if (e && e.status === "in_progress") prog = n; }
      return { completed: done, inProgress: prog, avg: done === 5 ? r2(sum / 5) : null, next: done < 5 ? (prog || done + 1) : 0 };
    },
    _score: score, _state: function () { return S.st; }
  };
})(typeof window !== "undefined" ? window : globalThis);
