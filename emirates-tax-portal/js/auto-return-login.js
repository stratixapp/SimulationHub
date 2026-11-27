/* ============================================================
   Auto-return-to-login helper
   ------------------------------------------------------------
   Used by uaepass-create.html and emirates-id-create.html after a
   successful standalone creation (i.e. reached directly from the
   VAT Login page, before any VAT account exists). Once the student
   is done, it automatically takes them back to that same Login
   page so they can either "Sign Up" for VAT or continue to
   Corporate Tax — without requiring a manual click.

   Any action button on the success screen (download PDF, apply for
   Emirates ID / create UAE PASS, continue to VAT sign up) cancels
   the countdown, since the student has chosen to do something else.
   ============================================================ */
function startAutoReturnToLogin(seconds) {
  var host = document.getElementById("autoRedirectNote");
  if (!host) return function cancel() {};
  var remaining = seconds || 6;
  var cancelled = false;
  var timer = null;
  var TARGET = "general-login.html"; // the portal chooser: pick VAT or Corporate Tax
  window.__autoReturnTarget = TARGET; // debug/test hook only — not used by the app itself

  function render() {
    host.innerHTML =
      'Returning to choose VAT or Corporate Tax in ' + remaining + 's &mdash; ' +
      '<a href="' + TARGET + '" style="font-weight:700">go now</a> or ' +
      '<a href="#" data-stay style="color:var(--text-muted)">stay on this page</a>';
  }

  function tick() {
    if (cancelled) return;
    remaining -= 1;
    if (remaining <= 0) {
      window.__autoReturnFired = true; // debug/test hook only
      window.location.href = TARGET;
      return;
    }
    render();
    timer = setTimeout(tick, 1000);
  }

  function cancel() {
    cancelled = true;
    if (timer) clearTimeout(timer);
    host.innerHTML = '<a href="' + TARGET + '" style="color:var(--text-muted)">go straight to VAT / Corporate Tax</a>';
  }

  render();
  timer = setTimeout(tick, 1000);
  host.addEventListener("click", function (e) {
    var stay = e.target.closest("[data-stay]");
    if (stay) { e.preventDefault(); cancel(); }
  });

  // Any other action on the success screen means "not now" — cancel.
  var successWrap = document.getElementById("successWrap");
  if (successWrap) {
    successWrap.querySelectorAll("button, a").forEach(function (el) {
      if (el === host || host.contains(el)) return;
      el.addEventListener("click", cancel);
    });
  }

  return cancel;
}
