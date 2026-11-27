/* ==========================================================================
   correspondence.js — My Correspondence: Inbox / Outbox / Archived / Drafts
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

  // Lazy-seed correspondence for accounts created before this module existed.
  if (!VATSIM.getMessages().length) {
    VATSIM.generateInitialMessages(account, VATSIM.getFilings());
  }

  const params = new URLSearchParams(window.location.search);
  const deepLinkId = params.get("id");

  let activeFolder = "inbox";
  let activeId = null;

  function refreshUnreadBadge() {
    const n = VATSIM.unreadMessageCount();
    document.getElementById("unreadBadge").textContent = n ? n + " unread" : "";
  }

  function renderList() {
    const search = document.getElementById("msgSearch").value.trim().toLowerCase();
    const cat = document.getElementById("catFilter").value;
    let list = VATSIM.getMessages().filter((m) => m.folder === activeFolder);
    if (search) list = list.filter((m) => m.subject.toLowerCase().includes(search) || m.category.toLowerCase().includes(search));
    if (cat) list = list.filter((m) => m.category === cat);
    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    const box = document.getElementById("msgList");
    box.innerHTML = "";
    if (!list.length) {
      box.innerHTML = '<div class="msg-empty">No messages in this folder.</div>';
    }
    list.forEach((m) => {
      const row = document.createElement("a");
      row.href = "#";
      row.className = "msg-row" + (!m.read && activeFolder === "inbox" ? " unread" : "") + (m.id === activeId ? " active" : "");
      row.innerHTML =
        '<div class="top-line"><span>' + (activeFolder === "outbox" ? "To: " + m.to : "From: " + m.from) + "</span><span>" + VATSIM.fmtDate(m.date) + "</span></div>" +
        '<div class="subject">' + m.subject + "</div>" +
        '<span class="cat">' + m.category + "</span>";
      row.addEventListener("click", (e) => {
        e.preventDefault();
        openMessage(m.id);
      });
      box.appendChild(row);
    });
    refreshUnreadBadge();
  }

  function openMessage(id) {
    activeId = id;
    const m = VATSIM.getMessages().find((x) => x.id === id);
    if (!m) return;
    if (m.folder === "inbox" && !m.read) {
      VATSIM.markMessageRead(id, true);
    }
    const detail = document.getElementById("msgDetail");
    detail.innerHTML =
      '<div class="subject">' + m.subject + "</div>" +
      '<div class="meta">' +
      (m.folder === "outbox" ? "To " + m.to : "From " + m.from) +
      " · " + VATSIM.fmtDate(m.date) + " · " + m.category +
      (m.relatedFilingId ? " · Related filing: " + m.relatedFilingId : "") +
      "</div>" +
      '<div class="body"></div>' +
      '<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">' +
      (m.folder !== "archived" ? '<button class="btn btn-outline btn-sm" id="btnArchive">🗄 Archive</button>' : '<button class="btn btn-outline btn-sm" id="btnUnarchive">↺ Move to Inbox</button>') +
      '<button class="btn btn-outline btn-sm" id="btnDownload">⬇ Download PDF</button>' +
      "</div>";
    detail.querySelector(".body").textContent = m.body;

    const archiveBtn = document.getElementById("btnArchive");
    if (archiveBtn) archiveBtn.addEventListener("click", () => { VATSIM.setMessageFolder(id, "archived"); VATSIM.toast("Message archived.", "success"); renderAll(); });
    const unarchiveBtn = document.getElementById("btnUnarchive");
    if (unarchiveBtn) unarchiveBtn.addEventListener("click", () => { VATSIM.setMessageFolder(id, "inbox"); VATSIM.toast("Message moved to Inbox.", "success"); renderAll(); });
    document.getElementById("btnDownload").addEventListener("click", () => downloadMessage(m));

    renderList();
  }

  function downloadMessage(m) {
    VATSIM.showLoading("Preparing PDF…", 500).then(() => {
      const ok = VATSIM.generatePdf({
        title: m.subject,
        subtitle: (m.folder === "outbox" ? "To: " + m.to : "From: " + m.from) + " · " + VATSIM.fmtDate(m.date) + " · " + m.category,
        bodyParas: m.body.split("\n").filter((l) => l.trim() !== ""),
        filename: "Correspondence_" + m.id + ".pdf",
      });
      if (ok) VATSIM.toast("Correspondence PDF downloaded.", "success");
    });
  }

  function renderAll() {
    renderList();
    if (activeId && !VATSIM.getMessages().find((m) => m.id === activeId && m.folder === activeFolder)) {
      document.getElementById("msgDetail").innerHTML = '<div class="msg-empty">Select a message to read it.</div>';
      activeId = null;
    }
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFolder = btn.getAttribute("data-folder");
      activeId = null;
      document.getElementById("msgDetail").innerHTML = '<div class="msg-empty">Select a message to read it.</div>';
      renderList();
    });
  });
  document.getElementById("msgSearch").addEventListener("input", renderList);
  document.getElementById("catFilter").addEventListener("change", renderList);
  document.querySelectorAll("[data-static]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      VATSIM.toast("This module is outside the VAT201 training scope of this simulator.", "info");
    })
  );

  renderList();
  if (deepLinkId) openMessage(deepLinkId);
})();
