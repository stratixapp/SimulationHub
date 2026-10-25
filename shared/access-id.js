/* =====================================================================
   DOT ACCESS — the ONE place the 9-digit access / developer code lives.
   ---------------------------------------------------------------------
   Used by:  index.html (hub: restricted simulators)
             logistics-simulator/engine.js + skelora-institute-dashboard.html
               (Logistics -> TCOS bridge access ID)
             logistics-simulator/lyra-lock.js (Lyra developer code)
   API:      DotAccess.check(value) -> true / false
   Change the code: compute h53(SALT + "NEWCODE") with the function below
   (e.g. in the browser console) and replace CODE_HASH. Nothing else to edit.
   The code is stored only as a hash, never as plain text.
   Client-side only: a deterrent for students, not real security.
   ===================================================================== */
(function(){
  "use strict";
  const SALT = "dot-access|";
  const CODE_HASH = 2188548038217685;
  function h53(str, seed){
    seed = seed || 0;
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for(let i = 0, ch; i < str.length; i++){
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  window.DotAccess = {
    check: function(v){ try{ return h53(SALT + String(v == null ? "" : v).trim()) === CODE_HASH; }catch(e){ return false; } }
  };
})();
