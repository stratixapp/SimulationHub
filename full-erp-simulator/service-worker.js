/* =============================================================================
   DOT ERP — service-worker.js
   Makes the app installable and usable offline. There is no server behind
   this app (see data/*.js — everything lives in this browser's own
   localStorage), so this file has exactly one job: cache the APP SHELL
   itself (every HTML/CSS/JS/icon file below) so a repeat visit, or a visit
   with no network at all, still loads the full interface. It never touches
   business data — that already lives in localStorage independently of
   whatever this cache holds, and a Factory Reset (Settings → Data & Privacy)
   does not need to touch this cache either.

   VERSIONING: bump CACHE_VERSION any time a shipped file changes. That
   name change is what makes install() below populate a fresh cache instead
   of reusing a stale one, and activate() then deletes the old cache once
   the new one is ready. Forgetting to bump it means people keep the old
   files until they clear site data by hand.

   STRATEGY: network-first for every same-origin GET. Try the network so a
   signed-in user always gets the latest shipped code when they're online;
   fall back to this cache the moment the network fails (offline, or the
   dev server isn't running), and fall back to the cached app shell
   (index.html) for a navigation that matches neither — so opening the app
   offline still lands on a working screen instead of the browser's own
   offline error page.
   ========================================================================== */
"use strict";

const CACHE_VERSION = "2026-09-26.1";
const CACHE_NAME = "dot-erp-" + CACHE_VERSION;

const PRECACHE_URLS = [
  "./",
  "assets/auth.css",
  "assets/auth.js",
  "assets/vendor/jspdf.umd.min.js",
  "data/ap-aging-data.js",
  "data/ar-aging-data.js",
  "data/asset-data.js",
  "data/asset-disposal-data.js",
  "data/attendance-data.js",
  "data/balance-sheet-data.js",
  "data/bank-data.js",
  "data/bank-reconciliation-data.js",
  "data/bom-data.js",
  "data/branch-data.js",
  "data/budget-data.js",
  "data/category-data.js",
  "data/chart-of-accounts-data.js",
  "data/company-data.js",
  "data/company-settings-data.js",
  "data/contract-data.js",
  "data/cost-center-data.js",
  "data/credit-note-data.js",
  "data/currency-data.js",
  "data/customer-data.js",
  "data/customer-inquiry-data.js",
  "data/dashboard-data.js",
  "data/debit-note-data.js",
  "data/delivery-challan-data.js",
  "data/delivery-schedule-data.js",
  "data/department-data.js",
  "data/department-need-data.js",
  "data/depreciation-run-data.js",
  "data/dispatch-data.js",
  "data/e-invoice-data.js",
  "data/e-way-bill-data.js",
  "data/employee-data.js",
  "data/financial-year-data.js",
  "data/finished-goods-receipt-data.js",
  "data/general-ledger-data.js",
  "data/gl-mapping-data.js",
  "data/gl-posting-data.js",
  "data/goods-receipt-data.js",
  "data/grn-data.js",
  "data/gst-data.js",
  "data/gst-summary-data.js",
  "data/gstr1-data.js",
  "data/gstr3b-data.js",
  "data/help-data.js",
  "data/hsn-data.js",
  "data/inventory-valuation-data.js",
  "data/invoice-verification-data.js",
  "data/item-data.js",
  "data/journal-entry-data.js",
  "data/lead-data.js",
  "data/leave-data.js",
  "data/low-stock-data.js",
  "data/material-issue-data.js",
  "data/opening-stock-data.js",
  "data/payment-collection-data.js",
  "data/payment-request-data.js",
  "data/payment-terms-data.js",
  "data/payroll-data.js",
  "data/po-data.js",
  "data/pr-data.js",
  "data/profit-and-loss-data.js",
  "data/project-data.js",
  "data/purchase-closure-data.js",
  "data/purchase-register-data.js",
  "data/purchase-return-data.js",
  "data/quality-inspection-data.js",
  "data/quotation-data.js",
  "data/rbac-data.js",
  "data/receipt-data.js",
  "data/rfq-data.js",
  "data/salary-structure-data.js",
  "data/sales-close-data.js",
  "data/sales-order-data.js",
  "data/sales-quotation-data.js",
  "data/sales-register-data.js",
  "data/sales-return-data.js",
  "data/snapshot-data.js",
  "data/stock-adjustment-data.js",
  "data/stock-ledger-data.js",
  "data/stock-posting-data.js",
  "data/stock-transfer-data.js",
  "data/stock-valuation-data.js",
  "data/support-ticket-data.js",
  "data/tax-data.js",
  "data/tax-invoice-data.js",
  "data/three-way-matching-data.js",
  "data/time-tracking-data.js",
  "data/trial-balance-data.js",
  "data/unit-data.js",
  "data/users.js",
  "data/vendor-data.js",
  "data/vendor-evaluation-data.js",
  "data/vendor-payment-data.js",
  "data/warehouse-data.js",
  "data/work-order-data.js",
  "favicon.ico",
  "icons/apple-touch-icon.png",
  "icons/favicon-16.png",
  "icons/favicon-32.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.json",
  "pages/activity-log.html",
  "pages/activity-log.js",
  "pages/ap-aging.html",
  "pages/ap-aging.js",
  "pages/ar-aging.html",
  "pages/ar-aging.js",
  "pages/asset-disposal.html",
  "pages/asset-disposal.js",
  "pages/asset-register.html",
  "pages/asset-register.js",
  "pages/attendance.html",
  "pages/attendance.js",
  "pages/balance-sheet.html",
  "pages/balance-sheet.js",
  "pages/bank-master.html",
  "pages/bank-master.js",
  "pages/bank-reconciliation.html",
  "pages/bank-reconciliation.js",
  "pages/bill-of-materials.html",
  "pages/bill-of-materials.js",
  "pages/branches.html",
  "pages/branches.js",
  "pages/budget-master.html",
  "pages/budget-master.js",
  "pages/budget-vs-actual.html",
  "pages/budget-vs-actual.js",
  "pages/categories.html",
  "pages/categories.js",
  "pages/chart-of-accounts.html",
  "pages/chart-of-accounts.js",
  "pages/company-profile.html",
  "pages/company-profile.js",
  "pages/company-settings.html",
  "pages/company-settings.js",
  "pages/contracts.html",
  "pages/contracts.js",
  "pages/cost-centers.html",
  "pages/cost-centers.js",
  "pages/create-company.html",
  "pages/create-company.js",
  "pages/credit-note.html",
  "pages/credit-note.js",
  "pages/currency.html",
  "pages/currency.js",
  "pages/customer-inquiry.html",
  "pages/customer-inquiry.js",
  "pages/customers.html",
  "pages/customers.js",
  "pages/dashboard.html",
  "pages/dashboard.js",
  "pages/debit-note.html",
  "pages/debit-note.js",
  "pages/delivery-challan.html",
  "pages/delivery-challan.js",
  "pages/delivery-schedule.html",
  "pages/delivery-schedule.js",
  "pages/department-need.html",
  "pages/department-need.js",
  "pages/departments.html",
  "pages/departments.js",
  "pages/depreciation-run.html",
  "pages/depreciation-run.js",
  "pages/depreciation-schedule.html",
  "pages/depreciation-schedule.js",
  "pages/dispatch.html",
  "pages/dispatch.js",
  "pages/e-invoice.html",
  "pages/e-invoice.js",
  "pages/e-way-bill.html",
  "pages/e-way-bill.js",
  "pages/employees.html",
  "pages/employees.js",
  "pages/financial-year.html",
  "pages/financial-year.js",
  "pages/finished-goods-receipt.html",
  "pages/finished-goods-receipt.js",
  "pages/general-ledger.html",
  "pages/general-ledger.js",
  "pages/goods-receipt.html",
  "pages/goods-receipt.js",
  "pages/grn.html",
  "pages/grn.js",
  "pages/gst-details.html",
  "pages/gst-details.js",
  "pages/gst-summary.html",
  "pages/gst-summary.js",
  "pages/gstr1.html",
  "pages/gstr1.js",
  "pages/gstr3b.html",
  "pages/gstr3b.js",
  "pages/help.html",
  "pages/help.js",
  "pages/hsn-master.html",
  "pages/hsn-master.js",
  "pages/inventory-valuation.html",
  "pages/inventory-valuation.js",
  "pages/invoice-verification.html",
  "pages/invoice-verification.js",
  "pages/items.html",
  "pages/items.js",
  "pages/journal-entry.html",
  "pages/journal-entry.js",
  "pages/lead-pipeline.html",
  "pages/lead-pipeline.js",
  "pages/leave.html",
  "pages/leave.js",
  "pages/low-stock.html",
  "pages/low-stock.js",
  "pages/material-issue.html",
  "pages/material-issue.js",
  "pages/notifications.html",
  "pages/notifications.js",
  "pages/opening-stock.html",
  "pages/opening-stock.js",
  "pages/order-approval.html",
  "pages/order-approval.js",
  "pages/payment-collection.html",
  "pages/payment-collection.js",
  "pages/payment-request.html",
  "pages/payment-request.js",
  "pages/payment-terms.html",
  "pages/payment-terms.js",
  "pages/payroll.html",
  "pages/payroll.js",
  "pages/po-approval.html",
  "pages/po-approval.js",
  "pages/posting-rules.html",
  "pages/posting-rules.js",
  "pages/pr-approval.html",
  "pages/pr-approval.js",
  "pages/profile.html",
  "pages/profile.js",
  "pages/profit-and-loss.html",
  "pages/profit-and-loss.js",
  "pages/project.html",
  "pages/project.js",
  "pages/purchase-closure.html",
  "pages/purchase-closure.js",
  "pages/purchase-order.html",
  "pages/purchase-order.js",
  "pages/purchase-register.html",
  "pages/purchase-register.js",
  "pages/purchase-requisition.html",
  "pages/purchase-requisition.js",
  "pages/purchase-return.html",
  "pages/purchase-return.js",
  "pages/quality-inspection.html",
  "pages/quality-inspection.js",
  "pages/quotation-comparison.html",
  "pages/quotation-comparison.js",
  "pages/quotation-receipt.html",
  "pages/quotation-receipt.js",
  "pages/receipt.html",
  "pages/receipt.js",
  "pages/rfq-creation.html",
  "pages/rfq-creation.js",
  "pages/salary-structure.html",
  "pages/salary-structure.js",
  "pages/sales-close.html",
  "pages/sales-close.js",
  "pages/sales-order.html",
  "pages/sales-order.js",
  "pages/sales-quotation.html",
  "pages/sales-quotation.js",
  "pages/sales-register.html",
  "pages/sales-register.js",
  "pages/sales-return.html",
  "pages/sales-return.js",
  "pages/settings.html",
  "pages/settings.js",
  "pages/stock-adjustment.html",
  "pages/stock-adjustment.js",
  "pages/stock-ledger.html",
  "pages/stock-ledger.js",
  "pages/stock-transfer.html",
  "pages/stock-transfer.js",
  "pages/stock-valuation.html",
  "pages/stock-valuation.js",
  "pages/support-tickets.html",
  "pages/support-tickets.js",
  "pages/tax-invoice.html",
  "pages/tax-invoice.js",
  "pages/tax-master.html",
  "pages/tax-master.js",
  "pages/theme.html",
  "pages/theme.js",
  "pages/three-way-matching.html",
  "pages/three-way-matching.js",
  "pages/time-tracking.html",
  "pages/time-tracking.js",
  "pages/trial-balance.html",
  "pages/trial-balance.js",
  "pages/units.html",
  "pages/units.js",
  "pages/user-role-management.html",
  "pages/user-role-management.js",
  "pages/vendor-confirmation.html",
  "pages/vendor-confirmation.js",
  "pages/vendor-evaluation.html",
  "pages/vendor-evaluation.js",
  "pages/vendor-payment.html",
  "pages/vendor-payment.js",
  "pages/vendor-selection.html",
  "pages/vendor-selection.js",
  "pages/vendors.html",
  "pages/vendors.js",
  "pages/warehouses.html",
  "pages/warehouses.js",
  "pages/work-order.html",
  "pages/work-order.js",
  "script.js",
  "style.css"
];

self.addEventListener("install", (event) => {
  // Deliberately does NOT call self.skipWaiting() here. A new worker installs and then
  // WAITS behind whichever one is already controlling open tabs — that's what lets
  // assets/pwa.js show "a new version is ready" and only take over once the person
  // clicks Reload, instead of code swapping under an open, in-progress session.
  // skipWaiting() only ever runs in response to that click (see the "message" handler
  // below), or on its own once every tab has actually been closed and reopened, which
  // is the browser's own normal replacement point for an unclaimed waiting worker.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// A page can ask a waiting worker to take over right away (see assets/pwa.js's
// update banner) instead of waiting for every tab to close on its own.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                       // never cache a mutating request (there are none here, but be safe)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;         // this app has no cross-origin requests at all; ignore anything that isn't ours

  event.respondWith(networkFirstThenCache(req));
});

async function networkFirstThenCache(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (networkError) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") {                    // offline + never-cached page -> the app shell, not a browser error page
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    throw networkError;
  }
}
