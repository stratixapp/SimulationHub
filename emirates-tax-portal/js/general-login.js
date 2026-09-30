/* General Portal Login — identifies which student is at this shared
   computer BEFORE they pick VAT or Corporate Tax. This is deliberately
   lightweight (name + PIN) — it is not the VAT or CT app's own login,
   which still happens separately inside whichever simulator they open.
   All it does is set the exact same "active student" pointer the VAT
   simulator already uses, so both apps and the shared identity bridge
   partition data by student consistently. */
(function () {
  "use strict";
  const REGISTRY_KEY = "uae_tax_portal_students_v1";
  const GLOBAL_ACTIVE_KEY = "vatsim_global_active"; // same key VATSIM's storage.js reads/writes

  function getRegistry() {
    try {
      const raw = localStorage.getItem(REGISTRY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveRegistry(list) {
    try { localStorage.setItem(REGISTRY_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }
  function setActiveStudent(id) {
    localStorage.setItem(GLOBAL_ACTIVE_KEY, JSON.stringify(id));
  }
  function showFieldError(fieldId, show) {
    const el = document.getElementById(fieldId);
    if (el) el.classList.toggle("invalid", !!show);
  }

  const tabReturning = document.getElementById("tabReturning");
  const tabNew = document.getElementById("tabNew");
  const returningForm = document.getElementById("returningForm");
  const newForm = document.getElementById("newForm");

  function showTab(which) {
    const isReturning = which === "returning";
    returningForm.style.display = isReturning ? "" : "none";
    newForm.style.display = isReturning ? "none" : "";
    tabReturning.classList.toggle("btn-outline", true);
    tabNew.classList.toggle("btn-outline", true);
    tabReturning.style.background = isReturning ? "var(--gold-100)" : "";
    tabNew.style.background = isReturning ? "" : "var(--gold-100)";
  }
  tabReturning.addEventListener("click", () => showTab("returning"));
  tabNew.addEventListener("click", () => showTab("new"));
  showTab("returning");

  function proceedAsStudent(id, name) {
    setActiveStudent(id);
    document.querySelector(".login-panels").style.display = "none";
    const chooser = document.getElementById("serviceChooser");
    chooser.style.display = "";
    document.getElementById("welcomeBackLine").textContent = "Welcome, " + name + "!";
  }

  returningForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("rName").value.trim();
    const pin = document.getElementById("rPin").value;
    let ok = true;
    if (!name) { showFieldError("f_rname", true); ok = false; } else showFieldError("f_rname", false);
    const registry = getRegistry();
    const match = registry.find((s) => s.name.toLowerCase() === name.toLowerCase() && s.pin === pin);
    if (!match) { showFieldError("f_rpin", true); ok = false; } else showFieldError("f_rpin", false);
    if (!ok || !match) return;
    proceedAsStudent(match.id, match.name);
  });

  newForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("nName").value.trim();
    const pin = document.getElementById("nPin").value;
    const pin2 = document.getElementById("nPin2").value;
    let ok = true;
    if (!name) { showFieldError("f_nname", true); ok = false; } else showFieldError("f_nname", false);
    if (!pin || pin.length < 4) { showFieldError("f_npin", true); ok = false; } else showFieldError("f_npin", false);
    if (pin !== pin2) { showFieldError("f_npin2", true); ok = false; } else showFieldError("f_npin2", false);
    if (!ok) return;

    const registry = getRegistry();
    if (registry.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      showFieldError("f_nname", true);
      VATSIM.toast("A student with this name already exists — use Returning Student instead.", "warn");
      return;
    }
    // If this browser already has an anonymous walk-up namespace (e.g. the
    // student created a UAE PASS / Emirates ID from the VAT Login screen
    // before ever reaching this portal login), reuse that exact id so
    // that work isn't orphaned — otherwise allocate a fresh one.
    let id;
    try {
      const raw = localStorage.getItem(GLOBAL_ACTIVE_KEY);
      const current = raw ? JSON.parse(raw) : "";
      id = (current && String(current).indexOf("anon") === 0) ? current : ("p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
    } catch (e) {
      id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    }
    registry.push({ id, name, pin, createdAt: new Date().toISOString() });
    saveRegistry(registry);
    if (typeof SharedIdentity !== "undefined") {
      // set the pointer first so SharedIdentity.set writes to the right slot
      setActiveStudent(id);
      SharedIdentity.set({ fullNameEn: name });
    }
    proceedAsStudent(id, name);
  });

  document.getElementById("linkNotYou").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("serviceChooser").style.display = "none";
    document.querySelector(".login-panels").style.display = "";
    document.getElementById("rName").value = "";
    document.getElementById("rPin").value = "";
  });
})();
