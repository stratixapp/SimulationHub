/* ============================================================
   Corporate Tax Return - form engine
   Handles binding, dependencies, validation, the tax computation
   chain, step navigation and submission.
   ============================================================ */
(function () {
  "use strict";

  var THRESHOLD = 375000;      // 0% band
  var RATE = 0.09;             // standard Corporate Tax rate
  var SBR_REVENUE_CAP = 3000000;
  var INTEREST_SAFE_HARBOUR = 12000000;
  var LOSS_CAP_RATE = 0.75;
  var SBR_LAST_PERIOD_END_YEAR = 2029;   /* Ministerial Decision No. 131 of 2026 */
  var DMTT_RATE = 0.15;                  /* Domestic Minimum Top-up Tax (Pillar Two) */
  var DMTT_GROUP_REVENUE = 3150000000;   /* EUR 750m ~ AED 3.15bn */
  var QFZP_DEMINIMIS_RATE = 0.05;
  var QFZP_DEMINIMIS_CAP = 5000000;
  var ACTIVITY_TOTAL_TOLERANCE = 0.5;   // percentage points; explicit rounding allowance for the 100% check

  /* Transitional CbCR Safe Harbour (OECD Safe Harbours and Penalty Relief,
     as extended by the January 2026 Side-by-Side package): available for
     fiscal years beginning on or before 31 December 2027. Three tests;
     passing any one deems the jurisdiction's Top-up Tax to be nil. */
  var SAFE_HARBOUR_LAST_FY_BEGIN = 2027;
  var AED_PER_EUR = 4.2; /* consistent with AED 3.15bn = EUR 750m */
  var DEMINIMIS_REVENUE_EUR = 10000000;
  var DEMINIMIS_PROFIT_EUR = 1000000;
  /* Substance-based Income Exclusion transition schedule: [payroll %, tangible assets %] by the year the fiscal year begins. */
  var SBIE_SCHEDULE = {
    2023: [9.8, 7.8], 2024: [9.6, 7.4], 2025: [9.4, 7.0], 2026: [9.2, 6.6],
    2027: [9.0, 6.2], 2028: [8.2, 5.8], 2029: [7.4, 5.4], 2030: [6.6, 5.0],
    2031: [5.8, 4.6], 2032: [5.0, 4.2]
  };
  var SBIE_FINAL = [5.0, 5.0]; /* permanent rate from 2033 */
  /* ETR transition rate by the year the fiscal year begins. */
  var ETR_TRANSITION_SCHEDULE = { 2023: 15, 2024: 15, 2025: 16, 2026: 17, 2027: 17 };

  var ACTIVITY_OPTIONS = [
    "Non-specialized wholesale trade",
    "Retail sale in non-specialized stores",
    "Freight transport by road",
    "Warehousing and storage",
    "Management consultancy activities",
    "Information technology consultancy",
    "Real estate activities with own or leased property",
    "Manufacture of food products",
    "Construction of buildings",
    "Financial service activities"
  ];

  var DEFAULT_CT = {
    addr_emirate: "", addr_area: "", addr_street: "", addr_building: "", addr_pobox: "",
    _vatAddressPrefilled: false,
    q_partnership: "", q_govt: "", q_basis: "", q_multi: "", q_mne: "", q_uae_law: "",
    q_freezone: "", q_qfzp: "", q_standard_election: "",
    revenue: 0,
    activities: null,
    e_realisation: "", e_transitional: "", e_sbr: "",
    e_trans_property: false, e_trans_intangible: false, e_trans_financial: false,
    a_cogs: 0, a_other_income: 0, a_opex: 0, a_depreciation: 0, a_interest: 0,
    x_domestic_div: 0, x_foreign_div: 0, x_foreign_pe: 0, x_other_exempt: 0, x_unrealised: 0,
    r_qualifying_group: 0, r_restructuring: 0, r_losses_bf: 0, r_losses_used: 0,
    o_entertainment: 0, o_fines: 0, o_donations: 0, o_other_nd: 0, o_tp_adjustment: 0,
    q_prior_revenue: "",
    t_nonqualifying: 0, t_nonqualifying_revenue: 0, t_group_revenue: 0,
    t_cbcr_revenue: 0, t_cbcr_profit: 0, t_payroll_costs: 0, t_tangible_assets: 0,
    c_foreign_credit: 0, c_withholding: 0,
    d_prepared_by: "Taxable Person", d_declaration: false
  };

  var state = ET.Store.get();
  var ct = state.ct || {};
  Object.keys(DEFAULT_CT).forEach(function (k) {
    if (ct[k] === undefined) ct[k] = DEFAULT_CT[k];
  });
  if (!ct.activities || !ct.activities.length) {
    ct.activities = [{ name: state.person.primaryBusiness, pct: 100, primary: true }];
  }
  if (!ct.a_revenue) ct.a_revenue = ct.revenue;

  /* PART 6 — VAT -> CT common-profile prefill. Runs exactly once per
     student (guarded by _vatAddressPrefilled, persisted below), so it
     never clobbers a value the trainee has since edited or cleared on
     purpose. VAT only stores a single free-text address line plus an
     Emirate dropdown (no separate area/building/PO box), so Emirate maps
     directly and the free-text line is used as a starting point for
     Street — Area, Building and P.O. Box stay CT-specific fields the
     trainee fills in themselves. */
  if (!ct._vatAddressPrefilled) {
    if (!ct.addr_emirate && state.person.emirate) ct.addr_emirate = state.person.emirate;
    if (!ct.addr_street && state.person.address) ct.addr_street = state.person.address;
    ct._vatAddressPrefilled = true;
  }

  var current = state.step || 1;
  var TOTAL_STEPS = 8;

  /* ---------------------------------------------------------- persistence */
  function persist(extra) {
    ET.Store.update(function (s) {
      s.ct = ct;
      s.step = current;
      s.maxStepReached = Math.max(s.maxStepReached || 1, current);
      if (extra) extra(s);
    });
  }

  /* ---------------------------------------------------------- computation */
  function n(v) { return ET.toNumber(v); }

  function periodEndYear() {
    try {
      var to = ET.Store.get().period.to;      // dd/mm/yyyy
      return parseInt(String(to).slice(-4), 10) || new Date().getFullYear();
    } catch (e) { return new Date().getFullYear(); }
  }

  function periodBeginYear() {
    try {
      var from = ET.Store.get().period.from;  // dd/mm/yyyy
      return parseInt(String(from).slice(-4), 10) || new Date().getFullYear();
    } catch (e) { return new Date().getFullYear(); }
  }

  function sbieRatesFor(year) {
    return SBIE_SCHEDULE[year] || (year > 2032 ? SBIE_FINAL : SBIE_SCHEDULE[2023]);
  }

  /* isQfzp is the derived, Free-Zone-gated flag (c.qfzpClaimed) — never
     read ct.q_qfzp directly here, since that raw field can be a stale
     leftover from an earlier "Free Zone = Yes" answer that was since
     changed back to "No" (see the q_freezone reset logic in bindInputs). */
  function sbrEligible(isQfzp) {
    return n(ct.revenue) <= SBR_REVENUE_CAP &&
           ct.q_mne !== "yes" &&
           !isQfzp &&
           ct.q_prior_revenue !== "yes" &&
           periodEndYear() <= SBR_LAST_PERIOD_END_YEAR;
  }

  function compute() {
    var c = {};
    c.revenue = n(ct.revenue);
    c.grossProfit = c.revenue - n(ct.a_cogs);
    c.accountingIncome = c.grossProfit + n(ct.a_other_income) - n(ct.a_opex) -
                         n(ct.a_depreciation) - n(ct.a_interest);

    c.exemptTotal = n(ct.x_domestic_div) + n(ct.x_foreign_div) +
                    n(ct.x_foreign_pe) + n(ct.x_other_exempt);
    c.unrealised = (ct.e_realisation === "yes") ? n(ct.x_unrealised) : 0;

    c.entertainmentAddBack = Math.round(n(ct.o_entertainment) * 0.5);
    c.netInterest = n(ct.a_interest);
    c.ebitda = c.accountingIncome + n(ct.a_interest) + n(ct.a_depreciation);
    /* De minimis safe harbour first: net interest up to AED 12,000,000 is
       always fully deductible regardless of EBITDA. Only interest above
       that threshold is tested against 30% of EBITDA. */
    c.interestAllowed = (c.netInterest <= INTEREST_SAFE_HARBOUR)
      ? c.netInterest
      : Math.max(Math.round(c.ebitda * 0.3), INTEREST_SAFE_HARBOUR);
    c.interestDisallowed = Math.max(0, c.netInterest - c.interestAllowed);

    c.addBacks = c.entertainmentAddBack + n(ct.o_fines) + n(ct.o_donations) +
                 n(ct.o_other_nd) + c.interestDisallowed + n(ct.o_tp_adjustment);

    c.reliefs = n(ct.r_qualifying_group) + n(ct.r_restructuring);

    c.incomeBeforeLosses = c.accountingIncome - c.exemptTotal - c.unrealised +
                           c.addBacks - c.reliefs;

    c.lossCap = Math.max(0, Math.round(c.incomeBeforeLosses * LOSS_CAP_RATE));
    c.lossesAvailable = n(ct.r_losses_bf);
    c.lossesUsed = Math.min(n(ct.r_losses_used), c.lossesAvailable, c.lossCap);
    c.lossesCf = Math.max(0, c.lossesAvailable - c.lossesUsed);

    c.taxableIncome = Math.max(0, c.incomeBeforeLosses - c.lossesUsed);

    /* QFZP status must be derived BEFORE sbrEligible() runs, since SBR
       eligibility depends on it — this is the single source of truth for
       Free Zone / QFZP status; nothing downstream should read the raw
       ct.q_qfzp field directly. */
    c.deMinimis = Math.min(Math.round(c.revenue * QFZP_DEMINIMIS_RATE), QFZP_DEMINIMIS_CAP);
    c.nonQualifyingRevenue = n(ct.t_nonqualifying_revenue);
    c.qfzpClaimed = (ct.q_freezone === "yes" && ct.q_qfzp === "yes" &&
                     ct.q_standard_election !== "yes");
    c.deMinimisBreached = c.qfzpClaimed && c.nonQualifyingRevenue > c.deMinimis;
    c.qfzpActive = c.qfzpClaimed && !c.deMinimisBreached;

    c.sbrEligible = sbrEligible(c.qfzpClaimed);
    c.sbrApplied = (ct.e_sbr === "yes") && c.sbrEligible;
    c.sbrWindowOpen = periodEndYear() <= SBR_LAST_PERIOD_END_YEAR;

    if (c.sbrApplied) {
      c.band0 = 0;
      c.band9 = 0;
      c.taxBefore = 0;
      c.regime = "Small Business Relief elected \u2014 the taxable person is treated as having no taxable income for this tax period.";
    } else if (c.qfzpActive) {
      c.band0 = 0;
      c.band9 = Math.max(0, n(ct.t_nonqualifying));
      c.taxBefore = Math.round(c.band9 * RATE);
      c.regime = "Qualifying Free Zone Person \u2014 Qualifying Income is taxed at 0% and Non-Qualifying Income at 9% with no AED 375,000 threshold.";
    } else {
      c.band0 = Math.min(c.taxableIncome, THRESHOLD);
      c.band9 = Math.max(0, c.taxableIncome - THRESHOLD);
      c.taxBefore = Math.round(c.band9 * RATE);
      c.regime = c.deMinimisBreached
        ? "Qualifying Free Zone Person conditions failed (de minimis exceeded) \u2014 taxed under the standard regime: 0% on the first AED 375,000 and 9% on the balance."
        : "Standard Corporate Tax regime \u2014 0% on the first AED 375,000 of taxable income and 9% on the balance.";
    }

    c.creditsAvailable = n(ct.c_foreign_credit) + n(ct.c_withholding);
    c.creditsUsed = Math.min(c.creditsAvailable, c.taxBefore);
    c.taxAfterCredits = Math.max(0, c.taxBefore - c.creditsUsed);

    /* Domestic Minimum Top-up Tax: tops the UAE effective rate up to 15%
       for members of an MNE Group at or above the EUR 750m threshold,
       unless the UAE jurisdiction qualifies for the Transitional CbCR
       Safe Harbour (de minimis, routine profits, or simplified ETR test). */
    c.groupRevenue = n(ct.t_group_revenue);
    c.inScopeDmtt = (ct.q_mne === "yes") && c.groupRevenue >= DMTT_GROUP_REVENUE;
    var dmttBase = c.sbrApplied ? 0 : (c.qfzpActive ? c.band9 : c.taxableIncome);
    c.dmttMinimum = c.inScopeDmtt ? Math.round(dmttBase * DMTT_RATE) : 0;
    c.effectiveRate = dmttBase > 0 ? (c.taxBefore / dmttBase) : 0;

    c.beginYear = periodBeginYear();
    c.safeHarbourWindowOpen = c.beginYear <= SAFE_HARBOUR_LAST_FY_BEGIN;
    var sbieRates = sbieRatesFor(c.beginYear);
    c.sbie = Math.round(n(ct.t_payroll_costs) * sbieRates[0] / 100 +
                        n(ct.t_tangible_assets) * sbieRates[1] / 100);
    c.cbcrRevenue = n(ct.t_cbcr_revenue);
    c.cbcrProfit = n(ct.t_cbcr_profit);
    var deMinimisRevenueAed = Math.round(DEMINIMIS_REVENUE_EUR * AED_PER_EUR);
    var deMinimisProfitAed = Math.round(DEMINIMIS_PROFIT_EUR * AED_PER_EUR);
    c.deMinimisTestPass = c.cbcrRevenue < deMinimisRevenueAed && c.cbcrProfit < deMinimisProfitAed;
    c.routineTestPass = c.cbcrProfit <= c.sbie;
    var etrTransitionPct = ETR_TRANSITION_SCHEDULE[c.beginYear] ||
      (c.beginYear > 2027 ? null : ETR_TRANSITION_SCHEDULE[2023]);
    c.etrTransitionPct = etrTransitionPct;
    c.etrTestPass = etrTransitionPct != null && (c.effectiveRate * 100) >= etrTransitionPct;

    c.deMinimisTestText = c.deMinimisTestPass ? "Passes" : "Does not pass";
    c.routineTestText = c.routineTestPass ? "Passes" : "Does not pass";
    c.etrTestText = etrTransitionPct == null ? "Not available" :
      (c.etrTestPass ? "Passes (≥ " + etrTransitionPct + "%)" : "Does not pass (< " + etrTransitionPct + "%)");

    c.safeHarbourApplies = c.inScopeDmtt && c.safeHarbourWindowOpen &&
      (c.deMinimisTestPass || c.routineTestPass || c.etrTestPass);

    c.dmttTopUp = (c.inScopeDmtt && !c.safeHarbourApplies)
      ? Math.max(0, c.dmttMinimum - c.taxBefore) : 0;

    c.netPayable = Math.max(0, c.taxAfterCredits + c.dmttTopUp);

    /* negative mirrors used in the summary chain */
    c.exemptTotalNeg = -c.exemptTotal;
    c.unrealisedNeg = -c.unrealised;
    c.reliefsNeg = -c.reliefs;
    c.lossesUsedNeg = -c.lossesUsed;
    c.activityCount = ct.activities.length;
    c.activityTotal = ct.activities.reduce(function (t, a) { return t + n(a.pct); }, 0);
    return c;
  }

  /* ---------------------------------------------------------- validation */
  function req(errors, step, key, message) {
    var v = ct[key];
    if (v === "" || v === null || v === undefined || v === false) {
      errors.push({ step: step, key: key, message: message });
    }
  }

  function validateAll() {
    var c = compute();
    var e = [];

    /* Step 1 */
    req(e, 1, "addr_emirate", "Select the emirate of the registered address.");
    req(e, 1, "addr_area", "Enter the area of the registered address.");
    req(e, 1, "addr_street", "Enter the street of the registered address.");
    req(e, 1, "addr_building", "Enter the building name or number.");
    req(e, 1, "q_partnership", "Answer the Unincorporated Partnership question.");
    req(e, 1, "q_govt", "Answer the Government / Extractive Business question.");
    req(e, 1, "q_basis", "Confirm whether the financial statements use the cash or accrual basis.");
    req(e, 1, "q_multi", "Confirm whether more than one business activity is conducted.");
    req(e, 1, "q_mne", "Answer the Multinational Enterprise Group question.");
    req(e, 1, "q_uae_law", "Answer the incorporation question.");
    req(e, 1, "q_freezone", "Answer the Free Zone question.");
    if (n(ct.revenue) <= 0) {
      e.push({ step: 1, key: "revenue", message: "Enter the revenue derived during the tax period." });
    }
    if (ct.q_freezone === "yes") {
      req(e, 1, "q_qfzp", "Confirm whether the Qualifying Free Zone Person conditions are met.");
      req(e, 1, "q_standard_election", "Confirm whether the standard regime election is being made.");
    }
    if (Math.abs(c.activityTotal - 100) > ACTIVITY_TOTAL_TOLERANCE) {
      e.push({ step: 1, key: "activities", message: "The business activity percentages must add up to 100%." });
    }
    if (ct.q_multi === "yes" && ct.activities.length < 2) {
      e.push({ step: 1, key: "activities", message: "Add at least two business activities, or answer No above." });
    }
    if (ct.q_multi === "no" && ct.activities.length > 1) {
      e.push({ step: 1, key: "activities", message: "Only one activity can be listed when a single business is conducted." });
    }

    /* Step 2 */
    req(e, 2, "e_realisation", "Answer the realisation basis election.");
    req(e, 2, "e_transitional", "Answer the transitional rules election.");
    req(e, 2, "q_prior_revenue", "Confirm whether revenue exceeded AED 3,000,000 in an earlier tax period.");
    if (c.sbrEligible) {
      req(e, 2, "e_sbr", "Answer the Small Business Relief election.");
    }

    /* Step 3 */
    ["a_cogs", "a_other_income", "a_opex", "a_depreciation", "a_interest"].forEach(function (k) {
      if (n(ct[k]) < 0) e.push({ step: 3, key: k, message: "Enter a positive amount." });
    });
    if (n(ct.a_cogs) > c.revenue * 5) {
      e.push({ step: 3, key: "a_cogs", message: "Cost of sales looks inconsistent with the revenue reported." });
    }

    /* Step 4 */
    ["x_domestic_div", "x_foreign_div", "x_foreign_pe", "x_other_exempt", "x_unrealised"].forEach(function (k) {
      if (n(ct[k]) < 0) e.push({ step: 4, key: k, message: "Enter a positive amount." });
    });

    /* Step 5 */
    ["r_qualifying_group", "r_restructuring", "r_losses_bf", "r_losses_used"].forEach(function (k) {
      if (n(ct[k]) < 0) e.push({ step: 5, key: k, message: "Enter a positive amount." });
    });
    if (n(ct.r_losses_used) > n(ct.r_losses_bf)) {
      e.push({ step: 5, key: "r_losses_used", message: "Losses utilised cannot exceed the losses brought forward." });
    }
    if (n(ct.r_losses_used) > c.lossCap) {
      e.push({ step: 5, key: "r_losses_used", message: "Losses utilised are capped at 75% of the taxable income before the offset (AED " + ET.money(c.lossCap) + ")." });
    }

    /* Step 6 */
    ["o_entertainment", "o_fines", "o_donations", "o_other_nd"].forEach(function (k) {
      if (n(ct[k]) < 0) e.push({ step: 6, key: k, message: "Enter a positive amount." });
    });

    /* Step 7 */
    if (c.qfzpClaimed && n(ct.t_nonqualifying) < 0) {
      e.push({ step: 7, key: "t_nonqualifying", message: "Enter the Non-Qualifying Income subject to 9%." });
    }
    if (c.qfzpClaimed && n(ct.t_nonqualifying_revenue) < 0) {
      e.push({ step: 7, key: "t_nonqualifying_revenue", message: "Enter the Non-Qualifying Revenue for the tax period." });
    }
    if (ct.q_mne === "yes" && n(ct.t_group_revenue) <= 0) {
      e.push({ step: 7, key: "t_group_revenue", message: "Enter the consolidated revenue of the Multinational Enterprise Group." });
    }
    if (c.inScopeDmtt) {
      if (n(ct.t_cbcr_revenue) <= 0) {
        e.push({ step: 7, key: "t_cbcr_revenue", message: "Enter the UAE jurisdiction revenue per the Country-by-Country Report." });
      }
      if (ct.t_cbcr_profit === "" || ct.t_cbcr_profit === null || ct.t_cbcr_profit === undefined) {
        e.push({ step: 7, key: "t_cbcr_profit", message: "Enter the UAE jurisdiction profit before tax." });
      }
      if (n(ct.t_payroll_costs) < 0) {
        e.push({ step: 7, key: "t_payroll_costs", message: "Enter a positive amount." });
      }
      if (n(ct.t_tangible_assets) < 0) {
        e.push({ step: 7, key: "t_tangible_assets", message: "Enter a positive amount." });
      }
    }
    if (c.creditsAvailable > c.taxBefore) {
      e.push({ step: 7, key: "c_foreign_credit",
               message: "Tax credits cannot exceed the Corporate Tax before credits (AED " + ET.money(c.taxBefore) + ")." });
    }

    /* Step 8 */
    req(e, 8, "d_prepared_by", "Confirm who the tax return is being prepared by.");
    if (!ct.d_declaration) {
      e.push({ step: 8, key: "d_declaration", message: "Confirm the declaration before submitting." });
    }

    return e;
  }

  /* ---------------------------------------------------------- rendering */
  function fmt(v) { return ET.money(v); }

  function renderCalcs() {
    var c = compute();
    document.querySelectorAll("[data-calc]").forEach(function (el) {
      var k = el.getAttribute("data-calc");
      if (c[k] !== undefined) el.textContent = fmt(c[k]);
    });
    document.querySelectorAll("[data-calc-text]").forEach(function (el) {
      var k = el.getAttribute("data-calc-text");
      if (c[k] !== undefined) el.value = c[k];
    });
    document.querySelectorAll("[data-calc-str]").forEach(function (el) {
      var k = el.getAttribute("data-calc-str");
      if (c[k] !== undefined) el.textContent = c[k];
    });

    var regime = document.getElementById("regime-text");
    if (regime) regime.textContent = c.regime;

    var dmTxt = document.getElementById("deminimis-text");
    if (dmTxt) {
      if (c.deMinimisBreached) {
        dmTxt.textContent = "Non-Qualifying Revenue of AED " + fmt(c.nonQualifyingRevenue) +
          " exceeds the de minimis threshold of AED " + fmt(c.deMinimis) +
          ". The Qualifying Free Zone Person status is lost for this tax period, so all taxable income is charged under the standard regime.";
        document.getElementById("deminimis-note").className = "note-box";
      } else {
        dmTxt.textContent = "Non-Qualifying Revenue is within the de minimis threshold of AED " +
          fmt(c.deMinimis) + ", so the Qualifying Free Zone Person status is maintained.";
        document.getElementById("deminimis-note").className = "note-box ok";
      }
    }

    var dmttTxt = document.getElementById("dmtt-text");
    if (dmttTxt) {
      if (c.inScopeDmtt) {
        dmttTxt.textContent = "The group is at or above AED 3,150,000,000, so a minimum effective rate of 15% applies " +
          "unless the UAE jurisdiction qualifies for the Transitional CbCR Safe Harbour below. " +
          "Effective rate before top-up: " + (c.effectiveRate * 100).toFixed(2) + "%.";
      } else {
        dmttTxt.textContent = "The Domestic Minimum Top-up Tax applies only where the group's consolidated revenue is " +
          "AED 3,150,000,000 or more in at least two of the four preceding financial years.";
      }
    }

    var shTxt = document.getElementById("safeharbour-text");
    if (shTxt) {
      if (!c.safeHarbourWindowOpen) {
        shTxt.innerHTML = "The Transitional CbCR Safe Harbour only covers fiscal years beginning on or before 31 December " +
          SAFE_HARBOUR_LAST_FY_BEGIN + ". This tax period does not qualify, so the full 15% minimum computation applies: " +
          "<strong>top-up payable AED " + fmt(c.dmttTopUp) + "</strong>.";
        document.getElementById("safeharbour-note").className = "note-box";
      } else if (c.safeHarbourApplies) {
        var passed = [];
        if (c.deMinimisTestPass) passed.push("de minimis test");
        if (c.routineTestPass) passed.push("routine profits test");
        if (c.etrTestPass) passed.push("simplified ETR test");
        shTxt.innerHTML = "The UAE jurisdiction passes the " + passed.join(" and ") +
          ", so its Top-up Tax is deemed nil under the Transitional CbCR Safe Harbour. " +
          "<strong>No Domestic Minimum Top-up Tax is payable.</strong>";
        document.getElementById("safeharbour-note").className = "note-box ok";
      } else {
        shTxt.innerHTML = "None of the three tests are met, so the safe harbour does not apply: " +
          "<strong>top-up payable AED " + fmt(c.dmttTopUp) + "</strong>.";
        document.getElementById("safeharbour-note").className = "note-box";
      }
    }

    var sbrText = document.getElementById("sbr-note-text");
    if (sbrText) {
      if (c.sbrEligible) {
        sbrText.textContent = "Revenue of AED " + fmt(c.revenue) +
          " is within the AED 3,000,000 threshold and the tax period ends on or before 31 December " +
          SBR_LAST_PERIOD_END_YEAR + ", so the Small Business Relief election is available.";
        document.getElementById("sbr-note").className = "note-box ok";
      } else {
        var why = [];
        if (n(ct.revenue) > SBR_REVENUE_CAP) why.push("revenue exceeds AED 3,000,000");
        if (ct.q_prior_revenue === "yes") why.push("revenue exceeded AED 3,000,000 in an earlier tax period");
        if (ct.q_mne === "yes") why.push("the taxable person is a member of a Multinational Enterprise Group");
        if (c.qfzpClaimed) why.push("the taxable person is a Qualifying Free Zone Person");
        if (!c.sbrWindowOpen) why.push("the relief only covers tax periods ending on or before 31 December " + SBR_LAST_PERIOD_END_YEAR);
        sbrText.textContent = "Small Business Relief is not available because " +
          (why.join(" and ") || "the eligibility conditions are not met") + ".";
        document.getElementById("sbr-note").className = "note-box";
      }
      document.querySelectorAll('input[name="e_sbr"]').forEach(function (r) {
        r.disabled = !c.sbrEligible;
      });
      if (!c.sbrEligible && ct.e_sbr === "yes") {
        ct.e_sbr = "no";
        var no = document.querySelector('input[name="e_sbr"][value="no"]');
        if (no) no.checked = true;
      }
    }

    var reliefText = document.getElementById("sbr-relief-text");
    if (reliefText) {
      reliefText.textContent = c.sbrApplied
        ? "Small Business Relief has been elected. The taxable income for this tax period is treated as nil, and tax losses of this period cannot be carried forward."
        : "Small Business Relief has not been elected for this tax period, so the reliefs and tax losses below are applied in the normal way.";
    }

    updateDependencies(c);
    updateWarnBadge();
    if (current === 8) renderReview(c);
  }

  function updateDependencies(c) {
    document.querySelectorAll("[data-depends]").forEach(function (el) {
      var spec = el.getAttribute("data-depends").split("=");
      var key = spec[0], want = spec[1];
      var actual;
      if (key === "qfzpActive") actual = c.qfzpActive ? "yes" : "no";
      else if (key === "inScopeDmtt") actual = c.inScopeDmtt ? "yes" : "no";
      else actual = ct[key];
      el.classList.toggle("hidden", actual !== want);
    });
  }

  /* ---------------------------------------------------------- activities */
  function renderActivities() {
    var host = document.getElementById("activity-rows");
    if (!host) return;
    host.innerHTML = "";
    ct.activities.forEach(function (a, i) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td style="text-align:center"><input type="radio" name="primary-activity" ' +
          (a.primary ? "checked" : "") + '></td>' +
        '<td></td>' +
        '<td><input type="text" class="num" value="' + a.pct + '" ' +
          'style="width:110px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:4px;text-align:right"></td>' +
        '<td style="text-align:center"><button class="row-actions" type="button" title="Remove">&#10005;</button></td>';
      tr.children[1].textContent = a.name;
      tr.querySelector('input[type="radio"]').addEventListener("change", function () {
        ct.activities.forEach(function (x, j) { x.primary = (i === j); });
        persist();
      });
      var pct = tr.querySelector('td:nth-child(3) input');
      pct.addEventListener("input", function () {
        var v = parseFloat(pct.value.replace(/[^0-9.]/g, ""));
        ct.activities[i].pct = isFinite(v) ? v : 0;
        persist(); renderCalcs(); paintErrors();
      });
      tr.querySelector("button").addEventListener("click", function () {
        if (ct.activities.length === 1) {
          ET.toast("At least one business activity must be listed", "warn");
          return;
        }
        var wasPrimary = ct.activities[i].primary;
        ct.activities.splice(i, 1);
        if (wasPrimary) ct.activities[0].primary = true;
        persist(); renderActivities(); renderCalcs(); paintErrors();
      });
      host.appendChild(tr);
    });
  }

  function openAddActivity() {
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    var opts = ACTIVITY_OPTIONS.map(function (o) {
      return '<option value="' + o + '">' + o + '</option>';
    }).join("");
    overlay.innerHTML =
      '<div class="modal-box wide">' +
        '<div class="modal-head"><span>Add Business Activity</span>' +
        '<button type="button" data-close aria-label="Close">&#10005;</button></div>' +
        '<div class="modal-body">' +
          '<div class="field"><label>Business Activity</label><select id="act-name">' + opts + '</select></div>' +
          '<div class="field"><label>Percentage of total revenue (%)</label>' +
          '<input type="text" class="num" id="act-pct" value="0"></div>' +
          '<div class="note-box info">The percentages across all listed activities must add up to 100%.</div>' +
          '<div class="modal-actions">' +
            '<button type="button" class="btn btn-ghost" data-close>Cancel</button>' +
            '<button type="button" class="btn btn-primary" id="act-add">Add activity</button>' +
          '</div>' +
        '</div></div>';
    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", close); });
    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) close(); });
    overlay.querySelector("#act-add").addEventListener("click", function () {
      var name = overlay.querySelector("#act-name").value;
      var pct = parseFloat(overlay.querySelector("#act-pct").value.replace(/[^0-9.]/g, "")) || 0;
      if (ct.activities.some(function (a) { return a.name === name; })) {
        ET.toast("That business activity is already listed", "warn");
        return;
      }
      ct.activities.push({ name: name, pct: pct, primary: false });
      if (ct.activities.length > 1 && ct.q_multi === "no") {
        ct.q_multi = "yes";
        var yes = document.querySelector('input[name="q_multi"][value="yes"]');
        if (yes) yes.checked = true;
      }
      persist(); renderActivities(); renderCalcs(); paintErrors(); close();
      ET.toast("Business activity added", "ok");
    });
    document.body.appendChild(overlay);
  }

  /* ---------------------------------------------------------- review */
  function reviewRow(label, value, strong) {
    return '<div class="calc-row' + (strong ? " total" : "") + '">' +
           '<span class="k">' + label + '</span><span class="v">' + value + '</span></div>';
  }

  function yn(v) { return v === "yes" ? "Yes" : (v === "no" ? "No" : "&mdash;"); }

  function renderReview(c) {
    var host = document.getElementById("review-host");
    if (!host) return;
    var p = ET.Store.get().person;
    var acts = ct.activities.map(function (a) {
      return a.name + " (" + a.pct + "%)" + (a.primary ? " \u2013 primary" : "");
    }).join("<br>");

    host.innerHTML =
      '<h3 class="section-title plain">Taxpayer Details</h3>' +
      reviewRow("Taxable Person", p.nameEn) +
      reviewRow("TRN", p.trn) +
      reviewRow("Registered address", [ct.addr_building, ct.addr_street, ct.addr_area, ct.addr_emirate]
        .filter(Boolean).join(", ") || "&mdash;") +
      reviewRow("Revenue for the tax period", "AED " + fmt(c.revenue)) +
      reviewRow("Accounting basis", ct.q_basis ? (ct.q_basis === "cash" ? "Cash" : "Accrual") : "&mdash;") +
      reviewRow("Business activities", acts) +
      reviewRow("Free Zone / Qualifying Free Zone Person", yn(ct.q_freezone) + " / " + (c.qfzpClaimed ? "Yes" : "No")) +

      '<h3 class="section-title plain" style="margin-top:22px">Elections</h3>' +
      reviewRow("Realisation basis", yn(ct.e_realisation)) +
      reviewRow("Transitional rules", yn(ct.e_transitional)) +
      reviewRow("Small Business Relief", c.sbrApplied ? "Elected" : "Not elected") +

      '<h3 class="section-title plain" style="margin-top:22px">Tax computation</h3>' +
      reviewRow("Net accounting income", "AED " + fmt(c.accountingIncome)) +
      reviewRow("Total exempt income", "(AED " + fmt(c.exemptTotal) + ")") +
      reviewRow("Total adjustments added back", "AED " + fmt(c.addBacks)) +
      reviewRow("Reliefs claimed", "(AED " + fmt(c.reliefs) + ")") +
      reviewRow("Tax losses utilised", "(AED " + fmt(c.lossesUsed) + ")") +
      reviewRow("Taxable income", "AED " + fmt(c.sbrApplied ? 0 : c.taxableIncome), true) +
      reviewRow("Corporate Tax before credits", "AED " + fmt(c.taxBefore)) +
      reviewRow("Tax credits applied", "(AED " + fmt(c.creditsUsed) + ")") +
      (c.inScopeDmtt ? reviewRow("Domestic Minimum Top-up Tax", c.safeHarbourApplies
        ? "AED 0 (Transitional CbCR Safe Harbour applies)"
        : "AED " + fmt(c.dmttTopUp)) : "") +
      '<div class="calc-row grand"><span class="k">Net Corporate Tax Payable</span>' +
      '<span class="v">AED ' + fmt(c.netPayable) + '</span></div>';
  }

  /* ---------------------------------------------------------- errors */
  function paintErrors(showAll) {
    var errs = validateAll();
    document.querySelectorAll("[data-field]").forEach(function (el) {
      el.classList.remove("err");
    });
    errs.forEach(function (err) {
      if (!showAll && err.step !== current) return;
      var host = document.querySelector('[data-field="' + err.key + '"]');
      if (host) {
        host.classList.add("err");
        var msg = host.querySelector(".msg");
        if (msg) msg.textContent = err.message;
      }
    });
    updateWarnBadge(errs);
    return errs;
  }

  function updateWarnBadge(errs) {
    errs = errs || validateAll();
    var badge = document.getElementById("warn-badge");
    var count = document.getElementById("warn-count");
    if (!badge) return;
    count.textContent = errs.length;
    badge.classList.toggle("clean", errs.length === 0);
  }

  function showErrorList() {
    var errs = validateAll();
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    var rows = errs.length
      ? errs.map(function (e) {
          return '<li style="margin-bottom:8px"><button class="link-btn" data-goto="' + e.step + '">Step ' +
                 e.step + '</button> &mdash; ' + e.message + '</li>';
        }).join("")
      : '<li>There are no outstanding validation messages. The return is ready to submit.</li>';
    overlay.innerHTML =
      '<div class="modal-box wide"><div class="modal-head"><span>Validation messages (' + errs.length + ')</span>' +
      '<button type="button" data-close aria-label="Close">&#10005;</button></div>' +
      '<div class="modal-body"><ul style="font-size:.8rem;padding-left:18px">' + rows + '</ul>' +
      '<div class="modal-actions"><button type="button" class="btn btn-primary" data-close>Close</button></div>' +
      '</div></div>';
    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", close); });
    overlay.querySelectorAll("[data-goto]").forEach(function (b) {
      b.addEventListener("click", function () {
        close();
        goStep(parseInt(b.getAttribute("data-goto"), 10));
      });
    });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
  }

  /* ---------------------------------------------------------- navigation */
  function goStep(step, skipValidation) {
    if (step > current && !skipValidation) {
      var errs = validateAll().filter(function (e) { return e.step <= current; });
      var blocking = errs.filter(function (e) { return e.step === current; });
      if (blocking.length) {
        paintErrors();
        ET.toast(blocking.length + " item" + (blocking.length > 1 ? "s" : "") + " on this step need attention", "warn");
        var first = document.querySelector('[data-field="' + blocking[0].key + '"]');
        if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    current = Math.min(TOTAL_STEPS, Math.max(1, step));
    document.querySelectorAll("[data-step-panel]").forEach(function (p) {
      p.classList.toggle("hidden", parseInt(p.getAttribute("data-step-panel"), 10) !== current);
    });
    document.querySelectorAll(".step").forEach(function (b) {
      var i = parseInt(b.getAttribute("data-step"), 10);
      b.classList.toggle("current", i === current);
      b.classList.toggle("done", i < current);
    });
    document.getElementById("btn-prev").disabled = (current === 1);
    document.getElementById("btn-next").classList.toggle("hidden", current === TOTAL_STEPS);
    document.getElementById("btn-submit").classList.toggle("hidden", current !== TOTAL_STEPS);
    persist();
    renderCalcs();
    paintErrors();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------------------------------------------------- binding */
  function bindInputs() {
    var p = ET.Store.get().person;

    document.querySelectorAll("[data-ro]").forEach(function (el) {
      var path = el.getAttribute("data-ro").split(".");
      var v = { person: p }[path[0]];
      for (var i = 1; i < path.length && v != null; i++) v = v[path[i]];
      el.value = (v == null ? "" : v);
    });

    document.querySelectorAll("[data-f]").forEach(function (el) {
      var key = el.getAttribute("data-f");

      if (el.type === "radio") {
        el.checked = (ct[key] === el.value);
        el.addEventListener("change", function () {
          if (el.checked) {
            ct[key] = el.value;
            if (key === "q_multi" && el.value === "no" && ct.activities.length > 1) {
              ct.activities = [ct.activities.find(function (a) { return a.primary; }) || ct.activities[0]];
              ct.activities[0].pct = 100;
              ct.activities[0].primary = true;
              renderActivities();
            }
            /* Free Zone = No means everything QFZP-dependent must reset —
               otherwise a stale "yes" left over from an earlier answer
               keeps leaking into the SBR eligibility check, the SBR
               explanation text and the Review screen (all now correctly
               keyed off c.qfzpClaimed, but that flag is only as good as
               the underlying ct.q_qfzp/q_standard_election fields it
               reads). Clearing here removes the stale state at the
               source instead of relying on every downstream reader to
               re-gate it. */
            if (key === "q_freezone" && el.value === "no") {
              ct.q_qfzp = "";
              ct.q_standard_election = "";
              ct.t_nonqualifying = 0;
              ct.t_nonqualifying_revenue = 0;
              document.querySelectorAll('input[name="q_qfzp"], input[name="q_standard_election"]').forEach(function (r) {
                r.checked = false;
              });
              var nqEl = document.querySelector('[data-f="t_nonqualifying"]');
              var nqrEl = document.querySelector('[data-f="t_nonqualifying_revenue"]');
              if (nqEl) nqEl.value = ET.money(0);
              if (nqrEl) nqrEl.value = ET.money(0);
            }
            persist(); renderCalcs(); paintErrors();
          }
        });
        return;
      }

      if (el.type === "checkbox") {
        el.checked = !!ct[key];
        el.addEventListener("change", function () {
          ct[key] = el.checked;
          persist(); renderCalcs(); paintErrors();
        });
        return;
      }

      if (el.tagName === "SELECT") {
        el.value = ct[key] || "";
        el.addEventListener("change", function () {
          ct[key] = el.value;
          persist(); renderCalcs(); paintErrors();
        });
        return;
      }

      var isNum = el.hasAttribute("data-num");
      el.value = isNum ? ET.money(ct[key]) : (ct[key] || "");

      if (isNum) {
        el.addEventListener("focus", function () {
          var v = ET.toNumber(ct[key]);
          el.value = v === 0 ? "" : String(v);
          el.select();
        });
        el.addEventListener("input", function () {
          var allowNeg = el.hasAttribute("data-neg");
          var cleaned = el.value.replace(allowNeg ? /[^0-9\-]/g : /[^0-9]/g, "");
          if (allowNeg) cleaned = cleaned.replace(/(?!^)-/g, "");
          if (cleaned !== el.value) el.value = cleaned;
          ct[key] = ET.toNumber(cleaned);
          if (key === "revenue") ct.a_revenue = ct[key];
          syncMirror();
          persist(); renderCalcs(); paintErrors();
        });
        el.addEventListener("blur", function () {
          el.value = ET.money(ct[key]);
        });
      } else {
        el.addEventListener("input", function () {
          ct[key] = el.value;
          persist(); paintErrors();
        });
      }
    });
  }

  function syncMirror() {
    var mirror = document.querySelector('[data-f="a_revenue"]');
    if (mirror && document.activeElement !== mirror) mirror.value = ET.money(ct.a_revenue);
  }

  /* ---------------------------------------------------------- actions */
  function wireActions() {
    document.getElementById("btn-prev").addEventListener("click", function () {
      goStep(current - 1, true);
    });
    document.getElementById("btn-next").addEventListener("click", function () {
      goStep(current + 1);
    });
    document.querySelectorAll(".step").forEach(function (b) {
      b.addEventListener("click", function () {
        var target = parseInt(b.getAttribute("data-step"), 10);
        goStep(target, target < current);
      });
    });
    document.getElementById("warn-badge").addEventListener("click", showErrorList);

    document.getElementById("btn-draft").addEventListener("click", function () {
      persist(function (s) { if (s.filing.status !== "Submitted") s.filing.status = "Draft"; });
      ET.toast("Corporate Tax Return saved as draft", "ok");
    });

    document.getElementById("btn-cancel").addEventListener("click", function () {
      ET.confirmDialog({
        title: "Cancel application",
        message: "Cancel this Corporate Tax Return? Everything entered so far will be cleared.",
        yesText: "Cancel application",
        danger: true
      }).then(function (ok) {
        if (!ok) return;
        ET.Store.update(function (s) {
          s.ct = {};
          s.step = 1;
          s.maxStepReached = 1;
          if (s.filing.status !== "Submitted") s.filing.status = "Open";
        });
        location.href = "ct-filings.html";
      });
    });

    document.getElementById("btn-submit").addEventListener("click", function () {
      var errs = paintErrors(true);
      if (errs.length) {
        ET.toast(errs.length + " item" + (errs.length > 1 ? "s" : "") + " must be corrected before submission", "warn");
        showErrorList();
        return;
      }
      ET.confirmDialog({
        title: "Submit Application",
        message: "Are you sure you want to submit the application?",
        yesText: "Yes",
        noText: "No"
      }).then(function (ok) {
        if (!ok) return;
        var c = compute();
        ET.Store.update(function (s) {
          s.ct = ct;
          s.filing.status = "Submitted";
          s.filing.appNumber = ET.appNumber();
          s.filing.submittedOn = ET.stampStr();
          s.filing.netPosition = c.netPayable;
          /* Full snapshot of the computed result at the moment of
             successful submission — this is what the confirmation
             page's PDF download reads from, so the PDF always reflects
             exactly what was actually filed, not a live recomputation
             that could drift if the trainee later reopens the return. */
          s.filing.snapshot = {
            revenue: c.revenue, grossProfit: c.grossProfit, accountingIncome: c.accountingIncome,
            exemptTotal: c.exemptTotal, addBacks: c.addBacks, reliefs: c.reliefs,
            lossesUsed: c.lossesUsed, incomeBeforeLosses: c.incomeBeforeLosses,
            taxableIncome: c.taxableIncome, regime: c.regime,
            band0: c.band0, band9: c.band9, taxBefore: c.taxBefore,
            creditsUsed: c.creditsUsed, taxAfterCredits: c.taxAfterCredits,
            dmttTopUp: c.dmttTopUp, netPayable: c.netPayable
          };
        });
        location.href = "submitted.html";
      });
    });

    var addBtn = document.getElementById("add-activity");
    if (addBtn) addBtn.addEventListener("click", openAddActivity);

    var maxLoss = document.getElementById("use-max-loss");
    if (maxLoss) {
      maxLoss.addEventListener("click", function () {
        var c = compute();
        ct.r_losses_used = Math.min(c.lossesAvailable, c.lossCap);
        var el = document.querySelector('[data-f="r_losses_used"]');
        if (el) el.value = ET.money(ct.r_losses_used);
        persist(); renderCalcs(); paintErrors();
        ET.toast("Applied the maximum allowable loss offset", "ok");
      });
    }

    var subDate = document.getElementById("submission-date");
    if (subDate) subDate.value = ET.todayStr();
  }

  /* ---------------------------------------------------------- start */
  document.addEventListener("DOMContentLoaded", function () {
    if (ET.Store.get().filing.status === "Submitted") {
      location.replace("submitted.html");
      return;
    }
    bindInputs();
    renderActivities();
    wireActions();
    goStep(current, true);
  });
})();
