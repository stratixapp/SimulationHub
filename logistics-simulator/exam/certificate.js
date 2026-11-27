/* =========================================================================
   SKELORA INSTITUTE - EXAM CERTIFICATE ("Certificate of Completion", Blue Wave artwork)
   Issued when a student has completed all 5 certification exams. It shows:
     - the student's name        - the exact average score of the 5 exams
     - the certificate number    - the date of issue
   The artwork (assets/exam-certificate-template.png) is the supplied template. Its sample text
   ("Student Name", "83.6%", the number and the date) is wiped out by blending the surrounding
   background across the box, and the real values are drawn in the same positions and style.
   This is separate from the Trade & Customs completion certificate (dot-certificate.js), which is untouched.
   ========================================================================= */
(function (global) {
  "use strict";

  const CFG = {
    template: "exam/assets/exam-certificate-template.png",
    W: 1055, H: 1491,
    prefix: "DLSC",
    // boxes (x0,y0,x1,y1) that hold the sample text in the template; measured on the supplied artwork
    erase: {
      name:  [76, 622, 668, 718],
      score: [442, 944, 702, 1019],
      no:    [204, 1103, 474, 1134],
      date:  [204, 1181, 396, 1212]
    },
    // where the real text is drawn
    nameBox:  { x: 88,  baseline: 701, maxW: 690, size: 118, min: 40, color: "#FFFFFF" },
    scoreBox: { x: 452, baseline: 1005, maxW: 246, size: 74, min: 36 },
    noBox:    { x: 212, baseline: 1127, size: 24 },
    dateBox:  { x: 214, baseline: 1205, size: 24 },
    fonts: {
      nameFamily: "SkCertName",  nameFile: "exam/assets/crimson-italic-latin.woff2",
      sansFamily: "SkCertSans",  sansFile: "exam/assets/montserrat-bold-latin.woff2"
    }
  };

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(d) { d = new Date(d); return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }
  function fmtScore(avg) { return String(Math.round(avg * 100) / 100) + "%"; }

  /* DLSC-2026-000347 : prefix - year - 6 digits, the same for the same student (derived from the account id) */
  function makeNumber(userId, when) {
    let h = 7;
    const s = String(userId || "student");
    for (let i = 0; i < s.length; i++) h = (h * 131 + s.charCodeAt(i)) % 900000;
    return CFG.prefix + "-" + new Date(when).getFullYear() + "-" + String(100000 + (h % 900000)).slice(0, 6);
  }

  /* default (browser) environment */
  const browserEnv = {
    createCanvas: function (w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; },
    loadImage: function (src) {
      return new Promise(function (res, rej) { const im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error("Could not load " + src)); }; im.src = src; });
    },
    ensureFonts: function () {
      if (!global.FontFace || !document.fonts) return Promise.resolve();
      const f = CFG.fonts;
      const a = new FontFace(f.nameFamily, "url(" + f.nameFile + ")", { style: "italic", weight: "400" });
      const b = new FontFace(f.sansFamily, "url(" + f.sansFile + ")", { weight: "700" });
      return Promise.all([a.load(), b.load()]).then(function (l) { l.forEach(function (x) { document.fonts.add(x); }); });
    }
  };

  /* Replace a box by blending the background just outside all four of its edges (a Coons patch), so gradients and the
     slight lighting of the artwork continue smoothly through the wiped area. */
  function wipe(ctx, box) {
    const x0 = box[0], y0 = box[1], x1 = box[2], y1 = box[3], w = x1 - x0, h = y1 - y0;
    const strip = function (x, y, sw, sh) { return ctx.getImageData(x, y, sw, sh).data; };
    const Ld = strip(x0 - 5, y0, 3, h), Rd = strip(x1 + 2, y0, 3, h), Td = strip(x0, y0 - 5, w, 3), Bd = strip(x0, y1 + 2, w, 3);
    const avg = function (d, n, stride, idx, c) { let v = 0; for (let k = 0; k < n; k++) v += d[idx(k) * 4 + c]; return v / n; };
    const Lc = [], Rc = [], Tc = [], Bc = [];
    for (let y = 0; y < h; y++) { Lc.push([0, 1, 2].map(function (c) { return avg(Ld, 3, 0, function (k) { return y * 3 + k; }, c); })); Rc.push([0, 1, 2].map(function (c) { return avg(Rd, 3, 0, function (k) { return y * 3 + k; }, c); })); }
    for (let x = 0; x < w; x++) { Tc.push([0, 1, 2].map(function (c) { return avg(Td, 3, 0, function (k) { return k * w + x; }, c); })); Bc.push([0, 1, 2].map(function (c) { return avg(Bd, 3, 0, function (k) { return k * w + x; }, c); })); }
    const out = ctx.createImageData(w, h), o = out.data;
    for (let y = 0; y < h; y++) {
      const s = h > 1 ? y / (h - 1) : 0;
      for (let x = 0; x < w; x++) {
        const t = w > 1 ? x / (w - 1) : 0, i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const hor = Lc[y][c] * (1 - t) + Rc[y][c] * t;
          const ver = Tc[x][c] * (1 - s) + Bc[x][c] * s;
          const corners = (1 - s) * ((1 - t) * Tc[0][c] + t * Tc[w - 1][c]) + s * ((1 - t) * Bc[0][c] + t * Bc[w - 1][c]);
          const v = hor + ver - corners;
          o[i + c] = Math.max(0, Math.min(255, Math.round(v)));
        }
        o[i + 3] = 255;
      }
    }
    ctx.putImageData(out, x0, y0);
  }

  function fitSize(ctx, text, fontFn, start, min, maxW) {
    let s = start;
    ctx.font = fontFn(s);
    while (s > min && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = fontFn(s); }
    return s;
  }

  /* opts: { name, avg (number, 0-100), certNo, date }  ->  Promise<canvas> */
  function render(opts, env) {
    env = env || browserEnv;
    return Promise.all([env.ensureFonts(), env.loadImage(CFG.template)]).then(function (r) {
      const img = r[1];
      const canvas = env.createCanvas(CFG.W, CFG.H);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, CFG.W, CFG.H);
      ["name", "score", "no", "date"].forEach(function (k) { wipe(ctx, CFG.erase[k]); });

      const F = CFG.fonts;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";

      // name
      const nb = CFG.nameBox, name = String(opts.name || "").trim() || "Student Name";
      const nameFont = function (s) { return "italic 400 " + s + 'px "' + F.nameFamily + '", "Times New Roman", serif'; };
      const ns = fitSize(ctx, name, nameFont, nb.size, nb.min, nb.maxW);
      ctx.font = nameFont(ns);
      ctx.fillStyle = nb.color;
      ctx.shadowColor = "rgba(0,20,60,0.35)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
      ctx.fillText(name, nb.x, nb.baseline);
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      // average score
      const sb = CFG.scoreBox, sc = fmtScore(opts.avg);
      const sansFont = function (wt) { return function (s) { return wt + " " + s + 'px "' + F.sansFamily + '", Arial, sans-serif'; }; };
      const ss = fitSize(ctx, sc, sansFont(700), sb.size, sb.min, sb.maxW);
      ctx.font = sansFont(700)(ss);
      const grad = ctx.createLinearGradient(sb.x, 0, sb.x + ctx.measureText(sc).width, 0);
      grad.addColorStop(0, "#9DF3FF"); grad.addColorStop(1, "#4FE3F7");
      ctx.fillStyle = grad;
      ctx.shadowColor = "rgba(0,40,90,0.35)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
      ctx.fillText(sc, sb.x, sb.baseline - (sb.size - ss) * 0.1);
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      // certificate number and date
      ctx.fillStyle = "#FFFFFF";
      ctx.font = sansFont(700)(CFG.noBox.size);
      ctx.fillText(String(opts.certNo), CFG.noBox.x, CFG.noBox.baseline);
      ctx.font = sansFont(700)(CFG.dateBox.size);
      ctx.fillText(fmtDate(opts.date), CFG.dateBox.x, CFG.dateBox.baseline);
      return canvas;
    });
  }

  global.SkExamCert = { CFG: CFG, render: render, fmtDate: fmtDate, fmtScore: fmtScore, makeNumber: makeNumber };
})(typeof window !== "undefined" ? window : globalThis);
