/* Firefox + file:// guard (v20).
   Firefox gives every file opened from a folder (file://) its own private storage, so the sign-in saved by login.html is invisible to the
   dashboard; the two pages then keep sending each other back (sign-in / dashboard / sign-in ...) until the tab crashes.
   Chrome/Edge share storage between files, and any browser works through a local server (http://localhost). */
(function(){
  try{
    if(location.protocol!=='file:' || !/Firefox\//.test(navigator.userAgent)) return;
    var h='<!doctype html><html><head><meta charset="utf-8"><title>Open with Chrome / Edge or a local server</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
    '<body style="margin:0;font-family:Segoe UI,Arial,sans-serif;background:#0b1f3a;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px">'+
    '<div style="max-width:560px;background:#12305a;border:1px solid #2a5a94;border-radius:12px;padding:26px 28px;line-height:1.55">'+
    '<h2 style="margin:0 0 10px;font-size:20px">Firefox cannot run this simulator from a folder</h2>'+
    '<p style="margin:0 0 10px">When a page is opened straight from a folder (<code>file://</code>), Firefox keeps each page\'s data separate, so sign-in and your progress cannot be shared between the pages. That is why sign-in kept flashing.</p>'+
    '<p style="margin:0 0 6px"><b>Pick one:</b></p>'+
    '<ol style="margin:0 0 10px 18px;padding:0"><li>Open the hub in <b>Chrome</b> or <b>Edge</b> (works as it is).</li>'+
    '<li>Or in Firefox: double-click <b>START_LOCAL_SERVER.bat</b> in the hub folder (needs Python), then use <code>http://localhost:8000</code>.</li></ol>'+
    '<p style="margin:0;font-size:13px;opacity:.8">Accounts are saved per browser, so create your account again in the browser you will use.</p>'+
    '</div></body></html>';
    document.open(); document.write(h); document.close();
  }catch(e){}
})();
