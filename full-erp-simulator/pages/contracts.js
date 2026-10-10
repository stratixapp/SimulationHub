/* =============================================================================
   DOT ERP — pages/contracts.js
   Phase 14, Module 03: Contract Management

   Every status shown on this page is the EFFECTIVE status
   (`getEffectiveStatus()`), not the stored one — so a contract nobody
   remembered to renew reads "Expired" rather than claiming to be Active.
   See data/contract-data.js's own header for why both exist.
   ========================================================================== */
(function () {
  "use strict";
  const { $, $$, escapeHtml, formatDateTime, showToast, openModal, closeModal,
          openConfirm, requireSession, runBootSequence, logSystemActivity, actorLabel } = window.ERP;

  const PAGE_SIZE = 8;
  let session=null, company=null, filterStatus="all", page=1, editingId=null, detailId=null;

  const money = (n) => "₹" + (Number(n)||0).toLocaleString("en-IN",{maximumFractionDigits:2});
  const custName = (id) => { const c = id ? ERP_CustomerRepository.findById(id) : null; return c ? c.customerName : "Unknown customer"; };
  const empName = (id) => { const e = id ? ERP_EmployeeRepository.findById(id) : null; return e ? e.fullName : "—"; };
  const eff = (c) => ERP_ContractRepository.getEffectiveStatus(c);
  function statusBadge(s){ const t = s==="Active"?"success":s==="Expired"?"danger":s==="Terminated"?"neutral":s==="Renewed"?"info":"warning";
    return `<span class="status-badge status-badge--${t}">${s}</span>`; }

  function filtered() {
    let rows = ERP_ContractRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((c)=>eff(c)===filterStatus);
    return rows;
  }

  function renderSummary() {
    const m = ERP_ContractRepository.getMetrics(company.id);
    $("#ctSummaryActive").textContent = String(m.active);
    $("#ctSummaryValue").textContent = money(m.activeValue);
    $("#ctSummaryDue").textContent = String(m.renewalsDue);
    $("#ctSummaryExpired").textContent = String(m.expired);
  }

  function renderRenewalPanel() {
    const due = ERP_ContractRepository.getRenewalsDue(company.id, 60);
    $("#ctRenewalEmpty").hidden = due.length !== 0;
    $("#ctRenewalList").innerHTML = due.map((r)=>`
      <li class="activity-item">
        <div>
          <p class="activity-item__text"><code>${escapeHtml(r.contract.contractCode)}</code> ${escapeHtml(r.contract.title)} — ${escapeHtml(custName(r.contract.customerId))}${r.contract.autoRenew?' <span class="status-badge status-badge--info">Auto-renew intended</span>':""}</p>
          <p class="activity-item__time">${r.daysToExpiry < 0 ? `Overdue by ${Math.abs(r.daysToExpiry)} day(s)` : `Expires in ${r.daysToExpiry} day(s)`} · ends ${r.contract.endDate}</p>
        </div>
      </li>`).join("");
  }

  function renderPagination(tp) {
    const c=$("#ctPagination"); c.innerHTML="";
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
    $("#ctEmptyState").hidden = all.length!==0;
    $("#ctTable").hidden = all.length===0;
    $("#ctTableBody").innerHTML = items.map((c)=>{
      const d = ERP_ContractRepository.getDaysToExpiry(c);
      return `<tr>
        <td><code>${escapeHtml(c.contractCode)}</code></td>
        <td>${escapeHtml(c.title)}${c.renewedFromContractId?' <span class="status-badge status-badge--info">Renewal</span>':""}</td>
        <td>${escapeHtml(custName(c.customerId))}</td>
        <td>${escapeHtml(c.contractType)}</td>
        <td>${c.startDate||"—"} → ${c.endDate||"—"}</td>
        <td class="text-right">${money(c.contractValue)}</td>
        <td>${d===null?"—":(d<0?`${Math.abs(d)}d overdue`:`${d}d left`)}</td>
        <td>${statusBadge(eff(c))}</td>
        <td><button type="button" class="row-detail-btn" data-id="${c.id}">View</button></td>
      </tr>`;
    }).join("");
    renderPagination(tp);
  }

  const renderAll = () => { renderSummary(); renderRenewalPanel(); renderTable(); };

  function renderActivity() {
    let log=[]; try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog))||[]; } catch { /* ignore */ }
    const rel = log.filter((e)=>e.module==="Contract Management").sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,8);
    $("#ctActivityEmptyState").hidden = rel.length!==0;
    $("#ctActivityList").innerHTML = rel.map((e)=>`<li class="activity-item"><span class="activity-item__icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span><div><p class="activity-item__text">${escapeHtml(e.description)}</p><p class="activity-item__time">${formatDateTime(new Date(e.timestamp))}</p></div></li>`).join("");
  }

  function bindChips() {
    $$("#ctStatusChips .chip").forEach((c)=>c.addEventListener("click",()=>{ $$("#ctStatusChips .chip").forEach((x)=>x.classList.remove("is-active")); c.classList.add("is-active"); filterStatus=c.dataset.status; page=1; renderTable(); }));
    $("#ctExportCsvBtn").addEventListener("click", exportCsv);
    $("#ctPrintBtn").addEventListener("click", ()=>window.print());
  }

  function exportCsv() {
    const rows = filtered();
    if (!rows.length) { showToast("Nothing to export yet.","warning"); return; }
    const lines=[["Contract","Title","Customer","Type","Start","End","Value","Billing","Auto-Renew","Effective Status"].join(",")];
    rows.forEach((c)=>lines.push([c.contractCode,`"${c.title}"`,`"${custName(c.customerId)}"`,`"${c.contractType}"`,c.startDate||"",c.endDate||"",c.contractValue,c.billingCycle,c.autoRenew?"Yes":"No",eff(c)].join(",")));
    const b=new Blob([lines.join("\n")],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=`contracts-${company.companyCode}.csv`; a.click();
  }

  /* ---- form ---- */
  function populateSelects(c) {
    const custs = ERP_CustomerRepository.getAllForCompany(company.id);
    $("#ctFormCustomer").innerHTML = `<option value="">Select a customer…</option>` + custs.map((x)=>`<option value="${x.id}"${c&&x.id===c.customerId?" selected":""}>${escapeHtml(x.customerName)}</option>`).join("");
    $("#ctFormType").innerHTML = ERP_CONTRACT_TYPES.map((t)=>`<option value="${t}"${c&&t===c.contractType?" selected":""}>${t}</option>`).join("");
    $("#ctFormBilling").innerHTML = ERP_CONTRACT_BILLING_CYCLES.map((t)=>`<option value="${t}"${c&&t===c.billingCycle?" selected":""}>${t}</option>`).join("");
    const emps = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e)=>e.status==="Active");
    $("#ctFormOwner").innerHTML = `<option value="">Unassigned</option>` + emps.map((e)=>`<option value="${e.id}"${c&&e.id===c.ownerEmployeeId?" selected":""}>${escapeHtml(e.fullName)}</option>`).join("");
  }
  const clearErrors = () => { ["ctFormCustomerError","ctFormTitleError","ctFormDatesError"].forEach((i)=>{$("#"+i).textContent="";}); $("#ctFormOverlapWarn").hidden = true; };

  function checkOverlap() {
    const o = ERP_ContractRepository.findOverlappingContract(company.id, $("#ctFormCustomer").value, $("#ctFormStart").value, $("#ctFormEnd").value, editingId);
    $("#ctFormOverlapWarn").hidden = !o;
    if (o) $("#ctFormOverlapWarn").textContent = `Heads up: ${o.contractCode} for this customer already covers overlapping dates. Concurrent contracts are legitimate, so this isn't blocked — just worth confirming it's intentional.`;
  }

  function openAddModal() {
    if (ERP_CustomerRepository.getAllForCompany(company.id).length === 0) { showToast("No customers yet — a contract is always with a real customer.","warning"); return; }
    editingId=null; $("#ctFormTitle").textContent="New Contract";
    populateSelects(null);
    $("#ctFormTitleInput").value=""; $("#ctFormStart").value=""; $("#ctFormEnd").value="";
    $("#ctFormValue").value=""; $("#ctFormAutoRenew").checked=false; $("#ctFormTerms").value="";
    clearErrors(); openModal("ctFormModal");
  }
  function openEditModal(c) {
    editingId=c.id; $("#ctFormTitle").textContent=`Edit ${c.contractCode}`;
    populateSelects(c);
    $("#ctFormTitleInput").value=c.title; $("#ctFormStart").value=c.startDate||""; $("#ctFormEnd").value=c.endDate||"";
    $("#ctFormValue").value=c.contractValue||""; $("#ctFormAutoRenew").checked=!!c.autoRenew; $("#ctFormTerms").value=c.terms||"";
    clearErrors(); openModal("ctFormModal");
  }

  function bindForm() {
    $("#ctAddBtn").addEventListener("click", openAddModal);
    ["#ctFormCustomer","#ctFormStart","#ctFormEnd"].forEach((s)=>$(s).addEventListener("change", checkOverlap));
    $("#ctFormSaveBtn").addEventListener("click", () => {
      clearErrors(); let ok=true;
      if (!$("#ctFormCustomer").value) { $("#ctFormCustomerError").textContent="Select the customer."; ok=false; }
      if (!$("#ctFormTitleInput").value.trim()) { $("#ctFormTitleError").textContent="Give the contract a title."; ok=false; }
      const s=$("#ctFormStart").value, e=$("#ctFormEnd").value;
      if (!s || !e) { $("#ctFormDatesError").textContent="Both a start and an end date are required."; ok=false; }
      else if (e <= s) { $("#ctFormDatesError").textContent="The end date has to be after the start date."; ok=false; }
      if (!ok) return;
      const payload = {
        customerId:$("#ctFormCustomer").value, title:$("#ctFormTitleInput").value.trim(),
        contractType:$("#ctFormType").value, startDate:s, endDate:e,
        contractValue:Number($("#ctFormValue").value)||0, billingCycle:$("#ctFormBilling").value,
        autoRenew:$("#ctFormAutoRenew").checked, terms:$("#ctFormTerms").value.trim(),
        ownerEmployeeId:$("#ctFormOwner").value||null
      };
      if (editingId) {
        const u = ERP_ContractRepository.update(editingId, payload);
        if (u) { logSystemActivity({module:"Contract Management",action:"Update",description:`Updated contract "${u.contractCode}" (${company.name})`}); showToast("Contract updated.","success"); }
        else showToast("Only a Draft contract can be edited.","danger");
      } else {
        const c = ERP_ContractRepository.create(company, payload, session.username);
        logSystemActivity({module:"Contract Management",action:"Create",description:`Created contract "${c.contractCode}" (${company.name})`});
        showToast("Contract saved as Draft — activate it when it's signed.","success");
      }
      closeModal("ctFormModal"); renderAll(); renderActivity();
    });
  }

  /* ---- detail ---- */
  function renderDetailFooter(c) {
    const f=$("#ctDetailFooter"); f.innerHTML="";
    const add=(l,cls,fn)=>{const b=document.createElement("button");b.type="button";b.className=cls;b.textContent=l;b.addEventListener("click",fn);f.appendChild(b);};
    const e = eff(c);
    if (c.status==="Draft") {
      add("Edit","btn btn--ghost",()=>{closeModal("ctDetailModal");openEditModal(c);});
      if (ERP_ContractRepository.canActivate(c)) add("Activate","btn btn--primary",()=>{ ERP_ContractRepository.activate(c.id,session.username); logSystemActivity({module:"Contract Management",action:"Activate",description:`Activated contract "${c.contractCode}" (${company.name})`}); closeModal("ctDetailModal"); renderAll(); renderActivity(); showToast("Contract activated.","success"); });
      add("Delete","btn btn--danger-outline",()=>requestDelete(c));
    } else {
      if (ERP_ContractRepository.canRenew(c)) add("Renew","btn btn--primary",()=>openRenewModal(c));
      if (e==="Active") add("Terminate","btn btn--danger-outline",()=>openTerminateModal(c));
    }
    add("Close","btn btn--ghost",()=>closeModal("ctDetailModal"));
  }

  function openDetailModal(c) {
    detailId=c.id;
    const d = ERP_ContractRepository.getDaysToExpiry(c);
    const prev = c.renewedFromContractId ? ERP_ContractRepository.findById(c.renewedFromContractId) : null;
    const next = c.renewedToContractId ? ERP_ContractRepository.findById(c.renewedToContractId) : null;
    $("#ctDetailTitle").textContent = `Contract — ${c.contractCode}`;
    $("#ctDetailBody").innerHTML = `
      <div><dt>Contract</dt><dd><code>${escapeHtml(c.contractCode)}</code></dd></div>
      <div><dt>Title</dt><dd>${escapeHtml(c.title)}</dd></div>
      <div><dt>Customer</dt><dd>${escapeHtml(custName(c.customerId))}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(c.contractType)}</dd></div>
      <div><dt>Term</dt><dd>${c.startDate||"—"} → ${c.endDate||"—"}${d!==null?` <span class="profile-subtle">(${d<0?`${Math.abs(d)} days overdue`:`${d} days left`})</span>`:""}</dd></div>
      <div><dt>Value</dt><dd>${money(c.contractValue)}</dd></div>
      <div><dt>Billing Cycle</dt><dd>${escapeHtml(c.billingCycle)}</dd></div>
      <div><dt>Auto-Renew</dt><dd>${c.autoRenew?"Intended — you still click Renew; this tool has no scheduler":"No"}</dd></div>
      <div><dt>Owner</dt><dd>${escapeHtml(empName(c.ownerEmployeeId))}</dd></div>
      <div><dt>Terms</dt><dd>${c.terms?escapeHtml(c.terms):"<span class=\"profile-subtle\">None recorded</span>"}</dd></div>
      <div><dt>Status (effective)</dt><dd>${statusBadge(eff(c))}${eff(c)!==c.status?` <span class="profile-subtle">— stored as ${escapeHtml(c.status)}</span>`:""}</dd></div>
      ${c.status==="Terminated"?`<div><dt>Termination Reason</dt><dd>${escapeHtml(c.terminationReason||"—")}</dd></div>`:""}
      ${prev?`<div><dt>Renewed From</dt><dd><code>${escapeHtml(prev.contractCode)}</code> (${prev.startDate} → ${prev.endDate})</dd></div>`:""}
      ${next?`<div><dt>Renewed Into</dt><dd><code>${escapeHtml(next.contractCode)}</code> (${next.startDate} → ${next.endDate})</dd></div>`:""}
      <div><dt>Created</dt><dd>${formatDateTime(new Date(c.createdAt))} by ${escapeHtml(actorLabel(c.createdByUsername))}</dd></div>
    `;
    renderDetailFooter(c); openModal("ctDetailModal");
  }

  function openRenewModal(c) {
    detailId=c.id;
    // Suggest the next term starting the day after this one ends, same length.
    const end = new Date(c.endDate);
    const nextStart = new Date(end.getTime() + 864e5);
    const len = new Date(c.endDate) - new Date(c.startDate);
    const nextEnd = new Date(nextStart.getTime() + len);
    $("#ctRenewStart").value = nextStart.toISOString().slice(0,10);
    $("#ctRenewEnd").value = nextEnd.toISOString().slice(0,10);
    $("#ctRenewValue").value = c.contractValue || 0;
    $("#ctRenewNote").textContent = `This creates a NEW contract carrying forward ${c.contractCode}'s terms — the original stays on record exactly as it was, marked Renewed.`;
    closeModal("ctDetailModal"); openModal("ctRenewModal");
  }
  function openTerminateModal(c) { detailId=c.id; $("#ctTerminateReason").value=""; $("#ctTerminateReasonError").textContent=""; closeModal("ctDetailModal"); openModal("ctTerminateModal"); }

  function requestDelete(c) {
    openConfirm({ title:"Delete this draft contract?", message:"It was never activated, so nothing depends on it.", confirmLabel:"Delete",
      onConfirm:()=>{ if (ERP_ContractRepository.remove(c.id)) { logSystemActivity({module:"Contract Management",action:"Delete",description:`Deleted draft contract "${c.contractCode}" (${company.name})`}); closeModal("ctDetailModal"); renderAll(); renderActivity(); } } });
  }

  function bindDetail() {
    $("#ctTableBody").addEventListener("click",(e)=>{ const b=e.target.closest(".row-detail-btn"); if(!b) return;
      const c=ERP_ContractRepository.findById(b.dataset.id); if(c) openDetailModal(c); });

    $("#ctRenewSaveBtn").addEventListener("click",()=>{
      const s=$("#ctRenewStart").value, e=$("#ctRenewEnd").value;
      if(!s||!e||e<=s){ $("#ctRenewError").textContent="Give a valid new term — the end date must be after the start."; return; }
      $("#ctRenewError").textContent="";
      const res = ERP_ContractRepository.renew(detailId, company, { startDate:s, endDate:e, contractValue:Number($("#ctRenewValue").value)||0 }, session.username);
      if(!res.success){ showToast(res.reason||"Couldn't renew.","danger"); return; }
      logSystemActivity({module:"Contract Management",action:"Renew",description:`Renewed into contract "${res.newContract.contractCode}" (${company.name})`});
      closeModal("ctRenewModal"); renderAll(); renderActivity();
      showToast(`Renewed — ${res.newContract.contractCode} created; the original is preserved.`,"success");
    });

    $("#ctTerminateSaveBtn").addEventListener("click",()=>{
      const r=$("#ctTerminateReason").value.trim();
      if(!r){ $("#ctTerminateReasonError").textContent="Record why it was ended early — that's the point of tracking terminations separately from expiry."; return; }
      const c=ERP_ContractRepository.findById(detailId);
      ERP_ContractRepository.terminate(detailId,r,session.username);
      logSystemActivity({module:"Contract Management",action:"Terminate",description:`Terminated contract "${c.contractCode}" (${company.name})`});
      closeModal("ctTerminateModal"); renderAll(); renderActivity();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "contracts")) return;
    runBootSequence([{p:35,t:"Authenticating session…"},{p:70,t:"Loading contracts…"},{p:100,t:"Ready."}]);
    company = ERP_CompanyRepository.getActive();
    if (!company) { $("#noCompanyState").hidden=false; $("#ctContent").hidden=true; $("#ctSubtitle").textContent="No active company yet."; }
    else {
      $("#noCompanyState").hidden=true; $("#ctContent").hidden=false; $("#ctHeaderActions").hidden=false;
      $("#ctSubtitle").textContent = `Managing customer contracts for ${company.name} (${company.companyCode}).`;
      renderAll(); renderActivity(); bindChips(); bindForm(); bindDetail();
    }
    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
