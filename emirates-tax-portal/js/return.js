/* ==========================================================================
   return.js — Steps 4-17: VAT 201 Return (Boxes 1-14)
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

  const params = new URLSearchParams(window.location.search);
  const filingId = params.get("id");
  let filing = filingId && VATSIM.getFiling(filingId);
  if (!filing) {
    VATSIM.toast("Filing not found — please start again from My Filings.", "error");
    setTimeout(() => (window.location.href = "filings.html"), 900);
    return;
  }
  if (filing.status === "Submitted" && !VATSIM.canEditFiling(filing)) {
    window.location.href = "success.html?id=" + encodeURIComponent(filing.id);
    return;
  }
  const isEditingSubmitted = filing.status === "Submitted";
  VATSIM.seedIntegrationFeeds(filing);

  /* ---------------- Filing period header ---------------- */
  document.getElementById("fPeriod").textContent = VATSIM.fmtDate(filing.period.from) + " - " + VATSIM.fmtDate(filing.period.to);
  document.getElementById("fStagger").textContent = VATSIM.staggerLabel(filing.period.stagger);
  document.getElementById("fDue").textContent = VATSIM.fmtDate(filing.period.dueDate);
  document.getElementById("fYearEnd").textContent = VATSIM.fmtDate(filing.period.taxYearEnd);
  document.getElementById("templateDate").textContent = VATSIM.fmtDate(VATSIM.todayISO());
  if (isEditingSubmitted) {
    document.getElementById("editBanner").style.display = "flex";
    document.getElementById("btnNextStep").textContent = "Next Step (Resubmit)";
  }

  /* ---------------- Box 1: build emirate rows ---------------- */
  const EMIRATES = [
    ["abudhabi", "1a Standard rated supplies in Abu Dhabi"],
    ["dubai", "1b Standard rated supplies in Dubai"],
    ["sharjah", "1c Standard rated supplies in Sharjah"],
    ["ajman", "1d Standard rated supplies in Ajman"],
    ["uaq", "1e Standard rated supplies in Umm Al Quwain"],
    ["rak", "1f Standard rated supplies in Ras Al Khaimah"],
    ["fujairah", "1g Standard rated supplies in Fujairah"],
  ];
  const box1Body = document.getElementById("box1Body");
  EMIRATES.forEach(([key, label]) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td class="desc"><i class="info-dot">i</i>' + label + "</td>" +
      '<td><input class="amt-input" inputmode="decimal" data-box1="' + key + '" data-field="amount" placeholder="0.00" /></td>' +
      '<td><input class="amt-input" inputmode="decimal" data-box1="' + key + '" data-field="vat" placeholder="0.00" /></td>' +
      '<td><input class="amt-input" inputmode="decimal" data-box1="' + key + '" data-field="adj" placeholder="0.00" /></td>' +
      '<td style="text-align:center"><input type="checkbox" data-dz="' + key + '" title="Mark as an out-of-scope Designated Zone supply — excluded from Box 1 (not reported on the VAT201)" /></td>';
    box1Body.appendChild(tr);
  });

  /* ---------------- Bind boxes 1-11 ---------------- */
  const b = filing.boxes;

  function bindBox1() {
    document.querySelectorAll("[data-box1]").forEach((input) => {
      const key = input.getAttribute("data-box1");
      const field = input.getAttribute("data-field");
      input.value = b.b1[key][field] === "" || b.b1[key][field] == null ? "" : b.b1[key][field];
      input.addEventListener("input", () => {
        if (field === "adj") validateSignedNumeric(input);
        else validateNumeric(input);
        b.b1[key][field] = input.value;
        recalc();
      });
    });
    document.querySelectorAll("[data-dz]").forEach((cb) => {
      const key = cb.getAttribute("data-dz");
      cb.checked = !!b.b1[key].designatedZone;
      if (cb.checked) {
        const row = cb.closest("tr");
        row.querySelectorAll('[data-box1="' + key + '"]').forEach((i) => (i.disabled = true));
        row.style.opacity = "0.55";
      }
      cb.addEventListener("change", () => {
        b.b1[key].designatedZone = cb.checked;
        const row = cb.closest("tr");
        const inputs = row.querySelectorAll('[data-box1="' + key + '"]');
        if (cb.checked) {
          const movedAmount = VATSIM.n(b.b1[key].amount);
          if (movedAmount > 0) {
            VATSIM.toast("Row excluded from Box 1: an out-of-scope Designated Zone supply is not reported on the VAT201. If these goods (AED " + VATSIM.fmtAED(movedAmount) + ") are exported out of the UAE, enter that value under Box 4 (Zero-rated).", "info");
          }
          b.b1[key].amount = "";
          b.b1[key].vat = "";
          b.b1[key].adj = "";
          inputs.forEach((i) => { i.value = ""; i.disabled = true; });
          row.style.opacity = "0.55";
        } else {
          inputs.forEach((i) => (i.disabled = false));
          row.style.opacity = "1";
        }
        recalc();
      });
    });
  }

  const simpleBindings = [
    ["b3Amount", () => b.b3.amount, (v) => (b.b3.amount = v)],
    ["b3Vat", () => b.b3.vat, (v) => (b.b3.vat = v)],
    ["b4Amount", () => b.b4.amount, (v) => (b.b4.amount = v)],
    ["b5Amount", () => b.b5.amount, (v) => (b.b5.amount = v)],
    ["b7Amount", () => b.b7.amount, (v) => (b.b7.amount = v)],
    ["b7Vat", () => b.b7.vat, (v) => (b.b7.vat = v)],
    ["b9Amount", () => b.b9.amount, (v) => (b.b9.amount = v)],
    ["b9Vat", () => b.b9.vat, (v) => (b.b9.vat = v)],
    ["b9Adj", () => b.b9.adj, (v) => (b.b9.adj = v)],
    ["b10Amount", () => b.b10.amount, (v) => (b.b10.amount = v)],
    ["b10Vat", () => b.b10.vat, (v) => (b.b10.vat = v)],
  ];
  function bindSimple() {
    simpleBindings.forEach(([id, getter, setter]) => {
      const el = document.getElementById(id);
      el.value = getter() === "" || getter() == null ? "" : getter();
      el.addEventListener("input", () => {
        if (id === "b9Adj" || id === "b7Amount" || id === "b7Vat") validateSignedNumeric(el);
        else validateNumeric(el);
        setter(el.value);
        recalc();
      });
    });
  }

  function validateNumeric(input) {
    // Real VAT201: figures are NET OF CREDIT NOTES, so a negative total is valid.
    // (Box 1 Adjustment is separately forced to <= 0 at validation.)
    const v = VATSIM.sanitizeMoney(input.value, true); // digits, one dot, max 2 decimals
    if (v !== input.value) input.value = v;
  }
  /* Signed fields on the real VAT201: Box 1 Adjustment (negative only — enforced at
     validation), Box 9 Adjustment (+/-) and Box 7 Adjustments to imports (+/-, per FTA).
     Everything else stays non-negative. */
  function validateSignedNumeric(input) {
    const v = VATSIM.sanitizeMoney(input.value, true);
    if (v !== input.value) input.value = v;
  }

  /* ---------------- Read-only auto-populated cells ---------------- */
  function paintReadonly() {
    document.getElementById("b2Amount").textContent = VATSIM.fmtAED(-Math.abs(VATSIM.n(b.b2.amount))); // Box 2 is always negative on the real form
    document.getElementById("b2Vat").textContent = VATSIM.fmtAED(-Math.abs(VATSIM.n(b.b2.vat)));
    document.getElementById("b6Amount").textContent = VATSIM.fmtAED(b.b6.amount);
    document.getElementById("b6Vat").textContent = VATSIM.fmtAED(b.b6.vat);
  }

  function paintB10Hint() {
    const el = document.getElementById("b10Hint");
    if (!el) return;
    const rc = VATSIM.reverseChargeDeclared(b);
    el.textContent = "Reverse charge declared in Boxes 3 + 6 + 7 → Amount AED " + VATSIM.fmtAED(rc.amount) +
      " · VAT AED " + VATSIM.fmtAED(rc.vat) + ". Box 10 recovers the part you may claim — a fully taxable business recovers all of it, never more.";
  }

  /* ---------------- Recalculate totals ---------------- */
  function recalc() {
    paintB10Hint();
    const t = VATSIM.computeTotals(b);
    document.getElementById("b8Amount").textContent = VATSIM.fmtAED(t.box8amount);
    document.getElementById("b8Vat").textContent = VATSIM.fmtAED(t.box8vat);
    document.getElementById("b8Adj").textContent = VATSIM.fmtAED(t.box8adj);
    document.getElementById("b11Amount").textContent = VATSIM.fmtAED(t.box11amount);
    document.getElementById("b11Vat").textContent = VATSIM.fmtAED(t.box11vat);
    document.getElementById("b11Adj").textContent = VATSIM.fmtAED(t.box11adj);
    document.getElementById("b12").textContent = VATSIM.fmtAED(t.box12);
    document.getElementById("b13").textContent = VATSIM.fmtAED(t.box13);
    document.getElementById("b14").textContent = VATSIM.fmtAED(Math.abs(t.box14));
    document.getElementById("b14Label").textContent = t.isRefund
      ? "14 Refundable tax for the period (AED)"
      : "14 Payable tax for the period (AED)";
    const b15Section = document.getElementById("b15Section");
    const b15Field = document.getElementById("b15Field");
    const showB15 = t.isRefund && Math.abs(t.box14) > 0;
    b15Section.style.display = showB15 ? "block" : "none";
    b15Field.style.display = showB15 ? "block" : "none";
    markDirty();
  }

  /* ---------------- Box 15 — refund request ---------------- */
  document.querySelectorAll('input[name="requestRefund"]').forEach((r) => {
    if (b.requestRefund === r.value) {
      r.checked = true;
      r.closest(".radio-pill").classList.add("checked");
    }
    r.addEventListener("change", () => {
      document.querySelectorAll('input[name="requestRefund"]').forEach((x) => x.closest(".radio-pill").classList.remove("checked"));
      r.closest(".radio-pill").classList.add("checked");
      b.requestRefund = r.value;
      markDirty();
    });
  });

  /* ---------------- Profit margin + notes ---------------- */
  document.querySelectorAll('input[name="pms"]').forEach((r) => {
    if (b.profitMargin === r.value) {
      r.checked = true;
      r.closest(".radio-pill").classList.add("checked");
    }
    r.addEventListener("change", () => {
      b.profitMargin = r.value;
      document.querySelectorAll(".radio-pill").forEach((p) => p.classList.remove("checked"));
      r.closest(".radio-pill").classList.add("checked");
      markDirty();
    });
  });
  const notesField = document.getElementById("notesField");
  notesField.value = b.notes || "";
  notesField.addEventListener("input", () => {
    b.notes = notesField.value;
    markDirty();
  });

  /* ---------------- Business Scenarios (demo data by industry) ---------------- */
  const SCENARIOS = [
    { key: "retail", label: "🛍️ Retail" },
    { key: "manufacturing", label: "🏭 Manufacturing" },
    { key: "construction", label: "🏗️ Construction" },
    { key: "logistics", label: "🚚 Logistics" },
    { key: "healthcare", label: "🏥 Healthcare" },
    { key: "hospitality", label: "🏨 Hospitality" },
    { key: "it", label: "💻 IT Services" },
    { key: "importexport", label: "🚢 Import / Export" },
    { key: "oilgas", label: "🛢️ Oil & Gas" },
    { key: "ecommerce", label: "🛒 E-commerce" },
  ];
  const scenarioSelect = document.getElementById("scenarioPicker");
  scenarioSelect.innerHTML = SCENARIOS.map((s) => '<option value="' + s.key + '">' + s.label + "</option>").join("");

  /* Deterministic-ish "random" seeded off the filing id + a salt, so the
     same scenario on the same filing always produces the same figures
     (repeatable for a class exercise) but different filings differ. */
  function seededAmount(salt, min, max) {
    const seed = hashSeed(filing.id + salt);
    return VATSIM.round2(min + (seed % (max - min)));
  }

  // Per-industry weights: how box value is distributed across
  // {b1: domestic standard-rated sales, b3: reverse charge received,
  //  b4: zero-rated (exports/international services/certain healthcare),
  //  b5: exempt supplies, b7: import adjustments, b9: standard-rated
  //  expenses, b10: reverse charge purchases}. Reflects real patterns —
  //  e.g. healthcare and international transport are largely zero-rated
  //  under UAE VAT, while retail and hospitality are mostly standard-rated.
  const SCENARIO_PROFILES = {
    retail:         { b1: 1.00, b3: 0.05, b4: 0.10, b5: 0.00, b7: 0.05, b9: 0.55, b10: 0.05 },
    manufacturing:  { b1: 0.90, b3: 0.15, b4: 0.20, b5: 0.00, b7: 0.40, b9: 0.70, b10: 0.10 },
    construction:   { b1: 1.10, b3: 0.10, b4: 0.00, b5: 0.00, b7: 0.05, b9: 0.85, b10: 0.05 },
    logistics:      { b1: 0.60, b3: 0.10, b4: 0.45, b5: 0.00, b7: 0.10, b9: 0.40, b10: 0.05 },
    healthcare:     { b1: 0.35, b3: 0.02, b4: 0.55, b5: 0.10, b7: 0.02, b9: 0.30, b10: 0.02 },
    hospitality:    { b1: 1.20, b3: 0.05, b4: 0.05, b5: 0.00, b7: 0.02, b9: 0.60, b10: 0.05 },
    it:             { b1: 0.70, b3: 0.20, b4: 0.30, b5: 0.00, b7: 0.00, b9: 0.35, b10: 0.10 },
    importexport:   { b1: 0.50, b3: 0.20, b4: 0.60, b5: 0.00, b7: 0.55, b9: 0.30, b10: 0.15 },
    oilgas:         { b1: 0.40, b3: 0.10, b4: 0.70, b5: 0.00, b7: 0.30, b9: 0.50, b10: 0.05 },
    ecommerce:      { b1: 0.95, b3: 0.10, b4: 0.25, b5: 0.00, b7: 0.10, b9: 0.45, b10: 0.10 },
  };

  function homeEmirateKey() {
    const norm = String((account && account.emirate) || "").toLowerCase().replace(/[^a-z]/g, "");
    const map = { abudhabi: "abudhabi", dubai: "dubai", sharjah: "sharjah", ajman: "ajman", ummalquwain: "uaq", uaq: "uaq", rasalkhaimah: "rak", rak: "rak", fujairah: "fujairah" };
    return map[norm] || "dubai";
  }

  function applyScenario(key) {
    const profile = SCENARIO_PROFILES[key] || SCENARIO_PROFILES.retail;
    const base = seededAmount(key, 60000, 260000);

    EMIRATES.forEach(([ek]) => {
      b.b1[ek].designatedZone = false;
      b.b1[ek].amount = ""; b.b1[ek].vat = ""; b.b1[ek].adj = "";
    });
    document.querySelectorAll("[data-dz]").forEach((cb) => {
      cb.checked = false;
      const row = cb.closest("tr");
      row.style.opacity = "1";
      row.querySelectorAll("[data-box1]").forEach((i) => (i.disabled = false));
    });

    // Box 1 — real rule: report in the Emirate of the fixed establishment that made the supply
    // (NOT the customer's Emirate). The trainee has one establishment, in the Emirate they
    // registered in, so every standard rated supply goes on that one row.
    const home = homeEmirateKey();
    const b1Total = VATSIM.round2(base * profile.b1);
    b.b1[home].amount = b1Total;
    b.b1[home].vat = VATSIM.round2(b1Total * 0.05);

    const b3Amount = VATSIM.round2(base * profile.b3);
    b.b3.amount = b3Amount;
    b.b3.vat = VATSIM.round2(b3Amount * 0.05);
    b.b4.amount = VATSIM.round2(base * profile.b4);
    b.b5.amount = VATSIM.round2(base * profile.b5);
    // Box 7 only corrects Box 6 — a clean scenario has nothing to correct.
    b.b7.amount = ""; b.b7.vat = "";

    // Partial exemption: input tax is recoverable only in proportion to taxable (standard +
    // zero rated) supplies, so scenarios with exempt supplies recover less than 100%.
    const taxable = profile.b1 + profile.b4;
    const ratio = taxable + profile.b5 > 0 ? taxable / (taxable + profile.b5) : 1;
    const b9Amount = VATSIM.round2(base * profile.b9);
    b.b9.amount = b9Amount;
    b.b9.vat = VATSIM.round2(b9Amount * 0.05 * ratio);

    // Box 10 recovers the reverse charge declared in Boxes 3, 6 and 7.
    const rc = VATSIM.reverseChargeDeclared(b);
    if (rc.amount === 0) { b.b10.amount = ""; b.b10.vat = ""; }
    else { b.b10.amount = rc.amount; b.b10.vat = VATSIM.round2(rc.vat * ratio); }

    paintAllFromModel();
    VATSIM.toast("Loaded " + SCENARIOS.find((s) => s.key === key).label.replace(/^\S+\s/, "") + " demo data (Box 1 in " + home.toUpperCase() + "; Box 10 mirrors Boxes 3, 6 & 7).", "success");
  }
  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
  function paintAllFromModel() {
    document.querySelectorAll("[data-box1]").forEach((input) => {
      const key = input.getAttribute("data-box1");
      const field = input.getAttribute("data-field");
      input.value = b.b1[key][field] === "" || b.b1[key][field] == null ? "" : b.b1[key][field];
    });
    simpleBindings.forEach(([id, getter]) => {
      const val = getter();
      document.getElementById(id).value = val === "" || val == null ? "" : val;
    });
    recalc();
  }
  document.getElementById("btnLoadScenario").addEventListener("click", () => {
    if (filing.status === "Submitted" && !VATSIM.canEditFiling(filing)) return;
    applyScenario(scenarioSelect.value);
  });

  /* ---------------- View / Edit details modals ---------------- */
  const modal = document.getElementById("detailsModal");
  function openModal(title, html) {
    document.getElementById("detailsTitle").textContent = title;
    document.getElementById("detailsBody").innerHTML = html;
    modal.classList.add("open");
  }
  function closeModal() {
    modal.classList.remove("open");
  }
  document.getElementById("closeDetails").addEventListener("click", closeModal);
  document.getElementById("closeDetails2").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.getElementById("btnViewB2").addEventListener("click", () => {
    if (VATSIM.n(b.b2.amount) === 0 && VATSIM.n(b.b2.vat) === 0) {
      openModal("Tourist Refund Scheme — Details",
        '<p style="font-size:13px;color:var(--text-muted);line-height:1.7">No tourist VAT refunds were reported to the FTA for your TRN in this return period, so Box 2 is 0.00. This box is locked: only the Tax Refunds for Tourists Scheme operator can fill it.</p>');
      return;
    }
    openModal(
      "Tourist Refund Scheme — Details",
      '<p style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px">Simulated data received from the Planet Tax Free integration for this return period.</p>' +
        '<div class="review-grid">' +
        '<div class="review-item"><div class="k">Total refund claims processed</div><div class="v">' + (12 + (filing.id.length % 30)) + '</div></div>' +
        '<div class="review-item"><div class="k">Total refunded amount (AED)</div><div class="v">' + VATSIM.fmtAED(b.b2.amount) + '</div></div>' +
        '<div class="review-item"><div class="k">VAT component (AED)</div><div class="v">' + VATSIM.fmtAED(b.b2.vat) + '</div></div>' +
        '<div class="review-item"><div class="k">Source</div><div class="v">Planet Tax Free (simulated)</div></div>' +
        "</div>"
    );
  });
  document.getElementById("btnViewB6").addEventListener("click", () => {
    if (VATSIM.n(b.b6.amount) === 0 && VATSIM.n(b.b6.vat) === 0) {
      openModal("Goods Imported into the UAE — Details",
        '<p style="font-size:13px;color:var(--text-muted);line-height:1.7">No Customs declarations were linked to your TRN for this return period, so Box 6 is 0.00. The box is locked and fills from Customs data. If goods were imported but are missing (e.g. cleared under a clearing agent\'s registration), record them in Box 7.</p>');
      return;
    }
    openModal(
      "Goods Imported into the UAE — Details",
      '<p style="font-size:12.5px;color:var(--text-muted);margin-bottom:14px">Simulated data received from the UAE Customs declarations integration for this return period.</p>' +
        '<div class="review-grid">' +
        '<div class="review-item"><div class="k">Customs declarations linked</div><div class="v">' + (5 + (filing.id.length % 12)) + '</div></div>' +
        '<div class="review-item"><div class="k">Total import value (AED)</div><div class="v">' + VATSIM.fmtAED(b.b6.amount) + '</div></div>' +
        '<div class="review-item"><div class="k">VAT component (AED)</div><div class="v">' + VATSIM.fmtAED(b.b6.vat) + '</div></div>' +
        '<div class="review-item"><div class="k">Source</div><div class="v">UAE Customs (simulated)</div></div>' +
        "</div>" +
        '<p style="font-size:12px;color:var(--text-muted);margin-top:14px">If this data looks incomplete or incorrect, use Box 7 below to record an adjustment.</p>'
    );
  });
  document.getElementById("btnEditB3").addEventListener("click", () => {
    openModal(
      "Reverse Charge Supplies — Guidance",
      '<p style="font-size:13px;color:var(--text-muted);line-height:1.7">Enter the taxable value and VAT amount for supplies you received where you, as the recipient, are required to self-account for VAT under the reverse charge mechanism — mainly imported services (overseas software, foreign professional fees, offshore group charges) and goods that reach the UAE without a Customs declaration. Goods cleared through Customs appear in Box 6 instead. The VAT you may recover on these goes in Box 10.</p>'
    );
  });

  /* ---------------- Template download / upload / clear ----------------
     Downloads a real .xlsx workbook (via SheetJS/XLSX, same CDN pattern
     as the jsPDF usage elsewhere in this project) matching the real
     EmaraTax "file offline" template concept — Box 1's emirate rows with
     Amount/VAT Amount/Adjustment columns. Every step is wrapped so a bad
     or unrelated file can never crash the page — it just shows a plain
     error toast and leaves the form exactly as it was. */
  const TEMPLATE_HEADER = ["Box", "Description", "Amount (AED)", "VAT Amount (AED)", "Adjustment (AED)"];
  function safeNum(v) {
    const n = Number(v);
    return isNaN(n) ? 0 : VATSIM.round2(n);
  }

  document.getElementById("btnDownloadTemplate").addEventListener("click", () => {
    try {
      if (!window.XLSX) throw new Error("no-xlsx-lib");
      const aoa = [
        ["VAT 201 Return — Offline Template — Box 1: VAT on Sales and All Other Outputs"],
        TEMPLATE_HEADER,
      ];
      EMIRATES.forEach(([key, label]) => {
        const code = label.split(" ")[0]; // "1a", "1b", ...
        const desc = label.slice(code.length + 1);
        aoa.push([code, desc, safeNum(b.b1[key].amount), safeNum(b.b1[key].vat), safeNum(b.b1[key].adj)]);
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [{ wch: 6 }, { wch: 42 }, { wch: 16 }, { wch: 18 }, { wch: 16 }];
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "VAT Return Template");
      XLSX.writeFile(wb, "VAT_Return_Template.xlsx");
      VATSIM.toast("Template downloaded.", "success");
    } catch (err) {
      VATSIM.toast("Could not generate the Excel template right now — check your internet connection and try again, or type figures directly into the boxes below.", "error");
    }
  });

  document.getElementById("uploadTemplate").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const status = document.getElementById("templateUploadStatus");
    status.textContent = "Reading file…";
    const isCsv = /\.csv$/i.test(file.name);
    const reader = new FileReader();

    reader.onerror = () => {
      status.textContent = "";
      VATSIM.toast("Could not read that file. Please try again.", "error");
    };

    if (isCsv) {
      reader.onload = () => {
        try {
          const lines = String(reader.result).trim().split("\n").slice(1);
          let matched = 0;
          lines.forEach((line, i) => {
            const cols = line.split(",");
            const key = EMIRATES[i] ? EMIRATES[i][0] : null;
            if (!key || cols.length < 2) return;
            b.b1[key].amount = safeNum(cols[1]);
            b.b1[key].vat = safeNum(cols[2]);
            b.b1[key].adj = safeNum(cols[3]);
            matched++;
          });
          if (!matched) throw new Error("no-rows-matched");
          refreshBox1Inputs();
          recalc();
          status.textContent = "✓ Applied " + matched + " row(s) from " + file.name;
          VATSIM.toast("Filled template uploaded and applied to Box 1.", "success");
        } catch (err) {
          status.textContent = "";
          VATSIM.toast("Could not read that CSV — please upload the unmodified downloaded template.", "error");
        }
      };
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        try {
          if (!window.XLSX) throw new Error("no-xlsx-lib");
          const u8 = new Uint8Array(reader.result);
          const wb = XLSX.read(u8, { type: "array" });
          if (!wb.SheetNames.length) throw new Error("no-sheets");
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          const headerIdx = rows.findIndex((r) => String(r[0]).trim() === "Box");
          if (headerIdx === -1) throw new Error("no-header-row");

          const CODE_TO_KEY = {};
          EMIRATES.forEach(([key, label]) => (CODE_TO_KEY[label.split(" ")[0]] = key));

          let matched = 0;
          for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            const code = String(row[0] || "").trim();
            const key = CODE_TO_KEY[code];
            if (!key) continue;
            b.b1[key].amount = safeNum(row[2]);
            b.b1[key].vat = safeNum(row[3]);
            b.b1[key].adj = safeNum(row[4]);
            matched++;
          }
          if (!matched) throw new Error("no-rows-matched");
          refreshBox1Inputs();
          recalc();
          status.textContent = "✓ Applied " + matched + " row(s) from " + file.name;
          VATSIM.toast("Filled template uploaded and applied to Box 1.", "success");
        } catch (err) {
          status.textContent = "";
          VATSIM.toast("Could not read that file — please upload the unmodified downloaded VAT_Return_Template.xlsx (or edit and re-save it, keeping the Box column intact).", "error");
        }
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = "";
  });

  document.getElementById("btnClearTable").addEventListener("click", () => {
    if (!confirm("Clear all Box 1 entries?")) return;
    EMIRATES.forEach(([key]) => {
      b.b1[key].amount = "";
      b.b1[key].vat = "";
      b.b1[key].adj = "";
    });
    refreshBox1Inputs();
    recalc();
    VATSIM.toast("Box 1 cleared.", "info");
  });

  function refreshBox1Inputs() {
    document.querySelectorAll("[data-box1]").forEach((input) => {
      const key = input.getAttribute("data-box1");
      const field = input.getAttribute("data-field");
      input.value = b.b1[key][field] === "" || b.b1[key][field] == null ? "" : b.b1[key][field];
      input.disabled = false;
    });
    document.querySelectorAll("[data-dz]").forEach((cb) => {
      const key = cb.getAttribute("data-dz");
      b.b1[key].designatedZone = false;
      cb.checked = false;
      cb.closest("tr").style.opacity = "1";
    });
  }

  /* ---------------- Autosave (every 5s) + manual save ---------------- */
  let dirty = false;
  function markDirty() {
    dirty = true;
    document.getElementById("autosaveTag").innerHTML = '<span class="dot" style="background:var(--warn)"></span> Unsaved changes';
  }
  function persist(showToast) {
    filing.boxes = b;
    VATSIM.upsertFiling(filing);
    dirty = false;
    document.getElementById("autosaveTag").innerHTML = '<span class="dot"></span> Saved';
    if (showToast) VATSIM.toast("Draft saved.", "success");
  }
  setInterval(() => {
    if (dirty) persist(false);
  }, 5000);
  window.addEventListener("beforeunload", () => {
    if (dirty) persist(false);
  });

  document.getElementById("btnSaveDraft").addEventListener("click", () => persist(true));

  /* ---------------- Box dependency / sanity validation ---------------- */
  function clearFieldErrors() {
    document.querySelectorAll(".amt-input.invalid, .amt-input.warn").forEach((el) => el.classList.remove("invalid", "warn"));
  }
  function markField(el, cls) {
    if (el) el.classList.add(cls);
  }
  function validateReturn() {
    clearFieldErrors();
    const r = VATSIM.validateBoxes(b);
    function markPair(res, els) {
      if (res.errors.length) els.forEach((el) => markField(el, "invalid"));
      else if (res.warnings.length) els.forEach((el) => markField(el, "warn"));
    }
    EMIRATES.forEach(([key, label]) => {
      const row = b.b1[key];
      const amtEl = document.querySelector('[data-box1="' + key + '"][data-field="amount"]');
      const vatEl = document.querySelector('[data-box1="' + key + '"][data-field="vat"]');
      const adjEl = document.querySelector('[data-box1="' + key + '"][data-field="adj"]');
      markPair(VATSIM.pairFindings(row.amount, row.vat, label, "exact"), [amtEl, vatEl]);
      if (VATSIM.n(row.adj) > 0) markField(adjEl, "invalid");
    });
    [["b3", "exact"], ["b7", "exact"], ["b9", "max"], ["b10", "max"]].forEach(([k, mode]) => {
      markPair(VATSIM.pairFindings(b[k].amount, b[k].vat, k, mode),
        [document.getElementById(k + "Amount"), document.getElementById(k + "Vat")]);
    });
    if (r.warnings.some((w) => w.indexOf("Box 10:") === 0 || w.indexOf("Boxes 3, 6 and 7") === 0)) {
      markField(document.getElementById("b10Amount"), "warn");
      markField(document.getElementById("b10Vat"), "warn");
    }
    document.getElementById("validationList").innerHTML = r.errors.map((e) => "<li>" + e + "</li>").join("");
    document.getElementById("warningList").innerHTML = r.warnings.map((w) => "<li>" + w + "</li>").join("");
    document.getElementById("validationSummary").style.display = r.errors.length ? "block" : "none";
    document.getElementById("warningSummary").style.display = r.warnings.length ? "block" : "none";
    return r;
  }

  document.getElementById("btnNextStep").addEventListener("click", () => {
    if (!b.profitMargin) {
      VATSIM.toast("Please answer the Profit Margin Scheme question before continuing.", "error");
      document.getElementById("profitMarginGroup").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const t = VATSIM.computeTotals(b);
    if (t.isRefund && Math.abs(t.box14) > 0 && !b.requestRefund) {
      VATSIM.toast("Please answer whether you want to request a refund (Box 15) before continuing.", "error");
      document.getElementById("b15Field").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const res = validateReturn();
    if (res.errors.length) {
      VATSIM.toast("Please fix " + res.errors.length + " issue(s) below before continuing.", "error");
      document.getElementById("validationSummary").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (res.warnings.length &&
        !confirm("The portal flags " + res.warnings.length + " item(s) on this return (shown in amber).\n\nLike the real portal, you may still continue, but a clean return should have none.\n\nContinue to Review anyway?")) {
      document.getElementById("warningSummary").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    filing.currentStep = "review";
    persist(false);
    VATSIM.showLoading("Loading Review & Declaration…", 500).then(() => {
      window.location.href = "review.html?id=" + encodeURIComponent(filing.id);
    });
  });

  /* ---------------- Init ---------------- */
  bindBox1();
  bindSimple();
  paintReadonly();
  recalc();
})();
