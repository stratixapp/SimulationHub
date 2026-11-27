/* =============================================================================
   DOT ERP — pages/lead-pipeline.js
   Phase 14, Module 01: Lead Pipeline
   ========================================================================== */
(function () {
  "use strict";
  const { $, $$, escapeHtml, formatDateTime, showToast, openModal, closeModal,
          openConfirm, requireSession, runBootSequence, logSystemActivity, actorLabel } = window.ERP;

  const PAGE_SIZE = 8;
  let session = null, company = null, filterStatus = "all", page = 1, editingId = null, detailId = null;

  const money = (n) => "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const empName = (id) => { const e = id ? ERP_EmployeeRepository.findById(id) : null; return e ? e.fullName : "Unassigned"; };
  function statusBadge(s) {
    const tone = s === "Converted" ? "success" : s === "Lost" ? "danger" : s === "Cancelled" ? "neutral" : s === "Qualified" ? "info" : "warning";
    return `<span class="status-badge status-badge--${tone}">${s}</span>`;
  }
  function ratingBadge(r) {
    const tone = r === "Hot" ? "danger" : r === "Warm" ? "warning" : "info";
    return `<span class="status-badge status-badge--${tone}">${r}</span>`;
  }

  function filtered() {
    let rows = ERP_LeadRepository.getAllForCompany(company.id);
    if (filterStatus !== "all") rows = rows.filter((l) => l.status === filterStatus);
    return rows;
  }

  function renderSummary() {
    const f = ERP_LeadRepository.getFunnelCounts(company.id);
    $("#lpSummaryTotal").textContent = String(f.total);
    $("#lpSummaryNew").textContent = String(f.New);
    $("#lpSummaryQualified").textContent = String(f.Qualified);
    $("#lpSummaryRate").textContent = f.conversionRate === null ? "—" : f.conversionRate.toFixed(0) + "%";
  }

  function renderPagination(totalPages) {
    const c = $("#lpPagination"); c.innerHTML = "";
    if (totalPages <= 1) return;
    const mk = (l, d, fn, a) => { const b = document.createElement("button"); b.type="button"; b.className="page-btn"+(a?" is-active":""); b.textContent=l; b.disabled=!!d; b.addEventListener("click",fn); return b; };
    c.appendChild(mk("‹", page===1, () => { page--; renderTable(); }));
    for (let p=1;p<=totalPages;p++) c.appendChild(mk(String(p), false, () => { page=p; renderTable(); }, p===page));
    c.appendChild(mk("›", page===totalPages, () => { page++; renderTable(); }));
  }

  function renderTable() {
    const all = filtered();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const items = all.slice((page-1)*PAGE_SIZE, (page-1)*PAGE_SIZE+PAGE_SIZE);
    $("#lpEmptyState").hidden = all.length !== 0;
    $("#lpTable").hidden = all.length === 0;
    $("#lpTableBody").innerHTML = items.map((l) => `
      <tr>
        <td><code>${escapeHtml(l.leadCode)}</code></td>
        <td>${escapeHtml(l.leadName)}</td>
        <td>${escapeHtml(l.contactPerson || "—")}<div class="profile-subtle">${escapeHtml(l.phone || l.email || "")}</div></td>
        <td>${escapeHtml(l.source)}</td>
        <td>${ratingBadge(l.rating)}</td>
        <td class="text-right">${l.estimatedValue ? money(l.estimatedValue) : "—"}</td>
        <td>${escapeHtml(empName(l.assignedToEmployeeId))}</td>
        <td>${statusBadge(l.status)}</td>
        <td><button type="button" class="row-detail-btn" data-id="${l.id}">View</button></td>
      </tr>`).join("");
    renderPagination(totalPages);
  }

  const renderAll = () => { renderSummary(); renderTable(); };

  function renderActivity() {
    let log = [];
    try { log = JSON.parse(localStorage.getItem(window.ERP.STORAGE_KEYS.systemActivityLog)) || []; } catch { /* ignore */ }
    const rel = log.filter((e) => e.module === "Lead Pipeline").sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,8);
    $("#lpActivityEmptyState").hidden = rel.length !== 0;
    $("#lpActivityList").innerHTML = rel.map((e)=>`<li class="activity-item"><span class="activity-item__icon"><svg viewBox="0 0 24 24" fill="none"><path d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span><div><p class="activity-item__text">${escapeHtml(e.description)}</p><p class="activity-item__time">${formatDateTime(new Date(e.timestamp))}</p></div></li>`).join("");
  }

  function bindChips() {
    $$("#lpStatusChips .chip").forEach((chip) => chip.addEventListener("click", () => {
      $$("#lpStatusChips .chip").forEach((c)=>c.classList.remove("is-active"));
      chip.classList.add("is-active"); filterStatus = chip.dataset.status; page = 1; renderTable();
    }));
    $("#lpExportCsvBtn").addEventListener("click", exportCsv);
    $("#lpPrintBtn").addEventListener("click", () => window.print());
  }

  function exportCsv() {
    const rows = filtered();
    if (!rows.length) { showToast("Nothing to export yet.", "warning"); return; }
    const lines = [["Lead Code","Name","Contact","Phone","Email","Source","Rating","Est. Value","Owner","Status"].join(",")];
    rows.forEach((l)=>lines.push([l.leadCode,`"${l.leadName}"`,`"${l.contactPerson||""}"`,l.phone||"",l.email||"",l.source,l.rating,l.estimatedValue||"",`"${empName(l.assignedToEmployeeId)}"`,l.status].join(",")));
    const b = new Blob([lines.join("\n")], {type:"text/csv"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `leads-${company.companyCode}.csv`; a.click();
  }

  /* ---- form ---- */
  function populateEmployees(sel, selected) {
    const emps = ERP_EmployeeRepository.getAllForCompany(company.id).filter((e)=>e.status==="Active");
    $(sel).innerHTML = `<option value="">Unassigned</option>` + emps.map((e)=>`<option value="${e.id}"${e.id===selected?" selected":""}>${escapeHtml(e.fullName)}</option>`).join("");
  }
  function clearErrors(){ ["lpFormNameError","lpFormContactError"].forEach((i)=>{$("#"+i).textContent="";}); $("#lpFormDupWarn").hidden = true; }

  function openAddModal() {
    editingId = null;
    $("#lpFormTitle").textContent = "New Lead";
    $("#lpFormName").value=""; $("#lpFormContactPerson").value=""; $("#lpFormPhone").value=""; $("#lpFormEmail").value="";
    $("#lpFormSource").innerHTML = ERP_LEAD_SOURCES.map((s)=>`<option value="${s}">${s}</option>`).join("");
    $("#lpFormRating").innerHTML = ERP_LEAD_RATINGS.map((r)=>`<option value="${r}"${r==="Warm"?" selected":""}>${r}</option>`).join("");
    populateEmployees("#lpFormOwner","");
    $("#lpFormValue").value=""; $("#lpFormNotes").value="";
    clearErrors(); openModal("lpFormModal");
  }
  function openEditModal(l) {
    editingId = l.id;
    $("#lpFormTitle").textContent = `Edit ${l.leadCode}`;
    $("#lpFormName").value=l.leadName; $("#lpFormContactPerson").value=l.contactPerson||""; $("#lpFormPhone").value=l.phone||""; $("#lpFormEmail").value=l.email||"";
    $("#lpFormSource").innerHTML = ERP_LEAD_SOURCES.map((s)=>`<option value="${s}"${s===l.source?" selected":""}>${s}</option>`).join("");
    $("#lpFormRating").innerHTML = ERP_LEAD_RATINGS.map((r)=>`<option value="${r}"${r===l.rating?" selected":""}>${r}</option>`).join("");
    populateEmployees("#lpFormOwner", l.assignedToEmployeeId||"");
    $("#lpFormValue").value=l.estimatedValue||""; $("#lpFormNotes").value=l.interestNotes||"";
    clearErrors(); openModal("lpFormModal");
  }

  function checkDuplicate() {
    const dup = ERP_LeadRepository.findPossibleDuplicate(company.id, { phone:$("#lpFormPhone").value, email:$("#lpFormEmail").value }, editingId);
    $("#lpFormDupWarn").hidden = !dup;
    if (dup) $("#lpFormDupWarn").textContent = `Heads up: ${dup.leadCode} (${dup.leadName}) already has this phone or email. That's often the same prospect enquiring twice — worth a look, but not blocked.`;
  }

  function bindForm() {
    $("#lpAddBtn").addEventListener("click", openAddModal);
    ["#lpFormPhone","#lpFormEmail"].forEach((s)=>$(s).addEventListener("blur", checkDuplicate));
    $("#lpFormSaveBtn").addEventListener("click", () => {
      clearErrors();
      let ok = true;
      if (!$("#lpFormName").value.trim()) { $("#lpFormNameError").textContent="Enter the lead's name."; ok=false; }
      if (!$("#lpFormPhone").value.trim() && !$("#lpFormEmail").value.trim()) { $("#lpFormContactError").textContent="Give at least a phone number or an email — otherwise nobody can follow this up."; ok=false; }
      if (!ok) return;
      const payload = {
        leadName:$("#lpFormName").value.trim(), contactPerson:$("#lpFormContactPerson").value.trim(),
        phone:$("#lpFormPhone").value.trim(), email:$("#lpFormEmail").value.trim(),
        source:$("#lpFormSource").value, rating:$("#lpFormRating").value,
        assignedToEmployeeId:$("#lpFormOwner").value||null,
        estimatedValue: $("#lpFormValue").value ? Number($("#lpFormValue").value) : null,
        interestNotes:$("#lpFormNotes").value.trim()
      };
      if (editingId) {
        const u = ERP_LeadRepository.update(editingId, payload);
        if (u) { logSystemActivity({module:"Lead Pipeline",action:"Update",description:`Updated lead "${u.leadCode}" (${company.name})`}); showToast("Lead updated.","success"); }
        else showToast("Only a New lead can be edited.","danger");
      } else {
        const c = ERP_LeadRepository.create(company, payload, session.username);
        logSystemActivity({module:"Lead Pipeline",action:"Create",description:`Created lead "${c.leadCode}" (${company.name})`});
        showToast("Lead added.","success");
      }
      closeModal("lpFormModal"); renderAll(); renderActivity();
    });
  }

  /* ---- detail ---- */
  function renderDetailFooter(l) {
    const f = $("#lpDetailFooter"); f.innerHTML = "";
    const add = (label, cls, fn) => { const b=document.createElement("button"); b.type="button"; b.className=cls; b.textContent=label; b.addEventListener("click",fn); f.appendChild(b); };
    if (l.status === "New") {
      add("Edit","btn btn--ghost",()=>{ closeModal("lpDetailModal"); openEditModal(l); });
      add("Qualify","btn btn--primary",()=>requestQualify(l));
      add("Mark Lost","btn btn--danger-outline",()=>openLostModal(l));
    } else if (l.status === "Qualified") {
      add("Convert to Customer","btn btn--primary",()=>openConvertModal(l));
      add("Return to New","btn btn--ghost",()=>{ ERP_LeadRepository.returnToNew(l.id); closeModal("lpDetailModal"); renderAll(); });
      add("Mark Lost","btn btn--danger-outline",()=>openLostModal(l));
    } else if (l.status === "Lost") {
      add("Reopen","btn btn--primary",()=>{ ERP_LeadRepository.reopen(l.id); logSystemActivity({module:"Lead Pipeline",action:"Reopen",description:`Reopened lead "${l.leadCode}" (${company.name})`}); closeModal("lpDetailModal"); renderAll(); renderActivity(); showToast("Lead reopened.","success"); });
    }
    if (ERP_LeadRepository.canCancel(l)) add("Cancel","btn btn--ghost",()=>requestCancel(l));
    add("Close","btn btn--ghost",()=>closeModal("lpDetailModal"));
  }

  function openDetailModal(l) {
    detailId = l.id;
    const cust = l.convertedCustomerId && typeof ERP_CustomerRepository!=="undefined" ? ERP_CustomerRepository.findById(l.convertedCustomerId) : null;
    $("#lpDetailTitle").textContent = `Lead — ${l.leadCode}`;
    $("#lpDetailBody").innerHTML = `
      <div><dt>Lead Code</dt><dd><code>${escapeHtml(l.leadCode)}</code></dd></div>
      <div><dt>Name</dt><dd>${escapeHtml(l.leadName)}</dd></div>
      <div><dt>Contact Person</dt><dd>${escapeHtml(l.contactPerson||"—")}</dd></div>
      <div><dt>Phone</dt><dd>${escapeHtml(l.phone||"—")}</dd></div>
      <div><dt>Email</dt><dd>${escapeHtml(l.email||"—")}</dd></div>
      <div><dt>Source</dt><dd>${escapeHtml(l.source)}</dd></div>
      <div><dt>Rating</dt><dd>${ratingBadge(l.rating)}</dd></div>
      <div><dt>Estimated Value</dt><dd>${l.estimatedValue?money(l.estimatedValue):"—"}</dd></div>
      <div><dt>Owner</dt><dd>${escapeHtml(empName(l.assignedToEmployeeId))}</dd></div>
      <div><dt>Interest / Notes</dt><dd>${l.interestNotes?escapeHtml(l.interestNotes):"<span class=\"profile-subtle\">None</span>"}</dd></div>
      <div><dt>Status</dt><dd>${statusBadge(l.status)}</dd></div>
      ${l.status==="Lost"?`<div><dt>Lost Reason</dt><dd>${escapeHtml(l.lostReason||"—")}</dd></div>`:""}
      ${cust?`<div><dt>Became Customer</dt><dd><code>${escapeHtml(cust.customerCode)}</code> ${escapeHtml(cust.customerName)}</dd></div>`:""}
      ${l.convertedInquiryId?`<div><dt>Inquiry Raised</dt><dd>Yes — see Customer Inquiry</dd></div>`:""}
      <div><dt>Created</dt><dd>${formatDateTime(new Date(l.createdAt))} by ${escapeHtml(actorLabel(l.createdByUsername))}</dd></div>
    `;
    renderDetailFooter(l); openModal("lpDetailModal");
  }

  function requestQualify(l) {
    if (!l.assignedToEmployeeId) { showToast("Assign an owner before qualifying — nobody should show as working a lead with no owner.","warning"); return; }
    ERP_LeadRepository.qualify(l.id, session.username);
    logSystemActivity({module:"Lead Pipeline",action:"Qualify",description:`Qualified lead "${l.leadCode}" (${company.name})`});
    closeModal("lpDetailModal"); renderAll(); renderActivity(); showToast("Lead qualified.","success");
  }

  function openLostModal(l) {
    detailId = l.id; $("#lpLostReason").value = ""; $("#lpLostReasonError").textContent = "";
    closeModal("lpDetailModal"); openModal("lpLostModal");
  }

  function openConvertModal(l) {
    detailId = l.id;
    $("#lpConvertSummary").textContent = `This creates a real Customer Master record for "${l.leadName}" from the details on this lead.`;
    $("#lpConvertCreateInquiry").checked = false;
    $("#lpConvertInquiryDesc").value = l.interestNotes || "";
    $("#lpConvertInquiryWrap").hidden = true;
    closeModal("lpDetailModal"); openModal("lpConvertModal");
  }

  function requestCancel(l) {
    openConfirm({ title:"Cancel this lead?", message:"Use this when the record itself was invalid or withdrawn — not when it was genuinely pursued and didn't convert (that's Lost).", confirmLabel:"Cancel Lead",
      onConfirm: () => { ERP_LeadRepository.cancel(l.id, session.username); logSystemActivity({module:"Lead Pipeline",action:"Cancel",description:`Cancelled lead "${l.leadCode}" (${company.name})`}); closeModal("lpDetailModal"); renderAll(); renderActivity(); } });
  }

  function bindDetail() {
    $("#lpTableBody").addEventListener("click", (e) => {
      const b = e.target.closest(".row-detail-btn"); if (!b) return;
      const l = ERP_LeadRepository.findById(b.dataset.id); if (l) openDetailModal(l);
    });
    $("#lpLostSaveBtn").addEventListener("click", () => {
      const r = $("#lpLostReason").value.trim();
      if (!r) { $("#lpLostReasonError").textContent = "Capture why it was lost — that's the whole value of recording it."; return; }
      const l = ERP_LeadRepository.findById(detailId);
      ERP_LeadRepository.markLost(detailId, r, session.username);
      logSystemActivity({module:"Lead Pipeline",action:"Mark Lost",description:`Marked lead "${l.leadCode}" lost (${company.name})`});
      closeModal("lpLostModal"); renderAll(); renderActivity();
    });
    $("#lpConvertCreateInquiry").addEventListener("change", () => {
      $("#lpConvertInquiryWrap").hidden = !$("#lpConvertCreateInquiry").checked;
    });
    $("#lpConvertSaveBtn").addEventListener("click", () => {
      const res = ERP_LeadRepository.convert(detailId, company, {
        createInquiry: $("#lpConvertCreateInquiry").checked,
        inquiryDescription: $("#lpConvertInquiryDesc").value.trim()
      }, session.username);
      if (!res.success) { showToast(res.reason || "Couldn't convert this lead.", "danger"); return; }
      logSystemActivity({module:"Lead Pipeline",action:"Convert",description:`Converted lead "${res.lead.leadCode}" into customer ${res.customer.customerCode}${res.inquiry?" + an inquiry":""} (${company.name})`});
      closeModal("lpConvertModal"); renderAll(); renderActivity();
      showToast(`Converted — ${res.customer.customerCode} created${res.inquiry?", plus an inquiry":""}.`, "success");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    session = requireSession("../index.html");
    if (!session) return;
    if (!window.ERP.enforcePageAccess(session, "lead-pipeline")) return;
    runBootSequence([{p:35,t:"Authenticating session…"},{p:70,t:"Loading pipeline…"},{p:100,t:"Ready."}]);
    company = ERP_CompanyRepository.getActive();
    if (!company) {
      $("#noCompanyState").hidden = false; $("#lpContent").hidden = true;
      $("#lpSubtitle").textContent = "No active company yet.";
    } else {
      $("#noCompanyState").hidden = true; $("#lpContent").hidden = false; $("#lpHeaderActions").hidden = false;
      $("#lpSubtitle").textContent = `Tracking prospects for ${company.name} (${company.companyCode}).`;
      renderAll(); renderActivity(); bindChips(); bindForm(); bindDetail();
    }
    $("#footerYear").textContent = new Date().getFullYear();
  });
})();
