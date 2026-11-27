/* e2e-agent.js - a small "browser + human" for the simulators (jsdom). Not a real browser: no layout, no canvas, no file dialogs.
   It opens real pages, follows the redirects the app's own scripts ask for, carries localStorage between pages (same origin),
   reads on-screen codes (OTP, captcha) the way a person would, and types into the real form fields. */
const { JSDOM, ResourceLoader, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const ROOT = process.env.HUB_ROOT || path.resolve(__dirname, "..", "..");
const acorn = require("acorn"), walk = require("acorn-walk");
/* Redirects are captured by rewriting only the assignments the app makes to location (found with a real JS parser), so every other line runs untouched. */
const isLocObj = (o) => (o.type === "Identifier" && o.name === "location") || (o.type === "MemberExpression" && o.object.type === "Identifier" && o.object.name === "window" && o.property.name === "location");
function rewriteJs(src) {
  let ast; try { ast = acorn.parse(src, { ecmaVersion: "latest", allowReturnOutsideFunction: true }); } catch (e) { return src; }
  const edits = [];
  walk.full(ast, (n) => {
    if (n.type === "AssignmentExpression" && n.operator === "=" && n.left.type === "MemberExpression" && ((n.left.property.name === "href" && isLocObj(n.left.object)) || (n.left.object.type === "Identifier" && n.left.object.name === "window" && n.left.property.name === "location")))
      edits.push([n.start, n.end, "window.__nav(" + src.slice(n.right.start, n.right.end) + ")"]);
    else if (n.type === "AssignmentExpression" && n.operator === "=" && n.left.type === "Identifier" && n.left.name === "location") edits.push([n.start, n.end, "window.__nav(" + src.slice(n.right.start, n.right.end) + ")"]);
    else if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && isLocObj(n.callee.object) && /^(replace|assign)$/.test(n.callee.property.name) && n.arguments[0]) edits.push([n.start, n.end, "window.__nav(" + src.slice(n.arguments[0].start, n.arguments[0].end) + ")"]);
  });
  edits.sort((x, y) => y[0] - x[0]); let out = src, last = Infinity;
  edits.forEach(([st, en, to]) => { if (en <= last) { out = out.slice(0, st) + to + out.slice(en); last = st; } });
  return out;
}
const rewriteHtml = (h) => h.replace(/(?:window\.)?location\.href\s*=\s*('[^']*'|"[^"]*")/g, "window.__nav($1)").replace(/(<script(?![^>]*\bsrc=)[^>]*>)([\s\S]*?)(<\/script>)/g, (m, o, body, c) => o + rewriteJs(body) + c);
class Loader extends ResourceLoader {
  fetch(url) {
    const u = new URL(url); if (u.hostname !== "localhost") return Promise.resolve(Buffer.from(""));
    const p = path.join(ROOT, decodeURIComponent(u.pathname));
    try { let b = fs.readFileSync(p); if (/\.js$/.test(p) && !/vendor/.test(p)) b = Buffer.from(rewriteJs(b.toString("utf8"))); return Promise.resolve(b); } catch (e) { return Promise.reject(new Error("404 " + u.pathname)); }
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class Browser {
  constructor(log) { this.ls = {}; this.ss = {}; this.log = log || console.log; this.w = null; this.errs = []; this.toasts = []; }
  async goto(rel, wait = 600) {
    if (this.w) this.sync();
    rel = rel.replace(/^https?:\/\/localhost\/emirates-tax-portal\//, "");
    const url = "http://localhost/emirates-tax-portal/" + rel;
    const vc = new VirtualConsole(), errs = (this.errs = []);
    vc.on("jsdomError", (e) => { if (/getContext|Not implemented: (navigation|HTMLCanvas|window.scrollTo|HTMLFormElement)/.test(e.message)) return; errs.push("jsdomError: " + (e.detail && e.detail.message || e.message)); });
    vc.on("error", (...a) => errs.push("console.error: " + a.join(" ")));
    const file = rel.split("?")[0], html = rewriteHtml(fs.readFileSync(path.join(ROOT, "emirates-tax-portal", file), "utf8"));
    const me = this;
    const dom = new JSDOM(html, { url, runScripts: "dangerously", resources: new Loader(), pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(w) {
        Object.keys(me.ls).forEach((k) => w.localStorage.setItem(k, me.ls[k])); Object.keys(me.ss).forEach((k) => w.sessionStorage.setItem(k, me.ss[k]));
        w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
        w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.alert = () => {}; w.confirm = () => true; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = function () {};
        w.__navTarget = null; w.__nav = (t) => { w.__navTarget = new URL(String(t), w.location.href).href; };
        w.addEventListener("error", (e) => errs.push("window.error: " + e.message));
      } });
    await new Promise((r) => dom.window.addEventListener("load", () => setTimeout(r, wait)));
    this.w = dom.window; this.d = this.w.document; this.page = rel;
    new this.w.MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && /toast/i.test(n.className + n.id) && n.textContent.trim()) this.toasts.push(n.textContent.trim()); }))).observe(this.d.body, { childList: true, subtree: true });
    return this;
  }
  sync() { const w = this.w; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); this.ls[k] = w.localStorage.getItem(k); } for (let i = 0; i < w.sessionStorage.length; i++) { const k = w.sessionStorage.key(i); this.ss[k] = w.sessionStorage.getItem(k); } }
  async until(fn, ms = 8000, step = 100) { const t = Date.now(); while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(step); } return null; }
  async follow(ms = 9000) { const t = await this.until(() => this.w.__navTarget, ms); if (!t) return null; this.log("   -> browser follows redirect to " + t.replace("http://localhost/emirates-tax-portal/", "")); await this.goto(t); return t; }
  $(id) { return this.d.getElementById(id); }
  visible(el) { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { if (e.hidden || this.w.getComputedStyle(e).display === "none") return false; } return !!el; }
  text(id) { const e = this.$(id); return e ? e.textContent.trim().replace(/\s+/g, " ") : ""; }
  ev(el, t) { el.dispatchEvent(new this.w.Event(t, { bubbles: true })); }
  type(id, v) { const e = typeof id === "string" ? this.$(id) : id; if (!e) throw new Error("no field #" + id); if (e.tagName === "SELECT") { const o = [...e.options].find((x) => x.value === String(v) || x.textContent.trim() === String(v)); e.value = o ? o.value : e.value; } else e.value = v; this.ev(e, "input"); this.ev(e, "change"); }
  click(id) { const e = typeof id === "string" ? this.$(id) : id; if (!e) throw new Error("no button #" + id); e.click(); }
  radio(name, value) { const els = [...this.d.querySelectorAll('input[name="' + name + '"]')]; const e = value ? els.find((x) => x.value === value) : els[0]; if (!e) throw new Error("no radio " + name); e.checked = true; this.ev(e, "change"); this.ev(e, "click"); }
  async clickLink(rx) { const a = [...this.d.querySelectorAll("a")].find((x) => rx.test((x.getAttribute("href") || "") + " " + x.textContent)); if (!a) throw new Error("no link matching " + rx); const t = new URL(a.getAttribute("href"), this.w.location.href).href; this.log("   -> clicks link " + (a.textContent.trim().replace(/\s+/g, " ").slice(0, 30)) + " (" + t.replace("http://localhost/emirates-tax-portal/", "") + ")"); await this.goto(t); }
  submit(id) { const f = this.$(id); if (!f) throw new Error("no form #" + id); f.dispatchEvent(new this.w.Event("submit", { bubbles: true, cancelable: true })); }
  buttonByText(rx, scope) { return [...(scope || this.d).querySelectorAll("button, a")].find((e) => rx.test(e.textContent) && this.visible(e)); }
  check(id, on = true) { const e = this.$(id); if (!e) throw new Error("no checkbox #" + id); e.checked = on; this.ev(e, "change"); this.ev(e, "click"); }
  async upload(id, name, mime = "application/pdf") { const e = this.$(id); const f = new this.w.File(["%PDF-1.4 training"], name, { type: mime }); Object.defineProperty(e, "files", { value: [f], configurable: true }); this.ev(e, "change"); await sleep(250); }
  state() { return this.errs.length ? " [script errors: " + this.errs.slice(0, 2).join(" | ") + "]" : ""; }
}
module.exports = { Browser, sleep };
