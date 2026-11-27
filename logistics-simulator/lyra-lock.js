/* =====================================================================
   LYRA LOCK — "Developer Code" prompt
   ---------------------------------------------------------------------
   Lyra (assistant.js) is locked. Anything that is a Lyra "presence"
   (the floating Lyra button, the ✦ help buttons, the ✦ Explain buttons,
   the Lyra card in Create a Job) asks for the developer code first.
   The code is NOT remembered: when Lyra is closed (X) the lock comes
   back, so the next click asks again.

   API:  LyraLock.ask(onOk)   -> opens the code box; calls onOk() only
                                 when the correct code is entered.

   Note: this runs in the browser, so it is a deterrent for students,
   not real security. The code lives (hashed) only in shared/access-id.js.
   ===================================================================== */
(function(){
  "use strict";
  // The code is checked by the shared DotAccess module (shared/access-id.js): one code for the whole suite.
  const isCorrect = v => !!(window.DotAccess && window.DotAccess.check(v));

  function injectStyle(){
    if(document.getElementById("lylStyle")) return;
    const s = document.createElement("style"); s.id = "lylStyle";
    s.textContent =
      "#lylBack{position:fixed;inset:0;z-index:2147483000;background:rgba(15,25,60,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit;}" +
      "#lylBack .lyl-card{position:relative;width:min(380px,100%);background:#fff;border-radius:16px;padding:20px 22px 18px;box-shadow:0 24px 60px rgba(0,0,0,.4);color:#1F2A44;}" +
      "#lylBack .lyl-card.shake{animation:lylShake .35s;}" +
      "@keyframes lylShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}" +
      "#lylBack h3{margin:0 0 4px;font-size:16px;}" +
      "#lylBack p{margin:0 0 12px;font-size:12.8px;line-height:1.5;color:#3a4766;}" +
      "#lylBack .lyl-x{position:absolute;top:10px;right:12px;border:0;background:none;font-size:24px;line-height:1;color:#6b7690;cursor:pointer;padding:2px 6px;border-radius:6px;}" +
      "#lylBack .lyl-x:hover{background:#EEF1FA;color:#1F2A44;}" +
      "#lylBack input{width:100%;box-sizing:border-box;height:42px;border:1.5px solid #CBD3E4;border-radius:10px;padding:0 12px;font-size:16px;letter-spacing:2px;font-family:inherit;outline:none;color:#1F2A44;background:#fff;}" +
      "#lylBack input:focus{border-color:#5B6CFF;box-shadow:0 0 0 3px rgba(91,108,255,.18);}" +
      "#lylBack .lyl-err{min-height:18px;margin:6px 0 0;font-size:12.3px;font-weight:600;color:#C0392B;}" +
      "#lylBack .lyl-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:8px;}" +
      "#lylBack .lyl-actions button{height:36px;padding:0 16px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;border:1.5px solid #CBD3E4;background:#fff;color:#1F2A44;}" +
      "#lylBack .lyl-actions .lyl-go{background:#4F5BD5;border-color:#4F5BD5;color:#fff;}" +
      "@media print{#lylBack{display:none!important;}}";
    document.head.appendChild(s);
  }

  function ask(onOk){
    try{
      if(document.getElementById("lylBack")) return;
      injectStyle();
      const prevFocus = document.activeElement;
      const back = document.createElement("div"); back.id = "lylBack";
      back.setAttribute("role", "dialog"); back.setAttribute("aria-modal", "true"); back.setAttribute("aria-label", "Developer Code");
      back.innerHTML =
        '<div class="lyl-card">' +
          '<button type="button" class="lyl-x" aria-label="Close">\u00d7</button>' +
          '<h3>\ud83d\udd12 Developer Code</h3>' +
          '<p>Lyra is locked. Enter the developer code to open her.</p>' +
          '<input type="password" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Developer code" placeholder="Enter code">' +
          '<div class="lyl-err" role="alert"></div>' +
          '<div class="lyl-actions"><button type="button" class="lyl-cancel">Cancel</button><button type="button" class="lyl-go">Unlock</button></div>' +
        '</div>';
      document.body.appendChild(back);
      const card = back.querySelector(".lyl-card"), input = back.querySelector("input"), err = back.querySelector(".lyl-err");
      const close = () => { back.remove(); document.removeEventListener("keydown", onKey, true); try{ if(prevFocus && prevFocus.focus) prevFocus.focus(); }catch(e){} };
      const submit = () => {
        if(isCorrect(input.value)){ close(); try{ onOk && onOk(); }catch(e){} return; }
        err.textContent = "Wrong code. Try again.";
        input.value = ""; input.focus();
        card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
      };
      function onKey(e){
        if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); close(); }
        else if(e.key === "Enter" && back.contains(document.activeElement)){ e.preventDefault(); submit(); }
      }
      document.addEventListener("keydown", onKey, true);
      back.addEventListener("mousedown", e => { if(e.target === back) close(); });
      back.querySelector(".lyl-x").onclick = close;
      back.querySelector(".lyl-cancel").onclick = close;
      back.querySelector(".lyl-go").onclick = submit;
      input.addEventListener("input", () => { err.textContent = ""; });
      setTimeout(() => { try{ input.focus(); }catch(e){} }, 30);
    }catch(e){}
  }

  window.LyraLock = { ask };
})();
