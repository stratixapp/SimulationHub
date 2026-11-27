/* =========================================================================
   DOT ECOSYSTEM — shared footer credit + "About" modal.
   Include this file on any page (intro, login, dashboard) with:
     <script src="dot-ecosystem.js"></script>
   Then either:
     - drop <div id="dotFooterSlot"></div> where you want the credit line, or
     - call dotRenderFooter('someContainerId') manually, or
     - call dotShowAbout() directly from your own button (e.g. Settings → About).
   Self-contained: injects its own <style> and modal markup once per page,
   independent of any other modal system already on the page.
   ========================================================================= */
(function(){

  var STYLE_ID = 'dot-eco-styles';
  var MODAL_ID = 'dot-eco-modal';

  function injectStyles(){
    if(document.getElementById(STYLE_ID)) return;
    var css = ''
    + '.dot-footer{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;padding:16px 20px;font-size:12px;color:var(--dot-footer-c,#8C96A6);}'
    + '.dot-footer .dot-credit{display:flex;align-items:center;gap:6px;}'
    + '.dot-footer .dot-dot{width:5px;height:5px;border-radius:50%;background:#E9A227;display:inline-block;flex-shrink:0;}'
    + '.dot-footer button.dot-more{appearance:none;border:none;background:none;padding:0;margin:0;font:inherit;font-weight:700;color:#1F6FEB;cursor:pointer;text-decoration:underline;text-underline-offset:2px;}'
    + '.dot-footer button.dot-more:hover{color:#E9A227;}'
    + '#' + MODAL_ID + '{position:fixed;inset:0;z-index:9999;display:none;align-items:flex-start;justify-content:center;'
    +   'background:rgba(8,14,26,.6);backdrop-filter:blur(3px);padding:5vh 18px;overflow-y:auto;}'
    + '#' + MODAL_ID + '.dot-open{display:flex;}'
    + '#' + MODAL_ID + ' .dot-panel{width:100%;max-width:660px;background:#fff;border-radius:18px;box-shadow:0 30px 80px rgba(8,14,26,.45);'
    +   'position:relative;overflow:hidden;animation:dotPop .18s cubic-bezier(.2,.9,.25,1);margin-bottom:5vh;}'
    + '@keyframes dotPop{from{transform:scale(.96) translateY(6px);opacity:0;}to{transform:scale(1) translateY(0);opacity:1;}}'
    + '#' + MODAL_ID + ' .dot-hero{background:linear-gradient(135deg,#0B2A4A 0%,#123A63 55%,#0E8074 130%);padding:34px 30px 26px;color:#fff;position:relative;overflow:hidden;}'
    + '#' + MODAL_ID + ' .dot-hero::after{content:"";position:absolute;width:260px;height:260px;border-radius:50%;background:rgba(233,162,39,.20);filter:blur(50px);top:-90px;right:-60px;}'
    + '#' + MODAL_ID + ' .dot-hero-row{display:flex;align-items:center;gap:12px;position:relative;z-index:1;}'
    + '#' + MODAL_ID + ' .dot-mark{width:40px;height:40px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;'
    +   'background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);font-weight:800;font-size:15px;letter-spacing:-.02em;}'
    + '#' + MODAL_ID + ' .dot-eyebrow{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#BFD9CF;margin:0 0 3px;}'
    + '#' + MODAL_ID + ' .dot-hero h2{margin:0;font-size:21px;font-weight:800;letter-spacing:-.01em;}'
    + '#' + MODAL_ID + ' .dot-hero p{margin:12px 0 0;font-size:13px;line-height:1.65;color:#D7E3F0;max-width:520px;position:relative;z-index:1;}'
    + '#' + MODAL_ID + ' .dot-close{position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:9px;border:1px solid rgba(255,255,255,.25);'
    +   'background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2;}'
    + '#' + MODAL_ID + ' .dot-close:hover{background:rgba(255,255,255,.18);}'
    + '#' + MODAL_ID + ' .dot-close svg{width:15px;height:15px;stroke:#fff;}'
    + '#' + MODAL_ID + ' .dot-body{padding:26px 30px 30px;max-height:60vh;overflow-y:auto;}'
    + '#' + MODAL_ID + ' .dot-section{margin-bottom:22px;}'
    + '#' + MODAL_ID + ' .dot-section:last-child{margin-bottom:0;}'
    + '#' + MODAL_ID + ' .dot-section h3{margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#5B6472;}'
    + '#' + MODAL_ID + ' .dot-section p{margin:0 0 8px;font-size:13.4px;line-height:1.72;color:#333D4B;}'
    + '#' + MODAL_ID + ' .dot-pill-grid{display:flex;flex-wrap:wrap;gap:8px;}'
    + '#' + MODAL_ID + ' .dot-pill{font-size:12px;font-weight:600;padding:6px 12px;border-radius:20px;background:#F1F5FB;border:1px solid #E3E8EF;color:#0B2A4A;}'
    + '#' + MODAL_ID + ' .dot-pill.dot-you{background:#FBF1DE;border-color:#F0D9A6;color:#8A5D00;}'
    + '#' + MODAL_ID + ' .dot-cat{margin-bottom:14px;}'
    + '#' + MODAL_ID + ' .dot-cat-label{font-size:11.5px;font-weight:700;color:#1F6FEB;margin-bottom:6px;}'
    + '#' + MODAL_ID + ' .dot-infra-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;}'
    + '#' + MODAL_ID + ' .dot-infra-item{font-size:12.6px;color:#333D4B;padding:6px 0;border-bottom:1px dashed #E7EBF1;}'
    + '#' + MODAL_ID + ' .dot-infra-item b{color:#0B2A4A;font-weight:700;}'
    + '#' + MODAL_ID + ' .dot-founder{display:flex;gap:14px;align-items:flex-start;background:#F8FAFD;border:1px solid #E7EBF1;border-radius:12px;padding:16px;}'
    + '#' + MODAL_ID + ' .dot-founder-av{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#1F6FEB,#0E8074);'
    +   'display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;flex-shrink:0;}'
    + '#' + MODAL_ID + ' .dot-founder h4{margin:0 0 2px;font-size:13.6px;font-weight:800;color:#0B2A4A;}'
    + '#' + MODAL_ID + ' .dot-founder .dot-role{font-size:11px;font-weight:700;color:#0E8074;text-transform:uppercase;letter-spacing:.03em;margin-bottom:6px;}'
    + '#' + MODAL_ID + ' .dot-founder p{margin:0;font-size:12.6px;line-height:1.65;color:#5B6472;}'
    + '#' + MODAL_ID + ' .dot-modal-foot{padding:14px 30px;border-top:1px solid #EDF0F4;font-size:11px;color:#8C96A6;text-align:center;}'
    + '@media(max-width:560px){#' + MODAL_ID + ' .dot-infra-grid{grid-template-columns:1fr;}}';
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  var BUILT_WITH = ["Documentation Simulator", "ERP Simulator"];

  var CATEGORIES = [
    {label:"Enterprise Software", items:["Stratix One","Stratix Pro","Stratix Lite","BuildBoss","LAM ERP","Filio","VivahPatra"]},
    {label:"Financial Solutions", items:["Paisa+","Paisa Pro+"]},
    {label:"Trust & Business Networks", items:["Connect","Connect Flow"]},
    {label:"Artificial Intelligence", items:["NovelForge AI","StorySoul","Grimoire"]},
    {label:"Education Technology", items:["Documentation Simulator","ERP Simulator"]}
  ];

  var INFRA = [
    ["DOT Base","Backend-as-a-Service — databases, auth, storage"],
    ["DOT Deploy","Cloud application deployment platform"],
    ["DOT Pulse","Universal API Gateway"],
    ["DOT X Apache","Secrets management for credentials & keys"],
    ["Ghost Backend","Cybersecurity — Moving Target Defense"],
    ["DOT X Runway","Internal Developer Platform"],
    ["DOT Mesh","Secure service networking"],
    ["DOT SQL","Intelligent database platform"],
    ["DOT NNF","Neural Network Framework"],
    ["DOT OSI","Open Source Intelligence platform"]
  ];

  function pillHtml(name){
    var isYou = BUILT_WITH.indexOf(name) !== -1;
    return '<span class="dot-pill' + (isYou ? ' dot-you' : '') + '">' + name + (isYou ? ' — you are here' : '') + '</span>';
  }

  function buildModalHtml(){
    var catsHtml = CATEGORIES.map(function(c){
      return '<div class="dot-cat"><div class="dot-cat-label">' + c.label + '</div><div class="dot-pill-grid">'
        + c.items.map(pillHtml).join('') + '</div></div>';
    }).join('');

    var infraHtml = INFRA.map(function(row){
      return '<div class="dot-infra-item"><b>' + row[0] + '</b> — ' + row[1] + '</div>';
    }).join('');

    return ''
    + '<div class="dot-panel">'
    + '  <button type="button" class="dot-close" id="dotEcoClose" aria-label="Close">'
    + '    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>'
    + '  </button>'
    + '  <div class="dot-hero">'
    + '    <div class="dot-hero-row">'
    + '      <div class="dot-mark">●</div>'
    + '      <div>'
    + '        <div class="dot-eyebrow">Built by</div>'
    + '        <h2>DOT Ecosystem</h2>'
    + '      </div>'
    + '    </div>'
    + '    <p>Engineering the Future. One Platform at a Time. A unified digital ecosystem where businesses, developers, institutions and individuals access powerful, connected software through a single platform.</p>'
    + '  </div>'
    + '  <div class="dot-body">'
    + '    <div class="dot-section">'
    + '      <h3>What This Simulator Is Part Of</h3>'
    + '      <p>Skelora Institute Logistics Simulator is one of two products in DOT Ecosystem\'s <b>Education Technology</b> line — professional learning platforms built to bridge theory and real industry practice.</p>'
    + '    </div>'
    + '    <div class="dot-section">'
    + '      <h3>Vision &amp; Mission</h3>'
    + '      <p>To build one of the world\'s most trusted software ecosystems — delivering secure, scalable, intelligent software that simplifies complex operations while making enterprise-grade technology accessible to organizations of every size.</p>'
    + '    </div>'
    + '    <div class="dot-section">'
    + '      <h3>What DOT Ecosystem Builds</h3>'
    +        catsHtml
    + '    </div>'
    + '    <div class="dot-section">'
    + '      <h3>DOT Infrastructure</h3>'
    + '      <p>Every product runs on the same cloud-native technology stack:</p>'
    + '      <div class="dot-infra-grid">' + infraHtml + '</div>'
    + '    </div>'
    + '    <div class="dot-section">'
    + '      <h3>The Founder</h3>'
    + '      <div class="dot-founder">'
    + '        <div class="dot-founder-av">AS</div>'
    + '        <div>'
    + '          <h4>Ananthu Shaji</h4>'
    + '          <div class="dot-role">Founder &amp; Creator — DOT Ecosystem</div>'
    + '          <p>An independent software architect, product designer and technology entrepreneur, building an interconnected ecosystem of enterprise software, AI platforms, cloud infrastructure and industry-specific digital solutions. "One Ecosystem. Unlimited Solutions."</p>'
    + '        </div>'
    + '      </div>'
    + '    </div>'
    + '  </div>'
    + '  <div class="dot-modal-foot">© 2026 DOT Ecosystem. All Rights Reserved.</div>'
    + '</div>';
  }

  function ensureModal(){
    injectStyles();
    var modal = document.getElementById(MODAL_ID);
    if(modal) return modal;
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.innerHTML = buildModalHtml();
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e){ if(e.target === modal) closeAbout(); });
    document.getElementById('dotEcoClose').addEventListener('click', closeAbout);
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && modal.classList.contains('dot-open')) closeAbout();
    });
    return modal;
  }

  function showAbout(){
    var modal = ensureModal();
    modal.classList.add('dot-open');
  }
  function closeAbout(){
    var modal = document.getElementById(MODAL_ID);
    if(modal) modal.classList.remove('dot-open');
  }

  function renderFooter(mountId){
    injectStyles();
    var mount = mountId ? document.getElementById(mountId) : null;
    if(!mount){
      mount = document.createElement('div');
      document.body.appendChild(mount);
    }
    mount.innerHTML = ''
      + '<div class="dot-footer">'
      + '  <span class="dot-credit"><span class="dot-dot"></span>Developed by Ananthu Shaji — DOT Ecosystem</span>'
      + '  <button type="button" class="dot-more" id="dotFooterMoreBtn">Tap to see more</button>'
      + '</div>';
    document.getElementById('dotFooterMoreBtn').addEventListener('click', showAbout);
  }

  // Auto-render into any placeholder found on the page.
  function autoInit(){
    if(document.getElementById('dotFooterSlot')){
      renderFooter('dotFooterSlot');
    }
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  window.dotShowAbout = showAbout;
  window.dotRenderFooter = renderFooter;
})();
