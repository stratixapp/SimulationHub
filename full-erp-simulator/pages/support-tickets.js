/* =============================================================================
   DOT ERP — pages/support-tickets.js
   Phase 14, Module 02: Support Tickets / Case Management
   ========================================================================== */
(function () {
  "use strict";
  const { $, $$, escapeHtml, formatDateTime, showToast, openModal, closeModal,
          openConfirm, requireSession, runBootSequence, logSystemActivity, actorLabel } = window.ERP;

  const PAGE_SIZE = 8;
  let session=null, company=null, filterStatus="all", filterPriority="all", page=1, editingId=null, detailId=null;

  const custName = (id) => { const c = id ? ERP_CustomerRepository.findById(id) : null; return c ? c.customerName : "Unknown customer"; };
  const empName = (id) => { const e = id ? ERP_EmployeeRepository.findById(id) : null; return e ? e.fullName : "Unassigned"; };
  const hrs = (n) => n === null ? "—" : (n < 24 ? `${n.toFixed(1)} h` : `${(n/24).toFixed(1)} d`);
  function statusBadge(s){ const t = s==="Closed"?"success":s==="Resolved"?"info":s==="Cancelled"?"neutral":s==="In Progress"?"warning":"danger";
    return `<span class="status-badge status-badge--${t}">${s}</span>`; }
  function prioBadge(p){ const t = p==="Urgent"?"danger":p==="High"?"warning":p==="Normal"?"info":"neutral";
    return `<span class="status-badge status-badge--${t}">${p}</span>`; }

  function filtered() {
    let rows = ERP_SupportTicketRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((t)=>t.status===filterStatus);
    if (filterPriority !== "all") rows = rows.filter((t)=>t.priority===filterPriority);
    return rows;
  }

  function renderSummary() {
    const m = ERP_SupportTicketRepository.getMetrics(company.id);
    $("#stSummaryOpen").textContent = String(m.Open + m["In Progress"]);
    $("#stSummaryUrgent").textContent = String(m.openUrgent);
    $("#stSummaryAvg").textContent = m.avgResolutionHours === null ? "—" : hrs(m.avgResolutionHours);
    $("#stSummaryReopened").textContent = String(m.reopenedCount);
  }

  function renderPagination(tp) {
    const c=$("#stPagination"); c.innerHTML="";
    if (tp<=1) return;
    const mk=(l,d,fn,a)=>{const b=document.createElement("button");b.type="button";b.className="page-btn"+(a?" is-active":"");b.textContent=l;b.disabled=!!d;b.addEventListener("click",fn);return b;};
    c.appendChild(mk("‹",page===1,()=>{page--;renderTable();}));
    for(let p=1;p<=tp;p++) c.appendChild(mk(String(p),false,()=>{page=p;renderTable();},p===page));
    c.appendChild(mk("›",page===tp,()=>{page++;renderTable();}));
  }

  function renderTable() {
    const all = filtered();
    const tp = Math.max(1, Math.ceil(all.length/PAGE_SIZE));
    page = Math.min(page, tp);
    const items = all.slice((page-1)*PAGE_SIZE,(page-1)*PAGE_SIZE+PAGE_SIZE);
    $("#stEmptyState").hidden = all.length!==0;
    $("#stTable").hidden = all.length===0;
    $("#stTableBody").innerHTML = items.map((t)=>`
      <tr>
        <td><code>${escapeHtml(t.ticketCode)}</code></td>
        <td>${escapeHtml(t.subject)}${(Number(t.reopenCount)||0)>0?` <span class="status-badge status-badge--warning">Reopened ×${t.reopenCount}</span>`:""}</td>
        <td>${escapeHtml(custName(t.customerId))}</td>
        <td>${escapeHtml(t.severity)}</td>
        <td>${prioBadge(t.priority)}</td>
        <td>${escapeHtml(empName(t.assignedToEmployeeId))}</td>
        <td>${hrs(ERP_SupportTicketRepository.getAgeHours(t))}</td>
        <td>${statusBadge(t.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${t.id}">View</button></td>
      </tr>`).join("");
    renderPagination(tp);
  }

  const renderAll = () => { renderSummary(); renderTable(); };

  function renderActivity() {
    let log=[]; try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog))||[]; } catch { /* ignore */ }
    const rel = log.filter((e)=>e.module==="Support Tickets").sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,8);
    $("#stActivityEmptyState").hidden = rel.length!==0;
    $("#stActivityList").innerHTML = rel.map((e)=>`<li class="activity-item"><span class="activity-item__icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span><div><p class="activity-item__text">${escapeHtml(e.description)}</p><p class="activity-item__time">${formatDateTime(new Date(e.timestamp))}</p></div></li>`).join("");
  }

  function bindChips() {
    $$("#stStatusChips .chip").forEach((c)=>c.addEventListener("click",()=>{ $$("#stStatusChips .chip").forEach((x)=>x.classList.remove("is-active")); c.classList.add("is-active"); filterStatus=c.dataset.status; page=1; renderTable(); }));
    $$("#stPriorityChips .chip").forEach((c)=>c.addEventListener("click",()=>{ $$("#stPriorityChips .chip").forEach((x)=>x.classList.remove("is-active")); c.classList.add("is-active"); filterPriority=c.dataset.priority; page=1; renderTable(); }));
    $("#stExportCsvBtn").addEventListener("click", exportCsv);
    $("#stPrintBtn").addEventListener("click", ()=>window.print());
  }

  function exportCsv() {
    const rows = filtered();
    if (!rows.length) { showToast("Nothing to export yet.","warning"); return; }
    const lines=[["Ticket","Subject","Customer","Category","Severity","Priority","Owner","Status","Reopens","Resolution Hours"].join(",")];
    rows.forEach((t)=>lines.push([t.ticketCode,`"${t.subject}"`,`"${custName(t.customerId)}"`,t.category,t.severity,t.priority,`"${empName(t.assignedToEmployeeId)}"`,t.status,t.reopenCount||0,(ERP_SupportTicketRepository.getResolutionHours(t)||"").toString()].join(",")));
    const b=new Blob([lines.join("\n")],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=`support-tickets-${company.companyCode}.csv`; a.click();
  }

  /* ---- form ---- */
  function populateSelects(t) {
    const custs = ERP_CustomerRepository.getAllForCompany(company.id);
    $("#stFormCustomer").innerHTML = `<option value="">Select a customer…</option>` + custs.map((c)=>`<option value="${c.id}"${t&&c.id===t.customerId?" selected":""}>${escapeHtml(c.customerName)}</option>`).join("");
    $("#stFormCategory").innerHTML = ERP_TICKET_CATEGORIES.map((c)=>`<option value="${c}"${t&&c===t.category?" selected":""}>${c}</option>`).join("");
    $("#stFormSeverity").innerHTML = ERP_TICKET_SEVERITIES.map((s)=>`<option value="${s}"${t&&s===t.severity?" selected":""}>${s}</option>`).join("");
    $("#stFormPriority").innerHTML = ERP_TICKET_PRIORITIES.map((p)=>`<option value="${p}"${t&&p===t.priority?" selected":""}>${p}</option>`).join("");
    const emps = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e)=>e.status==="Active");
    $("#stFormOwner").innerHTML = `<option value="">Unassigned</option>` + emps.map((e)=>`<option value="${e.id}"${t&&e.id===t.assignedToEmployeeId?" selected":""}>${escapeHtml(e.fullName)}</option>`).join("");
  }
  const clearErrors = () => ["stFormCustomerError","stFormSubjectError"].forEach((i)=>{$("#"+i).textContent="";});

  function openAddModal() {
    if (ERP_CustomerRepository.getAllForCompany(company.id).length === 0) { showToast("No customers yet — a support ticket is always raised against a real customer.","warning"); return; }
    editingId=null; $("#stFormTitle").textContent="New Support Ticket";
    populateSelects(null);
    $("#stFormSubject").value=""; $("#stFormDescription").value="";
    clearErrors(); openModal("stFormModal");
  }
  function openEditModal(t) {
    editingId=t.id; $("#stFormTitle").textContent=`Edit ${t.ticketCode}`;
    populateSelects(t);
    $("#stFormSubject").value=t.subject; $("#stFormDescription").value=t.description||"";
    clearErrors(); openModal("stFormModal");
  }

  function bindForm() {
    $("#stAddBtn").addEventListener("click", openAddModal);
    // Severity drives a SUGGESTED priority — freely overridable afterward.
    $("#stFormSeverity").addEventListener("change", () => {
      $("#stFormPriority").value = ERP_SupportTicketRepository.suggestPriorityFor($("#stFormSeverity").value);
    });
    $("#stFormSaveBtn").addEventListener("click", () => {
      clearErrors(); let ok=true;
      if (!$("#stFormCustomer").value) { $("#stFormCustomerError").textContent="Select the customer this is about."; ok=false; }
      if (!$("#stFormSubject").value.trim()) { $("#stFormSubjectError").textContent="Give the ticket a subject."; ok=false; }
      if (!ok) return;
      const payload = {
        customerId:$("#stFormCustomer").value, subject:$("#stFormSubject").value.trim(),
        description:$("#stFormDescription").value.trim(), category:$("#stFormCategory").value,
        severity:$("#stFormSeverity").value, priority:$("#stFormPriority").value,
        assignedToEmployeeId:$("#stFormOwner").value||null
      };
      if (editingId) {
        const u = ERP_SupportTicketRepository.update(editingId, payload);
        if (u) { logSystemActivity({module:"Support Tickets",action:"Update",description:`Updated ticket "${u.ticketCode}" (${company.name})`}); showToast("Ticket updated.","success"); }
        else showToast("Only Open or In Progress tickets can be edited.","danger");
      } else {
        const c = ERP_SupportTicketRepository.create(company, payload, session.username);
        logSystemActivity({module:"Support Tickets",action:"Create",description:`Raised ticket "${c.ticketCode}" (${company.name})`});
        showToast("Ticket raised.","success");
      }
      closeModal("stFormModal"); renderAll(); renderActivity();
    });
  }

  /* ---- detail ---- */
  function renderDetailFooter(t) {
    const f=$("#stDetailFooter"); f.innerHTML="";
    const add=(l,c,fn)=>{const b=document.createElement("button");b.type="button";b.className=c;b.textContent=l;b.addEventListener("click",fn);f.appendChild(b);};
    if (t.status==="Open") {
      add("Edit","btn btn--ghost",()=>{closeModal("stDetailModal");openEditModal(t);});
      add("Start Work","btn btn--primary",()=>{ ERP_SupportTicketRepository.start(t.id,session.username); logSystemActivity({module:"Support Tickets",action:"Start",description:`Started ticket "${t.ticketCode}" (${company.name})`}); closeModal("stDetailModal"); renderAll(); renderActivity(); });
      add("Cancel","btn btn--danger-outline",()=>requestCancel(t));
    } else if (t.status==="In Progress") {
      add("Edit","btn btn--ghost",()=>{closeModal("stDetailModal");openEditModal(t);});
      add("Resolve","btn btn--primary",()=>openResolveModal(t));
      add("Cancel","btn btn--danger-outline",()=>requestCancel(t));
    } else if (t.status==="Resolved") {
      add("Close Ticket","btn btn--primary",()=>requestClose(t));
      add("Reopen","btn btn--danger-outline",()=>requestReopen(t));
    }
    add("Close","btn btn--ghost",()=>closeModal("stDetailModal"));
  }

  function openDetailModal(t) {
    detailId=t.id;
    const rh = ERP_SupportTicketRepository.getResolutionHours(t);
    $("#stDetailTitle").textContent = `Ticket — ${t.ticketCode}`;
    $("#stDetailBody").innerHTML = `
      <div><dt>Ticket</dt><dd><code>${escapeHtml(t.ticketCode)}</code></dd></div>
      <div><dt>Subject</dt><dd>${escapeHtml(t.subject)}</dd></div>
      <div><dt>Customer</dt><dd>${escapeHtml(custName(t.customerId))}</dd></div>
      <div><dt>Category</dt><dd>${escapeHtml(t.category)}</dd></div>
      <div><dt>Severity</dt><dd>${escapeHtml(t.severity)} <span class="profile-subtle">(impact)</span></dd></div>
      <div><dt>Priority</dt><dd>${prioBadge(t.priority)} <span class="profile-subtle">(scheduling)</span></dd></div>
      <div><dt>Owner</dt><dd>${escapeHtml(empName(t.assignedToEmployeeId))}</dd></div>
      <div><dt>Description</dt><dd>${t.description?escapeHtml(t.description):"<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(t.status)}</dd></div>
      <div><dt>Age</dt><dd>${hrs(ERP_SupportTicketRepository.getAgeHours(t))}</dd></div>
      ${rh!==null?`<div><dt>Resolution Time</dt><dd>${hrs(rh)}</dd></div>`:""}
      ${(Number(t.reopenCount)||0)>0?`<div><dt>Reopened</dt><dd>${t.reopenCount} time(s) — worth reviewing whether the fix held</dd></div>`:""}
      ${t.resolutionNotes?`<div><dt>Resolution Notes</dt><dd>${escapeHtml(t.resolutionNotes)}</dd></div>`:""}
      <div><dt>Raised</dt><dd>${formatDateTime(new Date(t.createdAt))} by ${escapeHtml(actorLabel(t.createdByUsername))}</dd></div>
    `;
    renderDetailFooter(t); openModal("stDetailModal");
  }

  function openResolveModal(t) { detailId=t.id; $("#stResolveNotes").value=""; $("#stResolveNotesError").textContent=""; closeModal("stDetailModal"); openModal("stResolveModal"); }

  function requestReopen(t) {
    openConfirm({ title:"Reopen this ticket?", message:"The fix didn't hold. This moves it back to In Progress and records a reopen — that count is a real signal about fix quality, so it's kept.", confirmLabel:"Reopen",
      onConfirm:()=>{ ERP_SupportTicketRepository.reopen(t.id,session.username); logSystemActivity({module:"Support Tickets",action:"Reopen",description:`Reopened ticket "${t.ticketCode}" (${company.name})`}); closeModal("stDetailModal"); renderAll(); renderActivity(); } });
  }
  function requestClose(t) {
    openConfirm({ title:"Close this ticket?", message:"Closed is final — a recurrence should be raised as a new ticket so resolution-time metrics stay honest.", confirmLabel:"Close Ticket",
      onConfirm:()=>{ ERP_SupportTicketRepository.close(t.id,session.username); logSystemActivity({module:"Support Tickets",action:"Close",description:`Closed ticket "${t.ticketCode}" (${company.name})`}); closeModal("stDetailModal"); renderAll(); renderActivity(); showToast("Ticket closed.","success"); } });
  }
  function requestCancel(t) {
    openConfirm({ title:"Cancel this ticket?", message:"Use this when the ticket itself was invalid or raised in error — not when it was genuinely worked and fixed.", confirmLabel:"Cancel Ticket",
      onConfirm:()=>{ ERP_SupportTicketRepository.cancel(t.id,session.username); logSystemActivity({module:"Support Tickets",action:"Cancel",description:`Cancelled ticket "${t.ticketCode}" (${company.name})`}); closeModal("stDetailModal"); renderAll(); renderActivity(); } });
  }

  function bindDetail() {
    $("#stTableBody").addEventListener("click",(e)=>{ const b=e.target.closest(".row-detail-btn"); if(!b) return;
      const t=ERP_SupportTicketRepository.findById(b.dataset.id); if(t) openDetailModal(t); });
    $("#stResolveSaveBtn").addEventListener("click",()=>{
      const n=$("#stResolveNotes").value.trim();
      if(!n){ $("#stResolveNotesError").textContent="Describe what actually fixed it — that's what makes this ticket useful later."; return; }
      const t=ERP_SupportTicketRepository.findById(detailId);
      ERP_SupportTicketRepository.resolve(detailId,n,session.username);
      logSystemActivity({module:"Support Tickets",action:"Resolve",description:`Resolved ticket "${t.ticketCode}" (${company.name})`});
      closeModal("stResolveModal"); renderAll(); renderActivity(); showToast("Ticket resolved — close it once the customer confirms.","success");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "support-tickets")) return;
    runBootSequence([{p:35,t:"Authenticating session…"},{p:70,t:"Loading tickets…"},{p:100,t:"Ready."}]);
    company = ERP_CompanyRepository.getActive();
    if (!company) { $("#noCompanyState").hidden=false; $("#stContent").hidden=true; $("#stSubtitle").textContent="No active company yet."; }
    else {
      $("#noCompanyState").hidden=true; $("#stContent").hidden=false; $("#stHeaderActions").hidden=false;
      $("#stSubtitle").textContent = `Handling customer issues for ${company.name} (${company.companyCode}).`;
      renderAll(); renderActivity(); bindChips(); bindForm(); bindDetail();
    }
    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
