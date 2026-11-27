/* =====================================================================
   LYRA WEB — optional "search the web" connector for Lyra (assistant.js)
   ---------------------------------------------------------------------
   A browser page cannot call Google/Bing directly (CORS + API keys), so this
   connector uses Wikipedia\u2019s public, key-free, CORS-enabled API:
       search:   en.wikipedia.org/w/api.php?action=query&list=search&origin=*
       summary:  en.wikipedia.org/api/rest_v1/page/summary/<title>
   It only runs when the student taps "Search the web" (never automatically),
   shows the source and a link, and always offers "Open in Google" as well.
   Everything returned is plain text (the summary extract) and is escaped by
   the caller. Offline / timeout / blocked network all end in a polite message.
   To use a different search service, replace window.LyraWeb.search with a
   function returning the same shape:
       Promise<{ok:true, results:[{title, extract, url, source}], googleUrl}
              | {ok:false, reason:"offline"|"timeout"|"error", googleUrl}>
   ===================================================================== */
(function(){
  "use strict";
  const API = "https://en.wikipedia.org/w/api.php";
  const SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/";
  const online = () => typeof navigator === "undefined" || navigator.onLine !== false;
  const googleUrl = q => "https://www.google.com/search?q=" + encodeURIComponent(String(q || "").trim() + " meaning logistics export import");

  async function getJson(url, ms){
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => { if(ctrl) ctrl.abort(); }, ms || 9000);
    try{
      const r = await fetch(url, ctrl ? {signal: ctrl.signal, headers: {"Accept": "application/json"}} : {headers: {"Accept": "application/json"}});
      if(!r.ok) throw new Error("HTTP " + r.status);
      if(!/json/i.test(r.headers.get("content-type") || "")) throw new Error("unexpected response");
      return await r.json();
    } finally { clearTimeout(timer); }
  }
  const searchUrl = q => API + "?action=query&list=search&srlimit=4&srprop=&format=json&origin=*&srsearch=" + encodeURIComponent(q);

  /* keep the first two or three sentences; never dump a whole article */
  function trimExtract(t){
    const s = String(t || "").replace(/\s+/g, " ").trim(); if(s.length <= 460) return s;
    const cut = s.slice(0, 460); const i = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
    return (i > 160 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, "") + "\u2026");
  }

  async function search(query){
    const q = String(query || "").trim(); const g = googleUrl(q);
    if(!q) return {ok: false, reason: "error", googleUrl: g};
    if(!online()) return {ok: false, reason: "offline", googleUrl: g};
    try{
      // the plain query, and the query with trade context ("IEC" alone is the electrical standards body)
      const [a, b] = await Promise.all([getJson(searchUrl(q)), getJson(searchUrl(q + " trade logistics customs")).catch(() => null)]);
      const titles = []; [a, b].forEach(res => { ((res && res.query && res.query.search) || []).forEach(x => { if(x && x.title && !titles.includes(x.title)) titles.push(x.title); }); });
      const top = titles.slice(0, 4);
      const sums = await Promise.all(top.map(t => getJson(SUMMARY + encodeURIComponent(t.replace(/ /g, "_")), 8000).catch(() => null)));
      const results = [];
      sums.forEach((s, i) => {
        if(!s || s.type === "disambiguation" || !s.extract) return;
        const url = s.content_urls && s.content_urls.desktop && s.content_urls.desktop.page ? s.content_urls.desktop.page : "https://en.wikipedia.org/wiki/" + encodeURIComponent(top[i].replace(/ /g, "_"));
        results.push({title: s.title || top[i], extract: trimExtract(s.extract), url, source: "Wikipedia", description: s.description || ""});
      });
      return {ok: true, results: results.slice(0, 3), googleUrl: g};
    }catch(e){
      return {ok: false, reason: e && e.name === "AbortError" ? "timeout" : (online() ? "error" : "offline"), googleUrl: g};
    }
  }

  window.LyraWeb = {search, googleUrl, online, trimExtract};
})();
