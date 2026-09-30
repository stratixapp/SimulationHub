/* =============================================================================
   DOT ERP — pages/dashboard.js
   Module 02: Dashboard

   Uses window.ERP (shared runtime from ../script.js) and window.ERP_DashboardData
   (dummy data layer from ../data/dashboard-data.js). Both are loaded before
   this file — see the <script> order at the bottom of dashboard.html.
   ========================================================================== */

(function () {
  "use strict";

  const { $, $$, formatCurrency, formatCurrencyShort, formatDateTime, formatRelativeTime, escapeHtml, showToast, openModal, requireSession, runBootSequence, STORAGE_KEYS } = window.ERP;

  const CATEGORY_PALETTE = ["#1E3A8A", "#2563EB", "#60A5FA", "#93C5FD", "#16A34A", "#F59E0B"];
  const TXN_PAGE_SIZE = 6;

  const ACTIVITY_ICONS = {
    invoice: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 4h9l3 3v13H6V4Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 12h6M9 15.5h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    purchase: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 7h13l2 4H5L3 7Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 11v7M17 11v7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    stock: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.5 8.5 12 4l8.5 4.5-8.5 4.5-8.5-4.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 13v7.5" stroke="currentColor" stroke-width="1.5"/></svg>',
    employee: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.2" stroke="currentColor" stroke-width="1.5"/><path d="M5 19c1.3-3.2 3.8-5 7-5s5.7 1.8 7 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    payment: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M9.8 9.3c0-1 1-1.8 2.2-1.8s2.2.8 2.2 1.6c0 2.2-4.4 1.4-4.4 3.6 0 .9 1 1.6 2.2 1.6s2.2-.7 2.2-1.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M12 6.5v1M12 16v1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    auth: '<svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="3.2" stroke="currentColor" stroke-width="1.5"/><path d="M10.3 10.3 19 19M15.5 15.5l2-2M17.7 17.7l2-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 21 19H3L12 3.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 9.5v4M12 16.5v.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  let snapshot = null;
  let company = null;
  let barChartCtrl = null;
  let donutChartCtrl = null;

  /** Reads a CSS custom property's current computed value — lets canvas-drawn
      chart text stay legible in both Light and Dark theme (Module 8) without
      this file needing to know which theme is active. */
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || fallback;
  }

  let txnFilterStatus = "all";
  let txnSortOrder = "desc";
  let txnSearchTerm = "";
  let txnPage = 1;


  /* -----------------------------------------------------------------------
     KPI CARDS
     --------------------------------------------------------------------- */
  function renderKpiTrend(elId, value, opts) {
    opts = opts || {};
    const el = document.getElementById(elId);
    const isPercent = opts.isPercent !== false;

    // PHASE 8: null means "no prior-day snapshot exists yet" (see
    // data/snapshot-data.js's own header) — genuinely different from a
    // real, tiny 0% change, and shown differently rather than folded into
    // the same "No change" message a real 0 would get.
    if (value === null || value === undefined) {
      el.className = "kpi-card__trend";
      el.style.color = "var(--color-text-muted)";
      el.textContent = "No prior-day data yet";
      return;
    }

    const threshold = isPercent ? 0.05 : 0.5;

    if (Math.abs(value) < threshold) {
      el.className = "kpi-card__trend";
      el.style.color = "var(--color-text-muted)";
      el.textContent = "No change vs yesterday";
      return;
    }

    const positive = value > 0;
    const displayValue = isPercent ? Math.abs(value).toFixed(1) + "%" : Math.abs(Math.round(value));
    const arrowUp = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 19V6M6 11l6-5 6 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const arrowDown = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v13M6 13l6 5 6-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    if (opts.neutral) {
      el.className = "kpi-card__trend";
      el.style.color = "var(--color-accent)";
    } else {
      const good = (opts.goodDirection || "up") === "up" ? positive : !positive;
      el.style.color = "";
      el.className = "kpi-card__trend " + (good ? "kpi-card__trend--up" : "kpi-card__trend--down");
    }
    el.innerHTML = `${positive ? arrowUp : arrowDown}${positive ? "+" : "-"}${displayValue} vs yesterday`;
  }

  /** Renders the small "Baseline: <date>, captured <time>" line next to
      the dashboard's own date label, from snapshot.snapshotInfo (see
      data/snapshot-data.js's own getSnapshotInfo()). Shown even in the
      no-baseline case, so a brand-new company sees an honest "no prior
      day yet" instead of the line just being blank. */
  function renderSnapshotInfo(snapshotInfo) {
    const el = $("#snapshotInfoLabel");
    if (!snapshotInfo) { el.textContent = ""; return; }

    const parts = [];
    if (snapshotInfo.hasBaseline) {
      const baselineDate = new Date(snapshotInfo.baselineDate + "T00:00:00");
      parts.push(`Compared against ${baselineDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`);
    } else {
      parts.push("No prior-day snapshot yet — deltas will appear once one exists");
    }
    if (snapshotInfo.todaySnapshot) {
      const capturedAt = new Date(snapshotInfo.todaySnapshot.capturedAt);
      const label = snapshotInfo.todaySnapshot.isManualCapture ? "captured manually" : "captured automatically";
      parts.push(`today's own snapshot ${label} at ${capturedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`);
    }
    el.textContent = parts.join(" · ");
  }

  function renderKpis(kpis) {
    $("#kpiSalesValue").textContent = formatCurrency(kpis.todaysSales);
    renderKpiTrend("kpiSalesTrend", kpis.salesChangePct, { isPercent: true, goodDirection: "up" });

    $("#kpiPurchasesValue").textContent = formatCurrency(kpis.todaysPurchases);
    renderKpiTrend("kpiPurchasesTrend", kpis.purchasesChangePct, { isPercent: true, neutral: true });

    $("#kpiInventoryValue").textContent = formatCurrency(kpis.inventoryValue);
    renderKpiTrend("kpiInventoryTrend", kpis.inventoryChangePct, { isPercent: true, neutral: true });

    $("#kpiLowStockValue").textContent = String(kpis.lowStockCount);
    renderKpiTrend("kpiLowStockTrend", kpis.lowStockChange, { isPercent: false, goodDirection: "down" });
  }


  /* -----------------------------------------------------------------------
     CHARTS (hand-drawn on <canvas> — no charting library)
     --------------------------------------------------------------------- */
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function setupBarChart(canvas) {
    const ctx = canvas.getContext("2d");
    const PADDING = { top: 16, right: 10, bottom: 26, left: 50 };
    let width = 0, height = 0, dpr = 1, data = [], hoverIndex = null;

    function draw() {
      if (!data.length || width === 0) return;
      ctx.clearRect(0, 0, width, height);
      const plotW = width - PADDING.left - PADDING.right;
      const plotH = height - PADDING.top - PADDING.bottom;
      const maxVal = Math.max(...data.map((d) => Math.max(d.sales, d.purchases))) * 1.15 || 1;

      ctx.strokeStyle = "rgba(148,163,184,0.25)";
      ctx.fillStyle = cssVar("--color-text-muted", "#94A3B8");
      ctx.font = "10px -apple-system, Segoe UI, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const gridCount = 4;
      for (let i = 0; i <= gridCount; i++) {
        const y = PADDING.top + plotH - (plotH * i) / gridCount;
        ctx.beginPath();
        ctx.moveTo(PADDING.left, y);
        ctx.lineTo(width - PADDING.right, y);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillText(formatCurrencyShort((maxVal * i) / gridCount), PADDING.left - 8, y);
      }

      const groupWidth = plotW / data.length;
      const barWidth = Math.min(22, groupWidth * 0.28);
      const gap = 6;

      data.forEach((d, i) => {
        const groupX = PADDING.left + groupWidth * i + groupWidth / 2;
        const salesH = (d.sales / maxVal) * plotH;
        const purchH = (d.purchases / maxVal) * plotH;
        const isHover = i === hoverIndex;

        ctx.fillStyle = isHover ? "#1D4ED8" : "#2563EB";
        roundRectPath(ctx, groupX - barWidth - gap / 2, PADDING.top + plotH - salesH, barWidth, salesH, 3);
        ctx.fill();

        ctx.fillStyle = isHover ? "#60A5FA" : "#93C5FD";
        roundRectPath(ctx, groupX + gap / 2, PADDING.top + plotH - purchH, barWidth, purchH, 3);
        ctx.fill();

        ctx.fillStyle = cssVar("--color-text-muted", "#64748B");
        ctx.font = "11px -apple-system, Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(d.label, groupX, PADDING.top + plotH + 8);
      });

      if (hoverIndex !== null) {
        const d = data[hoverIndex];
        const groupX = PADDING.left + groupWidth * hoverIndex + groupWidth / 2;
        const line1 = "Sales: " + formatCurrencyShort(d.sales);
        const line2 = "Purchases: " + formatCurrencyShort(d.purchases);
        ctx.font = "11px -apple-system, Segoe UI, sans-serif";
        const tw = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 20;
        const tx = Math.max(PADDING.left, Math.min(width - PADDING.right - tw, groupX - tw / 2));
        const ty = PADDING.top + 4;
        ctx.fillStyle = "#1E3A8A";
        roundRectPath(ctx, tx, ty, tw, 40, 6);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(line1, tx + 10, ty + 6);
        ctx.fillText(line2, tx + 10, ty + 22);
      }
    }

    function resize(w, h) {
      width = w; height = h;
      if (width === 0 || height === 0) return;
      dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    canvas.addEventListener("mousemove", (e) => {
      if (!data.length) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const plotW = width - PADDING.left - PADDING.right;
      const groupWidth = plotW / data.length;
      let idx = Math.floor((x - PADDING.left) / groupWidth);
      if (idx < 0 || idx >= data.length) idx = null;
      if (idx !== hoverIndex) { hoverIndex = idx; draw(); }
    });
    canvas.addEventListener("mouseleave", () => { if (hoverIndex !== null) { hoverIndex = null; draw(); } });

    if (window.ResizeObserver) {
      new ResizeObserver((entries) => { const r = entries[0].contentRect; resize(r.width, r.height); }).observe(canvas.parentElement);
    } else {
      window.addEventListener("resize", () => { const r = canvas.parentElement.getBoundingClientRect(); resize(r.width, r.height); });
      const r = canvas.parentElement.getBoundingClientRect();
      resize(r.width, r.height);
    }

    return { update(newData) { data = newData; draw(); } };
  }

  function setupDonutChart(canvas) {
    const ctx = canvas.getContext("2d");
    let width = 0, height = 0, dpr = 1, data = [], total = 0, hoverIndex = null;

    function draw() {
      if (!data.length || width === 0) return;
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2, cy = height / 2 - 6;
      const outerR = Math.min(width, height) / 2 - 10;
      const innerR = outerR * 0.6;
      let startAngle = -Math.PI / 2;

      data.forEach((d, i) => {
        const sliceAngle = (d.value / total) * Math.PI * 2;
        const endAngle = startAngle + sliceAngle;
        const r = i === hoverIndex ? outerR + 4 : outerR;

        ctx.beginPath();
        ctx.moveTo(cx + innerR * Math.cos(startAngle), cy + innerR * Math.sin(startAngle));
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];
        ctx.fill();

        startAngle = endAngle;
      });

      ctx.fillStyle = "#1E3A8A";
      ctx.font = "700 15px -apple-system, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(formatCurrencyShort(total), cx, cy - 6);
      ctx.fillStyle = cssVar("--color-text-muted", "#64748B");
      ctx.font = "10.5px -apple-system, Segoe UI, sans-serif";
      ctx.fillText("Total value", cx, cy + 12);

      if (hoverIndex !== null) {
        const d = data[hoverIndex];
        const text = `${d.category}: ${formatCurrencyShort(d.value)} (${Math.round(d.pct * 100)}%)`;
        ctx.font = "11px -apple-system, Segoe UI, sans-serif";
        const tw = ctx.measureText(text).width + 20;
        const tx = Math.max(4, Math.min(width - tw - 4, cx - tw / 2));
        ctx.fillStyle = "#1E3A8A";
        roundRectPath(ctx, tx, 4, tw, 24, 6);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(text, tx + 10, 16);
      }
    }

    function resize(w, h) {
      width = w; height = h;
      if (width === 0 || height === 0) return;
      dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    canvas.addEventListener("mousemove", (e) => {
      if (!data.length) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const cx = width / 2, cy = height / 2 - 6;
      const outerR = Math.min(width, height) / 2 - 10;
      const innerR = outerR * 0.6;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < innerR || dist > outerR + 6) { if (hoverIndex !== null) { hoverIndex = null; draw(); } return; }

      let angle = Math.atan2(y - cy, x - cx) + Math.PI / 2;
      if (angle < 0) angle += Math.PI * 2;
      let acc = 0, idx = null;
      for (let i = 0; i < data.length; i++) {
        const sliceAngle = (data[i].value / total) * Math.PI * 2;
        if (angle >= acc && angle < acc + sliceAngle) { idx = i; break; }
        acc += sliceAngle;
      }
      if (idx !== hoverIndex) { hoverIndex = idx; draw(); }
    });
    canvas.addEventListener("mouseleave", () => { if (hoverIndex !== null) { hoverIndex = null; draw(); } });

    if (window.ResizeObserver) {
      new ResizeObserver((entries) => { const r = entries[0].contentRect; resize(r.width, r.height); }).observe(canvas.parentElement);
    } else {
      window.addEventListener("resize", () => { const r = canvas.parentElement.getBoundingClientRect(); resize(r.width, r.height); });
      const r = canvas.parentElement.getBoundingClientRect();
      resize(r.width, r.height);
    }

    return { update(newData) { data = newData; total = newData.reduce((a, b) => a + b.value, 0); draw(); } };
  }

  function renderCategoryLegend(categories) {
    $("#categoryLegend").innerHTML = categories.map((c, i) => `
      <li>
        <span class="category-legend__swatch" style="background:${CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]}"></span>
        <span class="category-legend__name">${escapeHtml(c.category)}</span>
        <span class="category-legend__value">${formatCurrencyShort(c.value)} · ${Math.round(c.pct * 100)}%</span>
      </li>
    `).join("");
  }


  /* -----------------------------------------------------------------------
     RECENT ACTIVITIES — merges dummy business events with the real Login
     audit log, so Module 1 and Module 2 visibly connect.
     --------------------------------------------------------------------- */
  function renderActivities(activities) {
    let auditLog = [];
    try { auditLog = JSON.parse(localStorage.getItem(STORAGE_KEYS.auditLog)) || []; } catch { /* ignore */ }

    const loginItems = auditLog.slice(0, 3).map((entry) => {
      let text, kind;
      if (entry.status === "SUCCESS") { text = `${entry.username} signed in successfully`; kind = "auth"; }
      else if (entry.status === "FAILED") { text = `Failed sign-in attempt for "${entry.username}"`; kind = "warning"; }
      else { text = `Password reset requested for ${entry.username}`; kind = "auth"; }
      return { text, kind, time: new Date(entry.timestamp) };
    });

    const merged = activities.map((a) => ({ text: a.text, kind: a.kind, time: new Date(a.time) }))
      .concat(loginItems)
      .sort((a, b) => b.time - a.time)
      .slice(0, 7);

    $("#activityList").innerHTML = merged.map((item) => `
      <li class="activity-item">
        <span class="activity-item__icon">${ACTIVITY_ICONS[item.kind] || ACTIVITY_ICONS.invoice}</span>
        <div>
          <p class="activity-item__text">${escapeHtml(item.text)}</p>
          <p class="activity-item__time">${formatRelativeTime(item.time)}</p>
        </div>
      </li>
    `).join("");
  }


  /* -----------------------------------------------------------------------
     LOW STOCK MODAL
     --------------------------------------------------------------------- */
  function renderLowStockTable(items) {
    $("#lowStockTableBody").innerHTML = items.map((it) => `
      <tr>
        <td>${escapeHtml(it.name)}</td>
        <td><code>${escapeHtml(it.sku)}</code></td>
        <td>${escapeHtml(it.category)}</td>
        <td class="text-right">${it.currentQty}</td>
        <td class="text-right">${it.reorderLevel}</td>
        <td>${escapeHtml(it.itemType)}</td>
        <td><span class="status-badge ${it.status === "Critical" ? "status-badge--danger" : "status-badge--warning"}">${it.status}</span></td>
      </tr>
    `).join("");
  }


  /* -----------------------------------------------------------------------
     RECENT TRANSACTIONS TABLE — search, filter, sort, paginate, view, export
     --------------------------------------------------------------------- */
  function statusBadgeClass(status) {
    if (status === "Completed") return "status-badge--success";
    if (status === "Pending") return "status-badge--warning";
    return "status-badge--danger";
  }

  function getFilteredSortedTransactions() {
    let rows = snapshot.transactions;
    if (txnFilterStatus !== "all") rows = rows.filter((r) => r.status === txnFilterStatus);
    if (txnSearchTerm) {
      const term = txnSearchTerm.toLowerCase();
      rows = rows.filter((r) =>
        r.id.toLowerCase().includes(term) ||
        r.type.toLowerCase().includes(term) ||
        r.party.toLowerCase().includes(term) ||
        r.status.toLowerCase().includes(term)
      );
    }
    rows = rows.slice().sort((a, b) => {
      const diff = new Date(a.date) - new Date(b.date);
      return txnSortOrder === "desc" ? -diff : diff;
    });
    return rows;
  }

  function renderTxnPagination(totalPages) {
    const container = $("#transactionsPagination");
    container.innerHTML = "";
    if (totalPages <= 1) return;
    const makeBtn = (label, disabled, onClick, active) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "page-btn" + (active ? " is-active" : "");
      btn.textContent = label;
      btn.disabled = !!disabled;
      btn.addEventListener("click", onClick);
      return btn;
    };
    container.appendChild(makeBtn("‹", txnPage === 1, () => { txnPage--; renderTransactions(); }));
    for (let p = 1; p <= totalPages; p++) {
      container.appendChild(makeBtn(String(p), false, () => { txnPage = p; renderTransactions(); }, p === txnPage));
    }
    container.appendChild(makeBtn("›", txnPage === totalPages, () => { txnPage++; renderTransactions(); }));
  }

  function renderTransactions() {
    const all = getFilteredSortedTransactions();
    const totalPages = Math.max(1, Math.ceil(all.length / TXN_PAGE_SIZE));
    txnPage = Math.min(txnPage, totalPages);
    const start = (txnPage - 1) * TXN_PAGE_SIZE;
    const pageItems = all.slice(start, start + TXN_PAGE_SIZE);

    $("#transactionsEmptyState").hidden = all.length !== 0;
    $("#transactionsTable").hidden = all.length === 0;

    $("#transactionsTableBody").innerHTML = pageItems.map((r) => `
      <tr>
        <td><code>${escapeHtml(r.id)}</code></td>
        <td>${escapeHtml(r.type)}</td>
        <td>${escapeHtml(r.party)}</td>
        <td class="text-right amount-cell">${formatCurrency(r.amount)}</td>
        <td><span class="status-badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span></td>
        <td>${formatDateTime(new Date(r.date))}</td>
        <td><button type="button" class="row-detail-btn" data-txn-id="${r.id}">View</button></td>
      </tr>
    `).join("");

    renderTxnPagination(totalPages);
  }

  function exportTransactionsCsv() {
    const rows = getFilteredSortedTransactions();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Txn ID", "Type", "Party", "Amount", "Status", "Date"];
    const csvRows = [header.join(",")];
    rows.forEach((r) => {
      const line = [r.id, r.type, r.party, r.amount, r.status, formatDateTime(new Date(r.date))]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "erp-recent-transactions.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Transactions exported as CSV.", "success", { title: "Export complete" });
  }

  function printTransactions() {
    const rows = getFilteredSortedTransactions();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((r) => `
      <tr><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.type)}</td><td>${escapeHtml(r.party)}</td><td>${formatCurrency(r.amount)}</td><td>${escapeHtml(r.status)}</td><td>${formatDateTime(new Date(r.date))}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - Recent Transactions</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>Dot ERP — Recent Transactions</h1>
        <p>Generated ${formatDateTime(new Date())} · ${rows.length} record(s) · Training simulation export</p>
        <table><thead><tr><th>Txn ID</th><th>Type</th><th>Party</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast("Opened the print dialog.", "info", { title: "Print" });
  }

  function bindTransactionsUi() {
    $$("#txnFilterChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#txnFilterChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        txnFilterStatus = chip.dataset.status;
        txnPage = 1;
        renderTransactions();
      });
    });

    $("#txnSortBtn").addEventListener("click", () => {
      txnSortOrder = txnSortOrder === "desc" ? "asc" : "desc";
      $("#txnSortBtn").textContent = txnSortOrder === "desc" ? "Newest first" : "Oldest first";
      txnPage = 1;
      renderTransactions();
    });

    $("#transactionsTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-txn-id]");
      if (!btn) return;
      const row = snapshot.transactions.find((r) => r.id === btn.dataset.txnId);
      if (!row) return;
      $("#txnDetailBody").innerHTML = `
        <div><dt>Txn ID</dt><dd>${escapeHtml(row.id)}</dd></div>
        <div><dt>Type</dt><dd>${escapeHtml(row.type)}</dd></div>
        <div><dt>Party</dt><dd>${escapeHtml(row.party)}</dd></div>
        <div><dt>Amount</dt><dd>${formatCurrency(row.amount)}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(row.status)}</dd></div>
        <div><dt>Date</dt><dd>${formatDateTime(new Date(row.date))}</dd></div>
      `;
      openModal("txnDetailModal");
    });

    $("#topbarSearchInput").addEventListener("input", (e) => {
      txnSearchTerm = e.target.value;
      txnPage = 1;
      renderTransactions();
    });

    $("#txnExportCsvBtn").addEventListener("click", exportTransactionsCsv);
    $("#txnPrintBtn").addEventListener("click", printTransactions);
  }


  /* -----------------------------------------------------------------------
     QUICK ACTIONS
     --------------------------------------------------------------------- */
  function exportSummary() {
    const k = snapshot.kpis;
    const rows = [
      ["Metric", "Value"],
      ["Today's Sales", formatCurrency(k.todaysSales)],
      ["Today's Purchases", formatCurrency(k.todaysPurchases)],
      ["Inventory Value", formatCurrency(k.inventoryValue)],
      ["Low Stock Items", String(k.lowStockCount)]
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "erp-dashboard-summary.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Dashboard summary exported as CSV.", "success");
  }

  function refreshDashboard() {
    snapshot = window.ERP_DashboardData.getSnapshot(true);
    txnFilterStatus = "all";
    txnSearchTerm = "";
    txnPage = 1;
    $$("#txnFilterChips .chip").forEach((c) => c.classList.toggle("is-active", c.dataset.status === "all"));
    $("#topbarSearchInput").value = "";
    renderAll();
    showToast("Dashboard data refreshed.", "success");
  }


  /* -----------------------------------------------------------------------
     ORCHESTRATION
     --------------------------------------------------------------------- */
  function renderAll() {
    renderKpis(snapshot.kpis);
    barChartCtrl.update(snapshot.series);
    donutChartCtrl.update(snapshot.categorySplit);
    renderCategoryLegend(snapshot.categorySplit);
    renderActivities(snapshot.activities);
    renderTransactions();
    renderSnapshotInfo(snapshot.snapshotInfo);
    $("#dashboardDateLabel").textContent = "Live snapshot generated " + formatDateTime(new Date(snapshot.generatedAt)) + " · figures reflect this company's actual records";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const session = requireSession("../index.html");
    if (!session) return; // requireSession already redirected
    if (!window.ERP.enforcePageAccess(session, "dashboard")) return;

    runBootSequence([
      { p: 30, t: "Authenticating session…" },
      { p: 60, t: "Loading company workspace…" },
      { p: 85, t: "Fetching dashboard metrics…" },
      { p: 100, t: "Ready." }
    ]);

    company = ERP_CompanyRepository.getActive();

    // PHASE 8: the automatic half of the snapshot mechanism — a no-op if
    // today's own row already exists (see ensureTodaySnapshot()'s own
    // header for why an ordinary reload should never overwrite it).
    if (company && typeof ERP_SnapshotRepository !== "undefined") {
      ERP_SnapshotRepository.ensureTodaySnapshot(company, session.username);
    }

    snapshot = window.ERP_DashboardData.getSnapshot();

    barChartCtrl = setupBarChart($("#salesPurchaseChart"));
    donutChartCtrl = setupDonutChart($("#categoryChart"));

    renderAll();
    bindTransactionsUi();

    // Module 8: if the user flips the topbar theme toggle without leaving
    // this page, redraw the canvas charts so their label colors keep up
    // (CSS repaints everything else automatically; canvas text does not).
    window.addEventListener("erp:theme-changed", () => {
      if (!snapshot) return;
      barChartCtrl.update(snapshot.series);
      donutChartCtrl.update(snapshot.categorySplit);
    });

    $("#kpiLowStockCard").addEventListener("click", () => {
      renderLowStockTable(snapshot.lowStockItems);
      openModal("lowStockModal");
    });

    // PHASE 8: the explicit half of the snapshot mechanism — an honest,
    // clearly-labeled manual override (see data/snapshot-data.js's own
    // header for why a training simulator needs this in addition to the
    // automatic once-per-day capture).
    $("#captureSnapshotBtn").addEventListener("click", () => {
      if (!company) { showToast("No active company to snapshot.", "warning"); return; }
      ERP_SnapshotRepository.captureSnapshot(company, session.username, true);
      snapshot = window.ERP_DashboardData.getSnapshot();
      renderAll();
      showToast("Today's snapshot captured.", "success");
    });

    $("#refreshDashboardBtn").addEventListener("click", refreshDashboard);
    $("#refreshDashboardBtn2").addEventListener("click", refreshDashboard);
    $("#exportSummaryBtn").addEventListener("click", exportSummary);

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
