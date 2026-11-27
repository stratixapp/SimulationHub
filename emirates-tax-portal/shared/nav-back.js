/* ==========================================================================
   Global "Back" button — Emirates Tax Portal (VAT + Corporate Tax)
   --------------------------------------------------------------------------
   Loaded by every page of the portal (root, /pages and /ct). Adds one small
   floating "Back" button (bottom-left, bottom-right on Arabic/RTL) that takes
   the student to the page they were on just before — not to a fixed page.

   How it works
   - Every page load records its address in a per-tab trail (sessionStorage).
   - Back removes the current page from the trail and opens the one before it.
   - If the student used the browser's own Back/Forward button, the trail is
     trimmed to match, so the two never disagree.
   - Pages that only redirect somewhere else straight away (for example a
     dashboard that bounces a signed-out visitor to the login page) are taken
     out of the trail, so Back never gets stuck on them.
   - With nothing earlier in the trail the button falls back to a sensible
     parent page (dashboard / sign-in / portal home); on the portal home it
     goes back to wherever the student came from (e.g. the Simulator Hub) and
     is hidden when there is nowhere to go.
   Nothing here touches the pages' own data, storage or buttons.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__etpNavBack) return;
  window.__etpNavBack = true;

  var TRAIL_KEY = 'etpNavTrail_v1';   // the trail of pages visited in this tab
  var FLAG_KEY = 'etpBackInFlight_v1'; // set when Back was pressed, read by the next page
  var AUTO_KEY = 'etpAutoBack_v1';    // set when Back landed on a pure-redirect page
  var MAX_TRAIL = 40, MAX_AUTO_HOPS = 3;
  var loadedAt = Date.now();
  var interacted = false;
  var arrivedByBack = false;
  var hubUrl = null;   // set once we have confirmed the Simulator Hub exists next to this portal

  function ss() { try { return window.sessionStorage; } catch (e) { return null; } }
  function readTrail() {
    var s = ss(); if (!s) return [];
    try { var a = JSON.parse(s.getItem(TRAIL_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function writeTrail(a) { var s = ss(); if (s) { try { s.setItem(TRAIL_KEY, JSON.stringify(a.slice(-MAX_TRAIL))); } catch (e) {} } }
  function flag(k, v) { var s = ss(); if (!s) return null; try { if (v === undefined) { var r = s.getItem(k); return r; } if (v === null) s.removeItem(k); else s.setItem(k, v); } catch (e) {} return null; }
  function here() { return location.pathname + location.search; }
  function navType() {
    try { var e = performance.getEntriesByType('navigation')[0]; return e ? e.type : 'navigate'; } catch (e) { return 'navigate'; }
  }
  function sameOrigin(u) { try { return new URL(u, location.href).origin === location.origin; } catch (e) { return false; } }

  /* Keep the trail in step with where the student actually is. */
  function sync(fromCache) {
    var t = readTrail(), cur = here(), i = t.lastIndexOf(cur);
    var type = fromCache ? 'back_forward' : navType();
    if (type === 'back_forward' && i >= 0) t = t.slice(0, i + 1);   // browser Back/Forward: trim to match
    else if (t[t.length - 1] !== cur) t.push(cur);                  // ordinary navigation: remember this page
    writeTrail(t);
    return t;
  }

  /* Where to go when the trail has nothing earlier. null = nowhere sensible. */
  function fallback() {
    var p = location.pathname;
    var dir = p.replace(/[^\/]*$/, '');
    var file = p.slice(dir.length) || 'index.html';
    var inPages = /\/pages\/$/.test(dir), inCt = /\/ct\/$/.test(dir);
    var root = (inPages || inCt) ? dir.replace(/(pages|ct)\/$/, '') : dir;
    if (inPages) return file === 'dashboard.html' ? root + 'index.html' : dir + 'dashboard.html';
    if (inCt) {
      if (file === 'index.html') return root + 'login.html';
      return file === 'dashboard.html' ? dir + 'index.html' : dir + 'dashboard.html';
    }
    if (file === 'index.html') {
      var r = document.referrer;
      if (r && sameOrigin(r)) { try { var u = new URL(r); if (u.pathname.indexOf(dir) !== 0) return u.pathname + u.search; /* only a page OUTSIDE this portal, e.g. the hub */ } catch (e) {} }
      return hubUrl;   // the Simulator Hub one folder up, when this portal is hosted with it
    }
    return root + 'index.html';
  }

  function target() {
    var t = readTrail(), cur = here();
    if (t[t.length - 1] === cur) t = t.slice(0, -1);
    return t.length ? t[t.length - 1] : fallback();
  }

  function goBack() {
    var t = readTrail(), cur = here();
    if (t[t.length - 1] === cur) t.pop();
    var dest = t.length ? t[t.length - 1] : fallback();
    if (!dest) return;
    writeTrail(t);
    flag(FLAG_KEY, '1');
    location.href = dest;
  }
  window.etpGoBack = goBack;

  /* ---- the button: a small round arrow in the top corner (top-right on Arabic/RTL pages) ----
     It only ever sits in free space: if text, a link or a button is underneath it, it slides down the edge to
     the first spot where nothing is. */
  var btn = null, slotTop = 8, scrolling = false, scrollTimer = null;
  function isRtl() {
    var d = document.documentElement;
    return d.getAttribute('dir') === 'rtl' || (d.getAttribute('lang') || '').slice(0, 2) === 'ar';
  }
  /* How bad would it be to put the arrow here? Clickable things underneath cost the most, pictures a little,
     plain text the least, empty background nothing. */
  function kindCost(e) {
    if (e.namespaceURI === 'http://www.w3.org/2000/svg') return 3;
    if (/^(A|BUTTON|INPUT|SELECT|TEXTAREA|LABEL)$/.test(e.tagName) || e.hasAttribute('onclick') || e.getAttribute('role') === 'button') return 10;
    if (/^(IMG|CANVAS|VIDEO)$/.test(e.tagName)) return 3;
    if (/^(H[1-6]|P|LI|TD|TH|SMALL|STRONG|B|I|EM|CODE|PRE|SPAN)$/.test(e.tagName)) return 1;
    for (var c = e.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3 && c.textContent.replace(/\s+/g, '')) return 1; }
    return 0;
  }
  function slotCost(left, top, size) {
    var total = 0;
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        var x = left + (size - 1) * i / 2, y = top + (size - 1) * j / 2;
        var els = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
        for (var k = 0; k < els.length; k++) {
          var e = els[k];
          if (e === btn || (btn && btn.contains(e))) continue;
          if (e === document.documentElement || e === document.body) break;
          var c = kindCost(e);
          if (c) { total += c; break; }
        }
      }
    }
    return total;
  }
  function placeButton(force) {
    if (!btn || btn.style.display === 'none') return;
    var size = btn.offsetWidth || 36;
    var left = isRtl() ? window.innerWidth - 8 - size : 8;
    var cur = slotCost(left, slotTop, size);
    if (!force && cur === 0) return;                                   // current spot is free: stay put
    var maxTop = Math.max(60, Math.round(window.innerHeight * 0.7)), cands = [];
    for (var t = 8; t <= maxTop; t += 36) cands.push({ t: t, c: slotCost(left, t, size) });
    var pick = null, i;
    for (i = 0; i < cands.length; i++) { if (cands[i].c === 0 && cands[i].t <= 120) { pick = cands[i]; break; } }   // free spot near the top
    if (!pick && cands[0].c < 10) pick = cands[0];                    // only a little text under the corner: keep the corner
    if (!pick) { pick = cands[0]; for (i = 1; i < cands.length; i++) { if (cands[i].c < pick.c) pick = cands[i]; } }
    if (!force && cur <= pick.c) return;
    slotTop = pick.t; btn.style.top = pick.t + 'px';
  }

  function build() {
    if (btn || !document.body) return;
    var css = document.createElement('style');
    css.textContent =
      '#etpNavBack{position:fixed;top:8px;inset-inline-start:8px;z-index:2147483000;display:none;align-items:center;justify-content:center;' +
      'width:36px;height:36px;padding:0;border:1px solid rgba(23,48,79,.4);border-radius:50%;background:#fff;color:#17304f;' +
      'font:700 20px/1 Arial,Helvetica,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);opacity:.95;-webkit-tap-highlight-color:transparent}' +
      '#etpNavBack:hover{background:#eaf1fa;opacity:1}#etpNavBack:focus-visible{outline:3px solid #f2c14e;outline-offset:2px}' +
      '#etpNavBack .etp-ar{display:block;line-height:1;margin-top:-1px}' +
      '[dir=rtl] #etpNavBack .etp-ar,html[lang^=ar] #etpNavBack .etp-ar{transform:scaleX(-1)}' +
      '@media print{#etpNavBack{display:none!important}}' +
      '@media (max-width:600px){#etpNavBack{width:40px;height:40px}}';
    document.head.appendChild(css);
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'etpNavBack';
    btn.innerHTML = '<span class="etp-ar" aria-hidden="true">\u2190</span>';
    btn.addEventListener('click', goBack);
    document.body.appendChild(btn);
    refresh();
    window.addEventListener('scroll', function () {
      scrolling = true; clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () { scrolling = false; placeButton(false); }, 450);
    }, { passive: true });
    window.addEventListener('resize', function () { placeButton(true); });
    window.addEventListener('load', function () { placeButton(false); });
    setInterval(function () { if (!scrolling) placeButton(false); }, 1200);
  }
  function refresh() {
    if (!btn) return;
    var show = !!target();
    var was = btn.style.display;
    btn.style.display = show ? 'flex' : 'none';
    var rtl = isRtl();
    btn.setAttribute('aria-label', rtl ? '\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u0635\u0641\u062d\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629' : 'Go back to the previous page');
    btn.title = rtl ? '\u0631\u062c\u0648\u0639' : 'Back';
    if (show && was !== 'flex') placeButton(true);
  }

  /* ---- boot ---- */
  arrivedByBack = flag(FLAG_KEY) === '1';
  flag(FLAG_KEY, null);
  sync(false);

  ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, function () { interacted = true; flag(AUTO_KEY, null); }, { capture: true, passive: true });
  });

  /* A page that sends the visitor straight on (no click, within ~1.5s) is not a real stop:
     take it out of the trail, and if Back had just brought us here, keep going back. */
  window.addEventListener('pagehide', function (ev) {
    if (ev && ev.persisted) return;
    if (interacted || Date.now() - loadedAt > 1500) return;
    var t = readTrail();
    if (t[t.length - 1] === here()) { t.pop(); writeTrail(t); }
    if (arrivedByBack) flag(AUTO_KEY, String((parseInt(flag(AUTO_KEY) || '0', 10) || 0) + 1));
  });

  /* Back landed on a redirect-only page that bounced us forward: go back once more (max 3 hops). */
  var hops = parseInt(flag(AUTO_KEY) || '0', 10) || 0;
  if (hops > 0) {
    flag(AUTO_KEY, null);
    // only when we were sent here by the redirect itself — never after the browser's own Back/Forward
    if (hops <= MAX_AUTO_HOPS && navType() !== 'back_forward' && target()) { setTimeout(goBack, 0); }
  }

  /* On the portal home with nowhere earlier to go: if the Simulator Hub sits one folder up, Back goes there. */
  (function findHub() {
    var path = location.pathname;
    var dir = path.substring(0, path.lastIndexOf('/') + 1);
    var file = path.substring(dir.length) || 'index.html';
    var inSub = dir.slice(-7) === '/pages/' || dir.slice(-4) === '/ct/';
    if (file !== 'index.html' || inSub || !window.fetch) return;
    try {
      var hub = new URL('../index.html', location.href);
      fetch(hub.href, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (r.ok && ct.indexOf('html') !== -1) { hubUrl = hub.pathname; refresh(); }
      }).catch(function () {});
    } catch (e) {}
  })();

  window.addEventListener('pageshow', function (ev) { if (ev.persisted) { sync(true); refresh(); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
  try { new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] }); } catch (e) {}
  window.addEventListener('storage', refresh);
})();
