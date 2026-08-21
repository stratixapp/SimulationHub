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
  document.getElementById("fStagger").textContent = filing.period.stagger || "—";
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
      '<td style="text-align:center"><input type="checkbox" data-dz="' + key + '" title="Mark this row as a Designated Zone supply — it will be excluded from Box 1" /></td>';
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
            VATSIM.toast("Row excluded from Box 1 as a Designated Zone supply. Enter the AED " + VATSIM.fmtAED(movedAmount) + " under Box 4 (Zero-rated) below if it qualifies.", "info");
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
        if (id === "b9Adj") validateSignedNumeric(el);
        else validateNumeric(el);
        setter(el.value);
        recalc();
      });
    });
  }

  function validateNumeric(input) {
    let v = input.value.replace(/[^0-9.]/g, "");
    const firstDot = v.indexOf(".");
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    }
    if (v !== input.value) input.value = v;
  }
  /* Adjustment columns (Box 1 per-emirate, Box 9) are the one place the
     real VAT201 form allows negative figures — Box 1's Adjustment can
     only be negative (Bad Debt Relief / commercial property sale
     corrections reducing output tax); Box 9's can be positive or
     negative. Everything else in the simulator stays non-negative. */
  function validateSignedNumeric(input) {
    let v = input.value.replace(/[^0-9.-]/g, "");
    const negative = v.trim().startsWith("-");
    v = v.replace(/-/g, "");
    const firstDot = v.indexOf(".");
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    }
    v = (negative && v ? "-" : "") + v;
    if (v !== input.value) input.value = v;
  }

  /* ---------------- Read-only auto-populated cells ---------------- */
  function paintReadonly() {
    document.getElementById("b2Amount").textContent = VATSIM.fmtAED(b.b2.amount);
    document.getElementById("b2Vat").textContent = VATSIM.fmtAED(b.b2.vat);
    document.getElementById("b6Amount").textContent = VATSIM.fmtAED(b.b6.amount);
    document.getElementById("b6Vat").textContent = VATSIM.fmtAED(b.b6.vat);
  }

  /* ---------------- Recalculate totals ---------------- */
  function recalc() {
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

  function applyScenario(key) {
    const profile = SCENARIO_PROFILES[key] || SCENARIO_PROFILES.retail;
    const base = seededAmount(key, 60000, 260000);

    // Loading a fresh scenario clears any Designated Zone exclusions from
    // a previous attempt at this return.
    EMIRATES.forEach(([ek]) => {
      b.b1[ek].designatedZone = false;
    });
    document.querySelectorAll("[data-dz]").forEach((cb) => {
      cb.checked = false;
      const row = cb.closest("tr");
      row.style.opacity = "1";
      row.querySelectorAll("[data-box1]").forEach((i) => (i.disabled = false));
    });

    // Box 1 — spread standard-rated sales across emirates, heaviest in
    // Dubai and Abu Dhabi, same as real filing patterns for most sectors.
    const emirateWeights = { dubai: 0.42, abudhabi: 0.28, sharjah: 0.14, ajman: 0.06, rak: 0.05, fujairah: 0.03, uaq: 0.02 };
    const b1Total = VATSIM.round2(base * profile.b1);
    EMIRATES.forEach(([ek]) => {
      const amt = VATSIM.round2(b1Total * (emirateWeights[ek] || 0));
      b.b1[ek].amount = amt;
      b.b1[ek].vat = VATSIM.round2(amt * 0.05);
    });

    function setPair(boxKey, amount) {
      b[boxKey].amount = amount;
      if (b[boxKey].vat !== undefined) b[boxKey].vat = VATSIM.round2(amount * 0.05);
    }
    setPair("b3", VATSIM.round2(base * profile.b3));
    setPair("b7", VATSIM.round2(base * profile.b7));
    setPair("b9", VATSIM.round2(base * profile.b9));
    setPair("b10", VATSIM.round2(base * profile.b10));
    b.b4.amount = VATSIM.round2(base * profile.b4);
    b.b5.amount = VATSIM.round2(base * profile.b5);

    paintAllFromModel();
    VATSIM.toast("Loaded " + SCENARIOS.find((s) => s.key === key).label.replace(/^\S+\s/, "") + " demo data into Boxes 1, 3, 4, 5, 7, 9 and 10.", "success");
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
      '<p style="font-size:13px;color:var(--text-muted);line-height:1.7">Enter the taxable value and VAT amount for supplies you received where you, as the recipient, are required to self-account for VAT under the reverse charge mechanism (e.g. imported services, or supplies from a designated zone). Edit the amounts directly in the Box 3 row.</p>'
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
    return isNaN(n) ? 0 : n;
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
      b.b1[key].adj = 0;
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
    document.querySelectorAll(".amt-input.invalid, #b3Amount.invalid, #b3Vat.invalid, #b7Amount.invalid, #b7Vat.invalid, #b9Amount.invalid, #b9Vat.invalid, #b10Amount.invalid, #b10Vat.invalid, #b4Amount.invalid, #b5Amount.invalid").forEach((el) =>
      el.classList.remove("invalid")
    );
  }
  function markFieldInvalid(el) {
    if (el) el.classList.add("invalid");
  }
  function validateReturn() {
    const errors = []; // { msg, el }
    clearFieldErrors();

    // Box 1 — each emirate row: amount and VAT must both be present or both blank,
    // and VAT must not exceed the taxable amount (5% standard rate).
    EMIRATES.forEach(([key, label]) => {
      const row = b.b1[key];
      const amtEl = document.querySelector('[data-box1="' + key + '"][data-field="amount"]');
      const vatEl = document.querySelector('[data-box1="' + key + '"][data-field="vat"]');
      const amt = VATSIM.n(row.amount);
      const vat = VATSIM.n(row.vat);
      const hasAmt = row.amount !== "" && row.amount != null;
      const hasVat = row.vat !== "" && row.vat != null;
      if (hasAmt !== hasVat) {
        errors.push({ msg: label + ": enter both the amount and VAT amount, or leave both blank.", el: hasAmt ? vatEl : amtEl });
        markFieldInvalid(hasAmt ? vatEl : amtEl);
      } else if (hasAmt && hasVat && vat > amt) {
        errors.push({ msg: label + ": VAT amount cannot exceed the taxable amount.", el: vatEl });
        markFieldInvalid(vatEl);
      }
    });

    // Box 3 — Reverse charge supplies (output)
    checkPair("b3Amount", "b3Vat", b.b3.amount, b.b3.vat, "Box 3 (Reverse charge supplies)");
    // Box 7 — Import adjustments
    checkPair("b7Amount", "b7Vat", b.b7.amount, b.b7.vat, "Box 7 (Adjustments to imports)");
    // Box 9 — Standard rated expenses
    checkPair("b9Amount", "b9Vat", b.b9.amount, b.b9.vat, "Box 9 (Standard rated expenses)");
    // Box 10 — Reverse charge purchases (recoverable)
    checkPair("b10Amount", "b10Vat", b.b10.amount, b.b10.vat, "Box 10 (Reverse charge purchases)");

    function checkPair(amtId, vatId, amountVal, vatVal, label) {
      const amtEl = document.getElementById(amtId);
      const vatEl = document.getElementById(vatId);
      const amt = VATSIM.n(amountVal);
      const vat = VATSIM.n(vatVal);
      const hasAmt = amountVal !== "" && amountVal != null;
      const hasVat = vatVal !== "" && vatVal != null;
      if (hasAmt !== hasVat) {
        errors.push({ msg: label + ": enter both the amount and VAT amount, or leave both blank.", el: hasAmt ? vatEl : amtEl });
        markFieldInvalid(hasAmt ? vatEl : amtEl);
      } else if (hasAmt && hasVat && vat > amt) {
        errors.push({ msg: label + ": VAT amount cannot exceed the taxable amount.", el: vatEl });
        markFieldInvalid(vatEl);
      }
    }

    const summary = document.getElementById("validationSummary");
    const list = document.getElementById("validationList");
    if (errors.length) {
      list.innerHTML = errors.map((e) => "<li>" + e.msg + "</li>").join("");
      summary.style.display = "block";
    } else {
      summary.style.display = "none";
    }
    return errors;
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
    const errors = validateReturn();
    if (errors.length) {
      VATSIM.toast("Please fix " + errors.length + " issue(s) below before continuing.", "error");
      const target = (errors[0].el) || document.getElementById("validationSummary");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (errors[0].el && errors[0].el.focus) errors[0].el.focus();
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
