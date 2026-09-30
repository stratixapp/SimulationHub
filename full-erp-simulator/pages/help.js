/* =============================================================================
   DOT ERP — pages/help.js
   Module 09: Help Center

   Uses window.ERP (shared runtime) and ERP_HELP_FAQS / ERP_HELP_QUICK_LINKS
   (static reference content from ../data/help-data.js).
   ========================================================================== */

(function () {
  "use strict";

  const {
    $, $$, generateId, formatDateTime, escapeHtml,
    showToast, openModal, closeModal, openConfirm, requireSession, runBootSequence,
    logSystemActivity
  } = window.ERP;

  const FAQ_VOTES_KEY = "erp_help_faq_votes";
  const TICKETS_KEY = "erp_support_tickets";
  const FAQ_PAGE_SIZE = 8;
  const TICKET_PAGE_SIZE = 5;

  const CATEGORY_LABEL = {
    "getting-started": "Getting Started",
    "account-security": "Account & Security",
    "data-privacy": "Data & Privacy",
    "modules-guide": "Modules Guide",
    "troubleshooting": "Troubleshooting"
  };

  let session = null;

  let faqCategory = "all";
  let faqSearch = "";
  let faqSort = "category"; // "category" | "helpful"
  let faqPage = 1;
  const expandedFaqIds = new Set();

  let ticketSortOrder = "desc";
  let ticketPage = 1;


  /* -----------------------------------------------------------------------
     QUICK LINKS (static)
     --------------------------------------------------------------------- */
  function renderQuickLinks() {
    $("#quickLinksGrid").innerHTML = ERP_HELP_QUICK_LINKS.map((link) => `
      <a class="help-quicklink" href="${link.href}">
        <span class="help-quicklink__title">${escapeHtml(link.title)}</span>
        <span class="help-quicklink__desc">${escapeHtml(link.desc)}</span>
      </a>
    `).join("");
  }


  /* -----------------------------------------------------------------------
     FAQ VOTES (seed count + this browser's own vote, layered like the
     profile-overrides pattern in data/users.js)
     --------------------------------------------------------------------- */
  function getFaqVotes() {
    try { return JSON.parse(localStorage.getItem(FAQ_VOTES_KEY)) || {}; } catch { return {}; }
  }
  function setFaqVote(faqId, vote) {
    const votes = getFaqVotes();
    if (votes[faqId] === vote) delete votes[faqId]; // clicking the same choice again un-votes
    else votes[faqId] = vote;
    localStorage.setItem(FAQ_VOTES_KEY, JSON.stringify(votes));
  }
  function getEffectiveCounts(faq) {
    const vote = getFaqVotes()[faq.id];
    return {
      yes: faq.helpfulYes + (vote === "yes" ? 1 : 0),
      no: faq.helpfulNo + (vote === "no" ? 1 : 0),
      myVote: vote || null
    };
  }


  /* -----------------------------------------------------------------------
     FAQ ACCORDION
     --------------------------------------------------------------------- */
  function getFilteredSortedFaqs() {
    let rows = ERP_HELP_FAQS.slice();
    if (faqCategory !== "all") rows = rows.filter((f) => f.category === faqCategory);
    if (faqSearch) {
      const term = faqSearch.toLowerCase();
      rows = rows.filter((f) => f.question.toLowerCase().includes(term) || f.answer.toLowerCase().includes(term));
    }
    if (faqSort === "helpful") {
      rows.sort((a, b) => {
        const ca = getEffectiveCounts(a), cb = getEffectiveCounts(b);
        return (cb.yes - cb.no) - (ca.yes - ca.no);
      });
    }
    return rows;
  }

  function renderFaqPagination(totalPages) {
    const container = $("#faqPagination");
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
    container.appendChild(makeBtn("‹", faqPage === 1, () => { faqPage--; renderFaq(); }));
    for (let p = 1; p <= totalPages; p++) {
      container.appendChild(makeBtn(String(p), false, () => { faqPage = p; renderFaq(); }, p === faqPage));
    }
    container.appendChild(makeBtn("›", faqPage === totalPages, () => { faqPage++; renderFaq(); }));
  }

  function renderFaq() {
    const all = getFilteredSortedFaqs();
    const totalPages = Math.max(1, Math.ceil(all.length / FAQ_PAGE_SIZE));
    faqPage = Math.min(faqPage, totalPages);
    const start = (faqPage - 1) * FAQ_PAGE_SIZE;
    const pageItems = all.slice(start, start + FAQ_PAGE_SIZE);

    $("#faqEmptyState").hidden = all.length !== 0;
    $("#faqAccordion").hidden = all.length === 0;

    $("#faqAccordion").innerHTML = pageItems.map((faq) => {
      const counts = getEffectiveCounts(faq);
      const isOpen = expandedFaqIds.has(faq.id);
      return `
      <div class="faq-item ${isOpen ? "is-open" : ""}" data-id="${faq.id}">
        <button type="button" class="faq-item__question" data-action="toggle" data-id="${faq.id}" aria-expanded="${isOpen}">
          <span>${escapeHtml(faq.question)}</span>
          <span class="status-badge status-badge--info faq-item__category">${CATEGORY_LABEL[faq.category] || faq.category}</span>
          <svg class="faq-item__chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="faq-item__answer">
          <p>${escapeHtml(faq.answer)}</p>
          <div class="faq-item__helpful">
            <span>Was this helpful?</span>
            <button type="button" class="chip ${counts.myVote === "yes" ? "is-active" : ""}" data-action="vote" data-vote="yes" data-id="${faq.id}">Yes (${counts.yes})</button>
            <button type="button" class="chip ${counts.myVote === "no" ? "is-active" : ""}" data-action="vote" data-vote="no" data-id="${faq.id}">No (${counts.no})</button>
          </div>
        </div>
      </div>`;
    }).join("");

    renderFaqPagination(totalPages);
  }

  function bindFaqUi() {
    $$("#faqCategoryChips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $$("#faqCategoryChips .chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        faqCategory = chip.dataset.category;
        faqPage = 1;
        renderFaq();
      });
    });

    $("#faqSearchInput").addEventListener("input", (e) => {
      faqSearch = e.target.value;
      faqPage = 1;
      renderFaq();
    });

    $("#faqSortBtn").addEventListener("click", () => {
      faqSort = faqSort === "category" ? "helpful" : "category";
      $("#faqSortBtn").textContent = faqSort === "helpful" ? "Category order" : "Most helpful first";
      faqPage = 1;
      renderFaq();
    });

    $("#faqAccordion").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;

      if (btn.dataset.action === "toggle") {
        if (expandedFaqIds.has(id)) expandedFaqIds.delete(id); else expandedFaqIds.add(id);
        renderFaq();
      } else if (btn.dataset.action === "vote") {
        setFaqVote(id, btn.dataset.vote);
        renderFaq();
      }
    });
  }


  /* -----------------------------------------------------------------------
     SUPPORT TICKETS
     --------------------------------------------------------------------- */
  function getAllTickets() {
    try { return JSON.parse(localStorage.getItem(TICKETS_KEY)) || []; } catch { return []; }
  }
  function saveAllTickets(list) { localStorage.setItem(TICKETS_KEY, JSON.stringify(list)); }
  function getMyTickets() {
    return getAllTickets()
      .filter((t) => t.username.toLowerCase() === session.username.toLowerCase())
      .sort((a, b) => {
        const diff = new Date(a.createdAt) - new Date(b.createdAt);
        return ticketSortOrder === "desc" ? -diff : diff;
      });
  }

  function setFieldError(field, msg) { const el = $("#" + field + "Error"); if (el) el.textContent = msg; }
  function clearTicketErrors() { setFieldError("ticketSubject", ""); setFieldError("ticketDescription", ""); }

  function validateTicketForm() {
    let valid = true;
    const subject = $("#ticketSubject").value.trim();
    const description = $("#ticketDescription").value.trim();
    clearTicketErrors();

    if (!subject) { setFieldError("ticketSubject", "Subject is required."); valid = false; }
    else if (subject.length > 100) { setFieldError("ticketSubject", "Maximum 100 characters allowed."); valid = false; }

    if (!description) { setFieldError("ticketDescription", "Description is required."); valid = false; }
    else if (description.length > 500) { setFieldError("ticketDescription", "Maximum 500 characters allowed."); valid = false; }

    if (subject && description) {
      const clash = getMyTickets().some((t) => t.subject.trim().toLowerCase() === subject.toLowerCase() && t.status === "Open");
      if (clash) { setFieldError("ticketSubject", "You already have an open ticket with this exact subject."); valid = false; }
    }

    return valid;
  }

  function renderTicketsPagination(totalPages) {
    const container = $("#ticketsPagination");
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
    container.appendChild(makeBtn("‹", ticketPage === 1, () => { ticketPage--; renderTickets(); }));
    for (let p = 1; p <= totalPages; p++) {
      container.appendChild(makeBtn(String(p), false, () => { ticketPage = p; renderTickets(); }, p === ticketPage));
    }
    container.appendChild(makeBtn("›", ticketPage === totalPages, () => { ticketPage++; renderTickets(); }));
  }

  function renderTickets() {
    const all = getMyTickets();
    const totalPages = Math.max(1, Math.ceil(all.length / TICKET_PAGE_SIZE));
    ticketPage = Math.min(ticketPage, totalPages);
    const start = (ticketPage - 1) * TICKET_PAGE_SIZE;
    const pageItems = all.slice(start, start + TICKET_PAGE_SIZE);

    $("#ticketsEmptyState").hidden = all.length !== 0;
    $("#ticketsTable").hidden = all.length === 0;

    $("#ticketsTableBody").innerHTML = pageItems.map((t) => `
      <tr>
        <td><code>${escapeHtml(t.id)}</code></td>
        <td>${escapeHtml(t.subject)}</td>
        <td>${escapeHtml(t.category)}</td>
        <td><span class="status-badge status-badge--info">${escapeHtml(t.status)}</span></td>
        <td>${formatDateTime(new Date(t.createdAt))}</td>
        <td><button type="button" class="row-detail-btn" data-id="${t.id}">View</button></td>
      </tr>
    `).join("");

    renderTicketsPagination(totalPages);
  }

  function exportTicketsCsv() {
    const rows = getMyTickets();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const header = ["Ticket ID", "Subject", "Category", "Description", "Status", "Submitted"];
    const csvRows = [header.join(",")];
    rows.forEach((t) => {
      const line = [t.id, t.subject, t.category, t.description, t.status, formatDateTime(new Date(t.createdAt))]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      csvRows.push(line);
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "erp-my-support-tickets.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast("Tickets exported as CSV.", "success", { title: "Export complete" });
  }

  function printTickets() {
    const rows = getMyTickets();
    if (!rows.length) { showToast("Nothing to print yet.", "warning"); return; }
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { showToast("Pop-up blocked. Allow pop-ups to print.", "warning"); return; }
    const tableRows = rows.map((t) => `
      <tr><td>${escapeHtml(t.id)}</td><td>${escapeHtml(t.subject)}</td><td>${escapeHtml(t.category)}</td><td>${escapeHtml(t.status)}</td><td>${formatDateTime(new Date(t.createdAt))}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Dot ERP - My Support Tickets</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#0F172A;}
        h1{font-size:18px;margin:0 0 2px;} p{color:#64748B;font-size:12px;margin:0 0 20px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th,td{border:1px solid #E2E8F0;padding:6px 8px;text-align:left;}
        th{background:#F1F5F9;text-transform:uppercase;font-size:10px;color:#334155;}
      </style></head>
      <body>
        <h1>Dot ERP — My Support Tickets</h1>
        <p>Generated ${formatDateTime(new Date())} · ${rows.length} record(s)</p>
        <table><thead><tr><th>Ticket ID</th><th>Subject</th><th>Category</th><th>Status</th><th>Submitted</th></tr></thead>
        <tbody>${tableRows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    showToast("Opened the print dialog.", "info", { title: "Print" });
  }

  function bindTicketForm() {
    $("#ticketForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validateTicketForm()) return;

      openConfirm({
        title: "Submit this ticket?",
        message: "This saves the ticket locally on this device — remember, it isn't actually sent anywhere.",
        confirmLabel: "Submit ticket",
        onConfirm: () => {
          const ticket = {
            id: generateId("TCK"),
            username: session.username,
            subject: $("#ticketSubject").value.trim(),
            category: $("#ticketCategory").value,
            description: $("#ticketDescription").value.trim(),
            status: "Open",
            createdAt: new Date().toISOString()
          };
          const all = getAllTickets();
          all.unshift(ticket);
          saveAllTickets(all);
          logSystemActivity({ module: "Help Center", action: "Create", description: `Submitted support ticket "${ticket.subject}"` });

          $("#ticketForm").reset();
          clearTicketErrors();
          ticketPage = 1;
          renderTickets();
          showToast("Ticket submitted — see it under My Tickets below.", "success");
        }
      });
    });

    $("#resetTicketFormBtn").addEventListener("click", () => {
      $("#ticketForm").reset();
      clearTicketErrors();
      showToast("Form cleared.", "info");
    });

    $("#ticketsSortBtn").addEventListener("click", () => {
      ticketSortOrder = ticketSortOrder === "desc" ? "asc" : "desc";
      $("#ticketsSortBtn").textContent = ticketSortOrder === "desc" ? "Newest first" : "Oldest first";
      ticketPage = 1;
      renderTickets();
    });

    $("#ticketsExportCsvBtn").addEventListener("click", exportTicketsCsv);
    $("#ticketsPrintBtn").addEventListener("click", printTickets);

    let detailTicketId = null;
    $("#ticketsTableBody").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-id]");
      if (!btn) return;
      const ticket = getAllTickets().find((t) => t.id === btn.dataset.id);
      if (!ticket) return;
      detailTicketId = ticket.id;
      $("#ticketDetailBody").innerHTML = `
        <div><dt>Ticket ID</dt><dd>${escapeHtml(ticket.id)}</dd></div>
        <div><dt>Subject</dt><dd>${escapeHtml(ticket.subject)}</dd></div>
        <div><dt>Category</dt><dd>${escapeHtml(ticket.category)}</dd></div>
        <div><dt>Description</dt><dd>${escapeHtml(ticket.description)}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(ticket.status)}</dd></div>
        <div><dt>Submitted</dt><dd>${formatDateTime(new Date(ticket.createdAt))}</dd></div>
      `;
      openModal("ticketDetailModal");
    });

    $("#withdrawTicketBtn").addEventListener("click", () => {
      if (!detailTicketId) return;
      const id = detailTicketId;
      closeModal("ticketDetailModal");
      openConfirm({
        title: "Withdraw this ticket?",
        message: "This removes the ticket from your list. This cannot be undone.",
        confirmLabel: "Withdraw ticket",
        onConfirm: () => {
          const remaining = getAllTickets().filter((t) => t.id !== id);
          saveAllTickets(remaining);
          logSystemActivity({ module: "Help Center", action: "Delete", description: `Withdrew support ticket ${id}` });
          renderTickets();
          showToast("Ticket withdrawn.", "info");
        }
      });
    });
  }


  /* -----------------------------------------------------------------------
     INIT
     --------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "help")) return;

    runBootSequence([
      { p: 35, t: "Authenticating session…" },
      { p: 70, t: "Loading the knowledge base…" },
      { p: 100, t: "Ready." }
    ]);

    renderQuickLinks();
    renderFaq();
    bindFaqUi();
    renderTickets();
    bindTicketForm();

    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
