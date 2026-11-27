/* =========================================================================
   DOT ECOSYSTEM — TRADE & CUSTOMS CERTIFICATE OF COMPLETION
   =========================================================================
   Issues the "Trade & Customs — National Trade Facilitation Simulator"
   Certificate of Completion automatically, as a PDF, with the student's own
   name and the day they actually completed the programme.

   WHO GETS IT (all rules live in CFG below — change a number, not the code):
     1. Completed at least CFG.minShipments Shipment Lots (status "completed"
        in the student's Job History, each with at least CFG.minDocsPerShipment
        documents actually completed)  — OR —  finished every document in the
        workbook (all Fill & Learn exercises), AND
     2. Filed the Shipping Bill AND the Bill of Entry through ICEGATE
        (progress record carries viaTcos) — the certificate text says
        "practical filing of Shipping Bill and Bill of Entry", so it is only
        issued when that filing really happened in ICEGATE.
        Set CFG.requireTcos = false to drop rule 2.

   DATE ON THE CERTIFICATE: the day the LAST requirement was met (e.g. the
   day the 5th Shipment Lot was finished, or the ICEGATE filing completed —
   whichever came later), not the day the PDF happens to be downloaded.

   LAYOUT: the original artwork is the background (assets/dot-certificate-
   template.jpg, 1536x1024) with only the student's name, date and
   certificate number removed. Those three items are drawn back on top at the
   exact original positions. Everything else is the untouched original pixels.
   ========================================================================= */
(function (global) {
  "use strict";

  const CFG = {
    minShipments: 5,
    minDocsPerShipment: 3,   // a Shipment Lot only counts if at least this many of its documents were really completed (stops 1-document "lots" being used to reach 5)
    requireTcos: true,
    tcosDocs: ["shipping-bill", "bill-of-entry"],
    allowAllDocsPath: true,
    prefix: "DOT-TC",
    template: "assets/dot-certificate-template.jpg",
    // Layout, in the template's own 1536x1024 pixel space (measured from the original artwork).
    W: 1536, H: 1024,
    name:  { cx: 776, baseline: 531, size: 70, minSize: 36, maxWidth: 600, color: "#080e26", stroke: 0.9 },
    date:  { x: 69,   baseline: 962, size: 16.3, color: "#11172e" },
    certNo:{ x: 1277, baseline: 962, size: 16.3, color: "#11172e" },
    serif: "DotCertSerif",
    sans: "DotCertSans",
    renderScale: 2
  };

  const REC_PREFIX = "skelora_cert_v1_";
  const SEQ_KEY = "skelora_cert_seq_v1";

  function readJSON(k) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function ts(iso) { const t = new Date(iso).getTime(); return isNaN(t) ? 0 : t; }
  function cleanName(n) { return String(n || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim() || "Student"; }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  function getRecord(userId) { return userId ? readJSON(REC_PREFIX + userId) : null; }

  /* ---------------------------------------------------------------- eligibility */
  function completedLots(userId) {
    const hist = (typeof skGetJobHistory === "function") ? skGetJobHistory(userId) : [];
    const seen = new Set();
    return hist
      .filter(j => j && j.status === "completed" && j.jobId && (j.documentsCompleted == null || j.documentsCompleted >= CFG.minDocsPerShipment) && !seen.has(j.jobId) && seen.add(j.jobId))
      .sort((a, b) => ts(a.finishedAt) - ts(b.finishedAt));
  }

  function eligibility(userId, totalExercises) {
    const out = {
      eligible: false, completedAt: null,
      lots: 0, lotsNeeded: CFG.minShipments, lotsOk: false,
      allDocsOk: false, docsDone: 0, docsTotal: totalExercises || 0,
      tcos: CFG.tcosDocs.map(slug => ({ slug, done: false, at: null })), tcosOk: !CFG.requireTcos
    };
    if (!userId) return out;

    const lots = completedLots(userId);
    out.lots = lots.length;
    out.lotsOk = lots.length >= CFG.minShipments;
    const lotsAt = out.lotsOk ? lots[CFG.minShipments - 1].finishedAt : null;

    const all = (typeof skGetAllProgress === "function") ? skGetAllProgress(userId) : {};
    const done = Object.keys(all).filter(s => all[s] && all[s].status === "completed");
    out.docsDone = done.length;
    let allDocsAt = null;
    if (CFG.allowAllDocsPath && out.docsTotal > 0 && done.length >= out.docsTotal) {
      out.allDocsOk = true;
      allDocsAt = done.map(s => all[s].updatedAt || all[s].startedAt).filter(Boolean).sort((a, b) => ts(b) - ts(a))[0] || null;
    }

    out.tcos.forEach(t => {
      const p = all[t.slug];
      if (p && p.status === "completed" && p.viaTcos) { t.done = true; t.at = p.updatedAt || p.startedAt || null; }
      /* v51: a finished lot archives its documents, so an ICEGATE filing made in an earlier lot is read from that lot's summary */
      if (!t.done) {
        const hist = (typeof skGetJobHistory === "function") ? skGetJobHistory(userId) : [];
        hist.forEach(j => ((j && j.summary && j.summary.rows) || []).forEach(r => {
          if (r.slug === t.slug && r.status === "completed" && r.viaTcos && (!t.done || ts(r.completedAt) > ts(t.at))) { t.done = true; t.at = r.completedAt || t.at; }
        }));
      }
    });
    if (CFG.requireTcos) out.tcosOk = out.tcos.every(t => t.done);

    const pathDates = [lotsAt, allDocsAt].filter(Boolean).sort((a, b) => ts(a) - ts(b));
    const pathOk = out.lotsOk || out.allDocsOk;
    out.eligible = pathOk && out.tcosOk;
    if (out.eligible) {
      const dates = [pathDates[0]];
      if (CFG.requireTcos) out.tcos.forEach(t => dates.push(t.at));
      out.completedAt = dates.filter(Boolean).sort((a, b) => ts(b) - ts(a))[0] || new Date().toISOString();
    }
    return out;
  }

  /* ---------------------------------------------------------------- issuing */
  function nextCertNo(completedAtIso) {
    let n = 1;
    try { n = parseInt(localStorage.getItem(SEQ_KEY) || "0", 10) + 1; localStorage.setItem(SEQ_KEY, String(n)); } catch (e) { /* non-fatal */ }
    const year = new Date(completedAtIso).getFullYear() || new Date().getFullYear();
    return CFG.prefix + "-" + year + "-" + String(n).padStart(4, "0");
  }

  function issue(userId, name, elig) {
    const rec = {
      certNo: nextCertNo(elig.completedAt),
      userId: userId,
      name: cleanName(name),
      completedAt: elig.completedAt,
      dateText: formatDate(elig.completedAt),
      issuedAt: new Date().toISOString(),
      lots: elig.lots,
      autoDownloaded: false
    };
    writeJSON(REC_PREFIX + userId, rec);
    return rec;
  }

  /* ---------------------------------------------------------------- drawing */
  function fitName(ctx, text) {
    const c = CFG.name;
    let size = c.size;
    ctx.font = size + 'px "' + CFG.serif + '", Georgia, serif';
    let w = ctx.measureText(text).width;
    if (w > c.maxWidth) { size = Math.max(c.minSize, Math.floor(size * c.maxWidth / w)); }
    return size;
  }

  /* Draws the certificate onto `ctx` (already scaled so 1 unit = 1 template pixel). `img` = template. */
  function draw(ctx, img, rec) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, CFG.W, CFG.H);
    ctx.textBaseline = "alphabetic";

    // Student name — centred, shrinks (never wraps) for long names.
    const n = CFG.name;
    const size = fitName(ctx, rec.name);
    ctx.font = size + 'px "' + CFG.serif + '", Georgia, serif';
    ctx.textAlign = "center";
    ctx.fillStyle = n.color;
    ctx.strokeStyle = n.color;
    ctx.lineWidth = n.stroke * (size / n.size);
    ctx.lineJoin = "round";
    ctx.strokeText(rec.name, n.cx, n.baseline);
    ctx.fillText(rec.name, n.cx, n.baseline);

    // Date of issue + certificate number — left aligned under their printed labels.
    ctx.textAlign = "left";
    ctx.font = CFG.date.size + 'px "' + CFG.sans + '", Arial, sans-serif';
    ctx.fillStyle = CFG.date.color;
    ctx.strokeStyle = CFG.date.color; ctx.lineWidth = 0.3;
    ctx.strokeText(rec.dateText, CFG.date.x, CFG.date.baseline);
    ctx.fillText(rec.dateText, CFG.date.x, CFG.date.baseline);
    ctx.strokeText(rec.certNo, CFG.certNo.x, CFG.certNo.baseline);
    ctx.fillText(rec.certNo, CFG.certNo.x, CFG.certNo.baseline);
  }

  let fontsPromise = null;
  function ensureFonts() {
    if (fontsPromise) return fontsPromise;
    if (typeof FontFace === "undefined" || !document.fonts) return (fontsPromise = Promise.resolve());
    const load = (family, url) => new FontFace(family, "url(" + url + ")", { weight: "400", style: "normal" })
      .load().then(f => { document.fonts.add(f); }).catch(() => { /* fall back to Georgia / Arial */ });
    fontsPromise = Promise.all([
      load(CFG.serif, "fonts/eb-garamond-latin-400-normal.woff2"),
      load(CFG.sans, "fonts/inter-latin-400-normal.woff2")
    ]);
    return fontsPromise;
  }

  function loadTemplate() {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Certificate artwork could not be loaded."));
      img.src = CFG.template;
    });
  }

  async function renderCanvas(rec) {
    await ensureFonts();
    const img = await loadTemplate();
    const s = CFG.renderScale;
    const canvas = document.createElement("canvas");
    canvas.width = CFG.W * s; canvas.height = CFG.H * s;
    const ctx = canvas.getContext("2d");
    ctx.scale(s, s);
    draw(ctx, img, rec);
    return canvas;
  }

  async function downloadPDF(rec) {
    if (!rec) return false;
    if (!global.jspdf || !global.jspdf.jsPDF) throw new Error("PDF tools did not load.");
    const canvas = await renderCanvas(rec);
    const { jsPDF } = global.jspdf;
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [CFG.W, CFG.H], compress: true });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, CFG.W, CFG.H, undefined, "FAST");
    pdf.setProperties({ title: "Certificate of Completion — " + rec.name, subject: rec.certNo, author: "DOT Ecosystem" });
    const safe = rec.name.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "Student";
    pdf.save("Trade-Customs-Certificate-" + safe + "-" + rec.certNo + ".pdf");
    return true;
  }

  /* ---------------------------------------------------------------- UI */
  function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }

  function showIssuedModal(rec) {
    if (document.getElementById("dotCertIssuedOverlay")) return;
    const bg = document.createElement("div");
    bg.id = "dotCertIssuedOverlay";
    bg.style.cssText = "position:fixed;inset:0;background:rgba(11,20,35,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;";
    bg.innerHTML =
      '<div style="background:#fff;color:#101828;border-radius:14px;max-width:460px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.35);padding:26px 28px;text-align:center;font-family:inherit;">' +
      '<div style="font-size:40px;line-height:1;margin-bottom:8px;">🎓</div>' +
      '<h2 style="margin:0 0 8px;font-size:19px;">Your Certificate of Completion is ready</h2>' +
      '<p style="margin:0 0 6px;font-size:13.5px;color:#5B6472;line-height:1.55;">Trade &amp; Customs — National Trade Facilitation Simulator</p>' +
      '<p style="margin:0 0 16px;font-size:13px;color:#101828;"><b>' + esc(rec.name) + '</b> · ' + esc(rec.dateText) + ' · ' + esc(rec.certNo) + '</p>' +
      '<p id="dotCertIssuedMsg" style="margin:0 0 16px;font-size:12.5px;color:#5B6472;">Your PDF is downloading automatically. If it didn\'t start, use the button below.</p>' +
      '<div style="display:flex;gap:10px;">' +
      '<button type="button" id="dotCertIssuedClose" style="flex:1;height:42px;border:1.5px solid #D2D9E3;border-radius:9px;background:#fff;font-weight:600;cursor:pointer;">Close</button>' +
      '<button type="button" id="dotCertIssuedDl" style="flex:1;height:42px;border:none;border-radius:9px;background:#0B2A4A;color:#fff;font-weight:700;cursor:pointer;">Download PDF</button>' +
      '</div></div>';
    document.body.appendChild(bg);
    document.getElementById("dotCertIssuedClose").addEventListener("click", () => bg.remove());
    document.getElementById("dotCertIssuedDl").addEventListener("click", () => {
      downloadPDF(rec).catch(() => { const m = document.getElementById("dotCertIssuedMsg"); if (m) m.textContent = "Couldn't build the PDF. Please try again."; });
    });
  }

  function renderBanner(el, userId, totalExercises, isStudentLike) {
    el = el || document.getElementById("certificateBanner");
    if (!el) return;
    if (!userId) { el.style.display = "none"; return; }
    const rec = getRecord(userId);
    const box = "margin-bottom:24px;padding:20px 24px;border-radius:12px;";
    if (rec) {
      el.style.display = "block";
      el.innerHTML =
        '<div style="' + box + 'background:linear-gradient(120deg,#0B2A4A,#14385E);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;">' +
        '<div><div style="font-weight:700;font-size:16px;">🎓 Trade &amp; Customs Certificate of Completion</div>' +
        '<div style="font-size:13px;opacity:.85;margin-top:3px;">' + esc(rec.name) + ' · ' + esc(rec.dateText) + ' · ' + esc(rec.certNo) + '</div></div>' +
        '<button type="button" id="dotCertDownloadBtn" style="background:#fff;color:#0B2A4A;border:none;border-radius:9px;height:40px;padding:0 18px;font-weight:700;cursor:pointer;white-space:nowrap;">Download PDF</button></div>';
      const b = document.getElementById("dotCertDownloadBtn");
      if (b) b.addEventListener("click", () => downloadPDF(rec).catch(() => { if (typeof showToast === "function") showToast("Couldn't build the certificate PDF. Please try again."); }));
      return;
    }
    const e = eligibility(userId, totalExercises);
    const tick = ok => ok ? '<span style="color:#7BE0A0;">✔</span>' : '<span style="opacity:.6;">○</span>';
    const tcosLine = CFG.requireTcos
      ? e.tcos.map(t => tick(t.done) + " " + (t.slug === "shipping-bill" ? "Shipping Bill" : "Bill of Entry") + " filed in ICEGATE").join(" &nbsp;·&nbsp; ")
      : "";
    el.style.display = "block";
    el.innerHTML =
      '<div style="' + box + 'background:#0F2F52;color:#fff;">' +
      '<div style="font-weight:700;font-size:15px;margin-bottom:6px;">🎓 Certificate of Completion — your progress</div>' +
      '<div style="font-size:12.8px;line-height:1.7;opacity:.92;">' +
      tick(e.lotsOk || e.allDocsOk) + " Shipment Lots completed: <b>" + e.lots + " / " + e.lotsNeeded + "</b>" +
      (CFG.allowAllDocsPath ? ' <span style="opacity:.7;">(or finish all ' + e.docsTotal + " documents: " + e.docsDone + ")</span>" : "") +
      (tcosLine ? "<br>" + tcosLine : "") +
      '<br><span style="opacity:.75;">The certificate is issued automatically, with your name and completion date, the moment everything above is done.</span></div></div>';
  }

  /* Checks eligibility and, the first time it is met, issues + auto-downloads the PDF. */
  function autoIssue(opts) {
    opts = opts || {};
    const userId = opts.userId || (typeof CURRENT_USER !== "undefined" && CURRENT_USER && CURRENT_USER.id);
    const name = opts.name || (typeof CURRENT_USER !== "undefined" && CURRENT_USER && CURRENT_USER.name);
    const total = opts.totalExercises != null ? opts.totalExercises : (typeof TOTAL_EXERCISES !== "undefined" ? TOTAL_EXERCISES : 0);
    if (!userId) return null;
    let rec = getRecord(userId);
    if (!rec) {
      const e = eligibility(userId, total);
      if (!e.eligible) { renderBanner(null, userId, total); return null; }
      rec = issue(userId, name, e);
      renderBanner(null, userId, total);
      if (opts.silent) return rec;
      showIssuedModal(rec);
      downloadPDF(rec).then(() => { rec.autoDownloaded = true; writeJSON(REC_PREFIX + userId, rec); }).catch(() => { /* modal button is the fallback */ });
      return rec;
    }
    renderBanner(null, userId, total);
    return rec;
  }

  /* Finishing a Shipment Lot is the moment a certificate can become due — re-check right after it,
     without touching every call site of skFinishJob. */
  function hookFinishJob() {
    if (typeof global.skFinishJob !== "function" || global.skFinishJob.__dotCertHooked) return;
    const orig = global.skFinishJob;
    const wrapped = function () {
      const res = orig.apply(this, arguments);
      try { setTimeout(() => autoIssue({}), 400); } catch (e) { /* never block finishing a Lot */ }
      return res;
    };
    wrapped.__dotCertHooked = true;
    global.skFinishJob = wrapped;
  }
  hookFinishJob();

  global.DotCert = {
    CFG: CFG, eligibility: eligibility, getRecord: getRecord, autoIssue: autoIssue, renderBanner: renderBanner,
    downloadPDF: downloadPDF, renderCanvas: renderCanvas, draw: draw, formatDate: formatDate, _issue: issue, _hookFinishJob: hookFinishJob
  };
})(typeof window !== "undefined" ? window : globalThis);
