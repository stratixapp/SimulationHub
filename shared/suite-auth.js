/* ============================================================
   DOT ECOSYSTEM — shared suite account bridge
   Both Cadence and TCOS include this file. It does not replace
   either app's own login system — TCOS still owns real
   authentication (its demo-credential login). This just mirrors
   "who is currently signed in" into a small, shared localStorage
   key so any app in the suite can recognize the same account
   without asking the trainee to sign in twice.

   Works reliably wherever both apps are served from the same
   origin (e.g. one GitHub Pages site: yourname.github.io/repo/).
   Opening the folders directly as local files may not share
   storage across the two app folders, depending on the browser.
   ============================================================ */
(function () {
  'use strict';
  const KEY = 'dotecosystem_suite_account_v1';

  function getAccount() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setAccount(account) {
    try {
      if (account) localStorage.setItem(KEY, JSON.stringify(account));
      else localStorage.removeItem(KEY);
    } catch (e) {
      console.error('DOT_SUITE_AUTH: unable to persist account', e);
    }
  }

  function clearAccount() { setAccount(null); }

  // fires in OTHER tabs/windows when the account changes here — lets an
  // already-open Cadence tab pick up a login that just happened in TCOS
  function onAccountChange(handler) {
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) handler(getAccount());
    });
  }

  window.DOT_SUITE_AUTH = { KEY, getAccount, setAccount, clearAccount, onAccountChange };
})();
