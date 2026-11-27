/* ==========================================================================
   GST Simulator — global "Back" button
   --------------------------------------------------------------------------
   The simulator is a single page that swaps screens in place, so the browser's
   own Back button used to leave the simulator altogether. This file keeps a
   history of the screens the student has been on and adds:

     - a floating "Back" button (bottom-left) that returns to the screen they
       were on just before: registration pages, returns, refunds, dashboards...
     - the same behaviour for the browser / phone Back button
     - Back also closes an open pop-up (login box, OTP box) first

   It only OBSERVES the app: the existing screen functions are wrapped (the
   original always runs first, untouched) and everything here is inside
   try/catch so a problem in this file can never stop a screen from opening.
   Nothing is stored; refreshing the page starts a fresh history at Home,
   exactly like the page itself does.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__gstNavBack) return;
  window.__gstNavBack = true;

  var MAX_STACK = 60;
  var RENDER_MS = 4600;                 // a screen opens after a 2-4s "please wait"
  var stack = [{ k: 'home' }];          // oldest first; [0] is always Home
  var replaying = false;                // true while Back is re-opening a screen (don't record that)
  var depth = 0;                        // >0 while inside a recorded page function (nested calls)
  var pendingRender = null;             // the page entry whose content we are waiting to see appear
  var pendingSince = 0;
  var mainEl = document.querySelector('.main');
  var homeNode = mainEl ? mainEl.firstElementChild : null;

  function $(id) { return document.getElementById(id); }
  function shown(el) { if (!el) return false; try { return getComputedStyle(el).display !== 'none'; } catch (e) { return false; } }
  function overlayVisible() { return shown($('featureBg')); }
  function modalOpen() { return shown($('modalBg')); }
  function otpOpen() { return shown($('otpOverlay')); }
  function loaderOn() { var l = $('gstLoaderOverlay'); return !!(l && l.classList.contains('show')); }
  function sameOriginRef() {
    try { var r = document.referrer; return !!r && new URL(r).origin === location.origin && r.split('#')[0] !== location.href.split('#')[0]; } catch (e) { return false; }
  }
  function cap() { if (stack.length > MAX_STACK) stack.splice(1, stack.length - MAX_STACK); }

  /* A returns/refund screen the student has closed with the X / by clicking outside is no longer "current". */
  function trimClosedFeatures() {
    if (overlayVisible() || loaderOn()) return;
    while (stack.length > 1) {
      var t = stack[stack.length - 1];
      if (t.k === 'feature' && Date.now() > t.t0 + RENDER_MS) stack.pop(); else break;
    }
  }

  /* ---- the screen the student is looking at, as it is right now (typed values included) ---- */
  function liveBody() {
    var host = document.querySelector('#featureBody .gst-real-content');
    if (!host) return null;
    var clone = host.cloneNode(true);
    var src = host.querySelectorAll('input,textarea,select');
    var dst = clone.querySelectorAll('input,textarea,select');
    for (var i = 0; i < src.length; i++) {
      var s = src[i], d = dst[i]; if (!d) continue;
      if (s.tagName === 'SELECT') {
        for (var k = 0; k < d.options.length; k++) { if (s.options[k] && s.options[k].selected) d.options[k].setAttribute('selected', ''); else d.options[k].removeAttribute('selected'); }
      } else if (s.tagName === 'TEXTAREA') { d.textContent = s.value; }
      else if (s.type === 'checkbox' || s.type === 'radio') { if (s.checked) d.setAttribute('checked', ''); else d.removeAttribute('checked'); }
      else if (s.type !== 'file' && s.type !== 'password') { d.setAttribute('value', s.value); }
    }
    return clone.innerHTML;
  }

  /* ---- recording screens ---- */
  function onFeature(title, sub, body) {
    if (replaying) return;
    trimClosedFeatures();
    var top = stack[stack.length - 1];
    var same = top && top.k === 'feature' && top.title === title && top.sub === sub;
    if (same) { top.body = body; top.t0 = Date.now(); return; }          // same module re-drawn (e.g. after Save)
    if (top && top.k === 'feature' && overlayVisible() && Date.now() > top.t0 + RENDER_MS) {
      var live = liveBody(); if (live) top.body = live;                  // remember the screen as the student left it
    }
    stack.push({ k: 'feature', title: title, sub: sub, body: body, t0: Date.now() });
    cap();
  }

  function onPage(name, args) {
    var json = null; try { json = JSON.stringify(args); } catch (e) {}
    var entry = { k: 'page', fn: name, args: json ? JSON.parse(json) : [], json: json, node: null, t0: Date.now() };
    if (replaying) return;                                   // Back is re-opening a screen: replay() tracks its node itself
    trimClosedFeatures();
    var top = stack[stack.length - 1];
    if (depth > 0 && top && top.k === 'page') stack[stack.length - 1] = entry;           // a screen that immediately opens another
    else if (top && top.k === 'page' && top.fn === name && top.json === json) { top.t0 = entry.t0; entry = top; }   // same screen drawn again
    else stack.push(entry);
    pendingRender = entry; pendingSince = Date.now();
    cap();
  }

  /* find the node that the page really rendered, so we can later tell when something else replaced it */
  if (mainEl && window.MutationObserver) {
    try {
      new MutationObserver(function () {
        if (pendingRender && Date.now() - pendingSince < 8000) { pendingRender.node = mainEl.firstElementChild; pendingRender = null; }
      }).observe(mainEl, { childList: true });
    } catch (e) {}
  }

  var PAGE_FNS = ['registrationPage', 'showPANMappedRegistrations', 'showTRNGenerated', 'showSavedRegistrationApplication',
    'openTRNPartB', 'gstOpenFirstTimeLogin', 'openFirstTimeLoginSetup', 'renderGSTTaxpayerLogin'];
  PAGE_FNS.forEach(function (name) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig.__gstNavWrapped) return;
    var w = function () {
      var args = Array.prototype.slice.call(arguments);
      try { onPage(name, args); } catch (e) {}
      depth++;
      try { return orig.apply(this, arguments); } finally { depth--; }
    };
    w.__gstNavWrapped = true;
    window[name] = w;
  });
  if (typeof window.feature === 'function' && !window.feature.__gstNavWrapped) {
    var origFeature = window.feature;
    var wf = function (title, sub, body) {
      try { onFeature(title, sub, body); } catch (e) {}
      return origFeature.apply(this, arguments);
    };
    wf.__gstNavWrapped = true;
    window.feature = wf;
  }

  /* ---- "Continue where you left off" for EVERY screen ----
     After the student presses any Save / Draft button on a returns / refund / etc. screen, remember that screen
     as it looks (typed values included) so the Home page can reopen it next time. Screens that already have their
     own opener (script.js remembers those) are skipped; this covers all the rest. */
  var SNAP_KEY = 'gstLastScreen', saveClickAt = 0, snapTimer = null;
  function snapshotNow() {
    try {
      if (!saveClickAt || !overlayVisible()) return;
      var top = stack[stack.length - 1]; if (!top || top.k !== 'feature') return;
      var p = null; try { p = JSON.parse(localStorage.getItem('gstLastDraft') || 'null'); } catch (e) {}
      if (p && p.at && Date.parse(p.at) >= saveClickAt - 100) { localStorage.removeItem(SNAP_KEY); return; }
      var body = liveBody(); if (!body || body.length > 600000) return;
      localStorage.setItem(SNAP_KEY, JSON.stringify({ title: top.title, sub: top.sub, body: body, at: new Date().toISOString() }));
    } catch (e) {}
  }
  document.addEventListener('click', function (ev) {
    try {
      var t = ev.target && ev.target.closest && ev.target.closest('button,[onclick],a,input[type=button],input[type=submit]');
      if (!t || !t.closest('#featureBody .gst-real-content')) return;
      if (!/save|draft/i.test((t.getAttribute('onclick') || '') + ' ' + (t.innerText || t.value || ''))) return;
      saveClickAt = Date.now();
      clearTimeout(snapTimer); snapTimer = setTimeout(snapshotNow, RENDER_MS + 700);
    } catch (e) {}
  }, true);
  function flushSnap() { if (saveClickAt) snapshotNow(); }
  window.addEventListener('pagehide', flushSnap);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushSnap(); });

  /* ---- going back ---- */
  function hideLayers() {
    var fb = $('featureBg'); if (fb) fb.style.display = 'none';
    var mb = $('modalBg'); if (mb) mb.style.display = 'none';
    var ov = $('otpOverlay'); if (ov) { ov.classList.remove('open'); ov.style.display = 'none'; }
    document.body.style.overflow = '';
  }
  function hideModals() {
    var mb = $('modalBg'); if (mb) mb.style.display = 'none';
    var ov = $('otpOverlay'); if (ov) { ov.classList.remove('open'); ov.style.display = 'none'; }
  }
  function replay(e) {
    replaying = true; window.__gstNavFast = true;
    try {
      if (e.k === 'home') {
        hideLayers();
        if (homeNode && mainEl && mainEl.firstElementChild === homeNode) document.body.classList.remove('registration-mode');
        else { location.reload(); return; }                                 // Home was replaced: reload brings it back exactly
      } else if (e.k === 'page') {
        hideLayers();
        var f = window[e.fn];
        e.node = null; pendingRender = e; pendingSince = Date.now();         // learn which node this screen draws
        if (typeof f === 'function') f.apply(null, e.args || []); else { stack.length = 1; replay(stack[0]); return; }
      } else if (e.k === 'feature') {
        hideModals();
        e.t0 = Date.now();
        window.feature(e.title, e.sub, e.body);
      }
    } catch (err) {
      try { console.warn('Back: could not reopen screen', err); } catch (x) {}
    } finally {
      setTimeout(function () { replaying = false; window.__gstNavFast = false; }, 400);
    }
  }
  function isChild(top) {
    // the visible page is something the app drew by itself on top of the recorded one (a sub-step)
    if (!mainEl || overlayVisible() || loaderOn()) return false;
    if (top.k === 'home') return !!homeNode && mainEl.firstElementChild !== homeNode;
    if (top.k === 'page') return !!top.node && mainEl.firstElementChild !== top.node;
    return false;
  }
  function canGoBackInApp() {
    if (modalOpen() || otpOpen()) return true;
    trimClosedFeatures();
    var top = stack[stack.length - 1];
    return stack.length > 1 || isChild(top);
  }
  function goBack() {
    if (loaderOn()) return;                                                // a screen is still opening
    if (modalOpen() || otpOpen()) { hideModals(); return; }
    trimClosedFeatures();
    var top = stack[stack.length - 1];
    if (isChild(top)) { replay(top); return; }
    if (stack.length > 1) { stack.pop(); replay(stack[stack.length - 1]); return; }
    if (sameOriginRef()) location.href = document.referrer;               // Home: back to wherever the student came from
  }
  window.gstGoBack = goBack;

  /* ---- browser / phone Back button ----
     One extra history entry (the "guard") is added after the student's first tap; when the browser's Back
     lands on the entry beneath it we turn that into an in-app Back and put the guard back. At Home it is
     left alone, so Back then leaves the simulator as usual. */
  var guardArmed = false;
  try { if (history.state && history.state.gstGuard) guardArmed = true; } catch (e) {}
  function armGuard() {
    if (guardArmed) return;
    try {
      history.replaceState(Object.assign({}, history.state || {}, { gstBase: 1 }), '');
      history.pushState({ gstGuard: 1 }, '');
      guardArmed = true;
    } catch (e) {}
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, armGuard, { capture: true, passive: true });
  });
  window.addEventListener('popstate', function (ev) {
    var st = ev.state || {};
    if (st.gstGuard) { guardArmed = true; return; }
    if (st.gstBase) {
      guardArmed = false;
      if (canGoBackInApp()) {
        goBack();
        try { history.pushState({ gstGuard: 1 }, ''); guardArmed = true; } catch (e) {}
      } else {
        history.back();                                                     // nothing left inside: leave the simulator
      }
    }
  });

  /* ---- the button: a small round arrow in the top-left corner ----
     It only ever sits in free space: if text, a link or a button is underneath it, it slides down the left edge
     to the first spot where nothing is. */
  var btn = null, slotTop = 8, scrolling = false, scrollTimer = null;
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
    var left = 8;
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
      '#gstNavBack{position:fixed;top:8px;left:8px;z-index:1000001;display:none;align-items:center;justify-content:center;' +
      'width:36px;height:36px;padding:0;border:1px solid rgba(26,60,117,.45);border-radius:50%;background:#fff;color:#1a3c75;' +
      'font:700 20px/1 Arial,Helvetica,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);opacity:.95;-webkit-tap-highlight-color:transparent}' +
      '#gstNavBack:hover{background:#eaf1fa;opacity:1}#gstNavBack:focus-visible{outline:3px solid #f2c14e;outline-offset:2px}' +
      '#gstNavBack .gst-nb-ar{display:block;line-height:1;margin-top:-1px}' +
      '@media print{#gstNavBack{display:none!important}}' +
      '@media (max-width:600px){#gstNavBack{width:40px;height:40px}}';
    document.head.appendChild(css);
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'gstNavBack';
    btn.setAttribute('aria-label', 'Go back to the previous screen');
    btn.title = 'Back';
    btn.innerHTML = '<span class="gst-nb-ar" aria-hidden="true">\u2190</span>';
    btn.addEventListener('click', goBack);
    document.body.appendChild(btn);
    refresh();
    window.addEventListener('scroll', function () {
      scrolling = true; clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () { scrolling = false; placeButton(false); }, 450);
    }, { passive: true, capture: true });
    window.addEventListener('resize', function () { placeButton(true); });
  }
  var placeTick = 0;
  function refresh() {
    if (!btn) return;
    var gate = $('studentGate');
    var gateUp = gate && shown(gate);
    var show = !gateUp && !loaderOn() && (canGoBackInApp() || sameOriginRef());
    var was = btn.style.display;
    btn.style.display = show ? 'flex' : 'none';
    if (!show) return;
    if (was !== 'flex') { placeButton(true); return; }
    if (!scrolling && ++placeTick % 4 === 0) placeButton(false);       // roughly every 1.4s
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
  setInterval(refresh, 350);
})();
