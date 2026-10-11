/* ==========================================================================
   taxable-person.js — Select Taxable Person (post-authentication picker)
   Created By Ananthu Shaji
   ========================================================================== */

(function () {
  "use strict";

  const session = VATSIM.requireSession("../login.html");
  if (!session) return;
  const account = VATSIM.getAccount();
  if (!account) {
    window.location.href = "../index.html";
    return;
  }
  VATSIM.wireChrome();

  const list = document.getElementById("companyList");
  const allEntries = [];

  function card(opts) {
    const el = document.createElement("div");
    el.className = "panel panel-pad";
    el.style.display = "flex";
    el.style.justifyContent = "space-between";
    el.style.alignItems = "center";
    el.style.flexWrap = "wrap";
    el.style.gap = "14px";
    el.style.cursor = "pointer";
    el.innerHTML =
      "<div>" +
      '<div style="font-weight:700;font-size:14.5px;color:var(--navy-900)">' + opts.name +
      (opts.isOwn ? ' <span style="font-size:10px;font-weight:700;color:#fff;background:var(--gold-600);border-radius:10px;padding:2px 8px;margin-left:4px">YOUR ACCOUNT</span>' : "") +
      "</div>" +
      '<div style="font-size:12px;color:var(--text-muted);margin-top:3px">TRN: ' + opts.trn + " · " + opts.emirate + "</div>" +
      (opts.activity ? '<div style="font-size:11.5px;color:var(--text-faint);margin-top:2px">' + opts.activity + "</div>" : "") +
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<span class="status-pill"><span class="status-dot submitted"></span> VAT Status: ' + opts.vatStatus + "</span>" +
      '<span style="font-size:10.5px;font-weight:700;color:' + (opts.access === "Owner" ? "#0d8a51" : "#5b6b7c") + ';background:var(--bg);border-radius:12px;padding:3px 10px">Access: ' + opts.access + "</span>" +
      (opts.isOwn ? "" : '<span style="font-size:10.5px;font-weight:700;color:#8b5c0c;background:var(--gold-100);border-radius:12px;padding:3px 10px">Demo — View Only</span>') +
      "</div></div>" +
      '<button class="btn btn-gold">Select →</button>';
    el.addEventListener("click", opts.onSelect);
    el.dataset.searchKey = (opts.name + " " + opts.trn + " " + opts.emirate + " " + (opts.activity || "")).toLowerCase();
    return el;
  }

  // Student's own company — always first, always the fully-featured entry.
  allEntries.push(
    card({
      name: account.companyName,
      trn: account.trn,
      emirate: account.emirate || "—",
      vatStatus: account.registrationStatus || "Registered",
      access: "Owner",
      isOwn: true,
      onSelect: () => {
        VATSIM.setSelectedTaxablePerson("own");
        window.location.href = "dashboard.html";
      },
    })
  );

  VATSIM.DEMO_COMPANIES.forEach((c) => {
    allEntries.push(
      card({
        name: c.name,
        trn: c.trn,
        emirate: c.emirate,
        activity: c.activity,
        vatStatus: "Registered",
        access: c.access,
        isOwn: false,
        onSelect: () => {
          VATSIM.setSelectedTaxablePerson(c.id);
          window.location.href = "demo-company.html?id=" + c.id;
        },
      })
    );
  });

  allEntries.forEach((el) => list.appendChild(el));

  document.getElementById("tpSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    let visibleCount = 0;
    allEntries.forEach((el) => {
      const match = !q || el.dataset.searchKey.includes(q);
      el.style.display = match ? "flex" : "none";
      if (match) visibleCount++;
    });
    document.getElementById("tpEmptyState").style.display = visibleCount === 0 ? "block" : "none";
  });
})();
